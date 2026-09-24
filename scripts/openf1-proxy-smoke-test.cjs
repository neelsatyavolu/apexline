const assert = require("node:assert/strict");
const { Writable } = require("node:stream");

const SECRET_TOKEN = "openf1-secret-access-token";
const upstreamCalls = [];

function fakeFetch(url, options = {}) {
  upstreamCalls.push({ url: String(url), options });
  if (String(url).endsWith("/token")) {
    return Promise.resolve(new Response(JSON.stringify({ access_token: SECRET_TOKEN, expires_in: 3600 }), { status: 200 }));
  }
  return Promise.resolve(new Response(JSON.stringify([{ driver_number: 12, lap_number: 38 }]), {
    status: 200,
    headers: { "content-type": "application/json" },
  }));
}

function invoke(handler, { method = "GET", endpoint, search = "" }) {
  return new Promise((resolve) => {
    const chunks = [];
    const res = new Writable({
      write(chunk, _encoding, callback) {
        chunks.push(Buffer.from(chunk));
        callback();
      },
    });
    res.statusCode = 0;
    res.headers = {};
    res.setHeader = (key, value) => { res.headers[key.toLowerCase()] = value; };
    const finish = res.end.bind(res);
    res.end = (chunk) => {
      if (chunk) chunks.push(Buffer.from(chunk));
      finish();
    };
    res.on("finish", () => resolve({ statusCode: res.statusCode, headers: res.headers, body: Buffer.concat(chunks).toString("utf8") }));
    handler({ method, url: `/api/openf1/${endpoint}${search}`, query: { endpoint } }, res);
  });
}

(async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = fakeFetch;
  process.env.OPENF1_EMAIL = "owner@example.com";
  process.env.OPENF1_PASSWORD = "not-a-real-password";
  try {
    const handler = require("../updates-site/api/openf1/[endpoint].js");

    const live = await invoke(handler, { endpoint: "laps", search: "?session_key=latest&driver_number=12&endpoint=ignored" });
    assert.equal(live.statusCode, 200, "Allowlisted endpoints should proxy successfully");
    assert.deepEqual(JSON.parse(live.body), [{ driver_number: 12, lap_number: 38 }], "Proxy should return upstream data");
    assert.ok(!live.body.includes(SECRET_TOKEN), "The OpenF1 token must never be returned to clients");
    assert.match(live.headers["cache-control"], /s-maxage=3\b/, "Live queries should use a short CDN cache");

    const dataCall = upstreamCalls.find((call) => call.url.includes("/v1/laps"));
    assert.equal(dataCall.url, "https://api.openf1.org/v1/laps?session_key=latest&driver_number=12", "Proxy should forward the query without its own routing param");
    assert.equal(dataCall.options.headers.Authorization, `Bearer ${SECRET_TOKEN}`, "Proxy should authenticate upstream with the server token");

    const archive = await invoke(handler, { endpoint: "sessions", search: "?year=2026" });
    assert.match(archive.headers["cache-control"], /s-maxage=300\b/, "Archive queries should use a longer CDN cache");

    const tokenProbe = await invoke(handler, { endpoint: "token" });
    assert.equal(tokenProbe.statusCode, 404, "The token endpoint must not be reachable through the proxy");
    const traversal = await invoke(handler, { endpoint: "../token" });
    assert.equal(traversal.statusCode, 404, "Path traversal outside the allowlist should be rejected");
    const post = await invoke(handler, { method: "POST", endpoint: "laps" });
    assert.equal(post.statusCode, 405, "Only GET should be allowed");

    const tokenRequests = upstreamCalls.filter((call) => call.url.endsWith("/token")).length;
    assert.equal(tokenRequests, 1, "The server token should be cached across requests");

    console.log("Apexline OpenF1 proxy smoke checks passed");
  } finally {
    globalThis.fetch = originalFetch;
  }
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
