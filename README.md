# Reqall Codex Plugin

Persistent semantic memory and lifecycle guardrails for Codex agents.

Reqall gives Codex a repeatable memory workflow:

1. Gather relevant project context before non-trivial work.
2. Capture concrete tool, mutation, subagent, and verification evidence.
3. Persist meaningful outcomes before the root turn ends.

## Capability Status

The plugin uses Codex lifecycle hooks from the default `hooks/hooks.json`
location. No `hooks` field is required in `.codex-plugin/plugin.json`.

The hook layer now provides:

- `SessionStart` and `UserPromptSubmit` context-contract injection
- all-tool `PreToolUse` mutation gating until Reqall context is complete
- `PostToolUse` capture of successful Reqall operation IDs, edits, and tests
- `SubagentStart` and `SubagentStop` context sharing and result notes
- `Stop` enforcement of root-owned final persistence, with a one-continuation
  loop limit
- session/turn/task-isolated, atomic guardrail state under `PLUGIN_DATA`

Codex requires users to review and trust non-managed plugin hooks. After
installing or updating the plugin, open `/hooks`, review the Reqall commands,
trust them, and start a new session.

## What Is Included

- `.codex-plugin/plugin.json` - Codex plugin manifest
- `.app.json` - registered Reqall connector for interactive login
- `.mcp.json` - Codex plugin MCP server declaration
- `hooks/hooks.json` and `scripts/reqall-hook.mjs` - lifecycle automation
- `skills/` - context, documentation, persistence, triage, review, and SLEEP
  workflows with `agents/openai.yaml` metadata
- `AGENTS.md` - host-independent workflow policy
- `scripts/reqall-guardrail.mjs` - guardrail diagnostics and manual controls
- `scripts/reqall-codex-plugin.mjs` - workflow checklist helpers
- `config.toml.example` - standalone MCP configuration

## Install

The lifecycle hooks require a system Node.js 20 or newer on `PATH`. Check it
before installing:

```bash
node --version
```

Marketplace and source installs do not bundle Node or enforce the npm
`engines` declaration. Without a suitable `node` command, the hook process
fails to start and Codex cannot apply the lifecycle guardrail; review the hook
error and disclose that automation is unavailable. The standalone MCP setup
in the next section is Node-free.

Install from the Reqall marketplace:

```bash
codex plugin marketplace add ReqallSystem/plugins
codex plugin add reqall@reqall-plugins
```

Connect the bundled Reqall app when Codex prompts for authentication. After
installation, review the hooks with `/hooks` and start a new session so Codex
loads the plugin's skills, MCP tools, and trusted hook definition.

Use Codex's plugin commands to inspect or refresh the installation:

```bash
codex plugin list
codex plugin add reqall@reqall-plugins
```

## Authentication

The preferred plugin path is the registered connector in `.app.json`, where
Codex owns interactive login and reauthentication.

The plugin supplies both a registered app connector and its MCP server
declaration, so a separate `codex mcp add` is not needed for a normal plugin
installation. For a standalone Codex CLI configuration without the plugin,
use native OAuth:

```bash
codex mcp add reqall --url https://www.reqall.net/mcp
codex mcp login reqall
```

For hosts or self-managed environments that need an API-key fallback, set
`REQALL_API_KEY` and use `bearer_token_env_var` rather than interpolating a raw
Authorization header:

```bash
codex mcp add reqall --url https://www.reqall.net/mcp --bearer-token-env-var REQALL_API_KEY
```

Equivalent `config.toml`:

```toml
[mcp_servers.reqall]
url = "https://www.reqall.net/mcp"
bearer_token_env_var = "REQALL_API_KEY"
```

For self-hosted Reqall, substitute the deployment's HTTPS MCP endpoint.

## Lifecycle Contract

For a non-trivial turn, successful tool calls must provide these concrete
milestones:

1. Context: `upsert_project`, `search`, and `list_records`.
2. Persistence: `upsert_record` for each meaningful work item. `upsert_link`
   and `sleep_apply` are supplemental and cannot replace the work-item record.
3. Verification: `list_records` after the required `upsert_record`.

`PostToolUse` stores the Codex tool-call ID, normalized operation, timestamp,
success flag, and hashes of the input/result. User prompts are represented by
a one-way task digest. Raw prompts, shell commands, and tool results are not
stored. Free-form evidence strings cannot satisfy the guardrail.

A narrow allowlist of non-executing repository inspection commands is
available before context. Test runners execute repository code and are not on
that allowlist. Unknown Bash commands, shell composition, interpreters, file
edits, Reqall write/delete/share operations, and the stateful
`sleep_candidates` audit are denied by default until context is complete.
Every local and MCP tool passes through the hook; unknown tool names default
to mutating, with only a small exact host/read allowlist. Reqall context and
read operations remain available so the agent can satisfy the contract.

Codex emits nested calls made through `functions.exec` as individual tool
events. The wrapper itself is therefore allowlisted, while each nested tool is
classified independently; the hook does not attempt to parse JavaScript
wrapper source. Its completion-only `functions.wait` companion is also safe;
tools that can write to a running process remain gated. Shell classification
accepts both the legacy `command` input
used by Bash-style tools and the current unified `exec_command` `cmd` input,
including the known `functions.exec_command` namespace. Unknown namespaces
remain default-deny even when their final segment resembles a safe host tool.

At `Stop`, an incomplete non-trivial root turn receives one continuation
prompt. If the continuation still cannot persist, the hook reports the gap and
allows the turn to end rather than looping indefinitely. Subagents contribute
notes, but never satisfy or own final root persistence.

If a trusted `PostToolUse` result for a context operation clearly reports an
authentication, network, or upstream service outage, the current turn enters
bounded degraded mode. The hook records only an outage category, operation,
tool-call ID, and digests. It allows work to continue and lets `Stop` finish
without a continuation, while requiring the final response to disclose that
Reqall context and persistence did not run. Validation errors and ordinary
tool failures do not qualify. A new turn retries normally; if all context calls
later succeed in the same turn, normal persistence enforcement resumes.

## Guardrail State

Installed hooks write to:

```text
${PLUGIN_DATA}/reqall-guardrail/
```

When `PLUGIN_DATA` is unavailable, the CLI uses the safe project-local
fallback `.reqall/codex-guardrail/`, which is ignored by this repository.
State files are keyed by session plus turn/task, written atomically, protected
by short-lived cross-process locks, and rejected after eight hours by default.
Events carrying a turn ID never fall back to a different turn's current state,
so delayed tool results cannot complete a newer task's milestones.
Set `REQALL_GUARDRAIL_MAX_AGE_MS` only when a different bounded freshness
window is required.

## Helper CLI

From a source checkout:

```bash
node ./scripts/reqall-codex-plugin.mjs project
node ./scripts/reqall-codex-plugin.mjs context --task "fix flaky auth retry"
node ./scripts/reqall-codex-plugin.mjs pre-edit --file src/auth.ts --task "fix flaky auth retry"
node ./scripts/reqall-codex-plugin.mjs document --tool edit --files src/auth.ts,tests/auth.test.ts --summary "tightened retry backoff"
node ./scripts/reqall-codex-plugin.mjs persist --task "fix flaky auth retry" --tests "npm test"
node ./scripts/reqall-codex-plugin.mjs review --scope open
```

After the current scoped package is published, the same commands are available
without a checkout using an explicit package selector:

```bash
npx --package @reqall/codex-plugin reqall-codex-plugin project
```

Marketplace installation does not add npm binaries to the user's `PATH`.
Bundled hooks therefore invoke the checked-in handler through `${PLUGIN_ROOT}`.

## Manual Guardrail Diagnostics

The hooks normally begin tasks and capture qualifying evidence automatically.
CLI mark commands are diagnostic only: a caller can fabricate their arguments,
so their entries never satisfy `check`. Only trusted `PostToolUse` hook
evidence qualifies.

```bash
node ./scripts/reqall-guardrail.mjs begin --task "fix auth retry" --session session-1 --turn turn-1
node ./scripts/reqall-guardrail.mjs mark-context --tool mcp__reqall__upsert_project --tool-use-id call-1 --session session-1 --turn turn-1
node ./scripts/reqall-guardrail.mjs mark-context --tool mcp__reqall__search --tool-use-id call-2 --session session-1 --turn turn-1
node ./scripts/reqall-guardrail.mjs mark-context --tool mcp__reqall__list_records --tool-use-id call-3 --session session-1 --turn turn-1
node ./scripts/reqall-guardrail.mjs status --session session-1 --turn turn-1
node ./scripts/reqall-guardrail.mjs check --session session-1 --turn turn-1
```

`check` exit codes are `0` for a complete contract or explicitly reported
degraded mode, `10` missing task, `11` missing context, `12` missing
persistence, and `13` stale state. Degraded output never says that the
guardrail passed; it directs the caller to disclose the unavailable memory
work. Mark commands return `14` for missing or invalid diagnostic metadata.

## Development

Requires Node.js 20 or newer.

```bash
npm test
npm pack --dry-run
python <plugin-creator>/scripts/validate_plugin.py .
```

## Publish

```bash
npm publish --access public
```
