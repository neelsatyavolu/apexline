# PitWall — WKWebView F1 TV DRM Feasibility Spike (Design Spec)

**Date:** 2026-06-05
**Status:** Approved (design) — pending implementation plan
**Type:** Throwaway feasibility spike (sub-project 0 of the PitWall app)

---

## 1. Background & Context

PitWall is a planned native macOS SwiftUI companion app for serious F1 fans. The full
brief spans several independent subsystems (non-live content screens, a single-window
"Live Racing" multi-view engine, a hybrid AI layer, a data layer, settings/Keychain).
That brief is too large for one spec, so it is being **decomposed into dependency-ordered
sub-projects**, each designed → specced → planned → built one at a time.

### Decisions already made during brainstorming

1. **Video strategy = "Native shell + WKWebView panes."** The Live Racing grid will be a
   native macOS window where each video pane is a `WKWebView` loading F1 TV's web player,
   relying on **WebKit's FairPlay** support for DRM playback.
2. **This spike is sub-project 0.** It exists *only* to validate the single binary
   assumption that the entire video strategy rests on, before any real architecture is built.

### Why this spike exists (the risk it retires)

F1 TV's live/onboard streams are **DRM-protected**. The popular third-party app
*MultiViewer for F1* can play them only because it is a **Chromium/Electron** app that
inherits the **Widevine** CDM. A native macOS app cannot use Widevine; its only realistic
in-app path is **FairPlay** via WebKit (`WKWebView`) or `AVPlayer`.

**The open question:** Does F1 TV's DRM web player actually play inside a native
`WKWebView` via FairPlay? WebKit *supports* FairPlay, so it is plausible — but `WKWebView`
historically may not expose the FairPlay CDM (EME) the same way Safari does, and F1 TV may
gate behavior by user-agent or detect embedding. **If this fails, the cost is the entire
Live Racing video core.** The spike turns this guess into a documented fact *before* we
commit.

---

## 2. Goal & Non-Goals

### Goal
Produce **evidence** (a PASS/PARTIAL/FAIL findings note plus a go/no-go recommendation) on
whether F1 TV's FairPlay-protected video plays inside a native macOS `WKWebView`, and how
far the multi-pane / onboard target survives.

### Non-Goals (explicitly out of scope)
- No MVVM, no SwiftData, no persistence, no app architecture.
- No production UI, app icon, settings screen, error-state polish, or theming.
- No reusable abstractions — single-purpose throwaway code, ideally one window + one
  `WKWebView` wrapper + one injected-JS probe.
- No telemetry/live-timing, AI, news, analytics, or any other PitWall feature.
- No attempt to circumvent, strip, or bypass DRM. We only test whether the *legitimate*
  WebKit FairPlay path plays content the logged-in user is already entitled to.

---

## 3. Environment (verified)

| Item | Value |
|------|-------|
| macOS | 26.5 (build 25F71) |
| Xcode | 26.5 (build 17F42) |
| Swift | 6.3.2 |
| F1 TV subscription (for testing) | **Premium** (onboards + multi-stream available) |

Premium means the spike can validate the full target ladder, including simultaneous panes
and individual driver onboards.

---

## 4. Approach

A **minimal throwaway SwiftUI macOS app**: a single window embedding one or more
`WKWebView`s pointed at the real F1 TV web app (`https://f1tv.formula1.com`). Tests are run
manually by the developer (who logs in with the Premium account) and observed.

### Key technical considerations to bake in
- **User-Agent:** set `WKWebView.customUserAgent` to a current desktop **Safari** UA so F1 TV
  serves the **FairPlay** code path (not Widevine, which WKWebView cannot use).
- **Media config:** `WKWebViewConfiguration` with
  `mediaTypesRequiringUserActionForPlayback = []` (allow autoplay) and inline playback enabled.
- **Session persistence:** use a persistent `WKWebsiteDataStore` so the F1 TV / login.formula1.com
  OAuth session survives across launches; allow the OAuth popup/redirect flow to complete.
- **DRM probe:** inject JS that (a) calls
  `navigator.requestMediaKeySystemAccess('com.apple.fps.1_0', …)` / `'com.apple.fps'` and logs
  whether it resolves, and (b) observes the `<video>` element (`readyState`, `currentTime`
  advancing, `error`). Surface probe output to the Swift side (e.g. `WKScriptMessageHandler`).
- **App entitlements:** network client; for a throwaway spike the App Sandbox may be disabled
  to remove friction. No special entitlement is needed for *website-driven* FairPlay playback.

---

## 5. Success Criteria — the 6-rung ladder

Each rung is recorded **PASS / PARTIAL / FAIL** with a one-line note.

| # | Rung | Pass condition |
|---|------|----------------|
| 1 | Load & login | F1 TV web app renders in WKWebView; login completes; session persists across relaunch. |
| 2 | **FairPlay CDM available** *(pivotal)* | `requestMediaKeySystemAccess` for `com.apple.fps*` resolves inside WKWebView. |
| 3 | Single stream plays | A live or replay stream plays: `<video>.currentTime` advances, frames + audio render, no DRM error. |
| 4 | Two panes simultaneously | Two WKWebViews each play a *different* stream/onboard at the same time. |
| 5 | Onboard loads | A specific driver onboard (Premium feature) loads and plays in a pane. |
| 6 | *(Recon, non-blocking)* Scriptability | Injected JS can reach the `<video>`/player element for future per-pane controls (mute/play/expand). Record feasibility; not required to pass. |

**Overall spike outcome is defined by rungs 2–5.** Rung 1 is a precondition; rung 6 is
informational for the *next* sub-project.

---

## 6. Deliverable: Findings Note

The spike produces one short markdown findings note containing:
- PASS/PARTIAL/FAIL for each of the 6 rungs, with notes.
- The exact **user-agent string** that worked (if any).
- Whether **deep-link stream URLs** (loading a specific stream directly) work, or whether
  navigation through the F1 TV UI is required.
- Rough **CPU usage with 2 panes** playing simultaneously.
- Any **anti-embedding / detection** behavior observed (blank player, errors, blocks).
- A **go/no-go recommendation** (see §7).

---

## 7. Decision Outcomes (what the result triggers)

| Result | Meaning | Next action |
|--------|---------|-------------|
| Rungs 2–5 PASS | WKWebView video strategy holds. | Proceed to brainstorm the next sub-project (Foundation, then Live Racing). |
| Rung 2 FAIL | WKWebView does not expose FairPlay CDM. | **Pivot decision** *before* building: native `AVPlayer` + FairPlay handshake, MultiViewer integration, or Electron core. The spike caught this cheaply. |
| Rung 3 PASS but 4 FAIL | Single stream works; simultaneous panes blocked by F1 TV limits. | Re-scope max grid size / per-account stream limits in the Live Racing spec. |
| Rung 5 FAIL only | Broadcast plays but onboards don't load in-pane. | Investigate onboard URL/entitlement targeting before Live Racing. |

---

## 8. Scope Guardrails (YAGNI)

The spike's only job is to convert one assumption into a fact. If a line of code is not in
service of answering rungs 1–6, it does not belong here. The app is expected to be a few
hundred lines at most, single-purpose, and discarded once the findings note is written.

---

## 9. Open Questions / Assumptions

- **Assumption:** A live session or replay is reachable on the Premium account at test time
  (F1 season is active as of 2026-06-05; replays are available on demand). If no live session
  is running, rungs 3–5 are validated against a replay, which exercises the same DRM path.
- **Assumption:** Region/account restrictions on the test machine do not block F1 TV playback.
- **Note:** This repo is **not currently a git repository**, so the design doc is saved to
  disk but not committed. Version control can be initialized later if desired.
