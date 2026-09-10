# Graph Report - Bokea  (2026-09-10)

## Corpus Check
- cluster-only mode — file stats not available

## Summary
- 476 nodes · 958 edges · 33 communities (27 shown, 5 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 23 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `d56f1210`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- DigestTaskDto
- User
- app.js
- ProfileAboutRequest
- apiRequest
- propagateClockFormatChange
- loadProfileIntoForm
- onboarding.js
- TaskItem
- a11y.js
- taskWhen
- DueDateType
- .MapTaskEndpoints
- renderCalendarDay
- calculateTaskState
- renderNextUpTask
- http
- renderAnalyticsGraph
- Bokea.csproj
- manifest.json
- TaskCompletionLog
- vercel.json
- Sector
- renderAllTasksGrid
- TaskState
- openSnoozeMenu
- IntervalType
- sw.js
- Agent Instructions & Guidelines
- IEndpointRouteBuilder
- List
- User

## God Nodes (most connected - your core abstractions)
1. `TaskItem` - 34 edges
2. `User` - 29 edges
3. `apiRequest()` - 22 edges
4. `AppDbContext` - 19 edges
5. `taskWhen()` - 19 edges
6. `loadDashboardData()` - 19 edges
7. `renderCalendarDay()` - 17 edges
8. `loadProfileIntoForm()` - 17 edges
9. `showToast()` - 16 edges
10. `DueDateType` - 15 edges

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

## Communities (33 total, 5 thin omitted)

### Community 0 - "DigestTaskDto"
Cohesion: 0.05
Nodes (36): BackgroundService, Task, DigestEndpoints, IEndpointRouteBuilder, PushEndpoints, PushSubscriptionKeys, PushSubscriptionRequest, UnsubscribeRequest (+28 more)

### Community 1 - "User"
Cohesion: 0.05
Nodes (43): AppDbContext, PushSubscriptions, TaskCompletionLogs, Tasks, Users, DbInitializer, User, PushSubscription (+35 more)

### Community 2 - "app.js"
Cohesion: 0.06
Nodes (28): authBackendReady(), CAL_DAYS, CAL_MONTHS, CAL_RANK, calFocusStr, calViewDate, checkAuthToken(), clearStaleLocalSession() (+20 more)

### Community 3 - "ProfileAboutRequest"
Cohesion: 0.07
Nodes (29): AuthEndpoints, LoginRequest, Email, Password, ProfileAboutRequest, AvatarDataUrl, Bio, City (+21 more)

### Community 4 - "apiRequest"
Cohesion: 0.14
Nodes (30): addSampleTasks(), apiRequest(), captureTime(), closeFocus(), closeRowConfirm(), commitCapture(), completeTask(), deleteTask() (+22 more)

### Community 5 - "propagateClockFormatChange"
Cohesion: 0.14
Nodes (27): applyUiPrefs(), clearValidationErrors(), dayShape(), fmtHM(), formatAppTime(), loadUiPrefs(), nowMinutes(), openCreateTaskModal() (+19 more)

### Community 6 - "loadProfileIntoForm"
Cohesion: 0.20
Nodes (23): ageFromDob(), applyAvatarEverywhere(), collectProfile(), deviceTimeZone(), fillCountryList(), fillTimeZoneSelect(), flashSaved(), keepUnlistedOption() (+15 more)

### Community 7 - "onboarding.js"
Cohesion: 0.23
Nodes (21): buildChrome(), clearHighlights(), currentTarget(), end(), esc(), go(), handleAction(), hasContentToShow() (+13 more)

### Community 8 - "TaskItem"
Cohesion: 0.10
Nodes (20): TaskItem, CompletionLogs, CreatedAt, Description, DisplayOrder, DueDate, DueDateValue, DueTime (+12 more)

### Community 9 - "a11y.js"
Cohesion: 0.18
Nodes (15): announce(), apply(), ensureRegions(), focusableWithin(), load(), prefersReducedMotion(), save(), set() (+7 more)

### Community 10 - "taskWhen"
Cohesion: 0.25
Nodes (17): areaMeta(), cadenceText(), renderAfterThat(), renderFocusClock(), renderRightNow(), startFocus(), stateMeta(), taskMinutes() (+9 more)

### Community 11 - "DueDateType"
Cohesion: 0.17
Nodes (10): DueDateType, HasValue, Value, DueDateTypeJsonConverter, IEquatable, JsonConverter, JsonSerializerOptions, Type (+2 more)

### Community 12 - ".MapTaskEndpoints"
Cohesion: 0.19
Nodes (10): Sector, CompleteTaskRequest, CreateTaskRequest, ReorderTaskRequest, SnoozeTaskRequest, TaskEndpoints, UpdateTaskRequest, WhenInTheDay (+2 more)

### Community 13 - "renderCalendarDay"
Cohesion: 0.27
Nodes (14): calCloseDay(), calDateStr(), calGridKeydown(), calNowLine(), calOpenDayFocus(), calParse(), calShiftMonth(), calStateCls() (+6 more)

### Community 14 - "calculateTaskState"
Cohesion: 0.24
Nodes (11): calculateTaskState(), calDatedTasksForDate(), calIsDaily(), getTasksForDate(), handleLocalStorageFallback(), initLocalStorage(), mapBackendTask(), readStore() (+3 more)

### Community 15 - "renderNextUpTask"
Cohesion: 0.22
Nodes (11): dismissFirstRun(), firstRunDismissed(), nextWindowLabel(), refreshIcons(), renderFirstRun(), renderMomentum(), renderNavCount(), renderNextUpTask() (+3 more)

### Community 16 - "http"
Cohesion: 0.20
Nodes (9): ASPNETCORE_ENVIRONMENT, applicationUrl, commandName, dotnetRunMessages, environmentVariables, launchBrowser, profiles, http (+1 more)

### Community 17 - "renderAnalyticsGraph"
Cohesion: 0.22
Nodes (10): calculateSleepDuration(), hideChartTooltip(), loadSettingsIntoForm(), renderAnalyticsDataTable(), renderAnalyticsGraph(), setTheme(), showChartTooltip(), switchTab() (+2 more)

### Community 18 - "Bokea.csproj"
Cohesion: 0.22
Nodes (8): net10.0, BCrypt.Net-Next (4.2.0), Microsoft.AspNetCore.Authentication.JwtBearer (10.0.9), Microsoft.EntityFrameworkCore.Sqlite (10.0.8), SQLitePCLRaw.bundle_e_sqlite3 (2.1.13), SQLitePCLRaw.lib.e_sqlite3 (2.1.13), WebPush (1.0.13), Microsoft.NET.Sdk.Web

### Community 19 - "manifest.json"
Cohesion: 0.22
Nodes (8): background_color, description, display, icons, name, short_name, start_url, theme_color

### Community 20 - "TaskCompletionLog"
Cohesion: 0.33
Nodes (6): TaskCompletionLog, CompletedAt, Id, Notes, TaskId, DateTime

### Community 21 - "vercel.json"
Cohesion: 0.33
Nodes (5): cleanUrls, outputDirectory, routes, trailingSlash, version

### Community 22 - "Sector"
Cohesion: 0.40
Nodes (5): Sector, CareerAndFinance, HealthAndVitality, MindAndEnvironment, RelationshipsAndSocial

### Community 23 - "renderAllTasksGrid"
Cohesion: 0.50
Nodes (5): autoSegment(), renderAllTasksGrid(), segmentOf(), syncSegmentButtons(), taskDoneOn()

### Community 24 - "TaskState"
Cohesion: 0.50
Nodes (4): TaskState, Amber, Green, Red

### Community 25 - "openSnoozeMenu"
Cohesion: 0.83
Nodes (4): closeSnoozeMenu(), closeSnoozeMenuOnEscape(), closeSnoozeMenuOnOutside(), openSnoozeMenu()

### Community 26 - "IntervalType"
Cohesion: 0.67
Nodes (3): IntervalType, FixedDate, IntervalBased

## Knowledge Gaps
- **144 isolated node(s):** `UnsubscribeRequest`, `ReorderTaskRequest`, `Description`, `DueDate`, `Id` (+139 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 186 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **5 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `TaskItem` connect `TaskItem` to `DigestTaskDto`, `User`, `DueDateType`, `.MapTaskEndpoints`, `TaskCompletionLog`, `TaskState`, `IntervalType`?**
  _High betweenness centrality (0.055) - this node is a cross-community bridge._
- **Why does `Bokea.Endpoints` connect `DigestTaskDto` to `ProfileAboutRequest`, `.MapTaskEndpoints`?**
  _High betweenness centrality (0.054) - this node is a cross-community bridge._
- **Why does `Bokea.Database` connect `DigestTaskDto` to `User`, `DueDateType`, `.MapTaskEndpoints`?**
  _High betweenness centrality (0.051) - this node is a cross-community bridge._
- **What connects `UnsubscribeRequest`, `ReorderTaskRequest`, `Description` to the rest of the system?**
  _144 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `DigestTaskDto` be split into smaller, more focused modules?**
  _Cohesion score 0.054901960784313725 - nodes in this community are weakly interconnected._
- **Should `User` be split into smaller, more focused modules?**
  _Cohesion score 0.047619047619047616 - nodes in this community are weakly interconnected._
- **Should `app.js` be split into smaller, more focused modules?**
  _Cohesion score 0.06342780026990553 - nodes in this community are weakly interconnected._