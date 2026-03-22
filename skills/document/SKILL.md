# Reqall Incremental Documentation Skill For Codex

Use this skill after meaningful tool activity, file edits, or tests.

## Goal

Turn intermediate work into concise Reqall-ready notes instead of waiting until the end of the turn.

## Workflow

1. Identify the tool activity that just completed.
2. List the touched files and the behavioral change.
3. Capture:
   - completed work
   - tests or verification evidence
   - unresolved issues and follow-ups
4. Draft structured Reqall records:
   - completed implementation -> `kind=todo`, `status=resolved`
   - new bug -> `kind=issue`, `status=open`
   - architecture decision -> `kind=arch`, `status=resolved`
   - verification -> `kind=test`
5. Link related records when a shared component or decision is involved.
6. Reuse these notes during final persistence.

## Helper Command

```bash
reqall-codex-plugin document --tool edit --files src/a.js,src/b.js --summary "brief summary"
reqall-guardrail mark-document --evidence "captured intermediate implementation notes"
```
