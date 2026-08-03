import { spawn, spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const GUARDRAIL = resolve(ROOT, 'scripts', 'reqall-guardrail.mjs');
export const HELPER = resolve(ROOT, 'scripts', 'reqall-codex-plugin.mjs');
export const HOOK = resolve(ROOT, 'scripts', 'reqall-hook.mjs');

function environment(overrides = {}) {
  const result = { ...process.env, ...overrides };
  for (const [key, value] of Object.entries(result)) {
    if (value === undefined || value === null) {
      delete result[key];
    }
  }
  return result;
}

export function runNode(script, args = [], options = {}) {
  return spawnSync(process.execPath, [script, ...args], {
    cwd: options.cwd ?? ROOT,
    env: environment(options.env),
    input: options.input === undefined ? undefined : JSON.stringify(options.input),
    encoding: 'utf8',
    timeout: 10_000,
  });
}

export function runNodeAsync(script, args = [], options = {}) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(process.execPath, [script, ...args], {
      cwd: options.cwd ?? ROOT,
      env: environment(options.env),
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk) => { stdout += chunk; });
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.on('error', reject);
    child.on('close', (status) => resolvePromise({ status, stdout, stderr }));
    if (options.input !== undefined) {
      child.stdin.write(JSON.stringify(options.input));
    }
    child.stdin.end();
  });
}

export function hookInput(eventName, overrides = {}) {
  return {
    session_id: 'session-1',
    turn_id: 'turn-1',
    cwd: ROOT,
    transcript_path: null,
    hook_event_name: eventName,
    permission_mode: 'default',
    ...overrides,
  };
}

export function parseJsonOutput(result) {
  return result.stdout.trim() ? JSON.parse(result.stdout) : null;
}
