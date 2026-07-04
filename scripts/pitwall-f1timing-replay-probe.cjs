const assert = require("node:assert/strict");
const fs = require("node:fs");
const https = require("node:https");
const path = require("node:path");
const vm = require("node:vm");
const zlib = require("node:zlib");

const root = path.resolve(__dirname, "..");
const mainProcess = fs.readFileSync(path.join(root, "electron/main.cjs"), "utf8");

function extractNamedFunction(source, name) {
  const start = source.indexOf(`function ${name}`);
  if (start === -1) throw new Error(`${name} should exist`);
  const signatureEnd = source.indexOf(")", start);
  const bodyStart = source.indexOf("{", signatureEnd);
  let depth = 0;
  for (let index = bodyStart; index < source.length; index += 1) {
    const char = source[index];
    if (char === "{") depth += 1;
    if (char === "}") depth -= 1;
    if (depth === 0) return source.slice(start, index + 1);
  }
  throw new Error(`Could not extract ${name}`);
}

const parser = vm.runInNewContext(`(() => {
  const f1TimingTelemetrySampleCache = new WeakMap();
  const f1TimingPositionSampleCache = new WeakMap();
  const f1TimingStateCursorCache = new WeakMap();
  ${[
    "finiteNumber",
    "groupRowsByDriverNumber",
    "clampPercent",
    "latestCarDataByDriverNumber",
    "timingSegmentTone",
    "formatLapDuration",
    "normalizeCompound",
    "stripJsonBom",
    "f1TimingSeconds",
    "decodeF1TimingZPayload",
    "parseF1TimingJsonStream",
    "mergeF1TimingDelta",
    "f1TimingStateAt",
    "f1TimingStateBetween",
    "f1TimingLatestEntryAt",
    "f1TimingArchiveStartUtcMs",
    "f1TimingArchiveSecondsForUtc",
    "f1TimingVideoStartArchiveSeconds",
    "f1TimingValue",
    "f1TimingDurationSeconds",
    "formatF1TimingDuration",
    "f1TimingSessionStartSeconds",
    "f1TimingTargetUtcMs",
    "f1TimingExplicitQualifyingPart",
    "f1TimingQualifyingPart",
    "f1TimingQualifyingPartStartSeconds",
    "parseF1TimingLapCount",
    "fillF1TimingQualifyingDeltas",
    "parseF1TimingSessionClock",
    "f1TimingLapSeconds",
    "f1TimingSegments",
    "f1TimingSectorTime",
    "f1TimingStints",
    "f1TimingLatestStint",
    "f1TimingKnownCompoundsByNumber",
    "f1TimingTelemetryFromCarData",
    "f1TimingTelemetrySamples",
    "f1TimingTelemetryRowsAt",
    "f1TimingInterpolatedPositionRowsAt",
    "f1TimingPositionSamples",
    "f1TimingPositionRowsAt",
    "parseF1TimingWeatherState",
    "parseF1TimingRaceControlMessages",
    "f1TimingLapTimeline",
    "parseF1TimingArchiveRows",
  ].map((name) => extractNamedFunction(mainProcess, name)).join("\n")}
  return { parseF1TimingJsonStream, parseF1TimingArchiveRows };
})()`, { Buffer, zlib });

function option(name, fallback = "") {
  const prefix = `--${name}=`;
  const found = process.argv.slice(2).filter((arg) => arg.startsWith(prefix)).at(-1);
  return found ? found.slice(prefix.length) : fallback;
}

const baseUrl = option("base", "https://livetiming.formula1.com/static/2026/2026-06-07_Monaco_Grand_Prix/2026-06-06_Qualifying/");
const elapsedSeconds = Number(option("elapsed", "3600"));
const rowLimit = Number(option("rows", "12"));
const timingAnchorInput = option("anchor", "program");
const timingAnchor = timingAnchorInput === "session" || timingAnchorInput === "video" ? timingAnchorInput : "program";
const videoStartUtc = option("video-start-utc", "");
const videoStartArchiveRaw = option("video-start-archive", "");
const videoStartArchiveSeconds = videoStartArchiveRaw === "" ? NaN : Number(videoStartArchiveRaw);

function requestText(targetUrl, timeout = 20000) {
  return new Promise((resolve, reject) => {
    const req = https.get(targetUrl, {
      headers: {
        Accept: "application/json, text/plain, */*",
        "Accept-Encoding": "identity",
        "User-Agent": "BestHTTP",
      },
      timeout,
    }, (res) => {
      let text = "";
      res.setEncoding("utf8");
      res.on("data", (chunk) => { text += chunk; });
      res.on("end", () => {
        if (res.statusCode < 200 || res.statusCode >= 300) {
          const error = new Error(`HTTP ${res.statusCode} ${new URL(targetUrl).pathname}`);
          error.statusCode = res.statusCode;
          reject(error);
          return;
        }
        resolve(text);
      });
    });
    req.on("timeout", () => req.destroy(new Error(`Timeout ${new URL(targetUrl).pathname}`)));
    req.on("error", reject);
  });
}

async function optionalText(file) {
  try {
    return await requestText(new URL(file, baseUrl).href);
  } catch (error) {
    if (error.statusCode === 403 || error.statusCode === 404) return "";
    throw error;
  }
}

(async () => {
  assert.ok(Number.isFinite(elapsedSeconds) && elapsedSeconds >= 0, "--elapsed must be a positive number");
  const [driverListText, timingText, appText, clockText, sessionDataText, statusText, trackStatusText, raceControlText, lapCountText, weatherText, carText, positionText] = await Promise.all([
    optionalText("DriverList.jsonStream"),
    requestText(new URL("TimingData.jsonStream", baseUrl).href),
    optionalText("TimingAppData.jsonStream"),
    optionalText("ExtrapolatedClock.jsonStream"),
    optionalText("SessionData.jsonStream"),
    optionalText("SessionStatus.jsonStream"),
    optionalText("TrackStatus.jsonStream"),
    optionalText("RaceControlMessages.jsonStream"),
    optionalText("LapCount.jsonStream"),
    optionalText("WeatherData.jsonStream"),
    optionalText("CarData.z.jsonStream"),
    optionalText("Position.z.jsonStream"),
  ]);
  const sessionData = {
    driverListEntries: driverListText ? parser.parseF1TimingJsonStream(driverListText) : [],
    timingEntries: parser.parseF1TimingJsonStream(timingText),
    timingAppEntries: appText ? parser.parseF1TimingJsonStream(appText) : [],
    clockEntries: clockText ? parser.parseF1TimingJsonStream(clockText) : [],
    sessionDataEntries: sessionDataText ? parser.parseF1TimingJsonStream(sessionDataText) : [],
    sessionStatusEntries: statusText ? parser.parseF1TimingJsonStream(statusText) : [],
    trackStatusEntries: trackStatusText ? parser.parseF1TimingJsonStream(trackStatusText) : [],
    raceControlEntries: raceControlText ? parser.parseF1TimingJsonStream(raceControlText) : [],
    lapCountEntries: lapCountText ? parser.parseF1TimingJsonStream(lapCountText) : [],
    weatherEntries: weatherText ? parser.parseF1TimingJsonStream(weatherText) : [],
    carDataEntries: carText ? parser.parseF1TimingJsonStream(carText, { zipped: true }) : [],
    positionEntries: positionText ? parser.parseF1TimingJsonStream(positionText, { zipped: true }) : [],
  };
  const parsed = parser.parseF1TimingArchiveRows(sessionData, elapsedSeconds, {
    timingAnchor,
    videoStartUtc,
    videoStartArchiveSeconds: Number.isFinite(videoStartArchiveSeconds) ? videoStartArchiveSeconds : null,
  });
  const richRows = {
    total: parsed.timing.length,
    withLastLap: parsed.timing.filter((row) => row.last).length,
    withBestLap: parsed.timing.filter((row) => row.best).length,
    withMiniSectors: parsed.timing.filter((row) => row.sectors?.s1?.length || row.sectors?.s2?.length || row.sectors?.s3?.length).length,
    withTyres: parsed.timing.filter((row) => row.comp).length,
    withTelemetry: parsed.timing.filter((row) => row.telemetry?.speed != null).length,
    withTrackPosition: parsed.timing.filter((row) => row.trackPosition?.x != null && row.trackPosition?.y != null).length,
  };
  console.log(JSON.stringify({
    source: "Formula 1 livetiming archive",
    baseUrl,
    elapsedSeconds,
    timingAnchor,
    diagnostics: parsed.diagnostics,
    sessionClock: parsed.sessionClock,
    lapCount: parsed.sessionClock?.lapCount,
    richRows,
    weather: parsed.weather,
    rows: parsed.timing.slice(0, Math.max(0, rowLimit)).map((row) => ({
      pos: row.pos,
      code: row.code,
      number: row.number,
      last: row.last,
      best: row.best,
      gap: row.gap,
      interval: row.interval,
      tyre: row.comp,
      age: row.age,
      sectors: row.sectors,
      telemetry: row.telemetry,
      trackPosition: row.trackPosition,
    })),
  }, null, 2));
})().catch((error) => {
  console.error(error.message || String(error));
  process.exit(1);
});
