import assert from 'node:assert/strict';
import test from 'node:test';
import {
  evaluateGuardrail, isSuccessfulToolResponse, reqallOperation, responseRecord,
} from '../scripts/lib/guardrail-state.mjs';

function evidence(operation, extra = {}) {
  return { operation, phase: 'persist', success: true, source: 'PostToolUse', ...extra };
}

function state(...entries) {
  return {
    startedAt: new Date().toISOString(), nonTrivial: true,
    evidence: ['upsert_project', 'search', 'list_records'].map((operation) => evidence(operation)).concat(entries),
  };
}

test('Reqall evidence accepts host names but rejects unrelated servers', () => {
  for (const name of ['mcp__reqall__search', 'mcp__plugin_reqall_reqall__search',
    'mcp__codex_apps__reqall_search', 'reqall:search', 'reqall/search', 'search']) {
    assert.equal(reqallOperation(name), 'search', name);
  }
  for (const name of ['mcp__github__search', 'mcp__other__upsert_record',
    'mcp__notreqall__list_records', 'mcp__reqallish__search']) {
    assert.equal(reqallOperation(name), '', name);
  }
});

test('structured MCP failures and running commands cannot count as success', () => {
  const failures = [
    { isError: true }, { structuredContent: { ok: false, error: 'denied' } },
    { content: [{ type: 'text', text: '{"ok":false,"error":"bad request"}' }] },
    { exit_code: 2 }, { session_id: 123, exit_code: null },
  ];
  for (const result of failures) {
    assert.equal(isSuccessfulToolResponse(result), false);
    assert.equal(isSuccessfulToolResponse(JSON.stringify(result)), false);
  }
  assert.equal(isSuccessfulToolResponse({ structuredContent: { ok: true, data: { records: [] } } }), true);
  assert.equal(isSuccessfulToolResponse({ exit_code: 0, output: '0 failures' }), true);
});

test('record extraction supports connector and text-serialized MCP envelopes', () => {
  const record = { id: 42, kind: 'spec', status: 'open' };
  const result = { ok: true, data: { record } };
  assert.deepEqual(responseRecord({ structuredContent: result }), record);
  assert.deepEqual(responseRecord({ content: [{ type: 'text', text: JSON.stringify(result) }] }), record);
  assert.deepEqual(responseRecord(JSON.stringify({ structuredContent: result })), record);
  assert.equal(responseRecord({ isError: true, structuredContent: result }), null);
  assert.equal(responseRecord({ content: [{ type: 'text', text: 'Created spec #42' }] }), null);
});

test('final persistence must follow all observed work and verify the latest record write', () => {
  const write = evidence('upsert_record');
  const verify = evidence('list_records');
  assert.equal(evaluateGuardrail(state(write, verify)).ok, true);
  for (const operation of ['mutation', 'test']) {
    for (const success of [true, false]) {
      const work = evidence(operation, { success });
      assert.equal(evaluateGuardrail(state(write, verify, work)).code, 12);
      assert.equal(evaluateGuardrail(state(write, verify, work, write, verify)).ok, true);
    }
  }
  assert.equal(evaluateGuardrail(state(write, verify, write)).code, 12);
  assert.equal(evaluateGuardrail(state(write, verify, write, verify)).ok, true);
  assert.equal(evaluateGuardrail(state(evidence('upsert_record', { phase: 'intent' }), verify)).code, 12);
  assert.equal(evaluateGuardrail(state(write, verify, evidence('mutation', { source: 'manual' }))).ok, true);
});
