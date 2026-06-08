/* @ds-bundle: {"format":3,"namespace":"PitWallDesignSystem_698fe6","components":[{"name":"Button","sourcePath":"components/core/Button.jsx"},{"name":"Icon","sourcePath":"components/core/Icon.jsx"},{"name":"ICON_NAMES","sourcePath":"components/core/Icon.jsx"},{"name":"IconButton","sourcePath":"components/core/IconButton.jsx"},{"name":"SegmentedControl","sourcePath":"components/core/SegmentedControl.jsx"},{"name":"Avatar","sourcePath":"components/display/Avatar.jsx"},{"name":"Badge","sourcePath":"components/display/Badge.jsx"},{"name":"Card","sourcePath":"components/display/Card.jsx"},{"name":"Tag","sourcePath":"components/display/Tag.jsx"},{"name":"Countdown","sourcePath":"components/f1/Countdown.jsx"},{"name":"DriverTag","sourcePath":"components/f1/DriverTag.jsx"},{"name":"FlagStatus","sourcePath":"components/f1/FlagStatus.jsx"},{"name":"GapDelta","sourcePath":"components/f1/GapDelta.jsx"},{"name":"StatTile","sourcePath":"components/f1/StatTile.jsx"},{"name":"TimingRowHeader","sourcePath":"components/f1/TimingRow.jsx"},{"name":"TimingRow","sourcePath":"components/f1/TimingRow.jsx"},{"name":"TyreBadge","sourcePath":"components/f1/TyreBadge.jsx"},{"name":"Checkbox","sourcePath":"components/forms/Checkbox.jsx"},{"name":"Input","sourcePath":"components/forms/Input.jsx"},{"name":"Select","sourcePath":"components/forms/Select.jsx"},{"name":"Switch","sourcePath":"components/forms/Switch.jsx"},{"name":"Tabs","sourcePath":"components/navigation/Tabs.jsx"}],"sourceHashes":{"components/core/Button.jsx":"5bf57b796c12","components/core/Icon.jsx":"353c932bb895","components/core/IconButton.jsx":"705bc186e669","components/core/SegmentedControl.jsx":"c66bde88c6e1","components/display/Avatar.jsx":"39fe76ca8189","components/display/Badge.jsx":"96aa04651ccb","components/display/Card.jsx":"a8f562d6e466","components/display/Tag.jsx":"3c0933eb17f1","components/f1/Countdown.jsx":"47c5c3dd0e72","components/f1/DriverTag.jsx":"d7da4c33b956","components/f1/FlagStatus.jsx":"2f5961f98c15","components/f1/GapDelta.jsx":"66022b64806d","components/f1/StatTile.jsx":"4643b0f21ea8","components/f1/TimingRow.jsx":"96ebc64fa61c","components/f1/TyreBadge.jsx":"ef4dcf07eff9","components/forms/Checkbox.jsx":"1aec4f5c66c9","components/forms/Input.jsx":"b80a3727d795","components/forms/Select.jsx":"814e5088ec7a","components/forms/Switch.jsx":"ff08f92eaa1b","components/navigation/Tabs.jsx":"616985aaf8d9","ui_kits/pitwall/Analytics.jsx":"91ea2a469c41","ui_kits/pitwall/AppShell.jsx":"d65bd7760a9e","ui_kits/pitwall/Copilot.jsx":"5b43992f42df","ui_kits/pitwall/Dashboard.jsx":"bb4fa9fdf6c0","ui_kits/pitwall/Leaderboards.jsx":"2aaa3104375d","ui_kits/pitwall/LiveRacing.jsx":"efb665923579","ui_kits/pitwall/News.jsx":"b372430e2c5b","ui_kits/pitwall/Schedule.jsx":"73db2f8042a2","ui_kits/pitwall/Settings.jsx":"d4151a18834c","ui_kits/pitwall/data.js":"b2579f1543ad"},"inlinedExternals":[],"unexposedExports":[]} */

(() => {

const __ds_ns = (window.PitWallDesignSystem_698fe6 = window.PitWallDesignSystem_698fe6 || {});

const __ds_scope = {};

(__ds_ns.__errors = __ds_ns.__errors || []);

// components/core/Button.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/* Inject component styles once. */
const STYLE_ID = "pw-button-styles";
if (typeof document !== "undefined" && !document.getElementById(STYLE_ID)) {
  const el = document.createElement("style");
  el.id = STYLE_ID;
  el.textContent = `
  .pw-btn {
    --_h: var(--size-control-md);
    display: inline-flex; align-items: center; justify-content: center;
    gap: var(--space-4);
    height: var(--_h); padding: 0 var(--space-10);
    font-family: var(--font-sans); font-size: var(--text-md);
    font-weight: var(--fw-semibold); line-height: 1; letter-spacing: 0.01em;
    border: 1px solid transparent; border-radius: var(--radius-sm);
    cursor: pointer; white-space: nowrap; user-select: none;
    transition: var(--tr-control); -webkit-font-smoothing: antialiased;
  }
  .pw-btn:focus-visible { outline: none; box-shadow: var(--ring); }
  .pw-btn[disabled] { opacity: 0.42; cursor: not-allowed; pointer-events: none; }
  .pw-btn--sm { --_h: var(--size-control-sm); font-size: var(--text-sm); padding: 0 var(--space-8); }
  .pw-btn--lg { --_h: var(--size-control-lg); font-size: var(--text-lg); padding: 0 var(--space-12); }
  .pw-btn--block { width: 100%; }

  .pw-btn--primary { background: var(--accent); color: var(--text-inverse); box-shadow: var(--inset-top-light); }
  .pw-btn--primary:hover { background: var(--accent-hover); box-shadow: var(--inset-top-light), var(--glow-soft); }
  .pw-btn--primary:active { background: var(--accent-press); }

  .pw-btn--secondary { background: var(--surface-raised); color: var(--text-primary); border-color: var(--border-strong); }
  .pw-btn--secondary:hover { background: var(--surface-hover); border-color: var(--border-strong); }
  .pw-btn--secondary:active { background: var(--surface-active); }

  .pw-btn--ghost { background: transparent; color: var(--text-secondary); }
  .pw-btn--ghost:hover { background: var(--surface-hover); color: var(--text-primary); }
  .pw-btn--ghost:active { background: var(--surface-active); }

  .pw-btn--quiet { background: var(--accent-quiet); color: var(--text-accent); }
  .pw-btn--quiet:hover { background: var(--accent-quiet-hover); }

  .pw-btn--danger { background: var(--danger); color: #2a0606; }
  .pw-btn--danger:hover { filter: brightness(1.08); }

  .pw-btn__spinner { width: 14px; height: 14px; border-radius: 50%;
    border: 2px solid currentColor; border-right-color: transparent;
    animation: pw-spin 0.7s linear infinite; }
  `;
  document.head.appendChild(el);
}
function Button({
  children,
  variant = "primary",
  size = "md",
  block = false,
  loading = false,
  disabled = false,
  iconLeft = null,
  iconRight = null,
  type = "button",
  className = "",
  ...rest
}) {
  const cls = ["pw-btn", `pw-btn--${variant}`, size !== "md" ? `pw-btn--${size}` : "", block ? "pw-btn--block" : "", className].filter(Boolean).join(" ");
  return /*#__PURE__*/React.createElement("button", _extends({
    type: type,
    className: cls,
    disabled: disabled || loading
  }, rest), loading && /*#__PURE__*/React.createElement("span", {
    className: "pw-btn__spinner",
    "aria-hidden": "true"
  }), !loading && iconLeft, children != null && /*#__PURE__*/React.createElement("span", null, children), !loading && iconRight);
}
Object.assign(__ds_scope, { Button });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Button.jsx", error: String((e && e.message) || e) }); }

// components/core/Icon.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/* Apexline icon set — Lucide-derived (ISC/MIT) 24×24 stroke geometry,
   curated for the cockpit. 1.75 default stroke, round caps/joins.
   Add new glyphs to PATHS keyed by name. */

const PATHS = {
  // nav / chrome
  dashboard: /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("rect", {
    x: "3",
    y: "3",
    width: "7",
    height: "9",
    rx: "1"
  }), /*#__PURE__*/React.createElement("rect", {
    x: "14",
    y: "3",
    width: "7",
    height: "5",
    rx: "1"
  }), /*#__PURE__*/React.createElement("rect", {
    x: "14",
    y: "12",
    width: "7",
    height: "9",
    rx: "1"
  }), /*#__PURE__*/React.createElement("rect", {
    x: "3",
    y: "16",
    width: "7",
    height: "5",
    rx: "1"
  })),
  news: /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("path", {
    d: "M4 4h13v16H5a1 1 0 0 1-1-1z"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M17 8h3v11a2 2 0 0 1-2 2"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M8 8h5M8 12h5M8 16h3"
  })),
  trophy: /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("path", {
    d: "M7 4h10v4a5 5 0 0 1-10 0z"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M7 6H4v1a3 3 0 0 0 3 3M17 6h3v1a3 3 0 0 1-3 3"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M10 14h4M9 20h6M12 14v6"
  })),
  calendar: /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("rect", {
    x: "3",
    y: "5",
    width: "18",
    height: "16",
    rx: "2"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M3 9h18M8 3v4M16 3v4"
  })),
  chart: /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("path", {
    d: "M4 4v16h16"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M8 14v3M12 10v7M16 6v11"
  })),
  settings: /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("circle", {
    cx: "12",
    cy: "12",
    r: "3"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M12 2v3M12 19v3M5 5l2 2M17 17l2 2M2 12h3M19 12h3M5 19l2-2M17 7l2-2"
  })),
  grid: /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("rect", {
    x: "3",
    y: "3",
    width: "8",
    height: "8",
    rx: "1"
  }), /*#__PURE__*/React.createElement("rect", {
    x: "13",
    y: "3",
    width: "8",
    height: "8",
    rx: "1"
  }), /*#__PURE__*/React.createElement("rect", {
    x: "3",
    y: "13",
    width: "8",
    height: "8",
    rx: "1"
  }), /*#__PURE__*/React.createElement("rect", {
    x: "13",
    y: "13",
    width: "8",
    height: "8",
    rx: "1"
  })),
  // media / live
  play: /*#__PURE__*/React.createElement("path", {
    d: "M7 4v16l13-8z",
    fill: "currentColor",
    stroke: "none"
  }),
  pause: /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("rect", {
    x: "6",
    y: "4",
    width: "4",
    height: "16",
    rx: "1",
    fill: "currentColor",
    stroke: "none"
  }), /*#__PURE__*/React.createElement("rect", {
    x: "14",
    y: "4",
    width: "4",
    height: "16",
    rx: "1",
    fill: "currentColor",
    stroke: "none"
  })),
  radio: /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("circle", {
    cx: "12",
    cy: "12",
    r: "2"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M7.8 7.8a6 6 0 0 0 0 8.4M16.2 7.8a6 6 0 0 1 0 8.4M5 5a9 9 0 0 0 0 14M19 5a9 9 0 0 1 0 14"
  })),
  volume: /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("path", {
    d: "M11 5 6 9H3v6h3l5 4z"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M16 9a4 4 0 0 1 0 6"
  })),
  mute: /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("path", {
    d: "M11 5 6 9H3v6h3l5 4z"
  }), /*#__PURE__*/React.createElement("path", {
    d: "m22 9-6 6M16 9l6 6"
  })),
  maximize: /*#__PURE__*/React.createElement("path", {
    d: "M8 3H5a2 2 0 0 0-2 2v3M16 3h3a2 2 0 0 1 2 2v3M21 16v3a2 2 0 0 1-2 2h-3M3 16v3a2 2 0 0 0 2 2h3"
  }),
  layers: /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("path", {
    d: "m12 3 9 5-9 5-9-5z"
  }), /*#__PURE__*/React.createElement("path", {
    d: "m3 13 9 5 9-5"
  })),
  // f1 / data
  flag: /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("path", {
    d: "M5 21V4M5 4h13l-2.5 4L18 12H5"
  })),
  gauge: /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("path", {
    d: "M12 14 16 9"
  }), /*#__PURE__*/React.createElement("circle", {
    cx: "12",
    cy: "14",
    r: "1.5",
    fill: "currentColor",
    stroke: "none"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M4 16a8 8 0 1 1 16 0"
  })),
  timer: /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("circle", {
    cx: "12",
    cy: "13",
    r: "8"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M12 13V9M9 2h6"
  })),
  stopwatch: /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("circle", {
    cx: "12",
    cy: "14",
    r: "7"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M12 14V10M10 2h4M19 6l-1.5 1.5"
  })),
  zap: /*#__PURE__*/React.createElement("path", {
    d: "M13 2 4 14h7l-1 8 9-12h-7z"
  }),
  wind: /*#__PURE__*/React.createElement("path", {
    d: "M3 8h11a3 3 0 1 0-3-3M3 16h15a3 3 0 1 1-3 3M3 12h18"
  }),
  droplet: /*#__PURE__*/React.createElement("path", {
    d: "M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z"
  }),
  thermometer: /*#__PURE__*/React.createElement("path", {
    d: "M12 4a2 2 0 0 0-2 2v8a4 4 0 1 0 4 0V6a2 2 0 0 0-2-2z"
  }),
  // ui
  search: /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("circle", {
    cx: "11",
    cy: "11",
    r: "7"
  }), /*#__PURE__*/React.createElement("path", {
    d: "m20 20-3.5-3.5"
  })),
  plus: /*#__PURE__*/React.createElement("path", {
    d: "M12 5v14M5 12h14"
  }),
  minus: /*#__PURE__*/React.createElement("path", {
    d: "M5 12h14"
  }),
  close: /*#__PURE__*/React.createElement("path", {
    d: "M6 6l12 12M18 6 6 18"
  }),
  check: /*#__PURE__*/React.createElement("path", {
    d: "m5 12 5 5 9-11"
  }),
  chevronDown: /*#__PURE__*/React.createElement("path", {
    d: "m6 9 6 6 6-6"
  }),
  chevronRight: /*#__PURE__*/React.createElement("path", {
    d: "m9 6 6 6-6 6"
  }),
  chevronLeft: /*#__PURE__*/React.createElement("path", {
    d: "m15 6-6 6 6 6"
  }),
  arrowUp: /*#__PURE__*/React.createElement("path", {
    d: "M12 19V5M6 11l6-6 6 6"
  }),
  arrowDown: /*#__PURE__*/React.createElement("path", {
    d: "M12 5v14M6 13l6 6 6-6"
  }),
  bell: /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("path", {
    d: "M6 9a6 6 0 0 1 12 0c0 5 2 6 2 6H4s2-1 2-6z"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M10 20a2 2 0 0 0 4 0"
  })),
  bookmark: /*#__PURE__*/React.createElement("path", {
    d: "M6 4h12v17l-6-4-6 4z"
  }),
  star: /*#__PURE__*/React.createElement("path", {
    d: "m12 3 2.6 5.6 6 .8-4.4 4.2 1.1 6L12 17l-5.3 2.6 1.1-6L3.4 9.4l6-.8z"
  }),
  filter: /*#__PURE__*/React.createElement("path", {
    d: "M3 5h18l-7 8v6l-4-2v-4z"
  }),
  key: /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("circle", {
    cx: "8",
    cy: "14",
    r: "4"
  }), /*#__PURE__*/React.createElement("path", {
    d: "m11 11 9-9M17 5l2 2M14 8l2 2"
  })),
  user: /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("circle", {
    cx: "12",
    cy: "8",
    r: "4"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M5 21a7 7 0 0 1 14 0"
  })),
  sparkles: /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("path", {
    d: "M12 4l1.5 4L18 9.5 13.5 11 12 15l-1.5-4L6 9.5 10.5 8z"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M19 14l.7 1.8L21 16.5l-1.3.7L19 19l-.7-1.8L17 16.5l1.3-.7z"
  })),
  move: /*#__PURE__*/React.createElement("path", {
    d: "M12 3v18M3 12h18M9 6l3-3 3 3M9 18l3 3 3-3M6 9l-3 3 3 3M18 9l3 3-3 3"
  }),
  pin: /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("path", {
    d: "M9 4h6l-1 6 3 3v2H7v-2l3-3z"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M12 15v5"
  })),
  pencil: /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("path", {
    d: "M16 3l5 5L8 21H3v-5z"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M14 5l5 5"
  }))
};
function Icon({
  name,
  size = 18,
  strokeWidth = 1.75,
  className = "",
  title,
  ...rest
}) {
  const glyph = PATHS[name];
  return /*#__PURE__*/React.createElement("svg", _extends({
    viewBox: "0 0 24 24",
    width: size,
    height: size,
    fill: "none",
    stroke: "currentColor",
    strokeWidth: strokeWidth,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    className: ["pw-icon", className].filter(Boolean).join(" "),
    role: title ? "img" : "presentation",
    "aria-hidden": title ? undefined : true,
    "aria-label": title
  }, rest), title ? /*#__PURE__*/React.createElement("title", null, title) : null, glyph || null);
}
const ICON_NAMES = Object.keys(PATHS);
Object.assign(__ds_scope, { Icon, ICON_NAMES });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Icon.jsx", error: String((e && e.message) || e) }); }

// components/core/IconButton.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const STYLE_ID = "pw-iconbutton-styles";
if (typeof document !== "undefined" && !document.getElementById(STYLE_ID)) {
  const el = document.createElement("style");
  el.id = STYLE_ID;
  el.textContent = `
  .pw-iconbtn {
    --_s: var(--size-control-md);
    display: inline-grid; place-items: center;
    width: var(--_s); height: var(--_s);
    border: 1px solid transparent; border-radius: var(--radius-sm);
    background: transparent; color: var(--text-secondary);
    cursor: pointer; transition: var(--tr-control); flex: none;
  }
  .pw-iconbtn:focus-visible { outline: none; box-shadow: var(--ring); }
  .pw-iconbtn[disabled] { opacity: 0.4; cursor: not-allowed; pointer-events: none; }
  .pw-iconbtn--sm { --_s: var(--size-control-sm); }
  .pw-iconbtn--lg { --_s: var(--size-control-lg); }

  .pw-iconbtn--ghost:hover { background: var(--surface-hover); color: var(--text-primary); }
  .pw-iconbtn--ghost:active { background: var(--surface-active); }
  .pw-iconbtn--solid { background: var(--surface-raised); border-color: var(--border-default); color: var(--text-primary); }
  .pw-iconbtn--solid:hover { background: var(--surface-hover); }
  .pw-iconbtn--accent { background: var(--accent-quiet); color: var(--text-accent); }
  .pw-iconbtn--accent:hover { background: var(--accent-quiet-hover); }
  .pw-iconbtn[data-active="true"] { background: var(--accent); color: var(--text-inverse); border-color: transparent; }
  `;
  document.head.appendChild(el);
}
function IconButton({
  children,
  variant = "ghost",
  size = "md",
  active = false,
  disabled = false,
  label,
  className = "",
  ...rest
}) {
  const cls = ["pw-iconbtn", `pw-iconbtn--${variant}`, size !== "md" ? `pw-iconbtn--${size}` : "", className].filter(Boolean).join(" ");
  return /*#__PURE__*/React.createElement("button", _extends({
    type: "button",
    className: cls,
    "data-active": active ? "true" : undefined,
    "aria-label": label,
    title: label,
    disabled: disabled
  }, rest), children);
}
Object.assign(__ds_scope, { IconButton });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/IconButton.jsx", error: String((e && e.message) || e) }); }

// components/core/SegmentedControl.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const STYLE_ID = "pw-segmented-styles";
if (typeof document !== "undefined" && !document.getElementById(STYLE_ID)) {
  const el = document.createElement("style");
  el.id = STYLE_ID;
  el.textContent = `
  .pw-seg {
    display: inline-flex; padding: 2px; gap: 2px;
    background: var(--bg-sunken); border: 1px solid var(--border-subtle);
    border-radius: var(--radius-sm);
  }
  .pw-seg__item {
    appearance: none; border: 0; background: transparent;
    font-family: var(--font-sans); font-size: var(--text-sm); font-weight: var(--fw-medium);
    color: var(--text-secondary); padding: 0 var(--space-8); height: 26px;
    border-radius: var(--radius-xs); cursor: pointer; white-space: nowrap;
    display: inline-flex; align-items: center; gap: var(--space-3);
    transition: var(--tr-control);
  }
  .pw-seg__item:hover { color: var(--text-primary); }
  .pw-seg__item[aria-selected="true"] {
    background: var(--surface-active); color: var(--text-strong);
    box-shadow: var(--shadow-xs);
  }
  .pw-seg--accent .pw-seg__item[aria-selected="true"] { background: var(--accent); color: var(--text-inverse); }
  `;
  document.head.appendChild(el);
}
function SegmentedControl({
  options = [],
  value,
  onChange,
  accent = false,
  className = "",
  ...rest
}) {
  const cls = ["pw-seg", accent ? "pw-seg--accent" : "", className].filter(Boolean).join(" ");
  return /*#__PURE__*/React.createElement("div", _extends({
    className: cls,
    role: "tablist"
  }, rest), options.map(opt => {
    const o = typeof opt === "string" ? {
      value: opt,
      label: opt
    } : opt;
    return /*#__PURE__*/React.createElement("button", {
      key: o.value,
      type: "button",
      role: "tab",
      "aria-selected": value === o.value,
      className: "pw-seg__item",
      onClick: () => onChange && onChange(o.value)
    }, o.icon, o.label);
  }));
}
Object.assign(__ds_scope, { SegmentedControl });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/SegmentedControl.jsx", error: String((e && e.message) || e) }); }

// components/display/Avatar.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const STYLE_ID = "pw-avatar-styles";
if (typeof document !== "undefined" && !document.getElementById(STYLE_ID)) {
  const el = document.createElement("style");
  el.id = STYLE_ID;
  el.textContent = `
  .pw-avatar {
    --_s: 36px;
    position: relative; display: inline-grid; place-items: center;
    width: var(--_s); height: var(--_s); flex: none;
    border-radius: 50%; overflow: hidden;
    background: var(--surface-hover); color: var(--text-secondary);
    font-family: var(--font-display); font-weight: var(--fw-bold);
    font-size: calc(var(--_s) * 0.4); letter-spacing: 0.01em;
    user-select: none;
  }
  .pw-avatar--sm { --_s: 26px; }
  .pw-avatar--lg { --_s: 48px; }
  .pw-avatar--xl { --_s: 64px; }
  .pw-avatar img { width: 100%; height: 100%; object-fit: cover; }
  .pw-avatar--ring { box-shadow: 0 0 0 2px var(--bg-base), 0 0 0 4px var(--_ring, var(--accent)); }
  .pw-avatar--square { border-radius: var(--radius-sm); }
  .pw-avatar__num {
    position: absolute; right: -2px; bottom: -2px;
    min-width: 16px; height: 16px; padding: 0 3px;
    display: grid; place-items: center;
    background: var(--surface-active); color: var(--text-primary);
    border: 1.5px solid var(--bg-base); border-radius: var(--radius-pill);
    font-family: var(--font-mono); font-size: 9px; font-weight: 700;
  }
  `;
  document.head.appendChild(el);
}
function Avatar({
  src,
  initials,
  number,
  size = "md",
  ring,
  square = false,
  className = "",
  style = {},
  ...rest
}) {
  const cls = ["pw-avatar", size !== "md" ? `pw-avatar--${size}` : "", ring ? "pw-avatar--ring" : "", square ? "pw-avatar--square" : "", className].filter(Boolean).join(" ");
  const mergedStyle = ring && ring !== true ? {
    ...style,
    "--_ring": ring
  } : style;
  return /*#__PURE__*/React.createElement("span", _extends({
    className: cls,
    style: mergedStyle
  }, rest), src ? /*#__PURE__*/React.createElement("img", {
    src: src,
    alt: initials || ""
  }) : /*#__PURE__*/React.createElement("span", null, initials), number != null && /*#__PURE__*/React.createElement("span", {
    className: "pw-avatar__num"
  }, number));
}
Object.assign(__ds_scope, { Avatar });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/display/Avatar.jsx", error: String((e && e.message) || e) }); }

// components/display/Badge.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const STYLE_ID = "pw-badge-styles";
if (typeof document !== "undefined" && !document.getElementById(STYLE_ID)) {
  const el = document.createElement("style");
  el.id = STYLE_ID;
  el.textContent = `
  .pw-badge {
    display: inline-flex; align-items: center; gap: var(--space-3);
    height: 20px; padding: 0 var(--space-5);
    font-family: var(--font-sans); font-size: var(--text-2xs); font-weight: var(--fw-semibold);
    letter-spacing: 0.03em; line-height: 1; white-space: nowrap;
    border-radius: var(--radius-pill); border: 1px solid transparent;
  }
  .pw-badge--solid { color: var(--text-inverse); }
  .pw-badge__dot { width: 6px; height: 6px; border-radius: 50%; background: currentColor; flex: none; }

  /* soft (tinted) tones */
  .pw-badge--neutral { background: var(--surface-hover); color: var(--text-secondary); border-color: var(--border-subtle); }
  .pw-badge--accent  { background: var(--accent-quiet); color: var(--text-accent); }
  .pw-badge--success { background: var(--success-quiet); color: var(--success); }
  .pw-badge--warning { background: var(--warning-quiet); color: var(--warning); }
  .pw-badge--danger  { background: var(--danger-quiet); color: var(--danger); }
  .pw-badge--info    { background: var(--info-quiet); color: var(--info); }
  .pw-badge--fastest { background: var(--t-fastest-quiet); color: var(--t-fastest); }

  /* live — solid red with glow + pulsing dot */
  .pw-badge--live { background: var(--live); color: #fff; box-shadow: var(--glow-live); letter-spacing: 0.08em; }
  .pw-badge--live .pw-badge__dot { background: #fff; animation: pw-pulse-live 1.4s var(--ease-in-out) infinite; }

  /* outline */
  .pw-badge--outline { background: transparent; border-color: var(--border-strong); color: var(--text-secondary); }
  @media (prefers-reduced-motion: reduce) { .pw-badge--live .pw-badge__dot { animation: none; } }
  `;
  document.head.appendChild(el);
}
function Badge({
  children,
  tone = "neutral",
  dot = false,
  className = "",
  ...rest
}) {
  const cls = ["pw-badge", `pw-badge--${tone}`, className].filter(Boolean).join(" ");
  return /*#__PURE__*/React.createElement("span", _extends({
    className: cls
  }, rest), (dot || tone === "live") && /*#__PURE__*/React.createElement("span", {
    className: "pw-badge__dot",
    "aria-hidden": "true"
  }), children);
}
Object.assign(__ds_scope, { Badge });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/display/Badge.jsx", error: String((e && e.message) || e) }); }

// components/display/Card.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const STYLE_ID = "pw-card-styles";
if (typeof document !== "undefined" && !document.getElementById(STYLE_ID)) {
  const el = document.createElement("style");
  el.id = STYLE_ID;
  el.textContent = `
  .pw-card {
    display: flex; flex-direction: column;
    background: var(--surface-card);
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-md);
    box-shadow: var(--shadow-sm), var(--inset-top-light);
    overflow: clip;
  }
  .pw-card--raised { background: var(--surface-raised); box-shadow: var(--shadow-md), var(--inset-top-light); }
  .pw-card--flat { box-shadow: none; }
  .pw-card--glow { border-color: var(--accent-border); box-shadow: var(--glow-accent); }
  .pw-card--interactive { cursor: pointer; transition: var(--tr-surface), border-color var(--dur-fast) var(--ease-standard); }
  .pw-card--interactive:hover { background: var(--surface-hover); border-color: var(--border-default); transform: translateY(-1px); }
  .pw-card--interactive:active { transform: translateY(0); }

  .pw-card__head {
    display: flex; align-items: center; gap: var(--space-6);
    padding: var(--space-7) var(--space-8);
    border-bottom: 1px solid var(--border-subtle);
  }
  .pw-card__head--bare { border-bottom: 0; padding-bottom: 0; }
  .pw-card__title { font-family: var(--font-sans); font-size: var(--text-lg); font-weight: var(--fw-semibold); color: var(--text-primary); margin: 0; }
  .pw-card__sub { font-size: var(--text-sm); color: var(--text-tertiary); margin: 2px 0 0; }
  .pw-card__head-aside { margin-left: auto; display: inline-flex; align-items: center; gap: var(--space-4); }
  .pw-card__body { padding: var(--space-8); }
  .pw-card__body--tight { padding: var(--space-6); }
  .pw-card__body--none { padding: 0; }
  `;
  document.head.appendChild(el);
}
function Card({
  children,
  title,
  subtitle,
  aside,
  variant = "default",
  interactive = false,
  padding = "default",
  bareHeader = false,
  className = "",
  ...rest
}) {
  const cls = ["pw-card", variant !== "default" ? `pw-card--${variant}` : "", interactive ? "pw-card--interactive" : "", className].filter(Boolean).join(" ");
  const bodyCls = ["pw-card__body", padding === "tight" ? "pw-card__body--tight" : "", padding === "none" ? "pw-card__body--none" : ""].filter(Boolean).join(" ");
  const hasHead = title != null || aside != null;
  return /*#__PURE__*/React.createElement("div", _extends({
    className: cls
  }, rest), hasHead && /*#__PURE__*/React.createElement("div", {
    className: ["pw-card__head", bareHeader ? "pw-card__head--bare" : ""].filter(Boolean).join(" ")
  }, title != null && /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("p", {
    className: "pw-card__title"
  }, title), subtitle != null && /*#__PURE__*/React.createElement("p", {
    className: "pw-card__sub"
  }, subtitle)), aside != null && /*#__PURE__*/React.createElement("div", {
    className: "pw-card__head-aside"
  }, aside)), /*#__PURE__*/React.createElement("div", {
    className: bodyCls
  }, children));
}
Object.assign(__ds_scope, { Card });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/display/Card.jsx", error: String((e && e.message) || e) }); }

// components/display/Tag.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const STYLE_ID = "pw-tag-styles";
if (typeof document !== "undefined" && !document.getElementById(STYLE_ID)) {
  const el = document.createElement("style");
  el.id = STYLE_ID;
  el.textContent = `
  .pw-tag {
    display: inline-flex; align-items: center; gap: var(--space-4);
    height: 26px; padding: 0 var(--space-6);
    font-family: var(--font-sans); font-size: var(--text-sm); font-weight: var(--fw-medium);
    color: var(--text-secondary); white-space: nowrap;
    background: var(--surface-raised); border: 1px solid var(--border-default);
    border-radius: var(--radius-sm); cursor: default; transition: var(--tr-control);
  }
  .pw-tag__swatch { width: 8px; height: 8px; border-radius: 2px; flex: none; }
  .pw-tag--clickable { cursor: pointer; }
  .pw-tag--clickable:hover { background: var(--surface-hover); color: var(--text-primary); }
  .pw-tag--selected { background: var(--accent-quiet); border-color: var(--accent-border); color: var(--text-accent); }
  .pw-tag__x {
    display: inline-grid; place-items: center; width: 16px; height: 16px; margin-right: -3px;
    border-radius: var(--radius-xs); color: var(--text-tertiary); cursor: pointer; transition: var(--tr-control);
  }
  .pw-tag__x:hover { background: var(--surface-active); color: var(--text-primary); }
  `;
  document.head.appendChild(el);
}
const XIcon = () => /*#__PURE__*/React.createElement("svg", {
  viewBox: "0 0 24 24",
  width: "11",
  height: "11",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: "2.4",
  strokeLinecap: "round"
}, /*#__PURE__*/React.createElement("path", {
  d: "M6 6l12 12M18 6 6 18"
}));
function Tag({
  children,
  swatch,
  selected = false,
  onRemove,
  onClick,
  className = "",
  ...rest
}) {
  const cls = ["pw-tag", onClick ? "pw-tag--clickable" : "", selected ? "pw-tag--selected" : "", className].filter(Boolean).join(" ");
  return /*#__PURE__*/React.createElement("span", _extends({
    className: cls,
    onClick: onClick
  }, rest), swatch && /*#__PURE__*/React.createElement("span", {
    className: "pw-tag__swatch",
    style: {
      background: swatch
    },
    "aria-hidden": "true"
  }), children, onRemove && /*#__PURE__*/React.createElement("span", {
    className: "pw-tag__x",
    role: "button",
    "aria-label": "Remove",
    onClick: e => {
      e.stopPropagation();
      onRemove(e);
    }
  }, /*#__PURE__*/React.createElement(XIcon, null)));
}
Object.assign(__ds_scope, { Tag });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/display/Tag.jsx", error: String((e && e.message) || e) }); }

// components/f1/Countdown.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const STYLE_ID = "pw-countdown-styles";
if (typeof document !== "undefined" && !document.getElementById(STYLE_ID)) {
  const el = document.createElement("style");
  el.id = STYLE_ID;
  el.textContent = `
  .pw-cd { display: inline-flex; align-items: flex-end; gap: var(--space-5); }
  .pw-cd__unit { display: flex; flex-direction: column; align-items: center; gap: var(--space-3); }
  .pw-cd__num {
    font-family: var(--font-mono); font-weight: 600; font-variant-numeric: tabular-nums;
    font-size: var(--text-5xl); line-height: 0.9; color: var(--text-strong); letter-spacing: -0.02em;
  }
  .pw-cd__lbl { font-family: var(--font-sans); font-size: var(--text-2xs); font-weight: 600;
    text-transform: uppercase; letter-spacing: var(--tracking-caps); color: var(--text-tertiary); }
  .pw-cd__sep { font-family: var(--font-mono); font-size: var(--text-4xl); color: var(--ink-500); line-height: 1; padding-bottom: 18px; }
  .pw-cd--sm .pw-cd__num { font-size: var(--text-2xl); }
  .pw-cd--sm .pw-cd__sep { font-size: var(--text-xl); padding-bottom: 9px; }
  .pw-cd--lg .pw-cd__num { font-size: var(--text-7xl); }
  .pw-cd__live { font-family: var(--font-display); font-weight: 800; font-size: var(--text-4xl);
    color: var(--live); text-transform: uppercase; letter-spacing: 0.04em; display: inline-flex; align-items: center; gap: var(--space-5); }
  `;
  document.head.appendChild(el);
}
function diff(target) {
  const ms = Math.max(0, new Date(target).getTime() - Date.now());
  const s = Math.floor(ms / 1000);
  return {
    done: ms === 0,
    days: Math.floor(s / 86400),
    hours: Math.floor(s % 86400 / 3600),
    mins: Math.floor(s % 3600 / 60),
    secs: s % 60
  };
}
const pad = n => String(n).padStart(2, "0");
function Countdown({
  to,
  size = "md",
  showDays = true,
  liveLabel = "LIVE NOW",
  className = "",
  ...rest
}) {
  const [t, setT] = React.useState(() => diff(to));
  React.useEffect(() => {
    const id = setInterval(() => setT(diff(to)), 1000);
    return () => clearInterval(id);
  }, [to]);
  const cls = ["pw-cd", size !== "md" ? `pw-cd--${size}` : "", className].filter(Boolean).join(" ");
  if (t.done) {
    return /*#__PURE__*/React.createElement("span", _extends({
      className: ["pw-cd__live", className].filter(Boolean).join(" ")
    }, rest), /*#__PURE__*/React.createElement("span", {
      className: "pw-live-dot"
    }), liveLabel);
  }
  const units = [];
  if (showDays) units.push({
    n: t.days,
    l: "Days"
  });
  units.push({
    n: pad(t.hours),
    l: "Hrs"
  }, {
    n: pad(t.mins),
    l: "Min"
  }, {
    n: pad(t.secs),
    l: "Sec"
  });
  return /*#__PURE__*/React.createElement("span", _extends({
    className: cls
  }, rest), units.map((u, i) => /*#__PURE__*/React.createElement(React.Fragment, {
    key: u.l
  }, i > 0 && /*#__PURE__*/React.createElement("span", {
    className: "pw-cd__sep",
    "aria-hidden": "true"
  }, ":"), /*#__PURE__*/React.createElement("span", {
    className: "pw-cd__unit"
  }, /*#__PURE__*/React.createElement("span", {
    className: "pw-cd__num"
  }, u.n), /*#__PURE__*/React.createElement("span", {
    className: "pw-cd__lbl"
  }, u.l)))));
}
Object.assign(__ds_scope, { Countdown });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/f1/Countdown.jsx", error: String((e && e.message) || e) }); }

// components/f1/DriverTag.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const STYLE_ID = "pw-drivertag-styles";
if (typeof document !== "undefined" && !document.getElementById(STYLE_ID)) {
  const el = document.createElement("style");
  el.id = STYLE_ID;
  el.textContent = `
  .pw-driver { display: inline-flex; align-items: center; gap: var(--space-5); min-width: 0; }
  .pw-driver__avatar { flex: none; }
  .pw-driver__pos {
    font-family: var(--font-mono); font-weight: 700; font-size: var(--text-sm);
    color: var(--text-tertiary); width: 22px; text-align: right; flex: none;
    font-variant-numeric: tabular-nums;
  }
  .pw-driver__bar { width: 4px; align-self: stretch; min-height: 20px; border-radius: var(--radius-pill); background: var(--_team, var(--accent)); flex: none; }
  .pw-driver__id { display: flex; flex-direction: column; min-width: 0; }
  .pw-driver__code { font-family: var(--font-display); font-weight: 700; font-size: var(--text-md); color: var(--text-primary); letter-spacing: 0.02em; line-height: 1.1; }
  .pw-driver__name { font-size: var(--text-2xs); color: var(--text-tertiary); line-height: 1.2; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .pw-driver__num { font-family: var(--font-mono); font-weight: 700; font-size: var(--text-2xs); color: var(--_team, var(--text-secondary)); margin-left: var(--space-3); }
  .pw-driver--compact .pw-driver__name { display: none; }
  `;
  document.head.appendChild(el);
}
function DriverTag({
  position,
  code,
  name,
  number,
  src,
  team,
  compact = false,
  className = "",
  style = {},
  ...rest
}) {
  const driver = typeof window !== "undefined" && window.PW_DATA && window.PW_DATA.byCode ? window.PW_DATA.byCode[code] : null;
  const Avatar = __ds_scope.Avatar;
  const avatarSrc = src || driver && (driver.remoteImage || driver.image);
  const driverName = name || driver && driver.name;
  const driverNumber = number != null ? number : driver && driver.num;
  const teamColor = team || driver && driver.color;
  const cls = ["pw-driver", compact ? "pw-driver--compact" : "", className].filter(Boolean).join(" ");
  const mergedStyle = teamColor ? {
    ...style,
    "--_team": teamColor
  } : style;
  return /*#__PURE__*/React.createElement("span", _extends({
    className: cls,
    style: mergedStyle
  }, rest), position != null && /*#__PURE__*/React.createElement("span", {
    className: "pw-driver__pos"
  }, position), Avatar && /*#__PURE__*/React.createElement("span", {
    className: "pw-driver__avatar"
  }, /*#__PURE__*/React.createElement(Avatar, {
    initials: code,
    number: driverNumber,
    ring: teamColor,
    src: avatarSrc,
    size: "sm"
  })), /*#__PURE__*/React.createElement("span", {
    className: "pw-driver__bar",
    "aria-hidden": "true"
  }), /*#__PURE__*/React.createElement("span", {
    className: "pw-driver__id"
  }, /*#__PURE__*/React.createElement("span", {
    className: "pw-driver__code"
  }, code, driverNumber != null && /*#__PURE__*/React.createElement("span", {
    className: "pw-driver__num"
  }, "#", driverNumber)), driverName && /*#__PURE__*/React.createElement("span", {
    className: "pw-driver__name"
  }, driverName)));
}
Object.assign(__ds_scope, { DriverTag });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/f1/DriverTag.jsx", error: String((e && e.message) || e) }); }

// components/f1/FlagStatus.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const STYLE_ID = "pw-flag-styles";
if (typeof document !== "undefined" && !document.getElementById(STYLE_ID)) {
  const el = document.createElement("style");
  el.id = STYLE_ID;
  el.textContent = `
  .pw-flag {
    display: inline-flex; align-items: center; gap: var(--space-5);
    height: 30px; padding: 0 var(--space-7) 0 var(--space-5);
    border-radius: var(--radius-sm);
    font-family: var(--font-display); font-weight: var(--fw-bold);
    font-size: var(--text-sm); letter-spacing: 0.06em; text-transform: uppercase;
    border: 1px solid transparent; white-space: nowrap;
  }
  .pw-flag__dot { width: 9px; height: 9px; border-radius: 50%; background: currentColor; flex: none; }
  .pw-flag--green   { background: var(--success-quiet); color: var(--flag-green); border-color: color-mix(in srgb, var(--flag-green) 35%, transparent); }
  .pw-flag--yellow  { background: var(--warning-quiet); color: var(--flag-yellow); border-color: color-mix(in srgb, var(--flag-yellow) 35%, transparent); }
  .pw-flag--red     { background: var(--live); color: #fff; box-shadow: var(--glow-live); border-color: transparent; }
  .pw-flag--sc      { background: var(--warning-quiet); color: var(--flag-sc); border-color: color-mix(in srgb, var(--flag-sc) 40%, transparent); }
  .pw-flag--vsc     { background: var(--warning-quiet); color: var(--flag-vsc); border-color: color-mix(in srgb, var(--flag-vsc) 40%, transparent); }
  .pw-flag--chequered { background: var(--surface-active); color: var(--text-strong); border-color: var(--border-strong); }
  .pw-flag--green .pw-flag__dot,
  .pw-flag--red .pw-flag__dot { animation: pw-pulse-live 1.4s var(--ease-in-out) infinite; }
  @media (prefers-reduced-motion: reduce) { .pw-flag__dot { animation: none !important; } }
  `;
  document.head.appendChild(el);
}
const LABELS = {
  green: "Track Clear",
  yellow: "Yellow Flag",
  red: "Red Flag",
  sc: "Safety Car",
  vsc: "Virtual SC",
  chequered: "Chequered"
};
function FlagStatus({
  status = "green",
  label,
  className = "",
  ...rest
}) {
  const cls = ["pw-flag", `pw-flag--${status}`, className].filter(Boolean).join(" ");
  return /*#__PURE__*/React.createElement("span", _extends({
    className: cls
  }, rest), /*#__PURE__*/React.createElement("span", {
    className: "pw-flag__dot",
    "aria-hidden": "true"
  }), label || LABELS[status] || status);
}
Object.assign(__ds_scope, { FlagStatus });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/f1/FlagStatus.jsx", error: String((e && e.message) || e) }); }

// components/f1/GapDelta.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const STYLE_ID = "pw-gap-styles";
if (typeof document !== "undefined" && !document.getElementById(STYLE_ID)) {
  const el = document.createElement("style");
  el.id = STYLE_ID;
  el.textContent = `
  .pw-gap {
    display: inline-flex; align-items: center; gap: var(--space-2);
    font-family: var(--font-mono); font-weight: 600; font-size: var(--text-md);
    font-variant-numeric: tabular-nums; line-height: 1; white-space: nowrap;
    color: var(--text-secondary);
  }
  .pw-gap--gain { color: var(--t-personal); }
  .pw-gap--loss { color: var(--danger); }
  .pw-gap--fastest { color: var(--t-fastest); }
  .pw-gap__arrow { font-size: 0.8em; }
  .pw-gap--sm { font-size: var(--text-sm); }
  .pw-gap--lg { font-size: var(--text-xl); }
  `;
  document.head.appendChild(el);
}
function GapDelta({
  value,
  trend,
  fastest = false,
  prefix,
  size = "md",
  className = "",
  ...rest
}) {
  let tone = "";
  if (fastest) tone = "pw-gap--fastest";else if (trend === "gain") tone = "pw-gap--gain";else if (trend === "loss") tone = "pw-gap--loss";
  const cls = ["pw-gap", tone, size !== "md" ? `pw-gap--${size}` : "", className].filter(Boolean).join(" ");
  const arrow = trend === "gain" ? "▲" : trend === "loss" ? "▼" : null;
  return /*#__PURE__*/React.createElement("span", _extends({
    className: cls
  }, rest), arrow && /*#__PURE__*/React.createElement("span", {
    className: "pw-gap__arrow",
    "aria-hidden": "true"
  }, arrow), prefix, value);
}
Object.assign(__ds_scope, { GapDelta });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/f1/GapDelta.jsx", error: String((e && e.message) || e) }); }

// components/f1/StatTile.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const STYLE_ID = "pw-stattile-styles";
if (typeof document !== "undefined" && !document.getElementById(STYLE_ID)) {
  const el = document.createElement("style");
  el.id = STYLE_ID;
  el.textContent = `
  .pw-stat {
    display: flex; flex-direction: column; gap: var(--space-3);
    padding: var(--space-7) var(--space-8);
    background: var(--surface-card); border: 1px solid var(--border-subtle);
    border-radius: var(--radius-md); min-width: 0;
  }
  .pw-stat__label {
    font-family: var(--font-sans); font-size: var(--text-2xs); font-weight: var(--fw-semibold);
    text-transform: uppercase; letter-spacing: var(--tracking-caps); color: var(--text-tertiary);
    display: inline-flex; align-items: center; gap: var(--space-3);
  }
  .pw-stat__value {
    font-family: var(--font-mono); font-weight: 600; font-size: var(--text-3xl);
    color: var(--text-strong); line-height: 1; font-variant-numeric: tabular-nums;
  }
  .pw-stat__value--display { font-family: var(--font-display); font-weight: 800; letter-spacing: -0.01em; }
  .pw-stat__unit { font-size: 0.5em; color: var(--text-tertiary); font-weight: 500; margin-left: 3px; }
  .pw-stat__foot { display: inline-flex; align-items: center; gap: var(--space-4); font-size: var(--text-xs); color: var(--text-tertiary); }
  .pw-stat--accent { border-color: var(--accent-border); background: linear-gradient(180deg, var(--accent-soft), transparent 60%), var(--surface-card); }
  `;
  document.head.appendChild(el);
}
function StatTile({
  label,
  value,
  unit,
  icon,
  foot,
  accent = false,
  display = false,
  className = "",
  ...rest
}) {
  const cls = ["pw-stat", accent ? "pw-stat--accent" : "", className].filter(Boolean).join(" ");
  const valCls = ["pw-stat__value", display ? "pw-stat__value--display" : ""].filter(Boolean).join(" ");
  return /*#__PURE__*/React.createElement("div", _extends({
    className: cls
  }, rest), /*#__PURE__*/React.createElement("span", {
    className: "pw-stat__label"
  }, icon, label), /*#__PURE__*/React.createElement("span", {
    className: valCls
  }, value, unit && /*#__PURE__*/React.createElement("span", {
    className: "pw-stat__unit"
  }, unit)), foot != null && /*#__PURE__*/React.createElement("span", {
    className: "pw-stat__foot"
  }, foot));
}
Object.assign(__ds_scope, { StatTile });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/f1/StatTile.jsx", error: String((e && e.message) || e) }); }

// components/f1/TimingRow.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const STYLE_ID = "pw-timingrow-styles";
if (typeof document !== "undefined" && !document.getElementById(STYLE_ID)) {
  const el = document.createElement("style");
  el.id = STYLE_ID;
  el.textContent = `
  .pw-trow {
    display: grid; align-items: center; gap: var(--space-6);
    grid-template-columns: minmax(120px, 1.4fr) 84px 78px 70px 44px;
    padding: var(--space-5) var(--space-6);
    border-bottom: 1px solid var(--border-subtle);
    transition: background var(--dur-fast) var(--ease-standard);
  }
  .pw-trow:hover { background: var(--surface-hover); }
  .pw-trow--selected { background: var(--accent-soft); box-shadow: inset 2px 0 0 var(--accent); }
  .pw-trow--clickable { cursor: pointer; }

  .pw-trow__driver { display: inline-flex; align-items: center; gap: var(--space-5); min-width: 0; }
  .pw-trow__pos { font-family: var(--font-mono); font-weight: 700; font-size: var(--text-sm); color: var(--text-tertiary); width: 22px; text-align: right; flex: none; font-variant-numeric: tabular-nums; }
  .pw-trow__bar { width: 4px; align-self: stretch; min-height: 22px; border-radius: var(--radius-pill); background: var(--_team, var(--accent)); flex: none; }
  .pw-trow__id { display: flex; flex-direction: column; min-width: 0; }
  .pw-trow__code { font-family: var(--font-display); font-weight: 700; font-size: var(--text-md); color: var(--text-primary); letter-spacing: 0.02em; line-height: 1.1; }
  .pw-trow__name { font-size: var(--text-2xs); color: var(--text-tertiary); line-height: 1.2; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

  .pw-trow__last { font-family: var(--font-mono); font-size: var(--text-md); font-weight: 600; font-variant-numeric: tabular-nums; color: var(--text-primary); text-align: right; }
  .pw-trow__last--fastest { color: var(--t-fastest); }
  .pw-trow__last--pb { color: var(--t-personal); }

  .pw-trow__gap { justify-self: end; font-family: var(--font-mono); font-weight: 600; font-size: var(--text-sm); font-variant-numeric: tabular-nums; color: var(--text-secondary); }
  .pw-trow__gap--gain { color: var(--t-personal); }
  .pw-trow__gap--loss { color: var(--danger); }

  .pw-trow__tyre { justify-self: start; display: inline-flex; align-items: center; gap: var(--space-4); }
  .pw-trow__ring { width: 19px; height: 19px; flex: none; border-radius: 50%; display: grid; place-items: center; background: var(--surface-card); border: 2px solid var(--_tc, var(--text-tertiary)); color: var(--_tc, var(--text-primary)); font-family: var(--font-display); font-weight: 700; font-size: 9px; line-height: 1; }
  .pw-trow__tyreage { font-family: var(--font-mono); font-size: var(--text-2xs); color: var(--text-tertiary); }

  .pw-trow__pits { font-family: var(--font-mono); font-size: var(--text-sm); color: var(--text-tertiary); text-align: center; font-variant-numeric: tabular-nums; }
  .pw-trow__head {
    display: grid; gap: var(--space-6);
    grid-template-columns: minmax(120px, 1.4fr) 84px 78px 70px 44px;
    padding: var(--space-4) var(--space-6);
    font-family: var(--font-sans); font-size: var(--text-2xs); font-weight: 600;
    text-transform: uppercase; letter-spacing: var(--tracking-caps); color: var(--text-tertiary);
    border-bottom: 1px solid var(--border-default);
  }
  .pw-trow__head span:nth-child(2), .pw-trow__head span:nth-child(3) { text-align: right; }
  .pw-trow__head span:nth-child(5) { text-align: center; }
  `;
  document.head.appendChild(el);
}
const TYRE = {
  soft: {
    c: "var(--tyre-soft)",
    l: "S"
  },
  medium: {
    c: "var(--tyre-medium)",
    l: "M"
  },
  hard: {
    c: "var(--tyre-hard)",
    l: "H"
  },
  inter: {
    c: "var(--tyre-inter)",
    l: "I"
  },
  wet: {
    c: "var(--tyre-wet)",
    l: "W"
  }
};
function TimingRowHeader() {
  return /*#__PURE__*/React.createElement("div", {
    className: "pw-trow__head"
  }, /*#__PURE__*/React.createElement("span", null, "Driver"), /*#__PURE__*/React.createElement("span", null, "Last lap"), /*#__PURE__*/React.createElement("span", null, "Gap"), /*#__PURE__*/React.createElement("span", null, "Tyre"), /*#__PURE__*/React.createElement("span", null, "Pit"));
}
function TimingRow({
  position,
  code,
  name,
  number,
  team,
  lastLap,
  lapState,
  gap,
  gapTrend,
  compound = "medium",
  tyreAge,
  pits,
  selected = false,
  onClick,
  className = "",
  ...rest
}) {
  const cls = ["pw-trow", selected ? "pw-trow--selected" : "", onClick ? "pw-trow--clickable" : "", className].filter(Boolean).join(" ");
  const lastCls = ["pw-trow__last", lapState === "fastest" ? "pw-trow__last--fastest" : "", lapState === "pb" ? "pw-trow__last--pb" : ""].filter(Boolean).join(" ");
  const gapCls = ["pw-trow__gap", gapTrend === "gain" ? "pw-trow__gap--gain" : "", gapTrend === "loss" ? "pw-trow__gap--loss" : ""].filter(Boolean).join(" ");
  const t = TYRE[compound] || TYRE.medium;
  return /*#__PURE__*/React.createElement("div", _extends({
    className: cls,
    onClick: onClick
  }, rest), /*#__PURE__*/React.createElement("span", {
    className: "pw-trow__driver",
    style: team ? {
      "--_team": team
    } : undefined
  }, position != null && /*#__PURE__*/React.createElement("span", {
    className: "pw-trow__pos"
  }, position), /*#__PURE__*/React.createElement("span", {
    className: "pw-trow__bar",
    "aria-hidden": "true"
  }), /*#__PURE__*/React.createElement("span", {
    className: "pw-trow__id"
  }, /*#__PURE__*/React.createElement("span", {
    className: "pw-trow__code"
  }, code), name && /*#__PURE__*/React.createElement("span", {
    className: "pw-trow__name"
  }, name))), /*#__PURE__*/React.createElement("span", {
    className: lastCls
  }, lastLap), /*#__PURE__*/React.createElement("span", {
    className: gapCls
  }, gap), /*#__PURE__*/React.createElement("span", {
    className: "pw-trow__tyre"
  }, /*#__PURE__*/React.createElement("span", {
    className: "pw-trow__ring",
    style: {
      "--_tc": t.c
    }
  }, t.l), tyreAge != null && /*#__PURE__*/React.createElement("span", {
    className: "pw-trow__tyreage"
  }, tyreAge, "L")), /*#__PURE__*/React.createElement("span", {
    className: "pw-trow__pits"
  }, pits != null ? pits : "—"));
}
Object.assign(__ds_scope, { TimingRowHeader, TimingRow });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/f1/TimingRow.jsx", error: String((e && e.message) || e) }); }

// components/f1/TyreBadge.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const STYLE_ID = "pw-tyre-styles";
if (typeof document !== "undefined" && !document.getElementById(STYLE_ID)) {
  const el = document.createElement("style");
  el.id = STYLE_ID;
  el.textContent = `
  .pw-tyre { display: inline-flex; align-items: center; gap: var(--space-4); }
  .pw-tyre__ring {
    --_s: 24px;
    width: var(--_s); height: var(--_s); flex: none;
    border-radius: 50%; display: grid; place-items: center;
    background: var(--surface-card);
    border: 2.5px solid var(--_c, var(--text-tertiary));
    color: var(--_c, var(--text-primary));
    font-family: var(--font-display); font-weight: var(--fw-bold);
    font-size: calc(var(--_s) * 0.46); line-height: 1;
  }
  .pw-tyre--sm .pw-tyre__ring { --_s: 18px; border-width: 2px; }
  .pw-tyre--lg .pw-tyre__ring { --_s: 32px; border-width: 3px; }
  .pw-tyre__age { font-family: var(--font-mono); font-size: var(--text-xs); color: var(--text-secondary); font-variant-numeric: tabular-nums; }
  .pw-tyre__age b { color: var(--text-primary); font-weight: 600; }
  `;
  document.head.appendChild(el);
}
const COMPOUND = {
  soft: {
    c: "var(--tyre-soft)",
    letter: "S"
  },
  medium: {
    c: "var(--tyre-medium)",
    letter: "M"
  },
  hard: {
    c: "var(--tyre-hard)",
    letter: "H"
  },
  inter: {
    c: "var(--tyre-inter)",
    letter: "I"
  },
  wet: {
    c: "var(--tyre-wet)",
    letter: "W"
  }
};
function TyreBadge({
  compound = "medium",
  age,
  size = "md",
  className = "",
  ...rest
}) {
  const c = COMPOUND[compound] || COMPOUND.medium;
  const cls = ["pw-tyre", size !== "md" ? `pw-tyre--${size}` : "", className].filter(Boolean).join(" ");
  return /*#__PURE__*/React.createElement("span", _extends({
    className: cls
  }, rest), /*#__PURE__*/React.createElement("span", {
    className: "pw-tyre__ring",
    style: {
      "--_c": c.c
    }
  }, c.letter), age != null && /*#__PURE__*/React.createElement("span", {
    className: "pw-tyre__age"
  }, /*#__PURE__*/React.createElement("b", null, age), "L"));
}
Object.assign(__ds_scope, { TyreBadge });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/f1/TyreBadge.jsx", error: String((e && e.message) || e) }); }

// components/forms/Checkbox.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const STYLE_ID = "pw-checkbox-styles";
if (typeof document !== "undefined" && !document.getElementById(STYLE_ID)) {
  const el = document.createElement("style");
  el.id = STYLE_ID;
  el.textContent = `
  .pw-check { display: inline-flex; align-items: center; gap: var(--space-6); cursor: pointer; user-select: none; }
  .pw-check input { position: absolute; opacity: 0; width: 0; height: 0; }
  .pw-check__box {
    width: 17px; height: 17px; border-radius: var(--radius-xs);
    border: 1.5px solid var(--border-strong); background: var(--bg-sunken);
    display: grid; place-items: center; transition: var(--tr-control); flex: none; color: transparent;
  }
  .pw-check input:checked + .pw-check__box { background: var(--accent); border-color: var(--accent); color: var(--text-inverse); }
  .pw-check input:focus-visible + .pw-check__box { box-shadow: var(--ring); }
  .pw-check__box svg { width: 12px; height: 12px; }
  .pw-check__label { font-family: var(--font-sans); font-size: var(--text-md); color: var(--text-primary); }
  .pw-check[data-disabled="true"] { opacity: 0.45; pointer-events: none; }
  `;
  document.head.appendChild(el);
}
function Checkbox({
  checked,
  defaultChecked,
  onChange,
  label,
  disabled = false,
  className = "",
  ...rest
}) {
  return /*#__PURE__*/React.createElement("label", {
    className: ["pw-check", className].filter(Boolean).join(" "),
    "data-disabled": disabled ? "true" : undefined
  }, /*#__PURE__*/React.createElement("input", _extends({
    type: "checkbox",
    checked: checked,
    defaultChecked: defaultChecked,
    onChange: e => onChange && onChange(e.target.checked, e),
    disabled: disabled
  }, rest)), /*#__PURE__*/React.createElement("span", {
    className: "pw-check__box",
    "aria-hidden": "true"
  }, /*#__PURE__*/React.createElement("svg", {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "3.5",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  }, /*#__PURE__*/React.createElement("path", {
    d: "M20 6 9 17l-5-5"
  }))), label && /*#__PURE__*/React.createElement("span", {
    className: "pw-check__label"
  }, label));
}
Object.assign(__ds_scope, { Checkbox });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/Checkbox.jsx", error: String((e && e.message) || e) }); }

// components/forms/Input.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const STYLE_ID = "pw-input-styles";
if (typeof document !== "undefined" && !document.getElementById(STYLE_ID)) {
  const el = document.createElement("style");
  el.id = STYLE_ID;
  el.textContent = `
  .pw-field { display: flex; flex-direction: column; gap: var(--space-4); }
  .pw-field__label { font-family: var(--font-sans); font-size: var(--text-sm);
    font-weight: var(--fw-medium); color: var(--text-secondary); }
  .pw-field__hint { font-family: var(--font-sans); font-size: var(--text-xs); color: var(--text-tertiary); }
  .pw-field__hint--error { color: var(--danger); }
  .pw-input {
    display: flex; align-items: center; gap: var(--space-6);
    height: var(--size-control-md); padding: 0 var(--space-8);
    background: var(--bg-sunken); border: 1px solid var(--border-default);
    border-radius: var(--radius-sm); transition: var(--tr-control);
  }
  .pw-input:hover { border-color: var(--border-strong); }
  .pw-input:focus-within { border-color: var(--accent); box-shadow: 0 0 0 3px var(--accent-quiet); }
  .pw-input--error { border-color: var(--danger); }
  .pw-input--error:focus-within { box-shadow: 0 0 0 3px var(--danger-quiet); }
  .pw-input--sm { height: var(--size-control-sm); }
  .pw-input--lg { height: var(--size-control-lg); }
  .pw-input input {
    flex: 1; min-width: 0; border: 0; background: transparent; outline: none;
    font-family: var(--font-sans); font-size: var(--text-md); color: var(--text-primary);
  }
  .pw-input--mono input { font-family: var(--font-mono); font-variant-numeric: tabular-nums; }
  .pw-input input::placeholder { color: var(--text-disabled); }
  .pw-input__affix { display: inline-flex; color: var(--text-tertiary); flex: none; }
  .pw-input[data-disabled="true"] { opacity: 0.5; pointer-events: none; }
  `;
  document.head.appendChild(el);
}
function Input({
  label,
  hint,
  error,
  size = "md",
  mono = false,
  prefix = null,
  suffix = null,
  disabled = false,
  id,
  className = "",
  ...rest
}) {
  const fieldId = id || (label ? `pw-${label.replace(/\s+/g, "-").toLowerCase()}` : undefined);
  const boxCls = ["pw-input", size !== "md" ? `pw-input--${size}` : "", mono ? "pw-input--mono" : "", error ? "pw-input--error" : ""].filter(Boolean).join(" ");
  return /*#__PURE__*/React.createElement("div", {
    className: ["pw-field", className].filter(Boolean).join(" ")
  }, label && /*#__PURE__*/React.createElement("label", {
    className: "pw-field__label",
    htmlFor: fieldId
  }, label), /*#__PURE__*/React.createElement("div", {
    className: boxCls,
    "data-disabled": disabled ? "true" : undefined
  }, prefix && /*#__PURE__*/React.createElement("span", {
    className: "pw-input__affix"
  }, prefix), /*#__PURE__*/React.createElement("input", _extends({
    id: fieldId,
    disabled: disabled
  }, rest)), suffix && /*#__PURE__*/React.createElement("span", {
    className: "pw-input__affix"
  }, suffix)), (hint || error) && /*#__PURE__*/React.createElement("span", {
    className: ["pw-field__hint", error ? "pw-field__hint--error" : ""].filter(Boolean).join(" ")
  }, error || hint));
}
Object.assign(__ds_scope, { Input });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/Input.jsx", error: String((e && e.message) || e) }); }

// components/forms/Select.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const STYLE_ID = "pw-select-styles";
if (typeof document !== "undefined" && !document.getElementById(STYLE_ID)) {
  const el = document.createElement("style");
  el.id = STYLE_ID;
  el.textContent = `
  .pw-select { position: relative; display: inline-flex; align-items: center; width: 100%; }
  .pw-select select {
    appearance: none; width: 100%; height: var(--size-control-md);
    padding: 0 var(--space-10) 0 var(--space-8);
    background: var(--bg-sunken); color: var(--text-primary);
    border: 1px solid var(--border-default); border-radius: var(--radius-sm);
    font-family: var(--font-sans); font-size: var(--text-md); cursor: pointer;
    transition: var(--tr-control);
  }
  .pw-select select:hover { border-color: var(--border-strong); }
  .pw-select select:focus-visible { outline: none; border-color: var(--accent); box-shadow: 0 0 0 3px var(--accent-quiet); }
  .pw-select--sm select { height: var(--size-control-sm); font-size: var(--text-sm); }
  .pw-select__chev { position: absolute; right: var(--space-6); pointer-events: none; color: var(--text-tertiary); display: inline-flex; }
  `;
  document.head.appendChild(el);
}
function Select({
  options = [],
  value,
  onChange,
  size = "md",
  className = "",
  ...rest
}) {
  const cls = ["pw-select", size !== "md" ? `pw-select--${size}` : "", className].filter(Boolean).join(" ");
  return /*#__PURE__*/React.createElement("div", {
    className: cls
  }, /*#__PURE__*/React.createElement("select", _extends({
    value: value,
    onChange: e => onChange && onChange(e.target.value, e)
  }, rest), options.map(opt => {
    const o = typeof opt === "string" ? {
      value: opt,
      label: opt
    } : opt;
    return /*#__PURE__*/React.createElement("option", {
      key: o.value,
      value: o.value
    }, o.label);
  })), /*#__PURE__*/React.createElement("span", {
    className: "pw-select__chev",
    "aria-hidden": "true"
  }, /*#__PURE__*/React.createElement("svg", {
    width: "14",
    height: "14",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2"
  }, /*#__PURE__*/React.createElement("path", {
    d: "m6 9 6 6 6-6"
  }))));
}
Object.assign(__ds_scope, { Select });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/Select.jsx", error: String((e && e.message) || e) }); }

// components/forms/Switch.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const STYLE_ID = "pw-switch-styles";
if (typeof document !== "undefined" && !document.getElementById(STYLE_ID)) {
  const el = document.createElement("style");
  el.id = STYLE_ID;
  el.textContent = `
  .pw-switch { display: inline-flex; align-items: center; gap: var(--space-6); cursor: pointer; user-select: none; }
  .pw-switch input { position: absolute; opacity: 0; width: 0; height: 0; }
  .pw-switch__track {
    position: relative; width: 36px; height: 20px; border-radius: var(--radius-pill);
    background: var(--ink-700); transition: background var(--dur-fast) var(--ease-standard); flex: none;
  }
  .pw-switch__thumb {
    position: absolute; top: 2px; left: 2px; width: 16px; height: 16px;
    border-radius: 50%; background: var(--ink-200);
    transition: transform var(--dur-fast) var(--ease-out), background var(--dur-fast);
    box-shadow: var(--shadow-xs);
  }
  .pw-switch input:checked + .pw-switch__track { background: var(--accent); }
  .pw-switch input:checked + .pw-switch__track .pw-switch__thumb { transform: translateX(16px); background: #fff; }
  .pw-switch input:focus-visible + .pw-switch__track { box-shadow: var(--ring); }
  .pw-switch__label { font-family: var(--font-sans); font-size: var(--text-md); color: var(--text-primary); }
  .pw-switch[data-disabled="true"] { opacity: 0.45; pointer-events: none; }
  `;
  document.head.appendChild(el);
}
function Switch({
  checked,
  defaultChecked,
  onChange,
  label,
  disabled = false,
  className = "",
  ...rest
}) {
  return /*#__PURE__*/React.createElement("label", {
    className: ["pw-switch", className].filter(Boolean).join(" "),
    "data-disabled": disabled ? "true" : undefined
  }, /*#__PURE__*/React.createElement("input", _extends({
    type: "checkbox",
    checked: checked,
    defaultChecked: defaultChecked,
    onChange: e => onChange && onChange(e.target.checked, e),
    disabled: disabled
  }, rest)), /*#__PURE__*/React.createElement("span", {
    className: "pw-switch__track"
  }, /*#__PURE__*/React.createElement("span", {
    className: "pw-switch__thumb"
  })), label && /*#__PURE__*/React.createElement("span", {
    className: "pw-switch__label"
  }, label));
}
Object.assign(__ds_scope, { Switch });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/Switch.jsx", error: String((e && e.message) || e) }); }

// components/navigation/Tabs.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const STYLE_ID = "pw-tabs-styles";
if (typeof document !== "undefined" && !document.getElementById(STYLE_ID)) {
  const el = document.createElement("style");
  el.id = STYLE_ID;
  el.textContent = `
  .pw-tabs { display: flex; align-items: stretch; gap: var(--space-7); border-bottom: 1px solid var(--border-subtle); }
  .pw-tab {
    appearance: none; border: 0; background: transparent;
    position: relative; display: inline-flex; align-items: center; gap: var(--space-4);
    padding: var(--space-6) 0 calc(var(--space-6) - 1px);
    font-family: var(--font-sans); font-size: var(--text-md); font-weight: var(--fw-medium);
    color: var(--text-tertiary); cursor: pointer; white-space: nowrap;
    transition: color var(--dur-fast) var(--ease-standard);
  }
  .pw-tab:hover { color: var(--text-secondary); }
  .pw-tab[aria-selected="true"] { color: var(--text-primary); }
  .pw-tab[aria-selected="true"]::after {
    content: ""; position: absolute; left: 0; right: 0; bottom: -1px; height: 2px;
    background: var(--accent); border-radius: var(--radius-pill); box-shadow: 0 0 8px var(--blue-glow);
  }
  .pw-tab:focus-visible { outline: none; box-shadow: var(--ring); border-radius: var(--radius-xs); }
  .pw-tab__count {
    font-family: var(--font-mono); font-size: var(--text-2xs); font-weight: 600;
    color: var(--text-tertiary); background: var(--surface-hover);
    padding: 1px 6px; border-radius: var(--radius-pill);
  }
  .pw-tab[aria-selected="true"] .pw-tab__count { color: var(--text-accent); background: var(--accent-quiet); }

  .pw-tabs--pill { border-bottom: 0; gap: var(--space-2); padding: var(--space-2); background: var(--bg-sunken); border-radius: var(--radius-md); display: inline-flex; }
  .pw-tabs--pill .pw-tab { padding: var(--space-4) var(--space-7); border-radius: var(--radius-sm); }
  .pw-tabs--pill .pw-tab[aria-selected="true"] { background: var(--surface-active); color: var(--text-strong); }
  .pw-tabs--pill .pw-tab[aria-selected="true"]::after { display: none; }
  `;
  document.head.appendChild(el);
}
function Tabs({
  options = [],
  value,
  onChange,
  variant = "underline",
  className = "",
  ...rest
}) {
  const cls = ["pw-tabs", variant === "pill" ? "pw-tabs--pill" : "", className].filter(Boolean).join(" ");
  return /*#__PURE__*/React.createElement("div", _extends({
    className: cls,
    role: "tablist"
  }, rest), options.map(opt => {
    const o = typeof opt === "string" ? {
      value: opt,
      label: opt
    } : opt;
    const selected = o.value === value;
    return /*#__PURE__*/React.createElement("button", {
      key: o.value,
      role: "tab",
      type: "button",
      "aria-selected": selected,
      className: "pw-tab",
      onClick: () => onChange && onChange(o.value)
    }, o.icon, o.label, o.count != null && /*#__PURE__*/React.createElement("span", {
      className: "pw-tab__count"
    }, o.count));
  }));
}
Object.assign(__ds_scope, { Tabs });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/navigation/Tabs.jsx", error: String((e && e.message) || e) }); }

// ui_kits/pitwall/Analytics.jsx
try { (() => {
/* Apexline Analytics & Deep Dives. window.PW.Analytics */
(function () {
  const NS = window.PitWallDesignSystem_698fe6;
  const {
    Card,
    Badge,
    Icon,
    SegmentedControl,
    Button,
    Input,
    TyreBadge,
    DriverTag,
    StatTile,
    GapDelta,
    Avatar
  } = NS;
  const D = window.PW_DATA;
  const STYLE_ID = "pw-an-styles";
  if (!document.getElementById(STYLE_ID)) {
    const el = document.createElement("style");
    el.id = STYLE_ID;
    el.textContent = `
    .an { display: flex; flex-direction: column; gap: var(--space-9); }
    .an__query { display: flex; align-items: center; gap: var(--space-6); padding: var(--space-7); border-radius: var(--radius-md); background: var(--surface-card); border: 1px solid var(--border-default); }
    .an__query .pw-field { flex: 1; }
    .an__qpill { display: flex; align-items: center; gap: var(--space-5); }
    .an__kpis { display: grid; grid-template-columns: repeat(4, 1fr); gap: var(--space-7); }
    .an__grid { display: grid; grid-template-columns: 1.6fr 1fr; gap: var(--space-9); align-items: start; }

    /* Pace chart (lap times, lower is better -> taller good bar inverted) */
    .chart { display: flex; align-items: flex-end; gap: 8px; height: 210px; padding: var(--space-7) 0 0; }
    .chart__col { flex: 1; display: flex; flex-direction: column; justify-content: flex-end; align-items: center; gap: 6px; height: 100%; }
    .chart__bars { display: flex; gap: 4px; align-items: flex-end; width: 100%; height: 100%; justify-content: center; }
    .chart__bar { width: 14px; border-radius: 3px 3px 0 0; transition: height var(--dur-slow) var(--ease-out); }
    .chart__x { font-family: var(--font-mono); font-size: 10px; color: var(--text-tertiary); }
    .chart__legend { display: flex; gap: var(--space-7); padding-top: var(--space-6); border-top: 1px solid var(--border-subtle); margin-top: var(--space-6); }
    .lg { display: flex; align-items: center; gap: var(--space-4); font-size: var(--text-sm); color: var(--text-secondary); }
    .lg__dot { width: 10px; height: 10px; border-radius: 3px; }

    /* Stint / tyre strategy timeline */
    .stint { display: grid; grid-template-columns: 64px 1fr; gap: var(--space-6); align-items: center; padding: var(--space-5) 0; }
    .stint__bars { display: flex; gap: 3px; height: 22px; }
    .stint__seg { border-radius: 3px; display: flex; align-items: center; justify-content: center; font-family: var(--font-mono); font-size: 10px; font-weight: 600; color: rgba(0,0,0,0.6); }

    .compare { display: flex; flex-direction: column; gap: var(--space-7); }
    .compare__row { display: grid; grid-template-columns: 1fr 56px 1fr; gap: var(--space-6); align-items: center; }
    .compare__metric { text-align: center; font-size: var(--text-2xs); color: var(--text-tertiary); text-transform: uppercase; letter-spacing: 0.05em; }
    .compare__val { font-family: var(--font-mono); font-weight: 600; font-size: var(--text-md); }
    .compare__track { height: 6px; border-radius: var(--radius-pill); background: var(--bg-sunken); overflow: hidden; position: relative; }
    .compare__fill { position: absolute; top: 0; bottom: 0; }
    `;
    document.head.appendChild(el);
  }

  // pace data: 5 drivers, fastest..slowest (ms over a base)
  const pace = [{
    code: "VER",
    c: "var(--team-redbull)",
    vals: [88, 92, 90]
  }, {
    code: "NOR",
    c: "var(--team-mclaren)",
    vals: [90, 89, 93]
  }, {
    code: "LEC",
    c: "var(--team-ferrari)",
    vals: [93, 95, 91]
  }, {
    code: "PIA",
    c: "var(--team-mclaren)",
    vals: [91, 94, 96]
  }, {
    code: "RUS",
    c: "var(--team-mercedes)",
    vals: [95, 97, 94]
  }];
  const stints = [{
    code: "VER",
    c: "var(--team-redbull)",
    segs: [{
      comp: "soft",
      w: 32,
      laps: 18
    }, {
      comp: "hard",
      w: 68,
      laps: 39
    }]
  }, {
    code: "NOR",
    c: "var(--team-mclaren)",
    segs: [{
      comp: "medium",
      w: 45,
      laps: 26
    }, {
      comp: "medium",
      w: 55,
      laps: 31
    }]
  }, {
    code: "LEC",
    c: "var(--team-ferrari)",
    segs: [{
      comp: "medium",
      w: 40,
      laps: 23
    }, {
      comp: "soft",
      w: 60,
      laps: 34
    }]
  }];
  const compMap = {
    soft: "var(--tyre-soft)",
    medium: "var(--tyre-medium)",
    hard: "var(--tyre-hard)"
  };
  function Analytics() {
    const [mode, setMode] = React.useState("pace");
    return /*#__PURE__*/React.createElement("div", {
      className: "an"
    }, /*#__PURE__*/React.createElement("div", {
      className: "an__query"
    }, /*#__PURE__*/React.createElement(Icon, {
      name: "sparkles",
      size: 18
    }), /*#__PURE__*/React.createElement(Input, {
      mono: true,
      placeholder: "Compare Verstappen 2026 vs 2025 race pace\u2026",
      defaultValue: "Verstappen vs Norris \u2014 Canada 2026 pace"
    }), /*#__PURE__*/React.createElement(SegmentedControl, {
      value: mode,
      onChange: setMode,
      options: [{
        value: "pace",
        label: "Pace"
      }, {
        value: "stints",
        label: "Stints"
      }, {
        value: "h2h",
        label: "H2H"
      }]
    }), /*#__PURE__*/React.createElement(Button, {
      variant: "primary",
      iconLeft: /*#__PURE__*/React.createElement(Icon, {
        name: "chart",
        size: 15
      })
    }, "Run")), /*#__PURE__*/React.createElement("div", {
      className: "an__kpis"
    }, /*#__PURE__*/React.createElement(StatTile, {
      label: "Fastest lap",
      value: "1:28.3",
      foot: /*#__PURE__*/React.createElement("span", {
        style: {
          fontSize: 12,
          color: "var(--t-fastest)"
        }
      }, "VER \xB7 Lap 39"),
      icon: /*#__PURE__*/React.createElement(Icon, {
        name: "stopwatch",
        size: 12
      })
    }), /*#__PURE__*/React.createElement(StatTile, {
      label: "Avg pace",
      value: "1:29.7",
      foot: /*#__PURE__*/React.createElement(GapDelta, {
        value: "0.31s",
        trend: "gain",
        prefix: "vs field "
      }),
      icon: /*#__PURE__*/React.createElement(Icon, {
        name: "gauge",
        size: 12
      })
    }), /*#__PURE__*/React.createElement(StatTile, {
      label: "Top speed",
      value: "342",
      unit: "km/h",
      foot: /*#__PURE__*/React.createElement("span", {
        style: {
          fontSize: 12,
          color: "var(--text-tertiary)"
        }
      }, "DRS \xB7 main straight"),
      icon: /*#__PURE__*/React.createElement(Icon, {
        name: "zap",
        size: 12
      })
    }), /*#__PURE__*/React.createElement(StatTile, {
      label: "Tyre deg",
      value: "0.08",
      unit: "s/lap",
      accent: true,
      foot: /*#__PURE__*/React.createElement("span", {
        style: {
          fontSize: 12,
          color: "var(--text-tertiary)"
        }
      }, "Hard \xB7 stint 2"),
      icon: /*#__PURE__*/React.createElement(Icon, {
        name: "droplet",
        size: 12
      })
    })), /*#__PURE__*/React.createElement("div", {
      className: "an__grid"
    }, /*#__PURE__*/React.createElement(Card, {
      title: "Sector pace comparison",
      subtitle: "Best sectors \xB7 top 5 \xB7 Canada 2026",
      aside: /*#__PURE__*/React.createElement(Badge, {
        tone: "outline"
      }, "Lap 41")
    }, /*#__PURE__*/React.createElement("div", {
      className: "chart"
    }, pace.map(p => {
      const best = Math.min(...p.vals);
      return /*#__PURE__*/React.createElement("div", {
        className: "chart__col",
        key: p.code
      }, /*#__PURE__*/React.createElement("div", {
        className: "chart__bars"
      }, p.vals.map((v, i) => /*#__PURE__*/React.createElement("div", {
        key: i,
        className: "chart__bar",
        style: {
          height: (110 - v) / 26 * 100 + "%",
          background: i === p.vals.indexOf(best) ? p.c : "color-mix(in srgb, " + p.c + " 45%, var(--bg-sunken))"
        }
      }))), /*#__PURE__*/React.createElement("span", {
        className: "chart__x"
      }, p.code));
    })), /*#__PURE__*/React.createElement("div", {
      className: "chart__legend"
    }, /*#__PURE__*/React.createElement("span", {
      className: "lg"
    }, /*#__PURE__*/React.createElement("span", {
      className: "lg__dot",
      style: {
        background: "var(--text-secondary)"
      }
    }), "S1"), /*#__PURE__*/React.createElement("span", {
      className: "lg"
    }, /*#__PURE__*/React.createElement("span", {
      className: "lg__dot",
      style: {
        background: "var(--text-secondary)"
      }
    }), "S2"), /*#__PURE__*/React.createElement("span", {
      className: "lg"
    }, /*#__PURE__*/React.createElement("span", {
      className: "lg__dot",
      style: {
        background: "var(--text-secondary)"
      }
    }), "S3"), /*#__PURE__*/React.createElement("span", {
      style: {
        marginLeft: "auto",
        fontSize: 12,
        color: "var(--text-tertiary)"
      }
    }, "Taller = faster sector"))), /*#__PURE__*/React.createElement(Card, {
      title: "Head-to-head",
      subtitle: "Verstappen vs Norris"
    }, /*#__PURE__*/React.createElement("div", {
      className: "compare"
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        justifyContent: "space-between",
        marginBottom: 4
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        alignItems: "center",
        gap: 8
      }
    }, /*#__PURE__*/React.createElement(Avatar, {
      initials: "VER",
      number: 1,
      ring: "var(--team-redbull)",
      size: "sm"
    }), /*#__PURE__*/React.createElement("b", {
      style: {
        color: "var(--text-primary)"
      }
    }, "VER")), /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        alignItems: "center",
        gap: 8
      }
    }, /*#__PURE__*/React.createElement("b", {
      style: {
        color: "var(--text-primary)"
      }
    }, "NOR"), /*#__PURE__*/React.createElement(Avatar, {
      initials: "NOR",
      number: 4,
      ring: "var(--team-mclaren)",
      size: "sm"
    }))), [{
      m: "Quali",
      a: "1:11.8",
      b: "1:11.9",
      av: 55,
      label: false
    }, {
      m: "Avg lap",
      a: "1:29.5",
      b: "1:29.6",
      av: 52
    }, {
      m: "Top speed",
      a: "340",
      b: "342",
      av: 47
    }, {
      m: "Pit loss",
      a: "21.4",
      b: "21.1",
      av: 44
    }, {
      m: "Overtakes",
      a: "2",
      b: "4",
      av: 36
    }].map((r, i) => /*#__PURE__*/React.createElement("div", {
      className: "compare__row",
      key: i
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        textAlign: "right"
      }
    }, /*#__PURE__*/React.createElement("span", {
      className: "compare__val",
      style: {
        color: r.av >= 50 ? "var(--accent)" : "var(--text-secondary)"
      }
    }, r.a), /*#__PURE__*/React.createElement("div", {
      className: "compare__track"
    }, /*#__PURE__*/React.createElement("span", {
      className: "compare__fill",
      style: {
        right: "50%",
        width: r.av / 2 + "%",
        background: "var(--team-redbull)"
      }
    }))), /*#__PURE__*/React.createElement("span", {
      className: "compare__metric"
    }, r.m), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("span", {
      className: "compare__val",
      style: {
        color: r.av < 50 ? "var(--accent)" : "var(--text-secondary)"
      }
    }, r.b), /*#__PURE__*/React.createElement("div", {
      className: "compare__track"
    }, /*#__PURE__*/React.createElement("span", {
      className: "compare__fill",
      style: {
        left: "50%",
        width: (100 - r.av) / 2 + "%",
        background: "var(--team-mclaren)"
      }
    }))))))), /*#__PURE__*/React.createElement(Card, {
      title: "Tyre strategy",
      subtitle: "Stint timeline \xB7 57 laps",
      padding: "default"
    }, /*#__PURE__*/React.createElement("div", null, stints.map(s => /*#__PURE__*/React.createElement("div", {
      className: "stint",
      key: s.code
    }, /*#__PURE__*/React.createElement(DriverTag, {
      code: s.code,
      team: s.c,
      compact: true
    }), /*#__PURE__*/React.createElement("div", {
      className: "stint__bars"
    }, s.segs.map((seg, i) => /*#__PURE__*/React.createElement("div", {
      key: i,
      className: "stint__seg",
      style: {
        width: seg.w + "%",
        background: compMap[seg.comp]
      }
    }, seg.laps, "L"))))), /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        gap: 14,
        marginTop: 12,
        paddingTop: 12,
        borderTop: "1px solid var(--border-subtle)"
      }
    }, /*#__PURE__*/React.createElement(TyreBadge, {
      compound: "soft",
      size: "sm"
    }), /*#__PURE__*/React.createElement(TyreBadge, {
      compound: "medium",
      size: "sm"
    }), /*#__PURE__*/React.createElement(TyreBadge, {
      compound: "hard",
      size: "sm"
    })))), /*#__PURE__*/React.createElement(Card, {
      title: "Saved queries",
      aside: /*#__PURE__*/React.createElement(Icon, {
        name: "bookmark",
        size: 15
      }),
      padding: "tight"
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        flexDirection: "column"
      }
    }, ["Verstappen 2026 vs 2025 pace", "McLaren pit-stop consistency", "Wet-weather pace ranking", "Rookie sector deltas — Antonelli"].map((q, i) => /*#__PURE__*/React.createElement("div", {
      key: i,
      style: {
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "10px 12px",
        borderRadius: "var(--radius-sm)",
        cursor: "pointer"
      },
      onMouseEnter: e => e.currentTarget.style.background = "var(--surface-hover)",
      onMouseLeave: e => e.currentTarget.style.background = "transparent"
    }, /*#__PURE__*/React.createElement(Icon, {
      name: "chart",
      size: 14
    }), /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 13,
        color: "var(--text-secondary)"
      }
    }, q), /*#__PURE__*/React.createElement(Icon, {
      name: "chevronRight",
      size: 13
    })))))));
  }
  window.PW = window.PW || {};
  window.PW.Analytics = Analytics;
})();
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/pitwall/Analytics.jsx", error: String((e && e.message) || e) }); }

// ui_kits/pitwall/AppShell.jsx
try { (() => {
/* Apexline AppShell — sidebar + topbar chrome for non-live screens.
   Exposes window.PW.AppShell. Reads window.PitWallDesignSystem_698fe6. */
(function () {
  const NS = window.PitWallDesignSystem_698fe6;
  const {
    Icon,
    Badge,
    Avatar
  } = NS;
  const STYLE_ID = "pw-shell-styles";
  if (!document.getElementById(STYLE_ID)) {
    const el = document.createElement("style");
    el.id = STYLE_ID;
    el.textContent = `
    .pw-app { display: grid; grid-template-columns: var(--sidebar-w) 1fr; height: 100%; background: var(--bg-app); color: var(--text-primary); font-family: var(--font-sans); }
    /* Sidebar */
    .pw-side { display: flex; flex-direction: column; background: var(--bg-base); border-right: 1px solid var(--border-subtle); min-height: 0; }
    .pw-side__brand { display: flex; align-items: center; gap: var(--space-6); padding: var(--space-8) var(--space-8) var(--space-7); }
    .pw-side__mark { width: 30px; height: 30px; border-radius: 8px; flex: none; }
    .pw-side__wm { font-family: var(--font-display); font-weight: 800; font-size: 21px; letter-spacing: -0.01em; color: var(--text-strong); line-height: 1; }
    .pw-side__wm i { font-style: normal; color: var(--accent); }
    .pw-side__nav { display: flex; flex-direction: column; gap: 1px; padding: var(--space-6) var(--space-6); overflow-y: auto; flex: 1; min-height: 0; }
    .pw-side__sec { font-size: var(--text-2xs); font-weight: 600; letter-spacing: var(--tracking-caps); text-transform: uppercase; color: var(--text-tertiary); padding: var(--space-7) var(--space-5) var(--space-4); }
    .pw-navitem { display: flex; align-items: center; gap: var(--space-6); padding: var(--space-5) var(--space-6); border-radius: var(--radius-sm); color: var(--text-secondary); cursor: pointer; font-size: var(--text-md); font-weight: 500; border: 1px solid transparent; transition: background var(--dur-fast) var(--ease-standard), color var(--dur-fast) var(--ease-standard); position: relative; }
    .pw-navitem:hover { background: var(--surface-hover); color: var(--text-primary); }
    .pw-navitem[data-active="true"] { background: var(--accent-quiet); color: var(--text-strong); }
    .pw-navitem[data-active="true"]::before { content: ""; position: absolute; left: -6px; top: 8px; bottom: 8px; width: 3px; border-radius: var(--radius-pill); background: var(--accent); box-shadow: 0 0 10px var(--blue-glow); }
    .pw-navitem__count { margin-left: auto; font-family: var(--font-mono); font-size: var(--text-2xs); color: var(--text-tertiary); }
    .pw-navitem__live { margin-left: auto; }
    .pw-side__foot { border-top: 1px solid var(--border-subtle); padding: var(--space-6); display: flex; align-items: center; gap: var(--space-6); }
    .pw-side__user { display: flex; flex-direction: column; min-width: 0; }
    .pw-side__uname { font-size: var(--text-sm); font-weight: 600; color: var(--text-primary); }
    .pw-side__umeta { font-size: var(--text-2xs); color: var(--text-tertiary); }

    /* Main */
    .pw-main { display: flex; flex-direction: column; min-width: 0; min-height: 0; background: var(--bg-base); background-image: var(--grad-hero); }
    .pw-top { display: flex; align-items: center; gap: var(--space-7); height: var(--topbar-h); padding: 0 var(--space-9); border-bottom: 1px solid var(--border-subtle); background: color-mix(in srgb, var(--bg-base) 78%, transparent); backdrop-filter: blur(var(--blur-md, 14px)); flex: none; }
    .pw-top__title { font-family: var(--font-display); font-weight: 700; font-size: var(--text-xl); color: var(--text-strong); letter-spacing: -0.01em; }
    .pw-top__crumb { font-size: var(--text-sm); color: var(--text-tertiary); }
    .pw-top__search { display: flex; align-items: center; gap: var(--space-5); height: var(--size-control-sm); padding: 0 var(--space-7); background: var(--bg-sunken); border: 1px solid var(--border-default); border-radius: var(--radius-pill); color: var(--text-tertiary); font-size: var(--text-sm); min-width: 210px; cursor: text; }
    .pw-top__search kbd { margin-left: auto; font-family: var(--font-mono); font-size: 10px; background: var(--surface-raised); border: 1px solid var(--border-default); border-radius: var(--radius-xs); padding: 1px 5px; color: var(--text-tertiary); }
    .pw-top__actions { display: flex; align-items: center; gap: var(--space-4); margin-left: auto; }
    .pw-top__icon { display: inline-grid; place-items: center; width: 34px; height: 34px; border-radius: var(--radius-sm); color: var(--text-secondary); cursor: pointer; position: relative; }
    .pw-top__icon:hover { background: var(--surface-hover); color: var(--text-primary); }
    .pw-top__dot { position: absolute; top: 7px; right: 8px; width: 6px; height: 6px; border-radius: 50%; background: var(--accent); border: 1.5px solid var(--bg-base); }
    .pw-live-cta { display: inline-flex; align-items: center; gap: var(--space-5); height: var(--size-control-sm); padding: 0 var(--space-7); border-radius: var(--radius-pill); background: var(--live); color: #fff; font-weight: 700; font-size: var(--text-sm); letter-spacing: 0.04em; cursor: pointer; box-shadow: var(--glow-live); border: 0; }
    .pw-live-cta__dot { width: 7px; height: 7px; border-radius: 50%; background: #fff; animation: pw-pulse-live 1.4s var(--ease-in-out) infinite; }
    .pw-body { flex: 1; overflow-y: auto; min-height: 0; }
    .pw-body__inner { padding: var(--space-10) var(--space-12); margin: 0; }
    @media (prefers-reduced-motion: reduce) { .pw-live-cta__dot { animation: none; } }
    `;
    document.head.appendChild(el);
  }
  const NAV = [{
    sec: "Race"
  }, {
    id: "dashboard",
    label: "Dashboard",
    icon: "dashboard"
  }, {
    id: "live",
    label: "Live Racing",
    icon: "play",
    live: true
  }, {
    id: "leaderboards",
    label: "Leaderboards",
    icon: "trophy"
  }, {
    id: "schedule",
    label: "Schedule",
    icon: "calendar",
    count: "R9"
  }, {
    sec: "Explore"
  }, {
    id: "news",
    label: "News",
    icon: "news",
    count: "12"
  }, {
    id: "analytics",
    label: "Analytics",
    icon: "chart"
  }, {
    id: "copilot",
    label: "AI Copilot",
    icon: "sparkles",
    badge: "AI"
  }, {
    sec: "App"
  }, {
    id: "settings",
    label: "Settings",
    icon: "settings"
  }];
  function Sidebar({
    active,
    onNavigate
  }) {
    return /*#__PURE__*/React.createElement("aside", {
      className: "pw-side"
    }, /*#__PURE__*/React.createElement("div", {
      className: "pw-side__brand"
    }, /*#__PURE__*/React.createElement("img", {
      className: "pw-side__mark",
      src: "../../assets/logo-mark.svg",
      alt: ""
    }), /*#__PURE__*/React.createElement("div", {
      className: "pw-side__wm"
    }, "PIT", /*#__PURE__*/React.createElement("i", null, "WALL"))), /*#__PURE__*/React.createElement("nav", {
      className: "pw-side__nav"
    }, NAV.map((n, i) => n.sec ? /*#__PURE__*/React.createElement("div", {
      key: "s" + i,
      className: "pw-side__sec"
    }, n.sec) : /*#__PURE__*/React.createElement("div", {
      key: n.id,
      className: "pw-navitem",
      "data-active": active === n.id,
      onClick: () => onNavigate(n.id)
    }, /*#__PURE__*/React.createElement(Icon, {
      name: n.icon,
      size: 17
    }), /*#__PURE__*/React.createElement("span", null, n.label), n.live && /*#__PURE__*/React.createElement("span", {
      className: "pw-navitem__live"
    }, /*#__PURE__*/React.createElement(Badge, {
      tone: "live"
    }, "LIVE")), n.badge && /*#__PURE__*/React.createElement("span", {
      className: "pw-navitem__live"
    }, /*#__PURE__*/React.createElement(Badge, {
      tone: "accent"
    }, n.badge)), n.count && /*#__PURE__*/React.createElement("span", {
      className: "pw-navitem__count"
    }, n.count)))), /*#__PURE__*/React.createElement("div", {
      className: "pw-side__foot"
    }, /*#__PURE__*/React.createElement(Avatar, {
      initials: "AR",
      size: "md"
    }), /*#__PURE__*/React.createElement("div", {
      className: "pw-side__user"
    }, /*#__PURE__*/React.createElement("span", {
      className: "pw-side__uname"
    }, "Alex Ramos"), /*#__PURE__*/React.createElement("span", {
      className: "pw-side__umeta"
    }, "F1 TV Pro \xB7 Claude")), /*#__PURE__*/React.createElement("span", {
      style: {
        marginLeft: "auto",
        color: "var(--text-tertiary)",
        cursor: "pointer",
        display: "inline-flex"
      }
    }, /*#__PURE__*/React.createElement(Icon, {
      name: "settings",
      size: 15
    }))));
  }
  function Topbar({
    title,
    crumb,
    onGoLive,
    actions
  }) {
    return /*#__PURE__*/React.createElement("header", {
      className: "pw-top"
    }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("span", {
      className: "pw-top__title"
    }, title), crumb && /*#__PURE__*/React.createElement("span", {
      className: "pw-top__crumb"
    }, "\xA0\xA0", crumb)), /*#__PURE__*/React.createElement("div", {
      className: "pw-top__search"
    }, /*#__PURE__*/React.createElement(Icon, {
      name: "search",
      size: 14
    }), /*#__PURE__*/React.createElement("span", null, "Search drivers, races\u2026"), /*#__PURE__*/React.createElement("kbd", null, "\u2318K")), /*#__PURE__*/React.createElement("div", {
      className: "pw-top__actions"
    }, actions, /*#__PURE__*/React.createElement("span", {
      className: "pw-top__icon"
    }, /*#__PURE__*/React.createElement(Icon, {
      name: "bell",
      size: 17
    }), /*#__PURE__*/React.createElement("span", {
      className: "pw-top__dot"
    })), /*#__PURE__*/React.createElement("span", {
      className: "pw-top__icon"
    }, /*#__PURE__*/React.createElement(Icon, {
      name: "bookmark",
      size: 17
    })), onGoLive && /*#__PURE__*/React.createElement("button", {
      className: "pw-live-cta",
      onClick: onGoLive
    }, /*#__PURE__*/React.createElement("span", {
      className: "pw-live-cta__dot"
    }), " GO LIVE")));
  }
  function AppShell({
    active,
    onNavigate,
    title,
    crumb,
    onGoLive,
    actions,
    children
  }) {
    return /*#__PURE__*/React.createElement("div", {
      className: "pw-app"
    }, /*#__PURE__*/React.createElement(Sidebar, {
      active: active,
      onNavigate: onNavigate
    }), /*#__PURE__*/React.createElement("main", {
      className: "pw-main"
    }, /*#__PURE__*/React.createElement(Topbar, {
      title: title,
      crumb: crumb,
      onGoLive: onGoLive,
      actions: actions
    }), /*#__PURE__*/React.createElement("div", {
      className: "pw-body"
    }, /*#__PURE__*/React.createElement("div", {
      className: "pw-body__inner"
    }, children))));
  }
  window.PW = window.PW || {};
  window.PW.AppShell = AppShell;
  window.PW.Sidebar = Sidebar;
  window.PW.Topbar = Topbar;
})();
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/pitwall/AppShell.jsx", error: String((e && e.message) || e) }); }

// ui_kits/pitwall/Copilot.jsx
try { (() => {
/* Apexline AI Copilot — race-weekend AI analysis + chatbot. window.PW.Copilot */
(function () {
  const NS = window.PitWallDesignSystem_698fe6;
  const {
    Card,
    Badge,
    Icon,
    Button,
    IconButton,
    Avatar,
    DriverTag,
    GapDelta,
    StatTile,
    Tag
  } = NS;
  const D = window.PW_DATA;
  const C = D.copilot;
  const STYLE_ID = "pw-copilot-styles";
  if (!document.getElementById(STYLE_ID)) {
    const el = document.createElement("style");
    el.id = STYLE_ID;
    el.textContent = `
    .cop { display: grid; grid-template-columns: 1fr 400px; gap: var(--space-9); align-items: start; height: 100%; }
    .cop__main { display: flex; flex-direction: column; gap: var(--space-9); min-width: 0; }

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

    /* Predictions */
    .cop-preds { display: grid; grid-template-columns: repeat(3, 1fr); gap: var(--space-7); }
    .pred { padding: var(--space-8); border-radius: var(--radius-md); background: var(--surface-card); border: 1px solid var(--border-subtle); }
    .pred__top { display: flex; align-items: center; gap: var(--space-6); margin-bottom: var(--space-6); }
    .pred__label { font-size: var(--text-2xs); color: var(--text-tertiary); text-transform: uppercase; letter-spacing: var(--tracking-caps); font-weight: 600; }
    .pred__name { font-family: var(--font-display); font-weight: 700; font-size: var(--text-lg); color: var(--text-primary); }
    .pred__prob { display: flex; align-items: baseline; gap: 4px; margin: var(--space-5) 0; }
    .pred__probv { font-family: var(--font-mono); font-weight: 600; font-size: var(--text-3xl); color: var(--text-strong); font-variant-numeric: tabular-nums; }
    .pred__probu { font-size: var(--text-md); color: var(--text-tertiary); }
    .pred__track { height: 5px; border-radius: var(--radius-pill); background: var(--bg-sunken); overflow: hidden; margin-bottom: var(--space-6); }
    .pred__fill { height: 100%; border-radius: var(--radius-pill); }
    .pred__note { font-size: var(--text-sm); color: var(--text-tertiary); line-height: 1.4; }

    /* Storylines */
    .story { display: flex; gap: var(--space-7); padding: var(--space-7) 0; border-bottom: 1px solid var(--border-subtle); }
    .story:last-child { border-bottom: 0; }
    .story__icon { display: inline-grid; place-items: center; width: 34px; height: 34px; border-radius: var(--radius-sm); background: var(--accent-quiet); color: var(--accent); flex: none; }
    .story__tag { font-size: var(--text-2xs); color: var(--text-tertiary); text-transform: uppercase; letter-spacing: var(--tracking-caps); font-weight: 600; margin-bottom: 3px; }
    .story__text { font-size: var(--text-sm); color: var(--text-secondary); line-height: 1.5; text-wrap: pretty; }

    /* Factors */
    .factors { display: grid; grid-template-columns: repeat(2, 1fr); gap: var(--space-7) var(--space-9); }
    .factor__top { display: flex; align-items: baseline; justify-content: space-between; margin-bottom: 6px; }
    .factor__l { font-size: var(--text-sm); color: var(--text-secondary); font-weight: 500; }
    .factor__v { font-family: var(--font-mono); font-weight: 600; font-size: var(--text-md); color: var(--text-primary); }
    .factor__track { height: 6px; border-radius: var(--radius-pill); background: var(--bg-sunken); overflow: hidden; }
    .factor__fill { height: 100%; border-radius: var(--radius-pill); }
    .factor__hint { font-size: var(--text-2xs); color: var(--text-tertiary); margin-top: 5px; }

    /* Chat panel */
    .cop-chat { display: flex; flex-direction: column; height: calc(100vh - var(--topbar-h) - var(--space-10) - var(--space-10)); position: sticky; top: 0;
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
    @keyframes pw-typing { 0%, 60%, 100% { opacity: 0.3; transform: translateY(0); } 30% { opacity: 1; transform: translateY(-3px); } }
    @media (prefers-reduced-motion: reduce) { .cop-chat__typing i { animation: none; } }
    `;
    document.head.appendChild(el);
  }
  const probColor = i => i === 0 ? "var(--accent)" : i === 1 ? "var(--t-personal)" : "var(--t-fastest)";
  function Copilot() {
    const [messages, setMessages] = React.useState(C.chat);
    const [draft, setDraft] = React.useState("");
    const [typing, setTyping] = React.useState(false);
    const msgsRef = React.useRef(null);
    React.useEffect(() => {
      if (msgsRef.current) msgsRef.current.scrollTop = msgsRef.current.scrollHeight;
    }, [messages, typing]);
    function send(text) {
      const q = (text || draft).trim();
      if (!q) return;
      setMessages(m => [...m, {
        who: "me",
        text: q
      }]);
      setDraft("");
      setTyping(true);
      setTimeout(() => {
        setTyping(false);
        setMessages(m => [...m, {
          who: "ai",
          text: canned(q)
        }]);
      }, 1100);
    }
    function canned(q) {
      const s = q.toLowerCase();
      if (s.includes("rain") || s.includes("weather")) return "If the shower arrives, the crossover to intermediates is the whole race. The model flags lap 44–48 as the danger window. Verstappen's one-stop buffer evaporates under a VSC, and Hamilton/Alonso — both top-3 wet-pace this year — become live podium threats. I'd watch for McLaren pitting Piastri proactively to cover it.";
      if (s.includes("one-stop") || s.includes("pace")) return "On pure race-pace projection: Verstappen first (1:29.4 avg), Norris within a tenth, then a 0.3s gap to Leclerc. Verstappen's edge is tyre management in the final stint — he's projected to lose just 0.08s/lap on the hard, the lowest deg in the field.";
      if (s.includes("safety car") || s.includes("history")) return "This circuit has thrown a safety car in 7 of the last 10 races (70%), usually triggered at the Wall of Champions or turn 3. That's why I rate the one-stop as slightly risky for leaders — a late SC bunches the field and hands a free pit-stop to anyone yet to box.";
      if (s.includes("norris") || s.includes("piastri") || s.includes("qualifying")) return "Norris has out-qualified Piastri 6–3 in 2026, with a median gap of +0.09s. But Piastri's race starts are stronger — he's gained an average of 1.2 positions on lap one versus Norris's 0.3. In a track-position race like Montréal, that start delta matters more than the grid slot.";
      return "Based on this weekend's data: track position is cheap here thanks to long DRS zones, so qualifying matters less than usual. The decisive variables are the safety car (70% likely) and a possible late shower. Want me to run a what-if on either?";
    }
    return /*#__PURE__*/React.createElement("div", {
      className: "cop"
    }, /*#__PURE__*/React.createElement("div", {
      className: "cop__main"
    }, /*#__PURE__*/React.createElement("section", {
      className: "cop-hero"
    }, /*#__PURE__*/React.createElement("div", {
      className: "cop-hero__top"
    }, /*#__PURE__*/React.createElement("span", {
      className: "cop-hero__badge"
    }, /*#__PURE__*/React.createElement(Icon, {
      name: "sparkles",
      size: 13
    }), " AI weekend briefing"), /*#__PURE__*/React.createElement(Badge, {
      tone: "live"
    }, "RACE LIVE"), /*#__PURE__*/React.createElement("span", {
      className: "cop-hero__model"
    }, /*#__PURE__*/React.createElement(Icon, {
      name: "key",
      size: 12
    }), " Claude 4 \xB7 your key")), /*#__PURE__*/React.createElement("h2", {
      className: "cop-hero__h"
    }, "Canadian Grand Prix \u2014 how the race sets up"), /*#__PURE__*/React.createElement("p", {
      className: "cop-hero__sum"
    }, C.summary), /*#__PURE__*/React.createElement("div", {
      className: "cop-hero__conf"
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 11,
        color: "var(--text-tertiary)",
        textTransform: "uppercase",
        letterSpacing: "0.08em",
        fontWeight: 600
      }
    }, "Model confidence"), /*#__PURE__*/React.createElement("div", {
      className: "cop-conf__track"
    }, /*#__PURE__*/React.createElement("div", {
      className: "cop-conf__fill",
      style: {
        width: C.confidence * 100 + "%"
      }
    })), /*#__PURE__*/React.createElement("span", {
      style: {
        fontFamily: "var(--font-mono)",
        fontWeight: 600,
        color: "var(--text-primary)"
      }
    }, Math.round(C.confidence * 100), "%"), /*#__PURE__*/React.createElement("span", {
      style: {
        marginLeft: "auto",
        fontSize: 12,
        color: "var(--text-tertiary)"
      }
    }, "Pole \u2192 win: ", Math.round(C.poleToWin * 100), "%"))), /*#__PURE__*/React.createElement("div", {
      className: "cop-preds"
    }, C.predictions.map((p, i) => {
      const d = D.byCode[p.code];
      return /*#__PURE__*/React.createElement("div", {
        className: "pred",
        key: p.code
      }, /*#__PURE__*/React.createElement("div", {
        className: "pred__top"
      }, /*#__PURE__*/React.createElement(Avatar, {
        initials: p.code,
        number: d.num,
        ring: d.color,
        size: "md"
      }), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
        className: "pred__label"
      }, p.label), /*#__PURE__*/React.createElement("div", {
        className: "pred__name"
      }, d.name.split(" ")[1] || d.name))), /*#__PURE__*/React.createElement("div", {
        className: "pred__prob"
      }, /*#__PURE__*/React.createElement("span", {
        className: "pred__probv"
      }, Math.round(p.prob * 100)), /*#__PURE__*/React.createElement("span", {
        className: "pred__probu"
      }, "% likely")), /*#__PURE__*/React.createElement("div", {
        className: "pred__track"
      }, /*#__PURE__*/React.createElement("div", {
        className: "pred__fill",
        style: {
          width: p.prob * 100 + "%",
          background: probColor(i)
        }
      })), /*#__PURE__*/React.createElement("div", {
        className: "pred__note"
      }, p.note));
    })), /*#__PURE__*/React.createElement("div", {
      style: {
        display: "grid",
        gridTemplateColumns: "1.3fr 1fr",
        gap: "var(--space-9)",
        alignItems: "start"
      }
    }, /*#__PURE__*/React.createElement(Card, {
      title: "Key storylines",
      subtitle: "What the model is watching",
      aside: /*#__PURE__*/React.createElement(Icon, {
        name: "sparkles",
        size: 15
      }),
      padding: "default"
    }, C.storylines.map((s, i) => /*#__PURE__*/React.createElement("div", {
      className: "story",
      key: i
    }, /*#__PURE__*/React.createElement("span", {
      className: "story__icon"
    }, /*#__PURE__*/React.createElement(Icon, {
      name: s.icon,
      size: 17
    })), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
      className: "story__tag"
    }, s.tag), /*#__PURE__*/React.createElement("div", {
      className: "story__text"
    }, s.text))))), /*#__PURE__*/React.createElement(Card, {
      title: "Weekend factors",
      subtitle: "Modelled conditions",
      padding: "default"
    }, /*#__PURE__*/React.createElement("div", {
      className: "factors"
    }, C.factors.map((f, i) => /*#__PURE__*/React.createElement("div", {
      key: i
    }, /*#__PURE__*/React.createElement("div", {
      className: "factor__top"
    }, /*#__PURE__*/React.createElement("span", {
      className: "factor__l"
    }, f.label), /*#__PURE__*/React.createElement("span", {
      className: "factor__v"
    }, f.value, "%")), /*#__PURE__*/React.createElement("div", {
      className: "factor__track"
    }, /*#__PURE__*/React.createElement("div", {
      className: "factor__fill",
      style: {
        width: f.value + "%",
        background: f.value > 60 ? "var(--warning)" : f.value > 35 ? "var(--accent)" : "var(--success)"
      }
    })), /*#__PURE__*/React.createElement("div", {
      className: "factor__hint"
    }, f.hint)))))), /*#__PURE__*/React.createElement(Card, {
      title: "Strategy outlook",
      subtitle: "Optimal race plan \xB7 model-derived",
      aside: /*#__PURE__*/React.createElement(Badge, {
        tone: "accent"
      }, "One-stop"),
      padding: "default"
    }, /*#__PURE__*/React.createElement("p", {
      style: {
        fontSize: 14,
        lineHeight: 1.6,
        color: "var(--text-secondary)",
        margin: 0,
        textWrap: "pretty"
      }
    }, C.strategy))), /*#__PURE__*/React.createElement("div", {
      className: "cop-chat"
    }, /*#__PURE__*/React.createElement("div", {
      className: "cop-chat__hd"
    }, /*#__PURE__*/React.createElement("span", {
      className: "cop-chat__avatar"
    }, /*#__PURE__*/React.createElement(Icon, {
      name: "sparkles",
      size: 17
    })), /*#__PURE__*/React.createElement("div", {
      style: {
        flex: 1
      }
    }, /*#__PURE__*/React.createElement("div", {
      className: "cop-chat__t"
    }, "Race Engineer"), /*#__PURE__*/React.createElement("div", {
      className: "cop-chat__s"
    }, /*#__PURE__*/React.createElement("span", {
      className: "cop-chat__status"
    }), " Online \xB7 Claude 4")), /*#__PURE__*/React.createElement(IconButton, {
      variant: "ghost",
      size: "sm",
      label: "New chat"
    }, /*#__PURE__*/React.createElement(Icon, {
      name: "plus",
      size: 16
    }))), /*#__PURE__*/React.createElement("div", {
      className: "cop-chat__msgs",
      ref: msgsRef
    }, messages.map((m, i) => /*#__PURE__*/React.createElement("div", {
      key: i,
      className: "cmsg " + (m.who === "me" ? "cmsg--me" : "cmsg--ai")
    }, m.text)), typing && /*#__PURE__*/React.createElement("div", {
      className: "cmsg cmsg--ai"
    }, /*#__PURE__*/React.createElement("span", {
      className: "cop-chat__typing"
    }, /*#__PURE__*/React.createElement("i", null), /*#__PURE__*/React.createElement("i", null), /*#__PURE__*/React.createElement("i", null)))), messages.length <= 3 && /*#__PURE__*/React.createElement("div", {
      className: "cop-chat__suggest"
    }, C.suggested.map((q, i) => /*#__PURE__*/React.createElement("button", {
      key: i,
      className: "suggest-chip",
      onClick: () => send(q)
    }, /*#__PURE__*/React.createElement(Icon, {
      name: "chevronRight",
      size: 13
    }), " ", q))), /*#__PURE__*/React.createElement("div", {
      className: "cop-chat__compose"
    }, /*#__PURE__*/React.createElement("input", {
      className: "cop-chat__input",
      placeholder: "Ask about the race weekend\u2026",
      value: draft,
      onChange: e => setDraft(e.target.value),
      onKeyDown: e => e.key === "Enter" && send()
    }), /*#__PURE__*/React.createElement(IconButton, {
      variant: "accent",
      label: "Send",
      onClick: () => send()
    }, /*#__PURE__*/React.createElement(Icon, {
      name: "chevronRight",
      size: 17
    })))));
  }
  window.PW = window.PW || {};
  window.PW.Copilot = Copilot;
})();
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/pitwall/Copilot.jsx", error: String((e && e.message) || e) }); }

// ui_kits/pitwall/Dashboard.jsx
try { (() => {
/* Apexline Dashboard screen. window.PW.Dashboard */
(function () {
  const NS = window.PitWallDesignSystem_698fe6;
  const {
    Card,
    Badge,
    Icon,
    Countdown,
    StatTile,
    DriverTag,
    GapDelta,
    Button,
    Avatar,
    FlagStatus
  } = NS;
  const D = window.PW_DATA;
  const STYLE_ID = "pw-dash-styles";
  if (!document.getElementById(STYLE_ID)) {
    const el = document.createElement("style");
    el.id = STYLE_ID;
    el.textContent = `
    .dash { display: flex; flex-direction: column; gap: var(--space-10); }
    .dash__grid { display: grid; grid-template-columns: 1.55fr 1fr; gap: var(--space-9); align-items: start; }
    .dash__col { display: flex; flex-direction: column; gap: var(--space-9); min-width: 0; }

    /* Hero next-race */
    .hero { position: relative; overflow: hidden; border-radius: var(--radius-lg); border: 1px solid var(--border-default); background:
      linear-gradient(120% 120% at 88% -10%, var(--accent-soft), transparent 55%), var(--surface-card); padding: var(--space-10); }
    .hero__eyebrow { display: flex; align-items: center; gap: var(--space-6); font-size: var(--text-2xs); font-weight: 600; letter-spacing: var(--tracking-caps); text-transform: uppercase; color: var(--text-tertiary); }
    .hero__round { color: var(--accent); }
    .hero__name { font-family: var(--font-display); font-weight: 800; font-size: var(--text-5xl); letter-spacing: -0.02em; line-height: 1; margin: var(--space-6) 0 var(--space-5); color: var(--text-strong); }
    .hero__circuit { display: flex; align-items: center; gap: var(--space-5); color: var(--text-secondary); font-size: var(--text-md); }
    .hero__cd { margin-top: var(--space-10); display: flex; align-items: flex-end; justify-content: space-between; gap: var(--space-9); flex-wrap: wrap; }
    .hero__sessions { display: flex; gap: var(--space-4); }
    .sess { display: flex; flex-direction: column; gap: 3px; padding: var(--space-5) var(--space-7); border-radius: var(--radius-sm); background: var(--surface-raised); border: 1px solid var(--border-subtle); min-width: 62px; }
    .sess[data-live="true"] { border-color: var(--accent-border); background: var(--accent-quiet); }
    .sess[data-done="true"] { opacity: 0.5; }
    .sess__k { font-size: var(--text-2xs); color: var(--text-tertiary); text-transform: uppercase; letter-spacing: 0.04em; }
    .sess__t { font-family: var(--font-mono); font-size: var(--text-md); font-weight: 600; color: var(--text-primary); }

    .kpis { display: grid; grid-template-columns: repeat(3, 1fr); gap: var(--space-7); }

    .stand { display: flex; flex-direction: column; }
    .stand__row { display: grid; grid-template-columns: 1fr auto auto; align-items: center; gap: var(--space-7); padding: var(--space-5) var(--space-7); border-radius: var(--radius-sm); }
    .stand__row:hover { background: var(--surface-hover); }
    .stand__pts { font-family: var(--font-mono); font-weight: 600; font-size: var(--text-md); color: var(--text-primary); font-variant-numeric: tabular-nums; }
    .stand__delta { width: 30px; text-align: right; }

    .weather { display: grid; grid-template-columns: repeat(2, 1fr); gap: var(--space-6); }
    .wx { display: flex; align-items: center; gap: var(--space-6); padding: var(--space-6); border-radius: var(--radius-sm); background: var(--surface-raised); border: 1px solid var(--border-subtle); }
    .wx__icon { display: inline-grid; place-items: center; width: 34px; height: 34px; border-radius: var(--radius-sm); background: var(--bg-sunken); color: var(--accent); flex: none; }
    .wx__v { font-family: var(--font-mono); font-weight: 600; font-size: var(--text-lg); color: var(--text-primary); }
    .wx__l { font-size: var(--text-2xs); color: var(--text-tertiary); text-transform: uppercase; letter-spacing: 0.04em; }

    .news { display: flex; flex-direction: column; gap: 1px; }
    .news__item { display: flex; gap: var(--space-7); padding: var(--space-7); border-radius: var(--radius-sm); cursor: pointer; }
    .news__item:hover { background: var(--surface-hover); }
    .news__spine { width: 3px; border-radius: var(--radius-pill); flex: none; }
    .news__body { min-width: 0; }
    .news__meta { display: flex; align-items: center; gap: var(--space-5); margin-bottom: 4px; }
    .news__src { font-size: var(--text-2xs); color: var(--text-tertiary); }
    .news__title { font-size: var(--text-md); font-weight: 600; color: var(--text-primary); line-height: 1.32; text-wrap: pretty; }
    .fav { display: flex; align-items: center; gap: var(--space-7); padding: var(--space-6) var(--space-7); border-radius: var(--radius-sm); background: var(--surface-raised); border: 1px solid var(--border-subtle); }
    .fav__last { margin-left: auto; text-align: right; }
    .fav__pos { font-family: var(--font-display); font-weight: 800; font-size: var(--text-2xl); color: var(--text-strong); line-height: 1; }
    .fav__lbl { font-size: var(--text-2xs); color: var(--text-tertiary); text-transform: uppercase; letter-spacing: 0.04em; }
    `;
    document.head.appendChild(el);
  }
  const soon = new Date(Date.now() + 1000 * 60 * 60 * 27 + 1000 * 60 * 14 + 9000).toISOString();
  function Dashboard() {
    const top5 = D.standings.slice(0, 5);
    const wx = D.race.weather;
    return /*#__PURE__*/React.createElement("div", {
      className: "dash"
    }, /*#__PURE__*/React.createElement("div", {
      className: "dash__grid"
    }, /*#__PURE__*/React.createElement("div", {
      className: "dash__col"
    }, /*#__PURE__*/React.createElement("section", {
      className: "hero"
    }, /*#__PURE__*/React.createElement("div", {
      className: "hero__eyebrow"
    }, /*#__PURE__*/React.createElement("span", null, "Next race"), /*#__PURE__*/React.createElement("span", {
      className: "hero__round"
    }, "Round ", D.race.round, " / 24"), /*#__PURE__*/React.createElement(FlagStatus, {
      status: "green",
      label: "Track Clear"
    })), /*#__PURE__*/React.createElement("h1", {
      className: "hero__name"
    }, "Canadian Grand Prix"), /*#__PURE__*/React.createElement("div", {
      className: "hero__circuit"
    }, /*#__PURE__*/React.createElement(Icon, {
      name: "pin",
      size: 15
    }), " Circuit Gilles-Villeneuve \xB7 Montr\xE9al"), /*#__PURE__*/React.createElement("div", {
      className: "hero__cd"
    }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
      className: "fav__lbl",
      style: {
        marginBottom: 8
      }
    }, "Lights out in"), /*#__PURE__*/React.createElement(Countdown, {
      to: soon,
      size: "md"
    })), /*#__PURE__*/React.createElement("div", {
      className: "hero__sessions"
    }, D.sessions.map(s => /*#__PURE__*/React.createElement("div", {
      className: "sess",
      key: s.kind,
      "data-live": s.status === "live",
      "data-done": s.status === "done"
    }, /*#__PURE__*/React.createElement("span", {
      className: "sess__k"
    }, s.kind.replace("Practice", "FP")), /*#__PURE__*/React.createElement("span", {
      className: "sess__t"
    }, s.time)))))), /*#__PURE__*/React.createElement("div", {
      className: "kpis"
    }, /*#__PURE__*/React.createElement(StatTile, {
      label: "Your driver",
      value: "P2",
      display: true,
      accent: true,
      foot: /*#__PURE__*/React.createElement("span", {
        style: {
          color: "var(--text-tertiary)",
          fontSize: 12
        }
      }, "Lando Norris \xB7 263 pts"),
      icon: /*#__PURE__*/React.createElement(Icon, {
        name: "star",
        size: 12
      })
    }), /*#__PURE__*/React.createElement(StatTile, {
      label: "Title gap",
      value: "24",
      unit: "pts",
      foot: /*#__PURE__*/React.createElement(GapDelta, {
        value: "closing",
        trend: "gain"
      }),
      icon: /*#__PURE__*/React.createElement(Icon, {
        name: "trophy",
        size: 12
      })
    }), /*#__PURE__*/React.createElement(StatTile, {
      label: "Races left",
      value: "15",
      foot: /*#__PURE__*/React.createElement("span", {
        style: {
          color: "var(--text-tertiary)",
          fontSize: 12
        }
      }, "375 pts available"),
      icon: /*#__PURE__*/React.createElement(Icon, {
        name: "calendar",
        size: 12
      })
    })), /*#__PURE__*/React.createElement(Card, {
      title: "Latest",
      subtitle: "From your sources",
      aside: /*#__PURE__*/React.createElement(Button, {
        variant: "quiet",
        size: "sm",
        iconRight: /*#__PURE__*/React.createElement(Icon, {
          name: "chevronRight",
          size: 14
        })
      }, "All news"),
      padding: "tight"
    }, /*#__PURE__*/React.createElement("div", {
      className: "news"
    }, D.news.map((n, i) => /*#__PURE__*/React.createElement("div", {
      className: "news__item",
      key: i
    }, /*#__PURE__*/React.createElement("span", {
      className: "news__spine",
      style: {
        background: n.color
      }
    }), /*#__PURE__*/React.createElement("div", {
      className: "news__body"
    }, /*#__PURE__*/React.createElement("div", {
      className: "news__meta"
    }, /*#__PURE__*/React.createElement(Badge, {
      tone: i === 1 ? "danger" : "outline"
    }, n.tag), /*#__PURE__*/React.createElement("span", {
      className: "news__src"
    }, n.source, " \xB7 ", n.time)), /*#__PURE__*/React.createElement("div", {
      className: "news__title"
    }, n.title))))))), /*#__PURE__*/React.createElement("div", {
      className: "dash__col"
    }, /*#__PURE__*/React.createElement(Card, {
      title: "Drivers' Championship",
      aside: /*#__PURE__*/React.createElement(Badge, {
        tone: "accent"
      }, "2026"),
      padding: "tight"
    }, /*#__PURE__*/React.createElement("div", {
      className: "stand"
    }, top5.map(s => {
      const d = D.byCode[s.code];
      return /*#__PURE__*/React.createElement("div", {
        className: "stand__row",
        key: s.code
      }, /*#__PURE__*/React.createElement(DriverTag, {
        position: s.pos,
        code: s.code,
        name: d.name,
        team: d.color
      }), /*#__PURE__*/React.createElement("span", {
        className: "stand__pts"
      }, s.pts), /*#__PURE__*/React.createElement("span", {
        className: "stand__delta"
      }, s.delta !== 0 ? /*#__PURE__*/React.createElement(GapDelta, {
        value: Math.abs(s.delta),
        trend: s.delta > 0 ? "gain" : "loss",
        size: "sm"
      }) : /*#__PURE__*/React.createElement("span", {
        style: {
          color: "var(--text-tertiary)",
          fontFamily: "var(--font-mono)",
          fontSize: 12
        }
      }, "\u2013")));
    }))), /*#__PURE__*/React.createElement(Card, {
      title: "Track conditions",
      subtitle: "Montr\xE9al \xB7 live",
      padding: "default"
    }, /*#__PURE__*/React.createElement("div", {
      className: "weather"
    }, /*#__PURE__*/React.createElement("div", {
      className: "wx"
    }, /*#__PURE__*/React.createElement("span", {
      className: "wx__icon"
    }, /*#__PURE__*/React.createElement(Icon, {
      name: "thermometer",
      size: 17
    })), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
      className: "wx__v"
    }, wx.air, "\xB0"), /*#__PURE__*/React.createElement("div", {
      className: "wx__l"
    }, "Air temp"))), /*#__PURE__*/React.createElement("div", {
      className: "wx"
    }, /*#__PURE__*/React.createElement("span", {
      className: "wx__icon"
    }, /*#__PURE__*/React.createElement(Icon, {
      name: "gauge",
      size: 17
    })), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
      className: "wx__v"
    }, wx.track, "\xB0"), /*#__PURE__*/React.createElement("div", {
      className: "wx__l"
    }, "Track"))), /*#__PURE__*/React.createElement("div", {
      className: "wx"
    }, /*#__PURE__*/React.createElement("span", {
      className: "wx__icon"
    }, /*#__PURE__*/React.createElement(Icon, {
      name: "droplet",
      size: 17
    })), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
      className: "wx__v"
    }, wx.rain), /*#__PURE__*/React.createElement("div", {
      className: "wx__l"
    }, "Rain"))), /*#__PURE__*/React.createElement("div", {
      className: "wx"
    }, /*#__PURE__*/React.createElement("span", {
      className: "wx__icon"
    }, /*#__PURE__*/React.createElement(Icon, {
      name: "wind",
      size: 17
    })), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
      className: "wx__v"
    }, wx.wind.split(" ")[0]), /*#__PURE__*/React.createElement("div", {
      className: "wx__l"
    }, "Wind km/h"))))), /*#__PURE__*/React.createElement(Card, {
      title: "Your favorites",
      aside: /*#__PURE__*/React.createElement(Icon, {
        name: "star",
        size: 15
      }),
      padding: "tight"
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        flexDirection: "column",
        gap: 8
      }
    }, /*#__PURE__*/React.createElement("div", {
      className: "fav"
    }, /*#__PURE__*/React.createElement(Avatar, {
      initials: "NOR",
      number: 4,
      ring: "var(--team-mclaren)"
    }), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
      style: {
        fontWeight: 600,
        color: "var(--text-primary)"
      }
    }, "Lando Norris"), /*#__PURE__*/React.createElement("div", {
      className: "fav__lbl"
    }, "McLaren")), /*#__PURE__*/React.createElement("div", {
      className: "fav__last"
    }, /*#__PURE__*/React.createElement("div", {
      className: "fav__pos"
    }, "P2"), /*#__PURE__*/React.createElement("div", {
      className: "fav__lbl"
    }, "in Canada"))), /*#__PURE__*/React.createElement("div", {
      className: "fav"
    }, /*#__PURE__*/React.createElement(Avatar, {
      initials: "MCL",
      square: true,
      ring: "var(--team-mclaren)"
    }), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
      style: {
        fontWeight: 600,
        color: "var(--text-primary)"
      }
    }, "McLaren"), /*#__PURE__*/React.createElement("div", {
      className: "fav__lbl"
    }, "Constructor \xB7 P1")), /*#__PURE__*/React.createElement("div", {
      className: "fav__last"
    }, /*#__PURE__*/React.createElement("div", {
      className: "fav__pos"
    }, "504"), /*#__PURE__*/React.createElement("div", {
      className: "fav__lbl"
    }, "points"))))))));
  }
  window.PW = window.PW || {};
  window.PW.Dashboard = Dashboard;
})();
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/pitwall/Dashboard.jsx", error: String((e && e.message) || e) }); }

// ui_kits/pitwall/Leaderboards.jsx
try { (() => {
/* Apexline Leaderboards & Standings. window.PW.Leaderboards */
(function () {
  const NS = window.PitWallDesignSystem_698fe6;
  const {
    Card,
    Badge,
    Icon,
    SegmentedControl,
    DriverTag,
    GapDelta,
    Avatar,
    Button,
    Tag
  } = NS;
  const D = window.PW_DATA;
  const STYLE_ID = "pw-lb-styles";
  if (!document.getElementById(STYLE_ID)) {
    const el = document.createElement("style");
    el.id = STYLE_ID;
    el.textContent = `
    .lb { display: flex; flex-direction: column; gap: var(--space-9); }
    .lb__toolbar { display: flex; align-items: center; gap: var(--space-6); flex-wrap: wrap; }
    .lb__filters { margin-left: auto; display: flex; gap: var(--space-4); }
    .lb__grid { display: grid; grid-template-columns: 1.7fr 1fr; gap: var(--space-9); align-items: start; }

    .table { width: 100%; }
    .table__head { display: grid; grid-template-columns: 56px 1fr 90px 70px 80px; gap: var(--space-6); padding: var(--space-5) var(--space-7); font-size: var(--text-2xs); font-weight: 600; text-transform: uppercase; letter-spacing: var(--tracking-caps); color: var(--text-tertiary); border-bottom: 1px solid var(--border-default); }
    .table__head span:nth-child(3), .table__head span:nth-child(4), .table__head span:nth-child(5) { text-align: right; }
    .trow { display: grid; grid-template-columns: 56px 1fr 90px 70px 80px; gap: var(--space-6); align-items: center; padding: var(--space-6) var(--space-7); border-bottom: 1px solid var(--border-subtle); transition: background var(--dur-fast) var(--ease-standard); }
    .trow:hover { background: var(--surface-hover); }
    .trow__pos { display: flex; align-items: center; gap: var(--space-4); }
    .trow__posnum { font-family: var(--font-display); font-weight: 800; font-size: var(--text-xl); color: var(--text-strong); width: 26px; }
    .trow__pts { font-family: var(--font-mono); font-weight: 600; font-size: var(--text-lg); color: var(--text-primary); text-align: right; font-variant-numeric: tabular-nums; }
    .trow__wins { font-family: var(--font-mono); font-size: var(--text-md); color: var(--text-secondary); text-align: right; }
    .trow__delta { text-align: right; display: flex; justify-content: flex-end; }
    .trow--leader { background: linear-gradient(90deg, var(--accent-soft), transparent 40%); }
    .trow__bar { height: 5px; border-radius: var(--radius-pill); background: var(--_c); margin-top: 5px; }

    .cwrap { display: flex; flex-direction: column; gap: 2px; }
    .crow { display: grid; grid-template-columns: 40px 1fr 70px; gap: var(--space-6); align-items: center; padding: var(--space-6) var(--space-7); border-radius: var(--radius-sm); }
    .crow:hover { background: var(--surface-hover); }
    .crow__id { display: flex; align-items: center; gap: var(--space-6); min-width: 0; }
    .crow__name { font-weight: 600; color: var(--text-primary); font-size: var(--text-md); }
    .crow__bar { height: 6px; border-radius: var(--radius-pill); margin-top: 5px; }
    .crow__pts { font-family: var(--font-mono); font-weight: 600; color: var(--text-primary); text-align: right; }
    .crow__pos { font-family: var(--font-display); font-weight: 800; font-size: var(--text-lg); color: var(--text-tertiary); text-align: center; }
    `;
    document.head.appendChild(el);
  }
  function Leaderboards() {
    const [view, setView] = React.useState("drivers");
    const maxPts = D.standings[0].pts;
    const maxCpts = Math.max(...D.constructors.map(c => c.pts));
    return /*#__PURE__*/React.createElement("div", {
      className: "lb"
    }, /*#__PURE__*/React.createElement("div", {
      className: "lb__toolbar"
    }, /*#__PURE__*/React.createElement(SegmentedControl, {
      value: view,
      onChange: setView,
      accent: true,
      options: [{
        value: "drivers",
        label: "Drivers"
      }, {
        value: "constructors",
        label: "Constructors"
      }]
    }), /*#__PURE__*/React.createElement(Badge, {
      tone: "outline"
    }, "After Round 9 \xB7 Canada"), /*#__PURE__*/React.createElement("div", {
      className: "lb__filters"
    }, /*#__PURE__*/React.createElement(Button, {
      variant: "secondary",
      size: "sm",
      iconLeft: /*#__PURE__*/React.createElement(Icon, {
        name: "filter",
        size: 14
      })
    }, "2026"), /*#__PURE__*/React.createElement(Button, {
      variant: "ghost",
      size: "sm",
      iconLeft: /*#__PURE__*/React.createElement(Icon, {
        name: "chart",
        size: 14
      })
    }, "Head-to-head"))), /*#__PURE__*/React.createElement("div", {
      className: "lb__grid"
    }, view === "drivers" ? /*#__PURE__*/React.createElement(Card, {
      padding: "none"
    }, /*#__PURE__*/React.createElement("div", {
      className: "table"
    }, /*#__PURE__*/React.createElement("div", {
      className: "table__head"
    }, /*#__PURE__*/React.createElement("span", null, "Pos"), /*#__PURE__*/React.createElement("span", null, "Driver"), /*#__PURE__*/React.createElement("span", null, "Points"), /*#__PURE__*/React.createElement("span", null, "Wins"), /*#__PURE__*/React.createElement("span", null, "Move")), D.standings.map(s => {
      const d = D.byCode[s.code];
      return /*#__PURE__*/React.createElement("div", {
        className: "trow" + (s.pos === 1 ? " trow--leader" : ""),
        key: s.code
      }, /*#__PURE__*/React.createElement("div", {
        className: "trow__pos"
      }, /*#__PURE__*/React.createElement("span", {
        className: "trow__posnum"
      }, s.pos)), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(DriverTag, {
        code: s.code,
        name: d.name,
        number: d.num,
        team: d.color
      }), /*#__PURE__*/React.createElement("div", {
        className: "trow__bar",
        style: {
          "--_c": d.color,
          width: s.pts / maxPts * 100 + "%"
        }
      })), /*#__PURE__*/React.createElement("span", {
        className: "trow__pts"
      }, s.pts), /*#__PURE__*/React.createElement("span", {
        className: "trow__wins"
      }, s.wins), /*#__PURE__*/React.createElement("span", {
        className: "trow__delta"
      }, s.delta !== 0 ? /*#__PURE__*/React.createElement(GapDelta, {
        value: Math.abs(s.delta),
        trend: s.delta > 0 ? "gain" : "loss",
        size: "sm"
      }) : /*#__PURE__*/React.createElement("span", {
        style: {
          color: "var(--text-tertiary)",
          fontFamily: "var(--font-mono)"
        }
      }, "\u2013")));
    }))) : /*#__PURE__*/React.createElement(Card, {
      padding: "tight"
    }, /*#__PURE__*/React.createElement("div", {
      className: "cwrap"
    }, D.constructors.map(c => /*#__PURE__*/React.createElement("div", {
      className: "crow",
      key: c.abbr
    }, /*#__PURE__*/React.createElement("span", {
      className: "crow__pos"
    }, c.pos), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
      className: "crow__id"
    }, /*#__PURE__*/React.createElement(Avatar, {
      initials: c.abbr,
      square: true,
      ring: c.color,
      size: "sm"
    }), /*#__PURE__*/React.createElement("span", {
      className: "crow__name"
    }, c.name)), /*#__PURE__*/React.createElement("div", {
      className: "crow__bar",
      style: {
        background: c.color,
        width: c.pts / maxCpts * 100 + "%"
      }
    })), /*#__PURE__*/React.createElement("span", {
      className: "crow__pts"
    }, c.pts))))), /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-9)"
      }
    }, /*#__PURE__*/React.createElement(Card, {
      title: "Title fight",
      subtitle: "Top 2 \xB7 points gap"
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        flexDirection: "column",
        gap: 14
      }
    }, D.standings.slice(0, 2).map((s, i) => {
      const d = D.byCode[s.code];
      return /*#__PURE__*/React.createElement("div", {
        key: s.code,
        style: {
          display: "flex",
          alignItems: "center",
          gap: 12
        }
      }, /*#__PURE__*/React.createElement(Avatar, {
        initials: s.code,
        number: d.num,
        ring: d.color
      }), /*#__PURE__*/React.createElement("div", {
        style: {
          flex: 1
        }
      }, /*#__PURE__*/React.createElement("div", {
        style: {
          fontWeight: 600,
          color: "var(--text-primary)"
        }
      }, d.name), /*#__PURE__*/React.createElement("div", {
        style: {
          fontSize: 12,
          color: "var(--text-tertiary)"
        }
      }, d.team)), /*#__PURE__*/React.createElement("div", {
        style: {
          textAlign: "right"
        }
      }, /*#__PURE__*/React.createElement("div", {
        style: {
          fontFamily: "var(--font-mono)",
          fontWeight: 700,
          fontSize: 22,
          color: i === 0 ? "var(--accent)" : "var(--text-primary)"
        }
      }, s.pts)));
    }), /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        padding: "10px 0 2px",
        borderTop: "1px solid var(--border-subtle)"
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 12,
        color: "var(--text-tertiary)",
        textTransform: "uppercase",
        letterSpacing: "0.06em"
      }
    }, "Gap"), /*#__PURE__*/React.createElement(GapDelta, {
      value: "24 pts",
      trend: "loss",
      size: "md"
    })))), /*#__PURE__*/React.createElement(Card, {
      title: "Filter by team",
      padding: "default"
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        flexWrap: "wrap",
        gap: 8
      }
    }, /*#__PURE__*/React.createElement(Tag, {
      swatch: "var(--team-mclaren)",
      selected: true
    }, "McLaren"), /*#__PURE__*/React.createElement(Tag, {
      swatch: "var(--team-redbull)"
    }, "Red Bull"), /*#__PURE__*/React.createElement(Tag, {
      swatch: "var(--team-ferrari)"
    }, "Ferrari"), /*#__PURE__*/React.createElement(Tag, {
      swatch: "var(--team-mercedes)"
    }, "Mercedes"), /*#__PURE__*/React.createElement(Tag, {
      swatch: "var(--team-williams)"
    }, "Williams"))))));
  }
  window.PW = window.PW || {};
  window.PW.Leaderboards = Leaderboards;
})();
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/pitwall/Leaderboards.jsx", error: String((e && e.message) || e) }); }

// ui_kits/pitwall/LiveRacing.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/* Apexline Live Racing — single unified window. window.PW.LiveRacing */
(function () {
  const NS = window.PitWallDesignSystem_698fe6;
  const {
    Icon,
    Badge,
    Button,
    IconButton,
    SegmentedControl,
    FlagStatus,
    TimingRow,
    TimingRowHeader,
    TyreBadge,
    DriverTag,
    GapDelta,
    Switch,
    Avatar
  } = NS;
  const D = window.PW_DATA;
  const STYLE_ID = "pw-live-styles";
  {
    let el = document.getElementById(STYLE_ID);
    if (!el) {
      el = document.createElement("style");
      el.id = STYLE_ID;
      document.head.appendChild(el);
    }
    el.textContent = `
    .live { display: flex; flex-direction: column; height: 100vh; background: var(--bg-app); color: var(--text-primary); font-family: var(--font-sans); overflow: hidden; }
    /* Window title bar */
    .live__bar { display: flex; align-items: center; gap: var(--space-7); height: 48px; padding: 0 var(--space-7); background: var(--bg-base); border-bottom: 1px solid var(--border-subtle); flex: none; }
    .live__traffic { display: flex; gap: 8px; margin-right: var(--space-5); }
    .live__traffic span { width: 12px; height: 12px; border-radius: 50%; }
    .live__brand { font-family: var(--font-display); font-weight: 800; font-size: 16px; letter-spacing: -0.01em; color: var(--text-strong); }
    .live__brand i { font-style: normal; color: var(--accent); }
    .live__race { display: flex; align-items: center; gap: var(--space-6); font-size: var(--text-sm); color: var(--text-secondary); }
    .live__lap { font-family: var(--font-mono); font-weight: 600; color: var(--text-primary); }
    .live__presets { display: flex; align-items: center; gap: var(--space-4); margin-left: var(--space-7); }
    .preset { height: 28px; padding: 0 var(--space-6); border-radius: var(--radius-sm); background: transparent; border: 1px solid var(--border-default); color: var(--text-secondary); font-family: var(--font-sans); font-size: var(--text-sm); font-weight: 500; cursor: pointer; white-space: nowrap; transition: var(--tr-control); }
    .preset:hover { background: var(--surface-hover); color: var(--text-primary); }
    .preset[data-active="true"] { background: var(--accent-quiet); border-color: var(--accent-border); color: var(--text-strong); }
    .live__barright { margin-left: auto; display: flex; align-items: center; gap: var(--space-5); }

    /* Body: timing | grid | insights */
    .live__body { flex: 1; display: grid; grid-template-columns: var(--timing-sidebar-w) 1fr; min-height: 0; }
    .live__timing { display: flex; flex-direction: column; background: var(--bg-base); border-right: 1px solid var(--border-subtle); min-height: 0; }
    .live__timinghd { display: flex; align-items: center; gap: var(--space-5); padding: var(--space-6) var(--space-7); border-bottom: 1px solid var(--border-subtle); }
    .live__timinghd h3 { font-size: var(--text-sm); font-weight: 600; text-transform: uppercase; letter-spacing: var(--tracking-caps); color: var(--text-tertiary); margin: 0; }
    .live__timingscroll { flex: 1; overflow-y: auto; min-height: 0; }
    .live__statusbar { display: flex; align-items: center; gap: var(--space-5); padding: var(--space-5) var(--space-7); border-bottom: 1px solid var(--border-subtle); flex-wrap: wrap; }
    .live__weather { display: flex; gap: var(--space-7); padding: var(--space-6) var(--space-7); border-top: 1px solid var(--border-subtle); }
    .live__wx { display: flex; align-items: center; gap: var(--space-4); font-size: var(--text-sm); color: var(--text-secondary); }
    .live__wx b { font-family: var(--font-mono); color: var(--text-primary); font-weight: 600; }

    /* Center column: grid + insights */
    .live__center { display: flex; flex-direction: column; min-width: 0; min-height: 0; }
    .live__grid { flex: 1; display: grid; gap: 6px; padding: 6px; min-height: 0; background: var(--bg-app); }
    .live__grid[data-layout="focus"] { grid-template-columns: 2fr 1fr; grid-template-rows: 1fr 1fr; }
    .live__grid[data-layout="focus"] .pane:first-child { grid-row: span 2; }
    .live__grid[data-layout="battle"] { grid-template-columns: 1fr 1fr; grid-template-rows: 1fr; }
    .live__grid[data-layout="quad"] { grid-template-columns: 1fr 1fr; grid-template-rows: 1fr 1fr; }
    .live__grid[data-layout="data"] { grid-template-columns: 1fr 1fr 1fr; grid-template-rows: 1fr 1fr; }

    .pane { position: relative; border-radius: var(--radius-md); overflow: hidden; background:
      linear-gradient(180deg, #10141b, #0a0d12); border: 1px solid var(--border-default); display: flex; flex-direction: column; min-height: 0; }
    .pane[data-focus="true"] { border-color: var(--accent-border); box-shadow: var(--glow-accent); }
    .pane__feed { position: absolute; inset: 0; background-image: var(--grad-carbon); opacity: 0.5; }
    .pane__scan { position: absolute; inset: 0; background: radial-gradient(120% 80% at 50% 0%, rgba(45,123,255,0.06), transparent 60%); }
    .pane__top { position: relative; display: flex; align-items: center; gap: var(--space-5); padding: var(--space-5) var(--space-6); z-index: 2; }
    .pane__tag { display: flex; align-items: center; gap: var(--space-4); background: var(--scrim); backdrop-filter: blur(6px); border: 1px solid var(--border-default); border-radius: var(--radius-pill); padding: 3px 10px 3px 4px; }
    .pane__feedlabel { font-size: var(--text-2xs); color: var(--text-tertiary); background: var(--scrim); padding: 2px 8px; border-radius: var(--radius-pill); margin-left: auto; backdrop-filter: blur(6px); }
    .pane__mid { flex: 1; display: grid; place-items: center; position: relative; z-index: 1; }
    .pane__car { font-family: var(--font-display); font-weight: 800; font-size: 62px; color: rgba(255,255,255,0.05); letter-spacing: -0.02em; }
    .pane__telemetry { position: relative; z-index: 2; display: flex; align-items: center; gap: var(--space-6); padding: var(--space-5) var(--space-6); background: linear-gradient(0deg, rgba(6,8,12,0.92), transparent); }
    .tele { display: flex; flex-direction: column; gap: 2px; }
    .tele__v { font-family: var(--font-mono); font-weight: 600; font-size: var(--text-md); color: var(--text-primary); font-variant-numeric: tabular-nums; }
    .tele__l { font-size: 9px; color: var(--text-tertiary); text-transform: uppercase; letter-spacing: 0.06em; }
    .tele__drs { color: var(--drs-open); }
    .pane__bars { position: relative; z-index: 2; display: flex; gap: 3px; padding: 0 var(--space-6) var(--space-5); }
    .pane__bar { height: 4px; flex: 1; border-radius: 2px; background: var(--ink-700); overflow: hidden; }
    .pane__bar i { display: block; height: 100%; border-radius: 2px; }
    .pane__controls { position: absolute; top: var(--space-5); right: var(--space-6); z-index: 3; display: flex; gap: 4px; opacity: 0; transition: opacity var(--dur-fast) var(--ease-standard); }
    .pane:hover .pane__controls { opacity: 1; }
    .pane__ctl { display: inline-grid; place-items: center; width: 26px; height: 26px; border-radius: var(--radius-xs); background: var(--scrim); backdrop-filter: blur(6px); color: var(--text-secondary); cursor: pointer; border: 1px solid var(--border-default); }
    .pane__ctl:hover { color: var(--text-primary); background: var(--surface-hover); }

    /* Broadcast / world feed pane */
    .pane--bc { background: linear-gradient(180deg, #0c1622, #070b12); border-color: var(--border-strong); }
    .pane--bc[data-focus="true"] { border-color: var(--accent-border); box-shadow: var(--glow-accent); }
    .pane__bcwash { position: absolute; inset: 0; background:
      radial-gradient(80% 60% at 50% 30%, rgba(45,123,255,0.10), transparent 70%),
      repeating-linear-gradient(0deg, rgba(255,255,255,0.015) 0 1px, transparent 1px 3px); }
    .pane__tag--bc { background: var(--live); border-color: transparent; padding: 4px 11px; color: #fff; }
    .pane__bclive { width: 7px; height: 7px; border-radius: 50%; background: #fff; animation: pw-pulse-live 1.4s var(--ease-in-out) infinite; }
    .pane__feedlabel--bc { display: inline-flex; align-items: center; gap: 5px; color: var(--text-secondary); }
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
    .live__insights { height: var(--insights-h); border-top: 1px solid var(--border-subtle); background: var(--bg-base); display: grid; grid-template-columns: 1.4fr 1fr; min-height: 0; flex: none; }
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
    .ins__compose { display: flex; align-items: center; gap: var(--space-5); padding: var(--space-6); border-top: 1px solid var(--border-subtle); }
    .ins__input { flex: 1; height: var(--size-control-sm); padding: 0 var(--space-7); background: var(--bg-sunken); border: 1px solid var(--border-default); border-radius: var(--radius-pill); color: var(--text-primary); font-family: var(--font-sans); font-size: var(--text-sm); outline: none; }
    .ins__input::placeholder { color: var(--text-disabled); }
    .ins__model { font-family: var(--font-mono); font-size: var(--text-2xs); color: var(--text-tertiary); display: flex; align-items: center; gap: 5px; }

    /* Battle toast */
    .toast { position: absolute; top: 64px; left: 50%; transform: translateX(-50%); z-index: 40; display: flex; align-items: center; gap: var(--space-6); padding: var(--space-6) var(--space-7); border-radius: var(--radius-md); background: var(--surface-overlay); border: 1px solid var(--accent-border); box-shadow: var(--shadow-lg), var(--glow-accent); backdrop-filter: blur(var(--blur-md, 14px)); animation: pw-toast-in var(--dur-base) var(--ease-out); }
    .toast__icon { display: inline-grid; place-items: center; width: 32px; height: 32px; border-radius: var(--radius-sm); background: var(--accent-quiet); color: var(--accent); flex: none; }
    .toast__t { font-size: var(--text-md); font-weight: 600; color: var(--text-strong); }
    .toast__s { font-size: var(--text-sm); color: var(--text-secondary); }
    @keyframes pw-toast-in { from { opacity: 0; transform: translate(-50%, -10px); } to { opacity: 1; transform: translate(-50%, 0); } }
    `;
  }
  const LAYOUTS = {
    "Driver Focus": "focus",
    "Pit Wall Classic": "quad",
    "Battle Mode": "battle",
    "Data Overload": "data",
    "Minimal Clean": "focus"
  };
  function bar(v, color) {
    return /*#__PURE__*/React.createElement("i", {
      style: {
        width: v + "%",
        background: color
      }
    });
  }
  function BroadcastPane({
    focus
  }) {
    const top = D.timing.slice(0, 5);
    return /*#__PURE__*/React.createElement("div", {
      className: "pane pane--bc",
      "data-focus": focus
    }, /*#__PURE__*/React.createElement("div", {
      className: "pane__feed"
    }), /*#__PURE__*/React.createElement("div", {
      className: "pane__bcwash"
    }), /*#__PURE__*/React.createElement("div", {
      className: "pane__controls"
    }, /*#__PURE__*/React.createElement("span", {
      className: "pane__ctl"
    }, /*#__PURE__*/React.createElement(Icon, {
      name: "volume",
      size: 14
    })), /*#__PURE__*/React.createElement("span", {
      className: "pane__ctl"
    }, /*#__PURE__*/React.createElement(Icon, {
      name: "maximize",
      size: 14
    }))), /*#__PURE__*/React.createElement("div", {
      className: "pane__top"
    }, /*#__PURE__*/React.createElement("span", {
      className: "pane__tag pane__tag--bc"
    }, /*#__PURE__*/React.createElement("span", {
      className: "pane__bclive"
    }), /*#__PURE__*/React.createElement("span", {
      style: {
        fontWeight: 700,
        fontSize: 12,
        fontFamily: "var(--font-display)",
        letterSpacing: "0.04em"
      }
    }, "WORLD FEED")), /*#__PURE__*/React.createElement("span", {
      className: "pane__bcbug"
    }, /*#__PURE__*/React.createElement("span", {
      className: "pane__bcbug-flag"
    }), /*#__PURE__*/React.createElement("span", {
      className: "pane__bcbug-lap"
    }, "LAP 41", /*#__PURE__*/React.createElement("i", null, "/57"))), /*#__PURE__*/React.createElement("span", {
      className: "pane__feedlabel pane__feedlabel--bc"
    }, /*#__PURE__*/React.createElement(Icon, {
      name: "radio",
      size: 12
    }), " F1 TV")), /*#__PURE__*/React.createElement("div", {
      className: "pane__mid"
    }, /*#__PURE__*/React.createElement("span", {
      className: "pane__bcwm"
    }, "LIVE")), /*#__PURE__*/React.createElement("div", {
      className: "pane__ticker"
    }, top.map(t => {
      const d = D.byCode[t.code];
      return /*#__PURE__*/React.createElement("span", {
        className: "tick",
        key: t.code
      }, /*#__PURE__*/React.createElement("span", {
        className: "tick__bar",
        style: {
          background: d.color
        }
      }), /*#__PURE__*/React.createElement("span", {
        className: "tick__main"
      }, /*#__PURE__*/React.createElement("span", {
        className: "tick__row"
      }, /*#__PURE__*/React.createElement("span", {
        className: "tick__pos"
      }, "P", t.pos), /*#__PURE__*/React.createElement("span", {
        className: "tick__code"
      }, t.code)), /*#__PURE__*/React.createElement("span", {
        className: "tick__gap"
      }, t.pos === 1 ? "LEADER" : t.interval)));
    })));
  }
  function Pane({
    feed,
    code,
    focus,
    telemetry,
    broadcast
  }) {
    if (broadcast) return /*#__PURE__*/React.createElement(BroadcastPane, {
      focus: focus
    });
    const d = D.byCode[code];
    return /*#__PURE__*/React.createElement("div", {
      className: "pane",
      "data-focus": focus
    }, /*#__PURE__*/React.createElement("div", {
      className: "pane__feed"
    }), /*#__PURE__*/React.createElement("div", {
      className: "pane__scan"
    }), /*#__PURE__*/React.createElement("div", {
      className: "pane__controls"
    }, /*#__PURE__*/React.createElement("span", {
      className: "pane__ctl"
    }, /*#__PURE__*/React.createElement(Icon, {
      name: "gauge",
      size: 14
    })), /*#__PURE__*/React.createElement("span", {
      className: "pane__ctl"
    }, /*#__PURE__*/React.createElement(Icon, {
      name: "volume",
      size: 14
    })), /*#__PURE__*/React.createElement("span", {
      className: "pane__ctl"
    }, /*#__PURE__*/React.createElement(Icon, {
      name: "maximize",
      size: 14
    }))), /*#__PURE__*/React.createElement("div", {
      className: "pane__top"
    }, /*#__PURE__*/React.createElement("span", {
      className: "pane__tag"
    }, /*#__PURE__*/React.createElement(Avatar, {
      initials: code,
      number: d.num,
      ring: d.color,
      size: "sm"
    }), /*#__PURE__*/React.createElement("span", {
      style: {
        fontWeight: 700,
        fontSize: 13,
        fontFamily: "var(--font-display)"
      }
    }, code)), /*#__PURE__*/React.createElement("span", {
      className: "pane__feedlabel"
    }, feed)), /*#__PURE__*/React.createElement("div", {
      className: "pane__mid"
    }, /*#__PURE__*/React.createElement("span", {
      className: "pane__car"
    }, code)), telemetry && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
      className: "pane__telemetry"
    }, /*#__PURE__*/React.createElement("span", {
      className: "tele"
    }, /*#__PURE__*/React.createElement("span", {
      className: "tele__v"
    }, "318"), /*#__PURE__*/React.createElement("span", {
      className: "tele__l"
    }, "km/h")), /*#__PURE__*/React.createElement("span", {
      className: "tele"
    }, /*#__PURE__*/React.createElement("span", {
      className: "tele__v"
    }, "7"), /*#__PURE__*/React.createElement("span", {
      className: "tele__l"
    }, "gear")), /*#__PURE__*/React.createElement("span", {
      className: "tele"
    }, /*#__PURE__*/React.createElement("span", {
      className: "tele__v tele__drs"
    }, "OPEN"), /*#__PURE__*/React.createElement("span", {
      className: "tele__l"
    }, "DRS")), /*#__PURE__*/React.createElement("span", {
      className: "tele"
    }, /*#__PURE__*/React.createElement("span", {
      className: "tele__v"
    }, "94%"), /*#__PURE__*/React.createElement("span", {
      className: "tele__l"
    }, "throttle")), /*#__PURE__*/React.createElement("span", {
      className: "tele",
      style: {
        marginLeft: "auto"
      }
    }, /*#__PURE__*/React.createElement("span", {
      className: "tele__v"
    }, "+0.8s"), /*#__PURE__*/React.createElement("span", {
      className: "tele__l"
    }, "gap"))), /*#__PURE__*/React.createElement("div", {
      className: "pane__bars"
    }, /*#__PURE__*/React.createElement("span", {
      className: "pane__bar"
    }, bar(94, "var(--throttle)")), /*#__PURE__*/React.createElement("span", {
      className: "pane__bar"
    }, bar(8, "var(--brake)")))));
  }
  function LiveRacing({
    onExit
  }) {
    const [preset, setPreset] = React.useState("Driver Focus");
    const [selected, setSelected] = React.useState("NOR");
    const [autopairs, setAutopairs] = React.useState(true);
    const [showToast, setShowToast] = React.useState(true);
    const layout = LAYOUTS[preset];
    React.useEffect(() => {
      const t = setTimeout(() => setShowToast(false), 6500);
      return () => clearTimeout(t);
    }, []);
    const panes = layout === "battle" ? [{
      feed: "Onboard",
      code: "VER",
      focus: false,
      telemetry: true
    }, {
      feed: "Onboard",
      code: "NOR",
      focus: true,
      telemetry: true
    }] : layout === "data" ? [{
      broadcast: true,
      focus: true
    }, {
      feed: "Onboard",
      code: "NOR",
      telemetry: true
    }, {
      feed: "Onboard",
      code: "LEC",
      telemetry: true
    }, {
      feed: "Onboard",
      code: "PIA"
    }, {
      feed: "Onboard",
      code: "RUS"
    }, {
      feed: "Pit lane",
      code: "HAM"
    }] : layout === "quad" ? [{
      broadcast: true,
      focus: true
    }, {
      feed: "Onboard",
      code: "NOR",
      telemetry: true
    }, {
      feed: "Onboard",
      code: "LEC"
    }, {
      feed: "Onboard",
      code: "PIA"
    }] : [{
      broadcast: true,
      focus: true
    }, {
      feed: "Onboard",
      code: "NOR"
    }, {
      feed: "Onboard",
      code: "LEC"
    }];
    return /*#__PURE__*/React.createElement("div", {
      className: "live"
    }, /*#__PURE__*/React.createElement("div", {
      className: "live__bar"
    }, /*#__PURE__*/React.createElement("div", {
      className: "live__traffic"
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        background: "#ff5f57"
      },
      onClick: onExit
    }), /*#__PURE__*/React.createElement("span", {
      style: {
        background: "#febc2e"
      }
    }), /*#__PURE__*/React.createElement("span", {
      style: {
        background: "#28c840"
      }
    })), /*#__PURE__*/React.createElement("span", {
      className: "live__brand"
    }, "PIT", /*#__PURE__*/React.createElement("i", null, "WALL")), /*#__PURE__*/React.createElement("div", {
      className: "live__race"
    }, /*#__PURE__*/React.createElement(Badge, {
      tone: "live"
    }, "LIVE"), /*#__PURE__*/React.createElement("span", null, "Canadian GP"), /*#__PURE__*/React.createElement("span", {
      className: "live__lap"
    }, "LAP 41 / 57"), /*#__PURE__*/React.createElement(FlagStatus, {
      status: "green",
      label: "Track Clear"
    })), /*#__PURE__*/React.createElement("div", {
      className: "live__presets"
    }, D.presets.map(p => /*#__PURE__*/React.createElement("button", {
      key: p,
      className: "preset",
      "data-active": preset === p,
      onClick: () => setPreset(p)
    }, p)), /*#__PURE__*/React.createElement(IconButton, {
      variant: "ghost",
      size: "sm",
      label: "Save layout"
    }, /*#__PURE__*/React.createElement(Icon, {
      name: "plus",
      size: 15
    }))), /*#__PURE__*/React.createElement("div", {
      className: "live__barright"
    }, /*#__PURE__*/React.createElement(Button, {
      variant: "secondary",
      size: "sm",
      iconLeft: /*#__PURE__*/React.createElement(Icon, {
        name: "grid",
        size: 14
      })
    }, "Layout"), /*#__PURE__*/React.createElement(Button, {
      variant: "ghost",
      size: "sm",
      onClick: onExit,
      iconLeft: /*#__PURE__*/React.createElement(Icon, {
        name: "close",
        size: 14
      })
    }, "Exit live"))), /*#__PURE__*/React.createElement("div", {
      className: "live__body"
    }, /*#__PURE__*/React.createElement("aside", {
      className: "live__timing"
    }, /*#__PURE__*/React.createElement("div", {
      className: "live__timinghd"
    }, /*#__PURE__*/React.createElement(Icon, {
      name: "timer",
      size: 15
    }), /*#__PURE__*/React.createElement("h3", null, "Live Timing"), /*#__PURE__*/React.createElement("span", {
      style: {
        marginLeft: "auto"
      }
    }, /*#__PURE__*/React.createElement(Badge, {
      tone: "outline"
    }, "P1\u201312"))), /*#__PURE__*/React.createElement("div", {
      className: "live__statusbar"
    }, /*#__PURE__*/React.createElement(FlagStatus, {
      status: "green",
      label: "Clear"
    }), /*#__PURE__*/React.createElement(Badge, {
      tone: "neutral"
    }, "Lap 41/57"), /*#__PURE__*/React.createElement("span", {
      style: {
        marginLeft: "auto",
        fontFamily: "var(--font-mono)",
        fontSize: 12,
        color: "var(--text-tertiary)"
      }
    }, "16 laps to go")), /*#__PURE__*/React.createElement("div", {
      className: "live__timingscroll"
    }, /*#__PURE__*/React.createElement(TimingRowHeader, null), D.timing.map(t => {
      const d = D.byCode[t.code];
      return /*#__PURE__*/React.createElement(TimingRow, {
        key: t.code,
        position: t.pos,
        code: t.code,
        name: d.name,
        team: d.color,
        lastLap: t.last,
        lapState: t.state,
        gap: t.gap,
        gapTrend: t.trend,
        compound: t.comp,
        tyreAge: t.age,
        pits: t.pits,
        selected: selected === t.code,
        onClick: () => setSelected(t.code)
      });
    })), /*#__PURE__*/React.createElement("div", {
      className: "live__weather"
    }, /*#__PURE__*/React.createElement("span", {
      className: "live__wx"
    }, /*#__PURE__*/React.createElement(Icon, {
      name: "thermometer",
      size: 14
    }), " Air ", /*#__PURE__*/React.createElement("b", null, "24\xB0")), /*#__PURE__*/React.createElement("span", {
      className: "live__wx"
    }, /*#__PURE__*/React.createElement(Icon, {
      name: "gauge",
      size: 14
    }), " Track ", /*#__PURE__*/React.createElement("b", null, "38\xB0")), /*#__PURE__*/React.createElement("span", {
      className: "live__wx"
    }, /*#__PURE__*/React.createElement(Icon, {
      name: "droplet",
      size: 14
    }), " ", /*#__PURE__*/React.createElement("b", null, "0%")))), /*#__PURE__*/React.createElement("div", {
      className: "live__center"
    }, /*#__PURE__*/React.createElement("div", {
      className: "live__grid",
      "data-layout": layout,
      style: {
        position: "relative"
      }
    }, showToast && /*#__PURE__*/React.createElement("div", {
      className: "toast"
    }, /*#__PURE__*/React.createElement("span", {
      className: "toast__icon"
    }, /*#__PURE__*/React.createElement(Icon, {
      name: "zap",
      size: 18
    })), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
      className: "toast__t"
    }, "Battle detected \u2014 Verstappen vs Norris"), /*#__PURE__*/React.createElement("div", {
      className: "toast__s"
    }, "0.8s gap \xB7 DRS window opening next lap")), /*#__PURE__*/React.createElement(Button, {
      size: "sm",
      variant: "primary",
      onClick: () => {
        setPreset("Battle Mode");
        setShowToast(false);
      }
    }, "Load pair"), /*#__PURE__*/React.createElement(IconButton, {
      variant: "ghost",
      size: "sm",
      label: "Dismiss",
      onClick: () => setShowToast(false)
    }, /*#__PURE__*/React.createElement(Icon, {
      name: "close",
      size: 14
    }))), panes.map((p, i) => /*#__PURE__*/React.createElement(Pane, _extends({
      key: i
    }, p)))), /*#__PURE__*/React.createElement("div", {
      className: "live__insights"
    }, /*#__PURE__*/React.createElement("div", {
      className: "ins__feed"
    }, /*#__PURE__*/React.createElement("div", {
      className: "ins__hd"
    }, /*#__PURE__*/React.createElement("h3", null, /*#__PURE__*/React.createElement(Icon, {
      name: "sparkles",
      size: 15
    }), " AI Insights"), /*#__PURE__*/React.createElement("span", {
      style: {
        marginLeft: "auto",
        display: "flex",
        alignItems: "center",
        gap: 8
      }
    }, /*#__PURE__*/React.createElement("span", {
      className: "ins__model"
    }, /*#__PURE__*/React.createElement(Icon, {
      name: "key",
      size: 12
    }), " Claude 4"), /*#__PURE__*/React.createElement("span", {
      style: {
        display: "flex",
        alignItems: "center",
        gap: 6,
        fontSize: 12,
        color: "var(--text-tertiary)"
      }
    }, "Auto-pair ", /*#__PURE__*/React.createElement(Switch, {
      defaultChecked: autopairs,
      onChange: setAutopairs
    })))), /*#__PURE__*/React.createElement("div", {
      className: "ins__list"
    }, D.insights.map((ins, i) => /*#__PURE__*/React.createElement("div", {
      className: "insight",
      key: i,
      "data-kind": ins.kind
    }, /*#__PURE__*/React.createElement("span", {
      className: "insight__icon"
    }, /*#__PURE__*/React.createElement(Icon, {
      name: ins.kind === "battle" ? "zap" : ins.kind === "strategy" ? "flag" : "chart",
      size: 16
    })), /*#__PURE__*/React.createElement("div", {
      style: {
        minWidth: 0
      }
    }, /*#__PURE__*/React.createElement("div", {
      className: "insight__t"
    }, ins.title, /*#__PURE__*/React.createElement("span", {
      className: "insight__conf"
    }, "\xB7 ", Math.round(ins.conf * 100), "%")), /*#__PURE__*/React.createElement("div", {
      className: "insight__b"
    }, ins.body), ins.kind === "battle" && /*#__PURE__*/React.createElement("div", {
      className: "insight__actions"
    }, /*#__PURE__*/React.createElement(Button, {
      size: "sm",
      variant: "primary",
      onClick: () => setPreset("Battle Mode")
    }, "Load pair"), /*#__PURE__*/React.createElement(Button, {
      size: "sm",
      variant: "ghost"
    }, "Dismiss"))))))), /*#__PURE__*/React.createElement("div", {
      className: "ins__chat"
    }, /*#__PURE__*/React.createElement("div", {
      className: "ins__hd"
    }, /*#__PURE__*/React.createElement("h3", null, /*#__PURE__*/React.createElement(Icon, {
      name: "radio",
      size: 14
    }), " Ask the engineer"), /*#__PURE__*/React.createElement("span", {
      className: "ins__model",
      style: {
        marginLeft: "auto"
      }
    }, "What-if \u2325W")), /*#__PURE__*/React.createElement("div", {
      className: "ins__msgs"
    }, /*#__PURE__*/React.createElement("div", {
      className: "msg msg--ai"
    }, "Norris is 0.8s back with fresher mediums. On current deltas he needs ~4 laps to be in striking range, but VER's soft is past its peak."), /*#__PURE__*/React.createElement("div", {
      className: "msg msg--me"
    }, "What if Norris pits now for softs?"), /*#__PURE__*/React.createElement("div", {
      className: "msg msg--ai"
    }, "Undercut nets ~2.1s but he'd lose track position to Leclerc and rejoin in traffic. Net projection: stays P2, closes to +0.3s by lap 52. Higher variance.")), /*#__PURE__*/React.createElement("div", {
      className: "ins__compose"
    }, /*#__PURE__*/React.createElement("input", {
      className: "ins__input",
      placeholder: "Ask about strategy, gaps, projections\u2026"
    }), /*#__PURE__*/React.createElement(IconButton, {
      variant: "accent",
      label: "Send"
    }, /*#__PURE__*/React.createElement(Icon, {
      name: "chevronRight",
      size: 16
    }))))))));
  }
  window.PW = window.PW || {};
  window.PW.LiveRacing = LiveRacing;
})();
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/pitwall/LiveRacing.jsx", error: String((e && e.message) || e) }); }

// ui_kits/pitwall/News.jsx
try { (() => {
/* Apexline News feed. window.PW.News */
(function () {
  const NS = window.PitWallDesignSystem_698fe6;
  const {
    Card,
    Badge,
    Icon,
    Tag,
    Button,
    IconButton
  } = NS;
  const D = window.PW_DATA;
  const STYLE_ID = "pw-news-styles";
  if (!document.getElementById(STYLE_ID)) {
    const el = document.createElement("style");
    el.id = STYLE_ID;
    el.textContent = `
    .news2 { display: grid; grid-template-columns: 1fr 300px; gap: var(--space-9); align-items: start; }
    .news2__filters { display: flex; align-items: center; gap: var(--space-4); flex-wrap: wrap; margin-bottom: var(--space-8); }
    .feed { display: flex; flex-direction: column; gap: var(--space-7); }
    .lead { position: relative; overflow: hidden; border-radius: var(--radius-lg); border: 1px solid var(--border-default); background: var(--surface-card); }
    .lead__img { height: 200px; background:
      linear-gradient(180deg, transparent 30%, rgba(7,9,13,0.92)),
      radial-gradient(120% 120% at 80% 0%, color-mix(in srgb, var(--_c) 55%, transparent), transparent 60%),
      var(--grad-carbon), var(--bg-sunken); position: relative; }
    .lead__spine { position: absolute; left: 0; top: 0; bottom: 0; width: 4px; background: var(--_c); }
    .lead__body { padding: var(--space-8); margin-top: -54px; position: relative; }
    .lead__meta { display: flex; align-items: center; gap: var(--space-5); margin-bottom: var(--space-6); }
    .lead__src { font-size: var(--text-xs); color: var(--text-tertiary); }
    .lead__title { font-family: var(--font-display); font-weight: 700; font-size: var(--text-3xl); line-height: 1.08; letter-spacing: -0.01em; color: var(--text-strong); text-wrap: pretty; }
    .lead__lead { margin-top: var(--space-6); color: var(--text-secondary); font-size: var(--text-md); line-height: 1.5; max-width: 60ch; }
    .lead__foot { display: flex; align-items: center; gap: var(--space-5); margin-top: var(--space-8); }

    .item { display: grid; grid-template-columns: 110px 1fr auto; gap: var(--space-8); padding: var(--space-7); border-radius: var(--radius-md); background: var(--surface-card); border: 1px solid var(--border-subtle); cursor: pointer; transition: var(--tr-surface); }
    .item:hover { background: var(--surface-hover); border-color: var(--border-default); }
    .item__thumb { width: 110px; height: 74px; border-radius: var(--radius-sm); background:
      radial-gradient(120% 120% at 70% 10%, color-mix(in srgb, var(--_c) 50%, transparent), transparent 60%), var(--grad-carbon), var(--bg-sunken);
      border: 1px solid var(--border-subtle); position: relative; overflow: hidden; }
    .item__thumb::before { content: ""; position: absolute; left: 0; top: 0; bottom: 0; width: 3px; background: var(--_c); }
    .item__meta { display: flex; align-items: center; gap: var(--space-5); margin-bottom: 5px; }
    .item__src { font-size: var(--text-2xs); color: var(--text-tertiary); }
    .item__title { font-size: var(--text-lg); font-weight: 600; color: var(--text-primary); line-height: 1.3; text-wrap: pretty; }
    .item__lead { font-size: var(--text-sm); color: var(--text-tertiary); margin-top: 4px; }
    .item__actions { display: flex; align-items: flex-start; }
    .trend { display: flex; align-items: center; gap: var(--space-6); padding: var(--space-5) 0; border-bottom: 1px solid var(--border-subtle); }
    .trend:last-child { border-bottom: 0; }
    .trend__rank { font-family: var(--font-mono); font-weight: 700; color: var(--text-tertiary); width: 18px; }
    .trend__txt { font-size: var(--text-sm); color: var(--text-secondary); line-height: 1.35; }
    `;
    document.head.appendChild(el);
  }
  function News() {
    const [lead, ...rest] = D.news;
    return /*#__PURE__*/React.createElement("div", {
      className: "news2"
    }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
      className: "news2__filters"
    }, /*#__PURE__*/React.createElement(Tag, {
      selected: true
    }, "All"), /*#__PURE__*/React.createElement(Tag, null, "Breaking"), /*#__PURE__*/React.createElement(Tag, null, "Strategy"), /*#__PURE__*/React.createElement(Tag, null, "Tech"), /*#__PURE__*/React.createElement(Tag, null, "Paddock"), /*#__PURE__*/React.createElement(Tag, {
      swatch: "var(--team-mclaren)"
    }, "McLaren"), /*#__PURE__*/React.createElement(Tag, {
      swatch: "var(--team-ferrari)"
    }, "Ferrari"), /*#__PURE__*/React.createElement("div", {
      style: {
        marginLeft: "auto"
      }
    }, /*#__PURE__*/React.createElement(Button, {
      variant: "ghost",
      size: "sm",
      iconLeft: /*#__PURE__*/React.createElement(Icon, {
        name: "filter",
        size: 14
      })
    }, "Sources"))), /*#__PURE__*/React.createElement("div", {
      className: "feed"
    }, /*#__PURE__*/React.createElement("article", {
      className: "lead"
    }, /*#__PURE__*/React.createElement("div", {
      className: "lead__img",
      style: {
        "--_c": lead.color
      }
    }, /*#__PURE__*/React.createElement("span", {
      className: "lead__spine",
      style: {
        background: lead.color
      }
    })), /*#__PURE__*/React.createElement("div", {
      className: "lead__body"
    }, /*#__PURE__*/React.createElement("div", {
      className: "lead__meta"
    }, /*#__PURE__*/React.createElement(Badge, {
      tone: "danger"
    }, lead.tag), /*#__PURE__*/React.createElement("span", {
      className: "lead__src"
    }, lead.source, " \xB7 ", lead.time, " ago")), /*#__PURE__*/React.createElement("h2", {
      className: "lead__title"
    }, lead.title), /*#__PURE__*/React.createElement("p", {
      className: "lead__lead"
    }, lead.lead), /*#__PURE__*/React.createElement("div", {
      className: "lead__foot"
    }, /*#__PURE__*/React.createElement(Button, {
      variant: "secondary",
      size: "sm",
      iconRight: /*#__PURE__*/React.createElement(Icon, {
        name: "chevronRight",
        size: 14
      })
    }, "Read story"), /*#__PURE__*/React.createElement(IconButton, {
      variant: "ghost",
      size: "sm",
      label: "Bookmark"
    }, /*#__PURE__*/React.createElement(Icon, {
      name: "bookmark",
      size: 16
    }))))), rest.map((n, i) => /*#__PURE__*/React.createElement("article", {
      className: "item",
      key: i
    }, /*#__PURE__*/React.createElement("div", {
      className: "item__thumb",
      style: {
        "--_c": n.color
      }
    }), /*#__PURE__*/React.createElement("div", {
      style: {
        minWidth: 0
      }
    }, /*#__PURE__*/React.createElement("div", {
      className: "item__meta"
    }, /*#__PURE__*/React.createElement(Badge, {
      tone: "outline"
    }, n.tag), /*#__PURE__*/React.createElement("span", {
      className: "item__src"
    }, n.source, " \xB7 ", n.time, " ago")), /*#__PURE__*/React.createElement("div", {
      className: "item__title"
    }, n.title), /*#__PURE__*/React.createElement("div", {
      className: "item__lead"
    }, n.lead)), /*#__PURE__*/React.createElement("div", {
      className: "item__actions"
    }, /*#__PURE__*/React.createElement(IconButton, {
      variant: "ghost",
      size: "sm",
      label: "Bookmark"
    }, /*#__PURE__*/React.createElement(Icon, {
      name: "bookmark",
      size: 16
    }))))))), /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-9)"
      }
    }, /*#__PURE__*/React.createElement(Card, {
      title: "Trending",
      subtitle: "Across your sources",
      padding: "tight"
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        padding: "0 6px"
      }
    }, ["Leclerc's undercut masterclass in Montréal", "Mercedes Barcelona floor — what changed", "Why Williams is suddenly a points threat", "Verstappen's one-stop gamble explained"].map((t, i) => /*#__PURE__*/React.createElement("div", {
      className: "trend",
      key: i
    }, /*#__PURE__*/React.createElement("span", {
      className: "trend__rank"
    }, i + 1), /*#__PURE__*/React.createElement("span", {
      className: "trend__txt"
    }, t))))), /*#__PURE__*/React.createElement(Card, {
      title: "Bookmarks",
      aside: /*#__PURE__*/React.createElement(Icon, {
        name: "bookmark",
        size: 15
      }),
      padding: "default"
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        color: "var(--text-tertiary)",
        fontSize: 13,
        lineHeight: 1.5
      }
    }, "3 saved articles. Tap the bookmark on any story to read it later, offline."))));
  }
  window.PW = window.PW || {};
  window.PW.News = News;
})();
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/pitwall/News.jsx", error: String((e && e.message) || e) }); }

// ui_kits/pitwall/Schedule.jsx
try { (() => {
/* Apexline Schedule & Calendar. window.PW.Schedule */
(function () {
  const NS = window.PitWallDesignSystem_698fe6;
  const {
    Card,
    Badge,
    Icon,
    Countdown,
    Button,
    DriverTag,
    FlagStatus
  } = NS;
  const D = window.PW_DATA;
  const STYLE_ID = "pw-sched-styles";
  if (!document.getElementById(STYLE_ID)) {
    const el = document.createElement("style");
    el.id = STYLE_ID;
    el.textContent = `
    .sched { display: grid; grid-template-columns: 1fr 340px; gap: var(--space-9); align-items: start; }
    .sched__list { display: flex; flex-direction: column; gap: var(--space-6); }
    .race { display: grid; grid-template-columns: 64px 1fr auto; gap: var(--space-8); align-items: center; padding: var(--space-8); border-radius: var(--radius-md); background: var(--surface-card); border: 1px solid var(--border-subtle); transition: var(--tr-surface); cursor: pointer; }
    .race:hover { background: var(--surface-hover); border-color: var(--border-default); }
    .race[data-live="true"] { border-color: var(--accent-border); background: linear-gradient(100% 100% at 0 0, var(--accent-soft), var(--surface-card) 50%); }
    .race[data-done="true"] { opacity: 0.66; }
    .race__rnd { display: flex; flex-direction: column; align-items: center; justify-content: center; width: 64px; height: 64px; border-radius: var(--radius-sm); background: var(--bg-sunken); border: 1px solid var(--border-subtle); }
    .race__rndn { font-family: var(--font-display); font-weight: 800; font-size: var(--text-2xl); color: var(--text-strong); line-height: 1; }
    .race__rndl { font-size: 9px; color: var(--text-tertiary); text-transform: uppercase; letter-spacing: 0.08em; }
    .race__name { font-family: var(--font-display); font-weight: 700; font-size: var(--text-xl); color: var(--text-primary); letter-spacing: -0.01em; }
    .race__meta { display: flex; align-items: center; gap: var(--space-5); margin-top: 3px; color: var(--text-tertiary); font-size: var(--text-sm); }
    .race__right { display: flex; flex-direction: column; align-items: flex-end; gap: 6px; }
    .race__date { font-family: var(--font-mono); font-weight: 600; font-size: var(--text-lg); color: var(--text-primary); }
    .sessrow { display: flex; align-items: center; justify-content: space-between; padding: var(--space-6) var(--space-7); border-radius: var(--radius-sm); }
    .sessrow:hover { background: var(--surface-hover); }
    .sessrow[data-live="true"] { background: var(--accent-quiet); }
    .sessrow__k { display: flex; align-items: center; gap: var(--space-6); }
    .sessrow__day { font-family: var(--font-mono); font-size: var(--text-xs); color: var(--text-tertiary); width: 28px; }
    .sessrow__name { font-weight: 500; color: var(--text-primary); font-size: var(--text-md); }
    .sessrow__t { font-family: var(--font-mono); font-weight: 600; color: var(--text-primary); font-variant-numeric: tabular-nums; }
    .tz { display: flex; align-items: center; gap: var(--space-5); font-size: var(--text-xs); color: var(--text-tertiary); }
    `;
    document.head.appendChild(el);
  }
  const soon = new Date(Date.now() + 1000 * 60 * 60 * 27 + 1000 * 60 * 14).toISOString();
  function Schedule() {
    return /*#__PURE__*/React.createElement("div", {
      className: "sched"
    }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        alignItems: "center",
        gap: 12,
        marginBottom: 16
      }
    }, /*#__PURE__*/React.createElement("h2", {
      style: {
        fontFamily: "var(--font-display)",
        fontWeight: 700,
        fontSize: 22,
        margin: 0,
        color: "var(--text-strong)"
      }
    }, "2026 Calendar"), /*#__PURE__*/React.createElement(Badge, {
      tone: "accent"
    }, "9 / 24 rounds"), /*#__PURE__*/React.createElement("div", {
      style: {
        marginLeft: "auto"
      }
    }, /*#__PURE__*/React.createElement(Button, {
      variant: "secondary",
      size: "sm",
      iconLeft: /*#__PURE__*/React.createElement(Icon, {
        name: "bell",
        size: 14
      })
    }, "Reminders"))), /*#__PURE__*/React.createElement("div", {
      className: "sched__list"
    }, D.schedule.map(r => /*#__PURE__*/React.createElement("div", {
      className: "race",
      key: r.rnd,
      "data-live": r.status === "live",
      "data-done": r.status === "done"
    }, /*#__PURE__*/React.createElement("div", {
      className: "race__rnd"
    }, /*#__PURE__*/React.createElement("span", {
      className: "race__rndn"
    }, r.rnd), /*#__PURE__*/React.createElement("span", {
      className: "race__rndl"
    }, "Round")), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
      className: "race__name"
    }, r.name), /*#__PURE__*/React.createElement("div", {
      className: "race__meta"
    }, /*#__PURE__*/React.createElement(Icon, {
      name: "pin",
      size: 13
    }), " ", r.circuit, " \xB7 ", r.loc)), /*#__PURE__*/React.createElement("div", {
      className: "race__right"
    }, r.status === "live" ? /*#__PURE__*/React.createElement(Badge, {
      tone: "live"
    }, "RACE LIVE") : r.status === "done" ? /*#__PURE__*/React.createElement(Badge, {
      tone: "neutral"
    }, "Won \xB7 ", r.winner) : /*#__PURE__*/React.createElement("span", {
      className: "race__date"
    }, r.date), r.status !== "done" && /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 11,
        color: "var(--text-tertiary)",
        fontFamily: "var(--font-mono)"
      }
    }, r.date, " \xB7 14:00 local")))))), /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-9)"
      }
    }, /*#__PURE__*/React.createElement(Card, {
      title: "Next session",
      subtitle: "Canadian GP \xB7 Race",
      aside: /*#__PURE__*/React.createElement(FlagStatus, {
        status: "green",
        label: "Live"
      })
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        flexDirection: "column",
        gap: 14,
        alignItems: "flex-start"
      }
    }, /*#__PURE__*/React.createElement(Countdown, {
      to: soon,
      size: "sm"
    }), /*#__PURE__*/React.createElement("div", {
      className: "tz"
    }, /*#__PURE__*/React.createElement(Icon, {
      name: "timer",
      size: 13
    }), " Sun 14:00 EDT \xB7 20:00 CET \xB7 19:00 BST"))), /*#__PURE__*/React.createElement(Card, {
      title: "Race weekend",
      subtitle: "All sessions \xB7 your timezone",
      padding: "tight"
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        flexDirection: "column"
      }
    }, D.sessions.map(s => /*#__PURE__*/React.createElement("div", {
      className: "sessrow",
      key: s.kind,
      "data-live": s.status === "live"
    }, /*#__PURE__*/React.createElement("div", {
      className: "sessrow__k"
    }, /*#__PURE__*/React.createElement("span", {
      className: "sessrow__day"
    }, s.day), /*#__PURE__*/React.createElement("span", {
      className: "sessrow__name"
    }, s.kind), s.status === "live" && /*#__PURE__*/React.createElement(Badge, {
      tone: "live"
    }, "LIVE"), s.status === "done" && /*#__PURE__*/React.createElement(Icon, {
      name: "check",
      size: 14
    })), /*#__PURE__*/React.createElement("span", {
      className: "sessrow__t"
    }, s.time)))))));
  }
  window.PW = window.PW || {};
  window.PW.Schedule = Schedule;
})();
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/pitwall/Schedule.jsx", error: String((e && e.message) || e) }); }

// ui_kits/pitwall/Settings.jsx
try { (() => {
/* Apexline Settings. window.PW.Settings */
(function () {
  const NS = window.PitWallDesignSystem_698fe6;
  const {
    Card,
    Badge,
    Icon,
    Switch,
    Input,
    Button,
    SegmentedControl,
    Avatar,
    Tabs
  } = NS;
  const D = window.PW_DATA;
  const STYLE_ID = "pw-set-styles";
  {
    let el = document.getElementById(STYLE_ID);
    if (!el) {
      el = document.createElement("style");
      el.id = STYLE_ID;
      document.head.appendChild(el);
    }
    el.textContent = `
    .set { display: grid; grid-template-columns: 200px 1fr; gap: var(--space-10); align-items: start; }
    .set__nav { display: flex; flex-direction: column; gap: 2px; position: sticky; top: 0; }
    .set__navitem { display: flex; align-items: center; gap: var(--space-6); padding: var(--space-6) var(--space-7); border-radius: var(--radius-sm); color: var(--text-secondary); font-size: var(--text-md); font-weight: 500; cursor: pointer; }
    .set__navitem:hover { background: var(--surface-hover); color: var(--text-primary); }
    .set__navitem[data-active="true"] { background: var(--accent-quiet); color: var(--text-strong); }
    .set__col { display: flex; flex-direction: column; gap: var(--space-9); max-width: 720px; }
    .row { display: flex; align-items: center; gap: var(--space-7); padding: var(--space-7) 0; border-bottom: 1px solid var(--border-subtle); }
    .row:last-child { border-bottom: 0; }
    .row__txt { flex: 1; min-width: 0; }
    .row__t { font-size: var(--text-md); font-weight: 500; color: var(--text-primary); }
    .row__s { font-size: var(--text-sm); color: var(--text-tertiary); margin-top: 2px; line-height: 1.4; }
    .provider { display: flex; align-items: center; gap: var(--space-6); padding: var(--space-7); border-radius: var(--radius-md); border: 1px solid var(--border-subtle); background: var(--surface-raised); }
    .provider__logo { width: 38px; height: 38px; border-radius: var(--radius-sm); display: grid; place-items: center; flex: none; font-family: var(--font-display); font-weight: 800; color: #fff; }
    .ai-flow { display: grid; grid-template-columns: repeat(4, 1fr); gap: var(--space-5); }
    .ai-step { padding: var(--space-7); border-radius: var(--radius-md); background: var(--surface-raised); border: 1px solid var(--border-subtle); position: relative; }
    .ai-step__n { font-family: var(--font-mono); font-size: var(--text-2xs); color: var(--accent); font-weight: 700; }
    .ai-step__t { font-size: var(--text-md); font-weight: 600; color: var(--text-primary); margin: 6px 0 4px; }
    .ai-step__d { font-size: var(--text-sm); color: var(--text-tertiary); line-height: 1.4; }
    .ai-step__arrow { position: absolute; right: -13px; top: 50%; transform: translateY(-50%); color: var(--border-strong); z-index: 2; }

    /* Favorites */
    .fav-grid { display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-9); align-items: start; }
    .fav-col__hd { display: flex; align-items: center; gap: var(--space-5); margin-bottom: var(--space-6); }
    .fav-col__hd h4 { font-size: var(--text-md); font-weight: 600; color: var(--text-primary); margin: 0; }
    .fav-col__count { margin-left: auto; font-family: var(--font-mono); font-size: var(--text-2xs); color: var(--text-tertiary); }
    .fav-ranked { display: flex; flex-direction: column; gap: var(--space-4); margin-bottom: var(--space-8); }
    .fav-rank { display: flex; align-items: center; gap: var(--space-6); padding: var(--space-5) var(--space-6); border-radius: var(--radius-md); background: var(--surface-raised); border: 1px solid var(--border-subtle); }
    .fav-rank[data-drag="true"] { cursor: grab; }
    .fav-rank__num { display: grid; place-items: center; width: 24px; height: 24px; flex: none; border-radius: var(--radius-sm); background: var(--accent-quiet); color: var(--text-accent); font-family: var(--font-display); font-weight: 800; font-size: var(--text-sm); }
    .fav-rank__num[data-gold="true"] { background: linear-gradient(135deg, #ffd84d, #e0a92e); color: #3a2a05; }
    .fav-rank__id { display: flex; flex-direction: column; min-width: 0; flex: 1; }
    .fav-rank__name { font-size: var(--text-md); font-weight: 600; color: var(--text-primary); line-height: 1.2; }
    .fav-rank__sub { font-size: var(--text-2xs); color: var(--text-tertiary); }
    .fav-rank__ctrls { display: flex; align-items: center; gap: 2px; }
    .fav-rank__btn { display: inline-grid; place-items: center; width: 26px; height: 26px; border-radius: var(--radius-xs); color: var(--text-tertiary); cursor: pointer; border: 0; background: transparent; transition: var(--tr-control); }
    .fav-rank__btn:hover { background: var(--surface-hover); color: var(--text-primary); }
    .fav-rank__btn[disabled] { opacity: 0.25; pointer-events: none; }
    .fav-rank__btn--remove:hover { background: var(--danger-quiet); color: var(--danger); }
    .fav-empty { padding: var(--space-9); border-radius: var(--radius-md); border: 1px dashed var(--border-default); text-align: center; color: var(--text-tertiary); font-size: var(--text-sm); }
    .fav-pool__label { font-size: var(--text-2xs); font-weight: 600; text-transform: uppercase; letter-spacing: var(--tracking-caps); color: var(--text-tertiary); margin-bottom: var(--space-5); }
    .fav-pool { display: flex; flex-wrap: wrap; gap: var(--space-4); }
    .fav-chip { display: inline-flex; align-items: center; gap: var(--space-4); height: 30px; padding: 0 var(--space-5) 0 var(--space-4); border-radius: var(--radius-pill); background: var(--surface-card); border: 1px solid var(--border-default); color: var(--text-secondary); font-family: var(--font-sans); font-size: var(--text-sm); font-weight: 500; cursor: pointer; transition: var(--tr-control); }
    .fav-chip:hover { background: var(--surface-hover); border-color: var(--accent-border); color: var(--text-primary); }
    .fav-chip__swatch { width: 9px; height: 9px; border-radius: 3px; flex: none; }
    .fav-chip__add { color: var(--text-tertiary); display: inline-flex; }
    `;
  }
  const SECTIONS = [{
    id: "ai",
    label: "AI providers",
    icon: "sparkles"
  }, {
    id: "favorites",
    label: "Favorites",
    icon: "star"
  }, {
    id: "account",
    label: "F1 TV account",
    icon: "user"
  }, {
    id: "appearance",
    label: "Appearance",
    icon: "layers"
  }, {
    id: "notifications",
    label: "Notifications",
    icon: "bell"
  }, {
    id: "layouts",
    label: "Layout defaults",
    icon: "grid"
  }];
  function RankList({
    items,
    onMove,
    onRemove,
    kind
  }) {
    if (items.length === 0) {
      return /*#__PURE__*/React.createElement("div", {
        className: "fav-empty"
      }, "No ", kind, " picked yet \u2014 add some below.");
    }
    return /*#__PURE__*/React.createElement("div", {
      className: "fav-ranked"
    }, items.map((it, i) => /*#__PURE__*/React.createElement("div", {
      className: "fav-rank",
      key: it.key
    }, /*#__PURE__*/React.createElement("span", {
      className: "fav-rank__num",
      "data-gold": i === 0
    }, i + 1), it.avatar, /*#__PURE__*/React.createElement("span", {
      className: "fav-rank__id"
    }, /*#__PURE__*/React.createElement("span", {
      className: "fav-rank__name"
    }, it.name), /*#__PURE__*/React.createElement("span", {
      className: "fav-rank__sub"
    }, it.sub)), /*#__PURE__*/React.createElement("span", {
      className: "fav-rank__ctrls"
    }, /*#__PURE__*/React.createElement("button", {
      className: "fav-rank__btn",
      disabled: i === 0,
      "aria-label": "Move up",
      onClick: () => onMove(i, -1)
    }, /*#__PURE__*/React.createElement(Icon, {
      name: "arrowUp",
      size: 15
    })), /*#__PURE__*/React.createElement("button", {
      className: "fav-rank__btn",
      disabled: i === items.length - 1,
      "aria-label": "Move down",
      onClick: () => onMove(i, 1)
    }, /*#__PURE__*/React.createElement(Icon, {
      name: "arrowDown",
      size: 15
    })), /*#__PURE__*/React.createElement("button", {
      className: "fav-rank__btn fav-rank__btn--remove",
      "aria-label": "Remove",
      onClick: () => onRemove(it.key)
    }, /*#__PURE__*/React.createElement(Icon, {
      name: "close",
      size: 15
    }))))));
  }
  function Settings() {
    const [sec, setSec] = React.useState("ai");
    const [model, setModel] = React.useState("codex");
    const [favDrivers, setFavDrivers] = React.useState(["NOR", "VER", "LEC"]);
    const [favTeams, setFavTeams] = React.useState(["MCL", "FER"]);
    function move(list, setList) {
      return (i, dir) => {
        const j = i + dir;
        if (j < 0 || j >= list.length) return;
        const next = list.slice();
        [next[i], next[j]] = [next[j], next[i]];
        setList(next);
      };
    }
    const moveDriver = move(favDrivers, setFavDrivers);
    const moveTeam = move(favTeams, setFavTeams);
    return /*#__PURE__*/React.createElement("div", {
      className: "set"
    }, /*#__PURE__*/React.createElement("nav", {
      className: "set__nav"
    }, SECTIONS.map(s => /*#__PURE__*/React.createElement("div", {
      className: "set__navitem",
      key: s.id,
      "data-active": sec === s.id,
      onClick: () => setSec(s.id)
    }, /*#__PURE__*/React.createElement(Icon, {
      name: s.icon,
      size: 16
    }), s.label))), /*#__PURE__*/React.createElement("div", {
      className: "set__col"
    }, sec === "ai" && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(Card, {
      title: "AI provider",
      subtitle: "Apexline uses your own accounts. OAuth sessions stay in the macOS Keychain."
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        flexDirection: "column",
        gap: 14
      }
    }, /*#__PURE__*/React.createElement("div", {
      className: "provider"
    }, /*#__PURE__*/React.createElement("span", {
      className: "provider__logo",
      style: {
        background: "#fff",
        color: "#0f172a"
      }
    }, "C"), /*#__PURE__*/React.createElement("div", {
      style: {
        flex: 1
      }
    }, /*#__PURE__*/React.createElement("div", {
      className: "row__t"
    }, "ChatGPT (Codex)"), /*#__PURE__*/React.createElement("div", {
      className: "row__s"
    }, "Not connected")), /*#__PURE__*/React.createElement(Badge, {
      tone: "neutral",
      dot: true
    }, "OAuth")), /*#__PURE__*/React.createElement("div", {
      className: "provider"
    }, /*#__PURE__*/React.createElement("span", {
      className: "provider__logo",
      style: {
        background: "#050505"
      }
    }, "G"), /*#__PURE__*/React.createElement("div", {
      style: {
        flex: 1
      }
    }, /*#__PURE__*/React.createElement("div", {
      className: "row__t"
    }, "Grok"), /*#__PURE__*/React.createElement("div", {
      className: "row__s"
    }, "Not connected")), /*#__PURE__*/React.createElement(Badge, {
      tone: "neutral",
      dot: true
    }, "OAuth")))), /*#__PURE__*/React.createElement(Card, {
      title: "Preferred model",
      subtitle: "Used for battle detection, strategy & projections"
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        alignItems: "center",
        gap: 14,
        flexWrap: "wrap"
      }
    }, /*#__PURE__*/React.createElement(SegmentedControl, {
      value: model,
      onChange: setModel,
      accent: true,
      options: [{
        value: "codex",
        label: "GPT-5.4 mini"
      }, {
        value: "grok",
        label: "Grok 4.3"
      }, {
        value: "local",
        label: "Local MLX"
      }]
    }), /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 13,
        color: "var(--text-tertiary)"
      }
    }, model === "local" ? "Lightweight on-device fallback — basic detection only, no key needed." : "Structured JSON output mode · teaching system prompt enabled."))), /*#__PURE__*/React.createElement(Card, {
      title: "How Apexline's AI works",
      subtitle: "Hybrid: the app computes the precise numbers, the model reasons about strategy"
    }, /*#__PURE__*/React.createElement("div", {
      className: "ai-flow"
    }, [{
      n: "01",
      t: "Telemetry in",
      d: "OpenF1 stream: gaps, sectors, tyres, DRS."
    }, {
      n: "02",
      t: "App computes",
      d: "Swift calculates deltas, deg rates, projections."
    }, {
      n: "03",
      t: "Prompt + JSON",
      d: "Structured data + F1 system prompt → your model."
    }, {
      n: "04",
      t: "Insights out",
      d: "JSON + commentary drives alerts & onboard pairs."
    }].map((s, i) => /*#__PURE__*/React.createElement("div", {
      className: "ai-step",
      key: i
    }, /*#__PURE__*/React.createElement("span", {
      className: "ai-step__n"
    }, s.n), /*#__PURE__*/React.createElement("div", {
      className: "ai-step__t"
    }, s.t), /*#__PURE__*/React.createElement("div", {
      className: "ai-step__d"
    }, s.d), i < 3 && /*#__PURE__*/React.createElement("span", {
      className: "ai-step__arrow"
    }, /*#__PURE__*/React.createElement(Icon, {
      name: "chevronRight",
      size: 16
    }))))), /*#__PURE__*/React.createElement("div", {
      className: "row"
    }, /*#__PURE__*/React.createElement("div", {
      className: "row__txt"
    }, /*#__PURE__*/React.createElement("div", {
      className: "row__t"
    }, "Auto-apply intelligent onboard pairs"), /*#__PURE__*/React.createElement("div", {
      className: "row__s"
    }, "When a battle is detected, load both onboards into Battle Mode automatically.")), /*#__PURE__*/React.createElement(Switch, {
      defaultChecked: true
    })), /*#__PURE__*/React.createElement("div", {
      className: "row"
    }, /*#__PURE__*/React.createElement("div", {
      className: "row__txt"
    }, /*#__PURE__*/React.createElement("div", {
      className: "row__t"
    }, "Stream telemetry to model"), /*#__PURE__*/React.createElement("div", {
      className: "row__s"
    }, "Send computed (not raw) data on a 5-second cadence during live sessions.")), /*#__PURE__*/React.createElement(Switch, {
      defaultChecked: true
    })))), sec === "favorites" && (() => {
      const driverPool = D.drivers.filter(d => !favDrivers.includes(d.code));
      const teamPool = D.constructors.filter(c => !favTeams.includes(c.abbr));
      const driverItems = favDrivers.map(code => {
        const d = D.byCode[code];
        return {
          key: code,
          name: d.name,
          sub: d.team + " · #" + d.num,
          avatar: /*#__PURE__*/React.createElement(Avatar, {
            initials: d.code,
            number: d.num,
            ring: d.color,
            size: "md"
          })
        };
      });
      const teamItems = favTeams.map(abbr => {
        const c = D.constructors.find(x => x.abbr === abbr);
        return {
          key: abbr,
          name: c.name,
          sub: "Constructor · P" + c.pos,
          avatar: /*#__PURE__*/React.createElement(Avatar, {
            initials: c.abbr,
            square: true,
            ring: c.color,
            size: "md"
          })
        };
      });
      return /*#__PURE__*/React.createElement(Card, {
        title: "Favorites",
        subtitle: "Rank your drivers and teams. Highlights, news and the dashboard prioritize your top picks \u2014 #1 leads everywhere."
      }, /*#__PURE__*/React.createElement("div", {
        className: "fav-grid"
      }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
        className: "fav-col__hd"
      }, /*#__PURE__*/React.createElement(Icon, {
        name: "user",
        size: 16
      }), /*#__PURE__*/React.createElement("h4", null, "Drivers"), /*#__PURE__*/React.createElement("span", {
        className: "fav-col__count"
      }, favDrivers.length, " ranked")), /*#__PURE__*/React.createElement(RankList, {
        items: driverItems,
        kind: "drivers",
        onMove: moveDriver,
        onRemove: k => setFavDrivers(favDrivers.filter(c => c !== k))
      }), driverPool.length > 0 && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
        className: "fav-pool__label"
      }, "Add a driver"), /*#__PURE__*/React.createElement("div", {
        className: "fav-pool"
      }, driverPool.map(d => /*#__PURE__*/React.createElement("button", {
        className: "fav-chip",
        key: d.code,
        onClick: () => setFavDrivers([...favDrivers, d.code])
      }, /*#__PURE__*/React.createElement("span", {
        className: "fav-chip__swatch",
        style: {
          background: d.color
        }
      }), d.code, /*#__PURE__*/React.createElement("span", {
        className: "fav-chip__add"
      }, /*#__PURE__*/React.createElement(Icon, {
        name: "plus",
        size: 13
      }))))))), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
        className: "fav-col__hd"
      }, /*#__PURE__*/React.createElement(Icon, {
        name: "trophy",
        size: 16
      }), /*#__PURE__*/React.createElement("h4", null, "Teams"), /*#__PURE__*/React.createElement("span", {
        className: "fav-col__count"
      }, favTeams.length, " ranked")), /*#__PURE__*/React.createElement(RankList, {
        items: teamItems,
        kind: "teams",
        onMove: moveTeam,
        onRemove: k => setFavTeams(favTeams.filter(a => a !== k))
      }), teamPool.length > 0 && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
        className: "fav-pool__label"
      }, "Add a team"), /*#__PURE__*/React.createElement("div", {
        className: "fav-pool"
      }, teamPool.map(c => /*#__PURE__*/React.createElement("button", {
        className: "fav-chip",
        key: c.abbr,
        onClick: () => setFavTeams([...favTeams, c.abbr])
      }, /*#__PURE__*/React.createElement("span", {
        className: "fav-chip__swatch",
        style: {
          background: c.color
        }
      }), c.name, /*#__PURE__*/React.createElement("span", {
        className: "fav-chip__add"
      }, /*#__PURE__*/React.createElement(Icon, {
        name: "plus",
        size: 13
      })))))))));
    })(), sec === "account" && /*#__PURE__*/React.createElement(Card, {
      title: "F1 TV account",
      subtitle: "Required to watch live streams. Credentials stay on-device."
    }, /*#__PURE__*/React.createElement("div", {
      className: "provider",
      style: {
        marginBottom: 16
      }
    }, /*#__PURE__*/React.createElement(Avatar, {
      initials: "AR"
    }), /*#__PURE__*/React.createElement("div", {
      style: {
        flex: 1
      }
    }, /*#__PURE__*/React.createElement("div", {
      className: "row__t"
    }, "Alex Ramos"), /*#__PURE__*/React.createElement("div", {
      className: "row__s"
    }, "F1 TV Pro \xB7 renews Jan 2027")), /*#__PURE__*/React.createElement(Badge, {
      tone: "success",
      dot: true
    }, "Signed in")), /*#__PURE__*/React.createElement("div", {
      className: "keyrow"
    }, /*#__PURE__*/React.createElement(Input, {
      label: "Email",
      defaultValue: "alex.ramos@email.com"
    }), /*#__PURE__*/React.createElement(Button, {
      variant: "ghost"
    }, "Sign out")), /*#__PURE__*/React.createElement("div", {
      className: "row"
    }, /*#__PURE__*/React.createElement("div", {
      className: "row__txt"
    }, /*#__PURE__*/React.createElement("div", {
      className: "row__t"
    }, "Unofficial companion app"), /*#__PURE__*/React.createElement("div", {
      className: "row__s"
    }, "Apexline requires an active F1 TV subscription. Not affiliated with Formula 1.")))), sec === "appearance" && /*#__PURE__*/React.createElement(Card, {
      title: "Appearance",
      subtitle: "Theme & display"
    }, /*#__PURE__*/React.createElement("div", {
      className: "row"
    }, /*#__PURE__*/React.createElement("div", {
      className: "row__txt"
    }, /*#__PURE__*/React.createElement("div", {
      className: "row__t"
    }, "Theme"), /*#__PURE__*/React.createElement("div", {
      className: "row__s"
    }, "Dark cockpit is the native default.")), /*#__PURE__*/React.createElement(SegmentedControl, {
      value: "dark",
      onChange: () => {},
      options: [{
        value: "dark",
        label: "Dark"
      }, {
        value: "midnight",
        label: "Midnight"
      }]
    })), /*#__PURE__*/React.createElement("div", {
      className: "row"
    }, /*#__PURE__*/React.createElement("div", {
      className: "row__txt"
    }, /*#__PURE__*/React.createElement("div", {
      className: "row__t"
    }, "Accent color"), /*#__PURE__*/React.createElement("div", {
      className: "row__s"
    }, "Signal blue used for live & active states.")), /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        gap: 8
      }
    }, ["#2d7bff", "#00e0a4", "#ff3b3b"].map(c => /*#__PURE__*/React.createElement("span", {
      key: c,
      style: {
        width: 26,
        height: 26,
        borderRadius: 7,
        background: c,
        border: c === "#2d7bff" ? "2px solid #fff" : "1px solid var(--border-default)",
        cursor: "pointer"
      }
    })))), /*#__PURE__*/React.createElement("div", {
      className: "row"
    }, /*#__PURE__*/React.createElement("div", {
      className: "row__txt"
    }, /*#__PURE__*/React.createElement("div", {
      className: "row__t"
    }, "Reduce motion"), /*#__PURE__*/React.createElement("div", {
      className: "row__s"
    }, "Minimize pulses and transitions.")), /*#__PURE__*/React.createElement(Switch, null))), sec === "notifications" && /*#__PURE__*/React.createElement(Card, {
      title: "Notifications",
      subtitle: "What Apexline pings you about"
    }, [["Lights out", "5 minutes before every race start", true], ["Battle alerts", "When the AI detects a close fight", true], ["Pit windows", "Strategy & undercut opportunities", true], ["Breaking news", "Major paddock stories", false], ["Qualifying results", "When a session ends", true]].map((r, i) => /*#__PURE__*/React.createElement("div", {
      className: "row",
      key: i
    }, /*#__PURE__*/React.createElement("div", {
      className: "row__txt"
    }, /*#__PURE__*/React.createElement("div", {
      className: "row__t"
    }, r[0]), /*#__PURE__*/React.createElement("div", {
      className: "row__s"
    }, r[1])), /*#__PURE__*/React.createElement(Switch, {
      defaultChecked: r[2]
    })))), sec === "layouts" && /*#__PURE__*/React.createElement(Card, {
      title: "Layout defaults",
      subtitle: "Your starting Live Racing layout"
    }, /*#__PURE__*/React.createElement("div", {
      className: "row"
    }, /*#__PURE__*/React.createElement("div", {
      className: "row__txt"
    }, /*#__PURE__*/React.createElement("div", {
      className: "row__t"
    }, "Default preset"), /*#__PURE__*/React.createElement("div", {
      className: "row__s"
    }, "Applied when you enter Live Racing.")), /*#__PURE__*/React.createElement(SegmentedControl, {
      value: "focus",
      onChange: () => {},
      options: [{
        value: "focus",
        label: "Driver Focus"
      }, {
        value: "battle",
        label: "Battle"
      }]
    })), /*#__PURE__*/React.createElement("div", {
      className: "row"
    }, /*#__PURE__*/React.createElement("div", {
      className: "row__txt"
    }, /*#__PURE__*/React.createElement("div", {
      className: "row__t"
    }, "Remember last layout"), /*#__PURE__*/React.createElement("div", {
      className: "row__s"
    }, "Restore your panes, sidebars & sizes next session.")), /*#__PURE__*/React.createElement(Switch, {
      defaultChecked: true
    })), /*#__PURE__*/React.createElement("div", {
      className: "row"
    }, /*#__PURE__*/React.createElement("div", {
      className: "row__txt"
    }, /*#__PURE__*/React.createElement("div", {
      className: "row__t"
    }, "Telemetry overlay by default"), /*#__PURE__*/React.createElement("div", {
      className: "row__s"
    }, "Show speed, gear, DRS on every new pane.")), /*#__PURE__*/React.createElement(Switch, {
      defaultChecked: true
    })))));
  }
  window.PW = window.PW || {};
  window.PW.Settings = Settings;
})();
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/pitwall/Settings.jsx", error: String((e && e.message) || e) }); }

// ui_kits/pitwall/data.js
try { (() => {
/* Shared fake F1 data for the Apexline UI kit — 2026 season flavour.
   Exposed on window.PW_DATA. Not real telemetry; illustrative only. */
(function () {
  const T = {
    redbull: "var(--team-redbull)",
    ferrari: "var(--team-ferrari)",
    mercedes: "var(--team-mercedes)",
    mclaren: "var(--team-mclaren)",
    aston: "var(--team-aston)",
    alpine: "var(--team-alpine)",
    williams: "var(--team-williams)",
    rb: "var(--team-racingbulls)",
    audi: "var(--team-audi)",
    haas: "var(--team-haas)",
    cadillac: "var(--team-cadillac)"
  };
  const drivers = [{
    code: "VER",
    name: "Max Verstappen",
    num: 3,
    team: "Red Bull Racing",
    color: T.redbull,
    abbr: "RBR"
  }, {
    code: "HAD",
    name: "Isack Hadjar",
    num: 6,
    team: "Red Bull Racing",
    color: T.redbull,
    abbr: "RBR"
  }, {
    code: "NOR",
    name: "Lando Norris",
    num: 1,
    team: "McLaren",
    color: T.mclaren,
    abbr: "MCL"
  }, {
    code: "PIA",
    name: "Oscar Piastri",
    num: 81,
    team: "McLaren",
    color: T.mclaren,
    abbr: "MCL"
  }, {
    code: "LEC",
    name: "Charles Leclerc",
    num: 16,
    team: "Ferrari",
    color: T.ferrari,
    abbr: "FER"
  }, {
    code: "HAM",
    name: "Lewis Hamilton",
    num: 44,
    team: "Ferrari",
    color: T.ferrari,
    abbr: "FER"
  }, {
    code: "RUS",
    name: "George Russell",
    num: 63,
    team: "Mercedes",
    color: T.mercedes,
    abbr: "MER"
  }, {
    code: "ANT",
    name: "Kimi Antonelli",
    num: 12,
    team: "Mercedes",
    color: T.mercedes,
    abbr: "MER"
  }, {
    code: "ALO",
    name: "Fernando Alonso",
    num: 14,
    team: "Aston Martin",
    color: T.aston,
    abbr: "AST"
  }, {
    code: "STR",
    name: "Lance Stroll",
    num: 18,
    team: "Aston Martin",
    color: T.aston,
    abbr: "AST"
  }, {
    code: "ALB",
    name: "Alexander Albon",
    num: 23,
    team: "Williams",
    color: T.williams,
    abbr: "WIL"
  }, {
    code: "SAI",
    name: "Carlos Sainz",
    num: 55,
    team: "Williams",
    color: T.williams,
    abbr: "WIL"
  }, {
    code: "GAS",
    name: "Pierre Gasly",
    num: 10,
    team: "Alpine",
    color: T.alpine,
    abbr: "ALP"
  }, {
    code: "COL",
    name: "Franco Colapinto",
    num: 43,
    team: "Alpine",
    color: T.alpine,
    abbr: "ALP"
  }, {
    code: "LIN",
    name: "Arvid Lindblad",
    num: 41,
    team: "Racing Bulls",
    color: T.rb,
    abbr: "RB"
  }, {
    code: "LAW",
    name: "Liam Lawson",
    num: 30,
    team: "Racing Bulls",
    color: T.rb,
    abbr: "RB"
  }, {
    code: "HUL",
    name: "Nico Hulkenberg",
    num: 27,
    team: "Audi",
    color: T.audi,
    abbr: "AUD"
  }, {
    code: "BOR",
    name: "Gabriel Bortoleto",
    num: 5,
    team: "Audi",
    color: T.audi,
    abbr: "AUD"
  }, {
    code: "OCO",
    name: "Esteban Ocon",
    num: 31,
    team: "Haas F1 Team",
    color: T.haas,
    abbr: "HAS"
  }, {
    code: "BEA",
    name: "Oliver Bearman",
    num: 87,
    team: "Haas F1 Team",
    color: T.haas,
    abbr: "HAS"
  }, {
    code: "PER",
    name: "Sergio Perez",
    num: 11,
    team: "Cadillac",
    color: T.cadillac,
    abbr: "CAD"
  }, {
    code: "BOT",
    name: "Valtteri Bottas",
    num: 77,
    team: "Cadillac",
    color: T.cadillac,
    abbr: "CAD"
  }];
  const byCode = Object.fromEntries(drivers.map(d => [d.code, d]));

  // Live timing snapshot (race, lap 41/57)
  const timing = [{
    pos: 1,
    code: "VER",
    last: "1:29.158",
    state: "fastest",
    gap: "LEADER",
    interval: "—",
    trend: "flat",
    comp: "soft",
    age: 8,
    pits: 1
  }, {
    pos: 2,
    code: "NOR",
    last: "1:29.342",
    state: "pb",
    gap: "+0.812",
    interval: "+0.812",
    trend: "gain",
    comp: "medium",
    age: 14,
    pits: 1
  }, {
    pos: 3,
    code: "LEC",
    last: "1:29.604",
    state: null,
    gap: "+2.140",
    interval: "+1.328",
    trend: "loss",
    comp: "medium",
    age: 15,
    pits: 1
  }, {
    pos: 4,
    code: "PIA",
    last: "1:29.711",
    state: null,
    gap: "+3.902",
    interval: "+1.762",
    trend: "flat",
    comp: "soft",
    age: 6,
    pits: 2
  }, {
    pos: 5,
    code: "RUS",
    last: "1:29.880",
    state: null,
    gap: "+6.451",
    interval: "+2.549",
    trend: "gain",
    comp: "hard",
    age: 22,
    pits: 1
  }, {
    pos: 6,
    code: "HAM",
    last: "1:30.012",
    state: null,
    gap: "+9.330",
    interval: "+2.879",
    trend: "loss",
    comp: "hard",
    age: 23,
    pits: 1
  }, {
    pos: 7,
    code: "ANT",
    last: "1:30.144",
    state: null,
    gap: "+12.07",
    interval: "+2.740",
    trend: "flat",
    comp: "medium",
    age: 12,
    pits: 1
  }, {
    pos: 8,
    code: "ALO",
    last: "1:30.260",
    state: null,
    gap: "+15.88",
    interval: "+3.810",
    trend: "gain",
    comp: "hard",
    age: 24,
    pits: 1
  }, {
    pos: 9,
    code: "SAI",
    last: "1:30.401",
    state: null,
    gap: "+18.22",
    interval: "+2.340",
    trend: "flat",
    comp: "medium",
    age: 13,
    pits: 1
  }, {
    pos: 10,
    code: "GAS",
    last: "1:30.560",
    state: null,
    gap: "+21.99",
    interval: "+3.770",
    trend: "loss",
    comp: "soft",
    age: 5,
    pits: 2
  }, {
    pos: 11,
    code: "HAD",
    last: "1:30.700",
    state: null,
    gap: "+24.51",
    interval: "+2.520",
    trend: "flat",
    comp: "medium",
    age: 16,
    pits: 1
  }, {
    pos: 12,
    code: "HUL",
    last: "1:30.844",
    state: null,
    gap: "+28.03",
    interval: "+3.520",
    trend: "gain",
    comp: "hard",
    age: 25,
    pits: 1
  }, {
    pos: 13,
    code: "ALB",
    last: "1:30.910",
    state: null,
    gap: "+31.10",
    interval: "+3.070",
    trend: "flat",
    comp: "medium",
    age: 14,
    pits: 1
  }, {
    pos: 14,
    code: "BEA",
    last: "1:31.022",
    state: null,
    gap: "+34.88",
    interval: "+3.780",
    trend: "gain",
    comp: "hard",
    age: 26,
    pits: 1
  }, {
    pos: 15,
    code: "LIN",
    last: "1:31.140",
    state: null,
    gap: "+38.41",
    interval: "+3.530",
    trend: "flat",
    comp: "soft",
    age: 7,
    pits: 2
  }, {
    pos: 16,
    code: "STR",
    last: "1:31.255",
    state: null,
    gap: "+42.66",
    interval: "+4.250",
    trend: "loss",
    comp: "hard",
    age: 24,
    pits: 1
  }, {
    pos: 17,
    code: "BOR",
    last: "1:31.388",
    state: null,
    gap: "+46.90",
    interval: "+4.240",
    trend: "flat",
    comp: "medium",
    age: 17,
    pits: 1
  }, {
    pos: 18,
    code: "OCO",
    last: "1:31.470",
    state: null,
    gap: "+51.33",
    interval: "+4.430",
    trend: "gain",
    comp: "hard",
    age: 23,
    pits: 1
  }, {
    pos: 19,
    code: "COL",
    last: "1:31.602",
    state: null,
    gap: "+55.10",
    interval: "+3.770",
    trend: "flat",
    comp: "medium",
    age: 15,
    pits: 1
  }, {
    pos: 20,
    code: "LAW",
    last: "1:31.744",
    state: null,
    gap: "+1 LAP",
    interval: "+1 LAP",
    trend: "loss",
    comp: "soft",
    age: 6,
    pits: 2
  }, {
    pos: 21,
    code: "PER",
    last: "1:31.880",
    state: null,
    gap: "+1 LAP",
    interval: "+0.610",
    trend: "flat",
    comp: "hard",
    age: 22,
    pits: 1
  }, {
    pos: 22,
    code: "BOT",
    last: "1:32.013",
    state: null,
    gap: "+1 LAP",
    interval: "+2.140",
    trend: "flat",
    comp: "medium",
    age: 18,
    pits: 1
  }];

  // Driver standings — full 2026 grid (22)
  const standings = [{
    pos: 1,
    code: "VER",
    pts: 287,
    wins: 7,
    delta: 0
  }, {
    pos: 2,
    code: "NOR",
    pts: 263,
    wins: 5,
    delta: 1
  }, {
    pos: 3,
    code: "PIA",
    pts: 241,
    wins: 3,
    delta: -1
  }, {
    pos: 4,
    code: "LEC",
    pts: 218,
    wins: 2,
    delta: 0
  }, {
    pos: 5,
    code: "RUS",
    pts: 184,
    wins: 1,
    delta: 2
  }, {
    pos: 6,
    code: "HAM",
    pts: 162,
    wins: 1,
    delta: -1
  }, {
    pos: 7,
    code: "ANT",
    pts: 121,
    wins: 0,
    delta: 1
  }, {
    pos: 8,
    code: "ALO",
    pts: 96,
    wins: 0,
    delta: -2
  }, {
    pos: 9,
    code: "SAI",
    pts: 78,
    wins: 0,
    delta: 1
  }, {
    pos: 10,
    code: "ALB",
    pts: 66,
    wins: 0,
    delta: 2
  }, {
    pos: 11,
    code: "GAS",
    pts: 54,
    wins: 0,
    delta: -2
  }, {
    pos: 12,
    code: "HAD",
    pts: 41,
    wins: 0,
    delta: 1
  }, {
    pos: 13,
    code: "BEA",
    pts: 35,
    wins: 0,
    delta: 3
  }, {
    pos: 14,
    code: "STR",
    pts: 29,
    wins: 0,
    delta: -1
  }, {
    pos: 15,
    code: "BOR",
    pts: 24,
    wins: 0,
    delta: 1
  }, {
    pos: 16,
    code: "OCO",
    pts: 21,
    wins: 0,
    delta: -3
  }, {
    pos: 17,
    code: "LAW",
    pts: 18,
    wins: 0,
    delta: 0
  }, {
    pos: 18,
    code: "HUL",
    pts: 14,
    wins: 0,
    delta: 1
  }, {
    pos: 19,
    code: "LIN",
    pts: 11,
    wins: 0,
    delta: -1
  }, {
    pos: 20,
    code: "COL",
    pts: 7,
    wins: 0,
    delta: 0
  }, {
    pos: 21,
    code: "PER",
    pts: 4,
    wins: 0,
    delta: 0
  }, {
    pos: 22,
    code: "BOT",
    pts: 2,
    wins: 0,
    delta: 0
  }];

  // Constructor standings — full 2026 grid (11)
  const constructors = [{
    pos: 1,
    abbr: "MCL",
    name: "McLaren",
    color: T.mclaren,
    pts: 504,
    delta: 0
  }, {
    pos: 2,
    abbr: "FER",
    name: "Ferrari",
    color: T.ferrari,
    pts: 380,
    delta: 1
  }, {
    pos: 3,
    abbr: "RBR",
    name: "Red Bull",
    color: T.redbull,
    pts: 298,
    delta: -1
  }, {
    pos: 4,
    abbr: "MER",
    name: "Mercedes",
    color: T.mercedes,
    pts: 305,
    delta: 0
  }, {
    pos: 5,
    abbr: "WIL",
    name: "Williams",
    color: T.williams,
    pts: 144,
    delta: 1
  }, {
    pos: 6,
    abbr: "AST",
    name: "Aston Martin",
    color: T.aston,
    pts: 125,
    delta: -1
  }, {
    pos: 7,
    abbr: "RB",
    name: "Racing Bulls",
    color: T.rb,
    pts: 59,
    delta: 0
  }, {
    pos: 8,
    abbr: "ALP",
    name: "Alpine",
    color: T.alpine,
    pts: 61,
    delta: 0
  }, {
    pos: 9,
    abbr: "HAS",
    name: "Haas",
    color: T.haas,
    pts: 56,
    delta: 1
  }, {
    pos: 10,
    abbr: "AUD",
    name: "Audi",
    color: T.audi,
    pts: 38,
    delta: -1
  }, {
    pos: 11,
    abbr: "CAD",
    name: "Cadillac",
    color: T.cadillac,
    pts: 6,
    delta: 0
  }];

  // Season calendar (subset) — round, name, circuit, country flag emoji avoided; use code
  const schedule = [{
    rnd: 8,
    name: "Monaco Grand Prix",
    circuit: "Circuit de Monaco",
    loc: "Monte Carlo",
    date: "May 24",
    status: "done",
    winner: "LEC"
  }, {
    rnd: 9,
    name: "Canadian Grand Prix",
    circuit: "Circuit Gilles-Villeneuve",
    loc: "Montréal",
    date: "Jun 14",
    status: "live"
  }, {
    rnd: 10,
    name: "Spanish Grand Prix",
    circuit: "Circuit de Barcelona-Catalunya",
    loc: "Barcelona",
    date: "Jun 28",
    status: "upcoming"
  }, {
    rnd: 11,
    name: "Austrian Grand Prix",
    circuit: "Red Bull Ring",
    loc: "Spielberg",
    date: "Jul 05",
    status: "upcoming"
  }, {
    rnd: 12,
    name: "British Grand Prix",
    circuit: "Silverstone Circuit",
    loc: "Silverstone",
    date: "Jul 19",
    status: "upcoming"
  }, {
    rnd: 13,
    name: "Hungarian Grand Prix",
    circuit: "Hungaroring",
    loc: "Budapest",
    date: "Aug 02",
    status: "upcoming"
  }];

  // Canada GP weekend sessions
  const sessions = [{
    kind: "Practice 1",
    day: "Fri",
    time: "13:30",
    status: "done"
  }, {
    kind: "Practice 2",
    day: "Fri",
    time: "17:00",
    status: "done"
  }, {
    kind: "Practice 3",
    day: "Sat",
    time: "12:30",
    status: "done"
  }, {
    kind: "Qualifying",
    day: "Sat",
    time: "16:00",
    status: "done"
  }, {
    kind: "Race",
    day: "Sun",
    time: "14:00",
    status: "live",
    laps: "41 / 57"
  }];
  const news = [{
    tag: "Strategy",
    team: "ferrari",
    color: T.ferrari,
    title: "Ferrari gamble on undercut pays off as Leclerc jumps Norris in Montréal",
    source: "Apexline Wire",
    time: "12m",
    lead: "A bold lap-38 stop vaulted the Monégasque ahead of the McLaren in clean air."
  }, {
    tag: "Breaking",
    team: "redbull",
    color: T.redbull,
    title: "Verstappen leads every lap to extend championship cushion to 24 points",
    source: "RaceFeed",
    time: "1h",
    lead: "Red Bull's one-stop held firm despite late pressure from the McLaren pair."
  }, {
    tag: "Tech",
    team: "mercedes",
    color: T.mercedes,
    title: "Mercedes brings revised floor for Barcelona in bid to close the gap",
    source: "AutoSport",
    time: "3h",
    lead: "The team targets a step in high-speed corners after a quiet Monaco."
  }, {
    tag: "Paddock",
    team: "williams",
    color: T.williams,
    title: "Sainz: 'Williams has the pace to fight for points every weekend now'",
    source: "The Race",
    time: "5h",
    lead: "The Spaniard is bullish after a strong qualifying showing in Canada."
  }];

  // AI insights feed (Live mode)
  const insights = [{
    kind: "battle",
    conf: 0.86,
    title: "Battle detected — Verstappen vs Norris",
    body: "Gap 0.8s into DRS detection. Norris quicker in sector 2 (−0.21s). Window opens next lap.",
    a: "VER",
    b: "NOR"
  }, {
    kind: "strategy",
    conf: 0.74,
    title: "Undercut window opening for Leclerc",
    body: "LEC tyre delta vs PIA now +0.4s/lap. Pit in 1–2 laps to clear traffic and emerge in clean air."
  }, {
    kind: "projection",
    conf: 0.69,
    title: "Projected finish: VER P1 by 6.2s",
    body: "On current deltas, Verstappen holds the lead to the flag. Safety car risk shifts to a 2-stop for P2–P4."
  }];
  const presets = ["Driver Focus", "Pit Wall Classic", "Battle Mode", "Data Overload", "Minimal Clean"];

  // AI Copilot — race weekend analysis (Canadian GP)
  const copilot = {
    summary: "Montréal sets up as a low-deg, high-overtaking race where track position is cheap and strategy is king. McLaren has the raw pace, but Red Bull's straight-line speed and Verstappen's tyre management make him the marginal favourite. Expect a one-stop to dominate, with a safety car the single biggest variable — its history here is 70%+.",
    confidence: 0.78,
    predictions: [{
      code: "VER",
      label: "Race winner",
      prob: 0.34,
      note: "Best one-stop pace + SC-proof gap management"
    }, {
      code: "NOR",
      label: "Podium lock",
      prob: 0.61,
      note: "Quickest in S2, strong on mediums"
    }, {
      code: "LEC",
      label: "Dark horse",
      prob: 0.22,
      note: "Ferrari undercut threat if SC falls early"
    }],
    poleToWin: 0.41,
    storylines: [{
      icon: "trophy",
      tag: "Title fight",
      text: "Norris can cut Verstappen's 24-pt lead to single digits with a win + DNF — but the model rates that combo at just 9%."
    }, {
      icon: "droplet",
      tag: "Weather",
      text: "30% chance of a shower in the final third. A late VSC + rain crossover could blow the one-stop wide open."
    }, {
      icon: "zap",
      tag: "Form",
      text: "McLaren has out-qualified Red Bull 5 of the last 6. Front-row lockout probability: 38%."
    }],
    factors: [{
      label: "Overtaking",
      value: 82,
      hint: "High — long DRS zones"
    }, {
      label: "Tyre deg",
      value: 24,
      hint: "Low — one-stop favoured"
    }, {
      label: "Safety car",
      value: 71,
      hint: "Very likely"
    }, {
      label: "Weather risk",
      value: 30,
      hint: "Late shower possible"
    }],
    strategy: "Optimal is Medium → Hard, stopping lap 24–28. Soft start is +0.3s/lap early but cliffs hard by lap 16; only viable if chasing track position off a poor qualifying. Two-stop is ~7s slower unless a safety car resets the field after lap 35.",
    suggested: ["Who has the best one-stop pace this weekend?", "How does rain change the strategy picture?", "Compare Norris vs Piastri qualifying form in 2026", "What's the safety-car history at this circuit?"],
    chat: [{
      who: "ai",
      text: "Morning, Alex. I've analysed practice and quali for the Canadian GP. Verstappen edges it on race-pace projection, but McLaren has the qualifying advantage. Ask me anything about strategy, weather, or the title fight."
    }, {
      who: "me",
      text: "If it rains in the last 15 laps, who benefits most?"
    }, {
      who: "ai",
      text: "Hamilton and Alonso — both rate top-3 in the wet this season and start on the dirtier side of a one-stop. A late crossover to inters would also rescue anyone who pitted early and got stuck in traffic. Verstappen's lead is most at risk: a VSC for the rain would erase his pace buffer and bunch the field for a 6-lap sprint."
    }]
  };
  window.PW_DATA = {
    drivers,
    byCode,
    timing,
    standings,
    constructors,
    schedule,
    sessions,
    news,
    insights,
    presets,
    copilot,
    race: {
      name: "Canadian Grand Prix",
      circuit: "Circuit Gilles-Villeneuve",
      loc: "Montréal",
      lap: 41,
      laps: 57,
      round: 9,
      weather: {
        air: 24,
        track: 38,
        cond: "Dry",
        rain: "0%",
        wind: "11 km/h"
      }
    }
  };
})();
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/pitwall/data.js", error: String((e && e.message) || e) }); }

__ds_ns.Button = __ds_scope.Button;

__ds_ns.Icon = __ds_scope.Icon;

__ds_ns.ICON_NAMES = __ds_scope.ICON_NAMES;

__ds_ns.IconButton = __ds_scope.IconButton;

__ds_ns.SegmentedControl = __ds_scope.SegmentedControl;

__ds_ns.Avatar = __ds_scope.Avatar;

__ds_ns.Badge = __ds_scope.Badge;

__ds_ns.Card = __ds_scope.Card;

__ds_ns.Tag = __ds_scope.Tag;

__ds_ns.Countdown = __ds_scope.Countdown;

__ds_ns.DriverTag = __ds_scope.DriverTag;

__ds_ns.FlagStatus = __ds_scope.FlagStatus;

__ds_ns.GapDelta = __ds_scope.GapDelta;

__ds_ns.StatTile = __ds_scope.StatTile;

__ds_ns.TimingRowHeader = __ds_scope.TimingRowHeader;

__ds_ns.TimingRow = __ds_scope.TimingRow;

__ds_ns.TyreBadge = __ds_scope.TyreBadge;

__ds_ns.Checkbox = __ds_scope.Checkbox;

__ds_ns.Input = __ds_scope.Input;

__ds_ns.Select = __ds_scope.Select;

__ds_ns.Switch = __ds_scope.Switch;

__ds_ns.Tabs = __ds_scope.Tabs;

})();
