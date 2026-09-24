const { app, BrowserWindow, Menu, ipcMain, shell, session, Notification, components } = require("electron");
const { execFile, spawn } = require("node:child_process");
const { createHash, randomBytes } = require("node:crypto");
const fs = require("node:fs");
const http = require("node:http");
const https = require("node:https");
const os = require("node:os");
const path = require("node:path");
const tls = require("node:tls");
const { pathToFileURL } = require("node:url");
const vm = require("node:vm");
const zlib = require("node:zlib");
const sharedAuth = require("@neelsatyavolu/shared-ai-auth");

let appPackage = {};
try {
  appPackage = require("../package.json");
} catch {}

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
app.setName("Apexline");
const PITWALL_USER_DATA = path.join(app.getPath("appData"), "Apexline");
const LEGACY_PITWALL_USER_DATA = path.join(app.getPath("appData"), "PitWall");
if (!fs.existsSync(PITWALL_USER_DATA) && fs.existsSync(LEGACY_PITWALL_USER_DATA)) {
  try {
    fs.cpSync(LEGACY_PITWALL_USER_DATA, PITWALL_USER_DATA, { recursive: true });
  } catch {}
}
app.setPath("userData", PITWALL_USER_DATA);

const KEYCHAIN_SERVICE = "Apexline";
const LEGACY_KEYCHAIN_SERVICE = "PitWall";
const KEY_PROVIDERS = new Set(["codex", "grok", "f1tv-email", "f1tv-token"]);
const VIDEO_QUALITY_LEVELS = new Set(["max", "high", "medium", "low"]);
const DEFAULT_USER_PROFILE = { name: "", profileImageUrl: "", favoriteDrivers: [], favoriteTeams: [], livePanelSizes: null, liveCustomLayouts: null, videoQuality: "" };
const PROFILE_FILE = "pitwall-profile.json";
const PROFILE_IMAGE_FILE = "pitwall-profile-image.txt";
const AI_PREFERENCES_FILE = "pitwall-ai-preferences.json";
const SOCIAL_FILE = "apexline-social.json";
const COPILOT_INSIGHTS_FILE = "pitwall-copilot-insights.json";
const COPILOT_INSIGHTS_SCHEMA_VERSION = 13;
const DEBUG_LOG_FILE = "pitwall-debug.log";
const ANALYTICS_SESSION_CACHE_FILE = "pitwall-analytics-session-cache.json";
const F1TV_LIBRARY_CACHE_FILE = "pitwall-f1tv-library-cache.json";
const LIVE_SNAPSHOT_CACHE_FILE = "pitwall-live-snapshot-cache.json";
const F1TV_LIBRARY_CACHE_VERSION = 6;
const LIVE_SNAPSHOT_CACHE_VERSION = 4;
const PITWALL_UPDATE_BASE_URL = String(process.env.APEXLINE_UPDATE_BASE_URL || process.env.PITWALL_UPDATE_BASE_URL || appPackage.apexline?.updateBaseUrl || appPackage.pitwall?.updateBaseUrl || "").replace(/\/+$/, "");
const SOCIAL_API_BASE_URL = String(process.env.APEXLINE_SOCIAL_API_BASE_URL || PITWALL_UPDATE_BASE_URL || "https://apexline.io").replace(/\/+$/, "");
const F1TV_HOME_URL = "https://f1tv.formula1.com/";
const F1TV_LOGIN_URL = "https://account.formula1.com/#/en/login?redirect=https%3A%2F%2Ff1tv.formula1.com%2F";
const F1TV_AUTH_URL = "https://api.formula1.com/v2/account/subscriber/authenticate/by-password";
const F1TV_AUTH_API_KEY = "fCUCjWrKPu9ylJwRAv8BpGLEgiAuThx7";
const F1TV_HOSTS = new Set(["f1tv.formula1.com", "account.formula1.com", "formula1.com", "www.formula1.com"]);
const F1TV_LOGIN_TOKEN_GRACE_MS = 12000;
const F1TV_LOGIN_AUTOMATION_TIMEOUT_MS = 45000;
const F1TV_SEASON_PAGE_IDS = {
  "2022": "4319",
  "2023": "6603",
  "2024": "8192",
  "2025": "10295",
  "2026": "12343",
};
const F1TV_CMS_FORMAT = "WEB_DASH";
const F1TV_CMS_ENTITLEMENT = "PREMIUM";
const F1TV_CMS_GROUP_ID = "2";
const F1TV_CMS_DETAIL_PAGE_LIMIT = 32;
const F1TV_CMS_DETAIL_TIMEOUT_MS = 3000;
const F1TV_CMS_DETAIL_CONCURRENCY = 4;
const F1TV_CMS_DETAIL_DEADLINE_MS = 12000;
const F1TV_MEDIA_CDN_HOSTS = new Set(["f1prodlive.akamaized.net"]);
const NEWS_ARTICLE_CACHE_MS = 1000 * 60 * 15;
const NEWS_ARTICLE_CACHE_LIMIT = 128;
const NEWS_ARTICLE_CONCURRENCY = 4;
const REPLAY_CAR_DATA_CHUNK_MS = 1000 * 120;
const REPLAY_CAR_DATA_CACHE_MS = 1000 * 60 * 5;
const REPLAY_CAR_DATA_CACHE_LIMIT = 24;
const ELECTRON_COMPONENTS_READY_TIMEOUT_MS = 5000;
const MAX_BUFFERED_MEDIA_BYTES = 64 * 1024 * 1024;
const DATA_CACHE_MS = 1000 * 60 * 3;
const COPILOT_INSIGHT_RETRY_MS = 1000 * 60 * 10;
const AI_PROVIDER_TIMEOUT_MS = 90000;
const CODEX_REDIRECT_URI = sharedAuth.providers.codex.redirectUri;
const CODEX_BACKEND_RESPONSES_URL = "https://chatgpt.com/backend-api/codex/responses";
const GROK_REDIRECT_URI = sharedAuth.providers.grok.redirectUri;
const GROK_CHAT_COMPLETIONS_URL = "https://api.x.ai/v1/chat/completions";
const DEFAULT_CODEX_MODEL = "gpt-6-sol";
const DEFAULT_GROK_MODEL = "grok-4.6";
const HIDDEN_MODELS = { codex: [], grok: [] };
let modelCatalog = sharedAuth.bundledModels;
let modelRefreshAt = 0;
async function visibleAiModels(provider) {
  if (Date.now() >= modelRefreshAt) {
    modelCatalog = await sharedAuth.loadModels({ fallback: modelCatalog });
    modelRefreshAt = Date.now() + 5 * 60_000;
  }
  return sharedAuth.selectModels(modelCatalog, provider, HIDDEN_MODELS[provider]);
}
const MAX_CAPTURED_STREAMS = 48;
const NEWS_SOURCES = [
  {
    key: "motorsportNews",
    name: "Motorsport.com",
    url: "https://www.motorsport.com/rss/f1/news/",
    type: "rss",
    articlePath: /\/f1\/news\//i,
  },
  {
    key: "formula1News",
    name: "Formula 1",
    url: "https://www.formula1.com/en/latest/all.xml",
    type: "rss",
    articlePath: /\/en\/latest\/article\//i,
  },
  {
    key: "theRaceNews",
    name: "The Race",
    url: "https://www.the-race.com/rss/",
    type: "rss",
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
const JOLPICA_ERGAST_BASE_URL = "https://api.jolpi.ca/ergast/f1";
const LIVE_CORE_DATA_URLS = {
  openF1DriverStandings: "https://api.openf1.org/v1/championship_drivers?session_key=latest",
  openF1ConstructorStandings: "https://api.openf1.org/v1/championship_teams?session_key=latest",
  openF1Meetings: `https://api.openf1.org/v1/meetings?year=${new Date().getFullYear()}`,
  openF1Sessions: `https://api.openf1.org/v1/sessions?year=${new Date().getFullYear()}`,
  openF1Weather: "https://api.openf1.org/v1/weather?session_key=latest",
};
const LIVE_TIMING_ENRICHMENT_URLS = {
  openF1Drivers: "https://api.openf1.org/v1/drivers?session_key=latest",
  openF1Intervals: "https://api.openf1.org/v1/intervals?session_key=latest",
  openF1Laps: "https://api.openf1.org/v1/laps?session_key=latest",
  openF1Pit: "https://api.openf1.org/v1/pit?session_key=latest",
  openF1Position: "https://api.openf1.org/v1/position?session_key=latest",
  openF1Stints: "https://api.openf1.org/v1/stints?session_key=latest",
};
const LIVE_BACKGROUND_ENRICHMENT_URLS = {
  ...LIVE_TIMING_ENRICHMENT_URLS,
  ...LIVE_NEWS_URLS,
};
const LIVE_DATA_URLS = { ...LIVE_CORE_DATA_URLS, ...LIVE_BACKGROUND_ENRICHMENT_URLS };
const OPTIONAL_LIVE_DATA_KEYS = new Set(["openF1CarData", "openF1Laps", "openF1Pit", "openF1Stints"]);
const COPILOT_INSIGHT_PAGES = [
  { id: "drivers-championship", title: "Drivers championship", kicker: "Overall standings" },
  { id: "constructors-championship", title: "Constructors championship", kicker: "Team standings" },
  { id: "current-weekend", title: "Current race weekend", kicker: "Loaded weekend context" },
  { id: "next-weekend", title: "Next race weekend", kicker: "Forward look" },
];
const COPILOT_WEEKEND_SESSION_KINDS = ["Practice 1", "Practice 2", "Practice 3", "Sprint Shootout", "Sprint", "Qualifying", "Race"];
let liveDataCache = null;
const liveDataEnrichmentRefreshes = new Map();
let liveDataRefresh = null;
let copilotInsightRefresh = null;
const ANALYTICS_CACHE_MS = 1000 * 60 * 5;
const ANALYTICS_DISK_CACHE_MS = 1000 * 60 * 30;
const ANALYTICS_REVALIDATE_MS = ANALYTICS_CACHE_MS;
const F1TV_LIBRARY_CACHE_MS = 1000 * 60;
const RECENT_DRIVER_RESULTS_CACHE_MS = 1000 * 60 * 30;
const RACE_WINNER_CACHE_MS = 1000 * 60 * 30;
const OPENF1_ANALYTICS_RETRY_MS = 750;
const OPENF1_TOKEN_URL = "https://api.openf1.org/token";
const OPENF1_PROXY_BASE_URL = `${SOCIAL_API_BASE_URL}/api/openf1`;
const OPENF1_REQUEST_INTERVAL_MS = 1000;
const OPENF1_MAX_CONCURRENT_REQUESTS = 3;
const OPENF1_SECOND_LIMIT = 6;
const OPENF1_MINUTE_LIMIT = 60;
const OPENF1_SECOND_WINDOW_MS = 1000;
const OPENF1_MINUTE_WINDOW_MS = 60000;
const OPENF1_TOKEN_REFRESH_MARGIN_MS = 1000 * 60;
const F1_TIMING_BASE_URL = "https://livetiming.formula1.com";
const F1_TIMING_SIGNALR_URL = "wss://livetiming.formula1.com/signalrcore";
const F1_TIMING_NEGOTIATE_URL = "https://livetiming.formula1.com/signalrcore/negotiate";
const F1_TIMING_LIVE_STALE_MS = 1000 * 25;
const F1_TIMING_LIVE_CONNECT_RETRY_MS = 8000;
const F1_TIMING_LIVE_CLOSE_RETRY_MS = 5000;
const F1_TIMING_SIGNALR_TOPICS = [
  "Heartbeat", "AudioStreams", "DriverList", "ExtrapolatedClock",
  "RaceControlMessages", "SessionInfo", "SessionStatus", "TeamRadio",
  "TimingAppData", "TimingStats", "TrackStatus", "WeatherData",
  "Position.z", "CarData.z", "Position", "CarData", "ContentStreams", "SessionData",
  "TimingData", "TopThree", "RcmSeries", "LapCount",
];
const OPENF1_ANALYTICS_ENDPOINTS = {
  drivers: "https://api.openf1.org/v1/drivers",
  laps: "https://api.openf1.org/v1/laps",
  overtakes: "https://api.openf1.org/v1/overtakes",
  pit: "https://api.openf1.org/v1/pit",
  position: "https://api.openf1.org/v1/position",
  sessions: "https://api.openf1.org/v1/sessions",
  sessionResult: "https://api.openf1.org/v1/session_result",
  stints: "https://api.openf1.org/v1/stints",
  weather: "https://api.openf1.org/v1/weather",
};
let analyticsSessionCache = new Map();
let analyticsRefreshInFlight = new Map();
let recentDriverResultsCache = new Map();
let raceWinnerCache = new Map();
let f1TvLibraryCache = new Map();
const f1TvLibraryRefreshes = new Map();
let newsArticleEnrichmentCache = new Map();
let replayTimingCache = new Map();
let replayOpenF1Cache = new Map();
let replayCarDataChunkCache = new Map();
let replayF1TimingCache = new Map();
let replayTimingAvailabilityCache = new Map();
let trackMapReplaySessionCache = new Map();
let trackMapReplayTimingCache = new Map();
let trackMapReplayStreamCache = new Map();
const f1TimingTelemetrySampleCache = new WeakMap();
const f1TimingPositionSampleCache = new WeakMap();
const f1TimingStateCursorCache = new WeakMap();
const replayRowTimelineCache = new WeakMap();
const f1TimingTrackMapInvariantCache = new WeakMap();
let liveTimingCache = null;
let f1LiveTimingClient = null;
let f1LiveTimingState = null;
let f1TvStreamCaptureInstalled = false;
let f1TvPlaybackPermissionsInstalled = false;
const capturedF1TvStreams = [];
let activeF1TvResolverCapture = null;
const pendingF1TvRequestHeaders = new Map();
const reminderTimers = new Map();

async function mapWithConcurrencyStable(items, concurrency, mapper) {
  const values = Array.from(items || []);
  if (!values.length) return [];
  const results = new Array(values.length);
  let nextIndex = 0;
  const workerCount = Math.max(1, Math.min(values.length, Math.floor(Number(concurrency) || 1)));
  await Promise.all(Array.from({ length: workerCount }, async () => {
    while (nextIndex < values.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await mapper(values[index], index);
    }
  }));
  return results;
}

async function mapWithConcurrencyStableDeadline(
  items,
  concurrency,
  deadlineMs,
  mapper,
  now = Date.now,
  schedule = setTimeout,
  cancel = clearTimeout,
) {
  const values = Array.from(items || []);
  if (!values.length) return [];
  const results = new Array(values.length);
  const generation = { active: true };
  let nextIndex = 0;
  const workerCount = Math.max(1, Math.min(values.length, Math.floor(Number(concurrency) || 1)));
  const workers = Array.from({ length: workerCount }, async () => {
    while (generation.active && nextIndex < values.length) {
      const startedAt = now();
      if (!Number.isFinite(startedAt) || startedAt >= deadlineMs) return;
      const index = nextIndex;
      nextIndex += 1;
      const remainingMs = Math.max(0, deadlineMs - startedAt);
      if (!remainingMs) return;
      try {
        const value = await mapper(values[index], index, remainingMs);
        if (!generation.active || now() >= deadlineMs) return;
        results[index] = { completed: true, value };
      } catch {
        if (!generation.active || now() >= deadlineMs) return;
      }
    }
  });
  const workerPool = Promise.allSettled(workers);
  const delayMs = Math.max(0, deadlineMs - now());
  let deadlineTimer;
  const deadline = new Promise((resolve) => {
    deadlineTimer = schedule(() => {
      generation.active = false;
      resolve("deadline");
    }, delayMs);
  });
  const outcome = await Promise.race([
    workerPool.then(() => "complete"),
    deadline,
  ]);
  generation.active = false;
  if (outcome === "complete") cancel(deadlineTimer);
  return results.filter((result) => result?.completed).map((result) => result.value);
}

function getOrCreateInFlightRefresh(refreshes, key, refresh) {
  const existing = refreshes.get(key);
  if (existing) return existing;
  let started;
  try {
    started = Promise.resolve(refresh());
  } catch (error) {
    started = Promise.reject(error);
  }
  let tracked;
  tracked = started.finally(() => {
    if (refreshes.get(key) === tracked) refreshes.delete(key);
  });
  refreshes.set(key, tracked);
  return tracked;
}

function pruneBoundedMap(map, limit) {
  const maximum = Math.max(0, Number(limit) || 0);
  while (map.size > maximum) map.delete(map.keys().next().value);
  return map;
}

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
let electronComponentsReadyGeneration = 0;
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

function execFilePromise(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    execFile(command, args, { timeout: 120000, ...options }, (error, stdout, stderr) => {
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
    if (error.code !== 44) throw error;
  }
  try {
    const legacy = (await runSecurity(["find-generic-password", "-s", LEGACY_KEYCHAIN_SERVICE, "-a", provider, "-w"])).trim();
    if (legacy) await runSecurity(["add-generic-password", "-U", "-s", KEYCHAIN_SERVICE, "-a", provider, "-w", legacy]);
    return legacy;
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
  try {
    await runSecurity(["delete-generic-password", "-s", LEGACY_KEYCHAIN_SERVICE, "-a", provider]);
  } catch (error) {
    if (error.code !== 44) throw error;
  }
  return true;
}

function clampProfilePanelSize(value, min, max) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return min;
  return Math.max(min, Math.min(max, Math.round(numeric)));
}

function clampProfilePanelPct(value, min, max) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 50;
  return Math.max(min, Math.min(max, Math.round(numeric * 10) / 10));
}

function normalizeLivePanelSizes(saved) {
  if (!saved || typeof saved !== "object") return null;
  return {
    timingWidth: clampProfilePanelSize(saved.timingWidth || 340, 260, 560),
    insightsHeight: clampProfilePanelSize(saved.insightsHeight || 280, 180, 460),
    focusOnboardHeight: clampProfilePanelSize(saved.focusOnboardHeight || 220, 150, 380),
    battleSplit: clampProfilePanelPct(saved.battleSplit || 50, 28, 72),
    quadCol: clampProfilePanelPct(saved.quadCol || 50, 28, 72),
    quadRow: clampProfilePanelPct(saved.quadRow || 50, 28, 72),
    dataColA: clampProfilePanelPct(saved.dataColA || 33, 20, 60),
    dataColB: clampProfilePanelPct(saved.dataColB || 33, 18, 60),
    dataRow: clampProfilePanelPct(saved.dataRow || 50, 28, 72),
  };
}

function normalizeProfileImageUrl(value) {
  const text = String(value || "").trim();
  if (!text) return "";
  if (text.length > 3 * 1024 * 1024) return "";
  if (/^(https?:|file:)/i.test(text)) return text;
  if (/^data:image\/(?:png|jpe?g|gif|webp|svg\+xml);base64,/i.test(text)) return text;
  return /^[./][^<>"]+\.(?:png|jpe?g|gif|webp|svg)(?:[?#].*)?$/i.test(text) ? text : "";
}

function normalizeVideoQuality(value) {
  const text = String(value || "").trim().toLowerCase();
  return VIDEO_QUALITY_LEVELS.has(text) ? text : "";
}

function normalizeProfileCustomTileSource(raw = {}) {
  if (!raw || typeof raw !== "object") return null;
  if (raw.type === "timing") return { type: "timing" };
  if (raw.type === "onboard" && typeof raw.code === "string" && raw.code) return { type: "onboard", code: raw.code.slice(0, 16) };
  if (raw.type === "channel" && typeof raw.feedId === "string" && raw.feedId) return { type: "channel", feedId: raw.feedId.slice(0, 80) };
  return null;
}

function profileCustomTileSourceKey(source) {
  if (!source) return "";
  if (source.type === "timing") return "timing";
  if (source.type === "onboard") return "onboard:" + source.code;
  if (source.type === "channel") return "channel:" + source.feedId;
  return "";
}

function clampProfileCustomTileGeometry(rect = {}) {
  const numeric = (value, fallback) => (Number.isFinite(Number(value)) ? Number(value) : fallback);
  const round = (value) => Math.round(value * 10) / 10;
  const w = round(Math.min(100, Math.max(12, numeric(rect.w, 32))));
  const h = round(Math.min(100, Math.max(12, numeric(rect.h, 32))));
  const x = round(Math.min(100 - w, Math.max(0, numeric(rect.x, 0))));
  const y = round(Math.min(100 - h, Math.max(0, numeric(rect.y, 0))));
  return { x, y, w, h };
}

function normalizeProfileCustomLayouts(raw) {
  if (!raw || typeof raw !== "object") return null;
  const seenLayoutIds = new Set();
  const layouts = (Array.isArray(raw.layouts) ? raw.layouts : [])
    .filter((layout) => layout && typeof layout === "object" && typeof layout.id === "string" && layout.id)
    .filter((layout) => (seenLayoutIds.has(layout.id) ? false : (seenLayoutIds.add(layout.id), true)))
    .slice(0, 24)
    .map((layout) => {
      const seenSources = new Set();
      const tiles = (Array.isArray(layout.tiles) ? layout.tiles : [])
        .slice(0, 64)
        .map((tile) => {
          const source = normalizeProfileCustomTileSource(tile?.source);
          const sourceKey = profileCustomTileSourceKey(source);
          if (!source || seenSources.has(sourceKey)) return null;
          seenSources.add(sourceKey);
          return {
            id: typeof tile.id === "string" && tile.id ? tile.id.slice(0, 80) : "t-" + sourceKey,
            source,
            ...clampProfileCustomTileGeometry(tile),
            tickerRows: clampProfilePanelSize(tile.tickerRows || 0, 0, 4),
            tickerHeight: clampProfilePanelSize(tile.tickerHeight || 140, 64, 320),
            ...(tile.lockAspect === true ? { lockAspect: true } : {}),
          };
        })
        .filter(Boolean);
      return {
        id: layout.id.slice(0, 80),
        name: String(layout.name || "").trim().slice(0, 80) || "Custom layout",
        tiles,
      };
    });
  return { layouts };
}

function normalizeUserProfile(profile = {}) {
  return {
    name: String(profile.name || "").slice(0, 80),
    profileImageUrl: normalizeProfileImageUrl(profile.profileImageUrl),
    favoriteDrivers: Array.isArray(profile.favoriteDrivers) ? profile.favoriteDrivers.map(String).slice(0, 8) : [],
    favoriteTeams: Array.isArray(profile.favoriteTeams) ? profile.favoriteTeams.map(String).slice(0, 8) : [],
    livePanelSizes: normalizeLivePanelSizes(profile.livePanelSizes),
    liveCustomLayouts: normalizeProfileCustomLayouts(profile.liveCustomLayouts),
    videoQuality: normalizeVideoQuality(profile.videoQuality),
  };
}

function profileFilePath() {
  return path.join(app.getPath("userData"), PROFILE_FILE);
}

function profileImageFilePath() {
  return path.join(app.getPath("userData"), PROFILE_IMAGE_FILE);
}

function aiPreferencesFilePath() {
  return path.join(app.getPath("userData"), AI_PREFERENCES_FILE);
}

function socialFilePath() {
  return path.join(app.getPath("userData"), SOCIAL_FILE);
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

function settleWithTimeout(promise, timeoutMs, schedule = setTimeout, cancel = clearTimeout) {
  return new Promise((resolve) => {
    let settled = false;
    const timer = schedule(() => {
      if (settled) return;
      settled = true;
      resolve({ ok: false, timedOut: true });
    }, timeoutMs);
    Promise.resolve(promise).then(
      (value) => {
        if (settled) return;
        settled = true;
        cancel(timer);
        resolve({ ok: true, value });
      },
      (error) => {
        if (settled) return;
        settled = true;
        cancel(timer);
        resolve({ ok: false, error });
      },
    );
  });
}

async function ensureElectronComponentsReady() {
  if (!components?.whenReady) return { ok: true, unavailable: true };
  const generation = ++electronComponentsReadyGeneration;
  let readyPromise;
  try {
    readyPromise = components.whenReady();
  } catch (error) {
    electronComponentsStatus = { degraded: true, error: error?.message || "Electron components failed to initialize." };
    writePitWallDebugLog("electron.components-error", electronComponentsStatus);
    return { ok: false, error };
  }
  const readiness = await settleWithTimeout(
    readyPromise,
    ELECTRON_COMPONENTS_READY_TIMEOUT_MS,
  );
  if (readiness.ok) {
    electronComponentsStatus = components.status?.() || null;
    writePitWallDebugLog("electron.components-ready", {
      available: true,
      status: electronComponentsStatus,
    });
    return readiness;
  }
  if (readiness.timedOut) {
    electronComponentsStatus = { degraded: true, timedOut: true, error: "Electron components did not initialize within 5 seconds." };
    writePitWallDebugLog("electron.components-timeout", electronComponentsStatus);
    Promise.resolve(readyPromise).then(
      () => {
        if (generation !== electronComponentsReadyGeneration) return;
        electronComponentsStatus = components.status?.() || null;
        writePitWallDebugLog("electron.components-late-ready", {
          available: true,
          status: electronComponentsStatus,
        });
      },
      () => {},
    );
    return readiness;
  }
  const error = readiness.error;
  electronComponentsStatus = { degraded: true, error: error?.message || "Electron components failed to initialize." };
  writePitWallDebugLog("electron.components-error", electronComponentsStatus);
  return readiness;
}

function profileTempPath(filePath, label) {
  return `${filePath}.${process.pid}-${Date.now()}-${Math.random().toString(16).slice(2)}.${label}.tmp`;
}

async function readProfileFileSnapshot(filePath) {
  try {
    return { exists: true, data: await fs.promises.readFile(filePath) };
  } catch (error) {
    if (error?.code === "ENOENT") return { exists: false, data: null };
    throw error;
  }
}

async function restoreProfileFileSnapshot(filePath, snapshot) {
  if (!snapshot.exists) {
    await fs.promises.unlink(filePath).catch((error) => {
      if (error?.code !== "ENOENT") throw error;
    });
    return;
  }
  const tempPath = profileTempPath(filePath, "restore");
  try {
    await fs.promises.writeFile(tempPath, snapshot.data);
    await fs.promises.rename(tempPath, filePath);
  } finally {
    await fs.promises.unlink(tempPath).catch(() => {});
  }
}

async function readProfileFiles(filePath, imagePath) {
  const profileSnapshot = await readProfileFileSnapshot(filePath);
  const stored = profileSnapshot.exists ? JSON.parse(profileSnapshot.data.toString("utf8")) : {};
  const imageSnapshot = await readProfileFileSnapshot(imagePath);
  return {
    ...stored,
    profileImageUrl: imageSnapshot.exists
      ? imageSnapshot.data.toString("utf8")
      : String(stored.profileImageUrl || ""),
  };
}

async function writeProfileFiles(filePath, imagePath, profile, options = {}) {
  const writeImage = options.writeImage !== false;
  const ordinaryProfile = { ...profile };
  const profileImageUrl = String(ordinaryProfile.profileImageUrl || "");
  delete ordinaryProfile.profileImageUrl;
  await fs.promises.mkdir(path.dirname(filePath), { recursive: true });

  const oldProfile = await readProfileFileSnapshot(filePath);
  const oldImage = writeImage ? await readProfileFileSnapshot(imagePath) : { exists: false, data: null };
  const profileTemp = profileTempPath(filePath, "profile");
  const imageTemp = profileTempPath(imagePath, "image");
  let profileReplaced = false;
  let imageReplaced = false;
  try {
    await fs.promises.writeFile(profileTemp, JSON.stringify(ordinaryProfile, null, 2), "utf8");
    if (writeImage) {
      await fs.promises.writeFile(imageTemp, profileImageUrl, "utf8");
      await fs.promises.rename(imageTemp, imagePath);
      imageReplaced = true;
    }
    await fs.promises.rename(profileTemp, filePath);
    profileReplaced = true;
    if (writeImage && !profileImageUrl) {
      await fs.promises.unlink(imagePath);
      imageReplaced = false;
    }
  } catch (error) {
    const restores = [];
    if (profileReplaced) restores.push(restoreProfileFileSnapshot(filePath, oldProfile));
    if (writeImage && (imageReplaced || (!profileImageUrl && oldImage.exists))) restores.push(restoreProfileFileSnapshot(imagePath, oldImage));
    await Promise.allSettled(restores);
    throw error;
  } finally {
    await Promise.allSettled([
      fs.promises.unlink(profileTemp),
      fs.promises.unlink(imageTemp),
    ]);
  }
}

async function getUserProfile() {
  try {
    const stored = await readProfileFiles(profileFilePath(), profileImageFilePath());
    return normalizeUserProfile({ ...DEFAULT_USER_PROFILE, ...stored });
  } catch {
    return { ...DEFAULT_USER_PROFILE };
  }
}

function createSerialMutationQueue() {
  let tail = Promise.resolve();
  return function enqueue(mutation) {
    const result = tail.then(() => mutation());
    tail = result.catch(() => {});
    return result;
  };
}

const enqueueUserProfileMutation = createSerialMutationQueue();

function profilePatchIncludesImage(patch) {
  return Boolean(patch && Object.prototype.hasOwnProperty.call(patch, "profileImageUrl"));
}

function shouldWriteProfileImage(patch, current, separateImageExists) {
  return profilePatchIncludesImage(patch)
    || Boolean(current?.profileImageUrl && !separateImageExists);
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
    if (/inactive|expired|subscription|entitlement|rights/i.test(String(status || ""))) {
      throw new Error(`F1 TV subscription is not active: ${status}`);
    }
    throw new Error(`F1 TV did not return a playback token: ${status}`);
  }
  await setSecret("f1tv-email", login);
  await setSecret("f1tv-token", subscriptionToken);
  return subscriptionToken;
}

async function setUserProfile(profile) {
  return enqueueUserProfileMutation(async () => {
    const patch = profile && typeof profile === "object" && !Array.isArray(profile) ? profile : {};
    const current = await getUserProfile();
    const separateImage = await readProfileFileSnapshot(profileImageFilePath());
    const writeImage = shouldWriteProfileImage(patch, current, separateImage.exists);
    const next = normalizeUserProfile({ ...DEFAULT_USER_PROFILE, ...current, ...patch });
    await writeProfileFiles(profileFilePath(), profileImageFilePath(), next, { writeImage });
    return next;
  });
}

function normalizePreferredAiModel(value) {
  let text = String(value || "").trim();
  if (text === "grok:grok-4.5") text = "grok:grok-4.6";
  if (/^codex:gpt-5\.(?:5|6)(?:-|$)/.test(text)) text = `codex:${DEFAULT_CODEX_MODEL}`;
  if (text === "local") return "local";
  const [provider, ...modelParts] = text.split(":");
  const model = modelParts.join(":");
  if ((provider === "codex" || provider === "grok") &&
      knownModel(model, sharedAuth.selectModels(modelCatalog, provider, HIDDEN_MODELS[provider]), "") === model) return text;
  return "";
}

async function getPreferredAiModel() {
  try {
    const raw = await fs.promises.readFile(aiPreferencesFilePath(), "utf8");
    return normalizePreferredAiModel(JSON.parse(raw)?.preferredModel);
  } catch {
    return "";
  }
}

async function setPreferredAiModel(value) {
  const preferredModel = normalizePreferredAiModel(value);
  const filePath = aiPreferencesFilePath();
  await fs.promises.mkdir(path.dirname(filePath), { recursive: true });
  await fs.promises.writeFile(filePath, JSON.stringify({ preferredModel }, null, 2), "utf8");
  return { preferredModel };
}

function sanitizeSocialText(value, limit = 160) {
  return String(value || "").trim().replace(/[\u0000-\u001f]+/g, " ").slice(0, limit);
}

async function readSocialIdentity() {
  try {
    const raw = await fs.promises.readFile(socialFilePath(), "utf8");
    const parsed = JSON.parse(raw);
    return {
      userId: sanitizeSocialText(parsed.userId, 100),
      userToken: sanitizeSocialText(parsed.userToken, 200),
      friendCode: sanitizeSocialText(parsed.friendCode, 24),
      displayName: sanitizeSocialText(parsed.displayName, 80),
    };
  } catch {
    return { userId: "", userToken: "", friendCode: "", displayName: "" };
  }
}

async function writeSocialIdentity(identity = {}) {
  const next = {
    userId: sanitizeSocialText(identity.userId, 100),
    userToken: sanitizeSocialText(identity.userToken, 200),
    friendCode: sanitizeSocialText(identity.friendCode, 24),
    displayName: sanitizeSocialText(identity.displayName, 80),
  };
  await fs.promises.mkdir(path.dirname(socialFilePath()), { recursive: true });
  await fs.promises.writeFile(socialFilePath(), JSON.stringify(next, null, 2), "utf8");
  return next;
}

function localSocialIdentity(profile = {}, existing = {}) {
  const userId = existing.userId || `local-${randomBytes(12).toString("hex")}`;
  const friendCode = existing.friendCode || randomBytes(4).toString("hex").toUpperCase();
  return {
    userId,
    userToken: existing.userToken || "",
    friendCode,
    displayName: sanitizeSocialText(profile.name || existing.displayName || "Apexline fan", 80) || "Apexline fan",
    offline: true,
  };
}

async function requestSocial(action, payload = {}) {
  if (!SOCIAL_API_BASE_URL) throw new Error("Apexline social backend is not configured.");
  return requestJsonPost(`${SOCIAL_API_BASE_URL}/api/social`, { action, ...payload }, {}, 12000);
}

// The social token proves ownership of userId; it stays in the main process.
async function requestSocialAsUser(action, payload = {}) {
  const identity = await readSocialIdentity();
  return requestSocial(action, { ...payload, userId: identity.userId, userToken: identity.userToken });
}

function publicSocialIdentity({ userToken, ...identity }) {
  return identity;
}

async function bootstrapSocial(_event, options = {}) {
  const existing = await readSocialIdentity();
  const profile = normalizeUserProfile(options.profile || await getUserProfile());
  try {
    const identity = await requestSocial("bootstrap", { userId: existing.userId, userToken: existing.userToken, profile });
    return publicSocialIdentity(await writeSocialIdentity({ ...identity, displayName: identity.displayName || profile.name }));
  } catch {
    return publicSocialIdentity(await writeSocialIdentity(localSocialIdentity(profile, existing)));
  }
}

async function socialFriends() {
  return requestSocialAsUser("friends");
}

async function socialRoomCreate(_event, options = {}) {
  return requestSocialAsUser("roomCreate", {
    label: sanitizeSocialText(options.label || "Watch party", 80),
    contentFingerprint: sanitizeSocialText(options.contentFingerprint, 220),
  });
}

async function socialRoomJoin(_event, options = {}) {
  return requestSocialAsUser("roomJoin", { code: sanitizeSocialText(options.code, 24) });
}

async function socialAblyToken(_event, options = {}) {
  return requestSocialAsUser("ablyToken", { roomId: sanitizeSocialText(options.roomId, 120) });
}

async function socialChatHistory(_event, options = {}) {
  return requestSocialAsUser("chatHistory", { roomId: sanitizeSocialText(options.roomId, 120) });
}

async function socialChatSave(_event, options = {}) {
  return requestSocialAsUser("saveChat", {
    roomId: sanitizeSocialText(options.roomId, 120),
    id: sanitizeSocialText(options.id, 120),
    name: sanitizeSocialText(options.name, 80),
    text: sanitizeSocialText(options.text, 500),
    sentAt: Number(options.sentAt) || Date.now(),
  });
}

async function socialAddFriend(_event, options = {}) {
  return requestSocialAsUser("addFriend", { friendCode: sanitizeSocialText(options.friendCode, 24) });
}

ipcMain.handle("pitwall:key:get", (_event, provider) => getSecret(provider));
ipcMain.handle("pitwall:key:set", (_event, provider, value) => setSecret(provider, value));
ipcMain.handle("pitwall:key:delete", (_event, provider) => deleteSecret(provider));
ipcMain.handle("pitwall:profile:get", () => getUserProfile());
ipcMain.handle("pitwall:profile:set", (_event, profile) => setUserProfile(profile));
ipcMain.handle("pitwall:ai:preferredModel:get", () => getPreferredAiModel());
ipcMain.handle("pitwall:ai:preferredModel:set", (_event, value) => setPreferredAiModel(value));
ipcMain.handle("pitwall:social:bootstrap", bootstrapSocial);
ipcMain.handle("pitwall:social:friends", socialFriends);
ipcMain.handle("pitwall:social:addFriend", socialAddFriend);
ipcMain.handle("pitwall:social:roomCreate", socialRoomCreate);
ipcMain.handle("pitwall:social:roomJoin", socialRoomJoin);
ipcMain.handle("pitwall:social:ablyToken", socialAblyToken);
ipcMain.handle("pitwall:social:chatHistory", socialChatHistory);
ipcMain.handle("pitwall:social:chatSave", socialChatSave);
ipcMain.handle("pitwall:external:open", (_event, targetUrl) => {
  const url = String(targetUrl || "");
  if (!/^https?:\/\//i.test(url)) return false;
  shell.openExternal(url);
  return true;
});
ipcMain.handle("pitwall:updates:check", () => checkPitWallUpdates());
ipcMain.handle("pitwall:updates:open", (_event, targetUrl) => {
  const url = String(targetUrl || "");
  if (!isAllowedUpdateUrl(url)) return false;
  shell.openExternal(url);
  return true;
});
ipcMain.handle("pitwall:updates:install", (_event, targetUrl) => installPitWallUpdate(targetUrl));

function requestText(targetUrl, timeout = 8500, headers = {}) {
  return new Promise((resolve, reject) => {
    const req = https.get(targetUrl, {
      headers: {
        "Accept": "application/json, application/rss+xml, application/xml, text/xml, */*",
        "User-Agent": "Apexline/1.0 (+https://github.com/neelsatyavolu/apexline)",
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

function appVersion() {
  return String(app.getVersion?.() || appPackage.version || "0.0.0");
}

function compareVersions(left, right) {
  const parse = (value) => String(value || "").replace(/^v/i, "").split(/[.+-]/).map((part) => {
    const number = Number.parseInt(part, 10);
    return Number.isFinite(number) ? number : 0;
  });
  const a = parse(left);
  const b = parse(right);
  for (let i = 0; i < Math.max(a.length, b.length, 3); i += 1) {
    const delta = (a[i] || 0) - (b[i] || 0);
    if (delta !== 0) return delta > 0 ? 1 : -1;
  }
  return 0;
}

function updateFeedUrl() {
  if (!/^https:\/\//i.test(PITWALL_UPDATE_BASE_URL)) return "";
  return `${PITWALL_UPDATE_BASE_URL}/updates/${process.platform}/${process.arch}/releases.json`;
}

function normalizeRelease(release) {
  const updateTo = release?.updateTo && typeof release.updateTo === "object" ? release.updateTo : release;
  const version = String(updateTo?.version || release?.version || "").trim();
  const url = String(updateTo?.url || release?.url || "").trim();
  if (!version || !/^https:\/\//i.test(url)) return null;
  return {
    version,
    name: String(updateTo?.name || release?.name || version),
    notes: String(updateTo?.notes || release?.notes || ""),
    pubDate: String(updateTo?.pub_date || updateTo?.pubDate || release?.pub_date || release?.pubDate || ""),
    url,
  };
}

function isAllowedUpdateUrl(targetUrl) {
  try {
    const target = new URL(targetUrl);
    const feed = new URL(PITWALL_UPDATE_BASE_URL);
    return target.protocol === "https:" && target.host === feed.host && target.pathname.startsWith("/updates/");
  } catch {
    return false;
  }
}

function currentAppBundlePath() {
  if (process.platform !== "darwin") return "";
  const marker = ".app/Contents/MacOS/";
  const index = String(process.execPath || "").indexOf(marker);
  return index === -1 ? "" : process.execPath.slice(0, index + 4);
}

function shellQuote(value) {
  return `'${String(value).replace(/'/g, "'\\''")}'`;
}

async function assertValidUpdateZip(zipPath) {
  const stat = await fs.promises.stat(zipPath);
  // Real Apexline mac zips are ~100MB+; Git LFS pointer files are ~130 bytes of text.
  if (stat.size < 1024 * 1024) {
    const head = String(await fs.promises.readFile(zipPath, { encoding: "utf8" }).catch(() => "")).slice(0, 200);
    if (/^version https:\/\/git-lfs\.github\.com\//m.test(head) || head.includes("git-lfs")) {
      throw new Error(
        "Update download is a Git LFS pointer, not a real zip. Redeploy updates-site with smudged LFS binaries (or host the full Apexline-*.zip without LFS).",
      );
    }
    throw new Error(`Update download is too small (${stat.size} bytes) to be a valid app zip.`);
  }
  const fd = await fs.promises.open(zipPath, "r");
  try {
    const buf = Buffer.alloc(4);
    await fd.read(buf, 0, 4, 0);
    // PK\x03\x04 local file header, or PK\x05\x06 empty archive EOCD
    if (buf[0] !== 0x50 || buf[1] !== 0x4b) {
      throw new Error("Update download is not a PKZip archive (bad magic). The hosted file may be HTML or corrupt.");
    }
  } finally {
    await fd.close();
  }
}

async function downloadPitWallUpdate(targetUrl, destinationPath, redirectCount = 0) {
  if (redirectCount > 4) throw new Error("Update download redirected too many times.");
  await new Promise((resolve, reject) => {
    const request = https.get(targetUrl, {
      timeout: 300000,
      headers: {
        "User-Agent": `Apexline/${appVersion()}`,
        Accept: "application/zip,application/octet-stream,*/*",
        "Cache-Control": "no-cache",
      },
    }, (response) => {
      if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
        response.resume();
        const nextUrl = new URL(response.headers.location, targetUrl).toString();
        downloadPitWallUpdate(nextUrl, destinationPath, redirectCount + 1).then(resolve, reject);
        return;
      }
      if (response.statusCode < 200 || response.statusCode >= 300) {
        response.resume();
        reject(new Error(`Update download failed (${response.statusCode || 0}).`));
        return;
      }
      const stream = fs.createWriteStream(destinationPath);
      response.pipe(stream);
      stream.on("finish", () => stream.close((err) => (err ? reject(err) : resolve())));
      stream.on("error", reject);
    });
    request.on("timeout", () => request.destroy(new Error("Update download timed out.")));
    request.on("error", reject);
  });
  await assertValidUpdateZip(destinationPath);
}

function findExtractedApexlineApp(root) {
  const direct = path.join(root, "Apexline.app");
  if (fs.existsSync(path.join(direct, "Contents/Info.plist"))) return direct;
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const candidate = path.join(root, entry.name);
    if (entry.name === "Apexline.app" && fs.existsSync(path.join(candidate, "Contents/Info.plist"))) return candidate;
    if (!entry.name.endsWith(".app")) {
      const nested = findExtractedApexlineApp(candidate);
      if (nested) return nested;
    }
  }
  return "";
}

async function validateApexlineAppBundle(appPath) {
  const plist = path.join(appPath, "Contents/Info.plist");
  const name = String(await execFilePromise("/usr/libexec/PlistBuddy", ["-c", "Print :CFBundleName", plist])).trim();
  if (name !== "Apexline") throw new Error("Downloaded update is not an Apexline app.");
  return true;
}

async function installPitWallUpdate(targetUrl) {
  const url = String(targetUrl || "");
  if (!isAllowedUpdateUrl(url)) throw new Error("Update URL is not trusted.");
  if (process.platform !== "darwin") throw new Error("Automatic update install is currently macOS-only.");
  const appPath = currentAppBundlePath();
  if (!appPath || !fs.existsSync(path.join(appPath, "Contents/Info.plist"))) {
    throw new Error("Install Apexline as a macOS app before using automatic updates.");
  }

  const tempRoot = await fs.promises.mkdtemp(path.join(os.tmpdir(), "apexline-update-"));
  const zipPath = path.join(tempRoot, "update.zip");
  const extractPath = path.join(tempRoot, "extract");
  await fs.promises.mkdir(extractPath, { recursive: true });
  try {
    await downloadPitWallUpdate(url, zipPath);
    await execFilePromise("/usr/bin/ditto", ["-x", "-k", zipPath, extractPath], { timeout: 180000 });
  } catch (error) {
    const message = String(error?.message || error || "");
    if (/PKZip|not a PKZip|Git LFS|too small/i.test(message)) throw error;
    throw new Error(`Failed to extract update zip: ${message}`);
  }
  const newAppPath = findExtractedApexlineApp(extractPath);
  if (!newAppPath) throw new Error("Downloaded update did not contain Apexline.app.");
  await validateApexlineAppBundle(newAppPath);

  const scriptPath = path.join(tempRoot, "install-update.sh");
  const backupPath = path.join(tempRoot, "previous-Apexline.app");
  const script = `#!/bin/zsh
set -e
APP_PATH=${shellQuote(appPath)}
NEW_APP=${shellQuote(newAppPath)}
BACKUP_PATH=${shellQuote(backupPath)}
TEMP_ROOT=${shellQuote(tempRoot)}
APP_PID=${process.pid}
for i in {1..80}; do
  if ! kill -0 "$APP_PID" 2>/dev/null; then
    break
  fi
  sleep 0.25
done
rm -rf "$BACKUP_PATH"
if [ -d "$APP_PATH" ]; then
  mv "$APP_PATH" "$BACKUP_PATH"
fi
/usr/bin/ditto "$NEW_APP" "$APP_PATH"
/usr/bin/open "$APP_PATH"
rm -rf "$BACKUP_PATH"
rm -rf "$TEMP_ROOT"
`;
  await fs.promises.writeFile(scriptPath, script, "utf8");
  await fs.promises.chmod(scriptPath, 0o700);
  const child = spawn("/bin/zsh", [scriptPath], { detached: true, stdio: "ignore" });
  child.unref();
  setTimeout(() => app.quit(), 250);
  return { installing: true, message: "Installing update and restarting Apexline." };
}

async function checkPitWallUpdates() {
  const currentVersion = appVersion();
  const feedUrl = updateFeedUrl();
  if (!feedUrl) {
    return { currentVersion, feedUrl: "", update: null, status: "unconfigured", message: "Update feed is not configured." };
  }
  if (process.platform !== "darwin") {
    return { currentVersion, feedUrl, update: null, status: "unsupported", message: "Apexline update feed is currently macOS-only." };
  }
  const feed = await requestJson(feedUrl, 8500, { "Cache-Control": "no-cache" });
  const releases = Array.isArray(feed?.releases) ? feed.releases.map(normalizeRelease).filter(Boolean) : [];
  const update = releases
    .filter((release) => compareVersions(release.version, currentVersion) > 0)
    .sort((a, b) => compareVersions(b.version, a.version))[0] || null;
  return {
    currentVersion,
    feedUrl,
    update,
    status: update ? "available" : "current",
    message: update ? `Apexline ${update.version} is available.` : "Apexline is up to date.",
  };
}

function readDotEnvValues() {
  const candidates = [
    path.join(process.cwd(), ".env"),
    path.join(app.getAppPath(), ".env"),
    path.resolve(app.getAppPath(), "../../../../../.env"),
    path.join(app.getPath("userData"), ".env"),
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
        "User-Agent": "Apexline/1.0 (+https://github.com/neelsatyavolu/apexline)",
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
const openF1ForegroundQueue = [];
const openF1BackgroundQueue = [];
let openF1ActiveRequests = 0;
let openF1DrainQueued = false;
const openF1RequestTimes = [];

function openF1IsUrl(targetUrl) {
  try {
    return new URL(targetUrl).hostname === "api.openf1.org";
  } catch {
    return false;
  }
}

// Without a local OpenF1 account, requests go through the Apexline proxy, which
// authenticates server-side and never hands its token to the client.
function openF1ProxyUrl(targetUrl) {
  const url = new URL(targetUrl);
  const endpoint = url.pathname.replace(/^\/v1\//, "");
  return `${OPENF1_PROXY_BASE_URL}/${encodeURIComponent(endpoint)}${url.search}`;
}

async function getOpenF1AccessToken() {
  const credentials = openF1Credentials();
  if (!credentials) return "";
  if (openF1TokenCache?.accessToken && openF1TokenCache.expiresAt - Date.now() > OPENF1_TOKEN_REFRESH_MARGIN_MS) return openF1TokenCache.accessToken;
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

function pickNextOpenF1Task() {
  return openF1ForegroundQueue.shift() || openF1BackgroundQueue.shift() || null;
}

function drainOpenF1Queue() {
  if (openF1DrainQueued) return;
  openF1DrainQueued = true;
  setImmediate(() => {
    openF1DrainQueued = false;
    while (openF1ActiveRequests < OPENF1_MAX_CONCURRENT_REQUESTS) {
      const task = pickNextOpenF1Task();
      if (!task) return;
      openF1ActiveRequests += 1;
      Promise.resolve()
        .then(async () => {
          await waitForOpenF1Slot();
          return task.fn();
        })
        .then(task.resolve, task.reject)
        .finally(() => {
          openF1ActiveRequests = Math.max(0, openF1ActiveRequests - 1);
          drainOpenF1Queue();
        });
    }
  });
}

function scheduleOpenF1Request(fn, options = {}) {
  return new Promise((resolve, reject) => {
    const task = { fn, resolve, reject };
    if (options.priority === "background") openF1BackgroundQueue.push(task);
    else openF1ForegroundQueue.push(task);
    drainOpenF1Queue();
  });
}

async function requestOpenF1Json(targetUrl, options = {}) {
  const timeout = options.timeout || 12000;
  let lastError = null;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    try {
      return await scheduleOpenF1Request(async () => {
        if (!openF1Credentials()) return requestJson(openF1ProxyUrl(targetUrl), timeout);
        const token = await getOpenF1AccessToken();
        return requestJson(targetUrl, timeout, { Authorization: `Bearer ${token}` });
      }, options);
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

async function requestMaybeOpenF1Json(targetUrl, timeout = 8500, options = {}) {
  return openF1IsUrl(targetUrl) ? requestOpenF1Json(targetUrl, { timeout, priority: options.priority }) : requestJson(targetUrl, timeout);
}

async function requestOpenF1JsonMap(requests = {}, options = {}) {
  const entries = await Promise.all(Object.entries(requests).map(async ([key, url]) => {
    try {
      return { key, value: await requestOpenF1Json(url, { timeout: options.timeout, priority: options.priority }) };
    } catch (error) {
      return { key, error };
    }
  }));
  const raw = {};
  const errors = [];
  for (const result of entries) {
    if (!result.error) raw[result.key] = result.value;
    else errors.push({ key: result.key, error: result.error });
  }
  return { raw, errors };
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
        "User-Agent": "Apexline/1.0 (+https://github.com/neelsatyavolu/apexline)",
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
        "User-Agent": "Apexline/1.0 (+https://github.com/neelsatyavolu/apexline)",
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

// Protocol details are shared; Apexline keeps its loopback callback and Keychain storage.
const generatePkce = sharedAuth.generatePkce;
const buildCodexAuthorizeUrl = (challenge, state) => sharedAuth.authorizeUrl("codex", { challenge, state });
const buildGrokAuthorizeUrl = (challenge, state) => sharedAuth.authorizeUrl("grok", { challenge, state });
const exchangeCodexCode = (code, verifier) => sharedAuth.exchangeCode("codex", code, verifier);
const refreshCodexTokens = (refreshToken, accountId = "") => sharedAuth.refreshTokens("codex", refreshToken, { previous: { refreshToken, accountId } });
const exchangeGrokCode = (code, verifier) => sharedAuth.exchangeCode("grok", code, verifier);
const refreshGrokTokens = (refreshToken) => sharedAuth.refreshTokens("grok", refreshToken);

function parseOAuthCodeInput(value, expectedState = "") {
  const text = String(value || "").trim();
  if (!text) throw new Error("Paste the authorization code from the sign-in page.");

  const asUrl = (() => {
    try {
      if (/^https?:\/\//i.test(text) || text.startsWith("http://") || text.includes("://") || text.includes("?code=")) {
        return new URL(text.includes("://") ? text : `http://local.invalid/${text.replace(/^\//, "")}`);
      }
    } catch {}
    return null;
  })();

  if (asUrl) {
    const error = asUrl.searchParams.get("error");
    if (error) throw new Error(`OAuth failed: ${error}`);
    const code = asUrl.searchParams.get("code");
    const state = asUrl.searchParams.get("state");
    if (code) {
      if (expectedState && state && state !== expectedState) throw new Error("OAuth state mismatch.");
      return code;
    }
  }

  const bare = text.replace(/\s+/g, "");
  if (bare.length < 8) throw new Error("That does not look like a valid authorization code.");
  return bare;
}

function waitForOAuthCallback(redirectUri, expectedState) {
  let settled = false;
  let finish = () => {};
  const promise = new Promise((resolve, reject) => {
    const redirect = new URL(redirectUri);
    finish = (error, code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try { server.close(() => {}); } catch {}
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
        res.end("<h1>Apexline sign-in failed</h1><p>You can close this tab.</p>");
        finish(new Error(`OAuth failed: ${error}`));
        return;
      }
      if (!code || state !== expectedState) {
        res.end("<h1>Apexline sign-in failed</h1><p>State mismatch. You can close this tab.</p>");
        finish(new Error("OAuth state mismatch."));
        return;
      }
      res.end("<h1>Apexline sign-in complete</h1><p>You can close this tab and return to Apexline.</p>");
      finish(null, code);
    });
    const timer = setTimeout(() => finish(new Error("OAuth sign-in timed out. Paste the authorization code from the browser if the page showed one.")), 5 * 60 * 1000);
    server.once("error", (error) => finish(error instanceof Error ? error : new Error(String(error))));
    const port = Number(redirect.port);
    server.listen(port || 0, redirect.hostname || "127.0.0.1");
  });
  return {
    promise,
    injectCode(code) {
      finish(null, code);
    },
    cancel(error) {
      finish(error instanceof Error ? error : new Error(String(error || "OAuth cancelled.")));
    },
  };
}

let pendingAiOAuth = null;

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
  const [codexSession, grokSession, codexModels, grokModels] = await Promise.all([
    getActiveOAuthSession("codex"),
    getActiveOAuthSession("grok"),
    visibleAiModels("codex"),
    visibleAiModels("grok"),
  ]);
  return {
    codexConnected: Boolean(codexSession),
    grokConnected: Boolean(grokSession),
    codexModels,
    defaultCodexModel: DEFAULT_CODEX_MODEL,
    grokModels,
    defaultGrokModel: DEFAULT_GROK_MODEL,
  };
}

async function startAiOAuth(provider) {
  const target = String(provider || "").toLowerCase();
  if (target !== "codex" && target !== "grok") throw new Error("Unsupported AI OAuth provider");
  if (pendingAiOAuth) {
    throw new Error(`Finish or wait for the in-progress ${pendingAiOAuth.provider} sign-in first.`);
  }
  const pkce = generatePkce();
  const redirectUri = target === "codex" ? CODEX_REDIRECT_URI : GROK_REDIRECT_URI;
  const authorizeUrl = target === "codex"
    ? buildCodexAuthorizeUrl(pkce.challenge, pkce.state)
    : buildGrokAuthorizeUrl(pkce.challenge, pkce.state);
  const wait = waitForOAuthCallback(redirectUri, pkce.state);
  pendingAiOAuth = {
    provider: target,
    state: pkce.state,
    redirectUri,
    injectCode: wait.injectCode,
    cancel: wait.cancel,
  };
  try {
    await shell.openExternal(authorizeUrl);
    const code = await wait.promise;
    const tokens = target === "codex"
      ? await exchangeCodexCode(code, pkce.verifier)
      : await exchangeGrokCode(code, pkce.verifier, redirectUri);
    await writeOAuthSession(target, tokens);
    return getAiAuthStatus();
  } finally {
    if (pendingAiOAuth?.provider === target) pendingAiOAuth = null;
  }
}

async function submitAiOAuthCode(provider, codeInput) {
  const target = String(provider || "").toLowerCase();
  if (target !== "codex" && target !== "grok") throw new Error("Unsupported AI OAuth provider");
  const pending = pendingAiOAuth;
  if (!pending || pending.provider !== target) {
    throw new Error("No sign-in in progress. Click Connect first, then paste the code from the browser.");
  }
  const code = parseOAuthCodeInput(codeInput, pending.state);
  pending.injectCode(code);
  return { ok: true, provider: target };
}

async function disconnectAiOAuth(provider) {
  const target = String(provider || "").toLowerCase();
  if (target !== "codex" && target !== "grok") throw new Error("Unsupported AI OAuth provider");
  if (pendingAiOAuth?.provider === target) {
    pendingAiOAuth.cancel(new Error("Sign-in cancelled."));
    pendingAiOAuth = null;
  }
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
    .replace(/&gt;/g, ">")
    .replace(/&#(x[0-9a-f]+|\d+);/gi, (match, code) => {
      const value = code[0].toLowerCase() === "x" ? Number.parseInt(code.slice(1), 16) : Number.parseInt(code, 10);
      return Number.isInteger(value) && value >= 0 && value <= 0x10ffff ? String.fromCodePoint(value) : match;
    });
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
  const reactionStory = /["“”]|\b(message|reaction|reacts?|responds?|says|said|admits?|explains?|reveals?|emotional|dream)\b/.test(text);
  const resultStory = /\b(qualifying|practice|results?|winner|wins?|won|podium|grid|classification|finishes?|finished|dnfs?|disqualified)\b/.test(text)
    || /\b(?:claims?|takes?|secures?|seals|earns?|scores?)\b.{0,80}\b(?:win|victory)\b/.test(text)
    || /\b(?:first|maiden)\b.{0,60}\b(?:win|victory)\b/.test(text);
  if (/breaking|urgent|confirmed|penalty|investigation/.test(text)) return "Breaking";
  if (/upgrade|floor|wing|engine|aero|technical|regulation/.test(text)) return "Tech";
  if (resultStory && !reactionStory) return "Results";
  if (/\b(strategy|pit|pits|pitted|pitstop|pit-stop|tyres?|tires?|undercut|overcut|stints?)\b|\bpit stop\b|\bpit lane\b/.test(text)) return "Strategy";
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

function extractHtmlCardContext(html, index, length = 0) {
  const source = String(html || "");
  const startIndex = Math.max(0, Number(index) || 0);
  const endIndex = startIndex + Math.max(0, Number(length) || 0);
  for (const match of source.matchAll(/<article\b[^>]*>[\s\S]*?<\/article>/gi)) {
    const articleStart = match.index || 0;
    const articleEnd = articleStart + match[0].length;
    if (articleStart <= startIndex && articleEnd >= endIndex) return match[0];
    if (articleStart > startIndex) break;
  }
  return "";
}

function extractHtmlDate(value) {
  const text = decodeEntities(value).replace(/\s+/g, " ");
  const month = "Jan|January|Feb|February|Mar|March|Apr|April|May|Jun|June|Jul|July|Aug|August|Sep|Sept|September|Oct|October|Nov|November|Dec|December";
  const patterns = [
    /\b20\d{2}-\d{2}-\d{2}(?:T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z?)?\b/i,
    new RegExp(`\\b(?:${month})\\s+\\d{1,2},?\\s+20\\d{2}\\s+\\d{1,2}:\\d{2}\\s*(?:[ap]m\\s*)?(?:UTC|GMT|[+-]\\d{2}:?\\d{2})?\\b`, "i"),
    new RegExp(`\\b\\d{1,2}\\s+(?:${month})\\s+20\\d{2}\\s+\\d{1,2}:\\d{2}\\s*(?:[ap]m\\s*)?(?:UTC|GMT|[+-]\\d{2}:?\\d{2})?\\b`, "i"),
    new RegExp(`\\b(?:${month})\\s+\\d{1,2},?\\s+20\\d{2}\\b`, "i"),
    new RegExp(`\\b\\d{1,2}\\s+(?:${month})\\s+20\\d{2}\\b`, "i"),
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (!match) continue;
    const time = Date.parse(match[0].replace(/(\d{1,2}:\d{2})([ap]m)\b/i, "$1 $2"));
    if (Number.isFinite(time)) return new Date(time).toISOString();
  }
  return "";
}

function extractHtmlImage(block, baseUrl) {
  const candidates = [];
  for (const match of block.matchAll(/<(?:img|source)\b[^>]*\b(?:src|data-src|data-lazy-src|data-original)=["']([^"']+)["'][^>]*>/gi)) {
    candidates.push(match[1]);
  }
  for (const match of block.matchAll(/<(?:img|source)\b[^>]*\b(?:srcset|data-srcset)=["']([^"']+)["'][^>]*>/gi)) {
    const first = String(match[1] || "").split(",")[0]?.trim().split(/\s+/)[0] || "";
    if (first) candidates.push(first);
  }
  return candidates.map((value) => normalizeNewsImage(absoluteNewsUrl(value, baseUrl))).find(Boolean) || "";
}

function extractHtmlPreview(block, title = "") {
  const titleText = decodeEntities(title).replace(/\s+/g, " ").trim();
  for (const match of String(block || "").matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)) {
    const text = decodeEntities(match[1]).replace(/\s+/g, " ").trim();
    if (text.length < 24) continue;
    if (text === titleText) continue;
    if (/^(advertisement|read more|sign up|follow us|share this)/i.test(text)) continue;
    return text;
  }
  return "";
}

function extractArticleMetaImage(html, baseUrl) {
  const candidates = [];
  for (const match of html.matchAll(/<meta\b[^>]*(?:property|name)=["'](?:og:image|twitter:image|twitter:image:src)["'][^>]*\bcontent=["']([^"']+)["'][^>]*>/gi)) {
    candidates.push(match[1]);
  }
  for (const match of html.matchAll(/<meta\b[^>]*\bcontent=["']([^"']+)["'][^>]*(?:property|name)=["'](?:og:image|twitter:image|twitter:image:src)["'][^>]*>/gi)) {
    candidates.push(match[1]);
  }
  return candidates.map((value) => normalizeNewsImage(absoluteNewsUrl(value, baseUrl))).find(Boolean) || extractHtmlImage(html.slice(0, 12000), baseUrl);
}

function normalizeArticleDate(value) {
  const text = decodeXmlEntities(value).trim();
  const time = Date.parse(text);
  if (Number.isFinite(time)) return new Date(time).toISOString();
  return extractHtmlDate(text);
}

function extractArticleMetaDate(html) {
  const candidates = [];
  const metaNames = "article:published_time|og:published_time|datePublished|datepublished|pubdate|publishdate|publish-date|sailthru.date";
  for (const match of html.matchAll(new RegExp(`<meta\\b[^>]*(?:property|name)=["'](?:${metaNames})["'][^>]*\\bcontent=["']([^"']+)["'][^>]*>`, "gi"))) {
    candidates.push(match[1]);
  }
  for (const match of html.matchAll(new RegExp(`<meta\\b[^>]*\\bcontent=["']([^"']+)["'][^>]*(?:property|name)=["'](?:${metaNames})["'][^>]*>`, "gi"))) {
    candidates.push(match[1]);
  }
  for (const match of html.matchAll(/<time\b[^>]*\bdatetime=["']([^"']+)["'][^>]*>/gi)) {
    candidates.push(match[1]);
  }
  for (const match of html.matchAll(/"datePublished"\s*:\s*"([^"]+)"/gi)) {
    candidates.push(match[1]);
  }
  return candidates.map(normalizeArticleDate).find(Boolean) || extractHtmlDate(html);
}

function extractArticleImages(html, baseUrl) {
  const blocks = [];
  for (const match of html.matchAll(/<(?:article|main)\b[^>]*>([\s\S]*?)<\/(?:article|main)>/gi)) {
    blocks.push(match[0]);
  }
  const source = blocks.join("\n") || html.slice(0, 40000);
  const images = [];
  const push = (value) => {
    const image = normalizeNewsImage(absoluteNewsUrl(value, baseUrl));
    if (image && !images.includes(image)) images.push(image);
  };
  for (const match of source.matchAll(/<(?:img|source)\b[^>]*\b(?:src|data-src|data-lazy-src|data-original)=["']([^"']+)["'][^>]*>/gi)) {
    push(match[1]);
  }
  for (const match of source.matchAll(/<(?:img|source)\b[^>]*\b(?:srcset|data-srcset)=["']([^"']+)["'][^>]*>/gi)) {
    for (const part of String(match[1] || "").split(",")) {
      const candidate = part.trim().split(/\s+/)[0] || "";
      if (candidate) push(candidate);
    }
  }
  return images.slice(0, 8);
}

function extractJsonArticleBodies(value, bodies = []) {
  if (!value || typeof value !== "object") return bodies;
  if (typeof value.articleBody === "string") bodies.push(value.articleBody);
  if (Array.isArray(value)) {
    for (const item of value) extractJsonArticleBodies(item, bodies);
  } else {
    for (const item of Object.values(value)) extractJsonArticleBodies(item, bodies);
  }
  return bodies;
}

function extractArticleBody(html, fallback = "") {
  const fallbackText = decodeEntities(fallback).replace(/\s+/g, " ").trim();
  const jsonBodies = [];
  for (const match of html.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      jsonBodies.push(...extractJsonArticleBodies(JSON.parse(decodeXmlEntities(match[1]).trim())));
    } catch {}
  }
  const jsonBody = jsonBodies.map((body) => decodeEntities(body).replace(/\s+/g, " ").trim()).find((body) => body.length > fallbackText.length + 80);
  if (jsonBody) return jsonBody;

  const blocks = [];
  for (const match of html.matchAll(/<(?:article|main)\b[^>]*>([\s\S]*?)<\/(?:article|main)>/gi)) {
    blocks.push(match[0]);
  }
  const source = blocks.join("\n") || html;
  const paragraphs = [];
  for (const match of source.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)) {
    const text = decodeEntities(match[1]).replace(/\s+/g, " ").trim();
    if (text.length < 45) continue;
    if (/^(advertisement|read more|sign up|follow us|share this)/i.test(text)) continue;
    if (text === fallbackText) continue;
    if (!paragraphs.includes(text)) paragraphs.push(text);
  }
  const body = paragraphs.join("\n\n").trim();
  return body.length > fallbackText.length ? body : "";
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
    images: Array.isArray(story.images) ? story.images.slice(0, 8) : [],
    tag: classifyNews(title),
    team: "",
    color: colourForText(`${title} ${lead}`),
  };
}

function parseRss(xml, source) {
  const sourceName = typeof source === "string" ? source : source.name;
  return Array.from(xml.matchAll(/<item\b[\s\S]*?<\/item>/gi)).slice(0, 18).map((match, index) => {
    const item = match[0];
    const title = extractXml(item, "title");
    const lead = extractXml(item, "description");
    const url = extractXml(item, "link");
    if (source?.articlePath) {
      try {
        if (!source.articlePath.test(new URL(url).pathname)) return null;
      } catch {
        return null;
      }
    }
    const publishedAt = extractXml(item, "pubDate") || extractXml(item, "published");
    return normalizeNewsStory(sourceName, index, {
      title,
      lead,
      body: extractRssArticleText(item),
      url,
      publishedAt,
      image: extractRssImage(item),
    });
  }).filter((item) => item?.title && item.url);
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
    const cardContext = extractHtmlCardContext(html, match.index, match[0].length);
    const afterLink = html.slice(match.index + match[0].length, match.index + match[0].length + 1000);
    stories.push(normalizeNewsStory(source.name, stories.length, {
      title,
      lead: extractHtmlPreview(afterLink, title) || extractHtmlPreview(cardContext, title),
      body: "",
      url,
      publishedAt: extractHtmlDate(cardContext) || extractHtmlDate(context),
      image: extractHtmlImage(cardContext, source.url) || extractHtmlImage(context, source.url),
    }));
    if (stories.length >= 12) break;
  }
  return stories;
}

function parseNewsSource(raw, source) {
  if (!raw) return [];
  if (source.type === "rss") return parseRss(raw, source);
  return parseNewsHtml(raw, source);
}

function newsArticleDetailsFromHtml(html, articleUrl) {
  const image = extractArticleMetaImage(html, articleUrl);
  const images = Array.from(new Set([image, ...extractArticleImages(html, articleUrl)].filter(Boolean))).slice(0, 8);
  return {
    image,
    images,
    body: extractArticleBody(html, ""),
    publishedAt: extractArticleMetaDate(html),
  };
}

function newsArticleDetailsMeaningful(details) {
  const text = [details?.title, details?.lead, details?.body].filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
  if (/(?:checking your browser|verify (?:that )?you are human|just a moment|access denied|enable javascript and cookies)/i.test(text)) {
    return false;
  }
  return Boolean(
    String(details?.image || "").trim()
    || (Array.isArray(details?.images) && details.images.some(Boolean))
    || text,
  );
}

async function getNewsArticleEnrichment(articleUrl, fetchText, nowMs = Date.now()) {
  const cacheKey = normalizeNewsUrl(articleUrl);
  if (!cacheKey) return null;
  const cached = newsArticleEnrichmentCache.get(cacheKey);
  if (cached?.value && nowMs - cached.createdAt < NEWS_ARTICLE_CACHE_MS) {
    newsArticleEnrichmentCache.delete(cacheKey);
    newsArticleEnrichmentCache.set(cacheKey, cached);
    return cached.value;
  }
  if (cached?.promise) return cached.promise;
  if (cached) newsArticleEnrichmentCache.delete(cacheKey);
  let pending;
  pending = Promise.resolve()
    .then(() => fetchText(articleUrl, 6500))
    .then((html) => {
      const value = newsArticleDetailsFromHtml(html, articleUrl);
      if (newsArticleEnrichmentCache.get(cacheKey)?.promise === pending) {
        if (newsArticleDetailsMeaningful(value)) {
          newsArticleEnrichmentCache.set(cacheKey, { createdAt: nowMs, value });
          pruneBoundedMap(newsArticleEnrichmentCache, NEWS_ARTICLE_CACHE_LIMIT);
        } else {
          newsArticleEnrichmentCache.delete(cacheKey);
        }
      }
      return value;
    })
    .catch((error) => {
      if (newsArticleEnrichmentCache.get(cacheKey)?.promise === pending) {
        newsArticleEnrichmentCache.delete(cacheKey);
      }
      throw error;
    });
  newsArticleEnrichmentCache.set(cacheKey, { createdAt: nowMs, promise: pending });
  pruneBoundedMap(newsArticleEnrichmentCache, NEWS_ARTICLE_CACHE_LIMIT);
  return pending;
}

async function enrichNewsStoryImages(stories, limit = 24, fetchText = requestText, nowMs = Date.now()) {
  const targets = stories.filter((story) => story.url && (!story.lead || !story.image || !story.publishedAt || story.time === "1m")).slice(0, limit);
  await mapWithConcurrencyStable(targets, NEWS_ARTICLE_CONCURRENCY, async (story) => {
    try {
      const details = await getNewsArticleEnrichment(story.url, fetchText, nowMs);
      if (!details) return;
      story.image = details.image || story.image;
      story.images = Array.from(new Set([story.image, ...(details.images || [])].filter(Boolean))).slice(0, 8);
      const body = details.body || "";
      if (body) {
        story.body = body;
        if (!story.lead) story.lead = body.split(/\n{2,}/)[0].replace(/\s+/g, " ").trim();
      }
      const publishedAt = details.publishedAt;
      if (publishedAt) {
        story.publishedAt = publishedAt;
        story.time = timeAgo(publishedAt);
      }
    } catch {}
  });
  return stories.sort((a, b) => newsStorySortTime(b) - newsStorySortTime(a));
}

function newsStorySortTime(story) {
  const time = Date.parse(story?.publishedAt || "");
  return Number.isFinite(time) ? time : 0;
}

function selectNewsFeedStories(stories, limit = 24) {
  const sorted = stories.slice().sort((a, b) => newsStorySortTime(b) - newsStorySortTime(a));
  const selected = sorted.slice(0, limit);
  const selectedSet = new Set(selected);
  const sourceOrder = Array.from(new Set(stories.map((story) => story.source).filter(Boolean)));
  for (const source of sourceOrder) {
    if (selected.some((story) => story.source === source)) continue;
    const candidate = sorted.find((story) => story.source === source);
    if (!candidate || selectedSet.has(candidate)) continue;
    if (selected.length < limit) {
      selected.push(candidate);
      selectedSet.add(candidate);
      continue;
    }
    const sourceCounts = selected.reduce((counts, story) => counts.set(story.source, (counts.get(story.source) || 0) + 1), new Map());
    const replaceIndex = selected.findLastIndex((story) => (sourceCounts.get(story.source) || 0) > 1);
    if (replaceIndex === -1) continue;
    selectedSet.delete(selected[replaceIndex]);
    selected[replaceIndex] = candidate;
    selectedSet.add(candidate);
  }
  return selected.sort((a, b) => newsStorySortTime(b) - newsStorySortTime(a)).slice(0, limit);
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
  return selectNewsFeedStories(stories, 24);
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

function parseF1ApiDriverStandings(json) {
  const rows = Array.isArray(json?.drivers_championship) ? json.drivers_championship : [];
  return {
    seasonSummary: {
      season: json?.season ? String(json.season) : String(new Date().getFullYear()),
      round: 0,
    },
    standings: rows.map((row) => {
      const code = String(row.driver?.shortName || row.driverId || "").slice(0, 3).toUpperCase();
      return {
        pos: Number(row.position),
        code,
        pts: Number(row.points),
        wins: Number(row.wins || 0),
        delta: 0,
        driver: {
          code,
          name: [row.driver?.name, row.driver?.surname].filter(Boolean).join(" "),
          num: Number(row.driver?.number || 0),
          team: row.team?.teamName || "",
          abbr: teamAbbr(row.team?.teamName, row.teamId),
        },
      };
    }).filter((row) => row.code),
  };
}

function parseF1ApiConstructorStandings(json) {
  const rows = Array.isArray(json?.constructors_championship) ? json.constructors_championship : [];
  return rows.map((row) => ({
    pos: Number(row.position),
    abbr: teamAbbr(row.team?.teamName, row.teamId),
    name: row.team?.teamName || "",
    pts: Number(row.points),
    wins: Number(row.wins || 0),
    delta: 0,
  }));
}

function officialF1ResultsUrl(kind = "drivers", season = new Date().getFullYear()) {
  const year = String(season || new Date().getFullYear()).replace(/[^0-9]/g, "") || String(new Date().getFullYear());
  return `https://www.formula1.com/en/results/${year}/${kind}`;
}

function officialF1ResultsLines(html) {
  return decodeXmlEntities(String(html || "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(?:tr|div|li|p|h[1-6])>/gi, "\n")
    .replace(/<[^>]*>/g, " "))
    .split(/\n+/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

function officialF1ResultsText(html, headingPattern, headerPattern) {
  const text = decodeEntities(html).replace(/\s+/g, " ").trim();
  const headingIndex = text.search(headingPattern);
  const headerIndex = text.search(headerPattern);
  const start = headerIndex >= 0 ? headerIndex : headingIndex >= 0 ? headingIndex : 0;
  const tail = text.slice(Math.max(0, start));
  const end = tail.search(/\bOUR PARTNERS\b|Download the Official F1 App|©/i);
  return end >= 0 ? tail.slice(0, end).trim() : tail;
}

function parseOfficialF1DriverStandings(html) {
  const text = officialF1ResultsText(html, /\b\d{4}\s+Drivers'? Standings\b/i, /\bPos\.?\s*Driver\s+Nationality\s+Team\s+Pts\.?\b/i);
  const seasonMatch = text.match(/\b(20\d{2}|19\d{2})\s+Drivers'? Standings\b/i);
  const rows = [];
  let active = false;
  for (const line of officialF1ResultsLines(html)) {
    if (/\bPos\.?\s*Driver\s+Nationality\s+Team\s+Pts\.?\b/i.test(line)) {
      active = true;
      continue;
    }
    if (/\bOUR PARTNERS\b|Download the Official F1 App/i.test(line)) break;
    if (!active) continue;
    const match = line.match(/^(\d{1,2})\s+(.+?)\s+([A-Z]{3})\s+([A-Z]{3})\s+(.+?)\s+(\d+(?:\.\d+)?)$/);
    if (!match) continue;
    const [, pos, name, code, , team, points] = match;
    rows.push({ pos, name, code, team, points });
  }
  if (!rows.length) {
    const normalized = text.replace(/\bPos\.?\s*Driver\s+Nationality\s+Team\s+Pts\.?\b/i, " ");
    const pattern = /(?:^|\s)(\d{1,2})\s+([A-Za-zÀ-ÿ' .-]+?)\s+([A-Z]{3})\s+([A-Z]{3})\s+([A-Za-z0-9&' .-]+?)\s+(\d+(?:\.\d+)?)(?=\s+\d{1,2}\s+[A-Za-zÀ-ÿ' .-]+?\s+[A-Z]{3}\s+[A-Z]{3}\s+|$)/g;
    for (const match of normalized.matchAll(pattern)) {
      const [, pos, name, code, , team, points] = match;
      rows.push({ pos, name, code, team, points });
    }
  }
  return {
    seasonSummary: {
      season: seasonMatch?.[1] || String(new Date().getFullYear()),
      round: 0,
    },
    standings: rows.map((row) => ({
      pos: Number(row.pos),
      code: row.code,
      pts: Number(row.points),
      wins: 0,
      delta: 0,
      driver: {
        code: row.code,
        name: row.name,
        num: 0,
        team: row.team,
        abbr: teamAbbr(row.team),
      },
    })).filter((row) => row.code && Number.isFinite(row.pos)),
  };
}

function parseOfficialF1ConstructorStandings(html) {
  const text = officialF1ResultsText(html, /\b\d{4}\s+Teams'? Standings\b/i, /\bPos\.?\s*Team\s+Pts\.?\b/i);
  const rows = [];
  let active = false;
  for (const line of officialF1ResultsLines(html)) {
    if (/\bPos\.?\s*Team\s+Pts\.?\b/i.test(line)) {
      active = true;
      continue;
    }
    if (/\bOUR PARTNERS\b|Download the Official F1 App/i.test(line)) break;
    if (!active) continue;
    const match = line.match(/^(\d{1,2})\s+(.+?)\s+(\d+(?:\.\d+)?)$/);
    if (!match) continue;
    const [, pos, name, points] = match;
    rows.push({ pos, name, points });
  }
  if (!rows.length) {
    const normalized = text.replace(/\bPos\.?\s*Team\s+Pts\.?\b/i, " ");
    const pattern = /(?:^|\s)(\d{1,2})\s+([A-Za-z0-9&' .-]+?)\s+(\d+(?:\.\d+)?)(?=\s+\d{1,2}\s+[A-Za-z]|$)/g;
    for (const match of normalized.matchAll(pattern)) {
      const [, pos, name, points] = match;
      rows.push({ pos, name, points });
    }
  }
  return rows.map((row) => ({
    pos: Number(row.pos),
    abbr: teamAbbr(row.name),
    name: row.name,
    pts: Number(row.points),
    wins: 0,
    delta: 0,
  })).filter((row) => row.name && Number.isFinite(row.pos));
}

function championshipPositionDelta(row) {
  const current = championshipRowPosition(row);
  const start = championshipStandingNumber(row?.position_start);
  if (!Number.isFinite(current) || !Number.isFinite(start)) return 0;
  return start - current;
}

function applyChampionshipPositionDeltas(rows = [], previousRows = [], key = "code") {
  if (!Array.isArray(rows) || !rows.length || !Array.isArray(previousRows) || !previousRows.length) return rows;
  const previousPositionByKey = new Map(previousRows.map((row) => [
    String(row?.[key] || "").toUpperCase(),
    championshipStandingNumber(row?.pos, row?.position),
  ]).filter(([rowKey, pos]) => rowKey && Number.isFinite(pos)));
  if (!previousPositionByKey.size) return rows;
  return rows.map((row) => {
    const rowKey = String(row?.[key] || "").toUpperCase();
    const current = championshipStandingNumber(row?.pos, row?.position);
    const previous = previousPositionByKey.get(rowKey);
    if (!rowKey || !Number.isFinite(current) || !Number.isFinite(previous)) return row;
    return { ...row, delta: previous - current };
  });
}

function championshipRowsNeedPreviousDeltas(rows = []) {
  return Array.isArray(rows) && rows.length > 0 && rows.every((row) => !Number(row?.delta));
}

function championshipStandingNumber(...values) {
  for (const value of values) {
    const number = finiteNumber(value);
    if (number != null) return number;
  }
  return null;
}

function championshipRowPosition(row) {
  return championshipStandingNumber(row?.position_current, row?.position, row?.position_start);
}

function championshipRowPoints(row) {
  return championshipStandingNumber(row?.points_current, row?.points) ?? 0;
}

function championshipStandingRows(rows = []) {
  const items = (rows || []).map((row, index) => ({
    row,
    index,
    pos: championshipRowPosition(row),
    pts: championshipRowPoints(row),
  }));
  const fallbackOrder = items.slice().sort((a, b) => {
    if (b.pts !== a.pts) return b.pts - a.pts;
    if (a.pos != null && b.pos != null && a.pos !== b.pos) return a.pos - b.pos;
    if (a.pos != null) return -1;
    if (b.pos != null) return 1;
    return a.index - b.index;
  });
  const fallbackPositionByIndex = new Map(fallbackOrder.map((item, index) => [item.index, index + 1]));
  return items
    .map((item) => ({ ...item, pos: item.pos ?? fallbackPositionByIndex.get(item.index) ?? item.index + 1 }))
    .sort((a, b) => (a.pos - b.pos) || (b.pts - a.pts) || (a.index - b.index));
}

function constructorStandingsCoverExpectedTeams(rows = [], expectedRows = []) {
  const expectedKeys = new Set((expectedRows || []).map((row) => String(row?.abbr || row?.name || "").trim().toUpperCase()).filter(Boolean));
  const rowKeys = new Set((rows || []).map((row) => String(row?.abbr || row?.name || "").trim().toUpperCase()).filter(Boolean));
  const expectedCount = expectedKeys.size || 10;
  return rowKeys.size >= expectedCount;
}

function selectConstructorStandings(openF1Constructors = [], officialF1Constructors = [], f1ApiConstructors = [], jolpicaConstructors = [], expectedRows = []) {
  if (constructorStandingsCoverExpectedTeams(openF1Constructors, expectedRows)) return openF1Constructors;
  if (officialF1Constructors.length) return officialF1Constructors;
  if (f1ApiConstructors.length) return f1ApiConstructors;
  if (jolpicaConstructors.length) return jolpicaConstructors;
  return openF1Constructors;
}

function shouldFetchOfficialConstructorStandings(raw, expectedRows = []) {
  if (parseOfficialF1ConstructorStandings(raw?.officialF1ConstructorStandings).length) return false;
  return !constructorStandingsCoverExpectedTeams(parseOpenF1ConstructorStandings(raw?.openF1ConstructorStandings), expectedRows);
}

function parseOpenF1DriverStandings(rows = [], fallbackDrivers = []) {
  const driverByNumber = new Map((fallbackDrivers || []).map((driver) => [Number(driver.num), driver]));
  return {
    seasonSummary: {
      season: String(new Date().getFullYear()),
      round: 0,
    },
    standings: championshipStandingRows(rows).map(({ row, pos, pts }) => {
      const driver = driverByNumber.get(Number(row.driver_number)) || {};
      const code = driver.code || String(row.driver_number || "");
      return {
        pos,
        code,
        pts,
        wins: 0,
        delta: championshipPositionDelta(row),
        driver: {
          code,
          name: driver.name || code,
          num: Number(row.driver_number || driver.num || 0),
          team: driver.team || "",
          abbr: driver.abbr || teamAbbr(driver.team || ""),
        },
      };
    }).filter((row) => row.code),
  };
}

function parseOpenF1ConstructorStandings(rows = []) {
  return championshipStandingRows(rows).map(({ row, pos, pts }) => {
    const name = [row.team_name, row.team].find((value) => typeof value === "string" && value.trim())?.trim() || "";
    return {
      pos,
      abbr: teamAbbr(name),
      name,
      pts,
      wins: 0,
      delta: championshipPositionDelta(row),
    };
  }).filter((row) => row.abbr && row.name);
}

function parseDriverRecentForm(json, maxRaces = 5) {
  const races = (json?.MRData?.RaceTable?.Races || json?.RaceTable?.Races || [])
    .filter((race) => Array.isArray(race?.Results) && race.Results.length)
    .slice(-Math.max(1, Number(maxRaces) || 5));
  const formRounds = races.map((race) => ({
    rnd: Number(race.round || 0),
    gp: race.raceName || "Grand Prix",
    loc: race.Circuit?.Location?.locality || race.Circuit?.circuitName || "",
  }));
  const codes = new Set();
  for (const race of races) {
    for (const result of race.Results || []) {
      const code = String(result?.Driver?.code || "").trim().toUpperCase();
      if (code) codes.add(code);
    }
  }
  const driverForm = Object.fromEntries(Array.from(codes, (code) => [code, []]));
  for (const race of races) {
    const positions = new Map();
    for (const result of race.Results || []) {
      const code = String(result?.Driver?.code || "").trim().toUpperCase();
      if (!code) continue;
      const numeric = Number(result.positionOrder || result.position);
      positions.set(code, Number.isFinite(numeric) ? numeric : (result.positionText || result.status || null));
    }
    for (const code of codes) driverForm[code].push(positions.get(code) ?? null);
  }
  return { formRounds, driverForm };
}

function driverResultsUrl(season, round) {
  const year = String(season || new Date().getFullYear()).replace(/[^0-9]/g, "") || String(new Date().getFullYear());
  return `${JOLPICA_ERGAST_BASE_URL}/${encodeURIComponent(year)}/${encodeURIComponent(String(round))}/results.json?limit=100`;
}

async function fetchRecentDriverResults(schedule = [], maxRaces = 5, season = new Date().getFullYear()) {
  const year = String(season || new Date().getFullYear()).replace(/[^0-9]/g, "") || String(new Date().getFullYear());
  const recent = (schedule || [])
    .filter((race) => String(race?.status || "").toLowerCase() === "done" && race?.rnd)
    .slice(-Math.max(1, Number(maxRaces) || 5));
  if (!recent.length) return null;
  const races = (await Promise.all(recent.map(async (race) => {
    try {
      const cacheKey = `${year}:${race.rnd}`;
      const cached = recentDriverResultsCache.get(cacheKey);
      if (cached && Date.now() - cached.createdAt < RECENT_DRIVER_RESULTS_CACHE_MS) return cached.race;
      const json = await requestMaybeOpenF1Json(driverResultsUrl(year, race.rnd));
      const race = (json?.MRData?.RaceTable?.Races || json?.RaceTable?.Races || [])[0] || null;
      if (race) recentDriverResultsCache.set(cacheKey, { createdAt: Date.now(), race });
      return race;
    } catch {
      return null;
    }
  }))).filter((race) => Array.isArray(race?.Results) && race.Results.length);
  return races.length ? { MRData: { RaceTable: { Races: races } } } : null;
}

function openF1RaceResultToRecentFormRace(race = {}, sessionResult = [], fallbackDrivers = []) {
  const fallbackByNumber = new Map((fallbackDrivers || []).map((driver) => [Number(driver.num || driver.number), driver]));
  const Results = (sessionResult || [])
    .map((row) => {
      const position = finiteNumber(row?.position);
      const number = finiteNumber(row?.driver_number ?? row?.number ?? row?.num);
      const rawCode = String(row?.name_acronym || row?.driver_code || row?.code || "").trim().toUpperCase();
      const fallback = fallbackByNumber.get(number) || {};
      const code = /^[A-Z]{2,4}$/.test(rawCode) ? rawCode : String(fallback.code || "").trim().toUpperCase();
      if (position == null || !code) return null;
      return {
        position: String(position),
        positionOrder: String(position),
        number: number != null ? String(number) : "",
        Driver: { code },
      };
    })
    .filter(Boolean)
    .sort((a, b) => Number(a.positionOrder) - Number(b.positionOrder));
  if (!Results.length) return null;
  return {
    round: String(race.rnd || race.round || ""),
    raceName: race.name || race.raceName || "Grand Prix",
    Circuit: { Location: { locality: race.loc || race.location || race.circuit || "" } },
    Results,
  };
}

async function fetchRecentOpenF1DriverResults(schedule = [], maxRaces = 5, season = new Date().getFullYear(), fallbackDrivers = [], options = {}) {
  const year = String(season || new Date().getFullYear()).replace(/[^0-9]/g, "") || String(new Date().getFullYear());
  const recent = (schedule || [])
    .filter((race) => String(race?.status || "").toLowerCase() === "done" && race?.meetingKey)
    .slice(-Math.max(1, Number(maxRaces) || 5));
  if (!recent.length) return null;
  const races = (await Promise.all(recent.map(async (race) => {
    try {
      const cacheKey = `openf1:${year}:${race.meetingKey}`;
      const cached = recentDriverResultsCache.get(cacheKey);
      if (cached && Date.now() - cached.createdAt < RECENT_DRIVER_RESULTS_CACHE_MS) return cached.race;
      const analytics = await getAnalyticsSession({ season: year, meetingKey: race.meetingKey, sessionKind: "Race", scope: "leaderboard", priority: options.priority });
      const shapedRace = openF1RaceResultToRecentFormRace(race, analytics?.drivers, fallbackDrivers);
      if (shapedRace) recentDriverResultsCache.set(cacheKey, { createdAt: Date.now(), race: shapedRace });
      return shapedRace;
    } catch {
      return null;
    }
  }))).filter((race) => Array.isArray(race?.Results) && race.Results.length);
  return races.length ? { MRData: { RaceTable: { Races: races } } } : null;
}

function fallbackDriverName(fallbackDrivers, code, number) {
  const normalizedCode = String(code || "").trim().toUpperCase();
  const numeric = Number(number);
  const fallback = (fallbackDrivers || []).find((driver) => (
    normalizedCode && String(driver.code || "").trim().toUpperCase() === normalizedCode
  ) || (
    Number.isFinite(numeric) && Number(driver.num) === numeric
  ));
  return String(fallback?.name || "").trim();
}

function raceWinnerName(result, fallbackDrivers = []) {
  result = result || {};
  const driver = result.Driver || {};
  const fallback = fallbackDriverName(fallbackDrivers, driver.code, driver.permanentNumber || result.number);
  return fallback
    || [driver.givenName, driver.familyName].filter(Boolean).join(" ").trim()
    || String(driver.code || driver.driverId || result.number || "").trim();
}

function parseRaceWinners(json, fallbackDrivers = []) {
  return (json?.MRData?.RaceTable?.Races || json?.RaceTable?.Races || [])
    .map((race) => {
      const winnerResult = (race.Results || []).find((result) => String(result.positionOrder || result.position || "") === "1") || race.Results?.[0];
      const winner = raceWinnerName(winnerResult, fallbackDrivers);
      return {
        rnd: Number(race.round || 0),
        name: race.raceName || "Grand Prix",
        winner,
      };
    })
    .filter((race) => race.winner);
}

function applyScheduleWinners(schedule = [], raceWinners = []) {
  const byRound = new Map();
  const byName = new Map();
  const byMeeting = new Map();
  for (const row of raceWinners || []) {
    if (row.rnd) byRound.set(Number(row.rnd), row.winner);
    if (row.meetingKey) byMeeting.set(String(row.meetingKey), row.winner);
    const nameKey = compactText(row.name);
    if (nameKey) byName.set(nameKey, row.winner);
  }
  return (schedule || []).map((race) => {
    if (race.winner || race.status !== "done") return race;
    const winner = byMeeting.get(String(race.meetingKey || "")) || byName.get(compactText(race.name)) || byRound.get(Number(race.rnd));
    return winner ? { ...race, winner } : race;
  });
}

function scheduleWinnerCount(schedule = []) {
  return (schedule || []).filter((race) => race && race.winner).length;
}

// Winners already resolved on a schedule, in the shape applyScheduleWinners expects — used to
// carry them forward into freshly built snapshots so they survive cache refreshes and restarts.
function scheduleWinners(schedule = []) {
  return (schedule || [])
    .filter((race) => race && race.winner)
    .map((race) => ({ rnd: race.rnd, meetingKey: race.meetingKey, name: race.name, winner: race.winner }));
}

function priorScheduleWinners() {
  return scheduleWinners(liveDataCache?.data?.schedule);
}

function seasonRaceWinnersUrl() {
  return `${JOLPICA_ERGAST_BASE_URL}/current/results/1.json?limit=100`;
}

// One request returns every round's winner for the current season — far faster than fanning out a
// per-round (or per-session OpenF1) lookup. Cached like the other recent-results data.
async function fetchSeasonRaceWinners() {
  const cacheKey = "__season_winners__";
  const cached = recentDriverResultsCache.get(cacheKey);
  if (cached && Date.now() - cached.createdAt < RECENT_DRIVER_RESULTS_CACHE_MS) return cached.race;
  try {
    const json = await requestMaybeOpenF1Json(seasonRaceWinnersUrl());
    const races = (json?.MRData?.RaceTable?.Races || json?.RaceTable?.Races || [])
      .filter((race) => Array.isArray(race?.Results) && race.Results.length);
    const out = races.length ? { MRData: { RaceTable: { Races: races } } } : null;
    if (out) recentDriverResultsCache.set(cacheKey, { createdAt: Date.now(), race: out });
    return out;
  } catch {
    return null;
  }
}

function openF1RaceWinnerName(result, openDrivers, fallbackDrivers) {
  result = result || {};
  const number = Number(result.driver_number);
  const openDriver = (openDrivers || []).find((driver) => Number(driver.driver_number) === number);
  const fallback = fallbackDriverName(fallbackDrivers, openDriver?.name_acronym || result.name_acronym, number);
  return String(fallback || openDriver?.full_name || result.driver_name || result.name_acronym || number || "").trim();
}

async function fetchMissingOpenF1RaceWinners(schedule, season, fallbackDrivers, options = {}) {
  const missing = (schedule || [])
    .filter((race) => race?.status === "done" && !race.winner && race.meetingKey)
    .slice(0, 8);
  const winners = await Promise.all(missing.map(async (race) => {
    const cacheKey = `${season || "current"}:${race.meetingKey}`;
    const cached = raceWinnerCache.get(cacheKey);
    if (cached?.winner && Date.now() - cached.createdAt < RACE_WINNER_CACHE_MS) return cached.winner;
    try {
      const session = await resolveAnalyticsSession({ season, meetingKey: race.meetingKey, sessionKind: "Race", priority: options.priority });
      const sessionKey = finiteNumber(session?.session_key);
      if (!sessionKey) return null;
      const sessionResult = await requestOpenF1AnalyticsWithRetry("sessionResult", { session_key: sessionKey }, { priority: options.priority });
      const winnerResult = (sessionResult || []).find((row) => Number(row.position) === 1) || sessionResult?.[0];
      const winner = openF1RaceWinnerName(winnerResult, [], fallbackDrivers);
      const row = winner ? { meetingKey: race.meetingKey, name: race.name, winner } : null;
      if (row) raceWinnerCache.set(cacheKey, { createdAt: Date.now(), winner: row });
      if (raceWinnerCache.size > 32) raceWinnerCache = new Map(Array.from(raceWinnerCache.entries()).slice(-24));
      return row;
    } catch {
      return null;
    }
  }));
  return winners.filter(Boolean);
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

function isCancelledF12026RaceName(value) {
  const text = compactText(value);
  return /\bbahrain grand prix\b/.test(text) || /\bsaudi arabian grand prix\b/.test(text);
}

function parseSchedule(json, openF1Meetings = []) {
  const races = json?.MRData?.RaceTable?.Races || [];
  const explicitSeason = String(json?.MRData?.RaceTable?.season || json?.MRData?.season || "");
  const inferredSeason = races.map((race) => Date.parse(sessionDate(race))).find(Number.isFinite);
  const season = explicitSeason || (Number.isFinite(inferredSeason) ? String(new Date(inferredSeason).getUTCFullYear()) : "");
  const now = Date.now();
  const activeMeetings = (openF1Meetings || [])
    .filter((meeting) => /grand prix/i.test(String(meeting?.meeting_name || "")) && Number.isFinite(Date.parse(meeting?.date_start || "")))
    .filter((meeting) => season !== "2026" || !isCancelledF12026RaceName(meeting?.meeting_name || meeting?.official_name || ""))
    .sort((a, b) => Date.parse(a.date_start || "") - Date.parse(b.date_start || ""));
  const shouldUseActiveMeetingOrder = races.length > 0 && activeMeetings.length >= Math.max(1, Math.floor(races.length * 0.7));
  const activeRoundByMeetingKey = new Map(activeMeetings.map((meeting, index) => [String(meeting.meeting_key || ""), index + 1]));
  const parsed = races.filter((race) => season !== "2026" || !isCancelledF12026RaceName(race?.raceName || "")).map((race) => {
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
    const meetingKey = meeting?.meeting_key || null;
    return {
      rnd: shouldUseActiveMeetingOrder && meetingKey ? activeRoundByMeetingKey.get(String(meetingKey)) || Number(race.round) : Number(race.round),
      name: race.raceName,
      circuit: race.Circuit?.circuitName || "",
      loc: [race.Circuit?.Location?.locality, race.Circuit?.Location?.country].filter(Boolean).join(", "),
      date: Number.isFinite(raceDate) ? new Intl.DateTimeFormat("en", { month: "short", day: "2-digit" }).format(raceDate) : "",
      startsAt: Number.isFinite(raceDate) ? new Date(raceDate).toISOString() : "",
      status: live ? "live" : done ? "done" : "upcoming",
      meetingKey,
      sessions,
    };
  });
  if (!shouldUseActiveMeetingOrder) return parsed;
  return normalizeScheduleRoundOrder(parsed, { removeCancelled2026: season === "2026" });
}

function scheduleHas2026Dates(schedule = []) {
  return (schedule || []).some((race) => {
    const startsAt = Date.parse(race?.startsAt || race?.dateStart || race?.date_start || "");
    return Number.isFinite(startsAt) && new Date(startsAt).getUTCFullYear() === 2026;
  });
}

function snapshotIs2026Schedule(data = {}) {
  const season = finiteNumber(data?.seasonSummary?.year || data?.seasonSummary?.season || data?.season);
  if (season) return season === 2026;
  return scheduleHas2026Dates(data?.schedule);
}

function normalizeScheduleRoundOrder(schedule = [], options) {
  options = options || {};
  const rows = Array.isArray(schedule) ? schedule.slice() : [];
  const hasCancelled2026Rows = options.removeCancelled2026 === true && rows.some((race) => isCancelledF12026RaceName(race?.name || race?.raceName || ""));
  const eligibleRows = hasCancelled2026Rows ? rows.filter((race) => !isCancelledF12026RaceName(race?.name || race?.raceName || "")) : rows;
  const matched = eligibleRows.filter((race) => race?.meetingKey);
  if (hasCancelled2026Rows) return eligibleRows.map((race, index) => ({ ...race, rnd: index + 1 }));
  if (!rows.length || matched.length < Math.max(1, Math.floor(rows.length * 0.7))) return rows;
  return eligibleRows.map((race, index) => ({ ...race, rnd: index + 1 }));
}

function normalizePitWallSnapshotRounds(data) {
  if (!data || !Array.isArray(data.schedule)) return data;
  const schedule = normalizeScheduleRoundOrder(data.schedule, { removeCancelled2026: snapshotIs2026Schedule(data) });
  if (schedule === data.schedule) return data;
  const currentRace = schedule.find((race) => data.race?.startsAt && race.startsAt === data.race.startsAt)
    || schedule.find((race) => data.race?.name && race.name === data.race.name)
    || schedule.find((race) => race.status === "live")
    || schedule.find((race) => race.status === "upcoming")
    || schedule.at(-1);
  return {
    ...data,
    schedule,
    sessions: currentRace?.sessions || data.sessions || [],
    race: data.race ? { ...data.race, round: currentRace?.rnd || data.race.round || 0 } : data.race,
    seasonSummary: data.seasonSummary ? { ...data.seasonSummary, round: currentRace?.rnd || data.seasonSummary.round || 0, totalRounds: schedule.length || data.seasonSummary.totalRounds || 0 } : data.seasonSummary,
  };
}

function openF1SessionKindLabel(session) {
  const normalized = normalizeOpenF1SessionKind(session?.session_name || session?.session_type);
  if (normalized === "practice 1") return "Practice 1";
  if (normalized === "practice 2") return "Practice 2";
  if (normalized === "practice 3") return "Practice 3";
  if (normalized === "sprint qualifying") return "Sprint Shootout";
  if (normalized === "qualifying") return "Qualifying";
  if (normalized === "sprint") return "Sprint";
  if (normalized === "race") return "Race";
  return String(session?.session_name || session?.session_type || "Session").trim() || "Session";
}

function parseOpenF1Schedule(openF1Meetings = [], openF1Sessions = [], nowMs = Date.now()) {
  const sessionsByMeeting = new Map();
  for (const session of openF1Sessions || []) {
    const key = String(session?.meeting_key || "");
    if (!key) continue;
    if (!sessionsByMeeting.has(key)) sessionsByMeeting.set(key, []);
    sessionsByMeeting.get(key).push(session);
  }
  return (openF1Meetings || [])
    .filter((meeting) => /grand prix/i.test(String(meeting?.meeting_name || "")))
    .sort((a, b) => Date.parse(a.date_start || "") - Date.parse(b.date_start || ""))
    .map((meeting, index) => {
      const meetingKey = String(meeting.meeting_key || "");
      const sourceSessions = (sessionsByMeeting.get(meetingKey) || [])
        .slice()
        .sort((a, b) => Date.parse(a.date_start || "") - Date.parse(b.date_start || ""));
      const sessions = sourceSessions.map((session) => {
        const start = Date.parse(session.date_start || "");
        const end = Date.parse(session.date_end || "");
        const doneAt = Number.isFinite(end) ? end : start;
        const live = Number.isFinite(start) && Number.isFinite(doneAt) && start <= nowMs && nowMs <= doneAt;
        return {
          kind: openF1SessionKindLabel(session),
          day: Number.isFinite(start) ? new Intl.DateTimeFormat("en", { weekday: "short" }).format(start) : "",
          time: Number.isFinite(start) ? new Intl.DateTimeFormat("en", { hour: "2-digit", minute: "2-digit" }).format(start) : "",
          startsAt: Number.isFinite(start) ? new Date(start).toISOString() : "",
          endsAt: Number.isFinite(end) ? new Date(end).toISOString() : "",
          status: live ? "live" : Number.isFinite(doneAt) && nowMs > doneAt ? "done" : "upcoming",
          meetingKey,
          sessionKey: String(session.session_key || ""),
        };
      });
      const raceSession = sourceSessions.find((session) => normalizeOpenF1SessionKind(session.session_name || session.session_type) === "race") || sourceSessions.at(-1);
      const firstStart = Math.min(...sourceSessions.map((session) => Date.parse(session.date_start || "")).filter(Number.isFinite));
      const raceStart = Date.parse(raceSession?.date_start || meeting.date_start || "");
      const lastEnd = Math.max(...sourceSessions.map((session) => {
        const end = Date.parse(session.date_end || "");
        const start = Date.parse(session.date_start || "");
        return Number.isFinite(end) ? end : start;
      }).filter(Number.isFinite));
      const live = sessions.some((session) => session.status === "live");
      const done = sessions.length
        ? sessions.every((session) => session.status === "done")
        : Number.isFinite(raceStart) && raceStart < nowMs;
      return {
        rnd: index + 1,
        name: meeting.meeting_name || "Grand Prix",
        circuit: meeting.circuit_short_name || "",
        loc: [meeting.location, meeting.country_name].filter(Boolean).join(", "),
        date: Number.isFinite(raceStart) ? new Intl.DateTimeFormat("en", { month: "short", day: "2-digit" }).format(raceStart) : "",
        startsAt: Number.isFinite(raceStart) ? new Date(raceStart).toISOString() : "",
        endsAt: Number.isFinite(lastEnd) ? new Date(lastEnd).toISOString() : "",
        status: live ? "live" : done ? "done" : "upcoming",
        meetingKey: meeting.meeting_key || null,
        sessions,
      };
    });
}

function f1TvCmsSeasonPageUrl(year) {
  const pageId = F1TV_SEASON_PAGE_IDS[String(year)] || F1TV_SEASON_PAGE_IDS[String(new Date().getFullYear())] || "395";
  return `https://f1tv.formula1.com/2.0/R/ENG/${F1TV_CMS_FORMAT}/ALL/PAGE/${pageId}/${F1TV_CMS_ENTITLEMENT}/${F1TV_CMS_GROUP_ID}`;
}

function f1TvCmsUrl(uri) {
  return new URL(String(uri || ""), F1TV_HOME_URL).href;
}

function f1TvCmsTimeIso(value) {
  if (value == null || value === "") return "";
  const numeric = Number(value);
  const time = Number.isFinite(numeric) && String(value).trim() !== ""
    ? (numeric < 100000000000 ? numeric * 1000 : numeric)
    : Date.parse(String(value));
  return Number.isFinite(time) ? new Date(time).toISOString() : "";
}

function normalizeF1TvCmsSessionKind(value) {
  const normalized = normalizeOpenF1SessionKind(value);
  return normalized || String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function normalizeF1TvCmsContentItem(item = {}) {
  const metadata = item.metadata || item.contentMetadata || item;
  const attrs = metadata.emfAttributes || item.emfAttributes || {};
  const contentSubtype = String(metadata.contentSubtype || metadata.objectSubtype || attrs.ContentSubtype || attrs.contentSubtype || "").trim().toUpperCase();
  const status = contentSubtype === "LIVE" ? "live" : contentSubtype === "REPLAY" ? "done" : "";
  if (!status) return null;
  const sessionKind = normalizeF1TvCmsSessionKind([
    attrs.Global_Title,
    attrs.globalTitle,
    attrs.MeetingSessionName,
    attrs.Session_Name,
    attrs.sessionName,
    metadata.titleBrief,
    metadata.title,
    item.title,
  ].filter(Boolean).join(" "));
  const meetingKey = String(attrs.MeetingKey || attrs.meetingKey || attrs.Meeting_Key || metadata.meetingKey || item.meetingKey || "").trim();
  if (!meetingKey || !sessionKind) return null;
  return {
    meetingKey,
    sessionKey: String(attrs.MeetingSessionKey || attrs.sessionKey || attrs.SessionKey || metadata.sessionKey || item.sessionKey || "").trim(),
    sessionKind,
    status,
    statusSource: "f1tv-cms",
    contentSubtype,
    contentId: String(metadata.contentId || item.contentId || item.id || "").trim(),
    startsAt: f1TvCmsTimeIso(attrs.sessionStartDate || attrs.Session_Start_Date || attrs.MeetingSessionStartDate || metadata.startDate || item.startDate),
    endsAt: f1TvCmsTimeIso(attrs.sessionEndDate || attrs.Session_End_Date || attrs.MeetingSessionEndDate || metadata.endDate || item.endDate),
  };
}

function f1TvCmsContentItemsFromPage(page = {}) {
  const items = [];
  const seen = new Set();
  const stack = [{ value: page, depth: 0 }];
  while (stack.length) {
    const { value, depth } = stack.pop();
    if (!value || depth > 9) continue;
    if (Array.isArray(value)) {
      value.forEach((entry) => stack.push({ value: entry, depth: depth + 1 }));
      continue;
    }
    if (typeof value !== "object") continue;
    const normalized = normalizeF1TvCmsContentItem(value);
    if (normalized) {
      const key = `${normalized.contentId || normalized.meetingKey}:${normalized.sessionKey || normalized.sessionKind}:${normalized.contentSubtype}`;
      if (!seen.has(key)) {
        seen.add(key);
        items.push(value);
      }
    }
    Object.values(value).forEach((entry) => {
      if (entry && typeof entry === "object") stack.push({ value: entry, depth: depth + 1 });
    });
  }
  return items;
}

function f1TvCmsDetailPageUrisFromPage(page = {}) {
  const uris = [];
  const seen = new Set();
  const stack = [{ value: page, depth: 0 }];
  while (stack.length) {
    const { value, depth } = stack.pop();
    if (!value || depth > 9) continue;
    if (Array.isArray(value)) {
      value.forEach((entry) => stack.push({ value: entry, depth: depth + 1 }));
      continue;
    }
    if (typeof value !== "object") continue;
    const actions = Array.isArray(value.actions) ? value.actions : value.actions ? [value.actions] : [];
    actions.forEach((action) => {
      const uri = String(action?.uri || "").trim();
      if (uri && /\/PAGE\/\d+\//.test(uri) && String(action?.targetType || "").toUpperCase() === "DETAILS_PAGE" && !seen.has(uri)) {
        seen.add(uri);
        uris.push(uri);
      }
    });
    Object.values(value).forEach((entry) => {
      if (entry && typeof entry === "object") stack.push({ value: entry, depth: depth + 1 });
    });
  }
  return uris.slice(0, F1TV_CMS_DETAIL_PAGE_LIMIT);
}

async function fetchF1TvCmsJson(targetUrl, headers, timeoutMs = 6500) {
  const response = await requestBuffer(targetUrl, { headers, timeoutMs });
  if (response.status < 200 || response.status >= 300) {
    throw new Error(`F1 TV CMS metadata unavailable (${response.status || "network"}).`);
  }
  try {
    return JSON.parse(response.body.toString("utf8"));
  } catch {
    throw new Error("F1 TV CMS metadata was not valid JSON.");
  }
}

async function fetchF1TvCmsSeasonContent(year) {
  const headers = { Accept: "application/json, text/plain, */*" };
  const playbackToken = await getF1TvPlaybackToken().catch(() => "");
  Object.assign(headers, f1TvPlaybackHeaders(playbackToken));
  const page = await fetchF1TvCmsJson(f1TvCmsSeasonPageUrl(year), headers);
  const detailDeadlineMs = Date.now() + F1TV_CMS_DETAIL_DEADLINE_MS;
  const detailItems = await mapWithConcurrencyStableDeadline(
    f1TvCmsDetailPageUrisFromPage(page),
    F1TV_CMS_DETAIL_CONCURRENCY,
    detailDeadlineMs,
    async (uri, _index, remainingMs) => {
      try {
        return {
          status: "fulfilled",
          value: f1TvCmsContentItemsFromPage(
            await fetchF1TvCmsJson(
              f1TvCmsUrl(uri),
              headers,
              Math.max(1, Math.min(F1TV_CMS_DETAIL_TIMEOUT_MS, remainingMs)),
            ),
          ),
        };
      } catch (reason) {
        return { status: "rejected", reason };
      }
    },
  );
  return f1TvCmsContentItemsFromPage(page).concat(
    detailItems.flatMap((result) => result.status === "fulfilled" ? result.value : [])
  );
}

function applyF1TvCmsLibraryMetadata(library = {}, cmsItems = [], nowMs = Date.now()) {
  void nowMs;
  const normalizedItems = (cmsItems || []).map(normalizeF1TvCmsContentItem).filter(Boolean);
  if (!normalizedItems.length || !Array.isArray(library.races)) return library;
  const itemsByMeeting = new Map();
  normalizedItems.forEach((item) => {
    if (!itemsByMeeting.has(item.meetingKey)) itemsByMeeting.set(item.meetingKey, []);
    itemsByMeeting.get(item.meetingKey).push(item);
  });
  const races = library.races.map((race) => {
    const raceItems = itemsByMeeting.get(String(race.meetingKey || "").trim());
    if (!raceItems?.length || !Array.isArray(race.sessions)) return race;
    const itemsBySessionKey = new Map();
    const itemsByKind = new Map();
    raceItems.forEach((item) => {
      const key = normalizeOpenF1SessionKind(item.sessionKind);
      if (item.sessionKey) itemsBySessionKey.set(String(item.sessionKey), item);
      const existing = itemsByKind.get(key);
      if (!existing || item.status === "live" || existing.status !== "live") itemsByKind.set(key, item);
    });
    const sessions = race.sessions.map((sessionItem) => {
      const sessionKey = String(sessionItem.sessionKey || sessionItem.session_key || "");
      const item = sessionKey
        ? itemsBySessionKey.get(sessionKey)
        : itemsByKind.get(normalizeOpenF1SessionKind(sessionItem.kind || sessionItem.session_name || sessionItem.session_type));
      if (!item) return sessionItem;
      return {
        ...sessionItem,
        status: item.status,
        statusSource: item.statusSource,
        f1TvStatus: item.status,
        contentSubtype: item.contentSubtype,
        contentId: item.contentId || sessionItem.contentId || "",
        sessionKey: item.sessionKey || sessionItem.sessionKey || "",
        startsAt: sessionItem.startsAt || item.startsAt || "",
        endsAt: sessionItem.endsAt || item.endsAt || "",
      };
    });
    const status = sessions.some((sessionItem) => sessionItem.status === "live")
      ? "live"
      : sessions.some((sessionItem) => sessionItem.status === "upcoming")
        ? "upcoming"
        : sessions.length && sessions.every((sessionItem) => sessionItem.status === "done")
          ? "done"
          : race.status;
    return { ...race, status, sessions };
  });
  return {
    ...library,
    source: String(library.source || "").includes("F1TV") ? library.source : `${library.source || "OpenF1"}+F1TV`,
    races,
  };
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
  if (/blue|pit|out\s?lap/.test(text)) return "blue";
  if (/yellow|normal/.test(text)) return "yellow";
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) return "off";
  if (number === 2051 || number === 2068) return "purple";
  if (number === 2064) return "blue";
  if (number === 2049 || number === 2053) return "green";
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

function openF1SectorTimes(lap) {
  return {
    s1: finiteNumber(lap?.duration_sector_1),
    s2: finiteNumber(lap?.duration_sector_2),
    s3: finiteNumber(lap?.duration_sector_3),
  };
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
      sectorTimes: openF1SectorTimes(latestLap),
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
    sectorTimes: { s1: null, s2: null, s3: null },
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
      remoteImage: fallback.remoteImage || driver.headshot_url || "",
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

function f1TimingSignalRCookieFromHeaders(headers = {}) {
  const raw = headers["set-cookie"] || [];
  const lines = Array.isArray(raw) ? raw : [raw];
  return lines
    .map((line) => String(line || "").split(";")[0].trim())
    .find((cookie) => /^AWSALBCORS=/i.test(cookie)) || "";
}

function requestF1TimingSignalRCookie(targetUrl = F1_TIMING_NEGOTIATE_URL, timeout = 10000) {
  return new Promise((resolve) => {
    const endpoint = new URL(targetUrl);
    const req = https.request({
      method: "OPTIONS",
      hostname: endpoint.hostname,
      path: `${endpoint.pathname}${endpoint.search}`,
      headers: f1TimingHeaders(),
      timeout,
    }, (res) => {
      res.resume();
      res.on("end", () => resolve(f1TimingSignalRCookieFromHeaders(res.headers)));
    });
    req.on("timeout", () => req.destroy(new Error("Timeout for Formula 1 live timing SignalR preflight")));
    req.on("error", () => resolve(""));
    req.end();
  });
}

function encodeF1TimingWebSocketFrame(data, opcode = 0x1) {
  const payload = Buffer.isBuffer(data) ? data : Buffer.from(String(data || ""), "utf8");
  const mask = randomBytes(4);
  let header;
  if (payload.length <= 125) {
    header = Buffer.from([0x80 | opcode, 0x80 | payload.length]);
  } else if (payload.length <= 65535) {
    header = Buffer.alloc(4);
    header[0] = 0x80 | opcode;
    header[1] = 0x80 | 126;
    header.writeUInt16BE(payload.length, 2);
  } else {
    header = Buffer.alloc(10);
    header[0] = 0x80 | opcode;
    header[1] = 0x80 | 127;
    header.writeBigUInt64BE(BigInt(payload.length), 2);
  }
  const masked = Buffer.alloc(payload.length);
  for (let index = 0; index < payload.length; index += 1) masked[index] = payload[index] ^ mask[index % 4];
  return Buffer.concat([header, mask, masked]);
}

function createF1TimingWebSocket(targetUrl, headers = {}, timeout = 15000) {
  const endpoint = new URL(targetUrl);
  const client = {
    readyState: 0,
    onopen: null,
    onmessage: null,
    onerror: null,
    onclose: null,
    send(data) {
      if (client.readyState !== 1) throw new Error("Formula 1 live timing WebSocket is not open.");
      socket.write(encodeF1TimingWebSocketFrame(data, 0x1));
    },
    close() {
      if (client.readyState >= 2) return;
      client.readyState = 2;
      try { socket.write(encodeF1TimingWebSocketFrame(Buffer.alloc(0), 0x8)); } catch {}
      socket.end();
    },
  };
  const key = randomBytes(16).toString("base64");
  let buffer = Buffer.alloc(0);
  let fragmented = [];
  let opened = false;
  let closed = false;
  const socket = tls.connect({
    host: endpoint.hostname,
    port: Number(endpoint.port || 443),
    servername: endpoint.hostname,
  });
  const openTimer = setTimeout(() => socket.destroy(new Error("Timeout for Formula 1 live timing WebSocket")), timeout);

  function emitError(error) {
    try { client.onerror?.(error); } catch {}
  }

  function emitClose(code = 0, reason = "") {
    if (closed) return;
    closed = true;
    clearTimeout(openTimer);
    client.readyState = 3;
    try { client.onclose?.({ code, reason }); } catch {}
  }

  function emitMessage(data) {
    try { client.onmessage?.({ data }); } catch {}
  }

  function parseFrames() {
    while (buffer.length >= 2) {
      const first = buffer[0];
      const second = buffer[1];
      const fin = Boolean(first & 0x80);
      const opcode = first & 0x0f;
      const masked = Boolean(second & 0x80);
      let length = second & 0x7f;
      let offset = 2;
      if (length === 126) {
        if (buffer.length < offset + 2) return;
        length = buffer.readUInt16BE(offset);
        offset += 2;
      } else if (length === 127) {
        if (buffer.length < offset + 8) return;
        const largeLength = buffer.readBigUInt64BE(offset);
        if (largeLength > BigInt(Number.MAX_SAFE_INTEGER)) {
          socket.destroy(new Error("Formula 1 live timing WebSocket frame is too large."));
          return;
        }
        length = Number(largeLength);
        offset += 8;
      }
      if (masked) {
        socket.destroy(new Error("Formula 1 live timing WebSocket server sent a masked frame."));
        return;
      }
      if (buffer.length < offset + length) return;
      const payload = buffer.slice(offset, offset + length);
      buffer = buffer.slice(offset + length);

      if (opcode === 0x8) {
        const code = payload.length >= 2 ? payload.readUInt16BE(0) : 0;
        const reason = payload.length > 2 ? payload.slice(2).toString("utf8") : "";
        try { socket.write(encodeF1TimingWebSocketFrame(Buffer.alloc(0), 0x8)); } catch {}
        socket.end();
        emitClose(code, reason);
        return;
      }
      if (opcode === 0x9) {
        try { socket.write(encodeF1TimingWebSocketFrame(payload, 0xA)); } catch {}
        continue;
      }
      if (opcode === 0xA) continue;
      if (opcode === 0x1 || opcode === 0x2 || opcode === 0x0) {
        fragmented.push(payload);
        if (fin) {
          const message = Buffer.concat(fragmented);
          fragmented = [];
          emitMessage(opcode === 0x2 ? message : message.toString("utf8"));
        }
      }
    }
  }

  socket.on("secureConnect", () => {
    const requestHeaders = [
      `GET ${endpoint.pathname}${endpoint.search} HTTP/1.1`,
      `Host: ${endpoint.host}`,
      "Upgrade: websocket",
      "Connection: Upgrade",
      `Sec-WebSocket-Key: ${key}`,
      "Sec-WebSocket-Version: 13",
      "User-Agent: BestHTTP",
      ...Object.entries(headers || {}).filter(([, value]) => value).map(([name, value]) => `${name}: ${value}`),
    ];
    socket.write(`${requestHeaders.join("\r\n")}\r\n\r\n`);
  });

  socket.on("data", (chunk) => {
    buffer = Buffer.concat([buffer, Buffer.from(chunk)]);
    if (!opened) {
      const headerEnd = buffer.indexOf("\r\n\r\n");
      if (headerEnd === -1) return;
      const head = buffer.slice(0, headerEnd).toString("latin1");
      buffer = buffer.slice(headerEnd + 4);
      const status = Number((head.match(/^HTTP\/\d(?:\.\d)?\s+(\d+)/i) || [])[1] || 0);
      const accept = (head.match(/\r\nsec-websocket-accept:\s*([^\r\n]+)/i) || [])[1] || "";
      const expectedAccept = createHash("sha1").update(`${key}258EAFA5-E914-47DA-95CA-C5AB0DC85B11`).digest("base64");
      if (status !== 101 || accept.trim() !== expectedAccept) {
        socket.destroy(new Error(`Formula 1 live timing WebSocket handshake failed (${status || "no status"}).`));
        return;
      }
      opened = true;
      clearTimeout(openTimer);
      client.readyState = 1;
      try { client.onopen?.(); } catch {}
    }
    parseFrames();
  });

  socket.on("error", emitError);
  socket.on("close", () => emitClose());
  return client;
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

function f1TimingArchiveIdentityFromOptions(options = {}, sessionKind = "Race") {
  const raceName = String(options.raceName || options.eventName || "").trim();
  const raceStartsAt = String(options.raceStartsAt || options.startsAt || "").trim();
  if (!raceName || !raceStartsAt) return null;
  const sessionStartsAt = String(options.sessionStartsAt || raceStartsAt).trim();
  const year = String(options.season || f1TimingDatePart(raceStartsAt).slice(0, 4) || new Date().getFullYear());
  return {
    meeting: {
      year,
      meeting_name: raceName,
      date_start: raceStartsAt,
      date_end: raceStartsAt,
    },
    session: {
      year,
      session_name: sessionKind,
      session_type: sessionKind,
      date_start: sessionStartsAt,
      date_end: sessionStartsAt,
    },
  };
}

function stripJsonBom(text) {
  return String(text || "").replace(/^\uFEFF/, "").replace(/^\u00EF\u00BB\u00BF/, "");
}

function f1TimingSeconds(value) {
  const match = String(value || "").match(/^(\d+):(\d+):(\d+(?:\.\d+)?)$/);
  return match ? Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3]) : 0;
}

function preserveDeletedF1TimingLine(line) {
  if (!line || typeof line !== "object" || Array.isArray(line)) return false;
  const statusText = [
    line.Status,
    line.status,
    line.Reason,
    line.reason,
    line.Retired ? "RETIRED" : "",
    line.Stopped ? "STOP" : "",
  ].map((value) => String(value || "").trim().toUpperCase()).filter(Boolean).join(" ");
  return /\b(DNF|RETIRED|RET|STOPPED|STOP)\b/.test(statusText);
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

function parseF1TimingJsonStreamPreview(text, maxEntries = 2) {
  return stripJsonBom(text).split(/\r?\n/)
    .filter(Boolean)
    .slice(0, Math.max(1, Number(maxEntries || 2)))
    .map((line) => {
      const time = line.slice(0, 12);
      return { time, seconds: f1TimingSeconds(time), data: {} };
    });
}

function f1TimingRequestJsonStreamEntries(targetUrl, options = {}) {
  const targetSeconds = finiteNumber(options.targetSeconds);
  const stopSeconds = targetSeconds == null ? Infinity : targetSeconds + Number(options.bufferSeconds ?? 2);
  return new Promise((resolve, reject) => {
    const endpoint = new URL(targetUrl);
    const entries = [];
    let pending = "";
    let settled = false;
    const finish = (value) => {
      if (settled) return;
      settled = true;
      resolve(value);
    };
    const fail = (error) => {
      if (settled) return;
      settled = true;
      reject(error);
    };
    const parseLine = (line) => {
      const clean = stripJsonBom(line).trim();
      if (!clean) return false;
      const seconds = f1TimingSeconds(clean.slice(0, 12));
      if (seconds > stopSeconds) return true;
      const raw = JSON.parse(clean.slice(12));
      entries.push({
        time: clean.slice(0, 12),
        seconds,
        data: options.zipped ? decodeF1TimingZPayload(raw) : raw,
      });
      return false;
    };
    const req = https.get(targetUrl, {
      headers: f1TimingHeaders(),
      timeout: Number(options.timeout || 18000),
    }, (res) => {
      res.setEncoding("utf8");
      if (res.statusCode < 200 || res.statusCode >= 300) {
        res.resume();
        fail(new Error(`HTTP ${res.statusCode} ${endpoint.pathname}`));
        return;
      }
      res.on("data", (chunk) => {
        if (settled) return;
        pending += chunk;
        const lines = pending.split(/\r?\n/);
        pending = lines.pop() || "";
        for (const line of lines) {
          if (parseLine(line)) {
            finish(entries);
            req.destroy();
            return;
          }
        }
      });
      res.on("end", () => {
        if (!settled && pending) parseLine(pending);
        finish(entries);
      });
    });
    req.on("timeout", () => req.destroy(new Error(`Timeout ${endpoint.pathname}`)));
    req.on("error", (error) => {
      if (settled && /aborted|socket hang up/i.test(error?.message || "")) return;
      fail(error);
    });
  });
}

function f1TimingBlankTimingValue(path, field, previous, value) {
  const names = (path || []).map((item) => String(item));
  const parent = names.at(-1) || "";
  const fieldName = String(field || "");
  const timingField = fieldName === "LastLapTime"
    || fieldName === "BestLapTime"
    || fieldName === "PersonalBestLapTime"
    || (["Value", "value", "Time", "time"].includes(fieldName) && (
      parent === "LastLapTime"
        || parent === "BestLapTime"
        || parent === "PersonalBestLapTime"
        || names.includes("BestSectors")
    ));
  if (!timingField) return false;
  const textValue = (item) => {
    if (item && typeof item === "object" && !Array.isArray(item)) {
      return String(item.Value ?? item.value ?? item.Time ?? item.time ?? "");
    }
    return String(item ?? "");
  };
  return !textValue(value).trim() && Boolean(textValue(previous).trim());
}

function f1TimingSegmentMapFromValue(value) {
  if (!value || typeof value !== "object") return {};
  if (Array.isArray(value)) {
    return Object.fromEntries(value.map((item, index) => [String(index), item]).filter(([, item]) => item != null));
  }
  return { ...value };
}

function mergeF1TimingSegmentMap(target, source, path = []) {
  // F1 interleaves full Segments arrays with sparse { "3": { Status } } objects.
  // Treating an object delta as a plain object against an array target used to
  // wipe the array (next = {}) and leave only the sparse keys — greys / holes.
  const previous = f1TimingSegmentMapFromValue(target);
  const incoming = f1TimingSegmentMapFromValue(source);
  const merged = { ...previous };
  for (const [index, value] of Object.entries(incoming)) {
    if (value && typeof value === "object" && !Array.isArray(value)) {
      merged[index] = mergeF1TimingDelta(previous[index], value, index, path.concat(index));
    } else {
      merged[index] = value;
    }
  }
  return merged;
}

function mergeF1TimingDelta(target, source, key = "", path = []) {
  if (!source || typeof source !== "object") return source;
  if (key === "Segments" || key === "segments") {
    return mergeF1TimingSegmentMap(target, source, path);
  }
  if (Array.isArray(source)) {
    if (key === "Stints" && Array.isArray(target)) {
      return Array.from({ length: Math.max(target.length, source.length) }, (_, index) => {
        if (index >= source.length) return target[index];
        const value = source[index];
        return value && typeof value === "object" && !Array.isArray(value)
          ? mergeF1TimingDelta(target[index], value, key, path.concat(String(index)))
          : value;
      }).filter((value) => value !== undefined);
    }
    return source;
  }
  const next = target && typeof target === "object" && !Array.isArray(target) ? { ...target } : {};
  const deleted = Array.isArray(source._deleted) ? new Set(source._deleted) : new Set();
  const preserveInactiveLines = key === "Lines";
  for (const deletedKey of deleted) {
    if (preserveInactiveLines && preserveDeletedF1TimingLine(next[deletedKey])) continue;
    delete next[deletedKey];
  }
  for (const [field, value] of Object.entries(source)) {
    if (field === "_deleted") continue;
    if (field === "Compound" && !String(value || "").trim() && String(next[field] || "").trim()) continue;
    if (f1TimingBlankTimingValue(path, field, next[field], value)) continue;
    if (field === "Segments" || field === "segments") {
      next[field] = mergeF1TimingSegmentMap(next[field], value, path.concat(field));
      continue;
    }
    next[field] = value && typeof value === "object"
      ? mergeF1TimingDelta(next[field], value, field, path.concat(field))
      : value;
  }
  return next;
}

function f1TimingStateAt(entries, targetSeconds) {
  if (!Array.isArray(entries) || !entries.length) return {};
  // Entries are chronological and mergeF1TimingDelta never mutates its inputs,
  // so resume merging from a cached cursor while the target moves forward
  // (every replay poll) instead of re-merging the whole stream from zero.
  // Seeking backwards rebuilds from the start once.
  let cursor = f1TimingStateCursorCache.get(entries);
  if (!cursor || cursor.targetSeconds > targetSeconds) cursor = { index: 0, state: {} };
  let { index, state } = cursor;
  while (index < entries.length && !(entries[index].seconds > targetSeconds)) {
    state = mergeF1TimingDelta(state, entries[index].data);
    index += 1;
  }
  f1TimingStateCursorCache.set(entries, { index, state, targetSeconds });
  return state;
}

function f1TimingStateBetween(entries, startSeconds, targetSeconds) {
  const start = finiteNumber(startSeconds);
  if (!Array.isArray(entries) || !entries.length || start == null) return {};
  let state = {};
  for (const entry of entries) {
    const seconds = finiteNumber(entry?.seconds) ?? 0;
    if (seconds < start) continue;
    if (seconds > targetSeconds) break;
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
  const explicitStartUtcMs = finiteNumber(sessionData?.archiveStartUtcMs);
  if (explicitStartUtcMs != null) return explicitStartUtcMs;
  for (const entry of sessionData?.clockEntries || []) {
    const utcMs = Date.parse(entry?.data?.Utc || "");
    const seconds = finiteNumber(entry?.seconds);
    if (Number.isFinite(utcMs) && seconds != null) return utcMs - seconds * 1000;
  }
  return null;
}

function f1TimingArchiveSecondsForUtc(sessionData, targetUtcMs) {
  const utcMs = finiteNumber(targetUtcMs);
  if (utcMs == null) return null;
  const archiveStartUtcMs = f1TimingArchiveStartUtcMs(sessionData);
  return Number.isFinite(archiveStartUtcMs) ? (utcMs - archiveStartUtcMs) / 1000 : utcMs / 1000;
}

function f1TimingVideoStartArchiveSeconds(sessionData, options) {
  options = options || {};
  const explicitSeconds = finiteNumber(options.videoStartArchiveSeconds);
  if (explicitSeconds != null) return explicitSeconds;
  const videoStartUtcMs = Date.parse(options.videoStartUtc || "");
  const archiveStartUtcMs = f1TimingArchiveStartUtcMs(sessionData);
  if (!Number.isFinite(videoStartUtcMs) || !Number.isFinite(archiveStartUtcMs)) return null;
  return (videoStartUtcMs - archiveStartUtcMs) / 1000;
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

function f1TimingSessionHasStartMarker(sessionData) {
  for (const entry of sessionData?.sessionStatusEntries || []) {
    const status = String(entry?.data?.Status || entry?.data?.SessionStatus || entry?.data?.Started || "");
    if (status === "Started") return true;
    const series = entry?.data?.StatusSeries;
    const values = Array.isArray(series) ? series : series && typeof series === "object" ? Object.values(series) : [];
    if (values.some((item) => String(item?.SessionStatus || item?.Status || item?.Started || "") === "Started")) return true;
  }
  return false;
}

function f1TimingReplayAvailabilityFromSessionData(sessionData = {}) {
  const timingRows = Array.isArray(sessionData.timingEntries) ? sessionData.timingEntries.length : 0;
  const archiveResolved = Boolean(sessionData.baseUrl);
  const synced = f1TimingSessionHasStartMarker(sessionData);
  if (timingRows > 0) {
    return {
      ok: true,
      status: synced ? "ready" : "manual-sync",
      available: true,
      synced,
      label: synced ? "Timing ready" : "Timing available",
      message: synced
        ? "Synced replay live timing is available."
        : "Replay live timing is available, but may need manual sync.",
    };
  }
  if (archiveResolved) {
    return {
      ok: true,
      status: "generating",
      available: false,
      synced: false,
      label: "Timing generating",
      message: "Replay live timing is being generated.",
    };
  }
  return {
    ok: false,
    status: "unavailable",
    available: false,
    synced: false,
    label: "No timing",
    message: "Replay live timing is not available yet.",
  };
}

function f1TimingTargetUtcMs(sessionData, targetSeconds) {
  const targetValue = finiteNumber(targetSeconds);
  const latestLiveUtcMs = (() => {
    if (targetValue == null || targetValue < Number.MAX_SAFE_INTEGER / 2) return null;
    const secondsValues = [
      ...(sessionData?.clockEntries || []),
      ...(sessionData?.sessionStatusEntries || []),
      ...(sessionData?.sessionDataEntries || []),
    ].map((entry) => finiteNumber(entry?.seconds)).filter((value) => value != null && value > 1000000000 && value < 10000000000);
    return secondsValues.length ? Math.max(...secondsValues) * 1000 : null;
  })();
  const archiveStartUtcMs = f1TimingArchiveStartUtcMs(sessionData);
  return latestLiveUtcMs ?? (targetValue == null
    ? null
    : Number.isFinite(archiveStartUtcMs)
      ? archiveStartUtcMs + targetValue * 1000
      : targetValue > 1000000000 && targetValue < 10000000000
        ? targetValue * 1000
        : null);
}

function f1TimingExplicitQualifyingPart(sessionData, targetSeconds) {
  const targetValue = finiteNumber(targetSeconds);
  const targetUtcMs = f1TimingTargetUtcMs(sessionData, targetSeconds);
  const events = [];
  const seen = new Set();
  for (const entry of sessionData?.sessionDataEntries || []) {
    const seconds = finiteNumber(entry?.seconds) ?? 0;
    if (targetValue != null && seconds > targetValue) continue;
    const rawSeries = entry?.data?.Series || entry?.data?.series || [];
    const seriesValues = Array.isArray(rawSeries) ? rawSeries : Object.values(rawSeries);
    const values = [entry?.data, ...seriesValues].filter(Boolean);
    values.forEach((item, index) => {
      const part = finiteNumber(item?.QualifyingPart ?? item?.qualifyingPart);
      if (part == null || part < 1 || part > 3) return;
      const utc = String(item?.Utc || item?.Timestamp || item?.Date || "").trim();
      const utcMs = Date.parse(utc);
      if (Number.isFinite(utcMs) && Number.isFinite(targetUtcMs) && utcMs > targetUtcMs) return;
      const key = utc ? `${utc}:${part}` : `${seconds}:${index}:${part}`;
      if (seen.has(key)) return;
      seen.add(key);
      events.push({ part, order: Number.isFinite(utcMs) ? utcMs : seconds * 1000 + index });
    });
  }
  events.sort((a, b) => a.order - b.order);
  const latest = events.at(-1);
  return latest ? `Q${latest.part}` : "";
}

function f1TimingQualifyingPart(sessionData, targetSeconds) {
  const explicitPart = f1TimingExplicitQualifyingPart(sessionData, targetSeconds);
  if (explicitPart) return explicitPart;
  const statusText = (item) => String(item?.SessionStatus || item?.Status || item?.Started || "");
  const eventUtcMs = (item) => Date.parse(item?.Utc || item?.Timestamp || item?.Date || "");
  const eventKey = (item, fallback) => {
    const utc = String(item?.Utc || item?.Timestamp || item?.Date || "").trim();
    return utc ? `${utc}:${statusText(item)}` : fallback;
  };
  const eventOrder = (item, seconds, index) => {
    const utcMs = eventUtcMs(item);
    return Number.isFinite(utcMs) ? utcMs : seconds * 1000 + index;
  };
  const targetValue = finiteNumber(targetSeconds);
  const targetUtcMs = f1TimingTargetUtcMs(sessionData, targetSeconds);
  const events = [];
  for (const entry of sessionData?.sessionStatusEntries || []) {
    const seconds = finiteNumber(entry?.seconds) ?? 0;
    if (seconds > targetSeconds) continue;
    const series = entry?.data?.StatusSeries;
    const seriesValues = Array.isArray(series) ? series : series && typeof series === "object" ? Object.values(series) : [];
    const values = seriesValues.length ? seriesValues : [entry?.data];
    values.forEach((item, index) => {
      const status = statusText(item);
      const utcMs = eventUtcMs(item);
      if (Number.isFinite(utcMs) && Number.isFinite(targetUtcMs) && utcMs > targetUtcMs) return;
      if (status) events.push({ status, key: eventKey(item, `${seconds}:${index}:${status}`), order: eventOrder(item, seconds, index) });
    });
  }
  events.sort((a, b) => a.order - b.order);
  let startedCount = 0;
  let wasStarted = false;
  let previousStopWasFinished = false;
  const seen = new Set();
  for (const event of events) {
    if (seen.has(event.key)) continue;
    seen.add(event.key);
    const isStarted = event.status === "Started";
    if (isStarted && !wasStarted && (startedCount === 0 || previousStopWasFinished)) startedCount += 1;
    wasStarted = isStarted;
    if (isStarted) {
      previousStopWasFinished = false;
    } else {
      previousStopWasFinished = /Finished|Finalised|Ends/i.test(event.status);
    }
  }
  return startedCount ? `Q${Math.min(startedCount, 3)}` : "";
}

function f1TimingQualifyingPartStartSeconds(sessionData, targetSeconds) {
  const targetValue = finiteNumber(targetSeconds);
  const targetUtcMs = f1TimingTargetUtcMs(sessionData, targetSeconds);
  const eventSeconds = (item, fallbackSeconds) => {
    const utcMs = Date.parse(item?.Utc || item?.Timestamp || item?.Date || "");
    if (Number.isFinite(utcMs) && Number.isFinite(targetUtcMs) && utcMs > targetUtcMs) return null;
    const seconds = Number.isFinite(utcMs) ? f1TimingArchiveSecondsForUtc(sessionData, utcMs) : finiteNumber(fallbackSeconds);
    return finiteNumber(seconds);
  };
  const explicitEvents = [];
  for (const entry of sessionData?.sessionDataEntries || []) {
    const seconds = finiteNumber(entry?.seconds) ?? 0;
    if (targetValue != null && seconds > targetValue) continue;
    const rawSeries = entry?.data?.Series || entry?.data?.series || [];
    const seriesValues = Array.isArray(rawSeries) ? rawSeries : Object.values(rawSeries);
    [entry?.data, ...seriesValues].filter(Boolean).forEach((item) => {
      const part = finiteNumber(item?.QualifyingPart ?? item?.qualifyingPart);
      if (part == null || part < 1 || part > 3) return;
      const startSeconds = eventSeconds(item, seconds);
      if (startSeconds != null && (targetValue == null || startSeconds <= targetValue)) explicitEvents.push({ part, startSeconds });
    });
  }
  if (explicitEvents.length) return explicitEvents.sort((a, b) => a.startSeconds - b.startSeconds).at(-1).startSeconds;

  const statusText = (item) => String(item?.SessionStatus || item?.Status || item?.Started || "");
  const events = [];
  for (const entry of sessionData?.sessionStatusEntries || []) {
    const seconds = finiteNumber(entry?.seconds) ?? 0;
    if (targetValue != null && seconds > targetValue) continue;
    const series = entry?.data?.StatusSeries;
    const values = Array.isArray(series) ? series : series && typeof series === "object" ? Object.values(series) : [entry?.data];
    values.filter(Boolean).forEach((item) => {
      const status = statusText(item);
      const startSeconds = eventSeconds(item, seconds);
      if (status && startSeconds != null && (targetValue == null || startSeconds <= targetValue)) events.push({ status, startSeconds });
    });
  }
  events.sort((a, b) => a.startSeconds - b.startSeconds);
  let startedCount = 0;
  let wasStarted = false;
  let previousStopWasFinished = false;
  let latestStart = null;
  for (const event of events) {
    const isStarted = event.status === "Started";
    if (isStarted && !wasStarted && (startedCount === 0 || previousStopWasFinished)) {
      startedCount += 1;
      latestStart = event.startSeconds;
    }
    wasStarted = isStarted;
    previousStopWasFinished = isStarted ? false : /Finished|Finalised|Ends/i.test(event.status);
  }
  return latestStart;
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
  const values = Array.isArray(raw) ? raw : (() => {
    const indexed = Object.entries(raw || {})
      .map(([key, value]) => [Number(key), value])
      .filter(([index]) => Number.isInteger(index) && index >= 0)
      .sort((a, b) => a[0] - b[0]);
    if (!indexed.length) return Object.values(raw || {});
    const expanded = Array(indexed.at(-1)[0] + 1).fill(null);
    indexed.forEach(([index, value]) => { expanded[index] = value; });
    return expanded;
  })();
  const tones = values.map((segment) => timingSegmentTone(segment?.Status ?? segment?.status ?? segment));
  while (tones.at(-1) === "off") tones.pop();
  return tones;
}

function f1TimingSegmentProgress(segments) {
  return Array.isArray(segments) ? segments.filter((tone) => tone && tone !== "off").length : 0;
}

function f1TimingSegmentExtent(segments) {
  if (!Array.isArray(segments)) return 0;
  for (let index = segments.length - 1; index >= 0; index -= 1) {
    if (segments[index] && segments[index] !== "off") return index + 1;
  }
  return 0;
}

function f1TimingTrimLeadingOffSegments(segments) {
  const values = Array.isArray(segments) ? segments : [];
  const firstActive = values.findIndex((tone) => tone && tone !== "off");
  if (firstActive <= 0) return values;
  return values.slice(firstActive);
}

function f1TimingBackfillSegmentHoles(segments) {
  // Mini-sectors are sequential on track. Sparse F1 deltas often light tick N
  // before 0..N-1 are present, which rendered as grey holes mid-bar.
  const values = Array.isArray(segments) ? segments.slice() : [];
  let lastActive = -1;
  for (let index = 0; index < values.length; index += 1) {
    if (values[index] && values[index] !== "off") lastActive = index;
  }
  if (lastActive <= 0) return values;
  for (let index = 0; index < lastActive; index += 1) {
    if (!values[index] || values[index] === "off") values[index] = "yellow";
  }
  return values;
}

function f1TimingMergeSectorSegments(previous, next) {
  const previousSegments = Array.isArray(previous) ? previous : [];
  const nextSegments = Array.isArray(next) ? next : [];
  if (!previousSegments.length) {
    return f1TimingBackfillSegmentHoles(f1TimingTrimLeadingOffSegments(nextSegments));
  }
  const merged = Array.from({ length: Math.max(previousSegments.length, nextSegments.length) }, (_, index) => {
    const nextTone = nextSegments[index] || "off";
    return nextTone !== "off" ? nextTone : previousSegments[index] || "off";
  });
  while (merged.at(-1) === "off") merged.pop();
  return f1TimingBackfillSegmentHoles(merged);
}

function f1TimingLineSessionLap(line) {
  return finiteNumber(line?.NumberOfLaps) ?? finiteNumber(line?.NumberOfLap) ?? finiteNumber(line?.LapNumber);
}

function f1TimingSectorHistoryAt(entries, targetSeconds, options = {}) {
  const startSeconds = finiteNumber(options.startSeconds);
  const history = new Map();
  let state = {};
  for (const entry of entries || []) {
    if (startSeconds != null && entry.seconds < startSeconds) continue;
    if (entry.seconds > targetSeconds) break;
    state = mergeF1TimingDelta(state, entry.data);
    const lines = state?.Lines || {};
    const deltaLines = entry?.data?.Lines || {};
    for (const [numberText, deltaLine] of Object.entries(deltaLines)) {
      const line = lines?.[numberText] || deltaLine;
      const number = Number(line?.RacingNumber || deltaLine?.RacingNumber || numberText);
      if (!Number.isFinite(number)) continue;
      const lap = f1TimingLineSessionLap(line);
      const previous = history.get(number);
      const sameLap = previous && (lap == null || previous.lap == null || previous.lap === lap);
      const deltaSectors = deltaLine?.Sectors || {};
      const deltaHasPitOutSector = Object.values(deltaSectors).some((sector) => f1TimingSegments(sector).includes("blue"));
      const deltaHasSectorContent = Object.values(deltaSectors).some((sector) => (
        f1TimingSegmentExtent(f1TimingSegments(sector)) > 0 || f1TimingSectorTime(sector) != null
      ));
      if (deltaLine?.InPit && !deltaHasPitOutSector && !deltaHasSectorContent) {
        history.set(number, {
          lap: lap ?? previous?.lap ?? null,
          sectors: { s1: [], s2: [], s3: [] },
          sectorTimes: { s1: null, s2: null, s3: null },
        });
        continue;
      }
      const sectorKeys = [["0", "s1"], ["1", "s2"], ["2", "s3"]];
      const touched = sectorKeys
        .map(([sectorIndex, sectorKey], index) => (
          Object.prototype.hasOwnProperty.call(deltaSectors, sectorIndex)
            ? { index, sectorKey, progress: f1TimingSegmentExtent(f1TimingSegments(deltaSectors[sectorIndex])) }
            : null
        ))
        .filter(Boolean);
      const previousProgress = sectorKeys.map(([, sectorKey]) => f1TimingSegmentExtent(previous?.sectors?.[sectorKey]));
      const rollsOverSectorPhase = sameLap && touched.some((item) => {
        const hasLaterProgress = previousProgress.slice(item.index + 1).some((progress) => progress > 0);
        const hasLaterUpdate = touched.some((other) => other.index > item.index && other.progress > 0);
        const restartedEarlierSector = previousProgress[item.index] > item.progress || previousProgress[item.index] === 0;
        return item.progress > 0 && restartedEarlierSector && hasLaterProgress && !hasLaterUpdate;
      });
      const previousSectors = sameLap && !rollsOverSectorPhase ? previous.sectors : {};
      const effectiveLap = rollsOverSectorPhase && previous?.lap != null && (lap == null || lap <= previous.lap)
        ? previous.lap + 1
        : lap;
      const previousSectorTimes = sameLap && !rollsOverSectorPhase ? previous.sectorTimes : {};
      const sectorSegments = (sectorIndex, sectorKey) => (
        Object.prototype.hasOwnProperty.call(deltaSectors, sectorIndex)
          ? f1TimingMergeSectorSegments(previousSectors?.[sectorKey], f1TimingSegments(deltaSectors[sectorIndex]))
          : sameLap ? previousSectors?.[sectorKey] || [] : []
      );
      const sectorTime = (sectorIndex, sectorKey) => {
        if (Object.prototype.hasOwnProperty.call(deltaSectors, sectorIndex)) {
          return f1TimingSectorTime(deltaSectors[sectorIndex]) ?? previousSectorTimes?.[sectorKey] ?? null;
        }
        return sameLap ? previousSectorTimes?.[sectorKey] ?? null : null;
      };
      history.set(number, {
        lap: effectiveLap,
        sectors: {
          s1: sectorSegments("0", "s1"),
          s2: sectorSegments("1", "s2"),
          s3: sectorSegments("2", "s3"),
        },
        sectorTimes: {
          s1: sectorTime("0", "s1"),
          s2: sectorTime("1", "s2"),
          s3: sectorTime("2", "s3"),
        },
      });
    }
  }
  return history;
}

function f1TimingPreservedSegments(line, sectorIndex, sectorHistory, sectorKey) {
  const current = f1TimingSegments(line?.Sectors?.[sectorIndex]);
  const preserved = sectorHistory?.sectors?.[sectorKey];
  if (sectorHistory) return Array.isArray(preserved) ? preserved : [];
  return current;
}

function f1TimingPrunePrematureSectorSegments(sectors) {
  const next = {
    s1: f1TimingBackfillSegmentHoles(Array.isArray(sectors?.s1) ? sectors.s1 : []),
    s2: f1TimingBackfillSegmentHoles(Array.isArray(sectors?.s2) ? sectors.s2 : []),
    s3: f1TimingBackfillSegmentHoles(Array.isArray(sectors?.s3) ? sectors.s3 : []),
  };
  const progress = (key) => f1TimingSegmentProgress(next[key]);
  if (progress("s3") > 0 && progress("s2") < 3) next.s3 = [];
  return next;
}

function f1TimingSectorTime(sector) {
  const raw = sector?.Value ?? sector?.value ?? sector?.Time ?? sector?.time ?? "";
  return f1TimingLapSeconds(raw);
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

function f1TimingKnownCompoundsByNumber(entries, targetSeconds) {
  const map = new Map();
  for (const entry of entries || []) {
    if (entry.seconds > targetSeconds) break;
    const lines = entry?.data?.Lines || {};
    for (const [numberText, line] of Object.entries(lines)) {
      const number = Number(numberText);
      if (!Number.isFinite(number)) continue;
      for (const stint of f1TimingStints(line)) {
        const compound = normalizeCompound(stint?.Compound);
        if (compound && compound !== "unknown") map.set(number, compound);
      }
    }
  }
  return map;
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

function f1TimingTelemetrySamples(sessionData) {
  if (!sessionData || typeof sessionData !== "object") return { samples: [], driverCount: 0 };
  const cacheKey = Array.isArray(sessionData.carDataEntries) ? sessionData.carDataEntries : sessionData;
  const cached = f1TimingTelemetrySampleCache.get(cacheKey);
  if (cached) return cached;
  const driverNumbers = new Set();
  const samples = [];
  let sequence = 0;
  for (const outer of sessionData?.carDataEntries || []) {
    for (const entry of Array.isArray(outer?.data?.Entries) ? outer.data.Entries : []) {
      const utc = entry?.Utc || "";
      const utcMs = Date.parse(utc);
      if (!Number.isFinite(utcMs)) continue;
      for (const [number, car] of Object.entries(entry?.Cars || {})) {
        const driverNumber = Number(number);
        if (!Number.isFinite(driverNumber)) continue;
        driverNumbers.add(driverNumber);
        const channels = car?.Channels || {};
        samples.push({
          utcMs,
          driverNumber,
          row: {
            driver_number: driverNumber,
            date: utc,
            rpm: finiteNumber(channels["0"]),
            speed: finiteNumber(channels["2"]),
            n_gear: finiteNumber(channels["3"]),
            throttle: finiteNumber(channels["4"]),
            brake: finiteNumber(channels["5"]) ? 100 : 0,
            drs: finiteNumber(channels["45"]),
          },
        });
      }
    }
  }
  samples.sort((a, b) => a.utcMs - b.utcMs || a.driverNumber - b.driverNumber);
  const indexed = { samples, driverCount: driverNumbers.size };
  f1TimingTelemetrySampleCache.set(cacheKey, indexed);
  return indexed;
}

function f1TimingTelemetryRowsAt(sessionData, targetSeconds) {
  const targetUtcMs = f1TimingTargetUtcMs(sessionData, targetSeconds);
  if (!Number.isFinite(targetUtcMs)) {
    return f1TimingTelemetryFromCarData(f1TimingStateAt(sessionData?.carDataEntries || [], targetSeconds));
  }
  const { samples, driverCount } = f1TimingTelemetrySamples(sessionData);
  let lo = 0;
  let hi = samples.length;
  while (lo < hi) {
    const mid = Math.floor((lo + hi) / 2);
    if (samples[mid].utcMs <= targetUtcMs) lo = mid + 1;
    else hi = mid;
  }
  const latest = new Map();
  for (let index = lo - 1; index >= 0; index -= 1) {
    const sample = samples[index];
    if (!latest.has(sample.driverNumber)) latest.set(sample.driverNumber, sample.row);
    if (driverCount && latest.size >= driverCount) break;
  }
  return Array.from(latest.values());
}

function f1TimingPositionSamples(sessionData) {
  if (!sessionData || typeof sessionData !== "object") return { samples: [], driverCount: 0 };
  // Key the cache by the entries array (shared across replay polls), not the
  // per-poll sessionData wrapper, so the flatten+sort of ~100k samples runs
  // once per session instead of on every poll.
  const cacheKey = Array.isArray(sessionData.positionEntries) ? sessionData.positionEntries : sessionData;
  const cached = f1TimingPositionSampleCache.get(cacheKey);
  if (cached) return cached;
  const driverNumbers = new Set();
  const samples = [];
  let sequence = 0;
  for (const entry of sessionData?.positionEntries || []) {
    const packets = [];
    const data = entry?.data || {};
    const seconds = finiteNumber(entry?.seconds);
    if (Array.isArray(data.Position)) packets.push(...data.Position);
    if (Array.isArray(data.Positions)) packets.push(...data.Positions);
    if (Array.isArray(data.Entries)) packets.push(...data.Entries);
    if (!packets.length && data.Cars) packets.push(data);
    for (const packet of packets) {
      const utc = packet?.Timestamp || packet?.Utc || packet?.Date || data.Timestamp || data.Utc || "";
      const utcMs = Date.parse(utc);
      if (!Number.isFinite(utcMs)) continue;
      const cars = packet?.Entries || packet?.Cars || {};
      for (const [numberText, car] of Object.entries(cars)) {
        const driverNumber = Number(car?.RacingNumber || car?.Number || numberText);
        const x = finiteNumber(car?.X ?? car?.x);
        const y = finiteNumber(car?.Y ?? car?.y);
        const z = finiteNumber(car?.Z ?? car?.z);
        if (!Number.isFinite(driverNumber) || x == null || y == null) continue;
        driverNumbers.add(driverNumber);
        samples.push({ seconds, sequence: sequence++, utcMs, driverNumber, row: { date: utc, x, y, z, status: car?.Status || car?.status || "" } });
      }
    }
  }
  samples.sort((a, b) => a.utcMs - b.utcMs || a.driverNumber - b.driverNumber);
  const indexed = { samples, driverCount: driverNumbers.size };
  f1TimingPositionSampleCache.set(cacheKey, indexed);
  return indexed;
}

function f1TimingInterpolatedPositionRowsAt(samples, driverCount, targetUtcMs) {
  // Position packets carry ~200ms-resolution UTC timestamps even though archive
  // entries batch them ~1s apart; interpolating between the bracketing packets
  // keeps replay cars moving continuously instead of stepping once per batch.
  const maxGapMs = 4000;
  let lo = 0;
  let hi = samples.length;
  while (lo < hi) {
    const mid = Math.floor((lo + hi) / 2);
    if (samples[mid].utcMs <= targetUtcMs) lo = mid + 1;
    else hi = mid;
  }
  const prevByDriver = new Map();
  for (let index = lo - 1; index >= 0; index -= 1) {
    const sample = samples[index];
    if (!prevByDriver.has(sample.driverNumber)) prevByDriver.set(sample.driverNumber, sample);
    if (driverCount && prevByDriver.size >= driverCount) break;
  }
  const nextByDriver = new Map();
  for (let index = lo; index < samples.length; index += 1) {
    const sample = samples[index];
    if (sample.utcMs - targetUtcMs > maxGapMs) break;
    if (!nextByDriver.has(sample.driverNumber)) nextByDriver.set(sample.driverNumber, sample);
    if (driverCount && nextByDriver.size >= driverCount) break;
  }
  return Array.from(prevByDriver, ([driverNumber, prev]) => {
    const next = nextByDriver.get(driverNumber);
    const gapMs = next ? next.utcMs - prev.utcMs : Infinity;
    if (!next || gapMs <= 0 || gapMs > maxGapMs) return { driver_number: driverNumber, ...prev.row };
    const t = Math.min(1, Math.max(0, (targetUtcMs - prev.utcMs) / gapMs));
    // Interpolated coordinates are valid at the interpolation instant; stamping
    // them with the older bracket packet would make the staleness filter and
    // the renderer's data-clock velocity estimate treat fresh data as old.
    return {
      driver_number: driverNumber,
      date: new Date(targetUtcMs).toISOString(),
      x: prev.row.x + (next.row.x - prev.row.x) * t,
      y: prev.row.y + (next.row.y - prev.row.y) * t,
      z: finiteNumber(prev.row.z) != null && finiteNumber(next.row.z) != null ? prev.row.z + (next.row.z - prev.row.z) * t : prev.row.z,
      status: prev.row.status,
    };
  });
}

function f1TimingPositionRowsAt(sessionData, targetSeconds) {
  const targetValue = finiteNumber(targetSeconds);
  const targetUtcMs = f1TimingTargetUtcMs(sessionData, targetSeconds);
  const { samples, driverCount } = f1TimingPositionSamples(sessionData);
  if (Number.isFinite(targetUtcMs) && samples.length) {
    const interpolated = f1TimingInterpolatedPositionRowsAt(samples, driverCount, targetUtcMs);
    if (interpolated.length) return interpolated;
  }
  if (targetValue != null && targetValue < 1000000000 && samples.some((sample) => sample.seconds != null)) {
    const bySeconds = samples
      .filter((sample) => sample.seconds != null && sample.seconds <= targetValue)
      .sort((a, b) => a.seconds - b.seconds || a.sequence - b.sequence || a.driverNumber - b.driverNumber);
    const latestBySeconds = new Map();
    for (let index = bySeconds.length - 1; index >= 0; index -= 1) {
      const sample = bySeconds[index];
      if (!latestBySeconds.has(sample.driverNumber)) latestBySeconds.set(sample.driverNumber, sample.row);
      if (driverCount && latestBySeconds.size >= driverCount) break;
    }
    if (latestBySeconds.size) return Array.from(latestBySeconds, ([driverNumber, row]) => ({ driver_number: driverNumber, ...row }));
  }
  if (!Number.isFinite(targetUtcMs)) {
    const entry = f1TimingLatestEntryAt(sessionData?.positionEntries || [], targetSeconds);
    const groups = Array.isArray(entry?.data?.Position)
      ? entry.data.Position
      : Array.isArray(entry?.data?.Entries)
        ? entry.data.Entries
        : [];
    const group = groups.at(-1);
    return Object.entries(group?.Entries || group?.Cars || {}).map(([number, position]) => {
      const driverNumber = Number(number);
      const x = finiteNumber(position?.X ?? position?.x);
      const y = finiteNumber(position?.Y ?? position?.y);
      if (!Number.isFinite(driverNumber) || x == null || y == null) return null;
      return {
        driver_number: driverNumber,
        date: group?.Timestamp || group?.Utc || group?.Date || "",
        x,
        y,
        z: finiteNumber(position?.Z ?? position?.z) ?? 0,
        status: String(position?.Status || position?.status || "").trim(),
      };
    }).filter(Boolean);
  }
  if (!samples.length) return [];
  let lo = 0;
  let hi = samples.length;
  while (lo < hi) {
    const mid = Math.floor((lo + hi) / 2);
    if (samples[mid].utcMs <= targetUtcMs) lo = mid + 1;
    else hi = mid;
  }
  const latest = new Map();
  for (let index = lo - 1; index >= 0; index -= 1) {
    const sample = samples[index];
    if (!latest.has(sample.driverNumber)) latest.set(sample.driverNumber, sample.row);
    if (driverCount && latest.size >= driverCount) break;
  }
  return Array.from(latest, ([driverNumber, row]) => ({ driver_number: driverNumber, ...row }));
}

function f1TimingPositionBounds(sessionData) {
  const { samples } = f1TimingPositionSamples(sessionData);
  const points = samples.map((sample) => sample.row).filter((row) => row && row.x != null && row.y != null);
  if (!points.length) return null;
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const point of points) {
    minX = Math.min(minX, point.x);
    maxX = Math.max(maxX, point.x);
    minY = Math.min(minY, point.y);
    maxY = Math.max(maxY, point.y);
  }
  return {
    minX,
    maxX,
    minY,
    maxY,
  };
}

function f1TimingPositionSamplePoints(sessionData, maxPoints = 240) {
  // Downsampled, time-ordered trace of a single driver across the whole
  // session, so the renderer can lock the map orientation even while cars are
  // clustered (e.g. on the starting grid). A single driver in time order also
  // carries the driving direction: consecutive points trace the lap, letting
  // the renderer reject direction-reversed map fits that pure point-to-track
  // distance cannot distinguish on elongated circuits.
  const { samples } = f1TimingPositionSamples(sessionData);
  if (!samples.length) return [];
  const byDriver = new Map();
  for (const sample of samples) {
    if (!byDriver.has(sample.driverNumber)) byDriver.set(sample.driverNumber, []);
    byDriver.get(sample.driverNumber).push(sample);
  }
  let trace = [];
  for (const list of byDriver.values()) if (list.length > trace.length) trace = list;
  trace = trace.filter((sample) => sample.row && sample.row.x != null && sample.row.y != null);
  const onTrack = trace.filter((sample) => /^ontrack$/i.test(String(sample.row.status || "")));
  const usable = onTrack.length >= 60 ? onTrack : trace;
  // Drop stationary stretches (garage, grid, red flags): clusters of repeated
  // off-line coordinates would otherwise bias the renderer's map fit.
  const moving = [];
  for (const sample of usable) {
    const prev = moving[moving.length - 1];
    if (!prev || Math.hypot(sample.row.x - prev.row.x, sample.row.y - prev.row.y) > 80) moving.push(sample);
  }
  const source = moving.length >= 60 ? moving : usable;
  const step = Math.max(1, Math.floor(source.length / maxPoints));
  const points = [];
  for (let index = 0; index < source.length; index += step) {
    const row = source[index].row;
    points.push({ x: row.x, y: row.y, z: finiteNumber(row.z) });
  }
  return points;
}

function getTrackMapInvariantPositionData(sessionData) {
  if (!sessionData || typeof sessionData !== "object") {
    return { bounds: null, sample: [] };
  }
  const cacheKey = Array.isArray(sessionData.positionEntries) ? sessionData.positionEntries : sessionData;
  const cached = f1TimingTrackMapInvariantCache.get(cacheKey);
  if (cached) return cached;
  const invariant = {
    bounds: f1TimingPositionBounds(sessionData),
    sample: f1TimingPositionSamplePoints(sessionData),
  };
  f1TimingTrackMapInvariantCache.set(cacheKey, invariant);
  return invariant;
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
  const trackStatusState = f1TimingStateAt(sessionData.trackStatusEntries || [], targetSeconds);
  const lapCount = parseF1TimingLapCount(sessionData, targetSeconds);
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
    trackStatus: {
      status: String(trackStatusState?.Status || "").trim(),
      message: String(trackStatusState?.Message || "").trim(),
    },
    lapCount,
    qualifyingPart: f1TimingQualifyingPart(sessionData, targetSeconds),
    extrapolating: Boolean(clockState?.Extrapolating),
    utc: clockState?.Utc || "",
  };
}

function parseF1TimingLapCount(sessionData, targetSeconds) {
  const state = f1TimingStateAt(sessionData.lapCountEntries || [], targetSeconds) || {};
  const lap = finiteNumber(state.CurrentLap) ?? finiteNumber(state.Lap) ?? finiteNumber(state.LapNumber);
  const laps = finiteNumber(state.TotalLaps) ?? finiteNumber(state.Laps) ?? finiteNumber(state.TotalLapCount);
  return {
    lap: lap ?? 0,
    laps: laps ?? 0,
  };
}

function f1TimingLapTimeline(sessionData, timingAnchor, videoStartArchiveSeconds) {
  const offset = timingAnchor === "video"
    ? Number(videoStartArchiveSeconds || 0)
    : timingAnchor === "session" ? f1TimingSessionStartSeconds(sessionData) : 0;
  const seen = new Set();
  const timeline = [];
  for (const entry of sessionData.lapCountEntries || []) {
    const lap = finiteNumber(entry?.data?.CurrentLap) ?? finiteNumber(entry?.data?.Lap) ?? finiteNumber(entry?.data?.LapNumber);
    const seconds = finiteNumber(entry?.seconds);
    if (!lap || seconds == null || seen.has(lap)) continue;
    const elapsedSeconds = Math.max(0, Number((seconds - offset).toFixed(3)));
    seen.add(lap);
    timeline.push({ lap, elapsedSeconds });
  }
  return timeline.sort((a, b) => a.lap - b.lap);
}

// Leader lap timeline for OpenF1 replays: earliest lap start across drivers, as session-elapsed seconds.
// Powers the scrub-bar hover preview's lap readout. Returns [] when lap data is unavailable.
function openF1LeaderLapTimeline(openF1Laps, sessionStartMs) {
  if (!Array.isArray(openF1Laps) || !Number.isFinite(sessionStartMs)) return [];
  const earliestByLap = new Map();
  for (const row of openF1Laps) {
    const lap = finiteNumber(row?.lap_number);
    const startMs = Date.parse(row?.date_start || "");
    if (!lap || !Number.isFinite(startMs)) continue;
    const prev = earliestByLap.get(lap);
    if (prev == null || startMs < prev) earliestByLap.set(lap, startMs);
  }
  return Array.from(earliestByLap.entries())
    .map(([lap, startMs]) => ({ lap, elapsedSeconds: Math.max(0, (startMs - sessionStartMs) / 1000) }))
    .sort((a, b) => a.lap - b.lap);
}

function parseF1TimingRaceControlMessages(entries, targetSeconds) {
  const state = f1TimingStateAt(entries || [], targetSeconds);
  const rawMessages = state?.Messages || state?.messages || state?.Message || [];
  const values = Array.isArray(rawMessages) ? rawMessages : Object.values(rawMessages || {});
  const messages = [];
  const seen = new Set();
  for (const item of values) {
    if (!item || typeof item !== "object") continue;
    const text = String(item.Message || item.message || item.Text || item.text || "").trim();
    if (!text) continue;
    const utc = String(item.Utc || item.UTC || item.Time || item.Date || "").trim();
    const category = String(item.Category || item.Type || item.Kind || "").trim();
    const status = String(item.Status || item.Flag || item.Mode || "").trim();
    const lap = finiteNumber(item.Lap || item.LapNumber);
    const racingNumber = String(item.RacingNumber || item.DriverNumber || "").trim();
    const key = [utc, lap ?? "", racingNumber, category, status, text].join("|");
    if (seen.has(key)) continue;
    seen.add(key);
    messages.push({ utc, lap, category, status, racingNumber, text });
  }
  messages.sort((a, b) => {
    const au = Date.parse(a.utc || "");
    const bu = Date.parse(b.utc || "");
    if (Number.isFinite(au) && Number.isFinite(bu) && au !== bu) return au - bu;
    if (a.lap != null && b.lap != null && a.lap !== b.lap) return a.lap - b.lap;
    return 0;
  });
  return messages.slice(-30);
}

// F1 timing TimingData lines carry an atomic Status bitfield (same decoding
// MultiViewer uses): 4=Stopped, 8=Retired, 16=InPit, 32=PitOut, 128=KnockedOut,
// 256=Cutoff. Unlike the InPit/PitOut booleans it is never left stale by
// partial patches, so it wins whenever the feed provides it.
function f1TimingDriverStatusFlags(status) {
  const value = finiteNumber(status);
  if (value == null) return null;
  return {
    stopped: Boolean(value & 4),
    retired: Boolean(value & 8),
    inPit: Boolean(value & 16),
    pitOut: Boolean(value & 32),
    knockedOut: Boolean(value & 128),
    cutoff: Boolean(value & 256),
  };
}

function parseF1TimingArchiveRows(sessionData, elapsedSeconds, options) {
  options = options || {};
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
  const statsState = f1TimingStateAt(sessionData.timingStatsEntries || [], targetSeconds);
  const weatherState = f1TimingStateAt(sessionData.weatherEntries, targetSeconds);
  const sessionClock = parseF1TimingSessionClock(sessionData, targetSeconds);
  const sessionInfoState = f1TimingStateAt(sessionData.sessionInfoEntries || [], targetSeconds);
  const sessionKindText = [
    sessionData.selectedSession?.session_name,
    sessionData.selectedSession?.session_type,
    sessionInfoState?.Name,
    sessionInfoState?.Type,
    sessionInfoState?.SessionName,
    sessionInfoState?.SessionType,
  ].filter(Boolean).join(" ");
  const useLiveLineOrder = Boolean(f1TimingExplicitQualifyingPart(sessionData, targetSeconds) || /qualifying|shootout/i.test(sessionKindText));
  const qualifyingPartStartSeconds = useLiveLineOrder ? f1TimingQualifyingPartStartSeconds(sessionData, targetSeconds) : null;
  const resetQualifyingTiming = qualifyingPartStartSeconds != null && qualifyingPartStartSeconds > 0 && qualifyingPartStartSeconds <= targetSeconds;
  const phaseTimingState = resetQualifyingTiming ? f1TimingStateBetween(sessionData.timingEntries, qualifyingPartStartSeconds, targetSeconds) : null;
  const phaseStatsState = resetQualifyingTiming ? f1TimingStateBetween(sessionData.timingStatsEntries || [], qualifyingPartStartSeconds, targetSeconds) : null;
  const raceControlMessages = parseF1TimingRaceControlMessages(sessionData.raceControlEntries, targetSeconds);
  const telemetryRows = f1TimingTelemetryRowsAt(sessionData, targetSeconds);
  const telemetryByNumber = latestCarDataByDriverNumber(telemetryRows);
  const positionByNumber = new Map(f1TimingPositionRowsAt(sessionData, targetSeconds).map((row) => [
    Number(row.driver_number),
    { x: row.x, y: row.y, z: row.z, status: row.status },
  ]));
  const knownCompounds = f1TimingKnownCompoundsByNumber(sessionData.timingAppEntries, targetSeconds);
  const sectorHistoryByNumber = options.preserveSectorProgress
    ? f1TimingSectorHistoryAt(sessionData.timingEntries, targetSeconds, { startSeconds: resetQualifyingTiming ? qualifyingPartStartSeconds : null })
    : null;
  const lines = timingState?.Lines || {};
  const appLines = appState?.Lines || {};
  const statsLines = statsState?.Lines || {};
  const phaseLines = phaseTimingState?.Lines || {};
  const phaseStatsLines = phaseStatsState?.Lines || {};
  const rows = Object.entries(lines).map(([numberText, line]) => {
    const number = Number(line?.RacingNumber || numberText);
    const driver = driverState?.[numberText] || driverState?.[String(number)] || {};
    const appLine = appLines?.[numberText] || appLines?.[String(number)] || {};
    const statsLine = statsLines?.[numberText] || statsLines?.[String(number)] || {};
    const timingLine = resetQualifyingTiming ? (phaseLines?.[numberText] || phaseLines?.[String(number)] || {}) : line;
    const timingStatsLine = resetQualifyingTiming ? (phaseStatsLines?.[numberText] || phaseStatsLines?.[String(number)] || {}) : statsLine;
    const stint = f1TimingLatestStint(appLine);
    const stintCompound = normalizeCompound(stint?.Compound);
    const compound = stintCompound && stintCompound !== "unknown" ? stintCompound : knownCompounds.get(number) || "";
    const lastSeconds = f1TimingLapSeconds(timingLine?.LastLapTime);
    const statsBestSeconds = f1TimingLapSeconds(timingStatsLine?.PersonalBestLapTime);
    const bestSeconds = f1TimingLapSeconds(timingLine?.BestLapTime) ?? statsBestSeconds;
    const sourceSessionLap = f1TimingLineSessionLap(line);
    const pos = useLiveLineOrder
      ? finiteNumber(line?.Line) ?? finiteNumber(line?.Position) ?? finiteNumber(driver.Line) ?? 99
      : finiteNumber(line?.Position) ?? finiteNumber(line?.Line) ?? finiteNumber(driver.Line) ?? 99;
    const gapValue = f1TimingValue(timingLine?.GapToLeader);
    const intervalValue = f1TimingValue(timingLine?.IntervalToPositionAhead);
    const sectorHistory = sectorHistoryByNumber?.get(number);
    const sessionLap = sectorHistory?.lap != null && (sourceSessionLap == null || sectorHistory.lap > sourceSessionLap)
      ? sectorHistory.lap
      : sourceSessionLap;
    const sectors = f1TimingPrunePrematureSectorSegments({
      s1: f1TimingPreservedSegments(timingLine, "0", sectorHistory, "s1"),
      s2: f1TimingPreservedSegments(timingLine, "1", sectorHistory, "s2"),
      s3: f1TimingPreservedSegments(timingLine, "2", sectorHistory, "s3"),
    });
    const sectorTimes = sectorHistory?.sectorTimes || {
      s1: f1TimingSectorTime(timingLine?.Sectors?.["0"]),
      s2: f1TimingSectorTime(timingLine?.Sectors?.["1"]),
      s3: f1TimingSectorTime(timingLine?.Sectors?.["2"]),
    };
    // Out-laps start with blue pit-exit segments in S1; blue segments at the
    // tail of S3 are pit ENTRY on an in-lap and must not read as pit out.
    const hasPitOutSector = Array.isArray(sectors.s1) && sectors.s1.includes("blue");
    const statusFlags = f1TimingDriverStatusFlags(line?.Status);
    const inPit = statusFlags ? statusFlags.inPit : Boolean(line?.InPit);
    const pitOut = statusFlags ? statusFlags.pitOut : Boolean(line?.PitOut);
    const knockedOut = Boolean(line?.KnockedOut || statusFlags?.knockedOut);
    const retired = Boolean(line?.Retired || statusFlags?.retired);
    const stopped = Boolean(line?.Stopped || statusFlags?.stopped);
    return {
      pos,
      code: String(driver?.Tla || line?.Tla || numberText).toUpperCase(),
      number,
      last: lastSeconds != null ? formatLapDuration(lastSeconds) : f1TimingValue(timingLine?.LastLapTime),
      best: bestSeconds != null ? formatLapDuration(bestSeconds) : f1TimingValue(timingLine?.BestLapTime) || f1TimingValue(timingStatsLine?.PersonalBestLapTime),
      lastLapDuration: lastSeconds,
      bestLapDuration: bestSeconds,
      sessionLap,
      state: knockedOut ? "KO"
        : retired ? "RETIRED"
        : statusFlags ? (inPit ? "IN PIT" : pitOut ? "PIT OUT" : stopped ? "STOP" : null)
        : inPit && !hasPitOutSector ? "IN PIT"
        : pitOut || hasPitOutSector ? "PIT OUT"
        : inPit ? "IN PIT"
        : stopped ? "STOP" : null,
      retired,
      knockedOut,
      gap: gapValue || (pos === 1 ? "LEADER" : "—"),
      interval: intervalValue || "—",
      trend: "flat",
      comp: compound,
      age: finiteNumber(stint?.TotalLaps) ?? "",
      pits: "",
      stints: f1TimingStints(appLine).map((item) => ({
        compound: normalizeCompound(item?.Compound) || "unknown",
        lapStart: finiteNumber(item?.LapNumber),
        lapEnd: finiteNumber(item?.LapNumber),
        laps: finiteNumber(item?.TotalLaps),
        tyreAgeAtStart: finiteNumber(item?.StartLaps),
      })),
      sectors,
      sectorTimes,
      bestSectorTimes: {
        s1: f1TimingSectorTime(timingLine?.BestSectors?.["0"]),
        s2: f1TimingSectorTime(timingLine?.BestSectors?.["1"]),
        s3: f1TimingSectorTime(timingLine?.BestSectors?.["2"]),
      },
      telemetry: telemetryByNumber.get(number) || {},
      trackPosition: positionByNumber.get(number) || null,
    };
  }).filter((row) => row.code && row.pos).sort((a, b) => a.pos - b.pos);
  const timingRows = fillF1TimingQualifyingDeltas(rows);
  return { timing: timingRows, weather: parseF1TimingWeatherState(weatherState), sessionClock, raceControlMessages, lapTimeline: f1TimingLapTimeline(sessionData, timingAnchor, videoStartArchiveSeconds), diagnostics: {
    timingAnchor,
    videoStartArchiveSeconds,
    sessionStartSeconds: f1TimingSessionStartSeconds(sessionData),
    targetSeconds,
    driverRows: Object.keys(driverState || {}).length,
    timingLines: timingRows.length,
    timingEntries: sessionData.timingEntries?.length || 0,
    timingAppEntries: sessionData.timingAppEntries?.length || 0,
    timingStatsEntries: sessionData.timingStatsEntries?.length || 0,
    clockEntries: sessionData.clockEntries?.length || 0,
    sessionInfoEntries: sessionData.sessionInfoEntries?.length || 0,
    sessionDataEntries: sessionData.sessionDataEntries?.length || 0,
    sessionStatusEntries: sessionData.sessionStatusEntries?.length || 0,
    trackStatusEntries: sessionData.trackStatusEntries?.length || 0,
    raceControlEntries: sessionData.raceControlEntries?.length || 0,
    lapCountEntries: sessionData.lapCountEntries?.length || 0,
    weatherEntries: sessionData.weatherEntries?.length || 0,
    carDataEntries: sessionData.carDataEntries?.length || 0,
    positionEntries: sessionData.positionEntries?.length || 0,
    telemetryRows: telemetryRows.length,
    positionRows: positionByNumber.size,
  } };
}

async function readF1TimingArchiveSessionData(resolvedMeeting, resolvedSession, baseUrl) {
  const [driverListText, timingText, appText, clockText, sessionDataText, statusText, trackStatusText, raceControlText, lapCountText, weatherText, carText, positionText] = await Promise.all([
    f1TimingRequestText(`${baseUrl}DriverList.jsonStream`).catch(() => ""),
    f1TimingRequestText(`${baseUrl}TimingData.jsonStream`),
    f1TimingRequestText(`${baseUrl}TimingAppData.jsonStream`).catch(() => ""),
    f1TimingRequestText(`${baseUrl}ExtrapolatedClock.jsonStream`).catch(() => ""),
    f1TimingRequestText(`${baseUrl}SessionData.jsonStream`).catch(() => ""),
    f1TimingRequestText(`${baseUrl}SessionStatus.jsonStream`).catch(() => ""),
    f1TimingRequestText(`${baseUrl}TrackStatus.jsonStream`).catch(() => ""),
    f1TimingRequestText(`${baseUrl}RaceControlMessages.jsonStream`).catch(() => ""),
    f1TimingRequestText(`${baseUrl}LapCount.jsonStream`).catch(() => ""),
    f1TimingRequestText(`${baseUrl}WeatherData.jsonStream`).catch(() => ""),
    f1TimingRequestText(`${baseUrl}CarData.z.jsonStream`).catch(() => ""),
    f1TimingRequestText(`${baseUrl}Position.z.jsonStream`).catch(() => ""),
  ]);
  const data = {
    ok: true,
    source: "Formula 1 livetiming",
    meeting: resolvedMeeting,
    selectedSession: resolvedSession,
    baseUrl,
    driverListEntries: driverListText ? parseF1TimingJsonStream(driverListText) : [],
    timingEntries: parseF1TimingJsonStream(timingText),
    timingAppEntries: appText ? parseF1TimingJsonStream(appText) : [],
    clockEntries: clockText ? parseF1TimingJsonStream(clockText) : [],
    sessionDataEntries: sessionDataText ? parseF1TimingJsonStream(sessionDataText) : [],
    sessionStatusEntries: statusText ? parseF1TimingJsonStream(statusText) : [],
    trackStatusEntries: trackStatusText ? parseF1TimingJsonStream(trackStatusText) : [],
    raceControlEntries: raceControlText ? parseF1TimingJsonStream(raceControlText) : [],
    lapCountEntries: lapCountText ? parseF1TimingJsonStream(lapCountText) : [],
    weatherEntries: weatherText ? parseF1TimingJsonStream(weatherText) : [],
    carDataEntries: carText ? parseF1TimingJsonStream(carText, { zipped: true }) : [],
    positionEntries: positionText ? parseF1TimingJsonStream(positionText, { zipped: true }) : [],
  };
  return data;
}

async function getReplayF1TimingSessionData(meetingKey, sessionKind, options = {}) {
  const normalizedKind = normalizeOpenF1SessionKind(sessionKind || "Race");
  const identityKey = [options.raceName, options.raceStartsAt, options.sessionStartsAt].filter(Boolean).join(":");
  const cacheKey = `${meetingKey}:${normalizedKind}:${identityKey}`;
  const cached = replayF1TimingCache.get(cacheKey);
  const maxAgeMs = 1000 * 60 * 60;
  if (cached && Date.now() - cached.createdAt < maxAgeMs) return cached.data;

  const optionIdentity = f1TimingArchiveIdentityFromOptions(options, sessionKind);
  if (optionIdentity) {
    try {
      const archive = await resolveF1TimingArchiveBase(optionIdentity.meeting, optionIdentity.session);
      const data = await readF1TimingArchiveSessionData(optionIdentity.meeting, optionIdentity.session, archive.baseUrl);
      replayF1TimingCache.set(cacheKey, { createdAt: Date.now(), data });
      if (replayF1TimingCache.size > 12) replayF1TimingCache = new Map(Array.from(replayF1TimingCache.entries()).slice(-8));
      return data;
    } catch {}
  }

  const meetings = await requestOpenF1Json(openF1ApiUrl("meetings", { meeting_key: meetingKey })).catch(() => []);
  const sessions = await requestOpenF1Json(openF1ApiUrl("sessions", { meeting_key: meetingKey }));
  const meeting = meetings?.[0] || {};
  const selectedSession = (sessions || [])
    .slice()
    .sort((a, b) => scoreOpenF1ReplaySession(b, sessionKind) - scoreOpenF1ReplaySession(a, sessionKind))[0];
  if (!selectedSession?.session_key) throw new Error(`No ${sessionKind} session matched this replay.`);
  let archive = null;
  let resolvedMeeting = meeting;
  let resolvedSession = selectedSession;
  if (optionIdentity) {
    try {
      archive = await resolveF1TimingArchiveBase(optionIdentity.meeting, optionIdentity.session);
      resolvedMeeting = optionIdentity.meeting;
      resolvedSession = { ...selectedSession, ...optionIdentity.session };
    } catch {}
  }
  if (!archive) archive = await resolveF1TimingArchiveBase(meeting, selectedSession);
  const data = await readF1TimingArchiveSessionData(resolvedMeeting, resolvedSession, archive.baseUrl);
  replayF1TimingCache.set(cacheKey, { createdAt: Date.now(), data });
  if (replayF1TimingCache.size > 12) replayF1TimingCache = new Map(Array.from(replayF1TimingCache.entries()).slice(-8));
  return data;
}

async function resolveF1TimingReplayAvailabilitySource(meetingKey, sessionKind, options = {}) {
  const optionIdentity = f1TimingArchiveIdentityFromOptions(options, sessionKind);
  if (optionIdentity) {
    try {
      const archive = await resolveF1TimingArchiveBase(optionIdentity.meeting, optionIdentity.session);
      return { meeting: optionIdentity.meeting, session: optionIdentity.session, archive };
    } catch {}
  }

  const meetings = await requestOpenF1Json(openF1ApiUrl("meetings", { meeting_key: meetingKey })).catch(() => []);
  const sessions = await requestOpenF1Json(openF1ApiUrl("sessions", { meeting_key: meetingKey }));
  const meeting = meetings?.[0] || {};
  const explicitSessionKey = finiteNumber(options.sessionKey);
  const selectedSession = explicitSessionKey
    ? (sessions || []).find((session) => finiteNumber(session?.session_key) === explicitSessionKey)
    : (sessions || []).slice().sort((a, b) => scoreOpenF1ReplaySession(b, sessionKind) - scoreOpenF1ReplaySession(a, sessionKind))[0];
  if (!selectedSession?.session_key && !selectedSession?.session_name) throw new Error(`No ${sessionKind} session matched this replay.`);
  const archive = await resolveF1TimingArchiveBase(meeting, selectedSession);
  return { meeting, session: selectedSession, archive };
}

async function readF1TimingReplayAvailabilityData(resolvedMeeting, resolvedSession, baseUrl) {
  void resolvedMeeting;
  const [timingText, statusText] = await Promise.all([
    f1TimingRequestText(`${baseUrl}TimingData.jsonStream`, 9000).catch(() => ""),
    f1TimingRequestText(`${baseUrl}SessionStatus.jsonStream`, 9000).catch(() => ""),
  ]);
  return {
    baseUrl,
    selectedSession: resolvedSession,
    timingEntries: timingText ? parseF1TimingJsonStreamPreview(timingText, 2) : [],
    sessionStatusEntries: statusText ? parseF1TimingJsonStream(statusText) : [],
  };
}

function missingF1TimingReplayAvailability(options = {}) {
  const endedAt = Date.parse(options.sessionEndsAt || options.endsAt || options.dateEnd || options.date_end || "");
  const recentlyEnded = Number.isFinite(endedAt) && Date.now() > endedAt && Date.now() - endedAt < 1000 * 60 * 60 * 12;
  if (recentlyEnded) {
    return {
      ok: true,
      status: "generating",
      available: false,
      synced: false,
      label: "Timing generating",
      message: "Replay live timing is being generated.",
    };
  }
  return f1TimingReplayAvailabilityFromSessionData({});
}

async function getReplayTimingAvailability(options = {}) {
  const meetingKey = String(options.meetingKey || "").replace(/[^0-9]/g, "");
  const sessionKind = String(options.sessionKind || "Race");
  if (!meetingKey) return { ...f1TimingReplayAvailabilityFromSessionData({}), checkedAt: new Date().toISOString() };
  const cacheKey = [
    meetingKey,
    normalizeOpenF1SessionKind(sessionKind),
    String(options.sessionKey || ""),
    String(options.raceName || ""),
    String(options.raceStartsAt || options.startsAt || ""),
    String(options.sessionStartsAt || options.sessionStart || ""),
  ].join(":");
  const cached = replayTimingAvailabilityCache.get(cacheKey);
  if (cached && Date.now() - cached.createdAt < 1000 * 60) return cached.data;
  let data;
  try {
    const source = await resolveF1TimingReplayAvailabilitySource(meetingKey, sessionKind, options);
    const sessionData = await readF1TimingReplayAvailabilityData(source.meeting, source.session, source.archive.baseUrl);
    data = {
      ...f1TimingReplayAvailabilityFromSessionData(sessionData),
      sessionKey: source.session?.session_key || options.sessionKey || "",
      sessionKind: source.session?.session_name || sessionKind,
      checkedAt: new Date().toISOString(),
    };
  } catch {
    data = {
      ...missingF1TimingReplayAvailability(options),
      checkedAt: new Date().toISOString(),
    };
  }
  replayTimingAvailabilityCache.set(cacheKey, { createdAt: Date.now(), data });
  if (replayTimingAvailabilityCache.size > 120) replayTimingAvailabilityCache = new Map(Array.from(replayTimingAvailabilityCache.entries()).slice(-80));
  return data;
}

async function getTrackMapStaticF1TimingSessionData(options = {}) {
  const sessionKind = String(options.sessionKind || "Race");
  const identity = f1TimingArchiveIdentityFromOptions(options, sessionKind);
  if (!identity) throw new Error("Track Map replay needs a race name and session start date.");
  const staticCacheKey = [
    identity.meeting?.meeting_name || identity.meeting?.name || "",
    identity.session?.date_start || "",
    sessionKind,
  ].join(":");
  const cached = trackMapReplaySessionCache.get(staticCacheKey);
  if (cached && Date.now() - cached.createdAt < 1000 * 60 * 60) return cached.data;
  const archive = await resolveF1TimingArchiveBase(identity.meeting, identity.session);
  const baseUrl = archive.baseUrl;
  const [driverListText, sessionDataText, lapCountText, weatherText, positionText] = await Promise.all([
    f1TimingRequestText(`${baseUrl}DriverList.jsonStream`).catch(() => ""),
    f1TimingRequestText(`${baseUrl}SessionData.jsonStream`).catch(() => ""),
    f1TimingRequestText(`${baseUrl}LapCount.jsonStream`).catch(() => ""),
    f1TimingRequestText(`${baseUrl}WeatherData.jsonStream`).catch(() => ""),
    f1TimingRequestText(`${baseUrl}Position.z.jsonStream`).catch(() => ""),
  ]);
  const data = {
    ok: true,
    source: "Formula 1 livetiming",
    meeting: identity.meeting,
    selectedSession: identity.session,
    baseUrl,
    driverListEntries: driverListText ? parseF1TimingJsonStream(driverListText) : [],
    sessionDataEntries: sessionDataText ? parseF1TimingJsonStream(sessionDataText) : [],
    lapCountEntries: lapCountText ? parseF1TimingJsonStream(lapCountText) : [],
    weatherEntries: weatherText ? parseF1TimingJsonStream(weatherText) : [],
    carDataEntries: [],
    positionEntries: positionText ? parseF1TimingJsonStream(positionText, { zipped: true }) : [],
  };
  trackMapReplaySessionCache.set(staticCacheKey, { createdAt: Date.now(), data });
  if (trackMapReplaySessionCache.size > 8) trackMapReplaySessionCache = new Map(Array.from(trackMapReplaySessionCache.entries()).slice(-6));
  return data;
}

function f1TimingRaceStartArchiveSeconds(sessionData) {
  const timeline = f1TimingLapTimeline(sessionData);
  const lap1 = timeline.find((item) => Number(item.lap) === 1);
  const lap2 = timeline.find((item) => Number(item.lap) === 2);
  const lapDiffs = [];
  for (let index = 2; index < timeline.length; index += 1) {
    const diff = finiteNumber(timeline[index].elapsedSeconds) - finiteNumber(timeline[index - 1].elapsedSeconds);
    if (Number.isFinite(diff) && diff >= 40 && diff <= 180) lapDiffs.push(diff);
  }
  lapDiffs.sort((a, b) => a - b);
  const typicalLapSeconds = lapDiffs.length ? lapDiffs[Math.floor(lapDiffs.length / 2)] : 90;
  const lap1Seconds = finiteNumber(lap1?.elapsedSeconds) ?? finiteNumber(timeline[0]?.elapsedSeconds) ?? 0;
  const lap2Seconds = finiteNumber(lap2?.elapsedSeconds);
  if (lap2Seconds != null && lap2Seconds - lap1Seconds > typicalLapSeconds * 5) {
    return Math.max(0, lap2Seconds - typicalLapSeconds);
  }
  return Math.max(0, lap1Seconds);
}

function getTrackMapF1TimingStreamEntries(baseUrl) {
  // Full-session timing streams are fetched and parsed ONCE per session and
  // shared across replay polls. Re-streaming TimingData from byte zero on
  // every 270ms poll costs megabytes of bandwidth and hundreds of
  // milliseconds of parsing by the late race, which starves the renderer of
  // position updates. Downstream consumers stop merging at their target time,
  // so complete chronological arrays behave exactly like windowed slices —
  // and stable array references are what the state/sample caches key on.
  const cached = trackMapReplayStreamCache.get(baseUrl);
  if (cached && Date.now() - cached.createdAt < 1000 * 60 * 60) return cached.promise;
  const promise = Promise.all([
    f1TimingRequestJsonStreamEntries(`${baseUrl}TimingData.jsonStream`),
    f1TimingRequestJsonStreamEntries(`${baseUrl}TimingAppData.jsonStream`).catch(() => []),
    f1TimingRequestJsonStreamEntries(`${baseUrl}ExtrapolatedClock.jsonStream`).catch(() => []),
    f1TimingRequestJsonStreamEntries(`${baseUrl}SessionStatus.jsonStream`).catch(() => []),
    f1TimingRequestJsonStreamEntries(`${baseUrl}TrackStatus.jsonStream`).catch(() => []),
    f1TimingRequestJsonStreamEntries(`${baseUrl}RaceControlMessages.jsonStream`).catch(() => []),
  ]).then(([timingEntries, timingAppEntries, clockEntries, sessionStatusEntries, trackStatusEntries, raceControlEntries]) => ({
    timingEntries,
    timingAppEntries,
    clockEntries,
    sessionStatusEntries,
    trackStatusEntries,
    raceControlEntries,
  }));
  promise.catch(() => {
    if (trackMapReplayStreamCache.get(baseUrl)?.promise === promise) trackMapReplayStreamCache.delete(baseUrl);
  });
  trackMapReplayStreamCache.set(baseUrl, { createdAt: Date.now(), promise });
  if (trackMapReplayStreamCache.size > 4) trackMapReplayStreamCache = new Map(Array.from(trackMapReplayStreamCache.entries()).slice(-3));
  return promise;
}

async function getTrackMapF1TimingSessionData(options = {}) {
  const elapsedSeconds = Math.max(0, Number(options.elapsedSeconds || 0));
  const staticData = await getTrackMapStaticF1TimingSessionData(options);
  const preStartSeconds = Math.max(0, Number(options.preStartSeconds ?? 5));
  const raceStartArchiveSeconds = f1TimingRaceStartArchiveSeconds(staticData);
  const targetSeconds = options.raceRelative
    ? Math.max(0, raceStartArchiveSeconds - preStartSeconds + elapsedSeconds)
    : elapsedSeconds;
  const streams = await getTrackMapF1TimingStreamEntries(staticData.baseUrl);
  return {
    ...staticData,
    ...streams,
    raceStartArchiveSeconds,
    replayTargetSeconds: targetSeconds,
    replayRelativeSeconds: elapsedSeconds,
    replayPreStartSeconds: preStartSeconds,
  };
}

function f1TimingReplayDurationSeconds(sessionData, parsed) {
  const fromLapTimeline = f1TimingLapTimeline(sessionData).at(-1)?.elapsedSeconds;
  const lastSeconds = (entries) => {
    let max = 0;
    for (const entry of entries || []) {
      const value = finiteNumber(entry?.seconds);
      if (value != null && value > max) max = value;
    }
    return max;
  };
  // Timing/SessionStatus streams now span the whole archive (fetched once per
  // session) and often run long past the chequered flag, so the scrub range
  // comes from the lap timeline and position coverage; raw stream extents are
  // only a fallback when both are missing.
  const primary = Math.max(fromLapTimeline || 0, lastSeconds(sessionData?.lapCountEntries), lastSeconds(sessionData?.positionEntries));
  const fallback = primary > 0 ? 0 : Math.max(lastSeconds(sessionData?.timingEntries), lastSeconds(sessionData?.sessionStatusEntries));
  return Math.max(1, primary, fallback, parsed?.diagnostics?.targetSeconds || 0);
}

function trackMapPositionOnlyTimingRows(sessionData, targetSeconds, positionByNumber) {
  const timestampState = f1TimingStateAt(sessionData?.driverListEntries || [], targetSeconds) || {};
  const driverState = Object.keys(timestampState).length ? timestampState : sessionData?.driverListEntries?.[0]?.data || {};
  return Object.entries(driverState).map(([numberText, driver], index) => {
    const number = Number(driver?.RacingNumber || numberText);
    const trackPosition = positionByNumber.get(number);
    if (!Number.isFinite(number)) return null;
    return {
      pos: finiteNumber(driver?.Line) ?? index + 1,
      code: String(driver?.Tla || driver?.BroadcastName || numberText).slice(0, 3).toUpperCase(),
      number,
      last: "",
      best: "",
      gap: "—",
      interval: "—",
      trend: "flat",
      comp: "",
      age: "",
      pits: "",
      sectors: { s1: [], s2: [], s3: [] },
      sectorTimes: { s1: "", s2: "", s3: "" },
      bestSectorTimes: { s1: "", s2: "", s3: "" },
      telemetry: {},
      trackPosition,
    };
  }).filter(Boolean).sort((a, b) => a.pos - b.pos);
}

async function getTrackMapReplayTimingSnapshot(options = {}) {
  const sessionKind = String(options.sessionKind || "Race");
  const elapsedSeconds = Math.max(0, Number(options.elapsedSeconds || 0));
  const cacheKey = [
    options.raceName || options.eventName || "",
    options.raceStartsAt || options.startsAt || "",
    options.sessionStartsAt || "",
    sessionKind,
    options.raceRelative ? "relative" : "program",
    Math.floor((elapsedSeconds * 1000) / 270),
  ].join(":");
  const cached = trackMapReplayTimingCache.get(cacheKey);
  if (cached && Date.now() - cached.createdAt < 5000) return cached.data;

  const sessionData = await getTrackMapF1TimingSessionData({ ...options, elapsedSeconds });
  const targetSeconds = sessionData.replayTargetSeconds ?? elapsedSeconds;
  const parsed = parseF1TimingArchiveRows(sessionData, targetSeconds, { timingAnchor: "program" });
  const targetUtcMs = f1TimingTargetUtcMs(sessionData, targetSeconds);
  const positionByNumber = new Map(f1TimingPositionRowsAt(sessionData, parsed.diagnostics?.targetSeconds ?? targetSeconds).map((row) => [
    Number(row.driver_number),
    { date: row.date, x: row.x, y: row.y, z: row.z, status: row.status },
  ]).filter(([, row]) => {
    const rowUtcMs = Date.parse(row.date || "");
    // 4s matches the interpolation bracket limit: anything older is a real
    // coverage hole, and holding frozen cars for 10s before the fallback took
    // over looked like the field stalling at gap edges.
    return !Number.isFinite(targetUtcMs) || !Number.isFinite(rowUtcMs) || Math.abs(targetUtcMs - rowUtcMs) <= 4000;
  }));
  const timingRows = parsed.timing.length
    ? parsed.timing
    : trackMapPositionOnlyTimingRows(sessionData, parsed.diagnostics?.targetSeconds ?? targetSeconds, positionByNumber);
  const timing = timingRows.map((row) => ({
    ...row,
    trackPosition: positionByNumber.get(Number(row.number)) || null,
  }));
  const relativeOffset = options.raceRelative ? Math.max(0, (sessionData.raceStartArchiveSeconds || 0) - (sessionData.replayPreStartSeconds || 0)) : 0;
  const lapTimeline = f1TimingLapTimeline(sessionData).map((item) => ({
    ...item,
    elapsedSeconds: Math.max(0, Number((item.elapsedSeconds - relativeOffset).toFixed(3))),
  }));
  const trackPositionInvariant = getTrackMapInvariantPositionData(sessionData);
  const data = {
    ok: timing.length > 0,
    sessionKind: sessionData.selectedSession?.session_name || sessionKind,
    elapsedSeconds,
    targetSeconds,
    durationSeconds: Math.max(1, f1TimingReplayDurationSeconds(sessionData, parsed) - relativeOffset),
    sourceLabel: "Formula 1 livetiming track map replay",
    timing,
    weather: parsed.weather,
    sessionClock: parsed.sessionClock,
    raceControlMessages: parsed.raceControlMessages,
    lapTimeline,
    trackPositionBounds: trackPositionInvariant.bounds,
    trackPositionSample: trackPositionInvariant.sample,
    diagnostics: {
      ...(parsed.diagnostics || {}),
      raceStartArchiveSeconds: sessionData.raceStartArchiveSeconds,
      replayTargetSeconds: targetSeconds,
      positionEntries: sessionData.positionEntries?.length || 0,
      positionedCars: timing.filter((row) => row.trackPosition).length,
    },
    message: timing.length ? "" : "Formula 1 livetiming has no replay rows at this timestamp yet.",
  };
  trackMapReplayTimingCache.set(cacheKey, { createdAt: Date.now(), data });
  if (trackMapReplayTimingCache.size > 120) trackMapReplayTimingCache = new Map(Array.from(trackMapReplayTimingCache.entries()).slice(-80));
  return data;
}

function requestF1TimingJsonPost(targetUrl, timeout = 10000, headers = {}) {
  return new Promise((resolve, reject) => {
    const endpoint = new URL(targetUrl);
    const req = https.request({
      method: "POST",
      hostname: endpoint.hostname,
      path: `${endpoint.pathname}${endpoint.search}`,
      headers: f1TimingHeaders({ "Content-Length": 0, ...headers }),
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

// Live SignalR topics start with a full subscribe snapshot, then sparse
// deltas. Hard-dropping the oldest rows (after ~a few minutes of TimingData)
// discards that baseline so last-lap / mini-sector rebuilds from partial
// deltas only — and freezes f1TimingStateAt's resume cursor past the new
// length. Fold history into one merged base entry instead.
const F1_TIMING_LIVE_ENTRY_SOFT_LIMIT = 1000;
const F1_TIMING_LIVE_ENTRY_KEEP = 700;

function compactF1TimingLiveEntries(rows) {
  if (!Array.isArray(rows) || rows.length <= F1_TIMING_LIVE_ENTRY_SOFT_LIMIT) return rows;
  const keepFrom = Math.max(1, rows.length - F1_TIMING_LIVE_ENTRY_KEEP);
  let base = {};
  for (let index = 0; index < keepFrom; index += 1) {
    base = mergeF1TimingDelta(base, rows[index]?.data);
  }
  const baseSeconds = finiteNumber(rows[keepFrom - 1]?.seconds)
    ?? finiteNumber(rows[0]?.seconds)
    ?? 0;
  const kept = rows.slice(keepFrom);
  rows.length = 0;
  rows.push({ time: "", seconds: baseSeconds, data: base }, ...kept);
  // Compaction rewrites indices; drop any resume cursor so the next parse
  // rebuilds from the folded base instead of skipping past the new length.
  f1TimingStateCursorCache.delete(rows);
  return rows;
}

function boundedF1TimingLiveEntries(topic) {
  if (!f1LiveTimingState.entriesByTopic[topic]) f1LiveTimingState.entriesByTopic[topic] = [];
  return compactF1TimingLiveEntries(f1LiveTimingState.entriesByTopic[topic]);
}

function f1TimingLivePayload(topic, payload) {
  if (payload == null || payload === "") return null;
  if (typeof payload === "string") {
    const text = payload.trim();
    if (!text) return null;
    if (topic.endsWith(".z")) {
      try {
        return decodeF1TimingZPayload(JSON.parse(text));
      } catch {
        return decodeF1TimingZPayload(text);
      }
    }
    return JSON.parse(text);
  }
  return topic.endsWith(".z") ? decodeF1TimingZPayload(payload) : payload;
}

function f1TimingLiveDataWithFeedTime(topic, data, feedUtc) {
  const utc = typeof feedUtc === "string" && Number.isFinite(Date.parse(feedUtc)) ? feedUtc : "";
  if (!utc || !data || typeof data !== "object") return data;
  if (!["CarData.z", "CarData"].includes(String(topic)) || !Array.isArray(data.Entries)) return data;
  return {
    ...data,
    Entries: data.Entries.map((entry) => (
      entry && typeof entry === "object" && !entry.Utc ? { ...entry, Utc: utc } : entry
    )),
  };
}

const F1_TIMING_LIVE_FEED_LATENCY_MAX_SECONDS = 15;
const F1_TIMING_LIVE_FEED_LATENCY_SAMPLE_LIMIT = 48;
// Empirical F1 TV offset between the stream's program-date playhead and the
// picture on screen; the measured feed latency can exceed it but never shrinks
// the alignment below this floor.
const F1_TIMING_LIVE_STREAM_ALIGNMENT_SECONDS = 4.6;
// When Q2→Q3 (or any session re-arm) refreshes latency samples, the median can
// fall several seconds in one poll. Peak-hold alignment and only slowly decay so
// live timing does not suddenly run ahead of the picture mid-session.
const F1_TIMING_LIVE_ALIGNMENT_DECAY_PER_MINUTE = 0.2;

function f1LiveTimingFeedLatencySeconds(samples) {
  const values = (Array.isArray(samples) ? samples : [])
    .map((value) => finiteNumber(value))
    .filter((value) => value != null && value >= 0)
    .sort((a, b) => a - b);
  if (!values.length) return 0;
  const median = values[Math.floor(values.length / 2)];
  return Math.max(0, Math.min(F1_TIMING_LIVE_FEED_LATENCY_MAX_SECONDS, median));
}

function f1LiveTimingStreamAlignmentSeconds(state = f1LiveTimingState, nowMs = Date.now()) {
  const floor = F1_TIMING_LIVE_STREAM_ALIGNMENT_SECONDS;
  const measured = f1LiveTimingFeedLatencySeconds(state?.feedLatencySamples);
  const instant = Math.max(measured, floor);
  if (!state || typeof state !== "object") return instant;
  const peak = finiteNumber(state.streamAlignmentPeak);
  const wallMs = Number(nowMs);
  if (peak == null || instant > peak) {
    state.streamAlignmentPeak = instant;
    state.streamAlignmentPeakAtMs = wallMs;
    return instant;
  }
  // Decay only slowly toward the current instant. A 3s Q-session jump-ahead
  // would otherwise take the median collapsing from ~7.6s to the 4.6s floor.
  const sinceMs = Math.max(0, wallMs - (finiteNumber(state.streamAlignmentPeakAtMs) ?? wallMs));
  const decay = (sinceMs / 60000) * F1_TIMING_LIVE_ALIGNMENT_DECAY_PER_MINUTE;
  if (decay >= 0.05 && peak > instant) {
    const nextPeak = Math.max(instant, peak - decay);
    state.streamAlignmentPeak = nextPeak;
    state.streamAlignmentPeakAtMs = wallMs;
    return nextPeak;
  }
  return Math.max(peak, floor);
}

function f1LiveTimingEntrySeconds(feedUtcMs, nowMs, feedLatencySeconds) {
  const feedMs = finiteNumber(feedUtcMs);
  if (feedMs != null) return feedMs / 1000;
  const latency = Math.max(0, Math.min(F1_TIMING_LIVE_FEED_LATENCY_MAX_SECONDS, finiteNumber(feedLatencySeconds) ?? 0));
  return Number(nowMs) / 1000 - latency;
}

function applyF1TimingLiveFeed(topic, payload, feedUtc = "") {
  if (!f1LiveTimingState || !topic) return;
  try {
    const data = f1TimingLiveDataWithFeedTime(String(topic), f1TimingLivePayload(String(topic), payload), feedUtc);
    if (!data || typeof data !== "object") return;
    const nowMs = Date.now();
    const feedUtcMs = Date.parse(String(feedUtc || ""));
    if (Number.isFinite(feedUtcMs) && String(topic) !== "Heartbeat") {
      const latencySample = (nowMs - feedUtcMs) / 1000;
      // Deltas beyond any plausible transport latency are clock skew, not latency.
      if (latencySample >= 0 && latencySample < 30) {
        const samples = f1LiveTimingState.feedLatencySamples = f1LiveTimingState.feedLatencySamples || [];
        samples.push(latencySample);
        if (samples.length > F1_TIMING_LIVE_FEED_LATENCY_SAMPLE_LIMIT) samples.splice(0, samples.length - F1_TIMING_LIVE_FEED_LATENCY_SAMPLE_LIMIT);
      }
    }
    const rows = boundedF1TimingLiveEntries(String(topic));
    // Entries live on the feed-UTC timeline so video program-date targets map
    // onto them directly; the max() keeps stamps monotonic when a subscribe
    // snapshot (arrival-stamped) precedes feed-stamped deltas.
    const seconds = Math.max(
      f1LiveTimingEntrySeconds(feedUtcMs, nowMs, f1LiveTimingFeedLatencySeconds(f1LiveTimingState.feedLatencySamples)),
      finiteNumber(rows.at(-1)?.seconds) ?? -Infinity
    );
    rows.push({ time: "", seconds, data });
    f1LiveTimingState.lastMessageAt = nowMs;
    f1LiveTimingState.lastTopic = String(topic);
  } catch (error) {
    f1LiveTimingState.lastError = "Formula 1 live timing payload could not be parsed.";
  }
}

function applyF1TimingSignalRMessage(message) {
  if (!message || typeof message !== "object") return;
  if (message.type === 1 && String(message.target || "").toLowerCase() === "feed") {
    const args = message.arguments || message.A || [];
    if (args.length >= 2) applyF1TimingLiveFeed(args[0], args[1], args[2]);
    return;
  }
  if (Array.isArray(message.M)) {
    for (const hubMessage of message.M) {
      if (!hubMessage || typeof hubMessage !== "object") continue;
      if (String(hubMessage.M || "").toLowerCase() !== "feed") continue;
      const args = hubMessage.A || [];
      if (args.length >= 2) applyF1TimingLiveFeed(args[0], args[1], args[2]);
    }
  }
  const result = message.result || message.R;
  if (result && typeof result === "object") {
    for (const [topic, payload] of Object.entries(result)) applyF1TimingLiveFeed(topic, payload);
  }
}

function f1TimingLiveTopicDiagnostics(entriesByTopic = {}) {
  const topicCounts = {};
  for (const [topic, entries] of Object.entries(entriesByTopic || {})) {
    const count = Array.isArray(entries) ? entries.length : 0;
    if (count) topicCounts[topic] = count;
  }
  const carDataRows = []
    .concat(Array.isArray(entriesByTopic["CarData.z"]) ? entriesByTopic["CarData.z"] : [])
    .concat(Array.isArray(entriesByTopic.CarData) ? entriesByTopic.CarData : []);
  const latestCarData = carDataRows.at(-1)?.data || {};
  const carDataEntries = Array.isArray(latestCarData.Entries) ? latestCarData.Entries : [];
  const firstEntry = carDataEntries.find(Boolean) || {};
  const firstCar = Object.values(firstEntry.Cars || {}).find(Boolean) || {};
  const latestSessionInfo = (Array.isArray(entriesByTopic.SessionInfo) ? entriesByTopic.SessionInfo : []).at(-1)?.data || {};
  const meeting = latestSessionInfo.Meeting || latestSessionInfo.meeting || {};
  return {
    topicCounts,
    carDataMessages: carDataRows.length,
    carDataInnerEntries: carDataEntries.length,
    carDataHasUtc: carDataEntries.some((entry) => Number.isFinite(Date.parse(entry?.Utc || ""))),
    carDataFirstEntryKeys: Object.keys(firstEntry).slice(0, 8),
    carDataFirstChannelKeys: Object.keys(firstCar.Channels || {}).slice(0, 12),
    sessionInfo: {
      year: finiteNumber(meeting.Year ?? latestSessionInfo.Year),
      meetingName: String(meeting.Name || meeting.OfficialName || latestSessionInfo.MeetingName || "").slice(0, 80),
      location: String(meeting.Location || latestSessionInfo.Location || "").slice(0, 80),
      sessionName: String(latestSessionInfo.Name || latestSessionInfo.SessionName || "").slice(0, 80),
      startDate: String(latestSessionInfo.StartDate || latestSessionInfo.StartTime || "").slice(0, 40),
      gmtOffset: String(latestSessionInfo.GmtOffset || "").slice(0, 20),
    },
  };
}

function f1LiveTimingCatchUpRemainingSeconds(entriesByTopic = {}, options = {}) {
  const timingEntries = Array.isArray(entriesByTopic.TimingData) ? entriesByTopic.TimingData : [];
  let firstTimingSeconds = null;
  for (const entry of timingEntries) {
    const seconds = finiteNumber(entry?.seconds);
    if (seconds == null) continue;
    if (firstTimingSeconds == null || seconds < firstTimingSeconds) firstTimingSeconds = seconds;
  }
  if (firstTimingSeconds == null) return null;
  const rawTargetUtcMs = options.targetUtcMs ?? options.targetUtc;
  const parsedTargetUtcMs = typeof rawTargetUtcMs === "string" ? Date.parse(rawTargetUtcMs) : Number(rawTargetUtcMs);
  const targetUtcMs = Number.isFinite(parsedTargetUtcMs) ? parsedTargetUtcMs : null;
  const targetLatencySeconds = Math.max(0, Math.min(90, Number(options.targetLatencySeconds || 0)));
  const targetSeconds = targetUtcMs != null
    ? f1TimingArchiveSecondsForUtc({ clockEntries: entriesByTopic.ExtrapolatedClock || [], archiveStartUtcMs: 0 }, targetUtcMs) - f1LiveTimingStreamAlignmentSeconds(f1LiveTimingState)
    : Date.now() / 1000 - targetLatencySeconds;
  const remainingSeconds = firstTimingSeconds - targetSeconds;
  if (!Number.isFinite(remainingSeconds) || remainingSeconds <= 0) return null;
  return Math.round(remainingSeconds * 10) / 10;
}

function f1TimingLiveClientIsStale(client, state, nowMs = Date.now()) {
  const lastMessageAt = finiteNumber(state?.lastMessageAt);
  const connectedAt = finiteNumber(client?.connectedAt);
  const latestActivityAt = Math.max(
    lastMessageAt != null && lastMessageAt > 0 ? lastMessageAt : 0,
    connectedAt != null && connectedAt > 0 ? connectedAt : 0,
  );
  const now = finiteNumber(nowMs);
  return Boolean(
    client?.connected &&
    latestActivityAt > 0 &&
    now != null &&
    now - latestActivityAt > F1_TIMING_LIVE_STALE_MS
  );
}

function closeF1TimingLiveClient(client) {
  const socket = client?.socket;
  if (!socket) return;
  try {
    socket.onclose = null;
    socket.onmessage = null;
    socket.onerror = null;
    socket.close();
  } catch {}
}

function recoverStaleF1TimingLiveClient(nowMs = Date.now()) {
  if (!f1TimingLiveClientIsStale(f1LiveTimingClient, f1LiveTimingState, nowMs)) return false;
  const staleClient = f1LiveTimingClient;
  f1LiveTimingClient = null;
  closeF1TimingLiveClient(staleClient);
  ensureF1TimingLiveClient().catch(() => {});
  return true;
}

function resyncF1LiveTiming() {
  if (f1LiveTimingState) {
    f1LiveTimingState.feedLatencySamples = [];
    f1LiveTimingState.streamAlignmentPeak = null;
    f1LiveTimingState.streamAlignmentPeakAtMs = null;
  }
  closeF1TimingLiveClient(f1LiveTimingClient);
  f1LiveTimingClient = null;
  ensureF1TimingLiveClient().catch(() => {});
  return { ok: true };
}

async function ensureF1TimingLiveClient() {
  if (f1LiveTimingClient?.connecting || f1LiveTimingClient?.connected) return;
  const now = Date.now();
  if (f1LiveTimingClient?.nextAttemptAt && now < f1LiveTimingClient.nextAttemptAt) return;
  const client = { connecting: true, connected: false, nextAttemptAt: now + F1_TIMING_LIVE_CONNECT_RETRY_MS };
  f1LiveTimingClient = client;
  f1LiveTimingState = f1LiveTimingState || { entriesByTopic: {}, lastMessageAt: 0, lastTopic: "", lastError: "" };
  try {
    const signalRCookie = await requestF1TimingSignalRCookie();
    if (f1LiveTimingClient !== client) return;
    const negotiate = await requestF1TimingJsonPost(F1_TIMING_NEGOTIATE_URL, 10000, signalRCookie ? { Cookie: signalRCookie } : {});
    if (f1LiveTimingClient !== client) return;
    const connectionId = String(negotiate?.connectionId || negotiate?.connectionToken || "");
    if (!connectionId) throw new Error("Formula 1 live timing did not return a SignalR connection id.");
    const subscriptionToken = String(await getF1TvSubscriptionToken() || "").trim();
    if (f1LiveTimingClient !== client) return;
    client.authTokenAttached = Boolean(subscriptionToken);
    client.signalRCookieAttached = Boolean(signalRCookie);
    const liveUrl = new URL(F1_TIMING_SIGNALR_URL);
    liveUrl.searchParams.set("id", connectionId);
    if (subscriptionToken) liveUrl.searchParams.set("authToken", subscriptionToken);
    const wsHeaders = {};
    if (signalRCookie) wsHeaders.Cookie = signalRCookie;
    const ws = createF1TimingWebSocket(liveUrl.href, wsHeaders);
    if (f1LiveTimingClient !== client) {
      closeF1TimingLiveClient({ socket: ws });
      return;
    }
    client.socket = ws;
    ws.onopen = () => {
      if (f1LiveTimingClient !== client) return;
      client.connectedAt = Date.now();
      client.connected = true;
      client.connecting = false;
      ws.send(`${JSON.stringify({ protocol: "json", version: 1 })}\x1e`);
      ws.send(`${JSON.stringify({ type: 1, target: "Subscribe", arguments: [F1_TIMING_SIGNALR_TOPICS], invocationId: "0" })}\x1e`);
    };
    ws.onmessage = async (event) => {
      if (f1LiveTimingClient !== client) return;
      let text = event.data;
      if (typeof text !== "string") {
        const buffer = await event.data.arrayBuffer?.() || event.data;
        if (f1LiveTimingClient !== client) return;
        text = Buffer.from(buffer).toString("utf8");
      }
      for (const chunk of String(text).split("\x1e").filter(Boolean)) {
        if (f1LiveTimingClient !== client) return;
        try {
          applyF1TimingSignalRMessage(JSON.parse(chunk));
        } catch {}
      }
    };
    ws.onerror = () => {
      if (f1LiveTimingClient !== client) return;
      client.error = "Formula 1 live timing WebSocket error.";
    };
    ws.onclose = () => {
      if (f1LiveTimingClient !== client) return;
      client.connected = false;
      client.connecting = false;
      client.nextAttemptAt = Date.now() + F1_TIMING_LIVE_CLOSE_RETRY_MS;
    };
  } catch (error) {
    if (f1LiveTimingClient !== client) return;
    client.connected = false;
    client.connecting = false;
    client.nextAttemptAt = Date.now() + F1_TIMING_LIVE_CONNECT_RETRY_MS;
    client.error = error?.message || "Formula 1 live timing unavailable";
  }
}

function getF1LiveTimingSnapshot(options = {}) {
  if (!recoverStaleF1TimingLiveClient()) ensureF1TimingLiveClient().catch(() => {});
  if (!f1LiveTimingState?.lastMessageAt || Date.now() - f1LiveTimingState.lastMessageAt > F1_TIMING_LIVE_STALE_MS) return null;
  const entriesByTopic = f1LiveTimingState.entriesByTopic || {};
  const targetLatencySeconds = Math.max(0, Math.min(90, Number(options.targetLatencySeconds || 0)));
  const sessionData = {
    driverListEntries: entriesByTopic.DriverList || [],
    timingEntries: entriesByTopic.TimingData || [],
    timingAppEntries: entriesByTopic.TimingAppData || [],
    timingStatsEntries: entriesByTopic.TimingStats || [],
    clockEntries: entriesByTopic.ExtrapolatedClock || [],
    archiveStartUtcMs: 0,
    sessionInfoEntries: entriesByTopic.SessionInfo || [],
    sessionDataEntries: entriesByTopic.SessionData || [],
    sessionStatusEntries: entriesByTopic.SessionStatus || [],
    trackStatusEntries: entriesByTopic.TrackStatus || [],
    raceControlEntries: entriesByTopic.RaceControlMessages || [],
    lapCountEntries: entriesByTopic.LapCount || [],
    weatherEntries: entriesByTopic.WeatherData || [],
    carDataEntries: []
      .concat(entriesByTopic["CarData.z"] || [])
      .concat(entriesByTopic.CarData || []),
    positionEntries: []
      .concat(entriesByTopic["Position.z"] || [])
      .concat(entriesByTopic.Position || []),
  };
  const rawTargetUtcMs = options.targetUtcMs ?? options.targetUtc;
  const parsedTargetUtcMs = typeof rawTargetUtcMs === "string" ? Date.parse(rawTargetUtcMs) : Number(rawTargetUtcMs);
  const targetUtcMs = Number.isFinite(parsedTargetUtcMs) ? parsedTargetUtcMs : null;
  const feedLatencySeconds = f1LiveTimingFeedLatencySeconds(f1LiveTimingState?.feedLatencySamples);
  const streamAlignmentSeconds = f1LiveTimingStreamAlignmentSeconds(f1LiveTimingState);
  const targetSeconds = targetUtcMs != null
    ? f1TimingArchiveSecondsForUtc(sessionData, targetUtcMs) - streamAlignmentSeconds
    : Date.now() / 1000 - targetLatencySeconds;
  const hasTimingTarget = (targetUtcMs != null && Number.isFinite(targetSeconds)) || Boolean(targetLatencySeconds);
  let parsed = parseF1TimingArchiveRows(sessionData, hasTimingTarget ? targetSeconds : Number.MAX_SAFE_INTEGER, { preserveSectorProgress: true });
  if (hasTimingTarget && parsed.timing.length && parsed.timing.some((row) => (
    finiteNumber(row?.telemetry?.speed) == null || finiteNumber(row?.telemetry?.gear) == null
  ))) {
    const latest = parseF1TimingArchiveRows(sessionData, Number.MAX_SAFE_INTEGER, { preserveSectorProgress: true });
    if (latest.timing.length) {
      const latestByNumber = new Map();
      const latestByCode = new Map();
      latest.timing.forEach((row) => {
        const number = finiteNumber(row?.number);
        if (number != null) latestByNumber.set(number, row);
        if (row?.code) latestByCode.set(String(row.code), row);
      });
      let telemetryFallbackRows = 0;
      const timing = parsed.timing.map((row) => {
        const current = row.telemetry || {};
        if (finiteNumber(current.speed) != null && finiteNumber(current.gear) != null) return row;
        const number = finiteNumber(row?.number);
        const latestRow = (number != null ? latestByNumber.get(number) : null) || latestByCode.get(String(row?.code || ""));
        const latestTelemetry = latestRow?.telemetry || {};
        let changed = false;
        const telemetry = { ...current };
        ["speed", "gear", "throttle", "brake"].forEach((key) => {
          if (finiteNumber(telemetry[key]) == null && finiteNumber(latestTelemetry[key]) != null) {
            telemetry[key] = latestTelemetry[key];
            changed = true;
          }
        });
        if (!changed) return row;
        telemetryFallbackRows += 1;
        return { ...row, telemetry };
      });
      if (telemetryFallbackRows) parsed = { ...parsed, timing, diagnostics: { ...parsed.diagnostics, telemetryFallbackRows } };
    }
  }
  if (!parsed.timing.length) return null;
  return {
    ok: true,
    sourceLabel: targetUtcMs != null ? `Formula 1 live timing @ ${new Date(targetUtcMs).toISOString()}` : targetLatencySeconds ? `Formula 1 live timing -${Math.round(targetLatencySeconds)}s` : "Formula 1 live timing",
    fetchedAt: new Date().toISOString(),
    timing: parsed.timing,
    weather: parsed.weather,
    sessionClock: parsed.sessionClock,
    raceControlMessages: parsed.raceControlMessages,
    errors: [],
    diagnostics: {
      ...(parsed.diagnostics || {}),
      ...f1TimingLiveTopicDiagnostics(entriesByTopic),
      authTokenAttached: Boolean(f1LiveTimingClient?.authTokenAttached),
      signalRCookieAttached: Boolean(f1LiveTimingClient?.signalRCookieAttached),
      targetLatencySeconds,
      targetUtcMs,
      feedLatencySeconds,
      streamAlignmentSeconds,
    },
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

async function fetchOpenF1WeekendWeather(race, options = {}) {
  const meetingKey = String(race?.meetingKey || "").replace(/[^0-9]/g, "");
  if (!meetingKey) return [];
  const sessions = await requestOpenF1Json(openF1ApiUrl("sessions", { meeting_key: meetingKey }), { priority: options.priority }).catch(() => []);
  const session = pickOpenF1WeatherSession(sessions);
  if (!session?.session_key) return [];
  return requestOpenF1Json(openF1ApiUrl("weather", { session_key: session.session_key }), { priority: options.priority }).catch(() => []);
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

function replayRowsTimeline(rows) {
  if (!Array.isArray(rows) || !rows.length) return [];
  const cached = replayRowTimelineCache.get(rows);
  if (cached) return cached;
  const timeline = rows
    .map((row, index) => {
      const rowMs = replayRowDateMs(row);
      return { row, index, rowMs, sortMs: rowMs ?? 0 };
    })
    .sort((a, b) => a.sortMs - b.sortMs || a.index - b.index);
  replayRowTimelineCache.set(rows, timeline);
  return timeline;
}

function filterReplayRowsAt(rows, targetMs) {
  if (!Array.isArray(rows) || !rows.length) return [];
  const timeline = replayRowsTimeline(rows);
  let low = 0;
  let high = timeline.length;
  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    if (timeline[middle].sortMs <= targetMs) low = middle + 1;
    else high = middle;
  }
  return timeline.slice(0, low).map((item) => item.row);
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
    const replayRows = await requestOpenF1JsonMap({
      drivers: openF1ApiUrl("drivers", { session_key: sessionKey }),
      positions: openF1ApiUrl("position", { session_key: sessionKey }),
      intervals: openF1ApiUrl("intervals", { session_key: sessionKey }),
      weatherRows: openF1ApiUrl("weather", { session_key: sessionKey }),
      openF1Laps: openF1ApiUrl("laps", { session_key: sessionKey }),
      stints: openF1ApiUrl("stints", { session_key: sessionKey }),
      pitRows: openF1ApiUrl("pit", { session_key: sessionKey }),
    });
    const drivers = Array.isArray(replayRows.raw.drivers) ? replayRows.raw.drivers : [];
    const positions = Array.isArray(replayRows.raw.positions) ? replayRows.raw.positions : [];
    const intervals = Array.isArray(replayRows.raw.intervals) ? replayRows.raw.intervals : [];
    const weatherRows = Array.isArray(replayRows.raw.weatherRows) ? replayRows.raw.weatherRows : [];
    const openF1Laps = Array.isArray(replayRows.raw.openF1Laps) ? replayRows.raw.openF1Laps : [];
    const stints = Array.isArray(replayRows.raw.stints) ? replayRows.raw.stints : [];
    const pitRows = Array.isArray(replayRows.raw.pitRows) ? replayRows.raw.pitRows : [];
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

function replayCarDataChunkStarts(targetMs, carDataOffsetMs = 0, originMs = 0) {
  const carDataTargetMs = Number(targetMs) + Number(carDataOffsetMs || 0);
  if (!Number.isFinite(carDataTargetMs)) return [];
  const chunkOriginMs = Number.isFinite(Number(originMs)) ? Number(originMs) : 0;
  const fromMs = Math.max(0, carDataTargetMs - REPLAY_CAR_DATA_CHUNK_MS);
  const toMs = Math.max(fromMs + 1, carDataTargetMs + 1000);
  const firstChunk = chunkOriginMs + Math.floor((fromMs - chunkOriginMs) / REPLAY_CAR_DATA_CHUNK_MS) * REPLAY_CAR_DATA_CHUNK_MS;
  const lastChunk = chunkOriginMs + Math.floor((toMs - 1 - chunkOriginMs) / REPLAY_CAR_DATA_CHUNK_MS) * REPLAY_CAR_DATA_CHUNK_MS;
  const starts = [];
  for (let chunkStart = firstChunk; chunkStart <= lastChunk; chunkStart += REPLAY_CAR_DATA_CHUNK_MS) {
    starts.push(chunkStart);
  }
  return starts;
}

async function getReplayCarDataChunk(sessionKey, chunkStartMs, carDataOffsetMs = 0, originMs = 0, options = {}) {
  const chunkOriginMs = Number.isFinite(Number(originMs)) ? Number(originMs) : 0;
  const cacheKey = `${sessionKey}:${Number(carDataOffsetMs || 0)}:${chunkOriginMs}:${chunkStartMs}`;
  const nowMs = Number(options.nowMs ?? Date.now());
  const cached = replayCarDataChunkCache.get(cacheKey);
  if (cached?.rows && nowMs - cached.createdAt < REPLAY_CAR_DATA_CACHE_MS) {
    replayCarDataChunkCache.delete(cacheKey);
    replayCarDataChunkCache.set(cacheKey, cached);
    return cached.rows;
  }
  if (cached?.promise) return cached.promise;
  if (cached) replayCarDataChunkCache.delete(cacheKey);
  const fetchJson = options.fetchJson || requestOpenF1Json;
  let pending;
  pending = Promise.resolve(fetchJson(openF1ApiUrl("car_data", {
    session_key: sessionKey,
    "date>": new Date(chunkStartMs).toISOString(),
    "date<": new Date(chunkStartMs + REPLAY_CAR_DATA_CHUNK_MS).toISOString(),
  }))).then((rows) => {
    const value = Array.isArray(rows) ? rows : [];
    if (replayCarDataChunkCache.get(cacheKey)?.promise === pending) {
      replayCarDataChunkCache.set(cacheKey, { createdAt: nowMs, rows: value });
      pruneBoundedMap(replayCarDataChunkCache, REPLAY_CAR_DATA_CACHE_LIMIT);
    }
    return value;
  }).catch((error) => {
    if (replayCarDataChunkCache.get(cacheKey)?.promise === pending) replayCarDataChunkCache.delete(cacheKey);
    throw error;
  });
  replayCarDataChunkCache.set(cacheKey, { createdAt: nowMs, promise: pending });
  pruneBoundedMap(replayCarDataChunkCache, REPLAY_CAR_DATA_CACHE_LIMIT);
  return pending;
}

async function getReplayCarDataSnapshot(sessionKey, targetMs, carDataOffsetMs = 0, originMs = 0, options = {}) {
  const carDataTargetMs = Number(targetMs) + Number(carDataOffsetMs || 0);
  if (!sessionKey || !Number.isFinite(carDataTargetMs)) return [];
  const chunkRows = await Promise.all(
    replayCarDataChunkStarts(targetMs, carDataOffsetMs, originMs)
      .map((chunkStartMs) => getReplayCarDataChunk(sessionKey, chunkStartMs, carDataOffsetMs, originMs, options).catch(() => [])),
  );
  const fromMs = Math.max(0, carDataTargetMs - REPLAY_CAR_DATA_CHUNK_MS);
  const toMs = carDataTargetMs + 1000;
  return chunkRows.flat().filter((row) => {
    const rowMs = replayRowDateMs(row);
    return Number.isFinite(rowMs) && rowMs >= fromMs && rowMs < toMs;
  });
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
  const carData = await getReplayCarDataSnapshot(sessionKey, targetMs, sessionData.carDataOffsetMs || 0, startMs);
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
    lapTimeline: openF1LeaderLapTimeline(sessionData.openF1Laps, startMs),
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
  const cacheKey = `f1:${meetingKey}:${normalizeOpenF1SessionKind(sessionKind)}:${Math.floor(elapsedSeconds * 10)}:${videoStartKey}`;
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
        raceControlMessages: parsed.raceControlMessages,
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

function selectLatestOpenF1Session(sessions, nowMs = Date.now()) {
  const values = (Array.isArray(sessions) ? sessions : [])
    .filter((sessionItem) => sessionItem?.session_key && Number.isFinite(Date.parse(sessionItem.date_start || "")))
    .sort((a, b) => Date.parse(a.date_start) - Date.parse(b.date_start));
  return values.filter((sessionItem) => Date.parse(sessionItem.date_start) <= nowMs).at(-1) || values[0] || null;
}

function buildLatestCarDataRequest(sessionItem, nowMs = Date.now()) {
  if (!sessionItem?.session_key) return null;
  const sessionEndMs = Date.parse(sessionItem.date_end || "");
  const endMs = Number.isFinite(sessionEndMs) ? Math.min(nowMs, sessionEndMs) : nowMs;
  if (!Number.isFinite(endMs)) return null;
  return {
    session_key: sessionItem.session_key,
    "date>": new Date(endMs - 120000).toISOString(),
    "date<": new Date(endMs).toISOString(),
  };
}

function liveTimingEnrichmentUrls(sessions, nowMs = Date.now()) {
  const urls = { ...LIVE_TIMING_ENRICHMENT_URLS, openF1Weather: LIVE_CORE_DATA_URLS.openF1Weather };
  const carDataRequest = buildLatestCarDataRequest(selectLatestOpenF1Session(sessions, nowMs), nowMs);
  if (carDataRequest) urls.openF1CarData = openF1ApiUrl("car_data", carDataRequest);
  return urls;
}

function liveBackgroundEnrichmentUrls(sessions, nowMs = Date.now()) {
  return {
    ...LIVE_BACKGROUND_ENRICHMENT_URLS,
    ...liveTimingEnrichmentUrls(sessions, nowMs),
  };
}

async function getLiveTimingSnapshot(options = {}) {
  const targetLatencySeconds = Math.max(0, Math.min(90, Number(options.targetLatencySeconds || 0)));
  const rawTargetUtcMs = options.targetUtcMs ?? options.targetUtc;
  const parsedTargetUtcMs = typeof rawTargetUtcMs === "string" ? Date.parse(rawTargetUtcMs) : Number(rawTargetUtcMs);
  const targetUtcMs = Number.isFinite(parsedTargetUtcMs) ? parsedTargetUtcMs : undefined;
  const requestedSource = String(options.source || options.provider || "").toLowerCase().replace(/[^a-z0-9]+/g, "");
  const f1Only = requestedSource === "f1" || requestedSource === "formula1";
  const f1Timing = getF1LiveTimingSnapshot({ targetLatencySeconds, targetUtcMs });
  if (f1Timing?.timing?.length) return f1Timing;
  if (f1Only && f1LiveTimingState?.lastMessageAt) {
    const catchUpRemainingSeconds = f1LiveTimingCatchUpRemainingSeconds(f1LiveTimingState.entriesByTopic || {}, { targetLatencySeconds, targetUtcMs });
    return {
      ok: true,
      catchingUp: true,
      catchUpRemainingSeconds,
      sourceLabel: "Formula 1 live timing catching up",
      fetchedAt: new Date().toISOString(),
      timing: [],
      weather: {},
      errors: f1LiveTimingState?.lastError ? [f1LiveTimingState.lastError] : [],
      message: "Formula 1 live timing is catching up to the video buffer.",
    };
  }
  if (f1Only) {
    return {
      ok: false,
      sourceLabel: "Formula 1 live timing unavailable",
      fetchedAt: new Date().toISOString(),
      timing: [],
      weather: {},
      errors: f1LiveTimingState?.lastError ? [f1LiveTimingState.lastError] : [],
      message: f1LiveTimingState?.lastMessageAt ? "Formula 1 live timing is still warming up." : "Formula 1 live timing is still connecting.",
    };
  }
  const cacheKey = `openf1:${Math.round(targetLatencySeconds)}`;
  if (liveTimingCache?.key === cacheKey && Date.now() - liveTimingCache.createdAt < 15000) return liveTimingCache.data;
  const latestSessions = await requestOpenF1Json(openF1ApiUrl("sessions", { session_key: "latest" })).catch(() => []);
  const timingUrls = liveTimingEnrichmentUrls(latestSessions, Date.now());
  const keys = ["openF1Drivers", "openF1Position", "openF1Intervals", "openF1Laps", "openF1Stints", "openF1Pit", "openF1Weather", "openF1CarData"];
  const timingRequests = Object.fromEntries(keys.filter((key) => timingUrls[key]).map((key) => [key, timingUrls[key]]));
  const entries = await requestOpenF1JsonMap(timingRequests);
  const raw = {};
  const errors = [];
  for (const result of Object.entries(entries.raw).map(([key, value]) => ({ key, value }))) {
    if (!result.error) raw[result.key] = result.value;
  }
  for (const result of entries.errors) {
    if (!OPTIONAL_LIVE_DATA_KEYS.has(result.key)) errors.push(result.error.message);
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
    message: timing.length ? "" : "Live timing is still warming up.",
  };
  liveTimingCache = { key: cacheKey, createdAt: Date.now(), data };
  return data;
}

function liveTimingSectorProgress(row = {}) {
  const sectors = row.sectors || {};
  const count = (key) => Array.isArray(sectors[key]) ? sectors[key].filter((tone) => tone && tone !== "off").length : 0;
  const s1 = count("s1");
  const s2 = count("s2");
  const s3 = count("s3");
  return { s1, s2, s3, total: s1 + s2 + s3 };
}

function liveTimingDiagnosticSample(snapshot = {}, startedAt = Date.now()) {
  const rows = Array.isArray(snapshot.timing) ? snapshot.timing : [];
  const lap = Number(snapshot.sessionClock?.lapCount?.lap || 0) || null;
  const rowHasSectorTime = (row) => ["s1", "s2", "s3"].some((key) => finiteNumber(row.sectorTimes?.[key]) != null);
  const rowHasCompleteSectorTimes = (row) => ["s1", "s2", "s3"].every((key) => finiteNumber(row.sectorTimes?.[key]) != null);
  const rowHasBestSectorTime = (row) => ["s1", "s2", "s3"].some((key) => finiteNumber(row.bestSectorTimes?.[key]) != null);
  return {
    t: Math.round((Date.now() - startedAt) / 100) / 10,
    ok: Boolean(snapshot.ok),
    sourceLabel: String(snapshot.sourceLabel || ""),
    lap,
    rowCount: rows.length,
    diagnostics: {
      telemetryRows: finiteNumber(snapshot.diagnostics?.telemetryRows),
      carDataEntries: finiteNumber(snapshot.diagnostics?.carDataEntries),
      carDataMessages: finiteNumber(snapshot.diagnostics?.carDataMessages),
      carDataInnerEntries: finiteNumber(snapshot.diagnostics?.carDataInnerEntries),
      carDataHasUtc: Boolean(snapshot.diagnostics?.carDataHasUtc),
      carDataFirstEntryKeys: Array.isArray(snapshot.diagnostics?.carDataFirstEntryKeys) ? snapshot.diagnostics.carDataFirstEntryKeys : [],
      carDataFirstChannelKeys: Array.isArray(snapshot.diagnostics?.carDataFirstChannelKeys) ? snapshot.diagnostics.carDataFirstChannelKeys : [],
      sessionInfo: snapshot.diagnostics?.sessionInfo || {},
      authTokenAttached: Boolean(snapshot.diagnostics?.authTokenAttached),
      signalRCookieAttached: Boolean(snapshot.diagnostics?.signalRCookieAttached),
      lastLapRows: finiteNumber(snapshot.diagnostics?.lastLapRows) ?? rows.filter((row) => finiteNumber(row.lastLapDuration) != null).length,
      bestLapRows: finiteNumber(snapshot.diagnostics?.bestLapRows) ?? rows.filter((row) => finiteNumber(row.bestLapDuration) != null).length,
      sectorTimeRows: finiteNumber(snapshot.diagnostics?.sectorTimeRows) ?? rows.filter(rowHasSectorTime).length,
      completeSectorTimeRows: finiteNumber(snapshot.diagnostics?.completeSectorTimeRows) ?? rows.filter(rowHasCompleteSectorTimes).length,
      bestSectorTimeRows: finiteNumber(snapshot.diagnostics?.bestSectorTimeRows) ?? rows.filter(rowHasBestSectorTime).length,
      topicCounts: snapshot.diagnostics?.topicCounts || {},
    },
    top: rows.slice(0, 5).map((row) => ({
      code: String(row.code || ""),
      pos: Number(row.pos || 0) || null,
      lap: Number(row.sessionLap || lap || 0) || null,
      last: String(row.last || ""),
      best: String(row.best || ""),
      lastLapDuration: finiteNumber(row.lastLapDuration),
      bestLapDuration: finiteNumber(row.bestLapDuration),
      sectorTimes: {
        s1: finiteNumber(row.sectorTimes?.s1),
        s2: finiteNumber(row.sectorTimes?.s2),
        s3: finiteNumber(row.sectorTimes?.s3),
      },
      bestSectorTimes: {
        s1: finiteNumber(row.bestSectorTimes?.s1),
        s2: finiteNumber(row.bestSectorTimes?.s2),
        s3: finiteNumber(row.bestSectorTimes?.s3),
      },
      progress: liveTimingSectorProgress(row),
      telemetry: {
        speed: finiteNumber(row.telemetry?.speed),
        gear: finiteNumber(row.telemetry?.gear),
      },
    })),
  };
}

function liveTimingDiagnosticIssues(samples = []) {
  const lapBacktracks = [];
  const sectorBacktracks = [];
  const driverLapBacktracks = [];
  let previousLap = null;
  const previousByCode = new Map();
  for (const sample of samples) {
    if (sample.lap != null && previousLap != null && sample.lap < previousLap) {
      lapBacktracks.push({ t: sample.t, previousLap, lap: sample.lap });
    }
    if (sample.lap != null) previousLap = sample.lap;
    for (const row of sample.top || []) {
      if (!row.code) continue;
      const previous = previousByCode.get(row.code);
      const lap = row.lap;
      const total = Number(row.progress?.total || 0);
      if (previous) {
        if (lap != null && previous.lap != null && lap < previous.lap) {
          driverLapBacktracks.push({ t: sample.t, code: row.code, previousLap: previous.lap, lap });
        } else if (lap === previous.lap && total < previous.progressTotal) {
          sectorBacktracks.push({ t: sample.t, code: row.code, lap, previousProgress: previous.progress, progress: row.progress });
        }
      }
      previousByCode.set(row.code, { lap, progress: row.progress, progressTotal: total });
    }
  }
  return { lapBacktracks, sectorBacktracks, driverLapBacktracks };
}

async function runLiveTimingDiagnosticAndQuit() {
  if (!process.env.PITWALL_LIVE_TIMING_DIAG) return false;
  const targetLatencySeconds = Math.max(0, Math.min(90, Number(process.env.PITWALL_LIVE_TIMING_TARGET_SECONDS || 36) || 36));
  const sampleSeconds = Math.max(5, Math.min(120, Number(process.env.PITWALL_LIVE_TIMING_SAMPLE_SECONDS || 25) || 25));
  const sampleIntervalMs = Math.max(250, Math.min(5000, Number(process.env.PITWALL_LIVE_TIMING_SAMPLE_INTERVAL_MS || 1000) || 1000));
  const connectTimeoutMs = Math.max(1000, Math.min(30000, Number(process.env.PITWALL_LIVE_TIMING_CONNECT_TIMEOUT_MS || 12000) || 12000));
  const authProbeTimeoutMs = Math.max(0, Math.min(10000, Number(process.env.PITWALL_LIVE_TIMING_AUTH_PROBE_MS || 2500) || 0));
  const authStatus = authProbeTimeoutMs
    ? await probeF1TvStoredAuth({ timeoutMs: authProbeTimeoutMs }).catch(() => getF1TvStatus().catch(() => ({})))
    : await getF1TvStatus().catch(() => ({}));
  const subscriptionTokenReady = Boolean(await getF1TvSubscriptionToken().catch(() => ""));
  const startedAt = Date.now();
  const samples = [];
  let firstSnapshot = null;
  while (Date.now() - startedAt < connectTimeoutMs) {
    firstSnapshot = await getLiveTimingSnapshot({ source: "f1", targetLatencySeconds });
    if (firstSnapshot?.timing?.length) break;
    await wait(500);
  }
  const sampleStartedAt = Date.now();
  if (firstSnapshot) samples.push(liveTimingDiagnosticSample(firstSnapshot, sampleStartedAt));
  while (Date.now() - sampleStartedAt < sampleSeconds * 1000) {
    await wait(sampleIntervalMs);
    const snapshot = await getLiveTimingSnapshot({ source: "f1", targetLatencySeconds });
    samples.push(liveTimingDiagnosticSample(snapshot || {}, sampleStartedAt));
  }
  const issues = liveTimingDiagnosticIssues(samples);
  const hasRows = samples.some((sample) => sample.rowCount > 0);
  const ok = Boolean(hasRows && !issues.lapBacktracks.length && !issues.sectorBacktracks.length && !issues.driverLapBacktracks.length);
  const result = {
    ok,
    targetLatencySeconds,
    sampleSeconds,
    sampleIntervalMs,
    sampleCount: samples.length,
    authStatus: {
      authenticated: Boolean(authStatus.authenticated),
      playbackTokenReady: Boolean(authStatus.playbackTokenReady),
      subscriptionTokenReady,
      browserSession: Boolean(authStatus.browserSession),
      cookieCount: authStatus.cookieCount || 0,
      authCookieNames: authStatus.authCookieNames || [],
      storageAuthKeyCount: (authStatus.storageAuthKeys || []).length,
      userDataPath: authStatus.userDataPath || PITWALL_USER_DATA,
    },
    rowCounts: samples.map((sample) => sample.rowCount),
    laps: samples.map((sample) => sample.lap),
    issues,
    samples: samples.slice(0, 40),
    message: hasRows ? "" : "Formula 1 live timing did not produce rows during the diagnostic window.",
  };
  writePitWallDebugLog("f1timing.live-diagnostic", {
    ok,
    targetLatencySeconds,
    sampleCount: samples.length,
    authStatus: result.authStatus,
    laps: result.laps,
    issues,
    message: result.message,
  });
  console.log(JSON.stringify({ pitwallLiveTimingDiagnostic: result }, null, 2));
  app.exit(ok ? 0 : 2);
  return true;
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
    source: "OpenF1 latest session plus Apexline live feeds",
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
  const message = String(error?.message || error || "AI calculation failed.");
  if (/Timeout for https:\/\/chatgpt\.com\/backend-api\/codex\/responses/i.test(message)) {
    return "ChatGPT/Codex provider timed out. Apexline will retry daily projections shortly.";
  }
  return message
    .replace(/[A-Za-z0-9_-]{80,}/g, "[redacted]")
    .slice(0, 240);
}

function sanitizeCopilotInsightsCache(value) {
  if (Array.isArray(value)) return value.map(sanitizeCopilotInsightsCache);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, sanitizeCopilotInsightsCache(item)]));
  }
  if (typeof value !== "string") return value;
  return value.replace(
    /Timeout for https:\/\/chatgpt\.com\/backend-api\/codex\/responses/gi,
    () => sanitizeAiError("Timeout for https://chatgpt.com/backend-api/codex/responses"),
  );
}

function copilotCacheHasRawAiTimeout(value) {
  const text = typeof value === "string" ? value : JSON.stringify(value || {});
  return /Timeout for https:\/\/chatgpt\.com\/backend-api\/codex\/responses/i.test(String(text || ""));
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

function raceWeekendIsActive(race = {}) {
  if (race.status === "live") return true;
  if (race.status === "done") return false;
  const sessions = Array.isArray(race.sessions) ? race.sessions : [];
  const hasStartedSession = sessions.some((session) => session.status && session.status !== "upcoming");
  const hasPendingSession = sessions.some((session) => !session.status || session.status === "upcoming");
  return hasStartedSession && hasPendingSession;
}

function raceWeekendKey(race = {}) {
  return String(race.meetingKey || race.rnd || race.startsAt || race.name || "");
}

function copilotSessionIdentity(session = {}) {
  return {
    kind: String(session.kind || session.type || session.name || ""),
    startsAt: String(session.startsAt || session.dateStart || session.date_start || ""),
    status: String(session.status || ""),
  };
}

function copilotRaceIdentity(race = {}) {
  const round = finiteNumber(race.rnd) ?? finiteNumber(race.round);
  return {
    key: raceWeekendKey(race),
    round: round == null ? null : round,
    name: String(race.name || race.raceName || ""),
    circuit: String(race.circuit || ""),
    loc: String(race.loc || race.location || ""),
    startsAt: String(race.startsAt || race.dateStart || race.date_start || ""),
    status: String(race.status || ""),
    sessions: (Array.isArray(race.sessions) ? race.sessions : []).map(copilotSessionIdentity),
  };
}

function raceWeekendOrderValue(race = {}) {
  const round = finiteNumber(race.rnd);
  if (round != null) return round;
  const startsAt = Date.parse(race.startsAt || "");
  return Number.isFinite(startsAt) ? startsAt : Number.MAX_SAFE_INTEGER;
}

function currentRaceWeekend(schedule = []) {
  const done = (schedule || []).filter((race) => race.status === "done");
  return (schedule || []).find(raceWeekendIsActive) || (schedule || []).find((race) => race.status === "upcoming") || done.at(-1) || {};
}

function nextRaceWeekend(schedule = []) {
  const current = currentRaceWeekend(schedule);
  const currentKey = raceWeekendKey(current);
  const currentOrder = raceWeekendOrderValue(current);
  return (schedule || [])
    .filter((race) => race.status === "upcoming")
    .filter((race) => !currentKey || raceWeekendKey(race) !== currentKey)
    .filter((race) => !currentKey || raceWeekendOrderValue(race) > currentOrder)
    .sort((a, b) => raceWeekendOrderValue(a) - raceWeekendOrderValue(b))[0]
    || (schedule || []).find((race) => race.status === "upcoming" && (!currentKey || raceWeekendKey(race) !== currentKey))
    || {};
}

function nextUpcomingSession(schedule = []) {
  const sessions = [];
  for (const race of schedule || []) {
    for (const sessionItem of race.sessions || []) {
      if (sessionItem.status && sessionItem.status !== "upcoming") continue;
      const startsAt = Date.parse(sessionItem.startsAt || "");
      sessions.push({
        race: race.name || "",
        circuit: race.circuit || "",
        loc: race.loc || "",
        meetingKey: race.meetingKey || "",
        kind: sessionItem.kind || "",
        startsAt: Number.isFinite(startsAt) ? new Date(startsAt).toISOString() : "",
      });
    }
  }
  return sessions
    .filter((sessionItem) => sessionItem.kind)
    .sort((a, b) => Date.parse(a.startsAt || "") - Date.parse(b.startsAt || ""))[0] || {};
}

function copilotInsightTargetFingerprint(data = {}) {
  const summary = data.seasonSummary || {};
  const nextSession = nextUpcomingSession(data.schedule);
  return JSON.stringify({
    schemaVersion: 1,
    season: String(summary.year || summary.season || data.season || ""),
    round: finiteNumber(summary.round) ?? null,
    currentRaceWeekend: copilotRaceIdentity(currentRaceWeekend(data.schedule)),
    nextRaceWeekend: copilotRaceIdentity(nextRaceWeekend(data.schedule)),
    nextUpcomingSession: nextSession?.kind ? copilotSessionIdentity(nextSession) : null,
  });
}

function copilotInsightsCacheMatchesTarget(cached, targetFingerprint) {
  return Boolean(cached?.targetFingerprint && cached.targetFingerprint === targetFingerprint);
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

async function buildWeekendSessionSummaries(data, pageId, options = {}) {
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
      const analytics = await getAnalyticsSession({ season, meetingKey, sessionKind: session.kind, priority: options.priority });
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

function copilotTrackEvidenceWords(race = {}) {
  const generic = new Set(["grand", "prix", "circuit", "autodrome", "international", "round"]);
  return compactText([race.name, race.circuit, race.loc].filter(Boolean).join(" "))
    .split(" ")
    .filter((word) => word.length > 3 && !generic.has(word));
}

function copilotTrackEvidenceScore(targetRace = {}, candidate = {}) {
  const words = copilotTrackEvidenceWords(targetRace);
  if (!words.length) return 0;
  const text = compactText([
    candidate.name,
    candidate.meeting_name,
    candidate.official_name,
    candidate.circuit,
    candidate.circuit_short_name,
    candidate.loc,
    candidate.location,
    candidate.country_name,
  ].filter(Boolean).join(" "));
  return words.filter((word) => text.includes(word)).length;
}

function copilotMeetingToRace(meeting = {}) {
  const startsAt = Date.parse(meeting.date_start || "");
  return {
    name: meeting.meeting_name || "Grand Prix",
    circuit: meeting.circuit_short_name || "",
    loc: [meeting.location, meeting.country_name].filter(Boolean).join(", "),
    startsAt: Number.isFinite(startsAt) ? new Date(startsAt).toISOString() : "",
    status: "done",
    meetingKey: meeting.meeting_key || null,
    season: Number.isFinite(startsAt) ? new Date(startsAt).getUTCFullYear() : null,
  };
}

async function findCopilotHistoricalTrackRaces(data = {}, targetRace = {}, options = {}) {
  const byKey = new Map();
  const addRace = (race) => {
    const meetingKey = String(race?.meetingKey || "").replace(/[^0-9]/g, "");
    if (!meetingKey || meetingKey === String(targetRace?.meetingKey || "")) return;
    if (copilotTrackEvidenceScore(targetRace, race) < 2) return;
    byKey.set(meetingKey, {
      ...race,
      meetingKey,
      season: finiteNumber(race.season) || copilotSessionYear(race, data),
    });
  };

  for (const race of data.schedule || []) {
    if (race?.status === "done") addRace(race);
  }

  const targetSeason = copilotSessionYear(targetRace, data);
  for (const season of [targetSeason - 1, targetSeason - 2, targetSeason - 3].filter((year) => year >= 2023)) {
    const meetings = await requestOpenF1Json(openF1ApiUrl("meetings", { year: season }), { priority: options.priority }).catch((error) => {
      throw new Error(`OpenF1 ${season} meetings unavailable: ${sanitizeAiError(error)}`);
    });
    for (const meeting of meetings || []) {
      if (/grand prix/i.test(String(meeting?.meeting_name || ""))) addRace(copilotMeetingToRace(meeting));
    }
  }

  return Array.from(byKey.values())
    .sort((a, b) => Date.parse(b.startsAt || "") - Date.parse(a.startsAt || ""))
    .slice(0, 2);
}

async function buildCompletedRacePerformance(data = {}, races = [], label = "completed races", options = {}) {
  const performance = {
    label,
    races: [],
    errors: [],
  };
  for (const race of races.slice(0, 4)) {
    const meetingKey = String(race?.meetingKey || "").replace(/[^0-9]/g, "");
    if (!meetingKey) continue;
    try {
      const analytics = await getAnalyticsSession({
        season: finiteNumber(race.season) || copilotSessionYear(race, data),
        meetingKey,
        sessionKind: "Race",
        priority: options.priority,
      });
      performance.races.push({
        season: finiteNumber(race.season) || copilotSessionYear(race, data),
        race: {
          name: race.name || "",
          circuit: race.circuit || "",
          loc: race.loc || "",
          meetingKey,
        },
        session: summarizeWeekendSessionForCopilot({ kind: "Race", status: "done", startsAt: race.startsAt }, analytics),
      });
    } catch (error) {
      performance.errors.push(`${race.name || meetingKey}: ${sanitizeAiError(error)}`);
    }
  }
  performance.available = performance.races.some((race) => race.session?.available);
  return performance;
}

async function fetchCopilotSeasonRaces(season, limit = 4, options = {}) {
  const meetings = await requestOpenF1Json(openF1ApiUrl("meetings", { year: season }), { priority: options.priority }).catch(() => []);
  return (meetings || [])
    .filter((meeting) => /grand prix/i.test(String(meeting?.meeting_name || "")))
    .map(copilotMeetingToRace)
    .sort((a, b) => Date.parse(b.startsAt || "") - Date.parse(a.startsAt || ""))
    .slice(0, limit);
}

async function buildWeekendPerformanceContext(data = {}, targetRace = {}, targetSessionKind = "Race", options = {}) {
  const context = {
    available: false,
    target: {
      race: targetRace?.name || "",
      circuit: targetRace?.circuit || "",
      loc: targetRace?.loc || "",
      session: targetSessionKind || "Race",
    },
    currentSeason: { label: "current season race performance", races: [], errors: [], available: false },
    previousSeason: { label: "previous season race performance", races: [], errors: [], available: false },
    trackHistory: { label: "target-track race history", races: [], errors: [], available: false },
    relevantNews: (data.news || []).slice(0, 8).map((item) => ({
      source: item.source || "",
      title: item.title || "",
      category: item.category || item.tag || "",
      publishedAt: item.publishedAt || "",
    })),
    errors: [],
  };
  if (!targetRace?.name && !targetRace?.circuit) {
    context.errors.push("Next race weekend is unavailable.");
    return context;
  }

  const currentSeasonRaces = (data.schedule || [])
    .filter((race) => race?.status === "done" && race?.meetingKey)
    .slice(-4)
    .reverse();
  context.currentSeason = await buildCompletedRacePerformance(data, currentSeasonRaces, "current season race performance", { priority: options.priority });

  const targetSeason = copilotSessionYear(targetRace, data);
  const previousSeasonRaces = await fetchCopilotSeasonRaces(targetSeason - 1, 4, { priority: options.priority });
  context.previousSeason = await buildCompletedRacePerformance(data, previousSeasonRaces, "previous season race performance", { priority: options.priority });

  try {
    const historicalTrackRaces = await findCopilotHistoricalTrackRaces(data, targetRace, { priority: options.priority });
    context.trackHistory = await buildCompletedRacePerformance(data, historicalTrackRaces, "target-track race history", { priority: options.priority });
  } catch (error) {
    context.trackHistory.errors.push(sanitizeAiError(error));
  }

  context.available = Boolean(context.currentSeason.available || context.previousSeason.available || context.trackHistory.available || context.relevantNews.length);
  return context;
}

async function buildNextWeekendPerformanceContext(data = {}, options = {}) {
  const targetSession = nextUpcomingSession(data.schedule);
  return buildWeekendPerformanceContext(data, nextRaceWeekend(data.schedule), targetSession?.kind || "Race", { priority: options.priority });
}

async function dailyInsightSnapshot(data, pageId, options = {}) {
  const performanceContext = pageId === "next-weekend"
    ? await buildNextWeekendPerformanceContext(data, { priority: options.priority })
    : pageId === "current-weekend"
      ? await buildWeekendPerformanceContext(data, currentRaceWeekend(data.schedule), "Race", { priority: options.priority })
      : null;
  const projectionBudget = championshipPointsBudget(data);
  const projectionConstraints = ["drivers-championship", "constructors-championship"].includes(pageId)
    ? {
      type: pageId === "constructors-championship" ? "constructors_final_points" : "drivers_final_points",
      finalPointsBudget: projectionBudget,
      currentPointsTotal: championshipCurrentPointsTotal(data, pageId),
      remainingPointsBudget: Math.max(0, projectionBudget - championshipCurrentPointsTotal(data, pageId)),
      scoring: "Grand Prix points total 101 across classified points scorers; sprint points total 36. Projected final totals across the returned full order must not exceed finalPointsBudget.",
    }
    : { type: "race_points", perDriverProjectedPointsMin: 0, perDriverProjectedPointsMax: 25 };
  const tyreAvailability = pageId === "current-weekend"
    ? {
      supplied: false,
      guidance: "Driver available tyre sets are not supplied by this snapshot. For a current-weekend stint plan, look up the F1.com Strategy Guide and Pirelli race strategy or tyre graphics for the Tyres Available for Race table when your provider can browse/search; otherwise state that available tyre sets were not supplied.",
    }
    : null;
  return {
    focus: pageId,
    race: data.race,
    currentRaceWeekend: currentRaceWeekend(data.schedule),
    nextRaceWeekend: nextRaceWeekend(data.schedule),
    nextUpcomingSession: nextUpcomingSession(data.schedule),
    seasonSummary: data.seasonSummary,
    drivers: (data.drivers || []).slice(0, 24),
    standings: (data.standings || []).slice(0, 22),
    constructors: (data.constructors || []).slice(0, 11),
    driverForm: data.driverForm || {},
    formRounds: (data.formRounds || []).slice(0, 30),
    timing: (data.timing || []).slice(0, 22),
    sessions: data.sessions || [],
    schedule: (data.schedule || []).slice(0, 30),
    strategyContext: data.strategyContext || null,
    projectionConstraints,
    tyreAvailability,
    weekendSessionSummaries: await buildWeekendSessionSummaries(data, pageId, { priority: options.priority }),
    performanceContext,
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
    leaderboard: [],
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

function copilotInsightPagesForScope(pageId) {
  const scopedPage = COPILOT_INSIGHT_PAGES.find((page) => page.id === String(pageId || ""));
  return scopedPage ? [scopedPage] : COPILOT_INSIGHT_PAGES;
}

function mergeCopilotInsightPages(data, baseDaily, updatedPages = [], summary = "") {
  const fallbackPages = fallbackCopilotInsightPages(data, summary || "Daily AI insight generation is queued for today.");
  const fallbackById = new Map(fallbackPages.map((page) => [page.id, page]));
  const baseById = new Map((Array.isArray(baseDaily?.pages) ? baseDaily.pages : []).map((page) => [page.id, page]));
  const updatedById = new Map((Array.isArray(updatedPages) ? updatedPages : []).map((page) => [page.id, page]));
  return COPILOT_INSIGHT_PAGES.map((page) => updatedById.get(page.id) || baseById.get(page.id) || fallbackById.get(page.id) || page);
}

function dailyCopilotProgress({ status = "pending", currentPage = null, currentIndex = 0, completedPages = 0, error = "", pages = COPILOT_INSIGHT_PAGES } = {}) {
  const progressPages = Array.isArray(pages) && pages.length ? pages : COPILOT_INSIGHT_PAGES;
  const totalPages = progressPages.length;
  const pageIndex = Math.max(0, Math.min(totalPages - 1, Number(currentIndex) || 0));
  const activePage = currentPage || progressPages[pageIndex] || null;
  const activeIndex = Math.max(0, progressPages.findIndex((page) => page.id === activePage?.id));
  const boundedCompletedPages = Math.max(0, Math.min(totalPages, Number(completedPages) || 0));
  const effectiveCompletedPages = status === "completed"
    ? totalPages
    : ["thinking", "failed"].includes(status)
      ? Math.max(boundedCompletedPages, activeIndex)
      : boundedCompletedPages;
  const items = progressPages.map((page, index) => ({
    id: page.id,
    title: page.title,
    status: index < effectiveCompletedPages ? "computed" : page.id === activePage?.id && status === "thinking" ? "thinking" : status === "failed" && page.id === activePage?.id ? "failed" : "waiting",
  }));
  const statusText = status === "completed"
    ? totalPages === 1 ? `${activePage?.title || "Daily AI projection"} is computed.` : "Daily AI projections are computed."
    : status === "failed"
      ? `Stopped while computing ${activePage?.title || "daily projections"}.`
      : status === "thinking"
        ? `Thinking through ${activePage?.title || "daily projections"}...`
        : "Daily AI projection generation is queued.";
  return {
    status,
    currentPageId: activePage?.id || "",
    currentPageTitle: activePage?.title || "",
    completedPages: effectiveCompletedPages,
    totalPages,
    statusText,
    error: String(error || ""),
    items,
    updatedAt: new Date().toISOString(),
  };
}

async function hasConfiguredAiProvider() {
  try {
    const [grok, codex] = await Promise.all([
      getActiveOAuthSession("grok"),
      getActiveOAuthSession("codex"),
    ]);
    return Boolean(grok || codex);
  } catch {
    return false;
  }
}

function dailyInsightPrompt(page) {
  const projectionEvidenceGuide = "For projections, provide these possible evidence sources without prescribing weights: 1. This week's F1 news, or the ability to search for it when available. 2. Every race this season's results. 3. Past results at this track. 4. Driver skill overall. 5. Freedom to find and use other relevant sources. The model decides how to weigh these sources, synthesize contradictions, and explain which data supports each pick.";
  const instructions = [
    `Build the daily precomputed Apexline Copilot page for: ${page.title}.`,
    "Use only the provided snapshot, except for the explicit current-weekend tyre-availability lookup instruction when snapshot.tyreAvailability is not supplied. Do not invent factual tyre data, session results, weather, or factual claims not present in the snapshot or the cited tyre-availability source.",
    "If the snapshot lacks enough data for a claim, say what is missing.",
    "For championship projections, obey snapshot.projectionConstraints.finalPointsBudget: the sum of projected final points across the full returned drivers or constructors order must not exceed that official season points budget, and each projected total must be at least the entrant's current points.",
    "Return concise race-engineer language with alerts only for real risks or uncertainties in the supplied data.",
  ];
  if (page.id === "current-weekend") {
    instructions.push(`For this Current weekend page, compute AI predictions for the race winner, podium, and watchlist. ${projectionEvidenceGuide} Use supplied snapshot.weekendSessionSummaries for FP1-FP3, sprint, qualifying, race-pace, weather, tyre, and session-result evidence when present — qualifying positions are the projected grid. Also use snapshot.performanceContext for recent-race pace and this circuit's history, snapshot.driverForm/formRounds for recent form, snapshot.standings and snapshot.drivers for the championship picture, and snapshot.strategyContext for tyre/pit context. For current-weekend stint plans, use driver available tyre sets when supplied; if snapshot.tyreAvailability says they are not supplied, look up the F1.com Strategy Guide and Pirelli race strategy or tyre graphics for the Tyres Available for Race table when your provider can browse/search, then cite which source you used. If browsing/search is unavailable or those sources do not show the table yet, explicitly say available tyre sets are not supplied before giving a projected plan. Decide for yourself how to weight each input. Put predictions in predictions with available=true, label them as projections, and explain the data behind each pick. For race-plan visuals before the race has actual stint data, include projected tyre_strategy stints when the supplied practice, qualifying, weather, tyre, and news evidence supports a strategy read; set visualization.stintMode='projected', label the title/subtitle/notes as projected, and do not present projected stints as actual telemetry. For every prediction candidate set projectedPoints to the points you project they score in THIS race (0-25 for a Grand Prix, 0 if you project no points). If qualifying, race pace, weather, or timing data is missing, lower confidence and say so instead of filling gaps.`);
  } else if (page.id === "next-weekend") {
    instructions.push(`For this Next weekend page, compute AI predictions for the Grand Prix race winner, podium, watchlist, and full predicted race finishing order. Treat snapshot.nextRaceWeekend as the race target; snapshot.nextUpcomingSession is schedule context only and must not change the leaderboard into FP1, qualifying, sprint, or any other session projection. ${projectionEvidenceGuide} Use supplied snapshot.performanceContext plus the rest of the snapshot when present. Put predictions in predictions with available=true, include the full predicted race finishing order in predictions.leaderboard, label it as a race projection, and explain the data behind each pick. For race-plan visuals before the race has actual stint data, include projected tyre_strategy stints when the supplied performance, track-history, weather, tyre, and news evidence supports a strategy read; set visualization.stintMode='projected', label the title/subtitle/notes as projected, and do not present projected stints as actual telemetry. For every prediction candidate set projectedPoints to the points you project they score in THIS race (0-25 for a Grand Prix, 0 if you project no points). If race pace, weather, tyre, season-performance, track-history, or timing data is missing for the next weekend, lower confidence and say so instead of filling gaps.`);
  } else if (page.id === "drivers-championship") {
    instructions.push(`For this Drivers championship page, compute AI predictions for the drivers' championship winner, leading title contenders, and watchlist. ${projectionEvidenceGuide} Use supplied standings, wins, driver roster, recent form (snapshot.driverForm holds each driver's last finishing positions, snapshot.formRounds the matching rounds), constructors, schedule, season summary, timing, strategy context, and news evidence when present. Decide for yourself how to weight each input. Put predictions in predictions with available=true, label them as projections, and explain the data behind each pick. Return the full projected drivers' order in predictions.leaderboard, and for every candidate set projectedPoints to your projected FINAL season points total (an integer >= the driver's current points), grounded on remaining rounds and form. If remaining-race count, form, reliability, or pace data is missing, lower confidence and say so instead of filling gaps.`);
  } else if (page.id === "constructors-championship") {
    instructions.push(`For this Constructors championship page, compute AI predictions for the constructors' championship winner, leading title contenders, and watchlist. ${projectionEvidenceGuide} Use supplied constructors standings, driver standings, driver roster, recent form (snapshot.driverForm / snapshot.formRounds), schedule, season summary, timing, strategy context, and news evidence when present. Decide for yourself how to weight each input. Put predictions in predictions with available=true, label them as projections, and explain the data behind each pick. Return the full projected constructors' order in predictions.leaderboard, and for every constructor candidate set projectedPoints to your projected FINAL season points total (an integer >= the team's current points). Use constructor abbreviations or names in prediction candidate code fields. If remaining-race count, form, reliability, or pace data is missing, lower confidence and say so instead of filling gaps.`);
  } else {
    instructions.push("For predictions, set available=false with empty winner, podium, leaderboard, and watchlist arrays.");
  }
  return instructions.join(" ");
}

function normalizePredictionCandidate(row = {}) {
  const projectedPoints = Number(row.projectedPoints);
  return {
    code: String(row.code || "").slice(0, 8),
    label: String(row.label || row.name || row.code || "").slice(0, 64),
    confidence: Math.max(0, Math.min(1, Number(row.confidence || 0) || 0)),
    probability: Math.max(0, Math.min(1, Number(row.probability || 0) || 0)),
    projectedPoints: Number.isFinite(projectedPoints) && projectedPoints >= 0 ? Math.round(projectedPoints) : null,
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

function isMissingTyreAvailabilityAlert(alert = {}) {
  const text = `${alert.title || ""} ${alert.body || ""} ${alert.detail || ""}`.toLowerCase();
  return /tyre sets? not supplied|tire sets? not supplied|available tyre sets? (?:are )?not supplied|available tire sets? (?:are )?not supplied/.test(text);
}

function raceHasSprintPoints(race = {}) {
  return (Array.isArray(race.sessions) ? race.sessions : []).some((session) => {
    const text = String(session?.kind || session?.type || session?.name || "").toLowerCase();
    return /\bsprint\b/.test(text) && !/qualifying|shootout/.test(text);
  });
}

function championshipPointsBudget(data = {}) {
  const grandPrixPoints = 101;
  const sprintPoints = 36;
  const schedule = Array.isArray(data.schedule) ? data.schedule : [];
  const totalRounds = Math.max(0, Number(data?.seasonSummary?.totalRounds || schedule.length || 0) || 0);
  if (!totalRounds) return 0;
  const sprintCount = schedule.filter(raceHasSprintPoints).length;
  return totalRounds * grandPrixPoints + sprintCount * sprintPoints;
}

function championshipCurrentPointsTotal(data = {}, pageId = "") {
  const rows = pageId === "constructors-championship" ? data.constructors : data.standings;
  return (Array.isArray(rows) ? rows : []).reduce((sum, row) => {
    const points = Number(row?.pts);
    return sum + (Number.isFinite(points) && points > 0 ? points : 0);
  }, 0);
}

function projectionTextKey(value) {
  return String(value || "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

function currentPointsForProjectionCandidate(row = {}, data = {}, pageId = "") {
  const code = String(row.code || "").toUpperCase();
  const labelKey = projectionTextKey(row.label || row.name || row.code);
  const rows = pageId === "constructors-championship" ? data.constructors : data.standings;
  for (const item of Array.isArray(rows) ? rows : []) {
    const itemCode = String(pageId === "constructors-championship" ? item.abbr : item.code || "").toUpperCase();
    const itemNameKey = projectionTextKey(item.name || item.team || item.label || itemCode);
    if (code && itemCode && code === itemCode) return Math.max(0, Math.round(Number(item.pts) || 0));
    if (labelKey && itemNameKey && (labelKey.includes(itemNameKey) || itemNameKey.includes(labelKey))) {
      return Math.max(0, Math.round(Number(item.pts) || 0));
    }
  }
  return 0;
}

function scaleProjectedPointsToBudget(candidates = [], data = {}, pageId = "") {
  const budget = championshipPointsBudget(data);
  if (!budget || !Array.isArray(candidates) || !candidates.length) return candidates;
  const normalized = candidates.map((candidate) => {
    const current = currentPointsForProjectionCandidate(candidate, data, pageId);
    const projected = Number(candidate.projectedPoints);
    return {
      candidate,
      current,
      value: Number.isFinite(projected) ? Math.max(current, Math.round(projected)) : null,
    };
  });
  const entries = normalized.filter((entry) => entry.value != null);
  const projectedTotal = entries.reduce((sum, entry) => sum + entry.value, 0);
  if (projectedTotal <= budget) {
    return normalized.map((entry) => entry.value == null ? entry.candidate : { ...entry.candidate, projectedPoints: entry.value });
  }
  const currentTotal = entries.reduce((sum, entry) => sum + entry.current, 0);
  if (currentTotal >= budget) {
    return normalized.map((entry) => entry.value == null ? entry.candidate : { ...entry.candidate, projectedPoints: entry.current });
  }
  const deltaBudget = budget - currentTotal;
  const deltaTotal = entries.reduce((sum, entry) => sum + Math.max(0, entry.value - entry.current), 0);
  if (!deltaTotal) {
    return normalized.map((entry) => entry.value == null ? entry.candidate : { ...entry.candidate, projectedPoints: entry.current });
  }

  const currentRows = pageId === "constructors-championship" ? data.constructors : data.standings;
  const completeProjection = entries.length >= (Array.isArray(currentRows) ? currentRows.length : Infinity);
  const scaled = entries.map((entry) => {
    const raw = entry.current + Math.max(0, entry.value - entry.current) * (deltaBudget / deltaTotal);
    const floor = Math.floor(raw);
    return { ...entry, adjusted: floor, remainder: raw - floor };
  });
  if (completeProjection) {
    let spare = Math.max(0, budget - scaled.reduce((sum, entry) => sum + entry.adjusted, 0));
    for (const entry of scaled.slice().sort((a, b) => b.remainder - a.remainder)) {
      if (!spare) break;
      entry.adjusted += 1;
      spare -= 1;
    }
  }
  const byCandidate = new Map(scaled.map((entry) => [entry.candidate, entry.adjusted]));
  return normalized.map((entry) => (
    byCandidate.has(entry.candidate)
      ? { ...entry.candidate, projectedPoints: byCandidate.get(entry.candidate) }
      : entry.candidate
  ));
}

function normalizeChampionshipPredictionTotals(predictions, data = {}, pageId = "") {
  if (!["drivers-championship", "constructors-championship"].includes(pageId)) return predictions;
  const byCode = new Map();
  for (const row of [...predictions.leaderboard, ...predictions.winner, ...predictions.podium]) {
    const key = String(row.code || row.label || "").toUpperCase();
    if (key && !byCode.has(key)) byCode.set(key, row);
  }
  const scaled = scaleProjectedPointsToBudget(Array.from(byCode.values()), data, pageId);
  const scaledByCode = new Map(scaled.map((row) => [String(row.code || row.label || "").toUpperCase(), row.projectedPoints]));
  const apply = (row) => {
    const key = String(row.code || row.label || "").toUpperCase();
    return scaledByCode.has(key) ? { ...row, projectedPoints: scaledByCode.get(key) } : row;
  };
  return {
    ...predictions,
    winner: predictions.winner.map(apply),
    podium: predictions.podium.map(apply),
    leaderboard: predictions.leaderboard.map(apply),
  };
}

function normalizeRaceProjectionTotals(predictions, pageId = "") {
  if (!["current-weekend", "next-weekend"].includes(pageId)) return predictions;
  const apply = (row) => {
    if (row.projectedPoints == null) return row;
    return { ...row, projectedPoints: Math.max(0, Math.min(25, Math.round(Number(row.projectedPoints) || 0))) };
  };
  return {
    ...predictions,
    winner: predictions.winner.map(apply),
    podium: predictions.podium.map(apply),
    leaderboard: predictions.leaderboard.map(apply),
  };
}

function normalizeDailyPredictions(value, page = {}, data = {}) {
  if (!value || typeof value !== "object") return emptyDailyPredictions();
  const predictions = {
    available: Boolean(value.available),
    title: String(value.title || "").slice(0, 80),
    summary: String(value.summary || "").slice(0, 260),
    winner: Array.isArray(value.winner) ? value.winner.slice(0, 3).map(normalizePredictionCandidate) : [],
    podium: Array.isArray(value.podium) ? value.podium.slice(0, 3).map(normalizePredictionCandidate) : [],
    leaderboard: Array.isArray(value.leaderboard) ? value.leaderboard.slice(0, 22).map(normalizePredictionCandidate) : [],
    watchlist: Array.isArray(value.watchlist) ? value.watchlist.slice(0, 4).map(normalizePredictionWatchItem) : [],
    caveat: String(value.caveat || "").slice(0, 220),
  };
  return normalizeRaceProjectionTotals(normalizeChampionshipPredictionTotals(predictions, data, page.id), page.id);
}

function normalizeDailyInsightPage(page, answer, data = {}) {
  const alerts = Array.isArray(answer?.alerts)
    ? answer.alerts.filter((alert) => !isMissingTyreAvailabilityAlert(alert)).slice(0, 4)
    : [];
  return {
    ...page,
    summary: String(answer?.summary || "The AI provider returned no summary for this page."),
    bullets: alerts.map((alert) => [alert.title, alert.body].filter(Boolean).join(": ")).filter(Boolean),
    alerts,
    visualization: answer?.visualization || null,
    predictions: normalizeDailyPredictions(answer?.predictions, page, data),
    computed: true,
  };
}

async function refreshDailyCopilotInsights(data, generatedOn, options = {}) {
  const targetFingerprint = copilotInsightTargetFingerprint(data);
  const pagesToRefresh = copilotInsightPagesForScope(options.pageId);
  const scoped = pagesToRefresh.length !== COPILOT_INSIGHT_PAGES.length;
  const previousDaily = options.previousDaily || null;
  const pendingSummary = scoped ? `Daily AI insight generation is queued for ${pagesToRefresh[0]?.title || "this page"}.` : "Daily AI insight generation has started and has not finished yet.";
  const pending = {
    schemaVersion: COPILOT_INSIGHTS_SCHEMA_VERSION,
    targetFingerprint,
    status: "pending",
    attemptedOn: generatedOn,
    generatedOn: "",
    generatedAt: "",
    updatedAt: new Date().toISOString(),
    progress: dailyCopilotProgress({ pages: pagesToRefresh }),
    pages: scoped ? mergeCopilotInsightPages(data, previousDaily, [], pendingSummary) : fallbackCopilotInsightPages(data, pendingSummary),
  };
  if (liveDataCache?.data) liveDataCache.data.copilot = { daily: pending };
  await writeCopilotInsightsCache(pending);
  let progress = pending.progress;
  const pages = [];
  try {
    for (const [index, page] of pagesToRefresh.entries()) {
      progress = dailyCopilotProgress({ status: "thinking", currentPage: page, currentIndex: index, completedPages: pages.length, pages: pagesToRefresh });
      const progressUpdate = {
        ...pending,
        updatedAt: new Date().toISOString(),
        progress,
        pages: scoped ? mergeCopilotInsightPages(data, previousDaily, pages, progress.statusText) : pages.concat(fallbackCopilotInsightPages(data, progress.statusText).slice(pages.length)),
      };
      if (liveDataCache?.data) liveDataCache.data.copilot = { daily: progressUpdate };
      await writeCopilotInsightsCache(progressUpdate);
      const answer = await askConfiguredAi({
        prompt: dailyInsightPrompt(page),
        snapshot: await dailyInsightSnapshot(data, page.id, { priority: "background" }),
      });
      pages.push(normalizeDailyInsightPage(page, answer, data));
    }
    const ready = {
      schemaVersion: COPILOT_INSIGHTS_SCHEMA_VERSION,
      targetFingerprint,
      status: "ready",
      attemptedOn: generatedOn,
      generatedOn,
      generatedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      progress: dailyCopilotProgress({ status: "completed", currentPage: pagesToRefresh.at(-1), currentIndex: pagesToRefresh.length - 1, completedPages: pagesToRefresh.length, pages: pagesToRefresh }),
      pages: scoped ? mergeCopilotInsightPages(data, previousDaily, pages, "Daily AI projection is computed.") : pages,
    };
    if (liveDataCache?.data) liveDataCache.data.copilot = { daily: ready };
    return writeCopilotInsightsCache(ready);
  } catch (error) {
    const safeError = sanitizeAiError(error);
    const failedPage = COPILOT_INSIGHT_PAGES.find((page) => page.id === progress.currentPageId) || pagesToRefresh[0];
    const failedPages = fallbackCopilotInsightPages(data, `No AI projection computed today. Daily calculation failed: ${safeError}`)
      .filter((page) => page.id === failedPage?.id);
    const failed = {
      schemaVersion: COPILOT_INSIGHTS_SCHEMA_VERSION,
      targetFingerprint,
      status: "failed",
      attemptedOn: generatedOn,
      generatedOn: "",
      generatedAt: "",
      updatedAt: new Date().toISOString(),
      error: safeError,
      progress: dailyCopilotProgress({ status: "failed", currentPage: failedPage, completedPages: pages.length, error: safeError, pages: pagesToRefresh }),
      pages: scoped ? mergeCopilotInsightPages(data, previousDaily, failedPages, `No AI projection computed today. Daily calculation failed: ${safeError}`) : fallbackCopilotInsightPages(data, `No AI projection computed today. Daily calculation failed: ${safeError}`),
    };
    if (liveDataCache?.data) liveDataCache.data.copilot = { daily: failed };
    return writeCopilotInsightsCache(failed);
  }
}

async function getDailyCopilotInsights(data, options = {}) {
  const today = localDateKey();
  const targetFingerprint = copilotInsightTargetFingerprint(data);
  const forceCopilotPageId = COPILOT_INSIGHT_PAGES.some((page) => page.id === String(options.forceCopilotPageId || "")) ? String(options.forceCopilotPageId) : "";
  const forceCopilotRefresh = Boolean(options.forceCopilotRefresh || forceCopilotPageId);
  const pagesToRefresh = copilotInsightPagesForScope(forceCopilotPageId);
  const rawCached = await readCopilotInsightsCache();
  const cachedHadRawAiTimeout = copilotCacheHasRawAiTimeout(rawCached);
  const cached = sanitizeCopilotInsightsCache(rawCached);
  const cachedSchemaMatches = cached?.schemaVersion === COPILOT_INSIGHTS_SCHEMA_VERSION;
  const usableCached = cachedSchemaMatches ? cached : null;
  const cacheMatchesTarget = copilotInsightsCacheMatchesTarget(usableCached, targetFingerprint);
  const previousDaily = cacheMatchesTarget ? usableCached : null;
  if (!forceCopilotRefresh && cacheMatchesTarget && usableCached?.generatedOn === today && usableCached.status === "ready") return usableCached;
  if (!forceCopilotRefresh && cacheMatchesTarget && usableCached?.attemptedOn === today && usableCached.status !== "ready" && !cachedHadRawAiTimeout && !shouldRetryDailyCopilotInsights(usableCached, today)) return usableCached;
  if (!(await hasConfiguredAiProvider())) {
    return {
      schemaVersion: COPILOT_INSIGHTS_SCHEMA_VERSION,
      targetFingerprint,
      status: "not_configured",
      attemptedOn: "",
      generatedOn: "",
      generatedAt: "",
      updatedAt: new Date().toISOString(),
      progress: dailyCopilotProgress({ status: "failed", error: "Connect an AI provider to generate daily prebuilt insights." }),
      pages: fallbackCopilotInsightPages(data, "No AI projection computed. Connect an AI provider to generate daily prebuilt insights."),
    };
  }
  if (!copilotInsightRefresh) {
    copilotInsightRefresh = refreshDailyCopilotInsights(data, today, { pageId: forceCopilotPageId, previousDaily })
      .catch(() => null)
      .finally(() => { copilotInsightRefresh = null; });
  }
  const pending = {
    schemaVersion: COPILOT_INSIGHTS_SCHEMA_VERSION,
    targetFingerprint,
    status: "pending",
    attemptedOn: today,
    generatedOn: "",
    generatedAt: "",
    updatedAt: new Date().toISOString(),
    progress: dailyCopilotProgress({ pages: pagesToRefresh }),
    pages: forceCopilotPageId ? mergeCopilotInsightPages(data, previousDaily, [], "Daily AI insight generation is queued for today.") : fallbackCopilotInsightPages(data, "Daily AI insight generation is queued for today."),
  };
  return forceCopilotRefresh ? pending : previousDaily || pending;
}

function shouldRetryDailyCopilotInsights(cached, today, nowMs = Date.now(), retryMs = COPILOT_INSIGHT_RETRY_MS) {
  if (!["failed", "pending"].includes(cached?.status) || cached.attemptedOn !== today) return false;
  const updatedAtMs = Date.parse(cached.updatedAt || "");
  return !Number.isFinite(updatedAtMs) || nowMs - updatedAtMs >= retryMs;
}

async function fetchLiveDataEntries(urls, options = {}) {
  const timeout = Number(options.timeout) > 0 ? Number(options.timeout) : 8500;
  const entries = await Promise.all(Object.entries(urls).map(async ([key, url]) => {
    const isXml = key.endsWith("News");
    try {
      return { key, value: isXml ? await requestText(url, timeout) : await requestMaybeOpenF1Json(url, timeout, { priority: options.priority }) };
    } catch (error) {
      return { key, error };
    }
  }));
  const raw = {};
  const errors = [];
  const failedKeys = [];
  for (const result of entries) {
    if (!result.error) raw[result.key] = result.value;
    else {
      failedKeys.push(result.key);
      if (!OPTIONAL_LIVE_DATA_KEYS.has(result.key)) errors.push(result.error.message);
    }
  }
  return { raw, errors, failedKeys };
}

async function fetchOfficialF1StandingsFallback(raw, errors = []) {
  const season = new Date().getFullYear();
  const fallbackData = readFallbackPitWallData();
  const hasOfficialDrivers = parseOfficialF1DriverStandings(raw.officialF1DriverStandings).standings.length > 0;
  const needsDrivers = (!Array.isArray(raw.openF1DriverStandings) || !raw.openF1DriverStandings.length) && !hasOfficialDrivers;
  const needsConstructors = shouldFetchOfficialConstructorStandings(raw, fallbackData.constructors);
  const requests = [];
  if (needsDrivers) requests.push(["officialF1DriverStandings", officialF1ResultsUrl("drivers", season)]);
  if (needsConstructors) requests.push(["officialF1ConstructorStandings", officialF1ResultsUrl("team", season)]);
  if (!requests.length) return raw;
  const entries = await Promise.all(requests.map(async ([key, url]) => {
    try {
      return { key, value: await requestText(url, 6500, { Accept: "text/html,application/xhtml+xml,*/*" }) };
    } catch (error) {
      return { key, error };
    }
  }));
  for (const entry of entries) {
    if (!entry.error) raw[entry.key] = entry.value;
    else errors.push(entry.error.message);
  }
  return raw;
}

function jolpicaChampionshipStandingsUrl(kind = "drivers", season = new Date().getFullYear(), round = 0) {
  const year = String(season || new Date().getFullYear()).replace(/[^0-9]/g, "") || String(new Date().getFullYear());
  const roundNumber = Math.max(0, Number(round) || 0);
  const roundPart = roundNumber ? `/${roundNumber}` : "";
  const endpoint = kind === "constructors" ? "constructorStandings" : "driverStandings";
  return `${JOLPICA_ERGAST_BASE_URL}/${year}${roundPart}/${endpoint}.json`;
}

async function fetchPreviousChampionshipStandings(season, round, options = {}) {
  const previousRound = Math.max(0, Number(round) - 1);
  if (previousRound < 1) return {};
  const requests = [];
  if (options.drivers) requests.push(["drivers", jolpicaChampionshipStandingsUrl("drivers", season, previousRound)]);
  if (options.constructors) requests.push(["constructors", jolpicaChampionshipStandingsUrl("constructors", season, previousRound)]);
  if (!requests.length) return {};
  const results = await Promise.all(requests.map(async ([key, url]) => {
    try {
      return { key, value: await requestJson(url, 6500) };
    } catch (error) {
      writePitWallDebugLog("live-data.previous-standings-failed", { key, message: error?.message || "previous standings fetch failed" });
      return { key, error };
    }
  }));
  const previous = {};
  for (const result of results) {
    if (result.error) continue;
    if (result.key === "drivers") previous.standings = parseDriverStandings(result.value).standings;
    else if (result.key === "constructors") previous.constructors = parseConstructorStandings(result.value);
  }
  return previous;
}

async function buildPitWallSnapshot(raw, errors = [], options = {}) {
  const fallbackData = readFallbackPitWallData();
  const openF1DriverResult = parseOpenF1DriverStandings(raw.openF1DriverStandings, fallbackData.drivers);
  const officialF1DriverResult = parseOfficialF1DriverStandings(raw.officialF1DriverStandings);
  const f1ApiDriverResult = parseF1ApiDriverStandings(raw.f1ApiDriverStandings);
  const jolpicaDriverResult = parseDriverStandings(raw.driverStandings);
  const driverResult = openF1DriverResult.standings.length ? openF1DriverResult : officialF1DriverResult.standings.length ? officialF1DriverResult : f1ApiDriverResult.standings.length ? f1ApiDriverResult : jolpicaDriverResult;
  const openF1Constructors = parseOpenF1ConstructorStandings(raw.openF1ConstructorStandings);
  const officialF1Constructors = parseOfficialF1ConstructorStandings(raw.officialF1ConstructorStandings);
  const f1ApiConstructors = parseF1ApiConstructorStandings(raw.f1ApiConstructorStandings);
  const jolpicaConstructors = parseConstructorStandings(raw.constructorStandings);
  let standings = driverResult.standings;
  let constructors = selectConstructorStandings(openF1Constructors, officialF1Constructors, f1ApiConstructors, jolpicaConstructors, fallbackData.constructors);
  let raceWinners = parseRaceWinners(raw.driverResults, fallbackData.drivers);
  const schedule = applyScheduleWinners(parseSchedule(raw.schedule, raw.openF1Meetings), raceWinners);
  const openF1Schedule = parseOpenF1Schedule(raw.openF1Meetings, raw.openF1Sessions);
  const fallbackSchedule = normalizeScheduleRoundOrder(openF1Schedule, { removeCancelled2026: scheduleHas2026Dates(openF1Schedule) });
  let effectiveSchedule = schedule.length ? schedule : applyScheduleWinners(fallbackSchedule, raceWinners);
  // Carry winners we already resolved (in-memory / disk cache) so they paint instantly on the first
  // snapshot and survive an app restart instead of being refetched.
  const carriedWinners = priorScheduleWinners();
  if (carriedWinners.length) {
    raceWinners = raceWinners.concat(carriedWinners);
    effectiveSchedule = applyScheduleWinners(effectiveSchedule, raceWinners);
  }
  // Historical winners are not needed to open the dashboard. Skip on the startup
  // first-pass so race/standings/news are not blocked by an extra Ergast round-trip.
  if (!options.deferOptional && effectiveSchedule.some((race) => race.status === "done" && !race.winner)) {
    const seasonWinners = parseRaceWinners(await fetchSeasonRaceWinners(), fallbackData.drivers);
    if (seasonWinners.length) {
      raceWinners = raceWinners.concat(seasonWinners);
      effectiveSchedule = applyScheduleWinners(effectiveSchedule, raceWinners);
    }
  }
  if (!options.enrichmentPending) {
    const openF1RaceWinners = await fetchMissingOpenF1RaceWinners(effectiveSchedule, driverResult.seasonSummary.season, fallbackData.drivers, { priority: options.priority });
    if (openF1RaceWinners.length) {
      raceWinners = raceWinners.concat(openF1RaceWinners);
      effectiveSchedule = applyScheduleWinners(effectiveSchedule, raceWinners);
    }
  }
  const drivers = parseOpenDrivers(raw.openF1Drivers, fallbackData.drivers, driverResult.standings);
  const byCode = Object.fromEntries(drivers.map((driver) => [driver.code, driver]));
  const recentForm = parseDriverRecentForm(raw.driverResults);
  const timing = parseTiming(raw.openF1Drivers, raw.openF1Position, raw.openF1Intervals, driverResult.standings, raw.openF1Stints, raw.openF1Pit, raw.openF1Laps, raw.openF1CarData);
  const battlePairs = detectBattlePairs(timing);
  const nextRace = effectiveSchedule.find((race) => race.status === "live") || effectiveSchedule.find((race) => race.status === "upcoming") || effectiveSchedule.at(-1) || {};
  let weatherRows = Array.isArray(raw.openF1Weather) ? raw.openF1Weather : [];
  let weatherLoc = nextRace.loc || "";
  const latestWeatherMeetingKey = weatherRows.at(-1)?.meeting_key;
  const latestWeatherRows = weatherRows;
  if (nextRace.meetingKey && latestWeatherMeetingKey && String(latestWeatherMeetingKey) !== String(nextRace.meetingKey)) {
    weatherRows = [];
    weatherLoc = "Latest session";
  }
  if (options.includeWeekendWeatherFallback !== false && !hasWeatherRows(weatherRows)) {
    const weekendWeatherRows = await fetchOpenF1WeekendWeather(nextRace, { priority: options.priority });
    if (hasWeatherRows(weekendWeatherRows)) {
      weatherRows = weekendWeatherRows;
      weatherLoc = nextRace.loc || weatherLoc;
    }
  }
  if (!hasWeatherRows(weatherRows) && hasWeatherRows(latestWeatherRows)) {
    weatherRows = latestWeatherRows;
    weatherLoc = "Latest session";
  }
  const weather = parseWeather(weatherRows);
  const baseNews = buildNewsFeed(raw);
  const news = options.enrichmentPending ? baseNews : await enrichNewsStoryImages(baseNews);
  const race = {
    name: nextRace.name || "Current Formula 1 session",
    circuit: nextRace.circuit || "",
    loc: nextRace.loc || "",
    round: nextRace.rnd || 0,
    startsAt: nextRace.startsAt || "",
    weather,
    weatherLoc,
  };
  const seasonSummary = {
    season: driverResult.seasonSummary.season,
    round: driverResult.seasonSummary.round || nextRace.rnd || 0,
    totalRounds: effectiveSchedule.length,
  };
  const standingsRound = driverResult.seasonSummary.round || currentRaceWeekend(effectiveSchedule)?.rnd || 0;
  const previousStandings = options.deferOptional
    ? {}
    : await fetchPreviousChampionshipStandings(driverResult.seasonSummary.season, standingsRound, {
      drivers: championshipRowsNeedPreviousDeltas(standings),
      constructors: championshipRowsNeedPreviousDeltas(constructors),
    });
  standings = applyChampionshipPositionDeltas(standings, previousStandings.standings, "code");
  constructors = applyChampionshipPositionDeltas(constructors, previousStandings.constructors, "abbr");
  const strategyContext = buildStrategyContext({
    race,
    seasonSummary,
    drivers,
    standings,
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
    driverForm: recentForm.driverForm,
    formRounds: recentForm.formRounds,
    standings,
    constructors,
    schedule: effectiveSchedule,
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
  const enrichmentKey = String(baseData?.fetchedAt || "");
  const existingRefresh = liveDataEnrichmentRefreshes.get(enrichmentKey);
  if (existingRefresh) return existingRefresh;
  const refresh = (async () => {
    const enrichmentUrls = liveBackgroundEnrichmentUrls(baseRaw?.openF1Sessions, Date.now());
    const [enrichment, recentDriverResults] = await Promise.all([
      fetchLiveDataEntries(enrichmentUrls, { priority: "background" }),
      fetchRecentDriverResults(baseData.schedule, 5, baseData.seasonSummary?.season),
    ]);
    const raw = { ...baseRaw, ...enrichment.raw };
    if (recentDriverResults) raw.driverResults = recentDriverResults;
    const enrichmentErrors = liveDataEnrichmentErrors(baseErrors, enrichment);
    let data = await buildPitWallSnapshot(raw, enrichmentErrors, {
      includeWeekendWeatherFallback: true,
      enrichmentPending: false,
      priority: "background",
    });
    data = preserveSnapshotNews(baseData, data, { partial: liveDataNewsEnrichmentPartial(enrichment) });
    data.copilot = liveDataCache?.data?.copilot || baseData.copilot;
    if (liveDataCache?.data?.fetchedAt === baseData.fetchedAt) {
      liveDataCache = { createdAt: Date.now(), data };
      writeLiveSnapshotDiskCache(data);
      notifyLiveDataUpdated();
    }
    return data;
  })().catch((error) => {
    writePitWallDebugLog("live-data.enrichment-failed", { message: error?.message || "OpenF1 enrichment failed" });
    if (liveDataCache?.data?.fetchedAt === baseData.fetchedAt) {
      liveDataCache = { createdAt: Date.now(), data: { ...baseData, enrichmentPending: false } };
      notifyLiveDataUpdated();
    }
    return null;
  }).finally(() => {
    if (liveDataEnrichmentRefreshes.get(enrichmentKey) === refresh) {
      liveDataEnrichmentRefreshes.delete(enrichmentKey);
    }
  });
  liveDataEnrichmentRefreshes.set(enrichmentKey, refresh);
  return refresh;
}

function notifyLiveDataUpdated() {
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed() && !win.webContents.isDestroyed?.()) {
      win.webContents.send("pitwall:data:updated");
    }
  }
}

function preserveSnapshotNews(baseData, nextData, options = {}) {
  const previous = Array.isArray(baseData?.news) ? baseData.news : [];
  const fresh = Array.isArray(nextData?.news) ? nextData.news : [];
  if (!fresh.length) return previous.length ? { ...nextData, news: selectNewsFeedStories(previous, 24) } : nextData;
  if (!options.partial || !previous.length) return nextData;
  const seen = new Set();
  const merged = [];
  for (const story of fresh.concat(previous)) {
    const key = String(story?.url || story?.link || story?.title || "").trim().toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    merged.push(story);
  }
  return { ...nextData, news: selectNewsFeedStories(merged, 24) };
}

function liveDataEnrichmentErrors(baseErrors, enrichment) {
  return [...(baseErrors || []), ...(enrichment?.errors || [])];
}

function liveDataNewsEnrichmentPartial(enrichment) {
  return (enrichment?.failedKeys || []).some((key) => String(key).endsWith("News"));
}

function liveSnapshotCachePath() {
  return path.join(app.getPath("userData"), LIVE_SNAPSHOT_CACHE_FILE);
}

function readLiveSnapshotDiskCache() {
  try {
    const parsed = JSON.parse(fs.readFileSync(liveSnapshotCachePath(), "utf8"));
    if (parsed?.schemaVersion && parsed.schemaVersion !== LIVE_SNAPSHOT_CACHE_VERSION) return null;
    return parsed?.data?.source === "live" ? normalizePitWallSnapshotRounds(parsed.data) : null;
  } catch {
    return null;
  }
}

function writeLiveSnapshotDiskCache(data) {
  if (!data?.schedule?.length && !data?.standings?.length) return;
  try {
    // Never let a winner-poor snapshot (e.g. a pending pass that lost a race) clobber winners we
    // already persisted — merge the richer set forward so restarts stay instant.
    let outData = data;
    const existing = readLiveSnapshotDiskCache();
    if (existing && scheduleWinnerCount(existing.schedule) > scheduleWinnerCount(data.schedule)) {
      outData = { ...data, schedule: applyScheduleWinners(data.schedule, scheduleWinners(existing.schedule)) };
    }
    fs.mkdirSync(path.dirname(liveSnapshotCachePath()), { recursive: true });
    fs.writeFileSync(liveSnapshotCachePath(), JSON.stringify({ schemaVersion: LIVE_SNAPSHOT_CACHE_VERSION, createdAt: new Date().toISOString(), data: normalizePitWallSnapshotRounds(outData) }), "utf8");
  } catch {}
}

// Recent driver form is otherwise only fetched during the post-snapshot enrichment
// pass, which runs AFTER the daily Copilot insights — so the AI projections (and the
// first UI render) ship with an empty driverForm. Populate it on the base snapshot,
// before the daily run, using the same cached results fetch the enrichment uses.
async function ensureRecentDriverForm(raw, data) {
  if (data.driverForm && Object.keys(data.driverForm).length) return;
  try {
    const fallbackDrivers = data.drivers?.length ? data.drivers : readFallbackPitWallData().drivers;
    let recentDriverResults = await fetchRecentDriverResults(data.schedule, 5, data.seasonSummary?.season);
    if (!recentDriverResults) {
      recentDriverResults = await fetchRecentOpenF1DriverResults(data.schedule, 5, data.seasonSummary?.season, fallbackDrivers);
    }
    if (!recentDriverResults) return;
    raw.driverResults = recentDriverResults;
    const recentForm = parseDriverRecentForm(recentDriverResults);
    data.driverForm = recentForm.driverForm;
    data.formRounds = recentForm.formRounds;
  } catch (error) {
    writePitWallDebugLog("live-data.recent-form-failed", { message: error?.message || "recent driver form fetch failed" });
  }
}

async function refreshLiveDataSnapshot(options = {}) {
  const deferCopilot = Boolean(options.startup);
  const includeNews = Boolean(options.startup || options.forceRefresh);
  const urls = includeNews ? { ...LIVE_CORE_DATA_URLS, ...LIVE_NEWS_URLS } : LIVE_CORE_DATA_URLS;
  const { raw, errors } = await fetchLiveDataEntries(urls, { timeout: includeNews ? 4500 : 8500 });
  await fetchOfficialF1StandingsFallback(raw, errors);
  let data = await buildPitWallSnapshot(raw, errors, {
    includeWeekendWeatherFallback: false,
    enrichmentPending: true,
    deferOptional: includeNews,
  });
  data = preserveSnapshotNews(liveDataCache?.data, data);
  data.startupReady = true;
  if (!includeNews) await ensureRecentDriverForm(raw, data);
  if (deferCopilot) {
    data.copilot = liveDataCache?.data?.copilot || null;
  } else {
    data.copilot = { daily: await getDailyCopilotInsights(data, { forceCopilotRefresh: Boolean(options.forceCopilotRefresh), forceCopilotPageId: options.forceCopilotPageId || "" }) };
  }
  liveDataCache = { createdAt: Date.now(), data };
  writeLiveSnapshotDiskCache(data);
  if (deferCopilot) {
    getDailyCopilotInsights(data, { forceCopilotRefresh: Boolean(options.forceCopilotRefresh), forceCopilotPageId: options.forceCopilotPageId || "" })
      .then((daily) => {
        if (liveDataCache?.data?.fetchedAt === data.fetchedAt) {
          liveDataCache.data.copilot = { daily };
          writeLiveSnapshotDiskCache(liveDataCache.data);
        }
      })
      .catch((error) => {
        writePitWallDebugLog("live-data.startup-copilot-failed", { message: error?.message || "Startup Copilot refresh failed" });
      });
  }
  refreshLiveDataEnrichment(raw, errors, data);
  return data;
}

function startLiveDataRefresh(options = {}) {
  if (!liveDataRefresh || options.forceCopilotRefresh || options.forceCopilotPageId) {
    liveDataRefresh = refreshLiveDataSnapshot(options).finally(() => { liveDataRefresh = null; });
  }
  return liveDataRefresh;
}

async function getPitWallSnapshot(options = {}) {
  if (options?.forceRefresh) {
    return startLiveDataRefresh(options);
  }
  if (options?.startup) {
    if (liveDataCache?.data?.startupReady && Date.now() - liveDataCache.createdAt < DATA_CACHE_MS) {
      return liveDataCache.data;
    }
    return startLiveDataRefresh({ ...options, startup: true });
  }
  if (liveDataCache && Date.now() - liveDataCache.createdAt < DATA_CACHE_MS) return liveDataCache.data;
  const diskData = readLiveSnapshotDiskCache();
  if (diskData) {
    const data = { ...diskData, sourceLabel: "Live data (refreshing)", enrichmentPending: true, startupReady: false };
    liveDataCache = { createdAt: Date.now(), data };
    if (!liveDataRefresh) {
      liveDataRefresh = refreshLiveDataSnapshot()
        .catch((error) => {
          writePitWallDebugLog("live-data.refresh-failed", { message: error?.message || "Live data refresh failed" });
          if (liveDataCache?.data?.fetchedAt === data.fetchedAt) {
            liveDataCache = { createdAt: Date.now(), data: { ...data, sourceLabel: "Live data (cached)", enrichmentPending: false } };
          }
          return null;
        })
        .finally(() => { liveDataRefresh = null; });
    }
    return data;
  }
  if (!liveDataRefresh) {
    liveDataRefresh = refreshLiveDataSnapshot().finally(() => { liveDataRefresh = null; });
  }
  return liveDataRefresh;
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

function createBoundedBufferAccumulator(maxBytes = MAX_BUFFERED_MEDIA_BYTES, onLimit = () => {}) {
  const limit = Math.max(0, Number(maxBytes) || 0);
  let chunks = [];
  let byteLength = 0;
  let failed = false;
  const overLimitError = () => new Error(`F1 TV media response is too large to buffer safely (64 MiB maximum).`);
  return {
    add(chunk) {
      if (failed) throw overLimitError();
      const value = Buffer.from(chunk);
      if (byteLength + value.length > limit) {
        failed = true;
        chunks = [];
        byteLength = 0;
        const error = overLimitError();
        onLimit(error);
        throw error;
      }
      chunks.push(value);
      byteLength += value.length;
    },
    finalize() {
      if (failed) throw overLimitError();
      const body = Buffer.concat(chunks, byteLength);
      chunks = [];
      byteLength = 0;
      return body;
    },
    get retainedChunkCount() {
      return chunks.length;
    },
  };
}

function bufferToArrayBuffer(value) {
  const buffer = Buffer.isBuffer(value) ? value : Buffer.from(value);
  return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
}

function requestBuffer(targetUrl, options = {}, redirectsLeft = 4) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(targetUrl);
    const transport = options.transport || (parsed.protocol === "http:" ? http : https);
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
      let bufferError = null;
      const accumulator = createBoundedBufferAccumulator(MAX_BUFFERED_MEDIA_BYTES, (error) => {
        bufferError = error;
        res.destroy(error);
        req.destroy(error);
      });
      res.on("error", reject);
      const declaredLength = Number(res.headers["content-length"]);
      if (Number.isFinite(declaredLength) && declaredLength > MAX_BUFFERED_MEDIA_BYTES) {
        const error = new Error("F1 TV media response is too large to buffer safely (64 MiB maximum).");
        bufferError = error;
        res.destroy(error);
        req.destroy(error);
        return;
      }
      res.on("data", (chunk) => {
        try {
          accumulator.add(chunk);
        } catch (error) {
          bufferError = error;
        }
      });
      res.on("end", () => resolve({
        status: res.statusCode || 0,
        url: targetUrl,
        headers: Object.fromEntries(Object.entries(res.headers).map(([key, value]) => [key, Array.isArray(value) ? value.join(", ") : String(value || "")])),
        sentHeaderNames: Object.keys(headers),
        body: bufferError ? Buffer.alloc(0) : accumulator.finalize(),
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
    responseHint: requestType === 2 && response.status >= 400 ? response.body.slice(0, 180).toString("utf8").replace(/\s+/g, " ") : "",
  });
  return {
    status: response.status,
    url: response.url,
    headers: response.headers,
    errorHint: licenseErrorHint,
    data: bufferToArrayBuffer(response.body),
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
const IGNORED_F1TV_COOKIE_PATTERN = /^login$|abtasty|analytics|consent|stripe|evergage|_ga|_gcl|_fbp|_rdt|tfpsi|reese/i;

function isLikelyAuthCookie(cookie) {
  const name = String(cookie.name || "");
  return F1TV_AUTH_KEY_PATTERN.test(name) && !IGNORED_F1TV_COOKIE_PATTERN.test(name);
}

function f1TvEntitlementTokenFromCookies(cookies = []) {
  const cookie = cookies.find((item) => String(item.name || "").toLowerCase() === "entitlement_token");
  return String(cookie && cookie.value || "").trim();
}

function decodeF1TvJwtPayload(token) {
  const parts = String(token || "").trim().split(".");
  if (parts.length < 2) return {};
  try {
    return JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));
  } catch {
    return {};
  }
}

function isF1TvSubscriptionToken(token) {
  const payload = decodeF1TvJwtPayload(token);
  return Boolean(payload && typeof payload === "object" && (payload.SessionId || payload.sessionId));
}

function f1TvSubscriptionTokenFromLoginSessionCookie(cookies = []) {
  const cookie = cookies.find((item) => String(item.name || "").toLowerCase() === "login-session");
  if (!cookie?.value) return "";
  try {
    return String(JSON.parse(decodeURIComponent(cookie.value))?.data?.subscriptionToken || "").trim();
  } catch {
    return "";
  }
}

async function getF1TvStoredSubscriptionToken() {
  const token = String(await getSecret("f1tv-token") || "").trim();
  return isF1TvSubscriptionToken(token) ? token : "";
}

async function getF1TvSubscriptionToken(cookies = null) {
  const f1TvCookies = cookies || await getF1TvCookies();
  return f1TvSubscriptionTokenFromLoginSessionCookie(f1TvCookies) || await getF1TvStoredSubscriptionToken();
}

function f1TvPlaybackTokenFromBrowserAuthState(browserAuthState = {}) {
  return String(browserAuthState.playbackToken || browserAuthState.playbackTokenCandidate || "").trim();
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
      const playbackKeyRx = /entitlement|subscription|ascendon|access[_-]?token|id[_-]?token/i;
      const preferredPlaybackKeyRx = /entitlement|subscription|ascendon/i;
      const tokenValueRx = /(^eyJ[a-zA-Z0-9_-]+\\.)|^[a-zA-Z0-9._~-]{40,}$/;
      const tokenCandidates = [];
      const addTokenCandidate = (value, keyHint = "") => {
        const text = String(value || "").trim().replace(/^Bearer\\s+/i, "");
        if (text.length < 32 || text.length > 4096) return;
        if (!tokenValueRx.test(text)) return;
        tokenCandidates.push({ text, priority: preferredPlaybackKeyRx.test(keyHint) ? 0 : 1 });
      };
      const collectTokenCandidates = (value, keyHint = "", depth = 0) => {
        if (depth > 4 || tokenCandidates.length > 8) return;
        if (typeof value === "string" || typeof value === "number") {
          const text = String(value || "");
          if (playbackKeyRx.test(keyHint) || tokenValueRx.test(text)) addTokenCandidate(text, keyHint);
          try {
            const parsed = JSON.parse(text);
            collectTokenCandidates(parsed, keyHint, depth + 1);
          } catch {}
          return;
        }
        if (!value || typeof value !== "object") return;
        Object.entries(value).forEach(([key, item]) => collectTokenCandidates(item, keyHint ? keyHint + "." + key : key, depth + 1));
      };
      const safeKeys = (storage, prefix) => {
        try {
          return Array.from({ length: storage.length }, (_, index) => storage.key(index))
            .filter((key) => {
              if (!key || !rx.test(key)) return false;
              let value = "";
              try { value = String(storage.getItem(key) || ""); } catch {}
              const tokenLike = tokenRx.test(key) || tokenRx.test(value);
              if (tokenLike || playbackKeyRx.test(key)) collectTokenCandidates(value, key);
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
        playbackTokenCandidate: (tokenCandidates.sort((a, b) => a.priority - b.priority)[0] || {}).text || "",
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
  const subscriptionActive = tokenReady ? true : browserSession ? false : null;
  return {
    authenticated: tokenReady,
    playbackTokenReady: tokenReady,
    subscriptionActive,
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
  const playbackToken = f1TvPlaybackTokenFromBrowserAuthState(browserAuthState);
  if (playbackToken) await setSecret("f1tv-token", playbackToken).catch(() => {});
  return mergeF1TvStatus(cookies, browserAuthState, playbackToken || await getF1TvPlaybackToken(cookies));
}

async function probeF1TvStoredAuth(options = {}) {
  const targetUrl = isF1TvUrl(options.targetUrl || options.url || "") ? (options.targetUrl || options.url) : F1TV_HOME_URL;
  const probeWindow = new BrowserWindow({
    width: 960,
    height: 640,
    show: false,
    title: "Apexline F1 TV Auth Probe",
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
      const emailFilled = setValue(["input[type='email']", "input[name='email']", "input[name='username']", "input[autocomplete='username']", "input[placeholder*='email' i]", "input[aria-label*='email' i]", "#email", "#username"], ${JSON.stringify(email)});
      const passwordFilled = setValue(["input[type='password']", "input[name='password']", "input[autocomplete='current-password']", "#password"], ${JSON.stringify(password)});
      if (${JSON.stringify(autoSubmit)}) {
        if (emailFilled && passwordFilled) return clickF1TvLoginStep(/sign\\s*in|log\\s*in|continue|submit/i);
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
  const automatedCredentialLogin = Boolean(credentials.email && credentials.password && options.mode === "credentials");

  return new Promise((resolve) => {
    const automationStartedAt = Date.now();
    let settled = false;
    let pollTimer = null;
    let credentialTimer = null;
    let credentialAttempts = 0;
    let lastStatus = null;
    let browserSessionDetectedAt = 0;
    const loginWindow = new BrowserWindow({
      width: 1040,
      height: 820,
      minWidth: 820,
      minHeight: 640,
      title: "F1 TV Login",
      show: !automatedCredentialLogin,
      skipTaskbar: automatedCredentialLogin,
      parent: parent && !parent.isDestroyed() ? parent : undefined,
      modal: false,
      backgroundColor: "#111111",
      webPreferences: {
        offscreen: automatedCredentialLogin,
        backgroundThrottling: !automatedCredentialLogin,
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
      const status = lastStatus || await getF1TvStatus();
      const credentialError = String(credentials.directError || "").slice(0, 240);
      resolve(credentialError && !status.authenticated ? { ...status, credentialError } : status);
    }

    loginWindow.webContents.setWindowOpenHandler(({ url: targetUrl }) => {
      if (isF1TvUrl(targetUrl)) {
        return {
          action: "allow",
          overrideBrowserWindowOptions: {
            show: !automatedCredentialLogin,
            skipTaskbar: automatedCredentialLogin,
            parent: parent && !parent.isDestroyed() ? parent : undefined,
            modal: false,
            backgroundColor: "#111111",
            webPreferences: {
              offscreen: automatedCredentialLogin,
              backgroundThrottling: !automatedCredentialLogin,
              contextIsolation: true,
              nodeIntegration: false,
              sandbox: true,
            },
          },
        };
      }
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
      const now = Date.now();
      if (automatedCredentialLogin && status.browserSession && !browserSessionDetectedAt) browserSessionDetectedAt = now;
      const browserSessionGraceExpired = Boolean(automatedCredentialLogin && browserSessionDetectedAt && now - browserSessionDetectedAt >= F1TV_LOGIN_TOKEN_GRACE_MS);
      const automationTimedOut = Boolean(automatedCredentialLogin && now - automationStartedAt >= F1TV_LOGIN_AUTOMATION_TIMEOUT_MS);
      if ((status.authenticated || (!automatedCredentialLogin && status.browserSession) || browserSessionGraceExpired || automationTimedOut) && !loginWindow.isDestroyed()) {
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
          const titleHint = hints.find((hint) => {
            const leaf = hint.keyPath.split(".").slice(-1)[0].toLowerCase();
            return /^(title|name|channelname|feedname|displayname|caption|label)$/.test(leaf)
              && hint.text && hint.text.length <= 60
              && !/^https?:|^\\//i.test(hint.text) && !/[{}\\[\\]:]/.test(hint.text);
          });
          const title = titleHint ? titleHint.text.trim() : "";
          bucket.streamItems = bucket.streamItems || [];
          manifestHints.forEach((hint) => bucket.streamItems.push({ manifest: hint.text, licenseUrls, label, title, path: path.join(".") }));
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
          if (channelAttempt.manifests.length) foundChannelManifest = true;
        }
        if (foundChannelManifest) break;
        const attempt = await fetchAttempt(endpoint, { endpoint, status: 0, ok: false, contentType: "", manifests: [], licenseUrls: [], streamItems: [], bodyKeys: [] });
        out.push(attempt);
        const channelIds = Array.from(new Set([...(attempt.channelIds || []), ...premiumChannelIds])).slice(0, 24);
        let foundAttemptChannelManifest = false;
        for (const channelId of channelIds) {
          const channelEndpoint = endpoint + "&channelId=" + encodeURIComponent(channelId) + "&player=player_tm";
          const channelAttempt = await fetchAttempt(channelEndpoint, { endpoint: channelEndpoint, status: 0, ok: false, contentType: "", manifests: [], licenseUrls: [], streamItems: [], bodyKeys: [], channelIds: [channelId], player: "player_tm" });
          out.push(channelAttempt);
          if (channelAttempt.manifests.length) foundAttemptChannelManifest = true;
        }
        if (attempt.manifests.length || foundAttemptChannelManifest) break;
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
    streamItems: attempts.flatMap((attempt) => {
      const attemptChannelId = attempt.channelIds?.length === 1 ? String(attempt.channelIds[0]) : "";
      return (attempt.streamItems || []).map((item) => ({
        ...item,
        channelId: item.channelId || attemptChannelId,
        manifest: absolute(item.manifest),
        licenseUrls: Array.from(new Set((item.licenseUrls || []).map(absolute).filter(Boolean))),
      }));
    }).filter((item) => isF1TvManifestUrl(item.manifest)),
  };
}

async function findF1TvContentCandidatesInPage(webContents, options = {}) {
  return webContents.executeJavaScript(`
    (() => {
      const sessionKind = ${JSON.stringify(String(options.sessionKind || ""))};
      const raceName = ${JSON.stringify(String(options.raceName || ""))};
      const scoreCandidate = ${scoreF1TvContentCandidate.toString()};
      const normalize = (value) => String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
      const nodes = Array.from(document.querySelectorAll('a[href*="/detail/"], [data-href*="/detail/"]'));
      const candidates = nodes.map((node, index) => {
        const href = node.href || node.getAttribute("href") || node.dataset?.href || "";
        const id = (String(href).match(/\\/detail\\/([0-9]+)/i) || [])[1] || "";
        const text = normalize([node.textContent, node.ariaLabel, node.title, href].filter(Boolean).join(" "));
        const score = scoreCandidate(text, { raceName, sessionKind });
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

function scoreF1TvContentCandidate(value, options) {
  options = options || {};
  const normalize = (text) => String(text || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  const sessionType = (text) => {
    const normalized = normalize(text);
    if (/sprint qualifying|sprint shootout|shootout/.test(normalized)) return "sprint qualifying";
    if (/practice 1|free practice 1|fp1/.test(normalized)) return "practice 1";
    if (/practice 2|free practice 2|fp2/.test(normalized)) return "practice 2";
    if (/practice 3|free practice 3|fp3/.test(normalized)) return "practice 3";
    if (/\bqualifying\b|\bquali\b/.test(normalized)) return "qualifying";
    if (/\bsprint\b/.test(normalized)) return "sprint";
    if (/\brace\b|grand prix/.test(normalized)) return "race";
    return "";
  };
  const text = normalize(value);
  const raceNeedle = normalize(options.raceName || "");
  const sessionNeedle = normalize(options.sessionKind || "");
  const requestedSession = sessionType(sessionNeedle);
  const candidateSession = sessionType(text);
  const raceWords = raceNeedle.split(" ").filter((word) => word.length > 3 && !["grand", "prix", "race"].includes(word));
  let score = 0;
  if (raceNeedle && text.includes(raceNeedle)) score += 3;
  if (raceWords.length) score += Math.min(3, raceWords.filter((word) => text.includes(word)).length);
  const hasRequestedSession = Boolean(sessionNeedle && (candidateSession && requestedSession ? candidateSession === requestedSession : text.includes(sessionNeedle)));
  if (hasRequestedSession) score += 6;
  if (candidateSession && requestedSession && candidateSession !== requestedSession) score -= 6;
  if (sessionNeedle && sessionNeedle !== "race" && !hasRequestedSession) score -= 4;
  if (/\b(formula 1|f1)\b/.test(text)) score += 8;
  if (/\bgrand prix\b/.test(text)) score += 2;
  if (sessionNeedle === "race" && /\bgrand prix\b/.test(text) && !/\b(practice|qualifying|pre race|post race|kids)\b/.test(text)) score += 6;
  if (/\b(formula 2|f2|formula 3|f3|f1 academy|f1 kids|kids|porsche supercup|psc)\b/.test(text)) score -= 12;
  if (/pre qualifying|post qualifying|pre race|post race|highlights|summary/.test(text)) score -= 1;
  if (/practice|qualifying|race/.test(text)) score += 2;
  if (/replay|live event|qualifying|practice|race/.test(text)) score += 1;
  return score;
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

function f1TvManifestStreamStatus(text, options = {}) {
  const source = String(text || "");
  if (!source.trim()) return "";
  const manifestType = String(options.manifestType || "").toLowerCase();
  const contentType = String(options.contentType || "").toLowerCase();
  const isDash = manifestType === "dash" || /dash\+xml|mpd|xml/.test(contentType) || /^\s*<MPD\b/i.test(source);
  if (isDash) {
    const type = (source.match(/\btype\s*=\s*["']([^"']+)["']/i)?.[1] || "").toLowerCase();
    if (type === "dynamic") return "live";
    if (type === "static") return "replay";
    if (/\bminimumUpdatePeriod\s*=|\btimeShiftBufferDepth\s*=/i.test(source)) return "live";
    return "";
  }
  const isHls = manifestType === "hls" || /mpegurl|m3u8/.test(contentType) || /^\s*#EXTM3U/i.test(source);
  if (isHls) {
    if (/#EXT-X-ENDLIST/i.test(source) || /#EXT-X-PLAYLIST-TYPE\s*:\s*VOD/i.test(source)) return "replay";
    if (/#EXT-X-PLAYLIST-TYPE\s*:\s*EVENT/i.test(source)) return "live";
    if (/#EXT-X-MEDIA-SEQUENCE|#EXT-X-TARGETDURATION|#EXTINF/i.test(source)) return "live";
  }
  return "";
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
  const streamStatus = f1TvManifestStreamStatus(text, {
    manifestType: feed.manifestType,
    contentType: response.headers?.["content-type"] || "",
  });
  const direct = f1TvManifestProgramDateTime(text);
  if (direct.videoStartUtc) return { ...direct, ...(streamStatus ? { streamStatus } : {}) };
  if (!/\.m3u8(?:[?#]|$)/i.test(manifestUrl) && !/mpegurl|m3u8/i.test(response.headers?.["content-type"] || "")) {
    return streamStatus ? { streamStatus } : {};
  }
  const childUrl = f1TvFirstHlsChildPlaylistUrl(text, manifestUrl);
  if (!childUrl || !isF1TvMediaUrl(childUrl)) return streamStatus ? { streamStatus } : {};
  const childCookieHeader = await f1TvCookieHeaderForUrl(childUrl);
  const childResponse = await requestBuffer(childUrl, {
    headers: feed.headers || {},
    cookieHeader: childCookieHeader,
    timeoutMs: 6500,
  });
  if (childResponse.status < 200 || childResponse.status >= 300 || !childResponse.body?.length) return streamStatus ? { streamStatus } : {};
  const childText = childResponse.body.toString("utf8");
  const childStatus = f1TvManifestStreamStatus(childText, {
    manifestType: "hls",
    contentType: childResponse.headers?.["content-type"] || "",
  });
  const child = f1TvManifestProgramDateTime(childText);
  const status = childStatus || streamStatus;
  if (child.videoStartUtc) return { ...child, videoStartSource: `${child.videoStartSource}:child-playlist`, ...(status ? { streamStatus: status } : {}) };
  return status ? { streamStatus: status } : {};
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
    title: extra.title || "",
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
    const title = String(item.title || "").trim();
    const driverCode = driverCodeFromF1TvText(`${title} ${label} ${manifest}`);
    const channelId = String(item.channelId || "").replace(/[^A-Za-z0-9_-]/g, "");
    metadata.set(manifest, {
      label: label || f1TvStreamLabel(manifest),
      title,
      driverCode,
      feedId: driverCode || channelId || "",
      kind: driverCode ? "onboard" : /main|world|wif|presentation/i.test(`${title} ${label} ${manifest}`) ? "world" : "feed",
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

function f1TvPlaybackMode(options = {}) {
  const streamStatus = String(options.streamStatus || "").toLowerCase();
  if (streamStatus === "live") return "live";
  if (streamStatus === "replay") return "replay";
  const status = String(options.sessionStatus || options.status || "").toLowerCase();
  if (status === "live") return "live";
  return /live/i.test(String(options.sessionKind || "")) ? "live" : "replay";
}

function f1TvSubscriptionIssueFromAttempts(attempts = []) {
  const text = attempts.map((attempt) => [
    attempt.resultCode,
    attempt.message,
    attempt.errorDescription,
    attempt.error,
  ].filter(Boolean).join(" ")).join(" ");
  if (!/Rights are locked|ACN_2001|subscription|entitlement/i.test(text)) return "";
  return "F1 TV subscription is not active for this content. Confirm your F1 TV subscription is active, then reconnect F1 TV in Settings.";
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
    title: "Apexline F1 TV Resolver",
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
  const feedTimings = await Promise.all(feeds.map(async (feed) => ({
    feed,
    timing: await f1TvManifestTiming(feed).catch(() => ({})),
  })));
  const timingFeedTiming = feedTimings.find((item) => item.feed === timingFeed)?.timing || {};
  const manifestTiming = timingFeedTiming.videoStartUtc
    ? timingFeedTiming
    : feedTimings.find((item) => item.timing?.videoStartUtc)?.timing || {};
  const streamStatus = timingFeedTiming.streamStatus
    || feedTimings.find((item) => item.timing?.streamStatus)?.timing.streamStatus
    || "";
  feeds = feedTimings.map(({ feed, timing }) => {
    const feedStreamStatus = timing?.streamStatus || streamStatus;
    const streamStatusFields = feedStreamStatus ? { streamStatus: feedStreamStatus } : {};
    if (timing?.videoStartUtc) return { ...feed, ...timing };
    return manifestTiming.videoStartUtc
      ? { ...feed, ...manifestTiming, ...streamStatusFields, videoStartSource: `${manifestTiming.videoStartSource || "manifest"}:fallback` }
      : { ...feed, ...streamStatusFields };
  });

  const subscriptionIssueMessage = feeds.length ? "" : f1TvSubscriptionIssueFromAttempts(capture.playEndpointAttempts);
  const authStatus = subscriptionIssueMessage ? { ...status, subscriptionActive: false } : status;
  const result = {
    ok: feeds.length > 0,
    contentId: resolvedContentId || f1TvContentIdFromUrl(targetUrl) || String(options.contentId || ""),
    title: String(options.title || options.sessionKind || "F1 TV session"),
    sourceUrl: targetUrl,
    streamStatus,
    playbackMode: f1TvPlaybackMode({ ...options, streamStatus }),
    videoStartUtc: manifestTiming.videoStartUtc || "",
    videoStartSource: manifestTiming.videoStartSource || "",
    feeds,
    licenseUrl,
    licenseRequests: capture.licenseRequests.slice(0, 3),
    requestSamples: capture.requestSamples.slice(0, 25),
    playEndpointAttempts: capture.playEndpointAttempts.slice(0, 12),
    contentCandidates: capture.contentCandidates.slice(0, 12),
    authStatus,
    message: feeds.length
      ? `Resolved ${feeds.length} F1 TV stream${feeds.length === 1 ? "" : "s"}.`
      : subscriptionIssueMessage
        || (status.authenticated
        ? "No playable stream was discovered for the selected F1 TV result. Try pasting the exact F1 TV detail URL."
        : status.browserSession
          ? "F1 TV browser cookies exist, but the playback token is missing. Sign in with email and password in Settings, then retry."
        : "F1 TV is not connected in this Apexline app profile. MultiViewer login is separate. Connect F1 TV, then load the session again."),
  };
  writePitWallDebugLog("f1tv.resolve.result", {
    ok: result.ok,
    contentId: result.contentId,
    candidateCount: capture.contentCandidates.length,
    feedCount: feeds.length,
    streamStatus,
    videoStartSynced: Boolean(manifestTiming.videoStartUtc),
    videoStartSource: manifestTiming.videoStartSource || "",
    playAttemptCount: capture.playEndpointAttempts.length,
    playbackTokenReady: Boolean(status.playbackTokenReady),
    subscriptionActive: authStatus.subscriptionActive,
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
      subscriptionActive: result.authStatus?.subscriptionActive === false ? false : result.authStatus?.subscriptionActive === true ? true : null,
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

function roundLiveSyncProbeNumber(value, digits = 3) {
  const number = Number(value);
  if (!Number.isFinite(number)) return null;
  const factor = 10 ** digits;
  return Math.round(number * factor) / factor;
}

const SHAKA_LIVE_SYNC_TOLERANCE_MIN = 3;
const SHAKA_LIVE_SYNC_TOLERANCE_MAX = 8;

function liveSyncToleranceForTargetLatency(targetLatency) {
  const target = Number(targetLatency);
  if (!Number.isFinite(target) || target <= 0) return SHAKA_LIVE_SYNC_TOLERANCE_MAX;
  return Math.max(
    SHAKA_LIVE_SYNC_TOLERANCE_MIN,
    Math.min(SHAKA_LIVE_SYNC_TOLERANCE_MAX, Math.round(target * 2.2) / 10)
  );
}

function selectedLiveSyncProbeFeed(result = {}) {
  const requested = String(process.env.PITWALL_F1TV_LIVE_SYNC_FEED_ID || "WORLD").trim().toUpperCase();
  const feeds = Array.isArray(result.feeds) ? result.feeds : [];
  return feeds.find((feed) => String(feed.feedId || "").toUpperCase() === requested)
    || feeds.find((feed) => feed.kind === "world" || feed.feedId === "WORLD")
    || feeds[0]
    || null;
}

function liveSyncProbeScript(payload = {}) {
  return `
    (async () => {
      const payload = ${JSON.stringify(payload)};
      const feed = payload.feed || {};
      const targetLatency = Number(payload.targetLatency) || 36;
      const sampleSeconds = Number(payload.sampleSeconds) || 45;
      const sampleIntervalMs = Number(payload.sampleIntervalMs) || 1000;
      const nearTolerance = Number(payload.nearTolerance) || 1.5;
      const liveSyncTolerance = Number(payload.liveSyncTolerance) || 8;
      const finalWindowSeconds = Number(payload.finalWindowSeconds) || 12;
      const rateTolerance = Number(payload.rateTolerance) || 0.03;
      const loadTimeoutMs = Number(payload.loadTimeoutMs) || 25000;
      const playTimeoutMs = Number(payload.playTimeoutMs) || 5000;
      const errors = [];
      const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
      const withTimeout = (promise, ms, label) => Promise.race([
        promise,
        new Promise((_, reject) => setTimeout(() => reject(new Error(label + " timed out after " + ms + "ms")), ms)),
      ]);
      const finite = (value) => Number.isFinite(Number(value)) ? Number(value) : null;
      const round = (value, digits = 3) => {
        const number = finite(value);
        if (number === null) return null;
        const factor = 10 ** digits;
        return Math.round(number * factor) / factor;
      };
      const safeError = (error) => {
        const detail = error?.detail || error || {};
        const message = String(detail.message || error?.message || error || "")
          .replace(/https?:\\/\\/\\S+/g, "[url]")
          .slice(0, 180);
        return {
          code: Number(detail.code || 0) || 0,
          category: Number(detail.category || 0) || 0,
          severity: Number(detail.severity || 0) || 0,
          message,
        };
      };
      const measure = (player, video) => {
        const range = player.seekRange?.() || {};
        const start = finite(range.start);
        const end = finite(range.end);
        const currentTime = finite(video.currentTime);
        const latency = end !== null && currentTime !== null ? end - currentTime : null;
        const playheadDate = typeof player.getPlayheadTimeAsDate === "function" ? player.getPlayheadTimeAsDate() : null;
        const playheadUtcMs = playheadDate && Number.isFinite(playheadDate.getTime?.()) ? playheadDate.getTime() : null;
        return {
          latency,
          playbackRate: finite(video.playbackRate) || 1,
          currentTime,
          playheadUtcMs,
          playheadUtc: playheadUtcMs !== null ? new Date(playheadUtcMs).toISOString() : "",
          rangeStart: start,
          rangeEnd: end,
          rangeSeconds: start !== null && end !== null ? end - start : null,
          paused: Boolean(video.paused),
          readyState: video.readyState,
        };
      };
      const waitForUsableRange = async (player, video, timeoutMs) => {
        const deadline = Date.now() + timeoutMs;
        while (Date.now() < deadline) {
          const state = measure(player, video);
          if (Number.isFinite(state.rangeEnd) && Number.isFinite(state.rangeStart) && state.rangeSeconds > 0) return state;
          await wait(250);
        }
        return measure(player, video);
      };
      const waitForSeek = (video, timeoutMs) => new Promise((resolve) => {
        let settled = false;
        const done = () => {
          if (settled) return;
          settled = true;
          video.removeEventListener("seeked", done);
          resolve();
        };
        video.addEventListener("seeked", done);
        setTimeout(done, timeoutMs);
      });

      if (!window.shaka?.Player) {
        return { ok: false, message: "Shaka Player was not available in the diagnostic window." };
      }
      if (!window.pitwall?.f1tv?.mediaFetch) {
        return { ok: false, message: "F1 TV media bridge was not available in the diagnostic window." };
      }

      const video = document.getElementById("probe-video");
      video.muted = true;
      video.autoplay = true;
      video.playsInline = true;
      window.shaka.polyfill?.installAll?.();
      const NetworkingEngine = window.shaka.net.NetworkingEngine;
      const priority = NetworkingEngine.PluginPriority?.APPLICATION || 3;
      NetworkingEngine.registerScheme("https", (uri, request, requestType, progressUpdated, headersReceived) => {
        let aborted = false;
        const startedAt = Date.now();
        const promise = window.pitwall.f1tv.mediaFetch({
          url: uri,
          method: request.method || "GET",
          headers: request.headers || {},
          body: request.body || null,
          requestType,
        }).then((response) => {
          if (aborted) throw new Error("Request aborted.");
          const data = response.data || new ArrayBuffer(0);
          const bytes = data.byteLength || data.length || 0;
          if (requestType === NetworkingEngine.RequestType.LICENSE && Number(response.status || 0) >= 400) {
            throw new Error(response.errorHint ? "F1 TV license rejected: " + response.errorHint : "F1 TV license request failed.");
          }
          headersReceived?.(response.headers || {});
          progressUpdated?.(Date.now() - startedAt, bytes, 0);
          return {
            uri: response.url || uri,
            originalUri: uri,
            data,
            headers: response.headers || {},
            fromCache: false,
            status: response.status || 0,
          };
        });
        return new window.shaka.util.AbortableOperation(promise, () => {
          aborted = true;
          return Promise.resolve();
        });
      }, priority, false);

      const player = new window.shaka.Player();
      player.addEventListener("error", (event) => errors.push(safeError(event)));
      try {
        await player.attach(video);
        const licenseServer = feed.licenseUrl || feed.drm?.licenseUrl || "";
        player.configure({
          drm: licenseServer ? { servers: { "com.widevine.alpha": licenseServer } } : {},
          streaming: {
            lowLatencyMode: false,
            bufferingGoal: 12,
            rebufferingGoal: 3,
            bufferBehind: 8,
            liveSync: {
              enabled: true,
              targetLatency,
              targetLatencyTolerance: liveSyncTolerance,
              maxPlaybackRate: 1,
              minPlaybackRate: 1,
              panicMode: false,
              panicThreshold: 2,
              dynamicTargetLatency: {
                enabled: false,
                maxAttempts: 0,
                maxLatency: Math.max(targetLatency + 15, targetLatency * 1.5),
                minLatency: targetLatency,
                rebufferIncrement: 0,
                stabilityThreshold: 0,
              },
            },
          },
        });
        player.getNetworkingEngine()?.registerRequestFilter((type, request) => {
          request.allowCrossSiteCredentials = true;
          request.headers = { ...(request.headers || {}), ...(feed.headers || {}) };
          if (licenseServer && type === NetworkingEngine.RequestType.LICENSE) request.uris = [licenseServer];
        });
        const mimeType = feed.manifestType === "dash" ? "application/dash+xml" : feed.manifestType === "hls" ? "application/x-mpegURL" : undefined;
        await withTimeout(player.load(feed.manifestUrl, null, mimeType), loadTimeoutMs, "Shaka load");
        await withTimeout(video.play(), playTimeoutMs, "Video play");
        await wait(1000);
        const beforeMatch = await waitForUsableRange(player, video, 20000);
        if (!Number.isFinite(beforeMatch.rangeEnd) || !Number.isFinite(beforeMatch.rangeStart)) {
          return { ok: false, message: "No live seek range was available after loading playback.", errors: errors.slice(0, 4) };
        }
        if (beforeMatch.rangeSeconds < Math.max(1, targetLatency - 1)) {
          return {
            ok: false,
            message: "The current live DVR window is shorter than the requested target latency.",
            targetLatency,
            availableRangeSeconds: round(beforeMatch.rangeSeconds),
            errors: errors.slice(0, 4),
          };
        }
        const targetTime = Math.max(beforeMatch.rangeStart, beforeMatch.rangeEnd - targetLatency);
        video.currentTime = targetTime;
        await waitForSeek(video, 3000);
        await wait(1000);
        const afterMatch = measure(player, video);
        const samples = [];
        const startedAt = performance.now();
        while ((performance.now() - startedAt) / 1000 < sampleSeconds) {
          const state = measure(player, video);
          const elapsed = (performance.now() - startedAt) / 1000;
          samples.push({
            t: round(elapsed, 1),
            latency: round(state.latency),
            playbackRate: round(state.playbackRate, 3),
            playheadUtcMs: state.playheadUtcMs,
            playheadUtc: state.playheadUtc,
            rangeSeconds: round(state.rangeSeconds),
            readyState: state.readyState,
          });
          await wait(sampleIntervalMs);
        }
        const validSamples = samples.filter((sample) => Number.isFinite(sample.latency));
        const reachedTarget = validSamples.some((sample) => Math.abs(sample.latency - targetLatency) <= nearTolerance);
        const finalSamples = validSamples.filter((sample) => sample.t >= Math.max(0, sampleSeconds - finalWindowSeconds));
        const finalLatencyDeltas = finalSamples.map((sample) => Math.abs(sample.latency - targetLatency));
        const finalRateMatches = finalSamples.filter((sample) => Math.abs((sample.playbackRate || 1) - 1) <= rateTolerance).length;
        const finalLatencyTolerance = Math.max(nearTolerance, liveSyncTolerance);
        const averageFinalDelta = finalLatencyDeltas.length
          ? finalLatencyDeltas.reduce((sum, value) => sum + value, 0) / finalLatencyDeltas.length
          : null;
        const maxFinalDelta = finalLatencyDeltas.length ? Math.max(...finalLatencyDeltas) : null;
        const rateStableRatio = finalSamples.length ? finalRateMatches / finalSamples.length : 0;
        const stabilized = Boolean(
          reachedTarget &&
          finalSamples.length >= Math.max(3, Math.floor(finalWindowSeconds / 2)) &&
          averageFinalDelta !== null &&
          averageFinalDelta <= finalLatencyTolerance &&
          maxFinalDelta <= finalLatencyTolerance &&
          rateStableRatio >= 0.7
        );
        const latencies = validSamples.map((sample) => sample.latency);
        const final = validSamples[validSamples.length - 1] || null;
        return {
          ok: Boolean(reachedTarget && stabilized),
          targetLatency,
          nearTolerance,
          liveSyncTolerance,
          finalLatencyTolerance,
          sampleSeconds,
          reachedTarget,
          stabilized,
          rateReturnedToOne: rateStableRatio >= 0.7,
          beforeMatch: {
            latency: round(beforeMatch.latency),
            playbackRate: round(beforeMatch.playbackRate, 3),
            rangeSeconds: round(beforeMatch.rangeSeconds),
            currentTime: round(beforeMatch.currentTime),
            playheadUtcMs: beforeMatch.playheadUtcMs,
            playheadUtc: beforeMatch.playheadUtc,
            rangeStart: round(beforeMatch.rangeStart),
            rangeEnd: round(beforeMatch.rangeEnd),
          },
          afterMatch: {
            latency: round(afterMatch.latency),
            playbackRate: round(afterMatch.playbackRate, 3),
            rangeSeconds: round(afterMatch.rangeSeconds),
            currentTime: round(afterMatch.currentTime),
            playheadUtcMs: afterMatch.playheadUtcMs,
            playheadUtc: afterMatch.playheadUtc,
            rangeStart: round(afterMatch.rangeStart),
            rangeEnd: round(afterMatch.rangeEnd),
            requestedTime: round(targetTime),
          },
          final,
          latencySummary: {
            min: latencies.length ? round(Math.min(...latencies)) : null,
            max: latencies.length ? round(Math.max(...latencies)) : null,
            averageFinalDelta: round(averageFinalDelta),
            maxFinalDelta: round(maxFinalDelta),
            rateStableRatio: round(rateStableRatio, 3),
          },
          samples,
          errors: errors.slice(0, 4),
        };
      } catch (error) {
        return {
          ok: false,
          message: safeError(error).message || "Live sync playback probe failed.",
          errors: [safeError(error), ...errors].slice(0, 4),
        };
      } finally {
        await player.destroy().catch(() => {});
      }
    })();
  `;
}

async function runF1TvLiveSyncDiagnostic(result = {}) {
  if (!process.env.PITWALL_F1TV_LIVE_SYNC_DIAG) return null;
  const feed = selectedLiveSyncProbeFeed(result);
  if (!feed?.manifestUrl) {
    return { ok: false, message: "No resolved feed manifest was available for live sync playback." };
  }
  const root = path.resolve(app.getAppPath());
  const shakaPath = [
    path.join(root, "node_modules/shaka-player/dist/shaka-player.compiled.js"),
    path.join(__dirname, "../node_modules/shaka-player/dist/shaka-player.compiled.js"),
  ].find((candidate) => fs.existsSync(candidate));
  if (!shakaPath) {
    return { ok: false, message: "Shaka Player was not available for live sync playback." };
  }
  const targetLatency = Math.max(5, Math.min(120, Number(process.env.PITWALL_F1TV_LIVE_SYNC_TARGET_SECONDS || 36) || 36));
  const liveSyncTolerance = liveSyncToleranceForTargetLatency(targetLatency);
  const sampleSeconds = Math.max(8, Math.min(180, Number(process.env.PITWALL_F1TV_LIVE_SYNC_SAMPLE_SECONDS || 45) || 45));
  const nearTolerance = Math.max(0.25, Math.min(5, Number(process.env.PITWALL_F1TV_LIVE_SYNC_TOLERANCE_SECONDS || 1.5) || 1.5));
  const sampleIntervalMs = Math.max(500, Math.min(5000, Number(process.env.PITWALL_F1TV_LIVE_SYNC_SAMPLE_INTERVAL_MS || 1000) || 1000));
  const finalWindowSeconds = Math.max(4, Math.min(sampleSeconds, Number(process.env.PITWALL_F1TV_LIVE_SYNC_FINAL_WINDOW_SECONDS || 12) || 12));
  const rateTolerance = Math.max(0.005, Math.min(0.2, Number(process.env.PITWALL_F1TV_LIVE_SYNC_RATE_TOLERANCE || 0.03) || 0.03));
  const loadTimeoutMs = Math.max(5000, Math.min(60000, Number(process.env.PITWALL_F1TV_LIVE_SYNC_LOAD_TIMEOUT_MS || 25000) || 25000));
  const playTimeoutMs = Math.max(1000, Math.min(15000, Number(process.env.PITWALL_F1TV_LIVE_SYNC_PLAY_TIMEOUT_MS || 5000) || 5000));
  if (process.env.PITWALL_F1TV_LIVE_SYNC_CHECK_TIMING) {
    ensureF1TimingLiveClient().catch(() => {});
    const timingConnectDeadline = Date.now() + Math.max(1000, Math.min(30000, Number(process.env.PITWALL_F1TV_LIVE_SYNC_TIMING_CONNECT_MS || 12000) || 12000));
    while ((!f1LiveTimingState?.lastMessageAt || Date.now() - f1LiveTimingState.lastMessageAt > F1_TIMING_LIVE_STALE_MS) && Date.now() < timingConnectDeadline) {
      await wait(500);
    }
  }
  const payload = {
    feed,
    targetLatency,
    sampleSeconds,
    sampleIntervalMs,
    nearTolerance,
    liveSyncTolerance,
    finalWindowSeconds,
    rateTolerance,
    loadTimeoutMs,
    playTimeoutMs,
  };
  const win = new BrowserWindow({
    width: 960,
    height: 540,
    show: false,
    backgroundColor: "#05070a",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webviewTag: false,
      backgroundThrottling: false,
      preload: path.join(root, "electron/preload.cjs"),
    },
  });
  const { server, url } = await startStaticServer(root);
  staticServer = server;
  diagnosticWindowRunActive = true;
  try {
    await win.loadURL(`${url}/ui_kits/pitwall/index.html?probe=live-sync`);
    await win.webContents.executeJavaScript(`
      document.documentElement.innerHTML = '<head><meta charset="utf-8"><title>Apexline live sync probe</title></head><body style="margin:0;background:#05070a"><video id="probe-video" muted autoplay playsinline style="width:1px;height:1px;opacity:0"></video></body>';
    `, true);
    const shakaSource = fs.readFileSync(shakaPath, "utf8");
    await win.webContents.executeJavaScript(shakaSource, true);
    const resultPayload = await win.webContents.executeJavaScript(liveSyncProbeScript(payload), true);
    const diagnostic = {
      ...(resultPayload || {}),
      feed: {
        feedId: feed.feedId || "",
        kind: feed.kind || "",
        manifestType: feed.manifestType || "",
        manifestId: createHash("sha256").update(String(feed.manifestUrl || "")).digest("hex").slice(0, 16),
        hasLicenseUrl: Boolean(feed.licenseUrl || feed.drm?.licenseUrl),
        licenseHost: urlDebugParts(feed.licenseUrl || feed.drm?.licenseUrl || "").host,
      },
      targetLatency: roundLiveSyncProbeNumber(resultPayload?.targetLatency ?? targetLatency),
      liveSyncTolerance: roundLiveSyncProbeNumber(resultPayload?.liveSyncTolerance ?? liveSyncTolerance),
      sampleSeconds,
    };
    if (process.env.PITWALL_F1TV_LIVE_SYNC_CHECK_TIMING) {
      const finalPlayheadUtcMs = Number(resultPayload?.final?.playheadUtcMs || resultPayload?.afterMatch?.playheadUtcMs);
      let timingSnapshot = null;
      const deadline = Date.now() + Math.max(1000, Math.min(30000, Number(process.env.PITWALL_F1TV_LIVE_SYNC_TIMING_TIMEOUT_MS || 12000) || 12000));
      while (Number.isFinite(finalPlayheadUtcMs) && Date.now() < deadline) {
        timingSnapshot = getF1LiveTimingSnapshot({ source: "f1", targetUtcMs: finalPlayheadUtcMs, targetLatencySeconds: targetLatency });
        if (timingSnapshot?.timing?.length) break;
        await wait(500);
      }
      diagnostic.liveTimingAtPlayhead = {
        ok: Boolean(timingSnapshot?.timing?.length),
        targetUtcMs: Number.isFinite(finalPlayheadUtcMs) ? finalPlayheadUtcMs : null,
        targetUtc: Number.isFinite(finalPlayheadUtcMs) ? new Date(finalPlayheadUtcMs).toISOString() : "",
        rowCount: timingSnapshot?.timing?.length || 0,
        lap: finiteNumber(timingSnapshot?.sessionClock?.lapCount?.lap),
        sourceLabel: timingSnapshot?.sourceLabel || "",
        timingTargetSeconds: roundLiveSyncProbeNumber(timingSnapshot?.diagnostics?.targetSeconds),
        message: timingSnapshot?.message || "",
      };
      diagnostic.ok = Boolean(diagnostic.ok && diagnostic.liveTimingAtPlayhead.ok);
    }
    writePitWallDebugLog("f1tv.live-sync-diagnostic", {
      ok: Boolean(diagnostic.ok),
      feed: diagnostic.feed,
      targetLatency: diagnostic.targetLatency,
      liveSyncTolerance: diagnostic.liveSyncTolerance,
      reachedTarget: Boolean(diagnostic.reachedTarget),
      stabilized: Boolean(diagnostic.stabilized),
      final: diagnostic.final || null,
      latencySummary: diagnostic.latencySummary || null,
      liveTimingAtPlayhead: diagnostic.liveTimingAtPlayhead || null,
      message: diagnostic.message || "",
    });
    return diagnostic;
  } catch (error) {
    const diagnostic = {
      ok: false,
      message: error?.message || "F1 TV live sync diagnostic failed.",
      feed: {
        feedId: feed.feedId || "",
        kind: feed.kind || "",
        manifestType: feed.manifestType || "",
        manifestId: createHash("sha256").update(String(feed.manifestUrl || "")).digest("hex").slice(0, 16),
      },
      targetLatency,
      sampleSeconds,
    };
    writePitWallDebugLog("f1tv.live-sync-diagnostic", diagnostic);
    return diagnostic;
  } finally {
    diagnosticWindowRunActive = false;
    if (!win.isDestroyed()) win.destroy();
    server.close();
    if (staticServer === server) staticServer = null;
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
    const liveSyncDiagnostic = await runF1TvLiveSyncDiagnostic(result);
    console.log(JSON.stringify({
      pitwallF1TvDiagnostic: sanitizeF1TvDiagnosticResult(result),
      pitwallF1TvMediaDiagnostic: mediaDiagnostic || undefined,
      pitwallF1TvLiveSyncDiagnostic: liveSyncDiagnostic || undefined,
    }, null, 2));
    app.exit(result.ok && (!mediaDiagnostic || mediaDiagnostic.ok) && (!liveSyncDiagnostic || liveSyncDiagnostic.ok) ? 0 : 2);
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
    if (parsed?.schemaVersion !== F1TV_LIBRARY_CACHE_VERSION) return null;
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
    fs.writeFileSync(f1TvLibraryCachePath(), JSON.stringify({ schemaVersion: F1TV_LIBRARY_CACHE_VERSION, entries }, null, 2), "utf8");
  } catch {}
}

async function refreshF1TvLibrary(year) {
  const [meetingsResult, sessionsResult, cmsResult] = await Promise.allSettled([
    requestOpenF1Json(`https://api.openf1.org/v1/meetings?year=${year}`),
    requestOpenF1Json(`https://api.openf1.org/v1/sessions?year=${year}`),
    fetchF1TvCmsSeasonContent(year),
  ]);
  const meetings = meetingsResult.status === "fulfilled" ? meetingsResult.value : [];
  const sessions = sessionsResult.status === "fulfilled" ? sessionsResult.value : [];
  const cmsItems = cmsResult.status === "fulfilled" ? cmsResult.value : [];
  const races = parseOpenF1Schedule(meetings, sessions)
  .filter((race) => year !== "2026" || !isCancelledF12026RaceName(race.name || ""))
  .map((race, index) => ({
    rnd: index + 1,
    name: race.name,
    circuit: race.circuit,
    loc: race.loc,
    date: race.date,
    startsAt: race.startsAt,
    endsAt: race.endsAt,
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
  const openF1Library = {
    source: "OpenF1",
    season: year,
    races,
    fetchedAt: new Date().toISOString(),
    errors: [meetingsResult, sessionsResult, cmsResult].filter((result) => result.status === "rejected").map((result) => result.reason.message),
  };
  const library = cmsItems.length ? applyF1TvCmsLibraryMetadata(openF1Library, cmsItems) : openF1Library;
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
  return getOrCreateInFlightRefresh(
    f1TvLibraryRefreshes,
    year,
    () => refreshF1TvLibrary(year),
  );
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
      sessions: (race.sessions || []).map((sessionItem) => ({
        kind: sessionItem.kind || "",
        status: sessionItem.status || "",
        statusSource: sessionItem.statusSource || "",
        contentSubtype: sessionItem.contentSubtype || "",
        sessionKey: sessionItem.sessionKey || "",
      })),
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

async function runReplayTimingAvailabilityDiagnosticAndQuit() {
  if (!String(process.env.PITWALL_REPLAY_TIMING_AVAILABILITY_DIAG || "").trim()) return false;
  const options = {
    meetingKey: process.env.PITWALL_REPLAY_TIMING_MEETING_KEY || "1286",
    sessionKey: process.env.PITWALL_REPLAY_TIMING_SESSION_KEY || "11295",
    sessionKind: process.env.PITWALL_REPLAY_TIMING_SESSION || "Qualifying",
    raceName: process.env.PITWALL_REPLAY_TIMING_RACE || "Monaco Grand Prix",
    raceStartsAt: process.env.PITWALL_REPLAY_TIMING_RACE_START || "2026-06-07T13:00:00.000Z",
    sessionStartsAt: process.env.PITWALL_REPLAY_TIMING_SESSION_START || "2026-06-06T14:00:00.000Z",
    sessionEndsAt: process.env.PITWALL_REPLAY_TIMING_SESSION_END || "2026-06-06T15:00:00.000Z",
  };
  const startedAt = Date.now();
  const status = await getReplayTimingAvailability(options).catch((error) => ({
    ok: false,
    status: "error",
    available: false,
    synced: false,
    label: "Timing check failed",
    message: error.message || "Replay timing availability check failed.",
  }));
  console.log(JSON.stringify({
    pitwallReplayTimingAvailabilityDiagnostic: {
      elapsedMs: Date.now() - startedAt,
      options: {
        meetingKey: options.meetingKey,
        sessionKey: options.sessionKey,
        sessionKind: options.sessionKind,
        raceName: options.raceName,
      },
      status: {
        ok: Boolean(status.ok),
        status: status.status || "",
        available: Boolean(status.available),
        synced: Boolean(status.synced),
        label: status.label || "",
        message: status.message || "",
        sessionKey: status.sessionKey || "",
        sessionKind: status.sessionKind || "",
      },
    },
  }, null, 2));
  app.exit(status.ok ? 0 : 2);
  return true;
}

function analyticsSessionDiagnosticSummary(sessionKind, data = {}) {
  const drivers = data.drivers || [];
  const rowsWithPosition = drivers.filter((driver) => finiteNumber(driver.position) != null).length;
  const rowsWithTime = drivers.filter((driver) => finiteNumber(driver.resultDuration) != null || finiteNumber(driver.fastestLap) != null).length;
  const rowsWithGap = drivers.filter((driver) => driver.gapToLeader !== null && driver.gapToLeader !== undefined && driver.gapToLeader !== "").length;
  const rowsWithLaps = drivers.filter((driver) => finiteNumber(driver.laps) != null && Number(driver.laps) > 0).length;
  const rowsWithLapTrace = drivers.filter((driver) => Array.isArray(driver.lapTrace) && driver.lapTrace.length > 0).length;
  const rowsWithConsistency = drivers.filter((driver) => finiteNumber(driver.consistency?.medianLap) != null).length;
  const rowsWithTyreCurve = drivers.filter((driver) => Array.isArray(driver.tyreCurve) && driver.tyreCurve.length > 0).length;
  const rich = drivers.length >= 15 && rowsWithPosition >= 15 && rowsWithTime >= 15 && rowsWithLaps >= 15;
  return {
    sessionKind,
    rich,
    source: data.source || "",
    session: data.session?.name || sessionKind,
    sessionKey: data.session?.key || "",
    cached: Boolean(data.cached),
    cacheSource: data.cacheSource || "",
    revalidating: Boolean(data.revalidating),
    cacheAgeSeconds: finiteNumber(data.cacheAgeSeconds),
    driverRows: drivers.length,
    rowsWithPosition,
    rowsWithTime,
    rowsWithGap,
    rowsWithLaps,
    rowsWithLapTrace,
    rowsWithConsistency,
    rowsWithTyreCurve,
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
  const raceName = String(process.env.PITWALL_ANALYTICS_RACE_NAME || "").trim();
  const raceStartsAt = String(process.env.PITWALL_ANALYTICS_RACE_STARTS_AT || "").trim();
  const sessionStartsAt = String(process.env.PITWALL_ANALYTICS_SESSION_STARTS_AT || "").trim();
  const sessionKinds = String(process.env.PITWALL_ANALYTICS_SESSIONS || "Practice 1,Practice 2,Practice 3,Qualifying")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  const results = [];
  for (const sessionKind of sessionKinds) {
    try {
      const data = await getAnalyticsSession({ season, meetingKey, sessionKind, raceName, raceStartsAt, sessionStartsAt });
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

function dashboardDomScript() {
  return `(() => {
    const clean = (value) => String(value || "").replace(/\\s+/g, " ").trim();
    const weatherValues = Array.from(document.querySelectorAll(".wx__v")).map((node) => clean(node.textContent));
    return {
      title: clean(document.querySelector(".hero__name")?.textContent),
      round: clean(document.querySelector(".hero__round")?.textContent),
      trackSubtitle: clean(Array.from(document.querySelectorAll(".pw-card__sub, .card__sub")).find((node) => /OpenF1/.test(node.textContent || ""))?.textContent),
      standingsRows: document.querySelectorAll(".stand__row").length,
      sessionRows: document.querySelectorAll(".sess").length,
      newsRows: document.querySelectorAll(".news__item").length,
      favoriteRows: document.querySelectorAll(".fav").length,
      weatherValues,
      loading: /loading|Waiting for session times/i.test(document.body.textContent || ""),
      body: clean(document.body.textContent),
    };
  })()`;
}

function dashboardSummary(dom = {}, elapsedMs = 0) {
  const weatherRich = (dom.weatherValues || []).filter(richCell).length;
  const rich = Boolean(
    richCell(dom.title) &&
    !/Current Formula 1 session|Formula 1$/i.test(dom.title || "") &&
    dom.standingsRows >= 5 &&
    dom.sessionRows >= 4 &&
    dom.newsRows >= 1 &&
    weatherRich >= 3 &&
    !dom.loading
  );
  return {
    rich,
    elapsedMs,
    title: dom.title || "",
    round: dom.round || "",
    trackSubtitle: dom.trackSubtitle || "",
    standingsRows: dom.standingsRows || 0,
    sessionRows: dom.sessionRows || 0,
    newsRows: dom.newsRows || 0,
    favoriteRows: dom.favoriteRows || 0,
    weatherRich,
    loading: Boolean(dom.loading),
  };
}

async function loadDashboardDom(root, serverUrl, rendererEntry, timeoutMs) {
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
    const startedAt = Date.now();
    await win.loadURL(`${serverUrl}/${rendererEntry}?screen=dashboard`);
    const deadline = Date.now() + timeoutMs;
    let dom = {};
    while (Date.now() < deadline) {
      dom = await win.webContents.executeJavaScript(dashboardDomScript(), true).catch((error) => ({ body: error?.message || String(error || "") }));
      const summary = dashboardSummary(dom, Date.now() - startedAt);
      if (summary.rich) return summary;
      await wait(250);
    }
    return dashboardSummary(dom, Date.now() - startedAt);
  } finally {
    win.destroy();
  }
}

async function runDashboardDiagnosticAndQuit() {
  if (!process.env.PITWALL_DASHBOARD_DIAG) return false;
  const root = path.resolve(app.getAppPath());
  const { server, url } = await startStaticServer(root);
  staticServer = server;
  const rendererEntry = fs.existsSync(path.join(root, "dist/pitwall/index.html"))
    ? "dist/pitwall/index.html"
    : "ui_kits/pitwall/index.html";
  const timeoutMs = Math.max(3000, Number(process.env.PITWALL_DASHBOARD_TIMEOUT_MS || 15000));
  diagnosticWindowRunActive = true;
  let summary;
  try {
    summary = await loadDashboardDom(root, url, rendererEntry, timeoutMs);
  } catch (error) {
    summary = dashboardSummary({ body: error?.message || "Dashboard diagnostic failed" }, timeoutMs);
  } finally {
    diagnosticWindowRunActive = false;
    server.close();
    staticServer = null;
  }
  console.log(JSON.stringify({ pitwallDashboardDiagnostic: summary }, null, 2));
  app.exit(summary.rich ? 0 : 2);
  return true;
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
    navigationMs: dom.navigationMs || 0,
    readyMs: dom.readyMs || 0,
    message: dom.message || "",
    sample: rows.slice(0, 5),
  };
}

async function loadWeekendRecapDom(root, serverUrl, rendererEntry, round, sessionKind, timeoutMs) {
  const params = new URLSearchParams({ screen: "weekend" });
  if (round) params.set("weekendRound", String(round));
  if (sessionKind) params.set("weekendSession", String(sessionKind));
  const startedAt = Date.now();
  let navigationMs = 0;
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
    navigationMs = Date.now() - startedAt;
    const deadline = Date.now() + timeoutMs;
    let dom = {};
    while (Date.now() < deadline) {
      dom = await win.webContents.executeJavaScript(weekendRecapDomScript(), true).catch((error) => ({ message: error?.message || String(error || "") }));
      if (weekendRecapSummary(sessionKind, dom).rich && !dom.loading) {
        return { ...dom, navigationMs, readyMs: Date.now() - startedAt };
      }
      await wait(150);
    }
    return { ...dom, navigationMs, readyMs: Date.now() - startedAt };
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
    projectedPoints: { type: "number" },
    reason: { type: "string" },
  },
  required: ["code", "label", "confidence", "probability", "projectedPoints", "reason"],
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
    leaderboard: { type: "array", items: AI_PREDICTION_CANDIDATE_SCHEMA },
    watchlist: { type: "array", items: AI_PREDICTION_WATCH_SCHEMA },
    caveat: { type: "string" },
  },
  required: ["available", "title", "summary", "winner", "podium", "leaderboard", "watchlist", "caveat"],
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
        stintMode: { type: "string", enum: ["actual", "projected", "none"] },
        title: { type: "string" },
        subtitle: { type: "string" },
        rows: { type: "array", items: AI_VISUALIZATION_ROW_SCHEMA },
        notes: { type: "array", items: { type: "string" } },
      },
      required: ["kind", "stintMode", "title", "subtitle", "rows", "notes"],
    },
    predictions: AI_PREDICTIONS_SCHEMA,
  },
  required: ["summary", "alerts", "visualization", "predictions"],
};

const AI_SYSTEM_PROMPT = [
  "You are Apexline's F1 race strategist.",
  "Use only the provided JSON snapshot.",
  "The app computes exact gaps, standings, weather, tyre stints, pit counts, lap samples, and battle candidates before calling you.",
  "Explain strategy, risks, and what to watch in concise race-engineer language.",
  "Return valid JSON matching the schema: summary, alerts, visualization, and predictions.",
  "Set visualization.kind to tyre_strategy for tyre, stint, compound, pit-window, or race-plan questions.",
  "Set visualization.kind to comparison, timeline, or battle only when that helps the user understand the answer.",
  "Set visualization.stintMode='none' for comparison, timeline, battle, and any non-stint visual.",
  "Set visualization.kind to none with visualization.stintMode='none' and empty title, subtitle, rows, and notes when prose is clearer.",
  "When actual stint data is available, set visualization.stintMode='actual' and use only supplied tyre compounds, stint laps, and pit counts.",
  "When actual stint data is unavailable but the user asks for race-plan strategy, you may create projected tyre_strategy stints from supplied schedule, race distance, weather, weekendSessionSummaries, performanceContext, and news; set visualization.stintMode='projected', label title/subtitle/notes as projected, and do not present projected stints as actual telemetry.",
  "If the snapshot lacks enough evidence even for a projection, explain what is missing instead of filling gaps.",
  "Always include predictions. Set predictions.available=true only for daily Current weekend, Next weekend, Drivers championship, or Constructors championship projection pages, otherwise set it false with empty winner, podium, leaderboard, and watchlist arrays.",
  "When predictions are available, label them as projections, use confidence and probability values from 0 to 1, and ground every winner, podium, leaderboard, and watchlist reason in the snapshot.",
].join(" ");

const AI_INSIGHT_RESPONSE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    title: { type: "string" },
    body: { type: "string" },
    kind: { type: "string", enum: ["battle", "strategy", "track"] },
    confidence: { type: "number" },
  },
  required: ["title", "body", "kind", "confidence"],
};

const AI_INSIGHT_SYSTEM_PROMPT = [
  "You are Apexline's F1 race strategist generating one short insight card for the Live Racing screen.",
  "Use only the provided JSON snapshot.",
  "Compare snapshot.current with snapshot.priorSnapshots to surface a trend a viewer would miss in a single timing frame: closing or opening gaps, tyre offset, pit-window timing, track-status implications, or race control developments.",
  "Do not repeat the running order, generic hype, obvious facts, or anything already covered by snapshot.recentInsights.",
  "In replay mode, replay.elapsedSeconds is the hard knowledge boundary; never use later knowledge.",
  "Return valid JSON matching the schema: title (at most nine words), body (one or two sentences), kind (battle, strategy, or track), and confidence from 0 to 1.",
].join(" ");

const AI_INSIGHT_TASK = "live_racing_insight";

function aiTaskConfig(options = {}) {
  if (options.task === AI_INSIGHT_TASK) {
    return { systemPrompt: AI_INSIGHT_SYSTEM_PROMPT, schemaName: "pitwall_insight_response", schema: AI_INSIGHT_RESPONSE_SCHEMA };
  }
  return { systemPrompt: AI_SYSTEM_PROMPT, schemaName: "pitwall_ai_response", schema: AI_RESPONSE_SCHEMA };
}

function aiPayload(options = {}) {
  const payload = {
    prompt: String(options.prompt || "Summarize the live F1 snapshot."),
    snapshot: options.snapshot || {},
    generatedAt: new Date().toISOString(),
  };
  if (options.task === AI_INSIGHT_TASK) return payload;
  return {
    ...payload,
    visualizationGuide: "Return visualization.kind='none' for text-only answers. Use 'tyre_strategy' with one row per relevant driver when tyre, stint, pit, compound, or race-plan data is best shown visually.",
    predictionGuide: "Return predictions.available=true only for daily Current weekend, Next weekend, Drivers championship, or Constructors championship projection pages. For Next weekend, include predictions.leaderboard as the full predicted Grand Prix race finishing order, not FP1, qualifying, sprint, or any other next scheduled session order. Otherwise use available=false with empty winner, podium, leaderboard, and watchlist arrays.",
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

function normalizeAiResult(provider, text, raw, task) {
  const parsed = tryParseAiJson(text);
  if (task === AI_INSIGHT_TASK) {
    const body = String(parsed?.body || "").trim();
    const alert = body ? {
      kind: parsed.kind || "track",
      title: String(parsed.title || "").trim(),
      body,
      confidence: typeof parsed.confidence === "number" ? parsed.confidence : null,
    } : null;
    return {
      provider,
      summary: alert ? alert.body : String(text || "The provider returned an empty response."),
      alerts: alert ? [alert] : [],
      visualization: null,
      predictions: emptyDailyPredictions(),
      raw,
    };
  }
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
  const task = aiTaskConfig(options);
  const body = {
    model,
    input: [
      { role: "system", content: [{ type: "input_text", text: task.systemPrompt }] },
      { role: "user", content: [{ type: "input_text", text: JSON.stringify(aiPayload(options)) }] },
    ],
    text: {
      format: {
        type: "json_schema",
        name: task.schemaName,
        strict: true,
        schema: task.schema,
      },
    },
    max_output_tokens: 900,
  };
  if (/^gpt-6-/.test(model)) {
    body.reasoning = { effort: "low" };
    delete body.max_output_tokens;
  }
  return body;
}

function codexResponsesBody(model, options = {}) {
  const task = aiTaskConfig(options);
  return {
    model,
    instructions: task.systemPrompt,
    input: [
      { role: "user", content: [{ type: "input_text", text: JSON.stringify(aiPayload(options)) }] },
    ],
    text: {
      format: {
        type: "json_schema",
        name: task.schemaName,
        strict: true,
        schema: task.schema,
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
  }, AI_PROVIDER_TIMEOUT_MS);
  return parseCodexResponsesStream(text);
}

async function askCodex(options = {}) {
  const tokens = await getActiveOAuthSession("codex");
  if (!tokens) throw new Error("Connect ChatGPT (Codex) in Settings first.");
  const model = knownModel(options.model, await visibleAiModels("codex"), DEFAULT_CODEX_MODEL);
  const headers = {
    Authorization: `Bearer ${tokens.accessToken}`,
    originator: "codex_cli_rs",
    "OpenAI-Beta": "responses=v1",
    "x-responsesapi-include-timing-metrics": "true",
  };
  if (tokens.accountId) headers["chatgpt-account-id"] = tokens.accountId;
  const raw = await requestCodexResponsesStream(CODEX_BACKEND_RESPONSES_URL, codexResponsesBody(model, options), headers);
  return normalizeAiResult("codex", openAiText(raw), raw, options.task);
}

async function askGrok(options = {}) {
  const tokens = await getActiveOAuthSession("grok");
  if (!tokens) throw new Error("Connect Grok in Settings first.");
  const model = knownModel(options.model, await visibleAiModels("grok"), DEFAULT_GROK_MODEL);
  const body = {
    model,
    messages: [
      { role: "system", content: aiTaskConfig(options).systemPrompt },
      { role: "user", content: JSON.stringify(aiPayload(options)) },
    ],
    temperature: 0.4,
    max_tokens: 1200,
  };
  if (model === "grok-4.7" || model === "grok-4.6") body.reasoning = { effort: "high" };
  const raw = await requestJsonPost(GROK_CHAT_COMPLETIONS_URL, body, { Authorization: `Bearer ${tokens.accessToken}` }, AI_PROVIDER_TIMEOUT_MS);
  return normalizeAiResult("grok", grokText(raw), raw, options.task);
}

async function getPreferredAiSelection() {
  const preferredModel = await getPreferredAiModel();
  if (!preferredModel || preferredModel === "local") return null;
  const [provider, ...modelParts] = preferredModel.split(":");
  const model = modelParts.join(":");
  return provider && model ? { provider, model } : null;
}

async function askConfiguredAi(options = {}) {
  const preferred = String(options.provider || "").toLowerCase();
  if (preferred === "codex") return askCodex(options);
  if (preferred === "grok") return askGrok(options);
  const selection = await getPreferredAiSelection();
  if (selection?.provider === "codex" && await getActiveOAuthSession("codex")) return askCodex({ ...options, model: selection.model });
  if (selection?.provider === "grok" && await getActiveOAuthSession("grok")) return askGrok({ ...options, model: selection.model });
  if (await getActiveOAuthSession("grok")) return askGrok(options);
  if (await getActiveOAuthSession("codex")) return askCodex(options);
  throw new Error("Connect ChatGPT or Grok in Settings first.");
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

async function requestOpenF1Analytics(endpoint, params = {}, options = {}) {
  try {
    return await requestOpenF1Json(openF1AnalyticsUrl(endpoint, params), { timeout: 12000, priority: options.priority });
  } catch (error) {
    throw openF1AnalyticsError(error);
  }
}

async function requestOpenF1AnalyticsWithRetry(endpoint, params = {}, options = {}) {
  let lastError = null;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await requestOpenF1Analytics(endpoint, params, options);
    } catch (error) {
      lastError = error;
      const rateLimited = error?.rateLimited || /HTTP 429\b|rate limit/i.test(error?.message || "");
      if (!rateLimited || attempt === 2) throw error;
      await wait(OPENF1_ANALYTICS_RETRY_MS * (attempt + 1));
    }
  }
  throw lastError || new Error("OpenF1 request failed");
}

async function requestOpenF1AnalyticsBatch(requests = {}, options = {}) {
  const optionalEndpoints = options.optionalEndpoints || new Set();
  const entries = await Promise.all(Object.entries(requests).map(async ([key, [endpoint, params]]) => {
    try {
      const rows = await requestOpenF1AnalyticsWithRetry(endpoint, params, { priority: options.priority });
      return { key, rows: Array.isArray(rows) ? rows : [] };
    } catch (error) {
      return { key, error };
    }
  }));
  const raw = {};
  const errors = [];
  for (const entry of entries) {
    raw[entry.key] = entry.error ? [] : entry.rows;
    if (entry.error && !optionalEndpoints.has(entry.key)) errors.push(entry.error?.message || "OpenF1 request failed");
  }
  return { raw, errors };
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

function f1TimingAnalyticsDriverRows(timingRows, fallbackDrivers) {
  const fallbackByCode = new Map((fallbackDrivers || []).map((driver) => [String(driver.code || "").toUpperCase(), driver]));
  return (timingRows || []).map((row) => {
    const code = String(row.code || "").toUpperCase();
    const fallback = fallbackByCode.get(code) || {};
    const fastestLap = finiteNumber(row.bestLapDuration) ?? finiteNumber(row.lastLapDuration);
    const resultDuration = finiteNumber(row.lastLapDuration) ?? fastestLap;
    const sessionProgress = finiteNumber(row.sessionLap) ?? finiteNumber(row.laps);
    const lapTraceLap = sessionProgress ?? (resultDuration != null || fastestLap != null ? 1 : null);
    const tyreAge = finiteNumber(row.age);
    return {
      code,
      number: finiteNumber(row.number) ?? fallback.num,
      name: fallback.name || code,
      team: fallback.team || "",
      teamAbbr: fallback.abbr || teamAbbr(fallback.team || ""),
      color: fallback.color || "var(--accent)",
      image: fallback.image || "",
      position: finiteNumber(row.pos),
      resultDuration,
      gapToLeader: row.gap === "LEADER" ? 0 : row.gap || "",
      laps: sessionProgress,
      fastestLap,
      avgLap: resultDuration,
      sectors: row.sectorTimes || {},
      consistency: { medianLap: fastestLap },
      racecraft: { startPosition: null, endPosition: finiteNumber(row.pos), positionDelta: null, overtakes: 0, pitStops: row.pits || 0 },
      stints: row.comp ? [{ compound: row.comp, lapStart: null, lapEnd: null, laps: sessionProgress, tyreAgeAtStart: null }] : [],
      tyreCurve: lapTraceLap != null && resultDuration != null ? [{ lap: lapTraceLap, tyreAge, duration: resultDuration }] : [],
      lapTrace: resultDuration != null ? [{ lap: lapTraceLap || 1, duration: resultDuration, s1: null, s2: null, s3: null, pitOut: false }] : [],
      telemetry: row.telemetry || {},
    };
  }).filter((row) => row.code);
}

function f1TimingAnalyticsElapsedSeconds(sessionData) {
  const archiveStartUtcMs = f1TimingArchiveStartUtcMs(sessionData);
  const timingSeconds = (sessionData?.timingEntries || [])
    .map((entry) => finiteNumber(entry?.seconds))
    .filter((seconds) => seconds != null && seconds >= 0 && seconds <= Number.MAX_SAFE_INTEGER);
  const statusEvents = [];
  for (const entry of sessionData?.sessionStatusEntries || []) {
    const series = entry?.data?.StatusSeries;
    const values = Array.isArray(series)
      ? series
      : series && typeof series === "object"
        ? Object.values(series)
        : [entry?.data];
    for (const item of values) {
      const status = String(item?.SessionStatus || item?.Status || item?.Started || "").trim();
      const utcMs = Date.parse(item?.Utc || item?.Timestamp || item?.Date || "");
      const seconds = Number.isFinite(utcMs) && Number.isFinite(archiveStartUtcMs)
        ? finiteNumber(f1TimingArchiveSecondsForUtc(sessionData, utcMs))
        : finiteNumber(entry?.seconds);
      if (!status || seconds == null || seconds < 0 || seconds > Number.MAX_SAFE_INTEGER) continue;
      statusEvents.push({ status, seconds });
    }
  }
  statusEvents.sort((a, b) => a.seconds - b.seconds);
  const finalStatus = statusEvents.at(-1);
  const statusEndSeconds = /^(?:Finished|Finalised|Ended|Ends|Complete|Completed|Aborted)$/i.test(finalStatus?.status || "")
    ? finalStatus.seconds
    : null;
  const endUtcMs = Date.parse(sessionData?.selectedSession?.date_end || "");
  const scheduledEndSeconds = Number.isFinite(endUtcMs) && Number.isFinite(archiveStartUtcMs)
    ? finiteNumber(f1TimingArchiveSecondsForUtc(sessionData, endUtcMs))
    : null;
  const terminalSeconds = statusEndSeconds != null
    ? statusEndSeconds
    : scheduledEndSeconds != null && scheduledEndSeconds >= 0 && scheduledEndSeconds <= Number.MAX_SAFE_INTEGER
      ? scheduledEndSeconds
      : null;
  if (terminalSeconds != null) {
    const terminalTimingSeconds = timingSeconds.filter((seconds) => seconds <= terminalSeconds);
    return terminalTimingSeconds.length ? Math.max(...terminalTimingSeconds) : terminalSeconds;
  }
  return timingSeconds.length ? Math.max(...timingSeconds) : 5200;
}

async function buildF1TimingAnalyticsSessionData(sessionInfo, options = {}) {
  const meetingKey = finiteNumber(sessionInfo?.meeting_key) || finiteNumber(options.meetingKey);
  if (!meetingKey) throw new Error("Formula 1 timing fallback needs an OpenF1 meeting key.");
  const sessionKind = options.sessionKind || sessionInfo?.session_name || "Race";
  const sessionData = await getReplayF1TimingSessionData(meetingKey, sessionKind, options);
  const parsed = parseF1TimingArchiveRows(sessionData, f1TimingAnalyticsElapsedSeconds(sessionData), { timingAnchor: "program" });
  const fallback = readFallbackPitWallData();
  const drivers = f1TimingAnalyticsDriverRows(parsed.timing, fallback.drivers);
  return {
    source: "Formula 1 livetiming",
    fetchedAt: new Date().toISOString(),
    errors: [],
    session: {
      key: finiteNumber(sessionData.selectedSession?.session_key) || finiteNumber(sessionInfo?.session_key),
      meetingKey,
      name: sessionData.selectedSession?.session_name || sessionInfo?.session_name || sessionKind,
      type: sessionData.selectedSession?.session_type || sessionInfo?.session_type || "",
      dateStart: sessionData.selectedSession?.date_start || sessionInfo?.date_start || "",
      dateEnd: sessionData.selectedSession?.date_end || sessionInfo?.date_end || "",
      circuit: sessionData.meeting?.circuit_short_name || sessionInfo?.circuit_short_name || "",
      location: [sessionData.meeting?.location, sessionData.meeting?.country_name].filter(Boolean).join(", ") || [sessionInfo?.location, sessionInfo?.country_name].filter(Boolean).join(", "),
      year: sessionData.selectedSession?.year || sessionInfo?.year || options.season || "",
    },
    weather: parsed.weather || {},
    drivers,
    counts: {
      drivers: drivers.length,
      laps: drivers.filter((driver) => finiteNumber(driver.fastestLap) != null || finiteNumber(driver.resultDuration) != null).length,
      overtakes: 0,
      pit: drivers.filter((driver) => driver.racecraft?.pitStops).length,
      position: drivers.filter((driver) => finiteNumber(driver.position) != null).length,
      sessionResult: 0,
      stints: drivers.filter((driver) => driver.stints?.length).length,
      weather: parsed.weather && Object.keys(parsed.weather).length ? 1 : 0,
      f1TimingEntries: parsed.diagnostics?.timingEntries || 0,
    },
  };
}

function median(values) {
  const clean = values.map(finiteNumber).filter((value) => value != null).sort((a, b) => a - b);
  if (!clean.length) return null;
  const middle = Math.floor(clean.length / 2);
  return clean.length % 2 ? clean[middle] : (clean[middle - 1] + clean[middle]) / 2;
}

function lapSpread(values) {
  const clean = values.map(finiteNumber).filter((value) => value != null);
  if (clean.length < 2) return null;
  return Math.max(...clean) - Math.min(...clean);
}

function cleanLapTrace(laps) {
  return (laps || [])
    .map((row) => ({
      lap: finiteNumber(row.lap_number),
      duration: finiteNumber(row.lap_duration),
      s1: finiteNumber(row.duration_sector_1),
      s2: finiteNumber(row.duration_sector_2),
      s3: finiteNumber(row.duration_sector_3),
      pitOut: Boolean(row.is_pit_out_lap),
    }))
    .filter((row) => row.lap != null && row.duration != null && row.duration > 0 && !row.pitOut)
    .sort((a, b) => a.lap - b.lap);
}

function tyreAgeForLap(stints, lapNumber) {
  const lap = finiteNumber(lapNumber);
  if (lap == null) return null;
  const stint = (stints || []).find((item) => {
    const start = finiteNumber(item.lapStart);
    const end = finiteNumber(item.lapEnd);
    return start != null && lap >= start && (end == null || lap <= end);
  });
  if (!stint) return lap;
  const start = finiteNumber(stint.lapStart) || lap;
  const ageAtStart = finiteNumber(stint.tyreAgeAtStart) || 0;
  return ageAtStart + Math.max(0, lap - start);
}

function tyreAgeCurve(lapTrace, stints) {
  return (lapTrace || []).map((lap) => ({
    lap: lap.lap,
    tyreAge: tyreAgeForLap(stints, lap.lap),
    duration: lap.duration,
  })).filter((row) => row.tyreAge != null && row.duration != null);
}

function racecraftForDriver(number, result, positions, overtakes, pitStops) {
  const driverPositions = (positions || [])
    .filter((row) => Number(row.driver_number) === number && finiteNumber(row.position) != null)
    .sort((a, b) => {
      const left = Date.parse(a.date || "");
      const right = Date.parse(b.date || "");
      if (Number.isFinite(left) && Number.isFinite(right) && left !== right) return left - right;
      return 0;
    });
  const startPosition = finiteNumber(driverPositions[0]?.position);
  const endPosition = finiteNumber(result.position) ?? finiteNumber(driverPositions.at(-1)?.position);
  return {
    startPosition,
    endPosition,
    positionDelta: startPosition != null && endPosition != null ? startPosition - endPosition : null,
    overtakes: overtakes || 0,
    pitStops,
  };
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
    const lapTrace = cleanLapTrace(laps);
    const lapDurations = lapTrace.map((row) => row.duration);
    const overtakes = overtakesByNumber.get(number) || 0;
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
      lapTrace,
      consistency: {
        medianLap: median(lapDurations),
        bestFiveAvg: average(paceLaps.map((row) => finiteNumber(row.lap_duration))),
        spread: lapSpread(lapDurations),
        cleanLapCount: lapTrace.length,
      },
      tyreCurve: tyreAgeCurve(lapTrace, stints),
      racecraft: racecraftForDriver(number, result, raw.position || [], overtakes, pitStops.length),
      stints,
      pitStops: pitStops.length,
      pitLoss: average(pitStops.map((row) => finiteNumber(row.lane_duration) ?? finiteNumber(row.pit_duration))),
      overtakes,
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
  return Boolean(entry?.data && Number.isFinite(createdAt) && (analyticsSessionIsImmutable(entry.data) || Date.now() - createdAt < ANALYTICS_DISK_CACHE_MS));
}

function analyticsSessionIsImmutable(data = {}) {
  return /formula 1/i.test(String(data?.source || ""));
}

function analyticsSessionHasPublishedRows(data = {}) {
  if (analyticsSessionIsImmutable(data)) return false;
  const counts = data?.counts || {};
  return ["laps", "position", "sessionResult", "stints"].some((key) => finiteNumber(counts[key]) > 0);
}

function analyticsLeaderboardRequiresOfficialResult(sessionInfo = {}, options = {}) {
  const label = cleanSessionName([
    options.sessionKind,
    options.sessionName,
    sessionInfo.session_name,
    sessionInfo.session_type,
  ].filter(Boolean).join(" "));
  if (!label || /practice/.test(label)) return false;
  return /\brace\b|\bsprint\b|qualifying|shootout/.test(label);
}

function analyticsSessionSatisfiesLeaderboardRequest(data = {}, sessionInfo = {}, options = {}) {
  if (analyticsSessionIsImmutable(data)) return Array.isArray(data?.drivers) && data.drivers.length > 0;
  if (!analyticsSessionHasPublishedRows(data)) return false;
  if (!analyticsLeaderboardRequiresOfficialResult(sessionInfo, options)) return true;
  return finiteNumber(data?.counts?.sessionResult) > 0;
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

function shouldRevalidateAnalyticsCache(createdAt, data) {
  if (analyticsSessionIsImmutable(data)) return false;
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
  let meetingKey = finiteNumber(options.meetingKey);
  if (!meetingKey && finiteNumber(options.round)) {
    const season = String(options.season || new Date().getFullYear()).replace(/[^0-9]/g, "") || String(new Date().getFullYear());
    const round = finiteNumber(options.round);
    const meetings = await requestOpenF1Json(openF1ApiUrl("meetings", { year: season }), { priority: options.priority });
    const grandPrixMeetings = (meetings || [])
      .filter((meeting) => /grand prix/i.test(String(meeting?.meeting_name || "")))
      .filter((meeting) => season !== "2026" || !isCancelledF12026RaceName(meeting?.meeting_name || meeting?.official_name || ""))
      .sort((a, b) => Date.parse(a.date_start || "") - Date.parse(b.date_start || ""));
    meetingKey = finiteNumber(grandPrixMeetings[round - 1]?.meeting_key);
  }
  if (!meetingKey) throw new Error("Select a race weekend with OpenF1 meeting data.");
  const sessions = await requestOpenF1Analytics("sessions", { meeting_key: meetingKey }, { priority: options.priority });
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
  const optionalEndpoints = new Set(["overtakes", "position"]);
  const requests = {
    drivers: ["drivers", { session_key: sessionKey }],
    laps: ["laps", { session_key: sessionKey }],
    overtakes: ["overtakes", { session_key: sessionKey }],
    pit: ["pit", { session_key: sessionKey }],
    position: ["position", { session_key: sessionKey }],
    sessionResult: ["sessionResult", { session_key: sessionKey }],
    stints: ["stints", { session_key: sessionKey }],
    weather: ["weather", { session_key: sessionKey }],
  };
  const raw = {};
  const batch = await requestOpenF1AnalyticsBatch(requests, {
    optionalEndpoints,
    priority: options.priority,
  });
  Object.assign(raw, batch.raw);
  const errors = batch.errors;
  const hasPublishedRows = ["laps", "position", "sessionResult", "stints"].some((key) => raw[key]?.length);
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
  if (!hasPublishedRows) {
    try {
      return await buildF1TimingAnalyticsSessionData(sessionInfo, options);
    } catch (error) {
      data.errors.push(`Formula 1 timing fallback unavailable: ${error?.message || "unknown error"}`);
    }
  }
  return data;
}

async function buildAnalyticsSessionLeaderboardData(sessionInfo, options = {}) {
  const sessionKey = finiteNumber(sessionInfo?.session_key);
  if (!sessionKey) throw new Error("OpenF1 did not return a session key for this selection.");
  const raw = { sessionResult: [], laps: [], stints: [], weather: [] };
  const errors = [];
  const requiresOfficialResult = analyticsLeaderboardRequiresOfficialResult(sessionInfo, options);
  let triedTimingFallback = false;
  try {
    const rows = await requestOpenF1AnalyticsWithRetry("sessionResult", { session_key: sessionKey }, { priority: options.priority });
    raw.sessionResult = Array.isArray(rows) ? rows : [];
  } catch (error) {
    errors.push(error?.message || "OpenF1 request failed");
  }
  if (!raw.sessionResult?.length && requiresOfficialResult) {
    triedTimingFallback = true;
    try {
      return await buildF1TimingAnalyticsSessionData(sessionInfo, options);
    } catch (error) {
      errors.push(`Formula 1 timing fallback unavailable: ${error?.message || "unknown error"}`);
    }
  }
  if (!raw.sessionResult?.length && !requiresOfficialResult) {
    const requests = {
      laps: ["laps", { session_key: sessionKey }],
      stints: ["stints", { session_key: sessionKey }],
    };
    const batch = await requestOpenF1AnalyticsBatch(requests, {
      optionalEndpoints: new Set(["stints"]),
      priority: options.priority,
    });
    Object.assign(raw, batch.raw);
    errors.push(...batch.errors);
  }
  const hasPublishedRows = ["laps", "sessionResult", "stints"].some((key) => raw[key]?.length);
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
  if (!hasPublishedRows && !triedTimingFallback) {
    try {
      return await buildF1TimingAnalyticsSessionData(sessionInfo, options);
    } catch (error) {
      data.errors.push(`Formula 1 timing fallback unavailable: ${error?.message || "unknown error"}`);
    }
  }
  return data;
}

function refreshAnalyticsSessionCache({ cacheKey, aliasKey, options = {}, sessionInfo = null, cachedData = null } = {}) {
  const refreshKeys = [cacheKey, aliasKey].filter(Boolean).map(String);
  if (!refreshKeys.length || refreshKeys.some((key) => analyticsRefreshInFlight.has(key))) return;
  for (const key of refreshKeys) analyticsRefreshInFlight.set(key, true);
  Promise.resolve().then(async () => {
    const backgroundOptions = { ...options, priority: "background" };
    const resolvedSession = sessionInfo || await resolveAnalyticsSession(backgroundOptions);
    const resolvedSessionKey = finiteNumber(resolvedSession?.session_key);
    if (!resolvedSessionKey) return;
    const resolvedCacheKey = String(resolvedSessionKey);
    const data = await buildAnalyticsSessionData(resolvedSession, backgroundOptions);
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
  const leaderboardScope = options.scope === "leaderboard";
  const aliasKey = analyticsAliasKey(options);
  const cachedDataUsable = (data, sessionInfo = {}) => leaderboardScope
    ? analyticsSessionSatisfiesLeaderboardRequest(data, sessionInfo, options)
    : analyticsSessionHasPublishedRows(data);
  const aliasDiskEntry = analyticsSessionDiskEntry([aliasKey], { withMeta: true });
  if (aliasDiskEntry?.data && cachedDataUsable(aliasDiskEntry.data)) {
    const shouldRefresh = shouldRevalidateAnalyticsCache(aliasDiskEntry.createdAt, aliasDiskEntry.data);
    if (shouldRefresh) refreshAnalyticsSessionCache({ aliasKey, options, cachedData: aliasDiskEntry.data });
    return cachedAnalyticsSessionData(aliasDiskEntry.data, "disk", aliasDiskEntry.createdAt, shouldRefresh);
  }
  const staleAliasEntry = analyticsSessionDiskEntry([aliasKey], { allowStale: true, withMeta: true });
  if (staleAliasEntry?.data && cachedDataUsable(staleAliasEntry.data)) {
    const shouldRefresh = shouldRevalidateAnalyticsCache(staleAliasEntry.createdAt, staleAliasEntry.data);
    if (shouldRefresh) refreshAnalyticsSessionCache({ aliasKey, options, cachedData: staleAliasEntry.data });
    return cachedAnalyticsSessionData(staleAliasEntry.data, "disk", staleAliasEntry.createdAt, shouldRefresh);
  }
  let sessionInfo = null;
  try {
    sessionInfo = await resolveAnalyticsSession(options);
  } catch (error) {
    const diskData = analyticsSessionDiskEntry([aliasKey]);
    if (diskData && cachedDataUsable(diskData) && /rate limit|HTTP 429/i.test(error?.message || "")) return diskData;
    throw error;
  }
  const sessionKey = finiteNumber(sessionInfo?.session_key);
  if (!sessionKey) throw new Error("OpenF1 did not return a session key for this selection.");
  const cacheKey = String(sessionKey);
  if (leaderboardScope) {
    const scopedCacheKey = `leaderboard:${cacheKey}`;
    const scopedCached = analyticsSessionCache.get(scopedCacheKey);
    if (scopedCached && Date.now() - scopedCached.createdAt < ANALYTICS_CACHE_MS && cachedDataUsable(scopedCached.data, sessionInfo)) {
      return cachedAnalyticsSessionData(scopedCached.data, "memory", new Date(scopedCached.createdAt).toISOString());
    }
    const data = await buildAnalyticsSessionLeaderboardData(sessionInfo, options);
    if (cachedDataUsable(data, sessionInfo)) {
      analyticsSessionCache.set(scopedCacheKey, { createdAt: Date.now(), data });
      trimAnalyticsSessionMemoryCache();
    }
    return data;
  }
  const cached = analyticsSessionCache.get(cacheKey);
  if (cached && analyticsSessionHasPublishedRows(cached.data)) {
    const shouldRefresh = shouldRevalidateAnalyticsCache(cached.createdAt, cached.data);
    if (shouldRefresh) refreshAnalyticsSessionCache({ cacheKey, aliasKey, options, sessionInfo, cachedData: cached.data });
    return cachedAnalyticsSessionData(cached.data, "memory", new Date(cached.createdAt).toISOString(), shouldRefresh);
  }
  const diskEntry = analyticsSessionDiskEntry([cacheKey, aliasKey], { withMeta: true });
  if (diskEntry?.data && analyticsSessionHasPublishedRows(diskEntry.data)) {
    const shouldRefresh = shouldRevalidateAnalyticsCache(diskEntry.createdAt, diskEntry.data);
    analyticsSessionCache.set(cacheKey, { createdAt: Date.parse(diskEntry.createdAt || "") || Date.now(), data: diskEntry.data });
    trimAnalyticsSessionMemoryCache();
    if (shouldRefresh) refreshAnalyticsSessionCache({ cacheKey, aliasKey, options, sessionInfo, cachedData: diskEntry.data });
    return cachedAnalyticsSessionData(diskEntry.data, "disk", diskEntry.createdAt, shouldRefresh);
  }
  const staleDiskEntry = analyticsSessionDiskEntry([cacheKey, aliasKey], { allowStale: true, withMeta: true });
  const staleDiskData = analyticsSessionDiskEntry([cacheKey, aliasKey], { allowStale: true });
  if ((staleDiskEntry?.data && analyticsSessionHasPublishedRows(staleDiskEntry.data)) || (staleDiskData && analyticsSessionHasPublishedRows(staleDiskData))) {
    const data = staleDiskEntry?.data || staleDiskData;
    analyticsSessionCache.set(cacheKey, { createdAt: Date.now(), data });
    trimAnalyticsSessionMemoryCache();
    const shouldRefresh = shouldRevalidateAnalyticsCache(staleDiskEntry?.createdAt, data);
    if (shouldRefresh) refreshAnalyticsSessionCache({ cacheKey, aliasKey, options, sessionInfo, cachedData: data });
    return cachedAnalyticsSessionData(data, "disk", staleDiskEntry?.createdAt, shouldRefresh);
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
  const title = String(options.title || "Apexline reminder");
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

function cancelReminder(id) {
  const key = String(id || "");
  const timer = key ? reminderTimers.get(key) : null;
  if (!timer) return { cancelled: false, id: key };
  clearTimeout(timer);
  reminderTimers.delete(key);
  return { cancelled: true, id: key };
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
ipcMain.handle("pitwall:data:snapshot", (_event, options = {}) => getPitWallSnapshot(options));
ipcMain.handle("pitwall:data:liveTiming", (_event, options = {}) => getLiveTimingSnapshot(options));
ipcMain.handle("pitwall:data:liveTimingResync", () => resyncF1LiveTiming());
ipcMain.handle("pitwall:data:replayTiming", (_event, options = {}) => getReplayTimingSnapshot(options));
ipcMain.handle("pitwall:data:replayTimingAvailability", (_event, options = {}) => getReplayTimingAvailability(options));
ipcMain.handle("pitwall:data:trackMapReplayTiming", (_event, options = {}) => getTrackMapReplayTimingSnapshot(options));
ipcMain.handle("pitwall:ai:authStatus", () => getAiAuthStatus());
ipcMain.handle("pitwall:ai:authStart", (_event, provider) => startAiOAuth(provider));
ipcMain.handle("pitwall:ai:authSubmitCode", (_event, provider, code) => submitAiOAuthCode(provider, code));
ipcMain.handle("pitwall:ai:authDisconnect", (_event, provider) => disconnectAiOAuth(provider));
ipcMain.handle("pitwall:ai:ask", (_event, options = {}) => askConfiguredAi(options));
ipcMain.handle("pitwall:analytics:library", (_event, options = {}) => getF1TvLibrary(options));
ipcMain.handle("pitwall:analytics:session", (_event, options = {}) => getAnalyticsSession(options));
ipcMain.handle("pitwall:history:query", (_event, options = {}) => queryHistory(options));
ipcMain.handle("pitwall:notify:schedule", (_event, options = {}) => scheduleReminder(options));
ipcMain.handle("pitwall:notify:cancel", (_event, id) => cancelReminder(id));
ipcMain.handle("pitwall:window:state", (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  return { isFullScreen: Boolean(win?.isFullScreen()) };
});

function installApplicationMenu() {
  if (process.platform !== "darwin") return;
  const menu = Menu.buildFromTemplate([
    {
      label: app.name,
      submenu: [
        { role: "about" },
        { type: "separator" },
        { role: "services" },
        { type: "separator" },
        { role: "hide" },
        { role: "hideOthers" },
        { role: "unhide" },
        { type: "separator" },
        { role: "quit" },
      ],
    },
    {
      label: "File",
      submenu: [{ role: "close" }],
    },
    {
      label: "Edit",
      submenu: [
        { role: "undo" },
        { role: "redo" },
        { type: "separator" },
        { role: "cut" },
        { role: "copy" },
        { role: "paste" },
        { role: "pasteAndMatchStyle" },
        { role: "delete" },
        { role: "selectAll" },
      ],
    },
    {
      label: "View",
      submenu: [
        { role: "reload" },
        { role: "forceReload" },
        { role: "toggleDevTools" },
        { type: "separator" },
        { role: "resetZoom" },
        { role: "zoomIn" },
        { role: "zoomOut" },
        { type: "separator" },
        { role: "togglefullscreen" },
      ],
    },
    {
      label: "Window",
      submenu: [
        { role: "minimize" },
        { role: "zoom" },
        { type: "separator" },
        { role: "front" },
      ],
    },
    {
      role: "help",
      submenu: [
        {
          label: "Apexline Website",
          click: () => shell.openExternal("https://apexline.io"),
        },
      ],
    },
  ]);
  Menu.setApplicationMenu(menu);
}

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
    title: "Apexline",
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

  function sendWindowState() {
    if (!win.isDestroyed()) {
      win.webContents.send("pitwall:window:state", { isFullScreen: win.isFullScreen() });
    }
  }
  win.on("enter-full-screen", sendWindowState);
  win.on("leave-full-screen", sendWindowState);
  win.webContents.on("did-finish-load", sendWindowState);

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
  if (await runLiveTimingDiagnosticAndQuit()) return null;
  if (await runF1TvProbeDiagnosticAndQuit()) return null;
  if (await runF1TvLibraryDiagnosticAndQuit()) return null;
  if (await runReplayTimingAvailabilityDiagnosticAndQuit()) return null;
  if (await runAnalyticsSessionDiagnosticAndQuit()) return null;
  if (await runDashboardDiagnosticAndQuit()) return null;
  if (await runWeekendRecapDiagnosticAndQuit()) return null;
  if (await runF1TvDiagnosticAndQuit()) return null;
  installApplicationMenu();
  void getOpenF1AccessToken()
    .catch(() => "")
    .then(() => startLiveDataRefresh({ startup: true }))
    .catch((error) => {
      writePitWallDebugLog("live-data.startup-warmup-failed", { message: error?.message || "Startup live data warmup failed" });
    });
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
