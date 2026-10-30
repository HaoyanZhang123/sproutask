#!/usr/bin/env node
/**
 * Student payload launcher (A1).
 *
 * Starts the fixed DSH web runtime from the packaged tree with an isolated
 * DSH_HOME/data root, waits for the loopback URL, verifies the education
 * status endpoint, then opens an Edge `--app` window. The DSH child is killed
 * when Edge exits (or on Ctrl+C / parent exit).
 *
 * No model call is made by the launcher. The API key, if present in the
 * inherited environment, is passed through to DSH only; it is never printed.
 *
 * Usage (normally called by launcher.cmd):
 *   node app/runtime/scripts/start-student-web.mjs --home <DSH_HOME> --out <log-dir>
 */

import { closeSync, existsSync, mkdirSync, openSync, readFileSync, writeFileSync } from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(here, '..', '..');
const payloadRoot = path.resolve(appRoot, '..');
const dshBin = path.join(appRoot, 'node_modules', '@deepseek-ai', 'dsh', 'lib', 'bin.js');
const nodeExe = process.execPath;

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === '--no-edge') {
      args['no-edge'] = true;
    } else if (value.startsWith('--')) {
      const next = argv[index + 1];
      args[value.slice(2)] = next;
      index += 1;
    }
  }
  return args;
}

function freePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      const port = typeof address === 'object' && address !== null ? address.port : 0;
      server.close(() => resolve(port));
    });
  });
}

function waitForUrl(stdoutFile, child, timeoutMs) {
  return new Promise((resolve, reject) => {
    const started = Date.now();
    const timer = setInterval(() => {
      if (child.exitCode !== null) {
        clearInterval(timer);
        reject(new Error(`DSH exited early with code ${child.exitCode}`));
        return;
      }
      if (existsSync(stdoutFile)) {
        const line = readFileSync(stdoutFile, 'utf8')
          .split(/\r?\n/)
          .find((entry) => entry.startsWith('dsh web:'));
        if (line !== undefined) {
          clearInterval(timer);
          resolve(line.replace(/^dsh web:\s*/, '').trim());
          return;
        }
      }
      if (Date.now() - started > timeoutMs) {
        clearInterval(timer);
        reject(new Error(`timed out waiting for DSH web URL (${timeoutMs} ms)`));
      }
    }, 250);
  });
}

function findEdge() {
  const candidates = [
    process.env['EDGE_PATH'],
    path.join(process.env['ProgramFiles(x86)'] ?? '', 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
    path.join(process.env['ProgramFiles'] ?? '', 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
    path.join(process.env['LOCALAPPDATA'] ?? '', 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
  ].filter((value) => typeof value === 'string' && value.length > 0);
  return candidates.find((candidate) => existsSync(candidate)) ?? null;
}

function killTree(pid) {
  if (pid === undefined || pid === null) return;
  spawn('taskkill', ['/PID', String(pid), '/T', '/F'], { stdio: 'ignore', windowsHide: true });
}

const args = parseArgs(process.argv.slice(2));
const home = args.home === undefined ? null : path.resolve(args.home);
const out = args.out === undefined ? path.join(home ?? '.', 'logs') : path.resolve(args.out);
if (home === null || !existsSync(path.join(home, 'profiles', 'edu-web', 'package.json'))) {
  console.error('student launcher: DSH_HOME profile is missing; run setup-education-home.mjs first');
  process.exit(2);
}
if (!existsSync(dshBin)) {
  console.error(`student launcher: packaged DSH runtime is missing: ${dshBin}`);
  process.exit(3);
}
mkdirSync(out, { recursive: true });
const dataRoot = process.env['EDU_DATA_ROOT'] ?? path.join(home, '..', 'learner-data');
mkdirSync(dataRoot, { recursive: true });

// The payload removes the office packages. Disable their bundle rows so the
// profile does not log a failed import on every start.
const profilePatch = path.join(home, 'profiles', 'edu-web', 'cordis.patch.yml');
if (existsSync(profilePatch)) {
  let patch = readFileSync(profilePatch, 'utf8');
  for (const row of ['office-to-pdf', 'skill-office']) {
    if (!patch.includes(`- id: ${row}`)) {
      patch += `
- id: ${row}
  disabled: true
`;
    }
  }
  writeFileSync(profilePatch, patch, 'utf8');
}

const UNPROTECT_KEY_SCRIPT = [
  "$ErrorActionPreference='Stop'",
  'Add-Type -AssemblyName System.Security',
  '$b64=[Console]::In.ReadToEnd()',
  '$p=[Convert]::FromBase64String($b64)',
  '$b=[Security.Cryptography.ProtectedData]::Unprotect($p,$null,[Security.Cryptography.DataProtectionScope]::CurrentUser)',
  '[Text.Encoding]::UTF8.GetString($b)',
].join(';');

/** Read the DPAPI-protected key without ever printing or returning it to a log. */
function readStoredModelKey() {
  const root = process.env['SPROUTASK_DATA_ROOT'] ?? dataRoot;
  const file = path.join(root, 'secrets', 'model-key.dat');
  if (!existsSync(file)) return null;
  try {
    const encrypted = readFileSync(file).toString('utf8');
    const systemRoot = process.env['SystemRoot'] ?? process.env['windir'] ?? 'C:\\Windows';
    const absolutePowerShell = path.join(systemRoot, 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe');
    const powerShell = existsSync(absolutePowerShell) ? absolutePowerShell : 'powershell.exe';
    const result = spawnSync(powerShell, ['-NoProfile', '-NonInteractive', '-Command', UNPROTECT_KEY_SCRIPT], {
      input: encrypted,
      encoding: 'utf8',
      maxBuffer: 1024 * 1024,
      windowsHide: true,
    });
    if (result.status !== 0) return null;
    const key = result.stdout.trim();
    return key.length > 0 ? key : null;
  } catch {
    return null;
  }
}

const env = { ...process.env };
for (const name of Object.keys(env)) {
  if (/^(DSH_|DEEPSEEK_|ANTHROPIC_|OPENAI_)/i.test(name)) delete env[name];
}
env.DSH_HOME = home;
env.EDU_DATA_ROOT = dataRoot;
env.EDU_RUNTIME_LOG = path.join(out, 'runtime.jsonl');
env.DSH_DISABLE_UPDATE_CHECK = '1';
env.DSH_TELEMETRY_DISABLED = '1';
env.DEEPSEEK_API_KEY = process.env['DEEPSEEK_API_KEY'] || readStoredModelKey() || '';

const stdoutFile = path.join(out, 'stdout.log');
const stderrFile = path.join(out, 'stderr.log');

let child = null;
let edge = null;
let stopped = false;
let selectedPort = null;
let url = null;
let startedAt = 0;

function shutdown() {
  if (stopped) return;
  stopped = true;
  try {
    if (edge !== null && edge.exitCode === null) killTree(edge.pid);
  } catch {
    /* ignore cleanup errors */
  }
  try {
    if (child !== null && child.exitCode === null) killTree(child.pid);
  } catch {
    /* ignore cleanup errors */
  }
}

process.on('SIGINT', () => {
  shutdown();
  process.exit(0);
});
process.on('SIGTERM', () => {
  shutdown();
  process.exit(0);
});
process.on('exit', shutdown);

async function startDsh() {
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const port = await freePort();
    const stdoutFd = openSync(stdoutFile, 'w');
    const stderrFd = openSync(stderrFile, 'w');
    startedAt = Date.now();
    child = spawn(nodeExe, [dshBin, '--profile', 'edu-web', '--no-open', '--port', String(port)], {
      cwd: appRoot,
      env,
      stdio: ['ignore', stdoutFd, stderrFd],
      windowsHide: true,
    });
    closeSync(stdoutFd);
    closeSync(stderrFd);
    try {
      const ready = await waitForUrl(stdoutFile, child, 90_000);
      selectedPort = port;
      child.on('exit', () => {
        if (!stopped) shutdown();
      });
      return ready;
    } catch (error) {
      const stderr = existsSync(stderrFile) ? readFileSync(stderrFile, 'utf8') : '';
      if (!stderr.includes('EACCES') && attempt >= 1) throw error;
      if (child.exitCode === null) killTree(child.pid);
      if (attempt === 5) throw error;
    }
  }
  throw new Error('no usable loopback port after retries');
}

async function status(urlValue) {
  const tokenUrl = new URL(urlValue);
  const tokenResponse = await fetch(tokenUrl, { redirect: 'manual' });
  const cookie = tokenResponse.headers.get('set-cookie');
  const base = tokenUrl.origin;
  const headers = cookie === null ? {} : { cookie };
  const statusResponse = await fetch(`${base}/edu/api/status`, { headers });
  const body = await statusResponse.text();
  return { tokenHttpStatus: tokenResponse.status, statusHttpStatus: statusResponse.status, body };
}

try {
  url = await startDsh();
  const health = await status(url);
  const meta = {
    schemaVersion: 1,
    kind: 'sproutask-student-launch',
    startedAt: new Date(startedAt).toISOString(),
    elapsedMs: Date.now() - startedAt,
    pid: child.pid,
    port: selectedPort,
    url: url.replace(/token=[^&]+/, 'token=<redacted>'),
    home,
    dataRoot,
    stdout: stdoutFile,
    stderr: stderrFile,
    tokenHttpStatus: health.tokenHttpStatus,
    statusHttpStatus: health.statusHttpStatus,
    statusBody: health.body.slice(0, 4000),
    edge: null,
  };

  if (args['no-edge'] !== true) {
    const edgePath = findEdge();
    if (edgePath === null) {
      meta.edge = { opened: false, reason: 'Microsoft Edge not found' };
    } else {
      const edgeProfile = path.join(process.env['SPROUTASK_DATA_ROOT'] ?? path.join(home, '..'), 'edge-profile');
      mkdirSync(edgeProfile, { recursive: true });
      edge = spawn(
        edgePath,
        [
          `--app=${url}`,
          `--user-data-dir=${edgeProfile}`,
          '--no-first-run',
          '--no-default-browser-check',
          '--disable-features=msEdgeSidebarV2',
        ],
        { stdio: 'ignore', windowsHide: false },
      );
      meta.edge = { opened: true, path: edgePath, pid: edge.pid };
      edge.on('exit', () => {
        if (!stopped) shutdown();
        process.exit(0);
      });
      if (edge.exitCode !== null) {
        meta.edge = { opened: false, reason: `Edge exited immediately (${edge.exitCode})` };
      }
    }
  }

  writeFileSync(path.join(out, 'launch-meta.json'), `${JSON.stringify(meta, null, 2)}
`, 'utf8');
  console.log(JSON.stringify(meta, null, 2));
  if (args['no-edge'] === true) {
    await new Promise(() => {
      /* keep the service alive for a headless smoke; stop with SIGTERM/taskkill */
    });
  }
  if (edge !== null && edge.exitCode === null) {
    await new Promise(() => {
      /* keep the launcher alive until Edge exits */
    });
  }
} catch (error) {
  shutdown();
  console.error(`student launcher failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}

