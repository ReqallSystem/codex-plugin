// Typed verification derived only from trusted lifecycle results. Never persist bodies.
import { createHash } from 'node:crypto';
const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const validId = value => Number.isSafeInteger(value) && value > 0;
export function payload(value) {
  for (let i = 0; i < 10; i++) {
    if (typeof value === 'string') { try { value = JSON.parse(value); } catch { return null; } }
    else if (!value || typeof value !== 'object') return null;
    else if (value.jsonrpc && value.result) value = value.result;
    else if (value.structuredContent) value = value.structuredContent;
    else if (Array.isArray(value.content)) {
      const texts = value.content.filter(b => b.type === 'text');
      if (texts.length !== 1) return null;
      value = texts[0].text;
    } else if (value.data) value = value.data;
    else return value;
  }
  return null;
}
export function newVerification() {
  return { revision: 0, projectId: null, starts: {}, outcomes: {}, commitments: [], pending: [], sequence: 0, verifiedList: 0, required: {} };
}
export function recordFingerprint(record) {
  return hash([record.id, record.project_id, record.kind, record.status, record.title, record.body]);
}
export function captureWrite(state, callId) {
  if (state.verification && callId) state.verification.starts[callId] ??= state.verification.revision;
}
export function observeVerification(state, entry, input = {}, result) {
  const v = state.verification;
  if (!v || entry.source !== 'PostToolUse') return;
  const seq = ++v.sequence;
  const op = entry.operation;
  if (['mutation', 'test'].includes(op)) { v.revision++; return; }
  const data = payload(result);
  if (op === 'upsert_project' && entry.success && data?.project?.name === state.project
      && input.name === state.project && validId(data.project.id)) v.projectId = data.project.id;
  if (op === 'list_records' && entry.success && input.project_id === v.projectId) v.verifiedList = seq;
  if (op === 'upsert_link' && entry.success) {
    const edge = { source_id: input.source_id, source_table: input.source_table,
      target_id: input.target_id, target_table: input.target_table, relationship: input.relationship };
    for (const [id, table] of [[input.source_id, input.source_table], [input.target_id, input.target_table]]) {
      if (table !== 'records' || !v.outcomes[id]) continue;
      v.required[id] ||= [];
      if (!v.required[id].some(e => hash(e) === hash(edge))) v.required[id].push(edge);
      v.outcomes[id].links = null; v.outcomes[id].incoming = null;
    }
  }
  if (op === 'list_links' && !entry.success && v.outcomes[input.entity_id]) v.outcomes[input.entity_id].links = null;
  if (op === 'list_links' && entry.success && input.entity_type === 'records' && ['outgoing', 'incoming'].includes(input.direction)) {
    const out = v.outcomes[input.entity_id];
    if (!out || !Array.isArray(data?.links)) return;
    const field = input.direction === 'incoming' ? 'incoming' : 'links';
    const pageField = `${field}Pages`;
    const offset = input.offset ?? 0;
    out[field] = null;
    if (offset === 0) out[pageField] = [];
    const pages = out[pageField] || [];
    if (offset !== pages.length) return;
    if (!data.links.every(l => validId(l.source_id) && validId(l.target_id)
        && (input.direction === 'outgoing' ? l.source_table === 'records' && l.source_id === input.entity_id
          : l.target_table === 'records' && l.target_id === input.entity_id) && !l.error)) return;
    pages.push(...data.links.map(l => ({ source_id: l.source_id, source_table: l.source_table,
      target_id: l.target_id, target_table: l.target_table, relationship: l.relationship })));
    out[pageField] = pages;
    out[field] = data.has_more || !Number.isInteger(data.total) || data.total !== pages.length ? null : pages;
    out[`${field}At`] = seq;
  }
  if (!['get_record', 'upsert_record'].includes(op)) return;
  const rec = data?.record;
  const same = validId(rec?.id) && rec.project_id === v.projectId && typeof rec.kind === 'string' && typeof rec.status === 'string'
    && typeof rec.title === 'string' && typeof rec.body === 'string';
  if (op === 'get_record') {
    const out = v.outcomes[input.id];
    if (out) out.readAt = entry.success && same && rec.id === input.id && recordFingerprint(rec) === out.fingerprint ? seq : 0;
    return;
  }
  const revision = v.starts[entry.toolUseId];
  delete v.starts[entry.toolUseId];
  if (!same) return;
  const expected = input.links;
  const links = data.link_results ?? data.links;
  if (Array.isArray(expected)) {
    v.required[rec.id] ||= [];
    for (const e of expected) {
      const edge = e.direction === 'incoming'
        ? { source_id: e.target_id, source_table: e.target_table, target_id: rec.id, target_table: 'records', relationship: e.relationship }
        : { source_id: rec.id, source_table: 'records', target_id: e.target_id, target_table: e.target_table, relationship: e.relationship };
      if (!v.required[rec.id].some(old => hash(old) === hash(edge))) v.required[rec.id].push(edge);
    }
  }
  const linksOk = !Array.isArray(expected) || (expected.length <= 20 && Array.isArray(links)
    && links.length === expected.length && links.every(l => ['created', 'existing'].includes(l.action) && !l.error && l.ok !== false));
  const commitment = v.commitments.includes(rec.id) || rec.kind === 'spec' || (rec.kind === 'arch' && rec.status !== 'resolved');
  if (!entry.success || !linksOk) {
    if (!v.pending.includes(rec.id)) v.pending.push(rec.id);
    if (commitment && !v.commitments.includes(rec.id)) v.commitments.push(rec.id);
    delete v.outcomes[rec.id];
    v.revision++;
    return;
  }
  v.pending = v.pending.filter(id => id !== rec.id);
  if (commitment) {
    if (!v.commitments.includes(rec.id)) v.commitments.push(rec.id);
    v.revision++;
    delete v.outcomes[rec.id];
  } else {
    v.outcomes[rec.id] = { revision: revision ?? -1, writtenAt: seq, fingerprint: recordFingerprint(rec),
      kind: rec.kind, status: rec.status, readAt: 0, links: null, linksAt: 0, incoming: null, incomingAt: 0 };
  }
}
export function verificationFailure(v) {
  if (!v?.projectId) return 'exact project binding is missing';
  if (v.pending.length) return `partial saves require same-ID recovery: ${v.pending.join(', ')}`;
  const current = Object.entries(v.outcomes).filter(([, o]) => o.revision === v.revision);
  if (!current.length) return 'upsert_record outcomes must cover the current work revision (PreToolUse snapshot required)';
  const covered = new Set();
  for (const [id, out] of current) {
    if (!(out.readAt > out.writtenAt) || !out.links || !(out.linksAt > out.writtenAt)) return `get_record and complete outgoing list_links readback required for #${id}`;
    if (v.verifiedList <= Math.max(out.writtenAt, out.readAt, out.linksAt)) return 'list_records verification must follow exact record/link readbacks';
    for (const expected of v.required[id] || []) {
      const incoming = expected.target_table === 'records' && expected.target_id === Number(id) && expected.source_id !== Number(id);
      const candidates = incoming ? out.incoming : out.links;
      if (!candidates?.some(e => hash(e) === hash(expected))) return `required link readback missing for #${id}`;
      if (incoming && (!(out.incomingAt > out.writtenAt) || v.verifiedList <= out.incomingAt)) return `incoming list_links verification required for #${id}`;
    }
    for (const link of out.links) {
      if (link.target_table === 'records' && (link.relationship === 'implements'
          || (link.relationship === 'blocks' && out.kind === 'todo' && out.status === 'open'))) covered.add(link.target_id);
    }
  }
  const gaps = v.commitments.filter(id => !covered.has(id));
  return gaps.length ? `intent requires implements or open todo blocks coverage: ${gaps.join(', ')}` : '';
}
