# Graph Report - Bokea  (2026-09-13)

## Corpus Check
- 24 files · ~163,723 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 540 nodes · 1148 edges · 36 communities (33 shown, 2 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 25 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `c7038d8e`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- calDateStr
- app.js
- ProfileAboutRequest
- calculateTaskState
- loadDashboardData
- loadProfileIntoForm
- User
- TaskItem
- onboarding.js
- PushSubscription
- a11y.js
- .MapTaskEndpoints
- DueDateType
- TaskWatchdogService
- AppDbContext
- prepareIncomingView
- checkAuthToken
- applyRemotePreferences
- Bokea.Database
- http
- Bokea.csproj
- .GetMorningDigestAsync
- manifest.json
- TaskState
- openEditTaskModal
- PushEndpoints.cs
- DigestTaskDto
- Next steps — sync fixes (13 Sep 2026)
- persistAppSettings
- vercel.json
- IntervalType
- toggleRowMenu
- openSnoozeMenu
- sw.js
- Agent Instructions & Guidelines

## God Nodes (most connected - your core abstractions)
1. `TaskItem` - 34 edges
2. `User` - 31 edges
3. `loadDashboardData()` - 23 edges
4. `calDateStr()` - 22 edges
5. `AppDbContext` - 19 edges
6. `renderNextUpTask()` - 19 edges
7. `taskWhen()` - 19 edges
8. `apiRequest()` - 18 edges
9. `openEditTaskModal()` - 18 edges
10. `showToast()` - 18 edges

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

## Communities (36 total, 2 thin omitted)

### Community 0 - "calDateStr"
Cohesion: 0.09
Nodes (51): areaMeta(), autoSegment(), cadenceText(), calCloseDay(), calDateStr(), calGridKeydown(), calNowLine(), calOpenDayFocus() (+43 more)

### Community 1 - "app.js"
Cohesion: 0.05
Nodes (34): applyAvatarCropTransform(), authBackendReady(), avatarCropEls(), CAL_DAYS, CAL_MONTHS, CAL_RANK, calFocusStr, calViewDate (+26 more)

### Community 2 - "ProfileAboutRequest"
Cohesion: 0.06
Nodes (29): AuthEndpoints, LoginRequest, Email, Password, ProfileAboutRequest, AvatarDataUrl, Bio, City (+21 more)

### Community 3 - "calculateTaskState"
Cohesion: 0.13
Nodes (23): calculateTaskState(), calDatedTasksForDate(), calIsDaily(), callTaskRpc(), checkMissedCommitmentAlerts(), dismissedNotificationsKey(), formatWorkDaysSummary(), getTasksForDate() (+15 more)

### Community 4 - "loadDashboardData"
Cohesion: 0.17
Nodes (26): addSampleTasks(), apiRequest(), closeFocus(), closeRowConfirm(), completeTask(), deleteTask(), disablePushNotifications(), enablePushNotifications() (+18 more)

### Community 5 - "loadProfileIntoForm"
Cohesion: 0.29
Nodes (17): ageFromDob(), collectProfile(), deviceTimeZone(), fillCountryList(), fillTimeZoneSelect(), keepUnlistedOption(), loadProfileIntoForm(), normalizeGender() (+9 more)

### Community 6 - "User"
Cohesion: 0.09
Nodes (23): User, AvatarDataUrl, BedTime, Bio, City, Country, CreatedAt, DateOfBirth (+15 more)

### Community 7 - "TaskItem"
Cohesion: 0.10
Nodes (21): TaskItem, CompletionLogs, CreatedAt, Description, DisplayOrder, DueDate, DueDateValue, DueTime (+13 more)

### Community 8 - "onboarding.js"
Cohesion: 0.23
Nodes (21): buildChrome(), clearHighlights(), currentTarget(), end(), esc(), go(), handleAction(), hasContentToShow() (+13 more)

### Community 9 - "PushSubscription"
Cohesion: 0.13
Nodes (15): PushSubscription, Auth, CreatedAt, Endpoint, Id, P256dh, User, UserId (+7 more)

### Community 10 - "a11y.js"
Cohesion: 0.18
Nodes (15): announce(), apply(), ensureRegions(), focusableWithin(), load(), prefersReducedMotion(), save(), set() (+7 more)

### Community 11 - ".MapTaskEndpoints"
Cohesion: 0.19
Nodes (10): Sector, CompleteTaskRequest, CreateTaskRequest, ReorderTaskRequest, SnoozeTaskRequest, TaskEndpoints, UpdateTaskRequest, WhenInTheDay (+2 more)

### Community 12 - "DueDateType"
Cohesion: 0.17
Nodes (10): DueDateType, HasValue, Value, DueDateTypeJsonConverter, IEquatable, JsonConverter, JsonSerializerOptions, Type (+2 more)

### Community 13 - "TaskWatchdogService"
Cohesion: 0.20
Nodes (10): BackgroundService, Task, PushNotificationService, ILogger, TaskWatchdogService, DateTime, ILogger, CancellationToken (+2 more)

### Community 14 - "AppDbContext"
Cohesion: 0.18
Nodes (10): AppDbContext, PushSubscriptions, TaskCompletionLogs, Tasks, Users, DbInitializer, User, DbContext (+2 more)

### Community 15 - "prepareIncomingView"
Cohesion: 0.18
Nodes (14): calculateSleepDuration(), cleanupIncomingView(), hideChartTooltip(), loadSettingsIntoForm(), onTouchEnd(), onTouchMove(), prepareIncomingView(), renderAnalyticsDataTable() (+6 more)

### Community 16 - "checkAuthToken"
Cohesion: 0.20
Nodes (12): applyLocalModeChrome(), applyProfileRow(), checkAuthToken(), clearStaleLocalSession(), currentStorageScope(), invalidateDayShapeCache(), isLocalMode(), maybeStartTutorial() (+4 more)

### Community 17 - "applyRemotePreferences"
Cohesion: 0.36
Nodes (9): applyRemotePreferences(), applyUiPrefs(), collectPreferences(), loadUiPrefs(), markPreferencesChanged(), prefsDeviceKey(), pushPreferences(), saveUiPrefs() (+1 more)

### Community 18 - "Bokea.Database"
Cohesion: 0.25
Nodes (5): DigestEndpoints, IEndpointRouteBuilder, Bokea.Database, Bokea.Services, Bokea.Endpoints

### Community 19 - "http"
Cohesion: 0.20
Nodes (9): ASPNETCORE_ENVIRONMENT, applicationUrl, commandName, dotnetRunMessages, environmentVariables, launchBrowser, profiles, http (+1 more)

### Community 20 - "Bokea.csproj"
Cohesion: 0.22
Nodes (8): net10.0, BCrypt.Net-Next (4.2.0), Microsoft.AspNetCore.Authentication.JwtBearer (10.0.9), Microsoft.EntityFrameworkCore.Sqlite (10.0.8), SQLitePCLRaw.bundle_e_sqlite3 (2.1.13), SQLitePCLRaw.lib.e_sqlite3 (2.1.13), WebPush (1.0.13), Microsoft.NET.Sdk.Web

### Community 21 - ".GetMorningDigestAsync"
Cohesion: 0.21
Nodes (9): DigestService, MorningDigestModel, RecommendedActions, TasksBySector, TotalWarningTasks, DateTime, List, Sector (+1 more)

### Community 22 - "manifest.json"
Cohesion: 0.22
Nodes (8): background_color, description, display, icons, name, short_name, start_url, theme_color

### Community 23 - "TaskState"
Cohesion: 0.50
Nodes (4): TaskState, Amber, Green, Red

### Community 24 - "openEditTaskModal"
Cohesion: 0.14
Nodes (32): clearFieldError(), clearTimeFieldComplaint(), clearValidationErrors(), commitmentSwitchOn(), dayShape(), fmtHM(), formatAppTime(), nowMinutes() (+24 more)

### Community 25 - "PushEndpoints.cs"
Cohesion: 0.33
Nodes (5): PushEndpoints, PushSubscriptionKeys, PushSubscriptionRequest, UnsubscribeRequest, IEndpointRouteBuilder

### Community 26 - "DigestTaskDto"
Cohesion: 0.29
Nodes (7): DigestTaskDto, Description, DueDate, Id, Sector, State, Title

### Community 27 - "Next steps — sync fixes (13 Sep 2026)"
Cohesion: 0.29
Nodes (6): 1. Run the database migration (Supabase), 2. Commit and deploy, 3. Check it on two devices, 4. Push notifications (needs building), 5. Known limits and choices made, Next steps — sync fixes (13 Sep 2026)

### Community 28 - "persistAppSettings"
Cohesion: 0.43
Nodes (7): applyAvatarEverywhere(), flashSaved(), persistAppSettings(), readLocalProfile(), requestSettingsSave(), setTheme(), updateGreetings()

### Community 29 - "vercel.json"
Cohesion: 0.33
Nodes (5): cleanUrls, outputDirectory, routes, trailingSlash, version

### Community 30 - "IntervalType"
Cohesion: 0.19
Nodes (9): IntervalType, FixedDate, IntervalBased, Workdays, Sector, CareerAndFinance, HealthAndVitality, MindAndEnvironment (+1 more)

### Community 32 - "toggleRowMenu"
Cohesion: 0.67
Nodes (4): closeRowMenus(), closeRowMenusAndReturn(), closeRowMenusOnOutside(), toggleRowMenu()

### Community 33 - "openSnoozeMenu"
Cohesion: 0.83
Nodes (4): closeSnoozeMenu(), closeSnoozeMenuOnEscape(), closeSnoozeMenuOnOutside(), openSnoozeMenu()

## Knowledge Gaps
- **154 isolated node(s):** `net10.0`, `BCrypt.Net-Next (4.2.0)`, `Microsoft.AspNetCore.Authentication.JwtBearer (10.0.9)`, `Microsoft.EntityFrameworkCore.Sqlite (10.0.8)`, `SQLitePCLRaw.bundle_e_sqlite3 (2.1.13)` (+149 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 200 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **2 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `TaskItem` connect `TaskItem` to `User`, `PushSubscription`, `.MapTaskEndpoints`, `DueDateType`, `TaskWatchdogService`, `AppDbContext`, `.GetMorningDigestAsync`, `TaskState`, `IntervalType`?**
  _High betweenness centrality (0.045) - this node is a cross-community bridge._
- **Why does `Bokea.Database` connect `Bokea.Database` to `ProfileAboutRequest`, `.MapTaskEndpoints`, `DueDateType`, `AppDbContext`, `PushEndpoints.cs`?**
  _High betweenness centrality (0.043) - this node is a cross-community bridge._
- **Why does `User` connect `User` to `ProfileAboutRequest`, `TaskItem`, `PushSubscription`, `DueDateType`, `AppDbContext`?**
  _High betweenness centrality (0.037) - this node is a cross-community bridge._
- **What connects `net10.0`, `BCrypt.Net-Next (4.2.0)`, `Microsoft.AspNetCore.Authentication.JwtBearer (10.0.9)` to the rest of the system?**
  _154 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `calDateStr` be split into smaller, more focused modules?**
  _Cohesion score 0.08862745098039215 - nodes in this community are weakly interconnected._
- **Should `app.js` be split into smaller, more focused modules?**
  _Cohesion score 0.04979591836734694 - nodes in this community are weakly interconnected._
- **Should `ProfileAboutRequest` be split into smaller, more focused modules?**
  _Cohesion score 0.06386554621848739 - nodes in this community are weakly interconnected._