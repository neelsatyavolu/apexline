const { execFileSync } = require("node:child_process");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const packageJson = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
const version = String(packageJson.version || "").trim();
const baseUrl = String(process.env.APEXLINE_UPDATE_BASE_URL || process.env.PITWALL_UPDATE_BASE_URL || packageJson.apexline?.updateBaseUrl || packageJson.pitwall?.updateBaseUrl || "").replace(/\/+$/, "");
const arch = process.env.PITWALL_UPDATE_ARCH || process.arch;
const appPath = path.join(root, "dist/Apexline.app");
const outDir = path.join(root, "updates-site/public/updates/darwin", arch);
const zipName = `Apexline-${version}-mac-${arch}.zip`;
const zipPath = path.join(outDir, zipName);
const feedPath = path.join(outDir, "releases.json");

function ensure(condition, message) {
  if (!condition) throw new Error(message);
}

function resolveByteCeiling(environment, name, defaultBytes) {
  const raw = String(environment?.[name] || "").trim();
  const value = raw ? Number(raw) : defaultBytes;
  if (!/^[1-9]\d*$/.test(raw || String(defaultBytes)) || !Number.isSafeInteger(value)) {
    throw new Error(`${name} must be a positive safe integer byte count.`);
  }
  return value;
}

function assertArtifactSize(actualBytes, maxBytes, label) {
  if (!Number.isSafeInteger(actualBytes) || actualBytes < 0) {
    throw new Error(`${label} size must be a non-negative safe integer.`);
  }
  if (actualBytes > maxBytes) {
    throw new Error(`${label} is too large (${actualBytes} bytes; maximum ${maxBytes} bytes).`);
  }
  return actualBytes;
}

function createValidatedUpdateZip(
  sourceAppPath,
  finalZipPath,
  maxBytes,
  compress = (source, target) => execFileSync("ditto", ["-c", "-k", "--sequesterRsrc", "--keepParent", source, target], { stdio: "inherit" }),
) {
  const temporaryPath = path.join(
    path.dirname(finalZipPath),
    `.${path.basename(finalZipPath)}.${process.pid}-${crypto.randomUUID()}.tmp`,
  );
  ensure(!fs.existsSync(temporaryPath), `Refusing to overwrite temporary update zip ${temporaryPath}.`);
  try {
    compress(sourceAppPath, temporaryPath);
    const zipStat = fs.statSync(temporaryPath);
    ensure(zipStat.isFile(), "Update zip staging output is not a file.");
    ensure(zipStat.size > 1024 * 1024, `Update zip is too small (${zipStat.size} bytes); expected a real app archive.`);
    assertArtifactSize(zipStat.size, maxBytes, "Update zip");

    const zipHead = Buffer.alloc(Math.min(80, zipStat.size));
    const zipFd = fs.openSync(temporaryPath, "r");
    let bytesRead = 0;
    try {
      bytesRead = fs.readSync(zipFd, zipHead, 0, zipHead.length, 0);
    } finally {
      fs.closeSync(zipFd);
    }
    ensure(bytesRead >= 2 && zipHead[0] === 0x50 && zipHead[1] === 0x4b, "Update zip is not a PKZip archive (refusing to publish LFS pointer/HTML).");
    ensure(!zipHead.subarray(0, bytesRead).toString("utf8").startsWith("version https://git-lfs.github.com/"), "Update zip looks like a Git LFS pointer; run git lfs pull before release:update-feed/deploy.");

    fs.renameSync(temporaryPath, finalZipPath);
    return zipStat;
  } finally {
    fs.rmSync(temporaryPath, { force: true });
  }
}

function replaceLandingPageVersion(html, nextVersion) {
  return String(html)
    .replace(
      /\/updates\/darwin\/arm64\/Apexline-[0-9A-Za-z.+-]+-mac-arm64\.zip/g,
      `/updates/darwin/arm64/Apexline-${nextVersion}-mac-arm64.zip`,
    )
    .replace(/(Version\s+)[0-9A-Za-z.+-]+/g, `$1${nextVersion}`)
    .replace(/(\bv)[0-9A-Za-z.+-]+(?=\s*·)/g, `$1${nextVersion}`)
    .replace(
      /(<span class="rk">Version<\/span><span class="rv">)[^<]+(<\/span>)/g,
      `$1${nextVersion}$2`,
    )
    .replace(/(<dt>Version<\/dt><dd>)[^<]+(<\/dd>)/g, `$1${nextVersion}$2`);
}

const maxUpdateZipBytes = resolveByteCeiling(process.env, "APEXLINE_MAX_UPDATE_ZIP_BYTES", 150 * 1024 * 1024);
ensure(version, "package.json version is required.");
ensure(/^https:\/\//i.test(baseUrl), "Set package.json apexline.updateBaseUrl or APEXLINE_UPDATE_BASE_URL to an HTTPS Vercel URL.");
ensure(fs.existsSync(appPath), "Missing dist/Apexline.app. Run /opt/homebrew/bin/npm run package:mac first.");

fs.mkdirSync(outDir, { recursive: true });
const zipStat = createValidatedUpdateZip(appPath, zipPath, maxUpdateZipBytes);

const now = new Date().toISOString();
const release = {
  version,
  updateTo: {
    version,
    pub_date: now,
    notes: process.env.APEXLINE_RELEASE_NOTES || process.env.PITWALL_RELEASE_NOTES || `Apexline ${version}`,
    name: `Apexline ${version}`,
    url: `${baseUrl}/updates/darwin/${arch}/${zipName}`,
  },
};

fs.writeFileSync(feedPath, JSON.stringify({
  currentRelease: version,
  releases: [release],
}, null, 2) + "\n");

const landingPagePath = path.join(root, "updates-site/public/index.html");
const landingPage = fs.readFileSync(landingPagePath, "utf8");
fs.writeFileSync(landingPagePath, replaceLandingPageVersion(landingPage, version));

console.log(`Wrote ${path.relative(root, zipPath)} (${(zipStat.size / (1024 * 1024)).toFixed(1)} MB)`);
console.log(`Wrote ${path.relative(root, feedPath)}`);
console.log(`Updated ${path.relative(root, landingPagePath)}`);
console.log("Reminder: Vercel must receive the real zip bytes (not a Git LFS pointer). Deploy from a working tree after git lfs pull, or exclude *.zip from LFS for this path.");
