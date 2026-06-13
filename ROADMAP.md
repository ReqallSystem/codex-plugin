# Codex Plugin Capability Plan

Primary objective: guaranteed automatic context injection and persistence for
non-trivial Codex work.

Current status (2026-06-13):

- Implemented: Codex plugin manifest in `.codex-plugin/plugin.json`.
- Implemented: compatibility manifest in `.claude-plugin/plugin.json`.
- Implemented: Reqall MCP companion config in `.mcp.json` and
  `mcp-servers.json`.
- Implemented: reusable skills for context, documentation, persistence,
  triage, review, and SLEEP maintenance.
- Implemented: helper CLI (`reqall-codex-plugin`) for context, pre-edit,
  document, persist, and review checklists.
- Implemented: local guardrail CLI (`reqall-guardrail`) with evidence-backed
  begin/context/document/persist/check state.
- Implemented: `AGENTS.md` autopilot policy for hosts without lifecycle
  hooks.

## Remaining Gaps To Native Hook Parity

1. Codex host lifecycle hooks
   - Map start-of-task to context retrieval when Codex exposes stable hooks.
   - Map pre-edit events to file-aware retrieval.
   - Map post-tool/write events to incremental documentation.
   - Map end-of-task to mandatory persistence.
   - Map subagent completion to plan/result persistence.

2. Verified Reqall MCP audit trail
   - Replace manual evidence strings with machine-verified MCP operation
     traces.
   - Attach created/updated record identifiers to guardrail state.

## P1: Quality And Recall Depth

1. Diff-aware record drafting
   - Draft structured `upsert_record` payloads from changed files and command
     outcomes.

2. Verification evidence normalizer
   - Convert noisy test/build output into concise `test` records and links.

3. Open-risk extractor
   - Detect unresolved TODOs, failures, or skipped verification and persist
     them as open issue/todo records.

4. Review assistant automation
   - Recommend stale, duplicate, and open-record actions during review mode.

## P2: Integration

1. PR merge sync
   - Link merged PR metadata to Reqall records.

2. Cross-project impact hints
   - Suggest project/project and record/record links for shared component
     changes.

3. Mode presets
   - Fast fix, deep refactor, and release hardening profiles for memory
     density.
