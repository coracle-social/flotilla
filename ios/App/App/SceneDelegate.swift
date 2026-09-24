import UIKit
import Capacitor

class SceneDelegate: UIResponder, UIWindowSceneDelegate {
    var window: UIWindow?

    func scene(_ scene: UIScene, willConnectTo session: UISceneSession, options connectionOptions: UIScene.ConnectionOptions) {
        guard let windowScene = scene as? UIWindowScene else { return }

        window = UIWindow(windowScene: windowScene)
        window?.rootViewController = CAPBridgeViewController()
        window?.makeKeyAndVisible()

        SceneDelegateProxy.shared.scene(scene, willConnectTo: session, options: connectionOptions)

        if let shortcutItem = connectionOptions.shortcutItem {
            // The proxy retains lastURL for App.getLaunchUrl() before the bridge is ready.
            _ = openShortcut(shortcutItem)
        }
    }

    func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
        SceneDelegateProxy.shared.scene(scene, openURLContexts: URLContexts)
    }

    func scene(_ scene: UIScene, continue userActivity: NSUserActivity) {
        SceneDelegateProxy.shared.scene(scene, continue: userActivity)
    }

    func windowScene(
        _ windowScene: UIWindowScene,
        performActionFor shortcutItem: UIApplicationShortcutItem,
        completionHandler: @escaping (Bool) -> Void
    ) {
        completionHandler(openShortcut(shortcutItem))
    }

    private func openShortcut(_ shortcutItem: UIApplicationShortcutItem) -> Bool {
        let path: String

        switch shortcutItem.type {
        case "social.flotilla.shortcut.messages":
            path = "messages"
        case "social.flotilla.shortcut.search":
            path = "search"
        case "social.flotilla.shortcut.spaces":
            path = "spaces"
        case "social.flotilla.shortcut.inbox":
            path = "inbox"
        default:
            return false
        }

        guard let url = URL(string: "flotilla://shortcut/\(path)") else { return false }

        return ApplicationDelegateProxy.shared.application(UIApplication.shared, open: url, options: [:])
    }
}
