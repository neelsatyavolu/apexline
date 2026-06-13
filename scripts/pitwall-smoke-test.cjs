const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const zlib = require("node:zlib");
const Babel = require("@babel/standalone");

const root = path.resolve(__dirname, "..");

function decodePngRgba(buffer) {
  let offset = 8;
  const chunks = [];
  while (offset < buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.toString("ascii", offset + 4, offset + 8);
    chunks.push({ type, data: buffer.subarray(offset + 8, offset + 8 + length) });
    offset += 12 + length;
  }
  const ihdrChunk = chunks.find((chunk) => chunk.type === "IHDR");
  assert.ok(ihdrChunk, "App icon PNG must have an IHDR header chunk");
  const header = ihdrChunk.data;
  const width = header.readUInt32BE(0);
  const height = header.readUInt32BE(4);
  assert.equal(header[8], 8, "App icon PNG layers should use 8-bit channels");
  assert.equal(header[9], 6, "App icon PNG layers should use RGBA color");
  const raw = zlib.inflateSync(Buffer.concat(chunks.filter((chunk) => chunk.type === "IDAT").map((chunk) => chunk.data)));
  const pixels = Buffer.alloc(width * height * 4);
  let input = 0;
  const stride = width * 4;
  for (let y = 0; y < height; y++) {
    const filter = raw[input++];
    for (let x = 0; x < stride; x++) {
      const left = x >= 4 ? pixels[y * stride + x - 4] : 0;
      const up = y ? pixels[(y - 1) * stride + x] : 0;
      const upLeft = y && x >= 4 ? pixels[(y - 1) * stride + x - 4] : 0;
      let value = raw[input++];
      if (filter === 1) value = (value + left) & 255;
      else if (filter === 2) value = (value + up) & 255;
      else if (filter === 3) value = (value + Math.floor((left + up) / 2)) & 255;
      else if (filter === 4) {
        const p = left + up - upLeft;
        const pa = Math.abs(p - left);
        const pb = Math.abs(p - up);
        const pc = Math.abs(p - upLeft);
        value = (value + (pa <= pb && pa <= pc ? left : pb <= pc ? up : upLeft)) & 255;
      } else {
        assert.equal(filter, 0, "App icon PNG layer should use a valid PNG filter");
      }
      pixels[y * stride + x] = value;
    }
  }
  return { width, height, pixels };
}

function readIcnsEntry(file, expectedType) {
  const buffer = fs.readFileSync(file);
  assert.equal(buffer.toString("ascii", 0, 4), "icns", "App icon should use the ICNS container format");
  let offset = 8;
  while (offset < buffer.length) {
    const type = buffer.toString("ascii", offset, offset + 4);
    const length = buffer.readUInt32BE(offset + 4);
    if (type === expectedType) return buffer.subarray(offset + 8, offset + length);
    offset += length;
  }
  throw new Error(`Missing ${expectedType} app icon layer`);
}

function pixelAt(image, x, y) {
  const offset = (y * image.width + x) * 4;
  return image.pixels.subarray(offset, offset + 4);
}

function readPngSize(file) {
  const buffer = fs.readFileSync(file);
  assert.equal(buffer.toString("hex", 0, 8), "89504e470d0a1a0a", `${path.basename(file)} should be a PNG`);
  assert.equal(buffer.toString("ascii", 12, 16), "IHDR", `${path.basename(file)} should have an IHDR header`);
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
}

function assertAppIconHasTransparentCorners() {
  const image = decodePngRgba(readIcnsEntry(path.join(root, "assets/app-icon.icns"), "ic07"));
  assert.equal(pixelAt(image, 0, 0)[3], 0, "App icon corners should be transparent, not an opaque white canvas");
  assert.ok(pixelAt(image, Math.floor(image.width / 2), Math.floor(image.height / 2))[3] > 240, "App icon center should remain opaque");
}

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
assert.equal(data.formRounds.length, 0, "Seed data should not include fake recent-form rounds");
assert.deepEqual(JSON.parse(JSON.stringify(data.driverProfiles.ANT.form)), [], "Seed driver profiles should not include fake recent-form positions");
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
  if (driver.code === "LIN") {
    assert.equal(driver.remoteImage, "../../assets/drivers/lin-headshot.jpg", "LIN should use the vendored local headshot");
    assert.ok(fs.existsSync(path.join(root, "assets/drivers/lin-headshot.jpg")), "LIN vendored local headshot should exist");
  } else {
    assert.match(driver.remoteImage, /^https:\/\/media\.formula1\.com\//, `${driver.code} should retain the official remote image URL`);
  }
  assert.match(driver.teamLogo, /^https:\/\/media\.formula1\.com\//, `${driver.code} needs an official team logo`);
  assert.match(driver.teamLogo, /c_fit%2Ch_256/, `${driver.code} team logo should request a high-resolution source`);
}
const driverAssetReadme = fs.readFileSync(path.join(root, "assets/drivers/README.md"), "utf8");
assert.match(driverAssetReadme, /Arvid Lindblad[\s\S]*Yu Chu Chin[\s\S]*CC BY-SA 4\.0/, "Vendored driver headshots should document source attribution and license");

for (const constructor of data.constructors) {
  assert.match(constructor.logo, /^https:\/\/media\.formula1\.com\//, `${constructor.name} needs an official logo`);
  assert.match(constructor.logo, /c_fit%2Ch_256/, `${constructor.name} logo should request a high-resolution source`);
}

const bundle = fs.readFileSync(path.join(root, "_ds_bundle.js"), "utf8");
assert.match(bundle, /pw-driver__avatar/, "DriverTag should render driver image avatars");
assert.match(bundle, /avatarSrc/, "DriverTag should resolve image src from roster data");
assert.match(bundle, /driver\.remoteImage\s*\|\|\s*driver\.image/, "DriverTag should prefer official driver portraits before packaged helmet fallbacks");
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
assert.match(packageJson.scripts["release:update-feed"] || "", /prepare-vercel-update\.cjs/, "Release scripts should prepare the Vercel update feed from the packaged app");
assert.match(packageJson.scripts["screenshot:site"] || "", /capture-site-screenshots\.cjs/, "Repo should expose a site screenshot capture script");
assert.match(packageJson.scripts["probe:openf1:monaco"], /pitwall-openf1-replay-probe\.cjs/, "Repo should expose a non-UI OpenF1 Monaco replay probe");
assert.match(packageJson.scripts["probe:f1timing:monaco"] || "", /pitwall-f1timing-replay-probe\.cjs/, "Repo should expose a non-UI Formula 1 livetiming Monaco replay probe");
assert.equal(packageJson.name, "apexline", "Package metadata should use the Apexline app name");
assert.equal(packageJson.apexline?.updateBaseUrl, "https://apexline.io", "Packaged apps should use the public Apexline update domain");
assert.ok(fs.existsSync(f1TimingReplayProbePath), "Formula 1 livetiming replay probe should exist for validating rich replay timing");
assert.match(f1TimingReplayProbe, /livetiming\.formula1\.com/, "Formula 1 replay probe should fetch the official F1 livetiming archive directly");
assert.match(f1TimingReplayProbe, /CarData\.z\.jsonStream/, "Formula 1 replay probe should decode compressed telemetry feed data");
assert.match(f1TimingReplayProbe, /TimingData\.jsonStream/, "Formula 1 replay probe should parse official timing rows");
assert.match(f1TimingReplayProbe, /richRows/, "Formula 1 replay probe should report sanitized richness counts for last/best/sector/tyre/telemetry rows");
assert.match(openF1ReplayProbe, /EMAIL[\s\S]*PASSWORD/, "OpenF1 replay probe should read local .env credentials without printing them");
assert.match(openF1ReplayProbe, /Authorization: `Bearer \$\{accessToken\}`/, "OpenF1 replay probe should use authenticated bearer requests");
assert.match(openF1ReplayProbe, /requestTimes\.length < 60/, "OpenF1 replay probe should enforce the 60 requests per minute cap");
assert.match(openF1ReplayProbe, /parseTiming\(drivers, positions, intervals/, "OpenF1 replay probe should use the same timing parser as the app");
assert.match(packageScript, /const appPath = baseOut/, "macOS packaging should always rebuild dist/Apexline.app as the current app");
assert.match(packageScript, /Snapshot \$\{snapshotPath\}/, "macOS packaging should also keep a timestamped snapshot path");
assert.ok(packageJson.dependencies.react, "React should be a local dependency");
assert.ok(packageJson.dependencies["hls.js"], "HLS playback should use hls.js");
assert.ok(packageJson.dependencies["shaka-player"], "Protected DASH/Widevine playback should use Shaka Player");
assert.match(packageJson.devDependencies.electron, /castlabs\/electron-releases#v[0-9.]+\+wvcus/, "Apexline should use CastLabs Electron ECS for Widevine-capable playback");
assert.ok(fs.existsSync(path.join(root, "electron/main.cjs")), "Electron main process should exist");
assert.ok(fs.existsSync(path.join(root, "electron/preload.cjs")), "Electron preload should exist");
assert.ok(fs.existsSync(path.join(root, "scripts/build-renderer.cjs")), "Renderer build script should exist");
assert.ok(fs.existsSync(path.join(root, "assets/app-icon.icns")), "macOS package should have a custom Apexline app icon");
assertAppIconHasTransparentCorners();
const packageMac = fs.readFileSync(path.join(root, "scripts/package-macos.cjs"), "utf8");
assert.match(packageMac, /repairMacFrameworkSymlinks/, "macOS package step should repair Electron framework symlinks when CastLabs assets need them");
assert.match(packageMac, /Versions\/Current/, "macOS framework repair should recreate standard Current symlinks");
assert.match(packageMac, /PITWALL_CASTLABS_VMP/, "macOS package step should support opt-in CastLabs VMP signing");
assert.match(packageMac, /castlabs_evs\.vmp/, "CastLabs VMP signing should use the official EVS module");
assert.match(packageMac, /"sign-pkg"[\s\S]*"verify-pkg"/, "CastLabs VMP package signing should verify the signature after signing");
assert.match(packageMac, /signWithCastLabsVmp\(appPath\)[\s\S]*codesign/, "macOS package step should run VMP signing before macOS codesign");
assert.match(packageMac, /CFBundleDisplayName", "Apexline"/, "macOS package step should set the Apexline app name");
assert.match(packageMac, /CFBundleIconFile", "app-icon"/, "macOS package step should use the custom Apexline app icon");
assert.match(packageMac, /rootPackage\.version/, "macOS package step should read the app version from package.json");
assert.match(packageMac, /CFBundleShortVersionString/, "macOS package step should stamp the user-visible app version");
assert.match(packageMac, /APEXLINE_UPDATE_BASE_URL/, "macOS package step should embed the Vercel update feed base URL");
const mainProcess = fs.readFileSync(path.join(root, "electron/main.cjs"), "utf8");
const preload = fs.readFileSync(path.join(root, "electron/preload.cjs"), "utf8");
const dataProviderSource = fs.readFileSync(path.join(root, "ui_kits/pitwall/DataProvider.jsx"), "utf8");
const liveRacingSource = fs.readFileSync(path.join(root, "ui_kits/pitwall/LiveRacing.jsx"), "utf8");
const settingsSource = fs.readFileSync(path.join(root, "ui_kits/pitwall/Settings.jsx"), "utf8");
const syncSource = fs.readFileSync(path.join(root, "ui_kits/pitwall/sync.js"), "utf8");
const trackMapSource = fs.readFileSync(path.join(root, "ui_kits/pitwall/TrackMap.jsx"), "utf8");
const trackMapCircuitsSource = fs.readFileSync(path.join(root, "ui_kits/pitwall/trackmap-circuits.js"), "utf8");
const pitwallIndex = fs.readFileSync(path.join(root, "ui_kits/pitwall/index.html"), "utf8");
const appShellSource = fs.readFileSync(path.join(root, "ui_kits/pitwall/AppShell.jsx"), "utf8");
const buildRendererSource = fs.readFileSync(path.join(root, "scripts/build-renderer.cjs"), "utf8");
const socialClientPath = path.join(root, "ui_kits/pitwall/social.js");
assert.ok(fs.existsSync(path.join(root, "ui_kits/pitwall/Drivers.jsx")), "Apexline should include a dedicated drivers page component");
assert.ok(fs.existsSync(path.join(root, "ui_kits/pitwall/Teams.jsx")), "Apexline should include a dedicated teams page component");
assert.ok(fs.existsSync(path.join(root, "ui_kits/pitwall/TrackMap.jsx")), "Apexline should include a dedicated track map page component");
assert.ok(fs.existsSync(path.join(root, "ui_kits/pitwall/trackmap-circuits.js")), "Apexline should include packaged track map circuit geometry");
assert.ok(fs.existsSync(socialClientPath), "Apexline should include a renderer social client for watch parties");
const socialClientSource = fs.existsSync(socialClientPath) ? fs.readFileSync(socialClientPath, "utf8") : "";
assert.ok(fs.existsSync(path.join(root, "scripts/prepare-vercel-update.cjs")), "Apexline should include a script that writes the Vercel update feed");
assert.ok(fs.existsSync(path.join(root, "updates-site/vercel.json")), "Apexline should include a Vercel static project for update metadata and app zips");
assert.ok(fs.existsSync(path.join(root, "updates-site/package.json")), "Apexline Vercel site should declare function dependencies in the deployed folder");
const updateSitePackage = fs.existsSync(path.join(root, "updates-site/package.json")) ? JSON.parse(fs.readFileSync(path.join(root, "updates-site/package.json"), "utf8")) : {};
const updateSiteGitignore = fs.existsSync(path.join(root, "updates-site/.gitignore")) ? fs.readFileSync(path.join(root, "updates-site/.gitignore"), "utf8") : "";
assert.ok(updateSitePackage.dependencies?.["@neondatabase/serverless"] || updateSitePackage.dependencies?.["@vercel/postgres"], "Apexline Vercel site should install a Neon/Postgres client for social API persistence");
assert.match(updateSiteGitignore, /^\.env/m, "Apexline Vercel site should ignore pulled local env files");
assert.ok(fs.existsSync(path.join(root, "updates-site/public/index.html")), "Apexline update host should include a landing and download page");
assert.ok(fs.existsSync(path.join(root, "updates-site/api/social.js")), "Vercel site should expose social API endpoints for identity, friends, rooms, and chat history");
assert.ok(fs.existsSync(path.join(root, "updates-site/public/favicon.svg")), "Apexline update host should include a website favicon");
assert.ok(fs.existsSync(path.join(root, "updates-site/public/updates/darwin/arm64/releases.json")), "Apexline should include a seed macOS arm64 update feed");
const updateSiteIndex = fs.existsSync(path.join(root, "updates-site/public/index.html")) ? fs.readFileSync(path.join(root, "updates-site/public/index.html"), "utf8") : "";
const updateFeed = JSON.parse(fs.readFileSync(path.join(root, "updates-site/public/updates/darwin/arm64/releases.json"), "utf8"));
assert.match(updateSiteIndex, /Apexline for macOS/, "Apexline landing page should identify the app clearly");
assert.match(updateSiteIndex, /<link rel="icon" href="\/favicon\.svg" type="image\/svg\+xml">/, "Apexline landing page should link the website favicon");
assert.match(updateSiteIndex, new RegExp(`Apexline-${packageJson.version.replace(/\./g, "\\.")}-mac-arm64\\.zip`), "Apexline landing page should download the current macOS artifact");
assert.match(updateSiteIndex, /updates\/darwin\/arm64\/releases\.json/, "Apexline landing page should link the app update feed");
assert.match(updateSiteIndex, /<div class="n">22<\/div><div class="l">Driver timing rows<\/div>/, "Apexline landing page should reflect the 22-driver timing field without implying guaranteed live tracking");
assert.match(updateSiteIndex, /active F1 TV subscription/, "Apexline landing page should be explicit that streams require the user's F1 TV subscription");
assert.match(updateSiteIndex, /not Apple Developer ID signed or notarized/, "Apexline landing page should explain why updates are manual downloads");
assert.doesNotMatch(updateSiteIndex, /Live now|Free during beta|Apple Silicon &amp; Intel|menu bar live timing|24<\/div><div class="l">Grands Prix|broadcast-grade|exactly like the broadcast|private-repo safe|any combination of onboard cameras|Browser tabs needed/, "Apexline landing page should not publish prototype-only, unsupported, or over-polished marketing claims");
[
  "apexline-live-racing-current.png",
  "apexline-screen-track-map.png",
  "apexline-screen-ai-copilot-next-weekend.png",
  "apexline-screen-analytics-ant-ham-monaco.png",
  "apexline-screen-news.png",
  "apexline-screen-drivers.png",
  "apexline-screen-teams.png",
  "apexline-screen-schedule.png",
  "apexline-screen-leaderboards.png",
  "apexline-screen-weekend.png",
].forEach((asset) => {
  const assetPath = path.join(root, "updates-site/public/assets", asset);
  assert.match(updateSiteIndex, new RegExp(asset.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), `${asset} should be referenced by the landing page`);
  const size = readPngSize(assetPath);
  assert.ok(size.width >= 3000 && size.height >= 1800, `${asset} should be a high-resolution screenshot`);
});
assert.equal(updateFeed.releases?.[0]?.updateTo?.url, `https://apexline.io/updates/darwin/arm64/Apexline-${packageJson.version}-mac-arm64.zip`, "Update feed should point at the public Apexline domain");
assert.match(pitwallIndex, /Drivers\.jsx/, "Apexline app should load the drivers page component");
assert.match(pitwallIndex, /Teams\.jsx/, "Apexline app should load the teams page component");
assert.match(pitwallIndex, /trackmap-circuits\.js[\s\S]*TrackMap\.jsx/, "Apexline app should load track map geometry before the Track Map component");
assert.match(buildRendererSource, /"TrackMap"/, "Renderer build should compile the Track Map screen into packaged apps");
assert.match(buildRendererSource, /trackmap-circuits\.js/, "Renderer build should copy Track Map circuit geometry into packaged apps");
assert.match(buildRendererSource, /social\.js/, "Renderer build should copy the watch party social client into packaged apps");
assert.match(mainProcess, /pitwall:updates:check/, "Electron should expose a narrow update-check IPC handler");
assert.match(mainProcess, /pitwall:updates:install/, "Electron should expose a packaged-app update installer IPC handler");
assert.match(mainProcess, /currentAppBundlePath/, "Update installer should locate the current macOS .app bundle before replacing it");
assert.match(mainProcess, /downloadPitWallUpdate/, "Update installer should download the selected release inside the app instead of only opening a browser");
assert.match(mainProcess, /"-x", "-k"/, "Update installer should extract the hosted zip with ditto before replacing the app");
assert.match(mainProcess, /app\.quit\(\)/, "Update installer should quit the current app after scheduling replacement and relaunch");
assert.match(mainProcess, /PITWALL_UPDATE_BASE_URL/, "Electron should read update feed hosting from the packaged app or environment");
assert.doesNotMatch(mainProcess, /GITHUB_TOKEN|VERCEL_TOKEN/, "Update checks must not embed deployment or repository tokens");
assert.match(preload, /updates:[\s\S]*check[\s\S]*install/, "Preload should expose update checking and installation through a narrow updates API");
assert.match(preload, /social:[\s\S]*bootstrap[\s\S]*friends[\s\S]*roomCreate[\s\S]*roomJoin[\s\S]*ablyToken[\s\S]*chatHistory/, "Preload should expose narrow social IPC helpers for watch parties");
assert.match(mainProcess, /pitwall:social:bootstrap/, "Electron main should expose social bootstrap IPC");
assert.match(mainProcess, /pitwall:social:roomCreate/, "Electron main should expose watch party room creation IPC");
assert.match(mainProcess, /pitwall:social:ablyToken/, "Electron main should mint Ably tokens through the hosted backend");
assert.doesNotMatch(mainProcess, /F1TV_AUTH_KEY_PATTERN[\s\S]*pitwall:social/, "Social IPC must stay separate from F1 TV auth/token handling");
assert.match(socialClientSource, /window\.PW_SOCIAL/, "Renderer social client should publish a browser-global watch party API");
assert.match(socialClientSource, /Ably\.Realtime/, "Renderer social client should use Ably for realtime party traffic");
assert.match(socialClientSource, /contentFingerprint/, "Renderer social client should gate host sync by loaded session fingerprint");
assert.match(pitwallIndex, /social\.js[\s\S]*LiveRacing\.jsx/, "Apexline app should load the social client before Live Racing");
assert.match(appShellSource, /id: "drivers"/, "PitWall sidebar should expose a Drivers route");
assert.match(appShellSource, /id: "teams"/, "PitWall sidebar should expose a Teams route");
assert.match(appShellSource, /id: "trackmap"/, "PitWall sidebar should expose a Track Map route");
assert.match(appShellSource, /sec: "The Grid"[\s\S]*id: "drivers"[\s\S]*id: "teams"/, "PitWall sidebar should group Drivers and Teams under The Grid");
assert.match(trackMapSource, /function raceKey/, "Track Map should derive stable race selector keys");
assert.match(trackMapSource, /latestCompletedRace[\s\S]*status === "done"/, "Track Map should fall back to the latest completed race when no live or upcoming race is available");
assert.match(trackMapSource, /<select[\s\S]*className="tm-raceselect__select"[\s\S]*selectedRaceKey/, "Track Map should expose a race selector bound to selected race state");
assert.match(trackMapSource, /const mapLive = live && \(!selectedRaceKey \|\| selectedRaceKey === liveRaceKey\)/, "Track Map should show live cars for automatic live selection or when the selected race is live");
assert.match(preload, /trackMapReplayTiming: \(options = \{\}\)/, "Preload should expose a Track Map-specific replay timing client");
assert.match(mainProcess, /pitwall:data:trackMapReplayTiming/, "Electron main should expose Track Map-specific replay timing snapshots");
assert.match(trackMapSource, /pitwall\.data\.trackMapReplayTiming/, "Track Map should call its dedicated replay timing client");
assert.doesNotMatch(trackMapSource, /pitwall\.data\.replayTiming/, "Track Map should not reuse Live Racing replay timing IPC");
assert.match(trackMapSource, /tm-replayprogress/, "Track Map should render a replay progress control next to the map selector");
assert.match(trackMapSource, /const TRACK_MAP_REPLAY_DATA_POLL_MS = 270/, "Track Map replay data should poll at roughly 3.7 Hz instead of reloading every animation tick");
assert.match(trackMapSource, /const activeTiming = replayActive\s*\?\s*\(Array\.isArray\(replay\.data\?\.timing\) \? replay\.data\.timing : \[\]\)\s*:\s*timing/, "Track Map replay loading should not render stale dashboard timing rows");
assert.match(trackMapSource, /loading: !current\.data/, "Track Map replay polling should only show a loading state before the first replay snapshot");
assert.match(trackMapSource, /raceRelative: true/, "Track Map replay should request race-relative official livetiming snapshots");
assert.match(trackMapSource, /preStartSeconds: 5/, "Track Map replay should start five seconds before the race-relative start anchor");
assert.match(trackMapSource, /i \/ Math\.max\(1, runningRows\.length\)/, "Track Map replay fallback spacing should not collapse blank-interval cars into one marker");
assert.match(trackMapSource, /activeTiming\.filter\(\(row\) => !row\.retired\)/, "Track Map should not draw retired cars on the circuit");
assert.match(trackMapSource, /function fitOfficialSimilarity/, "Track Map should align official positions with a rotation-aware similarity fit instead of axis flips only");
assert.match(trackMapSource, /TRACK_MAP_MOTION_TAU_MS = 200/, "Track Map replay should ease toward targets with velocity-continuous smoothing instead of restarting eased glides");
assert.match(trackMapSource, /TRACK_MAP_DEAD_RECKON_MAX_MS = 900/, "Track Map replay should dead-reckon through short data gaps so cars never stop-start between polls");
assert.match(trackMapSource, /TRACK_MAP_OFFICIAL_TELEPORT_PX = 150/, "Track Map replay should snap instead of gliding across the map on seek-sized position jumps");
assert.match(mainProcess, /function f1TimingInterpolatedPositionRowsAt/, "Track Map replay should interpolate official positions between archive packets instead of stepping per entry");
assert.match(mainProcess, /trackPositionSample: f1TimingPositionSamplePoints\(sessionData\)/, "Track Map replay snapshots should include a session-wide position sample for stable map orientation");
assert.match(trackMapSource, /trackPositionSample/, "Track Map replay should lock projector orientation from the session-wide position sample");
assert.match(trackMapSource, /Math\.floor\(\(elapsedSeconds \* 1000\) \/ TRACK_MAP_REPLAY_DATA_POLL_MS\)/, "Track Map replay fetch bucket should use the configured 3.7 Hz interval");
assert.match(trackMapSource, /carsRef[\s\S]*projectorRef[\s\S]*requestAnimationFrame/, "Track Map replay animation should keep one RAF loop across data updates");
assert.match(trackMapSource, /Math\.abs\(dTarget\) > TRACK_MAP_OFFICIAL_TELEPORT_PX/, "Track Map replay should trust official points and only snap when the target teleports");
assert.match(trackMapSource, /path\.getPointAtLength\(\(sMod \/ trackTotal\) \* L\)/, "Track Map cars should always render on the track centerline via along-path motion");
assert.match(mainProcess, /Math\.floor\(\(elapsedSeconds \* 1000\) \/ 270\)/, "Track Map replay main-process cache should honor the 3.7 Hz fetch cadence");
assert.match(mainProcess, /function f1TimingRaceStartArchiveSeconds/, "Track Map replay should anchor Monaco-style archives to the real race start");
assert.match(mainProcess, /trackMapReplaySessionCache/, "Track Map replay should cache static archive data across seeks");
assert.match(mainProcess, /Math\.abs\(targetUtcMs - rowUtcMs\) <= 4000/, "Track Map replay should reject stale official position packets quickly at data-gap edges");
assert.match(mainProcess, /trackMapReplayStreamCache/, "Track Map replay should fetch full session timing streams once and reuse them across polls");
assert.match(mainProcess, /f1TimingStateCursorCache/, "Replay state merging should resume from a per-stream cursor instead of re-merging from the session start each poll");
assert.match(mainProcess, /date: new Date\(targetUtcMs\)\.toISOString\(\)/, "Interpolated replay positions should be stamped with the interpolation instant, not the older bracket packet");
assert.match(trackMapSource, /motion\.dataAtMs/, "Track Map replay should estimate car speed from the data clock instead of poll arrival times");
assert.match(mainProcess, /function trackMapPositionOnlyTimingRows/, "Track Map replay should render Position.z cars before TimingData rows appear");
assert.match(trackMapSource, /trackPositionBounds/, "Track Map replay should project official positions using full-session coordinate bounds");
assert.match(trackMapSource, /const sprint = sessions\.find[\s\S]*const grandPrix = sessions\.find[\s\S]*return \[sprint, grandPrix\]/, "Sprint weekends should offer Sprint and Race replay choices");
assert.match(trackMapSource, /tm-modal__choice[\s\S]*session\.kind/, "Sprint weekend replay choices should render the selected session kind");
assert.match(trackMapSource, /circuit\.turnNames[\s\S]*nameForTurn/, "Track Map should apply optional named-turn metadata from circuit geometry");
assert.match(trackMapCircuitsSource, /barcelona:[\s\S]*Elf[\s\S]*Campsa[\s\S]*Banc Sabadell/, "Barcelona Track Map should include named corners");
assert.match(trackMapCircuitsSource, /redbull:[\s\S]*Niki Lauda[\s\S]*Jochen Rindt/, "Red Bull Ring Track Map should include named corners");
assert.match(trackMapCircuitsSource, /silverstone:[\s\S]*Maggotts[\s\S]*Becketts[\s\S]*Chapel/, "Silverstone Track Map should include named corners");
assert.match(trackMapCircuitsSource, /monaco:[\s\S]*Sainte Devote[\s\S]*Tabac[\s\S]*La Rascasse/, "Monaco Track Map should include named corners");
assert.match(trackMapCircuitsSource, /belgium:[\s\S]*Eau Rouge[\s\S]*Raidillon[\s\S]*Blanchimont/, "Spa Track Map should include named corners");
assert.match(trackMapCircuitsSource, /bahrain:[\s\S]*Michael Schumacher/, "Bahrain Track Map should include its named first corner");
assert.match(trackMapCircuitsSource, /usa:[\s\S]*Big Red[\s\S]*Epstein/, "COTA Track Map should include named corners");
assert.match(trackMapCircuitsSource, /abudhabi:[\s\S]*North Hairpin[\s\S]*Marsa Corner/, "Yas Marina Track Map should include named corners");
assert.doesNotMatch(trackMapSource, /const live = timing\.length > 0 && Number\(data\.race\?\.lap\) > 0/, "Track Map live mode should not depend on a missing snapshot race lap field");
assert.match(trackMapSource, /liveSession[\s\S]*const live = timing\.length > 0 && Boolean/, "Track Map should activate live mode from live timing rows and live session context");
assert.match(liveRacingSource, /function VolumeControl[\s\S]*aria-label="Volume level"[\s\S]*onInput=/, "Broadcast panes should expose an exact volume level control that updates continuously while dragging");
assert.match(liveRacingSource, /\.pane:hover \.pane__controls,\s*\.pane:focus-within \.pane__controls \{ opacity: 1; \}/, "Pane controls should remain visible while the volume slider has focus during drag");
assert.match(liveRacingSource, /\.pane__controls \{[^}]*z-index: 5/, "Pane controls should sit above broadcast pane chrome so the volume slider can receive drag events");
assert.match(liveRacingSource, /function AudioToggle[\s\S]*aria-label=\{active \? "Mute audio" : "Enable audio"\}/, "Onboard panes should expose a mute/unmute toggle");
assert.doesNotMatch(liveRacingSource, /function OnboardPane[\s\S]*<VolumeControl/, "Onboard panes should not show a numeric volume slider");
assert.match(liveRacingSource, /volumeLevel=\{audioVolume\}/, "Live Racing stream players should receive the selected numeric volume level");
assert.match(liveRacingSource, /PLAYBACK_PROFILES[\s\S]*onboard[\s\S]*maxHeight:\s*540[\s\S]*maxBandwidth:\s*2500000/, "Live Racing should cap small onboard panes to lighter renditions");
assert.match(liveRacingSource, /VIDEO_QUALITY_PROFILES[\s\S]*max[\s\S]*high[\s\S]*medium[\s\S]*low/, "Live Racing should define app-wide video quality profiles");
assert.match(liveRacingSource, /function playbackProfileForQuality[\s\S]*videoQuality/, "Live Racing should map the saved video quality setting into pane playback caps");
assert.match(liveRacingSource, /function buildStreamPlaybackConfig[\s\S]*playbackProfile/, "Live Racing should build player quality and buffer settings from an explicit playback profile");
assert.doesNotMatch(liveRacingSource, /targetLatency \+ \(replay \? 8 : 4\)/, "Live Racing startup buffer should not scale with sync latency and cause large prefetch bursts");
assert.doesNotMatch(liveRacingSource, /Math\.max\(profile\.backBufferLength \|\| 20,\s*targetLatency \+ 10\)/, "Live Racing live back buffer should not scale with sync latency");
assert.match(liveRacingSource, /else if \(!playbackConfig\.hasQualityCap && video\.canPlayType\("application\/vnd\.apple\.mpegurl"\)\)/, "Quality-capped HLS streams should use HLS.js instead of native HLS so caps are enforced");
assert.match(liveRacingSource, /function OnboardPane[\s\S]*<PitWallStreamPlayer[\s\S]*playbackProfile="onboard"/, "Onboard panes should request the lighter playback profile");
assert.match(liveRacingSource, /function isPaneSurfaceClickTarget/, "Live Racing should treat bare video-pane clicks as playback surface clicks");
assert.match(liveRacingSource, /onSurfaceToggle=\{/, "Live Racing panes should route video-surface clicks to playback toggling");
assert.match(liveRacingSource, /function handleSurfaceClick\(event\)[\s\S]*event\.stopPropagation\(\)/, "Video clicks should not bubble into pane-level playback toggles");
const handleSurfaceClickStart = liveRacingSource.indexOf("function handleSurfaceClick(event)");
const handleSurfaceClickEnd = liveRacingSource.indexOf("return (", handleSurfaceClickStart);
assert.notEqual(handleSurfaceClickStart, -1, "Live Racing should define a video surface click handler");
assert.notEqual(handleSurfaceClickEnd, -1, "Live Racing should render after the video surface click handler");
assert.doesNotMatch(liveRacingSource.slice(handleSurfaceClickStart, handleSurfaceClickEnd), /onAudioFocus/, "Video clicks should not toggle audio focus or mute");
assert.doesNotMatch(liveRacingSource, /isPaneSurfaceClickTarget\(event\.target\)\) return;\s*onAudioFocus\?\.\(\);\s*onSurfaceToggle\?\.\(\);/, "Pane surface clicks should toggle playback without toggling audio focus or mute");
assert.match(liveRacingSource, /const tickerRowLimit = [\s\S]*tickerCanFitTop15[\s\S]*15[\s\S]*5/, "Broadcast ticker should only expand from top 5 to top 15 when there is room");
assert.match(liveRacingSource, /top15VideoHeight >= targetVideoHeight \* 0\.9/, "Broadcast ticker should collapse multi-row timing before squeezing the F1 Live video area");
assert.match(liveRacingSource, /setTickerCompact\(rect\.width < 760\)/, "Broadcast ticker should use fewer visible cars on very narrow F1 Live panes");
assert.match(liveRacingSource, /tickerCompact \? 3 : 5/, "Compact broadcast ticker should fall back to the top 3 instead of squeezing five cars");
assert.match(liveRacingSource, /pane__ticker--top15[\s\S]*grid-template-columns: repeat\(5, minmax\(0, 1fr\)\)[\s\S]*grid-auto-rows: var\(--ticker-row-h, 34px\)/, "Top 15 broadcast ticker should render as three compact five-wide rows");
assert.match(liveRacingSource, /broadcastTickerRows/, "Broadcast ticker row count should persist with the live layout panel sizes");
assert.match(liveRacingSource, /pane__ticker-resize/, "Broadcast ticker should expose a drag handle at the video/tile boundary");
assert.match(liveRacingSource, /function startTickerResize[\s\S]*clientY[\s\S]*onTickerRowsChange/, "Broadcast ticker boundary drag should update the visible timing tile rows");
assert.match(liveRacingSource, /function handleTickerResizeKey[\s\S]*ArrowDown[\s\S]*ArrowUp/, "Broadcast ticker row handle should support keyboard resizing");
assert.match(liveRacingSource, /pane__ticker--rows2/, "Broadcast ticker should support a two-row timing tile state");
assert.match(liveRacingSource, /\.tick__main[\s\S]*grid-template-columns: minmax\(0, auto\) minmax\(0, 1fr\)/, "Broadcast ticker cells should place the timing gap beside the driver code");
assert.match(liveRacingSource, /\.tick__bar[\s\S]*align-self: stretch/, "Broadcast ticker team-color bars should stay visible beside each driver");
assert.match(liveRacingSource, /--ticker-row-h[\s\S]*tickerRowHeight/, "Broadcast ticker row height should be measured from available pane space");
assert.match(liveRacingSource, /--ticker-code-size[\s\S]*tickerCodeSize/, "Broadcast ticker typography should scale with measured row height");
assert.match(liveRacingSource, /\.pane__ticker \{[^}]*height: var\(--ticker-total-h, 46px\)/, "Broadcast ticker should occupy its measured height below the video instead of overlaying it");
assert.match(liveRacingSource, /\.pane__replaybar \{[^}]*bottom: calc\(var\(--ticker-total-h, 46px\) \+/, "Replay progress bar should sit over the bottom of the video, above the ticker");
assert.match(liveRacingSource, /function formatTickerInterval[\s\S]*row\?\.interval[\s\S]*row\?\.gap/, "Broadcast ticker should prefer interval to the car ahead before falling back to leader gap");
assert.match(liveRacingSource, /function tickerTyreLabel[\s\S]*tyreLetter[\s\S]*row\?\.age/, "Broadcast ticker should expose compact tyre compound and age context when timing data has it");
assert.match(liveRacingSource, /tickerTyreLabel\(t\)[\s\S]*className="tick__tyre"/, "Broadcast ticker should render tyre context as a compact chip");
assert.match(liveRacingSource, /const \w+ = isTiming \? null : customTilePane\(tile\);[\s\S]*activePaneMap\.get\(\w+\?\.paneId \|\| customPaneIdForSource\(tile\.source\)\)/, "Custom layout F1 TV tiles should render the WORLD pane produced for the main F1 TV feed");
assert.match(liveRacingSource, /const \[isFullScreen, setIsFullScreen\] = React\.useState\(false\)[\s\S]*window\.pitwall\?\.windowState[\s\S]*className=\{"live" \+ \(isFullScreen \? " live--fullscreen" : ""\)\}/, "Live Racing should know native fullscreen state before showing custom traffic lights");
assert.match(liveRacingSource, /\.live__traffic \{[^}]*display: none[\s\S]*\.live--fullscreen \.live__traffic \{[^}]*display: flex/, "Live Racing should hide custom traffic lights in windowed mode and only show them in fullscreen");
assert.match(liveRacingSource, /\.live \{[^}]*--live-window-controls-space: 96px[\s\S]*\.live--fullscreen \{[^}]*--live-window-controls-space: 0px[\s\S]*\.live__bar \{[^}]*padding: 0 var\(--space-7\) 0 max\(var\(--live-window-controls-space\), var\(--space-7\)\)[\s\S]*@media \(max-width: 1600px\) \{[\s\S]*\.live__bar \{[^}]*padding: 0 var\(--space-5\) 0 max\(var\(--live-window-controls-space\), var\(--space-5\)\)/, "Live Racing windowed title bar should reserve native macOS traffic-light space without shifting fullscreen");
assert.match(liveRacingSource, /@media \(max-width: 1600px\) \{[\s\S]*\.live__barright \.pw-btn > span:not\(\.pw-btn__spinner\)/, "Live Racing top bar should compact action labels at Air-sized widths instead of overlapping controls");
assert.match(liveRacingSource, /@media \(max-width: 1180px\) \{[\s\S]*\.live__grid\[data-layout="focus"\][\s\S]*grid-template-rows: minmax\(120px, clamp\(120px, 22vh, 180px\)\) minmax\(320px, 1fr\)/, "Compact focus layout should preserve a visible onboard row and a usable F1 Live pane");
assert.match(liveRacingSource, /@media \(max-width: 1180px\) \{[\s\S]*\.live__grid\[data-layout="focus"\] \.pane--bc \.pane__video \{ object-fit: contain; object-position: center center; \}/, "Compact focus layout should show the full F1 Live feed instead of cropping it aggressively");
assert.match(liveRacingSource, /\.live__timing \{[^}]*container-type: inline-size/, "Live timing sidebar should be a container for narrow-width responsive chrome");
assert.match(liveRacingSource, /@container \(max-width: 380px\) \{[\s\S]*\.live__timinghd \{[\s\S]*grid-template-areas:[\s\S]*"title actions"[\s\S]*"clock clock"/, "Live timing header should stack the lap clock below the flag/actions on narrow sidebars");
assert.match(liveRacingSource, /const fallbackCodes = timingRows\.map[\s\S]*D\.drivers\.map\(\(driver\) => driver\.code\)/, "Intelligent focus mode should keep onboard slots populated from the roster while timing warms");
const liveBattleSandbox = vm.runInNewContext(`(() => {
  ${extractNamedFunction(liveRacingSource, "activeBattleCandidateScore")}
  ${extractNamedFunction(liveRacingSource, "timingGapSeconds")}
  ${extractNamedFunction(liveRacingSource, "intelligentOnboardCodes")}
  ${extractNamedFunction(liveRacingSource, "buildActiveBattlePairs")}
  return { intelligentOnboardCodes, buildActiveBattlePairs };
})()`);
const closeBattleRows = [
  { pos: 1, code: "VER", interval: "LEADER" },
  { pos: 2, code: "HAM", interval: "+3.910" },
  { pos: 3, code: "LEC", interval: "+1.500" },
  { pos: 4, code: "HAD", interval: "+2.144" },
  { pos: 5, code: "RUS", interval: "+2.607" },
  { pos: 6, code: "PIA", interval: "+4.721" },
  { pos: 7, code: "GAS", interval: "+2.055" },
  { pos: 8, code: "NOR", interval: "+0.581" },
];
const closeBattleFocus = liveBattleSandbox.intelligentOnboardCodes({
  timingRows: closeBattleRows,
  selectedCode: "VER",
  fallbackCodes: closeBattleRows.map((row) => row.code),
  sessionKind: "Race",
});
assert.deepEqual(JSON.parse(JSON.stringify(closeBattleFocus.slice(1, 3))), ["GAS", "NOR"], "Intelligent focus onboards should score a close lower-field fight above a looser higher-field pair");
const rankedActiveBattles = liveBattleSandbox.buildActiveBattlePairs(closeBattleRows);
assert.deepEqual(JSON.parse(JSON.stringify([rankedActiveBattles[0]?.a, rankedActiveBattles[0]?.b])), ["GAS", "NOR"], "Active battle pairs should rank by battle quality instead of position alone");
assert.match(liveRacingSource, /Watch Party/, "Live Racing should expose a Watch Party control");
assert.match(liveRacingSource, /party-tray/, "Live Racing should render a draggable non-modal party tray");
assert.match(liveRacingSource, /partyTrayPosition/, "Live Racing should persist the draggable party tray position");
assert.match(liveRacingSource, /wpc__head[\s\S]*wpc__avstack[\s\S]*wpc__sync/, "Watch Party tray (Glass Minimal) should lead with an avatar stack and a sync pill header");
assert.match(liveRacingSource, /wpc__chat[\s\S]*wpc-msg[\s\S]*wpc__compose/, "Watch Party tray should render chat messages above a compose row");
assert.match(liveRacingSource, /partyChatRef[\s\S]*scrollTop[\s\S]*scrollHeight[\s\S]*partyMessages/, "Watch Party chat should auto-scroll after local or remote messages render");
assert.match(liveRacingSource, /<div className="wpc__chat" ref=\{partyChatRef\}>/, "Watch Party chat should attach its auto-scroll ref to the scroll container");
assert.match(liveRacingSource, /renderPartyToasts[\s\S]*wpt-card[\s\S]*Watch Party/, "Live Racing should render stacking Card mini toasts for party messages");
assert.match(liveRacingSource, /wp-unread/, "Watch Party launcher should carry an unread message badge");
assert.match(liveRacingSource, /publishHostSync/, "Live Racing should publish host-authoritative watch party sync");
assert.match(liveRacingSource, /applyRemotePartySync/, "Live Racing should apply matching remote watch party sync");
assert.match(liveRacingSource, /partySyncRoleRef[\s\S]*applyRemotePartySync[\s\S]*partySyncRoleRef\.current === "host"/, "Watch Party guests should not ignore sync events through a stale host-role closure");
assert.match(liveRacingSource, /hostPartyPlaybackSnapshot[\s\S]*video\.paused[\s\S]*playing/, "Watch Party host sync should publish the actual player paused or playing state");
assert.match(liveRacingSource, /event\.type === "presence"[\s\S]*partyMemberCountRef[\s\S]*publishHostSync\(\)/, "Watch Party host should auto-sync guests when the presence count increases");
const partyDragSandbox = {
  partyTrayPosition: { x: 320, y: 80 },
  partyDragRef: { current: null },
};
vm.createContext(partyDragSandbox);
vm.runInContext(`${extractNamedFunction(liveRacingSource, "startPartyTrayDrag")}; this.startPartyTrayDrag = startPartyTrayDrag;`, partyDragSandbox);
let capturedPartyPointer = false;
let preventedPartyPointerDefault = false;
partyDragSandbox.startPartyTrayDrag({
  button: 0,
  pointerId: 9,
  clientX: 420,
  clientY: 92,
  target: { closest: (selector) => selector.includes("button") ? {} : null },
  currentTarget: { setPointerCapture: () => { capturedPartyPointer = true; } },
  preventDefault: () => { preventedPartyPointerDefault = true; },
});
assert.equal(partyDragSandbox.partyDragRef.current, null, "Watch Party header buttons should not start a tray drag");
assert.equal(capturedPartyPointer, false, "Watch Party header buttons should not capture the pointer before click");
assert.equal(preventedPartyPointerDefault, false, "Watch Party header buttons should not prevent the close click");
assert.match(settingsSource, /Friends/, "Settings should expose a Friends section");
assert.match(settingsSource, /friendCode/, "Settings should show the user's shareable friend code");
assert.match(settingsSource, /friends-add-form[\s\S]*align-items:\s*end/, "Friends add-code controls should align the Add button with the input control");
assert.match(settingsSource, /className="f1-login__fields friends-add-form"/, "Friends add-code row should use the centered form alignment");
assert.match(settingsSource, /id: "account", label: "Account"/, "Settings should label the local profile and F1 TV section as Account");
assert.match(settingsSource, /PROFILE_IMAGE_MAX_BYTES = 2 \* 1024 \* 1024/, "Profile photos should allow uploads up to 2 MB");
assert.match(settingsSource, /PNG, JPG, GIF, WebP, or SVG under 2 MB\./, "Profile photo helper text should show the 2 MB limit");
assert.match(settingsSource, /<div className="f1-login__status">\s*\{\(f1SignedIn \|\| f1BrowserSignedIn\)[\s\S]*Sign out[\s\S]*<Badge tone=\{f1BadgeTone\} dot>\{f1BadgeLabel\}<\/Badge>/, "F1 TV sign-out should sit beside the ready badge");
assert.match(settingsSource, /\{!f1SignedIn && \(\s*<>\s*<div className="f1-login__fields">/, "F1 TV credential fields should be hidden once playback is ready");

const syncSandbox = { window: {} };
vm.createContext(syncSandbox);
vm.runInContext(syncSource, syncSandbox, { filename: "ui_kits/pitwall/sync.js" });
const partySync = syncSandbox.window.PW_SYNC.partySync;
assert.equal(partySync.shouldApply({ sequence: 3, contentFingerprint: "race:1" }, { lastSequence: 2, contentFingerprint: "race:1" }), true, "Watch party sync should accept newer matching host state");
assert.equal(partySync.shouldApply({ sequence: 2, contentFingerprint: "race:1" }, { lastSequence: 3, contentFingerprint: "race:1" }), false, "Watch party sync should ignore stale host state");
assert.equal(partySync.shouldApply({ sequence: 4, contentFingerprint: "race:2" }, { lastSequence: 3, contentFingerprint: "race:1" }), false, "Watch party sync should reject mismatched content");
assert.equal(partySync.replayDecision({ masterTime: 42, playing: false }, { contentFingerprint: "race:1" }).playing, false, "Watch party replay sync should preserve host pause state");
assert.equal(partySync.liveDecision({ targetLatency: 8, playing: false }, { liveLatency: 9 }).playing, false, "Watch party live sync should preserve host pause state");
assert.equal(partySync.liveDecision({ targetLatency: 8 }, { liveLatency: 9 }).playbackRate, 1.2, "Watch party live sync should reuse latency catch-up behavior");

function extractNamedFunction(source, name) {
  let start = source.indexOf(`function ${name}`);
  assert.notEqual(start, -1, `${name} should exist`);
  if (source.slice(Math.max(0, start - 6), start) === "async ") start -= 6;
  const signatureStart = source.indexOf("(", start);
  assert.notEqual(signatureStart, -1, `${name} should have a parameter list`);
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
  assert.notEqual(bodyStart, -1, `${name} should have a function body`);
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

const parseDriverRecentForm = vm.runInNewContext(`(${extractNamedFunction(mainProcess, "parseDriverRecentForm")})`);
const recentForm = parseDriverRecentForm({
  MRData: {
    RaceTable: {
      Races: [
        { round: "1", raceName: "Opening Grand Prix", Circuit: { Location: { locality: "One" } }, Results: [{ position: "4", Driver: { code: "ANT" } }] },
        { round: "2", raceName: "Second Grand Prix", Circuit: { Location: { locality: "Two" } }, Results: [{ position: "2", Driver: { code: "ANT" } }] },
      ],
    },
  },
});
assert.deepEqual(JSON.parse(JSON.stringify(recentForm.formRounds)), [
  { rnd: 1, gp: "Opening Grand Prix", loc: "One" },
  { rnd: 2, gp: "Second Grand Prix", loc: "Two" },
], "Recent form should use completed race metadata from live results");
assert.deepEqual(JSON.parse(JSON.stringify(recentForm.driverForm.ANT)), [4, 2], "Recent form should map driver finishing positions by code");
const driverResultsUrlLine = mainProcess.match(/const DRIVER_RESULTS_URL = [^\n]+/)?.[0] || "";
assert.equal(driverResultsUrlLine, "", "Recent form should not fetch the all-season race results page");
assert.match(mainProcess, /function driverResultsUrl\(round\)[\s\S]*\/current\/\$\{encodeURIComponent\(String\(round\)\)\}\/results\.json\?limit=100/, "Recent form should fetch bounded per-race results for recent completed rounds");
const recentDriverResultsSource = extractNamedFunction(mainProcess, "fetchRecentDriverResults");
assert.match(mainProcess, /const RECENT_DRIVER_RESULTS_CACHE_MS = 1000 \* 60 \* 30/, "Recent per-round driver results should use an explicit memory cache TTL");
assert.match(mainProcess, /let recentDriverResultsCache = new Map\(\)/, "Recent per-round driver results should keep a memory cache between live-data refreshes");
assert.match(recentDriverResultsSource, /recentDriverResultsCache\.get\(cacheKey\)[\s\S]*Date\.now\(\) - cached\.createdAt < RECENT_DRIVER_RESULTS_CACHE_MS/, "Recent per-round driver results should reuse fresh cached race results");
assert.match(recentDriverResultsSource, /recentDriverResultsCache\.set\(cacheKey, \{ createdAt: Date\.now\(\), race \}\)/, "Recent per-round driver results should cache successful race result pages");
const raceWinnerSandbox = vm.runInNewContext(`(() => {
  ${[
    "compactText",
    "fallbackDriverName",
    "raceWinnerName",
    "parseRaceWinners",
    "applyScheduleWinners",
    "openF1RaceWinnerName",
  ].map((name) => extractNamedFunction(mainProcess, name)).join("\n")}
  return { parseRaceWinners, applyScheduleWinners, openF1RaceWinnerName };
})()`);
const raceWinnerRows = raceWinnerSandbox.parseRaceWinners({
  MRData: {
    RaceTable: {
      Races: [
        { round: "1", raceName: "Australian Grand Prix", Results: [{ position: "1", Driver: { givenName: "Oscar", familyName: "Piastri", code: "PIA" } }] },
      ],
    },
  },
});
assert.deepEqual(JSON.parse(JSON.stringify(raceWinnerRows)), [
  { rnd: 1, name: "Australian Grand Prix", winner: "Oscar Piastri" },
], "Race result feed should expose completed race winners");
assert.equal(raceWinnerSandbox.parseRaceWinners({
  MRData: {
    RaceTable: {
      Races: [
        { round: "2", raceName: "Chinese Grand Prix", Results: [{ position: "1", Driver: { givenName: "Andrea Kimi", familyName: "Antonelli", code: "ANT" } }] },
      ],
    },
  },
}, [{ code: "ANT", name: "Kimi Antonelli", num: 12 }])[0].winner, "Kimi Antonelli", "Race winners should use the app roster name when the result feed includes a known driver code");
assert.equal(raceWinnerSandbox.openF1RaceWinnerName(
  { position: 1, driver_number: 12, driver_name: "Kimi ANTONELLI" },
  [{ driver_number: 12, full_name: "Kimi ANTONELLI", name_acronym: "ANT" }],
  [{ code: "ANT", name: "Kimi Antonelli", num: 12 }]
), "Kimi Antonelli", "OpenF1 race winners should use the app roster name instead of uppercase feed names");
const raceWinnerFetchSource = extractNamedFunction(mainProcess, "fetchMissingOpenF1RaceWinners");
assert.match(raceWinnerFetchSource, /Promise\.all/, "OpenF1 winner backfill should run missing-race lookups concurrently and rely on the shared OpenF1 limiter");
assert.doesNotMatch(raceWinnerFetchSource, /requestOpenF1AnalyticsWithRetry\("drivers"/, "OpenF1 winner backfill should not fetch driver rows when session results plus the app roster can name the winner");
assert.doesNotMatch(raceWinnerFetchSource, /await wait\(OPENF1_ANALYTICS_REQUEST_DELAY_MS\)/, "OpenF1 winner backfill should not add a manual per-race sleep after the shared OpenF1 limiter has already paced requests");
assert.match(mainProcess, /const RACE_WINNER_CACHE_MS = 1000 \* 60 \* 30/, "OpenF1 race winner backfill should use an explicit memory cache TTL");
assert.match(mainProcess, /let raceWinnerCache = new Map\(\)/, "OpenF1 race winner backfill should keep a memory cache between live-data refreshes");
assert.match(raceWinnerFetchSource, /raceWinnerCache\.get\(cacheKey\)[\s\S]*Date\.now\(\) - cached\.createdAt < RACE_WINNER_CACHE_MS/, "OpenF1 race winner backfill should reuse fresh cached winners by season and meeting");
assert.match(raceWinnerFetchSource, /raceWinnerCache\.set\(cacheKey, \{ createdAt: Date\.now\(\), winner: row \}\)/, "OpenF1 race winner backfill should cache successful winner rows");
assert.equal(raceWinnerSandbox.applyScheduleWinners([
  { rnd: 1, name: "Australian Grand Prix", status: "done", winner: "" },
], raceWinnerRows)[0].winner, "Oscar Piastri", "Completed schedule rows should show the actual race winner");
assert.equal(raceWinnerSandbox.applyScheduleWinners([
  { rnd: 3, name: "Japanese Grand Prix", meetingKey: 1283, status: "done", winner: "" },
], [{ meetingKey: 1283, winner: "Max Verstappen" }])[0].winner, "Max Verstappen", "OpenF1 race winners should fill completed schedule rows that Jolpica has not published yet");
assert.match(mainProcess, /fetchMissingOpenF1RaceWinners[\s\S]*sessionResult[\s\S]*applyScheduleWinners/, "Live data enrichment should backfill missing completed-race winners from OpenF1 session results");

const f1TimingAnalyticsSandbox = vm.runInNewContext(`(() => {
  ${[
    "finiteNumber",
    "teamAbbr",
    "f1TimingAnalyticsDriverRows",
  ].map((name) => extractNamedFunction(mainProcess, name)).join("\n")}
  return { finiteNumber, f1TimingAnalyticsDriverRows };
})()`);
const f1TimingAnalyticsRows = f1TimingAnalyticsSandbox.f1TimingAnalyticsDriverRows(Array.from({ length: 16 }, (_, index) => ({
  pos: index + 1,
  code: `D${String(index).padStart(2, "0")}`,
  number: index + 1,
  lastLapDuration: 90 + index / 10,
  bestLapDuration: 89 + index / 10,
  sessionLap: 20 + index,
  gap: index === 0 ? "LEADER" : `+${index}.000`,
  age: 12,
  comp: "medium",
  sectors: { s1: ["green"], s2: ["yellow"], s3: ["purple"] },
  telemetry: { speed: 200 + index },
})), []);
assert.equal(f1TimingAnalyticsRows.length, 16, "Formula 1 timing fallback should preserve a full driver field");
assert.equal(f1TimingAnalyticsRows.filter((row) => f1TimingAnalyticsSandbox.finiteNumber(row.position) != null).length, 16, "Formula 1 timing fallback should expose positions");
assert.equal(f1TimingAnalyticsRows.filter((row) => f1TimingAnalyticsSandbox.finiteNumber(row.resultDuration) != null || f1TimingAnalyticsSandbox.finiteNumber(row.fastestLap) != null).length, 16, "Formula 1 timing fallback should expose lap times");
assert.equal(f1TimingAnalyticsRows.filter((row) => f1TimingAnalyticsSandbox.finiteNumber(row.laps) != null && Number(row.laps) > 0).length, 16, "Formula 1 timing fallback should expose lap counts");
const analyticsCacheSandbox = vm.runInNewContext(`(() => {
  ${[
    "finiteNumber",
    "analyticsSessionIsImmutable",
    "analyticsSessionHasPublishedRows",
  ].map((name) => extractNamedFunction(mainProcess, name)).join("\n")}
  return { analyticsSessionHasPublishedRows };
})()`);
assert.equal(analyticsCacheSandbox.analyticsSessionHasPublishedRows({ source: "Formula 1 livetiming", counts: { laps: 20, position: 20 } }), false, "Cached Formula 1 timing recap rows should not block a fresh OpenF1 recap load");
assert.equal(analyticsCacheSandbox.analyticsSessionHasPublishedRows({ source: "OpenF1", counts: { laps: 20, position: 20 } }), true, "Published OpenF1 rows should satisfy session cache checks");
assert.doesNotMatch(mainProcess, /const hasPublishedRows = \["drivers"/, "Roster-only OpenF1 responses should not block the Formula 1 timing fallback");
assert.match(mainProcess, /analyticsSessionHasPublishedRows[\s\S]*\["laps", "position", "sessionResult", "stints"\][\s\S]*aliasDiskEntry\?\.data && analyticsSessionHasPublishedRows/, "Roster-only OpenF1 analytics cache entries should not block the Formula 1 timing fallback");
assert.match(mainProcess, /f1TimingArchiveIdentityFromOptions[\s\S]*raceName[\s\S]*raceStartsAt[\s\S]*resolveF1TimingArchiveBase\(optionIdentity\.meeting, optionIdentity\.session\)/, "Formula 1 timing fallback should resolve archives from the selected schedule race identity before trusting OpenF1 meeting metadata");
assert.doesNotMatch(mainProcess, /if \(shouldPreferF1TimingAnalytics\(options\)\)/, "Schedule-identified weekend recaps should ask OpenF1 before trying Formula 1 timing");
assert.doesNotMatch(mainProcess, /analyticsArchiveAliasKey/, "Formula 1 archive cache aliases should not shadow OpenF1 recap data");
assert.match(mainProcess, /buildF1TimingAnalyticsSessionData[\s\S]*parseF1TimingArchiveRows[\s\S]*f1TimingAnalyticsDriverRows/, "Session analytics should fall back to Formula 1 timing archives when OpenF1 analytics rows are empty");

const jolpicaScheduleSandbox = vm.runInNewContext(`(() => {
  ${[
    "sessionDate",
    "compactText",
    "isCancelledF12026RaceName",
    "matchOpenF1Meeting",
    "normalizeScheduleRoundOrder",
    "parseSchedule",
  ].map((name) => extractNamedFunction(mainProcess, name)).join("\n")}
  return { normalizeScheduleRoundOrder, parseSchedule };
})()`);
const correctedSchedule = jolpicaScheduleSandbox.parseSchedule({
  MRData: {
    RaceTable: {
      Races: [
        { round: "1", raceName: "Australian Grand Prix", date: "2026-03-08", time: "05:00:00Z", Circuit: { circuitName: "Albert Park Grand Prix Circuit", Location: { locality: "Melbourne", country: "Australia" } } },
        { round: "2", raceName: "Chinese Grand Prix", date: "2026-03-15", time: "07:00:00Z", Circuit: { circuitName: "Shanghai International Circuit", Location: { locality: "Shanghai", country: "China" } } },
        { round: "3", raceName: "Japanese Grand Prix", date: "2026-03-29", time: "05:00:00Z", Circuit: { circuitName: "Suzuka Circuit", Location: { locality: "Suzuka", country: "Japan" } } },
        { round: "4", raceName: "Bahrain Grand Prix", date: "2026-04-12", time: "15:00:00Z", Circuit: { circuitName: "Bahrain International Circuit", Location: { locality: "Sakhir", country: "Bahrain" } } },
        { round: "5", raceName: "Saudi Arabian Grand Prix", date: "2026-04-19", time: "17:00:00Z", Circuit: { circuitName: "Jeddah Corniche Circuit", Location: { locality: "Jeddah", country: "Saudi Arabia" } } },
        { round: "6", raceName: "Miami Grand Prix", date: "2026-05-03", time: "20:00:00Z", Circuit: { circuitName: "Miami International Autodrome", Location: { locality: "Miami", country: "USA" } } },
        { round: "7", raceName: "Canadian Grand Prix", date: "2026-05-24", time: "18:00:00Z", Circuit: { circuitName: "Circuit Gilles Villeneuve", Location: { locality: "Montreal", country: "Canada" } } },
        { round: "8", raceName: "Monaco Grand Prix", date: "2026-06-07", time: "13:00:00Z", Circuit: { circuitName: "Circuit de Monaco", Location: { locality: "Monte Carlo", country: "Monaco" } } },
        { round: "9", raceName: "Spanish Grand Prix", date: "2026-06-14", time: "13:00:00Z", Circuit: { circuitName: "Circuit de Barcelona-Catalunya", Location: { locality: "Barcelona", country: "Spain" } } },
      ],
    },
  },
}, [
  { meeting_key: 1281, meeting_name: "Australian Grand Prix", circuit_short_name: "Albert Park", location: "Melbourne", country_name: "Australia", date_start: "2026-03-06T01:30:00+00:00" },
  { meeting_key: 1282, meeting_name: "Chinese Grand Prix", circuit_short_name: "Shanghai", location: "Shanghai", country_name: "China", date_start: "2026-03-13T03:30:00+00:00" },
  { meeting_key: 1283, meeting_name: "Japanese Grand Prix", circuit_short_name: "Suzuka", location: "Suzuka", country_name: "Japan", date_start: "2026-03-27T02:30:00+00:00" },
  { meeting_key: 1284, meeting_name: "Miami Grand Prix", circuit_short_name: "Miami", location: "Miami", country_name: "United States", date_start: "2026-05-01T16:30:00+00:00" },
  { meeting_key: 1285, meeting_name: "Canadian Grand Prix", circuit_short_name: "Montreal", location: "Montreal", country_name: "Canada", date_start: "2026-05-22T17:30:00+00:00" },
  { meeting_key: 1286, meeting_name: "Monaco Grand Prix", circuit_short_name: "Monaco", location: "Monte Carlo", country_name: "Monaco", date_start: "2026-06-05T11:30:00+00:00" },
  { meeting_key: 1287, meeting_name: "Barcelona Grand Prix", circuit_short_name: "Barcelona-Catalunya", location: "Barcelona", country_name: "Spain", date_start: "2026-06-12T11:30:00+00:00" },
]);
assert.equal(correctedSchedule.length, 7, "Jolpica schedules should drop cancelled races that are absent from active OpenF1 meetings");
assert.deepEqual(correctedSchedule.map((race) => [race.name, race.rnd]).slice(-2), [["Monaco Grand Prix", 6], ["Spanish Grand Prix", 7]], "Jolpica schedules should use active OpenF1 meeting order when cancelled races leave stale round numbers");
const normalizedCachedSchedule = jolpicaScheduleSandbox.normalizeScheduleRoundOrder([
  { rnd: 1, name: "Australian Grand Prix", meetingKey: 1281 },
  { rnd: 2, name: "Chinese Grand Prix", meetingKey: 1282 },
  { rnd: 3, name: "Japanese Grand Prix", meetingKey: 1283 },
  { rnd: 4, name: "Bahrain Grand Prix", meetingKey: null },
  { rnd: 5, name: "Saudi Arabian Grand Prix", meetingKey: null },
  { rnd: 6, name: "Miami Grand Prix", meetingKey: 1284 },
  { rnd: 7, name: "Canadian Grand Prix", meetingKey: 1285 },
  { rnd: 8, name: "Monaco Grand Prix", meetingKey: 1286 },
  { rnd: 9, name: "Spanish Grand Prix", meetingKey: 1287 },
], { removeCancelled2026: true });
assert.deepEqual(normalizedCachedSchedule.map((race) => [race.name, race.rnd]).slice(-2), [["Monaco Grand Prix", 6], ["Spanish Grand Prix", 7]], "Cached schedules should normalize stale round numbers before the UI renders");
const non2026ScheduleWithBahrain = jolpicaScheduleSandbox.normalizeScheduleRoundOrder([
  { rnd: 1, name: "Bahrain Grand Prix", meetingKey: null },
  { rnd: 2, name: "Saudi Arabian Grand Prix", meetingKey: null },
  { rnd: 3, name: "Australian Grand Prix", meetingKey: 1281 },
]);
assert.deepEqual(
  non2026ScheduleWithBahrain.map((race) => race.name),
  ["Bahrain Grand Prix", "Saudi Arabian Grand Prix", "Australian Grand Prix"],
  "Schedule normalization should not remove Bahrain or Saudi rows without explicit 2026 context"
);
const partiallyMatchedSchedule = jolpicaScheduleSandbox.normalizeScheduleRoundOrder([
  { rnd: 1, name: "Australian Grand Prix", meetingKey: 1281 },
  { rnd: 2, name: "Chinese Grand Prix", meetingKey: 1282 },
  { rnd: 3, name: "Japanese Grand Prix", meetingKey: null },
  { rnd: 4, name: "Miami Grand Prix", meetingKey: 1284 },
]);
assert.deepEqual(
  partiallyMatchedSchedule.map((race) => race.name),
  ["Australian Grand Prix", "Chinese Grand Prix", "Japanese Grand Prix", "Miami Grand Prix"],
  "Schedule normalization should preserve unmatched non-cancelled races"
);
assert.match(dataProviderSource, /isCancelledF12026RaceName[\s\S]*normalizeScheduleRoundOrder[\s\S]*normalizeScheduleData/, "Renderer data provider should normalize stale 2026 cancelled-race schedules before any screen renders");
assert.match(liveRacingSource, /isCancelledF12026RaceName[\s\S]*normalizeRaceLibrary[\s\S]*races:[\s\S]*filter[\s\S]*map/, "Live Racing session library should normalize stale 2026 cancelled-race weekends");

const parseOpenDrivers = vm.runInNewContext(`(${extractNamedFunction(mainProcess, "parseOpenDrivers")})`);
const parsedKnownOpenDriver = parseOpenDrivers([{
  name_acronym: "ANT",
  full_name: "Kimi Antonelli",
  driver_number: 12,
  team_name: "Mercedes",
  team_colour: "27f4d2",
  headshot_url: "https://static.openf1.example/ant-small.png",
}], [{
  code: "ANT",
  name: "Kimi Antonelli",
  num: 12,
  team: "Mercedes",
  color: "var(--team-mercedes)",
  abbr: "MER",
  image: "data:image/svg+xml,%3Csvg%3E%3C/svg%3E",
  remoteImage: "https://media.formula1.com/image/upload/c_fill%2Cw_720/q_auto/v1740000001/common/f1/2026/mercedes/andant01/2026mercedesandant01right.webp",
}]);
assert.equal(parsedKnownOpenDriver[0].image, "https://static.openf1.example/ant-small.png", "OpenF1 headshots should remain available for compact live avatars");
assert.equal(parsedKnownOpenDriver[0].remoteImage, "https://media.formula1.com/image/upload/c_fill%2Cw_720/q_auto/v1740000001/common/f1/2026/mercedes/andant01/2026mercedesandant01right.webp", "Known drivers should preserve high-resolution Formula 1 portraits for detail screens");
const parsedOpenDriverWithoutHeadshot = parseOpenDrivers([{
  name_acronym: "LIN",
  full_name: "Arvid Lindblad",
  driver_number: 41,
  team_name: "Racing Bulls",
  team_colour: "6692ff",
  headshot_url: "",
}], [{
  code: "LIN",
  name: "Arvid Lindblad",
  num: 41,
  team: "Racing Bulls",
  color: "var(--team-racingbulls)",
  abbr: "RB",
  image: "data:image/svg+xml,%3Csvg%3E%3C/svg%3E",
  remoteImage: "../../assets/drivers/lin-headshot.jpg",
}]);
assert.equal(parsedOpenDriverWithoutHeadshot[0].image, "../../assets/drivers/lin-headshot.jpg", "OpenF1 drivers without headshots should use vendored driver portraits before packaged helmets");
assert.equal(parsedOpenDriverWithoutHeadshot[0].remoteImage, "../../assets/drivers/lin-headshot.jpg", "OpenF1 drivers without headshots should keep vendored portraits for detail screens");

const openF1ScheduleSandbox = vm.runInNewContext(`(() => {
  ${[
    "normalizeOpenF1SessionKind",
    "openF1SessionKindLabel",
    "parseOpenF1Schedule",
  ].map((name) => extractNamedFunction(mainProcess, name)).join("\n")}
  return { parseOpenF1Schedule };
})()`);
const openF1Schedule = openF1ScheduleSandbox.parseOpenF1Schedule([
  {
    meeting_key: 1286,
    meeting_name: "Monaco Grand Prix",
    circuit_short_name: "Monaco",
    location: "Monte Carlo",
    country_name: "Monaco",
    date_start: "2026-06-05T11:30:00+00:00",
  },
  {
    meeting_key: 1287,
    meeting_name: "Barcelona Grand Prix",
    circuit_short_name: "Barcelona-Catalunya",
    location: "Barcelona",
    country_name: "Spain",
    date_start: "2026-06-12T11:30:00+00:00",
  },
], [
  { meeting_key: 1286, session_name: "Practice 1", session_type: "Practice", date_start: "2026-06-05T11:30:00+00:00", date_end: "2026-06-05T12:30:00+00:00" },
  { meeting_key: 1286, session_name: "Qualifying", session_type: "Qualifying", date_start: "2026-06-06T14:00:00+00:00", date_end: "2026-06-06T15:00:00+00:00" },
  { meeting_key: 1286, session_name: "Race", session_type: "Race", date_start: "2026-06-07T13:00:00+00:00", date_end: "2026-06-07T15:00:00+00:00" },
], Date.parse("2026-06-07T16:01:00+00:00"));
assert.equal(openF1Schedule.length, 2, "OpenF1 meetings should backfill the dashboard schedule when Jolpica is unavailable");
assert.equal(openF1Schedule[0].name, "Monaco Grand Prix", "OpenF1 schedule fallback should preserve the current weekend name");
assert.equal(openF1Schedule[0].status, "done", "OpenF1 schedule fallback should mark just-finished race weekends as done");
assert.deepEqual(Array.from(openF1Schedule[0].sessions, (session) => session.kind), ["Practice 1", "Qualifying", "Race"], "OpenF1 schedule fallback should include session times");
assert.equal(openF1Schedule[0].sessions[0].endsAt, "2026-06-05T12:30:00.000Z", "OpenF1 schedule fallback should carry session end times for live status recalculation");
const openF1EndedPractice = openF1ScheduleSandbox.parseOpenF1Schedule([
  { meeting_key: 1287, meeting_name: "Barcelona Grand Prix", date_start: "2026-06-12T11:30:00+00:00" },
], [
  { meeting_key: 1287, session_name: "Practice 2", session_type: "Practice", date_start: "2026-06-12T15:00:00+00:00", date_end: "2026-06-12T16:00:00+00:00" },
], Date.parse("2026-06-12T16:01:00+00:00"));
assert.equal(openF1EndedPractice[0].sessions[0].status, "done", "OpenF1 schedule fallback should stop marking practice live after its official end time");

const f1TvContentScoreSandbox = vm.runInNewContext(`(() => {
  ${[
    "scoreF1TvContentCandidate",
  ].map((name) => extractNamedFunction(mainProcess, name)).join("\n")}
  return { scoreF1TvContentCandidate };
})()`);
const f1TvMonacoOptions = { raceName: "Monaco Grand Prix", sessionKind: "Race" };
const f1TvFormula1RaceScore = f1TvContentScoreSandbox.scoreF1TvContentCandidate("2026 Monaco Grand Prix Replay", f1TvMonacoOptions);
const f1TvFormula2RaceScore = f1TvContentScoreSandbox.scoreF1TvContentCandidate("Formula 2 Monaco Feature Race Replay", f1TvMonacoOptions);
const f1TvKidsRaceScore = f1TvContentScoreSandbox.scoreF1TvContentCandidate("2026 Monaco GP F1 Kids Replay", f1TvMonacoOptions);
const f1TvPorscheRaceScore = f1TvContentScoreSandbox.scoreF1TvContentCandidate("2026 Monaco GP PSC Race Replay", f1TvMonacoOptions);
assert.ok(f1TvFormula1RaceScore > f1TvFormula2RaceScore, "F1 TV replay resolver should prefer the Formula 1 Monaco race over support-series races");
assert.ok(f1TvFormula1RaceScore > f1TvKidsRaceScore, "F1 TV replay resolver should prefer the main Monaco race over F1 Kids alternates");
assert.ok(f1TvFormula1RaceScore > f1TvPorscheRaceScore, "F1 TV replay resolver should prefer the main Monaco race over Porsche Supercup support races");
assert.ok(
  f1TvContentScoreSandbox.scoreF1TvContentCandidate("2026 Monaco GP Practice 1 Replay", { raceName: "Monaco Grand Prix", sessionKind: "Practice 1" })
    > f1TvContentScoreSandbox.scoreF1TvContentCandidate("2026 Monaco Grand Prix Replay", { raceName: "Monaco Grand Prix", sessionKind: "Practice 1" }),
  "F1 TV replay resolver should prefer requested practice sessions over the generic Grand Prix race"
);
assert.ok(
  f1TvContentScoreSandbox.scoreF1TvContentCandidate("2026 Monaco GP Qualifying Replay", { raceName: "Monaco Grand Prix", sessionKind: "Qualifying" })
    > f1TvContentScoreSandbox.scoreF1TvContentCandidate("2026 Monaco Grand Prix Replay", { raceName: "Monaco Grand Prix", sessionKind: "Qualifying" }),
  "F1 TV replay resolver should prefer requested qualifying over the generic Grand Prix race"
);
assert.ok(
  f1TvContentScoreSandbox.scoreF1TvContentCandidate("2026 Miami GP Sprint Replay", { raceName: "Miami Grand Prix", sessionKind: "Sprint" })
    > f1TvContentScoreSandbox.scoreF1TvContentCandidate("2026 Miami GP Sprint Qualifying Replay", { raceName: "Miami Grand Prix", sessionKind: "Sprint" }),
  "F1 TV replay resolver should prefer the requested sprint race over sprint qualifying"
);

const f1ApiStandingsSandbox = vm.runInNewContext(`(() => {
  ${[
    "stripTags",
    "decodeXmlEntities",
    "decodeEntities",
    "teamAbbr",
    "championshipPositionDelta",
    "officialF1ResultsUrl",
    "officialF1ResultsLines",
    "officialF1ResultsText",
    "parseOpenF1DriverStandings",
    "parseOpenF1ConstructorStandings",
    "parseF1ApiDriverStandings",
    "parseF1ApiConstructorStandings",
    "parseOfficialF1DriverStandings",
    "parseOfficialF1ConstructorStandings",
  ].map((name) => extractNamedFunction(mainProcess, name)).join("\n")}
  return {
    officialF1ResultsUrl,
    parseOpenF1DriverStandings,
    parseOpenF1ConstructorStandings,
    parseF1ApiDriverStandings,
    parseF1ApiConstructorStandings,
    parseOfficialF1DriverStandings,
    parseOfficialF1ConstructorStandings,
  };
})()`);
assert.equal(
  f1ApiStandingsSandbox.officialF1ResultsUrl("drivers", 2026),
  "https://www.formula1.com/en/results/2026/drivers",
  "Official Formula 1 driver standings fallback should use the public Formula1.com results page"
);
assert.equal(
  f1ApiStandingsSandbox.officialF1ResultsUrl("team", 2026),
  "https://www.formula1.com/en/results/2026/team",
  "Official Formula 1 constructor standings fallback should use the public Formula1.com team results page"
);
const openF1DriverResult = f1ApiStandingsSandbox.parseOpenF1DriverStandings([{
  driver_number: 3,
  position_current: 7,
  position_start: 7,
  points_current: 43,
}], [{ code: "VER", name: "Max Verstappen", num: 3, team: "Red Bull Racing", abbr: "RBR" }]);
assert.deepEqual(JSON.parse(JSON.stringify(openF1DriverResult.standings[0])), {
  pos: 7,
  code: "VER",
  pts: 43,
  wins: 0,
  delta: 0,
  driver: { code: "VER", name: "Max Verstappen", num: 3, team: "Red Bull Racing", abbr: "RBR" },
}, "OpenF1 championship driver standings should map into PitWall standings rows");
const openF1DriverMove = f1ApiStandingsSandbox.parseOpenF1DriverStandings([{
  driver_number: 44,
  position_current: 2,
  position_start: 3,
  points_current: 90,
}], [{ code: "HAM", name: "Lewis Hamilton", num: 44, team: "Ferrari", abbr: "FER" }]);
assert.equal(openF1DriverMove.standings[0].delta, 1, "OpenF1 championship driver standings should show rank gained since race start");
const openF1Constructors = f1ApiStandingsSandbox.parseOpenF1ConstructorStandings([{
  team_name: "Red Bull Racing",
  position_current: 4,
  position_start: 4,
  points_current: 8,
}]);
assert.deepEqual(JSON.parse(JSON.stringify(openF1Constructors[0])), { pos: 4, abbr: "RBR", name: "Red Bull Racing", pts: 8, wins: 0, delta: 0 }, "OpenF1 championship constructor standings should map into PitWall constructor rows");
const openF1ConstructorMove = f1ApiStandingsSandbox.parseOpenF1ConstructorStandings([{
  team_name: "Ferrari",
  position_current: 2,
  position_start: 3,
  points_current: 150,
}]);
assert.equal(openF1ConstructorMove[0].delta, 1, "OpenF1 championship constructor standings should show rank gained since race start");
const f1ApiDriverResult = f1ApiStandingsSandbox.parseF1ApiDriverStandings({
  season: 2026,
  drivers_championship: [{
    position: 7,
    points: 43,
    wins: 0,
    driver: { shortName: "VER", name: "Max", surname: "Verstappen", number: 33 },
    team: { teamName: "Red Bull Racing" },
  }],
});
assert.equal(f1ApiDriverResult.seasonSummary.season, "2026", "F1 API driver standings should carry the current season");
assert.deepEqual(JSON.parse(JSON.stringify(f1ApiDriverResult.standings[0])), {
  pos: 7,
  code: "VER",
  pts: 43,
  wins: 0,
  delta: 0,
  driver: { code: "VER", name: "Max Verstappen", num: 33, team: "Red Bull Racing", abbr: "RBR" },
}, "F1 API driver standings should map into PitWall standings rows");
const f1ApiConstructors = f1ApiStandingsSandbox.parseF1ApiConstructorStandings({
  constructors_championship: [{
    position: 4,
    points: 8,
    wins: 0,
    team: { teamName: "Red Bull Racing" },
  }],
});
assert.deepEqual(JSON.parse(JSON.stringify(f1ApiConstructors[0])), { pos: 4, abbr: "RBR", name: "Red Bull Racing", pts: 8, wins: 0, delta: 0 }, "F1 API constructor standings should map into PitWall constructor rows");
const officialDriverResult = f1ApiStandingsSandbox.parseOfficialF1DriverStandings(`
  <h1>2026 Drivers' Standings</h1>
  <div>Pos.Driver Nationality Team Pts.</div>
  <div>1 <a>Kimi Antonelli ANT</a> ITA <a>Mercedes</a> 156</div>
  <div>2 <a>Max Verstappen VER</a> NED <a>Red Bull Racing</a> 43</div>
  <h2>OUR PARTNERS</h2>
`);
assert.equal(officialDriverResult.seasonSummary.season, "2026", "Official Formula 1 driver standings should carry the page season");
assert.deepEqual(JSON.parse(JSON.stringify(officialDriverResult.standings[0])), {
  pos: 1,
  code: "ANT",
  pts: 156,
  wins: 0,
  delta: 0,
  driver: { code: "ANT", name: "Kimi Antonelli", num: 0, team: "Mercedes", abbr: "MER" },
}, "Official Formula 1 driver standings should map visible results rows into PitWall standings rows");
const officialConstructors = f1ApiStandingsSandbox.parseOfficialF1ConstructorStandings(`
  <h1>2026 Teams' Standings</h1>
  <div>Pos.Team Pts.</div>
  <div>1 <a>Mercedes</a> 244</div>
  <div>4 <a>Red Bull Racing</a> 72</div>
  <h2>OUR PARTNERS</h2>
`);
assert.deepEqual(JSON.parse(JSON.stringify(officialConstructors[0])), { pos: 1, abbr: "MER", name: "Mercedes", pts: 244, wins: 0, delta: 0 }, "Official Formula 1 constructor standings should map visible team rows into PitWall constructor rows");

const entitySandbox = vm.runInNewContext(`(() => {
  ${["stripTags", "decodeXmlEntities", "decodeEntities"].map((name) => extractNamedFunction(mainProcess, name)).join("\n")}
  return { decodeEntities };
})()`);
assert.equal(
  entitySandbox.decodeEntities("Antonelli&amp;#8217;s magic, Russell&amp;#8217;s growing problem"),
  `Antonelli${String.fromCodePoint(8217)}s magic, Russell${String.fromCodePoint(8217)}s growing problem`,
  "Live news titles should decode nested numeric HTML entities",
);

const newsParserSandbox = vm.runInNewContext(`(() => {
  const NEWS_SOURCES = [
    { key: "motorsportNews", name: "Motorsport.com", url: "https://www.motorsport.com/rss/f1/news/", type: "rss" },
    { key: "formula1News", name: "Formula 1", url: "https://www.formula1.com/en/latest/all.xml", type: "rss", articlePath: /\\/en\\/latest\\/article\\//i },
    { key: "theRaceNews", name: "The Race", url: "https://www.the-race.com/rss/", type: "rss", articlePath: /\\/formula-1\\/[^/?#]+\\/?$/i },
    { key: "planetF1News", name: "PlanetF1", url: "https://www.planetf1.com/news", type: "html", articlePath: /\\/news\\/[^/?#]+\\/?$/i },
  ];
  ${[
    "stripTags",
    "decodeXmlEntities",
    "decodeEntities",
    "extractXml",
    "extractXmlRaw",
    "extractTagAttribute",
    "normalizeNewsImage",
    "extractRssImage",
    "extractRssArticleText",
    "timeAgo",
    "classifyNews",
    "colourForText",
    "absoluteNewsUrl",
    "normalizeNewsUrl",
    "extractHtmlDate",
    "extractHtmlImage",
    "extractHtmlPreview",
    "extractArticleMetaImage",
    "extractArticleImages",
    "normalizeArticleDate",
    "extractArticleMetaDate",
    "extractArticleBody",
    "normalizeNewsStory",
    "parseRss",
    "parseNewsHtml",
    "parseNewsSource",
    "enrichNewsStoryImages",
    "newsStorySortTime",
    "selectNewsFeedStories",
    "buildNewsFeed",
  ].map((name) => extractNamedFunction(mainProcess, name)).join("\n")}
  return { parseNewsHtml, parseNewsSource, extractArticleMetaImage, extractArticleMetaDate, extractArticleBody, enrichNewsStoryImages, buildNewsFeed };
})()`, { createHash: require("node:crypto").createHash, URL });
const planetF1CardHtml = `
  <article>
    <a href="/news/f1-starting-grid-2026-monaco-gp" aria-label="image">
      <picture>
        <source srcset="https://www.planetf1.com/content/uploads/2026/06/monaco-grid.webp 800w, https://www.planetf1.com/content/uploads/2026/06/monaco-grid-large.webp 1600w">
      </picture>
    </a>
    <a href="/news/f1-starting-grid-2026-monaco-gp">F1 starting grid: What is the grid order for the 2026 Monaco Grand Prix?</a>
    <p>Complete grid order for the Monaco Grand Prix after penalties changed the final starting positions.</p>
  </article>`;
assert.equal(
  newsParserSandbox.parseNewsHtml(planetF1CardHtml, { name: "PlanetF1", url: "https://www.planetf1.com/news", articlePath: /\/news\/[^/?#]+\/?$/i })[0].image,
  "https://www.planetf1.com/content/uploads/2026/06/monaco-grid.webp",
  "PlanetF1 news cards should use nearby srcset images when img src is absent",
);
assert.equal(
  newsParserSandbox.parseNewsHtml(planetF1CardHtml, { name: "PlanetF1", url: "https://www.planetf1.com/news", articlePath: /\/news\/[^/?#]+\/?$/i })[0].lead,
  "Complete grid order for the Monaco Grand Prix after penalties changed the final starting positions.",
  "PlanetF1 news cards should show the listing excerpt as the article preview",
);
assert.equal(
  newsParserSandbox.extractArticleMetaImage(`<meta property="og:image" content="https://www.planetf1.com/content/uploads/2026/06/article-image.webp">`, "https://www.planetf1.com/news/story"),
  "https://www.planetf1.com/content/uploads/2026/06/article-image.webp",
  "News image fallback should read article Open Graph images",
);
assert.equal(
  newsParserSandbox.extractArticleMetaDate(`<meta property="article:published_time" content="2026-06-07T04:15:00+00:00">`),
  "2026-06-07T04:15:00.000Z",
  "News article fallback should read precise article published timestamps",
);
assert.equal(
  newsParserSandbox.extractArticleMetaDate(`<script type="application/ld+json">{"@type":"NewsArticle","datePublished":"2026-06-06T22:30:00+00:00"}</script>`),
  "2026-06-06T22:30:00.000Z",
  "News article fallback should read JSON-LD datePublished timestamps",
);
assert.equal(
  newsParserSandbox.extractArticleMetaDate(`<main><h1>Formula 1 official story</h1><p>Jun 07, 2026 5:06pm UTC</p></main>`),
  "2026-06-07T17:06:00.000Z",
  "Formula 1 article fallback should preserve visible publish times when metadata is absent",
);
newsParserSandbox.enrichNewsStoryImages([
  {
    title: "Older source story",
    url: "https://example.com/older",
    image: "https://example.com/older.jpg",
    publishedAt: "2026-06-07T12:00:00.000Z",
    time: "4h",
  },
  {
    title: "Fresh Formula 1 story",
    url: "https://www.formula1.com/en/latest/article/fresh.abc123",
    image: "",
    publishedAt: "",
    time: "recent",
  },
], 2, async (url) => url.includes("formula1.com") ? `<meta property="article:published_time" content="2026-06-07T16:54:00+00:00">` : "")
  .then((stories) => {
    assert.deepEqual(
      stories.map((story) => story.title),
      ["Fresh Formula 1 story", "Older source story"],
      "News enrichment should re-sort stories after discovering fresher article timestamps",
    );
  });
assert.match(mainProcess, /const baseNews = buildNewsFeed\(raw\)[\s\S]*options\.enrichmentPending[\s\S]*enrichNewsStoryImages\(baseNews\)/, "Initial live data snapshots should defer article metadata enrichment to the background pass");
assert.deepEqual(
  JSON.parse(JSON.stringify(newsParserSandbox.parseNewsSource(`
    <rss><channel>
      <item><title>Formula 1 official story with enough headline words</title><link>https://www.formula1.com/en/latest/article/story-title.abc123</link></item>
      <item><title>Formula 1 glossary page should not enter feed</title><link>https://www.formula1.com/en/latest</link></item>
    </channel></rss>`,
    { name: "Formula 1", url: "https://www.formula1.com/en/latest/all.xml", type: "rss", articlePath: /\/en\/latest\/article\//i },
  ).map((story) => story.source))),
  ["Formula 1"],
  "Formula 1 RSS parsing should keep official article URLs",
);
assert.deepEqual(
  JSON.parse(JSON.stringify(newsParserSandbox.parseNewsSource(`
    <rss><channel>
      <item><title>The Race Formula 1 story with enough headline words</title><link>https://www.the-race.com/formula-1/current-f1-story/</link></item>
      <item><title>The Race MotoGP story should be filtered out cleanly</title><link>https://www.the-race.com/motogp/current-motogp-story/</link></item>
    </channel></rss>`,
    { name: "The Race", url: "https://www.the-race.com/rss/", type: "rss", articlePath: /\/formula-1\/[^/?#]+\/?$/i },
  ).map((story) => story.url))),
  ["https://www.the-race.com/formula-1/current-f1-story/"],
  "The Race RSS parsing should keep Formula 1 article URLs and filter other categories",
);
assert.deepEqual(
  JSON.parse(JSON.stringify(newsParserSandbox.parseNewsSource(`
    <rss><channel>
      <item><title>Motorsport Formula 1 story with enough headline words</title><link>https://www.motorsport.com/f1/news/current-f1-story/1234567/</link></item>
      <item><title>Motorsport MotoGP story should be filtered out cleanly</title><link>https://www.motorsport.com/motogp/news/current-motogp-story/1234568/</link></item>
    </channel></rss>`,
    { name: "Motorsport.com", url: "https://www.motorsport.com/rss/f1/news/", type: "rss", articlePath: /\/f1\/news\//i },
  ).map((story) => story.url))),
  ["https://www.motorsport.com/f1/news/current-f1-story/1234567/"],
  "Motorsport RSS parsing should keep Formula 1 article URLs and filter other categories",
);
assert.equal(
  newsParserSandbox.extractArticleBody(`
    <article>
      <p>This opening paragraph has enough readable words to look like proper article copy.</p>
      <p>This second paragraph keeps the in app reader fed with more than an RSS summary.</p>
    </article>
    <nav><p>Short menu text</p></nav>`, "Short RSS summary"),
  "This opening paragraph has enough readable words to look like proper article copy.\n\nThis second paragraph keeps the in app reader fed with more than an RSS summary.",
  "News enrichment should extract readable full article paragraphs for the in-app reader",
);
const datedPlanetItems = Array.from({ length: 30 }, (_, index) => `
  <item>
    <title>PlanetF1 dated story number ${index} with enough headline words</title>
    <link>https://www.planetf1.com/news/dated-story-${index}</link>
    <pubDate>Sun, 07 Jun 2026 ${String(index).padStart(2, "0")}:00:00 GMT</pubDate>
  </item>`).join("");
const datedPlanetCards = Array.from({ length: 18 }, (_, index) => `
  <article>
    <time>07 Jun 2026</time>
    <a href="/news/dated-planet-story-${index}">PlanetF1 dated card number ${index} with enough headline words</a>
  </article>`).join("");
const diverseNews = newsParserSandbox.buildNewsFeed({
  motorsportNews: `<rss><channel>${datedPlanetItems.replaceAll("planetf1.com", "motorsport.com")}</channel></rss>`,
  autosportNews: `<rss><channel><item><title>Current Autosport Formula One analysis story with enough headline words</title><link>https://www.autosport.com/f1/news/current-autosport-analysis-story/1234567/</link></item></channel></rss>`,
  formula1News: `<rss><channel><item><title>Current Formula One analysis story with enough headline words</title><link>https://www.formula1.com/en/latest/article/current-formula-one-analysis-story.abc123</link></item></channel></rss>`,
  theRaceNews: `<rss><channel><item><title>Formula 1 current The Race analysis story with enough headline words</title><link>https://www.the-race.com/formula-1/current-the-race-analysis-story/</link></item></channel></rss>`,
  planetF1News: datedPlanetCards,
});
assert.ok(!diverseNews.some((story) => story.source === "Autosport"), "Live news feed should not include Autosport stories");
assert.ok(diverseNews.some((story) => story.source === "Formula 1"), "Live news feed should keep Formula 1 stories visible when their listing omits dates");
assert.ok(diverseNews.some((story) => story.source === "The Race"), "Live news feed should keep The Race stories visible when their listing omits dates");

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
    "openF1SectorTimes",
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
assert.deepEqual(JSON.parse(JSON.stringify(replayTimingRows[0].sectorTimes)), { s1: 25, s2: 30, s3: 20 }, "Replay timing should preserve numeric sector times alongside mini-sector tones");
assert.equal(replayTimingRows[0].comp, "soft", "Replay timing should preserve tyre compound from OpenF1 stints");

const f1TimingClockSandbox = vm.runInNewContext(`(() => {
  const f1TimingStateCursorCache = new WeakMap();
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
    "f1TimingTargetUtcMs",
    "f1TimingExplicitQualifyingPart",
    "f1TimingQualifyingPart",
    "parseF1TimingLapCount",
    "parseF1TimingSessionClock",
  ].map((name) => extractNamedFunction(mainProcess, name)).join("\n")}
  return { f1TimingSessionStartSeconds, f1TimingVideoStartArchiveSeconds, f1TimingQualifyingPart, parseF1TimingLapCount, parseF1TimingSessionClock };
})()`);
const sparseClockSession = {
  clockEntries: [
    { seconds: 42.694, data: { Remaining: "00:18:00", Extrapolating: false } },
    { seconds: 854.698, data: { Remaining: "00:17:59", Extrapolating: true, Utc: "2026-06-06T14:00:01.007Z" } },
  ],
  position: [
    { driver_number: 44, position: 1, date: "2026-06-07T13:00:00.000Z" },
    { driver_number: 16, position: 2, date: "2026-06-07T13:00:00.000Z" },
    { driver_number: 44, position: 2, date: "2026-06-07T14:00:00.000Z" },
    { driver_number: 16, position: 1, date: "2026-06-07T14:00:00.000Z" },
  ],
  sessionStatusEntries: [
    { seconds: 6.013, data: { Status: "Inactive", Started: "Inactive" } },
    { seconds: 853.735, data: { Status: "Started", Started: "Started" } },
  ],
  trackStatusEntries: [
    { seconds: 6.013, data: { Status: "1", Message: "AllClear" } },
    { seconds: 920.000, data: { Status: "2", Message: "Yellow" } },
  ],
  lapCountEntries: [
    { seconds: 860.000, data: { CurrentLap: 1, TotalLaps: 78 } },
    { seconds: 1690.000, data: { CurrentLap: 17, TotalLaps: 78 } },
  ],
};
assert.equal(f1TimingClockSandbox.f1TimingSessionStartSeconds(sparseClockSession), 853.735, "F1 timing should use the first Started status as replay session zero");
assert.equal(f1TimingClockSandbox.parseF1TimingSessionClock(sparseClockSession, 1693.735).remaining, "00:04:00", "Sparse F1 ExtrapolatedClock entries should count down between archive packets");
assert.deepEqual(JSON.parse(JSON.stringify(f1TimingClockSandbox.parseF1TimingSessionClock(sparseClockSession, 1693.735).trackStatus)), { status: "2", message: "Yellow" }, "F1 timing should expose the latest official track flag status");
assert.deepEqual(JSON.parse(JSON.stringify(f1TimingClockSandbox.parseF1TimingLapCount(sparseClockSession, 1693.735))), { lap: 17, laps: 78 }, "F1 timing should parse official race lap counts");
assert.deepEqual(JSON.parse(JSON.stringify(f1TimingClockSandbox.parseF1TimingSessionClock(sparseClockSession, 1693.735).lapCount)), { lap: 17, laps: 78 }, "F1 timing session clock should carry official race lap counts");
assert.equal(f1TimingClockSandbox.f1TimingQualifyingPart({
  sessionStatusEntries: [
    { seconds: 10, data: { Status: "Started" } },
    { seconds: 1090, data: { Status: "Finished" } },
    { seconds: 1290, data: { Status: "Started" } },
  ],
}, 1300), "Q2", "F1 timing should derive the active qualifying part from official status restarts");
assert.equal(f1TimingClockSandbox.f1TimingQualifyingPart({
  sessionStatusEntries: [
    { seconds: 1290, data: { Status: "Started", StatusSeries: [
      { Utc: "2026-06-06T14:00:00Z", SessionStatus: "Started" },
      { Utc: "2026-06-06T14:18:00Z", SessionStatus: "Finished" },
      { Utc: "2026-06-06T14:25:00Z", SessionStatus: "Started" },
    ] } },
    { seconds: 1300, data: { Status: "Started", StatusSeries: [
      { Utc: "2026-06-06T14:00:00Z", SessionStatus: "Started" },
      { Utc: "2026-06-06T14:18:00Z", SessionStatus: "Finished" },
      { Utc: "2026-06-06T14:25:00Z", SessionStatus: "Started" },
    ] } },
  ],
}, 1300), "Q2", "F1 timing should not recount repeated cumulative qualifying status history");
assert.equal(f1TimingClockSandbox.f1TimingQualifyingPart({
  clockEntries: [
    { seconds: 0, data: { Utc: "2026-06-06T14:00:00Z" } },
  ],
  sessionStatusEntries: [
    { seconds: 1800, data: { Status: "Started", StatusSeries: [
      { Utc: "2026-06-06T14:00:00Z", SessionStatus: "Started" },
      { Utc: "2026-06-06T14:18:00Z", SessionStatus: "Finished" },
      { Utc: "2026-06-06T14:25:00Z", SessionStatus: "Started" },
      { Utc: "2026-06-06T14:43:00Z", SessionStatus: "Finished" },
      { Utc: "2026-06-06T14:50:00Z", SessionStatus: "Started" },
    ] } },
  ],
}, 1800), "Q2", "F1 timing should ignore future qualifying restarts included in cumulative status history");
assert.equal(f1TimingClockSandbox.f1TimingQualifyingPart({
  clockEntries: [
    { seconds: Date.parse("2026-06-06T14:10:00Z") / 1000, data: { Utc: "2026-06-06T14:10:00Z" } },
  ],
  sessionStatusEntries: [
    { seconds: Date.parse("2026-06-06T14:10:00Z") / 1000, data: { Status: "Started", StatusSeries: [
      { Utc: "2026-06-06T14:00:00Z", SessionStatus: "Started" },
      { Utc: "2026-06-06T14:18:00Z", SessionStatus: "Finished" },
      { Utc: "2026-06-06T14:25:00Z", SessionStatus: "Started" },
    ] } },
  ],
}, Number.MAX_SAFE_INTEGER), "Q1", "F1 timing latest live qualifying should ignore future Q2 restarts while Q1 is active");
assert.equal(f1TimingClockSandbox.f1TimingQualifyingPart({
  clockEntries: [
    { seconds: Date.parse("2026-06-06T14:30:00Z") / 1000, data: { Utc: "2026-06-06T14:30:00Z" } },
  ],
  sessionStatusEntries: [
    { seconds: Date.parse("2026-06-06T14:30:00Z") / 1000, data: { Status: "Started", StatusSeries: [
      { Utc: "2026-06-06T14:00:00Z", SessionStatus: "Started" },
      { Utc: "2026-06-06T14:18:00Z", SessionStatus: "Finished" },
      { Utc: "2026-06-06T14:25:00Z", SessionStatus: "Started" },
      { Utc: "2026-06-06T14:43:00Z", SessionStatus: "Finished" },
      { Utc: "2026-06-06T14:50:00Z", SessionStatus: "Started" },
    ] } },
  ],
}, Number.MAX_SAFE_INTEGER), "Q2", "F1 timing latest live qualifying should ignore future Q3 restarts while Q2 is active");
assert.equal(f1TimingClockSandbox.f1TimingQualifyingPart({
  clockEntries: [
    { seconds: Date.parse("2026-06-06T14:16:00Z") / 1000, data: { Utc: "2026-06-06T14:16:00Z" } },
  ],
  sessionDataEntries: [
    { seconds: Date.parse("2026-06-06T13:45:50Z") / 1000, data: { Series: { 0: { Utc: "2026-06-06T13:45:50Z", QualifyingPart: 0 } } } },
    { seconds: Date.parse("2026-06-06T13:45:51Z") / 1000, data: { Series: { 1: { Utc: "2026-06-06T13:45:51Z", QualifyingPart: 1 } } } },
  ],
  sessionStatusEntries: [
    { seconds: Date.parse("2026-06-06T14:16:00Z") / 1000, data: { Status: "Started", StatusSeries: [
      { Utc: "2026-06-06T14:00:00Z", SessionStatus: "Started" },
      { Utc: "2026-06-06T14:09:00Z", SessionStatus: "Aborted" },
      { Utc: "2026-06-06T14:13:00Z", SessionStatus: "Started" },
    ] } },
  ],
}, Number.MAX_SAFE_INTEGER), "Q1", "F1 timing should prefer source QualifyingPart over Q1 red-flag restarts");
assert.equal(f1TimingClockSandbox.f1TimingQualifyingPart({
  clockEntries: [
    { seconds: Date.parse("2026-06-06T14:16:00Z") / 1000, data: { Utc: "2026-06-06T14:16:00Z" } },
  ],
  sessionStatusEntries: [
    { seconds: Date.parse("2026-06-06T14:16:00Z") / 1000, data: { Status: "Started", StatusSeries: [
      { Utc: "2026-06-06T14:00:00Z", SessionStatus: "Started" },
      { Utc: "2026-06-06T14:09:00Z", SessionStatus: "Aborted" },
      { Utc: "2026-06-06T14:13:00Z", SessionStatus: "Started" },
    ] } },
  ],
}, Number.MAX_SAFE_INTEGER), "Q1", "F1 timing fallback should not count a red-flag restart as a new qualifying part");
assert.equal(f1TimingClockSandbox.f1TimingQualifyingPart({
  clockEntries: [
    { seconds: Date.parse("2026-06-06T14:31:00Z") / 1000, data: { Utc: "2026-06-06T14:31:00Z" } },
  ],
  sessionDataEntries: [
    { seconds: Date.parse("2026-06-06T13:45:51Z") / 1000, data: { Series: { 1: { Utc: "2026-06-06T13:45:51Z", QualifyingPart: 1 } } } },
    { seconds: Date.parse("2026-06-06T14:30:59Z") / 1000, data: { Series: { 2: { Utc: "2026-06-06T14:30:59Z", QualifyingPart: 2 } } } },
  ],
  sessionStatusEntries: [
    { seconds: Date.parse("2026-06-06T14:31:00Z") / 1000, data: { Status: "Started", StatusSeries: [
      { Utc: "2026-06-06T14:00:00Z", SessionStatus: "Started" },
      { Utc: "2026-06-06T14:09:00Z", SessionStatus: "Aborted" },
      { Utc: "2026-06-06T14:13:00Z", SessionStatus: "Started" },
      { Utc: "2026-06-06T14:22:00Z", SessionStatus: "Finished" },
      { Utc: "2026-06-06T14:29:00Z", SessionStatus: "Started" },
    ] } },
  ],
}, Number.MAX_SAFE_INTEGER), "Q2", "F1 timing should prefer source QualifyingPart over red-flag-shifted Q2 status history");
assert.equal(f1TimingClockSandbox.f1TimingQualifyingPart({
  clockEntries: [
    { seconds: Date.parse("2026-06-06T14:39:00Z") / 1000, data: { Utc: "2026-06-06T14:39:00Z" } },
  ],
  sessionDataEntries: [
    { seconds: Date.parse("2026-06-06T13:45:51Z") / 1000, data: { Series: { 1: { Utc: "2026-06-06T13:45:51Z", QualifyingPart: 1 } } } },
    { seconds: Date.parse("2026-06-06T14:25:00Z") / 1000, data: { Series: { 2: { Utc: "2026-06-06T14:25:00Z", QualifyingPart: 2 } } } },
  ],
  sessionStatusEntries: [
    { seconds: Date.parse("2026-06-06T14:39:00Z") / 1000, data: { Status: "Started", StatusSeries: [
      { Utc: "2026-06-06T14:00:00Z", SessionStatus: "Started" },
      { Utc: "2026-06-06T14:18:00Z", SessionStatus: "Finished" },
      { Utc: "2026-06-06T14:25:00Z", SessionStatus: "Started" },
      { Utc: "2026-06-06T14:34:00Z", SessionStatus: "Aborted" },
      { Utc: "2026-06-06T14:37:00Z", SessionStatus: "Started" },
    ] } },
  ],
}, Number.MAX_SAFE_INTEGER), "Q2", "F1 timing should prefer source QualifyingPart over Q2 red-flag restarts");
assert.equal(Math.round(f1TimingClockSandbox.f1TimingVideoStartArchiveSeconds(sparseClockSession, { videoStartUtc: "2026-06-06T13:55:46.309Z" })), 600, "Replay timing should convert F1 TV program-date-time into archive elapsed seconds");
assert.equal(Math.round(f1TimingClockSandbox.f1TimingVideoStartArchiveSeconds(sparseClockSession, { videoStartUtc: "2026-06-06T13:35:46.309Z" })), -600, "Replay timing should preserve F1 TV replay lead-in before the timing archive starts");
const f1TimingRaceControlSandbox = vm.runInNewContext(`(() => {
  const F1_TIMING_LIVE_STALE_MS = 30000;
  const f1TimingTelemetrySampleCache = new WeakMap();
  const f1TimingPositionSampleCache = new WeakMap();
  const f1TimingStateCursorCache = new WeakMap();
  let f1LiveTimingState = { entriesByTopic: {}, lastMessageAt: 0, lastError: "" };
  function ensureF1TimingLiveClient() { return Promise.resolve(); }
  function setF1LiveTimingState(state) { f1LiveTimingState = state; }
  ${[
    "finiteNumber",
    "groupRowsByDriverNumber",
    "clampPercent",
    "latestCarDataByDriverNumber",
    "mergeF1TimingDelta",
    "f1TimingStateAt",
    "f1TimingLatestEntryAt",
    "f1TimingArchiveStartUtcMs",
    "f1TimingVideoStartArchiveSeconds",
    "f1TimingSessionStartSeconds",
    "f1TimingValue",
    "f1TimingDurationSeconds",
    "formatF1TimingDuration",
    "f1TimingTargetUtcMs",
    "f1TimingExplicitQualifyingPart",
    "f1TimingQualifyingPart",
    "fillF1TimingQualifyingDeltas",
    "timingSegmentTone",
    "f1TimingSegments",
    "f1TimingSectorTime",
    "f1TimingStints",
    "f1TimingLatestStint",
    "f1TimingKnownCompoundsByNumber",
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
  ].map((name) => extractNamedFunction(mainProcess, name)).join("\n")}
  function normalizeCompound(value) { return String(value || "").toLowerCase(); }
  function formatLapDuration(seconds) { return String(seconds); }
  function f1TimingLapSeconds() { return null; }
  return { f1TimingSegments, f1TimingPositionRowsAt, getF1LiveTimingSnapshot, parseF1TimingArchiveRows, setF1LiveTimingState };
})()`);
assert.deepEqual(
  f1TimingRaceControlSandbox.f1TimingSegments({ Segments: [{ Status: 0 }, { Status: 2048 }, { Status: 0 }] }),
  ["off", "yellow"],
  "F1 timing mini sectors should preserve leading off ticks so active segments do not shift left",
);
const raceControlSession = {
  driverListEntries: [],
  timingEntries: [],
  timingAppEntries: [],
  clockEntries: [],
  sessionStatusEntries: [],
  weatherEntries: [],
  carDataEntries: [],
  raceControlEntries: [
    { seconds: 10, data: { Messages: { "1": { Utc: "2026-06-07T13:00:10Z", Lap: 1, Category: "Flag", Flag: "GREEN", Message: "GREEN LIGHT - PIT EXIT OPEN" } } } },
    { seconds: 20, data: { Messages: { "2": { Utc: "2026-06-07T13:00:20Z", Lap: 2, Category: "Drs", Status: "ENABLED", Message: "DRS ENABLED" } } } },
  ],
};
assert.deepEqual(
  JSON.parse(JSON.stringify(f1TimingRaceControlSandbox.parseF1TimingArchiveRows(raceControlSession, 15).raceControlMessages.map((message) => message.text))),
  ["GREEN LIGHT - PIT EXIT OPEN"],
  "Replay timing should expose race-control messages only up to the active timestamp",
);
assert.equal(
  f1TimingRaceControlSandbox.parseF1TimingArchiveRows(raceControlSession, 25).raceControlMessages[1].status,
  "ENABLED",
  "Race-control messages should preserve useful status metadata for the timing sidebar",
);
const fastCarDataSession = {
  driverListEntries: [{ seconds: 0, data: { "16": { Tla: "LE" } } }],
  timingEntries: [{ seconds: 0, data: { Lines: { "16": { RacingNumber: "16", Position: 1 } } } }],
  timingAppEntries: [],
  clockEntries: [{ seconds: 10, data: { Utc: "2026-06-06T14:00:10.000Z" } }],
  sessionStatusEntries: [],
  weatherEntries: [],
  raceControlEntries: [],
  lapCountEntries: [],
  carDataEntries: [{
    seconds: 10,
    data: { Entries: [
      { Utc: "2026-06-06T14:00:10.000Z", Cars: { "16": { Channels: { "2": 100, "3": 3, "4": 20, "5": 0 } } } },
    ] },
  }, {
    seconds: 11,
    data: { Entries: [
      { Utc: "2026-06-06T14:00:10.240Z", Cars: { "16": { Channels: { "2": 124, "3": 4, "4": 60, "5": 0 } } } },
      { Utc: "2026-06-06T14:00:10.480Z", Cars: { "16": { Channels: { "2": 148, "3": 5, "4": 100, "5": 1 } } } },
    ] },
  }],
};
assert.equal(
  f1TimingRaceControlSandbox.parseF1TimingArchiveRows(fastCarDataSession, 10.25).timing[0].telemetry.speed,
  124,
  "Replay onboard telemetry should use the latest inner CarData sample at the sub-second target",
);
assert.equal(
  f1TimingRaceControlSandbox.parseF1TimingArchiveRows(fastCarDataSession, 10.5).timing[0].telemetry.throttle,
  100,
  "Replay onboard telemetry should advance through sub-second inner CarData samples instead of one outer packet per second",
);
const liveSignalRSeconds = Date.parse("2026-06-09T20:00:00.000Z") / 1000;
f1TimingRaceControlSandbox.setF1LiveTimingState({
  lastMessageAt: Date.now(),
  lastTopic: "TimingData",
  lastError: "",
  entriesByTopic: {
    DriverList: [{ seconds: liveSignalRSeconds, data: { "1": { Tla: "VER", RacingNumber: "1" } } }],
    TimingData: [{
      seconds: liveSignalRSeconds,
      data: { Lines: { "1": { RacingNumber: "1", Position: 1, GapToLeader: { Value: "" }, IntervalToPositionAhead: { Value: "" }, Sectors: { "0": { Segments: [{ Status: 2049 }] } } } } },
    }],
    TimingAppData: [{ seconds: liveSignalRSeconds, data: { Lines: { "1": { Stints: [{ Compound: "SOFT", LapNumber: 1, TotalLaps: 3, StartLaps: 0 }] } } } }],
    ExtrapolatedClock: [{ seconds: liveSignalRSeconds, data: { Utc: "2026-06-09T20:00:00.000Z", Remaining: "01:10:00", Extrapolating: true } }],
    SessionStatus: [{ seconds: liveSignalRSeconds, data: { Status: "Started" } }],
    TrackStatus: [{ seconds: liveSignalRSeconds, data: { Status: "1", Message: "AllClear" } }],
    LapCount: [{ seconds: liveSignalRSeconds, data: { CurrentLap: 12, TotalLaps: 58 } }],
    WeatherData: [{ seconds: liveSignalRSeconds, data: { AirTemp: "24.1", TrackTemp: "36.7", Rainfall: "0", WindSpeed: "3.2" } }],
    RaceControlMessages: [{ seconds: liveSignalRSeconds, data: { Messages: { "1": { Utc: "2026-06-09T20:00:00.000Z", Lap: 12, Category: "Flag", Flag: "GREEN", Message: "GREEN FLAG" } } } }],
    "CarData.z": [{ seconds: liveSignalRSeconds, data: { Entries: [{ Utc: "2026-06-09T20:00:00.000Z", Cars: { "1": { Channels: { "2": 302, "3": 8, "4": 88, "5": 0 } } } }] } }],
    "Position.z": [{ seconds: liveSignalRSeconds, data: { Position: [{ Timestamp: "2026-06-09T20:00:00.000Z", Entries: { "1": { X: 100, Y: 200, Z: 0, Status: "OnTrack" } } }] } }],
  },
});
const liveSignalRSnapshot = f1TimingRaceControlSandbox.getF1LiveTimingSnapshot();
assert.equal(liveSignalRSnapshot.timing[0].code, "VER", "Formula 1 SignalR live timing should parse driver rows from mocked TimingData");
assert.equal(liveSignalRSnapshot.timing[0].telemetry.speed, 302, "Formula 1 SignalR live timing should expose mocked CarData.z telemetry");
assert.deepEqual(JSON.parse(JSON.stringify(liveSignalRSnapshot.timing[0].trackPosition)), { x: 100, y: 200, z: 0, status: "OnTrack" }, "Formula 1 SignalR live timing should expose mocked Position.z coordinates");
assert.deepEqual(JSON.parse(JSON.stringify(liveSignalRSnapshot.sessionClock.lapCount)), { lap: 12, laps: 58 }, "Formula 1 SignalR live timing should expose mocked lap count data");
assert.deepEqual(JSON.parse(JSON.stringify(liveSignalRSnapshot.sessionClock.trackStatus)), { status: "1", message: "AllClear" }, "Formula 1 SignalR live timing should expose mocked track status data");
assert.equal(liveSignalRSnapshot.weather.air, 24.1, "Formula 1 SignalR live timing should expose mocked weather data");
assert.equal(liveSignalRSnapshot.raceControlMessages[0].text, "GREEN FLAG", "Formula 1 SignalR live timing should expose mocked race-control messages");
assert.deepEqual(JSON.parse(JSON.stringify(liveSignalRSnapshot.timing[0].sectors.s1)), ["green"], "Formula 1 SignalR live timing should expose mocked mini-sector data");
const stintCompoundDeltaSession = {
  driverListEntries: [{ seconds: 0, data: { "12": { Tla: "ANT" } } }],
  timingEntries: [{ seconds: 0, data: { Lines: { "12": { RacingNumber: "12", Position: 1 } } } }],
  timingAppEntries: [
    { seconds: 10, data: { Lines: { "12": { Stints: [{ Compound: "MEDIUM", LapNumber: 1, TotalLaps: 1, StartLaps: 0 }] } } } },
    { seconds: 20, data: { Lines: { "12": { Stints: [{ Compound: "", LapNumber: 16, TotalLaps: 27 }] } } } },
  ],
  clockEntries: [],
  sessionStatusEntries: [],
  weatherEntries: [],
  raceControlEntries: [],
  lapCountEntries: [],
  carDataEntries: [],
};
const stintCompoundDeltaRows = f1TimingRaceControlSandbox.parseF1TimingArchiveRows(stintCompoundDeltaSession, 20).timing;
assert.equal(stintCompoundDeltaRows[0].comp, "medium", "Replay stint deltas should preserve the previous compound when a later age update omits it");
assert.equal(stintCompoundDeltaRows[0].age, 27, "Replay stint deltas should still use the latest tyre age update");
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
    "median",
    "lapSpread",
    "cleanLapTrace",
    "tyreAgeForLap",
    "tyreAgeCurve",
    "racecraftForDriver",
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

const richAnalyticsRows = analyticsSandbox.summarizeAnalyticsDrivers({
  drivers: [
    { driver_number: 44, name_acronym: "HAM", full_name: "Lewis Hamilton", team_name: "Ferrari" },
    { driver_number: 16, name_acronym: "LEC", full_name: "Charles Leclerc", team_name: "Ferrari" },
  ],
  laps: [
    { driver_number: 44, lap_number: 1, lap_duration: 82.4, duration_sector_1: 26.1, duration_sector_2: 30.2, duration_sector_3: 26.1, is_pit_out_lap: false },
    { driver_number: 44, lap_number: 2, lap_duration: 81.8, duration_sector_1: 25.9, duration_sector_2: 30.0, duration_sector_3: 25.9, is_pit_out_lap: false },
    { driver_number: 44, lap_number: 3, lap_duration: 82.1, duration_sector_1: 26.0, duration_sector_2: 30.1, duration_sector_3: 26.0, is_pit_out_lap: false },
    { driver_number: 16, lap_number: 1, lap_duration: 82.8, duration_sector_1: 26.3, duration_sector_2: 30.4, duration_sector_3: 26.1, is_pit_out_lap: false },
    { driver_number: 16, lap_number: 2, lap_duration: 82.0, duration_sector_1: 26.0, duration_sector_2: 30.1, duration_sector_3: 25.9, is_pit_out_lap: false },
    { driver_number: 16, lap_number: 3, lap_duration: 82.7, duration_sector_1: 26.2, duration_sector_2: 30.3, duration_sector_3: 26.2, is_pit_out_lap: false },
  ],
  pit: [{ driver_number: 44, lane_duration: 22.1 }],
  overtakes: [{ overtaking_driver_number: 16 }, { overtaking_driver_number: 16 }],
  position: [
    { driver_number: 44, position: 1, date: "2026-06-07T13:00:00.000Z" },
    { driver_number: 16, position: 2, date: "2026-06-07T13:00:00.000Z" },
    { driver_number: 44, position: 2, date: "2026-06-07T14:00:00.000Z" },
    { driver_number: 16, position: 1, date: "2026-06-07T14:00:00.000Z" },
  ],
  sessionResult: [
    { driver_number: 44, position: 2, duration: 81.8, number_of_laps: 3 },
    { driver_number: 16, position: 1, duration: 82.0, number_of_laps: 3 },
  ],
}, []);
assert.ok(Array.isArray(richAnalyticsRows[0].lapTrace), "Analytics summaries should expose clean lap traces for lap pace charts");
assert.deepEqual(richAnalyticsRows[0].lapTrace.map((lap) => lap.lap), [1, 2, 3], "Analytics lap traces should preserve clean lap order");
assert.equal(richAnalyticsRows[0].consistency.cleanLapCount, 3, "Analytics summaries should count clean laps for consistency panels");
assert.equal(richAnalyticsRows[0].racecraft.positionDelta, 1, "Analytics summaries should derive net race movement from start and result positions");
assert.equal(richAnalyticsRows[0].racecraft.overtakes, 2, "Analytics summaries should carry overtake counts into racecraft panels");
assert.ok(richAnalyticsRows[0].tyreCurve.length > 0, "Analytics summaries should expose tyre-age pace curves even when stint rows are sparse");

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
}, dailyRetryToday, dailyRetryNow, 1000 * 60 * 10), true, "Stale pending daily Copilot insight calculations should retry instead of blocking projections all day");
assert.equal(shouldRetryDailyCopilotInsights({
  status: "pending",
  attemptedOn: dailyRetryToday,
  updatedAt: "2026-06-07T12:10:01.000Z",
}, dailyRetryToday, dailyRetryNow, 1000 * 60 * 10), false, "Fresh pending daily Copilot insight calculations should not start duplicate retries");

assert.match(mainProcess, /pitwall:f1tv:login/, "Electron main should expose F1 TV login IPC");
assert.match(mainProcess, /F1TV_HOME_URL = "https:\/\/f1tv\.formula1\.com\/"/, "Electron should keep F1 TV home URL separate from account login");
assert.match(mainProcess, /F1TV_LOGIN_URL = "https:\/\/account\.formula1\.com\/#\/en\/login/, "F1 TV connect should open the Formula 1 account login page directly");
assert.match(mainProcess, /F1TV_AUTH_URL = "https:\/\/api\.formula1\.com\/v2\/account\/subscriber\/authenticate\/by-password"/, "F1 TV credential sign-in should request a subscription token");
assert.match(mainProcess, /"f1tv-token"/, "F1 TV subscription token should be stored separately in Keychain");
assert.match(mainProcess, /subscriptionToken/, "F1 TV credential sign-in should parse subscriptionToken from auth response when the legacy endpoint works");
assert.match(mainProcess, /entitlement_token/, "F1 TV browser sign-in should detect the playback entitlement token cookie");
assert.match(mainProcess, /f1TvPlaybackTokenFromBrowserAuthState/, "F1 TV browser sign-in should recover playback tokens from storage-backed auth sessions");
assert.match(mainProcess, /setSecret\("f1tv-token", playbackToken\)/, "F1 TV browser sign-in should promote recovered playback tokens into Keychain");
assert.doesNotMatch(mainProcess, /playbackTokenCandidate,/, "F1 TV status should not expose recovered playback token values to the renderer");
assert.match(mainProcess, /entitlementToken/, "F1 TV playback requests should include the entitlement token header");
assert.match(mainProcess, /ascendonToken/, "F1 TV playback requests should include the Ascendon token header used by the official web player");
assert.match(mainProcess, /recentF1TvRequestHeader/, "F1 TV playback requests should reuse observed official web-player request headers in memory");
assert.match(mainProcess, /x-f1-device-info/, "F1 TV playback requests should include the device-info header used by the official web player");
assert.match(mainProcess, /correlationid/, "F1 TV playback requests should include the official correlation id header shape");
assert.match(mainProcess, /sessionid/, "F1 TV playback requests should include the official session id header shape");
assert.match(mainProcess, /f1TvEntitlementTokenFromCookies/, "F1 TV status should treat the entitlement-token cookie as playback-ready auth");
assert.match(mainProcess, /f1TvPlaybackHeaders/, "F1 TV resolver should build volatile playback headers for clean player requests");
assert.match(mainProcess, /headers:\s*\{[\s\S]*playbackHeaders/, "F1 TV direct-resolved streams should carry playback headers in memory");
const f1TvPlaybackMode = vm.runInNewContext(`(${extractNamedFunction(mainProcess, "f1TvPlaybackMode")})`);
assert.equal(f1TvPlaybackMode({ sessionKind: "Race", sessionStatus: "live" }), "live", "F1 TV resolver should treat a current Race session as live playback");
assert.equal(f1TvPlaybackMode({ sessionKind: "Race", sessionStatus: "done" }), "replay", "F1 TV resolver should keep completed Race sessions in replay playback");
assert.equal(f1TvPlaybackMode({ sessionKind: "Race", sessionStatus: "done", streamStatus: "live" }), "live", "F1 TV resolver should let a live manifest keep an overrun session in live playback");
assert.equal(f1TvPlaybackMode({ sessionKind: "Race", sessionStatus: "live", streamStatus: "replay" }), "replay", "F1 TV resolver should let a replay manifest override scheduled live status");
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
assert.doesNotMatch(mainProcess, /if \(channelAttempt\.manifests\.length\) \{\s*foundChannelManifest = true;\s*break;\s*\}/, "F1 TV resolver should collect every channel-specific manifest so the Data Channel reaches the custom feed picker");
assert.doesNotMatch(mainProcess, /if \(channelAttempt\.manifests\.length\) break;/, "F1 TV resolver should not stop channel discovery after the first playable extra feed");
assert.match(mainProcess, /const attemptChannelId = attempt\.channelIds\?\.length === 1[\s\S]*channelId: item\.channelId \|\| attemptChannelId/, "F1 TV resolver should preserve channel ids on direct stream items so Data Channel keeps its stable feed id");
assert.match(mainProcess, /manifestScore/, "F1 TV resolver should prefer playable CMAF/HLS manifests over DASH when F1 TV provides them");
assert.match(mainProcess, /\.filter\(\(value\) => isF1TvManifestUrl\(value\)\)/, "F1 TV resolver should not treat license URLs as playable manifests");
assert.match(mainProcess, /pitwall:f1tv:browse/, "Electron main should expose F1 TV content browser IPC");
assert.match(mainProcess, /pitwall:f1tv:browseSession/, "Electron main should expose F1 TV session browser IPC");
assert.match(mainProcess, /pitwall:f1tv:library/, "Electron main should expose F1 TV library IPC");
assert.match(mainProcess, /F1TV_LIBRARY_CACHE_FILE/, "F1 TV library should persist a season cache so Live Racing opens quickly");
assert.match(mainProcess, /F1TV_LIBRARY_CACHE_MS/, "F1 TV library cache should have an explicit TTL");
assert.match(mainProcess, /forceRefresh/, "F1 TV library IPC should support bypassing the cache for manual reloads");
assert.match(mainProcess, /F1TV_SEASON_PAGE_IDS[\s\S]*2026[\s\S]*12343/, "F1 TV library should know the official CMS season page for the 2026 season");
assert.match(mainProcess, /fetchF1TvCmsSeasonContent\(year\)/, "F1 TV library should enrich OpenF1 schedule rows with fast F1 TV CMS content metadata");
assert.match(mainProcess, /f1TvCmsDetailPageUrisFromPage/, "F1 TV library should follow CMS meeting detail pages because the season page only contains meeting bundles");
assert.match(mainProcess, /F1TV_CMS_DETAIL_TIMEOUT_MS/, "F1 TV CMS detail fetches should have a short timeout so Live Racing does not hang");
assert.match(mainProcess, /sessionKey: String\(session\.session_key \|\| ""\)/, "OpenF1 session keys should be carried through for exact F1 TV CMS status matching");
assert.doesNotMatch(mainProcess, /async function getF1TvLibrary[\s\S]{0,2500}resolveF1TvContent/, "F1 TV library should not load the hidden F1 TV player just to determine live/replay status");
const f1TvCmsLibrarySandbox = vm.runInNewContext(`(() => {
  ${extractNamedFunction(mainProcess, "normalizeOpenF1SessionKind")}
  ${extractNamedFunction(mainProcess, "f1TvCmsTimeIso")}
  ${extractNamedFunction(mainProcess, "normalizeF1TvCmsSessionKind")}
  ${extractNamedFunction(mainProcess, "normalizeF1TvCmsContentItem")}
  ${extractNamedFunction(mainProcess, "applyF1TvCmsLibraryMetadata")}
  return { normalizeF1TvCmsContentItem, applyF1TvCmsLibraryMetadata };
})()`);
const cmsLiveLibrary = f1TvCmsLibrarySandbox.applyF1TvCmsLibraryMetadata({
  source: "OpenF1",
  season: "2026",
  races: [{
    rnd: 7,
    name: "Barcelona Grand Prix",
    status: "done",
    meetingKey: "1234",
    sessions: [
      { kind: "Practice 1", status: "done", startsAt: "2026-06-12T11:30:00Z", endsAt: "2026-06-12T12:30:00Z" },
      { kind: "Practice 2", status: "done", startsAt: "2026-06-12T15:00:00Z", endsAt: "2026-06-12T16:00:00Z" },
      { kind: "Race", status: "upcoming", startsAt: "2026-06-14T13:00:00Z", endsAt: "2026-06-14T15:00:00Z" },
    ],
  }],
}, [{
  metadata: {
    contentId: "cms-live-fp2",
    contentSubtype: "LIVE",
    title: "Practice 2",
    emfAttributes: {
      MeetingKey: "1234",
      MeetingSessionKey: "5678",
      Global_Title: "Practice 2",
      sessionStartDate: "2026-06-12T15:00:00Z",
      sessionEndDate: "2026-06-12T16:00:00Z",
    },
  },
}], Date.parse("2026-06-12T16:01:00Z"));
assert.equal(cmsLiveLibrary.races[0].sessions[1].status, "live", "F1 TV CMS LIVE should keep an overrun session live after its scheduled end");
assert.equal(cmsLiveLibrary.races[0].sessions[1].statusSource, "f1tv-cms", "F1 TV CMS status should be marked as authoritative");
assert.equal(cmsLiveLibrary.races[0].sessions[1].contentId, "cms-live-fp2", "F1 TV CMS enrichment should attach the content id for later session resolution");
assert.equal(cmsLiveLibrary.races[0].status, "live", "F1 TV CMS LIVE should make the race weekend live only while a session is live");
const cmsReplayLibrary = f1TvCmsLibrarySandbox.applyF1TvCmsLibraryMetadata({
  source: "OpenF1",
  season: "2026",
  races: [{
    rnd: 7,
    name: "Barcelona Grand Prix",
    status: "live",
    meetingKey: "1234",
    sessions: [
      { kind: "Qualifying", status: "live", startsAt: "2026-06-13T14:00:00Z", endsAt: "2026-06-13T15:00:00Z" },
    ],
  }],
}, [{
  metadata: {
    contentId: "cms-replay-quali",
    contentSubtype: "REPLAY",
    title: "Qualifying",
    emfAttributes: {
      MeetingKey: "1234",
      MeetingSessionKey: "7777",
      Global_Title: "Qualifying",
    },
  },
}], Date.parse("2026-06-13T14:30:00Z"));
assert.equal(cmsReplayLibrary.races[0].sessions[0].status, "done", "F1 TV CMS REPLAY should override stale scheduled-live status");
const cmsExactSessionLibrary = f1TvCmsLibrarySandbox.applyF1TvCmsLibraryMetadata({
  source: "OpenF1",
  season: "2026",
  races: [{
    rnd: 7,
    name: "Barcelona Grand Prix",
    status: "upcoming",
    meetingKey: "1234",
    sessions: [
      { kind: "Race", status: "upcoming", sessionKey: "race-session" },
    ],
  }],
}, [{
  metadata: {
    contentId: "cms-wrong-live-race",
    contentSubtype: "LIVE",
    title: "Race",
    emfAttributes: {
      MeetingKey: "1234",
      MeetingSessionKey: "other-race-session",
      Global_Title: "Race",
    },
  },
}, {
  metadata: {
    contentId: "cms-exact-replay-race",
    contentSubtype: "REPLAY",
    title: "Race",
    emfAttributes: {
      MeetingKey: "1234",
      MeetingSessionKey: "race-session",
      Global_Title: "Race",
    },
  },
}]);
assert.equal(cmsExactSessionLibrary.races[0].sessions[0].status, "done", "F1 TV CMS enrichment should prefer exact session-key matches over same-kind rows");
assert.equal(cmsExactSessionLibrary.races[0].sessions[0].contentId, "cms-exact-replay-race", "F1 TV CMS exact session-key matching should preserve the exact content id");
const cmsMismatchedSessionLibrary = f1TvCmsLibrarySandbox.applyF1TvCmsLibraryMetadata({
  source: "OpenF1",
  season: "2026",
  races: [{
    rnd: 7,
    name: "Barcelona Grand Prix",
    status: "upcoming",
    meetingKey: "1234",
    sessions: [
      { kind: "Qualifying", status: "upcoming", sessionKey: "official-qualifying" },
    ],
  }],
}, [{
  metadata: {
    contentId: "cms-other-qualifying",
    contentSubtype: "REPLAY",
    title: "Qualifying",
    emfAttributes: {
      MeetingKey: "1234",
      MeetingSessionKey: "other-qualifying",
      Global_Title: "Qualifying",
    },
  },
}]);
assert.equal(cmsMismatchedSessionLibrary.races[0].sessions[0].status, "upcoming", "F1 TV CMS enrichment should not use same-kind rows when OpenF1 has a different session key");
assert.match(mainProcess, /filter_MeetingKey/, "F1 TV session browser should open meeting-filtered replay search pages");
assert.match(mainProcess, /pitwall:f1tv:streams/, "Electron main should expose captured F1 TV stream IPC");
assert.match(mainProcess, /pitwall:f1tv:resolveContent/, "Electron main should expose hidden F1 TV content resolution IPC");
assert.match(mainProcess, /PITWALL_F1TV_DIAG_URL/, "Electron should support a sanitized F1 TV resolver diagnostic mode for production-profile testing");
assert.match(mainProcess, /PITWALL_F1TV_DIAG_SESSION/, "F1 TV diagnostics should support reproducing picker session-kind resolution");
assert.match(mainProcess, /PITWALL_F1TV_LIBRARY_DIAG/, "Electron should support a sanitized F1 TV library diagnostic mode");
assert.match(mainProcess, /PITWALL_REPLAY_TIMING_AVAILABILITY_DIAG/, "Electron should support a sanitized replay timing availability diagnostic mode");
assert.match(mainProcess, /PITWALL_DASHBOARD_DIAG/, "Electron should support a hidden Dashboard data-richness diagnostic mode");
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
assert.match(mainProcess, /const \{ app, BrowserWindow, Menu, ipcMain, shell, session, Notification, components \} = require\("electron"\)/, "Electron main should import Menu for an explicit macOS application menu");
assert.match(mainProcess, /function installApplicationMenu\(\)[\s\S]*Menu\.buildFromTemplate[\s\S]*Menu\.setApplicationMenu\(menu\)/, "Electron should install an explicit app menu instead of relying on Electron's default macOS menu");
assert.match(mainProcess, /installApplicationMenu\(\);[\s\S]*return createWindow\(\)/, "Electron should install the application menu before creating the main window");
assert.doesNotMatch(mainProcess, /role:\s*["']window["']/, "Application menu should avoid the auto-populated macOS window list while investigating Accessibility menu crashes");
assert.match(mainProcess, /PITWALL_ANALYTICS_SESSION_DIAG/, "Packaged app should expose an analytics-session diagnostic for production data verification");
assert.match(mainProcess, /pitwall:f1tv:probeStatus/, "Electron main should expose a deep F1 TV auth probe for storage-backed sessions");
assert.match(mainProcess, /credentialError/, "F1 TV credential sign-in should return sanitized direct-token errors when it falls back to browser login");
assert.match(mainProcess, /storageAuthKeys/, "F1 TV auth status should include local/session/IndexedDB auth-key evidence without exposing values");
assert.match(mainProcess, /IGNORED_F1TV_COOKIE_PATTERN/, "F1 TV auth should ignore analytics/consent cookies such as ABTastySession");
assert.match(mainProcess, /(?:\^login\$|name === "login")/, "F1 TV auth should ignore the weak Formula 1 login cookie that appears before playback auth is ready");
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
assert.match(mainProcess, /input\[placeholder\*='email' i\]/, "F1 TV credential login should fill placeholder-only email fields");
assert.match(mainProcess, /if \(emailFilled && passwordFilled\) return clickF1TvLoginStep/, "F1 TV credential login should not submit the final form when only the password field was filled");
assert.match(mainProcess, /storages = \[[^\]]*"indexeddb"[^\]]*"localstorage"[\s\S]*clearStorageData/, "F1 TV logout should clear storage-backed auth state as well as cookies");
assert.doesNotMatch(mainProcess, /f1tv-password/, "F1 TV password should not be stored by PitWall");
assert.match(mainProcess, /pitwall:data:snapshot/, "Electron main should expose a live F1 data snapshot IPC");
assert.match(mainProcess, /pitwall:ai:ask/, "Electron main should expose AI ask IPC");
assert.match(mainProcess, /chatgpt\.com\/backend-api\/codex\/responses/, "AI layer should call the ChatGPT Codex backend");
assert.match(mainProcess, /api\.x\.ai\/v1\/chat\/completions/, "AI layer should call the xAI chat completions API");
assert.doesNotMatch(mainProcess, /api\.openai\.com\/v1\/responses|api\.anthropic\.com\/v1\/messages/, "AI layer should not expose removed API-key providers");
assert.match(mainProcess, /COPILOT_INSIGHTS_FILE/, "Copilot daily insights should be stored in a file-backed cache");
assert.match(mainProcess, /getDailyCopilotInsights/, "Live snapshots should attach daily prebuilt Copilot insights");
assert.match(mainProcess, /attemptedOn/, "Daily Copilot insight generation should record one attempt per local day");
assert.match(mainProcess, /drivers-championship/, "Daily Copilot insights should include a drivers championship page");
assert.match(mainProcess, /constructors-championship/, "Daily Copilot insights should include a constructors championship page");
assert.match(mainProcess, /current-weekend/, "Daily Copilot insights should include a current race weekend page");
assert.match(mainProcess, /next-weekend/, "Daily Copilot insights should include a next race weekend page");
const dailyCopilotProgressForSmoke = vm.runInNewContext(`(() => {
  const COPILOT_INSIGHT_PAGES = [
    { id: "drivers-championship", title: "Drivers championship" },
    { id: "constructors-championship", title: "Constructors championship" },
    { id: "current-weekend", title: "Current race weekend" },
    { id: "next-weekend", title: "Next race weekend" },
  ];
  ${extractNamedFunction(mainProcess, "dailyCopilotProgress")}
  return dailyCopilotProgress;
})()`);
assert.deepEqual(
  JSON.parse(JSON.stringify(dailyCopilotProgressForSmoke({
    status: "thinking",
    currentPage: { id: "current-weekend", title: "Current race weekend" },
    currentIndex: 2,
    completedPages: 1,
  }).items.map((item) => [item.id, item.status]))),
  [
    ["drivers-championship", "computed"],
    ["constructors-championship", "computed"],
    ["current-weekend", "thinking"],
    ["next-weekend", "waiting"],
  ],
  "Daily Copilot progress should not show earlier pages as undone when a partial refresh reports a stale completed count"
);
const mergeCopilotDataForSmoke = vm.runInNewContext(`(() => {
  ${extractNamedFunction(dataProviderSource, "copilotDailyUpdatedAtMs")}
  ${extractNamedFunction(dataProviderSource, "copilotDailyProgressRank")}
  ${extractNamedFunction(dataProviderSource, "shouldKeepCurrentCopilotDaily")}
  ${extractNamedFunction(dataProviderSource, "mergeCopilotData")}
  return mergeCopilotData;
})()`);
assert.equal(
  mergeCopilotDataForSmoke({
    daily: {
      status: "pending",
      updatedAt: "2026-06-12T22:10:10.000Z",
      progress: { completedPages: 2, items: [{ status: "computed" }, { status: "computed" }, { status: "thinking" }] },
    },
  }, {
    daily: {
      status: "pending",
      updatedAt: "2026-06-12T22:10:05.000Z",
      progress: { completedPages: 1, items: [{ status: "computed" }, { status: "thinking" }, { status: "waiting" }] },
    },
  }).daily.progress.completedPages,
  2,
  "Copilot daily progress should ignore older overlapping snapshot responses"
);
const copilotWeekendSelection = vm.runInNewContext(`(() => {
  ${extractNamedFunction(mainProcess, "finiteNumber")}
  ${extractNamedFunction(mainProcess, "raceWeekendIsActive")}
  ${extractNamedFunction(mainProcess, "raceWeekendKey")}
  ${extractNamedFunction(mainProcess, "raceWeekendOrderValue")}
  ${extractNamedFunction(mainProcess, "currentRaceWeekend")}
  ${extractNamedFunction(mainProcess, "nextRaceWeekend")}
  return { currentRaceWeekend, nextRaceWeekend };
})()`);
const activeWeekendSchedule = [
  { rnd: 7, name: "Monaco Grand Prix", status: "done", startsAt: "2026-06-07T13:00:00.000Z", sessions: [{ kind: "Race", status: "done" }] },
  { rnd: 8, name: "Spanish Grand Prix", status: "upcoming", startsAt: "2026-06-14T13:00:00.000Z", sessions: [
    { kind: "Practice 1", status: "done", startsAt: "2026-06-12T11:30:00.000Z" },
    { kind: "Practice 2", status: "upcoming", startsAt: "2026-06-12T15:00:00.000Z" },
    { kind: "Race", status: "upcoming", startsAt: "2026-06-14T13:00:00.000Z" },
  ] },
  { rnd: 9, name: "Canadian Grand Prix", status: "upcoming", startsAt: "2026-06-21T18:00:00.000Z", sessions: [{ kind: "Practice 1", status: "upcoming" }] },
];
assert.equal(copilotWeekendSelection.currentRaceWeekend(activeWeekendSchedule).name, "Spanish Grand Prix", "Current weekend Copilot projections should use a race weekend once sessions have started");
assert.equal(copilotWeekendSelection.nextRaceWeekend(activeWeekendSchedule).name, "Canadian Grand Prix", "Next weekend Copilot projections should skip the active current race weekend");
assert.match(mainProcess, /requestCodexResponsesStream/, "Codex AI layer should use the required streaming responses contract");
assert.match(mainProcess, /instructions:\s*task\.systemPrompt/, "Codex AI layer should send task-selected system guidance as top-level instructions");
assert.match(mainProcess, /AI_INSIGHT_RESPONSE_SCHEMA/, "AI layer should define a slim response schema for auto insights");
assert.match(mainProcess, /aiTaskConfig/, "AI layer should select prompt and schema per task");
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
assert.match(mainProcess, /analyticsSessionDiskEntry\(\[cacheKey, aliasKey\], \{ allowStale: true \}\)/, "Session analytics should return cached OpenF1 session data immediately while checking for updates later");
assert.match(mainProcess, /OpenF1 rate limit reached/, "Session analytics should report OpenF1 rate limits without exposing raw URLs");
assert.match(mainProcess, /hasPublishedRows/, "Session analytics should explain when OpenF1 has not published rows yet");
assert.match(mainProcess, /value === null \|\| value === undefined \|\| value === ""[\s\S]*return null/, "Session analytics should not coerce missing numeric values to zero");
assert.match(mainProcess, /COPILOT_WEEKEND_SESSION_KINDS[\s\S]*Practice 1[\s\S]*Practice 2[\s\S]*Practice 3[\s\S]*Qualifying/, "Current weekend Copilot predictions should consider FP1-FP3 and qualifying");
assert.match(mainProcess, /function buildWeekendSessionSummaries[\s\S]*getAnalyticsSession\(\{[\s\S]*sessionKind/, "Current weekend Copilot should reuse structured OpenF1 session analytics");
assert.match(mainProcess, /weekendSessionSummaries:\s*await buildWeekendSessionSummaries\(data, pageId\)/, "Daily AI snapshots should include structured weekend session summaries when predicting the current race");
assert.match(mainProcess, /pitwall:notify:schedule/, "Electron main should expose local reminder IPC");
assert.match(mainProcess, /pitwall:profile:get/, "Electron main should persist the user profile outside random localhost localStorage origins");
assert.match(mainProcess, /pitwall:profile:set/, "Electron main should save dashboard setup choices to the app profile");
assert.match(mainProcess, /livePanelSizes/, "Electron profile should persist Live Racing panel sizes outside random localhost localStorage origins");
assert.match(mainProcess, /videoQuality/, "Electron profile should persist Live Racing video quality outside random localhost localStorage origins");
assert.match(mainProcess, /liveCustomLayouts/, "Electron profile should persist custom Live Racing layouts outside random localhost localStorage origins");
assert.match(mainProcess, /tile\.lockAspect === true \? \{ lockAspect: true \} : \{\}/, "Electron profile should preserve custom layout feed aspect locks");
assert.match(dataProviderSource, /livePanelSizes/, "Renderer profile should carry persisted Live Racing panel sizes");
assert.match(dataProviderSource, /videoQuality/, "Renderer profile should carry persisted Live Racing video quality");
assert.match(dataProviderSource, /liveCustomLayouts/, "Renderer profile should carry persisted custom Live Racing layouts");
assert.match(dataProviderSource, /tile\.lockAspect === true \? \{ lockAspect: true \} : \{\}/, "Renderer profile should preserve custom layout feed aspect locks");
assert.match(dataProviderSource, /persisted\.livePanelSizes\s*!=\s*null[\s\S]*local\.livePanelSizes/, "Renderer profile merge should not let persisted null panel sizes wipe local Live Racing sizes");
assert.match(dataProviderSource, /persisted\.videoQuality\s*!=\s*null[\s\S]*local\.videoQuality/, "Renderer profile merge should not let missing persisted video quality wipe local Settings quality");
assert.match(dataProviderSource, /persisted\.liveCustomLayouts\s*!=\s*null[\s\S]*local\.liveCustomLayouts/, "Renderer profile merge should not let missing persisted custom layouts wipe local Live Racing layouts");
assert.match(dataProviderSource, /incoming\?\.standings\?\.length \? incoming\.standings : base\?\.standings/, "Renderer live-data merge should preserve previous standings when a refresh source returns no rows");
assert.match(dataProviderSource, /incoming\?\.constructors\?\.length \? mergeRowsByKey\(base\?\.constructors, incoming\.constructors, "abbr"\) : \(base\?\.constructors/, "Renderer live-data merge should preserve previous constructor standings when a refresh source returns no rows");
assert.match(dataProviderSource, /incoming\?\.schedule\?\.length \? incoming\.schedule : base\?\.schedule/, "Renderer live-data merge should preserve previous schedule when a refresh source returns no rows");
assert.match(liveRacingSource, /profile\.livePanelSizes/, "Live Racing should restore panel sizes from the persisted Electron profile");
assert.match(liveRacingSource, /window\.pitwall\?\.profile\?\.set/, "Live Racing should save resized panels to the persisted Electron profile");
assert.match(mainProcess, /new Notification/, "Reminder IPC should use native notifications");
assert.match(mainProcess, /detectBattlePairs/, "App should compute deterministic battle pairs before asking AI");
assert.match(mainProcess, /https:\/\/api\.openf1\.org\/v1\/championship_drivers\?session_key=latest/, "Live data should fetch current driver standings from the fast OpenF1 championship endpoint");
assert.match(mainProcess, /https:\/\/api\.openf1\.org\/v1\/championship_teams\?session_key=latest/, "Live data should fetch current constructor standings from the fast OpenF1 championship endpoint");
assert.match(mainProcess, /fetchOfficialF1StandingsFallback\(raw, errors\)/, "Live data should fetch official Formula 1 standings when OpenF1 championship rows are unavailable");
assert.match(mainProcess, /formula1\.com\/en\/results\/\$\{year\}\/\$\{kind\}/, "Official championship fallback should read Formula1.com results pages");
const liveCoreDataUrlsBlock = mainProcess.match(/const LIVE_CORE_DATA_URLS = \{[\s\S]*?\n\};/)?.[0] || "";
assert.match(liveCoreDataUrlsBlock, /openF1Weather[\s\S]*\.\.\.LIVE_NEWS_URLS/, "Initial live data snapshots should include fast display weather and news");
assert.doesNotMatch(liveCoreDataUrlsBlock, /f1api\.dev\/api\/current/, "Initial live data snapshots should not wait on slower F1 API standings endpoints");
assert.doesNotMatch(liveCoreDataUrlsBlock, /api\.jolpi\.ca\/ergast\/f1\/current/, "Initial live data snapshots should not wait on slow Jolpica current endpoints");
assert.match(mainProcess, /requestOpenF1Json\(`https:\/\/api\.openf1\.org\/v1\/meetings\?year=\$\{year\}`\)[\s\S]*requestOpenF1Json\(`https:\/\/api\.openf1\.org\/v1\/sessions\?year=\$\{year\}`\)[\s\S]*parseOpenF1Schedule\(meetings, sessions\)/, "Weekend library should use OpenF1 schedule data without waiting on Jolpica");
assert.match(mainProcess, /api\.openf1\.org\/v1\/weather\?session_key=latest/, "Live data should fetch current/latest track weather from OpenF1");
assert.match(mainProcess, /fetchOpenF1WeekendWeather\(nextRace\)/, "Live data should fall back to selected-weekend OpenF1 weather when latest weather is unavailable");
assert.match(mainProcess, /standingsByNumber/, "OpenF1 timing parser should map driver numbers back to known driver codes");
assert.doesNotMatch(mainProcess, /code:\s*driver\?\.name_acronym\s*\|\|\s*String\(row\.driver_number\)/, "OpenF1 timing rows should not fall back to raw driver numbers before checking standings metadata");
assert.match(mainProcess, /motorsport\.com\/rss\/f1\/news/, "Live data should fetch current F1 news RSS");
assert.doesNotMatch(mainProcess, /autosport\.com\/rss\/f1\/news|Autosport/, "Live data should not fetch or configure Autosport as a news source");
assert.match(mainProcess, /formula1\.com\/en\/latest\/all\.xml/, "Live news should include official Formula 1 coverage via RSS");
assert.match(mainProcess, /the-race\.com\/rss/, "Live news should include The Race coverage via RSS");
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
assert.match(preload, /snapshot: \(options = \{\}\)/, "Renderer should be able to request live F1 data snapshots with startup refresh options");

const html = fs.readFileSync(path.join(root, "ui_kits/pitwall/index.html"), "utf8");
const themeSource = fs.readFileSync(path.join(root, "ui_kits/pitwall/theme.js"), "utf8");
assert.doesNotMatch(html, /unpkg\.com/, "Electron app should not depend on CDN React");
assert.match(html, /node_modules\/hls\.js\/dist\/hls\.min\.js/, "Renderer should load local hls.js");
assert.match(html, /node_modules\/shaka-player\/dist\/shaka-player\.compiled\.js/, "Renderer should load local Shaka Player");
assert.match(html, /theme\.js/, "Renderer should load saved theme tokens before app screens");
assert.match(themeSource, /value: "purple"/, "Theme tokens should offer a purple theme");
assert.match(themeSource, /--primary/, "Theme tokens should update primary action color");
assert.match(themeSource, /--accent-border/, "Theme tokens should update derived accent borders, not only the base accent");
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
assert.match(source["Dashboard.jsx"], /D\.race\.weatherLoc \|\| D\.race\.loc/, "Dashboard weather card should label latest-session fallback weather honestly");
assert.match(source["DataProvider.jsx"], /snapshot\(\{[\s\S]*forceRefresh:\s*true[\s\S]*\}\)/, "Initial app load should bypass cached dashboard data before revealing the app");
assert.match(source["DataProvider.jsx"], /initialDataReady[\s\S]*PitWallLoadingScreen[\s\S]*children/, "DataProvider should keep the app behind a loading screen until the initial live fetch resolves");
assert.match(source["DataProvider.jsx"], /Loading championship standings[\s\S]*Loading race schedule[\s\S]*Loading track weather[\s\S]*Loading F1 news/, "Startup loading screen should show which live data groups are loading");
assert.match(source["Weekend.jsx"], /D\.race\?\.weatherLoc \|\| selectedRace\.loc/, "Weekend weather cards should label latest-session fallback weather honestly");
assert.doesNotMatch(source["Weekend.jsx"], /OpenF1 and Jolpica/, "Weekend loading copy should not mention Jolpica after moving live schedule to OpenF1");
const dashboardCountdownSandbox = vm.runInNewContext(`(() => {
  ${extractNamedFunction(source["Dashboard.jsx"], "dashboardSessionCandidate")}
  ${extractNamedFunction(source["Dashboard.jsx"], "dashboardNextSession")}
  ${extractNamedFunction(source["Dashboard.jsx"], "dashboardCountdownLabel")}
  return { dashboardNextSession, dashboardCountdownLabel };
})()`);
const nextWeekendSession = dashboardCountdownSandbox.dashboardNextSession({
  race: { name: "Monaco Grand Prix", startsAt: "2026-06-07T13:00:00Z" },
  sessions: [{ kind: "Race", status: "done", startsAt: "2026-06-07T13:00:00Z" }],
  schedule: [
    { name: "Monaco Grand Prix", status: "done", sessions: [{ kind: "Race", status: "done", startsAt: "2026-06-07T13:00:00Z" }] },
    { name: "Barcelona Grand Prix", status: "upcoming", sessions: [{ kind: "Practice 1", status: "upcoming", startsAt: "2026-06-12T11:30:00Z" }] },
  ],
});
assert.equal(nextWeekendSession.session.kind, "Practice 1", "Dashboard countdown should advance to the next weekend session after a race ends");
assert.equal(dashboardCountdownSandbox.dashboardCountdownLabel(nextWeekendSession), "Practice 1 starts in", "Dashboard countdown label should name the upcoming session");
const nextSameWeekendSession = dashboardCountdownSandbox.dashboardNextSession({
  race: { name: "Barcelona Grand Prix" },
  sessions: [
    { kind: "Practice 1", status: "done", startsAt: "2026-06-12T11:30:00Z" },
    { kind: "Practice 2", status: "done", startsAt: "2026-06-12T15:00:00Z" },
    { kind: "Practice 3", status: "done", startsAt: "2026-06-13T10:30:00Z" },
    { kind: "Qualifying", status: "upcoming", startsAt: "2026-06-13T14:00:00Z" },
  ],
  schedule: [],
});
assert.equal(nextSameWeekendSession.session.kind, "Qualifying", "Dashboard countdown should advance to qualifying after Practice 3");

const liveRacingSmartSandbox = vm.runInNewContext(`(() => {
  ${extractNamedFunction(source["LiveRacing.jsx"], "sessionFlagFromClock")}
  ${extractNamedFunction(source["LiveRacing.jsx"], "qualifyingPhaseFromSession")}
  ${extractNamedFunction(source["LiveRacing.jsx"], "qualifyingEliminationCount")}
  ${extractNamedFunction(source["LiveRacing.jsx"], "qualifyingQ1EliminationStart")}
  ${extractNamedFunction(source["LiveRacing.jsx"], "qualifyingQ2EliminationEnd")}
  ${extractNamedFunction(source["LiveRacing.jsx"], "isQualifyingEliminationRow")}
  ${extractNamedFunction(source["LiveRacing.jsx"], "timingDriverStatusState")}
  ${extractNamedFunction(source["LiveRacing.jsx"], "activeBattleCandidateScore")}
  ${extractNamedFunction(source["LiveRacing.jsx"], "intelligentOnboardCodes")}
  ${extractNamedFunction(source["LiveRacing.jsx"], "liveOnboardCodeForSlot")}
  ${extractNamedFunction(source["LiveRacing.jsx"], "formatSessionClock")}
  ${extractNamedFunction(source["LiveRacing.jsx"], "sessionClockSeconds")}
  ${extractNamedFunction(source["LiveRacing.jsx"], "formatSessionClockSeconds")}
  ${extractNamedFunction(source["LiveRacing.jsx"], "smoothSessionClockLabel")}
  ${extractNamedFunction(source["LiveRacing.jsx"], "sessionClockDisplayLabel")}
  return { intelligentOnboardCodes, isQualifyingEliminationRow, liveOnboardCodeForSlot, qualifyingPhaseFromSession, sessionClockDisplayLabel, sessionFlagFromClock, timingDriverStatusState };
})()`);
function smartOnboardCodes(options) {
  return Array.from(liveRacingSmartSandbox.intelligentOnboardCodes(options));
}
const raceRows = [
  { pos: 1, code: "VER", interval: "LEADER" },
  { pos: 2, code: "LEC", interval: "+2.4" },
  { pos: 3, code: "HAM", interval: "+1.2" },
  { pos: 4, code: "RUS", interval: "+5.0" },
  { pos: 5, code: "NOR", interval: "+0.7" },
];
const liveTelemetrySandbox = vm.runInNewContext(`(() => {
  ${extractNamedFunction(source["LiveRacing.jsx"], "isQualifyingSessionKind")}
  ${extractNamedFunction(source["LiveRacing.jsx"], "formatTelemetryGap")}
  return { formatTelemetryGap };
})()`);
assert.equal(
  liveTelemetrySandbox.formatTelemetryGap({ gap: "+1.800", interval: "+0.250" }, "Race"),
  "+0.250",
  "Race onboard timing should show interval to the car ahead"
);
assert.equal(
  liveTelemetrySandbox.formatTelemetryGap({ gap: "+1.800", interval: "+0.250" }, "Practice 2"),
  "+0.250",
  "Practice onboard timing should show interval to the car ahead"
);
assert.equal(
  liveTelemetrySandbox.formatTelemetryGap({ gap: "+1.800", interval: "+0.250" }, "Qualifying"),
  "+1.800",
  "Qualifying onboard timing should show gap to leader instead of interval"
);
assert.deepEqual(
  smartOnboardCodes({ timingRows: raceRows, selectedCode: "VER", fallbackCodes: raceRows.map((row) => row.code), sessionKind: "Race" }),
  ["VER", "RUS", "NOR"],
  "Intelligent layout should score a much closer race battle above a looser higher-position pair"
);
assert.deepEqual(
  smartOnboardCodes({ timingRows: raceRows, preferredCode: "HAM", selectedCode: "VER", fallbackCodes: raceRows.map((row) => row.code), sessionKind: "Race" }),
  ["HAM", "RUS", "NOR"],
  "Intelligent layout should keep the user's favorite driver in onboard slot 1"
);
const positionWeightedRaceRows = [
  { pos: 1, code: "VER", interval: "LEADER" },
  { pos: 2, code: "HAM", interval: "+3.9" },
  { pos: 3, code: "LEC", interval: "+0.750" },
  { pos: 4, code: "HAD", interval: "+2.8" },
  { pos: 5, code: "RUS", interval: "+2.9" },
  { pos: 6, code: "PIA", interval: "+3.1" },
  { pos: 7, code: "GAS", interval: "+2.7" },
  { pos: 8, code: "NOR", interval: "+0.620" },
];
assert.deepEqual(
  smartOnboardCodes({ timingRows: positionWeightedRaceRows, selectedCode: "VER", fallbackCodes: positionWeightedRaceRows.map((row) => row.code), sessionKind: "Race" }),
  ["VER", "HAM", "LEC"],
  "Intelligent layout should still keep a higher-position battle when the lower-field gap is only slightly closer"
);
assert.equal(
  liveRacingSmartSandbox.liveOnboardCodeForSlot("focus-1", "VER", { "focus-1": "LEC" }, { LEC: {}, VER: {} }),
  "LEC",
  "First focus onboard slot should respect the user's selected driver override"
);
assert.deepEqual(
  smartOnboardCodes({
    timingRows: raceRows.map((row) => row.code === "HAM" ? { ...row, interval: "+0.820" } : row.code === "NOR" ? { ...row, interval: "+0.700" } : row),
    selectedCode: "PER",
    fallbackCodes: ["PER", ...raceRows.map((row) => row.code)],
    sessionKind: "Race",
    previousCodes: ["PER", "LEC", "HAM"],
  }),
  ["PER", "LEC", "HAM"],
  "Intelligent layout should keep a race battle through the hysteresis gap"
);
assert.deepEqual(
  smartOnboardCodes({
    timingRows: raceRows.map((row) => row.code === "HAM" ? { ...row, interval: "+2.4" } : row.code === "NOR" ? { ...row, interval: "+3.0" } : row),
    selectedCode: "PER",
    fallbackCodes: ["PER", ...raceRows.map((row) => row.code)],
    sessionKind: "Race",
    previousCodes: ["PER", "LEC", "HAM"],
  }),
  ["PER", "VER", "LEC"],
  "Intelligent layout should release a race battle after the hysteresis gap ends"
);
const qualifyingRows = Array.from({ length: 20 }, (_, index) => ({
  pos: index + 1,
  code: ["NOR", "PIA", "VER", "RUS", "LEC", "HAM", "ALO", "STR", "ALB", "SAI", "GAS", "OCO", "BEA", "HUL", "BOR", "LAW", "TSU", "COL", "BOT", "PER"][index],
  bestLapDuration: 90 + index * 0.2,
}));
const qualifyingRows2026 = qualifyingRows.concat([
  { pos: 21, code: "HAD", bestLapDuration: 94.0 },
  { pos: 22, code: "DUN", bestLapDuration: 94.2 },
]);
assert.deepEqual(
  smartOnboardCodes({ timingRows: qualifyingRows, selectedCode: "VER", fallbackCodes: qualifyingRows.map((row) => row.code), sessionKind: "Qualifying" }),
  ["VER", "LAW", "NOR"],
  "Intelligent layout should pair qualifying cutoff danger with the top benchmark"
);
assert.deepEqual(
  smartOnboardCodes({ timingRows: qualifyingRows2026, selectedCode: "VER", fallbackCodes: qualifyingRows2026.map((row) => row.code), sessionKind: "Qualifying", sessionClock: { qualifyingPart: "Q1" } }),
  ["VER", "TSU", "NOR"],
  "Intelligent layout should use the 2026 Q1 P17 danger cutoff for a 22-car field"
);
assert.deepEqual(
  smartOnboardCodes({ timingRows: qualifyingRows.slice(0, 15), selectedCode: "VER", fallbackCodes: qualifyingRows.map((row) => row.code), sessionKind: "Qualifying" }),
  ["VER", "SAI", "NOR"],
  "Intelligent layout should show the P10 bubble driver in Q2, not the eliminated P11 runner"
);
assert.deepEqual(
  smartOnboardCodes({ timingRows: qualifyingRows, selectedCode: "VER", fallbackCodes: qualifyingRows.map((row) => row.code), sessionKind: "Qualifying", sessionClock: { qualifyingPart: "Q2" } }),
  ["VER", "SAI", "NOR"],
  "Intelligent layout should use Q2 session phase even when timing still lists all 20 drivers"
);
assert.deepEqual(
  smartOnboardCodes({ timingRows: qualifyingRows2026, selectedCode: "VER", fallbackCodes: qualifyingRows2026.map((row) => row.code), sessionKind: "Qualifying", sessionClock: { qualifyingPart: "Q2" } }),
  ["VER", "SAI", "NOR"],
  "Intelligent layout should still use the P10 bubble in 2026 Q2 when timing lists all 22 drivers"
);
assert.deepEqual(
  smartOnboardCodes({ timingRows: qualifyingRows.slice(0, 10), selectedCode: "VER", fallbackCodes: qualifyingRows.map((row) => row.code), sessionKind: "Qualifying" }),
  ["VER", "NOR", "PIA"],
  "Intelligent layout should show top benchmark drivers in Q3 instead of an elimination bubble"
);
assert.deepEqual(
  smartOnboardCodes({ timingRows: qualifyingRows, selectedCode: "VER", fallbackCodes: qualifyingRows.map((row) => row.code), sessionKind: "Qualifying", sessionClock: { qualifyingPart: "Q3" } }),
  ["VER", "NOR", "PIA"],
  "Intelligent layout should use Q3 session phase even when timing still lists all 20 drivers"
);
assert.deepEqual(
  smartOnboardCodes({ timingRows: qualifyingRows, selectedCode: "NOR", fallbackCodes: qualifyingRows.map((row) => row.code), sessionKind: "Qualifying" }),
  ["NOR", "LAW", "PIA"],
  "Intelligent layout should not duplicate the preferred driver when the preferred driver is the top benchmark"
);
assert.equal(liveRacingSmartSandbox.isQualifyingEliminationRow({ pos: 16 }, { qualifyingPhase: "Q1", rowCount: 20 }), true, "20-car Q1 timing should mark P16 and lower as eliminated");
assert.equal(liveRacingSmartSandbox.isQualifyingEliminationRow({ pos: 16 }, { qualifyingPhase: "Q1", rowCount: 22 }), false, "2026 Q1 timing should keep P16 outside the eliminated highlight");
assert.equal(liveRacingSmartSandbox.isQualifyingEliminationRow({ pos: 17 }, { qualifyingPhase: "Q1", rowCount: 22 }), true, "2026 Q1 timing should mark P17 and lower as eliminated");
assert.equal(liveRacingSmartSandbox.isQualifyingEliminationRow({ pos: 15 }, { qualifyingPhase: "Q1", rowCount: 22 }), false, "Q1 timing should keep P15 outside the eliminated highlight");
assert.equal(liveRacingSmartSandbox.isQualifyingEliminationRow({ pos: 11 }, { qualifyingPhase: "Q2", rowCount: 22 }), true, "2026 Q2 timing should mark P11-P16 as eliminated");
assert.equal(liveRacingSmartSandbox.isQualifyingEliminationRow({ pos: 16 }, { qualifyingPhase: "Q2", rowCount: 22 }), true, "2026 Q2 timing should include P16 in the eliminated highlight");
assert.equal(liveRacingSmartSandbox.isQualifyingEliminationRow({ pos: 17 }, { qualifyingPhase: "Q2", rowCount: 22 }), false, "Q2 timing should not treat stale Q1 eliminated rows as the active Q2 cutoff");
assert.equal(liveRacingSmartSandbox.isQualifyingEliminationRow({ pos: 10 }, { qualifyingPhase: "Q3", rowCount: 22 }), false, "Q3 timing should not show elimination-row highlights");
assert.equal(liveRacingSmartSandbox.qualifyingPhaseFromSession({ sessionKind: "Sprint Qualifying", sessionClock: { qualifyingPart: "Q1" }, rowCount: 22 }), "SQ1", "Sprint Qualifying timing should map source Q1 to SQ1");
assert.equal(liveRacingSmartSandbox.qualifyingPhaseFromSession({ sessionKind: "Sprint Qualifying", sessionClock: { qualifyingPart: "Q2" }, rowCount: 22 }), "SQ2", "Sprint Qualifying timing should map source Q2 to SQ2");
assert.equal(liveRacingSmartSandbox.qualifyingPhaseFromSession({ sessionKind: "Sprint Qualifying", sessionClock: { qualifyingPart: "SQ2" }, rowCount: 22 }), "SQ2", "Sprint Qualifying timing should preserve SQ phase labels");
assert.equal(liveRacingSmartSandbox.sessionClockDisplayLabel({ remaining: "00:41:23" }, { sessionKind: "Practice 1" }), "FP1 41:23", "Practice 1 timing clock should prefix the remaining time with FP1");
assert.equal(liveRacingSmartSandbox.sessionClockDisplayLabel({ remaining: "00:32:10" }, { sessionKind: "Practice 2" }), "FP2 32:10", "Practice 2 timing clock should prefix the remaining time with FP2");
assert.equal(liveRacingSmartSandbox.sessionClockDisplayLabel({ remaining: "00:18:45" }, { sessionKind: "Practice 3" }), "FP3 18:45", "Practice 3 timing clock should prefix the remaining time with FP3");
assert.equal(liveRacingSmartSandbox.sessionClockDisplayLabel({ remaining: "00:41:23" }, { sessionKind: "Race" }), "41:23", "Race timing clock should keep the existing unprefixed countdown");
assert.equal(liveRacingSmartSandbox.sessionClockDisplayLabel({ remaining: "00:05:00", qualifyingPart: "Q2" }, { sessionKind: "Qualifying", rowCount: 20 }), "Q2 5:00", "Qualifying timing clock should keep the existing phase prefix");
assert.deepEqual(JSON.parse(JSON.stringify(liveRacingSmartSandbox.timingDriverStatusState({ status: "DNF" }))), { inactive: true, lastBadge: "RETIRED" }, "DNFed drivers should dim the row and show retired in last lap");
assert.deepEqual(JSON.parse(JSON.stringify(liveRacingSmartSandbox.timingDriverStatusState({ status: "KO" }))), { inactive: true, lastBadge: "KO" }, "Knocked-out drivers should dim the row and show KO in last lap");
assert.deepEqual(JSON.parse(JSON.stringify(liveRacingSmartSandbox.timingDriverStatusState({ status: "KnockedOut" }))), { inactive: true, lastBadge: "KO" }, "KnockedOut timing text should normalize to KO in last lap");
assert.deepEqual(JSON.parse(JSON.stringify(liveRacingSmartSandbox.timingDriverStatusState({ retired: true }))), { inactive: true, lastBadge: "RETIRED" }, "Retired timing rows should dim even when the feed sends a retired boolean");
assert.deepEqual(JSON.parse(JSON.stringify(liveRacingSmartSandbox.timingDriverStatusState({ knockedOut: true }))), { inactive: true, lastBadge: "KO" }, "Knocked-out timing rows should dim even when the feed sends a knockout boolean");
assert.deepEqual(JSON.parse(JSON.stringify(liveRacingSmartSandbox.timingDriverStatusState({ last: "PIT OUT" }))), { inactive: false, lastBadge: "PIT OUT" }, "Pit-out drivers should show a red last-lap badge without dimming the row");
assert.deepEqual(JSON.parse(JSON.stringify(liveRacingSmartSandbox.timingDriverStatusState({ last: "IN PIT" }))), { inactive: false, lastBadge: "IN PIT" }, "In-pit drivers should show a red last-lap badge without dimming the row");
assert.deepEqual(JSON.parse(JSON.stringify(liveRacingSmartSandbox.sessionFlagFromClock({ status: "Started" }))), { status: "green", label: "Green flag" }, "Live timing should show green flag from official session status");
assert.deepEqual(JSON.parse(JSON.stringify(liveRacingSmartSandbox.sessionFlagFromClock({ status: "Started", trackStatus: { status: "2", message: "Yellow" } }))), { status: "yellow", label: "Yellow flag" }, "Live timing should show yellow flag from official track status");
assert.deepEqual(JSON.parse(JSON.stringify(liveRacingSmartSandbox.sessionFlagFromClock({ status: "Aborted" }))), { status: "red", label: "Red flag" }, "Live timing should show red flag when the official session status stops the session");
assert.deepEqual(JSON.parse(JSON.stringify(liveRacingSmartSandbox.sessionFlagFromClock({ status: "Started", trackStatus: { status: "5", message: "Red" } }))), { status: "red", label: "Red flag" }, "Live timing should let official track red status override started session status");
assert.deepEqual(JSON.parse(JSON.stringify(liveRacingSmartSandbox.sessionFlagFromClock({}, { status: "yellow", label: "Replay" }))), { status: "yellow", label: "Replay" }, "Live timing should retain existing fallback flags when official status is missing");
assert.match(source["LiveRacing.jsx"], /data-elimination/, "Live timing rows should expose an elimination state for subtle qualifying highlights");
assert.match(source["LiveRacing.jsx"], /data-inactive/, "Live timing rows should expose an inactive state for DNF and KO drivers");
assert.match(source["LiveRacing.jsx"], /timing-cell--status/, "Live timing last-lap statuses should render as red badges");
assert.match(source["LiveRacing.jsx"], /statusState\.inactive \? "—" : row\.best/, "Inactive timing rows should dash out best lap");
assert.match(source["LiveRacing.jsx"], /statusState\.inactive \? "—" : row\.gap/, "Inactive timing rows should dash out gap");
assert.match(source["LiveRacing.jsx"], /statusState\.inactive \? "—" : row\.interval/, "Inactive timing rows should dash out interval");
assert.match(mainProcess, /line\?\.PitOut/, "F1 live timing rows should preserve pit-out state for the last-lap badge");
assert.match(mainProcess, /line\?\.Retired/, "F1 live timing rows should preserve retired state for all retired drivers");
const liveCustomLayoutSandbox = vm.runInNewContext(`(() => {
  const CUSTOM_TILE_MIN_PCT = 12;
  const CUSTOM_PRESET_PREFIX = "custom:";
  const CUSTOM_TICKER_MIN_H = 64;
  const CUSTOM_TICKER_MAX_H = 320;
  function normalizePresetName(name) {
    return name === "Driver Focus" ? "Intelligent" : name;
  }
  const LAYOUTS = {
    "Intelligent": "focus", "Apexline Classic": "quad", "Pit Wall Classic": "quad", "Battle Mode": "battle",
    "Data Overload": "data", "Minimal Clean": "focus", "Theater": "theater",
  };
  ${extractNamedFunction(source["LiveRacing.jsx"], "readInitialLivePreset")}
  ${extractNamedFunction(source["LiveRacing.jsx"], "customLayoutPresetId")}
  ${extractNamedFunction(source["LiveRacing.jsx"], "customLayoutIdFromPreset")}
  ${extractNamedFunction(source["LiveRacing.jsx"], "clampCustomTileGeometry")}
  ${extractNamedFunction(source["LiveRacing.jsx"], "customTilesOverlap")}
  ${extractNamedFunction(source["LiveRacing.jsx"], "customTileCollides")}
  ${extractNamedFunction(source["LiveRacing.jsx"], "applyCustomDrag")}
  ${extractNamedFunction(source["LiveRacing.jsx"], "snapCustomEdge")}
  ${extractNamedFunction(source["LiveRacing.jsx"], "snapCustomTileGeometry")}
  ${extractNamedFunction(source["LiveRacing.jsx"], "resolveCustomOnboardCode")}
  ${extractNamedFunction(source["LiveRacing.jsx"], "normalizeCustomTileSource")}
  ${extractNamedFunction(source["LiveRacing.jsx"], "customTileSourceKey")}
  ${extractNamedFunction(source["LiveRacing.jsx"], "customPaneIdForSource")}
  ${extractNamedFunction(source["LiveRacing.jsx"], "clampCustomTickerRows")}
  ${extractNamedFunction(source["LiveRacing.jsx"], "clampCustomTickerHeight")}
  ${extractNamedFunction(source["LiveRacing.jsx"], "normalizeCustomLayouts")}
  ${extractNamedFunction(source["LiveRacing.jsx"], "shouldApplyProfileCustomLayouts")}
  ${extractNamedFunction(source["LiveRacing.jsx"], "nextCustomLayoutName")}
  ${extractNamedFunction(source["LiveRacing.jsx"], "defaultCustomTileRect")}
  ${extractNamedFunction(source["LiveRacing.jsx"], "channelDisplayName")}
  return { applyCustomDrag, channelDisplayName, clampCustomTickerHeight, clampCustomTickerRows, clampCustomTileGeometry, customLayoutIdFromPreset, customLayoutPresetId, customPaneIdForSource, customTileCollides, customTileSourceKey, customTilesOverlap, defaultCustomTileRect, nextCustomLayoutName, normalizeCustomLayouts, normalizeCustomTileSource, readInitialLivePreset, resolveCustomOnboardCode, shouldApplyProfileCustomLayouts, snapCustomTileGeometry };
})()`);
const cloneVmValue = (value) => JSON.parse(JSON.stringify(value));
const localCustomLayouts = {
  layouts: [{ id: "cl-local", name: "Race day", tiles: [{ id: "t-1", source: { type: "onboard", code: "NOR" }, x: 0, y: 0, w: 50, h: 50 }] }],
};
assert.equal(
  liveCustomLayoutSandbox.shouldApplyProfileCustomLayouts(localCustomLayouts, { layouts: [] }),
  false,
  "A stale empty profile should not overwrite locally saved custom layouts on Live Racing reopen"
);
assert.equal(
  liveCustomLayoutSandbox.shouldApplyProfileCustomLayouts({ layouts: [] }, localCustomLayouts),
  true,
  "Profile custom layouts should hydrate Live Racing when local storage has none"
);
assert.equal(
  liveCustomLayoutSandbox.readInitialLivePreset({ defaultPreset: "Intelligent" }, { preset: "Theater" }),
  "Theater",
  "Live Racing should initialize from the last saved built-in layout before the save effect runs"
);
assert.equal(
  liveCustomLayoutSandbox.readInitialLivePreset({ defaultPreset: "Battle Mode" }, { preset: "Not a layout" }),
  "Battle Mode",
  "Invalid saved layouts should fall back to the settings default"
);
assert.equal(
  liveCustomLayoutSandbox.readInitialLivePreset({ defaultPreset: "Apexline Classic" }, { preset: "Driver Focus" }),
  "Intelligent",
  "Legacy Driver Focus saved layouts should still restore as Intelligent"
);
assert.deepEqual(
  cloneVmValue(liveCustomLayoutSandbox.clampCustomTileGeometry({ x: 95, y: -4, w: 30, h: 6 })),
  { x: 70, y: 0, w: 30, h: 12 },
  "Custom tiles should clamp inside the canvas with a minimum size"
);
assert.ok(
  liveCustomLayoutSandbox.customTilesOverlap({ x: 0, y: 0, w: 50, h: 50 }, { x: 49, y: 49, w: 20, h: 20 }),
  "Overlapping custom tiles should be detected"
);
assert.ok(
  !liveCustomLayoutSandbox.customTilesOverlap({ x: 0, y: 0, w: 50, h: 50 }, { x: 50, y: 0, w: 20, h: 20 }),
  "Edge-adjacent custom tiles should not count as overlapping"
);
assert.ok(
  liveCustomLayoutSandbox.customTileCollides({ x: 10, y: 10, w: 20, h: 20 }, [{ x: 25, y: 25, w: 20, h: 20 }]),
  "Collision check should flag any overlap against the other tiles"
);
assert.deepEqual(
  cloneVmValue(liveCustomLayoutSandbox.applyCustomDrag({ x: 10, y: 10, w: 30, h: 30 }, "move", 5, -3)),
  { x: 15, y: 7, w: 30, h: 30 },
  "Move drags should shift the tile origin only"
);
assert.deepEqual(
  cloneVmValue(liveCustomLayoutSandbox.applyCustomDrag({ x: 10, y: 10, w: 30, h: 30 }, "nw", -2, 4)),
  { x: 8, y: 14, w: 32, h: 26 },
  "North-west resize drags should move the origin and counter-adjust the size"
);
assert.deepEqual(
  cloneVmValue(liveCustomLayoutSandbox.applyCustomDrag({ x: 10, y: 10, w: 30, h: 30 }, "w", 40, 0)),
  { x: 28, y: 10, w: 12, h: 30 },
  "Dragging the west edge past the minimum should pin the right edge instead of teleporting"
);
assert.deepEqual(
  cloneVmValue(liveCustomLayoutSandbox.snapCustomTileGeometry({ x: 51.2, y: 10, w: 20, h: 20 }, [{ x: 30, y: 0, w: 20, h: 40 }], 1.5, "move")),
  { x: 50, y: 10, w: 20, h: 20 },
  "Moving custom tiles should snap to neighbor edges within the threshold"
);
assert.deepEqual(
  cloneVmValue(liveCustomLayoutSandbox.snapCustomTileGeometry({ x: 10, y: 10, w: 39, h: 20 }, [{ x: 50, y: 0, w: 20, h: 40 }], 1.5, "e")),
  { x: 10, y: 10, w: 40, h: 20 },
  "Resizing a custom tile's right edge should snap to a neighbor's left edge"
);
assert.deepEqual(
  cloneVmValue(liveCustomLayoutSandbox.snapCustomTileGeometry({ x: 10, y: 10, w: 20, h: 20 }, [], 1.5, "move")),
  { x: 10, y: 10, w: 20, h: 20 },
  "Tiles away from any edge should not snap"
);
assert.equal(liveCustomLayoutSandbox.customPaneIdForSource({ type: "onboard", code: "NOR" }), "DRIVER-NOR", "Onboard tiles should reuse the existing driver pane id scheme");
assert.equal(liveCustomLayoutSandbox.customPaneIdForSource({ type: "channel", feedId: "PIT" }), "CHANNEL-PIT", "Channel tiles should get a channel pane id");
assert.equal(liveCustomLayoutSandbox.customPaneIdForSource({ type: "timing" }), "TIMING", "Timing tiles should get the timing pane id");
assert.equal(liveCustomLayoutSandbox.customTileSourceKey({ type: "channel", feedId: "PIT" }), "channel:PIT", "Source keys should be stable per source");
assert.deepEqual(cloneVmValue(liveCustomLayoutSandbox.normalizeCustomTileSource({ type: "smart-onboard", mode: "leader" })), { type: "smart-onboard", mode: "leader" }, "Custom layouts should accept dynamic leader onboard sources");
assert.deepEqual(cloneVmValue(liveCustomLayoutSandbox.normalizeCustomTileSource({ type: "smart-onboard", mode: "battle-primary" })), { type: "smart-onboard", mode: "battle-primary" }, "Custom layouts should accept a dynamic battle primary onboard source");
assert.equal(liveCustomLayoutSandbox.customTileSourceKey({ type: "smart-onboard", mode: "favorite1" }), "smart-onboard:favorite1", "Dynamic onboard source keys should be stable by mode");
assert.equal(liveCustomLayoutSandbox.customPaneIdForSource({ type: "smart-onboard", mode: "leader" }), "SMART-ONBOARD-leader", "Dynamic onboard tiles should get a pane id separate from fixed driver tiles");
const smartContext = {
  timingRows: [{ code: "VER", pos: 1 }, { code: "NOR", pos: 2 }, { code: "PIA", pos: 3 }],
  standings: [{ code: "LEC" }],
  drivers: [{ code: "VER" }, { code: "NOR" }, { code: "PIA" }],
  byCode: { VER: {}, NOR: {}, PIA: {}, HAM: {} },
  profile: { favoriteDrivers: ["NOR", "HAM"] },
};
assert.equal(liveCustomLayoutSandbox.resolveCustomOnboardCode({ type: "smart-onboard", mode: "leader" }, smartContext), "VER", "Dynamic leader onboard should follow the timing leader");
assert.equal(liveCustomLayoutSandbox.resolveCustomOnboardCode({ type: "smart-onboard", mode: "favorite1" }, smartContext), "NOR", "Dynamic favorite onboard should follow the first configured favorite");
assert.equal(liveCustomLayoutSandbox.resolveCustomOnboardCode({ type: "smart-onboard", mode: "favorite2" }, smartContext), "HAM", "Dynamic second favorite onboard should follow the second configured favorite");
assert.equal(liveCustomLayoutSandbox.resolveCustomOnboardCode({ type: "smart-onboard", mode: "battle-secondary" }, smartContext), "NOR", "Dynamic battle secondary should prefer the first favorite that is not the leader");
const nonRaceBattleContext = {
  timingRows: [{ code: "VER", pos: 1 }, { code: "PIA", pos: 2 }, { code: "NOR", pos: 3 }],
  drivers: [{ code: "VER" }, { code: "PIA" }, { code: "NOR" }, { code: "HAM" }],
  byCode: { VER: {}, PIA: {}, NOR: {}, HAM: {} },
  profile: { favoriteDrivers: ["HAM"] },
  sessionKind: "Practice 2",
};
assert.equal(liveCustomLayoutSandbox.resolveCustomOnboardCode({ type: "smart-onboard", mode: "battle-primary" }, nonRaceBattleContext), "VER", "Non-race custom battle primary should follow the top timing row");
assert.equal(liveCustomLayoutSandbox.resolveCustomOnboardCode({ type: "smart-onboard", mode: "battle-secondary" }, nonRaceBattleContext), "PIA", "Non-race custom battle secondary should follow the second timing row instead of a favorite");
assert.equal(liveCustomLayoutSandbox.resolveCustomOnboardCode({ type: "smart-onboard", mode: "battle-primary" }, { ...nonRaceBattleContext, timingRows: [{ code: "PIA", pos: 1 }, { code: "VER", pos: 2 }, { code: "NOR", pos: 3 }] }), "PIA", "Non-race custom battle primary should switch when timing P1 changes");
assert.equal(liveCustomLayoutSandbox.resolveCustomOnboardCode({ type: "smart-onboard", mode: "battle-secondary" }, { ...nonRaceBattleContext, timingRows: [{ code: "PIA", pos: 1 }, { code: "VER", pos: 2 }, { code: "NOR", pos: 3 }] }), "VER", "Non-race custom battle secondary should switch when timing P2 changes");
assert.match(source["LiveRacing.jsx"], /label: "Battle"[\s\S]*sources: \[smartSource\("battle-primary"\), smartSource\("battle-secondary"\)\]/, "Custom Battle picker should add both dynamic timing-top-two battle sources");
assert.equal(liveCustomLayoutSandbox.customLayoutIdFromPreset(liveCustomLayoutSandbox.customLayoutPresetId("cl-9")), "cl-9", "Custom preset ids should round-trip the layout id");
assert.equal(liveCustomLayoutSandbox.customLayoutIdFromPreset("Intelligent"), "", "Built-in presets should not parse as custom layout ids");
const normalizedCustom = cloneVmValue(liveCustomLayoutSandbox.normalizeCustomLayouts({
  layouts: [
    { id: "cl-1", name: "  Race day  ", tiles: [
      { id: "t-1", source: { type: "channel", feedId: "WORLD" }, x: 0, y: 0, w: 60, h: 100 },
      { id: "t-2", source: { type: "onboard", code: "VER" }, x: 60, y: 0, w: 50, h: 40, lockAspect: true },
      { id: "t-dupe", source: { type: "onboard", code: "VER" }, x: 0, y: 0, w: 20, h: 20 },
      { id: "t-bad", source: { type: "mystery" }, x: 0, y: 0, w: 20, h: 20 },
    ] },
    { id: "cl-1", name: "Duplicate id", tiles: [] },
    { not: "a layout" },
  ],
}));
assert.equal(normalizedCustom.layouts.length, 1, "Custom layout normalization should drop duplicate ids and malformed layouts");
assert.equal(normalizedCustom.layouts[0].name, "Race day", "Custom layout names should be trimmed");
assert.deepEqual(normalizedCustom.layouts[0].tiles.map((tile) => tile.id), ["t-1", "t-2"], "Custom layout tiles should drop duplicate sources and unknown source types");
assert.deepEqual(normalizedCustom.layouts[0].tiles[1], { id: "t-2", source: { type: "onboard", code: "VER" }, x: 50, y: 0, w: 50, h: 40, tickerRows: 0, tickerHeight: 140, lockAspect: true }, "Custom tile geometry should clamp into the canvas and preserve the aspect lock");
assert.equal(liveCustomLayoutSandbox.nextCustomLayoutName([]), "Custom layout 1", "First custom layout should get the first default name");
assert.equal(liveCustomLayoutSandbox.nextCustomLayoutName([{ name: "Custom layout 1" }, { name: "Custom layout 3" }]), "Custom layout 4", "Default custom layout names should skip taken names");
assert.deepEqual(
  cloneVmValue(liveCustomLayoutSandbox.defaultCustomTileRect([])),
  { x: 0, y: 0, w: 32, h: 32 },
  "First custom tile should land in the top-left corner"
);
assert.deepEqual(
  cloneVmValue(liveCustomLayoutSandbox.defaultCustomTileRect([{ x: 0, y: 0, w: 100, h: 32 }])),
  { x: 0, y: 32, w: 32, h: 32 },
  "New custom tiles should take the first free spot below occupied rows"
);
assert.deepEqual(
  cloneVmValue(liveCustomLayoutSandbox.defaultCustomTileRect([{ x: 0, y: 0, w: 80, h: 100 }])),
  { x: 80, y: 0, w: 20, h: 32 },
  "New custom tiles should shrink to fit a narrow open strip instead of failing to add"
);
assert.deepEqual(
  cloneVmValue(liveCustomLayoutSandbox.defaultCustomTileRect([{ x: 0, y: 0, w: 100, h: 80 }])),
  { x: 0, y: 80, w: 32, h: 20 },
  "New custom tiles should shrink to fit a shallow open strip instead of failing to add"
);
assert.match(source["LiveRacing.jsx"], /useState\(readCustomLayouts\)/, "Live Racing should initialize custom layouts from storage");
assert.match(source["LiveRacing.jsx"], /localStorage\.setItem\(CUSTOM_LAYOUT_STORAGE_KEY/, "Custom layouts should persist to localStorage on change");
assert.match(source["LiveRacing.jsx"], /liveCustomLayouts: normalized/, "Custom layouts should mirror to the pitwall profile like panel sizes");
assert.match(source["LiveRacing.jsx"], /localStorage\.setItem\("pw-live-layout"/, "The active preset should persist so custom layouts restore on reopen");
assert.match(source["LiveRacing.jsx"], /const layout = activeCustomLayout \? "custom" : LAYOUTS\[preset\]/, "An active custom layout should switch the layout type to custom");
assert.match(source["LiveRacing.jsx"], /function createCustomLayout/, "Live Racing should support creating custom layouts");
assert.match(source["LiveRacing.jsx"], /function deleteCustomLayout/, "Live Racing should support deleting custom layouts");
assert.match(source["LiveRacing.jsx"], /function duplicateCustomLayout/, "Live Racing should support duplicating custom layouts");
assert.match(source["LiveRacing.jsx"], /customLayoutIdFromPreset\(saved\.preset/, "Restoring should accept a saved custom layout preset");
assert.match(source["LiveRacing.jsx"], /<optgroup label="My layouts">/, "Layout preset dropdown should group saved custom layouts");
assert.match(source["LiveRacing.jsx"], /__new-custom-layout__/, "Layout preset dropdown should offer creating a new custom layout");
assert.match(source["LiveRacing.jsx"], /\.live__body\[data-layout="custom"\] \{ grid-template-columns: minmax\(0, 1fr\); \}/, "Custom layout should give the canvas the full live body width");
assert.match(source["LiveRacing.jsx"], /\.custom-canvas \{[^}]*position: relative;[^}]*background: #000/, "Custom canvas should be a relative black stage for free tile placement");
assert.match(source["LiveRacing.jsx"], /\.custom-tile \{[^}]*position: absolute/, "Custom tiles should be absolutely positioned");
assert.match(source["LiveRacing.jsx"], /\.custom-tile__handle--se \{[^}]*cursor: nwse-resize/, "Custom tiles should expose corner resize handles");
assert.match(source["LiveRacing.jsx"], /\.custom-tile__handle \{[^}]*z-index: [78]/, "Custom tile resize handles should sit above the drag header so top handles receive pointer events");
assert.match(source["LiveRacing.jsx"], /\.custom-picker \{[^}]*z-index/, "Custom feed picker should overlay the canvas");
assert.match(source["LiveRacing.jsx"], /function customTilePane/, "Custom layout tiles should convert to live panes");
assert.match(source["LiveRacing.jsx"], /paneId: pane\.paneId \|\| \(pane\.broadcast \? "WORLD" : `DRIVER-\$\{pane\.code\}`\)/, "Pane id mapping should respect precomputed custom pane ids");
assert.match(source["LiveRacing.jsx"], /layout === "custom"\s*\? \(activeCustomLayout\?\.tiles \|\| \[\]\)\.map\(customTilePane\)\.filter\(Boolean\)/, "Custom layout should build panes from its tiles");
assert.match(source["LiveRacing.jsx"], /driverOptions=\{p\.channel \? \[\] : D\.drivers\}/, "Channel panes should not offer a driver switcher");
assert.match(source["LiveRacing.jsx"], /\{driverOptions\.length > 0 && \(/, "Onboard pane should hide the driver select when no options exist");
assert.match(source["LiveRacing.jsx"], /updateCustomTileSource\(activeCustomLayout\.id, p\.tileId, \{ type: "onboard", code \}\)/, "Changing the driver on a custom onboard tile should update the saved layout");
assert.match(source["LiveRacing.jsx"], /function renderTimingTower/, "Timing tower content should be extracted for reuse by the custom layout timing tile");
assert.match(source["LiveRacing.jsx"], /\{layout !== "custom" && layout !== "theater" && \(\s*<>\s*<aside className="live__timing">/, "The docked timing sidebar should hide in custom and theater layout modes");
assert.match(source["LiveRacing.jsx"], /className="custom-canvas" ref=\{customCanvasRef\}/, "Custom mode should render the free placement canvas");
assert.match(source["LiveRacing.jsx"], /custom-canvas__empty/, "Custom canvas should show a blank-state add-feed prompt");
assert.match(source["LiveRacing.jsx"], /function beginCustomTileDrag/, "Custom tiles should support pointer drag and resize");
assert.match(source["LiveRacing.jsx"], /snapCustomTileGeometry\(proposed, others, threshold, mode\)/, "Custom tile drags should snap against neighbor edges");
assert.match(source["LiveRacing.jsx"], /if \(!customTileCollides\(next, others\)\) lastValid = next/, "Custom tile drags should reject geometry that overlaps another tile");
assert.match(source["LiveRacing.jsx"], /function renderCustomFeedPicker/, "Custom mode should offer a grouped feed picker");
assert.match(source["LiveRacing.jsx"], /\{ group: "Channels"/, "Feed picker should group F1 TV channels");
assert.match(source["LiveRacing.jsx"], /\{ group: "Intelligent onboards"/, "Feed picker should offer intelligent dynamic onboard sources");
assert.match(source["LiveRacing.jsx"], /label: "Battle"[\s\S]*sources: \[[\s\S]*battle-secondary/, "Feed picker battle option should add two intelligent onboard tiles");
assert.match(source["LiveRacing.jsx"], /function addCustomTiles/, "Custom layouts should support adding multiple feeds from one picker item");
assert.match(source["LiveRacing.jsx"], /source: normalized, lockAspect: true, \.\.\.rect/, "New custom layout feed tiles should start with the 16:9 aspect lock enabled");
assert.match(source["LiveRacing.jsx"], /function setCustomTileLockAspect/, "Custom layout feed tiles should persist aspect lock changes on the tile");
assert.match(source["LiveRacing.jsx"], /onLockAspectToggle: \(\) => setCustomTileLockAspect/, "Custom layout feed tile aspect toggles should update the saved custom tile");
assert.match(source["LiveRacing.jsx"], /addCustomTiles\(activeCustomLayout\.id, item\.sources \|\| \[item\.source\]\)/, "The custom feed picker should add multi-source intelligent items");
assert.match(source["LiveRacing.jsx"], /\{ group: "Onboards"/, "Feed picker should group driver onboards");
assert.match(source["LiveRacing.jsx"], /\{ group: "App panels"/, "Feed picker should offer app panels like the timing tower");
assert.match(source["LiveRacing.jsx"], /\{layout !== "focus" && layout !== "custom" && layout !== "theater" && renderInsightsPane\(\)\}/, "Custom and theater layouts should not render the insights strip");
assert.doesNotMatch(source["LiveRacing.jsx"], /className="custom-toolbar"/, "The space-consuming second custom toolbar row should be removed");
assert.match(source["LiveRacing.jsx"], /<span className="custom-bar">/, "Custom layout controls should live in the top bar to preserve vertical space");
assert.match(source["LiveRacing.jsx"], /className="custom-config" role="dialog"/, "Configure should open a popover with rename, copy, and delete actions");
assert.match(source["LiveRacing.jsx"], /\.custom-tile__head \{[^}]*background: #05080d/, "Custom tile header should use a solid background so the feed name and remove control stay readable");
assert.match(source["LiveRacing.jsx"], /const CUSTOM_TILE_CHROME_HIDE_MS = 5000/, "Custom tile chrome should auto-hide after five seconds without pointer movement");
assert.match(source["LiveRacing.jsx"], /const CUSTOM_TILE_CHROME_HOTZONE_PX = 42/, "Custom tile chrome should only wake from the top band of a tile");
assert.match(source["LiveRacing.jsx"], /function handleCustomTilePointerMove[\s\S]*event\.clientY - rect\.top > CUSTOM_TILE_CHROME_HOTZONE_PX\) \{[\s\S]*hideCustomTileChrome\(tileId\);[\s\S]*return;[\s\S]*\}/, "Custom tile chrome should hide when the pointer moves below the top hot zone");
assert.match(source["LiveRacing.jsx"], /setCustomChromeTileId\(tileId\)[\s\S]*setTimeout\(\(\) => setCustomChromeTileId\(\(current\) => current === tileId \? null : current\), CUSTOM_TILE_CHROME_HIDE_MS\)/, "Custom tile chrome should hide itself after the inactivity timeout");
assert.match(source["LiveRacing.jsx"], /\.custom-tile\[data-chrome="true"\] \.custom-tile__head/, "Custom tile headers should appear from explicit chrome state instead of whole-tile hover");
assert.match(source["LiveRacing.jsx"], /\.pane:hover \.pane__controls,\s*\.pane:focus-within \.pane__controls \{ opacity: 1; \}/, "Custom tile pane controls should still appear when hovering anywhere over the pane");
assert.doesNotMatch(source["LiveRacing.jsx"], /\.custom-tile \.pane:hover \.pane__controls \{ opacity: 0; \}/, "Custom tile pane controls should not be hidden by the top-band chrome behavior");
assert.doesNotMatch(source["LiveRacing.jsx"], /\.custom-tile:hover \.custom-tile__head/, "Custom tile headers should not appear from hovering anywhere in the tile");
assert.match(source["LiveRacing.jsx"], /\.live__body \.pane:not\(\.pane--bc\)\[data-lockar="true"\] \.pane__video \{ object-fit: contain/, "All non-broadcast feeds should support a 16:9 lock that letterboxes the video");
assert.match(source["LiveRacing.jsx"], /\{!channel && <span className="pane__ctl" data-active=\{telemetryOn\}/, "Non-onboard feeds should not show the telemetry toggle");
assert.match(source["LiveRacing.jsx"], /<span className="pane__ctl pane__ctl--ar" data-active=\{String\(effectiveLockAspect\)\}[\s\S]*setLocalLockAspect/, "Onboard and channel feeds should expose a 16:9 aspect lock toggle");
assert.match(mainProcess, /streamItems\.push\(\{ manifest: hint\.text, licenseUrls, label, title/, "Resolver should capture a clean channel title alongside the raw metadata label");
assert.match(source["LiveRacing.jsx"], /audioActive=\{audioFeed === key && audioVolume > 0 && p\.visible !== false\}/, "Only visible panes should emit audio so retained/parked feeds cannot double up after a layout switch");
assert.match(mainProcess, /line\?\.KnockedOut/, "F1 live timing rows should preserve knocked-out state for all knocked-out drivers");
assert.doesNotMatch(source["LiveRacing.jsx"], /\.timing-tower__row\[data-inactive="true"\] \.timing-driver__code/, "Retired timing rows should keep the driver's team color badge");
assert.match(source["LiveRacing.jsx"], /\.timing-tower \{[^}]*width: max-content;[\s\S]*\.timing-tower__head, \.timing-tower__row \{[^}]*width: max-content;/, "Live timing horizontal scroll should end at the last real column");
assert.match(source["LiveRacing.jsx"], /profile\.favoriteDrivers/, "Intelligent layout should read the user's Settings favorite driver for onboard slot 1");

assert.match(source["AppShell.jsx"], /pw-top__searchbox/, "Topbar search should be a real input");
assert.match(source["AppShell.jsx"], /document\.getElementById\(STYLE_ID\)[\s\S]*el\.textContent/, "AppShell should replace stale bundled shell styles");
assert.match(source["AppShell.jsx"], /\.pw-top__searchbox[\s\S]*appearance: none/, "Topbar search input should not use native white input styling");
assert.match(source["AppShell.jsx"], /\.pw-top__icon[\s\S]*appearance: none/, "Topbar icon buttons should not use native white button styling");
assert.match(source["AppShell.jsx"], /\.pw-top \{[^}]*position: relative;[^}]*z-index: [1-9][0-9]*;/, "Topbar search popover should sit above screen content instead of letting page text bleed through");
assert.match(source["AppShell.jsx"], /\.pw-side__brand \{[^}]*min-height: 96px;[^}]*padding: 52px var\(--space-7\) 16px;/, "Sidebar brand should sit below the macOS traffic lights and align left");
assert.match(source["AppShell.jsx"], /\.pw-app--fullscreen \.pw-side__brand \{[^}]*min-height: var\(--topbar-h\);[^}]*padding: 0 var\(--space-7\);/, "Fullscreen sidebar brand should return to the normal top-left header position");
assert.match(source["AppShell.jsx"], /window\.pitwall\?\.windowState[\s\S]*pw-app--fullscreen/, "App shell should react to native fullscreen state for sidebar spacing");
assert.match(source["AppShell.jsx"], /updates\.check\(\)[\s\S]*pw-update-pop/, "App shell should automatically show a small update prompt after the dashboard loads");
assert.match(source["AppShell.jsx"], /updates\.install[\s\S]*Install & Restart/, "App update prompt should install and restart through the Electron updates API");
assert.match(mainProcess, /pitwall:window:state[\s\S]*isFullScreen/, "Main process should expose native fullscreen state to the renderer");
assert.match(preload, /windowState:\s*\{[\s\S]*onChange:/, "Preload should expose a narrow fullscreen state listener");
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
assert.match(source["LiveRacing.jsx"], /handleSurfaceClick/, "F1 TV player surface clicks should toggle playback without using the control bar");
assert.match(source["LiveRacing.jsx"], /\.pane__replaybar \{[\s\S]*opacity: 0[\s\S]*pointer-events: none[\s\S]*\.pane--bc:hover \.pane__replaybar[\s\S]*\.pane--bc:focus-within \.pane__replaybar[\s\S]*opacity: 1[\s\S]*pointer-events: auto/, "Replay scrub controls should auto-hide and reveal only while hovering or focusing the broadcast player");
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
assert.match(source["Weekend.jsx"], /analytics\.session\(\{[\s\S]*raceName: selectedRace\.name[\s\S]*raceStartsAt: selectedRace\.startsAt[\s\S]*sessionStartsAt: selectedRecapSession\?\.startsAt/, "Weekend recap should pass schedule race identity into session analytics");
assert.match(source["Weekend.jsx"], /hasLiveTiming = Boolean\(selectedRaceSession\?\.status === "live"\)/, "Weekend should auto-open Session live only while a current session is live");
assert.match(source["Weekend.jsx"], /setMode\(requestedMode === "recap" \? "recap" : hasLiveTiming \? "live" : "recap"\)/, "Weekend should return to recap when the current session ends");
assert.match(source["Weekend.jsx"], /pitwall\.analytics\.session/, "Weekend recap should load rich OpenF1 analytics for selected sessions");
assert.doesNotMatch(source["Weekend.jsx"], /weather\.track\}deg|: "deg"/, "Weekend weather temperatures should render the degree symbol, not the text deg");
assert.match(mainProcess, /pitwall:analytics:session/, "Electron main should expose Weekend recap analytics snapshots");
assert.match(preload, /analytics:\s*\{[\s\S]*session:/, "Preload should expose Weekend recap analytics snapshots");
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
    "raceMatchText",
    "sessionHasStarted",
    "stableRandomValue",
    "pendingSessionRows",
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
const practiceRecapRows = weekendRecapSandbox.sessionResultRows({ byCode: {} }, {
  session: { name: "Practice 1", type: "Practice" },
  drivers: [
    { code: "ALB", name: "Alexander Albon", position: 1, resultDuration: 0, fastestLap: 0, laps: 0 },
    { code: "RUS", name: "George Russell", position: 2, fastestLap: 76.363, laps: 27 },
    { code: "PIA", name: "Oscar Piastri", position: 3, fastestLap: 76.566, laps: 29 },
  ],
}, []);
assert.deepEqual(Array.from(practiceRecapRows, (row) => row.code), ["RUS", "PIA", "ALB"], "Weekend practice recap should put drivers without a valid lap time below participants");
assert.deepEqual(Array.from(practiceRecapRows, (row) => row.pos), [1, 2, 3], "Weekend practice recap positions should follow the displayed lap-time order");
assert.equal(practiceRecapRows.at(-1).time, "—", "Weekend practice recap should leave non-participant lap times empty");
assert.equal(
  weekendRecapSandbox.sessionResultRows({ byCode: {} }, null, [{ code: "HAM" }], { startsAt: "2026-01-01T00:00:00Z", status: "upcoming" })[0].code,
  "HAM",
  "Weekend recap should treat a past startsAt as started even if a stale status says upcoming"
);
const pendingRecapRows = weekendRecapSandbox.sessionResultRows({
  byCode: {
    VER: { name: "Max Verstappen", num: 1, color: "#3671c6" },
    NOR: { name: "Lando Norris", num: 4, color: "#ff8000" },
    HAM: { name: "Lewis Hamilton", num: 44, color: "#27f4d2" },
  },
  drivers: [
    { code: "VER", name: "Max Verstappen", num: 1 },
    { code: "NOR", name: "Lando Norris", num: 4 },
    { code: "HAM", name: "Lewis Hamilton", num: 44 },
  ],
}, null, [
  { pos: 1, code: "VER", gap: "LEADER", last: "1:18.000", laps: 12 },
  { pos: 2, code: "NOR", gap: "+0.200", last: "1:18.200", laps: 12 },
  { pos: 3, code: "HAM", gap: "+0.400", last: "1:18.400", laps: 12 },
], { kind: "Race", status: "upcoming", startsAt: "2099-01-01T12:00:00Z" });
assert.notDeepEqual(Array.from(pendingRecapRows, (row) => row.code), ["VER", "NOR", "HAM"], "Weekend recap should randomize driver order for sessions that have not happened yet");
assert.deepEqual(Array.from(pendingRecapRows, (row) => row.time), ["—", "—", "—"], "Weekend recap should keep future-session leaderboard times empty");
assert.deepEqual(Array.from(pendingRecapRows, (row) => row.detail), ["session pending", "session pending", "session pending"], "Weekend recap should not label future-session placeholders as standings data");
const weekendStorylinesSandbox = vm.runInNewContext(`(() => {
  ${["raceMatchText", "weatherValue", "storylines"].map((name) => extractNamedFunction(source["Weekend.jsx"], name)).join("\n")}
  return { storylines };
})()`);
const recapStories = weekendStorylinesSandbox.storylines({
  byCode: { NOR: { name: "Lando Norris" } },
  news: [
    { source: "Motorsport.com", title: "Motorsport lead" },
    { source: "Formula 1", title: "Formula 1 lead" },
    { source: "Motorsport.com", title: "Second Motorsport item" },
  ],
  race: { weather: { cond: "Dry", air: 29, track: 44.9 } },
  timing: [{ code: "NOR" }],
}, {}, [{ code: "NOR" }]);
assert.deepEqual(Array.from(recapStories, (story) => story.tag), ["Motorsport.com", "Formula 1", "Weather"], "Weekend recap live sources should show two distinct ranked news sources plus weather");
assert.notEqual(recapStories.at(-1).tag, "Form", "Weekend recap live sources should not show stale timing form when no session is live");
assert.doesNotMatch(source["LiveRacing.jsx"], /window\.prompt/, "Stream setup should use an in-app control, not a browser prompt");
assert.match(source["LiveRacing.jsx"], /stream-modal/, "Live stream setup should expose an in-window modal");
const streamPersistenceSandbox = vm.runInNewContext(`(() => {
  ${["streamDescriptor", "streamRecord", "preferredMainF1TvFeed", "replayTimelineStartSeconds", "replayTargetMediaTime"].map((name) => extractNamedFunction(source["LiveRacing.jsx"], name)).join("\n")}
  return { streamRecord, preferredMainF1TvFeed, replayTimelineStartSeconds, replayTargetMediaTime };
})()`);
const onboardResolutionSandbox = vm.runInNewContext(`(() => {
  let resolvedF1TvContent = { feeds: [] };
  let timingRows = [];
  let fallbackCodes = [];
  const D = {
    byCode: {
      ALB: { code: "ALB", name: "Alexander Albon" },
      NOR: { code: "NOR", name: "Lando Norris" },
      VER: { code: "VER", name: "Max Verstappen" },
    },
    drivers: [
      { code: "ALB", name: "Alexander Albon" },
      { code: "NOR", name: "Lando Norris" },
      { code: "VER", name: "Max Verstappen" },
    ],
  };
  ${extractNamedFunction(source["LiveRacing.jsx"], "preferredMainF1TvFeed")}
  ${extractNamedFunction(source["LiveRacing.jsx"], "resolvedOnboardFeedForCode")}
  function resolve(feeds, code, rows = [], fallbacks = []) {
    resolvedF1TvContent = { feeds };
    timingRows = rows;
    fallbackCodes = fallbacks;
    return resolvedOnboardFeedForCode(code);
  }
  return { resolve };
})()`);
assert.equal(
  streamPersistenceSandbox.streamRecord("https://example.test/master.m3u8"),
  "https://example.test/master.m3u8",
  "Manual stream URLs should still persist as user settings"
);
assert.equal(
  streamPersistenceSandbox.streamRecord({ manifestUrl: "https://example.test/replay.mpd", contentId: "content-1", feedId: "WORLD", sessionKind: "Race" }),
  "",
  "Resolved F1 TV replay descriptors should reset after leaving Live Racing instead of hiding the past-session picker"
);
assert.equal(
  streamPersistenceSandbox.preferredMainF1TvFeed([
    { feedId: "WORLD", kind: "world", label: "International feed" },
    { feedId: "feed-2", kind: "feed", label: "F1 Live" },
  ]).label,
  "F1 Live",
  "Main F1 TV pane should prefer F1 Live/F1 TV commentary over the International/Sky feed"
);
assert.equal(
  streamPersistenceSandbox.replayTargetMediaTime(120, { videoStartUtc: "2026-05-22T20:00:00Z" }, { videoStartUtc: "2026-05-22T20:00:04Z" }),
  116,
  "Replay sync should translate leader media time through per-feed UTC anchors"
);
assert.equal(
  streamPersistenceSandbox.replayTargetMediaTime(120, { videoStartArchiveSeconds: 403.5 }, { videoStartArchiveSeconds: 407.5 }),
  116,
  "Replay sync should translate leader media time through per-feed archive anchors"
);
assert.equal(
  streamPersistenceSandbox.replayTargetMediaTime(3, { videoStartUtc: "2026-05-22T20:00:00Z" }, { videoStartUtc: "2026-05-22T20:00:04Z" }),
  0,
  "Replay sync should clamp target player media time before its stream starts"
);
assert.equal(
  streamPersistenceSandbox.replayTargetMediaTime(120, {}, { videoStartUtc: "2026-05-22T20:00:04Z" }),
  120,
  "Replay sync should fall back to matching media time when timeline anchors are unavailable"
);
assert.equal(
  onboardResolutionSandbox.resolve([
    { feedId: "WORLD", kind: "world", label: "F1 Live" },
    { feedId: "ALB", driverCode: "ALB", kind: "onboard", label: "ALB onboard" },
  ], "ALB")?.driverCode,
  "ALB",
  "Onboard resolver should keep exact driver-tagged F1 TV feeds available"
);
assert.equal(
  onboardResolutionSandbox.resolve([
    { feedId: "WORLD", kind: "world", label: "F1 Live" },
    { feedId: "1007", kind: "feed", title: "Lando Norris", label: "channelName:Lando Norris" },
  ], "NOR")?.feedId,
  "1007",
  "Onboard resolver should attach numbered F1 TV onboard feeds when metadata names the driver"
);
assert.equal(
  onboardResolutionSandbox.resolve([
    { feedId: "WORLD", kind: "world", label: "F1 Live" },
    { feedId: "ALB", driverCode: "ALB", kind: "onboard", label: "ALB onboard" },
    { feedId: "feed-3", kind: "feed", label: "Unlabeled onboard camera" },
  ], "VER", [{ code: "VER" }, { code: "ALB" }], ["VER", "ALB"]),
  null,
  "Onboard resolver should not relabel a different or unidentified camera as the requested driver"
);
const syncHelperSandbox = { window: {} };
vm.createContext(syncHelperSandbox);
vm.runInContext(fs.readFileSync(path.join(root, "ui_kits/pitwall/sync.js"), "utf8"), syncHelperSandbox, { filename: "ui_kits/pitwall/sync.js" });
const syncPlayer = { currentTime: 120, playbackRate: 1 };
syncHelperSandbox.window.PW_SYNC.syncReplayPlayers([{ player: syncPlayer, targetTime: 116 }], 120, { seekThreshold: 0.5, rateThreshold: 0.075 });
assert.equal(syncPlayer.currentTime, 116, "Replay sync helper should seek players to their per-feed target time instead of the leader media time");
assert.match(source["LiveRacing.jsx"], /RequestType\.LICENSE[\s\S]*request\.uris = \[licenseServer\]/, "Clean F1 TV player should force Shaka license requests to the resolved F1 TV license endpoint");
assert.match(source["LiveRacing.jsx"], /F1 TV license rejected/, "Clean F1 TV player should surface license-server rejection hints before Shaka masks them");
assert.match(source["LiveRacing.jsx"], /visibleDetail[\s\S]*!\/\^https\?:\\\/\\\//, "Clean F1 TV player errors should avoid showing raw playback URLs");
assert.match(source["LiveRacing.jsx"], /requestType,/, "Clean F1 TV player should pass Shaka request type through debug media fetches");
assert.match(source["LiveRacing.jsx"], /licensePathHint/, "Clean F1 TV player should log sanitized license endpoint hints");
assert.doesNotMatch(source["Settings.jsx"], /onChange=\{\(\) => \{\}\}/, "Settings segmented controls should not be no-ops");
assert.match(source["Settings.jsx"], /pw-settings/, "Settings should persist app preferences for Live defaults and appearance");
assert.match(source["Settings.jsx"], /VIDEO_QUALITY_OPTIONS[\s\S]*value: "max"[\s\S]*value: "high"[\s\S]*value: "medium"[\s\S]*value: "low"/, "Settings should expose Max, High, Medium, and Low video quality choices");
assert.match(source["Settings.jsx"], /videoQuality: "medium"/, "Settings should default video quality to Medium for roughly 100 Mbps connections");
assert.match(source["Settings.jsx"], /SegmentedControl[\s\S]*value=\{appPrefs\.videoQuality\}[\s\S]*VIDEO_QUALITY_OPTIONS/, "Settings should persist the selected video quality through app preferences");
assert.match(source["Settings.jsx"], /updateProfile\(\{[\s\S]*videoQuality: appPrefs\.videoQuality/, "Settings should persist video quality through the Electron profile for app reopen");
assert.match(source["Settings.jsx"], /applyThemePreference/, "Settings should apply the selected theme through one token helper");
assert.match(source["Settings.jsx"], /id: "updates"/, "Settings should expose update status");
assert.match(source["Settings.jsx"], /window\.pitwall\?\.updates/, "Settings should use the Electron update IPC API");
assert.match(source["Settings.jsx"], /installUpdateAndRestart/, "Settings update action should install and restart rather than only opening the update zip");
assert.match(source["Settings.jsx"], /Install & Restart/, "Settings update button should set the right expectation for update behavior");
assert.match(source["Settings.jsx"], /pitwall\.f1tv\.login/, "Settings should use the Electron F1 TV login flow");
assert.match(source["Settings.jsx"], /f1-login/, "Settings should provide a MultiViewer-style F1 TV login panel");
assert.doesNotMatch(source["Settings.jsx"], /f1-login__divider|Sign in using embedded browser|Sign in using Google Chrome|Refresh F1 TV session/, "Settings should not render the F1 TV alternatives block");
assert.match(source["Settings.jsx"], /MultiViewer uses its own app profile/, "Settings should make clear that MultiViewer's F1 TV login does not carry into PitWall");
assert.match(source["Settings.jsx"], /Browser signed in/, "Settings should show browser-only F1 TV login as connected-but-not-playback-ready");
assert.match(source["Settings.jsx"], /credentialError/, "Settings should surface non-secret F1 TV credential-token errors instead of hiding them behind browser fallback state");
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
assert.match(source["DataProvider.jsx"], /profileImageUrl/, "Renderer profile should persist a user profile picture URL");
assert.match(source["Settings.jsx"], /profile-image-input/, "Settings should let users choose a profile picture image file");
assert.match(source["Settings.jsx"], /Clear photo/, "Settings should let users remove their profile picture");
assert.match(source["AppShell.jsx"], /profile\.profileImageUrl/, "App shell should render the saved profile picture in the sidebar");
assert.match(source["DataProvider.jsx"], /text\.length > 3 \* 1024 \* 1024/, "Renderer profile normalization should preserve 2 MB profile photos after base64 encoding");
assert.match(mainProcess, /text\.length > 3 \* 1024 \* 1024/, "Electron profile normalization should preserve 2 MB profile photos after base64 encoding");
assert.match(mainProcess, /profileImageUrl/, "Electron profile persistence should keep the user profile picture URL");
assert.match(source["News.jsx"], /readerStory/, "News should keep story reading inside the app");
assert.match(source["News.jsx"], /news-reader/, "News should render a comfortable in-app article reader");
assert.match(source["News.jsx"], /\.news-reader\s*\{[^}]*place-items:\s*center[^}]*padding:\s*var\(--space-9\)/, "News reader should center the article panel in a full-screen backdrop");
assert.match(source["News.jsx"], /\.news-reader__panel\s*\{[^}]*width:\s*min\(920px,\s*100%\)[^}]*max-height:\s*min\(860px,\s*calc\(100vh - 48px\)\)/, "News reader should cap the article panel to a comfortable reading size");
assert.match(source["News.jsx"], /readerImages[\s\S]*news-reader__gallery/, "News reader should render additional article images inside the app");
assert.match(source["News.jsx"], /setReaderStory\(lead\)/, "Lead story CTA should open the in-app reader");
assert.doesNotMatch(source["News.jsx"], /onClick=\{\(\) => openExternal\(lead\.url\)\}/, "Lead story CTA should not open the browser directly");
assert.match(source["News.jsx"], /lead\.image/, "Lead news story should render its article image when available");
assert.match(source["News.jsx"], /n\.image/, "News list items should render article thumbnails when available");
assert.match(source["News.jsx"], /onError=\{\(event\)/, "News images should gracefully fall back when a remote image fails");
assert.match(source["News.jsx"], /let el = document\.getElementById\(STYLE_ID\)[\s\S]*el\.textContent/, "News should replace stale bundled styles before rendering");
assert.doesNotMatch(source["News.jsx"], /lead__body\s*\{[^}]*margin-top\s*:/, "Lead news text should sit in a separate panel below the image");
assert.match(source["Schedule.jsx"], /selectedRace\.sessions/, "Schedule should render sessions from live calendar data");
assert.match(source["Schedule.jsx"], /openWeekendRecap[\s\S]*weekendRound[\s\S]*weekendMode", "recap"[\s\S]*onNavigate\("weekend"\)/, "Schedule should open clicked weekends in the Weekend recap screen");
assert.match(source["Weekend.jsx"], /requestedMode[\s\S]*weekendMode[\s\S]*setMode\(requestedMode === "recap" \? "recap" : hasLiveTiming \? "live" : "recap"\)/, "Weekend should honor direct recap launches from Schedule");
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
assert.match(source["Analytics.jsx"], /Lap pace trace/, "Analytics should render lap-by-lap pace comparison");
assert.match(source["Analytics.jsx"], /Consistency score/, "Analytics should render driver consistency comparison");
assert.match(source["Analytics.jsx"], /Tyre age curve/, "Analytics should render tyre-age pace curves");
assert.match(source["Analytics.jsx"], /Teammate delta/, "Analytics should render teammate delta mode");
assert.match(source["Analytics.jsx"], /Racecraft/, "Analytics should render racecraft comparison");
assert.match(source["Analytics.jsx"], /Session verdict/, "Analytics should render a local transparent verdict");
assert.match(source["Analytics.jsx"], /Weather context/, "Analytics should render weather context from OpenF1");
assert.match(source["Analytics.jsx"], /an__entity-grid/, "Analytics should render selectable driver/team entities");
assert.match(source["Analytics.jsx"], /let el = document\.getElementById\(STYLE_ID\)[\s\S]*if \(!el\)[\s\S]*el\.textContent/, "Analytics should replace stale bundled styles");
assert.match(source["Analytics.jsx"], /value === null \|\| value === undefined \|\| value === ""[\s\S]*return null/, "Analytics should render missing lap metrics as unavailable, not zero");
assert.match(source["Analytics.jsx"], /DIN Condensed|Avenir Next Condensed/, "Analytics should keep non-generic local racing font fallbacks");
assert.match(source["Leaderboards.jsx"], /seasonSummary/, "Leaderboards should use live season summary metadata");
assert.match(source["LiveRacing.jsx"], /Diagnostics browser/, "Live mode should keep F1 TV website browsing available for diagnostics");
assert.match(source["LiveRacing.jsx"], /F1 TV session picker/, "Live mode should include a session picker for past races and sessions");
assert.match(source["LiveRacing.jsx"], /No current live session/, "Live mode should clearly state when there is no current live session");
assert.doesNotMatch(source["LiveRacing.jsx"], /const hasActiveLiveStream = replaySync\.mode === "live"/, "Live Racing top bar should not treat default live mode as a current live session");
assert.match(source["LiveRacing.jsx"], /const sessionStatusLabel = hasCurrentLiveSession[\s\S]*:\s*"";/, "Live Racing top bar should omit the no-current-live-session status text");
assert.doesNotMatch(source["LiveRacing.jsx"], /const sessionStatusLabel = hasCurrentLiveSession[\s\S]{0,220}dataSource[\s\S]{0,80}:\s*"";/, "Live Racing top bar should not show live data source labels or source issues");
assert.match(source["LiveRacing.jsx"], /\.live__bar \{[^}]*grid-template-columns: minmax\(0, 1fr\) auto minmax\(0, 1fr\)[\s\S]*\.live__presets \{[^}]*justify-self: center/, "Live Racing title bar should center the layout preset picker");
assert.match(source["LiveRacing.jsx"], /Load past session/, "Live mode should expose a visible past-session action outside hidden pane settings");
assert.match(source["LiveRacing.jsx"], /Session Library/, "Live mode should open a dedicated session library popup for past sessions");
assert.match(source["LiveRacing.jsx"], /sessionLibrary=\{renderSessionLibrary\(\{ inline: true \}\)\}/, "Live mode should replace the empty World Feed pane with the session library");
assert.match(source["LiveRacing.jsx"], /liveWorkspaceReady[\s\S]*\?[\s\S]*<div className="live__body"/, "Live mode should hide timing, feeds, and onboards until a selected session resolves");
assert.match(source["LiveRacing.jsx"], /className="live__preload"[\s\S]*renderSessionLibrary\(\{ inline: true \}\)/, "Live mode should show the session library as the pre-load body");
assert.match(source["LiveRacing.jsx"], /Race weekends/, "Session library should list race weekends in a left rail");
assert.match(source["LiveRacing.jsx"], /session-library__row/, "Session library should render selectable session rows");
assert.match(source["LiveRacing.jsx"], /f1TvResolving && active \? "Loading\.\.\."/, "Session library should label active replay loads as loading");
assert.match(source["LiveRacing.jsx"], /currentF1TvWeekendIndex[\s\S]*slice\(0, currentF1TvWeekendIndex \+ 1\)/, "Session library should show past races through the current weekend, not future weekends");
assert.match(source["LiveRacing.jsx"], /activeRaceName[\s\S]*selectedF1TvRace\?\.name[\s\S]*replaySetupActive|replaySetupActive[\s\S]*activeRaceName[\s\S]*selectedF1TvRace\?\.name/, "Live Racing top bar should use the selected replay race name while a replay is active");
const f1TvSessionGateSandbox = vm.runInNewContext(`(() => {
  const F1TV_SESSION_STATUS_GRACE_MS = 1000 * 60 * 5;
  const F1TV_WEEKEND_STATUS_GRACE_MS = 1000 * 60 * 30;
  ${extractNamedFunction(source["LiveRacing.jsx"], "isCancelledF12026RaceName")}
  ${extractNamedFunction(source["LiveRacing.jsx"], "f1TvTimeMs")}
  ${extractNamedFunction(source["LiveRacing.jsx"], "estimatedF1TvSessionEndMs")}
  ${extractNamedFunction(source["LiveRacing.jsx"], "normalizeF1TvSessionStatus")}
  ${extractNamedFunction(source["LiveRacing.jsx"], "normalizeF1TvRaceStatus")}
  ${extractNamedFunction(source["LiveRacing.jsx"], "normalizeF1TvSessionKind")}
  ${extractNamedFunction(source["LiveRacing.jsx"], "normalizeRaceLibrary")}
  ${extractNamedFunction(source["LiveRacing.jsx"], "orderedF1TvSessions")}
  ${extractNamedFunction(source["LiveRacing.jsx"], "canLoadF1TvSession")}
  return { canLoadF1TvSession, normalizeF1TvSessionKind, normalizeRaceLibrary, orderedF1TvSessions };
})()`);
assert.equal(f1TvSessionGateSandbox.normalizeF1TvSessionKind("Sprint Shootout"), "Sprint Qualifying", "Session library should present Sprint Shootout aliases as Sprint Qualifying");
const staleFp1Library = f1TvSessionGateSandbox.normalizeRaceLibrary({
  season: "2026",
  races: [{
    rnd: 7,
    name: "Barcelona Grand Prix",
    status: "live",
    startsAt: "2026-06-14T13:00:00Z",
    sessions: [
      { kind: "Practice 1", status: "live", startsAt: "2026-06-12T11:30:00Z", endsAt: "2026-06-12T12:30:00Z" },
      { kind: "Practice 2", status: "upcoming", startsAt: "2026-06-12T15:00:00Z", endsAt: "2026-06-12T16:00:00Z" },
      { kind: "Practice 3", status: "upcoming", startsAt: "2026-06-13T10:30:00Z", endsAt: "2026-06-13T11:30:00Z" },
      { kind: "Qualifying", status: "upcoming", startsAt: "2026-06-13T14:00:00Z", endsAt: "2026-06-13T15:00:00Z" },
      { kind: "Race", status: "upcoming", startsAt: "2026-06-14T13:00:00Z", endsAt: "2026-06-14T15:00:00Z" },
    ],
  }],
}, "2026", Date.parse("2026-06-12T15:30:00Z"));
assert.deepEqual(
  staleFp1Library.races[0].sessions.map((session) => [session.kind, session.status]),
  [["Practice 1", "done"], ["Practice 2", "live"], ["Practice 3", "upcoming"], ["Qualifying", "upcoming"], ["Race", "upcoming"]],
  "Session library should rederive stale cached live/upcoming statuses from session times"
);
assert.equal(staleFp1Library.races[0].status, "live", "Session library should keep the weekend live while a later session is live");
const betweenSessionsLibrary = f1TvSessionGateSandbox.normalizeRaceLibrary({
  season: "2026",
  races: [{
    rnd: 7,
    name: "Barcelona Grand Prix",
    status: "live",
    sessions: [
      { kind: "Practice 1", status: "live", startsAt: "2026-06-12T11:30:00Z", endsAt: "2026-06-12T12:30:00Z" },
      { kind: "Practice 2", status: "upcoming", startsAt: "2026-06-12T15:00:00Z", endsAt: "2026-06-12T16:00:00Z" },
      { kind: "Practice 3", status: "upcoming", startsAt: "2026-06-13T10:30:00Z", endsAt: "2026-06-13T11:30:00Z" },
      { kind: "Qualifying", status: "upcoming", startsAt: "2026-06-13T14:00:00Z", endsAt: "2026-06-13T15:00:00Z" },
      { kind: "Race", status: "upcoming", startsAt: "2026-06-14T13:00:00Z", endsAt: "2026-06-14T15:00:00Z" },
    ],
  }],
}, "2026", Date.parse("2026-06-12T13:00:00Z"));
assert.equal(betweenSessionsLibrary.races[0].status, "upcoming", "Session library should not mark a race weekend live between sessions");
const endedFp2Library = f1TvSessionGateSandbox.normalizeRaceLibrary({
  season: "2026",
  races: [{
    rnd: 7,
    name: "Barcelona Grand Prix",
    status: "live",
    sessions: [
      { kind: "Practice 2", status: "live", startsAt: "2026-06-12T15:00:00Z", endsAt: "2026-06-12T16:00:00Z" },
    ],
  }],
}, "2026", Date.parse("2026-06-12T16:01:00Z"));
assert.equal(endedFp2Library.races[0].sessions[0].status, "done", "Session library should stop showing FP2 live after the official end time");
const endedFp2LegacyLibrary = f1TvSessionGateSandbox.normalizeRaceLibrary({
  season: "2026",
  races: [{
    rnd: 7,
    name: "Barcelona Grand Prix",
    status: "live",
    sessions: [
      { kind: "Practice 2", status: "live", startsAt: "2026-06-12T15:00:00Z" },
    ],
  }],
}, "2026", Date.parse("2026-06-12T16:01:00Z"));
assert.equal(endedFp2LegacyLibrary.races[0].sessions[0].status, "done", "Session library should not trust legacy cached live status forever when a practice start time is known");
const cmsLiveFp2Library = f1TvSessionGateSandbox.normalizeRaceLibrary({
  season: "2026",
  races: [{
    rnd: 7,
    name: "Barcelona Grand Prix",
    status: "done",
    sessions: [
      { kind: "Practice 2", status: "live", statusSource: "f1tv-cms", contentSubtype: "LIVE", startsAt: "2026-06-12T15:00:00Z", endsAt: "2026-06-12T16:00:00Z" },
    ],
  }],
}, "2026", Date.parse("2026-06-12T16:01:00Z"));
assert.equal(cmsLiveFp2Library.races[0].sessions[0].status, "live", "Session library should preserve F1 TV CMS live status after the scheduled end time");
assert.equal(cmsLiveFp2Library.races[0].status, "live", "Session library should show the weekend live while F1 TV CMS says a session is still live");
const cmsReplayFp2Library = f1TvSessionGateSandbox.normalizeRaceLibrary({
  season: "2026",
  races: [{
    rnd: 7,
    name: "Barcelona Grand Prix",
    status: "live",
    sessions: [
      { kind: "Practice 2", status: "live", statusSource: "f1tv-cms", contentSubtype: "REPLAY", startsAt: "2026-06-12T15:00:00Z", endsAt: "2026-06-12T16:00:00Z" },
    ],
  }],
}, "2026", Date.parse("2026-06-12T15:30:00Z"));
assert.equal(cmsReplayFp2Library.races[0].sessions[0].status, "done", "Session library should preserve F1 TV CMS replay status even during a stale scheduled-live window");
assert.deepEqual(
  JSON.parse(JSON.stringify(f1TvSessionGateSandbox.orderedF1TvSessions([
    { kind: "Practice 1", status: "done" },
    { kind: "Sprint Shootout", status: "done" },
    { kind: "Sprint", status: "done" },
    { kind: "Qualifying", status: "done" },
    { kind: "Race", status: "done" },
  ]).map((session) => session.kind))),
  ["Practice 1", "Sprint Qualifying", "Sprint", "Qualifying", "Race"],
  "Session library should show Sprint Qualifying in the expected sprint-weekend order"
);
assert.equal(f1TvSessionGateSandbox.canLoadF1TvSession(
  { name: "Barcelona Grand Prix", status: "upcoming", startsAt: "2099-06-14T13:00:00Z" },
  { kind: "Race", status: "unknown" },
), false, "Session library should not load placeholder replays for future weekends");
assert.equal(f1TvSessionGateSandbox.canLoadF1TvSession(
  { name: "Barcelona Grand Prix", status: "upcoming" },
  { kind: "Qualifying", status: "upcoming", startsAt: "2099-06-13T14:00:00Z" },
), false, "Session library should not load future dated sessions");
assert.equal(f1TvSessionGateSandbox.canLoadF1TvSession(
  { name: "Monaco Grand Prix", status: "done" },
  { kind: "Qualifying", status: "done", startsAt: "2026-06-06T14:00:00Z" },
), true, "Session library should still load completed sessions");
assert.match(source["LiveRacing.jsx"], /\.session-library__race-meta[\s\S]*font-family: var\(--font-mono\)/, "Session library race dates should use the compact racing font");
assert.doesNotMatch(source["LiveRacing.jsx"], /session-library[\s\S]{0,2600}fastest/i, "Session library should not show fastest driver or time metadata");
assert.match(source["LiveRacing.jsx"], /loadSelectedF1TvReplay/, "Live mode should load the selected F1 TV replay into the main world-feed pane");
assert.match(source["LiveRacing.jsx"], /hasCurrentLiveSession/, "Live mode should compute live-vs-replay state instead of always showing LIVE");
assert.match(source["LiveRacing.jsx"], /Practice 1/, "Live mode should expose practice replay choices");
assert.match(source["LiveRacing.jsx"], /\.live__grid\[data-layout="focus"\] \.pane--bc \.pane__video \{[\s\S]*object-position: center bottom/, "Intelligent world feed video should bottom-align above the replay progress bar");
assert.match(source["LiveRacing.jsx"], /Qualifying/, "Live mode should expose qualifying replay choices");
assert.match(source["LiveRacing.jsx"], /Race/, "Live mode should expose race replay choices");
assert.match(source["LiveRacing.jsx"], /pitwall\.f1tv\.browseSession/, "Live mode should open the selected F1 TV session");
assert.match(source["LiveRacing.jsx"], /pitwall\.f1tv\.library/, "Live mode should load F1 TV library data");
assert.match(source["LiveRacing.jsx"], /pitwall\.f1tv\.library\(\{ season, forceRefresh/, "Live Racing should pass forceRefresh through to the F1 TV library loader");
assert.match(source["LiveRacing.jsx"], /loadF1TvLibrary\(f1TvSeason, \{ forceRefresh: true \}\)/, "Reload library should bypass cached F1 TV weekends");
assert.match(source["LiveRacing.jsx"], /pitwall\.f1tv\.resolveContent/, "Live mode should resolve F1 TV content into clean stream descriptors");
assert.match(source["LiveRacing.jsx"], /resolveContent\(\{[\s\S]*sessionStatus: session\.status/, "Live mode should pass selected F1 TV session status into clean stream resolution");
assert.match(source["LiveRacing.jsx"], /pitwall\.f1tv\.probeStatus/, "Live mode should preflight F1 TV auth before waiting on hidden stream resolution");
assert.match(source["LiveRacing.jsx"], /Checking F1 TV session/, "Live mode should tell the user while it checks F1 TV auth");
assert.match(source["LiveRacing.jsx"], /Diagnostic F1 TV captures/, "Live mode should expose captured F1 TV stream diagnostics without making it the normal loading path");
assert.match(source["LiveRacing.jsx"], /pitwall\.f1tv\.streams/, "Live mode should load captured F1 TV streams");
assert.match(source["LiveRacing.jsx"], /PitWallStreamPlayer/, "Live mode should render clean PitWall stream player panes");
assert.match(source["LiveRacing.jsx"], /data-ready=\{String\(ready\)\}/, "Stream video should expose readiness so new onboards can fade in instead of flashing black");
assert.match(source["LiveRacing.jsx"], /onPlaybackState/, "Stream player should report playback readiness to the pane shell");
assert.match(source["LiveRacing.jsx"], /data-stream-ready/, "Onboard panes should keep a poster layer visible until the new stream is ready");
assert.match(source["LiveRacing.jsx"], /pane__streamveil/, "Onboard panes should render a visual warmup veil while intelligent switches load");
assert.match(source["LiveRacing.jsx"], /\.pane__video \{[^}]*transition-property: opacity, transform, filter/, "Stream video should fade and settle into place with specific composited transitions");
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
assert.match(source["LiveRacing.jsx"], /Object\.entries\(playerRefs\.current\)/, "Replay player sync should retain player keys so each feed can use its own timeline anchor");
assert.match(source["LiveRacing.jsx"], /readLivePanelSizes/, "Live mode should restore draggable panel sizes");
assert.match(source["LiveRacing.jsx"], /startPanelResize/, "Live mode should resize race-viewer panels by pointer dragging");
assert.doesNotMatch(source["LiveRacing.jsx"], /function saveLayout|label="Save layout"/, "Live Racing should not expose the removed save-layout plus control");
assert.match(source["LiveRacing.jsx"], /setPanelSizes\(normalizeLivePanelSizes\(saved\.panelSizes\)\)/, "Restoring a Live layout should restore the saved video panel sizing");
assert.match(source["LiveRacing.jsx"], /pane__driverselect/, "Onboard panes should expose an in-pane driver switcher");
assert.match(source["LiveRacing.jsx"], /retainedPanes/, "Live mode should retain mounted player panes when switching views");
assert.doesNotMatch(source["LiveRacing.jsx"], /key \+ "-" \+ i/, "Live mode should not key player panes by layout index");
assert.match(source["LiveRacing.jsx"], /live__body"\s+data-layout=\{layout\}/, "Driver Focus should be able to place live timing on the right");
assert.match(source["LiveRacing.jsx"], /live__insights--popup/, "Driver Focus should move AI insights and engineer chat into a popup");
assert.match(source["LiveRacing.jsx"], /gridArea: "world"/, "Driver Focus should place the main race feed below the onboard row");
assert.match(source["LiveRacing.jsx"], /<select[\s\S]*className="preset-select"[\s\S]*value=\{preset\}/, "Live Racing presets should collapse into a compact header dropdown");
assert.doesNotMatch(source["LiveRacing.jsx"], /label="Save layout"[\s\S]*<Icon name="plus"/, "Live Racing preset dropdown should not show a plus save-layout button");
assert.doesNotMatch(source["LiveRacing.jsx"], /D\.presets\.map\(\(p\) => \(\s*<button key=\{p\} className="preset"/, "Live Racing header should not render every preset as a button row");
assert.doesNotMatch(source["LiveRacing.jsx"], /<video[^>]*\bcontrols\b/, "Clean F1 TV panes should not show native browser video controls");
assert.doesNotMatch(source["LiveRacing.jsx"], /descriptor\?\.manifestType === "dash" \? "F1 TV" : "LIVE"/, "Loaded clean streams should not render LIVE/F1 TV watermark text over video");
assert.match(source["LiveRacing.jsx"], /\.pane--bc \.pane__video \{[^}]*bottom: var\(--ticker-total-h, 46px\)[^}]*height: calc\(100% - var\(--ticker-total-h, 46px\)\)/, "Broadcast video should end at the measured ticker boundary while replay controls auto-hide over the player");
assert.match(source["LiveRacing.jsx"], /replayTimingData/, "Replay mode should keep timing data derived from the video clock");
assert.match(source["LiveRacing.jsx"], /pitwall\.data\.replayTiming/, "Replay mode should request OpenF1 timing snapshots for the current replay time");
assert.match(source["LiveRacing.jsx"], /replayTimingOffset/, "Replay timing should support a video-to-timing clock offset");
assert.match(source["LiveRacing.jsx"], /DEFAULT_REPLAY_TIMING_OFFSET = -8/, "Replay timing should default to the observed F1 TV broadcast delay");
assert.match(source["LiveRacing.jsx"], /timingElapsedSeconds/, "Replay timing should apply the offset before requesting timing rows");
assert.match(source["LiveRacing.jsx"], /replayTargetMediaTime/, "Replay timing should sync player media times through the shared session timeline");
assert.match(source["LiveRacing.jsx"], /sessionClock/, "Live timing should render the official F1 session clock for sync diagnostics");
assert.match(source["LiveRacing.jsx"], /smoothSessionClockLabel/, "Live timing should locally interpolate the session countdown between timing snapshots");
assert.match(source["LiveRacing.jsx"], /sessionClockDisplayLabel/, "Live timing should format race and qualifying clocks for the timing header");
assert.match(source["LiveRacing.jsx"], /sessionFlagFromClock/, "Live timing should derive the visible flag from official session status");
assert.match(source["LiveRacing.jsx"], /D\.race\?\.lap\s*\?\s*"Race"/, "Live race laps should force race timing context instead of stale F1 TV qualifying selection");
assert.match(source["LiveRacing.jsx"], /const timingLap = telemetryNumber\(sessionClock\?\.lapCount\?\.lap\)[\s\S]*const timingLapLabel = timingLap[\s\S]*Lap \$\{timingLap\}\/\$\{timingLaps \|\| "—"\}/, "Live timing header should compute a Lap X/Y label from active timing data during races and replays");
assert.match(source["LiveRacing.jsx"], /const showQualifyingElimination = isQualifyingSessionKind\(activeSessionKind\)/, "Live timing should only enable red elimination rows for qualifying sessions");
{
  const timingAsideStart = source["LiveRacing.jsx"].indexOf('function renderTimingTower');
  const timingHeaderEnd = source["LiveRacing.jsx"].indexOf('{timingConfigOpen && <TimingColumnMenu', timingAsideStart);
  const timingHeaderSource = source["LiveRacing.jsx"].slice(timingAsideStart, timingHeaderEnd);
  const timingTopEnd = source["LiveRacing.jsx"].indexOf('<div className="live__timingscroll">', timingAsideStart);
  const timingTopSource = source["LiveRacing.jsx"].slice(timingAsideStart, timingTopEnd);
  assert.match(timingHeaderSource, /<FlagStatus status=\{timingFlag\.status\} label=\{timingFlag\.label\} \/>/, "Live timing header should show the current official flag");
  assert.match(timingHeaderSource, /\{timingLapLabel && <span className="live__timinglap">\{timingLapLabel\}<\/span>\}\s*\{sessionClockLabel && <span className="live__timingclock"/, "Live timing header should show Lap X/Y to the left of the session clock");
  assert.doesNotMatch(timingHeaderSource, /<h3>Live Timing<\/h3>/, "Live timing header should not render a text title");
  assert.doesNotMatch(timingTopSource, /className="live__statusbar"/, "Live timing should not render a second status row");
  assert.doesNotMatch(timingTopSource, /timingSourceLabel|timingRows\.length\} timing rows/, "Live timing should not show source or row-count status text");
}
assert.match(source["LiveRacing.jsx"], /RaceControlMessages/, "Live timing should render official race-control messages when available");
assert.doesNotMatch(source["LiveRacing.jsx"], /<\/div>\s*<RaceControlMessages messages=\{activeRaceControlMessages\} \/>\s*<div className="live__weather">/, "Race-control messages should stay inside the timing scroll content instead of a fixed bottom panel");
assert.match(source["LiveRacing.jsx"], /\.live__timingscroll::\-webkit-scrollbar/, "Live timing should hide native WebKit scrollbars");
assert.match(source["LiveRacing.jsx"], /\.live__timingscroll \{[^}]*scrollbar-width: none/, "Live timing should hide native Firefox scrollbars");
assert.doesNotMatch(source["LiveRacing.jsx"], /\.race-control \{[^}]*max-height/, "Race-control messages should not use a fixed always-visible bottom panel height");
assert.doesNotMatch(source["LiveRacing.jsx"], /\.race-control \{[^}]*min-width:\s*640px/, "Race-control messages should not force the timing table's wide horizontal layout");
assert.match(source["LiveRacing.jsx"], /\.race-control__text \{[^}]*overflow-wrap: anywhere/, "Race-control message text should wrap instead of requiring horizontal scrolling");
assert.doesNotMatch(source["LiveRacing.jsx"], /\.race-control__text \{[^}]*-webkit-line-clamp/, "Race-control message text should not be clipped when wrapping");
assert.doesNotMatch(source["LiveRacing.jsx"], /FlagStatus status=\{hasCurrentLiveSession \? "green" : "yellow"\} label=\{hasCurrentLiveSession \? "Clear" : "Replay"\}/, "Live timing sidebar should not hide official yellow or red flag status behind live/replay state");
assert.doesNotMatch(source["LiveRacing.jsx"], /Remaining \{sessionClockLabel\}/, "Live timing clock should not render a Remaining prefix in the status bar");
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
assert.match(source["LiveRacing.jsx"], /hasRealTimingRows\(current\?\.timing\)/, "Replay timing should retain the last populated real timing rows instead of blanking the tower on an empty refresh");
{
  const hasRealTimingRows = vm.runInNewContext(`(() => {
    ${extractNamedFunction(liveRacingSource, "hasTimingValue")}
    ${extractNamedFunction(liveRacingSource, "hasRealTimingRows")}
    return hasRealTimingRows;
  })()`);
  assert.equal(hasRealTimingRows([]), false, "Empty timing payloads should be treated as still loading");
  assert.equal(hasRealTimingRows([{ code: "", pos: "", last: "", best: "", gap: "", interval: "" }]), false, "Placeholder timing rows should be treated as still loading");
  assert.equal(hasRealTimingRows([{ code: "VER", pos: 1 }]), true, "Positioned driver rows should count as real timing data");
}
{
  const formatTimingAge = vm.runInNewContext(`(${extractNamedFunction(liveRacingSource, "formatTimingAge")})`);
  assert.equal(formatTimingAge(0), 0, "Fresh replay tyres should render age 0 instead of looking unloaded");
  assert.equal(formatTimingAge(""), "—", "Missing replay tyre age should still render as unavailable");
}
assert.match(source["LiveRacing.jsx"], /const timingLoading = [\s\S]*!timingHasRealRows/, "Live timing should expose a loading state until real timing rows arrive");
assert.match(source["LiveRacing.jsx"], /<TimingTowerStatus[\s\S]*"Loading timing"/, "Live timing sidebar should render a loading screen instead of a blank timing tower");
assert.match(source["LiveRacing.jsx"], /live__timinghd--loading[\s\S]*live__timingloadingtitle[\s\S]*Live Timing[\s\S]*:\s*<>\s*<span className="live__timingtitle"/, "Live timing loading header should show only a centered Live Timing label");
assert.match(source["LiveRacing.jsx"], /const LIVE_TIMING_POLL_INTERVAL_MS = 270/, "Live onboard telemetry should refresh at the 3.7 Hz live timing cadence");
assert.match(source["LiveRacing.jsx"], /const REPLAY_TIMING_POLL_INTERVAL_MS = 100/, "Replay timing should poll the cached archive at the measured source-limited cadence");
assert.match(source["LiveRacing.jsx"], /setInterval\(loadReplayTiming, REPLAY_TIMING_POLL_INTERVAL_MS\)/, "Replay timing should refresh quickly from the local F1 timing cache");
assert.match(source["LiveRacing.jsx"], /replayTimingInFlightRef[\s\S]*if \(replayTimingInFlightRef\.current\) return;[\s\S]*replayTimingInFlightRef\.current = true[\s\S]*replayTimingInFlightRef\.current = false/, "Replay timing should not let quick polls invalidate the initial slow archive fetch");
assert.match(source["LiveRacing.jsx"], /Math\.floor\(timingElapsedSeconds \* 10\)/, "Replay timing should use tenth-second buckets so fast telemetry samples are not discarded");
assert.match(source["LiveRacing.jsx"], /function replayMasterReading\(\)[\s\S]*let video = playerRefs\.current\[masterKey\];[\s\S]*Object\.entries\(playerRefs\.current\)\[0\]/, "Replay clock should read the master video time but fall back to any mounted feed when the world feed is not placed");
assert.match(source["LiveRacing.jsx"], /replayTargetMediaTime\(raw, feed, worldFeed\)/, "The fallback master time should be converted to the world feed timeline so timing alignment stays anchored");
assert.match(source["LiveRacing.jsx"], /const elapsedSeconds = Math\.max\(0, replayMasterReading\(\)\.worldElapsed\)/, "Replay timing should derive its elapsed clock from the resilient master reading");
assert.match(source["LiveRacing.jsx"], /\.pane:not\(\.pane--bc\) \.pane__replaybar \{/, "Onboard panes should position the replay scrubber along their bottom edge");
assert.match(source["LiveRacing.jsx"], /\.pane\[data-replay="true"\]:not\(\.pane--bc\) \.pane__controls \{/, "Onboard controls should lift above the scrubber while in replay mode");
assert.equal(liveCustomLayoutSandbox.channelDisplayName({ kind: "world" }), "F1 TV", "The world channel should display as F1 TV, never as World");
assert.equal(liveCustomLayoutSandbox.channelDisplayName({ label: "streamType:SDR_HD", feedId: "WORLD" }), "F1 TV", "The world feed should display as F1 TV regardless of its raw label");
assert.equal(liveCustomLayoutSandbox.channelDisplayName({ title: "INTERNATIONAL" }), "International", "The international feed should display as International, not F1 TV");
assert.equal(liveCustomLayoutSandbox.channelDisplayName({ feedId: "1003" }), "Driver Tracker", "Channel 1003 should map to the Driver Tracker feed");
assert.equal(liveCustomLayoutSandbox.channelDisplayName({ feedId: "1004" }), "Data Channel", "Channel 1004 should map to the Data Channel feed");
assert.equal(liveCustomLayoutSandbox.channelDisplayName({ feedId: "1025" }), "International", "Channel 1025 should map to the International feed");
assert.match(source["LiveRacing.jsx"], /\{!channel && \(\s*<span className="pane__tag">/, "Channel feeds should hide the driver identity tag (avatar/position/code)");
assert.match(source["LiveRacing.jsx"], /\.pane__ctl--ar\[data-active="true"\] \{ background: var\(--surface-hover\)/, "The active 16:9 lock button should keep readable text instead of accent-on-accent");
assert.match(source["LiveRacing.jsx"], /function CustomFeedTicker/, "Custom layouts should have an isolated, configurable driver-rows ticker separate from the Intelligent broadcast ticker");
assert.match(source["LiveRacing.jsx"], /hideBuiltinTicker = false/, "BroadcastPane should keep its built-in ticker by default so the Intelligent layout is unchanged");
assert.match(source["LiveRacing.jsx"], /\{!hideBuiltinTicker && \(/, "BroadcastPane built-in ticker should be suppressible for custom feed tiles");
assert.match(source["LiveRacing.jsx"], /onToggleFeedTicker && <span className="pane__ctl" data-active=\{String\(Boolean\(feedTickerOn\)\)\}/, "Feed panes should show a driver-tiles toggle next to the aspect lock");
assert.match(source["LiveRacing.jsx"], /tickerRows: clampCustomTickerRows\(tile\.tickerRows\), tickerHeight: clampCustomTickerHeight\(tile\.tickerHeight\)/, "Custom tiles should persist ticker rows and height");
assert.match(source["LiveRacing.jsx"], /function setCustomTileTicker/, "Custom layouts should support updating a tile's ticker config");
assert.match(source["LiveRacing.jsx"], /\.custom-feedticker__grid \.tick \{ height: 100%/, "Custom ticker cells should fill their row height so the tile has no empty space");
assert.match(source["LiveRacing.jsx"], /if \(!streamDescriptor\(feed\)\) score -= 100/, "The main F1 TV feed selection should never pick an unplayable feed");
assert.match(source["LiveRacing.jsx"], /<div className="custom-tile__feed">\{feedPane\}<\/div>\s*\{tickerOn &&/, "The feed pane should stay mounted when the ticker toggles so 16:9 and playback persist");
assert.equal(liveCustomLayoutSandbox.clampCustomTickerRows(9), 4, "Ticker rows should clamp to a maximum of 4");
assert.equal(liveCustomLayoutSandbox.clampCustomTickerRows(undefined), 0, "Ticker rows should default to 0 (off)");
assert.equal(liveCustomLayoutSandbox.clampCustomTickerHeight(9999), 320, "Ticker height should clamp to its maximum");
assert.equal(liveCustomLayoutSandbox.clampCustomTickerHeight(undefined), 140, "Ticker height should default to 140px");
assert.equal(liveCustomLayoutSandbox.channelDisplayName({ label: "channel_id:1033 uuid:abc options:[]" }), "Channel 1033", "Raw channel metadata should reduce to a clean channel number");
assert.equal(liveCustomLayoutSandbox.channelDisplayName({ label: "Pit Lane SDR" }), "Pit Lane", "Pit lane channels should display with a clean name");
assert.equal(liveCustomLayoutSandbox.channelDisplayName({ title: "DRIVER TRACKER" }), "Driver Tracker", "A resolver-provided tracker title should display as Driver Tracker");
assert.equal(liveCustomLayoutSandbox.channelDisplayName({ title: "DATA" }), "Data Channel", "A resolver-provided data title should display as Data Channel");
assert.equal(liveCustomLayoutSandbox.channelDisplayName({ title: "streamType:SDR_HD channelId:9971", feedId: "9971" }), "Channel 9971", "Raw metadata titles should never leak through; fall back to a clean channel number");
assert.match(source["LiveRacing.jsx"], /label: channelDisplayName\(feed\)/, "The custom feed picker should label channels with their clean display name");
assert.match(source["LiveRacing.jsx"], /replayPlayingRef\.current/, "Replay players should use the latest paused state when async stream loading finishes");
assert.match(source["LiveRacing.jsx"], /replaySync\.playing === false[\s\S]*video\.pause\(\)/, "Replay sync should keep every player paused instead of correcting paused panes into loops");
assert.match(source["LiveRacing.jsx"], /Replay timing unavailable/, "Replay timing errors should surface as a clear short status");
assert.match(source["LiveRacing.jsx"], /diagnostics: data\?\.diagnostics/, "Replay timing logs should include sanitized data-source row counts");
assert.match(source["LiveRacing.jsx"], /liveTimingData/, "Live mode should keep fast timing data separate from the dashboard snapshot");
assert.match(source["LiveRacing.jsx"], /pitwall\.data\.liveTiming\(\{[\s\S]*source: "f1"/, "Live mode should request Formula 1 SignalR timing snapshots while racing");
assert.match(source["LiveRacing.jsx"], /targetLatencySeconds: syncTargetFor\("WORLD"\)/, "Live timing should request rows delayed to the World Feed target latency");
assert.match(source["LiveRacing.jsx"], /setInterval\(loadLiveTiming, LIVE_TIMING_POLL_INTERVAL_MS\)/, "Live timing should refresh quickly for broadcast sync");
assert.match(source["LiveRacing.jsx"], /liveTimingRequestRef/, "Live timing polling should ignore stale overlapping responses");
assert.match(source["LiveRacing.jsx"], /liveTimingInFlightRef/, "Live timing polling should not start overlapping snapshot requests");
assert.match(source["Weekend.jsx"], /liveTimingRequestIdRef[\s\S]*liveTimingInFlightRef\.current === requestId/, "Weekend live timing polling should ignore stale overlapping responses");
assert.match(source["LiveRacing.jsx"], /setLiveTimingData\(data \|\| null\)/, "Live timing should surface Formula 1 unavailable responses instead of preserving stale rows");
assert.doesNotMatch(source["LiveRacing.jsx"], /replaySync\.mode === "replay"[\s\S]*\? \(replayRows\.length \? replayRows : D\.timing\)[\s\S]*: \(liveRows\.length \? liveRows : D\.timing\)/, "Live Racing should not show stale dashboard timing rows when the selected live/replay timing source has no rows");
assert.match(source["LiveRacing.jsx"], /pendingF1TvSelection/, "Choosing an F1 TV replay should pause unrelated live timing until playback resolves");
assert.match(source["LiveRacing.jsx"], /if \(!resolvedF1TvContent\?\.contentId && !resolvedF1TvContent\?\.feeds\?\.length\) return undefined;/, "Replay timing should wait for the selected F1 TV session to resolve before polling timing");
assert.match(source["LiveRacing.jsx"], /const CLOCK_TICK_INTERVAL_MS = 250/, "Session countdown should redraw smoothly between network timing snapshots");
assert.match(source["LiveRacing.jsx"], /useTimingRowMotion/, "Live timing rows should use FLIP-style motion for smooth leaderboard changes");
assert.match(source["LiveRacing.jsx"], /data-moving="true"/, "Live timing rows should expose a moving state while reordering");
assert.match(source["LiveRacing.jsx"], /\.timing-driver \{[^}]*display: grid;[^}]*grid-template-columns: 22px minmax\(42px, auto\);[^}]*column-gap: 6px;/, "Live timing driver positions should have a modest lane instead of drifting too far left or sticking to the driver code");
assert.match(source["LiveRacing.jsx"], /TIMING_COLUMN_STORAGE_KEY/, "Live timing should persist the user's selected timing columns");
assert.match(source["LiveRacing.jsx"], /TimingColumnMenu/, "Live timing should expose a configurable column menu");
assert.match(source["LiveRacing.jsx"], /<Icon name="pencil" size=\{14\} \/>/, "Live timing column editor should use a compact pencil trigger");
assert.match(source["LiveRacing.jsx"], /\.timing-config \{[\s\S]*right: var\(--space-6\)[\s\S]*width: min\(360px, calc\(100vw - 28px\)\)/, "Live timing column menu should be a narrow right-aligned popover");
assert.match(source["LiveRacing.jsx"], /\.timing-tower \{[^}]*width: max-content;[^}]*min-width: 100%;/, "Live timing tower should be horizontally compact enough to reveal more columns");
assert.match(source["LiveRacing.jsx"], /\.timing-tower__head, \.timing-tower__row \{[\s\S]*column-gap: var\(--space-3\)[\s\S]*padding: 0 var\(--space-2\)/, "Live timing columns should use compact spacing with minimal left inset");
assert.match(source["LiveRacing.jsx"], /\{ id: "last", label: "Last lap", width: "78px" \}/, "Live timing last-lap column should leave room for the fastest-lap pill");
assert.match(source["LiveRacing.jsx"], /\{ id: "speed", label: "Speed", width: "48px" \}/, "Live timing column menu should expose speed telemetry");
assert.match(source["LiveRacing.jsx"], /\{ id: "gear", label: "Gear", width: "34px" \}/, "Live timing column menu should expose gear telemetry");
assert.match(source["LiveRacing.jsx"], /\{ id: "throttle", label: "Thr", width: "42px" \}/, "Live timing column menu should expose throttle telemetry");
assert.match(source["LiveRacing.jsx"], /\{ id: "brake", label: "Brk", width: "38px" \}/, "Live timing column menu should expose brake telemetry");
assert.match(source["LiveRacing.jsx"], /\{ id: "stints", label: "Stints", width: "48px" \}/, "Live timing column menu should expose stint counts");
assert.match(source["LiveRacing.jsx"], /\{ id: "s1Time", label: "S1 time", width: "54px" \}/, "Live timing column menu should expose sector 1 time");
assert.match(source["LiveRacing.jsx"], /\{ id: "s2Time", label: "S2 time", width: "54px" \}/, "Live timing column menu should expose sector 2 time");
assert.match(source["LiveRacing.jsx"], /\{ id: "s3Time", label: "S3 time", width: "54px" \}/, "Live timing column menu should expose sector 3 time");
assert.match(source["LiveRacing.jsx"], /s1Time: <span className="timing-cell">\{formatSectorTime\(row\.sectorTimes\?\.s1\)\}<\/span>/, "Live timing rows should render sector 1 numeric time when selected");
assert.match(source["LiveRacing.jsx"], /function timingSectorCounts\(rows = \[\]\)[\s\S]*TIMING_SECTOR_COLUMNS\.reduce[\s\S]*miniSectorVisibleCount\(row\.sectors\?\.\[id\]\)/, "Live timing should size sector columns from the visible mini-sector counts in each sector");
assert.match(source["LiveRacing.jsx"], /if \(TIMING_SECTOR_COLUMNS\.includes\(id\)\) return miniSectorColumnWidth\(sectorCounts\[id\]\)/, "Live timing grid columns should adapt S1/S2/S3 widths independently");
assert.match(source["LiveRacing.jsx"], /\.mini-sector \{[\s\S]*width: fit-content[\s\S]*overflow: hidden/, "Mini-sector groups should shrink to their rendered ticks so short sectors do not reserve blank width");
assert.match(source["LiveRacing.jsx"], /\.mini-sector__seg \{ width: 3px; height: 15px;/, "Mini-sector segments should be small enough for narrow timing columns");
assert.match(source["LiveRacing.jsx"], /DEFAULT_TIMING_COLUMNS = \["driver", "last", "best", "gap", "interval", "s1", "s2", "s3", "tyre", "age"\]/, "Live timing should show interval by default after compacting columns");
assert.match(source["LiveRacing.jsx"], /MiniSectorBar/, "Live timing should render mini-sector columns");
assert.match(source["LiveRacing.jsx"], /TimingTowerRow/, "Live timing should use a compact timing row instead of the name-heavy design-system row");
assert.doesNotMatch(source["LiveRacing.jsx"], /<TimingRowHeader \/>[\s\S]*<TimingRow/, "Live timing rows should not render full driver names from the old TimingRow component");
assert.match(source["LiveRacing.jsx"], /resolvedOnboardFeedForCode/, "Onboard panes should resolve F1 TV onboard feeds through driver-tagged descriptors");
assert.match(source["LiveRacing.jsx"], /\.pane \{[\s\S]*container-type: inline-size/, "Onboard panes should expose container size for adaptive telemetry scaling");
assert.match(source["LiveRacing.jsx"], /\.pane:not\(\.pane--bc\) \.pane__top \{[\s\S]*position: absolute[\s\S]*top: 0/, "Onboard top chrome should overlay the feed instead of reserving empty top space");
assert.match(source["LiveRacing.jsx"], /\.live__grid\[data-layout="focus"\] \.pane:not\(\.pane--bc\) \.pane__video \{[\s\S]*object-fit: contain[\s\S]*object-position: center bottom/, "Driver Focus onboard video should shift down so any letterbox fit space sits up under the top stats bar, not as a black band below the image");
assert.match(source["LiveRacing.jsx"], /\.pane:not\(\.pane--bc\) \.pane__mid \{[\s\S]*position: absolute[\s\S]*inset: 0/, "Onboard poster surface should be full-bleed behind the stats strip");
assert.match(source["LiveRacing.jsx"], /\.pane:not\(\.pane--bc\) \.pane__driverselect[\s\S]*opacity: 0[\s\S]*\.pane:not\(\.pane--bc\):hover \.pane__driverselect[\s\S]*opacity: 1/, "Onboard driver selector should only appear while hovering an onboard pane");
assert.match(source["LiveRacing.jsx"], /\.pane:not\(\.pane--bc\) \.pane__feedlabel[\s\S]*opacity: 0[\s\S]*\.pane:not\(\.pane--bc\):hover \.pane__feedlabel[\s\S]*opacity: 1/, "Onboard feed label should only appear while hovering an onboard pane");
assert.match(source["LiveRacing.jsx"], /telemetryForCode/, "Onboard panes should derive telemetry from the active timing rows");
assert.match(source["LiveRacing.jsx"], /telemetry=\{\(p\.telemetry \|\| p\.feed === "Onboard"\) && telemetryDefault\}/, "Onboard panes should show speed telemetry by default");
assert.match(source["LiveRacing.jsx"], /className="pane__pos">\{formatPosition\(telemetryData\.pos\)\}/, "Onboard driver tag should always show the driver's timing position");
assert.match(source["LiveRacing.jsx"], /className="pane__obar"[\s\S]*className="obE"[\s\S]*className="obE__bar"/, "Onboard telemetry should render the Variant E multiviewer bar");
assert.match(source["LiveRacing.jsx"], /obE__id[\s\S]*obE__pos[\s\S]*telemetryData\.pos[\s\S]*obE__code[\s\S]*\{code\}/, "Multiviewer bar should lead with the driver's position plate and code");
assert.match(source["LiveRacing.jsx"], /obE__gearChar[\s\S]*formatGear\(telemetryData\.gear\)[\s\S]*obE__speed[\s\S]*formatSpeed\(telemetryData\.speed\)/, "Multiviewer bar should show gear and speed telemetry");
assert.match(source["LiveRacing.jsx"], /obE__stack[\s\S]*>Last<[\s\S]*telemetryData\.last[\s\S]*>Best<[\s\S]*telemetryData\.best/, "Multiviewer bar should stack last and best lap times");
assert.match(source["LiveRacing.jsx"], /obE__stack[\s\S]*>Int<[\s\S]*telemetryData\.interval[\s\S]*>Ldr<[\s\S]*telemetryData\.leaderGap/, "Multiviewer bar should stack interval and leader-gap values");
assert.match(source["LiveRacing.jsx"], /const sectorSlots = timingSectorCounts\(timingRows\)/, "Onboard mini-sector slot count should be derived dynamically from the live timing rows, since the number of mini-sectors varies by track");
assert.match(source["LiveRacing.jsx"], /obE__mini[\s\S]*\["s1", "s2", "s3"\][\s\S]*Array\.from\(\{ length: sectorSlots\[key\][\s\S]*className="obE__seg"[\s\S]*telemetryData\.sectors\?\.\[key\]/, "Multiviewer bar should render a full, per-track set of mini-sector slots that stay present and fill in place as tones arrive (not appear one by one)");
assert.match(source["LiveRacing.jsx"], /obE__secRow[\s\S]*formatSectorTime\(telemetryData\.sectorTimes\?\.\[key\]\)[\s\S]*obE__secRow obE__secRow--best[\s\S]*formatSectorTime\(telemetryData\.bestSectorTimes\?\.\[key\]\)/, "Multiviewer bar should show two centered sector-time rows below the mini-sector groups: current lap then best lap");
assert.match(source["LiveRacing.jsx"], /obE__tyre[\s\S]*tyreRing\(telemetryData\.comp\)[\s\S]*tyreLetter\(telemetryData\.comp\)[\s\S]*telemetryData\.age/, "Multiviewer bar should show the tyre compound letter and age");
assert.match(source["LiveRacing.jsx"], /obE__pedals[\s\S]*telemetryPct\(telemetryData\.throttle\)[\s\S]*telemetryPct\(telemetryData\.brake\)/, "Multiviewer bar should render the throttle and brake ribbon along the bottom edge");
assert.match(source["LiveRacing.jsx"], /sectors: row\.sectors[\s\S]*sectorTimes: row\.sectorTimes[\s\S]*bestSectorTimes: resolveBestSectorTimes\(code, row\.bestSectorTimes\)[\s\S]*comp: row\.comp[\s\S]*age: row\.age/, "Onboard telemetry data should include mini-sector tones, current and best split times, and tyre compound and age");
assert.match(source["LiveRacing.jsx"], /\.obE \{ --u: min\([\d.]+cqw, [\d.]+px\); \}/, "Multiviewer bar should derive every dimension from one container-query unit (a fraction of 1cqw) capped at a fixed size so wide values never overflow the tyre off the edge");
assert.match(mainProcess, /bestSectorTimes: \{\s*s1: f1TimingSectorTime\(line\?\.BestSectors\?\.\["0"\]\)/, "Best-lap sector times should come from the live F1 timing source (line.BestSectors), not OpenF1");
assert.match(source["LiveRacing.jsx"], /function noteBestSectors\(rows, sessionKey\)[\s\S]*bestSectorAccum\.byCode[\s\S]*function resolveBestSectorTimes\(code, feedBest\)/, "Best sector splits should also be accumulated client-side from the live sectorTimes stream so they show even when a source omits BestSectors");
assert.match(source["LiveRacing.jsx"], /noteBestSectors\(timingRows, /, "Onboard render should feed the active timing rows into the best-sector accumulator");
assert.match(mainProcess, /if \(number === 2064\) return "blue"/, "Pit/out-lap mini-sector segments (status 2064) should map to blue from the live timing source");
assert.match(source["LiveRacing.jsx"], /\.obE__seg\[data-tone="blue"\]/, "Multiviewer bar should render blue (out-lap) mini-sector segments");
assert.match(source["LiveRacing.jsx"], /\.mini-sector__seg\[data-tone="blue"\]/, "Timing tower mini-sectors should also render blue out-lap segments");
assert.match(source["LiveRacing.jsx"], /function MiniSectorBar\(\{ segments = \[\], compact = false, slots \}\)[\s\S]*Array\.from\(\{ length: count \}[\s\S]*data-tone=\{segments\[index\] \|\| "off"\}/, "Timing tower mini-sectors should render a fixed set of slots that fill in place as tones arrive, not appear one by one");
assert.match(source["LiveRacing.jsx"], /<MiniSectorBar segments=\{row\.sectors\?\.s1\} slots=\{sectorCounts\.s1\}/, "Timing tower rows should pass the per-sector slot count so empty mini-sectors are shown until they fill");
assert.match(source["LiveRacing.jsx"], /\.obE__bar \{[\s\S]*width: 100%/, "Multiviewer bar should be a full-bleed strip that scales down with a narrowing onboard");
assert.match(source["LiveRacing.jsx"], /\.obE__spacer \{ flex: 1 1 auto/, "Past the cap the flexible spacer should absorb slack, opening empty space between the timing block and the sectors");
assert.match(source["LiveRacing.jsx"], /\.pane:not\(\.pane--bc\) \.pane__obar \{[\s\S]*position: absolute[\s\S]*top: 0[\s\S]*pointer-events: none/, "Multiviewer bar should hug the onboard's top edge as a non-interactive overlay");
assert.match(source["LiveRacing.jsx"], /\.pane\[data-telemetry="true"\]:not\(\.pane--bc\) \.pane__tag \{ display: none; \}/, "When telemetry is on the redundant driver tag should hide since the bar already shows identity");
assert.match(source["LiveRacing.jsx"], /data-telemetry=\{String\(telemetryOn\)\}/, "Onboard pane should expose its telemetry state for adaptive chrome");
assert.match(source["LiveRacing.jsx"], /\.obE__lv\[data-tone="fastest"\] \{ color: var\(--t-fastest\)/, "Multiviewer bar lap values should tone purple on a session-fastest time");
assert.match(source["LiveRacing.jsx"], /row\.telemetry\?\.speed/, "Onboard telemetry should render real speed data from OpenF1 car data");
assert.match(source["LiveRacing.jsx"], /row\.telemetry\?\.gear/, "Onboard telemetry should render real gear data from OpenF1 car data");
assert.match(source["LiveRacing.jsx"], /row\.telemetry\?\.throttle/, "Onboard telemetry should render real throttle data from OpenF1 car data");
assert.doesNotMatch(source["LiveRacing.jsx"], /tele__drs|<span className="tele__l">DRS<\/span>|OPEN/, "Onboard telemetry should not show fake DRS state");
assert.doesNotMatch(source["LiveRacing.jsx"], /<span className="tele__v">318<\/span>|<span className="tele__v">7<\/span>|<span className="tele__v">94%<\/span>|bar\(94|bar\(8/, "Onboard telemetry should not use hardcoded stat placeholders");
assert.match(mainProcess, /pitwall:data:replayTiming/, "Electron main should expose replay-timed OpenF1 snapshots");
assert.match(mainProcess, /pitwall:data:liveTiming/, "Electron main should expose fast live OpenF1 timing snapshots");
assert.match(mainProcess, /getLiveTimingSnapshot/, "Electron main should fetch live timing without waiting for the full app snapshot cache");
assert.match(mainProcess, /F1_TIMING_BASE_URL = "https:\/\/livetiming\.formula1\.com"/, "Live timing should use Formula 1's official livetiming source directly");
assert.match(source["Weekend.jsx"], /pitwall\.data\.liveTiming\(\{[\s\S]*source: "f1"/, "Weekend live timing should reuse the Formula 1 live timing IPC used by Live Racing");
assert.doesNotMatch(source["Weekend.jsx"], /weekendLiveTiming/, "Weekend should not poll the removed OpenF1-only weekend timing IPC");
assert.doesNotMatch(preload, /weekendLiveTiming/, "Preload should not expose the removed OpenF1-only weekend timing IPC");
assert.doesNotMatch(mainProcess, /pitwall:data:weekendLiveTiming|getWeekendLiveTimingSnapshot|refreshWeekendLiveTimingSnapshot/, "Electron main should not keep the removed OpenF1-only weekend timing IPC");
assert.match(mainProcess, /function resolveF1TimingArchiveBase/, "Replay timing should resolve Formula 1 archived timing paths from the selected meeting/session");
assert.match(mainProcess, /function parseF1TimingJsonStream/, "Replay timing should parse Formula 1 jsonStream timing feeds");
assert.match(mainProcess, /function decodeF1TimingZPayload/, "Replay timing should decode Formula 1 compressed .z telemetry feeds");
assert.match(mainProcess, /function parseF1TimingArchiveRows/, "Replay timing should normalize Formula 1 timing rows into PitWall timing rows");
assert.match(mainProcess, /ExtrapolatedClock\.jsonStream/, "Replay timing should fetch the official F1 session clock stream");
assert.match(mainProcess, /TrackStatus\.jsonStream/, "Replay timing should fetch the official F1 track flag stream");
assert.match(mainProcess, /RaceControlMessages\.jsonStream/, "Replay timing should fetch the official F1 race-control stream");
assert.match(mainProcess, /function parseF1TimingSessionClock/, "F1 timing parser should normalize the official session clock");
assert.match(mainProcess, /function f1TimingSessionStartSeconds/, "Replay timing should retain the FastF1-style session Started marker for clock diagnostics");
assert.match(mainProcess, /function getReplayTimingAvailability/, "Replay timing should expose a lightweight availability probe before a replay is loaded");
assert.match(mainProcess, /pitwall:data:replayTimingAvailability/, "Electron main should expose replay timing availability IPC");
assert.match(preload, /replayTimingAvailability: \(options = \{\}\)/, "Preload should expose replay timing availability to the renderer");
assert.match(source["LiveRacing.jsx"], /pitwall\.data\.replayTimingAvailability/, "Session library should ask whether replay timing is available before loading a replay");
assert.match(source["LiveRacing.jsx"], /replay-timing-badge/, "Session library should render a compact replay timing availability indicator");
{
  const availabilitySandbox = vm.runInNewContext(`(() => {
    ${extractNamedFunction(mainProcess, "finiteNumber")}
    ${extractNamedFunction(mainProcess, "f1TimingSessionHasStartMarker")}
    ${extractNamedFunction(mainProcess, "f1TimingReplayAvailabilityFromSessionData")}
    return { f1TimingReplayAvailabilityFromSessionData };
  })()`);
  assert.deepEqual(
    JSON.parse(JSON.stringify(availabilitySandbox.f1TimingReplayAvailabilityFromSessionData({
      baseUrl: "https://livetiming.formula1.com/static/2026/session/",
      timingEntries: [{ seconds: 1, data: {} }],
      sessionStatusEntries: [{ seconds: 12, data: { Status: "Started" } }],
    }))),
    {
      ok: true,
      status: "ready",
      available: true,
      synced: true,
      label: "Timing ready",
      message: "Synced replay live timing is available.",
    },
    "Replay timing availability should report synced timing when the official archive has timing rows and a session start marker"
  );
  assert.equal(
    availabilitySandbox.f1TimingReplayAvailabilityFromSessionData({
      baseUrl: "https://livetiming.formula1.com/static/2026/session/",
      timingEntries: [{ seconds: 1, data: {} }],
      sessionStatusEntries: [],
    }).status,
    "manual-sync",
    "Replay timing availability should distinguish archives that exist but may need manual sync"
  );
  assert.equal(
    availabilitySandbox.f1TimingReplayAvailabilityFromSessionData({
      baseUrl: "https://livetiming.formula1.com/static/2026/session/",
      timingEntries: [],
      sessionStatusEntries: [],
    }).status,
    "generating",
    "Replay timing availability should mark an archive shell without timing rows as generating"
  );
}
assert.match(mainProcess, /function f1TvManifestProgramDateTime/, "F1 TV resolver should extract program-date-time from clean stream manifests");
const f1TvManifestStatusSandbox = vm.runInNewContext(`(() => {
  ${extractNamedFunction(mainProcess, "f1TvManifestStreamStatus")}
  return { f1TvManifestStreamStatus };
})()`);
assert.equal(
  f1TvManifestStatusSandbox.f1TvManifestStreamStatus('<MPD type="dynamic" availabilityStartTime="2026-06-12T11:30:00Z"></MPD>', { manifestType: "dash" }),
  "live",
  "F1 TV resolver should treat dynamic DASH manifests as live streams"
);
assert.equal(
  f1TvManifestStatusSandbox.f1TvManifestStreamStatus('<MPD type="static"></MPD>', { manifestType: "dash" }),
  "replay",
  "F1 TV resolver should treat static DASH manifests as replay streams"
);
assert.equal(
  f1TvManifestStatusSandbox.f1TvManifestStreamStatus('#EXTM3U\n#EXT-X-TARGETDURATION:6\n#EXTINF:6,\nseg.ts', { manifestType: "hls" }),
  "live",
  "F1 TV resolver should treat HLS playlists without ENDLIST as live streams"
);
assert.equal(
  f1TvManifestStatusSandbox.f1TvManifestStreamStatus('#EXTM3U\n#EXT-X-PLAYLIST-TYPE:VOD\n#EXT-X-ENDLIST', { manifestType: "hls" }),
  "replay",
  "F1 TV resolver should treat ended HLS playlists as replay streams"
);
assert.match(mainProcess, /streamStatus/, "F1 TV resolver should return sanitized stream live-vs-replay status");
assert.match(source["LiveRacing.jsx"], /streamStatus[\s\S]*playbackMode/, "Live Racing should use resolved stream status when choosing live or replay playback");
assert.match(mainProcess, /Promise\.all\(feeds\.map\(async \(feed\)/, "F1 TV resolver should inspect manifest timing for every resolved feed");
assert.match(mainProcess, /videoStartUtc/, "Resolved F1 TV feeds should carry a sanitized video start UTC for replay timing sync");
assert.match(mainProcess, /Math\.floor\(elapsedSeconds \* 10\)/, "Formula 1 replay timing cache should keep tenth-second snapshots");
assert.match(source["LiveRacing.jsx"], /videoStartUtc/, "Live Racing should pass the resolved video start UTC into replay timing requests");
assert.match(mainProcess, /parseF1TimingArchiveRows\(sessionData, elapsedSeconds, \{[\s\S]*videoStartUtc: options\.videoStartUtc[\s\S]*videoStartArchiveSeconds: options\.videoStartArchiveSeconds/, "Replay timing should forward the resolved F1 TV video start into the Formula 1 timing parser");
assert.match(mainProcess, /`f1:\$\{meetingKey\}:\$\{normalizeOpenF1SessionKind\(sessionKind\)\}:\$\{Math\.floor\(elapsedSeconds \* 10\)\}:\$\{videoStartKey\}`/, "Formula 1 replay timing cache should keep tenth-second buckets for smooth onboard telemetry");
assert.match(source["LiveRacing.jsx"], /replayTimingRequestRef[\s\S]*requestId[\s\S]*requestId !== replayTimingRequestRef\.current[\s\S]*setReplayTimingData/, "Replay timing should ignore stale async responses so older lap snapshots cannot overwrite newer replay timing");
assert.match(source["LiveRacing.jsx"], /REPLAY_TIMING_REQUEST_TIMEOUT_MS[\s\S]*Promise\.race\(\[[\s\S]*window\.pitwall\.data\.replayTiming[\s\S]*setTimeout/, "Replay timing should time out hung IPC requests so polling cannot get stuck forever");
assert.match(mainProcess, /timingAnchor: "program"/, "F1 TV replay timing should default to the replay program timeline, not session-start elapsed time");
assert.doesNotMatch(mainProcess, /parseF1TimingArchiveRows\(sessionData, elapsedSeconds, \{ alignToSessionStart: true \}\)/, "F1 TV replay timing should not add the session start offset to video.currentTime");
assert.match(mainProcess, /getReplayF1TimingSessionData/, "Replay timing should prefer Formula 1 livetiming archives before OpenF1 fallbacks");
assert.match(mainProcess, /getF1LiveTimingSnapshot/, "Live timing should attempt Formula 1 SignalR timing before OpenF1 fallbacks");
assert.match(source["LiveRacing.jsx"], /pitwall\.data\.liveTiming\(\{[\s\S]*source: "f1"/, "Live Racing live mode should request Formula 1 SignalR timing only instead of falling back to OpenF1");
assert.match(mainProcess, /targetLatencySeconds/, "Formula 1 live timing snapshots should accept a target latency for video alignment");
assert.match(mainProcess, /Date\.now\(\) \/ 1000 - targetLatencySeconds/, "Formula 1 live timing should render buffered rows at the video target latency");
assert.match(mainProcess, /signalrcore/, "Live timing should connect to Formula 1's SignalR Core live timing stream");
assert.match(mainProcess, /trackStatusEntries: entriesByTopic\.TrackStatus/, "Live timing should pass official track flags into snapshots");
assert.match(mainProcess, /raceControlEntries: entriesByTopic\.RaceControlMessages/, "Live timing should pass official race-control messages into snapshots");
assert.match(mainProcess, /function ensureF1TimingLiveClient[\s\S]*getF1TvPlaybackToken\(\)[\s\S]*access_token/, "Formula 1 SignalR live timing should pass the resolved F1 TV playback token as an access token without logging it");
assert.match(mainProcess, /function f1TimingSignalRCookieFromHeaders[\s\S]*AWSALBCORS/, "Formula 1 SignalR live timing should extract FastF1's AWSALBCORS cookie");
assert.match(mainProcess, /function requestF1TimingSignalRCookie[\s\S]*method:\s*"OPTIONS"/, "Formula 1 SignalR live timing should preflight negotiate with OPTIONS before opening the socket");
assert.match(mainProcess, /requestF1TimingJsonPost\(F1_TIMING_NEGOTIATE_URL,\s*10000,\s*signalRCookie \? \{ Cookie: signalRCookie \} : \{\}\)/, "Formula 1 SignalR live timing should carry the AWSALBCORS cookie into negotiate");
assert.match(mainProcess, /function createF1TimingWebSocket[\s\S]*Sec-WebSocket-Key[\s\S]*Object\.entries\(headers/, "Formula 1 SignalR live timing should use a WebSocket handshake that can include custom headers");
assert.match(mainProcess, /wsHeaders\.Cookie = signalRCookie/, "Formula 1 SignalR live timing should carry the AWSALBCORS cookie into the WebSocket handshake");
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
for (const [name, rendererSource] of Object.entries(source)) {
  assert.doesNotMatch(rendererSource, /Loaded leader/, `${name} should not render a loaded-leader driver block`);
}
assert.match(source["Weekend.jsx"], /battleA\.image/, "Weekend battle-watch first avatar should use the real driver image when available");
assert.match(source["Weekend.jsx"], /battleB\.image/, "Weekend battle-watch second avatar should use the real driver image when available");
assert.match(source["LiveRacing.jsx"], /pitwall\.f1tv\.drmStatus/, "Live mode should check DRM readiness before protected playback");
assert.match(source["LiveRacing.jsx"], /MultiViewer login is separate/, "Live mode should explain why PitWall may need a fresh F1 TV login");
assert.match(source["LiveRacing.jsx"], /pw-sync-settings/, "Live mode should persist stream sync target latencies");
assert.match(source["LiveRacing.jsx"], /targetLatency/, "Live mode should expose target latency for stream syncing");
assert.match(source["LiveRacing.jsx"], /liveLatency/, "Live mode should measure live latency for stream syncing");
assert.match(source["LiveRacing.jsx"], /playbackRate/, "Live mode should expose playback rate in the sync debug overlay");
assert.match(source["Settings.jsx"], /f1LiveLatency/, "Settings should persist the F1 Live/WORLD sync latency preference");
assert.match(source["Settings.jsx"], /F1 Live sync latency/, "Settings should expose the F1 Live/WORLD sync latency control");
assert.match(source["LiveRacing.jsx"], /profile\.videoQuality/, "Live mode should restore video quality from the persisted Electron profile on app open");
assert.match(source["LiveRacing.jsx"], /syncSettings\.worldTarget/, "Live mode should use the configured F1 Live/WORLD latency as the sync baseline");
assert.match(source["LiveRacing.jsx"], /adjustDependentSyncTargets/, "Live mode should shift dependent feed latency targets when the F1 Live baseline changes");
assert.match(source["LiveRacing.jsx"], /maxLiveSyncPlaybackRate: 1\.2/, "Native HLS playback should use a 20% catch-up rate like MultiViewer");
assert.match(source["LiveRacing.jsx"], /playbackRate = 0\.8/, "Native HLS playback should slow by 20% when ahead of target latency");
assert.match(source["LiveRacing.jsx"], /ArrowDown|ArrowUp/, "Live mode should support keyboard latency tuning");
assert.match(source["LiveRacing.jsx"], /Sync overlay/, "Live mode should provide an in-pane stream sync debug overlay");
assert.match(source["LiveRacing.jsx"], /battlePair/, "Live mode should use deterministic battle pair data");
assert.match(source["LiveRacing.jsx"], /function buildActiveAiSnapshot/, "Live Racing AI chat should build a mode-aware snapshot from the active session");
assert.match(source["LiveRacing.jsx"], /activeTimingRows\(\)/, "Live Racing AI chat should use the currently displayed live or replay timing rows");
assert.match(source["LiveRacing.jsx"], /activeInsights\.map/, "Live Racing insights should render the active session insights instead of stale global snapshot insights");
assert.doesNotMatch(source["LiveRacing.jsx"], /D\.insights\.map/, "Live Racing insights should not render stale dashboard snapshot insights during replays");
assert.match(source["LiveRacing.jsx"], /const AI_INSIGHT_INTERVAL_MS = 2 \* 60 \* 1000/, "Live Racing AI insights should request a fresh generated insight every two minutes");
assert.match(source["LiveRacing.jsx"], /setInterval\(requestAutoAiInsight, AI_INSIGHT_INTERVAL_MS\)/, "Live Racing AI insights should use the shared two-minute cadence");
assert.match(source["LiveRacing.jsx"], /Do not use future replay knowledge/, "Live Racing AI insight prompts should forbid future knowledge during replays");
assert.match(source["LiveRacing.jsx"], /scopedAutoAiInsights[\s\S]*replayElapsedSeconds[\s\S]*<= replayInsightElapsed/, "Live Racing should hide generated replay insights from later replay timestamps after scrubbing backward");
const liveAiSandbox = vm.runInNewContext(`(() => {
  ${[
    "telemetryNumber",
    "timingGapSeconds",
    "buildActiveBattlePairs",
    "buildActiveInsights",
    "buildActiveStrategyContext",
    "buildActiveAiSnapshot",
    "compactAiInsightSnapshot",
    "mergeAiInsightHistory",
    "normalizeAutoAiInsight",
  ].map((name) => extractNamedFunction(source["LiveRacing.jsx"], name)).join("\n")}
  return { buildActiveBattlePairs, buildActiveInsights, buildActiveStrategyContext, buildActiveAiSnapshot, compactAiInsightSnapshot, mergeAiInsightHistory, normalizeAutoAiInsight };
})()`);
const activeRows = [
  { pos: 1, code: "LEC", gap: "LEADER", interval: "—", comp: "soft", age: 8, pits: 1, stints: [{ compound: "soft", laps: 8 }], last: "1:16.200", best: "1:15.900" },
  { pos: 2, code: "HAM", gap: "+0.420", interval: "+0.420", comp: "medium", age: 10, pits: 0, stints: [{ compound: "medium", laps: 10 }], last: "1:16.310", best: "1:16.000" },
  { pos: 3, code: "NOR", gap: "+7.400", interval: "+6.980", comp: "hard", age: 22, pits: 0, stints: [{ compound: "hard", laps: 22 }], last: "1:17.000", best: "1:16.400" },
];
const activePairs = liveAiSandbox.buildActiveBattlePairs(activeRows);
assert.deepEqual(activePairs[0].a, "LEC", "Active battle pairs should start from the current timing leader");
assert.deepEqual(activePairs[0].b, "HAM", "Active battle pairs should pair the closest current timing rows");
const activeInsights = liveAiSandbox.buildActiveInsights({
  timingRows: activeRows,
  sourceLabel: "F1 timing synced",
  mode: "replay",
  weather: { cond: "Dry" },
  sessionClock: { remaining: "00:04:00" },
});
assert.equal(activeInsights[0].kind, "battle", "Active insights should include current battle detection");
assert.match(activeInsights[0].body, /LEC and HAM/, "Active insights should describe the current timing battle");
assert.match(activeInsights.map((item) => item.kind).join(","), /strategy/, "Active insights should include tyre strategy when timing rows carry tyre data");
const activeSnapshot = liveAiSandbox.buildActiveAiSnapshot({
  mode: "replay",
  timingRows: activeRows,
  baseData: { race: { name: "Monaco Grand Prix" }, drivers: [], standings: [], constructors: [], sessions: [], news: [], strategyContext: { stale: true } },
  sourceLabel: "F1 timing synced",
  weather: { cond: "Dry" },
  sessionClock: { remaining: "00:04:00" },
  replay: { elapsedSeconds: 861, timingOffsetSeconds: -8, sessionKind: "Qualifying", raceName: "Monaco Grand Prix" },
});
assert.equal(activeSnapshot.mode, "replay", "Live Racing AI snapshot should include replay/live mode");
assert.equal(activeSnapshot.timing[0].code, "LEC", "Live Racing AI snapshot should use active timing rows");
assert.equal(activeSnapshot.strategyContext.tyreStrategy.drivers[0].currentCompound, "soft", "Live Racing AI snapshot should rebuild strategy context from active timing rows");
assert.equal(activeSnapshot.replay.elapsedSeconds, 861, "Live Racing AI snapshot should include replay clock context");
const compactInsightSnapshot = liveAiSandbox.compactAiInsightSnapshot(activeSnapshot, 1700000000000);
assert.equal(compactInsightSnapshot.timing.length, 3, "Live Racing AI insight history should keep compact current timing rows");
assert.deepEqual(Object.keys(compactInsightSnapshot.timing[0]).sort(), ["age", "best", "code", "comp", "gap", "interval", "last", "pits", "pos"].sort(), "Live Racing AI insight history should omit bulky future-prone snapshot data");
const replayHistory = liveAiSandbox.mergeAiInsightHistory([
  { mode: "replay", replay: { elapsedSeconds: 120 }, timing: [{ code: "LEC" }] },
  { mode: "replay", replay: { elapsedSeconds: 240 }, timing: [{ code: "HAM" }] },
], { mode: "replay", replay: { elapsedSeconds: 180 }, timing: [{ code: "NOR" }] });
assert.deepEqual(JSON.parse(JSON.stringify(replayHistory.map((entry) => entry.replay.elapsedSeconds))), [120, 180], "Replay AI insight history should discard observations from later replay timestamps");
const liveHistory = liveAiSandbox.mergeAiInsightHistory(Array.from({ length: 12 }, (_, index) => ({
  mode: "live",
  capturedAtMs: index,
  timing: [{ code: `D${index}` }],
})), { mode: "live", capturedAtMs: 99, timing: [{ code: "LEC" }] }, 5);
assert.equal(liveHistory.length, 5, "Live AI insight history should stay bounded");
assert.equal(liveHistory.at(-1).timing[0].code, "LEC", "Live AI insight history should retain the newest observation");
const normalizedAutoInsight = liveAiSandbox.normalizeAutoAiInsight({
  alerts: [{ kind: "strategy", title: "HAM undercut threat", body: "HAM has fresher mediums and is inside the pit-loss window.", confidence: 0.84 }],
}, { mode: "replay", replayElapsedSeconds: 180 });
assert.equal(normalizedAutoInsight.kind, "strategy", "Generated AI insight cards should use provider alert kind when available");
assert.match(normalizedAutoInsight.body, /fresher mediums/, "Generated AI insight cards should keep the useful provider reasoning");
assert.equal(normalizedAutoInsight.replayElapsedSeconds, 180, "Generated replay insight cards should remember the replay timestamp they were computed from");
assert.match(source["Copilot.jsx"], /pitwall\.ai\.ask/, "Copilot should call real configured AI providers");
assert.doesNotMatch(source["Copilot.jsx"], /% likely|Model confidence|Pole\s*→\s*win|model-derived|Modelled conditions/, "Copilot should not present uncomputed model outputs as facts");
assert.doesNotMatch(source["Copilot.jsx"], /Math\.max\(0\.15,\s*0\.45\s*-\s*index\s*\*\s*0\.1\)/, "Copilot should not use hardcoded title-probability placeholders");
assert.doesNotMatch(source["Copilot.jsx"], /className="insight-meta"|className="insight-list"|className="insight-item"|selectedPage\.bullets\.map/, "Copilot should not render daily metadata rows or stacked bullet callouts above the insight boards");
assert.match(source["Copilot.jsx"], /No AI projection computed/, "Copilot should disclose when it has not computed a projection");
assert.match(mainProcess, /predictions:[\s\S]*winner[\s\S]*podium[\s\S]*leaderboard[\s\S]*watchlist/, "AI response schema should allow computed race prediction leaderboards");
assert.match(mainProcess, /const AI_PROVIDER_TIMEOUT_MS = 90000/, "Daily AI projection providers should get a longer timeout than normal JSON posts");
assert.match(mainProcess, /requestTextPost\(targetUrl, body,\s*\{[\s\S]*Accept[\s\S]*\}, AI_PROVIDER_TIMEOUT_MS\)/, "Codex streaming responses should use the AI provider timeout");
assert.match(mainProcess, /requestJsonPost\(GROK_CHAT_COMPLETIONS_URL, body, \{ Authorization: `Bearer \$\{tokens\.accessToken\}` \}, AI_PROVIDER_TIMEOUT_MS\)/, "Grok AI responses should use the AI provider timeout");
const sanitizeAiErrorForProjection = vm.runInNewContext(`(${extractNamedFunction(mainProcess, "sanitizeAiError")})`);
assert.equal(
  sanitizeAiErrorForProjection(new Error("Timeout for https://chatgpt.com/backend-api/codex/responses")),
  "ChatGPT/Codex provider timed out. Apexline will retry daily projections shortly.",
  "Daily AI projection errors should not show raw ChatGPT backend URLs"
);
const sanitizeCopilotInsightsCacheForProjection = vm.runInNewContext(`(() => {
  ${extractNamedFunction(mainProcess, "sanitizeAiError")}
  ${extractNamedFunction(mainProcess, "sanitizeCopilotInsightsCache")}
  return sanitizeCopilotInsightsCache;
})()`);
const legacyRawCodexTimeoutCache = sanitizeCopilotInsightsCacheForProjection({
  status: "failed",
  error: "Timeout for https://chatgpt.com/backend-api/codex/responses",
  progress: { error: "Timeout for https://chatgpt.com/backend-api/codex/responses", statusText: "Timeout for https://chatgpt.com/backend-api/codex/responses" },
  pages: [{ summary: "No AI projection computed today. Timeout for https://chatgpt.com/backend-api/codex/responses" }],
});
assert.doesNotMatch(JSON.stringify(legacyRawCodexTimeoutCache), /chatgpt\.com\/backend-api\/codex\/responses/, "Cached daily AI projection failures should not preserve raw ChatGPT backend URLs");
const copilotCacheHasRawAiTimeoutForProjection = vm.runInNewContext(`(${extractNamedFunction(mainProcess, "copilotCacheHasRawAiTimeout")})`);
assert.equal(copilotCacheHasRawAiTimeoutForProjection({
  status: "failed",
  error: "Timeout for https://chatgpt.com/backend-api/codex/responses",
}), true, "Legacy cached Codex timeouts should be recognized so the daily projection can retry immediately");
assert.match(mainProcess, /page\.id === "current-weekend"[\s\S]*race winner[\s\S]*podium/, "Current weekend AI prompt should explicitly request race predictions");
assert.match(mainProcess, /page\.id === "next-weekend"[\s\S]*race winner[\s\S]*podium/, "Next weekend AI prompt should explicitly request race predictions");
assert.match(mainProcess, /page\.id === "next-weekend"[\s\S]*Grand Prix race[\s\S]*full predicted race finishing order/, "Next weekend AI prompt should request a race finishing-order leaderboard");
assert.doesNotMatch(mainProcess, /Treat snapshot\.nextUpcomingSession as the target|full predicted next upcoming session order/, "Next weekend AI prompt should not target FP1 or another next scheduled session for the leaderboard");
assert.match(mainProcess, /performanceContext:[\s\S]{0,140}await buildNextWeekendPerformanceContext\(data\)/, "Next weekend AI snapshots should include a cumulative performance context");
assert.match(mainProcess, /function buildNextWeekendPerformanceContext[\s\S]*currentSeason[\s\S]*previousSeason[\s\S]*trackHistory/, "Next weekend performance context should include current-season, previous-season, and target-track evidence");
assert.match(mainProcess, /function buildCompletedRacePerformance[\s\S]*getAnalyticsSession/, "Next weekend performance context should reuse real completed OpenF1 race analytics");
assert.match(mainProcess, /This week's F1 news[\s\S]*Every race this season's results[\s\S]*Past results at this track[\s\S]*Driver skill overall[\s\S]*The model decides how to weigh these sources/, "AI projection prompts should provide evidence sources without prescribing weights");
assert.doesNotMatch(mainProcess, /Use snapshot\.trackPerformance as primary evidence|Do not rank primarily by standings/, "Next weekend AI prompt should not over-weight target-track history or standings");
assert.match(mainProcess, /leaderboard:\s*Array\.isArray\(value\.leaderboard\)/, "AI prediction normalization should preserve full predicted leaderboards");
assert.match(mainProcess, /page\.id === "drivers-championship"[\s\S]*drivers.? championship/, "Drivers championship AI prompt should explicitly request championship predictions");
assert.match(mainProcess, /page\.id === "constructors-championship"[\s\S]*constructors.? championship/, "Constructors championship AI prompt should explicitly request championship predictions");
assert.match(mainProcess, /function dailyCopilotProgress[\s\S]*currentPageId[\s\S]*completedPages[\s\S]*totalPages/, "Daily Copilot insight cache should expose page-by-page AI generation progress");
assert.match(mainProcess, /progress = dailyCopilotProgress\(\{ status: "thinking", currentPage: page[\s\S]*writeCopilotInsightsCache\(progressUpdate\)/, "Daily Copilot generation should persist progress before each provider call");
assert.match(mainProcess, /data\.copilot = liveDataCache\?\.data\?\.copilot \|\| baseData\.copilot/, "Live-data enrichment should preserve the newest Copilot progress instead of restoring stale page counts");
assert.doesNotMatch(mainProcess, /data\.copilot = baseData\.copilot;/, "Live-data enrichment should not overwrite newer Copilot progress with the original pending snapshot");
assert.match(mainProcess, /COPILOT_INSIGHTS_SCHEMA_VERSION[\s\S]*cached\?\.schemaVersion/, "Daily Copilot cache should be versioned when its response shape changes");
assert.match(mainProcess, /forceCopilotRefresh[\s\S]*getDailyCopilotInsights/, "Daily Copilot projections should support an explicit rerun path that bypasses today's cached insight");
assert.match(source["Copilot.jsx"], /PredictionBoard[\s\S]*selectedPage\.predictions/, "Copilot should render AI-computed Current weekend predictions");
assert.match(source["Copilot.jsx"], /const showPredictionBoard = Boolean\(selectedPage\.predictions\?\.available\)/, "Copilot should render AI-computed predictions on every prebuilt insight tab");
assert.match(source["Copilot.jsx"], /progressOpen[\s\S]*Show progress[\s\S]*cop-progress/, "Copilot should expose a Show progress control for daily AI generation");
assert.match(source["Copilot.jsx"], /function rerunAnalysis[\s\S]*forceCopilotRefresh[\s\S]*Rerun analysis/, "Copilot should expose a Rerun analysis button that explicitly refreshes daily projections");
assert.match(source["Copilot.jsx"], /function ChampionshipPredictionVisual[\s\S]*champ-projection/, "Copilot should render championship-specific AI projection visuals");
assert.match(source["Copilot.jsx"], /<ChampionshipPredictionVisual D=\{D\} predictions=\{predictions\} pageId=\{pageId\}/, "Prediction boards should include championship projection visuals when applicable");
assert.match(source["Copilot.jsx"], /src=\{isConstructor \? constructor\.logo : \(driver\.remoteImage \|\| driver\.image\)\}/, "Constructor Copilot prediction picks should render team logos instead of initials-only avatars");
assert.match(source["Copilot.jsx"], /square=\{isConstructor\}/, "Constructor Copilot prediction avatars should use square team-logo framing");
assert.match(source["Copilot.jsx"], /predictions\.leaderboard[\s\S]*Full leaderboard/, "Copilot should render full predicted leaderboards when AI returns them");
assert.match(source["Copilot.jsx"], /function ProjectionDriverModal[\s\S]*Model rationale/, "Current weekend leaderboard rows should have a detailed model-rationale popup");
assert.match(source["Copilot.jsx"], /setSelectedProjectionDriver\(\{ item, index \}\)[\s\S]*selectedProjectionDriver/, "Current weekend leaderboard rows should open the selected projection-driver popup");
assert.match(source["Copilot.jsx"], /function ProjectedChampionshipLeaderboard[\s\S]*Championship Leaderboard After Race \(projected\)/, "Current weekend projections should show a projected championship leaderboard below the race order");
assert.match(source["Copilot.jsx"], /RACE_POINTS[\s\S]*25[\s\S]*18[\s\S]*15[\s\S]*10[\s\S]*1/, "Projected championship leaderboard should apply standard Grand Prix points to the AI race order");
assert.match(source["Copilot.jsx"], /INSIGHT_TABS/, "Copilot should expose tabs for prebuilt insights and chat");
assert.match(source["Copilot.jsx"], /ask-copilot/, "Copilot should keep freeform chat in a separate Ask Copilot tab");
assert.match(source["Copilot.jsx"], /daily\.pages/, "Copilot should render prebuilt daily insight pages from the snapshot");
assert.match(mainProcess, /openF1Stints/, "Live snapshot should ingest OpenF1 stint data for tyre strategy reasoning");
assert.match(mainProcess, /OPTIONAL_LIVE_DATA_KEYS/, "Optional tyre enrichment feeds should not make the main live snapshot look broken");
assert.match(mainProcess, /LIVE_CORE_DATA_URLS/, "Dashboard snapshot should have a fast core live-data request set");
assert.match(mainProcess, /LIVE_TIMING_ENRICHMENT_URLS/, "Timing enrichment feeds should be separated from dashboard first paint");
assert.match(mainProcess, /LIVE_SNAPSHOT_CACHE_FILE/, "Dashboard snapshot should persist a last-good disk cache for fast repeat launches");
assert.match(mainProcess, /readLiveSnapshotDiskCache/, "Dashboard snapshot should read stale disk data before waiting on live sources");
assert.match(mainProcess, /forceRefresh[\s\S]*refreshLiveDataSnapshot/, "Dashboard snapshot IPC should support bypassing disk cache for the startup loading gate");
assert.match(mainProcess, /writeLiveSnapshotDiskCache/, "Dashboard snapshot should save successful live data for the next app launch");
assert.match(mainProcess, /refreshLiveDataSnapshot/, "Dashboard snapshot should refresh stale disk data in the background");
assert.match(mainProcess, /fetchLiveDataEntries\(LIVE_CORE_DATA_URLS\)/, "Dashboard snapshot should fetch only core data on its critical path");
assert.doesNotMatch(mainProcess, /getPitWallSnapshot[\s\S]{0,900}Object\.entries\(LIVE_DATA_URLS\)/, "Dashboard snapshot should not wait for every OpenF1 timing endpoint before rendering");
assert.match(mainProcess, /buildStrategyContext/, "Electron main should summarize tyre, pit, timing, weather, and news context for AI");
assert.match(mainProcess, /visualization/, "AI response schema should allow typed visualization payloads");
assert.match(source["Copilot.jsx"], /StrategyVisualization/, "Copilot should render AI visualization payloads when present");
assert.match(source["Copilot.jsx"], /answer\.visualization/, "Copilot should preserve typed AI visualizations in chat messages");
assert.doesNotMatch(source["LiveRacing.jsx"], /StrategyVisualization/, "Ask the engineer should stay text-only instead of rendering AI visualization payloads");
assert.doesNotMatch(source["LiveRacing.jsx"], /answer\.visualization/, "Ask the engineer should not preserve AI visualization payloads in chat messages");
assert.match(source["LiveRacing.jsx"], /renderMarkdownText/, "Ask the engineer should render AI summaries as clean Markdown text");
assert.match(source["LiveRacing.jsx"], /markdownBlocks/, "Ask the engineer should parse lightweight Markdown blocks without visual cards");
assert.match(source["LiveRacing.jsx"], /presentation:\s*"markdown_text_only"/, "Ask the engineer should explicitly request text-only Markdown answers from AI providers");
const liveMarkdownSandbox = vm.runInNewContext(`(() => {
  ${["markdownBlocks", "inlineMarkdownParts"].map((name) => extractNamedFunction(source["LiveRacing.jsx"], name)).join("\n")}
  return { markdownBlocks, inlineMarkdownParts };
})()`);
assert.deepEqual(
  JSON.parse(JSON.stringify(liveMarkdownSandbox.markdownBlocks("## Status\n\n- LAW fastest\n- Track dry\n\n**Watch:** traffic"))),
  [
    { kind: "heading", level: 2, text: "Status" },
    { kind: "list", items: ["LAW fastest", "Track dry"] },
    { kind: "paragraph", text: "**Watch:** traffic" },
  ],
  "Ask the engineer Markdown renderer should support headings, lists, and paragraphs",
);
assert.deepEqual(
  JSON.parse(JSON.stringify(liveMarkdownSandbox.inlineMarkdownParts("**Watch** `LAW` now"))),
  [
    { kind: "strong", text: "Watch" },
    { kind: "text", text: " " },
    { kind: "code", text: "LAW" },
    { kind: "text", text: " now" },
  ],
  "Ask the engineer Markdown renderer should support bold and inline code without HTML",
);
assert.match(source["LiveRacing.jsx"], /strategyContext/, "Live Racing AI snapshot should include structured strategy context");
assert.match(source["LiveRacing.jsx"], /function renderInsightsPane/, "Ask the engineer input should live in a stable render subtree so timing rerenders do not drop focus");
assert.doesNotMatch(source["LiveRacing.jsx"], /function InsightsPane/, "Ask the engineer input should not be inside a nested React component type that remounts on every Live Racing render");
assert.match(source["LiveRacing.jsx"], /chatThinking/, "Ask the engineer should track an in-flight AI response");
assert.match(source["LiveRacing.jsx"], /setChatThinking\(true\)[\s\S]*finally[\s\S]*setChatThinking\(false\)/, "Ask the engineer should show a thinking state only while the AI request is in flight");
assert.match(source["LiveRacing.jsx"], /Engineer is thinking/, "Ask the engineer should render a visible thinking message while waiting for AI");
assert.match(source["LiveRacing.jsx"], /msg--thinking/, "Ask the engineer thinking message should have a dedicated visual state");
assert.match(source["Analytics.jsx"], /pitwall\.history\.query/, "Analytics should query historical Jolpica data");
assert.doesNotMatch(source["AppShell.jsx"] + source["Dashboard.jsx"] + source["Weekend.jsx"] + source["News.jsx"] + source["Schedule.jsx"] + source["Copilot.jsx"], /Alex Ramos|Ferrari gamble on undercut|Canadian Grand Prix|Circuit Gilles-Villeneuve|Morning, Alex/, "User-facing screens should not hardcode placeholder person, news, or race data");

for (const [file, code] of Object.entries(source)) {
  assert.doesNotMatch(code, /TODO|FIXME|window\.prompt|unpkg\.com|onChange=\{\(\) => \{\}\}/, `${file} should not contain unfinished placeholders`);
}

for (const file of fs.readdirSync(kitDir).filter((name) => name.endsWith(".jsx"))) {
  const code = fs.readFileSync(path.join(kitDir, file), "utf8");
  Babel.transform(code, { presets: ["react"], filename: file });
}

console.log("Apexline smoke checks passed");
