# Reqall Context Skill For Codex

Use this skill before non-trivial implementation work.

## Goal

Inject the most relevant Reqall context before editing code or running substantial commands.

## Workflow

1. Resolve the project name in this order:
   - `REQALL_PROJECT_NAME`
   - git remote repo name
   - current directory name
2. Call `reqall:upsert_project` with that exact name and save `project_id`.
3. Call `reqall:search` with the user task summary.
4. Call `reqall:list_records` with `project_id` and `status: "open"`.
5. If touching a specific file/component, search using the path/component name as an additional query.
6. Call `reqall:get_record` on the most relevant hits when details matter.
7. If updating previously tracked behavior, call `reqall:list_links` and `reqall:impact`.
8. Summarize the retrieved context before making changes.

## Helper Commands

```bash
reqall-codex-plugin context --task "short task summary"
reqall-codex-plugin pre-edit --file path/to/file --task "short task summary"
reqall-guardrail mark-context --evidence "searched Reqall + reviewed open records"
```

## Failure Mode

If Reqall MCP is unavailable:
- continue the task
- state that automatic context injection could not run
- do not pretend context retrieval succeeded
