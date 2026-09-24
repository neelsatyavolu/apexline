# Apexline Update Feed

This folder is the public Vercel project for Apexline update metadata and zipped
macOS builds. It also hosts the website and the serverless APIs in `api/` (OpenF1 proxy and watch-party social backend).

Release flow:

1. Bump `version` in the root `package.json`, commit and push to `main`.
2. Run `./scripts/release-macos.sh`. It builds, signs and notarizes the app,
   writes the zip and `releases.json`, and publishes the zip as the GitHub
   Release `v<version>`.
3. Commit and push `updates-site/public` (the feed and landing page). Vercel
   deploys `main` automatically.

Zips are not committed. `vercel.json` redirects
`/updates/darwin/arm64/Apexline-<version>-mac-arm64.zip` to the matching
GitHub Release asset, so download and update URLs never change.

The app checks:

`/updates/darwin/arm64/releases.json`

Production domain:

`https://apexline.io`

Without Apple Developer ID signing, Apexline opens the hosted zip download for
manual replacement instead of doing a silent install-and-restart update.
