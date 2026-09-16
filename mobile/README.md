# Bokeà for Android and iOS

The same app that is on the web, in a store's clothes. `Bokeà/wwwroot` is the
app; this directory is what wraps it, and nothing in here is a second copy of
anything. Change the web app, run `./build.sh`, and the phone has it.

There is one wrapper, not two. The same `www/`, the same bridge, the same
config, and one test suite that is run twice - once as each app - so that a
difference between them fails here rather than on somebody's phone. The two
apps differ in four places, all of them named where they happen: Android has a
second system bar and a hardware Back key, iOS has a keyboard with a colour and
an app that is never allowed to close itself.

Three things they do that a browser tab cannot:

- **They open at once, with no signal.** Every file the page asks for, down to
  the fonts and the Supabase client, is inside the app. There is no network on
  the path between the icon and the dashboard.
- **They behave like native apps.** Edge to edge under the status bar, the
  gesture bar, the notch and the Dynamic Island; chrome that follows the theme;
  a buzz when a task goes green - the vibrator on Android, the Taptic Engine on
  iOS; a keyboard that never sits on top of the field.
- **They can tell you something while closed.** Neither web view has Push or a
  `Notification` constructor, so the web app can never reach either device.
  Reminders are scheduled on the phone instead.

## Building it

```bash
./build.sh              # the web app, the Android project and a debug APK
./build.sh release      # an unsigned release APK
./build.sh ios          # the web app, the Xcode project and an archive
./build.sh sync         # stop after both native projects, ready for the IDEs
```

The APK lands in `dist/`. Install it with:

```bash
adb install -r dist/Bokea-1.0.0-debug.apk
```

`BOKEA_VERSION=1.2.0 ./build.sh` stamps a version on it.

### iOS without a Mac

Everything in `ios/` is built on Linux and committed: the Swift, the
storyboards, the asset catalogue, the `Info.plist`, the `Podfile`, the shared
scheme. `./build.sh ios` and `./build.sh sync` do all of it anywhere Node runs.

The one step that cannot be done off macOS is the compile, because `xcodebuild`
and the iOS SDKs are macOS only. Run on Linux, `./build.sh ios` builds the
project in full and then says so plainly rather than half-failing.

`.github/workflows/build-ios.yml` does that step on a `macos-latest` runner,
against this same committed project. Push the branch, or run the workflow by
hand, and the archive comes back as an artifact. Nothing about the project has
to change between the two, which is the point of committing all of it.

### What the machine needs

| For | Needs |
| --- | --- |
| `./build.sh sync`, `./build.sh ios` up to the compile, and the tests | Node 20 or newer |
| an APK | a JDK (Android Gradle wants 21) and the Android SDK, with `ANDROID_HOME` pointing at it |
| an iOS archive | macOS, Xcode, and CocoaPods (`sudo gem install cocoapods`) |
| the app icons, only if `assets/icon.svg` changes | librsvg (`rsvg-convert`) or ImageMagick |

Android Studio is the shortest way to the first two: install it, open
`mobile/android`, and press Run. It brings its own JDK (`jbr/` inside the
install) and its own SDK, and `build.sh` finds an SDK in the usual places
without being told. On a Mac, `npm run open:ios` opens the workspace in Xcode.

Without them, `./build.sh` still builds everything it can and then says which
piece is missing.

The first build downloads the fonts and the two CDN scripts into `.cache/`.
Every build after that needs no network.

## What the build does

`scripts/sync-web.mjs` builds `www/` out of `Bokeà/wwwroot`:

1. copies the whole of `wwwroot`
2. downloads everything the page loads from somewhere else - the Google Fonts
   stylesheet and its woff2 files, `lucide`, `@supabase/supabase-js` - into
   `www/vendor/`, and rewrites the references in the HTML **and in the
   JavaScript**. `sw.js` matters most: it pre-caches a fixed list with
   `cache.addAll`, which fails as a whole if one entry cannot be fetched, so a
   CDN address left in it would stop the service worker installing on a phone
   with no signal
3. copies `src/bridge/mobile-bridge.js` in beside `app.js` and adds the one
   `<script>` tag that loads it

`npx cap sync android` and `npx cap sync ios` then copy `www/` into each app's
bundle and refresh the plugin wiring. One `www/` serves both.

`www/` is generated and gitignored. Editing it edits nothing: the next build
throws it away. So is `ios/App/App/public`, which is `cap sync`'s copy of it.

## The bridge

`src/bridge/mobile-bridge.js` is the only file that knows the app is inside
Capacitor. It changes nothing about what the app does - it wraps what app.js
already exposes on `window`, and where it needs to close something it sends
Escape, which app.js already routes to the right place.

| | |
| --- | --- |
| **Splash** | held until the app has painted, so there is no white frame and no flash of the sign-in screen on the way to the dashboard |
| **System bars** | the icon colour is read off the page's own painted background, so it follows the theme, the high-contrast mode, and any change made in Settings. Android has two bars and is told about both; iOS has one |
| **Back** | *Android.* Closes the tour, a row menu, the task modal, a calendar day, the picture cropper or focus mode; then steps back through the tabs; then puts the app in the background rather than closing it. *iOS* has no Back, and the edge swipe that would be it is turned off - in a one-page app it reads as a half-finished navigation that leaves a modal open over a frozen page |
| **Haptics** | success when a task goes green, a light tap on controls, a warning on delete. One buzz per thing that happened: a 300ms gate stops a tick that also raises a toast from buzzing twice. The same calls reach Android's vibrator and the iOS Taptic Engine |
| **Keyboard** | scrolls the focused field into view. The page is shortened to fit by `adjustResize` on Android and `resize: 'body'` on iOS, so Save and Cancel are never behind it. On iOS the keyboard's own colour follows the theme, or a dark app would raise a white keyboard |
| **Notifications** | `window.Notification` is filled in with local notifications, so the app's own overdue alerts arrive; tasks with a time are scheduled up to 14 days ahead so a reminder arrives with the app closed |
| **Reminders switch** | the switch in Settings would otherwise only ever report that this browser has no Push. The tap is taken first and answered with the thing that works |
| **Auth links** | every link Supabase emails is pointed at `bokea://auth`, and a tap on one puts the fragment back in the address and reloads, which is how app.js reads it. One scheme, declared in Android's manifest and in the iOS `Info.plist`, so one redirect URL covers both apps |

### The safe areas

Neither app has any code for the notch, the Dynamic Island, the status bar or
the home indicator, and that is deliberate. `Bokeà/wwwroot/index.html` already
asks for `viewport-fit=cover` and `css/style.css` already pads its phone
breakpoints with `env(safe-area-inset-*)`. Both platforms are configured to
hand the insets to that CSS rather than to pad the web view themselves:

- **Android** through `SystemBars.insetsHandling: 'css'`, plus `EdgeToEdge` in
  `MainActivity.java` so phones before Android 15 behave like the ones after.
- **iOS** through `ios.contentInset: 'never'`. WKWebView has had
  `env(safe-area-inset-*)` right since iOS 11; `'automatic'` would inset the
  scroll view for the notch *as well*, and every header would sit a safe area's
  width out of place.

## Three things to set up once

**Supabase redirect URL.** A password reset link has to be allowed to come back
to the app. In the Supabase dashboard: **Authentication → URL Configuration →
Redirect URLs**, add `bokea://auth`. One entry covers both apps. Without it
Supabase refuses the redirect and the email link goes nowhere.

**Signing an Android release.** `./build.sh release` produces an unsigned APK,
because a keystore is not something a build script should invent. To sign one:

```bash
keytool -genkey -v -keystore bokea.keystore -alias bokea \
        -keyalg RSA -keysize 2048 -validity 10000

"$ANDROID_HOME/build-tools/36.0.0/apksigner" sign \
  --ks bokea.keystore --out dist/Bokea-1.0.0.apk \
  dist/Bokea-1.0.0-release-unsigned.apk
```

Keep the keystore somewhere safe and out of the repository - `.gitignore`
already refuses `*.keystore`. Losing it means never being able to update the
app on the Play Store again.

**Signing an iOS release.** `./build.sh ios` and the CI workflow both produce an
*unsigned* archive, for the same reason: signing needs an Apple Developer
account, a team ID and a provisioning profile, and none of those belong in a
repository. An unsigned archive still proves the project compiles and links and
carries the right icons, bundle id and `Info.plist`.

To export an `.ipa`, on a Mac with an account set up, put the team ID into
Xcode (**App → Signing & Capabilities → Team**) and then:

```bash
xcodebuild -exportArchive \
  -archivePath dist/Bokea.xcarchive \
  -exportOptionsPlist ExportOptions.plist \
  -exportPath dist/
```

`ExportOptions.plist` names the method (`app-store`, `ad-hoc`, `development`)
and the team ID. It is gitignored, along with `*.mobileprovision` and `*.p12`.

## Checking it

```bash
npm test
```

Serves `www/` the way Capacitor serves it from the app bundle, opens it with a
stand-in for the native side that writes down every plugin call instead of
making one, and then asks the questions that are worth asking without a phone
in the room: does Back close the modal, does the theme reach the status bar,
does a reset link leave as `bokea://auth`, is a task due this afternoon
actually scheduled.

**The whole suite is run twice, once as each platform.** That is the only way
the parity this project is built on can be checked at all - a difference is a
bug whether it shows up as something missing on iOS or as something Android-only
leaking into it, and both are invisible if only one is ever run. So the iOS pass
also checks the negatives: that no gesture bar is looked for, that Back does not
try to close the app, that the keyboard is told the theme.

It needs Playwright's browsers. If `playwright-core` is not installed here:

```bash
PLAYWRIGHT_CORE=/path/to/playwright-core npm test
```

## The app icons

Both apps draw their mark from `Bokeà/wwwroot/assets/icon.svg`, and neither
keeps a second drawing of it.

- **Android** renders the vector on the device, from `ic_bokea_logo.xml` and
  `ic_bokea_tick.xml` in `android/app/src/main/res/drawable`.
- **iOS** wants PNGs, so `npm run assets:ios` draws them: every size from 20pt
  to 1024pt into `AppIcon.appiconset`, and the launch mark into
  `Splash.imageset`. The output is committed, so this only needs running when
  the mark changes.

The app icon is drawn **full-bleed with square corners and no alpha**: iOS
rounds the corners itself and rejects an icon that arrives already rounded or
carrying transparency. The launch mark keeps its rounded corners, because the
launch screen sits it on `#09090b` exactly as Android's `splash.xml` does.

## Reminders, exactly

Reminders are scheduled **inexactly on Android**: it fires them in the next idle
window near the time asked for, usually within a few minutes. That needs no
permission and never interrupts anybody. iOS has no such distinction and fires
at the time it is given.

Exact Android alarms are possible and would be to the minute, but on Android 12
and up they open the *Alarms & reminders* settings screen, and would do it again
on every sync until granted. If that trade is worth it:

1. delete the `SCHEDULE_EXACT_ALARM` line from
   `android/app/src/main/AndroidManifest.xml` (it is there to take the
   permission back out)
2. set `EXACT_REMINDERS = true` in `src/bridge/mobile-bridge.js`

iOS caps an app at 64 pending notifications. `REMINDER_LIMIT` is 24, well
inside it.

## Layout

```
mobile/
├── build.sh                    the whole build, start to APK or archive
├── capacitor.config.ts         app id, splash, system bars, keyboard, notifications
├── scripts/
│   ├── sync-web.mjs            wwwroot -> www, with the CDN files brought along
│   └── make-ios-assets.mjs     icon.svg -> the iOS asset catalogue
├── src/bridge/mobile-bridge.js the only file that knows about Capacitor
├── tests/bridge.mjs            the bridge, run against the real app, as both platforms
├── android/                    the native project (committed; Gradle output is not)
├── ios/                        the Xcode project (committed; Pods and build output are not)
│   └── App/App/BokeaViewController.swift   the WKWebView settings with no config key
├── www/                        generated. Not committed, not edited
└── dist/                       the APKs and the .xcarchive
```

## If something is wrong

**A white flash on launch, or a splash that never goes.** The splash is hidden
by the bridge on `load`, with a 4 second stop. Something threw before `load`:
look for a page error in `adb logcat -s Capacitor:* chromium:*`, or in Safari's
Web Inspector for the iOS app.

**Content under the status bar or behind the Dynamic Island.**
`viewport-fit=cover` has to be in the viewport meta tag in
`Bokeà/wwwroot/index.html`, and the phone styles have to keep using
`env(safe-area-inset-*)`. If iOS looks doubly padded instead, something has set
`ios.contentInset` back to `'automatic'`.

**No reminders.** Check the phone's own switch first (Settings → Apps → Bokeà →
Notifications on Android, Settings → Bokeà → Notifications on iOS), then the
switch in the app's Settings, then `window.BokeaNative.syncReminders()` in a
remote debugger, which reschedules everything and reports what it did.

**`xcodebuild` says there is no scheme named App.** The shared scheme lives at
`ios/App/App.xcodeproj/xcshareddata/xcschemes/App.xcscheme` and is committed for
exactly this reason - Xcode otherwise writes one per user, into the gitignored
`xcuserdata`, and a machine that has never opened the project in Xcode finds
nothing. Check it was not deleted by a `cap add ios`.

**CocoaPods errors about the workspace.** `pod install` in `ios/App` rebuilds
it. `npm run clean` removes `Pods/` and the build output on the way.

**Debugging the page itself.** An Android debug build is inspectable from
`chrome://inspect` in Chrome, with the phone plugged in. The iOS app is
inspectable from Safari → Develop → *device* → Bokeà, with **Web Inspector**
turned on in Settings → Safari → Advanced on the phone.
