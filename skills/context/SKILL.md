---
name: context
description: Initialize the project and gather relevant context from the Reqall knowledgebase before work starts.
---

# Gather Context

Load project context from Reqall before starting non-trivial work.

## Workflow

1. Resolve the project name in this order:
   - `REQALL_PROJECT_NAME`
   - git remote repo name as `org/repo`
   - current directory basename
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
