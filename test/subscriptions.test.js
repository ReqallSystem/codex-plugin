import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { updateSession } from '../scripts/lib/guardrail-state.mjs';
import { bindSubscription, subscriptionTurn, subscriptionEnd, subscriptionClient, parseRpc } from '../scripts/lib/subscriptions.mjs';
function setup(t) {
  const dir = mkdtempSync(join(tmpdir(), 'reqall-sub-test-')); t.after(() => rmSync(dir, { recursive: true, force: true }));
  const options = { cwd: dir, env: { PLUGIN_DATA: dir }, sessionId: 'session-1' };
  bindSubscription(options, 'org/repo', 7);
  const calls = [];
  let events = [], failure = null, more = false;
  const client = async (name, args) => {
    calls.push([name, args]);
    if (failure?.[name]) return failure[name];
    return { ok: true, data: name === 'poll_subscriptions' ? { results: [{ subscription: { project_id: args.project_id, subscriber: args.subscriber }, events, next_cursor: 99, has_more: more }] } : { action: 'created' } };
  };
  return { options, calls, client, set: (e, f = null, m = false) => { events = e; failure = f; more = m; } };
}
const event = (id, extra = {}) => ({ id, project_id: 7, record_id: id + 100, action: 'record.updated', ...extra });
test('subscribes once per session and project; peeks and acknowledges previous pages', async t => {
  const h = setup(t); h.set([event(1)]);
  assert.match(await subscriptionTurn(h.options, h.client), /record #101/);
  h.set([]); await subscriptionTurn(h.options, h.client);
  assert.equal(h.calls.filter(([n]) => n === 'subscribe_project').length, 1);
  const polls = h.calls.filter(([n]) => n === 'poll_subscriptions');
  assert.deepEqual(polls[0][1], { project_id: 7, subscriber: 'session-1', limit: 5, ack: false });
  assert.equal(polls[1][1].ack_cursor, 99);
  await subscriptionEnd(h.options, h.client);
  assert.equal(updateSession(h.options).subscribed, null);
});
test('preserves same-account other-session edits; suppresses only exact session attribution', async t => {
  const h = setup(t); h.set([event(1, { actor: 'self' }), event(2, { session_id: 'session-1' }), event(3, { project_id: 8 })]);
  const text = await subscriptionTurn(h.options, h.client);
  assert.match(text, /record #101/); assert.doesNotMatch(text, /record #102|record #103/);
});
test('excess events survive rendering bounds and drain before another poll', async t => {
  const h = setup(t); h.set(Array.from({ length: 8 }, (_, i) => event(i)));
  const first = await subscriptionTurn(h.options, h.client); assert.match(first, /More updates/);
  const second = await subscriptionTurn(h.options, h.client); assert.match(second, /record #107/);
  assert.equal(h.calls.filter(([n]) => n === 'poll_subscriptions').length, 1);
});
test('unsupported tools detected once; transient failures retry', async t => {
  const h = setup(t); h.set([], { subscribe_project: { ok: false, error: 'network' } });
  await subscriptionTurn(h.options, h.client); h.set([]); await subscriptionTurn(h.options, h.client);
  assert.equal(h.calls.filter(([n]) => n === 'subscribe_project').length, 2);
  h.set([], { poll_subscriptions: { ok: false, error: 'Unknown tool' } });
  await subscriptionTurn(h.options, h.client); const n = h.calls.length;
  await subscriptionTurn(h.options, h.client); assert.equal(h.calls.length, n);
});
test('project switch waits for successful release; failed end cleanup retains cursor', async t => {
  const h = setup(t); await subscriptionTurn(h.options, h.client);
  bindSubscription(h.options, 'org/other', 8);
  h.set([], { unsubscribe_project: { ok: false, error: 'network' } });
  await subscriptionTurn(h.options, h.client); assert.equal(updateSession(h.options).subscribed, 7);
  h.set([]); await subscriptionTurn(h.options, h.client);
  const tail = h.calls.slice(-3).map(([n]) => n);
  assert.deepEqual(tail, ['unsubscribe_project', 'subscribe_project', 'poll_subscriptions']);
  h.set([], { unsubscribe_project: { ok: false, error: 'network' } });
  await subscriptionEnd(h.options, h.client); assert.equal(updateSession(h.options).subscribed, 8);
});
test('session lease prevents concurrent duplicate polling', async t => {
  const h = setup(t); let release;
  const waiting = new Promise(r => { release = r; });
  const first = subscriptionTurn(h.options, async (...args) => { await waiting; return h.client(...args); });
  assert.equal(await subscriptionTurn(h.options, h.client), ''); release(); await first;
  assert.equal(h.calls.filter(([n]) => n === 'subscribe_project').length, 1);
});
test('no implicit credentials; SSE request identity and secure endpoint validation', async () => {
  assert.equal(subscriptionClient({}), null);
  assert.equal(subscriptionClient({ REQALL_API_KEY: 'fake', REQALL_MCP_URL: 'http://example.com/mcp' }), null);
  assert.deepEqual(parseRpc('data: {"id":"other","result":{}}\n\ndata: {"id":"mine","result":{"ok":true}}\n\n', 'mine'), { ok: true });
  assert.equal(parseRpc('{"id":"other","result":{}}', 'mine').ok, false);
  let request;
  const client = subscriptionClient({ REQALL_API_KEY: 'fake' }, async (url, init) => {
    request = init; const { id } = JSON.parse(init.body);
    return new Response(JSON.stringify({ id, result: { ok: true, data: {} } }));
  });
  assert.equal((await client('subscribe_project', { project_id: 7, subscriber: 's' })).ok, true);
  assert.equal(request.redirect, 'error');
});

test('real hook processes bind, poll next turn, inject updates, and unsubscribe at session end', async t => {
  const { createServer } = await import('node:http');
  const { HOOK, hookInput, runNodeAsync, parseJsonOutput } = await import('./helpers.mjs');
  const dir = mkdtempSync(join(tmpdir(), 'reqall-http-hook-'));
  const calls = []; let pollCount = 0;
  const server = createServer(async (req, res) => {
    let body = ''; for await (const chunk of req) body += chunk;
    const rpc = JSON.parse(body); calls.push(rpc.params);
    const { name, arguments: args } = rpc.params;
    const data = name === 'poll_subscriptions' ? { results: [{
      subscription: { project_id: 7, subscriber: 'session-1' }, next_cursor: 20,
      events: pollCount++ ? [event(20)] : [], has_more: false,
    }] } : { action: 'created' };
    assert.equal(args.project_id, 7);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ jsonrpc: '2.0', id: rpc.id, result: { structuredContent: { ok: true, data } } }));
  });
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  t.after(async () => { await new Promise(resolve => server.close(resolve)); rmSync(dir, { recursive: true, force: true }); });
  const env = { PLUGIN_DATA: dir, REQALL_PROJECT_NAME: 'org/repo', REQALL_SUBSCRIPTIONS: '1',
    REQALL_API_KEY: 'local-fixture-only', REQALL_MCP_URL: `http://127.0.0.1:${server.address().port}/mcp` };
  const invoke = async (event, extra = {}) => {
    const result = await runNodeAsync(HOOK, [], { cwd: dir, env, input: hookInput(event, { cwd: dir, ...extra }) });
    assert.equal(result.status, 0, result.stderr); return parseJsonOutput(result);
  };
  await invoke('UserPromptSubmit', { prompt: 'implement feature' });
  await invoke('PostToolUse', { tool_name: 'reqall:upsert_project', tool_use_id: 'project', tool_input: { name: 'org/repo' },
    tool_response: { structuredContent: { ok: true, data: { project: { id: 7, name: 'org/repo' } } } } });
  const next = await invoke('UserPromptSubmit', { prompt: 'continue', turn_id: 'turn-2' });
  assert.match(next.hookSpecificOutput.additionalContext, /Reqall updates since last turn/);
  assert.match(next.hookSpecificOutput.additionalContext, /record #120/);
  await invoke('SessionEnd', { turn_id: undefined });
  assert.deepEqual(calls.map(c => c.name), ['subscribe_project', 'poll_subscriptions', 'poll_subscriptions', 'unsubscribe_project']);
});
