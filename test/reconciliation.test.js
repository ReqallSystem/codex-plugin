import assert from 'node:assert/strict';
import test from 'node:test';
import { newVerification, captureWrite, observeVerification, verificationFailure } from '../scripts/lib/reconciliation.mjs';

function harness() {
  const state = { project: 'org/repo', verification: newVerification() }; let n = 0;
  function call(operation, input, data, { success = true, start = true, beforePost } = {}) {
    const id = `call-${++n}`;
    if (operation === 'upsert_record' && start) captureWrite(state, id);
    beforePost?.();
    observeVerification(state, { operation, toolUseId: id, success, source: 'PostToolUse' }, input, { structuredContent: { ok: success, data } });
  }
  const record = (id = 10, kind = 'todo', status = 'resolved') => ({ id, project_id: 7, kind, status, title: `Record ${id}`, body: 'Durable outcome' });
  const write = (rec = record(), options = {}, input = {}) => call('upsert_record', input, { record: rec }, options);
  function read(rec = record(), links = []) {
    call('get_record', { id: rec.id }, { record: rec });
    call('list_links', { entity_id: rec.id, entity_type: 'records', direction: 'outgoing' }, { links, total: links.length });
    call('list_records', { project_id: 7 }, { records: [rec] });
  }
  call('upsert_project', { name: 'org/repo' }, { project: { id: 7, name: 'org/repo' } });
  return { state, call, record, write, read, failure: () => verificationFailure(state.verification) };
}
const edge = (source, target, relationship = 'implements') => ({ source_id: source, source_table: 'records', target_id: target, target_table: 'records', relationship });
test('exact readbacks enforce every current batch record, project and field digest', () => {
  const h = harness(); h.write(); assert.match(h.failure(), /get_record/);
  h.read({ ...h.record(), body: 'Different' }); assert.match(h.failure(), /get_record/);
  h.read(); assert.equal(h.failure(), '');
  h.write(h.record(11)); assert.match(h.failure(), /#11/);
  h.read(h.record(11)); assert.equal(h.failure(), '');
  h.call('get_record', { id: 11 }, { record: { ...h.record(11), project_id: 9 } });
  assert.match(h.failure(), /#11/);
});
test('consultation is not commitment; selected/written intent requires a real directed coverage edge', () => {
  const h = harness(); const spec = h.record(20, 'spec', 'open');
  h.call('get_record', { id: 20 }, { record: spec }); h.write(); h.read(); assert.equal(h.failure(), '');
  h.write(spec); h.write(); h.read(); assert.match(h.failure(), /intent/);
  h.read(h.record(), [edge(10, 20, 'tests')]); assert.match(h.failure(), /intent/);
  h.read(h.record(), [{ ...edge(10, 20), target_table: 'projects' }]); assert.match(h.failure(), /intent/);
  h.read(h.record(), [edge(10, 20)]); assert.equal(h.failure(), '');
});
test('only open todo blocks can reconcile gaps; resolved selected intent cannot self-acknowledge', () => {
  const h = harness(); h.write(h.record(20, 'arch', 'open'));
  h.write(h.record(20, 'arch', 'resolved')); h.read(h.record(20, 'arch', 'resolved'));
  assert.match(h.failure(), /current work/);
  h.write(); h.read(h.record(), [edge(10, 20, 'blocks')]); assert.match(h.failure(), /intent/);
  const gap = h.record(10, 'todo', 'open'); h.write(gap); h.read(gap, [edge(10, 20, 'blocks')]); assert.equal(h.failure(), '');
});
test('work during a write invalidates its captured revision; fresh outcomes can supersede old batches', () => {
  const h = harness(); h.write(h.record(), { beforePost: () => h.call('mutation', {}, {}) });
  h.read(); assert.match(h.failure(), /current work/);
  h.write(h.record(11)); h.read(h.record(11)); assert.equal(h.failure(), '');
  h.call('test', {}, {}, { success: false }); assert.match(h.failure(), /current work/);
  h.write(h.record(12), { start: false }); h.read(h.record(12)); assert.match(h.failure(), /current work/);
});
test('partial inline save requires same-id recovery, not just repaired edges or a different record', () => {
  const h = harness(); const rec = h.record();
  h.call('upsert_record', { links: [edge(10, 20)] }, { record: rec, links: [{ action: 'error' }] });
  h.read(); h.write(h.record(11)); h.read(h.record(11)); assert.match(h.failure(), /same-ID/);
  h.call('upsert_link', { source_id: 10, target_id: 20 }, {}); assert.match(h.failure(), /same-ID/);
  h.write(); h.read(h.record(), [edge(10, 20)]); assert.equal(h.failure(), '');
});
test('missing inline results and excessive batches are partial; list pagination must be complete', () => {
  const h = harness(); h.call('upsert_record', { links: [edge(10, 20)] }, { record: h.record() });
  assert.match(h.failure(), /partial/); h.write();
  h.call('get_record', { id: 10 }, { record: h.record() });
  const args = { entity_id: 10, entity_type: 'records', direction: 'outgoing' };
  h.call('list_links', args, { links: [edge(10, 20)], total: 2 }); assert.match(h.failure(), /list_links/);
  h.call('list_links', { ...args, offset: 1 }, { links: [edge(10, 21)], total: 2 });
  h.call('list_records', { project_id: 7 }, {}); assert.equal(h.failure(), '');
  h.call('upsert_link', { source_id: 10, source_table: 'records', target_id: 22, target_table: 'records', relationship: 'related' }, {}); assert.match(h.failure(), /list_links/);
});
test('standalone resolved architecture is an outcome and no raw body enters state', () => {
  const h = harness(); const rec = h.record(10, 'arch'); h.write(rec); h.read(rec);
  assert.equal(h.failure(), ''); assert.doesNotMatch(JSON.stringify(h.state), /Durable outcome|Record 10/);
});

test('requested incoming and outgoing links survive partial recovery and require exact readback', () => {
  const h = harness();
  const links = [{ target_id: 21, target_table: 'records', relationship: 'related', direction: 'incoming' }];
  h.call('upsert_record', { links }, { record: h.record(), links: [{ action: 'error' }] });
  h.write(); h.read(); assert.match(h.failure(), /required link/);
  h.call('list_links', { entity_id: 10, entity_type: 'records', direction: 'incoming' }, { links: [edge(21, 10, 'related')], total: 1 });
  h.call('list_records', { project_id: 7 }, {}); assert.equal(h.failure(), '');
});
