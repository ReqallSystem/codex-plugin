---
name: document
description: Capture a meaningful work item or new finding in Reqall during ongoing work; skip routine tool-call logs.
---

# Document a Work Item

Capture a durable behavior change, decision, bug, or useful verification while
its details are fresh. Reuse the project bound during context; if context is
missing, use the context skill first.

1. Identify what another session should learn: what changed or was discovered,
   why it matters, evidence, limitations and remaining work.
2. Reuse a matching recalled record; search when coverage is unclear. Update it
   rather than adding a duplicate. Classify bugs as issue, implementation or
   follow-ups as todo, decisions as arch, requirements as spec, evidence as test.
   Use resolved for completed work and open for unresolved work.
3. Save with upsert_record. Link only when a real relationship adds meaning.
   A workaround may complete an action while leaving a newly discovered bug open.
4. Read back the record and its complete outgoing links, then project list_records.
   See [persist](../persist/SKILL.md) for partial saves, explicit incoming links,
   intent coverage and final session reconciliation.

Skip no-ops, reads with no finding, repeated test evidence, and standalone
successful Git add/commit/push with no substantive discovery. Do not create a
record for each tool call or invent a link to satisfy a guardrail. When work
continues, retain concise notes for final persistence; incremental saves do not
replace coverage of the latest work revision.
