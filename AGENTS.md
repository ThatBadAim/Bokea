# Agent Instructions - Bokea Project Rules

## 1. Graphify Knowledge Map Policy
- **Query First**: Before making architectural changes, investigating bugs, or refactoring components in this repository, always query the existing knowledge graph in `graphify-out/` (e.g. using `graphify query "<question>"` or inspecting `graphify-out/GRAPH_REPORT.md` and `graphify-out/graph.json`).
- **Update Upon Completion**: Whenever files are created, modified, or deleted as part of a task, re-run graphify to keep the knowledge graph, `graphify-out/GRAPH_REPORT.md`, and `graphify-out/graph.html` completely synchronized with the codebase.

## 2. Project Architecture & Runtime Notes
- **Backend**: ASP.NET Core 10 Minimal API with SQLite and Entity Framework Core. Located in `Bokeà/`.
- **Frontend**: Single Page Application served from `Bokeà/wwwroot/` with offline localStorage fallback mode.
- **Offline Mode**: Supports `offline_mode_token` for standalone local operation without backend API requirements.
