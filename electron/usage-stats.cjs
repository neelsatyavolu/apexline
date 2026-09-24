// Anonymous daily usage heartbeat for analytics.n3el.dev.
// Sends a random install ID, app version, OS version, arch and channel at most
// once per UTC day. Nothing is sent when the user turns it off in Settings.
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const HEARTBEAT_URL = "https://analytics.n3el.dev/v1/heartbeat";
const PRODUCT_ID = "apexline";
const STATE_FILE = "apexline-usage-stats.json";
const CHECK_INTERVAL_MS = 60 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 10000;
const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function utcDay(date) {
  return date.toISOString().slice(0, 10);
}

function normalizeArch(arch) {
  return arch === "x64" ? "x86_64" : String(arch || "");
}

function normalizeOsVersion(version) {
  return String(version || "").split(".").slice(0, 2).join(".");
}

function createUsageStats({
  userDataDir,
  version,
  channel,
  osVersion,
  arch,
  fetchImpl = globalThis.fetch,
  now = () => new Date(),
}) {
  const statePath = path.join(userDataDir, STATE_FILE);
  let inFlight = null;
  let timer = null;

  function readState() {
    try {
      const saved = JSON.parse(fs.readFileSync(statePath, "utf8"));
      return {
        enabled: saved.enabled !== false,
        installId: UUID_V4.test(String(saved.installId || "")) ? saved.installId : "",
        lastSentDay: typeof saved.lastSentDay === "string" ? saved.lastSentDay : "",
      };
    } catch {
      return { enabled: true, installId: "", lastSentDay: "" };
    }
  }

  function writeState(state) {
    try {
      fs.mkdirSync(userDataDir, { recursive: true });
      fs.writeFileSync(statePath, JSON.stringify(state, null, 2), "utf8");
    } catch {}
    return state;
  }

  function getEnabled() {
    return readState().enabled;
  }

  function setEnabled(value) {
    return writeState({ ...readState(), enabled: value !== false }).enabled;
  }

  async function send() {
    const state = readState();
    if (!state.enabled) return "disabled";
    const today = utcDay(now());
    if (state.lastSentDay === today) return "already-sent";
    if (typeof fetchImpl !== "function") return "failed";
    const installId = state.installId || crypto.randomUUID();
    if (!state.installId) writeState({ ...state, installId });
    const body = JSON.stringify({
      product: PRODUCT_ID,
      install_id: installId,
      version: String(version || ""),
      platform: "macos",
      os_version: normalizeOsVersion(osVersion),
      arch: normalizeArch(arch),
      channel,
    });
    try {
      const response = await fetchImpl(HEARTBEAT_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
      if (!response.ok) return "failed";
      writeState({ ...readState(), installId, lastSentDay: today });
      return "sent";
    } catch {
      return "failed";
    }
  }

  function sendIfDue() {
    if (!inFlight) inFlight = send().finally(() => { inFlight = null; });
    return inFlight;
  }

  function start() {
    void sendIfDue();
    if (!timer) {
      timer = setInterval(() => { void sendIfDue(); }, CHECK_INTERVAL_MS);
      timer.unref?.();
    }
  }

  return { getEnabled, setEnabled, sendIfDue, start, statePath };
}

module.exports = { createUsageStats, HEARTBEAT_URL, PRODUCT_ID, CHECK_INTERVAL_MS, REQUEST_TIMEOUT_MS };
