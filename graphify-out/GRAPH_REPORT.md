# Graph Report - Bokea  (2026-09-12)

## Corpus Check
- cluster-only mode — file stats not available

## Summary
- 505 nodes · 1042 edges · 36 communities (30 shown, 5 thin omitted)
- Extraction: 97% EXTRACTED · 3% INFERRED · 0% AMBIGUOUS · INFERRED: 27 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `123ac0a8`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- calDateStr
- DigestTaskDto
- app.js
- ProfileAboutRequest
- apiRequest
- User
- loadProfileIntoForm
- onboarding.js
- TaskItem
- a11y.js
- PushSubscription
- DueDateType
- AppDbContext
- .MapTaskEndpoints
- calculateTaskState
- http
- renderAllTasksGrid
- Bokea.csproj
- manifest.json
- toggleRowMenu
- vercel.json
- Sector
- applyUiPrefs
- promptSignUpFromLocal
- loadSettingsIntoForm
- IntervalType
- TaskState
- calDatedTasksForDate
- openSnoozeMenu
- renderAnalyticsGraph
- sw.js
- Agent Instructions & Guidelines
- List
- User
- ILogger

## God Nodes (most connected - your core abstractions)
1. `TaskItem` - 34 edges
2. `User` - 31 edges
3. `apiRequest()` - 25 edges
4. `calDateStr()` - 20 edges
5. `taskWhen()` - 19 edges
6. `loadDashboardData()` - 19 edges
7. `AppDbContext` - 18 edges
8. `loadProfileIntoForm()` - 18 edges
9. `renderCalendarDay()` - 17 edges
10. `renderNextUpTask()` - 17 edges

## Surprising Connections (you probably didn't know these)
- `DigestService` --references--> `AppDbContext`  [EXTRACTED]
  Bokeà/Services/DigestService.cs → Bokeà/Database/AppDbContext.cs
- `PushNotificationService` --references--> `AppDbContext`  [EXTRACTED]
  Bokeà/Services/PushNotificationService.cs → Bokeà/Database/AppDbContext.cs
- `AppDbContext` --references--> `PushSubscription`  [EXTRACTED]
  Bokeà/Database/AppDbContext.cs → Bokeà/Database/Models.cs
- `AppDbContext` --references--> `TaskCompletionLog`  [EXTRACTED]
  Bokeà/Database/AppDbContext.cs → Bokeà/Database/Models.cs
- `AppDbContext` --references--> `TaskItem`  [EXTRACTED]
  Bokeà/Database/AppDbContext.cs → Bokeà/Database/Models.cs

## Import Cycles
- None detected.

## Communities (36 total, 5 thin omitted)

### Community 0 - "calDateStr"
Cohesion: 0.07
Nodes (69): areaMeta(), cadenceText(), calCloseDay(), calDateStr(), calGridKeydown(), calNowLine(), calOpenDayFocus(), calParse() (+61 more)

### Community 1 - "DigestTaskDto"
Cohesion: 0.05
Nodes (38): AppDbContext, BackgroundService, Task, DigestEndpoints, IEndpointRouteBuilder, PushEndpoints, PushSubscriptionKeys, PushSubscriptionRequest (+30 more)

### Community 2 - "app.js"
Cohesion: 0.06
Nodes (22): CAL_DAYS, CAL_MONTHS, CAL_RANK, calFocusStr, calViewDate, dismissFirstRun(), dueDateGroup, firstRunDismissed() (+14 more)

### Community 3 - "ProfileAboutRequest"
Cohesion: 0.07
Nodes (29): AuthEndpoints, LoginRequest, Email, Password, ProfileAboutRequest, AvatarDataUrl, Bio, City (+21 more)

### Community 4 - "apiRequest"
Cohesion: 0.14
Nodes (32): addSampleTasks(), apiRequest(), applyLocalModeChrome(), captureTime(), checkAuthToken(), clearStaleLocalSession(), closeFocus(), commitCapture() (+24 more)

### Community 5 - "User"
Cohesion: 0.09
Nodes (23): User, AvatarDataUrl, BedTime, Bio, City, Country, CreatedAt, DateOfBirth (+15 more)

### Community 6 - "loadProfileIntoForm"
Cohesion: 0.20
Nodes (23): ageFromDob(), applyAvatarEverywhere(), collectProfile(), deviceTimeZone(), fillCountryList(), fillTimeZoneSelect(), flashSaved(), keepUnlistedOption() (+15 more)

### Community 7 - "onboarding.js"
Cohesion: 0.23
Nodes (21): buildChrome(), clearHighlights(), currentTarget(), end(), esc(), go(), handleAction(), hasContentToShow() (+13 more)

### Community 8 - "TaskItem"
Cohesion: 0.10
Nodes (21): TaskItem, CompletionLogs, CreatedAt, Description, DisplayOrder, DueDate, DueDateValue, DueTime (+13 more)

### Community 9 - "a11y.js"
Cohesion: 0.18
Nodes (15): announce(), apply(), ensureRegions(), focusableWithin(), load(), prefersReducedMotion(), save(), set() (+7 more)

### Community 10 - "PushSubscription"
Cohesion: 0.13
Nodes (15): PushSubscription, Auth, CreatedAt, Endpoint, Id, P256dh, User, UserId (+7 more)

### Community 11 - "DueDateType"
Cohesion: 0.17
Nodes (10): DueDateType, HasValue, Value, DueDateTypeJsonConverter, IEquatable, JsonConverter, JsonSerializerOptions, Type (+2 more)

### Community 12 - "AppDbContext"
Cohesion: 0.18
Nodes (10): AppDbContext, PushSubscriptions, TaskCompletionLogs, Tasks, Users, DbInitializer, User, DbContext (+2 more)

### Community 13 - ".MapTaskEndpoints"
Cohesion: 0.19
Nodes (10): Sector, CompleteTaskRequest, CreateTaskRequest, ReorderTaskRequest, SnoozeTaskRequest, TaskEndpoints, UpdateTaskRequest, WhenInTheDay (+2 more)

### Community 14 - "calculateTaskState"
Cohesion: 0.19
Nodes (13): calculateTaskState(), currentStorageScope(), handleLocalStorageFallback(), initLocalStorage(), invalidateDayShapeCache(), migrateLegacyStorage(), readStore(), refreshStorageScope() (+5 more)

### Community 15 - "http"
Cohesion: 0.20
Nodes (9): ASPNETCORE_ENVIRONMENT, applicationUrl, commandName, dotnetRunMessages, environmentVariables, launchBrowser, profiles, http (+1 more)

### Community 16 - "renderAllTasksGrid"
Cohesion: 0.24
Nodes (10): autoSegment(), cleanupIncomingView(), onTouchEnd(), onTouchMove(), prepareIncomingView(), renderAllTasksGrid(), resetGestureState(), segmentOf() (+2 more)

### Community 17 - "Bokea.csproj"
Cohesion: 0.22
Nodes (8): net10.0, BCrypt.Net-Next (4.2.0), Microsoft.AspNetCore.Authentication.JwtBearer (10.0.9), Microsoft.EntityFrameworkCore.Sqlite (10.0.8), SQLitePCLRaw.bundle_e_sqlite3 (2.1.13), SQLitePCLRaw.lib.e_sqlite3 (2.1.13), WebPush (1.0.13), Microsoft.NET.Sdk.Web

### Community 18 - "manifest.json"
Cohesion: 0.22
Nodes (8): background_color, description, display, icons, name, short_name, start_url, theme_color

### Community 19 - "toggleRowMenu"
Cohesion: 0.40
Nodes (6): closeRowConfirm(), closeRowMenus(), closeRowMenusAndReturn(), closeRowMenusOnOutside(), deleteTask(), toggleRowMenu()

### Community 20 - "vercel.json"
Cohesion: 0.33
Nodes (5): cleanUrls, outputDirectory, routes, trailingSlash, version

### Community 21 - "Sector"
Cohesion: 0.40
Nodes (5): Sector, CareerAndFinance, HealthAndVitality, MindAndEnvironment, RelationshipsAndSocial

### Community 22 - "applyUiPrefs"
Cohesion: 0.40
Nodes (5): applyUiPrefs(), loadUiPrefs(), saveUiPrefs(), syncTimeInputsClockFormat(), wireAccessibilityBehaviour()

### Community 23 - "promptSignUpFromLocal"
Cohesion: 0.40
Nodes (5): authBackendReady(), promptSignUpFromLocal(), setLocalMode(), showAuthError(), showAuthForm()

### Community 24 - "loadSettingsIntoForm"
Cohesion: 0.40
Nodes (5): calculateSleepDuration(), loadSettingsIntoForm(), setTheme(), updateSleepHealthMeter(), updateThemeCardSelection()

### Community 25 - "IntervalType"
Cohesion: 0.50
Nodes (4): IntervalType, FixedDate, IntervalBased, Workdays

### Community 26 - "TaskState"
Cohesion: 0.50
Nodes (4): TaskState, Amber, Green, Red

### Community 27 - "calDatedTasksForDate"
Cohesion: 0.67
Nodes (4): calDatedTasksForDate(), calIsDaily(), getTasksForDate(), mapBackendTask()

### Community 28 - "openSnoozeMenu"
Cohesion: 0.83
Nodes (4): closeSnoozeMenu(), closeSnoozeMenuOnEscape(), closeSnoozeMenuOnOutside(), openSnoozeMenu()

### Community 29 - "renderAnalyticsGraph"
Cohesion: 0.67
Nodes (4): hideChartTooltip(), renderAnalyticsDataTable(), renderAnalyticsGraph(), showChartTooltip()

## Knowledge Gaps
- **146 isolated node(s):** `UnsubscribeRequest`, `ReorderTaskRequest`, `Description`, `DueDate`, `Id` (+141 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 195 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **5 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `TaskItem` connect `TaskItem` to `DigestTaskDto`, `User`, `PushSubscription`, `DueDateType`, `AppDbContext`, `.MapTaskEndpoints`, `IntervalType`, `TaskState`?**
  _High betweenness centrality (0.053) - this node is a cross-community bridge._
- **Why does `Bokea.Database` connect `DigestTaskDto` to `ProfileAboutRequest`, `DueDateType`, `AppDbContext`, `.MapTaskEndpoints`?**
  _High betweenness centrality (0.042) - this node is a cross-community bridge._
- **Why does `User` connect `User` to `ProfileAboutRequest`, `TaskItem`, `PushSubscription`, `DueDateType`, `AppDbContext`?**
  _High betweenness centrality (0.041) - this node is a cross-community bridge._
- **What connects `UnsubscribeRequest`, `ReorderTaskRequest`, `Description` to the rest of the system?**
  _146 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `calDateStr` be split into smaller, more focused modules?**
  _Cohesion score 0.0733162830349531 - nodes in this community are weakly interconnected._
- **Should `DigestTaskDto` be split into smaller, more focused modules?**
  _Cohesion score 0.05152394775036284 - nodes in this community are weakly interconnected._
- **Should `app.js` be split into smaller, more focused modules?**
  _Cohesion score 0.05855855855855856 - nodes in this community are weakly interconnected._