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
   clear.
8. Output a one-line summary, or `Nothing to document.` when skipped.

## Helper Commands

```bash
reqall-codex-plugin document --tool edit --files src/a.js,src/b.js --summary "brief summary"
reqall-guardrail mark-document --evidence "captured intermediate implementation notes"
```
