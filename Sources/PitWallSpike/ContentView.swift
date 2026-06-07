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
                            DispatchQueue.main.async {
                                events.insert(event, at: 0)
                                events = Array(events.prefix(80))
                            }
                        }
                    }
                }
                .frame(minWidth: 760)

                List(events) { event in
                    VStack(alignment: .leading, spacing: 4) {
                        Text("\(event.type): \(event.status)")
                            .font(.headline)
                        Text(detailText(for: event))
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                }
                .frame(minWidth: 280)
            }
        }
    }

    private func detailText(for event: ProbeEvent) -> String {
        if let keySystem = event.keySystem {
            return keySystem
        }

        if event.type == "video" {
            var parts: [String] = []
            if let currentTime = event.currentTime {
                parts.append("time \(currentTime)")
            }
            if let readyState = event.readyState {
                parts.append("ready \(readyState)")
            }
            if let networkState = event.networkState {
                parts.append("network \(networkState)")
            }
            if let videoWidth = event.videoWidth, let videoHeight = event.videoHeight {
                parts.append("video \(videoWidth)x\(videoHeight)")
            }
            if let rectWidth = event.rectWidth, let rectHeight = event.rectHeight {
                parts.append("rect \(rectWidth)x\(rectHeight)")
            }
            if let decodedFrameCount = event.decodedFrameCount {
                parts.append("decoded \(decodedFrameCount)")
            }
            if let presentedFrames = event.presentedFrames {
                parts.append("presented \(presentedFrames)")
            }
            if let error = event.error {
                parts.append("error \(error)")
            }
            return parts.isEmpty ? "video diagnostics pending" : parts.joined(separator: " | ")
        }

        return event.message ?? "no details"
    }
}
