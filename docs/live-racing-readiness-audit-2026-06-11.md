# Live Racing Readiness Audit - 2026-06-11

## Verdict

Live Racing is not ready to promise general users that they can reliably watch live sessions yet.

It is close for authenticated, meeting-key-backed F1 TV session loading: this workspace can authenticate, initialize Widevine, resolve a known 2026 F1 TV replay by OpenF1 meeting key, discover world/onboard feeds, and fetch the HLS manifest through the scoped media bridge. The missing release gate is end-to-end proof that a packaged user build can acquire a production Widevine license and play actual video during a live event.

## Scope And Assumptions

- Audited the current dirty workspace at `/Users/neel/f1hub`.
- Follow-up fix changed `scripts/pitwall-smoke-test.cjs` only.
- Current date: 2026-06-11.
- The 2026 F1 TV library diagnostic reported no currently live session; Barcelona was the next upcoming weekend.

## Findings

### P0 - End-to-end live playback is not verified

Evidence:
- Auth probe passed: playback token ready, F1 TV browser session present, Widevine component initialized.
- Meeting-key resolver/media diagnostic passed for `2026 Monaco Grand Prix / Race / meetingKey=1286`: `27` feeds, world feed plus onboards, HLS manifest fetch returned `200`.
- The diagnostic only fetched a manifest. It did not prove Shaka/Widevine license acquisition or video decode.
- `ui_kits/pitwall/LiveRacing.jsx:1824-1827` explicitly expects production Widevine rejection for builds that are not VMP-signed.
- `scripts/package-macos.cjs:73-86` supports CastLabs VMP signing, but the local EVS verifier is not installed, so I could not verify the published zip.

Release gate:
- Run a VMP-signed packaged app against an active live F1 TV session.
- Verify world feed reaches `playing`, license requests succeed, audio works, and at least several onboard feeds play.
- Soak for 30+ minutes and test reconnect/token refresh behavior.

### Resolved - Main smoke test harness was broken

The original audit found `/opt/homebrew/bin/npm test` failing before completion:

```text
SyntaxError: Unexpected token 'function'
scripts/pitwall-smoke-test.cjs:1969
```

Cause: `extractNamedFunction` starts scanning at the first `{`, which breaks on `function clampCustomTileGeometry(rect = {})` in `ui_kits/pitwall/LiveRacing.jsx:1173`.

Follow-up fix: `extractNamedFunction` now scans past the full function parameter list before finding the body. The custom-layout VM assertions also clone returned values before deep equality checks, avoiding cross-realm object prototype failures.

Current result: `/opt/homebrew/bin/npm test` passes.

### P1 - F1 TV resolver is meeting-key dependent

The resolver failed without a meeting key for Monaco Race: it selected historical archive content IDs and found `0` playable feeds. With `meetingKey=1286`, the same session resolved successfully.

Relevant paths:
- `ui_kits/pitwall/LiveRacing.jsx:3384-3390` passes meeting key when the library has one.
- `electron/main.cjs:6643-6649` falls back to broad search when meeting key is absent.
- `electron/main.cjs:6302-6368` scores page candidates by DOM text.

Research update: OpenF1 documents `meeting_key` as a first-class field on both meeting and session rows, and documents that sessions are refreshed daily at midnight UTC. A live API check for `https://api.openf1.org/v1/meetings?year=2026&country_name=Singapore` returned `meeting_key: 1296` for a future 2026 weekend.

Revised risk: OpenF1 meeting keys look reliable enough for the normal scheduled-weekend path. The remaining risk is F1 TV search/content availability: a session can have OpenF1 metadata before F1 TV exposes a matching detail page, or the F1 TV private search result can rank the wrong archive when no meeting key is available. Keep exact-detail-URL diagnostics/fallbacks for that case.

### P1 - Published-package readiness is inconclusive

The public update feed points to `Apexline-1.0.9-mac-arm64.zip`. The extracted app is macOS ad-hoc signed and Gatekeeper rejects it, which matches the project’s manual-download model. However, I could not verify CastLabs VMP because `castlabs_evs` is missing locally.

Command result:

```text
ModuleNotFoundError: No module named 'castlabs_evs'
```

For F1 TV users, release artifacts should include stored evidence from `castlabs_evs.vmp verify-pkg`.

### P2 - Live timing is gated by stream readiness

`ui_kits/pitwall/LiveRacing.jsx:3692` defines `liveWorkspaceReady` from a world stream descriptor, and `ui_kits/pitwall/LiveRacing.jsx:3735-3771` clears live timing unless that is true. The main render also replaces the body with the session library when no stream is loaded.

Risk: if video resolution fails, users also lose the live timing workspace even when Formula 1 live timing or OpenF1 timing is available.

### P2 - Renderer can access Keychain secrets

`electron/preload.cjs:47-50` exposes generic key get/set/delete, and `electron/main.cjs:87` includes `f1tv-token` in allowed providers. A renderer compromise would be able to request the token.

The app avoids logging token values in the inspected paths, but the IPC boundary is broader than it needs to be for user-facing live playback.

### P2 - The normal resolver depends on private F1 TV API shapes

`electron/main.cjs:6121-6158` builds private CONTENT/PLAY, feature-steering, and license endpoint URLs. This worked in the meeting-key diagnostic, but it is brittle and should be treated as an operational risk.

## Verification Run

Passed:
- `/opt/homebrew/bin/node --check electron/main.cjs`
- `/opt/homebrew/bin/node --check electron/preload.cjs`
- `PATH=/opt/homebrew/bin:$PATH /opt/homebrew/bin/npm run build`
- Escalated `npm run probe:live-layout`: passed across desktop/laptop viewports
- Escalated F1 TV auth probe: authenticated, playback token ready, Widevine initialized
- Escalated 2026 F1 TV library diagnostic: OpenF1 source, no errors
- Escalated meeting-key F1 TV resolver/media diagnostic: 27 feeds, manifest fetch OK
- `PATH=/opt/homebrew/bin:$PATH /opt/homebrew/bin/npm test`

Failed or blocked:
- Sandbox Live Racing layout probe: Electron aborted; escalated run passed
- VMP verification of published zip: blocked because `castlabs_evs` is not installed
- Actual live-event video playback: blocked because no live session was available in the diagnostic library snapshot

## Recommendation

Do not market Live Racing as generally ready for users to watch live sessions yet.

A defensible beta label would be: "F1 TV session loading works for authenticated users when OpenF1 meeting metadata is available; live playback still needs VMP-signed packaged-build validation during an active event."

Minimum before calling it ready:

1. Produce a VMP-signed package and archive the EVS verify output.
2. Add a real F1 TV diagnostic that proves license acquisition/video `playing`, not just manifest fetch.
3. Run that diagnostic during an active live session and against one replay.
4. Add graceful UI fallback for F1 TV search misses and keep live timing usable when video resolution fails.
5. Narrow the renderer Keychain IPC so F1 TV tokens cannot be read directly from the renderer.
