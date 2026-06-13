# Track Map z-Anchoring Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Use the `z` coordinate from F1 position telemetry to anchor track-map dots to the correct road section (e.g. Monaco tunnel vs the Casino climb directly above it), validate map fits, and reject garbage packets — verified offline against Monaco GP 2026 race data via terminal probes.

**Architecture:** `electron/main.cjs` already plumbs `z` into `trackPosition` and replay sample rows but strips it from `trackPositionSample` points (one-line fix). All rendering logic lives in `ui_kits/pitwall/TrackMap.jsx`: a new `buildTrackZProfile` learns expected elevation per circuit-polyline vertex from fitted sample points (z is invariant to the unknown session rotation, so the profile both disambiguates snapping and cross-checks the similarity fit); `nearestTrackPoint` gains an optional z cost term. Verification is a new offline Node probe (`vm`-extracts the real functions from TrackMap.jsx, same pattern as `scripts/trackmap-replay-render-probe.cjs`) running against `results/monaco-2026-mock-location/`, plus the existing networked render probe as regression.

**Tech Stack:** Plain JS (IIFE UI kit, no bundler imports), Node `vm` + `assert` probe scripts, npm scripts.

**Data facts (from docs/trackmap-z-accuracy-plan.md):** official coords are 0.1 m units; Monaco valid z = 494–895; `z<=0` means dropout; per-spot z spread across laps is ≤1.7 m (p90); tunnel (z≈531) and Casino climb (z≈860) are 40–45 m apart planar.

---

### Task 1: Keep `z` on replay sample points (electron/main.cjs)

**Files:**
- Modify: `electron/main.cjs:4138` (inside `f1TimingPositionSamplePoints`)

- [ ] **Step 1: Edit the sample-point emitter**

Replace (line ~4138):
```js
    points.push({ x: row.x, y: row.y });
```
with:
```js
    points.push({ x: row.x, y: row.y, z: finiteNumber(row.z) });
```
(`finiteNumber` is already in scope in main.cjs; `row.z` exists — see line 4022.)

- [ ] **Step 2: Verify shape via terminal**

Run: `node -e "const s=require('fs').readFileSync('electron/main.cjs','utf8'); const m=s.match(/points\.push\(\{ x: row\.x, y: row\.y, z: finiteNumber\(row\.z\) \}\);/); console.log(m? 'OK':'MISSING')"`
Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git add electron/main.cjs
git commit -m "feat: include z in track map replay sample points"
```

---

### Task 2: Write the failing z-anchor probe (terminal test, RED)

**Files:**
- Create: `scripts/trackmap-z-anchor-probe.cjs`
- Modify: `package.json` (add script `probe:trackmap:z-anchor`)

The probe extracts the REAL functions out of `ui_kits/pitwall/TrackMap.jsx` with the same `extractNamedFunction` technique as `scripts/trackmap-replay-render-probe.cjs:11`, loads the Monaco circuit polyline from `ui_kits/pitwall/trackmap-circuits.js` in a vm sandbox, and runs 5 phases against the checked-in mock data. No network.

- [ ] **Step 1: Create `scripts/trackmap-z-anchor-probe.cjs`**

```js
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
  ${["distanceToSegment", "nearestTrackPoint", "applyOfficialFit", "fitOfficialSimilarity", "buildTrackZProfile"]
    .map((name) => extractNamedFunction(trackMapSource, name)).join("\n")}
  return { nearestTrackPoint, applyOfficialFit, fitOfficialSimilarity, buildTrackZProfile,
           SNAP_MAX: TRACK_MAP_SNAP_MAX_DIST_PX, Z_WEIGHT: TRACK_MAP_Z_WEIGHT };
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
  const pts = [...legA, ...legB.slice().reverse()]; // closed-ish loop of 4 vertices
  const zAt = [500, 500, 860, 860];
  const probe = { x: 50, y: 15 }; // exactly between the legs
  const zInfo = { z: 505, zAt, weight: 1 };
  const snapped = helpers.nearestTrackPoint(probe, pts, null, zInfo);
  assert.ok(Math.abs(snapped.y - 0) < 1, `z-aware snap should pick the z=500 leg, got y=${snapped.y}`);
  const snappedHigh = helpers.nearestTrackPoint(probe, pts, null, { z: 855, zAt, weight: 1 });
  assert.ok(Math.abs(snappedHigh.y - 30) < 1, `z-aware snap should pick the z=860 leg, got y=${snappedHigh.y}`);
  result.phases.synthetic = "pass";
}

const circuit = loadMonacoCircuit();
const run = loadMock("driver1-continuous-run.json");
const race = loadMock("race-window-6drivers.json");

// ---- Phase 1: similarity fit from a 240-point single-driver trace (mirrors
// f1TimingPositionSamplePoints downsampling in production).
const sample = downsample(run.filter((p) => p.z > 0));
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

// ---- Phase 3: anchor every race-window point for all 6 drivers.
const zInfo = { zAt: profile.zAt, weight: helpers.Z_WEIGHT * best.fit.scale };
const planarDists = [];
let zViolations = 0;
for (const p of race) {
  if (!(p.z > 0)) continue;
  const proj = helpers.applyOfficialFit(p, best.fit);
  const snapped = helpers.nearestTrackPoint(proj, circuit.points, null, { ...zInfo, z: p.z });
  planarDists.push(snapped.d);
  // expected z at the snapped vertex neighbourhood
  let nearestVertex = 0, bd = Infinity;
  circuit.points.forEach((v, i) => {
    const d = Math.hypot(snapped.x - v[0], snapped.y - v[1]);
    if (d < bd) { bd = d; nearestVertex = i; }
  });
  if (Math.abs(profile.zAt[nearestVertex] - p.z) > 80) zViolations += 1; // 8 m
}
const p95 = percentile(planarDists, 0.95);
assert.ok(planarDists.length > 5000, `expected >5000 anchored race points, got ${planarDists.length}`);
assert.ok(p95 <= helpers.SNAP_MAX, `p95 planar snap distance ${p95.toFixed(1)}px should be <= ${helpers.SNAP_MAX}px`);
assert.equal(zViolations, 0, `no snap may land on a section >8m away in elevation, got ${zViolations}`);
result.phases.anchoring = { points: planarDists.length, p95PlanarPx: Number(p95.toFixed(2)), zViolations };

// ---- Phase 4: tunnel/Casino disambiguation — perturb low-z points toward the
// high branch; the z-aware snap must hold the low branch while 2D-only fails
// for at least some (proving the scenario bites).
let vertexPairs = [];
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
  const garbage = [{ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: -1 }];
  const sourceHasGuard = /x === 0 && point\.y === 0|tp\.x === 0 && tp\.y === 0/.test(trackMapSource);
  assert.ok(sourceHasGuard, "TrackMap.jsx should reject (0,0) zero-z packets before projection");
  result.phases.garbageGuard = "pass";
  void garbage;
}

console.log(JSON.stringify(result, null, 2));
console.log("trackmap z-anchor probe: ALL PASS");
```

- [ ] **Step 2: Add the npm script**

In `package.json` scripts, after `"probe:trackmap:monaco-race"`:
```json
"probe:trackmap:z-anchor": "node scripts/trackmap-z-anchor-probe.cjs",
```

- [ ] **Step 3: Run the probe — expect FAIL (RED)**

Run: `npm run probe:trackmap:z-anchor`
Expected: throws `buildTrackZProfile should exist in TrackMap.jsx` (function not yet written).

- [ ] **Step 4: Commit the failing probe**

```bash
git add scripts/trackmap-z-anchor-probe.cjs package.json
git commit -m "test: add offline z-anchor probe for track map (red)"
```

---

### Task 3: z-aware snapping + z profile in TrackMap.jsx

**Files:**
- Modify: `ui_kits/pitwall/TrackMap.jsx:26-27` (constants), `:229-247` (`nearestTrackPoint`), after `:267` (`applyOfficialFit`) add `buildTrackZProfile`

- [ ] **Step 1: Add constants** (after line 27, `TRACK_MAP_RESNAP_WINDOW_PX`)

```js
  const TRACK_MAP_Z_WEIGHT = 2;             // snap-cost px per projected px of elevation mismatch
  const TRACK_MAP_Z_MIN_SAMPLES = 24;       // sample points with usable z before a profile is trusted
  const TRACK_MAP_Z_MIN_COVERAGE = 0.5;     // fraction of vertices that must learn a z directly
  const TRACK_MAP_Z_CONFLICT_SPREAD = 60;   // official z units (6m): per-vertex spread marking a conflict
  const TRACK_MAP_Z_CONFLICT_MAX_FRACTION = 0.15; // conflicted-vertex share that invalidates the map fit
```

- [ ] **Step 2: Extend `nearestTrackPoint` with an optional z cost** (lines 229–247)

Replace the whole function with:
```js
  function nearestTrackPoint(p, pts, hint = null, zInfo = null) {
    let best = null, bestNear = null, len = 0;
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i], b = pts[(i + 1) % pts.length];
      const segLen = Math.hypot(b[0] - a[0], b[1] - a[1]);
      const hit = distanceToSegment(p, a, b);
      const s = len + hit.t * segLen;
      // Planar distance plus an elevation-mismatch penalty: telemetry z is
      // invariant to the session's unknown rotation, so where two track legs
      // overlap in x/y but not in height (Monaco tunnel under the Casino
      // climb) the penalty keeps the car on the leg it is physically on.
      let cost = hit.d;
      if (zInfo) {
        const za = zInfo.zAt[i], zb = zInfo.zAt[(i + 1) % pts.length];
        const zExp = Number.isFinite(za) && Number.isFinite(zb)
          ? za + (zb - za) * hit.t
          : (Number.isFinite(za) ? za : zb);
        if (Number.isFinite(zExp)) cost += Math.abs(zInfo.z - zExp) * zInfo.weight;
      }
      if (!best || cost < best.cost) best = { x: hit.x, y: hit.y, d: hit.d, cost, s };
      if (hint && hint.total) {
        let ds = Math.abs(s - hint.s) % hint.total;
        ds = Math.min(ds, hint.total - ds);
        if (ds <= hint.window && (!bestNear || cost < bestNear.cost)) bestNear = { x: hit.x, y: hit.y, d: hit.d, cost, s };
      }
      len += segLen;
    }
    if (!best) return null;
    if (bestNear && bestNear.cost <= best.cost + 14) return { ...bestNear, total: len };
    return { ...best, total: len };
  }
```
(Existing callers pass no `zInfo`, so `cost === d` and behavior is byte-for-byte identical for them. The returned object keeps `d` as the planar distance for the `TRACK_MAP_SNAP_MAX_DIST_PX` gate.)

- [ ] **Step 3: Add `buildTrackZProfile`** (immediately after `applyOfficialFit`, line ~267)

```js
  // Learn the expected elevation (official 0.1m units) at each polyline vertex
  // from fitted sample points. Doubles as a fit validator: a mirrored or
  // mis-rotated overlay maps unrelated track legs onto the same vertices,
  // which shows up as a large per-vertex z spread ("conflict").
  function buildTrackZProfile(samplePoints, fit, trackPts) {
    const perVertex = trackPts.map(() => []);
    let used = 0;
    for (const p of samplePoints) {
      const z = Number(p?.z);
      if (!(z > 0) || !Number.isFinite(p?.x) || !Number.isFinite(p?.y)) continue;
      const proj = applyOfficialFit(p, fit);
      let bi = -1, bd = Infinity;
      for (let i = 0; i < trackPts.length; i++) {
        const d = Math.hypot(proj.x - trackPts[i][0], proj.y - trackPts[i][1]);
        if (d < bd) { bd = d; bi = i; }
      }
      if (bi >= 0 && bd <= TRACK_MAP_SNAP_MAX_DIST_PX) { perVertex[bi].push(z); used += 1; }
    }
    if (used < TRACK_MAP_Z_MIN_SAMPLES) return null;
    let conflicts = 0, covered = 0;
    const zAt = perVertex.map((list) => {
      if (!list.length) return NaN;
      covered += 1;
      list.sort((a, b) => a - b);
      if (list[list.length - 1] - list[0] > TRACK_MAP_Z_CONFLICT_SPREAD) conflicts += 1;
      return list[Math.floor(list.length / 2)];
    });
    if (covered / trackPts.length < TRACK_MAP_Z_MIN_COVERAGE) return null;
    if (conflicts / covered > TRACK_MAP_Z_CONFLICT_MAX_FRACTION) return { conflict: true, zAt: null };
    // Fill uncovered vertices from the nearest covered vertex along the loop
    // so every segment carries an expected z.
    const filled = zAt.slice();
    const n = filled.length;
    for (let i = 0; i < n; i++) {
      if (Number.isFinite(filled[i])) continue;
      for (let off = 1; off < n; off++) {
        const fwd = zAt[(i + off) % n], back = zAt[(i - off + n) % n];
        if (Number.isFinite(fwd)) { filled[i] = fwd; break; }
        if (Number.isFinite(back)) { filled[i] = back; break; }
      }
    }
    return { conflict: false, zAt: filled };
  }
```

- [ ] **Step 4: Run the probe — phases 0–4 logic now exists, expect FAIL only on phase 5 (garbage guard not yet added)**

Run: `npm run probe:trackmap:z-anchor`
Expected: assertion failure at "TrackMap.jsx should reject (0,0) zero-z packets before projection".

- [ ] **Step 5: Commit**

```bash
git add ui_kits/pitwall/TrackMap.jsx
git commit -m "feat: z-aware track snapping and per-vertex elevation profile"
```

---

### Task 4: Wire profile + garbage guard through projector and motion loop

**Files:**
- Modify: `ui_kits/pitwall/TrackMap.jsx:348-381` (`officialPositionProjector`), `:661-667` (place loop)

- [ ] **Step 1: Projector — filter garbage, build/cache profile, validate fit, expose zInfo**

Replace `officialPositionProjector` (lines 348–381) with:
```js
  function officialPositionProjector(cars, geom, bounds, samplePoints) {
    const usable = (point) => Number.isFinite(point?.x) && Number.isFinite(point?.y)
      && !(point.x === 0 && point.y === 0 && !(Number(point.z) > 0));
    const sample = (Array.isArray(samplePoints) ? samplePoints : []).filter(usable);
    // Session-wide sample points (replay archives) give a stable orientation
    // even when the cars themselves are clustered on the grid; live falls back
    // to fitting against the current car positions.
    const points = sample.length >= 8 ? sample : cars
      .map((car) => car.trackPosition)
      .filter(usable);
    if (points.length < 3 || !geom?.points?.length) return null;
    const cacheKey = sample.length >= 8 && bounds
      ? `${geom.vb}|${bounds.minX},${bounds.minY},${bounds.maxX},${bounds.maxY}|${sample.length}`
      : `${geom.vb}|live|${points.length}`;
    const cached = officialFitCache.get(cacheKey);
    let entry = cached && (sample.length >= 8 || Date.now() - cached.at < 10000) ? cached : null;
    if (!entry) {
      let best = fitOfficialSimilarity(points, geom.points) || { fit: null, score: Infinity };
      if (best.fit) {
        const distinct = new Set(points.map((point) => {
          const snapped = nearestTrackPoint(applyOfficialFit(point, best.fit), geom.points);
          return snapped ? `${Math.round(snapped.x / 4)}:${Math.round(snapped.y / 4)}` : "";
        }).filter(Boolean));
        if (distinct.size < Math.min(8, Math.ceil(points.length / 2))) best = { fit: null, score: Infinity };
      }
      if (best.score > TRACK_MAP_FIT_MAX_AVG_PX) best = { fit: null, score: Infinity };
      let zAt = null;
      if (best.fit) {
        const profile = buildTrackZProfile(points, best.fit, geom.points);
        // A conflicted profile means the overlay folds different-elevation
        // legs onto the same vertices: the fit itself is wrong. Reject it.
        if (profile?.conflict) best = { fit: null, score: Infinity };
        else if (profile) zAt = profile.zAt;
      }
      entry = { best, zAt, at: Date.now() };
      officialFitCache.set(cacheKey, entry);
      if (officialFitCache.size > 40) officialFitCache.delete(officialFitCache.keys().next().value);
    }
    if (!entry.best.fit) return null;
    const fit = entry.best.fit;
    // Returns the raw projected point; the motion layer snaps it to the track
    // with continuity so hairpin legs are not crossed.
    const project = (point) => applyOfficialFit(point, fit);
    project.zInfo = entry.zAt ? { zAt: entry.zAt, weight: TRACK_MAP_Z_WEIGHT * fit.scale } : null;
    return project;
  }
```
(Note the cache entry shape changes from `{ best, at }` to `{ best, zAt, at }` — both reads are inside this function, no other consumers.)

- [ ] **Step 2: place loop — drop garbage packets, pass z to the snap** (lines 661–667)

Replace:
```js
          const raw = projectOfficialPosition && c.trackPosition ? projectOfficialPosition(c.trackPosition) : null;
          let motion = motionRef.current[c.code] || null;
          const hint = motion ? { s: wrapMod(motion.s), total: trackTotal, window: TRACK_MAP_RESNAP_WINDOW_PX } : null;
          const snap = raw ? nearestTrackPoint(raw, pts, hint) : null;
```
with:
```js
          const tp = c.trackPosition;
          const zRaw = Number(tp?.z);
          // (0,0) with no elevation is the feed's dropout sentinel, not a place.
          const garbage = tp && tp.x === 0 && tp.y === 0 && !(zRaw > 0);
          const raw = projectOfficialPosition && tp && !garbage ? projectOfficialPosition(tp) : null;
          let motion = motionRef.current[c.code] || null;
          const hint = motion ? { s: wrapMod(motion.s), total: trackTotal, window: TRACK_MAP_RESNAP_WINDOW_PX } : null;
          const zInfo = projectOfficialPosition?.zInfo && zRaw > 0
            ? { zAt: projectOfficialPosition.zInfo.zAt, weight: projectOfficialPosition.zInfo.weight, z: zRaw }
            : null;
          const snap = raw ? nearestTrackPoint(raw, pts, hint, zInfo) : null;
```

- [ ] **Step 3: Run the z-anchor probe — expect ALL PASS (GREEN)**

Run: `npm run probe:trackmap:z-anchor`
Expected: JSON phase report + `trackmap z-anchor probe: ALL PASS`.

- [ ] **Step 4: Commit**

```bash
git add ui_kits/pitwall/TrackMap.jsx
git commit -m "feat: validate map fit with z profile and drop dropout packets"
```

---

### Task 5: Regression — existing terminal probes must still pass

**Files:** none (verification only)

- [ ] **Step 1: Run the existing Monaco track-map render probe (networked, real F1 archive)**

Run: `npm run probe:trackmap:monaco-race`
Expected: JSON result + its built-in asserts pass (≥20 matched cars, ≥10 unique render points, loads <10s). This is the "cars are showing on the map" check against real Monaco data.

- [ ] **Step 2: Run the repo smoke test (static source assertions incl. TrackMap patterns)**

Run: `node scripts/pitwall-smoke-test.cjs`
Expected: exits 0.

- [ ] **Step 3: Build the renderer to confirm the JSX still compiles**

Run: `npm run build`
Expected: exits 0.

- [ ] **Step 4: Commit anything probe-related only if files changed (none expected)** — otherwise nothing to commit.

---

### Verification summary (what proves "showing on the map and anchored properly")

| Check | Command | Proves |
|---|---|---|
| Synthetic + real-data z snapping | `npm run probe:trackmap:z-anchor` | z steers snaps to the correct leg; 0 elevation violations across ~8.5k Monaco race points; tunnel/Casino perturbation held 100% where 2D fails |
| Cars render on Monaco map | `npm run probe:trackmap:monaco-race` | end-to-end replay pipeline still projects ≥20 cars onto the circuit SVG |
| Source contract | `node scripts/pitwall-smoke-test.cjs` | existing TrackMap/main.cjs invariants intact |
| Compiles | `npm run build` | renderer bundle builds |

**Known limitation (intentional YAGNI):** in live mode the fit uses only the ~20 current car positions, which is below `TRACK_MAP_Z_MIN_SAMPLES`, so the z profile mostly benefits replay; live still gains the garbage-packet guard and unchanged fallback behavior. Accumulating a live sample history is a follow-up.
