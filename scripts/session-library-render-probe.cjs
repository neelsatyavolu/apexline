const fs = require("node:fs");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { app, BrowserWindow } = require("electron");

const root = path.resolve(__dirname, "..");
const outDir = path.join("/private/tmp", `apexline-session-library-probe-${Date.now()}`);

app.on("window-all-closed", (event) => event.preventDefault());

const viewports = [
  { name: "desktop-wide", width: 1800, height: 900 },
  { name: "compact", width: 1100, height: 700 },
];

function fileUrl(...parts) {
  return pathToFileURL(path.join(root, ...parts)).href;
}

function seedScript() {
  return `
    (() => {
      const rows = ["VER", "NOR", "PIA", "LEC", "RUS", "HAM", "ANT", "ALO"].map((code, index) => ({
        pos: index + 1,
        code,
        last: "1:18." + String(120 + index * 17).padStart(3, "0"),
        best: "1:17." + String(940 + index * 11).slice(0, 3),
        gap: index ? "+" + (index * 2.41).toFixed(3) : "LAP 12",
        interval: index ? "+" + (0.48 + index * 0.2).toFixed(3) : "LAP 12",
      }));
      const library = {
        source: "probe",
        season: "2026",
        races: [{
          rnd: 7,
          name: "Barcelona Grand Prix",
          circuit: "Catalunya",
          loc: "Barcelona, Spain",
          date: "Jun 14",
          startsAt: "2026-06-14T13:00:00.000Z",
          status: "upcoming",
          meetingKey: "1287",
          sessions: [
            { kind: "Practice 1", day: "Fri", time: "04:30 AM", startsAt: "2026-06-12T11:30:00.000Z", endsAt: "2026-06-12T12:30:00.000Z", status: "done", statusSource: "f1tv-cms", contentSubtype: "REPLAY", sessionKey: "11300", contentId: "fp1" },
            { kind: "Practice 2", day: "Fri", time: "08:00 AM", startsAt: "2026-06-12T15:00:00.000Z", endsAt: "2026-06-12T16:00:00.000Z", status: "done", statusSource: "f1tv-cms", contentSubtype: "REPLAY", sessionKey: "11301", contentId: "fp2" },
            { kind: "Practice 3", day: "Sat", time: "03:30 AM", startsAt: "2026-06-13T10:30:00.000Z", endsAt: "2026-06-13T11:30:00.000Z", status: "upcoming", sessionKey: "11302" },
            { kind: "Qualifying", day: "Sat", time: "07:00 AM", startsAt: "2026-06-13T14:00:00.000Z", endsAt: "2026-06-13T15:00:00.000Z", status: "upcoming", sessionKey: "11303" },
            { kind: "Race", day: "Sun", time: "06:00 AM", startsAt: "2026-06-14T13:00:00.000Z", endsAt: "2026-06-14T15:00:00.000Z", status: "upcoming", sessionKey: "11307" },
          ],
        }],
      };
      Object.assign(window.PW_DATA, {
        seasonSummary: { season: "2026" },
        timing: rows,
        race: { name: "Barcelona Grand Prix", lap: 12, laps: 66, weather: { air: "24.1", track: "38.4", rain: "0%" } },
        sessions: library.races[0].sessions,
        source: "render-probe",
        sourceLabel: "Render probe fixture",
      });
      localStorage.clear();
      localStorage.setItem("pw-settings", JSON.stringify({ defaultPreset: "Intelligent", telemetryDefault: true, videoQuality: "low" }));
      window.pitwall = {
        profile: { get: async () => ({ name: "Probe", favoriteDrivers: [], favoriteTeams: [] }), set: async () => true },
        windowState: { get: async () => ({ isFullScreen: true }), onChange: () => () => {} },
        ai: { authStatus: async () => ({ codexConnected: false }), ask: async () => ({ summary: "" }) },
        f1tv: {
          library: async () => {
            await new Promise((resolve) => setTimeout(resolve, 45));
            return library;
          },
          probeStatus: async () => ({ authenticated: true }),
          status: async () => ({ authenticated: true }),
        },
        data: {
          liveTiming: async () => ({ ok: true, timing: rows, weather: window.PW_DATA.race.weather, sessionKind: "Practice 2" }),
          replayTimingAvailability: async (options) => {
            await new Promise((resolve) => setTimeout(resolve, options.sessionKind === "Practice 2" ? 90 : 35));
            if (options.sessionKind === "Practice 1") return { status: "ready", label: "Timing ready", message: "Synced replay live timing is available." };
            if (options.sessionKind === "Practice 2") return { status: "generating", label: "Generating", message: "Replay live timing is being generated." };
            return { status: "unavailable", label: "No timing", message: "Replay live timing is not available yet." };
          },
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
  <script src="${fileUrl("dist/pitwall/trackmap-circuits.js")}"></script>
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

async function waitFor(win, expression, timeoutMs = 7000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await win.webContents.executeJavaScript(expression, true)) return;
    await new Promise((resolve) => setTimeout(resolve, 80));
  }
  throw new Error(`Timed out waiting for ${expression}`);
}

async function inspect(win, viewport) {
  return await win.webContents.executeJavaScript(`(() => {
    const rect = (node) => {
      const r = node.getBoundingClientRect();
      return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, width: r.width, height: r.height };
    };
    const failures = [];
    const scope = document.querySelector(".session-library:not(.session-library--inline)") || document.querySelector(".session-library--inline") || document;
    const panel = scope.querySelector(".session-library__panel");
    const rows = Array.from(scope.querySelectorAll(".session-library__row"));
    const badges = Array.from(scope.querySelectorAll(".replay-timing-badge"));
    if (!panel) failures.push("missing session library panel");
    if (rows.length !== 5) failures.push("expected 5 session rows, saw " + rows.length);
    if (!badges.some((badge) => badge.dataset.status === "ready")) failures.push("missing ready timing badge");
    if (!badges.some((badge) => badge.dataset.status === "generating")) failures.push("missing generating timing badge");
    if (scope.innerText.includes("Live now")) failures.push("session library incorrectly shows a live session");
    if (!scope.innerText.includes("Not started")) failures.push("future sessions should render disabled not-started buttons");
    const panelBox = panel ? rect(panel) : null;
    if (panelBox && (panelBox.left < -1 || panelBox.right > ${viewport.width} + 1 || panelBox.top < -1 || panelBox.bottom > ${viewport.height} + 1)) failures.push("panel escapes viewport");
    [...rows, ...badges, ...scope.querySelectorAll(".session-library__head, .slr-cell__btn .pw-btn")].forEach((node) => {
      if (node.scrollWidth > node.clientWidth + 2) failures.push("horizontal text overflow: " + node.className);
    });
    return {
      failures,
      metrics: {
        panel: panelBox,
        rows: rows.map((row) => ({ text: row.innerText.replace(/\\s+/g, " ").trim(), box: rect(row) })),
        badges: badges.map((badge) => ({ text: badge.innerText.replace(/\\s+/g, " ").trim(), status: badge.dataset.status, box: rect(badge) })),
        document: { width: document.documentElement.scrollWidth, height: document.documentElement.scrollHeight },
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
    win.webContents.on("console-message", (_event, _level, message) => {
      if (/error|exception|warning/i.test(String(message))) console.error(`[renderer:${viewport.name}] ${message}`);
    });
    const startedAt = Date.now();
    await win.loadFile(harnessPath, { query: { f1Race: "Barcelona" } });
    await waitFor(win, `Array.from(document.querySelectorAll("button")).some((button) => /Load past session/.test(button.textContent))`);
    await win.webContents.executeJavaScript(`Array.from(document.querySelectorAll("button")).find((button) => /Load past session/.test(button.textContent)).click()`, true);
    try {
      await waitFor(win, `document.querySelectorAll(".session-library:not(.session-library--inline) .session-library__row").length === 5`);
    } catch (error) {
      const debug = await win.webContents.executeJavaScript(`(() => ({
        hasLibrary: Boolean(document.querySelector(".session-library")),
        rowCount: document.querySelectorAll(".session-library:not(.session-library--inline) .session-library__row").length,
        bodyText: document.body.innerText.slice(0, 1200),
        buttons: Array.from(document.querySelectorAll("button")).map((button) => button.innerText.trim()).filter(Boolean).slice(0, 20),
      }))()`, true);
      fs.mkdirSync(outDir, { recursive: true });
      const shot = await win.webContents.capturePage();
      fs.writeFileSync(path.join(outDir, `${viewport.name}-failure.png`), shot.toPNG());
      error.message += `; debug=${JSON.stringify(debug)}`;
      throw error;
    }
    await waitFor(win, `Array.from(document.querySelectorAll(".session-library:not(.session-library--inline) .replay-timing-badge")).some((badge) => badge.dataset.status === "ready") && Array.from(document.querySelectorAll(".session-library:not(.session-library--inline) .replay-timing-badge")).some((badge) => badge.dataset.status === "generating")`);
    const result = await inspect(win, viewport);
    const shot = await win.webContents.capturePage();
    fs.mkdirSync(outDir, { recursive: true });
    const screenshot = path.join(outDir, `${viewport.name}.png`);
    fs.writeFileSync(screenshot, shot.toPNG());
    return { name: viewport.name, viewport, elapsedMs: Date.now() - startedAt, screenshot, ...result };
  } finally {
    win.destroy();
    await new Promise((resolve) => setTimeout(resolve, 80));
  }
}

async function run() {
  await app.whenReady();
  const harnessPath = path.join("/private/tmp", `apexline-session-library-render-probe-${process.pid}.html`);
  fs.writeFileSync(harnessPath, harnessHtml());
  try {
    const results = [];
    for (const viewport of viewports) results.push(await probeViewport(viewport, harnessPath));
    const failed = results.filter((result) => result.failures.length);
    console.log(JSON.stringify({
      ok: failed.length === 0,
      screenshots: outDir,
      results,
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
