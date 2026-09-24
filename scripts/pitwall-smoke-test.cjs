const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const zlib = require("node:zlib");
const Babel = require("@babel/standalone");

async function runSmokeChecks() {
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
assert.match(packageJson.scripts["release:mac"] || "", /release-macos\.sh/, "Official release script should Developer ID sign, notarize, and prepare the update feed");
assert.match(packageJson.scripts["package:mac:release"] || "", /release-macos\.sh/, "package:mac:release should build a signed release app without requiring deploy");
assert.match(packageJson.scripts["release:update-feed"] || "", /prepare-vercel-update\.cjs/, "Release scripts should prepare the Vercel update feed from the packaged app");
assert.equal(packageJson.apexline?.bundleId, "io.apexline.app", "Production package should use the public Apexline bundle id");
assert.ok(fs.existsSync(path.join(root, "build/entitlements.mac.plist")), "Developer ID builds need hardened-runtime entitlements");
assert.ok(fs.existsSync(path.join(root, "scripts/release-macos.sh")), "Official macOS release orchestration script should exist");
assert.ok(fs.existsSync(path.join(root, "scripts/load-apple-creds.sh")), "Apple creds loader should exist for release signing");
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
assert.match(openF1ReplayProbe, /openF1SectorTimes[\s\S]*parseTiming/, "OpenF1 replay probe should extract parser helpers used by parseTiming");
assert.match(openF1ReplayProbe, /replayRowsTimeline[\s\S]*filterReplayRowsAt/, "OpenF1 replay probe should extract replay row timeline helpers used by filterReplayRowsAt");
assert.match(packageScript, /const appPath = baseOut/, "macOS packaging should always rebuild dist/Apexline.app as the current app");
assert.match(packageScript, /Snapshot \$\{snapshotPath\}/, "macOS packaging should also keep a timestamped snapshot path");
const packagedRuntimeFiles = vm.runInNewContext(`(${extractNamedFunction(packageScript, "packagedRuntimeFiles")})`);
const runtimeFiles = Array.from(packagedRuntimeFiles());
assert.deepEqual(runtimeFiles, [
  "react/umd/react.production.min.js",
  "react/LICENSE",
  "react-dom/umd/react-dom.production.min.js",
  "react-dom/LICENSE",
  "hls.js/dist/hls.min.js",
  "hls.js/LICENSE",
  "shaka-player/dist/shaka-player.compiled.js",
  "shaka-player/LICENSE",
  "@neelsatyavolu/shared-ai-auth/package.json",
  "@neelsatyavolu/shared-ai-auth/index.cjs",
  "@neelsatyavolu/shared-ai-auth/models.json",
], "macOS packaging should use an explicit production runtime and license allowlist");
const runtimeBytes = runtimeFiles.reduce((total, relativePath) => {
  const sourcePath = path.join(root, "node_modules", relativePath);
  assert.ok(fs.existsSync(sourcePath), `Packaged runtime allowlist entry should exist: ${relativePath}`);
  return total + fs.statSync(sourcePath).size;
}, 0);
assert.ok(runtimeBytes < 2_097_152, `Packaged runtime allowlist should remain below 2 MiB (found ${runtimeBytes} bytes)`);
const copyPackagedRuntime = vm.runInNewContext(`(${extractNamedFunction(packageScript, "copyPackagedRuntime")})`, {
  fs,
  path,
  packagedRuntimeFiles,
});
const runtimeStageRoot = fs.mkdtempSync(path.join(require("node:os").tmpdir(), "apexline-runtime-stage-"));
try {
  copyPackagedRuntime(path.join(root, "node_modules"), runtimeStageRoot);
  const stagedFiles = [];
  const visitStagedRuntime = (directory) => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const entryPath = path.join(directory, entry.name);
      if (entry.isDirectory()) visitStagedRuntime(entryPath);
      else stagedFiles.push(path.relative(runtimeStageRoot, entryPath));
    }
  };
  visitStagedRuntime(runtimeStageRoot);
  assert.deepEqual(stagedFiles.sort(), runtimeFiles.slice().sort(), "A staged packaged runtime tree should contain exactly the allowlisted scripts and licenses");
  const stagedRuntimeBytes = stagedFiles.reduce((total, relativePath) => total + fs.statSync(path.join(runtimeStageRoot, relativePath)).size, 0);
  assert.equal(stagedRuntimeBytes, runtimeBytes, "A staged packaged runtime tree should preserve every allowlisted file byte-for-byte");
} finally {
  fs.rmSync(runtimeStageRoot, { recursive: true, force: true });
}
assert.doesNotMatch(packageScript, /for \(const packageName of \["react", "react-dom", "hls\.js", "shaka-player"\]\)[\s\S]*copyEntry\(path\.join\(root, "node_modules", packageName\)/, "macOS packaging should not recursively copy full playback packages");
const shouldKeepPackageSnapshot = vm.runInNewContext(`(${extractNamedFunction(packageScript, "shouldKeepPackageSnapshot")})`);
const packageSnapshotMessage = vm.runInNewContext(`(${extractNamedFunction(packageScript, "packageSnapshotMessage")})`);
assert.equal(shouldKeepPackageSnapshot({}), false, "macOS packaging should not retain timestamped snapshots by default");
assert.equal(shouldKeepPackageSnapshot({ APEXLINE_KEEP_PACKAGE_SNAPSHOT: "0" }), false, "macOS packaging should keep snapshots disabled for zero");
assert.equal(shouldKeepPackageSnapshot({ APEXLINE_KEEP_PACKAGE_SNAPSHOT: "true" }), false, "macOS packaging snapshot retention should require the explicit value 1");
assert.equal(shouldKeepPackageSnapshot({ APEXLINE_KEEP_PACKAGE_SNAPSHOT: "1" }), true, "macOS packaging should retain a snapshot when explicitly requested");
assert.equal(
  packageSnapshotMessage("/tmp/Apexline-20260723-120000.app", true),
  "Snapshot /tmp/Apexline-20260723-120000.app",
  "opt-in package output should report the retained snapshot path",
);
assert.equal(
  packageSnapshotMessage("/tmp/Apexline-20260723-120000.app", false),
  "Snapshot disabled (set APEXLINE_KEEP_PACKAGE_SNAPSHOT=1 to retain one)",
  "default package output should clearly report that snapshot retention is disabled",
);
assert.doesNotMatch(packageScript, /fs\.rmSync\(snapshotPath/, "macOS packaging should never delete an existing timestamped snapshot");
assert.match(packageScript, /if \(keepPackageSnapshot\)[\s\S]*copyEntry\(appPath, snapshotPath\)/, "macOS packaging should only copy a timestamped snapshot in the opt-in branch");
const resolvePackageByteCeiling = vm.runInNewContext(`(${extractNamedFunction(packageScript, "resolveByteCeiling")})`);
const assertPackageArtifactSize = vm.runInNewContext(`(${extractNamedFunction(packageScript, "assertArtifactSize")})`);
const defaultMaxAppBytes = 330 * 1024 * 1024;
assert.equal(resolvePackageByteCeiling({}, "APEXLINE_MAX_APP_BYTES", defaultMaxAppBytes), defaultMaxAppBytes, "macOS packaging should default to a 330 MiB app ceiling");
assert.equal(resolvePackageByteCeiling({ APEXLINE_MAX_APP_BYTES: "123456" }, "APEXLINE_MAX_APP_BYTES", defaultMaxAppBytes), 123456, "macOS packaging should honor a valid app-size override");
for (const invalid of ["0", "-1", "1.5", "not-bytes", "9007199254740992"]) {
  assert.throws(
    () => resolvePackageByteCeiling({ APEXLINE_MAX_APP_BYTES: invalid }, "APEXLINE_MAX_APP_BYTES", defaultMaxAppBytes),
    /APEXLINE_MAX_APP_BYTES must be a positive safe integer byte count/,
    `macOS packaging should reject invalid app-size override ${invalid}`,
  );
}
assert.doesNotThrow(() => assertPackageArtifactSize(defaultMaxAppBytes, defaultMaxAppBytes, "Packaged app"), "app-size guard should accept the exact ceiling");
assert.throws(() => assertPackageArtifactSize(defaultMaxAppBytes + 1, defaultMaxAppBytes, "Packaged app"), /Packaged app is too large/, "app-size guard should reject one byte above the ceiling");
assert.ok(
  packageScript.indexOf("assertArtifactSize(appBytes, maxAppBytes") < packageScript.indexOf("console.log(`Built ${appPath}`)"),
  "macOS packaging should enforce its app-size ceiling before reporting success",
);
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
assert.match(packageMac, /signWithDeveloperId|APPLE_SIGNING_IDENTITY|APPLE_CERTIFICATE/, "macOS package step should support Developer ID codesign");
assert.match(packageMac, /notarytool|notarizeAndStaple/, "macOS package step should support Apple notarization + staple");
assert.match(packageMac, /entitlements\.mac\.plist|entitlementsPath/, "Developer ID signing should apply hardened-runtime entitlements");
assert.match(packageMac, /CFBundleDisplayName", "Apexline"/, "macOS package step should set the Apexline app name");
assert.match(packageMac, /CFBundleIconFile", "app-icon"/, "macOS package step should use the custom Apexline app icon");
assert.match(packageMac, /rootPackage\.version/, "macOS package step should read the app version from package.json");
assert.match(packageMac, /CFBundleShortVersionString/, "macOS package step should stamp the user-visible app version");
assert.match(packageMac, /APEXLINE_UPDATE_BASE_URL/, "macOS package step should embed the Vercel update feed base URL");
assert.match(packageMac, /io\.apexline\.app|bundleId/, "macOS package step should stamp a stable production bundle identifier");
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
const prepareUpdateSource = fs.readFileSync(path.join(root, "scripts/prepare-vercel-update.cjs"), "utf8");
const replaceLandingPageVersion = vm.runInNewContext(`(${extractNamedFunction(prepareUpdateSource, "replaceLandingPageVersion")})`);
const resolveUpdateByteCeiling = vm.runInNewContext(`(${extractNamedFunction(prepareUpdateSource, "resolveByteCeiling")})`);
const assertUpdateArtifactSize = vm.runInNewContext(`(${extractNamedFunction(prepareUpdateSource, "assertArtifactSize")})`);
const defaultMaxUpdateZipBytes = 150 * 1024 * 1024;
assert.equal(resolveUpdateByteCeiling({}, "APEXLINE_MAX_UPDATE_ZIP_BYTES", defaultMaxUpdateZipBytes), defaultMaxUpdateZipBytes, "update prep should default to a 150 MiB zip ceiling");
assert.equal(resolveUpdateByteCeiling({ APEXLINE_MAX_UPDATE_ZIP_BYTES: "654321" }, "APEXLINE_MAX_UPDATE_ZIP_BYTES", defaultMaxUpdateZipBytes), 654321, "update prep should honor a valid zip-size override");
for (const invalid of ["0", "-1", "1.5", "not-bytes", "9007199254740992"]) {
  assert.throws(
    () => resolveUpdateByteCeiling({ APEXLINE_MAX_UPDATE_ZIP_BYTES: invalid }, "APEXLINE_MAX_UPDATE_ZIP_BYTES", defaultMaxUpdateZipBytes),
    /APEXLINE_MAX_UPDATE_ZIP_BYTES must be a positive safe integer byte count/,
    `update prep should reject invalid zip-size override ${invalid}`,
  );
}
assert.doesNotThrow(() => assertUpdateArtifactSize(defaultMaxUpdateZipBytes, defaultMaxUpdateZipBytes, "Update zip"), "zip-size guard should accept the exact ceiling");
assert.throws(() => assertUpdateArtifactSize(defaultMaxUpdateZipBytes + 1, defaultMaxUpdateZipBytes, "Update zip"), /Update zip is too large/, "zip-size guard should reject one byte above the ceiling");
const createValidatedUpdateZip = vm.runInNewContext(`(${extractNamedFunction(prepareUpdateSource, "createValidatedUpdateZip")})`, {
  assertArtifactSize: assertUpdateArtifactSize,
  Buffer,
  crypto: { randomUUID: () => "fixture" },
  ensure: (condition, message) => {
    if (!condition) throw new Error(message);
  },
  execFileSync: () => {
    throw new Error("fixture must inject compression");
  },
  fs,
  path,
  process: { pid: 123 },
});
const zipFixtureRoot = fs.mkdtempSync(path.join(require("node:os").tmpdir(), "apexline-update-stage-"));
const protectedZipPath = path.join(zipFixtureRoot, "Apexline-fixture.zip");
const minimumUpdateZipBytes = 1024 * 1024;
const storedZipFixture = (payload, name = "payload.bin") => {
  const fileName = Buffer.from(name);
  const crc = zlib.crc32(payload);
  const localHeader = Buffer.alloc(30);
  localHeader.writeUInt32LE(0x04034b50, 0);
  localHeader.writeUInt16LE(20, 4);
  localHeader.writeUInt32LE(crc, 14);
  localHeader.writeUInt32LE(payload.length, 18);
  localHeader.writeUInt32LE(payload.length, 22);
  localHeader.writeUInt16LE(fileName.length, 26);
  const centralHeader = Buffer.alloc(46);
  centralHeader.writeUInt32LE(0x02014b50, 0);
  centralHeader.writeUInt16LE(20, 4);
  centralHeader.writeUInt16LE(20, 6);
  centralHeader.writeUInt32LE(crc, 16);
  centralHeader.writeUInt32LE(payload.length, 20);
  centralHeader.writeUInt32LE(payload.length, 24);
  centralHeader.writeUInt16LE(fileName.length, 28);
  const centralOffset = localHeader.length + fileName.length + payload.length;
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(1, 8);
  end.writeUInt16LE(1, 10);
  end.writeUInt32LE(centralHeader.length + fileName.length, 12);
  end.writeUInt32LE(centralOffset, 16);
  return Buffer.concat([localHeader, fileName, payload, centralHeader, fileName, end]);
};
const validFixtureZip = storedZipFixture(Buffer.alloc(minimumUpdateZipBytes + 1));
const failedZipScenarios = [
  {
    name: "compression",
    maximum: defaultMaxUpdateZipBytes,
    write: (_source, temporaryPath) => {
      fs.writeFileSync(temporaryPath, "partial");
      throw new Error("simulated compression failure");
    },
    error: /simulated compression failure/,
  },
  {
    name: "minimum size",
    maximum: defaultMaxUpdateZipBytes,
    write: (_source, temporaryPath) => fs.writeFileSync(temporaryPath, Buffer.from("PK")),
    error: /Update zip is too small/,
  },
  {
    name: "magic",
    maximum: defaultMaxUpdateZipBytes,
    write: (_source, temporaryPath) => fs.writeFileSync(temporaryPath, Buffer.alloc(minimumUpdateZipBytes + 2)),
    error: /not a PKZip archive/,
  },
  {
    name: "maximum size",
    maximum: minimumUpdateZipBytes + 1,
    write: (_source, temporaryPath) => fs.writeFileSync(temporaryPath, validFixtureZip),
    error: /Update zip is too large/,
  },
];
try {
  for (const scenario of failedZipScenarios) {
    fs.writeFileSync(protectedZipPath, validFixtureZip);
    assert.throws(
      () => createValidatedUpdateZip("/fixture/Apexline.app", protectedZipPath, scenario.maximum, scenario.write),
      scenario.error,
      `${scenario.name} failure should stop update zip publication`,
    );
    assert.deepEqual(fs.readFileSync(protectedZipPath), validFixtureZip, `${scenario.name} failure should preserve the existing valid update zip byte-for-byte`);
    assert.deepEqual(fs.readdirSync(zipFixtureRoot), [path.basename(protectedZipPath)], `${scenario.name} failure should clean only its owned temporary sibling`);
  }

  let largestHeaderRead = 0;
  const trackedFs = Object.create(fs);
  trackedFs.readSync = (fd, buffer, offset, length, position) => {
    largestHeaderRead = Math.max(largestHeaderRead, length);
    return fs.readSync(fd, buffer, offset, length, position);
  };
  const trackedCreateValidatedUpdateZip = vm.runInNewContext(`(${extractNamedFunction(prepareUpdateSource, "createValidatedUpdateZip")})`, {
    assertArtifactSize: assertUpdateArtifactSize,
    Buffer,
    crypto: { randomUUID: () => "tracked-fixture" },
    ensure: (condition, message) => {
      if (!condition) throw new Error(message);
    },
    execFileSync: () => {
      throw new Error("fixture must inject compression");
    },
    fs: trackedFs,
    path,
    process: { pid: 124 },
  });
  fs.writeFileSync(protectedZipPath, Buffer.from("old"));
  const publishedZipStat = trackedCreateValidatedUpdateZip(
    "/fixture/Apexline.app",
    protectedZipPath,
    defaultMaxUpdateZipBytes,
    (_source, temporaryPath) => fs.writeFileSync(temporaryPath, validFixtureZip),
  );
  assert.equal(publishedZipStat.size, validFixtureZip.length, "successful update staging should return the published zip stat");
  assert.deepEqual(fs.readFileSync(protectedZipPath), validFixtureZip, "successful update staging should atomically replace the final zip");
  assert.ok(largestHeaderRead > 0 && largestHeaderRead <= 80, `update zip validation should read at most the first 80 bytes (read ${largestHeaderRead})`);
  assert.deepEqual(fs.readdirSync(zipFixtureRoot), [path.basename(protectedZipPath)], "successful update publication should leave no temporary sibling behind");
} finally {
  fs.rmSync(zipFixtureRoot, { recursive: true, force: true });
}
const createValidatedUpdateZipSource = extractNamedFunction(prepareUpdateSource, "createValidatedUpdateZip");
assert.doesNotMatch(createValidatedUpdateZipSource, /readFileSync/, "update zip validation should never read the full archive into memory");
assert.ok(
  createValidatedUpdateZipSource.indexOf("fs.statSync(temporaryPath)") < createValidatedUpdateZipSource.indexOf("fs.openSync(temporaryPath"),
  "update zip validation should check staged size before opening the archive header",
);
assert.doesNotMatch(prepareUpdateSource, /fs\.rmSync\(zipPath/, "update prep should never remove an existing final zip before successful staging");
assert.match(prepareUpdateSource, /const zipStat = createValidatedUpdateZip\(appPath, zipPath, maxUpdateZipBytes\)/, "update prep should publish only through validated temporary staging");
assert.ok(
  prepareUpdateSource.indexOf("assertArtifactSize(zipStat.size, maxUpdateZipBytes") < prepareUpdateSource.indexOf("fs.writeFileSync(feedPath"),
  "update prep should enforce its zip-size ceiling before publishing the release feed",
);
const oldLandingPageFixture = [
  '<a href="/updates/darwin/arm64/Apexline-1.0.1-mac-arm64.zip">Top</a>',
  '<a href="/updates/darwin/arm64/Apexline-1.0.2-mac-arm64.zip">Hero</a>',
  '<a href="/updates/darwin/arm64/Apexline-1.0.3-mac-arm64.zip">Download</a>',
  '<span class="badge-pill">Version 1.0.1</span>',
  '<p>Download Version 1.0.2 for Apple Silicon macOS.</p>',
  '<span class="meta">v1.0.3 · 135 MB</span>',
  '<div class="req"><span class="rk">Version</span><span class="rv">1.0.3</span></div>',
  '<div><dt>Version</dt><dd>1.0.3</dd></div>',
  '<a href="/updates/darwin/arm64/releases.json">Feed</a>',
  '<a href="/updates/darwin/x64/Apexline-1.0.3-mac-x64.zip">Intel</a>',
].join("\n");
const replacedLandingPageFixture = replaceLandingPageVersion(oldLandingPageFixture, "2.3.4");
assert.equal(
  (replacedLandingPageFixture.match(/Apexline-2\.3\.4-mac-arm64\.zip/g) || []).length,
  3,
  "Update feed prep should replace every old-version macOS arm64 download link",
);
assert.doesNotMatch(replacedLandingPageFixture, /Apexline-1\.0\.[123]-mac-arm64\.zip/, "Update feed prep should leave no stale macOS arm64 download links");
assert.match(replacedLandingPageFixture, /badge-pill">Version 2\.3\.4</, "Update feed prep should refresh the visible version badge");
assert.match(replacedLandingPageFixture, /Download Version 2\.3\.4 for Apple Silicon/, "Update feed prep should refresh the visible download copy");
assert.match(replacedLandingPageFixture, /class="meta">v2\.3\.4 · 135 MB/, "Update feed prep should refresh the visible version metadata");
assert.match(replacedLandingPageFixture, /class="rk">Version<\/span><span class="rv">2\.3\.4</, "Update feed prep should refresh the visible version requirement");
assert.match(replacedLandingPageFixture, /<dt>Version<\/dt><dd>2\.3\.4<\/dd>/, "Update feed prep should refresh the download spec version");
assert.match(replacedLandingPageFixture, /updates\/darwin\/arm64\/releases\.json/, "Update feed prep should preserve unrelated feed links");
assert.match(replacedLandingPageFixture, /Apexline-1\.0\.3-mac-x64\.zip/, "Update feed prep should preserve unrelated architecture links");
assert.match(updateSiteIndex, /Apexline for macOS/, "Apexline landing page should identify the app clearly");
assert.match(updateSiteIndex, /<link rel="icon" href="\/favicon\.svg" type="image\/svg\+xml">/, "Apexline landing page should link the website favicon");
const deployedArm64ArtifactVersions = Array.from(
  updateSiteIndex.matchAll(/\/updates\/darwin\/arm64\/Apexline-([0-9A-Za-z.+-]+)-mac-arm64\.zip/g),
  (match) => match[1],
);
assert.ok(deployedArm64ArtifactVersions.length >= 1, "Apexline landing page should expose a macOS arm64 download link");
assert.deepEqual(
  deployedArm64ArtifactVersions,
  Array(deployedArm64ArtifactVersions.length).fill(packageJson.version),
  "Every Apexline landing-page macOS arm64 download link should use the current package version",
);
assert.match(updateSiteIndex, /<dt>Version<\/dt><dd>[0-9A-Za-z.+-]+<\/dd>/, "Apexline landing page should show the version in a form update feed prep can refresh");
assert.match(updateSiteIndex, /updates\/darwin\/arm64\/releases\.json/, "Apexline landing page should link the app update feed");
assert.match(updateSiteIndex, /https:\/\/github\.com\/neelsatyavolu\/apexline/, "Apexline landing page should link the open-source repository");
assert.match(updateSiteIndex, /22-car timing tower/, "Apexline landing page should reflect the 22-driver timing field without implying guaranteed live tracking");
assert.match(updateSiteIndex, /active F1 TV subscription/, "Apexline landing page should be explicit that streams require the user's F1 TV subscription");
assert.match(updateSiteIndex, /Developer ID signed and Apple notarized/, "Apexline landing page should accurately describe the signed and notarized build");
assert.match(updateSiteIndex, /Updates remain manual downloads from the public update feed/, "Apexline landing page should retain the manual-download update explanation");
assert.doesNotMatch(updateSiteIndex, /not Apple Developer ID signed or notarized/, "Apexline landing page should not describe the signed build as unsigned");
assert.doesNotMatch(updateSiteIndex, /Live now|Free during beta|Apple Silicon &amp; Intel|menu bar live timing|24<\/div><div class="l">Grands Prix|broadcast-grade|exactly like the broadcast|private-repo safe|any combination of onboard cameras|Browser tabs needed/, "Apexline landing page should not publish prototype-only, unsupported, or over-polished marketing claims");
const landingScreenIds = ["live", "dashboard", "weekend", "trackmap", "leaderboards", "schedule", "drivers", "teams", "news", "analytics", "copilot"];
const landingScreenshotTags = updateSiteIndex.match(/<img\b[^>]*src="\.\/assets\/screens\/[a-z]+\.webp"[^>]*>/g) || [];
assert.equal(landingScreenshotTags.length, landingScreenIds.length, "Apexline landing page should reference one screenshot per showcased screen");
const liveScreenshotTag = landingScreenshotTags.find((tag) => tag.includes("screens/live.webp"));
assert.ok(liveScreenshotTag, "Apexline landing page should include the first visible Live Racing screenshot");
assert.match(liveScreenshotTag, /\bloading="eager"/, "The first visible Live Racing screenshot should load eagerly");
assert.match(liveScreenshotTag, /\bfetchpriority="high"/, "The first visible Live Racing screenshot should receive high fetch priority");
assert.match(liveScreenshotTag, /\bdecoding="async"/, "The first visible Live Racing screenshot should decode asynchronously");
const belowFoldScreenshotTags = landingScreenshotTags.filter((tag) => !tag.includes("screens/live.webp"));
for (const tag of belowFoldScreenshotTags) {
  assert.match(tag, /\bloading="lazy"/, "Below-fold screenshots should load lazily");
  assert.match(tag, /\bdecoding="async"/, "Below-fold screenshots should decode asynchronously");
  assert.doesNotMatch(tag, /\bfetchpriority="high"/, "Below-fold screenshots should not receive high fetch priority");
}
for (const tag of landingScreenshotTags) {
  assert.match(tag, /\balt="[^"]{20,}"/, "Every landing-page screenshot should have descriptive alt text");
  assert.ok(Number(tag.match(/\bwidth="(\d+)"/)?.[1]) >= 2400, "Landing-page screenshots should be high resolution");
}
let landingScreenshotBytes = 0;
landingScreenIds.forEach((id) => {
  const assetPath = path.join(root, "updates-site/public/assets/screens", `${id}.webp`);
  assert.ok(fs.existsSync(assetPath), `screens/${id}.webp should exist for the landing page`);
  landingScreenshotBytes += fs.statSync(assetPath).size;
});
assert.ok(landingScreenshotBytes <= 3_000_000, `Landing-page screenshots should stay under 3 MB in total (found ${landingScreenshotBytes})`);
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
assert.match(mainProcess, /assertValidUpdateZip|PKZip|git-lfs/, "Update installer should reject Git LFS pointers / non-zip downloads before ditto");
assert.match(mainProcess, /"-x", "-k"/, "Update installer should extract the hosted zip with ditto before replacing the app");
const prepareUpdate = fs.readFileSync(path.join(root, "scripts/prepare-vercel-update.cjs"), "utf8");
assert.match(prepareUpdate, /0x50 && zipMagic\[1\] === 0x4b|PKZip|git-lfs/, "Update feed prep should refuse to publish LFS pointer files as zips");
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
assert.match(trackMapSource, /const TRACK_MAP_REPLAY_DATA_POLL_MS = 1000/, "Track Map replay data should promote elapsed state at roughly 1 Hz instead of every visual tick");
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
assert.match(mainProcess, /trackPositionSample: trackPositionInvariant\.sample/, "Track Map replay snapshots should include a memoized session-wide position sample for stable map orientation");
assert.match(trackMapSource, /trackPositionSample/, "Track Map replay should lock projector orientation from the session-wide position sample");
assert.match(trackMapSource, /Math\.floor\(\(elapsedSeconds \* 1000\) \/ TRACK_MAP_REPLAY_DATA_POLL_MS\)/, "Track Map replay fetch bucket should use the configured one-second interval");
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
assert.match(trackMapSource, /liveSession[\s\S]*const live = \(Array\.isArray\(data\.timing\) \? data\.timing\.length : 0\) > 0 && Boolean/, "Track Map should activate live mode from live timing rows and live session context");
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
assert.match(liveRacingSource, /<PitWallStreamPlayer[\s\S]*onSurfaceToggle=\{onSurfaceToggle\}/, "Stream players should delegate live video clicks to the pane playback toggle");
assert.match(liveRacingSource, /function handleSurfaceClick\(event\)[\s\S]*if \(replaySync\?\.mode === "replay"\)[\s\S]*onSurfaceToggle\?\.\(\)/, "Direct live video clicks should use the shared pane playback toggle instead of pausing only that video element");
assert.match(liveRacingSource, /function togglePlayerSurfacePlayback\(key\)[\s\S]*const targets = Object\.values\(playerRefs\.current\)[\s\S]*video\.pause\(\)/, "Pausing any live feed should pause mounted live feeds together");
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
  ${extractNamedFunction(liveRacingSource, "isRetiredTimingRow")}
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
const closeBattleWithRetiredRows = closeBattleRows.map((row) => ["GAS", "NOR"].includes(row.code) ? { ...row, retired: true } : row);
const closeBattleWithRetiredFocus = liveBattleSandbox.intelligentOnboardCodes({
  timingRows: closeBattleWithRetiredRows,
  selectedCode: "VER",
  fallbackCodes: closeBattleRows.map((row) => row.code),
  sessionKind: "Race",
});
assert.deepEqual(JSON.parse(JSON.stringify(closeBattleWithRetiredFocus.slice(1, 3))), ["HAM", "LEC"], "Intelligent battle onboards should ignore retired drivers when selecting close race fights");
const rankedActiveBattles = liveBattleSandbox.buildActiveBattlePairs(closeBattleRows);
assert.deepEqual(JSON.parse(JSON.stringify([rankedActiveBattles[0]?.a, rankedActiveBattles[0]?.b])), ["GAS", "NOR"], "Active battle pairs should rank by battle quality instead of position alone");
const rankedActiveBattlesWithRetiredRows = liveBattleSandbox.buildActiveBattlePairs([
  { pos: 1, code: "LEC", interval: "LEADER" },
  { pos: 2, code: "HAM", interval: "+0.420", retired: true },
  { pos: 3, code: "NOR", interval: "+6.980" },
  { pos: 4, code: "PIA", interval: "+0.800" },
]);
assert.deepEqual(JSON.parse(JSON.stringify([rankedActiveBattlesWithRetiredRows[0]?.a, rankedActiveBattlesWithRetiredRows[0]?.b])), ["NOR", "PIA"], "Active battle pairs should ignore retired drivers before ranking close fights");
assert.match(liveRacingSource, /Watch Party/, "Live Racing should expose a Watch Party control");
assert.match(liveRacingSource, /party-tray/, "Live Racing should render a draggable non-modal party tray");
assert.match(liveRacingSource, /partyTrayPosition/, "Live Racing should persist the draggable party tray position");
assert.match(liveRacingSource, /wpc__head[\s\S]*wpc__avstack[\s\S]*wpc__sync/, "Watch Party tray (Glass Minimal) should lead with an avatar stack and a sync pill header");
assert.match(liveRacingSource, /wpc__chat[\s\S]*wpc-msg[\s\S]*wpc__compose/, "Watch Party tray should render chat messages above a compose row");
assert.match(liveRacingSource, /partyChatRef[\s\S]*scrollTop[\s\S]*scrollHeight[\s\S]*partyMessages/, "Watch Party chat should auto-scroll after local or remote messages render");
assert.match(liveRacingSource, /<div className="wpc__chat" ref=\{partyChatRef\}>/, "Watch Party chat should attach its auto-scroll ref to the scroll container");
const shouldShowPartySender = vm.runInNewContext(`(${extractNamedFunction(liveRacingSource, "shouldShowPartySender")})`);
assert.equal(shouldShowPartySender({ userId: "emily", name: "Emily Lin" }, null, "me"), true, "Watch Party should show the sender for the first remote message");
assert.equal(shouldShowPartySender({ userId: "emily", name: "Emily Lin" }, { userId: "emily", name: "Emily Lin" }, "me"), false, "Watch Party should hide repeated sender labels for consecutive messages from the same remote user");
assert.equal(shouldShowPartySender({ userId: "sam", name: "Sam" }, { userId: "emily", name: "Emily Lin" }, "me"), true, "Watch Party should show the sender again when another user interrupts the run");
assert.equal(shouldShowPartySender({ userId: "emily", name: "Emily Lin" }, { system: true, text: "Room ready" }, "me"), true, "Watch Party system messages should break remote sender grouping");
assert.equal(shouldShowPartySender({ userId: "me", name: "Me" }, { userId: "emily", name: "Emily Lin" }, "me"), false, "Watch Party should not show sender labels for local messages");
assert.match(liveRacingSource, /const showSender = shouldShowPartySender\(message, previousPartyMessage, myId\)[\s\S]*\{!mine && <span className="wpc-av"[\s\S]*\{showSender && <span className="wpc-msg__name"/, "Watch Party tray should render repeated remote message bubbles without repeating the sender name");
assert.match(liveRacingSource, /renderPartyToasts[\s\S]*wpt-card[\s\S]*Watch Party/, "Live Racing should render stacking Card mini toasts for party messages");
assert.match(liveRacingSource, /wp-unread/, "Watch Party launcher should carry an unread message badge");
assert.match(liveRacingSource, /publishHostSync/, "Live Racing should publish host-authoritative watch party sync");
assert.match(liveRacingSource, /applyRemotePartySync/, "Live Racing should apply matching remote watch party sync");
assert.match(liveRacingSource, /partySyncRoleRef[\s\S]*applyRemotePartySync[\s\S]*partySyncRoleRef\.current === "host"/, "Watch Party guests should not ignore sync events through a stale host-role closure");
assert.match(liveRacingSource, /hostPartyPlaybackSnapshot[\s\S]*video\.paused[\s\S]*playing/, "Watch Party host sync should publish the actual player paused or playing state");
assert.match(liveRacingSource, /event\.type === "presence"[\s\S]*partyMemberCountRef[\s\S]*publishHostSync\(\)/, "Watch Party host should auto-sync guests when the presence count increases");
assert.match(liveRacingSource, /React\.useEffect\(\(\) => \{\s*if \(!partyRoom \|\| partySyncRole !== "host" \|\| replaySync\.mode !== "live"\) return;\s*publishHostSync\(\);\s*\}, \[partyRoom\?\.id, partySyncRole, replaySync\.mode, syncSettings\.worldTarget\]\)/, "Watch Party hosts should broadcast live latency changes to guests");
assert.match(socialClientSource, /channel\.subscribe\("sync-request"[\s\S]*type: "sync-request"/, "Watch Party realtime client should listen for explicit host sync requests");
assert.match(socialClientSource, /channel\.subscribe\("typing"[\s\S]*type: "typing"/, "Watch Party realtime client should listen for typing indicators");
assert.match(socialClientSource, /function requestHostSync[\s\S]*channel\?\.publish\?\.\("sync-request"/, "Watch Party guests should be able to request the host's current sync state after joining");
assert.match(socialClientSource, /function publishTyping[\s\S]*channel\?\.publish\?\.\("typing"/, "Watch Party users should publish ephemeral typing state");
assert.match(liveRacingSource, /joinWatchParty[\s\S]*requestHostSync\?\.\(\)/, "Watch Party guests should request a fresh host sync immediately after joining");
assert.match(liveRacingSource, /event\.type === "sync-request"[\s\S]*partySyncRoleRef\.current === "host"[\s\S]*publishHostSync\(\)/, "Watch Party hosts should answer explicit guest sync requests with the current playback snapshot");
assert.match(liveRacingSource, /event\.type === "typing"[\s\S]*setPartyTyping/, "Watch Party should render remote typing indicators from realtime events");
assert.match(liveRacingSource, /function publishPartyTyping[\s\S]*publishTyping/, "Watch Party should publish typing state from the chat composer");
assert.match(liveRacingSource, /renderPartyTypingIndicator[\s\S]*typing/, "Watch Party should show who is typing in the party tray");
assert.match(liveRacingSource, /const partyPlaybackLocked = Boolean\(partyRoom && partySyncRole !== "host"\)/, "Watch Party guests should enter a host-authoritative playback lock");
assert.match(extractNamedFunction(liveRacingSource, "applyRemotePartySync"), /partySync\.liveDecision[\s\S]*setSyncSettings[\s\S]*syncLivePlayersToTarget\("WORLD", nextSettings\)/, "Watch Party guests should actively nudge live players to the host latency target");
assert.match(liveRacingSource, /const partySyncState = computePartySyncState[\s\S]*partySyncLabel/, "Watch Party sync pill should use drift-aware state instead of a fixed label");
assert.match(liveRacingSource, /function computePartySyncState[\s\S]*Out of sync[\s\S]*Catching up[\s\S]*In sync/, "Watch Party sync status should distinguish drift states");
assert.match(liveRacingSource, /!isHost && <button type="button" className="wpc__resync" onClick=\{\(\) => window\.PW_SOCIAL\?\.requestHostSync\?\.\(\)\}/, "Watch Party guests should get a Sync To Host button");
assert.match(liveRacingSource, /function handleSurfaceClick\(event\)[\s\S]*if \(playbackLocked\) return;/, "Watch Party guest video clicks should not toggle playback");
assert.match(liveRacingSource, /disabled=\{playbackLocked\}[\s\S]*aria-label=\{replaySync\.playing \? "Pause replay" : "Play replay"\}/, "Watch Party guest replay play/pause controls should be disabled");
assert.match(liveRacingSource, /aria-label="Replay position"[\s\S]*disabled=\{playbackLocked\}/, "Watch Party guest replay scrubbers should be disabled");
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
assert.match(settingsSource, /function createProfilePersistence/, "Settings should use an event-driven profile persistence controller");
assert.doesNotMatch(
  settingsSource,
  /React\.useEffect\(\(\) => \{\s*updateProfile\(\{ videoQuality:/,
  "Settings should not write the profile on mount or echo a loaded video quality back through IPC"
);
assert.match(
  settingsSource,
  /function setPref\(key, value\)[\s\S]*key === "videoQuality"[\s\S]*persistNow\(\{ videoQuality: value \}\)/,
  "Settings should persist video quality only from the user preference event"
);
const createProfilePersistence = vm.runInNewContext(
  `(${extractNamedFunction(settingsSource, "createProfilePersistence")})`,
  { PROFILE_NAME_PERSIST_DELAY_MS: 300 }
);
{
  let now = 0;
  let nextTimerId = 1;
  const timers = new Map();
  const writes = [];
  const fakeTimers = {
    setTimeout(callback, delay) {
      const id = nextTimerId++;
      timers.set(id, { at: now + delay, callback });
      return id;
    },
    clearTimeout(id) {
      timers.delete(id);
    },
  };
  const advance = (milliseconds) => {
    now += milliseconds;
    for (const [id, timer] of [...timers].sort((a, b) => a[1].at - b[1].at)) {
      if (timer.at > now) continue;
      timers.delete(id);
      timer.callback();
    }
  };
  const persistence = createProfilePersistence((patch) => writes.push(JSON.parse(JSON.stringify(patch))), fakeTimers);
  assert.equal(writes.length, 0, "Settings profile persistence should not write during initial mount");
  persistence.scheduleName("N");
  advance(100);
  persistence.scheduleName("Ne");
  advance(100);
  persistence.scheduleName("Neel");
  advance(299);
  assert.equal(writes.length, 0, "Settings should debounce a burst of profile-name edits for 300ms");
  advance(1);
  assert.deepEqual(writes, [{ name: "Neel" }], "Settings should persist only the latest name once after the debounce");
  persistence.persistNow({ favoriteDrivers: ["NOR"] });
  assert.deepEqual(writes.at(-1), { favoriteDrivers: ["NOR"] }, "Settings favorite changes should persist immediately");
  persistence.scheduleName("Latest draft");
  persistence.flush();
  persistence.flush();
  assert.deepEqual(writes.at(-1), { name: "Latest draft" }, "Settings unmount should flush the latest name draft");
  assert.equal(writes.length, 3, "Settings unmount should flush a pending name exactly once");
  advance(300);
  assert.equal(writes.length, 3, "Settings should cancel the flushed debounce timer");
}
assert.match(settingsSource, /reader\.onload[\s\S]*persistNow\(\{ profileImageUrl: nextProfileImageUrl \}\)/, "Settings image selection should send an explicit immediate image patch");
assert.match(settingsSource, /persistNow\(\{ profileImageUrl: "" \}\)[\s\S]*Clear photo/, "Settings image clearing should send an explicit immediate empty-image patch");
assert.match(mainProcess, /function writeProfileFiles/, "Electron should persist large profile images separately from ordinary profile JSON");
assert.match(mainProcess, /function readProfileFiles/, "Electron should merge separately persisted profile images on profile.get");
assert.match(mainProcess, /function createSerialMutationQueue/, "Electron should serialize profile mutations through one resilient queue");
{
  const createSerialMutationQueue = vm.runInNewContext(`(${extractNamedFunction(mainProcess, "createSerialMutationQueue")})`);
  const enqueue = createSerialMutationQueue();
  const order = [];
  let stored = "old";
  let rejectFirst;
  const firstGate = new Promise((_resolve, reject) => { rejectFirst = reject; });
  const writeA = enqueue(async () => {
    order.push("A:start");
    const before = stored;
    stored = "A:partial";
    try {
      await firstGate;
    } catch (error) {
      stored = before;
      order.push("A:rollback");
      throw error;
    }
  });
  const writeB = enqueue(async () => {
    order.push("B:start");
    assert.equal(stored, "old", "Queued profile write B should start only after A finishes its rollback");
    stored = "B";
    order.push("B:commit");
    return stored;
  });
  await Promise.resolve();
  assert.deepEqual(order, ["A:start"], "Overlapping profile write B should wait for A");
  rejectFirst(new Error("simulated A failure"));
  await assert.rejects(writeA, /simulated A failure/, "The failed queued mutation should reject its own caller");
  assert.equal(await writeB, "B", "Profile write B should apply after failed write A");
  assert.equal(stored, "B", "Write A rollback should complete before and never overwrite successful write B");
  const writeC = enqueue(async () => {
    order.push("C:commit");
    stored = "C";
    return stored;
  });
  assert.equal(await writeC, "C", "Profile mutation queue should continue after a rejection");
  assert.deepEqual(order, ["A:start", "A:rollback", "B:start", "B:commit", "C:commit"], "Profile mutations should keep strict call order across failures");
}
assert.match(dataProviderSource, /function profilePatchIncludesImage/, "Renderer profile persistence should detect explicit image patches");
assert.match(dataProviderSource, /function shouldMigrateProfileImage/, "Renderer profile startup should detect local profile-image migration");
assert.match(dataProviderSource, /function normalizeProfilePatch/, "Renderer should normalize only fields owned by an update patch");
assert.match(dataProviderSource, /function persistProfile\(profile, options = \{\}\)/, "Renderer profile persistence should support image-free ordinary IPC payloads");
assert.match(dataProviderSource, /persistProfile\(next, \{ patch \}\)/, "Renderer updateProfile should send the original patch rather than a stale full profile");
assert.match(dataProviderSource, /includeProfileImage: shouldMigrateProfileImage\(local, persisted\)/, "Renderer startup should include image IPC only for local-to-main migration");
{
  const localWrites = [];
  const ipcPayloads = [];
  const profilePersistence = vm.runInNewContext(`(() => {
    function normalizeProfile(profile) { return { ...profile }; }
    ${extractNamedFunction(dataProviderSource, "profilePatchIncludesImage")}
    ${extractNamedFunction(dataProviderSource, "shouldMigrateProfileImage")}
    ${extractNamedFunction(dataProviderSource, "normalizeProfilePatch")}
    ${extractNamedFunction(dataProviderSource, "persistProfile")}
    return { profilePatchIncludesImage, shouldMigrateProfileImage, normalizeProfilePatch, persistProfile };
  })()`, {
    localStorage: { setItem: (_key, value) => localWrites.push(JSON.parse(value)) },
    window: { pitwall: { profile: { set: async (payload) => { ipcPayloads.push(JSON.parse(JSON.stringify(payload))); } } } },
  });
  const fullProfile = { name: "Neel", profileImageUrl: "data:image/png;base64,LARGE", favoriteDrivers: ["NOR"] };
  profilePersistence.persistProfile(fullProfile);
  await Promise.resolve();
  assert.equal(localWrites[0].profileImageUrl, fullProfile.profileImageUrl, "Ordinary profile persistence should retain the image in localStorage");
  assert.equal(Object.hasOwn(ipcPayloads[0], "profileImageUrl"), false, "Ordinary profile IPC should omit profileImageUrl");
  profilePersistence.persistProfile(fullProfile, { includeProfileImage: true });
  await Promise.resolve();
  assert.equal(ipcPayloads[1].profileImageUrl, fullProfile.profileImageUrl, "Explicit image persistence should include profileImageUrl in IPC");
  assert.equal(profilePersistence.profilePatchIncludesImage({ name: "Name only" }), false, "Name debounce patches should not include profile images");
  assert.equal(profilePersistence.profilePatchIncludesImage({ profileImageUrl: "" }), true, "Image clears should count as explicit image patches");
  assert.equal(
    profilePersistence.shouldMigrateProfileImage({ profileImageUrl: fullProfile.profileImageUrl }, { profileImageUrl: "" }),
    true,
    "Startup should migrate a local image when main storage has none"
  );
  assert.equal(
    profilePersistence.shouldMigrateProfileImage({ profileImageUrl: fullProfile.profileImageUrl }, { profileImageUrl: "data:image/png;base64,MAIN" }),
    false,
    "Startup should not resend an image already stored by main"
  );
  profilePersistence.persistProfile({ ...fullProfile, name: "A", favoriteDrivers: ["OLD"] }, { patch: { name: "A" } });
  profilePersistence.persistProfile({ ...fullProfile, name: "STALE", favoriteDrivers: ["NOR"] }, { patch: { favoriteDrivers: ["NOR"] } });
  await Promise.resolve();
  assert.deepEqual(ipcPayloads[2], { name: "A" }, "Profile IPC patch A should not carry stale unrelated fields or an image");
  assert.deepEqual(ipcPayloads[3], { favoriteDrivers: ["NOR"] }, "Profile IPC patch B should not overwrite the unrelated field updated by patch A");
  profilePersistence.persistProfile(fullProfile, { patch: { profileImageUrl: fullProfile.profileImageUrl } });
  await Promise.resolve();
  assert.deepEqual(ipcPayloads[4], { profileImageUrl: fullProfile.profileImageUrl }, "An explicit image patch should be the only ordinary IPC payload carrying profileImageUrl");
}
assert.doesNotMatch(liveRacingSource, /profile\.set\(\{ \.\.\.profile, live(?:PanelSizes|CustomLayouts): normalized \}\)/, "Live Racing profile writes should not send stale full-profile snapshots");
assert.match(liveRacingSource, /profile\.set\(\{ livePanelSizes: normalized \}\)/, "Live Racing panel-size persistence should send a true patch");
assert.match(liveRacingSource, /profile\.set\(\{ liveCustomLayouts: normalized \}\)/, "Live Racing custom-layout persistence should send a true patch");
{
  const panelPayloadLiteral = liveRacingSource.match(/profile\.set\((\{ livePanelSizes: normalized \})\)/)?.[1];
  const layoutPayloadLiteral = liveRacingSource.match(/profile\.set\((\{ liveCustomLayouts: normalized \})\)/)?.[1];
  const staleProfile = { profileImageUrl: "data:image/png;base64,STALE", name: "Stale" };
  const panelPayload = vm.runInNewContext(`(${panelPayloadLiteral})`, { normalized: { map: 420 }, profile: staleProfile });
  const layoutPayload = vm.runInNewContext(`(${layoutPayloadLiteral})`, { normalized: { layouts: [] }, profile: staleProfile });
  assert.deepEqual(JSON.parse(JSON.stringify(panelPayload)), { livePanelSizes: { map: 420 } }, "Live Racing panel-size runtime payload should contain only its patch");
  assert.deepEqual(JSON.parse(JSON.stringify(layoutPayload)), { liveCustomLayouts: { layouts: [] } }, "Live Racing layout runtime payload should contain only its patch");
  assert.equal(Object.hasOwn(panelPayload, "profileImageUrl") || Object.hasOwn(layoutPayload, "profileImageUrl"), false, "Live Racing patch payloads should never carry a stale image");
}
assert.match(mainProcess, /function profilePatchIncludesImage/, "Electron profile.set should detect whether its patch owns profileImageUrl");
assert.match(mainProcess, /function shouldWriteProfileImage/, "Electron should migrate a legacy embedded image during an ordinary patch");
assert.match(mainProcess, /writeProfileFiles\(profileFilePath\(\), profileImageFilePath\(\), next, \{ writeImage \}\)/, "Electron profile.set should leave separate image storage untouched for ordinary patches");
{
  const mainProfilePatchIncludesImage = vm.runInNewContext(`(${extractNamedFunction(mainProcess, "profilePatchIncludesImage")})`);
  const shouldWriteProfileImage = vm.runInNewContext(`(${extractNamedFunction(mainProcess, "shouldWriteProfileImage")})`, { profilePatchIncludesImage: mainProfilePatchIncludesImage });
  assert.equal(mainProfilePatchIncludesImage({ favoriteDrivers: ["NOR"] }), false, "Electron should treat ordinary profile.set input as an image-free patch");
  assert.equal(mainProfilePatchIncludesImage({ profileImageUrl: "" }), true, "Electron should preserve explicit empty-image ownership before normalization");
  assert.equal(shouldWriteProfileImage({ name: "Ordinary" }, { profileImageUrl: "data:image/png;base64,LEGACY" }, false), true, "An ordinary patch should migrate a legacy embedded image when no separate image exists");
  assert.equal(shouldWriteProfileImage({ name: "Ordinary" }, { profileImageUrl: "data:image/png;base64,SAVED" }, true), false, "An ordinary patch should not rewrite an existing separate image");
}
{
  const os = require("node:os");
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "apexline-profile-"));
  const profilePath = path.join(tempDir, "profile.json");
  const imagePath = path.join(tempDir, "profile-image.txt");
  const profilePersistenceSource = `(() => {
    ${[
      "profileTempPath",
      "readProfileFileSnapshot",
      "restoreProfileFileSnapshot",
      "readProfileFiles",
      "writeProfileFiles",
    ].map((name) => extractNamedFunction(mainProcess, name)).join("\n")}
    return { readProfileFiles, writeProfileFiles };
  })()`;
  const profilePersistence = vm.runInNewContext(profilePersistenceSource, { fs, path, process, Date, Math, Buffer });
  const image = `data:image/png;base64,${"A".repeat(2 * 1024 * 1024 + 512)}`;
  const saved = { name: "Round trip", profileImageUrl: image, favoriteDrivers: ["NOR"], favoriteTeams: [] };
  try {
    await profilePersistence.writeProfileFiles(profilePath, imagePath, saved);
    const ordinaryProfile = JSON.parse(fs.readFileSync(profilePath, "utf8"));
    assert.equal(Object.hasOwn(ordinaryProfile, "profileImageUrl"), false, "Ordinary profile JSON should omit the multi-megabyte image");
    assert.equal(fs.readFileSync(imagePath, "utf8"), image, "Profile image payload should use its separate file");
    assert.deepEqual(
      JSON.parse(JSON.stringify(await profilePersistence.readProfileFiles(profilePath, imagePath))),
      saved,
      "profile.get storage should merge the separate image without changing the renderer profile shape"
    );
    let ordinaryImageWrites = 0;
    const ordinaryFs = {
      ...fs,
      promises: {
        ...fs.promises,
        writeFile: async (file, ...args) => {
          if (String(file).includes("profile-image.txt")) ordinaryImageWrites += 1;
          return fs.promises.writeFile(file, ...args);
        },
      },
    };
    const ordinaryPersistence = vm.runInNewContext(profilePersistenceSource, { fs: ordinaryFs, path, process, Date, Math, Buffer });
    const imageBeforeOrdinaryWrite = fs.readFileSync(imagePath);
    const imageMtimeBeforeOrdinaryWrite = fs.statSync(imagePath).mtimeMs;
    await ordinaryPersistence.writeProfileFiles(profilePath, imagePath, { ...saved, name: "Name only" }, { writeImage: false });
    assert.equal(ordinaryImageWrites, 0, "Ordinary profile writes should not write a profile-image temp or payload file");
    assert.deepEqual(fs.readFileSync(imagePath), imageBeforeOrdinaryWrite, "Ordinary profile writes should preserve the separate image bytes");
    assert.equal(fs.statSync(imagePath).mtimeMs, imageMtimeBeforeOrdinaryWrite, "Ordinary profile writes should preserve the separate image mtime");

    const migratedImage = "data:image/png;base64,OLD";
    fs.writeFileSync(profilePath, JSON.stringify({ name: "Migrated", profileImageUrl: migratedImage }));
    fs.rmSync(imagePath);
    const migrated = await profilePersistence.readProfileFiles(profilePath, imagePath);
    assert.equal(migrated.profileImageUrl, migratedImage, "Profile migration should read an existing embedded image");
    const profilePatchIncludesImage = vm.runInNewContext(`(${extractNamedFunction(mainProcess, "profilePatchIncludesImage")})`);
    const shouldWriteProfileImage = vm.runInNewContext(`(${extractNamedFunction(mainProcess, "shouldWriteProfileImage")})`, { profilePatchIncludesImage });
    const legacyWriteImage = shouldWriteProfileImage({ name: "Migrated name" }, migrated, fs.existsSync(imagePath));
    await profilePersistence.writeProfileFiles(profilePath, imagePath, { ...migrated, name: "Migrated name" }, { writeImage: legacyWriteImage });
    assert.equal(fs.readFileSync(imagePath, "utf8"), migratedImage, "Profile migration should move the embedded image on the next write");
    assert.equal(Object.hasOwn(JSON.parse(fs.readFileSync(profilePath, "utf8")), "profileImageUrl"), false, "Migrated profile JSON should omit the embedded image");
    assert.equal((await profilePersistence.readProfileFiles(profilePath, imagePath)).profileImageUrl, migratedImage, "Migrated image should survive the ordinary patch round trip");

    fs.writeFileSync(profilePath, JSON.stringify({ name: "Legacy rollback", profileImageUrl: migratedImage }));
    fs.rmSync(imagePath);
    const legacyProfileBeforeFailure = fs.readFileSync(profilePath);
    let legacyRenameCount = 0;
    const failingLegacyFs = {
      ...fs,
      promises: {
        ...fs.promises,
        rename: async (...args) => {
          legacyRenameCount += 1;
          if (legacyRenameCount === 2) throw new Error("simulated legacy migration failure");
          return fs.promises.rename(...args);
        },
      },
    };
    const failingLegacyPersistence = vm.runInNewContext(profilePersistenceSource, { fs: failingLegacyFs, path, process, Date, Math, Buffer });
    await assert.rejects(
      failingLegacyPersistence.writeProfileFiles(profilePath, imagePath, { ...migrated, name: "Must rollback" }, { writeImage: true }),
      /simulated legacy migration failure/
    );
    assert.deepEqual(fs.readFileSync(profilePath), legacyProfileBeforeFailure, "Failed legacy migration should restore embedded profile JSON");
    assert.equal(fs.existsSync(imagePath), false, "Failed legacy migration should remove its partially committed separate image");

    await profilePersistence.writeProfileFiles(profilePath, imagePath, { ...migrated, profileImageUrl: "" });
    assert.equal(fs.existsSync(imagePath), false, "Clearing a profile image should remove its separate payload file");

    await profilePersistence.writeProfileFiles(profilePath, imagePath, saved);
    const oldProfile = fs.readFileSync(profilePath);
    const oldImage = fs.readFileSync(imagePath);
    let renameCount = 0;
    const failingFs = {
      ...fs,
      promises: {
        ...fs.promises,
        rename: async (...args) => {
          renameCount += 1;
          if (renameCount === 2) throw new Error("simulated profile commit failure");
          return fs.promises.rename(...args);
        },
      },
    };
    const failingPersistence = vm.runInNewContext(profilePersistenceSource, { fs: failingFs, path, process, Date, Math, Buffer });
    await assert.rejects(
      failingPersistence.writeProfileFiles(profilePath, imagePath, { ...saved, name: "Must not replace old data", profileImageUrl: "data:image/png;base64,NEW" }),
      /simulated profile commit failure/,
      "Profile persistence should surface failed commits"
    );
    assert.deepEqual(fs.readFileSync(profilePath), oldProfile, "A failed profile commit should preserve the old profile JSON");
    assert.deepEqual(fs.readFileSync(imagePath), oldImage, "A failed profile commit should restore the old image payload");
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}
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
assert.ok(Math.abs(partySync.replayDecision({ masterTime: 42, playing: true, sentAt: Date.now() - 3000 }, {}).masterTime - 45) < 0.25, "Watch party replay sync should project the host clock forward while playing");
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

const boundedWorkSandbox = vm.runInNewContext(`(() => {
  ${[
    "mapWithConcurrencyStable",
    "getOrCreateInFlightRefresh",
    "buildLatestCarDataRequest",
    "settleWithTimeout",
    "createBoundedBufferAccumulator",
  ].map((name) => extractNamedFunction(mainProcess, name)).join("\n")}
  return { mapWithConcurrencyStable, getOrCreateInFlightRefresh, buildLatestCarDataRequest, settleWithTimeout, createBoundedBufferAccumulator };
})()`, {
  Buffer,
  URL,
  openF1ApiUrl: (_endpoint, params) => params,
});

let releaseSharedRefresh;
let sharedRefreshRuns = 0;
const refreshes = new Map();
const sharedRefresh = () => {
  sharedRefreshRuns += 1;
  return new Promise((resolve) => { releaseSharedRefresh = resolve; });
};
const sharedA = boundedWorkSandbox.getOrCreateInFlightRefresh(refreshes, "2026", sharedRefresh);
const sharedB = boundedWorkSandbox.getOrCreateInFlightRefresh(refreshes, "2026", sharedRefresh);
assert.equal(sharedA, sharedB, "Same-season F1 TV library calls should share one in-flight refresh");
assert.equal(sharedRefreshRuns, 1, "Same-season F1 TV library calls should start one refresh");
releaseSharedRefresh("ready");
assert.deepEqual(await Promise.all([sharedA, sharedB]), ["ready", "ready"]);
assert.equal(refreshes.size, 0, "Completed F1 TV refreshes should clean up their own in-flight entry");
let releaseSupersededRefresh;
const superseded = boundedWorkSandbox.getOrCreateInFlightRefresh(
  refreshes,
  "2025",
  () => new Promise((resolve) => { releaseSupersededRefresh = resolve; }),
);
const replacementRefresh = Promise.resolve("replacement");
refreshes.set("2025", replacementRefresh);
releaseSupersededRefresh("old");
await superseded;
assert.equal(refreshes.get("2025"), replacementRefresh, "Older F1 TV refresh cleanup should not delete a replacement promise");
refreshes.delete("2025");

let activeBoundedWork = 0;
let peakBoundedWork = 0;
const boundedResolvers = [];
const stableDetailWork = boundedWorkSandbox.mapWithConcurrencyStable(
  Array.from({ length: 8 }, (_, index) => index),
  4,
  async (index) => {
    activeBoundedWork += 1;
    peakBoundedWork = Math.max(peakBoundedWork, activeBoundedWork);
    await new Promise((resolve) => boundedResolvers.push(resolve));
    activeBoundedWork -= 1;
    return index;
  },
);
await new Promise((resolve) => setImmediate(resolve));
assert.equal(peakBoundedWork, 4, "F1 TV/news detail work should cap concurrency at four");
while (boundedResolvers.length) {
  boundedResolvers.splice(0).forEach((resolve) => resolve());
  await new Promise((resolve) => setImmediate(resolve));
}
assert.deepEqual(Array.from(await stableDetailWork), [0, 1, 2, 3, 4, 5, 6, 7], "Bounded detail work should preserve input order");

const deadlineClock = { now: 0 };
const deadlineWorkSandbox = vm.runInNewContext(`(() => {
  ${extractNamedFunction(mainProcess, "mapWithConcurrencyStableDeadline")}
  return { mapWithConcurrencyStableDeadline };
})()`, { setTimeout, clearTimeout });
let activeDeadlineWork = 0;
let peakDeadlineWork = 0;
const deadlineStarts = [];
const partialDeadlineResults = await deadlineWorkSandbox.mapWithConcurrencyStableDeadline(
  Array.from({ length: 32 }, (_, index) => index),
  4,
  12000,
  async (value, _index, remainingMs) => {
    activeDeadlineWork += 1;
    peakDeadlineWork = Math.max(peakDeadlineWork, activeDeadlineWork);
    deadlineStarts.push({ value, startedAt: deadlineClock.now, remainingMs });
    deadlineClock.now += Math.min(1000, remainingMs);
    await Promise.resolve();
    activeDeadlineWork -= 1;
    return value;
  },
  () => deadlineClock.now,
);
assert.equal(peakDeadlineWork, 4, "Deadline-bound F1 TV detail work should retain the four-request concurrency cap");
assert.ok(deadlineClock.now <= 12000, "F1 TV detail scheduling should stop by the overall 12-second deadline");
assert.ok(partialDeadlineResults.length > 0 && partialDeadlineResults.length < 32, "Deadline-bound detail work should return partial results");
assert.deepEqual(Array.from(partialDeadlineResults), Array.from({ length: partialDeadlineResults.length }, (_, index) => index), "Deadline-bound detail work should preserve stable partial order");
assert.ok(deadlineStarts.every((item) => item.remainingMs <= 12000 - item.startedAt), "Each F1 TV detail request should receive no more than its remaining deadline");

const hardDeadlineClock = { now: 0 };
const hardDeadlineTimers = [];
const hardDeadlineControls = [];
const hardDeadlineUnhandled = [];
const onHardDeadlineUnhandled = (error) => hardDeadlineUnhandled.push(error);
process.on("unhandledRejection", onHardDeadlineUnhandled);
const hardDeadlineWork = deadlineWorkSandbox.mapWithConcurrencyStableDeadline(
  Array.from({ length: 8 }, (_, index) => index),
  4,
  12000,
  (value) => new Promise((resolve, reject) => hardDeadlineControls.push({ value, resolve, reject })),
  () => hardDeadlineClock.now,
  (callback, delay) => {
    hardDeadlineTimers.push({ callback, delay });
    return hardDeadlineTimers.length;
  },
  () => {},
);
await Promise.resolve();
assert.equal(hardDeadlineControls.length, 4, "Hard-deadline mapper should start at most four active CMS details");
assert.equal(hardDeadlineTimers.length, 1, "Hard-deadline mapper should install one pool-level deadline timer");
assert.equal(hardDeadlineTimers[0].delay, 12000, "Pool-level CMS deadline should be scheduled for the remaining 12 seconds");
hardDeadlineClock.now = 12000;
hardDeadlineTimers[0].callback();
const hardDeadlineResult = await hardDeadlineWork;
assert.deepEqual(Array.from(hardDeadlineResult), [], "Hard deadline should return a stable partial result without awaiting active details");
assert.equal(hardDeadlineControls.length, 4, "Hard deadline should prevent scheduling additional CMS details");
hardDeadlineControls[0].resolve(0);
hardDeadlineControls[1].reject(new Error("late detail rejection"));
hardDeadlineControls[2].resolve(2);
hardDeadlineControls[3].reject(new Error("second late detail rejection"));
await new Promise((resolve) => setImmediate(resolve));
process.off("unhandledRejection", onHardDeadlineUnhandled);
assert.deepEqual(Array.from(hardDeadlineResult), [], "Late CMS detail settlements should not mutate the returned partial result");
assert.deepEqual(hardDeadlineUnhandled, [], "Late CMS detail rejections should remain handled after the pool deadline");

const actualF1TvLibraryStats = { runs: 0, release: null };
const actualF1TvLibrarySandbox = vm.runInNewContext(`(() => {
  const f1TvLibraryRefreshes = new Map();
  function f1TvLibraryCacheEntry() { return null; }
  function refreshF1TvLibrary(year) {
    actualF1TvLibraryStats.runs += 1;
    return new Promise((resolve) => { actualF1TvLibraryStats.release = () => resolve({ season: year, races: [] }); });
  }
  ${extractNamedFunction(mainProcess, "getOrCreateInFlightRefresh")}
  ${extractNamedFunction(mainProcess, "getF1TvLibrary")}
  return { getF1TvLibrary };
})()`, { actualF1TvLibraryStats });
const actualLibraryA = actualF1TvLibrarySandbox.getF1TvLibrary({ season: 2026, forceRefresh: true });
const actualLibraryB = actualF1TvLibrarySandbox.getF1TvLibrary({ season: 2026, forceRefresh: true });
assert.equal(actualF1TvLibraryStats.runs, 1, "Actual F1 TV library path should start one refresh per season");
actualF1TvLibraryStats.release();
assert.deepEqual(
  JSON.parse(JSON.stringify(await Promise.all([actualLibraryA, actualLibraryB]))),
  [{ season: "2026", races: [] }, { season: "2026", races: [] }],
  "Actual same-season F1 TV library calls should share the keyed refresh result",
);

const cmsDeadlineClock = { now: 0 };
const cmsDeadlineStats = { active: 0, peak: 0, calls: [] };
const cmsDeadlineSandbox = vm.runInNewContext(`(() => {
  const F1TV_CMS_DETAIL_PAGE_LIMIT = 32;
  const F1TV_CMS_DETAIL_TIMEOUT_MS = 3000;
  const F1TV_CMS_DETAIL_CONCURRENCY = 4;
  const F1TV_CMS_DETAIL_DEADLINE_MS = 12000;
  const Date = { now: () => cmsDeadlineClock.now };
  async function getF1TvPlaybackToken() { return ""; }
  function f1TvPlaybackHeaders() { return {}; }
  function f1TvCmsSeasonPageUrl() { return "season"; }
  function f1TvCmsDetailPageUrisFromPage() { return Array.from({ length: 32 }, (_, index) => "detail-" + index); }
  function f1TvCmsUrl(uri) { return uri; }
  function f1TvCmsContentItemsFromPage(page) { return page.items || []; }
  async function fetchF1TvCmsJson(target, _headers, timeoutMs) {
    if (target === "season") return { items: [] };
    cmsDeadlineStats.active += 1;
    cmsDeadlineStats.peak = Math.max(cmsDeadlineStats.peak, cmsDeadlineStats.active);
    cmsDeadlineStats.calls.push({ target, timeoutMs, startedAt: cmsDeadlineClock.now });
    cmsDeadlineClock.now += Math.min(1000, timeoutMs);
    await Promise.resolve();
    cmsDeadlineStats.active -= 1;
    return { items: [target] };
  }
  ${extractNamedFunction(mainProcess, "mapWithConcurrencyStable")}
  ${extractNamedFunction(mainProcess, "mapWithConcurrencyStableDeadline")}
  ${extractNamedFunction(mainProcess, "fetchF1TvCmsSeasonContent")}
  return { fetchF1TvCmsSeasonContent };
})()`, { cmsDeadlineClock, cmsDeadlineStats, setTimeout, clearTimeout });
const cmsPartialItems = await cmsDeadlineSandbox.fetchF1TvCmsSeasonContent("2026");
assert.equal(cmsDeadlineStats.peak, 4, "Actual F1 TV CMS detail path should cap production concurrency at four");
assert.ok(cmsDeadlineClock.now <= 12000, "Actual F1 TV CMS detail scheduling should stop within 12 seconds");
assert.ok(
  cmsDeadlineStats.calls.every((call) => call.timeoutMs <= Math.max(0, 12000 - call.startedAt)),
  "Actual F1 TV CMS detail timeouts should not exceed the remaining overall deadline",
);
assert.ok(cmsPartialItems.length > 0 && cmsPartialItems.length < 32, "Actual F1 TV CMS detail path should return partial results at the deadline");
assert.deepEqual(
  Array.from(cmsPartialItems),
  Array.from({ length: cmsPartialItems.length }, (_, index) => `detail-${index}`),
  "Actual F1 TV CMS detail path should preserve stable partial order",
);

const liveCarRange = boundedWorkSandbox.buildLatestCarDataRequest(
  { session_key: 101, date_start: "2026-07-23T17:00:00.000Z", date_end: "2026-07-23T20:00:00.000Z" },
  Date.parse("2026-07-23T18:00:00.000Z"),
);
const completedCarRange = boundedWorkSandbox.buildLatestCarDataRequest(
  { session_key: 202, date_start: "2026-07-22T17:00:00.000Z", date_end: "2026-07-22T19:00:00.000Z" },
  Date.parse("2026-07-23T18:00:00.000Z"),
);
for (const [range, endIso] of [
  [liveCarRange, "2026-07-23T18:00:00.000Z"],
  [completedCarRange, "2026-07-22T19:00:00.000Z"],
]) {
  assert.equal(Date.parse(range["date<"]) - Date.parse(range["date>"]), 120000, "Latest car_data requests should span exactly two minutes");
  assert.equal(range["date<"], endIso, "Latest car_data requests should end at min(now, session.date_end)");
}

let timeoutCallback;
let cancelCount = 0;
let rejectLateReadiness;
const pendingReadiness = new Promise((_resolve, reject) => { rejectLateReadiness = reject; });
const readiness = boundedWorkSandbox.settleWithTimeout(
  pendingReadiness,
  5000,
  (callback, delay) => {
    assert.equal(delay, 5000, "Electron components readiness should use the five-second bound");
    timeoutCallback = callback;
    return 1;
  },
  () => { cancelCount += 1; },
);
timeoutCallback();
assert.deepEqual(
  JSON.parse(JSON.stringify(await readiness)),
  { ok: false, timedOut: true },
  "A never-settling Electron components promise should return degraded timeout status",
);
rejectLateReadiness(new Error("late failure"));
await new Promise((resolve) => setImmediate(resolve));
assert.equal(cancelCount, 0, "A timed-out readiness promise should not let late settlement mutate timer state");
assert.match(
  extractNamedFunction(mainProcess, "ensureElectronComponentsReady"),
  /try\s*\{[\s\S]*components\.whenReady\(\)[\s\S]*\}\s*catch[\s\S]*degraded/,
  "Synchronous Electron components readiness failures should also produce degraded status",
);
const componentTimers = [];
let resolveLateComponents;
const lateComponentsPromise = new Promise((resolve) => { resolveLateComponents = resolve; });
const lateComponentsSandbox = vm.runInNewContext(`(() => {
  let electronComponentsStatus = null;
  let electronComponentsReadyGeneration = 0;
  const ELECTRON_COMPONENTS_READY_TIMEOUT_MS = 5000;
  const components = {
    whenReady: () => lateComponentsPromise,
    status: () => ({ ready: true, source: "late" }),
  };
  function writePitWallDebugLog() {}
  ${extractNamedFunction(mainProcess, "settleWithTimeout")}
  ${extractNamedFunction(mainProcess, "ensureElectronComponentsReady")}
  return {
    ensureElectronComponentsReady,
    status: () => electronComponentsStatus,
  };
})()`, {
  lateComponentsPromise,
  setTimeout: (callback, delay) => {
    componentTimers.push({ callback, delay });
    return componentTimers.length;
  },
  clearTimeout: () => {},
});
const lateComponentsReadiness = lateComponentsSandbox.ensureElectronComponentsReady();
assert.equal(componentTimers[0].delay, 5000, "Actual Electron readiness wiring should retain the five-second timer");
componentTimers[0].callback();
await lateComponentsReadiness;
assert.equal(lateComponentsSandbox.status().degraded, true, "Timed-out Electron components should initially report degraded status");
resolveLateComponents();
await new Promise((resolve) => setImmediate(resolve));
assert.deepEqual(
  JSON.parse(JSON.stringify(lateComponentsSandbox.status())),
  { ready: true, source: "late" },
  "Late Electron components success should safely refresh status after degraded startup",
);
assert.match(
  extractNamedFunction(mainProcess, "ensureElectronComponentsReady"),
  /electronComponentsReadyGeneration[\s\S]*generation[\s\S]*components\.status/,
  "Late Electron components completion should be identity-guarded against stale readiness invocations",
);

const MEDIA_LIMIT = 64 * 1024 * 1024;
const atMediaLimit = boundedWorkSandbox.createBoundedBufferAccumulator(MEDIA_LIMIT);
atMediaLimit.add(Buffer.alloc(MEDIA_LIMIT));
assert.equal(atMediaLimit.finalize().byteLength, MEDIA_LIMIT, "Media buffering should accept the exact 64 MiB boundary");
assert.equal(atMediaLimit.retainedChunkCount, 0, "Media accumulation should release chunks after finalization");
let mediaAbortCount = 0;
const aboveMediaLimit = boundedWorkSandbox.createBoundedBufferAccumulator(MEDIA_LIMIT, () => { mediaAbortCount += 1; });
aboveMediaLimit.add(Buffer.alloc(MEDIA_LIMIT));
assert.throws(() => aboveMediaLimit.add(Buffer.alloc(1)), /64 MiB|too large/i, "Media buffering should abort one byte above 64 MiB");
assert.equal(mediaAbortCount, 1, "Over-limit media buffering should invoke its transport abort hook once");
assert.equal(aboveMediaLimit.retainedChunkCount, 0, "Over-limit media accumulation should release buffered chunks");
const reusableMediaChunk = Buffer.alloc(1024 * 1024);
for (let index = 0; index < 200; index += 1) {
  const accumulator = boundedWorkSandbox.createBoundedBufferAccumulator(MEDIA_LIMIT);
  accumulator.add(reusableMediaChunk);
  assert.equal(accumulator.finalize().byteLength, reusableMediaChunk.length);
  assert.equal(accumulator.retainedChunkCount, 0, "Sequential media responses should retain no chunks after finalization");
}
const mediaRequestSandbox = vm.runInNewContext(`(() => {
  const MAX_BUFFERED_MEDIA_BYTES = 64 * 1024 * 1024;
  const F1TV_MEDIA_CDN_HOSTS = new Set(["f1prodlive.akamaized.net"]);
  const F1TV_HOME_URL = "https://f1tv.formula1.com/";
  ${[
    "isF1TvMediaUrl",
    "sanitizeProxyRequestHeaders",
    "createBoundedBufferAccumulator",
    "requestBuffer",
    "bufferToArrayBuffer",
  ].map((name) => extractNamedFunction(mainProcess, name)).join("\n")}
  return { requestBuffer, bufferToArrayBuffer };
})()`, {
  Buffer,
  URL,
  process: { versions: { chrome: "120.0.0.0" } },
  http: {},
  https: {},
});
const { EventEmitter } = require("node:events");
function mediaTransportFixture(headers, chunks) {
  let requestDestroyed = false;
  let responseDestroyed = false;
  const response = new EventEmitter();
  response.headers = headers;
  response.statusCode = 200;
  response.resume = () => {};
  response.destroy = (error) => {
    if (responseDestroyed) return;
    responseDestroyed = true;
    if (error) response.emit("error", error);
  };
  const request = new EventEmitter();
  request.write = () => {};
  request.destroy = (error) => {
    if (requestDestroyed) return;
    requestDestroyed = true;
    if (error) request.emit("error", error);
  };
  request.end = () => {
    fixture.transportCallback(response);
    for (const chunk of chunks) {
      if (responseDestroyed) break;
      response.emit("data", chunk);
    }
    if (!responseDestroyed) response.emit("end");
  };
  const fixture = {
    transportCallback: null,
    transport: {
      request(_parsed, _options, callback) {
        fixture.transportCallback = callback;
        return request;
      },
    },
    requestDestroyed: () => requestDestroyed,
    responseDestroyed: () => responseDestroyed,
  };
  return fixture;
}
const declaredOverflow = mediaTransportFixture({ "content-length": String(MEDIA_LIMIT + 1) }, []);
await assert.rejects(
  mediaRequestSandbox.requestBuffer("https://f1tv.formula1.com/declared.bin", { transport: declaredOverflow.transport }),
  /64 MiB|too large/i,
);
assert.equal(declaredOverflow.requestDestroyed(), true, "Declared over-limit media should destroy the request");
assert.equal(declaredOverflow.responseDestroyed(), true, "Declared over-limit media should destroy the response");
const streamedOverflow = mediaTransportFixture({}, [Buffer.alloc(MEDIA_LIMIT), Buffer.alloc(1)]);
await assert.rejects(
  mediaRequestSandbox.requestBuffer("https://f1tv.formula1.com/streamed.bin", { transport: streamedOverflow.transport }),
  /64 MiB|too large/i,
);
assert.equal(streamedOverflow.requestDestroyed(), true, "Streamed over-limit media should destroy the request");
assert.equal(streamedOverflow.responseDestroyed(), true, "Streamed over-limit media should destroy the response");
const pooledMediaBuffer = Buffer.from([9, 1, 2, 3, 8]).subarray(1, 4);
const pooledArrayBuffer = mediaRequestSandbox.bufferToArrayBuffer(pooledMediaBuffer);
assert.equal(pooledArrayBuffer.byteLength, 3, "Media ArrayBuffer conversion should expose only the Buffer subarray length");
assert.deepEqual(Array.from(new Uint8Array(pooledArrayBuffer)), [1, 2, 3], "Media ArrayBuffer conversion should not expose pooled backing bytes");

const replayCarDataSandbox = vm.runInNewContext(`(() => {
  const REPLAY_CAR_DATA_CHUNK_MS = 120000;
  const REPLAY_CAR_DATA_CACHE_MS = 300000;
  const REPLAY_CAR_DATA_CACHE_LIMIT = 24;
  let replayCarDataChunkCache = new Map();
  ${[
    "pruneBoundedMap",
    "replayCarDataChunkStarts",
    "getReplayCarDataChunk",
    "getReplayCarDataSnapshot",
  ].map((name) => extractNamedFunction(mainProcess, name)).join("\n")}
  return {
    getReplayCarDataSnapshot,
    cacheSize: () => replayCarDataChunkCache.size,
  };
})()`, {
  Date,
  openF1ApiUrl: (_endpoint, params) => params,
  replayRowDateMs: (row) => Date.parse(row?.date || ""),
});
let replayRequests = 0;
let replayBytes = 0;
const replayFetch = async (params) => {
  replayRequests += 1;
  replayBytes += 1024 * 1024;
  const start = Date.parse(params["date>"]);
  return Array.from({ length: 120 }, (_, index) => ({
    session_key: params.session_key,
    date: new Date(start + index * 1000).toISOString(),
  }));
};
const replayStart = Date.parse("2026-07-23T18:00:00.000Z");
for (let bucket = 0; bucket < 120; bucket += 1) {
  const target = replayStart + bucket * 5000;
  const rows = await replayCarDataSandbox.getReplayCarDataSnapshot("session-a", target, 2500, replayStart, {
    fetchJson: replayFetch,
    nowMs: 1000,
  });
  assert.ok(rows.every((row) => {
    const time = Date.parse(row.date);
    return time >= target + 2500 - 120000 && time < target + 2500 + 1000;
  }), "Replay car_data cache should slice each five-second snapshot to its requested bounds");
}
assert.ok(replayRequests <= 6, "Ten replay minutes should use at most six aligned OpenF1 car_data chunks");
assert.ok(replayBytes <= 6 * 1024 * 1024, "Ten replay minutes should fetch at most six synthetic MiB");
const nonalignedReplayStart = Date.parse("2026-07-23T18:00:30.000Z");
const nonalignedRequestsBefore = replayRequests;
const nonalignedBytesBefore = replayBytes;
for (let bucket = 0; bucket < 120; bucket += 1) {
  const target = nonalignedReplayStart + bucket * 5000;
  const rows = await replayCarDataSandbox.getReplayCarDataSnapshot("session-nonaligned", target, 2500, nonalignedReplayStart, {
    fetchJson: replayFetch,
    nowMs: 1000,
  });
  assert.ok(rows.every((row) => {
    const time = Date.parse(row.date);
    return time >= target + 2500 - 120000 && time < target + 2500 + 1000;
  }), "Nonaligned replay chunks should preserve exact adjusted target slicing");
}
assert.equal(replayRequests - nonalignedRequestsBefore, 6, "Ten replay minutes from a nonaligned session start should use six OpenF1 car_data chunks");
assert.equal(replayBytes - nonalignedBytesBefore, 6 * 1024 * 1024, "Nonaligned ten-minute replay should fetch six synthetic MiB");
const priorOffsetRequests = replayRequests;
await replayCarDataSandbox.getReplayCarDataSnapshot("session-nonaligned", nonalignedReplayStart, 7500, nonalignedReplayStart, {
  fetchJson: replayFetch,
  nowMs: 1000,
});
assert.ok(replayRequests > priorOffsetRequests, "Replay car_data cache should isolate different clock offsets within one session");
const priorOriginRequests = replayRequests;
await replayCarDataSandbox.getReplayCarDataSnapshot("session-nonaligned", nonalignedReplayStart, 2500, nonalignedReplayStart + 30000, {
  fetchJson: replayFetch,
  nowMs: 1000,
});
assert.ok(replayRequests > priorOriginRequests, "Replay car_data cache should isolate different chunk origins within one session and offset");
const priorSessionRequests = replayRequests;
await replayCarDataSandbox.getReplayCarDataSnapshot("session-b", replayStart, 2500, replayStart, { fetchJson: replayFetch, nowMs: 1000 });
assert.ok(replayRequests > priorSessionRequests, "Replay car_data cache should not reuse chunks across sessions");
const priorExpiryRequests = replayRequests;
await replayCarDataSandbox.getReplayCarDataSnapshot("session-a", replayStart, 2500, replayStart, { fetchJson: replayFetch, nowMs: 301001 });
assert.ok(replayRequests > priorExpiryRequests, "Expired replay car_data chunks should refetch");
for (let index = 0; index < 30; index += 1) {
  await replayCarDataSandbox.getReplayCarDataSnapshot(`bounded-session-${index}`, replayStart, 0, replayStart, { fetchJson: replayFetch, nowMs: 400000 });
}
assert.ok(replayCarDataSandbox.cacheSize() <= 24, "Replay car_data cache should remain bounded");

let invariantBoundsBuilds = 0;
let invariantTraceBuilds = 0;
const trackMapInvariantSandbox = vm.runInNewContext(`(() => {
  const f1TimingTrackMapInvariantCache = new WeakMap();
  function f1TimingPositionBounds() { invariantBoundsBuilds += 1; return { minX: 0, maxX: 10, minY: 0, maxY: 10 }; }
  function f1TimingPositionSamplePoints() { invariantTraceBuilds += 1; return [{ x: 0, y: 0 }, { x: 10, y: 10 }]; }
  ${extractNamedFunction(mainProcess, "getTrackMapInvariantPositionData")}
  return {
    getTrackMapInvariantPositionData,
    get invariantBoundsBuilds() { return invariantBoundsBuilds; },
    get invariantTraceBuilds() { return invariantTraceBuilds; },
  };
})()`, {
  invariantBoundsBuilds: 0,
  invariantTraceBuilds: 0,
});
const immutablePositionEntries = [];
const firstInvariant = trackMapInvariantSandbox.getTrackMapInvariantPositionData({ positionEntries: immutablePositionEntries }, 10);
const secondInvariant = trackMapInvariantSandbox.getTrackMapInvariantPositionData({ positionEntries: immutablePositionEntries }, 20);
assert.equal(firstInvariant, secondInvariant, "Track Map invariant position data should be reused while target time changes");
assert.equal(trackMapInvariantSandbox.invariantBoundsBuilds, 1, "Track Map position bounds should build once per immutable entry set");
assert.equal(trackMapInvariantSandbox.invariantTraceBuilds, 1, "Track Map driver trace should build once per immutable entry set");
trackMapInvariantSandbox.getTrackMapInvariantPositionData({ positionEntries: [] });
assert.equal(trackMapInvariantSandbox.invariantBoundsBuilds, 2, "Track Map invariant cache should not cross session entry identities");

assert.match(trackMapSource, /function buildTrackMapInvariantModel/, "Track Map should isolate its circuit, facts, and replay-session model");
assert.match(
  trackMapSource,
  /useMemo\(\(\) => buildTrackMapInvariantModel\(data, selectedRaceKey\), \[data\.schedule, data\.sessions, data\.race, timing\.length, selectedRaceKey\]\)/,
  "Track Map should memoize invariant screen data independently of replay progress"
);
assert.match(trackMapSource, /function staticTrackMapPropsEqual/, "Track Map should expose a real memo comparator for static subtrees");
assert.match(trackMapSource, /function staticTrackMapSessionControlsEqual/, "Track Map should ignore callback churn at its static session-control boundary");
assert.match(trackMapSource, /React\.memo\(HeaderIdentity, staticTrackMapPropsEqual\)/, "Track Map should memoize static header identity");
assert.match(trackMapSource, /React\.memo\(HeaderSessionControls, staticTrackMapSessionControlsEqual\)/, "Track Map should memoize replay session controls separately from progress");
assert.match(trackMapSource, /React\.memo\(HeaderSessionStatus, staticTrackMapPropsEqual\)/, "Track Map should memoize header status separately from progress");
assert.match(trackMapSource, /React\.memo\(CircuitFacts, staticTrackMapPropsEqual\)/, "Track Map should memoize circuit facts");
assert.match(trackMapSource, /const layers = useMemo\(\(\) => \(\{ turns: true, names: true, sectors: true, start: true \}\), \[\]\);/, "Track Map should keep layer props stable across replay ticks");
{
  const staticTrackMapPropsEqual = vm.runInNewContext(`(${extractNamedFunction(trackMapSource, "staticTrackMapPropsEqual")})`);
  const staticTrackMapSessionControlsEqual = vm.runInNewContext(`(${extractNamedFunction(trackMapSource, "staticTrackMapSessionControlsEqual")})`);
  let staticHeaderRenders = 0;
  let sessionControlRenders = 0;
  let previousStaticProps = null;
  let previousSessionProps = null;
  const progressFrames = [];
  for (let tick = 0; tick < 10; tick += 1) {
    const staticProps = { round: 1, gp: "Australian Grand Prix", name: "Albert Park", loc: "Melbourne" };
    const sessionProps = {
      races: immutablePositionEntries,
      selectedRaceKey: "1",
      replayActive: true,
      replayLoading: false,
      canLoadReplay: false,
      onSelectRace: () => tick,
      onLoadReplay: () => tick,
    };
    if (!previousStaticProps || !staticTrackMapPropsEqual(previousStaticProps, staticProps)) {
      staticHeaderRenders += 1;
      previousStaticProps = staticProps;
    }
    if (!previousSessionProps || !staticTrackMapSessionControlsEqual(previousSessionProps, sessionProps)) {
      sessionControlRenders += 1;
      previousSessionProps = sessionProps;
    }
    progressFrames.push(tick / 10);
  }
  assert.equal(staticHeaderRenders, 1, "Ten replay ticks should cross the static header memo boundary only once");
  assert.equal(sessionControlRenders, 1, "Ten replay ticks should skip session-control renders despite fresh callback closures");
  assert.deepEqual(progressFrames, [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9], "Dynamic Track Map progress should still render all ten 10Hz frames");
}
assert.match(trackMapSource, /const TRACK_MAP_REPLAY_TICK_MS = 100;/, "Track Map replay playback timing should remain at 10Hz");
assert.match(trackMapSource, /function createReplayElapsedClock/, "Track Map should isolate visual replay time in a dedicated narrow clock");
assert.match(trackMapSource, /function TrackMapDynamicReplayStage/, "Track Map should isolate dynamic replay rendering in a dedicated stage");
{
  const outerTrackMapSource = extractNamedFunction(trackMapSource.slice(trackMapSource.indexOf("function TrackMap()")), "TrackMap");
  const dynamicReplayStageSource = extractNamedFunction(trackMapSource, "TrackMapDynamicReplayStage");
  assert.doesNotMatch(outerTrackMapSource, /useState|setInterval|setReplay/, "Outer TrackMap should not own replay tick state or its interval");
  assert.match(outerTrackMapSource, /<TrackMapDynamicReplayStage/, "Outer TrackMap should render the dedicated dynamic stage");
  assert.match(dynamicReplayStageSource, /createReplayElapsedClock[\s\S]*TrackMapView[\s\S]*TimingTower/, "Dynamic replay stage should use the narrow elapsed clock beside map and timing data");
  assert.doesNotMatch(dynamicReplayStageSource, /elapsedSeconds:\s*current\.elapsedSeconds \+ delta/, "Dynamic replay stage should not commit replay state on every visual tick");
  const createReplayElapsedClock = vm.runInNewContext(
    `(${extractNamedFunction(trackMapSource, "createReplayElapsedClock")})`,
    { TRACK_MAP_REPLAY_TICK_MS: 100, TRACK_MAP_REPLAY_DATA_POLL_MS: 1000, Set }
  );
  let now = 0;
  let intervalCallback = null;
  let cleared = false;
  let visualTicks = 0;
  let mapRenders = 0;
  let towerRenders = 0;
  const commits = [];
  const clock = createReplayElapsedClock(0, (elapsedSeconds, bucket) => {
    commits.push({ elapsedSeconds, bucket });
    mapRenders += 1;
    towerRenders += 1;
  }, {
    now: () => now,
    setInterval: (callback, delay) => {
      assert.equal(delay, 100, "Narrow replay clock should retain the 100ms visual interval");
      intervalCallback = callback;
      return 42;
    },
    clearInterval: (id) => {
      assert.equal(id, 42);
      cleared = true;
    },
  });
  clock.subscribe(() => { visualTicks += 1; });
  clock.start();
  for (let tick = 0; tick < 100; tick += 1) {
    now += 100;
    intervalCallback();
  }
  assert.equal(visualTicks, 100, "Narrow replay progress should render all 100 visual ticks");
  assert.equal(commits.length, 10, "Ten seconds should promote elapsed state only at ten one-second data buckets");
  assert.deepEqual(commits.map((entry) => entry.bucket), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10], "Elapsed state commits should follow exact data-poll buckets");
  assert.equal(mapRenders, 10, "TrackMapView reconciliation should follow bucket commits, not 100ms visual ticks");
  assert.equal(towerRenders, 10, "TimingTower reconciliation should follow bucket commits, not 100ms visual ticks");
  clock.pause();
  const pausedTicks = visualTicks;
  now += 1000;
  intervalCallback();
  assert.equal(visualTicks, pausedTicks, "Paused replay should not advance the narrow clock");
  clock.seek(42.35);
  assert.equal(clock.getElapsedSeconds(), 42.35, "Seek should resynchronize the exact visual and promoted elapsed time");
  assert.deepEqual(commits.at(-1), { elapsedSeconds: 42.35, bucket: 42 }, "Seek should immediately commit its exact IPC poll time");
  clock.start();
  for (let tick = 0; tick < 3; tick += 1) {
    now += 100;
    intervalCallback();
  }
  clock.pause();
  assert.ok(Math.abs(commits.at(-1).elapsedSeconds - 42.65) < 1e-9, "Pause should promote the exact partial-bucket elapsed time");
  clock.stop();
  assert.equal(cleared, true, "Dynamic replay stage should clear its interval on unmount");
}

const f1TvTokenSandbox = vm.runInNewContext(`(() => {
  ${[
    "decodeF1TvJwtPayload",
    "isF1TvSubscriptionToken",
    "f1TvSubscriptionTokenFromLoginSessionCookie",
  ].map((name) => extractNamedFunction(mainProcess, name)).join("\n")}
  return { decodeF1TvJwtPayload, isF1TvSubscriptionToken, f1TvSubscriptionTokenFromLoginSessionCookie };
})()`, { Buffer });
const fakeJwt = (payload) => `head.${Buffer.from(JSON.stringify(payload)).toString("base64url")}.sig`;
const fakeSubscriptionToken = fakeJwt({ SessionId: "ascendon-session", iat: 1781035164 });
const fakeEntitlementToken = fakeJwt({ entitlementId: "playback-entitlement", exp: 1812571200 });
assert.equal(
  f1TvTokenSandbox.f1TvSubscriptionTokenFromLoginSessionCookie([{ name: "login-session", value: encodeURIComponent(JSON.stringify({ data: { subscriptionToken: fakeSubscriptionToken } })) }]),
  fakeSubscriptionToken,
  "Formula 1 SignalR Core timing auth should read the subscription token from the login-session cookie",
);
assert.equal(f1TvTokenSandbox.isF1TvSubscriptionToken(fakeSubscriptionToken), true, "Formula 1 SignalR Core timing auth should accept subscription tokens with a SessionId");
assert.equal(f1TvTokenSandbox.isF1TvSubscriptionToken(fakeEntitlementToken), false, "Formula 1 SignalR Core timing auth should not use the playback entitlement token as the SignalR authToken fallback");

const mergeRowsByKeySandbox = vm.runInNewContext(`(() => {
  ${extractNamedFunction(dataProviderSource, "mergeRowsByKey")}
  ${extractNamedFunction(dataProviderSource, "constructorMetadataRows")}
  return { constructorMetadataRows, mergeRowsByKey };
})()`);
assert.deepEqual(
  JSON.parse(JSON.stringify(mergeRowsByKeySandbox.mergeRowsByKey([
    { abbr: "RBR", name: "Red Bull Racing", color: "var(--team-redbull)", pts: 0 },
    { abbr: "MER", name: "Mercedes", color: "var(--team-mercedes)", pts: 0 },
    { abbr: "FER", name: "Ferrari", color: "var(--team-ferrari)", pts: 0 },
  ], [
    { abbr: "", pos: 1, pts: 277 },
    { abbr: "MER", pos: 2, pts: 244 },
  ], "abbr"))),
  [
    { abbr: "MER", name: "Mercedes", color: "var(--team-mercedes)", pos: 2, pts: 244 },
    { abbr: "RBR", name: "Red Bull Racing", color: "var(--team-redbull)", pts: 0 },
    { abbr: "FER", name: "Ferrari", color: "var(--team-ferrari)", pts: 0 },
  ],
  "Renderer live-data merge should ignore anonymous constructor rows and keep seeded team identities for missing constructors",
);
assert.deepEqual(
  JSON.parse(JSON.stringify(mergeRowsByKeySandbox.mergeRowsByKey([
    { abbr: "RBR", name: "Red Bull Racing", color: "var(--team-redbull)", pts: 0 },
    { abbr: "MER", name: "Mercedes", color: "var(--team-mercedes)", pts: 0 },
    { abbr: "FER", name: "Ferrari", color: "var(--team-ferrari)", pts: 0 },
  ], [
    { abbr: "MER", pos: 1, pts: 244 },
  ], "abbr", { includeMissing: false }))),
  [
    { abbr: "MER", name: "Mercedes", color: "var(--team-mercedes)", pos: 1, pts: 244 },
  ],
  "Renderer constructor standings merge should not append zero-point seeded teams to a sparse live championship table",
);
assert.deepEqual(
  JSON.parse(JSON.stringify(mergeRowsByKeySandbox.mergeRowsByKey(
    mergeRowsByKeySandbox.constructorMetadataRows([
      { abbr: "MER", name: "Mercedes", color: "var(--team-mercedes)", logo: "mercedes.webp", pts: 0 },
      { abbr: "FER", name: "Ferrari", color: "var(--team-ferrari)", logo: "ferrari.webp", pts: 0 },
      { abbr: "HAS", name: "Haas F1 Team", color: "var(--team-haas)", logo: "haas.webp", pts: 0 },
    ], [
      { abbr: "HAS", name: "Haas F1 Team", color: "var(--team-haas)", logo: "haas.webp", pos: 7, pts: 21 },
    ]),
    [
      { abbr: "MER", pos: 1, pts: 262 },
      { abbr: "FER", pos: 2, pts: 190 },
    ],
    "abbr",
    { includeMissing: false }
  ))),
  [
    { abbr: "MER", name: "Mercedes", color: "var(--team-mercedes)", logo: "mercedes.webp", pos: 1, pts: 262 },
    { abbr: "FER", name: "Ferrari", color: "var(--team-ferrari)", logo: "ferrari.webp", pos: 2, pts: 190 },
  ],
  "Renderer constructor standings merge should preserve seed logos and colors for teams absent from a previous sparse live table",
);
const mergeDataSandbox = vm.runInNewContext(`(() => {
  const window = {
    PW_DATA: {},
    PW_BUILD_PROFILES: (data) => ({
      driverProfiles: Object.fromEntries((data.drivers || []).map((driver) => [driver.code, { ...driver, form: data.driverForm?.[driver.code] || [] }])),
      teamProfiles: [],
      formRounds: data.formRounds || [],
    }),
  };
  const EMPTY_DATA = { drivers: [], byCode: {}, timing: [], standings: [], constructors: [], driverProfiles: {}, teamProfiles: [], driverForm: {}, formRounds: [], schedule: [], sessions: [], news: [], insights: [], battlePairs: [], strategyContext: null, presets: [], copilot: null, race: {}, seasonSummary: {} };
  const SEEDED_CONSTRUCTOR_ROWS = [];
  ${extractNamedFunction(dataProviderSource, "buildByCode")}
  ${extractNamedFunction(dataProviderSource, "mergeRowsByKey")}
  ${extractNamedFunction(dataProviderSource, "constructorMetadataRows")}
  ${extractNamedFunction(dataProviderSource, "mergeCopilotData")}
  ${extractNamedFunction(dataProviderSource, "isCancelledF12026RaceName")}
  ${extractNamedFunction(dataProviderSource, "normalizeScheduleRoundOrder")}
  ${extractNamedFunction(dataProviderSource, "isF12026ScheduleData")}
  ${extractNamedFunction(dataProviderSource, "normalizeScheduleData")}
  ${extractNamedFunction(dataProviderSource, "mergeData")}
  return { mergeData };
})()`);
const sparseRecentFormMerge = mergeDataSandbox.mergeData({
  drivers: [{ code: "ANT", name: "Kimi Antonelli" }],
  driverForm: { ANT: [4, 2] },
  formRounds: [{ rnd: 1, gp: "Opening Grand Prix" }, { rnd: 2, gp: "Second Grand Prix" }],
}, { driverForm: {}, formRounds: [] });
assert.deepEqual(JSON.parse(JSON.stringify(sparseRecentFormMerge.driverForm.ANT || null)), [4, 2], "Renderer live-data merge should keep base recent form when a sparse refresh sends an empty driverForm");
assert.deepEqual(JSON.parse(JSON.stringify(sparseRecentFormMerge.driverProfiles.ANT.form || null)), [4, 2], "Drivers tab profiles should keep recent form positions after a sparse refresh");
const cachedNewsStories = [
  { title: "Cached headline", url: "https://example.test/cached" },
];
assert.deepEqual(
  JSON.parse(JSON.stringify(mergeDataSandbox.mergeData({ news: cachedNewsStories }, { news: [], enrichmentPending: true }).news)),
  cachedNewsStories,
  "Renderer live-data merge should preserve cached news while a core snapshot awaits enrichment",
);
const freshNewsStories = [
  { title: "Fresh headline", url: "https://example.test/fresh" },
];
assert.deepEqual(
  JSON.parse(JSON.stringify(mergeDataSandbox.mergeData({ news: cachedNewsStories }, { news: freshNewsStories, enrichmentPending: false }).news)),
  freshNewsStories,
  "Renderer live-data merge should replace cached news when fresh enrichment returns stories",
);
const liveDataNewsPreservationSandbox = vm.runInNewContext(`(() => {
  ${extractNamedFunction(mainProcess, "newsStorySortTime")}
  ${extractNamedFunction(mainProcess, "selectNewsFeedStories")}
  ${extractNamedFunction(mainProcess, "preserveSnapshotNews")}
  ${extractNamedFunction(mainProcess, "liveDataEnrichmentErrors")}
  return { preserveSnapshotNews, liveDataEnrichmentErrors };
})()`);
assert.deepEqual(
  JSON.parse(JSON.stringify(liveDataNewsPreservationSandbox.preserveSnapshotNews(
    { news: cachedNewsStories },
    { news: [], enrichmentPending: true },
  ).news)),
  cachedNewsStories,
  "Main live-data cache should preserve last-known-good news when the core snapshot has no stories",
);
assert.deepEqual(
  JSON.parse(JSON.stringify(liveDataNewsPreservationSandbox.preserveSnapshotNews(
    { news: cachedNewsStories },
    { news: freshNewsStories, enrichmentPending: false },
  ).news)),
  freshNewsStories,
  "Main live-data cache should replace cached news after a complete fresh enrichment",
);
const cachedNewsBatch = Array.from({ length: 24 }, (_, index) => ({
  title: `Cached headline ${index}`,
  url: `https://example.test/cached/${index}`,
  source: index % 2 ? "Cached A" : "Cached B",
  publishedAt: `2026-07-${String(22 - Math.floor(index / 2)).padStart(2, "0")}T${String(index % 2).padStart(2, "0")}:00:00Z`,
}));
const partialFreshNews = [
  { ...cachedNewsBatch[0], title: "Fresh replacement for cached zero", publishedAt: "2026-07-23T12:00:00Z" },
  ...Array.from({ length: 7 }, (_, index) => ({
    title: `Fresh partial headline ${index}`,
    url: `https://example.test/fresh-partial/${index}`,
    source: "Fresh",
    publishedAt: `2026-07-23T${String(11 - index).padStart(2, "0")}:00:00Z`,
  })),
];
let boundedPartialNews = JSON.parse(JSON.stringify(liveDataNewsPreservationSandbox.preserveSnapshotNews(
  { news: cachedNewsBatch },
  { news: partialFreshNews, enrichmentPending: false },
  { partial: true },
).news));
assert.equal(boundedPartialNews.length, 24, "Partially failed news enrichment should cap merged fresh and cached stories at 24");
assert.equal(new Set(boundedPartialNews.map((story) => story.url)).size, 24, "Partially failed news enrichment should dedupe fresh and cached stories");
assert.equal(boundedPartialNews.filter((story) => story.url === cachedNewsBatch[0].url).length, 1, "Fresh partial stories should replace duplicate cached URLs");
for (let cycle = 0; cycle < 8; cycle += 1) {
  const cycleStories = Array.from({ length: 6 }, (_, index) => ({
    title: `Cycle ${cycle} headline ${index}`,
    url: `https://example.test/cycle/${cycle}/${index}`,
    source: "Fresh",
    publishedAt: `2026-07-23T${String(20 - cycle).padStart(2, "0")}:${String(index).padStart(2, "0")}:00Z`,
  }));
  boundedPartialNews = JSON.parse(JSON.stringify(liveDataNewsPreservationSandbox.preserveSnapshotNews(
    { news: boundedPartialNews },
    { news: cycleStories, enrichmentPending: false },
    { partial: true },
  ).news));
  assert.ok(boundedPartialNews.length <= 24, `Repeated partial-error news cycle ${cycle + 1} should remain capped at 24 stories`);
  assert.equal(new Set(boundedPartialNews.map((story) => story.url)).size, boundedPartialNews.length, `Repeated partial-error news cycle ${cycle + 1} should remain deduplicated`);
}
const liveDataNewsEnrichmentPartial = vm.runInNewContext(`(${extractNamedFunction(mainProcess, "liveDataNewsEnrichmentPartial")})`);
assert.deepEqual(
  JSON.parse(JSON.stringify(liveDataNewsPreservationSandbox.liveDataEnrichmentErrors(
    ["core failed"],
    { errors: ["background failed"] },
  ))),
  ["core failed", "background failed"],
  "Background enrichment source errors should propagate into the completed live snapshot",
);
assert.equal(liveDataNewsEnrichmentPartial({ failedKeys: ["openF1Intervals"] }), false, "Unrelated timing enrichment errors should not retain and grow the prior news feed");
assert.equal(liveDataNewsEnrichmentPartial({ failedKeys: ["formula1News"] }), true, "A failed news source should retain last-known-good stories alongside fresh partial results");
const refreshLiveDataEnrichmentSource = extractNamedFunction(mainProcess, "refreshLiveDataEnrichment");
assert.match(refreshLiveDataEnrichmentSource, /liveDataEnrichmentErrors\(baseErrors,\s*enrichment\)[\s\S]*buildPitWallSnapshot\(raw,\s*enrichmentErrors/, "Background enrichment should pass combined core and background errors into the completed snapshot");
assert.match(refreshLiveDataEnrichmentSource, /preserveSnapshotNews\(baseData,\s*data,\s*\{\s*partial:\s*liveDataNewsEnrichmentPartial\(enrichment\)\s*\}\)/, "Only failed news sources should trigger partial-feed preservation before cache and disk writes");
assert.match(mainProcess, /preserveSnapshotNews\(liveDataCache\?\.data,\s*data\)[\s\S]*writeLiveSnapshotDiskCache\(data\)/, "Core live-data cache and disk writes should preserve cached news before background enrichment");
const enrichmentControls = [];
const enrichmentDiskWrites = [];
const enrichmentNotifications = [];
const overlappingEnrichmentSandbox = vm.runInNewContext(`(() => {
  let liveDataEnrichmentRefresh = null;
  const liveDataEnrichmentRefreshes = new Map();
  let liveDataCache = { createdAt: 0, data: { fetchedAt: "A", enrichmentPending: true, news: [] } };
  const LIVE_BACKGROUND_ENRICHMENT_URLS = {};
  function liveBackgroundEnrichmentUrls() { return LIVE_BACKGROUND_ENRICHMENT_URLS; }
  function fetchLiveDataEntries() {
    return new Promise((resolve) => enrichmentControls.push({ resolve }));
  }
  async function fetchRecentDriverResults() { return null; }
  async function buildPitWallSnapshot(raw, errors) {
    return { fetchedAt: raw.snapshotId, enrichmentPending: false, news: [{ title: raw.snapshotId }], errors };
  }
  function liveDataEnrichmentErrors(baseErrors, enrichment) {
    return [...baseErrors, ...(enrichment.errors || [])];
  }
  function liveDataNewsEnrichmentPartial() { return false; }
  function preserveSnapshotNews(_baseData, data) { return data; }
  function writeLiveSnapshotDiskCache(data) { enrichmentDiskWrites.push(data.fetchedAt); }
  function notifyLiveDataUpdated() { enrichmentNotifications.push(liveDataCache.data.fetchedAt); }
  function writePitWallDebugLog() {}
  ${refreshLiveDataEnrichmentSource}
  return {
    refreshLiveDataEnrichment,
    setCacheData(data) { liveDataCache = { createdAt: 0, data }; },
    cacheData() { return liveDataCache.data; },
    inFlightCount() { return liveDataEnrichmentRefreshes.size; },
  };
})()`, { enrichmentControls, enrichmentDiskWrites, enrichmentNotifications });
const enrichmentA = overlappingEnrichmentSandbox.refreshLiveDataEnrichment(
  { snapshotId: "A" },
  [],
  { fetchedAt: "A", enrichmentPending: true, news: [] },
);
overlappingEnrichmentSandbox.setCacheData({ fetchedAt: "B", enrichmentPending: true, news: [] });
const enrichmentB = overlappingEnrichmentSandbox.refreshLiveDataEnrichment(
  { snapshotId: "B" },
  [],
  { fetchedAt: "B", enrichmentPending: true, news: [] },
);
const duplicateEnrichmentB = overlappingEnrichmentSandbox.refreshLiveDataEnrichment(
  { snapshotId: "B" },
  [],
  { fetchedAt: "B", enrichmentPending: true, news: [] },
);
assert.equal(enrichmentControls.length, 2, "A newer core snapshot should start its own background enrichment while the old snapshot is still in flight");
assert.equal(enrichmentB, duplicateEnrichmentB, "Repeated requests for the same core snapshot should share one enrichment promise");
enrichmentControls[0].resolve({ raw: { snapshotId: "A" }, errors: [] });
await enrichmentA;
assert.deepEqual(
  JSON.parse(JSON.stringify(overlappingEnrichmentSandbox.cacheData())),
  { fetchedAt: "B", enrichmentPending: true, news: [] },
  "Old enrichment completion should not clear or overwrite the newer core snapshot",
);
assert.equal(overlappingEnrichmentSandbox.inFlightCount(), 1, "Old enrichment cleanup should leave the newer snapshot's promise registered");
enrichmentControls[1].resolve({ raw: { snapshotId: "B" }, errors: [] });
await enrichmentB;
assert.equal(overlappingEnrichmentSandbox.cacheData().enrichmentPending, false, "The newer snapshot should clear pending after its own enrichment completes");
assert.deepEqual(enrichmentDiskWrites, ["B"], "Only the current snapshot enrichment should write the live-data disk cache");
assert.deepEqual(enrichmentNotifications, ["B"], "The newer snapshot should emit its own completion notification");
assert.equal(overlappingEnrichmentSandbox.inFlightCount(), 0, "Each enrichment promise should remove only its own keyed in-flight entry");

const liveSyncDefaultSandbox = vm.runInNewContext(`(() => {
  const DEFAULT_WORLD_SYNC_TARGET = 36;
  const DEFAULT_NON_WORLD_SYNC_OFFSET = 0;
  ${extractNamedFunction(liveRacingSource, "clampSyncLatency")}
  function preferredWorldSyncTarget() { return DEFAULT_WORLD_SYNC_TARGET; }
  ${extractNamedFunction(liveRacingSource, "defaultSyncTarget")}
  return { defaultSyncTarget };
})()`);
assert.match(liveRacingSource, /const DEFAULT_NON_WORLD_SYNC_OFFSET = 0;/, "Live onboard panes should not add a default delay behind the world feed");
assert.equal(liveSyncDefaultSandbox.defaultSyncTarget("WORLD", 36), 36, "Live world feed should use the configured sync target");
assert.equal(liveSyncDefaultSandbox.defaultSyncTarget("VER", 36), 36, "Live onboard panes should default to the world sync target instead of lagging the broadcast");

const liveSyncTargetSandbox = vm.runInNewContext(`(() => {
  ${extractNamedFunction(liveRacingSource, "syncLiveVideoToTargetLatency")}
  ${extractNamedFunction(liveRacingSource, "jumpLiveVideoToLiveEdge")}
  return { syncLiveVideoToTargetLatency, jumpLiveVideoToLiveEdge };
})()`);
const targetSeekVideo = {
  currentTime: 72,
  playbackRate: 0.8,
  seekable: { length: 1, start: () => 0, end: () => 100 },
};
const targetSeekResult = liveSyncTargetSandbox.syncLiveVideoToTargetLatency(targetSeekVideo, 36);
assert.equal(targetSeekResult.synced, true, "Live sync target fallback should report when it can seek to the configured latency");
assert.equal(targetSeekVideo.currentTime, 64, "Live sync target fallback should seek backward to match the target latency");
assert.equal(targetSeekVideo.playbackRate, 1, "Live sync target fallback should restore normal playback after seeking to target latency");
const shakaTargetSeekVideo = {
  currentTime: 98,
  playbackRate: 0.8,
  seekable: { length: 0, start: () => 96, end: () => 100 },
  __pitwallShakaPlayer: { seekRange: () => ({ start: 0, end: 100 }) },
};
const shakaTargetSeekResult = liveSyncTargetSandbox.syncLiveVideoToTargetLatency(shakaTargetSeekVideo, 36);
assert.equal(shakaTargetSeekResult.synced, true, "Protected Shaka live sync target should use Shaka's live seek range instead of the video element's shallow buffered range");
assert.equal(shakaTargetSeekVideo.currentTime, 64, "Protected Shaka live sync target should seek to target latency from Shaka's live range");
assert.equal(shakaTargetSeekVideo.playbackRate, 1, "Protected Shaka live sync target should restore normal playback after matching target latency");
const shakaWaitingRangeVideo = {
  currentTime: 98,
  playbackRate: 0.8,
  seekable: { length: 0, start: () => 0, end: () => 0 },
  __pitwallShakaPlayer: { seekRange: () => ({ start: 0, end: NaN }) },
};
const shakaWaitingRangeResult = liveSyncTargetSandbox.syncLiveVideoToTargetLatency(shakaWaitingRangeVideo, 36);
assert.equal(shakaWaitingRangeResult.waitingForRange, true, "Protected Shaka live sync should report when initial target seek must wait for the live range");
let jumpedNativePlayed = false;
const jumpNativeVideo = {
  currentTime: 64,
  playbackRate: 0.8,
  seekable: { length: 1, start: () => 0, end: () => 100 },
  play: () => { jumpedNativePlayed = true; return Promise.resolve(); },
};
const jumpNativeResult = liveSyncTargetSandbox.jumpLiveVideoToLiveEdge(jumpNativeVideo);
assert.equal(jumpNativeResult.synced, true, "Jump to live should report when it can seek to the live edge");
assert.equal(jumpNativeVideo.currentTime, 99.5, "Jump to live should seek a native HLS stream to the live edge");
assert.equal(jumpNativeVideo.playbackRate, 1, "Jump to live should restore normal playback speed");
assert.equal(jumpedNativePlayed, true, "Jump to live should resume a paused stream");
let jumpedShakaPlayed = false;
const jumpShakaVideo = {
  currentTime: 64,
  playbackRate: 0.8,
  seekable: { length: 0, start: () => 96, end: () => 100 },
  __pitwallShakaPlayer: { seekRange: () => ({ start: 0, end: 100 }) },
  play: () => { jumpedShakaPlayed = true; return Promise.resolve(); },
};
const jumpShakaResult = liveSyncTargetSandbox.jumpLiveVideoToLiveEdge(jumpShakaVideo);
assert.equal(jumpShakaResult.synced, true, "Jump to live should use Shaka's live seek range when available");
assert.equal(jumpShakaVideo.currentTime, 99.5, "Jump to live should seek protected Shaka streams to the live edge");
assert.equal(jumpedShakaPlayed, true, "Jump to live should resume protected streams");
assert.match(liveRacingSource, /function liveSyncToleranceForTarget/, "Live sync should use a target-latency tolerance helper for HLS segment cadence");
const liveSyncToleranceSandbox = vm.runInNewContext(`(() => {
  const SHAKA_LIVE_SYNC_TOLERANCE_MIN = 3;
  const SHAKA_LIVE_SYNC_TOLERANCE_MAX = 8;
  ${extractNamedFunction(liveRacingSource, "liveSyncToleranceForTarget")}
  ${extractNamedFunction(liveRacingSource, "shouldSeekLiveVideoToTarget")}
  return { liveSyncToleranceForTarget, shouldSeekLiveVideoToTarget };
})()`);
assert.ok(liveSyncToleranceSandbox.liveSyncToleranceForTarget(36) >= 7.5, "Protected Shaka live sync tolerance should be wide enough for F1 TV HLS segment cadence at a 36s target");
assert.ok(liveSyncToleranceSandbox.liveSyncToleranceForTarget(8) <= 4, "Protected Shaka live sync tolerance should stay bounded for low target latencies");
assert.equal(liveSyncToleranceSandbox.shouldSeekLiveVideoToTarget(5.3, 36, true), true, "Protected Shaka live sync should seek when playback is near live edge instead of sitting at 0.8x");
assert.equal(liveSyncToleranceSandbox.shouldSeekLiveVideoToTarget(32.1, 36, true), false, "Protected Shaka live sync should tolerate normal F1 TV HLS live-edge sawtooth without looping seeks");
assert.equal(liveSyncToleranceSandbox.shouldSeekLiveVideoToTarget(37.6, 36, true), false, "Protected Shaka live sync should tolerate normal F1 TV HLS live-edge jumps above target");
assert.doesNotMatch(liveRacingSource, /decision\.delta < -LIVE_SYNC_SEEK_THRESHOLD|delta < -LIVE_SYNC_SEEK_THRESHOLD/, "Periodic live sync should not repeatedly seek backward and create playback loops");
assert.match(liveRacingSource, /function syncLivePlayersToTarget[\s\S]*syncLiveVideoToTargetLatency/, "Live target seeking should stay available as an explicit Match target action");
assert.match(liveRacingSource, /function jumpLivePlayersToLive[\s\S]*jumpLiveVideoToLiveEdge/, "Live sessions should expose an explicit jump-to-live action for paused streams");
assert.match(liveRacingSource, /onJumpToLive=\{\(\) => jumpLivePlayersToLive\("WORLD"\)\}/, "Live Sync menu should wire Jump to live to the mounted world stream players");
assert.match(liveRacingSource, />Jump to live<\/button>/, "Live Sync menu should render a Jump to live action during live sessions");
assert.match(liveRacingSource, /liveSync:\s*\{[\s\S]*enabled: !replay[\s\S]*targetLatency[\s\S]*maxPlaybackRate: 1[\s\S]*minPlaybackRate: 1/, "Protected Shaka players should not slow to 0.8x while Apexline seeks to the target latency");
assert.match(liveRacingSource, /targetLatencyTolerance: liveSyncToleranceForTarget\(targetLatency\)/, "Protected Shaka live sync should not use frame-tight epsilon tolerance for segmented HLS feeds");
assert.match(liveRacingSource, /shaka:\s*\{[\s\S]*streaming:\s*\{[\s\S]*lowLatencyMode: false/, "Protected Shaka players should not enable Shaka low-latency mode when targeting a 30-40s buffer");
assert.match(liveRacingSource, /await player\.load\(descriptor\.manifestUrl[\s\S]*syncLiveVideoToTargetLatency\(video, targetLatency\)/, "Protected Shaka live players should seek to target latency immediately after load instead of drifting from the live edge at 0.8x");
assert.match(liveRacingSource, /shouldSeekLiveVideoToTarget\(liveLatency, targetLatency, liveInitialTargetSync\)/, "Protected Shaka players should keep seeking to target when latency is far outside the normal HLS sawtooth window");
assert.match(liveRacingSource, /const reportSync = \(\) => \{[\s\S]*shouldSeekLiveVideoToTarget\(liveLatency, targetLatency, liveInitialTargetSync\)[\s\S]*syncLiveVideoToTargetLatency\(video, targetLatency\)/, "Protected Shaka live players should retry the target seek after load once Shaka exposes a usable live range");
assert.match(liveRacingSource, /if \(!player && !video\.paused && descriptor\.playbackMode !== "replay"[\s\S]*video\.playbackRate = decision\.playbackRate/, "Manual playback-rate sync should only run when Shaka is not controlling live sync");
assert.match(liveRacingSource, /player\?\.seekRange\?\.\(\)[\s\S]*liveLatency = range\.end - video\.currentTime/, "Protected Shaka sync metrics should use Shaka's seek range when available");
const liveTimingRequestSandbox = vm.runInNewContext(`(() => {
  const DEFAULT_WORLD_SYNC_TARGET = 36;
  const LIVE_TIMING_STREAM_ALIGNMENT_DELAY_SECONDS = 4.6;
  ${extractNamedFunction(liveRacingSource, "validVideoUtcMs")}
  ${extractNamedFunction(liveRacingSource, "dateLikeMs")}
  ${extractNamedFunction(liveRacingSource, "liveVideoPlayheadUtcMs")}
  ${extractNamedFunction(liveRacingSource, "liveTimingRequestForMetrics")}
  ${extractNamedFunction(liveRacingSource, "liveTimingTargetUtcNow")}
  return { liveVideoPlayheadUtcMs, liveTimingRequestForMetrics, liveTimingTargetUtcNow };
})()`);
const liveTimingCatchUpUiSandbox = vm.runInNewContext(`(() => {
  ${extractNamedFunction(liveRacingSource, "liveTimingCatchUpRemainingForDisplay")}
  ${extractNamedFunction(liveRacingSource, "formatLiveTimingCatchUpRemaining")}
  return { liveTimingCatchUpRemainingForDisplay, formatLiveTimingCatchUpRemaining };
})()`);
const liveFrameUtcMs = Date.parse("2026-06-09T19:59:24.000Z");
assert.equal(liveTimingRequestSandbox.liveVideoPlayheadUtcMs({ currentTime: 12 }, { getPlayheadTimeAsDate: () => new Date(liveFrameUtcMs) }, null), liveFrameUtcMs, "Live timing should read Shaka's program-date playhead when available");
assert.equal(liveTimingRequestSandbox.liveVideoPlayheadUtcMs({ currentTime: 4, getStartDate: () => new Date("2026-06-09T19:59:20.000Z") }, null, null), liveFrameUtcMs, "Live timing should fall back to native HLS start-date plus currentTime");
assert.equal(liveTimingCatchUpUiSandbox.liveTimingCatchUpRemainingForDisplay({ catchUpRemainingSeconds: 5, fetchedAt: "2026-06-09T20:00:00.000Z" }, Date.parse("2026-06-09T20:00:01.500Z")), 3.5, "Live timing catch-up ETA should decrease smoothly between IPC polls");
assert.equal(liveTimingCatchUpUiSandbox.liveTimingCatchUpRemainingForDisplay({ catchUpRemainingSeconds: 1, fetchedAt: "2026-06-09T20:00:00.000Z" }, Date.parse("2026-06-09T20:00:02.000Z")), null, "Live timing catch-up ETA should disappear once the estimate has elapsed");
assert.equal(liveTimingCatchUpUiSandbox.formatLiveTimingCatchUpRemaining(3.24), "3.2s", "Live timing catch-up should show sub-ten-second ETAs with one decimal place");
assert.equal(liveTimingCatchUpUiSandbox.formatLiveTimingCatchUpRemaining(40.6), "41s", "Live timing catch-up should show longer ETAs as whole seconds");
assert.equal(liveTimingCatchUpUiSandbox.formatLiveTimingCatchUpRemaining(null), "", "Live timing catch-up should omit unknown ETAs");
assert.match(liveRacingSource, /const LIVE_TIMING_STREAM_ALIGNMENT_DELAY_SECONDS = 4\.6;/, "Live timing should mirror MultiViewer's 4.6s F1 timing stream offset");
assert.deepEqual(JSON.parse(JSON.stringify(liveTimingRequestSandbox.liveTimingRequestForMetrics({ targetLatency: 36, liveLatency: 37.9, videoTimeUtcMs: liveFrameUtcMs }, 36))), { targetLatencySeconds: 40.6, targetUtcMs: liveFrameUtcMs }, "Live timing should send the raw video playhead UTC; the measured feed latency is subtracted in the main process like MultiViewer");
assert.deepEqual(JSON.parse(JSON.stringify(liveTimingRequestSandbox.liveTimingRequestForMetrics({ targetLatency: 36, liveLatency: 37.9, videoTimeUtcMs: liveFrameUtcMs, videoTimeAtMs: 5000 }, 36))), { targetLatencySeconds: 40.6, targetUtcMs: liveFrameUtcMs, videoTimeAtMs: 5000 }, "Live timing requests should carry the wall-clock instant the playhead was measured");
assert.match(mainProcess, /const F1_TIMING_LIVE_STREAM_ALIGNMENT_SECONDS = 4\.6/, "Live timing should keep the empirical 4.6s F1 TV stream alignment floor");
assert.match(mainProcess, /function f1LiveTimingStreamAlignmentSeconds/, "Live timing should peak-hold stream alignment so Q-session sample refresh cannot jump the tower ahead");
assert.match(mainProcess, /F1_TIMING_LIVE_ALIGNMENT_DECAY_PER_MINUTE/, "Live timing alignment should only slowly decay toward a faster feed median");
assert.match(mainProcess, /f1TimingArchiveSecondsForUtc\(sessionData, targetUtcMs\) - streamAlignmentSeconds/, "Live timing video-UTC targets should subtract the stream alignment in the main process");
assert.match(liveRacingSource, /videoTimeAtMs: videoTimeUtcMs != null && Number\.isFinite\(measuredAtMs\) \? measuredAtMs : null/, "Live sync metrics should retain videoTimeAtMs so timing can extrapolate the playhead between reports");
assert.deepEqual(JSON.parse(JSON.stringify(liveTimingRequestSandbox.liveTimingRequestForMetrics({ liveLatency: 32.1, targetLatency: 36 }, 36))), { targetLatencySeconds: 40.6 }, "Live timing should include the stream alignment delay when falling back to latency-based sampling");
assert.equal(liveTimingRequestSandbox.liveTimingTargetUtcNow({ targetUtcMs: liveFrameUtcMs, videoTimeAtMs: 5000 }, 5500), liveFrameUtcMs + 500, "Live timing polls should extrapolate the video playhead between 750ms sync reports");
assert.equal(liveTimingRequestSandbox.liveTimingTargetUtcNow({ targetUtcMs: liveFrameUtcMs, videoTimeAtMs: 5000 }, 15000), liveFrameUtcMs + 3000, "Live timing playhead extrapolation should stay clamped when sync reports stall");
assert.equal(liveTimingRequestSandbox.liveTimingTargetUtcNow({ targetUtcMs: liveFrameUtcMs }, 15000), liveFrameUtcMs, "Live timing playhead extrapolation should pass the target through when no measurement time exists");
assert.equal(liveTimingRequestSandbox.liveTimingTargetUtcNow({ targetLatencySeconds: 40.6 }, 15000), null, "Live timing playhead extrapolation should return null without a UTC target");
const sessionClockAnchorSandbox = vm.runInNewContext(`(() => {
  ${extractNamedFunction(liveRacingSource, "formatSessionClock")}
  ${extractNamedFunction(liveRacingSource, "sessionClockSeconds")}
  ${extractNamedFunction(liveRacingSource, "formatSessionClockSeconds")}
  ${extractNamedFunction(liveRacingSource, "smoothSessionClockLabel")}
  return { smoothSessionClockLabel };
})()`);
const sessionClockAnchorRef = { current: null };
const sessionClockT0 = Date.parse("2026-06-09T20:00:00.000Z");
assert.equal(sessionClockAnchorSandbox.smoothSessionClockLabel({ remaining: "1:00:00", extrapolating: true }, { mode: "live", clockAnchorRef: sessionClockAnchorRef, nowMs: sessionClockT0 }), "1:00:00", "Session clock should anchor to the first live snapshot");
assert.equal(sessionClockAnchorSandbox.smoothSessionClockLabel({ remaining: "1:00:00", extrapolating: true }, { mode: "live", clockAnchorRef: sessionClockAnchorRef, nowMs: sessionClockT0 + 1000 }), "59:59", "Session clock should keep ticking on the wall clock while the video playhead snapshot is stale");
assert.equal(sessionClockAnchorSandbox.smoothSessionClockLabel({ remaining: "59:59", extrapolating: true }, { mode: "live", clockAnchorRef: sessionClockAnchorRef, nowMs: sessionClockT0 + 2000 }), "59:58", "Session clock should trust steady local ticking over sub-2s snapshot jitter");
assert.equal(sessionClockAnchorSandbox.smoothSessionClockLabel({ remaining: "59:30", extrapolating: true }, { mode: "live", clockAnchorRef: sessionClockAnchorRef, nowMs: sessionClockT0 + 3000 }), "59:30", "Session clock should re-anchor when the snapshot diverges by more than jitter");
assert.equal(sessionClockAnchorSandbox.smoothSessionClockLabel({ remaining: "59:30", extrapolating: false }, { mode: "live", clockAnchorRef: sessionClockAnchorRef, nowMs: sessionClockT0 + 5000 }), "59:30", "Session clock should freeze and drop its anchor when the F1 clock stops extrapolating");
assert.equal(sessionClockAnchorRef.current, null, "A non-extrapolating clock should clear the live countdown anchor");
assert.match(liveRacingSource, /const sessionClockAnchorRef = React\.useRef\(null\)/, "Live Racing should keep a session clock anchor ref for steady countdown ticking");
assert.match(liveRacingSource, /clockAnchorRef: sessionClockAnchorRef/, "The session clock label should tick from the live countdown anchor");
assert.match(liveRacingSource, /videoTimeAtMs: Date\.now\(\)/, "Live sync metrics should record when the video playhead was measured");
assert.match(liveRacingSource, /targetUtcMs: liveTimingTargetUtcNow\(timingSync, Date\.now\(\)\)/, "Live timing polls should extrapolate the playhead target at request time");
assert.match(liveRacingSource, /liveTimingSyncRef = React\.useRef\(liveTimingRequestForMetrics\(null, DEFAULT_WORLD_SYNC_TARGET\)\)/, "Initial live timing polling should include the same F1 timing offset before video sync metrics arrive");
assert.match(liveRacingSource, /videoTimeUtcMs/, "Live sync metrics should carry the current video program-date timestamp for timing alignment");
assert.match(liveRacingSource, /targetUtcMs/, "Live timing polling should request rows by video UTC when the player exposes it");
const recordSyncMetricsSandbox = vm.runInNewContext(`(() => {
  let syncMetricsState = {};
  function setSyncMetrics(update) {
    syncMetricsState = update(syncMetricsState);
  }
  ${extractNamedFunction(liveRacingSource, "validVideoUtcMs")}
  ${extractNamedFunction(liveRacingSource, "recordSyncMetrics")}
  return { recordSyncMetrics, syncMetricsState: () => syncMetricsState };
})()`);
recordSyncMetricsSandbox.recordSyncMetrics("WORLD", {
  targetLatency: 36,
  liveLatency: 37.9,
  playbackRate: 1,
  delta: 1.9,
  videoTimeUtcMs: liveFrameUtcMs,
  videoTimeAtMs: liveFrameUtcMs + 100,
});
assert.equal(recordSyncMetricsSandbox.syncMetricsState().WORLD.videoTimeUtcMs, liveFrameUtcMs, "Live sync metrics state should retain video UTC so timing can follow the actual player playhead");
recordSyncMetricsSandbox.recordSyncMetrics("WORLD", {
  targetLatency: 36,
  liveLatency: 37.9,
  playbackRate: 1,
  delta: 1.9,
  videoTimeUtcMs: "not-a-video-timestamp",
  videoTimeAtMs: liveFrameUtcMs + 200,
});
assert.equal(recordSyncMetricsSandbox.syncMetricsState().WORLD.videoTimeUtcMs, null, "Live sync metrics state should normalize invalid video UTC values to null");
assert.match(liveRacingSource, /pitwall\.data\.liveTiming\(\{[\s\S]*source: "f1"[\s\S]*targetUtcMs/, "Live Racing live mode should pass the video UTC timing target through IPC");

const f1LiveTimelineSandbox = vm.runInNewContext(`(() => {
  const F1_TIMING_LIVE_FEED_LATENCY_MAX_SECONDS = 15;
  ${extractNamedFunction(mainProcess, "finiteNumber")}
  ${extractNamedFunction(mainProcess, "f1TimingArchiveStartUtcMs")}
  ${extractNamedFunction(mainProcess, "f1TimingArchiveSecondsForUtc")}
  ${extractNamedFunction(mainProcess, "f1LiveTimingFeedLatencySeconds")}
  ${extractNamedFunction(mainProcess, "f1LiveTimingEntrySeconds")}
  return { f1TimingArchiveStartUtcMs, f1TimingArchiveSecondsForUtc, f1LiveTimingFeedLatencySeconds, f1LiveTimingEntrySeconds };
})()`);
const staleClockSnapshotEntry = { seconds: Date.parse("2026-06-09T19:59:32.000Z") / 1000, data: { Utc: "2026-06-09T19:59:24.000Z" } };
assert.equal(f1LiveTimelineSandbox.f1TimingArchiveStartUtcMs({ archiveStartUtcMs: 0, clockEntries: [staleClockSnapshotEntry] }), 0, "Live timing must not derive its timeline anchor from a stale ExtrapolatedClock snapshot");
assert.equal(f1LiveTimelineSandbox.f1TimingArchiveSecondsForUtc({ archiveStartUtcMs: 0, clockEntries: [staleClockSnapshotEntry] }, liveFrameUtcMs), liveFrameUtcMs / 1000, "Live timing video-UTC targets should map straight onto the feed timeline");
assert.equal(f1LiveTimelineSandbox.f1TimingArchiveStartUtcMs({ clockEntries: [{ seconds: 120, data: { Utc: "2026-06-09T19:59:24.000Z" } }] }), Date.parse("2026-06-09T19:59:24.000Z") - 120000, "Replay archives should keep deriving their timeline anchor from clock entries");
assert.equal(f1LiveTimelineSandbox.f1LiveTimingEntrySeconds(liveFrameUtcMs, liveFrameUtcMs + 1400, 1.4), liveFrameUtcMs / 1000, "Live entries should be stamped with the message's own feed timestamp when present");
assert.equal(f1LiveTimelineSandbox.f1LiveTimingEntrySeconds(null, liveFrameUtcMs + 1400, 1.4), (liveFrameUtcMs + 1400) / 1000 - 1.4, "Snapshot entries without a feed timestamp should fall back to arrival time minus the measured feed latency");
assert.equal(f1LiveTimelineSandbox.f1LiveTimingFeedLatencySeconds([0.8, 6, 1.2]), 1.2, "Feed latency should use the median of recent samples so one stale message cannot skew the timeline");
assert.equal(f1LiveTimelineSandbox.f1LiveTimingFeedLatencySeconds([]), 0, "Feed latency should default to zero before any samples arrive");
assert.equal(f1LiveTimelineSandbox.f1LiveTimingFeedLatencySeconds([20, 22, 24]), 15, "Feed latency should stay clamped when samples look like clock skew");
assert.match(mainProcess, /rows\.push\(\{ time: "", seconds, data \}\)/, "Live SignalR entries should be stamped via the feed-timeline seconds, not raw arrival time");
assert.match(mainProcess, /clockEntries: entriesByTopic\.ExtrapolatedClock \|\| \[\],\n\s*archiveStartUtcMs: 0,/, "Live snapshots should pin the timeline anchor to the UTC epoch");
assert.match(mainProcess, /f1TimingArchiveSecondsForUtc\(\{ clockEntries: entriesByTopic\.ExtrapolatedClock \|\| \[\], archiveStartUtcMs: 0 \}, targetUtcMs\)/, "Live catch-up estimates should use the same pinned UTC timeline");
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
assert.match(mainProcess, /function driverResultsUrl\(season, round\)[\s\S]*\/\$\{encodeURIComponent\(year\)\}\/\$\{encodeURIComponent\(String\(round\)\)\}\/results\.json\?limit=100/, "Recent form should fetch bounded per-race results for the snapshot season");
const recentDriverResultsSource = extractNamedFunction(mainProcess, "fetchRecentDriverResults");
const recentOpenF1DriverResultsSource = extractNamedFunction(mainProcess, "fetchRecentOpenF1DriverResults");
assert.match(mainProcess, /const RECENT_DRIVER_RESULTS_CACHE_MS = 1000 \* 60 \* 30/, "Recent per-round driver results should use an explicit memory cache TTL");
assert.match(mainProcess, /let recentDriverResultsCache = new Map\(\)/, "Recent per-round driver results should keep a memory cache between live-data refreshes");
assert.match(recentDriverResultsSource, /function fetchRecentDriverResults\(schedule = \[\], maxRaces = 5, season = new Date\(\)\.getFullYear\(\)\)/, "Recent form should accept the live snapshot season instead of relying on Jolpica's current alias");
assert.match(recentDriverResultsSource, /recentDriverResultsCache\.get\(cacheKey\)[\s\S]*Date\.now\(\) - cached\.createdAt < RECENT_DRIVER_RESULTS_CACHE_MS/, "Recent per-round driver results should reuse fresh cached race results");
assert.match(recentDriverResultsSource, /recentDriverResultsCache\.set\(cacheKey, \{ createdAt: Date\.now\(\), race \}\)/, "Recent per-round driver results should cache successful race result pages");
assert.match(recentOpenF1DriverResultsSource, /getAnalyticsSession\(\{[\s\S]*scope: "leaderboard"[\s\S]*openF1RaceResultToRecentFormRace/, "Recent form should fall back to the rich analytics race result path when Jolpica has no current-season rows");
assert.match(mainProcess, /ensureRecentDriverForm[\s\S]*fetchRecentDriverResults[\s\S]*fetchRecentOpenF1DriverResults/, "First-paint recent form should try bounded Jolpica results and then the OpenF1 analytics fallback");
const openF1RecentFormSandbox = vm.runInNewContext(`(() => {
  ${[
    "finiteNumber",
    "fallbackDriverName",
    "openF1RaceResultToRecentFormRace",
    "parseDriverRecentForm",
  ].map((name) => extractNamedFunction(mainProcess, name)).join("\n")}
  return { openF1RaceResultToRecentFormRace, parseDriverRecentForm };
})()`);
const openF1RecentRace = openF1RecentFormSandbox.openF1RaceResultToRecentFormRace(
  { rnd: 7, name: "Barcelona Grand Prix", loc: "Barcelona" },
  [{ position: 1, driver_number: 44 }, { position: 2, driver_number: 12 }, { position: 3, number: 1, code: "NOR" }],
  [{ code: "HAM", name: "Lewis Hamilton", num: 44 }, { code: "ANT", name: "Kimi Antonelli", num: 12 }, { code: "NOR", name: "Lando Norris", num: 1 }],
);
assert.deepEqual(JSON.parse(JSON.stringify(openF1RecentRace.Results.map((row) => ({ position: row.position, code: row.Driver.code })))), [
  { position: "1", code: "HAM" },
  { position: "2", code: "ANT" },
  { position: "3", code: "NOR" },
], "OpenF1 session results should be convertible into recent-form race results by app roster code");
assert.deepEqual(JSON.parse(JSON.stringify(openF1RecentFormSandbox.parseDriverRecentForm({ MRData: { RaceTable: { Races: [openF1RecentRace] } } }).driverForm)), {
  HAM: [1],
  ANT: [2],
  NOR: [3],
}, "OpenF1-derived recent-form races should feed the existing driver form parser");
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
assert.match(mainProcess, /analyticsSessionHasPublishedRows[\s\S]*\["laps", "position", "sessionResult", "stints"\][\s\S]*const cachedDataUsable[\s\S]*aliasDiskEntry\?\.data && cachedDataUsable/, "Roster-only OpenF1 analytics cache entries should not block the Formula 1 timing fallback");
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
    "finiteNumber",
    "teamAbbr",
    "championshipPositionDelta",
    "championshipStandingNumber",
    "championshipRowPosition",
    "championshipRowPoints",
    "championshipStandingRows",
    "constructorStandingsCoverExpectedTeams",
    "selectConstructorStandings",
    "shouldFetchOfficialConstructorStandings",
    "applyChampionshipPositionDeltas",
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
    applyChampionshipPositionDeltas,
    constructorStandingsCoverExpectedTeams,
    selectConstructorStandings,
    shouldFetchOfficialConstructorStandings,
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
assert.deepEqual(
  JSON.parse(JSON.stringify(f1ApiStandingsSandbox.applyChampionshipPositionDeltas([
    { pos: 1, code: "ANT", pts: 156, delta: 0 },
    { pos: 2, code: "HAM", pts: 115, delta: 0 },
    { pos: 4, code: "LEC", pts: 75, delta: 0 },
  ], [
    { pos: 2, code: "ANT", pts: 120 },
    { pos: 1, code: "HAM", pts: 118 },
    { pos: 5, code: "LEC", pts: 52 },
  ], "code").map((row) => ({ code: row.code, delta: row.delta })))),
  [
    { code: "ANT", delta: 1 },
    { code: "HAM", delta: -1 },
    { code: "LEC", delta: 1 },
  ],
  "Official standings fallback should derive position-change badges from previous-round standings"
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
const openF1LiveSparseDriverResult = f1ApiStandingsSandbox.parseOpenF1DriverStandings([
  { driver_number: 30, position_start: 10, points_current: 24 },
  { driver_number: 16, position_start: 4, points_current: 83 },
  { driver_number: 3, position_start: 7, points_current: 53 },
  { driver_number: 12, position_current: 1, position_start: 1, points_current: 171 },
  { driver_number: 44, position_current: 2, position_start: 2, points_current: 115 },
], [
  { code: "ANT", name: "Kimi Antonelli", num: 12, team: "Mercedes", abbr: "MER" },
  { code: "HAM", name: "Lewis Hamilton", num: 44, team: "Ferrari", abbr: "FER" },
  { code: "LEC", name: "Charles Leclerc", num: 16, team: "Ferrari", abbr: "FER" },
  { code: "VER", name: "Max Verstappen", num: 3, team: "Red Bull Racing", abbr: "RBR" },
  { code: "LAW", name: "Liam Lawson", num: 30, team: "Racing Bulls", abbr: "RB" },
]);
assert.deepEqual(
  openF1LiveSparseDriverResult.standings.map((row) => `${row.pos}:${row.code}`),
  ["1:ANT", "2:HAM", "4:LEC", "7:VER", "10:LAW"],
  "OpenF1 live championship driver rows should fall back to start position and render in championship order"
);
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
const openF1LiveSparseConstructors = f1ApiStandingsSandbox.parseOpenF1ConstructorStandings([
  { team_name: "Ferrari", position_start: 2, points_current: 198 },
  { team_name: "Mercedes", position_current: 1, position_start: 1, points_current: 277 },
  { team_name: "McLaren", position_start: 3, points_current: 134 },
]);
assert.deepEqual(
  openF1LiveSparseConstructors.map((row) => `${row.pos}:${row.abbr}`),
  ["1:MER", "2:FER", "3:MCL"],
  "OpenF1 live championship constructor rows should fall back to start position and render in championship order"
);
const openF1AnonymousConstructors = f1ApiStandingsSandbox.parseOpenF1ConstructorStandings([
  { position_current: 1, position_start: 1, points_current: 277 },
  { team_name: "Mercedes", position_current: 2, position_start: 2, points_current: 244 },
]);
assert.deepEqual(
  openF1AnonymousConstructors.map((row) => row.name),
  ["Mercedes"],
  "OpenF1 constructor standings should not emit blank teams when a live row has no constructor identity"
);
const expectedConstructorRows = [
  { abbr: "MCL", name: "McLaren" },
  { abbr: "FER", name: "Ferrari" },
  { abbr: "RBR", name: "Red Bull Racing" },
  { abbr: "MER", name: "Mercedes" },
  { abbr: "WIL", name: "Williams" },
  { abbr: "AM", name: "Aston Martin" },
  { abbr: "RB", name: "Racing Bulls" },
  { abbr: "ALP", name: "Alpine" },
  { abbr: "HAS", name: "Haas F1 Team" },
  { abbr: "AUD", name: "Audi" },
  { abbr: "CAD", name: "Cadillac" },
];
assert.equal(
  f1ApiStandingsSandbox.constructorStandingsCoverExpectedTeams(openF1LiveSparseConstructors, expectedConstructorRows),
  false,
  "Sparse OpenF1 constructor standings should not count as a complete championship table"
);
assert.equal(
  f1ApiStandingsSandbox.shouldFetchOfficialConstructorStandings({ openF1ConstructorStandings: [
    { team_name: "Haas F1 Team", position_start: 7, points_current: 21 },
    { team_name: "Williams", position_start: 8, points_current: 11 },
  ] }, expectedConstructorRows),
  true,
  "Sparse OpenF1 constructor standings should trigger the official Formula 1 standings fallback"
);
const completeOpenF1Constructors = expectedConstructorRows.map((team, index) => ({
  team_name: team.name,
  position_current: index + 1,
  points_current: Math.max(0, 300 - index * 20),
}));
const parsedCompleteOpenF1Constructors = f1ApiStandingsSandbox.parseOpenF1ConstructorStandings(completeOpenF1Constructors);
assert.equal(
  f1ApiStandingsSandbox.constructorStandingsCoverExpectedTeams(parsedCompleteOpenF1Constructors, expectedConstructorRows),
  true,
  "Complete OpenF1 constructor standings should be trusted when all expected teams are present"
);
assert.deepEqual(
  f1ApiStandingsSandbox.selectConstructorStandings(
    openF1LiveSparseConstructors,
    [{ pos: 1, abbr: "MCL", name: "McLaren", pts: 260 }],
    [],
    [],
    expectedConstructorRows
  ),
  [{ pos: 1, abbr: "MCL", name: "McLaren", pts: 260 }],
  "Sparse OpenF1 constructor rows should not suppress a complete official standings fallback"
);
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
  const NEWS_ARTICLE_CACHE_MS = 1000 * 60 * 15;
  const NEWS_ARTICLE_CACHE_LIMIT = 128;
  const NEWS_ARTICLE_CONCURRENCY = 4;
  let newsArticleEnrichmentCache = new Map();
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
    "extractHtmlCardContext",
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
    "pruneBoundedMap",
    "mapWithConcurrencyStable",
    "newsArticleDetailsFromHtml",
    "newsArticleDetailsMeaningful",
    "getNewsArticleEnrichment",
    "enrichNewsStoryImages",
    "newsStorySortTime",
    "selectNewsFeedStories",
    "buildNewsFeed",
  ].map((name) => extractNamedFunction(mainProcess, name)).join("\n")}
  return {
    parseNewsHtml,
    parseNewsSource,
    extractArticleMetaImage,
    extractArticleMetaDate,
    extractArticleBody,
    enrichNewsStoryImages,
    buildNewsFeed,
    cacheSize: () => newsArticleEnrichmentCache.size,
  };
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
const planetF1SpacedCardHtml = `
  <article>
    <a href="/news/williams-double-post-race-investigation-start-breach">
      Williams faces double post-race investigation after start breach
    </a>
    <div>${"PlanetF1 listing metadata ".repeat(55)}</div>
    <p>Williams have been summoned by the stewards after two separate start-procedure concerns.</p>
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
  newsParserSandbox.parseNewsHtml(planetF1SpacedCardHtml, { name: "PlanetF1", url: "https://www.planetf1.com/news", articlePath: /\/news\/[^/?#]+\/?$/i })[0].lead,
  "Williams have been summoned by the stewards after two separate start-procedure concerns.",
  "PlanetF1 news cards should find the listing excerpt within the full article card",
);
assert.deepEqual(
  JSON.parse(JSON.stringify(newsParserSandbox.parseNewsSource(`
    <rss><channel>
      <item><title>Hamilton wins first GP for Ferrari as Antonelli retires</title><link>https://www.formula1.com/en/latest/article/hamilton-wins-first-ferrari-gp.abc123</link></item>
      <item><title>"You helped me achieve this dream" Lewis Hamilton's emotional message on first Ferrari GP win</title><link>https://www.formula1.com/en/latest/article/hamilton-emotional-message.abc123</link></item>
      <item><title>Hamilton takes first Ferrari win as Russell wilts and Antonelli retires</title><link>https://www.formula1.com/en/latest/article/hamilton-takes-first-ferrari-win.abc123</link></item>
      <item><title>F1 Barcelona GP Lewis Hamilton takes maiden Ferrari win as Kimi Antonelli retires late</title><link>https://www.formula1.com/en/latest/article/barcelona-gp-hamilton-maiden-ferrari-win.abc123</link></item>
    </channel></rss>`,
    { name: "Formula 1", url: "https://www.formula1.com/en/latest/all.xml", type: "rss", articlePath: /\/en\/latest\/article\//i },
  ).map((story) => story.tag))),
  ["Results", "Paddock", "Results", "Results"],
  "News categorization should distinguish race outcome headlines from paddock reaction stories",
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
await newsParserSandbox.enrichNewsStoryImages([
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
await newsParserSandbox.enrichNewsStoryImages([
  {
    title: "Lewis Hamilton achieves Ferrari impossible dream with emotional Barcelona GP breakthrough",
    url: "https://www.planetf1.com/news/lewis-hamilton-ferrari-impossible-dream-barcelona-gp-breakthrough",
    image: "https://www.planetf1.com/content/uploads/2026/06/lewis-hamilton-ferrari.webp",
    publishedAt: "2026-06-14T16:00:00.000Z",
    time: "1h",
    lead: "",
  },
], 2, async () => `
  <article>
    <p>Lewis Hamilton called his Ferrari breakthrough an impossible dream after a huge Barcelona result.</p>
    <p>The seven-time World Champion said the result unlocked belief across the garage.</p>
  </article>`)
  .then((stories) => {
    assert.equal(
      stories[0].lead,
      "Lewis Hamilton called his Ferrari breakthrough an impossible dream after a huge Barcelona result.",
      "PlanetF1 stories with image and time should still backfill missing tile descriptions from article text",
    );
  });
let canonicalNewsFetches = 0;
const canonicalNewsFetcher = async () => {
  canonicalNewsFetches += 1;
  return `<meta property="og:image" content="https://example.com/cached.webp">`;
};
const canonicalNewsStory = (url, title = "Canonical story") => ({
  title,
  url,
  image: "",
  publishedAt: "",
  time: "recent",
  lead: "",
});
await newsParserSandbox.enrichNewsStoryImages(
  [canonicalNewsStory("https://example.com/article?utm_source=feed")],
  1,
  canonicalNewsFetcher,
  1000,
);
await newsParserSandbox.enrichNewsStoryImages(
  [canonicalNewsStory("https://example.com/article?ref=home")],
  1,
  canonicalNewsFetcher,
  2000,
);
assert.equal(canonicalNewsFetches, 1, "Canonical news article URLs should reuse enrichment for 15 minutes");
await newsParserSandbox.enrichNewsStoryImages(
  [canonicalNewsStory("https://example.com/article")],
  1,
  canonicalNewsFetcher,
  1000 + 15 * 60 * 1000,
);
assert.equal(canonicalNewsFetches, 2, "Expired news article enrichment should refetch");
let emptyArticleFetches = 0;
const emptyThenMeaningfulUrl = "https://example.com/empty-then-meaningful";
await newsParserSandbox.enrichNewsStoryImages(
  [canonicalNewsStory(emptyThenMeaningfulUrl, "Empty response story")],
  1,
  async () => {
    emptyArticleFetches += 1;
    return "<main><p>Checking your browser before accessing this article. Please enable JavaScript and cookies to continue.</p></main>";
  },
  2500,
);
const recoveredEmptyStory = canonicalNewsStory(emptyThenMeaningfulUrl, "Recovered response story");
await newsParserSandbox.enrichNewsStoryImages(
  [recoveredEmptyStory],
  1,
  async () => {
    emptyArticleFetches += 1;
    return "<article><p>Recovered meaningful article body after the empty anti-bot response.</p></article>";
  },
  2600,
);
assert.equal(emptyArticleFetches, 2, "Successful but empty/anti-bot news responses should not be cached for 15 minutes");
assert.match(recoveredEmptyStory.lead, /Recovered meaningful article body/, "A second meaningful article response should enrich after an empty 200");
let refusedNewsFetches = 0;
await newsParserSandbox.enrichNewsStoryImages(
  [canonicalNewsStory("https://example.com/refused")],
  1,
  async () => {
    refusedNewsFetches += 1;
    throw new Error("refused");
  },
  3000,
);
await newsParserSandbox.enrichNewsStoryImages(
  [canonicalNewsStory("https://example.com/refused")],
  1,
  async () => {
    refusedNewsFetches += 1;
    return "<article><p>Recovered article body with enough useful detail for the news card.</p></article>";
  },
  4000,
);
assert.equal(refusedNewsFetches, 2, "Refused news article enrichment should not poison the cache");

let activeNewsDetails = 0;
let peakNewsDetails = 0;
const newsDetailResolvers = [];
const newsTitles = Array.from({ length: 8 }, (_, index) => `Story ${index}`);
const boundedNewsWork = newsParserSandbox.enrichNewsStoryImages(
  newsTitles.map((title, index) => canonicalNewsStory(`https://example.com/concurrency-${index}`, title)),
  8,
  async () => {
    activeNewsDetails += 1;
    peakNewsDetails = Math.max(peakNewsDetails, activeNewsDetails);
    await new Promise((resolve) => newsDetailResolvers.push(resolve));
    activeNewsDetails -= 1;
    return "<article><p>Article body with enough useful detail for a stable news card description.</p></article>";
  },
  5000,
);
await new Promise((resolve) => setImmediate(resolve));
assert.equal(peakNewsDetails, 4, "News article enrichment should cap detail concurrency at four");
while (newsDetailResolvers.length) {
  newsDetailResolvers.splice(0).forEach((resolve) => resolve());
  await new Promise((resolve) => setImmediate(resolve));
}
assert.deepEqual((await boundedNewsWork).map((story) => story.title), newsTitles, "Concurrent news enrichment should preserve stable feed order");
await newsParserSandbox.enrichNewsStoryImages(
  Array.from({ length: 140 }, (_, index) => canonicalNewsStory(`https://example.com/bounded-cache-${index}`, `Bounded ${index}`)),
  140,
  async () => "<article><p>Bounded cache fixture article body with enough useful detail.</p></article>",
  6000,
);
assert.ok(newsParserSandbox.cacheSize() <= 128, "News article enrichment cache should remain bounded");
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
    "preserveDeletedF1TimingLine",
    "f1TimingBlankTimingValue",
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
  const F1_TIMING_LIVE_FEED_LATENCY_MAX_SECONDS = 15;
  const F1_TIMING_LIVE_FEED_LATENCY_SAMPLE_LIMIT = 48;
  const F1_TIMING_LIVE_STREAM_ALIGNMENT_SECONDS = 4.6;
  const F1_TIMING_LIVE_ALIGNMENT_DECAY_PER_MINUTE = 0.2;
  const F1_TIMING_LIVE_ENTRY_SOFT_LIMIT = 1000;
  const F1_TIMING_LIVE_ENTRY_KEEP = 700;
  const f1TimingTelemetrySampleCache = new WeakMap();
  const f1TimingPositionSampleCache = new WeakMap();
  const f1TimingStateCursorCache = new WeakMap();
  const realDateNow = Date.now.bind(Date);
  let f1TimingSmokeNowMs = null;
  let f1LiveTimingClient = { authTokenAttached: true, signalRCookieAttached: true };
  let f1LiveTimingState = { entriesByTopic: {}, lastMessageAt: 0, lastError: "" };
  Date.now = () => f1TimingSmokeNowMs ?? realDateNow();
  function ensureF1TimingLiveClient() { return Promise.resolve(); }
  function setF1LiveTimingState(state) { f1LiveTimingState = state; }
  function getF1LiveTimingState() { return f1LiveTimingState; }
  function setF1TimingSmokeNowMs(value) { f1TimingSmokeNowMs = value == null ? null : Number.isFinite(Number(value)) ? Number(value) : null; }
  ${[
    "finiteNumber",
    "groupRowsByDriverNumber",
    "clampPercent",
    "latestCarDataByDriverNumber",
    "preserveDeletedF1TimingLine",
    "f1TimingBlankTimingValue",
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
    "f1TimingSegmentMapFromValue",
    "mergeF1TimingSegmentMap",
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
    "f1LiveTimingStreamAlignmentSeconds",
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
    "f1TimingLiveClientIsStale",
    "closeF1TimingLiveClient",
    "recoverStaleF1TimingLiveClient",
    "getF1LiveTimingSnapshot",
    "f1LiveTimingCatchUpRemainingSeconds",
    "resyncF1LiveTiming",
  ].map((name) => extractNamedFunction(mainProcess, name)).join("\n")}
  function normalizeCompound(value) { return String(value || "").toLowerCase(); }
  function formatLapDuration(seconds) { return String(seconds); }
  return { f1TimingSegments, f1TimingPositionRowsAt, getF1LiveTimingSnapshot, f1LiveTimingCatchUpRemainingSeconds, parseF1TimingArchiveRows, setF1LiveTimingState, getF1LiveTimingState, resyncF1LiveTiming, setF1TimingSmokeNowMs, applyF1TimingSignalRMessage, compactF1TimingLiveEntries, mergeF1TimingDelta, f1TimingMergeSectorSegments, f1TimingBackfillSegmentHoles };
})()`, { Buffer, zlib });
const f1TimingLiveRecoverySandbox = vm.runInNewContext(`(() => {
  const F1_TIMING_LIVE_STALE_MS = 25000;
  const F1_TIMING_LIVE_CONNECT_RETRY_MS = 5000;
  const F1_TIMING_LIVE_CLOSE_RETRY_MS = 2500;
  let f1LiveTimingClient = null;
  let f1LiveTimingState = null;
  let signalCookieRequests = 0;
  function requestF1TimingSignalRCookie() {
    signalCookieRequests += 1;
    return new Promise(() => {});
  }
  function requestF1TimingJsonPost() { throw new Error("negotiate should wait for the cookie fixture"); }
  function getF1TvSubscriptionToken() { return ""; }
  function createF1TimingWebSocket() { throw new Error("websocket should wait for negotiation"); }
  function finiteNumber(value) {
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
  }
  function f1LiveTimingFeedLatencySeconds() { return 0; }
  function f1LiveTimingStreamAlignmentSeconds() { return 4.6; }
  function f1TimingArchiveSecondsForUtc(_sessionData, targetUtcMs) { return targetUtcMs / 1000; }
  function parseF1TimingArchiveRows() {
    return {
      timing: [{ number: 1, code: "VER", telemetry: { speed: 300, gear: 8 } }],
      weather: {},
      sessionClock: {},
      raceControlMessages: [],
      diagnostics: {},
    };
  }
  function f1TimingLiveTopicDiagnostics() { return {}; }
  ${[
    "f1TimingLiveClientIsStale",
    "closeF1TimingLiveClient",
    "recoverStaleF1TimingLiveClient",
    "ensureF1TimingLiveClient",
    "getF1LiveTimingSnapshot",
  ].map((name) => extractNamedFunction(mainProcess, name)).join("\n")}
  function setFixture(client, state) {
    f1LiveTimingClient = client;
    f1LiveTimingState = state;
  }
  return {
    getF1LiveTimingSnapshot,
    setFixture,
    getClient: () => f1LiveTimingClient,
    getSignalCookieRequests: () => signalCookieRequests,
  };
})()`, {
  Buffer,
  URL,
});
let staleSocketCloseCalls = 0;
const staleTimingSocket = { close: () => { staleSocketCloseCalls += 1; } };
const staleTimingClient = { connected: true, connecting: false, socket: staleTimingSocket };
f1TimingLiveRecoverySandbox.setFixture(staleTimingClient, {
  entriesByTopic: {},
  lastMessageAt: Date.now() - 25001,
  lastTopic: "TimingData",
  lastError: "",
});
assert.equal(f1TimingLiveRecoverySandbox.getF1LiveTimingSnapshot(), null, "A stale live-timing snapshot should remain unavailable while recovery starts");
assert.equal(staleSocketCloseCalls, 1, "The live-timing watchdog should close a connected socket after messages become stale");
assert.equal(f1TimingLiveRecoverySandbox.getClient().connecting, true, "The live-timing watchdog should reset the stale client and immediately start reconnecting");
assert.equal(f1TimingLiveRecoverySandbox.getSignalCookieRequests(), 1, "The live-timing watchdog should start exactly one reconnect attempt");
f1TimingLiveRecoverySandbox.getF1LiveTimingSnapshot();
assert.equal(f1TimingLiveRecoverySandbox.getSignalCookieRequests(), 1, "Repeated stale snapshot reads should not start reconnect storms");
let freshSocketCloseCalls = 0;
const freshTimingClient = { connected: true, connecting: false, socket: { close: () => { freshSocketCloseCalls += 1; } } };
f1TimingLiveRecoverySandbox.setFixture(freshTimingClient, {
  entriesByTopic: {},
  lastMessageAt: Date.now(),
  lastTopic: "TimingData",
  lastError: "",
});
assert.ok(f1TimingLiveRecoverySandbox.getF1LiveTimingSnapshot(), "A fresh connected live-timing client should continue serving snapshots");
assert.equal(f1TimingLiveRecoverySandbox.getClient(), freshTimingClient, "The live-timing watchdog should retain a fresh connected client");
assert.equal(freshSocketCloseCalls, 0, "The live-timing watchdog should not close a fresh connected socket");
const f1TimingReconnectGraceSandbox = vm.runInNewContext(`(() => {
  const F1_TIMING_LIVE_STALE_MS = 25000;
  const F1_TIMING_LIVE_CONNECT_RETRY_MS = 5000;
  const F1_TIMING_LIVE_CLOSE_RETRY_MS = 2500;
  const F1_TIMING_NEGOTIATE_URL = "https://example.test/negotiate";
  const F1_TIMING_SIGNALR_URL = "wss://example.test/connect";
  const F1_TIMING_SIGNALR_TOPICS = ["TimingData"];
  let fixtureNowMs = 1000000;
  Date.now = () => fixtureNowMs;
  let f1LiveTimingClient = null;
  let f1LiveTimingState = null;
  let connectionAttempts = 0;
  const sockets = [];
  function requestF1TimingSignalRCookie() {
    connectionAttempts += 1;
    return Promise.resolve("");
  }
  function requestF1TimingJsonPost() { return Promise.resolve({ connectionId: \`fixture-\${connectionAttempts}\` }); }
  function getF1TvSubscriptionToken() { return ""; }
  function createF1TimingWebSocket() {
    const socket = {
      closeCount: 0,
      send() {},
      close() { this.closeCount += 1; },
    };
    sockets.push(socket);
    return socket;
  }
  function finiteNumber(value) {
    if (value === null || value === undefined || value === "") return null;
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
  }
  function f1LiveTimingFeedLatencySeconds() { return 0; }
  function f1LiveTimingStreamAlignmentSeconds() { return 4.6; }
  function f1TimingArchiveSecondsForUtc(_sessionData, targetUtcMs) { return targetUtcMs / 1000; }
  function parseF1TimingArchiveRows() { throw new Error("stale data should not be parsed during reconnect grace"); }
  function f1TimingLiveTopicDiagnostics() { return {}; }
  ${[
    "f1TimingLiveClientIsStale",
    "closeF1TimingLiveClient",
    "recoverStaleF1TimingLiveClient",
    "ensureF1TimingLiveClient",
    "getF1LiveTimingSnapshot",
  ].map((name) => extractNamedFunction(mainProcess, name)).join("\n")}
  return {
    getF1LiveTimingSnapshot,
    setFixture(client, state) {
      f1LiveTimingClient = client;
      f1LiveTimingState = state;
    },
    advance(ms) { fixtureNowMs += ms; },
    getClient: () => f1LiveTimingClient,
    getConnectionAttempts: () => connectionAttempts,
    getSocket: (index) => sockets[index],
  };
})()`, {
  Buffer,
  URL,
  Date: { now: () => 1000000 },
});
const graceOldSocket = { closeCount: 0, close() { this.closeCount += 1; } };
f1TimingReconnectGraceSandbox.setFixture(
  { connected: true, connecting: false, socket: graceOldSocket },
  {
    entriesByTopic: {},
    lastMessageAt: 1000000 - 25001,
    lastTopic: "TimingData",
    lastError: "",
  },
);
assert.equal(f1TimingReconnectGraceSandbox.getF1LiveTimingSnapshot(), null, "Initial stale data should remain unavailable while its socket is replaced");
for (let index = 0; index < 6; index += 1) await Promise.resolve();
const graceReplacementSocket = f1TimingReconnectGraceSandbox.getSocket(0);
assert.ok(graceReplacementSocket, "Stale live-timing recovery should create one replacement socket");
graceReplacementSocket.onopen();
assert.equal(f1TimingReconnectGraceSandbox.getF1LiveTimingSnapshot(), null, "Opening a replacement socket should not serve the previous socket's stale timing state");
assert.equal(graceOldSocket.closeCount, 1, "The original stale socket should be closed exactly once");
assert.equal(graceReplacementSocket.closeCount, 0, "A newly opened replacement socket should receive a message grace period before recovery");
assert.equal(f1TimingReconnectGraceSandbox.getConnectionAttempts(), 1, "Polling during replacement grace should not start a second connection attempt");
f1TimingReconnectGraceSandbox.advance(25001);
assert.equal(f1TimingReconnectGraceSandbox.getF1LiveTimingSnapshot(), null, "A replacement that stays silent past the grace period should remain unavailable");
assert.equal(graceReplacementSocket.closeCount, 1, "A replacement socket that remains silent beyond grace should be closed for recovery");
assert.equal(f1TimingReconnectGraceSandbox.getConnectionAttempts(), 2, "One new recovery should be allowed after a replacement socket's message grace expires");
f1TimingReconnectGraceSandbox.getF1LiveTimingSnapshot();
assert.equal(f1TimingReconnectGraceSandbox.getConnectionAttempts(), 2, "Repeated polls during the second connection attempt should remain deduplicated");
const f1TimingAttemptOwnershipSandbox = vm.runInNewContext(`(() => {
  const F1_TIMING_LIVE_STALE_MS = 25000;
  const F1_TIMING_LIVE_CONNECT_RETRY_MS = 5000;
  const F1_TIMING_LIVE_CLOSE_RETRY_MS = 2500;
  const F1_TIMING_NEGOTIATE_URL = "https://example.test/negotiate";
  const F1_TIMING_SIGNALR_URL = "wss://example.test/connect";
  const F1_TIMING_SIGNALR_TOPICS = ["TimingData"];
  let f1LiveTimingClient = null;
  let f1LiveTimingState = { entriesByTopic: {}, lastMessageAt: 0, lastTopic: "", lastError: "" };
  let appliedMessages = 0;
  const cookies = [];
  const negotiations = [];
  const tokens = [];
  const sockets = [];
  function deferred(list) {
    let resolve;
    let reject;
    const promise = new Promise((res, rej) => {
      resolve = res;
      reject = rej;
    });
    list.push({ promise, resolve, reject });
    return promise;
  }
  function requestF1TimingSignalRCookie() { return deferred(cookies); }
  function requestF1TimingJsonPost() { return deferred(negotiations); }
  function getF1TvSubscriptionToken() { return deferred(tokens); }
  function createF1TimingWebSocket() {
    const socket = {
      closeCount: 0,
      sendCount: 0,
      send() { this.sendCount += 1; },
      close() { this.closeCount += 1; },
    };
    sockets.push(socket);
    return socket;
  }
  function applyF1TimingSignalRMessage() { appliedMessages += 1; }
  function finiteNumber(value) {
    if (value === null || value === undefined || value === "") return null;
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
  }
  ${[
    "f1TimingLiveClientIsStale",
    "closeF1TimingLiveClient",
    "recoverStaleF1TimingLiveClient",
    "resyncF1LiveTiming",
    "ensureF1TimingLiveClient",
  ].map((name) => extractNamedFunction(mainProcess, name)).join("\n")}
  return {
    startEnsure: () => ensureF1TimingLiveClient(),
    resync: () => resyncF1LiveTiming(),
    getClient: () => f1LiveTimingClient,
    getCookieCount: () => cookies.length,
    getNegotiationCount: () => negotiations.length,
    getTokenCount: () => tokens.length,
    getSocket: (index) => sockets[index],
    getAppliedMessages: () => appliedMessages,
    resolveCookie: (index, value = "") => cookies[index].resolve(value),
    resolveNegotiation: (index, value) => negotiations[index].resolve(value),
    rejectNegotiation: (index, error) => negotiations[index].reject(error),
    resolveToken: (index, value = "") => tokens[index].resolve(value),
  };
})()`, {
  Buffer,
  URL,
});
const obsoleteCookieAttempt = f1TimingAttemptOwnershipSandbox.startEnsure();
assert.equal(f1TimingAttemptOwnershipSandbox.getCookieCount(), 1, "The first live-timing connection attempt should pause at cookie discovery");
f1TimingAttemptOwnershipSandbox.resync();
const cookieReplacementClient = f1TimingAttemptOwnershipSandbox.getClient();
assert.equal(f1TimingAttemptOwnershipSandbox.getCookieCount(), 2, "Manual resync should create a replacement while the obsolete cookie attempt is pending");
f1TimingAttemptOwnershipSandbox.resolveCookie(0, "obsolete-cookie");
for (let index = 0; index < 3; index += 1) await Promise.resolve();
assert.equal(f1TimingAttemptOwnershipSandbox.getNegotiationCount(), 0, "An attempt replaced during cookie discovery should stop before negotiation");
assert.equal(f1TimingAttemptOwnershipSandbox.getClient(), cookieReplacementClient, "An obsolete cookie attempt should not replace or mutate the newer global client");
await obsoleteCookieAttempt;
f1TimingAttemptOwnershipSandbox.resolveCookie(1, "replacement-cookie");
for (let index = 0; index < 3; index += 1) await Promise.resolve();
assert.equal(f1TimingAttemptOwnershipSandbox.getNegotiationCount(), 1, "The current replacement should advance to negotiation");
f1TimingAttemptOwnershipSandbox.resync();
const negotiationReplacementClient = f1TimingAttemptOwnershipSandbox.getClient();
f1TimingAttemptOwnershipSandbox.resolveNegotiation(0, { connectionId: "obsolete-negotiate" });
for (let index = 0; index < 3; index += 1) await Promise.resolve();
assert.equal(f1TimingAttemptOwnershipSandbox.getTokenCount(), 0, "An attempt replaced during negotiation should stop before token or socket creation");
assert.equal(f1TimingAttemptOwnershipSandbox.getClient(), negotiationReplacementClient, "An obsolete negotiated attempt should not overwrite the newer client");
f1TimingAttemptOwnershipSandbox.resolveCookie(2, "current-cookie");
for (let index = 0; index < 3; index += 1) await Promise.resolve();
f1TimingAttemptOwnershipSandbox.resolveNegotiation(1, { connectionId: "current-negotiate" });
for (let index = 0; index < 3; index += 1) await Promise.resolve();
f1TimingAttemptOwnershipSandbox.resolveToken(0, "");
for (let index = 0; index < 3; index += 1) await Promise.resolve();
const ownedSocket = f1TimingAttemptOwnershipSandbox.getSocket(0);
assert.ok(ownedSocket, "The current connection attempt should attach its socket");
const obsoleteHandlers = {
  open: ownedSocket.onopen,
  message: ownedSocket.onmessage,
  error: ownedSocket.onerror,
  close: ownedSocket.onclose,
};
obsoleteHandlers.open();
assert.equal(ownedSocket.sendCount, 2, "The current socket should send its handshake and subscription when opened");
f1TimingAttemptOwnershipSandbox.resync();
const handlerReplacementClient = f1TimingAttemptOwnershipSandbox.getClient();
await obsoleteHandlers.message({ data: JSON.stringify({ type: 1 }) });
obsoleteHandlers.error();
obsoleteHandlers.close();
obsoleteHandlers.open();
assert.equal(f1TimingAttemptOwnershipSandbox.getClient(), handlerReplacementClient, "Handlers captured from an obsolete socket should not mutate the replacement client");
assert.equal(f1TimingAttemptOwnershipSandbox.getAppliedMessages(), 0, "An obsolete socket message should not reach live timing state");
assert.equal(ownedSocket.sendCount, 2, "An obsolete socket open handler should not send another handshake");
f1TimingAttemptOwnershipSandbox.resolveCookie(3, "catch-cookie");
for (let index = 0; index < 3; index += 1) await Promise.resolve();
f1TimingAttemptOwnershipSandbox.resync();
const catchReplacementClient = f1TimingAttemptOwnershipSandbox.getClient();
f1TimingAttemptOwnershipSandbox.rejectNegotiation(2, new Error("obsolete negotiation failed"));
for (let index = 0; index < 3; index += 1) await Promise.resolve();
assert.equal(f1TimingAttemptOwnershipSandbox.getClient(), catchReplacementClient, "An obsolete attempt's catch path should not overwrite the replacement client");
assert.equal(catchReplacementClient.connecting, true, "An obsolete attempt's catch path should leave the replacement connection active");
assert.deepEqual(
  f1TimingRaceControlSandbox.f1TimingSegments({ Segments: [{ Status: 0 }, { Status: 2048 }, { Status: 0 }] }),
  ["off", "yellow"],
  "F1 timing mini sectors should preserve leading off ticks so active segments do not shift left",
);
assert.deepEqual(
  JSON.parse(JSON.stringify(f1TimingRaceControlSandbox.f1TimingSegments({ Segments: { "2": { Status: 2048 } } }))),
  ["off", "off", "yellow"],
  "F1 timing mini sectors should preserve sparse live segment indexes instead of filling the first tick",
);
assert.deepEqual(
  f1TimingRaceControlSandbox.f1TimingBackfillSegmentHoles(["off", "off", "yellow", "green"]),
  ["yellow", "yellow", "yellow", "green"],
  "Mini-sector holes before the latest active tick should backfill as yellow (sequential track order)",
);
assert.deepEqual(
  Array.from(f1TimingRaceControlSandbox.f1TimingMergeSectorSegments(["yellow", "yellow"], ["off", "off", "green"])),
  ["yellow", "yellow", "green"],
  "Sparse later mini-sector ticks should not leave a grey hole between previous progress and the new tick",
);
assert.deepEqual(
  JSON.parse(JSON.stringify(
    f1TimingRaceControlSandbox.mergeF1TimingDelta(
      { Lines: { "4": { Sectors: { "0": { Segments: [{ Status: 2048 }, { Status: 2048 }, { Status: 2048 }] } } } } },
      { Lines: { "4": { Sectors: { "0": { Segments: { "3": { Status: 2049 } } } } } } },
    ).Lines["4"].Sectors["0"].Segments,
  )),
  {
    "0": { Status: 2048 },
    "1": { Status: 2048 },
    "2": { Status: 2048 },
    "3": { Status: 2049 },
  },
  "Sparse Segments object deltas must merge into prior Segments arrays instead of wiping them",
);
const sectorArrayThenSparseObjectSession = {
  driverListEntries: [{ seconds: 0, data: { "4": { Tla: "NOR" } } }],
  timingEntries: [
    { seconds: 10, data: { Lines: { "4": { RacingNumber: "4", Position: 1, NumberOfLaps: 12, Sectors: {
      "0": { Segments: [{ Status: 2048 }, { Status: 2048 }, { Status: 2048 }, { Status: 2048 }] },
    } } } } },
    { seconds: 11, data: { Lines: { "4": { RacingNumber: "4", Position: 1, NumberOfLaps: 12, Sectors: {
      "0": { Segments: { "5": { Status: 2051 } } },
    } } } } },
  ],
  timingAppEntries: [],
  clockEntries: [],
  sessionStatusEntries: [],
  weatherEntries: [],
  raceControlEntries: [],
  lapCountEntries: [],
  carDataEntries: [],
};
assert.deepEqual(
  JSON.parse(JSON.stringify(f1TimingRaceControlSandbox.parseF1TimingArchiveRows(sectorArrayThenSparseObjectSession, 11, { preserveSectorProgress: true }).timing[0].sectors)),
  { s1: ["yellow", "yellow", "yellow", "yellow", "yellow", "purple"], s2: [], s3: [] },
  "Live mini sectors should keep earlier array ticks when a later sparse object tick arrives (no mid-bar greys)",
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
const sparseTimingValueDeltaSession = {
  driverListEntries: [{ seconds: 0, data: { "63": { Tla: "RUS" } } }],
  timingEntries: [
    { seconds: 10, data: { Lines: { "63": { RacingNumber: "63", Position: 1, LastLapTime: { Value: "1:08.123" }, BestLapTime: { Value: "1:07.456" }, Sectors: {
      "0": { Value: "21.123", Segments: [{ Status: 2048 }] },
      "1": { Value: "22.234", Segments: [{ Status: 2048 }] },
      "2": { Value: "24.766", Segments: [{ Status: 2048 }] },
    }, BestSectors: {
      "0": { Value: "21.000" },
      "1": { Value: "22.000" },
      "2": { Value: "24.456" },
    } } } } },
    { seconds: 11, data: { Lines: { "63": { RacingNumber: "63", Position: 1, LastLapTime: { Value: "" }, BestLapTime: { Value: "" }, Sectors: {
      "0": { Value: "", Segments: { "1": { Status: 2048 } } },
      "1": { Value: "" },
    }, BestSectors: {
      "0": { Value: "" },
    } } } } },
  ],
  timingAppEntries: [],
  clockEntries: [],
  sessionStatusEntries: [],
  weatherEntries: [],
  raceControlEntries: [],
  lapCountEntries: [],
  carDataEntries: [],
};
const sparseTimingValueRow = f1TimingRaceControlSandbox.parseF1TimingArchiveRows(sparseTimingValueDeltaSession, 11, { preserveSectorProgress: true }).timing[0];
assert.equal(sparseTimingValueRow.lastLapDuration, 68.123, "Live Formula 1 timing should not let blank LastLapTime deltas erase the last completed lap");
assert.equal(sparseTimingValueRow.bestLapDuration, 67.456, "Live Formula 1 timing should not let blank BestLapTime deltas erase the personal best lap");
assert.deepEqual(
  JSON.parse(JSON.stringify(sparseTimingValueRow.sectorTimes)),
  { s1: 21.123, s2: 22.234, s3: 24.766 },
  "Live Formula 1 timing should preserve sector split times when sparse deltas only update mini-sector progress",
);
assert.deepEqual(
  JSON.parse(JSON.stringify(sparseTimingValueRow.bestSectorTimes)),
  { s1: 21, s2: 22, s3: 24.456 },
  "Live Formula 1 timing should preserve best-sector split times when sparse deltas omit them",
);
const sectorTimeRolloverRows = f1TimingRaceControlSandbox.parseF1TimingArchiveRows({
  driverListEntries: [{ seconds: 0, data: { "63": { Tla: "RUS" } } }],
  timingEntries: [
    { seconds: 10, data: { Lines: { "63": { RacingNumber: "63", Position: 1, NumberOfLaps: 39, Sectors: {
      "0": { Value: "21.123", Segments: [{ Status: 2048 }, { Status: 2048 }] },
      "1": { Value: "22.234", Segments: [{ Status: 2048 }, { Status: 2048 }] },
      "2": { Value: "24.766", Segments: [{ Status: 2048 }] },
    } } } } },
    { seconds: 11, data: { Lines: { "63": { RacingNumber: "63", Position: 1, NumberOfLaps: 39, Sectors: {
      "0": { Value: "", Segments: [{ Status: 2048 }] },
    } } } } },
  ],
  timingAppEntries: [],
  clockEntries: [],
  sessionStatusEntries: [],
  weatherEntries: [],
  raceControlEntries: [],
  lapCountEntries: [],
  carDataEntries: [],
}, 11, { preserveSectorProgress: true }).timing;
assert.deepEqual(
  JSON.parse(JSON.stringify(sectorTimeRolloverRows[0].sectorTimes)),
  { s1: null, s2: null, s3: null },
  "Live Formula 1 timing should clear current-lap sector times when segment progress rolls into a new lap",
);
const sectorResetSession = {
  driverListEntries: [{ seconds: 0, data: { "4": { Tla: "NOR" } } }],
  timingEntries: [
    { seconds: 10, data: { Lines: { "4": { RacingNumber: "4", Position: 1, NumberOfLaps: 39, Sectors: { "0": { Segments: [{ Status: 2048 }, { Status: 2048 }] } } } } } },
    { seconds: 11, data: { Lines: { "4": { RacingNumber: "4", Position: 1, NumberOfLaps: 39, Sectors: { "0": { Segments: [{ Status: 0 }, { Status: 0 }] }, "1": { Segments: [{ Status: 2048 }] } } } } } },
  ],
  timingAppEntries: [],
  clockEntries: [],
  sessionStatusEntries: [],
  weatherEntries: [],
  raceControlEntries: [],
  lapCountEntries: [],
  carDataEntries: [],
};
assert.deepEqual(
  JSON.parse(JSON.stringify(f1TimingRaceControlSandbox.parseF1TimingArchiveRows(sectorResetSession, 11, { preserveSectorProgress: true }).timing[0].sectors)),
  { s1: ["yellow", "yellow"], s2: ["yellow"], s3: [] },
  "Live Formula 1 mini sectors should not disappear when the feed resets an earlier sector within the same lap",
);
const sectorSparseMergeSession = {
  driverListEntries: [{ seconds: 0, data: { "4": { Tla: "NOR" } } }],
  timingEntries: [
    { seconds: 10, data: { Lines: { "4": { RacingNumber: "4", Position: 1, NumberOfLaps: 39, Sectors: { "0": { Segments: [{ Status: 2048 }, { Status: 2048 }] } } } } } },
    { seconds: 11, data: { Lines: { "4": { RacingNumber: "4", Position: 1, NumberOfLaps: 39, Sectors: { "0": { Segments: { "2": { Status: 2048 } } } } } } } },
  ],
  timingAppEntries: [],
  clockEntries: [],
  sessionStatusEntries: [],
  weatherEntries: [],
  raceControlEntries: [],
  lapCountEntries: [],
  carDataEntries: [],
};
assert.deepEqual(
  JSON.parse(JSON.stringify(f1TimingRaceControlSandbox.parseF1TimingArchiveRows(sectorSparseMergeSession, 11, { preserveSectorProgress: true }).timing[0].sectors)),
  { s1: ["yellow", "yellow", "yellow"], s2: [], s3: [] },
  "Live Formula 1 mini sectors should merge sparse later ticks instead of dropping them as a shorter update",
);
const sectorInitialSparseSession = {
  driverListEntries: [{ seconds: 0, data: { "4": { Tla: "NOR" } } }],
  timingEntries: [
    { seconds: 10, data: { Lines: { "4": { RacingNumber: "4", Position: 1, NumberOfLaps: 39, Sectors: { "0": { Segments: { "1": { Status: 2048 }, "2": { Status: 2048 } } } } } } } },
  ],
  timingAppEntries: [],
  clockEntries: [],
  sessionStatusEntries: [],
  weatherEntries: [],
  raceControlEntries: [],
  lapCountEntries: [],
  carDataEntries: [],
};
assert.deepEqual(
  JSON.parse(JSON.stringify(f1TimingRaceControlSandbox.parseF1TimingArchiveRows(sectorInitialSparseSession, 10, { preserveSectorProgress: true }).timing[0].sectors)),
  { s1: ["yellow", "yellow"], s2: [], s3: [] },
  "Live Formula 1 mini sectors should not render leading off ticks when the first observed sector update is sparse",
);
const sectorLateJoinRolloverSession = {
  driverListEntries: [{ seconds: 0, data: { "4": { Tla: "NOR" } } }],
  timingEntries: [
    { seconds: 10, data: { Lines: { "4": { RacingNumber: "4", Position: 1, NumberOfLaps: 39, Sectors: {
      "1": { Segments: [{ Status: 2049 }, { Status: 2049 }, { Status: 2049 }] },
      "2": { Segments: [{ Status: 2049 }, { Status: 2049 }] },
    } } } } },
    { seconds: 11, data: { Lines: { "4": { RacingNumber: "4", Position: 1, NumberOfLaps: 39, Sectors: {
      "0": { Segments: [{ Status: 2049 }] },
    } } } } },
  ],
  timingAppEntries: [],
  clockEntries: [],
  sessionStatusEntries: [],
  weatherEntries: [],
  raceControlEntries: [],
  lapCountEntries: [],
  carDataEntries: [],
};
const sectorLateJoinRolloverRow = f1TimingRaceControlSandbox.parseF1TimingArchiveRows(sectorLateJoinRolloverSession, 11, { preserveSectorProgress: true }).timing[0];
assert.deepEqual(
  JSON.parse(JSON.stringify(sectorLateJoinRolloverRow.sectors)),
  { s1: ["green"], s2: [], s3: [] },
  "Live Formula 1 mini sectors should clear stale later sectors when S1 appears after joining mid-lap",
);
assert.equal(
  sectorLateJoinRolloverRow.sessionLap,
  40,
  "Live Formula 1 mini sectors should advance the displayed lap when S1 restarts after only later-sector history was known",
);
const inPitGarageSession = {
  driverListEntries: [{ seconds: 0, data: { "44": { Tla: "HAM" } } }],
  timingEntries: [
    { seconds: 10, data: { Lines: { "44": { RacingNumber: "44", Position: 1, InPit: true, PitOut: true } } } },
  ],
  timingAppEntries: [],
  clockEntries: [],
  sessionStatusEntries: [],
  weatherEntries: [],
  raceControlEntries: [],
  lapCountEntries: [],
  carDataEntries: [],
};
const inPitGarageRow = f1TimingRaceControlSandbox.parseF1TimingArchiveRows(inPitGarageSession, 10, { preserveSectorProgress: true }).timing[0];
assert.equal(
  inPitGarageRow.state,
  "IN PIT",
  "Live Formula 1 timing should prefer IN PIT when PitOut lingers but no blue out-lap sector is present",
);
const inPitClearsStaleSectorSession = {
  driverListEntries: [{ seconds: 0, data: { "44": { Tla: "HAM" } } }],
  timingEntries: [
    { seconds: 10, data: { Lines: { "44": { RacingNumber: "44", Position: 1, NumberOfLaps: 12, Sectors: {
      "0": { Value: "21.111", Segments: [{ Status: 2049 }, { Status: 2049 }] },
      "1": { Value: "22.222", Segments: [{ Status: 2048 }, { Status: 2048 }, { Status: 2048 }] },
      "2": { Value: "23.333", Segments: [{ Status: 2064 }] },
    } } } } },
    { seconds: 11, data: { Lines: { "44": { RacingNumber: "44", Position: 1, NumberOfLaps: 12, InPit: true } } } },
  ],
  timingAppEntries: [],
  clockEntries: [],
  sessionStatusEntries: [],
  weatherEntries: [],
  raceControlEntries: [],
  lapCountEntries: [],
  carDataEntries: [],
};
const inPitClearsStaleSectorRow = f1TimingRaceControlSandbox.parseF1TimingArchiveRows(inPitClearsStaleSectorSession, 11, { preserveSectorProgress: true }).timing[0];
assert.deepEqual(
  JSON.parse(JSON.stringify(inPitClearsStaleSectorRow.sectors)),
  { s1: [], s2: [], s3: [] },
  "Live Formula 1 timing should clear stale mini sectors when a car is back in pit between qualifying parts",
);
assert.equal(
  inPitClearsStaleSectorRow.state,
  "IN PIT",
  "Stale blue mini sectors should not make an in-pit car look like PIT OUT during a qualifying break",
);
const inPitFreshSectorSession = {
  driverListEntries: [{ seconds: 0, data: { "44": { Tla: "HAM" } } }],
  timingEntries: [
    { seconds: 10, data: { Lines: { "44": { RacingNumber: "44", Position: 1, InPit: true, Sectors: {
      "0": { Value: "21.456", Segments: [{ Status: 2049 }, { Status: 2049 }] },
    } } } } },
  ],
  timingAppEntries: [],
  clockEntries: [],
  sessionStatusEntries: [],
  weatherEntries: [],
  raceControlEntries: [],
  lapCountEntries: [],
  carDataEntries: [],
};
const inPitFreshSectorRow = f1TimingRaceControlSandbox.parseF1TimingArchiveRows(inPitFreshSectorSession, 10, { preserveSectorProgress: true }).timing[0];
assert.deepEqual(
  JSON.parse(JSON.stringify(inPitFreshSectorRow.sectors)),
  { s1: ["green", "green"], s2: [], s3: [] },
  "Live Formula 1 timing should keep fresh mini-sector updates even when InPit lingers",
);
assert.deepEqual(
  JSON.parse(JSON.stringify(inPitFreshSectorRow.sectorTimes)),
  { s1: 21.456, s2: null, s3: null },
  "Live Formula 1 timing should keep fresh sector times even when InPit lingers",
);
const qualifyingPartResetSession = {
  driverListEntries: [{ seconds: 0, data: { "16": { Tla: "LEC" } } }],
  timingEntries: [
    { seconds: 10, data: { Lines: { "16": { RacingNumber: "16", Position: 1, Line: 1, LastLapTime: { Value: "1:30.111" }, BestLapTime: { Value: "1:29.500" }, Sectors: {
      "0": { Value: "21.111", Segments: [{ Status: 2049 }] },
      "1": { Value: "22.222", Segments: [{ Status: 2048 }] },
    } } } } },
    { seconds: 21, data: { Lines: { "16": { RacingNumber: "16", Position: 1, Line: 1, LastLapTime: { Value: "" }, BestLapTime: { Value: "" }, Sectors: {} } } } },
  ],
  timingAppEntries: [],
  clockEntries: [],
  sessionDataEntries: [
    { seconds: 1, data: { Series: { "1": { QualifyingPart: 1 } } } },
    { seconds: 20, data: { Series: { "2": { QualifyingPart: 2 } } } },
  ],
  sessionStatusEntries: [],
  weatherEntries: [],
  raceControlEntries: [],
  lapCountEntries: [],
  carDataEntries: [],
};
const qualifyingPartResetRow = f1TimingRaceControlSandbox.parseF1TimingArchiveRows(qualifyingPartResetSession, 21, { preserveSectorProgress: true }).timing[0];
assert.deepEqual(
  JSON.parse(JSON.stringify({
    last: qualifyingPartResetRow.last,
    best: qualifyingPartResetRow.best,
    lastLapDuration: qualifyingPartResetRow.lastLapDuration,
    bestLapDuration: qualifyingPartResetRow.bestLapDuration,
    sectors: qualifyingPartResetRow.sectors,
    sectorTimes: qualifyingPartResetRow.sectorTimes,
  })),
  {
    last: "",
    best: "",
    lastLapDuration: null,
    bestLapDuration: null,
    sectors: { s1: [], s2: [], s3: [] },
    sectorTimes: { s1: null, s2: null, s3: null },
  },
  "Q2/Q3 timing should reset Q1 lap times and mini sectors until the new part sends fresh data",
);
const qualifyingLineOrderSession = {
  driverListEntries: [{ seconds: 0, data: { "16": { Tla: "LEC" }, "44": { Tla: "HAM" }, "4": { Tla: "NOR" } } }],
  timingEntries: [{ seconds: 20, data: { Lines: {
    "16": { RacingNumber: "16", Position: 1, Line: 3, BestLapTime: { Value: "1:29.500" } },
    "44": { RacingNumber: "44", Position: 2, Line: 1, BestLapTime: { Value: "1:29.600" } },
    "4": { RacingNumber: "4", Position: 3, Line: 2, BestLapTime: { Value: "1:29.700" } },
  } } }],
  timingAppEntries: [],
  clockEntries: [],
  sessionDataEntries: [{ seconds: 20, data: { Series: { "2": { QualifyingPart: 2 } } } }],
  sessionStatusEntries: [],
  weatherEntries: [],
  raceControlEntries: [],
  lapCountEntries: [],
  carDataEntries: [],
};
assert.deepEqual(
  JSON.parse(JSON.stringify(f1TimingRaceControlSandbox.parseF1TimingArchiveRows(qualifyingLineOrderSession, 20).timing.map((row) => [row.pos, row.code]))),
  [[1, "HAM"], [2, "NOR"], [3, "LEC"]],
  "Qualifying timing should follow live Line order when Position still reflects the previous classification",
);
const racePositionOrderSession = {
  driverListEntries: [{ seconds: 0, data: { "16": { Tla: "LEC" }, "44": { Tla: "HAM" }, "4": { Tla: "NOR" } } }],
  timingEntries: [{ seconds: 20, data: { Lines: {
    "16": { RacingNumber: "16", Position: 1, Line: 3 },
    "44": { RacingNumber: "44", Position: 2, Line: 1 },
    "4": { RacingNumber: "4", Position: 3, Line: 2 },
  } } }],
  timingAppEntries: [],
  clockEntries: [],
  sessionDataEntries: [],
  sessionStatusEntries: [],
  weatherEntries: [],
  raceControlEntries: [],
  lapCountEntries: [],
  carDataEntries: [],
};
assert.deepEqual(
  JSON.parse(JSON.stringify(f1TimingRaceControlSandbox.parseF1TimingArchiveRows(racePositionOrderSession, 20).timing.map((row) => [row.pos, row.code]))),
  [[1, "LEC"], [2, "HAM"], [3, "NOR"]],
  "Race timing should keep Position as the running order even when Line differs",
);
const pitOutBlueSegmentSession = {
  driverListEntries: [{ seconds: 0, data: { "4": { Tla: "NOR" } } }],
  timingEntries: [
    { seconds: 10, data: { Lines: { "4": { RacingNumber: "4", Position: 1, InPit: true, Sectors: {
      "0": { Segments: [{ Status: 2064 }] },
    } } } } },
  ],
  timingAppEntries: [],
  clockEntries: [],
  sessionStatusEntries: [],
  weatherEntries: [],
  raceControlEntries: [],
  lapCountEntries: [],
  carDataEntries: [],
};
const pitOutBlueSegmentRow = f1TimingRaceControlSandbox.parseF1TimingArchiveRows(pitOutBlueSegmentSession, 10, { preserveSectorProgress: true }).timing[0];
assert.equal(
  pitOutBlueSegmentRow.state,
  "PIT OUT",
  "Live Formula 1 timing should show PIT OUT when blue out-lap sectors arrive before InPit clears",
);
assert.deepEqual(
  JSON.parse(JSON.stringify(pitOutBlueSegmentRow.sectors)),
  { s1: ["blue"], s2: [], s3: [] },
  "Live Formula 1 timing should preserve blue pit-out mini sectors without pulling stale sector history forward",
);
const driverStatusFlagsSandbox = vm.runInNewContext(`(() => {
  ${extractNamedFunction(mainProcess, "finiteNumber")}
  ${extractNamedFunction(mainProcess, "f1TimingDriverStatusFlags")}
  return { f1TimingDriverStatusFlags };
})()`);
assert.deepEqual(
  JSON.parse(JSON.stringify(driverStatusFlagsSandbox.f1TimingDriverStatusFlags(80))),
  { stopped: false, retired: false, inPit: true, pitOut: false, knockedOut: false, cutoff: false },
  "Driver status flags should decode the InPit bit from the F1 timing Status bitfield",
);
assert.deepEqual(
  JSON.parse(JSON.stringify(driverStatusFlagsSandbox.f1TimingDriverStatusFlags(96))),
  { stopped: false, retired: false, inPit: false, pitOut: true, knockedOut: false, cutoff: false },
  "Driver status flags should decode the PitOut bit from the F1 timing Status bitfield",
);
assert.equal(driverStatusFlagsSandbox.f1TimingDriverStatusFlags(undefined), null, "Driver status flags should be null when the feed omits the Status bitfield");
const inLapBlueTailSession = {
  driverListEntries: [{ seconds: 0, data: { "12": { Tla: "ANT" } } }],
  timingEntries: [
    { seconds: 10, data: { Lines: { "12": { RacingNumber: "12", Position: 1, InPit: true, PitOut: true, Sectors: {
      "0": { Value: "21.111", Segments: [{ Status: 2049 }, { Status: 2049 }] },
      "1": { Value: "22.222", Segments: [{ Status: 2048 }, { Status: 2048 }] },
      "2": { Value: "23.333", Segments: [{ Status: 2048 }, { Status: 2064 }, { Status: 2064 }] },
    } } } } },
  ],
  timingAppEntries: [],
  clockEntries: [],
  sessionStatusEntries: [],
  weatherEntries: [],
  raceControlEntries: [],
  lapCountEntries: [],
  carDataEntries: [],
};
assert.equal(
  f1TimingRaceControlSandbox.parseF1TimingArchiveRows(inLapBlueTailSession, 10, { preserveSectorProgress: true }).timing[0].state,
  "IN PIT",
  "Blue pit-entry segments at the end of an in-lap must not relabel an in-pit car as PIT OUT at the end of a qualifying part",
);
const statusBitfieldInPitSession = {
  driverListEntries: [{ seconds: 0, data: { "12": { Tla: "ANT" } } }],
  timingEntries: [
    { seconds: 10, data: { Lines: { "12": { RacingNumber: "12", Position: 1, Status: 80, PitOut: true, Sectors: {
      "0": { Segments: [{ Status: 2064 }] },
    } } } } },
  ],
  timingAppEntries: [],
  clockEntries: [],
  sessionStatusEntries: [],
  weatherEntries: [],
  raceControlEntries: [],
  lapCountEntries: [],
  carDataEntries: [],
};
assert.equal(
  f1TimingRaceControlSandbox.parseF1TimingArchiveRows(statusBitfieldInPitSession, 10, { preserveSectorProgress: true }).timing[0].state,
  "IN PIT",
  "The atomic Status bitfield should decide IN PIT over lingering PitOut booleans and blue segments, matching MultiViewer",
);
const statusBitfieldPitOutSession = {
  driverListEntries: [{ seconds: 0, data: { "12": { Tla: "ANT" } } }],
  timingEntries: [
    { seconds: 10, data: { Lines: { "12": { RacingNumber: "12", Position: 1, Status: 96, InPit: true } } } } ,
  ],
  timingAppEntries: [],
  clockEntries: [],
  sessionStatusEntries: [],
  weatherEntries: [],
  raceControlEntries: [],
  lapCountEntries: [],
  carDataEntries: [],
};
assert.equal(
  f1TimingRaceControlSandbox.parseF1TimingArchiveRows(statusBitfieldPitOutSession, 10, { preserveSectorProgress: true }).timing[0].state,
  "PIT OUT",
  "The atomic Status bitfield should decide PIT OUT over a lingering InPit boolean",
);
const deletedInactiveTimingLines = Array.from({ length: 22 }, (_, index) => {
  const pos = index + 1;
  return [String(pos), { RacingNumber: String(pos), Position: pos }];
});
deletedInactiveTimingLines[20][1].Stopped = true;
deletedInactiveTimingLines[21][1].Retired = true;
const deletedInactiveSession = {
  driverListEntries: [{
    seconds: 0,
    data: Object.fromEntries(deletedInactiveTimingLines.map(([number]) => [number, { Tla: `D${number}` }])),
  }],
  timingEntries: [
    { seconds: 10, data: { Lines: Object.fromEntries(deletedInactiveTimingLines) } },
    { seconds: 11, data: { Lines: { _deleted: ["21", "22"] } } },
  ],
  timingAppEntries: [],
  clockEntries: [],
  sessionStatusEntries: [],
  weatherEntries: [],
  raceControlEntries: [],
  lapCountEntries: [],
  carDataEntries: [],
};
const deletedInactiveRows = f1TimingRaceControlSandbox.parseF1TimingArchiveRows(deletedInactiveSession, 11).timing;
assert.equal(deletedInactiveRows.length, 22, "Live timing should keep STOP/RETIRED rows when F1 deletes inactive timing lines");
assert.deepEqual(
  JSON.parse(JSON.stringify(deletedInactiveRows.slice(-2).map((row) => [row.pos, row.code, row.state, row.retired]))),
  [[21, "D21", "STOP", false], [22, "D22", "RETIRED", true]],
  "Live timing should keep P21/P22 STOP and RETIRED driver rows at the bottom of the tower",
);
const sectorLapBoundarySession = {
  driverListEntries: [{ seconds: 0, data: { "4": { Tla: "NOR" } } }],
  timingEntries: [
    { seconds: 10, data: { Lines: { "4": { RacingNumber: "4", Position: 1, NumberOfLaps: 39, Sectors: {
      "0": { Segments: [{ Status: 2048 }, { Status: 2048 }] },
      "1": { Segments: [{ Status: 2048 }, { Status: 2048 }] },
      "2": { Segments: [{ Status: 2048 }, { Status: 2048 }] },
    } } } } },
    { seconds: 11, data: { Lines: { "4": { RacingNumber: "4", Position: 1, NumberOfLaps: 40, Sectors: { "0": { Segments: [{ Status: 2048 }] } } } } } },
  ],
  timingAppEntries: [],
  clockEntries: [],
  sessionStatusEntries: [],
  weatherEntries: [],
  raceControlEntries: [],
  lapCountEntries: [],
  carDataEntries: [],
};
assert.deepEqual(
  JSON.parse(JSON.stringify(f1TimingRaceControlSandbox.parseF1TimingArchiveRows(sectorLapBoundarySession, 11, { preserveSectorProgress: true }).timing[0].sectors)),
  { s1: ["yellow"], s2: [], s3: [] },
  "Live Formula 1 mini sectors should discard previous-lap sectors when a new lap starts",
);
const sectorPhaseRolloverSession = {
  driverListEntries: [{ seconds: 0, data: { "4": { Tla: "NOR" } } }],
  timingEntries: [
    { seconds: 10, data: { Lines: { "4": { RacingNumber: "4", Position: 1, NumberOfLaps: 39, Sectors: {
      "0": { Segments: [{ Status: 2048 }, { Status: 2048 }] },
      "1": { Segments: [{ Status: 2048 }, { Status: 2048 }] },
      "2": { Segments: [{ Status: 2048 }] },
    } } } } },
    { seconds: 11, data: { Lines: { "4": { RacingNumber: "4", Position: 1, NumberOfLaps: 39, Sectors: {
      "0": { Segments: [{ Status: 2048 }, { Status: 2048 }, { Status: 2048 }] },
      "1": { Segments: [{ Status: 2048 }] },
    } } } } },
  ],
  timingAppEntries: [],
  clockEntries: [],
  sessionStatusEntries: [],
  weatherEntries: [],
  raceControlEntries: [],
  lapCountEntries: [],
  carDataEntries: [],
};
assert.deepEqual(
  JSON.parse(JSON.stringify(f1TimingRaceControlSandbox.parseF1TimingArchiveRows(sectorPhaseRolloverSession, 11, { preserveSectorProgress: true }).timing[0].sectors)),
  { s1: ["yellow", "yellow", "yellow"], s2: ["yellow"], s3: [] },
  "Live Formula 1 mini sectors should clear later sectors when an earlier-sector update rolls into a new lap before the lap counter advances",
);
assert.equal(
  f1TimingRaceControlSandbox.parseF1TimingArchiveRows(sectorPhaseRolloverSession, 11, { preserveSectorProgress: true }).timing[0].sessionLap,
  40,
  "Live Formula 1 mini sectors should advance the displayed lap when segment rollover arrives before NumberOfLaps updates",
);
const sectorMergedInitialSession = {
  driverListEntries: [{ seconds: 0, data: { "4": { Tla: "NOR" } } }],
  timingEntries: [
    { seconds: 10, data: { Lines: { "4": { RacingNumber: "4", Position: 1, NumberOfLaps: 39, Sectors: {
      "0": { Segments: [{ Status: 2048 }, { Status: 2048 }, { Status: 2048 }, { Status: 2048 }, { Status: 2048 }, { Status: 2048 }] },
      "1": { Segments: [{ Status: 2048 }] },
      "2": { Segments: [{ Status: 2048 }] },
    } } } } },
  ],
  timingAppEntries: [],
  clockEntries: [],
  sessionStatusEntries: [],
  weatherEntries: [],
  raceControlEntries: [],
  lapCountEntries: [],
  carDataEntries: [],
};
assert.deepEqual(
  JSON.parse(JSON.stringify(f1TimingRaceControlSandbox.parseF1TimingArchiveRows(sectorMergedInitialSession, 10, { preserveSectorProgress: true }).timing[0].sectors)),
  { s1: ["yellow", "yellow", "yellow", "yellow", "yellow", "yellow"], s2: ["yellow"], s3: [] },
  "Live Formula 1 mini sectors should suppress stale S3 ticks when the first merged live snapshot has only started S2",
);
// Live buffer overflow used to hard-drop the subscribe snapshot after ~1000
// TimingData messages (~a few minutes). Sparse blank LastLapTime / partial
// sector deltas then rebuilt empty last laps and broken mini-sectors.
const liveBufferOverflowBaseMs = Date.parse("2026-06-09T19:50:00.000Z");
f1TimingRaceControlSandbox.setF1TimingSmokeNowMs(liveBufferOverflowBaseMs + 1000 * 1010);
f1TimingRaceControlSandbox.setF1LiveTimingState({
  lastMessageAt: liveBufferOverflowBaseMs,
  lastTopic: "TimingData",
  lastError: "",
  entriesByTopic: {
    DriverList: [{ seconds: liveBufferOverflowBaseMs / 1000, data: { "63": { Tla: "RUS", RacingNumber: "63" } } }],
    TimingData: [],
    ExtrapolatedClock: [{ seconds: liveBufferOverflowBaseMs / 1000, data: { Utc: new Date(liveBufferOverflowBaseMs).toISOString(), Remaining: "00:50:00", Extrapolating: true } }],
  },
});
f1TimingRaceControlSandbox.applyF1TimingSignalRMessage({
  type: 1,
  target: "feed",
  arguments: [
    "TimingData",
    {
      Lines: {
        "63": {
          RacingNumber: "63",
          Position: 1,
          LastLapTime: { Value: "1:08.123" },
          BestLapTime: { Value: "1:07.456" },
          NumberOfLaps: 4,
          Sectors: {
            "0": { Value: "21.100", Segments: [{ Status: 2048 }, { Status: 2048 }, { Status: 2048 }, { Status: 2048 }, { Status: 2048 }, { Status: 2048 }] },
            "1": { Value: "22.200", Segments: [{ Status: 2048 }, { Status: 2048 }, { Status: 2048 }, { Status: 2048 }, { Status: 2048 }, { Status: 2048 }] },
            "2": { Value: "24.823", Segments: [{ Status: 2048 }, { Status: 2048 }, { Status: 2048 }, { Status: 2048 }, { Status: 2048 }, { Status: 2048 }] },
          },
        },
      },
    },
    new Date(liveBufferOverflowBaseMs).toISOString(),
  ],
});
for (let index = 1; index <= 1005; index += 1) {
  const feedUtc = new Date(liveBufferOverflowBaseMs + index * 1000).toISOString();
  f1TimingRaceControlSandbox.setF1TimingSmokeNowMs(liveBufferOverflowBaseMs + index * 1000 + 200);
  f1TimingRaceControlSandbox.applyF1TimingSignalRMessage({
    type: 1,
    target: "feed",
    arguments: [
      "TimingData",
      {
        Lines: {
          "63": {
            RacingNumber: "63",
            Position: 1,
            LastLapTime: { Value: "" },
            BestLapTime: { Value: "" },
            NumberOfLaps: 5,
            Sectors: {
              "0": { Value: "", Segments: { "0": { Status: 2048 }, "1": { Status: 2048 } } },
              "1": { Value: "" },
              "2": { Value: "" },
            },
          },
        },
      },
      feedUtc,
    ],
  });
}
const overflowLiveState = f1TimingRaceControlSandbox.getF1LiveTimingState();
assert.ok(
  (overflowLiveState.entriesByTopic.TimingData || []).length < 900,
  "Live TimingData buffer should compact once it exceeds the soft limit instead of retaining every sparse delta",
);
assert.equal(
  (overflowLiveState.entriesByTopic.TimingData || [])[0]?.data?.Lines?.["63"]?.LastLapTime?.Value,
  "1:08.123",
  "Live TimingData compaction should fold the subscribe snapshot into a base entry so last-lap values survive",
);
const overflowLiveSnapshot = f1TimingRaceControlSandbox.getF1LiveTimingSnapshot();
assert.equal(overflowLiveSnapshot.timing[0].lastLapDuration, 68.123, "Live timing after buffer compaction should still expose the completed last lap");
assert.equal(overflowLiveSnapshot.timing[0].bestLapDuration, 67.456, "Live timing after buffer compaction should still expose the personal best lap");
assert.ok(
  (overflowLiveSnapshot.timing[0].sectors?.s1 || []).filter((tone) => tone && tone !== "off").length >= 2,
  "Live mini-sectors after buffer compaction should keep progress rebuilt from the folded base",
);
f1TimingRaceControlSandbox.setF1TimingSmokeNowMs(null);

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
f1TimingRaceControlSandbox.setF1LiveTimingState({
  lastMessageAt: Date.now(),
  lastTopic: "TimingData",
  lastError: "",
  entriesByTopic: {
    DriverList: [{ seconds: liveSignalRSeconds, data: { "1": { Tla: "VER", RacingNumber: "1" } } }],
    TimingData: [{ seconds: liveSignalRSeconds, data: { Lines: { "1": { RacingNumber: "1", Position: 1 } } } }],
    ExtrapolatedClock: [{ seconds: liveSignalRSeconds, data: { Utc: "2026-06-09T20:00:00.000Z", Remaining: "01:10:00", Extrapolating: true } }],
    SessionStatus: [{ seconds: liveSignalRSeconds, data: { Status: "Started" } }],
    CarData: [{ seconds: liveSignalRSeconds, data: { Entries: [{ Utc: "2026-06-09T20:00:00.000Z", Cars: { "1": { Channels: { "2": 305, "3": 8, "4": 91, "5": 0 } } } }] } }],
    Position: [{ seconds: liveSignalRSeconds, data: { Position: [{ Timestamp: "2026-06-09T20:00:00.000Z", Entries: { "1": { X: 101, Y: 202, Z: 3, Status: "OnTrack" } } }] } }],
  },
});
const liveUncompressedTopicSnapshot = f1TimingRaceControlSandbox.getF1LiveTimingSnapshot();
assert.equal(liveUncompressedTopicSnapshot.timing[0].telemetry.speed, 305, "Formula 1 SignalR live timing should accept uncompressed CarData telemetry topics");
assert.deepEqual(JSON.parse(JSON.stringify(liveUncompressedTopicSnapshot.timing[0].trackPosition)), { x: 101, y: 202, z: 3, status: "OnTrack" }, "Formula 1 SignalR live timing should accept uncompressed Position topics");
const warmingSeconds = Date.now() / 1000;
f1TimingRaceControlSandbox.setF1LiveTimingState({
  lastMessageAt: Date.now(),
  lastTopic: "TimingData",
  lastError: "",
  entriesByTopic: {
    DriverList: [{ seconds: warmingSeconds, data: { "44": { Tla: "HAM", RacingNumber: "44" } } }],
    TimingData: [{ seconds: warmingSeconds, data: { Lines: { "44": { RacingNumber: "44", Position: 1 } } } }],
  },
});
assert.equal(
  f1TimingRaceControlSandbox.getF1LiveTimingSnapshot({ targetLatencySeconds: 36 }),
  null,
  "Live timing should not show latest rows while the target-latency buffer is still warming",
);
assert.equal(
  f1TimingRaceControlSandbox.f1LiveTimingCatchUpRemainingSeconds({
    TimingData: [{ seconds: liveSignalRSeconds, data: { Lines: { "44": { RacingNumber: "44", Position: 1 } } } }],
    ExtrapolatedClock: [{ seconds: liveSignalRSeconds, data: { Utc: "2026-06-09T20:00:00.000Z" } }],
  }, { targetUtcMs: Date.parse("2026-06-09T19:59:24.000Z") }),
  40.6,
  "Live timing catch-up should estimate how long until the stream-aligned target reaches retained SignalR rows",
);
assert.equal(
  f1TimingRaceControlSandbox.f1LiveTimingCatchUpRemainingSeconds({ TimingData: [{ seconds: liveSignalRSeconds, data: { Lines: {} } }] }, { targetLatencySeconds: 0 }),
  null,
  "Live timing catch-up should omit an ETA when the target is already inside the retained timing buffer",
);
const delayedTelemetryNowMs = Date.now();
const delayedTelemetryTargetSeconds = delayedTelemetryNowMs / 1000 - 36;
f1TimingRaceControlSandbox.setF1LiveTimingState({
  lastMessageAt: delayedTelemetryNowMs,
  lastTopic: "CarData.z",
  lastError: "",
  entriesByTopic: {
    DriverList: [{ seconds: delayedTelemetryTargetSeconds - 1, data: { "1": { Tla: "VER", RacingNumber: "1" } } }],
    TimingData: [{ seconds: delayedTelemetryTargetSeconds - 1, data: { Lines: { "1": { RacingNumber: "1", Position: 1 } } } }],
    "CarData.z": [{ seconds: delayedTelemetryNowMs / 1000, data: { Entries: [{ Utc: new Date(delayedTelemetryNowMs).toISOString(), Cars: { "1": { Channels: { "2": 299, "3": 7, "4": 81, "5": 0 } } } }] } }],
  },
});
const delayedTelemetrySnapshot = f1TimingRaceControlSandbox.getF1LiveTimingSnapshot({ targetLatencySeconds: 36 });
assert.equal(delayedTelemetrySnapshot.timing[0].telemetry.speed, 299, "Buffered live timing should keep onboard speed populated while delayed CarData warms");
assert.equal(delayedTelemetrySnapshot.timing[0].telemetry.gear, 7, "Buffered live timing should keep onboard gear populated while delayed CarData warms");
const liveUtcClockMs = Date.parse("2026-06-09T20:00:00.000Z");
f1TimingRaceControlSandbox.setF1LiveTimingState({
  lastMessageAt: Date.now(),
  lastTopic: "TimingData",
  lastError: "",
  entriesByTopic: {
    DriverList: [{ seconds: liveUtcClockMs / 1000 - 60, data: { "1": { Tla: "VER", RacingNumber: "1" } } }],
    ExtrapolatedClock: [{ seconds: liveUtcClockMs / 1000, data: { Utc: new Date(liveUtcClockMs).toISOString(), Remaining: "01:10:00", Extrapolating: true } }],
    TimingData: [
      { seconds: liveUtcClockMs / 1000 - 50, data: { Lines: { "1": { RacingNumber: "1", Position: 1 } } } },
      { seconds: liveUtcClockMs / 1000 - 44, data: { Lines: { "1": { RacingNumber: "1", Position: 2 } } } },
      { seconds: liveUtcClockMs / 1000 - 30, data: { Lines: { "1": { RacingNumber: "1", Position: 3 } } } },
    ],
  },
});
const utcAlignedSnapshot = f1TimingRaceControlSandbox.getF1LiveTimingSnapshot({ targetUtcMs: Date.parse("2026-06-09T19:59:24.000Z") });
assert.equal(utcAlignedSnapshot.timing[0].pos, 2, "Video UTC live timing should render the row matching the F1 TV playhead, not the newest timing row");
assert.equal(utcAlignedSnapshot.diagnostics.targetSeconds, Date.parse("2026-06-09T19:59:24.000Z") / 1000 - 4.6, "Video UTC live timing should sit behind the playhead by the 4.6s stream alignment floor when the feed is fast");
f1TimingRaceControlSandbox.setF1LiveTimingState({
  lastMessageAt: Date.now(),
  lastTopic: "TimingData",
  lastError: "",
  feedLatencySamples: [6, 6, 6],
  entriesByTopic: {
    DriverList: [{ seconds: liveUtcClockMs / 1000 - 60, data: { "1": { Tla: "VER", RacingNumber: "1" } } }],
    ExtrapolatedClock: [{ seconds: liveUtcClockMs / 1000, data: { Utc: new Date(liveUtcClockMs).toISOString(), Remaining: "01:10:00", Extrapolating: true } }],
    TimingData: [
      { seconds: liveUtcClockMs / 1000 - 50, data: { Lines: { "1": { RacingNumber: "1", Position: 1 } } } },
      { seconds: liveUtcClockMs / 1000 - 44, data: { Lines: { "1": { RacingNumber: "1", Position: 2 } } } },
      { seconds: liveUtcClockMs / 1000 - 30, data: { Lines: { "1": { RacingNumber: "1", Position: 3 } } } },
    ],
  },
});
const latencyAlignedSnapshot = f1TimingRaceControlSandbox.getF1LiveTimingSnapshot({ targetUtcMs: Date.parse("2026-06-09T19:59:24.000Z") });
assert.equal(latencyAlignedSnapshot.diagnostics.targetSeconds, Date.parse("2026-06-09T19:59:24.000Z") / 1000 - 6, "A slow timing feed should widen the alignment beyond the 4.6s floor, like MultiViewer's measured delay");
assert.equal(latencyAlignedSnapshot.timing[0].pos, 2, "Measured feed latency should shift which timing row matches the playhead");
// Simulate Q2→Q3: latency samples collapse from a slow median (~7.6s effective peak)
// to a fast median under the 4.6s floor. Peak-hold must keep timing from jumping ~3s ahead.
f1TimingRaceControlSandbox.setF1LiveTimingState({
  lastMessageAt: Date.now(),
  lastTopic: "TimingData",
  lastError: "",
  feedLatencySamples: [7.6, 7.5, 7.7],
  streamAlignmentPeak: null,
  streamAlignmentPeakAtMs: null,
  entriesByTopic: {
    DriverList: [{ seconds: liveUtcClockMs / 1000 - 60, data: { "1": { Tla: "VER", RacingNumber: "1" } } }],
    ExtrapolatedClock: [{ seconds: liveUtcClockMs / 1000, data: { Utc: new Date(liveUtcClockMs).toISOString(), Remaining: "01:10:00", Extrapolating: true } }],
    TimingData: [
      { seconds: liveUtcClockMs / 1000 - 50, data: { Lines: { "1": { RacingNumber: "1", Position: 1 } } } },
      { seconds: liveUtcClockMs / 1000 - 44, data: { Lines: { "1": { RacingNumber: "1", Position: 2 } } } },
      { seconds: liveUtcClockMs / 1000 - 30, data: { Lines: { "1": { RacingNumber: "1", Position: 3 } } } },
    ],
  },
});
const peakAlignSnapshot = f1TimingRaceControlSandbox.getF1LiveTimingSnapshot({ targetUtcMs: Date.parse("2026-06-09T19:59:24.000Z") });
assert.equal(peakAlignSnapshot.diagnostics.streamAlignmentSeconds, 7.6, "Live timing should raise stream alignment to the measured slow-feed median");
f1TimingRaceControlSandbox.getF1LiveTimingState().feedLatencySamples = [1.1, 1.0, 1.2];
const heldAlignSnapshot = f1TimingRaceControlSandbox.getF1LiveTimingSnapshot({ targetUtcMs: Date.parse("2026-06-09T19:59:24.000Z") });
assert.equal(heldAlignSnapshot.diagnostics.streamAlignmentSeconds, 7.6, "After a Q-session latency-sample collapse, stream alignment should peak-hold instead of dropping to the 4.6s floor");
assert.equal(heldAlignSnapshot.diagnostics.targetSeconds, Date.parse("2026-06-09T19:59:24.000Z") / 1000 - 7.6, "Peak-held alignment should keep the same playhead-relative target after sample refresh");
f1TimingRaceControlSandbox.setF1LiveTimingState({ lastMessageAt: Date.now(), lastTopic: "TimingData", lastError: "", feedLatencySamples: [3, 3, 3], streamAlignmentPeak: 7.6, streamAlignmentPeakAtMs: Date.now(), entriesByTopic: {} });
f1TimingRaceControlSandbox.resyncF1LiveTiming();
assert.deepEqual(JSON.parse(JSON.stringify(f1TimingRaceControlSandbox.getF1LiveTimingState().feedLatencySamples)), [], "Manual resync should clear measured feed-latency samples so sync re-measures from scratch");
assert.equal(f1TimingRaceControlSandbox.getF1LiveTimingState().streamAlignmentPeak, null, "Manual resync should clear peak-held stream alignment");
assert.match(mainProcess, /ipcMain\.handle\("pitwall:data:liveTimingResync", \(\) => resyncF1LiveTiming\(\)\)/, "Main should expose a manual live timing resync IPC channel");
assert.match(preload, /liveTimingResync: \(\) => ipcRenderer\.invoke\("pitwall:data:liveTimingResync"\)/, "Preload should expose manual live timing resync to the renderer");
assert.match(liveRacingSource, />Resync timing<\/button>/, "The sync menu should offer a manual live timing resync button");
assert.match(liveRacingSource, /onResyncTiming=\{resyncLiveTiming\}/, "The sync menu resync button should be wired to the live timing resync handler");
assert.match(liveRacingSource, /async function resyncLiveTiming\(\)[\s\S]{0,200}sessionClockAnchorRef\.current = null[\s\S]{0,200}liveTimingResync/, "Manual resync should reset the local session clock anchor and re-arm the SignalR feed");
const compressedLiveUtc = "2026-06-09T20:00:05.000Z";
const compressedLiveSeconds = Date.parse(compressedLiveUtc) / 1000;
f1TimingRaceControlSandbox.setF1TimingSmokeNowMs(Date.parse(compressedLiveUtc));
const compressedCarData = zlib.deflateRawSync(Buffer.from(JSON.stringify({
  Entries: [{ Utc: compressedLiveUtc, Cars: { "16": { Channels: { "2": 288, "3": 7, "4": 72, "5": 1 } } } }],
}))).toString("base64");
const compressedPositionData = zlib.deflateRawSync(Buffer.from(JSON.stringify({
  Position: [{ Timestamp: compressedLiveUtc, Entries: { "16": { X: 321, Y: 654, Z: 9, Status: "OnTrack" } } }],
}))).toString("base64");
f1TimingRaceControlSandbox.setF1LiveTimingState({
  lastMessageAt: Date.now(),
  lastTopic: "TimingData",
  lastError: "",
  entriesByTopic: {
    DriverList: [{ seconds: compressedLiveSeconds, data: { "16": { Tla: "LEC", RacingNumber: "16" } } }],
    TimingData: [{ seconds: compressedLiveSeconds, data: { Lines: { "16": { RacingNumber: "16", Position: 3 } } } }],
    ExtrapolatedClock: [{ seconds: compressedLiveSeconds, data: { Utc: compressedLiveUtc, Remaining: "01:00:00", Extrapolating: true } }],
    SessionStatus: [{ seconds: compressedLiveSeconds, data: { Status: "Started" } }],
  },
});
f1TimingRaceControlSandbox.applyF1TimingSignalRMessage({ type: 1, target: "feed", arguments: ["CarData.z", compressedCarData, compressedLiveUtc] });
f1TimingRaceControlSandbox.applyF1TimingSignalRMessage({ type: 1, target: "feed", arguments: ["Position.z", compressedPositionData, compressedLiveUtc] });
const compressedLiveSnapshot = f1TimingRaceControlSandbox.getF1LiveTimingSnapshot();
assert.equal(compressedLiveSnapshot.timing[0].telemetry.speed, 288, "Formula 1 SignalR live timing should decode bare compressed CarData.z feed strings");
assert.deepEqual(JSON.parse(JSON.stringify(compressedLiveSnapshot.timing[0].trackPosition)), { x: 321, y: 654, z: 9, status: "OnTrack" }, "Formula 1 SignalR live timing should decode bare compressed Position.z feed strings");
assert.deepEqual(JSON.parse(JSON.stringify(liveSignalRSnapshot.timing[0].sectors.s1)), ["green"], "Formula 1 SignalR live timing should expose mocked mini-sector data");
f1TimingRaceControlSandbox.setF1LiveTimingState({
  lastMessageAt: Date.now(),
  lastTopic: "TimingData",
  lastError: "",
  entriesByTopic: {
    DriverList: [{ seconds: compressedLiveSeconds, data: { "16": { Tla: "LEC", RacingNumber: "16" } } }],
    TimingData: [{ seconds: compressedLiveSeconds, data: { Lines: { "16": { RacingNumber: "16", Position: 3 } } } }],
    ExtrapolatedClock: [{ seconds: compressedLiveSeconds, data: { Utc: compressedLiveUtc, Remaining: "01:00:00", Extrapolating: true } }],
    SessionStatus: [{ seconds: compressedLiveSeconds, data: { Status: "Started" } }],
  },
});
f1TimingRaceControlSandbox.applyF1TimingSignalRMessage({ M: [{ H: "Streaming", M: "feed", A: ["CarData.z", compressedCarData, compressedLiveUtc] }] });
const hubEnvelopeCompressedSnapshot = f1TimingRaceControlSandbox.getF1LiveTimingSnapshot();
assert.equal(hubEnvelopeCompressedSnapshot.timing[0].telemetry.speed, 288, "Formula 1 hub-envelope feed messages should populate live CarData.z telemetry");
const compressedCarDataWithoutUtc = zlib.deflateRawSync(Buffer.from(JSON.stringify({
  Entries: [{ Cars: { "16": { Channels: { "2": 291, "3": 8, "4": 75, "5": 0 } } } }],
}))).toString("base64");
f1TimingRaceControlSandbox.setF1LiveTimingState({
  lastMessageAt: Date.now(),
  lastTopic: "TimingData",
  lastError: "",
  entriesByTopic: {
    DriverList: [{ seconds: compressedLiveSeconds, data: { "16": { Tla: "LEC", RacingNumber: "16" } } }],
    TimingData: [{ seconds: compressedLiveSeconds, data: { Lines: { "16": { RacingNumber: "16", Position: 3 } } } }],
    ExtrapolatedClock: [{ seconds: compressedLiveSeconds, data: { Utc: compressedLiveUtc, Remaining: "01:00:00", Extrapolating: true } }],
    SessionStatus: [{ seconds: compressedLiveSeconds, data: { Status: "Started" } }],
  },
});
f1TimingRaceControlSandbox.applyF1TimingSignalRMessage({ type: 1, target: "feed", arguments: ["CarData.z", compressedCarDataWithoutUtc, compressedLiveUtc] });
const timestampedCarDataSnapshot = f1TimingRaceControlSandbox.getF1LiveTimingSnapshot({ targetUtcMs: Date.parse(compressedLiveUtc) + 4600 });
assert.equal(timestampedCarDataSnapshot.timing[0].telemetry.speed, 291, "Formula 1 SignalR live timing should timestamp compressed CarData rows that omit per-entry Utc");
assert.equal(timestampedCarDataSnapshot.timing[0].telemetry.gear, 8, "Formula 1 SignalR live timing should keep gear populated from timestamped compressed CarData rows");
f1TimingRaceControlSandbox.setF1TimingSmokeNowMs(null);
f1TimingRaceControlSandbox.setF1LiveTimingState({
  lastMessageAt: Date.now(),
  lastTopic: "TimingStats",
  lastError: "",
  entriesByTopic: {
    DriverList: [{ seconds: compressedLiveSeconds, data: { "16": { Tla: "LEC", RacingNumber: "16" } } }],
    TimingData: [{ seconds: compressedLiveSeconds, data: { Lines: { "16": { RacingNumber: "16", Position: 4, LastLapTime: { Value: "" }, BestLapTime: { Value: "" } } } } }],
    TimingStats: [{ seconds: compressedLiveSeconds, data: { Lines: { "16": { RacingNumber: "16", PersonalBestLapTime: { Value: "1:29.876", Lap: 3, Position: 4 } } } } }],
    ExtrapolatedClock: [{ seconds: compressedLiveSeconds, data: { Utc: compressedLiveUtc, Remaining: "01:00:00", Extrapolating: true } }],
    SessionStatus: [{ seconds: compressedLiveSeconds, data: { Status: "Started" } }],
  },
});
const timingStatsBestSnapshot = f1TimingRaceControlSandbox.getF1LiveTimingSnapshot();
assert.equal(timingStatsBestSnapshot.timing[0].best, "89.876", "Formula 1 SignalR live timing should fill missing best laps from TimingStats personal bests");
assert.equal(timingStatsBestSnapshot.timing[0].bestLapDuration, 89.876, "Formula 1 SignalR live timing should expose TimingStats personal best durations");
const liveTimingDiagnosticSandbox = vm.runInNewContext(`(() => {
  ${[
    "finiteNumber",
    "liveTimingSectorProgress",
    "liveTimingDiagnosticSample",
  ].map((name) => extractNamedFunction(mainProcess, name)).join("\n")}
  return { liveTimingDiagnosticSample };
})()`);
const telemetryDiagnosticSample = liveTimingDiagnosticSandbox.liveTimingDiagnosticSample({
  ok: true,
  sourceLabel: "Formula 1 live timing -36s",
  sessionClock: { lapCount: { lap: 6 } },
  timing: [{
    code: "VER",
    pos: 1,
    sessionLap: 5,
    last: "1:08.123",
    best: "1:07.456",
    lastLapDuration: 68.123,
    bestLapDuration: 67.456,
    sectors: { s1: ["yellow"], s2: [], s3: [] },
    sectorTimes: { s1: 21.123, s2: 22.234, s3: null },
    bestSectorTimes: { s1: 21, s2: 22, s3: 24.456 },
    telemetry: { speed: 291, gear: 8 },
  }],
}, Date.now());
assert.deepEqual(
  JSON.parse(JSON.stringify(telemetryDiagnosticSample.top[0].telemetry || null)),
  { speed: 291, gear: 8 },
  "Live timing diagnostic samples should expose speed and gear for real-session telemetry verification",
);
assert.deepEqual(
  JSON.parse(JSON.stringify({
    lastLapRows: telemetryDiagnosticSample.diagnostics.lastLapRows,
    bestLapRows: telemetryDiagnosticSample.diagnostics.bestLapRows,
    sectorTimeRows: telemetryDiagnosticSample.diagnostics.sectorTimeRows,
    completeSectorTimeRows: telemetryDiagnosticSample.diagnostics.completeSectorTimeRows,
    last: telemetryDiagnosticSample.top[0].last,
    best: telemetryDiagnosticSample.top[0].best,
    lastLapDuration: telemetryDiagnosticSample.top[0].lastLapDuration,
    bestLapDuration: telemetryDiagnosticSample.top[0].bestLapDuration,
    sectorTimes: telemetryDiagnosticSample.top[0].sectorTimes,
    bestSectorTimes: telemetryDiagnosticSample.top[0].bestSectorTimes,
  })),
  {
    lastLapRows: 1,
    bestLapRows: 1,
    sectorTimeRows: 1,
    completeSectorTimeRows: 0,
    last: "1:08.123",
    best: "1:07.456",
    lastLapDuration: 68.123,
    bestLapDuration: 67.456,
    sectorTimes: { s1: 21.123, s2: 22.234, s3: null },
    bestSectorTimes: { s1: 21, s2: 22, s3: 24.456 },
  },
  "Live timing diagnostic samples should expose lap and sector times for real-session data cleanliness checks",
);
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

const analyticsTerminalSandbox = vm.runInNewContext(`(() => {
  ${[
    "finiteNumber",
    "f1TimingArchiveStartUtcMs",
    "f1TimingArchiveSecondsForUtc",
    "f1TimingSessionStartSeconds",
    "f1TimingAnalyticsElapsedSeconds",
  ].map((name) => extractNamedFunction(mainProcess, name)).join("\n")}
  return { f1TimingAnalyticsElapsedSeconds };
})()`);
assert.equal(
  analyticsTerminalSandbox.f1TimingAnalyticsElapsedSeconds({
    selectedSession: { session_name: "Qualifying" },
    sessionStatusEntries: [{ seconds: 100, data: { Status: "Started" } }],
    timingEntries: [
      { seconds: 120, data: { Lines: {} } },
      { seconds: 880, data: { Lines: { "1": { Position: 1 } } } },
      { seconds: "not-a-time", data: { Lines: {} } },
    ],
  }),
  880,
  "Short qualifying analytics should sample the last valid archive timing point instead of start plus 1,400 seconds",
);
assert.equal(
  analyticsTerminalSandbox.f1TimingAnalyticsElapsedSeconds({
    selectedSession: {
      session_name: "Race",
      date_end: "2026-07-05T14:30:00.000Z",
    },
    clockEntries: [{
      seconds: 100,
      data: { Utc: "2026-07-05T13:01:40.000Z" },
    }],
    timingEntries: [
      { seconds: 5398, data: { Lines: { "1": { Position: 1 } } } },
      { seconds: 6000, data: { Lines: { "1": { Position: 1 } } } },
    ],
  }),
  5398,
  "Normal race analytics should clamp the scheduled terminal time to the last valid timing point at or before it",
);
assert.equal(
  analyticsTerminalSandbox.f1TimingAnalyticsElapsedSeconds({
    selectedSession: {
      session_name: "Race",
      date_end: "2026-07-05T14:30:00.000Z",
    },
    clockEntries: [{
      seconds: 100,
      data: { Utc: "2026-07-05T13:01:40.000Z" },
    }],
    sessionStatusEntries: [{
      seconds: 7600,
      data: {
        StatusSeries: [
          { Utc: "2026-07-05T13:00:00.000Z", SessionStatus: "Started" },
          { Utc: "2026-07-05T13:30:00.000Z", SessionStatus: "Aborted" },
          { Utc: "2026-07-05T14:00:00.000Z", SessionStatus: "Started" },
          { Utc: "2026-07-05T15:00:00.000Z", SessionStatus: "Finished" },
        ],
      },
    }],
    timingEntries: [
      { seconds: 5398, data: { Lines: { "1": { Position: 1 } } } },
      { seconds: 7198, data: { Lines: { "1": { Position: 1 } } } },
      { seconds: 7600, data: { Lines: { "1": { Position: 1 } } } },
    ],
  }),
  7198,
  "Red-flagged race analytics should use the resumed session's final terminal marker instead of the scheduled end or an earlier abort",
);
assert.equal(
  analyticsTerminalSandbox.f1TimingAnalyticsElapsedSeconds({
    selectedSession: {
      session_name: "Race",
      date_end: "2026-07-05T15:00:00.000Z",
    },
    clockEntries: [{
      seconds: 0,
      data: { Utc: "2026-07-05T13:00:00.000Z" },
    }],
    sessionStatusEntries: [{
      seconds: 3600,
      data: {
        StatusSeries: [
          { Utc: "2026-07-05T13:00:00.000Z", SessionStatus: "Started" },
          { Utc: "2026-07-05T14:00:00.000Z", SessionStatus: "Aborted" },
        ],
      },
    }],
    timingEntries: [
      { seconds: 3598, data: { Lines: { "1": { Position: 1 } } } },
      { seconds: 5000, data: { Lines: { "1": { Position: 1 } } } },
    ],
  }),
  3598,
  "Analytics should treat a final non-restarted Aborted status as terminal and select the last valid pre-abort timing point",
);
assert.equal(
  analyticsTerminalSandbox.f1TimingAnalyticsElapsedSeconds({
    selectedSession: {
      session_name: "Race",
      date_end: "2026-07-05T15:00:00.000Z",
    },
    clockEntries: [{
      seconds: 0,
      data: { Utc: "2026-07-05T13:00:00.000Z" },
    }],
    sessionStatusEntries: [
      { seconds: 0, data: { Status: "Started" } },
      { seconds: 3600, data: { Status: "Finished" } },
    ],
    timingEntries: [
      { seconds: 3599, data: { Lines: { "1": { Position: 1 } } } },
      { seconds: 5000, data: { Lines: { "1": { Position: 1 } } } },
    ],
  }),
  3599,
  "Time-limited race analytics should use the actual finished marker rather than the later scheduled session end",
);
assert.equal(
  analyticsTerminalSandbox.f1TimingAnalyticsElapsedSeconds({
    selectedSession: { session_name: "Race" },
    sessionStatusEntries: [{
      seconds: 3600,
      data: { StatusSeries: [{ Utc: "2026-07-05T14:00:00.000Z", SessionStatus: "Finished" }] },
    }],
    timingEntries: [
      { seconds: 3599, data: { Lines: { "1": { Position: 1 } } } },
      { seconds: 5000, data: { Lines: { "1": { Position: 1 } } } },
    ],
  }),
  3599,
  "Analytics should use entry.seconds for terminal UTC markers when no finite archive clock exists",
);
assert.equal(
  analyticsTerminalSandbox.f1TimingAnalyticsElapsedSeconds({
    selectedSession: { session_name: "Race", date_end: "not-a-date" },
    sessionStatusEntries: [{
      seconds: "not-a-time",
      data: { StatusSeries: [{ Utc: "also-not-a-date", SessionStatus: "Finished" }] },
    }],
    timingEntries: [
      { seconds: -1, data: {} },
      { seconds: 777, data: { Lines: { "1": { Position: 1 } } } },
      { seconds: Number.POSITIVE_INFINITY, data: {} },
    ],
  }),
  777,
  "Malformed terminal metadata should fall back to the last finite non-negative timing archive point",
);
assert.equal(
  analyticsTerminalSandbox.f1TimingAnalyticsElapsedSeconds({
    selectedSession: { session_name: "Race", date_end: "not-a-date" },
    sessionStatusEntries: [{ seconds: -5, data: { Status: "Finished" } }],
    timingEntries: [{ seconds: "invalid", data: {} }],
  }),
  5200,
  "Analytics should retain the conservative fallback only when no valid terminal metadata or timing point exists",
);
assert.doesNotMatch(
  extractNamedFunction(mainProcess, "f1TimingAnalyticsElapsedSeconds"),
  /\+\s*1400\b/,
  "Analytics terminal sampling should never use a fixed session-start plus 1,400-second target",
);

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

const leaderboardAnalyticsSandbox = vm.runInNewContext(`(() => {
  let fallbackCalls = 0;
  async function requestOpenF1AnalyticsWithRetry(endpoint) {
    if (endpoint === "sessionResult") return [];
    throw new Error("Unexpected endpoint " + endpoint);
  }
  async function requestOpenF1AnalyticsBatch() {
    return {
      raw: {
        laps: [
          { driver_number: 6, lap_number: 1, lap_duration: 89.276, is_pit_out_lap: false },
          { driver_number: 30, lap_number: 1, lap_duration: 89.300, is_pit_out_lap: false },
        ],
        stints: [],
      },
      errors: [],
    };
  }
  function readFallbackPitWallData() {
    return { drivers: [
      { code: "HAD", num: 6, name: "Isack Hadjar", color: "var(--accent)" },
      { code: "LAW", num: 30, name: "Liam Lawson", color: "var(--accent)" },
      { code: "LEC", num: 16, name: "Charles Leclerc", color: "var(--accent)" },
    ] };
  }
  async function buildF1TimingAnalyticsSessionData(sessionInfo) {
    fallbackCalls += 1;
    return {
      source: "Formula 1 livetiming",
      session: { key: sessionInfo.session_key, name: sessionInfo.session_name },
      drivers: [{ code: "LEC", position: 1, resultDuration: 88.1, fastestLap: 88.1, laps: 12 }],
      counts: { drivers: 1, laps: 1, sessionResult: 0 },
    };
  }
  ${[
    "teamAbbr",
    "compactText",
    "cleanSessionName",
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
    "analyticsSessionIsImmutable",
    "analyticsSessionHasPublishedRows",
    "analyticsLeaderboardRequiresOfficialResult",
    "analyticsSessionSatisfiesLeaderboardRequest",
    "buildAnalyticsSessionLeaderboardData",
  ].map((name) => extractNamedFunction(mainProcess, name)).join("\n")}
  return { analyticsSessionSatisfiesLeaderboardRequest, buildAnalyticsSessionLeaderboardData, get fallbackCalls() { return fallbackCalls; } };
})()`);
assert.equal(
  leaderboardAnalyticsSandbox.analyticsSessionSatisfiesLeaderboardRequest(
    { source: "OpenF1", counts: { sessionResult: 0, laps: 36, stints: 12 }, drivers: [{ code: "HAD" }] },
    { session_name: "Qualifying", session_type: "Qualifying" },
    { sessionKind: "Qualifying" }
  ),
  false,
  "Leaderboard cache should reject OpenF1 qualifying data when official session results are absent"
);
assert.equal(
  leaderboardAnalyticsSandbox.analyticsSessionSatisfiesLeaderboardRequest(
    { source: "Formula 1 livetiming", counts: { sessionResult: 0, laps: 1 }, drivers: [{ code: "LEC" }] },
    { session_name: "Qualifying", session_type: "Qualifying" },
    { sessionKind: "Qualifying" }
  ),
  true,
  "Leaderboard cache should accept Formula 1 timing fallback rows for qualifying"
);
assert.equal(
  leaderboardAnalyticsSandbox.analyticsSessionSatisfiesLeaderboardRequest(
    { source: "OpenF1", counts: { sessionResult: 0, laps: 36, stints: 12 }, drivers: [{ code: "RUS" }] },
    { session_name: "Practice 1", session_type: "Practice" },
    { sessionKind: "Practice 1" }
  ),
  true,
  "Leaderboard cache should still accept OpenF1 lap data for practice sessions"
);
leaderboardAnalyticsSandbox.buildAnalyticsSessionLeaderboardData({
  session_key: 4242,
  meeting_key: 99,
  session_name: "Qualifying",
  session_type: "Qualifying",
}, { sessionKind: "Qualifying" }).then((data) => {
  assert.equal(data.source, "Formula 1 livetiming", "Leaderboard-scoped qualifying should fall back to Formula 1 timing when OpenF1 session_result is empty");
  assert.deepEqual(JSON.parse(JSON.stringify(data.drivers.map((row) => row.code))), ["LEC"], "Leaderboard-scoped qualifying should not expose OpenF1 lap-only order as official results");
  assert.equal(leaderboardAnalyticsSandbox.fallbackCalls, 1, "Qualifying leaderboard fallback should be attempted once");
});

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
const f1TvLoginWindowSource = extractNamedFunction(mainProcess, "openF1TvLoginWindow");
assert.match(f1TvLoginWindowSource, /automatedCredentialLogin/, "F1 TV credential login should distinguish automated sign-in from manual browser login");
assert.match(f1TvLoginWindowSource, /show: !automatedCredentialLogin/, "Automated F1 TV credential login should run in a hidden Electron window");
assert.match(f1TvLoginWindowSource, /skipTaskbar: automatedCredentialLogin/, "Automated F1 TV credential login should stay out of the macOS task switcher");
assert.match(f1TvLoginWindowSource, /offscreen: automatedCredentialLogin/, "Automated F1 TV credential login should render offscreen while scripts fill credentials");
assert.match(f1TvLoginWindowSource, /backgroundThrottling: !automatedCredentialLogin/, "Hidden automated F1 TV login should not be background-throttled");
assert.match(f1TvLoginWindowSource, /overrideBrowserWindowOptions[\s\S]*show: !automatedCredentialLogin/, "F1 TV child auth windows should also stay hidden during automated credential login");
assert.match(f1TvLoginWindowSource, /F1TV_LOGIN_TOKEN_GRACE_MS/, "Automated F1 TV login should wait briefly after browser cookies appear so playback tokens can settle");
assert.match(f1TvLoginWindowSource, /F1TV_LOGIN_AUTOMATION_TIMEOUT_MS/, "Automated F1 TV login should have a bounded hidden-window timeout");
assert.match(f1TvLoginWindowSource, /status\.authenticated \|\| \(!automatedCredentialLogin && status\.browserSession\)/, "Manual F1 TV login may close on browser cookies, but automated login should wait for playback readiness");
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
assert.match(mainProcess, /responseHint: requestType === 2 && response\.status >= 400 \?/, "F1 TV media fetch diagnostics should not log successful license response bodies");
assert.match(mainProcess, /PITWALL_F1TV_LIVE_SYNC_DIAG/, "F1 TV diagnostics should support a hidden actual-playback live sync probe");
assert.match(mainProcess, /runF1TvLiveSyncDiagnostic/, "F1 TV live sync diagnostics should exercise real resolved playback in Electron");
assert.match(mainProcess, /pitwallF1TvLiveSyncDiagnostic/, "F1 TV resolver diagnostics should print sanitized live sync probe results");
assert.match(mainProcess, /reachedTarget/, "F1 TV live sync diagnostics should report whether playback reached target latency");
assert.match(mainProcess, /stabilized/, "F1 TV live sync diagnostics should report whether playback speed stabilized");
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
assert.match(mainProcess, /f1TvSubscriptionIssueFromAttempts/, "F1 TV resolver should classify direct PLAY endpoint entitlement failures");
assert.match(mainProcess, /Rights are locked|ACN_2001/, "F1 TV resolver should recognize inactive-subscription PLAY endpoint responses");
assert.match(mainProcess, /F1 TV subscription is not active/, "F1 TV resolver should surface inactive subscription problems directly");
assert.match(mainProcess, /subscriptionActive/, "F1 TV status and diagnostics should expose whether playback entitlement appears active");
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
assert.equal(
  mergeCopilotDataForSmoke({
    daily: {
      status: "ready",
      targetFingerprint: "barcelona-weekend",
      updatedAt: "2026-06-14T08:00:00.000Z",
      progress: { completedPages: 4 },
    },
  }, {
    daily: {
      status: "pending",
      targetFingerprint: "austria-weekend",
      updatedAt: "2026-06-14T07:55:00.000Z",
      progress: { completedPages: 0 },
    },
  }).daily.targetFingerprint,
  "austria-weekend",
  "Copilot daily merge should not keep ready projections for a different current weekend"
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
const postRaceGapSchedule = [
  { rnd: 8, name: "Spanish Grand Prix", status: "done", startsAt: "2026-06-14T13:00:00.000Z", sessions: [{ kind: "Race", status: "done" }] },
  { rnd: 9, name: "Austrian Grand Prix", status: "upcoming", startsAt: "2026-06-28T13:00:00.000Z", sessions: [
    { kind: "Practice 1", status: "upcoming", startsAt: "2026-06-26T11:30:00.000Z" },
    { kind: "Race", status: "upcoming", startsAt: "2026-06-28T13:00:00.000Z" },
  ] },
  { rnd: 10, name: "British Grand Prix", status: "upcoming", startsAt: "2026-07-05T14:00:00.000Z", sessions: [{ kind: "Practice 1", status: "upcoming" }] },
];
assert.equal(copilotWeekendSelection.currentRaceWeekend(postRaceGapSchedule).name, "Austrian Grand Prix", "After a completed race, Current weekend Copilot projections should roll forward to the next race weekend");
assert.equal(copilotWeekendSelection.nextRaceWeekend(postRaceGapSchedule).name, "British Grand Prix", "After a completed race, Next weekend Copilot projections should skip the rolled-forward current weekend");
const copilotCacheTarget = vm.runInNewContext(`(() => {
  ${extractNamedFunction(mainProcess, "finiteNumber")}
  ${extractNamedFunction(mainProcess, "raceWeekendIsActive")}
  ${extractNamedFunction(mainProcess, "raceWeekendKey")}
  ${extractNamedFunction(mainProcess, "raceWeekendOrderValue")}
  ${extractNamedFunction(mainProcess, "currentRaceWeekend")}
  ${extractNamedFunction(mainProcess, "nextRaceWeekend")}
  ${extractNamedFunction(mainProcess, "nextUpcomingSession")}
  ${extractNamedFunction(mainProcess, "copilotSessionIdentity")}
  ${extractNamedFunction(mainProcess, "copilotRaceIdentity")}
  ${extractNamedFunction(mainProcess, "copilotInsightTargetFingerprint")}
  ${extractNamedFunction(mainProcess, "copilotInsightsCacheMatchesTarget")}
  return { copilotInsightTargetFingerprint, copilotInsightsCacheMatchesTarget };
})()`);
const barcelonaCopilotTarget = {
  seasonSummary: { year: 2026, round: 8 },
  schedule: activeWeekendSchedule,
};
const austriaCopilotTarget = {
  seasonSummary: { year: 2026, round: 8 },
  schedule: [
    { rnd: 7, name: "Monaco Grand Prix", status: "done", startsAt: "2026-06-07T13:00:00.000Z", sessions: [{ kind: "Race", status: "done" }] },
    { rnd: 8, name: "Spanish Grand Prix", status: "done", startsAt: "2026-06-14T13:00:00.000Z", sessions: [{ kind: "Race", status: "done" }] },
    { rnd: 9, name: "Austrian Grand Prix", circuit: "Red Bull Ring", loc: "Spielberg", status: "upcoming", startsAt: "2026-06-28T13:00:00.000Z", sessions: [
      { kind: "Practice 1", status: "done", startsAt: "2026-06-26T11:30:00.000Z" },
      { kind: "Race", status: "upcoming", startsAt: "2026-06-28T13:00:00.000Z" },
    ] },
    { rnd: 10, name: "British Grand Prix", status: "upcoming", startsAt: "2026-07-05T14:00:00.000Z", sessions: [{ kind: "Practice 1", status: "upcoming" }] },
  ],
};
const barcelonaFingerprint = copilotCacheTarget.copilotInsightTargetFingerprint(barcelonaCopilotTarget);
const austriaFingerprint = copilotCacheTarget.copilotInsightTargetFingerprint(austriaCopilotTarget);
assert.notEqual(barcelonaFingerprint, austriaFingerprint, "Daily Copilot cache should distinguish Barcelona projections from Austrian projections generated on the same day");
assert.equal(copilotCacheTarget.copilotInsightsCacheMatchesTarget({ targetFingerprint: barcelonaFingerprint }, austriaFingerprint), false, "Daily Copilot should reject ready cache generated for a different current weekend");
assert.equal(copilotCacheTarget.copilotInsightsCacheMatchesTarget({ targetFingerprint: austriaFingerprint }, austriaFingerprint), true, "Daily Copilot should reuse ready cache only when the target weekend fingerprint matches");
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
assert.match(mainProcess, /OPENF1_MAX_CONCURRENT_REQUESTS/, "OpenF1 requests should allow limited concurrency instead of a one-at-a-time global queue");
assert.match(mainProcess, /openF1ForegroundQueue[\s\S]*openF1BackgroundQueue[\s\S]*pickNextOpenF1Task/, "OpenF1 scheduler should prioritize foreground user loads over background refreshes");
assert.match(mainProcess, /function requestOpenF1AnalyticsBatch[\s\S]*Promise\.all\(Object\.entries\(requests\)\.map/, "Session analytics should batch rich OpenF1 endpoints behind the shared rate limiter");
assert.match(mainProcess, /buildAnalyticsSessionData[\s\S]*requestOpenF1AnalyticsBatch/, "Full session analytics should keep rich endpoints but load them through the faster batch helper");
assert.match(mainProcess, /refreshAnalyticsSessionCache[\s\S]*priority:\s*"background"/, "Background analytics revalidation should not block foreground OpenF1 work");
assert.match(mainProcess, /readAnalyticsSessionDiskCache/, "Session analytics should persist successful session data for OpenF1 cooldown fallback");
assert.match(mainProcess, /writeAnalyticsSessionDiskCache/, "Session analytics should save session analytics cache entries after successful loads");
assert.match(mainProcess, /analyticsAliasKey/, "Session analytics should key cached data by meeting and session kind before resolving a session key");
assert.match(mainProcess, /ANALYTICS_REVALIDATE_MS/, "Session analytics should have an explicit background revalidation cooldown");
assert.match(mainProcess, /analyticsRefreshInFlight/, "Session analytics should dedupe background refreshes for repeated Weekend and Analytics requests");
assert.match(mainProcess, /refreshAnalyticsSessionCache/, "Session analytics should refresh cached session data without blocking the caller");
assert.match(mainProcess, /analyticsCacheFingerprint/, "Session analytics should compare cached and fresh session data before rewriting the cache");
assert.match(mainProcess, /analyticsSessionDiskEntry\(\[cacheKey, aliasKey\], \{ allowStale: true \}\)/, "Session analytics should return cached OpenF1 session data immediately while checking for updates later");
assert.match(mainProcess, /function buildAnalyticsSessionLeaderboardData/, "Session analytics should expose a fast leaderboard-only loader for completed weekend sessions");
assert.match(mainProcess, /scope === "leaderboard"[\s\S]*buildAnalyticsSessionLeaderboardData/, "Leaderboard scoped analytics requests should avoid the slower full-session analytics path");
assert.match(mainProcess, /buildAnalyticsSessionLeaderboardData[\s\S]*analyticsLeaderboardRequiresOfficialResult[\s\S]*requestOpenF1AnalyticsWithRetry\("sessionResult"[\s\S]*buildF1TimingAnalyticsSessionData[\s\S]*!requiresOfficialResult[\s\S]*requestOpenF1AnalyticsBatch/, "Leaderboard scoped analytics should use official session results before fetching heavier lap detail");
assert.match(mainProcess, /getAnalyticsSession[\s\S]*analyticsSessionSatisfiesLeaderboardRequest/, "Leaderboard scoped analytics should not return cached classification data that lacks official session results");
assert.match(mainProcess, /resolveAnalyticsSession[\s\S]*options\.round[\s\S]*meetings[\s\S]*meeting_key/, "Leaderboard analytics should resolve direct weekend round requests without waiting for the renderer library");
assert.match(mainProcess, /OpenF1 rate limit reached/, "Session analytics should report OpenF1 rate limits without exposing raw URLs");
assert.match(mainProcess, /hasPublishedRows/, "Session analytics should explain when OpenF1 has not published rows yet");
assert.match(mainProcess, /value === null \|\| value === undefined \|\| value === ""[\s\S]*return null/, "Session analytics should not coerce missing numeric values to zero");
assert.match(mainProcess, /COPILOT_WEEKEND_SESSION_KINDS[\s\S]*Practice 1[\s\S]*Practice 2[\s\S]*Practice 3[\s\S]*Qualifying/, "Current weekend Copilot predictions should consider FP1-FP3 and qualifying");
assert.match(mainProcess, /function buildWeekendSessionSummaries[\s\S]*getAnalyticsSession\(\{[\s\S]*sessionKind/, "Current weekend Copilot should reuse structured OpenF1 session analytics");
assert.match(mainProcess, /weekendSessionSummaries:\s*await buildWeekendSessionSummaries\(data, pageId/, "Daily AI snapshots should include structured weekend session summaries when predicting the current race");
assert.match(mainProcess, /pitwall:notify:schedule/, "Electron main should expose local reminder IPC");
assert.match(mainProcess, /pitwall:notify:cancel/, "Electron main should expose local reminder cancellation IPC");
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
assert.match(dataProviderSource, /const constructorBaseRows = constructorMetadataRows\(SEEDED_CONSTRUCTOR_ROWS, base\?\.constructors\)/, "Renderer live-data merge should keep seed constructor logos and colors available after sparse refreshes");
assert.match(dataProviderSource, /incoming\?\.constructors\?\.length \? mergeRowsByKey\(constructorBaseRows, incoming\.constructors, "abbr", \{ includeMissing: false \}\) : \(base\?\.constructors/, "Renderer live-data merge should preserve previous constructor standings when a refresh source returns no rows without appending seeded teams to sparse live rows");
assert.match(dataProviderSource, /incoming\?\.schedule\?\.length \? incoming\.schedule : base\?\.schedule/, "Renderer live-data merge should preserve previous schedule when a refresh source returns no rows");
assert.match(liveRacingSource, /profile\.livePanelSizes/, "Live Racing should restore panel sizes from the persisted Electron profile");
assert.match(liveRacingSource, /window\.pitwall\?\.profile\?\.set/, "Live Racing should save resized panels to the persisted Electron profile");
assert.match(mainProcess, /new Notification/, "Reminder IPC should use native notifications");
assert.match(mainProcess, /function cancelReminder[\s\S]*clearTimeout/, "Reminder cancellation should clear native notification timers");
assert.match(mainProcess, /detectBattlePairs/, "App should compute deterministic battle pairs before asking AI");
assert.match(mainProcess, /https:\/\/api\.openf1\.org\/v1\/championship_drivers\?session_key=latest/, "Live data should fetch current driver standings from the fast OpenF1 championship endpoint");
assert.match(mainProcess, /https:\/\/api\.openf1\.org\/v1\/championship_teams\?session_key=latest/, "Live data should fetch current constructor standings from the fast OpenF1 championship endpoint");
assert.match(mainProcess, /fetchOfficialF1StandingsFallback\(raw, errors\)/, "Live data should fetch official Formula 1 standings when OpenF1 championship rows are unavailable");
assert.match(mainProcess, /formula1\.com\/en\/results\/\$\{year\}\/\$\{kind\}/, "Official championship fallback should read Formula1.com results pages");
const liveCoreDataUrlsBlock = mainProcess.match(/const LIVE_CORE_DATA_URLS = \{[\s\S]*?\n\};/)?.[0] || "";
assert.doesNotMatch(liveCoreDataUrlsBlock, /News|LIVE_NEWS_URLS/, "Initial live data snapshots should not wait for news sources");
const liveBackgroundEnrichmentUrlsBlock = mainProcess.match(/const LIVE_BACKGROUND_ENRICHMENT_URLS = \{[\s\S]*?\n\};/)?.[0] || "";
const liveBackgroundEnrichmentUrls = vm.runInNewContext(`(() => {
  ${mainProcess.match(/const NEWS_SOURCES = \[[\s\S]*?\n\];/)?.[0] || ""}
  ${mainProcess.match(/const LIVE_NEWS_URLS = [^\n]+;/)?.[0] || ""}
  ${mainProcess.match(/const LIVE_TIMING_ENRICHMENT_URLS = \{[\s\S]*?\n\};/)?.[0] || ""}
  ${liveBackgroundEnrichmentUrlsBlock}
  return LIVE_BACKGROUND_ENRICHMENT_URLS;
})()`);
for (const newsKey of ["motorsportNews", "formula1News", "theRaceNews", "planetF1News"]) {
  assert.ok(liveBackgroundEnrichmentUrls[newsKey], `Background live-data enrichment should include ${newsKey}`);
}
assert.match(mainProcess, /liveBackgroundEnrichmentUrls\(baseRaw\?\.openF1Sessions[\s\S]*fetchLiveDataEntries\(enrichmentUrls,\s*\{\s*priority:\s*"background"\s*\}\)/, "Background live-data enrichment should fetch the complete timing/news set with bounded latest-session telemetry");
assert.doesNotMatch(liveCoreDataUrlsBlock, /f1api\.dev\/api\/current/, "Initial live data snapshots should not wait on slower F1 API standings endpoints");
assert.doesNotMatch(liveCoreDataUrlsBlock, /api\.jolpi\.ca\/ergast\/f1\/current/, "Initial live data snapshots should not wait on slow Jolpica current endpoints");
assert.match(mainProcess, /requestOpenF1Json\(`https:\/\/api\.openf1\.org\/v1\/meetings\?year=\$\{year\}`\)[\s\S]*requestOpenF1Json\(`https:\/\/api\.openf1\.org\/v1\/sessions\?year=\$\{year\}`\)[\s\S]*parseOpenF1Schedule\(meetings, sessions\)/, "Weekend library should use OpenF1 schedule data without waiting on Jolpica");
assert.match(mainProcess, /api\.openf1\.org\/v1\/weather\?session_key=latest/, "Live data should fetch current/latest track weather from OpenF1");
assert.match(mainProcess, /fetchOpenF1WeekendWeather\(nextRace/, "Live data should fall back to selected-weekend OpenF1 weather when latest weather is unavailable");
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
assert.match(preload, /cancel: \(id\)/, "Preload should expose reminder cancellation helpers");
assert.match(preload, /profile/, "Preload should expose persisted profile helpers");
assert.match(preload, /snapshot: \(options = \{\}\)/, "Renderer should be able to request live F1 data snapshots with startup refresh options");
const liveDataUpdateMessages = [];
const liveDataUpdateNotificationSandbox = vm.runInNewContext(`(() => {
  ${extractNamedFunction(mainProcess, "notifyLiveDataUpdated")}
  return { notifyLiveDataUpdated };
})()`, {
  BrowserWindow: {
    getAllWindows: () => [
      { isDestroyed: () => false, webContents: { send: (...args) => liveDataUpdateMessages.push(args) } },
      { isDestroyed: () => true, webContents: { send: (...args) => liveDataUpdateMessages.push(args) } },
    ],
  },
  liveDataUpdateMessages,
});
liveDataUpdateNotificationSandbox.notifyLiveDataUpdated();
assert.deepEqual(liveDataUpdateMessages, [["pitwall:data:updated"]], "Background enrichment completion should notify active renderers without exposing snapshot data");
assert.match(preload, /onUpdated:\s*\(callback\)[\s\S]*ipcRenderer\.on\("pitwall:data:updated"[\s\S]*removeListener\("pitwall:data:updated"/, "Preload should expose a narrow subscribe/unsubscribe API for completed live-data enrichment");
assert.match(dataProviderSource, /data\?\.onUpdated\?\.\(\(\) => refreshData\(\)\)[\s\S]*unsubscribeDataUpdated\?\.\(\)/, "DataProvider should refresh after enrichment completion and remove its listener on cleanup");
assert.match(extractNamedFunction(mainProcess, "refreshLiveDataEnrichment"), /writeLiveSnapshotDiskCache\(data\)[\s\S]*notifyLiveDataUpdated\(\)/, "Background enrichment should notify the renderer after updating cache and disk");

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
assert.match(dataProviderSource, /if \(!bypassInitialLiveDataGate\) refreshData\(\{ initial: true \}\)/, "Normal app startup should load the cached live snapshot first, then refresh newer races in the background");
assert.doesNotMatch(extractNamedFunction(mainProcess, "getPitWallSnapshot"), /diskData[\s\S]*await ensureRecentDriverForm/, "Cached live snapshots should return without waiting for driver-form network enrichment");
assert.match(fs.readFileSync(path.join(root, "electron/main.cjs"), "utf8"), /dist\/pitwall\/index\.html/, "Electron should prefer the precompiled renderer when available");
const smokeTestSourceForRendererBudget = fs.readFileSync(__filename, "utf8");
assert.doesNotMatch(
  smokeTestSourceForRendererBudget,
  /const distHtmlPath = path\.join\(root, "dist\/pitwall\/index\.html"\);\s*if \(fs\.existsSync\(distHtmlPath\)\)/,
  "Parser-blocking renderer budgets should run from a self-contained fixture even when dist/pitwall is absent",
);
const rendererFixtureRoot = fs.mkdtempSync(path.join(require("node:os").tmpdir(), "apexline-renderer-smoke-"));
try {
  const rendererFixtureScripts = path.join(rendererFixtureRoot, "scripts");
  fs.mkdirSync(rendererFixtureScripts, { recursive: true });
  fs.symlinkSync(path.join(root, "ui_kits"), path.join(rendererFixtureRoot, "ui_kits"), "dir");
  fs.symlinkSync(path.join(root, "node_modules"), path.join(rendererFixtureRoot, "node_modules"), "dir");
  fs.symlinkSync(path.join(root, "_ds_bundle.js"), path.join(rendererFixtureRoot, "_ds_bundle.js"), "file");
  vm.runInNewContext(buildRendererSource, {
    __dirname: rendererFixtureScripts,
    console: { log() {} },
    require,
  }, { filename: "scripts/build-renderer.cjs" });

  const distHtmlPath = path.join(rendererFixtureRoot, "dist/pitwall/index.html");
  assert.ok(fs.existsSync(distHtmlPath), "Isolated renderer build should always produce an index for startup-budget checks");
  const distHtml = fs.readFileSync(distHtmlPath, "utf8");
  assert.doesNotMatch(distHtml, /text\/babel|@babel|babel\.min\.js/, "Compiled renderer should not use in-browser Babel");
  assert.match(distHtml, /AppShell\.js/, "Compiled renderer should load compiled screen scripts");
  assert.match(distHtml, /react\/umd\/react\.production\.min\.js/, "Generated renderer should use production React");
  assert.match(distHtml, /react-dom\/umd\/react-dom\.production\.min\.js/, "Generated renderer should use production ReactDOM");
  assert.doesNotMatch(distHtml, /<script src="[^"]*(?:LiveRacing|hls|shaka)[^"]*"><\/script>/i, "Generated renderer should keep Live Racing and player runtimes off the parser-blocking startup path");
  const parserBlockingSources = Array.from(distHtml.matchAll(/<script src="([^"]+)"><\/script>/g), (match) => match[1]);
  assert.deepEqual(parserBlockingSources, [
    "../../node_modules/react/umd/react.production.min.js",
    "../../node_modules/react-dom/umd/react-dom.production.min.js",
    "../../_ds_bundle.js",
    "theme.js",
    "data.js",
    "sync.js",
    "social.js",
    "trackmap-circuits.js",
    "DataProvider.js",
    "AppShell.js",
    "Dashboard.js",
  ], "Generated dashboard should parser-block only on its initial browser-global resource allowlist");
  const parserBlockingBytes = parserBlockingSources.reduce((total, sourcePath) => total + fs.statSync(path.resolve(path.dirname(distHtmlPath), sourcePath)).size, 0);
  assert.ok(parserBlockingBytes < 1024 * 1024, `Initial parser-blocking dashboard scripts should stay below 1 MiB (received ${parserBlockingBytes} bytes)`);
  let appendedRuntimeScripts = 0;
  const runtimeScriptElements = [];
  const runtimeScriptLoaderSandbox = vm.runInNewContext(`(() => {
    const runtimeScriptPromises = new Map();
    ${extractNamedFunction(distHtml, "loadRuntimeScript")}
    return { loadRuntimeScript };
  })()`, {
    document: {
      createElement: () => ({}),
      head: { appendChild: (script) => {
        appendedRuntimeScripts += 1;
        runtimeScriptElements.push(script);
      } },
    },
    set appendedRuntimeScripts(value) { appendedRuntimeScripts = value; },
    runtimeScriptElements,
  });
  const firstRuntimeLoad = runtimeScriptLoaderSandbox.loadRuntimeScript("Weekend.js");
  const duplicateRuntimeLoad = runtimeScriptLoaderSandbox.loadRuntimeScript("Weekend.js");
  assert.equal(firstRuntimeLoad, duplicateRuntimeLoad, "Runtime script loader should cache one promise per non-initial resource");
  assert.equal(appendedRuntimeScripts, 1, "Runtime script loader should append a requested resource only once");
  runtimeScriptElements[0].onerror();
  await assert.rejects(firstRuntimeLoad, /Unable to load Weekend\.js/, "Runtime script loader should reject failed resources");
  const retriedRuntimeLoad = runtimeScriptLoaderSandbox.loadRuntimeScript("Weekend.js");
  assert.notEqual(retriedRuntimeLoad, firstRuntimeLoad, "Runtime script loader should evict a failed promise so the same screen can retry in place");
  assert.equal(appendedRuntimeScripts, 2, "Retrying a failed runtime script should append a new script element");
  runtimeScriptElements[1].onload();
  await retriedRuntimeLoad;
  assert.match(distHtml, /loadRuntimeScript\([^)]*hls[^)]*\)[\s\S]*loadRuntimeScript\([^)]*shaka[^)]*\)[\s\S]*loadRuntimeScript\([^)]*LiveRacing/i, "Live navigation should load HLS and Shaka before entering Live Racing");
  assert.match(distHtml, /loadedScreen !== screen[\s\S]*Loading/, "A non-dashboard initial route should render a loading state while its screen script loads");
  assert.match(distHtml, /setLoadAttempt\([\s\S]*Retry/, "Failed lazy screens should offer an in-place retry that reruns the resource loader");
  assert.match(distHtml, /screen === "live"[\s\S]*setScreen\("dashboard"\)[\s\S]*Back to dashboard/, "A failed direct Live route should offer a path back to the dashboard");
  assert.match(distHtml, /delete window\.PW\[globalName\]/, "Generated renderer should clear stale _ds_bundle screen stubs before lazy loads");
  assert.match(distHtml, /loadedScreenScripts/, "Generated renderer should track actually-loaded screen scripts instead of trusting pre-existing window.PW exports");
  assert.doesNotMatch(
    distHtml,
    /if \(globalName && window\.PW\[globalName\]\) return Promise\.resolve\(\)/,
    "Lazy screen loader must not skip News.js (etc.) just because _ds_bundle stamped a demo window.PW.News",
  );
  const screenLoaderSandbox = vm.runInNewContext(`(() => {
    const runtimeScriptPromises = new Map();
    const loadedScreenScripts = new Set(["dashboard"]);
    const SCREEN_SCRIPTS = {
      news: "News.js",
      settings: "Settings.js",
      live: "LiveRacing.js",
    };
    const SCREEN_GLOBALS = { news: "News", settings: "Settings" };
    window.PW = {
      News: function StaleNewsFromDsBundle() {},
      Settings: function StaleSettingsFromDsBundle() {},
      LiveRacing: function StaleLiveFromDsBundle() {},
    };
    for (const globalName of [...Object.values(SCREEN_GLOBALS), "LiveRacing"]) {
      delete window.PW[globalName];
    }
    ${extractNamedFunction(distHtml, "loadRuntimeScript")}
    ${extractNamedFunction(distHtml, "loadScreenResources")}
    return { loadScreenResources, loadRuntimeScript, loadedScreenScripts, getPW: () => window.PW };
  })()`, {
    window: { PW: {} },
    document: {
      createElement: () => ({}),
      head: {
        appendChild: (script) => {
          queueMicrotask(() => script.onload && script.onload());
        },
      },
    },
  });
  assert.equal(typeof screenLoaderSandbox.getPW().News, "undefined", "Stale _ds_bundle News stub should be deleted before lazy load");
  await screenLoaderSandbox.loadScreenResources("news");
  assert.ok(screenLoaderSandbox.loadedScreenScripts.has("news"), "News navigation should record that News.js was loaded");
  await screenLoaderSandbox.loadScreenResources("news");
  assert.equal(
    [...screenLoaderSandbox.loadedScreenScripts].filter((name) => name === "news").length,
    1,
    "Repeat News navigation should not reload after the real script is marked loaded",
  );
} finally {
  fs.rmSync(rendererFixtureRoot, { recursive: true, force: true });
}

const kitDir = path.join(root, "ui_kits/pitwall");
const source = Object.fromEntries(fs.readdirSync(kitDir)
  .filter((name) => name.endsWith(".jsx"))
  .map((name) => [name, fs.readFileSync(path.join(kitDir, name), "utf8")]));
assert.match(source["Dashboard.jsx"], /function dashboardTrackConditionsSubtitle/, "Dashboard weather card should compute a track-first subtitle");
const dashboardTrackConditionsSandbox = vm.runInNewContext(`(() => {
  ${extractNamedFunction(source["Dashboard.jsx"], "dashboardTrackConditionsSubtitle")}
  return { dashboardTrackConditionsSubtitle };
})()`);
assert.equal(
  dashboardTrackConditionsSandbox.dashboardTrackConditionsSubtitle({ circuit: "Circuit de Monaco", weatherLoc: "Latest session", loc: "Monte Carlo" }),
  "Circuit de Monaco · OpenF1",
  "Dashboard weather card should replace the latest-session placeholder with the track name",
);
assert.equal(
  dashboardTrackConditionsSandbox.dashboardTrackConditionsSubtitle({ weatherLoc: "Latest session", loc: "Monte Carlo" }),
  "Monte Carlo · OpenF1",
  "Dashboard weather card should fall back to race location when the circuit name is unavailable",
);
assert.match(source["DataProvider.jsx"], /onRetry=\{\(\) => refreshData\(\{ forceRefresh: true, initial: true \}\)\}/, "Initial loading retry should still allow a forced live-data refresh");
assert.match(source["DataProvider.jsx"], /initialDataReady[\s\S]*PitWallLoadingScreen[\s\S]*children/, "DataProvider should keep the app behind a loading screen until the initial live fetch resolves");
assert.match(source["DataProvider.jsx"], /setData\(\(current\) => mergeData\(current, snapshot\)\)[\s\S]*return snapshot/, "DataProvider refreshData should return the loaded snapshot so screen-level refresh UI can wait for enrichment");
const dataProviderStartupGateSandbox = vm.runInNewContext(`(() => {
  ${extractNamedFunction(source["DataProvider.jsx"], "shouldWaitForStartupNews")}
  return { shouldWaitForStartupNews };
})()`);
assert.equal(dataProviderStartupGateSandbox.shouldWaitForStartupNews({ enrichmentPending: true }), false, "Startup gate should not wait on article enrichment when the snapshot is already fresh");
assert.equal(dataProviderStartupGateSandbox.shouldWaitForStartupNews({ enrichmentPending: false }), false, "Startup gate should open once news enrichment has settled");
assert.equal(dataProviderStartupGateSandbox.shouldWaitForStartupNews({ enrichmentPending: true, sourceLabel: "Live data (refreshing)" }), false, "Startup gate should paint cached data immediately while enrichment refreshes");
assert.equal(dataProviderStartupGateSandbox.shouldWaitForStartupNews({ enrichmentPending: true, sourceLabel: "Live data", news: [{ title: "Fresh F1 headline" }] }), false, "Startup gate should open once the fresh base news feed is loaded without waiting for article enrichment");
const dataProviderEnrichmentPollingSandbox = vm.runInNewContext(`(() => {
  ${extractNamedFunction(source["DataProvider.jsx"], "scheduleBackgroundEnrichmentPoll")}
  return { scheduleBackgroundEnrichmentPoll };
})()`);
const enrichmentTimers = [];
let enrichmentElapsedMs = 0;
let enrichmentPollAttempts = 0;
function scheduleEnrichmentPoll(attempt) {
  dataProviderEnrichmentPollingSandbox.scheduleBackgroundEnrichmentPoll(
    { enrichmentPending: true },
    attempt,
    (callback, delayMs) => {
      enrichmentTimers.push({ callback, delayMs });
      return enrichmentTimers.length;
    },
    (nextOptions) => {
      enrichmentPollAttempts += 1;
      scheduleEnrichmentPoll(nextOptions.enrichmentAttempt);
    },
  );
}
scheduleEnrichmentPoll(0);
while (enrichmentTimers.length) {
  const timer = enrichmentTimers.shift();
  enrichmentElapsedMs += timer.delayMs;
  timer.callback();
}
assert.equal(enrichmentPollAttempts, 4, "Background live-data enrichment should stop after four polling attempts");
assert.equal(enrichmentElapsedMs, 10000, "Background live-data enrichment polling should stop after ten seconds");
const connectionProbeStarts = [];
let releaseAiConnectionProbe;
let releaseF1TvConnectionProbe;
let finalConnectionState;
const dataProviderConnectionSandbox = vm.runInNewContext(`(() => {
  ${extractNamedFunction(source["DataProvider.jsx"], "refreshConnections")}
  return { refreshConnections };
})()`, {
  window: {
    pitwall: {
      ai: {
        authStatus: () => new Promise((resolve) => {
          connectionProbeStarts.push("ai");
          releaseAiConnectionProbe = resolve;
        }),
      },
      f1tv: {
        probeStatus: () => new Promise((resolve) => {
          connectionProbeStarts.push("f1tv");
          releaseF1TvConnectionProbe = resolve;
        }),
      },
    },
  },
  setConnection: (value) => { finalConnectionState = value; },
  connectionProbeStarts,
  set releaseAiConnectionProbe(value) { releaseAiConnectionProbe = value; },
  set releaseF1TvConnectionProbe(value) { releaseF1TvConnectionProbe = value; },
  set finalConnectionState(value) { finalConnectionState = value; },
});
const pendingConnectionRefresh = dataProviderConnectionSandbox.refreshConnections();
assert.deepEqual(connectionProbeStarts, ["ai", "f1tv"], "AI and F1 TV connection checks should both start before either resolves");
releaseAiConnectionProbe({ codexConnected: true });
releaseF1TvConnectionProbe({ authenticated: true });
await pendingConnectionRefresh;
assert.deepEqual(
  JSON.parse(JSON.stringify(finalConnectionState)),
  { aiConfigured: true, f1tvConnected: true },
  "Concurrent connection checks should commit both resolved statuses",
);
assert.match(source["DataProvider.jsx"], /startup:\s*Boolean\(options\.initial\)/, "Initial snapshot requests should tell Electron to skip non-startup work on the critical path");
assert.match(source["DataProvider.jsx"], /options\.initial[\s\S]*shouldWaitForStartupNews\(snapshot\)[\s\S]*return snapshot[\s\S]*setInitialDataReady\(true\)/, "DataProvider should open startup after its first cached or core snapshot while enrichment continues");
assert.doesNotMatch(source["DataProvider.jsx"], /STARTUP_NEWS_FORCE_AFTER_ATTEMPTS|refreshData\(\{ initial: true, forceRefresh \}\)/, "Background enrichment polling should not force-refresh and restart the live-data request");
const dataProviderRouteSandbox = vm.runInNewContext(`(() => {
  ${extractNamedFunction(source["DataProvider.jsx"], "shouldBypassInitialLiveDataGate")}
  return { shouldBypassInitialLiveDataGate };
})()`, { URLSearchParams });
assert.equal(dataProviderRouteSandbox.shouldBypassInitialLiveDataGate("?screen=weekend&weekendRound=7&weekendSession=Practice%202"), true, "Direct Weekend recap launches should not wait for the full live-data startup gate");
assert.equal(dataProviderRouteSandbox.shouldBypassInitialLiveDataGate("?screen=dashboard"), false, "Dashboard launches should still wait for the full live-data startup gate");
assert.match(source["DataProvider.jsx"], /bypassInitialLiveDataGate[\s\S]*setTimeout\(\(\) => refreshData\(\{ forceRefresh: true, initial: true \}\)/, "Direct Weekend recap launches should defer the full live-data refresh so leaderboard analytics get the first OpenF1 slot");
assert.match(source["DataProvider.jsx"], /Loading championship standings[\s\S]*Loading race schedule[\s\S]*Loading track weather[\s\S]*Loading F1 news/, "Startup loading screen should show which live data groups are loading");
assert.match(source["Weekend.jsx"], /D\.race\?\.weatherLoc \|\| selectedRace\.loc/, "Weekend weather cards should label latest-session fallback weather honestly");
assert.doesNotMatch(source["Weekend.jsx"], /OpenF1 and Jolpica/, "Weekend loading copy should not mention Jolpica after moving live schedule to OpenF1");
const dashboardCountdownSandbox = vm.runInNewContext(`(() => {
  ${extractNamedFunction(source["Dashboard.jsx"], "dashboardSessionCandidate")}
  ${extractNamedFunction(source["Dashboard.jsx"], "dashboardNextSession")}
  ${extractNamedFunction(source["Dashboard.jsx"], "dashboardHeroRace")}
  ${extractNamedFunction(source["Dashboard.jsx"], "dashboardHeroSessions")}
  ${extractNamedFunction(source["Dashboard.jsx"], "dashboardCountdownLabel")}
  return { dashboardNextSession, dashboardHeroRace, dashboardHeroSessions, dashboardCountdownLabel };
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
const mismatchedDashboardData = {
  race: {
    name: "Monaco Grand Prix",
    circuit: "Circuit de Monaco",
    loc: "Monte Carlo",
    round: 8,
    startsAt: "2026-06-07T13:00:00Z",
  },
  sessions: [{ kind: "Race", status: "done", startsAt: "2026-06-07T13:00:00Z" }],
  schedule: [{
    name: "Barcelona Grand Prix",
    circuit: "Circuit de Barcelona-Catalunya",
    loc: "Montmeló",
    round: 9,
    startsAt: "2026-06-12T11:30:00Z",
    status: "upcoming",
    sessions: [{ kind: "Practice 1", status: "upcoming", startsAt: "2026-06-12T11:30:00Z" }],
  }],
};
const mismatchedNextSession = dashboardCountdownSandbox.dashboardNextSession(mismatchedDashboardData);
const owningHeroRace = dashboardCountdownSandbox.dashboardHeroRace(mismatchedDashboardData, mismatchedNextSession);
assert.deepEqual(
  JSON.parse(JSON.stringify({
    name: owningHeroRace.name,
    circuit: owningHeroRace.circuit,
    loc: owningHeroRace.loc,
    round: owningHeroRace.round,
  })),
  {
    name: "Barcelona Grand Prix",
    circuit: "Circuit de Barcelona-Catalunya",
    loc: "Montmeló",
    round: 9,
  },
  "Dashboard hero identity should come from the race owning the selected next session",
);
assert.match(source["Dashboard.jsx"], /Round \{heroRace\.round[\s\S]*hero__name">\{heroRace\.name[\s\S]*heroRace\.circuit,\s*heroRace\.loc/, "Dashboard hero should render the owning race's round, name, circuit, and location");
assert.deepEqual(
  Array.from(dashboardCountdownSandbox.dashboardHeroSessions(mismatchedDashboardData, mismatchedNextSession), (session) => session.kind),
  ["Practice 1"],
  "Dashboard hero session cards should come from the same race that owns the selected next session",
);
assert.deepEqual(
  Array.from(
    dashboardCountdownSandbox.dashboardHeroSessions(
      mismatchedDashboardData,
      { ...mismatchedNextSession, race: { ...mismatchedNextSession.race, sessions: [] } },
    ),
    (session) => session.kind,
  ),
  ["Race"],
  "Dashboard hero session cards should fall back to the current session list when the owning race has no sessions",
);
assert.match(source["Dashboard.jsx"], /heroSessions\.length\s*\?\s*heroSessions\.map/, "Dashboard should render the resolved owning-race session cards");
const completedDashboardData = {
  race: {
    name: "Latest Completed Grand Prix",
    circuit: "Completed Circuit",
    loc: "Finished City",
    round: 8,
    startsAt: "2026-06-07T13:00:00Z",
  },
  sessions: [{ kind: "Race", status: "done", startsAt: "2026-06-07T13:00:00Z" }],
  schedule: [{
    name: "Latest Completed Grand Prix",
    status: "done",
    startsAt: "2026-06-07T13:00:00Z",
    sessions: [{ kind: "Race", status: "done", startsAt: "2026-06-07T13:00:00Z" }],
  }],
};
const completedNextSession = dashboardCountdownSandbox.dashboardNextSession(completedDashboardData);
assert.equal(completedNextSession, null, "Dashboard should not treat a completed race's historical start time as an upcoming session");
assert.equal(
  dashboardCountdownSandbox.dashboardHeroRace(completedDashboardData, completedNextSession).name,
  "Latest Completed Grand Prix",
  "Dashboard should retain the latest race identity when no future session exists",
);
const raceOnlyUpcomingData = {
  race: {
    name: "Future Race-Only Grand Prix",
    circuit: "Future Circuit",
    loc: "Future City",
    round: 10,
    status: "upcoming",
    startsAt: "2099-07-30T13:00:00Z",
  },
  sessions: [],
  schedule: [],
};
const raceOnlyNextSession = dashboardCountdownSandbox.dashboardNextSession(raceOnlyUpcomingData);
assert.equal(raceOnlyNextSession?.race?.name, "Future Race-Only Grand Prix", "Dashboard should retain an upcoming race-level candidate when detailed sessions are unavailable");
assert.equal(raceOnlyNextSession?.session, null, "A race-level-only countdown candidate should not fabricate a session");
assert.equal(raceOnlyNextSession?.startsAt, "2099-07-30T13:00:00Z", "A race-level-only countdown should use the future race start");
assert.equal(
  dashboardCountdownSandbox.dashboardNextSession({
    race: { ...raceOnlyUpcomingData.race, status: "done", startsAt: "2026-06-07T13:00:00Z" },
    sessions: [],
    schedule: [],
  }),
  null,
  "A completed race-level candidate should remain excluded from the countdown",
);

const liveRacingSmartSandbox = vm.runInNewContext(`(() => {
  ${extractNamedFunction(source["LiveRacing.jsx"], "sessionFlagFromClock")}
  ${extractNamedFunction(source["LiveRacing.jsx"], "qualifyingPhaseFromSession")}
  ${extractNamedFunction(source["LiveRacing.jsx"], "qualifyingEliminationCount")}
  ${extractNamedFunction(source["LiveRacing.jsx"], "qualifyingQ1EliminationStart")}
  ${extractNamedFunction(source["LiveRacing.jsx"], "qualifyingQ2EliminationEnd")}
  ${extractNamedFunction(source["LiveRacing.jsx"], "isQualifyingEliminationRow")}
  ${extractNamedFunction(source["LiveRacing.jsx"], "timingDriverStatusState")}
  ${extractNamedFunction(source["LiveRacing.jsx"], "activeBattleCandidateScore")}
  ${extractNamedFunction(source["LiveRacing.jsx"], "isRetiredTimingRow")}
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
assert.equal(liveRacingSmartSandbox.sessionClockDisplayLabel({ remaining: "00:41:23", lapCount: { lap: 6, laps: 66 } }, { sessionKind: "Race" }), "", "Race timing clock should hide the remaining timer when official lap count is available");
assert.equal(liveRacingSmartSandbox.sessionClockDisplayLabel({ remaining: "00:00:00", lapCount: { lap: 6, laps: 66 } }, { sessionKind: "Race" }), "", "Race timing clock should hide a zero remaining timer when official lap count is available");
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
  ${extractNamedFunction(source["LiveRacing.jsx"], "isRetiredTimingRow")}
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
assert.equal(liveCustomLayoutSandbox.resolveCustomOnboardCode({ type: "smart-onboard", mode: "battle-primary" }, { ...nonRaceBattleContext, timingRows: [{ code: "PIA", pos: 1, retired: true }, { code: "VER", pos: 2 }, { code: "NOR", pos: 3 }] }), "VER", "Non-race custom battle primary should ignore retired timing leaders");
assert.equal(liveCustomLayoutSandbox.resolveCustomOnboardCode({ type: "smart-onboard", mode: "battle-secondary" }, { ...nonRaceBattleContext, timingRows: [{ code: "PIA", pos: 1, retired: true }, { code: "VER", pos: 2 }, { code: "NOR", pos: 3 }] }), "NOR", "Non-race custom battle secondary should ignore retired timing leaders");
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
assert.match(source["Weekend.jsx"], /resultRows\.length\s*\?\s*\(\s*<div className="wk-recap-scroll">/, "Weekend recap should hide leaderboard table chrome when no selected-session results are available");
assert.match(source["Weekend.jsx"], /wk-recap-table/, "Weekend recap should render a dedicated session leaderboard table");
assert.match(source["Weekend.jsx"], /\.wk__cols \{[^}]*grid-template-columns: minmax\(0, 1fr\) minmax\(280px, 360px\);/, "Weekend recap should keep the rail on screen by allowing the leaderboard column to shrink");
assert.match(source["Weekend.jsx"], /\.wk, \.wk > \*, \.wk__cols > \*, \.wk__rail \{[^}]*min-width: 0;/, "Weekend recap containers should allow child scrollers to shrink in windowed layouts");
assert.match(source["Weekend.jsx"], /\.wk-recap-scroll \{[^}]*min-width: 0;[^}]*max-width: 100%;[^}]*overflow-x: auto;/, "Weekend recap table overflow should stay inside the leaderboard card");
assert.match(source["Weekend.jsx"], /wk-recap-loading/, "Weekend recap should replace stale leaderboard rows with a full loading progress surface");
assert.match(source["Weekend.jsx"], /leaderboardCacheRef[\s\S]*cachedAnalytics[\s\S]*leaderboardLoading[\s\S]*!selectedAnalytics/, "Weekend recap should render cached leaderboard data immediately instead of flickering the loading surface");
assert.match(source["Weekend.jsx"], /pitwall\.analytics\.library/, "Weekend recap should resolve missing OpenF1 meeting keys before loading selected session results");
assert.match(source["Weekend.jsx"], /meetingKey: recapMeetingKey[\s\S]*season: analyticsSeason/, "Weekend recap should request analytics for the selected session with the resolved meeting key and season");
assert.match(source["Weekend.jsx"], /round: recapRace\.rnd \|\| selectedRace\.rnd/, "Weekend recap should let leaderboard analytics resolve direct round launches before the schedule library finishes");
assert.match(source["Weekend.jsx"], /sessionKey: selectedRecapSession\?\.sessionKey/, "Weekend recap should pass known OpenF1 session keys to skip redundant session lookup");
assert.match(source["Weekend.jsx"], /shouldDeferLibrary[\s\S]*selectedAnalytics\?\.drivers\?\.length[\s\S]*shouldDeferLibrary/, "Weekend recap should not let the metadata library jump ahead of direct leaderboard analytics");
assert.match(source["Weekend.jsx"], /analytics\.session\(\{[\s\S]*raceName: recapRace\.name[\s\S]*raceStartsAt: recapRace\.startsAt[\s\S]*sessionStartsAt: selectedRecapSession\?\.startsAt/, "Weekend recap should pass resolved race identity into session analytics");
assert.match(source["Weekend.jsx"], /leaderboardCacheRef\.current\.set\(analyticsKey, data\)/, "Weekend recap should remember loaded leaderboard data for flicker-free cached session switches");
assert.match(source["Weekend.jsx"], /scope: "leaderboard"/, "Weekend recap should request the faster leaderboard-scoped analytics payload");
assert.match(source["Weekend.jsx"], /hasLiveTiming = Boolean\(selectedRaceSession\?\.status === "live"\)/, "Weekend should auto-open Session live only while a current session is live");
assert.match(source["Weekend.jsx"], /setMode\(requestedMode === "recap" \? "recap" : hasLiveTiming \? "live" : "recap"\)/, "Weekend should return to recap when the current session ends");
assert.match(source["Weekend.jsx"], /Not live/, "Weekend live mode should explicitly say when the selected session is not live");
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
    "timingRows",
    "liveSessionTimingRows",
    "liveLapCountLabel",
    "weekendSessionFlagFromClock",
  ].map((name) => extractNamedFunction(source["Weekend.jsx"], name)).join("\n")}
  return { pickRace, pickSession, liveSessionTimingRows, liveLapCountLabel, weekendSessionFlagFromClock };
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
assert.equal(
  weekendSelectionSandbox.pickRace({ schedule: [], race: {}, sessions: [] }, "7").rnd,
  7,
  "Weekend direct recap should carry the requested round while the full live schedule is still loading"
);
assert.equal(
  weekendSelectionSandbox.liveSessionTimingRows({
    timing: [{ code: "VER", pos: 1 }],
    standings: [{ code: "NOR", pos: 1, pts: 120 }],
  }, false, { timing: [{ code: "HAM", pos: 1 }] }).length,
  0,
  "Weekend live mode should not show stale timing or standings rows when no session is actually live"
);
assert.deepEqual(
  weekendSelectionSandbox.liveSessionTimingRows({ timing: [{ code: "VER", pos: 1 }] }, true, { timing: [{ code: "HAM", pos: 1 }] }),
  [{ code: "HAM", pos: 1 }],
  "Weekend live mode should prefer fresh live timing rows while a session is live"
);
assert.equal(
  weekendSelectionSandbox.liveLapCountLabel({ lapCount: { lap: 52, laps: 66 } }, { lap: 31, laps: 78 }),
  "52/66",
  "Weekend live KPI should prefer the official session lap count"
);
assert.equal(
  weekendSelectionSandbox.liveLapCountLabel({}, { lap: 31, laps: 78 }),
  "31/78",
  "Weekend live KPI should fall back to dashboard lap count"
);
assert.deepEqual(
  JSON.parse(JSON.stringify(weekendSelectionSandbox.weekendSessionFlagFromClock({ status: "Started", trackStatus: { status: "1", message: "AllClear" } }))),
  { status: "green", label: "Green flag" },
  "Weekend race control should display Green flag instead of AllClear"
);
assert.deepEqual(
  JSON.parse(JSON.stringify(weekendSelectionSandbox.weekendSessionFlagFromClock({ status: "Started", trackStatus: { status: "4", message: "Safety Car" } }))),
  { status: "sc", label: "Safety car" },
  "Weekend race control should display Safety car from official track status"
);
assert.deepEqual(
  JSON.parse(JSON.stringify(weekendSelectionSandbox.weekendSessionFlagFromClock({ status: "Started", trackStatus: { status: "6", message: "VSC" } }))),
  { status: "vsc", label: "VSC" },
  "Weekend race control should display VSC from official track status"
);
assert.match(source["Weekend.jsx"], /<StatTile label="Laps" value=\{lapCountLabel \|\| "n\/a"\}/, "Weekend live KPI should replace the Timing rows card with lap count");
assert.match(source["Weekend.jsx"], /<FlagStatus status=\{flagStatus\.status\} label=\{flagStatus\.label\}/, "Weekend race control should render the normalized flag status");
assert.match(source["Weekend.jsx"], /const recapRace = libraryRace \|\| selectedRace[\s\S]*const sessions = recapRace\.sessions/, "Weekend recap should resolve direct launches from the analytics library before the full live schedule arrives");
assert.match(source["Weekend.jsx"], /const heroSession = selectedRecapSession \|\| selectedRaceSession[\s\S]*const heroCountdownLabel = heroCountdownState === "done" && heroSession\?\.kind \? heroSession\.kind \+ " completed" : heroSession\?\.kind \? heroSession\.kind \+ " starts in"/, "Weekend hero should follow the selected recap session instead of the first stale weekend session");
const weekendRecapSandbox = vm.runInNewContext(`(() => {
  ${[
    "formatSeconds",
    "resultMetric",
    "computedGapValue",
    "numericGap",
    "formatGap",
    "formatInterval",
    "formatLapDelta",
    "raceMatchText",
    "sessionHasStarted",
    "sessionCountdownState",
    "stableRandomValue",
    "pendingSessionRows",
    "sessionRequiresOfficialResult",
    "sessionResultRows",
  ].map((name) => extractNamedFunction(source["Weekend.jsx"], name)).join("\n")}
  return { sessionCountdownState, sessionResultRows };
})()`);
assert.equal(
  weekendRecapSandbox.sessionCountdownState(
    { kind: "Race", status: "done", startsAt: "2026-06-07T13:00:00Z", endsAt: "2026-06-07T15:00:00Z" },
    { status: "done" },
    Date.parse("2026-06-13T19:16:00Z")
  ),
  "done",
  "Weekend hero should show completed state for past race sessions instead of LIVE NOW"
);
const recapRows = weekendRecapSandbox.sessionResultRows({ byCode: {} }, {
  session: { name: "Qualifying", type: "Qualifying" },
  drivers: [
    { code: "HAM", name: "Lewis Hamilton", position: 1, resultDuration: 79.1, fastestLap: 78.2, gapToLeader: 0, laps: 18 },
    { code: "NOR", name: "Lando Norris", position: 2, resultDuration: 79.4, fastestLap: 77.9, gapToLeader: 0.3, laps: 15 },
  ],
}, []);
assert.deepEqual(Array.from(recapRows, (row) => row.code), ["HAM", "NOR"], "Weekend recap should prefer official session-result order over fastest-lap order");
assert.equal(recapRows[0].time, "1:19.100", "Weekend recap should show selected session result times");
const unpublishedQualifyingRows = weekendRecapSandbox.sessionResultRows({ byCode: {} }, {
  source: "OpenF1",
  session: { name: "Qualifying", type: "Qualifying" },
  counts: { sessionResult: 0, laps: 36, stints: 12 },
  drivers: [
    { code: "HAD", name: "Isack Hadjar", fastestLap: 89.276, laps: 4, stints: [{ compound: "soft" }] },
    { code: "LAW", name: "Liam Lawson", fastestLap: 89.300, laps: 6, stints: [{ compound: "soft" }] },
  ],
}, [], { kind: "Qualifying", status: "done", startsAt: "2026-07-04T15:00:00Z" });
assert.equal(unpublishedQualifyingRows.length, 0, "Weekend qualifying recap should hide OpenF1 lap-only rows until official results or F1 timing fallback are available");
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
const raceRecapRows = weekendRecapSandbox.sessionResultRows({ byCode: {} }, {
  session: { name: "Race", type: "Race" },
  drivers: [
    { code: "LEC", name: "Charles Leclerc", fastestLap: 75.964, gapToLeader: "", laps: 64 },
    { code: "ANT", name: "Kimi Antonelli", position: 1, resultDuration: 8611.243, fastestLap: 74.578, gapToLeader: 0, laps: 78 },
    { code: "HAM", name: "Lewis Hamilton", position: 2, resultDuration: 8617.514, fastestLap: 75.390, gapToLeader: 6.271, laps: 78 },
    { code: "GAS", name: "Pierre Gasly", position: 3, resultDuration: 8631.612, fastestLap: 75.477, gapToLeader: 20.369, laps: 78 },
  ],
}, [], { kind: "Race", status: "done", startsAt: "2026-06-07T13:00:00Z" });
assert.deepEqual(Array.from(raceRecapRows, (row) => row.code), ["ANT", "HAM", "GAS", "LEC"], "Weekend race recap should keep official classification rows ahead of lap-only rows");
assert.equal(raceRecapRows.at(-1).time, "—", "Weekend race recap should not show fastest laps as race finish times");
assert.equal(raceRecapRows.at(-1).gap, "—", "Weekend race recap should not compute fake race gaps from fastest laps");
const unpublishedRaceRows = weekendRecapSandbox.sessionResultRows({ byCode: {} }, {
  session: { name: "Race", type: "Race" },
  counts: { sessionResult: 0, laps: 1260, stints: 60 },
  drivers: [
    { code: "NOR", name: "Lando Norris", fastestLap: 74.578, laps: 63, stints: [{ compound: "medium" }] },
    { code: "RUS", name: "George Russell", fastestLap: 75.390, laps: 63, stints: [{ compound: "hard" }] },
  ],
}, [], { kind: "Race", status: "done", startsAt: "2026-06-14T13:00:00Z" });
assert.equal(unpublishedRaceRows.length, 0, "Weekend race recap should hide lap-only race rows until OpenF1 publishes official race results");
const lappedRaceRows = weekendRecapSandbox.sessionResultRows({ byCode: {} }, {
  session: { name: "Race", type: "Race" },
  drivers: [
    { code: "ANT", name: "Kimi Antonelli", position: 1, resultDuration: 5295.758, fastestLap: 74.578, gapToLeader: 0, laps: 68 },
    { code: "HAM", name: "Lewis Hamilton", position: 2, resultDuration: 5306.526, fastestLap: 75.390, gapToLeader: 10.768, laps: 68 },
    { code: "HAD", name: "Isack Hadjar", position: 5, fastestLap: 74.578, gapToLeader: 0, laps: 67 },
    { code: "GAS", name: "Pierre Gasly", position: 6, fastestLap: 75.812, gapToLeader: "+1 LAP", laps: 67 },
    { code: "BOR", name: "Gabriel Bortoleto", position: 7, fastestLap: 75.912, gapToLeader: "", laps: 66 },
  ],
}, [], { kind: "Race", status: "done", startsAt: "2026-06-07T18:00:00Z" });
assert.equal(lappedRaceRows[2].time, "+1 LAP", "Weekend race recap should show lap status when elapsed race duration is missing");
assert.equal(lappedRaceRows[2].gap, "+1 LAP", "Weekend race recap should derive lapped race gaps from classified lap counts");
assert.equal(lappedRaceRows[2].interval, "+1 LAP", "Weekend race recap should derive interval lap gaps from the previous classified car");
assert.equal(lappedRaceRows[3].interval, "SAME LAP", "Weekend race recap should mark same-lap lapped cars when exact interval time is unavailable");
assert.equal(lappedRaceRows[4].gap, "+2 LAPS", "Weekend race recap should derive multi-lap gaps when OpenF1 omits gap_to_leader text");
assert.equal(lappedRaceRows[4].interval, "+1 LAP", "Weekend race recap should still show lap interval when consecutive classified rows differ by laps");
assert.equal(
  weekendRecapSandbox.sessionResultRows({ byCode: {} }, null, [{ code: "HAM" }], { startsAt: "2026-01-01T00:00:00Z", status: "upcoming" })[0].code,
  "HAM",
  "Weekend recap should treat a past startsAt as started even if a stale status says upcoming"
);
assert.equal(
  weekendRecapSandbox.sessionResultRows({ byCode: {} }, null, [{ code: "HAM" }], { startsAt: "2026-01-01T00:00:00Z", status: "done" }, { loading: true }).length,
  0,
  "Weekend recap should hide fallback standings rows while selected session analytics are loading"
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
  ${["streamDescriptor", "streamRecord", "preferredMainF1TvFeed", "replayTimelineStartSeconds", "hasDirectTimelineStart", "liveSyncTargetOffset", "replayTargetMediaTime"].map((name) => extractNamedFunction(source["LiveRacing.jsx"], name)).join("\n")}
  return { streamRecord, preferredMainF1TvFeed, replayTimelineStartSeconds, liveSyncTargetOffset, replayTargetMediaTime };
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
  streamPersistenceSandbox.liveSyncTargetOffset({ videoStartUtc: "2026-05-22T20:00:00Z" }, { videoStartUtc: "2026-05-22T20:00:04Z" }),
  4,
  "Live onboard sync should add the per-feed timeline offset to the world target latency"
);
assert.equal(
  streamPersistenceSandbox.liveSyncTargetOffset({ videoStartArchiveSeconds: 403.5 }, { videoStartArchiveSeconds: 407.55 }),
  4.1,
  "Live onboard sync should round archive-derived stream offsets to tenths"
);
assert.equal(
  streamPersistenceSandbox.liveSyncTargetOffset({ videoStartUtc: "2026-05-22T20:00:00Z" }, { videoStartUtc: "2026-05-22T20:00:04Z", videoStartSource: "hls-program-date-time:fallback" }),
  0,
  "Live onboard sync should ignore fallback timing anchors copied from the world feed"
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
assert.match(source["Settings.jsx"], /key === "videoQuality"[\s\S]*persistNow\(\{ videoQuality: value \}\)/, "Settings should persist user-selected video quality through the Electron profile for app reopen");
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
assert.match(source["Settings.jsx"], /subscriptionActive === false/, "Settings should tell the user when F1 TV is signed in but the active subscription entitlement is missing");
assert.match(source["Settings.jsx"], /subscription is not active/, "Settings should name inactive subscriptions instead of treating them like generic credential failures");
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
assert.match(source["News.jsx"], /React\.useMemo\(\(\) => deriveNewsStories\(D\?\.news\), \[D\?\.news\]\)/, "News should memoize normalized stories by the live news array");
assert.match(source["News.jsx"], /React\.useMemo\(\(\) => deriveNewsFilters\(stories\), \[stories\]\)/, "News should memoize filter options by normalized stories");
assert.match(source["News.jsx"], /React\.useMemo\(\(\) => deriveFilteredNewsStories\(stories, filter, query\), \[stories, filter, query\]\)/, "News should memoize filtered stories by stories, filter, and query");
assert.match(source["News.jsx"], /React\.useMemo\(\(\) => deriveSavedNewsStories\(stories, bookmarks\), \[stories, bookmarks\]\)/, "News should memoize saved stories by stories and bookmarks");
assert.match(source["News.jsx"], /React\.useMemo\(\(\) => deriveTrendingNewsStories\(stories\), \[stories\]\)/, "News should memoize trending rows by stories");
assert.match(source["News.jsx"], /\.item\s*\{[^}]*content-visibility:\s*auto;[^}]*contain-intrinsic-size:\s*350px;/, "Repeated News cards should skip offscreen layout with a stable intrinsic size");
{
  const newsDerivations = vm.runInNewContext(`(() => {
    ${[
      "deriveNewsStories",
      "deriveNewsFilters",
      "deriveFilteredNewsStories",
      "deriveSavedNewsStories",
      "deriveTrendingNewsStories",
    ].map((name) => extractNamedFunction(source["News.jsx"], name)).join("\n")}
    return { deriveNewsStories, deriveNewsFilters, deriveFilteredNewsStories, deriveSavedNewsStories, deriveTrendingNewsStories };
  })()`);
  const slots = new Map();
  const counts = { stories: 0, filters: 0, filtered: 0, saved: 0, trending: 0 };
  const memo = (name, factory, dependencies) => {
    const previous = slots.get(name);
    if (previous && dependencies.length === previous.dependencies.length && dependencies.every((value, index) => value === previous.dependencies[index])) {
      return previous.value;
    }
    counts[name] += 1;
    const value = factory();
    slots.set(name, { dependencies, value });
    return value;
  };
  const renderNewsDerivations = (news, filter, query, bookmarks) => {
    const stories = memo("stories", () => newsDerivations.deriveNewsStories(news), [news]);
    const filters = memo("filters", () => newsDerivations.deriveNewsFilters(stories), [stories]);
    const filtered = memo("filtered", () => newsDerivations.deriveFilteredNewsStories(stories, filter, query), [stories, filter, query]);
    const saved = memo("saved", () => newsDerivations.deriveSavedNewsStories(stories, bookmarks), [stories, bookmarks]);
    const trending = memo("trending", () => newsDerivations.deriveTrendingNewsStories(stories), [stories]);
    return { stories, filters, filtered, saved, trending };
  };
  const news = [
    { id: "one", title: "McLaren update", tag: "Teams", source: "F1" },
    { id: "two", title: "Race preview", tag: "Preview", source: "Apexline" },
  ];
  const bookmarks = ["two"];
  const firstNewsDerivations = renderNewsDerivations(news, "All", "", bookmarks);
  const secondNewsDerivations = renderNewsDerivations(news, "All", "", bookmarks);
  assert.deepEqual(counts, { stories: 1, filters: 1, filtered: 1, saved: 1, trending: 1 }, "Unchanged News inputs should reuse every memoized derivation");
  assert.equal(firstNewsDerivations.stories, secondNewsDerivations.stories, "Unchanged News data should preserve the normalized stories identity");
  assert.equal(firstNewsDerivations.filtered, secondNewsDerivations.filtered, "Unchanged News filter/query should preserve filtered stories identity");
  renderNewsDerivations(news, "All", "mclaren", bookmarks);
  assert.deepEqual(counts, { stories: 1, filters: 1, filtered: 2, saved: 1, trending: 1 }, "Changing only the News query should recompute only the filtered list");
  renderNewsDerivations(news, "All", "mclaren", ["one"]);
  assert.deepEqual(counts, { stories: 1, filters: 1, filtered: 2, saved: 2, trending: 1 }, "Changing bookmarks should recompute only saved stories");
  assert.equal(firstNewsDerivations.trending.length, news.length, "News trending derivation should not truncate stories");
}
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
assert.doesNotMatch(source["News.jsx"], />Reset</, "News filters should not keep a reset button where the refresh action belongs");
assert.match(source["News.jsx"], /refreshData\(\{ forceRefresh: true \}\)[\s\S]*Refresh news/, "News refresh action should force a fresh live-data snapshot");
assert.match(source["News.jsx"], /snapshot\?\.enrichmentPending[\s\S]*refreshData\(\)/, "News refresh loading should stay up for the enrichment pass that fills article descriptions");
assert.match(source["News.jsx"], /news-refresh-loading[\s\S]*role="progressbar"[\s\S]*Loading F1 news/, "News refresh should replace stale tiles with a loading surface");
assert.match(source["News.jsx"], /\.news-refresh-loading[\s\S]*@keyframes news-refresh-load/, "News refresh loading surface should use the same progress treatment as Weekend recap loading");
assert.match(source["Schedule.jsx"], /selectedRace\.sessions/, "Schedule should render sessions from live calendar data");
assert.match(source["Schedule.jsx"], /openWeekendRecap[\s\S]*weekendRound[\s\S]*weekendMode", "recap"[\s\S]*onNavigate\("weekend"\)/, "Schedule should open clicked weekends in the Weekend recap screen");
assert.match(source["Weekend.jsx"], /requestedMode[\s\S]*weekendMode[\s\S]*setMode\(requestedMode === "recap" \? "recap" : hasLiveTiming \? "live" : "recap"\)/, "Weekend should honor direct recap launches from Schedule");
assert.match(source["Schedule.jsx"], /notifications\.schedule/, "Schedule should schedule local reminder notifications");
assert.match(source["Schedule.jsx"], /notifications\?\.cancel/, "Schedule should cancel local reminder notifications when reminders are turned off");
assert.match(source["Schedule.jsx"], /React\.useState\(\[\]\)/, "Schedule should not show a reminder as enabled before it has scheduled one");
assert.match(source["Schedule.jsx"], /REMINDER_LEAD_MS\s*=\s*5\s*\*\s*60\s*\*\s*1000/, "Schedule race reminders should fire five minutes before session start");
assert.match(source["Schedule.jsx"], /readNotificationPrefs[\s\S]*lightsOut/, "Schedule should respect the saved Lights out notification setting");
assert.match(source["Schedule.jsx"], /then\(\(result\)[\s\S]*result\?\.scheduled[\s\S]*setReminders/, "Schedule should only mark reminders enabled after native scheduling succeeds");
assert.doesNotMatch(source["Settings.jsx"], /\b(battles|pitWindows|quali)\b|\["news", "Breaking news"/, "Settings should not expose notification toggles without event producers");
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
assert.match(source["LiveRacing.jsx"], /setF1TvRaceId\(\(currentId\) => \{[\s\S]*nextLibrary\.races\.some\(\(race\) => raceLibraryId\(race\) === currentId\)/, "Async F1 TV library refreshes should preserve an explicitly selected past weekend");
assert.match(source["LiveRacing.jsx"], /loadF1TvLibrary\(f1TvSeason, \{ forceRefresh: true \}\)/, "Reload library should bypass cached F1 TV weekends");
assert.match(source["LiveRacing.jsx"], /pitwall\.f1tv\.resolveContent/, "Live mode should resolve F1 TV content into clean stream descriptors");
assert.match(source["LiveRacing.jsx"], /resolveContent\(\{[\s\S]*sessionStatus: session\.status/, "Live mode should pass selected F1 TV session status into clean stream resolution");
assert.match(source["LiveRacing.jsx"], /resolveContent\(\{[\s\S]*contentId: session\.contentId/, "Live mode should pass F1 TV library content IDs directly instead of relying on fragile hidden search results");
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
assert.match(source["LiveRacing.jsx"], /const timingCatchingUp = Boolean\(activeTimingData\?\.catchingUp\)/, "Live timing should distinguish a video-aligned catch-up buffer from a hard unavailable state");
assert.match(source["LiveRacing.jsx"], /const timingCatchUpTitle = timingCatchUpRemainingLabel[\s\S]*Catching up with live/, "Live timing sidebar should include a catch-up ETA in the loading title when known");
assert.match(source["LiveRacing.jsx"], /title=\{timingUnavailable \? "Timing unavailable" : timingCatchingUp \? timingCatchUpTitle : "Loading timing"\}/, "Live timing sidebar should match MultiViewer's catching-up state while the delayed buffer warms");
assert.match(source["LiveRacing.jsx"], /live__timinghd--loading[\s\S]*live__timingloadingtitle[\s\S]*Live Timing[\s\S]*:\s*<>\s*<span className="live__timingtitle"/, "Live timing loading header should show only a centered Live Timing label");
assert.doesNotMatch(mainProcess, /(?:OpenF1|Formula 1) live timing (?:has no current live timing rows|has no current rows)/, "Live timing warm-up should not describe transient empty live payloads as no timing rows");
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
assert.match(source["LiveRacing.jsx"], /targetUtcMs: liveTimingTargetUtcNow\(timingSync, Date\.now\(\)\)[\s\S]*targetLatencySeconds: timingSync\.targetLatencySeconds/, "Live timing should request rows by the extrapolated video UTC and retain target latency as a fallback");
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
const liveMiniSectorCountSandbox = vm.runInNewContext(`(() => {
  const TIMING_SECTOR_COLUMNS = ["s1", "s2", "s3"];
  const MINI_SECTOR_FALLBACK_COUNT = 6;
  const MINI_SECTOR_MAX_COUNT = 10;
  ${extractNamedFunction(source["LiveRacing.jsx"], "miniSectorVisibleCount")}
  ${extractNamedFunction(source["LiveRacing.jsx"], "timingSectorCounts")}
  ${extractNamedFunction(source["LiveRacing.jsx"], "preserveTimingSectorCounts")}
  return { preserveTimingSectorCounts, timingSectorCounts };
})()`);
const observedMiniSectorCounts = cloneVmValue(liveMiniSectorCountSandbox.timingSectorCounts([
  { sectors: { s1: Array(7).fill("yellow"), s2: Array(10).fill("green"), s3: Array(9).fill("blue") } },
]));
const resetMiniSectorCounts = cloneVmValue(liveMiniSectorCountSandbox.timingSectorCounts([
  { sectors: { s1: [], s2: [], s3: [] } },
]));
assert.deepEqual(
  resetMiniSectorCounts,
  { s1: 6, s2: 6, s3: 6 },
  "Empty Q2/Q3 timing rows would otherwise fall back to the default mini-sector count"
);
assert.deepEqual(
  cloneVmValue(liveMiniSectorCountSandbox.preserveTimingSectorCounts(resetMiniSectorCounts, observedMiniSectorCounts)),
  observedMiniSectorCounts,
  "Qualifying phase resets should preserve the track-specific mini-sector slot count until fresh Q2/Q3 sectors arrive"
);
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
assert.match(source["LiveRacing.jsx"], /obE__stack[\s\S]*>Last<[\s\S]*data-tone=\{telemetryData\.lastTone\}[\s\S]*>Best<[\s\S]*data-tone=\{telemetryData\.bestTone\}/, "Multiviewer bar should color both last and best laps from broadcast lap tone data");
assert.match(source["LiveRacing.jsx"], /obE__stack[\s\S]*>Int<[\s\S]*telemetryData\.interval[\s\S]*>Ldr<[\s\S]*telemetryData\.leaderGap/, "Multiviewer bar should stack interval and leader-gap values");
assert.match(source["LiveRacing.jsx"], /const sectorSlots = sectorCounts \|\| timingSectorCounts\(timingRows\)/, "Onboard mini-sector slot count should use the preserved per-track count with a local timing-row fallback");
assert.match(source["LiveRacing.jsx"], /sectorCounts=\{timingMiniSectorCounts\}/, "Onboard panes should receive the preserved per-track mini-sector counts used by the timing tower");
assert.match(source["LiveRacing.jsx"], /obE__mini[\s\S]*\["s1", "s2", "s3"\][\s\S]*Array\.from\(\{ length: sectorSlots\[key\][\s\S]*className="obE__seg"[\s\S]*telemetryData\.sectors\?\.\[key\]/, "Multiviewer bar should render a full, per-track set of mini-sector slots that stay present and fill in place as tones arrive (not appear one by one)");
assert.match(source["LiveRacing.jsx"], /obE__secRow[\s\S]*className="obE__sec" data-tone=\{telemetryData\.sectorTones\?\.\[key\] \|\| "off"\}[\s\S]*formatSectorTime\(telemetryData\.sectorTimes\?\.\[key\]\)[\s\S]*obE__secRow obE__secRow--best[\s\S]*className="obE__sec obE__sec--best" data-tone=\{telemetryData\.bestSectorTones\?\.\[key\] \|\| "off"\}[\s\S]*formatSectorTime\(telemetryData\.bestSectorTimes\?\.\[key\]\)/, "Multiviewer bar should show two centered sector-time rows below the mini-sector groups: current lap then best lap, both tinted by split status");
assert.match(source["LiveRacing.jsx"], /bestSectorTones: sectorTimeTones\(personalBest, personalBest, overallBest\)/, "Best-lap sector times should be tinted green (personal best) or purple (session fastest)");
assert.match(source["LiveRacing.jsx"], /\.obE__sec\[data-tone="yellow"\][\s\S]*\.obE__sec\[data-tone="green"\][\s\S]*\.obE__sec\[data-tone="purple"\]/, "Live onboard sector times should be tinted yellow (slower), green (personal best), or purple (session fastest)");
assert.match(source["LiveRacing.jsx"], /function sectorTimeTones\(current, personalBest, overallBest\)[\s\S]*"purple"[\s\S]*"green"[\s\S]*"yellow"/, "Sector-time tones should be derived from current split vs the driver's personal best vs the session-wide fastest");
assert.match(source["LiveRacing.jsx"], /function lapTimeTone\(current, personalBest, overallBest\)[\s\S]*"purple"[\s\S]*"green"[\s\S]*"yellow"/, "Onboard lap times should use broadcast tones: purple session fastest, green personal best, yellow slower");
assert.match(source["LiveRacing.jsx"], /obE__tyre[\s\S]*tyreRing\(telemetryData\.comp\)[\s\S]*tyreLetter\(telemetryData\.comp\)[\s\S]*telemetryData\.age/, "Multiviewer bar should show the tyre compound letter and age");
assert.match(source["LiveRacing.jsx"], /obE__pedals[\s\S]*telemetryPct\(telemetryData\.throttle\)[\s\S]*telemetryPct\(telemetryData\.brake\)/, "Multiviewer bar should render the throttle and brake ribbon along the bottom edge");
assert.match(source["LiveRacing.jsx"], /lastTone: lapTimeTone\(lastLap, personalBestLap, overallBestLap\)[\s\S]*bestTone: lapTimeTone\(personalBestLap, personalBestLap, overallBestLap\)[\s\S]*sectors: row\.sectors[\s\S]*sectorTimes: row\.sectorTimes[\s\S]*bestSectorTimes: personalBest[\s\S]*sectorTones: sectorTimeTones\(row\.sectorTimes, personalBest, overallBest\)[\s\S]*comp: row\.comp[\s\S]*age: row\.age/, "Onboard telemetry data should include broadcast lap tones, mini-sector tones, current and best split times, per-split tone status, and tyre compound and age");
assert.match(source["LiveRacing.jsx"], /\.obE \{ --u: min\([\d.]+cqw, [\d.]+px\); \}/, "Multiviewer bar should derive every dimension from one container-query unit (a fraction of 1cqw) capped at a fixed size so wide values never overflow the tyre off the edge");
assert.match(mainProcess, /bestSectorTimes: \{\s*s1: f1TimingSectorTime\(timingLine\?\.BestSectors\?\.\["0"\]\)/, "Best-lap sector times should come from the current live F1 timing source (line.BestSectors), not OpenF1 or a previous qualifying part");
assert.match(source["LiveRacing.jsx"], /function noteBestSectors\(rows, sessionKey\)[\s\S]*bestSectorAccum\.byCode[\s\S]*function resolveBestSectorTimes\(code, feedBest\)/, "Best sector splits should also be accumulated client-side from the live sectorTimes stream so they show even when a source omits BestSectors");
assert.match(source["LiveRacing.jsx"], /noteBestSectors\(timingRows, /, "Onboard render should feed the active timing rows into the best-sector accumulator");
assert.match(source["LiveRacing.jsx"], /noteBestSectors\(timingRows, `\$\{replaySync\.mode\}\|\$\{activeRaceName\}\|\$\{activeSessionKind\}\|\$\{sessionClock\?\.qualifyingPart \|\| ""\}`\)/, "Best sector accumulation should reset when qualifying advances from Q1 to Q2 or Q3");
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
assert.match(source["LiveRacing.jsx"], /\.obE__lv\[data-tone="yellow"\][\s\S]*var\(--t-slower\)/, "Multiviewer bar lap values should tone yellow on a slower last lap");
assert.match(source["LiveRacing.jsx"], /\.obE__lv\[data-tone="green"\][\s\S]*var\(--t-personal\)[\s\S]*\.obE__lv\[data-tone="purple"\][\s\S]*var\(--t-fastest\)/, "Multiviewer bar lap values should tone green on a personal best and purple on a session-fastest time");
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
assert.match(mainProcess, /PITWALL_LIVE_TIMING_DIAG/, "Live timing should support a terminal diagnostic for real SignalR sync sampling");
assert.match(mainProcess, /lapBacktracks/, "Live timing diagnostic should detect lap counter rollbacks");
assert.match(mainProcess, /sectorBacktracks/, "Live timing diagnostic should detect mini-sector progress disappearing within the same lap");
assert.match(source["LiveRacing.jsx"], /pitwall\.data\.liveTiming\(\{[\s\S]*source: "f1"/, "Live Racing live mode should request Formula 1 SignalR timing only instead of falling back to OpenF1");
assert.match(mainProcess, /catchingUp: true[\s\S]*catchUpRemainingSeconds[\s\S]*Formula 1 live timing is catching up to the video buffer/, "Formula 1 live timing should report warm target buffers as catching up with an ETA when known");
assert.match(mainProcess, /targetLatencySeconds/, "Formula 1 live timing snapshots should accept a target latency for video alignment");
assert.match(mainProcess, /Date\.now\(\) \/ 1000 - targetLatencySeconds/, "Formula 1 live timing should render buffered rows at the video target latency");
assert.match(mainProcess, /getF1LiveTimingSnapshot\(\{\s*targetLatencySeconds,\s*targetUtcMs\s*\}\)/, "Live timing IPC should forward the video UTC target to the Formula 1 timing snapshot");
assert.match(mainProcess, /getPlayheadTimeAsDate/, "F1 TV live sync diagnostics should expose the video playhead UTC used for live timing alignment");
assert.match(mainProcess, /PITWALL_F1TV_LIVE_SYNC_CHECK_TIMING[\s\S]*targetUtcMs: finalPlayheadUtcMs/, "F1 TV live sync diagnostics should verify live timing at the probed video UTC");
assert.match(mainProcess, /signalrcore/, "Live timing should connect to Formula 1's SignalR Core live timing stream");
assert.match(mainProcess, /trackStatusEntries: entriesByTopic\.TrackStatus/, "Live timing should pass official track flags into snapshots");
assert.match(mainProcess, /raceControlEntries: entriesByTopic\.RaceControlMessages/, "Live timing should pass official race-control messages into snapshots");
assert.match(mainProcess, /function ensureF1TimingLiveClient[\s\S]*getF1TvSubscriptionToken\(\)[\s\S]*authToken/, "Formula 1 SignalR Core live timing should pass the resolved F1 TV subscription token as Formula 1's authToken query without logging it");
assert.match(mainProcess, /F1_TIMING_LIVE_CONNECT_RETRY_MS = 8000/, "Formula 1 SignalR live timing should retry failed setup quickly enough to avoid long frozen gaps");
assert.match(mainProcess, /F1_TIMING_LIVE_CLOSE_RETRY_MS = 5000/, "Formula 1 SignalR live timing should reconnect promptly after socket closes");
assert.match(mainProcess, /function f1TimingSignalRCookieFromHeaders[\s\S]*AWSALBCORS/, "Formula 1 SignalR live timing should extract FastF1's AWSALBCORS cookie");
assert.match(mainProcess, /function requestF1TimingSignalRCookie[\s\S]*method:\s*"OPTIONS"/, "Formula 1 SignalR live timing should preflight negotiate with OPTIONS before opening the socket");
assert.match(mainProcess, /requestF1TimingJsonPost\(F1_TIMING_NEGOTIATE_URL,\s*10000,\s*signalRCookie \? \{ Cookie: signalRCookie \} : \{\}\)/, "Formula 1 SignalR live timing should carry the AWSALBCORS cookie into negotiate");
assert.match(mainProcess, /function createF1TimingWebSocket[\s\S]*Sec-WebSocket-Key[\s\S]*Object\.entries\(headers/, "Formula 1 SignalR live timing should use a WebSocket handshake that can include custom headers");
assert.match(mainProcess, /wsHeaders\.Cookie = signalRCookie/, "Formula 1 SignalR live timing should carry the AWSALBCORS cookie into the WebSocket handshake");
assert.match(mainProcess, /function runLiveTimingDiagnosticAndQuit[\s\S]*probeF1TvStoredAuth[\s\S]*subscriptionTokenReady/, "Live timing diagnostics should warm the F1 TV auth profile and report subscription-token readiness separately");
assert.match(mainProcess, /openF1CarData/, "Electron main should fetch OpenF1 car data for onboard telemetry");
assert.match(mainProcess, /latestCarDataByDriverNumber/, "Electron main should normalize latest car data by driver");
assert.match(mainProcess, /parseTiming\([\s\S]*openF1Laps/, "Live timing parser should include lap data for last/best lap and mini sectors");
assert.match(mainProcess, /segments_sector_1/, "Timing parser should read OpenF1 mini-sector segment arrays");
assert.match(mainProcess, /date_start/, "Replay timing should align OpenF1 lap rows by date_start");
assert.match(mainProcess, /duration_sector_1/, "Replay timing should derive lap durations from OpenF1 sector durations when needed");
assert.match(mainProcess, /carDataOffsetMs/, "Replay timing should compensate for OpenF1 car_data clock offsets");
assert.match(mainProcess, /getReplayCarDataSnapshot[\s\S]{0,500}Number\(targetMs\) \+ Number\(carDataOffsetMs/, "Replay telemetry windows should use the adjusted OpenF1 car_data clock");
assert.match(mainProcess, /bestLapDuration/, "Timing rows should include best lap duration");
assert.match(mainProcess, /replayOpenF1Cache/, "Replay timing should cache full OpenF1 session data instead of polling every video bucket");
assert.match(mainProcess, /getReplayOpenF1SessionData/, "Replay timing should reuse fetched OpenF1 replay session data");
assert.match(mainProcess, /filterReplayRowsAt/, "Replay timing should filter cached OpenF1 rows by video clock locally");
assert.match(mainProcess, /replayRowTimelineCache[\s\S]*function replayRowsTimeline[\s\S]*function filterReplayRowsAt/, "Replay timing should reuse a sorted OpenF1 row timeline instead of sorting every poll bucket");
assert.match(mainProcess, /getReplayOpenF1SessionData[\s\S]*requestOpenF1JsonMap/, "OpenF1 replay fallback should fetch rich session tables concurrently behind the rate limiter");
assert.match(mainProcess, /getReplayF1TimingSessionData[\s\S]*optionIdentity[\s\S]*resolveF1TimingArchiveBase[\s\S]*requestOpenF1Json/, "Formula 1 replay timing should try resolved archive identity before spending OpenF1 metadata requests");
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
assert.match(source["LiveRacing.jsx"], /function liveSyncStatus/, "Live mode should derive a plain-language sync status from latency metrics");
assert.match(source["LiveRacing.jsx"], /sync-menu__live/, "Sync menu should show live ahead-behind stats without requiring the debug overlay");
assert.match(source["LiveRacing.jsx"], /liveMetrics=\{syncMetrics\.WORLD\}/, "Top-level Sync menu should summarize the F1 Live world-feed sync metrics");
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
    "isRetiredTimingRow",
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
const sharedModelCatalog = require("@neelsatyavolu/shared-ai-auth").bundledModels;
assert.ok(sharedModelCatalog.grok.some((model) => model.id === "grok-4.7"), "AI model list should include Grok 4.7");
assert.ok(sharedModelCatalog.grok.some((model) => model.id === "grok-4.6"), "AI model list should include Grok 4.6");
assert.match(mainProcess, /sharedAuth\.loadModels/, "AI model list should refresh from the shared catalog");
assert.match(mainProcess, /DEFAULT_GROK_MODEL = "grok-4\.6"/, "Default Grok model should be Grok 4.6");
assert.match(source["Settings.jsx"], /oauthStatus\.grokModels/, "Settings should offer the shared Grok model list");
assert.doesNotMatch(source["Settings.jsx"], /label: "Grok 4\.5"/, "Settings should not keep Grok 4.5 as a selectable model");
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
assert.match(mainProcess, /stintMode[\s\S]*projected/, "AI visualization schema should allow projected strategy stint traces");
assert.match(mainProcess, /stintMode:[\s\S]*"none"[\s\S]*required: \["kind", "stintMode", "title"/, "Strict AI visualization schema should require a neutral stintMode for non-strategy visuals");
assert.match(mainProcess, /projected tyre_strategy stints[\s\S]*not present projected stints as actual telemetry/, "AI prompt should permit labelled projected race-strategy stints without calling them actual telemetry");
assert.match(mainProcess, /COPILOT_INSIGHTS_SCHEMA_VERSION = 13/, "Daily Copilot cache schema should invalidate stale pages after recent-form and tyre-alert cleanup changes");
assert.match(mainProcess, /LIVE_SNAPSHOT_CACHE_VERSION = 4/, "Live snapshot cache should invalidate stale no-form or sparse-standings snapshots");
assert.match(mainProcess, /pageId === "current-weekend"[\s\S]*buildWeekendPerformanceContext\(data, currentRaceWeekend/, "Current weekend projections should receive recent-race pace and circuit history alongside live FP/qualifying session data");
assert.match(mainProcess, /projectedPoints: \{ type: "number" \}/, "AI prediction candidates should carry an AI-computed projected season points field");
assert.match(mainProcess, /projected FINAL season points total/, "Championship prompts should ask the AI to compute projected final season points");
assert.match(mainProcess, /snapshot\.projectionConstraints[\s\S]*finalPointsBudget/, "Championship prompts should tell the AI the official total points budget for the season");
assert.match(mainProcess, /F1\.com Strategy Guide[\s\S]*Pirelli[\s\S]*Tyres Available for Race|Pirelli[\s\S]*Tyres Available for Race[\s\S]*F1\.com Strategy Guide/, "Current weekend stint prompts should point browsing-capable AI providers at F1.com/Pirelli tyre-availability sources when sets are not supplied");
assert.match(mainProcess, /function isMissingTyreAvailabilityAlert/, "Current weekend Strategy calls should filter missing-tyre-availability disclaimers out of actionable alerts");
assert.match(mainProcess, /async function dailyInsightSnapshot[\s\S]*drivers: \(data\.drivers[\s\S]*driverForm: data\.driverForm[\s\S]*formRounds: \(data\.formRounds/, "Daily AI projections should receive the full roster and recent form, then choose how to use them");
assert.match(mainProcess, /function championshipPointsBudget[\s\S]*101[\s\S]*36/, "Projected championship points should be bounded by Grand Prix and sprint points available across the season");
assert.match(mainProcess, /function scaleProjectedPointsToBudget/, "Projected championship points should be scaled before caching when the AI exceeds the official season total");
assert.match(mainProcess, /page\.id === "next-weekend"[\s\S]*race winner[\s\S]*podium/, "Next weekend AI prompt should explicitly request race predictions");
assert.match(mainProcess, /page\.id === "next-weekend"[\s\S]*Grand Prix race[\s\S]*full predicted race finishing order/, "Next weekend AI prompt should request a race finishing-order leaderboard");
assert.doesNotMatch(mainProcess, /Treat snapshot\.nextUpcomingSession as the target|full predicted next upcoming session order/, "Next weekend AI prompt should not target FP1 or another next scheduled session for the leaderboard");
assert.match(mainProcess, /pageId === "next-weekend"[\s\S]{0,120}await buildNextWeekendPerformanceContext\(data/, "Next weekend AI snapshots should include a cumulative performance context");
assert.match(mainProcess, /function buildWeekendPerformanceContext[\s\S]*currentSeason[\s\S]*previousSeason[\s\S]*trackHistory/, "Weekend performance context should include current-season, previous-season, and target-track evidence");
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
assert.match(mainProcess, /forceCopilotPageId[\s\S]*refreshDailyCopilotInsights/, "Daily Copilot projections should support rerunning one selected prebuilt page");
assert.match(mainProcess, /mergeCopilotInsightPages[\s\S]*updatedPages/, "Scoped Daily Copilot reruns should preserve the other cached prebuilt pages");
assert.match(source["Copilot.jsx"], /ai-vis__mode[\s\S]*Projected strategy/, "Copilot strategy visuals should visibly label projected stint traces");
assert.match(source["Copilot.jsx"], /predictionPicks\(page, model, "winner"\)/, "Copilot should render AI-computed Current weekend win/podium predictions");
assert.match(source["Copilot.jsx"], /page\?\.predictions\?\.\[kind\]/, "Copilot should read AI-computed predictions from each prebuilt insight page");
assert.match(source["Copilot.jsx"], /progressOpen[\s\S]*Show progress[\s\S]*cop-progress/, "Copilot should expose a Show progress control for daily AI generation");
assert.match(source["DataProvider.jsx"], /forceCopilotPageId:\s*options\.forceCopilotPageId/, "DataProvider should pass the selected Copilot page rerun scope into the snapshot IPC");
assert.match(source["Copilot.jsx"], /function rerunAnalysis[\s\S]*forceCopilotPageId:\s*scoped \? activeTab : ""/, "Copilot should request a selected-tab daily projection rerun without refreshing every page");
assert.match(source["Copilot.jsx"], /cop-hero__actions[\s\S]*Rerun this tab[\s\S]*Rerun all/, "Copilot should expose a top active-tab rerun action and keep an all-pages rerun action");
assert.match(source["Copilot.jsx"], /Projected season points share[\s\S]*share__seg/, "Copilot should render a championship-specific projected points-share visual");
assert.match(source["Copilot.jsx"], /share__seg[\s\S]*color:\s*"#0a0d12"/, "Constructor projected share labels should stay black on every team-color bar");
assert.match(source["Copilot.jsx"], /Projected driver contribution[\s\S]*contrib__seg/, "Constructor projections should break down each team's projected driver contribution");
assert.match(source["Copilot.jsx"], /function TeamLogo[\s\S]*team\.logo/, "Constructor Copilot rows should render official team logos instead of initials-only avatars");
assert.match(source["Copilot.jsx"], /driver\.remoteImage \|\| driver\.image/, "Driver Copilot rows should render official driver photos before packaged fallbacks");
assert.match(source["Copilot.jsx"], /Projected final order[\s\S]*FormPips/, "Copilot should render the full projected driver order with recent form");
assert.match(source["Copilot.jsx"], /driverForm\[String\(row\.code \|\| ""\)\.toUpperCase\(\)\][\s\S]*driver\.form/, "Copilot model should fall back to live profile recent form instead of rendering No data when form is available");
assert.match(source["Copilot.jsx"], /Predicted podium/, "Current weekend projections should show a predicted podium");
assert.match(source["Copilot.jsx"], /Win probability[\s\S]*pick__prob/, "Current weekend projections should show win-probability picks");
assert.match(source["Copilot.jsx"], /Projected race strategy[\s\S]*stints/, "Current weekend projections should show a projected race-strategy timeline");
assert.match(source["Copilot.jsx"], /function aiProjection/, "Copilot should read every projection from the AI daily pages, not a client model");
assert.match(source["Copilot.jsx"], /candidate\?\.projectedPoints|candidates\.get\([\s\S]{0,40}\)\?\.projectedPoints|projectedPoints: cand/, "Copilot should render AI-computed projected points");
assert.doesNotMatch(source["Copilot.jsx"], /ppr \* roundsLeft|titleShare/, "Copilot should not synthesise its own projection numbers from a scoring-rate simulation");
assert.match(source["Copilot.jsx"], /INSIGHT_TABS/, "Copilot should expose tabs for prebuilt insights and chat");
assert.match(source["Copilot.jsx"], /ask-copilot/, "Copilot should keep freeform chat in a separate Ask Copilot tab");
assert.match(source["Copilot.jsx"], /daily\.pages/, "Copilot should render prebuilt daily insight pages from the snapshot");
assert.match(source["Copilot.jsx"], /driverForm:\s*D\.driverForm \|\| \{\}[\s\S]*formRounds:\s*\(D\.formRounds \|\| \[\]\)\.slice\(0, 30\)/, "Ask Copilot snapshots should include recent form so the AI does not report driverForm/formRounds missing");
assert.match(source["Copilot.jsx"], /copilotThinkingStage[\s\S]*Preparing the live snapshot[\s\S]*Waiting on the provider/, "Ask Copilot should show staged progress text while waiting on slow AI providers");
assert.match(source["Copilot.jsx"], /msg--thinking[\s\S]*role="status"[\s\S]*thinkingSeconds/, "Ask Copilot should render its in-flight AI response as an accessible live status");
const projectionPointsSandbox = vm.runInNewContext(`(() => {
  ${extractNamedFunction(mainProcess, "emptyDailyPredictions")}
  ${extractNamedFunction(mainProcess, "normalizePredictionCandidate")}
  ${extractNamedFunction(mainProcess, "normalizePredictionWatchItem")}
  ${extractNamedFunction(mainProcess, "isMissingTyreAvailabilityAlert")}
  ${extractNamedFunction(mainProcess, "raceHasSprintPoints")}
  ${extractNamedFunction(mainProcess, "championshipPointsBudget")}
  ${extractNamedFunction(mainProcess, "championshipCurrentPointsTotal")}
  ${extractNamedFunction(mainProcess, "projectionTextKey")}
  ${extractNamedFunction(mainProcess, "currentPointsForProjectionCandidate")}
  ${extractNamedFunction(mainProcess, "scaleProjectedPointsToBudget")}
  ${extractNamedFunction(mainProcess, "normalizeChampionshipPredictionTotals")}
  ${extractNamedFunction(mainProcess, "normalizeRaceProjectionTotals")}
  ${extractNamedFunction(mainProcess, "normalizeDailyPredictions")}
  ${extractNamedFunction(mainProcess, "normalizeDailyInsightPage")}
  return { championshipPointsBudget, normalizeDailyInsightPage };
})()`);
const sprintSeasonSchedule = Array.from({ length: 22 }, (_, index) => ({
  rnd: index + 1,
  sessions: index < 6 ? [{ kind: "Sprint" }, { kind: "Race" }] : [{ kind: "Race" }],
}));
assert.equal(
  projectionPointsSandbox.championshipPointsBudget({ seasonSummary: { totalRounds: 22 }, schedule: sprintSeasonSchedule }),
  2438,
  "Projected championship points budget should match 22 Grands Prix plus six sprint weekends"
);
const overBudgetConstructorPage = projectionPointsSandbox.normalizeDailyInsightPage(
  { id: "constructors-championship", title: "Constructors" },
  {
    summary: "Over budget",
    alerts: [],
    visualization: null,
    predictions: {
      available: true,
      title: "Constructors",
      summary: "Over budget",
      winner: [{ code: "MER", label: "Mercedes", confidence: 0.8, probability: 0.4, projectedPoints: 900, reason: "AI" }],
      podium: [],
      leaderboard: [
        { code: "MER", label: "Mercedes", confidence: 0.8, probability: 0.4, projectedPoints: 900, reason: "AI" },
        { code: "FER", label: "Ferrari", confidence: 0.7, probability: 0.3, projectedPoints: 800, reason: "AI" },
        { code: "MCL", label: "McLaren", confidence: 0.7, probability: 0.2, projectedPoints: 700, reason: "AI" },
        { code: "RBR", label: "Red Bull Racing", confidence: 0.6, probability: 0.1, projectedPoints: 600, reason: "AI" },
      ],
      watchlist: [],
      caveat: "",
    },
  },
  {
    seasonSummary: { totalRounds: 22 },
    schedule: sprintSeasonSchedule,
    constructors: [
      { abbr: "MER", name: "Mercedes", pts: 200 },
      { abbr: "FER", name: "Ferrari", pts: 180 },
      { abbr: "MCL", name: "McLaren", pts: 170 },
      { abbr: "RBR", name: "Red Bull Racing", pts: 150 },
    ],
  }
);
assert.ok(
  overBudgetConstructorPage.predictions.leaderboard.reduce((sum, row) => sum + row.projectedPoints, 0) <= 2438,
  "Normalized constructor projections should never total more than the official season points budget"
);
assert.equal(
  overBudgetConstructorPage.predictions.winner[0].projectedPoints,
  overBudgetConstructorPage.predictions.leaderboard[0].projectedPoints,
  "Winner/podium projection points should be kept consistent with the normalized leaderboard"
);
const overBudgetDriverPage = projectionPointsSandbox.normalizeDailyInsightPage(
  { id: "drivers-championship", title: "Drivers" },
  {
    summary: "Over budget",
    alerts: [],
    visualization: null,
    predictions: {
      available: true,
      title: "Drivers",
      summary: "Over budget",
      winner: [],
      podium: [],
      leaderboard: [
        { code: "ANT", label: "Antonelli", confidence: 0.8, probability: 0.4, projectedPoints: 1000, reason: "AI" },
        { code: "HAM", label: "Hamilton", confidence: 0.7, probability: 0.3, projectedPoints: 900, reason: "AI" },
        { code: "RUS", label: "Russell", confidence: 0.7, probability: 0.2, projectedPoints: 800, reason: "AI" },
      ],
      watchlist: [],
      caveat: "",
    },
  },
  {
    seasonSummary: { totalRounds: 22 },
    schedule: sprintSeasonSchedule,
    standings: [
      { code: "ANT", pts: 120 },
      { code: "HAM", pts: 100 },
      { code: "RUS", pts: 90 },
    ],
  }
);
assert.ok(
  overBudgetDriverPage.predictions.leaderboard.reduce((sum, row) => sum + row.projectedPoints, 0) <= 2438,
  "Normalized driver projections should never total more than the official season points budget"
);
assert.ok(
  overBudgetDriverPage.predictions.leaderboard.every((row) => row.projectedPoints >= ({ ANT: 120, HAM: 100, RUS: 90 }[row.code] || 0)),
  "Normalized driver projected totals should not drop below current points"
);
const tyreDisclaimerPage = projectionPointsSandbox.normalizeDailyInsightPage(
  { id: "current-weekend", title: "Current weekend" },
  {
    summary: "Race read",
    alerts: [
      { kind: "strategy", title: "Tyre sets not supplied", body: "Driver available tyre sets are not supplied in the snapshot.", confidence: 0.9 },
      { kind: "strategy", title: "Undercut window", body: "Russell can attack lap 18.", confidence: 0.7 },
    ],
    visualization: null,
    predictions: { available: false },
  },
  {}
);
assert.deepEqual(
  tyreDisclaimerPage.alerts.map((alert) => alert.title),
  ["Undercut window"],
  "Missing tyre availability should remain a caveat, not an actionable Strategy call"
);
assert.match(mainProcess, /openF1Stints/, "Live snapshot should ingest OpenF1 stint data for tyre strategy reasoning");
assert.match(mainProcess, /OPTIONAL_LIVE_DATA_KEYS/, "Optional tyre enrichment feeds should not make the main live snapshot look broken");
assert.match(mainProcess, /LIVE_CORE_DATA_URLS/, "Dashboard snapshot should have a fast core live-data request set");
assert.match(mainProcess, /LIVE_TIMING_ENRICHMENT_URLS/, "Timing enrichment feeds should be separated from dashboard first paint");
assert.match(mainProcess, /LIVE_SNAPSHOT_CACHE_FILE/, "Dashboard snapshot should persist a last-good disk cache for fast repeat launches");
assert.match(mainProcess, /readLiveSnapshotDiskCache/, "Dashboard snapshot should read stale disk data before waiting on live sources");
assert.match(mainProcess, /forceRefresh[\s\S]*refreshLiveDataSnapshot/, "Dashboard snapshot IPC should support bypassing disk cache for the startup loading gate");
assert.match(mainProcess, /writeLiveSnapshotDiskCache/, "Dashboard snapshot should save successful live data for the next app launch");
assert.match(mainProcess, /refreshLiveDataSnapshot/, "Dashboard snapshot should refresh stale disk data in the background");
assert.match(mainProcess, /refreshLiveDataEnrichment[\s\S]*priority:\s*"background"/, "Live-data enrichment should yield OpenF1 slots to foreground user actions");
assert.match(mainProcess, /live-data\.refresh-failed[\s\S]*enrichmentPending:\s*false/, "Failed background live-data refresh should settle cached startup news pending so the loading screen can open");
assert.match(mainProcess, /const deferCopilot = Boolean\(options\.startup\)[\s\S]*getDailyCopilotInsights\(data,[\s\S]*deferCopilot[\s\S]*return data/, "Startup snapshots should return the fresh news feed before daily Copilot generation finishes");
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
assert.match(source["LiveRacing.jsx"], /const aiInsightSessionLoaded =[\s\S]*replaySync\.mode === "replay"[\s\S]*resolvedF1TvContent[\s\S]*streamSources\.WORLD/, "Automated AI insight polling should be gated to a loaded live or replay session");
assert.match(source["LiveRacing.jsx"], /if \(!connection\.aiConfigured \|\| !window\.pitwall\?\.ai\?\.ask \|\| !aiInsightSessionLoaded\)/, "Automated AI insights should not queue toasts before a session is loaded");
assert.match(source["LiveRacing.jsx"], /chatThinking/, "Ask the engineer should track an in-flight AI response");
assert.match(source["LiveRacing.jsx"], /setChatThinking\(true\)[\s\S]*finally[\s\S]*setChatThinking\(false\)/, "Ask the engineer should show a thinking state only while the AI request is in flight");
assert.match(source["LiveRacing.jsx"], /Engineer is thinking/, "Ask the engineer should render a visible thinking message while waiting for AI");
assert.match(source["LiveRacing.jsx"], /msg--thinking/, "Ask the engineer thinking message should have a dedicated visual state");
assert.match(source["LiveRacing.jsx"], /aiPopupOpenRef[\s\S]*React\.useRef\(aiPopupOpen\)[\s\S]*aiPopupOpenRef\.current = aiPopupOpen/, "Ask the engineer should track current AI popup visibility while an answer is in flight");
assert.match(source["LiveRacing.jsx"], /const summary = answer\.summary \|\| "The configured AI provider returned no summary\."[\s\S]*if \(layout === "focus" && !aiPopupOpenRef\.current\) pushAiInsightToast\(\{[\s\S]*kind:\s*"engineer"[\s\S]*title:\s*"Engineer replied"[\s\S]*body:\s*summary/, "Ask the engineer should toast a completed response when the AI popup was closed before the answer arrived");
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
}

runSmokeChecks().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
