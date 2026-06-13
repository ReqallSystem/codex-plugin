---
name: review
description: Interactively review and triage open Reqall records for the current project.
---

# Review Open Records

Walk through open records for the current project and update them based on
user input.

## Workflow

1. Identify the project and call `reqall:upsert_project`.
2. Fetch records with `reqall:list_records` using `project_id` and
   `status: "open"`. Apply a `kind` filter if the user requested one.
3. Present records by kind, title, and status. Call `reqall:get_record` when
   full body details are needed.
4. Identify stale, duplicate, superseded, or still-actionable records.
5. Ask whether each record should be resolved, archived, updated, or linked.
6. Apply updates with `reqall:upsert_record`.
7. Create relationships with `reqall:upsert_link` when useful.
8. Use destructive deletion only when the user explicitly asks.
9. Summarize records updated, resolved, archived, linked, and still open.

## Helper Command

```bash
reqall-codex-plugin review --scope open
```
