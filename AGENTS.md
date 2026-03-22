# Reqall Memory Autopilot For Codex

Reqall has two mandatory goals on non-trivial work:
1. Inject relevant context from prior records before implementation.
2. Persist completed work before ending the turn.

Do this automatically. Do not wait for the user to ask.

## Tools

- `reqall:search`
- `reqall:upsert_project`
- `reqall:upsert_record`
- `reqall:get_record`
- `reqall:list_records`
- `reqall:list_projects`
- `reqall:upsert_link`
- `reqall:list_links`
- `reqall:impact`
- `reqall:delete_record` (only if user explicitly asks)
- `reqall:delete_link` (only if user explicitly asks)

## Skills

Use the bundled skills when available:
- `skills/context/SKILL.md`
- `skills/document/SKILL.md`
- `skills/persist/SKILL.md`
- `skills/review/SKILL.md`

## Trigger Policy

Apply the full memory flow for non-trivial requests:
- code edits, bug fixes, refactors, migrations, architecture/spec decisions, test work

Skip or minimize for trivial requests:
- greetings, simple Q&A, formatting-only output, one-line informational asks

## Guardrail Commands

If `reqall-guardrail` is available, enforce the flow with commands:

1. Task start:
   - non-trivial: `reqall-guardrail begin --task "<user request summary>"`
   - trivial: `reqall-guardrail begin --trivial`
2. After Phase A completes: `reqall-guardrail mark-context --evidence "searched Reqall + reviewed open records"`
3. After incremental notes are captured: `reqall-guardrail mark-document --evidence "captured changed files + verification notes"`
4. After Phase B completes: `reqall-guardrail mark-persist --evidence "persisted records + verification evidence"`
5. Before final response: `reqall-guardrail check`

If `check` fails, finish missing steps before responding.

## Phase A: Automatic Context Injection (Before Work)

For each non-trivial request, before editing/running substantial commands:

1. Resolve project name in this order:
   - `REQALL_PROJECT_NAME`
   - git remote repo name (`org/repo`)
   - current directory name
2. Call `reqall:upsert_project` with that exact name; store `project_id`.
3. Call `reqall:search` using the user task as query and project hint.
4. Call `reqall:list_records` with `project_id` and `status: "open"` to surface active work.
5. If touching a specific file or component, perform an additional targeted search for that path/component before editing.
6. Call `reqall:get_record` for top relevant hits when details matter.
7. If changing existing tracked behavior, call `reqall:list_links` and `reqall:impact`.
8. Proceed with implementation using this context.

## Incremental Documentation (During Work)

After meaningful tool activity, edits, or verification:

1. Note touched files and behavior changes.
2. Capture completed work, verification evidence, and unresolved risks.
3. Draft Reqall-ready records while the details are fresh.
4. Reuse these drafts during final persistence.

## Phase B: Automatic Persistence (Before Final Response)

For each non-trivial request, before the final user-facing answer:

1. Enumerate distinct work items completed in the turn.
2. For each meaningful item, call `reqall:upsert_record` with appropriate `kind`, `status`, `title`, and `body`.
3. Link related records with `reqall:upsert_link` when relationships are clear.
4. If verification was run, persist test/build evidence as `kind=test`.
5. Persist unresolved follow-ups as open records.
6. Run `reqall:list_records` to sanity-check persisted/open items.
7. In the final response, briefly report what was persisted and any remaining open follow-ups.

Never rely on the user to remind you to persist.

## Classification Defaults

- Bug fixed -> `kind=issue`, `status=resolved`
- New unfixed bug -> `kind=issue`, `status=open`
- Completed implementation -> `kind=todo`, `status=resolved`
- Follow-up task -> `kind=todo`, `status=open`
- Architecture decision -> `kind=arch`, `status=resolved`
- New or updated spec -> `kind=spec`, `status=open`
- Test/build evidence -> `kind=test`, `status=active` (or `resolved` when final)
- Trivial/no-op -> skip

## Title Conventions

- Issues: `BUG:`, `TASK:`, `BLOCKER:`, `QUESTION:`
- Specs/architecture: `ARCH:`, `API:`, `AUTH:`, `DATA:`, `UI:`
- Features/refactors: `FEAT:`, `REFACTOR:`
- Verification: `TEST:`

## Safety

- Prefer `status` transitions (`open` -> `resolved`/`archived`) over deletion.
- Use destructive deletes only on explicit user request.

## Failure Behavior

If Reqall MCP is unavailable:
1. Continue the user task.
2. State clearly that automatic context/persistence could not run.
3. Avoid pretending persistence succeeded.
