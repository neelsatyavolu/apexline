# PitWall WKWebView Feasibility Spike Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Validate whether F1 TV's FairPlay-protected web player can run inside a native macOS `WKWebView`, then document a PASS/PARTIAL/FAIL recommendation before building the rest of PitWall.

**Architecture:** Build a disposable Swift Package Manager macOS executable that launches a native AppKit/SwiftUI window with one or two `WKWebView` panes. The app uses a Safari desktop user agent, persistent WebKit website data, and an injected JavaScript probe to report FairPlay EME and `<video>` playback state back to Swift.

**Tech Stack:** Swift 6.3, Swift Package Manager, SwiftUI, AppKit, WebKit, XCTest, manual F1 TV Premium account validation.

---

## Scope And Assumptions

The full PitWall brief is intentionally broader than this implementation plan. The approved design spec at `docs/superpowers/specs/2026-06-05-pitwall-wkwebview-spike-design.md` decomposes the project and identifies this spike as sub-project 0, because Live Racing depends on whether F1 TV video works in `WKWebView`.

**In scope for this plan:**
- Create a minimal throwaway macOS spike app.
- Test F1 TV login, FairPlay availability, one stream, two streams, onboards, and basic scriptability.
- Record findings in markdown with a go/no-go recommendation.

**Out of scope for this plan:**
- Production PitWall navigation, dashboard, news, analytics, live timing, AI, settings, Keychain, SwiftData, theming, notifications, release packaging, or App Store work.
- Any DRM circumvention. The spike only tests legitimate playback through the user's entitled F1 TV web session.

**Assumptions:**
- This repository is not currently a git repository, so commit steps are written as optional "if git is initialized" checks.
- A Swift Package executable is used instead of a hand-authored Xcode project to keep the spike small and reviewable.
- The tester has an F1 TV Premium subscription and can manually complete login inside the web view.

## Full PitWall Sub-Project Ladder

This is the recommended dependency order for the broader app after the spike:

1. **Sub-project 0: WKWebView F1 TV DRM spike** - validates the video strategy.
2. **Sub-project 1: Native app foundation** - app shell, sidebar navigation, data models, persistence boundaries.
3. **Sub-project 2: Public data layer** - OpenF1, Jolpica/Ergast, RSS ingestion, caching, errors.
4. **Sub-project 3: Non-live screens** - Dashboard, News, Standings, Schedules, Analytics.
5. **Sub-project 4: Live Racing layout engine** - unified window, multi-view grid, presets, pane resizing.
6. **Sub-project 5: Live timing and onboard pairing** - timing sidebar, battle detection calculations, grid loading actions.
7. **Sub-project 6: User-owned AI layer** - Keychain API keys, provider clients, structured prompts/responses, insights pane.
8. **Sub-project 7: Polish and release** - notifications, themes, offline states, README, legal copy, packaging.

Each sub-project should get its own design spec and implementation plan after its predecessor is verified.

## File Structure

- Create: `Package.swift`
  - Defines one executable target, one small core library target, and one XCTest target.
- Create: `Sources/PitWallSpike/main.swift`
  - Starts `NSApplication` and attaches the SwiftUI root view.
- Create: `Sources/PitWallSpike/ContentView.swift`
  - Disposable test UI: pane count toggle, F1 TV URL controls, event log, manual rung checklist.
- Create: `Sources/PitWallSpike/WebViewPane.swift`
  - `NSViewRepresentable` wrapper around `WKWebView`, with Safari user agent and probe injection.
- Create: `Sources/PitWallSpikeCore/ProbeScript.swift`
  - JavaScript source for FairPlay EME probing and `<video>` state observation.
- Create: `Sources/PitWallSpikeCore/ProbeEvent.swift`
  - Small structured model for messages sent from JavaScript to Swift.
- Create: `Tests/PitWallSpikeCoreTests/ProbeScriptTests.swift`
  - Verifies the probe includes required key systems and message handler wiring.
- Create: `Tests/PitWallSpikeCoreTests/ProbeEventTests.swift`
  - Verifies sample probe payload decoding.
- Create: `docs/superpowers/findings/2026-06-06-pitwall-wkwebview-spike-findings.md`
  - Manual evidence table and final go/no-go recommendation.

---

### Task 1: Swift Package Scaffold

**Files:**
- Create: `Package.swift`
- Create: `Sources/PitWallSpike/main.swift`

- [ ] **Step 1: Create the package manifest**

```swift
// swift-tools-version: 6.0
import PackageDescription

let package = Package(
    name: "PitWallSpike",
    platforms: [.macOS(.v14)],
    products: [
        .executable(name: "PitWallSpike", targets: ["PitWallSpike"])
    ],
    targets: [
        .target(name: "PitWallSpikeCore"),
        .executableTarget(
            name: "PitWallSpike",
            dependencies: ["PitWallSpikeCore"]
        ),
        .testTarget(
            name: "PitWallSpikeCoreTests",
            dependencies: ["PitWallSpikeCore"]
        )
    ]
)
```

- [ ] **Step 2: Create the minimal macOS entrypoint**

```swift
import AppKit
import SwiftUI

final class AppDelegate: NSObject, NSApplicationDelegate {
    private var window: NSWindow?

    func applicationDidFinishLaunching(_ notification: Notification) {
        let rootView = Text("PitWall WKWebView Spike")
            .frame(minWidth: 900, minHeight: 620)

        let window = NSWindow(
            contentRect: NSRect(x: 0, y: 0, width: 1100, height: 760),
            styleMask: [.titled, .closable, .miniaturizable, .resizable],
            backing: .buffered,
            defer: false
        )
        window.title = "PitWall WKWebView Spike"
        window.center()
        window.contentView = NSHostingView(rootView: rootView)
        window.makeKeyAndOrderFront(nil)
        self.window = window
    }
}

let app = NSApplication.shared
let delegate = AppDelegate()
app.delegate = delegate
app.setActivationPolicy(.regular)
app.activate(ignoringOtherApps: true)
app.run()
```

- [ ] **Step 3: Build the empty window**

Run: `swift build`

Expected: `Build complete!`

- [ ] **Step 4: Launch the empty window**

Run: `swift run PitWallSpike`

Expected: A native macOS window opens with the title `PitWall WKWebView Spike`.

- [ ] **Step 5: Commit if git is initialized**

Run: `git status --short`

Expected in this repo today: `fatal: not a git repository`. If git is initialized later, commit with:

```bash
git add Package.swift Sources/PitWallSpike/main.swift
git commit -m "chore: scaffold PitWall WKWebView spike"
```

---

### Task 2: Probe Script Core

**Files:**
- Create: `Sources/PitWallSpikeCore/ProbeScript.swift`
- Create: `Tests/PitWallSpikeCoreTests/ProbeScriptTests.swift`

- [ ] **Step 1: Write the failing probe script tests**

```swift
import XCTest
@testable import PitWallSpikeCore

final class ProbeScriptTests: XCTestCase {
    func testScriptRequestsFairPlayKeySystems() {
        let script = ProbeScript.source

        XCTAssertTrue(script.contains("com.apple.fps.1_0"))
        XCTAssertTrue(script.contains("com.apple.fps"))
        XCTAssertTrue(script.contains("navigator.requestMediaKeySystemAccess"))
    }

    func testScriptPostsMessagesToSwiftHandler() {
        let script = ProbeScript.source

        XCTAssertTrue(script.contains("window.webkit.messageHandlers.pitwallProbe.postMessage"))
        XCTAssertTrue(script.contains("document.querySelector('video')"))
        XCTAssertTrue(script.contains("currentTime"))
    }
}
```

- [ ] **Step 2: Run tests to verify failure**

Run: `swift test --filter ProbeScriptTests`

Expected: FAIL because `ProbeScript` is not defined.

- [ ] **Step 3: Add the minimal probe script**

```swift
public enum ProbeScript {
    public static let source = """
    (() => {
      const post = (payload) => {
        try {
          window.webkit.messageHandlers.pitwallProbe.postMessage({
            timestamp: new Date().toISOString(),
            ...payload
          });
        } catch (_) {}
      };

      const configs = [{
        initDataTypes: ['sinf', 'skd'],
        videoCapabilities: [{ contentType: 'video/mp4; codecs="avc1.42E01E"' }]
      }];

      const keySystems = ['com.apple.fps.1_0', 'com.apple.fps'];
      keySystems.forEach(async (keySystem) => {
        try {
          await navigator.requestMediaKeySystemAccess(keySystem, configs);
          post({ type: 'eme', keySystem, status: 'available' });
        } catch (error) {
          post({ type: 'eme', keySystem, status: 'unavailable', message: String(error) });
        }
      });

      const observeVideo = () => {
        const video = document.querySelector('video');
        if (!video) {
          post({ type: 'video', status: 'missing' });
          return;
        }

        const report = () => post({
          type: 'video',
          status: 'observed',
          readyState: video.readyState,
          paused: video.paused,
          muted: video.muted,
          currentTime: video.currentTime,
          error: video.error ? video.error.message : null
        });

        ['play', 'playing', 'pause', 'waiting', 'error', 'timeupdate'].forEach((name) => {
          video.addEventListener(name, report);
        });
        report();
      };

      observeVideo();
      setInterval(observeVideo, 5000);
    })();
    """
}
```

- [ ] **Step 4: Run tests to verify pass**

Run: `swift test --filter ProbeScriptTests`

Expected: PASS.

- [ ] **Step 5: Commit if git is initialized**

```bash
git add Sources/PitWallSpikeCore/ProbeScript.swift Tests/PitWallSpikeCoreTests/ProbeScriptTests.swift
git commit -m "test: add WebKit FairPlay probe script"
```

---

### Task 3: Probe Event Model

**Files:**
- Create: `Sources/PitWallSpikeCore/ProbeEvent.swift`
- Create: `Tests/PitWallSpikeCoreTests/ProbeEventTests.swift`

- [ ] **Step 1: Write failing decoding tests**

```swift
import XCTest
@testable import PitWallSpikeCore

final class ProbeEventTests: XCTestCase {
    func testDecodesEMEEvent() throws {
        let payload: [String: Any] = [
            "timestamp": "2026-06-06T12:00:00Z",
            "type": "eme",
            "keySystem": "com.apple.fps",
            "status": "available"
        ]

        let event = try ProbeEvent(payload: payload)

        XCTAssertEqual(event.type, "eme")
        XCTAssertEqual(event.keySystem, "com.apple.fps")
        XCTAssertEqual(event.status, "available")
    }
}
```

- [ ] **Step 2: Run tests to verify failure**

Run: `swift test --filter ProbeEventTests`

Expected: FAIL because `ProbeEvent` is not defined.

- [ ] **Step 3: Add minimal payload decoding**

```swift
import Foundation

public struct ProbeEvent: Decodable, Equatable, Identifiable {
    public var id: String { "\(timestamp)-\(type)-\(status)" }
    public let timestamp: String
    public let type: String
    public let status: String
    public let keySystem: String?
    public let message: String?
    public let readyState: Int?
    public let paused: Bool?
    public let muted: Bool?
    public let currentTime: Double?
    public let error: String?

    public init(payload: [String: Any]) throws {
        let data = try JSONSerialization.data(withJSONObject: payload)
        self = try JSONDecoder().decode(Self.self, from: data)
    }
}
```

- [ ] **Step 4: Run tests to verify pass**

Run: `swift test --filter ProbeEventTests`

Expected: PASS.

- [ ] **Step 5: Commit if git is initialized**

```bash
git add Sources/PitWallSpikeCore/ProbeEvent.swift Tests/PitWallSpikeCoreTests/ProbeEventTests.swift
git commit -m "test: decode WebKit probe events"
```

---

### Task 4: WKWebView Pane

**Files:**
- Create: `Sources/PitWallSpike/WebViewPane.swift`
- Modify: `Sources/PitWallSpike/main.swift`

- [ ] **Step 1: Add the web view wrapper**

```swift
import PitWallSpikeCore
import SwiftUI
import WebKit

struct WebViewPane: NSViewRepresentable {
    let url: URL
    let onEvent: (ProbeEvent) -> Void

    func makeCoordinator() -> Coordinator {
        Coordinator(onEvent: onEvent)
    }

    func makeNSView(context: Context) -> WKWebView {
        let configuration = WKWebViewConfiguration()
        configuration.websiteDataStore = .default()
        configuration.defaultWebpagePreferences.allowsContentJavaScript = true
        configuration.mediaTypesRequiringUserActionForPlayback = []
        configuration.userContentController.add(context.coordinator, name: "pitwallProbe")
        configuration.userContentController.addUserScript(WKUserScript(
            source: ProbeScript.source,
            injectionTime: .atDocumentEnd,
            forMainFrameOnly: false
        ))

        let webView = WKWebView(frame: .zero, configuration: configuration)
        webView.customUserAgent = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15"
        webView.allowsBackForwardNavigationGestures = true
        webView.load(URLRequest(url: url))
        return webView
    }

    func updateNSView(_ webView: WKWebView, context: Context) {}

    final class Coordinator: NSObject, WKScriptMessageHandler {
        let onEvent: (ProbeEvent) -> Void

        init(onEvent: @escaping (ProbeEvent) -> Void) {
            self.onEvent = onEvent
        }

        func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
            guard let payload = message.body as? [String: Any],
                  let event = try? ProbeEvent(payload: payload) else {
                return
            }
            onEvent(event)
        }
    }
}
```

- [ ] **Step 2: Build to catch WebKit/AppKit compile issues**

Run: `swift build`

Expected: PASS.

- [ ] **Step 3: Verify the package still tests cleanly**

Run: `swift test`

Expected: PASS.

- [ ] **Step 4: Commit if git is initialized**

```bash
git add Sources/PitWallSpike/WebViewPane.swift
git commit -m "feat: embed F1 TV web view pane"
```

---

### Task 5: Disposable Test UI

**Files:**
- Create: `Sources/PitWallSpike/ContentView.swift`
- Modify: `Sources/PitWallSpike/main.swift`

- [ ] **Step 1: Replace the placeholder text with `ContentView`**

Change `main.swift` so the root view is:

```swift
let rootView = ContentView()
    .frame(minWidth: 1100, minHeight: 760)
```

- [ ] **Step 2: Add the single/two pane test UI**

```swift
import PitWallSpikeCore
import SwiftUI

struct ContentView: View {
    private let f1TVURL = URL(string: "https://f1tv.formula1.com")!

    @State private var paneCount = 1
    @State private var events: [ProbeEvent] = []

    var body: some View {
        VStack(spacing: 0) {
            HStack {
                Picker("Panes", selection: $paneCount) {
                    Text("1 Pane").tag(1)
                    Text("2 Panes").tag(2)
                }
                .pickerStyle(.segmented)
                .frame(width: 180)

                Text("Use this throwaway spike to log in, open a stream or onboard, and record rung results.")
                    .foregroundStyle(.secondary)

                Spacer()
            }
            .padding()

            HSplitView {
                HStack(spacing: 1) {
                    ForEach(0..<paneCount, id: \.self) { _ in
                        WebViewPane(url: f1TVURL) { event in
                            events.insert(event, at: 0)
                            events = Array(events.prefix(80))
                        }
                    }
                }
                .frame(minWidth: 760)

                List(events) { event in
                    VStack(alignment: .leading, spacing: 4) {
                        Text("\(event.type): \(event.status)")
                            .font(.headline)
                        Text(event.keySystem ?? "video time: \(event.currentTime ?? 0)")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                }
                .frame(minWidth: 280)
            }
        }
    }
}
```

- [ ] **Step 3: Build and test**

Run: `swift build && swift test`

Expected: PASS.

- [ ] **Step 4: Launch and verify basic navigation**

Run: `swift run PitWallSpike`

Expected:
- The F1 TV website loads in one pane.
- Switching to `2 Panes` shows two independently loaded F1 TV panes.
- Probe events appear in the right-side event log after pages load or a video element appears.

- [ ] **Step 5: Commit if git is initialized**

```bash
git add Sources/PitWallSpike/main.swift Sources/PitWallSpike/ContentView.swift
git commit -m "feat: add disposable F1 TV test UI"
```

---

### Task 6: Findings Template

**Files:**
- Create: `docs/superpowers/findings/2026-06-06-pitwall-wkwebview-spike-findings.md`

- [ ] **Step 1: Create the findings document**

```markdown
# PitWall WKWebView F1 TV DRM Feasibility Findings

**Date:** 2026-06-06
**Tester:**
**macOS:**
**Swift:**
**F1 TV account tier:** Premium
**Spike command:** `swift run PitWallSpike`
**Safari user agent:**

## Result Summary

| Rung | Result | Evidence |
|---|---|---|
| 1. Load and login | Fill during validation | Fill during validation |
| 2. FairPlay CDM available | Fill during validation | Fill during validation |
| 3. Single stream plays | Fill during validation | Fill during validation |
| 4. Two panes simultaneously | Fill during validation | Fill during validation |
| 5. Onboard loads | Fill during validation | Fill during validation |
| 6. Scriptability recon | Fill during validation | Fill during validation |

## Observations

- Deep links:
- CPU with 2 panes:
- Audio behavior:
- Anti-embedding or detection:
- Errors:

## Recommendation

Fill during validation: GO / PARTIAL / NO-GO.
```

- [ ] **Step 2: Verify the docs path exists**

Run: `ls docs/superpowers/findings`

Expected: The findings markdown file is listed.

- [ ] **Step 3: Commit if git is initialized**

```bash
git add docs/superpowers/findings/2026-06-06-pitwall-wkwebview-spike-findings.md
git commit -m "docs: add WKWebView spike findings template"
```

---

### Task 7: Manual Validation Run

**Files:**
- Modify: `docs/superpowers/findings/2026-06-06-pitwall-wkwebview-spike-findings.md`

- [ ] **Step 1: Run the app**

Run: `swift run PitWallSpike`

Expected: App opens and loads `https://f1tv.formula1.com`.

- [ ] **Step 2: Validate rung 1, load and login**

Action:
- Complete F1 TV login inside the web view.
- Quit and relaunch the app.

Expected PASS:
- Login completes.
- Session persists after relaunch.

Record result in the findings table.

- [ ] **Step 3: Validate rung 2, FairPlay CDM availability**

Action:
- Watch the probe event log.

Expected PASS:
- At least one event reports `type: eme`, `keySystem: com.apple.fps...`, `status: available`.

Record the exact key system result and Safari user agent.

- [ ] **Step 4: Validate rung 3, single stream playback**

Action:
- Open a live stream or replay in one pane.
- Observe video frames, audio, and event log.

Expected PASS:
- Frames render.
- Audio plays or can be unmuted.
- `<video>.currentTime` increases.
- No DRM playback error is shown.

Record result and any visible player errors.

- [ ] **Step 5: Validate rung 4, two simultaneous panes**

Action:
- Switch to `2 Panes`.
- Open different streams or onboards in each pane.

Expected PASS:
- Both panes play different video streams at the same time.
- CPU remains reasonable enough to continue evaluating.

Record result and rough CPU from Activity Monitor.

- [ ] **Step 6: Validate rung 5, onboard playback**

Action:
- Load a driver onboard available to the Premium account.

Expected PASS:
- Onboard stream loads and plays inside at least one pane.

Record whether a direct onboard URL works or navigation through the F1 TV UI is required.

- [ ] **Step 7: Validate rung 6, scriptability recon**

Action:
- Attempt play, pause, mute, and observe event reporting.

Expected PASS:
- Injected script can see the `<video>` element and playback state.

Record as PASS/PARTIAL/FAIL. This rung is informative, not a go/no-go blocker.

- [ ] **Step 8: Write the recommendation**

Expected recommendation rules:
- **GO:** Rungs 2-5 PASS.
- **NO-GO:** Rung 2 FAIL.
- **PARTIAL:** Rung 3 PASS but rung 4 or 5 FAIL.

- [ ] **Step 9: Commit if git is initialized**

```bash
git add docs/superpowers/findings/2026-06-06-pitwall-wkwebview-spike-findings.md
git commit -m "docs: record WKWebView spike findings"
```

---

### Task 8: Post-Spike Handoff

**Files:**
- Modify: `docs/superpowers/findings/2026-06-06-pitwall-wkwebview-spike-findings.md`
- Optional create after user approval: `docs/superpowers/specs/YYYY-MM-DD-pitwall-foundation-design.md`

- [ ] **Step 1: Re-run automated checks**

Run: `swift test && swift build`

Expected: PASS.

- [ ] **Step 2: Confirm the findings recommendation is internally consistent**

Check:
- Rungs 2-5 PASS maps to GO.
- Rung 2 FAIL maps to NO-GO.
- Rung 3 PASS with rung 4 or 5 FAIL maps to PARTIAL.

Expected: Recommendation follows the table in the approved design spec.

- [ ] **Step 3: Remove no code unless the user asks**

Expected:
- Keep the throwaway spike code in place until the user confirms findings are captured and no longer needed.
- Do not start production PitWall architecture in this plan.

- [ ] **Step 4: Ask for the next design decision**

If GO:
- Start brainstorming sub-project 1, the native app foundation.

If PARTIAL:
- Brainstorm the specific constraint that failed, such as max grid size or onboard URL targeting.

If NO-GO:
- Brainstorm the video strategy pivot: native `AVPlayer` plus FairPlay handshake, Electron/Chromium core, or integration with an external player.
