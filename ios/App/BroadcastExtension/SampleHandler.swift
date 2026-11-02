import LiveKitClient
import ReplayKit

// ReplayKit delivers frames to this process. LKSampleHandler writes them to a socket in the
// shared app group container, where the app reads them and publishes them to LiveKit.
class SampleHandler: LKSampleHandler {
    override var enableLogging: Bool { true }
}
