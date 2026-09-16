import UIKit
import Capacitor

class SceneDelegate: UIResponder, UIWindowSceneDelegate {
    var window: UIWindow?

    func scene(_ scene: UIScene, willConnectTo session: UISceneSession, options connectionOptions: UIScene.ConnectionOptions) {
        guard let windowScene = scene as? UIWindowScene else { return }

        window = UIWindow(windowScene: windowScene)
        // BokeaViewController rather than CAPBridgeViewController: the same web
        // view, with the handful of WKWebView properties that decide whether
        // this reads as an app or as a web page. Main.storyboard names the same
        // class, so the window UIKit builds from the scene manifest and the one
        // built here are the same app either way.
        window?.rootViewController = BokeaViewController()
        window?.backgroundColor = UIColor(red: 0x09 / 255.0, green: 0x09 / 255.0, blue: 0x0b / 255.0, alpha: 1)
        window?.makeKeyAndVisible()

        SceneDelegateProxy.shared.scene(scene, willConnectTo: session, options: connectionOptions)
    }

    func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
        SceneDelegateProxy.shared.scene(scene, openURLContexts: URLContexts)
    }

    func scene(_ scene: UIScene, continue userActivity: NSUserActivity) {
        SceneDelegateProxy.shared.scene(scene, continue: userActivity)
    }
}
