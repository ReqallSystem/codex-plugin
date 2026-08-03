import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { createHash, randomUUID } from 'node:crypto';
import { dirname, join, relative, resolve } from 'node:path';

export const STATE_VERSION = 3;
export const EXIT_NO_TASK = 10;
export const EXIT_CONTEXT_MISSING = 11;
export const EXIT_PERSIST_MISSING = 12;
export const EXIT_STALE = 13;
export const EXIT_INVALID_EVIDENCE = 14;

export const CONTEXT_OPERATIONS = Object.freeze([
  'upsert_project',
  'search',
  'list_records',
]);

export const PERSIST_WRITE_OPERATIONS = Object.freeze([
  'upsert_record',
  'upsert_link',
  'sleep_apply',
]);

const REQALL_OPERATIONS = Object.freeze([
  'sleep_candidates',
  'delete_project',
  'delete_record',
  'delete_link',
  'share_project',
  'revoke_share',
  'list_shares',
  'upsert_project',
  'upsert_record',
  'upsert_link',
  'list_records',
  'list_projects',
  'list_links',
  'get_record',
  'sleep_apply',
  'search',
  'impact',
]);

const DEFAULT_MAX_AGE_MS = 8 * 60 * 60 * 1000;
const REQUIRED_PERSIST_OPERATION = 'upsert_record';
const QUALIFYING_EVIDENCE_SOURCE = 'PostToolUse';
const LOCK_TIMEOUT_MS = 5_000;
const LOCK_STALE_MS = 30_000;
const waitArray = new Int32Array(new SharedArrayBuffer(4));

function digest(value, length = 24) {
  return createHash('sha256').update(String(value)).digest('hex').slice(0, length);
}

function timestamp() {
  return new Date().toISOString();
}

function maxAgeMs(env = process.env) {
  const configured = Number(env.REQALL_GUARDRAIL_MAX_AGE_MS);
  return Number.isFinite(configured) && configured > 0 ? configured : DEFAULT_MAX_AGE_MS;
}

export function stateRoot(cwd = process.cwd(), env = process.env) {
  const pluginData = env.PLUGIN_DATA || env.CLAUDE_PLUGIN_DATA;
  if (typeof pluginData === 'string' && pluginData.trim()) {
    return resolve(pluginData, 'reqall-guardrail');
  }
  return resolve(cwd, '.reqall', 'codex-guardrail');
}

function normalizeIdentityPart(value, fallback) {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

export function makeIdentity({ sessionId, turnId, task = '', cwd = process.cwd() }) {
  const normalizedSession = normalizeIdentityPart(sessionId, `manual:${digest(resolve(cwd))}`);
  const normalizedTurn = typeof turnId === 'string' && turnId.trim() ? turnId.trim() : '';
  const normalizedTask = typeof task === 'string' && task.trim() ? task.trim() : 'unspecified';
  const taskKey = normalizedTurn
    ? `turn:${normalizedTurn}:task:${digest(normalizedTask)}`
    : `task:${digest(normalizedTask === 'unspecified' ? 'manual' : normalizedTask)}`;
  return {
    sessionId: normalizedSession,
    turnId: normalizedTurn,
    taskKey,
  };
}

function statePath(root, identity) {
  return join(root, 'tasks', digest(identity.sessionId), `${digest(identity.taskKey)}.json`);
}

function pointerPath(root, sessionId) {
  return join(root, 'current', `${digest(sessionId)}.json`);
}

function readJson(path) {
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    return null;
  }
}

function writeJsonAtomic(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  const temporary = `${path}.${process.pid}.${randomUUID()}.tmp`;
  writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  try {
    renameSync(temporary, path);
  } catch (error) {
    rmSync(temporary, { force: true });
    throw error;
  }
}

function withLock(root, key, action) {
  const lock = join(root, 'locks', `${digest(key)}.lock`);
  mkdirSync(dirname(lock), { recursive: true });
  const deadline = Date.now() + LOCK_TIMEOUT_MS;

  while (true) {
    try {
      mkdirSync(lock);
      break;
    } catch (error) {
      if (error.code !== 'EEXIST') throw error;
      try {
        if (Date.now() - statSync(lock).mtimeMs > LOCK_STALE_MS) {
          rmSync(lock, { recursive: true, force: true });
          continue;
        }
      } catch (statError) {
        if (statError.code !== 'ENOENT') throw statError;
      }
      if (Date.now() >= deadline) {
        throw new Error(`Timed out acquiring Reqall guardrail lock for ${key}.`);
      }
      Atomics.wait(waitArray, 0, 0, 10);
    }
  }

  try {
    return action();
  } finally {
    rmSync(lock, { recursive: true, force: true });
  }
}

function pointerFor(root, sessionId) {
  const pointer = readJson(pointerPath(root, sessionId));
  if (!pointer || pointer.version !== STATE_VERSION || pointer.sessionId !== sessionId) return null;
  if (typeof pointer.taskKey !== 'string' || !pointer.taskKey.trim()) return null;
  return {
    sessionId: pointer.sessionId,
    turnId: typeof pointer.turnId === 'string' ? pointer.turnId : '',
    taskKey: pointer.taskKey,
  };
}

function resolveIdentityReference(root, identity, allowCurrent) {
  if (existsSync(statePath(root, identity))) return identity;
  const pointer = pointerFor(root, identity.sessionId);
  if (!pointer) return identity;
  if (identity.turnId) {
    return pointer.turnId === identity.turnId ? pointer : identity;
  }
  if (allowCurrent) return pointer;
  return identity;
}

function updatePointer(root, identity) {
  withLock(root, `pointer:${identity.sessionId}`, () => {
    writeJsonAtomic(pointerPath(root, identity.sessionId), {
      version: STATE_VERSION,
      sessionId: identity.sessionId,
      turnId: identity.turnId,
      taskKey: identity.taskKey,
      updatedAt: timestamp(),
    });
  });
}

function taskLabel(task) {
  if (typeof task !== 'string' || !task.trim()) return '';
  return `task:${digest(task.trim())}`;
}

export function beginGuardrail({
  sessionId,
  turnId,
  task = '',
  project = '',
  nonTrivial = true,
  cwd = process.cwd(),
  env = process.env,
}) {
  const root = stateRoot(cwd, env);
  const identity = makeIdentity({ sessionId, turnId, task, cwd });
  const startedAt = timestamp();
  const state = {
    version: STATE_VERSION,
    sessionId: identity.sessionId,
    turnId: identity.turnId,
    taskKey: identity.taskKey,
    startedAt,
    updatedAt: startedAt,
    project: typeof project === 'string' ? project.trim() : '',
    task: taskLabel(task),
    nonTrivial: nonTrivial === true,
    evidence: [],
    notes: [],
    degraded: null,
    stopContinuationIssuedAt: null,
  };
  withLock(root, `state:${identity.sessionId}:${identity.taskKey}`, () => {
    writeJsonAtomic(statePath(root, identity), state);
  });
  updatePointer(root, identity);
  return state;
}

export function loadGuardrail({
  sessionId,
  turnId,
  task = '',
  cwd = process.cwd(),
  env = process.env,
  allowCurrent = false,
}) {
  const root = stateRoot(cwd, env);
  const requested = makeIdentity({ sessionId, turnId, task, cwd });
  const identity = resolveIdentityReference(root, requested, allowCurrent);
  const state = readJson(statePath(root, identity));
  return state?.version === STATE_VERSION ? state : null;
}

function mutateGuardrail(options, updater) {
  const cwd = options.cwd ?? process.cwd();
  const env = options.env ?? process.env;
  const root = stateRoot(cwd, env);
  const requested = makeIdentity({ ...options, cwd });
  const identity = resolveIdentityReference(root, requested, options.allowCurrent === true);
  const path = statePath(root, identity);
  return withLock(root, `state:${identity.sessionId}:${identity.taskKey}`, () => {
    const current = readJson(path);
    if (!current || current.version !== STATE_VERSION) return null;
    const updated = updater(current) ?? current;
    updated.updatedAt = timestamp();
    writeJsonAtomic(path, updated);
    return updated;
  });
}

export function setNonTrivial(options) {
  return mutateGuardrail(options, (state) => {
    state.nonTrivial = true;
    return state;
  });
}

function evidenceFingerprint(entry) {
  return `${entry.toolUseId}:${entry.operation}:${entry.success}`;
}

export function recordToolEvidence(options, entry) {
  if (!entry || typeof entry.toolUseId !== 'string' || !entry.toolUseId.trim()) {
    throw new Error('Concrete evidence requires a non-empty tool-call id.');
  }
  if (typeof entry.operation !== 'string' || !entry.operation.trim()) {
    throw new Error('Concrete evidence requires a recognized operation.');
  }
  const normalized = {
    at: timestamp(),
    phase: entry.phase || 'document',
    operation: entry.operation.trim(),
    toolName: typeof entry.toolName === 'string' ? entry.toolName.slice(0, 160) : '',
    toolUseId: entry.toolUseId.trim().slice(0, 200),
    success: entry.success === true,
    source: entry.source || 'hook',
    inputDigest: entry.inputDigest || null,
    resultDigest: entry.resultDigest || null,
  };
  return mutateGuardrail({ ...options, allowCurrent: options.allowCurrent !== false }, (state) => {
    const fingerprint = evidenceFingerprint(normalized);
    if (!state.evidence.some((item) => evidenceFingerprint(item) === fingerprint)) {
      state.evidence.push(normalized);
    }
    return state;
  });
}

export function appendGuardrailNote(options, note) {
  return mutateGuardrail({ ...options, allowCurrent: options.allowCurrent !== false }, (state) => {
    state.notes.push({
      at: timestamp(),
      kind: String(note.kind || 'note').slice(0, 80),
      sourceId: String(note.sourceId || '').slice(0, 160),
      message: String(note.message || '').slice(0, 240),
      digest: note.digest || null,
    });
    if (state.notes.length > 100) state.notes = state.notes.slice(-100);
    return state;
  });
}

export function markStopContinuation(options) {
  let newlyIssued = false;
  const state = mutateGuardrail({ ...options, allowCurrent: options.allowCurrent !== false }, (current) => {
    if (!current.stopContinuationIssuedAt) {
      current.stopContinuationIssuedAt = timestamp();
      newlyIssued = true;
    }
    return current;
  });
  return { state, newlyIssued };
}

export function markGuardrailDegraded(options, details) {
  const allowedCodes = new Set(['auth', 'network', 'service']);
  const code = typeof details?.code === 'string' ? details.code : '';
  const operation = typeof details?.operation === 'string' ? details.operation.trim() : '';
  const toolUseId = typeof details?.toolUseId === 'string' ? details.toolUseId.trim() : '';
  if (!allowedCodes.has(code) || !operation || !toolUseId) {
    throw new Error('Degraded mode requires a recognized outage, operation, and tool-call id.');
  }
  return mutateGuardrail({ ...options, allowCurrent: options.allowCurrent !== false }, (state) => {
    if (!state.degraded) {
      state.degraded = {
        at: timestamp(),
        code,
        operation: operation.slice(0, 80),
        toolUseId: toolUseId.slice(0, 200),
        source: QUALIFYING_EVIDENCE_SOURCE,
      };
    }
    return state;
  });
}

export function reqallOperation(toolName) {
  if (typeof toolName !== 'string') return '';
  const normalized = toolName.toLowerCase().replace(/-/g, '_');
  const mentionsReqall = normalized.includes('reqall');
  for (const operation of REQALL_OPERATIONS) {
    if (
      normalized === operation
      || normalized.endsWith(`__${operation}`)
      || normalized.endsWith(`:${operation}`)
      || normalized.endsWith(`/${operation}`)
      || (mentionsReqall && normalized.endsWith(`_${operation}`))
    ) {
      return operation;
    }
  }
  return '';
}

export function isSuccessfulToolResponse(response) {
  if (response === null || response === undefined) return false;
  if (typeof response === 'string') {
    return !(
      /^\s*(?:tool call\s+)?(error|failed|failure|unauthorized)\b/i.test(response)
      || /\b(?:exit(?:ed)?(?: with)? code|exit_code)\s*[:=]?\s*[1-9]\d*\b/i.test(response)
    );
  }
  if (typeof response !== 'object') return true;
  if (response.isError === true || response.error || response.ok === false || response.success === false) return false;
  const exitCode = response.exit_code ?? response.exitCode ?? response.code;
  if (typeof exitCode === 'number' && exitCode !== 0) return false;
  return true;
}

export function valueDigest(value) {
  try {
    return digest(JSON.stringify(value));
  } catch {
    return digest(String(value));
  }
}

export function evaluateGuardrail(state, env = process.env) {
  if (!state) {
    return { ok: false, code: EXIT_NO_TASK, reason: 'begin was not run' };
  }
  const startedAt = Date.parse(state.startedAt);
  if (!Number.isFinite(startedAt) || Date.now() - startedAt > maxAgeMs(env)) {
    return { ok: false, code: EXIT_STALE, reason: 'task state is stale or expired' };
  }
  if (!state.nonTrivial) return { ok: true, code: 0, reason: 'trivial task' };

  const successful = state.evidence.filter((entry) =>
    entry.success === true && entry.source === QUALIFYING_EVIDENCE_SOURCE);
  const completedOperations = new Set(successful.map((entry) => entry.operation));
  const missingContext = CONTEXT_OPERATIONS.filter((operation) => !completedOperations.has(operation));
  if (missingContext.length > 0) {
    const degradedEvidence = state.degraded?.source === QUALIFYING_EVIDENCE_SOURCE
      && state.evidence.some((entry) =>
        entry.success === false
        && entry.source === QUALIFYING_EVIDENCE_SOURCE
        && entry.operation === state.degraded.operation
        && entry.toolUseId === state.degraded.toolUseId);
    if (degradedEvidence) {
      return {
        ok: true,
        degraded: true,
        code: 0,
        reason: `Reqall ${state.degraded.code} unavailable; context and persistence did not run`,
        missingContext,
      };
    }
    return {
      ok: false,
      code: EXIT_CONTEXT_MISSING,
      reason: `trusted PostToolUse context is missing successful ${missingContext.join(', ')} operation(s)`,
      missingContext,
    };
  }

  const firstWriteIndex = successful.findIndex((entry) => entry.operation === REQUIRED_PERSIST_OPERATION);
  if (firstWriteIndex === -1) {
    return {
      ok: false,
      code: EXIT_PERSIST_MISSING,
      reason: `trusted PostToolUse root persistence is missing a successful ${REQUIRED_PERSIST_OPERATION} operation`,
    };
  }
  const verified = successful
    .slice(firstWriteIndex + 1)
    .some((entry) => entry.operation === 'list_records');
  if (!verified) {
    return {
      ok: false,
      code: EXIT_PERSIST_MISSING,
      reason: 'trusted PostToolUse root persistence is missing a successful list_records verification after its write',
    };
  }
  return { ok: true, code: 0, reason: 'context and persistence complete' };
}

export function listGuardrails({ cwd = process.cwd(), env = process.env } = {}) {
  const root = stateRoot(cwd, env);
  const tasks = join(root, 'tasks');
  if (!existsSync(tasks)) return [];
  const results = [];
  for (const sessionDirectory of readdirSync(tasks, { withFileTypes: true })) {
    if (!sessionDirectory.isDirectory()) continue;
    const directory = join(tasks, sessionDirectory.name);
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      if (!entry.isFile() || !entry.name.endsWith('.json')) continue;
      const state = readJson(join(directory, entry.name));
      if (state?.version === STATE_VERSION) results.push(state);
    }
  }
  return results.sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
}

export function resetGuardrail(options) {
  const cwd = options.cwd ?? process.cwd();
  const env = options.env ?? process.env;
  const root = stateRoot(cwd, env);
  const requested = makeIdentity({ ...options, cwd });
  const identity = resolveIdentityReference(root, requested, options.allowCurrent === true);
  const path = statePath(root, identity);
  withLock(root, `state:${identity.sessionId}:${identity.taskKey}`, () => {
    if (existsSync(path)) unlinkSync(path);
  });
  const pointer = pointerPath(root, identity.sessionId);
  withLock(root, `pointer:${identity.sessionId}`, () => {
    const current = readJson(pointer);
    if (current?.taskKey === identity.taskKey && existsSync(pointer)) unlinkSync(pointer);
  });
}

export function relativeStateLocation(cwd = process.cwd(), env = process.env) {
  const root = stateRoot(cwd, env);
  const local = relative(cwd, root);
  return local && !local.startsWith('..') ? local : root;
}
