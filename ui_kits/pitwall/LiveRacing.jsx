/* Apexline Live Racing — single unified window. window.PW.LiveRacing */
(function () {
  const NS = window.PitWallDesignSystem_698fe6;
  const { Icon, Badge, Button, IconButton, SegmentedControl, FlagStatus, TimingRow, TimingRowHeader,
    TyreBadge, DriverTag, GapDelta, Switch, Avatar } = NS;
  const D = window.PW_DATA;
  const LIVE_TIMING_POLL_INTERVAL_MS = 270;
  const REPLAY_TIMING_POLL_INTERVAL_MS = 100;
  const REPLAY_TIMING_REQUEST_TIMEOUT_MS = 15000;
  const CLOCK_TICK_INTERVAL_MS = 250;
  const TIMING_ROW_MOTION_MS = 280;
  const AI_INSIGHT_INTERVAL_MS = 2 * 60 * 1000;
  const AI_INSIGHT_HISTORY_LIMIT = 8;
  const AI_INSIGHT_RECENT_LIMIT = 6;
  const AI_INSIGHT_EVENT_POLL_MS = 5 * 1000;
  const AI_INSIGHT_EVENT_SPACING_MS = 30 * 1000;
  const CUSTOM_TILE_CHROME_HIDE_MS = 5000;
  const CUSTOM_TILE_CHROME_HOTZONE_PX = 42;
  const PLAYBACK_PROFILES = {
    main: { bufferGoal: 18, replayBufferGoal: 30, backBufferLength: 18 },
    onboard: { maxHeight: 540, maxBandwidth: 2500000, bufferGoal: 10, replayBufferGoal: 18, backBufferLength: 8 },
  };
  const VIDEO_QUALITY_PROFILES = {
    max: {
      main: { bufferGoal: 24, replayBufferGoal: 36, backBufferLength: 24 },
      onboard: { maxHeight: 720, maxBandwidth: 5500000, bufferGoal: 14, replayBufferGoal: 24, backBufferLength: 10 },
    },
    high: {
      main: { maxHeight: 1080, maxBandwidth: 12000000, bufferGoal: 20, replayBufferGoal: 32, backBufferLength: 20 },
      onboard: { maxHeight: 720, maxBandwidth: 4500000, bufferGoal: 12, replayBufferGoal: 20, backBufferLength: 10 },
    },
    medium: {
      main: { maxHeight: 1080, maxBandwidth: 8000000, bufferGoal: 16, replayBufferGoal: 28, backBufferLength: 14 },
      onboard: { maxHeight: 540, maxBandwidth: 2500000, bufferGoal: 8, replayBufferGoal: 16, backBufferLength: 6 },
    },
    low: {
      main: { maxHeight: 720, maxBandwidth: 5000000, bufferGoal: 12, replayBufferGoal: 24, backBufferLength: 10 },
      onboard: { maxHeight: 360, maxBandwidth: 1200000, bufferGoal: 6, replayBufferGoal: 12, backBufferLength: 4 },
    },
  };

  const STYLE_ID = "pw-live-styles";
  {
    let el = document.getElementById(STYLE_ID);
    if (!el) { el = document.createElement("style"); el.id = STYLE_ID; document.head.appendChild(el); }
    el.textContent = `
    .live { --live-window-controls-space: 96px; position: relative; display: flex; flex-direction: column; height: 100vh; background: var(--bg-app); color: var(--text-primary); font-family: var(--font-sans); overflow: hidden; }
    .live--fullscreen { --live-window-controls-space: 0px; }
    /* Window title bar */
    .live__bar { display: grid; grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr); align-items: center; column-gap: var(--space-7); height: 48px; padding: 0 var(--space-7) 0 max(var(--live-window-controls-space), var(--space-7)); background: var(--bg-base); border-bottom: 1px solid var(--border-subtle); flex: none; -webkit-app-region: drag; }
    .live__bar :is(button, select, input, a, [role="button"], .live__traffic, .preset-select-wrap, .live__syncwrap) { -webkit-app-region: no-drag; }
    .live__barleft { display: flex; align-items: center; gap: var(--space-7); min-width: 0; }
    .live__traffic { display: none; gap: 8px; flex: none; }
    .live--fullscreen .live__traffic { display: flex; }
    .live__traffic span { width: 12px; height: 12px; border-radius: 50%; }
    .live__brand { font-family: var(--font-display); font-weight: 800; font-size: 16px; letter-spacing: -0.01em; color: var(--text-strong); }
    .live__brand i { font-style: normal; color: var(--accent); }
    .live__race { display: flex; align-items: center; gap: var(--space-6); min-width: 0; font-size: var(--text-sm); color: var(--text-secondary); }
    .live__race-name { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .live__lap { font-family: var(--font-mono); font-weight: 600; color: var(--text-primary); }
    .live__presets { justify-self: center; display: flex; align-items: center; gap: var(--space-4); min-width: 0; }
    .preset-select-wrap { position: relative; display: inline-flex; align-items: center; min-width: 0; }
    .preset-select { appearance: none; -webkit-appearance: none; width: 178px; max-width: 28vw; height: 28px; padding: 0 34px 0 var(--space-5); border-radius: var(--radius-sm); background: var(--bg-sunken); border: 1px solid var(--border-default); color: var(--text-primary); font-family: var(--font-sans); font-size: var(--text-sm); font-weight: 600; cursor: pointer; white-space: nowrap; outline: 0; transition: var(--tr-control); }
    .preset-select:hover { background: var(--surface-hover); border-color: var(--border-strong); }
    .preset-select:focus { border-color: var(--accent-border); box-shadow: var(--glow-accent); }
    .preset-select option { color: var(--text-primary); background: var(--bg-base); }
    .preset-select__icon { position: absolute; right: 10px; color: var(--text-tertiary); pointer-events: none; }
    .live__barright { justify-self: end; display: flex; align-items: center; gap: var(--space-5); min-width: 0; }
    .live__syncwrap { position: relative; display: inline-flex; }
    .sync-menu { position: absolute; right: 0; top: calc(100% + 8px); z-index: 80; width: min(620px, calc(100vw - 28px)); display: flex; flex-direction: column; gap: var(--space-4); padding: var(--space-4); border-radius: var(--radius-sm); border: 1px solid var(--border-default); background: rgba(8,11,17,0.94); box-shadow: var(--shadow-lg); backdrop-filter: blur(12px); }
    .sync-menu__row { display: flex; align-items: center; gap: var(--space-4); }
    .sync-menu__timing { display: grid; grid-template-columns: repeat(5, minmax(92px, 1fr)); gap: var(--space-3); }
    .sync-menu__btn { appearance: none; -webkit-appearance: none; min-height: 30px; padding: 0 var(--space-4); border-radius: var(--radius-pill); border: 1px solid transparent; background: transparent; color: var(--text-secondary); font-family: var(--font-sans); font-size: var(--text-sm); font-weight: 800; white-space: nowrap; cursor: pointer; transition-property: color, background-color, border-color, transform; transition-duration: var(--dur-fast); transition-timing-function: var(--ease-standard); }
    .sync-menu__btn:hover { color: var(--text-primary); background: var(--surface-hover); }
    .sync-menu__btn:active { transform: scale(0.96); }
    .sync-menu__btn[data-active="true"] { color: var(--text-primary); border-color: var(--border-strong); background: var(--surface-raised); box-shadow: inset 0 1px 0 rgba(255,255,255,0.08); }
    .sync-menu__btn--box { border-radius: var(--radius-sm); border-color: var(--border-default); background: var(--bg-sunken); }

    /* Body: timing | grid | insights */
    .live__body { position: relative; flex: 1; display: grid; grid-template-columns: var(--timing-sidebar-w, 340px) minmax(0, 1fr); min-height: 0; }
    .live__preload { position: relative; flex: 1; min-height: 0; padding: 6px; background: var(--bg-app); }
    .live__preload .session-library--inline .session-library__panel { border: 1px solid var(--border-default); border-radius: var(--radius-md); }
    .live__body[data-layout="focus"] { grid-template-columns: minmax(0, 1fr) var(--timing-sidebar-w, 340px); }
    .live__body[data-layout="focus"] .live__timing { grid-column: 2; border-right: 0; border-left: 1px solid var(--border-subtle); }
    .live__body[data-layout="focus"] .live__center { grid-column: 1; grid-row: 1; }
    .live__body[data-layout="custom"] { grid-template-columns: minmax(0, 1fr); }
    .live__body[data-layout="custom"] .live__center { grid-column: 1; grid-row: 1; }
    .live__body[data-layout="theater"] { grid-template-columns: minmax(0, 1fr); }
    .live__body[data-layout="theater"] .live__center { grid-column: 1; grid-row: 1; }
    .live__body[data-layout="focus"][data-sidecar="true"] { grid-template-columns: minmax(0, 1fr) var(--sidecar-w, 300px) var(--timing-sidebar-w, 340px); }
    .live__body[data-layout="focus"][data-sidecar="true"] .live__timing { grid-column: 3; }
    .live__sidecar { position: relative; grid-column: 2; grid-row: 1; display: flex; flex-direction: column; gap: 6px; padding: 6px; min-height: 0; min-width: 0; background: var(--bg-app); border-left: 1px solid var(--border-subtle); }
    .live__sidecar .pane { flex: 1; min-height: 0; }
    .live__sidecarbar { flex: none; display: flex; align-items: center; gap: var(--space-3); padding: 0 var(--space-2); min-height: 24px; }
    .live__sidecarbar > span { flex: 1; color: var(--text-tertiary); font-size: 9px; font-weight: 800; text-transform: uppercase; letter-spacing: var(--tracking-caps); }
    .live__timing { position: relative; display: flex; flex-direction: column; background: var(--bg-base); border-right: 1px solid var(--border-subtle); min-height: 0; min-width: 0; container-type: inline-size; }
    .live__timinghd { display: grid; grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr); align-items: center; gap: var(--space-5); padding: var(--space-6) var(--space-7); border-bottom: 1px solid var(--border-subtle); }
    .live__timinghd--loading { grid-template-columns: 1fr; justify-items: center; }
    .live__timingloadingtitle { color: var(--text-strong); font-family: var(--font-display); font-size: 15px; font-weight: 800; letter-spacing: 0; line-height: 1; }
    .live__timingtitle { display: flex; align-items: center; gap: var(--space-5); min-width: 0; }
    .live__timingclockgroup { justify-self: center; display: inline-flex; align-items: baseline; gap: var(--space-4); min-width: 0; white-space: nowrap; }
    .live__timinglap { color: #f3f5f9; font-family: var(--font-mono); font-size: 17px; font-weight: 800; line-height: 0.95; letter-spacing: 0; font-variant-numeric: tabular-nums; }
    .live__timingclock { color: var(--accent); font-family: var(--font-mono); font-size: 18px; font-weight: 900; line-height: 1; white-space: nowrap; font-variant-numeric: tabular-nums; }
    .live__timingactions { display: flex; align-items: center; justify-content: flex-end; gap: var(--space-5); min-width: 0; }
    .live__timingscroll { flex: 1; overflow: auto; min-height: 0; scrollbar-width: none; -ms-overflow-style: none; }
    .live__timingscroll::-webkit-scrollbar { width: 0; height: 0; display: none; }
    .live__weather { display: flex; gap: var(--space-7); padding: var(--space-6) var(--space-7); border-top: 1px solid var(--border-subtle); }
    .live__wx { display: flex; align-items: center; gap: var(--space-4); font-size: var(--text-sm); color: var(--text-secondary); }
    .live__wx b { font-family: var(--font-mono); color: var(--text-primary); font-weight: 600; }
    .race-control { display: flex; flex-direction: column; gap: var(--space-4); width: 100%; min-width: 0; box-sizing: border-box; padding: var(--space-6) var(--space-7) var(--space-7); border-top: 1px solid var(--border-subtle); background: rgba(255,255,255,0.018); }
    .race-control__head { display: flex; align-items: center; gap: var(--space-4); color: var(--text-tertiary); font-family: var(--font-mono); font-size: var(--text-2xs); font-weight: 800; text-transform: uppercase; letter-spacing: var(--tracking-caps); }
    .race-control__list { display: flex; flex-direction: column; gap: var(--space-3); min-height: 0; }
    .race-control__msg { display: grid; grid-template-columns: auto minmax(0, 1fr); gap: var(--space-4); align-items: start; min-height: 28px; }
    .race-control__meta { display: inline-flex; align-items: center; gap: var(--space-3); min-width: 54px; color: var(--accent); font-family: var(--font-mono); font-size: var(--text-2xs); font-weight: 900; white-space: nowrap; }
    .race-control__text { min-width: 0; color: var(--text-secondary); font-size: var(--text-xs); line-height: 1.35; white-space: normal; overflow-wrap: anywhere; word-break: normal; }
    .race-control__tag { color: var(--text-tertiary); font-family: var(--font-mono); font-size: var(--text-2xs); text-transform: uppercase; }
    .timing-config { position: absolute; right: var(--space-6); top: 54px; z-index: 60; width: min(360px, calc(100vw - 28px)); max-height: min(520px, calc(100vh - 120px)); overflow: auto; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: var(--space-3); padding: var(--space-5); border-radius: var(--radius-md); border: 1px solid var(--border-default); background: var(--surface-overlay); box-shadow: var(--shadow-lg); }
    .timing-config__item { appearance: none; -webkit-appearance: none; display: flex; align-items: center; justify-content: flex-start; gap: var(--space-3); min-height: 28px; padding: 0 var(--space-4); border: 1px solid var(--border-subtle); border-radius: var(--radius-sm); background: var(--bg-sunken); color: var(--text-secondary); font-family: var(--font-sans); font-size: var(--text-xs); cursor: pointer; min-width: 0; }
    .timing-config__item[data-active="true"] { color: var(--text-primary); border-color: var(--accent-border); background: var(--accent-quiet); }
    .timing-status { min-height: 260px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: var(--space-5); padding: var(--space-8); color: var(--text-secondary); text-align: center; }
    .timing-status__icon { display: inline-grid; place-items: center; width: 38px; height: 38px; border-radius: 50%; border: 1px solid var(--border-default); color: var(--accent); background: var(--bg-sunken); }
    .timing-status[data-tone="loading"] .timing-status__icon { animation: pw-pulse-live 1.4s var(--ease-in-out) infinite; }
    .timing-status[data-tone="error"] .timing-status__icon { color: var(--danger); animation: none; }
    .timing-status__title { color: var(--text-primary); font-family: var(--font-display); font-size: var(--text-lg); font-weight: 800; line-height: 1; }
    .timing-status__body { max-width: 260px; color: var(--text-tertiary); font-size: var(--text-sm); line-height: 1.4; }
    .timing-tower { width: max-content; min-width: 100%; }
    .timing-tower__head, .timing-tower__row { display: grid; align-items: center; column-gap: var(--space-3); width: max-content; min-width: 100%; box-sizing: border-box; padding: 0 var(--space-2); }
    .timing-tower__head { position: sticky; top: 0; z-index: 4; height: 32px; background: var(--bg-base); border-bottom: 1px solid var(--border-default); color: var(--text-tertiary); font-size: 9px; font-weight: 800; text-transform: uppercase; letter-spacing: var(--tracking-caps); }
    .timing-tower__head > span, .timing-tower__row > span { min-width: 0; overflow: hidden; text-overflow: ellipsis; }
    .timing-tower__row { min-height: 40px; border-bottom: 1px solid var(--border-subtle); background: rgba(255,255,255,0.015); color: var(--text-primary); cursor: pointer; transform: translateZ(0); transition-property: background-color, border-color, box-shadow; transition-duration: var(--dur-fast); transition-timing-function: var(--ease-standard); }
    .timing-tower__row:hover { background: var(--surface-hover); }
    .timing-tower__row[data-selected="true"] { background: var(--accent-quiet); box-shadow: inset 3px 0 0 var(--accent); }
    .timing-tower__row[data-inactive="true"] { background: rgba(255,255,255,0.008); color: var(--text-tertiary); opacity: 0.58; }
    .timing-tower__row[data-inactive="true"]:hover { background: rgba(255,255,255,0.035); opacity: 0.72; }
    .timing-tower__row[data-inactive="true"] .tyre-dot { opacity: 0.58; }
    .timing-tower__row[data-elimination="true"] { background: linear-gradient(90deg, rgba(255,59,59,0.14), rgba(255,59,59,0.035)); box-shadow: inset 3px 0 0 rgba(255,95,95,0.62); }
    .timing-tower__row[data-elimination="true"]:hover { background: linear-gradient(90deg, rgba(255,59,59,0.18), rgba(255,59,59,0.055)); }
    .timing-tower__row[data-elimination="true"] .timing-driver__pos { color: #ff9a9a; }
    .timing-tower__row[data-moving="true"] { position: relative; z-index: 3; will-change: transform; box-shadow: 0 10px 24px rgba(0,0,0,0.28), inset 3px 0 0 var(--accent); }
    .timing-driver { display: grid; grid-template-columns: 22px minmax(42px, auto); align-items: center; column-gap: 6px; min-width: 0; }
    .timing-driver__pos { width: auto; color: var(--text-tertiary); font-family: var(--font-mono); font-weight: 800; text-align: right; font-variant-numeric: tabular-nums; }
    .timing-driver__code { display: inline-grid; place-items: center; min-width: 42px; height: 24px; padding: 0 var(--space-2); border-radius: var(--radius-sm); background: var(--driver-color, var(--accent)); color: #061017; font-family: var(--font-display); font-size: var(--text-sm); font-weight: 900; letter-spacing: 0.02em; transition-property: background-color, color; transition-duration: var(--dur-fast); transition-timing-function: var(--ease-standard); }
    .timing-cell { font-family: var(--font-mono); font-size: 13px; font-weight: 800; white-space: nowrap; font-variant-numeric: tabular-nums; transition-property: color, background-color; transition-duration: var(--dur-fast); transition-timing-function: var(--ease-standard); }
    .timing-cell--pill { display: inline-flex; justify-content: center; min-width: 58px; padding: 4px 7px; border-radius: var(--radius-pill); background: rgba(78,186,87,0.92); color: #061017; }
    .timing-cell--status { display: inline-flex; justify-content: center; min-width: 58px; padding: 4px 7px; border-radius: var(--radius-pill); background: rgba(235,51,64,0.95); color: #fff; box-shadow: inset 0 0 0 1px rgba(255,255,255,0.12); }
    .timing-cell--gap { color: var(--text-primary); }
    .mini-sector { display: inline-flex; align-items: center; gap: 1.5px; width: fit-content; min-width: 0; max-width: 100%; overflow: hidden; }
    .mini-sector__seg { width: 3px; height: 15px; border-radius: var(--radius-pill); background: rgba(255,255,255,0.24); transition-property: background-color, opacity; transition-duration: var(--dur-fast); transition-timing-function: var(--ease-standard); }
    .mini-sector__seg[data-tone="yellow"] { background: #ffd83d; }
    .mini-sector__seg[data-tone="green"] { background: #4eba57; }
    .mini-sector__seg[data-tone="purple"] { background: #b640d8; }
    .mini-sector__seg[data-tone="blue"] { background: #4c9bff; }
    .tyre-dot { display: inline-grid; place-items: center; width: 28px; height: 28px; border-radius: 50%; border: 3px solid var(--tyre-ring, var(--border-default)); color: var(--text-primary); font-family: var(--font-display); font-weight: 900; font-size: var(--text-sm); background: #070a0f; text-transform: uppercase; transition-property: border-color, color; transition-duration: var(--dur-fast); transition-timing-function: var(--ease-standard); }

    /* Center column: grid + insights */
    .live__center { position: relative; display: flex; flex-direction: column; min-width: 0; min-height: 0; }
    .live__grid { position: relative; flex: 1; display: grid; gap: 6px; padding: 6px; min-height: 0; background: var(--bg-app); }
    .live__grid[data-layout="focus"] { grid-template-columns: repeat(3, minmax(0, 1fr)); grid-template-rows: minmax(150px, var(--focus-onboard-h, 220px)) minmax(260px, 1fr); grid-template-areas: "ob1 ob2 ob3" "world world world"; }
    .live__grid[data-layout="focus"] .pane:not(.pane--bc) .pane__video { object-fit: contain; object-position: center bottom; }
    .live__grid[data-layout="focus"] .pane--bc .pane__video { object-position: center bottom; }
    .live__grid[data-layout="battle"] { grid-template-columns: minmax(0, var(--battle-a, 50%)) minmax(0, var(--battle-b, 50%)); grid-template-rows: 1fr; }
    .live__grid[data-layout="quad"] { grid-template-columns: minmax(0, var(--quad-col, 50%)) minmax(0, 1fr); grid-template-rows: minmax(0, var(--quad-row, 50%)) minmax(0, 1fr); }
    .live__grid[data-layout="data"] { grid-template-columns: minmax(0, var(--data-col-a, 33%)) minmax(0, var(--data-col-b, 33%)) minmax(0, 1fr); grid-template-rows: minmax(0, var(--data-row, 50%)) minmax(0, 1fr); }
    .live__grid[data-layout="custom"] { display: flex; flex-direction: column; }
    .live__grid[data-layout="theater"] { grid-template-columns: 1fr; grid-template-rows: 1fr; padding: 0; gap: 0; }
    .live__grid[data-layout="theater"] .pane--bc .pane__video { object-fit: contain; object-position: center center; }
    /* Theater: collapsible floating glass timing tower, bottom-right */
    .live__theater-timing { position: absolute; top: var(--space-7); right: var(--space-7); z-index: 8; width: min(360px, calc(100% - 32px)); max-height: min(62%, 620px); display: flex; flex-direction: column; border-radius: var(--radius-md); border: 1px solid var(--border-default); background: linear-gradient(180deg, rgba(20,26,36,0.86), rgba(8,11,17,0.84)); box-shadow: var(--shadow-lg); backdrop-filter: blur(16px); overflow: hidden; }
    .live__theater-timinghd { list-style: none; cursor: pointer; display: flex; align-items: center; justify-content: space-between; gap: var(--space-5); padding: var(--space-5) var(--space-6); color: var(--text-secondary); }
    .live__theater-timinghd::-webkit-details-marker { display: none; }
    .live__theater-timingttl { display: inline-flex; align-items: center; gap: var(--space-4); font-family: var(--font-display); font-weight: 800; font-size: 13px; letter-spacing: var(--tracking-caps); text-transform: uppercase; color: var(--text-strong); }
    .live__theater-timinghint { font-family: var(--font-mono); font-size: var(--text-2xs); color: var(--text-tertiary); text-transform: uppercase; letter-spacing: var(--tracking-caps); }
    .live__theater-timing[open] .live__theater-timinghint::after { content: "Collapse"; }
    .live__theater-timing:not([open]) .live__theater-timinghint::after { content: "Expand ›"; }
    .live__theater-timingbody { display: flex; flex-direction: column; min-height: 0; border-top: 1px solid var(--border-subtle); }
    .live__theater-timingbody .live__timinghd { padding: var(--space-5) var(--space-6); }
    .live__timinghd--compact { grid-template-columns: minmax(0, 1fr) auto; column-gap: var(--space-4); }
    .live__timinghd--compact .live__timingtitle { overflow: hidden; }
    .live__timinghd--compact .live__timingclockgroup { justify-self: end; }
    /* Theater overlays live in the broadcast pane's video region (above the ticker) */
    .pane__voverlay { position: absolute; left: 0; right: 0; top: 0; bottom: var(--ticker-total-h, 0px); z-index: 5; pointer-events: none; }
    .pane__voverlay > * { pointer-events: auto; }
    /* Theater overlays: top-left session info + bottom-left broadcast lower-third */
    .live__theater-info { position: absolute; top: var(--space-6); left: var(--space-6); z-index: 8; font-family: var(--font-mono); font-size: var(--text-2xs); color: var(--text-secondary); background: var(--scrim, rgba(8,11,17,0.62)); border: 1px solid var(--border-subtle); border-radius: var(--radius-xs); padding: 6px 9px; backdrop-filter: blur(6px); line-height: 1.5; }
    .live__theater-info b { color: var(--text-primary); font-weight: 700; }
    .live__lower3 { position: absolute; left: var(--space-6); bottom: var(--space-6); z-index: 8; display: flex; align-items: stretch; border-radius: var(--radius-sm); overflow: hidden; box-shadow: var(--shadow-lg); border: 1px solid var(--border-default); }
    .live__lower3-spine { width: 4px; flex: none; }
    .live__lower3-pos { color: #fff; font-family: var(--font-display); font-weight: 800; font-size: 22px; display: grid; place-items: center; padding: 0 12px; letter-spacing: 0.02em; }
    .live__lower3-body { background: rgba(11,13,18,0.82); backdrop-filter: blur(10px); padding: 8px 14px; display: flex; flex-direction: column; justify-content: center; }
    .live__lower3-name { font-family: var(--font-display); font-weight: 800; font-size: 15px; color: #fff; line-height: 1; }
    .live__lower3-meta { font-family: var(--font-mono); font-size: 9px; color: var(--text-tertiary); margin-top: 4px; letter-spacing: 0.04em; }
    /* Theater onboard picture-in-picture, bottom-right of the video. 16:9 frame filled
       with cover (same standard onboard crop as every other pane — no letterbox black). */
    .live__theater-pip { position: absolute; right: 14px; bottom: 14px; width: 30%; min-width: 260px; max-width: 460px; aspect-ratio: 16 / 9; z-index: 6; border: 1px solid var(--border-strong); border-radius: var(--radius-sm); overflow: hidden; box-shadow: var(--shadow-lg); background: #000; }
    .live__theater-pip .pane { position: absolute; inset: 0; }
    .live__theater-pip .pane__video { object-fit: cover; object-position: center center; }
    .live__theater-timingbody .live__timingscroll { max-height: 420px; }
    .custom-bar { display: inline-flex; align-items: center; gap: var(--space-3); margin-left: var(--space-3); }
    .custom-config-wrap { position: relative; display: inline-flex; }
    .custom-config { position: absolute; top: calc(100% + 8px); left: 0; z-index: 70; width: 260px; display: flex; flex-direction: column; gap: var(--space-4); padding: var(--space-5); border-radius: var(--radius-md); border: 1px solid var(--border-default); background: var(--surface-overlay); box-shadow: var(--shadow-lg); }
    .custom-config__field { display: flex; flex-direction: column; gap: 5px; }
    .custom-config__label { font-size: var(--text-2xs); font-weight: 800; text-transform: uppercase; letter-spacing: 0.1em; color: var(--text-tertiary); }
    .custom-config__name { height: 28px; padding: 0 var(--space-3); border-radius: var(--radius-sm); background: var(--bg-sunken); border: 1px solid var(--border-default); color: var(--text-primary); font-family: var(--font-sans); font-size: var(--text-sm); font-weight: 600; outline: 0; }
    .custom-config__name:focus { border-color: var(--accent-border); }
    .custom-config__actions { display: flex; flex-direction: column; gap: 4px; border-top: 1px solid var(--border-subtle); padding-top: var(--space-4); }
    .custom-config__actions .pw-btn { justify-content: flex-start; }
    .custom-canvas { position: relative; flex: 1; min-width: 0; min-height: 0; background: #000; overflow: hidden; }
    .custom-canvas__empty { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: var(--space-4); color: var(--text-tertiary); }
    .custom-tile { position: absolute; min-width: 0; min-height: 0; border: 1px solid var(--border-subtle); border-radius: var(--radius-sm); background: var(--bg-base); overflow: hidden; }
    .custom-tile[data-dragging="true"] { border-color: var(--accent-border); z-index: 4; }
    .custom-tile__head { position: absolute; top: 0; left: 0; right: 0; z-index: 6; display: flex; align-items: center; justify-content: space-between; gap: 6px; height: 26px; padding: 0 8px; font-size: var(--text-2xs); font-weight: 700; letter-spacing: 0.02em; color: var(--text-primary); background: #05080d; border-bottom: 1px solid var(--border-subtle); cursor: grab; user-select: none; opacity: 0; transition: opacity var(--dur-fast) var(--ease-standard); }
    .custom-tile[data-chrome="true"] .custom-tile__head, .custom-tile:focus-within .custom-tile__head, .custom-tile[data-dragging="true"] .custom-tile__head { opacity: 1; }
    .custom-tile__label { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .custom-tile__body { position: absolute; inset: 0; display: flex; flex-direction: column; min-width: 0; min-height: 0; }
    .custom-tile__body .pane { position: absolute; inset: 0; }
    .custom-tile__body .live__timing--tile { position: absolute; inset: 0; border-right: 0; border-left: 0; }
    .custom-tile__feed { position: relative; flex: 1; min-height: 0; min-width: 0; }
    .custom-feedticker { position: relative; flex: none; min-height: 0; background: linear-gradient(0deg, rgba(6,9,14,0.97), rgba(6,9,14,0.9)); border-top: 1px solid var(--border-default); }
    .custom-feedticker__resize { position: absolute; left: 0; right: 0; top: -4px; height: 9px; z-index: 7; cursor: row-resize; }
    .custom-feedticker__resize::after { content: ""; position: absolute; left: 18px; right: 18px; top: 3px; height: 2px; border-radius: var(--radius-pill); background: var(--accent); opacity: 0; transition: opacity var(--dur-fast) var(--ease-standard); }
    .custom-feedticker:hover .custom-feedticker__resize::after { opacity: 0.9; }
    .custom-feedticker__tools { position: absolute; top: 4px; right: 6px; z-index: 8; display: inline-flex; align-items: flex-start; gap: 4px; opacity: 0; transition: opacity var(--dur-fast) var(--ease-standard); }
    .custom-feedticker:hover .custom-feedticker__tools, .custom-feedticker:focus-within .custom-feedticker__tools { opacity: 1; }
    .custom-feedticker__cog { display: inline-grid; place-items: center; width: 22px; height: 22px; border-radius: var(--radius-xs); border: 1px solid var(--border-default); background: var(--scrim); color: var(--text-secondary); cursor: pointer; backdrop-filter: blur(6px); }
    .custom-feedticker__cog:hover { color: var(--text-primary); background: var(--surface-hover); }
    .custom-feedticker__menu { display: inline-flex; align-items: center; gap: 4px; padding: 4px 6px; border-radius: var(--radius-sm); border: 1px solid var(--border-default); background: var(--surface-overlay); box-shadow: var(--shadow-lg); }
    .custom-feedticker__menulabel { font-size: var(--text-2xs); font-weight: 800; text-transform: uppercase; letter-spacing: 0.08em; color: var(--text-tertiary); }
    .custom-feedticker__menu button { width: 22px; height: 22px; border-radius: var(--radius-xs); border: 1px solid var(--border-default); background: var(--bg-sunken); color: var(--text-primary); font-family: var(--font-mono); font-size: 11px; font-weight: 800; cursor: pointer; }
    .custom-feedticker__menu button[data-active="true"] { background: var(--accent); border-color: transparent; color: #fff; }
    .custom-feedticker__grid { display: grid; height: 100%; gap: 0; }
    .custom-feedticker__grid .tick { height: 100%; min-height: 0; border-bottom: 1px solid var(--border-subtle); }
    .custom-feedticker__grid .tick:nth-child(5n) { border-right: 0; }
    .custom-tile__handle { position: absolute; z-index: 7; }
    .custom-tile__handle--n { top: -3px; left: 8px; right: 8px; height: 6px; cursor: ns-resize; }
    .custom-tile__handle--s { bottom: -3px; left: 8px; right: 8px; height: 6px; cursor: ns-resize; }
    .custom-tile__handle--e { right: -3px; top: 8px; bottom: 8px; width: 6px; cursor: ew-resize; }
    .custom-tile__handle--w { left: -3px; top: 8px; bottom: 8px; width: 6px; cursor: ew-resize; }
    .custom-tile__handle--ne { top: -3px; right: -3px; width: 10px; height: 10px; cursor: nesw-resize; }
    .custom-tile__handle--sw { bottom: -3px; left: -3px; width: 10px; height: 10px; cursor: nesw-resize; }
    .custom-tile__handle--nw { top: -3px; left: -3px; width: 10px; height: 10px; cursor: nwse-resize; }
    .custom-tile__handle--se { bottom: -3px; right: -3px; width: 10px; height: 10px; cursor: nwse-resize; }
    .custom-picker { position: absolute; inset: 0; z-index: 60; display: grid; place-items: center; padding: 24px; background: rgba(3,5,8,0.62); backdrop-filter: blur(8px); }
    .custom-picker__panel { width: min(680px, calc(100vw - 48px)); max-height: min(660px, calc(100vh - 96px)); display: flex; flex-direction: column; border-radius: var(--radius-lg); border: 1px solid var(--border-default); background: var(--surface-overlay); box-shadow: var(--shadow-lg); overflow: hidden; }
    .custom-picker__head { display: flex; align-items: center; justify-content: space-between; padding: 14px 18px; border-bottom: 1px solid var(--border-subtle); }
    .custom-picker__title { font-size: var(--text-md); font-weight: 700; letter-spacing: -0.01em; color: var(--text-primary); }
    .custom-picker__body { overflow-y: auto; padding: 8px 18px 18px; }
    .custom-picker__group { margin-top: 16px; }
    .custom-picker__group:first-child { margin-top: 6px; }
    .custom-picker__grouptitle { padding: 4px 0 10px; font-size: var(--text-2xs); font-weight: 800; text-transform: uppercase; letter-spacing: 0.1em; color: var(--text-tertiary); }
    .custom-picker__grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(190px, 1fr)); gap: 8px; }
    .custom-picker__empty { padding: 12px 14px; border-radius: var(--radius-md); background: var(--bg-sunken); color: var(--text-tertiary); font-size: var(--text-sm); }
    .custom-picker__item { display: flex; align-items: center; gap: 10px; padding: 10px 12px; border: 1px solid var(--border-default); border-radius: var(--radius-md); background: var(--bg-base); color: var(--text-primary); font-family: var(--font-sans); font-size: var(--text-sm); text-align: left; cursor: pointer; transition: var(--tr-control); }
    .custom-picker__item:hover { background: var(--surface-hover); border-color: var(--border-strong); transform: translateY(-1px); }
    .custom-picker__item:disabled { opacity: 0.45; cursor: default; transform: none; }
    .custom-picker__item:disabled:hover { background: var(--bg-base); border-color: var(--border-default); }
    .custom-picker__num { flex: none; display: grid; place-items: center; width: 26px; height: 26px; border-radius: 7px; color: #fff; font-family: var(--font-mono); font-size: 11px; font-weight: 800; box-shadow: inset 0 0 0 1px rgba(255,255,255,0.18); }
    .custom-picker__icon { flex: none; display: grid; place-items: center; width: 26px; height: 26px; border-radius: 7px; background: var(--surface-hover); color: var(--text-secondary); }
    .custom-picker__itemtext { display: flex; flex-direction: column; min-width: 0; gap: 1px; }
    .custom-picker__itemlabel { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-weight: 600; }
    .custom-picker__itemsub { font-size: var(--text-2xs); color: var(--text-tertiary); font-family: var(--font-mono); }
    .custom-picker__placed { margin-left: auto; flex: none; font-size: var(--text-2xs); font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; color: var(--accent); }
    .live__grid[data-expanded="true"] { grid-template-columns: 1fr; grid-template-rows: 1fr; }
    .live__grid[data-expanded="true"] .pane { display: none; }
    .live__grid[data-expanded="true"] .pane[data-expanded="true"] { display: flex; }

    .pane { position: relative; container-type: inline-size; border-radius: var(--radius-md); overflow: hidden; background:
      linear-gradient(180deg, #10141b, #0a0d12); border: 1px solid var(--border-default); display: flex; flex-direction: column; min-height: 0; }
    .pane[data-visible="false"] { display: none !important; }
    .pane[data-focus="true"] { border-color: var(--accent-border); box-shadow: var(--glow-accent); }
    .pane__feed { position: absolute; inset: 0; background-image: var(--grad-carbon); opacity: 0.5; }
    .pane__scan { position: absolute; inset: 0; background: radial-gradient(120% 80% at 50% 0%, rgba(45,123,255,0.06), transparent 60%); }
    .pane__video { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; background: transparent; z-index: 1; opacity: 0; transform: scale(1.012); filter: saturate(0.86); transition-property: opacity, transform, filter; transition-duration: 260ms; transition-timing-function: cubic-bezier(0.2, 0, 0, 1); will-change: opacity, transform; }
    .pane__video[data-ready="true"] { opacity: 1; transform: scale(1); filter: none; }
    .pane__video[data-ready="false"] { pointer-events: none; }
    .pane--bc .pane__video { bottom: var(--ticker-total-h, 46px); height: calc(100% - var(--ticker-total-h, 46px)); }
    .pane--bc[data-noticker="true"] .pane__video { bottom: 0; height: 100%; }
    .pane--bc[data-noticker="true"] .pane__replaybar { bottom: var(--space-4); }
    .pane__playerstatus { position: absolute; left: var(--space-6); bottom: var(--space-6); z-index: 6; max-width: min(560px, calc(100% - 32px)); padding: var(--space-4) var(--space-5); border-radius: var(--radius-sm); border: 1px solid var(--border-default); background: rgba(8,11,17,0.92); color: var(--text-secondary); font-size: var(--text-xs); line-height: 1.35; backdrop-filter: blur(8px); pointer-events: none; }
    .pane--bc .pane__playerstatus { bottom: calc(var(--ticker-total-h, 46px) + var(--space-6)); max-width: min(760px, calc(100% - 32px)); }
    .pane__replaybar { position: absolute; left: var(--space-6); right: var(--space-6); bottom: calc(var(--ticker-total-h, 46px) + 10px); z-index: 4; display: grid; grid-template-columns: 40px minmax(0, 1fr) auto; align-items: center; gap: var(--space-6); min-height: 48px; padding: 6px 10px; border-radius: var(--radius-md); border: 1px solid color-mix(in srgb, var(--accent-border) 58%, var(--border-default)); background: linear-gradient(180deg, rgba(20,26,36,0.88), rgba(6,9,14,0.86)); box-shadow: 0 18px 42px rgba(0,0,0,0.34), inset 0 1px 0 rgba(255,255,255,0.08); backdrop-filter: blur(14px); opacity: 0; pointer-events: none; transform: translateY(10px); transition: opacity var(--dur-fast) var(--ease-standard), transform var(--dur-fast) var(--ease-standard); }
    .pane--bc:hover .pane__replaybar, .pane--bc:focus-within .pane__replaybar { opacity: 1; pointer-events: auto; transform: translateY(0); }
    .pane:not(.pane--bc) .pane__replaybar { left: var(--space-5); right: var(--space-5); bottom: var(--space-4); }
    .pane:not(.pane--bc):hover .pane__replaybar, .pane:not(.pane--bc):focus-within .pane__replaybar { opacity: 1; pointer-events: auto; transform: translateY(0); }
    .pane[data-replay="true"]:not(.pane--bc) .pane__controls { bottom: calc(var(--space-4) + 58px); }
    .pane__replayplay { appearance: none; -webkit-appearance: none; display: inline-grid; place-items: center; width: 40px; height: 40px; padding: 0; border-radius: var(--radius-sm); border: 1px solid color-mix(in srgb, var(--accent-border) 60%, var(--border-default)); background: linear-gradient(180deg, var(--surface-raised), var(--bg-sunken)); color: var(--text-primary); cursor: pointer; box-shadow: inset 0 1px 0 rgba(255,255,255,0.08), 0 10px 24px rgba(0,0,0,0.28); transition-property: transform, border-color, background, box-shadow; transition-duration: var(--dur-fast); transition-timing-function: var(--ease-standard); }
    .pane__replayplay:hover { border-color: var(--accent-border); background: linear-gradient(180deg, color-mix(in srgb, var(--accent) 18%, var(--surface-raised)), var(--bg-sunken)); box-shadow: inset 0 1px 0 rgba(255,255,255,0.10), 0 0 18px rgba(45,123,255,0.18), 0 12px 24px rgba(0,0,0,0.30); }
    .pane__replayplay:active { transform: scale(0.96); }
    .pane__replayplay svg { transform: translateX(1px); }
    .pane__replayplay[data-playing="true"] svg { transform: none; }
    .pane__replaytrack { position: relative; height: 40px; display: flex; align-items: center; min-width: 0; }
    .pane__replaytrack::before { content: ""; position: absolute; left: 0; right: 0; top: 50%; height: 8px; transform: translateY(-50%); border-radius: var(--radius-pill); background: linear-gradient(180deg, rgba(255,255,255,0.12), rgba(255,255,255,0.04)); box-shadow: inset 0 1px 2px rgba(0,0,0,0.74), inset 0 0 0 1px rgba(255,255,255,0.04); }
    .pane__replayfill { position: absolute; left: 0; top: 50%; height: 8px; transform: translateY(-50%); border-radius: var(--radius-pill); background: linear-gradient(90deg, var(--accent), color-mix(in srgb, var(--accent) 70%, #ffffff)); box-shadow: 0 0 16px rgba(45,123,255,0.38), inset 0 1px 0 rgba(255,255,255,0.24); pointer-events: none; }
    .pane__replaytrack input { appearance: none; -webkit-appearance: none; position: absolute; inset: 0; width: 100%; height: 40px; margin: 0; background: transparent; cursor: pointer; }
    .pane__replaytrack input::-webkit-slider-runnable-track { height: 8px; background: transparent; border: 0; }
    .pane__replaytrack input::-webkit-slider-thumb { -webkit-appearance: none; width: 18px; height: 18px; margin-top: -5px; border-radius: 50%; border: 2px solid rgba(236,242,255,0.94); background: radial-gradient(circle at 35% 30%, #ffffff, color-mix(in srgb, var(--accent) 72%, #ffffff) 38%, var(--accent) 100%); box-shadow: 0 0 0 4px rgba(45,123,255,0.16), 0 4px 14px rgba(0,0,0,0.55); }
    .pane__replaytrack input::-moz-range-track { height: 8px; background: transparent; border: 0; }
    .pane__replaytrack input::-moz-range-thumb { width: 18px; height: 18px; border-radius: 50%; border: 2px solid rgba(236,242,255,0.94); background: var(--accent); box-shadow: 0 0 0 4px rgba(45,123,255,0.16), 0 4px 14px rgba(0,0,0,0.55); }
    .pane__replaytime { font-family: var(--font-mono); font-size: var(--text-xs); color: var(--text-secondary); white-space: nowrap; font-variant-numeric: tabular-nums; min-width: 104px; text-align: right; }
    .pane__streamready { display: flex; flex-direction: column; align-items: center; gap: var(--space-5); color: var(--text-tertiary); text-align: center; }
    .pane__streamready b { font-family: var(--font-display); font-size: var(--text-lg); color: var(--text-primary); letter-spacing: 0.04em; }
    .pane__driverimg { max-height: 82%; max-width: 72%; object-fit: contain; filter: drop-shadow(0 20px 40px rgba(0,0,0,0.42)); opacity: 0.82; }
    .pane__top { position: relative; display: flex; align-items: center; gap: var(--space-5); padding: var(--space-5) var(--space-6); z-index: 4; }
    .pane:not(.pane--bc) .pane__top { position: absolute; top: 0; left: 0; right: 0; pointer-events: none; }
    .pane:not(.pane--bc) .pane__tag, .pane:not(.pane--bc) .pane__driverselect, .pane:not(.pane--bc) .pane__feedlabel { pointer-events: auto; }
    .pane__tag { display: flex; align-items: center; gap: var(--space-4); background: var(--scrim); backdrop-filter: blur(6px); border: 1px solid var(--border-default); border-radius: var(--radius-pill); padding: 3px 10px 3px 4px; }
    .pane__tagcode { font-weight: 700; font-size: 13px; font-family: var(--font-display); }
    .pane__pos { font-family: var(--font-mono); font-size: 10px; font-weight: 800; color: var(--accent); letter-spacing: 0.04em; }
    .pane__feedlabel { font-size: var(--text-2xs); color: var(--text-tertiary); background: var(--scrim); padding: 2px 8px; border-radius: var(--radius-pill); margin-left: auto; backdrop-filter: blur(6px); }
    .pane__driverselect { position: relative; z-index: 3; max-width: min(150px, 42%); height: 26px; border-radius: var(--radius-pill); border: 1px solid var(--border-default); background: rgba(8,11,17,0.82); color: var(--text-primary); padding: 0 24px 0 9px; font-family: var(--font-display); font-size: 12px; font-weight: 700; outline: 0; cursor: pointer; }
    .pane:not(.pane--bc) .pane__driverselect { opacity: 0; pointer-events: none; transition: opacity var(--dur-fast) var(--ease-standard); }
    .pane:not(.pane--bc) .pane__feedlabel { opacity: 0; pointer-events: none; transition: opacity var(--dur-fast) var(--ease-standard); }
    .pane:not(.pane--bc):hover .pane__driverselect, .pane:not(.pane--bc):focus-within .pane__driverselect { opacity: 1; pointer-events: auto; }
    .pane:not(.pane--bc):hover .pane__feedlabel, .pane:not(.pane--bc):focus-within .pane__feedlabel { opacity: 1; pointer-events: auto; }
    .pane__driverselect:hover { border-color: var(--accent-border); background: var(--surface-hover); }
    .pane__mid { flex: 1; display: grid; place-items: center; position: relative; z-index: 1; transition-property: opacity, transform, filter; transition-duration: 220ms; transition-timing-function: cubic-bezier(0.2, 0, 0, 1); }
    .pane:not(.pane--bc) .pane__mid { position: absolute; inset: 0; }
    .pane[data-streaming="true"] .pane__mid { position: absolute; inset: 0; padding: var(--space-8); z-index: 2; overflow: hidden; background: radial-gradient(84% 72% at 50% 38%, rgba(45,123,255,0.16), rgba(10,14,21,0.68) 54%, rgba(3,5,8,0.94)); pointer-events: none; }
    .pane[data-stream-ready="true"][data-streaming="true"] .pane__mid { opacity: 0; transform: scale(0.985); filter: blur(4px); }
    .pane__streamveil { position: absolute; inset: 0; background: linear-gradient(135deg, rgba(255,255,255,0.035), transparent 32%, rgba(45,123,255,0.10) 62%, transparent); opacity: 0.9; }
    .pane__streamveil::after { content: ""; position: absolute; top: -12%; bottom: -12%; left: -38%; width: 34%; transform: skewX(-18deg); background: linear-gradient(90deg, transparent, rgba(255,255,255,0.20), transparent); animation: pw-stream-warm 1150ms cubic-bezier(0.2, 0, 0, 1) infinite; }
    .pane__switching { position: absolute; left: var(--space-6); bottom: var(--space-6); display: flex; align-items: baseline; gap: var(--space-4); padding: 5px 9px; border-radius: var(--radius-pill); border: 1px solid rgba(255,255,255,0.10); background: rgba(8,11,17,0.72); color: var(--text-secondary); font-size: var(--text-2xs); text-transform: uppercase; letter-spacing: var(--tracking-caps); backdrop-filter: blur(10px); }
    .pane__switching b { font-family: var(--font-display); color: var(--text-primary); letter-spacing: 0.04em; }
    @keyframes pw-stream-warm { from { transform: translateX(0) skewX(-18deg); opacity: 0; } 20% { opacity: 0.58; } to { transform: translateX(390%) skewX(-18deg); opacity: 0; } }
    .pane__car { font-family: var(--font-display); font-weight: 800; font-size: 62px; color: rgba(255,255,255,0.05); letter-spacing: -0.02em; }
    /* ===== Onboard live stats — Multiviewer Bar (variant E) ================
       Full-bleed timing strip pinned to the onboard's top edge. Every
       dimension is a multiple of --u, a single scaling unit: --u = min(1cqw,
       CAP). Below CAP*100px wide it equals 1cqw, so the whole bar scales down
       with the onboard; past the threshold --u freezes at CAP, content stops
       growing, and the flexible .obE__spacer absorbs the slack — opening empty
       space between the timing block and the mini-sectors. The .pane ancestor
       supplies the container-query context (container-type: inline-size). */
    .pane:not(.pane--bc) .pane__obar { position: absolute; top: 0; left: 0; right: 0; z-index: 3; pointer-events: none; font-family: var(--font-sans); }
    .pane[data-telemetry="true"]:not(.pane--bc) .pane__tag { display: none; }
    .obE { --u: min(0.92cqw, 7.6px); }
    .obE__bar { position: relative; display: flex; align-items: stretch; width: 100%; gap: calc(var(--u) * 1.6); padding: calc(var(--u) * 1.1) calc(var(--u) * 1.4) calc(var(--u) * 1.5); box-sizing: border-box; overflow: hidden; background: linear-gradient(180deg, rgba(10,13,19,0.93), rgba(6,8,13,0.97)); border-bottom: max(1px, calc(var(--u) * 0.12)) solid var(--line-2); box-shadow: 0 calc(var(--u) * 0.6) calc(var(--u) * 2.4) rgba(0,0,0,0.5); backdrop-filter: blur(calc(var(--u) * 1.4)); font-variant-numeric: tabular-nums; }
    .obE__div { width: max(1px, calc(var(--u) * 0.1)); align-self: stretch; margin: calc(var(--u) * 0.2) 0; background: var(--line-2); flex: none; }
    .obE__id { display: flex; align-items: stretch; border-radius: calc(var(--u) * 0.7); overflow: hidden; box-shadow: inset 0 0 0 1px rgba(255,255,255,0.08); flex: none; }
    .obE__pos { font-family: var(--font-mono); font-weight: 700; color: #fff; background: var(--c, var(--accent)); display: grid; place-items: center; padding: 0 calc(var(--u) * 1.5); font-size: calc(var(--u) * 3.4); line-height: 1; min-width: calc(var(--u) * 5); font-variant-numeric: tabular-nums; }
    .obE__code { font-family: var(--font-display); font-weight: 800; color: #fff; background: color-mix(in srgb, var(--c, var(--accent)) 70%, #000); box-shadow: inset calc(var(--u) * 0.12) 0 0 rgba(0,0,0,0.28); display: grid; place-items: center; padding: 0 calc(var(--u) * 1.5); font-size: calc(var(--u) * 3.2); letter-spacing: 0.01em; }
    .obE__drive { display: flex; align-items: center; gap: calc(var(--u) * 1.2); flex: none; }
    .obE__gear { position: relative; width: calc(var(--u) * 5.2); height: calc(var(--u) * 5.2); flex: none; display: grid; place-items: center; }
    .obE__gear::before { content: ""; position: absolute; inset: 0; border-radius: 50%; border: calc(var(--u) * 0.45) solid rgba(255,255,255,0.12); border-top-color: rgba(255,255,255,0.28); border-right-color: rgba(255,255,255,0.22); }
    .obE__gearChar { font-family: var(--font-display); font-weight: 800; font-size: calc(var(--u) * 2.9); color: rgba(255,255,255,0.92); line-height: 1; }
    .obE__speed { display: flex; flex-direction: column; align-items: flex-start; line-height: 0.9; }
    .obE__speed b { font-family: var(--font-mono); font-weight: 700; font-size: calc(var(--u) * 4.4); color: #fff; letter-spacing: -0.01em; }
    .obE__speed span { font-size: calc(var(--u) * 1.15); font-weight: 700; letter-spacing: var(--tracking-caps); text-transform: uppercase; color: var(--text-tertiary); margin-top: calc(var(--u) * 0.3); }
    .obE__stack { display: flex; flex-direction: column; justify-content: center; gap: calc(var(--u) * 0.55); flex: none; }
    .obE__line { display: flex; align-items: baseline; gap: calc(var(--u) * 0.9); }
    .obE__lk { font-size: calc(var(--u) * 1.15); font-weight: 700; letter-spacing: var(--tracking-caps); text-transform: uppercase; color: var(--text-tertiary); width: calc(var(--u) * 3.4); flex: none; }
    .obE__lv { font-family: var(--font-mono); font-weight: 600; font-size: calc(var(--u) * 2.5); color: var(--text-strong); line-height: 1; font-variant-numeric: tabular-nums; transition: color var(--dur-fast) var(--ease-standard); }
    .obE__lv--sm { font-size: calc(var(--u) * 2.2); color: var(--text-secondary); }
    .obE__lv[data-tone="personal"], .obE__lv[data-tone="drs"] { color: var(--t-personal); }
    .obE__lv[data-tone="fastest"] { color: var(--t-fastest); }
    .obE__spacer { flex: 1 1 auto; min-width: calc(var(--u) * 0.5); }
    .obE__perf { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: calc(var(--u) * 0.7); flex: none; }
    .obE__mini { display: flex; gap: calc(var(--u) * 1); }
    .obE__miniGroup { display: flex; gap: calc(var(--u) * 0.22); }
    .obE__seg { width: calc(var(--u) * 0.7); height: calc(var(--u) * 1.7); border-radius: calc(var(--u) * 0.16); background: rgba(255,255,255,0.09); }
    .obE__seg[data-tone="yellow"] { background: var(--t-slower); box-shadow: 0 0 calc(var(--u) * 0.7) rgba(255,210,61,0.5); }
    .obE__seg[data-tone="green"] { background: var(--t-personal); box-shadow: 0 0 calc(var(--u) * 0.7) rgba(43,208,122,0.55); }
    .obE__seg[data-tone="purple"] { background: var(--t-fastest); box-shadow: 0 0 calc(var(--u) * 0.7) rgba(177,92,255,0.6); }
    .obE__seg[data-tone="live"], .obE__seg[data-tone="blue"] { background: var(--info); box-shadow: 0 0 calc(var(--u) * 0.9) rgba(89,176,255,0.85); }
    .obE__sectors { display: flex; flex-direction: column; gap: calc(var(--u) * 0.35); }
    .obE__secRow { display: grid; grid-template-columns: repeat(3, calc(var(--u) * 6.4)); gap: calc(var(--u) * 0.6); justify-items: center; }
    .obE__sec { font-family: var(--font-mono); font-weight: 600; font-size: calc(var(--u) * 1.75); line-height: 1; color: var(--text-secondary); font-variant-numeric: tabular-nums; }
    .obE__sec--best { color: var(--text-tertiary); }
    .obE__tyre { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: calc(var(--u) * 0.25); flex: none; }
    .obE__tyreC { width: calc(var(--u) * 4.2); height: calc(var(--u) * 4.2); border-radius: 50%; border: calc(var(--u) * 0.42) solid var(--ty, var(--border-default)); color: #fff; display: grid; place-items: center; font-family: var(--font-display); font-weight: 800; font-size: calc(var(--u) * 2.2); line-height: 1; }
    .obE__tyreAge { font-family: var(--font-mono); font-weight: 700; font-size: calc(var(--u) * 1.5); color: var(--text-secondary); }
    .obE__pedals { position: absolute; left: 0; right: 0; bottom: 0; height: calc(var(--u) * 0.55); background: rgba(255,255,255,0.06); }
    .obE__pedals .thr { position: absolute; left: 0; bottom: 0; height: 100%; background: linear-gradient(90deg, color-mix(in srgb, var(--throttle) 55%, #000), var(--throttle)); box-shadow: 0 0 calc(var(--u) * 0.7) rgba(43,208,122,0.5); transition: width 90ms linear; }
    .obE__pedals .brk { position: absolute; left: 0; bottom: 0; height: 100%; background: linear-gradient(90deg, color-mix(in srgb, var(--brake) 60%, #000), var(--brake)); box-shadow: 0 0 calc(var(--u) * 0.7) rgba(255,59,59,0.55); transition: width 70ms linear; }
    @media (max-width: 1600px) {
      .live__bar { grid-template-columns: minmax(0, 1fr) auto auto; column-gap: var(--space-4); padding: 0 var(--space-5) 0 max(var(--live-window-controls-space), var(--space-5)); }
      .live__barleft { gap: var(--space-5); }
      .live__brand { font-size: 14px; }
      .live__race { gap: var(--space-4); }
      .live__race-name { max-width: 120px; }
      .live__presets { gap: var(--space-3); }
      .preset-select { width: 150px; max-width: 22vw; }
      .live__barright { gap: var(--space-3); }
      .live__barright .pw-btn { position: relative; min-width: var(--size-control-sm); }
      .live__barright .pw-btn--sm { padding: 0 var(--space-4); }
      .live__barright .pw-btn > span:not(.pw-btn__spinner) { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
    }
    @media (max-width: 1180px) {
      .live__grid[data-layout="focus"] { grid-template-rows: minmax(120px, clamp(120px, 22vh, 180px)) minmax(320px, 1fr); }
      .live__grid[data-layout="focus"] .pane--bc .pane__video { object-fit: contain; object-position: center center; }
    }
    @media (max-width: 980px) {
      .live__race-name { display: none; }
      .preset-select { width: 132px; }
    }
    @container (max-width: 380px) {
      .live__timinghd { grid-template-columns: minmax(0, 1fr) auto; grid-template-areas: "title actions" "clock clock"; row-gap: var(--space-4); padding: var(--space-5) var(--space-6); }
      .live__timingtitle { grid-area: title; }
      .live__timingclockgroup { grid-area: clock; justify-self: start; gap: var(--space-3); }
      .live__timingactions { grid-area: actions; gap: var(--space-3); }
      .live__timinglap { font-size: 15px; }
      .live__timingclock { font-size: 16px; }
      .live__weather { gap: var(--space-4); padding: var(--space-5) var(--space-6); }
    }
    @container (max-width: 620px) {
      .pane:not(.pane--bc) .pane__top { padding: var(--space-4); }
      .pane:not(.pane--bc) .pane__tag { gap: var(--space-3); padding: 2px 8px 2px 3px; }
      .pane:not(.pane--bc) .pane__tag .pw-avatar { --_s: 22px; }
      .pane:not(.pane--bc) .pane__tag .pw-avatar__num { min-width: 13px; height: 13px; font-size: 8px; }
      .pane:not(.pane--bc) .pane__pos { font-size: 9px; }
      .pane:not(.pane--bc) .pane__tagcode { font-size: 12px; }
    }
    @container (max-width: 500px) {
      .pane:not(.pane--bc) .pane__tag .pw-avatar { --_s: 20px; }
      .pane:not(.pane--bc) .pane__pos { font-size: 8px; }
      .pane:not(.pane--bc) .pane__tagcode { font-size: 11px; }
    }
    .pane__controls { position: absolute; top: var(--space-5); right: var(--space-6); z-index: 5; display: flex; align-items: center; gap: 4px; opacity: 0; transition: opacity var(--dur-fast) var(--ease-standard); }
    .pane:not(.pane--bc) .pane__controls { top: auto; bottom: var(--space-5); }
    /* F1 TV feed in a custom tile: drop the volume/16:9 controls to the bottom-right, above the scrub bar, instead of over the top of the feed. */
    .custom-tile .pane--bc .pane__controls { top: auto; bottom: var(--space-5); }
    .custom-tile .pane--bc[data-replay="true"] .pane__controls { bottom: calc(var(--space-4) + 58px); }
    .pane__controls .pane__driverselect { opacity: 1; pointer-events: auto; }
    .pane:hover .pane__controls, .pane:focus-within .pane__controls { opacity: 1; }
    .pane__ctl { appearance: none; -webkit-appearance: none; display: inline-grid; place-items: center; width: 26px; height: 26px; padding: 0; border-radius: var(--radius-xs); background: var(--scrim); backdrop-filter: blur(6px); color: var(--text-secondary); cursor: pointer; border: 1px solid var(--border-default); }
    .pane__ctl:hover { color: var(--text-primary); background: var(--surface-hover); }
    .pane__ctl[data-active="true"] { color: #fff; background: var(--accent); border-color: transparent; }
    .pane__volume { display: inline-grid; grid-template-columns: 26px 78px 34px; align-items: center; gap: 5px; height: 26px; padding-right: 7px; border-radius: var(--radius-xs); border: 1px solid var(--border-default); background: var(--scrim); color: var(--text-secondary); backdrop-filter: blur(6px); }
    .pane__volume[data-active="true"] { color: var(--text-primary); border-color: var(--accent-border); }
    .pane__volume .pane__ctl { border: 0; background: transparent; backdrop-filter: none; }
    .pane__volume input { appearance: none; -webkit-appearance: none; width: 78px; height: 18px; margin: 0; background: transparent; cursor: pointer; }
    .pane__volume input::-webkit-slider-runnable-track { height: 4px; border-radius: var(--radius-pill); background: rgba(255,255,255,0.18); }
    .pane__volume input::-webkit-slider-thumb { -webkit-appearance: none; width: 13px; height: 13px; margin-top: -4.5px; border-radius: 50%; border: 2px solid rgba(236,242,255,0.94); background: var(--accent); box-shadow: 0 0 0 3px rgba(45,123,255,0.14), 0 3px 10px rgba(0,0,0,0.48); }
    .pane__volume input::-moz-range-track { height: 4px; border-radius: var(--radius-pill); background: rgba(255,255,255,0.18); }
    .pane__volume input::-moz-range-thumb { width: 13px; height: 13px; border-radius: 50%; border: 2px solid rgba(236,242,255,0.94); background: var(--accent); box-shadow: 0 0 0 3px rgba(45,123,255,0.14), 0 3px 10px rgba(0,0,0,0.48); }
    .pane__volume-level { width: 34px; color: var(--text-tertiary); font-family: var(--font-mono); font-size: 10px; font-weight: 800; text-align: right; font-variant-numeric: tabular-nums; }
    .sync-overlay { position: absolute; left: var(--space-6); top: 48px; z-index: 4; width: min(260px, calc(100% - 24px)); display: flex; flex-direction: column; gap: var(--space-4); padding: var(--space-5); border-radius: var(--radius-sm); border: 1px solid var(--border-default); background: rgba(8,11,17,0.86); color: var(--text-secondary); backdrop-filter: blur(10px); box-shadow: var(--shadow-md); }
    .sync-overlay__top { display: flex; align-items: center; justify-content: space-between; gap: var(--space-5); color: var(--text-primary); font-size: var(--text-xs); font-weight: 700; text-transform: uppercase; letter-spacing: var(--tracking-caps); }
    .sync-overlay__grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: var(--space-4); }
    .sync-overlay__metric { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
    .sync-overlay__metric b { font-family: var(--font-mono); color: var(--text-primary); font-size: var(--text-sm); font-weight: 600; }
    .sync-overlay__metric span { color: var(--text-tertiary); font-size: 9px; text-transform: uppercase; letter-spacing: 0.06em; }
    .sync-overlay__buttons { display: grid; grid-template-columns: repeat(5, 1fr); gap: var(--space-3); }
    .sync-overlay__buttons button { height: 24px; border-radius: var(--radius-xs); border: 1px solid var(--border-default); background: var(--surface-raised); color: var(--text-secondary); font-family: var(--font-mono); font-size: 10px; cursor: pointer; }
    .sync-overlay__buttons button:hover { color: var(--text-primary); border-color: var(--accent-border); }
    .sync-overlay__note { color: var(--text-tertiary); font-size: var(--text-xs); line-height: 1.35; }

    /* Broadcast / world feed pane */
    .pane--bc { background: linear-gradient(180deg, #0c1622, #070b12); border-color: var(--border-strong); }
    .pane--bc[data-focus="true"] { border-color: var(--accent-border); box-shadow: var(--glow-accent); }
    .pane__bcwash { position: absolute; inset: 0; background:
      radial-gradient(80% 60% at 50% 30%, rgba(45,123,255,0.10), transparent 70%),
      repeating-linear-gradient(0deg, rgba(255,255,255,0.015) 0 1px, transparent 1px 3px); }
    .pane__tag--bc { background: var(--live); border-color: transparent; padding: 4px 11px; color: #fff; }
    .pane__bclive { width: 7px; height: 7px; border-radius: 50%; background: #fff; animation: pw-pulse-live 1.4s var(--ease-in-out) infinite; }
    .pane__feedlabel--bc { display: inline-flex; align-items: center; gap: 5px; color: var(--text-secondary); }
    .pane--bc .pane__tag--bc, .pane--bc .pane__bcbug, .pane--bc .pane__feedlabel--bc { opacity: 0; pointer-events: none; transition: opacity var(--dur-fast) var(--ease-standard); }
    .pane--bc:hover .pane__tag--bc, .pane--bc:focus-within .pane__tag--bc,
    .pane--bc:hover .pane__bcbug, .pane--bc:focus-within .pane__bcbug,
    .pane--bc:hover .pane__feedlabel--bc, .pane--bc:focus-within .pane__feedlabel--bc { opacity: 1; pointer-events: auto; }
    .pane__bcwm { font-family: var(--font-display); font-weight: 800; font-size: 56px; color: rgba(255,255,255,0.05); letter-spacing: 0.08em; }
    .pane__bcbug { margin-left: auto; z-index: 2; display: inline-flex; align-items: center; gap: var(--space-4); padding: 4px 9px; border-radius: var(--radius-sm); background: var(--scrim); backdrop-filter: blur(6px); border: 1px solid var(--border-default); }
    .pane__bcbug-flag { width: 10px; height: 10px; border-radius: 3px; background: var(--flag-green); box-shadow: 0 0 8px color-mix(in srgb, var(--flag-green) 60%, transparent); flex: none; }
    .pane__bcbug-lap { font-family: var(--font-mono); font-weight: 600; font-size: var(--text-xs); color: var(--text-primary); white-space: nowrap; }
    .pane__bcbug-lap i { color: var(--text-tertiary); font-style: normal; }
    .pane__feedlabel--bc { display: inline-flex; align-items: center; gap: 5px; color: var(--text-secondary); }
    .pane__ticker-resize { position: absolute; left: 0; right: 0; bottom: calc(var(--ticker-total-h, 46px) - 5px); z-index: 7; height: 10px; appearance: none; -webkit-appearance: none; padding: 0; border: 0; background: transparent; cursor: row-resize; }
    .pane__ticker-resize::after { content: ""; position: absolute; left: 18px; right: 18px; top: 4px; height: 2px; border-radius: var(--radius-pill); background: var(--accent); opacity: 0; transition: opacity var(--dur-fast) var(--ease-standard); }
    .pane__ticker-resize:hover::after, .pane__ticker-resize:focus-visible::after { opacity: 1; }
    .pane__ticker { position: relative; z-index: 2; display: flex; flex: none; gap: 0; height: var(--ticker-total-h, 46px); background: linear-gradient(0deg, rgba(6,9,14,0.96), rgba(6,9,14,0.82)); border-top: 1px solid var(--border-default); box-sizing: border-box; }
    .pane__ticker--rows2, .pane__ticker--top15 { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); grid-auto-rows: var(--ticker-row-h, 34px); }
    .tick { flex: 1; display: flex; align-items: center; gap: var(--space-5); height: var(--ticker-row-h, 46px); padding: 0 var(--space-6); border-right: 1px solid var(--border-subtle); min-width: 0; box-sizing: border-box; }
    .pane__ticker--rows2 .tick, .pane__ticker--top15 .tick { height: var(--ticker-row-h, 34px); border-bottom: 1px solid var(--border-subtle); }
    .pane__ticker--rows2 .tick:nth-child(5n), .pane__ticker--top15 .tick:nth-child(5n) { border-right: 0; }
    .pane__ticker--rows2 .tick:nth-last-child(-n + 5), .pane__ticker--top15 .tick:nth-last-child(-n + 5) { border-bottom: 0; }
    .tick:last-child { border-right: 0; }
    .tick__bar { width: 3px; align-self: stretch; min-height: 18px; margin: 7px 0; border-radius: var(--radius-pill); flex: none; }
    .tick__main { display: grid; grid-template-columns: minmax(0, auto) minmax(0, 1fr); align-items: baseline; column-gap: var(--space-4); min-width: 0; width: 100%; }
    .tick__row { display: flex; align-items: baseline; gap: var(--space-3); }
    .tick__detail { justify-self: end; display: inline-flex; align-items: center; gap: 7px; min-width: 0; }
    .tick__tyre { display: inline-flex; align-items: center; justify-content: center; min-width: 28px; height: 17px; padding: 0 6px; border-radius: var(--radius-pill); border: 1px solid var(--tyre-ring, var(--border-default)); background: rgba(255,255,255,0.035); color: var(--text-secondary); font-family: var(--font-mono); font-size: 9px; font-weight: 800; line-height: 1; white-space: nowrap; }
    .tick__pos { font-family: var(--font-mono); font-weight: 700; font-size: var(--ticker-meta-size, 10px); color: var(--text-tertiary); flex: none; }
    .tick__code { font-family: var(--font-display); font-weight: 700; font-size: var(--ticker-code-size, var(--text-sm)); color: var(--text-primary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .tick__gap { justify-self: end; font-family: var(--font-mono); font-size: var(--ticker-meta-size, 10px); color: var(--text-tertiary); font-variant-numeric: tabular-nums; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

    /* Insights pane (bottom) */
    .live__insights { height: var(--insights-h, 280px); border-top: 1px solid var(--border-subtle); background: var(--bg-base); display: grid; grid-template-columns: 1.4fr 1fr; min-height: 0; flex: none; }
    .live__insights--popup { width: min(1040px, calc(100vw - 72px)); height: min(620px, calc(100vh - 96px)); border: 1px solid var(--border-default); border-radius: var(--radius-md); overflow: hidden; box-shadow: var(--shadow-lg); }
    .ins__feed { display: flex; flex-direction: column; min-height: 0; border-right: 1px solid var(--border-subtle); }
    .ins__hd { display: flex; align-items: center; gap: var(--space-5); padding: var(--space-6) var(--space-7); border-bottom: 1px solid var(--border-subtle); }
    .ins__hd h3 { font-size: var(--text-sm); font-weight: 600; margin: 0; color: var(--text-primary); display: flex; align-items: center; gap: var(--space-4); }
    .ins__list { flex: 1; overflow-y: auto; padding: var(--space-6); display: flex; flex-direction: column; gap: var(--space-5); min-height: 0; }
    .insight { display: flex; gap: var(--space-6); padding: var(--space-6); border-radius: var(--radius-sm); background: var(--surface-card); border: 1px solid var(--border-subtle); }
    .insight[data-kind="battle"] { border-color: var(--accent-border); background: linear-gradient(180deg, var(--accent-soft), var(--surface-card)); }
    .insight__icon { display: inline-grid; place-items: center; width: 30px; height: 30px; border-radius: var(--radius-sm); flex: none; background: var(--accent-quiet); color: var(--accent); }
    .insight__t { font-size: var(--text-md); font-weight: 600; color: var(--text-primary); margin-bottom: 3px; display: flex; align-items: center; gap: var(--space-5); }
    .insight__b { font-size: var(--text-sm); color: var(--text-secondary); line-height: 1.4; text-wrap: pretty; }
    .insight__conf { font-family: var(--font-mono); font-size: var(--text-2xs); color: var(--text-tertiary); }
    .insight__actions { display: flex; gap: var(--space-4); margin-top: var(--space-5); }

    .ins__chat { display: flex; flex-direction: column; min-height: 0; }
	    .ins__msgs { flex: 1; overflow-y: auto; padding: var(--space-6); display: flex; flex-direction: column; gap: var(--space-5); min-height: 0; }
	    .msg { font-size: var(--text-sm); line-height: 1.42; max-width: 92%; padding: var(--space-5) var(--space-6); border-radius: var(--radius-md); }
	    .msg--ai { background: var(--surface-card); border: 1px solid var(--border-subtle); color: var(--text-secondary); align-self: flex-start; }
	    .msg--me { background: var(--accent); color: #fff; align-self: flex-end; }
	    .msg--thinking { display: inline-flex; align-items: center; gap: var(--space-4); color: var(--text-tertiary); }
	    .thinking-dots { display: inline-flex; align-items: center; gap: 3px; }
	    .thinking-dots i { width: 4px; height: 4px; border-radius: 50%; background: currentColor; opacity: 0.35; animation: engineerThinking 1s ease-in-out infinite; }
	    .thinking-dots i:nth-child(2) { animation-delay: 0.15s; }
	    .thinking-dots i:nth-child(3) { animation-delay: 0.3s; }
	    @keyframes engineerThinking { 0%, 80%, 100% { opacity: 0.35; transform: translateY(0); } 40% { opacity: 1; transform: translateY(-2px); } }
	    .msg-md { display: flex; flex-direction: column; gap: var(--space-4); color: inherit; }
	    .msg-md p, .msg-md h4, .msg-md ul { margin: 0; }
	    .msg-md h4 { color: var(--text-primary); font-family: var(--font-display); font-size: var(--text-md); line-height: 1.25; font-weight: 800; }
	    .msg-md p { color: inherit; text-wrap: pretty; }
	    .msg-md ul { padding-left: 18px; display: flex; flex-direction: column; gap: var(--space-3); }
	    .msg-md li { padding-left: 2px; }
	    .msg-md strong { color: var(--text-primary); font-weight: 800; }
	    .msg-md code { padding: 1px 5px; border-radius: var(--radius-xs); background: var(--bg-sunken); color: var(--text-primary); font-family: var(--font-mono); font-size: 0.92em; }
	    .ins__compose { display: flex; align-items: center; gap: var(--space-5); padding: var(--space-6); border-top: 1px solid var(--border-subtle); }
    .ins__input { flex: 1; height: var(--size-control-sm); padding: 0 var(--space-7); background: var(--bg-sunken); border: 1px solid var(--border-default); border-radius: var(--radius-pill); color: var(--text-primary); font-family: var(--font-sans); font-size: var(--text-sm); outline: none; }
    .ins__input::placeholder { color: var(--text-disabled); }
    .ins__model { font-family: var(--font-mono); font-size: var(--text-2xs); color: var(--text-tertiary); display: flex; align-items: center; gap: 5px; }

    .resize-handle { position: absolute; z-index: 35; appearance: none; -webkit-appearance: none; border: 0; padding: 0; background: transparent; cursor: col-resize; }
    .resize-handle::after { content: ""; position: absolute; border-radius: var(--radius-pill); background: rgba(255,255,255,0.18); opacity: 0; transition: opacity var(--dur-fast) var(--ease-standard), background var(--dur-fast) var(--ease-standard); }
    .resize-handle:hover::after, .resize-handle:focus-visible::after { opacity: 1; background: var(--accent); }
    .resize-handle--timing { top: 0; bottom: 0; left: calc(var(--timing-sidebar-w, 340px) - 4px); width: 8px; }
    .live__body[data-layout="focus"] .resize-handle--timing { left: auto; right: calc(var(--timing-sidebar-w, 340px) - 4px); }
    .resize-handle--timing::after, .resize-handle--battle::after, .resize-handle--quad-col::after, .resize-handle--data-a::after, .resize-handle--data-b::after { top: 18px; bottom: 18px; left: 3px; width: 2px; }
    .resize-handle--insights { position: relative; flex: none; height: 8px; width: 100%; cursor: row-resize; border-top: 1px solid var(--border-subtle); }
    .resize-handle--insights::after { left: 18px; right: 18px; top: 3px; height: 2px; }
    .resize-handle--focus-row, .resize-handle--quad-row, .resize-handle--data-row { left: 8px; right: 8px; height: 8px; cursor: row-resize; }
    .resize-handle--focus-row { top: calc(var(--focus-onboard-h, 220px) + 2px); }
    .resize-handle--quad-row, .resize-handle--data-row { top: calc(var(--quad-row, 50%) - 4px); }
    .resize-handle--data-row { top: calc(var(--data-row, 50%) - 4px); }
    .resize-handle--focus-row::after, .resize-handle--quad-row::after, .resize-handle--data-row::after { left: 10px; right: 10px; top: 3px; height: 2px; }
    .resize-handle--battle { top: 8px; bottom: 8px; left: calc(var(--battle-a, 50%) - 4px); width: 8px; }
    .resize-handle--quad-col { top: 8px; bottom: 8px; left: calc(var(--quad-col, 50%) - 4px); width: 8px; }
    .resize-handle--data-a { top: 8px; bottom: 8px; left: calc(var(--data-col-a, 33%) - 4px); width: 8px; }
    .resize-handle--data-b { top: 8px; bottom: 8px; left: calc(var(--data-col-a, 33%) + var(--data-col-b, 33%) - 4px); width: 8px; }
    .resize-handle--sidecar { top: 0; bottom: 0; right: calc(var(--timing-sidebar-w, 340px) + var(--sidecar-w, 300px) - 4px); width: 8px; }
    .resize-handle--sidecar::after { top: 18px; bottom: 18px; left: 3px; width: 2px; }
    .resize-handle--quad-corner, .resize-handle--data-corner-a, .resize-handle--data-corner-b { width: 24px; height: 24px; cursor: nwse-resize; z-index: 36; }
    .resize-handle--quad-corner { left: calc(var(--quad-col, 50%) - 12px); top: calc(var(--quad-row, 50%) - 12px); }
    .resize-handle--data-corner-a { left: calc(var(--data-col-a, 33%) - 12px); top: calc(var(--data-row, 50%) - 12px); }
    .resize-handle--data-corner-b { left: calc(var(--data-col-a, 33%) + var(--data-col-b, 33%) - 12px); top: calc(var(--data-row, 50%) - 12px); }
    .resize-handle--quad-corner::after, .resize-handle--data-corner-a::after, .resize-handle--data-corner-b::after { left: 7px; top: 7px; width: 10px; height: 10px; opacity: 0.55; background: rgba(255,255,255,0.3); box-shadow: 0 0 0 1px rgba(7,10,15,0.65); }
    .live__body .pane--bc[data-lockar="true"] .pane__video { object-fit: contain; object-position: center center; background: #000; }
    .live__body .pane:not(.pane--bc)[data-lockar="true"] .pane__video { object-fit: contain; object-position: center bottom; background: #000; }
    .pane__ctl--ar { width: auto; padding: 0 6px; font-family: var(--font-mono); font-size: 10px; font-weight: 800; letter-spacing: 0.02em; }
    .pane__ctl--ar[data-active="true"] { background: var(--surface-hover); color: var(--accent); border-color: var(--accent-border); }

    .ai-popup { position: absolute; inset: 0; z-index: 90; display: grid; place-items: center; background: rgba(3,5,8,0.58); backdrop-filter: blur(8px); }
    .ai-popup__panel { position: relative; }
    .ai-popup__close { position: absolute; top: 8px; right: 8px; z-index: 4; }
    /* ===== Watch Party — Glass Minimal (Direction C) ===== */
    .party-tray { position: absolute; z-index: 88; width: min(380px, calc(100vw - 48px)); display: flex; flex-direction: column; border-radius: var(--radius-md); border: 1px solid var(--border-default); background: linear-gradient(180deg, color-mix(in srgb, var(--surface-overlay) 96%, transparent), color-mix(in srgb, var(--bg-base) 96%, transparent)); box-shadow: var(--shadow-lg); overflow: hidden; backdrop-filter: blur(14px); }
    .wpc__head { display: flex; align-items: center; gap: var(--space-5); min-height: 52px; padding: 0 var(--space-5) 0 var(--space-6); border-bottom: 1px solid var(--border-subtle); cursor: grab; user-select: none; }
    .party-tray[data-minimized="true"] .wpc__head { border-bottom: 0; }
    .wpc__avstack { display: flex; align-items: center; flex: none; }
    .wpc__avstack:empty { display: none; }
    .wpc-av { position: relative; display: inline-grid; place-items: center; border-radius: 50%; font-family: var(--font-display); font-weight: 800; color: #fff; background: color-mix(in srgb, var(--ac, var(--accent)) 30%, #0c1017); box-shadow: inset 0 0 0 1.5px color-mix(in srgb, var(--ac, var(--accent)) 80%, transparent), 0 0 0 2px #0c0f15; width: 24px; height: 24px; font-size: 10px; flex: none; }
    .wpc__avstack .wpc-av + .wpc-av { margin-left: -8px; }
    .wpc-av[data-size="md"] { width: 30px; height: 30px; font-size: 12px; box-shadow: inset 0 0 0 1.5px color-mix(in srgb, var(--ac, var(--accent)) 80%, transparent); }
    .wpc__meta { display: flex; flex-direction: column; gap: 1px; min-width: 0; flex: 1; }
    .wpc__sync { display: inline-flex; align-items: center; gap: var(--space-4); font-family: var(--font-mono); font-size: var(--text-2xs); font-weight: 800; letter-spacing: 0.06em; color: var(--success); }
    .wpc__sync[data-tone="ok"] { color: var(--success); }
    .wpc__sync[data-tone="warn"] { color: var(--warning); }
    .wpc__sync[data-tone="bad"] { color: var(--live); }
    .wpc__sync[data-tone="off"] { color: var(--text-tertiary); }
    .wpc__role { font-size: var(--text-2xs); color: var(--text-tertiary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .wpc__role b { color: var(--text-secondary); }
    .wpc__headspace { margin-left: auto; display: inline-flex; gap: 2px; flex: none; }
    .wpc__dot { position: relative; width: 8px; height: 8px; border-radius: 50%; background: var(--success); box-shadow: 0 0 0 4px color-mix(in srgb, var(--success) 20%, transparent); flex: none; }
    .wpc__dot::after { content: ""; position: absolute; inset: -3px; border-radius: 50%; border: 1.5px solid var(--success); opacity: .55; animation: wpc-ring 2.4s ease-out infinite; }
    @keyframes wpc-ring { 0% { transform: scale(.6); opacity: .6; } 100% { transform: scale(1.9); opacity: 0; } }
    .wpc__ctx { display: flex; align-items: center; gap: var(--space-4); padding: var(--space-4) var(--space-6); border-bottom: 1px solid var(--border-subtle); font-family: var(--font-mono); font-size: var(--text-2xs); color: var(--text-tertiary); background: rgba(255,255,255,0.012); }
    .wpc__ctx b { color: var(--text-secondary); font-weight: 700; }
    .wpc__ctxact { margin-left: auto; display: inline-flex; align-items: center; gap: var(--space-5); flex: none; }
    .wpc__resync { display: inline-flex; align-items: center; gap: 4px; color: var(--accent); cursor: pointer; background: none; border: 0; padding: 0; font: inherit; font-family: var(--font-mono); font-size: var(--text-2xs); }
    .wpc__resync:hover { color: var(--accent-hover); }
    .wpc__leave { color: var(--text-tertiary); }
    .wpc__leave:hover { color: var(--live); }
    .wpc__chat { min-height: 0; height: 300px; display: flex; flex-direction: column; gap: var(--space-5); padding: var(--space-6); overflow-y: auto; }
    .wpc__empty { margin: auto; max-width: 26ch; text-align: center; color: var(--text-tertiary); font-size: var(--text-xs); line-height: 1.45; }
    .wpc-msg { display: flex; gap: var(--space-4); max-width: 88%; }
    .wpc-msg__b { display: flex; flex-direction: column; gap: 3px; min-width: 0; }
    .wpc-msg__name { font-family: var(--font-mono); font-size: var(--text-2xs); color: var(--text-tertiary); letter-spacing: 0.04em; }
    .wpc-msg__name b { color: color-mix(in srgb, var(--ac, var(--text-secondary)) 65%, var(--text-primary)); font-weight: 800; }
    .wpc-msg__bubble { font-size: var(--text-sm); line-height: 1.4; color: var(--text-secondary); background: var(--surface-card); border: 1px solid var(--border-subtle); border-radius: var(--radius-md); border-top-left-radius: var(--radius-xs); padding: var(--space-4) var(--space-5); text-wrap: pretty; word-break: break-word; }
    .wpc-msg[data-me="true"] { margin-left: auto; flex-direction: row-reverse; }
    .wpc-msg[data-me="true"] .wpc-msg__b { align-items: flex-end; }
    .wpc-msg[data-me="true"] .wpc-msg__bubble { color: var(--text-primary); background: var(--accent-quiet); border-color: var(--accent-border); border-radius: var(--radius-md); border-top-right-radius: var(--radius-xs); }
    .wpc__typing { min-height: 18px; padding: 0 var(--space-6) var(--space-3); color: var(--text-tertiary); font-family: var(--font-mono); font-size: var(--text-2xs); font-weight: 700; }
    .wpc-sys { align-self: center; display: inline-flex; align-items: center; gap: var(--space-4); font-family: var(--font-mono); font-size: var(--text-2xs); color: var(--text-tertiary); background: rgba(255,255,255,0.03); border: 1px solid var(--border-subtle); border-radius: var(--radius-pill); padding: 3px var(--space-5); }
    .wpc-sys b { color: var(--text-secondary); font-weight: 700; }
    .wpc-sys .ic { color: var(--success); display: inline-grid; place-items: center; }
    .wpc__compose { display: grid; grid-template-columns: auto minmax(0,1fr) auto; gap: var(--space-4); align-items: center; padding: var(--space-5) var(--space-6) var(--space-6); border-top: 1px solid var(--border-subtle); }
    .wpc__plus { display: inline-grid; place-items: center; width: 36px; height: 36px; border-radius: 50%; border: 1px solid var(--border-default); background: transparent; color: var(--text-tertiary); cursor: pointer; flex: none; transition: var(--tr-control); }
    .wpc__plus:hover:not(:disabled) { border-color: var(--accent-border); color: var(--text-primary); background: var(--accent-soft); }
    .wpc__plus:disabled { opacity: 0.5; cursor: default; }
    .wpc__join { padding: var(--space-6); display: flex; flex-direction: column; gap: var(--space-5); }
    .wpc__joinrow { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: var(--space-4); }
    .party-input { width: 100%; min-width: 0; height: 36px; border-radius: var(--radius-pill); border: 1px solid var(--border-default); background: var(--bg-sunken, rgba(3,5,8,0.72)); color: var(--text-primary); padding: 0 var(--space-6); font: inherit; font-size: var(--text-sm); outline: 0; box-sizing: border-box; transition: var(--tr-control); }
    .party-input:focus { border-color: var(--accent-border); box-shadow: var(--glow-accent); }
    /* unread badge on the Watch Party launcher */
    .wp-unread { display: inline-grid; place-items: center; min-width: 16px; height: 16px; margin-left: 6px; padding: 0 4px; border-radius: var(--radius-pill); background: var(--live); color: #fff; font-family: var(--font-mono); font-size: 9px; font-weight: 800; vertical-align: middle; }
    /* ===== Watch Party mini toasts — Card (Option 2) ===== */
    .wp-toasts { position: absolute; right: 20px; bottom: 20px; z-index: 95; width: 300px; max-width: calc(100vw - 40px); display: flex; flex-direction: column; gap: var(--space-4); pointer-events: none; }
    .wp-toasts > * { pointer-events: auto; }
    .wpt-card { position: relative; display: grid; grid-template-columns: auto minmax(0,1fr); gap: var(--space-5); padding: var(--space-5) var(--space-6); text-align: left; width: 100%; border-radius: var(--radius-md); border: 1px solid var(--border-default); background: linear-gradient(180deg, color-mix(in srgb, var(--surface-overlay) 97%, transparent), color-mix(in srgb, var(--bg-base) 97%, transparent)); box-shadow: var(--shadow-lg); backdrop-filter: blur(12px); cursor: pointer; animation: wpt-in var(--dur-base, .2s) var(--ease-out, ease); }
    .wpt-card:hover { border-color: var(--accent-border); }
    @keyframes wpt-in { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
    .wpt-card__b { min-width: 0; display: flex; flex-direction: column; gap: 2px; }
    .wpt-card__top { display: flex; align-items: center; gap: var(--space-4); }
    .wpt-card__name { font-size: var(--text-sm); font-weight: 800; color: var(--text-primary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .wpt-card__eyebrow { margin-left: auto; font-family: var(--font-mono); font-size: 8.5px; font-weight: 800; letter-spacing: var(--tracking-caps); text-transform: uppercase; color: var(--accent); flex: none; }
    .wpt-card__msg { font-size: var(--text-sm); line-height: 1.38; color: var(--text-secondary); display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; text-wrap: pretty; }
    .wpt-card__icon { display: inline-grid; place-items: center; width: 30px; height: 30px; border-radius: var(--radius-sm); flex: none; align-self: start; background: var(--accent-quiet); color: var(--accent); }
    .wpt-card[data-ai] { border-color: var(--accent-border); background: linear-gradient(180deg, color-mix(in srgb, var(--accent-soft) 90%, var(--surface-overlay)), color-mix(in srgb, var(--bg-base) 96%, transparent)); }
    .wpt-card[data-ai] .wpt-card__eyebrow { display: inline-flex; align-items: center; gap: 3px; }

    /* Battle toast */
    .toast { position: absolute; top: 64px; left: 50%; transform: translateX(-50%); z-index: 40; display: flex; align-items: center; gap: var(--space-6); padding: var(--space-6) var(--space-7); border-radius: var(--radius-md); background: var(--surface-overlay); border: 1px solid var(--accent-border); box-shadow: var(--shadow-lg), var(--glow-accent); backdrop-filter: blur(var(--blur-md, 14px)); animation: pw-toast-in var(--dur-base) var(--ease-out); }
    .toast__icon { display: inline-grid; place-items: center; width: 32px; height: 32px; border-radius: var(--radius-sm); background: var(--accent-quiet); color: var(--accent); flex: none; }
    .toast__t { font-size: var(--text-md); font-weight: 600; color: var(--text-strong); }
    .toast__s { font-size: var(--text-sm); color: var(--text-secondary); }
    .stream-modal { position: absolute; inset: 0; z-index: 100; display: grid; place-items: center; background: rgba(3,5,8,0.62); backdrop-filter: blur(8px); }
    .stream-modal__panel { width: min(780px, calc(100vw - 48px)); max-height: min(820px, calc(100vh - 48px)); display: flex; flex-direction: column; border-radius: var(--radius-lg); background: var(--surface-overlay); border: 1px solid var(--border-default); box-shadow: var(--shadow-lg); overflow: hidden; }
    .session-library { position: absolute; inset: 0; z-index: 105; display: grid; place-items: center; padding: 26px; background: rgba(2,5,10,0.70); backdrop-filter: blur(10px); }
    .session-library__panel { width: min(1180px, calc(100vw - 52px)); height: min(760px, calc(100vh - 52px)); display: grid; grid-template-rows: 96px minmax(0, 1fr); border-radius: 18px; border: 1px solid var(--border-strong); background: linear-gradient(180deg, rgba(8,13,20,0.98), rgba(3,8,13,0.98)); box-shadow: 0 28px 90px rgba(0,0,0,0.58); overflow: hidden; }
    .session-library--inline { position: relative; inset: auto; z-index: 2; width: 100%; height: 100%; padding: 0; background: transparent; backdrop-filter: none; }
    .session-library--inline .session-library__panel { width: 100%; height: 100%; border-radius: 0; border: 0; box-shadow: none; }
    .session-library--inline .session-library__close { display: none; }
    .session-library__head { display: flex; align-items: center; gap: var(--space-6); padding: var(--space-7) var(--space-8); border-bottom: 1px solid var(--border-subtle); background: linear-gradient(180deg, rgba(20,26,36,0.55), transparent); }
    .session-library__glyph { display: inline-grid; place-items: center; width: 44px; height: 44px; border-radius: var(--radius-sm); background: color-mix(in srgb, var(--accent) 18%, var(--bg-sunken)); color: var(--accent); flex: none; }
    .session-library__title { margin: 0; font-family: var(--font-display); font-size: 23px; line-height: 1; font-weight: 900; color: var(--text-strong); }
    .session-library__sub { margin-top: 7px; color: var(--text-tertiary); font-size: var(--text-sm); }
    .session-library__tools { margin-left: auto; display: flex; align-items: center; gap: var(--space-5); }
    .session-library__season { display: inline-flex; align-items: center; gap: 7px; height: 32px; padding: 0 12px; border-radius: var(--radius-sm); border: 1px solid var(--border-default); background: var(--surface-raised); color: var(--text-secondary); font-family: var(--font-mono); font-size: var(--text-sm); font-weight: 700; }
    .session-library__season b { color: var(--text-primary); }
    .session-library--inline .session-library__close { display: none; }

    /* ===== Direction 03 — The Season (spine) ===== */
    .session-library__season-scroll { min-height: 0; overflow-y: auto; padding: var(--space-8) var(--space-9); }
    .session-library--inline .session-library__season-scroll { padding: var(--space-7); }
    .session-library__spine { position: relative; padding-left: 40px; display: flex; flex-direction: column; gap: var(--space-5); }
    .session-library__spine::before { content: ""; position: absolute; left: 13px; top: 12px; bottom: 12px; width: 2px; background: linear-gradient(180deg, var(--border-subtle), var(--accent) 26%, var(--accent) 52%, var(--border-subtle)); }
    .slr { position: relative; }
    .slr__node { position: absolute; left: -33px; top: 22px; width: 14px; height: 14px; border-radius: 50%; background: var(--bg-app); border: 2px solid var(--ink-500); z-index: 1; }
    .slr[data-state="done"] .slr__node { border-color: var(--success); background: var(--success); }
    .slr[data-state="live"] .slr__node { border-color: var(--live); background: var(--live); box-shadow: 0 0 0 5px var(--live-weak); }
    .slr[data-state="next"] .slr__node { border-color: var(--accent); }
    .slr--open .slr__node { top: 30px; }
    .slr__row { appearance: none; -webkit-appearance: none; width: 100%; display: grid; grid-template-columns: 42px minmax(0, 1fr) auto; align-items: center; gap: var(--space-6); padding: var(--space-5) var(--space-6); border-radius: var(--radius-md); border: 1px solid var(--border-subtle); background: var(--surface-card); color: var(--text-primary); text-align: left; cursor: pointer; transition: border-color .15s ease, background .15s ease; }
    .slr__row:hover { border-color: var(--accent-border); background: var(--surface-hover); }
    .slr[data-state="done"] .slr__row { background: rgba(255,255,255,0.015); }
    .slr[data-state="upcoming"] .slr__row { opacity: 0.55; }
    .slr__rnd { font-family: var(--font-mono); font-size: 12px; font-weight: 700; color: var(--text-tertiary); text-align: center; }
    .slr__main { min-width: 0; }
    .slr__name { display: block; font-family: var(--font-display); font-weight: 800; font-size: var(--text-lg); color: var(--text-primary); line-height: 1.1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .slr__meta { display: flex; align-items: center; flex-wrap: wrap; gap: 9px; margin-top: 5px; font-family: var(--font-mono); font-size: 10px; color: var(--text-tertiary); }
    .session-library__race-meta { font-family: var(--font-mono); }
    .slr__cta { display: inline-flex; align-items: center; gap: 6px; color: var(--text-tertiary); font-family: var(--font-sans); font-size: var(--text-sm); font-weight: 700; white-space: nowrap; }

    .slr__chip { display: inline-flex; align-items: center; gap: 5px; font-family: var(--font-mono); font-size: 9px; font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase; padding: 3px 7px; border-radius: 4px; }
    .slr__chip--live { color: #fff; background: var(--live); box-shadow: var(--glow-live); }
    .slr__chip--live i { width: 6px; height: 6px; border-radius: 50%; background: #fff; }
    .slr__chip--done { color: var(--success); background: var(--success-quiet); }
    .slr__chip--soon { color: var(--warning); background: var(--warning-quiet); }

    .slr__expand { position: relative; border-radius: var(--radius-lg); border: 1px solid var(--accent-border); background: linear-gradient(180deg, rgba(20,28,42,0.7), rgba(8,12,20,0.7)); box-shadow: var(--glow-soft); overflow: hidden; }
    .slr--open[data-state="live"] .slr__expand { border-color: rgba(255,59,59,0.4); box-shadow: var(--glow-live); }
    .slr__exhead { position: relative; overflow: hidden; display: flex; align-items: center; gap: var(--space-6); padding: var(--space-7); border-bottom: 1px solid var(--border-subtle); }
    .slr__exhead > :not(.slr__map) { position: relative; z-index: 1; }
    .slr__map { position: absolute; right: -20px; top: -30px; width: 200px; height: 170px; color: var(--accent); opacity: 0.18; pointer-events: none; z-index: 0; }
    .slr__map svg { display: block; width: 100%; height: 100%; }
    .slr__map path { fill: none; }
    .slr__code { display: inline-grid; place-items: center; width: 52px; height: 52px; border-radius: var(--radius-sm); background: color-mix(in srgb, var(--accent) 16%, var(--bg-sunken)); border: 1px solid var(--accent-border); color: var(--accent); font-family: var(--font-display); font-weight: 900; font-size: 13px; flex: none; }
    .slr--open[data-state="live"] .slr__code { background: color-mix(in srgb, var(--live) 18%, var(--bg-sunken)); border-color: rgba(255,59,59,0.4); color: #ff8a8a; }
    .slr__exname { display: block; font-family: var(--font-display); font-weight: 900; font-size: 23px; color: var(--text-strong); line-height: 1; }
    .slr__exmeta { font-family: var(--font-mono); font-size: 11px; color: var(--text-tertiary); margin-top: 6px; }
    .slr__exstatus { margin-left: auto; display: inline-flex; align-items: center; gap: var(--space-5); }
    .slr__exstatus .session-library__count { color: var(--text-tertiary); font-family: var(--font-mono); font-size: var(--text-sm); white-space: nowrap; }
    .slr__metatext { min-width: 0; }
    .slr__drv { display: inline-flex; align-items: center; gap: 5px; vertical-align: middle; font-family: var(--font-display); font-weight: 800; font-size: 11px; color: var(--text-secondary); }
    .slr__drv i { width: 4px; height: 12px; border-radius: 2px; background: var(--tc, var(--accent)); flex: none; }
    .slr__drv--chip { color: inherit; }
    .slr__drv--chip i { height: 10px; }
    .slr__grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 1px; background: var(--border-subtle); }
    .slr-cell { background: var(--bg-base); padding: var(--space-6); display: flex; flex-direction: column; gap: 10px; min-height: 118px; }
    .slr-cell[data-live="true"] { background: linear-gradient(180deg, rgba(255,59,59,0.12), transparent); }
    .slr-cell[data-available="false"] { opacity: 0.6; }
    .slr-cell__nm { font-family: var(--font-display); font-weight: 800; font-size: var(--text-md); color: var(--text-primary); }
    .slr-cell[data-live="true"] .slr-cell__nm { color: #ff8a8a; }
    .slr-cell__mt { display: flex; flex-direction: column; align-items: flex-start; gap: 6px; font-family: var(--font-mono); font-size: 10px; color: var(--text-tertiary); line-height: 1.4; }
    .slr-cell__btn { margin-top: auto; }
    .slr-cell__btn > button { width: 100%; }
    .replay-timing-badge { display: inline-flex; align-items: center; gap: 5px; max-width: 100%; min-height: 20px; padding: 3px 7px; border-radius: var(--radius-pill); border: 1px solid var(--border-subtle); background: rgba(255,255,255,0.04); color: var(--text-tertiary); font-family: var(--font-mono); font-size: 9px; font-weight: 800; text-transform: uppercase; letter-spacing: var(--tracking-caps); white-space: nowrap; }
    .replay-timing-badge[data-status="ready"] { color: #8ed7ff; border-color: rgba(31,171,226,0.34); background: rgba(31,171,226,0.10); }
    .replay-timing-badge[data-status="manual-sync"] { color: #ffd98a; border-color: rgba(255,201,77,0.30); background: rgba(255,201,77,0.09); }
    .replay-timing-badge[data-status="generating"], .replay-timing-badge[data-status="checking"] { color: var(--accent); border-color: rgba(31,171,226,0.24); background: rgba(31,171,226,0.07); }
    .replay-timing-badge[data-status="unavailable"] { color: var(--text-muted); }
    .session-library__empty { margin: var(--space-8); color: var(--text-tertiary); font-size: var(--text-sm); }
    @media (max-width: 860px) {
      .session-library { padding: 12px; }
      .session-library__panel { width: calc(100vw - 24px); height: calc(100vh - 24px); grid-template-rows: auto minmax(0, 1fr); }
      .session-library__head { padding: var(--space-6); flex-wrap: wrap; }
      .session-library__season-scroll { padding: var(--space-6); }
      .session-library__spine { padding-left: 28px; }
      .slr__node { left: -25px; }
      .slr__grid { grid-template-columns: repeat(2, 1fr); }
      .slr__cta { display: none; }
    }
    .stream-modal__hd { display: flex; align-items: center; gap: var(--space-5); padding: var(--space-7) var(--space-8); border-bottom: 1px solid var(--border-subtle); }
    .stream-modal__title { font-family: var(--font-display); font-weight: 700; color: var(--text-primary); font-size: var(--text-lg); }
    .stream-modal__body { display: flex; flex-direction: column; gap: var(--space-6); padding: var(--space-8); overflow-y: auto; }
    .stream-modal__input { height: var(--size-control-md); border-radius: var(--radius-sm); border: 1px solid var(--border-default); background: var(--bg-sunken); color: var(--text-primary); padding: 0 var(--space-7); font-family: var(--font-mono); font-size: var(--text-sm); outline: 0; }
    .stream-modal__input:focus { border-color: var(--accent); box-shadow: 0 0 0 3px var(--accent-quiet); }
    .stream-modal__hint { color: var(--text-tertiary); font-size: var(--text-sm); line-height: 1.45; }
    .stream-modal__tools { display: flex; gap: var(--space-5); align-items: center; flex-wrap: wrap; }
    .stream-modal__section { display: flex; flex-direction: column; gap: var(--space-4); padding-top: var(--space-2); }
    .stream-modal__section h4 { margin: 0; color: var(--text-primary); font-size: var(--text-sm); font-weight: 700; }
    .stream-pick { display: flex; flex-direction: column; align-items: flex-start; gap: 3px; padding: var(--space-5) var(--space-6); border-radius: var(--radius-sm); border: 1px solid var(--border-subtle); background: var(--surface-raised); color: var(--text-secondary); font-family: var(--font-sans); cursor: pointer; text-align: left; }
    .stream-pick:hover { border-color: var(--accent-border); background: var(--surface-hover); color: var(--text-primary); }
    .stream-pick b { color: var(--text-primary); font-size: var(--text-sm); }
    .stream-pick span { color: var(--text-tertiary); font-size: var(--text-xs); overflow: hidden; text-overflow: ellipsis; max-width: 100%; }
    .f1tv-picker { display: grid; grid-template-columns: 120px 1fr; gap: var(--space-5); }
    .f1tv-picker__select { height: var(--size-control-md); border-radius: var(--radius-sm); border: 1px solid var(--border-default); background: var(--bg-sunken); color: var(--text-primary); padding: 0 var(--space-6); font-family: var(--font-sans); font-size: var(--text-sm); outline: 0; min-width: 0; }
    .f1tv-picker__sessions { display: flex; flex-wrap: wrap; gap: var(--space-4); }
    .f1tv-session { height: 30px; padding: 0 var(--space-6); border-radius: var(--radius-pill); border: 1px solid var(--border-default); background: var(--surface-raised); color: var(--text-secondary); font-family: var(--font-sans); font-size: var(--text-sm); cursor: pointer; }
    .f1tv-session:hover { color: var(--text-primary); border-color: var(--accent-border); }
    .f1tv-session[data-active="true"] { color: var(--text-strong); border-color: var(--accent-border); background: var(--accent-quiet); }
    .f1tv-picker__meta { display: flex; align-items: center; gap: var(--space-5); color: var(--text-tertiary); font-size: var(--text-xs); }
    .f1tv-picker__meta[data-ready="true"] { color: var(--success); }
    .f1tv-picker__meta[data-ready="false"] { color: var(--warning); }
    .replay-empty { width: min(560px, calc(100% - 48px)); display: flex; flex-direction: column; align-items: center; gap: var(--space-5); padding: var(--space-8); border-radius: var(--radius-md); border: 1px solid var(--border-default); background: rgba(8,11,17,0.72); backdrop-filter: blur(10px); box-shadow: var(--shadow-md); text-align: center; }
    .replay-empty__eyebrow { display: inline-flex; align-items: center; gap: var(--space-4); color: var(--text-tertiary); font-family: var(--font-mono); font-size: var(--text-2xs); text-transform: uppercase; letter-spacing: var(--tracking-caps); }
    .replay-empty__title { font-family: var(--font-display); font-weight: 800; color: var(--text-strong); font-size: var(--text-2xl); line-height: 1; }
    .replay-empty__body { color: var(--text-secondary); font-size: var(--text-sm); line-height: 1.45; max-width: 480px; }
    .replay-picker { width: 100%; display: grid; grid-template-columns: 105px minmax(0, 1fr); gap: var(--space-4); text-align: left; }
    .replay-picker__sessions { grid-column: 1 / -1; display: flex; flex-wrap: wrap; gap: var(--space-3); justify-content: center; }
    .replay-picker__actions { grid-column: 1 / -1; display: flex; flex-wrap: wrap; gap: var(--space-4); justify-content: center; margin-top: var(--space-2); }
    .pane__tag--bc[data-live="false"] { background: var(--surface-raised); border-color: var(--border-default); color: var(--text-primary); }
    .pane__bclive[data-live="false"] { background: var(--accent); animation: none; }
    .stream-modal__actions { display: flex; justify-content: flex-end; gap: var(--space-5); padding: var(--space-7) var(--space-8); border-top: 1px solid var(--border-subtle); }
    @keyframes pw-toast-in { from { opacity: 0; transform: translate(-50%, -10px); } to { opacity: 1; transform: translate(-50%, 0); } }
    `;
  }

  function normalizePresetName(name) {
    return name === "Driver Focus" ? "Intelligent" : name;
  }
  const LAYOUTS = {
    "Intelligent": "focus", "Apexline Classic": "quad", "Pit Wall Classic": "quad", "Battle Mode": "battle",
    "Data Overload": "data", "Minimal Clean": "focus", "Theater": "theater",
  };
  function readInitialLivePreset(livePrefs = {}, savedLayout) {
    const defaultPreset = normalizePresetName(livePrefs.defaultPreset);
    let saved = savedLayout;
    if (saved == null) {
      try { saved = JSON.parse(localStorage.getItem("pw-live-layout") || "{}"); }
      catch { saved = {}; }
    }
    const savedPreset = normalizePresetName(saved?.preset);
    const savedCustomId = customLayoutIdFromPreset(saved?.preset || "");
    if (savedCustomId) {
      try {
        if (readCustomLayouts().layouts.some((entry) => entry.id === savedCustomId)) return saved.preset;
      } catch {}
    }
    if (savedPreset && LAYOUTS[savedPreset]) return savedPreset;
    return LAYOUTS[defaultPreset] ? defaultPreset : "Intelligent";
  }
  const SYNC_STORAGE_KEY = "pw-sync-settings";
  const TIMING_OFFSET_STORAGE_KEY = "pw-replay-timing-offset-v2";
  const PARTY_TRAY_STORAGE_KEY = "pw-party-tray-position";
  const DEFAULT_REPLAY_TIMING_OFFSET = -8;
  const DEFAULT_WORLD_SYNC_TARGET = 36;
  const DEFAULT_NON_WORLD_SYNC_OFFSET = 4;
  const SYNC_EPSILON = 0.075;

  function readPartyTrayPosition() {
    try {
      const saved = JSON.parse(localStorage.getItem(PARTY_TRAY_STORAGE_KEY) || "{}");
      return {
        x: clampPanelSize(saved.x == null ? window.innerWidth - 472 : saved.x, 16, Math.max(16, window.innerWidth - 448)),
        y: clampPanelSize(saved.y == null ? 72 : saved.y, 56, Math.max(56, window.innerHeight - 240)),
      };
    } catch {
      return { x: Math.max(16, window.innerWidth - 472), y: 72 };
    }
  }

  function sessionFlagFromClock(clock, fallback) {
    const fallbackFlag = fallback || { status: "green", label: "Session" };
    const trackCode = String(clock?.trackStatus?.status || "").trim();
    const trackMessage = String(clock?.trackStatus?.message || "").trim();
    const trackText = `${trackCode} ${trackMessage}`.toLowerCase();
    if (trackCode === "5" || /\bred\b/.test(trackText)) return { status: "red", label: "Red flag" };
    if (trackCode === "4" || /\bsafety\s*car\b|\bsc\b/.test(trackText)) return { status: "sc", label: "Safety car" };
    if (trackCode === "6" || trackCode === "7" || /\bvsc\b|virtual\s+safety\s+car/.test(trackText)) return { status: "vsc", label: "VSC" };
    if (trackCode === "2" || trackCode === "3" || /\byellow\b/.test(trackText)) return { status: "yellow", label: "Yellow flag" };
    if (trackCode === "1" || /all\s*clear|\bgreen\b/.test(trackText)) return { status: "green", label: "Green flag" };

    const sessionText = String(clock?.status || "").trim().toLowerCase();
    if (/aborted|red|suspended|stopped|interrupted/.test(sessionText)) return { status: "red", label: "Red flag" };
    if (/yellow/.test(sessionText)) return { status: "yellow", label: "Yellow flag" };
    if (/started|resumed|active|running|green/.test(sessionText)) return { status: "green", label: "Green flag" };
    return fallbackFlag;
  }

  function qualifyingPhaseFromSession(options) {
    options = typeof options === "string" ? { qualifyingPhase: options } : options || {};
    const clock = options.sessionClock || {};
    const sessionKind = String(options.sessionKind || "");
    const prefix = /sprint qualifying|shootout/i.test(sessionKind) ? "SQ" : "Q";
    const phaseTexts = [
      options.qualifyingPhase,
      clock.qualifyingPart,
      clock.phase,
      clock.part,
      clock.label,
      sessionKind,
    ];
    for (const value of phaseTexts) {
      const text = String(value || "").toUpperCase();
      const match = text.match(/\b(SQ|Q)([1-3])\b/) || text.match(/\bQUALIFYING\s*([1-3])\b/);
      if (match) return `${match[1] === "SQ" || prefix === "SQ" ? "SQ" : "Q"}${match[2] || match[1]}`;
    }
    if (!/qualifying|shootout/i.test(sessionKind)) return "";
    const rowCount = Number(options.rowCount);
    if (Number.isFinite(rowCount) && rowCount > 0) {
      if (rowCount > 16) return `${prefix}1`;
      if (rowCount > 10) return `${prefix}2`;
      return `${prefix}3`;
    }
    return `${prefix}1`;
  }

  function qualifyingEliminationCount(rowCount) {
    const fieldSize = Number(rowCount);
    if (!Number.isFinite(fieldSize) || fieldSize <= 10) return 5;
    return Math.max(5, Math.floor((fieldSize - 10) / 2));
  }

  function qualifyingQ1EliminationStart(rowCount) {
    const fieldSize = Number(rowCount);
    const safeFieldSize = Number.isFinite(fieldSize) && fieldSize > 0 ? fieldSize : 20;
    return safeFieldSize - qualifyingEliminationCount(safeFieldSize) + 1;
  }

  function qualifyingQ2EliminationEnd(rowCount) {
    return 10 + qualifyingEliminationCount(rowCount);
  }

  function isQualifyingEliminationRow(row, phaseContext) {
    const context = typeof phaseContext === "string" ? { qualifyingPhase: phaseContext } : phaseContext || {};
    const phase = qualifyingPhaseFromSession(context);
    const phaseNumber = phase.replace(/^SQ/, "Q");
    const rowCount = Number(context.rowCount);
    const pos = Number(row?.pos);
    if (!Number.isFinite(pos)) return false;
    if (phaseNumber === "Q1") return pos >= qualifyingQ1EliminationStart(rowCount);
    if (phaseNumber === "Q2") return pos >= 11 && pos <= qualifyingQ2EliminationEnd(rowCount);
    return false;
  }

  function activeBattleCandidateScore(candidate) {
    const gap = Number(candidate?.gap);
    const priority = Number(candidate?.priority);
    if (!Number.isFinite(gap) || !Number.isFinite(priority)) return -Infinity;
    const gapScore = Math.max(0, 2.5 - gap) * 100;
    const positionScore = Math.max(0, 24 - priority) * 4;
    return gapScore + positionScore;
  }

  function intelligentOnboardCodes(options) {
    options = options || {};
    const timingRows = Array.isArray(options.timingRows) ? options.timingRows : [];
    const fallbackCodes = Array.isArray(options.fallbackCodes) ? options.fallbackCodes : [];
    const previousCodes = Array.isArray(options.previousCodes) ? options.previousCodes : [];
    const sessionKind = String(options.sessionKind || "");
    const count = Math.max(1, Number(options.count || 3));
    const cleanCode = (value) => String(value || "").trim().toUpperCase();
    const unique = (codes) => {
      const picked = [];
      codes.map(cleanCode).filter(Boolean).forEach((code) => {
        if (!picked.includes(code)) picked.push(code);
      });
      return picked;
    };
    const intervalSeconds = (value) => {
      const text = String(value || "").trim();
      if (!text || text === "—" || /leader/i.test(text)) return null;
      const number = Number(text.replace(/^\+/, "").replace(/s$/i, ""));
      return Number.isFinite(number) ? number : null;
    };
    const ordered = timingRows
      .map((row) => ({ ...row, pos: Number(row.pos), code: cleanCode(row.code) }))
      .filter((row) => row.code && Number.isFinite(row.pos))
      .sort((a, b) => a.pos - b.pos);
    const base = unique([options.preferredCode, options.selectedCode, ...fallbackCodes, ...ordered.map((row) => row.code)]);
    const primary = base[0] || "";
    const fill = (smartCodes) => unique([primary, ...smartCodes, ...base]).slice(0, count);
    const session = sessionKind.toLowerCase();

    if (/qualifying|shootout/.test(session)) {
      const frontCodes = ordered.map((row) => row.code).filter((code) => code !== primary);
      const phase = qualifyingPhaseFromSession({ ...options, sessionKind, rowCount: ordered.length });
      if (phase === "Q1") {
        const dangerStart = qualifyingQ1EliminationStart(ordered.length);
        const danger = ordered.find((row) => row.pos === dangerStart) || ordered.find((row) => row.pos === dangerStart - 1) || ordered.at(-1);
        return fill([danger?.code, frontCodes[0]]);
      }
      if (phase === "Q2") {
        const bubble = ordered.find((row) => row.pos === 10) || ordered.find((row) => row.pos === 11) || ordered.at(-1);
        return fill([bubble?.code, frontCodes[0]]);
      }
      return fill(frontCodes.slice(0, 2));
    }

    if (/race|sprint|grand prix/.test(session)) {
      const battleAt = (index, maxGap) => {
        const ahead = ordered[index - 1];
        const behind = ordered[index];
        const gap = intervalSeconds(behind?.interval);
        if (!ahead?.code || !behind?.code || gap == null || gap <= 0 || gap > maxGap) return null;
        return { codes: [ahead.code, behind.code], priority: Math.min(ahead.pos, behind.pos), gap };
      };
      const activePrevious = (() => {
        const pair = unique(previousCodes.slice(1, 3));
        if (pair.length < 2) return null;
        for (let index = 1; index < ordered.length; index += 1) {
          const candidate = battleAt(index, 2.2);
          if (candidate && pair.every((code) => candidate.codes.includes(code))) return candidate;
        }
        return null;
      })();
      const candidates = [];
      for (let index = 1; index < ordered.length; index += 1) {
        const candidate = battleAt(index, 1.5);
        if (candidate) candidates.push(candidate);
      }
      candidates.sort((a, b) => activeBattleCandidateScore(b) - activeBattleCandidateScore(a) || a.priority - b.priority || a.gap - b.gap);
      const best = candidates[0];
      const selectedBattle = activePrevious && activeBattleCandidateScore(activePrevious) >= activeBattleCandidateScore(best) - 8 ? activePrevious : best;
      if (selectedBattle) return fill(selectedBattle.codes);
    }

    return base.slice(0, count);
  }
  function liveOnboardCodeForSlot(slot, fallback, overrides, byCode) {
    const override = overrides?.[slot];
    return byCode?.[override] ? override : fallback;
  }

  function telemetryNumber(value) {
    if (value === null || value === undefined || value === "") return null;
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
  }
  function timingGapSeconds(value) {
    const text = String(value || "").trim();
    if (!text || text === "—" || /leader/i.test(text)) return null;
    const clean = text.replace(/^\+/, "").replace(/^</, "").trim();
    const parts = clean.split(":").map((part) => Number(part));
    if (parts.some((part) => !Number.isFinite(part))) return null;
    if (parts.length === 2) return (parts[0] * 60) + parts[1];
    return parts[0];
  }
  function buildActiveBattlePairs(rows = []) {
    const ordered = rows
      .filter((row) => row?.code)
      .slice()
      .sort((a, b) => Number(a.pos || 99) - Number(b.pos || 99));
    const pairs = [];
    for (let index = 1; index < ordered.length; index += 1) {
      const leader = ordered[index - 1];
      const chaser = ordered[index];
      const gapLabel = chaser.interval && chaser.interval !== "—" ? chaser.interval : chaser.gap || "";
      const seconds = timingGapSeconds(gapLabel);
      if (seconds == null || seconds > 2.5) continue;
      pairs.push({
        priority: Math.min(Number(leader.pos || 99), Number(chaser.pos || 99)),
        scoreGap: seconds,
        kind: "battle",
        title: `${leader.code} vs ${chaser.code}`,
        body: `${leader.code} and ${chaser.code} are separated by ${gapLabel}; load the pair to watch the pressure window.`,
        conf: Math.max(0.52, Math.min(0.94, 1 - (seconds / 3))),
        a: leader.code,
        b: chaser.code,
        gap: gapLabel,
      });
    }
    pairs.sort((a, b) => activeBattleCandidateScore({ priority: b.priority, gap: b.scoreGap }) - activeBattleCandidateScore({ priority: a.priority, gap: a.scoreGap }) || a.priority - b.priority || a.scoreGap - b.scoreGap);
    return pairs.slice(0, 4).map(({ priority, scoreGap, ...pair }) => pair);
  }
  function shouldShowPartySender(message = {}, previousMessage = null, myId = "") {
    if (!message || message.system) return false;
    if (message.userId && message.userId === myId) return false;
    const senderKey = (entry = {}) => {
      if (!entry || entry.system) return "";
      if (entry.userId) return `id:${entry.userId}`;
      const name = String(entry.name || "").trim();
      return name ? `name:${name}` : "";
    };
    const current = senderKey(message);
    return !current || current !== senderKey(previousMessage);
  }
  function buildActiveInsights(options) {
    options = options || {};
    const { timingRows = [], sourceLabel = "", mode = "live", weather = {}, sessionClock = {}, battlePairs = null } = options;
    const pairs = battlePairs || buildActiveBattlePairs(timingRows);
    const insights = pairs.slice(0, 2);
    const tyreRows = timingRows
      .filter((row) => row?.code && (row.comp || row.age || row.pits || row.stints?.length))
      .slice()
      .sort((a, b) => Number(b.age || 0) - Number(a.age || 0));
    if (tyreRows.length) {
      const row = tyreRows[0];
      const age = row.age ? `${row.age} lap${Number(row.age) === 1 ? "" : "s"}` : "known";
      const compound = row.comp ? String(row.comp).toUpperCase() : "tracked tyre";
      insights.push({
        kind: "strategy",
        title: `${row.code} tyre watch`,
        body: `${row.code} is on ${compound} with ${age} of tyre age and ${row.pits || 0} recorded stop${Number(row.pits || 0) === 1 ? "" : "s"}.`,
        conf: 0.72,
      });
    }
    const contextBits = [sourceLabel, weather?.cond, sessionClock?.remaining ? `Clock ${sessionClock.remaining}` : ""].filter(Boolean);
    insights.push({
      kind: "track",
      title: mode === "replay" ? "Replay context synced" : "Live context synced",
      body: contextBits.length ? contextBits.join(" · ") : "Timing context is warming up for this session.",
      conf: timingRows.length ? 0.82 : 0.5,
    });
    return insights.slice(0, 4);
  }
  function buildActiveStrategyContext(options) {
    options = options || {};
    const { baseData = {}, timingRows = [], battlePairs = [], sourceLabel = "", mode = "live", weather = {} } = options;
    const baseContext = baseData.strategyContext || {};
    const tyreDrivers = timingRows.filter((row) => row?.code).map((row) => ({
      pos: telemetryNumber(row.pos),
      code: row.code,
      gap: row.gap || "",
      interval: row.interval || "",
      currentCompound: row.comp || "",
      tyreAge: telemetryNumber(row.age),
      pitStops: telemetryNumber(row.pits) || 0,
      stints: Array.isArray(row.stints) ? row.stints.slice(0, 5) : [],
      lastLapDuration: telemetryNumber(row.lastLapDuration),
      bestLapDuration: telemetryNumber(row.bestLapDuration),
    }));
    const compoundsUsed = Array.from(new Set(tyreDrivers.flatMap((row) => [
      row.currentCompound,
      ...(row.stints || []).map((stint) => stint.compound),
    ]).filter(Boolean)));
    return {
      ...baseContext,
      source: sourceLabel || baseContext.source || "Apexline active session timing",
      mode,
      generatedAt: new Date().toISOString(),
      race: { ...(baseContext.race || {}), ...(baseData.race || {}), weather },
      tyreStrategy: {
        available: tyreDrivers.some((row) => row.currentCompound || row.tyreAge != null || row.stints.length || row.pitStops),
        compoundsUsed,
        drivers: tyreDrivers,
      },
      timing: timingRows.slice(0, 22).map((row) => ({
        pos: row.pos,
        code: row.code,
        gap: row.gap,
        interval: row.interval,
        compound: row.comp,
        tyreAge: row.age,
        pitStops: row.pits,
      })),
      standings: (baseData.standings || []).slice(0, 22),
      constructors: (baseData.constructors || []).slice(0, 11),
      battles: battlePairs,
      newsDigest: (baseData.news || []).slice(0, 6).map((item) => ({
        source: item.source,
        title: item.title,
        category: item.category,
      })),
    };
  }
  function buildActiveAiSnapshot(options) {
    options = options || {};
    const { mode = "live", timingRows = [], baseData = {}, sourceLabel = "", weather = {}, sessionClock = null, replay = null, raceControl = [] } = options;
    const battlePairs = buildActiveBattlePairs(timingRows);
    return {
      mode,
      race: baseData.race || {},
      drivers: (baseData.drivers || []).slice(0, 22),
      timing: timingRows.slice(0, 22),
      standings: (baseData.standings || []).slice(0, 22),
      constructors: (baseData.constructors || []).slice(0, 11),
      sessions: baseData.sessions || [],
      battlePairs,
      strategyContext: buildActiveStrategyContext({ baseData, timingRows, battlePairs, sourceLabel, mode, weather }),
      weather,
      sessionClock,
      replay: mode === "replay" ? replay : null,
      raceControl: Array.isArray(raceControl) ? raceControl.slice(-8) : [],
      news: (baseData.news || []).slice(0, 8),
      source: sourceLabel,
    };
  }
  function compactAiInsightSnapshot(snapshot, capturedAtMs = Date.now()) {
    snapshot = snapshot || {};
    const mode = snapshot.mode === "replay" ? "replay" : "live";
    const replayElapsed = telemetryNumber(snapshot.replay?.elapsedSeconds);
    const lapCount = snapshot.sessionClock?.lapCount || {};
    const timingRows = Array.isArray(snapshot.timing) ? snapshot.timing : [];
    const battles = (snapshot.battlePairs || []).slice(0, 3).map((pair) => ({
      title: pair.title || "",
      a: pair.a || "",
      b: pair.b || "",
      gap: pair.gap || "",
      body: pair.body || "",
    }));
    const battleCodes = new Set(battles.flatMap((pair) => [pair.a, pair.b]).filter(Boolean));
    const insightTimingRows = timingRows.slice(0, 10)
      .concat(timingRows.slice(10).filter((row) => row?.code && battleCodes.has(row.code)));
    return {
      mode,
      capturedAtMs,
      race: {
        name: mode === "replay" ? (snapshot.replay?.raceName || snapshot.race?.name || "") : (snapshot.race?.name || ""),
        lap: lapCount.lap || (mode === "live" ? snapshot.race?.lap : ""),
        laps: lapCount.laps || (mode === "live" ? snapshot.race?.laps : ""),
      },
      source: snapshot.source || "",
      weather: {
        cond: snapshot.weather?.cond || "",
        air: snapshot.weather?.air || "",
        track: snapshot.weather?.track || "",
        rain: snapshot.weather?.rain || "",
      },
      sessionClock: {
        remaining: snapshot.sessionClock?.remaining || "",
        status: snapshot.sessionClock?.status || "",
        trackStatus: snapshot.sessionClock?.trackStatus || null,
        lapCount: snapshot.sessionClock?.lapCount || null,
      },
      replay: mode === "replay" ? {
        elapsedSeconds: replayElapsed == null ? 0 : Math.max(0, Math.round(replayElapsed)),
        timingOffsetSeconds: telemetryNumber(snapshot.replay?.timingOffsetSeconds) || 0,
        sessionKind: snapshot.replay?.sessionKind || "",
        raceName: snapshot.replay?.raceName || "",
      } : null,
      timing: insightTimingRows.map((row) => ({
        pos: row.pos,
        code: row.code,
        gap: row.gap || "",
        interval: row.interval || "",
        comp: row.comp || "",
        age: row.age || "",
        pits: row.pits || 0,
        last: row.last || "",
        best: row.best || "",
      })),
      battles,
      raceControl: (Array.isArray(snapshot.raceControl) ? snapshot.raceControl : []).slice(-5).map((message) => ({
        lap: message.lap ?? "",
        utc: message.utc || "",
        tag: message.status || message.category || "",
        text: message.text || "",
      })),
    };
  }
  function mergeAiInsightHistory(history, entry, limit = 8) {
    const max = Math.max(1, Math.round(Number(limit) || 8));
    if (!entry) return Array.isArray(history) ? history.slice(-max) : [];
    const mode = entry.mode === "replay" ? "replay" : "live";
    let rows = (Array.isArray(history) ? history : []).filter((item) => item?.mode === mode);
    if (mode === "replay") {
      const currentElapsed = telemetryNumber(entry.replay?.elapsedSeconds);
      rows = rows.filter((item) => {
        const itemElapsed = telemetryNumber(item.replay?.elapsedSeconds);
        return currentElapsed == null || itemElapsed == null || itemElapsed <= currentElapsed;
      });
    }
    rows.push(entry);
    if (mode === "replay") {
      const latestBySecond = new Map();
      rows.forEach((item) => latestBySecond.set(Math.round(telemetryNumber(item.replay?.elapsedSeconds) || 0), item));
      rows = Array.from(latestBySecond.values()).sort((a, b) => (telemetryNumber(a.replay?.elapsedSeconds) || 0) - (telemetryNumber(b.replay?.elapsedSeconds) || 0));
    }
    return rows.slice(-max);
  }
  function normalizeAutoAiInsight(answer, context = {}) {
    const alert = Array.isArray(answer?.alerts) ? answer.alerts.find((item) => item?.title || item?.body) : null;
    const summary = String(answer?.summary || "").trim();
    const rawTitle = String(alert?.title || "").trim() || (context.mode === "replay" ? "Replay insight" : "Live insight");
    const body = String(alert?.body || summary || "").trim();
    if (!body) return null;
    const text = `${rawTitle} ${body}`.toLowerCase();
    const rawKind = String(alert?.kind || "").toLowerCase();
    const kind = rawKind === "battle" || rawKind === "strategy" || rawKind === "track"
      ? rawKind
      : /gap|drs|pressure|attack|defend|battle|traffic/.test(text)
        ? "battle"
        : /pit|stop|tyre|tire|compound|undercut|overcut|stint/.test(text)
          ? "strategy"
          : "track";
    const confidence = telemetryNumber(alert?.confidence ?? alert?.conf ?? answer?.confidence);
    const conf = confidence == null ? null : Math.max(0.52, Math.min(0.94, confidence > 1 ? confidence / 100 : confidence));
    return {
      kind,
      title: rawTitle.slice(0, 72),
      body: body.slice(0, 220),
      conf,
      aiGenerated: true,
      capturedAtMs: context.capturedAtMs || Date.now(),
      replayElapsedSeconds: context.mode === "replay" ? telemetryNumber(context.replayElapsedSeconds) : null,
    };
  }
  function activeAiInsightPayload(current, history, recentInsights) {
    const priorSnapshots = (Array.isArray(history) ? history : []).slice(0, -1);
    return {
      task: "live_racing_insight",
      prompt: [
        "Generate exactly one useful Live Racing AI insight for the visible session.",
        "Find something a viewer would not know from a single timing row by comparing the current situation with priorSnapshots.",
        "Use gaps, intervals, tyre age, compounds, pit counts, lap-time hints, session clock, track status, race control messages, weather, and battle candidates when present.",
        "Do not repeat the running order, generic hype, obvious facts, or anything already covered by recentInsights.",
        "Do not use future replay knowledge; in replay mode, replay.elapsedSeconds is the hard knowledge boundary.",
        "Return JSON in the configured schema: title, body, kind (battle, strategy, or track), and confidence from 0 to 1.",
      ].join(" "),
      snapshot: {
        purpose: "live_racing_auto_insight",
        current,
        priorSnapshots,
        recentInsights: (Array.isArray(recentInsights) ? recentInsights : []).map((item) => ({ title: item.title, body: item.body })),
      },
      presentation: "single_insight_card",
    };
  }
  function telemetryPct(value) {
    const number = telemetryNumber(value);
    return number == null ? null : Math.max(0, Math.min(100, Math.round(number)));
  }
  function formatSpeed(value) {
    const number = telemetryNumber(value);
    return number == null ? "—" : String(Math.round(number));
  }
  function formatGear(value) {
    const number = telemetryNumber(value);
    if (number == null) return "—";
    return Math.round(number) === 0 ? "N" : String(Math.round(number));
  }
  function formatPct(value) {
    const pct = telemetryPct(value);
    return pct == null ? "—" : `${pct}%`;
  }
  function formatPosition(value) {
    const number = telemetryNumber(value);
    return number == null ? "P—" : `P${Math.round(number)}`;
  }
  function lapSeconds(value) {
    const text = String(value || "").trim();
    if (!text || text === "—") return null;
    const parts = text.split(":").map((part) => Number(part));
    if (parts.some((part) => !Number.isFinite(part))) return null;
    if (parts.length === 2) return (parts[0] * 60) + parts[1];
    return parts[0];
  }
  function timingDriverStatusState(row) {
    row = row || {};
    const statusText = [
      row.status,
      row.state,
      row.reason,
      row.retired ? "RETIRED" : "",
      row.knockedOut ? "KO" : "",
      row.last,
    ].map((value) => String(value || "").trim().toUpperCase()).filter(Boolean).join(" ");
    const inactiveBadge = /\b(KO|KNOCKED\s*OUT|ELIMINATED)\b/.test(statusText)
      ? "KO"
      : /\bDSQ\b/.test(statusText)
        ? "DSQ"
        : /\bDNS\b/.test(statusText)
          ? "DNS"
          : /\b(DNF|RETIRED|RET|STOPPED|STOP)\b/.test(statusText)
            ? "RETIRED"
            : null;
    const inactive = Boolean(inactiveBadge);
    let lastBadge = null;
    if (inactiveBadge) lastBadge = inactiveBadge;
    else if (/\bPIT\s*OUT\b/.test(statusText) || row.isPitOutLap) lastBadge = "PIT OUT";
    else if (/\bIN\s*PIT\b|\bPIT\b/.test(statusText) || row.inPit) lastBadge = "IN PIT";
    return { inactive, lastBadge };
  }
  function lapTone(row) {
    const last = telemetryNumber(row?.lastLapDuration) ?? lapSeconds(row?.last);
    const best = telemetryNumber(row?.bestLapDuration) ?? lapSeconds(row?.best);
    if (last == null || best == null) return "normal";
    return last <= best + 0.001 ? "personal" : "normal";
  }
  function intervalTone(value) {
    const seconds = timingGapSeconds(value);
    return seconds != null && seconds <= 1 ? "drs" : "normal";
  }
  function formatSectorTime(value) {
    const number = telemetryNumber(value);
    if (number == null) return "—";
    return number >= 60 ? `${Math.floor(number / 60)}:${(number % 60).toFixed(3).padStart(6, "0")}` : number.toFixed(3);
  }
  function formatTimingAge(value) {
    if (value == null) return "—";
    if (typeof value === "string" && !value.trim()) return "—";
    return value;
  }
  function isQualifyingSessionKind(sessionKind) {
    return /qualifying|shootout/i.test(String(sessionKind || ""));
  }
  function formatTelemetryGap(row, sessionKind = "") {
    const preferGap = isQualifyingSessionKind(sessionKind);
    const gap = String(row?.gap || "").trim();
    const interval = String(row?.interval || "").trim();
    if (preferGap && gap && gap !== "—") return gap;
    if (interval && interval !== "—") return interval;
    return gap || "—";
  }
  function formatTickerInterval(row) {
    const interval = String(row?.interval || "").trim();
    const gap = String(row?.gap || "").trim();
    if (interval && interval !== "—") return interval;
    return gap || "—";
  }
  function tickerTyreLabel(row) {
    const compound = tyreLetter(row?.comp);
    const age = telemetryNumber(row?.age);
    if (!compound && age == null) return "";
    if (!compound) return `${Math.round(age)}L`;
    if (age == null) return compound;
    return `${compound} ${Math.round(age)}`;
  }
  // Best-lap sector splits aren't always present on every row (the live F1
  // timing feed carries line.BestSectors, but other sources don't), so we also
  // accumulate each driver's fastest split from the live sectorTimes stream and
  // fall back to it. Reset whenever the session identity changes.
  const bestSectorAccum = { key: "", byCode: new Map() };
  function noteBestSectors(rows, sessionKey) {
    if (sessionKey !== bestSectorAccum.key) {
      bestSectorAccum.key = sessionKey;
      bestSectorAccum.byCode.clear();
    }
    (rows || []).forEach((row) => {
      if (!row?.code) return;
      const current = row.sectorTimes || {};
      const best = bestSectorAccum.byCode.get(row.code) || { s1: null, s2: null, s3: null };
      ["s1", "s2", "s3"].forEach((key) => {
        const value = telemetryNumber(current[key]);
        if (value != null && value > 0 && (best[key] == null || value < best[key])) best[key] = value;
      });
      bestSectorAccum.byCode.set(row.code, best);
    });
  }
  function resolveBestSectorTimes(code, feedBest) {
    const accum = bestSectorAccum.byCode.get(code) || {};
    return ["s1", "s2", "s3"].reduce((out, key) => {
      const feed = telemetryNumber(feedBest?.[key]);
      out[key] = feed != null && feed > 0 ? feed : (accum[key] ?? null);
      return out;
    }, {});
  }
  function telemetryForCode(rows, code, sessionKind = "") {
    const row = (rows || []).find((item) => item.code === code) || {};
    return {
      pos: row.pos,
      speed: row.telemetry?.speed,
      gear: row.telemetry?.gear,
      throttle: row.telemetry?.throttle,
      brake: row.telemetry?.brake,
      gap: formatTelemetryGap(row, sessionKind),
      interval: row.interval || "—",
      intervalTone: intervalTone(row.interval),
      leaderGap: row.gap || "—",
      last: row.last || "—",
      lastTone: lapTone(row),
      best: row.best || "—",
      sectors: row.sectors,
      sectorTimes: row.sectorTimes,
      bestSectorTimes: resolveBestSectorTimes(code, row.bestSectorTimes),
      comp: row.comp,
      age: row.age,
    };
  }
  function streamDescriptor(source) {
    if (!source) return null;
    if (typeof source === "object") return source.manifestUrl || source.url ? { ...source, manifestUrl: source.manifestUrl || source.url } : null;
    const url = String(source || "").trim();
    if (!url) return null;
    return { id: url, label: "Manual stream", manifestUrl: url, manifestType: /\.mpd(?:[?#]|$)/i.test(url) ? "dash" : "hls", headers: {} };
  }
  function streamUrl(source) { return streamDescriptor(source)?.manifestUrl || ""; }
  function streamRecord(source) {
    const descriptor = streamDescriptor(source);
    if (!descriptor) return "";
    if (typeof source === "string") return source;
    return "";
  }
  function preferredMainF1TvFeed(feeds = []) {
    const candidates = (Array.isArray(feeds) ? feeds : []).filter((feed) => feed && !feed.driverCode && feed.kind !== "onboard");
    const scored = candidates.map((feed, index) => {
      const text = [feed.label, feed.feedId, feed.kind].filter(Boolean).join(" ").toLowerCase();
      let score = 0;
      // A feed with no resolvable manifest plays nothing — never let it win the main F1 TV slot.
      if (!streamDescriptor(feed)) score -= 100;
      if (/\bf1\s*(?:tv|live)\b|f1tv|live channel/.test(text)) score += 30;
      if (feed.kind === "world" || feed.feedId === "WORLD") score += 10;
      if (/international|sky|croft|crofty/.test(text)) score -= 25;
      return { feed, index, score };
    });
    scored.sort((a, b) => b.score - a.score || a.index - b.index);
    return scored[0]?.feed || feeds[0] || null;
  }
  // F1 TV channel feeds carry raw metadata (channel_id:1033 uuid:…) in their label.
  // Map them to clean, human-readable names for the feed picker and tiles.
  function channelDisplayName(feed = {}) {
    const named = String(feed.title || feed.name || "").trim();
    const looksRaw = /:\S|streamtype|channelid|pipelineversion|playapiversion|cdntype|cmaf/i.test(named);
    const text = `${named} ${feed.label || ""} ${feed.feedId || ""} ${feed.kind || ""}`.toLowerCase();
    if (/international|crof|sky/.test(text)) return "International";
    if (/pit\s*lane/.test(text)) return "Pit Lane";
    if (/driver\s*tracker|\btracker\b/.test(text)) return "Driver Tracker";
    if (/\bdata\b/.test(text)) return "Data Channel";
    if (feed.kind === "world" || feed.feedId === "WORLD" || /\b(main|world feed|world|wif|presentation)\b/.test(text) || /f1\s*(tv|live)/.test(text)) return "F1 TV";
    if (named && !looksRaw && named.length <= 40) return named;
    const idMatch = /^\d+$/.test(String(feed.feedId || "")) ? String(feed.feedId) : (String(feed.label || "").match(/channel_?id[:=]?\s*(\d+)/i)?.[1] || String(feed.label || "").match(/(\d{3,})/)?.[1] || "");
    // Observed F1 TV additional-stream channel ids (verified against a past race) — used only
    // when the feed metadata gives no title or keyword to name the channel from.
    const idNames = { "1003": "Driver Tracker", "1004": "Data Channel", "1025": "International" };
    if (idMatch && idNames[idMatch]) return idNames[idMatch];
    return idMatch ? `Channel ${idMatch}` : "Channel";
  }
  function replayTimelineStartSeconds(feed) {
    const utcMs = Date.parse(feed?.videoStartUtc || "");
    if (Number.isFinite(utcMs)) return utcMs / 1000;
    const archiveSeconds = Number(feed?.videoStartArchiveSeconds);
    return Number.isFinite(archiveSeconds) ? archiveSeconds : null;
  }
  function replayTargetMediaTime(masterTime, masterFeed, targetFeed) {
    const fallbackTime = Math.max(0, Number(masterTime || 0));
    const masterStart = replayTimelineStartSeconds(masterFeed);
    const targetStart = replayTimelineStartSeconds(targetFeed);
    if (masterStart == null || targetStart == null) return fallbackTime;
    return Math.max(0, fallbackTime + masterStart - targetStart);
  }
  function readStreamSources() {
    try {
      const parsed = JSON.parse(localStorage.getItem("pw-stream-sources") || "{}");
      const playable = {};
      Object.entries(parsed && typeof parsed === "object" ? parsed : {}).forEach(([key, value]) => {
        if (streamDescriptor(value)) playable[key] = value;
      });
      return playable;
    } catch {
      return {};
    }
  }
  function saveStreamSources(sources) {
    const persisted = {};
    Object.entries(sources || {}).forEach(([key, value]) => {
      const record = streamRecord(value);
      if (record) persisted[key] = record;
    });
    localStorage.setItem("pw-stream-sources", JSON.stringify(persisted));
  }
  function cleanPitWallError(error, fallback = "Something went wrong.") {
    const message = String(error?.message || error || fallback);
    return message
      .replace(/^Error invoking remote method '[^']+':\s*/i, "")
      .replace(/^Error:\s*/i, "")
      .trim() || fallback;
  }
  function readLivePrefs() {
    try { return JSON.parse(localStorage.getItem("pw-settings") || "{}"); }
    catch { return {}; }
  }
  const PANEL_SIZE_STORAGE_KEY = "pw-live-panel-sizes";
  const TIMING_COLUMN_STORAGE_KEY = "pw-live-timing-columns";
  const TIMING_COLUMNS = [
    { id: "driver", label: "Driver", width: "78px" },
    { id: "name", label: "Name", width: "86px" },
    { id: "team", label: "Team", width: "72px" },
    { id: "last", label: "Last lap", width: "78px" },
    { id: "best", label: "Best lap", width: "74px" },
    { id: "gap", label: "Gap", width: "58px" },
    { id: "interval", label: "Interval", width: "58px" },
    { id: "s1", label: "S1 μS", width: "48px" },
    { id: "s2", label: "S2 μS", width: "48px" },
    { id: "s3", label: "S3 μS", width: "48px" },
    { id: "s1Time", label: "S1 time", width: "54px" },
    { id: "s2Time", label: "S2 time", width: "54px" },
    { id: "s3Time", label: "S3 time", width: "54px" },
    { id: "tyre", label: "Tyre", width: "36px" },
    { id: "compound", label: "Comp", width: "44px" },
    { id: "age", label: "Age", width: "30px" },
    { id: "pits", label: "Pits", width: "32px" },
    { id: "stints", label: "Stints", width: "48px" },
    { id: "speed", label: "Speed", width: "48px" },
    { id: "gear", label: "Gear", width: "34px" },
    { id: "throttle", label: "Thr", width: "42px" },
    { id: "brake", label: "Brk", width: "38px" },
  ];
  const DEFAULT_TIMING_COLUMNS = ["driver", "last", "best", "gap", "interval", "s1", "s2", "s3", "tyre", "age"];
  const TIMING_SECTOR_COLUMNS = ["s1", "s2", "s3"];
  const MINI_SECTOR_FALLBACK_COUNT = 6;
  const MINI_SECTOR_MAX_COUNT = 10;
  const MINI_SECTOR_SEGMENT_WIDTH = 3;
  const MINI_SECTOR_GAP = 1.5;
  const MINI_SECTOR_COLUMN_PAD = 4;
  const MINI_SECTOR_COLUMN_MIN = 34;
  function clampPanelSize(value, min, max) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return min;
    return Math.max(min, Math.min(max, Math.round(numeric)));
  }
  function clampPanelPct(value, min = 22, max = 78) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return 50;
    return Math.max(min, Math.min(max, Math.round(numeric * 10) / 10));
  }
  function clampBroadcastTickerRows(value) {
    return clampPanelSize(value || 3, 1, 3);
  }
  function normalizeLivePanelSizes(saved = {}) {
    return {
      timingWidth: clampPanelSize(saved.timingWidth || 340, 260, 760),
      insightsHeight: clampPanelSize(saved.insightsHeight || 280, 180, 460),
      focusOnboardHeight: clampPanelSize(saved.focusOnboardHeight || 220, 150, 380),
      broadcastTickerRows: clampBroadcastTickerRows(saved.broadcastTickerRows),
      battleSplit: clampPanelPct(saved.battleSplit || 50, 28, 72),
      quadCol: clampPanelPct(saved.quadCol || 50, 28, 72),
      quadRow: clampPanelPct(saved.quadRow || 50, 28, 72),
      dataColA: clampPanelPct(saved.dataColA || 33, 20, 60),
      dataColB: clampPanelPct(saved.dataColB || 33, 18, 60),
      dataRow: clampPanelPct(saved.dataRow || 50, 28, 72),
      sidecarWidth: clampPanelSize(saved.sidecarWidth || 300, 220, 480),
      sidecarCount: clampPanelSize(saved.sidecarCount || 0, 0, 3),
      worldLockAspect: Boolean(saved.worldLockAspect),
    };
  }
  function readLivePanelSizes() {
    try {
      const saved = JSON.parse(localStorage.getItem(PANEL_SIZE_STORAGE_KEY) || "{}");
      return normalizeLivePanelSizes(saved);
    } catch {
      return { timingWidth: 340, insightsHeight: 280, focusOnboardHeight: 220, broadcastTickerRows: 3, battleSplit: 50, quadCol: 50, quadRow: 50, dataColA: 33, dataColB: 33, dataRow: 50, sidecarWidth: 300, sidecarCount: 0, worldLockAspect: false };
    }
  }
  const CUSTOM_LAYOUT_STORAGE_KEY = "pw-live-custom-layouts";
  const CUSTOM_TILE_MIN_PCT = 12;
  const CUSTOM_PRESET_PREFIX = "custom:";
  const CUSTOM_TICKER_MIN_H = 64;
  const CUSTOM_TICKER_MAX_H = 320;
  function clampCustomTickerRows(value) {
    const numeric = Math.round(Number(value));
    if (!Number.isFinite(numeric)) return 0;
    return Math.max(0, Math.min(4, numeric));
  }
  function clampCustomTickerHeight(value) {
    const numeric = Math.round(Number(value));
    if (!Number.isFinite(numeric)) return 140;
    return Math.max(CUSTOM_TICKER_MIN_H, Math.min(CUSTOM_TICKER_MAX_H, numeric));
  }
  function customLayoutPresetId(layoutId) {
    return CUSTOM_PRESET_PREFIX + layoutId;
  }
  function customLayoutIdFromPreset(preset) {
    return typeof preset === "string" && preset.startsWith(CUSTOM_PRESET_PREFIX) ? preset.slice(CUSTOM_PRESET_PREFIX.length) : "";
  }
  function clampCustomTileGeometry(rect = {}) {
    const numeric = (value, fallback) => (Number.isFinite(Number(value)) ? Number(value) : fallback);
    const round = (value) => Math.round(value * 10) / 10;
    const w = round(Math.min(100, Math.max(CUSTOM_TILE_MIN_PCT, numeric(rect.w, 32))));
    const h = round(Math.min(100, Math.max(CUSTOM_TILE_MIN_PCT, numeric(rect.h, 32))));
    const x = round(Math.min(100 - w, Math.max(0, numeric(rect.x, 0))));
    const y = round(Math.min(100 - h, Math.max(0, numeric(rect.y, 0))));
    return { x, y, w, h };
  }
  function customTilesOverlap(a, b) {
    return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
  }
  function customTileCollides(rect, otherTiles = []) {
    return otherTiles.some((tile) => customTilesOverlap(rect, tile));
  }
  function applyCustomDrag(start, mode, dx, dy) {
    if (mode === "move") return { ...start, x: start.x + dx, y: start.y + dy };
    const rect = { ...start };
    if (mode.includes("e")) rect.w = start.w + dx;
    if (mode.includes("s")) rect.h = start.h + dy;
    if (mode.includes("w")) { const right = start.x + start.w; rect.x = Math.min(start.x + dx, right - CUSTOM_TILE_MIN_PCT); rect.w = right - rect.x; }
    if (mode.includes("n")) { const bottom = start.y + start.h; rect.y = Math.min(start.y + dy, bottom - CUSTOM_TILE_MIN_PCT); rect.h = bottom - rect.y; }
    return rect;
  }
  function snapCustomEdge(value, edges, threshold) {
    let best = null;
    edges.forEach((edge) => {
      const distance = Math.abs(edge - value);
      if (distance <= threshold && (best == null || distance < Math.abs(best - value))) best = edge;
    });
    return best;
  }
  function snapCustomTileGeometry(rect, otherTiles = [], threshold = 1.5, mode = "move") {
    const xEdges = [0, 100];
    const yEdges = [0, 100];
    otherTiles.forEach((tile) => {
      xEdges.push(tile.x, tile.x + tile.w);
      yEdges.push(tile.y, tile.y + tile.h);
    });
    const snapped = { ...rect };
    if (mode === "move") {
      const left = snapCustomEdge(rect.x, xEdges, threshold);
      const right = snapCustomEdge(rect.x + rect.w, xEdges, threshold);
      if (left != null) snapped.x = left;
      else if (right != null) snapped.x = right - rect.w;
      const top = snapCustomEdge(rect.y, yEdges, threshold);
      const bottom = snapCustomEdge(rect.y + rect.h, yEdges, threshold);
      if (top != null) snapped.y = top;
      else if (bottom != null) snapped.y = bottom - rect.h;
      return snapped;
    }
    if (mode.includes("e")) {
      const right = snapCustomEdge(rect.x + rect.w, xEdges, threshold);
      if (right != null) snapped.w = right - rect.x;
    }
    if (mode.includes("s")) {
      const bottom = snapCustomEdge(rect.y + rect.h, yEdges, threshold);
      if (bottom != null) snapped.h = bottom - rect.y;
    }
    if (mode.includes("w")) {
      const left = snapCustomEdge(rect.x, xEdges, threshold);
      if (left != null) { snapped.w = rect.w + (rect.x - left); snapped.x = left; }
    }
    if (mode.includes("n")) {
      const top = snapCustomEdge(rect.y, yEdges, threshold);
      if (top != null) { snapped.h = rect.h + (rect.y - top); snapped.y = top; }
    }
    return snapped;
  }
  function resolveCustomOnboardCode(source = {}, context = {}) {
    const cleanCode = (value) => String(value || "").trim().toUpperCase();
    const byCode = context.byCode || {};
    const hasByCode = Boolean(Object.keys(byCode).length);
    const validCode = (value) => {
      const code = cleanCode(value);
      if (!code) return "";
      return !hasByCode || byCode[code] ? code : "";
    };
    const unique = (codes) => {
      const picked = [];
      codes.forEach((code) => {
        const clean = validCode(code);
        if (clean && !picked.includes(clean)) picked.push(clean);
      });
      return picked;
    };
    if (source.type === "onboard") return validCode(source.code);
    if (source.type !== "smart-onboard") return "";
    const timingCodes = (context.timingRows || []).map((row) => row.code);
    const standingCodes = (context.standings || []).map((row) => row.code);
    const driverCodes = (context.drivers || []).map((driver) => driver.code);
    const fallbackCodes = unique([context.selectedCode, ...(context.fallbackCodes || []), ...timingCodes, ...standingCodes, ...driverCodes]);
    const leader = validCode(context.timingRows?.[0]?.code) || validCode(context.standings?.[0]?.code) || validCode(context.drivers?.[0]?.code) || fallbackCodes[0] || "";
    const favorites = unique(context.profile?.favoriteDrivers || []);
    const sessionKind = String(context.sessionKind || "").toLowerCase();
    const nonRaceSession = sessionKind && !/race|sprint|grand prix/.test(sessionKind);
    const topTimingCodes = unique((context.timingRows || [])
      .slice()
      .sort((a, b) => Number(a?.pos || 99) - Number(b?.pos || 99))
      .map((row) => row?.code));
    if (source.mode === "leader") return leader;
    if (source.mode === "favorite1") return favorites[0] || "";
    if (source.mode === "favorite2") return favorites[1] || "";
    if (source.mode === "battle-primary") return nonRaceSession ? (topTimingCodes[0] || leader) : leader;
    if (source.mode === "battle-secondary") {
      if (nonRaceSession) return topTimingCodes.find((code) => code !== (topTimingCodes[0] || leader)) || "";
      return favorites.find((code) => code !== leader) || fallbackCodes.find((code) => code !== leader) || "";
    }
    return "";
  }
  function normalizeCustomTileSource(raw = {}) {
    if (!raw || typeof raw !== "object") return null;
    if (raw.type === "timing") return { type: "timing" };
    if (raw.type === "onboard" && typeof raw.code === "string" && raw.code) return { type: "onboard", code: raw.code };
    if (raw.type === "smart-onboard" && ["leader", "favorite1", "favorite2", "battle-primary", "battle-secondary"].includes(raw.mode)) return { type: "smart-onboard", mode: raw.mode };
    if (raw.type === "channel" && typeof raw.feedId === "string" && raw.feedId) return { type: "channel", feedId: raw.feedId };
    return null;
  }
  function customTileSourceKey(source) {
    if (!source) return "";
    if (source.type === "timing") return "timing";
    if (source.type === "onboard") return "onboard:" + source.code;
    if (source.type === "smart-onboard") return "smart-onboard:" + source.mode;
    if (source.type === "channel") return "channel:" + source.feedId;
    return "";
  }
  function customPaneIdForSource(source) {
    if (!source) return "";
    if (source.type === "timing") return "TIMING";
    if (source.type === "onboard") return "DRIVER-" + source.code;
    if (source.type === "smart-onboard") return "SMART-ONBOARD-" + source.mode;
    if (source.type === "channel") return "CHANNEL-" + source.feedId;
    return "";
  }
  function normalizeCustomLayouts(raw) {
    const rawLayouts = Array.isArray(raw?.layouts) ? raw.layouts : [];
    const seenIds = new Set();
    const layouts = rawLayouts
      .filter((layout) => layout && typeof layout === "object" && typeof layout.id === "string" && layout.id)
      .filter((layout) => (seenIds.has(layout.id) ? false : (seenIds.add(layout.id), true)))
      .map((layout) => {
        const seenSources = new Set();
        const tiles = (Array.isArray(layout.tiles) ? layout.tiles : [])
          .map((tile) => {
            const source = normalizeCustomTileSource(tile?.source);
            if (!source) return null;
            const sourceKey = customTileSourceKey(source);
            if (seenSources.has(sourceKey)) return null;
            seenSources.add(sourceKey);
            const id = typeof tile.id === "string" && tile.id ? tile.id : "t-" + sourceKey;
            return { id, source, ...clampCustomTileGeometry(tile), tickerRows: clampCustomTickerRows(tile.tickerRows), tickerHeight: clampCustomTickerHeight(tile.tickerHeight), ...(tile.lockAspect === true ? { lockAspect: true } : {}) };
          })
          .filter(Boolean);
        const name = typeof layout.name === "string" && layout.name.trim() ? layout.name.trim() : "Custom layout";
        return { id: layout.id, name, tiles };
      });
    return { layouts };
  }
  function shouldApplyProfileCustomLayouts(current, incoming) {
    const currentLayouts = normalizeCustomLayouts(current).layouts;
    const incomingLayouts = normalizeCustomLayouts(incoming).layouts;
    return currentLayouts.length === 0 && incomingLayouts.length > 0;
  }
  function nextCustomLayoutName(layouts = []) {
    const names = new Set(layouts.map((layout) => layout.name));
    let index = layouts.length + 1;
    let candidate = `Custom layout ${index}`;
    while (names.has(candidate)) { index += 1; candidate = `Custom layout ${index}`; }
    return candidate;
  }
  function defaultCustomTileRect(existingTiles = []) {
    const standard = 32;
    const sizes = [];
    for (let size = standard; size >= CUSTOM_TILE_MIN_PCT; size -= 4) sizes.push(size);
    const candidates = [{ w: standard, h: standard }]
      .concat(sizes.flatMap((w) => sizes.map((h) => ({ w, h }))).filter((rect) => rect.w !== standard || rect.h !== standard)
        .sort((a, b) => (b.w * b.h) - (a.w * a.h)));
    for (const candidate of candidates) {
      for (let y = 0; y + candidate.h <= 100; y += 4) {
        for (let x = 0; x + candidate.w <= 100; x += 4) {
          const rect = clampCustomTileGeometry({ x, y, w: candidate.w, h: candidate.h });
          if (!customTileCollides(rect, existingTiles)) return rect;
        }
      }
    }
    return null;
  }
  function readCustomLayouts() {
    try {
      return normalizeCustomLayouts(JSON.parse(localStorage.getItem(CUSTOM_LAYOUT_STORAGE_KEY) || "{}"));
    } catch {
      return { layouts: [] };
    }
  }
  function readTimingColumns() {
    try {
      const saved = JSON.parse(localStorage.getItem(TIMING_COLUMN_STORAGE_KEY) || "[]");
      const valid = saved.filter((id) => TIMING_COLUMNS.some((column) => column.id === id));
      return valid.includes("driver") ? valid : DEFAULT_TIMING_COLUMNS;
    } catch {
      return DEFAULT_TIMING_COLUMNS;
    }
  }
  function miniSectorVisibleCount(segments) {
    return segments?.length ? Math.min(segments.length, MINI_SECTOR_MAX_COUNT) : MINI_SECTOR_FALLBACK_COUNT;
  }
  function miniSectorColumnWidth(count) {
    const ticks = Math.max(1, Math.min(MINI_SECTOR_MAX_COUNT, count || MINI_SECTOR_FALLBACK_COUNT));
    const width = (ticks * MINI_SECTOR_SEGMENT_WIDTH) + (Math.max(0, ticks - 1) * MINI_SECTOR_GAP) + MINI_SECTOR_COLUMN_PAD;
    return `${Math.ceil(Math.max(MINI_SECTOR_COLUMN_MIN, width))}px`;
  }
  function timingSectorCounts(rows = []) {
    return TIMING_SECTOR_COLUMNS.reduce((counts, id) => {
      counts[id] = Math.max(MINI_SECTOR_FALLBACK_COUNT, ...rows.map((row) => miniSectorVisibleCount(row.sectors?.[id])));
      return counts;
    }, {});
  }
  function timingGridStyle(columns, sectorCounts = {}) {
    const widths = columns.map((id) => {
      if (TIMING_SECTOR_COLUMNS.includes(id)) return miniSectorColumnWidth(sectorCounts[id]);
      return TIMING_COLUMNS.find((column) => column.id === id)?.width || "72px";
    });
    return { gridTemplateColumns: widths.join(" ") };
  }
  function useTimingRowMotion(rows) {
    const rowRefs = React.useRef(new Map());
    const previousRects = React.useRef(new Map());
    const [movingRows, setMovingRows] = React.useState({});
    const rowSignature = (rows || []).map((row) => `${row.code}:${row.pos}`).join("|");
    const registerTimingRow = React.useCallback((code, node) => {
      if (!code) return;
      if (node) rowRefs.current.set(code, node);
      else rowRefs.current.delete(code);
    }, []);

    React.useLayoutEffect(() => {
      const nextRects = new Map();
      rowRefs.current.forEach((node, code) => {
        if (node?.isConnected) nextRects.set(code, node.getBoundingClientRect());
      });
      const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
      if (reduceMotion) {
        previousRects.current = nextRects;
        return undefined;
      }
      const moving = {};
      nextRects.forEach((rect, code) => {
        const previous = previousRects.current.get(code);
        const node = rowRefs.current.get(code);
        if (!previous || !node) return;
        const deltaY = previous.top - rect.top;
        if (Math.abs(deltaY) < 1) return;
        moving[code] = true;
        node.style.transition = "none";
        node.style.transform = `translateY(${deltaY}px)`;
        node.getBoundingClientRect();
        node.style.transition = `transform ${TIMING_ROW_MOTION_MS}ms cubic-bezier(0.2, 0, 0, 1)`;
        node.style.transform = "";
        window.setTimeout(() => {
          node.style.transition = "";
        }, TIMING_ROW_MOTION_MS + 40);
      });
      previousRects.current = nextRects;
      if (!Object.keys(moving).length) return undefined;
      setMovingRows(moving);
      const timer = window.setTimeout(() => setMovingRows({}), TIMING_ROW_MOTION_MS + 80);
      return () => window.clearTimeout(timer);
    }, [rowSignature]);

    return { registerTimingRow, movingRows };
  }
  function tyreLetter(compound) {
    const text = String(compound || "").toLowerCase();
    if (text.includes("soft")) return "S";
    if (text.includes("medium")) return "M";
    if (text.includes("hard")) return "H";
    if (text.includes("inter")) return "I";
    if (text.includes("wet")) return "W";
    return "—";
  }
  function tyreRing(compound) {
    const text = String(compound || "").toLowerCase();
    if (text.includes("soft")) return "var(--tyre-soft)";
    if (text.includes("medium")) return "var(--tyre-medium)";
    if (text.includes("hard")) return "var(--tyre-hard)";
    if (text.includes("inter")) return "var(--tyre-inter)";
    if (text.includes("wet")) return "var(--tyre-wet)";
    return "var(--border-default)";
  }
  function hasTimingValue(value) {
    if (Array.isArray(value)) return value.some(hasTimingValue);
    if (value && typeof value === "object") return Object.values(value).some(hasTimingValue);
    if (typeof value === "number") return Number.isFinite(value);
    if (typeof value === "string") {
      const text = value.trim();
      return Boolean(text && text !== "—");
    }
    return value != null;
  }
  function hasRealTimingRows(rows) {
    return Array.isArray(rows) && rows.some((row) => {
      if (!row || typeof row !== "object") return false;
      const code = String(row.code || "").trim();
      if (!code) return false;
      return [
        row.pos,
        row.last,
        row.best,
        row.gap,
        row.interval,
        row.comp,
        row.age,
        row.sectors,
        row.sectorTimes,
        row.telemetry,
      ].some(hasTimingValue);
    });
  }
  function TimingColumnMenu({ columns, onToggle }) {
    return (
      <div className="timing-config">
        {TIMING_COLUMNS.map((column) => (
          <button key={column.id} className="timing-config__item" data-active={columns.includes(column.id)} aria-pressed={columns.includes(column.id)} onClick={() => onToggle(column.id)}>
            <Icon name={columns.includes(column.id) ? "check" : "plus"} size={12} /> {column.label}
          </button>
        ))}
      </div>
    );
  }
  function MiniSectorBar({ segments = [], compact = false, slots }) {
    // Always render a fixed set of slots (the column's per-sector count) so the
    // ticks stay present and fill in place as tones arrive — instead of popping
    // in one by one. Not-yet-run micro-sectors render as "off"; out-lap segments
    // arrive as "blue".
    const count = Math.min(
      compact ? 6 : (slots || (segments.length ? segments.length : MINI_SECTOR_FALLBACK_COUNT)),
      MINI_SECTOR_MAX_COUNT
    );
    return <span className="mini-sector">{Array.from({ length: count }, (_, index) => <i className="mini-sector__seg" data-tone={segments[index] || "off"} key={index} />)}</span>;
  }
  function TimingTowerHeader({ columns, sectorCounts }) {
    return (
      <div className="timing-tower__head" style={timingGridStyle(columns, sectorCounts)}>
        {columns.map((id) => <span key={id}>{TIMING_COLUMNS.find((column) => column.id === id)?.label || id}</span>)}
      </div>
    );
  }
  function TimingTowerRow({ row, driver, columns, sectorCounts, selected, moving, elimination, registerRow, onClick }) {
    const setRowRef = React.useCallback((node) => registerRow?.(row.code, node), [registerRow, row.code]);
    const statusState = timingDriverStatusState(row);
    const lastCellClass = "timing-cell" + (statusState.lastBadge ? " timing-cell--status" : row.last && row.last === row.best ? " timing-cell--pill" : "");
    const cells = {
      driver: <span className="timing-driver"><span className="timing-driver__pos">{row.pos}</span><span className="timing-driver__code" style={{ "--driver-color": driver.color || "var(--accent)" }}>{row.code}</span></span>,
      name: <span className="timing-cell">{driver.name || row.code || "—"}</span>,
      team: <span className="timing-cell" style={{ color: driver.color || "var(--text-secondary)" }}>{driver.abbr || driver.team || "—"}</span>,
      last: <span className={lastCellClass}>{statusState.lastBadge || row.last || "—"}</span>,
      best: <span className="timing-cell">{statusState.inactive ? "—" : row.best || "—"}</span>,
      gap: <span className="timing-cell timing-cell--gap">{statusState.inactive ? "—" : row.gap || "—"}</span>,
      interval: <span className="timing-cell">{statusState.inactive ? "—" : row.interval || "—"}</span>,
      s1: <MiniSectorBar segments={row.sectors?.s1} slots={sectorCounts.s1} />,
      s2: <MiniSectorBar segments={row.sectors?.s2} slots={sectorCounts.s2} />,
      s3: <MiniSectorBar segments={row.sectors?.s3} slots={sectorCounts.s3} />,
      s1Time: <span className="timing-cell">{formatSectorTime(row.sectorTimes?.s1)}</span>,
      s2Time: <span className="timing-cell">{formatSectorTime(row.sectorTimes?.s2)}</span>,
      s3Time: <span className="timing-cell">{formatSectorTime(row.sectorTimes?.s3)}</span>,
      tyre: <span className="tyre-dot" style={{ "--tyre-ring": tyreRing(row.comp) }}>{tyreLetter(row.comp)}</span>,
      compound: <span className="timing-cell">{row.comp || "—"}</span>,
      age: <span className="timing-cell">{formatTimingAge(row.age)}</span>,
      pits: <span className="timing-cell">{row.pits || "0"}</span>,
      stints: <span className="timing-cell">{Array.isArray(row.stints) && row.stints.length ? row.stints.length : "—"}</span>,
      speed: <span className="timing-cell">{formatSpeed(row.telemetry?.speed)}</span>,
      gear: <span className="timing-cell">{formatGear(row.telemetry?.gear)}</span>,
      throttle: <span className="timing-cell">{formatPct(row.telemetry?.throttle)}</span>,
      brake: <span className="timing-cell">{formatPct(row.telemetry?.brake)}</span>,
    };
    return <button ref={setRowRef} type="button" className="timing-tower__row" data-selected={selected} data-elimination={elimination ? "true" : "false"} data-inactive={statusState.inactive ? "true" : "false"} data-moving={moving ? "true" : "false"} style={timingGridStyle(columns, sectorCounts)} onClick={onClick}>{columns.map((id) => <span key={id}>{cells[id]}</span>)}</button>;
  }
  function TimingTowerStatus({ tone = "loading", title, body }) {
    return (
      <div className="timing-status" data-tone={tone} role={tone === "error" ? "status" : "progressbar"} aria-label={title}>
        <span className="timing-status__icon"><Icon name={tone === "error" ? "alert" : "timer"} size={18} /></span>
        <div className="timing-status__title">{title}</div>
        {body && <div className="timing-status__body">{body}</div>}
      </div>
    );
  }
  function RaceControlMessages({ messages }) {
    const visible = Array.isArray(messages) ? messages.slice(-4).reverse() : [];
    if (!visible.length) return null;
    const timeLabel = (message) => {
      if (message.lap != null && message.lap !== "") return `L${message.lap}`;
      const date = Date.parse(message.utc || "");
      if (Number.isFinite(date)) return new Date(date).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      return "RC";
    };
    return (
      <section className="race-control" aria-label="Race control messages">
        <div className="race-control__head"><Icon name="flag" size={12} /> Race Control</div>
        <div className="race-control__list">
          {visible.map((message, index) => (
            <div className="race-control__msg" key={`${message.utc || index}:${message.text || ""}`}>
              <span className="race-control__meta">{timeLabel(message)}</span>
              <span className="race-control__text">
                {(message.status || message.category) && <span className="race-control__tag">{message.status || message.category} · </span>}
                {message.text}
              </span>
            </div>
          ))}
        </div>
      </section>
    );
  }
	  function aiRequestOptions(payload) {
	    const selected = localStorage.getItem("pw-ai-model") || "";
	    if (!selected || selected === "local") return payload;
	    const [provider, ...modelParts] = selected.split(":");
	    if (provider !== "codex" && provider !== "grok") return payload;
	    const model = modelParts.join(":");
	    return provider && model ? { ...payload, provider, model } : payload;
	  }
	  function markdownBlocks(text) {
	    const lines = String(text || "").replace(/\r\n/g, "\n").split("\n");
	    const blocks = [];
	    let index = 0;
	    while (index < lines.length) {
	      const line = lines[index].trim();
	      if (!line) {
	        index += 1;
	        continue;
	      }
	      const heading = line.match(/^(#{1,4})\s+(.+)$/);
	      if (heading) {
	        blocks.push({ kind: "heading", level: heading[1].length, text: heading[2].trim() });
	        index += 1;
	        continue;
	      }
	      if (/^[-*]\s+/.test(line)) {
	        const items = [];
	        while (index < lines.length && /^[-*]\s+/.test(lines[index].trim())) {
	          items.push(lines[index].trim().replace(/^[-*]\s+/, "").trim());
	          index += 1;
	        }
	        blocks.push({ kind: "list", items });
	        continue;
	      }
	      const paragraph = [line];
	      index += 1;
	      while (index < lines.length) {
	        const next = lines[index].trim();
	        if (!next || /^(#{1,4})\s+/.test(next) || /^[-*]\s+/.test(next)) break;
	        paragraph.push(next);
	        index += 1;
	      }
	      blocks.push({ kind: "paragraph", text: paragraph.join(" ") });
	    }
	    return blocks;
	  }
	  function inlineMarkdownParts(text) {
	    const source = String(text || "");
	    const parts = [];
	    const pattern = /(\*\*[^*]+\*\*|`[^`]+`)/g;
	    let index = 0;
	    let match;
	    while ((match = pattern.exec(source))) {
	      if (match.index > index) parts.push({ kind: "text", text: source.slice(index, match.index) });
	      const token = match[0];
	      parts.push(token.startsWith("**")
	        ? { kind: "strong", text: token.slice(2, -2) }
	        : { kind: "code", text: token.slice(1, -1) });
	      index = match.index + token.length;
	    }
	    if (index < source.length) parts.push({ kind: "text", text: source.slice(index) });
	    return parts;
	  }
	  function renderInlineMarkdown(text, keyPrefix) {
	    return inlineMarkdownParts(text).map((part, index) => {
	      const key = `${keyPrefix}-${index}`;
	      if (part.kind === "strong") return <strong key={key}>{part.text}</strong>;
	      if (part.kind === "code") return <code key={key}>{part.text}</code>;
	      return <React.Fragment key={key}>{part.text}</React.Fragment>;
	    });
	  }
	  function renderMarkdownText(text) {
	    return (
	      <div className="msg-md">
	        {markdownBlocks(text).map((block, index) => {
	          if (block.kind === "heading") return <h4 key={index}>{renderInlineMarkdown(block.text, `h-${index}`)}</h4>;
	          if (block.kind === "list") return <ul key={index}>{block.items.map((item, itemIndex) => <li key={itemIndex}>{renderInlineMarkdown(item, `li-${index}-${itemIndex}`)}</li>)}</ul>;
	          return <p key={index}>{renderInlineMarkdown(block.text, `p-${index}`)}</p>;
	        })}
	      </div>
	    );
	  }
	  function AiMessage({ message }) {
	    if (message.thinking) {
	      return (
	        <div className="msg msg--ai msg--thinking" role="status" aria-live="polite">
	          <span>{message.text || "Engineer is thinking"}</span>
	          <span className="thinking-dots" aria-hidden="true"><i /><i /><i /></span>
	        </div>
	      );
	    }
	    return (
	      <div className={"msg " + (message.who === "me" ? "msg--me" : "msg--ai")}>
	        {message.who === "ai" ? renderMarkdownText(message.text) : message.text}
	      </div>
	    );
	  }
  function clampSyncLatency(value) {
    const number = Number(value);
    return Number.isFinite(number) ? Math.max(8, Math.min(90, Math.round(number * 10) / 10)) : DEFAULT_WORLD_SYNC_TARGET;
  }
  function preferredWorldSyncTarget(prefs = readLivePrefs()) {
    return clampSyncLatency(prefs.f1LiveLatency == null ? DEFAULT_WORLD_SYNC_TARGET : prefs.f1LiveLatency);
  }
  function defaultSyncTarget(key, worldTarget = preferredWorldSyncTarget()) {
    return key === "WORLD" ? clampSyncLatency(worldTarget) : clampSyncLatency(worldTarget + DEFAULT_NON_WORLD_SYNC_OFFSET);
  }
  function adjustDependentSyncTargets(targets, delta) {
    const next = { ...(targets || {}) };
    Object.keys(next).forEach((key) => {
      if (key !== "WORLD") next[key] = clampSyncLatency(Number(next[key]) + delta);
    });
    return next;
  }
  function readSyncSettings() {
    try {
      const parsed = JSON.parse(localStorage.getItem(SYNC_STORAGE_KEY) || "{}");
      const targets = parsed.targets && typeof parsed.targets === "object" ? parsed.targets : {};
      const worldTarget = preferredWorldSyncTarget();
      const previousWorld = clampSyncLatency(parsed.worldTarget == null ? targets.WORLD : parsed.worldTarget);
      return {
        debug: Boolean(parsed.debug),
        worldTarget,
        targets: { ...adjustDependentSyncTargets(targets, worldTarget - previousWorld), WORLD: worldTarget },
      };
    } catch {
      const worldTarget = preferredWorldSyncTarget();
      return { debug: false, worldTarget, targets: { WORLD: worldTarget } };
    }
  }
  function clampReplayTimingOffset(value) {
    const number = Number(value || 0);
    return Number.isFinite(number) ? Math.max(-600, Math.min(600, Math.round(number))) : 0;
  }
  function readReplayTimingOffset() {
    try {
      const saved = localStorage.getItem(TIMING_OFFSET_STORAGE_KEY);
      return clampReplayTimingOffset(saved == null ? DEFAULT_REPLAY_TIMING_OFFSET : saved);
    } catch {
      return DEFAULT_REPLAY_TIMING_OFFSET;
    }
  }
  function fmtSync(value, suffix = "s") {
    return Number.isFinite(Number(value)) ? `${Number(value).toFixed(1)}${suffix}` : "--";
  }
  function raceLibraryId(race) {
    return String(race?.rnd || race?.meetingKey || race?.name || "");
  }
  function replayTimingAvailabilityKey(race, session) {
    return [raceLibraryId(race), normalizeF1TvSessionKind(session?.kind || session?.session_name || session?.session_type)].filter(Boolean).join(":");
  }
  function replayTimingAvailabilityFallback(status = "checking") {
    const value = String(status || "checking").toLowerCase();
    if (value === "ready") return { status: "ready", label: "Timing ready", message: "Synced replay live timing is available." };
    if (value === "manual-sync") return { status: "manual-sync", label: "Timing sync", message: "Replay live timing is available, but may need manual sync." };
    if (value === "generating") return { status: "generating", label: "Generating", message: "Replay live timing is being generated." };
    if (value === "unavailable") return { status: "unavailable", label: "No timing", message: "Replay live timing is not available yet." };
    return { status: "checking", label: "Checking", message: "Checking replay live timing availability." };
  }
  function isCancelledF12026RaceName(value) {
    const text = String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
    return /\bbahrain grand prix\b/.test(text) || /\bsaudi arabian grand prix\b/.test(text);
  }
  function f1TvTimeMs(value) {
    const time = Date.parse(value || "");
    return Number.isFinite(time) ? time : null;
  }
  function estimatedF1TvSessionEndMs(session, start) {
    if (!Number.isFinite(start)) return null;
    const kind = normalizeF1TvSessionKind(session?.kind || session?.session_name || session?.session_type).toLowerCase();
    const hours = kind === "race" ? 3 : 1;
    return start + hours * 60 * 60 * 1000;
  }
  function normalizeF1TvSessionStatus(session, nowMs = Date.now()) {
    const status = String(session?.status || "").toLowerCase();
    const statusSource = String(session?.statusSource || "").toLowerCase();
    const contentSubtype = String(session?.contentSubtype || "").toUpperCase();
    if (contentSubtype === "LIVE") return "live";
    if (contentSubtype === "REPLAY") return "done";
    if (statusSource === "f1tv-cms" && status === "live") return "live";
    if (statusSource === "f1tv-cms" && (status === "done" || status === "replay")) return "done";
    const start = f1TvTimeMs(session?.startsAt || session?.dateStart || session?.date_start);
    const explicitEnd = f1TvTimeMs(session?.endsAt || session?.dateEnd || session?.date_end);
    const end = explicitEnd == null ? estimatedF1TvSessionEndMs(session, start) : explicitEnd;
    if (start == null || end == null) return status || "unknown";
    if (nowMs < start) return "upcoming";
    if (nowMs <= end) return "live";
    return "done";
  }
  function normalizeF1TvRaceStatus(race, sessions, nowMs = Date.now()) {
    if ((sessions || []).some((session) => session.status === "live")) return "live";
    if ((sessions || []).some((session) => session.status === "upcoming")) return "upcoming";
    if ((sessions || []).length && (sessions || []).every((session) => session.status === "done")) return "done";
    const starts = (sessions || []).map((session) => f1TvTimeMs(session.startsAt)).filter((time) => time != null);
    const ends = (sessions || []).map((session) => f1TvTimeMs(session.endsAt)).filter((time) => time != null);
    if (starts.length && ends.length) {
      const firstStart = Math.min(...starts);
      const lastEnd = Math.max(...ends);
      if (nowMs < firstStart) return "upcoming";
      if (nowMs <= lastEnd) return "upcoming";
      return "done";
    }
    return String(race?.status || "").toLowerCase() || "unknown";
  }
  function normalizeRaceLibrary(library, season, nowMs = Date.now()) {
    const sourceRaces = Array.isArray(library?.races) ? library.races : [];
    const shouldRemoveCancelled = String(library?.season || season || "") === "2026" && sourceRaces.some((race) => isCancelledF12026RaceName(race?.name));
    const races = shouldRemoveCancelled ? sourceRaces.filter((race) => !isCancelledF12026RaceName(race?.name)) : sourceRaces;
    return {
      ...library,
      races: races.map((race, index) => {
        const sessions = (race.sessions || []).map((session) => ({ ...session, status: normalizeF1TvSessionStatus(session, nowMs) }));
        return {
          ...race,
          rnd: shouldRemoveCancelled ? index + 1 : race.rnd,
          status: normalizeF1TvRaceStatus(race, sessions, nowMs),
          sessions,
        };
      }),
    };
  }
  function normalizeF1TvSessionKind(kind) {
    const text = String(kind || "").toLowerCase();
    if (text.includes("sprint qualifying") || text.includes("sprint shootout") || text === "shootout") return "Sprint Qualifying";
    if (text.includes("practice 1") || text.includes("free practice 1") || text === "fp1") return "Practice 1";
    if (text.includes("practice 2") || text.includes("free practice 2") || text === "fp2") return "Practice 2";
    if (text.includes("practice 3") || text.includes("free practice 3") || text === "fp3") return "Practice 3";
    if (text.includes("qualifying") || text === "quali") return "Qualifying";
    if (text.includes("sprint")) return "Sprint";
    if (text.includes("race") || text.includes("grand prix")) return "Race";
    return String(kind || "Session").trim() || "Session";
  }
  function orderedF1TvSessions(sessions) {
    const standard = ["Practice 1", "Practice 2", "Practice 3", "Sprint Qualifying", "Sprint", "Qualifying", "Race"];
    const byKind = new Map();
    for (const session of sessions || []) {
      const kind = normalizeF1TvSessionKind(session?.kind || session?.session_name || session?.session_type);
      if (!byKind.has(kind)) byKind.set(kind, { ...session, kind });
    }
    return standard
      .filter((kind) => byKind.has(kind))
      .map((kind) => byKind.get(kind))
      .concat(Array.from(byKind.values()).filter((session) => !standard.includes(session.kind)));
  }
  function sessionScheduleText(session) {
    return [session?.day, session?.time].filter(Boolean).join(" ") || "Time TBA";
  }
  function canLoadF1TvSession(race, session) {
    const status = String(session?.status || "").toLowerCase();
    if (status === "done" || status === "live") return true;
    const sessionStart = Date.parse(session?.startsAt || "");
    if (Number.isFinite(sessionStart)) return sessionStart <= Date.now() + 60000;
    if (status === "upcoming") return false;
    const raceStatus = String(race?.status || "").toLowerCase();
    const raceStart = Date.parse(race?.startsAt || "");
    if (raceStatus === "upcoming" && Number.isFinite(raceStart) && raceStart > Date.now() + 60000) return false;
    return true;
  }
  function racePlace(race) {
    const loc = String(race?.loc || "").split(",")[0].trim();
    return loc || race?.circuit || "";
  }
  function compactRaceName(value) {
    return String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, "");
  }
  // Resolve a winner display string (usually a full name) to a 3-letter driver code using the
  // already-loaded driver list (window.PW_DATA.drivers) — no extra lookup or network call.
  function driverCodeFromLabel(label) {
    const text = String(label || "").trim();
    if (!text) return "";
    if (/^[A-Z]{3}$/.test(text)) return text;
    const norm = (value) => String(value || "").toLowerCase().replace(/[^a-z]/g, "");
    const drivers = D.drivers || [];
    const full = norm(text);
    const surname = norm(text.split(/\s+/).pop());
    const hit = drivers.find((d) => norm(d.name) === full)
      || (surname && drivers.find((d) => norm(d.name).endsWith(surname)))
      || null;
    return hit?.code || text;
  }
  // The race winner comes from the same snapshot the Schedule tab reads (window.PW_DATA.schedule),
  // which Electron fetches once and caches (raceWinnerCache + disk snapshot, ~30 min). The F1 TV
  // library that powers the Session Library carries no winner field, so we map each library round
  // back to its schedule row here instead of triggering a separate results call, then shorten the
  // winner to a driver code for the compact spine layout.
  function scheduleWinnerLabel(race) {
    const schedule = D.schedule || [];
    if (!schedule.length || !race) return "";
    const meetingKey = String(race.meetingKey || "");
    const nameKey = compactRaceName(race.name);
    const rnd = Number(race.rnd || 0);
    const row = (meetingKey && schedule.find((r) => String(r.meetingKey || "") === meetingKey))
      || (nameKey && schedule.find((r) => compactRaceName(r.name) === nameKey))
      || (rnd && schedule.find((r) => Number(r.rnd || 0) === rnd))
      || null;
    return row && row.winner ? driverCodeFromLabel(row.winner) : "";
  }
  // Team/driver accent colour for a driver code, from the same loaded driver list.
  function driverColor(code) {
    if (!code) return "";
    const driver = (D.byCode && D.byCode[code]) || (D.drivers || []).find((d) => d.code === code) || null;
    return driver?.color || "";
  }
  const GENERIC_CIRCUIT = "M 250 196 C 392 110, 648 108, 786 210 C 894 290, 838 432, 706 476 C 560 524, 520 402, 398 432 C 268 464, 150 432, 152 318 C 153 244, 184 226, 250 196 Z";
  // Faint circuit silhouette for the expanded round — built from the same real track geometry the
  // Track Map screen renders (window.PW_TRACKMAP_CIRCUITS), resolved by the circuit's own match
  // keywords then round, falling back to a generic loop so a map always renders.
  function circuitSilhouette(race) {
    const circuits = (typeof window !== "undefined" && window.PW_TRACKMAP_CIRCUITS) || {};
    const list = Object.keys(circuits).map((key) => circuits[key]);
    const hay = [race && race.name, race && race.circuit, race && race.loc].filter(Boolean).join(" ").toLowerCase();
    const entry = (hay && list.find((ci) => (ci.match || []).some((m) => hay.includes(String(m).toLowerCase()))))
      || (race && race.rnd && list.find((ci) => Number(ci.round) === Number(race.rnd)))
      || null;
    const points = entry && Array.isArray(entry.points) ? entry.points : null;
    if (!points || points.length < 3) return { d: GENERIC_CIRCUIT, viewBox: "0 0 1000 664" };
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const [x, y] of points) {
      if (x < minX) minX = x; if (y < minY) minY = y;
      if (x > maxX) maxX = x; if (y > maxY) maxY = y;
    }
    const d = points.map((p, i) => (i ? "L" : "M") + p[0].toFixed(1) + " " + p[1].toFixed(1)).join(" ") + " Z";
    const pad = 24;
    const viewBox = [(minX - pad).toFixed(1), (minY - pad).toFixed(1), (maxX - minX + pad * 2).toFixed(1), (maxY - minY + pad * 2).toFixed(1)].join(" ");
    return { d, viewBox };
  }
  function debugUrlParts(targetUrl) {
    try {
      const parsed = new URL(String(targetUrl || ""));
      return {
        host: parsed.hostname,
        pathHint: parsed.pathname.split("/").filter(Boolean).slice(0, 7).join("/"),
      };
    } catch {
      return { host: "", pathHint: "" };
    }
  }
  function logPitWallDebug(area, payload = {}) {
    const safe = {
      ...payload,
      manifestUrl: undefined,
      licenseUrl: undefined,
      headers: payload.headers ? Object.keys(payload.headers) : undefined,
    };
    console.debug("[pitwall]", area, safe);
    const result = window.pitwall?.debug?.log?.(area, safe);
    result?.catch?.(() => {});
  }
  function installPitWallF1TvShakaNetworking() {
    if (window.__pitwallF1TvShakaNetworkingInstalled || !window.shaka?.net?.NetworkingEngine || !window.pitwall?.f1tv?.mediaFetch) return;
    window.__pitwallF1TvShakaNetworkingInstalled = true;
    const NetworkingEngine = window.shaka.net.NetworkingEngine;
    const priority = NetworkingEngine.PluginPriority?.APPLICATION || 3;
    const plugin = (uri, request, requestType, progressUpdated, headersReceived) => {
      let aborted = false;
      const startedAt = Date.now();
      const promise = window.pitwall.f1tv.mediaFetch({
        url: uri,
        method: request.method || "GET",
        headers: request.headers || {},
        body: request.body || null,
        requestType,
      }).then((response) => {
        if (aborted) throw new Error("Request aborted.");
        const data = response.data || new ArrayBuffer(0);
        const bytes = data.byteLength || data.length || 0;
        if (requestType === window.shaka.net.NetworkingEngine.RequestType.LICENSE && Number(response.status || 0) >= 400) {
          throw new Error(response.errorHint ? `F1 TV license rejected: ${response.errorHint}` : `F1 TV license request failed (${response.status}).`);
        }
        headersReceived?.(response.headers || {});
        progressUpdated?.(Date.now() - startedAt, bytes, 0);
        return {
          uri: response.url || uri,
          originalUri: uri,
          data,
          headers: response.headers || {},
          fromCache: false,
          status: response.status || 0,
        };
      }).catch((error) => {
        logPitWallDebug("player.media-fetch-error", {
          requestType,
          message: error?.message || String(error || ""),
        });
        throw new window.shaka.util.Error(
          window.shaka.util.Error.Severity.RECOVERABLE,
          window.shaka.util.Error.Category.NETWORK,
          window.shaka.util.Error.Code.HTTP_ERROR,
          uri,
          error?.message || String(error || ""),
          requestType
        );
      });
      return new window.shaka.util.AbortableOperation(promise, () => {
        aborted = true;
        return Promise.resolve();
      });
    };
    NetworkingEngine.registerScheme("https", plugin, priority, false);
    logPitWallDebug("player.media-fetch-installed", { scheme: "https" });
  }
  function playerErrorMessage(error, fallback = "Apexline could not load this F1 TV stream.") {
    const detail = error?.detail || error;
    if (detail?.code) {
      const dataItems = Array.isArray(detail.data) ? detail.data.map((item) => String(item || "")) : [];
      const licenseHint = dataItems.find((item) => /F1 TV license rejected|ACN_|KeyOS|Licence Acquisition/i.test(item));
      if (licenseHint) {
        const cause = /ACN_4002|371000005/i.test(licenseHint)
          ? " Apexline reached the stream, but F1 TV's production Widevine server rejected this Electron build/license request. A production VMP-signed build is required for clean playback."
          : "";
        return `${licenseHint}${cause}`;
      }
      if (Number(detail.code) === 6008) return "F1 TV DRM license was rejected (6008). The stream metadata loaded, but Widevine refused the license response.";
      const bits = [`F1 TV player error ${detail.code}`];
      if (detail.category) bits.push(`category ${detail.category}`);
      const visibleDetail = dataItems.find((item) => item && !/^https?:\/\//i.test(item));
      if (visibleDetail) bits.push(visibleDetail.slice(0, 120));
      return bits.join(" - ");
    }
    return detail?.message || fallback;
  }

  function clampVolumeLevel(value) {
    const number = Number(value);
    return Number.isFinite(number) ? Math.max(0, Math.min(100, Math.round(number))) : 0;
  }

  function mediaVolume(value) {
    return clampVolumeLevel(value) / 100;
  }

  function normalizeVideoQuality(videoQuality) {
    return VIDEO_QUALITY_PROFILES[videoQuality] ? videoQuality : "medium";
  }

  function playbackProfileForQuality(playbackProfile, videoQuality) {
    const key = PLAYBACK_PROFILES[playbackProfile] ? playbackProfile : "main";
    const quality = normalizeVideoQuality(videoQuality);
    return { ...PLAYBACK_PROFILES[key], ...(VIDEO_QUALITY_PROFILES[quality][key] || {}) };
  }

  function buildStreamPlaybackConfig(playbackProfile, targetLatency, playbackMode, videoQuality) {
    const profile = playbackProfileForQuality(playbackProfile, videoQuality);
    const replay = playbackMode === "replay";
    const maxBufferLength = replay ? (profile.replayBufferGoal || Math.max(profile.bufferGoal || 12, 24)) : (profile.bufferGoal || 12);
    const backBufferLength = replay ? Math.max(profile.backBufferLength || 8, 12) : (profile.backBufferLength || 8);
    const restrictions = {};
    if (Number.isFinite(profile.maxHeight)) restrictions.maxHeight = profile.maxHeight;
    if (Number.isFinite(profile.maxBandwidth)) restrictions.maxBandwidth = profile.maxBandwidth;
    return {
      restrictions,
      hasQualityCap: Object.keys(restrictions).length > 0,
      shaka: {
        streaming: {
          lowLatencyMode: !replay,
          bufferingGoal: maxBufferLength,
          rebufferingGoal: replay ? 4 : 3,
          bufferBehind: backBufferLength,
        },
        abr: Object.keys(restrictions).length ? { restrictions } : undefined,
      },
      hls: {
        lowLatencyMode: !replay,
        backBufferLength,
        liveSyncDuration: targetLatency,
        liveMaxLatencyDuration: Math.max(targetLatency + 15, targetLatency * 1.5),
        maxLiveSyncPlaybackRate: 1.2,
        maxBufferLength,
        maxMaxBufferLength: Math.max(maxBufferLength, replay ? 60 : 30),
        startFragPrefetch: false,
        maxBufferHole: 0.5,
        capLevelToPlayerSize: true,
      },
    };
  }

  function cappedHlsLevelIndex(levels, restrictions) {
    if (!Array.isArray(levels) || !levels.length || !restrictions || !Object.keys(restrictions).length) return -1;
    const allowed = levels
      .map((level, index) => ({ level, index }))
      .filter(({ level }) => {
        const height = Number(level?.height || 0);
        const bitrate = Number(level?.bitrate || level?.attrs?.BANDWIDTH || 0);
        const heightOk = !restrictions.maxHeight || !height || height <= restrictions.maxHeight;
        const bandwidthOk = !restrictions.maxBandwidth || !bitrate || bitrate <= restrictions.maxBandwidth;
        return heightOk && bandwidthOk;
      });
    return (allowed.length ? allowed[allowed.length - 1] : { index: 0 }).index;
  }

  function isPaneSurfaceClickTarget(target) {
    return !target?.closest?.("button, input, select, textarea, a, [role='button'], .pane__controls, .pane__replaybar, .sync-overlay, .pane__top, .pane__playerstatus");
  }

  function PitWallStreamPlayer({ source, muted, volumeLevel = 100, playbackProfile = "main", videoQuality = "medium", onAudioFocus, onReady, onPlaybackState, sync, replaySync, onReplayToggle, playbackLocked = false }) {
    const videoRef = React.useRef(null);
    const replayPlaying = replaySync?.playing !== false;
    const replayPlayingRef = React.useRef(replayPlaying);
    replayPlayingRef.current = replayPlaying;
    const descriptor = streamDescriptor(source);
    const [status, setStatus] = React.useState("");
    const [ready, setReady] = React.useState(false);
    const manifestUrl = descriptor?.manifestUrl || "";
    const headerSignature = JSON.stringify(descriptor?.headers || {});
    React.useEffect(() => {
      const video = videoRef.current;
      if (!video || replaySync?.mode !== "replay") return;
      video.playbackRate = 1;
      if (replaySync.playing === false) video.pause();
      else video.play().catch(() => {});
    }, [replaySync?.mode, replaySync?.playing]);
    React.useEffect(() => {
      const video = videoRef.current;
      if (!video || !descriptor?.manifestUrl) return undefined;
      let hls = null;
      let player = null;
      let timer = null;
      let cancelled = false;
      let reportedReady = false;
      const targetLatency = clampSyncLatency(sync?.targetLatency || defaultSyncTarget("WORLD"));
      const headers = descriptor.headers || {};
      const licenseServer = descriptor.licenseUrl || descriptor.drm?.licenseUrl || "";
      const licenseDebug = debugUrlParts(licenseServer);
      const playbackConfig = buildStreamPlaybackConfig(playbackProfile, targetLatency, descriptor.playbackMode, videoQuality);
      setReady(false);
      onPlaybackState?.(false);
      const markReady = () => {
        if (cancelled) return;
        if (!reportedReady) {
          reportedReady = true;
          logPitWallDebug("player.ready", {
            feedId: descriptor.feedId || descriptor.id || "",
            manifestType: descriptor.manifestType || "",
            readyState: video.readyState,
            duration: Number.isFinite(video.duration) ? video.duration : null,
            currentTime: video.currentTime || 0,
          });
          setReady(true);
          onPlaybackState?.(true);
        }
        setStatus("");
        onReady?.(video);
      };
      const handleVideoError = (event) => {
        const error = event.currentTarget?.error;
        logPitWallDebug("player.video-error", {
          feedId: descriptor.feedId || descriptor.id || "",
          code: error?.code || 0,
          message: error?.message || "",
          readyState: video.readyState,
        });
        setStatus(playerErrorMessage(error, "Video element could not play this F1 TV stream."));
      };
      const reportSync = () => {
        if (!video || !sync?.onMetrics) return;
        let liveLatency = NaN;
        if (video.seekable && video.seekable.length) liveLatency = video.seekable.end(video.seekable.length - 1) - video.currentTime;
        const decision = window.PW_SYNC?.liveSync ? window.PW_SYNC.liveSync(liveLatency, targetLatency, SYNC_EPSILON) : { playbackRate: 1, delta: 0 };
        if (!video.paused && descriptor.playbackMode !== "replay" && Number.isFinite(decision.delta)) video.playbackRate = decision.playbackRate;
        sync.onMetrics({
          targetLatency,
          liveLatency: Number.isFinite(liveLatency) ? liveLatency : null,
          playbackRate: video.playbackRate || 1,
          delta: Number.isFinite(decision.delta) ? decision.delta : null,
        });
      };
      async function load() {
        video.volume = mediaVolume(volumeLevel);
        video.muted = muted || clampVolumeLevel(volumeLevel) <= 0;
        video.addEventListener("loadeddata", markReady);
        video.addEventListener("canplay", markReady);
        video.addEventListener("playing", markReady);
        video.addEventListener("error", handleVideoError);
        logPitWallDebug("player.load-start", {
          feedId: descriptor.feedId || descriptor.id || "",
          contentId: descriptor.contentId || "",
          sessionKind: descriptor.sessionKind || "",
          manifestType: descriptor.manifestType || "",
          playbackMode: descriptor.playbackMode || "",
          hasLicense: Boolean(licenseServer),
          licenseHost: licenseDebug.host,
          licensePathHint: licenseDebug.pathHint,
          headerNames: Object.keys(headers),
          playbackProfile,
          videoQuality: normalizeVideoQuality(videoQuality),
          qualityCap: playbackConfig.hasQualityCap ? playbackConfig.restrictions : undefined,
        });
        setStatus(descriptor.manifestType === "dash" ? "Loading clean F1 TV DASH player..." : "Loading clean F1 TV stream...");
        if (descriptor.manifestType === "dash" || descriptor.drm?.licenseUrl || descriptor.licenseUrl) {
          if (!window.shaka?.Player) throw new Error("Shaka Player is not loaded.");
          window.shaka.polyfill?.installAll?.();
          if (window.shaka.Player.isBrowserSupported && !window.shaka.Player.isBrowserSupported()) throw new Error("This Electron build cannot play Shaka/Widevine streams.");
          installPitWallF1TvShakaNetworking();
          player = new window.shaka.Player();
          player.addEventListener("error", (event) => {
            const detail = event.detail || {};
            logPitWallDebug("player.shaka-error", {
              feedId: descriptor.feedId || descriptor.id || "",
              code: detail.code || 0,
              category: detail.category || 0,
              severity: detail.severity || 0,
              data: Array.isArray(detail.data) ? detail.data.map((item) => String(item).slice(0, 120)).slice(0, 4) : [],
            });
            setStatus(playerErrorMessage(event));
          });
          await player.attach(video);
          player.configure({
            drm: licenseServer ? { servers: { "com.widevine.alpha": licenseServer } } : {},
            streaming: playbackConfig.shaka.streaming,
            ...(playbackConfig.shaka.abr ? { abr: playbackConfig.shaka.abr } : {}),
          });
          player.getNetworkingEngine()?.registerRequestFilter((type, request) => {
            request.allowCrossSiteCredentials = true;
            request.headers = { ...(request.headers || {}), ...headers };
            if (licenseServer && type === window.shaka.net.NetworkingEngine.RequestType.LICENSE) {
              request.uris = [licenseServer];
            }
          });
          const mimeType = descriptor.manifestType === "dash" ? "application/dash+xml" : descriptor.manifestType === "hls" ? "application/x-mpegURL" : undefined;
          await player.load(descriptor.manifestUrl, null, mimeType);
          logPitWallDebug("player.shaka-loaded", {
            feedId: descriptor.feedId || descriptor.id || "",
            duration: Number.isFinite(video.duration) ? video.duration : null,
            readyState: video.readyState,
          });
        } else if (!playbackConfig.hasQualityCap && video.canPlayType("application/vnd.apple.mpegurl")) {
          video.src = descriptor.manifestUrl;
        } else if (window.Hls && window.Hls.isSupported()) {
          hls = new window.Hls({
            ...playbackConfig.hls,
            xhrSetup: (xhr) => {
              xhr.withCredentials = true;
              Object.entries(headers).forEach(([key, value]) => xhr.setRequestHeader(key, value));
            },
          });
          const applyHlsCap = () => {
            const cappedLevel = cappedHlsLevelIndex(hls.levels, playbackConfig.restrictions);
            if (cappedLevel >= 0) hls.autoLevelCapping = cappedLevel;
          };
          hls.on(window.Hls.Events.MANIFEST_PARSED, applyHlsCap);
          hls.on(window.Hls.Events.LEVELS_UPDATED, applyHlsCap);
          hls.on(window.Hls.Events.ERROR, (_event, data) => {
            logPitWallDebug("player.hls-error", {
              feedId: descriptor.feedId || descriptor.id || "",
              fatal: Boolean(data?.fatal),
              type: data?.type || "",
              details: data?.details || "",
            });
            if (data?.fatal) setStatus(`HLS error: ${data.details || data.type || "fatal playback error"}`);
          });
          hls.loadSource(descriptor.manifestUrl);
          hls.attachMedia(video);
        } else {
          video.src = descriptor.manifestUrl;
        }
        if (!cancelled) {
          setStatus("Buffering F1 TV stream...");
          if (video.readyState >= 2) markReady();
          if (replayPlayingRef.current) video.play().catch(() => {});
          else video.pause();
          timer = setInterval(reportSync, 750);
        }
      }
      load().catch((error) => {
        logPitWallDebug("player.load-error", {
          feedId: descriptor.feedId || descriptor.id || "",
          code: error?.code || 0,
          category: error?.category || 0,
          message: error?.message || String(error || ""),
          data: Array.isArray(error?.data) ? error.data.map((item) => String(item).slice(0, 120)).slice(0, 4) : [],
        });
        setStatus(playerErrorMessage(error));
      });
      return () => {
        cancelled = true;
        if (timer) clearInterval(timer);
        setReady(false);
        onPlaybackState?.(false);
        onReady?.(null);
        video.removeEventListener("loadeddata", markReady);
        video.removeEventListener("canplay", markReady);
        video.removeEventListener("playing", markReady);
        video.removeEventListener("error", handleVideoError);
        if (hls) hls.destroy();
        if (player) {
          const destroyed = player.destroy();
          if (destroyed?.catch) destroyed.catch(() => {});
        }
        video.playbackRate = 1;
        video.removeAttribute("src");
        video.load();
      };
    }, [manifestUrl, descriptor?.licenseUrl, descriptor?.drm?.licenseUrl, headerSignature, playbackProfile, videoQuality, sync?.targetLatency]);
    React.useEffect(() => {
      if (!videoRef.current) return;
      videoRef.current.volume = mediaVolume(volumeLevel);
      videoRef.current.muted = muted || clampVolumeLevel(volumeLevel) <= 0;
    }, [muted, volumeLevel]);
    function handleSurfaceClick(event) {
      const video = event.currentTarget;
      event.stopPropagation();
      if (playbackLocked) return;
      if (replaySync?.mode === "replay") {
        onReplayToggle?.();
        return;
      }
      if (video.paused) video.play().catch(() => {});
      else video.pause();
    }
    return (
      <>
        <video ref={videoRef} className="pane__video" data-ready={String(ready)} playsInline autoPlay muted={muted}
          onClick={handleSurfaceClick}
          onVolumeChange={(e) => { if (!e.currentTarget.muted && muted && e.currentTarget.volume > 0) onAudioFocus?.(); }} />
        {status && <div className="pane__playerstatus">{status}</div>}
      </>
    );
  }

  function SyncOverlay({ show, targetLatency, metrics, protectedPlayer, onAdjust, onReset }) {
    if (!show) return null;
    const playbackRate = metrics?.playbackRate || 1;
    return (
      <div className="sync-overlay" aria-label="Sync overlay">
        <div className="sync-overlay__top">
          <span>Sync overlay</span>
          <span>{playbackRate.toFixed(2)}x</span>
        </div>
        <div className="sync-overlay__grid">
          <span className="sync-overlay__metric"><b>{fmtSync(targetLatency)}</b><span>targetLatency</span></span>
          <span className="sync-overlay__metric"><b>{fmtSync(metrics?.liveLatency)}</b><span>liveLatency</span></span>
          <span className="sync-overlay__metric"><b>{playbackRate.toFixed(2)}</b><span>playbackRate</span></span>
        </div>
        <div className="sync-overlay__buttons">
          <button onClick={() => onAdjust(-1)}>-1</button>
          <button onClick={() => onAdjust(-0.1)}>-0.1</button>
          <button onClick={onReset}>R</button>
          <button onClick={() => onAdjust(0.1)}>+0.1</button>
          <button onClick={() => onAdjust(1)}>+1</button>
        </div>
        {protectedPlayer && <div className="sync-overlay__note">Protected F1 TV players keep playback inside the F1 TV web player.</div>}
      </div>
    );
  }

  function SyncMenu({ open, replayMode, replayTimingOffset, debugEnabled, onReplayTimingAdjust, onReplayTimingReset, onSyncAll, onToggleDebug }) {
    if (!open) return null;
    const timingLabel = `Timing ${replayTimingOffset > 0 ? "+" : ""}${replayTimingOffset}s`;
    return (
      <div className="sync-menu" aria-label="Sync menu">
        {replayMode === "replay" && (
          <div className="sync-menu__timing">
            <button className="sync-menu__btn" type="button" onClick={() => onReplayTimingAdjust?.(-60)}>Timing -1m</button>
            <button className="sync-menu__btn" type="button" onClick={() => onReplayTimingAdjust?.(-10)}>Timing -10s</button>
            <button className="sync-menu__btn" type="button" data-active="true" onClick={onReplayTimingReset}>{timingLabel}</button>
            <button className="sync-menu__btn" type="button" onClick={() => onReplayTimingAdjust?.(10)}>Timing +10s</button>
            <button className="sync-menu__btn" type="button" onClick={() => onReplayTimingAdjust?.(60)}>Timing +1m</button>
          </div>
        )}
        <div className="sync-menu__row">
          {replayMode === "replay" && <button className="sync-menu__btn sync-menu__btn--box" type="button" onClick={onSyncAll}>Sync all players</button>}
          <button className="sync-menu__btn sync-menu__btn--box" type="button" data-active={debugEnabled ? "true" : "false"} onClick={onToggleDebug}>Debug overlay</button>
        </div>
      </div>
    );
  }

  function useManagedHls(videoRef, url, muted, sync = {}) {
    const metricsRef = React.useRef(sync.onMetrics);
    React.useEffect(() => {
      metricsRef.current = sync.onMetrics;
    }, [sync.onMetrics]);

    React.useEffect(() => {
      const video = videoRef.current;
      if (!video || !url) return;
      let hls = null;
      let timer = null;
      const targetLatency = clampSyncLatency(sync.targetLatency || defaultSyncTarget("WORLD"));
      video.muted = muted;
      const reportSync = () => {
        let liveLatency = NaN;
        if (video.seekable && video.seekable.length) {
          liveLatency = video.seekable.end(video.seekable.length - 1) - video.currentTime;
        } else if (hls && Number.isFinite(hls.latency)) {
          liveLatency = hls.latency;
        }
        const delta = liveLatency - targetLatency;
        if (!video.paused && Number.isFinite(delta)) {
          if (delta > SYNC_EPSILON) video.playbackRate = 1.2;
          else if (delta < -SYNC_EPSILON) video.playbackRate = 0.8;
          else video.playbackRate = 1;
        }
        metricsRef.current?.({
          targetLatency,
          liveLatency: Number.isFinite(liveLatency) ? liveLatency : null,
          playbackRate: video.playbackRate || 1,
          delta: Number.isFinite(delta) ? delta : null,
        });
      };
      if (video.canPlayType("application/vnd.apple.mpegurl")) {
        video.src = url;
      } else if (window.Hls && window.Hls.isSupported()) {
        hls = new window.Hls({
          lowLatencyMode: true,
          backBufferLength: Math.max(30, targetLatency + 15),
          liveSyncDuration: targetLatency,
          liveMaxLatencyDuration: Math.max(targetLatency + 15, targetLatency * 1.5),
          maxLiveSyncPlaybackRate: 1.2,
          xhrSetup: (xhr) => { xhr.withCredentials = true; },
        });
        hls.loadSource(url);
        hls.attachMedia(video);
      } else {
        video.src = url;
      }
      video.play().catch(() => {});
      video.addEventListener("timeupdate", reportSync);
      timer = setInterval(reportSync, 750);
      return () => {
        if (timer) clearInterval(timer);
        video.removeEventListener("timeupdate", reportSync);
        if (hls) hls.destroy();
        video.playbackRate = 1;
        video.removeAttribute("src");
        video.load();
      };
    }, [url, sync.targetLatency]);

    React.useEffect(() => {
      if (videoRef.current) videoRef.current.muted = muted;
    }, [muted]);
  }

  function formatReplayTime(seconds) {
    const value = Math.max(0, Math.round(Number(seconds || 0)));
    const h = Math.floor(value / 3600);
    const m = Math.floor((value % 3600) / 60);
    const s = value % 60;
    return h ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}` : `${m}:${String(s).padStart(2, "0")}`;
  }

  function formatSessionClock(value) {
    const text = String(value || "").trim();
    const match = text.match(/^(\d+):(\d{2}):(\d{2})(?:\.\d+)?$/);
    if (!match) return text;
    const hours = Number(match[1]);
    return hours ? `${hours}:${match[2]}:${match[3]}` : `${Number(match[2])}:${match[3]}`;
  }

  function sessionClockSeconds(value) {
    const text = String(value || "").trim();
    const parts = text.split(":").map(Number);
    if (parts.some((part) => !Number.isFinite(part))) return null;
    if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
    if (parts.length === 2) return parts[0] * 60 + parts[1];
    return null;
  }

  function formatSessionClockSeconds(value) {
    const seconds = Math.max(0, Math.round(Number(value || 0)));
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return h ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}` : `${m}:${String(s).padStart(2, "0")}`;
  }

  function smoothSessionClockLabel(clock, context = {}) {
    void context.clockTick;
    const baseSeconds = sessionClockSeconds(clock?.remaining);
    if (baseSeconds == null) return formatSessionClock(clock?.remaining);
    let delta = 0;
    if (context.mode === "replay") {
      const currentElapsed = Number(context.replayTime || 0) + Number(context.replayTimingOffset || 0);
      const snapshotElapsed = Number(context.timingData?.elapsedSeconds);
      if (Number.isFinite(currentElapsed) && Number.isFinite(snapshotElapsed)) delta = currentElapsed - snapshotElapsed;
    } else if (clock?.extrapolating && context.timingData?.fetchedAt) {
      const fetchedAt = Date.parse(context.timingData.fetchedAt);
      if (Number.isFinite(fetchedAt)) delta = (Date.now() - fetchedAt) / 1000;
    }
    return formatSessionClockSeconds(baseSeconds - Math.max(0, delta));
  }

  function sessionClockDisplayLabel(clock, context = {}) {
    const clockLabel = smoothSessionClockLabel(clock, context);
    if (!clockLabel) return "";
    const sessionKind = String(context.sessionKind || "").toLowerCase();
    const practiceMatch = sessionKind.match(/\b(?:free\s+)?practice[\s_-]*([1-3])\b/) || sessionKind.match(/\bfp\s*([1-3])\b/);
    if (practiceMatch) return `FP${practiceMatch[1]} ${clockLabel}`;
    if (!/qualifying|shootout/.test(sessionKind)) return clockLabel;
    const part = qualifyingPhaseFromSession({
      sessionKind: context.sessionKind,
      qualifyingPhase: clock?.qualifyingPart,
      sessionClock: clock,
      rowCount: context.rowCount,
    });
    return `${part} ${clockLabel}`;
  }

  function replayProgressPct(replaySync) {
    const duration = Number(replaySync?.duration || 0);
    const time = Number(replaySync?.masterTime || 0);
    if (!Number.isFinite(duration) || duration <= 0 || !Number.isFinite(time)) return 0;
    return Math.max(0, Math.min(100, (time / duration) * 100));
  }

  function VolumeControl({ active, value, onFocus, onChange }) {
    const level = active ? clampVolumeLevel(value) : 0;
    const handleVolumeInput = (event) => onChange?.(Number(event.target.value));
    return (
      <span className="pane__volume" data-active={active}>
        <button className="pane__ctl" type="button" data-active={active} onClick={onFocus} aria-label={active ? "Mute audio" : "Enable audio"}>
          <Icon name="volume" size={14} />
        </button>
        <input aria-label="Volume level" type="range" min="0" max="100" step="1" value={level}
          onInput={handleVolumeInput} onChange={handleVolumeInput} />
        <span className="pane__volume-level">{level}%</span>
      </span>
    );
  }

  function AudioToggle({ active, onFocus }) {
    return (
      <button className="pane__ctl" type="button" data-active={active} onClick={onFocus} aria-label={active ? "Mute audio" : "Enable audio"}>
        <Icon name="volume" size={14} />
      </button>
    );
  }

  function BroadcastPane({ focus, streamUrl, audioActive, audioVolume, onAudioFocus, onAudioVolumeChange, onConfigureStream, expanded, onExpand, visible = true, style, zone, videoOverlay,
    hasCurrentLiveSession, replayControls, sessionLibrary, onLoadPastSession, onConnectF1Tv,
    replaySync, onReplayToggle, onReplaySeek, onSurfaceToggle, onSyncAll, onPlayerReady, streamStatus, resolving,
    syncKey, syncDebug, syncTarget, syncMetrics, onSyncMetrics, onSyncAdjust, onSyncReset, timingRows, sessionKind, videoQuality,
    broadcastTickerRows = 3, onTickerRowsChange, lockAspect = false, onLockAspectToggle, hideBuiltinTicker = false, feedTickerOn = false, onToggleFeedTicker, playbackLocked = false }) {
    const paneRef = React.useRef(null);
    const [tickerCanFitTop15, setTickerCanFitTop15] = React.useState(false);
    const [tickerCanFitTop10, setTickerCanFitTop10] = React.useState(false);
    const [tickerCompact, setTickerCompact] = React.useState(false);
    const [tickerRowHeight, setTickerRowHeight] = React.useState(46);
    const [tickerCodeSize, setTickerCodeSize] = React.useState(14);
    const descriptor = streamDescriptor(streamUrl);
    const sourceRows = timingRows?.length ? timingRows : D.timing;
    const requestedTickerRows = clampBroadcastTickerRows(broadcastTickerRows);
    React.useEffect(() => {
      const node = paneRef.current;
      if (!node || typeof ResizeObserver === "undefined") return undefined;
      const update = () => {
        const rect = node.getBoundingClientRect();
        const top15RowHeight = clampPanelSize((rect.height - 300) / 3, 30, 42);
        const top10RowHeight = clampPanelSize((rect.height - 300) / 2, 30, 42);
        const targetVideoHeight = Math.min(rect.width * 9 / 16, Math.max(0, rect.height - 40));
        const top15VideoHeight = rect.height - top15RowHeight * 3;
        const top10VideoHeight = rect.height - top10RowHeight * 2;
        const canFitTop15 = rect.width >= 920 && rect.height >= 390 && sourceRows.length >= 15 && top15VideoHeight >= targetVideoHeight * 0.9;
        const canFitTop10 = rect.width >= 920 && rect.height >= 360 && sourceRows.length >= 10 && top10VideoHeight >= targetVideoHeight * 0.9;
        const rowCount = requestedTickerRows >= 3 && canFitTop15 ? 3 : requestedTickerRows >= 2 && canFitTop10 ? 2 : 1;
        const rowHeight = rowCount === 3 ? top15RowHeight : rowCount === 2 ? top10RowHeight : clampPanelSize(rect.height - targetVideoHeight * 0.9, 46, 74);
        setTickerCanFitTop15(canFitTop15);
        setTickerCanFitTop10(canFitTop10);
        setTickerCompact(rect.width < 760);
        setTickerRowHeight(rowHeight);
        setTickerCodeSize(clampPanelSize(rowHeight * 0.34, 14, 18));
      };
      update();
      const observer = new ResizeObserver(update);
      observer.observe(node);
      return () => observer.disconnect();
    }, [requestedTickerRows, sourceRows.length]);
    const tickerRowLimit = tickerCanFitTop15 && requestedTickerRows >= 3 && sourceRows.length >= 15 ? 15 : tickerCanFitTop10 && requestedTickerRows >= 2 && sourceRows.length >= 10 ? 10 : tickerCompact ? 3 : 5;
    const tickerRowCount = tickerRowLimit === 15 ? 3 : tickerRowLimit === 10 ? 2 : 1;
    const tickerTotalHeight = tickerRowHeight * tickerRowCount;
    const top = sourceRows.slice(0, tickerRowLimit);
    const paneStyle = { ...(style || {}), "--ticker-row-h": `${tickerRowHeight}px`, "--ticker-total-h": `${tickerTotalHeight}px`, "--ticker-code-size": `${tickerCodeSize}px`, "--ticker-meta-size": `${clampPanelSize(tickerCodeSize * 0.68, 10, 12)}px` };
    function rowCountFromPointer(pointerEvent) {
      const rect = paneRef.current?.getBoundingClientRect();
      if (!rect) return requestedTickerRows;
      return clampBroadcastTickerRows(Math.round((rect.bottom - pointerEvent.clientY) / Math.max(30, tickerRowHeight)));
    }
    function startTickerResize(event) {
      event.preventDefault();
      event.stopPropagation();
      const updateFromPointer = (pointerEvent) => onTickerRowsChange?.(rowCountFromPointer(pointerEvent));
      const stop = () => {
        window.removeEventListener("pointermove", updateFromPointer);
        window.removeEventListener("pointerup", stop);
      };
      updateFromPointer(event);
      window.addEventListener("pointermove", updateFromPointer);
      window.addEventListener("pointerup", stop, { once: true });
    }
    function handleTickerResizeKey(event) {
      if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
      event.preventDefault();
      onTickerRowsChange?.(clampBroadcastTickerRows(requestedTickerRows + (event.key === "ArrowDown" ? -1 : 1)));
    }
    return (
      <div ref={paneRef} className="pane pane--bc" data-focus={focus} data-expanded={expanded} data-visible={String(visible)} data-zone={zone} data-lockar={String(Boolean(lockAspect))} data-noticker={String(Boolean(hideBuiltinTicker))} data-replay={String(replaySync?.mode === "replay")} style={paneStyle}
        onClick={(event) => {
          if (playbackLocked || !descriptor || !isPaneSurfaceClickTarget(event.target)) return;
          onSurfaceToggle?.();
        }}>
        <div className="pane__feed" />
        <div className="pane__bcwash" />
        {descriptor && <PitWallStreamPlayer source={descriptor} muted={!audioActive} volumeLevel={audioVolume} videoQuality={videoQuality} onAudioFocus={onAudioFocus} replaySync={replaySync} onReplayToggle={onReplayToggle} playbackLocked={playbackLocked}
          onReady={(video) => onPlayerReady?.(syncKey, video)} sync={{ targetLatency: syncTarget, onMetrics: (metrics) => onSyncMetrics?.(syncKey, metrics) }} />}
        <div className="pane__controls">
          <VolumeControl active={audioActive} value={audioVolume} onFocus={onAudioFocus} onChange={onAudioVolumeChange} />
          <span className="pane__ctl pane__ctl--ar" data-active={String(Boolean(lockAspect))} title={lockAspect ? "Unlock aspect ratio" : "Lock 16:9 aspect ratio"} onClick={onLockAspectToggle}>16:9</span>
          {onToggleFeedTicker && <span className="pane__ctl" data-active={String(Boolean(feedTickerOn))} title={feedTickerOn ? "Hide driver tiles" : "Show driver tiles"} onClick={onToggleFeedTicker}><Icon name="grid" size={14} /></span>}
          <span className="pane__ctl" onClick={onConfigureStream}><Icon name="settings" size={14} /></span>
          <span className="pane__ctl" data-active={expanded} onClick={onExpand}><Icon name="maximize" size={14} /></span>
        </div>
        <SyncOverlay show={syncDebug} targetLatency={syncTarget} metrics={syncMetrics} protectedPlayer={Boolean(descriptor?.drm || descriptor?.licenseUrl)}
          onAdjust={(delta) => onSyncAdjust?.(syncKey, delta)} onReset={() => onSyncReset?.(syncKey)} />
        {descriptor && replaySync?.mode === "replay" && (
          <div className="pane__replaybar">
            <button className="pane__replayplay" type="button" onClick={onReplayToggle} data-playing={String(Boolean(replaySync.playing))} disabled={playbackLocked}
              aria-label={replaySync.playing ? "Pause replay" : "Play replay"} title={replaySync.playing ? "Pause" : "Play"}>
              <Icon name={replaySync.playing ? "pause" : "play"} size={15} />
            </button>
            <div className="pane__replaytrack">
              <span className="pane__replayfill" style={{ width: `${replayProgressPct(replaySync)}%` }} />
              <input aria-label="Replay position" disabled={playbackLocked} type="range" min="0" max={Math.max(1, Math.round(replaySync.duration || 1))} value={Math.round(replaySync.masterTime || 0)}
                onChange={(e) => onReplaySeek?.(Number(e.target.value))} />
            </div>
            <span className="pane__replaytime">{formatReplayTime(replaySync.masterTime)} / {formatReplayTime(replaySync.duration)}</span>
          </div>
        )}
        <div className="pane__top">
          <span className="pane__tag pane__tag--bc" data-live={String(Boolean(hasCurrentLiveSession))}>
            <span className="pane__bclive" data-live={String(Boolean(hasCurrentLiveSession))} />
            <span style={{ fontWeight: 700, fontSize: 12, fontFamily: "var(--font-display)", letterSpacing: "0.04em" }}>F1 TV</span>
          </span>
          <span className="pane__bcbug">
            <span className="pane__bcbug-flag" />
            <span className="pane__bcbug-lap">{D.race?.lap ? "LAP " + D.race.lap : hasCurrentLiveSession ? "LIVE" : "REPLAY"}<i>{D.race?.laps ? "/" + D.race.laps : ""}</i></span>
          </span>
          <span className="pane__feedlabel pane__feedlabel--bc"><Icon name="radio" size={12} /> F1 TV</span>
        </div>
        {videoOverlay && <div className="pane__voverlay">{videoOverlay}</div>}
        <div className="pane__mid">
          {streamUrl ? null : sessionLibrary || (
            <div className="replay-empty">
              <span className="replay-empty__eyebrow"><Icon name="timer" size={13} /> {hasCurrentLiveSession ? "F1 TV feed not loaded" : "No current live session"}</span>
              <div className="replay-empty__title">{hasCurrentLiveSession ? "Choose the live F1 TV feed" : "Load a past session"}</div>
              <div className="replay-empty__body">{hasCurrentLiveSession ? "Load the current session and Apexline will resolve the clean F1 TV player directly into this pane." : "Pick any race, qualifying, or practice replay and Apexline will load it into the main F1 TV pane. MultiViewer login is separate from Apexline, so connect F1 TV here once if prompted."}</div>
              {streamStatus && <div className="stream-modal__hint">{streamStatus}</div>}
              {replayControls}
              <div className="replay-picker__actions">
                <Button size="sm" variant="primary" onClick={onLoadPastSession} disabled={resolving} iconLeft={<Icon name="play" size={14} />}>{resolving ? "Resolving..." : "Load past session"}</Button>
                {streamStatus && /sign in|connect f1 tv/i.test(streamStatus) && <Button size="sm" variant="secondary" onClick={onConnectF1Tv} iconLeft={<Icon name="key" size={14} />}>Connect F1 TV</Button>}
                <Button size="sm" variant="secondary" onClick={onConfigureStream} iconLeft={<Icon name="settings" size={14} />}>More F1 TV options</Button>
              </div>
            </div>
          )}
        </div>
        {!hideBuiltinTicker && (
          <>
            <button type="button" className="pane__ticker-resize" role="slider" aria-label="Resize broadcast timing tile rows"
              aria-orientation="vertical" aria-valuemin="1" aria-valuemax="3" aria-valuenow={requestedTickerRows}
              onPointerDown={startTickerResize} onKeyDown={handleTickerResizeKey} />
            {/* broadcast lower-third timing ticker */}
            <div className={`pane__ticker ${tickerRowCount === 3 ? "pane__ticker--top15" : tickerRowCount === 2 ? "pane__ticker--rows2" : ""}`}>
              {top.map((t) => {
                const d = D.byCode[t.code] || {};
                const tyreLabel = tickerTyreLabel(t);
                return (
                  <span className="tick" key={t.code}>
                    <span className="tick__bar" style={{ background: d.color || "var(--accent)" }} />
                    <span className="tick__main">
                      <span className="tick__row"><span className="tick__pos">P{t.pos}</span><span className="tick__code">{t.code}</span></span>
                      <span className="tick__detail">
                        {tyreLabel && <span className="tick__tyre" style={{ "--tyre-ring": tyreRing(t.comp) }}>{tyreLabel}</span>}
                        <span className="tick__gap">{formatTickerInterval(t)}</span>
                      </span>
                    </span>
                  </span>
                );
              })}
            </div>
          </>
        )}
      </div>
    );
  }

  // Isolated, configurable driver-rows ticker for custom-layout feed tiles.
  // Independent of BroadcastPane's built-in ticker so the Intelligent layout is untouched.
  function CustomFeedTicker({ rows, height, timingRows, onRowsChange, onResize }) {
    const [menuOpen, setMenuOpen] = React.useState(false);
    const sourceRows = timingRows?.length ? timingRows : D.timing;
    const top = (sourceRows || []).slice(0, Math.max(5, Math.min(20, rows * 5)));
    function startResize(event) {
      event.preventDefault();
      event.stopPropagation();
      const startY = event.clientY;
      const startH = height;
      function move(moveEvent) { onResize(startH + (startY - moveEvent.clientY)); }
      function up() {
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", up);
      }
      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", up);
    }
    return (
      <div className="custom-feedticker" style={{ height: height + "px" }}>
        <span className="custom-feedticker__resize" onPointerDown={startResize} title="Drag to resize" />
        <span className="custom-feedticker__tools">
          <button type="button" className="custom-feedticker__cog" aria-label="Configure rows" onClick={() => setMenuOpen((open) => !open)}><Icon name="settings" size={12} /></button>
          {menuOpen && (
            <span className="custom-feedticker__menu">
              <span className="custom-feedticker__menulabel">Rows</span>
              {[1, 2, 3, 4].map((n) => (
                <button type="button" key={n} data-active={String(n === rows)} onClick={() => { onRowsChange(n); setMenuOpen(false); }}>{n}</button>
              ))}
            </span>
          )}
        </span>
        <div className="custom-feedticker__grid" style={{ gridTemplateColumns: "repeat(5, minmax(0, 1fr))", gridTemplateRows: `repeat(${Math.max(1, rows)}, minmax(0, 1fr))` }}>
          {top.map((t) => {
            const d = D.byCode[t.code] || {};
            const tyreLabel = tickerTyreLabel(t);
            return (
              <span className="tick" key={t.code}>
                <span className="tick__bar" style={{ background: d.color || "var(--accent)" }} />
                <span className="tick__main">
                  <span className="tick__row"><span className="tick__pos">P{t.pos}</span><span className="tick__code">{t.code}</span></span>
                  <span className="tick__detail">
                    {tyreLabel && <span className="tick__tyre" style={{ "--tyre-ring": tyreRing(t.comp) }}>{tyreLabel}</span>}
                    <span className="tick__gap">{formatTickerInterval(t)}</span>
                  </span>
                </span>
              </span>
            );
          })}
        </div>
      </div>
    );
  }

  function OnboardPane({ feed, code, focus, telemetry, channel, streamUrl, audioActive, audioVolume, onAudioFocus, onAudioVolumeChange, onConfigureStream, expanded, onExpand,
    visible = true, style, zone, driverOptions = [], onDriverChange,
    replaySync, onReplayToggle, onReplaySeek, onSurfaceToggle, onPlayerReady, syncKey, syncDebug, syncTarget, syncMetrics, onSyncMetrics, onSyncAdjust, onSyncReset,
    timingRows = [], sessionKind = "", videoQuality, lockAspect = false, onLockAspectToggle, feedTickerOn = false, onToggleFeedTicker, playbackLocked = false }) {
    const [telemetryOn, setTelemetryOn] = React.useState(Boolean(telemetry));
    const [localLockAspect, setLocalLockAspect] = React.useState(false);
    const [streamReady, setStreamReady] = React.useState(false);
    const descriptor = streamDescriptor(streamUrl);
    const manifestUrl = descriptor?.manifestUrl || "";
    const effectiveLockAspect = onLockAspectToggle ? Boolean(lockAspect) : localLockAspect;
    React.useEffect(() => setTelemetryOn(Boolean(telemetry)), [telemetry, code]);
    React.useEffect(() => setStreamReady(false), [code, manifestUrl]);
    const d = D.byCode[code] || {};
    const driverImage = d.remoteImage || d.image;
    const telemetryData = telemetryForCode(timingRows, code, sessionKind);
    const sectorSlots = timingSectorCounts(timingRows);
    const streaming = Boolean(descriptor);
    return (
      <div className="pane" data-focus={focus} data-expanded={expanded} data-visible={String(visible)} data-zone={zone}
        data-telemetry={String(telemetryOn)} data-replay={String(replaySync?.mode === "replay")} data-lockar={String(effectiveLockAspect)}
        data-streaming={String(streaming)} data-stream-ready={String(!streaming || streamReady)} style={style}
        onClick={(event) => {
          if (playbackLocked || !descriptor || !isPaneSurfaceClickTarget(event.target)) return;
          onSurfaceToggle?.();
        }}>
        <div className="pane__feed" />
        <div className="pane__scan" />
        {descriptor && <PitWallStreamPlayer source={descriptor} muted={!audioActive} volumeLevel={audioVolume} playbackProfile="onboard" videoQuality={videoQuality} onAudioFocus={onAudioFocus} replaySync={replaySync} onReplayToggle={onReplayToggle} playbackLocked={playbackLocked}
          onReady={(video) => onPlayerReady?.(syncKey, video)} onPlaybackState={setStreamReady}
          sync={{ targetLatency: syncTarget, onMetrics: (metrics) => onSyncMetrics?.(syncKey, metrics) }} />}
        <div className="pane__controls">
          {driverOptions.length > 0 && (
            <select className="pane__driverselect" value={code || ""} aria-label="Switch onboard driver"
              onChange={(event) => onDriverChange?.(event.target.value)}>
              {driverOptions.map((driver) => <option key={driver.code} value={driver.code}>{driver.code} · {driver.name}</option>)}
            </select>
          )}
          {!channel && <span className="pane__ctl" data-active={telemetryOn} onClick={() => setTelemetryOn(!telemetryOn)}><Icon name="gauge" size={14} /></span>}
          <AudioToggle active={audioActive} onFocus={onAudioFocus} />
          <span className="pane__ctl pane__ctl--ar" data-active={String(effectiveLockAspect)} title={effectiveLockAspect ? "Unlock aspect ratio" : "Lock 16:9 aspect ratio"} onClick={() => onLockAspectToggle ? onLockAspectToggle() : setLocalLockAspect((value) => !value)}>16:9</span>
          {onToggleFeedTicker && <span className="pane__ctl" data-active={String(Boolean(feedTickerOn))} title={feedTickerOn ? "Hide driver tiles" : "Show driver tiles"} onClick={onToggleFeedTicker}><Icon name="grid" size={14} /></span>}
          <span className="pane__ctl" onClick={onConfigureStream}><Icon name="settings" size={14} /></span>
          <span className="pane__ctl" data-active={expanded} onClick={onExpand}><Icon name="maximize" size={14} /></span>
        </div>
        <SyncOverlay show={syncDebug} targetLatency={syncTarget} metrics={syncMetrics} protectedPlayer={Boolean(descriptor?.drm || descriptor?.licenseUrl)}
          onAdjust={(delta) => onSyncAdjust?.(syncKey, delta)} onReset={() => onSyncReset?.(syncKey)} />
        {descriptor && replaySync?.mode === "replay" && (
          <div className="pane__replaybar">
            <button className="pane__replayplay" type="button" onClick={onReplayToggle} data-playing={String(Boolean(replaySync.playing))} disabled={playbackLocked}
              aria-label={replaySync.playing ? "Pause replay" : "Play replay"} title={replaySync.playing ? "Pause" : "Play"}>
              <Icon name={replaySync.playing ? "pause" : "play"} size={15} />
            </button>
            <div className="pane__replaytrack">
              <span className="pane__replayfill" style={{ width: `${replayProgressPct(replaySync)}%` }} />
              <input aria-label="Replay position" disabled={playbackLocked} type="range" min="0" max={Math.max(1, Math.round(replaySync.duration || 1))} value={Math.round(replaySync.masterTime || 0)}
                onChange={(e) => onReplaySeek?.(Number(e.target.value))} />
            </div>
            <span className="pane__replaytime">{formatReplayTime(replaySync.masterTime)} / {formatReplayTime(replaySync.duration)}</span>
          </div>
        )}
        <div className="pane__top">
          {!channel && (
            <span className="pane__tag">
              <Avatar initials={code || "DR"} number={d.num} ring={d.color || "var(--accent)"} src={driverImage} size="sm" />
              <span className="pane__pos">{formatPosition(telemetryData.pos)}</span>
              <span className="pane__tagcode">{code}</span>
            </span>
          )}
          <span className="pane__feedlabel">{feed}</span>
        </div>
        <div className="pane__mid" data-streaming={String(streaming)} data-ready={String(!streaming || streamReady)}>
          {streaming && <span className="pane__streamveil" />}
          {driverImage ? <img className="pane__driverimg" src={driverImage} alt="" /> : <span className="pane__streamready"><Icon name="play" size={24} /><b>{code || "DRIVER"}</b><span>Onboard stream slot ready</span></span>}
          {streaming && <span className="pane__switching"><b>{code || "DRIVER"}</b><span>Warming onboard</span></span>}
        </div>
        {telemetryOn && (
          <div className="pane__obar">
            <div className="obE">
              <div className="obE__bar" style={{ "--c": d.color || "var(--accent)" }}>
                <div className="obE__id">
                  <span className="obE__pos">{telemetryData.pos == null ? "—" : telemetryData.pos}</span>
                  <span className="obE__code">{code}</span>
                </div>
                <div className="obE__drive">
                  <span className="obE__gear"><span className="obE__gearChar">{formatGear(telemetryData.gear)}</span></span>
                  <span className="obE__speed"><b>{formatSpeed(telemetryData.speed)}</b><span>km/h</span></span>
                </div>
                <span className="obE__div" />
                <div className="obE__stack">
                  <div className="obE__line"><span className="obE__lk">Last</span><span className="obE__lv" data-tone={telemetryData.lastTone}>{telemetryData.last}</span></div>
                  <div className="obE__line"><span className="obE__lk">Best</span><span className="obE__lv obE__lv--sm" data-tone="fastest">{telemetryData.best}</span></div>
                </div>
                <span className="obE__div" />
                <div className="obE__stack">
                  <div className="obE__line"><span className="obE__lk">Int</span><span className="obE__lv" data-tone={telemetryData.intervalTone}>{telemetryData.interval}</span></div>
                  <div className="obE__line"><span className="obE__lk">Ldr</span><span className="obE__lv obE__lv--sm">{telemetryData.leaderGap}</span></div>
                </div>
                <span className="obE__spacer" />
                <div className="obE__perf">
                  <div className="obE__mini">
                    {["s1", "s2", "s3"].map((key) => (
                      <span className="obE__miniGroup" key={key}>
                        {Array.from({ length: sectorSlots[key] || MINI_SECTOR_FALLBACK_COUNT }, (_, index) => (
                          <span className="obE__seg" data-tone={(telemetryData.sectors?.[key] || [])[index] || "off"} key={index} />
                        ))}
                      </span>
                    ))}
                  </div>
                  <div className="obE__sectors">
                    <div className="obE__secRow">
                      {["s1", "s2", "s3"].map((key) => (
                        <span className="obE__sec" key={key}>{formatSectorTime(telemetryData.sectorTimes?.[key])}</span>
                      ))}
                    </div>
                    <div className="obE__secRow obE__secRow--best">
                      {["s1", "s2", "s3"].map((key) => (
                        <span className="obE__sec obE__sec--best" key={key}>{formatSectorTime(telemetryData.bestSectorTimes?.[key])}</span>
                      ))}
                    </div>
                  </div>
                </div>
                <span className="obE__div" />
                <div className="obE__tyre" style={{ "--ty": tyreRing(telemetryData.comp) }}>
                  <span className="obE__tyreC">{tyreLetter(telemetryData.comp) || "—"}</span>
                  {telemetryData.age != null && telemetryData.age !== "" && <span className="obE__tyreAge">L{telemetryData.age}</span>}
                </div>
                <span className="obE__pedals">
                  <i className="thr" style={{ width: (telemetryPct(telemetryData.throttle) || 0) + "%" }} />
                  <i className="brk" style={{ width: (telemetryPct(telemetryData.brake) || 0) + "%" }} />
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  function Pane(props) {
    if (props.broadcast) return <BroadcastPane {...props} />;
    return <OnboardPane {...props} />;
  }

  function LiveRacing({ onExit }) {
    const debugParams = React.useMemo(() => new URLSearchParams(window.location.search), []);
    const debugAutoF1Tv = debugParams.get("autoF1Tv") === "1";
    const debugF1TvSeason = debugParams.get("f1Season") || "";
    const debugF1TvRace = debugParams.get("f1Race") || "";
    const debugF1TvSession = debugParams.get("f1Session") || "";
    const debugF1TvMeetingKey = debugParams.get("f1MeetingKey") || "";
    const debugF1TvDetailUrl = debugParams.get("f1DetailUrl") || "";
    const { data: D, profile, connection, dataSource } = window.PW.usePitWall();
    const [isFullScreen, setIsFullScreen] = React.useState(false);
    const [livePrefs] = React.useState(readLivePrefs);
    const [preset, setPreset] = React.useState(() => readInitialLivePreset(livePrefs));
    const [selected, setSelected] = React.useState("");
    const [autopairs, setAutopairs] = React.useState(true);
    const [showToast, setShowToast] = React.useState(true);
    const [audioFeed, setAudioFeed] = React.useState("WORLD");
    const [audioVolume, setAudioVolume] = React.useState(100);
    const [expandedPane, setExpandedPane] = React.useState(null);
    const [streamTarget, setStreamTarget] = React.useState(null);
    const [streamDraft, setStreamDraft] = React.useState("");
    const [capturedStreams, setCapturedStreams] = React.useState([]);
    const [streamStatus, setStreamStatus] = React.useState("");
    const [f1TvSeason, setF1TvSeason] = React.useState(() => debugF1TvSeason || String(new Date().getFullYear()));
    const [f1TvLibrary, setF1TvLibrary] = React.useState(null);
    const [replayTimingAvailability, setReplayTimingAvailability] = React.useState({});
    const [f1TvRaceId, setF1TvRaceId] = React.useState("");
    const [f1TvSessionKind, setF1TvSessionKind] = React.useState(debugF1TvSession || "Race");
    const [f1TvDetailUrl, setF1TvDetailUrl] = React.useState(debugF1TvDetailUrl);
    const [resolvedF1TvContent, setResolvedF1TvContent] = React.useState(null);
    const [f1TvResolving, setF1TvResolving] = React.useState(false);
    const [drmStatus, setDrmStatus] = React.useState(null);
    const [syncSettings, setSyncSettings] = React.useState(readSyncSettings);
    const [syncMenuOpen, setSyncMenuOpen] = React.useState(false);
    const [replayTimingOffset, setReplayTimingOffset] = React.useState(readReplayTimingOffset);
    const [syncMetrics, setSyncMetrics] = React.useState({});
    const [panelSizes, setPanelSizes] = React.useState(readLivePanelSizes);
    const [customLayouts, setCustomLayouts] = React.useState(readCustomLayouts);
    const [customPickerOpen, setCustomPickerOpen] = React.useState(false);
    const [customConfigOpen, setCustomConfigOpen] = React.useState(false);
    const [customDraftRects, setCustomDraftRects] = React.useState({});
    const [customChromeTileId, setCustomChromeTileId] = React.useState(null);
    const [timingColumns, setTimingColumns] = React.useState(readTimingColumns);
    const [timingConfigOpen, setTimingConfigOpen] = React.useState(false);
    const [onboardOverrides, setOnboardOverrides] = React.useState({});
    const [retainedPanes, setRetainedPanes] = React.useState([]);
    const [aiPopupOpen, setAiPopupOpen] = React.useState(false);
    const [partyTrayOpen, setPartyTrayOpen] = React.useState(false);
    const [partyTrayMinimized, setPartyTrayMinimized] = React.useState(false);
    const [partyTrayPosition, setPartyTrayPosition] = React.useState(readPartyTrayPosition);
    const [partyToasts, setPartyToasts] = React.useState([]);
    const [partyUnread, setPartyUnread] = React.useState(0);
    const partyToastTimers = React.useRef({});
    const [aiInsightToasts, setAiInsightToasts] = React.useState([]);
    const aiInsightToastTimers = React.useRef({});
    const [partyIdentity, setPartyIdentity] = React.useState(null);
    const [partyRoom, setPartyRoom] = React.useState(null);
    const [partyMembers, setPartyMembers] = React.useState([]);
    const [partyMessages, setPartyMessages] = React.useState([]);
    const [partyTyping, setPartyTyping] = React.useState({});
    const [partyDraft, setPartyDraft] = React.useState("");
    const [partyJoinCode, setPartyJoinCode] = React.useState("");
    const [partyStatus, setPartyStatus] = React.useState("Watch Party ready");
    const [partySyncRole, setPartySyncRole] = React.useState("host");
    const [partyLastSequence, setPartyLastSequence] = React.useState(0);
    const [partyLastHostSync, setPartyLastHostSync] = React.useState(null);
    // Mirrors so the realtime chat handler (inside a long-lived effect) reads
    // the live tray/identity state without re-subscribing on every change.
    const partyTrayOpenRef = React.useRef(partyTrayOpen);
    const partyTrayMinimizedRef = React.useRef(partyTrayMinimized);
    const partyIdentityRef = React.useRef(partyIdentity);
    const partySyncRoleRef = React.useRef(partySyncRole);
    const partyLastSequenceRef = React.useRef(partyLastSequence);
    const partyMemberCountRef = React.useRef(0);
    const partyChatRef = React.useRef(null);
    const partyTypingTimers = React.useRef({});
    const partyLocalTypingRef = React.useRef(false);
    const partyTypingStopTimerRef = React.useRef(null);
    const partyTypingLastSentRef = React.useRef(0);
    // Tracks message ids already in the log so a message echoed back over the
    // realtime channel (Ably echoes the sender's own publishes) isn't appended
    // or toasted twice.
    const partyMsgIdsRef = React.useRef(new Set());
    React.useEffect(() => { partyMsgIdsRef.current = new Set(partyMessages.map((message) => message.id).filter(Boolean)); }, [partyMessages]);
    React.useEffect(() => {
      const chat = partyChatRef.current;
      if (!chat || !partyTrayOpen || partyTrayMinimized) return;
      chat.scrollTop = chat.scrollHeight;
    }, [partyMessages, partyTrayOpen, partyTrayMinimized]);
    React.useEffect(() => { partyTrayOpenRef.current = partyTrayOpen; }, [partyTrayOpen]);
    React.useEffect(() => { partyTrayMinimizedRef.current = partyTrayMinimized; }, [partyTrayMinimized]);
    React.useEffect(() => { partyIdentityRef.current = partyIdentity; }, [partyIdentity]);
    React.useEffect(() => { partySyncRoleRef.current = partySyncRole; }, [partySyncRole]);
    React.useEffect(() => { partyLastSequenceRef.current = partyLastSequence; }, [partyLastSequence]);
    React.useEffect(() => () => {
      clearTimeout(customChromeTimerRef.current);
      clearTimeout(partyTypingStopTimerRef.current);
      Object.values(partyTypingTimers.current).forEach(clearTimeout);
      Object.values(aiInsightToastTimers.current).forEach(clearTimeout);
    }, []);
    // Clear the unread badge + queued toasts whenever the tray is fully visible.
    React.useEffect(() => {
      if (partyTrayOpen && !partyTrayMinimized) {
        setPartyUnread(0);
        setPartyToasts([]);
      }
    }, [partyTrayOpen, partyTrayMinimized]);
    function dismissPartyToast(id) {
      clearTimeout(partyToastTimers.current[id]);
      delete partyToastTimers.current[id];
      setPartyToasts((list) => list.filter((toast) => toast.id !== id));
    }
    function pushPartyToast(message) {
      const id = message.id || `${message.sentAt || ""}:${message.userId || ""}`;
      setPartyToasts((list) => [...list.filter((toast) => toast.id !== id), { id, name: message.name || "Apexline fan", text: message.text }].slice(-3));
      clearTimeout(partyToastTimers.current[id]);
      partyToastTimers.current[id] = setTimeout(() => dismissPartyToast(id), 6500);
    }
    function dismissAiInsightToast(id) {
      clearTimeout(aiInsightToastTimers.current[id]);
      delete aiInsightToastTimers.current[id];
      setAiInsightToasts((list) => list.filter((toast) => toast.id !== id));
    }
    function pushAiInsightToast(card) {
      const id = `${card.capturedAtMs || ""}:${card.title}`;
      setAiInsightToasts((list) => [...list.filter((toast) => toast.id !== id), { id, kind: card.kind, title: card.title, body: card.body }].slice(-2));
      clearTimeout(aiInsightToastTimers.current[id]);
      aiInsightToastTimers.current[id] = setTimeout(() => dismissAiInsightToast(id), 8500);
    }
    function openPartyTray() {
      setPartyTrayOpen(true);
      setPartyTrayMinimized(false);
    }
    const [sessionLibraryOpen, setSessionLibraryOpen] = React.useState(false);
    const bodyRef = React.useRef(null);
    const centerRef = React.useRef(null);
    const gridRef = React.useRef(null);
    const playerRefs = React.useRef({});
    const panelSizesTouchedRef = React.useRef(false);
    const profilePanelSizesKeyRef = React.useRef("");
    const customLayoutsTouchedRef = React.useRef(false);
    const profileCustomLayoutsKeyRef = React.useRef("");
    const customCanvasRef = React.useRef(null);
    const customChromeTimerRef = React.useRef(null);
    const replayClockRef = React.useRef(0);
    const replayTimingRequestRef = React.useRef(0);
    const replayTimingInFlightRef = React.useRef(false);
    const liveTimingRequestRef = React.useRef(0);
    const liveTimingInFlightRef = React.useRef(false);
    const partyDragRef = React.useRef(null);
    const intelligentCodesRef = React.useRef([]);
    const debugAutoF1TvLoaded = React.useRef(false);
    const latestAiSnapshotRef = React.useRef(null);
    const aiInsightHistoryRef = React.useRef([]);
    const autoAiInFlightRef = React.useRef(false);
    const aiInsightRecentRef = React.useRef([]);
    const autoAiBackoffRef = React.useRef({ failures: 0, untilMs: 0 });
    const autoAiLastRequestRef = React.useRef(0);
    const autoAiEventSignatureRef = React.useRef(null);
    const [replaySync, setReplaySync] = React.useState({ mode: "live", playing: true, masterTime: 0, duration: 0, masterKey: "WORLD" });
    const [replayTimingData, setReplayTimingData] = React.useState(null);
    const [liveTimingData, setLiveTimingData] = React.useState(null);
    const [pendingF1TvSelection, setPendingF1TvSelection] = React.useState(false);
    const [clockTick, setClockTick] = React.useState(Date.now());
    const [dismissedInsights, setDismissedInsights] = React.useState([]);
    const [autoAiInsights, setAutoAiInsights] = React.useState([]);
    const [chatDraft, setChatDraft] = React.useState("");
    const [chatMessages, setChatMessages] = React.useState([
      { who: "ai", text: "Live timing is loaded when OpenF1 has a current session. Connect an AI provider in Settings for strategy reasoning over this snapshot." },
    ]);
    const [chatThinking, setChatThinking] = React.useState(false);
    const [streamSources, setStreamSources] = React.useState(readStreamSources);
    const activeCustomLayout = customLayouts.layouts.find((entry) => entry.id === customLayoutIdFromPreset(preset)) || null;
    const layout = activeCustomLayout ? "custom" : LAYOUTS[preset];
    const telemetryDefault = livePrefs.telemetryDefault !== false;
    const videoQuality = normalizeVideoQuality(profile.videoQuality || livePrefs.videoQuality);
    const currentSeason = String(D.seasonSummary?.season || new Date().getFullYear());
    const selectableSeasons = Array.from(new Set([currentSeason, String(new Date().getFullYear()), String(new Date().getFullYear() - 1), String(new Date().getFullYear() - 2), "2024", "2023", "2022", "2021", "2020", "2019", "2018"])).filter(Boolean);
    const f1TvSessionLibrary = normalizeRaceLibrary(f1TvLibrary || localF1TvLibrary(), f1TvSeason || currentSeason, clockTick);
    const f1TvRaces = f1TvSessionLibrary.races || [];
    const currentF1TvWeekendIndex = (() => {
      const index = f1TvRaces.findIndex((race) => race.status === "live" || race.status === "upcoming");
      return index >= 0 ? index : Math.max(0, f1TvRaces.length - 1);
    })();
    const visibleF1TvRaces = f1TvRaces.length ? f1TvRaces.slice(0, currentF1TvWeekendIndex + 1) : [];
    const selectedF1TvRace = f1TvRaces.find((race) => raceLibraryId(race) === f1TvRaceId) || visibleF1TvRaces.at(-1) || f1TvRaces[0] || null;
    const standardF1TvSessions = ["Practice 1", "Practice 2", "Practice 3", "Sprint Qualifying", "Sprint", "Qualifying", "Race"];
    const selectedRaceSessions = selectedF1TvRace?.sessions?.length ? orderedF1TvSessions(selectedF1TvRace.sessions).map((session) => session.kind) : standardF1TvSessions;
    const f1TvSessionOptions = standardF1TvSessions.filter((kind) => selectedRaceSessions.includes(kind)).concat(selectedRaceSessions.filter((kind) => !standardF1TvSessions.includes(kind)));
    const sessionLibrarySessions = selectedF1TvRace?.sessions?.length
      ? orderedF1TvSessions(selectedF1TvRace.sessions)
      : f1TvSessionOptions.map((kind) => ({ kind, status: "unknown" }));
    const selectedF1TvSessionMeta = sessionLibrarySessions.find((session) => session.kind === f1TvSessionKind) || { kind: f1TvSessionKind, status: "unknown" };
    const canResolveSelectedF1TvSession = canLoadF1TvSession(selectedF1TvRace, selectedF1TvSessionMeta);
    const replayTimingAvailabilitySignature = [
      raceLibraryId(selectedF1TvRace),
      ...sessionLibrarySessions.map((session) => [session.kind, session.status, session.sessionKey, session.startsAt, session.endsAt].join(",")),
    ].join("|");

    React.useEffect(() => {
      const t = setTimeout(() => setShowToast(false), 6500);
      return () => clearTimeout(t);
    }, []);
    React.useEffect(() => {
      const windowState = window.pitwall?.windowState;
      if (!windowState) return undefined;
      let mounted = true;
      windowState.get()
        .then((state) => {
          if (mounted) setIsFullScreen(Boolean(state?.isFullScreen));
        })
        .catch(() => {});
      const unsubscribe = windowState.onChange((state) => {
        if (mounted) setIsFullScreen(Boolean(state?.isFullScreen));
      });
      return () => {
        mounted = false;
        if (typeof unsubscribe === "function") unsubscribe();
      };
    }, []);
    React.useEffect(() => {
      if (!debugF1TvSeason) setF1TvSeason(currentSeason);
    }, [currentSeason, debugF1TvSeason]);
    React.useEffect(() => {
      saveStreamSources(streamSources);
    }, [streamSources]);
    React.useEffect(() => {
      localStorage.setItem(SYNC_STORAGE_KEY, JSON.stringify(syncSettings));
    }, [syncSettings]);
    React.useEffect(() => {
      localStorage.setItem(TIMING_OFFSET_STORAGE_KEY, String(clampReplayTimingOffset(replayTimingOffset)));
    }, [replayTimingOffset]);
    React.useEffect(() => {
      localStorage.setItem(PARTY_TRAY_STORAGE_KEY, JSON.stringify(partyTrayPosition));
    }, [partyTrayPosition]);
    React.useEffect(() => {
      const normalized = normalizeLivePanelSizes(panelSizes);
      const serialized = JSON.stringify(normalized);
      localStorage.setItem(PANEL_SIZE_STORAGE_KEY, serialized);
      if (!panelSizesTouchedRef.current || !window.pitwall?.profile?.set || serialized === profilePanelSizesKeyRef.current) return;
      profilePanelSizesKeyRef.current = serialized;
      window.pitwall.profile.set({ ...profile, livePanelSizes: normalized }).catch(() => {});
    }, [panelSizes, profile]);
    React.useEffect(() => {
      const normalized = normalizeCustomLayouts(customLayouts);
      const serialized = JSON.stringify(normalized);
      localStorage.setItem(CUSTOM_LAYOUT_STORAGE_KEY, serialized);
      if (!customLayoutsTouchedRef.current || !window.pitwall?.profile?.set || serialized === profileCustomLayoutsKeyRef.current) return;
      profileCustomLayoutsKeyRef.current = serialized;
      window.pitwall.profile.set({ ...profile, liveCustomLayouts: normalized }).catch(() => {});
    }, [customLayouts, profile]);
    React.useEffect(() => {
      if (customLayoutsTouchedRef.current) return;
      if (!profile.liveCustomLayouts) return;
      const normalized = normalizeCustomLayouts(profile.liveCustomLayouts);
      const serialized = JSON.stringify(normalized);
      setCustomLayouts((current) => {
        const currentNormalized = normalizeCustomLayouts(current);
        const currentSerialized = JSON.stringify(currentNormalized);
        if (serialized === currentSerialized) {
          profileCustomLayoutsKeyRef.current = serialized;
          return current;
        }
        if (!shouldApplyProfileCustomLayouts(currentNormalized, normalized)) {
          profileCustomLayoutsKeyRef.current = currentSerialized;
          return current;
        }
        profileCustomLayoutsKeyRef.current = serialized;
        return normalized;
      });
    }, [profile.liveCustomLayouts]);
    React.useEffect(() => {
      try {
        const saved = JSON.parse(localStorage.getItem("pw-live-layout") || "{}");
        localStorage.setItem("pw-live-layout", JSON.stringify({ ...saved, preset }));
      } catch {
        localStorage.setItem("pw-live-layout", JSON.stringify({ preset }));
      }
    }, [preset]);
    React.useEffect(() => {
      if (panelSizesTouchedRef.current) return;
      if (!profile.livePanelSizes) return;
      const normalized = normalizeLivePanelSizes(profile.livePanelSizes);
      const serialized = JSON.stringify(normalized);
      if (serialized === profilePanelSizesKeyRef.current) return;
      profilePanelSizesKeyRef.current = serialized;
      setPanelSizes((sizes) => JSON.stringify(normalizeLivePanelSizes(sizes)) === serialized ? sizes : normalized);
    }, [profile.livePanelSizes]);
    React.useEffect(() => {
      localStorage.setItem(TIMING_COLUMN_STORAGE_KEY, JSON.stringify(timingColumns));
    }, [timingColumns]);
    React.useEffect(() => {
      const timer = setInterval(() => setClockTick(Date.now()), CLOCK_TICK_INTERVAL_MS);
      return () => clearInterval(timer);
    }, []);

    React.useEffect(() => {
      if (!window.PW_SOCIAL?.bootstrap) return undefined;
      let cancelled = false;
      window.PW_SOCIAL.bootstrap(profile)
        .then((identity) => {
          if (!cancelled) {
            setPartyIdentity(identity);
            setPartyStatus(identity?.offline ? "Watch Party offline until backend is reachable" : "Watch Party ready");
          }
        })
        .catch((error) => {
          if (!cancelled) setPartyStatus(cleanPitWallError(error, "Watch Party unavailable"));
        });
      return () => { cancelled = true; };
    }, [profile.name, profile.profileImageUrl]);

    React.useEffect(() => {
      if (!window.PW_SOCIAL?.on) return undefined;
      return window.PW_SOCIAL.on((event) => {
        if (event.type === "identity") setPartyIdentity(event.identity);
        if (event.type === "room") {
          setPartyRoom(event.room);
          partyMemberCountRef.current = 0;
          setPartyTyping({});
          setPartyLastHostSync(null);
          if (event.room) setPartyStatus(`Room ${event.room.code || event.room.id} ready`);
        }
        if (event.type === "presence") {
          const members = event.members || [];
          const previousCount = partyMemberCountRef.current;
          const nextCount = members.length;
          partyMemberCountRef.current = nextCount;
          setPartyMembers(members);
          if (partySyncRoleRef.current === "host" && nextCount > Math.max(previousCount, 1)) {
            publishHostSync();
          }
        }
        if (event.type === "sync-request" && partySyncRoleRef.current === "host") {
          publishHostSync();
        }
        if (event.type === "typing") {
          const message = event.message || {};
          const userId = message.userId || "";
          if (!userId || userId === partyIdentityRef.current?.userId) return;
          clearTimeout(partyTypingTimers.current[userId]);
          if (message.typing === false) {
            delete partyTypingTimers.current[userId];
            setPartyTyping((typing) => {
              const next = { ...typing };
              delete next[userId];
              return next;
            });
          } else {
            setPartyTyping((typing) => ({ ...typing, [userId]: { userId, name: message.name || "Apexline fan", sentAt: message.sentAt || Date.now() } }));
            partyTypingTimers.current[userId] = setTimeout(() => {
              delete partyTypingTimers.current[userId];
              setPartyTyping((typing) => {
                const next = { ...typing };
                delete next[userId];
                return next;
              });
            }, 3500);
          }
        }
        if (event.type === "chat") {
          const message = event.message || {};
          const duplicate = message.id && partyMsgIdsRef.current.has(message.id);
          if (duplicate) return;
          setPartyMessages((messages) => (message.id && messages.some((existing) => existing.id === message.id) ? messages : [...messages.slice(-79), message]));
          const fromMe = message.userId && message.userId === partyIdentityRef.current?.userId;
          const trayHidden = !partyTrayOpenRef.current || partyTrayMinimizedRef.current;
          if (!fromMe && trayHidden && message.text) {
            pushPartyToast(message);
            setPartyUnread((count) => Math.min(99, count + 1));
          }
        }
        if (event.type === "sync") applyRemotePartySync(event.message);
        if (event.type === "status") setPartyStatus(event.status || "Watch Party status updated");
      });
    }, [replaySync.mode, replaySync.masterKey, resolvedF1TvContent?.contentId, selectedF1TvRace?.meetingKey, f1TvSessionKind, syncSettings]);

    React.useEffect(() => {
      if (!partyRoom || partySyncRole !== "host" || replaySync.mode !== "live") return;
      publishHostSync();
    }, [partyRoom?.id, partySyncRole, replaySync.mode, syncSettings.worldTarget]);

    function configureStream(key, label) {
      setStreamTarget({ key, label });
      setStreamDraft(streamUrl(streamSources[key]));
      loadCapturedStreams();
      loadF1TvLibrary(f1TvSeason);
      refreshDrmStatus();
    }

    function closeStreamModal() {
      setStreamTarget(null);
      setStreamDraft("");
    }

    function saveStreamSource() {
      if (!streamTarget) return;
      const url = streamDraft.trim();
      setStreamSources((sources) => {
        const next = { ...sources };
        if (url) next[streamTarget.key] = url;
        else delete next[streamTarget.key];
        return next;
      });
      closeStreamModal();
    }

    function registerPlayer(key, video) {
      if (!key) return;
      if (video) playerRefs.current[key] = video;
      else delete playerRefs.current[key];
    }

    // The replay clock prefers the WORLD player but falls back to any mounted
    // feed (e.g. an onboard) so timing keeps advancing when F1 Live isn't placed.
    // The driving player's media time is converted to the WORLD timeline so all
    // downstream timing alignment stays anchored to the world feed.
    function replayMasterReading() {
      const masterKey = replaySync.masterKey || "WORLD";
      const worldFeed = resolvedFeedForKey("WORLD") || streamSources.WORLD || {};
      let feedKey = masterKey;
      let video = playerRefs.current[masterKey];
      if (!video) {
        const entry = Object.entries(playerRefs.current)[0];
        if (entry) { feedKey = entry[0]; video = entry[1]; }
      }
      if (!video) return { video: null, worldElapsed: replayClockRef.current || 0 };
      const raw = Number.isFinite(video.currentTime) ? video.currentTime : (replayClockRef.current || 0);
      const feed = resolvedFeedForKey(feedKey, feedKey) || streamSources[feedKey] || {};
      return { video, worldElapsed: Math.max(0, replayTargetMediaTime(raw, feed, worldFeed)) };
    }
    function hostPartyPlaybackSnapshot(mode = replaySync.mode, fallbackTime = replaySync.masterTime) {
      const replayReading = mode === "replay" ? replayMasterReading() : null;
      const video = replayReading?.video || playerRefs.current[replaySync.masterKey || "WORLD"] || playerRefs.current.WORLD || Object.values(playerRefs.current).find(Boolean) || null;
      const masterTime = mode === "replay" ? Math.max(0, replayReading?.worldElapsed ?? fallbackTime ?? 0) : 0;
      const playing = video ? !video.paused : replaySync.playing !== false;
      return { masterTime, playing };
    }
    function applyPartyPlaybackState(playing) {
      const shouldPlay = playing !== false;
      Object.values(playerRefs.current).forEach((video) => {
        if (shouldPlay) video.play().catch(() => {});
        else {
          video.playbackRate = 1;
          video.pause();
        }
      });
      return shouldPlay;
    }
    function syncReplayPlayers(masterTime = replaySync.masterTime) {
      const masterKey = replaySync.masterKey || "WORLD";
      const masterFeed = resolvedFeedForKey(masterKey, masterKey) || streamSources[masterKey] || resolvedFeedForKey("WORLD") || streamSources.WORLD || {};
      const players = Object.entries(playerRefs.current)
        .filter(([, video]) => Boolean(video))
        .map(([key, video]) => ({
          player: video,
          targetTime: replayTargetMediaTime(masterTime, masterFeed, resolvedFeedForKey(key, key) || streamSources[key] || {}),
        }));
      window.PW_SYNC?.syncReplayPlayers?.(players, masterTime, { seekThreshold: 0.5, rateThreshold: 0.075 });
    }

    function currentPartyContext() {
      return {
        mode: replaySync.mode,
        raceName: activeRaceName,
        meetingKey: selectedF1TvRace?.meetingKey,
        sessionKind: activeSessionKind,
        contentId: resolvedF1TvContent?.contentId,
      };
    }

    function partyContentFingerprint() {
      return window.PW_SOCIAL?.contentFingerprint?.(currentPartyContext()) || [replaySync.mode, selectedF1TvRace?.meetingKey || activeRaceName, activeSessionKind, resolvedF1TvContent?.contentId].filter(Boolean).join(":");
    }

    async function createWatchParty() {
      openPartyTray();
      partySyncRoleRef.current = "host";
      setPartySyncRole("host");
      try {
        const room = await window.PW_SOCIAL?.createRoom?.(currentPartyContext());
        setPartyRoom(room || null);
        setPartyStatus(room?.code ? `Invite code ${room.code}` : "Watch Party room created");
        publishHostSync();
      } catch (error) {
        setPartyStatus(cleanPitWallError(error, "Could not create Watch Party"));
      }
    }

    async function joinWatchParty() {
      const code = partyJoinCode.trim();
      if (!code) return;
      openPartyTray();
      partySyncRoleRef.current = "guest";
      setPartySyncRole("guest");
      try {
        const room = await window.PW_SOCIAL?.joinRoom?.(code);
        setPartyRoom(room || null);
        setPartyStatus(room?.code ? `Joined room ${room.code}` : "Joined Watch Party");
        window.PW_SOCIAL?.requestHostSync?.();
      } catch (error) {
        setPartyStatus(cleanPitWallError(error, "Could not join Watch Party"));
      }
    }

    function sendPartyChat() {
      const text = partyDraft.trim();
      if (!text) return;
      publishPartyTyping(false);
      const sent = window.PW_SOCIAL?.sendChat?.(text);
      if (sent) setPartyDraft("");
      else setPartyStatus("Join a Watch Party before sending chat.");
    }

    function publishPartyTyping(typing) {
      if (!partyRoom) return;
      const now = Date.now();
      if (typing) {
        if (partyLocalTypingRef.current && now - partyTypingLastSentRef.current < 1400) return;
        partyLocalTypingRef.current = true;
        partyTypingLastSentRef.current = now;
        window.PW_SOCIAL?.publishTyping?.(true);
        clearTimeout(partyTypingStopTimerRef.current);
        partyTypingStopTimerRef.current = setTimeout(() => publishPartyTyping(false), 2600);
        return;
      }
      if (!partyLocalTypingRef.current) return;
      partyLocalTypingRef.current = false;
      clearTimeout(partyTypingStopTimerRef.current);
      window.PW_SOCIAL?.publishTyping?.(false);
    }

    function updatePartyDraft(value) {
      setPartyDraft(value);
      publishPartyTyping(Boolean(value.trim()));
    }

    function publishHostSync() {
      if (partySyncRoleRef.current !== "host") return null;
      const snapshot = hostPartyPlaybackSnapshot();
      const message = window.PW_SOCIAL?.publishHostSync?.({
        mode: replaySync.mode,
        contentFingerprint: partyContentFingerprint(),
        masterTime: snapshot.masterTime,
        playing: snapshot.playing,
        targetLatency: syncTargetFor("WORLD"),
      });
      if (message?.sequence) {
        partyLastSequenceRef.current = message.sequence;
        setPartyLastSequence(message.sequence);
        setPartyLastHostSync(message);
        setPartyStatus("Host sync sent");
      }
      return message;
    }

    function applyRemotePartySync(message = {}) {
      if (partySyncRoleRef.current === "host") return;
      const expected = partyContentFingerprint();
      const state = { lastSequence: partyLastSequenceRef.current, contentFingerprint: expected, targetLatency: syncTargetFor("WORLD") };
      if (!window.PW_SYNC?.partySync?.shouldApply?.(message, state)) {
        if (message.contentFingerprint && expected && message.contentFingerprint !== expected) {
          setPartyStatus("Load the same session to sync with this Watch Party.");
        }
        return;
      }
      const nextSequence = Number(message.sequence || partyLastSequenceRef.current);
      partyLastSequenceRef.current = nextSequence;
      setPartyLastSequence(nextSequence);
      setPartyLastHostSync(message);
      if (message.mode === "replay") {
        const decision = window.PW_SYNC.partySync.replayDecision(message, { masterTime: replaySync.masterTime });
        seekReplayPlayers(decision.masterTime);
        const playing = applyPartyPlaybackState(decision.playing);
        setReplaySync((sync) => ({ ...sync, mode: "replay", playing, masterTime: decision.masterTime }));
        setPartyStatus("Synced to host replay");
        return;
      }
      const decision = window.PW_SYNC.partySync.liveDecision(message, { liveLatency: syncMetrics.WORLD?.liveLatency, targetLatency: syncTargetFor("WORLD") });
      applyPartyPlaybackState(decision.playing);
      setSyncSettings((settings) => ({ ...settings, worldTarget: clampSyncLatency(decision.targetLatency) }));
      setPartyStatus("Synced to host live latency");
    }

    function projectedPartyReplayTime(message = {}) {
      const sentAt = Number(message.sentAt || Date.now());
      const elapsed = message.playing === false || !Number.isFinite(sentAt) ? 0 : Math.max(0, (Date.now() - sentAt) / 1000);
      return Math.max(0, Number(message.masterTime || 0) + elapsed);
    }

    function computePartySyncState() {
      if (!partyRoom) return { label: "Offline", tone: "off" };
      if (partySyncRole === "host") return { label: "In sync", tone: "ok" };
      if (!partyLastHostSync) return { label: "Out of sync", tone: "bad" };
      if (partyLastHostSync.mode === "replay") {
        const localElapsed = replayMasterReading().worldElapsed;
        const drift = Math.abs(Number(localElapsed || 0) - projectedPartyReplayTime(partyLastHostSync));
        if (drift > 2) return { label: "Out of sync", tone: "bad", drift };
        if (drift > 0.6) return { label: "Catching up", tone: "warn", drift };
        return { label: "In sync", tone: "ok", drift };
      }
      const liveLatency = Number(syncMetrics.WORLD?.liveLatency);
      const targetLatency = Number(partyLastHostSync.targetLatency);
      if (!Number.isFinite(liveLatency) || !Number.isFinite(targetLatency)) return { label: "Catching up", tone: "warn" };
      const drift = Math.abs(liveLatency - targetLatency);
      if (drift > 2) return { label: "Out of sync", tone: "bad", drift };
      if (drift > 0.6) return { label: "Catching up", tone: "warn", drift };
      return { label: "In sync", tone: "ok", drift };
    }

    function startPartyTrayDrag(event) {
      if (event.button != null && event.button !== 0) return;
      if (event.target?.closest?.("button, input, textarea, select, [role='button']")) return;
      const start = {
        pointerId: event.pointerId,
        x: event.clientX,
        y: event.clientY,
        left: partyTrayPosition.x,
        top: partyTrayPosition.y,
      };
      partyDragRef.current = start;
      event.currentTarget.setPointerCapture?.(event.pointerId);
      event.preventDefault();
    }

    function movePartyTray(event) {
      const drag = partyDragRef.current;
      if (!drag || drag.pointerId !== event.pointerId) return;
      const nextX = clampPanelSize(drag.left + event.clientX - drag.x, 12, Math.max(12, window.innerWidth - 448));
      const nextY = clampPanelSize(drag.top + event.clientY - drag.y, 56, Math.max(56, window.innerHeight - 180));
      setPartyTrayPosition({ x: nextX, y: nextY });
    }

    function stopPartyTrayDrag(event) {
      if (partyDragRef.current?.pointerId === event.pointerId) partyDragRef.current = null;
    }

    function seekReplayPlayers(time) {
      const nextTime = Math.max(0, Number(time || 0));
      const masterKey = replaySync.masterKey || "WORLD";
      const masterFeed = resolvedFeedForKey(masterKey, masterKey) || streamSources[masterKey] || resolvedFeedForKey("WORLD") || streamSources.WORLD || {};
      Object.entries(playerRefs.current).forEach(([key, video]) => {
        try { video.currentTime = replayTargetMediaTime(nextTime, masterFeed, resolvedFeedForKey(key, key) || streamSources[key] || {}); } catch {}
      });
      setReplaySync((state) => ({ ...state, masterTime: nextTime }));
      syncReplayPlayers(nextTime);
      if (partyRoom && partySyncRoleRef.current === "host") {
        const snapshot = hostPartyPlaybackSnapshot("replay", nextTime);
        window.PW_SOCIAL?.publishHostSync?.({
          mode: "replay",
          contentFingerprint: partyContentFingerprint(),
          masterTime: nextTime,
          playing: snapshot.playing,
          targetLatency: syncTargetFor("WORLD"),
        });
      }
    }

    function toggleReplayPlayback() {
      setReplaySync((state) => {
        const playing = !state.playing;
        Object.values(playerRefs.current).forEach((video) => {
          if (playing) video.play().catch(() => {});
          else video.pause();
        });
        if (partyRoom && partySyncRoleRef.current === "host") {
          window.PW_SOCIAL?.publishHostSync?.({
            mode: "replay",
            contentFingerprint: partyContentFingerprint(),
            masterTime: replayClockRef.current || state.masterTime || 0,
            playing,
            targetLatency: syncTargetFor("WORLD"),
          });
        }
        return { ...state, playing };
      });
    }

    function togglePlayerSurfacePlayback(key) {
      if (replaySync.mode === "replay") {
        toggleReplayPlayback();
        return;
      }
      const video = playerRefs.current[key];
      if (!video) return;
      if (video.paused) video.play().catch(() => {});
      else video.pause();
    }

    function syncTargetFor(key) {
      const syncKey = key || "WORLD";
      const worldTarget = clampSyncLatency(syncSettings.worldTarget == null ? defaultSyncTarget("WORLD") : syncSettings.worldTarget);
      if (syncKey === "WORLD") return worldTarget;
      const value = syncSettings.targets?.[syncKey];
      return clampSyncLatency(value == null ? defaultSyncTarget(syncKey, worldTarget) : value);
    }

    function adjustSyncTarget(key, delta) {
      const syncKey = key || "WORLD";
      setSyncSettings((settings) => {
        const worldTarget = clampSyncLatency(settings.worldTarget == null ? defaultSyncTarget("WORLD") : settings.worldTarget);
        if (syncKey === "WORLD") {
          const nextWorldTarget = clampSyncLatency(worldTarget + delta);
          return {
            ...settings,
            worldTarget: nextWorldTarget,
            targets: { ...adjustDependentSyncTargets(settings.targets, nextWorldTarget - worldTarget), WORLD: nextWorldTarget },
          };
        }
        return {
          ...settings,
          targets: {
            ...(settings.targets || {}),
            [syncKey]: clampSyncLatency((settings.targets?.[syncKey] == null ? defaultSyncTarget(syncKey, worldTarget) : settings.targets[syncKey]) + delta),
          },
        };
      });
    }

    function resetSyncTarget(key) {
      const syncKey = key || "WORLD";
      setSyncSettings((settings) => {
        if (syncKey === "WORLD") {
          const nextWorldTarget = preferredWorldSyncTarget(livePrefs);
          const currentWorldTarget = clampSyncLatency(settings.worldTarget == null ? defaultSyncTarget("WORLD") : settings.worldTarget);
          return {
            ...settings,
            worldTarget: nextWorldTarget,
            targets: { ...adjustDependentSyncTargets(settings.targets, nextWorldTarget - currentWorldTarget), WORLD: nextWorldTarget },
          };
        }
        const targets = { ...(settings.targets || {}) };
        delete targets[syncKey];
        return { ...settings, targets };
      });
    }

    function adjustReplayTimingOffset(delta) {
      setReplayTimingOffset((value) => clampReplayTimingOffset(value + delta));
    }
    function resetReplayTimingOffset() {
      setReplayTimingOffset(0);
    }
    function setBroadcastTickerRows(rows) {
      panelSizesTouchedRef.current = true;
      setPanelSizes((sizes) => ({ ...sizes, broadcastTickerRows: clampBroadcastTickerRows(rows) }));
    }

    function adjustSidecarCount(delta) {
      panelSizesTouchedRef.current = true;
      setPanelSizes((sizes) => ({ ...sizes, sidecarCount: clampPanelSize((sizes.sidecarCount || 0) + delta, 0, 3) }));
    }

    function createCustomLayout() {
      const id = "cl-" + Math.random().toString(36).slice(2, 10);
      customLayoutsTouchedRef.current = true;
      setCustomLayouts((current) => ({ layouts: [...current.layouts, { id, name: nextCustomLayoutName(current.layouts), tiles: [] }] }));
      setPreset(customLayoutPresetId(id));
    }
    function updateCustomLayout(layoutId, transform) {
      customLayoutsTouchedRef.current = true;
      setCustomLayouts((current) => ({ layouts: current.layouts.map((entry) => entry.id === layoutId ? transform(entry) : entry) }));
    }
    function updateCustomTileRect(layoutId, tileId, rect) {
      updateCustomLayout(layoutId, (entry) => ({ ...entry, tiles: entry.tiles.map((tile) => tile.id === tileId ? { ...tile, ...clampCustomTileGeometry({ ...tile, ...rect }) } : tile) }));
    }
    function updateCustomTileSource(layoutId, tileId, source) {
      const normalized = normalizeCustomTileSource(source);
      if (!normalized) return;
      updateCustomLayout(layoutId, (entry) => ({ ...entry, tiles: entry.tiles.map((tile) => tile.id === tileId ? { ...tile, source: normalized } : tile) }));
    }
    function setCustomTileTicker(layoutId, tileId, patch) {
      updateCustomLayout(layoutId, (entry) => ({ ...entry, tiles: entry.tiles.map((tile) => {
        if (tile.id !== tileId) return tile;
        const next = { ...tile };
        if (patch.tickerRows != null) next.tickerRows = clampCustomTickerRows(patch.tickerRows);
        if (patch.tickerHeight != null) next.tickerHeight = clampCustomTickerHeight(patch.tickerHeight);
        return next;
      }) }));
    }
    function setCustomTileLockAspect(layoutId, tileId, lockAspect) {
      updateCustomLayout(layoutId, (entry) => ({ ...entry, tiles: entry.tiles.map((tile) => tile.id === tileId ? { ...tile, lockAspect: Boolean(lockAspect) } : tile) }));
    }
    function addCustomTile(layoutId, source) {
      addCustomTiles(layoutId, [source]);
    }
    function addCustomTiles(layoutId, sources) {
      const normalizedSources = (Array.isArray(sources) ? sources : [sources]).map(normalizeCustomTileSource).filter(Boolean);
      if (!normalizedSources.length) return;
      updateCustomLayout(layoutId, (entry) => {
        let tiles = entry.tiles;
        normalizedSources.forEach((normalized) => {
          if (tiles.some((tile) => customTileSourceKey(tile.source) === customTileSourceKey(normalized))) return;
          const rect = defaultCustomTileRect(tiles);
          if (!rect) return;
          tiles = [...tiles, { id: "t-" + Math.random().toString(36).slice(2, 10), source: normalized, lockAspect: true, ...rect }];
        });
        return tiles === entry.tiles ? entry : { ...entry, tiles };
      });
    }
    function removeCustomTile(layoutId, tileId) {
      updateCustomLayout(layoutId, (entry) => ({ ...entry, tiles: entry.tiles.filter((tile) => tile.id !== tileId) }));
      setExpandedPane(null);
    }
    function renameCustomLayout(layoutId, name) {
      updateCustomLayout(layoutId, (entry) => ({ ...entry, name: String(name || "") }));
    }
    function duplicateCustomLayout(layoutId) {
      const sourceLayout = customLayouts.layouts.find((entry) => entry.id === layoutId);
      if (!sourceLayout) return;
      const id = "cl-" + Math.random().toString(36).slice(2, 10);
      customLayoutsTouchedRef.current = true;
      setCustomLayouts((current) => ({ layouts: [...current.layouts, { ...sourceLayout, id, name: sourceLayout.name.trim() + " copy", tiles: sourceLayout.tiles.map((tile) => ({ ...tile, id: "t-" + Math.random().toString(36).slice(2, 10) })) }] }));
      setPreset(customLayoutPresetId(id));
    }
    function deleteCustomLayout(layoutId) {
      customLayoutsTouchedRef.current = true;
      setCustomLayouts((current) => ({ layouts: current.layouts.filter((entry) => entry.id !== layoutId) }));
      if (customLayoutIdFromPreset(preset) === layoutId) setPreset("Intelligent");
    }

    function toggleWorldLockAspect() {
      panelSizesTouchedRef.current = true;
      setPanelSizes((sizes) => ({ ...sizes, worldLockAspect: !sizes.worldLockAspect }));
    }

    function focusAudioFeed(key) {
      const nextVolume = audioFeed === key && audioVolume > 0 ? 0 : audioVolume <= 0 ? 100 : audioVolume;
      setAudioVolume(nextVolume);
      setAudioFeed(nextVolume > 0 ? key : null);
    }

    function changeAudioVolume(key, value) {
      const nextVolume = clampVolumeLevel(value);
      setAudioVolume(nextVolume);
      setAudioFeed(nextVolume > 0 ? key : null);
    }

    function recordSyncMetrics(key, metrics) {
      if (!key) return;
      setSyncMetrics((current) => {
        const rounded = {
          targetLatency: metrics.targetLatency,
          liveLatency: metrics.liveLatency == null ? null : Math.round(metrics.liveLatency * 10) / 10,
          playbackRate: Math.round((metrics.playbackRate || 1) * 100) / 100,
          delta: metrics.delta == null ? null : Math.round(metrics.delta * 10) / 10,
        };
        const previous = current[key] || {};
        if (previous.liveLatency === rounded.liveLatency && previous.playbackRate === rounded.playbackRate && previous.targetLatency === rounded.targetLatency) return current;
        return { ...current, [key]: rounded };
      });
    }

    function toggleTimingColumn(id) {
      if (id === "driver") return;
      setTimingColumns((columns) => {
        const next = columns.includes(id) ? columns.filter((column) => column !== id) : [...columns, id];
        const ordered = TIMING_COLUMNS.map((column) => column.id).filter((column) => next.includes(column));
        return ordered.includes("driver") ? ordered : ["driver", ...ordered];
      });
    }

    function startPanelResize(kind, event) {
      event.preventDefault();
      panelSizesTouchedRef.current = true;
      const bodyRect = bodyRef.current?.getBoundingClientRect();
      const centerRect = centerRef.current?.getBoundingClientRect();
      const gridRect = gridRef.current?.getBoundingClientRect();
      const updateFromPointer = (pointerEvent) => {
        setPanelSizes((sizes) => {
          if (kind === "timing" && bodyRect) {
            const width = layout === "focus" ? bodyRect.right - pointerEvent.clientX : pointerEvent.clientX - bodyRect.left;
            return { ...sizes, timingWidth: clampPanelSize(width, 260, Math.min(760, Math.max(300, bodyRect.width - 420))) };
          }
          if (kind === "insights" && centerRect) {
            const height = centerRect.bottom - pointerEvent.clientY;
            return { ...sizes, insightsHeight: clampPanelSize(height, 180, Math.min(460, Math.max(220, centerRect.height - 260))) };
          }
          if (kind === "focus-row" && gridRect) {
            const height = pointerEvent.clientY - gridRect.top;
            return { ...sizes, focusOnboardHeight: clampPanelSize(height, 150, Math.min(380, Math.max(180, gridRect.height - 280))) };
          }
          if (kind === "battle" && gridRect) {
            return { ...sizes, battleSplit: clampPanelPct(((pointerEvent.clientX - gridRect.left) / gridRect.width) * 100, 28, 72) };
          }
          if (kind === "quad-col" && gridRect) {
            return { ...sizes, quadCol: clampPanelPct(((pointerEvent.clientX - gridRect.left) / gridRect.width) * 100, 28, 72) };
          }
          if (kind === "quad-row" && gridRect) {
            return { ...sizes, quadRow: clampPanelPct(((pointerEvent.clientY - gridRect.top) / gridRect.height) * 100, 28, 72) };
          }
          if (kind === "data-a" && gridRect) {
            const first = clampPanelPct(((pointerEvent.clientX - gridRect.left) / gridRect.width) * 100, 20, 60);
            return { ...sizes, dataColA: first, dataColB: Math.min(sizes.dataColB, Math.max(18, 84 - first)) };
          }
          if (kind === "data-b" && gridRect) {
            const total = clampPanelPct(((pointerEvent.clientX - gridRect.left) / gridRect.width) * 100, 42, 84);
            return { ...sizes, dataColB: clampPanelPct(total - sizes.dataColA, 18, Math.max(18, 84 - sizes.dataColA)) };
          }
          if (kind === "data-row" && gridRect) {
            return { ...sizes, dataRow: clampPanelPct(((pointerEvent.clientY - gridRect.top) / gridRect.height) * 100, 28, 72) };
          }
          if (kind === "sidecar" && bodyRect) {
            const width = bodyRect.right - sizes.timingWidth - pointerEvent.clientX;
            return { ...sizes, sidecarWidth: clampPanelSize(width, 220, 480) };
          }
          if (kind === "quad-corner" && gridRect) {
            return {
              ...sizes,
              quadCol: clampPanelPct(((pointerEvent.clientX - gridRect.left) / gridRect.width) * 100, 28, 72),
              quadRow: clampPanelPct(((pointerEvent.clientY - gridRect.top) / gridRect.height) * 100, 28, 72),
            };
          }
          if (kind === "data-corner-a" && gridRect) {
            const first = clampPanelPct(((pointerEvent.clientX - gridRect.left) / gridRect.width) * 100, 20, 60);
            return {
              ...sizes,
              dataColA: first,
              dataColB: Math.min(sizes.dataColB, Math.max(18, 84 - first)),
              dataRow: clampPanelPct(((pointerEvent.clientY - gridRect.top) / gridRect.height) * 100, 28, 72),
            };
          }
          if (kind === "data-corner-b" && gridRect) {
            const total = clampPanelPct(((pointerEvent.clientX - gridRect.left) / gridRect.width) * 100, 42, 84);
            return {
              ...sizes,
              dataColB: clampPanelPct(total - sizes.dataColA, 18, Math.max(18, 84 - sizes.dataColA)),
              dataRow: clampPanelPct(((pointerEvent.clientY - gridRect.top) / gridRect.height) * 100, 28, 72),
            };
          }
          return sizes;
        });
      };
      const stop = () => {
        window.removeEventListener("pointermove", updateFromPointer);
        window.removeEventListener("pointerup", stop);
      };
      updateFromPointer(event);
      window.addEventListener("pointermove", updateFromPointer);
      window.addEventListener("pointerup", stop, { once: true });
    }

    function ResizeHandle({ kind, label }) {
      return <button type="button" className={`resize-handle resize-handle--${kind}`} aria-label={label} onPointerDown={(event) => startPanelResize(kind, event)} />;
    }

    async function loadCapturedStreams() {
      if (!window.pitwall?.f1tv?.streams) return;
      try {
        const streams = await window.pitwall.f1tv.streams();
        setCapturedStreams(Array.isArray(streams) ? streams : []);
        setStreamStatus(streams?.length ? `${streams.length} diagnostic stream${streams.length === 1 ? "" : "s"} captured` : "No diagnostic stream captures yet.");
      } catch (error) {
        setStreamStatus(error.message || "Could not read captured streams");
      }
    }

    function localF1TvLibrary() {
      return {
        season: currentSeason,
        source: "Loaded race calendar",
        races: (D.schedule || []).map((race) => ({
          ...race,
          sessions: race.sessions?.length ? race.sessions : [
            { kind: "Practice 1", status: "unknown" },
            { kind: "Practice 2", status: "unknown" },
            { kind: "Practice 3", status: "unknown" },
            { kind: "Qualifying", status: "unknown" },
            { kind: "Race", status: "unknown" },
          ],
        })),
      };
    }

    function markF1TvSelectionPending() {
      setPendingF1TvSelection(true);
      setResolvedF1TvContent(null);
      setReplayTimingData(null);
      setLiveTimingData(null);
      setStreamSources((sources) => {
        const next = { ...sources };
        delete next.WORLD;
        return next;
      });
    }

    async function loadF1TvLibrary(season = f1TvSeason, options = {}) {
      const forceRefresh = Boolean(options.forceRefresh);
      if (!window.pitwall?.f1tv?.library) {
        const fallback = localF1TvLibrary();
        setF1TvLibrary(fallback);
        if (fallback.races[0]) {
          const fallbackRaceId = raceLibraryId(fallback.races[0]);
          setF1TvRaceId((currentId) => {
            if (currentId && fallback.races.some((race) => raceLibraryId(race) === currentId)) return currentId;
            return fallbackRaceId;
          });
        }
        return;
      }
      setStreamStatus(forceRefresh ? "Refreshing F1 TV session library..." : "Loading F1 TV session library...");
      try {
        const library = await window.pitwall.f1tv.library({ season, forceRefresh });
        const nextLibrary = normalizeRaceLibrary(library?.races?.length ? library : localF1TvLibrary(), season, Date.now());
        setF1TvLibrary(nextLibrary);
        const requestedRace = nextLibrary.races.find((race) => {
          const meeting = String(race.meetingKey || "");
          const name = String(race.name || "").toLowerCase();
          const rnd = String(race.rnd || "");
          return (debugF1TvMeetingKey && meeting === String(debugF1TvMeetingKey).replace(/[^0-9]/g, ""))
            || (debugF1TvRace && name.includes(String(debugF1TvRace).toLowerCase()))
            || (debugF1TvRace && rnd === String(debugF1TvRace).replace(/^r/i, ""));
        });
        const currentRace = requestedRace || nextLibrary.races.find((race) => race.status === "live") || nextLibrary.races.find((race) => race.status === "upcoming") || nextLibrary.races.at(-1) || nextLibrary.races[0];
        if (currentRace) {
          const nextRaceId = raceLibraryId(currentRace);
          setF1TvRaceId((currentId) => {
            if (currentId && nextLibrary.races.some((race) => raceLibraryId(race) === currentId)) return currentId;
            return nextRaceId;
          });
        }
        const cacheLabel = library?.cached ? (library.stale ? " from stale cache" : " from cache") : "";
        setStreamStatus(`${nextLibrary.races.length} F1 TV weekend${nextLibrary.races.length === 1 ? "" : "s"} loaded${cacheLabel} for ${nextLibrary.season}`);
      } catch (error) {
        const fallback = localF1TvLibrary();
        setF1TvLibrary(fallback);
        if (fallback.races[0]) {
          const fallbackRaceId = raceLibraryId(fallback.races[0]);
          setF1TvRaceId((currentId) => {
            if (currentId && fallback.races.some((race) => raceLibraryId(race) === currentId)) return currentId;
            return fallbackRaceId;
          });
        }
        setStreamStatus(error.message || "Using loaded calendar for F1 TV sessions");
      }
    }

    function selectedF1TvRaceItem() {
      const library = f1TvLibrary || localF1TvLibrary();
      const races = library.races || [];
      return races.find((item) => raceLibraryId(item) === f1TvRaceId) || races[0] || null;
    }

    React.useEffect(() => {
      const race = selectedF1TvRace;
      if (!race?.meetingKey || !window.pitwall?.data?.replayTimingAvailability) return undefined;
      const sessions = sessionLibrarySessions.filter((session) => session.status !== "live" && canLoadF1TvSession(race, session));
      if (!sessions.length) return undefined;
      let cancelled = false;
      sessions.forEach((session) => {
        const key = replayTimingAvailabilityKey(race, session);
        setReplayTimingAvailability((current) => current[key] ? current : { ...current, [key]: replayTimingAvailabilityFallback("checking") });
        window.pitwall.data.replayTimingAvailability({
          meetingKey: race.meetingKey,
          sessionKey: session.sessionKey || "",
          sessionKind: session.kind,
          raceName: race.name || "",
          raceStartsAt: race.startsAt || "",
          sessionStartsAt: session.startsAt || "",
          sessionEndsAt: session.endsAt || "",
          sessionStatus: session.status || "",
        }).then((status) => {
          if (cancelled) return;
          setReplayTimingAvailability((current) => ({ ...current, [key]: { ...replayTimingAvailabilityFallback(status?.status), ...(status || {}) } }));
        }).catch(() => {
          if (cancelled) return;
          setReplayTimingAvailability((current) => ({ ...current, [key]: replayTimingAvailabilityFallback("unavailable") }));
        });
      });
      return () => { cancelled = true; };
    }, [replayTimingAvailabilitySignature]);

    React.useEffect(() => {
      if (!debugAutoF1Tv || debugAutoF1TvLoaded.current || f1TvResolving || !f1TvLibrary?.races?.length || !f1TvRaceId) return;
      debugAutoF1TvLoaded.current = true;
      logPitWallDebug("f1tv.debug-auto-load", {
        season: f1TvSeason,
        raceName: selectedF1TvRaceItem()?.name || debugF1TvRace || "",
        sessionKind: f1TvSessionKind,
        meetingKey: selectedF1TvRaceItem()?.meetingKey || debugF1TvMeetingKey || "",
        detailInput: Boolean(f1TvDetailUrl.trim()),
      });
      resolveSelectedF1TvContent("WORLD");
    }, [debugAutoF1Tv, f1TvLibrary, f1TvRaceId, f1TvSeason, f1TvSessionKind, f1TvDetailUrl, f1TvResolving]);

    function selectedF1TvSessionUrl() {
      const race = selectedF1TvRaceItem();
      if (!race) return "";
      const meetingKey = String(race.meetingKey || "").replace(/[^0-9]/g, "");
      if (meetingKey) {
        return `https://f1tv.formula1.com/search?filter_MeetingKey=${meetingKey}&filter_objectSubtype=LIVE_EVENT%2CReplay&filter_orderByFom=Y&orderBy=session_index&sortOrder=asc`;
      }
      const query = encodeURIComponent([f1TvSeason, race.name, f1TvSessionKind].filter(Boolean).join(" "));
      return `https://f1tv.formula1.com/search?q=${query}`;
    }

    async function refreshDrmStatus() {
      if (!window.pitwall?.f1tv?.drmStatus) {
        setDrmStatus({ widevine: false, reason: "Protected playback probe is not available in this browser." });
        return null;
      }
      const status = await window.pitwall.f1tv.drmStatus();
      setDrmStatus(status);
      return status;
    }

    async function preflightF1TvSession() {
      if (!window.pitwall?.f1tv?.probeStatus) return true;
      setStreamStatus("Checking F1 TV session...");
      const status = await window.pitwall.f1tv.probeStatus({ timeoutMs: 1600 });
      if (status?.authenticated) return true;
      setStreamStatus(status?.browserSession ? "F1 TV browser cookies exist, but the playback token is missing. Sign in with email and password in Settings, then retry." : "F1 TV is not connected in this Apexline app profile. MultiViewer login is separate. Connect F1 TV, then load the session again.");
      return false;
    }

    function applyResolvedStreamStatusToLibrary(race, sessionKind, streamStatus) {
      const status = String(streamStatus || "").toLowerCase();
      if (status !== "live" && status !== "replay") return;
      const selectedRaceId = raceLibraryId(race);
      if (!selectedRaceId) return;
      const selectedKind = normalizeF1TvSessionKind(sessionKind);
      const nextSessionStatus = status === "live" ? "live" : "done";
      setF1TvLibrary((library) => {
        if (!library?.races?.length) return library;
        let changed = false;
        const races = library.races.map((item) => {
          if (raceLibraryId(item) !== selectedRaceId) return item;
          const sessions = (item.sessions || []).map((session) => {
            if (normalizeF1TvSessionKind(session.kind) !== selectedKind || session.status === nextSessionStatus) return session;
            changed = true;
            return { ...session, status: nextSessionStatus };
          });
          const raceStatus = normalizeF1TvRaceStatus(item, sessions, Date.now());
          if (raceStatus !== item.status) changed = true;
          return { ...item, status: raceStatus, sessions };
        });
        return changed ? { ...library, races } : library;
      });
    }

    function decorateResolvedFeed(feed, resolved, sessionKind = f1TvSessionKind) {
      const streamStatus = feed.streamStatus || resolved.streamStatus || "";
      const playbackMode = streamStatus === "live"
        ? "live"
        : streamStatus === "replay" ? "replay" : resolved.playbackMode || "replay";
      return {
        ...feed,
        contentId: resolved.contentId || feed.contentId || "",
        sessionKind,
        streamStatus,
        playbackMode,
      };
    }

    async function resolveSelectedF1TvContent(targetKey = "WORLD", selection = {}) {
      if (!window.pitwall?.f1tv?.resolveContent) {
        setStreamStatus("Clean F1 TV resolver is not available in this build.");
        return null;
      }
      const race = selection.race || selectedF1TvRaceItem();
      const sessionKind = selection.sessionKind || f1TvSessionKind;
      const session = selection.session || race?.sessions?.find((item) => item.kind === sessionKind) || { kind: sessionKind, status: "unknown" };
      const detailUrl = f1TvDetailUrl.trim();
      if (!detailUrl && !race) {
        setStreamStatus("No F1 TV session is selected yet.");
        return null;
      }
      if (!detailUrl && !canLoadF1TvSession(race, session)) {
        setStreamStatus(`${race?.name || "This weekend"} - ${sessionKind} has not started yet.`);
        return null;
      }
      setPendingF1TvSelection(true);
      setF1TvResolving(true);
      try {
        logPitWallDebug("f1tv.resolve-start", {
          targetKey,
          season: f1TvSeason,
          raceName: race?.name || debugF1TvRace || "",
          sessionKind,
          meetingKey: race?.meetingKey || debugF1TvMeetingKey || "",
          detailInput: Boolean(detailUrl),
        });
        const hasF1TvSession = await preflightF1TvSession();
        if (!hasF1TvSession) return null;
        await refreshDrmStatus();
        setStreamStatus("Resolving clean F1 TV stream metadata...");
        const resolved = await window.pitwall.f1tv.resolveContent({
          detailUrl,
          season: f1TvSeason,
          raceName: race?.name || debugF1TvRace || "",
          sessionKind,
          sessionStatus: session.status || "",
          meetingKey: race?.meetingKey || debugF1TvMeetingKey || "",
        });
        const feeds = (resolved.feeds || []).map((feed) => decorateResolvedFeed(feed, resolved, sessionKind));
        const world = preferredMainF1TvFeed(feeds);
        const playbackMode = world?.playbackMode || resolved.playbackMode || "replay";
        if (!world) {
          logPitWallDebug("f1tv.resolve-no-world", {
            contentId: resolved.contentId || "",
            message: resolved.message || "",
            feedCount: feeds.length,
            candidateCount: resolved.contentCandidates?.length || 0,
          });
          setStreamSources((sources) => {
            const next = { ...sources };
            delete next[targetKey || "WORLD"];
            return next;
          });
          setResolvedF1TvContent(resolved);
          setStreamStatus(resolved.message || "No clean F1 TV streams were discovered for this session.");
          return null;
        }
        const nextResolved = { ...resolved, feeds };
        applyResolvedStreamStatusToLibrary(race, sessionKind, world.streamStatus || resolved.streamStatus || "");
        setResolvedF1TvContent(nextResolved);
        setPendingF1TvSelection(false);
        setStreamSources((sources) => ({ ...sources, [targetKey || "WORLD"]: world }));
        setReplaySync({ mode: playbackMode, playing: true, masterTime: 0, duration: 0, masterKey: "WORLD" });
        const worldLicense = debugUrlParts(world.licenseUrl || world.drm?.licenseUrl || "");
        logPitWallDebug("f1tv.resolve-success", {
          contentId: resolved.contentId || "",
          feedCount: feeds.length,
          worldFeedId: world.feedId || world.id || "",
          manifestType: world.manifestType || "",
          licenseHost: worldLicense.host,
          licensePathHint: worldLicense.pathHint,
          headerNames: Object.keys(world.headers || {}),
        });
        setStreamStatus(resolved.message || "Clean F1 TV stream loaded.");
        return nextResolved;
      } catch (error) {
        logPitWallDebug("f1tv.resolve-error", {
          message: error?.message || String(error || ""),
          targetKey,
          sessionKind,
        });
        setStreamSources((sources) => {
          const next = { ...sources };
          delete next[targetKey || "WORLD"];
          return next;
        });
        setStreamStatus(cleanPitWallError(error, "Could not resolve this F1 TV session."));
        return null;
      } finally {
        setF1TvResolving(false);
        setPendingF1TvSelection(false);
      }
    }

    async function connectF1TvFromLive() {
      if (!window.pitwall?.f1tv?.login) {
        setStreamStatus("F1 TV login is not available in this build.");
        return;
      }
      try {
        setStreamStatus("Opening F1 TV sign in...");
        const status = await window.pitwall.f1tv.login({ embedded: true });
        setStreamStatus(status?.authenticated ? "F1 TV connected. Load the session again." : "F1 TV sign in did not complete yet.");
      } catch (error) {
        setStreamStatus(cleanPitWallError(error, "Could not open F1 TV sign in."));
      }
    }

    async function loadSelectedF1TvReplay(selection = {}) {
      markF1TvSelectionPending();
      const resolved = await resolveSelectedF1TvContent("WORLD", selection);
      if (!resolved) return;
      setAudioFeed("WORLD");
      setPreset("Intelligent");
      setExpandedPane(null);
      setSessionLibraryOpen(false);
    }

    function openSessionLibrary() {
      setSessionLibraryOpen(true);
      loadF1TvLibrary(f1TvSeason);
    }

    function chooseLibraryRace(race) {
      markF1TvSelectionPending();
      setF1TvRaceId(raceLibraryId(race));
      const firstSession = race?.sessions?.find((session) => session.status === "live")
        || race?.sessions?.find((session) => session.status === "done")
        || race?.sessions?.[0];
      if (firstSession?.kind) setF1TvSessionKind(firstSession.kind);
    }

    function loadLibrarySession(race, session) {
      if (!canLoadF1TvSession(race, session)) {
        setStreamStatus(`${race?.name || "This weekend"} - ${session?.kind || "Session"} has not started yet.`);
        return;
      }
      markF1TvSelectionPending();
      setF1TvRaceId(raceLibraryId(race));
      setF1TvSessionKind(session.kind);
      loadSelectedF1TvReplay({ race, session, sessionKind: session.kind });
    }

    async function openF1TvBrowser() {
      if (!window.pitwall?.f1tv?.browse) return;
      try {
        await window.pitwall.f1tv.browse();
        setStreamStatus("Diagnostics browser opened. Use clean resolve first; refresh diagnostics only if stream discovery fails.");
        setTimeout(loadCapturedStreams, 1200);
      } catch (error) {
        setStreamStatus(cleanPitWallError(error, "Could not open F1 TV browser"));
      }
    }

    async function openSelectedF1TvSession() {
      const race = selectedF1TvRaceItem();
      if (!race) {
        setStreamStatus("No race weekends are loaded yet.");
        return;
      }
      if (!window.pitwall?.f1tv?.browseSession) {
        await openF1TvBrowser();
        return;
      }
      try {
        await window.pitwall.f1tv.browseSession({
          season: f1TvSeason,
          raceName: race.name,
          sessionKind: f1TvSessionKind,
          meetingKey: race.meetingKey,
        });
        setStreamStatus(`Opened diagnostics for ${race.name} - ${f1TvSessionKind}. Use clean resolve first; refresh diagnostics only if stream discovery fails.`);
        setTimeout(loadCapturedStreams, 1500);
      } catch (error) {
        setStreamStatus(cleanPitWallError(error, "Could not open the selected F1 TV session"));
      }
    }

    // Saved layouts apply automatically when live mode opens (the explicit restore button was removed).
    React.useEffect(() => {
      try {
        const saved = JSON.parse(localStorage.getItem("pw-live-layout") || "{}");
        const savedPreset = normalizePresetName(saved.preset);
        const savedCustomId = customLayoutIdFromPreset(saved.preset || "");
        if (savedCustomId && readCustomLayouts().layouts.some((entry) => entry.id === savedCustomId)) setPreset(saved.preset);
        else if (savedPreset && LAYOUTS[savedPreset]) setPreset(savedPreset);
        if (saved.selected && D.byCode[saved.selected]) setSelected(saved.selected);
        if (saved.panelSizes) setPanelSizes(normalizeLivePanelSizes(saved.panelSizes));
        if (saved.expandedPane) setExpandedPane(saved.expandedPane);
      } catch {}
    }, []);

    function activeTimingRows() {
      const replayRows = Array.isArray(replayTimingData?.timing) ? replayTimingData.timing : [];
      const liveRows = Array.isArray(liveTimingData?.timing) ? liveTimingData.timing : [];
      const hasWorldSource = Boolean(streamDescriptor(streamSources.WORLD || preferredMainF1TvFeed(resolvedF1TvContent?.feeds || [])));
      if (replaySync.mode === "replay") return replayRows;
      if (hasWorldSource || liveTimingData) return liveRows;
      return D.timing;
    }

    function activeAiSnapshot() {
      const replayElapsedSeconds = Math.max(0, replayMasterReading().worldElapsed);
      return buildActiveAiSnapshot({
        mode: replaySync.mode,
        timingRows: activeTimingRows(),
        baseData: D,
        sourceLabel: timingSourceLabel,
        weather: wx,
        sessionClock,
        replay: {
          elapsedSeconds: replayElapsedSeconds,
          timingOffsetSeconds: replayTimingOffset,
          sessionKind: f1TvSessionKind,
          raceName: selectedF1TvRace?.name || D.race?.name || "",
        },
        raceControl: activeRaceControlMessages || [],
      });
    }

    async function sendChat() {
      const text = chatDraft.trim();
      if (!text || chatThinking) return;
      setChatMessages((msgs) => [...msgs, { who: "me", text }]);
      setChatDraft("");
      if (!connection.aiConfigured || !window.pitwall?.ai?.ask) {
        setChatMessages((msgs) => [...msgs, { who: "ai", text: "Connect an AI provider in Settings to generate strategy projections from live data." }]);
        return;
      }
      setChatThinking(true);
	      try {
	        const answer = await window.pitwall.ai.ask(aiRequestOptions({
	          prompt: `${text}\n\nRespond as concise, readable Markdown text only. Do not include charts, graphics, cards, or visualization payloads.`,
	          snapshot: activeAiSnapshot(),
	          presentation: "markdown_text_only",
	        }));
	        setChatMessages((msgs) => [...msgs, { who: "ai", text: answer.summary || "The configured AI provider returned no summary." }]);
	      } catch (error) {
	        setChatMessages((msgs) => [...msgs, { who: "ai", text: error.message || "The configured AI provider did not return a response." }]);
	      } finally {
	        setChatThinking(false);
	      }
    }

    function onboardCodes(count, fallback) {
      const picked = [];
      [selectedCode, ...fallback].forEach((code) => {
        if (D.byCode[code] && !picked.includes(code) && picked.length < count) picked.push(code);
      });
      return picked;
    }
    function onboardCodeForSlot(slot, fallback) {
      return liveOnboardCodeForSlot(slot, fallback, onboardOverrides, D.byCode);
    }

    const timingRows = activeTimingRows();
    const timingHasRealRows = hasRealTimingRows(timingRows);
    const timingMiniSectorCounts = React.useMemo(() => timingSectorCounts(timingRows), [timingRows]);
    const { registerTimingRow, movingRows } = useTimingRowMotion(timingRows);
    const selectedCode = selected || timingRows[0]?.code || D.standings[0]?.code || D.drivers[0]?.code || "";
    const preferredCode = (profile.favoriteDrivers || []).find((code) => D.byCode[code]) || "";
    const activeSyncKey = audioFeed || selectedCode || "WORLD";
    const fallbackCodes = timingRows.map((row) => row.code).concat(D.standings.map((row) => row.code), D.drivers.map((driver) => driver.code)).filter(Boolean);
    const liveTimingWeather = liveTimingData?.weather && Object.values(liveTimingData.weather).some((value) => value !== "" && value !== null && value !== undefined) ? liveTimingData.weather : null;
    const wx = replaySync.mode === "replay" && replayTimingData?.weather ? replayTimingData.weather : liveTimingWeather || D.race.weather || {};
    const replaySetupActive = pendingF1TvSelection || replaySync.mode === "replay";
    const activeRaceName = replaySetupActive ? (selectedF1TvRace?.name || D.race?.name || "Live session") : (D.race?.name || "Live session");
    const currentLiveSession = replaySetupActive ? null : D.sessions.find((session) => session.status === "live") || D.schedule.find((race) => race.status === "live");
    const liveSessionKind = liveTimingData?.sessionKind || currentLiveSession?.kind || (D.race?.lap ? "Race" : f1TvSessionKind);
    const activeSessionKind = replaySync.mode === "replay"
      ? (replayTimingData?.sessionKind || f1TvSessionKind)
      : liveSessionKind;
    noteBestSectors(timingRows, `${replaySync.mode}|${activeRaceName}|${activeSessionKind}`);
    const sessionClock = replaySync.mode === "replay" ? replayTimingData?.sessionClock : liveTimingData?.sessionClock;
    const activeTimingData = replaySync.mode === "replay" ? replayTimingData : liveTimingData;
    const timingUnavailable = !timingHasRealRows && activeTimingData?.ok === false;
    const timingLoading = !timingHasRealRows && !timingUnavailable && !pendingF1TvSelection;
    const timingStatusBody = timingUnavailable
      ? (activeTimingData?.message || activeTimingData?.sourceLabel || "Timing is unavailable.")
      : (replaySync.mode === "replay" ? "Replay timing is syncing with the selected session." : "Live timing is warming up for the current feed.");
    const qualifyingPhase = qualifyingPhaseFromSession({ sessionKind: activeSessionKind, sessionClock, rowCount: timingRows.length });
    const focusCodes = intelligentOnboardCodes({
      timingRows,
      preferredCode,
      selectedCode,
      fallbackCodes,
      sessionKind: activeSessionKind,
      sessionClock,
      qualifyingPhase,
      previousCodes: intelligentCodesRef.current,
    });
    intelligentCodesRef.current = focusCodes;
    const quadCodes = onboardCodes(3, fallbackCodes);
    const dataCodes = onboardCodes(5, fallbackCodes);
    const activeBattlePairs = buildActiveBattlePairs(timingRows);
    const battlePair = activeBattlePairs[0] || D.battlePairs?.[0] || null;
    const battleInsight = battlePair || D.insights.find((ins) => ins.kind === "battle");
    const battleCodes = battleInsight?.a && battleInsight?.b ? [battleInsight.a, battleInsight.b] : focusCodes;
    const hasActiveLiveStream = streamDescriptor(streamSources.WORLD)?.playbackMode === "live"
      || resolvedF1TvContent?.playbackMode === "live";
    const hasCurrentLiveSession = Boolean(D.race?.lap || currentLiveSession || hasActiveLiveStream);
    const partyPlaybackLocked = Boolean(partyRoom && partySyncRole !== "host");
    const sessionStatusLabel = hasCurrentLiveSession && D.race?.lap ? `LAP ${D.race.lap} / ${D.race.laps || "—"}` : "";
    const timingLap = telemetryNumber(sessionClock?.lapCount?.lap) ?? telemetryNumber(D.race?.lap);
    const timingLaps = telemetryNumber(sessionClock?.lapCount?.laps) ?? telemetryNumber(D.race?.laps);
    const timingLapLabel = timingLap ? `Lap ${timingLap}/${timingLaps || "—"}` : "";
    const sessionFlag = sessionFlagFromClock(sessionClock, { status: wx.cond === "Rain" ? "yellow" : "green", label: wx.cond || "Session" });
    const timingFlag = sessionFlagFromClock(sessionClock, { status: hasCurrentLiveSession ? "green" : "yellow", label: hasCurrentLiveSession ? "Clear" : "Replay" });
    const showQualifyingElimination = isQualifyingSessionKind(activeSessionKind);
    const timingSourceLabel = replaySync.mode === "replay"
      ? (replayTimingData?.sourceLabel || replayTimingData?.message || "Replay timing pending")
      : pendingF1TvSelection
        ? "Load a past session to start replay timing"
        : (liveTimingData?.sourceLabel || liveTimingData?.message || (D.race.lap ? `Lap ${D.race.lap}/${D.race.laps || "—"}` : dataSource));
    const activeRaceControlMessages = replaySync.mode === "replay"
      ? replayTimingData?.raceControlMessages
      : liveTimingData?.raceControlMessages;
    const deterministicInsights = buildActiveInsights({
      timingRows,
      sourceLabel: timingSourceLabel,
      mode: replaySync.mode,
      weather: wx,
      sessionClock,
      battlePairs: activeBattlePairs,
    });
    const replayInsightElapsed = Math.max(0, Math.round(Number(replaySync.masterTime || replayClockRef.current || 0)));
    const scopedAutoAiInsights = replaySync.mode === "replay"
      ? autoAiInsights.filter((insight) => {
        const replayElapsedSeconds = telemetryNumber(insight.replayElapsedSeconds);
        return replayElapsedSeconds == null || replayElapsedSeconds <= replayInsightElapsed;
      })
      : autoAiInsights;
    const activeInsights = scopedAutoAiInsights.concat(deterministicInsights).slice(0, 4);
    const activeAiInsightScopeKey = [
      replaySync.mode,
      selectedF1TvRace?.meetingKey || activeRaceName,
      activeSessionKind,
      resolvedF1TvContent?.contentId || "",
    ].join(":");
    React.useEffect(() => {
      latestAiSnapshotRef.current = activeAiSnapshot();
    });
    React.useEffect(() => {
      aiInsightHistoryRef.current = [];
      autoAiInFlightRef.current = false;
      aiInsightRecentRef.current = [];
      autoAiBackoffRef.current = { failures: 0, untilMs: 0 };
      autoAiLastRequestRef.current = 0;
      autoAiEventSignatureRef.current = null;
      setAutoAiInsights([]);
    }, [activeAiInsightScopeKey]);
    React.useEffect(() => {
      if (!connection.aiConfigured || !window.pitwall?.ai?.ask) {
        aiInsightHistoryRef.current = [];
        setAutoAiInsights([]);
        return undefined;
      }
      let cancelled = false;
      const requestAutoAiInsight = async () => {
        if (cancelled || autoAiInFlightRef.current) return;
        if (Date.now() < autoAiBackoffRef.current.untilMs) return;
        const snapshot = latestAiSnapshotRef.current || activeAiSnapshot();
        if (!hasRealTimingRows(snapshot?.timing)) return;
        const current = compactAiInsightSnapshot(snapshot);
        const history = mergeAiInsightHistory(aiInsightHistoryRef.current, current, AI_INSIGHT_HISTORY_LIMIT);
        aiInsightHistoryRef.current = history;
        autoAiInFlightRef.current = true;
        autoAiLastRequestRef.current = Date.now();
        try {
          const answer = await window.pitwall.ai.ask(aiRequestOptions(activeAiInsightPayload(current, history, aiInsightRecentRef.current)));
          if (cancelled) return;
          autoAiBackoffRef.current = { failures: 0, untilMs: 0 };
          const card = normalizeAutoAiInsight(answer, { mode: current.mode, capturedAtMs: current.capturedAtMs, replayElapsedSeconds: current.replay?.elapsedSeconds });
          if (!card) return;
          const alreadySeen = aiInsightRecentRef.current.some((item) => item.title === card.title && item.body === card.body);
          aiInsightRecentRef.current = [...aiInsightRecentRef.current, { title: card.title, body: card.body }].slice(-AI_INSIGHT_RECENT_LIMIT);
          setAutoAiInsights((items) => {
            const duplicate = items.some((item) => item.title === card.title && item.body === card.body);
            return duplicate ? items : [card, ...items].slice(0, 2);
          });
          if (!alreadySeen) pushAiInsightToast(card);
        } catch (error) {
          const failures = autoAiBackoffRef.current.failures + 1;
          const backoffMs = AI_INSIGHT_INTERVAL_MS * Math.min(2 ** (failures - 1), 8);
          autoAiBackoffRef.current = { failures, untilMs: Date.now() + backoffMs };
          logPitWallDebug("ai.insight-error", { mode: snapshot.mode, failures, backoffMs, message: error?.message || String(error || "") });
        } finally {
          autoAiInFlightRef.current = false;
        }
      };
      const checkInsightEvents = () => {
        const snapshot = latestAiSnapshotRef.current;
        if (cancelled || !snapshot || !hasRealTimingRows(snapshot.timing)) return;
        const timingRows = Array.isArray(snapshot.timing) ? snapshot.timing : [];
        const signature = [
          JSON.stringify(snapshot.sessionClock?.trackStatus || ""),
          timingRows.reduce((total, row) => total + (Number(row?.pits) || 0), 0),
          timingRows[0]?.code || "",
        ].join("|");
        const previous = autoAiEventSignatureRef.current;
        autoAiEventSignatureRef.current = signature;
        if (previous == null || previous === signature) return;
        if (Date.now() - autoAiLastRequestRef.current < AI_INSIGHT_EVENT_SPACING_MS) return;
        requestAutoAiInsight();
      };
      requestAutoAiInsight();
      const timer = setInterval(requestAutoAiInsight, AI_INSIGHT_INTERVAL_MS);
      const eventTimer = setInterval(checkInsightEvents, AI_INSIGHT_EVENT_POLL_MS);
      return () => {
        cancelled = true;
        autoAiInFlightRef.current = false;
        clearInterval(timer);
        clearInterval(eventTimer);
      };
    }, [connection.aiConfigured, activeAiInsightScopeKey]);
    const sessionClockLabel = sessionClockDisplayLabel(sessionClock, {
      mode: replaySync.mode,
      timingData: replaySync.mode === "replay" ? replayTimingData : liveTimingData,
      replayTime: replaySync.masterTime,
      replayTimingOffset,
      clockTick,
      sessionKind: activeSessionKind,
    });
    function resolvedOnboardFeedForCode(code) {
      const feeds = resolvedF1TvContent?.feeds || [];
      const requestedCode = String(code || "").toUpperCase();
      if (!requestedCode) return null;
      const exact = feeds.find((feed) => String(feed.driverCode || "").toUpperCase() === requestedCode || String(feed.feedId || "").toUpperCase() === requestedCode);
      if (exact) return exact;
      const driver = D.byCode?.[requestedCode] || (D.drivers || []).find((entry) => entry.code === requestedCode) || null;
      const compact = (value) => String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, "");
      const driverName = compact(driver?.name || "");
      const driverSurname = compact(String(driver?.name || "").split(/\s+/).pop());
      if (!driverName && !driverSurname) return null;
      return feeds.find((feed) => {
        if (!feed || feed.driverCode || feed.kind === "world" || feed.feedId === "WORLD") return false;
        const text = compact([feed.title, feed.name, feed.label].filter(Boolean).join(" "));
        return Boolean(text && ((driverName && text.includes(driverName)) || (driverSurname.length >= 4 && text.includes(driverSurname))));
      }) || null;
    }
    function resolvedFeedForKey(key, code) {
      const feeds = resolvedF1TvContent?.feeds || [];
      if (key === "WORLD") return preferredMainF1TvFeed(feeds);
      return feeds.find((feed) => feed.driverCode === code || feed.feedId === key) || resolvedOnboardFeedForCode(code);
    }
    const liveWorkspaceReady = Boolean(streamDescriptor(streamSources.WORLD || resolvedFeedForKey("WORLD")));
    const replayControls = (
      <div className="replay-picker">
        <input className="stream-modal__input" value={f1TvDetailUrl} placeholder="Paste F1 TV detail URL, e.g. https://f1tv.formula1.com/detail/1000010265/-"
          onChange={(e) => { markF1TvSelectionPending(); setF1TvDetailUrl(e.target.value); }} />
        <select className="f1tv-picker__select" value={f1TvSeason} onChange={(e) => { markF1TvSelectionPending(); setF1TvSeason(e.target.value); loadF1TvLibrary(e.target.value); }}>
          {selectableSeasons.map((season) => <option key={season} value={season}>{season}</option>)}
        </select>
        <select className="f1tv-picker__select" value={selectedF1TvRace ? raceLibraryId(selectedF1TvRace) : ""} onChange={(e) => { markF1TvSelectionPending(); setF1TvRaceId(e.target.value); }}>
          {f1TvRaces.map((race) => <option key={raceLibraryId(race)} value={raceLibraryId(race)}>{race.rnd ? "R" + race.rnd + " - " : ""}{race.name}</option>)}
        </select>
        <div className="replay-picker__sessions">
          {(f1TvSessionOptions.length ? f1TvSessionOptions : ["Practice 1", "Qualifying", "Race"]).map((kind) => (
            <button className="f1tv-session" data-active={f1TvSessionKind === kind} key={kind} onClick={() => { markF1TvSelectionPending(); setF1TvSessionKind(kind); }}>{kind}</button>
          ))}
        </div>
      </div>
    );
    React.useEffect(() => {
      loadF1TvLibrary(f1TvSeason);
      refreshDrmStatus();
    }, []);
    React.useEffect(() => {
      const onKeyDown = (event) => {
        const tag = event.target?.tagName;
        if (["INPUT", "TEXTAREA", "SELECT"].includes(tag)) return;
        if (event.key === "d" || event.key === "D") {
          setSyncSettings((settings) => ({ ...settings, debug: !settings.debug }));
          event.preventDefault();
          return;
        }
        if (event.key === "ArrowDown" || event.key === "ArrowUp") {
          const step = event.shiftKey ? 0.1 : 1;
          adjustSyncTarget(activeSyncKey, event.key === "ArrowDown" ? -step : step);
          event.preventDefault();
        }
      };
      window.addEventListener("keydown", onKeyDown);
      return () => window.removeEventListener("keydown", onKeyDown);
    }, [activeSyncKey]);
    React.useEffect(() => {
      replayClockRef.current = replaySync.masterTime || 0;
    }, [replaySync.masterTime]);
    React.useEffect(() => {
      if (!liveWorkspaceReady || replaySync.mode === "replay" || pendingF1TvSelection) {
        setLiveTimingData(null);
        return undefined;
      }
      if (!window.pitwall?.data?.liveTiming) return undefined;
      let cancelled = false;
      const loadLiveTiming = async () => {
        if (liveTimingInFlightRef.current) return;
        const requestId = liveTimingRequestRef.current + 1;
        liveTimingRequestRef.current = requestId;
        liveTimingInFlightRef.current = true;
        try {
          const data = await window.pitwall.data.liveTiming({ source: "f1", targetLatencySeconds: syncTargetFor("WORLD") });
          if (cancelled || requestId !== liveTimingRequestRef.current) return;
          setLiveTimingData(data || null);
          logPitWallDebug("live.timing", {
            rowCount: data?.timing?.length || 0,
            ok: Boolean(data?.ok),
          });
        } catch (error) {
          if (cancelled || requestId !== liveTimingRequestRef.current) return;
          setLiveTimingData({ ok: false, timing: [], weather: {}, sourceLabel: "Formula 1 live timing unavailable", message: "Formula 1 SignalR live timing is unavailable." });
          logPitWallDebug("live.timing-error", { message: error?.message || String(error || "") });
        } finally {
          if (requestId === liveTimingRequestRef.current) liveTimingInFlightRef.current = false;
        }
      };
      loadLiveTiming();
      const timer = setInterval(loadLiveTiming, LIVE_TIMING_POLL_INTERVAL_MS);
      return () => {
        cancelled = true;
        liveTimingRequestRef.current += 1;
        liveTimingInFlightRef.current = false;
        clearInterval(timer);
      };
    }, [liveWorkspaceReady, replaySync.mode, syncSettings, pendingF1TvSelection]);
    React.useEffect(() => {
      if (replaySync.mode !== "replay") {
        setReplayTimingData(null);
        return undefined;
      }
      if (!resolvedF1TvContent?.contentId && !resolvedF1TvContent?.feeds?.length) return undefined;
      const meetingKey = selectedF1TvRace?.meetingKey || debugF1TvMeetingKey || "";
      if (!meetingKey || !window.pitwall?.data?.replayTiming) return undefined;
      let cancelled = false;
      let lastBucket = "";
      const loadReplayTiming = async () => {
        const elapsedSeconds = Math.max(0, replayMasterReading().worldElapsed);
        const timingElapsedSeconds = Math.max(0, elapsedSeconds + replayTimingOffset);
        const timingFeed = resolvedFeedForKey("WORLD") || streamSources.WORLD || {};
        const videoStartUtc = timingFeed.videoStartUtc || resolvedF1TvContent?.videoStartUtc || "";
        const videoStartArchiveSeconds = Number.isFinite(Number(timingFeed.videoStartArchiveSeconds)) ? Number(timingFeed.videoStartArchiveSeconds) : null;
        const videoStartKey = videoStartUtc || (videoStartArchiveSeconds != null ? String(Math.round(videoStartArchiveSeconds)) : "");
        const bucket = `${meetingKey}:${f1TvSessionKind}:${Math.floor(timingElapsedSeconds * 10)}:${replayTimingOffset}:${videoStartKey}`;
        if (bucket === lastBucket) return;
        if (replayTimingInFlightRef.current) return;
        lastBucket = bucket;
        const requestId = replayTimingRequestRef.current + 1;
        replayTimingRequestRef.current = requestId;
        replayTimingInFlightRef.current = true;
        try {
          const data = await Promise.race([
            window.pitwall.data.replayTiming({ meetingKey, sessionKind: f1TvSessionKind, elapsedSeconds: timingElapsedSeconds, videoStartUtc, videoStartArchiveSeconds }),
            new Promise((_, reject) => setTimeout(() => reject(new Error("Replay timing request timed out.")), REPLAY_TIMING_REQUEST_TIMEOUT_MS)),
          ]);
          if (cancelled || requestId !== replayTimingRequestRef.current) return;
          setReplayTimingData((current) => hasRealTimingRows(data?.timing) ? data : hasRealTimingRows(current?.timing) ? current : data || null);
          logPitWallDebug("replay.timing", {
            meetingKey,
            sessionKind: f1TvSessionKind,
            videoElapsedSeconds: Math.round(elapsedSeconds),
            timingElapsedSeconds: Math.round(timingElapsedSeconds),
            replayTimingOffset,
            videoStartSynced: Boolean(videoStartUtc || videoStartArchiveSeconds != null),
            rowCount: data?.timing?.length || 0,
            ok: Boolean(data?.ok),
            diagnostics: data?.diagnostics || null,
          });
        } catch (error) {
          if (cancelled || requestId !== replayTimingRequestRef.current) return;
          setReplayTimingData({ ok: false, timing: [], weather: {}, sourceLabel: "Replay timing unavailable", message: "OpenF1 replay timing is unavailable." });
          logPitWallDebug("replay.timing-error", { meetingKey, sessionKind: f1TvSessionKind, message: error?.message || String(error || "") });
        } finally {
          if (requestId === replayTimingRequestRef.current) replayTimingInFlightRef.current = false;
        }
      };
      loadReplayTiming();
      const timer = setInterval(loadReplayTiming, REPLAY_TIMING_POLL_INTERVAL_MS);
      return () => {
        cancelled = true;
        replayTimingRequestRef.current += 1;
        replayTimingInFlightRef.current = false;
        clearInterval(timer);
      };
    }, [replaySync.mode, selectedF1TvRace?.meetingKey, f1TvSessionKind, replayTimingOffset, resolvedF1TvContent?.contentId, resolvedF1TvContent?.feeds]);
    React.useEffect(() => {
      if (replaySync.mode !== "replay") return undefined;
      const timer = setInterval(() => {
        const { video: master, worldElapsed } = replayMasterReading();
        if (!master) return;
        if (replaySync.playing === false) {
          Object.values(playerRefs.current).forEach((video) => {
            video.playbackRate = 1;
            video.pause();
          });
          return;
        }
        syncReplayPlayers(worldElapsed);
        setReplaySync((state) => {
          const duration = Number.isFinite(master.duration) ? master.duration : state.duration;
          if (Math.abs((state.masterTime || 0) - worldElapsed) < 0.1 && state.duration === duration) return state;
          return { ...state, masterTime: worldElapsed, duration };
        });
      }, REPLAY_TIMING_POLL_INTERVAL_MS);
      return () => clearInterval(timer);
    }, [replaySync.mode, replaySync.masterKey, replaySync.playing]);
    React.useEffect(() => {
      if (!autopairs || !battlePair?.a || !battlePair?.b) return;
      if (layout === "focus" || layout === "custom" || layout === "theater") return;
      setPreset("Battle Mode");
      setSelected(battlePair.b);
      setExpandedPane(null);
    }, [autopairs, battlePair?.a, battlePair?.b, layout]);
    React.useEffect(() => {
      if (layout !== "focus") setAiPopupOpen(false);
      if (layout !== "custom") { setCustomPickerOpen(false); setCustomConfigOpen(false); }
    }, [layout]);
    const panelStyle = {
      "--timing-sidebar-w": `${panelSizes.timingWidth}px`,
      "--insights-h": `${panelSizes.insightsHeight}px`,
      "--focus-onboard-h": `${panelSizes.focusOnboardHeight}px`,
      "--battle-a": `${panelSizes.battleSplit}%`,
      "--battle-b": `${100 - panelSizes.battleSplit}%`,
      "--quad-col": `${panelSizes.quadCol}%`,
      "--quad-row": `${panelSizes.quadRow}%`,
      "--data-col-a": `${panelSizes.dataColA}%`,
      "--data-col-b": `${panelSizes.dataColB}%`,
      "--data-row": `${panelSizes.dataRow}%`,
      "--sidecar-w": `${panelSizes.sidecarWidth}px`,
    };
    const sidecarActive = layout === "focus" && panelSizes.sidecarCount > 0;
    const presetOptions = Array.from(new Set((D.presets?.length ? D.presets : Object.keys(LAYOUTS)).map(normalizePresetName))).filter((name) => LAYOUTS[name]);
    const customOnboardContext = {
      timingRows,
      standings: D.standings,
      drivers: D.drivers,
      byCode: D.byCode,
      profile,
      selectedCode,
      fallbackCodes,
      sessionKind: activeSessionKind,
    };
    function customSmartOnboardLabel(source, code = "") {
      const base = source.mode === "leader" ? "Leader"
        : source.mode === "favorite1" ? "Favorite driver"
        : source.mode === "favorite2" ? "Second favorite driver"
        : source.mode === "battle-primary" ? "Battle"
        : source.mode === "battle-secondary" ? "Battle"
        : "Intelligent onboard";
      return code ? `${base} · ${code}` : base;
    }
    function customTilePane(tile) {
      if (tile.source.type === "timing") return null;
      if (tile.source.type === "onboard") {
        return { feed: "Onboard", code: tile.source.code, slot: "custom-" + tile.id, telemetry: true, custom: true, tileId: tile.id, paneId: customPaneIdForSource(tile.source) };
      }
      if (tile.source.type === "smart-onboard") {
        const code = resolveCustomOnboardCode(tile.source, customOnboardContext);
        if (!code) return null;
        return { feed: customSmartOnboardLabel(tile.source), code, slot: "custom-" + tile.id, telemetry: true, custom: true, tileId: tile.id, paneId: customPaneIdForSource(tile.source) };
      }
      const feeds = resolvedF1TvContent?.feeds || [];
      const feed = feeds.find((entry) => entry.feedId === tile.source.feedId) || null;
      if (feed && feed === preferredMainF1TvFeed(feeds)) {
        return { broadcast: true, focus: true, custom: true, tileId: tile.id, paneId: "WORLD" };
      }
      return { feed: channelDisplayName(feed || { feedId: tile.source.feedId }), code: tile.source.feedId, slot: "custom-" + tile.id, custom: true, channel: true, tileId: tile.id, paneId: customPaneIdForSource(tile.source) };
    }
    const panes = layout === "custom"
      ? (activeCustomLayout?.tiles || []).map(customTilePane).filter(Boolean)
      : layout === "battle"
      ? [
          { feed: "Onboard", code: onboardCodeForSlot("battle-a", battleCodes[0]), slot: "battle-a", focus: false, telemetry: true },
          { feed: "Onboard", code: onboardCodeForSlot("battle-b", battleCodes[1]), slot: "battle-b", focus: true, telemetry: true },
        ]
      : layout === "data"
      ? [
          { broadcast: true, focus: true },
          { feed: "Onboard", code: onboardCodeForSlot("data-1", dataCodes[0]), slot: "data-1", telemetry: true },
          { feed: "Onboard", code: onboardCodeForSlot("data-2", dataCodes[1]), slot: "data-2", telemetry: true },
          { feed: "Onboard", code: onboardCodeForSlot("data-3", dataCodes[2]), slot: "data-3" },
          { feed: "Onboard", code: onboardCodeForSlot("data-4", dataCodes[3]), slot: "data-4" },
          { feed: "Pit lane", code: onboardCodeForSlot("data-5", dataCodes[4]), slot: "data-5" },
        ]
      : layout === "quad"
      ? [
          { broadcast: true, focus: true },
          { feed: "Onboard", code: onboardCodeForSlot("quad-1", quadCodes[0]), slot: "quad-1", telemetry: true },
          { feed: "Onboard", code: onboardCodeForSlot("quad-2", quadCodes[1]), slot: "quad-2" },
          { feed: "Onboard", code: onboardCodeForSlot("quad-3", quadCodes[2]), slot: "quad-3" },
        ]
      : layout === "theater"
      ? [
          { broadcast: true, focus: true },
        ]
      : [
          { broadcast: true, focus: true, zone: "world", style: { gridArea: "world" } },
          { feed: "Onboard", code: onboardCodeForSlot("focus-1", focusCodes[0]), slot: "focus-1", zone: "ob1", style: { gridArea: "ob1" } },
          { feed: "Onboard", code: onboardCodeForSlot("focus-2", focusCodes[1]), slot: "focus-2", zone: "ob2", style: { gridArea: "ob2" } },
          { feed: "Onboard", code: onboardCodeForSlot("focus-3", focusCodes[2]), slot: "focus-3", zone: "ob3", style: { gridArea: "ob3" } },
          ...(sidecarActive ? (() => {
            const focusSlotCodes = [1, 2, 3].map((i) => onboardCodeForSlot(`focus-${i}`, focusCodes[i - 1]));
            const sidecarDefaults = Array.from(new Set(fallbackCodes)).filter((code) => !focusSlotCodes.includes(code));
            return Array.from({ length: panelSizes.sidecarCount }, (_, i) => (
              { feed: "Onboard", code: onboardCodeForSlot(`side-${i + 1}`, sidecarDefaults[i]), slot: `side-${i + 1}`, zone: "side" }
            ));
          })() : []),
        ];
    const seenPaneIds = new Set();
    const activePanes = panes
      .filter((pane) => pane.broadcast || pane.code)
      .map((pane) => ({ ...pane, paneId: pane.paneId || (pane.broadcast ? "WORLD" : `DRIVER-${pane.code}`) }))
      .filter((pane) => seenPaneIds.has(pane.paneId) ? false : (seenPaneIds.add(pane.paneId), true));
    const activePaneMap = new Map(activePanes.map((pane) => [pane.paneId, pane]));
    const activePaneSignature = activePanes.map((pane) => `${pane.paneId}:${pane.slot || ""}:${pane.zone || ""}`).join("|");
    React.useEffect(() => {
      setRetainedPanes((current) => {
        const byId = new Map(current.map((pane) => [pane.paneId, pane]));
        activePanes.forEach((pane) => byId.set(pane.paneId, pane));
        return Array.from(byId.values()).slice(-12);
      });
    }, [activePaneSignature]);
    const parkedPanes = retainedPanes.filter((pane) => !activePaneMap.has(pane.paneId)).map((pane) => ({ ...pane, visible: false }));
    const panesToRender = activePanes.concat(parkedPanes);
    // An expanded sidecar pane renders inside the grid, where expanded mode takes over the full cell.
    const sidecarPanes = panesToRender.filter((pane) => pane.zone === "side" && pane.visible !== false && pane.paneId !== expandedPane);
    const gridPanes = panesToRender.filter((pane) => !sidecarPanes.includes(pane));
    const theaterPipCode = layout === "theater" ? onboardCodeForSlot("theater-pip", battleCodes[1] || focusCodes[0]) : null;
    // Theater overlays live INSIDE the broadcast pane's video region (not the whole
    // Live Racing window) so they anchor to the F1 live video and sit above the ticker.
    function renderTheaterVideoOverlay() {
      if (layout !== "theater" || timingRows.length === 0) return null;
      const leader = timingRows[0];
      const ld = D.byCode[leader.code] || {};
      const lt = telemetryForCode(timingRows, leader.code, activeSessionKind);
      const compoundName = { S: "SOFT", M: "MEDIUM", H: "HARD", I: "INTER", W: "WET" };
      const tyL = tyreLetter(lt.comp);
      const tyre = (compoundName[tyL] || tyL || "") + (lt.age != null && lt.age !== "" ? " " + lt.age + "L" : "");
      const parts = String(ld.name || leader.code).trim().split(/\s+/);
      const broadcastName = parts.length > 1 ? parts[0][0] + ". " + parts.slice(1).join(" ").toUpperCase() : String(ld.name || leader.code).toUpperCase();
      const teamColor = ld.color || "var(--accent)";
      return (
        <>
          <div className="live__theater-info">
            {timingLapLabel && <div>{timingLapLabel}</div>}
            <div>Leader <b>{leader.code}</b>{sessionClockLabel ? " · " + sessionClockLabel : ""}</div>
          </div>
          <div className="live__lower3">
            <span className="live__lower3-spine" style={{ background: teamColor }} />
            <span className="live__lower3-pos" style={{ background: teamColor }}>{formatPosition(1)}</span>
            <span className="live__lower3-body">
              <span className="live__lower3-name">{broadcastName}</span>
              <span className="live__lower3-meta">{[String(ld.team || "").toUpperCase(), timingLapLabel, tyre].filter(Boolean).join(" · ")}</span>
            </span>
          </div>
          {theaterPipCode && (
            <div className="live__theater-pip">
              {renderLivePane({ feed: "Onboard", code: theaterPipCode, slot: "theater-pip", telemetry: true, paneId: "DRIVER-" + theaterPipCode, zone: "pip" })}
            </div>
          )}
        </>
      );
    }
    const renderGridPane = (p) => renderLivePane(p.broadcast && layout === "theater" ? { ...p, videoOverlay: renderTheaterVideoOverlay() } : p);

    function renderTimingTower(options = {}) {
      const compact = options.compact === true;
      const towerColumns = compact ? ["driver", "last", "gap", "interval"] : timingColumns;
      return (
        <>
          <div className={"live__timinghd" + (timingLoading ? " live__timinghd--loading" : "") + (compact ? " live__timinghd--compact" : "")}>
            {timingLoading ? <span className="live__timingloadingtitle">Live Timing</span> : <>
            <span className="live__timingtitle">
              <FlagStatus status={timingFlag.status} label={timingFlag.label} />
            </span>
            {(timingLapLabel || sessionClockLabel) && (
              <span className="live__timingclockgroup">
                {timingLapLabel && <span className="live__timinglap">{timingLapLabel}</span>}
                {sessionClockLabel && <span className="live__timingclock" aria-label="Session clock">{sessionClockLabel}</span>}
              </span>
            )}
            {!compact && (
            <span className="live__timingactions">
              {layout === "focus" && (
                <IconButton variant={sidecarActive ? "accent" : "ghost"} size="sm" label={sidecarActive ? "Remove onboard rail" : "Add onboards beside timing"}
                  onClick={() => adjustSidecarCount(sidecarActive ? -3 : 1)}><Icon name={sidecarActive ? "minus" : "plus"} size={14} /></IconButton>
              )}
              <IconButton variant={timingConfigOpen ? "accent" : "ghost"} size="sm" label="Edit timing columns" onClick={() => setTimingConfigOpen((open) => !open)}><Icon name="pencil" size={14} /></IconButton>
            </span>
            )}
            </>}
          </div>
          {!compact && timingConfigOpen && <TimingColumnMenu columns={timingColumns} onToggle={toggleTimingColumn} />}
          <div className="live__timingscroll">
            {timingLoading || timingUnavailable ? (
              <TimingTowerStatus tone={timingUnavailable ? "error" : "loading"} title={timingUnavailable ? "Timing unavailable" : "Loading timing"} body={timingStatusBody} />
            ) : (
              <>
                <div className="timing-tower">
                  <TimingTowerHeader columns={towerColumns} sectorCounts={timingMiniSectorCounts} />
                  {timingRows.map((t) => {
                    const d = D.byCode[t.code] || {};
                    return (
                      <TimingTowerRow key={t.code} row={t} driver={d} columns={towerColumns} sectorCounts={timingMiniSectorCounts}
                        selected={selectedCode === t.code} moving={Boolean(movingRows[t.code])} elimination={showQualifyingElimination && isQualifyingEliminationRow(t, { qualifyingPhase, rowCount: timingRows.length })} registerRow={registerTimingRow}
                        onClick={() => { setSelected(t.code); setPreset("Intelligent"); setExpandedPane(null); }} />
                    );
                  })}
                </div>
                <RaceControlMessages messages={activeRaceControlMessages} />
              </>
            )}
          </div>
          <div className="live__weather">
            <span className="live__wx"><Icon name="thermometer" size={14} /> Air <b>{wx.air != null && wx.air !== "" ? wx.air + "°" : "—"}</b></span>
            <span className="live__wx"><Icon name="gauge" size={14} /> Track <b>{wx.track != null && wx.track !== "" ? wx.track + "°" : "—"}</b></span>
            <span className="live__wx"><Icon name="droplet" size={14} /> <b>{wx.rain || "—"}</b></span>
          </div>
        </>
      );
    }

    function renderLivePane(p) {
      const key = p.broadcast ? "WORLD" : p.code;
      const label = p.broadcast ? "F1 TV" : p.channel ? (p.feed || p.code) : (D.byCode[p.code]?.name || p.code || "Driver") + " onboard";
      const paneKey = p.paneId;
      return (
        <Pane key={paneKey} {...p}
          visible={p.visible !== false}
          style={p.style}
          zone={p.zone}
          driverOptions={p.channel ? [] : D.drivers}
          onDriverChange={(code) => {
            if (p.custom && activeCustomLayout) updateCustomTileSource(activeCustomLayout.id, p.tileId, { type: "onboard", code });
            else if (p.slot) setOnboardOverrides((current) => ({ ...current, [p.slot]: code }));
          }}
          telemetry={(p.telemetry || p.feed === "Onboard") && telemetryDefault}
          streamUrl={streamSources[key] || resolvedFeedForKey(key, p.code)}
          audioActive={audioFeed === key && audioVolume > 0 && p.visible !== false}
          audioVolume={audioVolume}
          onAudioFocus={() => focusAudioFeed(key)}
          onAudioVolumeChange={(value) => changeAudioVolume(key, value)}
          onConfigureStream={() => configureStream(key, label)}
          hasCurrentLiveSession={hasCurrentLiveSession}
          replayControls={replayControls}
          sessionLibrary={renderSessionLibrary({ inline: true })}
          onLoadPastSession={openSessionLibrary}
          onConnectF1Tv={connectF1TvFromLive}
          streamStatus={streamStatus}
          resolving={f1TvResolving}
          replaySync={replaySync}
          onReplayToggle={toggleReplayPlayback}
          onReplaySeek={seekReplayPlayers}
          onSurfaceToggle={() => togglePlayerSurfacePlayback(key)}
          playbackLocked={partyPlaybackLocked}
          onSyncAll={() => syncReplayPlayers(replaySync.masterTime)}
          onPlayerReady={registerPlayer}
          syncKey={key}
          syncDebug={syncSettings.debug}
          syncTarget={syncTargetFor(key)}
          syncMetrics={syncMetrics[key]}
          onSyncMetrics={recordSyncMetrics}
          onSyncAdjust={adjustSyncTarget}
          onSyncReset={resetSyncTarget}
          timingRows={timingRows}
          sessionKind={activeSessionKind}
          videoQuality={videoQuality}
          broadcastTickerRows={panelSizes.broadcastTickerRows}
          onTickerRowsChange={setBroadcastTickerRows}
          lockAspect={p.onLockAspectToggle ? p.lockAspect : panelSizes.worldLockAspect}
          onLockAspectToggle={p.onLockAspectToggle || (p.broadcast ? toggleWorldLockAspect : undefined)}
          expanded={expandedPane === paneKey}
          onExpand={() => setExpandedPane(expandedPane === paneKey ? null : paneKey)} />
      );
    }

    function hideCustomTileChrome(tileId) {
      clearTimeout(customChromeTimerRef.current);
      setCustomChromeTileId((current) => current === tileId ? null : current);
    }

    function handleCustomTilePointerMove(event, tileId) {
      const rect = event.currentTarget.getBoundingClientRect();
      if (event.clientY - rect.top > CUSTOM_TILE_CHROME_HOTZONE_PX) {
        hideCustomTileChrome(tileId);
        return;
      }
      clearTimeout(customChromeTimerRef.current);
      setCustomChromeTileId(tileId);
      customChromeTimerRef.current = setTimeout(() => setCustomChromeTileId((current) => current === tileId ? null : current), CUSTOM_TILE_CHROME_HIDE_MS);
    }

    function beginCustomTileDrag(event, tile, mode) {
      if (!activeCustomLayout) return;
      event.preventDefault();
      event.stopPropagation();
      const canvas = customCanvasRef.current;
      if (!canvas) return;
      const canvasRect = canvas.getBoundingClientRect();
      if (!canvasRect.width || !canvasRect.height) return;
      const origin = { x: event.clientX, y: event.clientY };
      const start = { x: tile.x, y: tile.y, w: tile.w, h: tile.h };
      const layoutId = activeCustomLayout.id;
      const others = activeCustomLayout.tiles.filter((entry) => entry.id !== tile.id);
      let lastValid = start;
      function onPointerMove(moveEvent) {
        const dx = ((moveEvent.clientX - origin.x) / canvasRect.width) * 100;
        const dy = ((moveEvent.clientY - origin.y) / canvasRect.height) * 100;
        const proposed = applyCustomDrag(start, mode, dx, dy);
        const threshold = (8 / canvasRect.width) * 100;
        const snapped = snapCustomTileGeometry(proposed, others, threshold, mode);
        const next = clampCustomTileGeometry(snapped);
        if (!customTileCollides(next, others)) lastValid = next;
        setCustomDraftRects({ [tile.id]: lastValid });
      }
      function onPointerUp() {
        window.removeEventListener("pointermove", onPointerMove);
        window.removeEventListener("pointerup", onPointerUp);
        setCustomDraftRects({});
        updateCustomTileRect(layoutId, tile.id, lastValid);
      }
      window.addEventListener("pointermove", onPointerMove);
      window.addEventListener("pointerup", onPointerUp);
    }
    function customTileLabel(tile) {
      if (tile.source.type === "timing") return "Live timing";
      if (tile.source.type === "onboard") return (D.byCode[tile.source.code]?.name || tile.source.code) + " onboard";
      if (tile.source.type === "smart-onboard") return customSmartOnboardLabel(tile.source, resolveCustomOnboardCode(tile.source, customOnboardContext));
      const feed = (resolvedF1TvContent?.feeds || []).find((entry) => entry.feedId === tile.source.feedId);
      return channelDisplayName(feed || { feedId: tile.source.feedId });
    }
    function renderCustomTile(tile) {
      const isTiming = tile.source.type === "timing";
      const isChannel = tile.source.type === "channel";
      const draft = customDraftRects[tile.id];
      const rect = draft || tile;
      const mappedPane = isTiming ? null : customTilePane(tile);
      const pane = isTiming ? null : activePaneMap.get(mappedPane?.paneId || customPaneIdForSource(tile.source));
      const tickerRows = clampCustomTickerRows(tile.tickerRows);
      const tickerOn = isChannel && tickerRows > 0;
      const feedPane = pane && renderLivePane({
        ...pane,
        style: { position: "absolute", inset: 0 },
        lockAspect: Boolean(tile.lockAspect),
        onLockAspectToggle: () => setCustomTileLockAspect(activeCustomLayout.id, tile.id, !tile.lockAspect),
        hideBuiltinTicker: isChannel,
        feedTickerOn: tickerOn,
        onToggleFeedTicker: isChannel ? () => setCustomTileTicker(activeCustomLayout.id, tile.id, { tickerRows: tickerRows > 0 ? 0 : 2 }) : undefined,
      });
      return (
        <div key={tile.id} className="custom-tile" data-dragging={draft ? "true" : undefined}
          data-chrome={customChromeTileId === tile.id ? "true" : undefined}
          onPointerMove={(event) => handleCustomTilePointerMove(event, tile.id)}
          onPointerLeave={() => hideCustomTileChrome(tile.id)}
          style={{ left: rect.x + "%", top: rect.y + "%", width: rect.w + "%", height: rect.h + "%" }}>
          <div className="custom-tile__head" onPointerDown={(event) => beginCustomTileDrag(event, tile, "move")}>
            <span className="custom-tile__label">{customTileLabel(tile)}</span>
            <IconButton variant="ghost" size="sm" label="Remove tile" onClick={() => removeCustomTile(activeCustomLayout.id, tile.id)}><Icon name="close" size={12} /></IconButton>
          </div>
          <div className="custom-tile__body" data-ticker={tickerOn ? "true" : undefined}>
            {isTiming ? <div className="live__timing live__timing--tile">{renderTimingTower()}</div> : (
              <>
                <div className="custom-tile__feed">{feedPane}</div>
                {tickerOn && (
                  <CustomFeedTicker rows={tickerRows} height={clampCustomTickerHeight(tile.tickerHeight)} timingRows={timingRows}
                    onRowsChange={(n) => setCustomTileTicker(activeCustomLayout.id, tile.id, { tickerRows: n })}
                    onResize={(h) => setCustomTileTicker(activeCustomLayout.id, tile.id, { tickerHeight: h })} />
                )}
              </>
            )}
          </div>
          {["n", "s", "e", "w", "ne", "nw", "se", "sw"].map((dir) => (
            <span key={dir} className={"custom-tile__handle custom-tile__handle--" + dir} onPointerDown={(event) => beginCustomTileDrag(event, tile, dir)} />
          ))}
        </div>
      );
    }
    function renderCustomFeedPicker() {
      const feeds = resolvedF1TvContent?.feeds || [];
      const placedKeys = new Set((activeCustomLayout?.tiles || []).map((tile) => customTileSourceKey(tile.source)));
      const mainFeed = preferredMainF1TvFeed(feeds);
      const channelMap = new Map();
      feeds.filter((feed) => !feed.driverCode && feed.kind !== "onboard").forEach((feed) => {
        if (feed.feedId && !channelMap.has(feed.feedId)) channelMap.set(feed.feedId, feed);
      });
      // Collapse feeds that resolve to the same display name (e.g. a dead second "F1 TV" that
      // plays nothing) — keep the main feed, otherwise prefer a feed that actually plays.
      const channelByName = new Map();
      Array.from(channelMap.values()).forEach((feed) => {
        const name = channelDisplayName(feed);
        const existing = channelByName.get(name);
        if (!existing) { channelByName.set(name, feed); return; }
        const isMain = mainFeed && feed.feedId === mainFeed.feedId;
        const existingIsMain = mainFeed && existing.feedId === mainFeed.feedId;
        if (existingIsMain) return;
        if (isMain || (Boolean(streamDescriptor(feed)) && !streamDescriptor(existing))) channelByName.set(name, feed);
      });
      const channelItems = Array.from(channelByName.values()).map((feed) => ({
        key: customTileSourceKey({ type: "channel", feedId: feed.feedId }),
        label: channelDisplayName(feed),
        source: { type: "channel", feedId: feed.feedId },
      }));
      const driverMap = new Map();
      (D.drivers || []).forEach((driver) => { if (driver.code && !driverMap.has(driver.code)) driverMap.set(driver.code, driver); });
      const onboardItems = Array.from(driverMap.values()).map((driver) => ({
        key: "onboard:" + driver.code,
        label: driver.name || driver.code,
        sub: driver.code,
        num: driver.num,
        color: driver.color,
        source: { type: "onboard", code: driver.code },
      }));
      const smartSource = (mode) => ({ type: "smart-onboard", mode });
      const smartCode = (mode) => resolveCustomOnboardCode(smartSource(mode), customOnboardContext);
      const leaderCode = smartCode("leader");
      const favorite1Code = smartCode("favorite1");
      const favorite2Code = smartCode("favorite2");
      const battlePrimaryCode = smartCode("battle-primary");
      const battleSecondaryCode = smartCode("battle-secondary");
      const smartOnboardItems = [
        leaderCode && { key: customTileSourceKey(smartSource("leader")), label: "Leader", sub: leaderCode, icon: "trophy", source: smartSource("leader") },
        favorite1Code && { key: customTileSourceKey(smartSource("favorite1")), label: "Favorite driver", sub: favorite1Code, icon: "star", source: smartSource("favorite1") },
        favorite2Code && { key: customTileSourceKey(smartSource("favorite2")), label: "Second favorite driver", sub: favorite2Code, icon: "star", source: smartSource("favorite2") },
        battlePrimaryCode && battleSecondaryCode && { key: "smart-onboard:battle", label: "Battle", sub: `${battlePrimaryCode} + ${battleSecondaryCode}`, icon: "zap", sources: [smartSource("battle-primary"), smartSource("battle-secondary")] },
      ].filter(Boolean);
      const pickerGroups = [
        { group: "Channels", items: channelItems, empty: "No channels resolved for this session yet." },
        { group: "Intelligent onboards", items: smartOnboardItems, empty: "No intelligent onboard choices are available yet." },
        { group: "Onboards", items: onboardItems, empty: "No drivers available yet." },
        { group: "App panels", items: [{ key: "timing", label: "Live timing tower", icon: "timer", source: { type: "timing" } }] },
      ];
      return (
        <div className="custom-picker" role="dialog" aria-modal="true" aria-label="Add a feed" onClick={() => setCustomPickerOpen(false)}>
          <div className="custom-picker__panel" onClick={(event) => event.stopPropagation()}>
            <div className="custom-picker__head">
              <span className="custom-picker__title">Add a feed</span>
              <IconButton variant="ghost" size="sm" label="Close feed picker" onClick={() => setCustomPickerOpen(false)}><Icon name="close" size={16} /></IconButton>
            </div>
            <div className="custom-picker__body">
              {pickerGroups.map((group) => (
                <div className="custom-picker__group" key={group.group}>
                  <div className="custom-picker__grouptitle">{group.group}</div>
                  {group.items.length === 0 ? (
                    <div className="custom-picker__empty">{group.empty}</div>
                  ) : (
                    <div className="custom-picker__grid">
                      {group.items.map((item) => {
                        const itemSources = item.sources || [item.source];
                        const sourceKeys = itemSources.map(customTileSourceKey).filter(Boolean);
                        const placed = sourceKeys.length > 0 && sourceKeys.every((key) => placedKeys.has(key));
                        return (
                          <button key={item.key} className="custom-picker__item" disabled={placed}
                            onClick={() => { addCustomTiles(activeCustomLayout.id, item.sources || [item.source]); setCustomPickerOpen(false); }}>
                            {item.num != null
                              ? <span className="custom-picker__num" style={{ background: item.color || "var(--surface-hover)" }}>{item.num}</span>
                              : <span className="custom-picker__icon"><Icon name={item.icon || "radio"} size={14} /></span>}
                            <span className="custom-picker__itemtext">
                              <span className="custom-picker__itemlabel">{item.label}</span>
                              {item.sub && <span className="custom-picker__itemsub">{item.sub}</span>}
                            </span>
                            {placed && <span className="custom-picker__placed">Added</span>}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      );
    }

    function renderEngineerChat() {
      return (
        <div className="ins__chat">
          <div className="ins__msgs" aria-busy={chatThinking ? "true" : "false"}>
            {chatMessages.map((msg, i) => <AiMessage message={msg} key={i} />)}
            {chatThinking && <AiMessage message={{ who: "ai", text: "Engineer is thinking", thinking: true }} />}
          </div>
          <div className="ins__compose">
            <input className="ins__input" placeholder="Ask about strategy, gaps, projections..." value={chatDraft}
              onChange={(e) => setChatDraft(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") sendChat(); }} />
            <IconButton variant="accent" label="Send" onClick={sendChat}><Icon name="chevronRight" size={16} /></IconButton>
          </div>
        </div>
      );
    }

    const PARTY_AV_COLORS = ["var(--team-mclaren)", "var(--team-ferrari)", "var(--team-mercedes)", "var(--team-redbull)", "var(--accent)"];
    function partyAvatarColor(seed) {
      const text = String(seed || "");
      let hash = 0;
      for (let i = 0; i < text.length; i += 1) hash = (hash * 31 + text.charCodeAt(i)) >>> 0;
      return PARTY_AV_COLORS[hash % PARTY_AV_COLORS.length];
    }
    function partyInitial(name) {
      return (String(name || "?").trim()[0] || "?").toUpperCase();
    }
    function partyMemberView(member) {
      const data = (member && member.data) || member || {};
      return { userId: data.userId || member?.clientId || "", name: data.name || member?.name || member?.clientId || "Fan" };
    }
    function renderPartyTypingIndicator() {
      const typing = Object.values(partyTyping).filter((entry) => entry?.name).slice(0, 2);
      if (!typing.length) return null;
      const names = typing.map((entry) => entry.name).join(", ");
      return <div className="wpc__typing">{names}{typing.length === 1 ? " is" : " are"} typing...</div>;
    }

    // Direction C — "Glass Minimal": sync condenses to one header pill + an
    // overlapping avatar stack; sync events fold into the chat as ambient lines.
    function renderPartyTray() {
      if (!partyTrayOpen) return null;
      const myId = partyIdentity?.userId;
      const roster = partyMembers.map(partyMemberView).filter((member) => member.name);
      const present = roster.length ? roster : (partyRoom ? [{ userId: myId, name: partyIdentity?.displayName || profile.name || "You" }] : []);
      const memberCount = Math.max(present.length, partyRoom ? 1 : 0);
      const connected = Boolean(partyRoom);
      const isHost = partySyncRole === "host";
      const partySyncState = computePartySyncState();
      const partySyncLabel = connected ? `${partySyncState.label} · ${memberCount}` : "Offline";
      const inviteCode = partyRoom?.code || partyIdentity?.friendCode || "";
      const raceName = D.race?.name || partyRoom?.label || "Live session";
      const lapText = D.race?.lap ? `Lap ${D.race.lap}${D.race?.laps ? ` / ${D.race.laps}` : ""}` : "Live";
      return (
        <div className="party-tray party-tray--c" data-minimized={String(partyTrayMinimized)} style={{ left: partyTrayPosition.x, top: partyTrayPosition.y }}>
          <div className="wpc__head" onPointerDown={startPartyTrayDrag} onPointerMove={movePartyTray} onPointerUp={stopPartyTrayDrag} onPointerCancel={stopPartyTrayDrag}>
            <span className="wpc__avstack">
              {present.slice(0, 4).map((member, i) => (
                <span className="wpc-av" data-size="sm" key={member.userId || i} style={{ "--ac": member.userId && member.userId === myId ? "var(--accent)" : partyAvatarColor(member.userId || member.name) }}>{partyInitial(member.name)}</span>
              ))}
            </span>
            <span className="wpc__meta">
              <span className="wpc__sync" data-tone={connected ? partySyncState.tone : "off"}>
                {connected && <span className="wpc__dot" />}
                {partySyncLabel}
              </span>
              <span className="wpc__role">{connected ? (<><b>{isHost ? "You're hosting" : "Synced as guest"}</b>{inviteCode ? ` · ${inviteCode}` : ""}</>) : "Create or join a party to watch together"}</span>
            </span>
            <span className="wpc__headspace">
              <IconButton variant="ghost" size="sm" label="Minimize Watch Party" onClick={(event) => { event.stopPropagation(); setPartyTrayMinimized((value) => !value); }}><Icon name="minus" size={14} /></IconButton>
              <IconButton variant="ghost" size="sm" label="Close Watch Party" onClick={(event) => { event.stopPropagation(); setPartyTrayOpen(false); }}><Icon name="close" size={14} /></IconButton>
            </span>
          </div>
          {!partyTrayMinimized && (
            <>
              <div className="wpc__ctx">
                <span className="ic"><Icon name="radio" size={14} /></span> <b>{raceName}</b> · {lapText}
                {connected && (
                  <span className="wpc__ctxact">
                    {isHost && <button type="button" className="wpc__resync" onClick={publishHostSync}><Icon name="timer" size={14} /> Resync</button>}
                    {!isHost && <button type="button" className="wpc__resync" onClick={() => window.PW_SOCIAL?.requestHostSync?.()}><Icon name="timer" size={14} /> Sync To Host</button>}
                    <button type="button" className="wpc__resync wpc__leave" onClick={() => { publishPartyTyping(false); window.PW_SOCIAL?.leaveRoom?.(); setPartyRoom(null); setPartyMembers([]); setPartyMessages([]); setPartyTyping({}); setPartyLastHostSync(null); }}>Leave</button>
                  </span>
                )}
              </div>
              {connected ? (
                <>
                  <div className="wpc__chat" ref={partyChatRef}>
                    <div className="wpc-sys"><span className="ic"><Icon name="radio" size={12} /></span> <b>Room {inviteCode || "ready"}</b> · {memberCount} watching</div>
                    {partyMessages.length ? partyMessages.map((message, i) => {
                      const previousPartyMessage = partyMessages[i - 1];
                      const mine = Boolean(message.userId && message.userId === myId);
                      if (message.system) {
                        return <div className="wpc-sys" key={message.id || `sys-${i}`}><span className="ic"><Icon name="radio" size={12} /></span> {message.text}</div>;
                      }
                      const showSender = shouldShowPartySender(message, previousPartyMessage, myId);
                      return (
                        <div className="wpc-msg" data-me={String(mine)} key={message.id || `${message.sentAt}:${i}`} style={{ "--ac": mine ? "var(--accent)" : partyAvatarColor(message.userId || message.name) }}>
                          {!mine && <span className="wpc-av" data-size="sm" style={{ "--ac": partyAvatarColor(message.userId || message.name) }}>{partyInitial(message.name)}</span>}
                          <span className="wpc-msg__b">
                            {showSender && <span className="wpc-msg__name"><b>{message.name || "Apexline fan"}</b></span>}
                            <span className="wpc-msg__bubble">{message.text}</span>
                          </span>
                        </div>
                      );
                    }) : <div className="wpc__empty">No messages yet — say something to the party.</div>}
                  </div>
                  {renderPartyTypingIndicator()}
                  <div className="wpc__compose">
                    <button type="button" className="wpc__plus" aria-label="Copy invite code" onClick={() => { const code = partyRoom?.code || partyIdentity?.friendCode; if (code) { navigator.clipboard?.writeText?.(code)?.catch?.(() => {}); setPartyStatus(`Invite code ${code} copied`); } }} disabled={!inviteCode}><Icon name="plus" size={14} /></button>
                    <input className="party-input" value={partyDraft} placeholder="Message the party…" onChange={(e) => updatePartyDraft(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && partyDraft.trim()) sendPartyChat(); }} />
                    <IconButton variant="accent" label="Send party chat" onClick={sendPartyChat} disabled={!partyDraft.trim()}><Icon name="chevronRight" size={16} /></IconButton>
                  </div>
                </>
              ) : (
                <div className="wpc__join">
                  <div className="wpc__empty">{partyStatus}</div>
                  <Button variant="primary" size="sm" onClick={createWatchParty} iconLeft={<Icon name="radio" size={14} />}>Create a watch party</Button>
                  <div className="wpc__joinrow">
                    <input className="party-input" value={partyJoinCode} placeholder="Enter room code" aria-label="Room code" onChange={(e) => setPartyJoinCode(e.target.value.toUpperCase())} onKeyDown={(e) => { if (e.key === "Enter" && partyJoinCode.trim()) joinWatchParty(); }} />
                    <Button variant="secondary" size="sm" onClick={joinWatchParty} disabled={!partyJoinCode.trim()}>Join</Button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      );
    }

    function renderPartyToasts() {
      if (!partyToasts.length && !aiInsightToasts.length) return null;
      return (
        <div className="wp-toasts">
          {aiInsightToasts.map((toast) => (
            <button type="button" className="wpt-card" data-ai="true" key={toast.id} onClick={() => { dismissAiInsightToast(toast.id); if (layout === "focus") setAiPopupOpen(true); }}>
              <span className="wpt-card__icon" data-kind={toast.kind}><Icon name={toast.kind === "battle" ? "zap" : toast.kind === "strategy" ? "flag" : "chart"} size={16} /></span>
              <span className="wpt-card__b">
                <span className="wpt-card__top">
                  <span className="wpt-card__name">{toast.title}</span>
                  <span className="wpt-card__eyebrow"><Icon name="sparkles" size={10} /> AI Insight</span>
                </span>
                <span className="wpt-card__msg">{toast.body}</span>
              </span>
            </button>
          ))}
          {partyToasts.map((toast) => (
            <button type="button" className="wpt-card" key={toast.id} onClick={() => { dismissPartyToast(toast.id); openPartyTray(); }}>
              <span className="wpc-av" data-size="md" style={{ "--ac": partyAvatarColor(toast.name) }}>{partyInitial(toast.name)}</span>
              <span className="wpt-card__b">
                <span className="wpt-card__top">
                  <span className="wpt-card__name">{toast.name}</span>
                  <span className="wpt-card__eyebrow">Watch Party</span>
                </span>
                <span className="wpt-card__msg">{toast.text}</span>
              </span>
            </button>
          ))}
        </div>
      );
    }

    function renderInsightsPane(popup = false) {
      return (
        <div className={"live__insights" + (popup ? " live__insights--popup" : "")}>
          <div className="ins__feed">
            <div className="ins__hd">
              <h3><Icon name="sparkles" size={15} /> AI Insights</h3>
              <span style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 }}>
                <span className="ins__model"><Icon name="key" size={12} /> {connection.aiConfigured ? "AI ready" : "AI needed"}</span>
                <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--text-tertiary)" }}>Auto-pair <Switch checked={autopairs} onChange={setAutopairs} /></span>
              </span>
            </div>
            <div className="ins__list">
              {activeInsights.map((ins, i) => ({ ins, i })).filter((item) => !dismissedInsights.includes(item.i)).map(({ ins, i }) => (
                <div className="insight" key={i} data-kind={ins.kind}>
                  <span className="insight__icon"><Icon name={ins.kind === "battle" ? "zap" : ins.kind === "strategy" ? "flag" : "chart"} size={16} /></span>
                  <div style={{ minWidth: 0 }}>
                    <div className="insight__t">{ins.title}{ins.conf != null && <span className="insight__conf">· {Math.round(ins.conf * 100)}%</span>}</div>
                    <div className="insight__b">{ins.body}</div>
                    {ins.kind === "battle" && (
                      <div className="insight__actions">
                        <Button size="sm" variant="primary" onClick={() => { setPreset("Battle Mode"); setSelected(ins.b || battleCodes[1]); setExpandedPane(null); setAiPopupOpen(false); }}>Load pair</Button>
                        <Button size="sm" variant="ghost" onClick={() => setDismissedInsights((items) => [...items, i])}>Dismiss</Button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="ins__chat">
            <div className="ins__hd"><h3><Icon name="radio" size={14} /> Ask the engineer</h3><span className="ins__model" style={{ marginLeft: "auto" }}>What-if ⌥W</span></div>
            {renderEngineerChat()}
          </div>
        </div>
      );
    }

    function renderSessionLibrary(options = {}) {
      const inline = Boolean(options.inline);
      const seasonLabel = String(f1TvSeason || currentSeason || "");
      const selectedId = selectedF1TvRace ? raceLibraryId(selectedF1TvRace) : null;

      const spineState = (race, index) => {
        const status = String(race?.status || "").toLowerCase();
        if (status === "live") return "live";
        if (status === "done") return "done";
        if (index === currentF1TvWeekendIndex) return "next";
        return "upcoming";
      };
      const sessionDisplayName = (kind) => {
        const text = String(kind || "");
        const practice = text.match(/practice\s*([123])/i);
        if (practice) return "FP" + practice[1];
        if (/sprint qualifying|shootout/i.test(text)) return "Sprint Q";
        return text;
      };
      const statusChip = (state) => {
        if (state === "live") return <span className="slr__chip slr__chip--live"><i />Live</span>;
        if (state === "done") return <span className="slr__chip slr__chip--done">Done</span>;
        if (state === "next") return <span className="slr__chip slr__chip--soon">Up next</span>;
        return null;
      };

      const renderCollapsed = (race, state) => {
        const id = raceLibraryId(race);
        const place = racePlace(race);
        const count = race.sessions?.length || 0;
        const lapText = state === "live" && race.lap && race.laps ? `lap ${race.lap}/${race.laps}` : "";
        const detail = [place, race.date, lapText].filter(Boolean).join(" · ");
        const winner = state === "done" ? scheduleWinnerLabel(race) : "";
        const cta = state === "done"
          ? `${count || 5} replay${(count || 5) === 1 ? "" : "s"}`
          : state === "live" ? "Watch"
          : state === "next" ? "Preview"
          : "Scheduled";
        return (
          <div className="slr" data-state={state} key={id}>
            <span className="slr__node" />
            <button className="slr__row" type="button" onClick={() => chooseLibraryRace(race)}>
              <span className="slr__rnd">{race.rnd ? "R" + race.rnd : "R-"}</span>
              <span className="slr__main">
                <span className="slr__name">{race.name || "Race weekend"}</span>
                <span className="slr__meta session-library__race-meta">
                  {statusChip(state)}
                  <span className="slr__metatext">
                    {detail}
                    {winner && <>{detail ? " · " : ""}Winner <span className="slr__drv" style={{ "--tc": driverColor(winner) || "var(--accent)" }}><i />{winner}</span></>}
                  </span>
                </span>
              </span>
              <span className="slr__cta">{cta}<Icon name="chevronRight" size={14} /></span>
            </button>
          </div>
        );
      };

      const renderExpanded = (race, state) => {
        const id = raceLibraryId(race);
        const winner = state === "done" ? scheduleWinnerLabel(race) : "";
        const map = circuitSilhouette(race);
        const exMeta = [
          race.circuit,
          race.date,
          state === "live" && race.lap && race.laps ? `lap ${race.lap}/${race.laps}` : "",
          winner ? `won by ${winner}` : "",
        ].filter(Boolean).join(" · ");
        return (
          <div className="slr slr--open" data-state={state} key={id}>
            <span className="slr__node" />
            <div className="slr__expand">
              <div className="slr__exhead">
                <span className="slr__map" aria-hidden="true">
                  <svg viewBox={map.viewBox} preserveAspectRatio="xMidYMid meet" fill="none">
                    <path d={map.d} stroke="currentColor" strokeWidth="9" strokeLinejoin="round" strokeLinecap="round" />
                  </svg>
                </span>
                <span className="slr__code">{race.rnd ? "R" + race.rnd : "R-"}</span>
                <div>
                  <span className="slr__exname">{race.name || "Race weekend"}</span>
                  <div className="slr__exmeta session-library__race-meta">{exMeta}</div>
                </div>
                <span className="slr__exstatus">
                  {state === "live" ? <span className="slr__chip slr__chip--live"><i />Live now</span>
                    : state === "done" ? <span className="slr__chip slr__chip--done">{winner ? <>Winner <span className="slr__drv slr__drv--chip" style={{ "--tc": driverColor(winner) || "var(--accent)" }}><i />{winner}</span></> : "Replays"}</span>
                    : <span className="slr__chip slr__chip--soon">Upcoming</span>}
                  <span className="session-library__count">{sessionLibrarySessions.length} session{sessionLibrarySessions.length === 1 ? "" : "s"}</span>
                </span>
              </div>
              <div className="slr__grid">
                {sessionLibrarySessions.map((session) => {
                  const active = f1TvSessionKind === session.kind;
                  const live = session.status === "live";
                  const available = canLoadF1TvSession(race, session);
                  const note = session.kind === "Race" && winner ? ` · ${winner}` : "";
                  const timingAvailability = !live && available ? replayTimingAvailability[replayTimingAvailabilityKey(race, session)] : null;
                  return (
                    <div className="slr-cell session-library__row" data-live={String(live)} data-available={String(available)} key={session.kind}>
                      <span className="slr-cell__nm">{sessionDisplayName(session.kind)}</span>
                      <span className="slr-cell__mt">
                        <span>{sessionScheduleText(session)}{note}</span>
                        {timingAvailability && (
                          <span className="replay-timing-badge" data-status={timingAvailability.status || "checking"} title={timingAvailability.message || ""}>
                            <Icon name="timer" size={11} /> {timingAvailability.label || "Checking"}
                          </span>
                        )}
                      </span>
                      <span className="slr-cell__btn">
                        <Button variant={live ? "primary" : "secondary"} size="sm" onClick={() => loadLibrarySession(race, session)} disabled={f1TvResolving || !available} iconLeft={<Icon name="play" size={13} />}>
                          {!available ? "Not started" : f1TvResolving && active ? "Loading..." : live ? "Watch live" : "Watch replay"}
                        </Button>
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        );
      };

      return (
        <div className={"session-library" + (inline ? " session-library--inline" : "")} role="dialog" aria-modal={inline ? "false" : "true"} aria-label="Session Library">
          <div className="session-library__panel">
            <div className="session-library__head">
              <span className="session-library__glyph"><Icon name="grid" size={22} /></span>
              <div>
                <h2 className="session-library__title">Session Library</h2>
                <div className="session-library__sub">{seasonLabel ? `Race weekends from the ${seasonLabel} season, round by round` : "Race weekends, round by round"}</div>
              </div>
              <div className="session-library__tools">
                {seasonLabel && <span className="session-library__season">SEASON <b>{seasonLabel}</b></span>}
                <span className="session-library__close">
                  <IconButton variant="ghost" label="Close session library" onClick={() => setSessionLibraryOpen(false)}><Icon name="close" size={20} /></IconButton>
                </span>
              </div>
            </div>
            <div className="session-library__season-scroll">
              {f1TvRaces.length ? (
                <div className="session-library__spine">
                  {f1TvRaces.map((race, index) => {
                    const state = spineState(race, index);
                    const open = selectedId !== null && raceLibraryId(race) === selectedId;
                    return open ? renderExpanded(race, state) : renderCollapsed(race, state);
                  })}
                </div>
              ) : (
                <div className="session-library__empty">No race weekends are loaded yet.</div>
              )}
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className={"live" + (isFullScreen ? " live--fullscreen" : "")}>
        {/* Title bar */}
        <div className="live__bar">
          <div className="live__barleft">
            <div className="live__traffic"><span style={{ background: "#ff5f57" }} onClick={onExit} /><span style={{ background: "#febc2e" }} /><span style={{ background: "#28c840" }} /></div>
            <span className="live__brand">APEX<i>LINE</i></span>
            <div className="live__race">
              <Badge tone={hasCurrentLiveSession ? "live" : "neutral"}>{hasCurrentLiveSession ? "LIVE" : "REPLAY"}</Badge>
              <span className="live__race-name">{activeRaceName}</span>
              {sessionStatusLabel && <span className="live__lap">{sessionStatusLabel}</span>}
              <FlagStatus status={sessionFlag.status} label={sessionFlag.label} />
            </div>
          </div>
          <div className="live__presets">
            <span className="preset-select-wrap">
              <select className="preset-select" aria-label="Layout preset" value={preset}
                onChange={(e) => {
                  if (e.target.value === "__new-custom-layout__") createCustomLayout();
                  else setPreset(e.target.value);
                  setExpandedPane(null);
                }}>
                {presetOptions.map((p) => <option key={p} value={p}>{p}</option>)}
                <optgroup label="My layouts">
                  {customLayouts.layouts.map((entry) => <option key={entry.id} value={customLayoutPresetId(entry.id)}>{entry.name.trim() || "Custom layout"}</option>)}
                  <option value="__new-custom-layout__">New custom layout…</option>
                </optgroup>
              </select>
              <Icon name="chevronDown" size={14} className="preset-select__icon" />
            </span>
            {layout === "custom" && activeCustomLayout && (
              <span className="custom-bar">
                <Button size="sm" variant="primary" onClick={() => setCustomPickerOpen(true)} iconLeft={<Icon name="plus" size={14} />}>Add feed</Button>
                <span className="custom-config-wrap">
                  <Button size="sm" variant={customConfigOpen ? "secondary" : "ghost"} onClick={() => setCustomConfigOpen((open) => !open)} iconLeft={<Icon name="settings" size={14} />}>Configure</Button>
                  {customConfigOpen && (
                    <div className="custom-config" role="dialog" aria-label="Configure layout">
                      <label className="custom-config__field">
                        <span className="custom-config__label">Layout name</span>
                        <input className="custom-config__name" value={activeCustomLayout.name} aria-label="Custom layout name"
                          onChange={(e) => renameCustomLayout(activeCustomLayout.id, e.target.value)} />
                      </label>
                      <div className="custom-config__actions">
                        <Button size="sm" variant="ghost" onClick={() => { duplicateCustomLayout(activeCustomLayout.id); setCustomConfigOpen(false); }} iconLeft={<Icon name="layers" size={14} />}>Save as copy</Button>
                        <Button size="sm" variant="ghost" onClick={() => { deleteCustomLayout(activeCustomLayout.id); setCustomConfigOpen(false); }} iconLeft={<Icon name="close" size={14} />}>Delete</Button>
                      </div>
                    </div>
                  )}
                </span>
              </span>
            )}
          </div>
          <div className="live__barright">
            {layout === "focus" && <Button variant="secondary" size="sm" onClick={() => setAiPopupOpen(true)} iconLeft={<Icon name="sparkles" size={14} />}>AI</Button>}
            <Button variant="primary" size="sm" onClick={openSessionLibrary} iconLeft={<Icon name="play" size={14} />}>Load past session</Button>
            <Button variant={partyTrayOpen ? "secondary" : "ghost"} size="sm" onClick={openPartyTray} iconLeft={<Icon name="radio" size={14} />}>Watch Party{partyUnread > 0 && <span className="wp-unread">{partyUnread > 99 ? "99+" : partyUnread}</span>}</Button>
            <span className="live__syncwrap">
              <Button variant={syncMenuOpen ? "secondary" : "ghost"} size="sm" onClick={() => setSyncMenuOpen((open) => !open)} iconLeft={<Icon name="timer" size={14} />}>Sync</Button>
              <SyncMenu
                open={syncMenuOpen}
                replayMode={replaySync.mode}
                replayTimingOffset={replayTimingOffset}
                debugEnabled={syncSettings.debug}
                onReplayTimingAdjust={adjustReplayTimingOffset}
                onReplayTimingReset={resetReplayTimingOffset}
                onSyncAll={() => syncReplayPlayers(replaySync.masterTime)}
                onToggleDebug={() => setSyncSettings((settings) => ({ ...settings, debug: !settings.debug }))}
              />
            </span>
            <Button variant="ghost" size="sm" onClick={onExit} iconLeft={<Icon name="close" size={14} />}>Exit live</Button>
          </div>
        </div>

        {/* Body */}
        {liveWorkspaceReady ? (
        <div className="live__body" data-layout={layout} data-sidecar={sidecarActive ? "true" : undefined} ref={bodyRef} style={panelStyle}>
          {/* Live timing sidebar */}
          {layout !== "custom" && layout !== "theater" && (
            <>
              <aside className="live__timing">
                {renderTimingTower()}
              </aside>
              <ResizeHandle kind="timing" label="Resize live timing" />
            </>
          )}

          {/* Onboard rail beside live timing */}
          {sidecarActive && (
            <>
              <div className="live__sidecar">
                <div className="live__sidecarbar">
                  <span>Onboards</span>
                  {panelSizes.sidecarCount < 3 && (
                    <IconButton variant="ghost" size="sm" label="Add onboard" onClick={() => adjustSidecarCount(1)}><Icon name="plus" size={13} /></IconButton>
                  )}
                  <IconButton variant="ghost" size="sm" label="Remove onboard" onClick={() => adjustSidecarCount(-1)}><Icon name="minus" size={13} /></IconButton>
                </div>
                {sidecarPanes.map(renderLivePane)}
              </div>
              <ResizeHandle kind="sidecar" label="Resize onboard rail" />
            </>
          )}

          {/* Center: grid + insights */}
          <div className="live__center" ref={centerRef}>
            <div className="live__grid" ref={gridRef} data-layout={layout} data-expanded={expandedPane ? "true" : undefined} style={{ position: "relative" }}>
              {showToast && battleInsight && (
                <div className="toast">
                  <span className="toast__icon"><Icon name="zap" size={18} /></span>
                  <div>
                    <div className="toast__t">{battleInsight.title}</div>
                    <div className="toast__s">{battleInsight.body}</div>
                  </div>
                  <Button size="sm" variant="primary" onClick={() => { setPreset("Battle Mode"); setSelected(battleCodes[1]); setShowToast(false); setExpandedPane(null); }}>Load pair</Button>
                  <IconButton variant="ghost" size="sm" label="Dismiss" onClick={() => setShowToast(false)}><Icon name="close" size={14} /></IconButton>
                </div>
              )}
              {layout === "focus" && <ResizeHandle kind="focus-row" label="Resize onboard row" />}
              {layout === "battle" && <ResizeHandle kind="battle" label="Resize battle panes" />}
              {layout === "quad" && (
                <>
                  <ResizeHandle kind="quad-col" label="Resize quad columns" />
                  <ResizeHandle kind="quad-row" label="Resize quad rows" />
                  <ResizeHandle kind="quad-corner" label="Resize quad panes diagonally" />
                </>
              )}
              {layout === "data" && (
                <>
                  <ResizeHandle kind="data-a" label="Resize data columns" />
                  <ResizeHandle kind="data-b" label="Resize data columns" />
                  <ResizeHandle kind="data-row" label="Resize data rows" />
                  <ResizeHandle kind="data-corner-a" label="Resize data panes diagonally" />
                  <ResizeHandle kind="data-corner-b" label="Resize data panes diagonally" />
                </>
              )}
              {layout === "custom" && activeCustomLayout ? (
                <>
                  <div className="custom-canvas" ref={customCanvasRef}>
                    {activeCustomLayout.tiles.length === 0 && (
                      <div className="custom-canvas__empty">
                        <span>Blank canvas — add feeds and arrange them however you like</span>
                        <Button size="sm" variant="primary" onClick={() => setCustomPickerOpen(true)} iconLeft={<Icon name="plus" size={14} />}>Add feed</Button>
                      </div>
                    )}
                    {activeCustomLayout.tiles.map(renderCustomTile)}
                  </div>
                  {customPickerOpen && renderCustomFeedPicker()}
                </>
              ) : (
                gridPanes.map(renderGridPane)
              )}
            </div>

            {layout === "theater" && (
              <details className="live__theater-timing" open>
                <summary className="live__theater-timinghd">
                  <span className="live__theater-timingttl"><Icon name="timer" size={13} /> Live Timing</span>
                  <span className="live__theater-timinghint" aria-hidden="true" />
                </summary>
                <div className="live__theater-timingbody">
                  {renderTimingTower({ compact: true })}
                </div>
              </details>
            )}

            {layout !== "focus" && layout !== "custom" && layout !== "theater" && <ResizeHandle kind="insights" label="Resize AI insights" />}
            {layout !== "focus" && layout !== "custom" && layout !== "theater" && renderInsightsPane()}
          </div>
        </div>
        ) : (
          <div className="live__preload">
            {renderSessionLibrary({ inline: true })}
          </div>
        )}
        {renderPartyTray()}
        {renderPartyToasts()}
        {layout === "focus" && aiPopupOpen && (
          <div className="ai-popup" role="dialog" aria-modal="true">
            <div className="ai-popup__panel">
              <span className="ai-popup__close">
                <IconButton variant="ghost" size="sm" label="Close AI popup" onClick={() => setAiPopupOpen(false)}><Icon name="close" size={14} /></IconButton>
              </span>
              {renderInsightsPane(true)}
            </div>
          </div>
        )}
        {sessionLibraryOpen && renderSessionLibrary()}
        {streamTarget && (
          <div className="stream-modal" role="dialog" aria-modal="true">
            <div className="stream-modal__panel">
              <div className="stream-modal__hd">
                <Icon name="settings" size={16} />
                <span className="stream-modal__title">Configure stream</span>
                <IconButton variant="ghost" size="sm" label="Close" onClick={closeStreamModal} style={{ marginLeft: "auto" }}><Icon name="close" size={14} /></IconButton>
              </div>
              <div className="stream-modal__body">
                <Badge tone="outline">{streamTarget.label}</Badge>
                <div className="stream-modal__section">
                  <h4>F1 TV session picker</h4>
                  <div className="f1tv-picker">
                    <select className="f1tv-picker__select" value={f1TvSeason} onChange={(e) => { markF1TvSelectionPending(); setF1TvSeason(e.target.value); loadF1TvLibrary(e.target.value); }}>
                      {selectableSeasons.map((season) => <option key={season} value={season}>{season}</option>)}
                    </select>
                    <select className="f1tv-picker__select" value={selectedF1TvRace ? raceLibraryId(selectedF1TvRace) : ""} onChange={(e) => { markF1TvSelectionPending(); setF1TvRaceId(e.target.value); }}>
                      {f1TvRaces.map((race) => <option key={raceLibraryId(race)} value={raceLibraryId(race)}>{race.rnd ? "R" + race.rnd + " - " : ""}{race.name}</option>)}
                    </select>
                  </div>
                  <div className="f1tv-picker__sessions">
                    {f1TvSessionOptions.map((kind) => (
                      <button className="f1tv-session" data-active={f1TvSessionKind === kind} key={kind} onClick={() => { markF1TvSelectionPending(); setF1TvSessionKind(kind); }}>{kind}</button>
                    ))}
                    {!f1TvSessionOptions.length && ["Practice 1", "Qualifying", "Race"].map((kind) => (
                      <button className="f1tv-session" data-active={f1TvSessionKind === kind} key={kind} onClick={() => { markF1TvSelectionPending(); setF1TvSessionKind(kind); }}>{kind}</button>
                    ))}
                  </div>
                  <input className="stream-modal__input" value={f1TvDetailUrl} placeholder="Paste F1 TV detail URL, e.g. https://f1tv.formula1.com/detail/1000010265/-"
                    onChange={(e) => { markF1TvSelectionPending(); setF1TvDetailUrl(e.target.value); }} />
                  <div className="f1tv-picker__meta">
                    <Icon name="calendar" size={13} />
                    <span>Apexline resolves the selected session or pasted detail URL in the background, then loads the clean video stream here.</span>
                  </div>
                  <div className="f1tv-picker__meta" data-ready={drmStatus ? String(Boolean(drmStatus.widevine)) : undefined}>
                    <Icon name="key" size={13} />
                    <span>{drmStatus ? (drmStatus.widevine ? `Protected playback ready${drmStatus.cdm?.version ? " - Widevine " + drmStatus.cdm.version : ""}` : `Protected playback needs Widevine${drmStatus.reason ? ": " + drmStatus.reason : ""}`) : "Checking protected playback..."}</span>
                  </div>
                  <div className="stream-modal__tools">
                    <Button variant="primary" onClick={() => resolveSelectedF1TvContent(streamTarget.key)} disabled={!f1TvDetailUrl.trim() && !canResolveSelectedF1TvSession} iconLeft={<Icon name="play" size={14} />}>Resolve clean stream</Button>
                    <Button variant="secondary" onClick={openSelectedF1TvSession} iconLeft={<Icon name="radio" size={14} />}>Open diagnostics</Button>
                    <Button variant="ghost" onClick={() => loadF1TvLibrary(f1TvSeason, { forceRefresh: true })} iconLeft={<Icon name="timer" size={14} />}>Reload library</Button>
                    <Button variant="ghost" onClick={refreshDrmStatus} iconLeft={<Icon name="key" size={14} />}>Check DRM</Button>
                  </div>
                </div>
                <input className="stream-modal__input" value={streamDraft} placeholder="Manual stream URL, e.g. https://.../master.m3u8 or .mpd"
                  onChange={(e) => setStreamDraft(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") saveStreamSource(); if (e.key === "Escape") closeStreamModal(); }} />
                <div className="stream-modal__tools">
                  <Button variant="secondary" onClick={openF1TvBrowser} iconLeft={<Icon name="play" size={14} />}>Diagnostics browser</Button>
                  <Button variant="ghost" onClick={loadCapturedStreams} iconLeft={<Icon name="timer" size={14} />}>Refresh streams</Button>
                </div>
                <div className="stream-modal__section">
                  <h4>Diagnostic F1 TV captures</h4>
                  {capturedStreams.length ? capturedStreams.slice(0, 8).map((stream) => (
                    <button className="stream-pick" key={stream.id || stream.manifestUrl || stream.url} onClick={() => setStreamDraft(stream.manifestUrl || stream.url)}>
                      <b>{stream.label || "F1 TV stream"}</b>
                      <span>{[stream.host, stream.capturedAt ? new Date(stream.capturedAt).toLocaleTimeString() : ""].filter(Boolean).join(" · ")}</span>
                    </button>
                  )) : <div className="stream-modal__hint">{streamStatus || "No diagnostic captures yet. Use this only if clean resolve fails."}</div>}
                </div>
                <div className="stream-modal__hint">Resolved F1 TV streams use your authenticated Apexline session and local Widevine support. MultiViewer login is separate. Apexline does not store F1 TV credentials here or extract DRM keys.</div>
              </div>
              <div className="stream-modal__actions">
                <Button variant="ghost" onClick={closeStreamModal}>Cancel</Button>
                <Button variant="secondary" onClick={() => setStreamDraft("")}>Clear</Button>
                <Button variant="primary" onClick={saveStreamSource}>Save stream</Button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  window.PW = window.PW || {};
  window.PW.LiveRacing = LiveRacing;
})();
