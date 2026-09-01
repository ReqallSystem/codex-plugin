---
name: sleep
description: Compress project memory — consolidate, split, compact, skip, and crosslink Reqall records
---

# SLEEP — compress project memory

**Goal:** Preserve **knowledge** in a **minimal number of short, non-redundant records**.
User invoked sleep → rewrite and delete are expected. Compression is the point.
Knowledge = decisions, outcomes, constraints, IDs, contracts — not session prose.

Ops (fixed names): `consolidate` · `split` · `compact` · `skip` · `crosslink`

Rate-limited ~once per 24h per project. **Modest progress is success** — do not boil the ocean.

## Decision table

| Signal | Action |
|--------|--------|
| Server cluster of highly similar resolved/archived | **consolidate** → one terse record; **sources deleted** |
| Isolated resolved/archived; durable but verbose/redundant | **compact** |
| Isolated resolved/archived; pure noise (ack, empty, no durable fact) | **skip** |
| Active/open; 2+ clearly separable topics | **split** (original deleted by apply) |
| Active/open; single topic, already clear | leave (no op) |
| Cross-project pair; same concept, discovery-useful | **crosslink** |
| Cross-project pair; superficial token overlap | omit |
| Candidate unclear / not obvious | **omit this pass** (not a full-run refuse) |

Prefer clear, concise records and useful links over perfect coverage. A long but appropriate record can wait for a later sleep.

## Steps

1. **Project** — user arg → `REQALL_PROJECT_NAME` → git `org/repo` → `.machine/<hostname>/<os-user>` → `reqall:upsert_project` → `project_id`.

2. **Context gate** — `reqall:search` for recent maintenance / consolidation risk, then `reqall:list_records` with `status: "open"`.

3. **Candidates** — `reqall:sleep_candidates` with `project_id`. If rate-limited, report next eligible time and stop.

4. **Summary** — counts: consolidate clusters, compact/skip pool, split, crosslink. Empty → "Nothing to do — graph is healthy."

5. **Select ops** — decision table only. Prefer obvious wins; small batch is fine. Bodies: terse, non-redundant.
   - **consolidate** — `kind: "arch"`, `status: "resolved"`; best title; keep knowledge from all members; wording is disposable.
   - **compact** — same id; leaner form.
   - **split** — focused sub-records; kind/status fit each topic (usually match original).
   - **crosslink** — only when useful for discovery.

6. **Apply** — one `reqall:sleep_apply` with the batch. No per-op confirmation.

7. **Persist outcome** — `reqall:upsert_record` with `kind: "todo"`, `status: "resolved"`, title `TASK: SLEEP maintenance`, body = applied counts + errors. Then `reqall:list_records` to verify. SLEEP ops alone do not satisfy session persistence.

8. **Report** — consolidated / compacted / split / crosslinked / skipped / errors. If candidates were capped: note to run again later.

## Rules

- Knowledge ≠ wording. Prose is disposable; durable facts are not.
- **consolidate always deletes sources** (server). Do not keep originals.
- Do not ask whether rewrite/delete is OK — user ran sleep.
- Unclear candidate → omit; do not invent merges or splits.
- Safety (ownership, active dependents) is enforced by `sleep_apply` — do not re-check.
