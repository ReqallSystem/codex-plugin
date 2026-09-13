# Reqall Memory Autopilot For Codex

Reqall has two mandatory goals on non-trivial work:

1. Inject relevant context from prior records before implementation.
2. Persist completed work before ending the turn.

Do this automatically. Do not wait for the user to ask.

## Tools

Use the Reqall MCP tools exposed by the host. Tool names may be displayed
with host-specific prefixes, but they correspond to these operations:

- `reqall:search`
- `reqall:upsert_project`
- `reqall:upsert_record`
- `reqall:get_record`
- `reqall:list_records`
- `reqall:list_projects`
- `reqall:upsert_link`
- `reqall:list_links`
- `reqall:impact`
- `reqall:sleep_candidates`
- `reqall:sleep_apply`
- `reqall:delete_record` (only if user explicitly asks)
- `reqall:delete_link` (only if user explicitly asks)
- `reqall:delete_project` (only if user explicitly asks)
- `reqall:share_project`
- `reqall:revoke_share`
- `reqall:list_shares`

## Skills

Use the bundled skills when available:

- `reqall:context` - initialize the project and gather relevant context
- `reqall:intend` - record agreed behavior or architecture before implementation
- `reqall:document` - capture one meaningful tool action or work item
- `reqall:persist` - persist all meaningful session outcomes
- `reqall:triage` - classify and prioritize incoming issues or requests
- `reqall:review` - review and update open records
- `reqall:sleep` - run knowledge-graph maintenance

The automatic flow below is still mandatory even when skills are not exposed
by the current host.

## Trigger Policy

Apply the full memory flow for non-trivial requests:

- code edits
- bug fixes
- refactors
- migrations
- architecture or specification decisions
- test or build work

Skip or minimize for trivial requests:

- greetings
- simple Q&A
- formatting-only output
- one-line informational asks

## Lifecycle Hooks And Guardrail

When the plugin hooks are trusted, they enforce this flow automatically:

1. `UserPromptSubmit` starts session/turn/task-isolated state and injects the
   context contract.
2. `PreToolUse` sees every local and MCP tool, treats unknown tools as
   mutating, and denies mutations until successful `upsert_project`, `search`,
   and `list_records` calls are observed.
3. `PostToolUse` sees the same tool stream and captures concrete Reqall
   tool-call IDs plus mutation/test evidence without storing raw commands or
   results.
4. `SubagentStart` and `SubagentStop` share status and capture notes; the root
   agent remains responsible for final persistence.
5. `Stop` requires a successful current-revision outcome `upsert_record` followed by exact
   `get_record`, outgoing `list_links`, and project `list_records` verification. Links and SLEEP operations are supplemental. It continues an
   incomplete turn at most once.

Do not replace concrete tool evidence with free-form claims. Manual
`mark-context`, `mark-document`, and `mark-persist` commands are diagnostic
only and never satisfy the guardrail, even when they receive a tool-looking
identifier. Only evidence emitted by the trusted `PostToolUse` hook qualifies; trusted
`PreToolUse` captures the work revision before each outcome write.
Use `reqall-guardrail status` or `reqall-guardrail check` for diagnostics.

Before context is complete, Bash uses a conservative read-only allowlist.
Only non-executing repository inspection may proceed. Test runners execute
repository code and are denied along with unknown commands, shell composition,
interpreters, and write-capable commands. Unknown local and MCP tools are also
denied unless they are on the small exact host/read allowlist. The
`functions.exec` wrapper is allowed because Codex emits its nested tool calls
individually for hook enforcement; do not infer safety by parsing wrapper
source.

A failed context call enters bounded degraded mode only when its trusted
`PostToolUse` result clearly identifies authentication, network, or upstream
service unavailability. The state stores an outage category and digests, not
raw error text. Work may continue, `Stop` does not force a continuation, and
the final response must disclose that Reqall context and persistence did not
run. Ordinary validation or application failures remain blocked. Each new
turn starts fresh, and successful context calls restore the normal persistence
contract.

Lifecycle hooks require a system `node` executable at version 20 or newer. A
marketplace or source plugin install does not install Node or enforce the npm
`engines` field. If the command is missing, the hook command fails and the
host cannot provide automatic enforcement. Standalone Reqall MCP setup does
not require Node. If hooks are unavailable or untrusted, the Phase A and Phase
B workflow below is still mandatory.

## Phase A: Automatic Context Injection

Run this before editing files or running substantial commands.

1. Reuse the authoritative host-provided project identity throughout the turn.
   Without a host binding, follow this policy:

Reuse the exact host-provided project identity throughout recall, work, persistence, and verification. Without a host binding, resolve: trimmed `REQALL_PROJECT_NAME` → network Git `origin` (final two path segments, trailing slash/`.git` removed) → explicitly labelled `project_name`/`project` prompt selection or retained session selection → nearest valid ancestor `.reqall.yml`/`.reqall.yaml` → nearest package identity (`package.json`, `go.mod`, `Cargo.toml` at each directory) → exact cwd-relative path within a known workspace (`REQALL_WORKSPACE_ROOT` or `.reqall-workspace`) → `.machine/<short-lower-hostname>/<os-user>`. Never infer identity from arbitrary slash tokens or an unconstrained directory basename. Labels accept `:`/`=` and plain, single/double-quoted, or backtick values; first labelled match wins, not synthetic report examples. Environment and network Git override retained selections at the next turn; mid-turn hooks reuse the bound identity. `REQALL_MACHINE_NAME` overrides the whole sanitized lowercase host segment (including deliberate dots); use the OS user account, not USER/USERNAME.

Read regular UTF-8 metadata files ≤64 KiB. Reqall YAML supports simple top-level string `project` (preferred) or `name`, matching quotes and trailing comments; reject duplicate keys, malformed quotes, nested/complex values, booleans/null/numbers. Package identity is string `package.json.name` (valid `@scope/name` becomes `scope/name`), complete Go `module`, or simple quoted Cargo `[package] name`. Skip invalid/unreadable values. Automatic identities allow ASCII letters/digits/`_-.` in nonempty slash segments; reject absolute/drive/UNC/backslash/tilde and `.`/`..` segments. Search ancestors through the containing workspace root inclusive, otherwise filesystem root. `REQALL_WORKSPACE_ROOT` (cwd-relative or `~/` supported), else nearest regular `.reqall-workspace`, sets the boundary; resolve symlinks before containment, do not replace an invalid explicit root with a marker, and do not use an empty root-relative identity. Preserve all relative segments. Deliberate manual SLEEP targets override automatic discovery; account preferences may deliberately target `.user`.


Project selection changes apply to future work only; no record migration is performed.

2. Call `reqall:upsert_project` with that exact name and store `project_id`.
3. Call `reqall:search` using the user task as query and the project name
   as hint.
4. Call `reqall:list_records` with `project_id` and `status: "open"` to
   surface active work.
5. If touching a specific file or component, perform an additional targeted
   search for that path/component before editing.
6. Call `reqall:get_record` for top relevant hits when details matter.
7. If changing existing tracked behavior, call `reqall:list_links` and
   `reqall:impact`.
8. Proceed with implementation using this context.
   For agreed new behavior or architecture, first reuse or create a spec/arch
   with `reqall:intend`. Skip intent records for routine fixes and chores.

## Incremental Documentation

After meaningful edits, build/deploy commands, migrations, configuration
changes, or verification:

1. Note touched files and behavior changes.
2. Capture completed work, verification evidence, and unresolved risks.
3. Draft Reqall-ready records while the details are fresh.
4. Reuse these notes during final persistence.

Skip read-only, no-op, and formatting-only actions.

## Phase B: Automatic Persistence

Run this before the final user-facing answer.

1. Enumerate distinct work items completed in the turn.
2. For each meaningful item, call `reqall:upsert_record` with appropriate
   `kind`, `status`, `title`, and `body`.
3. Link related records with `reqall:upsert_link` when relationships are
   clear.
4. If verification was run, persist test/build evidence as `kind: "test"`.
5. Persist unresolved follow-ups as open records.
6. Run `reqall:list_records` to sanity-check persisted/open items.
7. In the final response, briefly report what was persisted and any
   remaining open follow-ups.

Never rely on the user to remind you to persist.

Reconcile agreed intent with the actual outcomes: `implements` for completed
work, `tests` for verification, and an open follow-up linked with `blocks`
for remaining gaps. Use `work`, `info`, and inline `links` only if the host's
Reqall tool schema supports them; otherwise retain the defaults below.
The final outcome write must follow the latest mutation/test, and verification
must follow the latest record write. An open spec/arch intent write alone is
not final persistence.

## Classification Defaults

- Bug fixed -> `kind: "issue"`, `status: "resolved"`
- New unfixed bug -> `kind: "issue"`, `status: "open"`
- Completed implementation -> `kind: "todo"`, `status: "resolved"`
- Follow-up task -> `kind: "todo"`, `status: "open"`
- Architecture decision -> `kind: "arch"`, `status: "resolved"`
- New or updated spec -> `kind: "spec"`, `status: "open"`
- Test/build evidence -> `kind: "test"`, `status: "resolved"` when final,
  or `status: "active"` when ongoing
- Trivial/no-op -> skip

## Title Conventions

- Issues: `BUG:`, `TASK:`, `BLOCKER:`, `QUESTION:`
- Specs/architecture: `ARCH:`, `API:`, `AUTH:`, `DATA:`, `UI:`
- Features/refactors: `FEAT:`, `REFACTOR:`
- Verification: `TEST:`

## Safety

- Prefer status transitions (`open` -> `resolved` or `archived`) over
  deletion.
- Use destructive record, link, or project deletion only on explicit user
  request.
- Share or revoke project access only when the user's request authorizes that
  permission change.
- If Reqall MCP is unavailable, continue the user task and state clearly
  that automatic context or persistence could not run.

## Verified persistence additions (2026.9.10)

Consulted spec/arch reads are hints, not commitments. Select agreed existing
intent with a same-ID upsert preserving verified fields. Written commitments
require outcome → intent `implements` or open gap todo → intent `blocks` edges.
Every current-revision outcome needs exact record and complete outgoing link
readback; inspect all pages. Then list records scoped to the project.
Check every inline link result (`created` / `existing`); errors, missing entries,
or count mismatches are partial saves. Use explicit direction/endpoint tables
and at most 20 inline links, only when the host exposes them. Never recreate a
saved record after a link failure: repair, read back, recover via same-ID upsert,
and verify again. Pending work survives turns in project-isolated session state.

Automatic subscriptions use an explicitly configured REQALL_API_KEY and release
on SessionEnd. OAuth-only sessions use exposed tools explicitly. Account-level
actor=self is insufficient for own-session filtering; retain ambiguous updates.
SLEEP may expose work_review candidates and promote/discard; use only supported
operations and preserve durable knowledge.
