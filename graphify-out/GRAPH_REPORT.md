# Graph Report - Bokea  (2026-09-13)

## Corpus Check
- cluster-only mode — file stats not available

## Summary
- 515 nodes · 1062 edges · 36 communities (29 shown, 5 thin omitted)
- Extraction: 97% EXTRACTED · 3% INFERRED · 0% AMBIGUOUS · INFERRED: 27 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `436ba95e`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- calDateStr
- DigestTaskDto
- User
- app.js
- ProfileAboutRequest
- apiRequest
- loadProfileIntoForm
- onboarding.js
- TaskItem
- a11y.js
- DueDateType
- .MapTaskEndpoints
- prepareIncomingView
- calculateTaskState
- openEditTaskModal
- http
- Bokea.csproj
- manifest.json
- openAvatarCropper
- TaskCompletionLog
- vercel.json
- Sector
- applyUiPrefs
- promptSignUpFromLocal
- refreshStorageScope
- IntervalType
- TaskState
- toggleRowMenu
- openSnoozeMenu
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
- `AppDbContext` --references--> `TaskCompletionLog`  [EXTRACTED]
  Bokeà/Database/AppDbContext.cs → Bokeà/Database/Models.cs
- `AppDbContext` --references--> `TaskItem`  [EXTRACTED]
  Bokeà/Database/AppDbContext.cs → Bokeà/Database/Models.cs
- `AppDbContext` --references--> `PushSubscription`  [EXTRACTED]
  Bokeà/Database/AppDbContext.cs → Bokeà/Database/Models.cs

## Import Cycles
- None detected.

## Communities (36 total, 5 thin omitted)

### Community 0 - "calDateStr"
Cohesion: 0.11
Nodes (55): areaMeta(), autoSegment(), cadenceText(), calCloseDay(), calDateStr(), calGridKeydown(), calNowLine(), calParse() (+47 more)

### Community 1 - "DigestTaskDto"
Cohesion: 0.05
Nodes (38): AppDbContext, BackgroundService, Task, DigestEndpoints, IEndpointRouteBuilder, PushEndpoints, PushSubscriptionKeys, PushSubscriptionRequest (+30 more)

### Community 2 - "User"
Cohesion: 0.05
Nodes (42): AppDbContext, PushSubscriptions, TaskCompletionLogs, Tasks, Users, DbInitializer, User, PushSubscription (+34 more)

### Community 3 - "app.js"
Cohesion: 0.05
Nodes (31): CAL_DAYS, CAL_MONTHS, CAL_RANK, calFocusStr, calOpenDayFocus(), calStateCls(), calViewDate, clearTimeFieldComplaint() (+23 more)

### Community 4 - "ProfileAboutRequest"
Cohesion: 0.07
Nodes (29): AuthEndpoints, LoginRequest, Email, Password, ProfileAboutRequest, AvatarDataUrl, Bio, City (+21 more)

### Community 5 - "apiRequest"
Cohesion: 0.13
Nodes (33): addSampleTasks(), apiRequest(), applyLocalModeChrome(), checkAuthToken(), clearStaleLocalSession(), closeFocus(), closeRowConfirm(), completeTask() (+25 more)

### Community 6 - "loadProfileIntoForm"
Cohesion: 0.22
Nodes (22): ageFromDob(), applyAvatarEverywhere(), collectProfile(), deviceTimeZone(), fillCountryList(), fillTimeZoneSelect(), keepUnlistedOption(), loadProfileIntoForm() (+14 more)

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

### Community 11 - ".MapTaskEndpoints"
Cohesion: 0.19
Nodes (10): Sector, CompleteTaskRequest, CreateTaskRequest, ReorderTaskRequest, SnoozeTaskRequest, TaskEndpoints, UpdateTaskRequest, WhenInTheDay (+2 more)

### Community 12 - "prepareIncomingView"
Cohesion: 0.18
Nodes (14): calculateSleepDuration(), cleanupIncomingView(), hideChartTooltip(), loadSettingsIntoForm(), onTouchEnd(), onTouchMove(), prepareIncomingView(), renderAnalyticsDataTable() (+6 more)

### Community 13 - "calculateTaskState"
Cohesion: 0.22
Nodes (13): calculateTaskState(), calDatedTasksForDate(), calIsDaily(), getTasksForDate(), handleLocalStorageFallback(), initLocalStorage(), isDateWorkday(), mapBackendTask() (+5 more)

### Community 14 - "openEditTaskModal"
Cohesion: 0.29
Nodes (11): clearFieldError(), clearValidationErrors(), formatWorkDaysSummary(), getUserWorkDays(), openCreateTaskModal(), openEditTaskModal(), openModal(), setCommitmentSwitch() (+3 more)

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

### Community 19 - "TaskCompletionLog"
Cohesion: 0.33
Nodes (6): TaskCompletionLog, CompletedAt, Id, Notes, TaskId, DateTime

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

### Community 24 - "refreshStorageScope"
Cohesion: 0.40
Nodes (5): currentStorageScope(), invalidateDayShapeCache(), migrateLegacyStorage(), refreshStorageScope(), setStorageScope()

### Community 25 - "IntervalType"
Cohesion: 0.50
Nodes (4): IntervalType, FixedDate, IntervalBased, Workdays

### Community 26 - "TaskState"
Cohesion: 0.50
Nodes (4): TaskState, Amber, Green, Red

### Community 27 - "toggleRowMenu"
Cohesion: 0.67
Nodes (4): closeRowMenus(), closeRowMenusAndReturn(), closeRowMenusOnOutside(), toggleRowMenu()

### Community 28 - "openSnoozeMenu"
Cohesion: 0.83
Nodes (4): closeSnoozeMenu(), closeSnoozeMenuOnEscape(), closeSnoozeMenuOnOutside(), openSnoozeMenu()

## Knowledge Gaps
- **146 isolated node(s):** `UnsubscribeRequest`, `ReorderTaskRequest`, `RecommendedActions`, `TasksBySector`, `TotalWarningTasks` (+141 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 198 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **5 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `TaskItem` connect `TaskItem` to `DigestTaskDto`, `User`, `DueDateType`, `.MapTaskEndpoints`, `TaskCompletionLog`, `IntervalType`, `TaskState`?**
  _High betweenness centrality (0.050) - this node is a cross-community bridge._
- **Why does `Bokea.Database` connect `DigestTaskDto` to `.MapTaskEndpoints`, `User`, `DueDateType`, `ProfileAboutRequest`?**
  _High betweenness centrality (0.040) - this node is a cross-community bridge._
- **Why does `User` connect `User` to `TaskItem`, `DueDateType`, `TaskCompletionLog`, `ProfileAboutRequest`?**
  _High betweenness centrality (0.039) - this node is a cross-community bridge._
- **What connects `UnsubscribeRequest`, `ReorderTaskRequest`, `RecommendedActions` to the rest of the system?**
  _146 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `calDateStr` be split into smaller, more focused modules?**
  _Cohesion score 0.10572390572390572 - nodes in this community are weakly interconnected._
- **Should `DigestTaskDto` be split into smaller, more focused modules?**
  _Cohesion score 0.05128205128205128 - nodes in this community are weakly interconnected._
- **Should `User` be split into smaller, more focused modules?**
  _Cohesion score 0.04875886524822695 - nodes in this community are weakly interconnected._