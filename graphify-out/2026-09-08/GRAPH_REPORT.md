# Graph Report - Bokea  (2026-09-08)

## Corpus Check
- 22 files · ~136,471 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 312 nodes · 527 edges · 17 communities (13 shown, 3 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 13 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `5b20c50f`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- TaskItem
- SetupRequest
- DigestTaskDto
- DueDateType
- TaskWatchdogService
- app.js
- User
- vercel.json
- renderCalendarDay
- http
- manifest.json
- Bokea.csproj
- sw.js
- Agent Instructions & Guidelines
- taskRowMarkup
- Project Specification & Task Tracker

## God Nodes (most connected - your core abstractions)
1. `TaskItem` - 28 edges
2. `loadDashboardData()` - 21 edges
3. `User` - 20 edges
4. `AppDbContext` - 17 edges
5. `calculateTaskState()` - 16 edges
6. `DueDateType` - 15 edges
7. `apiRequest()` - 15 edges
8. `PushSubscription` - 14 edges
9. `TaskCompletionLog` - 12 edges
10. `refreshIcons()` - 12 edges

## Surprising Connections (you probably didn't know these)
- `AppDbContext` --references--> `TaskItem`  [EXTRACTED]
  Bokeà/Database/AppDbContext.cs → Bokeà/Database/Models.cs
- `DigestService` --references--> `AppDbContext`  [EXTRACTED]
  Bokeà/Services/DigestService.cs → Bokeà/Database/AppDbContext.cs
- `PushNotificationService` --references--> `AppDbContext`  [EXTRACTED]
  Bokeà/Services/PushNotificationService.cs → Bokeà/Database/AppDbContext.cs
- `AppDbContext` --references--> `PushSubscription`  [EXTRACTED]
  Bokeà/Database/AppDbContext.cs → Bokeà/Database/Models.cs
- `AppDbContext` --references--> `TaskCompletionLog`  [EXTRACTED]
  Bokeà/Database/AppDbContext.cs → Bokeà/Database/Models.cs

## Import Cycles
- None detected.

## Communities (17 total, 3 thin omitted)

### Community 0 - "TaskItem"
Cohesion: 0.07
Nodes (31): IntervalType, FixedDate, IntervalBased, TaskItem, CompletionLogs, CreatedAt, Description, DisplayOrder (+23 more)

### Community 1 - "SetupRequest"
Cohesion: 0.11
Nodes (17): AuthEndpoints, LoginRequest, Email, Password, RegisterRequest, Email, FirstName, Password (+9 more)

### Community 2 - "DigestTaskDto"
Cohesion: 0.07
Nodes (26): DigestEndpoints, IEndpointRouteBuilder, PushEndpoints, PushSubscriptionKeys, PushSubscriptionRequest, UnsubscribeRequest, IEndpointRouteBuilder, DigestService (+18 more)

### Community 3 - "DueDateType"
Cohesion: 0.12
Nodes (15): DueDateType, HasValue, Value, DueDateTypeJsonConverter, Sector, CareerAndFinance, HealthAndVitality, MindAndEnvironment (+7 more)

### Community 4 - "TaskWatchdogService"
Cohesion: 0.18
Nodes (10): BackgroundService, Task, PushNotificationService, ILogger, TaskWatchdogService, DateTime, ILogger, CancellationToken (+2 more)

### Community 5 - "app.js"
Cohesion: 0.06
Nodes (70): apiRequest(), applyUiPrefs(), CAL_DAYS, CAL_MONTHS, calculateSleepDuration(), calculateTaskState(), calSelectedStr, calViewDate (+62 more)

### Community 6 - "User"
Cohesion: 0.06
Nodes (39): AppDbContext, PushSubscriptions, TaskCompletionLogs, Tasks, Users, DbInitializer, User, PushSubscription (+31 more)

### Community 7 - "vercel.json"
Cohesion: 0.33
Nodes (5): cleanUrls, outputDirectory, routes, trailingSlash, version

### Community 8 - "renderCalendarDay"
Cohesion: 0.24
Nodes (15): calDailyCount(), calDatedTasksForDate(), calDateStr(), calGridKeydown(), calIsDaily(), calOrdinal(), calParse(), calShiftMonth() (+7 more)

### Community 9 - "http"
Cohesion: 0.20
Nodes (9): ASPNETCORE_ENVIRONMENT, applicationUrl, commandName, dotnetRunMessages, environmentVariables, launchBrowser, profiles, http (+1 more)

### Community 11 - "manifest.json"
Cohesion: 0.22
Nodes (8): background_color, description, display, icons, name, short_name, start_url, theme_color

### Community 12 - "Bokea.csproj"
Cohesion: 0.22
Nodes (8): net10.0, BCrypt.Net-Next (4.2.0), Microsoft.AspNetCore.Authentication.JwtBearer (10.0.9), Microsoft.EntityFrameworkCore.Sqlite (10.0.8), SQLitePCLRaw.bundle_e_sqlite3 (2.1.13), SQLitePCLRaw.lib.e_sqlite3 (2.1.13), WebPush (1.0.13), Microsoft.NET.Sdk.Web

### Community 22 - "taskRowMarkup"
Cohesion: 0.26
Nodes (13): areaMeta(), cadenceText(), esc(), renderAfterThat(), renderMomentum(), renderNavCount(), renderNextUpTask(), renderRightNow() (+5 more)

## Knowledge Gaps
- **115 isolated node(s):** `net10.0`, `BCrypt.Net-Next (4.2.0)`, `Microsoft.AspNetCore.Authentication.JwtBearer (10.0.9)`, `Microsoft.EntityFrameworkCore.Sqlite (10.0.8)`, `SQLitePCLRaw.bundle_e_sqlite3 (2.1.13)` (+110 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 149 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **3 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `TaskItem` connect `TaskItem` to `DigestTaskDto`, `DueDateType`, `TaskWatchdogService`, `User`?**
  _High betweenness centrality (0.085) - this node is a cross-community bridge._
- **Why does `Bokea.Database` connect `DigestTaskDto` to `TaskItem`, `SetupRequest`, `DueDateType`, `TaskWatchdogService`, `User`?**
  _High betweenness centrality (0.084) - this node is a cross-community bridge._
- **Why does `AppDbContext` connect `User` to `TaskItem`, `DigestTaskDto`, `TaskWatchdogService`?**
  _High betweenness centrality (0.055) - this node is a cross-community bridge._
- **What connects `net10.0`, `BCrypt.Net-Next (4.2.0)`, `Microsoft.AspNetCore.Authentication.JwtBearer (10.0.9)` to the rest of the system?**
  _115 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `TaskItem` be split into smaller, more focused modules?**
  _Cohesion score 0.07196969696969698 - nodes in this community are weakly interconnected._
- **Should `SetupRequest` be split into smaller, more focused modules?**
  _Cohesion score 0.10526315789473684 - nodes in this community are weakly interconnected._
- **Should `DigestTaskDto` be split into smaller, more focused modules?**
  _Cohesion score 0.0746031746031746 - nodes in this community are weakly interconnected._