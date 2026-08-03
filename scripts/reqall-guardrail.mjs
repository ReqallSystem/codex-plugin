#!/usr/bin/env node

import {
  EXIT_INVALID_EVIDENCE,
  beginGuardrail,
  evaluateGuardrail,
  listGuardrails,
  loadGuardrail,
  recordToolEvidence,
  relativeStateLocation,
  reqallOperation,
  resetGuardrail,
} from './lib/guardrail-state.mjs';
import { parseArgs, resolveProjectName } from './lib/project.mjs';

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
  console.log('  reqall-guardrail begin [--task "text"] [--project "name"] [--session id] [--turn id] [--trivial]');
  console.log('  reqall-guardrail mark-context --tool name --tool-use-id id [--session id] [--turn id]  # diagnostic only');
  console.log('  reqall-guardrail mark-document --tool name --tool-use-id id [--session id] [--turn id] # diagnostic only');
  console.log('  reqall-guardrail mark-persist --tool name --tool-use-id id [--session id] [--turn id]  # diagnostic only');
  console.log('  reqall-guardrail check [--session id] [--turn id]');
  console.log('  reqall-guardrail status [--session id] [--turn id] [--all]');
  console.log('  reqall-guardrail reset [--session id] [--turn id]');
  console.log();
  console.log('Exit codes for `check`: 0 pass or declared degraded mode, 10 no begin, 11 context missing, 12 persistence missing, 13 stale.');
  console.log('Exit code 14 means a mark command did not provide concrete diagnostic metadata.');
  console.log('Only trusted PostToolUse hook evidence can satisfy `check`; CLI marks never qualify.');
}

function identityArgs(args) {
  return {
    sessionId: args.session || process.env.REQALL_SESSION_ID || process.env.CODEX_SESSION_ID,
    turnId: args.turn || process.env.REQALL_TURN_ID || process.env.CODEX_TURN_ID,
    task: args.task || '',
    cwd: process.cwd(),
    env: process.env,
  };
}

function begin(args) {
  const project = typeof args.project === 'string' && args.project.trim()
    ? args.project.trim()
    : resolveProjectName();
  const state = beginGuardrail({
    ...identityArgs(args),
    project,
    nonTrivial: args.trivial !== true,
  });
  ok(`${state.nonTrivial ? 'Started non-trivial' : 'Started trivial'} task guardrail for ${project}.`);
  ok(`State: ${relativeStateLocation()}`);
}

function mark(args, phase) {
  const toolName = args.tool || (args.operation ? `reqall:${args.operation}` : '');
  const toolUseId = args['tool-use-id'] || args['operation-id'];
  const operation = reqallOperation(toolName) || (phase === 'document' && toolName ? 'document' : '');
  if (!toolName || !toolUseId || !operation) {
    fail(
      'Concrete evidence requires --tool <Reqall tool name> and --tool-use-id <actual tool-call id>; free-form --evidence is only descriptive and cannot satisfy the guardrail.',
      EXIT_INVALID_EVIDENCE,
    );
  }
  const state = recordToolEvidence(
    { ...identityArgs(args), allowCurrent: !args.turn },
    {
      phase,
      operation,
      toolName,
      toolUseId,
      success: true,
      source: 'cli',
    },
  );
  if (!state) fail('No active task state. Run `begin` first.', 10);
  const evaluation = evaluateGuardrail(state);
  ok(`Recorded diagnostic ${phase} metadata for ${operation} (${toolUseId}).`);
  ok('CLI marks never satisfy the guardrail; only trusted PostToolUse evidence qualifies.');
  if (!evaluation.ok) ok(`Still required: ${evaluation.reason}.`);
}

function check(args) {
  const state = loadGuardrail({ ...identityArgs(args), allowCurrent: !args.turn });
  const evaluation = evaluateGuardrail(state);
  if (!evaluation.ok) fail(`Guardrail check failed: ${evaluation.reason}.`, evaluation.code);
  if (evaluation.degraded) {
    ok(`Guardrail completed in degraded mode (${evaluation.reason}); disclose that Reqall context and persistence did not run.`);
    return;
  }
  ok(`Guardrail check passed (${evaluation.reason}).`);
}

function status(args) {
  if (args.all) {
    console.log(JSON.stringify(listGuardrails(), null, 2));
    return;
  }
  const state = loadGuardrail({ ...identityArgs(args), allowCurrent: !args.turn });
  if (!state) {
    ok('No active guardrail state.');
    return;
  }
  console.log(JSON.stringify(state, null, 2));
}

function reset(args) {
  const options = { ...identityArgs(args), allowCurrent: !args.turn };
  const state = loadGuardrail(options);
  if (!state) {
    ok('No active guardrail state.');
    return;
  }
  resetGuardrail(options);
  ok('Reset guardrail state for the selected task.');
}

function main() {
  const argv = process.argv.slice(2);
  if (argv.length === 0 || argv[0] === '--help' || argv[0] === '-h') {
    usage();
    return;
  }

  let args;
  try {
    args = parseArgs(argv, ['trivial', 'all']);
  } catch (error) {
    fail(error.message, 1);
  }
  const command = args._[0];
  if (command === 'begin') return begin(args);
  if (command === 'mark-context') return mark(args, 'context');
  if (command === 'mark-document') return mark(args, 'document');
  if (command === 'mark-persist') return mark(args, 'persist');
  if (command === 'check' || command === 'check-exit') return check(args);
  if (command === 'status') return status(args);
  if (command === 'reset') return reset(args);
  fail(`Unknown command: ${command}`, 1);
}

main();
