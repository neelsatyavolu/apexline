const { execFileSync } = require("node:child_process");
const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const electronApp = path.join(root, "node_modules/electron/dist/Electron.app");
const appIcon = path.join(root, "assets/app-icon.icns");
const entitlementsPath = path.join(root, "build/entitlements.mac.plist");
const outRoot = path.join(root, "dist");
const baseOut = path.join(outRoot, "Apexline.app");
const rootPackage = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
const appVersion = String(rootPackage.version || "0.0.0");
const updateBaseUrl = String(process.env.APEXLINE_UPDATE_BASE_URL || process.env.PITWALL_UPDATE_BASE_URL || rootPackage.apexline?.updateBaseUrl || rootPackage.pitwall?.updateBaseUrl || "").replace(/\/+$/, "");
const defaultBundleId = "io.apexline.app";
const bundleId = String(process.env.APEXLINE_BUNDLE_ID || rootPackage.apexline?.bundleId || defaultBundleId).trim() || defaultBundleId;

function ensure(condition, message) {
  if (!condition) throw new Error(message);
}

function envFlag(name) {
  return /^(1|true|yes)$/i.test(String(process.env[name] || ""));
}

function copyEntry(source, target) {
  ensure(fs.existsSync(source), `Missing ${path.relative(root, source)}`);
  fs.cpSync(source, target, { recursive: true, verbatimSymlinks: true });
}

function ensureSymlink(linkPath, targetPath) {
  try {
    if (fs.existsSync(linkPath) || fs.lstatSync(linkPath).isSymbolicLink()) return;
  } catch {}
  fs.symlinkSync(targetPath, linkPath);
}

function repairMacFrameworkSymlinks(appPath) {
  const frameworksRoot = path.join(appPath, "Contents/Frameworks");
  if (!fs.existsSync(frameworksRoot)) return;
  for (const entry of fs.readdirSync(frameworksRoot)) {
    if (!entry.endsWith(".framework")) continue;
    const frameworkPath = path.join(frameworksRoot, entry);
    const versionA = path.join(frameworkPath, "Versions/A");
    if (!fs.existsSync(versionA)) continue;
    const name = entry.replace(/\.framework$/, "");
    ensureSymlink(path.join(frameworkPath, "Versions/Current"), "A");
    for (const child of [name, "Resources", "Libraries", "Helpers"]) {
      if (fs.existsSync(path.join(versionA, child))) {
        ensureSymlink(path.join(frameworkPath, child), path.join("Versions/Current", child));
      }
    }
  }
}

function buildStamp() {
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\..+/, "").replace("T", "-");
  return stamp;
}

function plistSet(plist, key, value) {
  execFileSync("/usr/libexec/PlistBuddy", ["-c", `Set :${key} ${value}`, plist], { stdio: "ignore" });
}

function plistDelete(plist, key) {
  try {
    execFileSync("/usr/libexec/PlistBuddy", ["-c", `Delete :${key}`, plist], { stdio: "ignore" });
  } catch {}
}

function castLabsVmpEnabled() {
  return /^(1|true|yes|streaming|persistent)$/i.test(String(process.env.PITWALL_CASTLABS_VMP || ""));
}

function castLabsVmpKind() {
  const requested = String(process.env.PITWALL_CASTLABS_VMP || "").toLowerCase();
  if (requested === "persistent" || /^(1|true|yes)$/i.test(String(process.env.PITWALL_CASTLABS_VMP_PERSISTENT || ""))) return "--persistent";
  return "--streaming";
}

function signWithCastLabsVmp(appPath) {
  if (!castLabsVmpEnabled()) return;
  const python = process.env.PITWALL_EVS_PYTHON || "python3";
  const kind = castLabsVmpKind();
  const signRoot = path.join(outRoot, `.apexline-vmp-sign-${process.pid}`);
  const stagedApp = path.join(signRoot, "Apexline.app");

  fs.rmSync(signRoot, { recursive: true, force: true });
  fs.mkdirSync(signRoot, { recursive: true });
  fs.renameSync(appPath, stagedApp);
  try {
    console.log(`CastLabs VMP signing ${path.basename(appPath)} (${kind.replace("--", "")})`);
    execFileSync(python, ["-m", "castlabs_evs.vmp", "sign-pkg", kind, signRoot], { stdio: "inherit" });
    execFileSync(python, ["-m", "castlabs_evs.vmp", "verify-pkg", kind, signRoot], { stdio: "inherit" });
    fs.renameSync(stagedApp, appPath);
  } catch (error) {
    if (fs.existsSync(stagedApp) && !fs.existsSync(appPath)) fs.renameSync(stagedApp, appPath);
    throw error;
  } finally {
    fs.rmSync(signRoot, { recursive: true, force: true });
  }
}

function resolveSigningIdentity() {
  const explicit = String(process.env.APPLE_SIGNING_IDENTITY || process.env.APEXLINE_SIGN_IDENTITY || "").trim();
  if (explicit) return explicit;
  if (process.env.APPLE_CERTIFICATE) {
    return "Developer ID Application: Ramakrishna Satyavolu (VTQW687WBQ)";
  }
  return "";
}

function notarizeRequested() {
  if (envFlag("APEXLINE_SKIP_NOTARIZE")) return false;
  // Explicit only — load-apple-creds always exports API keys when present.
  return envFlag("APEXLINE_NOTARIZE") || envFlag("APPLE_NOTARIZE");
}

function importCertificateKeychain() {
  const b64 = String(process.env.APPLE_CERTIFICATE || "").trim();
  const password = String(process.env.APPLE_CERTIFICATE_PASSWORD || "");
  if (!b64) return null;

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "apexline-codesign-"));
  const p12Path = path.join(tmpDir, "certificate.p12");
  const keychainPath = path.join(tmpDir, "signing.keychain-db");
  const keychainPassword = crypto.randomBytes(24).toString("hex");
  fs.writeFileSync(p12Path, Buffer.from(b64, "base64"));
  fs.chmodSync(p12Path, 0o600);

  execFileSync("security", ["create-keychain", "-p", keychainPassword, keychainPath], { stdio: "ignore" });
  execFileSync("security", ["set-keychain-settings", "-lut", "21600", keychainPath], { stdio: "ignore" });
  execFileSync("security", ["unlock-keychain", "-p", keychainPassword, keychainPath], { stdio: "ignore" });
  execFileSync("security", [
    "import", p12Path,
    "-k", keychainPath,
    "-P", password,
    "-T", "/usr/bin/codesign",
    "-T", "/usr/bin/security",
    "-T", "/usr/bin/productsign",
  ], { stdio: "ignore" });
  execFileSync("security", [
    "set-key-partition-list",
    "-S", "apple-tool:,apple:,codesign:",
    "-s",
    "-k", keychainPassword,
    keychainPath,
  ], { stdio: "ignore" });

  const list = execFileSync("security", ["list-keychains", "-d", "user"], { encoding: "utf8" });
  const existing = list.split("\n").map((line) => line.trim().replace(/^"|"$/g, "")).filter(Boolean);
  const ordered = [keychainPath, ...existing.filter((item) => item !== keychainPath)];
  execFileSync("security", ["list-keychains", "-d", "user", "-s", ...ordered], { stdio: "ignore" });
  execFileSync("security", ["default-keychain", "-d", "user", "-s", keychainPath], { stdio: "ignore" });
  execFileSync("security", ["unlock-keychain", "-p", keychainPassword, keychainPath], { stdio: "ignore" });

  return { tmpDir, keychainPath, keychainPassword, previousKeychains: existing };
}

function cleanupCertificateKeychain(session) {
  if (!session) return;
  try {
    if (session.previousKeychains?.length) {
      execFileSync("security", ["list-keychains", "-d", "user", "-s", ...session.previousKeychains], { stdio: "ignore" });
    }
  } catch {}
  try {
    execFileSync("security", ["delete-keychain", session.keychainPath], { stdio: "ignore" });
  } catch {}
  try {
    fs.rmSync(session.tmpDir, { recursive: true, force: true });
  } catch {}
}

function isMachO(filePath) {
  try {
    const fd = fs.openSync(filePath, "r");
    const buf = Buffer.alloc(4);
    fs.readSync(fd, buf, 0, 4, 0);
    fs.closeSync(fd);
    const magics = new Set([
      0xfeedface, 0xcefaedfe, 0xfeedfacf, 0xcffaedfe, 0xcafebabe, 0xbebafeca,
    ]);
    return magics.has(buf.readUInt32BE(0));
  } catch {
    return false;
  }
}

function collectSignTargets(appPath) {
  const targets = [];
  function walk(dir) {
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      let stat;
      try {
        stat = fs.lstatSync(full);
      } catch {
        continue;
      }
      if (stat.isSymbolicLink()) continue;
      if (stat.isDirectory()) {
        if (entry.name.endsWith(".app") || entry.name.endsWith(".framework") || entry.name.endsWith(".xpc")) {
          walk(full);
          targets.push(full);
        } else {
          walk(full);
        }
      } else if (stat.isFile()) {
        const base = entry.name;
        if (
          base.endsWith(".dylib")
          || base.endsWith(".so")
          || base.endsWith(".node")
          || base === "Electron Framework"
          || base === "Electron Helper"
          || base === "Electron Helper (GPU)"
          || base === "Electron Helper (Plugin)"
          || base === "Electron Helper (Renderer)"
          || base === "Electron"
          || base === "Apexline"
          || base.endsWith(" Helper")
          || base.endsWith(" Helper (GPU)")
          || base.endsWith(" Helper (Plugin)")
          || base.endsWith(" Helper (Renderer)")
          || isMachO(full)
        ) {
          targets.push(full);
        }
      }
    }
  }
  walk(appPath);
  // Depth-first: deepest paths first so nested code is signed before containers.
  targets.sort((a, b) => b.split(path.sep).length - a.split(path.sep).length || b.length - a.length);
  // Always sign the outer app last.
  return [...targets.filter((item) => item !== appPath), appPath];
}

function codesignPath(identity, targetPath, { entitlements, deep = false } = {}) {
  const args = ["--force", "--sign", identity, "--timestamp", "--options", "runtime"];
  if (deep) args.push("--deep");
  if (entitlements && fs.existsSync(entitlements)) {
    args.push("--entitlements", entitlements);
  }
  args.push(targetPath);
  execFileSync("codesign", args, { stdio: "inherit" });
}

function signWithDeveloperId(appPath, identity) {
  ensure(fs.existsSync(entitlementsPath), `Missing entitlements at ${path.relative(root, entitlementsPath)}`);
  console.log(`Developer ID codesign with identity: ${identity}`);
  const targets = collectSignTargets(appPath);
  for (const target of targets) {
    const isBundle = /\.(app|framework|xpc)$/i.test(target) || target === appPath;
    codesignPath(identity, target, {
      entitlements: entitlementsPath,
      deep: false,
    });
    if (!isBundle && process.env.APEXLINE_CODESIGN_VERBOSE) {
      console.log(`  signed ${path.relative(appPath, target)}`);
    }
  }
  execFileSync("codesign", ["--verify", "--deep", "--strict", "--verbose=2", appPath], { stdio: "inherit" });
  console.log("codesign verify: OK");
}

function materializeApiKeyPath() {
  if (process.env.APPLE_API_KEY_PATH && fs.existsSync(process.env.APPLE_API_KEY_PATH)) {
    return { path: process.env.APPLE_API_KEY_PATH, cleanup: null };
  }
  const b64 = String(process.env.APPLE_API_KEY_P8_BASE64 || "").trim();
  if (!b64) return null;
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "apexline-notary-"));
  const keyPath = path.join(tmpDir, `AuthKey_${process.env.APPLE_API_KEY || "key"}.p8`);
  fs.writeFileSync(keyPath, Buffer.from(b64, "base64"));
  fs.chmodSync(keyPath, 0o600);
  return { path: keyPath, cleanup: () => fs.rmSync(tmpDir, { recursive: true, force: true }) };
}

function notarizeAndStaple(appPath) {
  const keyId = String(process.env.APPLE_API_KEY || "").trim();
  const issuer = String(process.env.APPLE_API_ISSUER || "").trim();
  ensure(keyId && issuer, "Notarization requires APPLE_API_KEY and APPLE_API_ISSUER.");
  const keyMaterial = materializeApiKeyPath();
  ensure(keyMaterial, "Notarization requires APPLE_API_KEY_PATH or APPLE_API_KEY_P8_BASE64.");

  const zipPath = path.join(outRoot, `Apexline-notarize-${process.pid}.zip`);
  try {
    fs.rmSync(zipPath, { force: true });
    console.log("Creating notarization zip…");
    execFileSync("ditto", ["-c", "-k", "--sequesterRsrc", "--keepParent", appPath, zipPath], { stdio: "inherit" });
    console.log("Submitting to Apple notary service (this can take several minutes)…");
    execFileSync("xcrun", [
      "notarytool", "submit", zipPath,
      "--key", keyMaterial.path,
      "--key-id", keyId,
      "--issuer", issuer,
      "--wait",
    ], { stdio: "inherit" });
    console.log("Stapling notarization ticket…");
    execFileSync("xcrun", ["stapler", "staple", appPath], { stdio: "inherit" });
    execFileSync("xcrun", ["stapler", "validate", appPath], { stdio: "inherit" });
    console.log("Notarization + staple: OK");
  } finally {
    fs.rmSync(zipPath, { force: true });
    if (keyMaterial?.cleanup) keyMaterial.cleanup();
  }
}

function adHocSign(appPath) {
  try {
    execFileSync("codesign", ["--force", "--deep", "--sign", "-", "--timestamp=none", appPath], { stdio: "ignore" });
    execFileSync("codesign", ["--verify", "--deep", appPath], { stdio: "ignore" });
  } catch {
    console.warn("Warning: ad-hoc codesign failed; the app bundle was still created.");
  }
}

// --- build ---

ensure(fs.existsSync(electronApp), "Electron runtime is not installed. Run /opt/homebrew/bin/npm install first.");
ensure(fs.existsSync(path.join(root, "dist/pitwall/index.html")), "Renderer is not built. Run /opt/homebrew/bin/npm run build first.");

fs.mkdirSync(outRoot, { recursive: true });
const stamp = buildStamp();
const appPath = baseOut;
const snapshotPath = path.join(outRoot, `Apexline-${stamp}.app`);
fs.rmSync(appPath, { recursive: true, force: true });
copyEntry(electronApp, appPath);
repairMacFrameworkSymlinks(appPath);

const resources = path.join(appPath, "Contents/Resources");
const appDir = path.join(resources, "app");
fs.mkdirSync(appDir, { recursive: true });
copyEntry(appIcon, path.join(resources, "app-icon.icns"));

for (const entry of ["electron", "ui_kits", "tokens", "assets"]) {
  copyEntry(path.join(root, entry), path.join(appDir, entry));
}
fs.mkdirSync(path.join(appDir, "dist"), { recursive: true });
copyEntry(path.join(root, "dist/pitwall"), path.join(appDir, "dist/pitwall"));
for (const entry of ["styles.css", "_ds_bundle.js"]) {
  copyEntry(path.join(root, entry), path.join(appDir, entry));
}

fs.mkdirSync(path.join(appDir, "node_modules"), { recursive: true });
for (const packageName of ["react", "react-dom", "hls.js", "shaka-player"]) {
  copyEntry(path.join(root, "node_modules", packageName), path.join(appDir, "node_modules", packageName));
}

fs.writeFileSync(path.join(appDir, "package.json"), JSON.stringify({
  name: "apexline",
  version: appVersion,
  private: true,
  main: "electron/main.cjs",
  apexline: {
    updateBaseUrl,
    bundleId,
  },
  pitwall: {
    updateBaseUrl,
  },
}, null, 2));

const plist = path.join(appPath, "Contents/Info.plist");
plistSet(plist, "CFBundleDisplayName", "Apexline");
plistSet(plist, "CFBundleName", "Apexline");
plistSet(plist, "CFBundleIdentifier", bundleId);
plistSet(plist, "CFBundleIconFile", "app-icon");
plistSet(plist, "CFBundleShortVersionString", appVersion);
plistSet(plist, "CFBundleVersion", appVersion);
plistSet(plist, "LSApplicationCategoryType", "public.app-category.sports");
plistDelete(plist, "ElectronAsarIntegrity");

signWithCastLabsVmp(appPath);

const identity = resolveSigningIdentity();
const wantDeveloperId = Boolean(identity) || envFlag("APEXLINE_CODESIGN");
let keychainSession = null;

try {
  if (wantDeveloperId) {
    ensure(identity, "Set APPLE_SIGNING_IDENTITY or APPLE_CERTIFICATE for Developer ID signing.");
    keychainSession = importCertificateKeychain();
    signWithDeveloperId(appPath, identity);
    if (notarizeRequested()) {
      notarizeAndStaple(appPath);
    } else {
      console.log("Skipping notarization (set APEXLINE_NOTARIZE=1 or provide APPLE_API_* to enable).");
    }
  } else {
    adHocSign(appPath);
  }
} finally {
  cleanupCertificateKeychain(keychainSession);
}

const size = execFileSync("du", ["-sh", appPath], { encoding: "utf8" }).trim().split(/\s+/)[0];
fs.rmSync(snapshotPath, { recursive: true, force: true });
copyEntry(appPath, snapshotPath);
console.log(`Built ${appPath}`);
console.log(`Snapshot ${snapshotPath}`);
console.log(`Size ${size}`);
console.log(`Bundle ID ${bundleId}`);
console.log(`Signing ${wantDeveloperId ? `Developer ID (${identity})` : "ad-hoc"}`);
