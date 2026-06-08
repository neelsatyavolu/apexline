const { execFileSync } = require("node:child_process");
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

ensure(version, "package.json version is required.");
ensure(/^https:\/\//i.test(baseUrl), "Set package.json apexline.updateBaseUrl or APEXLINE_UPDATE_BASE_URL to an HTTPS Vercel URL.");
ensure(fs.existsSync(appPath), "Missing dist/Apexline.app. Run /opt/homebrew/bin/npm run package:mac first.");

fs.mkdirSync(outDir, { recursive: true });
fs.rmSync(zipPath, { force: true });
execFileSync("ditto", ["-c", "-k", "--sequesterRsrc", "--keepParent", appPath, zipPath], { stdio: "inherit" });

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

console.log(`Wrote ${path.relative(root, zipPath)}`);
console.log(`Wrote ${path.relative(root, feedPath)}`);
