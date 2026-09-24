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
fs.copyFileSync(path.join(srcDir, "social.js"), path.join(outDir, "social.js"));
fs.copyFileSync(path.join(srcDir, "theme.js"), path.join(outDir, "theme.js"));
fs.copyFileSync(path.join(srcDir, "trackmap-circuits.js"), path.join(outDir, "trackmap-circuits.js"));

for (const name of screens) {
  const sourcePath = path.join(srcDir, `${name}.jsx`);
  const outPath = path.join(outDir, `${name}.js`);
  const source = fs.readFileSync(sourcePath, "utf8");
  const { code } = Babel.transform(source, { presets: ["react"], filename: `${name}.jsx` });
  fs.writeFileSync(outPath, code + "\n");
}

const initialScreenScripts = ["DataProvider", "AppShell", "Dashboard"]
  .map((name) => `<script src="${name}.js"></script>`)
  .join("\n");
const html = `<!-- Built Apexline renderer. Source: ui_kits/pitwall/index.html -->
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="darkreader-lock">
<title>Apexline</title>
<link rel="stylesheet" href="../../styles.css">
<style>
  html, body { margin: 0; height: 100%; background: #07090d; }
  #root { height: 100vh; }
  .startup-load { min-height: 100vh; display: grid; place-items: center; padding: 32px; background: #07090d; color: #e8edf5; }
  .startup-load__panel { width: min(400px, 100%); text-align: center; }
  .startup-load__mark { width: 56px; height: 56px; margin: 0 auto 18px; border-radius: 16px; display: block; }
  .startup-load__kicker { color: #e80020; font-size: 11px; font-weight: 700; letter-spacing: .16em; text-transform: uppercase; }
  .startup-load__title { margin: 10px 0 8px; font-size: 28px; line-height: 1.05; }
  .startup-load__copy { margin: 0 auto; max-width: 34ch; color: #9aa4b5; font-size: 14px; line-height: 1.45; }
  .startup-load__bar { position: relative; height: 3px; margin: 22px auto 0; overflow: hidden; border-radius: 99px; background: rgba(255,255,255,.08); }
  .startup-load__bar span { position: absolute; inset: 0 auto 0 0; width: 38%; border-radius: inherit; background: #e80020; animation: pwStartupLoad 1.05s ease-in-out infinite; }
  @keyframes pwStartupLoad { 0% { transform: translateX(-105%); } 55%,100% { transform: translateX(260%); } }
  ::-webkit-scrollbar { width: 11px; height: 11px; }
  ::-webkit-scrollbar-thumb { background: var(--ink-600); border-radius: 99px; border: 3px solid transparent; background-clip: content-box; }
  ::-webkit-scrollbar-thumb:hover { background: var(--ink-500); background-clip: content-box; }
  ::-webkit-scrollbar-track { background: transparent; }
</style>
</head>
<body>
<div id="root">
  <div class="startup-load" aria-busy="true">
    <section class="startup-load__panel">
      <img class="startup-load__mark" src="../../assets/logo-mark.svg" alt="" />
      <div class="startup-load__kicker">Apexline</div>
      <h1 class="startup-load__title">Loading live F1 data</h1>
      <p class="startup-load__copy">Race, standings, and news stay hidden until this snapshot is fresh.</p>
      <div class="startup-load__bar"><span></span></div>
    </section>
  </div>
</div>
<script src="../../node_modules/react/umd/react.production.min.js"></script>
<script src="../../node_modules/react-dom/umd/react-dom.production.min.js"></script>
<script src="../../_ds_bundle.js"></script>
<script src="theme.js"></script>
<script src="data.js"></script>
<script src="sync.js"></script>
<script src="social.js"></script>
<script src="trackmap-circuits.js"></script>
${initialScreenScripts}
<script>
  const { AppShell } = window.PW;
  const runtimeScriptPromises = new Map();
  const SCREEN_SCRIPTS = {
    weekend: "Weekend.js",
    live: "LiveRacing.js",
    trackmap: "TrackMap.js",
    leaderboards: "Leaderboards.js",
    drivers: "Drivers.js",
    teams: "Teams.js",
    schedule: "Schedule.js",
    news: "News.js",
    analytics: "Analytics.js",
    copilot: "Copilot.js",
    settings: "Settings.js",
  };
  const SCREEN_GLOBALS = {
    weekend: "Weekend",
    trackmap: "TrackMap",
    leaderboards: "Leaderboards",
    drivers: "Drivers",
    teams: "Teams",
    schedule: "Schedule",
    news: "News",
    analytics: "Analytics",
    copilot: "Copilot",
    settings: "Settings",
  };
  // _ds_bundle.js historically stamped demo screen components onto window.PW.
  // Those capture window.PW_DATA at bundle-eval time (before data.js) and must
  // never short-circuit the real dist/pitwall screen scripts.
  window.PW = window.PW || {};
  for (const globalName of [...Object.values(SCREEN_GLOBALS), "LiveRacing"]) {
    delete window.PW[globalName];
  }
  const loadedScreenScripts = new Set(["dashboard"]);
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
  function loadRuntimeScript(source) {
    if (runtimeScriptPromises.has(source)) return runtimeScriptPromises.get(source);
    const promise = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = source;
      script.onload = resolve;
      script.onerror = () => {
        runtimeScriptPromises.delete(source);
        reject(new Error("Unable to load " + source));
      };
      document.head.appendChild(script);
    });
    runtimeScriptPromises.set(source, promise);
    return promise;
  }
  function loadScreenResources(screen) {
    if (loadedScreenScripts.has(screen)) return Promise.resolve();
    if (screen === "live") {
      return Promise.all([
        loadRuntimeScript("../../node_modules/hls.js/dist/hls.min.js"),
        loadRuntimeScript("../../node_modules/shaka-player/dist/shaka-player.compiled.js"),
      ]).then(() => loadRuntimeScript("LiveRacing.js")).then(() => {
        loadedScreenScripts.add(screen);
      });
    }
    const source = SCREEN_SCRIPTS[screen];
    if (!source) return Promise.resolve();
    return loadRuntimeScript(source).then(() => {
      loadedScreenScripts.add(screen);
    });
  }
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
    const [loadedScreen, setLoadedScreen] = React.useState(() => initialPitWallScreen() === "dashboard" ? "dashboard" : "");
    const [loadError, setLoadError] = React.useState("");
    const [loadAttempt, setLoadAttempt] = React.useState(0);
    React.useEffect(() => {
      let cancelled = false;
      setLoadError("");
      loadScreenResources(screen)
        .then(() => {
          if (!cancelled) setLoadedScreen(screen);
        })
        .catch(() => {
          if (!cancelled) setLoadError("Unable to load this screen.");
        });
      return () => {
        cancelled = true;
      };
    }, [screen, loadAttempt]);
    function handleSearchResult(result) {
      if (result && result.driverCode) localStorage.setItem("pw-search-focus", result.driverCode);
      if (result && result.teamAbbr) localStorage.setItem("pw-team-focus", result.teamAbbr);
      if (result && result.screen) setScreen(result.screen);
    }
    const meta = TITLES[screen] || { t: "", c: "" };
    if (loadedScreen !== screen) {
      const loading = React.createElement("div", { className: "pw-screen-loading", role: "status" },
        React.createElement("span", null, loadError || "Loading " + (meta.t || "screen") + "…"),
        loadError ? React.createElement("button", { type: "button", onClick: () => setLoadAttempt((attempt) => attempt + 1) }, "Retry") : null,
        screen === "live" ? React.createElement("button", { type: "button", onClick: () => setScreen("dashboard") }, "Back to dashboard") : null,
      );
      if (screen === "live") return loading;
      return React.createElement(AppShell, {
        active: screen,
        onNavigate: setScreen,
        title: meta.t,
        crumb: meta.c,
        onGoLive: () => setScreen("live"),
        onSearchResult: handleSearchResult,
      }, loading);
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
console.log("Built Apexline renderer to dist/pitwall");
