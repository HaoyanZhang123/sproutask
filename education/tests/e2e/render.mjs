/**
 * T13 e2e renderer: one headless Chromium page -> DOM text, title, key markers
 * and a PNG. Chrome is started with --remote-debugging-port=0 and the real port
 * is read from DevToolsActivePort, which avoids the free-port race seen with the
 * T00 probe helper on this machine.
 */
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

function arg(name, fallback) {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? fallback : process.argv[index + 1];
}

const url = arg('url');
const out = path.resolve(arg('out', 'education/.local/evidence/T13/render'));
const waitMs = Number(arg('wait-ms', '8000'));
const targetPath = arg('path', null);
const clickText = arg('click-text', null);
const browser = arg('browser', 'C:/Program Files/Google/Chrome/Application/chrome.exe');
if (url === undefined) {
  console.error('usage: node render.mjs --url <url> --out <dir>');
  process.exit(2);
}
if (!existsSync(browser)) {
  console.error(`browser not found: ${browser}`);
  process.exit(2);
}
mkdirSync(out, { recursive: true });
const profile = path.join(out, 'chrome-profile');
mkdirSync(profile, { recursive: true });

const chrome = spawn(
  browser,
  [
    '--headless=new',
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-background-networking',
    '--hide-scrollbars',
    '--window-size=1280,800',
    `--user-data-dir=${profile}`,
    '--remote-debugging-port=0',
    'about:blank',
  ],
  { stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true },
);
let stderr = '';
chrome.stderr.on('data', (chunk) => {
  stderr += chunk.toString('utf8');
});

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function devtoolsPort() {
  const file = path.join(profile, 'DevToolsActivePort');
  const deadline = Date.now() + 30000;
  while (Date.now() < deadline) {
    if (existsSync(file)) {
      const first = readFileSync(file, 'utf8').split(/\r?\n/)[0];
      if (first !== undefined && /^\d+$/.test(first.trim())) return Number(first.trim());
    }
    await sleep(100);
  }
  throw new Error('DevToolsActivePort did not appear');
}

function cdp(socketUrl) {
  const ws = new WebSocket(socketUrl);
  let nextId = 1;
  const pending = new Map();
  ws.addEventListener('message', (event) => {
    const message = JSON.parse(event.data);
    if (message.id && pending.has(message.id)) {
      const { resolve, reject } = pending.get(message.id);
      pending.delete(message.id);
      if (message.error) reject(new Error(JSON.stringify(message.error)));
      else resolve(message.result);
    }
  });
  const ready = new Promise((resolve, reject) => {
    ws.addEventListener('open', resolve, { once: true });
    ws.addEventListener('error', reject, { once: true });
  });
  const send = (method, params = {}) =>
    new Promise((resolve, reject) => {
      const id = nextId++;
      pending.set(id, { resolve, reject });
      ws.send(JSON.stringify({ id, method, params }));
    });
  return { ready, send, close: () => ws.close() };
}

try {
  const port = await devtoolsPort();
  const list = await fetch(`http://127.0.0.1:${String(port)}/json/list`).then((r) => r.json());
  const page = list.find((target) => target.type === 'page');
  if (page === undefined) throw new Error('no page target');
  const client = cdp(page.webSocketDebuggerUrl);
  await client.ready;
  await client.send('Page.enable');
  await client.send('Runtime.enable');
  await client.send('Page.navigate', { url });
  if (targetPath !== null) {
    await sleep(1500);
    await client.send('Page.navigate', { url: new URL(targetPath, url).toString() });
  }
  await sleep(1500);
  if (clickText !== null) {
    const expression = `(() => { const wanted = ${JSON.stringify(clickText)}; const nodes = Array.from(document.querySelectorAll('a,button')); const hit = nodes.find((el) => (el.textContent || '').trim() === wanted) || nodes.find((el) => (el.textContent || '').includes(wanted)); if (hit) hit.click(); return hit ? 'clicked' : 'not-found'; })()`;
    await client.send('Runtime.evaluate', { expression, returnByValue: true });
    await sleep(1200);
  }
  const deadline = Date.now() + waitMs;
  let bodyText = '';
  while (Date.now() < deadline) {
    await sleep(300);
    const result = await client.send('Runtime.evaluate', {
      expression: 'document.body ? document.body.innerText : ""',
      returnByValue: true,
    });
    bodyText = result.result?.value ?? '';
    if (bodyText.includes('鏁欒偛') || bodyText.includes('涓婚〉')) break;
  }
  const title = await client.send('Runtime.evaluate', { expression: 'document.title', returnByValue: true });
  const marker = await client.send('Runtime.evaluate', {
    expression:
      'JSON.stringify({root: !!document.getElementById("edu-education-root"), boot: typeof globalThis.__DSH_BOOT__, ready: typeof globalThis.__DSH_BOOT_READY__, scripts: document.scripts.length})',
    returnByValue: true,
  });
  const href = await client.send('Runtime.evaluate', { expression: 'location.href', returnByValue: true });
  const shot = await client.send('Page.captureScreenshot', { format: 'png' });
  writeFileSync(path.join(out, 'page.png'), Buffer.from(shot.data, 'base64'));
  writeFileSync(path.join(out, 'page-dom.txt'), bodyText, 'utf8');
  writeFileSync(
    path.join(out, 'page-meta.json'),
    `${JSON.stringify(
      {
        url,
        href: href.result?.value,
        title: title.result?.value,
        marker: JSON.parse(marker.result?.value ?? '{}'),
        bodyText: bodyText.slice(0, 6000),
        chromeStderrTail: stderr.slice(-2000),
        at: new Date().toISOString(),
      },
      null,
      2,
    )}\n`,
    'utf8',
  );
  client.close();
  console.log(JSON.stringify({ ok: true, title: title.result?.value }));
} catch (error) {
  writeFileSync(path.join(out, 'render-error.json'), `${JSON.stringify({ error: error.message, stderr: stderr.slice(-3000) }, null, 2)}\n`, 'utf8');
  console.error(error.message);
  process.exitCode = 1;
} finally {
  chrome.kill('SIGKILL');
}


