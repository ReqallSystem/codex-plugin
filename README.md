# Reqall Codex Plugin

Persistent semantic memory for OpenAI Codex agents.

## Intent

Reqall must do two things automatically on non-trivial work:
1. Inject relevant context from prior memories before implementation.
2. Persist new memories after implementation is complete.

The user should not need to ask for retrieve/store each time.

## Automation Model

`codex-plugin` enforces this through `AGENTS.md` policy:
- automatic pre-task context retrieval
- automatic pre-response persistence
- explicit reporting of persisted items and open follow-ups

This delivers the same end result as hook-based systems even when host-level lifecycle hooks are limited.

## Included Files

- `AGENTS.md` - mandatory autonomous memory workflow for Codex
- `config.toml.example` - MCP server configuration
- `GUARDRAIL.md` - command-level enforcement for context + persistence
- `ROADMAP.md` - next capabilities (including native hook parity path)

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

3. Merge `AGENTS.md` into your project-level `AGENTS.md`.

4. Set environment variables:

```bash
export REQALL_API_KEY="your-api-key"
export REQALL_URL="https://reqall.net"
```

Optional:

```bash
export REQALL_PROJECT_NAME="org/repo-or-workspace"
```

## P0 Guardrail

Use the guardrail CLI to enforce that non-trivial tasks both retrieved context and persisted memory:

```bash
reqall-guardrail begin --task "short task summary"
# ... run Reqall context retrieval ...
reqall-guardrail mark-context
# ... complete work + Reqall persistence ...
reqall-guardrail mark-persist
reqall-guardrail check
```

See `GUARDRAIL.md` for full details.

## Publish

Static package, no build step:

```bash
npm publish --access public
```
