import UIKit
import WebKit
import Capacitor

/**
 Bokeà on iOS is the web app in Bokeà/wwwroot, run from the app bundle.

 Nothing about the app is decided here, the same way nothing about it is decided
 in MainActivity.java on Android. This exists for the WKWebView properties that
 have no Capacitor configuration key, and it is deliberately short.

 What is *not* here, because capacitor.config.ts or Capacitor itself already
 does it - listed so that none of it gets added again by someone reading this
 file and assuming it is the place for such things:

 - the dark ground behind the page, from `ios.backgroundColor`
 - the safe areas, from `ios.contentInset: 'never'` plus the `viewport-fit=cover`
   and `env(safe-area-inset-*)` the web app already has. This is why there is no
   notch or Dynamic Island code anywhere in the project
 - the elastic bounce of the *document*, which Capacitor turns off with
   `scrollView.bounces = false`. The bounce of the lists and modals inside it is
   CSS, and is in mobile-bridge.js
 - pinch-zoom, from `ios.zoomEnabled` being false by default, which Capacitor
   enforces through its scroll view delegate rather than once at load
 - the link preview on a long press, from `ios.allowsLinkPreview: false`
 */
class BokeaViewController: CAPBridgeViewController {

    override func capacitorDidLoad() {
        super.capacitorDidLoad()

        guard let webView = webView else { return }

        // Swiping in from the left edge means "back" in Safari. In here there is
        // nowhere to go back to - the app is one page - and the gesture is read
        // instead as a half-finished navigation that leaves the task modal open
        // over a frozen page. WKWebView defaults this to false; it is set out
        // loud because the app relies on it rather than merely tolerating it,
        // and a default is a poor place to keep something load-bearing.
        //
        // Back on Android is answered in mobile-bridge.js, which closes what is
        // on top. iOS has no such key, and now no gesture standing in for one.
        webView.allowsBackForwardNavigationGestures = false

        // The page keeps its own scrolling containers and never relies on the
        // web view scrolling as a whole, so the only thing the outer scroll
        // indicators can do is flash over the app's own.
        webView.scrollView.showsVerticalScrollIndicator = false
        webView.scrollView.showsHorizontalScrollIndicator = false
    }
}
