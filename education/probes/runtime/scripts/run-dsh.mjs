/**
 * T00 probe — run one isolated DSH CLI invocation and capture evidence.
 *
 * Usage: node scripts/run-dsh.mjs --home <DSH_HOME> --work <workdir> --out <dir> -- <dsh args...>
 *
 * Guarantees:
 *   - the child inherits no DEEPSEEK_ or DSH_ variable from this shell;
 *   - cwd is the isolated work dir (so no repository `.env` is discovered);
 *   - DSH_HOME points at the probe home;
 *   - stdout/stderr/exit code/duration land in <out>.
 */
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const probeRoot = resolve(here, '..');
const dshBin = join(probeRoot, 'node_modules', '@deepseek-ai', 'dsh', 'lib', 'bin.js');

function arg(name) {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? undefined : process.argv[index + 1];
}

const home = arg('home');
const work = arg('work');
const out = arg('out');
const timeoutMs = Number(arg('timeout-ms') ?? 120000);
const separator = process.argv.indexOf('--');
const dshArgs = separator === -1 ? [] : process.argv.slice(separator + 1);

if (!home || !work || !out) {
  console.error('usage: run-dsh.mjs --home <dir> --work <dir> --out <dir> [--timeout-ms N] -- <dsh args...>');
  process.exit(2);
}
mkdirSync(out, { recursive: true });
mkdirSync(work, { recursive: true });
// Fresh evidence per run: the probe plugin appends its request log here.
writeFileSync(join(out, 'llm.jsonl'), '', 'utf8');

const childEnv = { ...process.env };
// Explicit opt-in: a caller may keep exactly the named credential variables
// (comma separated). They are passed by name and value only through the child
// environment; nothing here logs values.
const keepEnvNames = (arg('keep-env') ?? '')
  .split(',')
  .map((name) => name.trim())
  .filter(Boolean);
const kept = {};
for (const name of keepEnvNames) {
  if (childEnv[name] !== undefined) kept[name] = childEnv[name];
}
const removed = [];
for (const key of Object.keys(childEnv)) {
  if (/^DEEPSEEK_/i.test(key) || /^DSH_/i.test(key) || /^ANTHROPIC_/i.test(key) || /^OPENAI_/i.test(key)) {
    removed.push(key);
    delete childEnv[key];
  }
}
for (const [name, value] of Object.entries(kept)) childEnv[name] = value;
childEnv.DSH_HOME = resolve(home);
childEnv.EDU_PROBE_LOG = join(out, 'llm.jsonl');
// Keep the probe's own crash diagnostics away from the user's data roots.
childEnv.DSH_DISABLE_UPDATE_CHECK = '1';

const startedAt = new Date();
const child = spawn(process.execPath, [dshBin, ...dshArgs], {
  cwd: resolve(work),
  env: childEnv,
  stdio: ['ignore', 'pipe', 'pipe'],
  windowsHide: true,
});

let stdout = '';
let stderr = '';
child.stdout.on('data', (chunk) => {
  stdout += chunk.toString('utf8');
});
child.stderr.on('data', (chunk) => {
  stderr += chunk.toString('utf8');
});

let timedOut = false;
const timer = setTimeout(() => {
  timedOut = true;
  child.kill('SIGKILL');
}, timeoutMs);

child.on('close', (code, signal) => {
  clearTimeout(timer);
  const meta = {
    argv: [dshBin, ...dshArgs],
    cwd: resolve(work),
    home: resolve(home),
    removedEnvKeys: removed,
    keptEnvKeys: Object.keys(kept),
    startedAt: startedAt.toISOString(),
    finishedAt: new Date().toISOString(),
    durationMs: Date.now() - startedAt.getTime(),
    exitCode: code,
    signal,
    timedOut,
  };
  writeFileSync(join(out, 'stdout.log'), stdout, 'utf8');
  writeFileSync(join(out, 'stderr.log'), stderr, 'utf8');
  writeFileSync(join(out, 'meta.json'), `${JSON.stringify(meta, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify({ exitCode: code, signal, timedOut, out: resolve(out) }));
  process.exit(0);
});
