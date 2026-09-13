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

Use the tool schema exposed by this host. If it supports `work`, prefer one
`work` record only for ephemeral session progress (`resolved` when complete, `active`
when ongoing); if it supports `info`, use it for durable reference knowledge.
Otherwise use the table above. Never send unsupported kinds. Retain distinct
bug, decision, verification, and follow-up records when they are useful.

## Title Prefixes

- Issues: `BUG:`, `TASK:`, `BLOCKER:`, `QUESTION:`
- Specs and architecture: `ARCH:`, `API:`, `AUTH:`, `DATA:`, `UI:`
- Features and refactors: `FEAT:`, `REFACTOR:`
- Verification: `TEST:`

## Workflow

1. Identify the project using the Project identity contract below. Call `reqall:upsert_project` with that exact name and retain `project_id`.

2. Enumerate work items.
   Review files created or modified, bugs fixed or discovered, design
   decisions, specs changed, tests or builds run, and follow-up tasks.
3. Create or update records.
   For each meaningful item, call `reqall:upsert_record` with `project_id`,
   `kind`, `status`, `title`, and a body explaining what changed, why it
   matters, and relevant file paths or command evidence.
4. Link related records.
   Use `reqall:search` to find related records. Prefer inline `links` on
   `upsert_record` when the tool schema supports it; check per-link results.
   Otherwise, or to connect existing records, call `reqall:upsert_link`
   when relationships are clear:
   - fixes or implementations use `implements`
   - verification uses `tests`
   - dependencies use `blocks`
   - general associations use `related`
   - parent/child specifications use `parent`
5. Persist unresolved follow-ups as open `issue` or `todo` records.
   Reconcile spec/arch IDs from `reqall:intend`, the hook's intent hints, or
   the conversation. Read their acceptance criteria. Link fulfilled outcomes
   with `implements`, tests with `tests`, and follow-ups for gaps with
   `blocks`. Update superseded intent to the agreed scope; do not close a
   standing spec just because an implementation completed.
6. Read back every outcome and its outgoing links under the contract below.
   Then call project-scoped `reqall:list_records`.
7. Report what was persisted in the final response.

## Helper Commands

```bash
reqall-codex-plugin persist --task "short task summary"
reqall-guardrail check
```

Trusted plugin hooks capture successful Reqall persistence tool-call IDs. The
guardrail passes only after exact record/link readbacks and a later project
`list_records` verification; a free-form completion claim does not qualify.
The outcome write must follow the latest observed mutation/test, and the
verification must follow the latest record write. Open spec/arch intent
writes do not substitute for outcomes. If you edit or test again, update
the outcome record and verify again before ending the turn.

## Failure Mode

If Reqall MCP is unavailable or requires reauthentication:

- continue the user task
- state that automatic persistence could not run
- do not claim that records were successfully stored


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

## Work revision and acknowledgement

Before outcome writes, inspect `reqall-guardrail status --session <actual session id>`
for pending work and commitments. Trusted PreToolUse automatically captures the
work revision before each upsert; CLI claims cannot substitute for that snapshot.
Do not run new edits/tests during the persistence batch. If newer work occurs,
update the outcomes to represent it and verify again. Every outcome written at
the current revision requires exact readback; partial batches cannot clear work.
Old outcomes may be superseded by a new batch that covers all actual work.

Only written/selected commitments require coverage; consulted hints do not.
Use outcome → intent `implements`, or an open todo → intent `blocks` for a real
gap. A selected commitment cannot acknowledge itself by changing status. A
standalone resolved architecture decision can be an outcome. The guardrail
checks these edges from trusted readbacks at Stop; no Hermes `reqall_session`
or second authentication path is needed. `reqall-guardrail check` diagnoses
missing evidence but never fabricates it. Failed verification stays pending.

## Project identity contract

Reuse the exact host-provided project identity throughout recall, work, persistence, and verification. Without a host binding, resolve: trimmed `REQALL_PROJECT_NAME` → network Git `origin` (final two path segments, trailing slash/`.git` removed) → explicitly labelled `project_name`/`project` prompt selection or retained session selection → nearest valid ancestor `.reqall.yml`/`.reqall.yaml` → nearest package identity (`package.json`, `go.mod`, `Cargo.toml` at each directory) → exact cwd-relative path within a known workspace → `.machine/<short-lower-hostname>/<os-user>`. Never infer identity from arbitrary slash tokens or an unconstrained directory basename. Labels accept `:`/`=` and plain, single/double-quoted, or backtick values; first labelled match wins, not synthetic report examples. Environment and network Git override retained selections at the next turn; mid-turn hooks reuse the bound identity. `REQALL_MACHINE_NAME` overrides the whole sanitized lowercase host segment (including deliberate dots); use the OS account, not USER/USERNAME.

Read regular UTF-8 metadata files ≤64 KiB. Reqall YAML supports simple top-level string `project` (preferred) or `name`, matching quotes and trailing comments; reject duplicate keys, malformed quotes, nested/complex values, booleans/null/numbers. Package identity is string `package.json.name` (valid `@scope/name` becomes `scope/name`), complete Go `module`, or simple quoted Cargo `[package] name`. Skip invalid/unreadable values. Automatic identities allow ASCII letters/digits/`_-.` in nonempty slash segments; reject absolute/drive/UNC/backslash/tilde and `.`/`..` segments. Search ancestors through the containing workspace root inclusive, otherwise filesystem root. `REQALL_WORKSPACE_ROOT` (cwd-relative or `~/` supported), else nearest regular `.reqall-workspace`, sets the boundary; resolve symlinks before containment, do not replace an invalid explicit root with a marker, and do not use an empty root-relative identity. Preserve all relative segments. Deliberate manual SLEEP targets override automatic discovery; account preferences may deliberately target `.user`.
