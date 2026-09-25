# Apexline Agent Guide

## Shared Codex/Grok integration

Use [shared-ai-auth](https://github.com/neelsatyavolu/shared-ai-auth) for OAuth protocol helpers and the live `models.json` catalog. Apexline keeps its localhost callback listener and Keychain entries. The optional project blacklist is `HIDDEN_MODELS` in `electron/main.cjs`; new models show by default. Keep token and callback values out of logs.

Apexline is an Electron macOS F1 companion app. The renderer is React in
`ui_kits/pitwall`, the Electron main process is `electron/main.cjs`, and the
renderer bridge is `electron/preload.cjs`. Build, package, and smoke-test
helpers live in `scripts`.

## Open Source Safety

This repository is public (MIT, open source). Everything committed, including
history, PR text, and release notes, is visible to anyone. Never commit
secrets, `.env` files, tokens, cookies, signing or notarization credentials,
personal paths, or local tool state (`.claude/`, `.agmux/`, `.grok/`,
`.vercel/`). Check `git diff --cached` before every commit.

## Working Rules

- Prefer small, surgical changes. Match the existing CommonJS and browser-global
  React style instead of introducing a bundler or new framework.
- Use `rg` and short file reads for exploration. Use `apply_patch` for manual
  edits.
- Do not edit generated packaged apps under `dist/*.app`; change source files
  and rebuild/package instead.
- Keep secrets out of logs and UI. Never print F1 TV tokens, cookies, API keys,
  manifest URLs, license URLs, or raw auth headers.
- If a task touches runtime behavior, update `scripts/pitwall-smoke-test.cjs`
  when a stable assertion can prevent regressions.

## Common Commands

- Build renderer: `/opt/homebrew/bin/npm run build`
- Run smoke checks: `/opt/homebrew/bin/npm test`
- Package macOS app (ad-hoc sign): `/opt/homebrew/bin/npm run package:mac`
- Package with CastLabs VMP (ad-hoc codesign): `/opt/homebrew/bin/npm run package:mac:vmp`
- Official signed + notarized release build + update feed:
  `/opt/homebrew/bin/npm run release:mac`
- Launch dev app: `/opt/homebrew/bin/npm run dev`

## Public Site and Updates

- Public landing/download/update site: `https://apexline.io`.
  Use the Apexline alias for app update checks after confirming the feed
  returns public JSON.
- The static Vercel project lives in `updates-site`. It hosts the landing page,
  design tokens/assets, macOS update feed, and downloadable app zips.
- The app's packaged update base URL is `package.json` →
  `apexline.updateBaseUrl`. Keep it aligned with the public Vercel site before
  packaging. The legacy `pitwall.updateBaseUrl` key is still read for older
  packaged builds.
- Production bundle ID: `io.apexline.app` (`package.json` → `apexline.bundleId`).
- Current update feed path:
  `updates-site/public/updates/darwin/arm64/releases.json`.
- Current macOS artifact path pattern:
  `updates-site/public/updates/darwin/arm64/Apexline-<version>-mac-arm64.zip`.
- **Official release flow** (Developer ID + notarize + feed):
  1. Bump `package.json` version.
  2. Ensure 1Password CLI is signed in (`op signin`) with the shared items
     documented in `~/Documents/GitHub/APPLE_SIGNING.md`
     (Developer ID p12 + App Store Connect API key).
  3. Run `/opt/homebrew/bin/npm run release:mac`
     (`scripts/release-macos.sh`: CastLabs VMP → Developer ID codesign →
     notarize + staple → `release:update-feed`).
  4. Deploy: `/usr/bin/env CI=1 /opt/homebrew/bin/vercel deploy updates-site --prod -y`.
  5. Confirm `/updates/darwin/arm64/releases.json` returns public
     `200 application/json` without Vercel authentication.
- Sign-only (no notary upload): `./scripts/release-macos.sh --no-notarize`
- Local unsigned/ad-hoc packages remain available via `package:mac` /
  `package:mac:vmp` for day-to-day work.
- Updates stay manual-download: the app checks the public feed and opens the
  hosted zip (no silent install/restart). Signed+notarized zips still avoid
  Gatekeeper “unidentified developer” friction for end users.
- Do not embed Vercel, GitHub, or Apple secrets in the app. Creds load only via
  1Password / env for packaging. Feed and zip URLs must be public static HTTPS.

## Apple signing notes

- Shared credentials doc: `~/Documents/GitHub/APPLE_SIGNING.md`
- Loader: `scripts/load-apple-creds.sh` (sources agmux’s canonical loader)
- Entitlements: `build/entitlements.mac.plist` (hardened runtime for Electron)
- Env consumed by `scripts/package-macos.cjs`:
  - `APPLE_CERTIFICATE` + `APPLE_CERTIFICATE_PASSWORD` (base64 p12)
  - `APPLE_SIGNING_IDENTITY` / `APEXLINE_CODESIGN=1`
  - `APEXLINE_NOTARIZE=1` + `APPLE_API_KEY` / `APPLE_API_ISSUER` /
    `APPLE_API_KEY_PATH` (or `APPLE_API_KEY_P8_BASE64`)
- Order: CastLabs VMP first, then Apple codesign, then notarize/staple.

## Architecture Notes

- `DataProvider.jsx` is the renderer's app-data boundary. Prefer routing new
  live data through it rather than scattering fetches in individual screens.
- `LiveRacing.jsx` owns the clean F1 TV player UI, replay sync controls, layout
  presets, timing sidebar, and AI pane.
- `electron/main.cjs` owns F1 TV login/session discovery, Keychain secrets,
  F1-data snapshots, AI provider calls, notifications, and the scoped media
  proxy used by Shaka/HLS playback.
- `electron/preload.cjs` must expose only narrow, intentional IPC helpers.

## F1 TV, DRM, and Privacy

- Apexline may authenticate the user's F1 TV account, resolve content metadata,
  and play streams only through legitimate authenticated requests.
- Do not implement DRM bypasses, key extraction, license-response tampering,
  token scraping for persistence, or broad header spoofing.
- Clean protected playback uses CastLabs Electron, Shaka Player, HLS.js, and
  scoped main-process media fetching. Production F1 TV playback may require
  CastLabs EVS/Widevine VMP signing; do not promise unsigned builds can play
  protected F1 TV streams.
- Diagnostics browser flows must remain fallback/diagnostic tools, not the
  normal Live Racing playback path.

## UI Expectations

- Keep the dense, dark, F1-style dashboard language. Avoid placeholder mock data
  when a real data source is already wired.
- Preserve the MultiViewer-like goal for Live Racing: native Apexline controls,
  clean video panes, synchronized replay/live playback, and no visible F1 TV
  website chrome during normal playback.
- When adding visual details, verify that text and controls fit at the current
  desktop sizes used by the app.

## Verification Expectations

- For docs-only changes, inspect the edited file.
- For Live Racing features that surface live/replay data, verify with a real
  data check when possible: run or add a terminal probe against an actual F1
  livetiming/OpenF1/F1 TV replay source and confirm the new field appears in the
  parsed snapshot or UI-bound data. If network, credentials, or event
  availability prevent that, report the blocker and keep a stable smoke-test
  assertion instead.
- For renderer changes, run `/opt/homebrew/bin/npm test` and
  `/opt/homebrew/bin/npm run build`.
- For Electron main/preload or packaging changes, also run
  `node --check electron/main.cjs` and package when the user needs a testable app.
- Report any verification you could not run and why.

# context-mode — MANDATORY routing rules

You have context-mode MCP tools available. These rules are NOT optional — they protect your context window from flooding. A single unrouted command can dump 56 KB into context and waste the entire session.

## BLOCKED commands — do NOT attempt these

### curl / wget — BLOCKED
Any Bash command containing `curl` or `wget` is intercepted and replaced with an error message. Do NOT retry.
Instead use:
- `ctx_fetch_and_index(url, source)` to fetch and index web pages
- `ctx_execute(language: "javascript", code: "const r = await fetch(...)")` to run HTTP calls in sandbox

### Inline HTTP — BLOCKED
Any Bash command containing `fetch('http`, `requests.get(`, `requests.post(`, `http.get(`, or `http.request(` is intercepted and replaced with an error message. Do NOT retry with Bash.
Instead use:
- `ctx_execute(language, code)` to run HTTP calls in sandbox — only stdout enters context

### WebFetch — BLOCKED
WebFetch calls are denied entirely. The URL is extracted and you are told to use `ctx_fetch_and_index` instead.
Instead use:
- `ctx_fetch_and_index(url, source)` then `ctx_search(queries)` to query the indexed content

## REDIRECTED tools — use sandbox equivalents

### Bash (>20 lines output)
Bash is ONLY for: `git`, `mkdir`, `rm`, `mv`, `cd`, `ls`, `npm install`, `pip install`, and other short-output commands.
For everything else, use:
- `ctx_batch_execute(commands, queries)` — Primary tool. Runs all commands, auto-indexes output, returns search results. ONE call replaces 30+ individual calls.
- `ctx_execute(language: "shell", code: "...")` — Run in sandbox, only stdout enters context.

### Read (for analysis)
If you are reading a file to **Edit** it → Read is correct (Edit needs content in context).
If you are reading to **analyze, explore, or summarize** → use `ctx_execute_file(path, language, code)` instead. Only your printed summary enters context. The raw file content stays in the sandbox.

### Grep (large results)
Grep results can flood context. Use `ctx_execute(language: "shell", code: "grep ...")` to run searches in sandbox. Only your printed summary enters context.

## Tool selection hierarchy

1. **GATHER**: `ctx_batch_execute(commands, queries)` — Primary tool. Runs all commands, auto-indexes output, returns search results. ONE call replaces 30+ individual calls.
2. **FOLLOW-UP**: `ctx_search(queries: ["q1", "q2", ...])` — Query indexed content. Pass ALL questions as array in ONE call.
3. **PROCESSING**: `ctx_execute(language, code)` | `ctx_execute_file(path, language, code)` — Sandbox execution. Only stdout enters context.
4. **WEB**: `ctx_fetch_and_index(url, source)` then `ctx_search(queries)` — Fetch, chunk, index, query. Raw HTML never enters context.
5. **INDEX**: `ctx_index(content, source)` — Store content in FTS5 knowledge base for later search.

## Subagent routing

When spawning subagents (Agent/Task tool), the routing block is automatically injected into their prompt. Bash-type subagents are upgraded to general-purpose so they have access to MCP tools. You do NOT need to manually instruct subagents about context-mode.

## Output constraints

- Keep responses under 500 words.
- Write artifacts (code, configs, PRDs) to FILES — never return them as inline text. Return only: file path + 1-line description.
- When indexing content, use descriptive source labels so others can `ctx_search(source: "label")` later.

## ctx commands

| Command | Action |
|---------|--------|
| `ctx stats` | Call the `ctx_stats` MCP tool and display the full output verbatim |
| `ctx doctor` | Call the `ctx_doctor` MCP tool, run the returned shell command, display as checklist |
| `ctx upgrade` | Call the `ctx_upgrade` MCP tool, run the returned shell command, display as checklist |
