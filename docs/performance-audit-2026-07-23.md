# Apexline Performance and Data-Loading Audit

Date: 2026-07-23

Scope: Electron startup and IPC, React rendering, F1/news/stats loading and
correctness, F1 TV playback paths, renderer/package size, public download site,
and existing regression checks.

This began as a read-only code audit. The follow-up implementation pass applied
the safe fixes below while preserving the user's existing live-timing and
release-script work. Finding 3 was explicitly excluded by request.

## Executive summary

The highest-return work is:

1. Paint cached data immediately instead of hiding it behind a network refresh.
2. Stop loading development React, every route, HLS, and Shaka before first
   paint.
3. Isolate Live Racing's high-frequency clocks/timing from its full component
   tree.
4. Add stale-socket recovery to Formula 1 live timing.
5. Correct the analytics fallback timestamp before trusting recap stats.
6. Reduce playback/replay memory and network volume.

The app already has useful foundations: core requests are mostly parallel,
in-flight snapshot refreshes are deduplicated, disk snapshots support
stale-while-revalidate in the main process, news images inside the app lazy
load, and player/listener cleanup is generally careful. The renderer currently
defeats part of that good cache design by withholding cached data until
enrichment finishes.

## Measurements

| Surface | Current measurement | Meaning |
|---|---:|---|
| Parser-blocking renderer JavaScript | ~3.87 MB | All routes and media engines load before first paint |
| React + ReactDOM development UMD | 1,190,158 bytes | Production UMD equivalents total 142,586 bytes, about 88% smaller |
| HLS + Shaka runtime scripts | 1,330,716 bytes | Loaded even when the user never opens Live Racing |
| Transpiled renderer screens/data | 1,111,271 bytes | `LiveRacing.js` alone is 457,894 bytes |
| Packaged app | 367 MB | Electron dominates, but avoidable package contents remain material |
| Packaged playback `node_modules` | 108 MB | HLS is 24 MB and Shaka is 79 MB because whole packages are copied |
| Landing-page screenshots | 17.16 MB | Ten PNGs load eagerly; largest files are 6.53 MB and 4.86 MB |
| Local packaged snapshots | 124 apps / 45 GB | Every package run retains another full app |
| Update artifacts | 2.8 GB | 21 historical zips are kept in the deployed static project |
| Renderer build | 0.48 s locally | Build itself is not a bottleneck |

## High-priority findings

### 1. Cached startup is still network-gated

**Evidence:** [DataProvider.jsx:388](ui_kits/pitwall/DataProvider.jsx:388),
[DataProvider.jsx:424](ui_kits/pitwall/DataProvider.jsx:424),
[main.cjs:7709](electron/main.cjs:7709),
[main.cjs:7730](electron/main.cjs:7730),
[pitwall-smoke-test.cjs:3812](scripts/pitwall-smoke-test.cjs:3812).

Electron can return the disk snapshot immediately and refresh in the
background, but the renderer deliberately keeps the whole shell behind a
loading screen while a cached snapshot is marked `refreshing`. It retries IPC
every 1.2 seconds with no renderer-side deadline. A fresh start also waits for a
nine-source core batch; each source can take up to 8.5 seconds. Four news
sources therefore sit on the same critical path as standings and schedule.

**Impact:** slow/offline sources turn a fast cached launch into an extended or
potentially unbounded loading screen.

**Fix:** open the shell on any valid disk snapshot immediately; show per-widget
refresh/stale state. Move news off the core startup path. Add an absolute
startup deadline and a test asserting cached dashboard paint within a budget
under slow/offline sources.

### 2. Production eagerly loads development React, every route, and both players

**Evidence:** [build-renderer.cjs:40](scripts/build-renderer.cjs:40),
[build-renderer.cjs:60](scripts/build-renderer.cjs:60).

All scripts are classic parser-blocking tags and rendering starts only after
all of them execute. The production build still uses
`react.development.js`/`react-dom.development.js`.

**Impact:** avoidable startup I/O, parse/compile work, memory, and delayed first
paint on every launch.

**Fix:** use production React UMD files first. Then add a small screen-script
loader so only DataProvider, AppShell, and the active screen block first paint.
Load HLS/Shaka only when a video pane is activated. Keep the current
browser-global architecture; a bundler is not required.

### 3. Live Racing redraws its large tree every 250 ms

**Evidence:** [LiveRacing.jsx:3977](ui_kits/pitwall/LiveRacing.jsx:3977),
[LiveRacing.jsx:4105](ui_kits/pitwall/LiveRacing.jsx:4105),
[LiveRacing.jsx:5302](ui_kits/pitwall/LiveRacing.jsx:5302),
[LiveRacing.jsx:5927](ui_kits/pitwall/LiveRacing.jsx:5927).

The 6,826-line component owns a 250 ms clock state. Each tick invalidates the
top-level component and re-runs timing, battle, pane, and insight model work,
alongside separate frequent timing updates.

**Impact:** sustained CPU/GC work and possible video/control jank during the
app's most demanding screen.

**Fix:** extract clocks, timing tower, race control, and pane chrome into
memoized subtrees. Keep transient timing/animation values in refs where they do
not change declarative UI. Add React Profiler render-count and commit-duration
budgets.

### 4. Stalled Formula 1 live timing does not self-recover

**Evidence:** [main.cjs:5736](electron/main.cjs:5736),
[main.cjs:5789](electron/main.cjs:5789),
[main.cjs:6179](electron/main.cjs:6179).

The connection initializer exits whenever the socket claims it is connected.
If messages stop, the snapshot becomes stale, but the connected socket is not
closed and re-established.

**Impact:** live timing can stay unavailable/catching up indefinitely until a
manual resync or restart.

**Fix:** add a heartbeat watchdog based on `lastMessageAt`; close/reset and
reconnect after the stale threshold. Test a socket that remains open but stops
delivering data.

### 5. Analytics fallback can report mid-race data as final stats

**Evidence:** [main.cjs:10974](electron/main.cjs:10974),
[main.cjs:10983](electron/main.cjs:10983).

The Formula 1 timing fallback samples at session start plus 1,400 seconds
(23:20), or 5,200 seconds when a start is unavailable. For a race, the former
is commonly mid-session.

**Impact:** recap positions, laps, comparisons, and derived stats can be
factually wrong while looking complete.

**Fix:** derive the terminal archive timestamp from session end/status and the
last valid timing entry. Add fixtures for short, normal, red-flagged, and
time-limited sessions.

### 6. Replay fallback downloads a 121-second all-driver telemetry window every five seconds

**Evidence:** [main.cjs:6052](electron/main.cjs:6052),
[main.cjs:6068](electron/main.cjs:6068),
[main.cjs:6090](electron/main.cjs:6090).

Each new five-second replay bucket fetches the preceding 120 seconds plus one
second of `car_data`, for all drivers.

**Impact:** overlapping downloads, repeated JSON parsing, OpenF1 rate-limit
pressure, and lag while scrubbing or playing.

**Fix:** cache larger rolling telemetry chunks and slice locally, or narrow
requests to the minimum drivers/time range needed. Add request-count and byte
budgets for a ten-minute replay.

### 7. Media proxy fully buffers and copies playback responses

**Evidence:** [main.cjs:7806](electron/main.cjs:7806),
[main.cjs:7867](electron/main.cjs:7867),
[preload.cjs:65](electron/preload.cjs:65).

Every response is accumulated into chunk buffers, concatenated, sliced to an
ArrayBuffer, then structured-cloned over IPC.

**Impact:** multiple full-size copies raise peak memory and GC pressure during
video playback.

**Fix:** use a streaming protocol or MessagePort transport where compatible;
otherwise enforce response-size ceilings and avoid the extra slice/copy. Add a
long-play memory test and segment-size guard.

### 8. Track Map performs repeated full-session work

**Evidence:** [main.cjs:4727](electron/main.cjs:4727),
[main.cjs:5446](electron/main.cjs:5446),
[TrackMap.jsx:1181](ui_kits/pitwall/TrackMap.jsx:1181).

Main-process position bounds/traces traverse full cached samples on a 270 ms
path, while replay elapsed state redraws the full React tree at 10 Hz.

**Impact:** duplicated main/renderer CPU work that grows with session length.

**Fix:** memoize invariant bounds/traces by source entry identity and isolate
the changing progress/current-position UI in the renderer.

### 9. Packaging copies 108 MB of playback packages to use ~1.3 MB of runtime scripts

**Evidence:** [package-macos.cjs:535](scripts/package-macos.cjs:535).

The app recursively copies complete React, ReactDOM, HLS, and Shaka packages.
HLS and Shaka account for about 106.9 MB uncompressed and 28.7 MB compressed in
the current zip.

**Impact:** larger downloads, updates, disk use, signing/notarization, and
deployment time.

**Fix:** copy only referenced runtime distributions plus required license files.
Add packaged playback coverage and app/zip size ceilings.

### 10. Public landing page eagerly downloads 17.16 MB of screenshots

**Evidence:** [index.html:496](updates-site/public/index.html:496),
[index.html:519](updates-site/public/index.html:519).

Ten large PNG screenshots lack `loading="lazy"`, async decoding, responsive
sources, and modern formats.

**Impact:** slow landing-page load and substantial bandwidth, especially on
mobile or constrained connections.

**Fix:** generate responsive AVIF/WebP variants, prioritize only the first
visible image, lazy-load the rest, and add a total/page image-byte budget.

## Medium-priority findings

- **F1 TV library fan-out:** up to 32 detail requests run without per-season
  in-flight deduplication. Add keyed refresh promises and bounded concurrency.
  Evidence: [main.cjs:3065](electron/main.cjs:3065),
  [main.cjs:9958](electron/main.cjs:9958).
- **Dashboard enrichment volume:** every three-minute refresh can request the
  complete latest-session car telemetry and enrich up to 24 article pages.
  Time-bound telemetry, cache article enrichment by canonical URL, and cap
  concurrency. Evidence: [main.cjs:191](electron/main.cjs:191),
  [main.cjs:2135](electron/main.cjs:2135),
  [main.cjs:7586](electron/main.cjs:7586).
- **Settings write amplification:** each profile-name keystroke serializes the
  full profile, synchronously writes localStorage, invokes Electron, and
  updates shared context. Debounce/commit on blur and store large profile
  images separately. Evidence:
  [Settings.jsx:278](ui_kits/pitwall/Settings.jsx:278),
  [DataProvider.jsx:239](ui_kits/pitwall/DataProvider.jsx:239).
- **Dashboard identity mismatch:** the countdown may select a later race while
  the hero still reads name/circuit/round from `D.race`. Render identity from
  the race owning `nextSession`. Evidence:
  [Dashboard.jsx:106](ui_kits/pitwall/Dashboard.jsx:106),
  [Dashboard.jsx:115](ui_kits/pitwall/Dashboard.jsx:115).
- **Serialized connection probes:** AI auth and F1 TV status are independent but
  awaited sequentially. Use `Promise.allSettled`. Evidence:
  [DataProvider.jsx:446](ui_kits/pitwall/DataProvider.jsx:446).
- **Potential startup hang:** the main window is created only after an
  unbounded Electron-components readiness promise. Add a bounded wait and
  degraded playback status. Evidence:
  [main.cjs:631](electron/main.cjs:631),
  [main.cjs:11808](electron/main.cjs:11808).
- **Operational artifact growth:** package snapshots currently consume 45 GB
  locally and the static update project 2.8 GB. Make snapshots opt-in/retained
  by policy and archive old public artifacts outside the active deployment.
  Evidence:
  [package-macos.cjs:514](scripts/package-macos.cjs:514),
  [prepare-vercel-update.cjs:51](scripts/prepare-vercel-update.cjs:51).
- **News list scaling (hypothesis):** each render copies, filters, and renders
  the feed again in Trending. This is currently low risk if feeds remain
  small; cap/paginate and use `content-visibility` before expanding sources.
  Evidence: [News.jsx:120](ui_kits/pitwall/News.jsx:120).

## Implementation result

Implemented:

- Cached snapshots now paint immediately while enrichment continues in the
  background; connection probes run concurrently and last-known news survives
  partial failures.
- Production React is used, routes load on demand, and HLS/Shaka load only when
  Live Racing needs them.
- Live-timing attempts have stale-feed recovery and identity guards. Analytics
  terminal time and Dashboard race/session ownership were corrected.
- Replay telemetry uses aligned bounded chunks, bounded caches, request/byte
  budgets, and in-flight deduplication. F1 TV and news enrichment have bounded
  concurrency, cache limits, and deadlines.
- Media proxy responses retain the existing IPC contract but are capped at
  64 MiB with cleanup on overflow. A streaming transport redesign remains
  deferred.
- Track Map promotes data at one-second buckets while narrow clocks update at
  100 ms. Settings writes are debounced and profile images are stored
  separately. News derivations and off-screen rendering are bounded.
- Future packages copy only the eight required runtime/license files,
  snapshots are opt-in, and app/update artifacts have size ceilings. Update
  zips are validated at a temporary sibling path before atomic publication.
- The landing page prioritizes only the first screenshot and lazy-loads the
  remaining nine.

Deferred:

- Finding 3, the Live Racing 250 ms top-level render refactor, per user request.
- Streaming media transport/MessagePort redesign; bounded buffering is the
  surgical safe fix.
- Destructive cleanup of existing local snapshots and historical update zips.
- AVIF/WebP screenshot conversion pending a reviewed image-quality pipeline.

## Recommended implementation order

### Phase 1: correctness and immediate perceived speed

1. Open cached startup immediately; split news from core loading; bound retry.
2. Switch to production React.
3. Add live-timing stale-socket reconnect.
4. Correct analytics terminal sampling and Dashboard race identity.
5. Fix the stale public download links so the smoke suite can run.

### Phase 2: sustained runtime performance

1. Split/memoize Live Racing's clocks, timing tower, and panes.
2. Memoize Track Map invariant calculations and isolate its 10 Hz UI.
3. Chunk/cache replay telemetry and cache news/F1 TV enrichment.
4. Stream or reduce copies in the media proxy.
5. Debounce Settings persistence.

### Phase 3: distribution and web delivery

1. Lazy-load screens, HLS, and Shaka.
2. Copy only required packaged runtime files.
3. Convert/lazy-load landing screenshots.
4. Add package, zip, page-weight, startup-resource, and render-count budgets.
5. Add snapshot/release retention.

## Verification status

- `/opt/homebrew/bin/npm test`: passed; both Apexline smoke suites completed.
- `/opt/homebrew/bin/npm run build`: passed.
- `node --check electron/main.cjs`: passed.
- `node --check electron/preload.cjs`: passed.
- `node --check scripts/package-macos.cjs`: passed.
- `node --check scripts/prepare-vercel-update.cjs`: passed.
- `git diff --check`: passed.
- Initial parser-blocking renderer scripts: 541,741 bytes (budget:
  less than 1,048,576).
- Packaged runtime allowlist: 8 files, 1,491,736 bytes (budget:
  less than 2,097,152).
- Ten landing screenshots: 17,160,049 bytes, at the non-growth ceiling; nine
  are below-fold lazy loads.
- Existing 1.1.8 update zip: 141,535,751 bytes (future ceiling: 150 MiB).
- Replay fixtures enforce no more than six aligned requests and six synthetic
  MiB per ten minutes.

No package/sign/notarize run, runtime React Profiler trace, long-play memory
profile, or live production network-volume benchmark was performed. Packaging
and release guards were verified with isolated filesystem fixtures so the
existing release artifact was not mutated.
