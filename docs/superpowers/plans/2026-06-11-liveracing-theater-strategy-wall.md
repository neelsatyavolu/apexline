# Live Racing — Theater + Strategy Wall layouts

_Plan created 2026-06-11. Source design: Claude Design handoff `pitwall-design-system`, `liveracing/layouts.html` (chat11 "Alternative Racing Layouts")._

## What the design proposes

`layouts.html` is a **proposal doc** arguing today's Live Racing layouts (Intelligent/Classic/Battle/Data Overload) are all the same idea — a grid of video panes — and proposes layouts that open a new axis. This plan implements two of them:

- **Theater** (codename _Clear_) — _immersive_. One full-bleed feed, a collapsible floating glass timing tower, a lower-third ticker. The deliberate opposite of Data Overload.
- **Strategy Wall** (codename _Trace_) — _temporal_. A live race-trace gap graph over a tyre-stint gantt, plus a pit-window predictor rail. The screen that shows the _shape_ of the whole race. **No video feed.**

## Decisions (locked with user 2026-06-11)

1. **Strategy Wall audio: ON by default.** Commentary plays automatically on entry. Implemented by mounting the WORLD broadcast pane **parked/hidden** (existing `visible:false` mechanism, `LiveRacing.jsx:4428`) with `audioActive` true — keeps audio + the replay master alive with no visible video surface.
2. **Progress bar: playhead-on-timeline + bottom transport.** The Strategy Wall _is_ a timeline (race-trace + gantt over laps), so the replay playhead is the vertical **NOW line** across the chart; scrubbing moves through laps. A compact transport (play/pause · speed · master clock · scrub) docks along the wall's bottom edge. Both bind to the existing shared `replaySync` state + `onReplaySeek`/`onReplayToggle`. Theater gets the same transport as a floating glass bar, bottom-center.

## How the existing engine works (grounding)

- **Registry** `LAYOUTS` (`:630`): preset name → layout key (`focus|quad|battle|data|custom`). `setPreset(name)`.
- **Resolution** `:3028` `layout = activeCustomLayout ? "custom" : LAYOUTS[preset]`.
- **Body grid** `.live__body[data-layout=…]` (`:74-83`): timing sidebar column + `.live__center`. `focus` flips timing to the right; `custom` drops the sidebar.
- **Pane grid** `.live__grid[data-layout=…]` (`:149-156`) + the `panes` array branch (`:4378`). `renderLivePane` (`:4487`) → `<Pane>`.
- **Audio** is per-pane (`audioActive`/`audioVolume`, `focusAudioFeed`, `:4503`). Master audio feed = WORLD.
- **Replay** shared `replaySync` (`:3014`); per-pane transport overlay `.pane__replaybar` (`:2665`, `:2836`) with `replayProgressPct` (`:2550`), range `onReplaySeek`, toggle `onReplayToggle`. Parked panes stay mounted (`:4428`) to preserve buffers/audio.
- **Data available** for the wall: `timingRows` (pos/gap/interval/tyre/stint), `replayTimingData`, `D.byCode`, weather, `battlePairs`, insights (`kind:"strategy"`).

## Implementation

### Phase 1 — Theater (low risk, reuses panes) ✅ build first
1. `LAYOUTS`: add `"Theater": "theater"` (`:631`).
2. `panelSizes`: no new sizing needed (single pane).
3. CSS:
   - `.live__body[data-layout="theater"]` → single column (`minmax(0,1fr)`), no timing sidebar; `.live__center` spans it.
   - `.live__grid[data-layout="theater"]` → single area, world feed `object-fit: contain`/cover full-bleed.
   - Floating glass timing: reuse `renderTimingTower()` inside a `.live__theater-timing` absolutely-positioned glass card (collapsible, "tap to expand"), bottom-right; lower-third ticker is the broadcast pane's built-in ticker.
4. `panes` branch: `layout === "theater"` → `[{ broadcast:true, focus:true }]`.
5. Render: in the body, when `layout==="theater"` render the floating timing overlay instead of the sidebar `.live__timing`; transport = floating glass bar bound to `replaySync`.
6. Preset selector: appears automatically via `presetOptions` (derived from `LAYOUTS` keys).

### Phase 2 — Strategy Wall (new screen type, no panes)
1. `LAYOUTS`: add `"Strategy Wall": "strategy"`.
2. `.live__body[data-layout="strategy"]` → single column, no timing sidebar.
3. `panes` branch: `layout === "strategy"` → `[]` for the grid, BUT force a **parked hidden WORLD pane** into `panesToRender` so audio + replay master stay mounted (audio-on-by-default decision).
4. New `renderStrategyWall()` rendered in `.live__center` instead of `.live__grid`:
   - **Race-trace gap graph** (SVG): y = gap-to-leader (s), x = lap. One line per driver (constructor colors), the leader pinned at 0. Vertical **NOW line** = `replaySync` playhead. Projection zone past NOW (dashed). Source: per-lap gap history derived from `replayTimingData`/`timingRows` (start with current-lap snapshot + synthesized history; wire real per-lap history in a follow-up).
   - **Tyre-stint gantt**: one row per driver, stint bars colored by compound (`TyreBadge` palette), pit boxes at stops, NOW line shared with the trace.
   - **Pit-window predictor rail**: undercut windows, projected next stop, deg/track-evolution, SC probability — from `insights` (`kind:"strategy"`) + tyre age.
   - **Status strip** under the title: lap, session clock, pit-window OPEN/CLOSED, SC prob, pit loss, track evolution.
5. **Bottom transport** `.live__transport`: play/pause (`onReplayToggle`), speed, master clock (`formatReplayTime`), full-width scrub (`onReplaySeek`, `replayProgressPct`). Shown only when `replaySync.mode==="replay"`; in live mode show a "LIVE" pill + the lap axis only.
6. Audio chip in the wall header reflecting the parked WORLD pane's audio state (mute/volume) so the user can silence it.

### Phase 3 — polish / matrix
- Add both to the layout comparison/coverage matrix in Settings if one exists.
- Respect `prefers-reduced-motion` for the NOW-line/scrub transitions.
- Verify no overflow at min window width; verify replay seek drives both the chart NOW line and the (hidden) world audio.

## Open follow-ups
- Real per-lap gap/stint **history** store (today timing is a live snapshot). The wall renders meaningfully from the snapshot but the trace "tail" needs a lap-indexed history buffer to be truthful — flagged, separate task.
- Whether to retire Classic/Battle/Data Overload (design footer floated this) — product decision, out of scope.
