---
name: document
description: Document a single meaningful tool action or work item in Reqall.
---

# Document Work Item

Use this for incremental persistence of one meaningful work item. It is
lighter than the full `persist` skill, which covers the whole session.

## Skip Cases

Do not create a record for:

- read-only operations such as file reads, searches, or listings
- trivial or failed commands with no finding
- formatting-only changes with no semantic impact
- test runs that produced no new evidence or decision
- no-op edits

## Record Cases

Create or update a record for:

- substantive file creation or edits
- bug fixes or newly discovered bugs
- build, release, or configuration changes
- database migrations
- new specifications or architecture decisions
- verification that should be discoverable later

## Workflow

1. Identify the tool activity that just completed.
2. List touched files and the behavioral change.
3. Capture completed work, verification evidence, unresolved issues, and
   follow-ups.
4. Search with `reqall:search` for related existing records.
5. Prefer updating an existing matching record with `reqall:upsert_record`
   over creating a duplicate.
6. Otherwise create one focused record with the appropriate `kind`, `status`,
   title prefix, and body.
7. Link related records with `reqall:upsert_link` when relationships are
   clear. Prefer inline `links` if the exposed `upsert_record` schema supports
   them, checking each link result. Use `work` or `info` only when those kinds
   appear in the current tool schema; otherwise use issue/todo/arch/spec/test.
8. Output a one-line summary, or `Nothing to document.` when skipped.

## Helper Commands

```bash
reqall-codex-plugin document --tool edit --files src/a.js,src/b.js --summary "brief summary"
```

Trusted plugin hooks capture concrete mutation and test evidence
automatically; raw commands and tool results are not persisted in guardrail
state.


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
