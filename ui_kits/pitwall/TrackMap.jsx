/* PitWall — Track Map screen. window.PW.TrackMap
   Circuit map with live driver positions when a session is on, fully labelled
   turns / DRS / sectors otherwise. Renders the body only; AppShell supplies the
   sidebar + topbar chrome. All race data comes from usePitWall() (the Electron
   bridge); circuit outlines are real OSM centerlines (window.PW_TRACKMAP_CIRCUITS,
   see trackmap-circuits.js). Start/finish, sectors, DRS zones and numbered corners
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
    .tm-drstext { font-family: var(--font-mono); font-weight: 700; font-size: 9.5px; fill: var(--drs-open); letter-spacing: 0.05em; }

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
  /*   - main straight / start-finish, sector thirds and DRS zones derived  */
  /* ====================================================================== */
  function linePath(pts, closed) {
    if (!pts.length) return "";
    let d = `M ${pts[0][0]} ${pts[0][1]}`;
    for (let i = 1; i < pts.length; i++) d += ` L ${pts[i][0]} ${pts[i][1]}`;
    if (closed) d += " Z";
    return d;
  }
  function sliceIdx(pts, from, to) {
    const n = pts.length, out = [pts[from]];
    let i = from;
    while (i !== to) { i = (i + 1) % n; out.push(pts[i]); }
    return out;
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

    // ---- straights (low curvature runs) -> main straight, S/F, DRS ----
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
      return { n: ci + 1, name: nameForTurn(ci + 1) || "", x: pts[c.apex][0], y: pts[c.apex][1], lx: pts[c.apex][0] + o[0] * LABEL_GAP, ly: pts[c.apex][1] + o[1] * LABEL_GAP };
    });

    // ---- sectors: thirds of the lap from S/F ----
    function idxAtDistance(frac) {
      const target = (cum[sfIndex] + frac * total) % total;
      let best = 0, bd = 1e9;
      for (let j = 0; j < n; j++) { let dd = Math.abs(cum[j] - target); dd = Math.min(dd, total - dd); if (dd < bd) { bd = dd; best = j; } }
      return best;
    }
    const sectors = [2, 3].map((s) => { const idx = idxAtDistance((s - 1) / 3); return { s, x: pts[idx][0], y: pts[idx][1], out: outwardAt(idx) }; });

    // ---- DRS zones along the longest straights ----
    const dzN = Math.max(1, (circuit.facts && circuit.facts.drsZones) || 1);
    const drsRuns = straights.slice(0, dzN);
    const drs = drsRuns.map((r) => linePath(sliceIdx(pts, r.startIdx, r.endIdx), false));
    const drsLabels = drsRuns.map((r, di) => { const o = outwardAt(r.midIdx); return { name: dzN > 1 ? "DRS " + (di + 1) : "DRS", x: pts[r.midIdx][0] + o[0] * 16, y: pts[r.midIdx][1] + o[1] * 16 }; });

    // ---- start / finish ----
    const startNode = { pt: pts[sfIndex], out: outwardAt(sfIndex) };

    // ---- viewBox fit (track + outward labels) ----
    let minX = 1e9, minY = 1e9, maxX = -1e9, maxY = -1e9;
    const acc = (x, y) => { minX = Math.min(minX, x); minY = Math.min(minY, y); maxX = Math.max(maxX, x); maxY = Math.max(maxY, y); };
    pts.forEach((p) => acc(p[0], p[1]));
    turns.forEach((t) => { acc(t.lx, t.ly); acc(t.lx, t.ly + 22); });
    const pad = 34;
    const vb = `${(minX - pad).toFixed(1)} ${(minY - pad).toFixed(1)} ${(maxX - minX + pad * 2).toFixed(1)} ${(maxY - minY + pad * 2).toFixed(1)}`;

    return { d, turns, sectors, startNode, drs, drsLabels, vb };
  }

  /* ====================================================================== */
  /* SVG renderer (consumes a prebuilt geom).                               */
  /* ====================================================================== */
  function TrackMapView({ geom, mode, layers, cars, focusCode, onFocus, selectedTurn, onSelectTurn, speed = 1, paused = false }) {
    const pathRef = useRef(null);
    const carRefs = useRef({});

    // Position + animate cars. Cars are PLACED immediately via a timer-based retry
    // (runs even when rAF is throttled), then rAF drives smooth motion in foreground.
    const stateRef = useRef({ u: 0 });
    useEffect(() => {
      if (mode !== "live") return;
      let raf, timer, killed = false, prev = null;
      const lapViewSeconds = 16 / Math.max(0.15, speed);
      const st = stateRef.current;
      const place = (u) => {
        const path = pathRef.current, L = path && path.getTotalLength();
        if (!L) return false;
        cars.forEach((c) => {
          const cu = (u - c.frac + 1) % 1, el = carRefs.current[c.code];
          if (!el) return;
          const pt = path.getPointAtLength(cu * L), back = path.getPointAtLength(((cu - 0.009 + 1) % 1) * L);
          el.style.transform = `translate(${pt.x.toFixed(2)}px, ${pt.y.toFixed(2)}px)`;
          const trail = el.querySelector(".tm-car__trail");
          if (trail) { trail.setAttribute("x2", (back.x - pt.x).toFixed(2)); trail.setAttribute("y2", (back.y - pt.y).toFixed(2)); }
        });
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
    }, [cars, mode, speed, paused, geom]);

    const { turns: showTurns, names: showNames, drs: showDrs, sectors: showSectors } = layers;
    const roadW = 15, surfW = 10.5;

    return (
      <svg className="tm-svg" viewBox={geom.vb} preserveAspectRatio="xMidYMid meet">
        <defs>
          <filter id="tm-glow" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="6" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>

        {showDrs && geom.drs.map((d, i) => (
          <path key={"drsu" + i} d={d} fill="none" stroke="var(--drs-open)" strokeWidth={roadW + 9} strokeLinecap="round" strokeLinejoin="round" opacity="0.16" />
        ))}

        <path ref={pathRef} d={geom.d} fill="none" stroke="#000" strokeWidth={roadW + 6} strokeLinejoin="round" opacity="0.55" />
        <path d={geom.d} fill="none" stroke="var(--ink-500)" strokeWidth={roadW} strokeLinejoin="round" strokeLinecap="round" />
        <path d={geom.d} fill="none" stroke="#0c0f15" strokeWidth={surfW} strokeLinejoin="round" strokeLinecap="round" />
        <path d={geom.d} fill="none" stroke="rgba(244,246,251,0.22)" strokeWidth="1.4" strokeDasharray="1.5 11" strokeLinecap="round" />

        {showDrs && geom.drs.map((d, i) => (
          <path key={"drso" + i} d={d} fill="none" stroke="var(--drs-open)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="9 7" opacity="0.95">
            <animate attributeName="stroke-dashoffset" from="0" to="-32" dur="0.9s" repeatCount="indefinite" />
          </path>
        ))}

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

        {showDrs && geom.drsLabels.map((dl, i) => (
          <g key={"drsl" + i} transform={`translate(${dl.x}, ${dl.y})`}>
            <rect x="-19" y="-9" width="38" height="18" rx="5" fill="rgba(43,208,122,0.14)" stroke="var(--drs-open)" strokeWidth="1" />
            <text x="0" y="1" className="tm-drstext" textAnchor="middle" dominantBaseline="middle">{dl.name}</text>
          </g>
        ))}

        {showTurns && geom.turns.map((t) => {
          const active = selectedTurn === t.n;
          return (
            <g key={t.n} className="tm-turn" data-active={active} onClick={() => onSelectTurn && onSelectTurn(active ? null : t.n)}>
              <line x1={t.x} y1={t.y} x2={t.lx} y2={t.ly} className="tm-turn__lead" />
              <circle cx={t.x} cy={t.y} r="3.4" className="tm-turn__dot" />
              <g transform={`translate(${t.lx}, ${t.ly})`}>
                <circle r="11" className="tm-turn__badge" />
                <text x="0" y="1" className="tm-turn__num" textAnchor="middle" dominantBaseline="middle">{t.n}</text>
                {showNames && t.name && <text x="0" y="22" className="tm-turn__name" textAnchor="middle" dominantBaseline="middle">{t.name}</text>}
              </g>
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

  function Header({ round, gp, name, loc, live, race, countdownTarget, raceStartLabel, races, selectedRaceKey, onSelectRace }) {
    const cd = useCountdown(countdownTarget);
    const wx = (race && race.weather) || {};
    const flag = (race && race.flag) || "green";
    return (
      <div className="tm-head">
        <div className="tm-head__id">
          {round ? <div className="tm-head__round">Round {round} · 2026</div> : null}
          <h1 className="tm-head__gp">{gp || name || "Track Map"}</h1>
          <div className="tm-head__circuit"><Icon name="pin" size={13} /> {[name, loc].filter(Boolean).join(" · ")}</div>
        </div>
        <div className="tm-head__status">
          <RaceSelector races={races} selectedRaceKey={selectedRaceKey} onSelectRace={onSelectRace} />
          {live ? (
            <>
              <div className="tm-statline">
                <span className="pw-badge pw-badge--live tm-livebadge"><span className="tm-livedot" />LIVE</span>
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
            return (
              <div key={row.code} className="tm-trow" data-foc={foc} data-dim={focusCode && !foc}
                onClick={() => onFocus(foc ? null : row.code)}>
                <span className="tm-trow__pos">{row.pos}</span>
                <span className="tm-trow__bar" style={{ background: d.color }} />
                <span className="tm-trow__code">{row.code}<i>{d.num}</i></span>
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
      { k: "Corners", v: f.corners, icon: "gauge" }, { k: "DRS zones", v: f.drsZones, icon: "zap" },
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
  function MapControls({ paused, setPaused, focusCode, onClear }) {
    return (
      <div className="tm-mapctl">
        <button className="tm-ctlbtn" onClick={() => setPaused(!paused)}>
          {paused ? <Icon name="play" size={14} /> : <PauseGlyph size={14} />} {paused ? "Resume" : "Pause"}
        </button>
        {focusCode && (
          <button className="tm-ctlbtn tm-ctlbtn--clear" onClick={onClear}><Icon name="close" size={13} /> {focusCode}</button>
        )}
      </div>
    );
  }
  function MapLegend({ live, layers, carCount }) {
    const items = [];
    if (layers.drs) items.push({ c: "var(--drs-open)", l: "DRS zone" });
    if (layers.sectors) items.push({ c: "var(--accent)", l: "Sector split" });
    items.push({ c: "#f4f6fb", l: "Start / finish" });
    if (live) items.push({ c: "var(--live)", l: `${carCount} cars on track` });
    return (
      <div className="tm-legend">
        {items.map((x, i) => <span key={i} className="tm-legend__it"><span className="tm-legend__sw" style={{ background: x.c }} />{x.l}</span>)}
      </div>
    );
  }
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

  /* ====================================================================== */
  /* Screen.                                                                */
  /* ====================================================================== */
  function TrackMap() {
    const { data, dataSource } = window.PW.usePitWall();
    const [focusCode, setFocus] = useState(null);
    const [selTurn, setSelTurn] = useState(null);
    const [paused, setPaused] = useState(false);
    const [selectedRaceKey, setSelectedRaceKey] = useState("");

    const timing = Array.isArray(data.timing) ? data.timing : [];

    const races = Array.isArray(data.schedule) ? data.schedule : [];
    const liveRace = useMemo(() => races.find((r) => r.status === "live") || null, [races]);
    const liveSession = useMemo(() => (Array.isArray(data.sessions) ? data.sessions : []).find((s) => s.status === "live") || null, [data.sessions]);
    const live = timing.length > 0 && Boolean(liveRace || liveSession);
    const upcomingRace = useMemo(() => races.find((r) => r.status === "upcoming") || null, [races]);
    const latestCompletedRace = useMemo(() => races.filter((r) => r.status === "done").at(-1) || null, [races]);
    const autoRace = liveRace || upcomingRace || latestCompletedRace || races[0] || null;
    const liveRaceKey = raceKey(liveRace);
    const selectedRace = selectedRaceKey ? races.find((race) => raceKey(race) === selectedRaceKey) || autoRace : autoRace;
    const selectedRaceValue = raceKey(selectedRace);
    const mapLive = live && (!selectedRaceKey || selectedRaceKey === liveRaceKey);

    useEffect(() => {
      if (selectedRaceKey && !races.some((race) => raceKey(race) === selectedRaceKey)) setSelectedRaceKey("");
    }, [selectedRaceKey, races]);

    const headerRace = mapLive ? { ...(data.race || {}), lap: data.race?.lap || "-", laps: data.race?.laps || "-" } : selectedRace;
    const circuit = resolveCircuit(headerRace) || (mapLive ? resolveCircuit(data.race) : null);
    const geom = useMemo(() => (circuit ? buildGeom(circuit) : null), [circuit]);

    const circuitId = circuit?.id || "none";
    useEffect(() => { setFocus(null); setSelTurn(null); }, [circuitId, mapLive]);

    // Live cars spaced around the lap from cumulative gap-to-leader seconds.
    const cars = useMemo(() => {
      if (!mapLive) return [];
      const lapT = lapSeconds(timing[0]?.last) || 90;
      let cum = 0;
      return timing.map((row, i) => {
        const drv = data.byCode[row.code] || {};
        cum += i === 0 ? 0 : gapSeconds(row.interval, lapT);
        return { code: row.code, pos: row.pos, num: drv.num, color: drv.color, abbr: drv.abbr, name: drv.name, comp: row.comp, gap: row.gap, frac: (cum / lapT) % 1 };
      });
    }, [mapLive, timing, data.byCode]);

    const layers = { turns: true, names: true, drs: true, sectors: true, start: true };
    const selTurnObj = useMemo(() => (geom ? geom.turns.find((t) => t.n === selTurn) || null : null), [geom, selTurn]);

    const round = mapLive ? data.race?.round : selectedRace?.rnd;
    const gp = mapLive ? data.race?.name : selectedRace?.name;
    const circuitName = (mapLive ? data.race?.circuit : selectedRace?.circuit) || circuit?.name || "";
    const loc = (mapLive ? data.race?.loc : selectedRace?.loc) || circuit?.loc || "";

    const raceSession = useMemo(
      () => (selectedRace?.sessions || []).find((s) => /race/i.test(s.kind) && !/sprint/i.test(s.kind)) || null,
      [selectedRace]
    );
    const countdownTarget = !mapLive ? (raceSession?.startsAt || selectedRace?.startsAt || "") : "";
    const raceStartLabel = !mapLive && raceSession ? `Race start · ${raceSession.day || ""} ${raceSession.time || ""} local`.trim() : "";

    const battles = Array.isArray(data.battlePairs) ? data.battlePairs : [];

    return (
      <div className="tm-screen">
        <Header round={round} gp={gp} name={circuitName} loc={loc} live={mapLive}
          race={mapLive ? headerRace : null} countdownTarget={countdownTarget} raceStartLabel={raceStartLabel}
          races={races} selectedRaceKey={selectedRaceValue} onSelectRace={setSelectedRaceKey} />
        <div className="tm-stage">
          <div className="tm-mapwrap">
            <div className="tm-mapcard">
              {geom ? (
                <>
                  <TrackMapView geom={geom} mode={mapLive ? "live" : "map"} layers={layers} cars={cars}
                    focusCode={focusCode} onFocus={setFocus} selectedTurn={selTurn} onSelectTurn={setSelTurn} paused={paused} />
                  {mapLive && <MapControls paused={paused} setPaused={setPaused} focusCode={focusCode} onClear={() => setFocus(null)} />}
                  <MapLegend live={mapLive} layers={layers} carCount={cars.length} />
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
            {mapLive ? (
              <TimingTower rows={timing} byCode={data.byCode} lap={headerRace.lap} laps={headerRace.laps}
                battles={battles} focusCode={focusCode} onFocus={setFocus} />
            ) : geom ? (
              <CircuitFacts circuit={circuit} turns={geom.turns} selTurn={selTurn} onSelTurn={setSelTurn} />
            ) : (
              <div className="tm-rail">
                <div className="tm-rail__hd"><span className="tm-rail__ttl">Circuit Facts</span></div>
                <div className="tm-empty"><Icon name="play" size={13} /> {dataSource}</div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  window.PW = window.PW || {};
  window.PW.TrackMap = TrackMap;
})();
