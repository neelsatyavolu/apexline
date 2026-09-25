/* Real-data Track Map motion probe: streams official Position.z samples through
   the main-process trail helpers and the renderer's position buffer, live clock,
   fit and snapping exactly as the app does, at 60 fps, and reports how smoothly
   the cars move (implied speed per frame, backward steps, teleports).
   Run: npm run probe:trackmap:motion [-- --base=<archive session url> --start=1200 --seconds=90] */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const https = require("node:https");
const path = require("node:path");
const vm = require("node:vm");
const zlib = require("node:zlib");

const root = path.resolve(__dirname, "..");
const mainProcess = fs.readFileSync(path.join(root, "electron/main.cjs"), "utf8");
const trackMapSource = fs.readFileSync(path.join(root, "ui_kits/pitwall/TrackMap.jsx"), "utf8");

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

function option(name, fallback) {
  const found = process.argv.slice(2).find((arg) => arg.startsWith(`--${name}=`));
  return found ? found.slice(name.length + 3) : fallback;
}

const main = vm.runInNewContext(`(() => {
  const f1TimingPositionSampleCache = new WeakMap();
  ${["finiteNumber", "f1TimingPositionSamples", "f1TimingPositionTrail", "f1TimingPositionSamplePoints"]
    .map((name) => extractNamedFunction(mainProcess, name)).join("\n")}
  return { f1TimingPositionSamples, f1TimingPositionTrail, f1TimingPositionSamplePoints };
})()`);

let simNow = 0;
const renderer = vm.runInNewContext(`(() => {
  ${[...trackMapSource.matchAll(/const (TRACK_MAP_[A-Z_0-9]+) = ([^;]+);/g)].map(([, n, v]) => `const ${n} = ${v};`).join("\n")}
  ${["distanceToSegment", "nearestTrackPoint", "applyOfficialFit", "buildTrackZProfile", "fitOfficialSimilarity",
    "officialPositionProjector", "createTrackPositionBuffer", "createLiveTrackClock"]
    .map((name) => extractNamedFunction(trackMapSource, name)).join("\n")}
  const officialFitCache = new Map();
  return { nearestTrackPoint, officialPositionProjector, createTrackPositionBuffer, createLiveTrackClock,
    C: { TAU: TRACK_MAP_MOTION_TAU_MS, OFF_LINE_TAU: TRACK_MAP_OFF_LINE_TAU_MS, OFF_LINE_PX: TRACK_MAP_OFF_LINE_PX, TELEPORT: TRACK_MAP_OFFICIAL_TELEPORT_PX, SNAP: TRACK_MAP_SNAP_MAX_DIST_PX,
      PIT_SNAP: TRACK_MAP_PIT_SNAP_MAX_DIST_PX, RESNAP: TRACK_MAP_RESNAP_WINDOW_PX, KEEP: TRACK_MAP_TRAIL_KEEP_MS,
      LIVE_POLL: TRACK_MAP_LIVE_POLL_MS } };
})()`, { Map, WeakMap, Set, Math, Number, Date, Object, Array, Infinity, NaN, Boolean, String });

function requestText(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { "User-Agent": "BestHTTP", "Accept-Encoding": "identity" }, timeout: 30000 }, (res) => {
      if (res.statusCode !== 200) { res.resume(); reject(new Error(`HTTP ${res.statusCode}`)); return; }
      let text = "";
      res.setEncoding("utf8");
      res.on("data", (chunk) => { text += chunk; });
      res.on("end", () => resolve(text));
    }).on("error", reject);
  });
}

function loadCircuit(id) {
  const sandbox = { window: {} };
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(path.join(root, "ui_kits/pitwall/trackmap-circuits.js"), "utf8"), sandbox);
  return sandbox.window.PW_TRACKMAP_CIRCUITS[id];
}

function simulate({ label, trackPts, projector, frames, clockAt, pollEvery, onPoll, buffer }) {
  const { C } = renderer;
  let total = 0;
  for (let i = 0; i < trackPts.length; i += 1) {
    const a = trackPts[i], b = trackPts[(i + 1) % trackPts.length];
    total += Math.hypot(b[0] - a[0], b[1] - a[1]);
  }
  const wrapMod = (s) => ((s % total) + total) % total;
  const wrapDelta = (d) => {
    const m = wrapMod(projector.reversed ? -d : d);
    const forward = m > total * 0.85 ? m - total : m;
    return projector.reversed ? -forward : forward;
  };
  const motion = new Map();
  const snapCache = new WeakMap();
  // Mirrors TrackMapView's snapPoint/snapSample.
  const snapSample = (p, hintS) => {
    if (snapCache.has(p)) return snapCache.get(p);
    let result = null;
    if (!(p.x === 0 && p.y === 0 && !(p.z > 0))) {
      const hint = hintS != null ? { s: hintS, total, window: C.RESNAP } : null;
      const zInfo = projector.zInfo && p.z > 0 ? { zAt: projector.zInfo.zAt, weight: projector.zInfo.weight, z: p.z } : null;
      const snap = renderer.nearestTrackPoint(projector(p), trackPts, hint, zInfo);
      result = snap && snap.d <= (hint ? C.PIT_SNAP : C.SNAP) ? snap : null;
    }
    snapCache.set(p, result);
    return result;
  };
  const steps = [];
  let backward = 0, teleports = 0, maxAccelPxPerFrame2 = 0, positionedFrames = 0, carFrames = 0;
  const frameMs = 1000 / 60;
  let nextPollAt = 0;
  for (let frame = 0; frame < frames; frame += 1) {
    const now = frame * frameMs;
    simNow = now;
    while (now >= nextPollAt) { onPoll(nextPollAt); nextPollAt += pollEvery; }
    const t = clockAt(now);
    buffer.drivers().forEach((number) => {
      carFrames += 1;
      let m = motion.get(number);
      const hintS = m?.official ? wrapMod(m.targetS) : null;
      const bracket = t == null ? null : buffer.bracketAt(number, t);
      const snapA = bracket ? snapSample(bracket.a, hintS) : null;
      const snapB = snapA && bracket.b ? snapSample(bracket.b, snapA.s) : null;
      const official = snapB ? { s: snapA.s + wrapDelta(snapB.s - snapA.s) * bracket.k, d: Math.max(snapA.d, snapB.d) } : snapA;
      if (!m) {
        if (!official) return;
        m = { s: official.s, targetS: official.s, official: true, lastStep: null };
        motion.set(number, m);
      }
      if (official) {
        positionedFrames += 1;
        const dTarget = wrapDelta(official.s - wrapMod(m.targetS));
        m.targetS += dTarget;
        if (Math.abs(dTarget) > C.TELEPORT) { m.s = m.targetS; teleports += 1; m.lastStep = null; return; }
        m.offLine = official.d > C.OFF_LINE_PX;
      }
      const before = m.s;
      const tauTarget = m.offLine ? C.OFF_LINE_TAU : C.TAU;
      m.tau = m.tau == null ? tauTarget : m.tau + (tauTarget - m.tau) * (1 - Math.exp(-frameMs / C.OFF_LINE_TAU));
      m.s += (m.targetS - m.s) * (1 - Math.exp(-frameMs / m.tau));
      const step = m.s - before;
      if ((projector.reversed ? -step : step) < -1) backward += 1;
      if (m.lastStep != null) maxAccelPxPerFrame2 = Math.max(maxAccelPxPerFrame2, Math.abs(step - m.lastStep));
      m.lastStep = step;
      steps.push(Math.abs(step));
    });
  }
  steps.sort((a, b) => a - b);
  const pct = (p) => steps[Math.min(steps.length - 1, Math.floor(steps.length * p))] || 0;
  return { label, total, frames, carFrames, positionedShare: carFrames ? positionedFrames / carFrames : 0,
    p50: pct(0.5), p99: pct(0.99), max: steps.at(-1) || 0, backward, teleports, maxAccelPxPerFrame2 };
}

function withDriverList(buffer, numbers) {
  return { bracketAt: (number, t) => buffer.bracketAt(number, t), drivers: () => numbers };
}

(async () => {
  const base = option("base", "https://livetiming.formula1.com/static/2026/2026-06-07_Monaco_Grand_Prix/2026-06-07_Race/");
  const circuitId = option("circuit", "monaco");
  const startOffsetSeconds = Number(option("start", "1200"));
  const seconds = Number(option("seconds", "90"));
  // Optional TRACKMAP_PROBE_CACHE dir avoids re-downloading (the archive rate-limits).
  const cacheDir = process.env.TRACKMAP_PROBE_CACHE;
  const cacheFile = cacheDir && path.join(cacheDir, `${base.replace(/[^a-z0-9]+/gi, "_")}Position.z`);
  const text = cacheFile && fs.existsSync(cacheFile)
    ? fs.readFileSync(cacheFile, "utf8")
    : await requestText(`${base}Position.z.jsonStream`);
  if (cacheFile && !fs.existsSync(cacheFile)) fs.writeFileSync(cacheFile, text);
  const entries = text.split(/\r?\n/).filter(Boolean).map((line) => {
    const clean = line.replace(/^﻿/, "");
    const raw = JSON.parse(clean.slice(12));
    return { seconds: 0, data: JSON.parse(zlib.inflateRawSync(Buffer.from(raw, "base64")).toString()) };
  });
  const sessionData = { positionEntries: entries };
  const { samples } = main.f1TimingPositionSamples(sessionData);
  assert.ok(samples.length > 1000, "probe needs real position samples");
  const trace = main.f1TimingPositionSamplePoints(sessionData);
  const circuit = loadCircuit(circuitId);
  const geom = { vb: circuitId, points: circuit.points };
  const projector = renderer.officialPositionProjector([], geom, null, trace);
  assert.ok(projector, "official positions should fit the circuit outline");
  const startUtc = samples[0].utcMs + startOffsetSeconds * 1000;
  const numbers = [...new Set(samples.filter((s) => Math.abs(s.utcMs - startUtc) < 5000).map((s) => s.driverNumber))];
  const frames = Math.round(seconds * 60);

  // Replay: 1 Hz polls (150 ms IPC latency) for a [-2 s, +5 s] trail window,
  // rendered at the precise playhead.
  const replayBuffer = renderer.createTrackPositionBuffer();
  const replayPending = [];
  const replay = simulate({
    label: "replay", trackPts: circuit.points, projector, frames, pollEvery: 1000,
    buffer: withDriverList(replayBuffer, numbers),
    clockAt: (now) => {
      while (replayPending.length && replayPending[0].at <= now) replayPending.shift().apply();
      return now;
    },
    onPoll: (at) => {
      const originUtc = startUtc + at;
      const drivers = main.f1TimingPositionTrail(sessionData, originUtc - 2000, originUtc + 5000);
      replayPending.push({ at: at + 150, apply: () => replayBuffer.merge(drivers, (utc) => at + (utc - originUtc), at - renderer.C.KEEP) });
    },
  });

  // Live: each archive message arrives 0.3-0.8 s after its newest sample
  // polled every 500 ms. The local clock (sim ms) shares no epoch with the feed.
  const liveBuffer = renderer.createTrackPositionBuffer();
  const liveClock = renderer.createLiveTrackClock(() => simNow);
  const arrivals = entries.map((entry, index) => {
    const utcs = (entry.data.Position || []).map((p) => Date.parse(p.Timestamp)).filter(Number.isFinite);
    return { index, arriveUtc: Math.max(...utcs) + 300 + ((index * 7919) % 500) };
  }).filter((a) => Number.isFinite(a.arriveUtc) && a.arriveUtc >= startUtc - 20000 && a.arriveUtc <= startUtc + seconds * 1000 + 5000);
  let since = null;
  const live = simulate({
    label: "live", trackPts: circuit.points, projector, frames, pollEvery: renderer.C.LIVE_POLL,
    buffer: withDriverList(liveBuffer, numbers),
    clockAt: () => liveClock.nowMs(),
    onPoll: (at) => {
      const feedNow = startUtc + at;
      const received = arrivals.filter((a) => a.arriveUtc <= feedNow).map((a) => entries[a.index]);
      if (!received.length) return;
      const tail = { positionEntries: received.slice(-40) };
      const tailSamples = main.f1TimingPositionSamples(tail).samples;
      const latestUtcMs = tailSamples.at(-1).utcMs;
      const drivers = main.f1TimingPositionTrail(tail, since == null ? latestUtcMs - 20000 : since + 1, latestUtcMs);
      if (latestUtcMs !== since) liveClock.observe(latestUtcMs);
      since = latestUtcMs;
      liveBuffer.merge(drivers, (utc) => utc, (liveClock.nowMs() ?? latestUtcMs) - renderer.C.KEEP);
    },
  });
  const report = [replay, live].map((r) => ({
    ...r,
    p50: +r.p50.toFixed(3), p99: +r.p99.toFixed(3), max: +r.max.toFixed(3),
    maxAccelPxPerFrame2: +r.maxAccelPxPerFrame2.toFixed(3), positionedShare: +r.positionedShare.toFixed(3),
  }));
  console.log(JSON.stringify({ circuit: circuitId, cars: numbers.length, report }, null, 2));
  for (const r of report) {
    assert.ok(r.positionedShare > 0.9, `${r.label}: cars should hold official positions (${r.positionedShare})`);
    assert.equal(r.teleports, 0, `${r.label}: steady playback should never teleport cars`);
    assert.ok(r.backward <= r.carFrames * 0.002, `${r.label}: cars should not slide backwards (${r.backward})`);
    assert.ok(r.maxAccelPxPerFrame2 < 1.5, `${r.label}: car speed should change smoothly frame to frame (${r.maxAccelPxPerFrame2}px/frame²)`);
  }
  console.log("Track Map motion probe passed");
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
