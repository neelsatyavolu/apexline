# agmux Session Handoffs

> Optional prior-session context for agents. Use only when you need history — not every turn.
> Prefer MCP tools `session_list` / `session_get` on server `agmux-memory`. This file is the projection.
> Each entry has a short summary and a transcript path you can Read for detail.

- **Project**: `bd6d9764-c0c6-4c06-8851-99d30b827ded`
- **Revision**: 2
- **Updated**: 2026-08-12T16:37:43.000Z
- **Sessions**: 6

## Grok 4.6 replaces 4.5

- **id**: `3be9b878-b687-4672-8d2f-fe760f58f07b`
- **provider**: Grok
- **status**: idle
- **updated**: 2026-08-12T16:37:43.000Z
- **transcript**: `/Users/neel/.grok/sessions/%2FUsers%2Fneel%2FDocuments%2FGitHub%2Fapexline/019ff6d3-67a3-7853-995f-e83b3859979a/chat_history.jsonl`

Replaced Grok 4.5 with Grok 4.6 as the only/default xAI model (API id grok-4.6). Updated GROK_MODELS + DEFAULT_GROK_MODEL + high reasoning effort in electron/main.cjs, Settings.jsx option, and smoke tests. Saved grok:grok-4.5 preferences migrate to grok-4.6 so existing Grok users are not dropped back to Codex. Verified: node --check, pitwall-ai-oauth-smoke-test, npm test, npm run build.

## Production VMP build install

- **id**: `c02bf669-e18c-4156-abd2-b42238583105`
- **provider**: Grok
- **status**: idle
- **updated**: 2026-07-24T05:58:37.000Z
- **transcript**: `/Users/neel/.grok/sessions/%2FUsers%2Fneel%2FDocuments%2FGitHub%2Fapexline/019f91f5-76a5-7cc0-b30c-180ad69ee4a2/chat_history.jsonl`

Rebuilt package:mac:vmp (1.1.8) and replaced /Applications/Apexline.app again. VMP streaming signature valid (~1455 days), ad-hoc codesign, bundle io.apexline.app, ~260MB. Used .venv-evs for castlabs_evs.

## News tab blank screen fix

- **id**: `2c0ac305-340d-4e49-9d15-7f479914b4d3`
- **provider**: Grok
- **status**: idle
- **updated**: 2026-07-24T02:45:31.000Z
- **transcript**: `/Users/neel/.grok/sessions/%2FUsers%2Fneel%2FDocuments%2FGitHub%2Fapexline/019f91f8-1dde-7f70-8990-e79f555c4d02/chat_history.jsonl`

Fixed blank News tab: _ds_bundle.js stamped a stale window.PW.News that captured undefined PW_DATA at eval time; the new lazy loader short-circuited on that stub and never loaded real News.js. Cleared stale screen stubs, track loaded screens with a Set, always load real dist/pitwall scripts. Hardened deriveNewsStories against null items. Smoke tests + Electron probe green.

## Safe performance fixes excluding audit #3

- **id**: `da86a09e-a278-4a10-b86a-691c8bf0e1d1`
- **provider**: unknown
- **status**: idle
- **updated**: 2026-07-24T02:23:37.517Z
- **transcript**: _(none resolved)_

Implemented and verified all scoped safe performance/data-loading fixes from the 2026-07-23 audit except finding #3 by user request. Added cached-first startup, lazy production renderer resources, live-timing recovery and analytics/data correctness fixes, bounded replay/news/F1TV/media/cache work, Track Map/Settings/News efficiency, minimal package runtime allowlist, opt-in snapshots, artifact size guards, atomic validated update zip publication, and landing screenshot prioritization. Added regression budgets/fixtures and updated docs/performance-audit-2026-07-23.md plus implementation plan. Fresh npm test, npm run build, node syntax checks, and git diff --check passed. No package/sign/notarize run, no artifacts deleted, no commit. Explicitly deferred Live Racing top-level 250ms render refactor (#3), streaming transport redesign, destructive historical artifact cleanup, and AVIF/WebP conversion. Preserved pre-existing live-timing/release-script changes and untracked probe.

## Live timing mid-session break fix

- **id**: `e67ddfcc-d05e-4af6-b287-573257d187ab`
- **provider**: Grok
- **status**: idle
- **updated**: 2026-07-18T14:57:42.000Z
- **transcript**: `/Users/neel/.grok/sessions/%2FUsers%2Fneel%2FDocuments%2FGitHub%2Fapexline/019f7597-3b7c-7281-a43d-18bdbac035e8/chat_history.jsonl`

Fixed live timing jumping ~3s ahead at Q2→Q3: stream alignment now peak-holds measured feed latency (slow decay 0.2s/min) instead of dropping to 4.6s floor when latency samples refresh. Manual Resync clears the peak. Also preserve videoTimeAtMs in sync metrics for playhead extrapolation.

## Apexline 1.1.8 signed notarized release

- **id**: `30504556-b079-44a5-978f-9013b9e70706`
- **provider**: Grok
- **status**: idle
- **updated**: 2026-07-16T06:01:00.000Z
- **transcript**: `/Users/neel/.grok/sessions/%2FUsers%2Fneel%2FDocuments%2FGitHub%2Fapexline/019f6968-71ea-7ea0-81bd-257fa78d24d5/chat_history.jsonl`

Shipped Apexline 1.1.8 with Developer ID + notarization.

Root cause of errSecInternalComponent: stale temp keychains on search list + missing Developer ID G2 intermediate on login keychain. Fixed load-apple-creds.sh to match Strix/APPLE_SIGNING: CAs first, G2 into login+temp, partition-list with keychain pass, smoke codesign, cleanup forces login-only. Updated APPLE_SIGNING.md with electron-builder/Strix lessons and G2-on-login fix.

Release: VMP → Developer ID → notary Accepted → staple → update feed. Deployed apexline.io. Public feed 200 JSON currentRelease 1.1.8; zip 200 ~135MB. Gatekeeper: accepted source=Notarized Developer ID.
