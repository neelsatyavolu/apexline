# Using `position.z` for Highly Accurate Track Map Positions

Analysis of Monaco GP 2026 race telemetry (OpenF1 session_key `11299`, June 7 2026)
and a concrete plan for wiring `z` into `ui_kits/pitwall/TrackMap.jsx`.

## Mock data (checked into `results/monaco-2026-mock-location/`)

| File | Contents |
|------|----------|
| `race-window-6drivers.json` | 8,580 points, drivers 1/3/16/81/63/44 (NOR, VER, LEC, PIA, RUS, HAM), race laps 13:03:00–13:09:30 UTC, fields `date,driver_number,x,y,z` |
| `driver1-continuous-run.json` | Longest gap-free single-driver run (3,367 pts, 12:21:30–12:36:12) — good for building/validating z profiles |
| `monaco-z-profile-10m-grid.json` | Pre-built lookup: median `z` per 10 m x/y grid cell (452 cells), the artifact the renderer would consume |

## What the data says

- **Units / range**: x, y, z are in 0.1 m. Monaco z spans **494–895** (≈ 49–90 m above
  the session datum, ≈ 40 m of real elevation change — matches the circuit).
- **`z = 0` is a dropout sentinel, not an elevation.** 2,903 of 8,087 rows for driver 1
  were `(0,0,0)` or `z=0` garbage. Valid z never goes below 494 at Monaco.
- **z is a reliable location fingerprint.** Bucketing the race into 20 m cells, the
  z spread at the same spot across all laps is **0.2 m median, 1.7 m p90, 7.4 m max**.
  Lap after lap, the car reports the same elevation at the same place.
- **z is invariant to the 2D fit.** The official telemetry frame is rotated/mirrored
  by an arbitrary angle per session (why `fitOfficialSimilarity` exists). That
  transform only touches x/y — z survives untouched, so it can be trusted *before*
  any fit is computed.
- **Monaco has real 2D-ambiguity zones that z resolves.** 71 cell pairs sit < 50 m
  apart in plan view but ≥ 8 m apart in elevation. The worst cluster is the
  **Beau Rivage/Casino climb (z ≈ 860) running directly above the tunnel/Portier
  section (z ≈ 531)** — 33 m of elevation within 40–45 m planar distance.
  **21.6 % of all race samples are within 60 m planar of a track segment ≥ 8 m away
  in elevation.** With fit/GPS error in the tens of meters, a 2D-only nearest-segment
  snap can grab the wrong road there; z makes the two branches unconfusable.
- **Cadence**: ~240 ms median between points (~4 Hz) per driver.
- Note: the live SignalR `Position` feed carries the same `X, Y, Z` fields, so
  everything below works identically for live sessions and OpenF1 replays.

## Current pipeline (TrackMap.jsx)

1. `officialPositionProjector` fits a similarity transform (mirror→rotate→scale→translate)
   from official x/y to the drawn SVG polyline, scored by mean distance + a
   driving-direction penalty.
2. `nearestTrackPoint(p, pts, hint)` snaps the projected point to the nearest
   polyline segment in 2D, with an s-window hint to avoid opposite-hairpin-leg capture.
3. Motion is integrated in s-space (dead reckoning + exponential smoothing) and
   rendered with `getPointAtLength`.

The hint window and direction penalty are heuristics for exactly the failure mode
z solves physically.

## Plan: four incremental uses of z (in order of value/effort)

### 1. Packet validation (trivial, immediate win)
Reject position packets with `z <= 0` (alongside the existing finite checks) in the
feed layer and in `officialPositionProjector`'s sample filter. `(0,0,z)` and `z=0`
rows are dropouts; today a `(0,0)` packet is finite and would project somewhere on
screen, teleporting the dot. Verify: count rejected rows on the mock files (expect
2,903 / 8,087 for driver 1 full-session data).

### 2. z-aware snapping (the accuracy headline)
Annotate the circuit polyline with an expected-z per vertex, then make
`nearestTrackPoint` score candidates with
`cost = planarDistance + λ · |z_sample − z_vertex|` (λ ≈ 1 px per 1.5 m elevation
diff after unit normalization; tune on mock data). Where the per-vertex z comes from:

- **Bootstrap at runtime**: replay sample points (`trackPositionSample`) already pass
  through the fitter; after a fit is accepted, accumulate median z per snapped
  polyline vertex. After ~1 lap of any driver the profile is complete (3,367-point
  mock run covers the lap).
- **Or ship it**: `monaco-z-profile-10m-grid.json` shows the artifact is ~6 KB per
  circuit; a per-vertex z array in `trackmap-circuits.js` is even smaller. Could be
  generated once per circuit from any historical session.

Effect: in the tunnel/Casino overlap a sample at z≈531 simply cannot snap to the
z≈860 branch regardless of planar noise. The s-window hint stays as-is (still needed
for hairpins at equal elevation, e.g. Loews legs differ by only ~2–3 m).

### 3. z-anchored fitting (robustness for live)
`fitOfficialSimilarity` currently needs ≥ 8 spread-out sample points and can lock a
wrong orientation when live cars are clustered (grid, SC train). Because z is
transform-invariant, match sample points to track regions *by z first*
(e.g. a z≈531 point must lie on the tunnel section; z≈860 on the Casino section),
and use those correspondences either as extra anchors in the scoring function or as
a seed for the rotation search. This converges the fit faster and rules out
mirrored/reversed overlays at circuits with asymmetric elevation.

### 4. Optional polish: render elevation
Once vertices carry z: shade the track stroke by elevation or mark the tunnel
section — zero data cost, helps users read Monaco's geography.

## Verification plan (against the mock data)

1. Unit test `nearestTrackPoint` with z: feed tunnel-section points perturbed ±50 m
   planar toward the Casino section; 2D snap must fail some, 3D snap must pass all.
2. Replay `race-window-6drivers.json` through the projector; assert 0 snaps where
   |z_sample − z_vertex| > 8 m, and no increase in snap distance elsewhere.
3. Confirm no regression at z-flat circuits (z term contributes ~0 when profile is
   flat or absent — code must treat missing z profile as λ = 0).
