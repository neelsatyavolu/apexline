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
    "f1TimingLapTimeline",
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
    "f1TimingPositionBounds",
    "parseF1TimingWeatherState",
    "parseF1TimingRaceControlMessages",
    "parseF1TimingArchiveRows",
    "f1TimingRaceStartArchiveSeconds",
    "trackMapPositionOnlyTimingRows",
  ].map((name) => extractNamedFunction(mainProcess, name)).join("\n")}
  return { f1TimingSeconds, decodeF1TimingZPayload, parseF1TimingJsonStream, parseF1TimingArchiveRows, f1TimingTargetUtcMs, f1TimingPositionSamples, f1TimingPositionRowsAt, f1TimingPositionBounds, f1TimingRaceStartArchiveSeconds, trackMapPositionOnlyTimingRows };
})()`, { Buffer, zlib });

function option(name, fallback = "") {
  const prefix = `--${name}=`;
  const found = process.argv.slice(2).filter((arg) => arg.startsWith(prefix)).at(-1);
  return found ? found.slice(prefix.length) : fallback;
}
function hasOption(name) {
  return process.argv.slice(2).some((arg) => arg === `--${name}` || arg.startsWith(`--${name}=`));
}

const baseUrl = option("base", "https://livetiming.formula1.com/static/2026/2026-06-07_Monaco_Grand_Prix/2026-06-07_Race/");
const elapsedSeconds = Number(option("elapsed", "711"));
const outFile = option("out", "/private/tmp/apexline-trackmap-monaco-race-render.svg");
const initialLoad = /^(1|true|yes)$/i.test(option("initial-load", ""));
const raceRelative = !/^(0|false|no)$/i.test(option("race-relative", "true"));
const movementDurationSeconds = Number(option("movement-duration", "0"));

function requestText(targetUrl, timeout = 20000) {
  return new Promise((resolve, reject) => {
    const endpoint = new URL(targetUrl);
    const req = https.get(targetUrl, {
      headers: { Accept: "application/json, text/plain, */*", "Accept-Encoding": "identity", "User-Agent": "BestHTTP" },
      timeout,
    }, (res) => {
      let text = "";
      res.setEncoding("utf8");
      res.on("data", (chunk) => { text += chunk; });
      res.on("end", () => {
        if (res.statusCode < 200 || res.statusCode >= 300) {
          reject(new Error(`HTTP ${res.statusCode} ${endpoint.pathname}`));
          return;
        }
        resolve(text);
      });
    });
    req.on("timeout", () => req.destroy(new Error(`Timeout ${endpoint.pathname}`)));
    req.on("error", reject);
  });
}

function requestJsonStreamEntries(targetUrl, { targetSeconds = Infinity, zipped = false, bufferSeconds = 2 } = {}) {
  const stopSeconds = Number.isFinite(targetSeconds) ? targetSeconds + bufferSeconds : Infinity;
  return new Promise((resolve, reject) => {
    const endpoint = new URL(targetUrl);
    const entries = [];
    let pending = "";
    let settled = false;
    const finish = () => { if (!settled) { settled = true; resolve(entries); } };
    const fail = (error) => { if (!settled) { settled = true; reject(error); } };
    const parseLine = (line) => {
      const clean = String(line || "").replace(/^\uFEFF/, "").trim();
      if (!clean) return false;
      const seconds = parser.f1TimingSeconds(clean.slice(0, 12));
      if (seconds > stopSeconds) return true;
      const raw = JSON.parse(clean.slice(12));
      entries.push({ time: clean.slice(0, 12), seconds, data: zipped ? parser.decodeF1TimingZPayload(raw) : raw });
      return false;
    };
    const req = https.get(targetUrl, {
      headers: { Accept: "application/json, text/plain, */*", "Accept-Encoding": "identity", "User-Agent": "BestHTTP" },
      timeout: 20000,
    }, (res) => {
      if (res.statusCode < 200 || res.statusCode >= 300) {
        res.resume();
        fail(new Error(`HTTP ${res.statusCode} ${endpoint.pathname}`));
        return;
      }
      res.setEncoding("utf8");
      res.on("data", (chunk) => {
        if (settled) return;
        pending += chunk;
        const lines = pending.split(/\r?\n/);
        pending = lines.pop() || "";
        for (const line of lines) {
          if (parseLine(line)) {
            finish();
            req.destroy();
            return;
          }
        }
      });
      res.on("end", () => {
        if (!settled && pending) parseLine(pending);
        finish();
      });
    });
    req.on("timeout", () => req.destroy(new Error(`Timeout ${endpoint.pathname}`)));
    req.on("error", (error) => {
      if (settled && /aborted|socket hang up/i.test(error?.message || "")) return;
      fail(error);
    });
  });
}

function loadMonacoCircuit() {
  const sandbox = { window: {} };
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(path.join(root, "ui_kits/pitwall/trackmap-circuits.js"), "utf8"), sandbox);
  return sandbox.window.PW_TRACKMAP_CIRCUITS.monaco;
}

function viewBox(points) {
  const xs = points.map((p) => p[0]), ys = points.map((p) => p[1]);
  const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
  const pad = 34;
  return { x: minX - pad, y: minY - pad, w: maxX - minX + pad * 2, h: maxY - minY + pad * 2 };
}

function linePath(points) {
  return points.map((point, index) => `${index ? "L" : "M"} ${point[0]} ${point[1]}`).join(" ") + " Z";
}

function distanceToSegment(p, a, b) {
  const vx = b[0] - a[0], vy = b[1] - a[1];
  const wx = p.x - a[0], wy = p.y - a[1];
  const len2 = vx * vx + vy * vy || 1;
  const t = Math.max(0, Math.min(1, (wx * vx + wy * vy) / len2));
  const x = a[0] + vx * t, y = a[1] + vy * t;
  return { x, y, d: Math.hypot(p.x - x, p.y - y) };
}

function nearestTrackPoint(p, points) {
  let best = null;
  for (let i = 0; i < points.length; i += 1) {
    const hit = distanceToSegment(p, points[i], points[(i + 1) % points.length]);
    if (!best || hit.d < best.d) best = hit;
  }
  return best;
}

function pointAtTrackFraction(points, frac) {
  const lengths = points.map((point, index) => Math.hypot(points[(index + 1) % points.length][0] - point[0], points[(index + 1) % points.length][1] - point[1]));
  const total = lengths.reduce((sum, value) => sum + value, 0) || 1;
  let target = ((frac % 1) + 1) % 1 * total;
  for (let index = 0; index < points.length; index += 1) {
    const length = lengths[index] || 1;
    if (target <= length) {
      const a = points[index], b = points[(index + 1) % points.length];
      const t = target / length;
      return { x: a[0] + (b[0] - a[0]) * t, y: a[1] + (b[1] - a[1]) * t };
    }
    target -= length;
  }
  return { x: points[0][0], y: points[0][1] };
}

function transformOfficialPoint(point, variant) {
  const x = variant.flipX ? -point.x : point.x;
  const y = variant.flipY ? -point.y : point.y;
  return variant.swap ? { x: y, y: x } : { x, y };
}

function transformedBounds(bounds, variant) {
  const corners = [
    { x: bounds.minX, y: bounds.minY }, { x: bounds.minX, y: bounds.maxY },
    { x: bounds.maxX, y: bounds.minY }, { x: bounds.maxX, y: bounds.maxY },
  ].map((point) => transformOfficialPoint(point, variant));
  return {
    minX: Math.min(...corners.map((point) => point.x)),
    maxX: Math.max(...corners.map((point) => point.x)),
    minY: Math.min(...corners.map((point) => point.y)),
    maxY: Math.max(...corners.map((point) => point.y)),
  };
}

function projectOfficialPoint(point, bounds, vb, variant) {
  const src = transformOfficialPoint(point, variant);
  const b = transformedBounds(bounds, variant);
  const srcW = Math.max(1, b.maxX - b.minX), srcH = Math.max(1, b.maxY - b.minY);
  const pad = 42;
  const scale = Math.min((vb.w - pad * 2) / srcW, (vb.h - pad * 2) / srcH);
  const usedW = srcW * scale, usedH = srcH * scale;
  const ox = vb.x + (vb.w - usedW) / 2 - b.minX * scale;
  const oy = vb.y + (vb.h - usedH) / 2 - b.minY * scale;
  return { x: src.x * scale + ox, y: src.y * scale + oy };
}

function projectCars(rows, bounds, vb, trackPoints, playOffset = 0) {
  const cars = rows.filter((row) => row?.code);
  const officialCars = cars.filter((row) => row.trackPosition?.x != null && row.trackPosition?.y != null);
  if (!officialCars.length) {
    return cars.map((row, index) => {
      const point = pointAtTrackFraction(trackPoints, index / Math.max(1, cars.length) + playOffset);
      return { ...row, raw: point, render: point, rawDistance: 0, renderSource: "track-fallback" };
    });
  }
  const variants = [];
  [false, true].forEach((swap) => [false, true].forEach((flipX) => [false, true].forEach((flipY) => variants.push({ swap, flipX, flipY }))));
  const scored = variants.map((variant) => {
    const raw = officialCars.map((row) => projectOfficialPoint(row.trackPosition, bounds, vb, variant));
    const avg = raw.reduce((sum, point) => sum + nearestTrackPoint(point, trackPoints).d, 0) / Math.max(1, raw.length);
    return { variant, avg };
  }).sort((a, b) => a.avg - b.avg);
  const variant = scored[0].variant;
  const officialRendered = officialCars.map((row) => {
    const raw = projectOfficialPoint(row.trackPosition, bounds, vb, variant);
    const snapped = nearestTrackPoint(raw, trackPoints);
    return { ...row, raw, render: { x: snapped.x, y: snapped.y }, rawDistance: snapped.d, renderSource: "official" };
  });
  const distinct = new Set(officialRendered.map((row) => `${Math.round(row.render.x / 4)}:${Math.round(row.render.y / 4)}`));
  if (distinct.size < Math.min(8, Math.ceil(officialRendered.length / 2))) {
    return cars.map((row, index) => {
      const point = pointAtTrackFraction(trackPoints, index / Math.max(1, cars.length) + playOffset);
      return { ...row, raw: point, render: point, rawDistance: 0, renderSource: "track-fallback" };
    });
  }
  return officialRendered;
}

async function loadSessionData(targetElapsedSeconds) {
  const startedAt = Date.now();
  const [driverListText, timingEntries, appEntries, clockEntries, sessionDataEntries, statusEntries, trackStatusEntries, raceControlEntries, lapCountText, weatherText, positionText] = await Promise.all([
    requestText(new URL("DriverList.jsonStream", baseUrl).href).catch(() => ""),
    requestJsonStreamEntries(new URL("TimingData.jsonStream", baseUrl).href, { targetSeconds: targetElapsedSeconds }),
    requestJsonStreamEntries(new URL("TimingAppData.jsonStream", baseUrl).href, { targetSeconds: targetElapsedSeconds }).catch(() => []),
    requestJsonStreamEntries(new URL("ExtrapolatedClock.jsonStream", baseUrl).href, { targetSeconds: targetElapsedSeconds }).catch(() => []),
    // SessionData anchors UTC<->archive-seconds; without it the freshness gate
    // in renderSnapshot rejects every position row (~3.5min skew) and the
    // probe silently exercises only the fallback path.
    requestJsonStreamEntries(new URL("SessionData.jsonStream", baseUrl).href, { targetSeconds: targetElapsedSeconds }).catch(() => []),
    requestJsonStreamEntries(new URL("SessionStatus.jsonStream", baseUrl).href, { targetSeconds: targetElapsedSeconds }).catch(() => []),
    requestJsonStreamEntries(new URL("TrackStatus.jsonStream", baseUrl).href, { targetSeconds: targetElapsedSeconds }).catch(() => []),
    requestJsonStreamEntries(new URL("RaceControlMessages.jsonStream", baseUrl).href, { targetSeconds: targetElapsedSeconds }).catch(() => []),
    requestText(new URL("LapCount.jsonStream", baseUrl).href).catch(() => ""),
    requestText(new URL("WeatherData.jsonStream", baseUrl).href).catch(() => ""),
    requestText(new URL("Position.z.jsonStream", baseUrl).href),
  ]);
  const fetchMs = Date.now() - startedAt;
  return {
    fetchMs,
    sessionData: {
    driverListEntries: driverListText ? parser.parseF1TimingJsonStream(driverListText) : [],
    timingEntries,
    timingAppEntries: appEntries,
    clockEntries,
    sessionDataEntries,
    sessionStatusEntries: statusEntries,
    trackStatusEntries,
    raceControlEntries,
    lapCountEntries: lapCountText ? parser.parseF1TimingJsonStream(lapCountText) : [],
    weatherEntries: weatherText ? parser.parseF1TimingJsonStream(weatherText) : [],
    carDataEntries: [],
    positionEntries: parser.parseF1TimingJsonStream(positionText, { zipped: true }),
    },
  };
}

function renderSnapshot(sessionData, targetElapsedSeconds, playOffset = 0) {
  const parsed = parser.parseF1TimingArchiveRows(sessionData, targetElapsedSeconds, { timingAnchor: "program" });
  const targetSeconds = parsed.diagnostics?.targetSeconds ?? targetElapsedSeconds;
  const targetUtcMs = parser.f1TimingTargetUtcMs(sessionData, targetSeconds);
  const positionByNumber = new Map(parser.f1TimingPositionRowsAt(sessionData, targetSeconds).map((row) => [
    Number(row.driver_number),
    { date: row.date, x: row.x, y: row.y, z: row.z, status: row.status },
  ]).filter(([, row]) => {
    const rowUtcMs = Date.parse(row.date || "");
    return !Number.isFinite(targetUtcMs) || !Number.isFinite(rowUtcMs) || Math.abs(targetUtcMs - rowUtcMs) <= 4000;
  }));
  const timing = (parsed.timing.length
    ? parsed.timing
    : parser.trackMapPositionOnlyTimingRows(sessionData, targetSeconds, positionByNumber)
  ).map((row) => ({ ...row, trackPosition: positionByNumber.get(Number(row.number)) || null }));
  const bounds = parser.f1TimingPositionBounds(sessionData);
  const circuit = loadMonacoCircuit();
  const vb = viewBox(circuit.points);
  const rendered = projectCars(timing, bounds, vb, circuit.points, playOffset);
  const distances = rendered.map((row) => row.rawDistance);
  const maxRawDistance = Math.max(...distances);
  const avgRawDistance = distances.reduce((sum, value) => sum + value, 0) / Math.max(1, distances.length);
  const renderDistances = rendered.map((row) => nearestTrackPoint(row.render, circuit.points).d);
  const maxRenderDistance = Math.max(...renderDistances);
  fs.writeFileSync(outFile, `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb.x} ${vb.y} ${vb.w} ${vb.h}">
  <rect x="${vb.x}" y="${vb.y}" width="${vb.w}" height="${vb.h}" fill="#080c14"/>
  <path d="${linePath(circuit.points)}" fill="none" stroke="#3a4252" stroke-width="18" stroke-linejoin="round" stroke-linecap="round"/>
  <path d="${linePath(circuit.points)}" fill="none" stroke="#10151f" stroke-width="11" stroke-linejoin="round" stroke-linecap="round"/>
  ${rendered.map((row) => `<g transform="translate(${row.render.x.toFixed(2)} ${row.render.y.toFixed(2)})"><circle r="10" fill="#18d6b3" stroke="#03100d" stroke-width="2"/><text x="0" y="3" text-anchor="middle" font-size="8" font-family="monospace" fill="#fff">${String(row.code).slice(0, 3)}</text></g>`).join("\n  ")}
</svg>\n`);
  return { parsed: { ...parsed, timing }, rendered, maxRawDistance, avgRawDistance, maxRenderDistance };
}

function firstEntrySeconds(entries) {
  return entries.map((entry) => Number(entry?.seconds)).find((value) => Number.isFinite(value)) ?? null;
}

function lastEntrySeconds(entries) {
  return entries.map((entry) => Number(entry?.seconds)).filter((value) => Number.isFinite(value)).at(-1) ?? null;
}

function uniqueRenderPointCount(rendered) {
  return new Set(rendered.map((row) => `${Math.round(row.render.x / 4)}:${Math.round(row.render.y / 4)}`)).size;
}

function nearbyPositionDates(sessionData, targetSeconds, limit = 6) {
  const targetUtcMs = parser.f1TimingTargetUtcMs(sessionData, targetSeconds);
  const samples = parser.f1TimingPositionSamples(sessionData).samples;
  const uniqueDates = Array.from(new Set(samples.map((sample) => sample.utcMs).filter(Number.isFinite))).sort((a, b) => a - b);
  const dates = uniqueDates
    .slice()
    .sort((a, b) => Math.abs(a - targetUtcMs) - Math.abs(b - targetUtcMs))
    .slice(0, limit)
    .sort((a, b) => a - b)
    .map((value) => new Date(value).toISOString());
  return {
    targetUtc: Number.isFinite(targetUtcMs) ? new Date(targetUtcMs).toISOString() : "",
    dates,
    sampleCount: samples.length,
    uniqueDateCount: uniqueDates.length,
    firstDate: uniqueDates[0] ? new Date(uniqueDates[0]).toISOString() : "",
    lastDate: uniqueDates.at(-1) ? new Date(uniqueDates.at(-1)).toISOString() : "",
  };
}

(async () => {
  assert.ok(Number.isFinite(elapsedSeconds) && elapsedSeconds >= 0, "--elapsed must be a positive number");
  const startedAt = Date.now();
  let targetElapsedSeconds = elapsedSeconds;
  let targetArchiveSeconds = elapsedSeconds;
  let initialFetchMs = 0;
  let raceStartArchiveSeconds = null;
  if (raceRelative || initialLoad) {
    const initial = await loadSessionData(0);
    initialFetchMs = initial.fetchMs;
    raceStartArchiveSeconds = parser.f1TimingRaceStartArchiveSeconds(initial.sessionData);
    assert.ok(Number.isFinite(raceStartArchiveSeconds), "Probe should discover the race-start archive anchor");
    targetElapsedSeconds = initialLoad ? 0 : elapsedSeconds;
    targetArchiveSeconds = Math.max(0, raceStartArchiveSeconds - 5 + targetElapsedSeconds);
  }

  if (movementDurationSeconds > 0) {
    assert.ok(raceRelative, "Movement probe expects race-relative timing");
    const duration = Math.max(1, movementDurationSeconds);
    const staticLoad = await loadSessionData(targetArchiveSeconds);
    const lastPosition = lastEntrySeconds(staticLoad.sessionData.positionEntries);
    const relativeDuration = Math.max(duration + 1, Number(lastPosition || 0) - Math.max(0, raceStartArchiveSeconds - 5));
    const startRelative = hasOption("elapsed")
      ? elapsedSeconds
      : Math.max(60, Math.random() * Math.max(1, relativeDuration * 0.6 - duration - 60) + relativeDuration * 0.2);
    const endRelative = startRelative + duration;
    const startArchive = Math.max(0, raceStartArchiveSeconds - 5 + startRelative);
    const endArchive = Math.max(0, raceStartArchiveSeconds - 5 + endRelative);
    const movementLoadStartedAt = Date.now();
    const { fetchMs, sessionData } = await loadSessionData(endArchive);
    const startSnapshot = renderSnapshot(sessionData, startArchive, 0);
    const endSnapshot = renderSnapshot(sessionData, endArchive, duration / 16);
    const startNearby = nearbyPositionDates(sessionData, startArchive);
    const endNearby = nearbyPositionDates(sessionData, endArchive);
    const byCode = new Map(endSnapshot.rendered.map((row) => [row.code, row]));
    const endTimingByCode = new Map(endSnapshot.parsed.timing.map((row) => [row.code, row]));
    const movements = startSnapshot.rendered.map((row) => {
      const next = byCode.get(row.code);
      return next ? { code: row.code, distance: Math.hypot(next.render.x - row.render.x, next.render.y - row.render.y) } : null;
    }).filter(Boolean);
    const rawMovements = startSnapshot.parsed.timing.map((row) => {
      const next = endTimingByCode.get(row.code);
      if (!next?.trackPosition || !row.trackPosition) return null;
      const dx = Number(next.trackPosition.x) - Number(row.trackPosition.x);
      const dy = Number(next.trackPosition.y) - Number(row.trackPosition.y);
      return Number.isFinite(dx) && Number.isFinite(dy) ? { code: row.code, distance: Math.hypot(dx, dy) } : null;
    }).filter(Boolean);
    const startPositionDates = new Set(startSnapshot.parsed.timing.map((row) => row.trackPosition?.date).filter(Boolean));
    const endPositionDates = new Set(endSnapshot.parsed.timing.map((row) => row.trackPosition?.date).filter(Boolean));
    const movingRows = movements.filter((row) => row.distance > 2).length;
    const rawMovingRows = rawMovements.filter((row) => row.distance > 1).length;
    const avgMove = movements.reduce((sum, row) => sum + row.distance, 0) / Math.max(1, movements.length);
    const maxMove = Math.max(...movements.map((row) => row.distance));
    const avgRawMove = rawMovements.reduce((sum, row) => sum + row.distance, 0) / Math.max(1, rawMovements.length);
    const maxRawMove = Math.max(...rawMovements.map((row) => row.distance));
    const result = {
      source: "Formula 1 livetiming archive",
      baseUrl,
      movementProbe: true,
      raceRelative,
      startElapsedSeconds: Number(startRelative.toFixed(3)),
      endElapsedSeconds: Number(endRelative.toFixed(3)),
      durationSeconds: duration,
      startArchiveSeconds: Number(startArchive.toFixed(3)),
      endArchiveSeconds: Number(endArchive.toFixed(3)),
      startTargetUtc: startNearby.targetUtc,
      endTargetUtc: endNearby.targetUtc,
      nearbyStartPositionDates: startNearby.dates,
      nearbyEndPositionDates: endNearby.dates,
      positionSampleCount: startNearby.sampleCount,
      positionUniqueDateCount: startNearby.uniqueDateCount,
      firstPositionSampleDate: startNearby.firstDate,
      lastPositionSampleDate: startNearby.lastDate,
      firstPositionEntryKeys: Object.keys(sessionData.positionEntries[0]?.data || {}),
      firstPositionEntryDataType: Array.isArray(sessionData.positionEntries[0]?.data) ? "array" : typeof sessionData.positionEntries[0]?.data,
      raceStartArchiveSeconds,
      fetchMs,
      totalLoadMs: Date.now() - movementLoadStartedAt,
      startLap: startSnapshot.parsed.sessionClock?.lapCount?.lap ?? null,
      endLap: endSnapshot.parsed.sessionClock?.lapCount?.lap ?? null,
      startOfficialRows: startSnapshot.rendered.filter((row) => row.renderSource === "official").length,
      endOfficialRows: endSnapshot.rendered.filter((row) => row.renderSource === "official").length,
      startSnapshotFallbackRows: startSnapshot.rendered.filter((row) => row.renderSource === "track-fallback").length,
      endSnapshotFallbackRows: endSnapshot.rendered.filter((row) => row.renderSource === "track-fallback").length,
      startUniqueRenderPoints: uniqueRenderPointCount(startSnapshot.rendered),
      endUniqueRenderPoints: uniqueRenderPointCount(endSnapshot.rendered),
      matchedRows: movements.length,
      movingRows,
      rawMovingRows,
      startPositionDateSample: Array.from(startPositionDates).slice(0, 3),
      endPositionDateSample: Array.from(endPositionDates).slice(0, 3),
      avgMove: Number(avgMove.toFixed(2)),
      maxMove: Number(maxMove.toFixed(2)),
      avgRawMove: Number(avgRawMove.toFixed(2)),
      maxRawMove: Number(maxRawMove.toFixed(2)),
      sampleMovements: movements.slice(0, 8).map((row) => ({ code: row.code, distance: Number(row.distance.toFixed(2)) })),
      sampleRawMovements: rawMovements.slice(0, 8).map((row) => ({ code: row.code, distance: Number(row.distance.toFixed(2)) })),
      renderedSvg: outFile,
    };
    console.log(JSON.stringify(result, null, 2));
    assert.ok(result.totalLoadMs < 10000, `Movement probe should load in under 10s, got ${result.totalLoadMs}ms`);
    assert.ok(result.startOfficialRows + result.startSnapshotFallbackRows >= 20 && result.endOfficialRows + result.endSnapshotFallbackRows >= 20, "Movement probe should render at least 20 cars at both ends");
    assert.ok(result.startUniqueRenderPoints >= 10 && result.endUniqueRenderPoints >= 10, "Movement probe should not visually collapse cars");
    assert.ok(result.matchedRows >= 20, `Expected at least 20 matched cars, got ${result.matchedRows}`);
    assert.ok(result.movingRows >= 18, `Expected at least 18 cars to move over ${duration}s, got ${result.movingRows}`);
    assert.ok(result.avgMove > 4, `Expected average movement above 4px, got ${result.avgMove}`);
    assert.ok(result.maxMove > 10, `Expected max movement above 10px, got ${result.maxMove}`);
    return;
  }

  const { fetchMs, sessionData } = await loadSessionData(targetArchiveSeconds);
  const { parsed, rendered, maxRawDistance, avgRawDistance, maxRenderDistance } = renderSnapshot(sessionData, targetArchiveSeconds);
  const totalLoadMs = Date.now() - startedAt;
  const result = {
    source: "Formula 1 livetiming archive",
    baseUrl,
    initialLoad,
    raceRelative,
    requestedElapsedSeconds: elapsedSeconds,
    targetElapsedSeconds,
    targetArchiveSeconds,
    raceStartArchiveSeconds,
    startsSecondsBeforeRaceStart: Number.isFinite(raceStartArchiveSeconds) ? Number((raceStartArchiveSeconds - targetArchiveSeconds).toFixed(3)) : null,
    initialFetchMs,
    fetchMs,
    totalLoadMs,
    timingRows: parsed.timing.length,
    positionedRows: rendered.length,
    officialPositionedRows: rendered.filter((row) => row.renderSource === "official").length,
    fallbackTrackRows: rendered.filter((row) => row.renderSource === "track-fallback").length,
    uniqueRenderPoints: uniqueRenderPointCount(rendered),
    lap: parsed.sessionClock?.lapCount?.lap ?? null,
    laps: parsed.sessionClock?.lapCount?.laps ?? null,
    lapTimelineSample: parsed.lapTimeline.slice(0, 8),
    intervalRows: parsed.timing.filter((row) => row.interval && row.interval !== "—").length,
    compoundRows: parsed.timing.filter((row) => row.comp).length,
    lastLapRows: parsed.timing.filter((row) => row.last).length,
    sampleRows: parsed.timing.slice(0, 5).map((row) => ({ pos: row.pos, code: row.code, interval: row.interval, comp: row.comp, last: row.last })),
    positionEntries: sessionData.positionEntries.length,
    driverListEntries: sessionData.driverListEntries.length,
    firstDriverListSeconds: firstEntrySeconds(sessionData.driverListEntries),
    firstDriverListKeys: Object.keys(sessionData.driverListEntries[0]?.data || {}).slice(0, 5),
    firstTimingSeconds: firstEntrySeconds(sessionData.timingEntries),
    firstPositionSeconds: firstEntrySeconds(sessionData.positionEntries),
    lastPositionSeconds: lastEntrySeconds(sessionData.positionEntries),
    maxRawDistance: Number(maxRawDistance.toFixed(2)),
    avgRawDistance: Number(avgRawDistance.toFixed(2)),
    maxRenderDistance: Number(maxRenderDistance.toFixed(3)),
    renderedSvg: outFile,
  };
  console.log(JSON.stringify(result, null, 2));
  assert.ok(totalLoadMs < 10000, `Track Map replay probe should load in under 10s, got ${totalLoadMs}ms`);
  if (initialLoad) assert.equal(result.startsSecondsBeforeRaceStart, 5, "Initial replay load should start 5 seconds before race start");
  assert.ok(rendered.length >= 20, `Expected at least 20 rendered cars, got ${rendered.length}`);
  assert.ok(result.uniqueRenderPoints >= 10, `Rendered cars should not visually collapse, got ${result.uniqueRenderPoints} unique marker locations`);
  assert.ok(maxRawDistance < 180, `Official positions should project near the rendered track before snapping, max distance ${maxRawDistance}`);
  assert.ok(maxRenderDistance < 0.5, `Rendered positions should sit on the physical track, max distance ${maxRenderDistance}`);
  if (targetElapsedSeconds >= 60) {
    assert.ok(result.lap > 1, `Skipped-forward replay should have advanced race lap data, got lap ${result.lap}`);
    assert.ok(result.intervalRows >= 10, `Skipped-forward replay should have rich interval data, got ${result.intervalRows} rows`);
    assert.ok(result.compoundRows >= 10, `Skipped-forward replay should have tyre compound data, got ${result.compoundRows} rows`);
  }
})().catch((error) => {
  console.error(error.stack || error.message || String(error));
  process.exit(1);
});
