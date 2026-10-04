#!/usr/bin/env node
// Regenerates electron/driver-career-baseline.json: career totals for the
// current grid through the last completed season. Run once per season (after
// the finale) or when a driver joins mid-season, then commit the JSON.
//   node scripts/refresh-driver-careers.cjs [throughSeason]
const fs = require("node:fs");
const path = require("node:path");
const { JOLPICA_BASE_URL, createJolpicaClient, fetchAllRaces, tallyCareerResults } = require("../electron/driver-careers.cjs");

const OUTPUT = path.join(__dirname, "../electron/driver-career-baseline.json");

async function requestJson(url) {
  const response = await fetch(url, { headers: { "User-Agent": "Apexline/1.0 (+https://github.com/neelsatyavolu/apexline)" } });
  if (!response.ok) throw new Error(`${response.status} ${url}`);
  return response.json();
}

async function main() {
  const throughSeason = Number(process.argv[2]) || new Date().getFullYear() - 1;
  const gridSeason = throughSeason + 1;
  const jolpica = createJolpicaClient(requestJson);
  const grid = await jolpica(`${JOLPICA_BASE_URL}/${gridSeason}/drivers.json?limit=100`);
  // Practice-only entrants have no driver code and no Grand Prix starts.
  const entrants = (grid?.MRData?.DriverTable?.Drivers || []).filter((driver) => driver.code);
  if (!entrants.length) throw new Error(`No ${gridSeason} entry list from Jolpica`);
  const drivers = {};
  for (const driver of entrants) {
    const inBaseline = (race) => Number(race.season) <= throughSeason;
    const races = (await fetchAllRaces(jolpica, `/drivers/${encodeURIComponent(driver.driverId)}/results.json`)).filter(inBaseline);
    const tally = tallyCareerResults(races)[driver.code];
    if (tally) drivers[driver.code] = tally;
    process.stdout.write(`${driver.code} ${tally ? `${tally.gp} GP` : "rookie"}\n`);
  }
  const baseline = { throughSeason, generatedAt: new Date().toISOString().slice(0, 10), drivers };
  fs.writeFileSync(OUTPUT, `${JSON.stringify(baseline, null, 2)}\n`);
  process.stdout.write(`Wrote ${Object.keys(drivers).length} drivers through ${throughSeason} to ${path.relative(process.cwd(), OUTPUT)}\n`);
}

main().catch((error) => {
  process.stderr.write(`${error?.stack || error}\n`);
  process.exit(1);
});
