# Codex Plugin Capability Plan

Primary objective: reliable automatic context injection and persistence for
non-trivial Codex work.

## Implemented In 2026.8.0

- Default plugin lifecycle hooks in `hooks/hooks.json`; no manifest override
  is required.
- Start-of-session and prompt-level Reqall context contracts.
- Pre-mutation gating with a conservative read-only Bash allowlist and
  default-deny handling for unknown shell/tool operations.
- Machine-captured `PostToolUse` evidence keyed by Codex tool-call ID.
- Bounded, disclosure-first degraded mode for concrete Reqall auth, network,
  and upstream service outages.
- Root-owned persistence with bounded `Stop` continuation.
- Subagent context sharing and completion notes without allowing a subagent to
  satisfy final persistence.
- Session/turn/task-isolated, fresh, atomic, concurrency-safe guardrail state
  under `PLUGIN_DATA`, with a safe project fallback.
- Native Codex MCP config and OAuth documentation, plus bearer-token fallback.
- Codex-native plugin metadata only; legacy cross-host manifests and duplicate
  MCP declarations have been removed.
- `agents/openai.yaml` invocation policy and Reqall MCP dependency metadata for
  every skill.
- Behavioral Node tests and package/plugin validation commands.
- Current unified `exec_command` support, including namespaced tool names and
  the `cmd` input used for mutation gating and test-evidence capture.

## P1: Server Contract And Recall Quality

1. Server/connector schema parity
   - Current Reqall tools supply `structuredContent` and concise text.
   - Keep newer `work`/`info` kinds and inline `links` capability-aware until
     every connected host exposes them.

2. Diff-aware record drafting
   - Convert mutation evidence into focused record proposals without storing
     raw commands or tool results.

3. Verification evidence normalization
   - Convert noisy test/build outcomes into concise test records and links.

4. Open-risk extraction
   - Detect unresolved failures, skipped verification, and follow-up tasks.

## P2: Integration

1. MCP App UI
   - Add optional open-record review, impact graph, and SLEEP confirmation UI.

2. PR merge synchronization
   - Link merged pull-request metadata to Reqall records.

3. Cross-project impact hints
   - Suggest useful project and record links for shared components.

4. Public directory readiness
   - Supply legal/support URLs, visual assets, review test cases, demo material,
     and current MCP metadata scans.

## Known Boundaries

- Plugin hooks run only after the user reviews and trusts their current hash.
- Lifecycle hooks require system Node.js 20 or newer; marketplace installation
  does not provision or enforce that runtime. Standalone MCP use is Node-free.
- Tool hooks cover Codex local function and MCP calls, but specialized hosted
  tool paths can opt out of lifecycle interception.
- The pre-context shell allowlist intentionally denies unfamiliar inspection
  commands until Reqall context is complete; add safe commands only with
  behavioral tests.
- `SessionEnd` is advisory and cannot keep a turn alive, so final enforcement
  remains on `Stop`.
- `prompt`/`agent` hook handlers are currently skipped by Codex. MCP tool
  hooks do not trigger nested lifecycle evidence and need an already-ready
  connection; they cannot replace the current guardrail without a redesign.
- Full model-driven install/login/compaction evaluations remain separate from
  deterministic hook tests; see EVALUATION.md for the checked baseline.

## Implemented In 2026.9.1

- Agreed intent skill and capability-aware outcome reconciliation, adapted
  from the Claude plugin without Claude-specific plan or auth hooks.
- Bounded spec/arch ID recovery on compaction/resume.
- Reqall-specific tool recognition and structured error handling.
- Persistence freshness after work and verification after the latest write.
- Synchronized npm/manifest/lock versions and package regression checks.
