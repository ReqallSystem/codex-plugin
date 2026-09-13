import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync, rmSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { resolveProjectName } from '../scripts/lib/project.mjs';

test('AGENTS policy matches runtime portable precedence', () => {
  const text = readFileSync(new URL('../AGENTS.md', import.meta.url), 'utf8');
  const policy = text.slice(text.indexOf('1. Reuse the authoritative'));
  let previous = -1;
  for (const token of ['REQALL_PROJECT_NAME', 'network Git', 'explicitly labelled', '.reqall.yml', 'package.json', 'REQALL_WORKSPACE_ROOT', '.machine/']) {
    const at = policy.indexOf(token);
    assert.ok(at > previous, `missing or out-of-order ${token}`);
    previous = at;
  }
  for (const token of ['.reqall.yaml', '64 KiB', '.user', 'SLEEP', 'OS user', 'no record migration']) assert.ok(policy.includes(token), `missing ${token}`);
});

test('portable metadata and labelled selections follow canonical precedence', () => {
  const cwd = mkdtempSync(join(tmpdir(), 'reqall-policy-'));
  try {
    writeFileSync(join(cwd, '.reqall.yml'), 'project: portable/notes\n');
    assert.equal(resolveProjectName(cwd, {}), 'portable/notes');
    assert.equal(resolveProjectName(cwd, {}, 'fix project: `chosen/notes`'), 'chosen/notes');
    assert.equal(resolveProjectName(cwd, {}, 'continue', 'chosen/notes'), 'chosen/notes');
    assert.equal(resolveProjectName(cwd, { REQALL_PROJECT_NAME: ' env/wins ' }, 'project=x/y', 'chosen/notes'), 'env/wins');
    assert.equal(resolveProjectName(cwd, {}, 'inspect arbitrary/path'), 'portable/notes');
  } finally { rmSync(cwd, { recursive: true, force: true }); }
});

import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

test('host lifecycle retains selections, ignores reports, and switches next turn', () => {
  const cwd = mkdtempSync(join(tmpdir(), 'reqall-host-'));
  const data = mkdtempSync(join(tmpdir(), 'reqall-data-'));
  const hook = fileURLToPath(new URL('../scripts/reqall-hook.mjs', import.meta.url));
  const run = (event, prompt = '', env = {}, extra = {}) => {
    const result = spawnSync(process.execPath, [hook], {
      input: JSON.stringify({ hook_event_name: event, session_id: 'selection-session', cwd, prompt, ...extra }),
      encoding: 'utf8', env: { ...process.env, REQALL_PROJECT_NAME: '', REQALL_WORKSPACE_ROOT: '', REQALL_API_KEY: '', PLUGIN_DATA: data, GROK_PLUGIN_DATA: data, ...env },
    });
    assert.equal(result.status, 0, result.stderr);
    return result.stdout;
  };
  try {
    assert.match(run('UserPromptSubmit', 'implement project: chosen/one'), /chosen\/one/);
    assert.match(run('UserPromptSubmit', 'continue implementation'), /chosen\/one/);
    assert.match(run('UserPromptSubmit', '<task-notification><summary>Example project_name=wrong/example</summary></task-notification>'), /chosen\/one/);
    assert.match(run('UserPromptSubmit', 'implement project_name="chosen/two"'), /chosen\/two/);
    assert.match(run('UserPromptSubmit', 'continue implementation', { REQALL_PROJECT_NAME: 'env/wins' }), /env\/wins/);
    assert.match(run('UserPromptSubmit', 'continue implementation'), /chosen\/two/);
  } finally { rmSync(cwd, { recursive: true, force: true }); rmSync(data, { recursive: true, force: true }); }
});

test('local fallback grammar, workspace boundaries and network origins', () => {
  const cwd = mkdtempSync(join(tmpdir(), 'reqall-grammar-'));
  const child = join(cwd, 'src', 'work');
  mkdirSync(child, { recursive: true });
  const env = { REQALL_WORKSPACE_ROOT: cwd };
  try {
    assert.equal(resolveProjectName(child, env), 'src/work');
    writeFileSync(join(cwd, 'package.json'), JSON.stringify({ name: '@acme/widgets' }));
    assert.equal(resolveProjectName(child, env), 'acme/widgets');
    writeFileSync(join(cwd, '.reqall.yml'), 'project: ../invalid\n');
    assert.equal(resolveProjectName(child, env), 'acme/widgets');
    writeFileSync(join(cwd, '.reqall.yml'), 'project: "portable/notes" # comment\n');
    assert.equal(resolveProjectName(child, env), 'portable/notes');
    const git = (...args) => { const r = spawnSync('git', args, { cwd, encoding: 'utf8' }); assert.equal(r.status, 0, r.stderr); };
    git('init', '-q'); git('remote', 'add', 'origin', '/local/not-portable.git');
    assert.equal(resolveProjectName(child, env), 'portable/notes');
    git('remote', 'set-url', 'origin', 'https://gitlab.com/group/sub/repo.git/');
    assert.equal(resolveProjectName(child, env, 'project: lower/priority', 'saved/selection'), 'sub/repo');
  } finally { rmSync(cwd, { recursive: true, force: true }); }
});
