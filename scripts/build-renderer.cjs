const fs = require("node:fs");
const path = require("node:path");
const Babel = require("@babel/standalone");

const root = path.resolve(__dirname, "..");
const srcDir = path.join(root, "ui_kits/pitwall");
const outDir = path.join(root, "dist/pitwall");
const screens = [
  "DataProvider",
  "AppShell",
  "Dashboard",
  "Weekend",
  "LiveRacing",
  "Leaderboards",
  "TrackMap",
  "Drivers",
  "Teams",
  "Schedule",
  "News",
  "Analytics",
  "Copilot",
  "Settings",
];

fs.mkdirSync(outDir, { recursive: true });
fs.copyFileSync(path.join(srcDir, "data.js"), path.join(outDir, "data.js"));
fs.copyFileSync(path.join(srcDir, "sync.js"), path.join(outDir, "sync.js"));
fs.copyFileSync(path.join(srcDir, "theme.js"), path.join(outDir, "theme.js"));
fs.copyFileSync(path.join(srcDir, "trackmap-circuits.js"), path.join(outDir, "trackmap-circuits.js"));

for (const name of screens) {
  const sourcePath = path.join(srcDir, `${name}.jsx`);
  const outPath = path.join(outDir, `${name}.js`);
  const source = fs.readFileSync(sourcePath, "utf8");
  const { code } = Babel.transform(source, { presets: ["react"], filename: `${name}.jsx` });
  fs.writeFileSync(outPath, code + "\n");
}

const screenScripts = screens.map((name) => `<script src="${name}.js"></script>`).join("\n");
const html = `<!-- Built PitWall renderer. Source: ui_kits/pitwall/index.html -->
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="darkreader-lock">
<title>PitWall</title>
<link rel="stylesheet" href="../../styles.css">
<style>
  html, body { margin: 0; height: 100%; background: var(--bg-app); }
  #root { height: 100vh; }
  ::-webkit-scrollbar { width: 11px; height: 11px; }
  ::-webkit-scrollbar-thumb { background: var(--ink-600); border-radius: 99px; border: 3px solid transparent; background-clip: content-box; }
  ::-webkit-scrollbar-thumb:hover { background: var(--ink-500); background-clip: content-box; }
  ::-webkit-scrollbar-track { background: transparent; }
</style>
</head>
<body>
<div id="root"></div>
<script src="../../node_modules/react/umd/react.development.js"></script>
<script src="../../node_modules/react-dom/umd/react-dom.development.js"></script>
<script src="../../node_modules/hls.js/dist/hls.min.js"></script>
<script src="../../node_modules/shaka-player/dist/shaka-player.compiled.js"></script>
<script src="../../_ds_bundle.js"></script>
<script src="theme.js"></script>
<script src="data.js"></script>
<script src="sync.js"></script>
<script src="trackmap-circuits.js"></script>
${screenScripts}
<script>
  const { AppShell } = window.PW;
  const TITLES = {
    dashboard: { t: "Dashboard", c: "Live F1 overview" },
    weekend: { t: "Weekend", c: "Race weekend" },
    trackmap: { t: "Track Map", c: "Circuit & live positions" },
    leaderboards: { t: "Leaderboards", c: "2026 Championship" },
    drivers: { t: "Drivers", c: "2026 grid" },
    teams: { t: "Teams", c: "Constructors" },
    schedule: { t: "Schedule", c: "2026 Season" },
    news: { t: "News", c: "Live feed" },
    analytics: { t: "Analytics", c: "Deep dives" },
    copilot: { t: "AI Copilot", c: "Race intelligence" },
    settings: { t: "Settings", c: "" },
  };
  function initialPitWallScreen() {
    const allowed = new Set(["dashboard", "weekend", "live", "trackmap", "leaderboards", "drivers", "teams", "schedule", "news", "analytics", "copilot", "settings"]);
    const params = new URLSearchParams(window.location.search);
    const fromQuery = params.get("screen");
    const fromHash = window.location.hash.replace(/^#\\/?/, "");
    const candidate = String(fromQuery || fromHash || "dashboard").toLowerCase();
    return allowed.has(candidate) ? candidate : "dashboard";
  }
  function App() {
    const [screen, setScreen] = React.useState(initialPitWallScreen);
    function handleSearchResult(result) {
      if (result && result.driverCode) localStorage.setItem("pw-search-focus", result.driverCode);
      if (result && result.teamAbbr) localStorage.setItem("pw-team-focus", result.teamAbbr);
      if (result && result.screen) setScreen(result.screen);
    }
    if (screen === "live") {
      const Live = window.PW.LiveRacing;
      return React.createElement(Live, { onExit: () => setScreen("dashboard") });
    }
    const Screen = {
      dashboard: window.PW.Dashboard,
      weekend: window.PW.Weekend,
      trackmap: window.PW.TrackMap,
      leaderboards: window.PW.Leaderboards,
      drivers: window.PW.Drivers,
      teams: window.PW.Teams,
      schedule: window.PW.Schedule,
      news: window.PW.News,
      analytics: window.PW.Analytics,
      copilot: window.PW.Copilot,
      settings: window.PW.Settings,
    }[screen];
    const meta = TITLES[screen] || { t: "", c: "" };
    return React.createElement(AppShell, {
      active: screen,
      onNavigate: setScreen,
      title: meta.t,
      crumb: meta.c,
      onGoLive: () => setScreen("live"),
      onSearchResult: handleSearchResult,
    }, Screen ? React.createElement(Screen, { onNavigate: setScreen, onGoLive: () => setScreen("live") }) : null);
  }
  ReactDOM.createRoot(document.getElementById("root")).render(React.createElement(window.PW.DataProvider, null, React.createElement(App)));
</script>
</body>
</html>
`;

fs.writeFileSync(path.join(outDir, "index.html"), html);
console.log("Built PitWall renderer to dist/pitwall");
