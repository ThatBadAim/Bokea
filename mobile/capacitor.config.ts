import type { CapacitorConfig } from '@capacitor/cli';

// The one colour the native chrome starts from: the same #09090b the web app
// paints behind everything and names as its PWA theme colour. Everything after
// first paint is handed over to mobile-bridge.js, which follows whichever theme
// the person has actually chosen in Settings.
const BACKGROUND = '#09090b';

const config: CapacitorConfig = {
  appId: 'com.bokea.app',
  appName: 'Bokeà',

  // Built by scripts/sync-web.mjs from Bokeà/wwwroot, which is never edited
  // for the sake of this project. Run `npm run sync` after changing the web app.
  webDir: 'www',

  android: {
    backgroundColor: BACKGROUND,
    // Everything the app loads is in the APK. Nothing insecure to mix in.
    allowMixedContent: false
  },

  ios: {
    // What the window is painted with before the web view has drawn anything,
    // and behind it during the view controller transitions UIKit runs on its
    // own - rotation, the app switcher, returning from Safari. Left unset it
    // is UIColor.systemBackground, which is white on a light phone: one white
    // frame in the middle of a dark app.
    backgroundColor: BACKGROUND,

    // 'never' because the page already does this itself. index.html asks for
    // viewport-fit=cover and style.css pads its phone breakpoints with
    // env(safe-area-inset-*), which is the same arrangement Android runs
    // edge to edge. 'automatic' would have WKWebView inset the scroll view for
    // the notch, the Dynamic Island and the home indicator on top of that, and
    // every header and tab bar would sit a safe area's width out of place.
    contentInset: 'never',

    // Long-pressing a link in a WebView app offers to open a preview of a page
    // that is inside the app itself. There is nothing there worth previewing,
    // and the gesture gets in the way of press-and-hold on a task row.
    allowsLinkPreview: false,

    // Ask for the phone layout rather than letting iPadOS request desktop
    // pages, so the breakpoints the app is designed against are the ones used.
    preferredContentMode: 'mobile'
  },

  plugins: {
    // Edge to edge. Capacitor draws the page under the status and gesture bars
    // and hands the insets to CSS, which the web app already reads through
    // env(safe-area-inset-*) in its phone breakpoints. 'css' also publishes
    // --safe-area-inset-* custom properties, which are correct on WebView
    // versions older than 140 where env() is not.
    //
    // All of this is Android. WKWebView has had env(safe-area-inset-*) right
    // since iOS 11, so the notch, the Dynamic Island and the home indicator
    // reach the same CSS with nothing in between - which is why iOS needs no
    // equivalent block here, only `contentInset: 'never'` above to stop it
    // insetting the page a second time on top of what the CSS already does.
    SystemBars: {
      style: 'DARK',
      insetsHandling: 'css',
      // Saves a frame of layout shift: index.html does set viewport-fit=cover.
      initialViewportFitValueHint: 'cover'
    },

    // The splash stays up until the bridge says the app has painted, so there
    // is no white frame between the launcher icon and the dashboard.
    SplashScreen: {
      launchAutoHide: false,
      launchFadeOutDuration: 200,
      backgroundColor: BACKGROUND,
      androidSplashResourceName: 'splash',
      androidScaleType: 'CENTER',
      showSpinner: false,
      useDialog: false
    },

    // iOS only. SystemBars above speaks for Android's two bars; on iOS there is
    // just the status bar, and this is what sets the colour of the clock and
    // the battery before the bridge has read the theme. DARK means light text,
    // for the dark background behind it - the same words Android's SystemBars
    // uses, and the same thing they mean there.
    StatusBar: {
      style: 'DARK'
    },

    // Reminders that survive the app being closed. The small icon has to be a
    // flat white silhouette or Android shows a grey square; both keys are read
    // on Android only.
    LocalNotifications: {
      smallIcon: 'ic_stat_bokea',
      iconColor: '#4A7C59',

      // iOS only, and not optional here. Left unset, iOS shows nothing at all
      // for a notification that arrives while the app is open - it hands it
      // straight to the app and expects it to draw something. Android posts it
      // either way. Two of the things this app notifies about happen with the
      // app open and on screen: a commitment going past its time, which
      // checkMissedCommitmentAlerts raises through window.Notification, and a
      // reminder whose moment arrives while somebody is looking at the list.
      // Without this they would be silently dropped on iOS only, which is the
      // hardest kind of difference to notice and the worst kind to ship.
      presentationOptions: ['banner', 'list', 'sound', 'badge']
    },

    // Both of these are read on iOS only, which is what makes them safe to set
    // now: `resizeOnFullScreen` is the Android key, and it is still left out,
    // because it fights the window insets SystemBars already applies for the
    // keyboard (Capacitor logs a warning if both are set).
    //
    //   body   shortens <body> when the keyboard comes up, so the task modal's
    //          Save and Cancel are pushed above it instead of under it. This is
    //          what Android gets from adjustResize in the manifest; `native`
    //          would slide the whole web view up and take the header with it.
    //   dark   the initial keyboard, matching the #09090b the app starts in.
    //          The bridge calls Keyboard.setStyle afterwards so it follows the
    //          theme actually chosen in Settings, the way the status bar does.
    Keyboard: {
      resize: 'body',
      style: 'dark'
    }
  }
};

export default config;
