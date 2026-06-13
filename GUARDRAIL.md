# Reqall Guardrail

The guardrail CLI enforces the Codex memory contract for non-trivial work:

1. Context injection ran.
2. Incremental documentation can be recorded.
3. Persistence ran.

It writes local state to `.reqall/codex-guardrail.json`.

## Commands

With the package installed in a project:

```bash
reqall-guardrail begin --task "fix auth retry bug"
reqall-guardrail mark-context --evidence "searched Reqall + reviewed open work"
reqall-guardrail mark-document --evidence "captured changed files + test notes"
reqall-guardrail mark-persist --evidence "persisted resolved work and tests"
reqall-guardrail check
```

Without a local install:

```bash
npx --package @reqall/codex-plugin reqall-guardrail begin --task "fix auth retry bug"
npx --package @reqall/codex-plugin reqall-guardrail mark-context --evidence "searched Reqall + reviewed open work"
npx --package @reqall/codex-plugin reqall-guardrail mark-document --evidence "captured changed files + test notes"
npx --package @reqall/codex-plugin reqall-guardrail mark-persist --evidence "persisted resolved work and tests"
npx --package @reqall/codex-plugin reqall-guardrail check
```

Trivial task:

```bash
reqall-guardrail begin --trivial
reqall-guardrail check
```

Other helpers:

```bash
reqall-guardrail status
reqall-guardrail reset
reqall-codex-plugin context --task "fix auth retry bug"
reqall-codex-plugin pre-edit --file src/auth.ts --task "fix auth retry bug"
reqall-codex-plugin document --tool edit --files src/auth.ts --summary "tightened retries"
reqall-codex-plugin persist --task "fix auth retry bug"
reqall-codex-plugin review --scope open
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

## Suggested Codex Flow

1. At task start: `begin`
2. After Reqall context retrieval: `mark-context`
3. After incremental notes are captured: `mark-document`
4. After Reqall persistence: `mark-persist`
5. Before final user response: `check`

If Reqall is unavailable, continue the user task and report the blocker.
