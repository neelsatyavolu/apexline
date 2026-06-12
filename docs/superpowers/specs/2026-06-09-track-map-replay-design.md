# Track Map Replay Design

## Goal

Add Track Map replay playback for completed race sessions using the official Formula 1 livetiming archive, without reusing or changing Live Racing replay state.

## Decisions

- Add a Track Map-specific replay IPC/preload method, separate from `pitwall.data.replayTiming`.
- Use existing low-level Formula 1 livetiming archive parsing helpers where practical, but expose a specialized Track Map response shape.
- In `TrackMap.jsx`, keep replay state local to the screen.
- On regular weekends, `Load replay` loads the Grand Prix race.
- On sprint weekends, `Load replay` opens a two-choice modal with `Sprint` and `Race`.
- Add a replay progress bar to the left of the race selector.
- Use Formula 1 livetiming rows for timing and car data. Do not use OpenF1 for Track Map replay positions.

## UI Behavior

The header keeps the existing race selector. A replay progress control appears to its left only while replay data is active or loading. The map controls pause/resume replay playback and can exit replay mode. During replay, the timing tower and map cars use Track Map replay rows instead of dashboard snapshot rows.

## Verification

Add smoke checks that Track Map has its own replay client and does not call Live Racing's `pitwall.data.replayTiming`. Run smoke tests, renderer build, and `node --check electron/main.cjs`.
