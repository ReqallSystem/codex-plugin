# Reqall Codex Plugin

Persistent semantic memory for Codex agents.

Reqall gives Codex a repeatable memory workflow:

1. Gather relevant project context before non-trivial work.
2. Complete the work using that context.
3. Persist meaningful outcomes before the turn ends.

## Capability Status

This package ships the same core workflow surface as the Claude plugin:

- context bootstrap guidance
- file-aware and incremental documentation guidance
- final persistence guidance
- triage, review, and SLEEP maintenance workflows
- local guardrail enforcement for context and persistence
- installable MCP configuration examples

Codex still relies on `AGENTS.md`, skills, helper commands, and guardrails
instead of host-native lifecycle hooks.

## What Is Included

- `.codex-plugin/plugin.json` - Codex plugin manifest
- `.claude-plugin/plugin.json` - compatibility manifest for hosts that still
  read the older shape
- `.mcp.json` and `mcp-servers.json` - Reqall MCP server configuration
- `skills/` - reusable Reqall workflows:
  - `reqall:context` - gather project memory before work
  - `reqall:document` - capture one meaningful tool action or work item
  - `reqall:persist` - persist all meaningful session outcomes
  - `reqall:triage` - classify and prioritize incoming issues or requests
  - `reqall:review` - review open project records
  - `reqall:sleep` - run knowledge-graph maintenance
- `AGENTS.md` - Codex autopilot policy for mandatory context and persistence
- `scripts/reqall-guardrail.mjs` - local state/evidence guardrail CLI
- `scripts/reqall-codex-plugin.mjs` - helper CLI for workflow checklists
- `config.toml.example` - manual MCP config for non-plugin installs

## Setup

Set your Reqall API key:

```bash
export REQALL_API_KEY="your-api-key"
```

The packaged plugin uses the cloud endpoint by default:

```text
https://www.reqall.net/mcp
```

For self-hosted Reqall, update `.mcp.json` or your Codex MCP config to point
at `${REQALL_URL}/mcp`.

## Manual Codex Config

If you are not installing through the Codex plugin system, copy
`config.toml.example` into your Codex config:

```toml
[mcp.reqall]
url = "https://www.reqall.net/mcp"

[mcp.reqall.headers]
Authorization = "Bearer ${REQALL_API_KEY}"
```

Then merge `AGENTS.md` into the project-level `AGENTS.md` so Codex runs the
memory workflow automatically on non-trivial work.

## Helper CLI

Resolve the inferred project:

```bash
npx reqall-codex-plugin project
```

Print a context injection checklist:

```bash
npx reqall-codex-plugin context --task "fix flaky auth retry"
```

Print a pre-edit file-specific checklist:

```bash
npx reqall-codex-plugin pre-edit --file src/auth.ts --task "fix flaky auth retry"
```

Print an incremental documentation checklist:

```bash
npx reqall-codex-plugin document --tool edit --files src/auth.ts,tests/auth.test.ts --summary "tightened retry backoff"
```

Print a final persistence checklist:

```bash
npx reqall-codex-plugin persist --task "fix flaky auth retry" --tests "npm test"
```

Print a review workflow checklist:

```bash
npx reqall-codex-plugin review --scope open
```

## Guardrail

Use the guardrail CLI to enforce that non-trivial tasks both retrieved context
and persisted memory, while also storing lightweight evidence of those steps:

```bash
reqall-guardrail begin --task "short task summary"
reqall-guardrail mark-context --evidence "searched Reqall + reviewed open records"
reqall-guardrail mark-document --evidence "recorded changed files + verification"
reqall-guardrail mark-persist --evidence "upserted records + verification evidence"
reqall-guardrail check
```

Trivial tasks can be marked explicitly:

```bash
reqall-guardrail begin --trivial
reqall-guardrail check
```

## Development

This package is static and has no build step.

```bash
npm pack --dry-run
python <plugin-creator>/scripts/validate_plugin.py .
```

## Publish

```bash
npm publish --access public
```
