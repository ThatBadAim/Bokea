# Graph Report - Bokea  (2026-09-13)

## Corpus Check
- 23 files · ~61,425 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 533 nodes · 1118 edges · 38 communities (35 shown, 2 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 25 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `6bd607a7`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- taskWhen
- .GetMorningDigestAsync
- User
- app.js
- ProfileAboutRequest
- loadDashboardData
- loadProfileIntoForm
- onboarding.js
- TaskItem
- a11y.js
- DueDateType
- AppDbContext
- prepareIncomingView
- .MapTaskEndpoints
- propagateClockFormatChange
- http
- Bokea.csproj
- manifest.json
- openAvatarCropper
- PushSubscription
- vercel.json
- Bokea.Database
- applyRemotePreferences
- promptSignUpFromLocal
- refreshStorageScope
- PushEndpoints.cs
- TaskState
- toggleRowMenu
- openSnoozeMenu
- sw.js
- Agent Instructions & Guidelines
- DigestTaskDto
- Next steps — sync fixes (13 Sep 2026)
- Sector
- TaskWatchdogService
- renderNotifications
- IntervalType

## God Nodes (most connected - your core abstractions)
1. `TaskItem` - 34 edges
2. `User` - 31 edges
3. `loadDashboardData()` - 23 edges
4. `calDateStr()` - 21 edges
5. `AppDbContext` - 19 edges
6. `renderNextUpTask()` - 19 edges
7. `taskWhen()` - 19 edges
8. `apiRequest()` - 18 edges
9. `loadProfileIntoForm()` - 18 edges
10. `renderCalendarDay()` - 17 edges

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

## Communities (38 total, 2 thin omitted)

### Community 0 - "taskWhen"
Cohesion: 0.11
Nodes (39): areaMeta(), autoSegment(), cadenceText(), calCloseDay(), calGridKeydown(), calNowLine(), calOpenDayFocus(), calParse() (+31 more)

### Community 1 - ".GetMorningDigestAsync"
Cohesion: 0.21
Nodes (9): DigestService, MorningDigestModel, RecommendedActions, TasksBySector, TotalWarningTasks, DateTime, List, Sector (+1 more)

### Community 2 - "User"
Cohesion: 0.09
Nodes (23): User, AvatarDataUrl, BedTime, Bio, City, Country, CreatedAt, DateOfBirth (+15 more)

### Community 3 - "app.js"
Cohesion: 0.05
Nodes (23): CAL_DAYS, CAL_MONTHS, CAL_RANK, calFocusStr, calViewDate, dismissFirstRun(), dueDateGroup, firstRunDismissed() (+15 more)

### Community 4 - "ProfileAboutRequest"
Cohesion: 0.06
Nodes (29): AuthEndpoints, LoginRequest, Email, Password, ProfileAboutRequest, AvatarDataUrl, Bio, City (+21 more)

### Community 5 - "loadDashboardData"
Cohesion: 0.08
Nodes (53): addSampleTasks(), apiRequest(), applyLocalModeChrome(), calculateTaskState(), calDatedTasksForDate(), calDateStr(), calIsDaily(), callTaskRpc() (+45 more)

### Community 6 - "loadProfileIntoForm"
Cohesion: 0.18
Nodes (26): ageFromDob(), applyAvatarEverywhere(), applyProfileRow(), collectProfile(), deviceTimeZone(), fillCountryList(), fillTimeZoneSelect(), flashSaved() (+18 more)

### Community 7 - "onboarding.js"
Cohesion: 0.23
Nodes (21): buildChrome(), clearHighlights(), currentTarget(), end(), esc(), go(), handleAction(), hasContentToShow() (+13 more)

### Community 8 - "TaskItem"
Cohesion: 0.10
Nodes (21): TaskItem, CompletionLogs, CreatedAt, Description, DisplayOrder, DueDate, DueDateValue, DueTime (+13 more)

### Community 9 - "a11y.js"
Cohesion: 0.18
Nodes (15): announce(), apply(), ensureRegions(), focusableWithin(), load(), prefersReducedMotion(), save(), set() (+7 more)

### Community 10 - "DueDateType"
Cohesion: 0.17
Nodes (10): DueDateType, HasValue, Value, DueDateTypeJsonConverter, IEquatable, JsonConverter, JsonSerializerOptions, Type (+2 more)

### Community 11 - "AppDbContext"
Cohesion: 0.19
Nodes (10): AppDbContext, PushSubscriptions, TaskCompletionLogs, Tasks, Users, DbInitializer, User, DbContext (+2 more)

### Community 12 - "prepareIncomingView"
Cohesion: 0.18
Nodes (14): calculateSleepDuration(), cleanupIncomingView(), hideChartTooltip(), loadSettingsIntoForm(), onTouchEnd(), onTouchMove(), prepareIncomingView(), renderAnalyticsDataTable() (+6 more)

### Community 13 - ".MapTaskEndpoints"
Cohesion: 0.19
Nodes (10): Sector, CompleteTaskRequest, CreateTaskRequest, ReorderTaskRequest, SnoozeTaskRequest, TaskEndpoints, UpdateTaskRequest, WhenInTheDay (+2 more)

### Community 14 - "propagateClockFormatChange"
Cohesion: 0.16
Nodes (27): clearFieldError(), clearTimeFieldComplaint(), clearValidationErrors(), dayShape(), fmtHM(), formatAppTime(), formatWorkDaysSummary(), getUserWorkDays() (+19 more)

### Community 15 - "http"
Cohesion: 0.20
Nodes (9): ASPNETCORE_ENVIRONMENT, applicationUrl, commandName, dotnetRunMessages, environmentVariables, launchBrowser, profiles, http (+1 more)

### Community 16 - "Bokea.csproj"
Cohesion: 0.22
Nodes (8): net10.0, BCrypt.Net-Next (4.2.0), Microsoft.AspNetCore.Authentication.JwtBearer (10.0.9), Microsoft.EntityFrameworkCore.Sqlite (10.0.8), SQLitePCLRaw.bundle_e_sqlite3 (2.1.13), SQLitePCLRaw.lib.e_sqlite3 (2.1.13), WebPush (1.0.13), Microsoft.NET.Sdk.Web

### Community 17 - "manifest.json"
Cohesion: 0.22
Nodes (8): background_color, description, display, icons, name, short_name, start_url, theme_color

### Community 18 - "openAvatarCropper"
Cohesion: 0.25
Nodes (8): applyAvatarCropTransform(), avatarCropEls(), cancel(), clampAvatarCropOffset(), closeAvatarCropper(), loadImageFromFile(), openAvatarCropper(), pointerMove()

### Community 19 - "PushSubscription"
Cohesion: 0.13
Nodes (15): PushSubscription, Auth, CreatedAt, Endpoint, Id, P256dh, User, UserId (+7 more)

### Community 20 - "vercel.json"
Cohesion: 0.33
Nodes (5): cleanUrls, outputDirectory, routes, trailingSlash, version

### Community 21 - "Bokea.Database"
Cohesion: 0.23
Nodes (5): DigestEndpoints, IEndpointRouteBuilder, Bokea.Database, Bokea.Services, Bokea.Endpoints

### Community 22 - "applyRemotePreferences"
Cohesion: 0.27
Nodes (11): applyRemotePreferences(), applyUiPrefs(), collectPreferences(), loadUiPrefs(), markPreferencesChanged(), prefsDeviceKey(), pushPreferences(), saveUiPrefs() (+3 more)

### Community 23 - "promptSignUpFromLocal"
Cohesion: 0.40
Nodes (5): authBackendReady(), promptSignUpFromLocal(), setLocalMode(), showAuthError(), showAuthForm()

### Community 24 - "refreshStorageScope"
Cohesion: 0.50
Nodes (4): currentStorageScope(), migrateLegacyStorage(), refreshStorageScope(), setStorageScope()

### Community 25 - "PushEndpoints.cs"
Cohesion: 0.33
Nodes (5): PushEndpoints, PushSubscriptionKeys, PushSubscriptionRequest, UnsubscribeRequest, IEndpointRouteBuilder

### Community 26 - "TaskState"
Cohesion: 0.50
Nodes (4): TaskState, Amber, Green, Red

### Community 27 - "toggleRowMenu"
Cohesion: 0.40
Nodes (6): closeRowConfirm(), closeRowMenus(), closeRowMenusAndReturn(), closeRowMenusOnOutside(), deleteTask(), toggleRowMenu()

### Community 28 - "openSnoozeMenu"
Cohesion: 0.83
Nodes (4): closeSnoozeMenu(), closeSnoozeMenuOnEscape(), closeSnoozeMenuOnOutside(), openSnoozeMenu()

### Community 31 - "DigestTaskDto"
Cohesion: 0.29
Nodes (7): DigestTaskDto, Description, DueDate, Id, Sector, State, Title

### Community 32 - "Next steps — sync fixes (13 Sep 2026)"
Cohesion: 0.29
Nodes (6): 1. Run the database migration (Supabase), 2. Commit and deploy, 3. Check it on two devices, 4. Push notifications (needs building), 5. Known limits and choices made, Next steps — sync fixes (13 Sep 2026)

### Community 33 - "Sector"
Cohesion: 0.40
Nodes (5): Sector, CareerAndFinance, HealthAndVitality, MindAndEnvironment, RelationshipsAndSocial

### Community 34 - "TaskWatchdogService"
Cohesion: 0.20
Nodes (10): BackgroundService, Task, PushNotificationService, ILogger, TaskWatchdogService, DateTime, ILogger, CancellationToken (+2 more)

### Community 36 - "renderNotifications"
Cohesion: 0.50
Nodes (5): dismissedNotificationsKey(), notificationSignature(), readDismissedNotifications(), renderNotifications(), writeDismissedNotifications()

### Community 37 - "IntervalType"
Cohesion: 0.50
Nodes (4): IntervalType, FixedDate, IntervalBased, Workdays

## Knowledge Gaps
- **153 isolated node(s):** `net10.0`, `BCrypt.Net-Next (4.2.0)`, `Microsoft.AspNetCore.Authentication.JwtBearer (10.0.9)`, `Microsoft.EntityFrameworkCore.Sqlite (10.0.8)`, `SQLitePCLRaw.bundle_e_sqlite3 (2.1.13)` (+148 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 200 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **2 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `TaskItem` connect `TaskItem` to `.GetMorningDigestAsync`, `User`, `TaskWatchdogService`, `IntervalType`, `DueDateType`, `AppDbContext`, `.MapTaskEndpoints`, `PushSubscription`, `TaskState`?**
  _High betweenness centrality (0.046) - this node is a cross-community bridge._
- **Why does `Bokea.Database` connect `Bokea.Database` to `PushEndpoints.cs`, `DueDateType`, `ProfileAboutRequest`, `.MapTaskEndpoints`?**
  _High betweenness centrality (0.044) - this node is a cross-community bridge._
- **Why does `User` connect `User` to `ProfileAboutRequest`, `TaskItem`, `DueDateType`, `AppDbContext`, `PushSubscription`?**
  _High betweenness centrality (0.038) - this node is a cross-community bridge._
- **What connects `net10.0`, `BCrypt.Net-Next (4.2.0)`, `Microsoft.AspNetCore.Authentication.JwtBearer (10.0.9)` to the rest of the system?**
  _153 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `taskWhen` be split into smaller, more focused modules?**
  _Cohesion score 0.10661268556005399 - nodes in this community are weakly interconnected._
- **Should `User` be split into smaller, more focused modules?**
  _Cohesion score 0.08695652173913043 - nodes in this community are weakly interconnected._
- **Should `app.js` be split into smaller, more focused modules?**
  _Cohesion score 0.05384615384615385 - nodes in this community are weakly interconnected._