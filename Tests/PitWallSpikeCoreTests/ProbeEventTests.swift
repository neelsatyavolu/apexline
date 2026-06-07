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

    func testDecodedEventsReceiveDistinctIDs() throws {
        let payload: [String: Any] = [
            "timestamp": "2026-06-06T12:00:00Z",
            "type": "eme",
            "keySystem": "com.apple.fps",
            "status": "available"
        ]

        let first = try ProbeEvent(payload: payload)
        let second = try ProbeEvent(payload: payload)

        XCTAssertNotEqual(first.id, second.id)
    }

    func testDecodesVideoRenderDiagnostics() throws {
        let payload: [String: Any] = [
            "timestamp": "2026-06-06T12:00:00Z",
            "type": "video",
            "status": "observed",
            "readyState": 4,
            "networkState": 2,
            "currentTime": 12.5,
            "videoWidth": 1920,
            "videoHeight": 1080,
            "clientWidth": 960,
            "clientHeight": 540,
            "rectWidth": 960.0,
            "rectHeight": 540.0,
            "decodedFrameCount": 120,
            "droppedFrameCount": 2,
            "presentedFrames": 118,
            "mediaTime": 12.4,
            "display": "block",
            "visibility": "visible",
            "opacity": "1"
        ]

        let event = try ProbeEvent(payload: payload)

        XCTAssertEqual(event.networkState, 2)
        XCTAssertEqual(event.videoWidth, 1920)
        XCTAssertEqual(event.videoHeight, 1080)
        XCTAssertEqual(event.clientWidth, 960)
        XCTAssertEqual(event.clientHeight, 540)
        XCTAssertEqual(event.rectWidth, 960.0)
        XCTAssertEqual(event.rectHeight, 540.0)
        XCTAssertEqual(event.decodedFrameCount, 120)
        XCTAssertEqual(event.droppedFrameCount, 2)
        XCTAssertEqual(event.presentedFrames, 118)
        XCTAssertEqual(event.mediaTime, 12.4)
        XCTAssertEqual(event.display, "block")
        XCTAssertEqual(event.visibility, "visible")
        XCTAssertEqual(event.opacity, "1")
    }
}
