# Reqall Guardrail

The Reqall guardrail enforces the Codex memory contract for non-trivial work:

1. Context retrieval completed before mutation.
2. Meaningful tool and subagent events were captured.
3. The root agent persisted outcomes and verified the project records.

Trusted lifecycle hooks operate the guardrail automatically. They store
session/turn/task-isolated state under `${PLUGIN_DATA}/reqall-guardrail/` and
use `.reqall/codex-guardrail/` only as a non-plugin fallback.

## Concrete Evidence

Free-form evidence text is not proof. A qualifying entry must be emitted by the
trusted `PostToolUse` hook and contain the Codex tool-call ID, recognized
operation, success result, and timestamp. CLI mark entries remain visible for
diagnostics but never qualify because their identifiers can be fabricated.
Task prompts, commands, and tool results are stored only as one-way digests,
never as raw text.

Context requires successful calls to:

- `upsert_project`
- `search`
- `list_records`

Final persistence requires a successful `upsert_record`, followed by a
successful `list_records` verification. `upsert_link` and `sleep_apply`
evidence remains useful, but neither substitutes for the work-item record.

## Commands

Hooks normally call the shared state library directly. From a source checkout,
manual diagnostics are available through:

```bash
node ./scripts/reqall-guardrail.mjs begin --task "fix auth retry bug" --session session-1 --turn turn-1
node ./scripts/reqall-guardrail.mjs status --session session-1 --turn turn-1
node ./scripts/reqall-guardrail.mjs check --session session-1 --turn turn-1
```

Diagnostic metadata can be recorded manually, but cannot satisfy `check`:

```bash
node ./scripts/reqall-guardrail.mjs mark-context --tool mcp__reqall__search --tool-use-id call-42 --session session-1 --turn turn-1
node ./scripts/reqall-guardrail.mjs mark-persist --tool mcp__reqall__upsert_record --tool-use-id call-43 --session session-1 --turn turn-1
```

`--evidence "description"` is retained as recognizable legacy syntax but exits
`14` without structured diagnostic metadata. Even a complete set of CLI marks
does not satisfy a milestone; trusted `PostToolUse` events are required.

Trivial tasks can still be marked explicitly:

```bash
node ./scripts/reqall-guardrail.mjs begin --trivial
node ./scripts/reqall-guardrail.mjs check
```

## Exit Codes

- `0` contract complete, or bounded degraded mode with mandatory disclosure
- `10` task was not begun
- `11` context operations are incomplete
- `12` persistence or its verification is incomplete
- `13` task state is stale or expired
- `14` a mark command lacks concrete tool evidence

Degraded-mode output never claims that the contract passed. It identifies
that Reqall was unavailable and requires the final response to disclose that
context and persistence did not run.

## Bounded Degraded Mode

Only a failed context operation observed by trusted `PostToolUse` evidence can
activate degraded mode, and only when its result clearly indicates an
authentication, network, or upstream service outage. Ordinary validation and
application failures remain incomplete and continue to block mutation.

Degraded state contains the outage category, operation, tool-call ID, and
digests; raw error text is never persisted. Mutation may continue for that
session/turn/task, and `Stop` warns without issuing a continuation. A new turn
starts without degraded state. If all context operations later succeed in the
same turn, normal final-persistence enforcement resumes.

## Concurrency And Freshness

Each state file is keyed by session and turn/task. A session-specific pointer
keeps manual CLI calls compatible when `--turn` is omitted. Writes use atomic
rename under a short-lived directory lock, preventing concurrent
`PostToolUse` events from dropping evidence. State older than eight hours is
rejected by default.

When an event includes a turn ID, pointer fallback is permitted only when the
pointer has that same turn ID. A delayed event from an older turn is discarded
rather than being written into the session's newer current task.

At `Stop`, the root turn is continued at most once. A second incomplete stop
reports the gap without continuing again. This bounds the lifecycle loop while
still giving the agent a chance to complete persistence.

## Runtime Requirement

Lifecycle hooks invoke the checked-in handler with a system Node.js 20 or
newer. Marketplace installation does not install Node or enforce
`package.json` engines. If `node` is unavailable, the hook command cannot
start, so automatic enforcement is unavailable. Standalone MCP configuration
does not depend on Node.
