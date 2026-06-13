const fs = require("node:fs");
const https = require("node:https");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const mainProcess = fs.readFileSync(path.join(root, "electron/main.cjs"), "utf8");

function extractNamedFunction(source, name) {
  const start = source.indexOf(`function ${name}`);
  if (start === -1) throw new Error(`${name} should exist`);
  const signatureEnd = source.indexOf(")", start);
  const bodyStart = source.indexOf("{", signatureEnd);
  let depth = 0;
  for (let index = bodyStart; index < source.length; index += 1) {
    const char = source[index];
    if (char === "{") depth += 1;
    if (char === "}") depth -= 1;
    if (depth === 0) return source.slice(start, index + 1);
  }
  throw new Error(`Could not extract ${name}`);
}

function extractConst(source, name) {
  const match = source.match(new RegExp(`const ${name} = ([\\s\\S]*?);\\n`));
  if (!match) throw new Error(`${name} should exist`);
  return match[0];
}

const parser = vm.runInNewContext(`(() => {
  ${extractConst(mainProcess, "F1TV_SEASON_PAGE_IDS")}
  ${extractNamedFunction(mainProcess, "normalizeOpenF1SessionKind")}
  ${extractNamedFunction(mainProcess, "f1TvCmsTimeIso")}
  ${extractNamedFunction(mainProcess, "normalizeF1TvCmsSessionKind")}
  ${extractNamedFunction(mainProcess, "normalizeF1TvCmsContentItem")}
  ${extractNamedFunction(mainProcess, "f1TvCmsContentItemsFromPage")}
  return { F1TV_SEASON_PAGE_IDS, normalizeOpenF1SessionKind, normalizeF1TvCmsContentItem, f1TvCmsContentItemsFromPage };
})()`, { Date, Intl, Number, String });

function option(name, fallback = "") {
  const prefix = `--${name}=`;
  const found = process.argv.slice(2).filter((arg) => arg.startsWith(prefix)).at(-1);
  return found ? found.slice(prefix.length) : fallback;
}

function requestJson(targetUrl, timeout = 10000) {
  const startedAt = Date.now();
  return new Promise((resolve, reject) => {
    const req = https.get(targetUrl, {
      headers: {
        Accept: "application/json, text/plain, */*",
        "Accept-Encoding": "identity",
        "User-Agent": "BestHTTP",
      },
      timeout,
    }, (res) => {
      let text = "";
      res.setEncoding("utf8");
      res.on("data", (chunk) => { text += chunk; });
      res.on("end", () => {
        if (res.statusCode < 200 || res.statusCode >= 300) {
          const error = new Error(`HTTP ${res.statusCode}`);
          error.statusCode = res.statusCode;
          error.elapsedMs = Date.now() - startedAt;
          reject(error);
          return;
        }
        try {
          resolve({ json: JSON.parse(text), bytes: Buffer.byteLength(text), elapsedMs: Date.now() - startedAt });
        } catch {
          const error = new Error("Response was not JSON");
          error.elapsedMs = Date.now() - startedAt;
          reject(error);
        }
      });
    });
    req.on("timeout", () => req.destroy(new Error(`Timeout after ${timeout}ms`)));
    req.on("error", reject);
  });
}

function countBy(items, keyFn) {
  return items.reduce((counts, item) => {
    const key = keyFn(item) || "";
    counts[key] = (counts[key] || 0) + 1;
    return counts;
  }, {});
}

function firstSamples(items, limit = 8) {
  return items.slice(0, limit).map((item) => ({
    status: item.status,
    contentSubtype: item.contentSubtype,
    meetingKey: item.meetingKey,
    sessionKey: item.sessionKey,
    sessionKind: item.sessionKind,
    hasContentId: Boolean(item.contentId),
  }));
}

function safeValue(value) {
  if (value == null) return value;
  if (typeof value === "number" || typeof value === "boolean") return value;
  const text = String(value);
  if (/^https?:\/\//i.test(text)) return "[url]";
  return text.length > 96 ? `${text.slice(0, 96)}...` : text;
}

function structuralDiagnostics(page) {
  const keyCounts = {};
  const candidates = [];
  const stack = [{ value: page, path: "$", depth: 0 }];
  const interestingKey = /meeting|session|subtype|object|title|content/i;
  while (stack.length) {
    const { value, path: itemPath, depth } = stack.pop();
    if (!value || depth > 8) continue;
    if (Array.isArray(value)) {
      value.slice(0, 60).forEach((entry, index) => stack.push({ value: entry, path: `${itemPath}[${index}]`, depth: depth + 1 }));
      continue;
    }
    if (typeof value !== "object") continue;
    const keys = Object.keys(value);
    keys.forEach((key) => { keyCounts[key] = (keyCounts[key] || 0) + 1; });
    const summary = {};
    keys.forEach((key) => {
      if (interestingKey.test(key) && value[key] != null && typeof value[key] !== "object") {
        summary[key] = safeValue(value[key]);
      }
    });
    if (value.actions && candidates.length < 12) {
      const actions = Array.isArray(value.actions) ? value.actions : [value.actions];
      summary.actions = actions.slice(0, 4).map((action) => {
        if (!action || typeof action !== "object") return safeValue(action);
        return Object.fromEntries(Object.entries(action)
          .filter(([key, entry]) => interestingKey.test(key) || /href|url|path|uri|type|target|id/i.test(key))
          .slice(0, 12)
          .map(([key, entry]) => [key, typeof entry === "object" ? "[object]" : safeValue(entry)]));
      });
    }
    if (Object.keys(summary).length && candidates.length < 12) {
      candidates.push({ path: itemPath, keys: keys.slice(0, 16), summary });
    }
    Object.entries(value).forEach(([key, entry]) => {
      if (entry && typeof entry === "object") stack.push({ value: entry, path: `${itemPath}.${key}`, depth: depth + 1 });
    });
  }
  return {
    topKeys: Object.entries(keyCounts).sort((a, b) => b[1] - a[1]).slice(0, 24),
    candidates,
  };
}

function cmsUrl(year, format) {
  const pageId = parser.F1TV_SEASON_PAGE_IDS[String(year)] || parser.F1TV_SEASON_PAGE_IDS[String(new Date().getFullYear())] || "395";
  return `https://f1tv.formula1.com/2.0/R/ENG/${format}/ALL/PAGE/${pageId}/PREMIUM/2`;
}

function absoluteCmsUrl(uri) {
  return new URL(String(uri || ""), "https://f1tv.formula1.com").href;
}

function detailPageUrisFromPage(page) {
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
  return uris;
}

async function probeDetailPages(page, detailLimit) {
  const uris = detailPageUrisFromPage(page).slice(0, Math.max(0, detailLimit));
  const startedAt = Date.now();
  const pages = await Promise.all(uris.map(async (uri) => {
    const response = await requestJson(absoluteCmsUrl(uri));
    return { uri, response };
  }));
  const normalized = pages.flatMap(({ response }) => parser.f1TvCmsContentItemsFromPage(response.json).map(parser.normalizeF1TvCmsContentItem).filter(Boolean));
  return {
    requested: uris.length,
    elapsedMs: Date.now() - startedAt,
    normalizedItems: normalized.length,
    statusCounts: countBy(normalized, (item) => item.status),
    subtypeCounts: countBy(normalized, (item) => item.contentSubtype),
    withMeetingKey: normalized.filter((item) => item.meetingKey).length,
    withSessionKey: normalized.filter((item) => item.sessionKey).length,
    samples: firstSamples(normalized),
    normalized,
  };
}

async function probeFormat(year, format) {
  const targetUrl = cmsUrl(year, format);
  const result = await requestJson(targetUrl);
  const rawItems = parser.f1TvCmsContentItemsFromPage(result.json);
  const normalized = rawItems.map(parser.normalizeF1TvCmsContentItem).filter(Boolean);
  const meetingSessionKeys = new Set(normalized.map((item) => `${item.meetingKey}:${parser.normalizeOpenF1SessionKind(item.sessionKind)}`));
  const detailLimit = Number(option("detail-limit", "6"));
  const detailPages = await probeDetailPages(result.json, Number.isFinite(detailLimit) ? detailLimit : 0).catch((error) => ({ error: error.message || String(error), normalized: [] }));
  return {
    format,
    ok: true,
    elapsedMs: result.elapsedMs,
    bytes: result.bytes,
    rawItems: rawItems.length,
    normalizedItems: normalized.length,
    statusCounts: countBy(normalized, (item) => item.status),
    subtypeCounts: countBy(normalized, (item) => item.contentSubtype),
    withMeetingKey: normalized.filter((item) => item.meetingKey).length,
    withSessionKey: normalized.filter((item) => item.sessionKey).length,
    uniqueMeetingSessionKeys: meetingSessionKeys.size,
    samples: firstSamples(normalized),
    detailPages: detailPages.normalized ? { ...detailPages, normalized: undefined } : detailPages,
    diagnostics: normalized.length ? null : structuralDiagnostics(result.json),
    combinedNormalized: normalized.concat(detailPages.normalized || []),
  };
}

async function probeOpenF1Matches(year, normalizedItems) {
  const { json: sessions, elapsedMs } = await requestJson(`https://api.openf1.org/v1/sessions?year=${year}`);
  const cmsKeys = new Set(normalizedItems.map((item) => `${item.meetingKey}:${parser.normalizeOpenF1SessionKind(item.sessionKind)}`));
  const matches = (sessions || []).filter((session) => {
    const key = `${String(session.meeting_key || "").trim()}:${parser.normalizeOpenF1SessionKind(session.session_name || session.session_type)}`;
    return cmsKeys.has(key);
  });
  return {
    elapsedMs,
    openF1Sessions: Array.isArray(sessions) ? sessions.length : 0,
    matchedSessions: matches.length,
    sessionSamples: (sessions || []).slice(0, 8).map((session) => ({
      meetingKey: String(session.meeting_key || ""),
      sessionKey: String(session.session_key || ""),
      sessionName: session.session_name || session.session_type || "",
    })),
    matchedSamples: matches.slice(0, 8).map((session) => ({
      meetingKey: String(session.meeting_key || ""),
      sessionName: session.session_name || session.session_type || "",
    })),
  };
}

(async () => {
  const year = option("year", String(new Date().getFullYear())).replace(/[^0-9]/g, "") || String(new Date().getFullYear());
  const formats = option("formats", "WEB_DASH,WEB_HLS,BIG_SCREEN_DASH,BIG_SCREEN_HLS")
    .split(",")
    .map((format) => format.trim())
    .filter(Boolean);
  const summaries = [];
  for (const format of formats) {
    try {
      summaries.push(await probeFormat(year, format));
    } catch (error) {
      summaries.push({
        format,
        ok: false,
        elapsedMs: error.elapsedMs || 0,
        error: error.message || String(error),
      });
    }
  }
  const best = summaries
    .filter((summary) => summary.ok)
    .sort((a, b) => ((b.normalizedItems + (b.detailPages?.normalizedItems || 0)) - (a.normalizedItems + (a.detailPages?.normalizedItems || 0))) || a.elapsedMs - b.elapsedMs)[0];
  let openF1 = null;
  if (best?.combinedNormalized?.length) {
    openF1 = await probeOpenF1Matches(year, best.combinedNormalized).catch((error) => ({ error: error.message || String(error) }));
  }
  summaries.forEach((summary) => { delete summary.combinedNormalized; });
  console.log(JSON.stringify({
    source: "F1 TV CMS season page",
    year,
    summaries,
    bestFormat: best?.format || "",
    openF1,
  }, null, 2));
})().catch((error) => {
  console.error(error?.stack || error?.message || String(error));
  process.exit(1);
});
