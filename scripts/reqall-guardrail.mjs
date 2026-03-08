#!/usr/bin/env node

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const STATE_DIR = resolve(process.cwd(), '.reqall');
const STATE_FILE = resolve(STATE_DIR, 'codex-guardrail.json');
const VERSION = 1;

function now() {
  return new Date().toISOString();
}

function parseArgs(argv) {
  const args = { _: [] };
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith('--')) {
      args._.push(token);
      continue;
    }

    if (token === '--trivial') {
      args.trivial = true;
      continue;
    }
    if (token === '--non-trivial') {
      args.nonTrivial = true;
      continue;
    }

    const key = token.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith('--')) {
      throw new Error(`Missing value for --${key}`);
    }
    args[key] = next;
    i += 1;
  }
  return args;
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
  console.log('  reqall-guardrail mark-context');
  console.log('  reqall-guardrail mark-persist');
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

function begin(args) {
  const nonTrivial = args.trivial ? false : true;
  const state = {
    version: VERSION,
    updatedAt: now(),
    current: {
      startedAt: now(),
      task: args.task ?? '',
      project: args.project ?? '',
      nonTrivial,
      contextInjected: false,
      persisted: false,
      contextInjectedAt: null,
      persistedAt: null,
    },
  };
  writeState(state);
  ok(nonTrivial ? 'Started non-trivial task guardrail.' : 'Started trivial task guardrail.');
}

function markContext() {
  const state = requireActiveState();
  state.current.contextInjected = true;
  state.current.contextInjectedAt = now();
  state.updatedAt = now();
  writeState(state);
  ok('Marked context injection as complete.');
}

function markPersist() {
  const state = requireActiveState();
  state.current.persisted = true;
  state.current.persistedAt = now();
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

  if (!state.current.contextInjected) {
    fail('Guardrail check failed: context injection was not marked complete.', 11);
  }

  if (!state.current.persisted) {
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

  let args;
  try {
    args = parseArgs(argv);
  } catch (err) {
    fail(err.message, 1);
  }

  const cmd = args._[0];
  if (cmd === 'begin') return begin(args);
  if (cmd === 'mark-context') return markContext();
  if (cmd === 'mark-persist') return markPersist();
  if (cmd === 'check' || cmd === 'check-exit') return check();
  if (cmd === 'status') return status();
  if (cmd === 'reset') return reset();

  fail(`Unknown command: ${cmd}`, 1);
}

main();
