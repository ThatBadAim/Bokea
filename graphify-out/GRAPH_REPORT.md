# Graph Report - Bokea  (2026-09-13)

## Corpus Check
- cluster-only mode — file stats not available

## Summary
- 545 nodes · 1121 edges · 40 communities (35 shown, 4 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 24 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `be2d608b`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- loadDashboardData
- app.js
- ProfileAboutRequest
- apiRequest
- loadProfileIntoForm
- User
- TaskItem
- onboarding.js
- openEditTaskModal
- PushSubscription
- a11y.js
- .MapTaskEndpoints
- initSetupPageListeners
- DueDateType
- TaskWatchdogService
- AppDbContext
- prepareIncomingView
- .GetMorningDigestAsync
- applyRemotePreferences
- http
- Bokea.csproj
- Sector
- manifest.json
- openAvatarCropper
- Bokea.Services
- PushEndpoints.cs
- DigestTaskDto
- Next steps — sync fixes (13 Sep 2026)
- Bokea.Database
- vercel.json
- promptSignUpFromLocal
- IntervalType
- routeApiRequest
- toggleRowMenu
- openSnoozeMenu
- sw.js
- Agent Instructions & Guidelines
- IEndpointRouteBuilder
- ILogger

## God Nodes (most connected - your core abstractions)
1. `TaskItem` - 32 edges
2. `User` - 31 edges
3. `loadDashboardData()` - 23 edges
4. `calDateStr()` - 22 edges
5. `renderNextUpTask()` - 19 edges
6. `taskWhen()` - 19 edges
7. `AppDbContext` - 18 edges
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

## Communities (40 total, 4 thin omitted)

### Community 0 - "loadDashboardData"
Cohesion: 0.08
Nodes (68): areaMeta(), autoSegment(), cadenceText(), calculateTaskState(), calDatedTasksForDate(), calDateStr(), calIsDaily(), calNowLine() (+60 more)

### Community 1 - "app.js"
Cohesion: 0.05
Nodes (24): CAL_DAYS, CAL_MONTHS, CAL_RANK, calFocusStr, calViewDate, dismissedNotificationsKey(), dueDateGroup, getActiveMobileTab() (+16 more)

### Community 2 - "ProfileAboutRequest"
Cohesion: 0.06
Nodes (29): AuthEndpoints, LoginRequest, Email, Password, ProfileAboutRequest, AvatarDataUrl, Bio, City (+21 more)

### Community 3 - "apiRequest"
Cohesion: 0.14
Nodes (25): addSampleTasks(), apiRequest(), closeFocus(), closeRowConfirm(), completeTask(), deleteTask(), disablePushNotifications(), dismissFirstRun() (+17 more)

### Community 4 - "loadProfileIntoForm"
Cohesion: 0.20
Nodes (24): ageFromDob(), applyAvatarEverywhere(), collectProfile(), deviceTimeZone(), fillCountryList(), fillTimeZoneSelect(), flashSaved(), keepUnlistedOption() (+16 more)

### Community 5 - "User"
Cohesion: 0.09
Nodes (23): User, AvatarDataUrl, BedTime, Bio, City, Country, CreatedAt, DateOfBirth (+15 more)

### Community 6 - "TaskItem"
Cohesion: 0.09
Nodes (22): TaskItem, CompletionLogs, CreatedAt, Description, DisplayOrder, DueDate, DueDateValue, DueTime (+14 more)

### Community 7 - "onboarding.js"
Cohesion: 0.23
Nodes (21): buildChrome(), clearHighlights(), currentTarget(), end(), esc(), go(), handleAction(), hasContentToShow() (+13 more)

### Community 8 - "openEditTaskModal"
Cohesion: 0.19
Nodes (19): calCloseDay(), calGridKeydown(), calParse(), calShiftMonth(), captureTime(), clearFieldError(), clearValidationErrors(), commitCapture() (+11 more)

### Community 9 - "PushSubscription"
Cohesion: 0.12
Nodes (16): PushSubscription, Auth, CreatedAt, Endpoint, Id, P256dh, User, UserId (+8 more)

### Community 10 - "a11y.js"
Cohesion: 0.18
Nodes (15): announce(), apply(), ensureRegions(), focusableWithin(), load(), prefersReducedMotion(), save(), set() (+7 more)

### Community 11 - ".MapTaskEndpoints"
Cohesion: 0.16
Nodes (12): CompleteTaskRequest, CreateTaskRequest, ReorderTaskRequest, SnoozeTaskRequest, TaskEndpoints, UpdateTaskRequest, WhenInTheDay, DateTime (+4 more)

### Community 12 - "initSetupPageListeners"
Cohesion: 0.18
Nodes (17): applyLocalModeChrome(), applyProfileRow(), checkAuthToken(), clearStaleLocalSession(), currentStorageScope(), handleLocalStorageFallback(), initLocalStorage(), initSetupPageListeners() (+9 more)

### Community 13 - "DueDateType"
Cohesion: 0.17
Nodes (10): DueDateType, HasValue, Value, DueDateTypeJsonConverter, IEquatable, JsonConverter, JsonSerializerOptions, Type (+2 more)

### Community 14 - "TaskWatchdogService"
Cohesion: 0.17
Nodes (11): AppDbContext, BackgroundService, TaskWatchdogService, DateTime, TaskState, CancellationToken, ILogger, IServiceScopeFactory (+3 more)

### Community 15 - "AppDbContext"
Cohesion: 0.18
Nodes (10): AppDbContext, PushSubscriptions, TaskCompletionLogs, Tasks, Users, DbInitializer, User, DbContext (+2 more)

### Community 16 - "prepareIncomingView"
Cohesion: 0.18
Nodes (14): calculateSleepDuration(), cleanupIncomingView(), hideChartTooltip(), loadSettingsIntoForm(), onTouchEnd(), onTouchMove(), prepareIncomingView(), renderAnalyticsDataTable() (+6 more)

### Community 17 - ".GetMorningDigestAsync"
Cohesion: 0.21
Nodes (9): DigestService, MorningDigestModel, RecommendedActions, TasksBySector, TotalWarningTasks, DateTime, List, Sector (+1 more)

### Community 18 - "applyRemotePreferences"
Cohesion: 0.27
Nodes (11): applyRemotePreferences(), applyUiPrefs(), collectPreferences(), loadUiPrefs(), markPreferencesChanged(), prefsDeviceKey(), pushPreferences(), saveUiPrefs() (+3 more)

### Community 19 - "http"
Cohesion: 0.20
Nodes (9): ASPNETCORE_ENVIRONMENT, applicationUrl, commandName, dotnetRunMessages, environmentVariables, launchBrowser, profiles, http (+1 more)

### Community 20 - "Bokea.csproj"
Cohesion: 0.22
Nodes (8): net10.0, BCrypt.Net-Next (4.2.0), Microsoft.AspNetCore.Authentication.JwtBearer (10.0.9), Microsoft.EntityFrameworkCore.Sqlite (10.0.8), SQLitePCLRaw.bundle_e_sqlite3 (2.1.13), SQLitePCLRaw.lib.e_sqlite3 (2.1.13), WebPush (1.0.13), Microsoft.NET.Sdk.Web

### Community 21 - "Sector"
Cohesion: 0.19
Nodes (9): Sector, CareerAndFinance, HealthAndVitality, MindAndEnvironment, RelationshipsAndSocial, TaskState, Amber, Green (+1 more)

### Community 22 - "manifest.json"
Cohesion: 0.22
Nodes (8): background_color, description, display, icons, name, short_name, start_url, theme_color

### Community 23 - "openAvatarCropper"
Cohesion: 0.25
Nodes (8): applyAvatarCropTransform(), avatarCropEls(), cancel(), clampAvatarCropOffset(), closeAvatarCropper(), loadImageFromFile(), openAvatarCropper(), pointerMove()

### Community 24 - "Bokea.Services"
Cohesion: 0.33
Nodes (4): DigestEndpoints, IEndpointRouteBuilder, Bokea.Services, Bokea.Endpoints

### Community 25 - "PushEndpoints.cs"
Cohesion: 0.33
Nodes (5): PushEndpoints, PushSubscriptionKeys, PushSubscriptionRequest, UnsubscribeRequest, IEndpointRouteBuilder

### Community 26 - "DigestTaskDto"
Cohesion: 0.29
Nodes (7): DigestTaskDto, Description, DueDate, Id, Sector, State, Title

### Community 27 - "Next steps — sync fixes (13 Sep 2026)"
Cohesion: 0.29
Nodes (6): 1. Run the database migration (Supabase), 2. Commit and deploy, 3. Check it on two devices, 4. Push notifications (needs building), 5. Known limits and choices made, Next steps — sync fixes (13 Sep 2026)

### Community 28 - "Bokea.Database"
Cohesion: 0.33
Nodes (4): PushNotificationService, ILogger, Bokea.Database, VapidDetails

### Community 29 - "vercel.json"
Cohesion: 0.33
Nodes (5): cleanUrls, outputDirectory, routes, trailingSlash, version

### Community 30 - "promptSignUpFromLocal"
Cohesion: 0.40
Nodes (5): authBackendReady(), promptSignUpFromLocal(), setLocalMode(), showAuthError(), showAuthForm()

### Community 31 - "IntervalType"
Cohesion: 0.50
Nodes (4): IntervalType, FixedDate, IntervalBased, Workdays

### Community 32 - "routeApiRequest"
Cohesion: 0.67
Nodes (4): callTaskRpc(), mapBackendTask(), parseTaskId(), routeApiRequest()

### Community 33 - "toggleRowMenu"
Cohesion: 0.67
Nodes (4): closeRowMenus(), closeRowMenusAndReturn(), closeRowMenusOnOutside(), toggleRowMenu()

### Community 34 - "openSnoozeMenu"
Cohesion: 0.83
Nodes (4): closeSnoozeMenu(), closeSnoozeMenuOnEscape(), closeSnoozeMenuOnOutside(), openSnoozeMenu()

## Knowledge Gaps
- **155 isolated node(s):** `ReorderTaskRequest`, `UnsubscribeRequest`, `CAL_DAYS`, `CAL_MONTHS`, `CAL_RANK` (+150 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 211 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **4 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Bokea.Database` connect `Bokea.Database` to `PushEndpoints.cs`, `ProfileAboutRequest`, `DueDateType`, `AppDbContext`?**
  _High betweenness centrality (0.041) - this node is a cross-community bridge._
- **Why does `TaskItem` connect `TaskItem` to `User`, `PushSubscription`, `DueDateType`, `AppDbContext`, `.GetMorningDigestAsync`, `Sector`, `IntervalType`?**
  _High betweenness centrality (0.041) - this node is a cross-community bridge._
- **Why does `User` connect `User` to `ProfileAboutRequest`, `TaskItem`, `PushSubscription`, `DueDateType`, `AppDbContext`?**
  _High betweenness centrality (0.037) - this node is a cross-community bridge._
- **What connects `ReorderTaskRequest`, `UnsubscribeRequest`, `CAL_DAYS` to the rest of the system?**
  _155 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `loadDashboardData` be split into smaller, more focused modules?**
  _Cohesion score 0.07682177348551361 - nodes in this community are weakly interconnected._
- **Should `app.js` be split into smaller, more focused modules?**
  _Cohesion score 0.0524390243902439 - nodes in this community are weakly interconnected._
- **Should `ProfileAboutRequest` be split into smaller, more focused modules?**
  _Cohesion score 0.06386554621848739 - nodes in this community are weakly interconnected._