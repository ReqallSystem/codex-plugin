# Reqall Codex plugin evaluation — 2026-09-04

The plugin retains a suitable Codex integration architecture. This audit
updates the source to **2026.9.1**, with the fixes below. It compares the
checked-out Claude plugin **2026.9.2**, installed Codex **0.153.2**, current
official documentation, and the **0.153.3** release notes. That hotfix lists
model catalog and async-question guidance changes, rather than a new plugin
contract. Runtime verification here uses 0.153.2; it is not a claim of a full
end-to-end run on 0.153.3.

## Findings and fixes

| Finding | Result |
| --- | --- |
| Plugin manifest and lockfile advertised 2026.8.0 while npm advertised 2026.9.0 | All release metadata now agrees on 2026.9.1; regression test prevents drift. |
| Any MCP server with a matching operation suffix could satisfy context/persistence | Require a Reqall namespace; preserve legacy bare names and connector/plugin prefixes. |
| Structured failures could be counted as success | Check structuredContent and JSON text envelopes; running shell handles do not qualify as completed success. |
| A prior write and list could satisfy Stop after later edits/tests | Require an outcome after the latest work and verification after the latest successful record write. |
| No equivalent to Claude's agreed-intent workflow | Add a small intend skill; reuse spec/arch, link outcomes and unresolved gaps, skip routine chores. |
| Compaction restored only a generic instruction | Restore saved contract and bounded intent IDs on SessionStart compact/resume without resetting evidence. |
| Newer Reqall kinds and inline relationships absent from skills | Use work/info/inline links only when the current host schema supports them; retain compatible fallback kinds. |
| Review skill omitted a context milestone | Search for the review scope before any record mutation. |

Intent tracking uses only successful structured spec/arch results. It retains
IDs and kinds, not record bodies or titles. Tracking a read is a hint that a
record may matter; the agent must still read its criteria and determine which
intent belongs to the task. New user tasks do not inherit old evidence or IDs.

## Current Codex capabilities and Claude comparison

The existing default hook path and synchronous handlers remain appropriate.
Codex offers MCP tool hooks, but those calls do not emit lifecycle callbacks
and require an already-connected server. Adopting them would bypass the
evidence contract rather than improve it. Async handlers can finish out of
order, so context, evidence capture, and final checks stay synchronous.

Compaction recovery belongs in SessionStart with source compact. PreCompact
and PostCompact cannot inject model context; blocking compaction would stop
work. Claude's ExitPlanMode-specific trigger is therefore not copied:
agreed intent is guided by the prompt contract and skill. Codex currently
skips prompt/agent handler types. [Official hook reference](https://learn.chatgpt.com/docs/hooks).

The registered Reqall app remains the interactive connection. Native HTTP
MCP OAuth and the optional bearer environment override remain supported;
no Claude credential-file helper is needed. The current host's Reqall schema
exposes six record kinds and separate upsert_link calls, even though the
Claude reference describes newer work/info/inline-link capabilities.
[Official MCP reference](https://learn.chatgpt.com/docs/extend/mcp).

Skills retain Codex SKILL.md plus agents/openai.yaml metadata. Existing
explicit-only policies remain unchanged. The new intend skill allows
implicit invocation and uses a schema-aware workflow. No Claude userConfig,
allowed-tools list, model pin, or plugin agent file is copied into Codex.
[Build plugins](https://learn.chatgpt.com/docs/build-plugins),
[build skills](https://learn.chatgpt.com/docs/build-skills).

## Verification

- `npm test`: 39 passing tests, including intent recovery/isolation,
  structured failures, unrelated MCP tools, persistence ordering, and package
  metadata/reference checks. Child-process tests run outside the restricted
  Codex sandbox because its process isolation caused the baseline to stall.
- Plugin manifest validation with the installed plugin-creator validator.
- All seven skills pass the installed skill-creator validator. Package
  dry-run includes the new skill and audit document; whitespace checks pass.
- Local CLI confirms plugin marketplace upgrade/add/list and current MCP
  authentication options. [Latest release notes](https://learn.chatgpt.com/docs/changelog).

## Release and remaining boundaries

These are source changes, not a publication or replacement of the installed
Reqall cache. Release through the existing Reqall marketplace, refresh its
snapshot, reinstall, review `/hooks`, and start a new thread to pick up the
updated skills and scripts. No marketplace configuration was edited.

An isolated live install/login/compaction evaluation on the target Codex
release remains a release check. The deterministic suite invokes real hook
processes with fixture events; it does not prove model compliance or live
OAuth behavior. Hosted tool paths can bypass hooks, and digest-only evidence
cannot prove that every meaningful outcome was represented accurately.
Model-driven evaluation cases should cover normal work, intent reuse,
compaction, tool failure, interruption/resume, and unavailable Reqall.
