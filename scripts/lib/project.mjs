import process from 'node:process';
import { execFileSync } from 'node:child_process';
import { basename } from 'node:path';

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

function safeExec(args) {
  try {
    return execFileSync(args[0], args.slice(1), {
      cwd: process.cwd(),
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    return '';
  }
}

function normalizeRemote(remoteUrl) {
  if (!remoteUrl) {
    return '';
  }

  const trimmed = remoteUrl.replace(/\.git$/, '');
  const sshMatch = trimmed.match(/[:/]([^/:]+\/[^/]+)$/);
  if (sshMatch) {
    return sshMatch[1];
  }

  try {
    const url = new URL(trimmed);
    return url.pathname.replace(/^\//, '');
  } catch {
    return '';
  }
}

export function resolveProjectName() {
  if (process.env.REQALL_PROJECT_NAME) {
    return process.env.REQALL_PROJECT_NAME;
  }

  const remoteUrl = safeExec(['git', 'remote', 'get-url', 'origin']);
  const normalizedRemote = normalizeRemote(remoteUrl);
  if (normalizedRemote) {
    return normalizedRemote;
  }

  return basename(process.cwd());
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
