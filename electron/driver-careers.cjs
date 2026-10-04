// Driver career totals from Jolpica (Ergast-compatible) championship results.
//
// Completed seasons never change, so totals through the last finished season are
// bundled in driver-career-baseline.json (regenerate with
// `node scripts/refresh-driver-careers.cjs`). At runtime only the seasons after
// that baseline are fetched — a handful of requests for every driver at once —
// instead of paging each driver's full history on demand.

const JOLPICA_BASE_URL = "https://api.jolpi.ca/ergast/f1";
const JOLPICA_PAGE_LIMIT = 100;
const JOLPICA_MIN_GAP_MS = 350;
const JOLPICA_RATE_LIMIT_RETRIES = 3;
const JOLPICA_RATE_LIMIT_BACKOFF_MS = 2000;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Serializes Jolpica calls with a minimum gap and backs off on HTTP 429, so a
// burst of callers never trips the API's rate limit.
function createJolpicaClient(requestJson, { minGapMs = JOLPICA_MIN_GAP_MS, wait = sleep } = {}) {
  let queue = Promise.resolve();
  let lastAt = 0;
  async function run(url) {
    for (let attempt = 0; ; attempt += 1) {
      const gap = lastAt + minGapMs - Date.now();
      if (gap > 0) await wait(gap);
      lastAt = Date.now();
      try {
        return await requestJson(url);
      } catch (error) {
        const rateLimited = /\b429\b/.test(String(error?.message || "")) || error?.statusCode === 429;
        if (!rateLimited || attempt >= JOLPICA_RATE_LIMIT_RETRIES) throw error;
        await wait(JOLPICA_RATE_LIMIT_BACKOFF_MS * 2 ** attempt);
      }
    }
  }
  return (url) => {
    const next = queue.then(() => run(url));
    queue = next.catch(() => {});
    return next;
  };
}

// Every race of a paged Jolpica race-table endpoint (path relative to the base URL).
async function fetchAllRaces(jolpica, path) {
  const races = [];
  const join = path.includes("?") ? "&" : "?";
  for (let offset = 0; ; offset += JOLPICA_PAGE_LIMIT) {
    const json = await jolpica(`${JOLPICA_BASE_URL}${path}${join}limit=${JOLPICA_PAGE_LIMIT}&offset=${offset}`);
    const page = json?.MRData?.RaceTable?.Races || [];
    races.push(...page);
    if (!page.length || offset + JOLPICA_PAGE_LIMIT >= Number(json?.MRData?.total || 0)) return races;
  }
}

function positiveNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function minPosition(a, b) {
  if (a == null) return b;
  if (b == null) return a;
  return Math.min(a, b);
}

// Per-driver-code totals from race results. Poles are counted as starts from
// grid 1: Jolpica's qualifying data drifts from the official pole tallies,
// while grid 1 matches them for nearly every driver.
function tallyCareerResults(races = []) {
  const tallies = {};
  const tallyFor = (code) => {
    tallies[code] = tallies[code] || { gp: 0, careerWins: 0, podiums: 0, poles: 0, fl: 0, bestFinishPos: null, bestGridPos: null };
    return tallies[code];
  };
  for (const race of races) {
    for (const row of race?.Results || []) {
      const code = row?.Driver?.code;
      if (!code) continue;
      const tally = tallyFor(code);
      const position = positiveNumber(row.position);
      const grid = positiveNumber(row.grid);
      tally.gp += 1;
      if (position === 1) tally.careerWins += 1;
      if (position != null && position <= 3) tally.podiums += 1;
      if (grid === 1) tally.poles += 1;
      if (String(row?.FastestLap?.rank || "") === "1") tally.fl += 1;
      tally.bestFinishPos = minPosition(tally.bestFinishPos, position);
      tally.bestGridPos = minPosition(tally.bestGridPos, grid);
    }
  }
  return tallies;
}

function mergeCareerTallies(base = {}, extra = {}) {
  const merged = { ...base };
  for (const [code, add] of Object.entries(extra)) {
    const prev = merged[code];
    merged[code] = prev ? {
      gp: prev.gp + add.gp,
      careerWins: prev.careerWins + add.careerWins,
      podiums: prev.podiums + add.podiums,
      poles: prev.poles + add.poles,
      fl: prev.fl + add.fl,
      bestFinishPos: minPosition(prev.bestFinishPos, add.bestFinishPos),
      bestGridPos: minPosition(prev.bestGridPos, add.bestGridPos),
    } : { ...add };
  }
  return merged;
}

function ordinalPosition(value) {
  const n = positiveNumber(value);
  if (n == null) return null;
  const suffix = n % 100 >= 11 && n % 100 <= 13 ? "th" : ["th", "st", "nd", "rd"][n % 10] || "th";
  return `${n}${suffix}`;
}

// The shape the Drivers screen reads. World titles are not here: Jolpica only
// serves standings per season, so they stay in the renderer's static reference.
function careerForDisplay(tally) {
  return {
    gp: tally.gp,
    careerWins: tally.careerWins,
    podiums: tally.podiums,
    poles: tally.poles,
    fl: tally.fl,
    bestFinish: ordinalPosition(tally.bestFinishPos),
    bestGrid: ordinalPosition(tally.bestGridPos),
  };
}

async function fetchSeasonTallies(jolpica, season) {
  return tallyCareerResults(await fetchAllRaces(jolpica, `/${season}/results.json`));
}

// Baseline totals plus every season after it, up to and including `currentSeason`.
async function buildDriverCareers(jolpica, baseline, currentSeason) {
  let tallies = baseline?.drivers || {};
  for (let season = Number(baseline?.throughSeason || currentSeason - 1) + 1; season <= currentSeason; season += 1) {
    tallies = mergeCareerTallies(tallies, await fetchSeasonTallies(jolpica, season));
  }
  return Object.fromEntries(Object.entries(tallies).map(([code, tally]) => [code, careerForDisplay(tally)]));
}

module.exports = {
  JOLPICA_BASE_URL,
  createJolpicaClient,
  fetchAllRaces,
  tallyCareerResults,
  mergeCareerTallies,
  careerForDisplay,
  ordinalPosition,
  buildDriverCareers,
};
