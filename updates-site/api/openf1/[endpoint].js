const { Readable } = require("node:stream");

// Read-only OpenF1 proxy. The server authenticates with its own OpenF1 account
// and returns only the requested data; the access token never leaves this
// function. Responses are CDN-cached so repeated requests don't hit OpenF1.
const OPENF1_TOKEN_URL = "https://api.openf1.org/token";
const OPENF1_API_BASE = "https://api.openf1.org/v1";
const TOKEN_REFRESH_MARGIN_MS = 60 * 1000;
const MAX_QUERY_LENGTH = 1024;
const LIVE_CACHE_SECONDS = 3;
const ARCHIVE_CACHE_SECONDS = 300;
const ALLOWED_ENDPOINTS = new Set([
  "car_data",
  "championship_drivers",
  "championship_teams",
  "drivers",
  "intervals",
  "laps",
  "location",
  "meetings",
  "overtakes",
  "pit",
  "position",
  "race_control",
  "session_result",
  "sessions",
  "starting_grid",
  "stints",
  "team_radio",
  "weather",
]);

const memory = globalThis.__APEXLINE_OPENF1_TOKEN_CACHE__ || { accessToken: "", expiresAt: 0, refresh: null };
globalThis.__APEXLINE_OPENF1_TOKEN_CACHE__ = memory;

function json(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(body));
}

async function fetchAccessToken(username, password) {
  const upstream = await fetch(OPENF1_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ username, password }).toString(),
  });
  const data = await upstream.json().catch(() => ({}));
  const accessToken = String(data?.access_token || "");
  if (!upstream.ok || !accessToken) throw new Error(`OpenF1 token request failed (${upstream.status}).`);
  const expiresIn = Math.max(60, Number(data?.expires_in || 3600));
  memory.accessToken = accessToken;
  memory.expiresAt = Date.now() + expiresIn * 1000;
  return accessToken;
}

async function accessToken() {
  const username = String(process.env.OPENF1_EMAIL || "").trim();
  const password = String(process.env.OPENF1_PASSWORD || "").trim();
  if (!username || !password) return "";
  if (memory.accessToken && memory.expiresAt - Date.now() > TOKEN_REFRESH_MARGIN_MS) return memory.accessToken;
  if (!memory.refresh) {
    memory.refresh = fetchAccessToken(username, password).finally(() => { memory.refresh = null; });
  }
  return memory.refresh;
}

function upstreamQuery(req) {
  const url = new URL(req.url, "http://localhost");
  url.searchParams.delete("endpoint");
  return url.searchParams.toString();
}

function cacheSeconds(query) {
  return /(?:^|&)(?:session_key|meeting_key)=latest(?:&|$)/.test(query) ? LIVE_CACHE_SECONDS : ARCHIVE_CACHE_SECONDS;
}

module.exports = async function handler(req, res) {
  if (req.method !== "GET") return json(res, 405, { error: "GET required." });
  const endpoint = String(req.query?.endpoint || "");
  if (!ALLOWED_ENDPOINTS.has(endpoint)) return json(res, 404, { error: "Unknown OpenF1 endpoint." });
  const query = upstreamQuery(req);
  if (query.length > MAX_QUERY_LENGTH) return json(res, 414, { error: "Query too long." });

  let token = "";
  try {
    token = await accessToken();
  } catch (error) {
    console.error("[openf1] token refresh failed:", error?.message);
  }

  try {
    const target = `${OPENF1_API_BASE}/${endpoint}${query ? `?${query}` : ""}`;
    const upstream = await fetch(target, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
    if (upstream.status === 401) memory.accessToken = "";
    res.statusCode = upstream.status;
    res.setHeader("Content-Type", upstream.headers.get("content-type") || "application/json; charset=utf-8");
    const retryAfter = upstream.headers.get("retry-after");
    if (retryAfter) res.setHeader("Retry-After", retryAfter);
    const seconds = cacheSeconds(query);
    res.setHeader("Cache-Control", upstream.ok ? `public, max-age=0, s-maxage=${seconds}, stale-while-revalidate=${seconds}` : "no-store");
    if (!upstream.body) return res.end();
    Readable.fromWeb(upstream.body).pipe(res);
  } catch (error) {
    console.error("[openf1] upstream request failed:", error?.message);
    return json(res, 502, { error: "OpenF1 request failed." });
  }
};
