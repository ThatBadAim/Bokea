# Graph Report - Bokea  (2026-09-11)

## Corpus Check
- 22 files · ~50,564 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 487 nodes · 993 edges · 30 communities (27 shown, 2 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 22 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `92ac813e`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- taskWhen
- app.js
- DueDateType
- DigestTaskDto
- ProfileAboutRequest
- apiRequest
- User
- onboarding.js
- TaskItem
- a11y.js
- loadProfileIntoForm
- PushSubscription
- checkAuthToken
- AppDbContext
- TaskWatchdogService
- http
- switchTab
- Bokea.csproj
- manifest.json
- vercel.json
- TaskState
- openEditTaskModal
- openSnoozeMenu
- sw.js
- Agent Instructions & Guidelines
- applyUiPrefs
- prepareIncomingView
- getTasksForDate
- renderFirstRun

## God Nodes (most connected - your core abstractions)
1. `TaskItem` - 34 edges
2. `User` - 31 edges
3. `apiRequest()` - 23 edges
4. `AppDbContext` - 19 edges
5. `loadDashboardData()` - 19 edges
6. `taskWhen()` - 19 edges
7. `loadProfileIntoForm()` - 18 edges
8. `renderCalendarDay()` - 17 edges
9. `renderNextUpTask()` - 16 edges
10. `showToast()` - 16 edges

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

## Communities (30 total, 2 thin omitted)

### Community 0 - "taskWhen"
Cohesion: 0.11
Nodes (53): areaMeta(), autoSegment(), cadenceText(), calCloseDay(), calculateTaskState(), calDatedTasksForDate(), calDateStr(), calGridKeydown() (+45 more)

### Community 1 - "app.js"
Cohesion: 0.05
Nodes (32): authBackendReady(), CAL_DAYS, CAL_MONTHS, CAL_RANK, calFocusStr, calOpenDayFocus(), calStateCls(), calViewDate (+24 more)

### Community 2 - "DueDateType"
Cohesion: 0.07
Nodes (29): DueDateType, HasValue, Value, DueDateTypeJsonConverter, IntervalType, FixedDate, IntervalBased, Workdays (+21 more)

### Community 3 - "DigestTaskDto"
Cohesion: 0.07
Nodes (26): DigestEndpoints, IEndpointRouteBuilder, PushEndpoints, PushSubscriptionKeys, PushSubscriptionRequest, UnsubscribeRequest, IEndpointRouteBuilder, DigestService (+18 more)

### Community 4 - "ProfileAboutRequest"
Cohesion: 0.06
Nodes (29): AuthEndpoints, LoginRequest, Email, Password, ProfileAboutRequest, AvatarDataUrl, Bio, City (+21 more)

### Community 5 - "apiRequest"
Cohesion: 0.14
Nodes (30): addSampleTasks(), apiRequest(), captureTime(), closeFocus(), closeRowConfirm(), commitCapture(), completeTask(), deleteTask() (+22 more)

### Community 6 - "User"
Cohesion: 0.09
Nodes (23): User, AvatarDataUrl, BedTime, Bio, City, Country, CreatedAt, DateOfBirth (+15 more)

### Community 7 - "onboarding.js"
Cohesion: 0.23
Nodes (21): buildChrome(), clearHighlights(), currentTarget(), end(), esc(), go(), handleAction(), hasContentToShow() (+13 more)

### Community 8 - "TaskItem"
Cohesion: 0.10
Nodes (21): TaskItem, CompletionLogs, CreatedAt, Description, DisplayOrder, DueDate, DueDateValue, DueTime (+13 more)

### Community 9 - "a11y.js"
Cohesion: 0.18
Nodes (15): announce(), apply(), ensureRegions(), focusableWithin(), load(), prefersReducedMotion(), save(), set() (+7 more)

### Community 10 - "loadProfileIntoForm"
Cohesion: 0.20
Nodes (23): ageFromDob(), applyAvatarEverywhere(), collectProfile(), deviceTimeZone(), fillCountryList(), fillTimeZoneSelect(), flashSaved(), keepUnlistedOption() (+15 more)

### Community 11 - "PushSubscription"
Cohesion: 0.13
Nodes (15): PushSubscription, Auth, CreatedAt, Endpoint, Id, P256dh, User, UserId (+7 more)

### Community 12 - "checkAuthToken"
Cohesion: 0.21
Nodes (12): checkAuthToken(), clearStaleLocalSession(), currentStorageScope(), handleLocalStorageFallback(), initLocalStorage(), invalidateDayShapeCache(), maybeStartTutorial(), migrateLegacyStorage() (+4 more)

### Community 13 - "AppDbContext"
Cohesion: 0.18
Nodes (10): AppDbContext, PushSubscriptions, TaskCompletionLogs, Tasks, Users, DbInitializer, User, DbContext (+2 more)

### Community 14 - "TaskWatchdogService"
Cohesion: 0.20
Nodes (10): BackgroundService, Task, PushNotificationService, ILogger, TaskWatchdogService, DateTime, ILogger, CancellationToken (+2 more)

### Community 15 - "http"
Cohesion: 0.20
Nodes (9): ASPNETCORE_ENVIRONMENT, applicationUrl, commandName, dotnetRunMessages, environmentVariables, launchBrowser, profiles, http (+1 more)

### Community 16 - "switchTab"
Cohesion: 0.20
Nodes (11): calculateSleepDuration(), hideChartTooltip(), loadSettingsIntoForm(), onTouchEnd(), renderAnalyticsDataTable(), renderAnalyticsGraph(), setTheme(), showChartTooltip() (+3 more)

### Community 17 - "Bokea.csproj"
Cohesion: 0.22
Nodes (8): net10.0, BCrypt.Net-Next (4.2.0), Microsoft.AspNetCore.Authentication.JwtBearer (10.0.9), Microsoft.EntityFrameworkCore.Sqlite (10.0.8), SQLitePCLRaw.bundle_e_sqlite3 (2.1.13), SQLitePCLRaw.lib.e_sqlite3 (2.1.13), WebPush (1.0.13), Microsoft.NET.Sdk.Web

### Community 18 - "manifest.json"
Cohesion: 0.22
Nodes (8): background_color, description, display, icons, name, short_name, start_url, theme_color

### Community 19 - "vercel.json"
Cohesion: 0.33
Nodes (5): cleanUrls, outputDirectory, routes, trailingSlash, version

### Community 20 - "TaskState"
Cohesion: 0.50
Nodes (4): TaskState, Amber, Green, Red

### Community 21 - "openEditTaskModal"
Cohesion: 0.27
Nodes (11): clearValidationErrors(), formatWorkDaysSummary(), getUserWorkDays(), openCreateTaskModal(), openEditTaskModal(), openModal(), renderNotifications(), setCommitmentSwitch() (+3 more)

### Community 22 - "openSnoozeMenu"
Cohesion: 0.83
Nodes (4): closeSnoozeMenu(), closeSnoozeMenuOnEscape(), closeSnoozeMenuOnOutside(), openSnoozeMenu()

### Community 25 - "applyUiPrefs"
Cohesion: 0.40
Nodes (5): applyUiPrefs(), loadUiPrefs(), saveUiPrefs(), syncTimeInputsClockFormat(), wireAccessibilityBehaviour()

### Community 26 - "prepareIncomingView"
Cohesion: 0.50
Nodes (4): cleanupIncomingView(), onTouchMove(), prepareIncomingView(), resetGestureState()

### Community 27 - "getTasksForDate"
Cohesion: 0.67
Nodes (3): calIsDaily(), getTasksForDate(), mapBackendTask()

### Community 29 - "renderFirstRun"
Cohesion: 0.67
Nodes (3): dismissFirstRun(), firstRunDismissed(), renderFirstRun()

## Knowledge Gaps
- **145 isolated node(s):** `net10.0`, `BCrypt.Net-Next (4.2.0)`, `Microsoft.AspNetCore.Authentication.JwtBearer (10.0.9)`, `Microsoft.EntityFrameworkCore.Sqlite (10.0.8)`, `SQLitePCLRaw.bundle_e_sqlite3 (2.1.13)` (+140 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 188 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **2 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `TaskItem` connect `TaskItem` to `DueDateType`, `DigestTaskDto`, `User`, `PushSubscription`, `AppDbContext`, `TaskWatchdogService`, `TaskState`?**
  _High betweenness centrality (0.055) - this node is a cross-community bridge._
- **Why does `Bokea.Database` connect `DigestTaskDto` to `DueDateType`, `ProfileAboutRequest`, `AppDbContext`?**
  _High betweenness centrality (0.053) - this node is a cross-community bridge._
- **Why does `User` connect `User` to `DueDateType`, `ProfileAboutRequest`, `TaskItem`, `PushSubscription`, `AppDbContext`?**
  _High betweenness centrality (0.045) - this node is a cross-community bridge._
- **What connects `net10.0`, `BCrypt.Net-Next (4.2.0)`, `Microsoft.AspNetCore.Authentication.JwtBearer (10.0.9)` to the rest of the system?**
  _145 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `taskWhen` be split into smaller, more focused modules?**
  _Cohesion score 0.11030478955007257 - nodes in this community are weakly interconnected._
- **Should `app.js` be split into smaller, more focused modules?**
  _Cohesion score 0.047474747474747475 - nodes in this community are weakly interconnected._
- **Should `DueDateType` be split into smaller, more focused modules?**
  _Cohesion score 0.06666666666666667 - nodes in this community are weakly interconnected._