/* Apexline AI Copilot — race-weekend AI projections + chatbot. window.PW.Copilot
   Redesigned to match copilot-redesign/AI Copilot - Final.html.
   Visual vocabulary ported from canvas.css (scoped under .copilot-redesign);
   all data wired from the live PitWall snapshot + daily AI projection pages. */
(function () {
  const NS = window.PitWallDesignSystem_698fe6;
  const { Icon, Avatar } = NS;

  const STYLE_ID = "pw-copilot-styles";
  if (!document.getElementById(STYLE_ID)) {
    const el = document.createElement("style");
    el.id = STYLE_ID;
    el.textContent = `
    .copilot-redesign { --cr-max: 1180px; color: var(--text-primary); }
    .copilot-redesign .cr-page { max-width: var(--cr-max); margin: 0 auto; }

    /* Masthead */
    .copilot-redesign .cophead { padding: 8px 0 18px; display: flex; align-items: flex-start; justify-content: space-between; gap: var(--space-7); flex-wrap: wrap; }
    .copilot-redesign .cophead__eye { font-size: var(--text-2xs); font-weight: 700; letter-spacing: var(--tracking-caps); text-transform: uppercase; color: var(--accent); display: inline-flex; align-items: center; gap: 8px; }
    .copilot-redesign .cophead__t { font-family: var(--font-display); font-weight: 800; font-size: var(--text-4xl); letter-spacing: -0.02em; color: var(--text-strong); margin: 11px 0 4px; line-height: 1; }
    .copilot-redesign .cophead__s { font-size: var(--text-sm); color: var(--text-tertiary); margin: 0; max-width: 70ch; line-height: 1.5; }
    .copilot-redesign .cophead__actions { display: flex; align-items: center; gap: var(--space-5); margin-top: 4px; }

    /* Tabs */
    .copilot-redesign .ctabs { position: sticky; top: 0; z-index: 30; display: flex; gap: 4px; flex-wrap: wrap; border-bottom: 1px solid var(--border-default); margin: 0 0 30px; background: linear-gradient(180deg, var(--bg-base) 78%, transparent); backdrop-filter: blur(8px); }
    .copilot-redesign .ctab { display: inline-flex; align-items: center; gap: 8px; height: 42px; padding: 0 16px; border: 0; background: none; color: var(--text-secondary); font-family: var(--font-sans); font-size: var(--text-md); font-weight: 600; cursor: pointer; border-bottom: 2px solid transparent; margin-bottom: -1px; transition: color .15s ease; white-space: nowrap; }
    .copilot-redesign .ctab:hover { color: var(--text-primary); }
    .copilot-redesign .ctab.is-active { color: var(--text-accent); border-bottom-color: var(--accent); }
    .copilot-redesign .cpanel { display: none; }
    .copilot-redesign .cpanel.is-active { display: block; }

    /* Shared primitives */
    .copilot-redesign .eyebrow { font-size: var(--text-2xs); font-weight: 700; letter-spacing: var(--tracking-caps); text-transform: uppercase; color: var(--text-tertiary); }
    .copilot-redesign .eyebrow--accent { color: var(--accent); }
    .copilot-redesign .mono { font-family: var(--font-mono); font-variant-numeric: tabular-nums; }
    .copilot-redesign .h-title { font-family: var(--font-display); font-weight: 800; letter-spacing: -0.01em; color: var(--text-strong); }
    .copilot-redesign .row { display: flex; align-items: center; gap: 10px; }
    .copilot-redesign .between { justify-content: space-between; }
    .copilot-redesign .muted { color: var(--text-tertiary); }
    .copilot-redesign .divider { height: 1px; background: var(--border-subtle); margin: 22px 0; }
    .copilot-redesign .tag-pill { display: inline-flex; align-items: center; gap: 6px; height: 24px; padding: 0 10px; border-radius: var(--radius-pill); border: 1px solid var(--border-default); background: var(--surface-raised); font-size: var(--text-2xs); font-weight: 600; color: var(--text-secondary); white-space: nowrap; }
    .copilot-redesign button.tag-pill { cursor: pointer; }
    .copilot-redesign .tag-pill--live { color: var(--live); border-color: rgba(255,59,59,0.4); background: var(--live-weak); }
    .copilot-redesign .ic { display: inline-block; vertical-align: middle; }

    /* AI lead block */
    .copilot-redesign .lead { display: grid; grid-template-columns: 36px 1fr; gap: 16px; align-items: start; padding: 22px 26px; border: 1px solid var(--border-subtle); border-radius: var(--radius-lg); background: var(--surface-card); }
    .copilot-redesign .lead__mark { width: 36px; height: 36px; border-radius: var(--radius-md); display: grid; place-items: center; color: #fff; background: linear-gradient(150deg, var(--accent), var(--blue-700)); box-shadow: var(--glow-soft); }
    .copilot-redesign .lead__eyebrow { display: flex; align-items: center; gap: 10px; margin-bottom: 8px; }
    .copilot-redesign .lead__chip { font-size: 10px; font-weight: 700; letter-spacing: .1em; text-transform: uppercase; color: var(--success); padding: 2px 8px; border-radius: var(--radius-pill); background: var(--success-quiet); }
    .copilot-redesign .lead__text { font-size: var(--text-lg); line-height: 1.55; color: var(--text-secondary); max-width: 74ch; text-wrap: pretty; }
    .copilot-redesign .lead__text b { color: var(--text-primary); font-weight: 600; }
    .copilot-redesign .lead__meta { display: flex; flex-wrap: wrap; gap: 18px; margin-top: 14px; font-size: var(--text-2xs); color: var(--text-tertiary); font-family: var(--font-mono); }
    .copilot-redesign .lead__meta span { display: inline-flex; align-items: center; gap: 6px; }

    /* Confidence meter */
    .copilot-redesign .conf { display: inline-flex; align-items: center; gap: 10px; }
    .copilot-redesign .conf__track { width: 96px; height: 5px; border-radius: 99px; background: var(--bg-sunken); overflow: hidden; }
    .copilot-redesign .conf__fill { height: 100%; border-radius: 99px; background: linear-gradient(90deg, var(--accent), var(--t-fastest)); }
    .copilot-redesign .conf__val { font-family: var(--font-mono); font-size: var(--text-2xs); font-weight: 700; color: var(--text-primary); }

    /* Section label inside a board */
    .copilot-redesign .block { margin-top: 26px; }
    .copilot-redesign .block__head { display: flex; align-items: center; gap: 10px; margin-bottom: 14px; }
    .copilot-redesign .block__title { font-family: var(--font-display); font-weight: 700; font-size: var(--text-lg); color: var(--text-primary); white-space: nowrap; flex: none; }
    .copilot-redesign .block__rule { flex: 1; height: 1px; background: var(--border-subtle); }

    /* Avatar wrapper for design sizing (real photos via Avatar component) */
    .copilot-redesign .avwrap { flex: none; }

    /* Podium */
    .copilot-redesign .podium { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; }
    .copilot-redesign .pcard { position: relative; border-radius: var(--radius-md); border: 1px solid var(--border-subtle); background: var(--surface-card); padding: 22px; overflow: hidden; }
    .copilot-redesign .pcard::before { content: ""; position: absolute; inset: 0 0 auto 0; height: 3px; background: var(--_c, var(--accent)); }
    .copilot-redesign .pcard--1 { background: linear-gradient(160deg, rgba(45,123,255,0.12), transparent 55%), var(--surface-card); }
    .copilot-redesign .pcard__rank { display: flex; align-items: center; justify-content: space-between; }
    .copilot-redesign .pcard__pos { font-family: var(--font-display); font-weight: 800; font-size: var(--text-2xl); color: var(--_c, var(--accent)); line-height: 1; }
    .copilot-redesign .pcard__trend { font-family: var(--font-mono); font-size: var(--text-2xs); font-weight: 700; display: inline-flex; align-items: center; gap: 4px; padding: 3px 7px; border-radius: var(--radius-pill); }
    .copilot-redesign .pcard__trend--up { color: var(--success); background: var(--success-quiet); }
    .copilot-redesign .pcard__trend--flat { color: var(--text-tertiary); background: rgba(255,255,255,0.05); }
    .copilot-redesign .pcard__who { display: flex; align-items: center; gap: 14px; margin: 20px 0 18px; min-height: 56px; }
    .copilot-redesign .pcard__name { font-family: var(--font-display); font-weight: 800; font-size: var(--text-lg); color: var(--text-strong); line-height: 1.18; }
    .copilot-redesign .pcard__team { font-size: var(--text-2xs); color: var(--text-tertiary); margin-top: 3px; }
    .copilot-redesign .pcard__pts { display: flex; align-items: baseline; gap: 6px; }
    .copilot-redesign .pcard__ptsv { font-family: var(--font-mono); font-weight: 800; font-size: var(--text-4xl); color: var(--text-strong); font-variant-numeric: tabular-nums; line-height: 1; }
    .copilot-redesign .pcard__ptsu { font-size: var(--text-sm); color: var(--text-tertiary); }
    .copilot-redesign .pcard__foot { margin-top: 16px; padding-top: 14px; border-top: 1px solid var(--border-subtle); display: flex; justify-content: space-between; font-size: var(--text-2xs); color: var(--text-tertiary); font-family: var(--font-mono); }
    .copilot-redesign .pcard__why { margin-top: 14px; padding-top: 13px; border-top: 1px solid var(--border-subtle); font-size: var(--text-2xs); color: var(--text-tertiary); line-height: 1.5; display: flex; gap: 8px; }
    .copilot-redesign .pcard__why::before { content: ""; flex: none; margin-top: 5px; width: 5px; height: 5px; border-radius: 50%; background: var(--_c, var(--accent)); }

    /* Compact table */
    .copilot-redesign .tbl { width: 100%; border-collapse: collapse; }
    .copilot-redesign .tbl th { text-align: left; font-size: var(--text-2xs); font-weight: 700; letter-spacing: var(--tracking-caps); text-transform: uppercase; color: var(--text-tertiary); padding: 0 12px 10px; border-bottom: 1px solid var(--border-default); }
    .copilot-redesign .tbl th.num, .copilot-redesign .tbl td.num { text-align: right; font-family: var(--font-mono); font-variant-numeric: tabular-nums; }
    .copilot-redesign .tbl td { padding: 11px 12px; border-bottom: 1px solid var(--border-subtle); font-size: var(--text-sm); color: var(--text-secondary); vertical-align: middle; }
    .copilot-redesign .tbl tr:last-child td { border-bottom: 0; }
    .copilot-redesign .tbl tr:hover td { background: rgba(255,255,255,0.018); }
    .copilot-redesign .tbl__drv { display: flex; align-items: center; gap: 10px; }
    .copilot-redesign .tbl__name { font-family: var(--font-display); font-weight: 700; color: var(--text-primary); }
    .copilot-redesign .tbl__pts { font-weight: 700; color: var(--text-strong); }
    .copilot-redesign .why { font-size: var(--text-2xs); color: var(--text-tertiary); line-height: 1.45; display: flex; align-items: baseline; gap: 7px; }
    .copilot-redesign .why::before { content: ""; flex: none; align-self: center; width: 5px; height: 5px; border-radius: 50%; background: var(--accent); opacity: .65; }
    .copilot-redesign .tbl__name + .why { margin-top: 3px; }
    .copilot-redesign .spine { width: 4px; height: 30px; border-radius: 99px; background: var(--_c, var(--accent)); flex: none; }
    .copilot-redesign .teamlogo { width: 22px; height: 22px; object-fit: contain; flex: none; }

    /* Form pips */
    .copilot-redesign .form { display: inline-flex; gap: 3px; }
    .copilot-redesign .pip { width: 16px; height: 16px; border-radius: 4px; display: grid; place-items: center; font-family: var(--font-mono); font-size: 9px; font-weight: 700; color: rgba(0,0,0,0.7); }
    .copilot-redesign .pip--win { background: var(--t-fastest); }
    .copilot-redesign .pip--pod { background: var(--success); }
    .copilot-redesign .pip--pts { background: var(--accent); color: #fff; }
    .copilot-redesign .pip--none { background: var(--surface-hover); color: var(--text-tertiary); }
    .copilot-redesign .pip--dnf { background: var(--danger); color: #fff; }

    /* Points share bar */
    .copilot-redesign .share { display: flex; height: 44px; border-radius: var(--radius-sm); overflow: hidden; border: 1px solid var(--border-subtle); }
    .copilot-redesign .share__seg { display: grid; place-items: center; font-family: var(--font-mono); font-size: var(--text-2xs); font-weight: 800; color: rgba(0,0,0,0.78); min-width: 2px; }
    .copilot-redesign .sharekey { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 10px 18px; margin-top: 18px; }
    .copilot-redesign .sharekey__i { display: flex; align-items: center; gap: 10px; }
    .copilot-redesign .sharekey__sw { width: 10px; height: 10px; border-radius: 3px; flex: none; }
    .copilot-redesign .sharekey__n { font-size: var(--text-sm); color: var(--text-secondary); font-weight: 600; flex: 1; }
    .copilot-redesign .sharekey__v { font-family: var(--font-mono); font-size: var(--text-sm); font-weight: 700; color: var(--text-primary); }

    /* Contribution rows */
    .copilot-redesign .contrib { display: flex; height: 10px; border-radius: 99px; overflow: hidden; background: var(--bg-sunken); width: 160px; }
    .copilot-redesign .contrib__seg { height: 100%; }

    /* Prediction picks */
    .copilot-redesign .pick { display: grid; grid-template-columns: 40px 1fr auto; gap: 14px; align-items: center; padding: 12px 14px; border-radius: var(--radius-sm); background: var(--surface-card); border: 1px solid var(--border-subtle); margin-bottom: 8px; }
    .copilot-redesign .pick__name { font-family: var(--font-display); font-weight: 700; font-size: var(--text-md); color: var(--text-primary); }
    .copilot-redesign .pick__sub { font-size: var(--text-2xs); color: var(--text-tertiary); font-family: var(--font-mono); margin-top: 2px; }
    .copilot-redesign .pick__prob { font-family: var(--font-mono); font-weight: 800; font-size: var(--text-xl); color: var(--text-strong); }
    .copilot-redesign .pick__bar { grid-column: 2 / -1; height: 5px; border-radius: 99px; background: var(--bg-sunken); overflow: hidden; }
    .copilot-redesign .pick__fill { height: 100%; border-radius: 99px; background: linear-gradient(90deg, var(--_c, var(--accent)), color-mix(in srgb, var(--_c, var(--accent)) 50%, #fff)); }
    .copilot-redesign .pick__why { grid-column: 1 / -1; margin-top: 3px; font-size: var(--text-2xs); color: var(--text-tertiary); line-height: 1.45; }

    .copilot-redesign .gridcols { display: grid; grid-template-columns: 1fr 1fr; gap: 28px; align-items: start; }
    .copilot-redesign .gridcols--3 { grid-template-columns: 1.2fr 1fr; }

    /* Factor rings */
    .copilot-redesign .factors { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 12px; }
    .copilot-redesign .fring { display: flex; align-items: center; gap: 12px; padding: 12px; border: 1px solid var(--border-subtle); border-radius: var(--radius-sm); background: var(--surface-card); }
    .copilot-redesign .ring { position: relative; width: 46px; height: 46px; border-radius: 50%; background: conic-gradient(var(--_c) var(--_v), rgba(255,255,255,0.07) 0); display: grid; place-items: center; flex: none; }
    .copilot-redesign .ring::before { content: ""; position: absolute; inset: 5px; border-radius: 50%; background: var(--surface-card); }
    .copilot-redesign .ring span { position: relative; font-family: var(--font-mono); font-size: 10px; font-weight: 800; color: var(--text-primary); }
    .copilot-redesign .fring__l { font-size: var(--text-sm); font-weight: 700; color: var(--text-primary); }
    .copilot-redesign .fring__h { font-size: var(--text-2xs); color: var(--text-tertiary); margin-top: 2px; }

    /* Strategy timeline */
    .copilot-redesign .strat { display: flex; flex-direction: column; gap: 2px; }
    .copilot-redesign .strat__head, .copilot-redesign .strat__row { display: grid; grid-template-columns: 150px 1fr 76px; gap: 14px; align-items: center; }
    .copilot-redesign .strat__head { padding: 0 0 10px; font-size: var(--text-2xs); font-weight: 700; letter-spacing: var(--tracking-caps); text-transform: uppercase; color: var(--text-tertiary); }
    .copilot-redesign .strat__row { padding: 8px 0; border-bottom: 1px solid var(--border-subtle); }
    .copilot-redesign .strat__row:last-child { border-bottom: 0; }
    .copilot-redesign .strat__drv { display: flex; align-items: center; gap: 10px; min-width: 0; }
    .copilot-redesign .strat__name { font-family: var(--font-display); font-weight: 700; color: var(--text-primary); font-size: var(--text-sm); }
    .copilot-redesign .stints { display: flex; gap: 3px; height: 28px; }
    .copilot-redesign .stint { border-radius: 4px; display: grid; place-items: center; padding: 0 8px; min-width: 0; overflow: hidden; font-family: var(--font-mono); font-size: 10px; font-weight: 800; color: rgba(0,0,0,0.75); position: relative; }
    .copilot-redesign .stint__t { max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; line-height: 1; }
    .copilot-redesign .stint--soft { background: var(--tyre-soft); color:#fff; }
    .copilot-redesign .stint--medium { background: var(--tyre-medium); }
    .copilot-redesign .stint--hard { background: var(--tyre-hard); }
    .copilot-redesign .stint--inter { background: var(--tyre-inter); }
    .copilot-redesign .stint--wet { background: var(--tyre-wet); color:#fff; }
    .copilot-redesign .strat__rec { font-family: var(--font-mono); font-size: var(--text-2xs); font-weight: 700; color: var(--text-secondary); text-align: right; }
    .copilot-redesign .tyrekey { display: flex; gap: 16px; margin-top: 16px; flex-wrap: wrap; }
    .copilot-redesign .tyrekey__i { display: inline-flex; align-items: center; gap: 6px; font-size: var(--text-2xs); color: var(--text-tertiary); font-family: var(--font-mono); }
    .copilot-redesign .tyrekey__sw { width: 12px; height: 12px; border-radius: 3px; }

    /* Callouts */
    .copilot-redesign .callout { display: flex; gap: 12px; padding: 14px 16px; border-radius: var(--radius-sm); background: var(--surface-card); border: 1px solid var(--border-subtle); border-left: 3px solid var(--_c, var(--accent)); }
    .copilot-redesign .callout__ic { color: var(--_c, var(--accent)); flex: none; margin-top: 1px; }
    .copilot-redesign .callout__t { font-family: var(--font-display); font-weight: 700; font-size: var(--text-sm); color: var(--text-primary); }
    .copilot-redesign .callout__b { font-size: var(--text-sm); color: var(--text-secondary); line-height: 1.45; margin-top: 3px; text-wrap: pretty; }

    /* Next weekend circuit */
    .copilot-redesign .story__ic { width: 40px; height: 40px; border-radius: var(--radius-sm); display: grid; place-items: center; background: var(--accent-soft); color: var(--accent); flex: none; }
    .copilot-redesign .circuit { display: grid; grid-template-columns: 1.1fr 1fr; gap: 24px; align-items: stretch; }
    .copilot-redesign .trackslot { position: relative; border-radius: var(--radius-md); border: 1px solid var(--border-subtle); overflow: hidden; background: var(--grad-carbon), var(--bg-sunken); min-height: 250px; display: grid; place-items: center; }
    .copilot-redesign .trackslot__grid { position: absolute; inset: 0; background-image: linear-gradient(var(--grid-line) 1px, transparent 1px), linear-gradient(90deg, var(--grid-line) 1px, transparent 1px); background-size: 32px 32px; }
    .copilot-redesign .trackslot__note { position: relative; font-family: var(--font-mono); font-size: var(--text-2xs); color: var(--text-tertiary); text-transform: uppercase; letter-spacing: .12em; text-align: center; line-height: 1.6; }
    .copilot-redesign .trackslot__svg { position: relative; width: 78%; max-height: 200px; opacity: .92; }
    .copilot-redesign .trackslot__svg path { fill: none; stroke: var(--accent); stroke-width: 6; stroke-linejoin: round; stroke-linecap: round; }
    .copilot-redesign .cstats { display: grid; grid-template-columns: 1fr 1fr; gap: 1px; background: var(--border-subtle); border: 1px solid var(--border-subtle); border-radius: var(--radius-md); overflow: hidden; align-content: start; }
    .copilot-redesign .cstat { background: var(--surface-card); padding: 16px 18px; }
    .copilot-redesign .cstat__l { font-size: var(--text-2xs); font-weight: 700; letter-spacing: var(--tracking-caps); text-transform: uppercase; color: var(--text-tertiary); }
    .copilot-redesign .cstat__v { margin-top: 6px; font-family: var(--font-mono); font-weight: 700; font-size: var(--text-xl); color: var(--text-strong); }
    .copilot-redesign .cstat__v small { font-size: var(--text-sm); color: var(--text-tertiary); font-weight: 600; }

    /* Chat */
    .copilot-redesign .chat { display: flex; flex-direction: column; height: min(620px, calc(100vh - 280px)); max-width: 820px; margin: 0 auto; border: 1px solid var(--border-default); border-radius: var(--radius-lg); background: var(--surface-card); overflow: hidden; }
    .copilot-redesign .chat__hd { display: flex; align-items: center; gap: 12px; padding: 16px 20px; border-bottom: 1px solid var(--border-subtle); flex: none; }
    .copilot-redesign .chat__av { width: 34px; height: 34px; border-radius: var(--radius-md); display: grid; place-items: center; color: #fff; background: linear-gradient(140deg, var(--accent), var(--blue-700)); flex: none; box-shadow: var(--glow-soft); }
    .copilot-redesign .chat__t { font-family: var(--font-display); font-weight: 700; font-size: var(--text-md); color: var(--text-primary); }
    .copilot-redesign .chat__s { font-size: var(--text-2xs); color: var(--text-tertiary); display: flex; align-items: center; gap: 6px; margin-top: 1px; }
    .copilot-redesign .chat__live { width: 6px; height: 6px; border-radius: 50%; background: var(--success); box-shadow: 0 0 0 3px var(--success-quiet); }
    .copilot-redesign .chat__msgs { flex: 1; overflow-y: auto; padding: 22px; display: flex; flex-direction: column; gap: 16px; min-height: 0; }
    .copilot-redesign .msg { font-size: var(--text-sm); line-height: 1.55; max-width: 82%; padding: 12px 15px; border-radius: var(--radius-md); text-wrap: pretty; }
    .copilot-redesign .msg--ai { background: var(--surface-raised); border: 1px solid var(--border-subtle); color: var(--text-secondary); align-self: flex-start; border-bottom-left-radius: var(--radius-xs); }
    .copilot-redesign .msg--me { background: var(--accent); color: #fff; align-self: flex-end; border-bottom-right-radius: var(--radius-xs); }
    .copilot-redesign .msg--wide { max-width: 100%; width: min(100%, 620px); }
    .copilot-redesign .msg b { color: var(--text-primary); font-weight: 600; }
    .copilot-redesign .msg--me b { color: #fff; }
    .copilot-redesign .chips-row { display: flex; flex-wrap: wrap; gap: 8px; padding: 0 22px 16px; flex: none; }
    .copilot-redesign .schip { display: inline-flex; align-items: center; gap: 7px; padding: 8px 13px; border-radius: var(--radius-pill); background: var(--surface-raised); border: 1px solid var(--border-subtle); color: var(--text-secondary); font-family: var(--font-sans); font-size: var(--text-sm); font-weight: 500; cursor: pointer; transition: all .15s ease; }
    .copilot-redesign .schip:hover { color: var(--text-primary); border-color: var(--accent-border); background: var(--surface-hover); }
    .copilot-redesign .schip:disabled { opacity: .55; cursor: default; }
    .copilot-redesign .compose { display: flex; align-items: center; gap: 10px; padding: 14px 16px; border-top: 1px solid var(--border-subtle); flex: none; }
    .copilot-redesign .compose__in { flex: 1; height: 42px; padding: 0 16px; background: var(--bg-sunken); border: 1px solid var(--border-default); border-radius: var(--radius-pill); color: var(--text-primary); font-family: var(--font-sans); font-size: var(--text-sm); outline: none; transition: var(--tr-control); }
    .copilot-redesign .compose__in:focus { border-color: var(--accent); box-shadow: 0 0 0 3px var(--accent-quiet); }
    .copilot-redesign .compose__in::placeholder { color: var(--text-disabled); }
    .copilot-redesign .compose__send { width: 42px; height: 42px; border-radius: 50%; border: 0; background: var(--accent); color: #fff; display: grid; place-items: center; cursor: pointer; flex: none; }
    .copilot-redesign .compose__send:hover { background: var(--accent-hover); }
    .copilot-redesign .compose__send:disabled { opacity: .5; cursor: default; }

    /* Inline viz inside an AI message */
    .copilot-redesign .invis { margin-top: 12px; border: 1px solid var(--border-subtle); border-radius: var(--radius-md); background: var(--bg-base); padding: 14px; }
    .copilot-redesign .invis__h { display: flex; align-items: baseline; gap: 10px; padding-bottom: 10px; border-bottom: 1px solid var(--border-subtle); margin-bottom: 12px; }
    .copilot-redesign .invis__t { font-family: var(--font-display); font-weight: 700; font-size: var(--text-sm); color: var(--text-primary); }
    .copilot-redesign .invis__s { font-size: var(--text-2xs); color: var(--text-tertiary); font-family: var(--font-mono); }
    .copilot-redesign .invis__row { display: grid; grid-template-columns: 64px 1fr 44px; gap: 10px; align-items: center; padding: 6px 0; }
    .copilot-redesign .invis__name { font-family: var(--font-display); font-weight: 700; font-size: var(--text-sm); color: var(--text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .copilot-redesign .invis__bar { height: 7px; border-radius: 99px; background: var(--bg-sunken); overflow: hidden; }
    .copilot-redesign .invis__fill { height: 100%; border-radius: 99px; }
    .copilot-redesign .invis__v { font-family: var(--font-mono); font-size: var(--text-2xs); font-weight: 700; color: var(--text-secondary); text-align: right; }
    .copilot-redesign .invis__stints { display: flex; gap: 3px; height: 22px; }

    .copilot-redesign .typing { display: inline-flex; gap: 3px; align-items: center; }
    .copilot-redesign .typing i { width: 5px; height: 5px; border-radius: 50%; background: var(--text-tertiary); animation: cr-blink 1.2s ease-in-out infinite; }
    .copilot-redesign .typing i:nth-child(2) { animation-delay: .15s; }
    .copilot-redesign .typing i:nth-child(3) { animation-delay: .3s; }
    .copilot-redesign .msg--thinking { display: grid; grid-template-columns: auto minmax(0, 1fr) auto; align-items: center; gap: 10px; max-width: min(82%, 460px); }
    .copilot-redesign .thinking__text { color: var(--text-secondary); font-weight: 600; min-width: 0; }
    .copilot-redesign .thinking__time { font-family: var(--font-mono); font-size: var(--text-2xs); color: var(--text-tertiary); font-variant-numeric: tabular-nums; }
    @keyframes cr-blink { 0%,60%,100% { opacity: .3; } 30% { opacity: 1; } }

    /* Empty / pending states */
    .copilot-redesign .cr-empty { padding: 28px; border: 1px dashed var(--border-default); border-radius: var(--radius-md); background: var(--surface-card); color: var(--text-tertiary); font-size: var(--text-sm); line-height: 1.55; text-align: center; }
    .copilot-redesign .cr-empty b { color: var(--text-secondary); font-weight: 600; }

    /* Daily run toolbar (rerun + progress) */
    .copilot-redesign .cop-hero__actions { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
    .copilot-redesign .cop-btn { display: inline-flex; align-items: center; gap: 6px; height: 28px; padding: 0 12px; border-radius: var(--radius-pill); border: 1px solid var(--border-default); background: var(--surface-raised); color: var(--text-secondary); font-family: var(--font-sans); font-size: var(--text-2xs); font-weight: 600; cursor: pointer; transition: all .15s ease; }
    .copilot-redesign .cop-btn:hover { color: var(--text-primary); border-color: var(--accent-border); }
    .copilot-redesign .cop-btn[data-active="true"] { background: var(--accent-quiet); border-color: var(--accent-border); color: var(--text-accent); }
    .copilot-redesign .cop-btn:disabled { opacity: .5; cursor: default; }
    .copilot-redesign .cop-inprogress-dot { width: 7px; height: 7px; border-radius: 50%; background: var(--accent); animation: cr-pulse 1.4s ease-in-out infinite; }
    .copilot-redesign .cop-progress { display: flex; flex-direction: column; gap: 10px; margin: 0 0 26px; padding: 14px 16px; border-radius: var(--radius-md); border: 1px solid var(--border-subtle); background: var(--surface-card); }
    .copilot-redesign .cop-progress__top { display: flex; align-items: center; justify-content: space-between; gap: 12px; color: var(--text-secondary); font-size: var(--text-2xs); font-family: var(--font-mono); }
    .copilot-redesign .cop-progress__bar { height: 6px; border-radius: 99px; background: var(--bg-sunken); overflow: hidden; }
    .copilot-redesign .cop-progress__fill { width: var(--_w); height: 100%; border-radius: inherit; background: linear-gradient(90deg, var(--accent), var(--success)); transition: width .3s ease; }
    .copilot-redesign .cop-progress__rows { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 8px; }
    .copilot-redesign .cop-progress__row { display: flex; align-items: center; gap: 8px; color: var(--text-tertiary); font-size: var(--text-2xs); }
    .copilot-redesign .cop-progress__dot { width: 7px; height: 7px; border-radius: 50%; background: var(--text-tertiary); flex: none; }
    .copilot-redesign .cop-progress__row[data-state="thinking"] .cop-progress__dot { background: var(--accent); box-shadow: 0 0 0 4px var(--accent-quiet); }
    .copilot-redesign .cop-progress__analyzing { margin-left: auto; color: var(--accent); font-family: var(--font-mono); font-size: var(--text-3xs, 9px); letter-spacing: .08em; text-transform: uppercase; animation: cr-pulse 1.4s ease-in-out infinite; }
    .copilot-redesign .cop-progress__row[data-state="computed"] .cop-progress__dot { background: var(--success); }
    .copilot-redesign .cop-progress__row[data-state="failed"] .cop-progress__dot { background: var(--danger); }

    /* Projected-strategy mode label */
    .copilot-redesign .ai-vis__mode { display: inline-flex; align-items: center; height: 20px; padding: 0 9px; border-radius: var(--radius-pill); border: 1px solid var(--accent-border); background: var(--accent-quiet); color: var(--text-accent); font-family: var(--font-mono); font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: .06em; }

    /* Daily progress modal */
    .copilot-redesign .cop-modal__overlay, .cop-modal__overlay--cr { position: fixed; inset: 0; z-index: 80; display: grid; place-items: center; padding: 28px; background: rgba(4,8,16,0.62); backdrop-filter: blur(6px); }
    .cop-modal--cr { width: min(560px, 100%); max-height: min(82vh, 680px); overflow-y: auto; display: flex; flex-direction: column; gap: 18px; padding: 26px; border-radius: var(--radius-lg); border: 1px solid var(--accent-border); background: linear-gradient(120% 130% at 90% -20%, var(--accent-quiet), transparent 55%), var(--surface-card); box-shadow: 0 24px 60px rgba(0,0,0,0.5); }
    .cop-modal--cr .cop-modal__hd { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; }
    .cop-modal--cr .cop-modal__eyebrow { display: inline-flex; align-items: center; gap: 8px; color: var(--text-accent); font-size: var(--text-2xs); font-weight: 700; letter-spacing: var(--tracking-caps); text-transform: uppercase; }
    .cop-modal--cr .cop-modal__title { margin-top: 4px; color: var(--text-strong); font-family: var(--font-display); font-size: var(--text-lg); font-weight: 800; }
    .cop-modal--cr .cop-modal__meta { display: flex; align-items: center; justify-content: space-between; gap: 12px; color: var(--text-secondary); font-size: var(--text-xs); }
    .cop-modal--cr .cop-modal__count { font-family: var(--font-mono); font-weight: 700; color: var(--text-primary); }
    .cop-modal--cr .cop-modal__bar { height: 6px; margin-top: 10px; border-radius: 99px; background: var(--bg-sunken); overflow: hidden; }
    .cop-modal--cr .cop-modal__bar span { display: block; width: var(--_w); height: 100%; border-radius: inherit; background: linear-gradient(90deg, var(--accent), var(--success)); }
    .cop-modal--cr .cop-modal__steps { display: flex; flex-direction: column; gap: 8px; }
    .cop-modal--cr .cop-modal__step { display: grid; grid-template-columns: 14px 1fr auto; gap: 12px; align-items: start; padding: 12px; border-radius: var(--radius-sm); border: 1px solid var(--border-subtle); background: var(--bg-sunken); }
    .cop-modal--cr .cop-modal__step-dot { width: 8px; height: 8px; margin-top: 5px; border-radius: 50%; background: var(--text-tertiary); }
    .cop-modal--cr .cop-modal__step[data-state="thinking"] { border-color: var(--accent-border); }
    .cop-modal--cr .cop-modal__step[data-state="thinking"] .cop-modal__step-dot { background: var(--accent); animation: cr-pulse 1.4s ease-in-out infinite; }
    .cop-modal--cr .cop-modal__step[data-state="computed"] .cop-modal__step-dot { background: var(--success); }
    .cop-modal--cr .cop-modal__step[data-state="failed"] .cop-modal__step-dot { background: var(--danger); }
    .cop-modal--cr .cop-modal__step-title { color: var(--text-primary); font-size: var(--text-sm); font-weight: 700; }
    .cop-modal--cr .cop-modal__step-detail { margin-top: 2px; color: var(--text-tertiary); font-size: var(--text-xs); line-height: 1.4; }
    .cop-modal--cr .cop-modal__step-state { color: var(--text-tertiary); font-family: var(--font-mono); font-size: var(--text-2xs); font-weight: 700; text-transform: uppercase; white-space: nowrap; }
    .cop-modal--cr .cop-modal__step[data-state="computed"] .cop-modal__step-state { color: var(--success); }
    .cop-modal--cr .cop-modal__step[data-state="failed"] .cop-modal__step-state { color: var(--danger); }
    .cop-modal--cr .cop-modal__error { padding: 12px; border-radius: var(--radius-sm); border: 1px solid color-mix(in srgb, var(--danger) 45%, var(--border-subtle)); background: color-mix(in srgb, var(--danger) 12%, transparent); color: var(--text-secondary); font-size: var(--text-xs); line-height: 1.4; }
    .cop-modal--cr .cop-modal__foot { color: var(--text-tertiary); font-size: var(--text-2xs); }
    @keyframes cr-pulse { 0%,100% { opacity: 1; } 50% { opacity: .45; } }

    @media (max-width: 920px) {
      .copilot-redesign .podium { grid-template-columns: 1fr; }
      .copilot-redesign .gridcols, .copilot-redesign .gridcols--3 { grid-template-columns: 1fr; }
      .copilot-redesign .circuit { grid-template-columns: 1fr; }
      .copilot-redesign .strat__head, .copilot-redesign .strat__row { grid-template-columns: 110px 1fr 56px; }
    }
    @media (prefers-reduced-motion: reduce) { .copilot-redesign .typing i { animation: none; } }
    `;
    document.head.appendChild(el);
  }

  /* ---------------- data helpers ---------------- */

  function aiRequestOptions(payload) {
    const selected = localStorage.getItem("pw-ai-model") || "";
    if (!selected || selected === "local") return payload;
    const [provider, ...modelParts] = selected.split(":");
    if (provider !== "codex" && provider !== "grok") return payload;
    const model = modelParts.join(":");
    return provider && model ? { ...payload, provider, model } : payload;
  }

  const TYRE_CLASS = {
    soft: "stint--soft", medium: "stint--medium", hard: "stint--hard",
    intermediate: "stint--inter", inter: "stint--inter", wet: "stint--wet",
    s: "stint--soft", m: "stint--medium", h: "stint--hard", i: "stint--inter", w: "stint--wet",
  };
  function stintClass(compound) {
    return TYRE_CLASS[String(compound || "").toLowerCase()] || "stint--medium";
  }

  const TEAM_FALLBACK = {
    MCL: "#ff8000", MER: "#27f4d2", FER: "#e8002d", RBR: "#3671c6", AST: "#229971",
    ALP: "#0093cc", WIL: "#1868db", RB: "#6692ff", AUD: "#c8ccce", HAS: "#b6babd", CAD: "#d3a13b",
  };

  function finite(value, fallback = 0) {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
  }
  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }
  function timeLabel(value) {
    const t = Date.parse(value || "");
    if (!Number.isFinite(t)) return "";
    return new Date(t).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }
  function pct(value) {
    return `${Math.round(clamp(finite(value), 0, 1) * 100)}%`;
  }
  function lastName(name, code) {
    const text = String(name || "").trim();
    if (!text) return code || "Driver";
    const parts = text.split(/\s+/);
    return parts.length > 1 ? parts.slice(1).join(" ") : text;
  }
  // Pick a readable text colour for a coloured fill — black on bright team colours,
  // white on dark ones (perceived luminance). Falls back to white for non-hex values.
  function contrastInk(color) {
    const m = String(color || "").trim().match(/^#?([0-9a-fA-F]{6})$/);
    if (!m) return "#fff";
    const n = parseInt(m[1], 16);
    const lum = 0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255);
    return lum > 140 ? "#0a0d12" : "#fff";
  }

  // Built-in circuit reference facts (length km / turns / DRS zones / lap record),
  // keyed by normalized circuit or location name. Used only to enrich the Next
  // weekend panel; unknown fields fall back to "—".
  const CIRCUIT_FACTS = {
    bahrain: { len: "5.412", laps: 57, turns: 15, drs: 3, rec: "1:31.447", recBy: "DeLaRosa '05" },
    jeddah: { len: "6.174", laps: 50, turns: 27, drs: 3, rec: "1:30.734", recBy: "Hamilton '21" },
    melbourne: { len: "5.278", laps: 58, turns: 14, drs: 4, rec: "1:19.813", recBy: "Leclerc '24" },
    albert: { len: "5.278", laps: 58, turns: 14, drs: 4, rec: "1:19.813", recBy: "Leclerc '24" },
    suzuka: { len: "5.807", laps: 53, turns: 18, drs: 2, rec: "1:30.965", recBy: "Hamilton '19" },
    shanghai: { len: "5.451", laps: 56, turns: 16, drs: 2, rec: "1:32.238", recBy: "Hamilton '04" },
    miami: { len: "5.412", laps: 57, turns: 19, drs: 3, rec: "1:29.708", recBy: "Verstappen '23" },
    imola: { len: "4.909", laps: 63, turns: 19, drs: 1, rec: "1:15.484", recBy: "Hamilton '20" },
    monaco: { len: "3.337", laps: 78, turns: 19, drs: 1, rec: "1:12.909", recBy: "Hamilton '21" },
    montreal: { len: "4.361", laps: 70, turns: 14, drs: 3, rec: "1:13.078", recBy: "Bottas '19" },
    catalunya: { len: "4.657", laps: 66, turns: 14, drs: 2, rec: "1:16.330", recBy: "Verstappen '23" },
    barcelona: { len: "4.657", laps: 66, turns: 14, drs: 2, rec: "1:16.330", recBy: "Verstappen '23" },
    spielberg: { len: "4.318", laps: 71, turns: 10, drs: 3, rec: "1:05.619", recBy: "Sainz '20" },
    redbull: { len: "4.318", laps: 71, turns: 10, drs: 3, rec: "1:05.619", recBy: "Sainz '20" },
    silverstone: { len: "5.891", laps: 52, turns: 18, drs: 2, rec: "1:27.097", recBy: "Verstappen '20" },
    hungaroring: { len: "4.381", laps: 70, turns: 14, drs: 2, rec: "1:16.627", recBy: "Hamilton '20" },
    budapest: { len: "4.381", laps: 70, turns: 14, drs: 2, rec: "1:16.627", recBy: "Hamilton '20" },
    spa: { len: "7.004", laps: 44, turns: 19, drs: 2, rec: "1:46.286", recBy: "Hamilton '20" },
    zandvoort: { len: "4.259", laps: 72, turns: 14, drs: 2, rec: "1:11.097", recBy: "Hamilton '21" },
    monza: { len: "5.793", laps: 53, turns: 11, drs: 2, rec: "1:21.046", recBy: "Barrichello '04" },
    baku: { len: "6.003", laps: 51, turns: 20, drs: 2, rec: "1:43.009", recBy: "Leclerc '19" },
    singapore: { len: "4.940", laps: 62, turns: 19, drs: 3, rec: "1:34.486", recBy: "Hamilton '23" },
    marina: { len: "4.940", laps: 62, turns: 19, drs: 3, rec: "1:34.486", recBy: "Hamilton '23" },
    austin: { len: "5.513", laps: 56, turns: 20, drs: 2, rec: "1:36.169", recBy: "Leclerc '19" },
    cota: { len: "5.513", laps: 56, turns: 20, drs: 2, rec: "1:36.169", recBy: "Leclerc '19" },
    mexico: { len: "4.304", laps: 71, turns: 17, drs: 3, rec: "1:17.774", recBy: "Bottas '21" },
    interlagos: { len: "4.309", laps: 71, turns: 15, drs: 2, rec: "1:10.540", recBy: "Bottas '18" },
    saopaulo: { len: "4.309", laps: 71, turns: 15, drs: 2, rec: "1:10.540", recBy: "Bottas '18" },
    vegas: { len: "6.201", laps: 50, turns: 17, drs: 2, rec: "1:35.490", recBy: "Piastri '23" },
    lusail: { len: "5.419", laps: 57, turns: 16, drs: 1, rec: "1:22.384", recBy: "Verstappen '24" },
    qatar: { len: "5.419", laps: 57, turns: 16, drs: 1, rec: "1:22.384", recBy: "Verstappen '24" },
    yas: { len: "5.281", laps: 58, turns: 16, drs: 2, rec: "1:25.637", recBy: "Verstappen '21" },
    abudhabi: { len: "5.281", laps: 58, turns: 16, drs: 2, rec: "1:25.637", recBy: "Verstappen '21" },
  };
  function circuitFacts(race) {
    const hay = `${race?.circuit || ""} ${race?.loc || ""} ${race?.name || ""}`.toLowerCase().replace(/[^a-z]/g, "");
    for (const key of Object.keys(CIRCUIT_FACTS)) {
      if (hay.includes(key)) return CIRCUIT_FACTS[key];
    }
    return null;
  }

  // Look up the real circuit geometry + curated facts shipped in trackmap-circuits.js
  // (window.PW_TRACKMAP_CIRCUITS), matched on the race's circuit/loc/name.
  function trackCircuit(race) {
    const C = (typeof window !== "undefined" && window.PW_TRACKMAP_CIRCUITS) || null;
    if (!C) return null;
    const hay = `${race?.circuit || ""} ${race?.loc || ""} ${race?.name || ""}`.toLowerCase();
    if (!hay.trim()) return null;
    for (const id of Object.keys(C)) {
      const c = C[id];
      const keys = [id, ...(Array.isArray(c.match) ? c.match : [])];
      if (keys.some((k) => k && hay.includes(String(k).toLowerCase()))) return c;
    }
    return null;
  }

  // Build an SVG path + fitted viewBox from a circuit's [[x,y],...] centerline.
  function circuitPath(points) {
    if (!Array.isArray(points) || points.length < 2) return null;
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const [x, y] of points) {
      if (x < minX) minX = x; if (x > maxX) maxX = x;
      if (y < minY) minY = y; if (y > maxY) maxY = y;
    }
    const pad = 30;
    const d = points.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`).join(" ") + " Z";
    return { d, viewBox: `${(minX - pad).toFixed(1)} ${(minY - pad).toFixed(1)} ${(maxX - minX + pad * 2).toFixed(1)} ${(maxY - minY + pad * 2).toFixed(1)}` };
  }

  // Merge the curated track facts with the hardcoded fallback into the shape the
  // Next-weekend stat grid renders.
  function mergedCircuitFacts(race) {
    const c = trackCircuit(race);
    const fb = circuitFacts(race);
    const cf = c?.facts || null;
    const recBy = cf
      ? [cf.recordHolder, cf.recordYear ? `'${String(cf.recordYear).slice(-2)}` : ""].filter(Boolean).join(" ")
      : fb?.recBy || "";
    return {
      circuit: c,
      geom: c ? circuitPath(c.points) : null,
      len: (cf?.length ? String(cf.length).replace(/\s*km/i, "").trim() : fb?.len) || "",
      laps: cf?.laps || fb?.laps || null,
      turns: cf?.corners || fb?.turns || null,
      drs: cf?.drsZones || fb?.drs || null,
      rec: cf?.lapRecord || fb?.rec || "",
      recBy,
    };
  }

  // Factual model — current championship data only. NO projections are computed
  // here: every projected number shown in the UI comes from the AI daily run
  // (see aiProjection). This keeps non-AI numbers out of the projection views.
  function buildModel(D) {
    const standings = Array.isArray(D.standings) ? D.standings : [];
    const season = D.seasonSummary || {};
    const totalRounds = finite(season.totalRounds, (D.schedule || []).length || 0);
    const roundsDone = clamp(finite(season.round, 0), 0, totalRounds || 99) || 0;
    const roundsLeft = Math.max(0, (totalRounds || 0) - roundsDone);

    const drivers = standings.map((row, index) => {
      const code = String(row.code || "").toUpperCase();
      const driver = D.byCode?.[code] || D.byCode?.[row.code] || {};
      const driverForm = D.driverForm || {};
      const form = Array.isArray(driverForm[code])
        ? driverForm[code]
        : Array.isArray(driverForm[String(row.code || "").toUpperCase()])
          ? driverForm[String(row.code || "").toUpperCase()]
          : Array.isArray(driver.form)
            ? driver.form
            : [];
      return {
        code,
        pos: finite(row.pos, index + 1),
        name: driver.name || row.name || row.code,
        last: lastName(driver.name || row.name, row.code),
        team: driver.team || "",
        abbr: driver.abbr || "",
        color: driver.color || TEAM_FALLBACK[driver.abbr] || "var(--accent)",
        num: driver.num,
        photo: driver.remoteImage || driver.image || "",
        pts: finite(row.pts),
        wins: finite(row.wins),
        form,
      };
    });
    const byCode = new Map(drivers.map((d) => [d.code, d]));

    const constructors = (Array.isArray(D.constructors) ? D.constructors : []).map((team, index) => {
      const roster = drivers.filter((d) => d.abbr === team.abbr);
      return {
        abbr: String(team.abbr || "").toUpperCase(),
        name: team.name,
        color: team.color || TEAM_FALLBACK[team.abbr] || "var(--accent)",
        logo: team.logo || "",
        pos: finite(team.pos, index + 1),
        pts: finite(team.pts),
        roster,
      };
    }).sort((a, b) => (a.pos || 99) - (b.pos || 99) || b.pts - a.pts);

    return { drivers, byCode, constructors, roundsDone, roundsLeft, totalRounds };
  }

  // AI projection accessor — reads the projected order, points, win%, reasons and
  // strategy straight from a daily AI page. Returns available=false when the AI
  // has not computed this page, so the UI can show a pending state instead of
  // inventing numbers.
  function aiProjection(page) {
    const preds = page?.predictions || {};
    const candidates = new Map();
    const merge = (arr, fromLeaderboard) => (Array.isArray(arr) ? arr : []).forEach((it, i) => {
      const code = String(it.code || "").toUpperCase();
      if (!code) return;
      const prev = candidates.get(code) || {};
      candidates.set(code, {
        code,
        label: it.label || prev.label || code,
        projectedPoints: it.projectedPoints != null ? finite(it.projectedPoints) : (prev.projectedPoints ?? null),
        probability: Math.max(prev.probability || 0, finite(it.probability)),
        confidence: Math.max(prev.confidence || 0, finite(it.confidence)),
        reason: it.reason || prev.reason || "",
        rank: fromLeaderboard ? i : (prev.rank ?? null),
      });
    });
    merge(preds.leaderboard, true);
    merge(preds.winner, false);
    merge(preds.podium, false);
    const orderSource = Array.isArray(preds.leaderboard) && preds.leaderboard.length
      ? preds.leaderboard
      : (Array.isArray(preds.winner) ? preds.winner : []);
    const order = orderSource.map((it) => String(it.code || "").toUpperCase()).filter(Boolean);
    return {
      available: Boolean(preds.available) && candidates.size > 0,
      summary: page?.summary || preds.summary || "",
      confidence: finite(preds.confidence),
      caveat: preds.caveat || "",
      candidates,
      order,
      watchlist: Array.isArray(preds.watchlist) ? preds.watchlist : [],
      alerts: Array.isArray(page?.alerts) ? page.alerts : [],
      visualization: page?.visualization || null,
    };
  }

  // Combine a factual driver/team row with its AI projection candidate.
  function projectedRow(base, candidate) {
    return {
      ...base,
      projectedPoints: candidate?.projectedPoints ?? null,
      probability: candidate?.probability || 0,
      reason: candidate?.reason || "",
      label: candidate?.label || base?.name || base?.last,
    };
  }

  /* ---------------- presentational pieces ---------------- */

  function DriverAvatar({ d, size = "md", px }) {
    const style = px ? { "--_s": px + "px" } : {};
    return (
      <span className="avwrap">
        <Avatar
          initials={d.code}
          number={d.num}
          ring={d.color}
          src={d.photo || undefined}
          size={size}
          style={style}
        />
      </span>
    );
  }

  function FormPips({ form }) {
    const items = (Array.isArray(form) ? form : []).slice(-5);
    if (!items.length) return <span className="muted mono" style={{ fontSize: "var(--text-2xs)" }}>No data</span>;
    return (
      <span className="form">
        {items.map((value, i) => {
          const n = Number(value);
          let cls = "pip--none";
          let label = "–";
          if (Number.isFinite(n) && n > 0) {
            label = String(n);
            if (n === 1) cls = "pip--win";
            else if (n <= 3) cls = "pip--pod";
            else if (n <= 10) cls = "pip--pts";
            else cls = "pip--none";
          }
          return <span className={`pip ${cls}`} key={i}>{label}</span>;
        })}
      </span>
    );
  }

  function TeamLogo({ team }) {
    if (team.logo) return <img className="teamlogo" src={team.logo} alt={team.name} loading="lazy" />;
    return <span className="spine" style={{ "--_c": team.color, height: 22 }} />;
  }

  function Lead({ eyebrow, chip, children, meta }) {
    return (
      <div className="lead">
        <div className="lead__mark"><Icon name="sparkles" size={20} /></div>
        <div>
          <div className="lead__eyebrow">
            <span className="eyebrow eyebrow--accent">{eyebrow}</span>
            {chip && <span className="lead__chip">{chip}</span>}
          </div>
          <p className="lead__text">{children}</p>
          {meta && <div className="lead__meta">{meta}</div>}
        </div>
      </div>
    );
  }

  function ConfMeter({ value }) {
    const v = clamp(finite(value), 0, 1);
    return (
      <span className="conf">
        <span className="conf__track"><span className="conf__fill" style={{ width: `${Math.round(v * 100)}%` }} /></span>
        <span className="conf__val">{Math.round(v * 100)}%</span>
      </span>
    );
  }

  /* ---------------- AI page lookups ---------------- */

  function getPage(daily, id) {
    return (Array.isArray(daily?.pages) ? daily.pages : []).find((p) => p.id === id) || null;
  }

  function projPtsText(v) { return v != null ? v : "—"; }
  function winText(p) { return p > 0 ? pct(p) : "—"; }

  // Factual current-championship table — shown (clearly labelled as current, not
  // projected) when the AI has not yet computed a projection for the tab.
  function FactualDriverTable({ rows }) {
    return (
      <div className="block">
        <div className="block__head"><div className="block__title">Current championship standings</div><div className="block__rule" /><span className="eyebrow">Live points · not a projection</span></div>
        <table className="tbl">
          <thead><tr><th style={{ width: 44 }}>Pos</th><th>Driver</th><th>Team</th><th>Recent form</th><th className="num">Wins</th><th className="num">Points</th></tr></thead>
          <tbody>
            {rows.map((d) => (
              <tr key={d.code}>
                <td className="num">{d.pos}</td>
                <td><div className="tbl__drv"><DriverAvatar d={d} size="sm" px={30} /><span className="tbl__name">{d.last}</span></div></td>
                <td>{d.team || d.abbr}</td>
                <td><FormPips form={d.form} /></td>
                <td className="num">{d.wins || "—"}</td>
                <td className="num tbl__pts">{d.pts}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  /* ---------------- TAB: Drivers ---------------- */

  function DriversTab({ model, page, daily }) {
    const proj = aiProjection(page);
    const updated = timeLabel(daily?.generatedAt || daily?.updatedAt);

    if (!proj.available || !proj.order.length) {
      return (
        <>
          <div className="row between" style={{ marginBottom: 22 }}>
            <div><div className="eyebrow eyebrow--accent">Drivers' title projection</div><h3 className="h-title" style={{ fontSize: "var(--text-2xl)", margin: "6px 0 0" }}>Projected title three</h3></div>
          </div>
          <PendingState daily={daily} label="the drivers' title projection" />
          {model.drivers.length > 0 && <FactualDriverTable rows={model.drivers.slice(0, 10)} />}
        </>
      );
    }

    const ranked = proj.order.map((code, i) => {
      const cand = proj.candidates.get(code);
      const base = model.byCode.get(code) || { code, name: cand?.label || code, last: cand?.label || code, team: "", abbr: "", color: "var(--accent)", num: undefined, photo: "", pts: null, form: [] };
      return { ...projectedRow(base, cand), rank: i };
    });
    const top3 = ranked.slice(0, 3);
    const rest = ranked.slice(3, 10);
    const leaderProj = top3[0]?.projectedPoints;

    return (
      <>
        <div className="row between" style={{ marginBottom: 22 }}>
          <div>
            <div className="eyebrow eyebrow--accent">Forecast · projected final podium</div>
            <h3 className="h-title" style={{ fontSize: "var(--text-2xl)", margin: "6px 0 0" }}>Projected title three</h3>
          </div>
          <span className="tag-pill"><Icon name="sparkles" size={13} /> {updated ? `AI updated ${updated}` : "AI projection"}</span>
        </div>

        <div className="podium">
          {top3.map((d, i) => {
            const gap = (leaderProj != null && d.projectedPoints != null) ? leaderProj - d.projectedPoints : null;
            return (
              <div className={`pcard${i === 0 ? " pcard--1" : ""}`} key={d.code} style={{ "--_c": d.color }}>
                <div className="pcard__rank">
                  <span className="pcard__pos" style={i ? { color: i === 1 ? "var(--text-2)" : d.color } : null}>P{i + 1}</span>
                  {d.probability > 0 && <span className={`pcard__trend${i === 0 ? "" : " pcard__trend--flat"}`} style={i === 0 ? { color: "var(--accent)", background: "var(--accent-quiet)" } : null}>{pct(d.probability)} win</span>}
                </div>
                <div className="pcard__who">
                  <DriverAvatar d={d} size="lg" px={56} />
                  <div><div className="pcard__name">{d.name || d.label}</div><div className="pcard__team">{d.team || d.abbr}</div></div>
                </div>
                <div className="pcard__pts"><span className="pcard__ptsv">{projPtsText(d.projectedPoints)}</span><span className="pcard__ptsu">proj pts</span></div>
                {d.reason && <div className="pcard__why">{d.reason}</div>}
                <div className="pcard__foot">
                  <span>{d.pts != null ? `NOW ${d.pts} PTS` : ""}</span>
                  <span>{i === 0 ? "PROJECTED CHAMPION" : gap != null ? `−${gap} PROJ` : ""}</span>
                </div>
              </div>
            );
          })}
        </div>

        {rest.length > 0 && (
          <div className="block">
            <div className="block__head"><div className="block__title">Projected final order</div><div className="block__rule" /><span className="eyebrow">AI projection · recent form</span></div>
            <table className="tbl">
              <thead><tr><th style={{ width: 44 }}>Pos</th><th>Driver</th><th>Team</th><th>Recent form</th><th className="num">Win %</th><th className="num">Proj pts</th></tr></thead>
              <tbody>
                {rest.map((d, i) => (
                  <tr key={d.code}>
                    <td className="num">{i + 4}</td>
                    <td>
                      <div className="tbl__drv">
                        <DriverAvatar d={d} size="sm" px={30} />
                        <div><span className="tbl__name">{d.last}</span>{d.reason && <div className="why">{d.reason}</div>}</div>
                      </div>
                    </td>
                    <td>{d.team || d.abbr}</td>
                    <td><FormPips form={d.form} /></td>
                    <td className="num">{winText(d.probability)}</td>
                    <td className="num tbl__pts">{projPtsText(d.projectedPoints)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {proj.caveat && <div className="muted" style={{ fontSize: "var(--text-2xs)", marginTop: 10 }}>{proj.caveat}</div>}
          </div>
        )}
      </>
    );
  }

  /* ---------------- TAB: Constructors ---------------- */

  function teamCandidate(consProj, team) {
    const byAbbr = consProj.candidates.get(String(team.abbr || "").toUpperCase());
    if (byAbbr) return byAbbr;
    const want = String(team.name || "").toLowerCase();
    for (const c of consProj.candidates.values()) {
      const lab = String(c.label || c.code || "").toLowerCase();
      if (lab && (lab.includes(want) || want.includes(lab))) return c;
    }
    return null;
  }

  function FactualConstructorTable({ rows }) {
    return (
      <div className="block">
        <div className="block__head"><div className="block__title">Current constructors standings</div><div className="block__rule" /><span className="eyebrow">Live points · not a projection</span></div>
        <table className="tbl">
          <thead><tr><th style={{ width: 44 }}>Pos</th><th>Constructor</th><th>Drivers</th><th className="num">Points</th></tr></thead>
          <tbody>
            {rows.map((t) => (
              <tr key={t.abbr}>
                <td className="num">{t.pos}</td>
                <td><div className="tbl__drv"><TeamLogo team={t} /><span className="tbl__name">{t.name}</span></div></td>
                <td className="muted">{t.roster.map((d) => d.code).join(" · ") || "—"}</td>
                <td className="num tbl__pts">{t.pts}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  function ConstructorsTab({ model, page, driversPage, daily, dataSource }) {
    const consProj = aiProjection(page);
    const driversProj = aiProjection(driversPage);
    const computed = timeLabel(daily?.generatedAt || daily?.updatedAt);

    // Join each factual team to its AI projection candidate, then make the two tabs
    // corroborate: a team's projected points is the sum of its drivers' projected
    // points (both are projected FINAL season totals), so the Drivers and
    // Constructors views always add up. Fall back to the constructors AI candidate
    // only when the drivers projection is unavailable.
    const sumDriverProjPts = (team) => {
      if (!driversProj.available) return null;
      let sum = 0;
      let hasAny = false;
      for (const d of team.roster) {
        const dc = driversProj.candidates.get(String(d.code || "").toUpperCase());
        if (dc?.projectedPoints != null) { sum += dc.projectedPoints; hasAny = true; }
      }
      return hasAny ? sum : null;
    };
    const teams = model.constructors
      .map((team) => ({ ...team, cand: teamCandidate(consProj, team) }))
      .map((team) => ({
        ...team,
        projPts: sumDriverProjPts(team) ?? team.cand?.projectedPoints ?? null,
        reason: team.cand?.reason || "",
      }));
    const ranked = teams.filter((t) => t.projPts != null).sort((a, b) => b.projPts - a.projPts);
    const hasShare = consProj.available && ranked.length > 0;

    if (!consProj.available) {
      return (
        <>
          <Lead eyebrow="Copilot read" chip={computed ? `Computed ${computed}` : null} meta={[<span key="s">Source: {dataSource}</span>]}>
            {pendingText(daily, "the constructors' title projection")}
          </Lead>
          {model.constructors.length > 0 && <FactualConstructorTable rows={model.constructors.slice(0, 11)} />}
        </>
      );
    }

    const total = ranked.reduce((sum, t) => sum + t.projPts, 0) || 1;
    const leader = ranked[0];
    const second = ranked[1];
    const gap = second ? leader.projPts - second.projPts : 0;

    return (
      <>
        <Lead
          eyebrow="Copilot read"
          chip={computed ? `Computed ${computed}` : "AI projection"}
          meta={[
            consProj.confidence > 0 && <span key="c"><Icon name="gauge" size={12} /> Confidence <ConfMeter value={consProj.confidence} /></span>,
            <span key="s">Source: {dataSource}</span>,
          ].filter(Boolean)}
        >
          {consProj.summary || (
            <>Copilot projects <b>{leader.name} on top with {leader.projPts} points</b>{second ? <>, {gap} clear of {second.name}</> : ""}.</>
          )}
        </Lead>

        {hasShare && (
          <>
            <div className="divider" />
            <div className="row between" style={{ marginBottom: 16 }}>
              <div>
                <div className="eyebrow eyebrow--accent">Projected season points share</div>
                <h3 className="h-title" style={{ fontSize: "var(--text-xl)", marginTop: 5 }}>Forecast share of the championship</h3>
              </div>
              <span className="tag-pill"><Icon name="layers" size={13} /> AI projection</span>
            </div>

            <div className="share">
              {ranked.map((t) => {
                const sharePct = Math.round((t.projPts / total) * 100);
                return (
                  <div className="share__seg" key={t.abbr} style={{ flex: Math.max(1, t.projPts), background: t.color, color: "#0a0d12" }}>
                    {t.projPts / total >= 0.07 ? `${t.abbr} ${sharePct}%` : ""}
                  </div>
                );
              })}
            </div>
            <div className="sharekey">
              {ranked.slice(0, 8).map((t) => (
                <div className="sharekey__i" key={t.abbr}>
                  <span className="sharekey__sw" style={{ background: t.color }} />
                  <span className="sharekey__n">{t.name}</span>
                  <span className="sharekey__v">{t.projPts}</span>
                </div>
              ))}
            </div>

            <div className="block">
              <div className="block__head"><div className="block__title">Projected driver contribution</div><div className="block__rule" /><span className="eyebrow">Share within team</span></div>
              <table className="tbl">
                <thead><tr><th style={{ width: 44 }}>Pos</th><th>Constructor</th><th>Projected split</th><th className="num">Proj pts</th></tr></thead>
                <tbody>
                  {ranked.slice(0, 6).map((t, i) => {
                    const split = t.roster.map((d) => ({ code: d.code, pts: driversProj.candidates.get(d.code)?.projectedPoints ?? null }));
                    const a = split[0];
                    const b = split[1];
                    const splitTotal = (a?.pts || 0) + (b?.pts || 0);
                    const haveSplit = splitTotal > 0;
                    return (
                      <tr key={t.abbr}>
                        <td className="num">{i + 1}</td>
                        <td>
                          <div className="tbl__drv">
                            <TeamLogo team={t} />
                            <div><span className="tbl__name">{t.name}</span>{t.reason && <div className="why">{t.reason}</div>}</div>
                          </div>
                        </td>
                        <td>
                          <div className="row" style={{ gap: 10 }}>
                            <span className="contrib">
                              {haveSplit && a?.pts != null && <span className="contrib__seg" style={{ width: `${Math.round(((a.pts || 0) / splitTotal) * 100)}%`, background: t.color }} />}
                              {haveSplit && b?.pts != null && <span className="contrib__seg" style={{ width: `${Math.round(((b.pts || 0) / splitTotal) * 100)}%`, background: `color-mix(in srgb, ${t.color} 50%, #ffffff)` }} />}
                            </span>
                            <span className="mono muted" style={{ fontSize: "var(--text-2xs)" }}>
                              {a ? `${a.code} ${projPtsText(a.pts)}` : ""}{b ? ` · ${b.code} ${projPtsText(b.pts)}` : ""}
                            </span>
                          </div>
                        </td>
                        <td className="num tbl__pts">{t.projPts}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
        {consProj.caveat && <div className="muted" style={{ fontSize: "var(--text-2xs)", marginTop: 16 }}>{consProj.caveat}</div>}
      </>
    );
  }

  /* ---------------- TAB: Current weekend ---------------- */

  // Build display picks for a single-race prediction array (winner/podium) — all
  // values (win probability, reasons) come straight from the AI page.
  function predictionPicks(page, model, kind) {
    const list = Array.isArray(page?.predictions?.[kind]) ? page.predictions[kind] : [];
    return list.slice(0, 4).map((item, index) => {
      const d = model.byCode.get(String(item.code || "").toUpperCase());
      return {
        code: item.code || d?.code || "",
        name: item.label || d?.name || item.code || "Driver",
        last: d?.last || lastName(item.label, item.code),
        team: d?.team || "",
        color: d?.color || TEAM_FALLBACK[d?.abbr] || "var(--accent)",
        num: d?.num,
        photo: d?.photo || "",
        prob: finite(item.probability),
        projectedPoints: item.projectedPoints != null ? finite(item.projectedPoints) : null,
        reason: item.reason || "",
        index,
      };
    });
  }

  function CurrentWeekendTab({ model, page, daily, race }) {
    const proj = aiProjection(page);
    const picks = predictionPicks(page, model, "winner");
    const podiumPicks = predictionPicks(page, model, "podium").slice(0, 3);
    const viz = page?.visualization;
    const stintRows = Array.isArray(viz?.rows) ? viz.rows.filter((r) => Array.isArray(r.stints) && r.stints.length) : [];
    const alerts = proj.alerts;
    const weather = race?.weather || {};
    const raceName = race?.name && race.name !== "Formula 1" ? race.name : "Current Grand Prix";
    const aiAvailable = proj.available || Boolean(proj.summary);

    // Key factors — only from real data: factual weather + the AI's own confidence
    // and projected strategy. No invented probabilities.
    const factors = [];
    const rainRaw = String(weather.rain || "").replace("%", "").trim();
    if (rainRaw && Number.isFinite(Number(rainRaw))) factors.push({ v: clamp(finite(rainRaw) / 100, 0, 1), c: "var(--info)", l: "Rain risk", h: weather.cond || "Forecast" });
    if (proj.confidence > 0) factors.push({ v: proj.confidence, c: "var(--accent)", l: "Forecast confidence", h: "AI model" });
    if (stintRows.length) {
      // pitStops can arrive as prose like "2 projected" — parse the leading integer and
      // fall back to (stints − 1) so the strategy ring never renders "NaN-stop".
      const stops = stintRows.map((r) => {
        const parsed = parseInt(r.pitStops, 10);
        return Number.isFinite(parsed) && parsed >= 0 ? parsed : Math.max(1, r.stints.length - 1);
      });
      const counts = {};
      stops.forEach((s) => { counts[s] = (counts[s] || 0) + 1; });
      const mode = Object.keys(counts).sort((a, b) => counts[b] - counts[a])[0];
      if (mode != null) factors.push({ v: counts[mode] / stops.length, c: "var(--success)", l: "Likely strategy", h: `${mode}-stop favoured`, label: `${mode}-stop` });
    }

    return (
      <>
        <div className="row between" style={{ marginBottom: 22 }}>
          <div className="row" style={{ gap: 14 }}>
            <span className="story__ic" style={{ width: 46, height: 46, background: "var(--accent-soft)" }}><Icon name="flag" size={22} /></span>
            <div>
              <div className="eyebrow">{model.roundsDone ? `Round ${model.roundsDone} · ` : ""}current weekend</div>
              <div className="h-title" style={{ fontSize: "var(--text-2xl)", marginTop: 3 }}>{raceName}</div>
              <div className="muted" style={{ fontSize: "var(--text-sm)" }}>{[race?.circuit || race?.loc, race?.laps ? `${race.laps} laps` : ""].filter(Boolean).join(" · ") || "Awaiting circuit data"}</div>
            </div>
          </div>
          {weather.cond ? <span className="tag-pill"><Icon name="droplet" size={12} /> {weather.cond}</span> : <span className="tag-pill tag-pill--live"><span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--live)" }} /> Live weekend</span>}
        </div>

        <Lead eyebrow="Pre-race read" meta={proj.confidence > 0 ? [
          <span key="c"><Icon name="gauge" size={12} /> Confidence <ConfMeter value={proj.confidence} /></span>,
          <span key="b">AI projection</span>,
        ] : null}>
          {proj.summary || pendingText(daily, "this weekend's pre-race read")}
        </Lead>

        {(picks.length > 0 || podiumPicks.length > 0) && (
          <div className="gridcols" style={{ marginTop: 26 }}>
            <div>
              <div className="block__head" style={{ marginBottom: 14 }}><div className="block__title">Win probability</div><div className="block__rule" /></div>
              {picks.map((p) => (
                <div className="pick" key={p.code} style={{ "--_c": p.color }}>
                  <DriverAvatar d={p} size="md" px={40} />
                  <div style={{ minWidth: 0 }}><div className="pick__name">{p.name}</div><div className="pick__sub">{p.team || ""}</div></div>
                  <span className="pick__prob">{winText(p.prob)}</span>
                  <span className="pick__bar"><span className="pick__fill" style={{ width: p.prob > 0 ? pct(p.prob) : "0%", "--_c": p.color }} /></span>
                  {p.reason && <div className="pick__why">{p.reason}</div>}
                </div>
              ))}
            </div>
            <div>
              <div className="block__head" style={{ marginBottom: 14 }}><div className="block__title">Predicted podium</div><div className="block__rule" /></div>
              {podiumPicks.map((p, i) => (
                <div className="pcard" key={p.code} style={{ "--_c": p.color, marginBottom: 10, padding: 16 }}>
                  <div className="row between">
                    <div className="row" style={{ gap: 12 }}>
                      <span className="pcard__pos" style={{ fontSize: "var(--text-xl)", color: i === 1 ? "var(--text-2)" : p.color }}>P{i + 1}</span>
                      <DriverAvatar d={p} size="sm" px={30} />
                      <span className="tbl__name">{p.last}</span>
                    </div>
                    <span className="muted mono" style={{ fontSize: "var(--text-2xs)" }}>{p.team}</span>
                  </div>
                  {p.reason && <div className="why" style={{ marginTop: 10 }}>{p.reason}</div>}
                </div>
              ))}
            </div>
          </div>
        )}

        {factors.length > 0 && (
          <div className="block">
            <div className="block__head"><div className="block__title">Key factors</div><div className="block__rule" /></div>
            <div className="factors">
              {factors.map((f, i) => (
                <div className="fring" key={i}>
                  <span className="ring" style={{ "--_v": `${Math.round(f.v * 100)}%`, "--_c": f.c }}><span>{f.label || `${Math.round(f.v * 100)}%`}</span></span>
                  <div><div className="fring__l">{f.l}</div><div className="fring__h">{f.h}</div></div>
                </div>
              ))}
            </div>
          </div>
        )}

        {stintRows.length > 0 && (
          <>
            <div className="divider" style={{ margin: "38px 0" }} />
            <div className="row between" style={{ marginBottom: 18 }}>
              <div className="row" style={{ gap: 12 }}>
                <div><div className="eyebrow eyebrow--accent">Projected race strategy{race?.laps ? ` · ${race.laps} laps` : ""}</div><h3 className="h-title" style={{ fontSize: "var(--text-xl)", marginTop: 5 }}>How the front runners will play it</h3></div>
                {String(viz?.stintMode || "projected").toLowerCase() === "projected" && <span className="ai-vis__mode">Projected strategy</span>}
              </div>
              <span className="tag-pill"><Icon name="timer" size={13} /> {viz?.subtitle || race?.circuit || "Strategy"}</span>
            </div>
            <div className="strat">
              <div className="strat__head"><span>Driver</span><span>Stint plan</span><span style={{ textAlign: "right" }}>Stops</span></div>
              {stintRows.slice(0, 6).map((r, i) => {
                const d = model.drivers.find((x) => String(x.code).toUpperCase() === String(r.code || "").toUpperCase());
                const stops = r.pitStops ? `${r.pitStops}-stop` : `${Math.max(1, r.stints.length - 1)}-stop`;
                return (
                  <div className="strat__row" key={`${r.code}-${i}`}>
                    <div className="strat__drv">{d ? <DriverAvatar d={d} size="sm" px={30} /> : null}<span className="strat__name">{d?.last || r.code || r.label}</span></div>
                    <div className="stints">
                      {r.stints.map((s, j) => {
                        // Width tracks real lap count when present; the AI often puts prose
                        // (e.g. "opening run") in `laps`, so fall back to equal width.
                        const span = finite(s.lapEnd) - finite(s.lapStart);
                        const lapsNum = parseInt(s.laps, 10);
                        const width = span > 0 ? span : (Number.isFinite(lapsNum) ? lapsNum : 10);
                        const tag = String(s.compound || "").charAt(0).toUpperCase();
                        const detail = String(s.laps || "").trim();
                        return (
                          <span className={`stint ${stintClass(s.compound)}`} key={j} style={{ flex: Math.max(6, width) }} title={detail ? `${tag} · ${detail}` : tag}>
                            <span className="stint__t">{tag}{detail ? ` · ${detail}` : ""}</span>
                          </span>
                        );
                      })}
                    </div>
                    <span className="strat__rec">{stops}</span>
                    {r.recommendation && <div className="why" style={{ gridColumn: "1/-1", marginTop: -1 }}>{r.recommendation}</div>}
                  </div>
                );
              })}
            </div>
            <div className="tyrekey">
              <span className="tyrekey__i"><span className="tyrekey__sw" style={{ background: "var(--tyre-soft)" }} />SOFT</span>
              <span className="tyrekey__i"><span className="tyrekey__sw" style={{ background: "var(--tyre-medium)" }} />MEDIUM</span>
              <span className="tyrekey__i"><span className="tyrekey__sw" style={{ background: "var(--tyre-hard)" }} />HARD</span>
              <span className="tyrekey__i" style={{ marginLeft: "auto" }}>Stint length ∝ laps</span>
            </div>
          </>
        )}

        {alerts.length > 0 && (
          <div className="block">
            <div className="block__head"><div className="block__title">Strategy calls</div><div className="block__rule" /></div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {alerts.slice(0, 4).map((a, i) => {
                const tone = a.tone === "danger" ? "var(--danger)" : a.tone === "warning" ? "var(--warning)" : a.tone === "info" ? "var(--info)" : "var(--t-fastest)";
                return (
                  <div className="callout" key={i} style={{ "--_c": tone }}>
                    <span className="callout__ic"><Icon name={a.icon || "zap"} size={18} /></span>
                    <div><div className="callout__t">{a.title || a.label || "Strategy call"}</div><div className="callout__b">{a.detail || a.body || a.text || ""}</div></div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {!aiAvailable && !stintRows.length && !alerts.length && (
          <div className="block"><PendingState daily={daily} label="this weekend's race read, strategy timeline and calls" /></div>
        )}
      </>
    );
  }

  /* ---------------- TAB: Next weekend ---------------- */

  function NextWeekendTab({ model, page, daily, nextRace }) {
    const formRanked = model.drivers.slice().sort((a, b) => {
      const fa = a.form.slice(-5).reduce((s, v) => s + (Number.isFinite(Number(v)) ? Number(v) : 21), 0);
      const fb = b.form.slice(-5).reduce((s, v) => s + (Number.isFinite(Number(v)) ? Number(v) : 21), 0);
      return fa - fb;
    }).slice(0, 5);
    const proj = aiProjection(page);
    // Build the projected grid from the full projected order (leaderboard) so the top 3
    // always render — the standalone `winner` array often has a single entry.
    const orderPick = (code, i) => {
      const C = String(code || "").toUpperCase();
      const cand = proj.candidates.get(C);
      const d = model.byCode.get(C);
      return {
        code: C, last: d?.last || lastName(cand?.label, C), name: d?.name || cand?.label || C,
        team: d?.team || "", color: d?.color || TEAM_FALLBACK[d?.abbr] || "var(--accent)",
        num: d?.num, photo: d?.photo || "", prob: cand?.probability || 0, reason: cand?.reason || "", index: i,
      };
    };
    const orderTop = proj.order.slice(0, 3).map(orderPick);
    const gridPicks = orderTop.length ? orderTop : predictionPicks(page, model, "winner").slice(0, 3);
    // Head-to-head edge — surface the model's sharpest one-lap/qualifying read from the
    // AI alerts or watchlist (pace deltas are not in the projection schema).
    const edge = proj.alerts?.[0]
      ? { title: proj.alerts[0].title, body: proj.alerts[0].body || proj.alerts[0].detail }
      : (proj.watchlist?.[0] ? { title: proj.watchlist[0].label || "Head-to-head edge", body: proj.watchlist[0].reason || proj.watchlist[0].prediction } : null);
    const previewPicks = predictionPicks(page, model, "podium").slice(0, 3);
    const facts = mergedCircuitFacts(nextRace);
    const weather = nextRace?.weather || {};
    const days = (() => {
      const t = Date.parse(nextRace?.startsAt || "");
      if (!Number.isFinite(t)) return "";
      const d = Math.round((t - Date.now()) / 86400000);
      return d <= 0 ? "This weekend" : d === 1 ? "In 1 day" : `In ${d} days`;
    })();
    const nextName = nextRace?.name && nextRace.name !== "Formula 1" ? nextRace.name : "the next Grand Prix";

    return (
      <>
        <div className="row between" style={{ marginBottom: 18 }}>
          <div><div className="eyebrow eyebrow--accent">Form into {nextName}</div><h3 className="h-title" style={{ fontSize: "var(--text-xl)", marginTop: 5 }}>Who arrives in shape</h3></div>
          <span className="tag-pill">Last 5 races →</span>
        </div>

        <div className="gridcols gridcols--3">
          <div>
            <table className="tbl">
              <thead><tr><th style={{ width: 32 }} /><th>Driver</th><th>Form</th><th className="num">Pts</th></tr></thead>
              <tbody>
                {formRanked.map((d) => (
                  <tr key={d.code}>
                    <td><DriverAvatar d={d} size="sm" px={30} /></td>
                    <td><div className="tbl__name">{d.last}</div><div className="why">{d.team || d.abbr}</div></td>
                    <td><FormPips form={d.form} /></td>
                    <td className="num tbl__pts">{d.pts}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="muted" style={{ fontSize: "var(--text-2xs)", marginTop: 10, fontFamily: "var(--font-mono)" }}>Ranked by average finish over the last five rounds</div>
          </div>

          <div>
            <div className="block__head" style={{ marginBottom: 14 }}><div className="block__title">Projected grid</div><div className="block__rule" /></div>
            {gridPicks.length > 0 ? gridPicks.map((p, i) => (
              <div className="pick" key={p.code} style={{ "--_c": p.color }}>
                <span className="pcard__pos" style={{ fontSize: "var(--text-lg)", color: i === 0 ? p.color : "var(--text-2)" }}>P{i + 1}</span>
                <div className="row" style={{ gap: 10, minWidth: 0 }}><DriverAvatar d={p} size="sm" px={30} /><div className="pick__name">{p.last}</div></div>
                {p.prob > 0 && <span className="pick__sub" style={{ margin: 0 }}>{winText(p.prob)}</span>}
              </div>
            )) : <PendingState daily={daily} label="the projected grid" />}
            {edge && edge.body && (
              <div className="callout" style={{ "--_c": "var(--danger)", marginTop: 14 }}>
                <span className="callout__ic"><Icon name="target" size={18} /></span>
                <div><div className="callout__t">{edge.title || "Head-to-head edge"}</div><div className="callout__b">{edge.body}</div></div>
              </div>
            )}
          </div>
        </div>

        <div className="divider" style={{ margin: "38px 0" }} />

        <div className="row between" style={{ marginBottom: 22 }}>
          <div className="row" style={{ gap: 14 }}>
            <span className="story__ic" style={{ width: 46, height: 46, background: "var(--accent-soft)" }}><Icon name="calendar" size={22} /></span>
            <div>
              <div className="eyebrow">{nextRace?.rnd ? `Round ${nextRace.rnd} · ` : ""}next up</div>
              <div className="h-title" style={{ fontSize: "var(--text-2xl)", marginTop: 3 }}>{nextName}</div>
              <div className="muted" style={{ fontSize: "var(--text-sm)" }}>{[nextRace?.circuit, nextRace?.loc].filter(Boolean).join(" · ") || "Awaiting calendar data"}</div>
            </div>
          </div>
          {days && <span className="tag-pill"><Icon name="clock" size={13} /> {days}</span>}
        </div>

        <div className="circuit">
          <div className="trackslot">
            <div className="trackslot__grid" />
            {facts.geom ? (
              <svg className="trackslot__svg" viewBox={facts.geom.viewBox} preserveAspectRatio="xMidYMid meet" role="img" aria-label={`${facts.circuit?.name || nextName} circuit map`}>
                <path d={facts.geom.d} />
              </svg>
            ) : (
              <div className="trackslot__note">CIRCUIT MAP<br />{nextRace?.circuit || nextRace?.loc || "layout pending"}</div>
            )}
          </div>
          <div className="cstats">
            <div className="cstat"><div className="cstat__l">Length</div><div className="cstat__v">{facts.len || "—"} {facts.len && <small>km</small>}</div></div>
            <div className="cstat"><div className="cstat__l">Laps</div><div className="cstat__v">{nextRace?.laps || facts.laps || "—"}</div></div>
            <div className="cstat"><div className="cstat__l">Turns</div><div className="cstat__v">{facts.turns || "—"}</div></div>
            <div className="cstat"><div className="cstat__l">DRS zones</div><div className="cstat__v">{facts.drs || "—"}</div></div>
            <div className="cstat"><div className="cstat__l">Lap record</div><div className="cstat__v" style={{ fontSize: "var(--text-md)" }}>{facts.rec || "—"} {facts.recBy && <small>{facts.recBy}</small>}</div></div>
            <div className="cstat"><div className="cstat__l">Round</div><div className="cstat__v">{nextRace?.rnd || "—"}</div></div>
          </div>
        </div>

        <div style={{ marginTop: 24 }}>
          <Lead eyebrow="Copilot preview" meta={[
            weather.air && <span key="t"><Icon name="thermometer" size={12} /> {weather.air}° ambient</span>,
            weather.rain && <span key="r"><Icon name="droplet" size={12} /> {weather.rain} rain</span>,
            weather.wind && <span key="w"><Icon name="wind" size={12} /> {weather.wind} wind</span>,
          ].filter(Boolean)}>
            {proj.summary || pendingText(daily, `the preview for ${nextName}`)}
          </Lead>
        </div>

        {previewPicks.length > 0 && (
          <div className="block">
            <div className="block__head"><div className="block__title">Projected top 3</div><div className="block__rule" /><span className="eyebrow">AI projection</span></div>
            <div className="row" style={{ gap: 12, alignItems: "stretch" }}>
              {previewPicks.map((p) => (
                <div className="pick" key={p.code} style={{ "--_c": p.color, flex: 1, margin: 0 }}>
                  <DriverAvatar d={p} size="sm" px={30} />
                  <div><div className="pick__name">{p.last}</div>{p.prob > 0 && <div className="pick__sub">{pct(p.prob)} win</div>}{p.reason && <div className="why" style={{ marginTop: 6 }}>{p.reason}</div>}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </>
    );
  }

  /* ---------------- TAB: Ask Copilot ---------------- */

  function StrategyVisualization({ visualization }) {
    if (!visualization) return null;
    const rows = Array.isArray(visualization.rows) ? visualization.rows : [];
    if (!rows.length) return null;
    const hasStints = rows.some((r) => Array.isArray(r.stints) && r.stints.length);
    return (
      <div className="invis">
        <div className="invis__h">
          <span className="invis__t">{visualization.title || "Model view"}</span>
          {visualization.subtitle && <span className="invis__s">{visualization.subtitle}</span>}
        </div>
        {rows.slice(0, 8).map((r, i) => {
          if (hasStints && Array.isArray(r.stints) && r.stints.length) {
            return (
              <div className="invis__row" key={i} style={{ gridTemplateColumns: "64px 1fr 44px" }}>
                <span className="invis__name">{r.code || r.label}</span>
                <span className="invis__stints">
                  {r.stints.map((s, j) => <span className={`stint ${stintClass(s.compound)}`} key={j} style={{ flex: Math.max(6, finite(s.laps, 10)) }}>{s.laps || ""}</span>)}
                </span>
                <span className="invis__v">{r.pitStops ? `${r.pitStops}stp` : ""}</span>
              </div>
            );
          }
          const value = Math.max(finite(r.probability), finite(r.confidence), finite(r.value));
          return (
            <div className="invis__row" key={i}>
              <span className="invis__name">{r.code || r.label}</span>
              <span className="invis__bar"><span className="invis__fill" style={{ width: `${Math.round(clamp(value, 0, 1) * 100)}%`, background: r.color || "var(--accent)" }} /></span>
              <span className="invis__v">{value <= 1 ? `${Math.round(value * 100)}%` : Math.round(value)}</span>
            </div>
          );
        })}
      </div>
    );
  }

  function copilotThinkingStage(seconds) {
    const elapsed = Number(seconds) || 0;
    if (elapsed < 4) return "Preparing the live snapshot";
    if (elapsed < 10) return "Reading standings, timing, form, and news";
    if (elapsed < 22) return "Asking your selected AI provider";
    if (elapsed < 45) return "Still working through the answer";
    return "Waiting on the provider; complex F1 questions can take up to 90 seconds";
  }

  function ChatTab({ connection, messages, typing, thinkingSeconds, draft, setDraft, send, newChat, suggested, msgsRef }) {
    return (
      <div className="chat">
        <div className="chat__hd">
          <span className="chat__av"><Icon name="sparkles" size={18} /></span>
          <div style={{ flex: 1 }}>
            <div className="chat__t">Race Engineer</div>
            <div className="chat__s"><span className="chat__live" /> {connection.aiConfigured ? "Online · grounded on your live snapshot" : "Waiting for an AI provider"}</div>
          </div>
          <button className="tag-pill" onClick={newChat}><Icon name="plus" size={13} /> New</button>
        </div>
        <div className="chat__msgs" ref={msgsRef}>
          {messages.map((m, i) => (
            <div className={`msg ${m.who === "me" ? "msg--me" : "msg--ai"}${m.visualization ? " msg--wide" : ""}`} key={i}>
              {m.text}
              {m.visualization && <StrategyVisualization visualization={m.visualization} />}
            </div>
          ))}
          {typing && (
            <div className="msg msg--ai msg--thinking" role="status" aria-live="polite">
              <span className="typing" aria-hidden="true"><i /><i /><i /></span>
              <span className="thinking__text">{copilotThinkingStage(thinkingSeconds)}</span>
              <span className="thinking__time">{thinkingSeconds}s</span>
            </div>
          )}
        </div>
        {messages.length <= 3 && (
          <div className="chips-row">
            {suggested.map((q, i) => (
              <button className="schip" key={i} onClick={() => send(q)} disabled={typing}><Icon name="chevronRight" size={13} /> {q}</button>
            ))}
          </div>
        )}
        <div className="compose">
          <input className="compose__in" placeholder="Ask the model to chart something…" value={draft}
            onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send()} />
          <button className="compose__send" onClick={() => send()} disabled={!draft.trim() || typing} aria-label="Send"><Icon name="send" size={17} /></button>
        </div>
      </div>
    );
  }

  /* ---------------- shared pending/empty ---------------- */

  function pendingText(daily, label) {
    const status = daily?.status;
    return status === "pending"
      ? `Daily AI projections are computing. ${label ? `The ${label} will appear once the run finishes.` : ""}`
      : status === "failed"
        ? `No AI projection computed today. ${daily?.error || "The last daily run failed; showing live data only."}`
        : status === "not_configured" || !status
          ? `No AI projection computed. Connect an AI provider in Settings to generate ${label || "daily projections"} — live data still appears below.`
          : `No AI projection computed yet for ${label || "this view"}.`;
  }

  function PendingState({ daily, label }) {
    return <div className="cr-empty">{pendingText(daily, label)}</div>;
  }

  /* ---------------- daily run progress ---------------- */

  const PAGE_PROCESS_DETAILS = {
    "drivers-championship": "Projects the drivers' title order from standings, wins, form and news.",
    "constructors-championship": "Projects the constructors' title from team points, pairings and reliability.",
    "current-weekend": "Computes this weekend's win, podium and strategy picks from sessions, weather and tyres.",
    "next-weekend": "Builds the projected order for the next Grand Prix from season pace and track history.",
  };
  const STEP_STATE_LABELS = { waiting: "Queued", thinking: "Analyzing", computed: "Done", failed: "Failed" };

  function DailyProgressModal({ progress, items, completed, total, pct, onClose }) {
    React.useEffect(() => {
      function onKeyDown(event) { if (event.key === "Escape") onClose(); }
      window.addEventListener("keydown", onKeyDown);
      return () => window.removeEventListener("keydown", onKeyDown);
    }, [onClose]);
    const updatedLabel = progress.updatedAt ? timeLabel(progress.updatedAt) : "";
    return (
      <div className="cop-modal__overlay--cr" onClick={onClose} role="presentation">
        <div className="cop-modal--cr" role="dialog" aria-modal="true" aria-label="Daily AI projection progress" onClick={(e) => e.stopPropagation()}>
          <div className="cop-modal__hd">
            <div>
              <div className="cop-modal__eyebrow"><Icon name="sparkles" size={13} /> Daily AI calculation</div>
              <div className="cop-modal__title">{progress.statusText || "Daily AI projection generation is running."}</div>
            </div>
            <button className="cop-btn" onClick={onClose} aria-label="Close progress"><Icon name="close" size={14} /></button>
          </div>
          <div>
            <div className="cop-modal__meta">
              <span>{progress.currentPageTitle ? `Currently working on ${progress.currentPageTitle}` : "Waiting for the daily run to start"}</span>
              <span className="cop-modal__count">{completed}/{total} pages</span>
            </div>
            <div className="cop-modal__bar" aria-hidden="true"><span style={{ "--_w": pct + "%" }} /></div>
          </div>
          <div className="cop-modal__steps">
            {items.map((item) => (
              <div className="cop-modal__step" data-state={item.status} key={item.id || item.title}>
                <span className="cop-modal__step-dot" />
                <div>
                  <div className="cop-modal__step-title">{item.title || item.id}</div>
                  <div className="cop-modal__step-detail">{PAGE_PROCESS_DETAILS[item.id] || "Builds this page's daily AI projection from the loaded snapshot."}</div>
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

  /* ---------------- main ---------------- */

  const INSIGHT_TABS = [
    { id: "drivers-championship", label: "Drivers", icon: "trophy" },
    { id: "constructors-championship", label: "Constructors", icon: "layers" },
    { id: "current-weekend", label: "Current weekend", icon: "timer" },
    { id: "next-weekend", label: "Next weekend", icon: "calendar" },
    { id: "ask-copilot", label: "Ask Copilot", icon: "sparkles" },
  ];

  function Copilot() {
    const { data: D, connection, dataSource, refreshData } = window.PW.usePitWall();
    const daily = D.copilot?.daily || { status: connection.aiConfigured ? "pending" : "not_configured", pages: [] };
    const [activeTab, setActiveTab] = React.useState(() => {
      try { return localStorage.getItem("pw-copilot-tab") || "drivers-championship"; } catch { return "drivers-championship"; }
    });

    const model = React.useMemo(() => buildModel(D), [D]);

    const nextRace = React.useMemo(() => {
      const schedule = Array.isArray(D.schedule) ? D.schedule : [];
      const round = finite(D.race?.round, 0);
      return schedule.find((r) => finite(r.rnd) === round + 1)
        || schedule.find((r) => r.status === "upcoming" && finite(r.rnd) > round)
        || schedule.find((r) => r.status === "upcoming")
        || null;
    }, [D.schedule, D.race]);

    // chat plumbing (preserved from prior implementation)
    const suggested = [
      "Project the drivers' title",
      "Who wins the next race?",
      "How tight is the fight for P2?",
      "What data is still missing?",
    ];
    const initialChat = [{
      who: "ai",
      text: connection.aiConfigured
        ? "Ask me anything about the loaded F1 snapshot — projections refresh once per day, grounded on the live standings."
        : "Connect an AI provider in Settings, then I can answer questions and chart projections from the loaded F1 snapshot.",
    }];
    const [messages, setMessages] = React.useState(initialChat);
    const [draft, setDraft] = React.useState("");
    const [typing, setTyping] = React.useState(false);
    const [thinkingSeconds, setThinkingSeconds] = React.useState(0);
    const [rerunningScope, setRerunningScope] = React.useState("");
    const [progressOpen, setProgressOpen] = React.useState(false);
    const [progressModalOpen, setProgressModalOpen] = React.useState(false);
    const msgsRef = React.useRef(null);
    const rerunning = Boolean(rerunningScope);
    const dailyPending = daily.status === "pending";

    React.useEffect(() => {
      try { localStorage.setItem("pw-copilot-tab", activeTab); } catch {}
    }, [activeTab]);

    React.useEffect(() => {
      if (msgsRef.current) msgsRef.current.scrollTop = msgsRef.current.scrollHeight;
    }, [messages, typing, activeTab]);

    React.useEffect(() => {
      if (daily.status !== "pending" || !refreshData) return undefined;
      const timer = setInterval(() => refreshData(), 5000);
      return () => clearInterval(timer);
    }, [daily.status, refreshData]);

    React.useEffect(() => {
      if (!typing) {
        setThinkingSeconds(0);
        return undefined;
      }
      setThinkingSeconds(0);
      const timer = setInterval(() => setThinkingSeconds((seconds) => seconds + 1), 1000);
      return () => clearInterval(timer);
    }, [typing]);

    function aiSnapshot() {
      return {
        race: D.race,
        seasonSummary: D.seasonSummary,
        drivers: D.drivers.slice(0, 22),
        standings: D.standings.slice(0, 22),
        constructors: D.constructors.slice(0, 11),
        driverForm: D.driverForm || {},
        formRounds: (D.formRounds || []).slice(0, 30),
        sessions: D.sessions || [],
        timing: (D.timing || []).slice(0, 22),
        battlePairs: D.battlePairs || [],
        strategyContext: D.strategyContext || null,
        news: (D.news || []).slice(0, 8),
        source: dataSource,
      };
    }

    function canned(q) {
      const s = q.toLowerCase();
      if (!connection.aiConfigured) return "AI reasoning is not configured yet. Connect an AI provider in Settings, then I can analyze the live snapshot instead of using canned text.";
      if (s.includes("standings") || s.includes("leader") || s.includes("title")) return D.standings.length ? `Current leader: ${D.byCode[D.standings[0].code]?.name || D.standings[0].code} on ${D.standings[0].pts} points.` : "Current standings have not loaded yet.";
      if (s.includes("next")) return nextRace?.name ? `Next event: ${nextRace.name} at ${nextRace.circuit || nextRace.loc || "the listed circuit"}.` : "The schedule feed has not loaded yet.";
      return "I can use the current standings, schedule, weather, news and timing snapshot. Ask about one of those and I will ground the answer in the loaded data.";
    }

    async function send(text) {
      const q = (text || draft).trim();
      if (!q || typing) return;
      setMessages((m) => [...m, { who: "me", text: q }]);
      setDraft("");
      setTyping(true);
      if (!connection.aiConfigured || !window.pitwall?.ai?.ask) {
        setTyping(false);
        setMessages((m) => [...m, { who: "ai", text: canned(q) }]);
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

    // Daily run progress (drives the Show progress panel + modal).
    const progress = daily.progress || {};
    const progressItems = Array.isArray(progress.items) && progress.items.length
      ? progress.items
      : INSIGHT_TABS.filter((tab) => tab.id !== "ask-copilot").map((tab) => ({
        id: tab.id,
        title: tab.label,
        status: daily.status === "ready" ? "computed" : daily.status === "failed" ? "failed" : "waiting",
      }));
    const progressTotal = Math.max(1, Number(progress.totalPages || progressItems.length || 1));
    const progressCompleted = Math.max(0, Math.min(progressTotal, Number(progress.completedPages || (daily.status === "ready" ? progressTotal : 0))));
    const progressPct = Math.round((progressCompleted / progressTotal) * 100);

    const updated = timeLabel(daily?.generatedAt || daily?.updatedAt);
    const subtitle = daily.status === "ready"
      ? `Forecasts of how the season finishes — refreshed daily, grounded on the live snapshot${updated ? ` at ${updated}` : ""}.`
      : daily.status === "pending"
        ? "Forecasts of how the season finishes — the daily projection run is computing now."
        : connection.aiConfigured
          ? "Forecasts of how the season finishes — projections refresh once daily."
          : "Live standings power every projection below. Connect an AI provider for daily race reads and strategy.";

    function renderTab(tab) {
      const page = getPage(daily, tab.id);
      if (tab.id === "drivers-championship") return <DriversTab model={model} page={page} daily={daily} />;
      if (tab.id === "constructors-championship") return <ConstructorsTab model={model} page={page} driversPage={getPage(daily, "drivers-championship")} daily={daily} dataSource={dataSource} />;
      if (tab.id === "current-weekend") return <CurrentWeekendTab model={model} page={page} daily={daily} race={D.race} />;
      if (tab.id === "next-weekend") return <NextWeekendTab model={model} page={page} daily={daily} nextRace={nextRace} />;
      return (
        <ChatTab
          connection={connection} messages={messages} typing={typing} thinkingSeconds={thinkingSeconds} draft={draft}
          setDraft={setDraft} send={send} newChat={newChat} suggested={suggested} msgsRef={msgsRef}
        />
      );
    }

    return (
      <div className="copilot-redesign">
        <div className="cr-page">
          <header className="cophead">
            <div>
              <div className="cophead__eye"><Icon name="sparkles" size={14} /> Race intelligence · daily projections</div>
              <h1 className="cophead__t">AI Copilot</h1>
              <p className="cophead__s">{subtitle}</p>
            </div>
            {connection.aiConfigured && (
              <div className="cop-hero__actions">
                {daily.status === "ready" && updated && <span className="tag-pill"><Icon name="sparkles" size={13} /> Updated {updated}</span>}
                {dailyPending ? (
                  <button className="cop-btn" data-active="true" onClick={() => setProgressModalOpen(true)} aria-haspopup="dialog">
                    <span className="cop-inprogress-dot" /> In progress
                  </button>
                ) : (
                  <button className="cop-btn" onClick={() => rerunAnalysis("tab")} disabled={rerunning || dailyPending}>
                    <Icon name="timer" size={12} /> {rerunningScope === "tab" ? "Rerunning…" : "Rerun this tab"}
                  </button>
                )}
                <button className="cop-btn" onClick={() => rerunAnalysis("all")} disabled={rerunning || dailyPending}>
                  <Icon name="timer" size={12} /> {rerunningScope === "all" ? "Rerunning…" : "Rerun all"}
                </button>
                <button className="cop-btn" data-active={progressOpen} onClick={() => setProgressOpen((open) => !open)} aria-expanded={progressOpen}>
                  <Icon name="layers" size={12} /> {progressOpen ? "Hide progress" : "Show progress"}
                </button>
              </div>
            )}
          </header>

          {progressOpen && connection.aiConfigured && (
            <div className="cop-progress">
              <div className="cop-progress__top">
                <span>{progress.currentPageTitle || (dailyPending ? "Daily AI projections computing" : daily.status === "ready" ? "Daily projections ready" : "Daily projections")}</span>
                <span>{progressCompleted}/{progressTotal}</span>
              </div>
              <div className="cop-progress__bar" aria-hidden="true"><div className="cop-progress__fill" style={{ "--_w": progressPct + "%" }} /></div>
              <div className="cop-progress__rows">
                {progressItems.map((item) => (
                  <div className="cop-progress__row" data-state={item.status} key={item.id || item.title}>
                    <span className="cop-progress__dot" />
                    <span>{item.title || item.id}</span>
                    {item.status === "thinking" && <span className="cop-progress__analyzing">Analyzing</span>}
                  </div>
                ))}
              </div>
            </div>
          )}

          <nav className="ctabs" role="tablist" aria-label="Copilot views">
            {INSIGHT_TABS.map((tab) => (
              <button
                key={tab.id}
                className={`ctab${activeTab === tab.id ? " is-active" : ""}`}
                role="tab"
                aria-selected={activeTab === tab.id}
                onClick={() => setActiveTab(tab.id)}
              >
                <Icon name={tab.icon} size={15} /> {tab.label}
              </button>
            ))}
          </nav>

          {INSIGHT_TABS.map((tab) => (
            <section className={`cpanel${activeTab === tab.id ? " is-active" : ""}`} key={tab.id} role="tabpanel">
              {activeTab === tab.id ? renderTab(tab) : null}
            </section>
          ))}
        </div>

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
