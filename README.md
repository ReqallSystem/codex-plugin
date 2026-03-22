# Reqall Codex Plugin

Persistent semantic memory for OpenAI Codex agents.

## Intent

Reqall must do two things automatically on non-trivial work:
1. Inject relevant context from prior memories before implementation.
2. Persist new memories after implementation is complete.

The user should not need to ask for retrieve/store each time.

## Capability Parity Status

This package now ships the same core workflow surface as the Claude plugin:
- context bootstrap guidance
- incremental documentation guidance
- final persistence guidance
- review workflow guidance
- local guardrail enforcement for context + persistence
- installable MCP configuration examples

Codex still relies on `AGENTS.md` + skills instead of host-native hooks, but the package now includes the same skill set and helper commands so the workflow can be applied consistently inside Codex.

## Included Files

- `AGENTS.md` - mandatory autonomous memory workflow for Codex
- `skills/context/SKILL.md` - pre-task context retrieval workflow
- `skills/document/SKILL.md` - post-tool incremental documentation workflow
- `skills/persist/SKILL.md` - end-of-turn persistence workflow
- `skills/review/SKILL.md` - review and triage workflow
- `config.toml.example` - Codex MCP server configuration
- `.mcp.json` / `mcp-servers.json` - portable MCP configuration examples
- `GUARDRAIL.md` - command-level enforcement for context + persistence
- `scripts/reqall-guardrail.mjs` - local state/evidence guardrail CLI
- `scripts/reqall-codex-plugin.mjs` - helper CLI for context/document/persist/review prompts

## Setup

1. Install:

```bash
npm i -D @reqall/codex-plugin
```

2. Configure Reqall MCP in Codex config:

```toml
[mcp.reqall]
url = "${REQALL_URL}/mcp"

[mcp.reqall.headers]
Authorization = "Bearer ${REQALL_API_KEY}"
```

Alternative portable config examples are included in `.mcp.json` and `mcp-servers.json`.

3. Merge `AGENTS.md` into your project-level `AGENTS.md`.

4. Copy the included `skills/` into your Codex skills directory if you want explicit reusable skills in addition to the top-level `AGENTS.md` policy.

5. Set environment variables:

```bash
export REQALL_API_KEY="your-api-key"
export REQALL_URL="https://reqall.net"
```

Optional:

```bash
export REQALL_PROJECT_NAME="org/repo-or-workspace"
```

## Helper CLI

### Resolve the inferred project

```bash
npx reqall-codex-plugin project
```

### Print a context injection checklist

```bash
npx reqall-codex-plugin context --task "fix flaky auth retry"
```

### Print a pre-edit file-specific checklist

```bash
npx reqall-codex-plugin pre-edit --file src/auth.ts --task "fix flaky auth retry"
```

### Print an incremental documentation checklist

```bash
npx reqall-codex-plugin document --tool edit --files src/auth.ts,tests/auth.test.ts --summary "tightened retry backoff"
```

### Print a final persistence checklist

```bash
npx reqall-codex-plugin persist --task "fix flaky auth retry" --tests "npm test"
```

### Print a review workflow checklist

```bash
npx reqall-codex-plugin review --scope open
```

## Guardrail

Use the guardrail CLI to enforce that non-trivial tasks both retrieved context and persisted memory, while also storing lightweight evidence of those steps:

```bash
reqall-guardrail begin --task "short task summary"
# ... run Reqall context retrieval ...
reqall-guardrail mark-context --evidence "searched Reqall + reviewed open records"
# ... capture incremental notes as work progresses ...
reqall-guardrail mark-document --evidence "recorded changed files + verification"
# ... complete work + Reqall persistence ...
reqall-guardrail mark-persist --evidence "upserted records + verification evidence"
reqall-guardrail check
```

See `GUARDRAIL.md` for full details.

## Publish

Static package, no build step:

```bash
npm publish --access public
```
