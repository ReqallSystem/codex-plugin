# Reqall Guardrail

This guardrail enforces the Codex parity contract for non-trivial tasks:
1. Context injection ran.
2. Incremental documentation can be recorded.
3. Persistence ran.

It uses a local state file at `.reqall/codex-guardrail.json`.

## Commands

If installed in the project (`npm i -D @reqall/codex-plugin`), run:

```bash
npx reqall-guardrail begin --task "fix auth retry bug"
npx reqall-guardrail mark-context --evidence "searched Reqall + reviewed open work"
npx reqall-guardrail mark-document --evidence "captured changed files + test notes"
npx reqall-guardrail mark-persist --evidence "persisted resolved work and tests"
npx reqall-guardrail check
```

Trivial task:

```bash
npx reqall-guardrail begin --trivial
npx reqall-guardrail check
```

Other helpers:

```bash
npx reqall-guardrail status
npx reqall-guardrail reset
npx reqall-codex-plugin context --task "fix auth retry bug"
npx reqall-codex-plugin pre-edit --file src/auth.ts --task "fix auth retry bug"
npx reqall-codex-plugin document --tool edit --files src/auth.ts --summary "tightened retries"
npx reqall-codex-plugin persist --task "fix auth retry bug"
npx reqall-codex-plugin review --scope open
```

Without local install, use one-shot execution:

```bash
npx -y @reqall/codex-plugin reqall-guardrail begin --task "fix auth retry bug"
```

## Stored State

The guardrail state stores:
- inferred project name
- current task summary
- whether the task is non-trivial
- timestamps for context/document/persist milestones
- lightweight evidence strings for context/document/persist confirmation

## Exit Codes

- `0` pass
- `10` `begin` was not run
- `11` context injection missing
- `12` persistence missing

## Suggested Agent Flow

1. At task start: `begin`
2. After Reqall context retrieval: `mark-context`
3. After incremental notes are captured: `mark-document`
4. After Reqall persistence: `mark-persist`
5. Before final user response: `check`
