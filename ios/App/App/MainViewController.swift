import Capacitor

// Capacitor registers plugins listed in capacitor.config.json, which covers installed packages
// and not a plugin living in the app target.
class MainViewController: CAPBridgeViewController {
    override func capacitorDidLoad() {
        bridge?.registerPluginInstance(ScreenSharePlugin())
    }
}
