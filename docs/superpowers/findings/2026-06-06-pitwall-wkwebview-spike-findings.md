# PitWall WKWebView F1 TV DRM Feasibility Findings

**Date:** 2026-06-06
**Tester:**
**macOS:** 26.5 (25F71)
**Swift:** 6.3.2
**F1 TV account tier:** Premium
**Spike command:** `swift run PitWallSpike`
**Safari user agent:**

## Result Summary

| Rung | Result | Evidence |
|---|---|---|
| 1. Load and login | PASS | Inferred from successful session and onboard playback in the app. |
| 2. FairPlay CDM available | Fill during validation | Fill during validation |
| 3. Single stream plays | PASS | User confirmed session video now plays correctly. |
| 4. Two panes simultaneously | PASS | User confirmed two streams play at once. |
| 5. Onboard loads | PASS | User confirmed onboard playback works. |
| 6. Scriptability recon | PASS | User confirmed rung 6 works. |

## Observations

- Deep links:
- CPU with 2 panes:
- Audio behavior:
- Anti-embedding or detection:
- Errors: Earlier attempt had audio with black video; follow-up run played video correctly.

## Recommendation

Pending explicit rung 2 FairPlay CDM probe confirmation. Practical playback evidence is strong because single stream, two simultaneous streams, onboard playback, and scriptability all pass.
