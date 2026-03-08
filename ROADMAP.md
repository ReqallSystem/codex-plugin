# Codex Plugin Capability Plan

Primary objective: guaranteed automatic context injection + persistence for non-trivial work.

Current status (2026-03-08):
- Implemented: local P0 guardrail CLI (`reqall-guardrail`) with begin/context/persist/check enforcement.

## P0: Automation Guarantees

1. Native lifecycle hook adapter (when host exposes stable hooks)
   - Map start-of-task -> context retrieval
   - Map end-of-task -> mandatory persistence
   - Map tool-write events -> optional incremental documentation

2. Persistence guardrail
   - Pre-final-response check that verifies at least one persistence attempt for non-trivial work
   - Explicit failure reporting when persistence could not run

3. Context bootstrap guardrail
   - Pre-edit check that verifies context retrieval ran for non-trivial tasks
   - Fall back to lightweight retrieval if skipped

## P1: Quality And Recall Depth

1. Diff-aware record drafting
   - Draft structured `upsert_record` payloads from changed files + command outcomes

2. Verification evidence normalizer
   - Convert noisy test/build output into concise `test` records and links

3. Open-risk extractor
   - Detect unresolved TODOs/failures and persist as open issue/todo records

## P2: Integration

1. PR merge sync
   - Link merged PR metadata to Reqall records

2. Cross-project impact hints
   - Suggest project/project and record/record links for shared component changes

3. Mode presets
   - Fast fix, deep refactor, release hardening profiles for memory density

## Suggested Order

1. Native lifecycle hook adapter
2. Persistence guardrail
3. Context bootstrap guardrail
4. Diff-aware drafting
5. Verification normalizer
6. Open-risk extractor
