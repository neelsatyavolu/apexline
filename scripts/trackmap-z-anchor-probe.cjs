/* Offline z-anchoring probe: verifies the Track Map's fit + z-aware snapping
   against real Monaco GP 2026 race telemetry (results/monaco-2026-mock-location).
   Run: npm run probe:trackmap:z-anchor */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const trackMapSource = fs.readFileSync(path.join(root, "ui_kits/pitwall/TrackMap.jsx"), "utf8");

function extractNamedFunction(source, name) {
  const start = source.indexOf(`function ${name}`);
  if (start === -1) throw new Error(`${name} should exist in TrackMap.jsx`);
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

function extractConsts(source) {
  return [...source.matchAll(/const (TRACK_MAP_[A-Z_0-9]+) = ([^;]+);/g)]
    .map(([, name, value]) => `const ${name} = ${value};`).join("\n");
}

const helpers = vm.runInNewContext(`(() => {
  ${extractConsts(trackMapSource)}
  const trackSegmentCache = new WeakMap();
  ${["distanceToSegment", "nearestTrackPoint", "trackSegments", "nearestOnTrack", "applyOfficialFit", "fitOfficialSimilarity", "buildTrackZProfile"]
    .map((name) => extractNamedFunction(trackMapSource, name)).join("\n")}
  return { nearestTrackPoint, applyOfficialFit, fitOfficialSimilarity, buildTrackZProfile,
           SNAP_MAX: TRACK_MAP_SNAP_MAX_DIST_PX, Z_WEIGHT: TRACK_MAP_Z_WEIGHT,
           Z_CAP: TRACK_MAP_Z_PENALTY_MAX_PX };
})()`);

function loadMonacoCircuit() {
  const sandbox = { window: {} };
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(path.join(root, "ui_kits/pitwall/trackmap-circuits.js"), "utf8"), sandbox);
  return sandbox.window.PW_TRACKMAP_CIRCUITS.monaco;
}

function loadMock(file) {
  return JSON.parse(fs.readFileSync(path.join(root, "results/monaco-2026-mock-location", file), "utf8"));
}

function downsample(rows, maxPoints = 240) {
  const step = Math.max(1, Math.floor(rows.length / maxPoints));
  return rows.filter((_, index) => index % step === 0);
}

function percentile(values, q) {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * q))];
}

const result = { phases: {} };

// ---- Phase 0: synthetic unit check — z must steer the snap between two
// parallel legs that are planar-equidistant from the probe point.
{
  const legA = [[0, 0], [100, 0]];   // expected z 500 (tunnel-like)
  const legB = [[0, 30], [100, 30]]; // expected z 860 (climb-like)
  const pts = [...legA, ...legB.slice().reverse()]; // closed loop of 4 vertices
  const zAt = [500, 500, 860, 860];
  const probe = { x: 50, y: 15 }; // exactly between the legs
  const snapped = helpers.nearestTrackPoint(probe, pts, null, { z: 505, zAt, weight: 1 });
  assert.ok(Math.abs(snapped.y - 0) < 1, `z-aware snap should pick the z=500 leg, got y=${snapped.y}`);
  const snappedHigh = helpers.nearestTrackPoint(probe, pts, null, { z: 855, zAt, weight: 1 });
  assert.ok(Math.abs(snappedHigh.y - 30) < 1, `z-aware snap should pick the z=860 leg, got y=${snappedHigh.y}`);
  result.phases.synthetic = "pass";
}

const circuit = loadMonacoCircuit();
const run = loadMock("driver1-continuous-run.json");
const race = loadMock("race-window-6drivers.json");

// ---- Phase 1: similarity fit from a 240-point single-driver trace (mirrors
// f1TimingPositionSamplePoints in production: drop stationary stretches —
// grid/garage clusters bias the fit — then downsample to 240).
const moving = [];
for (const p of run.filter((point) => point.z > 0)) {
  const prev = moving[moving.length - 1];
  if (!prev || Math.hypot(p.x - prev.x, p.y - prev.y) > 80) moving.push(p);
}
const sample = downsample(moving);
const best = helpers.fitOfficialSimilarity(sample, circuit.points);
assert.ok(best && best.fit, "similarity fit should converge on Monaco mock trace");
assert.ok(best.score < 45, `fit score should be under TRACK_MAP_FIT_MAX_AVG_PX, got ${best.score.toFixed(1)}`);
result.phases.fit = { score: Number(best.score.toFixed(2)), scale: Number(best.fit.scale.toFixed(5)) };

// ---- Phase 2: z profile coverage + sanity.
const profile = helpers.buildTrackZProfile(sample, best.fit, circuit.points);
assert.ok(profile && !profile.conflict && Array.isArray(profile.zAt), "z profile should build without conflicts");
const covered = profile.zAt.filter(Number.isFinite).length;
assert.ok(covered === circuit.points.length, `gap-filling should cover every vertex, got ${covered}/${circuit.points.length}`);
const zMin = Math.min(...profile.zAt), zMax = Math.max(...profile.zAt);
assert.ok(zMin >= 450 && zMax <= 950, `profile z range should match Monaco telemetry (494-895), got ${zMin}-${zMax}`);
result.phases.profile = { vertices: circuit.points.length, zMin, zMax };

// ---- Phase 3: anchor every race-window point for all 6 drivers. The z term
// must never degrade planar anchoring by more than its cap — real Monaco data
// contains stale-z packets (lap 1, all drivers, z≈489 on the z≈701 climb)
// whose x/y are correct, and those must stay planar-anchored.
const zInfo = { zAt: profile.zAt, weight: helpers.Z_WEIGHT * best.fit.scale };
const planarDists = [];
let degraded = 0, staleZ = 0;
for (const p of race) {
  if (!(p.z > 0)) continue;
  const proj = helpers.applyOfficialFit(p, best.fit);
  const snapped = helpers.nearestTrackPoint(proj, circuit.points, null, { ...zInfo, z: p.z });
  const flat = helpers.nearestTrackPoint(proj, circuit.points, null, null);
  planarDists.push(snapped.d);
  if (snapped.d - flat.d > helpers.Z_CAP + 0.001) degraded += 1;
  let nearestVertex = 0, bd = Infinity;
  circuit.points.forEach((v, i) => {
    const d = Math.hypot(snapped.x - v[0], snapped.y - v[1]);
    if (d < bd) { bd = d; nearestVertex = i; }
  });
  if (Math.abs(profile.zAt[nearestVertex] - p.z) > 80) staleZ += 1; // 8 m: data anomaly, not a snap error
}
const p95 = percentile(planarDists, 0.95);
assert.ok(planarDists.length > 5000, `expected >5000 anchored race points, got ${planarDists.length}`);
assert.ok(p95 <= helpers.SNAP_MAX, `p95 planar snap distance ${p95.toFixed(1)}px should be <= ${helpers.SNAP_MAX}px`);
assert.equal(degraded, 0, `z term must never push a snap more than ${helpers.Z_CAP}px off the planar optimum, got ${degraded}`);
assert.ok(staleZ < planarDists.length * 0.01, `stale-z data anomalies should stay rare (<1%), got ${staleZ}`);
result.phases.anchoring = { points: planarDists.length, p95PlanarPx: Number(p95.toFixed(2)), degraded, staleZDataAnomalies: staleZ };

// ---- Phase 4: tunnel/Casino disambiguation — perturb low-z points toward the
// high branch; the z-aware snap must hold the low branch while 2D-only fails
// for at least some (proving the scenario bites).
const vertexPairs = [];
circuit.points.forEach((a, i) => circuit.points.forEach((b, j) => {
  if (j > i && Math.hypot(a[0] - b[0], a[1] - b[1]) < 40 && Math.abs(profile.zAt[i] - profile.zAt[j]) > 200) {
    vertexPairs.push([i, j]);
  }
}));
assert.ok(vertexPairs.length > 0, "Monaco should expose tunnel/climb vertex pairs <40px apart with >20m z gap");
let held = 0, total = 0, twoDWrong = 0;
for (const [i, j] of vertexPairs) {
  const low = profile.zAt[i] < profile.zAt[j] ? i : j;
  const high = low === i ? j : i;
  const lv = circuit.points[low], hv = circuit.points[high];
  for (const f of [0.35, 0.5, 0.6]) {
    const probe = { x: lv[0] + (hv[0] - lv[0]) * f, y: lv[1] + (hv[1] - lv[1]) * f };
    const zAware = helpers.nearestTrackPoint(probe, circuit.points, null, { ...zInfo, z: profile.zAt[low] });
    const flat = helpers.nearestTrackPoint(probe, circuit.points, null, null);
    const dLow = Math.hypot(zAware.x - lv[0], zAware.y - lv[1]);
    const dHigh = Math.hypot(zAware.x - hv[0], zAware.y - hv[1]);
    total += 1;
    if (dLow < dHigh) held += 1;
    const fLow = Math.hypot(flat.x - lv[0], flat.y - lv[1]);
    const fHigh = Math.hypot(flat.x - hv[0], flat.y - hv[1]);
    if (fHigh < fLow) twoDWrong += 1;
  }
}
assert.equal(held, total, `z-aware snap must hold the correct branch for all perturbed points (${held}/${total})`);
assert.ok(twoDWrong > 0, "2D-only snap should fail at least once on perturbed points (otherwise the test proves nothing)");
result.phases.disambiguation = { vertexPairs: vertexPairs.length, perturbed: total, zAwareHeld: held, flat2dWrong: twoDWrong };

// ---- Phase 5: garbage packets must not reach the projector.
{
  const sourceHasGuard = /x === 0 && point\.y === 0|tp\.x === 0 && tp\.y === 0/.test(trackMapSource);
  assert.ok(sourceHasGuard, "TrackMap.jsx should reject (0,0) zero-z packets before projection");
  result.phases.garbageGuard = "pass";
}

console.log(JSON.stringify(result, null, 2));
console.log("trackmap z-anchor probe: ALL PASS");
