# Apexline Update Feed

This folder is the public Vercel project for Apexline update metadata and zipped
macOS builds. It can be deployed without publishing the private app source.

Release flow:

1. Set `apexline.updateBaseUrl` in the root `package.json` to the production
   Vercel domain for this project, or export `APEXLINE_UPDATE_BASE_URL`.
2. Run `/opt/homebrew/bin/npm run package:mac`.
3. Run `/opt/homebrew/bin/npm run release:update-feed`.
4. Deploy this folder to Vercel.

The app checks:

`/updates/darwin/arm64/releases.json`

Production domain:

`https://apexline-app.vercel.app`

Without Apple Developer ID signing, Apexline opens the hosted zip download for
manual replacement instead of doing a silent install-and-restart update.
