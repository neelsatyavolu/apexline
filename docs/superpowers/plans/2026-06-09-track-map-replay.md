# Track Map Replay Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add isolated Track Map replay playback using official Formula 1 livetiming data.

**Architecture:** `electron/main.cjs` exposes a Track Map-specific IPC handler that wraps Formula 1 livetiming archive parsing and returns timing rows plus projected map positions. `electron/preload.cjs` exposes that method as `pitwall.data.trackMapReplayTiming`. `ui_kits/pitwall/TrackMap.jsx` owns replay UI and state without calling Live Racing's replay API.

**Tech Stack:** Electron CommonJS main/preload, browser-global React renderer, existing smoke-test script.

---

### Task 1: Smoke Assertions

**Files:**
- Modify: `scripts/pitwall-smoke-test.cjs`

- [ ] Add assertions that preload exposes `trackMapReplayTiming`, Electron main handles `pitwall:data:trackMapReplayTiming`, and Track Map calls `trackMapReplayTiming` instead of `replayTiming`.
- [ ] Run `/opt/homebrew/bin/npm test` and confirm the new assertions fail before implementation.

### Task 2: Main/Preload Client

**Files:**
- Modify: `electron/main.cjs`
- Modify: `electron/preload.cjs`

- [ ] Add `getTrackMapReplayTimingSnapshot(options)` as a thin Track Map client around existing Formula 1 livetiming archive parsing.
- [ ] Include sanitized timing rows, session clock, lap timeline, progress bounds, and map-position hints derived from official telemetry/timing.
- [ ] Register `pitwall:data:trackMapReplayTiming`.
- [ ] Expose `pitwall.data.trackMapReplayTiming`.

### Task 3: Track Map UI

**Files:**
- Modify: `ui_kits/pitwall/TrackMap.jsx`

- [ ] Add local replay state, session option helpers, and replay loading/polling.
- [ ] Add `Load replay`, sprint/race modal, left-of-selector progress scrubber, pause/resume, and exit replay behavior.
- [ ] Feed replay timing rows into the tower and replay cars into `TrackMapView`.
- [ ] Keep live behavior unchanged for non-replay mode.

### Task 4: Verification

**Files:**
- Verify only

- [ ] Run `/opt/homebrew/bin/npm test`.
- [ ] Run `/opt/homebrew/bin/npm run build`.
- [ ] Run `node --check electron/main.cjs`.
- [ ] Report any blocked real livetiming replay probe separately.
