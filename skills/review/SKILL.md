---
name: review
description: Interactively review and triage open Reqall records for the current project.
---

# Review Open Records

Walk through open records for the current project and update them based on
user input.

## Workflow

1. Identify the project and call `reqall:upsert_project`.
   Run `reqall:search` for the requested review scope before changing records.
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


## Record and link verification contract

Use only fields and kinds exposed by this host. For inline links on
`upsert_record`, set `target_id`, `target_table` (`records` or `projects`),
`relationship`, and explicit `direction`. Outgoing means this record → target;
incoming means target → this record. Cap each inline batch at 20 links.
Check record success and every link result: `created` / `existing` succeed;
`error`, missing results, or mismatched counts mean partial persistence.

Read back saved IDs with `get_record`; check project, body, kind, and status.
Read outgoing `list_links` with explicit `entity_type: records`, following
all pages to `total`; verify both endpoint tables/IDs and relationships.
Also read incoming links when an explicitly requested incoming edge needs proof.
For separate `upsert_link`, supply `source_table`, `source_id`, `target_table`,
`target_id`, and `relationship`; reverse endpoints for incoming links.
After uncertain results, read first and retry only missing links. Never
recreate a saved record after link failure. Repair links, read back, then
perform a successful same-ID recovery `upsert_record` preserving verified
fields; read record and links again. Failures remain pending until recovery.
Finish the persistence batch with project-scoped `list_records` after these
readbacks. A transport success or summary list alone is insufficient.
