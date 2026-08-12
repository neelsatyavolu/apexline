/* Apexline — Track Map screen. window.PW.TrackMap
   Circuit map with live driver positions when a session is on, fully labelled
   turns / sectors otherwise. Renders the body only; AppShell supplies the
   sidebar + topbar chrome. All race data comes from usePitWall() (the Electron
   bridge); circuit outlines are real OSM centerlines (window.PW_TRACKMAP_CIRCUITS,
   see trackmap-circuits.js). Start/finish, sectors and numbered corners
   are derived from the path geometry; corner names are not part of the dataset. */
(function () {
  const { useRef, useState, useEffect, useMemo } = React;
  const NS = window.PitWallDesignSystem_698fe6;
  const Icon = NS.Icon;

  const CIRCUITS = window.PW_TRACKMAP_CIRCUITS || {};
  const CIRCUIT_ORDER = window.PW_TRACKMAP_ORDER || Object.keys(CIRCUITS);

  const TYRE = { S: "var(--tyre-soft)", M: "var(--tyre-medium)", H: "var(--tyre-hard)", I: "var(--tyre-inter)", W: "var(--tyre-wet)" };
  const FLAG_LABEL = { green: "GREEN FLAG", yellow: "YELLOW FLAG", sc: "SAFETY CAR", vsc: "VIRTUAL SC", red: "RED FLAG", chequered: "CHEQUERED" };
  const FLAG_VAR = { green: "var(--flag-green)", yellow: "var(--flag-yellow, #ffd23f)", sc: "var(--flag-yellow, #ffd23f)", vsc: "var(--flag-yellow, #ffd23f)", red: "var(--live)", chequered: "var(--text-1)" };
  const TRACK_MAP_REPLAY_TICK_MS = 100;
  const TRACK_MAP_REPLAY_DATA_POLL_MS = 1000;
  const TRACK_MAP_MOTION_TAU_MS = 200;
  const TRACK_MAP_FALLBACK_TAU_MS = 550;
  const TRACK_MAP_DEAD_RECKON_MAX_MS = 900;
  const TRACK_MAP_TARGET_STALL_MS = 1500;
  const TRACK_MAP_OFFICIAL_TELEPORT_PX = 150;
  const TRACK_MAP_SNAP_MAX_DIST_PX = 60;
  const TRACK_MAP_RESNAP_WINDOW_PX = 110;
  const TRACK_MAP_Z_WEIGHT = 2;             // snap-cost px per projected px of elevation mismatch
  const TRACK_MAP_Z_PENALTY_MAX_PX = 18;    // cap: z arbitrates near-ties only; a stale z reading
                                            // (seen in real lap-1 Monaco data) must never drag a
                                            // planar-correct point onto another section
  const TRACK_MAP_Z_MIN_SAMPLES = 24;       // sample points with usable z before a profile is trusted
  const TRACK_MAP_Z_MIN_COVERAGE = 0.5;     // fraction of vertices that must learn a z directly
  const TRACK_MAP_Z_CONFLICT_SPREAD = 60;   // official z units (6m): per-vertex spread marking a conflict
  const TRACK_MAP_Z_CONFLICT_MAX_FRACTION = 0.15; // conflicted-vertex share that invalidates the map fit

  /* ====================================================================== */
  /* Styles (ported from the design's Track Map.html, chrome rules dropped). */
  /* ====================================================================== */
  const STYLE_ID = "pw-tm-styles";
  {
    let el = document.getElementById(STYLE_ID);
    if (!el) { el = document.createElement("style"); el.id = STYLE_ID; document.head.appendChild(el); }
    el.textContent = `
    .tm-screen { display: flex; flex-direction: column; gap: var(--space-8); height: calc(100vh - var(--topbar-h) - (2 * var(--space-10))); min-height: 560px; }

    /* Header */
    .tm-head { display: flex; align-items: flex-end; justify-content: space-between; gap: var(--space-9); flex: none; }
    .tm-head__round { font-family: var(--font-mono); font-size: var(--text-2xs); letter-spacing: var(--tracking-caps); text-transform: uppercase; color: var(--accent); }
    .tm-head__gp { font-family: var(--font-display); font-weight: 800; font-size: var(--text-4xl); color: var(--text-strong); margin: 4px 0 5px; letter-spacing: -0.01em; line-height: 1; }
    .tm-head__circuit { display: flex; align-items: center; gap: var(--space-4); font-size: var(--text-sm); color: var(--text-secondary); }
    .tm-head__status { display: flex; align-items: center; gap: var(--space-9); }
    .tm-raceselect { position: relative; display: inline-flex; align-items: center; gap: var(--space-4); min-width: 240px; max-width: 340px; height: 34px; padding: 0 var(--space-5); border: 1px solid var(--border-default); border-radius: var(--radius-sm); background: var(--bg-sunken); color: var(--text-secondary); box-shadow: var(--inset-top-light); }
    .tm-raceselect svg { flex: none; color: var(--text-tertiary); }
    .tm-raceselect__select { appearance: none; -webkit-appearance: none; flex: 1; min-width: 0; height: 100%; padding: 0 22px 0 0; border: 0; outline: 0; background: transparent; color: var(--text-primary); font-family: var(--font-sans); font-size: var(--text-sm); font-weight: 700; cursor: pointer; }
    .tm-raceselect__select option { color: var(--text-primary); background: var(--bg-base); }
    .tm-raceselect__chev { position: absolute; right: var(--space-5); pointer-events: none; color: var(--text-tertiary); }
    .tm-head__actions { display: inline-flex; align-items: center; gap: var(--space-5); }
    .tm-replayprogress { display: inline-flex; align-items: center; gap: 8px; width: 212px; height: 34px; padding: 0 10px; border: 1px solid var(--border-default); border-radius: var(--radius-sm); background: var(--bg-sunken); color: var(--text-secondary); box-shadow: var(--inset-top-light); }
    .tm-replayprogress__label { flex: none; min-width: 68px; font-family: var(--font-mono); font-size: var(--text-2xs); font-weight: 800; color: var(--text-primary); }
    .tm-replayprogress__range { flex: 1; min-width: 0; accent-color: var(--accent); cursor: pointer; }
    .tm-replaybtn { display: inline-flex; align-items: center; gap: 6px; height: 34px; padding: 0 12px; border: 1px solid var(--accent-border); border-radius: var(--radius-sm); background: var(--accent-quiet); color: var(--text-primary); font-family: var(--font-sans); font-size: var(--text-sm); font-weight: 800; cursor: pointer; }
    .tm-replaybtn:hover { border-color: var(--accent); background: var(--surface-hover); }
    .tm-replaybtn:disabled { cursor: default; opacity: 0.55; }
    .tm-statline { display: flex; flex-direction: column; gap: var(--space-4); align-items: flex-end; }
    .tm-livebadge { display: inline-flex; align-items: center; gap: 5px; font-size: 11px; padding: 3px 8px; }
    .tm-livedot { width: 7px; height: 7px; border-radius: 50%; background: var(--live); box-shadow: 0 0 0 0 var(--live-glow); animation: tm-pulse 1.4s infinite; }
    @keyframes tm-pulse { 0% { box-shadow: 0 0 0 0 var(--live-glow); } 70% { box-shadow: 0 0 0 7px rgba(255,59,59,0); } 100% { box-shadow: 0 0 0 0 rgba(255,59,59,0); } }
    .tm-flag { font-family: var(--font-mono); font-size: var(--text-2xs); font-weight: 700; letter-spacing: var(--tracking-wide); color: var(--flag-green); }
    .tm-lap { display: flex; align-items: baseline; gap: 5px; }
    .tm-lap__big { font-family: var(--font-mono); font-weight: 700; font-size: var(--text-5xl); color: var(--text-strong); line-height: 0.9; }
    .tm-lap__sml { font-family: var(--font-mono); font-size: var(--text-xl); color: var(--text-tertiary); }
    .tm-lap__lbl { font-size: var(--text-2xs); letter-spacing: var(--tracking-caps); color: var(--text-tertiary); margin-left: 4px; align-self: center; }
    .tm-wx { display: flex; flex-direction: column; gap: 3px; font-size: var(--text-xs); color: var(--text-secondary); text-align: right; }
    .tm-wx span { display: inline-flex; align-items: center; gap: 5px; justify-content: flex-end; }
    .tm-wx__dry { color: var(--success); font-weight: 600; }
    .tm-cd { display: flex; gap: var(--space-6); }
    .tm-cd__seg { display: flex; flex-direction: column; align-items: center; }
    .tm-cd__n { font-family: var(--font-mono); font-weight: 700; font-size: var(--text-4xl); color: var(--text-strong); line-height: 1; }
    .tm-cd__l { font-size: var(--text-2xs); letter-spacing: var(--tracking-caps); color: var(--text-tertiary); margin-top: 3px; }

    /* Stage: map + rail */
    .tm-stage { flex: 1; display: grid; grid-template-columns: 1fr var(--timing-sidebar-w); gap: var(--space-8); min-height: 0; }
    .tm-mapwrap { min-width: 0; min-height: 0; display: flex; }
    .tm-mapcard { position: relative; flex: 1; min-height: 0; border: 1px solid var(--border-default); border-radius: var(--radius-lg);
      background-image: var(--grad-carbon), radial-gradient(120% 120% at 50% 0%, rgba(45,123,255,0.06), transparent 55%); background-color: var(--bg-1); overflow: hidden; }
    .tm-svg { width: 100%; height: 100%; display: block; }
    .tm-mapnote { position: absolute; inset: 0; display: grid; place-items: center; text-align: center; padding: var(--space-9); }
    .tm-mapnote__in { max-width: 320px; display: flex; flex-direction: column; align-items: center; gap: var(--space-5); color: var(--text-tertiary); font-size: var(--text-sm); line-height: 1.5; }

    /* SVG map elements */
    .tm-turn { cursor: pointer; }
    .tm-turn__lead { stroke: rgba(174,182,198,0.32); stroke-width: 1; }
    .tm-turn__dot { fill: var(--text-2); }
    .tm-turn__badge { fill: var(--bg-3); stroke: var(--border-strong); stroke-width: 1; }
    .tm-turn__num { font-family: var(--font-mono); font-weight: 700; font-size: 11px; fill: var(--text-1); }
    .tm-turn__name { font-family: var(--font-sans); font-weight: 600; font-size: 10px; fill: var(--text-2); letter-spacing: 0.01em; }
    .tm-turn[data-active="true"] .tm-turn__badge { fill: var(--accent); stroke: var(--accent-hover); }
    .tm-turn[data-active="true"] .tm-turn__num { fill: #fff; }
    .tm-turn[data-active="true"] .tm-turn__dot { fill: var(--accent); }
    .tm-turn:hover .tm-turn__badge { stroke: var(--accent); }
    .tm-sectext { font-family: var(--font-mono); font-weight: 700; font-size: 10px; fill: var(--accent); }
    .tm-sftext { font-family: var(--font-mono); font-weight: 700; font-size: 10px; fill: var(--text-1); letter-spacing: 0.12em; }

    .tm-car { cursor: pointer; transition: opacity 0.2s; }
    .tm-car[data-dim="true"] { opacity: 0.34; }
    .tm-car__halo { opacity: 0.28; }
    .tm-car__num { font-family: var(--font-mono); font-weight: 700; font-size: 9.5px; fill: #fff; paint-order: stroke; stroke: rgba(0,0,0,0.5); stroke-width: 0.5px; }
    .tm-car__code { font-family: var(--font-display); font-weight: 700; font-size: 10px; }
    .tm-car__gap { font-family: var(--font-mono); font-weight: 500; font-size: 9px; fill: var(--text-2); }
    .tm-car[data-focused="true"] .tm-car__body { stroke: #fff; stroke-width: 2; }
    .tm-car[data-focused="true"] .tm-car__halo { opacity: 0.55; r: 12; }

    /* On-map controls + legend + turn card */
    .tm-mapctl { position: absolute; top: var(--space-7); left: var(--space-7); display: flex; gap: var(--space-5); }
    .tm-ctlbtn { display: inline-flex; align-items: center; gap: 5px; height: 30px; padding: 0 11px; border-radius: var(--radius-pill); border: 1px solid var(--border-default); background: color-mix(in srgb, var(--bg-3) 86%, transparent); backdrop-filter: blur(8px); color: var(--text-secondary); font-family: var(--font-sans); font-size: var(--text-xs); font-weight: 600; cursor: pointer; }
    .tm-ctlbtn:hover { color: var(--text-primary); border-color: var(--border-strong); }
    .tm-ctlbtn--clear { color: var(--accent); border-color: var(--accent-border); }
    .tm-legend { position: absolute; bottom: var(--space-7); left: var(--space-7); display: flex; flex-wrap: wrap; gap: var(--space-7); padding: 8px 12px; border-radius: var(--radius-md); background: color-mix(in srgb, var(--bg-2) 82%, transparent); backdrop-filter: blur(8px); border: 1px solid var(--border-subtle); }
    .tm-legend__it { display: inline-flex; align-items: center; gap: 6px; font-size: var(--text-2xs); color: var(--text-secondary); }
    .tm-legend__sw { width: 12px; height: 4px; border-radius: 2px; }
    .tm-turncard { position: absolute; top: var(--space-7); right: var(--space-7); width: 184px; padding: var(--space-7); border-radius: var(--radius-md); background: var(--surface-overlay); border: 1px solid var(--accent-border); box-shadow: var(--shadow-lg); }
    .tm-turncard__x { position: absolute; top: 8px; right: 8px; background: none; border: 0; color: var(--text-tertiary); cursor: pointer; }
    .tm-turncard__n { font-family: var(--font-mono); font-weight: 700; font-size: var(--text-2xs); color: var(--accent); letter-spacing: 0.1em; }
    .tm-turncard__nm { font-family: var(--font-display); font-weight: 700; font-size: var(--text-xl); color: var(--text-strong); margin: 2px 0 3px; }
    .tm-turncard__meta { font-size: var(--text-2xs); color: var(--text-tertiary); }

    /* Rail */
    .tm-railwrap { min-height: 0; display: flex; }
    .tm-rail { display: block; flex: 1; min-height: 0; overflow-y: auto; border: 1px solid var(--border-default); border-radius: var(--radius-lg); background: var(--surface-card); padding: var(--space-7); }
    .tm-rail__hd { display: flex; align-items: baseline; justify-content: space-between; margin-bottom: var(--space-6); }
    .tm-rail__hd--mt { margin-top: var(--space-9); }
    .tm-rail__ttl { font-family: var(--font-display); font-weight: 700; font-size: var(--text-md); color: var(--text-primary); letter-spacing: 0.02em; }
    .tm-rail__sub { font-family: var(--font-mono); font-size: var(--text-2xs); color: var(--text-tertiary); }

    /* Timing tower */
    .tm-tower { display: flex; flex-direction: column; gap: 2px; }
    .tm-trow { display: grid; grid-template-columns: 18px 4px 1fr 18px auto; align-items: center; gap: var(--space-5); padding: 5px var(--space-5); border-radius: var(--radius-sm); cursor: pointer; border: 1px solid transparent; }
    .tm-trow:hover { background: var(--surface-hover); }
    .tm-trow[data-foc="true"] { background: var(--accent-quiet); border-color: var(--accent-border); }
    .tm-trow[data-dim="true"] { opacity: 0.45; }
    .tm-trow__pos { font-family: var(--font-mono); font-weight: 700; font-size: var(--text-xs); color: var(--text-tertiary); text-align: right; }
    .tm-trow__bar { width: 4px; height: 18px; border-radius: 2px; }
    .tm-trow__code { font-family: var(--font-display); font-weight: 700; font-size: var(--text-md); color: var(--text-primary); display: flex; align-items: baseline; gap: 4px; }
    .tm-trow__code i { font-family: var(--font-mono); font-style: normal; font-weight: 500; font-size: 9px; color: var(--text-tertiary); }
    .tm-trow__tyre { width: 17px; height: 17px; border-radius: 50%; display: grid; place-items: center; font-family: var(--font-mono); font-weight: 700; font-size: 9px; color: var(--tc); border: 1.5px solid var(--tc); }
    .tm-trow__gap { font-family: var(--font-mono); font-size: var(--text-xs); color: var(--text-secondary); text-align: right; min-width: 52px; }
    .tm-trow__gap.is-lead { font-size: 9px; letter-spacing: 0.08em; color: var(--text-tertiary); }

    .tm-battles { display: flex; flex-direction: column; gap: var(--space-5); }
    .tm-battle { padding: var(--space-6); border-radius: var(--radius-md); background: var(--bg-sunken); border: 1px solid var(--border-subtle); }
    .tm-battle__pair { display: flex; align-items: center; gap: var(--space-5); font-family: var(--font-display); font-weight: 700; font-size: var(--text-md); }
    .tm-battle__gap { font-family: var(--font-mono); font-weight: 500; font-size: var(--text-2xs); color: var(--warning); padding: 1px 6px; border-radius: var(--radius-pill); background: var(--warning-quiet); }
    .tm-battle__note { font-size: var(--text-xs); color: var(--text-secondary); margin-top: 5px; line-height: 1.4; }

    /* Circuit facts */
    .tm-facts { display: grid; grid-template-columns: 1fr 1fr; gap: 1px; background: var(--border-subtle); border: 1px solid var(--border-subtle); border-radius: var(--radius-md); overflow: hidden; }
    .tm-fact { background: var(--surface-card); padding: var(--space-6) var(--space-6); display: flex; flex-direction: column; gap: 3px; }
    .tm-fact__k { display: flex; align-items: center; gap: 5px; font-size: var(--text-2xs); color: var(--text-tertiary); }
    .tm-fact__v { font-family: var(--font-mono); font-weight: 600; font-size: var(--text-md); color: var(--text-primary); }
    .tm-record { margin-top: var(--space-7); padding: var(--space-7); border-radius: var(--radius-md); background: var(--accent-soft); border: 1px solid var(--accent-border); display: flex; flex-direction: column; gap: 2px; }
    .tm-record__lbl { display: flex; align-items: center; gap: 6px; font-size: var(--text-2xs); letter-spacing: var(--tracking-wide); text-transform: uppercase; color: var(--text-secondary); }
    .tm-record__time { font-family: var(--font-mono); font-weight: 700; font-size: var(--text-2xl); color: var(--text-strong); }
    .tm-record__who { font-size: var(--text-2xs); color: var(--text-tertiary); }
    .tm-turns { display: grid; grid-template-columns: 1fr 1fr; gap: 3px; }
    .tm-turnrow { display: flex; align-items: center; gap: var(--space-5); padding: 5px var(--space-5); border-radius: var(--radius-sm); cursor: pointer; border: 1px solid transparent; }
    .tm-turnrow:hover { background: var(--surface-hover); }
    .tm-turnrow[data-active="true"] { background: var(--accent-quiet); border-color: var(--accent-border); }
    .tm-turnrow__n { font-family: var(--font-mono); font-weight: 700; font-size: var(--text-xs); color: var(--accent); width: 18px; text-align: center; flex: none; }
    .tm-turnrow__nm { font-size: var(--text-xs); color: var(--text-secondary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .tm-empty { margin-top: var(--space-7); display: flex; align-items: center; gap: var(--space-5); padding: var(--space-6); border-radius: var(--radius-md); background: var(--bg-sunken); border: 1px dashed var(--border-default); font-size: var(--text-xs); color: var(--text-tertiary); line-height: 1.4; }
    .tm-modal { position: fixed; inset: 0; z-index: 90; display: grid; place-items: center; padding: var(--space-9); background: rgba(3,5,9,0.62); backdrop-filter: blur(8px); }
    .tm-modal__panel { width: min(420px, 100%); border: 1px solid var(--border-default); border-radius: var(--radius-md); background: var(--surface-overlay); box-shadow: var(--shadow-lg); padding: var(--space-8); }
    .tm-modal__head { display: flex; justify-content: space-between; align-items: start; gap: var(--space-6); }
    .tm-modal__title { font-family: var(--font-display); font-weight: 800; font-size: var(--text-2xl); color: var(--text-strong); }
    .tm-modal__sub { margin-top: 4px; color: var(--text-tertiary); font-size: var(--text-sm); }
    .tm-modal__choices { display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-5); margin-top: var(--space-8); }
    .tm-modal__choice { min-height: 74px; border: 1px solid var(--border-default); border-radius: var(--radius-sm); background: var(--bg-sunken); color: var(--text-primary); cursor: pointer; text-align: left; padding: var(--space-6); }
    .tm-modal__choice:hover { border-color: var(--accent-border); background: var(--accent-quiet); }
    .tm-modal__kind { display: block; font-family: var(--font-display); font-size: var(--text-xl); font-weight: 800; }
    .tm-modal__meta { display: block; margin-top: 4px; color: var(--text-tertiary); font-size: var(--text-xs); }
    `;
  }

  function resolveCircuit(race) {
    if (!race) return null;
    const hay = `${race.circuit || ""} ${race.name || ""} ${race.loc || ""}`.toLowerCase();
    if (!hay.trim()) return null;
    for (const id of CIRCUIT_ORDER) {
      const c = CIRCUITS[id];
      if (c && (c.match || []).some((m) => hay.includes(m))) return c;
    }
    return null;
  }

  function raceKey(race) {
    return String(race?.rnd || race?.meetingKey || race?.startsAt || race?.name || "");
  }
  function raceLabel(race) {
    const round = race?.rnd ? `R${race.rnd} · ` : "";
    return `${round}${race?.name || race?.circuit || "Race weekend"}`;
  }
  function sessionLabel(session) {
    return [session?.day, session?.time].filter(Boolean).join(" ") || "Official livetiming archive";
  }
  function trackMapReplaySessionOptions(race) {
    const sessions = Array.isArray(race?.sessions) ? race.sessions : [];
    const sprint = sessions.find((session) => /^sprint$/i.test(session.kind || ""));
    const grandPrix = sessions.find((session) => /^race$/i.test(session.kind || ""));
    if (sprint && grandPrix) return [sprint, grandPrix];
    if (grandPrix) return [grandPrix];
    return [{ kind: "Race", status: race?.status || "unknown", startsAt: race?.startsAt || "" }];
  }
  function canLoadReplayRace(race) {
    return Boolean(race && (race.status === "done" || trackMapReplaySessionOptions(race).some((session) => session.status === "done")));
  }
  function formatReplayClock(seconds) {
    const value = Math.max(0, Math.floor(Number(seconds || 0)));
    const h = Math.floor(value / 3600);
    const m = Math.floor((value % 3600) / 60);
    const s = value % 60;
    return h ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}` : `${m}:${String(s).padStart(2, "0")}`;
  }
  function distanceToSegment(p, a, b) {
    const vx = b[0] - a[0], vy = b[1] - a[1];
    const wx = p.x - a[0], wy = p.y - a[1];
    const len2 = vx * vx + vy * vy || 1;
    const t = Math.max(0, Math.min(1, (wx * vx + wy * vy) / len2));
    const x = a[0] + vx * t, y = a[1] + vy * t;
    return { x, y, t, d: Math.hypot(p.x - x, p.y - y) };
  }
  // Nearest point on the closed track polyline, with the along-path distance s.
  // An optional hint { s, total, window } keeps the snap on the car's current
  // track leg when an almost-as-close segment elsewhere (e.g. the opposite leg
  // of a hairpin) would otherwise capture it.
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
        if (Number.isFinite(zExp)) cost += Math.min(Math.abs(zInfo.z - zExp) * zInfo.weight, TRACK_MAP_Z_PENALTY_MAX_PX);
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
  // Official Formula 1 telemetry uses a session-local coordinate frame that is
  // rotated by an arbitrary angle relative to the drawn OSM centerline. Axis
  // flips/swaps alone leave whole track sections up to ~130px off the road, and
  // snapping that weaving trace makes cars slide backwards through corners and
  // leap over apexes. Fit a full similarity transform instead:
  // mirror -> rotate -> uniform scale -> translate.
  //
  // Scoring blends mean distance to the track polyline with a driving-direction
  // penalty: the sample is a time-ordered single-driver trace, and a candidate
  // whose consecutive points move backwards along the polyline is a
  // direction-reversed overlay. On elongated circuits a reversed overlay can
  // beat the true one on distance alone (the two long sides land on each
  // other), so distance-only scoring is not enough.
  function applyOfficialFit(point, fit) {
    const mx = (point.x - fit.scx) * (fit.mirror ? -1 : 1);
    const my = point.y - fit.scy;
    return {
      x: (fit.cos * mx - fit.sin * my) * fit.scale + fit.tx,
      y: (fit.sin * mx + fit.cos * my) * fit.scale + fit.ty,
    };
  }
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
  function fitOfficialSimilarity(points, trackPts) {
    let scx = 0, scy = 0;
    points.forEach((p) => { scx += p.x; scy += p.y; });
    scx /= points.length; scy /= points.length;
    let sr = 0;
    points.forEach((p) => { sr += (p.x - scx) ** 2 + (p.y - scy) ** 2; });
    sr = Math.sqrt(sr / points.length) || 1;
    let tcx = 0, tcy = 0;
    trackPts.forEach((p) => { tcx += p[0]; tcy += p[1]; });
    tcx /= trackPts.length; tcy /= trackPts.length;
    let tr = 0;
    trackPts.forEach((p) => { tr += (p[0] - tcx) ** 2 + (p[1] - tcy) ** 2; });
    tr = Math.sqrt(tr / trackPts.length) || 1;
    const baseScale = tr / sr;
    if (!Number.isFinite(baseScale) || baseScale <= 0) return null;
    const BACKWARD_PENALTY_PX = 40;
    const score = (fit, sample) => {
      let sum = 0, backward = 0, pairs = 0, lastS = null;
      for (const p of sample) {
        const snapped = nearestTrackPoint(applyOfficialFit(p, fit), trackPts);
        sum += snapped.d;
        if (lastS != null) {
          let ds = snapped.s - lastS;
          if (ds < -snapped.total / 2) ds += snapped.total;
          if (ds > snapped.total / 2) ds -= snapped.total;
          if (Math.abs(ds) > 2) {
            pairs += 1;
            if (ds < 0) backward += 1;
          }
        }
        lastS = snapped.s;
      }
      return sum / sample.length + (pairs ? (backward / pairs) * BACKWARD_PENALTY_PX : 0);
    };
    const makeFit = (mirror, deg, scale, tx, ty) => {
      const rad = (deg * Math.PI) / 180;
      return { mirror, deg, cos: Math.cos(rad), sin: Math.sin(rad), scale, scx, scy, tx, ty };
    };
    const coarseStep = Math.max(1, Math.floor(points.length / 60));
    const coarseSample = points.filter((_, index) => index % coarseStep === 0);
    let best = null;
    [false, true].forEach((mirror) => {
      for (let deg = 0; deg < 360; deg += 6) {
        const fit = makeFit(mirror, deg, baseScale, tcx, tcy);
        const value = score(fit, coarseSample);
        if (!best || value < best.score) best = { fit, score: value };
      }
    });
    if (!best) return null;
    const refine = (degSpan, degStep, scales) => {
      const current = best.fit;
      for (let deg = current.deg - degSpan; deg <= current.deg + degSpan + 1e-9; deg += degStep) {
        for (const scale of scales) {
          if (deg === current.deg && scale === current.scale) continue;
          const fit = makeFit(current.mirror, deg, scale, current.tx, current.ty);
          const value = score(fit, points);
          if (value < best.score) best = { fit, score: value };
        }
      }
    };
    refine(6, 1, [best.fit.scale]);
    refine(1, 0.25, [best.fit.scale]);
    for (let pass = 0; pass < 2; pass += 1) {
      let dx = 0, dy = 0;
      points.forEach((p) => {
        const projected = applyOfficialFit(p, best.fit);
        const snapped = nearestTrackPoint(projected, trackPts);
        dx += snapped.x - projected.x;
        dy += snapped.y - projected.y;
      });
      const shifted = { ...best.fit, tx: best.fit.tx + dx / points.length, ty: best.fit.ty + dy / points.length };
      const shiftedScore = score(shifted, points);
      if (shiftedScore < best.score) best = { fit: shifted, score: shiftedScore };
      refine(0, 1, [0.97, 0.98, 0.99, 1.01, 1.02, 1.03].map((k) => k * best.fit.scale));
      refine(0.75, 0.25, [best.fit.scale]);
    }
    return best;
  }
  const TRACK_MAP_FIT_MAX_AVG_PX = 45;
  const officialFitCache = new Map();
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

  /* ====================================================================== */
  /* Live-data parsing: derive car spacing from gap/interval strings.       */
  /* ====================================================================== */
  function lapSeconds(str) {
    if (!str) return 0;
    const m = String(str).match(/(?:(\d+):)?(\d+(?:\.\d+)?)/);
    if (!m) return 0;
    return parseInt(m[1] || 0, 10) * 60 + parseFloat(m[2]);
  }
  function gapSeconds(str, lapT) {
    if (!str || /leader/i.test(str)) return 0;
    const lap = String(str).match(/(\d+)\s*lap/i);
    if (lap) return parseInt(lap[1], 10) * lapT;
    const n = parseFloat(String(str).replace(/[^0-9.]/g, ""));
    return Number.isFinite(n) ? n : 0;
  }
  // Tyre compound -> single letter ("soft"/"S" both -> "S").
  function tyreLetter(comp) {
    return comp ? String(comp).trim().charAt(0).toUpperCase() : "";
  }

  /* ====================================================================== */
  /* Geometry: build the drawable map from a real circuit outline.          */
  /*   - road path is the actual centerline polyline (closed)               */
  /*   - corners detected by path curvature, capped to the official count   */
  /*   - main straight / start-finish and sector thirds derived            */
  /* ====================================================================== */
  function linePath(pts, closed) {
    if (!pts.length) return "";
    let d = `M ${pts[0][0]} ${pts[0][1]}`;
    for (let i = 1; i < pts.length; i++) d += ` L ${pts[i][0]} ${pts[i][1]}`;
    if (closed) d += " Z";
    return d;
  }
  // Cluster vertices satisfying pred() into contiguous runs, starting the scan in
  // a gap so no run is split across the array seam. Returns [{startK,endK}] in a
  // scan space where the real index of step k is idxAt(k).
  function clusters(n, pred) {
    let guard = 0;
    while (guard < n && pred(guard % n)) guard++;
    if (guard === n) return { runs: [{ startK: 0, endK: n - 1 }], base: 0 };
    const runs = [];
    let k = guard;
    while (k < guard + n) {
      if (pred(k % n)) {
        let kk = k;
        while (kk < guard + n && pred(kk % n)) kk++;
        runs.push({ startK: k, endK: kk - 1 });
        k = kk;
      } else k++;
    }
    return { runs, base: guard };
  }

  const LABEL_GAP = 27;

  function buildGeom(circuit) {
    const pts = circuit.points;
    const n = pts.length;
    const idxAt = (k) => ((k % n) + n) % n;
    const d = linePath(pts, true);

    // centroid + segment lengths
    let cx = 0, cy = 0;
    pts.forEach((p) => { cx += p[0]; cy += p[1]; });
    cx /= n; cy /= n;
    const seg = new Array(n), cum = new Array(n);
    let total = 0;
    for (let i = 0; i < n; i++) { const a = pts[i], b = pts[(i + 1) % n]; seg[i] = Math.hypot(b[0] - a[0], b[1] - a[1]); }
    { let s = 0; for (let i = 0; i < n; i++) { cum[i] = s; s += seg[i]; } total = s; }

    // signed deflection (deg) at each vertex
    const defl = new Array(n);
    for (let i = 0; i < n; i++) {
      const p0 = pts[idxAt(i - 1)], p1 = pts[i], p2 = pts[idxAt(i + 1)];
      let a1 = Math.atan2(p1[1] - p0[1], p1[0] - p0[0]);
      let a2 = Math.atan2(p2[1] - p1[1], p2[0] - p1[0]);
      let da = (a2 - a1) * 180 / Math.PI;
      while (da > 180) da -= 360; while (da < -180) da += 360;
      defl[i] = da;
    }
    // outward normal at a vertex: perpendicular to tangent, away from centroid
    function outwardAt(i) {
      const p0 = pts[idxAt(i - 1)], p2 = pts[idxAt(i + 1)];
      let tx = p2[0] - p0[0], ty = p2[1] - p0[1];
      const m = Math.hypot(tx, ty) || 1; tx /= m; ty /= m;
      let nx = -ty, ny = tx;
      if ((pts[i][0] - cx) * nx + (pts[i][1] - cy) * ny < 0) { nx = -nx; ny = -ny; }
      return [nx, ny];
    }

    // ---- corners: local maxima of windowed bend (density-independent) ----
    // Sum the signed deflection over a fixed arc window around each vertex, then
    // pick local maxima of |bend| separated by a minimum arc length. This finds
    // one apex per corner and separates closely-spaced corners (chicanes).
    const ARC = total * 0.012;
    const bendAt = new Array(n);
    for (let i = 0; i < n; i++) {
      let d = 0, acc = 0, k = i;
      while (acc < ARC / 2) { acc += seg[idxAt(k)]; d += defl[idxAt(k + 1)]; k++; if (acc > total) break; }
      let db = 0, bcc = 0, k2 = i;
      while (bcc < ARC / 2) { k2--; bcc += seg[idxAt(k2)]; db += defl[idxAt(k2)]; if (bcc > total) break; }
      bendAt[i] = Math.abs(d + db);
    }
    const THm = 7, sep = total * 0.016, win = 2;
    const cand = [];
    for (let i = 0; i < n; i++) {
      let isMax = true;
      for (let w = -win; w <= win; w++) { if (bendAt[idxAt(i + w)] > bendAt[i]) { isMax = false; break; } }
      if (isMax && bendAt[i] > THm) cand.push({ apex: i, bend: bendAt[i] });
    }
    cand.sort((a, b) => b.bend - a.bend);
    let cornersRaw = [];
    for (const c of cand) {
      if (cornersRaw.every((k) => { let dd = Math.abs(cum[k.apex] - cum[c.apex]); dd = Math.min(dd, total - dd); return dd > sep; })) cornersRaw.push(c);
    }
    // cap to the official corner count (keep the sharpest)
    const maxC = circuit.facts && circuit.facts.corners;
    if (maxC && cornersRaw.length > maxC) cornersRaw = cornersRaw.slice().sort((a, b) => b.bend - a.bend).slice(0, maxC);

    // ---- straights (low curvature runs) -> main straight, S/F ----
    const sc = clusters(n, (i) => Math.abs(defl[i]) < 3);
    const straights = sc.runs.map((r) => {
      let len = 0; for (let k = r.startK; k <= r.endK; k++) len += seg[idxAt(k)];
      return { startK: r.startK, endK: r.endK, startIdx: idxAt(r.startK), endIdx: idxAt(r.endK), midIdx: idxAt(Math.round((r.startK + r.endK) / 2)), len };
    }).sort((a, b) => b.len - a.len);

    const main = straights[0];
    const sfIndex = main ? idxAt(Math.round(main.startK + (main.endK - main.startK) * 0.82)) : 0;

    // ---- number corners from S/F in driving order ----
    cornersRaw.sort((a, b) => ((a.apex - sfIndex + n) % n) - ((b.apex - sfIndex + n) % n));
    const turnNames = circuit.turnNames || {};
    const nameForTurn = (num) => Array.isArray(turnNames) ? turnNames[num - 1] : turnNames[num];
    const turns = cornersRaw.map((c, ci) => {
      const o = outwardAt(c.apex);
      return { n: ci + 1, name: nameForTurn(ci + 1) || "", x: pts[c.apex][0], y: pts[c.apex][1], o, lx: pts[c.apex][0] + o[0] * LABEL_GAP, ly: pts[c.apex][1] + o[1] * LABEL_GAP, showName: false, nameX: 0, nameY: 0, nameHalfW: 0 };
    });

    // ---- sectors: thirds of the lap from S/F ----
    function idxAtDistance(frac) {
      const target = (cum[sfIndex] + frac * total) % total;
      let best = 0, bd = 1e9;
      for (let j = 0; j < n; j++) { let dd = Math.abs(cum[j] - target); dd = Math.min(dd, total - dd); if (dd < bd) { bd = dd; best = j; } }
      return best;
    }
    const sectors = [2, 3].map((s) => { const idx = idxAtDistance((s - 1) / 3); return { s, x: pts[idx][0], y: pts[idx][1], out: outwardAt(idx) }; });

    // ---- start / finish ----
    const startNode = { pt: pts[sfIndex], out: outwardAt(sfIndex) };

    // ---- corner-name placement: collision-aware, outward-biased -----------
    // Each name is laid out one at a time. It tries a ring of candidate boxes
    // around its badge — most-outward direction first — and takes the first
    // that clears every badge, every fixed marker (START / sector), the
    // road itself, and every name already placed. Consecutive turns sharing a
    // name (chicanes) are labelled once across the run. If nothing fits, the
    // name is dropped and only the numbered badge remains.
    const NAME_H = 14, BADGE_R = 11;
    const nameHalfW = (s) => Math.max(11, (s.length * 5.6 + 8) / 2);
    const rectsHit = (a, b, m) => Math.abs(a.x - b.x) < a.hw + b.hw + m && Math.abs(a.y - b.y) < a.hh + b.hh + m;
    const ptHit = (px, py, r, m) => Math.abs(px - r.x) < r.hw + m && Math.abs(py - r.y) < r.hh + m;

    const trackSamples = [];
    { const step = Math.max(1, Math.floor(n / 200)); for (let i = 0; i < n; i += step) trackSamples.push(pts[i]); }

    const badgeRects = turns.map((t) => ({ x: t.lx, y: t.ly, hw: BADGE_R + 2, hh: BADGE_R + 2 }));
    const fixedRects = [];
    if (startNode) fixedRects.push({ x: startNode.pt[0] + startNode.out[0] * 34, y: startNode.pt[1] + startNode.out[1] * 34, hw: 27, hh: 13 });
    sectors.forEach((s) => fixedRects.push({ x: s.x + s.out[0] * 24, y: s.y + s.out[1] * 24, hw: 13, hh: 10 }));

    const DIRS = [[0, 1], [0.71, 0.71], [-0.71, 0.71], [1, 0], [-1, 0], [0.71, -0.71], [-0.71, -0.71], [0, -1]];
    const placedNames = [];

    let gi = 0;
    while (gi < turns.length) {
      const nm = turns[gi].name;
      if (!nm) { gi++; continue; }
      let gj = gi;
      while (gj + 1 < turns.length && turns[gj + 1].name === nm) gj++;
      const members = turns.slice(gi, gj + 1);
      let ax = 0, ay = 0, ox = 0, oy = 0;
      members.forEach((m) => { ax += m.lx; ay += m.ly; ox += m.o[0]; oy += m.o[1]; });
      ax /= members.length; ay /= members.length;
      const om = Math.hypot(ox, oy) || 1; ox /= om; oy /= om;
      const hw = nameHalfW(nm), hh = NAME_H / 2;

      const cands = [];
      for (const dvec of DIRS) {
        const align = dvec[0] * ox + dvec[1] * oy;
        for (const ext of [0, 9, 20]) {
          const reach = BADGE_R + 6 + ext + Math.abs(dvec[0]) * hw + Math.abs(dvec[1]) * hh;
          cands.push({ box: { x: ax + dvec[0] * reach, y: ay + dvec[1] * reach, hw, hh }, align, ext });
        }
      }
      cands.sort((a, b) => (b.align - a.align) || (a.ext - b.ext));

      let chosen = null;
      for (const c of cands) {
        let bad = false;
        for (const r of badgeRects) { if (rectsHit(c.box, r, 1)) { bad = true; break; } }
        if (!bad) for (const r of fixedRects) { if (rectsHit(c.box, r, 1)) { bad = true; break; } }
        if (!bad) for (const r of placedNames) { if (rectsHit(c.box, r, 2)) { bad = true; break; } }
        if (!bad) for (const s of trackSamples) { if (ptHit(s[0], s[1], c.box, 2)) { bad = true; break; } }
        if (!bad) { chosen = c.box; break; }
      }
      members.forEach((m) => { m.showName = false; });
      if (chosen) {
        placedNames.push(chosen);
        members[0].showName = true;
        members[0].nameX = chosen.x;
        members[0].nameY = chosen.y;
        members[0].nameHalfW = hw;
      }
      gi = gj + 1;
    }

    // ---- viewBox fit (track + outward labels) ----
    let minX = 1e9, minY = 1e9, maxX = -1e9, maxY = -1e9;
    const acc = (x, y) => { minX = Math.min(minX, x); minY = Math.min(minY, y); maxX = Math.max(maxX, x); maxY = Math.max(maxY, y); };
    pts.forEach((p) => acc(p[0], p[1]));
    turns.forEach((t) => {
      acc(t.lx - BADGE_R, t.ly - BADGE_R); acc(t.lx + BADGE_R, t.ly + BADGE_R);
      if (t.showName) { acc(t.nameX - t.nameHalfW, t.nameY - NAME_H / 2); acc(t.nameX + t.nameHalfW, t.nameY + NAME_H / 2); }
    });
    const pad = 34;
    const vb = `${(minX - pad).toFixed(1)} ${(minY - pad).toFixed(1)} ${(maxX - minX + pad * 2).toFixed(1)} ${(maxY - minY + pad * 2).toFixed(1)}`;

    return { d, points: pts, turns, sectors, startNode, vb };
  }

  function buildTrackMapInvariantModel(data, selectedRaceKey) {
    const races = Array.isArray(data.schedule) ? data.schedule : [];
    const liveRace = races.find((race) => race.status === "live") || null;
    const liveSession = (Array.isArray(data.sessions) ? data.sessions : []).find((session) => session.status === "live") || null;
    const live = (Array.isArray(data.timing) ? data.timing.length : 0) > 0 && Boolean(liveRace || liveSession);
    const upcomingRace = races.find((race) => race.status === "upcoming") || null;
    const latestCompletedRace = races.filter((race) => race.status === "done").at(-1) || null;
    const autoRace = liveRace || upcomingRace || latestCompletedRace || races[0] || null;
    const selectedRace = selectedRaceKey
      ? races.find((race) => raceKey(race) === selectedRaceKey) || autoRace
      : autoRace;
    const liveRaceKey = raceKey(liveRace);
    const selectedRaceValue = raceKey(selectedRace);
    const mapLive = live && (!selectedRaceKey || selectedRaceKey === liveRaceKey);
    const circuit = resolveCircuit(mapLive ? data.race : selectedRace) || (mapLive ? resolveCircuit(data.race) : null);
    const replaySessionOptions = trackMapReplaySessionOptions(selectedRace);
    const raceSession = (selectedRace?.sessions || []).find((session) => /race/i.test(session.kind) && !/sprint/i.test(session.kind)) || null;
    return {
      races,
      selectedRace,
      selectedRaceValue,
      mapLive,
      circuit,
      replaySessionOptions,
      raceSession,
      canLoadReplay: canLoadReplayRace(selectedRace),
    };
  }

  /* ====================================================================== */
  /* SVG renderer (consumes a prebuilt geom).                               */
  /* ====================================================================== */
  function TrackMapView({ geom, mode, layers, cars, focusCode, onFocus, selectedTurn, onSelectTurn, speed = 1, paused = false, trackPositionBounds = null, trackPositionSample = null, lapPaceSeconds = 0 }) {
    const pathRef = useRef(null);
    const carRefs = useRef({});
    const carsRef = useRef(cars);
    const motionRef = useRef({});
    const projectorRef = useRef(null);
    const officialProjector = useMemo(() => officialPositionProjector(cars, geom, trackPositionBounds, trackPositionSample), [cars, geom, trackPositionBounds, trackPositionSample]);
    useEffect(() => {
      carsRef.current = cars;
      projectorRef.current = officialProjector;
    }, [cars, officialProjector]);

    // Position + animate cars. Cars are PLACED immediately via a timer-based retry
    // (runs even when rAF is throttled), then rAF drives smooth motion in foreground.
    //
    // Motion lives in s-space: each car tracks its distance along the track
    // centerline, eases toward a dead-reckoned target with velocity-continuous
    // exponential smoothing, and renders via getPointAtLength — so dots always
    // sit on the road and follow it through corners instead of gliding across
    // them in straight lines.
    const stateRef = useRef({ u: 0 });
    useEffect(() => {
      if (mode !== "live") return;
      let raf, timer, killed = false, prev = null;
      const lapViewSeconds = Math.max(8, lapPaceSeconds || 16) / Math.max(0.15, speed);
      const st = stateRef.current;
      const pts = geom.points;
      let trackTotal = 0;
      for (let i = 0; i < pts.length; i++) {
        const a = pts[i], b = pts[(i + 1) % pts.length];
        trackTotal += Math.hypot(b[0] - a[0], b[1] - a[1]);
      }
      const maxV = (trackTotal / Math.max(30, lapPaceSeconds || 80)) * 2.5;
      const wrapMod = (s) => ((s % trackTotal) + trackTotal) % trackTotal;
      const wrapDelta = (d) => {
        const m = wrapMod(d);
        return m > trackTotal * 0.85 ? m - trackTotal : m; // forward-biased: cars race forward
      };
      const place = (u, now = performance.now()) => {
        const path = pathRef.current, L = path && path.getTotalLength();
        if (!L || !trackTotal) return false;
        const cars = carsRef.current;
        const projectOfficialPosition = projectorRef.current;
        const activeCodes = new Set(cars.map((car) => car.code));
        cars.forEach((c) => {
          const el = carRefs.current[c.code];
          if (!el) return;
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
          const official = snap && snap.d <= TRACK_MAP_SNAP_MAX_DIST_PX ? snap : null;
          const fallbackS = ((u - c.frac + 1) % 1) * trackTotal;
          const dataAtMs = Date.parse(c.trackPosition?.date || "");
          if (!motion) {
            const startS = official ? official.s : fallbackS;
            motion = { s: startS, v: 0, targetS: startS, targetAt: now, frameAt: now, dataAtMs };
          }
          const dtFrame = Math.max(0, Math.min(0.1, (now - motion.frameAt) / 1000));
          motion.frameAt = now;
          if (official) {
            const dTarget = wrapDelta(official.s - wrapMod(motion.targetS));
            if (Math.abs(dTarget) > TRACK_MAP_OFFICIAL_TELEPORT_PX) {
              // Seek or data resume: jump rather than racing around the lap.
              motion.targetS += dTarget;
              motion.s = motion.targetS;
              motion.v = 0;
              motion.targetAt = now;
              motion.dataAtMs = dataAtMs;
            } else if (Math.abs(dTarget) > 0.5) {
              // Speed comes from the data clock when the packet carries one:
              // wall-clock gaps between poll arrivals overestimate velocity
              // when snapshots arrive in bursts, dead-reckoning past the car
              // and rubber-banding it backwards on the next update.
              const dtData = Number.isFinite(dataAtMs) && Number.isFinite(motion.dataAtMs)
                ? (dataAtMs - motion.dataAtMs) / 1000
                : 0;
              const dtTarget = dtData > 0.04 ? dtData : Math.max(0.05, (now - motion.targetAt) / 1000);
              motion.v = Math.max(0, Math.min(maxV, dTarget / dtTarget));
              motion.targetS += dTarget;
              motion.targetAt = now;
              motion.dataAtMs = dataAtMs;
            }
            const sinceTarget = now - motion.targetAt;
            const reckonSec = paused || sinceTarget > TRACK_MAP_TARGET_STALL_MS
              ? 0
              : Math.min(sinceTarget, TRACK_MAP_DEAD_RECKON_MAX_MS) / 1000;
            const predictedS = motion.targetS + motion.v * reckonSec;
            motion.s += (predictedS - motion.s) * (1 - Math.exp(-dtFrame * 1000 / TRACK_MAP_MOTION_TAU_MS));
          } else {
            // No usable official point: ease toward the gap-spaced fallback slot.
            const dFallback = wrapDelta(fallbackS - wrapMod(motion.s));
            if (Math.abs(dFallback) > TRACK_MAP_OFFICIAL_TELEPORT_PX * 2) motion.s += dFallback;
            else motion.s += dFallback * (1 - Math.exp(-dtFrame * 1000 / TRACK_MAP_FALLBACK_TAU_MS));
            motion.targetS = motion.s;
            motion.v = 0;
            motion.targetAt = now;
          }
          motionRef.current[c.code] = motion;
          const sMod = wrapMod(motion.s);
          const pt = path.getPointAtLength((sMod / trackTotal) * L);
          const back = path.getPointAtLength((wrapMod(sMod - 9) / trackTotal) * L);
          el.style.transform = `translate(${pt.x.toFixed(2)}px, ${pt.y.toFixed(2)}px)`;
          const trail = el.querySelector(".tm-car__trail");
          if (trail) { trail.setAttribute("x2", (back.x - pt.x).toFixed(2)); trail.setAttribute("y2", (back.y - pt.y).toFixed(2)); }
        });
        Object.keys(motionRef.current).forEach((code) => { if (!activeCodes.has(code)) delete motionRef.current[code]; });
        return true;
      };
      const ensurePlaced = () => { if (killed) return; if (!place(st.u)) timer = setTimeout(ensurePlaced, 30); };
      ensurePlaced();
      const tick = (ts) => {
        if (killed) return;
        if (prev == null) prev = ts;
        const dt = Math.min(0.05, (ts - prev) / 1000); prev = ts;
        if (!paused) st.u = (st.u + dt / lapViewSeconds) % 1;
        place(st.u);
        raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
      return () => { killed = true; cancelAnimationFrame(raf); clearTimeout(timer); };
    }, [mode, speed, paused, geom, lapPaceSeconds]);

    const { turns: showTurns, names: showNames, sectors: showSectors } = layers;
    const roadW = 15, surfW = 10.5;

    return (
      <svg className="tm-svg" viewBox={geom.vb} preserveAspectRatio="xMidYMid meet">
        <defs>
          <filter id="tm-glow" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="6" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>

        <path ref={pathRef} d={geom.d} fill="none" stroke="#000" strokeWidth={roadW + 6} strokeLinejoin="round" opacity="0.55" />
        <path d={geom.d} fill="none" stroke="var(--ink-500)" strokeWidth={roadW} strokeLinejoin="round" strokeLinecap="round" />
        <path d={geom.d} fill="none" stroke="#0c0f15" strokeWidth={surfW} strokeLinejoin="round" strokeLinecap="round" />
        <path d={geom.d} fill="none" stroke="rgba(244,246,251,0.22)" strokeWidth="1.4" strokeDasharray="1.5 11" strokeLinecap="round" />

        {showSectors && geom.sectors.map((s, i) => (
          <g key={"sec" + i}>
            <line x1={s.x - s.out[1] * 13} y1={s.y + s.out[0] * 13} x2={s.x + s.out[1] * 13} y2={s.y - s.out[0] * 13}
              stroke="var(--accent)" strokeWidth="2.5" strokeLinecap="round" opacity="0.8" />
            <g transform={`translate(${s.x + s.out[0] * 24}, ${s.y + s.out[1] * 24})`}>
              <rect x="-12" y="-9" width="24" height="18" rx="5" fill="var(--bg-3)" stroke="var(--accent-border)" strokeWidth="1" />
              <text x="0" y="1" className="tm-sectext" textAnchor="middle" dominantBaseline="middle">S{s.s}</text>
            </g>
          </g>
        ))}

        {layers.start && geom.startNode && (() => {
          const { pt, out } = geom.startNode;
          const tx = -out[1], ty = out[0], half = roadW / 2 + 3;
          const ax = pt[0] + tx * half, ay = pt[1] + ty * half, bx = pt[0] - tx * half, by = pt[1] - ty * half;
          return (
            <g>
              <line x1={ax} y1={ay} x2={bx} y2={by} stroke="#f4f6fb" strokeWidth="6" strokeLinecap="butt" />
              <line x1={ax} y1={ay} x2={bx} y2={by} stroke="#11141b" strokeWidth="6" strokeLinecap="butt" strokeDasharray="3 3" />
              <g transform={`translate(${pt[0] + out[0] * 34}, ${pt[1] + out[1] * 34})`}>
                <rect x="-26" y="-12" width="52" height="24" rx="6" fill="var(--bg-3)" stroke="var(--border-strong)" strokeWidth="1" />
                <text x="0" y="1" className="tm-sftext" textAnchor="middle" dominantBaseline="middle">START</text>
              </g>
            </g>
          );
        })()}

        {showTurns && geom.turns.map((t) => {
          const active = selectedTurn === t.n;
          return (
            <g key={t.n} className="tm-turn" data-active={active} onClick={() => onSelectTurn && onSelectTurn(active ? null : t.n)}>
              <line x1={t.x} y1={t.y} x2={t.lx} y2={t.ly} className="tm-turn__lead" />
              <circle cx={t.x} cy={t.y} r="3.4" className="tm-turn__dot" />
              <g transform={`translate(${t.lx}, ${t.ly})`}>
                <circle r="11" className="tm-turn__badge" />
                <text x="0" y="1" className="tm-turn__num" textAnchor="middle" dominantBaseline="middle">{t.n}</text>
              </g>
              {showNames && t.showName && t.name && (
                <text x={t.nameX} y={t.nameY} className="tm-turn__name" textAnchor="middle" dominantBaseline="middle">{t.name}</text>
              )}
            </g>
          );
        })}

        {mode === "live" && (
          <g>
            {cars.map((c) => {
              const focused = focusCode === c.code, dim = focusCode && !focused;
              return (
                <g key={c.code} className="tm-car" data-focused={focused} data-dim={dim}
                  ref={(el) => (carRefs.current[c.code] = el)} onClick={() => onFocus && onFocus(focused ? null : c.code)}>
                  <line className="tm-car__trail" x1="0" y1="0" x2="0" y2="0" stroke={c.color} strokeWidth="4" strokeLinecap="round" opacity="0.5" />
                  <circle r="11" className="tm-car__halo" fill={c.color} />
                  <circle r="9.4" className="tm-car__body" fill={c.color} stroke="#0a0c11" strokeWidth="1.7" />
                  <text className="tm-car__num" textAnchor="middle" dominantBaseline="middle">{c.num}</text>
                  {(focused || c.pos <= 3) && (
                    <g className="tm-car__tag" transform="translate(13,-13)">
                      <rect x="0" y="-9" width={focused ? 64 : 30} height="18" rx="5" fill="var(--bg-3)" stroke={c.color} strokeWidth="1.2" />
                      <text x="6" y="1" className="tm-car__code" dominantBaseline="middle" style={{ fill: c.color }}>{c.code}</text>
                      {focused && <text x="34" y="1" className="tm-car__gap" dominantBaseline="middle">{c.gap === "LEADER" ? "P1" : c.gap}</text>}
                    </g>
                  )}
                </g>
              );
            })}
          </g>
        )}
      </svg>
    );
  }

  /* ====================================================================== */
  /* Header.                                                                */
  /* ====================================================================== */
  function useCountdown(iso) {
    const [now, setNow] = useState(() => Date.now());
    useEffect(() => { const id = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(id); }, []);
    const ms = Date.parse(iso) - now;
    return {
      d: Math.max(0, Math.floor(ms / 86400000)),
      h: Math.max(0, Math.floor((ms % 86400000) / 3600000)),
      m: Math.max(0, Math.floor((ms % 3600000) / 60000)),
      valid: Number.isFinite(ms),
    };
  }
  const Seg = ({ n, l }) => (
    <div className="tm-cd__seg"><span className="tm-cd__n">{String(n).padStart(2, "0")}</span><span className="tm-cd__l">{l}</span></div>
  );

  function RaceSelector({ races, selectedRaceKey, onSelectRace }) {
    if (!races.length) return null;
    return (
      <label className="tm-raceselect" aria-label="Select track map race">
        <Icon name="calendar" size={14} />
        <select className="tm-raceselect__select" value={selectedRaceKey} onChange={(event) => onSelectRace(event.target.value)}>
          {races.map((race) => <option key={raceKey(race)} value={raceKey(race)}>{raceLabel(race)}</option>)}
        </select>
        <span className="tm-raceselect__chev"><Icon name="chevronDown" size={14} /></span>
      </label>
    );
  }

  function useReplayElapsedClock(elapsedClock, fallbackSeconds = 0) {
    const [elapsedSeconds, setElapsedSeconds] = useState(() => elapsedClock?.getElapsedSeconds() ?? fallbackSeconds);
    useEffect(() => {
      if (!elapsedClock) {
        setElapsedSeconds(fallbackSeconds);
        return undefined;
      }
      setElapsedSeconds(elapsedClock.getElapsedSeconds());
      return elapsedClock.subscribe(setElapsedSeconds);
    }, [elapsedClock, fallbackSeconds]);
    return elapsedSeconds;
  }

  function ReplayProgress({ replay, onSeekReplay, elapsedClock }) {
    const visualElapsedSeconds = useReplayElapsedClock(elapsedClock, replay?.elapsedSeconds || 0);
    if (!replay?.active && !replay?.loading) return null;
    const duration = Math.max(1, Math.round(Number(replay?.data?.durationSeconds || replay?.durationSeconds || 1)));
    const elapsed = Math.max(0, Math.min(duration, Math.round(Number(visualElapsedSeconds || 0))));
    const lap = replay?.data?.sessionClock?.lapCount?.lap || "";
    const laps = replay?.data?.sessionClock?.lapCount?.laps || "";
    const label = lap ? `L${lap}/${laps || "-"}` : formatReplayClock(elapsed);
    return (
      <label className="tm-replayprogress" aria-label="Replay race progress">
        <span className="tm-replayprogress__label">{label}</span>
        <input className="tm-replayprogress__range" type="range" min="0" max={duration} value={elapsed}
          onChange={(event) => onSeekReplay(Number(event.target.value))} />
      </label>
    );
  }

  function staticTrackMapPropsEqual(previous, next) {
    const previousKeys = Object.keys(previous);
    const nextKeys = Object.keys(next);
    return previousKeys.length === nextKeys.length
      && previousKeys.every((key) => Object.is(previous[key], next[key]));
  }

  function staticTrackMapSessionControlsEqual(previous, next) {
    return previous.races === next.races
      && previous.selectedRaceKey === next.selectedRaceKey
      && previous.replayActive === next.replayActive
      && previous.replayLoading === next.replayLoading
      && previous.canLoadReplay === next.canLoadReplay;
  }

  function HeaderIdentity({ round, gp, name, loc }) {
    return (
      <div className="tm-head__id">
        {round ? <div className="tm-head__round">Round {round} · 2026</div> : null}
        <h1 className="tm-head__gp">{gp || name || "Track Map"}</h1>
        <div className="tm-head__circuit"><Icon name="pin" size={13} /> {[name, loc].filter(Boolean).join(" · ")}</div>
      </div>
    );
  }
  const MemoizedHeaderIdentity = React.memo(HeaderIdentity, staticTrackMapPropsEqual);

  function HeaderSessionControls({ races, selectedRaceKey, replayActive, replayLoading, canLoadReplay, onSelectRace, onLoadReplay }) {
    return (
      <>
        <RaceSelector races={races} selectedRaceKey={selectedRaceKey} onSelectRace={onSelectRace} />
        {!replayActive && (
          <button className="tm-replaybtn" type="button" disabled={!canLoadReplay || replayLoading} onClick={onLoadReplay}>
            <Icon name="play" size={14} /> {replayLoading ? "Loading..." : "Load replay"}
          </button>
        )}
      </>
    );
  }
  const MemoizedHeaderSessionControls = React.memo(HeaderSessionControls, staticTrackMapSessionControlsEqual);

  function HeaderSessionStatus({ live, replayActive, race, countdownTarget, raceStartLabel }) {
    const cd = useCountdown(countdownTarget);
    const wx = (race && race.weather) || {};
    const flag = (race && race.flag) || "green";
    return (
      <>
        {live ? (
          <>
            <div className="tm-statline">
              <span className="pw-badge pw-badge--live tm-livebadge"><span className="tm-livedot" />{replayActive ? "REPLAY" : "LIVE"}</span>
              <span className="tm-flag" style={{ color: FLAG_VAR[flag] || "var(--flag-green)" }}>{FLAG_LABEL[flag] || "GREEN FLAG"}</span>
            </div>
            <div className="tm-lap">
              <span className="tm-lap__big">{race.lap}</span>
              <span className="tm-lap__sml">/ {race.laps}</span>
              <span className="tm-lap__lbl">LAP · RACE</span>
            </div>
            <div className="tm-wx">
              {wx.air !== "" && wx.air != null && <span><Icon name="thermometer" size={12} /> Air {wx.air}°</span>}
              {wx.track !== "" && wx.track != null && <span><Icon name="gauge" size={12} /> Track {wx.track}°</span>}
              {wx.cond && <span className="tm-wx__dry">{wx.cond}</span>}
            </div>
          </>
        ) : (
          <>
            <div className="tm-statline"><span className="pw-badge pw-badge--accent">NEXT ROUND</span></div>
            {cd.valid && <div className="tm-cd"><Seg n={cd.d} l="DAYS" /><Seg n={cd.h} l="HRS" /><Seg n={cd.m} l="MIN" /></div>}
            {raceStartLabel && <div className="tm-wx"><span>{raceStartLabel}</span></div>}
          </>
        )}
      </>
    );
  }
  const MemoizedHeaderSessionStatus = React.memo(HeaderSessionStatus, staticTrackMapPropsEqual);

  function Header({ round, gp, name, loc, live, replay, race, countdownTarget, raceStartLabel, races, selectedRaceKey, onSelectRace, canLoadReplay, onLoadReplay, onSeekReplay, elapsedClock }) {
    return (
      <div className="tm-head">
        <MemoizedHeaderIdentity round={round} gp={gp} name={name} loc={loc} />
        <div className="tm-head__status">
          <div className="tm-head__actions">
            <ReplayProgress replay={replay} onSeekReplay={onSeekReplay} elapsedClock={elapsedClock} />
            <MemoizedHeaderSessionControls
              races={races}
              selectedRaceKey={selectedRaceKey}
              replayActive={Boolean(replay?.active)}
              replayLoading={Boolean(replay?.loading)}
              canLoadReplay={canLoadReplay}
              onSelectRace={onSelectRace}
              onLoadReplay={onLoadReplay}
            />
          </div>
          <MemoizedHeaderSessionStatus
            live={live}
            replayActive={Boolean(replay?.active)}
            race={race}
            countdownTarget={countdownTarget}
            raceStartLabel={raceStartLabel}
          />
        </div>
      </div>
    );
  }

  /* ====================================================================== */
  /* Rail panels.                                                           */
  /* ====================================================================== */
  function TimingTower({ rows, byCode, lap, laps, battles, focusCode, onFocus }) {
    return (
      <div className="tm-rail">
        <div className="tm-rail__hd">
          <span className="tm-rail__ttl">Timing Tower</span>
          <span className="tm-rail__sub">Lap {lap}/{laps}</span>
        </div>
        <div className="tm-tower">
          {rows.map((row) => {
            const d = byCode[row.code] || {};
            const foc = focusCode === row.code, lead = row.pos === 1;
            const color = d.color || row.color || "var(--accent)";
            const number = d.num || row.number || "";
            return (
              <div key={row.code} className="tm-trow" data-foc={foc} data-dim={focusCode && !foc}
                onClick={() => onFocus(foc ? null : row.code)}>
                <span className="tm-trow__pos">{row.pos}</span>
                <span className="tm-trow__bar" style={{ background: color }} />
                <span className="tm-trow__code">{row.code}<i>{number}</i></span>
                <span className="tm-trow__tyre" style={{ "--tc": TYRE[tyreLetter(row.comp)] || "var(--text-tertiary)" }}>{tyreLetter(row.comp)}</span>
                <span className={"tm-trow__gap" + (lead ? " is-lead" : "")}>{lead ? "INTERVAL" : row.interval}</span>
              </div>
            );
          })}
        </div>
        {battles.length > 0 && (
          <>
            <div className="tm-rail__hd tm-rail__hd--mt"><span className="tm-rail__ttl">Battle Watch</span></div>
            <div className="tm-battles">
              {battles.map((b, i) => (
                <div key={i} className="tm-battle">
                  <div className="tm-battle__pair">
                    <span style={{ color: (byCode[b.a] || {}).color }}>{b.a}</span>
                    <span className="tm-battle__gap">{Number(b.gap).toFixed(1)}s</span>
                    <span style={{ color: (byCode[b.b] || {}).color }}>{b.b}</span>
                  </div>
                  <div className="tm-battle__note">{b.body || b.note}</div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    );
  }

  function CircuitFacts({ circuit, turns, selTurn, onSelTurn }) {
    const f = circuit.facts;
    const facts = [
      { k: "Lap length", v: f.length, icon: "pin" }, { k: "Race laps", v: f.laps, icon: "flag" },
      { k: "Corners", v: f.corners, icon: "gauge" },
      { k: "Direction", v: f.direction, icon: "timer" }, { k: "First GP", v: f.firstGp, icon: "calendar" },
    ];
    return (
      <div className="tm-rail">
        <div className="tm-rail__hd"><span className="tm-rail__ttl">Circuit Facts</span></div>
        <div className="tm-facts">
          {facts.map((x) => (
            <div key={x.k} className="tm-fact">
              <span className="tm-fact__k"><Icon name={x.icon} size={12} /> {x.k}</span>
              <span className="tm-fact__v">{x.v}</span>
            </div>
          ))}
        </div>
        {f.lapRecord && f.lapRecord !== "—" && (
          <div className="tm-record">
            <span className="tm-record__lbl"><Icon name="stopwatch" size={13} /> Lap record</span>
            <span className="tm-record__time">{f.lapRecord}</span>
            <span className="tm-record__who">{f.recordHolder} · {f.recordYear}</span>
          </div>
        )}
        <div className="tm-rail__hd tm-rail__hd--mt"><span className="tm-rail__ttl">Corners</span><span className="tm-rail__sub">{turns.length} numbered</span></div>
        <div className="tm-turns">
          {turns.map((t) => (
            <div key={t.n} className="tm-turnrow" data-active={selTurn === t.n} onClick={() => onSelTurn(selTurn === t.n ? null : t.n)}>
              <span className="tm-turnrow__n">{t.n}</span>
              <span className="tm-turnrow__nm">{t.name || ("Turn " + t.n)}</span>
            </div>
          ))}
        </div>
        <div className="tm-empty"><Icon name="play" size={13} /> Live driver positions appear here during a session.</div>
      </div>
    );
  }
  const MemoizedCircuitFacts = React.memo(CircuitFacts, staticTrackMapPropsEqual);

  /* ====================================================================== */
  /* On-map overlays.                                                       */
  /* ====================================================================== */
  function PauseGlyph({ size = 14 }) {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <rect x="6" y="5" width="4" height="14" rx="1" /><rect x="14" y="5" width="4" height="14" rx="1" />
      </svg>
    );
  }
  function MapControls({ paused, setPaused, focusCode, onClear, replay, elapsedClock, elapsedSeconds = 0, onStopReplay }) {
    const visualElapsedSeconds = useReplayElapsedClock(elapsedClock, elapsedSeconds);
    return (
      <div className="tm-mapctl">
        <button className="tm-ctlbtn" onClick={() => setPaused(!paused)}>
          {paused ? <Icon name="play" size={14} /> : <PauseGlyph size={14} />} {paused ? "Resume" : "Pause"}
        </button>
        {replay && <span className="tm-ctlbtn">REPLAY {formatReplayClock(visualElapsedSeconds)}</span>}
        {replay && <button className="tm-ctlbtn tm-ctlbtn--clear" onClick={onStopReplay}><Icon name="close" size={13} /> Exit replay</button>}
        {focusCode && (
          <button className="tm-ctlbtn tm-ctlbtn--clear" onClick={onClear}><Icon name="close" size={13} /> {focusCode}</button>
        )}
      </div>
    );
  }
  function MapLegend({ live, layers, carCount }) {
    const items = [];
    if (layers.sectors) items.push({ c: "var(--accent)", l: "Sector split" });
    items.push({ c: "#f4f6fb", l: "Start / finish" });
    if (live) items.push({ c: "var(--live)", l: `${carCount} cars on track` });
    return (
      <div className="tm-legend">
        {items.map((x, i) => <span key={i} className="tm-legend__it"><span className="tm-legend__sw" style={{ background: x.c }} />{x.l}</span>)}
      </div>
    );
  }
  const MemoizedMapLegend = React.memo(MapLegend, staticTrackMapPropsEqual);
  function TurnCard({ circuitName, turn, onClose }) {
    return (
      <div className="tm-turncard">
        <button className="tm-turncard__x" onClick={onClose}><Icon name="close" size={13} /></button>
        <div className="tm-turncard__n">T{turn.n}</div>
        <div className="tm-turncard__nm">{turn.name || `Turn ${turn.n}`}</div>
        <div className="tm-turncard__meta">{circuitName}</div>
      </div>
    );
  }

  function createReplayElapsedClock(initialSeconds, onCommit, timers = {
    now: () => Date.now(),
    setInterval,
    clearInterval,
  }) {
    let elapsedMs = Math.max(0, Number(initialSeconds || 0) * 1000);
    let committedMs = elapsedMs;
    let committedBucket = Math.floor(elapsedMs / TRACK_MAP_REPLAY_DATA_POLL_MS);
    let commitListener = onCommit;
    let interval = null;
    let running = false;
    let previous = timers.now();
    const listeners = new Set();
    const elapsedSeconds = () => elapsedMs / 1000;
    const emit = () => listeners.forEach((listener) => listener(elapsedSeconds()));
    const commit = (force = false) => {
      const bucket = Math.floor(elapsedMs / TRACK_MAP_REPLAY_DATA_POLL_MS);
      if (bucket === committedBucket && (!force || elapsedMs === committedMs)) return;
      committedBucket = bucket;
      committedMs = elapsedMs;
      commitListener?.(elapsedSeconds(), bucket);
    };
    const tick = () => {
      if (!running) return;
      const now = timers.now();
      const deltaMs = Math.max(0, Math.min(2000, now - previous));
      previous = now;
      elapsedMs += deltaMs;
      emit();
      commit();
    };
    return {
      subscribe(listener) {
        listeners.add(listener);
        return () => listeners.delete(listener);
      },
      setOnCommit(listener) {
        commitListener = listener;
      },
      getElapsedSeconds: elapsedSeconds,
      start() {
        if (running) return;
        running = true;
        previous = timers.now();
        interval = timers.setInterval(tick, TRACK_MAP_REPLAY_TICK_MS);
      },
      pause(shouldCommit = true) {
        if (running) {
          running = false;
          timers.clearInterval(interval);
          interval = null;
        }
        if (shouldCommit) commit(true);
        return elapsedSeconds();
      },
      seek(seconds, shouldCommit = true) {
        elapsedMs = Math.max(0, Number(seconds || 0) * 1000);
        previous = timers.now();
        emit();
        if (shouldCommit) commit(true);
        return elapsedSeconds();
      },
      stop() {
        this.pause(true);
      },
    };
  }

  /* ====================================================================== */
  /* Screen.                                                                */
  /* ====================================================================== */
  function TrackMapDynamicReplayStage({ data, dataSource }) {
    const [focusCode, setFocus] = useState(null);
    const [selTurn, setSelTurn] = useState(null);
    const [paused, setPaused] = useState(false);
    const [selectedRaceKey, setSelectedRaceKey] = useState("");
    const [replay, setReplay] = useState({ active: false, playing: false, loading: false, raceKey: "", sessionKind: "Race", session: null, elapsedSeconds: 0, data: null, error: "", needsInitialLapStart: false });
    const [replayChoiceRace, setReplayChoiceRace] = useState(null);
    const replayRequestRef = useRef(0);
    const replayTimingInFlightRef = useRef(false);
    const replayElapsedClockRef = useRef(null);
    if (!replayElapsedClockRef.current) {
      replayElapsedClockRef.current = createReplayElapsedClock(0, null);
    }
    const replayElapsedClock = replayElapsedClockRef.current;
    replayElapsedClock.setOnCommit((elapsedSeconds) => {
      setReplay((current) => current.active && current.elapsedSeconds !== elapsedSeconds
        ? { ...current, elapsedSeconds }
        : current);
    });

    const timing = Array.isArray(data.timing) ? data.timing : [];
    const invariantModel = useMemo(() => buildTrackMapInvariantModel(data, selectedRaceKey), [data.schedule, data.sessions, data.race, timing.length, selectedRaceKey]);
    const {
      races,
      selectedRace,
      selectedRaceValue,
      mapLive,
      circuit,
      replaySessionOptions,
      raceSession,
      canLoadReplay,
    } = invariantModel;
    const geom = useMemo(() => (circuit ? buildGeom(circuit) : null), [circuit]);
    const replayActive = replay.active && replay.raceKey === selectedRaceValue;
    const activeTiming = replayActive ? (Array.isArray(replay.data?.timing) ? replay.data.timing : []) : timing;
    const mapTracking = mapLive || replayActive;
    const replayDataBucket = replayActive ? Math.floor((Number(replay.elapsedSeconds || 0) * 1000) / TRACK_MAP_REPLAY_DATA_POLL_MS) : 0;

    useEffect(() => {
      if (selectedRaceKey && !races.some((race) => raceKey(race) === selectedRaceKey)) setSelectedRaceKey("");
    }, [selectedRaceKey, races]);
    useEffect(() => {
      if (replay.active && replay.raceKey && replay.raceKey !== selectedRaceValue) {
        setReplay((current) => ({ ...current, active: false, playing: false }));
      }
    }, [replay.active, replay.raceKey, selectedRaceValue]);

    useEffect(() => {
      if (!replayActive) {
        replayElapsedClock.pause(false);
        return undefined;
      }
      if (replay.playing) replayElapsedClock.start();
      else replayElapsedClock.pause(false);
      return () => replayElapsedClock.pause(false);
    }, [replayActive, replay.playing]);

    useEffect(() => {
      if (!replayActive || !selectedRace || !window.pitwall?.data?.trackMapReplayTiming) return undefined;
      let cancelled = false;
      let lastBucket = "";
      const loadReplayTiming = async () => {
        if (replayTimingInFlightRef.current) return;
        const elapsedSeconds = Math.max(0, replay.elapsedSeconds || 0);
        const bucket = `${selectedRaceValue}:${replay.sessionKind}:${Math.floor((elapsedSeconds * 1000) / TRACK_MAP_REPLAY_DATA_POLL_MS)}`;
        if (bucket === lastBucket) return;
        lastBucket = bucket;
        const requestId = replayRequestRef.current + 1;
        replayRequestRef.current = requestId;
        replayTimingInFlightRef.current = true;
        setReplay((current) => ({ ...current, loading: !current.data, error: "" }));
        try {
          const session = replay.session || trackMapReplaySessionOptions(selectedRace).find((item) => item.kind === replay.sessionKind) || null;
          const result = await window.pitwall.data.trackMapReplayTiming({
            season: data.seasonSummary?.season || "",
            raceName: selectedRace.name || "",
            raceStartsAt: selectedRace.startsAt || session?.startsAt || "",
            sessionStartsAt: session?.startsAt || selectedRace.startsAt || "",
            sessionKind: replay.sessionKind,
            elapsedSeconds,
            raceRelative: true,
            preStartSeconds: 5,
          });
          if (cancelled || requestId !== replayRequestRef.current) return;
          setReplay((current) => ({ ...current, loading: false, data: result || null, error: result?.ok === false ? result.message || "Replay timing is unavailable." : "" }));
        } catch (error) {
          if (cancelled || requestId !== replayRequestRef.current) return;
          setReplay((current) => ({ ...current, loading: false, error: error?.message || "Replay timing is unavailable." }));
        } finally {
          if (replayRequestRef.current === requestId) replayTimingInFlightRef.current = false;
        }
      };
      loadReplayTiming();
      return () => {
        cancelled = true;
        replayRequestRef.current += 1;
        replayTimingInFlightRef.current = false;
      };
    }, [replayActive, selectedRaceValue, replay.sessionKind, replayDataBucket]);

    function startTrackMapReplay(race, session) {
      const kind = session?.kind || "Race";
      setSelectedRaceKey(raceKey(race));
      setReplayChoiceRace(null);
      setPaused(false);
      replayElapsedClock.seek(0, false);
      setReplay({ active: true, playing: true, loading: true, raceKey: raceKey(race), sessionKind: kind, session: session || null, elapsedSeconds: 0, data: null, error: "", needsInitialLapStart: false });
    }
    function loadTrackMapReplay() {
      if (!selectedRace) return;
      const options = replaySessionOptions;
      if (options.length > 1) {
        setReplayChoiceRace(selectedRace);
        return;
      }
      startTrackMapReplay(selectedRace, options[0]);
    }
    function stopTrackMapReplay() {
      const elapsedSeconds = replayElapsedClock.pause(false);
      setReplay((current) => ({ ...current, active: false, playing: false, elapsedSeconds }));
    }
    function seekReplaySeconds(seconds) {
      replayRequestRef.current += 1;
      replayTimingInFlightRef.current = false;
      const elapsedSeconds = replayElapsedClock.seek(seconds, false);
      setReplay((current) => ({ ...current, needsInitialLapStart: false, loading: true, error: "", elapsedSeconds }));
    }
    function setTrackPaused(nextPaused) {
      setPaused(nextPaused);
      if (replayActive) {
        const elapsedSeconds = nextPaused ? replayElapsedClock.pause(false) : replayElapsedClock.getElapsedSeconds();
        setReplay((current) => ({ ...current, playing: !nextPaused, elapsedSeconds }));
      }
    }

    const replayLap = replay.data?.sessionClock?.lapCount?.lap || "-";
    const replayLaps = replay.data?.sessionClock?.lapCount?.laps || "-";
    const headerRace = useMemo(
      () => replayActive
        ? { ...(selectedRace || {}), lap: replayLap, laps: replayLaps, weather: replay.data?.weather || {} }
        : mapLive ? { ...(data.race || {}), lap: data.race?.lap || "-", laps: data.race?.laps || "-" } : selectedRace,
      [replayActive, selectedRace, replayLap, replayLaps, replay.data?.weather, mapLive, data.race]
    );

    const circuitId = circuit?.id || "none";
    useEffect(() => { setFocus(null); setSelTurn(null); }, [circuitId, mapTracking]);

    // Cars use official Formula 1 track positions when replay archives provide
    // them, otherwise fall back to cumulative gap spacing around the lap.
    // Retired cars stay in the timing tower but must not be drawn on the
    // circuit: with no live position data the fallback would keep lapping them.
    const cars = useMemo(() => {
      if (!mapTracking) return [];
      const runningRows = activeTiming.filter((row) => !row.retired);
      const lapT = lapSeconds(runningRows[0]?.last) || 90;
      let cum = 0;
      return runningRows.map((row, i) => {
        const drv = data.byCode[row.code] || {};
        const intervalGap = gapSeconds(row.interval, lapT);
        cum += i === 0 ? 0 : intervalGap;
        const fallbackFrac = i === 0 || intervalGap ? (cum / lapT) % 1 : i / Math.max(1, runningRows.length);
        return { code: row.code, pos: row.pos, num: drv.num || row.number, color: drv.color || row.color || "var(--accent)", abbr: drv.abbr, name: drv.name, comp: row.comp, gap: row.gap, frac: fallbackFrac, trackPosition: row.trackPosition || null };
      });
    }, [mapTracking, activeTiming, data.byCode]);

    const layers = useMemo(() => ({ turns: true, names: true, sectors: true, start: true }), []);
    const selTurnObj = useMemo(() => (geom ? geom.turns.find((t) => t.n === selTurn) || null : null), [geom, selTurn]);

    const round = mapLive && !replayActive ? data.race?.round : selectedRace?.rnd;
    const gp = mapLive && !replayActive ? data.race?.name : selectedRace?.name;
    const circuitName = (mapLive && !replayActive ? data.race?.circuit : selectedRace?.circuit) || circuit?.name || "";
    const loc = (mapLive && !replayActive ? data.race?.loc : selectedRace?.loc) || circuit?.loc || "";

    const countdownTarget = !mapTracking ? (raceSession?.startsAt || selectedRace?.startsAt || "") : "";
    const raceStartLabel = !mapTracking && raceSession ? `Race start · ${raceSession.day || ""} ${raceSession.time || ""} local`.trim() : "";

    const replayLapPace = useMemo(() => {
      if (!replayActive) return 0;
      const pace = lapSeconds(activeTiming[0]?.last);
      return pace ? Math.round(pace) : 80;
    }, [replayActive, activeTiming]);

    const battles = replayActive ? [] : Array.isArray(data.battlePairs) ? data.battlePairs : [];
    const loadableReplay = !replayActive && canLoadReplay;
    const replayChoices = trackMapReplaySessionOptions(replayChoiceRace);

    return (
      <div className="tm-screen">
        <Header round={round} gp={gp} name={circuitName} loc={loc} live={mapTracking} replay={replayActive ? replay : null}
          race={mapTracking ? headerRace : null} countdownTarget={countdownTarget} raceStartLabel={raceStartLabel}
          races={races} selectedRaceKey={selectedRaceValue} onSelectRace={setSelectedRaceKey}
          canLoadReplay={loadableReplay} onLoadReplay={loadTrackMapReplay} onSeekReplay={seekReplaySeconds}
          elapsedClock={replayElapsedClock} />
        <div className="tm-stage">
          <div className="tm-mapwrap">
            <div className="tm-mapcard">
              {geom ? (
                <>
                  <TrackMapView geom={geom} mode={mapTracking ? "live" : "map"} layers={layers} cars={cars}
                    focusCode={focusCode} onFocus={setFocus} selectedTurn={selTurn} onSelectTurn={setSelTurn} paused={paused}
                    trackPositionBounds={replayActive ? replay.data?.trackPositionBounds : null}
                    trackPositionSample={replayActive ? replay.data?.trackPositionSample : null}
                    lapPaceSeconds={replayLapPace} />
                  {mapTracking && <MapControls paused={paused} setPaused={setTrackPaused} focusCode={focusCode} onClear={() => setFocus(null)}
                    replay={replayActive} elapsedClock={replayElapsedClock} elapsedSeconds={replay.elapsedSeconds} onStopReplay={stopTrackMapReplay} />}
                  <MemoizedMapLegend live={mapTracking} layers={layers} carCount={cars.length} />
                  {selTurnObj && <TurnCard circuitName={circuit.name} turn={selTurnObj} onClose={() => setSelTurn(null)} />}
                </>
              ) : (
                <div className="tm-mapnote">
                  <div className="tm-mapnote__in">
                    <Icon name="pin" size={22} />
                    {gp ? `A detailed circuit map for the ${gp} is being charted. Live positions will appear here when the session starts.` : dataSource}
                  </div>
                </div>
              )}
            </div>
          </div>
          <div className="tm-railwrap">
            {mapTracking ? (
              <TimingTower rows={activeTiming} byCode={data.byCode} lap={headerRace.lap} laps={headerRace.laps}
                battles={battles} focusCode={focusCode} onFocus={setFocus} />
            ) : geom ? (
              <MemoizedCircuitFacts circuit={circuit} turns={geom.turns} selTurn={selTurn} onSelTurn={setSelTurn} />
            ) : (
              <div className="tm-rail">
                <div className="tm-rail__hd"><span className="tm-rail__ttl">Circuit Facts</span></div>
                <div className="tm-empty"><Icon name="play" size={13} /> {dataSource}</div>
              </div>
            )}
          </div>
        </div>
        {replay.error && <div className="tm-empty"><Icon name="timer" size={13} /> {replay.error}</div>}
        {replayChoiceRace && (
          <div className="tm-modal" role="dialog" aria-modal="true" aria-label="Choose replay session">
            <div className="tm-modal__panel">
              <div className="tm-modal__head">
                <div>
                  <div className="tm-modal__title">Load Replay</div>
                  <div className="tm-modal__sub">{replayChoiceRace.name || "Race weekend"} has more than one race session.</div>
                </div>
                <button className="tm-ctlbtn tm-ctlbtn--clear" type="button" onClick={() => setReplayChoiceRace(null)}><Icon name="close" size={13} /></button>
              </div>
              <div className="tm-modal__choices">
                {replayChoices.map((session) => (
                  <button className="tm-modal__choice" key={session.kind} type="button" onClick={() => startTrackMapReplay(replayChoiceRace, session)}>
                    <span className="tm-modal__kind">{session.kind}</span>
                    <span className="tm-modal__meta">{sessionLabel(session)}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  function TrackMap() {
    const { data, dataSource } = window.PW.usePitWall();
    return <TrackMapDynamicReplayStage data={data} dataSource={dataSource} />;
  }

  window.PW = window.PW || {};
  window.PW.TrackMap = TrackMap;
})();
