import assert from 'node:assert/strict';
import { mkdtempSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';
import test from 'node:test';
import {
  GUARDRAIL,
  HELPER,
  HOOK,
  hookInput,
  parseJsonOutput,
  runNode,
  runNodeAsync,
} from './helpers.mjs';

function sandbox() {
  const cwd = mkdtempSync(join(tmpdir(), 'reqall-guardrail-project-'));
  const pluginData = mkdtempSync(join(tmpdir(), 'reqall-plugin-data-'));
  return { cwd, pluginData, env: { PLUGIN_DATA: pluginData } };
}

function begin(box, session = 'session-1', turn = 'turn-1') {
  return runNode(GUARDRAIL, [
    'begin', '--task', 'implement durable hooks', '--session', session, '--turn', turn,
  ], box);
}

function postReqall(box, operation, toolUseId, overrides = {}) {
  return runNode(HOOK, [], {
    ...box,
    input: hookInput('PostToolUse', {
      tool_name: `mcp__reqall__${operation}`,
      tool_use_id: toolUseId,
      tool_input: {},
      tool_response: { isError: false, content: [{ type: 'text', text: 'ok' }] },
      ...overrides,
    }),
  });
}

test('guardrail requires concrete context and persistence operations', () => {
  const box = sandbox();
  assert.equal(begin(box).status, 0);

  let result = runNode(GUARDRAIL, ['check', '--session', 'session-1', '--turn', 'turn-1'], box);
  assert.equal(result.status, 11);

  for (const [operation, id] of [
    ['upsert_project', 'call-project'],
    ['search', 'call-search'],
    ['list_records', 'call-open'],
  ]) {
    assert.equal(postReqall(box, operation, id).status, 0);
  }

  result = runNode(GUARDRAIL, ['check', '--session', 'session-1', '--turn', 'turn-1'], box);
  assert.equal(result.status, 12);

  assert.equal(postReqall(box, 'upsert_record', 'call-record').status, 0);
  assert.equal(postReqall(box, 'list_records', 'call-verify').status, 0);
  result = runNode(GUARDRAIL, ['check', '--session', 'session-1', '--turn', 'turn-1'], box);
  assert.equal(result.status, 0, result.stderr);
});

test('links and SLEEP maintenance do not replace the required work-item record', () => {
  for (const supplementalOperation of ['upsert_link', 'sleep_apply']) {
    const box = sandbox();
    assert.equal(begin(box).status, 0);
    for (const [operation, id] of [
      ['upsert_project', `${supplementalOperation}-project`],
      ['search', `${supplementalOperation}-search`],
      ['list_records', `${supplementalOperation}-open`],
      [supplementalOperation, `${supplementalOperation}-supplemental`],
      ['list_records', `${supplementalOperation}-verify`],
    ]) {
      assert.equal(postReqall(box, operation, id).status, 0);
    }

    let result = runNode(GUARDRAIL, ['check', '--session', 'session-1', '--turn', 'turn-1'], box);
    assert.equal(result.status, 12, `${supplementalOperation} incorrectly satisfied root persistence`);
    assert.match(result.stderr, /upsert_record/);

    assert.equal(postReqall(box, 'upsert_record', `${supplementalOperation}-record`).status, 0);
    assert.equal(postReqall(box, 'list_records', `${supplementalOperation}-record-verify`).status, 0);
    result = runNode(GUARDRAIL, ['check', '--session', 'session-1', '--turn', 'turn-1'], box);
    assert.equal(result.status, 0, result.stderr);
  }
});

test('free-form evidence cannot satisfy the guardrail', () => {
  const box = sandbox();
  assert.equal(begin(box).status, 0);
  const result = runNode(GUARDRAIL, [
    'mark-context', '--evidence', 'trust me, I searched Reqall',
    '--session', 'session-1', '--turn', 'turn-1',
  ], box);
  assert.equal(result.status, 14);
  assert.match(result.stderr, /concrete.*tool/i);
});

test('fabricated CLI tool ids remain diagnostic and never satisfy check', () => {
  const box = sandbox();
  assert.equal(begin(box).status, 0);
  for (const [command, operation, id] of [
    ['mark-context', 'upsert_project', 'fabricated-project'],
    ['mark-context', 'search', 'fabricated-search'],
    ['mark-context', 'list_records', 'fabricated-open'],
    ['mark-persist', 'upsert_record', 'fabricated-record'],
    ['mark-persist', 'list_records', 'fabricated-verify'],
  ]) {
    const result = runNode(GUARDRAIL, [
      command,
      '--tool', `mcp__reqall__${operation}`,
      '--tool-use-id', id,
      '--session', 'session-1',
      '--turn', 'turn-1',
    ], box);
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /diagnostic/i);
  }

  const status = runNode(GUARDRAIL, ['status', '--session', 'session-1', '--turn', 'turn-1'], box);
  const state = parseJsonOutput(status);
  assert.ok(state.evidence.every((entry) => entry.source === 'cli'));

  const check = runNode(GUARDRAIL, ['check', '--session', 'session-1', '--turn', 'turn-1'], box);
  assert.equal(check.status, 11);
  assert.match(check.stderr, /PostToolUse|trusted/i);
});

test('manual CLI compatibility resolves the current task when turn ids are unavailable', () => {
  const box = sandbox();
  const result = runNode(GUARDRAIL, ['begin', '--task', 'manual task without hook identity'], box);
  assert.equal(result.status, 0, result.stderr);

  const status = runNode(GUARDRAIL, ['status'], box);
  assert.equal(status.status, 0);
  const state = parseJsonOutput(status);
  assert.equal(state.version, 3);
  assert.match(state.task, /^task:[a-f0-9]+$/);
  assert.doesNotMatch(status.stdout, /manual task without hook identity/);

  const check = runNode(GUARDRAIL, ['check'], box);
  assert.equal(check.status, 11);
});

test('PLUGIN_DATA isolates state by session and turn without dirtying the project', () => {
  const box = sandbox();
  assert.equal(begin(box, 'session-a', 'turn-a').status, 0);
  assert.equal(begin(box, 'session-b', 'turn-b').status, 0);
  assert.equal(readdirSync(box.cwd).includes('.reqall'), false);

  for (const [operation, id] of [
    ['upsert_project', 'a-project'],
    ['search', 'a-search'],
    ['list_records', 'a-open'],
    ['upsert_record', 'a-record'],
    ['list_records', 'a-verify'],
  ]) {
    assert.equal(postReqall(box, operation, id, { session_id: 'session-a', turn_id: 'turn-a' }).status, 0);
  }

  assert.equal(runNode(GUARDRAIL, ['check', '--session', 'session-a', '--turn', 'turn-a'], box).status, 0);
  assert.equal(runNode(GUARDRAIL, ['check', '--session', 'session-b', '--turn', 'turn-b'], box).status, 11);
  assert.ok(readdirSync(box.pluginData, { recursive: true }).length > 0);
});

test('distinct tasks in the same session and turn retain isolated state', () => {
  const box = sandbox();
  let result = runNode(GUARDRAIL, [
    'begin', '--task', 'first task', '--session', 'shared-session', '--turn', 'shared-turn',
  ], box);
  assert.equal(result.status, 0);
  result = runNode(GUARDRAIL, [
    'begin', '--task', 'second task', '--session', 'shared-session', '--turn', 'shared-turn',
  ], box);
  assert.equal(result.status, 0);

  result = runNode(GUARDRAIL, ['status', '--all'], box);
  assert.equal(result.status, 0);
  const states = parseJsonOutput(result).filter((state) =>
    state.sessionId === 'shared-session' && state.turnId === 'shared-turn');
  assert.equal(states.length, 2);
  assert.notEqual(states[0].task, states[1].task);
});

test('concurrent PostToolUse updates retain every required operation', async () => {
  const box = sandbox();
  assert.equal(begin(box).status, 0);
  const contextOperations = [
    ['upsert_project', 'parallel-project'],
    ['search', 'parallel-search'],
    ['list_records', 'parallel-open'],
  ];

  const contextResults = await Promise.all(contextOperations.map(([operation, toolUseId]) =>
    runNodeAsync(HOOK, [], {
      ...box,
      input: hookInput('PostToolUse', {
        tool_name: `mcp__reqall__${operation}`,
        tool_use_id: toolUseId,
        tool_input: {},
        tool_response: { isError: false, content: [] },
      }),
    })));
  assert.deepEqual(contextResults.map((result) => result.status), [0, 0, 0]);
  assert.equal(runNode(GUARDRAIL, ['check', '--session', 'session-1', '--turn', 'turn-1'], box).status, 12);

  const persistResults = await Promise.all([
    postReqallAsync(box, 'upsert_record', 'parallel-record'),
    postReqallAsync(box, 'upsert_link', 'parallel-link'),
  ]);
  assert.deepEqual(persistResults.map((result) => result.status), [0, 0]);
  assert.equal(postReqall(box, 'list_records', 'parallel-verify').status, 0);
  assert.equal(runNode(GUARDRAIL, ['check', '--session', 'session-1', '--turn', 'turn-1'], box).status, 0);

  const status = runNode(GUARDRAIL, ['status', '--session', 'session-1', '--turn', 'turn-1'], box);
  const state = parseJsonOutput(status);
  const ids = state.evidence.map((entry) => entry.toolUseId);
  for (const id of ['parallel-project', 'parallel-search', 'parallel-open', 'parallel-record', 'parallel-link', 'parallel-verify']) {
    assert.ok(ids.includes(id), `missing concurrent evidence ${id}`);
  }
});

function postReqallAsync(box, operation, toolUseId) {
  return runNodeAsync(HOOK, [], {
    ...box,
    input: hookInput('PostToolUse', {
      tool_name: `mcp__reqall__${operation}`,
      tool_use_id: toolUseId,
      tool_input: {},
      tool_response: { isError: false, content: [] },
    }),
  });
}

test('freshness rejects complete but expired state', () => {
  const box = sandbox();
  box.env.REQALL_GUARDRAIL_MAX_AGE_MS = '5';
  assert.equal(begin(box).status, 0);
  for (const [operation, id] of [
    ['upsert_project', 'stale-project'],
    ['search', 'stale-search'],
    ['list_records', 'stale-open'],
    ['upsert_record', 'stale-record'],
    ['list_records', 'stale-verify'],
  ]) {
    assert.equal(postReqall(box, operation, id).status, 0);
  }
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 30);
  const result = runNode(GUARDRAIL, ['check', '--session', 'session-1', '--turn', 'turn-1'], box);
  assert.equal(result.status, 13);
  assert.match(result.stderr, /stale|expired/i);
});

test('state falls back to a safe repo-local directory when PLUGIN_DATA is absent', () => {
  const cwd = mkdtempSync(join(tmpdir(), 'reqall-fallback-project-'));
  const env = { PLUGIN_DATA: undefined };
  const result = runNode(GUARDRAIL, [
    'begin', '--task', 'fallback state', '--session', 'fallback-session', '--turn', 'fallback-turn',
  ], { cwd, env });
  assert.equal(result.status, 0, result.stderr);
  assert.ok(readdirSync(join(cwd, '.reqall', 'codex-guardrail'), { recursive: true }).length > 0);
});

test('project helper honors override and falls back to the machine project', () => {
  const cwd = mkdtempSync(join(tmpdir(), 'reqall-project-name-'));
  let result = runNode(HELPER, ['project'], { cwd, env: { REQALL_PROJECT_NAME: 'Example/Explicit' } });
  assert.equal(result.status, 0);
  assert.equal(result.stdout.trim(), 'Example/Explicit');

  // Non-repo cwd: machine project, never the directory basename.
  result = runNode(HELPER, ['project'], { cwd, env: { REQALL_PROJECT_NAME: undefined } });
  assert.equal(result.status, 0);
  assert.match(result.stdout.trim(), /^\.machine\/[^/]+\/[^/]+$/);
});
