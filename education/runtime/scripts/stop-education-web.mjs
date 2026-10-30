#!/usr/bin/env node
/**
 * Stops the education web instance started by start-education-web.mjs and
 * verifies the loopback port is closed. Never touches any other DSH process:
 * it only kills the pid from the written meta.json.
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { parseArgs } from './setup-education-home.mjs';

function portOpen(port) {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host: '127.0.0.1', port, timeout: 700 });
    socket.once('connect', () => {
      socket.destroy();
      resolve(true);
    });
    socket.once('timeout', () => {
      socket.destroy();
      resolve(false);
    });
    socket.once('error', () => resolve(false));
  });
}

if (process.argv[1] !== undefined && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = parseArgs();
  if (typeof args.out !== 'string') {
    console.error('usage: node scripts/stop-education-web.mjs --out <evidence dir>');
    process.exit(2);
  }
  const metaPath = path.join(path.resolve(args.out), 'web-meta.json');
  if (!existsSync(metaPath)) {
    console.error(`no web-meta.json in ${args.out}`);
    process.exit(2);
  }
  const meta = JSON.parse(readFileSync(metaPath, 'utf8'));
  const pid = Number(meta.pid);
  let killed = false;
  if (Number.isInteger(pid) && pid > 0) {
    const result = spawnSync('taskkill', ['/PID', String(pid), '/T', '/F'], {
      windowsHide: true,
      stdio: 'ignore',
    });
    killed = result.status === 0;
  }
  let closed = false;
  for (let attempt = 0; attempt < 20; attempt += 1) {
    closed = !(await portOpen(Number(meta.port)));
    if (closed) break;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  const stop = {
    killed,
    pid,
    port: meta.port,
    portStillOpen: !closed,
    stoppedAt: new Date().toISOString(),
  };
  writeFileSync(path.join(args.out, 'web-stop.json'), `${JSON.stringify(stop, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify(stop, null, 2));
  process.exit(closed ? 0 : 1);
}
