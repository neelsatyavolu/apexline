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
