---
name: context
description: Initialize the project and gather relevant context from the Reqall knowledgebase before work starts.
---

# Gather Context

Load project context from Reqall before starting non-trivial work.

## Workflow

1. Identify the project using the Project identity contract below.

2. Call `reqall:upsert_project` with the exact project name and save
   `project_id`.
3. Call `reqall:search` with a natural-language query based on the user's
   task. Pass `project_name` so records from this project are prioritized.
4. Call `reqall:list_records` with `project_id` and `status: "open"` to
   surface active issues, specs, and todos.
5. If touching a specific file or component, run an additional targeted
   search for that file path or component name before editing.
6. Call `reqall:get_record` for highly relevant hits whose summaries are not
   enough to guide the work.
7. If changing existing tracked behavior, call `reqall:list_links` and
   `reqall:impact` for the relevant record.
8. Summarize relevant records, open items, and impact findings concisely.
9. For agreed new behavior or architecture, use `reqall:intend` before
   implementation. Reuse an existing spec/arch when it already fits.

## Helper Commands

```bash
reqall-codex-plugin context --task "short task summary"
reqall-codex-plugin pre-edit --file path/to/file --task "short task summary"
```

Trusted plugin hooks capture the successful Reqall tool-call IDs
automatically. Do not substitute a free-form `mark-context` claim.

## When To Minimize

- Simple Q&A: run only a targeted search when useful.
- No search results: say no relevant records were found and proceed.
- No open records: omit the open-record summary.

## Failure Mode

If Reqall MCP is unavailable:

- continue the task
- state that automatic context injection could not run
- do not pretend context retrieval succeeded


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

## Subscription updates

Automatic turn polling uses `REQALL_API_KEY` when configured; it does not access
host OAuth credentials. With OAuth-only tools, subscribe and poll explicitly
when the exposed schema supports them: `subscriber` is the actual session ID,
`project_id` is the exact binding. Use `ack: false` and then `ack_cursor` only
when exposed, acknowledging pages after processing. Treat updates as background
context and fetch records before acting. `actor: self` means this account, not
this session; never discard another session's changes based on record ID alone.
Older servers without subscription tools are skipped. Subscription operations
are supplemental and do not satisfy context or persistence evidence.

## Project identity contract

Reuse the exact host-provided project identity throughout recall, work, persistence, and verification. Without a host binding, resolve: trimmed `REQALL_PROJECT_NAME` → network Git `origin` (final two path segments, trailing slash/`.git` removed) → explicitly labelled `project_name`/`project` prompt selection or retained session selection → nearest valid ancestor `.reqall.yml`/`.reqall.yaml` → nearest package identity (`package.json`, `go.mod`, `Cargo.toml` at each directory) → exact cwd-relative path within a known workspace → `.machine/<short-lower-hostname>/<os-user>`. Never infer identity from arbitrary slash tokens or an unconstrained directory basename. Labels accept `:`/`=` and plain, single/double-quoted, or backtick values; first labelled match wins, not synthetic report examples. Environment and network Git override retained selections at the next turn; mid-turn hooks reuse the bound identity. `REQALL_MACHINE_NAME` overrides the whole sanitized lowercase host segment (including deliberate dots); use the OS account, not USER/USERNAME.

Read regular UTF-8 metadata files ≤64 KiB. Reqall YAML supports simple top-level string `project` (preferred) or `name`, matching quotes and trailing comments; reject duplicate keys, malformed quotes, nested/complex values, booleans/null/numbers. Package identity is string `package.json.name` (valid `@scope/name` becomes `scope/name`), complete Go `module`, or simple quoted Cargo `[package] name`. Skip invalid/unreadable values. Automatic identities allow ASCII letters/digits/`_-.` in nonempty slash segments; reject absolute/drive/UNC/backslash/tilde and `.`/`..` segments. Search ancestors through the containing workspace root inclusive, otherwise filesystem root. `REQALL_WORKSPACE_ROOT` (cwd-relative or `~/` supported), else nearest regular `.reqall-workspace`, sets the boundary; resolve symlinks before containment, do not replace an invalid explicit root with a marker, and do not use an empty root-relative identity. Preserve all relative segments. Deliberate manual SLEEP targets override automatic discovery; account preferences may deliberately target `.user`.
