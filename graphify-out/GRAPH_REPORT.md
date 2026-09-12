# Graph Report - Bokea  (2026-09-12)

## Corpus Check
- cluster-only mode — file stats not available

## Summary
- 505 nodes · 1045 edges · 36 communities (28 shown, 6 thin omitted)
- Extraction: 97% EXTRACTED · 3% INFERRED · 0% AMBIGUOUS · INFERRED: 27 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `49f590d4`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- calDateStr
- app.js
- apiRequest
- DueDateType
- ProfileAboutRequest
- User
- onboarding.js
- TaskItem
- a11y.js
- openEditTaskModal
- loadProfileIntoForm
- checkAuthToken
- AppDbContext
- prepareIncomingView
- .GetMorningDigestAsync
- .RecalculateTaskStatesAsync
- http
- Bokea.csproj
- manifest.json
- TaskCompletionLog
- PushSubscription
- PushEndpoints.cs
- DigestTaskDto
- vercel.json
- Task
- Bokea.Endpoints
- Bokea.Database
- TaskState
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

## Communities (36 total, 6 thin omitted)

### Community 0 - "calDateStr"
Cohesion: 0.09
Nodes (56): areaMeta(), autoSegment(), cadenceText(), calCloseDay(), calDateStr(), calGridKeydown(), calNowLine(), calOpenDayFocus() (+48 more)

### Community 1 - "app.js"
Cohesion: 0.05
Nodes (32): applyUiPrefs(), authBackendReady(), CAL_DAYS, CAL_MONTHS, CAL_RANK, calFocusStr, calViewDate, dismissFirstRun() (+24 more)

### Community 2 - "apiRequest"
Cohesion: 0.09
Nodes (44): addSampleTasks(), apiRequest(), calculateTaskState(), calDatedTasksForDate(), calIsDaily(), captureTime(), closeFocus(), closeRowConfirm() (+36 more)

### Community 3 - "DueDateType"
Cohesion: 0.07
Nodes (29): DueDateType, HasValue, Value, DueDateTypeJsonConverter, IntervalType, FixedDate, IntervalBased, Workdays (+21 more)

### Community 4 - "ProfileAboutRequest"
Cohesion: 0.07
Nodes (29): AuthEndpoints, LoginRequest, Email, Password, ProfileAboutRequest, AvatarDataUrl, Bio, City (+21 more)

### Community 5 - "User"
Cohesion: 0.09
Nodes (23): User, AvatarDataUrl, BedTime, Bio, City, Country, CreatedAt, DateOfBirth (+15 more)

### Community 6 - "onboarding.js"
Cohesion: 0.23
Nodes (21): buildChrome(), clearHighlights(), currentTarget(), end(), esc(), go(), handleAction(), hasContentToShow() (+13 more)

### Community 7 - "TaskItem"
Cohesion: 0.10
Nodes (21): TaskItem, CompletionLogs, CreatedAt, Description, DisplayOrder, DueDate, DueDateValue, DueTime (+13 more)

### Community 8 - "a11y.js"
Cohesion: 0.18
Nodes (15): announce(), apply(), ensureRegions(), focusableWithin(), load(), prefersReducedMotion(), save(), set() (+7 more)

### Community 9 - "openEditTaskModal"
Cohesion: 0.18
Nodes (18): clearFieldError(), clearTimeFieldComplaint(), clearValidationErrors(), closeRowMenus(), closeRowMenusAndReturn(), closeRowMenusOnOutside(), formatAppTime(), openCreateTaskModal() (+10 more)

### Community 10 - "loadProfileIntoForm"
Cohesion: 0.29
Nodes (17): ageFromDob(), collectProfile(), deviceTimeZone(), fillCountryList(), fillTimeZoneSelect(), keepUnlistedOption(), loadProfileIntoForm(), normalizeGender() (+9 more)

### Community 11 - "checkAuthToken"
Cohesion: 0.16
Nodes (17): applyAvatarEverywhere(), applyLocalModeChrome(), checkAuthToken(), clearStaleLocalSession(), currentStorageScope(), flashSaved(), invalidateDayShapeCache(), isLocalMode() (+9 more)

### Community 12 - "AppDbContext"
Cohesion: 0.18
Nodes (10): AppDbContext, PushSubscriptions, TaskCompletionLogs, Tasks, Users, DbInitializer, User, DbContext (+2 more)

### Community 13 - "prepareIncomingView"
Cohesion: 0.18
Nodes (14): calculateSleepDuration(), cleanupIncomingView(), hideChartTooltip(), loadSettingsIntoForm(), onTouchEnd(), onTouchMove(), prepareIncomingView(), renderAnalyticsDataTable() (+6 more)

### Community 14 - ".GetMorningDigestAsync"
Cohesion: 0.21
Nodes (9): DigestService, MorningDigestModel, RecommendedActions, TasksBySector, TotalWarningTasks, DateTime, List, Sector (+1 more)

### Community 15 - ".RecalculateTaskStatesAsync"
Cohesion: 0.24
Nodes (8): AppDbContext, BackgroundService, TaskWatchdogService, DateTime, CancellationToken, ILogger, IServiceScopeFactory, PushNotificationService

### Community 16 - "http"
Cohesion: 0.20
Nodes (9): ASPNETCORE_ENVIRONMENT, applicationUrl, commandName, dotnetRunMessages, environmentVariables, launchBrowser, profiles, http (+1 more)

### Community 17 - "Bokea.csproj"
Cohesion: 0.22
Nodes (8): net10.0, BCrypt.Net-Next (4.2.0), Microsoft.AspNetCore.Authentication.JwtBearer (10.0.9), Microsoft.EntityFrameworkCore.Sqlite (10.0.8), SQLitePCLRaw.bundle_e_sqlite3 (2.1.13), SQLitePCLRaw.lib.e_sqlite3 (2.1.13), WebPush (1.0.13), Microsoft.NET.Sdk.Web

### Community 18 - "manifest.json"
Cohesion: 0.22
Nodes (8): background_color, description, display, icons, name, short_name, start_url, theme_color

### Community 19 - "TaskCompletionLog"
Cohesion: 0.25
Nodes (7): TaskCompletionLog, CompletedAt, Id, Notes, TaskId, DateTime, ModelBuilder

### Community 20 - "PushSubscription"
Cohesion: 0.25
Nodes (8): PushSubscription, Auth, CreatedAt, Endpoint, Id, P256dh, User, UserId

### Community 21 - "PushEndpoints.cs"
Cohesion: 0.33
Nodes (5): PushEndpoints, PushSubscriptionKeys, PushSubscriptionRequest, UnsubscribeRequest, IEndpointRouteBuilder

### Community 22 - "DigestTaskDto"
Cohesion: 0.29
Nodes (7): DigestTaskDto, Description, DueDate, Id, Sector, State, Title

### Community 23 - "vercel.json"
Cohesion: 0.33
Nodes (5): cleanUrls, outputDirectory, routes, trailingSlash, version

### Community 24 - "Task"
Cohesion: 0.40
Nodes (4): Task, PushNotificationService, ILogger, VapidDetails

### Community 25 - "Bokea.Endpoints"
Cohesion: 0.40
Nodes (3): DigestEndpoints, IEndpointRouteBuilder, Bokea.Endpoints

### Community 27 - "TaskState"
Cohesion: 0.50
Nodes (4): TaskState, Amber, Green, Red

### Community 28 - "openSnoozeMenu"
Cohesion: 0.83
Nodes (4): closeSnoozeMenu(), closeSnoozeMenuOnEscape(), closeSnoozeMenuOnOutside(), openSnoozeMenu()

## Knowledge Gaps
- **146 isolated node(s):** `UnsubscribeRequest`, `ReorderTaskRequest`, `CAL_DAYS`, `CAL_MONTHS`, `CAL_RANK` (+141 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 196 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **6 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `TaskItem` connect `TaskItem` to `DueDateType`, `User`, `AppDbContext`, `.GetMorningDigestAsync`, `.RecalculateTaskStatesAsync`, `TaskCompletionLog`, `TaskState`?**
  _High betweenness centrality (0.052) - this node is a cross-community bridge._
- **Why does `Bokea.Database` connect `Bokea.Database` to `PushEndpoints.cs`, `DueDateType`, `AppDbContext`, `ProfileAboutRequest`?**
  _High betweenness centrality (0.041) - this node is a cross-community bridge._
- **Why does `User` connect `User` to `DueDateType`, `ProfileAboutRequest`, `TaskItem`, `AppDbContext`, `TaskCompletionLog`, `PushSubscription`?**
  _High betweenness centrality (0.040) - this node is a cross-community bridge._
- **What connects `UnsubscribeRequest`, `ReorderTaskRequest`, `CAL_DAYS` to the rest of the system?**
  _146 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `calDateStr` be split into smaller, more focused modules?**
  _Cohesion score 0.09285714285714286 - nodes in this community are weakly interconnected._
- **Should `app.js` be split into smaller, more focused modules?**
  _Cohesion score 0.05272895467160037 - nodes in this community are weakly interconnected._
- **Should `apiRequest` be split into smaller, more focused modules?**
  _Cohesion score 0.0919661733615222 - nodes in this community are weakly interconnected._