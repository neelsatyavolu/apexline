const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const electronApp = path.join(root, "node_modules/electron/dist/Electron.app");
const appIcon = path.join(root, "assets/app-icon.icns");
const outRoot = path.join(root, "dist");
const baseOut = path.join(outRoot, "Apexline.app");
const rootPackage = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
const appVersion = String(rootPackage.version || "0.0.0");
const updateBaseUrl = String(process.env.APEXLINE_UPDATE_BASE_URL || process.env.PITWALL_UPDATE_BASE_URL || rootPackage.apexline?.updateBaseUrl || rootPackage.pitwall?.updateBaseUrl || "").replace(/\/+$/, "");

function ensure(condition, message) {
  if (!condition) throw new Error(message);
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
  },
  pitwall: {
    updateBaseUrl,
  },
}, null, 2));

const plist = path.join(appPath, "Contents/Info.plist");
plistSet(plist, "CFBundleDisplayName", "Apexline");
plistSet(plist, "CFBundleName", "Apexline");
plistSet(plist, "CFBundleIdentifier", "app.apexline.local");
plistSet(plist, "CFBundleIconFile", "app-icon");
plistSet(plist, "CFBundleShortVersionString", appVersion);
plistSet(plist, "CFBundleVersion", appVersion);
plistSet(plist, "LSApplicationCategoryType", "public.app-category.sports");
plistDelete(plist, "ElectronAsarIntegrity");

signWithCastLabsVmp(appPath);

try {
  execFileSync("codesign", ["--force", "--deep", "--sign", "-", "--timestamp=none", appPath], { stdio: "ignore" });
  execFileSync("codesign", ["--verify", "--deep", appPath], { stdio: "ignore" });
} catch (error) {
  console.warn("Warning: ad-hoc codesign failed; the app bundle was still created.");
}

const size = execFileSync("du", ["-sh", appPath], { encoding: "utf8" }).trim().split(/\s+/)[0];
fs.rmSync(snapshotPath, { recursive: true, force: true });
copyEntry(appPath, snapshotPath);
console.log(`Built ${appPath}`);
console.log(`Snapshot ${snapshotPath}`);
console.log(`Size ${size}`);
