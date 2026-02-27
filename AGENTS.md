# Reqall — AI Agent Memory

You have access to the Reqall knowledgebase via MCP tools prefixed with `reqall:`.

## Available Tools

- `reqall:search` — Semantic search across project records
- `reqall:upsert_record` — Create or update a record (issue, spec, arch, test, todo)
- `reqall:list_records` — List records with filters
- `reqall:upsert_project` — Create or update a project
- `reqall:list_projects` — List all projects
- `reqall:upsert_link` — Create relationships between records
- `reqall:impact` — Traverse the record graph for downstream effects

## Project Detection

The current project is automatically detected from:
1. `REQALL_PROJECT_NAME` environment variable
2. Git remote (e.g. `org/repo`)
3. Current directory name

If the project does not exist in Reqall, call `reqall:upsert_project` before starting work.

## Conventions

- Issues: prefix titles with `BUG:`, `TASK:`, `BLOCKER:`, or `QUESTION:`
- Specs: prefix titles with `ARCH:`, `API:`, `AUTH:`, `DATA:`, or `UI:`
- After completing work, save a record of what was done
