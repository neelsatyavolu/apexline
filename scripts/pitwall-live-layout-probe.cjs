const path = require("node:path");
const fs = require("node:fs");
const os = require("node:os");
const { pathToFileURL } = require("node:url");
const { app, BrowserWindow } = require("electron");

const root = path.resolve(__dirname, "..");

function fileUrl(...parts) {
  return pathToFileURL(path.join(root, ...parts)).href;
}

function timingRows() {
  const codes = ["ANT", "VER", "HAM", "LEC", "HAD", "RUS", "PIA", "NOR", "GAS", "LAW"];
  const compounds = ["medium", "hard", "hard", "medium", "soft", "medium", "hard", "soft", "medium", "hard"];
  return codes.map((code, index) => ({
    pos: index + 1,
    code,
    gap: index === 0 ? "LAP 1" : "—",
    interval: index === 0 ? "LAP 1" : `+${(index * 1.137).toFixed(3)}`,
    comp: compounds[index],
    age: 8 + index,
  }));
}

function harnessHtml() {
  const rowsJson = JSON.stringify(timingRows());
  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <link rel="stylesheet" href="${fileUrl("styles.css")}">
  <style>html, body, #root { margin: 0; width: 100%; height: 100%; background: #05070b; overflow: hidden; }</style>
</head>
<body>
  <div id="root"></div>
  <script src="${fileUrl("node_modules/react/umd/react.development.js")}"></script>
  <script src="${fileUrl("node_modules/react-dom/umd/react-dom.development.js")}"></script>
  <script src="${fileUrl("node_modules/hls.js/dist/hls.min.js")}"></script>
  <script src="${fileUrl("node_modules/shaka-player/dist/shaka-player.compiled.js")}"></script>
  <script src="${fileUrl("_ds_bundle.js")}"></script>
  <script src="${fileUrl("dist/pitwall/data.js")}"></script>
  <script>
    window.PW_DATA.timing = ${rowsJson};
    window.PW_DATA.race = { name: "Layout Probe GP", lap: 1, laps: 58, weather: {} };
    window.PW_DATA.sessions = [{ status: "live", kind: "Race" }];
    window.PW_DATA.presets = ["Intelligent"];
    window.PW_DATA.sourceLabel = "Layout probe";
  </script>
  <script src="${fileUrl("dist/pitwall/sync.js")}"></script>
  <script src="${fileUrl("dist/pitwall/DataProvider.js")}"></script>
  <script src="${fileUrl("dist/pitwall/LiveRacing.js")}"></script>
  <script>
    localStorage.setItem("pw-live-layout", JSON.stringify({ preset: "Intelligent" }));
    localStorage.setItem("pw-stream-sources", JSON.stringify({ WORLD: "https://example.invalid/pitwall-layout-probe.m3u8" }));
    ReactDOM.createRoot(document.getElementById("root")).render(
      React.createElement(window.PW.DataProvider, null, React.createElement(window.PW.LiveRacing, { onExit: function () {} }))
    );
  </script>
</body>
</html>`;
}

function rectData(el) {
  const rect = el.getBoundingClientRect();
  return {
    top: rect.top,
    bottom: rect.bottom,
    height: rect.height,
    left: rect.left,
    right: rect.right,
    width: rect.width,
  };
}

async function waitForLayout(win) {
  const deadline = Date.now() + 6000;
  let last = {};
  while (Date.now() < deadline) {
    last = await win.webContents.executeJavaScript(`
      ({
        bodyText: document.body.innerText.slice(0, 240),
        live: Boolean(document.querySelector(".live")),
        pane: Boolean(document.querySelector(".pane--bc")),
        top10: Boolean(document.querySelector(".pane--bc .pane__ticker--top10")),
        tickCount: document.querySelectorAll(".pane--bc .tick").length,
        timingRows: window.PW_DATA?.timing?.length || 0,
        errors: Array.from(document.querySelectorAll(".startup-load__error")).map((node) => node.textContent.trim())
      })
    `, true);
    if (last.top10 && last.tickCount === 10) return;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Timed out waiting for top-10 broadcast ticker: ${JSON.stringify(last)}`);
}

async function run() {
  await app.whenReady();
  const harnessPath = path.join(os.tmpdir(), `pitwall-live-layout-probe-${Date.now()}.html`);
  fs.writeFileSync(harnessPath, harnessHtml());
  const win = new BrowserWindow({
    width: 1800,
    height: 1000,
    show: false,
    backgroundColor: "#05070b",
    webPreferences: {
      contextIsolation: false,
      nodeIntegration: false,
      sandbox: false,
    },
  });
  try {
    await win.loadFile(harnessPath);
    await waitForLayout(win);
    const result = await win.webContents.executeJavaScript(`(() => {
      const pane = document.querySelector(".pane--bc");
      const video = pane.querySelector(".pane__video");
      const ticker = pane.querySelector(".pane__ticker");
      video.setAttribute("data-ready", "true");
      video.style.transition = "none";
      video.style.transform = "scale(1)";
      let replay = pane.querySelector(".pane__replaybar");
      if (!replay) {
        replay = document.createElement("div");
        replay.className = "pane__replaybar";
        replay.style.opacity = "1";
        replay.innerHTML = "<span></span><span></span><span></span>";
        pane.appendChild(replay);
      }
      const ticks = Array.from(pane.querySelectorAll(".tick"));
      const bars = Array.from(pane.querySelectorAll(".tick__bar"));
      const tyreChips = Array.from(pane.querySelectorAll(".tick__tyre"));
      const styles = getComputedStyle(pane);
      const data = {
        pane: (${rectData.toString()})(pane),
        video: (${rectData.toString()})(video),
        ticker: (${rectData.toString()})(ticker),
        replay: (${rectData.toString()})(replay),
        tickHeights: ticks.map((node) => Math.round(node.getBoundingClientRect().height)),
        barHeights: bars.map((node) => Math.round(node.getBoundingClientRect().height)),
        tyreChipCount: tyreChips.length,
        tyreChipTexts: tyreChips.map((node) => node.textContent.trim()),
        tickerTotalHeight: Number.parseFloat(styles.getPropertyValue("--ticker-total-h")),
        tickerRowHeight: Number.parseFloat(styles.getPropertyValue("--ticker-row-h")),
        tickerCodeSize: Number.parseFloat(styles.getPropertyValue("--ticker-code-size")),
      };
      data.videoTouchesTicker = Math.abs(data.video.bottom - data.ticker.top) <= 1;
      data.tickerBelowVideo = data.ticker.top >= data.video.bottom - 1;
      data.replayAboveTicker = data.replay.bottom <= data.ticker.top + 1;
      data.equalTickHeights = new Set(data.tickHeights).size === 1;
      data.teamBarsVisible = data.barHeights.every((height) => height >= 18);
      data.tyreChipsVisible = data.tyreChipCount === 10 && data.tyreChipTexts.every(Boolean);
      return data;
    })()`, true);
    const failures = [];
    if (!result.videoTouchesTicker || !result.tickerBelowVideo) failures.push("ticker overlaps or detaches from video");
    if (!result.replayAboveTicker) failures.push("replay bar overlaps ticker");
    if (!result.equalTickHeights) failures.push("ticker cells are not equal height");
    if (!result.teamBarsVisible) failures.push("team color bars are not visible");
    if (!result.tyreChipsVisible) failures.push("tyre chips are not visible for timing rows with tyre data");
    console.log(JSON.stringify({ pitwallLiveLayoutProbe: result, failures }, null, 2));
    app.exit(failures.length ? 2 : 0);
  } catch (error) {
    console.error(error?.stack || error?.message || String(error));
    app.exit(1);
  } finally {
    win.destroy();
    try { fs.unlinkSync(harnessPath); } catch {}
  }
}

run();
