import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import { ROOT } from './helpers.mjs';

const json = (path) => JSON.parse(readFileSync(join(ROOT, path), 'utf8'));

test('npm and plugin release metadata stay synchronized', () => {
  const pkg = json('package.json');
  assert.equal(json('.codex-plugin/plugin.json').version, pkg.version);
  assert.equal(json('package-lock.json').version, pkg.version);
  assert.equal(json('package-lock.json').packages[''].version, pkg.version);
});

test('distributed plugin references resolve and enforcement hooks stay synchronous', () => {
  const manifest = json('.codex-plugin/plugin.json');
  for (const field of ['skills', 'apps', 'mcpServers']) assert.ok(existsSync(join(ROOT, manifest[field])));
  const hooks = json('hooks/hooks.json').hooks;
  for (const event of ['SessionStart', 'UserPromptSubmit', 'PreToolUse', 'PostToolUse', 'Stop']) {
    assert.ok(hooks[event]?.length, event);
    for (const group of hooks[event]) {
      for (const handler of group.hooks) {
        assert.equal(handler.type, 'command');
        assert.notEqual(handler.async, true, `${event} must preserve evidence order`);
        const script = handler.command.match(/\$\{PLUGIN_ROOT\}\/([^"\s]+)/)?.[1];
        assert.ok(script && existsSync(join(ROOT, script)), handler.command);
      }
    }
  }
  for (const skill of readdirSync(join(ROOT, manifest.skills))) {
    assert.ok(existsSync(join(ROOT, manifest.skills, skill, 'SKILL.md')), skill);
    assert.ok(existsSync(join(ROOT, manifest.skills, skill, 'agents/openai.yaml')), skill);
  }
});
