---
name: triage
description: Classify incoming issues or requests, gather structured details, and create prioritized Reqall records.
---

# Triage Incoming Issue

Classify a new issue or request, gather missing details, check for
duplicates, and create a durable Reqall record.

## Category Table

| Category | kind | prefix | priority hint |
| --- | --- | --- | --- |
| Bug report | issue | BUG: | P0-P2 based on impact |
| Feature request | spec | FEAT: | P2-P4 typically |
| Account or billing | issue | ACCOUNT: | P1-P2 typically |
| How-to or docs gap | todo | DOCS: | P3-P4 typically |
| Integration question | issue | INTEG: | P2-P3 typically |

## Priority Scale

| Level | Meaning |
| --- | --- |
| P0 | Critical: system down, data loss, security, no workaround |
| P1 | High: major functionality broken, painful workaround |
| P2 | Medium: degraded feature, reasonable workaround |
| P3 | Low: minor issue, cosmetic, nice-to-have |
| P4 | Wishlist: future consideration |

## Steps

1. Identify the project and call `reqall:upsert_project`.
2. Use the user's supplied description when present. Ask one concise
   follow-up only when critical details are missing.
3. Classify the category and priority from the tables above.
4. Gather structured details appropriate to the category:
   - Bugs: reproduction steps, expected vs actual behavior, environment,
     frequency, logs, workaround, severity.
   - Features: user story, affected users, current workaround, desired
     behavior, acceptance criteria.
   - Account/billing: account context, plan, affected charge or access,
     urgency.
   - Docs gaps: goal, attempted steps, docs consulted, confusion point.
   - Integrations: service, versions, config, errors, code snippets.
5. Search for duplicates with `reqall:search` and list open records of the
   same kind with `reqall:list_records`.
6. If a duplicate exists, update it with `reqall:upsert_record` instead of
   creating a new record. If a record is related, create a new one and link
   it.
7. Create the record with title format `{PREFIX} {PRIORITY}: {title}` and a
   structured body containing category, priority rationale, description,
   details, and reporter context.
8. Link related records with `reqall:upsert_link`.
9. Summarize the record created or updated and any links established.



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
