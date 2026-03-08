# Reqall Guardrail (P0)

This guardrail enforces the P0 contract for non-trivial tasks:
1. Context injection ran.
2. Persistence ran.

It uses a local state file at `.reqall/codex-guardrail.json`.

## Commands

If installed in the project (`npm i -D @reqall/codex-plugin`), run:

```bash
npx reqall-guardrail begin --task "fix auth retry bug"
npx reqall-guardrail mark-context
npx reqall-guardrail mark-persist
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
```

Without local install, use one-shot execution:

```bash
npx -y @reqall/codex-plugin begin --task "fix auth retry bug"
```

## Exit Codes

- `0` pass
- `10` `begin` was not run
- `11` context injection missing
- `12` persistence missing

## Suggested Agent Flow

1. At task start: `begin`
2. After Reqall context retrieval: `mark-context`
3. After Reqall persistence: `mark-persist`
4. Before final user response: `check`
