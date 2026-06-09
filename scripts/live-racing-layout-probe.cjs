const fs = require("node:fs");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { app, BrowserWindow } = require("electron");

const root = path.resolve(__dirname, "..");
const outDir = path.join("/private/tmp", `apexline-live-layout-probe-${Date.now()}`);

app.on("window-all-closed", (event) => event.preventDefault());

const viewports = [
  { name: "small-window", width: 900, height: 600 },
  { name: "air-13-effective", width: 1024, height: 640 },
  { name: "narrow-window", width: 1100, height: 700 },
  { name: "compact-breakpoint", width: 1180, height: 720 },
  { name: "air-13-roomy", width: 1280, height: 832 },
  { name: "laptop-1366", width: 1366, height: 768 },
  { name: "air-13-scaled", width: 1440, height: 900 },
  { name: "reported-air-fullscreen", width: 1470, height: 956 },
  { name: "pro-14-default", width: 1512, height: 982 },
  { name: "laptop-1536", width: 1536, height: 864 },
  { name: "large-desktop", width: 1728, height: 1117 },
  { name: "cleanshot-fullscreen", width: 1800, height: 1169 },
];

function fileUrl(...parts) {
  return pathToFileURL(path.join(root, ...parts)).href;
}

function seedScript() {
  return `
    (() => {
      const D = window.PW_DATA;
      const order = ["ANT", "HAM", "LEC", "HAD", "RUS", "PIA", "GAS", "NOR", "LAW", "ALB", "SAI", "COL", "LIN", "HUL", "OCO", "ALO", "STR", "PER", "BOR", "BEA", "BOT", "VER"];
      const rows = order.map((code, index) => ({
        pos: index + 1,
        code,
        last: index < 20 ? "1:" + String(16 + (index % 5)).padStart(2, "0") + "." + String(650 + index * 23).slice(0, 3) : "—",
        best: index < 20 ? "1:" + String(16 + (index % 4)).padStart(2, "0") + "." + String(50 + index * 37).padStart(3, "0").slice(0, 3) : "—",
        gap: index === 0 ? "LAP 31" : index > 18 ? "1 L" : "+" + (index * 4.813).toFixed(3),
        interval: index === 0 ? "LAP 31" : "+" + (0.532 + (index % 8) * 1.413).toFixed(3),
        comp: index % 4 === 0 ? "soft" : index % 3 === 0 ? "hard" : "medium",
        age: 21 + (index % 10),
        pits: index % 5 === 0 ? 2 : 1,
        sectors: {
          s1: Array.from({ length: 8 }, (_, i) => i % 5 === 0 ? "yellow" : "green"),
          s2: Array.from({ length: 8 }, (_, i) => i % 6 === 0 ? "purple" : "yellow"),
          s3: Array.from({ length: 8 }, (_, i) => i % 4 === 0 ? "green" : "neutral"),
        },
        telemetry: { speed: 286 - (index % 9), gear: 6 + (index % 2), throttle: 78, brake: index % 4 === 0 ? 12 : 0 },
      }));
      Object.assign(D, {
        timing: rows,
        standings: rows.map((row) => ({ pos: row.pos, code: row.code, pts: Math.max(1, 160 - row.pos * 6) })),
        race: { ...(D.race || {}), name: "Monaco Grand Prix", lap: 31, laps: 78, weather: { air: "24.1", track: "43.7", rain: "0%" } },
        sessions: [{ kind: "Race", status: "live" }],
        source: "layout-probe",
        sourceLabel: "Layout probe fixture",
      });
      localStorage.clear();
      localStorage.setItem("pw-profile", JSON.stringify({ name: "Layout Probe", favoriteDrivers: ["ANT", "HAM"], favoriteTeams: ["MER", "FER"] }));
      localStorage.setItem("pw-settings", JSON.stringify({ defaultPreset: "Intelligent", telemetryDefault: true, videoQuality: "low" }));
      localStorage.setItem("pw-live-layout", JSON.stringify({ preset: "Intelligent", selected: "ANT", panelSizes: { timingWidth: 340, focusOnboardHeight: 220, insightsHeight: 280 } }));
      localStorage.setItem("pw-live-panel-sizes", JSON.stringify({ timingWidth: 340, focusOnboardHeight: 220, insightsHeight: 280 }));
      localStorage.setItem("pw-stream-sources", JSON.stringify({
        WORLD: "https://layout-probe.invalid/world.m3u8",
        ANT: "https://layout-probe.invalid/ant.m3u8",
        HAM: "https://layout-probe.invalid/ham.m3u8",
        LEC: "https://layout-probe.invalid/lec.m3u8",
        HAD: "https://layout-probe.invalid/had.m3u8",
        RUS: "https://layout-probe.invalid/rus.m3u8"
      }));
      window.pitwall = {
        profile: { get: async () => ({ name: "Layout Probe", favoriteDrivers: ["ANT", "HAM"], favoriteTeams: ["MER", "FER"] }), set: async () => true },
        windowState: { get: async () => ({ isFullScreen: true }), onChange: () => () => {} },
        ai: { authStatus: async () => ({ codexConnected: true }), ask: async () => ({ summary: "" }) },
        f1tv: { probeStatus: async () => ({ authenticated: true }), status: async () => ({ authenticated: true }) },
        data: {
          liveTiming: async () => ({ ok: true, timing: rows, weather: D.race.weather, sessionKind: "Race", sessionClock: { lapCount: { lap: 31, laps: 78 }, remaining: "1:21:07", trackStatus: { status: "1", message: "All clear" } } }),
        },
      };
    })();
  `;
}

function harnessHtml() {
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
  <script>${seedScript()}</script>
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

function rectData(rect) {
  return { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom, width: rect.width, height: rect.height };
}

async function waitForLive(win) {
  const deadline = Date.now() + 9000;
  while (Date.now() < deadline) {
    const ready = await win.webContents.executeJavaScript(`Boolean(document.querySelector(".live__body .live__grid .pane--bc"))`, true);
    if (ready) return;
    await new Promise((resolve) => setTimeout(resolve, 120));
  }
  throw new Error("Timed out waiting for Live Racing grid");
}

async function inspect(win, viewport) {
  return await win.webContents.executeJavaScript(`(() => {
    const viewport = ${JSON.stringify(viewport)};
    const box = (selector) => {
      const node = document.querySelector(selector);
      return node ? ${rectData.toString()}(node.getBoundingClientRect()) : null;
    };
    const boxes = (selector) => Array.from(document.querySelectorAll(selector)).map((node) => ${rectData.toString()}(node.getBoundingClientRect()));
    const overlap = (a, b) => a && b && a.left < b.right - 1 && b.left < a.right - 1 && a.top < b.bottom - 1 && b.top < a.bottom - 1;
    const bar = box(".live__bar");
    const barParts = [box(".live__barleft"), box(".live__presets"), box(".live__barright")];
    const timingParts = [box(".live__timingtitle"), box(".live__timingclockgroup"), box(".live__timingactions")];
    const grid = box(".live__grid");
    const world = box(".pane--bc");
    const onboards = boxes(".live__grid[data-layout='focus'] .pane:not(.pane--bc)[data-visible='true']");
    const telemetryPanels = Array.from(document.querySelectorAll(".live__grid[data-layout='focus'] .pane:not(.pane--bc) .pane__tele-panel"));
    const video = document.querySelector(".live__grid[data-layout='focus'] .pane--bc .pane__video");
    const videoBox = video ? ${rectData.toString()}(video.getBoundingClientRect()) : null;
    const videoStyle = video ? getComputedStyle(video) : null;
    const ticker = document.querySelector(".pane--bc .pane__ticker");
    const tickerBox = ticker ? ${rectData.toString()}(ticker.getBoundingClientRect()) : null;
    const tickerUsesTop15 = Boolean(ticker && ticker.classList.contains("pane__ticker--top15"));
    const doc = document.documentElement;
    const failures = [];
    if (!bar || !grid || !world) failures.push("missing live bar/grid/world pane");
    if (doc.scrollWidth > viewport.width + 2) failures.push("document has horizontal overflow");
    if (doc.scrollHeight > viewport.height + 2) failures.push("document has vertical overflow");
    barParts.forEach((part, index) => {
      if (!part) failures.push("missing top bar segment " + index);
      else if (part.left < bar.left - 1 || part.right > bar.right + 1) failures.push("top bar segment " + index + " escapes bar");
    });
    for (let i = 0; i < barParts.length; i += 1) {
      for (let j = i + 1; j < barParts.length; j += 1) {
        if (overlap(barParts[i], barParts[j])) failures.push("top bar segments overlap");
      }
    }
    for (let i = 0; i < timingParts.length; i += 1) {
      for (let j = i + 1; j < timingParts.length; j += 1) {
        if (overlap(timingParts[i], timingParts[j])) failures.push("timing header segments overlap");
      }
    }
    if (world && world.height < 300) failures.push("F1 Live pane is too short");
    if (world && grid && (world.left < grid.left - 1 || world.right > grid.right + 1 || world.bottom > grid.bottom + 1)) failures.push("F1 Live pane escapes grid");
    if (world && videoBox && viewport.width > 1180) {
      const targetVideoHeight = Math.min(world.width * 9 / 16, Math.max(0, world.height - 40));
      if (videoBox.height < targetVideoHeight * 0.9) failures.push("F1 Live video area is squeezed by lower ticker");
      if (tickerUsesTop15 && videoBox.height < targetVideoHeight * 0.9) failures.push("F1 Live ticker uses three rows while video is squeezed");
    }
    if (onboards.length < 3) failures.push("fewer than three onboard panes are visible");
    onboards.forEach((pane, index) => {
      if (pane.width < 120 || pane.height < 100) failures.push("onboard pane " + index + " is too small");
      if (grid && (pane.left < grid.left - 1 || pane.right > grid.right + 1 || pane.top < grid.top - 1 || pane.bottom > grid.bottom + 1)) failures.push("onboard pane " + index + " escapes grid");
    });
    telemetryPanels.forEach((panel, index) => {
      const panelBox = ${rectData.toString()}(panel.getBoundingClientRect());
      const pane = panel.closest(".pane");
      const paneBox = pane ? ${rectData.toString()}(pane.getBoundingClientRect()) : null;
      if (panel.scrollWidth > panel.clientWidth + 2) failures.push("onboard telemetry panel " + index + " scrolls horizontally");
      if (paneBox && paneBox.width <= 260 && panelBox.height > 24) failures.push("tiny onboard telemetry panel " + index + " is too tall");
      if (paneBox && paneBox.width <= 340 && panelBox.height > 28) failures.push("compact onboard telemetry panel " + index + " is too tall");
      const children = Array.from(panel.children).map((child) => ${rectData.toString()}(child.getBoundingClientRect()));
      const childRight = children.reduce((right, childBox) => Math.max(right, childBox.right), panelBox.left);
      if (paneBox && paneBox.width >= 360 && childRight < panelBox.right - 10) failures.push("roomy onboard telemetry content " + index + " leaves a blank tail");
      if (paneBox && paneBox.width >= 360 && (panelBox.left < paneBox.left + 7 || panelBox.right > paneBox.right - 7)) failures.push("roomy onboard telemetry panel " + index + " is too close to pane edge");
      if (paneBox && paneBox.width >= 360 && Math.abs((panelBox.left - paneBox.left) - (paneBox.right - panelBox.right)) > 12) failures.push("roomy onboard telemetry panel " + index + " is not centered");
      const gapSegment = panel.querySelector(".pane__tele-seg--gaps");
      const gapStack = gapSegment?.querySelector(".pane__tele-stack");
      const gapBox = gapSegment ? ${rectData.toString()}(gapSegment.getBoundingClientRect()) : null;
      const gapStackBox = gapStack ? ${rectData.toString()}(gapStack.getBoundingClientRect()) : null;
      const sectorTickGaps = Array.from(panel.querySelectorAll(".pane__tele-seg--sectors .mini-sector")).flatMap((sector) => {
        const ticks = Array.from(sector.querySelectorAll(".mini-sector__seg"))
          .filter((tick) => tick.offsetWidth > 0 && tick.offsetHeight > 0)
          .map((tick) => ${rectData.toString()}(tick.getBoundingClientRect()));
        return ticks.slice(1).map((tick, tickIndex) => tick.left - ticks[tickIndex].right);
      });
      const sectorBand = panel.querySelector(".pane__tele-seg--sectors");
      const sectorBandBox = sectorBand ? ${rectData.toString()}(sectorBand.getBoundingClientRect()) : null;
      const visibleSectorTicks = sectorBand ? Array.from(sectorBand.querySelectorAll(".mini-sector__seg")).filter((tick) => tick.offsetWidth > 0 && tick.offsetHeight > 0) : [];
      const firstSectorTick = visibleSectorTicks[0];
      const lastSectorTick = visibleSectorTicks[visibleSectorTicks.length - 1];
      const firstSectorTickBox = firstSectorTick ? ${rectData.toString()}(firstSectorTick.getBoundingClientRect()) : null;
      const lastSectorTickBox = lastSectorTick ? ${rectData.toString()}(lastSectorTick.getBoundingClientRect()) : null;
      const maxSectorTickGap = sectorTickGaps.reduce((max, gap) => Math.max(max, gap), 0);
      if (paneBox && paneBox.width >= 360 && panelBox.height < 36) failures.push("roomy onboard telemetry panel " + index + " is visually too small");
      if (paneBox && paneBox.width >= 360 && panelBox.height > 40) failures.push("roomy onboard telemetry panel " + index + " is too large");
      if (paneBox && paneBox.width >= 360 && gapBox && gapStackBox && gapBox.width > gapStackBox.width * 1.55) failures.push("roomy onboard telemetry gap segment " + index + " has excessive side space");
      if (paneBox && paneBox.width >= 360 && maxSectorTickGap > 5) failures.push("roomy onboard telemetry mini-sector ticks " + index + " are too spread out");
      if (paneBox && paneBox.width >= 360 && sectorBandBox && firstSectorTickBox && firstSectorTickBox.left - sectorBandBox.left > 8) failures.push("roomy onboard telemetry mini-sector band " + index + " has excessive left space");
      if (paneBox && paneBox.width >= 360 && sectorBandBox && lastSectorTickBox && sectorBandBox.right - lastSectorTickBox.right > 8) failures.push("roomy onboard telemetry mini-sector band " + index + " has excessive right space");
      Array.from(panel.children).forEach((child) => {
        const childBox = ${rectData.toString()}(child.getBoundingClientRect());
        if (childBox.left < panelBox.left - 1 || childBox.right > panelBox.right + 1) failures.push("onboard telemetry child escapes panel " + index + ": " + child.className);
      });
    });
    if (viewport.width <= 1180 && videoStyle && videoStyle.objectFit !== "contain") failures.push("compact F1 Live video is not using contain");
    const visibleTextNodes = Array.from(document.querySelectorAll(".live__bar, .live__barleft, .live__presets, .live__barright, .live__timinghd, .live__weather, .pane__ticker, .pane__ticker .tick, .pane__replaybar"))
      .filter((node) => node.offsetWidth > 0 && node.offsetHeight > 0);
    visibleTextNodes.forEach((node) => {
      if (node.scrollWidth > node.clientWidth + 2 && !node.closest(".live__timingscroll")) failures.push("visible element overflows horizontally: " + node.className);
    });
    return {
      name: viewport.name,
      viewport,
      failures,
      metrics: {
        grid,
        world,
        onboards,
        telemetryPanels: telemetryPanels.map((panel) => ({
          box: ${rectData.toString()}(panel.getBoundingClientRect()),
          scrollWidth: panel.scrollWidth,
          clientWidth: panel.clientWidth,
          gap: (() => {
            const segment = panel.querySelector(".pane__tele-seg--gaps");
            const stack = segment?.querySelector(".pane__tele-stack");
            return {
              segment: segment ? ${rectData.toString()}(segment.getBoundingClientRect()) : null,
              stack: stack ? ${rectData.toString()}(stack.getBoundingClientRect()) : null,
            };
          })(),
        })),
        video: videoBox,
        ticker: tickerBox,
        tickerUsesTop15,
        objectFit: videoStyle ? videoStyle.objectFit : "",
        document: { width: doc.scrollWidth, height: doc.scrollHeight },
      },
    };
  })()`, true);
}

async function probeViewport(viewport, harnessPath) {
  const win = new BrowserWindow({
    width: viewport.width,
    height: viewport.height,
    show: false,
    backgroundColor: "#05070b",
    webPreferences: {
      contextIsolation: false,
      nodeIntegration: false,
      sandbox: false,
      webSecurity: false,
    },
  });
  try {
    await win.loadFile(harnessPath);
    await waitForLive(win);
    await new Promise((resolve) => setTimeout(resolve, 7200));
    const result = await inspect(win, viewport);
    const shot = await win.webContents.capturePage();
    fs.mkdirSync(outDir, { recursive: true });
    const screenshot = path.join(outDir, `${viewport.name}.png`);
    fs.writeFileSync(screenshot, shot.toPNG());
    return { ...result, screenshot };
  } finally {
    win.destroy();
    await new Promise((resolve) => setTimeout(resolve, 120));
  }
}

async function run() {
  await app.whenReady();
  const harnessPath = path.join("/private/tmp", `apexline-live-layout-probe-${process.pid}.html`);
  fs.writeFileSync(harnessPath, harnessHtml());
  try {
    const results = [];
    for (const viewport of viewports) {
      results.push(await probeViewport(viewport, harnessPath));
    }
    const failed = results.filter((result) => result.failures.length);
    console.log(JSON.stringify({
      ok: failed.length === 0,
      screenshots: outDir,
      results: results.map((result) => ({
        name: result.name,
        viewport: result.viewport,
        failures: result.failures,
        metrics: result.metrics,
        screenshot: result.screenshot,
      })),
    }, null, 2));
    app.exit(failed.length ? 1 : 0);
  } finally {
    try { fs.unlinkSync(harnessPath); } catch {}
  }
}

run().catch((error) => {
  console.error(error?.stack || error?.message || String(error));
  app.exit(1);
});
