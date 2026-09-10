import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { promptProject, resolveProjectName } from '../scripts/lib/project.mjs';
import { loadGuardrail } from '../scripts/lib/guardrail-state.mjs';
import { HOOK, ROOT, hookInput, runNode, parseJsonOutput } from './helpers.mjs';
test('labelled project fallback has deterministic precedence and rejects prose, paths, conflicts', t => {
  const cwd = mkdtempSync(join(tmpdir(), 'reqall-project-')); t.after(() => rmSync(cwd, { recursive: true, force: true }));
  assert.equal(resolveProjectName(cwd, {}, 'please project_name=org/repo'), 'org/repo');
  assert.equal(resolveProjectName(cwd, { REQALL_PROJECT_NAME: 'env/project' }, 'project_name=org/repo'), 'env/project');
  assert.equal(resolveProjectName(ROOT, {}, 'project_name=org/other'), 'ReqallSystem/codex-plugin');
  for (const text of ['src/auth.py', 'please org/repo', 'https://example.com/org/repo', 'project_name=org/repo/path', 'project_name=a/b project_name=c/d']) assert.equal(promptProject(text), '');
});
test('blocked calls and failed atomic edits stay clean; executed nonzero commands still invalidate', t => {
  const cwd = mkdtempSync(join(tmpdir(), 'reqall-activity-')); t.after(() => rmSync(cwd, { recursive: true, force: true }));
  const env = { PLUGIN_DATA: cwd, REQALL_API_KEY: undefined };
  const invoke = (event, extra) => runNode(HOOK, [], { cwd, env, input: hookInput(event, { cwd, ...extra }) });
  const options = { cwd, env, sessionId: 'session-1', turnId: 'turn-1', allowCurrent: true };
  invoke('UserPromptSubmit', { prompt: 'hello' });
  const denied = parseJsonOutput(invoke('PreToolUse', { tool_name: 'apply_patch', tool_use_id: 'blocked', tool_input: {} }));
  assert.equal(denied.hookSpecificOutput.permissionDecision, 'deny');
  assert.equal(loadGuardrail(options).nonTrivial, false);
  for (const [tool_name, tool_input, tool_response] of [
    ['apply_patch', {}, { isError: true }],
    ['exec_command', { cmd: 'touch x' }, { status: 'blocked', exit_code: 1 }],
    ['exec_command', { cmd: 'cat x' }, { exit_code: 1 }],
    ['exec_command', { cmd: 'rg test' }, { exit_code: 0 }],
  ]) invoke('PostToolUse', { tool_name, tool_input, tool_response, tool_use_id: JSON.stringify(tool_input) });
  assert.equal(loadGuardrail(options).verification.revision, 0);
  invoke('PostToolUse', { tool_name: 'exec_command', tool_input: { cmd: 'touch x; exit 1' }, tool_response: { exit_code: 1 }, tool_use_id: 'partial' });
  assert.equal(loadGuardrail(options).verification.revision, 1);
  assert.equal(loadGuardrail(options).nonTrivial, true);
});

test('partial-save IDs survive later turns and project switches without inheriting context evidence', t => {
  const cwd = mkdtempSync(join(tmpdir(), 'reqall-pending-')); t.after(() => rmSync(cwd, { recursive: true, force: true }));
  const env = { PLUGIN_DATA: cwd, REQALL_API_KEY: undefined };
  const invoke = (event, extra) => runNode(HOOK, [], { cwd, env, input: hookInput(event, { cwd, ...extra }) });
  invoke('UserPromptSubmit', { prompt: 'implement project_name=org/repo' });
  const rec = { id: 10, project_id: 7, kind: 'todo', status: 'resolved', title: 'Saved', body: 'Partial' };
  for (const [operation, args, data] of [
    ['upsert_project', { name: 'org/repo' }, { project: { id: 7, name: 'org/repo' } }],
    ['upsert_record', { links: [{ target_id: 20 }] }, { record: rec, links: [{ action: 'error' }] }],
  ]) invoke('PostToolUse', { tool_name: `reqall:${operation}`, tool_use_id: operation, tool_input: args, tool_response: { structuredContent: { ok: true, data } } });
  invoke('UserPromptSubmit', { prompt: 'review project_name=org/other', turn_id: 'turn-2' });
  let state = loadGuardrail({ cwd, env, sessionId: 'session-1', turnId: 'turn-2', allowCurrent: true });
  assert.deepEqual(state.verification.pending, []);
  invoke('UserPromptSubmit', { prompt: 'continue project_name=org/repo', turn_id: 'turn-3' });
  state = loadGuardrail({ cwd, env, sessionId: 'session-1', turnId: 'turn-3', allowCurrent: true });
  assert.deepEqual(state.verification.pending, [10]); assert.deepEqual(state.evidence, []);
});
