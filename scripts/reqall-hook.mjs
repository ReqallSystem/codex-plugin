#!/usr/bin/env node

import { readFileSync } from 'node:fs';
import {
  CONTEXT_OPERATIONS,
  PERSIST_WRITE_OPERATIONS,
  appendGuardrailNote,
  beginGuardrail,
  evaluateGuardrail,
  isSuccessfulToolResponse,
  loadGuardrail,
  markGuardrailDegraded,
  markStopContinuation,
  recordToolEvidence,
  reqallOperation,
  setNonTrivial,
  valueDigest,
} from './lib/guardrail-state.mjs';
import { resolveProjectName } from './lib/project.mjs';

const CONTINUATION_MARKER = '[Reqall guardrail continuation]';

function readInput() {
  const raw = readFileSync(0, 'utf8').trim();
  if (!raw) throw new Error('Reqall hook expected a JSON object on stdin.');
  const input = JSON.parse(raw);
  if (!input || typeof input !== 'object' || typeof input.hook_event_name !== 'string') {
    throw new Error('Reqall hook input is missing hook_event_name.');
  }
  return input;
}

function output(value) {
  if (value !== null && value !== undefined) process.stdout.write(`${JSON.stringify(value)}\n`);
}

function hookContext(eventName, additionalContext) {
  return {
    hookSpecificOutput: {
      hookEventName: eventName,
      additionalContext,
    },
  };
}

function options(input, allowCurrent = true) {
  return {
    sessionId: input.session_id,
    turnId: input.turn_id,
    cwd: input.cwd || process.cwd(),
    env: process.env,
    allowCurrent,
  };
}

function isNonTrivialPrompt(prompt) {
  if (typeof prompt !== 'string') return false;
  const value = prompt.trim();
  if (!value || /^(hi|hello|hey|thanks|thank you|ok|okay)[!.?\s]*$/i.test(value)) return false;
  return /\b(implement|update|change|edit|fix|debug|bug|refactor|migrat|architect|design|create|add|remove|test|build|review|audit|inspect|assess|examine|research|analy[sz]e|investigate|diagnose|release|deploy|document)\w*\b/i.test(value);
}

function contextContract(state) {
  const evaluation = evaluateGuardrail(state);
  const status = evaluation.degraded
    ? `degraded (${evaluation.reason})`
    : evaluation.ok ? 'complete' : evaluation.reason;
  const contract = [
    'Reqall memory autopilot is active for this plugin.',
    `Project: ${state?.project || 'resolve from REQALL_PROJECT_NAME, git origin, or cwd'}.`,
    `Context status: ${status}.`,
    'Before any mutation on non-trivial work, call Reqall upsert_project, search, and list_records (status open).',
    'Use get_record, list_links, and impact when tracked behavior or relevant hits need detail.',
    'Successful Reqall tool-call IDs are captured automatically; free-form claims do not satisfy the guardrail.',
    'Before the root turn ends, persist each meaningful outcome with upsert_record; links and SLEEP changes are supplemental. Verify with list_records.',
    'Subagents may add notes, but the root agent owns final persistence.',
  ];
  if (evaluation.degraded) {
    contract.push('Reqall is unavailable in bounded degraded mode; continue the user task and disclose that context and persistence did not run.');
  }
  return contract.join(' ');
}

function sessionStart(input) {
  return hookContext('SessionStart', [
    'Reqall memory autopilot is installed.',
    'For non-trivial work, retrieve project context before mutation and persist outcomes before the root turn ends.',
    'Hook state is isolated under PLUGIN_DATA; review hook trust with /hooks after plugin changes.',
  ].join(' '));
}

function userPromptSubmit(input) {
  const prompt = typeof input.prompt === 'string' ? input.prompt : '';
  if (prompt.startsWith(CONTINUATION_MARKER)) {
    const current = loadGuardrail(options(input, true));
    return hookContext('UserPromptSubmit', contextContract(current));
  }
  const state = beginGuardrail({
    ...options(input, false),
    task: prompt,
    project: resolveProjectName(input.cwd || process.cwd()),
    nonTrivial: isNonTrivialPrompt(prompt),
  });
  return hookContext('UserPromptSubmit', contextContract(state));
}

function hasShellControlSyntax(command) {
  return /[\r\n;<>&`|]|\$\(|@\(/.test(command);
}

function isSafeGitInspection(command) {
  if (!/^git(?:\.exe)?(?:\s|$)/i.test(command)) return false;
  let rest = command.replace(/^git(?:\.exe)?\s*/i, '');
  if (/^--version\s*$/i.test(rest)) return true;

  while (rest) {
    const safeDirectory = rest.match(/^-c\s+safe\.directory=(?:"[^"]+"|'[^']+'|\S+)\s+/i);
    const workingDirectory = rest.match(/^-C\s+(?:"[^"]+"|'[^']+'|\S+)\s+/i);
    const noPager = rest.match(/^--no-pager\s+/i);
    const prefix = safeDirectory || workingDirectory || noPager;
    if (!prefix) break;
    rest = rest.slice(prefix[0].length);
  }

  if (/--(?:output|ext-diff|textconv|open-files-in-pager)(?:=|\s|$)/i.test(rest)) return false;
  const match = rest.match(/^([a-z-]+)(?:\s+(.*))?$/i);
  if (!match) return false;
  const subcommand = match[1].toLowerCase();
  const args = (match[2] || '').trim();
  if (new Set([
    'status',
    'diff',
    'log',
    'show',
    'rev-parse',
    'ls-files',
    'grep',
    'cat-file',
    'ls-tree',
    'describe',
    'name-rev',
    'shortlog',
    'blame',
  ]).has(subcommand)) return true;
  if (subcommand === 'branch') {
    return !args || /^(--show-current|--list|-a\b|--all\b|-r\b|--remotes\b|-v\b|--verbose\b)/i.test(args);
  }
  if (subcommand === 'remote') {
    return !args || /^(-v|--verbose|get-url\b|show\b)/i.test(args);
  }
  if (subcommand === 'tag') return !args || /^(--list|-l\b)/i.test(args);
  if (subcommand === 'worktree') return /^list(?:\s|$)/i.test(args);
  if (subcommand === 'submodule') return /^status(?:\s|$)/i.test(args);
  if (subcommand === 'config') {
    return /^(--get\b|--get-all\b|--get-regexp\b|--list\b|-l\b|--show-origin\b)/i.test(args);
  }
  return false;
}

function isSafeInspectionCommand(command) {
  if (/^(rg|ripgrep)(?:\.exe)?(?:\s|$)/i.test(command)) {
    return !/\s--(?:pre(?:-glob)?|hostname-bin)(?:=|\s|$)/i.test(command);
  }
  const nodeCheck = /^node(?:\.exe)?\s+--check\s+(?:"(?!-)[A-Za-z0-9_./\\:+ \-]+"|'(?!-)[A-Za-z0-9_./\\:+ \-]+'|(?!-)[A-Za-z0-9_./\\:+\-]+)\s*$/i;
  return [
    /^(Get-Content|Get-ChildItem|Select-String|Test-Path|Resolve-Path|Get-Item|Get-Location|Get-Command|Get-FileHash|Get-Acl)(?:\s|$)/i,
    /^(ls|dir|pwd|head|tail|wc|stat|file|which|where|type|more)(?:\.exe)?(?:\s|$)/i,
    nodeCheck,
    /^(node|npm|pnpm|yarn|python|python3|py|cargo|go|flutter|dart)(?:\.exe|\.cmd)?\s+--version\s*$/i,
  ].some((pattern) => pattern.test(command)) || isSafeGitInspection(command);
}

function isSafeReadOnlyShell(command) {
  if (typeof command !== 'string' || !command.trim()) return false;
  const trimmed = command.trim();
  if (hasShellControlSyntax(trimmed)) return false;
  return isSafeInspectionCommand(trimmed);
}

function isMutatingShell(command) {
  return !isSafeReadOnlyShell(command);
}

function isMutatingTool(input) {
  const toolName = String(input.tool_name || '');
  const normalizedToolName = toolName.toLowerCase();
  const operation = reqallOperation(toolName);
  if (operation) {
    return PERSIST_WRITE_OPERATIONS.includes(operation)
      || [
        'delete_record',
        'delete_link',
        'delete_project',
        'share_project',
        'revoke_share',
        'sleep_candidates',
      ].includes(operation);
  }
  const safeHostTools = new Set([
    'get_goal',
    'view_image',
    'list_mcp_resources',
    'list_mcp_resource_templates',
    'read_mcp_resource',
    'list_agents',
    'wait_agent',
    'collaboration.list_agents',
    'collaboration.wait_agent',
    // Code-mode source is inert; Codex hooks every nested tool call separately.
    'functions.exec',
  ]);
  if (safeHostTools.has(normalizedToolName)) return false;
  if (/^(apply_patch|Edit|Write)$/i.test(toolName)) return true;
  if (/^(Bash|shell_command|exec_command)$/i.test(toolName)) {
    return isMutatingShell(input.tool_input?.command);
  }
  return true;
}

function preToolUse(input) {
  if (!isMutatingTool(input)) return null;
  let state = loadGuardrail(options(input, true));
  if (!state) {
    state = beginGuardrail({
      ...options(input, false),
      task: 'mutation observed before UserPromptSubmit state',
      project: resolveProjectName(input.cwd || process.cwd()),
      nonTrivial: true,
    });
  } else if (!state.nonTrivial) {
    state = setNonTrivial(options(input, true));
  }
  const evaluation = evaluateGuardrail(state);
  if (evaluation.degraded) {
    return hookContext(
      'PreToolUse',
      'Reqall is unavailable in bounded degraded mode. Continue the user task, but disclose that Reqall context and persistence did not run.',
    );
  }
  if (evaluation.ok || evaluation.code === 12) return null;
  return {
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: 'deny',
      permissionDecisionReason: `Reqall context is required before mutation: ${evaluation.reason}. Call upsert_project, search, and list_records, then retry.`,
    },
  };
}

function phaseForOperation(operation) {
  if (['upsert_project', 'search', 'list_records', 'get_record', 'list_links', 'impact'].includes(operation)) return 'context';
  if (['upsert_record', 'upsert_link', 'sleep_apply'].includes(operation)) return 'persist';
  return 'document';
}

function looksLikeTestCommand(command) {
  return typeof command === 'string' && /\b(test|pytest|vitest|jest|mocha|cargo\s+test|flutter\s+test|go\s+test)\b/i.test(command);
}

function classifyReqallOutage(response) {
  let serialized;
  try {
    serialized = typeof response === 'string' ? response : JSON.stringify(response);
  } catch {
    return '';
  }
  if (typeof serialized !== 'string') return '';

  if (
    /"(?:status|statusCode|httpStatus)"\s*:\s*(?:401|403)\b/i.test(serialized)
    || /\b(?:unauthorized|authentication (?:required|failed)|reauthentication required|invalid token|token expired|login required)\b/i.test(serialized)
  ) return 'auth';
  if (
    /\b(?:ECONNREFUSED|ECONNRESET|ENOTFOUND|ETIMEDOUT|EAI_AGAIN)\b/i.test(serialized)
    || /\b(?:network error|fetch failed|connection refused|dns failure|socket hang up|offline)\b/i.test(serialized)
  ) return 'network';
  if (
    /"(?:status|statusCode|httpStatus)"\s*:\s*(?:502|503|504)\b/i.test(serialized)
    || /\b(?:service unavailable|temporarily unavailable|bad gateway|gateway timeout)\b/i.test(serialized)
  ) return 'service';
  return '';
}

function postToolUse(input) {
  const state = loadGuardrail(options(input, true));
  if (!state) return null;
  const operation = reqallOperation(input.tool_name);
  const success = isSuccessfulToolResponse(input.tool_response);
  if (operation) {
    recordToolEvidence(options(input, true), {
      phase: phaseForOperation(operation),
      operation,
      toolName: input.tool_name,
      toolUseId: input.tool_use_id,
      success,
      source: 'PostToolUse',
      inputDigest: valueDigest(input.tool_input),
      resultDigest: valueDigest(input.tool_response),
    });
    if (!success && CONTEXT_OPERATIONS.includes(operation)) {
      const outage = classifyReqallOutage(input.tool_response);
      if (outage) {
        markGuardrailDegraded(options(input, true), {
          code: outage,
          operation,
          toolUseId: input.tool_use_id,
        });
        return hookContext(
          'PostToolUse',
          `Reqall entered bounded degraded mode because the ${outage} path is unavailable. Continue the user task and disclose that Reqall context and persistence did not run.`,
        );
      }
    }
    return null;
  }

  const mutation = isMutatingTool(input);
  const test = /^(Bash|shell_command|exec_command)$/i.test(String(input.tool_name || ''))
    && looksLikeTestCommand(input.tool_input?.command);
  if (mutation || test) {
    if (mutation && !state.nonTrivial) setNonTrivial(options(input, true));
    recordToolEvidence(options(input, true), {
      phase: test ? 'test' : 'document',
      operation: test ? 'test' : 'mutation',
      toolName: input.tool_name,
      toolUseId: input.tool_use_id,
      success,
      source: 'PostToolUse',
      inputDigest: valueDigest(input.tool_input),
      resultDigest: valueDigest(input.tool_response),
    });
  }
  return null;
}

function subagentStart(input) {
  const state = loadGuardrail(options(input, true));
  if (state) {
    appendGuardrailNote(options(input, true), {
      kind: 'subagent-start',
      sourceId: input.agent_id,
      message: `Subagent ${input.agent_type || 'worker'} started; root retains persistence ownership.`,
    });
  }
  const evaluation = evaluateGuardrail(state);
  const contextStatus = evaluation.degraded
    ? 'unavailable in bounded degraded mode'
    : evaluation.code === 12 || evaluation.ok ? 'complete' : 'incomplete';
  return hookContext(
    'SubagentStart',
    `Reqall context is ${contextStatus}. Use the parent task's project context, report concrete findings to the root, and do not claim final persistence; the root agent owns it.`,
  );
}

function subagentStop(input) {
  const state = loadGuardrail(options(input, true));
  if (state) {
    appendGuardrailNote(options(input, true), {
      kind: 'subagent-stop',
      sourceId: input.agent_id,
      message: `Subagent ${input.agent_type || 'worker'} stopped; root should review its result.`,
      digest: valueDigest(input.last_assistant_message || ''),
    });
  }
  return { continue: true };
}

function stop(input) {
  let state = loadGuardrail(options(input, true));
  let evaluation = evaluateGuardrail(state);
  if (evaluation.degraded) {
    return {
      continue: true,
      systemMessage: `Reqall degraded mode: ${evaluation.reason}. The final response must disclose that Reqall context and persistence did not run.`,
    };
  }
  if (evaluation.ok || evaluation.code === 10) return { continue: true };

  const active = input.stop_hook_active === true;
  if (evaluation.code === 13 && !active) {
    state = beginGuardrail({
      ...options(input, false),
      task: state.task,
      project: state.project,
      nonTrivial: state.nonTrivial,
    });
    evaluation = evaluateGuardrail(state);
  }
  const continuation = markStopContinuation(options(input, true));
  if (active || !continuation.newlyIssued) {
    return {
      continue: true,
      systemMessage: `Reqall guardrail did not continue again to prevent a loop; this turn was not persisted completely (${evaluation.reason}).`,
    };
  }

  const action = evaluation.code === 11
    ? 'The root must complete Reqall context with upsert_project, search, and list_records before finishing.'
    : evaluation.code === 13
      ? 'The root must begin a fresh Reqall task, reload context, and persist its outcome before finishing.'
      : 'The root must persist each meaningful outcome with upsert_record, add links when useful, then verify with list_records before finishing.';
  return {
    decision: 'block',
    reason: `${CONTINUATION_MARKER} ${action} Current guardrail status: ${evaluation.reason}.`,
  };
}

function dispatch(input) {
  switch (input.hook_event_name) {
    case 'SessionStart': return sessionStart(input);
    case 'UserPromptSubmit': return userPromptSubmit(input);
    case 'PreToolUse': return preToolUse(input);
    case 'PostToolUse': return postToolUse(input);
    case 'SubagentStart': return subagentStart(input);
    case 'SubagentStop': return subagentStop(input);
    case 'Stop': return stop(input);
    default: return null;
  }
}

try {
  output(dispatch(readInput()));
} catch (error) {
  console.error(`[reqall-hook] ${error.message}`);
  process.exit(1);
}
