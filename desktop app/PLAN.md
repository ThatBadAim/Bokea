# Bokeà for Windows 11: desktop app plan

## The two rules

1. **It works and looks exactly like the website.**
2. **It is not built on Chromium.**

Two more rules come from common sense: the browser version (`Bokeà/wwwroot`) is never
edited, and nothing is pushed to GitHub.

Rule 2 excludes more than Electron. On Windows, every one of these runs Chromium:
Electron, Tauri (WebView2), CEF/CefSharp, NW.js, Photino, Wails, Neutralino and .NET MAUI
Blazor Hybrid. WebView2 *is* Edge's Chromium, even though it isn't bundled.

## Decision: run the website's own code in WebKit

The website is about 10,300 lines of JavaScript, 9,500 lines of CSS and 1,800 lines of
HTML. A native rewrite (WPF, WinUI, Avalonia) could only ever look *similar*, and it would
fall further behind every time the website changes. The only way to meet rule 1 is to run
the same HTML, CSS and JavaScript. That means the question is which non-Chromium engine
to embed.

| Engine | Verdict | Why |
| --- | --- | --- |
| **WebKit, Windows port** (Playwright build r2359 ≈ Safari 26.6) | **Chosen** | A current engine, so it supports everything the site uses: `:has()`, `dvh`, `backdrop-filter`, `text-wrap`, time inputs and file inputs. It is open source (LGPL/BSD), ships as prebuilt binaries, and has a complete embedding C API. |
| Ultralight 1.4 (Safari 16.4) | Rejected | It has no `<input type="time">`, which the site uses eight times. It also lacks file inputs, WebSockets and notifications, and its licence is proprietary with a revenue cap. |
| Servo 0.1 | Rejected | It is too young: CSS and form controls still have gaps, and its Windows build needs Visual Studio. |
| Gecko (Firefox) | Rejected | It has no embedding API on Windows. |
| Sciter | Rejected | Its HTML/CSS/DOM is non-standard, so the site would not render the same. |

## Architecture

```
Bokea.exe  (.NET 10, trimmed single file, ~13 MB, no WinForms/WPF)
│
├── Win32 window
│     per-monitor DPI, title bar colour follows the app's theme,
│     remembers size and position, single instance
│
├── WebKit view  (P/Invoke into the WebKit C API: WKView, WKPage, WKContext)
│     WebKit2.dll · WebCore.dll · JavaScriptCore.dll
│     WebKitWebProcess.exe · WebKitNetworkProcess.exe · WebKitGPUProcess.exe
│
├── App server   http://127.0.0.1:47819  (loopback only)
│     serves a copy of Bokeà/wwwroot plus bundled fonts, Lucide and supabase-js,
│     with the same SPA fallback as vercel.json
│
└── Desktop bridge
      Notification API  → Windows notification
      downloads         → Downloads folder
      file inputs       → Windows open-file dialog
      alert/confirm     → Windows dialog
      external links    → default browser
```

**Why a fixed loopback address.** localStorage is keyed by origin, so the origin has to
be the same on every launch or the user's data would vanish. An `http://` origin also
behaves like the website: absolute paths such as `/sw.js` resolve, and history routes
like `/settings` work.

**Why it bundles the web files instead of loading the live site.** The app starts with
no network and local mode works fully offline. The version that runs is the version that
was tested. One build command re-copies `Bokeà/wwwroot`, so bringing the desktop app up to
date with the website takes a single rebuild.

**Why .NET.** All native code is reached through P/Invoke, so no C/C++ compiler or Windows
SDK is needed. The app cross-compiles from Linux or builds on Windows with one `dotnet
publish`. It is also the language the repo's backend already uses.

## Folder layout

```
desktop app/
  PLAN.md                     this file
  README.md                   build, run, install, update, troubleshoot
  build.sh / build.ps1        one-command build (Linux / Windows)
  src/Bokea.Desktop/          the host program
    Program.cs                startup, single instance, engine run loop
    AppWindow.cs              the Win32 window, the WebKit view and every page callback
    AppServer.cs              loopback static server and auth hand-off
    Dialogs.cs                file picker and the Downloads folder
    TrayNotifications.cs      the page's notifications as Windows notifications
    Support.cs                paths, options, log, settings
    Native/                   Win32, WebKit and JavaScriptCore bindings
    Resources/bridge.js       injected into the app window: theme colour, script errors
    Resources/handoff.js      injected only when a browser lands on this server
  tools/
    Packager/                 the build steps: web, webkit, stage, zip
    webkit-slots.py           regenerate the C API struct offsets for a new engine
  installer/Bokea.iss         Inno Setup script (per-user, no admin)
  tests/                      render-parity and the Wine bridge checks
  dist/                       build output (git-ignored)
```

## Parity: website feature → desktop behaviour

| Website | Desktop |
| --- | --- |
| Supabase sign-in and data | Unchanged, same project, same calls |
| localStorage / sessionStorage | Kept in `%LOCALAPPDATA%\Bokea\WebKit`, survives restarts |
| Routes (`/settings`, `/patterns`…) and Back/Forward | App server SPA fallback, mouse back/forward buttons, Alt+←/→ |
| `new Notification(...)` for missed commitments | Windows notification; clicking it focuses the window and runs the page's `onclick` |
| "Save a copy" backup (an `<a download>`) | Written to the Downloads folder under the same file name, so the on-screen wording stays true |
| Profile picture / file pickers | Windows open-file dialog, honouring `accept` |
| `window.confirm` (moving guest tasks into an account) | Windows OK/Cancel dialog |
| Fonts, Lucide icons, supabase-js | Bundled at the exact versions `index.html` pins, so the app looks right offline |
| Pinch/Ctrl zoom, F5 reload | Ctrl +/−/0 zoom, F5 / Ctrl+R reload |
| Password-reset email link | See "Auth links" below |
| Web Push | Not available, the same as a browser without PushManager. The website can't send pushes yet either (NEXT-STEPS §4). |

**Auth links.** The website passes `window.location.origin` as the reset link's return
address. In the desktop app that origin is `http://127.0.0.1:47819`.

- **If that address is added** to Supabase → Authentication → URL Configuration →
  Redirect URLs, the link opens in the browser, reaches the running app's server and is
  handed into the app window. The browser tab then says to go back to Bokeà.
- **If it is not added**, Supabase sends the link to the website instead. The reset still
  works; you then sign in to the desktop app with the new password.

The hand-off endpoint only accepts same-origin POSTs with a valid Host header, so other
websites can't use it.

## Build and packaging

1. `Packager webkit` downloads WebKit r2359 for win64 (pinned, sha256-checked). It keeps
   only the DLLs the engine actually loads, found by walking the import tables, and drops
   the test browser and the binaries nothing imports.
2. `Packager web` copies `../Bokeà/wwwroot` to `build/web` and downloads the Google Fonts,
   Lucide and supabase-js files it references, from the HTML and from the service worker's
   pre-cache list alike. It rewrites those URLs **in the copy only**.
3. `dotnet publish -r win-x64` builds `Bokea.exe`, a trimmed, ReadyToRun single file.
4. Output:
   - `dist/Bokea-win-x64/`: a portable folder
   - `dist/Bokea-win-x64.zip`
   - `dist/Bokea-Setup.exe`: an Inno Setup installer. It installs per user without admin,
     adds a Start menu entry and an optional desktop shortcut, and appears in Settings →
     Apps with an uninstaller.

**Size, measured.** `Bokea.exe` is 18 MB and the web files 3 MB. The WebKit runtime is the
bulk: 175 MB on disk after dropping the test browser and the nine DLLs nothing imports.
That makes 195 MB installed, from a 48 MB installer. It uses no Node.js and no Chromium.
The runtime is large mainly because of WebCore (58 MB), JavaScriptCore (33 MB) and ICU's
data table (32 MB).

## Verification

1. **Engine parity.** Playwright renders every screen in Chromium (the website as most
   people see it) and in WebKit r2359, the same engine revision as the desktop app. It
   compares screenshots at three widths. If a screen differs because of the engine, a
   desktop-only compatibility stylesheet makes WebKit match. None is added unless a diff
   shows the need.
2. **The host on Windows APIs.** Run the built `Bokea.exe` under Wine 11. Check that it
   starts, loads, keeps data across restarts, and that the bridge works: notification,
   download, file picker, confirm, external link and single instance.
3. **A real Windows 11 checklist** in README.md, for what Wine can't prove: GPU
   compositing, how notifications look, the installer, and SmartScreen.

## Results (2026-09-15)

Built as planned, with two changes found during testing:

- **Static web fonts.** WebKit on Windows draws web fonts through DirectWrite. Under Wine
  the website's variable fonts drew every weight identically. The build now bundles
  Google's static file per weight: the same typefaces, with nothing left to the platform.
  Measured afterwards, each weight matches Chromium to within a pixel.
- **The window's size is handed to WebKit in logical pixels.** Playwright's build of the
  engine stopped doing that conversion itself. At 150% the page now gets a 1260×680
  viewport in a 1890×1020 window, at `devicePixelRatio` 1.5.

Beyond those, three safeguards were added:

- Closing the window waits for the engine to write storage, so a local-mode task ticked
  just before closing is kept. The same happens on Windows sign-out or shutdown.
- The loopback server rejects foreign Host headers (DNS rebinding), path traversal, and
  hand-offs posted by other sites.
- A test-only build hook (`-p:BokeaTestHooks=true`) lets scripts drive the app end to end.

Everything in the parity table was exercised under Wine 11 except clicking a notification,
the file picker and the Windows 11 title-bar colour, which need a real machine. See
README.md, "Already checked", and the checklist there.

## Review (2026-09-16)

All nine screens — Today, Everything, Patterns, Calendar, Profile, Settings, the welcome
screen, dark Today and the new-task modal — were rendered in both engines at 1280, 900 and
420 px wide. **No compatibility stylesheet is needed.** Chromium and WebKit differ by
0.2–2.9% of pixels, and looking at the pairs, all of it is text antialiasing, the native
`<select>` control, and the scrollbar Chromium is made to draw for these shots. Layout,
spacing and colour match. The build's own rewriting of the copy changes nothing: rendered
side by side in the same engine, the website and the bundled copy differ by at most two
pixels on any screen, and by none at all on most.

Three things were found and fixed:

- **The service worker still asked for its fonts and scripts from the CDNs.** The build
  rewrote the HTML but not the JavaScript, so `sw.js` kept a pre-cache list of three
  absolute CDN addresses. `cache.addAll` is all-or-nothing, so on a machine with no
  network — the case this app is built for — the worker failed to install on every
  launch. The `web` step now rewrites addresses in the copy's scripts too, matching a
  pinned version against a floating one (`lucide@latest`, `supabase-js@2`).
- **The parity test never opened the Patterns screen.** It looked for
  `[data-tab="patterns"]`, but that screen's nav button is `data-tab="analytics"`, and a
  tab that could not be found was skipped in silence — so three of its screenshots were
  the Today screen saved under another name, and they matched. The test now stops when a
  scenario cannot reach its screen, and it also covers Everything and Calendar, which
  were not in the list at all.
- **A bad `--data-dir` killed the app before the log existed.** Options were parsed
  outside the guarded part of startup, so `--data-dir=` with nothing after it ended the
  process with no window and no message. Both parsing and the data folder now report
  what went wrong.

Also checked and correct as they stand: every hand-written WebKit client slot number and
callback signature, against the engine's own headers at the pinned revision; the loopback
server's routing against `vercel.json`, and its Host, origin and path-traversal guards;
that swallowing the mouse back/forward buttons cannot strand WebKit's mouse capture,
because that engine's Windows view does not handle those buttons at all.

## Known limits

- The WebKit Windows port is less battle-tested than Chromium on Windows. The binaries are
  Playwright's build of upstream WebKit. The revision is pinned, and the version can be
  bumped with one variable in `fetch-webkit.sh`.
- The exe is unsigned, so SmartScreen will show "unknown publisher" until it is
  code-signed.
- Web content is fixed at build time. Rebuild after website changes: `./build.sh`.
