---
name: persist
description: Save and verify meaningful session outcomes in Reqall, reusing existing records and capturing unresolved findings.
---

# Persist Meaningful Outcomes

Save knowledge another session can use: changed behavior, why it changed,
verification and its limits, decisions, and unresolved findings. Tool-call
completion is evidence, not a reason to create a record for every action.

## Choose what to save

- Reuse the host-bound project and completed context. If unbound, apply the
  identity contract below and run upsert_project, search, and open list_records.
- Compare the actual outcomes with records recalled this turn. Update matching
  records; create a new one only for a distinct finding or work item. A release
  summary should not substitute for documenting substantive behavior changes.
- Include discoveries made while testing or recovering from tool/guardrail
  failures. Distinguish observed facts from suspected causes; a workaround
  does not resolve the underlying issue.
- Skip no-ops and duplicate operational logs. Successful standalone Git
  add/commit/push needs no new record or memory footer by itself. New findings,
  edits, test evidence and pending commitments still require persistence.
- Use the host's supported kinds: issue for bugs, todo for implementation or
  follow-ups, arch for decisions, spec for requirements, test for verification.
  Mark completed work resolved and unresolved work open. Preserve useful test
  evidence separately; do not split one finding into records for each tool call.

## Save and verify

1. Write the selected outcomes after the latest edits/tests. Describe behavior,
   rationale, evidence and limitations. Preserve verified fields on same-ID
   updates. Inspect guardrail status when pending work or commitments are unclear;
   diagnostic CLI claims never substitute for trusted tool results.
2. Add links only for real relationships. Cover selected/written intent with
   outcome → intent implements, or open todo → intent blocks for a remaining gap.
   Merely reading a spec is not a commitment. Tests may link with tests.
3. Read each saved outcome with get_record and complete outgoing list_links
   (entity_type: records; follow pages through total). Check project, content,
   kind, status and exact link endpoints. An empty complete list is valid:
   records do not need an outgoing link merely to pass verification.
4. For separate upsert_link, verify at the tracked source. If only its target
   is a saved outcome, verify incoming there. Explicit inline incoming links
   also require incoming proof. A source readback needs no duplicate target
   read or reverse edge unless an explicit incoming requirement exists.
5. Finish with project-scoped list_records after all record/link readbacks.
   Report saved knowledge and remaining gaps briefly.

## Recover only what failed

Use the diagnostic's record ID, direction and expected edge. Missing readback
means read the saved data; it does not by itself mean rewrite the record.
Never create filler records or reverse/related links just to clear a hook.
Hooks verify evidence mechanically; they cannot establish semantic coverage.

For a partial save, keep the saved ID. Read first, repair only genuinely missing
requested links, then perform a same-ID recovery upsert and reverify. Do not
recreate the record. New edits/tests require fresh outcome writes and readbacks;
a readback-only retry does not. If recovery reveals a real defect, capture that
finding rather than treating a cleared guardrail as proof it was fixed.

When inline links are supported, supply target_id, target_table, relationship
and direction; use at most 20. Check every created/existing result. Errors,
missing results or count mismatches are partial saves. For separate links,
supply source_table/source_id and target_table/target_id explicitly.

If Reqall is unavailable, continue the user task and disclose that persistence
could not run. Do not claim a save or successful verification without evidence.

## Project identity contract

Reuse the exact host-provided project identity throughout recall, work, persistence, and verification. Without a host binding, resolve: trimmed `REQALL_PROJECT_NAME` → network Git `origin` (final two path segments, trailing slash/`.git` removed) → explicitly labelled `project_name`/`project` prompt selection or retained session selection → nearest valid ancestor `.reqall.yml`/`.reqall.yaml` → nearest package identity (`package.json`, `go.mod`, `Cargo.toml` at each directory) → exact cwd-relative path within a known workspace → `.machine/<short-lower-hostname>/<os-user>`. Never infer identity from arbitrary slash tokens or an unconstrained directory basename. Labels accept `:`/`=` and plain, single/double-quoted, or backtick values; first labelled match wins, not synthetic report examples. Environment and network Git override retained selections at the next turn; mid-turn hooks reuse the bound identity. `REQALL_MACHINE_NAME` overrides the whole sanitized lowercase host segment (including deliberate dots); use the OS account, not USER/USERNAME.

Read regular UTF-8 metadata files ≤64 KiB. Reqall YAML supports simple top-level string `project` (preferred) or `name`, matching quotes and trailing comments; reject duplicate keys, malformed quotes, nested/complex values, booleans/null/numbers. Package identity is string `package.json.name` (valid `@scope/name` becomes `scope/name`), complete Go `module`, or simple quoted Cargo `[package] name`. Skip invalid/unreadable values. Automatic identities allow ASCII letters/digits/`_-.` in nonempty slash segments; reject absolute/drive/UNC/backslash/tilde and `.`/`..` segments. Search ancestors through the containing workspace root inclusive, otherwise filesystem root. `REQALL_WORKSPACE_ROOT` (cwd-relative or `~/` supported), else nearest regular `.reqall-workspace`, sets the boundary; resolve symlinks before containment, do not replace an invalid explicit root with a marker, and do not use an empty root-relative identity. Preserve all relative segments. Deliberate manual SLEEP targets override automatic discovery; account preferences may deliberately target `.user`.
