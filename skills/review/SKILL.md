# Reqall Review Skill For Codex

Use this skill when the user wants to inspect or clean up Reqall memory.

## Goal

Review open/recent records and keep memory state healthy.

## Workflow

1. Resolve the project name.
2. Call `reqall:list_records` for open records.
3. Fetch details for the most relevant records with `reqall:get_record`.
4. Identify stale, duplicate, or superseded records.
5. Resolve or archive records when appropriate.
6. Create follow-up links between related records.
7. Summarize remaining open work.

## Helper Command

```bash
reqall-codex-plugin review --scope open
```
