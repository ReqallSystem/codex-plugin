import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { GUARDRAIL, HOOK, hookInput, parseJsonOutput, runNode } from './helpers.mjs';

function sandbox() {
  return {
    cwd: mkdtempSync(join(tmpdir(), 'reqall-hook-project-')),
    env: { PLUGIN_DATA: mkdtempSync(join(tmpdir(), 'reqall-hook-data-')) },
  };
}

function invoke(box, eventName, overrides = {}) {
  return runNode(HOOK, [], { ...box, input: hookInput(eventName, overrides) });
}

function begin(box, prompt = 'Implement the authentication refactor') {
  const result = invoke(box, 'UserPromptSubmit', { prompt });
  assert.equal(result.status, 0, result.stderr);
  return parseJsonOutput(result);
}

function record(box, operation, id, response = { isError: false, content: [] }) {
  return invoke(box, 'PostToolUse', {
    tool_name: `mcp__reqall__${operation}`,
    tool_use_id: id,
    tool_input: {},
    tool_response: response,
  });
}

test('SessionStart and UserPromptSubmit inject a concise context contract', () => {
  const box = sandbox();
  let result = invoke(box, 'SessionStart', { source: 'startup', turn_id: undefined });
  assert.equal(result.status, 0, result.stderr);
  let output = parseJsonOutput(result);
  assert.equal(output.hookSpecificOutput.hookEventName, 'SessionStart');
  assert.match(output.hookSpecificOutput.additionalContext, /Reqall/i);

  output = begin(box);
  assert.equal(output.hookSpecificOutput.hookEventName, 'UserPromptSubmit');
  assert.match(output.hookSpecificOutput.additionalContext, /upsert_project/);
  assert.match(output.hookSpecificOutput.additionalContext, /search/);
  assert.match(output.hookSpecificOutput.additionalContext, /list_records/);
});

test('PreToolUse blocks mutations until concrete context exists but permits reads', () => {
  const box = sandbox();
  begin(box);

  let result = invoke(box, 'PreToolUse', {
    tool_name: 'Bash',
    tool_use_id: 'read-1',
    tool_input: { command: 'rg --files' },
  });
  assert.equal(result.status, 0);
  assert.equal(result.stdout.trim(), '');

  for (const operation of [
    'upsert_record',
    'upsert_link',
    'delete_record',
    'delete_link',
    'delete_project',
    'share_project',
    'revoke_share',
    'sleep_candidates',
    'sleep_apply',
  ]) {
    result = invoke(box, 'PreToolUse', {
      tool_name: `mcp__reqall__${operation}`,
      tool_use_id: `early-${operation}`,
      tool_input: {},
    });
    const blocked = parseJsonOutput(result);
    assert.equal(blocked.hookSpecificOutput.permissionDecision, 'deny', `${operation} bypassed context gating`);
  }

  result = invoke(box, 'PreToolUse', {
    tool_name: 'mcp__reqall__list_shares',
    tool_use_id: 'read-shares',
    tool_input: {},
  });
  assert.equal(result.stdout.trim(), '');

  result = invoke(box, 'PreToolUse', {
    tool_name: 'apply_patch',
    tool_use_id: 'edit-1',
    tool_input: { command: '*** Begin Patch' },
  });
  let output = parseJsonOutput(result);
  assert.equal(output.hookSpecificOutput.permissionDecision, 'deny');
  assert.match(output.hookSpecificOutput.permissionDecisionReason, /context/i);

  for (const [operation, id] of [
    ['upsert_project', 'context-project'],
    ['search', 'context-search'],
    ['list_records', 'context-open'],
  ]) {
    assert.equal(record(box, operation, id).status, 0);
  }

  result = invoke(box, 'PreToolUse', {
    tool_name: 'apply_patch',
    tool_use_id: 'edit-2',
    tool_input: { command: '*** Begin Patch' },
  });
  assert.equal(result.status, 0);
  assert.equal(result.stdout.trim(), '');
});

test('PreToolUse recognizes formatter and code-generation writes', () => {
  const box = sandbox();
  begin(box);
  for (const command of [
    'npx prettier --write src',
    'black src',
    'ruff check --fix src',
    'dart format lib',
    'npm run generate',
    'prisma generate',
    'protoc --js_out=generated schema.proto',
  ]) {
    const result = invoke(box, 'PreToolUse', {
      tool_name: 'Bash',
      tool_use_id: `format-${command}`,
      tool_input: { command },
    });
    const output = parseJsonOutput(result);
    assert.equal(output.hookSpecificOutput.permissionDecision, 'deny', `${command} bypassed context gating`);
  }
});

test('PreToolUse defaults unknown Bash to deny and closes common write bypasses', () => {
  const box = sandbox();
  begin(box);
  for (const command of [
    'git apply change.patch',
    'tee generated.txt',
    'patch -p0 < change.patch',
    'Clear-Content src/config.js',
    'Get-Process | Export-Csv processes.csv',
    'Get-Content README.md & Clear-Content README.md',
    'rg --pre node secret-pattern',
    'node -e "require(\'fs\').writeFileSync(\'owned.txt\', \'x\')"',
    'node --check --require ./evil.cjs scripts/reqall-hook.mjs',
    'node --check --import ./evil.mjs scripts/reqall-hook.mjs',
    'node --check $env:NODE_CHECK_TARGET',
    'node --check "$env:NODE_CHECK_TARGET"',
    'node --check %NODE_CHECK_TARGET%',
    'node --check scripts/*.mjs',
    'python -c "from pathlib import Path; Path(\'owned.txt\').write_text(\'x\')"',
    'node scripts/generate.mjs',
    'npm test',
    'python -m pytest',
    'cargo test',
    'custom-project-script --quiet',
  ]) {
    const result = invoke(box, 'PreToolUse', {
      tool_name: 'Bash',
      tool_use_id: `bypass-${command}`,
      tool_input: { command },
    });
    const output = parseJsonOutput(result);
    assert.equal(output.hookSpecificOutput.permissionDecision, 'deny', `${command} bypassed default-deny`);
  }
});

test('PreToolUse preserves only a narrow set of non-executing inspection commands', () => {
  const box = sandbox();
  begin(box);
  for (const command of [
    'rg --files',
    'git status --short --branch',
    'git -c safe.directory=C:/workspace status --short',
    'Get-Content -Raw README.md',
    'Get-ChildItem -Force',
    'git diff --check',
    'node --check scripts/reqall-hook.mjs',
    'node --check "scripts/my hook.mjs"',
  ]) {
    const result = invoke(box, 'PreToolUse', {
      tool_name: 'Bash',
      tool_use_id: `safe-${command}`,
      tool_input: { command },
    });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout.trim(), '', `${command} was unexpectedly denied`);
  }
});

test('PreToolUse supports current exec_command names and cmd input', () => {
  const box = sandbox();
  begin(box);

  for (const toolName of ['exec_command', 'functions.exec_command']) {
    let result = invoke(box, 'PreToolUse', {
      tool_name: toolName,
      tool_use_id: `safe-${toolName}`,
      tool_input: { cmd: 'git status --short --branch' },
    });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout.trim(), '', `${toolName} did not accept a safe cmd read`);

    result = invoke(box, 'PreToolUse', {
      tool_name: toolName,
      tool_use_id: `write-${toolName}`,
      tool_input: { cmd: 'npm run generate' },
    });
    assert.equal(parseJsonOutput(result).hookSpecificOutput.permissionDecision, 'deny');
  }
});

test('PostToolUse captures tests executed through current exec_command shape', () => {
  const box = sandbox();
  begin(box);
  for (const [operation, id] of [
    ['upsert_project', 'exec-project'],
    ['search', 'exec-search'],
    ['list_records', 'exec-list'],
  ]) {
    assert.equal(record(box, operation, id).status, 0);
  }

  const result = invoke(box, 'PostToolUse', {
    tool_name: 'functions.exec_command',
    tool_use_id: 'exec-test',
    tool_input: { cmd: 'npm test' },
    tool_response: { exit_code: 0, output: 'ok' },
  });
  assert.equal(result.status, 0, result.stderr);

  const status = runNode(GUARDRAIL, ['status', '--session', 'session-1', '--turn', 'turn-1'], box);
  const state = parseJsonOutput(status);
  assert.ok(state.evidence.some((entry) =>
    entry.toolUseId === 'exec-test' && entry.phase === 'test' && entry.success === true));
});

test('PreToolUse defaults unknown local and MCP tools to mutating', () => {
  const box = sandbox();
  begin(box);
  for (const toolName of [
    'mcp__mail__send_message',
    'mcp__billing__refund_payment',
    'run_workflow',
    'archive_conversation',
    'update_plan',
    'create_goal',
    'update_goal',
    'request_user_input',
    'spawn_agent',
    'followup_task',
    'send_message',
    'interrupt_agent',
    'collaboration.spawn_agent',
    'collaboration.send_message',
  ]) {
    const result = invoke(box, 'PreToolUse', {
      tool_name: toolName,
      tool_use_id: `unknown-${toolName}`,
      tool_input: {},
    });
    const output = parseJsonOutput(result);
    assert.equal(output.hookSpecificOutput.permissionDecision, 'deny', `${toolName} bypassed default-deny`);
  }

  for (const toolName of [
    'view_image',
    'get_goal',
    'list_agents',
    'wait_agent',
    'list_mcp_resources',
    'list_mcp_resource_templates',
    'read_mcp_resource',
    'functions.exec',
  ]) {
    const result = invoke(box, 'PreToolUse', {
      tool_name: toolName,
      tool_use_id: `safe-host-${toolName}`,
      tool_input: {},
    });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout.trim(), '', `${toolName} was unexpectedly denied`);
  }
});

test('failed Reqall calls do not count as evidence', () => {
  const box = sandbox();
  begin(box);
  assert.equal(record(box, 'upsert_project', 'failed-project', { isError: true, content: [] }).status, 0);
  assert.equal(record(box, 'search', 'failed-search', {
    isError: true,
    error: { code: 'INVALID_ARGUMENT', message: 'query is required' },
  }).status, 0);
  assert.equal(record(box, 'list_records', 'failed-list', null).status, 0);

  const result = invoke(box, 'PreToolUse', {
    tool_name: 'apply_patch',
    tool_use_id: 'edit-failed-context',
    tool_input: { command: '*** Begin Patch' },
  });
  assert.equal(parseJsonOutput(result).hookSpecificOutput.permissionDecision, 'deny');
});

test('concrete Reqall auth, network, and service outages enter bounded degraded mode', () => {
  const failures = [
    ['auth', { isError: true, status: 401, error: 'Unauthorized token secret-auth-value expired' }],
    ['network', { isError: true, error: { code: 'ECONNREFUSED', message: 'connection refused secret-network-value' } }],
    ['service', { isError: true, statusCode: 503, error: 'Service unavailable secret-service-value' }],
  ];

  for (const [expectedCode, response] of failures) {
    const box = sandbox();
    begin(box);
    let result = record(box, 'upsert_project', `${expectedCode}-outage`, response);
    assert.equal(result.status, 0, result.stderr);
    let output = parseJsonOutput(result);
    assert.match(output.hookSpecificOutput.additionalContext, /degraded mode/i);
    assert.match(output.hookSpecificOutput.additionalContext, /disclose/i);

    result = invoke(box, 'PreToolUse', {
      tool_name: 'apply_patch',
      tool_use_id: `${expectedCode}-edit`,
      tool_input: { command: '*** Begin Patch' },
    });
    output = parseJsonOutput(result);
    assert.equal(output.hookSpecificOutput.permissionDecision, undefined);
    assert.match(output.hookSpecificOutput.additionalContext, /Reqall.*unavailable/i);

    result = invoke(box, 'Stop', {
      stop_hook_active: false,
      last_assistant_message: 'Completed work without Reqall.',
    });
    output = parseJsonOutput(result);
    assert.equal(output.continue, true);
    assert.equal(output.decision, undefined);
    assert.match(output.systemMessage, /degraded mode/i);
    assert.match(output.systemMessage, /did not run|unavailable/i);

    result = runNode(GUARDRAIL, ['status', '--session', 'session-1', '--turn', 'turn-1'], box);
    const state = parseJsonOutput(result);
    assert.equal(state.degraded.code, expectedCode);
    assert.equal(state.degraded.source, 'PostToolUse');
    assert.doesNotMatch(result.stdout, /secret-(auth|network|service)-value/);

    result = runNode(GUARDRAIL, ['check', '--session', 'session-1', '--turn', 'turn-1'], box);
    assert.equal(result.status, 0);
    assert.match(result.stdout, /degraded mode/i);
    assert.doesNotMatch(result.stdout, /check passed/i);
  }
});

test('PostToolUse captures mutation and test evidence without storing raw commands', () => {
  const box = sandbox();
  const promptSecret = 'prompt-secret-9d7c';
  begin(box, `Implement the evidence model with ${promptSecret}`);
  for (const [operation, id] of [
    ['upsert_project', 'evidence-project'],
    ['search', 'evidence-search'],
    ['list_records', 'evidence-open'],
  ]) record(box, operation, id);

  const secretCommand = 'npm test -- --token super-secret-value';
  const secretOutput = 'tool-output-secret-2ab1';
  const result = invoke(box, 'PostToolUse', {
    tool_name: 'Bash',
    tool_use_id: 'test-call',
    tool_input: { command: secretCommand },
    tool_response: { exit_code: 0, output: secretOutput },
  });
  assert.equal(result.status, 0);

  const status = runNode(GUARDRAIL, ['status', '--session', 'session-1', '--turn', 'turn-1'], box);
  assert.equal(status.status, 0);
  assert.doesNotMatch(status.stdout, new RegExp(promptSecret));
  assert.doesNotMatch(status.stdout, /super-secret-value/);
  assert.doesNotMatch(status.stdout, new RegExp(secretOutput));
});

test('PostToolUse recognizes tests run by current shell tool names', () => {
  const box = sandbox();
  begin(box);
  for (const [toolName, id] of [
    ['shell_command', 'shell-command-test'],
    ['exec_command', 'exec-command-test'],
  ]) {
    const result = invoke(box, 'PostToolUse', {
      tool_name: toolName,
      tool_use_id: id,
      tool_input: { command: 'npm test' },
      tool_response: { exit_code: 0, output: 'ok' },
    });
    assert.equal(result.status, 0, result.stderr);
  }

  const status = runNode(GUARDRAIL, ['status', '--session', 'session-1', '--turn', 'turn-1'], box);
  const state = parseJsonOutput(status);
  for (const id of ['shell-command-test', 'exec-command-test']) {
    assert.ok(state.evidence.some((entry) =>
      entry.toolUseId === id && entry.operation === 'test' && entry.phase === 'test'));
  }
});

test('Subagent hooks share context and leave final persistence to the root', () => {
  const box = sandbox();
  begin(box);
  for (const [operation, id] of [
    ['upsert_project', 'sub-project'],
    ['search', 'sub-search'],
    ['list_records', 'sub-open'],
  ]) record(box, operation, id);

  let result = invoke(box, 'SubagentStart', { agent_id: 'agent-1', agent_type: 'worker' });
  let output = parseJsonOutput(result);
  assert.match(output.hookSpecificOutput.additionalContext, /root.*persistence/i);
  assert.match(output.hookSpecificOutput.additionalContext, /context.*complete/i);

  result = invoke(box, 'SubagentStop', {
    agent_id: 'agent-1',
    agent_type: 'worker',
    agent_transcript_path: null,
    stop_hook_active: false,
    last_assistant_message: 'Implemented the assigned parser tests.',
  });
  output = parseJsonOutput(result);
  assert.equal(output.continue, true);

  result = invoke(box, 'Stop', { stop_hook_active: false, last_assistant_message: 'Done.' });
  output = parseJsonOutput(result);
  assert.equal(output.decision, 'block');
  assert.match(output.reason, /root.*persist/i);
});

test('Stop enforces persistence once and prevents continuation loops', () => {
  const box = sandbox();
  begin(box);
  for (const [operation, id] of [
    ['upsert_project', 'stop-project'],
    ['search', 'stop-search'],
    ['list_records', 'stop-open'],
  ]) record(box, operation, id);

  let result = invoke(box, 'Stop', { stop_hook_active: false, last_assistant_message: 'Done.' });
  let output = parseJsonOutput(result);
  assert.equal(output.decision, 'block');
  assert.match(output.reason, /\[Reqall guardrail continuation\]/);

  result = invoke(box, 'Stop', { stop_hook_active: true, last_assistant_message: 'Still done.' });
  output = parseJsonOutput(result);
  assert.equal(output.continue, true);
  assert.match(output.systemMessage, /not persisted/i);

  assert.equal(record(box, 'upsert_record', 'stop-record').status, 0);
  assert.equal(record(box, 'list_records', 'stop-verify').status, 0);
  result = invoke(box, 'Stop', { stop_hook_active: false, last_assistant_message: 'Persisted.' });
  output = parseJsonOutput(result);
  assert.equal(output.continue, true);
  assert.equal(output.decision, undefined);
});

test('a mutation upgrades an initially trivial prompt and gates it', () => {
  const box = sandbox();
  begin(box, 'hello');
  const result = invoke(box, 'PreToolUse', {
    tool_name: 'apply_patch',
    tool_use_id: 'surprise-edit',
    tool_input: { command: '*** Begin Patch' },
  });
  assert.equal(parseJsonOutput(result).hookSpecificOutput.permissionDecision, 'deny');
});

test('delayed PostToolUse evidence cannot cross turn boundaries', () => {
  const box = sandbox();
  let result = invoke(box, 'UserPromptSubmit', {
    turn_id: 'turn-a',
    prompt: 'Implement task A',
  });
  assert.equal(result.status, 0, result.stderr);
  result = invoke(box, 'UserPromptSubmit', {
    turn_id: 'turn-b',
    prompt: 'Implement task B',
  });
  assert.equal(result.status, 0, result.stderr);

  for (const [operation, id] of [
    ['upsert_project', 'delayed-a-project'],
    ['search', 'delayed-a-search'],
    ['list_records', 'delayed-a-open'],
  ]) {
    result = invoke(box, 'PostToolUse', {
      turn_id: 'turn-a',
      tool_name: `mcp__reqall__${operation}`,
      tool_use_id: id,
      tool_input: {},
      tool_response: { isError: false, content: [] },
    });
    assert.equal(result.status, 0, result.stderr);
  }

  result = runNode(GUARDRAIL, [
    'status', '--session', 'session-1', '--turn', 'turn-b',
  ], box);
  const turnB = parseJsonOutput(result);
  assert.equal(turnB.turnId, 'turn-b');
  assert.equal(turnB.evidence.some((entry) => entry.toolUseId.startsWith('delayed-a-')), false);

  result = invoke(box, 'PreToolUse', {
    turn_id: 'turn-b',
    tool_name: 'apply_patch',
    tool_use_id: 'turn-b-edit',
    tool_input: { command: '*** Begin Patch' },
  });
  assert.equal(parseJsonOutput(result).hookSpecificOutput.permissionDecision, 'deny');
});
