# Bokeà for Windows

The Bokeà website as a Windows 11 desktop app. It runs the website's own HTML, CSS and
JavaScript in **WebKit**, the engine behind Safari. That way it looks and works the same as
the website, and it is not built on Chromium. [PLAN.md](PLAN.md) explains why this
approach was chosen over the alternatives, and [PERFORMANCE.md](PERFORMANCE.md) says where
the time and the bytes go.

```
Bokea.exe     18 MB   the Windows host (window, notifications, downloads, dialogs)
runtime\     175 MB   the WebKit engine
web\           3 MB   a copy of Bokeà/wwwroot, with its fonts and scripts bundled
```

## Installing

- **Installer:** run `Bokea-Setup-<version>.exe` (about 48 MB). It installs for your
  Windows account only, with no administrator prompt. It adds Bokeà to the Start menu and
  to Settings → Apps.
- **Portable:** unzip `Bokea-<version>-win-x64.zip` anywhere and run `Bokea.exe`.

The app is not code-signed yet, so the first time it runs Windows may show *"Windows
protected your PC"*. Choose **More info → Run anyway**.

## Building

You need the [.NET 10 SDK](https://dotnet.microsoft.com/download). The first build
downloads the WebKit engine (63 MB, checked against a pinned sha256) plus the site's
fonts and scripts. They are cached in `build/cache`, so later builds work offline.

| On | Run | Installer |
| --- | --- | --- |
| Windows | `powershell -ExecutionPolicy Bypass -File build.ps1` | Built automatically when [Inno Setup 6](https://jrsoftware.org/isinfo.php) is installed |
| Linux / macOS | `./build.sh` | `ISCC="wine /path/to/ISCC.exe" ./build.sh` |

Everything lands in `dist/`. Set `BOKEA_VERSION` (or pass `-Version` to `build.ps1`) to
stamp a version number.

### After changing the website

Run the build again. Each build copies `Bokeà/wwwroot` afresh, so the desktop app itself
never needs editing to pick up website changes. The build only reads the website and
never writes to it.

## Using it

It behaves like the website in a browser tab, with these additions:

| Keys / mouse | Does |
| --- | --- |
| F5, Ctrl+R | Reload (Ctrl+Shift+R reloads without the cache) |
| Ctrl + / − / 0, Ctrl + mouse wheel, touchpad pinch | Zoom in / out / reset |
| Alt+← / Alt+→, mouse back/forward buttons | Back / forward |
| F11 | Full screen |

- **Notifications** (a missed task marked "This one really matters") appear as Windows
  notifications. Clicking one opens the task. You can turn them off in Windows Settings →
  System → Notifications.
- **Save a copy** writes the backup straight to your Downloads folder under the same name
  the website uses.
- **Links to other websites** open in your default browser.
- Opening Bokeà again while it is already open brings the existing window forward.

### Where your data lives

`%LOCALAPPDATA%\Bokea\` holds:

- `WebKit\`: the app's storage. It holds your sign-in and, in "no account" mode, all your
  tasks.
- `settings.json`: window position, zoom level and the last theme colour.
- `logs\bokea.log`: startup problems and page script errors.

Upgrading or uninstalling leaves this folder alone. Delete it to remove everything.

### Command-line options

| Option | Use |
| --- | --- |
| `--devtools` | Enables the Web Inspector (F12, or Ctrl+Shift+I) |
| `--open=/settings` | Opens at a route |
| `--data-dir=<folder>` | Uses another data folder, e.g. for a second profile. To run two profiles side by side, give the second one a `--port` as well: one port allows one window |
| `--port=<n>` | Development only. A different port is a different origin, so it starts with empty storage |

## One Supabase setting for password-reset emails

The website asks Supabase to send reset links back to the page they came from. In the
desktop app that page is `http://127.0.0.1:47819`. Add it once in the Supabase dashboard
under **Authentication → URL Configuration → Redirect URLs**:

```
http://127.0.0.1:47819/**
```

- **With it added:** the emailed link opens in your browser, which hands it straight to the
  Bokeà window. The browser tab then says so and can be closed.
- **Without it:** Supabase sends the link to the website's own address instead. The reset
  still works there, and you then sign in to the desktop app with the new password.

## How it works

- `src/Bokea.Desktop` is a small Win32 program. It calls WebKit's C API directly through
  P/Invoke and uses no UI framework.
- It serves `web\` from `http://127.0.0.1:47819` (loopback only), with the same routing as
  `vercel.json`. The address is fixed because the page's storage belongs to it.
- `Resources/bridge.js` is injected into the page. It only reports back: the page's
  background colour, used for the title bar, and script errors, used for the log.
- The host handles what a browser would: notifications, downloads, file pickers,
  `confirm()`/`alert()`, and external links.
- `tools/Packager` holds the build steps. `tools/webkit-slots.py` regenerates the C API
  struct offsets when the engine is updated.
- **The website's service worker runs here too**, so the app behaves the way the website
  does. Its pre-cache list names the fonts and scripts by their CDN addresses; the build
  rewrites those to the bundled copies, because that list is fetched in one all-or-nothing
  go and would otherwise fail to install on a machine with no network.
- **Fonts are bundled as static files.** The website loads Google's variable versions of
  Inter, Outfit and Playfair Display. The build instead asks Google Fonts for its static
  file per weight. It is the same typeface at the same weights, but WebKit on Windows draws
  web fonts through DirectWrite, and static files need nothing special from it to show
  each weight correctly.

## Testing

- `tests/render-parity.js` renders the same screens twice and saves both, plus a diff:
  - by default, Chromium and WebKit (same engine revision) on the bundled copy;
  - with `COMPARE=source`, the deployed website against the bundled copy.

  It covers all nine screens at three widths, and stops rather than carrying on if a
  scenario cannot reach its screen. See the header comment in the file for how to run it.
- `tests/load-cost.js` reports where one cold page load goes: paint and load times, and
  every file the app server hands over, with its size. Same engine, same routing and
  headers as the app.
- `tests/wine/*.js` drive a test build through local mode, notifications, downloads,
  dialogs, storage persistence and font weights. Build it with `dotnet publish
  -p:BokeaTestHooks=true`, then set `BOKEA_TEST_SCRIPT` to one of the scripts. Normal
  builds do not contain this hook.

### Already checked

These were checked under Wine 11 on Linux, running the same Windows binaries the
installer ships:

- It starts, and renders the sign-in screen and the local-mode dashboard.
- At 150% scaling, a 1890×1020 window gives the page a 1260×680 viewport with
  `devicePixelRatio` 1.5, and the layout fills the window.
- Every font weight draws at its own width, matching Chromium to within a pixel.
- A notification reaches the Windows notification area.
- `<a download>` saves into Downloads under the page's file name.
- `confirm()` shows a Windows dialog and returns the choice.
- A link handed over from a browser opens in the app window.
- A second launch exits and leaves the first window open.
- Closing the window writes storage first: a value set just before closing is there after
  a restart.
- The app server routes like `vercel.json`. It refuses foreign Host headers, path
  traversal and hand-offs from other sites.
- The installer installs per user without an admin prompt and adds the Start menu entry
  and the uninstall entry. Uninstalling removes both.

Wine cannot show some things correctly, and these are not app bugs:

- WebKit's web process calls a memory API that Wine does not implement and stops after
  about 30 seconds.
- Wine's DirectWrite cannot draw variable fonts, which is why the fonts are bundled static.
- Wine has no Segoe UI, so the browser-default button font looks different.

Everything else is on the checklist below.

### Checklist for a real Windows 11 machine

- [ ] The installer runs without an admin prompt, and Bokeà appears in Start.
- [ ] At 100%, 125% and 150% display scaling, text is crisp and the layout fills the window.
      Dragging the window to a monitor with a different scale keeps it right.
- [ ] Log in, tick a task and restart the app: still signed in, and the tick is kept.
- [ ] "Just let me start — no account", add a task, restart: the task is still there.
- [ ] The light/dark theme switch recolours the title bar too.
- [ ] Mark a task "This one really matters" and let it go overdue: a Windows notification
      appears, and clicking it opens the task.
- [ ] Settings → Save a copy: the file appears in Downloads.
- [ ] Profile → change picture: the Windows file picker opens with image files.
- [ ] Opening Bokeà a second time focuses the first window.
- [ ] Uninstall from Settings → Apps; `%LOCALAPPDATA%\Bokea` is still there.

## Updating the WebKit engine

1. Change `Revision`, the URL and `ZipSha256` in `tools/Packager/Program.cs`. Playwright
   lists its builds in `playwright-core/browsers.json`.
2. Run `python3 tools/webkit-slots.py <upstream WebKit commit>` and copy any changed
   numbers into `src/Bokea.Desktop/Native/WebKit.cs`.
3. Build, run `tests/render-parity.js`, and go through the Windows checklist.

## Troubleshooting

| Problem | Fix |
| --- | --- |
| "another program is using port 47819" | Something else has taken that port. Close it, or run with `--port=` for testing |
| Window stays blank | Read `%LOCALAPPDATA%\Bokea\logs\bokea.log`; run with `--devtools` and press F12 |
| "missing some of its files" | Antivirus may have quarantined part of `runtime\`. Reinstall |
