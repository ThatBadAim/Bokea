# Graph Report - Bokea  (2026-09-09)

## Corpus Check
- 24 files · ~159,190 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 468 nodes · 936 edges · 28 communities (24 shown, 3 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 22 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `5b20c50f`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- taskWhen
- DueDateType
- app.js
- ProfileAboutRequest
- User
- onboarding.js
- TaskItem
- loadProfileIntoForm
- apiRequest
- a11y.js
- AppDbContext
- TaskWatchdogService
- persistAppSettings
- http
- renderAnalyticsGraph
- Bokea.csproj
- manifest.json
- PushSubscription
- calculateTaskState
- openEditTaskModal
- DigestTaskDto
- vercel.json
- TaskState
- openSnoozeMenu
- sw.js
- Agent Instructions & Guidelines
- Project Specification & Task Tracker

## God Nodes (most connected - your core abstractions)
1. `TaskItem` - 34 edges
2. `User` - 31 edges
3. `apiRequest()` - 22 edges
4. `AppDbContext` - 19 edges
5. `loadDashboardData()` - 19 edges
6. `taskWhen()` - 19 edges
7. `renderCalendarDay()` - 18 edges
8. `showToast()` - 16 edges
9. `persistAppSettings()` - 16 edges
10. `DueDateType` - 15 edges

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

## Communities (28 total, 3 thin omitted)

### Community 0 - "taskWhen"
Cohesion: 0.09
Nodes (58): areaMeta(), autoSegment(), cadenceText(), calCloseDay(), calDateStr(), calGridKeydown(), calNowLine(), calOpenDayFocus() (+50 more)

### Community 1 - "DueDateType"
Cohesion: 0.07
Nodes (28): DueDateType, HasValue, Value, DueDateTypeJsonConverter, IntervalType, FixedDate, IntervalBased, Sector (+20 more)

### Community 2 - "app.js"
Cohesion: 0.06
Nodes (28): applyUiPrefs(), authBackendReady(), CAL_DAYS, CAL_MONTHS, CAL_RANK, calDatedTasksForDate(), calFocusStr, calIsDaily() (+20 more)

### Community 3 - "ProfileAboutRequest"
Cohesion: 0.06
Nodes (29): AuthEndpoints, LoginRequest, Email, Password, ProfileAboutRequest, AvatarDataUrl, Bio, City (+21 more)

### Community 4 - "User"
Cohesion: 0.09
Nodes (23): User, AvatarDataUrl, BedTime, Bio, City, Country, CreatedAt, DateOfBirth (+15 more)

### Community 5 - "onboarding.js"
Cohesion: 0.23
Nodes (21): buildChrome(), clearHighlights(), currentTarget(), end(), esc(), go(), handleAction(), hasContentToShow() (+13 more)

### Community 6 - "TaskItem"
Cohesion: 0.10
Nodes (21): TaskItem, CompletionLogs, CreatedAt, Description, DisplayOrder, DueDate, DueDateValue, DueTime (+13 more)

### Community 7 - "loadProfileIntoForm"
Cohesion: 0.31
Nodes (15): ageFromDob(), collectProfile(), deviceTimeZone(), fillCountryList(), fillTimeZoneSelect(), keepUnlistedOption(), loadProfileIntoForm(), persistProfile() (+7 more)

### Community 8 - "apiRequest"
Cohesion: 0.14
Nodes (29): addSampleTasks(), apiRequest(), captureTime(), closeFocus(), closeRowConfirm(), commitCapture(), completeTask(), deleteTask() (+21 more)

### Community 9 - "a11y.js"
Cohesion: 0.18
Nodes (15): announce(), apply(), ensureRegions(), focusableWithin(), load(), prefersReducedMotion(), save(), set() (+7 more)

### Community 10 - "AppDbContext"
Cohesion: 0.18
Nodes (10): AppDbContext, PushSubscriptions, TaskCompletionLogs, Tasks, Users, DbInitializer, User, DbContext (+2 more)

### Community 11 - "TaskWatchdogService"
Cohesion: 0.20
Nodes (10): BackgroundService, Task, PushNotificationService, ILogger, TaskWatchdogService, DateTime, ILogger, CancellationToken (+2 more)

### Community 12 - "persistAppSettings"
Cohesion: 0.18
Nodes (15): applyAvatarEverywhere(), checkAuthToken(), clearStaleLocalSession(), currentStorageScope(), flashSaved(), initSetupPageListeners(), invalidateDayShapeCache(), maybeStartTutorial() (+7 more)

### Community 13 - "http"
Cohesion: 0.20
Nodes (9): ASPNETCORE_ENVIRONMENT, applicationUrl, commandName, dotnetRunMessages, environmentVariables, launchBrowser, profiles, http (+1 more)

### Community 14 - "renderAnalyticsGraph"
Cohesion: 0.22
Nodes (10): calculateSleepDuration(), hideChartTooltip(), loadSettingsIntoForm(), renderAnalyticsDataTable(), renderAnalyticsGraph(), setTheme(), showChartTooltip(), switchTab() (+2 more)

### Community 15 - "Bokea.csproj"
Cohesion: 0.22
Nodes (8): net10.0, BCrypt.Net-Next (4.2.0), Microsoft.AspNetCore.Authentication.JwtBearer (10.0.9), Microsoft.EntityFrameworkCore.Sqlite (10.0.8), SQLitePCLRaw.bundle_e_sqlite3 (2.1.13), SQLitePCLRaw.lib.e_sqlite3 (2.1.13), WebPush (1.0.13), Microsoft.NET.Sdk.Web

### Community 16 - "manifest.json"
Cohesion: 0.22
Nodes (8): background_color, description, display, icons, name, short_name, start_url, theme_color

### Community 17 - "PushSubscription"
Cohesion: 0.13
Nodes (15): PushSubscription, Auth, CreatedAt, Endpoint, Id, P256dh, User, UserId (+7 more)

### Community 20 - "calculateTaskState"
Cohesion: 0.36
Nodes (8): calculateTaskState(), handleLocalStorageFallback(), initLocalStorage(), readStore(), renderNotifications(), taskGraceRatio(), taskIsCommitment(), updateLocalHistory()

### Community 21 - "openEditTaskModal"
Cohesion: 0.39
Nodes (8): clearValidationErrors(), openCreateTaskModal(), openEditTaskModal(), openModal(), setCommitmentSwitch(), showStep(), syncSaveEnabled(), syncTaskNameUI()

### Community 22 - "DigestTaskDto"
Cohesion: 0.07
Nodes (26): DigestEndpoints, IEndpointRouteBuilder, PushEndpoints, PushSubscriptionKeys, PushSubscriptionRequest, UnsubscribeRequest, IEndpointRouteBuilder, DigestService (+18 more)

### Community 26 - "vercel.json"
Cohesion: 0.33
Nodes (5): cleanUrls, outputDirectory, routes, trailingSlash, version

### Community 29 - "TaskState"
Cohesion: 0.50
Nodes (4): TaskState, Amber, Green, Red

### Community 31 - "openSnoozeMenu"
Cohesion: 0.83
Nodes (4): closeSnoozeMenu(), closeSnoozeMenuOnEscape(), closeSnoozeMenuOnOutside(), openSnoozeMenu()

## Knowledge Gaps
- **145 isolated node(s):** `net10.0`, `BCrypt.Net-Next (4.2.0)`, `Microsoft.AspNetCore.Authentication.JwtBearer (10.0.9)`, `Microsoft.EntityFrameworkCore.Sqlite (10.0.8)`, `SQLitePCLRaw.bundle_e_sqlite3 (2.1.13)` (+140 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 185 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **3 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `TaskItem` connect `TaskItem` to `DueDateType`, `User`, `AppDbContext`, `TaskWatchdogService`, `PushSubscription`, `DigestTaskDto`, `TaskState`?**
  _High betweenness centrality (0.059) - this node is a cross-community bridge._
- **Why does `Bokea.Database` connect `DigestTaskDto` to `DueDateType`, `AppDbContext`, `ProfileAboutRequest`?**
  _High betweenness centrality (0.057) - this node is a cross-community bridge._
- **Why does `User` connect `User` to `DueDateType`, `ProfileAboutRequest`, `TaskItem`, `AppDbContext`, `PushSubscription`?**
  _High betweenness centrality (0.049) - this node is a cross-community bridge._
- **What connects `net10.0`, `BCrypt.Net-Next (4.2.0)`, `Microsoft.AspNetCore.Authentication.JwtBearer (10.0.9)` to the rest of the system?**
  _145 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `taskWhen` be split into smaller, more focused modules?**
  _Cohesion score 0.0852994555353902 - nodes in this community are weakly interconnected._
- **Should `DueDateType` be split into smaller, more focused modules?**
  _Cohesion score 0.06882591093117409 - nodes in this community are weakly interconnected._
- **Should `app.js` be split into smaller, more focused modules?**
  _Cohesion score 0.06401137980085349 - nodes in this community are weakly interconnected._