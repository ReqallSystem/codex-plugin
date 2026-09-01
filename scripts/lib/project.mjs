import process from 'node:process';
import { execFileSync } from 'node:child_process';
import os from 'node:os';

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

function safeExec(args, cwd = process.cwd()) {
  try {
    return execFileSync(args[0], args.slice(1), {
      cwd,
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
    // Last two path segments — parity with the server's normalization and
    // dup_key (gitlab subgroups: grp/sub/proj -> sub/proj).
    const segs = new URL(trimmed).pathname.split('/').filter(Boolean);
    if (segs.length >= 2) return segs.slice(-2).join('/');
    return segs[0] ?? '';
  } catch {
    return '';
  }
}

/**
 * The reserved machine project for this box and OS user:
 * `.machine/<hostname>/<os-user>`. REQALL_MACHINE_NAME overrides the hostname
 * segment (CI/containers with ephemeral hostnames). The server auto-creates
 * `.user` and links it parent-> this project on first upsert.
 */
export function machineProjectName(env = process.env) {
  const clean = (seg) => String(seg ?? '').trim().replace(/[\\/\s]+/g, '-').replace(/^-+|-+$/g, '') || 'unknown';
  const host = env.REQALL_MACHINE_NAME && env.REQALL_MACHINE_NAME.trim()
    ? env.REQALL_MACHINE_NAME.trim()
    : os.hostname().split('.')[0];
  let user = 'unknown';
  try {
    user = os.userInfo().username || 'unknown';
  } catch {
    // no passwd entry
  }
  return `.machine/${clean(host).toLowerCase()}/${clean(user)}`;
}

export function resolveProjectName(cwd = process.cwd(), env = process.env) {
  if (env.REQALL_PROJECT_NAME) {
    return env.REQALL_PROJECT_NAME;
  }

  const remoteUrl = safeExec(['git', 'remote', 'get-url', 'origin'], cwd);
  const normalizedRemote = normalizeRemote(remoteUrl);
  if (normalizedRemote) {
    return normalizedRemote;
  }

  // Non-repo sessions are machine memory — never the directory basename
  // (which minted junk projects like "dev" or UUID worktree names).
  return machineProjectName(env);
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
