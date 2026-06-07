const { app, BrowserWindow, ipcMain, shell, session, Notification, components } = require("electron");
const { execFile } = require("node:child_process");
const { createHash, randomBytes } = require("node:crypto");
const fs = require("node:fs");
const http = require("node:http");
const https = require("node:https");
const os = require("node:os");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const vm = require("node:vm");
const zlib = require("node:zlib");

const MIME = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".jsx": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
};

function contentType(filePath) {
  return MIME[path.extname(filePath).toLowerCase()] || "application/octet-stream";
}

function safeResolve(root, requestPath) {
  const urlPath = decodeURIComponent(requestPath.split("?")[0]);
  const relativePath = urlPath === "/" ? "ui_kits/pitwall/index.html" : urlPath.replace(/^\/+/, "");
  const absolutePath = path.resolve(root, relativePath);
  return absolutePath.startsWith(root + path.sep) || absolutePath === root ? absolutePath : null;
}

function startStaticServer(root) {
  const server = http.createServer((req, res) => {
    const filePath = safeResolve(root, req.url || "/");
    if (!filePath) {
      res.writeHead(403);
      res.end("Forbidden");
      return;
    }

    fs.readFile(filePath, (error, body) => {
      if (error) {
        res.writeHead(error.code === "ENOENT" ? 404 : 500);
        res.end(error.code === "ENOENT" ? "Not found" : "Server error");
        return;
      }

      res.writeHead(200, {
        "Content-Type": contentType(filePath),
        "Cache-Control": "no-store",
      });
      res.end(body);
    });
  });

  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      resolve({ server, url: `http://127.0.0.1:${address.port}` });
    });
  });
}

let staticServer;
let diagnosticWindowRunActive = false;
app.setName("PitWall");
const PITWALL_USER_DATA = path.join(app.getPath("appData"), "PitWall");
app.setPath("userData", PITWALL_USER_DATA);

const KEYCHAIN_SERVICE = "PitWall";
const KEY_PROVIDERS = new Set(["anthropic", "openai", "codex", "grok", "f1tv-email", "f1tv-token"]);
const DEFAULT_USER_PROFILE = { name: "", favoriteDrivers: [], favoriteTeams: [] };
const PROFILE_FILE = "pitwall-profile.json";
const COPILOT_INSIGHTS_FILE = "pitwall-copilot-insights.json";
const COPILOT_INSIGHTS_SCHEMA_VERSION = 3;
const DEBUG_LOG_FILE = "pitwall-debug.log";
const ANALYTICS_SESSION_CACHE_FILE = "pitwall-analytics-session-cache.json";
const F1TV_LIBRARY_CACHE_FILE = "pitwall-f1tv-library-cache.json";
const F1TV_HOME_URL = "https://f1tv.formula1.com/";
const F1TV_LOGIN_URL = "https://account.formula1.com/#/en/login?redirect=https%3A%2F%2Ff1tv.formula1.com%2F";
const F1TV_AUTH_URL = "https://api.formula1.com/v2/account/subscriber/authenticate/by-password";
const F1TV_AUTH_API_KEY = "fCUCjWrKPu9ylJwRAv8BpGLEgiAuThx7";
const F1TV_HOSTS = new Set(["f1tv.formula1.com", "account.formula1.com", "formula1.com", "www.formula1.com"]);
const F1TV_MEDIA_CDN_HOSTS = new Set(["f1prodlive.akamaized.net"]);
const DATA_CACHE_MS = 1000 * 60 * 3;
const COPILOT_INSIGHT_RETRY_MS = 1000 * 60 * 10;
const OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses";
const ANTHROPIC_MESSAGES_URL = "https://api.anthropic.com/v1/messages";
const CODEX_CLIENT_ID = "app_EMoamEEZ73f0CkXaXp7hrann";
const CODEX_REDIRECT_URI = "http://localhost:1455/auth/callback";
const CODEX_AUTHORIZE_URL = "https://auth.openai.com/oauth/authorize";
const CODEX_TOKEN_URL = "https://auth.openai.com/oauth/token";
const CODEX_BACKEND_RESPONSES_URL = "https://chatgpt.com/backend-api/codex/responses";
const CODEX_SCOPE = "openid profile email offline_access";
const GROK_CLIENT_ID = "b1a00492-073a-47ea-816f-4c329264a828";
const GROK_REDIRECT_URI = "http://127.0.0.1:56121/callback";
const GROK_AUTHORIZE_URL = "https://auth.x.ai/oauth2/authorize";
const GROK_TOKEN_URL = "https://auth.x.ai/oauth2/token";
const GROK_CHAT_COMPLETIONS_URL = "https://api.x.ai/v1/chat/completions";
const GROK_SCOPE = "openid profile email offline_access grok-cli:access api:access";
const CODEX_MODELS = [
  { id: "gpt-5.5", label: "GPT-5.5", tier: "" },
  { id: "gpt-5.4", label: "GPT-5.4", tier: "" },
  { id: "gpt-5.4-mini", label: "GPT-5.4 mini", tier: "" },
];
const DEFAULT_CODEX_MODEL = "gpt-5.5";
const GROK_MODELS = [{ id: "grok-4.3", label: "Grok 4.3", tier: "" }];
const DEFAULT_GROK_MODEL = "grok-4.3";
const MAX_CAPTURED_STREAMS = 48;
const NEWS_SOURCES = [
  {
    key: "motorsportNews",
    name: "Motorsport.com",
    url: "https://www.motorsport.com/rss/f1/news/",
    type: "rss",
  },
  {
    key: "formula1News",
    name: "Formula 1",
    url: "https://www.formula1.com/en/latest",
    type: "html",
    articlePath: /\/en\/latest\/article\//i,
  },
  {
    key: "theRaceNews",
    name: "The Race",
    url: "https://www.the-race.com/category/formula-1/",
    type: "html",
    articlePath: /\/formula-1\/[^/?#]+\/?$/i,
  },
  {
    key: "planetF1News",
    name: "PlanetF1",
    url: "https://www.planetf1.com/news",
    type: "html",
    articlePath: /\/news\/[^/?#]+\/?$/i,
  },
];
const LIVE_NEWS_URLS = Object.fromEntries(NEWS_SOURCES.map((source) => [source.key, source.url]));
const LIVE_CORE_DATA_URLS = {
  driverStandings: "https://api.jolpi.ca/ergast/f1/current/driverStandings.json",
  constructorStandings: "https://api.jolpi.ca/ergast/f1/current/constructorStandings.json",
  schedule: "https://api.jolpi.ca/ergast/f1/current.json",
  ...LIVE_NEWS_URLS,
};
const LIVE_TIMING_ENRICHMENT_URLS = {
  openF1Drivers: "https://api.openf1.org/v1/drivers?session_key=latest",
  openF1CarData: "https://api.openf1.org/v1/car_data?session_key=latest",
  openF1Intervals: "https://api.openf1.org/v1/intervals?session_key=latest",
  openF1Laps: "https://api.openf1.org/v1/laps?session_key=latest",
  openF1Meetings: `https://api.openf1.org/v1/meetings?year=${new Date().getFullYear()}`,
  openF1Pit: "https://api.openf1.org/v1/pit?session_key=latest",
  openF1Position: "https://api.openf1.org/v1/position?session_key=latest",
  openF1Sessions: "https://api.openf1.org/v1/sessions?meeting_key=latest",
  openF1Stints: "https://api.openf1.org/v1/stints?session_key=latest",
  openF1Weather: "https://api.openf1.org/v1/weather?session_key=latest",
};
const LIVE_DATA_URLS = { ...LIVE_CORE_DATA_URLS, ...LIVE_TIMING_ENRICHMENT_URLS };
const OPTIONAL_LIVE_DATA_KEYS = new Set(["openF1CarData", "openF1Laps", "openF1Pit", "openF1Stints"]);
const COPILOT_INSIGHT_PAGES = [
  { id: "drivers-championship", title: "Drivers championship", kicker: "Overall standings" },
  { id: "constructors-championship", title: "Constructors championship", kicker: "Team standings" },
  { id: "current-weekend", title: "Current race weekend", kicker: "Loaded weekend context" },
  { id: "next-weekend", title: "Next race weekend", kicker: "Forward look" },
];
const COPILOT_WEEKEND_SESSION_KINDS = ["Practice 1", "Practice 2", "Practice 3", "Sprint Shootout", "Sprint", "Qualifying", "Race"];
let liveDataCache = null;
let liveDataEnrichmentRefresh = null;
let copilotInsightRefresh = null;
const ANALYTICS_CACHE_MS = 1000 * 60 * 5;
const ANALYTICS_DISK_CACHE_MS = 1000 * 60 * 30;
const ANALYTICS_REVALIDATE_MS = ANALYTICS_CACHE_MS;
const F1TV_LIBRARY_CACHE_MS = 1000 * 60 * 60 * 6;
const OPENF1_ANALYTICS_REQUEST_DELAY_MS = 1000;
const OPENF1_ANALYTICS_RETRY_MS = 750;
const OPENF1_TOKEN_URL = "https://api.openf1.org/token";
const OPENF1_REQUEST_INTERVAL_MS = 1000;
const OPENF1_SECOND_LIMIT = 6;
const OPENF1_MINUTE_LIMIT = 60;
const OPENF1_SECOND_WINDOW_MS = 1000;
const OPENF1_MINUTE_WINDOW_MS = 60000;
const OPENF1_TOKEN_REFRESH_MARGIN_MS = 1000 * 60;
const F1_TIMING_BASE_URL = "https://livetiming.formula1.com";
const F1_TIMING_SIGNALR_URL = "wss://livetiming.formula1.com/signalrcore";
const F1_TIMING_NEGOTIATE_URL = "https://livetiming.formula1.com/signalrcore/negotiate";
const F1_TIMING_LIVE_STALE_MS = 1000 * 25;
const F1_TIMING_SIGNALR_TOPICS = [
  "Heartbeat", "AudioStreams", "DriverList", "ExtrapolatedClock",
  "RaceControlMessages", "SessionInfo", "SessionStatus", "TeamRadio",
  "TimingAppData", "TimingStats", "TrackStatus", "WeatherData",
  "Position.z", "CarData.z", "ContentStreams", "SessionData",
  "TimingData", "TopThree", "RcmSeries", "LapCount",
];
const OPENF1_ANALYTICS_ENDPOINTS = {
  drivers: "https://api.openf1.org/v1/drivers",
  laps: "https://api.openf1.org/v1/laps",
  overtakes: "https://api.openf1.org/v1/overtakes",
  pit: "https://api.openf1.org/v1/pit",
  sessions: "https://api.openf1.org/v1/sessions",
  sessionResult: "https://api.openf1.org/v1/session_result",
  stints: "https://api.openf1.org/v1/stints",
  weather: "https://api.openf1.org/v1/weather",
};
let analyticsSessionCache = new Map();
let analyticsRefreshInFlight = new Map();
let f1TvLibraryCache = new Map();
let replayTimingCache = new Map();
let replayOpenF1Cache = new Map();
let replayF1TimingCache = new Map();
let liveTimingCache = null;
let f1LiveTimingClient = null;
let f1LiveTimingState = null;
let f1TvStreamCaptureInstalled = false;
let f1TvPlaybackPermissionsInstalled = false;
const capturedF1TvStreams = [];
let activeF1TvResolverCapture = null;
const pendingF1TvRequestHeaders = new Map();
const reminderTimers = new Map();

app.commandLine.appendSwitch("autoplay-policy", "no-user-gesture-required");

function readWidevineManifest(manifestPath) {
  try {
    const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
    return String(manifest.version || "");
  } catch {
    return "";
  }
}

function widevinePlatformDirs() {
  if (process.platform === "darwin") return process.arch === "arm64" ? ["mac_arm64", "mac_x64"] : ["mac_x64", "mac_arm64"];
  if (process.platform === "win32") return process.arch === "ia32" ? ["win_x86"] : ["win_x64", "win_x86"];
  return process.arch === "arm64" ? ["linux_arm64", "linux_x64"] : ["linux_x64"];
}

function widevineLibraryName() {
  return process.platform === "win32" ? "widevinecdm.dll" : process.platform === "darwin" ? "libwidevinecdm.dylib" : "libwidevinecdm.so";
}

function findWidevineInCandidate(base, source, fallbackVersion = "") {
  const version = readWidevineManifest(path.join(base, "manifest.json")) || fallbackVersion;
  for (const platformDir of widevinePlatformDirs()) {
    const libraryPath = path.join(base, "_platform_specific", platformDir, widevineLibraryName());
    if (fs.existsSync(libraryPath)) return { libraryPath, version, source };
  }
  return null;
}

function findWidevineInRoot(root) {
  const directRoot = findWidevineInCandidate(root, root);
  if (directRoot) return directRoot;
  try {
    const versions = fs.readdirSync(root)
      .filter((name) => fs.statSync(path.join(root, name)).isDirectory())
      .sort((a, b) => b.localeCompare(a, undefined, { numeric: true }));
    for (const versionDir of versions) {
      const base = path.join(root, versionDir);
      const found = findWidevineInCandidate(base, root, versionDir);
      if (found) return found;
    }
  } catch {}
  return null;
}

function findWidevineCdm() {
  const home = os.homedir();
  const roots = process.platform === "darwin" ? [
    path.join(home, "Library/Application Support/Google/Chrome/WidevineCDM"),
    path.join(home, "Library/Application Support/MultiViewer/WidevineCdm"),
    path.join(home, "Library/Application Support/MultiViewer for F1/WidevineCdm"),
    "/Applications/Google Chrome.app/Contents/Frameworks/Google Chrome Framework.framework/Versions",
    "/Applications/Google Chrome Canary.app/Contents/Frameworks/Google Chrome Framework.framework/Versions",
  ] : process.platform === "win32" ? [
    path.join(process.env.LOCALAPPDATA || "", "Google/Chrome/User Data/WidevineCDM"),
    path.join(process.env.PROGRAMFILES || "", "Google/Chrome/Application"),
    path.join(process.env["PROGRAMFILES(X86)"] || "", "Google/Chrome/Application"),
  ] : [
    path.join(home, ".config/google-chrome/WidevineCDM"),
    path.join(home, ".config/chromium/WidevineCDM"),
  ];
  for (const root of roots.filter(Boolean)) {
    const direct = findWidevineInRoot(root);
    if (direct) return direct;
    try {
      const nestedNames = ["WidevineCdm", "WidevineCDM", "Libraries/WidevineCdm", "Libraries/WidevineCDM"];
      for (const name of fs.readdirSync(root)) {
        for (const nestedName of nestedNames) {
          const candidate = path.join(root, name, nestedName);
          if (!fs.existsSync(candidate)) continue;
          const found = findWidevineInRoot(candidate);
          if (found) return found;
          const direct = findWidevineInCandidate(candidate, candidate, name);
          if (direct) return direct;
        }
      }
    } catch {}
  }
  return null;
}

let electronComponentsStatus = null;
const hasElectronComponentsWidevine = Boolean(components?.whenReady);
const configuredWidevineCdm = hasElectronComponentsWidevine ? null : findWidevineCdm();
if (!hasElectronComponentsWidevine && configuredWidevineCdm) {
  app.commandLine.appendSwitch("widevine-cdm-path", configuredWidevineCdm.libraryPath);
  app.commandLine.appendSwitch("widevine-cdm-version", configuredWidevineCdm.version);
}

function assertKeyProvider(provider) {
  if (!KEY_PROVIDERS.has(provider)) {
    throw new Error("Unsupported key provider");
  }
}

function runSecurity(args) {
  return new Promise((resolve, reject) => {
    execFile("/usr/bin/security", args, { timeout: 5000 }, (error, stdout, stderr) => {
      if (error) {
        error.stderr = stderr;
        reject(error);
        return;
      }
      resolve(stdout);
    });
  });
}

async function getSecret(provider) {
  assertKeyProvider(provider);
  if (process.platform !== "darwin") return "";
  try {
    return (await runSecurity(["find-generic-password", "-s", KEYCHAIN_SERVICE, "-a", provider, "-w"])).trim();
  } catch (error) {
    if (error.code === 44) return "";
    throw error;
  }
}

async function setSecret(provider, value) {
  assertKeyProvider(provider);
  if (process.platform !== "darwin") return false;
  const password = String(value || "").trim();
  if (!password) {
    await deleteSecret(provider);
    return true;
  }
  await runSecurity(["add-generic-password", "-U", "-s", KEYCHAIN_SERVICE, "-a", provider, "-w", password]);
  return true;
}

async function deleteSecret(provider) {
  assertKeyProvider(provider);
  if (process.platform !== "darwin") return false;
  try {
    await runSecurity(["delete-generic-password", "-s", KEYCHAIN_SERVICE, "-a", provider]);
  } catch (error) {
    if (error.code !== 44) throw error;
  }
  return true;
}

function normalizeUserProfile(profile = {}) {
  return {
    name: String(profile.name || "").slice(0, 80),
    favoriteDrivers: Array.isArray(profile.favoriteDrivers) ? profile.favoriteDrivers.map(String).slice(0, 8) : [],
    favoriteTeams: Array.isArray(profile.favoriteTeams) ? profile.favoriteTeams.map(String).slice(0, 8) : [],
  };
}

function profileFilePath() {
  return path.join(app.getPath("userData"), PROFILE_FILE);
}

function debugLogPath() {
  return path.join(app.getPath("userData"), DEBUG_LOG_FILE);
}

function sanitizeDebugPayload(value, depth = 0) {
  if (depth > 4) return "[depth-limit]";
  if (Array.isArray(value)) return value.slice(0, 20).map((item) => sanitizeDebugPayload(item, depth + 1));
  if (!value || typeof value !== "object") {
    const text = String(value ?? "");
    return text.length > 180 ? `${text.slice(0, 180)}...` : value;
  }
  return Object.fromEntries(Object.entries(value)
    .filter(([key]) => !/token|cookie|authorization|manifestUrl|licenseUrl|url$/i.test(key))
    .map(([key, item]) => [key, sanitizeDebugPayload(item, depth + 1)]));
}

function f1TvLicenseErrorHint(body) {
  const text = Buffer.isBuffer(body) ? body.toString("utf8") : String(body || "");
  try {
    const parsed = JSON.parse(text);
    return [
      parsed.errorDescription,
      parsed.message,
      parsed.resultObj?.keyos?.errormsg,
      parsed.resultObj?.keyos?.errorcode ? `KeyOS ${parsed.resultObj.keyos.errorcode}` : "",
    ].filter(Boolean).join(" - ");
  } catch {
    return text.replace(/\s+/g, " ").slice(0, 800);
  }
}

function writePitWallDebugLog(area, payload = {}) {
  const line = JSON.stringify({
    at: new Date().toISOString(),
    area: String(area || "app").slice(0, 80),
    payload: sanitizeDebugPayload(payload),
  });
  console.log(`[pitwall-debug] ${line}`);
  fs.promises.mkdir(path.dirname(debugLogPath()), { recursive: true })
    .then(() => fs.promises.appendFile(debugLogPath(), `${line}\n`, "utf8"))
    .catch(() => {});
  return { ok: true, path: debugLogPath() };
}

function urlDebugParts(targetUrl) {
  try {
    const parsed = new URL(String(targetUrl || ""));
    const parts = parsed.pathname.split("/").filter(Boolean);
    return {
      host: parsed.hostname,
      pathHint: parts.slice(0, 7).join("/"),
      queryKeys: Array.from(parsed.searchParams.keys()).slice(0, 8),
    };
  } catch {
    return { host: "", pathHint: "", queryKeys: [] };
  }
}

async function ensureElectronComponentsReady() {
  if (!components?.whenReady) return;
  try {
    await components.whenReady();
    electronComponentsStatus = components.status?.() || null;
    writePitWallDebugLog("electron.components-ready", {
      available: true,
      status: electronComponentsStatus,
    });
  } catch (error) {
    electronComponentsStatus = { error: error?.message || "Electron components failed to initialize." };
    writePitWallDebugLog("electron.components-error", electronComponentsStatus);
  }
}

async function getUserProfile() {
  try {
    const raw = await fs.promises.readFile(profileFilePath(), "utf8");
    return normalizeUserProfile({ ...DEFAULT_USER_PROFILE, ...JSON.parse(raw) });
  } catch {
    return { ...DEFAULT_USER_PROFILE };
  }
}

async function authenticateF1TvCredentials(email, password) {
  const login = String(email || "").trim();
  const pass = String(password || "");
  if (!login || !pass) throw new Error("Enter your F1 TV email and password.");
  const json = await requestJsonPost(F1TV_AUTH_URL, {
    Login: login,
    Password: pass,
  }, {
    apiKey: F1TV_AUTH_API_KEY,
    "User-Agent": "RaceControl f1viewer",
  });
  const subscriptionToken = String(json?.data?.subscriptionToken || json?.subscriptionToken || "").trim();
  if (!subscriptionToken) {
    const status = json?.data?.subscriptionStatus || json?.message || "No subscription token returned.";
    throw new Error(`F1 TV did not return a playback token: ${status}`);
  }
  await setSecret("f1tv-email", login);
  await setSecret("f1tv-token", subscriptionToken);
  return subscriptionToken;
}

async function setUserProfile(profile) {
  const next = normalizeUserProfile({ ...DEFAULT_USER_PROFILE, ...(profile || {}) });
  const filePath = profileFilePath();
  await fs.promises.mkdir(path.dirname(filePath), { recursive: true });
  await fs.promises.writeFile(filePath, JSON.stringify(next, null, 2), "utf8");
  return next;
}

ipcMain.handle("pitwall:key:get", (_event, provider) => getSecret(provider));
ipcMain.handle("pitwall:key:set", (_event, provider, value) => setSecret(provider, value));
ipcMain.handle("pitwall:key:delete", (_event, provider) => deleteSecret(provider));
ipcMain.handle("pitwall:profile:get", () => getUserProfile());
ipcMain.handle("pitwall:profile:set", (_event, profile) => setUserProfile(profile));
ipcMain.handle("pitwall:external:open", (_event, targetUrl) => {
  const url = String(targetUrl || "");
  if (!/^https?:\/\//i.test(url)) return false;
  shell.openExternal(url);
  return true;
});

function requestText(targetUrl, timeout = 8500, headers = {}) {
  return new Promise((resolve, reject) => {
    const req = https.get(targetUrl, {
      headers: {
        "Accept": "application/json, application/rss+xml, application/xml, text/xml, */*",
        "User-Agent": "PitWall/0.1 (+https://github.com/pitwall)",
        ...headers,
      },
      timeout,
    }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        res.resume();
        requestText(new URL(res.headers.location, targetUrl).href, timeout, headers).then(resolve, reject);
        return;
      }
      if (res.statusCode < 200 || res.statusCode >= 300) {
        res.resume();
        const error = new Error(`HTTP ${res.statusCode} for ${targetUrl}`);
        error.statusCode = res.statusCode;
        error.retryAfter = res.headers["retry-after"];
        reject(error);
        return;
      }
      let body = "";
      res.setEncoding("utf8");
      res.on("data", (chunk) => { body += chunk; });
      res.on("end", () => resolve(body));
    });
    req.on("timeout", () => req.destroy(new Error(`Timeout for ${targetUrl}`)));
    req.on("error", reject);
  });
}

async function requestJson(targetUrl, timeout = 8500, headers = {}) {
  return JSON.parse(await requestText(targetUrl, timeout, headers));
}

function readDotEnvValues() {
  const candidates = [
    path.join(process.cwd(), ".env"),
    path.join(app.getAppPath(), ".env"),
    path.resolve(app.getAppPath(), "../../../../../.env"),
    process.env.PITWALL_DOTENV,
  ].filter(Boolean);
  const values = {};
  for (const filePath of candidates) {
    try {
      const text = fs.readFileSync(filePath, "utf8");
      for (const line of text.split(/\r?\n/)) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) continue;
        const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
        if (!match) continue;
        let value = match[2].trim();
        if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
        values[match[1]] = value;
      }
    } catch {}
  }
  return values;
}

function openF1Credentials() {
  const env = readDotEnvValues();
  const username = String(process.env.OPENF1_EMAIL || process.env.OPENF1_USERNAME || process.env.EMAIL || env.OPENF1_EMAIL || env.OPENF1_USERNAME || env.EMAIL || "").trim();
  const password = String(process.env.OPENF1_PASSWORD || process.env.PASSWORD || env.OPENF1_PASSWORD || env.PASSWORD || "").trim();
  return username && password ? { username, password } : null;
}

function requestFormJson(targetUrl, body, timeout = 12000) {
  return new Promise((resolve, reject) => {
    const payload = new URLSearchParams(body).toString();
    const endpoint = new URL(targetUrl);
    const req = https.request({
      method: "POST",
      hostname: endpoint.hostname,
      path: `${endpoint.pathname}${endpoint.search}`,
      headers: {
        "Accept": "application/json",
        "Content-Type": "application/x-www-form-urlencoded",
        "Content-Length": Buffer.byteLength(payload),
        "User-Agent": "PitWall/0.1 (+https://github.com/pitwall)",
      },
      timeout,
    }, (res) => {
      let text = "";
      res.setEncoding("utf8");
      res.on("data", (chunk) => { text += chunk; });
      res.on("end", () => {
        if (res.statusCode < 200 || res.statusCode >= 300) {
          const error = new Error(`HTTP ${res.statusCode} for ${targetUrl}`);
          error.statusCode = res.statusCode;
          reject(error);
          return;
        }
        try {
          resolve(JSON.parse(text));
        } catch (error) {
          reject(error);
        }
      });
    });
    req.on("timeout", () => req.destroy(new Error(`Timeout for ${targetUrl}`)));
    req.on("error", reject);
    req.end(payload);
  });
}

let openF1TokenCache = null;
let openF1TokenRefresh = null;
let openF1Queue = Promise.resolve();
const openF1RequestTimes = [];

function openF1IsUrl(targetUrl) {
  try {
    return new URL(targetUrl).hostname === "api.openf1.org";
  } catch {
    return false;
  }
}

async function getOpenF1AccessToken() {
  const credentials = openF1Credentials();
  if (!credentials) return "";
  const now = Date.now();
  if (openF1TokenCache?.accessToken && openF1TokenCache.expiresAt - now > OPENF1_TOKEN_REFRESH_MARGIN_MS) return openF1TokenCache.accessToken;
  if (openF1TokenRefresh) return openF1TokenRefresh;
  openF1TokenRefresh = requestFormJson(OPENF1_TOKEN_URL, {
    username: credentials.username,
    password: credentials.password,
  }).then((tokenData) => {
    const accessToken = String(tokenData?.access_token || "");
    if (!accessToken) throw new Error("OpenF1 authentication did not return an access token.");
    const expiresIn = Math.max(60, Number(tokenData?.expires_in || 3600));
    openF1TokenCache = { accessToken, expiresAt: Date.now() + expiresIn * 1000 };
    return accessToken;
  }).finally(() => {
    openF1TokenRefresh = null;
  });
  return openF1TokenRefresh;
}

function openF1RetryDelayMs(error, attempt) {
  const retryAfter = Number(error?.retryAfter || 0);
  if (Number.isFinite(retryAfter) && retryAfter > 0) return Math.max(1000, retryAfter * 1000);
  return Math.max(OPENF1_REQUEST_INTERVAL_MS, 1500 * (attempt + 1));
}

async function waitForOpenF1Slot() {
  while (true) {
    const now = Date.now();
    while (openF1RequestTimes.length && now - openF1RequestTimes[0] >= OPENF1_MINUTE_WINDOW_MS) openF1RequestTimes.shift();
    const recentSecond = openF1RequestTimes.filter((time) => now - time < OPENF1_SECOND_WINDOW_MS);
    const recentMinute = openF1RequestTimes.filter((time) => now - time < OPENF1_MINUTE_WINDOW_MS);
    if (recentSecond.length < OPENF1_SECOND_LIMIT && recentMinute.length < OPENF1_MINUTE_LIMIT) {
      openF1RequestTimes.push(now);
      return;
    }
    const secondDelay = recentSecond.length >= OPENF1_SECOND_LIMIT ? OPENF1_SECOND_WINDOW_MS - (now - recentSecond[0]) : 0;
    const minuteDelay = recentMinute.length >= OPENF1_MINUTE_LIMIT ? OPENF1_MINUTE_WINDOW_MS - (now - recentMinute[0]) : 0;
    await wait(Math.max(50, secondDelay, minuteDelay));
  }
}

function scheduleOpenF1Request(fn) {
  const run = openF1Queue.then(async () => {
    await waitForOpenF1Slot();
    return fn();
  });
  openF1Queue = run.catch(() => {});
  return run;
}

async function requestOpenF1Json(targetUrl, options = {}) {
  const timeout = options.timeout || 12000;
  let lastError = null;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    try {
      return await scheduleOpenF1Request(async () => {
        const token = await getOpenF1AccessToken();
        const headers = token ? { Authorization: `Bearer ${token}` } : {};
        return requestJson(targetUrl, timeout, headers);
      });
    } catch (error) {
      lastError = error;
      if (error?.statusCode === 401 && openF1TokenCache) {
        openF1TokenCache = null;
      }
      const retryable = error?.statusCode === 401 || error?.statusCode === 429;
      if (!retryable || attempt === 3) throw error;
      await wait(openF1RetryDelayMs(error, attempt));
    }
  }
  throw lastError || new Error("OpenF1 request failed");
}

async function requestMaybeOpenF1Json(targetUrl, timeout = 8500) {
  return openF1IsUrl(targetUrl) ? requestOpenF1Json(targetUrl, { timeout }) : requestJson(targetUrl, timeout);
}

function requestJsonPost(targetUrl, body, headers = {}, timeout = 20000) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(body);
    const endpoint = new URL(targetUrl);
    const req = https.request({
      method: "POST",
      hostname: endpoint.hostname,
      path: `${endpoint.pathname}${endpoint.search}`,
      headers: {
        "Accept": "application/json",
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(payload),
        "User-Agent": "PitWall/0.1 (+https://github.com/pitwall)",
        ...headers,
      },
      timeout,
    }, (res) => {
      let text = "";
      res.setEncoding("utf8");
      res.on("data", (chunk) => { text += chunk; });
      res.on("end", () => {
        let json = null;
        try { json = text ? JSON.parse(text) : {}; }
        catch {
          reject(new Error(`Invalid JSON from ${endpoint.hostname}`));
          return;
        }
        if (res.statusCode < 200 || res.statusCode >= 300) {
          reject(new Error(json?.error?.message || json?.detail || json?.message || `HTTP ${res.statusCode} for ${targetUrl}`));
          return;
        }
        resolve(json);
      });
    });
    req.on("timeout", () => req.destroy(new Error(`Timeout for ${targetUrl}`)));
    req.on("error", reject);
    req.write(payload);
    req.end();
  });
}

function requestTextPost(targetUrl, body, headers = {}, timeout = 20000) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(body);
    const endpoint = new URL(targetUrl);
    const req = https.request({
      method: "POST",
      hostname: endpoint.hostname,
      path: `${endpoint.pathname}${endpoint.search}`,
      headers: {
        "Accept": "application/json",
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(payload),
        "User-Agent": "PitWall/0.1 (+https://github.com/pitwall)",
        ...headers,
      },
      timeout,
    }, (res) => {
      let text = "";
      res.setEncoding("utf8");
      res.on("data", (chunk) => { text += chunk; });
      res.on("end", () => {
        if (res.statusCode < 200 || res.statusCode >= 300) {
          let json = null;
          try { json = text ? JSON.parse(text) : {}; }
          catch {}
          reject(new Error(json?.error?.message || json?.detail || json?.message || `HTTP ${res.statusCode} for ${targetUrl}`));
          return;
        }
        resolve(text);
      });
    });
    req.on("timeout", () => req.destroy(new Error(`Timeout for ${targetUrl}`)));
    req.on("error", reject);
    req.write(payload);
    req.end();
  });
}

function requestFormPost(targetUrl, params, headers = {}, timeout = 20000) {
  return new Promise((resolve, reject) => {
    const payload = params.toString();
    const endpoint = new URL(targetUrl);
    const req = https.request({
      method: "POST",
      hostname: endpoint.hostname,
      path: `${endpoint.pathname}${endpoint.search}`,
      headers: {
        "Accept": "application/json",
        "Content-Type": "application/x-www-form-urlencoded",
        "Content-Length": Buffer.byteLength(payload),
        "User-Agent": "PitWall/0.1 (+https://github.com/pitwall)",
        ...headers,
      },
      timeout,
    }, (res) => {
      let text = "";
      res.setEncoding("utf8");
      res.on("data", (chunk) => { text += chunk; });
      res.on("end", () => {
        let json = null;
        try { json = text ? JSON.parse(text) : {}; }
        catch {
          reject(new Error(`Invalid JSON from ${endpoint.hostname}`));
          return;
        }
        if (res.statusCode < 200 || res.statusCode >= 300) {
          reject(new Error(json?.error_description || json?.error || `HTTP ${res.statusCode} for ${targetUrl}`));
          return;
        }
        resolve(json);
      });
    });
    req.on("timeout", () => req.destroy(new Error(`Timeout for ${targetUrl}`)));
    req.on("error", reject);
    req.write(payload);
    req.end();
  });
}

function base64url(buffer) {
  return buffer.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function generatePkce() {
  const verifier = base64url(randomBytes(64));
  return {
    verifier,
    challenge: base64url(createHash("sha256").update(verifier).digest()),
    state: base64url(randomBytes(32)),
  };
}

function buildCodexAuthorizeUrl(challenge, state) {
  const params = new URLSearchParams({
    response_type: "code",
    client_id: CODEX_CLIENT_ID,
    redirect_uri: CODEX_REDIRECT_URI,
    scope: CODEX_SCOPE,
    code_challenge: challenge,
    code_challenge_method: "S256",
    state,
    id_token_add_organizations: "true",
    codex_cli_simplified_flow: "true",
    originator: "codex_cli_rs",
  });
  return `${CODEX_AUTHORIZE_URL}?${params.toString()}`;
}

function buildGrokAuthorizeUrl(challenge, state) {
  const params = new URLSearchParams({
    response_type: "code",
    client_id: GROK_CLIENT_ID,
    redirect_uri: GROK_REDIRECT_URI,
    scope: GROK_SCOPE,
    code_challenge: challenge,
    code_challenge_method: "S256",
    state,
  });
  return `${GROK_AUTHORIZE_URL}?${params.toString()}`;
}

function decodeCodexAccountId(idToken) {
  if (!idToken) return "";
  const parts = String(idToken).split(".");
  if (parts.length < 2) return "";
  try {
    const payload = Buffer.from(parts[1].replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
    const claims = JSON.parse(payload);
    const orgs = claims?.["https://api.openai.com/auth"]?.organizations;
    if (Array.isArray(orgs) && orgs.length) {
      const account = orgs.find((org) => org?.is_default) || orgs[0];
      return String(account?.id || "");
    }
    return String(claims?.sub || "");
  } catch {
    return "";
  }
}

function tokenExpiry(expiresIn, skewSeconds = 90) {
  return Date.now() + Math.max(30, Number(expiresIn || 3600) - skewSeconds) * 1000;
}

async function exchangeCodexCode(code, verifier) {
  const json = await requestFormPost(CODEX_TOKEN_URL, new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: CODEX_REDIRECT_URI,
    client_id: CODEX_CLIENT_ID,
    code_verifier: verifier,
  }));
  return {
    accessToken: json.access_token,
    refreshToken: json.refresh_token,
    idToken: json.id_token,
    accountId: decodeCodexAccountId(json.id_token),
    expiresAt: tokenExpiry(json.expires_in, 60),
  };
}

async function refreshCodexTokens(refreshToken, accountId = "") {
  const json = await requestFormPost(CODEX_TOKEN_URL, new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    client_id: CODEX_CLIENT_ID,
    scope: CODEX_SCOPE,
  }));
  return {
    accessToken: json.access_token,
    refreshToken: json.refresh_token,
    idToken: json.id_token,
    accountId: decodeCodexAccountId(json.id_token) || accountId,
    expiresAt: tokenExpiry(json.expires_in, 60),
  };
}

async function exchangeGrokCode(code, verifier) {
  const json = await requestFormPost(GROK_TOKEN_URL, new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: GROK_REDIRECT_URI,
    client_id: GROK_CLIENT_ID,
    code_verifier: verifier,
  }));
  return {
    accessToken: json.access_token,
    refreshToken: json.refresh_token,
    expiresAt: tokenExpiry(json.expires_in, 120),
  };
}

async function refreshGrokTokens(refreshToken) {
  const json = await requestFormPost(GROK_TOKEN_URL, new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    client_id: GROK_CLIENT_ID,
    scope: GROK_SCOPE,
  }));
  return {
    accessToken: json.access_token,
    refreshToken: json.refresh_token || refreshToken,
    expiresAt: tokenExpiry(json.expires_in, 120),
  };
}

function waitForOAuthCallback(redirectUri, expectedState) {
  return new Promise((resolve, reject) => {
    const redirect = new URL(redirectUri);
    let settled = false;
    const finish = (error, code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      server.close(() => {});
      if (error) reject(error);
      else resolve(code);
    };
    const server = http.createServer((req, res) => {
      const url = new URL(req.url || "/", redirect.origin);
      if (url.pathname !== redirect.pathname) {
        res.writeHead(404);
        res.end("Not found");
        return;
      }
      const error = url.searchParams.get("error");
      const code = url.searchParams.get("code");
      const state = url.searchParams.get("state");
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      if (error) {
        res.end("<h1>PitWall sign-in failed</h1><p>You can close this tab.</p>");
        finish(new Error(`OAuth failed: ${error}`));
        return;
      }
      if (!code || state !== expectedState) {
        res.end("<h1>PitWall sign-in failed</h1><p>State mismatch. You can close this tab.</p>");
        finish(new Error("OAuth state mismatch."));
        return;
      }
      res.end("<h1>PitWall sign-in complete</h1><p>You can close this tab and return to PitWall.</p>");
      finish(null, code);
    });
    const timer = setTimeout(() => finish(new Error("OAuth sign-in timed out.")), 5 * 60 * 1000);
    server.once("error", finish);
    server.listen(Number(redirect.port), redirect.hostname);
  });
}

async function readOAuthSession(provider) {
  const raw = await getSecret(provider);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (typeof parsed.accessToken === "string" && typeof parsed.refreshToken === "string") return parsed;
  } catch {}
  return null;
}

async function writeOAuthSession(provider, tokens) {
  await setSecret(provider, JSON.stringify(tokens));
  return tokens;
}

async function getActiveOAuthSession(provider) {
  const tokens = await readOAuthSession(provider);
  if (!tokens) return null;
  if (Number(tokens.expiresAt || 0) > Date.now() + 30_000) return tokens;
  try {
    const refreshed = provider === "codex"
      ? await refreshCodexTokens(tokens.refreshToken, tokens.accountId)
      : await refreshGrokTokens(tokens.refreshToken);
    return writeOAuthSession(provider, refreshed);
  } catch (error) {
    console.error(`[${provider}-oauth] token refresh failed:`, error);
    await deleteSecret(provider);
    return null;
  }
}

function knownModel(model, models, fallback) {
  const value = String(model || "");
  return models.some((candidate) => candidate.id === value) ? value : fallback;
}

async function getAiAuthStatus() {
  const [codexSession, grokSession] = await Promise.all([
    getActiveOAuthSession("codex"),
    getActiveOAuthSession("grok"),
  ]);
  return {
    codexConnected: Boolean(codexSession),
    grokConnected: Boolean(grokSession),
    codexModels: CODEX_MODELS,
    defaultCodexModel: DEFAULT_CODEX_MODEL,
    grokModels: GROK_MODELS,
    defaultGrokModel: DEFAULT_GROK_MODEL,
  };
}

async function startAiOAuth(provider) {
  const target = String(provider || "").toLowerCase();
  if (target !== "codex" && target !== "grok") throw new Error("Unsupported AI OAuth provider");
  const pkce = generatePkce();
  const redirectUri = target === "codex" ? CODEX_REDIRECT_URI : GROK_REDIRECT_URI;
  const authorizeUrl = target === "codex"
    ? buildCodexAuthorizeUrl(pkce.challenge, pkce.state)
    : buildGrokAuthorizeUrl(pkce.challenge, pkce.state);
  const codePromise = waitForOAuthCallback(redirectUri, pkce.state);
  await shell.openExternal(authorizeUrl);
  const code = await codePromise;
  const tokens = target === "codex"
    ? await exchangeCodexCode(code, pkce.verifier)
    : await exchangeGrokCode(code, pkce.verifier);
  await writeOAuthSession(target, tokens);
  return getAiAuthStatus();
}

async function disconnectAiOAuth(provider) {
  const target = String(provider || "").toLowerCase();
  if (target !== "codex" && target !== "grok") throw new Error("Unsupported AI OAuth provider");
  await deleteSecret(target);
  return getAiAuthStatus();
}

function stripTags(value) {
  return String(value || "")
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function decodeXmlEntities(value) {
  return String(value || "")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function decodeEntities(value) {
  return decodeXmlEntities(stripTags(value));
}

function extractXml(block, tag) {
  const match = block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i"));
  return match ? decodeEntities(match[1]) : "";
}

function extractXmlRaw(block, tag) {
  const match = block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i"));
  return match ? match[1] : "";
}

function extractTagAttribute(block, tag, attr) {
  const match = block.match(new RegExp(`<${tag}\\b[^>]*\\b${attr}=["']([^"']+)["'][^>]*>`, "i"));
  return match ? decodeXmlEntities(match[1]).trim() : "";
}

function normalizeNewsImage(value) {
  const url = decodeXmlEntities(value).trim();
  if (!/^https?:\/\//i.test(url)) return "";
  return /\.(avif|gif|jpe?g|png|webp)(\?|#|$)/i.test(url) || /\/image\/upload\//i.test(url) ? url : "";
}

function extractRssImage(item) {
  const candidates = [
    extractTagAttribute(item, "media:content", "url"),
    extractTagAttribute(item, "media:thumbnail", "url"),
  ];
  const enclosure = item.match(/<enclosure\b[^>]*\burl=["']([^"']+)["'][^>]*\btype=["']image\/[^"']+["'][^>]*>/i)
    || item.match(/<enclosure\b[^>]*\btype=["']image\/[^"']+["'][^>]*\burl=["']([^"']+)["'][^>]*>/i);
  if (enclosure) candidates.push(enclosure[1]);

  for (const tag of ["description", "content:encoded", "summary"]) {
    const html = decodeXmlEntities(extractXmlRaw(item, tag).replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1"));
    const img = html.match(/<img\b[^>]*\bsrc=["']([^"']+)["']/i);
    if (img) candidates.push(img[1]);
  }

  return candidates.map(normalizeNewsImage).find(Boolean) || "";
}

function extractRssArticleText(item) {
  return (extractXml(item, "content:encoded") || extractXml(item, "summary") || extractXml(item, "description"))
    .replace(/\s+/g, " ")
    .trim();
}

function timeAgo(dateText) {
  const time = Date.parse(dateText);
  if (!Number.isFinite(time)) return "recent";
  const mins = Math.max(1, Math.round((Date.now() - time) / 60000));
  if (mins < 60) return `${mins}m`;
  const hours = Math.round(mins / 60);
  if (hours < 48) return `${hours}h`;
  return `${Math.round(hours / 24)}d`;
}

function classifyNews(title) {
  const text = title.toLowerCase();
  if (/breaking|urgent|confirmed|penalty|investigation/.test(text)) return "Breaking";
  if (/upgrade|floor|wing|engine|aero|technical|regulation/.test(text)) return "Tech";
  if (/strategy|pit|tyre|tire|undercut|overcut/.test(text)) return "Strategy";
  if (/qualifying|practice|race|result|winner|podium/.test(text)) return "Results";
  return "Paddock";
}

function teamAbbr(name, id = "") {
  const text = `${name} ${id}`.toLowerCase();
  if (text.includes("mclaren")) return "MCL";
  if (text.includes("red bull")) return "RBR";
  if (text.includes("ferrari")) return "FER";
  if (text.includes("mercedes")) return "MER";
  if (text.includes("williams")) return "WIL";
  if (text.includes("aston")) return "AST";
  if (text.includes("alpine")) return "ALP";
  if (text.includes("racing bulls") || text.includes("rb")) return "RB";
  if (text.includes("audi")) return "AUD";
  if (text.includes("haas")) return "HAS";
  if (text.includes("cadillac")) return "CAD";
  return String(id || name || "").replace(/[^a-z0-9]/gi, "").slice(0, 3).toUpperCase();
}

function colourForText(text) {
  const lower = String(text || "").toLowerCase();
  if (lower.includes("ferrari") || lower.includes("leclerc") || lower.includes("hamilton")) return "var(--team-ferrari)";
  if (lower.includes("mclaren") || lower.includes("norris") || lower.includes("piastri")) return "var(--team-mclaren)";
  if (lower.includes("red bull") || lower.includes("verstappen")) return "var(--team-redbull)";
  if (lower.includes("mercedes") || lower.includes("russell") || lower.includes("antonelli")) return "var(--team-mercedes)";
  if (lower.includes("williams") || lower.includes("sainz") || lower.includes("albon")) return "var(--team-williams)";
  return "var(--accent)";
}

function absoluteNewsUrl(value, baseUrl) {
  const url = decodeXmlEntities(value).trim();
  if (!url || /^(mailto|tel|javascript):/i.test(url)) return "";
  try {
    return new URL(url, baseUrl).href;
  } catch {
    return "";
  }
}

function normalizeNewsUrl(value) {
  return String(value || "").replace(/[?#].*$/, "").replace(/\/$/, "").toLowerCase();
}

function extractHtmlDate(value) {
  const text = decodeEntities(value).replace(/\s+/g, " ");
  const patterns = [
    /\b20\d{2}-\d{2}-\d{2}(?:T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z?)?\b/i,
    /\b(?:Jan|January|Feb|February|Mar|March|Apr|April|May|Jun|June|Jul|July|Aug|August|Sep|Sept|September|Oct|October|Nov|November|Dec|December)\s+\d{1,2},?\s+20\d{2}\b/i,
    /\b\d{1,2}\s+(?:Jan|January|Feb|February|Mar|March|Apr|April|May|Jun|June|Jul|July|Aug|August|Sep|Sept|September|Oct|October|Nov|November|Dec|December)\s+20\d{2}\b/i,
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (!match) continue;
    const time = Date.parse(match[0]);
    if (Number.isFinite(time)) return new Date(time).toISOString();
  }
  return "";
}

function extractHtmlImage(block, baseUrl) {
  const match = block.match(/<img\b[^>]*\b(?:src|data-src)=["']([^"']+)["']/i);
  if (!match) return "";
  return normalizeNewsImage(absoluteNewsUrl(match[1], baseUrl));
}

function normalizeNewsStory(sourceName, index, story) {
  const title = decodeEntities(story.title).replace(/\s+/g, " ").trim();
  const lead = decodeEntities(story.lead).replace(/\s+/g, " ").trim();
  const url = story.url || "";
  const publishedAt = story.publishedAt || "";
  const idSuffix = Date.parse(publishedAt) || createHash("sha256").update(`${url}:${title}`).digest("hex").slice(0, 10);
  return {
    id: `${sourceName}-${index}-${idSuffix}`,
    title,
    lead,
    body: story.body || lead,
    url,
    source: sourceName,
    time: timeAgo(publishedAt),
    publishedAt,
    image: story.image || "",
    tag: classifyNews(title),
    team: "",
    color: colourForText(`${title} ${lead}`),
  };
}

function parseRss(xml, sourceName) {
  return Array.from(xml.matchAll(/<item\b[\s\S]*?<\/item>/gi)).slice(0, 18).map((match, index) => {
    const item = match[0];
    const title = extractXml(item, "title");
    const lead = extractXml(item, "description");
    const url = extractXml(item, "link");
    const publishedAt = extractXml(item, "pubDate") || extractXml(item, "published");
    return normalizeNewsStory(sourceName, index, {
      title,
      lead,
      body: extractRssArticleText(item),
      url,
      publishedAt,
      image: extractRssImage(item),
    });
  }).filter((item) => item.title && item.url);
}

function parseNewsHtml(html, source) {
  const stories = [];
  const seen = new Set();
  const anchors = html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi);
  for (const match of anchors) {
    const href = match[1].match(/\bhref=["']([^"']+)["']/i)?.[1] || "";
    const url = absoluteNewsUrl(href, source.url);
    if (!url) continue;
    let pathname = "";
    try {
      pathname = new URL(url).pathname;
    } catch {
      continue;
    }
    if (!source.articlePath?.test(pathname)) continue;
    const title = decodeEntities(match[2]).replace(/\s+/g, " ").trim();
    if (title.length < 24 || /^(all|news|latest|formula 1|read more)$/i.test(title)) continue;
    const urlKey = normalizeNewsUrl(url);
    if (seen.has(urlKey)) continue;
    seen.add(urlKey);
    const context = html.slice(Math.max(0, match.index - 900), match.index + match[0].length + 1400);
    stories.push(normalizeNewsStory(source.name, stories.length, {
      title,
      lead: "",
      body: "",
      url,
      publishedAt: extractHtmlDate(context),
      image: extractHtmlImage(context, source.url),
    }));
    if (stories.length >= 12) break;
  }
  return stories;
}

function parseNewsSource(raw, source) {
  if (!raw) return [];
  if (source.type === "rss") return parseRss(raw, source.name);
  return parseNewsHtml(raw, source);
}

function buildNewsFeed(raw) {
  const stories = [];
  const seen = new Set();
  for (const source of NEWS_SOURCES) {
    for (const story of parseNewsSource(raw[source.key] || "", source)) {
      const key = normalizeNewsUrl(story.url) || story.title.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      stories.push(story);
    }
  }
  return stories
    .sort((a, b) => (Date.parse(b.publishedAt || "") || 0) - (Date.parse(a.publishedAt || "") || 0))
    .slice(0, 24);
}

function parseDriverStandings(json) {
  const list = json?.MRData?.StandingsTable?.StandingsLists?.[0];
  return {
    seasonSummary: {
      season: list?.season || String(new Date().getFullYear()),
      round: Number(list?.round || 0),
    },
    standings: (list?.DriverStandings || []).map((row) => {
      const code = row.Driver?.code || row.Driver?.driverId?.slice(0, 3).toUpperCase();
      return {
        pos: Number(row.position),
        code,
        pts: Number(row.points),
        wins: Number(row.wins || 0),
        delta: 0,
        driver: {
          code,
          name: [row.Driver?.givenName, row.Driver?.familyName].filter(Boolean).join(" "),
          num: Number(row.Driver?.permanentNumber || 0),
          team: row.Constructors?.[0]?.name || "",
          abbr: teamAbbr(row.Constructors?.[0]?.name, row.Constructors?.[0]?.constructorId),
        },
      };
    }),
  };
}

function parseConstructorStandings(json) {
  const list = json?.MRData?.StandingsTable?.StandingsLists?.[0];
  return (list?.ConstructorStandings || []).map((row) => ({
    pos: Number(row.position),
    abbr: teamAbbr(row.Constructor?.name, row.Constructor?.constructorId),
    name: row.Constructor?.name || "",
    pts: Number(row.points),
    wins: Number(row.wins || 0),
    delta: 0,
  }));
}

function sessionDate(session) {
  if (!session?.date) return "";
  return `${session.date}T${session.time || "00:00:00Z"}`;
}

function compactText(value) {
  return String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function matchOpenF1Meeting(race, meetings = []) {
  const raceStart = Date.parse(sessionDate(race));
  const raceText = compactText([
    race.raceName,
    race.Circuit?.circuitName,
    race.Circuit?.Location?.locality,
    race.Circuit?.Location?.country,
  ].filter(Boolean).join(" "));
  const scored = (meetings || []).map((meeting) => {
    const meetingStart = Date.parse(meeting.date_start || "");
    const daysApart = Number.isFinite(raceStart) && Number.isFinite(meetingStart)
      ? Math.abs(raceStart - meetingStart) / 86400000
      : 99;
    const meetingText = compactText([
      meeting.meeting_name,
      meeting.official_name,
      meeting.circuit_short_name,
      meeting.location,
      meeting.country_name,
    ].filter(Boolean).join(" "));
    const textScore = raceText.split(" ").filter((word) => word.length > 3 && meetingText.includes(word)).length;
    return { meeting, score: textScore - Math.max(0, daysApart - 4) };
  }).sort((a, b) => b.score - a.score);
  return scored[0]?.score > 0 ? scored[0].meeting : null;
}

function parseSchedule(json, openF1Meetings = []) {
  const races = json?.MRData?.RaceTable?.Races || [];
  const now = Date.now();
  return races.map((race) => {
    const meeting = matchOpenF1Meeting(race, openF1Meetings);
    const raceDate = Date.parse(sessionDate(race));
    const done = Number.isFinite(raceDate) && raceDate + 1000 * 60 * 60 * 5 < now;
    const live = Number.isFinite(raceDate) && Math.abs(raceDate - now) < 1000 * 60 * 60 * 5;
    const sessions = [
      ["FirstPractice", "Practice 1"],
      ["SecondPractice", "Practice 2"],
      ["ThirdPractice", "Practice 3"],
      ["Sprint", "Sprint"],
      ["Qualifying", "Qualifying"],
      ["Race", "Race"],
    ].map(([key, kind]) => {
      const src = key === "Race" ? race : race[key];
      if (!src?.date) return null;
      const start = Date.parse(sessionDate(src));
      return {
        kind,
        day: Number.isFinite(start) ? new Intl.DateTimeFormat("en", { weekday: "short" }).format(start) : "",
        time: Number.isFinite(start) ? new Intl.DateTimeFormat("en", { hour: "2-digit", minute: "2-digit" }).format(start) : "",
        startsAt: Number.isFinite(start) ? new Date(start).toISOString() : "",
        status: Number.isFinite(start) && start + 1000 * 60 * 60 * 3 < now ? "done" : Number.isFinite(start) && Math.abs(start - now) < 1000 * 60 * 60 * 3 ? "live" : "upcoming",
      };
    }).filter(Boolean);
    return {
      rnd: Number(race.round),
      name: race.raceName,
      circuit: race.Circuit?.circuitName || "",
      loc: [race.Circuit?.Location?.locality, race.Circuit?.Location?.country].filter(Boolean).join(", "),
      date: Number.isFinite(raceDate) ? new Intl.DateTimeFormat("en", { month: "short", day: "2-digit" }).format(raceDate) : "",
      startsAt: Number.isFinite(raceDate) ? new Date(raceDate).toISOString() : "",
      status: live ? "live" : done ? "done" : "upcoming",
      meetingKey: meeting?.meeting_key || null,
      sessions,
    };
  });
}

function latestBy(items, keyFn) {
  const map = new Map();
  for (const item of items || []) map.set(keyFn(item), item);
  return map;
}

function normalizeCompound(value) {
  const text = String(value || "").trim().toLowerCase();
  if (!text) return "";
  if (text.includes("soft")) return "soft";
  if (text.includes("medium")) return "medium";
  if (text.includes("hard")) return "hard";
  if (text.includes("inter")) return "intermediate";
  if (text.includes("wet")) return "wet";
  return text;
}

function groupRowsByDriverNumber(rows) {
  const map = new Map();
  for (const row of rows || []) {
    const number = Number(row.driver_number);
    if (!Number.isFinite(number) || number <= 0) continue;
    if (!map.has(number)) map.set(number, []);
    map.get(number).push(row);
  }
  return map;
}

function normalizeStint(row) {
  const lapStart = finiteNumber(row?.lap_start);
  const lapEnd = finiteNumber(row?.lap_end);
  const tyreAgeAtStart = finiteNumber(row?.tyre_age_at_start);
  const laps = lapStart != null && lapEnd != null ? Math.max(1, lapEnd - lapStart + 1) : null;
  return {
    stintNumber: finiteNumber(row?.stint_number),
    compound: normalizeCompound(row?.compound) || "unknown",
    lapStart,
    lapEnd,
    laps,
    tyreAgeAtStart,
  };
}

function stintsByDriverNumber(rows) {
  const grouped = groupRowsByDriverNumber(rows);
  const map = new Map();
  for (const [number, stints] of grouped) {
    map.set(number, stints
      .map(normalizeStint)
      .sort((a, b) => (a.stintNumber ?? a.lapStart ?? 0) - (b.stintNumber ?? b.lapStart ?? 0)));
  }
  return map;
}

function latestStintForDriver(stints) {
  return (stints || []).slice().sort((a, b) => {
    const aLap = a.lapEnd ?? a.lapStart ?? a.stintNumber ?? 0;
    const bLap = b.lapEnd ?? b.lapStart ?? b.stintNumber ?? 0;
    return aLap - bLap;
  }).at(-1) || null;
}

function tyreAgeFromStint(stint) {
  if (!stint) return "";
  const start = finiteNumber(stint.lapStart);
  const end = finiteNumber(stint.lapEnd);
  const base = finiteNumber(stint.tyreAgeAtStart);
  if (base != null && start != null && end != null) return Math.max(0, Math.round(base + Math.max(0, end - start + 1)));
  if (base != null) return Math.round(base);
  if (start != null && end != null) return Math.max(0, Math.round(end - start + 1));
  return "";
}

function pitCountsByDriverNumber(rows) {
  const map = new Map();
  for (const [number, pitRows] of groupRowsByDriverNumber(rows)) map.set(number, pitRows.length);
  return map;
}

function lapDurationSeconds(lap) {
  if (!lap || typeof lap !== "object") return finiteNumber(lap);
  const explicit = finiteNumber(lap.lap_duration) ?? finiteNumber(lap.duration);
  if (explicit != null) return explicit;
  const sectors = [lap.duration_sector_1, lap.duration_sector_2, lap.duration_sector_3].map(finiteNumber);
  return sectors.every((sector) => sector != null) ? sectors.reduce((sum, sector) => sum + sector, 0) : null;
}

function formatLapDuration(value) {
  const seconds = finiteNumber(value);
  if (seconds == null || seconds <= 0) return "";
  const minutes = Math.floor(seconds / 60);
  const remainder = (seconds - minutes * 60).toFixed(3).padStart(6, "0");
  return `${minutes}:${remainder}`;
}

function bestLapsByDriverNumber(rows) {
  const map = new Map();
  for (const [number, laps] of groupRowsByDriverNumber(rows)) {
    const best = laps
      .filter((lap) => lapDurationSeconds(lap) != null)
      .sort((a, b) => lapDurationSeconds(a) - lapDurationSeconds(b))[0];
    if (best) map.set(number, best);
  }
  return map;
}

function latestCarDataByDriverNumber(rows) {
  const map = new Map();
  for (const [number, samples] of groupRowsByDriverNumber(rows)) {
    const latest = samples.slice().sort((a, b) => {
      const aMs = Date.parse(a.date || "");
      const bMs = Date.parse(b.date || "");
      return (Number.isFinite(aMs) ? aMs : 0) - (Number.isFinite(bMs) ? bMs : 0);
    }).at(-1);
    if (!latest) continue;
    map.set(number, {
      speed: finiteNumber(latest.speed),
      gear: finiteNumber(latest.n_gear),
      throttle: clampPercent(latest.throttle),
      brake: clampPercent(latest.brake),
    });
  }
  return map;
}

function clampPercent(value) {
  const number = finiteNumber(value);
  return number == null ? null : Math.max(0, Math.min(100, Math.round(number)));
}

function timingSegmentTone(value) {
  const text = String(value ?? "").toLowerCase();
  if (!text || text === "0" || text === "null") return "off";
  if (/purple|overall|fastest/.test(text)) return "purple";
  if (/green|personal/.test(text)) return "green";
  if (/yellow|normal/.test(text)) return "yellow";
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) return "off";
  if (number === 2051 || number === 2068) return "purple";
  if (number === 2049 || number === 2053 || number === 2064) return "green";
  if (number === 2048 || number === 2050 || number === 2052) return "yellow";
  return "yellow";
}

function miniSectorSegments(lap, sector) {
  const key = sector === 1 ? "segments_sector_1" : sector === 2 ? "segments_sector_2" : "segments_sector_3";
  const raw = lap?.[key];
  const values = Array.isArray(raw) ? raw : [];
  const segments = values.slice(0, 10).map(timingSegmentTone);
  const sectorDuration = finiteNumber(lap?.[`duration_sector_${sector}`]);
  return segments.length ? segments : sectorDuration != null ? ["yellow", "yellow", "yellow", "yellow", "yellow", "yellow"] : [];
}

function parseTiming(openDrivers, positions, intervals, standings, stints = [], pitRows = [], openF1Laps = [], carData = []) {
  const driversByNumber = new Map((openDrivers || []).map((driver) => [Number(driver.driver_number), driver]));
  const standingsByNumber = new Map((standings || [])
    .map((row) => [Number(row.driver?.num || row.num || 0), row])
    .filter(([number]) => Number.isFinite(number) && number > 0));
  const latestPosition = latestBy(positions || [], (row) => Number(row.driver_number));
  const latestInterval = latestBy(intervals || [], (row) => Number(row.driver_number));
  const stintsByNumber = stintsByDriverNumber(stints);
  const pitCounts = pitCountsByDriverNumber(pitRows);
  const latestLaps = latestLapsByDriverNumber(openF1Laps);
  const bestLaps = bestLapsByDriverNumber(openF1Laps);
  const latestCarData = latestCarDataByDriverNumber(carData);
  const rows = Array.from(latestPosition.values()).sort((a, b) => Number(a.position) - Number(b.position)).map((row) => {
    const number = Number(row.driver_number);
    const driver = driversByNumber.get(number);
    const standing = standingsByNumber.get(number);
    const interval = latestInterval.get(number);
    const openCode = String(driver?.name_acronym || "").trim().toUpperCase();
    const code = /^[A-Z]{3}$/.test(openCode) ? openCode : standing?.code || String(row.driver_number);
    const driverStints = stintsByNumber.get(number) || [];
    const latestStint = latestStintForDriver(driverStints);
    const pitCount = pitCounts.get(number) ?? Math.max(0, Number(latestStint?.stintNumber || 1) - 1);
    const latestLap = latestLaps.get(number) || {};
    const bestLap = bestLaps.get(number) || {};
    const latestLapDuration = lapDurationSeconds(latestLap);
    const bestLapDuration = lapDurationSeconds(bestLap);
    const telemetry = latestCarData.get(number) || {};
    return {
      pos: Number(row.position),
      code,
      last: formatLapDuration(latestLapDuration),
      best: formatLapDuration(bestLapDuration),
      lastLapDuration: latestLapDuration,
      bestLapDuration: bestLapDuration,
      state: null,
      gap: interval?.gap_to_leader || (Number(row.position) === 1 ? "LEADER" : "—"),
      interval: interval?.interval || "—",
      trend: "flat",
      comp: latestStint?.compound && latestStint.compound !== "unknown" ? latestStint.compound : "",
      age: tyreAgeFromStint(latestStint),
      pits: pitCount || "",
      stints: driverStints,
      sectors: {
        s1: miniSectorSegments(latestLap, 1),
        s2: miniSectorSegments(latestLap, 2),
        s3: miniSectorSegments(latestLap, 3),
      },
      telemetry,
    };
  });
  if (rows.length) return rows;
  return (standings || []).map((row) => ({
    pos: row.pos,
    code: row.code,
    last: "",
    best: "",
    lastLapDuration: null,
    bestLapDuration: null,
    state: null,
    gap: row.pos === 1 ? "LEADER" : "—",
    interval: "—",
    trend: "flat",
    comp: "",
    age: "",
    pits: "",
    sectors: { s1: [], s2: [], s3: [] },
    telemetry: {},
  }));
}

function parseRaceInterval(value) {
  const text = String(value || "").trim();
  if (!text || text === "—" || /leader/i.test(text)) return null;
  const numeric = Number(text.replace(/^\+/, "").replace(/s$/i, ""));
  return Number.isFinite(numeric) ? numeric : null;
}

function detectBattlePairs(timing) {
  const pairs = [];
  const ordered = (timing || []).slice().sort((a, b) => Number(a.pos) - Number(b.pos));
  for (let i = 1; i < ordered.length; i += 1) {
    const ahead = ordered[i - 1];
    const behind = ordered[i];
    const gap = parseRaceInterval(behind.interval);
    if (gap != null && gap > 0 && gap <= 1.5 && ahead.code && behind.code) {
      pairs.push({
        a: ahead.code,
        b: behind.code,
        gap,
        kind: "battle",
        title: `${behind.code} within DRS of ${ahead.code}`,
        body: `${behind.code} is ${gap.toFixed(1)}s behind ${ahead.code}. Load both onboards side-by-side.`,
        conf: Math.max(0.72, Math.min(0.96, 1 - gap / 5)),
      });
    }
  }
  return pairs.slice(0, 4);
}

function parseOpenDrivers(openDrivers, fallbackDrivers, standings) {
  const fallbackByCode = new Map((fallbackDrivers || []).map((driver) => [driver.code, driver]));
  const fromOpen = (openDrivers || []).map((driver) => {
    const code = driver.name_acronym;
    const fallback = fallbackByCode.get(code) || {};
    return {
      ...fallback,
      code,
      name: driver.full_name || fallback.name || code,
      num: Number(driver.driver_number || fallback.num || 0),
      team: driver.team_name || fallback.team || "",
      color: driver.team_colour ? `#${driver.team_colour.replace(/^#/, "")}` : fallback.color || "var(--accent)",
      abbr: fallback.abbr || (driver.team_name || "").slice(0, 3).toUpperCase(),
      image: driver.headshot_url || fallback.remoteImage || fallback.image || "",
      remoteImage: driver.headshot_url || fallback.remoteImage || "",
    };
  }).filter((driver) => driver.code);
  if (fromOpen.length) return fromOpen;
  const byCode = new Map((fallbackDrivers || []).map((driver) => [driver.code, { ...driver }]));
  for (const row of standings || []) {
    const base = byCode.get(row.code) || {};
    byCode.set(row.code, { ...base, ...row.driver, color: base.color || "var(--accent)", image: base.remoteImage || base.image || "" });
  }
  return Array.from(byCode.values()).filter((driver) => driver.code);
}

function parseWeather(rows) {
  const row = (rows || []).at(-1);
  if (!row) return { air: "", track: "", cond: "", rain: "", wind: "", humidity: "" };
  return {
    air: row.air_temperature ?? "",
    track: row.track_temperature ?? "",
    cond: Number(row.rainfall || 0) > 0 ? "Rain" : "Dry",
    rain: row.rainfall != null ? `${Math.round(Number(row.rainfall) * 100)}%` : "",
    wind: row.wind_speed != null ? `${Math.round(Number(row.wind_speed))} km/h` : "",
    humidity: row.humidity != null ? `${Math.round(Number(row.humidity))}%` : "",
  };
}

function hasWeatherRows(rows) {
  return (rows || []).some((row) => row && (
    row.air_temperature != null ||
    row.track_temperature != null ||
    row.rainfall != null ||
    row.wind_speed != null ||
    row.humidity != null
  ));
}

function f1TimingHeaders(extra = {}) {
  return {
    "Accept": "application/json, text/plain, */*",
    "Accept-Encoding": "identity",
    "User-Agent": "BestHTTP",
    ...extra,
  };
}

function f1TimingRequestText(targetUrl, timeout = 18000, headers = {}) {
  return requestText(targetUrl, timeout, f1TimingHeaders(headers));
}

function f1TimingDatePart(value) {
  const parsed = Date.parse(value || "");
  return Number.isFinite(parsed) ? new Date(parsed).toISOString().slice(0, 10) : "";
}

function f1TimingSlug(value) {
  return String(value || "")
    .trim()
    .replace(/[’']/g, "")
    .replace(/[^A-Za-z0-9À-ž]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function f1TimingSessionName(value) {
  const text = String(value || "").trim();
  if (/practice 1|free practice 1|fp1/i.test(text)) return "Practice_1";
  if (/practice 2|free practice 2|fp2/i.test(text)) return "Practice_2";
  if (/practice 3|free practice 3|fp3/i.test(text)) return "Practice_3";
  if (/sprint qualifying|sprint shootout/i.test(text)) return "Sprint_Qualifying";
  if (/qualifying|quali/i.test(text)) return "Qualifying";
  if (/sprint/i.test(text)) return "Sprint";
  if (/race|grand prix/i.test(text)) return "Race";
  return f1TimingSlug(text);
}

function f1TimingArchiveCandidates(meeting, session) {
  const year = String(meeting?.year || session?.year || f1TimingDatePart(meeting?.date_end || session?.date_start).slice(0, 4) || new Date().getFullYear());
  const eventNames = Array.from(new Set([
    meeting?.meeting_name,
    meeting?.event_name,
    meeting?.location ? `${meeting.location} Grand Prix` : "",
    session?.country_name ? `${session.country_name} Grand Prix` : "",
  ].filter(Boolean).map(f1TimingSlug).filter(Boolean)));
  const eventDates = Array.from(new Set([
    f1TimingDatePart(meeting?.date_end),
    f1TimingDatePart(meeting?.date_start),
    f1TimingDatePart(session?.date_start),
  ].filter(Boolean)));
  const sessionDates = Array.from(new Set([
    f1TimingDatePart(session?.date_start),
    f1TimingDatePart(session?.date_end),
  ].filter(Boolean)));
  const sessionNames = Array.from(new Set([
    f1TimingSessionName(session?.session_name || session?.session_type),
    f1TimingSlug(session?.session_name || session?.session_type),
  ].filter(Boolean)));
  const bases = [];
  for (const eventDate of eventDates) {
    for (const eventName of eventNames) {
      for (const sessionDate of sessionDates) {
        for (const sessionName of sessionNames) {
          bases.push(`${F1_TIMING_BASE_URL}/static/${year}/${eventDate}_${eventName}/${sessionDate}_${sessionName}/`);
        }
      }
    }
  }
  return Array.from(new Set(bases));
}

async function resolveF1TimingArchiveBase(meeting, session) {
  const candidates = f1TimingArchiveCandidates(meeting, session);
  let lastError = null;
  for (const baseUrl of candidates) {
    try {
      const index = JSON.parse(stripJsonBom(await f1TimingRequestText(`${baseUrl}Index.json`, 12000)));
      return { baseUrl, index };
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError || new Error("Formula 1 livetiming archive path could not be resolved.");
}

function stripJsonBom(text) {
  return String(text || "").replace(/^\uFEFF/, "").replace(/^\u00EF\u00BB\u00BF/, "");
}

function f1TimingSeconds(value) {
  const match = String(value || "").match(/^(\d+):(\d+):(\d+(?:\.\d+)?)$/);
  return match ? Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3]) : 0;
}

function decodeF1TimingZPayload(payload) {
  if (payload && typeof payload === "object") return payload;
  const encoded = String(payload || "").replace(/^"|"$/g, "");
  if (!encoded) return {};
  const compressed = Buffer.from(encoded, "base64");
  let text = "";
  try {
    text = zlib.inflateRawSync(compressed).toString("utf8");
  } catch {
    text = zlib.inflateSync(compressed).toString("utf8");
  }
  return JSON.parse(text);
}

function parseF1TimingJsonStream(text, options = {}) {
  return stripJsonBom(text).split(/\r?\n/)
    .filter(Boolean)
    .map((line) => {
      const time = line.slice(0, 12);
      const raw = JSON.parse(line.slice(12));
      const data = options.zipped ? decodeF1TimingZPayload(raw) : raw;
      return { time, seconds: f1TimingSeconds(time), data };
    });
}

function mergeF1TimingDelta(target, source) {
  if (!source || typeof source !== "object" || Array.isArray(source)) return source;
  const next = target && typeof target === "object" && !Array.isArray(target) ? { ...target } : {};
  const deleted = Array.isArray(source._deleted) ? new Set(source._deleted) : new Set();
  for (const key of deleted) delete next[key];
  for (const [key, value] of Object.entries(source)) {
    if (key === "_deleted") continue;
    next[key] = value && typeof value === "object" && !Array.isArray(value)
      ? mergeF1TimingDelta(next[key], value)
      : value;
  }
  return next;
}

function f1TimingStateAt(entries, targetSeconds) {
  let state = {};
  for (const entry of entries || []) {
    if (entry.seconds > targetSeconds) break;
    state = mergeF1TimingDelta(state, entry.data);
  }
  return state;
}

function f1TimingLatestEntryAt(entries, targetSeconds) {
  let latest = null;
  for (const entry of entries || []) {
    if (entry.seconds > targetSeconds) break;
    latest = entry;
  }
  return latest;
}

function f1TimingArchiveStartUtcMs(sessionData) {
  for (const entry of sessionData?.clockEntries || []) {
    const utcMs = Date.parse(entry?.data?.Utc || "");
    const seconds = finiteNumber(entry?.seconds);
    if (Number.isFinite(utcMs) && seconds != null) return utcMs - seconds * 1000;
  }
  return null;
}

function f1TimingVideoStartArchiveSeconds(sessionData, options) {
  options = options || {};
  const explicitSeconds = finiteNumber(options.videoStartArchiveSeconds);
  if (explicitSeconds != null) return Math.max(0, explicitSeconds);
  const videoStartUtcMs = Date.parse(options.videoStartUtc || "");
  const archiveStartUtcMs = f1TimingArchiveStartUtcMs(sessionData);
  if (!Number.isFinite(videoStartUtcMs) || !Number.isFinite(archiveStartUtcMs)) return null;
  return Math.max(0, (videoStartUtcMs - archiveStartUtcMs) / 1000);
}

function f1TimingSessionStartSeconds(sessionData) {
  for (const entry of sessionData?.sessionStatusEntries || []) {
    const status = String(entry?.data?.Status || entry?.data?.SessionStatus || entry?.data?.Started || "");
    if (status === "Started") return finiteNumber(entry.seconds) ?? 0;
    const series = entry?.data?.StatusSeries;
    const values = Array.isArray(series) ? series : series && typeof series === "object" ? Object.values(series) : [];
    for (const item of values) {
      const itemStatus = String(item?.SessionStatus || item?.Status || item?.Started || "");
      if (itemStatus === "Started") return finiteNumber(entry.seconds) ?? 0;
    }
  }
  return 0;
}

function f1TimingValue(value) {
  if (value == null) return "";
  if (typeof value === "object") return String(value.Value ?? value.value ?? "");
  return String(value);
}

function f1TimingDurationSeconds(value) {
  const text = f1TimingValue(value).trim();
  const match = text.match(/^(\d+):(\d{2}):(\d{2})(?:\.\d+)?$/);
  if (!match) return null;
  const seconds = Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3]);
  return Number.isFinite(seconds) ? seconds : null;
}

function formatF1TimingDuration(seconds) {
  const value = Math.max(0, Math.round(Number(seconds || 0)));
  const h = Math.floor(value / 3600);
  const m = Math.floor((value % 3600) / 60);
  const s = value % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function f1TimingLapSeconds(value) {
  const text = f1TimingValue(value).trim();
  if (!text) return null;
  const parts = text.split(":");
  const seconds = parts.length === 2 ? Number(parts[0]) * 60 + Number(parts[1]) : Number(text);
  return Number.isFinite(seconds) && seconds > 0 ? seconds : null;
}

function fillF1TimingQualifyingDeltas(rows) {
  const ordered = (rows || []).slice().sort((a, b) => Number(a.pos || 99) - Number(b.pos || 99));
  const hasValue = (value) => {
    const text = String(value || "").trim();
    return Boolean(text && text !== "—" && text !== "-");
  };
  const formatDelta = (value) => {
    const number = finiteNumber(value);
    return number == null ? "—" : `+${Math.max(0, number).toFixed(3)}`;
  };
  const leaderBest = finiteNumber(ordered.find((row) => finiteNumber(row.bestLapDuration) != null)?.bestLapDuration);
  let previousBest = leaderBest;
  return ordered.map((row, index) => {
    const best = finiteNumber(row.bestLapDuration);
    const next = { ...row };
    if (index === 0) {
      next.gap = hasValue(next.gap) ? next.gap : "LEADER";
    } else if (!hasValue(next.gap) && best != null && leaderBest != null) {
      next.gap = formatDelta(best - leaderBest);
    }
    if (index > 0 && !hasValue(next.interval) && best != null && previousBest != null) {
      next.interval = formatDelta(best - previousBest);
    }
    if (best != null) previousBest = best;
    return next;
  });
}

function f1TimingSegments(sector) {
  const raw = sector?.Segments || [];
  const values = Array.isArray(raw) ? raw : Object.values(raw);
  return values.map((segment) => timingSegmentTone(segment?.Status ?? segment?.status ?? segment)).filter((tone) => tone !== "off");
}

function f1TimingStints(value) {
  const raw = value?.Stints || value || [];
  return (Array.isArray(raw) ? raw : Object.values(raw)).filter(Boolean);
}

function f1TimingLatestStint(line) {
  return f1TimingStints(line).slice().sort((a, b) => {
    const aLap = finiteNumber(a?.LapNumber) ?? finiteNumber(a?.TotalLaps) ?? 0;
    const bLap = finiteNumber(b?.LapNumber) ?? finiteNumber(b?.TotalLaps) ?? 0;
    return aLap - bLap;
  }).at(-1) || null;
}

function f1TimingTelemetryFromCarData(state) {
  const latest = new Map();
  for (const entry of state?.Entries || []) {
    const utc = entry?.Utc || "";
    for (const [number, car] of Object.entries(entry?.Cars || {})) {
      const channels = car?.Channels || {};
      latest.set(Number(number), {
        driver_number: Number(number),
        date: utc,
        rpm: finiteNumber(channels["0"]),
        speed: finiteNumber(channels["2"]),
        n_gear: finiteNumber(channels["3"]),
        throttle: finiteNumber(channels["4"]),
        brake: finiteNumber(channels["5"]) ? 100 : 0,
        drs: finiteNumber(channels["45"]),
      });
    }
  }
  return Array.from(latest.values());
}

function parseF1TimingWeatherState(state) {
  const air = finiteNumber(state?.AirTemp);
  const track = finiteNumber(state?.TrackTemp);
  const rain = finiteNumber(state?.Rainfall);
  const wind = finiteNumber(state?.WindSpeed);
  const humidity = finiteNumber(state?.Humidity);
  return {
    air: air ?? "",
    track: track ?? "",
    cond: rain != null ? (rain > 0 ? "Rain" : "Dry") : "",
    rain: rain != null ? `${Math.round(rain * 100)}%` : "",
    wind: wind != null ? `${Math.round(wind * 3.6)} km/h` : "",
    humidity: humidity != null ? `${Math.round(humidity)}%` : "",
  };
}

function parseF1TimingSessionClock(sessionData, targetSeconds) {
  const clockEntry = f1TimingLatestEntryAt(sessionData.clockEntries || [], targetSeconds);
  const clockState = clockEntry?.data || {};
  const statusState = f1TimingStateAt(sessionData.sessionStatusEntries || [], targetSeconds);
  const rawRemaining = f1TimingValue(clockState?.Remaining).trim();
  const remainingSeconds = f1TimingDurationSeconds(rawRemaining);
  const elapsedSinceClock = Math.max(0, Number(targetSeconds || 0) - Number(clockEntry?.seconds || targetSeconds || 0));
  const remaining = clockState?.Extrapolating && remainingSeconds != null
    ? formatF1TimingDuration(remainingSeconds - elapsedSinceClock)
    : rawRemaining;
  const status = String(statusState?.Status || statusState?.SessionStatus || statusState?.Started || "").trim();
  return {
    remaining,
    status,
    extrapolating: Boolean(clockState?.Extrapolating),
    utc: clockState?.Utc || "",
  };
}

function parseF1TimingArchiveRows(sessionData, elapsedSeconds, options = {}) {
  const targetElapsedSeconds = Math.max(0, Number(elapsedSeconds || 0));
  const videoStartArchiveSeconds = f1TimingVideoStartArchiveSeconds(sessionData, options);
  const timingAnchor = videoStartArchiveSeconds != null
    ? "video"
    : options.alignToSessionStart || options.timingAnchor === "session" ? "session" : "program";
  let targetSeconds = targetElapsedSeconds;
  if (timingAnchor === "video") targetSeconds = videoStartArchiveSeconds + targetElapsedSeconds;
  if (timingAnchor === "session") targetSeconds = f1TimingSessionStartSeconds(sessionData) + targetElapsedSeconds;
  const driverState = f1TimingStateAt(sessionData.driverListEntries, targetSeconds);
  const timingState = f1TimingStateAt(sessionData.timingEntries, targetSeconds);
  const appState = f1TimingStateAt(sessionData.timingAppEntries, targetSeconds);
  const weatherState = f1TimingStateAt(sessionData.weatherEntries, targetSeconds);
  const carState = f1TimingStateAt(sessionData.carDataEntries, targetSeconds);
  const sessionClock = parseF1TimingSessionClock(sessionData, targetSeconds);
  const telemetryRows = f1TimingTelemetryFromCarData(carState);
  const telemetryByNumber = latestCarDataByDriverNumber(telemetryRows);
  const lines = timingState?.Lines || {};
  const appLines = appState?.Lines || {};
  const rows = Object.entries(lines).map(([numberText, line]) => {
    const number = Number(line?.RacingNumber || numberText);
    const driver = driverState?.[numberText] || driverState?.[String(number)] || {};
    const appLine = appLines?.[numberText] || appLines?.[String(number)] || {};
    const stint = f1TimingLatestStint(appLine);
    const lastSeconds = f1TimingLapSeconds(line?.LastLapTime);
    const bestSeconds = f1TimingLapSeconds(line?.BestLapTime);
    const pos = finiteNumber(line?.Position) ?? finiteNumber(line?.Line) ?? finiteNumber(driver.Line) ?? 99;
    const gapValue = f1TimingValue(line?.GapToLeader);
    const intervalValue = f1TimingValue(line?.IntervalToPositionAhead);
    return {
      pos,
      code: String(driver?.Tla || line?.Tla || numberText).toUpperCase(),
      number,
      last: lastSeconds != null ? formatLapDuration(lastSeconds) : f1TimingValue(line?.LastLapTime),
      best: bestSeconds != null ? formatLapDuration(bestSeconds) : f1TimingValue(line?.BestLapTime),
      lastLapDuration: lastSeconds,
      bestLapDuration: bestSeconds,
      state: line?.InPit ? "PIT" : line?.Stopped ? "STOP" : null,
      gap: gapValue || (pos === 1 ? "LEADER" : "—"),
      interval: intervalValue || "—",
      trend: "flat",
      comp: normalizeCompound(stint?.Compound),
      age: finiteNumber(stint?.TotalLaps) ?? "",
      pits: "",
      stints: f1TimingStints(appLine).map((item) => ({
        compound: normalizeCompound(item?.Compound) || "unknown",
        lapStart: finiteNumber(item?.LapNumber),
        lapEnd: finiteNumber(item?.LapNumber),
        laps: finiteNumber(item?.TotalLaps),
        tyreAgeAtStart: finiteNumber(item?.StartLaps),
      })),
      sectors: {
        s1: f1TimingSegments(line?.Sectors?.["0"]),
        s2: f1TimingSegments(line?.Sectors?.["1"]),
        s3: f1TimingSegments(line?.Sectors?.["2"]),
      },
      telemetry: telemetryByNumber.get(number) || {},
    };
  }).filter((row) => row.code && row.pos).sort((a, b) => a.pos - b.pos);
  const timingRows = fillF1TimingQualifyingDeltas(rows);
  return { timing: timingRows, weather: parseF1TimingWeatherState(weatherState), sessionClock, diagnostics: {
    timingAnchor,
    videoStartArchiveSeconds,
    sessionStartSeconds: f1TimingSessionStartSeconds(sessionData),
    targetSeconds,
    driverRows: Object.keys(driverState || {}).length,
    timingLines: timingRows.length,
    timingEntries: sessionData.timingEntries?.length || 0,
    timingAppEntries: sessionData.timingAppEntries?.length || 0,
    clockEntries: sessionData.clockEntries?.length || 0,
    sessionStatusEntries: sessionData.sessionStatusEntries?.length || 0,
    weatherEntries: sessionData.weatherEntries?.length || 0,
    carDataEntries: sessionData.carDataEntries?.length || 0,
    telemetryRows: telemetryRows.length,
  } };
}

async function getReplayF1TimingSessionData(meetingKey, sessionKind) {
  const normalizedKind = normalizeOpenF1SessionKind(sessionKind || "Race");
  const cacheKey = `${meetingKey}:${normalizedKind}`;
  const cached = replayF1TimingCache.get(cacheKey);
  const maxAgeMs = 1000 * 60 * 60;
  if (cached && Date.now() - cached.createdAt < maxAgeMs) return cached.data;

  const meetings = await requestOpenF1Json(openF1ApiUrl("meetings", { meeting_key: meetingKey })).catch(() => []);
  const sessions = await requestOpenF1Json(openF1ApiUrl("sessions", { meeting_key: meetingKey }));
  const meeting = meetings?.[0] || {};
  const selectedSession = (sessions || [])
    .slice()
    .sort((a, b) => scoreOpenF1ReplaySession(b, sessionKind) - scoreOpenF1ReplaySession(a, sessionKind))[0];
  if (!selectedSession?.session_key) throw new Error(`No ${sessionKind} session matched this replay.`);
  const archive = await resolveF1TimingArchiveBase(meeting, selectedSession);
  const baseUrl = archive.baseUrl;
  const [driverListText, timingText, appText, clockText, statusText, weatherText, carText] = await Promise.all([
    f1TimingRequestText(`${baseUrl}DriverList.jsonStream`).catch(() => ""),
    f1TimingRequestText(`${baseUrl}TimingData.jsonStream`),
    f1TimingRequestText(`${baseUrl}TimingAppData.jsonStream`).catch(() => ""),
    f1TimingRequestText(`${baseUrl}ExtrapolatedClock.jsonStream`).catch(() => ""),
    f1TimingRequestText(`${baseUrl}SessionStatus.jsonStream`).catch(() => ""),
    f1TimingRequestText(`${baseUrl}WeatherData.jsonStream`).catch(() => ""),
    f1TimingRequestText(`${baseUrl}CarData.z.jsonStream`).catch(() => ""),
  ]);
  const data = {
    ok: true,
    source: "Formula 1 livetiming",
    meeting,
    selectedSession,
    baseUrl,
    driverListEntries: driverListText ? parseF1TimingJsonStream(driverListText) : [],
    timingEntries: parseF1TimingJsonStream(timingText),
    timingAppEntries: appText ? parseF1TimingJsonStream(appText) : [],
    clockEntries: clockText ? parseF1TimingJsonStream(clockText) : [],
    sessionStatusEntries: statusText ? parseF1TimingJsonStream(statusText) : [],
    weatherEntries: weatherText ? parseF1TimingJsonStream(weatherText) : [],
    carDataEntries: carText ? parseF1TimingJsonStream(carText, { zipped: true }) : [],
  };
  replayF1TimingCache.set(cacheKey, { createdAt: Date.now(), data });
  if (replayF1TimingCache.size > 12) replayF1TimingCache = new Map(Array.from(replayF1TimingCache.entries()).slice(-8));
  return data;
}

function requestF1TimingJsonPost(targetUrl, timeout = 10000) {
  return new Promise((resolve, reject) => {
    const endpoint = new URL(targetUrl);
    const req = https.request({
      method: "POST",
      hostname: endpoint.hostname,
      path: `${endpoint.pathname}${endpoint.search}`,
      headers: f1TimingHeaders({ "Content-Length": 0 }),
      timeout,
    }, (res) => {
      let text = "";
      res.setEncoding("utf8");
      res.on("data", (chunk) => { text += chunk; });
      res.on("end", () => {
        if (res.statusCode < 200 || res.statusCode >= 300) {
          const error = new Error(`HTTP ${res.statusCode} for Formula 1 live timing negotiate`);
          error.statusCode = res.statusCode;
          reject(error);
          return;
        }
        try {
          resolve(JSON.parse(stripJsonBom(text)));
        } catch (error) {
          reject(error);
        }
      });
    });
    req.on("timeout", () => req.destroy(new Error("Timeout for Formula 1 live timing negotiate")));
    req.on("error", reject);
    req.end();
  });
}

function boundedF1TimingLiveEntries(topic) {
  if (!f1LiveTimingState.entriesByTopic[topic]) f1LiveTimingState.entriesByTopic[topic] = [];
  const rows = f1LiveTimingState.entriesByTopic[topic];
  if (rows.length > 1000) rows.splice(0, rows.length - 700);
  return rows;
}

function f1TimingLivePayload(topic, payload) {
  if (payload == null || payload === "") return null;
  if (typeof payload === "string") {
    const parsed = JSON.parse(payload);
    return topic.endsWith(".z") ? decodeF1TimingZPayload(parsed) : parsed;
  }
  return topic.endsWith(".z") ? decodeF1TimingZPayload(payload) : payload;
}

function applyF1TimingLiveFeed(topic, payload) {
  if (!f1LiveTimingState || !topic) return;
  try {
    const data = f1TimingLivePayload(String(topic), payload);
    if (!data || typeof data !== "object") return;
    const rows = boundedF1TimingLiveEntries(String(topic));
    rows.push({ time: "", seconds: Date.now() / 1000, data });
    f1LiveTimingState.lastMessageAt = Date.now();
    f1LiveTimingState.lastTopic = String(topic);
  } catch (error) {
    f1LiveTimingState.lastError = "Formula 1 live timing payload could not be parsed.";
  }
}

function applyF1TimingSignalRMessage(message) {
  if (!message || typeof message !== "object") return;
  if (message.type === 1 && String(message.target || "").toLowerCase() === "feed") {
    const args = message.arguments || message.A || [];
    if (args.length >= 2) applyF1TimingLiveFeed(args[0], args[1]);
    return;
  }
  const result = message.result || message.R;
  if (result && typeof result === "object") {
    for (const [topic, payload] of Object.entries(result)) applyF1TimingLiveFeed(topic, payload);
  }
}

async function ensureF1TimingLiveClient() {
  if (f1LiveTimingClient?.connecting || f1LiveTimingClient?.connected) return;
  const now = Date.now();
  if (f1LiveTimingClient?.nextAttemptAt && now < f1LiveTimingClient.nextAttemptAt) return;
  const WebSocketImpl = globalThis.WebSocket;
  if (typeof WebSocketImpl !== "function") {
    f1LiveTimingClient = { connected: false, nextAttemptAt: now + 60000, error: "WebSocket unavailable" };
    return;
  }
  f1LiveTimingClient = { connecting: true, connected: false, nextAttemptAt: now + 30000 };
  f1LiveTimingState = f1LiveTimingState || { entriesByTopic: {}, lastMessageAt: 0, lastTopic: "", lastError: "" };
  try {
    const negotiate = await requestF1TimingJsonPost(F1_TIMING_NEGOTIATE_URL);
    const connectionId = String(negotiate?.connectionId || negotiate?.connectionToken || "");
    if (!connectionId) throw new Error("Formula 1 live timing did not return a SignalR connection id.");
    const subscriptionToken = String(await getSecret("f1tv-token") || "").trim();
    const liveUrl = new URL(F1_TIMING_SIGNALR_URL);
    liveUrl.searchParams.set("id", connectionId);
    if (subscriptionToken) liveUrl.searchParams.set("access_token", subscriptionToken);
    const ws = new WebSocketImpl(liveUrl.href);
    f1LiveTimingClient.socket = ws;
    ws.onopen = () => {
      f1LiveTimingClient.connected = true;
      f1LiveTimingClient.connecting = false;
      ws.send(`${JSON.stringify({ protocol: "json", version: 1 })}\x1e`);
      ws.send(`${JSON.stringify({ type: 1, target: "Subscribe", arguments: [F1_TIMING_SIGNALR_TOPICS], invocationId: "0" })}\x1e`);
    };
    ws.onmessage = async (event) => {
      const text = typeof event.data === "string" ? event.data : Buffer.from(await event.data.arrayBuffer?.() || event.data).toString("utf8");
      for (const chunk of String(text).split("\x1e").filter(Boolean)) {
        try {
          applyF1TimingSignalRMessage(JSON.parse(chunk));
        } catch {}
      }
    };
    ws.onerror = () => {
      f1LiveTimingClient.error = "Formula 1 live timing WebSocket error.";
    };
    ws.onclose = () => {
      f1LiveTimingClient.connected = false;
      f1LiveTimingClient.connecting = false;
      f1LiveTimingClient.nextAttemptAt = Date.now() + 10000;
    };
  } catch (error) {
    f1LiveTimingClient = {
      connected: false,
      connecting: false,
      nextAttemptAt: Date.now() + 30000,
      error: error?.message || "Formula 1 live timing unavailable",
    };
  }
}

function getF1LiveTimingSnapshot(options = {}) {
  ensureF1TimingLiveClient().catch(() => {});
  if (!f1LiveTimingState?.lastMessageAt || Date.now() - f1LiveTimingState.lastMessageAt > F1_TIMING_LIVE_STALE_MS) return null;
  const entriesByTopic = f1LiveTimingState.entriesByTopic || {};
  const targetLatencySeconds = Math.max(0, Math.min(90, Number(options.targetLatencySeconds || 0)));
  const targetSeconds = Date.now() / 1000 - targetLatencySeconds;
  const parsed = parseF1TimingArchiveRows({
    driverListEntries: entriesByTopic.DriverList || [],
    timingEntries: entriesByTopic.TimingData || [],
    timingAppEntries: entriesByTopic.TimingAppData || [],
    clockEntries: entriesByTopic.ExtrapolatedClock || [],
    sessionStatusEntries: entriesByTopic.SessionStatus || [],
    weatherEntries: entriesByTopic.WeatherData || [],
    carDataEntries: entriesByTopic["CarData.z"] || [],
  }, targetLatencySeconds ? targetSeconds : Number.MAX_SAFE_INTEGER);
  if (!parsed.timing.length && targetLatencySeconds) {
    const latest = parseF1TimingArchiveRows({
        driverListEntries: entriesByTopic.DriverList || [],
        timingEntries: entriesByTopic.TimingData || [],
        timingAppEntries: entriesByTopic.TimingAppData || [],
        clockEntries: entriesByTopic.ExtrapolatedClock || [],
        sessionStatusEntries: entriesByTopic.SessionStatus || [],
        weatherEntries: entriesByTopic.WeatherData || [],
        carDataEntries: entriesByTopic["CarData.z"] || [],
      }, Number.MAX_SAFE_INTEGER);
    if (latest.timing.length) {
      return {
        ok: true,
        sourceLabel: "Formula 1 live timing buffer warming",
        fetchedAt: new Date().toISOString(),
        timing: latest.timing,
        weather: latest.weather,
        sessionClock: latest.sessionClock,
        errors: [],
        diagnostics: latest.diagnostics,
        message: "Timing is using latest rows until the latency buffer catches up.",
      };
    }
  }
  if (!parsed.timing.length) return null;
  return {
    ok: true,
    sourceLabel: targetLatencySeconds ? `Formula 1 live timing -${Math.round(targetLatencySeconds)}s` : "Formula 1 live timing",
    fetchedAt: new Date().toISOString(),
    timing: parsed.timing,
    weather: parsed.weather,
    sessionClock: parsed.sessionClock,
    errors: [],
    diagnostics: parsed.diagnostics,
    message: "",
  };
}

function pickOpenF1WeatherSession(sessions) {
  const now = Date.now();
  const candidates = (sessions || [])
    .filter((session) => session?.session_key)
    .map((session) => ({
      session,
      start: Date.parse(session.date_start || ""),
      end: Date.parse(session.date_end || ""),
    }))
    .filter((item) => Number.isFinite(item.start));
  const live = candidates
    .filter((item) => item.start <= now && (!Number.isFinite(item.end) || now <= item.end + 1000 * 60 * 30))
    .sort((a, b) => b.start - a.start)[0];
  if (live) return live.session;
  return candidates
    .filter((item) => item.start <= now)
    .sort((a, b) => b.start - a.start)[0]?.session || null;
}

async function fetchOpenF1WeekendWeather(race) {
  const meetingKey = String(race?.meetingKey || "").replace(/[^0-9]/g, "");
  if (!meetingKey) return [];
  const sessions = await requestOpenF1Json(openF1ApiUrl("sessions", { meeting_key: meetingKey })).catch(() => []);
  const session = pickOpenF1WeatherSession(sessions);
  if (!session?.session_key) return [];
  return requestOpenF1Json(openF1ApiUrl("weather", { session_key: session.session_key })).catch(() => []);
}

function openF1ApiUrl(resource, params = {}) {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") query.set(key, String(value));
  });
  return `https://api.openf1.org/v1/${resource}?${query.toString()}`;
}

function normalizeOpenF1SessionKind(value) {
  const text = String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  if (/sprint qualifying|sprint shootout/.test(text)) return "sprint qualifying";
  if (/practice 1|free practice 1|fp1/.test(text)) return "practice 1";
  if (/practice 2|free practice 2|fp2/.test(text)) return "practice 2";
  if (/practice 3|free practice 3|fp3/.test(text)) return "practice 3";
  if (/qualifying|quali/.test(text)) return "qualifying";
  if (/sprint/.test(text)) return "sprint";
  if (/race|grand prix/.test(text)) return "race";
  return text;
}

function scoreOpenF1ReplaySession(session, requestedKind) {
  const requested = normalizeOpenF1SessionKind(requestedKind);
  const name = normalizeOpenF1SessionKind(session.session_name);
  const type = normalizeOpenF1SessionKind(session.session_type);
  let score = 0;
  if (requested && name === requested) score += 10;
  if (requested && type === requested) score += 8;
  if (requested && name.includes(requested)) score += 5;
  if (requested && type.includes(requested)) score += 4;
  if (requested === "race" && /race/.test(`${name} ${type}`)) score += 3;
  if (requested === "qualifying" && /qualifying/.test(`${name} ${type}`)) score += 3;
  return score;
}

function replayRowDateMs(row) {
  const value = Date.parse(row?.date || row?.date_start || row?.date_time || row?.timestamp || row?.date_end || "");
  return Number.isFinite(value) ? value : null;
}

function filterReplayRowsAt(rows, targetMs) {
  if (!Array.isArray(rows) || !rows.length) return [];
  return rows
    .map((row, index) => ({ row, index, rowMs: replayRowDateMs(row) }))
    .filter((item) => item.rowMs == null || item.rowMs <= targetMs)
    .sort((a, b) => (a.rowMs ?? 0) - (b.rowMs ?? 0) || a.index - b.index)
    .map((item) => item.row);
}

function firstReplayRowDateMs(rows) {
  for (const row of rows || []) {
    const rowMs = replayRowDateMs(row);
    if (Number.isFinite(rowMs)) return rowMs;
  }
  return null;
}

function lastReplayRowDateMs(rows) {
  for (let index = (rows || []).length - 1; index >= 0; index -= 1) {
    const rowMs = replayRowDateMs(rows[index]);
    if (Number.isFinite(rowMs)) return rowMs;
  }
  return null;
}

async function getReplayCarDataOffsetMs(sessionKey, positions, drivers) {
  const anchorDriverNumber = Number(positions?.[0]?.driver_number || drivers?.[0]?.driver_number || 0);
  if (!Number.isFinite(anchorDriverNumber) || anchorDriverNumber <= 0) return 0;
  const anchorRows = await requestOpenF1Json(openF1ApiUrl("car_data", {
    session_key: sessionKey,
    driver_number: anchorDriverNumber,
  })).catch(() => []);
  const firstPositionMs = firstReplayRowDateMs(positions);
  const firstCarDataMs = firstReplayRowDateMs(anchorRows);
  const lastCarDataMs = lastReplayRowDateMs(anchorRows);
  if (!Number.isFinite(firstPositionMs) || !Number.isFinite(firstCarDataMs)) return 0;
  if (Number.isFinite(lastCarDataMs) && firstCarDataMs <= firstPositionMs && lastCarDataMs >= firstPositionMs) return 0;
  return firstCarDataMs - firstPositionMs;
}

async function getReplayOpenF1SessionData(meetingKey, sessionKind) {
  const normalizedKind = normalizeOpenF1SessionKind(sessionKind || "Race");
  const cacheKey = `${meetingKey}:${normalizedKind}`;
  const cached = replayOpenF1Cache.get(cacheKey);
  const maxAgeMs = 1000 * 60 * 30;
  if (cached && Date.now() - cached.createdAt < maxAgeMs) return cached.data;

  try {
    const sessions = await requestOpenF1Json(openF1ApiUrl("sessions", { meeting_key: meetingKey }));
    const selectedSession = (sessions || [])
      .slice()
      .sort((a, b) => scoreOpenF1ReplaySession(b, sessionKind) - scoreOpenF1ReplaySession(a, sessionKind))[0];
    if (!selectedSession?.session_key) {
      return { ok: false, message: `No OpenF1 ${sessionKind} session matched this replay.` };
    }

    const sessionKey = selectedSession.session_key;
    const drivers = await requestOpenF1Json(openF1ApiUrl("drivers", { session_key: sessionKey })).catch(() => []);
    const positions = await requestOpenF1Json(openF1ApiUrl("position", { session_key: sessionKey })).catch(() => []);
    const intervals = await requestOpenF1Json(openF1ApiUrl("intervals", { session_key: sessionKey })).catch(() => []);
    const weatherRows = await requestOpenF1Json(openF1ApiUrl("weather", { session_key: sessionKey })).catch(() => []);
    const openF1Laps = await requestOpenF1Json(openF1ApiUrl("laps", { session_key: sessionKey })).catch(() => []);
    const stints = await requestOpenF1Json(openF1ApiUrl("stints", { session_key: sessionKey })).catch(() => []);
    const pitRows = await requestOpenF1Json(openF1ApiUrl("pit", { session_key: sessionKey })).catch(() => []);
    const carDataOffsetMs = await getReplayCarDataOffsetMs(sessionKey, positions, drivers);
    const data = { ok: true, selectedSession, drivers, positions, intervals, weatherRows, openF1Laps, stints, pitRows, carDataOffsetMs };
    replayOpenF1Cache.set(cacheKey, { createdAt: Date.now(), data });
    if (replayOpenF1Cache.size > 24) replayOpenF1Cache = new Map(Array.from(replayOpenF1Cache.entries()).slice(-16));
    return data;
  } catch (error) {
    if (cached?.data) return cached.data;
    throw error;
  }
}

async function getReplayCarDataSnapshot(sessionKey, targetMs, carDataOffsetMs = 0) {
  const carDataTargetMs = targetMs + carDataOffsetMs;
  const from = new Date(Math.max(0, carDataTargetMs - 120000)).toISOString();
  const to = new Date(carDataTargetMs + 1000).toISOString();
  return requestOpenF1Json(openF1ApiUrl("car_data", {
    session_key: sessionKey,
    "date>": from,
    "date<": to,
  })).catch(() => []);
}

async function getReplayOpenF1TimingSnapshot(options = {}) {
  const meetingKey = String(options.meetingKey || "").replace(/[^0-9]/g, "");
  if (!meetingKey) return { ok: false, timing: [], weather: {}, message: "Replay timing needs an OpenF1 meeting key." };
  const sessionKind = String(options.sessionKind || "Race");
  const elapsedSeconds = Math.max(0, Number(options.elapsedSeconds || 0));
  const cacheKey = `${meetingKey}:${normalizeOpenF1SessionKind(sessionKind)}:${Math.floor(elapsedSeconds / 5)}`;
  const cached = replayTimingCache.get(cacheKey);
  if (cached && Date.now() - cached.createdAt < 5000) return cached.data;

  const sessionData = await getReplayOpenF1SessionData(meetingKey, sessionKind);
  const selectedSession = sessionData.selectedSession;
  if (!sessionData.ok || !selectedSession?.session_key) return { ok: false, timing: [], weather: {}, sourceLabel: "Replay timing unavailable", message: sessionData.message || "OpenF1 replay timing is unavailable." };

  const startMs = Date.parse(selectedSession.date_start || "");
  if (!Number.isFinite(startMs)) {
    return { ok: false, timing: [], weather: {}, sessionKey: selectedSession.session_key, message: "OpenF1 did not provide a replay session start time." };
  }

  const targetMs = startMs + elapsedSeconds * 1000;
  const targetDate = new Date(targetMs).toISOString();
  const sessionKey = selectedSession.session_key;
  const positions = filterReplayRowsAt(sessionData.positions, targetMs);
  const intervals = filterReplayRowsAt(sessionData.intervals, targetMs);
  const weatherRows = filterReplayRowsAt(sessionData.weatherRows, targetMs);
  const laps = filterReplayRowsAt(sessionData.openF1Laps, targetMs);
  const stints = filterReplayRowsAt(sessionData.stints, targetMs);
  const pitRows = filterReplayRowsAt(sessionData.pitRows, targetMs);
  const carData = await getReplayCarDataSnapshot(sessionKey, targetMs, sessionData.carDataOffsetMs || 0);
  const timing = parseTiming(sessionData.drivers, positions, intervals, [], stints, pitRows, laps, carData);
  const data = {
    ok: timing.length > 0,
    sessionKey,
    sessionKind: selectedSession.session_name || sessionKind,
    targetDate,
    elapsedSeconds,
    sourceLabel: `Replay timing ${Math.floor(elapsedSeconds / 60)}:${String(Math.floor(elapsedSeconds % 60)).padStart(2, "0")}`,
    timing,
    weather: parseWeather(weatherRows),
    diagnostics: {
      positionRows: positions.length,
      intervalRows: intervals.length,
      lapRows: laps.length,
      cachedLapRows: Array.isArray(sessionData.openF1Laps) ? sessionData.openF1Laps.length : 0,
      stintRows: stints.length,
      cachedStintRows: Array.isArray(sessionData.stints) ? sessionData.stints.length : 0,
      pitRows: pitRows.length,
      carDataRows: carData.length,
      carDataOffsetSeconds: Math.round((sessionData.carDataOffsetMs || 0) / 1000),
    },
    message: timing.length ? "" : "OpenF1 has no timing rows at this replay time yet.",
  };
  replayTimingCache.set(cacheKey, { createdAt: Date.now(), data });
  if (replayTimingCache.size > 120) replayTimingCache = new Map(Array.from(replayTimingCache.entries()).slice(-80));
  return data;
}

async function getReplayTimingSnapshot(options = {}) {
  const meetingKey = String(options.meetingKey || "").replace(/[^0-9]/g, "");
  if (!meetingKey) return { ok: false, timing: [], weather: {}, message: "Replay timing needs an OpenF1 meeting key." };
  const sessionKind = String(options.sessionKind || "Race");
  const elapsedSeconds = Math.max(0, Number(options.elapsedSeconds || 0));
  const videoStartKey = options.videoStartUtc || String(finiteNumber(options.videoStartArchiveSeconds) ?? "");
  const cacheKey = `f1:${meetingKey}:${normalizeOpenF1SessionKind(sessionKind)}:${Math.floor(elapsedSeconds * 4)}:${videoStartKey}`;
  const cached = replayTimingCache.get(cacheKey);
  if (cached && Date.now() - cached.createdAt < 5000) return cached.data;

  try {
    const sessionData = await getReplayF1TimingSessionData(meetingKey, sessionKind);
    const parsed = parseF1TimingArchiveRows(sessionData, elapsedSeconds, {
      timingAnchor: "program",
      videoStartUtc: options.videoStartUtc,
      videoStartArchiveSeconds: options.videoStartArchiveSeconds,
    });
    if (parsed.timing.length) {
      const data = {
        ok: true,
        sessionKey: sessionData.selectedSession?.session_key,
        sessionKind: sessionData.selectedSession?.session_name || sessionKind,
        elapsedSeconds,
        targetDate: "",
        sourceLabel: parsed.diagnostics?.timingAnchor === "video"
          ? "F1 timing synced"
          : `F1 timing ${Math.floor(elapsedSeconds / 60)}:${String(Math.floor(elapsedSeconds % 60)).padStart(2, "0")}`,
        timing: parsed.timing,
        weather: parsed.weather,
        sessionClock: parsed.sessionClock,
        diagnostics: parsed.diagnostics,
        message: parsed.timing.some((row) => row.last || row.best) ? "" : "Formula 1 timing is loaded; lap times will appear once the session has data.",
      };
      replayTimingCache.set(cacheKey, { createdAt: Date.now(), data });
      if (replayTimingCache.size > 120) replayTimingCache = new Map(Array.from(replayTimingCache.entries()).slice(-80));
      return data;
    }
  } catch (error) {
    writePitWallDebugLog("f1timing.replay-fallback", {
      meetingKey,
      sessionKind,
      message: error?.message || "Formula 1 timing unavailable",
    });
  }

  const fallback = await getReplayOpenF1TimingSnapshot(options);
  return {
    ...fallback,
    sourceLabel: fallback.sourceLabel || "OpenF1 replay timing fallback",
    message: fallback.message || "",
  };
}

async function getLiveTimingSnapshot(options = {}) {
  const targetLatencySeconds = Math.max(0, Math.min(90, Number(options.targetLatencySeconds || 0)));
  const f1Timing = getF1LiveTimingSnapshot({ targetLatencySeconds });
  if (f1Timing?.timing?.length) return f1Timing;
  const cacheKey = `openf1:${Math.round(targetLatencySeconds)}`;
  if (liveTimingCache?.key === cacheKey && Date.now() - liveTimingCache.createdAt < 15000) return liveTimingCache.data;
  const keys = ["openF1Drivers", "openF1Position", "openF1Intervals", "openF1Laps", "openF1Stints", "openF1Pit", "openF1Weather", "openF1CarData"];
  const entries = [];
  for (const key of keys) {
    try {
      const url = key === "openF1CarData"
        ? openF1ApiUrl("car_data", { session_key: "latest", "date>": new Date(Date.now() - 10000).toISOString() })
        : LIVE_DATA_URLS[key];
      entries.push({ key, value: await requestOpenF1Json(url) });
    } catch (error) {
      entries.push({ key, error });
    }
  }
  const raw = {};
  const errors = [];
  for (const result of entries) {
    if (!result.error) raw[result.key] = result.value;
    else if (!OPTIONAL_LIVE_DATA_KEYS.has(result.key)) errors.push(result.error.message);
  }
  const timing = parseTiming(raw.openF1Drivers, raw.openF1Position, raw.openF1Intervals, [], raw.openF1Stints, raw.openF1Pit, raw.openF1Laps, raw.openF1CarData);
  const weather = parseWeather(raw.openF1Weather || []);
  const data = {
    ok: timing.length > 0,
    sourceLabel: errors.length ? `Live timing (${errors.length} source issue${errors.length === 1 ? "" : "s"})` : "Live timing",
    fetchedAt: new Date().toISOString(),
    timing,
    weather,
    errors,
    message: timing.length ? "" : "OpenF1 has no current live timing rows.",
  };
  liveTimingCache = { key: cacheKey, createdAt: Date.now(), data };
  return data;
}

function latestLapsByDriverNumber(rows) {
  const grouped = groupRowsByDriverNumber(rows);
  const map = new Map();
  for (const [number, laps] of grouped) {
    const latest = laps.slice().sort((a, b) => Number(a.lap_number || 0) - Number(b.lap_number || 0)).at(-1);
    if (latest) map.set(number, latest);
  }
  return map;
}

function buildStrategyContext({ race, seasonSummary, drivers, standings, constructors, timing, battlePairs, news, raw, weather }) {
  const driverByCode = new Map((drivers || []).map((driver) => [driver.code, driver]));
  const stintsByNumber = stintsByDriverNumber(raw.openF1Stints || []);
  const pitCounts = pitCountsByDriverNumber(raw.openF1Pit || []);
  const latestLaps = latestLapsByDriverNumber(raw.openF1Laps || []);
  const timingRows = timing?.length ? timing : standings;
  const tyreRows = (timingRows || []).map((row) => {
    const driver = driverByCode.get(row.code) || row.driver || {};
    const number = Number(driver.num || row.num || 0);
    const stints = stintsByNumber.get(number) || row.stints || [];
    const latestStint = latestStintForDriver(stints);
    const latestLap = latestLaps.get(number) || {};
    const pitStops = finiteNumber(row.pits) ?? pitCounts.get(number) ?? Math.max(0, Number(latestStint?.stintNumber || 1) - 1);
    return {
      pos: finiteNumber(row.pos),
      code: row.code,
      name: driver.name || row.code,
      team: driver.team || "",
      gap: row.gap || "",
      interval: row.interval || "",
      currentCompound: row.comp || (latestStint?.compound !== "unknown" ? latestStint?.compound : "") || "",
      tyreAge: finiteNumber(row.age) ?? (tyreAgeFromStint(latestStint) || null),
      pitStops,
      stints,
      lastLapNumber: finiteNumber(latestLap.lap_number),
      lastLapDuration: finiteNumber(latestLap.lap_duration),
      isPitOutLap: Boolean(latestLap.is_pit_out_lap),
    };
  }).filter((row) => row.code);
  const compoundsUsed = Array.from(new Set(tyreRows.flatMap((row) => [
    row.currentCompound,
    ...(row.stints || []).map((stint) => stint.compound),
  ]).filter(Boolean)));
  return {
    source: "OpenF1 latest session plus PitWall live feeds",
    generatedAt: new Date().toISOString(),
    race: {
      name: race?.name || "",
      circuit: race?.circuit || "",
      loc: race?.loc || "",
      round: race?.round || 0,
      lap: race?.lap || 0,
      laps: race?.laps || 0,
      weather,
    },
    seasonSummary,
    tyreStrategy: {
      available: tyreRows.some((row) => row.currentCompound || row.stints?.length || row.pitStops),
      compoundsUsed,
      drivers: tyreRows,
    },
    timing: (timing || []).slice(0, 22).map((row) => ({
      pos: row.pos,
      code: row.code,
      gap: row.gap,
      interval: row.interval,
      compound: row.comp,
      tyreAge: row.age,
      pitStops: row.pits,
    })),
    standings: (standings || []).slice(0, 22).map((row) => ({
      pos: row.pos,
      code: row.code,
      points: row.pts,
      wins: row.wins,
    })),
    constructors: (constructors || []).slice(0, 11).map((row) => ({
      pos: row.pos,
      team: row.name,
      code: row.abbr,
      points: row.pts,
    })),
    battles: battlePairs || [],
    newsDigest: (news || []).slice(0, 6).map((item) => ({
      source: item.source,
      title: item.title,
      category: item.category,
    })),
  };
}

function localDateKey(date = new Date()) {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

function copilotInsightsFilePath() {
  return path.join(app.getPath("userData"), COPILOT_INSIGHTS_FILE);
}

function sanitizeAiError(error) {
  return String(error?.message || error || "AI calculation failed.")
    .replace(/[A-Za-z0-9_-]{80,}/g, "[redacted]")
    .slice(0, 240);
}

async function readCopilotInsightsCache() {
  try {
    const raw = await fs.promises.readFile(copilotInsightsFilePath(), "utf8");
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

async function writeCopilotInsightsCache(value) {
  const filePath = copilotInsightsFilePath();
  await fs.promises.mkdir(path.dirname(filePath), { recursive: true });
  await fs.promises.writeFile(filePath, JSON.stringify(value, null, 2), "utf8");
  return value;
}

function currentRaceWeekend(schedule = []) {
  const done = (schedule || []).filter((race) => race.status === "done");
  return (schedule || []).find((race) => race.status === "live") || done.at(-1) || (schedule || []).find((race) => race.status === "upcoming") || {};
}

function nextRaceWeekend(schedule = []) {
  return (schedule || []).find((race) => race.status === "upcoming") || {};
}

function roundedMetric(value) {
  const number = finiteNumber(value);
  return number == null ? null : Math.round(number * 1000) / 1000;
}

function copilotSessionYear(race, data) {
  const fromRace = Date.parse(race?.startsAt || "");
  if (Number.isFinite(fromRace)) return new Date(fromRace).getUTCFullYear();
  const fromSummary = finiteNumber(data?.seasonSummary?.year || data?.seasonSummary?.season);
  return fromSummary || new Date().getFullYear();
}

function copilotSessionKindRank(kind) {
  const index = COPILOT_WEEKEND_SESSION_KINDS.indexOf(String(kind || ""));
  return index === -1 ? COPILOT_WEEKEND_SESSION_KINDS.length : index;
}

function copilotSessionIsUsable(session = {}) {
  const kind = String(session.kind || "");
  if (!COPILOT_WEEKEND_SESSION_KINDS.includes(kind)) return false;
  if (session.status && session.status !== "upcoming") return true;
  const startsAt = Date.parse(session.startsAt || "");
  return Number.isFinite(startsAt) && startsAt <= Date.now();
}

function compactDriverSessionSummary(row = {}) {
  const compounds = Array.from(new Set((row.stints || []).map((stint) => normalizeCompound(stint.compound)).filter(Boolean)));
  return {
    code: row.code || "",
    position: finiteNumber(row.position),
    laps: finiteNumber(row.laps),
    fastestLap: roundedMetric(row.fastestLap),
    avgLap: roundedMetric(row.avgLap),
    gapToLeader: row.gapToLeader ?? "",
    topSpeed: roundedMetric(row.topSpeed),
    pitStops: finiteNumber(row.pitStops),
    compounds,
    tyreDeg: roundedMetric(row.tyreDeg),
  };
}

function summarizeWeekendSessionForCopilot(session = {}, analytics = {}) {
  const drivers = Array.isArray(analytics.drivers) ? analytics.drivers : [];
  const topResults = drivers.slice(0, 10).map(compactDriverSessionSummary);
  const paceOrder = drivers
    .filter((row) => finiteNumber(row.fastestLap) != null)
    .slice()
    .sort((a, b) => finiteNumber(a.fastestLap) - finiteNumber(b.fastestLap))
    .slice(0, 10)
    .map(compactDriverSessionSummary);
  return {
    kind: session.kind || analytics.session?.name || "",
    status: session.status || "",
    startsAt: session.startsAt || analytics.session?.dateStart || "",
    available: drivers.length > 0,
    source: analytics.source || "OpenF1",
    fetchedAt: analytics.fetchedAt || "",
    session: {
      key: analytics.session?.key || "",
      name: analytics.session?.name || session.kind || "",
      type: analytics.session?.type || "",
    },
    weather: analytics.weather || {},
    counts: analytics.counts || {},
    topResults,
    paceOrder,
    errors: (analytics.errors || []).slice(0, 3),
  };
}

async function buildWeekendSessionSummaries(data, pageId) {
  if (pageId !== "current-weekend") return [];
  const race = currentRaceWeekend(data.schedule);
  const meetingKey = finiteNumber(race?.meetingKey);
  if (!meetingKey) return [];
  const sessions = (race.sessions || [])
    .filter(copilotSessionIsUsable)
    .sort((a, b) => copilotSessionKindRank(a.kind) - copilotSessionKindRank(b.kind));
  const season = copilotSessionYear(race, data);
  const summaries = [];
  for (const session of sessions.slice(0, 6)) {
    try {
      const analytics = await getAnalyticsSession({ season, meetingKey, sessionKind: session.kind });
      summaries.push(summarizeWeekendSessionForCopilot(session, analytics));
    } catch (error) {
      summaries.push({
        kind: session.kind || "",
        status: session.status || "",
        startsAt: session.startsAt || "",
        available: false,
        errors: [sanitizeAiError(error)],
      });
    }
  }
  return summaries;
}

async function dailyInsightSnapshot(data, pageId) {
  return {
    focus: pageId,
    race: data.race,
    currentRaceWeekend: currentRaceWeekend(data.schedule),
    nextRaceWeekend: nextRaceWeekend(data.schedule),
    seasonSummary: data.seasonSummary,
    standings: (data.standings || []).slice(0, 22),
    constructors: (data.constructors || []).slice(0, 11),
    timing: (data.timing || []).slice(0, 22),
    sessions: data.sessions || [],
    schedule: (data.schedule || []).slice(0, 30),
    strategyContext: data.strategyContext || null,
    weekendSessionSummaries: await buildWeekendSessionSummaries(data, pageId),
    news: (data.news || []).slice(0, 8),
    source: data.sourceLabel || data.source || "",
  };
}

function fallbackInsightBullets(data, pageId) {
  if (pageId === "drivers-championship") {
    return (data.standings || []).slice(0, 3).map((row) => `P${row.pos}: ${row.code} has ${row.pts} points.`);
  }
  if (pageId === "constructors-championship") {
    return (data.constructors || []).slice(0, 3).map((row) => `P${row.pos}: ${row.name || row.abbr} has ${row.pts} points.`);
  }
  if (pageId === "current-weekend") {
    const race = currentRaceWeekend(data.schedule);
    return [race.name ? `${race.name} is the loaded current weekend context.` : "Current weekend data is not loaded yet."];
  }
  const race = nextRaceWeekend(data.schedule);
  return [race.name ? `${race.name} is the next upcoming race weekend.` : "Next race weekend data is not loaded yet."];
}

function emptyDailyPredictions() {
  return {
    available: false,
    title: "",
    summary: "",
    winner: [],
    podium: [],
    watchlist: [],
    caveat: "AI race predictions are available after the Current weekend daily page is computed.",
  };
}

function fallbackCopilotInsightPages(data, summary) {
  return COPILOT_INSIGHT_PAGES.map((page) => ({
    ...page,
    summary,
    bullets: fallbackInsightBullets(data, page.id),
    alerts: [],
    visualization: null,
    predictions: emptyDailyPredictions(),
    computed: false,
  }));
}

async function hasConfiguredAiProvider() {
  try {
    const [grok, codex, anthropic, openai] = await Promise.all([
      getActiveOAuthSession("grok"),
      getActiveOAuthSession("codex"),
      getSecret("anthropic"),
      getSecret("openai"),
    ]);
    return Boolean(grok || codex || anthropic || openai);
  } catch {
    return false;
  }
}

function dailyInsightPrompt(page) {
  const instructions = [
    `Build the daily precomputed PitWall Copilot page for: ${page.title}.`,
    "Use only the provided snapshot. Do not invent tyre data, session results, weather, or factual claims not present in the snapshot.",
    "If the snapshot lacks enough data for a claim, say what is missing.",
    "Return concise race-engineer language with alerts only for real risks or uncertainties in the supplied data.",
  ];
  if (page.id === "current-weekend") {
    instructions.push("For this Current weekend page, compute AI predictions for the race winner, podium, and watchlist using only the supplied snapshot. Use snapshot.weekendSessionSummaries for FP1-FP3, sprint, qualifying, race-pace, weather, tyre, and session-result evidence when present. Put predictions in predictions with available=true, label them as projections, and explain the data behind each pick. If qualifying, race pace, weather, or timing data is missing, lower confidence and say so instead of filling gaps.");
  } else {
    instructions.push("For predictions, set available=false with empty winner, podium, and watchlist arrays.");
  }
  return instructions.join(" ");
}

function normalizePredictionCandidate(row = {}) {
  return {
    code: String(row.code || "").slice(0, 8),
    label: String(row.label || row.name || row.code || "").slice(0, 64),
    confidence: Math.max(0, Math.min(1, Number(row.confidence || 0) || 0)),
    probability: Math.max(0, Math.min(1, Number(row.probability || 0) || 0)),
    reason: String(row.reason || "").slice(0, 180),
  };
}

function normalizePredictionWatchItem(row = {}) {
  return {
    label: String(row.label || "").slice(0, 64),
    prediction: String(row.prediction || "").slice(0, 140),
    confidence: Math.max(0, Math.min(1, Number(row.confidence || 0) || 0)),
    reason: String(row.reason || "").slice(0, 180),
  };
}

function normalizeDailyPredictions(value) {
  if (!value || typeof value !== "object") return emptyDailyPredictions();
  return {
    available: Boolean(value.available),
    title: String(value.title || "").slice(0, 80),
    summary: String(value.summary || "").slice(0, 260),
    winner: Array.isArray(value.winner) ? value.winner.slice(0, 3).map(normalizePredictionCandidate) : [],
    podium: Array.isArray(value.podium) ? value.podium.slice(0, 3).map(normalizePredictionCandidate) : [],
    watchlist: Array.isArray(value.watchlist) ? value.watchlist.slice(0, 4).map(normalizePredictionWatchItem) : [],
    caveat: String(value.caveat || "").slice(0, 220),
  };
}

function normalizeDailyInsightPage(page, answer) {
  return {
    ...page,
    summary: String(answer?.summary || "The AI provider returned no summary for this page."),
    bullets: (answer?.alerts || []).slice(0, 4).map((alert) => [alert.title, alert.body].filter(Boolean).join(": ")).filter(Boolean),
    alerts: Array.isArray(answer?.alerts) ? answer.alerts.slice(0, 4) : [],
    visualization: answer?.visualization || null,
    predictions: normalizeDailyPredictions(answer?.predictions),
    computed: true,
  };
}

async function refreshDailyCopilotInsights(data, generatedOn) {
  const pending = {
    schemaVersion: COPILOT_INSIGHTS_SCHEMA_VERSION,
    status: "pending",
    attemptedOn: generatedOn,
    generatedOn: "",
    generatedAt: "",
    updatedAt: new Date().toISOString(),
    pages: fallbackCopilotInsightPages(data, "Daily AI insight generation has started and has not finished yet."),
  };
  await writeCopilotInsightsCache(pending);
  try {
    const pages = [];
    for (const page of COPILOT_INSIGHT_PAGES) {
      const answer = await askConfiguredAi({
        prompt: dailyInsightPrompt(page),
        snapshot: await dailyInsightSnapshot(data, page.id),
      });
      pages.push(normalizeDailyInsightPage(page, answer));
    }
    const ready = {
      schemaVersion: COPILOT_INSIGHTS_SCHEMA_VERSION,
      status: "ready",
      attemptedOn: generatedOn,
      generatedOn,
      generatedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      pages,
    };
    if (liveDataCache?.data) liveDataCache.data.copilot = { daily: ready };
    return writeCopilotInsightsCache(ready);
  } catch (error) {
    const failed = {
      schemaVersion: COPILOT_INSIGHTS_SCHEMA_VERSION,
      status: "failed",
      attemptedOn: generatedOn,
      generatedOn: "",
      generatedAt: "",
      updatedAt: new Date().toISOString(),
      error: sanitizeAiError(error),
      pages: fallbackCopilotInsightPages(data, `No AI projection computed today. Daily calculation failed: ${sanitizeAiError(error)}`),
    };
    if (liveDataCache?.data) liveDataCache.data.copilot = { daily: failed };
    return writeCopilotInsightsCache(failed);
  }
}

async function getDailyCopilotInsights(data) {
  const today = localDateKey();
  const cached = await readCopilotInsightsCache();
  const cachedSchemaMatches = cached?.schemaVersion === COPILOT_INSIGHTS_SCHEMA_VERSION;
  const usableCached = cachedSchemaMatches ? cached : null;
  if (usableCached?.generatedOn === today && usableCached.status === "ready") return usableCached;
  if (usableCached?.attemptedOn === today && usableCached.status !== "ready" && !shouldRetryDailyCopilotInsights(usableCached, today)) return usableCached;
  if (!(await hasConfiguredAiProvider())) {
    return {
      schemaVersion: COPILOT_INSIGHTS_SCHEMA_VERSION,
      status: "not_configured",
      attemptedOn: "",
      generatedOn: "",
      generatedAt: "",
      updatedAt: new Date().toISOString(),
      pages: fallbackCopilotInsightPages(data, "No AI projection computed. Connect an AI provider to generate daily prebuilt insights."),
    };
  }
  if (!copilotInsightRefresh) {
    copilotInsightRefresh = refreshDailyCopilotInsights(data, today)
      .catch(() => null)
      .finally(() => { copilotInsightRefresh = null; });
  }
  return usableCached || {
    schemaVersion: COPILOT_INSIGHTS_SCHEMA_VERSION,
    status: "pending",
    attemptedOn: today,
    generatedOn: "",
    generatedAt: "",
    updatedAt: new Date().toISOString(),
    pages: fallbackCopilotInsightPages(data, "Daily AI insight generation is queued for today."),
  };
}

function shouldRetryDailyCopilotInsights(cached, today, nowMs = Date.now(), retryMs = COPILOT_INSIGHT_RETRY_MS) {
  if (cached?.status !== "failed" || cached.attemptedOn !== today) return false;
  const updatedAtMs = Date.parse(cached.updatedAt || "");
  return !Number.isFinite(updatedAtMs) || nowMs - updatedAtMs >= retryMs;
}

async function fetchLiveDataEntries(urls) {
  const entries = await Promise.all(Object.entries(urls).map(async ([key, url]) => {
    const isXml = key.endsWith("News");
    try {
      return { key, value: isXml ? await requestText(url) : await requestMaybeOpenF1Json(url) };
    } catch (error) {
      return { key, error };
    }
  }));
  const raw = {};
  const errors = [];
  for (const result of entries) {
    if (!result.error) raw[result.key] = result.value;
    else if (!OPTIONAL_LIVE_DATA_KEYS.has(result.key)) errors.push(result.error.message);
  }
  return { raw, errors };
}

async function buildPitWallSnapshot(raw, errors = [], options = {}) {
  const fallbackData = readFallbackPitWallData();
  const driverResult = parseDriverStandings(raw.driverStandings);
  const constructors = parseConstructorStandings(raw.constructorStandings);
  const schedule = parseSchedule(raw.schedule, raw.openF1Meetings);
  const drivers = parseOpenDrivers(raw.openF1Drivers, fallbackData.drivers, driverResult.standings);
  const byCode = Object.fromEntries(drivers.map((driver) => [driver.code, driver]));
  const timing = parseTiming(raw.openF1Drivers, raw.openF1Position, raw.openF1Intervals, driverResult.standings, raw.openF1Stints, raw.openF1Pit, raw.openF1Laps, raw.openF1CarData);
  const battlePairs = detectBattlePairs(timing);
  const nextRace = schedule.find((race) => race.status === "live") || schedule.find((race) => race.status === "upcoming") || schedule.at(-1) || {};
  let weatherRows = Array.isArray(raw.openF1Weather) ? raw.openF1Weather : [];
  const latestWeatherMeetingKey = weatherRows.at(-1)?.meeting_key;
  if (nextRace.meetingKey && latestWeatherMeetingKey && String(latestWeatherMeetingKey) !== String(nextRace.meetingKey)) weatherRows = [];
  if (options.includeWeekendWeatherFallback !== false && !hasWeatherRows(weatherRows)) {
    const weekendWeatherRows = await fetchOpenF1WeekendWeather(nextRace);
    if (hasWeatherRows(weekendWeatherRows)) weatherRows = weekendWeatherRows;
  }
  const weather = parseWeather(weatherRows);
  const news = buildNewsFeed(raw);
  const race = {
    name: nextRace.name || "Current Formula 1 session",
    circuit: nextRace.circuit || "",
    loc: nextRace.loc || "",
    round: nextRace.rnd || 0,
    startsAt: nextRace.startsAt || "",
    weather,
  };
  const seasonSummary = {
    season: driverResult.seasonSummary.season,
    round: driverResult.seasonSummary.round || nextRace.rnd || 0,
    totalRounds: schedule.length,
  };
  const strategyContext = buildStrategyContext({
    race,
    seasonSummary,
    drivers,
    standings: driverResult.standings,
    constructors,
    timing,
    battlePairs,
    news,
    raw,
    weather,
  });
  const data = {
    source: "live",
    sourceLabel: errors.length ? `Live data (${errors.length} source issue${errors.length === 1 ? "" : "s"})` : "Live data",
    fetchedAt: new Date().toISOString(),
    errors,
    drivers,
    byCode,
    standings: driverResult.standings,
    constructors,
    schedule,
    sessions: nextRace.sessions || [],
    news,
    timing,
    battlePairs,
    insights: battlePairs.map((pair) => ({ ...pair })),
    strategyContext,
    seasonSummary,
    race,
    enrichmentPending: Boolean(options.enrichmentPending),
  };
  return data;
}

function refreshLiveDataEnrichment(baseRaw, baseErrors, baseData) {
  if (liveDataEnrichmentRefresh) return liveDataEnrichmentRefresh;
  liveDataEnrichmentRefresh = (async () => {
    const enrichment = await fetchLiveDataEntries(LIVE_TIMING_ENRICHMENT_URLS);
    const raw = { ...baseRaw, ...enrichment.raw };
    const data = await buildPitWallSnapshot(raw, baseErrors, {
      includeWeekendWeatherFallback: true,
      enrichmentPending: false,
    });
    data.copilot = baseData.copilot;
    if (liveDataCache?.data?.fetchedAt === baseData.fetchedAt) {
      liveDataCache = { createdAt: Date.now(), data };
    }
    return data;
  })().catch((error) => {
    writePitWallDebugLog("live-data.enrichment-failed", { message: error?.message || "OpenF1 enrichment failed" });
    if (liveDataCache?.data?.fetchedAt === baseData.fetchedAt) {
      liveDataCache = { createdAt: Date.now(), data: { ...baseData, enrichmentPending: false } };
    }
    return null;
  }).finally(() => {
    liveDataEnrichmentRefresh = null;
  });
  return liveDataEnrichmentRefresh;
}

async function getPitWallSnapshot() {
  if (liveDataCache && Date.now() - liveDataCache.createdAt < DATA_CACHE_MS) return liveDataCache.data;
  const { raw, errors } = await fetchLiveDataEntries(LIVE_CORE_DATA_URLS);
  const data = await buildPitWallSnapshot(raw, errors, {
    includeWeekendWeatherFallback: false,
    enrichmentPending: true,
  });
  data.copilot = { daily: await getDailyCopilotInsights(data) };
  liveDataCache = { createdAt: Date.now(), data };
  refreshLiveDataEnrichment(raw, errors, data);
  return data;
}

function readFallbackPitWallData() {
  try {
    const source = fs.readFileSync(path.join(app.getAppPath(), "ui_kits/pitwall/data.js"), "utf8");
    const sandbox = { window: {} };
    vm.createContext(sandbox);
    vm.runInContext(source, sandbox, { filename: "ui_kits/pitwall/data.js", timeout: 1000 });
    const data = sandbox.window.PW_DATA || {};
    return {
      drivers: Array.isArray(data.drivers) ? data.drivers : [],
      constructors: Array.isArray(data.constructors) ? data.constructors : [],
    };
  } catch {}
  return { drivers: [], constructors: [] };
}

function isF1TvUrl(targetUrl) {
  try {
    const host = new URL(targetUrl).hostname.toLowerCase();
    return F1TV_HOSTS.has(host) || host.endsWith(".formula1.com");
  } catch {
    return false;
  }
}

function isF1TvMediaUrl(targetUrl) {
  try {
    const parsed = new URL(String(targetUrl || ""));
    if (!/^https?:$/i.test(parsed.protocol)) return false;
    const host = parsed.hostname.toLowerCase();
    return host === "formula1.com" || host.endsWith(".formula1.com") || F1TV_MEDIA_CDN_HOSTS.has(host);
  } catch {
    return false;
  }
}

function sanitizeProxyRequestHeaders(headers = {}) {
  const blocked = new Set(["host", "origin", "referer", "cookie", "content-length", "connection"]);
  return Object.fromEntries(Object.entries(headers || {})
    .filter(([key, value]) => value != null && !blocked.has(String(key).toLowerCase()) && !String(key).toLowerCase().startsWith("sec-"))
    .map(([key, value]) => [key, Array.isArray(value) ? value.join(", ") : String(value)]));
}

function requestBuffer(targetUrl, options = {}, redirectsLeft = 4) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(targetUrl);
    const transport = parsed.protocol === "http:" ? http : https;
    const body = options.body ? Buffer.from(options.body) : null;
    const headers = sanitizeProxyRequestHeaders(options.headers || {});
    if (isF1TvMediaUrl(targetUrl)) {
      headers.Origin = "https://f1tv.formula1.com";
      headers.Referer = F1TV_HOME_URL;
      if (options.cookieHeader) headers.Cookie = String(options.cookieHeader);
      if (!headers["User-Agent"]) {
        headers["User-Agent"] = `Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${process.versions.chrome || "120.0.0.0"} Safari/537.36`;
      }
      if (body && !headers["Content-Type"] && !headers["content-type"]) headers["Content-Type"] = "application/octet-stream";
      if (body && !headers.Accept && !headers.accept) headers.Accept = "*/*";
    }
    if (body && !headers["content-length"] && !headers["Content-Length"]) headers["Content-Length"] = String(body.length);
    const req = transport.request(parsed, {
      method: String(options.method || "GET").toUpperCase(),
      headers,
      timeout: Number(options.timeoutMs || 20000),
    }, (res) => {
      const location = res.headers.location ? new URL(res.headers.location, targetUrl).href : "";
      if (location && redirectsLeft > 0 && [301, 302, 303, 307, 308].includes(res.statusCode || 0)) {
        res.resume();
        requestBuffer(location, options, redirectsLeft - 1).then(resolve, reject);
        return;
      }
      const chunks = [];
      res.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
      res.on("end", () => resolve({
        status: res.statusCode || 0,
        url: targetUrl,
        headers: Object.fromEntries(Object.entries(res.headers).map(([key, value]) => [key, Array.isArray(value) ? value.join(", ") : String(value || "")])),
        sentHeaderNames: Object.keys(headers),
        body: Buffer.concat(chunks),
      }));
    });
    req.on("timeout", () => req.destroy(new Error("F1 TV media request timed out.")));
    req.on("error", reject);
    if (body) req.write(body);
    req.end();
  });
}

async function f1TvCookieHeaderForUrl(targetUrl) {
  if (!isF1TvMediaUrl(targetUrl)) return "";
  const cookies = await session.defaultSession.cookies.get({ url: targetUrl }).catch(() => []);
  return cookies
    .filter((cookie) => cookie.name && cookie.value)
    .map((cookie) => `${cookie.name}=${cookie.value}`)
    .join("; ");
}

async function fetchF1TvMedia(_event, request = {}) {
  const targetUrl = String(request.url || "");
  const requestType = Number.isFinite(Number(request.requestType)) ? Number(request.requestType) : null;
  if (!isF1TvMediaUrl(targetUrl)) {
    writePitWallDebugLog("f1tv.media-fetch-blocked", {
      host: (() => {
        try { return new URL(targetUrl).hostname; }
        catch { return ""; }
      })(),
      method: request.method || "GET",
      requestType,
    });
    throw new Error("Blocked non-F1 TV media request.");
  }
  const cookieHeader = await f1TvCookieHeaderForUrl(targetUrl);
  const response = await requestBuffer(targetUrl, {
    method: request.method || "GET",
    headers: request.headers || {},
    body: request.body || null,
    cookieHeader,
  });
  const licenseErrorHint = requestType === 2 && response.status >= 400 ? f1TvLicenseErrorHint(response.body) : "";
  writePitWallDebugLog("f1tv.media-fetch", {
    host: new URL(targetUrl).hostname,
    status: response.status,
    bytes: response.body.length,
    method: request.method || "GET",
    requestType,
    headerNames: response.sentHeaderNames || Object.keys(sanitizeProxyRequestHeaders(request.headers || {})),
    cookieHeaderIncluded: Boolean(cookieHeader),
    contentType: response.headers["content-type"] || "",
    errorText: response.status >= 400 ? response.body.slice(0, 180).toString("utf8").replace(/\s+/g, " ") : "",
    licenseErrorHint,
    responseHint: requestType === 2 ? response.body.slice(0, 180).toString("utf8").replace(/\s+/g, " ") : "",
  });
  return {
    status: response.status,
    url: response.url,
    headers: response.headers,
    errorHint: licenseErrorHint,
    data: response.body.buffer.slice(response.body.byteOffset, response.body.byteOffset + response.body.byteLength),
  };
}

function isPitWallLocalUrl(targetUrl) {
  try {
    const parsed = new URL(targetUrl);
    return ["127.0.0.1", "localhost"].includes(parsed.hostname) || parsed.protocol === "file:";
  } catch {
    return false;
  }
}

function isTrustedProtectedPlaybackOrigin(webContents, origin, details = {}) {
  const candidates = [
    origin,
    details.requestingUrl,
    details.requestingOrigin,
    details.embeddingOrigin,
    details.securityOrigin,
  ];
  try {
    if (webContents && !webContents.isDestroyed()) candidates.push(webContents.getURL());
  } catch {}
  return candidates.filter(Boolean).some((candidate) => isF1TvUrl(candidate) || isPitWallLocalUrl(candidate));
}

function installF1TvPlaybackPermissions() {
  if (f1TvPlaybackPermissionsInstalled) return;
  f1TvPlaybackPermissionsInstalled = true;
  const trustedPermissions = new Set(["mediaKeySystem", "fullscreen", "storage-access", "top-level-storage-access"]);
  session.defaultSession.setPermissionCheckHandler((webContents, permission, requestingOrigin, details = {}) => {
    if (trustedPermissions.has(permission)) {
      return isTrustedProtectedPlaybackOrigin(webContents, requestingOrigin, details);
    }
    return false;
  });
  session.defaultSession.setPermissionRequestHandler((webContents, permission, callback, details = {}) => {
    if (trustedPermissions.has(permission)) {
      callback(isTrustedProtectedPlaybackOrigin(webContents, details.requestingUrl || "", details));
      return;
    }
    callback(false);
  });
}

const F1TV_AUTH_KEY_PATTERN = /auth|token|identity|login|jwt|access|refresh|subscriber|entitlement|oauth|oidc|auth0|firebase/i;
const IGNORED_F1TV_COOKIE_PATTERN = /abtasty|analytics|consent|stripe|evergage|_ga|_gcl|_fbp|_rdt|tfpsi|reese/i;

function isLikelyAuthCookie(cookie) {
  const name = String(cookie.name || "");
  return F1TV_AUTH_KEY_PATTERN.test(name) && !IGNORED_F1TV_COOKIE_PATTERN.test(name);
}

function f1TvEntitlementTokenFromCookies(cookies = []) {
  const cookie = cookies.find((item) => String(item.name || "").toLowerCase() === "entitlement_token");
  return String(cookie && cookie.value || "").trim();
}

async function getF1TvPlaybackToken(cookies = null) {
  const f1TvCookies = cookies || await getF1TvCookies();
  return f1TvEntitlementTokenFromCookies(f1TvCookies) || await getSecret("f1tv-token");
}

function recentF1TvRequestHeader(name) {
  const needle = String(name || "").toLowerCase();
  for (const headers of Array.from(pendingF1TvRequestHeaders.values()).reverse()) {
    const entry = Object.entries(headers || {}).find(([key, value]) => value != null && String(key).toLowerCase() === needle);
    if (entry) return String(entry[1]);
  }
  return "";
}

function f1TvPlaybackHeaders(playbackToken = "") {
  const token = String(playbackToken || "").trim();
  const headers = token ? { entitlementToken: token, ascendonToken: token } : {};
  const deviceInfo = recentF1TvRequestHeader("x-f1-device-info");
  if (deviceInfo) headers["x-f1-device-info"] = deviceInfo;
  headers.correlationid = recentF1TvRequestHeader("correlationid") || randomBytes(16).toString("hex");
  headers.sessionid = recentF1TvRequestHeader("sessionid") || randomBytes(16).toString("hex");
  return headers;
}

function f1TvBrowserAuthStateScript() {
  return `
    (async () => {
      const rx = new RegExp(${JSON.stringify(F1TV_AUTH_KEY_PATTERN.source)}, "i");
      const tokenRx = /(^eyJ[a-zA-Z0-9_-]+\\.)|access[_-]?token|refresh[_-]?token|id[_-]?token|authorization|bearer/i;
      const safeKeys = (storage, prefix) => {
        try {
          return Array.from({ length: storage.length }, (_, index) => storage.key(index))
            .filter((key) => {
              if (!key || !rx.test(key)) return false;
              let value = "";
              try { value = String(storage.getItem(key) || ""); } catch {}
              const tokenLike = tokenRx.test(key) || tokenRx.test(value);
              return tokenLike;
            })
            .map((key) => prefix + ":" + key);
        } catch {
          return [];
        }
      };
      const indexedDbAuthKeys = [];
      try {
        if (indexedDB.databases) {
          const databases = await indexedDB.databases();
          for (const info of databases) {
            const dbName = String(info && info.name || "");
            if (!dbName) continue;
            await new Promise((resolve) => {
              const request = indexedDB.open(dbName);
              const timeout = setTimeout(resolve, 500);
              request.onerror = request.onblocked = () => { clearTimeout(timeout); resolve(); };
              request.onsuccess = () => {
                try {
                  const db = request.result;
                  Array.from(db.objectStoreNames || []).forEach((storeName) => {
                    if (rx.test(dbName) || rx.test(storeName)) indexedDbAuthKeys.push("idb:" + dbName + ":" + storeName);
                  });
                  db.close();
                } catch {}
                clearTimeout(timeout);
                resolve();
              };
            });
          }
        }
      } catch {}
      const cookieAuthNames = document.cookie.split(";")
        .map((part) => part.split("=")[0].trim())
        .filter((name) => name && rx.test(name) && !${IGNORED_F1TV_COOKIE_PATTERN}.test(name));
      const pageText = String(document.body && document.body.innerText || "");
      return {
        currentUrl: location.href,
        localStorageAuthKeys: safeKeys(localStorage, "localStorage"),
        sessionStorageAuthKeys: safeKeys(sessionStorage, "sessionStorage"),
        indexedDbAuthKeys,
        cookieAuthNames,
        signedInSignal: /sign out|log out|my account|account settings|manage subscription/i.test(pageText),
        loginSignal: /sign in|log in|email address|password/i.test(pageText),
      };
    })();
  `;
}

async function readF1TvAuthStateFromWebContents(webContents) {
  try {
    return await webContents.executeJavaScript(f1TvBrowserAuthStateScript(), true);
  } catch {
    return {};
  }
}

function mergeF1TvStatus(cookies, browserAuthState = {}, subscriptionToken = "") {
  const authCookies = cookies.filter(isLikelyAuthCookie);
  const playbackToken = f1TvEntitlementTokenFromCookies(cookies) || subscriptionToken;
  const storageAuthKeys = Array.from(new Set([
    ...(browserAuthState.localStorageAuthKeys || []),
    ...(browserAuthState.sessionStorageAuthKeys || []),
  ])).sort();
  const browserCookieNames = Array.from(new Set(browserAuthState.cookieAuthNames || [])).sort();
  const browserSignedIn = Boolean(browserAuthState.signedInSignal && !browserAuthState.loginSignal);
  const tokenReady = Boolean(String(playbackToken || "").trim());
  const browserSession = authCookies.length > 0 || storageAuthKeys.length > 0 || browserCookieNames.length > 0 || browserSignedIn;
  return {
    authenticated: tokenReady,
    playbackTokenReady: tokenReady,
    browserSession,
    cookieCount: cookies.length,
    authCookieNames: Array.from(new Set([...authCookies.map((cookie) => cookie.name), ...browserCookieNames])).sort(),
    storageAuthKeys,
    browserSignedIn,
    currentUrl: browserAuthState.currentUrl || "",
    userDataPath: PITWALL_USER_DATA,
    lastCheckedAt: new Date().toISOString(),
  };
}

async function getF1TvCookies() {
  const cookies = await session.defaultSession.cookies.get({});
  return cookies.filter((cookie) => {
    const domain = String(cookie.domain || "").replace(/^\./, "").toLowerCase();
    return domain === "formula1.com" || domain.endsWith(".formula1.com") || domain === "f1tv.formula1.com";
  });
}

async function getF1TvStatus() {
  const cookies = await getF1TvCookies();
  return mergeF1TvStatus(cookies, {}, await getF1TvPlaybackToken(cookies));
}

async function getF1TvStatusWithBrowserState(browserAuthState = {}) {
  const cookies = await getF1TvCookies();
  return mergeF1TvStatus(cookies, browserAuthState, await getF1TvPlaybackToken(cookies));
}

async function probeF1TvStoredAuth(options = {}) {
  const targetUrl = isF1TvUrl(options.targetUrl || options.url || "") ? (options.targetUrl || options.url) : F1TV_HOME_URL;
  const probeWindow = new BrowserWindow({
    width: 960,
    height: 640,
    show: false,
    title: "PitWall F1 TV Auth Probe",
    backgroundColor: "#000000",
    webPreferences: {
      offscreen: true,
      backgroundThrottling: false,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  try {
    await probeWindow.loadURL(targetUrl);
    await wait(Number(options.timeoutMs || 1800));
    const browserAuthState = await readF1TvAuthStateFromWebContents(probeWindow.webContents);
    return getF1TvStatusWithBrowserState(browserAuthState);
  } catch {
    return getF1TvStatus();
  } finally {
    if (!probeWindow.isDestroyed()) probeWindow.destroy();
  }
}

async function clearF1TvCookies() {
  const cookies = await getF1TvCookies();
  await Promise.all(cookies.map(async (cookie) => {
    const host = String(cookie.domain || "").replace(/^\./, "") || "f1tv.formula1.com";
    const url = `${cookie.secure ? "https" : "http"}://${host}${cookie.path || "/"}`;
    await session.defaultSession.cookies.remove(url, cookie.name).catch(() => {});
  }));
  const storages = ["cookies", "indexeddb", "localstorage", "sessionstorage", "serviceworkers", "cachestorage"];
  await Promise.all(["https://f1tv.formula1.com", "https://account.formula1.com", "https://formula1.com", "https://www.formula1.com"].map((origin) =>
    session.defaultSession.clearStorageData({ origin, storages }).catch(() => {})
  ));
}

async function injectF1Credentials(win, credentials) {
  const email = String(credentials.email || "").trim();
  const password = String(credentials.password || "");
  const autoSubmit = Boolean(credentials.autoSubmit && email && password);
  if (!email && !password) return;

  await win.webContents.executeJavaScript(`
    (() => {
      const visible = (node) => {
        if (!node) return false;
        const style = window.getComputedStyle(node);
        const rect = node.getBoundingClientRect();
        return style.visibility !== "hidden" && style.display !== "none" && rect.width > 0 && rect.height > 0;
      };
      const setNativeValue = (input, value) => {
        const descriptor = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value");
        if (descriptor && descriptor.set) descriptor.set.call(input, value);
        else input.value = value;
      };
      const setValue = (selectors, value) => {
        if (!value) return false;
        const input = selectors.map((selector) => document.querySelector(selector)).find(visible);
        if (!input) return false;
        input.focus();
        setNativeValue(input, value);
        input.dispatchEvent(new Event("input", { bubbles: true }));
        input.dispatchEvent(new Event("change", { bubbles: true }));
        return true;
      };
      const clickF1TvLoginStep = (pattern) => {
        const buttons = Array.from(document.querySelectorAll("button,input[type='submit'],[role='button']"));
        const button = buttons.find((node) => visible(node) && pattern.test([node.textContent, node.value, node.ariaLabel, node.title].filter(Boolean).join(" ")));
        if (!button) return false;
        button.click();
        return true;
      };
      const emailFilled = setValue(["input[type='email']", "input[name='email']", "input[name='username']", "input[autocomplete='username']", "#email", "#username"], ${JSON.stringify(email)});
      const passwordFilled = setValue(["input[type='password']", "input[name='password']", "input[autocomplete='current-password']", "#password"], ${JSON.stringify(password)});
      if (${JSON.stringify(autoSubmit)}) {
        if (passwordFilled) return clickF1TvLoginStep(/sign\\s*in|log\\s*in|continue|submit/i);
        if (emailFilled) return clickF1TvLoginStep(/continue|next|sign\\s*in|log\\s*in/i);
      }
      return false;
    })();
  `, true).catch(() => {});
}

function openF1TvLogin(event, options = {}) {
  const email = String(options.email || "").trim();
  const credentials = {
    email,
    password: options.mode === "credentials" ? String(options.password || "") : "",
  };
  if (email) setSecret("f1tv-email", email).catch(() => {});

  if (options.mode === "credentials" && credentials.password) {
    return authenticateF1TvCredentials(credentials.email, credentials.password)
      .then(() => getF1TvStatus())
      .catch((error) => {
        if (options.tokenOnly) throw error;
        credentials.directError = error.message || "";
        return openF1TvLoginWindow(event, credentials, options);
      });
  }

  return openF1TvLoginWindow(event, credentials, options);
}

function openF1TvLoginWindow(event, credentials, options = {}) {
  const parent = event?.sender ? BrowserWindow.fromWebContents(event.sender) : null;

  return new Promise((resolve) => {
    let settled = false;
    let pollTimer = null;
    let credentialTimer = null;
    let credentialAttempts = 0;
    let lastStatus = null;
    const loginWindow = new BrowserWindow({
      width: 1040,
      height: 820,
      minWidth: 820,
      minHeight: 640,
      title: "F1 TV Login",
      parent: parent && !parent.isDestroyed() ? parent : undefined,
      modal: false,
      backgroundColor: "#111111",
      webPreferences: {
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
      },
    });

    async function finish() {
      if (settled) return;
      settled = true;
      if (pollTimer) clearInterval(pollTimer);
      if (credentialTimer) clearInterval(credentialTimer);
      resolve(lastStatus || await getF1TvStatus());
    }

    loginWindow.webContents.setWindowOpenHandler(({ url: targetUrl }) => {
      if (isF1TvUrl(targetUrl)) return { action: "allow" };
      shell.openExternal(targetUrl);
      return { action: "deny" };
    });

    loginWindow.webContents.on("will-navigate", (navEvent, targetUrl) => {
      if (!isF1TvUrl(targetUrl)) {
        navEvent.preventDefault();
        shell.openExternal(targetUrl);
      }
    });

    loginWindow.webContents.on("did-finish-load", () => {
      injectF1Credentials(loginWindow, credentials);
    });

    if (credentials.email || credentials.password) {
      credentialTimer = setInterval(() => {
        if (loginWindow.isDestroyed()) return;
        credentialAttempts += 1;
        injectF1Credentials(loginWindow, {
          ...credentials,
          autoSubmit: options.mode === "credentials",
        });
        if (credentialAttempts > 45 && credentialTimer) {
          clearInterval(credentialTimer);
          credentialTimer = null;
        }
      }, 700);
    }

    pollTimer = setInterval(async () => {
      const browserAuthState = loginWindow.isDestroyed() ? {} : await readF1TvAuthStateFromWebContents(loginWindow.webContents);
      const status = await getF1TvStatusWithBrowserState(browserAuthState).catch(() => ({ authenticated: false }));
      lastStatus = status;
      if ((status.authenticated || status.browserSession) && !loginWindow.isDestroyed()) {
        loginWindow.close();
      }
    }, 1000);

    loginWindow.once("closed", finish);
    loginWindow.loadURL(F1TV_LOGIN_URL).catch(finish);
  });
}

function f1TvStreamLabel(targetUrl) {
  try {
    const parsed = new URL(targetUrl);
    const parts = parsed.pathname.split("/").filter(Boolean);
    const file = parts.at(-1) || "stream";
    const parent = parts.at(-2) || parsed.hostname.replace(/^www\./, "");
    return `${parent} / ${file}`.replace(/[-_]+/g, " ").replace(/\.(m3u8|mpd)\b/i, "");
  } catch {
    return "F1 TV stream";
  }
}

function responseHeaderValue(responseHeaders = {}, name) {
  const entry = Object.entries(responseHeaders || {}).find(([key]) => key.toLowerCase() === name.toLowerCase());
  const value = entry ? entry[1] : "";
  return Array.isArray(value) ? String(value[0] || "") : String(value || "");
}

function f1TvManifestContentType(responseHeaders = {}) {
  return responseHeaderValue(responseHeaders, "content-type").toLowerCase();
}

function isF1TvManifestUrl(targetUrl, responseHeaders = {}) {
  const url = String(targetUrl || "");
  const contentType = f1TvManifestContentType(responseHeaders);
  return /\.(m3u8|mpd)(?:[?#]|$)/i.test(url)
    || /dash\+xml|mpegurl|vnd\.apple\.mpegurl/i.test(contentType)
    || /\/(?:manifest|playlist|master)(?:[?#]|$)/i.test(url);
}

function f1TvManifestType(targetUrl, responseHeaders = {}) {
  const contentType = f1TvManifestContentType(responseHeaders);
  if (/dash\+xml/i.test(contentType)) return "dash";
  if (/mpegurl|vnd\.apple\.mpegurl/i.test(contentType)) return "hls";
  return /\.mpd(?:[?#]|$)/i.test(String(targetUrl || "")) ? "dash" : "hls";
}

function isLikelyF1TvLicenseUrl(targetUrl) {
  const url = String(targetUrl || "").toLowerCase();
  return /license|widevine|wv|drm|playready|fairplay|certificate|licen[cs]e/.test(url) && !isF1TvManifestUrl(url);
}

function isFirstPartyF1TvWidevineLicenseUrl(targetUrl) {
  try {
    const parsed = new URL(String(targetUrl || ""));
    return parsed.hostname.toLowerCase().endsWith(".formula1.com")
      && /\/CONTENT\/LA\/widevine$/i.test(parsed.pathname);
  } catch {
    return false;
  }
}

function sanitizedUrlSample(targetUrl) {
  try {
    const parsed = new URL(targetUrl);
    const parts = parsed.pathname.split("/").filter(Boolean);
    const queryKeys = Array.from(parsed.searchParams.keys()).filter(Boolean).slice(0, 8).sort();
    return {
      host: parsed.hostname,
      pathHint: parts.slice(-2).join("/").replace(/[0-9a-f]{16,}/ig, "{hash}").slice(0, 96),
      fullPathHint: parts.slice(0, 8).join("/").replace(/[0-9a-f]{16,}/ig, "{hash}").slice(0, 160),
      queryKeys,
      urlId: createHash("sha256").update(targetUrl).digest("hex").slice(0, 16),
    };
  } catch {
    return { host: "", pathHint: "", fullPathHint: "", queryKeys: [], urlId: "" };
  }
}

function recordF1TvDiagnosticRequest(details, requestHeaders = {}) {
  const capture = activeF1TvResolverCapture;
  if (!capture) return;
  const targetUrl = String(details.url || "");
  const contentType = f1TvManifestContentType(details.responseHeaders);
  const lower = targetUrl.toLowerCase();
  const sample = sanitizedUrlSample(targetUrl);
  const firstPartyDataRequest = /(formula1\.com|f1tv\.formula1\.com)$/i.test(sample.host)
    && /xhr|fetch/i.test(String(details.resourceType || ""));
  const interesting = isF1TvManifestUrl(targetUrl, details.responseHeaders)
    || isLikelyF1TvLicenseUrl(targetUrl)
    || firstPartyDataRequest
    || /(hls|dash|manifest|playlist|playback|stream|media|video|drm|license|widevine|wv)/i.test(`${lower} ${contentType} ${details.resourceType || ""}`);
  if (!interesting) return;
  capture.requestSamples ||= [];
  if (capture.requestSamples.length >= 40) return;
  capture.requestSamples.push({
    ...sample,
    safeQuery: (() => {
      try {
        const parsed = new URL(targetUrl);
        const safeKeys = new Set(["contentId", "channelId", "player", "videoType", "techPack", "obc"]);
        return Object.fromEntries(Array.from(parsed.searchParams.entries())
          .filter(([key]) => safeKeys.has(key))
          .map(([key, value]) => [key, String(value).slice(0, 80)]));
      } catch {
        return {};
      }
    })(),
    requestHeaderNames: Object.keys(requestHeaders || {}).slice(0, 16),
    statusCode: details.statusCode || 0,
    resourceType: details.resourceType || "",
    contentType,
    manifestCandidate: isF1TvManifestUrl(targetUrl, details.responseHeaders),
    licenseCandidate: isLikelyF1TvLicenseUrl(targetUrl),
  });
}

function directF1TvPlayEndpoint(contentId) {
  const id = String(contentId || "").replace(/[^0-9]/g, "");
  if (!id) return [];
  const query = `contentId=${encodeURIComponent(id)}`;
  const clients = ["WEB_HLS", "WEB_DASH", "BIG_SCREEN_DASH", "BIG_SCREEN_HLS"];
  const versions = ["3.0", "2.0"];
  const scopes = ["ALL"];
  const actions = ["PLAY"];
  const endpoints = [];
  for (const version of versions) {
    for (const client of clients) {
      for (const scope of scopes) {
        for (const action of actions) {
          endpoints.push(`https://f1tv.formula1.com/${version}/R/ENG/${client}/${scope}/CONTENT/${action}?${query}`);
        }
      }
    }
  }
  return endpoints;
}

function directF1TvDiscoveryEndpoints(contentId) {
  const id = String(contentId || "").replace(/[^0-9]/g, "");
  if (!id) return [];
  const query = `techPack=F1_FER&obc=true&videoType=PSEUDO-VOD&contentId=${encodeURIComponent(id)}`;
  return [
    `https://f1tv.formula1.com/3.0/R/ENG/WEB_DASH/ALL/FEATURESTEERING/PREMIUM/5?${query}`,
    `https://f1tv.formula1.com/4.0/R/ENG/WEB_DASH/ALL/CONTENT/VIDEO/${encodeURIComponent(id)}`,
  ];
}

function directF1TvLicenseEndpoints(contentId) {
  const id = String(contentId || "").replace(/[^0-9]/g, "");
  if (!id) return [];
  const query = `contentId=${encodeURIComponent(id)}`;
  return ["3.0/R/ENG/WEB_HLS", "3.0/R/ENG/WEB_DASH", "2.0/R/ENG/WEB_HLS", "2.0/R/ENG/WEB_DASH", "2.0/R/ENG/BIG_SCREEN_DASH", "2.0/R/ENG/BIG_SCREEN_HLS"]
    .map((clientPath) => `https://f1tv.formula1.com/${clientPath}/ALL/CONTENT/LA/widevine?${query}`);
}

async function fetchDirectF1TvPlayMetadata(webContents, contentId, playbackToken = "") {
  const endpoints = directF1TvPlayEndpoint(contentId);
  if (!endpoints.length) return { attempts: [], manifests: [], licenseUrls: [] };
  const playbackHeaders = f1TvPlaybackHeaders(playbackToken);
  const result = await webContents.executeJavaScript(`
    (async () => {
      const endpoints = ${JSON.stringify(endpoints)};
      const discoveryEndpoints = ${JSON.stringify(directF1TvDiscoveryEndpoints(contentId))};
      const playbackHeaders = ${JSON.stringify(playbackHeaders)};
      const out = [];
      const contentId = ${JSON.stringify(String(contentId || "").replace(/[^0-9]/g, ""))};
      const rxManifest = /\\.m(?:3u8|pd)(?:[?#]|$)|manifest|playlist|dash|hls/i;
      const rxLicense = /license|licence|widevine|drm|laurl|la_url|wv/i;
      const collectTextHints = (value, path = [], hints = [], depth = 0) => {
        if (depth > 4 || hints.length > 100) return hints;
        if (typeof value === "string" || typeof value === "number") {
          const text = String(value || "");
          if (text && text.length < 2200) hints.push({ keyPath: path.join("."), text });
          return hints;
        }
        if (!value || typeof value !== "object") return hints;
        Object.entries(value).forEach(([key, item]) => collectTextHints(item, path.concat(key), hints, depth + 1));
        return hints;
      };
      const collectChannelIds = (value, path = [], ids = new Set()) => {
        if (!value || typeof value !== "object") return ids;
        if (Array.isArray(value)) {
          value.forEach((item, index) => collectChannelIds(item, path.concat(String(index)), ids));
          return ids;
        }
        Object.entries(value).forEach(([key, item]) => {
          const pathText = path.concat(key).join(".");
          const channelishPath = /channel|camera|feed|steering|selection|obc|onboard/i.test(pathText);
          if (/^channel_?id$/i.test(key) && item != null) ids.add(String(item));
          if (/^id$/i.test(key) && channelishPath && /^\\d{3,6}$/.test(String(item || ""))) ids.add(String(item));
          collectChannelIds(item, path.concat(key), ids);
        });
        return ids;
      };
      const walk = (value, path = [], bucket) => {
        if (typeof value === "string") {
          const keyPath = path.join(".");
          if (/^https?:\\/\\//i.test(value) || value.startsWith("/")) {
            if (rxManifest.test(value) || rxManifest.test(keyPath)) bucket.manifests.push(value);
            if (rxLicense.test(value) || rxLicense.test(keyPath)) bucket.licenseUrls.push(value);
          }
          return;
        }
        if (!value || typeof value !== "object") return;
        if (Array.isArray(value)) {
          value.forEach((item, index) => walk(item, path.concat(String(index)), bucket));
          return;
        }
        const hints = collectTextHints(value, path);
        const manifestHints = hints.filter((hint) => (/^https?:\\/\\//i.test(hint.text) || hint.text.startsWith("/")) && (rxManifest.test(hint.text) || rxManifest.test(hint.keyPath)));
        if (manifestHints.length) {
          const licenseUrls = hints.filter((hint) => (/^https?:\\/\\//i.test(hint.text) || hint.text.startsWith("/")) && (rxLicense.test(hint.text) || rxLicense.test(hint.keyPath))).map((hint) => hint.text);
          const label = hints.filter((hint) => !/^https?:\\/\\//i.test(hint.text) && !hint.text.startsWith("/") && hint.text.length < 180)
            .map((hint) => hint.keyPath.split(".").slice(-1)[0] + ":" + hint.text).join(" ").slice(0, 700);
          bucket.streamItems = bucket.streamItems || [];
          manifestHints.forEach((hint) => bucket.streamItems.push({ manifest: hint.text, licenseUrls, label, path: path.join(".") }));
        }
        Object.entries(value).forEach(([key, item]) => walk(item, path.concat(key), bucket));
      };
      const premiumChannelIds = new Set();
      const fetchAttempt = async (endpoint, attempt) => {
        try {
          const response = await fetch(endpoint, {
            credentials: "include",
            headers: { Accept: "application/json, text/plain, */*", ...playbackHeaders },
          });
          attempt.status = response.status;
          attempt.ok = response.ok;
          attempt.contentType = response.headers.get("content-type") || "";
          const text = await response.text();
          let body = null;
          try { body = JSON.parse(text); } catch {}
          if (body && typeof body === "object") {
            attempt.bodyKeys = Object.keys(body).slice(0, 12);
            attempt.resultCode = String(body.resultCode || "");
            attempt.message = String(body.message || "");
            attempt.errorDescription = String(body.errorDescription || "");
            attempt.channelIds = Array.from(collectChannelIds(body)).slice(0, 24);
            walk(body, [], attempt);
          }
        } catch (error) {
          attempt.error = error && error.message ? error.message : "fetch failed";
        }
        return attempt;
      };
      for (const discoveryEndpoint of discoveryEndpoints) {
        const premiumAttempt = await fetchAttempt(discoveryEndpoint, { endpoint: discoveryEndpoint, status: 0, ok: false, contentType: "", manifests: [], licenseUrls: [], streamItems: [], bodyKeys: [], channelIds: [], kind: "premium-channel-list" });
        premiumAttempt.channelIds.forEach((id) => premiumChannelIds.add(id));
        out.push(premiumAttempt);
      }
      for (const endpoint of endpoints) {
        const featureChannelIds = Array.from(premiumChannelIds).slice(0, 24);
        let foundChannelManifest = false;
        for (const channelId of featureChannelIds) {
          const channelEndpoint = endpoint + "&channelId=" + encodeURIComponent(channelId) + "&player=player_tm";
          const channelAttempt = await fetchAttempt(channelEndpoint, { endpoint: channelEndpoint, status: 0, ok: false, contentType: "", manifests: [], licenseUrls: [], streamItems: [], bodyKeys: [], channelIds: [channelId], player: "player_tm" });
          out.push(channelAttempt);
          if (channelAttempt.manifests.length) {
            foundChannelManifest = true;
            break;
          }
        }
        if (foundChannelManifest) break;
        const attempt = await fetchAttempt(endpoint, { endpoint, status: 0, ok: false, contentType: "", manifests: [], licenseUrls: [], streamItems: [], bodyKeys: [] });
        out.push(attempt);
        const channelIds = Array.from(new Set([...(attempt.channelIds || []), ...premiumChannelIds])).slice(0, 24);
        for (const channelId of channelIds) {
          const channelEndpoint = endpoint + "&channelId=" + encodeURIComponent(channelId) + "&player=player_tm";
          const channelAttempt = await fetchAttempt(channelEndpoint, { endpoint: channelEndpoint, status: 0, ok: false, contentType: "", manifests: [], licenseUrls: [], streamItems: [], bodyKeys: [], channelIds: [channelId], player: "player_tm" });
          out.push(channelAttempt);
          if (channelAttempt.manifests.length) break;
        }
        if (attempt.manifests.length) break;
      }
      return out;
    })();
  `, true).catch(() => []);
  const absolute = (value) => {
    try { return new URL(value, F1TV_HOME_URL).href; }
    catch { return ""; }
  };
  const attempts = Array.isArray(result) ? result : [];
  const manifestScore = (value) => /\.m3u8(?:[?#]|$)/i.test(value) && /CMAF-WV/i.test(value) ? 0 : /\.m3u8(?:[?#]|$)/i.test(value) ? 1 : /\.mpd(?:[?#]|$)/i.test(value) ? 2 : 3;
  return {
    attempts,
    manifests: Array.from(new Set(attempts.flatMap((attempt) => attempt.manifests || []).map(absolute).filter(Boolean)))
      .filter((value) => isF1TvManifestUrl(value))
      .sort((a, b) => manifestScore(a) - manifestScore(b)),
    licenseUrls: Array.from(new Set(attempts.flatMap((attempt) => attempt.licenseUrls || []).map(absolute).filter(Boolean))),
    streamItems: attempts.flatMap((attempt) => (attempt.streamItems || []).map((item) => ({
      ...item,
      manifest: absolute(item.manifest),
      licenseUrls: Array.from(new Set((item.licenseUrls || []).map(absolute).filter(Boolean))),
    }))).filter((item) => isF1TvManifestUrl(item.manifest)),
  };
}

async function findF1TvContentCandidatesInPage(webContents, options = {}) {
  return webContents.executeJavaScript(`
    (() => {
      const sessionKind = ${JSON.stringify(String(options.sessionKind || ""))};
      const raceName = ${JSON.stringify(String(options.raceName || ""))};
      const normalize = (value) => String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
      const raceNeedle = normalize(raceName);
      const sessionNeedle = normalize(sessionKind);
      const nodes = Array.from(document.querySelectorAll('a[href*="/detail/"], [data-href*="/detail/"]'));
      const candidates = nodes.map((node, index) => {
        const href = node.href || node.getAttribute("href") || node.dataset?.href || "";
        const id = (String(href).match(/\\/detail\\/([0-9]+)/i) || [])[1] || "";
        const text = normalize([node.textContent, node.ariaLabel, node.title, href].filter(Boolean).join(" "));
        let score = 0;
        if (raceNeedle && text.includes(raceNeedle)) score += 3;
        if (sessionNeedle && text.includes(sessionNeedle)) score += 3;
        if (/pre qualifying|post qualifying|pre race|post race|highlights|summary/.test(text)) score -= 1;
        if (/practice|qualifying|race/.test(text)) score += 2;
        if (/replay|live event|qualifying|practice|race/.test(text)) score += 1;
        return { id, score, index, text: text.slice(0, 140) };
      }).filter((item) => item.id);
      candidates.sort((a, b) => b.score - a.score || a.index - b.index);
      const seen = new Set();
      return candidates.filter((item) => {
        if (seen.has(item.id)) return false;
        seen.add(item.id);
        return true;
      }).slice(0, 12);
    })();
  `, true).catch(() => []);
}

async function findF1TvContentIdInPage(webContents, options = {}) {
  const candidates = await findF1TvContentCandidatesInPage(webContents, options);
  return candidates[0]?.id || "";
}

function scopedRequestHeaders(headers = {}) {
  const blocked = new Set(["cookie", "host", "origin", "referer", "content-length"]);
  return Object.fromEntries(Object.entries(headers)
    .filter(([key, value]) => value != null && !blocked.has(String(key).toLowerCase()))
    .map(([key, value]) => [key, String(value)]));
}

function guessF1TvDriverCode(targetUrl) {
  const text = String(targetUrl || "").toUpperCase();
  const match = text.match(/(?:^|[^A-Z])(VER|PER|TSU|HAD|RUS|ANT|LEC|HAM|NOR|PIA|STR|ALO|GAS|COL|ALB|SAI|LAW|LIN|HUL|BOR|OCO|BEA|BOT)(?:[^A-Z]|$)/);
  return match ? match[1] : "";
}

const F1TV_DRIVER_ALIASES = [
  ["VER", "max verstappen", "verstappen"],
  ["HAD", "isack hadjar", "hadjar"],
  ["RUS", "george russell", "russell"],
  ["ANT", "kimi antonelli", "andrea kimi antonelli", "antonelli"],
  ["LEC", "charles leclerc", "leclerc"],
  ["HAM", "lewis hamilton", "hamilton"],
  ["NOR", "lando norris", "norris"],
  ["PIA", "oscar piastri", "piastri"],
  ["STR", "lance stroll", "stroll"],
  ["ALO", "fernando alonso", "alonso"],
  ["GAS", "pierre gasly", "gasly"],
  ["COL", "franco colapinto", "colapinto"],
  ["ALB", "alexander albon", "albon"],
  ["SAI", "carlos sainz", "sainz"],
  ["LAW", "liam lawson", "lawson"],
  ["LIN", "arvid lindblad", "lindblad"],
  ["HUL", "nico hulkenberg", "nico hülkenberg", "hulkenberg", "hülkenberg"],
  ["BOR", "gabriel bortoleto", "bortoleto"],
  ["OCO", "esteban ocon", "ocon"],
  ["BEA", "oliver bearman", "bearman"],
  ["PER", "sergio perez", "sergio pérez", "perez", "pérez"],
  ["BOT", "valtteri bottas", "bottas"],
];

function decodedF1TvUrlText(value) {
  const source = String(value || "");
  const decoded = [];
  try { decoded.push(decodeURIComponent(source)); } catch { decoded.push(source); }
  source.replace(/pa_([A-Za-z0-9_-]+)/g, (_match, payload) => {
    try { decoded.push(Buffer.from(payload, "base64url").toString("utf8")); } catch {}
    return _match;
  });
  return decoded.join(" ");
}

function driverCodeFromF1TvText(value) {
  const upper = decodedF1TvUrlText(value).toUpperCase();
  const code = guessF1TvDriverCode(upper);
  if (code) return code;
  const lower = upper.toLowerCase();
  const match = F1TV_DRIVER_ALIASES.find(([, ...aliases]) => aliases.some((alias) => lower.includes(alias)));
  return match?.[0] || "";
}

function f1TvManifestProgramDateTime(text) {
  const source = String(text || "");
  const hlsMatch = source.match(/#EXT-X-PROGRAM-DATE-TIME:([^\r\n]+)/i);
  const hlsMs = hlsMatch ? Date.parse(hlsMatch[1].trim()) : NaN;
  if (Number.isFinite(hlsMs)) return { videoStartUtc: new Date(hlsMs).toISOString(), videoStartSource: "hls-program-date-time" };
  const dashMatch = source.match(/\bavailabilityStartTime=["']([^"']+)["']/i);
  const dashMs = dashMatch ? Date.parse(dashMatch[1].trim()) : NaN;
  if (Number.isFinite(dashMs)) return { videoStartUtc: new Date(dashMs).toISOString(), videoStartSource: "dash-availability-start" };
  return {};
}

function f1TvFirstHlsChildPlaylistUrl(text, manifestUrl) {
  const lines = String(text || "").split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  for (let index = 0; index < lines.length; index += 1) {
    if (!/^#EXT-X-STREAM-INF/i.test(lines[index])) continue;
    const child = lines.slice(index + 1).find((line) => line && !line.startsWith("#"));
    if (child) {
      try { return new URL(child, manifestUrl).href; }
      catch { return ""; }
    }
  }
  const child = lines.find((line) => !line.startsWith("#") && /\.m3u8(?:[?#]|$)/i.test(line));
  if (!child) return "";
  try { return new URL(child, manifestUrl).href; }
  catch { return ""; }
}

async function f1TvManifestTiming(feed = {}) {
  const manifestUrl = String(feed.manifestUrl || "");
  if (!manifestUrl || !isF1TvMediaUrl(manifestUrl)) return {};
  const cookieHeader = await f1TvCookieHeaderForUrl(manifestUrl);
  const response = await requestBuffer(manifestUrl, {
    headers: feed.headers || {},
    cookieHeader,
    timeoutMs: 6500,
  });
  if (response.status < 200 || response.status >= 300 || !response.body?.length) return {};
  const text = response.body.toString("utf8");
  const direct = f1TvManifestProgramDateTime(text);
  if (direct.videoStartUtc) return direct;
  if (!/\.m3u8(?:[?#]|$)/i.test(manifestUrl) && !/mpegurl|m3u8/i.test(response.headers?.["content-type"] || "")) return {};
  const childUrl = f1TvFirstHlsChildPlaylistUrl(text, manifestUrl);
  if (!childUrl || !isF1TvMediaUrl(childUrl)) return {};
  const childCookieHeader = await f1TvCookieHeaderForUrl(childUrl);
  const childResponse = await requestBuffer(childUrl, {
    headers: feed.headers || {},
    cookieHeader: childCookieHeader,
    timeoutMs: 6500,
  });
  if (childResponse.status < 200 || childResponse.status >= 300 || !childResponse.body?.length) return {};
  const child = f1TvManifestProgramDateTime(childResponse.body.toString("utf8"));
  return child.videoStartUtc ? { ...child, videoStartSource: `${child.videoStartSource}:child-playlist` } : {};
}

function f1TvStreamDescriptor(targetUrl, extra = {}) {
  const manifestType = extra.manifestType || f1TvManifestType(targetUrl, extra.responseHeaders);
  const label = extra.label || f1TvStreamLabel(targetUrl);
  const driverCode = String(extra.driverCode || driverCodeFromF1TvText(`${label} ${extra.feedId || ""} ${targetUrl}`) || "").toUpperCase();
  const licenseUrl = extra.licenseUrl || "";
  const genericFeed = manifestType === "dash" ? "dash" : "hls";
  return {
    id: Buffer.from(targetUrl).toString("base64url").slice(0, 18),
    feedId: extra.feedId || driverCode || genericFeed,
    kind: extra.kind || (driverCode ? "onboard" : "world"),
    label,
    driverCode,
    manifestUrl: targetUrl,
    manifestType,
    drm: licenseUrl || manifestType === "dash" ? { keySystem: "com.widevine.alpha", licenseUrl } : null,
    licenseUrl,
    headers: scopedRequestHeaders(extra.headers || {}),
    capturedAt: new Date().toISOString(),
    initiator: extra.initiator || "",
  };
}

function streamMetadataByManifest(directPlay = {}) {
  const metadata = new Map();
  for (const item of directPlay.streamItems || []) {
    const manifest = String(item.manifest || "");
    if (!manifest || !isF1TvManifestUrl(manifest)) continue;
    const label = String(item.label || item.path || "");
    const driverCode = driverCodeFromF1TvText(`${label} ${manifest}`);
    const channelId = String(item.channelId || "").replace(/[^A-Za-z0-9_-]/g, "");
    metadata.set(manifest, {
      label: label || f1TvStreamLabel(manifest),
      driverCode,
      feedId: driverCode || channelId || "",
      kind: driverCode ? "onboard" : /main|world|wif|presentation/i.test(`${label} ${manifest}`) ? "world" : "feed",
    });
  }
  return metadata;
}

function captureF1TvResolverRequest(details, requestHeaders) {
  const capture = activeF1TvResolverCapture;
  if (!capture) return;
  const targetUrl = String(details.url || "");
  if (isF1TvManifestUrl(targetUrl, details.responseHeaders)) {
    const previous = capture.streams.get(targetUrl) || {};
    capture.streams.set(targetUrl, f1TvStreamDescriptor(targetUrl, {
      ...previous,
      headers: { ...(previous.headers || {}), ...(requestHeaders || {}) },
      initiator: details.initiator || details.referrer || previous.initiator || "",
      licenseUrl: previous.licenseUrl || capture.licenseRequests[0]?.url || "",
      responseHeaders: details.responseHeaders,
    }));
  } else if (isLikelyF1TvLicenseUrl(targetUrl)) {
    const preferredLicenseUrl = capture.preferredLicenseUrl || "";
    const selectedLicenseUrl = preferredLicenseUrl || targetUrl;
    const license = {
      url: targetUrl,
      licenseUrl: targetUrl,
      headers: scopedRequestHeaders(requestHeaders || {}),
      capturedAt: new Date().toISOString(),
    };
    if (preferredLicenseUrl) capture.licenseRequests.push(license);
    else capture.licenseRequests.unshift(license);
    for (const [manifestUrl, stream] of capture.streams) {
      capture.streams.set(manifestUrl, { ...stream, licenseUrl: selectedLicenseUrl, drm: { ...(stream.drm || {}), keySystem: "com.widevine.alpha", licenseUrl: selectedLicenseUrl } });
    }
  }
}

function rememberF1TvStream(details) {
  const targetUrl = String(details.url || "");
  if (!isF1TvManifestUrl(targetUrl, details.responseHeaders)) return;
  const existingIndex = capturedF1TvStreams.findIndex((stream) => stream.manifestUrl === targetUrl || stream.url === targetUrl);
  const stream = {
    ...f1TvStreamDescriptor(targetUrl, { initiator: details.initiator || details.referrer || "", responseHeaders: details.responseHeaders }),
    url: targetUrl,
    host: (() => {
      try { return new URL(targetUrl).hostname; }
      catch { return ""; }
    })(),
  };
  if (existingIndex >= 0) capturedF1TvStreams.splice(existingIndex, 1);
  capturedF1TvStreams.unshift(stream);
  if (capturedF1TvStreams.length > MAX_CAPTURED_STREAMS) capturedF1TvStreams.length = MAX_CAPTURED_STREAMS;
}

function rememberF1TvRequestHeaders(details) {
  const targetUrl = String(details.url || "");
  if (!activeF1TvResolverCapture && !isF1TvManifestUrl(targetUrl) && !isLikelyF1TvLicenseUrl(targetUrl)) return;
  pendingF1TvRequestHeaders.set(targetUrl, details.requestHeaders || {});
  if (pendingF1TvRequestHeaders.size > 200) {
    const oldest = pendingF1TvRequestHeaders.keys().next().value;
    pendingF1TvRequestHeaders.delete(oldest);
  }
}

function installF1TvStreamCapture() {
  if (f1TvStreamCaptureInstalled) return;
  f1TvStreamCaptureInstalled = true;
  session.defaultSession.webRequest.onBeforeRequest({
    urls: ["*://*/*.m3u8*", "*://*/*m3u8*", "*://*/*.mpd*", "*://*/*mpd*"],
  }, (details, callback) => {
    rememberF1TvStream(details);
    captureF1TvResolverRequest(details);
    callback({});
  });
  session.defaultSession.webRequest.onBeforeSendHeaders({
    urls: ["*://*/*"],
  }, (details, callback) => {
    rememberF1TvRequestHeaders(details);
    captureF1TvResolverRequest(details, details.requestHeaders || {});
    callback({ requestHeaders: details.requestHeaders });
  });
  session.defaultSession.webRequest.onHeadersReceived({
    urls: ["*://*/*"],
  }, (details, callback) => {
    const requestHeaders = pendingF1TvRequestHeaders.get(String(details.url || "")) || {};
    recordF1TvDiagnosticRequest(details, requestHeaders);
    rememberF1TvStream(details);
    captureF1TvResolverRequest(details, requestHeaders);
    callback({ responseHeaders: details.responseHeaders });
  });
}

function openF1TvBrowser(event, options = {}) {
  const parent = BrowserWindow.fromWebContents(event.sender);
  const targetUrl = isF1TvUrl(options.url || "") ? options.url : F1TV_HOME_URL;
  const browserWindow = new BrowserWindow({
    width: 1200,
    height: 820,
    minWidth: 900,
    minHeight: 640,
    title: "F1 TV Browser",
    parent: parent && !parent.isDestroyed() ? parent : undefined,
    modal: false,
    backgroundColor: "#111111",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  browserWindow.webContents.setWindowOpenHandler(({ url: targetUrl }) => {
    if (isF1TvUrl(targetUrl)) return { action: "allow" };
    shell.openExternal(targetUrl);
    return { action: "deny" };
  });

  browserWindow.webContents.on("will-navigate", (navEvent, targetUrl) => {
    if (!isF1TvUrl(targetUrl)) {
      navEvent.preventDefault();
      shell.openExternal(targetUrl);
    }
  });

  browserWindow.loadURL(targetUrl).catch(() => {});
  return getF1TvStatus();
}

function f1TvReplaySearchUrl(options = {}) {
  const meetingKey = String(options.meetingKey || "").replace(/[^0-9]/g, "");
  if (meetingKey) {
    return `https://f1tv.formula1.com/search?filter_MeetingKey=${meetingKey}&filter_objectSubtype=LIVE_EVENT%2CReplay&filter_orderByFom=Y&orderBy=session_index&sortOrder=asc`;
  }
  const query = encodeURIComponent([options.season, options.raceName, options.sessionKind].filter(Boolean).join(" "));
  return `https://f1tv.formula1.com/search?q=${query}`;
}

function openF1TvSessionBrowser(event, options = {}) {
  return openF1TvBrowser(event, {
    url: f1TvReplaySearchUrl(options),
  });
}

function f1TvContentTargetUrl(options = {}) {
  const detailUrl = String(options.detailUrl || options.url || "").trim();
  if (isF1TvUrl(detailUrl)) return detailUrl;
  const contentId = String(options.contentId || "").replace(/[^0-9]/g, "");
  if (contentId) return `https://f1tv.formula1.com/detail/${contentId}/-`;
  return f1TvReplaySearchUrl(options);
}

function f1TvContentIdFromUrl(targetUrl) {
  const match = String(targetUrl || "").match(/\/detail\/([0-9]+)/i);
  return match ? match[1] : "";
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function resolveF1TvContent(_event, options = {}) {
  installF1TvPlaybackPermissions();
  installF1TvStreamCapture();
  let status = await getF1TvStatus();

  const targetUrl = f1TvContentTargetUrl(options);
  const directContentId = f1TvContentIdFromUrl(targetUrl) || String(options.contentId || "").replace(/[^0-9]/g, "");
  const resolverLoadUrl = directContentId ? F1TV_HOME_URL : targetUrl;
  const allowHiddenPlaybackFallback = Boolean(options.allowHiddenPlaybackFallback);
  let resolvedContentId = directContentId;
  const capture = { streams: new Map(), licenseRequests: [], requestSamples: [], playEndpointAttempts: [], contentCandidates: [], targetUrl, preferredLicenseUrl: "" };
  activeF1TvResolverCapture = capture;
  const resolverWindow = new BrowserWindow({
    width: 1280,
    height: 720,
    show: false,
    title: "PitWall F1 TV Resolver",
    backgroundColor: "#000000",
    webPreferences: {
      offscreen: true,
      backgroundThrottling: false,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  resolverWindow.webContents.setWindowOpenHandler(({ url: nextUrl }) => {
    if (isF1TvUrl(nextUrl)) return { action: "allow" };
    return { action: "deny" };
  });

  try {
    await resolverWindow.loadURL(resolverLoadUrl);
    await wait(directContentId ? 450 : 2500);
    const browserAuthState = await readF1TvAuthStateFromWebContents(resolverWindow.webContents);
    status = await getF1TvStatusWithBrowserState(browserAuthState);
    const playbackToken = await getF1TvPlaybackToken();
    const playbackHeaders = f1TvPlaybackHeaders(playbackToken);
    const contentCandidates = directContentId
      ? [{ id: directContentId, score: 99, text: "direct detail url" }]
      : await findF1TvContentCandidatesInPage(resolverWindow.webContents, options);
    capture.contentCandidates = contentCandidates.slice(0, 12);
    let directPlay = { attempts: [], manifests: [], licenseUrls: [] };
    for (const candidate of contentCandidates) {
      const candidateId = String(candidate.id || "").replace(/[^0-9]/g, "");
      if (!candidateId) continue;
      const candidatePlay = await fetchDirectF1TvPlayMetadata(resolverWindow.webContents, candidateId, playbackToken);
      capture.playEndpointAttempts.push(...(candidatePlay.attempts || []).map((attempt) => ({ ...attempt, contentId: candidateId })));
      writePitWallDebugLog("f1tv.resolve.candidate", {
        contentId: candidateId,
        score: candidate.score || 0,
        sessionKind: options.sessionKind || "",
        manifestCount: candidatePlay.manifests?.length || 0,
        licenseSamples: (candidatePlay.licenseUrls || []).slice(0, 3).map(urlDebugParts),
        attemptMessages: (candidatePlay.attempts || []).map((attempt) => attempt.message || attempt.errorDescription || attempt.error || "").filter(Boolean).slice(0, 4),
      });
      if (candidatePlay.manifests?.length) {
        resolvedContentId = candidateId;
        directPlay = candidatePlay;
        break;
      }
    }
    const firstPartyLicenseUrls = (directPlay.licenseUrls || []).filter(isFirstPartyF1TvWidevineLicenseUrl);
    const directStreamMetadata = streamMetadataByManifest(directPlay);
    const preferredLicenseUrls = Array.from(new Set([
      ...firstPartyLicenseUrls,
      ...directF1TvLicenseEndpoints(resolvedContentId),
    ].filter(Boolean)));
    const primaryLicenseUrl = preferredLicenseUrls[0] || "";
    capture.preferredLicenseUrl = primaryLicenseUrl;
    const observedLicenseRequests = capture.licenseRequests.slice();
    capture.licenseRequests = preferredLicenseUrls.map((licenseUrl) => ({
        url: licenseUrl,
        licenseUrl,
        headers: playbackHeaders,
        capturedAt: new Date().toISOString(),
    })).concat(observedLicenseRequests.filter((request) => !preferredLicenseUrls.includes(request.url || request.licenseUrl || "")));
    for (const manifestUrl of directPlay.manifests || []) {
      const previous = capture.streams.get(manifestUrl) || {};
      const streamMetadata = directStreamMetadata.get(manifestUrl) || {};
      capture.streams.set(manifestUrl, f1TvStreamDescriptor(manifestUrl, {
        ...previous,
        ...streamMetadata,
        licenseUrl: primaryLicenseUrl || previous.licenseUrl || capture.licenseRequests[0]?.url || "",
        headers: { ...(previous.headers || {}), ...playbackHeaders },
        initiator: "direct CONTENT/PLAY endpoint",
      }));
    }
    const skipHiddenPlaybackFallback = !allowHiddenPlaybackFallback && (directPlay.manifests?.length || capture.streams.size > 0);
    if (!skipHiddenPlaybackFallback && allowHiddenPlaybackFallback) {
      if (resolverLoadUrl !== targetUrl) {
        await resolverWindow.loadURL(targetUrl);
        await wait(1500);
      }
      await resolverWindow.webContents.executeJavaScript(`
        (() => {
          const nodes = Array.from(document.querySelectorAll('button,a,[role="button"]'));
          const playable = nodes.find((node) => /watch|play|resume|start/i.test([node.textContent, node.ariaLabel, node.title].filter(Boolean).join(" ")));
          if (playable) playable.click();
          const video = document.querySelector('video');
          if (video) video.play().catch(() => {});
          return Boolean(playable || video);
        })();
      `, true).catch(() => false);
      await wait(Number(options.timeoutMs || 9000));
    }
  } finally {
    if (!resolverWindow.isDestroyed()) resolverWindow.destroy();
    if (activeF1TvResolverCapture === capture) activeF1TvResolverCapture = null;
  }

  const licenseUrl = capture.licenseRequests[0]?.url || "";
  const licenseDebug = urlDebugParts(licenseUrl);
  let feeds = Array.from(capture.streams.values()).map((stream, index) => ({
    ...stream,
    feedId: stream.driverCode || (index === 0 ? "WORLD" : /^(hls|dash)$/i.test(String(stream.feedId || "")) ? `feed-${index + 1}` : stream.feedId || `feed-${index + 1}`),
    kind: stream.driverCode ? "onboard" : index === 0 ? "world" : stream.kind === "world" ? "feed" : stream.kind,
    licenseUrl: stream.licenseUrl || licenseUrl,
    drm: stream.licenseUrl || licenseUrl || stream.manifestType === "dash"
      ? { ...(stream.drm || {}), keySystem: "com.widevine.alpha", licenseUrl: stream.licenseUrl || licenseUrl }
      : stream.drm,
  }));
  const timingFeed = feeds.find((feed) => feed.kind === "world" || feed.feedId === "WORLD") || feeds[0] || null;
  const manifestTiming = timingFeed ? await f1TvManifestTiming(timingFeed).catch(() => ({})) : {};
  if (manifestTiming.videoStartUtc) {
    feeds = feeds.map((feed) => ({ ...feed, ...manifestTiming }));
  }

  const result = {
    ok: feeds.length > 0,
    contentId: resolvedContentId || f1TvContentIdFromUrl(targetUrl) || String(options.contentId || ""),
    title: String(options.title || options.sessionKind || "F1 TV session"),
    sourceUrl: targetUrl,
    playbackMode: /live/i.test(String(options.sessionKind || "")) ? "live" : "replay",
    videoStartUtc: manifestTiming.videoStartUtc || "",
    videoStartSource: manifestTiming.videoStartSource || "",
    feeds,
    licenseUrl,
    licenseRequests: capture.licenseRequests.slice(0, 3),
    requestSamples: capture.requestSamples.slice(0, 25),
    playEndpointAttempts: capture.playEndpointAttempts.slice(0, 12),
    contentCandidates: capture.contentCandidates.slice(0, 12),
    authStatus: status,
    message: feeds.length
      ? `Resolved ${feeds.length} F1 TV stream${feeds.length === 1 ? "" : "s"}.`
      : status.authenticated
        ? "No playable stream was discovered for the selected F1 TV result. Try pasting the exact F1 TV detail URL."
        : status.browserSession
          ? "F1 TV browser cookies exist, but the playback token is missing. Sign in with email and password in Settings, then retry."
        : "F1 TV is not connected in this PitWall app profile. MultiViewer login is separate. Connect F1 TV, then load the session again.",
  };
  writePitWallDebugLog("f1tv.resolve.result", {
    ok: result.ok,
    contentId: result.contentId,
    candidateCount: capture.contentCandidates.length,
    feedCount: feeds.length,
    videoStartSynced: Boolean(manifestTiming.videoStartUtc),
    videoStartSource: manifestTiming.videoStartSource || "",
    playAttemptCount: capture.playEndpointAttempts.length,
    playbackTokenReady: Boolean(status.playbackTokenReady),
    licenseHost: licenseDebug.host,
    licensePathHint: licenseDebug.pathHint,
  });
  return result;
}

function sanitizeF1TvDiagnosticResult(result = {}) {
  return {
    ok: Boolean(result.ok),
    contentId: result.contentId || "",
    title: result.title || "",
    playbackMode: result.playbackMode || "",
    message: result.message || "",
    feedCount: (result.feeds || []).length,
    licenseRequestCount: (result.licenseRequests || []).length,
    cdm: {
      configured: Boolean(configuredWidevineCdm || hasElectronComponentsWidevine),
      version: configuredWidevineCdm?.version || "",
      source: configuredWidevineCdm?.source || (hasElectronComponentsWidevine ? "Electron components" : ""),
    },
    authStatus: {
      authenticated: Boolean(result.authStatus?.authenticated),
      playbackTokenReady: Boolean(result.authStatus?.playbackTokenReady),
      browserSession: Boolean(result.authStatus?.browserSession),
      cookieCount: result.authStatus?.cookieCount || 0,
      authCookieNames: result.authStatus?.authCookieNames || [],
      storageAuthKeyCount: (result.authStatus?.storageAuthKeys || []).length,
      browserSignedIn: Boolean(result.authStatus?.browserSignedIn),
      userDataPath: result.authStatus?.userDataPath || PITWALL_USER_DATA,
    },
    feeds: (result.feeds || []).map((feed) => ({
      feedId: feed.feedId || "",
      kind: feed.kind || "",
      label: feed.label || "",
      driverCode: feed.driverCode || "",
      manifestType: feed.manifestType || "",
      manifestId: createHash("sha256").update(String(feed.manifestUrl || "")).digest("hex").slice(0, 16),
      drmKeySystem: feed.drm?.keySystem || "",
      hasLicenseUrl: Boolean(feed.licenseUrl || feed.drm?.licenseUrl),
      licenseHost: urlDebugParts(feed.licenseUrl || feed.drm?.licenseUrl || "").host,
      licensePathHint: urlDebugParts(feed.licenseUrl || feed.drm?.licenseUrl || "").pathHint,
      headerCount: Object.keys(feed.headers || {}).length,
    })),
    contentCandidates: (result.contentCandidates || []).map((candidate) => ({
      id: String(candidate.id || ""),
      score: candidate.score || 0,
      text: String(candidate.text || "").slice(0, 120),
    })),
    requestSamples: (result.requestSamples || []).map((sample) => ({
      host: sample.host || "",
      pathHint: sample.pathHint || "",
      fullPathHint: sample.fullPathHint || "",
      queryKeys: sample.queryKeys || [],
      safeQuery: sample.safeQuery || {},
      requestHeaderNames: sample.requestHeaderNames || [],
      urlId: sample.urlId || "",
      statusCode: sample.statusCode || 0,
      resourceType: sample.resourceType || "",
      contentType: sample.contentType || "",
      manifestCandidate: Boolean(sample.manifestCandidate),
      licenseCandidate: Boolean(sample.licenseCandidate),
    })),
    playEndpointAttempts: (result.playEndpointAttempts || []).map((attempt) => ({
      endpointHint: String(attempt.endpoint || "").replace(/contentId=[0-9]+/i, "contentId={id}"),
      contentId: String(attempt.contentId || ""),
      status: attempt.status || 0,
      ok: Boolean(attempt.ok),
      contentType: attempt.contentType || "",
      bodyKeys: attempt.bodyKeys || [],
      resultCode: attempt.resultCode || "",
      message: attempt.message || "",
      errorDescription: attempt.errorDescription || "",
      channelIds: (attempt.channelIds || []).slice(0, 12).map(String),
      manifestCount: (attempt.manifests || []).length,
      licenseUrlCount: (attempt.licenseUrls || []).length,
      error: attempt.error || "",
    })),
  };
}

function sanitizeF1TvAuthStatus(status = {}) {
  return {
    authenticated: Boolean(status.authenticated),
    playbackTokenReady: Boolean(status.playbackTokenReady),
    browserSession: Boolean(status.browserSession),
    cookieCount: status.cookieCount || 0,
    authCookieCount: (status.authCookieNames || []).length,
    storageAuthKeyCount: (status.storageAuthKeys || []).length,
    browserSignedIn: Boolean(status.browserSignedIn),
    currentHost: (() => {
      try { return status.currentUrl ? new URL(status.currentUrl).hostname : ""; }
      catch { return ""; }
    })(),
    userDataPath: status.userDataPath || PITWALL_USER_DATA,
    lastCheckedAt: status.lastCheckedAt || "",
  };
}

async function runF1TvProbeDiagnosticAndQuit() {
  if (!process.env.PITWALL_F1TV_PROBE_DIAG) return false;
  installF1TvPlaybackPermissions();
  const status = await probeF1TvStoredAuth({
    targetUrl: process.env.PITWALL_F1TV_PROBE_URL || F1TV_HOME_URL,
    timeoutMs: Number(process.env.PITWALL_F1TV_PROBE_TIMEOUT_MS || 1200),
  }).catch(() => getF1TvStatus());
  console.log(JSON.stringify({ pitwallF1TvProbeDiagnostic: sanitizeF1TvAuthStatus(status) }, null, 2));
  app.exit(status.authenticated ? 0 : 2);
  return true;
}

async function runF1TvMediaDiagnostic(result = {}) {
  if (!process.env.PITWALL_F1TV_MEDIA_DIAG) return null;
  const feed = (result.feeds || []).find((item) => item.kind === "world" || item.feedId === "WORLD") || (result.feeds || [])[0];
  if (!feed?.manifestUrl) {
    return { ok: false, message: "No resolved feed manifest was available to fetch." };
  }
  try {
    const cookieHeader = await f1TvCookieHeaderForUrl(feed.manifestUrl);
    const response = await requestBuffer(feed.manifestUrl, {
      method: "GET",
      headers: feed.headers || {},
      cookieHeader,
      timeoutMs: Number(process.env.PITWALL_F1TV_MEDIA_DIAG_TIMEOUT_MS || 15000),
    });
    const text = response.body.slice(0, 512).toString("utf8");
    const mediaDiagnostic = {
      ok: response.status >= 200 && response.status < 300 && response.body.length > 0,
      status: response.status,
      bytes: response.body.length,
      host: new URL(feed.manifestUrl).hostname,
      contentType: response.headers["content-type"] || "",
      manifestType: feed.manifestType || "",
      cookieHeaderIncluded: Boolean(cookieHeader),
      looksLikeMpd: /<MPD[\s>]/i.test(text),
      looksLikeHls: /^#EXTM3U/m.test(text),
      firstText: text.replace(/\s+/g, " ").slice(0, 120),
    };
    writePitWallDebugLog("f1tv.media-diagnostic", mediaDiagnostic);
    return mediaDiagnostic;
  } catch (error) {
    const mediaDiagnostic = {
      ok: false,
      message: error?.message || "F1 TV media diagnostic failed.",
      host: (() => {
        try { return new URL(feed.manifestUrl).hostname; }
        catch { return ""; }
      })(),
      manifestType: feed.manifestType || "",
    };
    writePitWallDebugLog("f1tv.media-diagnostic", mediaDiagnostic);
    return mediaDiagnostic;
  }
}

async function runF1TvDiagnosticAndQuit() {
  const detailUrl = String(process.env.PITWALL_F1TV_DIAG_URL || "").trim();
  const season = String(process.env.PITWALL_F1TV_DIAG_SEASON || "").trim();
  const raceName = String(process.env.PITWALL_F1TV_DIAG_RACE || "").trim();
  const sessionKind = String(process.env.PITWALL_F1TV_DIAG_SESSION || "").trim();
  const meetingKey = String(process.env.PITWALL_F1TV_DIAG_MEETING_KEY || "").trim();
  if (!detailUrl && !season && !raceName && !sessionKind && !meetingKey) return false;
  installF1TvPlaybackPermissions();
  installF1TvStreamCapture();
  try {
    const result = await resolveF1TvContent(null, {
      detailUrl,
      season,
      raceName,
      sessionKind,
      meetingKey,
      timeoutMs: Number(process.env.PITWALL_F1TV_DIAG_TIMEOUT_MS || 12000),
      allowHiddenPlaybackFallback: Boolean(process.env.PITWALL_F1TV_DIAG_FALLBACK),
    });
    const mediaDiagnostic = await runF1TvMediaDiagnostic(result);
    console.log(JSON.stringify({
      pitwallF1TvDiagnostic: sanitizeF1TvDiagnosticResult(result),
      pitwallF1TvMediaDiagnostic: mediaDiagnostic || undefined,
    }, null, 2));
    app.exit(result.ok && (!mediaDiagnostic || mediaDiagnostic.ok) ? 0 : 2);
  } catch (error) {
    const authStatus = await getF1TvStatus().catch(() => ({}));
    console.log(JSON.stringify({
      pitwallF1TvDiagnostic: {
        ok: false,
        message: error?.message || "F1 TV diagnostic failed.",
        cdm: {
          configured: Boolean(configuredWidevineCdm || hasElectronComponentsWidevine),
          version: configuredWidevineCdm?.version || "",
          source: configuredWidevineCdm?.source || (hasElectronComponentsWidevine ? "Electron components" : ""),
        },
        authStatus: {
          authenticated: Boolean(authStatus.authenticated),
          playbackTokenReady: Boolean(authStatus.playbackTokenReady),
          browserSession: Boolean(authStatus.browserSession),
          cookieCount: authStatus.cookieCount || 0,
          authCookieNames: authStatus.authCookieNames || [],
          storageAuthKeyCount: (authStatus.storageAuthKeys || []).length,
          browserSignedIn: Boolean(authStatus.browserSignedIn),
          userDataPath: authStatus.userDataPath || PITWALL_USER_DATA,
        },
      },
    }, null, 2));
    app.exit(1);
  }
  return true;
}

function f1TvLibraryCachePath() {
  return path.join(app.getPath("userData"), F1TV_LIBRARY_CACHE_FILE);
}

function f1TvLibraryCacheEntry(year, allowStale = false) {
  const now = Date.now();
  const fromMemory = f1TvLibraryCache.get(year);
  const memoryCreatedAt = Date.parse(fromMemory?.createdAt || "");
  if (fromMemory?.data?.races?.length && Number.isFinite(memoryCreatedAt) && (allowStale || now - memoryCreatedAt < F1TV_LIBRARY_CACHE_MS)) {
    return { ...fromMemory, source: "memory" };
  }
  try {
    const parsed = JSON.parse(fs.readFileSync(f1TvLibraryCachePath(), "utf8"));
    const entry = parsed?.entries?.[year];
    const createdAt = Date.parse(entry?.createdAt || "");
    if (entry?.data?.races?.length && Number.isFinite(createdAt) && (allowStale || now - createdAt < F1TV_LIBRARY_CACHE_MS)) {
      f1TvLibraryCache.set(year, { createdAt: entry.createdAt, data: entry.data });
      return { createdAt: entry.createdAt, data: entry.data, source: "disk" };
    }
  } catch {}
  return null;
}

function writeF1TvLibraryCache(year, data) {
  if (!data?.races?.length) return;
  const createdAt = new Date().toISOString();
  f1TvLibraryCache.set(year, { createdAt, data });
  try {
    let parsed = {};
    try { parsed = JSON.parse(fs.readFileSync(f1TvLibraryCachePath(), "utf8")); } catch {}
    const entries = { ...(parsed.entries || {}), [year]: { createdAt, data } };
    fs.mkdirSync(path.dirname(f1TvLibraryCachePath()), { recursive: true });
    fs.writeFileSync(f1TvLibraryCachePath(), JSON.stringify({ entries }, null, 2), "utf8");
  } catch {}
}

async function getF1TvLibrary(options = {}) {
  const year = String(options.season || new Date().getFullYear()).replace(/[^0-9]/g, "") || String(new Date().getFullYear());
  const forceRefresh = Boolean(options.forceRefresh);
  if (!forceRefresh) {
    const cached = f1TvLibraryCacheEntry(year);
    if (cached?.data) {
      return {
        ...cached.data,
        cached: true,
        cacheSource: cached.source,
        cacheAgeSeconds: Math.max(0, Math.round((Date.now() - Date.parse(cached.createdAt || "")) / 1000)),
      };
    }
  }
  const [scheduleResult, meetingsResult] = await Promise.allSettled([
    requestJson(`https://api.jolpi.ca/ergast/f1/${year}.json`),
    requestOpenF1Json(`https://api.openf1.org/v1/meetings?year=${year}`),
  ]);
  const scheduleJson = scheduleResult.status === "fulfilled" ? scheduleResult.value : null;
  const meetings = meetingsResult.status === "fulfilled" ? meetingsResult.value : [];
  const races = parseSchedule(scheduleJson, meetings).map((race) => ({
    rnd: race.rnd,
    name: race.name,
    circuit: race.circuit,
    loc: race.loc,
    date: race.date,
    startsAt: race.startsAt,
    status: race.status,
    meetingKey: race.meetingKey,
    sessions: race.sessions?.length ? race.sessions : [
      { kind: "Practice 1", status: "unknown" },
      { kind: "Practice 2", status: "unknown" },
      { kind: "Practice 3", status: "unknown" },
      { kind: "Qualifying", status: "unknown" },
      { kind: "Race", status: "unknown" },
    ],
  }));
  const library = {
    source: "Jolpica + OpenF1",
    season: year,
    races,
    fetchedAt: new Date().toISOString(),
    errors: [scheduleResult, meetingsResult].filter((result) => result.status === "rejected").map((result) => result.reason.message),
  };
  if (library.races.length) {
    writeF1TvLibraryCache(year, library);
    return library;
  }
  const stale = f1TvLibraryCacheEntry(year, true);
  if (stale?.data) {
    return {
      ...stale.data,
      cached: true,
      stale: true,
      cacheSource: stale.source,
      errors: library.errors?.length ? library.errors : ["Using cached F1 TV weekends because fresh library data is unavailable."],
    };
  }
  return library;
}

function sanitizeF1TvLibrary(library = {}) {
  return {
    source: library.source || "",
    season: library.season || "",
    fetchedAt: library.fetchedAt || "",
    errors: library.errors || [],
    races: (library.races || []).map((race) => ({
      rnd: race.rnd || "",
      name: race.name || "",
      status: race.status || "",
      meetingKey: race.meetingKey || "",
      sessionKinds: (race.sessions || []).map((sessionItem) => sessionItem.kind).filter(Boolean),
    })),
  };
}

async function runF1TvLibraryDiagnosticAndQuit() {
  const season = String(process.env.PITWALL_F1TV_LIBRARY_DIAG || "").trim();
  if (!season) return false;
  const library = await getF1TvLibrary({ season }).catch((error) => ({ errors: [error.message || "library failed"], races: [] }));
  console.log(JSON.stringify({ pitwallF1TvLibraryDiagnostic: sanitizeF1TvLibrary(library) }, null, 2));
  app.exit(library.races?.length ? 0 : 2);
  return true;
}

function analyticsSessionDiagnosticSummary(sessionKind, data = {}) {
  const drivers = data.drivers || [];
  const rowsWithPosition = drivers.filter((driver) => finiteNumber(driver.position) != null).length;
  const rowsWithTime = drivers.filter((driver) => finiteNumber(driver.resultDuration) != null || finiteNumber(driver.fastestLap) != null).length;
  const rowsWithGap = drivers.filter((driver) => driver.gapToLeader !== null && driver.gapToLeader !== undefined && driver.gapToLeader !== "").length;
  const rowsWithLaps = drivers.filter((driver) => finiteNumber(driver.laps) != null && Number(driver.laps) > 0).length;
  const rich = drivers.length >= 15 && rowsWithPosition >= 15 && rowsWithTime >= 15 && rowsWithLaps >= 15;
  return {
    sessionKind,
    rich,
    source: data.source || "",
    session: data.session?.name || sessionKind,
    sessionKey: data.session?.key || "",
    driverRows: drivers.length,
    rowsWithPosition,
    rowsWithTime,
    rowsWithGap,
    rowsWithLaps,
    counts: data.counts || {},
    errors: data.errors || [],
    sample: drivers.slice(0, 5).map((driver) => ({
      code: driver.code,
      position: driver.position,
      resultDuration: driver.resultDuration,
      fastestLap: driver.fastestLap,
      gapToLeader: driver.gapToLeader,
      laps: driver.laps,
    })),
  };
}

async function runAnalyticsSessionDiagnosticAndQuit() {
  if (!process.env.PITWALL_ANALYTICS_SESSION_DIAG) return false;
  const season = String(process.env.PITWALL_ANALYTICS_SEASON || new Date().getFullYear()).replace(/[^0-9]/g, "") || String(new Date().getFullYear());
  const meetingKey = String(process.env.PITWALL_ANALYTICS_MEETING_KEY || "").replace(/[^0-9]/g, "");
  const sessionKinds = String(process.env.PITWALL_ANALYTICS_SESSIONS || "Practice 1,Practice 2,Practice 3,Qualifying")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  const results = [];
  for (const sessionKind of sessionKinds) {
    try {
      const data = await getAnalyticsSession({ season, meetingKey, sessionKind });
      results.push(analyticsSessionDiagnosticSummary(sessionKind, data));
    } catch (error) {
      results.push({ sessionKind, rich: false, errors: [error?.message || "Session analytics failed"] });
    }
  }
  const ok = Boolean(meetingKey && results.length && results.every((result) => result.rich));
  console.log(JSON.stringify({
    pitwallAnalyticsSessionDiagnostic: {
      ok,
      season,
      meetingKey,
      results,
    },
  }, null, 2));
  app.exit(ok ? 0 : 2);
  return true;
}

function weekendRecapDomScript() {
  return `(() => {
    const clean = (value) => String(value || "").replace(/\\s+/g, " ").trim();
    const rows = Array.from(document.querySelectorAll(".wk-recap-row")).map((row) => {
      const cells = Array.from(row.children).map((cell) => clean(cell.textContent));
      return {
        pos: cells[0] || "",
        driver: cells[1] || "",
        time: cells[2] || "",
        gap: cells[3] || "",
        interval: cells[4] || "",
        laps: cells[5] || "",
        data: cells[6] || "",
      };
    });
    const selectedStep = Array.from(document.querySelectorAll(".wk-step")).find((step) => step.getAttribute("data-selected") === "true");
    return {
      title: clean(document.querySelector(".wk__title")?.textContent || document.querySelector(".wk-hero__name")?.textContent),
      selectedSession: clean(selectedStep?.querySelector(".wk-step__k")?.textContent),
      loading: /LOADING/.test(document.body.textContent || ""),
      message: clean(Array.from(document.querySelectorAll(".wk-story__txt")).map((node) => node.textContent).join(" | ")),
      rows,
    };
  })()`;
}

function richCell(value) {
  const text = String(value || "").trim();
  return Boolean(text && text !== "—" && !/^n\/a$/i.test(text) && !/loading|waiting/i.test(text));
}

function weekendRecapSummary(sessionKind, dom = {}) {
  const rows = dom.rows || [];
  const rowsWithTime = rows.filter((row) => richCell(row.time)).length;
  const rowsWithGap = rows.filter((row) => richCell(row.gap)).length;
  const rowsWithInterval = rows.filter((row) => richCell(row.interval)).length;
  const rowsWithLaps = rows.filter((row) => richCell(row.laps)).length;
  const rich = rows.length >= 15 && rowsWithTime >= 15 && rowsWithGap >= 15 && rowsWithInterval >= 15 && rowsWithLaps >= 15;
  return {
    sessionKind,
    rich,
    title: dom.title || "",
    selectedSession: dom.selectedSession || "",
    rowCount: rows.length,
    rowsWithTime,
    rowsWithGap,
    rowsWithInterval,
    rowsWithLaps,
    message: dom.message || "",
    sample: rows.slice(0, 5),
  };
}

async function loadWeekendRecapDom(root, serverUrl, rendererEntry, round, sessionKind, timeoutMs) {
  const params = new URLSearchParams({ screen: "weekend" });
  if (round) params.set("weekendRound", String(round));
  if (sessionKind) params.set("weekendSession", String(sessionKind));
  const win = new BrowserWindow({
    width: 1360,
    height: 900,
    show: false,
    backgroundColor: "#07090d",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webviewTag: false,
      preload: path.join(root, "electron/preload.cjs"),
    },
  });
  try {
    await win.loadURL(`${serverUrl}/${rendererEntry}?${params.toString()}`);
    const deadline = Date.now() + timeoutMs;
    let dom = {};
    while (Date.now() < deadline) {
      dom = await win.webContents.executeJavaScript(weekendRecapDomScript(), true).catch((error) => ({ message: error?.message || String(error || "") }));
      if (weekendRecapSummary(sessionKind, dom).rich && !dom.loading) return dom;
      await wait(1000);
    }
    return dom;
  } finally {
    win.destroy();
  }
}

async function runWeekendRecapDiagnosticAndQuit() {
  if (!process.env.PITWALL_WEEKEND_RECAP_DIAG) return false;
  const root = path.resolve(app.getAppPath());
  const { server, url } = await startStaticServer(root);
  staticServer = server;
  const rendererEntry = fs.existsSync(path.join(root, "dist/pitwall/index.html"))
    ? "dist/pitwall/index.html"
    : "ui_kits/pitwall/index.html";
  const round = String(process.env.PITWALL_WEEKEND_ROUND || "").replace(/[^0-9]/g, "");
  const timeoutMs = Math.max(10000, Number(process.env.PITWALL_WEEKEND_RECAP_TIMEOUT_MS || 60000));
  const sessionKinds = String(process.env.PITWALL_WEEKEND_SESSIONS || process.env.PITWALL_WEEKEND_SESSION || "Practice 1,Practice 2,Practice 3,Qualifying")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  const results = [];
  diagnosticWindowRunActive = true;
  try {
    for (const sessionKind of sessionKinds) {
      try {
        const dom = await loadWeekendRecapDom(root, url, rendererEntry, round, sessionKind, timeoutMs);
        results.push(weekendRecapSummary(sessionKind, dom));
      } catch (error) {
        results.push(weekendRecapSummary(sessionKind, { message: error?.message || "Weekend Recap diagnostic failed", rows: [] }));
      }
    }
  } finally {
    diagnosticWindowRunActive = false;
    server.close();
    staticServer = null;
  }
  const ok = Boolean(results.length && results.every((result) => result.rich));
  console.log(JSON.stringify({
    pitwallWeekendRecapDiagnostic: {
      ok,
      round,
      results,
    },
  }, null, 2));
  app.exit(ok ? 0 : 2);
  return true;
}

const AI_VISUALIZATION_ROW_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    code: { type: "string" },
    label: { type: "string" },
    currentCompound: { type: "string" },
    tyreAge: { type: "string" },
    pitStops: { type: "string" },
    recommendation: { type: "string" },
    confidence: { type: "number" },
    stints: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          compound: { type: "string" },
          lapStart: { type: "string" },
          lapEnd: { type: "string" },
          laps: { type: "string" },
        },
        required: ["compound", "lapStart", "lapEnd", "laps"],
      },
    },
  },
  required: ["code", "label", "currentCompound", "tyreAge", "pitStops", "recommendation", "confidence", "stints"],
};

const AI_PREDICTION_CANDIDATE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    code: { type: "string" },
    label: { type: "string" },
    confidence: { type: "number" },
    probability: { type: "number" },
    reason: { type: "string" },
  },
  required: ["code", "label", "confidence", "probability", "reason"],
};

const AI_PREDICTION_WATCH_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    label: { type: "string" },
    prediction: { type: "string" },
    confidence: { type: "number" },
    reason: { type: "string" },
  },
  required: ["label", "prediction", "confidence", "reason"],
};

const AI_PREDICTIONS_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    available: { type: "boolean" },
    title: { type: "string" },
    summary: { type: "string" },
    winner: { type: "array", items: AI_PREDICTION_CANDIDATE_SCHEMA },
    podium: { type: "array", items: AI_PREDICTION_CANDIDATE_SCHEMA },
    watchlist: { type: "array", items: AI_PREDICTION_WATCH_SCHEMA },
    caveat: { type: "string" },
  },
  required: ["available", "title", "summary", "winner", "podium", "watchlist", "caveat"],
};

const AI_RESPONSE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    summary: { type: "string" },
    alerts: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          kind: { type: "string" },
          title: { type: "string" },
          body: { type: "string" },
          confidence: { type: "number" },
        },
        required: ["kind", "title", "body", "confidence"],
      },
    },
    visualization: {
      type: "object",
      additionalProperties: false,
      properties: {
        kind: { type: "string", enum: ["none", "tyre_strategy", "comparison", "timeline", "battle"] },
        title: { type: "string" },
        subtitle: { type: "string" },
        rows: { type: "array", items: AI_VISUALIZATION_ROW_SCHEMA },
        notes: { type: "array", items: { type: "string" } },
      },
      required: ["kind", "title", "subtitle", "rows", "notes"],
    },
    predictions: AI_PREDICTIONS_SCHEMA,
  },
  required: ["summary", "alerts", "visualization", "predictions"],
};

const AI_SYSTEM_PROMPT = [
  "You are PitWall's F1 race strategist.",
  "Use only the provided JSON snapshot.",
  "The app computes exact gaps, standings, weather, tyre stints, pit counts, lap samples, and battle candidates before calling you.",
  "Explain strategy, risks, and what to watch in concise race-engineer language.",
  "Return valid JSON matching the schema: summary, alerts, visualization, and predictions.",
  "Set visualization.kind to tyre_strategy for tyre, stint, compound, pit-window, or race-plan questions.",
  "Set visualization.kind to comparison, timeline, or battle only when that helps the user understand the answer.",
  "Set visualization.kind to none with empty title, subtitle, rows, and notes when prose is clearer.",
  "Never invent tyre compounds or stint laps when snapshot.strategyContext.tyreStrategy.available is false; explain what is missing instead.",
  "Always include predictions. Set predictions.available=true only for a Current weekend race forecast, otherwise set it false with empty winner, podium, and watchlist arrays.",
  "When predictions are available, label them as projections, use confidence and probability values from 0 to 1, and ground every winner, podium, and watchlist reason in the snapshot.",
].join(" ");

function aiPayload(options = {}) {
  return {
    prompt: String(options.prompt || "Summarize the live F1 snapshot."),
    snapshot: options.snapshot || {},
    visualizationGuide: "Return visualization.kind='none' for text-only answers. Use 'tyre_strategy' with one row per relevant driver when tyre, stint, pit, compound, or race-plan data is best shown visually.",
    predictionGuide: "Return predictions.available=true only for a Current weekend race forecast. Otherwise use available=false with empty winner, podium, and watchlist arrays.",
    generatedAt: new Date().toISOString(),
  };
}

function tryParseAiJson(text) {
  const clean = String(text || "").trim().replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim();
  if (!clean) return null;
  try { return JSON.parse(clean); }
  catch {
    const objectMatch = clean.match(/\{[\s\S]*\}/);
    if (!objectMatch) return null;
    try { return JSON.parse(objectMatch[0]); }
    catch { return null; }
  }
}

function normalizeAiResult(provider, text, raw) {
  const parsed = tryParseAiJson(text);
  if (parsed?.summary) {
    const visualization = parsed.visualization?.kind && parsed.visualization.kind !== "none" ? parsed.visualization : null;
    return {
      provider,
      summary: String(parsed.summary),
      alerts: Array.isArray(parsed.alerts) ? parsed.alerts : [],
      visualization,
      predictions: normalizeDailyPredictions(parsed.predictions),
      raw,
    };
  }
  return {
    provider,
    summary: String(text || "The provider returned an empty response."),
    alerts: [],
    visualization: null,
    predictions: emptyDailyPredictions(),
    raw,
  };
}

function openAiText(raw) {
  if (raw.output_text) return raw.output_text;
  return (raw.output || [])
    .flatMap((item) => item.content || [])
    .map((content) => content.text || "")
    .filter(Boolean)
    .join("\n");
}

function grokText(raw) {
  return raw?.choices?.[0]?.message?.content || "";
}

function responsesBody(model, options = {}) {
  const body = {
    model,
    input: [
      { role: "system", content: [{ type: "input_text", text: AI_SYSTEM_PROMPT }] },
      { role: "user", content: [{ type: "input_text", text: JSON.stringify(aiPayload(options)) }] },
    ],
    text: {
      format: {
        type: "json_schema",
        name: "pitwall_ai_response",
        strict: true,
        schema: AI_RESPONSE_SCHEMA,
      },
    },
    max_output_tokens: 900,
  };
  if (/^gpt-5\.(4|5)/.test(model)) {
    body.reasoning = { effort: "low" };
    delete body.max_output_tokens;
  }
  return body;
}

function codexResponsesBody(model, options = {}) {
  return {
    model,
    instructions: AI_SYSTEM_PROMPT,
    input: [
      { role: "user", content: [{ type: "input_text", text: JSON.stringify(aiPayload(options)) }] },
    ],
    text: {
      format: {
        type: "json_schema",
        name: "pitwall_ai_response",
        strict: true,
        schema: AI_RESPONSE_SCHEMA,
      },
    },
    reasoning: { effort: "low" },
    store: false,
    stream: true,
  };
}

function codexStreamJson(line) {
  if (!line.startsWith("data: ")) return null;
  const data = line.slice(6).trim();
  if (!data || data === "[DONE]") return null;
  try { return JSON.parse(data); }
  catch { return null; }
}

function parseCodexResponsesStream(text) {
  let outputText = "";
  let response = null;
  const events = [];
  for (const block of String(text || "").split(/\n\n+/)) {
    for (const line of block.split(/\n/)) {
      const event = codexStreamJson(line);
      if (!event) continue;
      events.push(event.type || "");
      if (typeof event.delta === "string") outputText += event.delta;
      if (event.type === "response.output_text.done" && typeof event.text === "string") outputText = event.text;
      if (event.response) response = event.response;
      const errorMessage = event.error?.message || event.response?.error?.message;
      if (errorMessage) throw new Error(errorMessage);
    }
  }
  return { ...(response || {}), output_text: outputText, stream_events: events };
}

async function requestCodexResponsesStream(targetUrl, body, headers = {}) {
  const text = await requestTextPost(targetUrl, body, {
    "Accept": "text/event-stream, application/json",
    ...headers,
  });
  return parseCodexResponsesStream(text);
}

async function askOpenAI(options = {}) {
  const key = await getSecret("openai");
  if (!key) throw new Error("Add an OpenAI API key in Settings first.");
  const raw = await requestJsonPost(OPENAI_RESPONSES_URL, responsesBody(options.model || "gpt-4o-mini", options), { Authorization: `Bearer ${key}` });
  return normalizeAiResult("openai", openAiText(raw), raw);
}

async function askCodex(options = {}) {
  const tokens = await getActiveOAuthSession("codex");
  if (!tokens) throw new Error("Connect ChatGPT (Codex) in Settings first.");
  const model = knownModel(options.model, CODEX_MODELS, DEFAULT_CODEX_MODEL);
  const headers = {
    Authorization: `Bearer ${tokens.accessToken}`,
    originator: "codex_cli_rs",
    "OpenAI-Beta": "responses=v1",
    "x-responsesapi-include-timing-metrics": "true",
  };
  if (tokens.accountId) headers["chatgpt-account-id"] = tokens.accountId;
  const raw = await requestCodexResponsesStream(CODEX_BACKEND_RESPONSES_URL, codexResponsesBody(model, options), headers);
  return normalizeAiResult("codex", openAiText(raw), raw);
}

function anthropicText(raw) {
  return (raw.content || []).map((part) => part.text || "").filter(Boolean).join("\n");
}

async function askAnthropic(options = {}) {
  const key = await getSecret("anthropic");
  if (!key) throw new Error("Add an Anthropic API key in Settings first.");
  const raw = await requestJsonPost(ANTHROPIC_MESSAGES_URL, {
    model: options.model || "claude-sonnet-4-20250514",
    max_tokens: 900,
    system: AI_SYSTEM_PROMPT,
    messages: [
      { role: "user", content: JSON.stringify(aiPayload(options)) },
    ],
  }, {
    "x-api-key": key,
    "anthropic-version": "2023-06-01",
  });
  return normalizeAiResult("anthropic", anthropicText(raw), raw);
}

async function askGrok(options = {}) {
  const tokens = await getActiveOAuthSession("grok");
  if (!tokens) throw new Error("Connect Grok in Settings first.");
  const model = knownModel(options.model, GROK_MODELS, DEFAULT_GROK_MODEL);
  const raw = await requestJsonPost(GROK_CHAT_COMPLETIONS_URL, {
    model,
    messages: [
      { role: "system", content: AI_SYSTEM_PROMPT },
      { role: "user", content: JSON.stringify(aiPayload(options)) },
    ],
    temperature: 0.4,
    max_tokens: 1200,
  }, { Authorization: `Bearer ${tokens.accessToken}` });
  return normalizeAiResult("grok", grokText(raw), raw);
}

async function askConfiguredAi(options = {}) {
  const preferred = String(options.provider || "").toLowerCase();
  if (preferred === "codex") return askCodex(options);
  if (preferred === "grok") return askGrok(options);
  if (preferred === "openai") return askOpenAI(options);
  if (preferred === "anthropic") return askAnthropic(options);
  if (await getActiveOAuthSession("grok")) return askGrok(options);
  if (await getActiveOAuthSession("codex")) return askCodex(options);
  if (await getSecret("anthropic")) return askAnthropic(options);
  if (await getSecret("openai")) return askOpenAI(options);
  throw new Error("Connect ChatGPT, connect Grok, or add an OpenAI/Anthropic API key in Settings first.");
}

function openF1AnalyticsUrl(endpoint, params = {}) {
  const base = OPENF1_ANALYTICS_ENDPOINTS[endpoint];
  if (!base) throw new Error(`Unsupported OpenF1 analytics endpoint: ${endpoint}`);
  const url = new URL(base);
  for (const [key, value] of Object.entries(params)) {
    if (value == null || value === "") continue;
    url.searchParams.set(key, String(value));
  }
  return url.href;
}

function openF1AnalyticsError(error) {
  const message = error?.message || String(error || "");
  const friendly = /HTTP 429\b/.test(message)
    ? new Error("OpenF1 rate limit reached. Wait a minute, then load this session again.")
    : /HTTP 404\b/.test(message)
      ? new Error("OpenF1 has not published analytics for this session yet.")
      : new Error(message.replace(/ for https:\/\/api\.openf1\.org\/v1\/\S+/g, ""));
  friendly.rateLimited = /HTTP 429\b/.test(message);
  return friendly;
}

async function requestOpenF1Analytics(endpoint, params = {}) {
  try {
    return await requestOpenF1Json(openF1AnalyticsUrl(endpoint, params), { timeout: 12000 });
  } catch (error) {
    throw openF1AnalyticsError(error);
  }
}

async function requestOpenF1AnalyticsWithRetry(endpoint, params = {}) {
  let lastError = null;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await requestOpenF1Analytics(endpoint, params);
    } catch (error) {
      lastError = error;
      const rateLimited = error?.rateLimited || /HTTP 429\b|rate limit/i.test(error?.message || "");
      if (!rateLimited || attempt === 2) throw error;
      await wait(OPENF1_ANALYTICS_RETRY_MS * (attempt + 1));
    }
  }
  throw lastError || new Error("OpenF1 request failed");
}

function cleanSessionName(value) {
  const text = compactText(value);
  if (text === "fp1" || text === "free practice 1") return "practice 1";
  if (text === "fp2" || text === "free practice 2") return "practice 2";
  if (text === "fp3" || text === "free practice 3") return "practice 3";
  return text;
}

function finiteNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function numberList(value) {
  return (Array.isArray(value) ? value : [value])
    .map(finiteNumber)
    .filter((number) => number != null);
}

function bestDuration(value) {
  const values = numberList(value);
  return values.length ? Math.min(...values) : null;
}

function positiveDuration(value) {
  const values = numberList(value).filter((number) => number > 0);
  return values.length ? Math.min(...values) : null;
}

function sessionResultDuration(value) {
  const values = numberList(value).filter((number) => number > 0);
  return values.length ? values.at(-1) : null;
}

function sessionResultGap(value) {
  if (Array.isArray(value)) {
    for (let index = value.length - 1; index >= 0; index -= 1) {
      const item = value[index];
      if (item === null || item === undefined || item === "") continue;
      const numeric = finiteNumber(item);
      return numeric != null ? numeric : item;
    }
    return "";
  }
  const numeric = finiteNumber(value);
  return numeric != null ? numeric : (value ?? "");
}

function average(values) {
  const nums = values.filter((value) => value != null && Number.isFinite(value));
  return nums.length ? nums.reduce((sum, value) => sum + value, 0) / nums.length : null;
}

function minMetric(rows, key) {
  const values = rows.map((row) => finiteNumber(row[key])).filter((value) => value != null);
  return values.length ? Math.min(...values) : null;
}

function maxLapSpeed(rows) {
  const values = [];
  for (const row of rows) {
    for (const key of ["i1_speed", "i2_speed", "st_speed"]) {
      const value = finiteNumber(row[key]);
      if (value != null) values.push(value);
    }
  }
  return values.length ? Math.max(...values) : null;
}

function lapDurationSlope(rows) {
  const values = rows
    .map((row) => ({ lap: finiteNumber(row.lap_number), duration: finiteNumber(row.lap_duration) }))
    .filter((row) => row.lap != null && row.duration != null)
    .sort((a, b) => a.lap - b.lap);
  if (values.length < 4) return null;
  const meanLap = average(values.map((row) => row.lap));
  const meanDuration = average(values.map((row) => row.duration));
  let numerator = 0;
  let denominator = 0;
  for (const row of values) {
    numerator += (row.lap - meanLap) * (row.duration - meanDuration);
    denominator += (row.lap - meanLap) ** 2;
  }
  return denominator ? numerator / denominator : null;
}

function analyticsDriverCode(openDriver, fallbackDrivers) {
  const rawCode = String(openDriver?.name_acronym || "").trim().toUpperCase();
  if (/^[A-Z]{3}$/.test(rawCode)) return rawCode;
  const number = Number(openDriver?.driver_number);
  const fallback = fallbackDrivers.find((driver) => Number(driver.num) === number);
  return fallback?.code || String(number || "");
}

function summarizeAnalyticsDrivers(raw, fallbackDrivers) {
  const openDrivers = Array.isArray(raw.drivers) ? raw.drivers : [];
  const drivers = parseOpenDrivers(openDrivers, fallbackDrivers, []);
  const byNumber = new Map(openDrivers.map((driver) => [Number(driver.driver_number), {
    ...driver,
    code: analyticsDriverCode(driver, fallbackDrivers),
  }]));
  const fallbackByNumber = new Map(fallbackDrivers.map((driver) => [Number(driver.num), driver]));
  const numbers = new Set([
    ...openDrivers.map((driver) => Number(driver.driver_number)),
    ...(raw.laps || []).map((row) => Number(row.driver_number)),
    ...(raw.sessionResult || []).map((row) => Number(row.driver_number)),
  ].filter((number) => Number.isFinite(number) && number > 0));
  const resultByNumber = new Map((raw.sessionResult || []).map((row) => [Number(row.driver_number), row]));
  const overtakesByNumber = new Map();
  for (const row of raw.overtakes || []) {
    const number = Number(row.overtaking_driver_number);
    overtakesByNumber.set(number, (overtakesByNumber.get(number) || 0) + 1);
  }

  return Array.from(numbers).map((number) => {
    const openDriver = byNumber.get(number) || {};
    const fallback = fallbackByNumber.get(number) || {};
    const parsedDriver = drivers.find((driver) => Number(driver.num) === number) || fallback;
    const code = openDriver.code || parsedDriver.code || fallback.code || String(number);
    const laps = (raw.laps || []).filter((row) => Number(row.driver_number) === number);
    const cleanLaps = laps.filter((row) => {
      const duration = finiteNumber(row.lap_duration);
      return duration != null && duration > 0 && !row.is_pit_out_lap;
    });
    const paceLaps = cleanLaps.slice().sort((a, b) => Number(a.lap_duration) - Number(b.lap_duration)).slice(0, 5);
    const result = resultByNumber.get(number) || {};
    const stints = (raw.stints || [])
      .filter((row) => Number(row.driver_number) === number)
      .sort((a, b) => Number(a.stint_number || 0) - Number(b.stint_number || 0))
      .map((row) => ({
        compound: String(row.compound || "").trim().toLowerCase() || "unknown",
        lapStart: finiteNumber(row.lap_start),
        lapEnd: finiteNumber(row.lap_end),
        tyreAgeAtStart: finiteNumber(row.tyre_age_at_start),
      }));
    const pitStops = (raw.pit || []).filter((row) => Number(row.driver_number) === number);
    return {
      code,
      number,
      name: parsedDriver.name || openDriver.full_name || code,
      team: parsedDriver.team || openDriver.team_name || fallback.team || "",
      teamAbbr: parsedDriver.abbr || fallback.abbr || teamAbbr(parsedDriver.team || openDriver.team_name || ""),
      color: parsedDriver.color || (openDriver.team_colour ? `#${String(openDriver.team_colour).replace(/^#/, "")}` : fallback.color || "var(--accent)"),
      image: parsedDriver.image || fallback.image || "",
      position: finiteNumber(result.position),
      resultDuration: sessionResultDuration(result.duration),
      gapToLeader: sessionResultGap(result.gap_to_leader),
      laps: finiteNumber(result.number_of_laps) ?? cleanLaps.length,
      fastestLap: minMetric(cleanLaps, "lap_duration") ?? sessionResultDuration(result.duration),
      avgLap: average(paceLaps.map((row) => finiteNumber(row.lap_duration))),
      sectors: {
        s1: minMetric(cleanLaps, "duration_sector_1"),
        s2: minMetric(cleanLaps, "duration_sector_2"),
        s3: minMetric(cleanLaps, "duration_sector_3"),
      },
      topSpeed: maxLapSpeed(cleanLaps),
      tyreDeg: lapDurationSlope(cleanLaps),
      stints,
      pitStops: pitStops.length,
      pitLoss: average(pitStops.map((row) => finiteNumber(row.lane_duration) ?? finiteNumber(row.pit_duration))),
      overtakes: overtakesByNumber.get(number) || 0,
    };
  }).sort((a, b) => {
    if (a.position && b.position) return a.position - b.position;
    if (a.fastestLap && b.fastestLap) return a.fastestLap - b.fastestLap;
    return a.code.localeCompare(b.code);
  });
}

function analyticsSessionCachePath() {
  return path.join(app.getPath("userData"), ANALYTICS_SESSION_CACHE_FILE);
}

function readAnalyticsSessionDiskCache() {
  try {
    const parsed = JSON.parse(fs.readFileSync(analyticsSessionCachePath(), "utf8"));
    return parsed && typeof parsed === "object" && parsed.entries ? parsed : { entries: {} };
  } catch {
    return { entries: {} };
  }
}

function analyticsDiskEntryFresh(entry) {
  const createdAt = Date.parse(entry?.createdAt || "");
  return Boolean(entry?.data && Number.isFinite(createdAt) && Date.now() - createdAt < ANALYTICS_DISK_CACHE_MS);
}

function analyticsAliasKey(options = {}) {
  const season = String(options.season || new Date().getFullYear()).replace(/[^0-9]/g, "") || String(new Date().getFullYear());
  const meetingKey = finiteNumber(options.meetingKey) || "";
  const sessionNeedle = cleanSessionName(options.sessionKind || options.sessionName || "Race");
  return [season, meetingKey, sessionNeedle].join(":");
}

function analyticsSessionDiskEntry(keys = [], options = {}) {
  const cache = readAnalyticsSessionDiskCache();
  const allowStale = Boolean(options.allowStale);
  for (const key of keys.filter(Boolean)) {
    const entry = cache.entries[key];
    const createdAt = Date.parse(entry?.createdAt || "");
    if (entry?.data && Number.isFinite(createdAt) && (allowStale || analyticsDiskEntryFresh(entry))) {
      if (options.withMeta) return { key, createdAt: entry.createdAt, data: entry.data };
      return entry.data;
    }
  }
  return null;
}

function writeAnalyticsSessionDiskCache(keys = [], data) {
  const cache = readAnalyticsSessionDiskCache();
  const createdAt = new Date().toISOString();
  for (const key of keys.filter(Boolean)) {
    cache.entries[key] = { createdAt, data };
  }
  const entries = Object.entries(cache.entries).slice(-64);
  fs.mkdirSync(path.dirname(analyticsSessionCachePath()), { recursive: true });
  fs.writeFileSync(analyticsSessionCachePath(), JSON.stringify({ entries: Object.fromEntries(entries) }), "utf8");
}

function analyticsCacheFingerprint(data = {}) {
  return createHash("sha256").update(JSON.stringify({
    session: data.session || {},
    weather: data.weather || {},
    drivers: data.drivers || [],
    counts: data.counts || {},
    errors: data.errors || [],
  })).digest("hex");
}

function cachedAnalyticsSessionData(data, source, createdAt, revalidating = false) {
  const createdAtMs = Date.parse(createdAt || "");
  return {
    ...data,
    cached: true,
    cacheSource: source,
    cacheAgeSeconds: Number.isFinite(createdAtMs) ? Math.max(0, Math.round((Date.now() - createdAtMs) / 1000)) : 0,
    revalidating: Boolean(revalidating),
  };
}

function shouldRevalidateAnalyticsCache(createdAt) {
  const createdAtMs = typeof createdAt === "number" ? createdAt : Date.parse(createdAt || "");
  return !Number.isFinite(createdAtMs) || Date.now() - createdAtMs >= ANALYTICS_REVALIDATE_MS;
}

function trimAnalyticsSessionMemoryCache() {
  if (analyticsSessionCache.size > 10) {
    analyticsSessionCache.delete(analyticsSessionCache.keys().next().value);
  }
}

async function resolveAnalyticsSession(options = {}) {
  const explicitSessionKey = finiteNumber(options.sessionKey);
  if (explicitSessionKey) {
    return { session_key: explicitSessionKey, session_name: String(options.sessionKind || "Selected session"), meeting_key: finiteNumber(options.meetingKey) || null };
  }
  const meetingKey = finiteNumber(options.meetingKey);
  if (!meetingKey) throw new Error("Select a race weekend with OpenF1 meeting data.");
  const sessions = await requestOpenF1Analytics("sessions", { meeting_key: meetingKey });
  const sessionNeedle = cleanSessionName(options.sessionKind || options.sessionName || "Race");
  const scored = (sessions || []).map((sessionItem) => {
    const name = cleanSessionName(sessionItem.session_name || sessionItem.session_type);
    const exact = name === sessionNeedle ? 4 : 0;
    const fuzzy = name.includes(sessionNeedle) || sessionNeedle.includes(name) ? 2 : 0;
    return { sessionItem, score: exact + fuzzy };
  }).sort((a, b) => b.score - a.score);
  return scored[0]?.score > 0 ? scored[0].sessionItem : sessions?.[0];
}

async function buildAnalyticsSessionData(sessionInfo, options = {}) {
  const sessionKey = finiteNumber(sessionInfo?.session_key);
  if (!sessionKey) throw new Error("OpenF1 did not return a session key for this selection.");
  const requests = {
    drivers: ["drivers", { session_key: sessionKey }],
    laps: ["laps", { session_key: sessionKey }],
    overtakes: ["overtakes", { session_key: sessionKey }],
    pit: ["pit", { session_key: sessionKey }],
    sessionResult: ["sessionResult", { session_key: sessionKey }],
    stints: ["stints", { session_key: sessionKey }],
    weather: ["weather", { session_key: sessionKey }],
  };
  const raw = {};
  const errors = [];
  let requestIndex = 0;
  const requestEntries = Object.entries(requests);
  for (const [key, [endpoint, params]] of requestEntries) {
    try {
      const rows = await requestOpenF1AnalyticsWithRetry(endpoint, params);
      raw[key] = Array.isArray(rows) ? rows : [];
    } catch (error) {
      raw[key] = [];
      errors.push(error?.message || "OpenF1 request failed");
    }
    requestIndex += 1;
    if (requestIndex < requestEntries.length) await wait(OPENF1_ANALYTICS_REQUEST_DELAY_MS);
  }
  const hasPublishedRows = ["drivers", "laps", "sessionResult"].some((key) => raw[key]?.length);
  if (!hasPublishedRows && !errors.length) {
    errors.push("OpenF1 has not published analytics rows for this session yet.");
  }
  const fallback = readFallbackPitWallData();
  const data = {
    source: "OpenF1",
    fetchedAt: new Date().toISOString(),
    errors,
    session: {
      key: sessionKey,
      meetingKey: finiteNumber(sessionInfo.meeting_key),
      name: sessionInfo.session_name || options.sessionKind || "Selected session",
      type: sessionInfo.session_type || "",
      dateStart: sessionInfo.date_start || "",
      dateEnd: sessionInfo.date_end || "",
      circuit: sessionInfo.circuit_short_name || "",
      location: [sessionInfo.location, sessionInfo.country_name].filter(Boolean).join(", "),
      year: sessionInfo.year || options.season || "",
    },
    weather: parseWeather(raw.weather || []),
    drivers: summarizeAnalyticsDrivers(raw, fallback.drivers),
    counts: Object.fromEntries(Object.entries(raw).map(([key, rows]) => [key, rows.length])),
  };
  return data;
}

function refreshAnalyticsSessionCache({ cacheKey, aliasKey, options = {}, sessionInfo = null, cachedData = null } = {}) {
  const refreshKeys = [cacheKey, aliasKey].filter(Boolean).map(String);
  if (!refreshKeys.length || refreshKeys.some((key) => analyticsRefreshInFlight.has(key))) return;
  for (const key of refreshKeys) analyticsRefreshInFlight.set(key, true);
  Promise.resolve().then(async () => {
    const resolvedSession = sessionInfo || await resolveAnalyticsSession(options);
    const resolvedSessionKey = finiteNumber(resolvedSession?.session_key);
    if (!resolvedSessionKey) return;
    const resolvedCacheKey = String(resolvedSessionKey);
    const data = await buildAnalyticsSessionData(resolvedSession, options);
    const previousData = cachedData
      || analyticsSessionCache.get(resolvedCacheKey)?.data
      || analyticsSessionDiskEntry([resolvedCacheKey, aliasKey], { allowStale: true });
    const createdAt = Date.now();
    if (analyticsCacheFingerprint(previousData) !== analyticsCacheFingerprint(data)) {
      analyticsSessionCache.set(resolvedCacheKey, { createdAt, data });
      writeAnalyticsSessionDiskCache([resolvedCacheKey, aliasKey], data);
    } else {
      analyticsSessionCache.set(resolvedCacheKey, { createdAt, data: previousData || data });
    }
    trimAnalyticsSessionMemoryCache();
  }).catch(() => {}).finally(() => {
    for (const key of refreshKeys) analyticsRefreshInFlight.delete(key);
  });
}

async function getAnalyticsSession(options = {}) {
  const aliasKey = analyticsAliasKey(options);
  const aliasDiskEntry = analyticsSessionDiskEntry([aliasKey], { withMeta: true });
  if (aliasDiskEntry?.data) {
    const shouldRefresh = shouldRevalidateAnalyticsCache(aliasDiskEntry.createdAt);
    if (shouldRefresh) refreshAnalyticsSessionCache({ aliasKey, options, cachedData: aliasDiskEntry.data });
    return cachedAnalyticsSessionData(aliasDiskEntry.data, "disk", aliasDiskEntry.createdAt, shouldRefresh);
  }
  const staleAliasEntry = analyticsSessionDiskEntry([aliasKey], { allowStale: true, withMeta: true });
  if (staleAliasEntry?.data) {
    refreshAnalyticsSessionCache({ aliasKey, options, cachedData: staleAliasEntry.data });
    return cachedAnalyticsSessionData(staleAliasEntry.data, "disk", staleAliasEntry.createdAt, true);
  }
  let sessionInfo = null;
  try {
    sessionInfo = await resolveAnalyticsSession(options);
  } catch (error) {
    const diskData = analyticsSessionDiskEntry([aliasKey]);
    if (diskData && /rate limit|HTTP 429/i.test(error?.message || "")) return diskData;
    throw error;
  }
  const sessionKey = finiteNumber(sessionInfo?.session_key);
  if (!sessionKey) throw new Error("OpenF1 did not return a session key for this selection.");
  const cacheKey = String(sessionKey);
  const cached = analyticsSessionCache.get(cacheKey);
  if (cached) {
    const shouldRefresh = shouldRevalidateAnalyticsCache(cached.createdAt);
    if (shouldRefresh) refreshAnalyticsSessionCache({ cacheKey, aliasKey, options, sessionInfo, cachedData: cached.data });
    return cachedAnalyticsSessionData(cached.data, "memory", new Date(cached.createdAt).toISOString(), shouldRefresh);
  }
  const diskEntry = analyticsSessionDiskEntry([cacheKey, aliasKey], { withMeta: true });
  if (diskEntry?.data) {
    const shouldRefresh = shouldRevalidateAnalyticsCache(diskEntry.createdAt);
    analyticsSessionCache.set(cacheKey, { createdAt: Date.parse(diskEntry.createdAt || "") || Date.now(), data: diskEntry.data });
    trimAnalyticsSessionMemoryCache();
    if (shouldRefresh) refreshAnalyticsSessionCache({ cacheKey, aliasKey, options, sessionInfo, cachedData: diskEntry.data });
    return cachedAnalyticsSessionData(diskEntry.data, "disk", diskEntry.createdAt, shouldRefresh);
  }
  const staleDiskEntry = analyticsSessionDiskEntry([cacheKey, aliasKey], { allowStale: true, withMeta: true });
  const staleDiskData = analyticsSessionDiskEntry([cacheKey, aliasKey], { allowStale: true });
  if (staleDiskEntry?.data || staleDiskData) {
    const data = staleDiskEntry?.data || staleDiskData;
    analyticsSessionCache.set(cacheKey, { createdAt: Date.now(), data });
    trimAnalyticsSessionMemoryCache();
    refreshAnalyticsSessionCache({ cacheKey, aliasKey, options, sessionInfo, cachedData: data });
    return cachedAnalyticsSessionData(data, "disk", staleDiskEntry?.createdAt, true);
  }

  const data = await buildAnalyticsSessionData(sessionInfo, options);
  analyticsSessionCache.set(cacheKey, { createdAt: Date.now(), data });
  writeAnalyticsSessionDiskCache([cacheKey, aliasKey], data);
  trimAnalyticsSessionMemoryCache();
  return data;
}

function historicalEndpoint(options = {}) {
  const season = String(options.season || new Date().getFullYear()).replace(/[^0-9]/g, "") || "current";
  const query = String(options.query || "").toLowerCase();
  if (/constructor|team/.test(query)) return `https://api.jolpi.ca/ergast/f1/${season}/constructorStandings.json`;
  if (/standing|title|championship|points|leader/.test(query)) return `https://api.jolpi.ca/ergast/f1/${season}/driverStandings.json`;
  if (/schedule|calendar|round|session/.test(query)) return `https://api.jolpi.ca/ergast/f1/${season}.json`;
  return `https://api.jolpi.ca/ergast/f1/${season}/last/results.json`;
}

function summarizeHistoricalResult(url, json) {
  const mr = json?.MRData || {};
  const races = mr.RaceTable?.Races || [];
  const driverRows = mr.StandingsTable?.StandingsLists?.[0]?.DriverStandings || [];
  const constructorRows = mr.StandingsTable?.StandingsLists?.[0]?.ConstructorStandings || [];
  if (driverRows.length) {
    const leader = driverRows[0];
    return `Driver standings loaded: ${leader.Driver?.givenName || ""} ${leader.Driver?.familyName || ""} leads with ${leader.points} points.`;
  }
  if (constructorRows.length) {
    const leader = constructorRows[0];
    return `Constructor standings loaded: ${leader.Constructor?.name || "leader"} leads with ${leader.points} points.`;
  }
  if (races.length) {
    const race = races.at(-1);
    return `Race data loaded for ${race.raceName || "the selected event"} (${races.length} row${races.length === 1 ? "" : "s"}).`;
  }
  return `Historical data loaded from ${new URL(url).pathname}.`;
}

async function queryHistory(options = {}) {
  const url = historicalEndpoint(options);
  const json = await requestJson(url);
  return {
    source: "Jolpica",
    url,
    summary: summarizeHistoricalResult(url, json),
    data: json?.MRData || json,
    fetchedAt: new Date().toISOString(),
  };
}

function scheduleReminder(options = {}) {
  const id = String(options.id || `reminder-${Date.now()}`);
  const title = String(options.title || "PitWall reminder");
  const body = String(options.body || "An F1 session is coming up.");
  const at = Date.parse(options.at || "");
  const delay = Number.isFinite(at) ? Math.max(0, at - Date.now()) : 0;
  const maxDelay = 1000 * 60 * 60 * 24 * 30;
  const safeDelay = Math.min(delay, maxDelay);
  if (reminderTimers.has(id)) clearTimeout(reminderTimers.get(id));
  const timer = setTimeout(() => {
    reminderTimers.delete(id);
    new Notification({ title, body }).show();
  }, safeDelay);
  reminderTimers.set(id, timer);
  return {
    scheduled: true,
    id,
    at: Number.isFinite(at) ? new Date(at).toISOString() : new Date(Date.now() + safeDelay).toISOString(),
    capped: safeDelay !== delay,
  };
}

ipcMain.handle("pitwall:f1tv:status", () => getF1TvStatus());
ipcMain.handle("pitwall:f1tv:probeStatus", (_event, options = {}) => probeF1TvStoredAuth(options));
ipcMain.handle("pitwall:f1tv:login", openF1TvLogin);
ipcMain.handle("pitwall:f1tv:browse", openF1TvBrowser);
ipcMain.handle("pitwall:f1tv:browseSession", openF1TvSessionBrowser);
ipcMain.handle("pitwall:f1tv:library", (_event, options = {}) => getF1TvLibrary(options));
ipcMain.handle("pitwall:f1tv:streams", () => capturedF1TvStreams.slice());
ipcMain.handle("pitwall:f1tv:resolveContent", resolveF1TvContent);
ipcMain.handle("pitwall:f1tv:mediaFetch", fetchF1TvMedia);
ipcMain.handle("pitwall:f1tv:cdm", () => ({
  configured: Boolean(configuredWidevineCdm || hasElectronComponentsWidevine),
  version: configuredWidevineCdm?.version || "",
  path: configuredWidevineCdm?.libraryPath || "",
  source: configuredWidevineCdm?.source || (hasElectronComponentsWidevine ? "Electron components" : ""),
  components: electronComponentsStatus,
}));
ipcMain.handle("pitwall:debug:log", (_event, area, payload = {}) => writePitWallDebugLog(area, payload));
ipcMain.handle("pitwall:debug:path", () => debugLogPath());
ipcMain.handle("pitwall:f1tv:logout", async () => {
  await clearF1TvCookies();
  await deleteSecret("f1tv-email");
  await deleteSecret("f1tv-token");
  capturedF1TvStreams.length = 0;
  return getF1TvStatus();
});
ipcMain.handle("pitwall:data:snapshot", () => getPitWallSnapshot());
ipcMain.handle("pitwall:data:liveTiming", (_event, options = {}) => getLiveTimingSnapshot(options));
ipcMain.handle("pitwall:data:replayTiming", (_event, options = {}) => getReplayTimingSnapshot(options));
ipcMain.handle("pitwall:ai:authStatus", () => getAiAuthStatus());
ipcMain.handle("pitwall:ai:authStart", (_event, provider) => startAiOAuth(provider));
ipcMain.handle("pitwall:ai:authDisconnect", (_event, provider) => disconnectAiOAuth(provider));
ipcMain.handle("pitwall:ai:ask", (_event, options = {}) => askConfiguredAi(options));
ipcMain.handle("pitwall:analytics:library", (_event, options = {}) => getF1TvLibrary(options));
ipcMain.handle("pitwall:analytics:session", (_event, options = {}) => getAnalyticsSession(options));
ipcMain.handle("pitwall:history:query", (_event, options = {}) => queryHistory(options));
ipcMain.handle("pitwall:notify:schedule", (_event, options = {}) => scheduleReminder(options));

async function createWindow() {
  const root = path.resolve(app.getAppPath());
  const { server, url } = await startStaticServer(root);
  staticServer = server;
  const rendererEntry = fs.existsSync(path.join(root, "dist/pitwall/index.html"))
    ? "dist/pitwall/index.html"
    : "ui_kits/pitwall/index.html";

  const win = new BrowserWindow({
    width: 1360,
    height: 900,
    minWidth: 1120,
    minHeight: 720,
    backgroundColor: "#07090d",
    title: "PitWall",
    titleBarStyle: "hiddenInset",
    trafficLightPosition: { x: 16, y: 16 },
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webviewTag: false,
      preload: path.join(root, "electron/preload.cjs"),
    },
  });

  win.webContents.on("will-attach-webview", (event, webPreferences, params) => {
    if (!isF1TvUrl(params.src || "")) {
      event.preventDefault();
      return;
    }
    delete webPreferences.preload;
    webPreferences.nodeIntegration = false;
    webPreferences.contextIsolation = true;
    webPreferences.sandbox = true;
    webPreferences.webSecurity = true;
    webPreferences.allowRunningInsecureContent = false;
  });

  win.webContents.setWindowOpenHandler(({ url: targetUrl }) => {
    shell.openExternal(targetUrl);
    return { action: "deny" };
  });

  win.webContents.on("will-navigate", (event, targetUrl) => {
    const local = targetUrl.startsWith(url);
    const designFile = targetUrl === pathToFileURL(path.join(root, "ui_kits/pitwall/index.html")).href;
    if (!local && !designFile) {
      event.preventDefault();
      shell.openExternal(targetUrl);
    }
  });

  const startScreen = String(process.env.PITWALL_START_SCREEN || "").toLowerCase().replace(/[^a-z]/g, "");
  const allowedStartScreens = new Set(["dashboard", "weekend", "live", "leaderboards", "schedule", "news", "analytics", "copilot", "settings"]);
  const params = new URLSearchParams();
  if (allowedStartScreens.has(startScreen)) params.set("screen", startScreen);
  if (process.env.PITWALL_F1TV_AUTOPLAY) params.set("autoF1Tv", "1");
  for (const [envKey, queryKey] of [
    ["PITWALL_WEEKEND_ROUND", "weekendRound"],
    ["PITWALL_WEEKEND_SESSION", "weekendSession"],
    ["PITWALL_F1TV_AUTOPLAY_SEASON", "f1Season"],
    ["PITWALL_F1TV_AUTOPLAY_RACE", "f1Race"],
    ["PITWALL_F1TV_AUTOPLAY_SESSION", "f1Session"],
    ["PITWALL_F1TV_AUTOPLAY_MEETING_KEY", "f1MeetingKey"],
    ["PITWALL_F1TV_AUTOPLAY_DETAIL_URL", "f1DetailUrl"],
  ]) {
    const value = String(process.env[envKey] || "").trim();
    if (value) params.set(queryKey, value);
  }
  const query = params.toString() ? `?${params.toString()}` : "";
  await win.loadURL(`${url}/${rendererEntry}${query}`);
}

app.whenReady().then(async () => {
  await ensureElectronComponentsReady();
  installF1TvPlaybackPermissions();
  installF1TvStreamCapture();
  if (await runF1TvProbeDiagnosticAndQuit()) return null;
  if (await runF1TvLibraryDiagnosticAndQuit()) return null;
  if (await runAnalyticsSessionDiagnosticAndQuit()) return null;
  if (await runWeekendRecapDiagnosticAndQuit()) return null;
  if (await runF1TvDiagnosticAndQuit()) return null;
  return createWindow();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

app.on("window-all-closed", () => {
  if (diagnosticWindowRunActive) return;
  if (staticServer) {
    staticServer.close();
    staticServer = null;
  }
  if (process.platform !== "darwin") {
    app.quit();
  }
});
