const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const Babel = require("@babel/standalone");

const root = path.resolve(__dirname, "..");

function loadPitWallData() {
  const code = fs.readFileSync(path.join(root, "ui_kits/pitwall/data.js"), "utf8");
  const sandbox = { window: {} };
  vm.createContext(sandbox);
  vm.runInContext(code, sandbox, { filename: "ui_kits/pitwall/data.js" });
  return sandbox.window.PW_DATA;
}

const data = loadPitWallData();
const expectedCodes = [
  "VER", "HAD", "RUS", "ANT", "LEC", "HAM", "NOR", "PIA", "STR", "ALO", "GAS",
  "COL", "ALB", "SAI", "LAW", "LIN", "HUL", "BOR", "OCO", "BEA", "PER", "BOT",
];
const expectedRoster = {
  VER: ["Max Verstappen", "Red Bull Racing", 3],
  HAD: ["Isack Hadjar", "Red Bull Racing", 6],
  RUS: ["George Russell", "Mercedes", 63],
  ANT: ["Kimi Antonelli", "Mercedes", 12],
  LEC: ["Charles Leclerc", "Ferrari", 16],
  HAM: ["Lewis Hamilton", "Ferrari", 44],
  NOR: ["Lando Norris", "McLaren", 1],
  PIA: ["Oscar Piastri", "McLaren", 81],
  STR: ["Lance Stroll", "Aston Martin", 18],
  ALO: ["Fernando Alonso", "Aston Martin", 14],
  GAS: ["Pierre Gasly", "Alpine", 10],
  COL: ["Franco Colapinto", "Alpine", 43],
  ALB: ["Alexander Albon", "Williams", 23],
  SAI: ["Carlos Sainz", "Williams", 55],
  LAW: ["Liam Lawson", "Racing Bulls", 30],
  LIN: ["Arvid Lindblad", "Racing Bulls", 41],
  HUL: ["Nico Hulkenberg", "Audi", 27],
  BOR: ["Gabriel Bortoleto", "Audi", 5],
  OCO: ["Esteban Ocon", "Haas F1 Team", 31],
  BEA: ["Oliver Bearman", "Haas F1 Team", 87],
  PER: ["Sergio Perez", "Cadillac", 11],
  BOT: ["Valtteri Bottas", "Cadillac", 77],
};
const expectedConstructors = [
  "McLaren", "Ferrari", "Red Bull Racing", "Mercedes", "Williams", "Aston Martin",
  "Racing Bulls", "Alpine", "Haas F1 Team", "Audi", "Cadillac",
];

assert.equal(data.drivers.length, expectedCodes.length, "2026 roster should have 22 drivers");
assert.deepEqual(Array.from(data.drivers, (driver) => driver.code).sort(), expectedCodes.slice().sort());
assert.equal(data.byCode.TSU, undefined, "Tsunoda should not be in the 2026 roster");
assert.equal(data.byCode.HAD.team, "Red Bull Racing");
assert.equal(data.byCode.LIN.team, "Racing Bulls");
assert.equal(data.source, "seed", "Static seed data should be clearly labelled");
assert.equal(data.timing.length, 0, "Seed data should not include fake live timing");
assert.equal(data.standings.length, 0, "Seed data should not include fake driver standings");
assert.equal(data.schedule.length, 0, "Seed data should not include a fake calendar");
assert.equal(data.news.length, 0, "Seed data should not include fake news");
assert.deepEqual(Array.from(data.constructors, (constructor) => constructor.name).sort(), expectedConstructors.slice().sort());

for (const driver of data.drivers) {
  const [name, team, num] = expectedRoster[driver.code];
  assert.equal(driver.name, name, `${driver.code} should have the official 2026 name`);
  assert.equal(driver.team, team, `${driver.code} should have the official 2026 team`);
  assert.equal(driver.num, num, `${driver.code} should have the official 2026 number`);
  assert.match(driver.image, /^data:image\/svg\+xml,/, `${driver.code} needs a packaged portrait fallback for production`);
  const portraitSvg = decodeURIComponent(driver.image.replace(/^data:image\/svg\+xml,/, ""));
  assert.match(portraitSvg, /viewBox="0 0 96 96"/, `${driver.code} packaged portrait should be cropped for small avatars`);
  assert.doesNotMatch(portraitSvg, /<text\b/, `${driver.code} packaged portrait should not include tiny baked-in labels`);
  assert.match(driver.remoteImage, /^https:\/\/media\.formula1\.com\//, `${driver.code} should retain the official remote image URL`);
  assert.match(driver.teamLogo, /^https:\/\/media\.formula1\.com\//, `${driver.code} needs an official team logo`);
}

for (const constructor of data.constructors) {
  assert.match(constructor.logo, /^https:\/\/media\.formula1\.com\//, `${constructor.name} needs an official logo`);
}

const bundle = fs.readFileSync(path.join(root, "_ds_bundle.js"), "utf8");
assert.match(bundle, /pw-driver__avatar/, "DriverTag should render driver image avatars");
assert.match(bundle, /avatarSrc/, "DriverTag should resolve image src from roster data");
assert.match(bundle, /src: avatarSrc,\s*size: "sm"/, "DriverTag should keep the original compact standings avatar size");

const packageJson = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
const packageScript = fs.readFileSync(path.join(root, "scripts/package-macos.cjs"), "utf8");
const openF1ReplayProbe = fs.readFileSync(path.join(root, "scripts/pitwall-openf1-replay-probe.cjs"), "utf8");
const f1TimingReplayProbePath = path.join(root, "scripts/pitwall-f1timing-replay-probe.cjs");
const f1TimingReplayProbe = fs.existsSync(f1TimingReplayProbePath) ? fs.readFileSync(f1TimingReplayProbePath, "utf8") : "";
assert.equal(packageJson.main, "electron/main.cjs");
assert.ok(packageJson.scripts.build, "Renderer should have a build script");
assert.match(packageJson.scripts.start, /electron \./, "Start should launch Electron");
assert.match(packageJson.scripts.start, /node scripts\/build-renderer\.cjs/, "Start should build without depending on a nested npm executable");
assert.match(packageJson.scripts["package:mac:vmp"], /PITWALL_CASTLABS_VMP=1/, "macOS package scripts should include an opt-in CastLabs VMP signing path");
assert.match(packageJson.scripts["probe:openf1:monaco"], /pitwall-openf1-replay-probe\.cjs/, "Repo should expose a non-UI OpenF1 Monaco replay probe");
assert.match(packageJson.scripts["probe:f1timing:monaco"] || "", /pitwall-f1timing-replay-probe\.cjs/, "Repo should expose a non-UI Formula 1 livetiming Monaco replay probe");
assert.ok(fs.existsSync(f1TimingReplayProbePath), "Formula 1 livetiming replay probe should exist for validating rich replay timing");
assert.match(f1TimingReplayProbe, /livetiming\.formula1\.com/, "Formula 1 replay probe should fetch the official F1 livetiming archive directly");
assert.match(f1TimingReplayProbe, /CarData\.z\.jsonStream/, "Formula 1 replay probe should decode compressed telemetry feed data");
assert.match(f1TimingReplayProbe, /TimingData\.jsonStream/, "Formula 1 replay probe should parse official timing rows");
assert.match(f1TimingReplayProbe, /richRows/, "Formula 1 replay probe should report sanitized richness counts for last/best/sector/tyre/telemetry rows");
assert.match(openF1ReplayProbe, /EMAIL[\s\S]*PASSWORD/, "OpenF1 replay probe should read local .env credentials without printing them");
assert.match(openF1ReplayProbe, /Authorization: `Bearer \$\{accessToken\}`/, "OpenF1 replay probe should use authenticated bearer requests");
assert.match(openF1ReplayProbe, /requestTimes\.length < 60/, "OpenF1 replay probe should enforce the 60 requests per minute cap");
assert.match(openF1ReplayProbe, /parseTiming\(drivers, positions, intervals/, "OpenF1 replay probe should use the same timing parser as the app");
assert.match(packageScript, /const appPath = baseOut/, "macOS packaging should always rebuild dist/PitWall.app as the current app");
assert.match(packageScript, /Snapshot \$\{snapshotPath\}/, "macOS packaging should also keep a timestamped snapshot path");
assert.ok(packageJson.dependencies.react, "React should be a local dependency");
assert.ok(packageJson.dependencies["hls.js"], "HLS playback should use hls.js");
assert.ok(packageJson.dependencies["shaka-player"], "Protected DASH/Widevine playback should use Shaka Player");
assert.match(packageJson.devDependencies.electron, /castlabs\/electron-releases#v[0-9.]+\+wvcus/, "PitWall should use CastLabs Electron ECS for Widevine-capable playback");
assert.ok(fs.existsSync(path.join(root, "electron/main.cjs")), "Electron main process should exist");
assert.ok(fs.existsSync(path.join(root, "electron/preload.cjs")), "Electron preload should exist");
assert.ok(fs.existsSync(path.join(root, "scripts/build-renderer.cjs")), "Renderer build script should exist");
assert.ok(fs.existsSync(path.join(root, "assets/app-icon.icns")), "macOS package should have a custom PitWall app icon");
const packageMac = fs.readFileSync(path.join(root, "scripts/package-macos.cjs"), "utf8");
assert.match(packageMac, /repairMacFrameworkSymlinks/, "macOS package step should repair Electron framework symlinks when CastLabs assets need them");
assert.match(packageMac, /Versions\/Current/, "macOS framework repair should recreate standard Current symlinks");
assert.match(packageMac, /PITWALL_CASTLABS_VMP/, "macOS package step should support opt-in CastLabs VMP signing");
assert.match(packageMac, /castlabs_evs\.vmp/, "CastLabs VMP signing should use the official EVS module");
assert.match(packageMac, /"sign-pkg"[\s\S]*"verify-pkg"/, "CastLabs VMP package signing should verify the signature after signing");
assert.match(packageMac, /signWithCastLabsVmp\(appPath\)[\s\S]*codesign/, "macOS package step should run VMP signing before macOS codesign");
assert.match(packageMac, /CFBundleIconFile", "app-icon"/, "macOS package step should use the custom PitWall app icon");
const mainProcess = fs.readFileSync(path.join(root, "electron/main.cjs"), "utf8");
const preload = fs.readFileSync(path.join(root, "electron/preload.cjs"), "utf8");

function extractNamedFunction(source, name) {
  const start = source.indexOf(`function ${name}`);
  assert.notEqual(start, -1, `${name} should exist`);
  const bodyStart = source.indexOf("{", start);
  let depth = 0;
  for (let index = bodyStart; index < source.length; index += 1) {
    const char = source[index];
    if (char === "{") depth += 1;
    if (char === "}") depth -= 1;
    if (depth === 0) return source.slice(start, index + 1);
  }
  throw new Error(`Could not extract ${name}`);
}

const parseWeather = vm.runInNewContext(`(${extractNamedFunction(mainProcess, "parseWeather")})`);
assert.deepEqual({ ...parseWeather([]) }, { air: "", track: "", cond: "", rain: "", wind: "", humidity: "" }, "Empty OpenF1 weather rows should not be reported as dry");
assert.equal(parseWeather([{ rainfall: 0 }]).cond, "Dry", "Weather rows without rainfall should still report dry track conditions");

const timingSandbox = vm.runInNewContext(`(() => {
  ${[
    "finiteNumber",
    "latestBy",
    "normalizeCompound",
    "groupRowsByDriverNumber",
    "normalizeStint",
    "stintsByDriverNumber",
    "latestStintForDriver",
    "tyreAgeFromStint",
    "pitCountsByDriverNumber",
    "lapDurationSeconds",
    "formatLapDuration",
    "bestLapsByDriverNumber",
    "clampPercent",
    "latestCarDataByDriverNumber",
    "timingSegmentTone",
    "miniSectorSegments",
    "parseTiming",
    "latestLapsByDriverNumber",
    "replayRowDateMs",
  ].map((name) => extractNamedFunction(mainProcess, name)).join("\n")}
  return { parseTiming, replayRowDateMs };
})()`);
assert.equal(timingSandbox.replayRowDateMs({ date_start: "2026-06-06T14:21:00Z" }), Date.parse("2026-06-06T14:21:00Z"), "Replay timing should align OpenF1 lap rows by date_start");
const replayTimingRows = timingSandbox.parseTiming(
  [{ driver_number: 16, name_acronym: "LEC" }],
  [{ driver_number: 16, position: 1 }],
  [],
  [],
  [{ driver_number: 16, compound: "SOFT", lap_start: 1, lap_end: 3, tyre_age_at_start: 0, stint_number: 1 }],
  [],
  [{
    driver_number: 16,
    lap_number: 3,
    duration_sector_1: 25,
    duration_sector_2: 30,
    duration_sector_3: 20,
    segments_sector_1: [2049, 2050, 2052],
    segments_sector_2: [2048, 2048],
    segments_sector_3: [2068],
  }],
);
assert.equal(replayTimingRows[0].last, "1:15.000", "Replay timing should derive last lap from OpenF1 sector durations");
assert.equal(replayTimingRows[0].best, "1:15.000", "Replay timing should derive best lap from OpenF1 sector durations");
assert.equal(replayTimingRows[0].comp, "soft", "Replay timing should preserve tyre compound from OpenF1 stints");

const f1TimingClockSandbox = vm.runInNewContext(`(() => {
  ${[
    "finiteNumber",
    "mergeF1TimingDelta",
    "f1TimingStateAt",
    "f1TimingLatestEntryAt",
    "f1TimingArchiveStartUtcMs",
    "f1TimingVideoStartArchiveSeconds",
    "f1TimingSessionStartSeconds",
    "f1TimingValue",
    "f1TimingDurationSeconds",
    "formatF1TimingDuration",
    "parseF1TimingSessionClock",
  ].map((name) => extractNamedFunction(mainProcess, name)).join("\n")}
  return { f1TimingSessionStartSeconds, f1TimingVideoStartArchiveSeconds, parseF1TimingSessionClock };
})()`);
const sparseClockSession = {
  clockEntries: [
    { seconds: 42.694, data: { Remaining: "00:18:00", Extrapolating: false } },
    { seconds: 854.698, data: { Remaining: "00:17:59", Extrapolating: true, Utc: "2026-06-06T14:00:01.007Z" } },
  ],
  sessionStatusEntries: [
    { seconds: 6.013, data: { Status: "Inactive", Started: "Inactive" } },
    { seconds: 853.735, data: { Status: "Started", Started: "Started" } },
  ],
};
assert.equal(f1TimingClockSandbox.f1TimingSessionStartSeconds(sparseClockSession), 853.735, "F1 timing should use the first Started status as replay session zero");
assert.equal(f1TimingClockSandbox.parseF1TimingSessionClock(sparseClockSession, 1693.735).remaining, "00:04:00", "Sparse F1 ExtrapolatedClock entries should count down between archive packets");
assert.equal(Math.round(f1TimingClockSandbox.f1TimingVideoStartArchiveSeconds(sparseClockSession, { videoStartUtc: "2026-06-06T13:55:46.309Z" })), 600, "Replay timing should convert F1 TV program-date-time into archive elapsed seconds");
const f1TimingGapSandbox = vm.runInNewContext(`(() => {
  ${[
    "finiteNumber",
    "fillF1TimingQualifyingDeltas",
  ].map((name) => extractNamedFunction(mainProcess, name)).join("\n")}
  return { fillF1TimingQualifyingDeltas };
})()`);
const f1QualifyingGapRows = f1TimingGapSandbox.fillF1TimingQualifyingDeltas([
  { pos: 1, code: "ANT", bestLapDuration: 72.704, gap: "LEADER", interval: "—" },
  { pos: 2, code: "LEC", bestLapDuration: 72.774, gap: "—", interval: "—" },
  { pos: 3, code: "PIA", bestLapDuration: 73.010, gap: "—", interval: "—" },
]);
assert.equal(f1QualifyingGapRows[1].gap, "+0.070", "Qualifying timing should compute gap to leader from best laps when F1 omits race gaps");
assert.equal(f1QualifyingGapRows[2].interval, "+0.236", "Qualifying timing should compute interval to the car ahead from best laps");
assert.equal(replayTimingRows[0].age, 3, "Replay timing should preserve tyre age from OpenF1 stints");
assert.deepEqual(replayTimingRows[0].sectors.s1, ["green", "yellow", "yellow"], "Replay timing should keep OpenF1 mini-sector segment tones");
assert.match(mainProcess, /OPENF1_REQUEST_INTERVAL_MS/, "OpenF1 requests should be paced below the public API rate limit");
assert.match(mainProcess, /function requestOpenF1Json/, "OpenF1 JSON requests should use a dedicated retrying queue");
assert.match(mainProcess, /OPENF1_TOKEN_URL = "https:\/\/api\.openf1\.org\/token"/, "OpenF1 auth should use the official token endpoint");
assert.match(mainProcess, /Authorization: `Bearer \$\{token\}`/, "OpenF1 API calls should attach the bearer token when credentials are configured");
assert.match(mainProcess, /env\.EMAIL/, "OpenF1 credentials should be read from the local .env EMAIL fallback for development");
assert.match(mainProcess, /OPENF1_SECOND_LIMIT = 6/, "OpenF1 request pacing should respect the documented 6 requests per second cap");
assert.match(mainProcess, /OPENF1_MINUTE_LIMIT = 60/, "OpenF1 request pacing should respect the documented 60 requests per minute cap");
assert.doesNotMatch(mainProcess, /Promise\.all\(\[\s*requestJson\(openF1ApiUrl\("drivers"[\s\S]*requestJson\(openF1ApiUrl\("car_data"/, "Replay timing should not fetch all OpenF1 endpoints in one parallel burst");

const analyticsSandbox = vm.runInNewContext(`(() => {
  ${[
    "teamAbbr",
    "parseOpenDrivers",
    "finiteNumber",
    "numberList",
    "positiveDuration",
    "sessionResultDuration",
    "sessionResultGap",
    "average",
    "minMetric",
    "maxLapSpeed",
    "lapDurationSlope",
    "analyticsDriverCode",
    "summarizeAnalyticsDrivers",
  ].map((name) => extractNamedFunction(mainProcess, name)).join("\n")}
  return { summarizeAnalyticsDrivers };
})()`);
const qualifyingSummaryRows = analyticsSandbox.summarizeAnalyticsDrivers({
  drivers: [
    { driver_number: 44, name_acronym: "HAM", full_name: "Lewis Hamilton", team_name: "Ferrari" },
    { driver_number: 4, name_acronym: "NOR", full_name: "Lando Norris", team_name: "McLaren" },
  ],
  laps: [],
  sessionResult: [
    { driver_number: 44, position: 1, duration: [80.5, 78.2, 79.1], gap_to_leader: [0.3, 0.1, 0], number_of_laps: 18 },
    { driver_number: 4, position: 2, duration: [81.9, 79.4, null], gap_to_leader: [0.1, 0.7, null], number_of_laps: 15 },
  ],
}, []);
assert.deepEqual(Array.from(qualifyingSummaryRows, (row) => row.code), ["HAM", "NOR"], "Analytics summary should preserve official session-result order");
assert.equal(qualifyingSummaryRows[0].resultDuration, 79.1, "Qualifying result duration should use the latest completed segment, not the fastest earlier segment");
assert.equal(qualifyingSummaryRows[0].gapToLeader, 0, "Qualifying gap should use the latest completed segment");
assert.equal(qualifyingSummaryRows[0].laps, 18, "Session result lap counts should populate recap rows even when lap rows are sparse");

const shouldRetryDailyCopilotInsights = vm.runInNewContext(`(${extractNamedFunction(mainProcess, "shouldRetryDailyCopilotInsights")})`);
const dailyRetryToday = "2026-06-07";
const dailyRetryNow = Date.parse("2026-06-07T12:15:00.000Z");
assert.equal(shouldRetryDailyCopilotInsights({
  status: "failed",
  attemptedOn: dailyRetryToday,
  updatedAt: "2026-06-07T12:00:00.000Z",
}, dailyRetryToday, dailyRetryNow, 1000 * 60 * 10), true, "Failed daily Copilot insight cache should retry after cooldown instead of blocking the whole day");
assert.equal(shouldRetryDailyCopilotInsights({
  status: "failed",
  attemptedOn: dailyRetryToday,
  updatedAt: "2026-06-07T12:10:01.000Z",
}, dailyRetryToday, dailyRetryNow, 1000 * 60 * 10), false, "Recent daily Copilot insight failures should wait for the retry cooldown");
assert.equal(shouldRetryDailyCopilotInsights({
  status: "pending",
  attemptedOn: dailyRetryToday,
  updatedAt: "2026-06-07T12:00:00.000Z",
}, dailyRetryToday, dailyRetryNow, 1000 * 60 * 10), false, "Pending daily Copilot insight calculations should not start duplicate retries");

assert.match(mainProcess, /pitwall:f1tv:login/, "Electron main should expose F1 TV login IPC");
assert.match(mainProcess, /F1TV_HOME_URL = "https:\/\/f1tv\.formula1\.com\/"/, "Electron should keep F1 TV home URL separate from account login");
assert.match(mainProcess, /F1TV_LOGIN_URL = "https:\/\/account\.formula1\.com\/#\/en\/login/, "F1 TV connect should open the Formula 1 account login page directly");
assert.match(mainProcess, /F1TV_AUTH_URL = "https:\/\/api\.formula1\.com\/v2\/account\/subscriber\/authenticate\/by-password"/, "F1 TV credential sign-in should request a subscription token");
assert.match(mainProcess, /"f1tv-token"/, "F1 TV subscription token should be stored separately in Keychain");
assert.match(mainProcess, /subscriptionToken/, "F1 TV credential sign-in should parse subscriptionToken from auth response when the legacy endpoint works");
assert.match(mainProcess, /entitlement_token/, "F1 TV browser sign-in should detect the playback entitlement token cookie");
assert.match(mainProcess, /entitlementToken/, "F1 TV playback requests should include the entitlement token header");
assert.match(mainProcess, /ascendonToken/, "F1 TV playback requests should include the Ascendon token header used by the official web player");
assert.match(mainProcess, /recentF1TvRequestHeader/, "F1 TV playback requests should reuse observed official web-player request headers in memory");
assert.match(mainProcess, /x-f1-device-info/, "F1 TV playback requests should include the device-info header used by the official web player");
assert.match(mainProcess, /correlationid/, "F1 TV playback requests should include the official correlation id header shape");
assert.match(mainProcess, /sessionid/, "F1 TV playback requests should include the official session id header shape");
assert.match(mainProcess, /f1TvEntitlementTokenFromCookies/, "F1 TV status should treat the entitlement-token cookie as playback-ready auth");
assert.match(mainProcess, /f1TvPlaybackHeaders/, "F1 TV resolver should build volatile playback headers for clean player requests");
assert.match(mainProcess, /headers:\s*\{[\s\S]*playbackHeaders/, "F1 TV direct-resolved streams should carry playback headers in memory");
assert.match(mainProcess, /writePitWallDebugLog/, "Main process should write sanitized PitWall debug logs");
assert.match(mainProcess, /pitwall:debug:log/, "Main process should expose debug logging IPC");
assert.match(preload, /debug:\s*\{[\s\S]*log:/, "Preload should expose debug logging to the renderer");
assert.match(mainProcess, /pitwall:f1tv:mediaFetch/, "Main process should expose restricted F1 TV media fetch IPC");
assert.match(preload, /mediaFetch:/, "Preload should expose F1 TV media fetch to Shaka networking");
assert.match(mainProcess, /f1prodlive\.akamaized\.net/, "F1 TV media bridge should allow signed F1 CDN manifests and segments");
assert.match(mainProcess, /f1tv\.media-fetch-blocked/, "F1 TV media bridge should log blocked non-F1 media hosts");
assert.match(mainProcess, /f1TvCookieHeaderForUrl/, "F1 TV media bridge should attach matching browser-session cookies to scoped F1 TV media/license requests");
assert.match(mainProcess, /headers\.Origin = "https:\/\/f1tv\.formula1\.com"/, "F1 TV media bridge should send the F1 TV origin for DRM license requests");
assert.match(mainProcess, /headers\.Referer = F1TV_HOME_URL/, "F1 TV media bridge should send the F1 TV referer for DRM license requests");
assert.match(mainProcess, /headers\.Cookie = String\(options\.cookieHeader\)/, "F1 TV media bridge should send scoped cookies without exposing values to the renderer");
assert.match(mainProcess, /headers\["Content-Type"\] = "application\/octet-stream"/, "F1 TV media bridge should send binary content type for Widevine license requests");
assert.match(mainProcess, /sentHeaderNames/, "F1 TV media diagnostics should log final sent header names");
assert.match(mainProcess, /cookieHeaderIncluded/, "F1 TV media diagnostics should report whether session cookies were included without logging values");
assert.match(mainProcess, /f1TvLicenseErrorHint/, "F1 TV media diagnostics should extract non-secret license rejection messages");
assert.match(mainProcess, /licenseErrorHint/, "F1 TV media diagnostics should surface rejected license hints without exposing tokens");
assert.match(mainProcess, /findF1TvContentCandidatesInPage/, "F1 TV resolver should collect multiple search-result content candidates");
assert.match(mainProcess, /candidatePlay\.manifests/, "F1 TV resolver should validate search candidates against CONTENT/PLAY manifests");
assert.match(mainProcess, /channelId=.*player=player_tm/, "F1 TV resolver should request channel-specific HLS playback metadata like the official web player");
assert.match(mainProcess, /premium-channel-list/, "F1 TV resolver should discover onboard/feed channel IDs from the PREMIUM metadata endpoint");
assert.match(mainProcess, /FEATURESTEERING\/PREMIUM\/5/, "F1 TV resolver should discover feed channel IDs through the official feature-steering endpoint");
assert.match(mainProcess, /techPack=F1_FER/, "F1 TV resolver should request the same PSEUDO-VOD channel metadata shape as the web player");
assert.match(mainProcess, /const versions = \["3\.0", "2\.0"\]/, "F1 TV resolver should prefer the official 3.0 playback API route");
assert.match(mainProcess, /const clients = \["WEB_HLS", "WEB_DASH", "BIG_SCREEN_DASH", "BIG_SCREEN_HLS"\]/, "F1 TV resolver should prefer the official WEB_HLS channel playback route");
assert.match(mainProcess, /manifestScore/, "F1 TV resolver should prefer playable CMAF/HLS manifests over DASH when F1 TV provides them");
assert.match(mainProcess, /\.filter\(\(value\) => isF1TvManifestUrl\(value\)\)/, "F1 TV resolver should not treat license URLs as playable manifests");
assert.match(mainProcess, /pitwall:f1tv:browse/, "Electron main should expose F1 TV content browser IPC");
assert.match(mainProcess, /pitwall:f1tv:browseSession/, "Electron main should expose F1 TV session browser IPC");
assert.match(mainProcess, /pitwall:f1tv:library/, "Electron main should expose F1 TV library IPC");
assert.match(mainProcess, /F1TV_LIBRARY_CACHE_FILE/, "F1 TV library should persist a season cache so Live Racing opens quickly");
assert.match(mainProcess, /F1TV_LIBRARY_CACHE_MS/, "F1 TV library cache should have an explicit TTL");
assert.match(mainProcess, /forceRefresh/, "F1 TV library IPC should support bypassing the cache for manual reloads");
assert.match(mainProcess, /filter_MeetingKey/, "F1 TV session browser should open meeting-filtered replay search pages");
assert.match(mainProcess, /pitwall:f1tv:streams/, "Electron main should expose captured F1 TV stream IPC");
assert.match(mainProcess, /pitwall:f1tv:resolveContent/, "Electron main should expose hidden F1 TV content resolution IPC");
assert.match(mainProcess, /PITWALL_F1TV_DIAG_URL/, "Electron should support a sanitized F1 TV resolver diagnostic mode for production-profile testing");
assert.match(mainProcess, /PITWALL_F1TV_DIAG_SESSION/, "F1 TV diagnostics should support reproducing picker session-kind resolution");
assert.match(mainProcess, /PITWALL_F1TV_LIBRARY_DIAG/, "Electron should support a sanitized F1 TV library diagnostic mode");
assert.match(mainProcess, /PITWALL_F1TV_DIAG_FALLBACK/, "F1 TV diagnostics should allow an explicit slow hidden playback fallback for learning request shape");
assert.match(mainProcess, /PITWALL_F1TV_MEDIA_DIAG/, "F1 TV diagnostics should fetch the resolved manifest through the media bridge for playback debugging");
assert.match(mainProcess, /f1tv\.media-diagnostic/, "F1 TV media diagnostics should write sanitized manifest fetch status");
assert.match(mainProcess, /PITWALL_F1TV_AUTOPLAY/, "Electron should support debug startup auto-loading for F1 TV playback repros");
assert.match(mainProcess, /PITWALL_F1TV_PROBE_DIAG/, "Electron should support a sanitized F1 TV auth probe diagnostic mode for renderer status debugging");
assert.match(mainProcess, /sanitizeF1TvDiagnosticResult/, "F1 TV diagnostics should avoid printing volatile auth headers or manifest URLs");
assert.match(mainProcess, /recordF1TvDiagnosticRequest/, "F1 TV diagnostics should collect sanitized request samples when stream discovery fails");
assert.match(mainProcess, /requestSamples/, "F1 TV diagnostics should report sanitized network sample metadata");
assert.match(mainProcess, /fullPathHint/, "F1 TV diagnostics should keep sanitized full API path hints for comparing official player endpoints");
assert.match(mainProcess, /directF1TvPlayEndpoint/, "F1 TV resolver should try direct authenticated CONTENT/PLAY endpoints instead of waiting on visible website playback");
assert.match(mainProcess, /directF1TvLicenseEndpoints/, "F1 TV resolver should prefer first-party CONTENT/LA Widevine license endpoints");
assert.match(mainProcess, /CONTENT\/LA\/widevine/, "F1 TV license endpoint should use the official Widevine license route");
assert.match(mainProcess, /isFirstPartyF1TvWidevineLicenseUrl/, "F1 TV resolver should ignore CDN URLs that look license-like but are not the Widevine LA endpoint");
assert.match(mainProcess, /3\.0\/R\/ENG\/WEB_HLS/, "F1 TV license endpoint order should try the browser HLS Widevine route first");
assert.match(mainProcess, /preferredLicenseUrl/, "F1 TV resolver should preserve the first-party license endpoint over CDN manifest license hints");
assert.match(mainProcess, /licenseHost/, "F1 TV resolver diagnostics should report sanitized license host hints");
assert.match(mainProcess, /requestType/, "F1 TV media diagnostics should include the Shaka request type");
assert.match(mainProcess, /playEndpointAttempts/, "F1 TV diagnostics should report sanitized direct play endpoint attempts");
assert.match(mainProcess, /errorDescription/, "F1 TV diagnostics should include non-secret direct endpoint error descriptions");
assert.match(mainProcess, /directPlay\.manifests\?\.length[\s\S]*skipHiddenPlaybackFallback/, "F1 TV resolver should skip the slow hidden website playback fallback when direct play metadata already has manifests");
assert.match(mainProcess, /resolverLoadUrl[\s\S]*directContentId[\s\S]*F1TV_HOME_URL/, "F1 TV resolver should load a lightweight same-origin shell for direct content IDs instead of the full detail page");
assert.match(mainProcess, /allowHiddenPlaybackFallback = Boolean\(options\.allowHiddenPlaybackFallback\)/, "F1 TV resolver should make slow hidden website playback an explicit diagnostic option");
assert.match(mainProcess, /if \(!skipHiddenPlaybackFallback && allowHiddenPlaybackFallback\)/, "F1 TV resolver should not run the hidden website playback fallback during normal clean stream resolution");
assert.match(mainProcess, /PITWALL_USER_DATA/, "Electron should pin a stable PitWall userData folder across dev and packaged builds");
assert.match(mainProcess, /app\.setPath\("userData"/, "Electron should use the same F1 TV browser profile for packaged and local app launches");
assert.match(mainProcess, /PITWALL_START_SCREEN/, "Electron should allow launching directly into a screen for UI verification");
assert.match(mainProcess, /PITWALL_WEEKEND_ROUND/, "Electron should allow launching Weekend directly into a selected race round");
assert.match(mainProcess, /PITWALL_WEEKEND_SESSION/, "Electron should allow launching Weekend directly into a selected recap session");
assert.match(mainProcess, /PITWALL_WEEKEND_RECAP_DIAG/, "Packaged app should expose an offscreen Weekend Recap diagnostic for production UI verification");
assert.match(mainProcess, /loadWeekendRecapDom[\s\S]*catch \(error\)[\s\S]*weekendRecapSummary/, "Weekend Recap diagnostic should record per-session UI failures instead of hanging");
assert.match(mainProcess, /diagnosticWindowRunActive[\s\S]*window-all-closed/, "Offscreen Weekend diagnostics should keep the static server alive while hidden windows cycle");
assert.match(mainProcess, /PITWALL_ANALYTICS_SESSION_DIAG/, "Packaged app should expose an analytics-session diagnostic for production data verification");
assert.match(mainProcess, /pitwall:f1tv:probeStatus/, "Electron main should expose a deep F1 TV auth probe for storage-backed sessions");
assert.match(mainProcess, /storageAuthKeys/, "F1 TV auth status should include local/session/IndexedDB auth-key evidence without exposing values");
assert.match(mainProcess, /IGNORED_F1TV_COOKIE_PATTERN/, "F1 TV auth should ignore analytics/consent cookies such as ABTastySession");
assert.match(mainProcess, /tokenLike/, "F1 TV storage auth detection should require token-like values, not just broad key names");
assert.doesNotMatch(mainProcess, /browserAuthState\.indexedDbAuthKeys/, "F1 TV status should not treat IndexedDB store names as authentication proof");
assert.match(mainProcess, /authenticated:\s*tokenReady,/, "F1 TV playback readiness should require a subscription token, not only a weak browser cookie");
assert.match(mainProcess, /browserSession,/, "F1 TV status should still expose browser-session evidence separately from playback readiness");
assert.match(mainProcess, /status\.(?:authenticated|browserSession)[\s\S]*loginWindow\.close/, "F1 TV login browser should close after either playback-token auth or browser-session auth is detected");
assert.doesNotMatch(mainProcess, /const status = await getF1TvStatus\(\);\s*if \(!status\.authenticated\) throw new Error\("Sign in with F1 TV before resolving protected streams\."\);/, "Clean F1 TV resolver should not reject before trying the hidden authenticated page");
assert.match(mainProcess, /webRequest\.onBeforeRequest/, "F1 TV browser should capture authenticated media requests");
assert.match(mainProcess, /\.m3u8/, "F1 TV stream capture should look for HLS manifests");
assert.match(mainProcess, /\.mpd/, "F1 TV stream capture should look for DASH manifests");
assert.match(mainProcess, /licenseUrl/, "F1 TV resolver should return scoped DRM license metadata");
assert.match(mainProcess, /offscreen: true/, "F1 TV content resolver should use a hidden/offscreen browser instead of showing the website");
assert.match(mainProcess, /backgroundThrottling: false/, "Hidden F1 TV resolver should not throttle playback initialization");
assert.match(mainProcess, /webRequest\.onHeadersReceived/, "F1 TV stream capture should detect manifest responses by content type, not only URL suffixes");
assert.match(mainProcess, /dash\+xml|mpegurl/i, "F1 TV stream capture should recognize DASH/HLS manifest content types");
assert.match(mainProcess, /MultiViewer\/WidevineCdm/, "Widevine discovery should reuse the locally installed MultiViewer CDM when available");
assert.match(mainProcess, /components\.whenReady/, "CastLabs Electron components should be awaited before opening playback windows");
assert.match(mainProcess, /electron\.components-ready/, "Electron component status should be logged for Widevine diagnostics");
assert.match(mainProcess, /Electron components/, "CDM status should report CastLabs component-backed Widevine when available");
assert.match(mainProcess, /mediaKeySystem/, "Electron should grant DRM media key system permission for F1 TV playback");
assert.match(mainProcess, /installF1TvPlaybackPermissions/, "Electron should install F1 TV playback permissions before opening players");
assert.match(mainProcess, /session\.defaultSession\.cookies/, "F1 TV login should persist browser cookies in Electron session");
assert.match(mainProcess, /credentialTimer/, "F1 TV credential login should keep filling dynamic login forms until a session is detected");
assert.match(mainProcess, /clickF1TvLoginStep/, "F1 TV credential login should auto-continue/submit the one-time email/password flow");
assert.match(mainProcess, /storages = \[[^\]]*"indexeddb"[^\]]*"localstorage"[\s\S]*clearStorageData/, "F1 TV logout should clear storage-backed auth state as well as cookies");
assert.doesNotMatch(mainProcess, /f1tv-password/, "F1 TV password should not be stored by PitWall");
assert.match(mainProcess, /pitwall:data:snapshot/, "Electron main should expose a live F1 data snapshot IPC");
assert.match(mainProcess, /pitwall:ai:ask/, "Electron main should expose AI ask IPC");
assert.match(mainProcess, /api\.openai\.com\/v1\/responses/, "AI layer should call OpenAI Responses API");
assert.match(mainProcess, /api\.anthropic\.com\/v1\/messages/, "AI layer should call Anthropic Messages API");
assert.match(mainProcess, /COPILOT_INSIGHTS_FILE/, "Copilot daily insights should be stored in a file-backed cache");
assert.match(mainProcess, /getDailyCopilotInsights/, "Live snapshots should attach daily prebuilt Copilot insights");
assert.match(mainProcess, /attemptedOn/, "Daily Copilot insight generation should record one attempt per local day");
assert.match(mainProcess, /drivers-championship/, "Daily Copilot insights should include a drivers championship page");
assert.match(mainProcess, /constructors-championship/, "Daily Copilot insights should include a constructors championship page");
assert.match(mainProcess, /current-weekend/, "Daily Copilot insights should include a current race weekend page");
assert.match(mainProcess, /next-weekend/, "Daily Copilot insights should include a next race weekend page");
assert.match(mainProcess, /requestCodexResponsesStream/, "Codex AI layer should use the required streaming responses contract");
assert.match(mainProcess, /instructions:\s*AI_SYSTEM_PROMPT/, "Codex AI layer should send system guidance as top-level instructions");
assert.match(mainProcess, /stream:\s*true/, "Codex AI layer should request streaming responses");
assert.match(mainProcess, /pitwall:history:query/, "Electron main should expose historical query IPC");
assert.match(mainProcess, /pitwall:analytics:session/, "Electron main should expose session analytics IPC");
assert.match(mainProcess, /pitwall:analytics:library/, "Electron main should expose analytics race/session library IPC");
assert.match(mainProcess, /analyticsSessionCache/, "Session analytics should cache OpenF1 weekend data briefly");
assert.match(mainProcess, /api\.openf1\.org\/v1\/laps/, "Session analytics should fetch OpenF1 lap data");
assert.match(mainProcess, /api\.openf1\.org\/v1\/session_result/, "Session analytics should fetch official session results");
assert.match(mainProcess, /positiveDuration/, "Session analytics should ignore zero OpenF1 result durations so practice and qualifying use valid lap times");
assert.match(mainProcess, /api\.openf1\.org\/v1\/stints/, "Session analytics should fetch OpenF1 tyre stint data");
assert.match(mainProcess, /requestOpenF1AnalyticsWithRetry/, "Session analytics should retry OpenF1 429 responses instead of dropping most charts");
assert.match(mainProcess, /const requestEntries = Object\.entries\(requests\)[\s\S]*for \(const \[key, \[endpoint, params\]\] of requestEntries\)/, "Session analytics should fetch OpenF1 endpoints serially to avoid burst rate limits");
assert.doesNotMatch(mainProcess, /Promise\.allSettled\(Object\.entries\(requests\)\.map/, "Session analytics should not fan out all OpenF1 session requests in parallel");
const analyticsDelay = Number(mainProcess.match(/OPENF1_ANALYTICS_REQUEST_DELAY_MS = ([0-9]+)/)?.[1] || 0);
assert.ok(analyticsDelay >= 900, "Session analytics should pace OpenF1 endpoint requests conservatively enough for multi-session recap checks");
assert.match(mainProcess, /readAnalyticsSessionDiskCache/, "Session analytics should persist successful session data for OpenF1 cooldown fallback");
assert.match(mainProcess, /writeAnalyticsSessionDiskCache/, "Session analytics should save session analytics cache entries after successful loads");
assert.match(mainProcess, /analyticsAliasKey/, "Session analytics should key cached data by meeting and session kind before resolving a session key");
assert.match(mainProcess, /ANALYTICS_REVALIDATE_MS/, "Session analytics should have an explicit background revalidation cooldown");
assert.match(mainProcess, /analyticsRefreshInFlight/, "Session analytics should dedupe background refreshes for repeated Weekend and Analytics requests");
assert.match(mainProcess, /refreshAnalyticsSessionCache/, "Session analytics should refresh cached session data without blocking the caller");
assert.match(mainProcess, /analyticsCacheFingerprint/, "Session analytics should compare cached and fresh session data before rewriting the cache");
assert.match(mainProcess, /analyticsSessionDiskEntry\(\[cacheKey, aliasKey\], \{ allowStale: true \}\)/, "Session analytics should return cached session data immediately while checking for updates later");
assert.match(mainProcess, /OpenF1 rate limit reached/, "Session analytics should report OpenF1 rate limits without exposing raw URLs");
assert.match(mainProcess, /hasPublishedRows/, "Session analytics should explain when OpenF1 has not published rows yet");
assert.match(mainProcess, /value === null \|\| value === undefined \|\| value === ""[\s\S]*return null/, "Session analytics should not coerce missing numeric values to zero");
assert.match(mainProcess, /COPILOT_WEEKEND_SESSION_KINDS[\s\S]*Practice 1[\s\S]*Practice 2[\s\S]*Practice 3[\s\S]*Qualifying/, "Current weekend Copilot predictions should consider FP1-FP3 and qualifying");
assert.match(mainProcess, /function buildWeekendSessionSummaries[\s\S]*getAnalyticsSession\(\{[\s\S]*sessionKind/, "Current weekend Copilot should reuse structured OpenF1 session analytics");
assert.match(mainProcess, /weekendSessionSummaries:\s*await buildWeekendSessionSummaries\(data, pageId\)/, "Daily AI snapshots should include structured weekend session summaries when predicting the current race");
assert.match(mainProcess, /pitwall:notify:schedule/, "Electron main should expose local reminder IPC");
assert.match(mainProcess, /pitwall:profile:get/, "Electron main should persist the user profile outside random localhost localStorage origins");
assert.match(mainProcess, /pitwall:profile:set/, "Electron main should save dashboard setup choices to the app profile");
assert.match(mainProcess, /new Notification/, "Reminder IPC should use native notifications");
assert.match(mainProcess, /detectBattlePairs/, "App should compute deterministic battle pairs before asking AI");
assert.match(mainProcess, /api\.jolpi\.ca\/ergast\/f1\/current\/driverStandings\.json/, "Live data should fetch current driver standings from Jolpica");
assert.match(mainProcess, /api\.openf1\.org\/v1\/weather\?session_key=latest/, "Live data should fetch current/latest track weather from OpenF1");
assert.match(mainProcess, /fetchOpenF1WeekendWeather\(nextRace\)/, "Live data should fall back to selected-weekend OpenF1 weather when latest weather is unavailable");
assert.match(mainProcess, /standingsByNumber/, "OpenF1 timing parser should map driver numbers back to known driver codes");
assert.doesNotMatch(mainProcess, /code:\s*driver\?\.name_acronym\s*\|\|\s*String\(row\.driver_number\)/, "OpenF1 timing rows should not fall back to raw driver numbers before checking standings metadata");
assert.match(mainProcess, /motorsport\.com\/rss\/f1\/news/, "Live data should fetch current F1 news RSS");
assert.match(mainProcess, /formula1\.com\/en\/latest/, "Live news should include official Formula 1 coverage");
assert.match(mainProcess, /the-race\.com\/category\/formula-1/, "Live news should include The Race Formula 1 coverage");
assert.match(mainProcess, /planetf1\.com\/news/, "Live news should include PlanetF1 news coverage");
assert.match(mainProcess, /buildNewsFeed\(raw\)/, "Live news should merge all configured news sources into one feed");
assert.match(mainProcess, /function extractRssImage/, "Live news parser should extract article image metadata from RSS");
assert.match(mainProcess, /media:(?:content|thumbnail)|enclosure|<img/i, "Live news parser should inspect common RSS image locations");
assert.match(mainProcess, /image: extractRssImage/, "Parsed news stories should expose an image URL");
assert.match(preload, /f1tv/, "Preload should expose F1 TV auth helpers");
assert.match(preload, /login: \(options/, "Renderer should be able to start F1 TV login with options");
assert.match(preload, /browse: \(\)/, "Renderer should be able to open F1 TV content browser");
assert.match(preload, /browseSession: \(options/, "Renderer should be able to open a selected F1 TV session");
assert.match(preload, /library: \(options/, "Renderer should be able to load F1 TV session library data");
assert.match(preload, /streams: \(\)/, "Renderer should be able to read captured F1 TV streams");
assert.match(preload, /resolveContent: \(options/, "Renderer should resolve F1 TV detail URLs into clean player streams");
assert.match(preload, /probeStatus: \(options/, "Renderer should be able to run the storage-aware F1 TV auth probe");
assert.match(preload, /drmStatus/, "Renderer should be able to probe protected media support");
assert.match(preload, /requestMediaKeySystemAccess/, "DRM probe should use Encrypted Media Extensions");
assert.match(preload, /ai/, "Preload should expose AI helpers");
assert.match(preload, /ask: \(options/, "Renderer should be able to ask the configured AI provider");
assert.match(preload, /history/, "Preload should expose historical query helpers");
assert.match(preload, /analytics:\s*\{[\s\S]*session:/, "Preload should expose analytics session helpers");
assert.match(preload, /analytics:\s*\{[\s\S]*library:/, "Preload should expose analytics library helpers");
assert.match(preload, /notifications/, "Preload should expose reminder notification helpers");
assert.match(preload, /profile/, "Preload should expose persisted profile helpers");
assert.match(preload, /snapshot: \(\)/, "Renderer should be able to request live F1 data snapshots");

const html = fs.readFileSync(path.join(root, "ui_kits/pitwall/index.html"), "utf8");
assert.doesNotMatch(html, /unpkg\.com/, "Electron app should not depend on CDN React");
assert.match(html, /node_modules\/hls\.js\/dist\/hls\.min\.js/, "Renderer should load local hls.js");
assert.match(html, /node_modules\/shaka-player\/dist\/shaka-player\.compiled\.js/, "Renderer should load local Shaka Player");
assert.match(html, /sync\.js/, "Renderer should load shared stream sync helpers");
assert.match(html, /DataProvider/, "Renderer should wrap screens in the PitWall data provider");
assert.doesNotMatch(html, /Good evening, Alex|Canadian GP · race weekend/, "Renderer chrome should not hardcode fake user or race copy");
assert.match(fs.readFileSync(path.join(root, "electron/main.cjs"), "utf8"), /dist\/pitwall\/index\.html/, "Electron should prefer the precompiled renderer when available");
const distHtmlPath = path.join(root, "dist/pitwall/index.html");
if (fs.existsSync(distHtmlPath)) {
  const distHtml = fs.readFileSync(distHtmlPath, "utf8");
  assert.doesNotMatch(distHtml, /text\/babel|@babel|babel\.min\.js/, "Compiled renderer should not use in-browser Babel");
  assert.match(distHtml, /AppShell\.js/, "Compiled renderer should load compiled screen scripts");
}

const kitDir = path.join(root, "ui_kits/pitwall");
const source = Object.fromEntries(fs.readdirSync(kitDir)
  .filter((name) => name.endsWith(".jsx"))
  .map((name) => [name, fs.readFileSync(path.join(kitDir, name), "utf8")]));

assert.match(source["AppShell.jsx"], /pw-top__searchbox/, "Topbar search should be a real input");
assert.match(source["AppShell.jsx"], /document\.getElementById\(STYLE_ID\)[\s\S]*el\.textContent/, "AppShell should replace stale bundled shell styles");
assert.match(source["AppShell.jsx"], /\.pw-top__searchbox[\s\S]*appearance: none/, "Topbar search input should not use native white input styling");
assert.match(source["AppShell.jsx"], /\.pw-top__icon[\s\S]*appearance: none/, "Topbar icon buttons should not use native white button styling");
assert.match(source["AppShell.jsx"], /\.pw-side__brand \{[^}]*min-height: 96px;[^}]*padding: 52px var\(--space-7\) 16px;/, "Sidebar brand should sit below the macOS traffic lights and align left");
assert.doesNotMatch(source["AppShell.jsx"], /traffic-light-gutter/, "Sidebar brand should not be offset to the right of the traffic lights");
assert.match(source["AppShell.jsx"], /onSearchResult/, "Topbar search should navigate to search results");
assert.match(source["AppShell.jsx"], /driverCode/, "Driver search results should preserve the selected driver");
assert.match(source["AppShell.jsx"], /id: "weekend"/, "Sidebar should include the Weekend screen from the design");
assert.match(html, /pw-search-focus/, "App root should persist focused search results for destination screens");
assert.match(html, /initialPitWallScreen/, "App root should support direct screen routing for verification and deep links");
assert.match(html, /Weekend\.jsx/, "Renderer should load the Weekend screen");
assert.match(html, /weekend: window\.PW\.Weekend/, "App should route to the Weekend screen");
assert.match(source["LiveRacing.jsx"], /pane__replayplay/, "Replay controls should use a styled PitWall play button instead of a default small button");
assert.match(source["LiveRacing.jsx"], /pane__replaytrack/, "Replay controls should render a custom progress track");
assert.match(source["LiveRacing.jsx"], /pane__replayfill/, "Replay controls should render a custom progress fill");
assert.match(source["LiveRacing.jsx"], /replayProgressPct/, "Replay controls should compute a stable progress fill percentage");
assert.match(source["LiveRacing.jsx"], /aria-label="Replay position"/, "Replay range input should remain accessible after custom styling");
assert.ok(source["Weekend.jsx"], "Weekend screen should exist");
assert.match(source["Weekend.jsx"], /usePitWall/, "Weekend screen should use runtime PitWall data");
assert.match(source["Weekend.jsx"], /battlePairs/, "Weekend screen should surface deterministic battle pairs");
assert.match(source["Weekend.jsx"], /selectedRace\.sessions|D\.sessions/, "Weekend screen should render live calendar sessions");
assert.match(source["Weekend.jsx"], /selectedSessionKind/, "Weekend recap should let users select a weekend session");
assert.match(source["Weekend.jsx"], /sessionResultRows/, "Weekend recap should build rows for the selected session");
assert.match(source["Weekend.jsx"], /resultMetric/, "Weekend recap should choose a valid result metric before formatting OpenF1 times");
assert.match(source["Weekend.jsx"], /computedGapValue/, "Weekend recap should compute gap and interval values when OpenF1 omits them");
assert.match(source["Weekend.jsx"], /Time[\s\S]*Gap[\s\S]*Interval[\s\S]*Laps/, "Weekend recap leaderboard should show time, gap, interval, and laps columns");
assert.match(source["Weekend.jsx"], /wk-recap-table/, "Weekend recap should render a dedicated session leaderboard table");
assert.match(source["Weekend.jsx"], /pitwall\.analytics\.library/, "Weekend recap should resolve missing OpenF1 meeting keys before loading selected session results");
assert.match(source["Weekend.jsx"], /meetingKey: recapMeetingKey[\s\S]*season: analyticsSeason/, "Weekend recap should request analytics for the selected session with the resolved meeting key and season");
assert.match(source["Weekend.jsx"], /hasLiveTiming = Boolean\(selectedRaceSession\?\.status === "live"\)/, "Weekend should auto-open Session live only while a current session is live");
assert.match(source["Weekend.jsx"], /setMode\(hasLiveTiming \? "live" : "recap"\)/, "Weekend should return to recap when the current session ends");
assert.doesNotMatch(source["Weekend.jsx"], /D\.weekend|Canadian Grand Prix|Circuit Gilles-Villeneuve|Montréal|raceSoon/, "Weekend screen should not depend on static design mock data");
const weekendSelectionSandbox = vm.runInNewContext(`(() => {
  ${[
    "raceMatchText",
    "pickRace",
    "pickSession",
  ].map((name) => extractNamedFunction(source["Weekend.jsx"], name)).join("\n")}
  return { pickRace, pickSession };
})()`);
const directRace = weekendSelectionSandbox.pickRace({
  schedule: [
    { rnd: 7, name: "Barcelona Grand Prix", status: "upcoming", sessions: [] },
    { rnd: 6, name: "Monaco Grand Prix", status: "done", sessions: [] },
  ],
  race: {},
  sessions: [],
}, "6");
assert.equal(directRace.name, "Monaco Grand Prix", "Weekend direct launch should select Monaco by requested round");
const directSession = weekendSelectionSandbox.pickSession({
  sessions: [
    { kind: "Practice 1", status: "upcoming" },
    { kind: "Practice 2", status: "upcoming" },
    { kind: "Practice 3", status: "upcoming" },
    { kind: "Qualifying", status: "upcoming" },
  ],
}, { sessions: [] }, "Qualifying");
assert.equal(directSession.kind, "Qualifying", "Weekend direct launch should select the requested recap session");
const weekendRecapSandbox = vm.runInNewContext(`(() => {
  ${[
    "formatSeconds",
    "resultMetric",
    "computedGapValue",
    "numericGap",
    "formatGap",
    "formatInterval",
    "sessionResultRows",
  ].map((name) => extractNamedFunction(source["Weekend.jsx"], name)).join("\n")}
  return { sessionResultRows };
})()`);
const recapRows = weekendRecapSandbox.sessionResultRows({ byCode: {} }, {
  session: { name: "Qualifying", type: "Qualifying" },
  drivers: [
    { code: "HAM", name: "Lewis Hamilton", position: 1, resultDuration: 79.1, fastestLap: 78.2, gapToLeader: 0, laps: 18 },
    { code: "NOR", name: "Lando Norris", position: 2, resultDuration: 79.4, fastestLap: 77.9, gapToLeader: 0.3, laps: 15 },
  ],
}, []);
assert.deepEqual(Array.from(recapRows, (row) => row.code), ["HAM", "NOR"], "Weekend recap should prefer official session-result order over fastest-lap order");
assert.equal(recapRows[0].time, "1:19.100", "Weekend recap should show selected session result times");
assert.doesNotMatch(source["LiveRacing.jsx"], /window\.prompt/, "Stream setup should use an in-app control, not a browser prompt");
assert.match(source["LiveRacing.jsx"], /stream-modal/, "Live stream setup should expose an in-window modal");
assert.match(source["LiveRacing.jsx"], /RequestType\.LICENSE[\s\S]*request\.uris = \[licenseServer\]/, "Clean F1 TV player should force Shaka license requests to the resolved F1 TV license endpoint");
assert.match(source["LiveRacing.jsx"], /F1 TV license rejected/, "Clean F1 TV player should surface license-server rejection hints before Shaka masks them");
assert.match(source["LiveRacing.jsx"], /visibleDetail[\s\S]*!\/\^https\?:\\\/\\\//, "Clean F1 TV player errors should avoid showing raw playback URLs");
assert.match(source["LiveRacing.jsx"], /requestType,/, "Clean F1 TV player should pass Shaka request type through debug media fetches");
assert.match(source["LiveRacing.jsx"], /licensePathHint/, "Clean F1 TV player should log sanitized license endpoint hints");
assert.doesNotMatch(source["Settings.jsx"], /onChange=\{\(\) => \{\}\}/, "Settings segmented controls should not be no-ops");
assert.match(source["Settings.jsx"], /pw-settings/, "Settings should persist app preferences for Live defaults and appearance");
assert.match(source["Settings.jsx"], /pitwall\.f1tv\.login/, "Settings should use the Electron F1 TV login flow");
assert.match(source["Settings.jsx"], /f1-login/, "Settings should provide a MultiViewer-style F1 TV login panel");
assert.match(source["Settings.jsx"], /Sign in using embedded browser/, "Settings should include embedded-browser F1 TV login fallback");
assert.match(source["Settings.jsx"], /MultiViewer uses its own app profile/, "Settings should make clear that MultiViewer's F1 TV login does not carry into PitWall");
assert.match(source["Settings.jsx"], /Browser signed in/, "Settings should show browser-only F1 TV login as connected-but-not-playback-ready");
assert.match(source["Settings.jsx"], /playback token is still missing/, "Settings should explain when a browser login is connected but cannot load streams yet");
assert.doesNotMatch(source["Settings.jsx"], /f1tv-password|keyStore\(\)\.set\("f1tv/, "Settings should not store the F1 TV password");
assert.match(source["AppShell.jsx"], /usePitWall/, "App shell should render user profile and counts from runtime state");
assert.doesNotMatch(source["AppShell.jsx"], />\s*GO LIVE\s*</, "App shell top bar should not show a persistent GO LIVE call-to-action");
assert.match(source["AppShell.jsx"], /hasCurrentLiveSession[\s\S]*n\.id === "live"[\s\S]*<Badge tone="live">LIVE<\/Badge>/, "Live Racing nav should only show LIVE when a current live session exists");
assert.doesNotMatch(source["Dashboard.jsx"], /<FlagStatus[^>]*label=\{wx\.cond \|\| dataSource\}/, "Dashboard should not render the live data source status pill");
assert.match(source["Dashboard.jsx"], /profile\.favoriteDrivers/, "Dashboard favorites should come from user-selected favorites");
assert.doesNotMatch(source["Dashboard.jsx"], /Finish setup|Still needed:/, "Home screen should not render the setup reminder banner");
assert.match(source["DataProvider.jsx"], /pitwall\.profile\.get/, "DataProvider should load profile from persistent Electron storage");
assert.match(source["DataProvider.jsx"], /pitwall\.profile\.set/, "DataProvider should save profile to persistent Electron storage");
assert.match(source["News.jsx"], /readerStory/, "News should keep story reading inside the app");
assert.match(source["News.jsx"], /news-reader/, "News should render a comfortable in-app article reader");
assert.match(source["News.jsx"], /setReaderStory\(lead\)/, "Lead story CTA should open the in-app reader");
assert.doesNotMatch(source["News.jsx"], /onClick=\{\(\) => openExternal\(lead\.url\)\}/, "Lead story CTA should not open the browser directly");
assert.match(source["News.jsx"], /lead\.image/, "Lead news story should render its article image when available");
assert.match(source["News.jsx"], /n\.image/, "News list items should render article thumbnails when available");
assert.match(source["News.jsx"], /onError=\{\(event\)/, "News images should gracefully fall back when a remote image fails");
assert.match(source["News.jsx"], /let el = document\.getElementById\(STYLE_ID\)[\s\S]*el\.textContent/, "News should replace stale bundled styles before rendering");
assert.doesNotMatch(source["News.jsx"], /lead__body\s*\{[^}]*margin-top\s*:/, "Lead news text should sit in a separate panel below the image");
assert.match(source["Schedule.jsx"], /selectedRace\.sessions/, "Schedule should render sessions from live calendar data");
assert.match(source["Schedule.jsx"], /pitwall\.notifications\.schedule/, "Schedule should schedule local reminder notifications");
assert.match(source["Analytics.jsx"], /selectedRound/, "Analytics should let users select a race weekend");
assert.match(source["Analytics.jsx"], /analyticsLibrary/, "Analytics should load a race/session library instead of relying only on the live snapshot");
assert.match(source["Analytics.jsx"], /selectedSessionKind/, "Analytics should let users select a race-weekend session");
const analyticsSelectionSandbox = vm.runInNewContext(`(() => {
  ${[
    "sessionKindLabel",
    "defaultAnalyticsRace",
    "defaultAnalyticsSessionKind",
  ].map((name) => extractNamedFunction(source["Analytics.jsx"], name)).join("\n")}
  return { defaultAnalyticsRace, defaultAnalyticsSessionKind };
})()`);
const analyticsDefaultRace = analyticsSelectionSandbox.defaultAnalyticsRace([
  { rnd: 1, name: "Opener", status: "done", sessions: [{ kind: "Race", status: "done" }] },
  { rnd: 2, name: "Current Weekend", status: "upcoming", sessions: [
    { kind: "Practice 1", status: "done" },
    { kind: "Practice 2", status: "done" },
    { kind: "Qualifying", status: "upcoming" },
    { kind: "Race", status: "upcoming" },
  ] },
  { rnd: 3, name: "Next Weekend", status: "upcoming", sessions: [{ kind: "Practice 1", status: "upcoming" }] },
]);
assert.equal(analyticsDefaultRace.name, "Current Weekend", "Analytics should default to the current race weekend once sessions have started");
assert.equal(analyticsSelectionSandbox.defaultAnalyticsSessionKind(analyticsDefaultRace, { sessions: [] }), "Practice 2", "Analytics should default to the last completed session on the current weekend");
assert.match(source["Analytics.jsx"], /comparisonScope/, "Analytics should support one-driver, multi-driver, and team comparison scopes");
assert.match(source["Analytics.jsx"], /selectedDriverCodes/, "Analytics should store explicit selected driver comparisons");
assert.match(source["Analytics.jsx"], /pitwall\.analytics\.session/, "Analytics should load deterministic session analytics instead of only prompting AI");
assert.match(source["Analytics.jsx"], /loadRequestRef[\s\S]*loadMeetingKey[\s\S]*isCurrentLoad/, "Analytics should ignore stale auto-load requests from previously selected races");
assert.match(source["Analytics.jsx"], /!loadMeetingKey[\s\S]*setLoading\(false\)/, "Analytics should clear loading when the selected race cannot request OpenF1 data yet");
assert.match(source["Analytics.jsx"], /sessionStartsInFuture[\s\S]*OpenF1 publishes timing data/, "Analytics should handle future sessions without making OpenF1 timing requests");
assert.doesNotMatch(source["Analytics.jsx"], /React\.useEffect\(\(\) => \{[\s\S]*loadSession\(\);[\s\S]*selectedRound/, "Analytics should not auto-load OpenF1 sessions on every selection change");
assert.match(source["Analytics.jsx"], /sectorComparisonRows[\s\S]*sector-detail/, "Analytics should render numeric sector-by-sector comparison rows");
assert.match(source["Analytics.jsx"], /formatSector[\s\S]*fastestDelta/, "Analytics should show sector times and deltas to the fastest driver");
assert.match(source["Analytics.jsx"], /an__entity-grid/, "Analytics should render selectable driver/team entities");
assert.match(source["Analytics.jsx"], /let el = document\.getElementById\(STYLE_ID\)[\s\S]*if \(!el\)[\s\S]*el\.textContent/, "Analytics should replace stale bundled styles");
assert.match(source["Analytics.jsx"], /value === null \|\| value === undefined \|\| value === ""[\s\S]*return null/, "Analytics should render missing lap metrics as unavailable, not zero");
assert.match(source["Analytics.jsx"], /DIN Condensed|Avenir Next Condensed/, "Analytics should keep non-generic local racing font fallbacks");
assert.match(source["Leaderboards.jsx"], /seasonSummary/, "Leaderboards should use live season summary metadata");
assert.match(source["LiveRacing.jsx"], /Diagnostics browser/, "Live mode should keep F1 TV website browsing available for diagnostics");
assert.match(source["LiveRacing.jsx"], /F1 TV session picker/, "Live mode should include a session picker for past races and sessions");
assert.match(source["LiveRacing.jsx"], /No current live session/, "Live mode should clearly state when there is no current live session");
assert.match(source["LiveRacing.jsx"], /Load past session/, "Live mode should expose a visible past-session action outside hidden pane settings");
assert.match(source["LiveRacing.jsx"], /loadSelectedF1TvReplay/, "Live mode should load the selected F1 TV replay into the main world-feed pane");
assert.match(source["LiveRacing.jsx"], /hasCurrentLiveSession/, "Live mode should compute live-vs-replay state instead of always showing LIVE");
assert.match(source["LiveRacing.jsx"], /Practice 1/, "Live mode should expose practice replay choices");
assert.match(source["LiveRacing.jsx"], /Qualifying/, "Live mode should expose qualifying replay choices");
assert.match(source["LiveRacing.jsx"], /Race/, "Live mode should expose race replay choices");
assert.match(source["LiveRacing.jsx"], /pitwall\.f1tv\.browseSession/, "Live mode should open the selected F1 TV session");
assert.match(source["LiveRacing.jsx"], /pitwall\.f1tv\.library/, "Live mode should load F1 TV library data");
assert.match(source["LiveRacing.jsx"], /pitwall\.f1tv\.library\(\{ season, forceRefresh/, "Live Racing should pass forceRefresh through to the F1 TV library loader");
assert.match(source["LiveRacing.jsx"], /loadF1TvLibrary\(f1TvSeason, \{ forceRefresh: true \}\)/, "Reload library should bypass cached F1 TV weekends");
assert.match(source["LiveRacing.jsx"], /pitwall\.f1tv\.resolveContent/, "Live mode should resolve F1 TV content into clean stream descriptors");
assert.match(source["LiveRacing.jsx"], /pitwall\.f1tv\.probeStatus/, "Live mode should preflight F1 TV auth before waiting on hidden stream resolution");
assert.match(source["LiveRacing.jsx"], /Checking F1 TV session/, "Live mode should tell the user while it checks F1 TV auth");
assert.match(source["LiveRacing.jsx"], /Diagnostic F1 TV captures/, "Live mode should expose captured F1 TV stream diagnostics without making it the normal loading path");
assert.match(source["LiveRacing.jsx"], /pitwall\.f1tv\.streams/, "Live mode should load captured F1 TV streams");
assert.match(source["LiveRacing.jsx"], /PitWallStreamPlayer/, "Live mode should render clean PitWall stream player panes");
assert.doesNotMatch(source["LiveRacing.jsx"], /ProtectedF1TvPlayer|React\.createElement\("webview"|<webview/, "Live mode should not show the F1 TV website inside normal player panes");
assert.match(source["LiveRacing.jsx"], /await player\.attach\(video\)/, "Shaka player should explicitly attach to the video before loading");
assert.match(source["LiveRacing.jsx"], /allowCrossSiteCredentials\s*=\s*true/, "Shaka player should allow authenticated cross-site F1 TV media requests");
assert.match(source["LiveRacing.jsx"], /registerScheme\("https"/, "Shaka should route F1 TV media requests through the app runtime fetch bridge");
assert.match(source["LiveRacing.jsx"], /pitwall\.f1tv\.mediaFetch/, "Live player should use the restricted F1 TV media fetch bridge");
assert.match(source["LiveRacing.jsx"], /logPitWallDebug/, "Live mode should write player and resolver diagnostics");
assert.match(source["LiveRacing.jsx"], /f1tv\.debug-auto-load/, "Live mode should log debug auto-load playback repros");
assert.match(source["LiveRacing.jsx"], /autoF1Tv/, "Live mode should consume debug auto-load query params");
assert.match(source["LiveRacing.jsx"], /delete next\[targetKey \|\| "WORLD"\]/, "Live mode should clear stale stream panes when clean resolve fails");
assert.doesNotMatch(source["LiveRacing.jsx"], />Open F1 TV browser</, "Live mode should not present F1 TV website browsing as the normal stream-loading path");
assert.match(source["LiveRacing.jsx"], />Diagnostics browser</, "Live mode should keep browser-based F1 TV capture behind diagnostics wording");
assert.match(source["LiveRacing.jsx"], /replaySync/, "Live mode should maintain a replay master sync state");
assert.match(source["LiveRacing.jsx"], /syncReplayPlayers/, "Live mode should sync all replay players from the master clock");
assert.match(source["LiveRacing.jsx"], /readLivePanelSizes/, "Live mode should restore draggable panel sizes");
assert.match(source["LiveRacing.jsx"], /startPanelResize/, "Live mode should resize race-viewer panels by pointer dragging");
assert.match(source["LiveRacing.jsx"], /pane__driverselect/, "Onboard panes should expose an in-pane driver switcher");
assert.match(source["LiveRacing.jsx"], /retainedPanes/, "Live mode should retain mounted player panes when switching views");
assert.doesNotMatch(source["LiveRacing.jsx"], /key \+ "-" \+ i/, "Live mode should not key player panes by layout index");
assert.match(source["LiveRacing.jsx"], /live__body"\s+data-layout=\{layout\}/, "Driver Focus should be able to place live timing on the right");
assert.match(source["LiveRacing.jsx"], /live__insights--popup/, "Driver Focus should move AI insights and engineer chat into a popup");
assert.match(source["LiveRacing.jsx"], /gridArea: "world"/, "Driver Focus should place the main race feed below the onboard row");
assert.match(source["LiveRacing.jsx"], /<select[\s\S]*className="preset-select"[\s\S]*value=\{preset\}/, "Live Racing presets should collapse into a compact header dropdown");
assert.doesNotMatch(source["LiveRacing.jsx"], /D\.presets\.map\(\(p\) => \(\s*<button key=\{p\} className="preset"/, "Live Racing header should not render every preset as a button row");
assert.doesNotMatch(source["LiveRacing.jsx"], /<video[^>]*\bcontrols\b/, "Clean F1 TV panes should not show native browser video controls");
assert.doesNotMatch(source["LiveRacing.jsx"], /descriptor\?\.manifestType === "dash" \? "F1 TV" : "LIVE"/, "Loaded clean streams should not render LIVE/F1 TV watermark text over video");
assert.match(source["LiveRacing.jsx"], /\.pane--bc \.pane__video[\s\S]*bottom: 124px/, "Broadcast video should reserve space above replay controls and timing ticker");
assert.match(source["LiveRacing.jsx"], /replayTimingData/, "Replay mode should keep timing data derived from the video clock");
assert.match(source["LiveRacing.jsx"], /pitwall\.data\.replayTiming/, "Replay mode should request OpenF1 timing snapshots for the current replay time");
assert.match(source["LiveRacing.jsx"], /replayTimingOffset/, "Replay timing should support a video-to-timing clock offset");
assert.match(source["LiveRacing.jsx"], /DEFAULT_REPLAY_TIMING_OFFSET = -8/, "Replay timing should default to the observed F1 TV broadcast delay");
assert.match(source["LiveRacing.jsx"], /timingElapsedSeconds/, "Replay timing should apply the offset before requesting timing rows");
assert.match(source["LiveRacing.jsx"], /sessionClock/, "Live timing should render the official F1 session clock for sync diagnostics");
assert.match(source["LiveRacing.jsx"], /smoothSessionClockLabel/, "Live timing should locally interpolate the session countdown between timing snapshots");
assert.match(source["LiveRacing.jsx"], /TIMING_OFFSET_STORAGE_KEY/, "Replay timing offset should persist between app launches");
assert.match(source["LiveRacing.jsx"], /SyncMenu/, "Replay timing alignment controls should live inside the Sync menu");
assert.match(source["LiveRacing.jsx"], /Timing [-+]10s/, "Live mode should expose quick controls to align replay timing with the broadcast leaderboard");
assert.match(source["LiveRacing.jsx"], /Timing [-+]1m/, "Live mode should expose larger replay timing alignment controls");
{
  const headerStart = source["LiveRacing.jsx"].indexOf('<div className="live__barright">');
  const headerEnd = source["LiveRacing.jsx"].indexOf('</div>\n        </div>\n\n        {/* Body */}', headerStart);
  const headerSource = source["LiveRacing.jsx"].slice(headerStart, headerEnd);
  assert.doesNotMatch(headerSource, />Timing [-+]/, "Replay timing offset buttons should not consume title-bar space");
}
assert.match(source["LiveRacing.jsx"], /current\?\.timing\?\.length/, "Replay timing should retain the last populated timing rows instead of blanking the tower on an empty refresh");
assert.match(source["LiveRacing.jsx"], /const LIVE_TIMING_POLL_INTERVAL_MS = 500/, "Live timing poll cadence should stay conservative for live network streams");
assert.match(source["LiveRacing.jsx"], /const REPLAY_TIMING_POLL_INTERVAL_MS = 250/, "Replay timing should poll the cached archive quickly without overdoing it");
assert.match(source["LiveRacing.jsx"], /setInterval\(loadReplayTiming, REPLAY_TIMING_POLL_INTERVAL_MS\)/, "Replay timing should refresh quickly from the local F1 timing cache");
assert.match(source["LiveRacing.jsx"], /Math\.floor\(timingElapsedSeconds \* 4\)/, "Replay timing should use quarter-second buckets so fast polling is not discarded");
assert.match(source["LiveRacing.jsx"], /playerRefs\.current\[replaySync\.masterKey \|\| "WORLD"\]/, "Replay timing should read the current master video time directly");
assert.match(source["LiveRacing.jsx"], /Replay timing unavailable/, "Replay timing errors should surface as a clear short status");
assert.match(source["LiveRacing.jsx"], /diagnostics: data\?\.diagnostics/, "Replay timing logs should include sanitized data-source row counts");
assert.match(source["LiveRacing.jsx"], /liveTimingData/, "Live mode should keep fast timing data separate from the dashboard snapshot");
assert.match(source["LiveRacing.jsx"], /pitwall\.data\.liveTiming/, "Live mode should request fast OpenF1 timing snapshots while racing");
assert.match(source["LiveRacing.jsx"], /targetLatencySeconds: syncTargetFor\("WORLD"\)/, "Live timing should request rows delayed to the World Feed target latency");
assert.match(source["LiveRacing.jsx"], /setInterval\(loadLiveTiming, LIVE_TIMING_POLL_INTERVAL_MS\)/, "Live timing should refresh quickly for broadcast sync");
assert.match(source["LiveRacing.jsx"], /const CLOCK_TICK_INTERVAL_MS = 250/, "Session countdown should redraw smoothly between network timing snapshots");
assert.match(source["LiveRacing.jsx"], /useTimingRowMotion/, "Live timing rows should use FLIP-style motion for smooth leaderboard changes");
assert.match(source["LiveRacing.jsx"], /data-moving="true"/, "Live timing rows should expose a moving state while reordering");
assert.match(source["LiveRacing.jsx"], /TIMING_COLUMN_STORAGE_KEY/, "Live timing should persist the user's selected timing columns");
assert.match(source["LiveRacing.jsx"], /TimingColumnMenu/, "Live timing should expose a configurable column menu");
assert.match(source["LiveRacing.jsx"], /\.timing-tower \{ min-width: 640px; \}/, "Live timing tower should be horizontally compact enough to reveal more columns");
assert.match(source["LiveRacing.jsx"], /\.timing-tower__head, \.timing-tower__row \{[\s\S]*column-gap: var\(--space-3\)[\s\S]*padding: 0 var\(--space-2\)/, "Live timing columns should use compact spacing with minimal left inset");
assert.match(source["LiveRacing.jsx"], /\.mini-sector \{[\s\S]*width: 44px[\s\S]*overflow: hidden/, "Mini-sector groups should be bounded so S2 and S3 do not visually fuse");
assert.match(source["LiveRacing.jsx"], /\.mini-sector__seg \{ width: 3px; height: 15px;/, "Mini-sector segments should be small enough for narrow timing columns");
assert.match(source["LiveRacing.jsx"], /DEFAULT_TIMING_COLUMNS = \["driver", "last", "best", "gap", "interval", "s1", "s2", "s3", "tyre", "age"\]/, "Live timing should show interval by default after compacting columns");
assert.match(source["LiveRacing.jsx"], /MiniSectorBar/, "Live timing should render mini-sector columns");
assert.match(source["LiveRacing.jsx"], /TimingTowerRow/, "Live timing should use a compact timing row instead of the name-heavy design-system row");
assert.doesNotMatch(source["LiveRacing.jsx"], /<TimingRowHeader \/>[\s\S]*<TimingRow/, "Live timing rows should not render full driver names from the old TimingRow component");
assert.match(source["LiveRacing.jsx"], /resolvedOnboardFeedForCode/, "Onboard panes should fall back to resolved non-world F1 TV feeds when driver labels are absent");
assert.match(source["LiveRacing.jsx"], /\.pane:not\(\.pane--bc\) \.pane__driverselect[\s\S]*opacity: 0[\s\S]*\.pane:not\(\.pane--bc\):hover \.pane__driverselect[\s\S]*opacity: 1/, "Onboard driver selector should only appear while hovering an onboard pane");
assert.match(source["LiveRacing.jsx"], /\.pane:not\(\.pane--bc\) \.pane__feedlabel[\s\S]*opacity: 0[\s\S]*\.pane:not\(\.pane--bc\):hover \.pane__feedlabel[\s\S]*opacity: 1/, "Onboard feed label should only appear while hovering an onboard pane");
assert.match(source["LiveRacing.jsx"], /telemetryForCode/, "Onboard panes should derive telemetry from the active timing rows");
assert.match(source["LiveRacing.jsx"], /telemetry=\{\(p\.telemetry \|\| p\.feed === "Onboard"\) && telemetryDefault\}/, "Onboard panes should show speed telemetry by default");
assert.match(source["LiveRacing.jsx"], /\.tele__v[\s\S]*transition-property: color/, "Onboard telemetry numbers should visually update smoothly");
assert.match(source["LiveRacing.jsx"], /row\.telemetry\?\.speed/, "Onboard telemetry should render real speed data from OpenF1 car data");
assert.match(source["LiveRacing.jsx"], /row\.telemetry\?\.gear/, "Onboard telemetry should render real gear data from OpenF1 car data");
assert.match(source["LiveRacing.jsx"], /row\.telemetry\?\.throttle/, "Onboard telemetry should render real throttle data from OpenF1 car data");
assert.doesNotMatch(source["LiveRacing.jsx"], /tele__drs|<span className="tele__l">DRS<\/span>|OPEN/, "Onboard telemetry should not show fake DRS state");
assert.doesNotMatch(source["LiveRacing.jsx"], /<span className="tele__v">318<\/span>|<span className="tele__v">7<\/span>|<span className="tele__v">94%<\/span>|bar\(94|bar\(8/, "Onboard telemetry should not use hardcoded stat placeholders");
assert.match(mainProcess, /pitwall:data:replayTiming/, "Electron main should expose replay-timed OpenF1 snapshots");
assert.match(mainProcess, /pitwall:data:liveTiming/, "Electron main should expose fast live OpenF1 timing snapshots");
assert.match(mainProcess, /getLiveTimingSnapshot/, "Electron main should fetch live timing without waiting for the full app snapshot cache");
assert.match(mainProcess, /F1_TIMING_BASE_URL = "https:\/\/livetiming\.formula1\.com"/, "Live timing should use Formula 1's official livetiming source directly");
assert.match(mainProcess, /function resolveF1TimingArchiveBase/, "Replay timing should resolve Formula 1 archived timing paths from the selected meeting/session");
assert.match(mainProcess, /function parseF1TimingJsonStream/, "Replay timing should parse Formula 1 jsonStream timing feeds");
assert.match(mainProcess, /function decodeF1TimingZPayload/, "Replay timing should decode Formula 1 compressed .z telemetry feeds");
assert.match(mainProcess, /function parseF1TimingArchiveRows/, "Replay timing should normalize Formula 1 timing rows into PitWall timing rows");
assert.match(mainProcess, /ExtrapolatedClock\.jsonStream/, "Replay timing should fetch the official F1 session clock stream");
assert.match(mainProcess, /function parseF1TimingSessionClock/, "F1 timing parser should normalize the official session clock");
assert.match(mainProcess, /function f1TimingSessionStartSeconds/, "Replay timing should retain the FastF1-style session Started marker for clock diagnostics");
assert.match(mainProcess, /function f1TvManifestProgramDateTime/, "F1 TV resolver should extract program-date-time from clean stream manifests");
assert.match(mainProcess, /videoStartUtc/, "Resolved F1 TV feeds should carry a sanitized video start UTC for replay timing sync");
assert.match(mainProcess, /Math\.floor\(elapsedSeconds \* 4\)/, "Formula 1 replay timing cache should keep quarter-second snapshots");
assert.match(source["LiveRacing.jsx"], /videoStartUtc/, "Live Racing should pass the resolved video start UTC into replay timing requests");
assert.match(mainProcess, /parseF1TimingArchiveRows\(sessionData, elapsedSeconds, \{[\s\S]*videoStartUtc: options\.videoStartUtc[\s\S]*videoStartArchiveSeconds: options\.videoStartArchiveSeconds/, "Replay timing should forward the resolved F1 TV video start into the Formula 1 timing parser");
assert.match(mainProcess, /`f1:\$\{meetingKey\}:\$\{normalizeOpenF1SessionKind\(sessionKind\)\}:\$\{Math\.floor\(elapsedSeconds \* 4\)\}:\$\{videoStartKey\}`/, "Formula 1 replay timing cache should keep quarter-second buckets for smooth onboard telemetry");
assert.match(mainProcess, /timingAnchor: "program"/, "F1 TV replay timing should default to the replay program timeline, not session-start elapsed time");
assert.doesNotMatch(mainProcess, /parseF1TimingArchiveRows\(sessionData, elapsedSeconds, \{ alignToSessionStart: true \}\)/, "F1 TV replay timing should not add the session start offset to video.currentTime");
assert.match(mainProcess, /getReplayF1TimingSessionData/, "Replay timing should prefer Formula 1 livetiming archives before OpenF1 fallbacks");
assert.match(mainProcess, /getF1LiveTimingSnapshot/, "Live timing should attempt Formula 1 SignalR timing before OpenF1 fallbacks");
assert.match(mainProcess, /targetLatencySeconds/, "Formula 1 live timing snapshots should accept a target latency for video alignment");
assert.match(mainProcess, /Date\.now\(\) \/ 1000 - targetLatencySeconds/, "Formula 1 live timing should render buffered rows at the video target latency");
assert.match(mainProcess, /signalrcore/, "Live timing should connect to Formula 1's SignalR Core live timing stream");
assert.match(mainProcess, /function ensureF1TimingLiveClient[\s\S]*getSecret\("f1tv-token"\)[\s\S]*access_token/, "Formula 1 SignalR live timing should pass the stored F1 TV subscription token as an access token without logging it");
assert.match(mainProcess, /openF1CarData/, "Electron main should fetch OpenF1 car data for onboard telemetry");
assert.match(mainProcess, /latestCarDataByDriverNumber/, "Electron main should normalize latest car data by driver");
assert.match(mainProcess, /parseTiming\([\s\S]*openF1Laps/, "Live timing parser should include lap data for last/best lap and mini sectors");
assert.match(mainProcess, /segments_sector_1/, "Timing parser should read OpenF1 mini-sector segment arrays");
assert.match(mainProcess, /date_start/, "Replay timing should align OpenF1 lap rows by date_start");
assert.match(mainProcess, /duration_sector_1/, "Replay timing should derive lap durations from OpenF1 sector durations when needed");
assert.match(mainProcess, /carDataOffsetMs/, "Replay timing should compensate for OpenF1 car_data clock offsets");
assert.match(mainProcess, /targetMs \+ carDataOffsetMs/, "Replay telemetry windows should use the adjusted OpenF1 car_data clock");
assert.match(mainProcess, /bestLapDuration/, "Timing rows should include best lap duration");
assert.match(mainProcess, /replayOpenF1Cache/, "Replay timing should cache full OpenF1 session data instead of polling every video bucket");
assert.match(mainProcess, /getReplayOpenF1SessionData/, "Replay timing should reuse fetched OpenF1 replay session data");
assert.match(mainProcess, /filterReplayRowsAt/, "Replay timing should filter cached OpenF1 rows by video clock locally");
assert.doesNotMatch(mainProcess, /requestJson\(openF1ApiUrl\("intervals", \{ session_key: sessionKey, "date>="/, "Replay timing should not fail the snapshot on optional interval date-window fetches");
assert.match(preload, /replayTiming:/, "Preload should expose replay timing snapshots to the renderer");
assert.match(preload, /liveTiming: \(options = \{\}\)/, "Preload should expose fast live timing snapshots with latency options to the renderer");
assert.match(mainProcess, /streamItems/, "F1 TV resolver should preserve per-stream metadata from playback responses");
assert.match(mainProcess, /driverCodeFromF1TvText/, "F1 TV resolver should infer onboard driver codes from playback response labels");
assert.match(source["Weekend.jsx"], /leader\.image/, "Weekend race-control leader avatar should use the real driver image when available");
assert.match(source["Weekend.jsx"], /battleA\.image/, "Weekend battle-watch first avatar should use the real driver image when available");
assert.match(source["Weekend.jsx"], /battleB\.image/, "Weekend battle-watch second avatar should use the real driver image when available");
assert.match(source["LiveRacing.jsx"], /pitwall\.f1tv\.drmStatus/, "Live mode should check DRM readiness before protected playback");
assert.match(source["LiveRacing.jsx"], /MultiViewer login is separate/, "Live mode should explain why PitWall may need a fresh F1 TV login");
assert.match(source["LiveRacing.jsx"], /pw-sync-settings/, "Live mode should persist stream sync target latencies");
assert.match(source["LiveRacing.jsx"], /targetLatency/, "Live mode should expose target latency for stream syncing");
assert.match(source["LiveRacing.jsx"], /liveLatency/, "Live mode should measure live latency for stream syncing");
assert.match(source["LiveRacing.jsx"], /playbackRate/, "Live mode should expose playback rate in the sync debug overlay");
assert.match(source["LiveRacing.jsx"], /maxLiveSyncPlaybackRate: 1\.2/, "Native HLS playback should use a 20% catch-up rate like MultiViewer");
assert.match(source["LiveRacing.jsx"], /playbackRate = 0\.8/, "Native HLS playback should slow by 20% when ahead of target latency");
assert.match(source["LiveRacing.jsx"], /ArrowDown|ArrowUp/, "Live mode should support keyboard latency tuning");
assert.match(source["LiveRacing.jsx"], /Sync overlay/, "Live mode should provide an in-pane stream sync debug overlay");
assert.match(source["LiveRacing.jsx"], /battlePair/, "Live mode should use deterministic battle pair data");
assert.match(source["Copilot.jsx"], /pitwall\.ai\.ask/, "Copilot should call real configured AI providers");
assert.doesNotMatch(source["Copilot.jsx"], /% likely|Model confidence|Pole\s*→\s*win|model-derived|Modelled conditions/, "Copilot should not present uncomputed model outputs as facts");
assert.doesNotMatch(source["Copilot.jsx"], /Math\.max\(0\.15,\s*0\.45\s*-\s*index\s*\*\s*0\.1\)/, "Copilot should not use hardcoded title-probability placeholders");
assert.match(source["Copilot.jsx"], /No AI projection computed/, "Copilot should disclose when it has not computed a projection");
assert.match(mainProcess, /predictions:[\s\S]*winner[\s\S]*podium[\s\S]*watchlist/, "AI response schema should allow computed Current weekend race predictions");
assert.match(mainProcess, /page\.id === "current-weekend"[\s\S]*race winner[\s\S]*podium/, "Current weekend AI prompt should explicitly request race predictions");
assert.match(mainProcess, /COPILOT_INSIGHTS_SCHEMA_VERSION[\s\S]*cached\?\.schemaVersion/, "Daily Copilot cache should be versioned when its response shape changes");
assert.match(source["Copilot.jsx"], /PredictionBoard[\s\S]*selectedPage\.predictions/, "Copilot should render AI-computed Current weekend predictions");
assert.match(source["Copilot.jsx"], /INSIGHT_TABS/, "Copilot should expose tabs for prebuilt insights and chat");
assert.match(source["Copilot.jsx"], /ask-copilot/, "Copilot should keep freeform chat in a separate Ask Copilot tab");
assert.match(source["Copilot.jsx"], /daily\.pages/, "Copilot should render prebuilt daily insight pages from the snapshot");
assert.match(mainProcess, /openF1Stints/, "Live snapshot should ingest OpenF1 stint data for tyre strategy reasoning");
assert.match(mainProcess, /OPTIONAL_LIVE_DATA_KEYS/, "Optional tyre enrichment feeds should not make the main live snapshot look broken");
assert.match(mainProcess, /LIVE_CORE_DATA_URLS/, "Dashboard snapshot should have a fast core live-data request set");
assert.match(mainProcess, /LIVE_TIMING_ENRICHMENT_URLS/, "Timing enrichment feeds should be separated from dashboard first paint");
assert.match(mainProcess, /fetchLiveDataEntries\(LIVE_CORE_DATA_URLS\)/, "Dashboard snapshot should fetch only core data on its critical path");
assert.doesNotMatch(mainProcess, /getPitWallSnapshot[\s\S]{0,900}Object\.entries\(LIVE_DATA_URLS\)/, "Dashboard snapshot should not wait for every OpenF1 timing endpoint before rendering");
assert.match(mainProcess, /buildStrategyContext/, "Electron main should summarize tyre, pit, timing, weather, and news context for AI");
assert.match(mainProcess, /visualization/, "AI response schema should allow typed visualization payloads");
assert.match(source["Copilot.jsx"], /StrategyVisualization/, "Copilot should render AI visualization payloads when present");
assert.match(source["Copilot.jsx"], /answer\.visualization/, "Copilot should preserve typed AI visualizations in chat messages");
assert.match(source["LiveRacing.jsx"], /StrategyVisualization/, "Live Racing chat should render AI visualization payloads when present");
assert.match(source["LiveRacing.jsx"], /strategyContext/, "Live Racing AI snapshot should include structured strategy context");
assert.match(source["Analytics.jsx"], /pitwall\.history\.query/, "Analytics should query historical Jolpica data");
assert.doesNotMatch(source["AppShell.jsx"] + source["Dashboard.jsx"] + source["Weekend.jsx"] + source["News.jsx"] + source["Schedule.jsx"] + source["Copilot.jsx"], /Alex Ramos|Ferrari gamble on undercut|Canadian Grand Prix|Circuit Gilles-Villeneuve|Morning, Alex/, "User-facing screens should not hardcode placeholder person, news, or race data");

for (const [file, code] of Object.entries(source)) {
  assert.doesNotMatch(code, /TODO|FIXME|window\.prompt|unpkg\.com|onChange=\{\(\) => \{\}\}/, `${file} should not contain unfinished placeholders`);
}

for (const file of fs.readdirSync(kitDir).filter((name) => name.endsWith(".jsx"))) {
  const code = fs.readFileSync(path.join(kitDir, file), "utf8");
  Babel.transform(code, { presets: ["react"], filename: file });
}

console.log("PitWall smoke checks passed");
