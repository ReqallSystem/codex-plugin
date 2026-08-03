---
name: sleep
description: Run SLEEP maintenance to consolidate, compact, split, and cross-link Reqall records.
---

# SLEEP Knowledge Graph Maintenance

Run the Synthesis, Linking, Extraction, Enrichment Pipeline for a project.
This keeps long-lived memory useful by consolidating resolved records,
compacting durable notes, splitting dense active records, and creating
high-value cross-links.

SLEEP is rate-limited to once per 24 hours per project.

## Steps

1. Identify the project from the user's argument, `REQALL_PROJECT_NAME`, git
   `origin`, or the current directory basename. Call `reqall:upsert_project`
   with the exact name and keep `project_id`.

2. Load the maintenance context.
   Call `reqall:search` for recent maintenance, consolidation, and open-risk
   records, then call `reqall:list_records` with `status: "open"`. This also
   satisfies the lifecycle context gate before the stateful SLEEP audit.

3. Fetch candidates.
   Call `reqall:sleep_candidates` with `project_id`. If rate-limited, report
   the next eligible time and stop.

4. Report the candidate summary before applying changes:
   - Consolidation clusters and total records in them
   - Rollup candidates
   - Split candidates
   - Cross-link pairs

5. Process consolidation clusters.
   Merge records only when the synthesized record can preserve all durable
   details. Use the most specific title, `kind: "arch"`, and
   `status: "resolved"` for synthesized durable knowledge.

6. Process rollup candidates.
   Compact records with lasting value. Skip trivial or ephemeral records.

7. Process split candidates.
   Split active records only when they contain two or more separable topics.
   Keep focused records intact even when they are long.

8. Process cross-link candidates.
   Confirm links when the relationship is useful for future discovery.
   Reject superficial similarity.

9. Apply operations.
   Call `reqall:sleep_apply` with the full batch of confirmed operations.

10. Persist the maintenance outcome.
   Call `reqall:upsert_record` with `kind: "todo"`, `status: "resolved"`, a
   `TASK: SLEEP maintenance` title, and a concise body containing the applied
   operation counts and unresolved errors. Then call `reqall:list_records` to
   verify the work-item record. SLEEP operations and links alone do not satisfy
   final session persistence.

11. Report results:
   - Clusters consolidated
   - Records compacted
   - Records split
   - Cross-links created
   - Errors or capped candidates

## Safety

Run autonomously after candidates are fetched. The server enforces ownership
and active-record safety invariants.
