# Apexline Safe Performance Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement every safe, bounded fix from `docs/performance-audit-2026-07-23.md` except finding 3, the Live Racing 250 ms render-tree refactor.

**Architecture:** Preserve Apexline's CommonJS main process and browser-global React renderer. Improve perceived startup with stale-while-revalidate, load production renderer resources on demand, add bounded recovery/caching to existing data paths, and shrink future packages without changing external APIs. Risky protocol replacement, destructive artifact cleanup, and the excluded Live Racing render refactor remain out of scope.

**Tech Stack:** Electron 39/CastLabs, CommonJS, React 18 browser globals, Babel standalone build script, Node smoke tests, static Vercel site.

**Safety constraints:** Preserve all pre-existing dirty-worktree changes. Do not commit, delete existing app snapshots/update zips, alter DRM behavior, expose credentials, or edit `dist/*.app`. Every production change begins with one regression assertion that is observed failing. Because `pitwall-smoke-test.cjs` is fail-fast, use a strict one-fixture red-green cadence: add one fixture, run `node scripts/pitwall-smoke-test.cjs` and observe that named fixture fail, implement only that behavior, rerun to green, then add the next fixture.

**Fixed acceptance values:** background enrichment polling: at most 4 polls at 2.5 seconds (10 seconds total); F1 TV/news detail concurrency: 4; news enrichment cache TTL: 15 minutes; latest-session telemetry window: 2 minutes; replay telemetry chunks: 120 seconds and at most 6 OpenF1 car-data requests per 10 minutes of sequential playback; Electron-components readiness timeout: 5 seconds; buffered media response ceiling: 64 MiB; media accumulator stress fixture: 200 sequential 1 MiB responses with zero retained chunks after finalization; profile persistence debounce: 300 ms.

---

### Task 0: Preserve the dirty baseline and unblock the existing smoke suite

**Files:**
- Modify: `scripts/prepare-vercel-update.cjs`
- Modify: `updates-site/public/index.html`
- Existing test: `scripts/pitwall-smoke-test.cjs:267`

- [ ] Capture the exact baseline with `git status --short`, `git diff --numstat`, and `git diff --binary --output=/tmp/apexline-preexisting-2026-07-23.patch -- electron/main.cjs scripts/pitwall-smoke-test.cjs scripts/prepare-vercel-update.cjs ui_kits/pitwall/LiveRacing.jsx`.
- [ ] Run `node scripts/pitwall-smoke-test.cjs` and confirm the existing line-267 assertion fails because the 1.1.8 package/feed is paired with 1.1.7 landing links.
- [ ] Add an executable temporary-HTML fixture for the release link replacer containing three old-version macOS links; assert all three become the requested version while unrelated links remain unchanged. Run `node scripts/pitwall-smoke-test.cjs` and observe the fixture fail before changing the replacer.
- [ ] Update all current landing links to 1.1.8 and make `prepare-vercel-update.cjs` replace every matching macOS artifact link, not only a subset.
- [ ] Run `node scripts/pitwall-smoke-test.cjs` and `node --check scripts/prepare-vercel-update.cjs`. Task 0 is complete only when the entire baseline pitwall smoke suite is green; resolve another in-scope pre-existing failure or stop and report an unrelated blocker rather than proceeding with a red baseline.

### Task 1: Cached-first startup and on-demand renderer resources

**Files:**
- Modify: `scripts/pitwall-smoke-test.cjs`
- Modify: `ui_kits/pitwall/DataProvider.jsx`
- Modify: `scripts/build-renderer.cjs`
- Modify: `electron/main.cjs`

- [ ] Add executable `vm` fixtures around `shouldWaitForStartupNews` proving both cached/pending and fresh/pending snapshots return `false`; add a fake-timer fixture proving background polling stops after 4 attempts/10 seconds; add generated-HTML assertions for production React and an initial dashboard resource allowlist.
- [ ] Add a deterministic connection fixture whose AI and F1 TV promises are manually released and assert both have started before either resolves.
- [ ] Add a source-set/data-flow fixture asserting `LIVE_CORE_DATA_URLS` contains no news keys while the background enrichment URL set contains all four configured news sources and is passed to `fetchLiveDataEntries`.
- [ ] Follow the global one-fixture red-green cadence with the exact command `node scripts/pitwall-smoke-test.cjs`.
- [ ] Change `shouldWaitForStartupNews` so valid cached/core data paints immediately and any enrichment continues as widget-level background work.
- [ ] Bound background enrichment polling to 4 attempts at 2.5-second intervals; startup itself paints immediately and does not poll-gate.
- [ ] Run AI/F1 TV connection probes concurrently with `Promise.allSettled`.
- [ ] Remove the four news requests from `LIVE_CORE_DATA_URLS`; start them in the existing background enrichment pass so standings/schedule/weather can paint independently.
- [ ] Build HTML with `react.production.min.js` and `react-dom.production.min.js`.
- [ ] Keep only DataProvider/AppShell plus the initial screen on the first-load path; add a small promise-cached script loader for other screens and load HLS/Shaka only before Live Racing is entered.
- [ ] Run `node scripts/pitwall-smoke-test.cjs`, `node --check electron/main.cjs`, and `/opt/homebrew/bin/npm run build`; confirm green output and inspect `dist/pitwall/index.html` with `rg -n "react\\.|LiveRacing|hls|shaka|<script" dist/pitwall/index.html`.

### Task 2: Data correctness and live-timing recovery

**Files:**
- Modify: `scripts/pitwall-smoke-test.cjs`
- Modify: `electron/main.cjs`
- Modify: `ui_kits/pitwall/Dashboard.jsx`

- [ ] Add executable fixtures for a connected timing client with `lastMessageAt` beyond the stale threshold and assert the real watchdog closes it and starts a reconnect.
- [ ] Add analytics archive fixtures for short qualifying, normal race, red-flagged race, and time-limited race data; assert the selected elapsed time is the last valid terminal timing point and never the hard-coded 1,400-second sample.
- [ ] Add a Dashboard fixture with `D.race` pointing at race A and `nextSession` owned by race B; assert hero name/circuit/round all use race B.
- [ ] Follow the global one-fixture red-green cadence with `node scripts/pitwall-smoke-test.cjs` for each fixture.
- [ ] Add a pure stale-connection predicate/watchdog and close/reset the socket before reconnecting when `lastMessageAt` exceeds the stale threshold.
- [ ] Derive analytics elapsed time from session end/last valid archive entry, retaining a conservative fallback only when terminal metadata is absent.
- [ ] Make `dashboardNextSession` carry its owning race and render the hero name/circuit/round from it.
- [ ] Run `node scripts/pitwall-smoke-test.cjs` and `node --check electron/main.cjs`.

### Task 3: Bounded network, cache, and IPC work

**Files:**
- Modify: `scripts/pitwall-smoke-test.cjs`
- Modify: `electron/main.cjs`
- `electron/preload.cjs` is intentionally unchanged; the media response contract remains an `ArrayBuffer`.

- [ ] Add a replay fixture that requests 120 sequential five-second buckets and asserts at most 6 car-data requests; use synthetic 1 MiB chunk payloads and assert aggregate fetched bytes are at most 6 MiB.
- [ ] Add promise-controlled fixtures proving two same-season F1 TV library calls share one refresh, detail fetch concurrency never exceeds 4, and output order is stable.
- [ ] Add a canonical-URL news fixture proving a second enrichment reuses the cached article and an expired entry refetches.
- [ ] Add a promise-controlled news enrichment fixture with eight article URLs and assert no more than 4 detail requests are active simultaneously while result order remains stable.
- [ ] Add a completed-session and live-session fixture for the telemetry-range builder; assert each generated `car_data` URL spans exactly 120 seconds and ends at `min(now, session.date_end)`.
- [ ] Add a never-settling components promise and assert readiness returns degraded status by the 5-second bound using fake timers.
- [ ] Feed media chunks up to and above 64 MiB and assert the real accumulator returns the same `ArrayBuffer` contract below the ceiling and aborts above it; finalize 200 sequential 1 MiB responses and assert the accumulator retains zero chunks after each response.
- [ ] Add Track Map fixtures that call multiple target times against the same immutable position-entry array and assert bounds/trace builders execute once while current-position selection changes.
- [ ] Follow the global one-fixture red-green cadence with `node scripts/pitwall-smoke-test.cjs` for each fixture.
- [ ] Cache replay car-data in larger time chunks and slice rows locally for five-second snapshots.
- [ ] Deduplicate F1 TV library refreshes by season and cap detail-request concurrency at 4 without changing result order.
- [ ] Cache news article enrichment by canonical URL for 15 minutes and cap concurrent article requests at 4.
- [ ] Replace the unbounded latest-session `car_data?session_key=latest` enrichment URL with a time-bounded range derived from the selected session: use the latest two minutes ending at `min(now, session.date_end)` and retain empty telemetry as a valid fallback.
- [ ] Add a timeout race around `components.whenReady()` so the main window can open with degraded playback status.
- [ ] Enforce a conservative maximum media response size while buffering and abort over-limit responses; preserve the existing IPC `ArrayBuffer` type and avoid changing preload callers.
- [ ] Memoize Track Map bounds and driver traces by the immutable position-entry set; continue computing only current positions per tick.
- [ ] Run `node scripts/pitwall-smoke-test.cjs`, `node --check electron/main.cjs`, and `node --check electron/preload.cjs`.

### Task 4: Non-Live renderer update efficiency

**Files:**
- Modify: `scripts/pitwall-smoke-test.cjs`
- Modify: `electron/main.cjs`
- Modify: `ui_kits/pitwall/Settings.jsx`
- Modify: `ui_kits/pitwall/TrackMap.jsx`
- Modify: `ui_kits/pitwall/News.jsx`

- [ ] Add fake-timer fixtures proving a burst of name edits within 300 ms produces one profile IPC write, favorite toggles remain immediate, and unmount flushes the latest draft.
- [ ] Add profile round-trip fixtures proving a multi-megabyte image payload is written/read through a separate profile-image file while ordinary profile JSON/IPC updates omit it.
- [ ] Add a render-counter fixture proving ten replay progress ticks do not re-run the invariant Track Map model builder.
- [ ] Add News fixtures proving unchanged stories reuse memoized derived lists and repeated cards carry `content-visibility` with an intrinsic size.
- [ ] Follow the global one-fixture red-green cadence with `node scripts/pitwall-smoke-test.cjs` for each fixture.
- [ ] Debounce profile persistence by 300 ms after text edits while keeping favorite toggles responsive; flush the latest value on unmount.
- [ ] Store profile image payloads separately in the main process while preserving the existing `profile.get`/`profile.set` renderer API and migration from current combined profiles.
- [ ] Isolate the 10 Hz Track Map replay clock/progress into the smallest practical subtree without changing playback timing.
- [ ] Memoize news derivations and add `content-visibility`/intrinsic sizing to repeated cards; do not introduce arbitrary story truncation unless the UI already exposes a limit.
- [ ] Run `node scripts/pitwall-smoke-test.cjs`, `node --check electron/main.cjs`, and `/opt/homebrew/bin/npm run build`.

### Task 5: Smaller future packages and faster public landing page

**Files:**
- Modify: `scripts/pitwall-smoke-test.cjs`
- Modify: `scripts/package-macos.cjs`
- Modify: `scripts/prepare-vercel-update.cjs`
- Modify: `updates-site/public/index.html`

- [ ] Add executable filesystem fixtures around an exported/pure runtime allowlist proving only the exact React, ReactDOM, HLS, Shaka, and license files are selected; assert total selected bytes stay below 2 MB.
- [ ] Add source fixtures proving snapshots are created only when `APEXLINE_KEEP_PACKAGE_SNAPSHOT=1`, the first screenshot is eager/high-priority, and all later screenshots are lazy/async.
- [ ] Add executable size-guard fixtures proving 330 MiB app and 150 MiB zip defaults accept values at the boundary, reject one byte above it, and honor `APEXLINE_MAX_APP_BYTES` / `APEXLINE_MAX_UPDATE_ZIP_BYTES` overrides.
- [ ] Add release-artifact size guards: packaged app default ceiling 330 MiB in `package-macos.cjs` and update zip default ceiling 150 MiB in `prepare-vercel-update.cjs`, both overrideable by the narrowly named environment variables above.
- [ ] Follow the global one-fixture red-green cadence with `node scripts/pitwall-smoke-test.cjs` for each assertion.
- [ ] Replace recursive dependency-package copies with explicit runtime-file/license copies while preserving paths used by generated HTML.
- [ ] Make timestamped package snapshots opt-in for future runs; do not delete existing snapshots.
- [ ] Update current landing links and image loading/decoding attributes. Do not generate lossy image variants without an approved image pipeline.
- [ ] Run `node scripts/pitwall-smoke-test.cjs`, `/opt/homebrew/bin/npm run build`, `node --check scripts/package-macos.cjs`, and `node --check scripts/prepare-vercel-update.cjs`; inspect selected runtime bytes without producing a signed/notarized package.

### Task 6: Regression budgets and complete verification

**Files:**
- Modify: `scripts/pitwall-smoke-test.cjs`
- Update: `docs/performance-audit-2026-07-23.md`

- [ ] Add stable byte/resource ceilings: initial parser-blocking renderer scripts below 1,048,576 bytes, packaged runtime inputs below 2,097,152 bytes, the ten referenced landing screenshots at or below the current non-growth ceiling of 17,160,049 bytes with below-fold lazy loading, replay 10-minute request/byte budget, and future app/zip ceilings from Task 5.
- [ ] Run `/opt/homebrew/bin/npm test` and confirm both smoke suites complete.
- [ ] Run `/opt/homebrew/bin/npm run build`.
- [ ] Run `node --check electron/main.cjs`, `node --check electron/preload.cjs`, `node --check scripts/package-macos.cjs`, and `node --check scripts/prepare-vercel-update.cjs`.
- [ ] Inspect `git diff --check`, the complete diff, and `git status --short` to confirm only scoped files changed and all pre-existing changes remain.
- [ ] Compare the final overlapping-file diff against `/tmp/apexline-preexisting-2026-07-23.patch`; confirm every original hunk is still present or intentionally extended, and the untracked live-timing probe remains untouched.
- [ ] Update the audit verification section with implemented/deferred items and measured post-change resource sizes.

## Explicitly deferred

- Audit finding 3: Live Racing's 250 ms top-level render refactor, per user request.
- Streaming media transport/MessagePort redesign: too risky for a surgical performance pass; bounded buffering is the safe fix.
- Deleting the existing 45 GB of local snapshots or 2.8 GB of historical update zips: destructive and not implied by this request.
- AVIF/WebP conversion of public screenshots: requires a reviewed image-quality pipeline; lazy loading and prioritization are safe now.
