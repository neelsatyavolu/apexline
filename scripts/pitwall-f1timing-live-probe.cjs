#!/usr/bin/env node
// Live Formula 1 SignalR timing health probe (~1 minute).
// Uses the subscription token from Apexline's stored login-session cookie.
// Never prints tokens, cookies, or raw auth material.

"use strict";

const assert = require("node:assert/strict");
const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const https = require("node:https");
const path = require("node:path");
const tls = require("node:tls");
const { createHash, randomBytes } = require("node:crypto");
const vm = require("node:vm");
const zlib = require("node:zlib");

const root = path.resolve(__dirname, "..");
const mainProcess = fs.readFileSync(path.join(root, "electron/main.cjs"), "utf8");

function option(name, fallback = "") {
  const prefix = `--${name}=`;
  const hit = process.argv.find((arg) => arg.startsWith(prefix));
  return hit ? hit.slice(prefix.length) : fallback;
}

const DURATION_MS = Math.max(15_000, Number(option("durationMs", "60000")) || 60_000);
const SAMPLE_MS = Math.max(1000, Number(option("sampleMs", "2500")) || 2500);
const COOKIES_DB = option(
  "cookiesDb",
  path.join(process.env.HOME || "", "Library/Application Support/Apexline/Cookies"),
);

function extractNamedFunction(source, name) {
  const re = new RegExp(`(?:async\\s+)?function\\s+${name}\\s*\\(`);
  const match = re.exec(source);
  if (!match) throw new Error(`${name} should exist`);
  const start = match.index;
  const signatureStart = source.indexOf("(", start);
  let signatureDepth = 0;
  let bodyStart = -1;
  for (let index = signatureStart; index < source.length; index += 1) {
    const char = source[index];
    if (char === "(") signatureDepth += 1;
    if (char === ")") signatureDepth -= 1;
    if (signatureDepth === 0) {
      bodyStart = source.indexOf("{", index);
      break;
    }
  }
  let depth = 0;
  for (let index = bodyStart; index < source.length; index += 1) {
    const char = source[index];
    if (char === "{") depth += 1;
    if (char === "}") depth -= 1;
    if (depth === 0) return source.slice(start, index + 1);
  }
  throw new Error(`Could not extract ${name}`);
}

function readSubscriptionTokenFromCookiesDb(dbPath) {
  if (!fs.existsSync(dbPath)) {
    throw new Error(`Apexline Cookies DB not found at ${dbPath}`);
  }
  const raw = execFileSync(
    "sqlite3",
    [dbPath, "SELECT value FROM cookies WHERE name='login-session' LIMIT 1;"],
    { encoding: "utf8" },
  ).trim();
  if (!raw) throw new Error("No login-session cookie in Apexline Cookies DB. Sign in to F1 TV in the app first.");
  let token = "";
  try {
    token = String(JSON.parse(decodeURIComponent(raw))?.data?.subscriptionToken || "").trim();
  } catch {
    throw new Error("login-session cookie could not be parsed for a subscription token.");
  }
  if (!token || token.length < 40) {
    throw new Error("login-session did not contain a usable subscription token.");
  }
  return token;
}

function segmentHasMidHoles(segments) {
  if (!Array.isArray(segments) || segments.length < 3) return false;
  let lastActive = -1;
  for (let index = 0; index < segments.length; index += 1) {
    if (segments[index] && segments[index] !== "off") lastActive = index;
  }
  if (lastActive <= 0) return false;
  for (let index = 0; index < lastActive; index += 1) {
    if (!segments[index] || segments[index] === "off") return true;
  }
  return false;
}

function summarizeSnapshot(snapshot, state) {
  const rows = Array.isArray(snapshot?.timing) ? snapshot.timing : [];
  let midHoleRows = 0;
  let activeSectorRows = 0;
  let lastLapRows = 0;
  let bestLapRows = 0;
  const sampleCodes = [];
  for (const row of rows) {
    if (row?.lastLapDuration != null || (row?.last && row.last !== "—" && row.last !== "-")) lastLapRows += 1;
    if (row?.bestLapDuration != null || (row?.best && row.best !== "—" && row.best !== "-")) bestLapRows += 1;
    const sectors = row?.sectors || {};
    let hole = false;
    let active = false;
    for (const key of ["s1", "s2", "s3"]) {
      const segs = sectors[key] || [];
      if (segs.some((tone) => tone && tone !== "off")) active = true;
      if (segmentHasMidHoles(segs)) hole = true;
    }
    if (active) activeSectorRows += 1;
    if (hole) {
      midHoleRows += 1;
      if (sampleCodes.length < 6) sampleCodes.push(row.code || String(row.number || "?"));
    }
  }
  const timingEntries = state?.entriesByTopic?.TimingData?.length || 0;
  return {
    rows: rows.length,
    lastLapRows,
    bestLapRows,
    activeSectorRows,
    midHoleRows,
    holeCodes: sampleCodes,
    timingEntries,
    authTokenAttached: Boolean(snapshot?.diagnostics?.authTokenAttached),
    lastTopic: state?.lastTopic || "",
    session: snapshot?.diagnostics?.sessionInfo?.sessionName
      || snapshot?.diagnostics?.sessionInfo?.meetingName
      || "",
  };
}

const FUNCTION_NAMES = [
  "finiteNumber",
  "groupRowsByDriverNumber",
  "clampPercent",
  "latestCarDataByDriverNumber",
  "preserveDeletedF1TimingLine",
  "f1TimingBlankTimingValue",
  "f1TimingSegmentMapFromValue",
  "mergeF1TimingSegmentMap",
  "mergeF1TimingDelta",
  "f1TimingStateAt",
  "f1TimingStateBetween",
  "f1TimingLatestEntryAt",
  "f1TimingArchiveStartUtcMs",
  "f1TimingArchiveSecondsForUtc",
  "f1TimingVideoStartArchiveSeconds",
  "f1TimingSessionStartSeconds",
  "f1TimingValue",
  "f1TimingLapSeconds",
  "f1TimingDurationSeconds",
  "formatF1TimingDuration",
  "f1TimingTargetUtcMs",
  "f1TimingExplicitQualifyingPart",
  "f1TimingQualifyingPart",
  "f1TimingQualifyingPartStartSeconds",
  "fillF1TimingQualifyingDeltas",
  "timingSegmentTone",
  "f1TimingSegments",
  "f1TimingSegmentProgress",
  "f1TimingSegmentExtent",
  "f1TimingTrimLeadingOffSegments",
  "f1TimingBackfillSegmentHoles",
  "f1TimingMergeSectorSegments",
  "f1TimingLineSessionLap",
  "f1TimingDriverStatusFlags",
  "f1TimingSectorHistoryAt",
  "f1TimingPreservedSegments",
  "f1TimingPrunePrematureSectorSegments",
  "f1TimingSectorTime",
  "f1TimingStints",
  "f1TimingLatestStint",
  "f1TimingKnownCompoundsByNumber",
  "decodeF1TimingZPayload",
  "f1TimingLivePayload",
  "compactF1TimingLiveEntries",
  "boundedF1TimingLiveEntries",
  "f1TimingLiveDataWithFeedTime",
  "f1LiveTimingFeedLatencySeconds",
  "f1LiveTimingEntrySeconds",
  "applyF1TimingLiveFeed",
  "applyF1TimingSignalRMessage",
  "f1TimingLiveTopicDiagnostics",
  "f1TimingTelemetryFromCarData",
  "f1TimingTelemetrySamples",
  "f1TimingTelemetryRowsAt",
  "f1TimingInterpolatedPositionRowsAt",
  "f1TimingPositionSamples",
  "f1TimingPositionRowsAt",
  "parseF1TimingWeatherState",
  "parseF1TimingRaceControlMessages",
  "parseF1TimingLapCount",
  "f1TimingLapTimeline",
  "parseF1TimingSessionClock",
  "parseF1TimingArchiveRows",
  "getF1LiveTimingSnapshot",
  "f1LiveTimingCatchUpRemainingSeconds",
  "formatLapDuration",
  "stripJsonBom",
  "f1TimingHeaders",
  "f1TimingSignalRCookieFromHeaders",
  "requestF1TimingSignalRCookie",
  "encodeF1TimingWebSocketFrame",
  "createF1TimingWebSocket",
  "requestF1TimingJsonPost",
  "isF1TvSubscriptionToken",
  "decodeF1TvJwtPayload",
];

async function main() {
  const subscriptionToken = readSubscriptionTokenFromCookiesDb(COOKIES_DB);
  console.log(JSON.stringify({
    phase: "auth",
    ok: true,
    tokenSource: "Apexline Cookies login-session",
    tokenAttached: true,
    tokenChars: subscriptionToken.length,
    durationMs: DURATION_MS,
    sampleMs: SAMPLE_MS,
  }));

  const sandbox = vm.runInNewContext(`(() => {
    const F1_TIMING_LIVE_STALE_MS = 30000;
    const F1_TIMING_LIVE_FEED_LATENCY_MAX_SECONDS = 15;
    const F1_TIMING_LIVE_FEED_LATENCY_SAMPLE_LIMIT = 48;
    const F1_TIMING_LIVE_STREAM_ALIGNMENT_SECONDS = 4.6;
    const F1_TIMING_LIVE_ENTRY_SOFT_LIMIT = 1000;
    const F1_TIMING_LIVE_ENTRY_KEEP = 700;
    const F1_TIMING_LIVE_CONNECT_RETRY_MS = 4000;
    const F1_TIMING_LIVE_CLOSE_RETRY_MS = 2500;
    const F1_TIMING_NEGOTIATE_URL = "https://livetiming.formula1.com/signalrcore/negotiate";
    const F1_TIMING_SIGNALR_URL = "wss://livetiming.formula1.com/signalrcore";
    const F1_TIMING_SIGNALR_TOPICS = [
      "Heartbeat", "AudioStreams", "DriverList", "ExtrapolatedClock",
      "RaceControlMessages", "SessionInfo", "SessionStatus", "TeamRadio",
      "TimingAppData", "TimingStats", "TrackStatus", "WeatherData",
      "Position.z", "CarData.z", "Position", "CarData", "ContentStreams", "SessionData",
      "TimingData", "TopThree", "RcmSeries", "LapCount",
    ];
    const f1TimingTelemetrySampleCache = new WeakMap();
    const f1TimingPositionSampleCache = new WeakMap();
    const f1TimingStateCursorCache = new WeakMap();
    let f1LiveTimingClient = null;
    let f1LiveTimingState = { entriesByTopic: {}, lastMessageAt: 0, lastTopic: "", lastError: "", feedLatencySamples: [] };
    let injectedSubscriptionToken = "";
    function ensureF1TimingLiveClient() { return Promise.resolve(); }
    function setInjectedSubscriptionToken(token) { injectedSubscriptionToken = String(token || ""); }
    function getF1LiveTimingState() { return f1LiveTimingState; }
    async function getF1TvSubscriptionToken() { return injectedSubscriptionToken; }
    function normalizeCompound(value) { return String(value || "").toLowerCase(); }
    ${FUNCTION_NAMES.map((name) => extractNamedFunction(mainProcess, name)).join("\n")}
    async function connectLive() {
      f1LiveTimingClient = { connecting: true, connected: false, nextAttemptAt: Date.now() + F1_TIMING_LIVE_CONNECT_RETRY_MS };
      f1LiveTimingState = { entriesByTopic: {}, lastMessageAt: 0, lastTopic: "", lastError: "", feedLatencySamples: [] };
      const signalRCookie = await requestF1TimingSignalRCookie();
      const negotiate = await requestF1TimingJsonPost(F1_TIMING_NEGOTIATE_URL, 10000, signalRCookie ? { Cookie: signalRCookie } : {});
      const connectionId = String(negotiate?.connectionId || negotiate?.connectionToken || "");
      if (!connectionId) throw new Error("Formula 1 live timing did not return a SignalR connection id.");
      const subscriptionToken = String(await getF1TvSubscriptionToken() || "").trim();
      f1LiveTimingClient.authTokenAttached = Boolean(subscriptionToken);
      f1LiveTimingClient.signalRCookieAttached = Boolean(signalRCookie);
      const liveUrl = new URL(F1_TIMING_SIGNALR_URL);
      liveUrl.searchParams.set("id", connectionId);
      if (subscriptionToken) liveUrl.searchParams.set("authToken", subscriptionToken);
      const wsHeaders = {};
      if (signalRCookie) wsHeaders.Cookie = signalRCookie;
      const ws = createF1TimingWebSocket(liveUrl.href, wsHeaders, 20000);
      f1LiveTimingClient.socket = ws;
      await new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error("Timed out waiting for SignalR open")), 20000);
        ws.onopen = () => {
          f1LiveTimingClient.connected = true;
          f1LiveTimingClient.connecting = false;
          try {
            ws.send(JSON.stringify({ protocol: "json", version: 1 }) + "\\x1e");
            ws.send(JSON.stringify({ type: 1, target: "Subscribe", arguments: [F1_TIMING_SIGNALR_TOPICS], invocationId: "0" }) + "\\x1e");
            clearTimeout(timer);
            resolve();
          } catch (error) {
            clearTimeout(timer);
            reject(error);
          }
        };
        ws.onerror = () => {
          clearTimeout(timer);
          reject(new Error("Formula 1 live timing WebSocket error during open."));
        };
        ws.onclose = () => {
          f1LiveTimingClient.connected = false;
          f1LiveTimingClient.connecting = false;
        };
      });
      ws.onmessage = async (event) => {
        const text = typeof event.data === "string" ? event.data : Buffer.from(event.data).toString("utf8");
        for (const chunk of String(text).split("\\x1e").filter(Boolean)) {
          try { applyF1TimingSignalRMessage(JSON.parse(chunk)); } catch {}
        }
      };
      return f1LiveTimingClient;
    }
    function closeLive() {
      try { f1LiveTimingClient?.socket?.close?.(); } catch {}
    }
    return {
      setInjectedSubscriptionToken,
      connectLive,
      closeLive,
      getF1LiveTimingSnapshot,
      getF1LiveTimingState,
    };
  })()`, { Buffer, zlib, https, tls, randomBytes, createHash, URL, setTimeout, clearTimeout, console });

  sandbox.setInjectedSubscriptionToken(subscriptionToken);
  await sandbox.connectLive();
  console.log(JSON.stringify({ phase: "connected", ok: true }));

  const started = Date.now();
  const samples = [];
  let peakLastLapRows = 0;
  let peakBestLapRows = 0;
  let peakActiveSectorRows = 0;
  let maxMidHoles = 0;
  let maxTimingEntries = 0;

  while (Date.now() - started < DURATION_MS) {
    await new Promise((resolve) => setTimeout(resolve, SAMPLE_MS));
    const snapshot = sandbox.getF1LiveTimingSnapshot();
    const state = sandbox.getF1LiveTimingState();
    if (!snapshot?.timing?.length) {
      samples.push({
        t: Math.round((Date.now() - started) / 1000),
        ok: false,
        reason: "no-snapshot",
        lastError: state?.lastError || "",
        timingEntries: state?.entriesByTopic?.TimingData?.length || 0,
      });
      console.log(JSON.stringify(samples.at(-1)));
      continue;
    }
    const summary = summarizeSnapshot(snapshot, state);
    peakLastLapRows = Math.max(peakLastLapRows, summary.lastLapRows);
    peakBestLapRows = Math.max(peakBestLapRows, summary.bestLapRows);
    peakActiveSectorRows = Math.max(peakActiveSectorRows, summary.activeSectorRows);
    maxMidHoles = Math.max(maxMidHoles, summary.midHoleRows);
    maxTimingEntries = Math.max(maxTimingEntries, summary.timingEntries);
    const sample = {
      t: Math.round((Date.now() - started) / 1000),
      ok: summary.midHoleRows === 0 && summary.rows > 0,
      ...summary,
    };
    samples.push(sample);
    console.log(JSON.stringify(sample));
  }

  sandbox.closeLive();

  const goodSamples = samples.filter((sample) => sample.rows > 0);
  assert.ok(goodSamples.length >= 3, "Expected multiple live timing snapshots over the probe window");
  assert.ok(
    goodSamples.every((sample) => sample.midHoleRows === 0),
    `Mini-sector mid-bar holes appeared during live feed (max midHoleRows=${maxMidHoles})`,
  );
  // Last/best laps should not evaporate once the feed has populated them.
  if (peakLastLapRows >= 3) {
    const late = goodSamples.slice(-3);
    for (const sample of late) {
      assert.ok(
        sample.lastLapRows >= Math.max(1, Math.floor(peakLastLapRows * 0.4)),
        `Last-lap rows collapsed late in the window (peak=${peakLastLapRows}, late=${sample.lastLapRows} at t=${sample.t}s)`,
      );
    }
  }
  if (peakBestLapRows >= 3) {
    const late = goodSamples.slice(-3);
    for (const sample of late) {
      assert.ok(
        sample.bestLapRows >= Math.max(1, Math.floor(peakBestLapRows * 0.5)),
        `Best-lap rows collapsed late in the window (peak=${peakBestLapRows}, late=${sample.bestLapRows} at t=${sample.t}s)`,
      );
    }
  }

  const result = {
    phase: "done",
    ok: true,
    durationSec: Math.round((Date.now() - started) / 1000),
    samples: samples.length,
    goodSamples: goodSamples.length,
    peakLastLapRows,
    peakBestLapRows,
    peakActiveSectorRows,
    maxMidHoles,
    maxTimingEntries,
    final: goodSamples.at(-1) || null,
  };
  console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => {
  console.error(JSON.stringify({
    phase: "error",
    ok: false,
    message: error?.message || String(error),
  }));
  process.exit(1);
});
