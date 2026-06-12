const OPENF1_TOKEN_URL = "https://api.openf1.org/token";
const TOKEN_REFRESH_MARGIN_MS = 60 * 1000;

const memory = globalThis.__APEXLINE_OPENF1_TOKEN_CACHE__ || { accessToken: "", expiresAt: 0 };
globalThis.__APEXLINE_OPENF1_TOKEN_CACHE__ = memory;

function json(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(body));
}

module.exports = async function handler(req, res) {
  if (req.method === "OPTIONS") return json(res, 200, { ok: true });
  if (req.method !== "GET" && req.method !== "POST") return json(res, 405, { error: "Method not allowed." });

  const username = String(process.env.OPENF1_EMAIL || "").trim();
  const password = String(process.env.OPENF1_PASSWORD || "").trim();
  if (!username || !password) return json(res, 503, { error: "OpenF1 credentials are not configured." });

  const now = Date.now();
  if (memory.accessToken && memory.expiresAt - now > TOKEN_REFRESH_MARGIN_MS) {
    return json(res, 200, {
      access_token: memory.accessToken,
      expires_in: Math.floor((memory.expiresAt - now) / 1000),
      token_type: "bearer",
    });
  }

  try {
    const upstream = await fetch(OPENF1_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ username, password }).toString(),
    });
    const data = await upstream.json().catch(() => ({}));
    const accessToken = String(data?.access_token || "");
    if (!upstream.ok || !accessToken) return json(res, 502, { error: "OpenF1 token request failed." });
    const expiresIn = Math.max(60, Number(data?.expires_in || 3600));
    memory.accessToken = accessToken;
    memory.expiresAt = Date.now() + expiresIn * 1000;
    return json(res, 200, { access_token: accessToken, expires_in: expiresIn, token_type: "bearer" });
  } catch {
    return json(res, 502, { error: "OpenF1 token request failed." });
  }
};
