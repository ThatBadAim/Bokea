# Graph Report - Bokea  (2026-09-16)

## Corpus Check
- 76 files · ~211,077 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1243 nodes · 2368 edges · 93 communities (70 shown, 9 thin omitted)
- Extraction: 94% EXTRACTED · 6% INFERRED · 0% AMBIGUOUS · INFERRED: 136 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `d001af0f`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- applyTaskFormState
- calDateStr
- app.js
- DueDateType
- loadDashboardData
- .GetMorningDigestAsync
- ProfileAboutRequest
- loadProfileIntoForm
- User
- onboarding.js
- TaskItem
- a11y.js
- calculateTaskState
- PushSubscription
- AppDbContext
- TaskWatchdogService
- initSetupPageListeners
- android/package.json
- http
- Bokea.csproj
- Win32
- manifest.json
- AppWindow
- AppServer
- Next steps — sync fixes (13 Sep 2026)
- vercel.json
- TaskState
- WebAssets
- sw.js
- Agent Instructions & Guidelines
- Bokeà for Windows: performance
- .RestorePlacement
- .HandleMessage
- .application
- .MapTaskEndpoints
- ios/package.json
- render-parity.js
- Settings
- WebKit.cs
- load-cost.js
- toggleRowMenu
- AuthEndpoints.cs
- AuthEndpoints
- Bokea.Database
- applyRemotePreferences
- .Main
- SetupRequest
- PushEndpoints.cs
- DigestTaskDto
- commitCapture
- Resources/bridge.js
- Bokeà Mobile Apps
- android/src/bridge/mobile-bridge.js
- Sector
- ios/src/bridge/mobile-bridge.js
- MainActivity.java
- webkit-slots.py
- IntervalType
- build.sh script
- .MapDigestEndpoints
- Bokea.Desktop.csproj
- Packager.csproj
- android/scripts/sync-web.mjs
- make-ios-assets.mjs
- ios/scripts/sync-web.mjs
- android/tests/bridge.mjs
- android/build.sh
- ios/tests/bridge.mjs
- TrayNotifications
- Support.cs
- .Warn
- Paths
- .OpenFiles
- Options
- .OnDecideDownloadDestination
- gradlew
- ios/build.sh
- android/capacitor.config.ts
- ios/capacitor.config.ts

## God Nodes (most connected - your core abstractions)
1. `Win32` - 71 edges
2. `AppWindow` - 65 edges
3. `TaskItem` - 34 edges
4. `User` - 31 edges
5. `AppServer` - 28 edges
6. `loadDashboardData()` - 23 edges
7. `calDateStr()` - 23 edges
8. `AppDbContext` - 19 edges
9. `renderNextUpTask()` - 19 edges
10. `showToast()` - 19 edges

## Surprising Connections (you probably didn't know these)
- `AppDbContext` --references--> `PushSubscription`  [EXTRACTED]
  Bokeà/Database/AppDbContext.cs → Bokeà/Database/Models.cs
- `AppDbContext` --references--> `TaskCompletionLog`  [EXTRACTED]
  Bokeà/Database/AppDbContext.cs → Bokeà/Database/Models.cs
- `AppDbContext` --references--> `TaskItem`  [EXTRACTED]
  Bokeà/Database/AppDbContext.cs → Bokeà/Database/Models.cs
- `AppDbContext` --references--> `User`  [EXTRACTED]
  Bokeà/Database/AppDbContext.cs → Bokeà/Database/Models.cs
- `DigestService` --references--> `AppDbContext`  [EXTRACTED]
  Bokeà/Services/DigestService.cs → Bokeà/Database/AppDbContext.cs

## Import Cycles
- None detected.

## Communities (93 total, 9 thin omitted)

### Community 0 - "applyTaskFormState"
Cohesion: 0.10
Nodes (38): applyTaskFormState(), autoAdvanceTask(), blankTaskState(), checkTaskStep(), clearTimeFieldComplaint(), closeModal(), commitmentSwitchOn(), exactTimeOpen() (+30 more)

### Community 1 - "calDateStr"
Cohesion: 0.11
Nodes (46): areaMeta(), autoSegment(), cadenceText(), calDateStr(), calNowLine(), calOpenDayFocus(), calStateCls(), dayShape() (+38 more)

### Community 2 - "app.js"
Cohesion: 0.04
Nodes (56): applyAvatarCropTransform(), authBackendReady(), avatarCropEls(), CAL_DAYS, CAL_MONTHS, CAL_RANK, calculateSleepDuration(), calFocusStr (+48 more)

### Community 3 - "DueDateType"
Cohesion: 0.17
Nodes (10): DueDateType, HasValue, Value, DueDateTypeJsonConverter, IEquatable, JsonConverter, JsonSerializerOptions, Type (+2 more)

### Community 4 - "loadDashboardData"
Cohesion: 0.16
Nodes (26): addSampleTasks(), apiRequest(), closeFocus(), closeRowConfirm(), completeTask(), deleteTask(), disablePushNotifications(), enablePushNotifications() (+18 more)

### Community 5 - ".GetMorningDigestAsync"
Cohesion: 0.21
Nodes (9): DigestService, MorningDigestModel, RecommendedActions, TasksBySector, TotalWarningTasks, DateTime, Dictionary, List (+1 more)

### Community 6 - "ProfileAboutRequest"
Cohesion: 0.17
Nodes (12): ProfileAboutRequest, AvatarDataUrl, Bio, City, Country, DateOfBirth, DisplayName, FirstName (+4 more)

### Community 7 - "loadProfileIntoForm"
Cohesion: 0.18
Nodes (26): ageFromDob(), applyAvatarEverywhere(), applyProfileRow(), collectProfile(), deviceTimeZone(), fillCountryList(), fillTimeZoneSelect(), flashSaved() (+18 more)

### Community 8 - "User"
Cohesion: 0.09
Nodes (23): User, AvatarDataUrl, BedTime, Bio, City, Country, CreatedAt, DateOfBirth (+15 more)

### Community 9 - "onboarding.js"
Cohesion: 0.23
Nodes (21): buildChrome(), clearHighlights(), currentTarget(), end(), esc(), go(), handleAction(), hasContentToShow() (+13 more)

### Community 10 - "TaskItem"
Cohesion: 0.10
Nodes (21): TaskItem, CompletionLogs, CreatedAt, Description, DisplayOrder, DueDate, DueDateValue, DueTime (+13 more)

### Community 11 - "a11y.js"
Cohesion: 0.18
Nodes (15): announce(), apply(), ensureRegions(), focusableWithin(), load(), prefersReducedMotion(), save(), set() (+7 more)

### Community 12 - "calculateTaskState"
Cohesion: 0.13
Nodes (23): calculateTaskState(), calDatedTasksForDate(), calIsDaily(), callTaskRpc(), checkMissedCommitmentAlerts(), dismissedNotificationsKey(), formatWorkDaysSummary(), getTasksForDate() (+15 more)

### Community 13 - "PushSubscription"
Cohesion: 0.13
Nodes (15): PushSubscription, Auth, CreatedAt, Endpoint, Id, P256dh, User, UserId (+7 more)

### Community 14 - "AppDbContext"
Cohesion: 0.18
Nodes (10): AppDbContext, PushSubscriptions, TaskCompletionLogs, Tasks, Users, DbInitializer, User, DbContext (+2 more)

### Community 15 - "TaskWatchdogService"
Cohesion: 0.20
Nodes (10): BackgroundService, Task, PushNotificationService, ILogger, TaskWatchdogService, DateTime, ILogger, CancellationToken (+2 more)

### Community 16 - "initSetupPageListeners"
Cohesion: 0.24
Nodes (12): applyLocalModeChrome(), checkAuthToken(), clearStaleLocalSession(), currentStorageScope(), initLocalStorage(), initSetupPageListeners(), isLocalMode(), maybeStartTutorial() (+4 more)

### Community 17 - "android/package.json"
Cohesion: 0.06
Nodes (35): dependencies, @capacitor/android, @capacitor/app, @capacitor/core, @capacitor/haptics, @capacitor/keyboard, @capacitor/local-notifications, @capacitor/splash-screen (+27 more)

### Community 18 - "http"
Cohesion: 0.20
Nodes (9): ASPNETCORE_ENVIRONMENT, applicationUrl, commandName, dotnetRunMessages, environmentVariables, launchBrowser, profiles, http (+1 more)

### Community 19 - "Bokea.csproj"
Cohesion: 0.22
Nodes (8): net10.0, BCrypt.Net-Next (4.2.0), Microsoft.AspNetCore.Authentication.JwtBearer (10.0.9), Microsoft.EntityFrameworkCore.Sqlite (10.0.8), SQLitePCLRaw.bundle_e_sqlite3 (2.1.13), SQLitePCLRaw.lib.e_sqlite3 (2.1.13), WebPush (1.0.13), Microsoft.NET.Sdk.Web

### Community 20 - "Win32"
Cohesion: 0.10
Nodes (9): NOTIFYICONDATAW, POINT, Win32, WNDCLASSEXW, Guid, LibraryImport, OPENFILENAMEW, RECT (+1 more)

### Community 21 - "manifest.json"
Cohesion: 0.22
Nodes (8): background_color, description, display, icons, name, short_name, start_url, theme_color

### Community 22 - "AppWindow"
Cohesion: 0.11
Nodes (8): AppWindow, Tray, Action, DateTime, Lock, MSG, Queue, UnmanagedCallersOnly

### Community 23 - "AppServer"
Cohesion: 0.12
Nodes (19): CancellationTokenSource, AppServer, HandoffReceived, Origin, Port, Request, ContentLength, KeepAlive (+11 more)

### Community 24 - "Next steps — sync fixes (13 Sep 2026)"
Cohesion: 0.29
Nodes (6): 1. Run the database migration (Supabase), 2. Commit and deploy, 3. Check it on two devices, 4. Push notifications (needs building), 5. Known limits and choices made, Next steps — sync fixes (13 Sep 2026)

### Community 25 - "vercel.json"
Cohesion: 0.33
Nodes (5): cleanUrls, outputDirectory, routes, trailingSlash, version

### Community 26 - "TaskState"
Cohesion: 0.50
Nodes (4): TaskState, Amber, Green, Red

### Community 27 - "WebAssets"
Cohesion: 0.14
Nodes (13): Body, Task, Engine, Http, Stage, WebAssets, Final, GeneratedRegex (+5 more)

### Community 31 - "Bokeà for Windows: performance"
Cohesion: 0.05
Nodes (36): Bokeà for Windows: performance, Finding 1: minimising the window does not quiet the app, Finding 2: 428 KB of icons for 60 of them, Finding 3: `supabase-js` is loaded and started even with no account, Finding 4: the stylesheet is mostly not matching, How this was measured, Order to do them in, Page load (+28 more)

### Community 32 - ".RestorePlacement"
Cohesion: 0.13
Nodes (10): MINMAXINFO, MONITORINFO, MSG, RECT, Height, Width, WINDOWPLACEMENT, MONITORINFO (+2 more)

### Community 34 - ".application"
Cohesion: 0.07
Nodes (27): Any, Bool, Capacitor, CAPBridgeViewController, AppDelegate, NSUserActivity, UIScene, UISceneSession (+19 more)

### Community 35 - ".MapTaskEndpoints"
Cohesion: 0.19
Nodes (10): Sector, CompleteTaskRequest, CreateTaskRequest, ReorderTaskRequest, SnoozeTaskRequest, TaskEndpoints, UpdateTaskRequest, WhenInTheDay (+2 more)

### Community 36 - "ios/package.json"
Cohesion: 0.06
Nodes (35): dependencies, @capacitor/app, @capacitor/core, @capacitor/haptics, @capacitor/ios, @capacitor/keyboard, @capacitor/local-notifications, @capacitor/splash-screen (+27 more)

### Community 37 - "render-parity.js"
Cohesion: 0.14
Nodes (14): copyRoot, fs, http, LOCAL, out, path, pw, render() (+6 more)

### Community 38 - "Settings"
Cohesion: 0.17
Nodes (12): Settings, Background, Dark, NotificationsAllowed, Window, Zoom, WindowBounds, Bottom (+4 more)

### Community 39 - "WebKit.cs"
Cohesion: 0.33
Nodes (5): DownloadClient, NavigationClient, NotificationProvider, StateClient, UIClient

### Community 40 - "load-cost.js"
Cohesion: 0.15
Nodes (8): fs, http, LOCAL, path, pw, root, runs, TYPES

### Community 41 - "toggleRowMenu"
Cohesion: 0.36
Nodes (8): closeRowMenus(), closeRowMenusAndReturn(), closeRowMenusOnOutside(), renderFocusClock(), startFocus(), toggleFocusPause(), toggleRowMenu(), updateFocusPauseButton()

### Community 42 - "AuthEndpoints.cs"
Cohesion: 0.25
Nodes (7): LoginRequest, Email, Password, RegisterRequest, Email, FirstName, Password

### Community 43 - "AuthEndpoints"
Cohesion: 0.39
Nodes (3): AuthEndpoints, IEndpointRouteBuilder, User

### Community 44 - "Bokea.Database"
Cohesion: 0.39
Nodes (3): Bokea.Database, Bokea.Services, Bokea.Endpoints

### Community 45 - "applyRemotePreferences"
Cohesion: 0.27
Nodes (11): applyRemotePreferences(), applyUiPrefs(), collectPreferences(), loadUiPrefs(), markPreferencesChanged(), prefsDeviceKey(), pushPreferences(), saveUiPrefs() (+3 more)

### Community 46 - ".Main"
Cohesion: 0.11
Nodes (5): Assembly, Bokea.Desktop.Native, Program, DllImportSearchPath, STAThread

### Community 47 - "SetupRequest"
Cohesion: 0.29
Nodes (7): SetupRequest, BedTime, WakeUpTime, WorkDays, WorkEndTime, WorkStartTime, List

### Community 48 - "PushEndpoints.cs"
Cohesion: 0.33
Nodes (5): PushEndpoints, PushSubscriptionKeys, PushSubscriptionRequest, UnsubscribeRequest, IEndpointRouteBuilder

### Community 49 - "DigestTaskDto"
Cohesion: 0.29
Nodes (7): DigestTaskDto, Description, DueDate, Id, Sector, State, Title

### Community 51 - "commitCapture"
Cohesion: 0.18
Nodes (16): calCloseDay(), calGridKeydown(), calParse(), calShiftMonth(), captureTime(), clearFieldError(), clearValidationErrors(), commitCapture() (+8 more)

### Community 52 - "Resources/bridge.js"
Cohesion: 0.67
Nodes (5): post(), reportError(), reportTheme(), scheduleTheme(), watchTheme()

### Community 53 - "Bokeà Mobile Apps"
Cohesion: 0.50
Nodes (3): 1. Android (`mobile/android/`), 2. iOS (`mobile/ios/`), Bokeà Mobile Apps

### Community 54 - "android/src/bridge/mobile-bridge.js"
Cohesion: 0.12
Nodes (23): atTime(), buzz(), doneToday(), dueTimes(), el(), feedback(), hideSplash(), ignore() (+15 more)

### Community 55 - "Sector"
Cohesion: 0.40
Nodes (5): Sector, CareerAndFinance, HealthAndVitality, MindAndEnvironment, RelationshipsAndSocial

### Community 56 - "ios/src/bridge/mobile-bridge.js"
Cohesion: 0.12
Nodes (23): atTime(), buzz(), doneToday(), dueTimes(), el(), feedback(), hideSplash(), ignore() (+15 more)

### Community 57 - "MainActivity.java"
Cohesion: 0.47
Nodes (4): android.os.Bundle, com.getcapacitor.BridgeActivity, MainActivity, Override

### Community 58 - "webkit-slots.py"
Cohesion: 0.60
Nodes (4): fetch(), fields(), main(), Prints the WebKit C API client slot numbers used by…

### Community 59 - "IntervalType"
Cohesion: 0.50
Nodes (4): IntervalType, FixedDate, IntervalBased, Workdays

### Community 60 - "build.sh script"
Cohesion: 0.83
Nodes (3): pack(), build.sh script, step()

### Community 69 - "android/scripts/sync-web.mjs"
Cohesion: 0.21
Nodes (15): BRIDGE, CACHE, download(), HERE, main(), note(), OUT, rewriteScripts() (+7 more)

### Community 70 - "make-ios-assets.mjs"
Cohesion: 0.21
Nodes (15): APPICON, CATALOG, flatten(), fullBleed(), HERE, ICONS, main(), note() (+7 more)

### Community 71 - "ios/scripts/sync-web.mjs"
Cohesion: 0.21
Nodes (15): BRIDGE, CACHE, download(), HERE, main(), note(), OUT, rewriteScripts() (+7 more)

### Community 72 - "android/tests/bridge.mjs"
Cohesion: 0.22
Nodes (13): calls(), check(), { chromium }, fire(), HERE, main(), nativeStub(), PLATFORMS (+5 more)

### Community 73 - "android/build.sh"
Cohesion: 0.83
Nodes (3): fail(), build.sh script, step()

### Community 74 - "ios/tests/bridge.mjs"
Cohesion: 0.22
Nodes (13): calls(), check(), { chromium }, fire(), HERE, main(), nativeStub(), PLATFORMS (+5 more)

### Community 75 - "TrayNotifications"
Cohesion: 0.35
Nodes (4): TrayNotifications, CurrentId, IDisposable, NOTIFYICONDATAW

### Community 76 - "Support.cs"
Cohesion: 0.22
Nodes (5): Bokea.Desktop, AppInfo, Version, SettingsJsonContext, JsonSerializerContext

### Community 77 - ".Warn"
Cohesion: 0.28
Nodes (3): Log, Lock, Exception

### Community 78 - "Paths"
Cohesion: 0.22
Nodes (8): Paths, App, Data, Logs, Runtime, SettingsFile, Web, WebKitData

### Community 79 - ".OpenFiles"
Cohesion: 0.52
Nodes (4): Dialogs, List, OPENFILENAMEW, IReadOnlyList

### Community 80 - "Options"
Cohesion: 0.33
Nodes (5): Options, DataDirectory, DevTools, Port, StartPath

### Community 83 - "gradlew"
Cohesion: 0.83
Nodes (3): gradlew script, die(), warn()

### Community 84 - "ios/build.sh"
Cohesion: 0.83
Nodes (3): fail(), build.sh script, step()

## Knowledge Gaps
- **344 isolated node(s):** `net10.0`, `BCrypt.Net-Next (4.2.0)`, `Microsoft.AspNetCore.Authentication.JwtBearer (10.0.9)`, `Microsoft.EntityFrameworkCore.Sqlite (10.0.8)`, `SQLitePCLRaw.bundle_e_sqlite3 (2.1.13)` (+339 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 472 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **9 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Downloads` connect `.OnDecideDownloadDestination` to `Support.cs`?**
  _High betweenness centrality (0.071) - this node is a cross-community bridge._
- **Why does `AppDbContext` connect `AppDbContext` to `.GetMorningDigestAsync`, `User`, `TaskItem`, `PushSubscription`, `TaskWatchdogService`?**
  _High betweenness centrality (0.063) - this node is a cross-community bridge._
- **Why does `AppWindow` connect `AppWindow` to `.RestorePlacement`, `.HandleMessage`, `Settings`, `TrayNotifications`, `.Main`, `Options`, `.OnDecideDownloadDestination`, `.CreateWebView`, `.HandleBridgeMessage`, `Win32`, `AppServer`?**
  _High betweenness centrality (0.044) - this node is a cross-community bridge._
- **What connects `net10.0`, `BCrypt.Net-Next (4.2.0)`, `Microsoft.AspNetCore.Authentication.JwtBearer (10.0.9)` to the rest of the system?**
  _344 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `applyTaskFormState` be split into smaller, more focused modules?**
  _Cohesion score 0.10384068278805121 - nodes in this community are weakly interconnected._
- **Should `calDateStr` be split into smaller, more focused modules?**
  _Cohesion score 0.11497584541062802 - nodes in this community are weakly interconnected._
- **Should `app.js` be split into smaller, more focused modules?**
  _Cohesion score 0.04389233954451346 - nodes in this community are weakly interconnected._