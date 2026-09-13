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

Final persistence requires a successful outcome `upsert_record` after the
latest observed mutation/test, followed by exact `get_record` and outgoing `list_links` readbacks for
every current-revision outcome, then a project-scoped `list_records`. A subsequent edit, test, or record write makes the
corresponding milestone incomplete again. Open spec/arch writes are intent,
not final outcomes. `upsert_link` and `sleep_apply`
evidence remains useful, but neither substitutes for the work-item record.

MCP names must identify Reqall; another server's `search` or `upsert_record`
does not qualify. Legacy bare operation names remain supported. Structured
MCP errors, JSON-serialized failures, and running command handles do not
qualify as successful results.

Successful structured reads/writes of spec/arch records retain at most 20
record IDs and kinds in task state. `SessionStart` on compaction/resume and
the Stop continuation restore these hints for intent reconciliation. Titles,
bodies, and transcripts are not copied into state. State format 4 rejects older task formats. Persist before upgrading and
start a fresh thread. Consulted hints are distinct from written commitments.

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

## Typed reconciliation

A trusted project response must bind the exact requested name and numeric ID.
PreToolUse captures a revision before an outcome upsert; a result without that
snapshot cannot qualify. New work advances the revision. Every outcome in the
current batch needs matching project/kind/status/title/body fingerprints and
complete outgoing link pagination. Explicit endpoint tables and relationships
are checked, and written/selected intent must have an `implements` edge or an
open todo `blocks` edge. Read-only consultation never selects a commitment.

Partial inline-link saves keep their record IDs pending even if link repair
succeeds. A same-ID recovery upsert followed by exact readbacks is required.
Unfinished verification survives subsequent turns and project switches in
project-specific session buckets; context evidence remains per-turn. A later
batch may supersede earlier outcomes only by representing all unfinished work.
No record bodies/titles are stored: fingerprints support exact comparisons.

Subscriptions have a separate session store and optional explicit-key transport.
They cannot satisfy context or outcome evidence. See README for auth, delivery,
account-vs-session attribution, and advisory SessionEnd limitations.


## Git-only bookkeeping

A routine request to commit/push existing work does not itself create new durable
knowledge. Successful standalone `git add`, `git commit`, and `git push` calls
remain context-gated, but their trusted evidence is operational: they do not
advance the work revision, invalidate verified outcomes, or promote a trivial
turn to substantive work. Do not create duplicate records or a memory footer
solely for these operations; useful commit references may update an existing
substantive record.

This exemption is deliberately narrow. Failed calls, compound shell commands,
Git aliases/global options, merge/rebase, tests, edits and unknown tools retain
conservative classification. Substantive requests still require persistence,
as do findings or decisions discovered during bookkeeping. Pending outcomes and
selected commitments survive Git-only follow-up turns and must be reconciled.
The classifier sees tool calls, not hidden Git-hook side effects: report and
persist substantive edits or verification performed by a Git hook. Tracker
administration is not automatically exempted by this mitigation.
