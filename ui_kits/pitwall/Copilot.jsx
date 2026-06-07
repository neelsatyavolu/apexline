/* PitWall AI Copilot — race-weekend AI analysis + chatbot. window.PW.Copilot */
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
    .insight-meta { display: flex; flex-wrap: wrap; gap: var(--space-5); color: var(--text-tertiary); font-size: var(--text-xs); }
    .insight-list { display: flex; flex-direction: column; gap: var(--space-5); }
    .insight-item { padding: var(--space-6); border-radius: var(--radius-sm); background: var(--surface-raised); border: 1px solid var(--border-subtle); color: var(--text-secondary); font-size: var(--text-sm); line-height: 1.45; }
    .insight-empty { padding: var(--space-8); border-radius: var(--radius-md); border: 1px dashed var(--border-default); color: var(--text-tertiary); font-size: var(--text-sm); line-height: 1.5; }

    /* Hero analysis */
    .cop-hero { position: relative; overflow: hidden; border-radius: var(--radius-lg); border: 1px solid var(--accent-border);
      background: linear-gradient(120% 130% at 90% -20%, var(--accent-quiet), transparent 55%), var(--surface-card); padding: var(--space-9); }
    .cop-hero__top { display: flex; align-items: center; gap: var(--space-6); margin-bottom: var(--space-7); }
    .cop-hero__badge { display: inline-flex; align-items: center; gap: var(--space-4); padding: 4px 10px 4px 8px; border-radius: var(--radius-pill);
      background: var(--accent-quiet); color: var(--text-accent); font-size: var(--text-2xs); font-weight: 600; letter-spacing: var(--tracking-caps); text-transform: uppercase; }
    .cop-hero__model { margin-left: auto; font-family: var(--font-mono); font-size: var(--text-2xs); color: var(--text-tertiary); display: flex; align-items: center; gap: 5px; }
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
	    .race-pred { display: flex; flex-direction: column; gap: var(--space-6); padding: var(--space-8); border-radius: var(--radius-md); background: linear-gradient(140% 120% at 100% 0, rgba(93,232,174,0.12), transparent 42%), var(--surface-card); border: 1px solid var(--border-subtle); }
	    .race-pred__head { display: flex; align-items: flex-start; justify-content: space-between; gap: var(--space-6); padding-bottom: var(--space-5); border-bottom: 1px solid var(--border-subtle); }
	    .race-pred__eyebrow { display: inline-flex; align-items: center; gap: 6px; color: var(--text-accent); font-size: var(--text-2xs); font-weight: 800; letter-spacing: var(--tracking-caps); text-transform: uppercase; }
	    .race-pred__title { margin-top: 4px; color: var(--text-primary); font-family: var(--font-display); font-size: var(--text-xl); font-weight: 800; }
	    .race-pred__summary { color: var(--text-secondary); font-size: var(--text-sm); line-height: 1.45; }
	    .race-pred__section { display: flex; flex-direction: column; gap: var(--space-4); }
	    .race-pred__label { color: var(--text-tertiary); font-size: var(--text-2xs); font-weight: 800; letter-spacing: var(--tracking-caps); text-transform: uppercase; }
	    .race-pick { display: grid; grid-template-columns: 42px minmax(0, 1fr) 58px; gap: var(--space-5); align-items: center; min-width: 0; padding: var(--space-5); border-radius: var(--radius-sm); background: var(--bg-sunken); border: 1px solid var(--border-subtle); }
	    .race-pick__name { color: var(--text-primary); font-family: var(--font-display); font-weight: 800; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
	    .race-pick__meta { display: flex; align-items: center; gap: var(--space-4); margin-top: 3px; color: var(--text-tertiary); font-size: var(--text-2xs); font-family: var(--font-mono); text-transform: uppercase; }
	    .race-pick__bar { grid-column: 2 / -1; height: 5px; border-radius: var(--radius-pill); background: rgba(255,255,255,0.07); overflow: hidden; }
	    .race-pick__fill { width: var(--_w); height: 100%; border-radius: inherit; background: linear-gradient(90deg, var(--_c), color-mix(in srgb, var(--_c) 45%, #ffffff)); }
	    .race-pick__reason { grid-column: 2 / -1; color: var(--text-secondary); font-size: var(--text-xs); line-height: 1.4; }
	    .race-pick__score { justify-self: end; color: var(--text-primary); font-family: var(--font-mono); font-size: var(--text-sm); font-weight: 800; }
	    .race-watch { display: flex; flex-direction: column; gap: 3px; padding: var(--space-5); border-radius: var(--radius-sm); background: var(--bg-sunken); border: 1px solid var(--border-subtle); }
	    .race-watch__top { display: flex; justify-content: space-between; gap: var(--space-5); color: var(--text-primary); font-weight: 800; font-size: var(--text-sm); }
	    .race-watch__body { color: var(--text-secondary); font-size: var(--text-xs); line-height: 1.4; }
	    .race-pred__caveat { color: var(--text-tertiary); font-size: var(--text-2xs); line-height: 1.4; }

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
	    .ai-vis__head { display: flex; align-items: baseline; gap: var(--space-5); padding-bottom: var(--space-4); border-bottom: 1px solid var(--border-subtle); }
	    .ai-vis__title { color: var(--text-primary); font-weight: 800; font-size: var(--text-sm); }
	    .ai-vis__sub { color: var(--text-tertiary); font-size: var(--text-xs); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
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
	    @media (max-width: 1180px) { .cop-preds { grid-template-columns: 1fr; } .metric-strip { grid-template-columns: 1fr; } .champ-row { grid-template-columns: 38px minmax(96px, 0.8fr) minmax(120px, 1.2fr) 58px; } .champ-row__gap { display: none; } }
	    @media (max-width: 980px) { .cop-page { grid-template-columns: 1fr; } .cop-chat { height: min(680px, calc(100vh - 140px)); } .ai-vis__row { grid-template-columns: 60px 1fr; } .ai-vis__bars, .ai-vis__rec { grid-column: 1 / -1; } .ai-vis__quality { grid-column: 2; justify-self: start; } .factors { grid-template-columns: 1fr; } }
	    @keyframes pw-typing { 0%, 60%, 100% { opacity: 0.3; transform: translateY(0); } 30% { opacity: 1; transform: translateY(-3px); } }
	    @media (prefers-reduced-motion: reduce) { .cop-chat__typing i { animation: none; } }
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

	  function predictionPercent(value) {
	    const n = finiteValue(value, 0);
	    return n > 0 ? `${Math.round(Math.max(0, Math.min(1, n)) * 100)}%` : "n/a";
	  }

	  function PredictionCandidate({ D, item, index, kind, pageId }) {
	    const code = item.code || "";
	    const isConstructor = pageId === "constructors-championship";
	    const driver = D.byCode?.[code] || {};
	    const constructor = isConstructor
	      ? (D.constructors || []).find((team) => [team.abbr, team.name].filter(Boolean).some((value) => String(value).toLowerCase() === String(code || item.label).toLowerCase())) || {}
	      : {};
	    const name = item.label || driver.name || code || "Driver";
	    const confidence = Math.max(0, Math.min(1, finiteValue(item.confidence, 0)));
	    const color = constructor.color || driver.color || standingsColor(index);
	    return (
	      <div className="race-pick" style={{ "--_c": color, "--_w": Math.max(5, confidence * 100) + "%" }}>
	        <Avatar initials={code || name.slice(0, 3).toUpperCase()} number={isConstructor ? "" : driver.num} ring={color} src={isConstructor ? "" : driver.image} size="sm" />
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
	    if (!predictions?.available) return null;
	    const labels = predictionBoardLabels(pageId);
	    const winner = Array.isArray(predictions.winner) ? predictions.winner.slice(0, 3) : [];
	    const podium = Array.isArray(predictions.podium) ? predictions.podium.slice(0, 3) : [];
	    const watchlist = Array.isArray(predictions.watchlist) ? predictions.watchlist.slice(0, 4) : [];
	    if (!winner.length && !podium.length && !watchlist.length) return null;
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
	        {watchlist.length > 0 && (
	          <div className="race-pred__section">
	            <div className="race-pred__label">{labels.watchlist}</div>
	            {watchlist.map((item, index) => (
	              <div className="race-watch" key={`${item.label || "watch"}-${index}`}>
	                <div className="race-watch__top"><span>{item.label || "Prediction"}</span><span>{predictionPercent(item.confidence)}</span></div>
	                <div className="race-watch__body">{item.prediction || item.reason}</div>
	              </div>
	            ))}
	          </div>
	        )}
	        {predictions.caveat && <div className="race-pred__caveat">{predictions.caveat}</div>}
	      </section>
	    );
	  }

	  function StrategyVisualization({ visualization }) {
	    if (!visualization || visualization.kind === "none") return null;
	    const rows = Array.isArray(visualization.rows) ? visualization.rows : [];
	    if (!rows.length && !visualization.title) return null;
	    return (
	      <div className="ai-vis" data-kind={visualization.kind}>
	        <div className="ai-vis__head">
	          <span className="ai-vis__title">{visualization.title || "Strategy view"}</span>
	          {visualization.subtitle && <span className="ai-vis__sub">{visualization.subtitle}</span>}
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

	  function Copilot() {
    const { data: D, connection, dataSource } = window.PW.usePitWall();
    const daily = D.copilot?.daily || {
      status: connection.aiConfigured ? "pending" : "not_configured",
      generatedOn: "",
      generatedAt: "",
      attemptedOn: "",
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
    const msgsRef = React.useRef(null);
    const selectedTab = INSIGHT_TABS.find((tab) => tab.id === activeTab) || INSIGHT_TABS[0];
    const selectedPage = dailyPages.find((page) => page.id === activeTab) || {
      id: selectedTab.id,
      title: selectedTab.label,
      kicker: "Daily prebuilt insight",
      summary: projectionStatus,
	      bullets: ["No AI projection computed for this page yet."],
	      computed: false,
	      alerts: [],
	      visualization: null,
	      predictions: { available: false, title: "", summary: "", winner: [], podium: [], watchlist: [], caveat: "" },
	    };
	    const showAiVisualization = activeTab !== "drivers-championship" && activeTab !== "constructors-championship";
	    const showPredictionBoard = Boolean(selectedPage.predictions?.available);

    React.useEffect(() => {
      if (msgsRef.current) msgsRef.current.scrollTop = msgsRef.current.scrollHeight;
    }, [messages, typing]);

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
          <div className="cop-page">
            <div className="cop__main">
              <section className="cop-hero">
                <div className="cop-hero__top">
                  <span className="cop-hero__badge"><Icon name="sparkles" size={13} /> Daily prebuilt insight</span>
                  <Badge tone={daily.status === "ready" ? "success" : "neutral"}>{daily.status === "ready" ? "Computed" : "Not computed"}</Badge>
                  <span className="cop-hero__model"><Icon name="key" size={12} /> {daily.generatedOn ? `Updated ${daily.generatedOn}` : "Updates once per day"}</span>
                </div>
                <h2 className="cop-hero__h">{selectedPage.title || selectedTab.label}</h2>
                <p className="cop-hero__sum">{selectedPage.summary || projectionStatus}</p>
                <div className="cop-hero__conf">
                  <span style={{ fontSize: 11, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 600 }}>Data coverage</span>
                  <div className="cop-conf__track"><div className="cop-conf__fill" style={{ width: (loadedFeedCount / totalFeedCount) * 100 + "%" }} /></div>
                  <span style={{ fontFamily: "var(--font-mono)", fontWeight: 600, color: "var(--text-primary)" }}>{loadedFeedCount}/{totalFeedCount}</span>
                  <span style={{ marginLeft: "auto", fontSize: 12, color: "var(--text-tertiary)" }}>{projectionStatus}</span>
                </div>
              </section>

              <div className="insight-panel">
                <div className="insight-meta">
                  <span>{selectedPage.kicker || "Daily insight"}</span>
                  <span>Attempted: {daily.attemptedOn || "not yet"}</span>
                  <span>Source: {dataSource}</span>
                </div>
                {Array.isArray(selectedPage.bullets) && selectedPage.bullets.length ? (
                  <div className="insight-list">
                    {selectedPage.bullets.map((item, index) => <div className="insight-item" key={index}>{item}</div>)}
                  </div>
                ) : (
                  <div className="insight-empty">No AI projection computed for this page yet.</div>
                )}
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
	                          <Avatar initials={p.code} number={d.num} ring={d.color} src={d.image} size="md" />
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
      </div>
    );
  }

  window.PW = window.PW || {};
  window.PW.Copilot = Copilot;
})();
