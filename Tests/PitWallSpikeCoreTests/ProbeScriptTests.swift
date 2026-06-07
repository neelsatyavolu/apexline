import XCTest
@testable import PitWallSpikeCore

final class ProbeScriptTests: XCTestCase {
    func testScriptRequestsFairPlayKeySystems() {
        let script = ProbeScript.source

        XCTAssertTrue(script.contains("com.apple.fps.1_0"))
        XCTAssertTrue(script.contains("com.apple.fps"))
        XCTAssertTrue(script.contains("navigator.requestMediaKeySystemAccess"))
        XCTAssertTrue(script.contains("status: 'available'"))
        XCTAssertTrue(script.contains("status: 'unavailable'"))
    }

    func testScriptPostsMessagesToSwiftHandler() {
        let script = ProbeScript.source

        XCTAssertTrue(script.contains("window.webkit.messageHandlers.pitwallProbe.postMessage"))
        XCTAssertTrue(script.contains("document.querySelector('video')"))
        XCTAssertTrue(script.contains("currentTime"))
        XCTAssertTrue(script.contains("readyState"))
        XCTAssertTrue(script.contains("paused"))
        XCTAssertTrue(script.contains("muted"))
        XCTAssertTrue(script.contains("error"))
        XCTAssertTrue(script.contains("'play'"))
        XCTAssertTrue(script.contains("'playing'"))
        XCTAssertTrue(script.contains("'pause'"))
        XCTAssertTrue(script.contains("'waiting'"))
        XCTAssertTrue(script.contains("'timeupdate'"))
        XCTAssertTrue(script.contains("setInterval(observeVideo, 5000)"))
    }

    func testScriptReportsVideoRenderDiagnostics() {
        let script = ProbeScript.source

        XCTAssertTrue(script.contains("videoWidth"))
        XCTAssertTrue(script.contains("videoHeight"))
        XCTAssertTrue(script.contains("clientWidth"))
        XCTAssertTrue(script.contains("clientHeight"))
        XCTAssertTrue(script.contains("getBoundingClientRect"))
        XCTAssertTrue(script.contains("getComputedStyle"))
        XCTAssertTrue(script.contains("webkitDecodedFrameCount"))
        XCTAssertTrue(script.contains("webkitDroppedFrameCount"))
        XCTAssertTrue(script.contains("requestVideoFrameCallback"))
        XCTAssertTrue(script.contains("presentedFrames"))
        XCTAssertTrue(script.contains("mediaTime"))
    }

    func testScriptTracksObservedVideoBeforeAttachingListeners() {
        let script = ProbeScript.source

        XCTAssertTrue(script.contains("new WeakSet()"))
        XCTAssertTrue(script.contains("if (!observedVideos.has(video))"))
        XCTAssertTrue(script.contains("observedVideos.add(video)"))
    }
}
