# Codex Plugin Capability Plan

Primary objective: guaranteed automatic context injection + persistence for non-trivial work.

Current status (2026-03-22):
- Implemented: Codex parity bundle with context/document/persist/review skills
- Implemented: local guardrail CLI (`reqall-guardrail`) with evidence-backed begin/context/document/persist/check state
- Implemented: helper CLI (`reqall-codex-plugin`) for context, pre-edit, document, persist, and review workflows
- Implemented: portable MCP configuration examples (`config.toml.example`, `.mcp.json`, `mcp-servers.json`)

## Remaining Gaps To Native Hook Parity

1. Native lifecycle hook adapter (when Codex exposes stable hooks)
   - Map start-of-task -> context retrieval
   - Map pre-edit events -> file-aware retrieval
   - Map post-tool/write events -> incremental documentation
   - Map end-of-task -> mandatory persistence
   - Map subagent completion -> plan/result persistence

2. Verified Reqall MCP audit trail
   - Replace manual evidence strings with machine-verified MCP operation traces
   - Attach created/updated record identifiers to guardrail state

## P1: Quality And Recall Depth

1. Diff-aware record drafting
   - Draft structured `upsert_record` payloads from changed files + command outcomes

2. Verification evidence normalizer
   - Convert noisy test/build output into concise `test` records and links

3. Open-risk extractor
   - Detect unresolved TODOs/failures and persist as open issue/todo records

4. Review assistant automation
   - Recommend stale/duplicate/open record actions during review mode

## P2: Integration

1. PR merge sync
   - Link merged PR metadata to Reqall records

2. Cross-project impact hints
   - Suggest project/project and record/record links for shared component changes

3. Mode presets
   - Fast fix, deep refactor, release hardening profiles for memory density
