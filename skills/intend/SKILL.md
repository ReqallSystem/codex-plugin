---
name: intend
description: Record agreed new behavior or architecture in Reqall before implementation, so outcomes can be checked against the intent.
---

# Record Agreed Intent

Use after the user requests a specific behavior or accepts an approach, and
after the normal context calls. Skip questions, exploration without agreed
scope, routine fixes, and chores. An agent's own plan is not user approval;
do not ask for approval again when the user already authorized the work.

1. Use the project and `project_id` from context. If missing, complete
   `upsert_project`, `search`, and `list_records` with `status: "open"` first.
2. Search for the intended behavior or decision; read the best matching
   spec/arch with `get_record`. Reuse it. Select an agreed existing commitment with a same-ID
   `upsert_record` preserving its verified fields; a read alone is consultation.
3. If none fits, create one `spec` or `arch` with `status: "open"`. Describe
   the desired behavior, rationale, agreed scope, and acceptance criteria.
   Keep sub-scopes in its body rather than creating a record per step.
4. Link related records. Use inline `links` only if the exposed
   `upsert_record` schema supports it; otherwise use `upsert_link`. Inspect
   `list_links` and `impact` when changing tracked behavior.
5. Keep the record ID for final persistence. Report it briefly and proceed.

Trusted hooks retain only spec/arch IDs and kinds from successful structured
`get_record`/`upsert_record` results. They restore these hints on compaction
or resume. Text-only results cannot satisfy exact acknowledgement; obtain structured readback. No Claude-specific `ExitPlanMode` event is required in Codex.

Final persistence links completed outcomes to intent with `implements`,
verification with `tests`, and an open follow-up for each unresolved gap with
`blocks`. Update superseded intent to the actual agreed scope. Intent writes
alone do not fulfill the final outcome-persistence requirement.


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

## Project identity contract

Reuse the exact host-provided project identity throughout recall, work, persistence, and verification. Without a host binding, resolve: trimmed `REQALL_PROJECT_NAME` → network Git `origin` (final two path segments, trailing slash/`.git` removed) → explicitly labelled `project_name`/`project` prompt selection or retained session selection → nearest valid ancestor `.reqall.yml`/`.reqall.yaml` → nearest package identity (`package.json`, `go.mod`, `Cargo.toml` at each directory) → exact cwd-relative path within a known workspace → `.machine/<short-lower-hostname>/<os-user>`. Never infer identity from arbitrary slash tokens or an unconstrained directory basename. Labels accept `:`/`=` and plain, single/double-quoted, or backtick values; first labelled match wins, not synthetic report examples. Environment and network Git override retained selections at the next turn; mid-turn hooks reuse the bound identity. `REQALL_MACHINE_NAME` overrides the whole sanitized lowercase host segment (including deliberate dots); use the OS account, not USER/USERNAME.

Read regular UTF-8 metadata files ≤64 KiB. Reqall YAML supports simple top-level string `project` (preferred) or `name`, matching quotes and trailing comments; reject duplicate keys, malformed quotes, nested/complex values, booleans/null/numbers. Package identity is string `package.json.name` (valid `@scope/name` becomes `scope/name`), complete Go `module`, or simple quoted Cargo `[package] name`. Skip invalid/unreadable values. Automatic identities allow ASCII letters/digits/`_-.` in nonempty slash segments; reject absolute/drive/UNC/backslash/tilde and `.`/`..` segments. Search ancestors through the containing workspace root inclusive, otherwise filesystem root. `REQALL_WORKSPACE_ROOT` (cwd-relative or `~/` supported), else nearest regular `.reqall-workspace`, sets the boundary; resolve symlinks before containment, do not replace an invalid explicit root with a marker, and do not use an empty root-relative identity. Preserve all relative segments. Deliberate manual SLEEP targets override automatic discovery; account preferences may deliberately target `.user`.
