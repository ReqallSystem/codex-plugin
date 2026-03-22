#!/usr/bin/env node

import { relative, resolve } from 'node:path';
import { parseArgs, resolveProjectName, resolveTaskSummary } from './lib/project.mjs';

function fail(message, code = 1) {
  console.error(`[reqall-codex-plugin] ${message}`);
  process.exit(code);
}

function usage() {
  console.log('Reqall Codex Plugin Helpers');
  console.log();
  console.log('Usage:');
  console.log('  reqall-codex-plugin project');
  console.log('  reqall-codex-plugin context [--task "summary"] [--file path] [--query text]');
  console.log('  reqall-codex-plugin pre-edit --file path [--task "summary"]');
  console.log('  reqall-codex-plugin document [--tool name] [--files a,b] [--summary text]');
  console.log('  reqall-codex-plugin persist [--task "summary"] [--tests text] [--follow-up text]');
  console.log('  reqall-codex-plugin review [--scope open|recent]');
}

function printList(title, items) {
  console.log(title);
  for (const item of items) {
    console.log(`- ${item}`);
  }
}

function normalizeFiles(rawFiles) {
  if (!rawFiles) {
    return [];
  }
  return String(rawFiles)
    .split(',')
    .map((file) => file.trim())
    .filter(Boolean)
    .map((file) => relative(process.cwd(), resolve(process.cwd(), file)) || '.');
}

function projectCommand() {
  console.log(resolveProjectName());
}

function contextCommand(args) {
  const project = resolveProjectName();
  const task = resolveTaskSummary(args);
  const file = args.file ? relative(process.cwd(), resolve(process.cwd(), args.file)) || '.' : '';

  console.log('Automatic context injection checklist:');
  printList('', [
    `Resolve project as \`${project}\`.`,
    'Call `reqall:upsert_project` and store `project_id`.',
    `Call \`reqall:search\` using task/query \`${task || 'current task'}\`${file ? ` and file \`${file}\`` : ''}.`,
    'Call `reqall:list_records` with `status: "open"`.',
    'Call `reqall:get_record` for the top relevant records when details matter.',
    'If changing tracked behavior, call `reqall:list_links` and `reqall:impact`.',
  ]);
}

function preEditCommand(args) {
  if (!args.file) {
    fail('`pre-edit` requires --file <path>.');
  }

  const project = resolveProjectName();
  const file = relative(process.cwd(), resolve(process.cwd(), args.file)) || '.';
  const task = resolveTaskSummary(args);

  console.log('Pre-edit Reqall bootstrap:');
  printList('', [
    `Project: \`${project}\``,
    `Target file: \`${file}\``,
    `Task summary: \`${task || 'current change'}\``,
    'Search Reqall for this file/component before editing.',
    'Inspect open records related to this path or subsystem.',
    'Bring forward any linked tests, specs, follow-ups, and unresolved issues before making changes.',
  ]);
}

function documentCommand(args) {
  const files = normalizeFiles(args.files);
  const tool = args.tool || 'tool';
  const summary = args.summary || 'No summary provided.';

  console.log('Incremental documentation checklist:');
  printList('', [
    `Tool/event: \`${tool}\``,
    `Summary: ${summary}`,
    `Touched files: ${files.length > 0 ? files.map((file) => `\`${file}\``).join(', ') : 'none supplied'}`,
    'Draft concise Reqall record payloads for completed implementation, tests, and follow-ups.',
    'Capture unresolved failures as open issue/todo records.',
    'Link related records when the changed files share a component or decision.',
  ]);
}

function persistCommand(args) {
  const project = resolveProjectName();
  const task = resolveTaskSummary(args);

  console.log('Final persistence checklist:');
  printList('', [
    `Project: \`${project}\``,
    `Task summary: \`${task || 'current task'}\``,
    'Enumerate all completed work items from this turn.',
    'Upsert resolved issue/todo/arch records for completed work.',
    'Persist verification as `kind=test`.',
    `Persist follow-ups${args['follow-up'] ? `: ${args['follow-up']}` : ' if any remain unresolved'}.`,
    `Persist test/build evidence${args.tests ? `: ${args.tests}` : ''}.`,
    'List records again to sanity-check what remains open.',
  ]);
}

function reviewCommand(args) {
  const scope = args.scope || 'open';
  const project = resolveProjectName();

  console.log('Review workflow checklist:');
  printList('', [
    `Project: \`${project}\``,
    `Scope: \`${scope}\``,
    'List open or recent records in Reqall.',
    'Open the most relevant records for detailed review.',
    'Resolve/archive stale records and link related active work.',
    'Capture any new follow-up records discovered during review.',
  ]);
}

function main() {
  const argv = process.argv.slice(2);
  if (argv.length === 0 || argv[0] === '--help' || argv[0] === '-h') {
    usage();
    return;
  }

  const args = parseArgs(argv);
  const command = args._[0];

  if (command === 'project') return projectCommand();
  if (command === 'context') return contextCommand(args);
  if (command === 'pre-edit') return preEditCommand(args);
  if (command === 'document') return documentCommand(args);
  if (command === 'persist') return persistCommand(args);
  if (command === 'review') return reviewCommand(args);

  fail(`Unknown command: ${command}`);
}

main();
