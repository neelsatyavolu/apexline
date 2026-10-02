/* F1 TV live timing-signal probe (diagnostic only, never changes playback).
 *
 * Live timing can only be matched to the picture automatically if the stream
 * says when each frame was captured. Program-date-time is stamped seconds after
 * capture, so this checks whether F1 TV's HLS or DASH live streams carry a
 * better clock: ISO-BMFF `prft` (encoder wall-clock), `emsg` ID3 capture dates
 * (what MultiViewer reads), or DASH ProducerReferenceTime / event streams.
 * Results are summarised without URLs or tokens.
 */

const NTP_UNIX_OFFSET_SECONDS = 2208988800;
const MAX_TOP_LEVEL_BOXES = 4096;

function mp4Boxes(buffer, start = 0, end = buffer.length) {
  const boxes = [];
  let offset = start;
  while (offset + 8 <= end && boxes.length < MAX_TOP_LEVEL_BOXES) {
    let size = buffer.readUInt32BE(offset);
    const type = buffer.toString("latin1", offset + 4, offset + 8);
    let header = 8;
    if (size === 1) {
      if (offset + 16 > end) break;
      size = Number(buffer.readBigUInt64BE(offset + 8));
      header = 16;
    } else if (size === 0) {
      size = end - offset;
    }
    if (size < header || offset + size > end) {
      boxes.push({ type, offset, size: end - offset, header, truncated: true });
      break;
    }
    boxes.push({ type, offset, size, header });
    offset += size;
  }
  return boxes;
}

function readCString(buffer, offset, end) {
  const zero = buffer.indexOf(0, offset);
  const stop = zero < 0 || zero > end ? end : zero;
  return { value: buffer.toString("utf8", offset, stop), next: Math.min(end, stop + 1) };
}

function trailingDateMs(text) {
  const parts = String(text || "").split("\0").map((part) => part.trim()).filter(Boolean);
  const ms = Date.parse(parts[parts.length - 1] || "");
  return Number.isFinite(ms) && ms > Date.UTC(2020, 0, 1) ? ms : null;
}

function emsgInfo(buffer, box) {
  const start = box.offset + box.header;
  const end = box.offset + box.size;
  const version = buffer.readUInt8(start);
  let offset = start + 4;
  let scheme;
  let value;
  let timescale;
  let presentationTime = null;
  if (version === 0) {
    scheme = readCString(buffer, offset, end);
    value = readCString(buffer, scheme.next, end);
    offset = value.next;
    timescale = buffer.readUInt32BE(offset);
    offset += 16; // timescale, presentation_time_delta, event_duration, id
  } else {
    timescale = buffer.readUInt32BE(offset);
    presentationTime = Number(buffer.readBigUInt64BE(offset + 4));
    offset += 20; // timescale, presentation_time(64), event_duration, id
    scheme = readCString(buffer, offset, end);
    value = readCString(buffer, scheme.next, end);
    offset = value.next;
  }
  const message = buffer.subarray(Math.min(offset, end), end);
  return {
    version,
    scheme: scheme.value.slice(0, 80),
    value: value.value.slice(0, 40),
    timescale,
    presentationTime,
    id3: message.toString("latin1", 0, 3) === "ID3",
    captureUtcMs: trailingDateMs(message.toString("latin1")),
  };
}

function prftInfo(buffer, box) {
  const start = box.offset + box.header;
  const version = buffer.readUInt8(start);
  const ntpSeconds = buffer.readUInt32BE(start + 8);
  const ntpFraction = buffer.readUInt32BE(start + 12);
  const mediaTime = version === 0 ? buffer.readUInt32BE(start + 16) : Number(buffer.readBigUInt64BE(start + 16));
  return {
    version,
    utcMs: Math.round((ntpSeconds - NTP_UNIX_OFFSET_SECONDS) * 1000 + (ntpFraction / 2 ** 32) * 1000),
    mediaTime,
  };
}

function firstTfdt(buffer, moof) {
  for (const traf of mp4Boxes(buffer, moof.offset + moof.header, moof.offset + moof.size).filter((box) => box.type === "traf")) {
    const tfdt = mp4Boxes(buffer, traf.offset + traf.header, traf.offset + traf.size).find((box) => box.type === "tfdt");
    if (!tfdt) continue;
    const start = tfdt.offset + tfdt.header;
    return buffer.readUInt8(start) === 1 ? Number(buffer.readBigUInt64BE(start + 4)) : buffer.readUInt32BE(start + 4);
  }
  return null;
}

function segmentTimingSignals(buffer) {
  if (!buffer?.length) return { container: "empty" };
  if (buffer[0] === 0x47) return { container: "ts", id3: buffer.includes(Buffer.from("ID3", "latin1")) };
  const boxes = mp4Boxes(buffer);
  if (!boxes.length || !/^[a-z0-9 ]{4}$/i.test(boxes[0].type)) return { container: "unknown" };
  const moof = boxes.find((box) => box.type === "moof");
  return {
    container: "fmp4",
    boxes: Array.from(new Set(boxes.map((box) => box.type))).slice(0, 12),
    emsg: boxes.filter((box) => box.type === "emsg").slice(0, 4).map((box) => emsgInfo(buffer, box)),
    prft: boxes.filter((box) => box.type === "prft").slice(0, 4).map((box) => prftInfo(buffer, box)),
    tfdt: moof ? firstTfdt(buffer, moof) : null,
  };
}

function resolveUrl(target, base) {
  try { return new URL(target, base).href; } catch { return ""; }
}

function hlsFirstVariantUrl(text, manifestUrl) {
  const lines = String(text || "").split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const index = lines.findIndex((line) => /^#EXT-X-STREAM-INF/i.test(line));
  const child = index >= 0 ? lines.slice(index + 1).find((line) => !line.startsWith("#")) : "";
  return child ? resolveUrl(child, manifestUrl) : "";
}

function hlsMediaPlaylistSummary(text, playlistUrl) {
  const segments = [];
  let pdtMs = null;
  let duration = 0;
  let mapUrl = "";
  let dateRanges = 0;
  const tags = new Set();
  for (const raw of String(text || "").split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    if (line.startsWith("#")) {
      tags.add(line.split(":")[0]);
      if (/^#EXT-X-PROGRAM-DATE-TIME:/i.test(line)) {
        const parsed = Date.parse(line.slice(line.indexOf(":") + 1));
        pdtMs = Number.isFinite(parsed) ? parsed : null;
      } else if (/^#EXTINF:/i.test(line)) {
        duration = Number.parseFloat(line.slice(8)) || 0;
      } else if (/^#EXT-X-MAP:/i.test(line)) {
        const uri = line.match(/URI="([^"]+)"/i)?.[1];
        if (uri) mapUrl = resolveUrl(uri, playlistUrl);
      } else if (/^#EXT-X-DATERANGE:/i.test(line)) {
        dateRanges += 1;
      }
      continue;
    }
    segments.push({ url: resolveUrl(line, playlistUrl), pdtMs });
    if (pdtMs != null) pdtMs += duration * 1000;
    duration = 0;
  }
  return {
    mapUrl,
    last: segments[segments.length - 1] || null,
    segmentCount: segments.length,
    dateRanges,
    tags: Array.from(tags).slice(0, 24),
  };
}

function xmlAttr(tag, name) {
  return String(tag || "").match(new RegExp(`\\b${name}="([^"]*)"`, "i"))?.[1] ?? null;
}

function dashManifestSummary(text) {
  const schemes = (element) => Array.from(String(text || "").matchAll(new RegExp(`<${element}\\b[^>]*schemeIdUri="([^"]+)"`, "gi")))
    .map((match) => match[1].slice(0, 80)).slice(0, 6);
  return {
    producerReferenceTime: /<ProducerReferenceTime\b/i.test(text),
    inbandEventSchemes: schemes("InbandEventStream"),
    eventStreamSchemes: schemes("EventStream"),
    utcTimingSchemes: schemes("UTCTiming"),
    hasAvailabilityStartTime: /availabilityStartTime="/i.test(text),
  };
}

// Recent segments of one live SegmentTemplate/SegmentTimeline AdaptationSet.
// Regex XML parsing is enough for a one-off diagnostic; any miss is reported.
function dashRecentSegments(text, manifestUrl, { kind = "video", count = 1 } = {}) {
  const mpd = String(text || "");
  const kindPattern = new RegExp(`contentType="${kind}"|mimeType="${kind}/`, "i");
  const adaptation = Array.from(mpd.matchAll(/<AdaptationSet\b[^>]*>[\s\S]*?<\/AdaptationSet>/gi))
    .map((match) => match[0])
    .find((block) => kindPattern.test(block));
  if (!adaptation) return { reason: `no-${kind}-adaptation` };
  const templateTag = adaptation.match(/<SegmentTemplate\b[^>]*>/i)?.[0];
  const representation = adaptation.match(/<Representation\b[^>]*>/i)?.[0];
  if (!templateTag || !representation) return { reason: "no-segment-template" };
  const media = xmlAttr(templateTag, "media");
  const init = xmlAttr(templateTag, "initialization");
  const startNumber = Number(xmlAttr(templateTag, "startNumber") || 1);
  const repId = xmlAttr(representation, "id") || "";
  const bandwidth = xmlAttr(representation, "bandwidth") || "";
  const times = [];
  let nextTime = 0;
  for (const s of adaptation.matchAll(/<S\b[^>]*\/?>/gi)) {
    const t = xmlAttr(s[0], "t");
    const d = Number(xmlAttr(s[0], "d") || 0);
    const repeats = Math.max(0, Number(xmlAttr(s[0], "r") || 0)) + 1;
    if (t != null) nextTime = Number(t);
    for (let index = 0; index < repeats; index += 1) {
      times.push(nextTime);
      nextTime += d;
    }
  }
  if (!media || !times.length) return { reason: "no-timeline" };
  const baseUrl = mpd.match(/<BaseURL>([^<]+)<\/BaseURL>/i)?.[1] || "";
  const base = baseUrl ? resolveUrl(baseUrl, manifestUrl) : manifestUrl;
  const fill = (template, time, number) => template
    .replace(/\$RepresentationID\$/g, repId)
    .replace(/\$Bandwidth\$/g, bandwidth)
    .replace(/\$Time\$/g, String(time))
    .replace(/\$Number(?:%0(\d+)d)?\$/g, (_match, width) => String(number).padStart(Number(width || 0), "0"));
  const first = Math.max(0, times.length - Math.max(1, count));
  return {
    initUrl: init ? resolveUrl(fill(init, 0, startNumber), base) : "",
    segmentUrls: times.slice(first).map((time, offset) => resolveUrl(fill(media, time, startNumber + first + offset), base)),
    timescale: Number(xmlAttr(templateTag, "timescale") || 1),
    presentationTimeOffset: Number(xmlAttr(templateTag, "presentationTimeOffset") || 0),
  };
}

function dashLatestVideoSegment(text, manifestUrl) {
  const recent = dashRecentSegments(text, manifestUrl, { kind: "video", count: 1 });
  return recent.reason ? { reason: recent.reason } : { initUrl: recent.initUrl, segmentUrl: recent.segmentUrls[recent.segmentUrls.length - 1] };
}

function findManifestUrl(value, pattern, depth = 0) {
  if (depth > 6 || value == null) return "";
  if (typeof value === "string") return pattern.test(value) && /^https?:\/\//i.test(value) ? value : "";
  if (typeof value !== "object") return "";
  for (const item of Object.values(value)) {
    const found = findManifestUrl(item, pattern, depth + 1);
    if (found) return found;
  }
  return "";
}

function httpStrings(value, out = [], depth = 0) {
  if (depth > 6 || value == null || out.length >= 12) return out;
  if (typeof value === "string") {
    if (/^https?:\/\//i.test(value)) out.push(value);
    return out;
  }
  if (typeof value === "object") Object.values(value).forEach((item) => httpStrings(item, out, depth + 1));
  return out;
}

// Shape of a play response without leaking URLs: field names and, per URL,
// only its file extension.
function playResponseShape(json) {
  const result = json?.resultObj && typeof json.resultObj === "object" ? json.resultObj : json;
  return {
    resultKeys: Object.keys(result || {}).slice(0, 20),
    streamType: String(result?.streamType || "").slice(0, 40),
    urlExtensions: httpStrings(json).map((url) => {
      try { return (new URL(url).pathname.match(/\.([a-z0-9]{2,5})$/i)?.[1] || "none").toLowerCase(); } catch { return "invalid"; }
    }),
  };
}

function offsetSeconds(fromMs, toMs) {
  return Number.isFinite(fromMs) && Number.isFinite(toMs) ? Math.round((fromMs - toMs) / 10) / 100 : null;
}

function isoDurationSeconds(value) {
  const match = String(value || "").match(/^PT(?:(\d+(?:\.\d+)?)H)?(?:(\d+(?:\.\d+)?)M)?(?:(\d+(?:\.\d+)?)S)?$/i);
  if (!match) return 0;
  return Number(match[1] || 0) * 3600 + Number(match[2] || 0) * 60 + Number(match[3] || 0);
}

async function probeHls(manifestUrl, fetchBuffer) {
  const master = await fetchBuffer(manifestUrl);
  if (!master.ok) return { error: `manifest ${master.status}` };
  const masterText = master.body.toString("utf8");
  const playlistUrl = /#EXT-X-STREAM-INF/i.test(masterText) ? hlsFirstVariantUrl(masterText, manifestUrl) : manifestUrl;
  const playlist = playlistUrl === manifestUrl ? master : await fetchBuffer(playlistUrl);
  if (!playlist.ok) return { error: `playlist ${playlist.status}` };
  const summary = hlsMediaPlaylistSummary(playlist.body.toString("utf8"), playlistUrl);
  const init = summary.mapUrl ? await fetchBuffer(summary.mapUrl) : null;
  const segment = summary.last?.url ? await fetchBuffer(summary.last.url) : null;
  const signals = segment?.ok ? segmentTimingSignals(segment.body) : { error: segment ? `segment ${segment.status}` : "no-segment" };
  const pdtMs = summary.last?.pdtMs ?? null;
  return {
    tags: summary.tags,
    dateRanges: summary.dateRanges,
    segmentCount: summary.segmentCount,
    hasPdt: pdtMs != null,
    init: init?.ok ? segmentTimingSignals(init.body) : null,
    segment: signals,
    prftMinusPdtSeconds: offsetSeconds(signals.prft?.[0]?.utcMs, pdtMs),
    emsgCaptureMinusPdtSeconds: offsetSeconds(signals.emsg?.find((item) => item.captureUtcMs != null)?.captureUtcMs, pdtMs),
  };
}

async function probeDash(contentId, fetchBuffer) {
  const playUrl = `https://f1tv.formula1.com/3.0/R/ENG/WEB_DASH/ALL/CONTENT/PLAY?contentId=${encodeURIComponent(contentId)}`;
  const play = await fetchBuffer(playUrl);
  if (!play.ok) return { error: `play ${play.status}` };
  let json = null;
  try { json = JSON.parse(play.body.toString("utf8")); } catch { return { error: "play-not-json" }; }
  const shape = playResponseShape(json);
  // The DASH manifest URL need not end in .mpd: fall back to the response's
  // main url and accept it only if the body is an MPD.
  const manifestUrl = findManifestUrl(json, /\.mpd(?:[?#]|$)/i)
    || (typeof json?.resultObj?.url === "string" ? json.resultObj.url : "")
    || httpStrings(json)[0]
    || "";
  if (!manifestUrl) return { error: "no-manifest-url", play: shape };
  const manifest = await fetchBuffer(manifestUrl);
  if (!manifest.ok) return { error: `manifest ${manifest.status}`, play: shape };
  const text = manifest.body.toString("utf8");
  if (!/<MPD\b/i.test(text)) return { error: /#EXTM3U/.test(text) ? "play-returned-hls" : "not-mpd", play: shape };
  // Segment wall clock = availabilityStartTime + Period@start + (tfdt − PTO)/timescale.
  const availabilityStartMs = Date.parse(text.match(/availabilityStartTime="([^"]+)"/i)?.[1] || "");
  const periodStartSeconds = isoDurationSeconds(text.match(/<Period\b[^>]*\bstart="([^"]+)"/i)?.[1]);
  const tracks = {};
  for (const kind of ["video", "audio"]) {
    const recent = dashRecentSegments(text, manifestUrl, { kind, count: 4 });
    if (recent.reason) {
      tracks[kind] = { lookup: recent.reason };
      continue;
    }
    const segments = [];
    for (const segmentUrl of recent.segmentUrls) {
      const response = await fetchBuffer(segmentUrl);
      if (!response.ok) {
        segments.push({ error: `segment ${response.status}` });
        continue;
      }
      const signals = segmentTimingSignals(response.body);
      const wallMs = Number.isFinite(availabilityStartMs) && signals.tfdt != null
        ? availabilityStartMs + periodStartSeconds * 1000 + ((signals.tfdt - recent.presentationTimeOffset) / recent.timescale) * 1000
        : null;
      const emsg = signals.emsg || [];
      const id3 = emsg.find((item) => item.captureUtcMs != null);
      // Flat fields only: the debug log truncates objects nested past depth 4.
      segments.push({
        boxes: signals.boxes,
        emsgCount: emsg.length,
        emsgSchemes: emsg.slice(0, 3).map((item) => item.scheme),
        emsgId3: emsg.some((item) => item.id3),
        emsgCaptureUtcMs: id3?.captureUtcMs ?? null,
        emsgPresentationTime: emsg[0]?.presentationTime ?? null,
        emsgTimescale: emsg[0]?.timescale ?? null,
        tfdt: signals.tfdt ?? null,
        prftCount: (signals.prft || []).length,
        captureMinusWallSeconds: id3 && wallMs != null ? offsetSeconds(id3.captureUtcMs, wallMs) : null,
        wallMinusNowSeconds: wallMs != null ? offsetSeconds(wallMs, Date.now()) : null,
      });
    }
    tracks[kind] = { timescale: recent.timescale, segments };
  }
  return {
    play: shape,
    manifest: dashManifestSummary(text),
    tracks,
  };
}

async function probeF1TvTimingSignals({ contentId, hlsManifestUrl, fetchBuffer }) {
  const guard = (promise) => promise.catch((error) => ({ error: String(error?.message || error || "failed").slice(0, 120) }));
  const [hls, dash] = await Promise.all([
    hlsManifestUrl ? guard(probeHls(hlsManifestUrl, fetchBuffer)) : Promise.resolve({ error: "no-hls-manifest" }),
    contentId ? guard(probeDash(contentId, fetchBuffer)) : Promise.resolve({ error: "no-content-id" }),
  ]);
  return { hls, dash };
}

module.exports = {
  probeF1TvTimingSignals,
  segmentTimingSignals,
  hlsMediaPlaylistSummary,
  dashManifestSummary,
  dashLatestVideoSegment,
  dashRecentSegments,
  isoDurationSeconds,
  findManifestUrl,
  playResponseShape,
};
