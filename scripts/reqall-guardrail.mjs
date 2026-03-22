#!/usr/bin/env node

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseArgs, resolveProjectName } from './lib/project.mjs';

const STATE_DIR = resolve(process.cwd(), '.reqall');
const STATE_FILE = resolve(STATE_DIR, 'codex-guardrail.json');
const VERSION = 2;

function now() {
  return new Date().toISOString();
}

function ensureStateDir() {
  if (!existsSync(STATE_DIR)) {
    mkdirSync(STATE_DIR, { recursive: true });
  }
}

function readState() {
  if (!existsSync(STATE_FILE)) {
    return null;
  }
  return JSON.parse(readFileSync(STATE_FILE, 'utf8'));
}

function writeState(state) {
  ensureStateDir();
  writeFileSync(STATE_FILE, `${JSON.stringify(state, null, 2)}\n`, 'utf8');
}

function fail(message, code = 1) {
  console.error(`[reqall-guardrail] ${message}`);
  process.exit(code);
}

function ok(message) {
  console.log(`[reqall-guardrail] ${message}`);
}

function usage() {
  console.log('Reqall Codex Guardrail');
  console.log();
  console.log('Usage:');
  console.log('  reqall-guardrail begin [--task "text"] [--project "name"] [--trivial]');
  console.log('  reqall-guardrail mark-context [--evidence "text"]');
  console.log('  reqall-guardrail mark-document [--evidence "text"]');
  console.log('  reqall-guardrail mark-persist [--evidence "text"]');
  console.log('  reqall-guardrail check');
  console.log('  reqall-guardrail status');
  console.log('  reqall-guardrail reset');
  console.log();
  console.log('Exit codes for `check`:');
  console.log('  0  pass');
  console.log('  10 begin was not run');
  console.log('  11 context injection missing');
  console.log('  12 persistence missing');
}

function requireActiveState() {
  const state = readState();
  if (!state || !state.current) {
    fail('No active task state. Run `begin` first.', 10);
  }
  return state;
}

function appendEvidence(bucket, evidence) {
  if (!evidence) {
    return bucket;
  }
  return [...bucket, { at: now(), value: evidence }];
}

function begin(args) {
  const nonTrivial = args.trivial ? false : true;
  const project = typeof args.project === 'string' && args.project.trim() ? args.project.trim() : resolveProjectName();
  const state = {
    version: VERSION,
    updatedAt: now(),
    current: {
      startedAt: now(),
      task: typeof args.task === 'string' ? args.task : '',
      project,
      nonTrivial,
      contextInjected: false,
      persisted: false,
      documented: false,
      contextInjectedAt: null,
      persistedAt: null,
      documentedAt: null,
      evidence: {
        context: [],
        document: [],
        persist: [],
      },
    },
  };
  writeState(state);
  ok(nonTrivial ? `Started non-trivial task guardrail for ${project}.` : `Started trivial task guardrail for ${project}.`);
}

function markContext(args) {
  const state = requireActiveState();
  state.current.contextInjected = true;
  state.current.contextInjectedAt = now();
  state.current.evidence.context = appendEvidence(state.current.evidence.context, args.evidence || args.note || 'manual context confirmation');
  state.updatedAt = now();
  writeState(state);
  ok('Marked context injection as complete.');
}

function markDocument(args) {
  const state = requireActiveState();
  state.current.documented = true;
  state.current.documentedAt = now();
  state.current.evidence.document = appendEvidence(state.current.evidence.document, args.evidence || args.note || 'manual documentation confirmation');
  state.updatedAt = now();
  writeState(state);
  ok('Marked incremental documentation as complete.');
}

function markPersist(args) {
  const state = requireActiveState();
  state.current.persisted = true;
  state.current.persistedAt = now();
  state.current.evidence.persist = appendEvidence(state.current.evidence.persist, args.evidence || args.note || 'manual persistence confirmation');
  state.updatedAt = now();
  writeState(state);
  ok('Marked persistence as complete.');
}

function check() {
  const state = readState();
  if (!state || !state.current) {
    fail('Guardrail check failed: `begin` was not run.', 10);
  }

  if (!state.current.nonTrivial) {
    ok('Guardrail check passed (trivial task).');
    return;
  }

  if (!state.current.contextInjected || state.current.evidence.context.length === 0) {
    fail('Guardrail check failed: context injection was not marked complete.', 11);
  }

  if (!state.current.persisted || state.current.evidence.persist.length === 0) {
    fail('Guardrail check failed: persistence was not marked complete.', 12);
  }

  ok('Guardrail check passed (context + persistence complete).');
}

function status() {
  const state = readState();
  if (!state || !state.current) {
    ok('No active guardrail state.');
    return;
  }
  console.log(JSON.stringify(state, null, 2));
}

function reset() {
  writeState({
    version: VERSION,
    updatedAt: now(),
    current: null,
  });
  ok('Reset guardrail state.');
}

function main() {
  const argv = process.argv.slice(2);
  if (argv.length === 0 || argv[0] === '--help' || argv[0] === '-h') {
    usage();
    return;
  }

  const args = parseArgs(argv);
  const cmd = args._[0];
  if (cmd === 'begin') return begin(args);
  if (cmd === 'mark-context') return markContext(args);
  if (cmd === 'mark-document') return markDocument(args);
  if (cmd === 'mark-persist') return markPersist(args);
  if (cmd === 'check' || cmd === 'check-exit') return check();
  if (cmd === 'status') return status();
  if (cmd === 'reset') return reset();

  fail(`Unknown command: ${cmd}`, 1);
}

main();
