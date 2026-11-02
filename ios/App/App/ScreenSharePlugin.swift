import Capacitor
import Combine
import LiveKitClient

@objc(ScreenSharePlugin)
public class ScreenSharePlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "ScreenSharePlugin"
    public let jsName = "ScreenShare"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "start", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "stop", returnType: CAPPluginReturnPromise)
    ]

    private static let activationTimeout: UInt64 = 60

    @MainActor private var room: Room?
    @MainActor private var pending: CAPPluginCall?
    @MainActor private var activation: Task<Void, Never>?
    @MainActor private var cancellables = Set<AnyCancellable>()

    @objc override public func load() {
        Task { @MainActor in
            BroadcastManager.shared.shouldPublishTrack = false
            AudioManager.shared.audioSession.isAutomaticConfigurationEnabled = false

            BroadcastManager.shared.isBroadcastingPublisher
                .receive(on: DispatchQueue.main)
                .sink { [weak self] isBroadcasting in
                    Task { @MainActor in self?.broadcastChanged(isBroadcasting) }
                }
                .store(in: &cancellables)
        }
    }

    @objc func start(_ call: CAPPluginCall) {
        Task { @MainActor in await startSharing(call) }
    }

    @objc func stop(_ call: CAPPluginCall) {
        Task { @MainActor in
            BroadcastManager.shared.requestStop()
            await teardown()
            call.resolve()
        }
    }

    @MainActor
    private func startSharing(_ call: CAPPluginCall) async {
        guard room == nil else {
            return call.reject("Already sharing the screen")
        }

        guard ScreenShareCaptureOptions.defaultToBroadcastExtension else {
            return call.reject("This build carries no broadcast extension")
        }

        guard let serverUrl = call.getString("serverUrl"), let token = call.getString("token") else {
            return call.reject("A server url and a token are required")
        }

        let options = ScreenShareCaptureOptions(useBroadcastExtension: true)
        let room = Room(roomOptions: RoomOptions(defaultScreenShareCaptureOptions: options))

        self.room = room
        pending = call

        do {
            try await room.connect(
                url: serverUrl,
                token: token,
                connectOptions: ConnectOptions(autoSubscribe: false)
            )
        } catch {
            return await fail(error.localizedDescription)
        }

        BroadcastManager.shared.requestActivation()

        activation = Task { @MainActor in
            try? await Task.sleep(nanoseconds: Self.activationTimeout * NSEC_PER_SEC)

            guard !Task.isCancelled else { return }

            await fail("Screen recording was declined", code: "cancelled")
        }
    }

    @MainActor
    private func broadcastChanged(_ isBroadcasting: Bool) {
        guard let room else { return }

        activation?.cancel()
        activation = nil

        guard isBroadcasting else {
            Task { @MainActor in
                await teardown()
                notifyListeners("screenShareStopped", data: nil)
            }

            return
        }

        Task { @MainActor in
            do {
                try await room.localParticipant.setScreenShare(enabled: true)
                pending?.resolve()
                pending = nil
            } catch {
                await fail(error.localizedDescription)
            }
        }
    }

    @MainActor
    private func fail(_ message: String, code: String? = nil) async {
        await teardown()
        pending?.reject(message, code)
        pending = nil
    }

    @MainActor
    private func teardown() async {
        activation?.cancel()
        activation = nil

        if let room {
            self.room = nil
            await room.disconnect()
        }
    }
}
