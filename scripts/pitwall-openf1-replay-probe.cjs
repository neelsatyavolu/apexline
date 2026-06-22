const fs = require("node:fs");
const https = require("node:https");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const mainProcess = fs.readFileSync(path.join(root, "electron/main.cjs"), "utf8");

function extractNamedFunction(source, name) {
  const start = source.indexOf(`function ${name}`);
  if (start === -1) throw new Error(`${name} should exist`);
  const bodyStart = source.indexOf("{", start);
  let depth = 0;
  for (let index = bodyStart; index < source.length; index += 1) {
    const char = source[index];
    if (char === "{") depth += 1;
    if (char === "}") depth -= 1;
    if (depth === 0) return source.slice(start, index + 1);
  }
  throw new Error(`Could not extract ${name}`);
}

const timing = vm.runInNewContext(`(() => {
  const replayRowTimelineCache = new WeakMap();
  ${[
    "finiteNumber",
    "latestBy",
    "normalizeCompound",
    "groupRowsByDriverNumber",
    "normalizeStint",
    "stintsByDriverNumber",
    "latestStintForDriver",
    "tyreAgeFromStint",
    "pitCountsByDriverNumber",
    "lapDurationSeconds",
    "formatLapDuration",
    "bestLapsByDriverNumber",
    "clampPercent",
    "latestCarDataByDriverNumber",
    "timingSegmentTone",
    "miniSectorSegments",
    "openF1SectorTimes",
    "parseTiming",
    "latestLapsByDriverNumber",
    "normalizeOpenF1SessionKind",
    "scoreOpenF1ReplaySession",
    "replayRowDateMs",
    "replayRowsTimeline",
    "filterReplayRowsAt",
  ].map((name) => extractNamedFunction(mainProcess, name)).join("\n")}
  return { parseTiming, scoreOpenF1ReplaySession, filterReplayRowsAt };
})()`);

function readEnvFile() {
  const filePath = path.join(root, ".env");
  const values = {};
  try {
    const text = fs.readFileSync(filePath, "utf8");
    for (const line of text.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
      if (!match) continue;
      let value = match[2].trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
      values[match[1]] = value;
    }
  } catch {}
  return values;
}

function option(name, fallback = "") {
  const prefix = `--${name}=`;
  const found = process.argv.slice(2).find((arg) => arg.startsWith(prefix));
  return found ? found.slice(prefix.length) : fallback;
}

const env = readEnvFile();
const username = process.env.OPENF1_EMAIL || process.env.OPENF1_USERNAME || process.env.EMAIL || env.OPENF1_EMAIL || env.OPENF1_USERNAME || env.EMAIL || "";
const password = process.env.OPENF1_PASSWORD || process.env.PASSWORD || env.OPENF1_PASSWORD || env.PASSWORD || "";
const meetingKey = option("meeting", "1286");
const sessionKind = option("session", "Qualifying");
const elapsedSeconds = Number(option("elapsed", "861"));
const atIso = option("at", "");

const requestTimes = [];
let tokenCache = null;

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForSlot() {
  while (true) {
    const now = Date.now();
    while (requestTimes.length && now - requestTimes[0] >= 60000) requestTimes.shift();
    const recentSecond = requestTimes.filter((time) => now - time < 1000);
    if (recentSecond.length < 6 && requestTimes.length < 60) {
      requestTimes.push(now);
      return;
    }
    const secondDelay = recentSecond.length >= 6 ? 1000 - (now - recentSecond[0]) : 0;
    const minuteDelay = requestTimes.length >= 60 ? 60000 - (now - requestTimes[0]) : 0;
    await wait(Math.max(50, secondDelay, minuteDelay));
  }
}

function request(method, targetUrl, { headers = {}, body = "", timeout = 15000 } = {}) {
  return new Promise((resolve, reject) => {
    const endpoint = new URL(targetUrl);
    const req = https.request({
      method,
      hostname: endpoint.hostname,
      path: `${endpoint.pathname}${endpoint.search}`,
      headers: {
        Accept: "application/json",
        "User-Agent": "PitWall/0.1 replay probe",
        ...headers,
      },
      timeout,
    }, (res) => {
      let text = "";
      res.setEncoding("utf8");
      res.on("data", (chunk) => { text += chunk; });
      res.on("end", () => {
        if (res.statusCode < 200 || res.statusCode >= 300) {
          const error = new Error(`HTTP ${res.statusCode} ${endpoint.pathname}`);
          error.statusCode = res.statusCode;
          reject(error);
          return;
        }
        try {
          resolve(JSON.parse(text));
        } catch (error) {
          reject(error);
        }
      });
    });
    req.on("timeout", () => req.destroy(new Error(`Timeout ${endpoint.pathname}`)));
    req.on("error", reject);
    req.end(body);
  });
}

async function token() {
  if (!username || !password) return "";
  if (tokenCache?.accessToken && tokenCache.expiresAt - Date.now() > 60000) return tokenCache.accessToken;
  const body = new URLSearchParams({ username, password }).toString();
  const data = await request("POST", "https://api.openf1.org/token", {
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "Content-Length": Buffer.byteLength(body),
    },
    body,
  });
  tokenCache = {
    accessToken: data.access_token,
    expiresAt: Date.now() + Math.max(60, Number(data.expires_in || 3600)) * 1000,
  };
  return tokenCache.accessToken;
}

async function openF1(pathname, params = {}) {
  await waitForSlot();
  const url = new URL(`https://api.openf1.org/v1/${pathname}`);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== "") url.searchParams.set(key, String(value));
  }
  const accessToken = await token();
  const headers = accessToken ? { Authorization: `Bearer ${accessToken}` } : {};
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await request("GET", url.href, { headers });
    } catch (error) {
      if (error.statusCode !== 429 || attempt === 2) throw error;
      await wait(1500 * (attempt + 1));
    }
  }
  return [];
}

async function optionalOpenF1(pathname, params = {}) {
  try {
    return await openF1(pathname, params);
  } catch (error) {
    if (error.statusCode === 404) return [];
    throw error;
  }
}

(async () => {
  const sessions = await openF1("sessions", { meeting_key: meetingKey });
  const selectedSession = sessions
    .slice()
    .sort((a, b) => timing.scoreOpenF1ReplaySession(b, sessionKind) - timing.scoreOpenF1ReplaySession(a, sessionKind))[0];
  if (!selectedSession?.session_key) throw new Error(`No ${sessionKind} session found for meeting ${meetingKey}`);

  const sessionKey = selectedSession.session_key;
  const startMs = Date.parse(selectedSession.date_start || "");
  const targetMs = atIso ? Date.parse(atIso) : startMs + elapsedSeconds * 1000;
  if (!Number.isFinite(targetMs)) throw new Error("No target time could be derived.");

  const drivers = await openF1("drivers", { session_key: sessionKey });
  const positionsAll = await openF1("position", { session_key: sessionKey });
  const intervalsAll = await optionalOpenF1("intervals", { session_key: sessionKey });
  const lapsAll = await openF1("laps", { session_key: sessionKey });
  const stintsAll = await openF1("stints", { session_key: sessionKey });
  const pitAll = await optionalOpenF1("pit", { session_key: sessionKey });
  const anchorDriverNumber = positionsAll[0]?.driver_number || drivers[0]?.driver_number || "";
  const anchorCarData = anchorDriverNumber ? await optionalOpenF1("car_data", { session_key: sessionKey, driver_number: anchorDriverNumber }) : [];
  const firstPositionRow = positionsAll.find((row) => row?.date);
  const firstPositionMs = firstPositionRow?.date ? Date.parse(firstPositionRow.date) : null;
  const firstCarDataMs = anchorCarData[0]?.date ? Date.parse(anchorCarData[0].date) : null;
  const lastCarDataMs = anchorCarData[anchorCarData.length - 1]?.date ? Date.parse(anchorCarData[anchorCarData.length - 1].date) : null;
  const carDataOffsetMs = Number.isFinite(firstPositionMs) && Number.isFinite(firstCarDataMs) && !(firstCarDataMs <= firstPositionMs && lastCarDataMs >= firstPositionMs)
    ? firstCarDataMs - firstPositionMs
    : 0;
  const carDataTargetMs = targetMs + carDataOffsetMs;
  const carData = await optionalOpenF1("car_data", {
    session_key: sessionKey,
    "date>": new Date(Math.max(0, carDataTargetMs - 120000)).toISOString(),
    "date<": new Date(carDataTargetMs + 1000).toISOString(),
  });
  const anchorWindowCarData = anchorDriverNumber ? await optionalOpenF1("car_data", {
    session_key: sessionKey,
    driver_number: anchorDriverNumber,
    "date>": new Date(Math.max(0, carDataTargetMs - 4000)).toISOString(),
    "date<": new Date(carDataTargetMs + 1000).toISOString(),
  }) : [];

  const positions = timing.filterReplayRowsAt(positionsAll, targetMs);
  const intervals = timing.filterReplayRowsAt(intervalsAll, targetMs);
  const laps = timing.filterReplayRowsAt(lapsAll, targetMs);
  const stints = timing.filterReplayRowsAt(stintsAll, targetMs);
  const pits = timing.filterReplayRowsAt(pitAll, targetMs);
  const rows = timing.parseTiming(drivers, positions, intervals, [], stints, pits, laps, carData);
  const summary = {
    meetingKey,
    sessionKey,
    sessionName: selectedSession.session_name,
    targetDate: new Date(targetMs).toISOString(),
    authenticated: Boolean(username && password),
    counts: {
      drivers: drivers.length,
      positions: positions.length,
      cachedPositions: positionsAll.length,
      intervals: intervals.length,
      cachedIntervals: intervalsAll.length,
      laps: laps.length,
      cachedLaps: lapsAll.length,
      stints: stints.length,
      cachedStints: stintsAll.length,
      pits: pits.length,
      anchorCarData: anchorCarData.length,
      anchorWindowCarData: anchorWindowCarData.length,
      carData: carData.length,
    },
    carDataOffsetSeconds: Math.round(carDataOffsetMs / 1000),
    carDataAnchorDates: {
      first: anchorCarData[0]?.date || "",
      middle: anchorCarData[Math.floor(anchorCarData.length / 2)]?.date || "",
      last: anchorCarData[anchorCarData.length - 1]?.date || "",
    },
    rows: rows.slice(0, 12).map((row) => ({
      pos: row.pos,
      code: row.code,
      last: row.last,
      best: row.best,
      gap: row.gap,
      interval: row.interval,
      tyre: row.comp,
      age: row.age,
      sectors: row.sectors,
      telemetry: row.telemetry,
    })),
  };
  console.log(JSON.stringify(summary, null, 2));
})().catch((error) => {
  console.error(error.message || String(error));
  process.exit(1);
});
