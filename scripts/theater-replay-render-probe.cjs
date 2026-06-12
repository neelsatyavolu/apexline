// Renders the real LiveRacing component in the Theater layout against REAL F1
// livetiming replay data (fetched + parsed by pitwall-f1timing-replay-probe.cjs)
// and asserts the four Theater overlays wire up: top-left session info, top-right
// floating timing, bottom-left broadcast lower-third, bottom-right onboard PiP.
//
//   npm run probe:theater            (defaults to the Monaco 2026 archive, elapsed 3600)
//   electron scripts/theater-replay-render-probe.cjs --elapsed=2400 --base=<archive url>

const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");
const { pathToFileURL } = require("node:url");
const { app, BrowserWindow } = require("electron");

const root = path.resolve(__dirname, "..");
const outDir = path.join("/private/tmp", `apexline-theater-replay-probe-${Date.now()}`);
const viewport = { name: "pro-14-default", width: 1512, height: 982 };

app.on("window-all-closed", (event) => event.preventDefault());

function option(name, fallback) {
  const prefix = `--${name}=`;
  const found = process.argv.slice(2).filter((arg) => arg.startsWith(prefix)).at(-1);
  return found ? found.slice(prefix.length) : fallback;
}

function fileUrl(...parts) {
  return pathToFileURL(path.join(root, ...parts)).href;
}

// Pull a real replay snapshot through the existing archive parser probe.
function fetchReplaySnapshot() {
  const args = ["scripts/pitwall-f1timing-replay-probe.cjs", `--elapsed=${option("elapsed", "3600")}`];
  const base = option("base", "");
  if (base) args.push(`--base=${base}`);
  // Under Electron, process.execPath is the Electron binary — ELECTRON_RUN_AS_NODE
  // makes it behave as a plain Node runtime so the fetch probe runs headless.
  const stdout = execFileSync(process.execPath, args, { cwd: root, encoding: "utf8", timeout: 180000, maxBuffer: 64 * 1024 * 1024, env: { ...process.env, ELECTRON_RUN_AS_NODE: "1" } });
  const json = JSON.parse(stdout.slice(stdout.indexOf("{")));
  // The raw archive parser emits `tyre`; the live app normalizes it to `comp`
  // before rows reach the component, so mirror that here for a faithful render.
  const rows = (json.rows || []).map((row) => ({
    pos: row.pos,
    code: row.code,
    number: row.number,
    last: row.last,
    best: row.best,
    gap: row.gap,
    interval: row.interval,
    comp: row.tyre || row.comp || "",
    age: row.age,
    sectors: row.sectors,
    telemetry: row.telemetry,
  }));
  return { rows, sessionClock: json.sessionClock || {}, lapCount: json.lapCount || {}, source: json.source };
}

function seedScript(snapshot) {
  const leader = snapshot.rows[0] || {};
  const pip = snapshot.rows[1] || leader;
  return `
    (() => {
      const D = window.PW_DATA;
      const snapshot = ${JSON.stringify(snapshot)};
      const rows = snapshot.rows;
      const lap = Number(snapshot.lapCount && snapshot.lapCount.lap) || 0;
      const laps = Number(snapshot.lapCount && snapshot.lapCount.laps) || 0;
      Object.assign(D, {
        timing: rows,
        race: { ...(D.race || {}), name: "Replay probe — " + (snapshot.source || "F1 archive"), lap, laps, weather: { air: "24.1", track: "31.0", rain: "0%" } },
        sessions: [{ kind: "Race", status: "live" }],
        source: "theater-replay-probe",
        sourceLabel: "Theater replay probe",
      });
      localStorage.clear();
      localStorage.setItem("pw-profile", JSON.stringify({ name: "Theater Probe", favoriteDrivers: ["${leader.code}"], favoriteTeams: [] }));
      localStorage.setItem("pw-settings", JSON.stringify({ defaultPreset: "Theater", telemetryDefault: true, videoQuality: "low" }));
      localStorage.setItem("pw-live-layout", JSON.stringify({ preset: "Theater", selected: "${leader.code}", panelSizes: { timingWidth: 340 } }));
      localStorage.setItem("pw-stream-sources", JSON.stringify({
        WORLD: "https://theater-probe.invalid/world.m3u8",
        ${leader.code ? `"${leader.code}": "https://theater-probe.invalid/leader.m3u8",` : ""}
        ${pip.code ? `"${pip.code}": "https://theater-probe.invalid/pip.m3u8"` : ""}
      }));
      window.pitwall = {
        profile: { get: async () => ({ name: "Theater Probe", favoriteDrivers: ["${leader.code}"], favoriteTeams: [] }), set: async () => true },
        windowState: { get: async () => ({ isFullScreen: true }), onChange: () => () => {} },
        ai: { authStatus: async () => ({ codexConnected: false }), ask: async () => ({ summary: "" }) },
        f1tv: { probeStatus: async () => ({ authenticated: true }), status: async () => ({ authenticated: true }) },
        data: {
          liveTiming: async () => ({ ok: true, timing: rows, weather: D.race.weather, sessionKind: "Race", sessionClock: snapshot.sessionClock }),
        },
      };
    })();
  `;
}

function harnessHtml(snapshot) {
  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <base href="${fileUrl("dist/pitwall/index.html")}">
  <link rel="stylesheet" href="${fileUrl("styles.css")}">
  <style>html, body, #root { margin: 0; width: 100%; height: 100%; overflow: hidden; background: #05070b; }</style>
</head>
<body>
  <div id="root"></div>
  <script src="${fileUrl("node_modules/react/umd/react.development.js")}"></script>
  <script src="${fileUrl("node_modules/react-dom/umd/react-dom.development.js")}"></script>
  <script src="${fileUrl("node_modules/hls.js/dist/hls.min.js")}"></script>
  <script src="${fileUrl("node_modules/shaka-player/dist/shaka-player.compiled.js")}"></script>
  <script src="${fileUrl("_ds_bundle.js")}"></script>
  <script src="${fileUrl("dist/pitwall/theme.js")}"></script>
  <script src="${fileUrl("dist/pitwall/data.js")}"></script>
  <script>${seedScript(snapshot)}</script>
  <script src="${fileUrl("dist/pitwall/sync.js")}"></script>
  <script src="${fileUrl("dist/pitwall/DataProvider.js")}"></script>
  <script src="${fileUrl("dist/pitwall/LiveRacing.js")}"></script>
  <script>
    ReactDOM.createRoot(document.getElementById("root")).render(
      React.createElement(window.PW.DataProvider, null, React.createElement(window.PW.LiveRacing, { onExit: function () {} }))
    );
  </script>
</body>
</html>`;
}

async function waitForTheater(win) {
  const deadline = Date.now() + 12000;
  while (Date.now() < deadline) {
    const ready = await win.webContents.executeJavaScript(`Boolean(document.querySelector(".live__grid[data-layout='theater'] .pane--bc"))`, true);
    if (ready) return;
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  throw new Error("Timed out waiting for the Theater grid");
}

async function inspect(win, leaderCode) {
  return await win.webContents.executeJavaScript(`(() => {
    const rect = (node) => { const r = node.getBoundingClientRect(); return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, width: r.width, height: r.height }; };
    const box = (sel) => { const n = document.querySelector(sel); return n ? rect(n) : null; };
    const text = (sel) => { const n = document.querySelector(sel); return n ? n.textContent.trim() : null; };
    const leaderCode = ${JSON.stringify(leaderCode)};
    const grid = box(".live__grid[data-layout='theater']");
    const world = box(".live__grid[data-layout='theater'] .pane--bc");
    const pip = box(".live__theater-pip");
    const pipInsideVideo = Boolean(document.querySelector(".pane--bc .pane__voverlay .live__theater-pip"));
    const ticker = box(".pane--bc .pane__ticker");
    const info = text(".live__theater-info");
    const lower3Name = text(".live__lower3-name");
    const lower3Meta = text(".live__lower3-meta");
    const timingText = text(".live__theater-timing");
    const timingRows = document.querySelectorAll(".live__theater-timing .timing-tower__row").length;
    const pencil = document.querySelector(".live__theater-timing .live__timingactions");
    const timingCard = box(".live__theater-timing");
    const failures = [];
    if (!grid || !world) failures.push("missing theater grid/world pane");
    if (world && grid && world.width < grid.width * 0.95) failures.push("world feed is not full-bleed (width " + Math.round(world.width) + " vs grid " + Math.round(grid.width) + ")");
    if (!pip) failures.push("onboard PiP is missing");
    if (!pipInsideVideo) failures.push("onboard PiP is not inside the broadcast video region (.pane__voverlay)");
    if (pip && grid) {
      if (pip.left < grid.left + grid.width * 0.45) failures.push("onboard PiP is not in the right half");
      if (pip.bottom < grid.top + grid.height * 0.45) failures.push("onboard PiP is not in the bottom half");
      const ratio = pip.height / pip.width;
      if (Math.abs(ratio - 9 / 16) > 0.04) failures.push("onboard PiP is not ~16:9 (ratio " + ratio.toFixed(3) + ")");
    }
    if (pip && ticker && pip.bottom > ticker.top + 1) failures.push("onboard PiP overlaps the broadcast ticker (not in the video region)");
    if (timingCard && grid) {
      if (timingCard.right < grid.right - grid.width * 0.5) failures.push("timing card is not in the right half");
      if (timingCard.top > grid.top + grid.height * 0.5) failures.push("timing card is not in the top half");
    }
    if (!info) failures.push("theater info card missing");
    else if (leaderCode && !info.includes(leaderCode)) failures.push("theater info missing leader code " + leaderCode + " (got: " + info + ")");
    if (!lower3Name) failures.push("lower-third name is empty");
    if (!lower3Meta) failures.push("lower-third meta is empty");
    if (timingText) {
      if (!/Last lap/i.test(timingText)) failures.push("compact timing missing Last lap column");
      if (!/Gap/i.test(timingText)) failures.push("compact timing missing Gap column");
      if (!/Interval/i.test(timingText)) failures.push("compact timing missing Interval column");
      if (/Best lap/i.test(timingText)) failures.push("compact timing should NOT show Best lap column");
    } else failures.push("floating timing card missing");
    if (pencil) failures.push("compact timing still renders the edit-columns (pencil) actions");
    if (timingRows < 1) failures.push("floating timing has no driver rows");
    if (document.documentElement.scrollWidth > ${viewport.width} + 2) failures.push("document has horizontal overflow");
    return { failures, data: { grid, world, pip, pipInsideVideo, ticker, info, lower3Name, lower3Meta, timingRows, hasPencil: Boolean(pencil) } };
  })()`, true);
}

async function run() {
  let snapshot;
  try {
    snapshot = fetchReplaySnapshot();
  } catch (error) {
    console.error("Failed to fetch real replay data:", error?.message || error);
    app.exit(2);
    return;
  }
  console.log(`Real replay snapshot: ${snapshot.rows.length} drivers, leader ${snapshot.rows[0]?.code} (${snapshot.rows[0]?.gap}), tyre ${snapshot.rows[0]?.comp}, source "${snapshot.source}"`);

  await app.whenReady();
  const harnessPath = path.join("/private/tmp", `apexline-theater-replay-${process.pid}.html`);
  fs.writeFileSync(harnessPath, harnessHtml(snapshot));
  const win = new BrowserWindow({
    width: viewport.width, height: viewport.height, show: false, backgroundColor: "#05070b",
    webPreferences: { contextIsolation: false, nodeIntegration: false, sandbox: false, webSecurity: false },
  });
  try {
    await win.loadFile(harnessPath);
    await waitForTheater(win);
    await new Promise((resolve) => setTimeout(resolve, 6000));
    const result = await inspect(win, snapshot.rows[0]?.code);
    fs.mkdirSync(outDir, { recursive: true });
    const shot = await win.webContents.capturePage();
    const screenshot = path.join(outDir, "theater-replay.png");
    fs.writeFileSync(screenshot, shot.toPNG());
    console.log(JSON.stringify({ ok: result.failures.length === 0, failures: result.failures, data: result.data, screenshot }, null, 2));
    app.exit(result.failures.length ? 1 : 0);
  } catch (error) {
    console.error(error?.stack || error?.message || String(error));
    app.exit(1);
  } finally {
    win.destroy();
    try { fs.unlinkSync(harnessPath); } catch {}
  }
}

run().catch((error) => {
  console.error(error?.stack || error?.message || String(error));
  app.exit(1);
});
