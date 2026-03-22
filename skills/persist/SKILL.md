# Reqall Persistence Skill For Codex

Use this skill before the final response for every non-trivial task.

## Goal

Persist the completed work so the next agent can retrieve it automatically.

## Workflow

1. Enumerate each completed work item from this turn.
2. Upsert a Reqall record for each meaningful item.
3. Persist verification evidence as `kind=test`.
4. Persist unresolved work as open `issue`/`todo` records.
5. Link related records where relationships are clear.
6. Call `reqall:list_records` to sanity-check the resulting open set.
7. In the final response, briefly report what was persisted and any remaining follow-ups.

## Helper Command

```bash
reqall-codex-plugin persist --task "short task summary"
reqall-guardrail mark-persist --evidence "persisted records + verification evidence"
reqall-guardrail check
```

## Failure Mode

If Reqall MCP is unavailable:
- continue the user task
- state that automatic persistence could not run
- do not claim that records were successfully stored
