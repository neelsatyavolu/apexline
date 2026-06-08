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
    last: index === 0 ? "1:12.704" : `1:13.${String(90 + index).padStart(3, "0")}`,
    best: index === 0 ? "1:12.704" : `1:13.${String(20 + index).padStart(3, "0")}`,
    gap: index === 0 ? "LAP 1" : "—",
    interval: index === 0 ? "LAP 1" : `+${(index * 1.137).toFixed(3)}`,
    comp: compounds[index],
    age: 8 + index,
    sectors: {
      s1: ["green", "yellow", index === 0 ? "purple" : "yellow"],
      s2: ["yellow", "green", "yellow"],
      s3: ["yellow", "yellow"],
    },
    telemetry: { speed: 180 + index, gear: 5, throttle: 80, brake: 0 },
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
  <script src="${fileUrl("dist/pitwall/theme.js")}"></script>
  <script src="${fileUrl("dist/pitwall/data.js")}"></script>
  <script>
    const probeTimingRows = ${rowsJson};
    window.PW_DATA.timing = [];
    window.PW_DATA.race = { name: "Layout Probe GP", lap: 1, laps: 58, weather: {} };
    window.PW_DATA.sessions = [{ status: "live", kind: "Race" }];
    window.PW_DATA.presets = ["Intelligent"];
    window.PW_DATA.sourceLabel = "Layout probe";
    window.pitwall = {
      data: {
        liveTiming: async () => ({
          ok: true,
          sourceLabel: "Probe live timing",
          timing: probeTimingRows,
          weather: { air: 23.2, track: 34.2, cond: "Dry" },
          sessionClock: { status: "Started", trackStatus: { status: "1", message: "AllClear" }, lapCount: { lap: 1, laps: 58 } },
        }),
      },
      f1tv: {
        drmStatus: async () => ({ widevine: true }),
        probeStatus: async () => ({ authenticated: true }),
        status: async () => ({ authenticated: true }),
      },
      profile: { get: async () => ({}), set: async () => true },
      debug: { log: () => {} },
    };
  </script>
  <script src="${fileUrl("dist/pitwall/sync.js")}"></script>
  <script src="${fileUrl("dist/pitwall/social.js")}"></script>
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
        timingTowerRows: document.querySelectorAll(".timing-tower__row").length,
        tyreDots: document.querySelectorAll(".timing-tower__row .tyre-dot").length,
        purpleMiniSectors: document.querySelectorAll(".timing-tower__row .mini-sector__seg[data-tone='purple']").length,
        timingButtons: Array.from(document.querySelectorAll("button")).filter((node) => /ANT|VER|HAM/.test(node.textContent || "")).length,
        timingHtml: (document.querySelector(".live__timingscroll")?.innerHTML || document.querySelector(".live__timing")?.innerHTML || "").slice(0, 800),
        timingRows: window.PW_DATA?.timing?.length || 0,
        errors: Array.from(document.querySelectorAll(".startup-load__error")).map((node) => node.textContent.trim())
      })
    `, true);
    if (last.live && last.timingTowerRows >= 10 && last.tyreDots >= 10 && last.purpleMiniSectors >= 1) return;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Timed out waiting for rich Live Racing timing rows: ${JSON.stringify(last)}`);
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
  const rendererMessages = [];
  win.webContents.on("console-message", (_event, level, message, line, sourceId) => {
    rendererMessages.push({ level, message, line, sourceId });
  });
  win.webContents.on("render-process-gone", (_event, details) => {
    rendererMessages.push({ level: "gone", message: JSON.stringify(details) });
  });
  try {
    await win.loadFile(harnessPath);
    await waitForLayout(win);
    const result = await win.webContents.executeJavaScript(`(() => {
      const tower = document.querySelector(".timing-tower");
      const rows = Array.from(document.querySelectorAll(".timing-tower__row"));
      const tyreDots = Array.from(document.querySelectorAll(".timing-tower__row .tyre-dot"));
      const purpleMiniSectors = Array.from(document.querySelectorAll(".timing-tower__row .mini-sector__seg[data-tone='purple']"));
      const bodyText = document.body.textContent.replace(/\\s+/g, " ").trim();
      const data = {
        tower: (${rectData.toString()})(tower),
        timingRowCount: rows.length,
        rowTexts: rows.slice(0, 5).map((node) => node.textContent.replace(/\\s+/g, " ").trim()),
        tyreDotCount: tyreDots.length,
        tyreDotTexts: tyreDots.map((node) => node.textContent.trim()).filter(Boolean).slice(0, 10),
        purpleMiniSectorCount: purpleMiniSectors.length,
        bodyHasFastestLap: bodyText.includes("1:12.704"),
        bodyHasLeader: bodyText.includes("ANT"),
      };
      return data;
    })()`, true);
    const failures = [];
    if (result.timingRowCount < 10) failures.push("timing tower did not render the seeded rows");
    if (!result.bodyHasLeader || !result.bodyHasFastestLap) failures.push("timing tower did not render rich lap text");
    if (result.tyreDotCount < 10 || result.tyreDotTexts.length < 10) failures.push("timing tower did not render tyre compounds");
    if (result.purpleMiniSectorCount < 1) failures.push("timing tower did not render mini-sector tones");
    console.log(JSON.stringify({ pitwallLiveLayoutProbe: result, failures }, null, 2));
    app.exit(failures.length ? 2 : 0);
  } catch (error) {
    if (rendererMessages.length) console.error(JSON.stringify({ rendererMessages: rendererMessages.slice(-12) }, null, 2));
    console.error(error?.stack || error?.message || String(error));
    app.exit(1);
  } finally {
    win.destroy();
    try { fs.unlinkSync(harnessPath); } catch {}
  }
}

run();
