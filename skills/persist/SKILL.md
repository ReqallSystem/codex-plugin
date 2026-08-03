---
name: persist
description: Classify and persist all meaningful work completed in the current Codex session.
---

# Persist Work

Before ending a non-trivial turn, classify the completed work and save it to
Reqall. Create one record per distinct work item.

## Classification

| Work type | kind | status |
| --- | --- | --- |
| Bug fixed | issue | resolved |
| New unfixed bug | issue | open |
| Completed implementation | todo | resolved |
| Follow-up task | todo | open |
| Architecture decision | arch | resolved |
| New or updated spec | spec | open |
| Test or build evidence | test | resolved |
| Ongoing verification evidence | test | active |
| Trivial or no-op work | -- | skip |

## Title Prefixes

- Issues: `BUG:`, `TASK:`, `BLOCKER:`, `QUESTION:`
- Specs and architecture: `ARCH:`, `API:`, `AUTH:`, `DATA:`, `UI:`
- Features and refactors: `FEAT:`, `REFACTOR:`
- Verification: `TEST:`

## Workflow

1. Identify the project.
   Use `REQALL_PROJECT_NAME`, then git `origin` as `org/repo`, then the
   current directory basename. Call `reqall:upsert_project` with that exact
   name and keep the returned `project_id`.
2. Enumerate work items.
   Review files created or modified, bugs fixed or discovered, design
   decisions, specs changed, tests or builds run, and follow-up tasks.
3. Create or update records.
   For each meaningful item, call `reqall:upsert_record` with `project_id`,
   `kind`, `status`, `title`, and a body explaining what changed, why it
   matters, and relevant file paths or command evidence.
4. Link related records.
   Use `reqall:search` to find related records. Call `reqall:upsert_link`
   when relationships are clear:
   - fixes or implementations use `implements`
   - verification uses `tests`
   - dependencies use `blocks`
   - general associations use `related`
   - parent/child specifications use `parent`
5. Persist unresolved follow-ups as open `issue` or `todo` records.
6. Call `reqall:list_records` for the project and ensure the completed work
   was represented.
7. Report what was persisted in the final response.

## Helper Commands

```bash
reqall-codex-plugin persist --task "short task summary"
reqall-guardrail check
```

Trusted plugin hooks capture successful Reqall persistence tool-call IDs. The
guardrail passes only after a persistence write and a later `list_records`
verification; a free-form completion claim does not qualify.

## Failure Mode

If Reqall MCP is unavailable or requires reauthentication:

- continue the user task
- state that automatic persistence could not run
- do not claim that records were successfully stored
