# Bokeà for Windows: performance

First pass, 16 September 2026. It answers three questions — how long the app takes to be
usable, what it costs to keep open, and how much of what it ships is doing any work — and
says plainly which parts are measured and which are still guesses.

**The short version.** Once the engine is up, the page is not the problem: it is ready in
under a tenth of a second and costs almost nothing to leave open. Two things are worth
doing. One is a bug: the host never tells the engine the window has been minimised, so the
website's own power saving never switches on. The other is weight: over half of what the
app serves is a 428 KB icon library it uses 60 icons out of.

## How this was measured

`tests/load-cost.js` serves the built copy (`build/web`) with the same routing and the same
headers as `AppServer.cs` — no compression, `no-cache` with an ETag — and loads it in
WebKit 26.6, the desktop app's own engine revision, driven through Playwright. Numbers
below are the median of five cold loads, each in a fresh context. A Chromium run is shown
beside them as the reference for how most people see the website.

```
PLAYWRIGHT_CORE=<path> RUNS=5 node tests/load-cost.js                # the app's engine
PLAYWRIGHT_CORE=<path> RUNS=5 ENGINE=chromium node tests/load-cost.js
```

Everything here was measured on Linux, because that is the machine this work was done on.
That is fine for the page — it is the same engine build, the same bytes and the same
server behaviour — and not fine for the parts that are Windows: process startup, DLL
loading, memory and the compositor. Those are listed at the end, unmeasured, rather than
estimated.

## Page load

|                        | WebKit 26.6 | Chromium 153 |
| ---------------------- | ----------- | ------------ |
| DOM interactive        | 27 ms       | 40 ms        |
| First contentful paint | 63 ms       | 68 ms        |
| DOMContentLoaded       | 59 ms       | 63 ms        |
| load                   | 67 ms       | 65 ms        |
| Web fonts settled      | 281 ms      | 173 ms       |
| Reload (F5)            | 67 ms       | 65 ms        |

The two engines are within a few milliseconds of each other, so nothing about running the
site in WebKit rather than Chromium costs the user time. The page is interactive well
before the fonts arrive; the gap between `load` and fonts settling is the only visible
delay, and it is the same delay the website has in a browser. (WebKit reports no
`first-paint` entry, only `first-contentful-paint`, so that row is blank in its output.)

`no-cache` with an ETag is the right choice for this server and should stay: on a reload,
15 of the 17 files come back as a 304 over loopback, which costs nothing measurable, and it
means a rebuilt `web\` folder is never served stale from the engine's cache.

## What a cold load pulls

17 files, **1,605 KB**, none of it compressed (it does not need to be — it is a loopback
socket reading from local disk).

| | Files | Bytes |
| --- | --- | --- |
| Script | 6 | 1,063 KB |
| Stylesheet | 2 | 256 KB |
| Font (woff2) | 7 | 161 KB |
| Document | 1 | 124 KB |

The four largest files are 1,252 KB of the 1,605 KB:

| | |
| --- | --- |
| `/vendor/lucide@1.45.0.js` | 428 KB |
| `/js/app.js` | 390 KB |
| `/css/style.css` | 221 KB |
| `/vendor/supabase-js@2.116.0.js` | 213 KB |

The page settles at 1,310 elements and 1,199 CSS rules.

## What it costs to leave open

Measured over 90 seconds of an untouched Today screen in local mode:

- Three repeating timers: 5 s (the clock and the "now" marks), 30 s, 60 s (the background
  refresh).
- 22 firings in 90 seconds, **24 ms of main-thread time in total — 0.03% of one core**.
- No network calls at all in local mode.

**Idle cost is a non-issue. Nothing here needs optimising.** It is worth saying so
explicitly, because the one real problem nearby looks like the same thing and is not.

## Finding 1: minimising the window does not quiet the app

The website throttles itself on visibility. `app.js` line 7270:

```js
function refreshDashboardInBackground() {
    if (document.visibilityState !== 'visible') return;
```

In a browser, minimising the window or switching tabs makes that `hidden` and the
once-a-minute refresh stops. In the desktop app it never becomes `hidden`, so for a
signed-in user **Bokeà keeps asking Supabase for the dashboard every 60 seconds for as long
as the app is open, minimised or not** — and the engine keeps the page fully live rather
than throttling its timers and easing off the process.

The cause is in the engine, and upstream already knows. WebKit's Windows view learns it is
hidden only from a `WM_SHOWWINDOW` sent to its own window, and ignores the one Windows
sends when an ancestor is minimised (`Source/WebKit/UIProcess/win/WebView.cpp`):

```cpp
// FIXME: Since we don't get notified when an ancestor window is hidden or shown, we will
// keep painting even when we have a hidden ancestor. <http://webkit.org/b/54104>
if (!lParam)
    setIsVisible(wParam);
```

The WebKit view in Bokeà is a child of the app's top-level window, which is exactly the
case that FIXME describes. `AppWindow.Create` calls `WKViewSetIsInWindow(_view, 1)` once
and never revisits it.

**The fix**, roughly a screen of code in `AppWindow.HandleMessage`: notice
`WM_SIZE`/`SIZE_MINIMIZED` and `WM_SHOWWINDOW` on the top-level window, and pass the state
down to the view — either through `WKViewSetIsInWindow`, or by forwarding a
`WM_SHOWWINDOW` with `lParam` 0 to the view's own window, which reaches the engine's
`setIsVisible` directly. It is small, but it changes when the engine paints, so it should
not ship until it has been watched on a real Windows machine: minimise, restore, and check
the page comes back rather than staying blank.

## Finding 2: 428 KB of icons for 60 of them

`vendor/lucide@1.45.0.js` is the largest single file the app serves — bigger than the
app's own JavaScript. Loaded and counted, it defines **2,094 icons**. The app names **59**
of them in markup and source, plus ten places where the name is computed at run time, and
every one of those comes from a table in `app.js` whose values are also in that 59. So the
full set of icons Bokeà can ever draw is known at build time.

That means roughly **97% of the file is never used**, and it is not dead weight only on
disk: the engine parses and executes the whole thing on every cold start.

This is a desktop-build change, not a website change. The `web` step already rewrites the
copy's references to its own bundled files; it could emit a generated icon file holding
only the names the source mentions, and fail the build if a name it cannot find statically
appears. Expected saving: around **400 KB of the 1,063 KB of script**, with no visible
difference. The same step would then be catching a real risk it does not catch today — an
icon name misspelt in `app.js` currently just draws nothing.

## Finding 3: `supabase-js` is loaded and started even with no account

`index.html` loads `supabase-js` (213 KB) with a plain blocking `<script>` before
`app.js`, and `app.js` line 13 creates the client as soon as it runs:

```js
if (window.supabase && window.ENV && ... window.ENV.isConfigured()) {
    supabaseClient = window.supabase.createClient(...);
```

Neither is conditional on being signed in, so someone who chose "Just let me start — no
account" pays for all of it and uses none of it. This is the website's structure rather
than anything the desktop build introduced, and changing it means changing
`Bokeà/wwwroot`, which is out of bounds for this app. Recording it here because it is the
second-largest thing on the list and the desktop app is where it is most visible: on the
website it is one blocking request among several, here it is a fifth of everything the app
reads at startup.

## Finding 4: the stylesheet is mostly not matching

`css/style.css` is 221 KB, and driving every screen — Today, Everything, Patterns,
Calendar, Profile, Settings and the new-task modal — matched **28% of it**. Treat that as a
signal, not a verdict: the account was empty, so the rules for task rows, hover, focus,
error and drag states never had anything to match. The real figure is higher and unknown.
Worth a proper measurement against an account with data before anyone acts on it, which is
why it is last.

## Still to measure, and it needs Windows

Everything above is the page. The parts the desktop app adds are unmeasured, and they are
very likely the larger share of the time between double-clicking the icon and seeing
Today:

- **Startup, end to end.** `Bokea.exe` is an 18 MB trimmed, ReadyToRun single file; then
  the engine maps 38 DLLs, the four largest being WebCore (58 MB), JavaScriptCore (33 MB),
  ICU's data table (32 MB) and WebKit2 (19 MB), and starts three helper processes. Worth
  timing from process start to first paint, cold (after a reboot) and warm.
- **Memory.** Sampled on Linux with the page loaded, the same engine revision came to
  about 708 MB of RSS across three processes, most of it the web process. That number is
  not transferable — a different port, a different rendering path, and Linux RSS counts
  shared library pages — but it is large enough to be worth measuring properly on Windows
  before anyone is told what to expect.
- **The compositor.** Whether the GPU process is doing real work on Windows 11, and what
  scrolling and the theme transition cost at 100%, 125% and 150% scaling.
- **The first service-worker install**, which fetches the whole pre-cache list a second
  time on the first launch after an update.
- **The loopback server under a reload storm.** It handles one request per task with no
  connection cap; nothing suggests this matters at 17 files, but it has not been pushed.

## Order to do them in

1. **Finding 1**, the visibility bug — it is a correctness problem as much as a
   performance one, and it is the only thing here that costs the user something every day.
2. **Measure Windows startup.** Without it, the rest is guesswork about where the time
   actually goes.
3. **Finding 2**, subsetting the icons — a clean 400 KB, entirely inside the desktop
   build, with a build-time check thrown in.
4. Findings 3 and 4 only if step 2 shows page load matters at all next to engine startup.
