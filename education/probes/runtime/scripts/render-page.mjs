/**
 * T00 probe — render one URL in headless Chrome over the DevTools protocol and
 * capture the resulting DOM text + a screenshot.
 *
 * Usage: node scripts/render-page.mjs --url <url> --out <dir> [--wait-ms 6000]
 *
 * Uses only Node built-ins (global fetch + global WebSocket) and the installed
 * Chrome/Edge binary; no npm dependency is added.
 */
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { createServer } from 'node:net';

function arg(name) {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? undefined : process.argv[index + 1];
}

const url = arg('url');
const out = arg('out');
const waitMs = Number(arg('wait-ms') ?? 6000);
const browser = arg('browser') ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe';
if (!url || !out) {
  console.error('usage: render-page.mjs --url <url> --out <dir> [--wait-ms N] [--browser <exe>]');
  process.exit(2);
}
if (!existsSync(browser)) {
  console.error(`browser not found: ${browser}`);
  process.exit(2);
}
mkdirSync(out, { recursive: true });

async function freePort() {
  return await new Promise((resolve, reject) => {
    const server = createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      server.close(() => resolve(port));
    });
  });
}

async function waitForDevTools(port, deadline) {
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/json/list`);
      if (response.ok) return await response.json();
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error('devtools endpoint did not become ready');
}

function cdp(socketUrl) {
  const ws = new WebSocket(socketUrl);
  let nextId = 1;
  const pending = new Map();
  const events = [];
  ws.addEventListener('message', (event) => {
    const message = JSON.parse(event.data);
    if (message.id && pending.has(message.id)) {
      const { resolve, reject } = pending.get(message.id);
      pending.delete(message.id);
      if (message.error) reject(new Error(JSON.stringify(message.error)));
      else resolve(message.result);
    } else if (message.method) {
      events.push(message);
    }
  });
  const ready = new Promise((resolve, reject) => {
    ws.addEventListener('open', resolve);
    ws.addEventListener('error', reject);
  });
  const send = (method, params = {}) =>
    new Promise((resolve, reject) => {
      const id = nextId++;
      pending.set(id, { resolve, reject });
      ws.send(JSON.stringify({ id, method, params }));
    });
  return { ready, send, events, close: () => ws.close() };
}

const port = await freePort();
const userDataDir = join(out, 'chrome-user-data');
mkdirSync(userDataDir, { recursive: true });
const chrome = spawn(
  browser,
  [
    '--headless=new',
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-background-networking',
    '--disable-component-update',
    '--hide-scrollbars',
    '--window-size=1280,800',
    `--user-data-dir=${userDataDir}`,
    `--remote-debugging-port=${port}`,
    'about:blank',
  ],
  { stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true },
);
let browserStderr = '';
chrome.stderr.on('data', (chunk) => {
  browserStderr += chunk.toString('utf8');
});

try {
  const targets = await waitForDevTools(port, Date.now() + 20000);
  const page = targets.find((target) => target.type === 'page');
  if (!page) throw new Error('no page target');
  const client = cdp(page.webSocketDebuggerUrl);
  await client.ready;
  await client.send('Page.enable');
  await client.send('Runtime.enable');
  await client.send('Page.navigate', { url });
  // Wait for the shell to boot: the probe root marker or the boot-ready promise.
  const deadline = Date.now() + waitMs;
  let bodyText = '';
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 300));
    const result = await client.send('Runtime.evaluate', {
      expression: 'document.body ? document.body.innerText : ""',
      returnByValue: true,
    });
    bodyText = result.result?.value ?? '';
    if (bodyText.includes('EDU PROBE ROOT') || bodyText.includes('DEEPSEEK')) break;
  }
  const title = await client.send('Runtime.evaluate', { expression: 'document.title', returnByValue: true });
  const marker = await client.send('Runtime.evaluate', {
    expression:
      'JSON.stringify({root: !!document.getElementById("edu-probe-root"), boot: typeof globalThis.__DSH_BOOT__, ready: typeof globalThis.__DSH_BOOT_READY__, scripts: document.scripts.length})',
    returnByValue: true,
  });
  const shot = await client.send('Page.captureScreenshot', { format: 'png' });
  writeFileSync(join(out, 'page.png'), Buffer.from(shot.data, 'base64'));
  writeFileSync(join(out, 'page-dom.txt'), bodyText, 'utf8');
  writeFileSync(
    join(out, 'page-meta.json'),
    `${JSON.stringify(
      {
        url,
        title: title.result?.value,
        marker: JSON.parse(marker.result?.value ?? '{}'),
        bodyText: bodyText.slice(0, 4000),
        chromeStderrTail: browserStderr.slice(-2000),
        at: new Date().toISOString(),
      },
      null,
      2,
    )}\n`,
    'utf8',
  );
  client.close();
  console.log(JSON.stringify({ ok: true, title: title.result?.value, hasRoot: bodyText.includes('EDU PROBE ROOT') }));
} finally {
  chrome.kill('SIGKILL');
}
