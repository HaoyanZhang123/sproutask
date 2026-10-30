#!/usr/bin/env node
/**
 * Starts the isolated education web root with the fixed DSH runtime.
 *
 * - random loopback port, isolated DSH_HOME/work/data under .local/cache/T01;
 * - the API key is read from education/.local/secrets/deepseek.key and passed
 *   only through the child environment (never printed, never a CLI argument);
 * - writes stdout/stderr/meta under the requested evidence directory;
 * - returns as soon as the ready URL is printed; stop with stop-education-web.
 */

import { closeSync, existsSync, mkdirSync, openSync, readFileSync, writeFileSync } from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { parseArgs } from './setup-education-home.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const educationRoot = path.resolve(here, '..', '..');
const dshBin = path.join(
  educationRoot,
  'probes',
  'runtime',
  'node_modules',
  '@deepseek-ai',
  'dsh',
  'lib',
  'bin.js',
);
const keyFile = path.join(educationRoot, '.local', 'secrets', 'deepseek.key');

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
        reject(new Error(`timed out waiting for the DSH web URL (${timeoutMs} ms)`));
      }
    }, 250);
  });
}

export async function startEducationWeb(options) {
  const home = path.resolve(options.home);
  const work = path.resolve(options.work ?? path.join(home, 'work'));
  const out = path.resolve(options.out);
  const profile = options.profile ?? 'edu-web';
  mkdirSync(home, { recursive: true });
  mkdirSync(work, { recursive: true });
  mkdirSync(out, { recursive: true });
  if (!existsSync(dshBin)) throw new Error(`fixed DSH runtime not found: ${dshBin}`);
  const port = options.port ?? (await freePort());

  const env = { ...process.env };
  for (const name of Object.keys(env)) {
    if (/^(DEEPSEEK_|DSH_|ANTHROPIC_|OPENAI_)/i.test(name)) delete env[name];
  }
  env.DSH_HOME = home;
  env.EDU_RUNTIME_LOG = path.join(out, 'runtime.jsonl');
  env.EDU_DATA_ROOT = path.join(home, 'edu-data');
  env.DSH_DISABLE_UPDATE_CHECK = '1';
  env.DEEPSEEK_API_KEY = '';
  if (existsSync(keyFile)) {
    env.DEEPSEEK_API_KEY = readFileSync(keyFile, 'utf8').trim();
  }

  const stdoutFile = path.join(out, 'stdout.log');
  const stderrFile = path.join(out, 'stderr.log');
  const stdoutFd = openSync(stdoutFile, 'w');
  const stderrFd = openSync(stderrFile, 'w');
  const child = spawn(process.execPath, [dshBin, '--profile', profile, '--no-open', '--port', String(port)], {
    cwd: work,
    env,
    stdio: ['ignore', stdoutFd, stderrFd],
    windowsHide: true,
    detached: true,
  });
  closeSync(stdoutFd);
  closeSync(stderrFd);
  child.unref();
  const url = await waitForUrl(stdoutFile, child, options.timeoutMs ?? 90000);
  const meta = {
    profile,
    pid: child.pid,
    port,
    host: '127.0.0.1',
    url,
    startedAt: new Date().toISOString(),
    home,
    work,
    dataRoot: env.EDU_DATA_ROOT,
    stdout: stdoutFile,
    stderr: stderrFile,
    runtimeLog: env.EDU_RUNTIME_LOG,
    authKeyPresent: env.DEEPSEEK_API_KEY.length > 0,
  };
  writeFileSync(path.join(out, 'web-meta.json'), `${JSON.stringify(meta, null, 2)}\n`, 'utf8');
  return meta;
}

if (process.argv[1] !== undefined && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = parseArgs();
  if (typeof args.home !== 'string' || typeof args.out !== 'string') {
    console.error(
      'usage: node scripts/start-education-web.mjs --home <abs home> --out <abs evidence dir> [--port N] [--work <dir>]',
    );
    process.exit(2);
  }
  try {
    const meta = await startEducationWeb({
      home: args.home,
      work: typeof args.work === 'string' ? args.work : undefined,
      out: args.out,
      port: typeof args.port === 'string' ? Number(args.port) : undefined,
      profile: typeof args.profile === 'string' ? args.profile : undefined,
    });
    console.log(JSON.stringify(meta, null, 2));
  } catch (error) {
    console.error(`start-education-web failed: ${error.message}`);
    process.exit(1);
  }
}
