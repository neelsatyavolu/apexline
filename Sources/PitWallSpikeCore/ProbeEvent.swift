import Foundation

public struct ProbeEvent: Decodable, Equatable, Identifiable {
    public let id: UUID
    public let timestamp: String
    public let type: String
    public let status: String
    public let keySystem: String?
    public let message: String?
    public let readyState: Int?
    public let networkState: Int?
    public let paused: Bool?
    public let muted: Bool?
    public let currentTime: Double?
    public let error: String?
    public let videoWidth: Int?
    public let videoHeight: Int?
    public let clientWidth: Int?
    public let clientHeight: Int?
    public let rectWidth: Double?
    public let rectHeight: Double?
    public let decodedFrameCount: Int?
    public let droppedFrameCount: Int?
    public let presentedFrames: Int?
    public let mediaTime: Double?
    public let display: String?
    public let visibility: String?
    public let opacity: String?

    public init(payload: [String: Any]) throws {
        let data = try JSONSerialization.data(withJSONObject: payload)
        self = try JSONDecoder().decode(Self.self, from: data)
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = UUID()
        timestamp = try container.decode(String.self, forKey: .timestamp)
        type = try container.decode(String.self, forKey: .type)
        status = try container.decode(String.self, forKey: .status)
        keySystem = try container.decodeIfPresent(String.self, forKey: .keySystem)
        message = try container.decodeIfPresent(String.self, forKey: .message)
        readyState = try container.decodeIfPresent(Int.self, forKey: .readyState)
        networkState = try container.decodeIfPresent(Int.self, forKey: .networkState)
        paused = try container.decodeIfPresent(Bool.self, forKey: .paused)
        muted = try container.decodeIfPresent(Bool.self, forKey: .muted)
        currentTime = try container.decodeIfPresent(Double.self, forKey: .currentTime)
        error = try container.decodeIfPresent(String.self, forKey: .error)
        videoWidth = try container.decodeIfPresent(Int.self, forKey: .videoWidth)
        videoHeight = try container.decodeIfPresent(Int.self, forKey: .videoHeight)
        clientWidth = try container.decodeIfPresent(Int.self, forKey: .clientWidth)
        clientHeight = try container.decodeIfPresent(Int.self, forKey: .clientHeight)
        rectWidth = try container.decodeIfPresent(Double.self, forKey: .rectWidth)
        rectHeight = try container.decodeIfPresent(Double.self, forKey: .rectHeight)
        decodedFrameCount = try container.decodeIfPresent(Int.self, forKey: .decodedFrameCount)
        droppedFrameCount = try container.decodeIfPresent(Int.self, forKey: .droppedFrameCount)
        presentedFrames = try container.decodeIfPresent(Int.self, forKey: .presentedFrames)
        mediaTime = try container.decodeIfPresent(Double.self, forKey: .mediaTime)
        display = try container.decodeIfPresent(String.self, forKey: .display)
        visibility = try container.decodeIfPresent(String.self, forKey: .visibility)
        opacity = try container.decodeIfPresent(String.self, forKey: .opacity)
    }

    private enum CodingKeys: String, CodingKey {
        case timestamp
        case type
        case status
        case keySystem
        case message
        case readyState
        case networkState
        case paused
        case muted
        case currentTime
        case error
        case videoWidth
        case videoHeight
        case clientWidth
        case clientHeight
        case rectWidth
        case rectHeight
        case decodedFrameCount
        case droppedFrameCount
        case presentedFrames
        case mediaTime
        case display
        case visibility
        case opacity
    }
}
