/* Apexline AI Copilot — race-weekend AI analysis + chatbot. window.PW.Copilot */
(function () {
  const NS = window.PitWallDesignSystem_698fe6;
  const { Card, Badge, Icon, Button, IconButton, Avatar, DriverTag, GapDelta, StatTile, Tag } = NS;

  const STYLE_ID = "pw-copilot-styles";
  if (!document.getElementById(STYLE_ID)) {
    const el = document.createElement("style");
    el.id = STYLE_ID;
    el.textContent = `
    .cop { display: flex; flex-direction: column; gap: var(--space-8); height: 100%; min-width: 0; }
    .cop__main { display: flex; flex-direction: column; gap: var(--space-9); min-width: 0; }
    .cop-tabs { display: flex; align-items: center; gap: var(--space-4); overflow-x: auto; padding-bottom: 2px; }
    .cop-tab { display: inline-flex; align-items: center; gap: var(--space-4); height: 36px; padding: 0 var(--space-6); border-radius: var(--radius-sm); border: 1px solid var(--border-subtle); background: var(--surface-card); color: var(--text-secondary); font-family: var(--font-sans); font-size: var(--text-sm); font-weight: 600; cursor: pointer; white-space: nowrap; transition: var(--tr-control); }
    .cop-tab:hover { border-color: var(--accent-border); color: var(--text-primary); }
    .cop-tab[data-active="true"] { background: var(--accent-quiet); border-color: var(--accent-border); color: var(--text-accent); }
    .cop-page { display: grid; grid-template-columns: minmax(0, 1.25fr) minmax(300px, 0.75fr); gap: var(--space-9); align-items: start; min-width: 0; }
    .cop-page--chat { grid-template-columns: minmax(0, 860px); }
    .insight-panel { display: flex; flex-direction: column; gap: var(--space-7); }

    /* Hero analysis */
    .cop-hero { position: relative; overflow: hidden; border-radius: var(--radius-lg); border: 1px solid var(--accent-border);
      background: linear-gradient(120% 130% at 90% -20%, var(--accent-quiet), transparent 55%), var(--surface-card); padding: var(--space-9); }
    .cop-hero__top { display: flex; align-items: center; gap: var(--space-6); flex-wrap: wrap; margin-bottom: var(--space-7); }
    .cop-hero__badge { display: inline-flex; align-items: center; gap: var(--space-4); padding: 4px 10px 4px 8px; border-radius: var(--radius-pill);
      background: var(--accent-quiet); color: var(--text-accent); font-size: var(--text-2xs); font-weight: 600; letter-spacing: var(--tracking-caps); text-transform: uppercase; }
    .cop-hero__actions { margin-left: auto; display: inline-flex; align-items: center; justify-content: flex-end; gap: var(--space-5); min-width: 0; }
    .cop-hero__model { font-family: var(--font-mono); font-size: var(--text-2xs); color: var(--text-tertiary); display: flex; align-items: center; gap: 5px; white-space: nowrap; }
    .cop-hero__h { font-family: var(--font-display); font-weight: 700; font-size: var(--text-2xl); color: var(--text-strong); letter-spacing: -0.01em; margin: 0 0 var(--space-6); }
    .cop-hero__sum { font-size: var(--text-md); line-height: 1.6; color: var(--text-secondary); max-width: 68ch; text-wrap: pretty; }
    .cop-hero__conf { display: flex; align-items: center; gap: var(--space-6); margin-top: var(--space-8); padding-top: var(--space-7); border-top: 1px solid var(--border-subtle); }
    .cop-conf__track { flex: 1; height: 6px; border-radius: var(--radius-pill); background: var(--bg-sunken); overflow: hidden; max-width: 220px; }
    .cop-conf__fill { height: 100%; border-radius: var(--radius-pill); background: linear-gradient(90deg, var(--accent), var(--t-fastest)); }

    /* Standings snapshot */
    .cop-preds { display: grid; grid-template-columns: repeat(3, 1fr); gap: var(--space-7); }
    .pred { padding: var(--space-8); border-radius: var(--radius-md); background: var(--surface-card); border: 1px solid var(--border-subtle); }
    .pred__top { display: flex; align-items: center; gap: var(--space-6); margin-bottom: var(--space-6); }
    .pred__label { font-size: var(--text-2xs); color: var(--text-tertiary); text-transform: uppercase; letter-spacing: var(--tracking-caps); font-weight: 600; }
    .pred__name { font-family: var(--font-display); font-weight: 700; font-size: var(--text-lg); color: var(--text-primary); }
    .pred__metric { display: flex; align-items: baseline; gap: 4px; margin: var(--space-5) 0; }
    .pred__metricv { font-family: var(--font-mono); font-weight: 600; font-size: var(--text-3xl); color: var(--text-strong); font-variant-numeric: tabular-nums; }
    .pred__metricu { font-size: var(--text-md); color: var(--text-tertiary); }
    .pred__track { height: 5px; border-radius: var(--radius-pill); background: var(--bg-sunken); overflow: hidden; margin-bottom: var(--space-6); }
	    .pred__fill { height: 100%; border-radius: var(--radius-pill); }
	    .pred__note { font-size: var(--text-sm); color: var(--text-tertiary); line-height: 1.4; }

	    /* Race predictions */
	    .cop-page--projections { grid-template-columns: minmax(0, 1fr); }
	    .race-pred { display: flex; flex-direction: column; gap: var(--space-6); padding: var(--space-8); border-radius: var(--radius-md); background: linear-gradient(140% 120% at 100% 0, rgba(93,232,174,0.12), transparent 42%), var(--surface-card); border: 1px solid var(--border-subtle); }
	    .race-pred__head { display: flex; align-items: flex-start; justify-content: space-between; gap: var(--space-6); padding-bottom: var(--space-5); border-bottom: 1px solid var(--border-subtle); }
	    .race-pred__eyebrow { display: inline-flex; align-items: center; gap: 6px; color: var(--text-accent); font-size: var(--text-2xs); font-weight: 800; letter-spacing: var(--tracking-caps); text-transform: uppercase; }
	    .race-pred__title { margin-top: 4px; color: var(--text-primary); font-family: var(--font-display); font-size: var(--text-xl); font-weight: 800; }
	    .race-pred__summary { color: var(--text-secondary); font-size: var(--text-sm); line-height: 1.45; }
	    .race-pred__sections { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: var(--space-6); align-items: start; }
	    .race-pred__section { display: flex; flex-direction: column; gap: var(--space-4); }
	    .race-pred__section--wide { grid-column: 1 / -1; }
	    .race-pred__label { color: var(--text-tertiary); font-size: var(--text-2xs); font-weight: 800; letter-spacing: var(--tracking-caps); text-transform: uppercase; }
	    .race-pick { display: grid; grid-template-columns: 42px minmax(0, 1fr) 58px; gap: var(--space-5); align-items: center; min-width: 0; padding: var(--space-5); border-radius: var(--radius-sm); background: var(--bg-sunken); border: 1px solid var(--border-subtle); }
	    .race-pick__name { color: var(--text-primary); font-family: var(--font-display); font-weight: 800; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
	    .race-pick__meta { display: flex; align-items: center; gap: var(--space-4); margin-top: 3px; color: var(--text-tertiary); font-size: var(--text-2xs); font-family: var(--font-mono); text-transform: uppercase; }
	    .race-pick__bar { grid-column: 2 / -1; height: 5px; border-radius: var(--radius-pill); background: rgba(255,255,255,0.07); overflow: hidden; }
	    .race-pick__fill { width: var(--_w); height: 100%; border-radius: inherit; background: linear-gradient(90deg, var(--_c), color-mix(in srgb, var(--_c) 45%, #ffffff)); }
	    .race-pick__reason { grid-column: 2 / -1; color: var(--text-secondary); font-size: var(--text-xs); line-height: 1.4; }
	    .race-pick__score { justify-self: end; color: var(--text-primary); font-family: var(--font-mono); font-size: var(--text-sm); font-weight: 800; }
	    .race-board { display: flex; flex-direction: column; gap: 1px; overflow: hidden; border-radius: var(--radius-sm); border: 1px solid var(--border-subtle); background: var(--border-subtle); }
	    .race-board__row { display: grid; grid-template-columns: 42px minmax(0, 1fr) 58px; gap: var(--space-4); align-items: center; min-width: 0; padding: var(--space-4) var(--space-5); background: var(--bg-sunken); }
	    button.race-board__row { width: 100%; border: 0; color: inherit; font: inherit; text-align: left; cursor: pointer; }
	    button.race-board__row:hover { background: color-mix(in srgb, var(--accent) 12%, var(--bg-sunken)); }
	    .race-board__pos { color: var(--text-tertiary); font-family: var(--font-mono); font-size: var(--text-2xs); font-weight: 800; }
	    .race-board__driver { min-width: 0; color: var(--text-primary); font-family: var(--font-display); font-size: var(--text-sm); font-weight: 800; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
	    .race-board__prob { justify-self: end; color: var(--text-secondary); font-family: var(--font-mono); font-size: var(--text-2xs); font-weight: 800; }
	    .race-board__reason { grid-column: 2 / -1; color: var(--text-tertiary); font-size: var(--text-2xs); line-height: 1.35; }
	    .projected-champ { margin-top: var(--space-6); display: flex; flex-direction: column; gap: var(--space-4); padding: var(--space-5); border-radius: var(--radius-sm); border: 1px solid color-mix(in srgb, var(--accent-border) 55%, var(--border-subtle)); background: linear-gradient(120% 140% at 100% 0, rgba(45,123,255,0.10), transparent 42%), var(--bg-sunken); }
	    .projected-champ__head { display: flex; justify-content: space-between; align-items: baseline; gap: var(--space-5); padding-bottom: var(--space-3); border-bottom: 1px solid var(--border-subtle); }
	    .projected-champ__title { color: var(--text-primary); font-family: var(--font-display); font-size: var(--text-md); font-weight: 900; }
	    .projected-champ__sub { color: var(--text-tertiary); font-size: var(--text-2xs); font-weight: 800; letter-spacing: var(--tracking-caps); text-transform: uppercase; }
	    .projected-champ__row { display: grid; grid-template-columns: 38px minmax(0, 1fr) 72px 62px 58px; gap: var(--space-4); align-items: center; padding: var(--space-3) 0; border-bottom: 1px solid rgba(255,255,255,0.045); }
	    .projected-champ__row:last-child { border-bottom: 0; }
	    .projected-champ__pos, .projected-champ__race, .projected-champ__pts, .projected-champ__delta { font-family: var(--font-mono); font-size: var(--text-2xs); font-weight: 900; font-variant-numeric: tabular-nums; }
	    .projected-champ__pos { color: var(--text-tertiary); }
	    .projected-champ__driver { min-width: 0; display: flex; align-items: center; gap: var(--space-4); color: var(--text-primary); font-family: var(--font-display); font-size: var(--text-sm); font-weight: 900; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
	    .projected-champ__stripe { width: 5px; height: 24px; border-radius: var(--radius-pill); background: var(--_c); flex: none; }
	    .projected-champ__pts { justify-self: end; color: var(--text-primary); }
	    .projected-champ__race { justify-self: end; color: var(--success); }
	    .projected-champ__delta { justify-self: end; color: var(--text-tertiary); }
	    .driver-proj-modal__overlay { position: fixed; inset: 0; z-index: 80; display: grid; place-items: center; padding: var(--space-9); background: rgba(3,6,12,0.72); backdrop-filter: blur(14px); }
	    .driver-proj-modal { width: min(620px, 100%); border-radius: var(--radius-md); border: 1px solid var(--accent-border); background: linear-gradient(135deg, rgba(45,123,255,0.13), transparent 42%), var(--surface-card); box-shadow: 0 28px 90px rgba(0,0,0,.48); padding: var(--space-8); }
	    .driver-proj-modal__head { display: flex; align-items: flex-start; justify-content: space-between; gap: var(--space-6); margin-bottom: var(--space-7); }
	    .driver-proj-modal__identity { display: flex; align-items: center; gap: var(--space-5); min-width: 0; }
	    .driver-proj-modal__eyebrow { color: var(--text-accent); font-size: var(--text-2xs); font-weight: 900; letter-spacing: var(--tracking-caps); text-transform: uppercase; }
	    .driver-proj-modal__title { margin-top: 3px; color: var(--text-strong); font-family: var(--font-display); font-size: var(--text-2xl); font-weight: 900; }
	    .driver-proj-modal__grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: var(--space-4); margin-bottom: var(--space-7); }
	    .driver-proj-modal__metric { padding: var(--space-5); border-radius: var(--radius-sm); border: 1px solid var(--border-subtle); background: var(--bg-sunken); }
	    .driver-proj-modal__metric span { display: block; color: var(--text-tertiary); font-size: var(--text-2xs); font-weight: 800; letter-spacing: var(--tracking-caps); text-transform: uppercase; }
	    .driver-proj-modal__metric b { display: block; margin-top: 5px; color: var(--text-primary); font-family: var(--font-mono); font-size: var(--text-lg); font-weight: 900; }
	    .driver-proj-modal__rationale { padding: var(--space-6); border-radius: var(--radius-sm); border: 1px solid var(--border-subtle); background: rgba(255,255,255,0.035); }
	    .driver-proj-modal__label { color: var(--text-tertiary); font-size: var(--text-2xs); font-weight: 900; letter-spacing: var(--tracking-caps); text-transform: uppercase; margin-bottom: var(--space-3); }
	    .driver-proj-modal__body { color: var(--text-secondary); font-size: var(--text-sm); line-height: 1.55; }
	    .race-watch { display: flex; flex-direction: column; gap: 3px; padding: var(--space-5); border-radius: var(--radius-sm); background: var(--bg-sunken); border: 1px solid var(--border-subtle); }
	    .race-watch__top { display: flex; justify-content: space-between; gap: var(--space-5); color: var(--text-primary); font-weight: 800; font-size: var(--text-sm); }
	    .race-watch__body { color: var(--text-secondary); font-size: var(--text-xs); line-height: 1.4; }
	    .race-pred__caveat { color: var(--text-tertiary); font-size: var(--text-2xs); line-height: 1.4; }
	    .champ-projection { display: flex; flex-direction: column; gap: var(--space-5); padding: var(--space-6); border-radius: var(--radius-sm); border: 1px solid color-mix(in srgb, var(--accent-border) 46%, var(--border-subtle)); background: linear-gradient(120% 140% at 100% 0, rgba(45,123,255,0.10), transparent 46%), var(--bg-sunken); }
	    .champ-projection__head { display: flex; justify-content: space-between; gap: var(--space-5); align-items: baseline; padding-bottom: var(--space-4); border-bottom: 1px solid var(--border-subtle); }
	    .champ-projection__title { color: var(--text-primary); font-family: var(--font-display); font-size: var(--text-md); font-weight: 800; }
	    .champ-projection__sub { color: var(--text-tertiary); font-size: var(--text-2xs); font-weight: 800; letter-spacing: var(--tracking-caps); text-transform: uppercase; }
	    .champ-projection__rows { display: flex; flex-direction: column; gap: var(--space-4); }
	    .champ-proj-row { display: grid; grid-template-columns: 34px minmax(104px, 0.85fr) minmax(140px, 1.25fr) 58px; gap: var(--space-5); align-items: center; min-width: 0; }
	    .champ-proj-row__rank { color: var(--text-tertiary); font-family: var(--font-mono); font-size: var(--text-2xs); font-weight: 900; }
	    .champ-proj-row__name { display: flex; align-items: center; gap: var(--space-4); min-width: 0; color: var(--text-primary); font-family: var(--font-display); font-size: var(--text-sm); font-weight: 800; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
	    .champ-proj-row__dot { width: 8px; height: 24px; border-radius: var(--radius-pill); background: var(--_c); box-shadow: 0 0 18px color-mix(in srgb, var(--_c) 42%, transparent); flex: none; }
	    .champ-proj-row__bar { height: 10px; border-radius: var(--radius-pill); background: rgba(255,255,255,0.07); overflow: hidden; }
	    .champ-proj-row__fill { width: var(--_w); height: 100%; border-radius: inherit; background: linear-gradient(90deg, var(--_c), color-mix(in srgb, var(--_c) 44%, #ffffff)); }
	    .champ-proj-row__score { justify-self: end; color: var(--text-primary); font-family: var(--font-mono); font-size: var(--text-xs); font-weight: 900; }
	    .champ-proj-row__why { grid-column: 2 / -1; color: var(--text-tertiary); font-size: var(--text-2xs); line-height: 1.35; }

	    /* Automatic analytics visuals */
    .insight-board { position: relative; overflow: hidden; border-radius: var(--radius-md); border: 1px solid var(--border-subtle);
      background: linear-gradient(120% 150% at 100% 0, rgba(45,123,255,0.10), transparent 44%), var(--surface-card); }
    .insight-board::before { content: ""; position: absolute; inset: 0; pointer-events: none;
      background-image: linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.022) 1px, transparent 1px);
      background-size: 44px 44px; mask-image: linear-gradient(180deg, rgba(0,0,0,0.75), transparent 72%); }
    .insight-board__head { position: relative; display: flex; justify-content: space-between; gap: var(--space-7); align-items: flex-end; padding: var(--space-7) var(--space-7) 0; }
    .insight-board__eyebrow { color: var(--text-tertiary); font-size: var(--text-2xs); font-weight: 700; letter-spacing: var(--tracking-caps); text-transform: uppercase; }
    .insight-board__title { margin-top: 3px; color: var(--text-primary); font-family: var(--font-display); font-weight: 800; font-size: var(--text-xl); }
    .insight-board__sub { color: var(--text-tertiary); font-size: var(--text-xs); text-align: right; max-width: 34ch; line-height: 1.35; }
    .metric-strip { position: relative; display: grid; grid-template-columns: repeat(3, 1fr); gap: var(--space-5); padding: var(--space-7); }
    .metric-chip { min-width: 0; border-radius: var(--radius-sm); border: 1px solid var(--border-subtle); background: rgba(255,255,255,0.035); padding: var(--space-5); }
    .metric-chip__label { color: var(--text-tertiary); font-size: var(--text-2xs); font-weight: 700; letter-spacing: var(--tracking-caps); text-transform: uppercase; }
    .metric-chip__value { margin-top: 5px; color: var(--text-strong); font-family: var(--font-mono); font-size: var(--text-xl); font-weight: 800; font-variant-numeric: tabular-nums; }
    .champ-ladder { position: relative; display: flex; flex-direction: column; gap: var(--space-4); padding: 0 var(--space-7) var(--space-7); }
    .champ-row { display: grid; grid-template-columns: 42px minmax(122px, 0.8fr) minmax(160px, 1.4fr) 74px 72px; gap: var(--space-5); align-items: center;
      min-height: 50px; padding: var(--space-4) var(--space-5); border-radius: var(--radius-sm); border: 1px solid rgba(255,255,255,0.055);
      background: linear-gradient(90deg, color-mix(in srgb, var(--_c) 18%, transparent), rgba(255,255,255,0.018) 42%, transparent); }
    .champ-row__pos { color: var(--text-tertiary); font-family: var(--font-mono); font-weight: 800; font-size: var(--text-xs); }
    .champ-row__name { display: flex; align-items: center; gap: var(--space-4); min-width: 0; color: var(--text-primary); font-weight: 800; font-family: var(--font-display); }
    .champ-row__stripe { width: 5px; height: 28px; border-radius: var(--radius-pill); background: var(--_c); box-shadow: 0 0 14px color-mix(in srgb, var(--_c) 45%, transparent); flex: none; }
    .champ-row__name span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .champ-row__bar { height: 12px; border-radius: var(--radius-pill); background: var(--bg-sunken); overflow: hidden; box-shadow: inset 0 0 0 1px rgba(255,255,255,0.035); }
    .champ-row__fill { width: var(--_w); height: 100%; border-radius: inherit; background: linear-gradient(90deg, var(--_c), color-mix(in srgb, var(--_c) 45%, #ffffff)); }
    .champ-row__pts { color: var(--text-primary); font-family: var(--font-mono); font-weight: 800; font-size: var(--text-md); text-align: right; font-variant-numeric: tabular-nums; }
    .champ-row__gap { justify-self: end; display: inline-flex; align-items: center; height: 24px; padding: 0 8px; border-radius: var(--radius-pill);
      background: var(--surface-raised); border: 1px solid var(--border-subtle); color: var(--text-tertiary); font-family: var(--font-mono); font-size: var(--text-2xs); font-weight: 700; }

    /* Storylines */
    .story { display: flex; gap: var(--space-7); padding: var(--space-7) 0; border-bottom: 1px solid var(--border-subtle); }
    .story:last-child { border-bottom: 0; }
    .story__icon { display: inline-grid; place-items: center; width: 34px; height: 34px; border-radius: var(--radius-sm); background: var(--accent-quiet); color: var(--accent); flex: none; }
    .story__tag { font-size: var(--text-2xs); color: var(--text-tertiary); text-transform: uppercase; letter-spacing: var(--tracking-caps); font-weight: 600; margin-bottom: 3px; }
    .story__text { font-size: var(--text-sm); color: var(--text-secondary); line-height: 1.5; text-wrap: pretty; }

    /* Factors */
    .factors { display: grid; grid-template-columns: repeat(2, 1fr); gap: var(--space-6); }
    .factor { display: grid; grid-template-columns: 48px minmax(0, 1fr); gap: var(--space-5); align-items: center; min-width: 0; padding: var(--space-5); border-radius: var(--radius-sm); background: var(--bg-sunken); border: 1px solid var(--border-subtle); }
    .factor__ring { position: relative; width: 44px; height: 44px; border-radius: 50%; background: conic-gradient(var(--_c) var(--_v), rgba(255,255,255,0.08) 0); display: grid; place-items: center; font-family: var(--font-mono); font-size: 10px; font-weight: 800; color: var(--text-primary); }
    .factor__ring::before { content: ""; position: absolute; inset: 6px; border-radius: 50%; background: var(--surface-card); border: 1px solid var(--border-subtle); }
    .factor__ring span { position: relative; }
    .factor__l { font-size: var(--text-sm); color: var(--text-primary); font-weight: 700; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .factor__hint { font-size: var(--text-2xs); color: var(--text-tertiary); margin-top: 4px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .cop-status-head { display: flex; align-items: center; justify-content: space-between; gap: var(--space-5); margin-bottom: var(--space-6); }
    .cop-status-head__text { min-width: 0; color: var(--text-secondary); font-size: var(--text-sm); line-height: 1.35; }
    .cop-progress { display: flex; flex-direction: column; gap: var(--space-4); margin-bottom: var(--space-6); padding: var(--space-5); border-radius: var(--radius-sm); border: 1px solid var(--border-subtle); background: var(--bg-sunken); }
    .cop-progress__top { display: flex; align-items: center; justify-content: space-between; gap: var(--space-5); color: var(--text-secondary); font-size: var(--text-xs); }
    .cop-progress__bar { height: 6px; border-radius: var(--radius-pill); background: rgba(255,255,255,0.07); overflow: hidden; }
    .cop-progress__fill { width: var(--_w); height: 100%; border-radius: inherit; background: linear-gradient(90deg, var(--accent), var(--success)); }
    .cop-progress__rows { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: var(--space-4); }
    .cop-progress__row { display: flex; align-items: center; gap: var(--space-4); min-width: 0; color: var(--text-tertiary); font-size: var(--text-xs); }
    .cop-progress__dot { width: 7px; height: 7px; border-radius: 50%; background: var(--text-tertiary); flex: none; }
    .cop-progress__row[data-state="thinking"] .cop-progress__dot { background: var(--accent); box-shadow: 0 0 0 4px var(--accent-quiet); }
    .cop-progress__row[data-state="computed"] .cop-progress__dot { background: var(--success); }
    .cop-progress__row[data-state="failed"] .cop-progress__dot { background: var(--danger); }
    .cop-progress__label { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

    /* In-progress button + detailed progress popup */
    .cop-hero__pending { display: flex; align-items: center; gap: var(--space-6); flex-wrap: wrap; }
    .cop-hero__pending-hint { color: var(--text-secondary); font-size: var(--text-sm); }
    .cop-inprogress-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--accent); animation: pw-pulse 1.4s var(--ease-in-out) infinite; }
    .cop-modal__overlay { position: fixed; inset: 0; z-index: 80; display: grid; place-items: center; padding: var(--space-8); background: rgba(4, 8, 16, 0.62); backdrop-filter: blur(6px); }
    .cop-modal { width: min(560px, 100%); max-height: min(82vh, 680px); overflow-y: auto; display: flex; flex-direction: column; gap: var(--space-7); padding: var(--space-9); border-radius: var(--radius-lg); border: 1px solid var(--accent-border);
      background: linear-gradient(120% 130% at 90% -20%, var(--accent-quiet), transparent 55%), var(--surface-card); box-shadow: 0 24px 60px rgba(0, 0, 0, 0.5); }
    .cop-modal__hd { display: flex; align-items: flex-start; justify-content: space-between; gap: var(--space-6); }
    .cop-modal__eyebrow { display: inline-flex; align-items: center; gap: var(--space-4); color: var(--text-accent); font-size: var(--text-2xs); font-weight: 700; letter-spacing: var(--tracking-caps); text-transform: uppercase; }
    .cop-modal__title { margin-top: 4px; color: var(--text-strong); font-family: var(--font-display); font-size: var(--text-lg); font-weight: 800; }
    .cop-modal__meta { display: flex; align-items: center; justify-content: space-between; gap: var(--space-5); color: var(--text-secondary); font-size: var(--text-xs); }
    .cop-modal__count { font-family: var(--font-mono); font-weight: 700; color: var(--text-primary); }
    .cop-modal__steps { display: flex; flex-direction: column; gap: var(--space-4); }
    .cop-modal__step { display: grid; grid-template-columns: 14px minmax(0, 1fr) auto; gap: var(--space-5); align-items: start; padding: var(--space-5); border-radius: var(--radius-sm); border: 1px solid var(--border-subtle); background: var(--bg-sunken); }
    .cop-modal__step-dot { width: 8px; height: 8px; margin-top: 5px; border-radius: 50%; background: var(--text-tertiary); }
    .cop-modal__step[data-state="thinking"] { border-color: var(--accent-border); }
    .cop-modal__step[data-state="thinking"] .cop-modal__step-dot { background: var(--accent); animation: pw-pulse 1.4s var(--ease-in-out) infinite; }
    .cop-modal__step[data-state="computed"] .cop-modal__step-dot { background: var(--success); }
    .cop-modal__step[data-state="failed"] .cop-modal__step-dot { background: var(--danger); }
    .cop-modal__step-title { color: var(--text-primary); font-size: var(--text-sm); font-weight: 700; }
    .cop-modal__step-detail { margin-top: 2px; color: var(--text-tertiary); font-size: var(--text-xs); line-height: 1.4; }
    .cop-modal__step-state { color: var(--text-tertiary); font-family: var(--font-mono); font-size: var(--text-2xs); font-weight: 700; text-transform: uppercase; white-space: nowrap; }
    .cop-modal__step[data-state="thinking"] .cop-modal__step-state { color: var(--text-accent); }
    .cop-modal__step[data-state="computed"] .cop-modal__step-state { color: var(--success); }
    .cop-modal__step[data-state="failed"] .cop-modal__step-state { color: var(--danger); }
    .cop-modal__error { padding: var(--space-5); border-radius: var(--radius-sm); border: 1px solid color-mix(in srgb, var(--danger) 45%, var(--border-subtle)); background: color-mix(in srgb, var(--danger) 12%, transparent); color: var(--text-secondary); font-size: var(--text-xs); line-height: 1.4; }
    .cop-modal__foot { color: var(--text-tertiary); font-size: var(--text-2xs); }
    @keyframes pw-pulse { 0%, 100% { box-shadow: 0 0 0 0 var(--accent-quiet); opacity: 1; } 50% { box-shadow: 0 0 0 6px transparent; opacity: 0.55; } }

    /* Chat panel */
    .cop-chat { display: flex; flex-direction: column; height: calc(100vh - var(--topbar-h) - var(--space-10) - 54px); position: relative; top: 0;
      border-radius: var(--radius-lg); border: 1px solid var(--border-default); background: var(--surface-card); overflow: hidden; }
    .cop-chat__hd { display: flex; align-items: center; gap: var(--space-6); padding: var(--space-7) var(--space-8); border-bottom: 1px solid var(--border-subtle); flex: none; }
    .cop-chat__avatar { width: 32px; height: 32px; border-radius: var(--radius-sm); display: grid; place-items: center; background: linear-gradient(135deg, var(--accent), var(--blue-700)); color: #fff; flex: none; }
    .cop-chat__t { font-size: var(--text-md); font-weight: 600; color: var(--text-primary); }
    .cop-chat__s { font-size: var(--text-2xs); color: var(--text-tertiary); display: flex; align-items: center; gap: 5px; }
    .cop-chat__status { width: 6px; height: 6px; border-radius: 50%; background: var(--success); }
    .cop-chat__msgs { flex: 1; overflow-y: auto; padding: var(--space-8); display: flex; flex-direction: column; gap: var(--space-7); min-height: 0; }
    .cmsg { font-size: var(--text-sm); line-height: 1.5; max-width: 88%; padding: var(--space-6) var(--space-7); border-radius: var(--radius-md); text-wrap: pretty; }
    .cmsg--ai { background: var(--surface-raised); border: 1px solid var(--border-subtle); color: var(--text-secondary); align-self: flex-start; border-bottom-left-radius: var(--radius-xs); }
    .cmsg--me { background: var(--accent); color: #fff; align-self: flex-end; border-bottom-right-radius: var(--radius-xs); }
    .cop-chat__suggest { display: flex; flex-direction: column; gap: var(--space-4); padding: 0 var(--space-8) var(--space-7); flex: none; }
    .suggest-chip { text-align: left; padding: var(--space-5) var(--space-7); border-radius: var(--radius-md); background: var(--surface-raised); border: 1px solid var(--border-subtle);
      color: var(--text-secondary); font-family: var(--font-sans); font-size: var(--text-sm); cursor: pointer; transition: var(--tr-control); display: flex; align-items: center; gap: var(--space-5); }
    .suggest-chip:hover { background: var(--surface-hover); color: var(--text-primary); border-color: var(--accent-border); }
    .cop-chat__compose { display: flex; align-items: center; gap: var(--space-5); padding: var(--space-7); border-top: 1px solid var(--border-subtle); flex: none; }
    .cop-chat__input { flex: 1; height: var(--size-control-md); padding: 0 var(--space-7); background: var(--bg-sunken); border: 1px solid var(--border-default);
      border-radius: var(--radius-pill); color: var(--text-primary); font-family: var(--font-sans); font-size: var(--text-sm); outline: none; transition: var(--tr-control); }
    .cop-chat__input:focus { border-color: var(--accent); box-shadow: 0 0 0 3px var(--accent-quiet); }
    .cop-chat__input::placeholder { color: var(--text-disabled); }
    .cop-chat__typing { display: inline-flex; gap: 3px; align-items: center; }
	    .cop-chat__typing i { width: 5px; height: 5px; border-radius: 50%; background: var(--text-tertiary); animation: pw-typing 1.2s var(--ease-in-out) infinite; }
	    .cop-chat__typing i:nth-child(2) { animation-delay: 0.15s; }
	    .cop-chat__typing i:nth-child(3) { animation-delay: 0.3s; }
	    .cmsg--visual { max-width: 100%; width: min(100%, 720px); }
	    .ai-vis { margin-top: var(--space-6); display: flex; flex-direction: column; gap: var(--space-5); min-width: 0; border: 1px solid var(--border-subtle); border-radius: var(--radius-md); background: var(--surface-card); padding: var(--space-6); }
	    .ai-vis__head { display: flex; align-items: baseline; flex-wrap: wrap; gap: var(--space-5); padding-bottom: var(--space-4); border-bottom: 1px solid var(--border-subtle); }
	    .ai-vis__title { color: var(--text-primary); font-weight: 800; font-size: var(--text-sm); }
	    .ai-vis__sub { color: var(--text-tertiary); font-size: var(--text-xs); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
	    .ai-vis__mode { display: inline-flex; align-items: center; height: 19px; padding: 0 7px; border-radius: var(--radius-pill); border: 1px solid var(--accent-border); background: var(--accent-quiet); color: var(--text-accent); font-family: var(--font-mono); font-size: 9px; font-weight: 800; text-transform: uppercase; white-space: nowrap; }
	    .ai-vis__row { display: grid; grid-template-columns: 86px minmax(120px, 0.8fr) minmax(180px, 1.4fr) 46px; gap: var(--space-5); align-items: center; padding: var(--space-5); border-radius: var(--radius-sm); background: var(--bg-sunken); border: 1px solid var(--border-subtle); }
	    .ai-vis__code { font-family: var(--font-display); font-weight: 900; color: var(--text-primary); font-size: var(--text-lg); line-height: 1; }
	    .ai-vis__label { margin-top: 3px; color: var(--text-tertiary); font-size: var(--text-2xs); text-transform: uppercase; letter-spacing: var(--tracking-caps); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
	    .ai-vis__meta { display: flex; flex-wrap: wrap; gap: 5px; min-width: 0; }
	    .ai-vis__pill { display: inline-flex; align-items: center; height: 20px; padding: 0 7px; border-radius: var(--radius-pill); background: var(--surface-raised); color: var(--text-secondary); border: 1px solid var(--border-subtle); font-family: var(--font-mono); font-size: 10px; text-transform: uppercase; }
	    .ai-vis__bars { display: flex; align-items: stretch; gap: 3px; min-width: 0; height: 28px; padding: 3px; border-radius: var(--radius-sm); background: rgba(255,255,255,0.045); overflow: hidden; }
	    .ai-vis__seg { min-width: 22px; border-radius: 4px; display: grid; place-items: center; color: rgba(0,0,0,0.72); font-family: var(--font-mono); font-size: 9px; font-weight: 900; box-shadow: inset 0 -8px 10px rgba(0,0,0,0.14); }
	    .ai-vis__quality { width: 38px; height: 38px; border-radius: 50%; justify-self: end; background: conic-gradient(var(--_c) var(--_v), rgba(255,255,255,0.08) 0); display: grid; place-items: center; font-family: var(--font-mono); font-size: 9px; font-weight: 900; color: var(--text-primary); position: relative; }
	    .ai-vis__quality::before { content: ""; position: absolute; inset: 5px; border-radius: 50%; background: var(--surface-card); border: 1px solid var(--border-subtle); }
	    .ai-vis__quality span { position: relative; }
	    .ai-vis__rec { grid-column: 1 / -1; color: var(--text-secondary); font-size: var(--text-xs); line-height: 1.35; }
	    .ai-vis__notes { margin: 0; padding-left: 17px; color: var(--text-tertiary); font-size: var(--text-xs); line-height: 1.4; }
	    @media (max-width: 1180px) { .cop-preds { grid-template-columns: 1fr; } .metric-strip { grid-template-columns: 1fr; } .champ-row { grid-template-columns: 38px minmax(96px, 0.8fr) minmax(120px, 1.2fr) 58px; } .champ-row__gap { display: none; } .cop-progress__rows { grid-template-columns: 1fr; } }
	    @media (max-width: 980px) { .cop-page { grid-template-columns: 1fr; } .cop-chat { height: min(680px, calc(100vh - 140px)); } .ai-vis__row { grid-template-columns: 60px 1fr; } .ai-vis__bars, .ai-vis__rec { grid-column: 1 / -1; } .ai-vis__quality { grid-column: 2; justify-self: start; } .factors { grid-template-columns: 1fr; } }
	    @media (max-width: 760px) { .race-pred__sections { grid-template-columns: 1fr; } .cop-hero__actions { width: 100%; justify-content: space-between; } .cop-status-head { flex-wrap: wrap; } .cop-status-head__text { flex-basis: 100%; } }
	    @keyframes pw-typing { 0%, 60%, 100% { opacity: 0.3; transform: translateY(0); } 30% { opacity: 1; transform: translateY(-3px); } }
	    @media (prefers-reduced-motion: reduce) { .cop-chat__typing i, .cop-inprogress-dot, .cop-modal__step-dot { animation: none; } }
	    `;
    document.head.appendChild(el);
  }

  const standingsColor = (i) => i === 0 ? "var(--accent)" : i === 1 ? "var(--t-personal)" : "var(--t-fastest)";
  const INSIGHT_TABS = [
    { id: "drivers-championship", label: "Drivers", icon: "trophy" },
    { id: "constructors-championship", label: "Constructors", icon: "layers" },
    { id: "current-weekend", label: "Current weekend", icon: "timer" },
    { id: "next-weekend", label: "Next weekend", icon: "calendar" },
    { id: "ask-copilot", label: "Ask Copilot", icon: "sparkles" },
  ];

	  function aiRequestOptions(payload) {
	    const selected = localStorage.getItem("pw-ai-model") || "";
	    if (!selected || selected === "local") return payload;
	    const [provider, ...modelParts] = selected.split(":");
	    if (provider !== "codex" && provider !== "grok") return payload;
	    const model = modelParts.join(":");
	    return provider && model ? { ...payload, provider, model } : payload;
	  }

	  const tyreColors = {
	    soft: "var(--tyre-soft)",
	    medium: "var(--tyre-medium)",
	    hard: "var(--tyre-hard)",
	    intermediate: "var(--tyre-inter)",
	    wet: "var(--tyre-wet)",
	    unknown: "var(--ink-300)",
	  };

	  function compoundColor(compound) {
	    return tyreColors[String(compound || "").toLowerCase()] || tyreColors.unknown;
	  }

	  const constructorPalette = {
	    MER: "#00d2be",
	    FER: "#dc0000",
	    MCL: "#ff8700",
	    RBR: "#3671c6",
	    AST: "#229971",
	    WIL: "#64c4ff",
	    RB: "#6692ff",
	    HAAS: "#b6babd",
	    SAU: "#52e252",
	    ALP: "#ff87bc",
	  };
		  const fallbackPalette = ["var(--accent)", "var(--t-personal)", "var(--t-fastest)", "var(--warning)", "var(--t-pit)", "var(--tyre-soft)", "var(--tyre-inter)", "var(--ink-300)"];
		  const RACE_POINTS = [25, 18, 15, 12, 10, 8, 6, 4, 2, 1];

	  function finiteValue(value, fallback = 0) {
	    const n = Number(value);
	    return Number.isFinite(n) ? n : fallback;
	  }

	  function pct(value, max) {
	    return Math.min(100, Math.max(4, max > 0 ? (value / max) * 100 : 0));
	  }

	  function gapLabel(points, leaderPoints) {
	    const gap = Math.round(leaderPoints - points);
	    return gap > 0 ? `-${gap}` : "Leader";
	  }

	  function driverVisualRows(D) {
	    const standings = Array.isArray(D.standings) ? D.standings.slice(0, 8) : [];
	    const leaderPoints = Math.max(1, ...standings.map((row) => finiteValue(row.pts)));
	    return standings.map((row, index) => {
	      const driver = D.byCode?.[row.code] || {};
	      const name = driver.name || row.name || row.code || "Driver";
	      return {
	        key: row.code || `driver-${index}`,
	        pos: row.pos || index + 1,
	        code: row.code || "DRV",
	        name: name.split(" ").slice(-1)[0] || name,
	        points: finiteValue(row.pts),
	        wins: finiteValue(row.wins),
	        color: driver.color || standingsColor(index),
	        width: pct(finiteValue(row.pts), leaderPoints),
	        gap: gapLabel(finiteValue(row.pts), leaderPoints),
	      };
	    });
	  }

	  function constructorVisualRows(D) {
	    const constructors = Array.isArray(D.constructors) ? D.constructors.slice(0, 8) : [];
	    const leaderPoints = Math.max(1, ...constructors.map((row) => finiteValue(row.pts)));
	    return constructors.map((row, index) => {
	      const code = row.abbr || row.code || String(row.name || "Team").slice(0, 3).toUpperCase();
	      return {
	        key: code || `team-${index}`,
	        pos: row.pos || index + 1,
	        code,
	        name: row.name || code,
	        points: finiteValue(row.pts),
	        color: row.color || constructorPalette[code] || fallbackPalette[index % fallbackPalette.length],
	        width: pct(finiteValue(row.pts), leaderPoints),
	        gap: gapLabel(finiteValue(row.pts), leaderPoints),
	      };
	    });
	  }

	  function metricValue(value, suffix = "") {
	    return value == null || value === "" ? "—" : `${value}${suffix}`;
	  }

	  function tyreAgeLabel(value) {
	    if (value == null || value === "") return "";
	    const text = String(value);
	    return text.toLowerCase().endsWith("l") ? text : `${text}L`;
	  }

	  function qualityColor(value) {
	    if (value >= 0.7) return "var(--success)";
	    if (value >= 0.4) return "var(--warning)";
	    return "var(--text-tertiary)";
	  }

	  function ChampionshipVisual({ D, pageId, dataSource }) {
	    if (pageId !== "drivers-championship" && pageId !== "constructors-championship") return null;
	    const isConstructors = pageId === "constructors-championship";
	    const rows = isConstructors ? constructorVisualRows(D) : driverVisualRows(D);
	    if (!rows.length) return null;
	    const leader = rows[0];
	    const second = rows[1];
	    const third = rows[2];
	    const title = isConstructors ? "Constructors pressure map" : "Drivers title pressure map";
	    const subtitle = isConstructors ? "Current constructor points, scaled to P1." : "Current driver points, scaled to the championship leader.";
	    return (
	      <div className="insight-board" data-kind={isConstructors ? "constructors" : "drivers"}>
	        <div className="insight-board__head">
	          <div>
	            <div className="insight-board__eyebrow">Automatic analytics visual</div>
	            <div className="insight-board__title">{title}</div>
	          </div>
	          <div className="insight-board__sub">{subtitle} Source: {dataSource}.</div>
	        </div>
	        <div className="metric-strip">
	          <div className="metric-chip">
	            <div className="metric-chip__label">Leader</div>
	            <div className="metric-chip__value">{leader.code} · {leader.points}</div>
	          </div>
	          <div className="metric-chip">
	            <div className="metric-chip__label">P2 gap</div>
	            <div className="metric-chip__value">{second ? second.gap : "—"}</div>
	          </div>
	          <div className="metric-chip">
	            <div className="metric-chip__label">{isConstructors ? "P3 gap" : "Leader wins"}</div>
	            <div className="metric-chip__value">{isConstructors ? (third ? third.gap : "—") : metricValue(leader.wins)}</div>
	          </div>
	        </div>
	        <div className="champ-ladder">
	          {rows.map((row) => (
	            <div className="champ-row" key={row.key} style={{ "--_c": row.color, "--_w": row.width + "%" }}>
	              <div className="champ-row__pos">P{row.pos}</div>
	              <div className="champ-row__name"><i className="champ-row__stripe" /><span>{row.code} · {row.name}</span></div>
	              <div className="champ-row__bar"><div className="champ-row__fill" /></div>
	              <div className="champ-row__pts">{row.points}</div>
	              <div className="champ-row__gap">{row.gap}</div>
	            </div>
	          ))}
	        </div>
	      </div>
	    );
	  }

	  function constructorForPrediction(D, code, label) {
	    const target = String(code || label || "").toLowerCase();
	    return (D.constructors || []).find((team) => [team.abbr, team.code, team.name].filter(Boolean).some((value) => String(value).toLowerCase() === target)) || {};
	  }

	  function championshipPredictionRows(D, predictions, pageId) {
	    if (pageId !== "drivers-championship" && pageId !== "constructors-championship") return [];
	    const source = (Array.isArray(predictions?.leaderboard) && predictions.leaderboard.length ? predictions.leaderboard : [])
	      .concat(Array.isArray(predictions?.winner) ? predictions.winner : [])
	      .concat(Array.isArray(predictions?.podium) ? predictions.podium : []);
	    const seen = new Set();
	    return source.map((item, index) => {
	      const key = String(item.code || item.label || index);
	      const dedupe = key.toLowerCase();
	      if (seen.has(dedupe)) return null;
	      seen.add(dedupe);
	      const isConstructor = pageId === "constructors-championship";
	      const constructor = isConstructor ? constructorForPrediction(D, item.code, item.label) : {};
	      const driver = isConstructor ? {} : (D.byCode?.[item.code] || {});
	      const score = Math.max(finiteValue(item.probability), finiteValue(item.confidence));
	      const color = constructor.color || driver.color || fallbackPalette[index % fallbackPalette.length];
	      return {
	        key,
	        name: item.label || constructor.name || driver.name || item.code || "Projection",
	        code: item.code || constructor.abbr || "",
	        score,
	        width: Math.max(5, Math.min(100, score * 100)),
	        color,
	        reason: item.reason || "",
	      };
	    }).filter(Boolean).slice(0, 8);
	  }

	  function ChampionshipPredictionVisual({ D, predictions, pageId }) {
	    const rows = championshipPredictionRows(D, predictions, pageId);
	    if (!rows.length) return null;
	    const isConstructors = pageId === "constructors-championship";
	    return (
	      <div className="champ-projection">
	        <div className="champ-projection__head">
	          <span className="champ-projection__title">{isConstructors ? "Constructors title projection" : "Drivers title projection"}</span>
	          <span className="champ-projection__sub">Prediction model</span>
	        </div>
	        <div className="champ-projection__rows">
	          {rows.map((row, index) => (
	            <div className="champ-proj-row" key={`${row.key}-${index}`} style={{ "--_c": row.color, "--_w": row.width + "%" }}>
	              <span className="champ-proj-row__rank">#{index + 1}</span>
	              <span className="champ-proj-row__name"><i className="champ-proj-row__dot" />{row.code ? `${row.code} · ` : ""}{row.name}</span>
	              <span className="champ-proj-row__bar"><span className="champ-proj-row__fill" /></span>
	              <span className="champ-proj-row__score">{predictionPercent(row.score)}</span>
	              {row.reason && <span className="champ-proj-row__why">{row.reason}</span>}
	            </div>
	          ))}
	        </div>
	      </div>
	    );
	  }

		  function predictionPercent(value) {
		    const n = finiteValue(value, 0);
		    return n > 0 ? `${Math.round(Math.max(0, Math.min(1, n)) * 100)}%` : "n/a";
		  }

		  function racePointsForPosition(index) {
		    return RACE_POINTS[index] || 0;
		  }

		  function projectedChampionshipRows(D, leaderboard) {
		    const racePointsByCode = new Map((leaderboard || []).map((item, index) => [String(item.code || "").toUpperCase(), racePointsForPosition(index)]));
		    return (D.standings || []).map((row, index) => {
		      const code = String(row.code || "").toUpperCase();
		      const driver = D.byCode?.[code] || {};
		      const racePoints = racePointsByCode.get(code) || 0;
		      return {
		        code,
		        name: driver.name || row.name || code || "Driver",
		        color: driver.color || standingsColor(index),
		        currentPos: finiteValue(row.pos, index + 1),
		        currentPoints: finiteValue(row.pts),
		        racePoints,
		        projectedPoints: finiteValue(row.pts) + racePoints,
		      };
		    }).sort((a, b) => b.projectedPoints - a.projectedPoints || a.currentPos - b.currentPos).map((row, index) => ({
		      ...row,
		      projectedPos: index + 1,
		      delta: row.currentPos - (index + 1),
		    })).slice(0, 10);
		  }

		  function ProjectedChampionshipLeaderboard({ D, leaderboard, pageId }) {
		    if (pageId !== "current-weekend" || !leaderboard?.length) return null;
		    const rows = projectedChampionshipRows(D, leaderboard);
		    if (!rows.length) return null;
		    return (
		      <div className="projected-champ">
		        <div className="projected-champ__head">
		          <span className="projected-champ__title">Championship Leaderboard After Race (projected)</span>
		          <span className="projected-champ__sub">Race points applied</span>
		        </div>
		        {rows.map((row) => (
		          <div className="projected-champ__row" key={row.code} style={{ "--_c": row.color }}>
		            <span className="projected-champ__pos">P{row.projectedPos}</span>
		            <span className="projected-champ__driver"><i className="projected-champ__stripe" />{row.code} · {row.name}</span>
		            <span className="projected-champ__pts">{row.projectedPoints} pts</span>
		            <span className="projected-champ__race">+{row.racePoints}</span>
		            <span className="projected-champ__delta">{row.delta > 0 ? `+${row.delta}` : row.delta < 0 ? String(row.delta) : "—"}</span>
		          </div>
		        ))}
		      </div>
		    );
		  }

		  function ProjectionDriverModal({ D, selection, onClose }) {
		    if (!selection) return null;
		    const { item, index } = selection;
		    const code = item.code || "";
		    const driver = D.byCode?.[code] || {};
		    const standingsRow = (D.standings || []).find((row) => row.code === code) || {};
		    const name = item.label || driver.name || code || "Driver";
		    const color = driver.color || standingsColor(index);
		    const racePoints = racePointsForPosition(index);
		    return (
		      <div className="driver-proj-modal__overlay" onClick={onClose} role="presentation">
		        <div className="driver-proj-modal" role="dialog" aria-modal="true" aria-label={`${name} projection detail`} onClick={(event) => event.stopPropagation()}>
		          <div className="driver-proj-modal__head">
		            <div className="driver-proj-modal__identity">
		              <Avatar initials={code || name.slice(0, 3).toUpperCase()} number={driver.num} ring={color} src={driver.remoteImage || driver.image} size="lg" />
		              <div>
		                <div className="driver-proj-modal__eyebrow">P{index + 1} race projection</div>
		                <div className="driver-proj-modal__title">{name}</div>
		              </div>
		            </div>
		            <IconButton variant="ghost" size="sm" label="Close projection detail" onClick={onClose}><Icon name="close" size={16} /></IconButton>
		          </div>
		          <div className="driver-proj-modal__grid">
		            <div className="driver-proj-modal__metric"><span>Probability</span><b>{predictionPercent(item.probability)}</b></div>
		            <div className="driver-proj-modal__metric"><span>Confidence</span><b>{predictionPercent(item.confidence)}</b></div>
		            <div className="driver-proj-modal__metric"><span>Race points</span><b>+{racePoints}</b></div>
		            <div className="driver-proj-modal__metric"><span>Current</span><b>{standingsRow.pos ? `P${standingsRow.pos}` : "n/a"}</b></div>
		          </div>
		          <div className="driver-proj-modal__rationale">
		            <div className="driver-proj-modal__label">Model rationale</div>
		            <div className="driver-proj-modal__body">{item.reason || "The model did not return a detailed rationale for this driver."}</div>
		          </div>
		        </div>
		      </div>
		    );
		  }

	  function PredictionCandidate({ D, item, index, kind, pageId }) {
	    const code = item.code || "";
	    const isConstructor = pageId === "constructors-championship";
	    const driver = D.byCode?.[code] || {};
	    const constructor = isConstructor ? constructorForPrediction(D, code, item.label) : {};
	    const name = item.label || driver.name || code || "Driver";
	    const confidence = Math.max(0, Math.min(1, finiteValue(item.confidence, 0)));
	    const color = constructor.color || driver.color || standingsColor(index);
	    return (
	      <div className="race-pick" style={{ "--_c": color, "--_w": Math.max(5, confidence * 100) + "%" }}>
	        <Avatar initials={code || name.slice(0, 3).toUpperCase()} number={isConstructor ? "" : driver.num} ring={color} src={isConstructor ? constructor.logo : (driver.remoteImage || driver.image)} square={isConstructor} size="sm" />
	        <div>
	          <div className="race-pick__name">{name}</div>
	          <div className="race-pick__meta"><span>{kind}</span><span>confidence {predictionPercent(confidence)}</span></div>
	        </div>
	        <div className="race-pick__score">{predictionPercent(item.probability)}</div>
	        <div className="race-pick__bar"><div className="race-pick__fill" /></div>
	        {item.reason && <div className="race-pick__reason">{item.reason}</div>}
	      </div>
	    );
	  }

	  function predictionBoardLabels(pageId) {
	    if (pageId === "drivers-championship" || pageId === "constructors-championship") {
	      return {
	        winner: "Title picks",
	        podium: "Contenders",
	        watchlist: "Watchlist",
	        winnerKind: "title",
	        podiumKind: () => "contender",
	      };
	    }
	    return {
	      winner: "Winner picks",
	      podium: "Podium",
	      watchlist: "Watchlist",
	      winnerKind: "win",
	      podiumKind: (index) => `P${index + 1}`,
	    };
	  }

		  function PredictionBoard({ D, predictions, pageId }) {
		    const [selectedProjectionDriver, setSelectedProjectionDriver] = React.useState(null);
		    if (!predictions?.available) return null;
		    const labels = predictionBoardLabels(pageId);
	    const winner = Array.isArray(predictions.winner) ? predictions.winner.slice(0, 3) : [];
	    const podium = Array.isArray(predictions.podium) ? predictions.podium.slice(0, 3) : [];
	    const leaderboard = Array.isArray(predictions.leaderboard) ? predictions.leaderboard.slice(0, 22) : [];
	    const watchlist = Array.isArray(predictions.watchlist) ? predictions.watchlist.slice(0, 4) : [];
	    if (!winner.length && !podium.length && !leaderboard.length && !watchlist.length) return null;
	    return (
	      <section className="race-pred">
	        <div className="race-pred__head">
	          <div>
	            <div className="race-pred__eyebrow"><Icon name="sparkles" size={13} /> AI projections</div>
	            <div className="race-pred__title">{predictions.title || "Race predictions"}</div>
	          </div>
	          <Badge tone="success">Computed</Badge>
	        </div>
	        {predictions.summary && <div className="race-pred__summary">{predictions.summary}</div>}
	        <ChampionshipPredictionVisual D={D} predictions={predictions} pageId={pageId} />
	        <div className="race-pred__sections">
	          {winner.length > 0 && (
	            <div className="race-pred__section">
	              <div className="race-pred__label">{labels.winner}</div>
	              {winner.map((item, index) => <PredictionCandidate D={D} item={item} index={index} kind={labels.winnerKind} pageId={pageId} key={`${item.code || "win"}-${index}`} />)}
	            </div>
	          )}
	          {podium.length > 0 && (
	            <div className="race-pred__section">
	              <div className="race-pred__label">{labels.podium}</div>
	              {podium.map((item, index) => <PredictionCandidate D={D} item={item} index={index} kind={labels.podiumKind(index)} pageId={pageId} key={`${item.code || "podium"}-${index}`} />)}
	            </div>
	          )}
	          {leaderboard.length > 0 && (
	            <div className="race-pred__section race-pred__section--wide">
	              <div className="race-pred__label">Full leaderboard</div>
	              <div className="race-board">
	                {leaderboard.map((item, index) => {
	                  const code = item.code || "";
	                  const driver = D.byCode?.[code] || {};
	                  const name = item.label || driver.name || code || "Driver";
	                  return (
		                    <button className="race-board__row" type="button" onClick={() => setSelectedProjectionDriver({ item, index })} key={`${code || name}-${index}`}>
		                      <span className="race-board__pos">P{index + 1}</span>
		                      <span className="race-board__driver">{name}</span>
		                      <span className="race-board__prob">{predictionPercent(item.probability)}</span>
		                      {item.reason && <span className="race-board__reason">{item.reason}</span>}
		                    </button>
		                  );
		                })}
		              </div>
		              <ProjectedChampionshipLeaderboard D={D} leaderboard={leaderboard} pageId={pageId} />
		            </div>
		          )}
	          {watchlist.length > 0 && (
	            <div className="race-pred__section race-pred__section--wide">
	              <div className="race-pred__label">{labels.watchlist}</div>
	              {watchlist.map((item, index) => (
	                <div className="race-watch" key={`${item.label || "watch"}-${index}`}>
	                  <div className="race-watch__top"><span>{item.label || "Prediction"}</span><span>{predictionPercent(item.confidence)}</span></div>
	                  <div className="race-watch__body">{item.prediction || item.reason}</div>
	                </div>
	              ))}
	            </div>
	          )}
		        </div>
		        <ProjectionDriverModal D={D} selection={selectedProjectionDriver} onClose={() => setSelectedProjectionDriver(null)} />
		        {predictions.caveat && <div className="race-pred__caveat">{predictions.caveat}</div>}
	      </section>
	    );
	  }

	  function StrategyVisualization({ visualization }) {
	    if (!visualization || visualization.kind === "none") return null;
	    const rows = Array.isArray(visualization.rows) ? visualization.rows : [];
	    if (!rows.length && !visualization.title) return null;
	    const projectedStints = String(visualization.stintMode || "").toLowerCase() === "projected";
	    return (
	      <div className="ai-vis" data-kind={visualization.kind}>
	        <div className="ai-vis__head">
	          <span className="ai-vis__title">{visualization.title || "Strategy view"}</span>
	          {visualization.subtitle && <span className="ai-vis__sub">{visualization.subtitle}</span>}
	          {projectedStints && <span className="ai-vis__mode">Projected strategy</span>}
	        </div>
	        {rows.map((row, index) => {
	          const stints = Array.isArray(row.stints) ? row.stints : [];
	          const confidence = Math.max(0, Math.min(1, finiteValue(row.confidence, 0)));
	          const confidencePct = Math.round(confidence * 100);
	          return (
	            <div className="ai-vis__row" key={`${row.code || "row"}-${index}`}>
	              <div>
	                <div className="ai-vis__code">{row.code || row.label || "—"}</div>
	                {row.label && <div className="ai-vis__label">{row.label}</div>}
	              </div>
	              <div className="ai-vis__meta">
	                {row.currentCompound && <span className="ai-vis__pill" style={{ borderColor: compoundColor(row.currentCompound) }}>{row.currentCompound}</span>}
	                {row.tyreAge && <span className="ai-vis__pill">{tyreAgeLabel(row.tyreAge)}</span>}
	                {row.pitStops && <span className="ai-vis__pill">{row.pitStops} stop{String(row.pitStops) === "1" ? "" : "s"}</span>}
	              </div>
	              <div className="ai-vis__bars">
	                {stints.length ? stints.map((stint, i) => (
	                  <span className="ai-vis__seg" key={i} style={{ width: Math.max(20, Number(stint.laps || 1) * 5), background: compoundColor(stint.compound) }}>{stint.laps || ""}</span>
	                )) : <span className="ai-vis__pill">Awaiting stint trace</span>}
	              </div>
	              {row.confidence != null && <div className="ai-vis__quality" style={{ "--_v": confidencePct + "%", "--_c": qualityColor(confidence) }}><span>{confidencePct}%</span></div>}
	              {row.recommendation && <div className="ai-vis__rec">{row.recommendation}</div>}
	            </div>
	          );
	        })}
	        {Array.isArray(visualization.notes) && visualization.notes.length > 0 && (
	          <ul className="ai-vis__notes">{visualization.notes.slice(0, 3).map((note, index) => <li key={index}>{note}</li>)}</ul>
	        )}
	      </div>
	    );
	  }

	  function AiMessage({ message }) {
	    const hasVisual = Boolean(message.visualization);
	    return (
	      <div className={"cmsg " + (message.who === "me" ? "cmsg--me" : "cmsg--ai") + (hasVisual ? " cmsg--visual" : "")}>
	        {message.text}
	        {hasVisual && <StrategyVisualization visualization={message.visualization} />}
	      </div>
	    );
	  }

	  const PAGE_PROCESS_DETAILS = {
	    "drivers-championship": "Projects the drivers' title winner, contenders, and watchlist from standings, wins, form, and news.",
	    "constructors-championship": "Projects the constructors' title from team points, driver pairings, and reliability signals.",
	    "current-weekend": "Computes race winner, podium, and watchlist picks from this weekend's sessions, weather, and tyre data.",
	    "next-weekend": "Builds the full predicted finishing order for the next Grand Prix from season pace and track history.",
	  };
	  const STEP_STATE_LABELS = { waiting: "Queued", thinking: "Analyzing", computed: "Done", failed: "Failed" };

	  function DailyProgressModal({ progress, items, completed, total, pct, onClose }) {
	    React.useEffect(() => {
	      function onKeyDown(event) {
	        if (event.key === "Escape") onClose();
	      }
	      window.addEventListener("keydown", onKeyDown);
	      return () => window.removeEventListener("keydown", onKeyDown);
	    }, [onClose]);
	    const updatedLabel = progress.updatedAt ? new Date(progress.updatedAt).toLocaleTimeString() : "";
	    return (
	      <div className="cop-modal__overlay" onClick={onClose} role="presentation">
	        <div className="cop-modal" role="dialog" aria-modal="true" aria-label="Daily AI insight progress" onClick={(event) => event.stopPropagation()}>
	          <div className="cop-modal__hd">
	            <div>
	              <div className="cop-modal__eyebrow"><Icon name="sparkles" size={13} /> Daily AI calculation</div>
	              <div className="cop-modal__title">{progress.statusText || "Daily AI insight generation is running."}</div>
	            </div>
	            <IconButton variant="ghost" size="sm" label="Close progress" onClick={onClose}><Icon name="close" size={16} /></IconButton>
	          </div>
	          <div>
	            <div className="cop-modal__meta">
	              <span>{progress.currentPageTitle ? `Currently working on ${progress.currentPageTitle}` : "Waiting for the daily run to start"}</span>
	              <span className="cop-modal__count">{completed}/{total} pages</span>
	            </div>
	            <div className="cop-progress__bar" style={{ marginTop: "var(--space-4)" }} aria-hidden="true"><div className="cop-progress__fill" style={{ "--_w": pct + "%" }} /></div>
	          </div>
	          <div className="cop-modal__steps">
	            {items.map((item) => (
	              <div className="cop-modal__step" data-state={item.status} key={item.id || item.title}>
	                <span className="cop-modal__step-dot" />
	                <div>
	                  <div className="cop-modal__step-title">{item.title || item.id}</div>
	                  <div className="cop-modal__step-detail">{PAGE_PROCESS_DETAILS[item.id] || "Builds this page's daily AI insight from the loaded snapshot."}</div>
	                </div>
	                <span className="cop-modal__step-state">{STEP_STATE_LABELS[item.status] || item.status}</span>
	              </div>
	            ))}
	          </div>
	          {progress.error && <div className="cop-modal__error">{progress.error}</div>}
	          <div className="cop-modal__foot">Live status refreshes automatically every 5 seconds{updatedLabel ? ` · last update ${updatedLabel}` : ""}.</div>
	        </div>
	      </div>
	    );
	  }

	  function Copilot() {
    const { data: D, connection, dataSource, refreshData } = window.PW.usePitWall();
    const daily = D.copilot?.daily || {
      status: connection.aiConfigured ? "pending" : "not_configured",
      generatedOn: "",
      generatedAt: "",
      attemptedOn: "",
      progress: null,
      pages: [],
    };
    const dailyPages = Array.isArray(daily.pages) ? daily.pages : [];
    const [activeTab, setActiveTab] = React.useState("drivers-championship");
    const leaderRows = D.standings.slice(0, 3);
    const leaderPoints = Math.max(1, Number(leaderRows[0]?.pts || 0));
    const loadedFeedCount = [
      D.standings.length,
      D.timing.length,
      D.news.length,
      D.race?.name && D.race.name !== "Formula 1",
    ].filter(Boolean).length;
    const totalFeedCount = 4;
    const projectionStatus = daily.status === "ready"
      ? `Daily AI insights computed ${daily.generatedOn || "today"}.`
      : daily.status === "failed"
        ? `No AI projection computed today. ${daily.error || "Daily calculation failed."}`
        : daily.status === "pending"
          ? "Daily AI insight generation is queued or running. This page will update after the daily calculation finishes."
          : "No AI projection computed. Connect an AI provider to generate daily prebuilt insights.";
    const progress = daily.progress || {};
    const progressItems = Array.isArray(progress.items) && progress.items.length ? progress.items : INSIGHT_TABS.filter((tab) => tab.id !== "ask-copilot").map((tab) => ({
      id: tab.id,
      title: tab.label,
      status: daily.status === "ready" ? "computed" : daily.status === "failed" ? "failed" : "waiting",
    }));
    const progressTotal = Math.max(1, Number(progress.totalPages || progressItems.length || 1));
    const progressCompleted = Math.max(0, Math.min(progressTotal, Number(progress.completedPages || (daily.status === "ready" ? progressTotal : 0))));
    const progressPct = Math.round((progressCompleted / progressTotal) * 100);
    const standingsCards = leaderRows.map((row, index) => ({
      code: row.code,
      label: `P${index + 1} in standings`,
      points: Number(row.pts || 0),
      bar: Number(row.pts || 0) / leaderPoints,
      note: `This card only reflects points from ${dataSource}.`,
    }));
    const factors = [
      { label: "AI daily page", value: daily.status === "ready" ? 100 : daily.status === "pending" ? 50 : 0, hint: projectionStatus },
      { label: "Standings feed", value: D.standings.length ? 100 : 0, hint: dataSource },
      { label: "Timing feed", value: D.timing.length ? 100 : 0, hint: dataSource },
      { label: "News feed", value: D.news.length ? 100 : 0, hint: dataSource },
    ];
    const suggested = [
      "Summarize the current standings",
      "What changed in the latest news?",
      "What is the next session?",
      "What data is still missing?",
    ];
    const initialChat = [
      { who: "ai", text: connection.aiConfigured ? "Ask me anything about the loaded F1 snapshot. Prebuilt insight tabs update once per day." : "Connect an AI provider in Settings, then I can answer questions about the loaded F1 snapshot." },
    ];
    const [messages, setMessages] = React.useState(initialChat);
    const [draft, setDraft] = React.useState("");
    const [typing, setTyping] = React.useState(false);
    const [progressOpen, setProgressOpen] = React.useState(false);
    const [progressModalOpen, setProgressModalOpen] = React.useState(false);
    const [rerunningScope, setRerunningScope] = React.useState("");
    const dailyPending = daily.status === "pending";
    const rerunning = Boolean(rerunningScope);
    const msgsRef = React.useRef(null);
    const selectedTab = INSIGHT_TABS.find((tab) => tab.id === activeTab) || INSIGHT_TABS[0];
    const selectedPage = dailyPages.find((page) => page.id === activeTab) || {
      id: selectedTab.id,
      title: selectedTab.label,
      kicker: "Daily prebuilt insight",
      summary: projectionStatus,
	      computed: false,
	      alerts: [],
	      visualization: null,
	      predictions: { available: false, title: "", summary: "", winner: [], podium: [], leaderboard: [], watchlist: [], caveat: "" },
	    };
	    const showAiVisualization = activeTab !== "drivers-championship" && activeTab !== "constructors-championship";
	    const showPredictionBoard = Boolean(selectedPage.predictions?.available);

    React.useEffect(() => {
      if (msgsRef.current) msgsRef.current.scrollTop = msgsRef.current.scrollHeight;
    }, [messages, typing]);

    React.useEffect(() => {
      if (daily.status !== "pending" || !refreshData) return undefined;
      const timer = setInterval(() => refreshData(), 5000);
      return () => clearInterval(timer);
    }, [daily.status, refreshData]);

	    function aiSnapshot() {
	      return {
	        race: D.race,
	        seasonSummary: D.seasonSummary,
	        drivers: D.drivers.slice(0, 22),
	        standings: D.standings.slice(0, 22),
	        constructors: D.constructors.slice(0, 11),
	        sessions: D.sessions || [],
	        timing: D.timing.slice(0, 22),
	        battlePairs: D.battlePairs || [],
	        strategyContext: D.strategyContext || null,
	        news: D.news.slice(0, 8),
	        source: dataSource,
	      };
    }

    async function send(text) {
      const q = (text || draft).trim();
      if (!q) return;
      setMessages((m) => [...m, { who: "me", text: q }]);
      setDraft("");
      setTyping(true);
      if (!connection.aiConfigured || !window.pitwall?.ai?.ask) {
        setTyping(false);
        setMessages((m) => [...m, { who: "ai", text: "Connect an AI provider in Settings, then I can send this live snapshot to your chosen provider for strategy reasoning." }]);
        return;
      }
      try {
	        const answer = await window.pitwall.ai.ask(aiRequestOptions({ prompt: q, snapshot: aiSnapshot() }));
	        setMessages((m) => [...m, { who: "ai", text: answer.summary || canned(q), visualization: answer.visualization || null }]);
      } catch (error) {
        setMessages((m) => [...m, { who: "ai", text: error.message || "The configured AI provider did not return a response." }]);
      } finally {
        setTyping(false);
      }
    }

    function canned(q) {
      const s = q.toLowerCase();
      if (!connection.aiConfigured) return "AI reasoning is not configured yet. Connect an AI provider in Settings, then I can analyze the live snapshot instead of using canned text.";
      if (s.includes("weather")) return D.race?.weather?.cond ? `Latest OpenF1 weather condition: ${D.race.weather.cond}. Air ${D.race.weather.air || "—"}°, track ${D.race.weather.track || "—"}°.` : "OpenF1 has not returned current weather for the latest session yet.";
      if (s.includes("standings") || s.includes("leader")) return D.standings.length ? `Current leader: ${D.byCode[D.standings[0].code]?.name || D.standings[0].code} on ${D.standings[0].pts} points.` : "Current standings have not loaded yet.";
      if (s.includes("news")) return D.news[0] ? `Latest story from ${D.news[0].source}: ${D.news[0].title}` : "No RSS stories have loaded yet.";
      if (s.includes("session") || s.includes("schedule")) return D.race?.name ? `Next loaded event: ${D.race.name} at ${D.race.circuit || D.race.loc || "the listed circuit"}.` : "The schedule feed has not loaded yet.";
      return "I can use the current standings, schedule, weather, news, and timing snapshot. Ask about one of those and I will ground the answer in the loaded data.";
    }

    function newChat() {
      setMessages(initialChat.slice(0, 1));
      setDraft("");
      setTyping(false);
    }

    async function rerunAnalysis(scope = "all") {
      if (!refreshData || rerunning || dailyPending) return;
      const scoped = scope === "tab" && activeTab !== "ask-copilot";
      setRerunningScope(scoped ? "tab" : "all");
      setProgressOpen(true);
      try {
        await refreshData({ forceRefresh: true, forceCopilotRefresh: true, forceCopilotPageId: scoped ? activeTab : "" });
      } finally {
        setRerunningScope("");
      }
    }

    const chatPanel = (
      <div className="cop-chat">
          <div className="cop-chat__hd">
            <span className="cop-chat__avatar"><Icon name="sparkles" size={17} /></span>
            <div style={{ flex: 1 }}>
              <div className="cop-chat__t">Race Engineer</div>
              <div className="cop-chat__s"><span className="cop-chat__status" /> {connection.aiConfigured ? "Online · configured provider" : "Waiting for provider"}</div>
            </div>
            <IconButton variant="ghost" size="sm" label="New chat" onClick={newChat}><Icon name="plus" size={16} /></IconButton>
          </div>

          <div className="cop-chat__msgs" ref={msgsRef}>
	            {messages.map((m, i) => <AiMessage message={m} key={i} />)}
            {typing && <div className="cmsg cmsg--ai"><span className="cop-chat__typing"><i /><i /><i /></span></div>}
          </div>

          {messages.length <= 3 && (
            <div className="cop-chat__suggest">
              {suggested.map((q, i) => (
                <button key={i} className="suggest-chip" onClick={() => send(q)}>
                  <Icon name="chevronRight" size={13} /> {q}
                </button>
              ))}
            </div>
          )}

          <div className="cop-chat__compose">
            <input className="cop-chat__input" placeholder="Ask about the race weekend…" value={draft}
              onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send()} />
            <IconButton variant="accent" label="Send" onClick={() => send()}><Icon name="chevronRight" size={17} /></IconButton>
          </div>
        </div>
    );

    return (
      <div className="cop">
        <div className="cop-tabs" role="tablist" aria-label="Copilot views">
          {INSIGHT_TABS.map((tab) => (
            <button className="cop-tab" key={tab.id} data-active={activeTab === tab.id} onClick={() => setActiveTab(tab.id)}>
              <Icon name={tab.icon} size={14} /> {tab.label}
            </button>
          ))}
        </div>

        {activeTab === "ask-copilot" ? (
          <div className="cop-page cop-page--chat">{chatPanel}</div>
        ) : (
          <div className={`cop-page${showPredictionBoard ? " cop-page--projections" : ""}`}>
            <div className="cop__main">
              <section className="cop-hero">
                <div className="cop-hero__top">
                  <span className="cop-hero__badge"><Icon name="sparkles" size={13} /> Daily prebuilt insight</span>
                  <Badge tone={daily.status === "ready" ? "success" : "neutral"}>{daily.status === "ready" ? "Computed" : "Not computed"}</Badge>
                  <div className="cop-hero__actions">
                    <Button size="sm" variant="ghost" onClick={() => rerunAnalysis("tab")} disabled={rerunning || dailyPending} iconLeft={<Icon name="timer" size={13} />}>
                      {rerunningScope === "tab" ? "Rerunning" : "Rerun this tab"}
                    </Button>
                    <span className="cop-hero__model"><Icon name="key" size={12} /> {daily.generatedOn ? `Updated ${daily.generatedOn}` : "Updates once per day"}</span>
                  </div>
                </div>
                <h2 className="cop-hero__h">{selectedPage.title || selectedTab.label}</h2>
                {dailyPending ? (
                  <div className="cop-hero__pending">
                    <Button size="sm" variant="secondary" onClick={() => setProgressModalOpen(true)} iconLeft={<span className="cop-inprogress-dot" />} aria-haspopup="dialog">
                      In Progress
                    </Button>
                    <span className="cop-hero__pending-hint">{progress.statusText || "Daily AI insight generation is running."}</span>
                  </div>
                ) : (
                  <p className="cop-hero__sum">{selectedPage.summary || projectionStatus}</p>
                )}
                <div className="cop-hero__conf">
                  <span style={{ fontSize: 11, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 600 }}>Data coverage</span>
                  <div className="cop-conf__track"><div className="cop-conf__fill" style={{ width: (loadedFeedCount / totalFeedCount) * 100 + "%" }} /></div>
                  <span style={{ fontFamily: "var(--font-mono)", fontWeight: 600, color: "var(--text-primary)" }}>{loadedFeedCount}/{totalFeedCount}</span>
                  <span style={{ marginLeft: "auto", fontSize: 12, color: "var(--text-tertiary)" }}>{dailyPending ? "Daily AI calculation in progress" : projectionStatus}</span>
                </div>
              </section>

              <div className="insight-panel">
                <ChampionshipVisual D={D} pageId={activeTab} dataSource={dataSource} />
                {showAiVisualization && <StrategyVisualization visualization={selectedPage.visualization} />}
              </div>
            </div>

	            <div className="cop__main">
	              {showPredictionBoard ? (
	                <PredictionBoard D={D} predictions={selectedPage.predictions} pageId={activeTab} />
	              ) : (
	                <div className="cop-preds">
	                  {standingsCards.map((p, i) => {
	                    const d = D.byCode[p.code] || { name: p.code || "Driver", num: "", color: "var(--accent)", image: "" };
	                    return (
	                      <div className="pred" key={p.code}>
	                        <div className="pred__top">
	                          <Avatar initials={p.code} number={d.num} ring={d.color} src={d.remoteImage || d.image} size="md" />
	                          <div><div className="pred__label">{p.label}</div><div className="pred__name">{d.name.split(" ")[1] || d.name}</div></div>
	                        </div>
	                        <div className="pred__metric"><span className="pred__metricv">{p.points}</span><span className="pred__metricu">pts</span></div>
	                        <div className="pred__track"><div className="pred__fill" style={{ width: Math.min(100, Math.max(0, p.bar * 100)) + "%", background: standingsColor(i) }} /></div>
	                        <div className="pred__note">{p.note}</div>
	                      </div>
	                    );
	                  })}
	                </div>
	              )}

	              <Card title="Daily status" subtitle="One automatic AI calculation per day" aside={<Icon name="sparkles" size={15} />} padding="default">
                <div className="cop-status-head">
                  <div className="cop-status-head__text">{progress.statusText || (dailyPending ? "Daily AI calculation in progress." : projectionStatus)}</div>
                  <Button size="sm" variant="ghost" onClick={() => rerunAnalysis("all")} disabled={rerunning || dailyPending} iconLeft={<Icon name="timer" size={13} />}>
                    {rerunningScope === "all" ? "Rerunning" : "Rerun all"}
                  </Button>
                  <Button size="sm" variant={progressOpen ? "secondary" : "ghost"} onClick={() => setProgressOpen((open) => !open)} iconLeft={<Icon name="timer" size={13} />} aria-expanded={progressOpen}>
                    {progressOpen ? "Hide progress" : "Show progress"}
                  </Button>
                </div>
                {progressOpen && (
                  <div className="cop-progress">
                    <div className="cop-progress__top">
                      <span>{progress.currentPageTitle || "Daily AI projections"}</span>
                      <span>{progressCompleted}/{progressTotal}</span>
                    </div>
                    <div className="cop-progress__bar" aria-hidden="true"><div className="cop-progress__fill" style={{ "--_w": progressPct + "%" }} /></div>
                    <div className="cop-progress__rows">
                      {progressItems.map((item) => (
                        <div className="cop-progress__row" data-state={item.status} key={item.id || item.title}>
                          <span className="cop-progress__dot" />
                          <span className="cop-progress__label">{item.title || item.id}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                <div className="factors">
                  {factors.map((f, i) => {
                    const color = f.value >= 80 ? "var(--success)" : f.value > 35 ? "var(--warning)" : "var(--text-tertiary)";
                    return (
                    <div className="factor" key={i}>
                      <div className="factor__ring" style={{ "--_v": f.value + "%", "--_c": color }}><span>{f.value}</span></div>
                      <div>
                        <div className="factor__l">{f.label}</div>
                        <div className="factor__hint">{f.hint}</div>
                      </div>
                    </div>
                    );
                  })}
                </div>
              </Card>
            </div>
          </div>
        )}
        {progressModalOpen && (
          <DailyProgressModal
            progress={progress}
            items={progressItems}
            completed={progressCompleted}
            total={progressTotal}
            pct={progressPct}
            onClose={() => setProgressModalOpen(false)}
          />
        )}
      </div>
    );
  }

  window.PW = window.PW || {};
  window.PW.Copilot = Copilot;
})();
