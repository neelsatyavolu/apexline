/* Real-data Track Map motion probe. Streams an official Position.z archive
   through the shipped Track Map pipeline — main-process trails, the renderer's
   position buffer, packet-timing correction, smoothing, per-car governor, map
   fit and live render clock — at 60 fps, for replay (1 Hz trail polls) and live
   (jittered message arrival, 500 ms polls), and scores the on-screen motion:
   frame jumps, physically impossible speed changes, off-road share, hidden cars.
   Run: npm run probe:trackmap:motion [-- --base=<archive session url> --circuit=canada --start=70 --seconds=90]
   Set TRACKMAP_PROBE_CACHE=<dir> to reuse downloads (the archive rate-limits). */
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
})()`, { WeakMap, Map, Set, Number, Date, Object, Array, Math });

let simNow = 0;
const renderer = vm.runInNewContext(`(() => {
  ${[...trackMapSource.matchAll(/const (TRACK_MAP_[A-Z_0-9]+) = ([^;]+);/g)].map(([, n, v]) => `const ${n} = ${v};`).join("\n")}
  const officialFitCache = new Map();
  const trackSegmentCache = new WeakMap();
  ${["distanceToSegment", "nearestTrackPoint", "trackSegments", "nearestOnTrack", "applyOfficialFit", "buildTrackZProfile",
    "fitOfficialSimilarity", "officialPositionProjector", "createTrackPositionBuffer", "correctPacketTiming",
    "smoothTrackPosition", "advanceTrackCar", "createLiveTrackClock"].map((name) => extractNamedFunction(trackMapSource, name)).join("\n")}
  return { nearestTrackPoint, officialPositionProjector, createTrackPositionBuffer, advanceTrackCar, createLiveTrackClock,
    KEEP: TRACK_MAP_TRAIL_KEEP_MS, LIVE_POLL: TRACK_MAP_LIVE_POLL_MS };
})()`, { Map, WeakMap, Set, Math, Number, Date, Object, Array, Infinity, NaN, Boolean, String, Float64Array });

function requestText(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { "User-Agent": "BestHTTP", "Accept-Encoding": "identity" }, timeout: 60000 }, (res) => {
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

function score(label, positionsByCar, project, circuit, frameMs) {
  const pxPerM = Math.hypot(project({ x: 10, y: 0 }).x - project({ x: 0, y: 0 }).x, project({ x: 10, y: 0 }).y - project({ x: 0, y: 0 }).y);
  let windows = 0, unphysical = 0, jumps = 0, offRoad = 0, moving = 0, hidden = 0, total = 0;
  for (const pos of positionsByCar.values()) {
    const speed = [];
    for (let f = 0; f < pos.length; f += 1) {
      total += 1;
      if (!pos[f]) { hidden += 1; speed.push(null); continue; }
      if (f === 0 || !pos[f - 1]) { speed.push(null); continue; }
      const stepM = Math.hypot(pos[f].x - pos[f - 1].x, pos[f].y - pos[f - 1].y) / pxPerM;
      if (stepM > 3) jumps += 1; // 180 m/s at 60 fps
      speed.push(stepM / (frameMs / 1000));
      if (stepM / (frameMs / 1000) > 5) {
        moving += 1;
        if (renderer.nearestTrackPoint(pos[f], circuit.points).d > 7.5) offRoad += 1;
      }
    }
    // Speed change over 250 ms: real cars stay within ~15 m/s (braking ~6g).
    for (let f = 15; f < speed.length; f += 15) {
      if (speed[f] == null || speed[f - 15] == null || Math.max(speed[f], speed[f - 15]) < 5) continue;
      windows += 1;
      if (Math.abs(speed[f] - speed[f - 15]) > 15) unphysical += 1;
    }
  }
  return { label, frameJumps: jumps, unphysicalPct: +(100 * unphysical / Math.max(1, windows)).toFixed(2),
    offRoadPct: +(100 * offRoad / Math.max(1, moving)).toFixed(2), hiddenPct: +(100 * hidden / Math.max(1, total)).toFixed(2) };
}

(async () => {
  const base = option("base", "https://livetiming.formula1.com/static/2026/2026-05-24_Canadian_Grand_Prix/2026-05-24_Race/");
  const circuitId = option("circuit", "canada");
  const startOffsetSeconds = Number(option("start", "70")) * 60;
  const seconds = Number(option("seconds", "90"));
  const cacheDir = process.env.TRACKMAP_PROBE_CACHE;
  const cacheFile = cacheDir && path.join(cacheDir, `${base.replace(/[^a-z0-9]+/gi, "_")}Position.z`);
  const text = cacheFile && fs.existsSync(cacheFile) ? fs.readFileSync(cacheFile, "utf8") : await requestText(`${base}Position.z.jsonStream`);
  if (cacheFile && !fs.existsSync(cacheFile)) fs.writeFileSync(cacheFile, text);
  const entries = text.split(/\r?\n/).filter(Boolean).map((line) => {
    const raw = JSON.parse(line.replace(/^﻿/, "").slice(12));
    return { seconds: 0, data: JSON.parse(zlib.inflateRawSync(Buffer.from(raw, "base64")).toString()) };
  });
  const sessionData = { positionEntries: entries };
  const { samples } = main.f1TimingPositionSamples(sessionData);
  assert.ok(samples.length > 1000, "probe needs real position samples");
  const circuit = loadCircuit(circuitId);
  const project = renderer.officialPositionProjector([], { vb: circuitId, points: circuit.points }, null, main.f1TimingPositionSamplePoints(sessionData));
  assert.ok(project, "official positions should fit the circuit outline");
  const startUtc = samples[0].utcMs + startOffsetSeconds * 1000;
  const numbers = [...new Set(samples.filter((s) => Math.abs(s.utcMs - startUtc) < 30000).map((s) => s.driverNumber))];
  const frameMs = 1000 / 60, frames = Math.round(seconds * 60);
  const governed = (buffer, t, states) => (number) => {
    const next = t == null ? null : renderer.advanceTrackCar(buffer, number, t, states.get(number));
    if (next) states.set(number, next); else states.delete(number);
    return next ? project(next.p) : null;
  };

  // Replay: 1 Hz polls with 150 ms IPC latency for [-2 s, +5 s] trail windows.
  const replay = (() => {
    const buffer = renderer.createTrackPositionBuffer();
    const pending = [], states = new Map();
    const pos = new Map(numbers.map((n) => [n, []]));
    for (let f = 0, nextPoll = 0; f < frames; f += 1) {
      const now = f * frameMs;
      while (now >= nextPoll) {
        const at = nextPoll, originUtc = startUtc + at;
        const drivers = main.f1TimingPositionTrail(sessionData, originUtc - 2000, originUtc + 5000);
        pending.push({ at: at + 150, apply: () => buffer.merge(drivers, (utc) => at + (utc - originUtc), at + 150 - renderer.KEEP, at + 150) });
        nextPoll += 1000;
      }
      while (pending.length && pending[0].at <= now) pending.shift().apply();
      const place = governed(buffer, now, states);
      numbers.forEach((n) => pos.get(n).push(place(n)));
    }
    return score("replay", pos, project, circuit, frameMs);
  })();

  // Live: messages arrive 0.3-1.3 s after their newest sample, polled every 500 ms.
  const live = (() => {
    const buffer = renderer.createTrackPositionBuffer();
    const clock = renderer.createLiveTrackClock(() => simNow);
    const arrivals = entries.map((entry, i) => {
      let newest = -Infinity;
      for (const p of entry.data.Position || []) newest = Math.max(newest, Date.parse(p.Timestamp));
      return { i, at: newest + 300 + ((i * 7919) % 1000) };
    }).filter((a) => Number.isFinite(a.at) && a.at > startUtc - 20000 && a.at < startUtc + seconds * 1000 + 5000);
    let since = null;
    const states = new Map();
    const pos = new Map(numbers.map((n) => [n, []]));
    for (let f = 0, nextPoll = 0; f < frames; f += 1) {
      simNow = f * frameMs;
      while (simNow >= nextPoll) {
        const received = arrivals.filter((a) => a.at <= startUtc + nextPoll).map((a) => entries[a.i]);
        if (received.length) {
          const tail = { positionEntries: received.slice(-40) };
          const latest = main.f1TimingPositionSamples(tail).samples.at(-1).utcMs;
          const drivers = main.f1TimingPositionTrail(tail, since == null ? latest - 20000 : since + 1, latest);
          if (latest !== since) clock.observe(latest);
          since = latest;
          const renderMs = clock.nowMs();
          buffer.merge(drivers, (u) => u, (renderMs ?? latest) - renderer.KEEP, renderMs);
        }
        nextPoll += renderer.LIVE_POLL;
      }
      const place = governed(buffer, clock.nowMs(), states);
      numbers.forEach((n) => pos.get(n).push(place(n)));
    }
    return score("live", pos, project, circuit, frameMs);
  })();

  console.log(JSON.stringify({ circuit: circuitId, startMinutes: startOffsetSeconds / 60, seconds, cars: numbers.length, replay, live }, null, 2));
  for (const r of [replay, live]) {
    assert.equal(r.frameJumps, 0, `${r.label}: cars should never jump (a frame step over 3m)`);
    assert.ok(r.unphysicalPct < 1, `${r.label}: speed should change like a real car's (${r.unphysicalPct}% impossible)`);
  }
  console.log("Track Map motion probe passed");
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
