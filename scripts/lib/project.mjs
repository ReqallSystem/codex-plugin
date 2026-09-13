import { resolveProjectBinding } from './project-policy.mjs';
export { machineProjectName, extractProjectHint as promptProject } from './project-policy.mjs';

export function resolveProjectName(cwd = process.cwd(), env = process.env, prompt = '', selected = '') {
  return resolveProjectBinding(cwd, env, prompt, selected).name;
}

export function parseArgs(argv, booleanFlags = []) {
  const args = { _: [] };
  const allowedBooleanFlags = new Set(booleanFlags);
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith('--')) {
      args._.push(token);
      continue;
    }

    const key = token.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith('--')) {
      if (!allowedBooleanFlags.has(key)) {
        throw new Error(`Missing value for --${key}`);
      }
      args[key] = true;
      continue;
    }

    args[key] = next;
    i += 1;
  }
  return args;
}

export function resolveTaskSummary(args) {
  if (typeof args.task === 'string' && args.task.trim()) {
    return args.task.trim();
  }
  if (typeof args.query === 'string' && args.query.trim()) {
    return args.query.trim();
  }
  if (args._.length > 1) {
    return args._.slice(1).join(' ').trim();
  }
  return '';
}
