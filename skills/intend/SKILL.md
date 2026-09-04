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
   spec/arch with `get_record`. Reuse it, updating only if the scope changed.
3. If none fits, create one `spec` or `arch` with `status: "open"`. Describe
   the desired behavior, rationale, agreed scope, and acceptance criteria.
   Keep sub-scopes in its body rather than creating a record per step.
4. Link related records. Use inline `links` only if the exposed
   `upsert_record` schema supports it; otherwise use `upsert_link`. Inspect
   `list_links` and `impact` when changing tracked behavior.
5. Keep the record ID for final persistence. Report it briefly and proceed.

Trusted hooks retain only spec/arch IDs and kinds from successful structured
`get_record`/`upsert_record` results. They restore these hints on compaction
or resume. A text-only result still requires remembering the ID in the task
summary. No Claude-specific `ExitPlanMode` event is required in Codex.

Final persistence links completed outcomes to intent with `implements`,
verification with `tests`, and an open follow-up for each unresolved gap with
`blocks`. Update superseded intent to the actual agreed scope. Intent writes
alone do not fulfill the final outcome-persistence requirement.
