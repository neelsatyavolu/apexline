// Team radio windows for onboard "radio mode": an onboard stays muted until
// its driver's radio is on air at the video playhead, then unmutes for the clip.
// F1 timing's TeamRadio topic gives each capture's Utc and an mp3 path; the
// clip length comes from the mp3 itself.

// The capture Utc is treated as the start of the transmission. The pre/post
// roll pads for timing jitter between the feed and the video.
const TEAM_RADIO_PREROLL_MS = 500;
const TEAM_RADIO_POSTROLL_MS = 1200;
// Used until the clip has been measured (or if measuring fails).
const TEAM_RADIO_FALLBACK_DURATION_MS = 8000;
// Captures further than this from the playhead are never active.
const TEAM_RADIO_MAX_WINDOW_MS = 60000;
const TEAM_RADIO_DURATION_CACHE_LIMIT = 400;

const MP3_BITRATES_V1_L3 = [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320];
const MP3_BITRATES_V2_L3 = [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160];
const MP3_SAMPLE_RATES = { 3: [44100, 48000, 32000], 2: [22050, 24000, 16000], 0: [11025, 12000, 8000] };

function teamRadioCaptureList(data) {
  const captures = data?.Captures;
  if (Array.isArray(captures)) return captures;
  return captures && typeof captures === "object" ? Object.values(captures) : [];
}

// Every capture seen in the topic's entries, deduplicated by clip path.
function collectTeamRadioCaptures(entries) {
  const byPath = new Map();
  for (const entry of entries || []) {
    for (const capture of teamRadioCaptureList(entry?.data)) {
      const path = String(capture?.Path || "").trim();
      const utcMs = Date.parse(String(capture?.Utc || ""));
      const racingNumber = String(capture?.RacingNumber || "").trim();
      if (!path || !racingNumber || !Number.isFinite(utcMs)) continue;
      byPath.set(path, { path, utcMs, racingNumber });
    }
  }
  return Array.from(byPath.values());
}

function mp3HeaderOffset(buffer) {
  const hasId3 = buffer.length > 10 && buffer.toString("latin1", 0, 3) === "ID3";
  if (!hasId3) return 0;
  return 10 + ((buffer[6] & 0x7f) << 21) + ((buffer[7] & 0x7f) << 14) + ((buffer[8] & 0x7f) << 7) + (buffer[9] & 0x7f);
}

// Sums MPEG Layer III frames, so VBR clips measure correctly. Returns seconds or null.
function mp3DurationSeconds(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 4) return null;
  let offset = mp3HeaderOffset(buffer);
  let seconds = 0;
  let frames = 0;
  while (offset + 4 <= buffer.length) {
    const isSync = buffer[offset] === 0xff && (buffer[offset + 1] & 0xe0) === 0xe0;
    const version = (buffer[offset + 1] >> 3) & 3;
    const layer = (buffer[offset + 1] >> 1) & 3;
    const bitrateIndex = buffer[offset + 2] >> 4;
    const rateIndex = (buffer[offset + 2] >> 2) & 3;
    const sampleRate = MP3_SAMPLE_RATES[version]?.[rateIndex];
    const bitrate = (version === 3 ? MP3_BITRATES_V1_L3 : MP3_BITRATES_V2_L3)[bitrateIndex];
    if (!isSync || layer !== 1 || !sampleRate || !bitrate) {
      offset += 1;
      continue;
    }
    const samples = version === 3 ? 1152 : 576;
    const padding = (buffer[offset + 2] >> 1) & 1;
    const frameLength = Math.floor((samples / 8) * bitrate * 1000 / sampleRate) + padding;
    seconds += samples / sampleRate;
    frames += 1;
    offset += frameLength;
  }
  return frames ? seconds : null;
}

// Racing numbers whose radio window contains nowUtcMs.
function activeTeamRadioNumbers(captures, nowUtcMs, durationMsFor) {
  const active = new Set();
  if (!Number.isFinite(nowUtcMs)) return active;
  for (const capture of captures || []) {
    const sinceStart = nowUtcMs - capture.utcMs;
    if (Math.abs(sinceStart) > TEAM_RADIO_MAX_WINDOW_MS) continue;
    // Asking for the duration ahead of the window gives the clip time to be measured.
    const durationMs = durationMsFor(capture) ?? TEAM_RADIO_FALLBACK_DURATION_MS;
    if (sinceStart >= -TEAM_RADIO_PREROLL_MS && sinceStart <= durationMs + TEAM_RADIO_POSTROLL_MS) active.add(capture.racingNumber);
  }
  return active;
}

// fetchClip(url) resolves to a Buffer. Durations are measured once per clip
// in the background; until then the fallback duration applies.
function createTeamRadioTracker({ fetchClip, onError } = {}) {
  const durations = new Map();
  function durationMsFor(url) {
    if (durations.has(url)) return durations.get(url);
    if (durations.size >= TEAM_RADIO_DURATION_CACHE_LIMIT) durations.delete(durations.keys().next().value);
    durations.set(url, null);
    Promise.resolve()
      .then(() => fetchClip(url))
      .then((buffer) => {
        const seconds = mp3DurationSeconds(buffer);
        durations.set(url, seconds == null ? null : Math.round(seconds * 1000));
      })
      .catch((error) => onError?.(error));
    return null;
  }
  // clipBaseUrl is the session's static folder (ends with "/").
  function activeNumbers(entries, nowUtcMs, clipBaseUrl) {
    if (!clipBaseUrl) return new Set();
    return activeTeamRadioNumbers(collectTeamRadioCaptures(entries), nowUtcMs, (capture) => durationMsFor(clipBaseUrl + capture.path));
  }
  return { activeNumbers };
}

module.exports = {
  collectTeamRadioCaptures,
  mp3DurationSeconds,
  activeTeamRadioNumbers,
  createTeamRadioTracker,
  TEAM_RADIO_FALLBACK_DURATION_MS,
};
