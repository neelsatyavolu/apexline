/* PitWall Live Racing — single unified window. window.PW.LiveRacing */
(function () {
  const NS = window.PitWallDesignSystem_698fe6;
  const { Icon, Badge, Button, IconButton, SegmentedControl, FlagStatus, TimingRow, TimingRowHeader,
    TyreBadge, DriverTag, GapDelta, Switch, Avatar } = NS;
  const D = window.PW_DATA;
  const LIVE_TIMING_POLL_INTERVAL_MS = 500;
  const REPLAY_TIMING_POLL_INTERVAL_MS = 250;
  const CLOCK_TICK_INTERVAL_MS = 250;
  const TIMING_ROW_MOTION_MS = 280;

  const STYLE_ID = "pw-live-styles";
  {
    let el = document.getElementById(STYLE_ID);
    if (!el) { el = document.createElement("style"); el.id = STYLE_ID; document.head.appendChild(el); }
    el.textContent = `
    .live { position: relative; display: flex; flex-direction: column; height: 100vh; background: var(--bg-app); color: var(--text-primary); font-family: var(--font-sans); overflow: hidden; }
    /* Window title bar */
    .live__bar { display: flex; align-items: center; gap: var(--space-7); height: 48px; padding: 0 var(--space-7); background: var(--bg-base); border-bottom: 1px solid var(--border-subtle); flex: none; }
    .live__traffic { display: flex; gap: 8px; margin-right: var(--space-5); }
    .live__traffic span { width: 12px; height: 12px; border-radius: 50%; }
    .live__brand { font-family: var(--font-display); font-weight: 800; font-size: 16px; letter-spacing: -0.01em; color: var(--text-strong); }
    .live__brand i { font-style: normal; color: var(--accent); }
    .live__race { display: flex; align-items: center; gap: var(--space-6); font-size: var(--text-sm); color: var(--text-secondary); }
    .live__lap { font-family: var(--font-mono); font-weight: 600; color: var(--text-primary); }
    .live__presets { display: flex; align-items: center; gap: var(--space-4); margin-left: var(--space-7); min-width: 0; }
    .preset-select-wrap { position: relative; display: inline-flex; align-items: center; min-width: 0; }
    .preset-select { appearance: none; -webkit-appearance: none; width: 178px; max-width: 28vw; height: 28px; padding: 0 34px 0 var(--space-5); border-radius: var(--radius-sm); background: var(--bg-sunken); border: 1px solid var(--border-default); color: var(--text-primary); font-family: var(--font-sans); font-size: var(--text-sm); font-weight: 600; cursor: pointer; white-space: nowrap; outline: 0; transition: var(--tr-control); }
    .preset-select:hover { background: var(--surface-hover); border-color: var(--border-strong); }
    .preset-select:focus { border-color: var(--accent-border); box-shadow: var(--glow-accent); }
    .preset-select option { color: var(--text-primary); background: var(--bg-base); }
    .preset-select__icon { position: absolute; right: 10px; color: var(--text-tertiary); pointer-events: none; }
    .live__barright { margin-left: auto; display: flex; align-items: center; gap: var(--space-5); }
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
    .live__timing { position: relative; display: flex; flex-direction: column; background: var(--bg-base); border-right: 1px solid var(--border-subtle); min-height: 0; min-width: 0; }
    .live__timinghd { display: grid; grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr); align-items: center; gap: var(--space-5); padding: var(--space-6) var(--space-7); border-bottom: 1px solid var(--border-subtle); }
    .live__timingtitle { display: flex; align-items: center; gap: var(--space-5); min-width: 0; }
    .live__timinghd h3 { font-size: var(--text-sm); font-weight: 600; text-transform: uppercase; letter-spacing: var(--tracking-caps); color: var(--text-tertiary); margin: 0; }
    .live__timingclock { justify-self: center; color: var(--accent); font-family: var(--font-mono); font-size: 18px; font-weight: 900; line-height: 1; white-space: nowrap; font-variant-numeric: tabular-nums; }
    .live__timingactions { display: flex; align-items: center; justify-content: flex-end; gap: var(--space-5); min-width: 0; }
    .live__timingscroll { flex: 1; overflow: auto; min-height: 0; }
    .live__statusbar { display: flex; align-items: center; gap: var(--space-5); padding: var(--space-5) var(--space-7); border-bottom: 1px solid var(--border-subtle); flex-wrap: wrap; }
    .live__weather { display: flex; gap: var(--space-7); padding: var(--space-6) var(--space-7); border-top: 1px solid var(--border-subtle); }
    .live__wx { display: flex; align-items: center; gap: var(--space-4); font-size: var(--text-sm); color: var(--text-secondary); }
    .live__wx b { font-family: var(--font-mono); color: var(--text-primary); font-weight: 600; }
    .timing-config { position: absolute; right: var(--space-6); top: 54px; z-index: 60; width: min(360px, calc(100vw - 28px)); max-height: min(520px, calc(100vh - 120px)); overflow: auto; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: var(--space-3); padding: var(--space-5); border-radius: var(--radius-md); border: 1px solid var(--border-default); background: var(--surface-overlay); box-shadow: var(--shadow-lg); }
    .timing-config__item { appearance: none; -webkit-appearance: none; display: flex; align-items: center; justify-content: flex-start; gap: var(--space-3); min-height: 28px; padding: 0 var(--space-4); border: 1px solid var(--border-subtle); border-radius: var(--radius-sm); background: var(--bg-sunken); color: var(--text-secondary); font-family: var(--font-sans); font-size: var(--text-xs); cursor: pointer; min-width: 0; }
    .timing-config__item[data-active="true"] { color: var(--text-primary); border-color: var(--accent-border); background: var(--accent-quiet); }
    .timing-tower { min-width: 640px; }
    .timing-tower__head, .timing-tower__row { display: grid; align-items: center; column-gap: var(--space-3); padding: 0 var(--space-2); }
    .timing-tower__head { position: sticky; top: 0; z-index: 4; height: 32px; background: var(--bg-base); border-bottom: 1px solid var(--border-default); color: var(--text-tertiary); font-size: 9px; font-weight: 800; text-transform: uppercase; letter-spacing: var(--tracking-caps); }
    .timing-tower__head > span, .timing-tower__row > span { min-width: 0; overflow: hidden; text-overflow: ellipsis; }
    .timing-tower__row { min-height: 40px; border-bottom: 1px solid var(--border-subtle); background: rgba(255,255,255,0.015); color: var(--text-primary); cursor: pointer; transform: translateZ(0); transition-property: background-color, border-color, box-shadow; transition-duration: var(--dur-fast); transition-timing-function: var(--ease-standard); }
    .timing-tower__row:hover { background: var(--surface-hover); }
    .timing-tower__row[data-selected="true"] { background: var(--accent-quiet); box-shadow: inset 3px 0 0 var(--accent); }
    .timing-tower__row[data-elimination="true"] { background: linear-gradient(90deg, rgba(255,59,59,0.14), rgba(255,59,59,0.035)); box-shadow: inset 3px 0 0 rgba(255,95,95,0.62); }
    .timing-tower__row[data-elimination="true"]:hover { background: linear-gradient(90deg, rgba(255,59,59,0.18), rgba(255,59,59,0.055)); }
    .timing-tower__row[data-elimination="true"] .timing-driver__pos { color: #ff9a9a; }
    .timing-tower__row[data-moving="true"] { position: relative; z-index: 3; will-change: transform; box-shadow: 0 10px 24px rgba(0,0,0,0.28), inset 3px 0 0 var(--accent); }
    .timing-driver { display: grid; grid-template-columns: 22px minmax(42px, auto); align-items: center; column-gap: 6px; min-width: 0; }
    .timing-driver__pos { width: auto; color: var(--text-tertiary); font-family: var(--font-mono); font-weight: 800; text-align: right; font-variant-numeric: tabular-nums; }
    .timing-driver__code { display: inline-grid; place-items: center; min-width: 42px; height: 24px; padding: 0 var(--space-2); border-radius: var(--radius-sm); background: var(--driver-color, var(--accent)); color: #061017; font-family: var(--font-display); font-size: var(--text-sm); font-weight: 900; letter-spacing: 0.02em; transition-property: background-color, color; transition-duration: var(--dur-fast); transition-timing-function: var(--ease-standard); }
    .timing-cell { font-family: var(--font-mono); font-size: 13px; font-weight: 800; white-space: nowrap; font-variant-numeric: tabular-nums; transition-property: color, background-color; transition-duration: var(--dur-fast); transition-timing-function: var(--ease-standard); }
    .timing-cell--pill { display: inline-flex; justify-content: center; min-width: 58px; padding: 4px 7px; border-radius: var(--radius-pill); background: rgba(78,186,87,0.92); color: #061017; }
    .timing-cell--gap { color: var(--text-primary); }
    .mini-sector { display: inline-flex; align-items: center; gap: 1.5px; width: 44px; min-width: 44px; max-width: 44px; overflow: hidden; }
    .mini-sector__seg { width: 3px; height: 15px; border-radius: var(--radius-pill); background: rgba(255,255,255,0.12); transition-property: background-color, opacity; transition-duration: var(--dur-fast); transition-timing-function: var(--ease-standard); }
    .mini-sector__seg[data-tone="yellow"] { background: #ffd83d; }
    .mini-sector__seg[data-tone="green"] { background: #4eba57; }
    .mini-sector__seg[data-tone="purple"] { background: #b640d8; }
    .tyre-dot { display: inline-grid; place-items: center; width: 28px; height: 28px; border-radius: 50%; border: 3px solid var(--tyre-ring, var(--border-default)); color: var(--text-primary); font-family: var(--font-display); font-weight: 900; font-size: var(--text-sm); background: #070a0f; text-transform: uppercase; transition-property: border-color, color; transition-duration: var(--dur-fast); transition-timing-function: var(--ease-standard); }

    /* Center column: grid + insights */
    .live__center { position: relative; display: flex; flex-direction: column; min-width: 0; min-height: 0; }
    .live__grid { position: relative; flex: 1; display: grid; gap: 6px; padding: 6px; min-height: 0; background: var(--bg-app); }
    .live__grid[data-layout="focus"] { grid-template-columns: repeat(3, minmax(0, 1fr)); grid-template-rows: minmax(150px, var(--focus-onboard-h, 220px)) minmax(260px, 1fr); grid-template-areas: "ob1 ob2 ob3" "world world world"; }
    .live__grid[data-layout="focus"] .pane__video { object-fit: contain; }
    .live__grid[data-layout="focus"] .pane--bc .pane__video { object-position: center bottom; }
    .live__grid[data-layout="battle"] { grid-template-columns: minmax(0, var(--battle-a, 50%)) minmax(0, var(--battle-b, 50%)); grid-template-rows: 1fr; }
    .live__grid[data-layout="quad"] { grid-template-columns: minmax(0, var(--quad-col, 50%)) minmax(0, 1fr); grid-template-rows: minmax(0, var(--quad-row, 50%)) minmax(0, 1fr); }
    .live__grid[data-layout="data"] { grid-template-columns: minmax(0, var(--data-col-a, 33%)) minmax(0, var(--data-col-b, 33%)) minmax(0, 1fr); grid-template-rows: minmax(0, var(--data-row, 50%)) minmax(0, 1fr); }
    .live__grid[data-expanded="true"] { grid-template-columns: 1fr; grid-template-rows: 1fr; }
    .live__grid[data-expanded="true"] .pane { display: none; }
    .live__grid[data-expanded="true"] .pane[data-expanded="true"] { display: flex; }

    .pane { position: relative; border-radius: var(--radius-md); overflow: hidden; background:
      linear-gradient(180deg, #10141b, #0a0d12); border: 1px solid var(--border-default); display: flex; flex-direction: column; min-height: 0; }
    .pane[data-visible="false"] { display: none !important; }
    .pane[data-focus="true"] { border-color: var(--accent-border); box-shadow: var(--glow-accent); }
    .pane__feed { position: absolute; inset: 0; background-image: var(--grad-carbon); opacity: 0.5; }
    .pane__scan { position: absolute; inset: 0; background: radial-gradient(120% 80% at 50% 0%, rgba(45,123,255,0.06), transparent 60%); }
    .pane__video { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; background: transparent; z-index: 1; opacity: 0; transform: scale(1.012); filter: saturate(0.86); transition-property: opacity, transform, filter; transition-duration: 260ms; transition-timing-function: cubic-bezier(0.2, 0, 0, 1); will-change: opacity, transform; }
    .pane__video[data-ready="true"] { opacity: 1; transform: scale(1); filter: none; }
    .pane__video[data-ready="false"] { pointer-events: none; }
    .pane--bc .pane__video { bottom: 124px; height: auto; }
    .pane__playerstatus { position: absolute; left: var(--space-6); bottom: var(--space-6); z-index: 6; max-width: min(560px, calc(100% - 32px)); padding: var(--space-4) var(--space-5); border-radius: var(--radius-sm); border: 1px solid var(--border-default); background: rgba(8,11,17,0.92); color: var(--text-secondary); font-size: var(--text-xs); line-height: 1.35; backdrop-filter: blur(8px); pointer-events: none; }
    .pane--bc .pane__playerstatus { bottom: 124px; max-width: min(760px, calc(100% - 32px)); }
    .pane__replaybar { position: absolute; left: var(--space-6); right: var(--space-6); bottom: 58px; z-index: 4; display: grid; grid-template-columns: 40px minmax(0, 1fr) auto; align-items: center; gap: var(--space-6); min-height: 48px; padding: 6px 10px; border-radius: var(--radius-md); border: 1px solid color-mix(in srgb, var(--accent-border) 58%, var(--border-default)); background: linear-gradient(180deg, rgba(20,26,36,0.88), rgba(6,9,14,0.86)); box-shadow: 0 18px 42px rgba(0,0,0,0.34), inset 0 1px 0 rgba(255,255,255,0.08); backdrop-filter: blur(14px); }
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
    .pane__tag { display: flex; align-items: center; gap: var(--space-4); background: var(--scrim); backdrop-filter: blur(6px); border: 1px solid var(--border-default); border-radius: var(--radius-pill); padding: 3px 10px 3px 4px; }
    .pane__feedlabel { font-size: var(--text-2xs); color: var(--text-tertiary); background: var(--scrim); padding: 2px 8px; border-radius: var(--radius-pill); margin-left: auto; backdrop-filter: blur(6px); }
    .pane__driverselect { position: relative; z-index: 3; max-width: min(150px, 42%); height: 26px; border-radius: var(--radius-pill); border: 1px solid var(--border-default); background: rgba(8,11,17,0.82); color: var(--text-primary); padding: 0 24px 0 9px; font-family: var(--font-display); font-size: 12px; font-weight: 700; outline: 0; cursor: pointer; }
    .pane:not(.pane--bc) .pane__driverselect { opacity: 0; pointer-events: none; transition: opacity var(--dur-fast) var(--ease-standard); }
    .pane:not(.pane--bc) .pane__feedlabel { opacity: 0; pointer-events: none; transition: opacity var(--dur-fast) var(--ease-standard); }
    .pane:not(.pane--bc):hover .pane__driverselect, .pane:not(.pane--bc):focus-within .pane__driverselect { opacity: 1; pointer-events: auto; }
    .pane:not(.pane--bc):hover .pane__feedlabel, .pane:not(.pane--bc):focus-within .pane__feedlabel { opacity: 1; pointer-events: auto; }
    .pane__driverselect:hover { border-color: var(--accent-border); background: var(--surface-hover); }
    .pane__mid { flex: 1; display: grid; place-items: center; position: relative; z-index: 1; transition-property: opacity, transform, filter; transition-duration: 220ms; transition-timing-function: cubic-bezier(0.2, 0, 0, 1); }
    .pane[data-streaming="true"] .pane__mid { position: absolute; inset: 0; padding: var(--space-8); z-index: 2; overflow: hidden; background: radial-gradient(84% 72% at 50% 38%, rgba(45,123,255,0.16), rgba(10,14,21,0.68) 54%, rgba(3,5,8,0.94)); pointer-events: none; }
    .pane[data-stream-ready="true"][data-streaming="true"] .pane__mid { opacity: 0; transform: scale(0.985); filter: blur(4px); }
    .pane__streamveil { position: absolute; inset: 0; background: linear-gradient(135deg, rgba(255,255,255,0.035), transparent 32%, rgba(45,123,255,0.10) 62%, transparent); opacity: 0.9; }
    .pane__streamveil::after { content: ""; position: absolute; top: -12%; bottom: -12%; left: -38%; width: 34%; transform: skewX(-18deg); background: linear-gradient(90deg, transparent, rgba(255,255,255,0.20), transparent); animation: pw-stream-warm 1150ms cubic-bezier(0.2, 0, 0, 1) infinite; }
    .pane__switching { position: absolute; left: var(--space-6); bottom: var(--space-6); display: flex; align-items: baseline; gap: var(--space-4); padding: 5px 9px; border-radius: var(--radius-pill); border: 1px solid rgba(255,255,255,0.10); background: rgba(8,11,17,0.72); color: var(--text-secondary); font-size: var(--text-2xs); text-transform: uppercase; letter-spacing: var(--tracking-caps); backdrop-filter: blur(10px); }
    .pane__switching b { font-family: var(--font-display); color: var(--text-primary); letter-spacing: 0.04em; }
    @keyframes pw-stream-warm { from { transform: translateX(0) skewX(-18deg); opacity: 0; } 20% { opacity: 0.58; } to { transform: translateX(390%) skewX(-18deg); opacity: 0; } }
    .pane__car { font-family: var(--font-display); font-weight: 800; font-size: 62px; color: rgba(255,255,255,0.05); letter-spacing: -0.02em; }
    .pane:not(.pane--bc) .pane__telemetry { margin-top: auto; }
    .pane__telemetry { position: relative; z-index: 2; display: flex; align-items: center; flex-wrap: wrap; gap: var(--space-5) var(--space-6); padding: var(--space-5) var(--space-6); background: linear-gradient(0deg, rgba(6,8,12,0.92), transparent); }
    .tele { display: flex; flex-direction: column; gap: 2px; }
    .tele--lap { min-width: 58px; }
    .tele__v { font-family: var(--font-mono); font-weight: 600; font-size: var(--text-md); color: var(--text-primary); font-variant-numeric: tabular-nums; transition-property: color; transition-duration: var(--dur-fast); transition-timing-function: var(--ease-standard); }
    .tele__l { font-size: 9px; color: var(--text-tertiary); text-transform: uppercase; letter-spacing: 0.06em; }
    .pane__bars { position: relative; z-index: 2; display: flex; gap: 3px; padding: 0 var(--space-6) var(--space-5); }
    .pane:not(.pane--bc) .pane__bars { padding-bottom: 4px; }
    .pane__bar { height: 4px; flex: 1; border-radius: 2px; background: var(--ink-700); overflow: hidden; }
    .pane__bar i { display: block; height: 100%; border-radius: 2px; transition-property: width, background-color; transition-duration: 160ms; transition-timing-function: linear; }
    .pane__controls { position: absolute; top: var(--space-5); right: var(--space-6); z-index: 3; display: flex; gap: 4px; opacity: 0; transition: opacity var(--dur-fast) var(--ease-standard); }
    .pane:hover .pane__controls { opacity: 1; }
    .pane__ctl { display: inline-grid; place-items: center; width: 26px; height: 26px; border-radius: var(--radius-xs); background: var(--scrim); backdrop-filter: blur(6px); color: var(--text-secondary); cursor: pointer; border: 1px solid var(--border-default); }
    .pane__ctl:hover { color: var(--text-primary); background: var(--surface-hover); }
    .pane__ctl[data-active="true"] { color: #fff; background: var(--accent); border-color: transparent; }
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
    .pane__ticker { position: relative; z-index: 2; display: flex; gap: 0; background: linear-gradient(0deg, rgba(6,9,14,0.96), rgba(6,9,14,0.82)); border-top: 1px solid var(--border-default); }
    .tick { flex: 1; display: flex; align-items: stretch; gap: var(--space-5); padding: var(--space-5) var(--space-6); border-right: 1px solid var(--border-subtle); min-width: 0; }
    .tick:last-child { border-right: 0; }
    .tick__bar { width: 3px; border-radius: var(--radius-pill); flex: none; }
    .tick__main { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
    .tick__row { display: flex; align-items: baseline; gap: var(--space-3); }
    .tick__pos { font-family: var(--font-mono); font-weight: 700; font-size: 10px; color: var(--text-tertiary); flex: none; }
    .tick__code { font-family: var(--font-display); font-weight: 700; font-size: var(--text-sm); color: var(--text-primary); }
    .tick__gap { font-family: var(--font-mono); font-size: 10px; color: var(--text-tertiary); font-variant-numeric: tabular-nums; }

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

    .ai-popup { position: absolute; inset: 0; z-index: 90; display: grid; place-items: center; background: rgba(3,5,8,0.58); backdrop-filter: blur(8px); }
    .ai-popup__panel { position: relative; }
    .ai-popup__close { position: absolute; top: 8px; right: 8px; z-index: 4; }

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
    .session-library__head { display: flex; align-items: center; gap: var(--space-7); padding: var(--space-7) var(--space-8); border-bottom: 1px solid var(--border-subtle); }
    .session-library__glyph { display: inline-grid; place-items: center; width: 46px; height: 46px; border-radius: var(--radius-sm); background: color-mix(in srgb, var(--accent) 18%, var(--bg-sunken)); color: var(--accent); flex: none; }
    .session-library__title { margin: 0; font-family: var(--font-display); font-size: 24px; line-height: 1; font-weight: 900; color: var(--text-strong); }
    .session-library__sub { margin-top: 8px; color: var(--text-tertiary); font-size: var(--text-md); }
    .session-library__close { margin-left: auto; }
    .session-library__body { display: grid; grid-template-columns: 320px minmax(0, 1fr); min-height: 0; }
    .session-library__rail { display: flex; flex-direction: column; gap: var(--space-5); padding: var(--space-8) var(--space-6); border-right: 1px solid var(--border-subtle); background: rgba(3,5,9,0.54); overflow-y: auto; }
    .session-library__eyebrow { color: var(--text-tertiary); font-family: var(--font-mono); font-size: var(--text-xs); font-weight: 800; text-transform: uppercase; letter-spacing: var(--tracking-caps); }
    .session-library__race { appearance: none; -webkit-appearance: none; display: grid; gap: var(--space-3); padding: var(--space-6); border-radius: var(--radius-sm); border: 1px solid transparent; background: transparent; color: var(--text-secondary); text-align: left; cursor: pointer; }
    .session-library__race:hover { background: var(--surface-hover); color: var(--text-primary); }
    .session-library__race[data-active="true"] { background: color-mix(in srgb, var(--accent) 16%, var(--bg-sunken)); border-color: var(--accent-border); color: var(--text-primary); box-shadow: inset 3px 0 0 var(--accent); }
    .session-library__race-top { display: flex; align-items: center; gap: var(--space-5); color: var(--text-tertiary); font-family: var(--font-mono); font-size: var(--text-sm); }
    .session-library__race-name { color: var(--text-primary); font-family: var(--font-display); font-size: var(--text-lg); font-weight: 900; line-height: 1.12; }
    .session-library__race-meta { display: flex; align-items: center; gap: var(--space-4); min-width: 0; color: var(--text-tertiary); font-size: var(--text-sm); }
    .session-library__content { display: flex; flex-direction: column; min-width: 0; min-height: 0; }
    .session-library__summary { display: flex; align-items: center; gap: var(--space-5); padding: var(--space-8); border-bottom: 1px solid var(--border-subtle); }
    .session-library__summary h3 { margin: 0; color: var(--text-strong); font-family: var(--font-display); font-size: 26px; line-height: 1; font-weight: 900; }
    .session-library__summary p { margin: var(--space-4) 0 0; color: var(--text-tertiary); font-size: var(--text-md); }
    .session-library__count { margin-left: auto; color: var(--text-tertiary); font-family: var(--font-mono); font-size: var(--text-sm); white-space: nowrap; }
    .session-library__rows { display: flex; flex-direction: column; gap: var(--space-5); padding: var(--space-7); overflow-y: auto; }
    .session-library__row { display: grid; grid-template-columns: 58px minmax(0, 1fr) auto; align-items: center; gap: var(--space-7); min-height: 78px; padding: var(--space-6); border-radius: var(--radius-md); border: 1px solid var(--border-default); background: var(--surface-card); color: var(--text-primary); }
    .session-library__row[data-active="true"] { border-color: var(--accent-border); background: color-mix(in srgb, var(--accent) 14%, var(--surface-card)); }
    .session-library__code { display: inline-grid; place-items: center; width: 48px; height: 48px; border-radius: var(--radius-sm); background: var(--bg-sunken); color: var(--accent); font-family: var(--font-display); font-weight: 900; font-size: var(--text-sm); }
    .session-library__kind { font-family: var(--font-display); font-weight: 900; font-size: var(--text-lg); color: var(--text-primary); }
    .session-library__when { display: flex; align-items: center; gap: var(--space-4); margin-top: 7px; color: var(--text-tertiary); font-family: var(--font-mono); font-size: var(--text-sm); }
    .session-library__empty { margin: var(--space-8); color: var(--text-tertiary); font-size: var(--text-sm); }
    @media (max-width: 860px) {
      .session-library { padding: 12px; }
      .session-library__panel { width: calc(100vw - 24px); height: calc(100vh - 24px); grid-template-rows: auto minmax(0, 1fr); }
      .session-library__head { padding: var(--space-6); }
      .session-library__body { grid-template-columns: 1fr; }
      .session-library__rail { max-height: 220px; border-right: 0; border-bottom: 1px solid var(--border-subtle); }
      .session-library__row { grid-template-columns: 48px minmax(0, 1fr); }
      .session-library__row > button { grid-column: 1 / -1; justify-self: stretch; }
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
    "Intelligent": "focus", "Pit Wall Classic": "quad", "Battle Mode": "battle",
    "Data Overload": "data", "Minimal Clean": "focus",
  };
  const SYNC_STORAGE_KEY = "pw-sync-settings";
  const TIMING_OFFSET_STORAGE_KEY = "pw-replay-timing-offset-v2";
  const DEFAULT_REPLAY_TIMING_OFFSET = -8;
  const SYNC_EPSILON = 0.075;

  function qualifyingPhaseFromSession(options) {
    options = typeof options === "string" ? { qualifyingPhase: options } : options || {};
    const clock = options.sessionClock || {};
    const sessionKind = String(options.sessionKind || "");
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
      const match = text.match(/\b(?:SQ|Q)([1-3])\b/) || text.match(/\bQUALIFYING\s*([1-3])\b/);
      if (match) return `Q${match[1]}`;
    }
    if (!/qualifying|shootout/i.test(sessionKind)) return "";
    const rowCount = Number(options.rowCount);
    if (Number.isFinite(rowCount) && rowCount > 0) {
      if (rowCount > 16) return "Q1";
      if (rowCount > 10) return "Q2";
      return "Q3";
    }
    return "Q1";
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
    const rowCount = Number(context.rowCount);
    const pos = Number(row?.pos);
    if (!Number.isFinite(pos)) return false;
    if (phase === "Q1") return pos >= qualifyingQ1EliminationStart(rowCount);
    if (phase === "Q2") return pos >= 11 && pos <= qualifyingQ2EliminationEnd(rowCount);
    return false;
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
      candidates.sort((a, b) => a.priority - b.priority || a.gap - b.gap);
      const best = candidates[0];
      const selectedBattle = best && (!activePrevious || best.priority < activePrevious.priority) ? best : activePrevious || best;
      if (selectedBattle) return fill(selectedBattle.codes);
    }

    return base.slice(0, count);
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
        kind: "battle",
        title: `${leader.code} vs ${chaser.code}`,
        body: `${leader.code} and ${chaser.code} are separated by ${gapLabel}; load the pair to watch the pressure window.`,
        conf: Math.max(0.52, Math.min(0.94, 1 - (seconds / 3))),
        a: leader.code,
        b: chaser.code,
        gap: gapLabel,
      });
    }
    return pairs.slice(0, 4);
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
      source: sourceLabel || baseContext.source || "PitWall active session timing",
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
    const { mode = "live", timingRows = [], baseData = {}, sourceLabel = "", weather = {}, sessionClock = null, replay = null } = options;
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
      news: (baseData.news || []).slice(0, 8),
      source: sourceLabel,
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
  function formatSectorTime(value) {
    const number = telemetryNumber(value);
    if (number == null) return "—";
    return number >= 60 ? `${Math.floor(number / 60)}:${(number % 60).toFixed(3).padStart(6, "0")}` : number.toFixed(3);
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
  function telemetryForCode(rows, code, sessionKind = "") {
    const row = (rows || []).find((item) => item.code === code) || {};
    return {
      speed: row.telemetry?.speed,
      gear: row.telemetry?.gear,
      throttle: row.telemetry?.throttle,
      brake: row.telemetry?.brake,
      gap: formatTelemetryGap(row, sessionKind),
      last: row.last || "—",
      best: row.best || "—",
    };
  }
  function bar(v, color) {
    const pct = telemetryPct(v) || 0;
    return <i style={{ width: pct + "%", background: color }} />;
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
      if (/\bf1\s*(?:tv|live)\b|f1tv|live channel/.test(text)) score += 30;
      if (feed.kind === "world" || feed.feedId === "WORLD") score += 10;
      if (/international|sky|croft|crofty/.test(text)) score -= 25;
      return { feed, index, score };
    });
    scored.sort((a, b) => b.score - a.score || a.index - b.index);
    return scored[0]?.feed || feeds[0] || null;
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
  function normalizeLivePanelSizes(saved = {}) {
    return {
      timingWidth: clampPanelSize(saved.timingWidth || 340, 260, 560),
      insightsHeight: clampPanelSize(saved.insightsHeight || 280, 180, 460),
      focusOnboardHeight: clampPanelSize(saved.focusOnboardHeight || 220, 150, 380),
      battleSplit: clampPanelPct(saved.battleSplit || 50, 28, 72),
      quadCol: clampPanelPct(saved.quadCol || 50, 28, 72),
      quadRow: clampPanelPct(saved.quadRow || 50, 28, 72),
      dataColA: clampPanelPct(saved.dataColA || 33, 20, 60),
      dataColB: clampPanelPct(saved.dataColB || 33, 18, 60),
      dataRow: clampPanelPct(saved.dataRow || 50, 28, 72),
    };
  }
  function readLivePanelSizes() {
    try {
      const saved = JSON.parse(localStorage.getItem(PANEL_SIZE_STORAGE_KEY) || "{}");
      return normalizeLivePanelSizes(saved);
    } catch {
      return { timingWidth: 340, insightsHeight: 280, focusOnboardHeight: 220, battleSplit: 50, quadCol: 50, quadRow: 50, dataColA: 33, dataColB: 33, dataRow: 50 };
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
  function timingGridStyle(columns) {
    const widths = columns.map((id) => TIMING_COLUMNS.find((column) => column.id === id)?.width || "72px");
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
  function MiniSectorBar({ segments = [] }) {
    const tones = segments.length ? segments : ["off", "off", "off", "off", "off", "off"];
    return <span className="mini-sector">{tones.slice(0, 10).map((tone, index) => <i className="mini-sector__seg" data-tone={tone || "off"} key={index} />)}</span>;
  }
  function TimingTowerHeader({ columns }) {
    return (
      <div className="timing-tower__head" style={timingGridStyle(columns)}>
        {columns.map((id) => <span key={id}>{TIMING_COLUMNS.find((column) => column.id === id)?.label || id}</span>)}
      </div>
    );
  }
  function TimingTowerRow({ row, driver, columns, selected, moving, elimination, registerRow, onClick }) {
    const setRowRef = React.useCallback((node) => registerRow?.(row.code, node), [registerRow, row.code]);
    const cells = {
      driver: <span className="timing-driver"><span className="timing-driver__pos">{row.pos}</span><span className="timing-driver__code" style={{ "--driver-color": driver.color || "var(--accent)" }}>{row.code}</span></span>,
      name: <span className="timing-cell">{driver.name || row.code || "—"}</span>,
      team: <span className="timing-cell" style={{ color: driver.color || "var(--text-secondary)" }}>{driver.abbr || driver.team || "—"}</span>,
      last: <span className={"timing-cell" + (row.last && row.last === row.best ? " timing-cell--pill" : "")}>{row.last || "—"}</span>,
      best: <span className="timing-cell">{row.best || "—"}</span>,
      gap: <span className="timing-cell timing-cell--gap">{row.gap || "—"}</span>,
      interval: <span className="timing-cell">{row.interval || "—"}</span>,
      s1: <MiniSectorBar segments={row.sectors?.s1} />,
      s2: <MiniSectorBar segments={row.sectors?.s2} />,
      s3: <MiniSectorBar segments={row.sectors?.s3} />,
      s1Time: <span className="timing-cell">{formatSectorTime(row.sectorTimes?.s1)}</span>,
      s2Time: <span className="timing-cell">{formatSectorTime(row.sectorTimes?.s2)}</span>,
      s3Time: <span className="timing-cell">{formatSectorTime(row.sectorTimes?.s3)}</span>,
      tyre: <span className="tyre-dot" style={{ "--tyre-ring": tyreRing(row.comp) }}>{tyreLetter(row.comp)}</span>,
      compound: <span className="timing-cell">{row.comp || "—"}</span>,
      age: <span className="timing-cell">{row.age || "—"}</span>,
      pits: <span className="timing-cell">{row.pits || "0"}</span>,
      stints: <span className="timing-cell">{Array.isArray(row.stints) && row.stints.length ? row.stints.length : "—"}</span>,
      speed: <span className="timing-cell">{formatSpeed(row.telemetry?.speed)}</span>,
      gear: <span className="timing-cell">{formatGear(row.telemetry?.gear)}</span>,
      throttle: <span className="timing-cell">{formatPct(row.telemetry?.throttle)}</span>,
      brake: <span className="timing-cell">{formatPct(row.telemetry?.brake)}</span>,
    };
    return <button ref={setRowRef} type="button" className="timing-tower__row" data-selected={selected} data-elimination={elimination ? "true" : "false"} data-moving={moving ? "true" : "false"} style={timingGridStyle(columns)} onClick={onClick}>{columns.map((id) => <span key={id}>{cells[id]}</span>)}</button>;
  }
	  function aiRequestOptions(payload) {
	    const selected = localStorage.getItem("pw-ai-model") || "";
	    if (!selected || selected === "local") return payload;
	    const [provider, ...modelParts] = selected.split(":");
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
    return Math.max(8, Math.min(90, Math.round(Number(value || 0) * 10) / 10));
  }
  function defaultSyncTarget(key) {
    return key === "WORLD" ? 36 : 40;
  }
  function readSyncSettings() {
    try {
      const parsed = JSON.parse(localStorage.getItem(SYNC_STORAGE_KEY) || "{}");
      return { debug: Boolean(parsed.debug), targets: parsed.targets && typeof parsed.targets === "object" ? parsed.targets : {} };
    } catch {
      return { debug: false, targets: {} };
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
  function sessionShortCode(kind) {
    const text = String(kind || "").toLowerCase();
    if (text.includes("practice 1")) return "FP1";
    if (text.includes("practice 2")) return "FP2";
    if (text.includes("practice 3")) return "FP3";
    if (text.includes("sprint qualifying")) return "SQ";
    if (text.includes("shootout")) return "SQ";
    if (text.includes("sprint")) return "SPR";
    if (text.includes("qualifying")) return "QUAL";
    if (text.includes("race")) return "RACE";
    return String(kind || "SES").slice(0, 4).toUpperCase();
  }
  function sessionScheduleText(session) {
    return [session?.day, session?.time].filter(Boolean).join(" ") || "Time TBA";
  }
  function racePlace(race) {
    const loc = String(race?.loc || "").split(",")[0].trim();
    return loc || race?.circuit || "";
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
    window.pitwall?.debug?.log?.(area, safe).catch?.(() => {});
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
  function playerErrorMessage(error, fallback = "PitWall could not load this F1 TV stream.") {
    const detail = error?.detail || error;
    if (detail?.code) {
      const dataItems = Array.isArray(detail.data) ? detail.data.map((item) => String(item || "")) : [];
      const licenseHint = dataItems.find((item) => /F1 TV license rejected|ACN_|KeyOS|Licence Acquisition/i.test(item));
      if (licenseHint) {
        const cause = /ACN_4002|371000005/i.test(licenseHint)
          ? " PitWall reached the stream, but F1 TV's production Widevine server rejected this Electron build/license request. A production VMP-signed build is required for clean playback."
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

  function PitWallStreamPlayer({ source, muted, onAudioFocus, onReady, onPlaybackState, sync, replaySync }) {
    const videoRef = React.useRef(null);
    const descriptor = streamDescriptor(source);
    const [status, setStatus] = React.useState("");
    const [ready, setReady] = React.useState(false);
    const manifestUrl = descriptor?.manifestUrl || "";
    const headerSignature = JSON.stringify(descriptor?.headers || {});
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
        video.muted = muted;
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
            streaming: { lowLatencyMode: descriptor.playbackMode !== "replay" },
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
        } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
          video.src = descriptor.manifestUrl;
        } else if (window.Hls && window.Hls.isSupported()) {
          hls = new window.Hls({
            lowLatencyMode: descriptor.playbackMode !== "replay",
            backBufferLength: Math.max(30, targetLatency + 15),
            liveSyncDuration: targetLatency,
            liveMaxLatencyDuration: Math.max(targetLatency + 15, targetLatency * 1.5),
            maxLiveSyncPlaybackRate: 1.2,
            xhrSetup: (xhr) => {
              xhr.withCredentials = true;
              Object.entries(headers).forEach(([key, value]) => xhr.setRequestHeader(key, value));
            },
          });
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
          if (replaySync?.playing !== false) video.play().catch(() => {});
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
    }, [manifestUrl, descriptor?.licenseUrl, descriptor?.drm?.licenseUrl, headerSignature, sync?.targetLatency]);
    React.useEffect(() => {
      if (videoRef.current) videoRef.current.muted = muted;
    }, [muted]);
    return (
      <>
        <video ref={videoRef} className="pane__video" data-ready={String(ready)} playsInline autoPlay muted={muted}
          onClick={onAudioFocus}
          onVolumeChange={(e) => { if (!e.currentTarget.muted && muted) onAudioFocus?.(); }} />
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
    if (!/qualifying|shootout/.test(sessionKind)) return clockLabel;
    const partText = String(clock?.qualifyingPart || "").toUpperCase();
    const partMatch = partText.match(/\bQ([1-3])\b/);
    const part = partMatch ? partMatch[0] : "Q1";
    return `${part} ${clockLabel}`;
  }

  function replayProgressPct(replaySync) {
    const duration = Number(replaySync?.duration || 0);
    const time = Number(replaySync?.masterTime || 0);
    if (!Number.isFinite(duration) || duration <= 0 || !Number.isFinite(time)) return 0;
    return Math.max(0, Math.min(100, (time / duration) * 100));
  }

  function BroadcastPane({ focus, streamUrl, audioActive, onAudioFocus, onConfigureStream, expanded, onExpand, visible = true, style, zone,
    hasCurrentLiveSession, replayControls, sessionLibrary, onLoadPastSession, onConnectF1Tv,
    replaySync, onReplayToggle, onReplaySeek, onSyncAll, onPlayerReady, streamStatus, resolving,
    syncKey, syncDebug, syncTarget, syncMetrics, onSyncMetrics, onSyncAdjust, onSyncReset, timingRows, sessionKind }) {
    const descriptor = streamDescriptor(streamUrl);
    const top = (timingRows?.length ? timingRows : D.timing).slice(0, 5);
    return (
      <div className="pane pane--bc" data-focus={focus} data-expanded={expanded} data-visible={String(visible)} data-zone={zone} style={style}>
        <div className="pane__feed" />
        <div className="pane__bcwash" />
        {descriptor && <PitWallStreamPlayer source={descriptor} muted={!audioActive} onAudioFocus={onAudioFocus} replaySync={replaySync}
          onReady={(video) => onPlayerReady?.(syncKey, video)} sync={{ targetLatency: syncTarget, onMetrics: (metrics) => onSyncMetrics?.(syncKey, metrics) }} />}
        <div className="pane__controls">
          <span className="pane__ctl" data-active={audioActive} onClick={onAudioFocus}><Icon name="volume" size={14} /></span>
          <span className="pane__ctl" onClick={onConfigureStream}><Icon name="settings" size={14} /></span>
          <span className="pane__ctl" data-active={expanded} onClick={onExpand}><Icon name="maximize" size={14} /></span>
        </div>
        <SyncOverlay show={syncDebug} targetLatency={syncTarget} metrics={syncMetrics} protectedPlayer={Boolean(descriptor?.drm || descriptor?.licenseUrl)}
          onAdjust={(delta) => onSyncAdjust?.(syncKey, delta)} onReset={() => onSyncReset?.(syncKey)} />
        {descriptor && replaySync?.mode === "replay" && (
          <div className="pane__replaybar">
            <button className="pane__replayplay" type="button" onClick={onReplayToggle} data-playing={String(Boolean(replaySync.playing))}
              aria-label={replaySync.playing ? "Pause replay" : "Play replay"} title={replaySync.playing ? "Pause" : "Play"}>
              <Icon name={replaySync.playing ? "pause" : "play"} size={15} />
            </button>
            <div className="pane__replaytrack">
              <span className="pane__replayfill" style={{ width: `${replayProgressPct(replaySync)}%` }} />
              <input aria-label="Replay position" type="range" min="0" max={Math.max(1, Math.round(replaySync.duration || 1))} value={Math.round(replaySync.masterTime || 0)}
                onChange={(e) => onReplaySeek?.(Number(e.target.value))} />
            </div>
            <span className="pane__replaytime">{formatReplayTime(replaySync.masterTime)} / {formatReplayTime(replaySync.duration)}</span>
          </div>
        )}
        <div className="pane__top">
          <span className="pane__tag pane__tag--bc" data-live={String(Boolean(hasCurrentLiveSession))}>
            <span className="pane__bclive" data-live={String(Boolean(hasCurrentLiveSession))} />
            <span style={{ fontWeight: 700, fontSize: 12, fontFamily: "var(--font-display)", letterSpacing: "0.04em" }}>F1 LIVE</span>
          </span>
          <span className="pane__bcbug">
            <span className="pane__bcbug-flag" />
            <span className="pane__bcbug-lap">{D.race?.lap ? "LAP " + D.race.lap : hasCurrentLiveSession ? "LIVE" : "REPLAY"}<i>{D.race?.laps ? "/" + D.race.laps : ""}</i></span>
          </span>
          <span className="pane__feedlabel pane__feedlabel--bc"><Icon name="radio" size={12} /> F1 TV</span>
        </div>
        <div className="pane__mid">
          {streamUrl ? null : sessionLibrary || (
            <div className="replay-empty">
              <span className="replay-empty__eyebrow"><Icon name="timer" size={13} /> {hasCurrentLiveSession ? "F1 TV feed not loaded" : "No current live session"}</span>
              <div className="replay-empty__title">{hasCurrentLiveSession ? "Choose the live F1 TV feed" : "Load a past session"}</div>
              <div className="replay-empty__body">{hasCurrentLiveSession ? "Load the current session and PitWall will resolve the clean F1 TV player directly into this pane." : "Pick any race, qualifying, or practice replay and PitWall will load it into the main F1 TV pane. MultiViewer login is separate from PitWall, so connect F1 TV here once if prompted."}</div>
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
        {/* broadcast lower-third timing ticker */}
        <div className="pane__ticker">
          {top.map((t) => {
            const d = D.byCode[t.code] || {};
            return (
              <span className="tick" key={t.code}>
                <span className="tick__bar" style={{ background: d.color || "var(--accent)" }} />
                <span className="tick__main">
                  <span className="tick__row"><span className="tick__pos">P{t.pos}</span><span className="tick__code">{t.code}</span></span>
                  <span className="tick__gap">{formatTelemetryGap(t, sessionKind)}</span>
                </span>
              </span>
            );
          })}
        </div>
      </div>
    );
  }

  function OnboardPane({ feed, code, focus, telemetry, streamUrl, audioActive, onAudioFocus, onConfigureStream, expanded, onExpand,
    visible = true, style, zone, driverOptions = [], onDriverChange,
    replaySync, onPlayerReady, syncKey, syncDebug, syncTarget, syncMetrics, onSyncMetrics, onSyncAdjust, onSyncReset,
    timingRows = [], sessionKind = "" }) {
    const [telemetryOn, setTelemetryOn] = React.useState(Boolean(telemetry));
    const [streamReady, setStreamReady] = React.useState(false);
    const descriptor = streamDescriptor(streamUrl);
    const manifestUrl = descriptor?.manifestUrl || "";
    React.useEffect(() => setTelemetryOn(Boolean(telemetry)), [telemetry, code]);
    React.useEffect(() => setStreamReady(false), [code, manifestUrl]);
    const d = D.byCode[code] || {};
    const telemetryData = telemetryForCode(timingRows, code, sessionKind);
    const streaming = Boolean(descriptor);
    return (
      <div className="pane" data-focus={focus} data-expanded={expanded} data-visible={String(visible)} data-zone={zone}
        data-streaming={String(streaming)} data-stream-ready={String(!streaming || streamReady)} style={style}>
        <div className="pane__feed" />
        <div className="pane__scan" />
        {descriptor && <PitWallStreamPlayer source={descriptor} muted={!audioActive} onAudioFocus={onAudioFocus} replaySync={replaySync}
          onReady={(video) => onPlayerReady?.(syncKey, video)} onPlaybackState={setStreamReady}
          sync={{ targetLatency: syncTarget, onMetrics: (metrics) => onSyncMetrics?.(syncKey, metrics) }} />}
        <div className="pane__controls">
          <span className="pane__ctl" data-active={telemetryOn} onClick={() => setTelemetryOn(!telemetryOn)}><Icon name="gauge" size={14} /></span>
          <span className="pane__ctl" data-active={audioActive} onClick={onAudioFocus}><Icon name="volume" size={14} /></span>
          <span className="pane__ctl" onClick={onConfigureStream}><Icon name="settings" size={14} /></span>
          <span className="pane__ctl" data-active={expanded} onClick={onExpand}><Icon name="maximize" size={14} /></span>
        </div>
        <SyncOverlay show={syncDebug} targetLatency={syncTarget} metrics={syncMetrics} protectedPlayer={Boolean(descriptor?.drm || descriptor?.licenseUrl)}
          onAdjust={(delta) => onSyncAdjust?.(syncKey, delta)} onReset={() => onSyncReset?.(syncKey)} />
        <div className="pane__top">
          <span className="pane__tag">
            <Avatar initials={code || "DR"} number={d.num} ring={d.color || "var(--accent)"} src={d.image} size="sm" />
            <span style={{ fontWeight: 700, fontSize: 13, fontFamily: "var(--font-display)" }}>{code}</span>
          </span>
          <select className="pane__driverselect" value={code || ""} aria-label="Switch onboard driver"
            onChange={(event) => onDriverChange?.(event.target.value)}>
            {driverOptions.map((driver) => <option key={driver.code} value={driver.code}>{driver.code} · {driver.name}</option>)}
          </select>
          <span className="pane__feedlabel">{feed}</span>
        </div>
        <div className="pane__mid" data-streaming={String(streaming)} data-ready={String(!streaming || streamReady)}>
          {streaming && <span className="pane__streamveil" />}
          {d.image ? <img className="pane__driverimg" src={d.image} alt="" /> : <span className="pane__streamready"><Icon name="play" size={24} /><b>{code || "DRIVER"}</b><span>Onboard stream slot ready</span></span>}
          {streaming && <span className="pane__switching"><b>{code || "DRIVER"}</b><span>Warming onboard</span></span>}
        </div>
        {telemetryOn && (
          <>
            <div className="pane__telemetry">
              <span className="tele"><span className="tele__v">{formatSpeed(telemetryData.speed)}</span><span className="tele__l">km/h</span></span>
              <span className="tele"><span className="tele__v">{formatGear(telemetryData.gear)}</span><span className="tele__l">gear</span></span>
              <span className="tele"><span className="tele__v">{formatPct(telemetryData.throttle)}</span><span className="tele__l">throttle</span></span>
              <span className="tele tele--lap"><span className="tele__v">{telemetryData.last}</span><span className="tele__l">Last lap</span></span>
              <span className="tele tele--lap"><span className="tele__v">{telemetryData.best}</span><span className="tele__l">Best lap</span></span>
              <span className="tele" style={{ marginLeft: "auto" }}><span className="tele__v">{telemetryData.gap}</span><span className="tele__l">gap</span></span>
            </div>
            <div className="pane__bars">
              <span className="pane__bar">{bar(telemetryData.throttle, "var(--throttle)")}</span>
              <span className="pane__bar">{bar(telemetryData.brake, "var(--brake)")}</span>
            </div>
          </>
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
    const [livePrefs] = React.useState(readLivePrefs);
    const [preset, setPreset] = React.useState(() => {
      const defaultPreset = normalizePresetName(livePrefs.defaultPreset);
      return LAYOUTS[defaultPreset] ? defaultPreset : "Intelligent";
    });
    const [selected, setSelected] = React.useState("");
    const [autopairs, setAutopairs] = React.useState(true);
    const [showToast, setShowToast] = React.useState(true);
    const [audioFeed, setAudioFeed] = React.useState("WORLD");
    const [expandedPane, setExpandedPane] = React.useState(null);
    const [layoutSaved, setLayoutSaved] = React.useState(false);
    const [streamTarget, setStreamTarget] = React.useState(null);
    const [streamDraft, setStreamDraft] = React.useState("");
    const [capturedStreams, setCapturedStreams] = React.useState([]);
    const [streamStatus, setStreamStatus] = React.useState("");
    const [f1TvSeason, setF1TvSeason] = React.useState(() => debugF1TvSeason || String(new Date().getFullYear()));
    const [f1TvLibrary, setF1TvLibrary] = React.useState(null);
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
    const [timingColumns, setTimingColumns] = React.useState(readTimingColumns);
    const [timingConfigOpen, setTimingConfigOpen] = React.useState(false);
    const [onboardOverrides, setOnboardOverrides] = React.useState({});
    const [retainedPanes, setRetainedPanes] = React.useState([]);
    const [aiPopupOpen, setAiPopupOpen] = React.useState(false);
    const [sessionLibraryOpen, setSessionLibraryOpen] = React.useState(false);
    const bodyRef = React.useRef(null);
    const centerRef = React.useRef(null);
    const gridRef = React.useRef(null);
    const playerRefs = React.useRef({});
    const panelSizesTouchedRef = React.useRef(false);
    const profilePanelSizesKeyRef = React.useRef("");
    const replayClockRef = React.useRef(0);
    const liveTimingRequestRef = React.useRef(0);
    const liveTimingInFlightRef = React.useRef(false);
    const intelligentCodesRef = React.useRef([]);
    const debugAutoF1TvLoaded = React.useRef(false);
    const [replaySync, setReplaySync] = React.useState({ mode: "live", playing: true, masterTime: 0, duration: 0, masterKey: "WORLD" });
    const [replayTimingData, setReplayTimingData] = React.useState(null);
    const [liveTimingData, setLiveTimingData] = React.useState(null);
    const [pendingF1TvSelection, setPendingF1TvSelection] = React.useState(false);
    const [clockTick, setClockTick] = React.useState(Date.now());
    const [dismissedInsights, setDismissedInsights] = React.useState([]);
    const [chatDraft, setChatDraft] = React.useState("");
    const [chatMessages, setChatMessages] = React.useState([
      { who: "ai", text: "Live timing is loaded when OpenF1 has a current session. Connect an AI provider in Settings for strategy reasoning over this snapshot." },
    ]);
    const [chatThinking, setChatThinking] = React.useState(false);
    const [streamSources, setStreamSources] = React.useState(readStreamSources);
    const layout = LAYOUTS[preset];
    const telemetryDefault = livePrefs.telemetryDefault !== false;
    const currentSeason = String(D.seasonSummary?.season || new Date().getFullYear());
    const selectableSeasons = Array.from(new Set([currentSeason, String(new Date().getFullYear()), String(new Date().getFullYear() - 1), String(new Date().getFullYear() - 2), "2024", "2023", "2022", "2021", "2020", "2019", "2018"])).filter(Boolean);

    React.useEffect(() => {
      const t = setTimeout(() => setShowToast(false), 6500);
      return () => clearTimeout(t);
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
      const normalized = normalizeLivePanelSizes(panelSizes);
      const serialized = JSON.stringify(normalized);
      localStorage.setItem(PANEL_SIZE_STORAGE_KEY, serialized);
      if (!panelSizesTouchedRef.current || !window.pitwall?.profile?.set || serialized === profilePanelSizesKeyRef.current) return;
      profilePanelSizesKeyRef.current = serialized;
      window.pitwall.profile.set({ ...profile, livePanelSizes: normalized }).catch(() => {});
    }, [panelSizes, profile]);
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

    function syncReplayPlayers(masterTime = replaySync.masterTime) {
      const players = Object.values(playerRefs.current).filter(Boolean);
      window.PW_SYNC?.syncReplayPlayers?.(players, masterTime, { seekThreshold: 0.5, rateThreshold: 0.075 });
    }

    function seekReplayPlayers(time) {
      const nextTime = Math.max(0, Number(time || 0));
      Object.values(playerRefs.current).forEach((video) => {
        try { video.currentTime = nextTime; } catch {}
      });
      setReplaySync((state) => ({ ...state, masterTime: nextTime }));
      syncReplayPlayers(nextTime);
    }

    function toggleReplayPlayback() {
      setReplaySync((state) => {
        const playing = !state.playing;
        Object.values(playerRefs.current).forEach((video) => {
          if (playing) video.play().catch(() => {});
          else video.pause();
        });
        return { ...state, playing };
      });
    }

    function syncTargetFor(key) {
      const value = syncSettings.targets?.[key];
      return clampSyncLatency(value == null ? defaultSyncTarget(key) : value);
    }

    function adjustSyncTarget(key, delta) {
      const syncKey = key || "WORLD";
      setSyncSettings((settings) => ({
        ...settings,
        targets: {
          ...(settings.targets || {}),
          [syncKey]: clampSyncLatency((settings.targets?.[syncKey] == null ? defaultSyncTarget(syncKey) : settings.targets[syncKey]) + delta),
        },
      }));
    }

    function resetSyncTarget(key) {
      const syncKey = key || "WORLD";
      setSyncSettings((settings) => {
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
            return { ...sizes, timingWidth: clampPanelSize(width, 260, Math.min(560, Math.max(300, bodyRect.width - 420))) };
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
        if (!f1TvRaceId && fallback.races[0]) setF1TvRaceId(raceLibraryId(fallback.races[0]));
        return;
      }
      setStreamStatus(forceRefresh ? "Refreshing F1 TV session library..." : "Loading F1 TV session library...");
      try {
        const library = await window.pitwall.f1tv.library({ season, forceRefresh });
        const nextLibrary = library?.races?.length ? library : localF1TvLibrary();
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
        if (currentRace) setF1TvRaceId(raceLibraryId(currentRace));
        const cacheLabel = library?.cached ? (library.stale ? " from stale cache" : " from cache") : "";
        setStreamStatus(`${nextLibrary.races.length} F1 TV weekend${nextLibrary.races.length === 1 ? "" : "s"} loaded${cacheLabel} for ${nextLibrary.season}`);
      } catch (error) {
        const fallback = localF1TvLibrary();
        setF1TvLibrary(fallback);
        if (!f1TvRaceId && fallback.races[0]) setF1TvRaceId(raceLibraryId(fallback.races[0]));
        setStreamStatus(error.message || "Using loaded calendar for F1 TV sessions");
      }
    }

    function selectedF1TvRaceItem() {
      const library = f1TvLibrary || localF1TvLibrary();
      const races = library.races || [];
      return races.find((item) => raceLibraryId(item) === f1TvRaceId) || races[0] || null;
    }

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
      setStreamStatus(status?.browserSession ? "F1 TV browser cookies exist, but the playback token is missing. Sign in with email and password in Settings, then retry." : "F1 TV is not connected in this PitWall app profile. MultiViewer login is separate. Connect F1 TV, then load the session again.");
      return false;
    }

    function decorateResolvedFeed(feed, resolved, sessionKind = f1TvSessionKind) {
      return {
        ...feed,
        contentId: resolved.contentId || feed.contentId || "",
        sessionKind,
        playbackMode: resolved.playbackMode || "replay",
      };
    }

    async function resolveSelectedF1TvContent(targetKey = "WORLD", selection = {}) {
      if (!window.pitwall?.f1tv?.resolveContent) {
        setStreamStatus("Clean F1 TV resolver is not available in this build.");
        return null;
      }
      const race = selection.race || selectedF1TvRaceItem();
      const sessionKind = selection.sessionKind || f1TvSessionKind;
      const detailUrl = f1TvDetailUrl.trim();
      if (!detailUrl && !race) {
        setStreamStatus("No F1 TV session is selected yet.");
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
          meetingKey: race?.meetingKey || debugF1TvMeetingKey || "",
        });
        const feeds = (resolved.feeds || []).map((feed) => decorateResolvedFeed(feed, resolved, sessionKind));
        const world = preferredMainF1TvFeed(feeds);
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
        setResolvedF1TvContent(nextResolved);
        setPendingF1TvSelection(false);
        setStreamSources((sources) => ({ ...sources, [targetKey || "WORLD"]: world }));
        setReplaySync({ mode: resolved.playbackMode || "replay", playing: true, masterTime: 0, duration: 0, masterKey: "WORLD" });
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
      markF1TvSelectionPending();
      setF1TvRaceId(raceLibraryId(race));
      setF1TvSessionKind(session.kind);
      loadSelectedF1TvReplay({ race, sessionKind: session.kind });
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

    function saveLayout() {
      localStorage.setItem("pw-live-layout", JSON.stringify({ preset, selected, expandedPane, panelSizes }));
      setLayoutSaved(true);
      setTimeout(() => setLayoutSaved(false), 1600);
    }

    function restoreLayout() {
      try {
        const saved = JSON.parse(localStorage.getItem("pw-live-layout") || "{}");
        const savedPreset = normalizePresetName(saved.preset);
        if (savedPreset && LAYOUTS[savedPreset]) setPreset(savedPreset);
        if (saved.selected && D.byCode[saved.selected]) setSelected(saved.selected);
        if (saved.panelSizes) setPanelSizes(normalizeLivePanelSizes(saved.panelSizes));
        setExpandedPane(saved.expandedPane || null);
      } catch {}
    }

    function activeTimingRows() {
      const replayRows = Array.isArray(replayTimingData?.timing) ? replayTimingData.timing : [];
      const liveRows = Array.isArray(liveTimingData?.timing) ? liveTimingData.timing : [];
      return replaySync.mode === "replay"
        ? (replayRows.length ? replayRows : D.timing)
        : (liveRows.length ? liveRows : D.timing);
    }

    function activeAiSnapshot() {
      const master = playerRefs.current[replaySync.masterKey || "WORLD"];
      const replayElapsedSeconds = Math.max(0, Number.isFinite(master?.currentTime) ? master.currentTime : replayClockRef.current || 0);
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
      if (slot === "focus-1") return fallback;
      const override = onboardOverrides[slot];
      return D.byCode[override] ? override : fallback;
    }

    const f1TvSessionLibrary = f1TvLibrary || localF1TvLibrary();
    const f1TvRaces = f1TvSessionLibrary.races || [];
    const currentF1TvWeekendIndex = (() => {
      const index = f1TvRaces.findIndex((race) => race.status === "live" || race.status === "upcoming");
      return index >= 0 ? index : Math.max(0, f1TvRaces.length - 1);
    })();
    const visibleF1TvRaces = f1TvRaces.length ? f1TvRaces.slice(0, currentF1TvWeekendIndex + 1) : [];
    const selectedF1TvRace = f1TvRaces.find((race) => raceLibraryId(race) === f1TvRaceId) || visibleF1TvRaces.at(-1) || f1TvRaces[0] || null;
    const standardF1TvSessions = ["Practice 1", "Practice 2", "Practice 3", "Sprint Qualifying", "Sprint", "Qualifying", "Race"];
    const selectedRaceSessions = selectedF1TvRace?.sessions?.length ? selectedF1TvRace.sessions.map((session) => session.kind) : standardF1TvSessions;
    const f1TvSessionOptions = standardF1TvSessions.filter((kind) => selectedRaceSessions.includes(kind)).concat(selectedRaceSessions.filter((kind) => !standardF1TvSessions.includes(kind)));
    const sessionLibrarySessions = selectedF1TvRace?.sessions?.length
      ? selectedF1TvRace.sessions
      : f1TvSessionOptions.map((kind) => ({ kind, status: "unknown" }));
    const timingRows = activeTimingRows();
    const { registerTimingRow, movingRows } = useTimingRowMotion(timingRows);
    const selectedCode = selected || timingRows[0]?.code || D.standings[0]?.code || D.drivers[0]?.code || "";
    const preferredCode = (profile.favoriteDrivers || []).find((code) => D.byCode[code]) || "";
    const activeSyncKey = audioFeed || selectedCode || "WORLD";
    const fallbackCodes = timingRows.map((row) => row.code).concat(D.standings.map((row) => row.code)).filter(Boolean);
    const liveTimingWeather = liveTimingData?.weather && Object.values(liveTimingData.weather).some((value) => value !== "" && value !== null && value !== undefined) ? liveTimingData.weather : null;
    const wx = replaySync.mode === "replay" && replayTimingData?.weather ? replayTimingData.weather : liveTimingWeather || D.race.weather || {};
    const replaySetupActive = pendingF1TvSelection || replaySync.mode === "replay";
    const currentLiveSession = replaySetupActive ? null : D.sessions.find((session) => session.status === "live") || D.schedule.find((race) => race.status === "live");
    const activeSessionKind = replaySync.mode === "replay"
      ? (replayTimingData?.sessionKind || f1TvSessionKind)
      : (liveTimingData?.sessionKind || currentLiveSession?.kind || f1TvSessionKind);
    const sessionClock = replaySync.mode === "replay" ? replayTimingData?.sessionClock : liveTimingData?.sessionClock;
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
    const hasCurrentLiveSession = Boolean(D.race?.lap || currentLiveSession);
    const sessionStatusLabel = hasCurrentLiveSession
      ? (D.race.lap ? `LAP ${D.race.lap} / ${D.race.laps || "—"}` : dataSource)
      : "No current live session";
    const timingSourceLabel = replaySync.mode === "replay"
      ? (replayTimingData?.sourceLabel || replayTimingData?.message || "Replay timing pending")
      : pendingF1TvSelection
        ? "Load a past session to start replay timing"
        : (liveTimingData?.sourceLabel || liveTimingData?.message || (D.race.lap ? `Lap ${D.race.lap}/${D.race.laps || "—"}` : dataSource));
    const activeInsights = buildActiveInsights({
      timingRows,
      sourceLabel: timingSourceLabel,
      mode: replaySync.mode,
      weather: wx,
      sessionClock,
      battlePairs: activeBattlePairs,
    });
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
      const exact = feeds.find((feed) => feed.driverCode === code || feed.feedId === code);
      if (exact) return exact;
      const worldIndex = Math.max(0, feeds.indexOf(preferredMainF1TvFeed(feeds)));
      const onboardFeeds = feeds.filter((_feed, index) => index !== worldIndex);
      if (!onboardFeeds.length || !code) return null;
      const codeOrder = Array.from(new Set(timingRows.map((row) => row.code).concat(fallbackCodes))).filter(Boolean);
      const feedIndex = Math.max(0, codeOrder.indexOf(code));
      const fallbackFeed = onboardFeeds[feedIndex % onboardFeeds.length];
      return fallbackFeed ? { ...fallbackFeed, feedId: code, driverCode: code, kind: "onboard", label: `${code} onboard` } : null;
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
          const data = await window.pitwall.data.liveTiming({ targetLatencySeconds: syncTargetFor("WORLD") });
          if (cancelled || requestId !== liveTimingRequestRef.current) return;
          setLiveTimingData((current) => data?.timing?.length ? data : current?.timing?.length ? current : data || null);
          logPitWallDebug("live.timing", {
            rowCount: data?.timing?.length || 0,
            ok: Boolean(data?.ok),
          });
        } catch (error) {
          if (cancelled || requestId !== liveTimingRequestRef.current) return;
          setLiveTimingData({ ok: false, timing: [], weather: {}, sourceLabel: "Live timing unavailable", message: "OpenF1 live timing is unavailable." });
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
        const master = playerRefs.current[replaySync.masterKey || "WORLD"];
        const elapsedSeconds = Math.max(0, Number.isFinite(master?.currentTime) ? master.currentTime : replayClockRef.current || 0);
        const timingElapsedSeconds = Math.max(0, elapsedSeconds + replayTimingOffset);
        const timingFeed = resolvedFeedForKey("WORLD") || streamSources.WORLD || {};
        const videoStartUtc = timingFeed.videoStartUtc || resolvedF1TvContent?.videoStartUtc || "";
        const videoStartArchiveSeconds = Number.isFinite(Number(timingFeed.videoStartArchiveSeconds)) ? Number(timingFeed.videoStartArchiveSeconds) : null;
        const videoStartKey = videoStartUtc || (videoStartArchiveSeconds != null ? String(Math.round(videoStartArchiveSeconds)) : "");
        const bucket = `${meetingKey}:${f1TvSessionKind}:${Math.floor(timingElapsedSeconds * 4)}:${replayTimingOffset}:${videoStartKey}`;
        if (bucket === lastBucket) return;
        lastBucket = bucket;
        try {
          const data = await window.pitwall.data.replayTiming({ meetingKey, sessionKind: f1TvSessionKind, elapsedSeconds: timingElapsedSeconds, videoStartUtc, videoStartArchiveSeconds });
          if (cancelled) return;
          setReplayTimingData((current) => data?.timing?.length ? data : current?.timing?.length ? current : data || null);
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
          if (cancelled) return;
          setReplayTimingData({ ok: false, timing: [], weather: {}, sourceLabel: "Replay timing unavailable", message: "OpenF1 replay timing is unavailable." });
          logPitWallDebug("replay.timing-error", { meetingKey, sessionKind: f1TvSessionKind, message: error?.message || String(error || "") });
        }
      };
      loadReplayTiming();
      const timer = setInterval(loadReplayTiming, REPLAY_TIMING_POLL_INTERVAL_MS);
      return () => {
        cancelled = true;
        clearInterval(timer);
      };
    }, [replaySync.mode, selectedF1TvRace?.meetingKey, f1TvSessionKind, replayTimingOffset, resolvedF1TvContent?.contentId, resolvedF1TvContent?.feeds]);
    React.useEffect(() => {
      if (replaySync.mode !== "replay") return undefined;
      const timer = setInterval(() => {
        const master = playerRefs.current[replaySync.masterKey || "WORLD"];
        if (!master) return;
        const masterTime = master.currentTime || 0;
        syncReplayPlayers(masterTime);
        setReplaySync((state) => {
          const duration = Number.isFinite(master.duration) ? master.duration : state.duration;
          if (Math.abs((state.masterTime || 0) - masterTime) < 0.1 && state.duration === duration) return state;
          return { ...state, masterTime, duration };
        });
      }, REPLAY_TIMING_POLL_INTERVAL_MS);
      return () => clearInterval(timer);
    }, [replaySync.mode, replaySync.masterKey]);
    React.useEffect(() => {
      if (!autopairs || !battlePair?.a || !battlePair?.b) return;
      if (layout === "focus") return;
      setPreset("Battle Mode");
      setSelected(battlePair.b);
      setExpandedPane(null);
    }, [autopairs, battlePair?.a, battlePair?.b, layout]);
    React.useEffect(() => {
      if (layout !== "focus") setAiPopupOpen(false);
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
    };
    const presetOptions = Array.from(new Set((D.presets?.length ? D.presets : Object.keys(LAYOUTS)).map(normalizePresetName))).filter((name) => LAYOUTS[name]);
    const panes = layout === "battle"
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
      : [
          { broadcast: true, focus: true, zone: "world", style: { gridArea: "world" } },
          { feed: "Onboard", code: onboardCodeForSlot("focus-1", focusCodes[0]), slot: "focus-1", zone: "ob1", style: { gridArea: "ob1" } },
          { feed: "Onboard", code: onboardCodeForSlot("focus-2", focusCodes[1]), slot: "focus-2", zone: "ob2", style: { gridArea: "ob2" } },
          { feed: "Onboard", code: onboardCodeForSlot("focus-3", focusCodes[2]), slot: "focus-3", zone: "ob3", style: { gridArea: "ob3" } },
        ];
    const activePanes = panes
      .filter((pane) => pane.broadcast || pane.code)
      .map((pane) => ({ ...pane, paneId: pane.broadcast ? "WORLD" : `DRIVER-${pane.code}` }));
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
                    <div className="insight__t">{ins.title}<span className="insight__conf">· {Math.round(ins.conf * 100)}%</span></div>
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
            <div className="ins__msgs" aria-busy={chatThinking ? "true" : "false"}>
              {chatMessages.map((msg, i) => <AiMessage message={msg} key={i} />)}
              {chatThinking && <AiMessage message={{ who: "ai", text: "Engineer is thinking", thinking: true }} />}
            </div>
            <div className="ins__compose">
              <input className="ins__input" placeholder="Ask about strategy, gaps, projections…" value={chatDraft}
                onChange={(e) => setChatDraft(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") sendChat(); }} />
              <IconButton variant="accent" label="Send" onClick={sendChat}><Icon name="chevronRight" size={16} /></IconButton>
            </div>
          </div>
        </div>
      );
    }

    function renderSessionLibrary(options = {}) {
      const inline = Boolean(options.inline);
      return (
        <div className={"session-library" + (inline ? " session-library--inline" : "")} role="dialog" aria-modal={inline ? "false" : "true"} aria-label="Session Library">
          <div className="session-library__panel">
            <div className="session-library__head">
              <span className="session-library__glyph"><Icon name="grid" size={24} /></span>
              <div>
                <h2 className="session-library__title">Session Library</h2>
                <div className="session-library__sub">Pick a weekend, then load any session into Live Racing</div>
              </div>
              <span className="session-library__close">
                <IconButton variant="ghost" label="Close session library" onClick={() => setSessionLibraryOpen(false)}><Icon name="close" size={22} /></IconButton>
              </span>
            </div>
            <div className="session-library__body">
              <aside className="session-library__rail">
                <div className="session-library__eyebrow">Race weekends</div>
                {visibleF1TvRaces.map((race, index) => {
                  const id = raceLibraryId(race);
                  const active = selectedF1TvRace && raceLibraryId(selectedF1TvRace) === id;
                  const isCurrent = index === currentF1TvWeekendIndex;
                  const sessions = race.sessions?.length || 0;
                  return (
                    <button className="session-library__race" data-active={String(active)} key={id} type="button" onClick={() => chooseLibraryRace(race)}>
                      <span className="session-library__race-top">
                        <span>{race.rnd ? "R" + race.rnd : "R-"}</span>
                        {isCurrent && <Badge tone={race.status === "live" ? "live" : "accent"}>{race.status === "live" ? "LIVE" : "CURRENT"}</Badge>}
                        {!isCurrent && sessions > 0 && <Badge tone="outline">{sessions} session{sessions === 1 ? "" : "s"}</Badge>}
                      </span>
                      <span className="session-library__race-name">{race.name || "Race weekend"}</span>
                      <span className="session-library__race-meta"><Icon name="calendar" size={13} /> {[racePlace(race), race.date].filter(Boolean).join(" - ")}</span>
                    </button>
                  );
                })}
              </aside>
              <section className="session-library__content">
                {selectedF1TvRace ? (
                  <>
                    <div className="session-library__summary">
                      <div>
                        <h3>{selectedF1TvRace.name}</h3>
                        <p>{[selectedF1TvRace.circuit, selectedF1TvRace.loc, selectedF1TvRace.date].filter(Boolean).join(" - ")}</p>
                      </div>
                      <span className="session-library__count">{sessionLibrarySessions.length} session{sessionLibrarySessions.length === 1 ? "" : "s"}</span>
                    </div>
                    <div className="session-library__rows">
                      {sessionLibrarySessions.map((session) => {
                        const active = f1TvSessionKind === session.kind;
                        const live = session.status === "live";
                        return (
                          <div className="session-library__row" data-active={String(active)} key={session.kind}>
                            <span className="session-library__code">{sessionShortCode(session.kind)}</span>
                            <div>
                              <div className="session-library__kind">{session.kind}</div>
                              <div className="session-library__when"><Icon name="calendar" size={13} /> {sessionScheduleText(session)}</div>
                            </div>
                            <Button variant={live ? "primary" : "secondary"} onClick={() => loadLibrarySession(selectedF1TvRace, session)} disabled={f1TvResolving} iconLeft={<Icon name="play" size={14} />}>
                              {f1TvResolving && active ? "Resolving..." : live ? "Watch live" : "Watch replay"}
                            </Button>
                          </div>
                        );
                      })}
                    </div>
                  </>
                ) : (
                  <div className="session-library__empty">No race weekends are loaded yet.</div>
                )}
              </section>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="live">
        {/* Title bar */}
        <div className="live__bar">
          <div className="live__traffic"><span style={{ background: "#ff5f57" }} onClick={onExit} /><span style={{ background: "#febc2e" }} /><span style={{ background: "#28c840" }} /></div>
          <span className="live__brand">PIT<i>WALL</i></span>
          <div className="live__race">
            <Badge tone={hasCurrentLiveSession ? "live" : "neutral"}>{hasCurrentLiveSession ? "LIVE" : "REPLAY"}</Badge>
            <span>{D.race.name || "Live session"}</span>
            <span className="live__lap">{sessionStatusLabel}</span>
            <FlagStatus status={wx.cond === "Rain" ? "yellow" : "green"} label={wx.cond || "Session"} />
          </div>
          <div className="live__presets">
            <span className="preset-select-wrap">
              <select className="preset-select" aria-label="Layout preset" value={preset} onChange={(e) => { setPreset(e.target.value); setExpandedPane(null); }}>
                {presetOptions.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
              <Icon name="chevronDown" size={14} className="preset-select__icon" />
            </span>
            <IconButton variant={layoutSaved ? "accent" : "ghost"} size="sm" label="Save layout" onClick={saveLayout}><Icon name="plus" size={15} /></IconButton>
          </div>
          <div className="live__barright">
            {layout === "focus" && <Button variant="secondary" size="sm" onClick={() => setAiPopupOpen(true)} iconLeft={<Icon name="sparkles" size={14} />}>AI</Button>}
            <Button variant="primary" size="sm" onClick={openSessionLibrary} iconLeft={<Icon name="play" size={14} />}>Load past session</Button>
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
            <Button variant="secondary" size="sm" onClick={restoreLayout} iconLeft={<Icon name="grid" size={14} />}>Layout</Button>
            <Button variant="ghost" size="sm" onClick={onExit} iconLeft={<Icon name="close" size={14} />}>Exit live</Button>
          </div>
        </div>

        {/* Body */}
        {liveWorkspaceReady ? (
        <div className="live__body" data-layout={layout} ref={bodyRef} style={panelStyle}>
          {/* Live timing sidebar */}
          <aside className="live__timing">
            <div className="live__timinghd">
              <span className="live__timingtitle">
                <Icon name="timer" size={15} />
                <h3>Live Timing</h3>
              </span>
              {sessionClockLabel && <span className="live__timingclock" aria-label="Session clock">{sessionClockLabel}</span>}
              <span className="live__timingactions">
                <Badge tone="outline">P1–12</Badge>
                <IconButton variant={timingConfigOpen ? "accent" : "ghost"} size="sm" label="Edit timing columns" onClick={() => setTimingConfigOpen((open) => !open)}><Icon name="pencil" size={14} /></IconButton>
              </span>
            </div>
            {timingConfigOpen && <TimingColumnMenu columns={timingColumns} onToggle={toggleTimingColumn} />}
            <div className="live__statusbar">
              <FlagStatus status={hasCurrentLiveSession ? "green" : "yellow"} label={hasCurrentLiveSession ? "Clear" : "Replay"} />
              <Badge tone="neutral">{timingSourceLabel}</Badge>
              <span style={{ marginLeft: "auto", fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--text-tertiary)" }}>{timingRows.length} timing rows</span>
            </div>
            <div className="live__timingscroll">
              <div className="timing-tower">
                <TimingTowerHeader columns={timingColumns} />
                {timingRows.map((t) => {
                  const d = D.byCode[t.code] || {};
                  return (
                    <TimingTowerRow key={t.code} row={t} driver={d} columns={timingColumns}
                      selected={selectedCode === t.code} moving={Boolean(movingRows[t.code])} elimination={isQualifyingEliminationRow(t, { qualifyingPhase, rowCount: timingRows.length })} registerRow={registerTimingRow}
                      onClick={() => { setSelected(t.code); setPreset("Intelligent"); setExpandedPane(null); }} />
                  );
                })}
              </div>
            </div>
            <div className="live__weather">
              <span className="live__wx"><Icon name="thermometer" size={14} /> Air <b>{wx.air != null && wx.air !== "" ? wx.air + "°" : "—"}</b></span>
              <span className="live__wx"><Icon name="gauge" size={14} /> Track <b>{wx.track != null && wx.track !== "" ? wx.track + "°" : "—"}</b></span>
              <span className="live__wx"><Icon name="droplet" size={14} /> <b>{wx.rain || "—"}</b></span>
            </div>
          </aside>
          <ResizeHandle kind="timing" label="Resize live timing" />

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
                </>
              )}
              {layout === "data" && (
                <>
                  <ResizeHandle kind="data-a" label="Resize data columns" />
                  <ResizeHandle kind="data-b" label="Resize data columns" />
                  <ResizeHandle kind="data-row" label="Resize data rows" />
                </>
              )}
              {panesToRender.map((p) => {
                const key = p.broadcast ? "WORLD" : p.code;
                const label = p.broadcast ? "F1 Live" : (D.byCode[p.code]?.name || p.code || "Driver") + " onboard";
                const paneKey = p.paneId;
                return (
                  <Pane key={paneKey} {...p}
                    visible={p.visible !== false}
                    style={p.style}
                    zone={p.zone}
                    driverOptions={D.drivers}
                    onDriverChange={(code) => p.slot && setOnboardOverrides((current) => ({ ...current, [p.slot]: code }))}
                    telemetry={(p.telemetry || p.feed === "Onboard") && telemetryDefault}
                    streamUrl={streamSources[key] || resolvedFeedForKey(key, p.code)}
                    audioActive={audioFeed === key}
                    onAudioFocus={() => setAudioFeed(audioFeed === key ? null : key)}
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
                    expanded={expandedPane === paneKey}
                    onExpand={() => setExpandedPane(expandedPane === paneKey ? null : paneKey)} />
                );
              })}
            </div>

            {layout !== "focus" && <ResizeHandle kind="insights" label="Resize AI insights" />}
            {layout !== "focus" && renderInsightsPane()}
          </div>
        </div>
        ) : (
          <div className="live__preload">
            {renderSessionLibrary({ inline: true })}
          </div>
        )}
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
                    <span>PitWall resolves the selected session or pasted detail URL in the background, then loads the clean video stream here.</span>
                  </div>
                  <div className="f1tv-picker__meta" data-ready={drmStatus ? String(Boolean(drmStatus.widevine)) : undefined}>
                    <Icon name="key" size={13} />
                    <span>{drmStatus ? (drmStatus.widevine ? `Protected playback ready${drmStatus.cdm?.version ? " - Widevine " + drmStatus.cdm.version : ""}` : `Protected playback needs Widevine${drmStatus.reason ? ": " + drmStatus.reason : ""}`) : "Checking protected playback..."}</span>
                  </div>
                  <div className="stream-modal__tools">
                    <Button variant="primary" onClick={() => resolveSelectedF1TvContent(streamTarget.key)} iconLeft={<Icon name="play" size={14} />}>Resolve clean stream</Button>
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
                <div className="stream-modal__hint">Resolved F1 TV streams use your authenticated PitWall session and local Widevine support. MultiViewer login is separate. PitWall does not store F1 TV credentials here or extract DRM keys.</div>
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
