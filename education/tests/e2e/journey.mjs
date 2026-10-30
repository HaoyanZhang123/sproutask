/**
 * T13 product G1 UI driver (CDP). Navigates the real education shell, records
 * each step's title/body/actions/screenshot/backend seq and asserts key text.
 */
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const url = process.argv[2];
const out = path.resolve(process.argv[3] ?? 'education/.local/evidence/T13/product-ui/journey');
if (url === undefined) {
  console.error('usage: node journey.mjs <token-url> <out-dir>');
  process.exit(2);
}
mkdirSync(out, { recursive: true });
const profile = path.join(out, 'chrome-profile');
mkdirSync(profile, { recursive: true });
const chrome = spawn(
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  [
    '--headless=new',
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    '--hide-scrollbars',
    '--window-size=1280,900',
    `--user-data-dir=${profile}`,
    '--remote-debugging-port=0',
    'about:blank',
  ],
  { stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true },
);
let stderr = '';
chrome.stderr.on('data', (c) => (stderr += c.toString('utf8')));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function port() {
  const file = path.join(profile, 'DevToolsActivePort');
  for (let i = 0; i < 300; i += 1) {
    if (existsSync(file)) {
      const n = readFileSync(file, 'utf8').split(/\r?\n/)[0];
      if (n !== undefined && /^\d+$/.test(n.trim())) return Number(n.trim());
    }
    await sleep(100);
  }
  throw new Error('no DevToolsActivePort');
}
function cdp(socket) {
  const ws = new WebSocket(socket);
  let id = 1;
  const pending = new Map();
  ws.addEventListener('message', (event) => {
    const m = JSON.parse(event.data);
    if (m.id && pending.has(m.id)) {
      const { resolve, reject } = pending.get(m.id);
      pending.delete(m.id);
      if (m.error) reject(new Error(JSON.stringify(m.error)));
      else resolve(m.result);
    }
  });
  const ready = new Promise((resolve, reject) => {
    ws.addEventListener('open', resolve, { once: true });
    ws.addEventListener('error', reject, { once: true });
  });
  const send = (method, params = {}) =>
    new Promise((resolve, reject) => {
      const n = id++;
      pending.set(n, { resolve, reject });
      ws.send(JSON.stringify({ id: n, method, params }));
    });
  return { ready, send, close: () => ws.close() };
}

const steps = [];
try {
  const p = await port();
  const targets = await fetch(`http://127.0.0.1:${String(p)}/json/list`).then((r) => r.json());
  const page = targets.find((t) => t.type === 'page');
  const client = cdp(page.webSocketDebuggerUrl);
  await client.ready;
  await client.send('Page.enable');
  await client.send('Runtime.enable');
  const evalJs = async (expression) => {
    const r = await client.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    return r.result?.value;
  };
  const body = async () => (await evalJs('document.body ? document.body.innerText : ""')) ?? '';
  const shot = async (name) => {
    const s = await client.send('Page.captureScreenshot', { format: 'png' });
    writeFileSync(path.join(out, `${name}.png`), Buffer.from(s.data, 'base64'));
  };
  const record = async (name, assertion) => {
    const text = await body();
    const title = await evalJs('document.title');
    const actions = JSON.parse(
      (await evalJs(
        `JSON.stringify(Array.from(document.querySelectorAll('button,a,[role="button"],[role="treeitem"],input,textarea')).map((el) => ({ tag: el.tagName, text: (el.textContent || el.value || '').trim().slice(0, 80) })).filter((x) => x.text).slice(0, 300))`,
      )) ?? '[]',
    );
    await shot(name);
    const ok = assertion === null ? true : assertion(text);
    steps.push({ name, ok, title, assertion: assertion === null ? null : assertion.toString(), body: text.slice(0, 2500), actions });
    return { text, ok, actions };
  };
  const click = async (needle) =>
    evalJs(
      `(() => { const q = ${JSON.stringify(needle)}; const els = Array.from(document.querySelectorAll('button,a,[role="button"],[role="treeitem"]')); const el = els.find((x) => ((x.textContent||'').trim() === q) || ((x.textContent||'').includes(q))); if (!el) return 'not-found'; el.click(); return 'clicked:' + (el.textContent||'').trim().slice(0,80); })()`,
    );
  const setValue = async (selector, value) =>
    evalJs(
      `(() => { const el = document.querySelector(${JSON.stringify(selector)}); if (!el) return 'not-found'; el.focus(); el.value = ${JSON.stringify(value)}; el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); return 'set'; })()`,
    );

  await client.send('Page.navigate', { url });
  await sleep(2500);
  await record('01-home', (t) => t.includes('生物学习') && !t.includes('演示数据'));
  await click('教材库');
  await sleep(1500);
  await record('02-library', (t) => t.includes('待核实候选') && t.includes('146 页'));
  await click('地图');
  await sleep(1500);
  const map = await record('03-map', (t) => t.includes('教材目录') && t.includes('观察周边环境中的生物'));
  const conceptAction = map.actions.find((a) => a.text.includes('观察的含义与地位'));
  steps.push({ name: '03b-concept-action', found: conceptAction ?? null });
  if (conceptAction !== undefined) {
    await click('观察的含义与地位');
    await sleep(1200);
    await record('04-concept-detail', (t) => t.includes('观察的含义与地位'));
    await click('开始学习');
    await sleep(3000);
    await record('05-workspace', (t) => t.includes('工作区'));
  }
  if (conceptAction === undefined) {
    const sectionClick = await click('第一节 观察周边环境中的生物');
    steps.push({ name: '03c-section-click', result: sectionClick });
    await sleep(1000);
    const after = await record('03d-map-expanded', (t) => t.includes('观察周边环境中的生物'));
    steps.push({ name: '03e-actions-after', actions: after.actions.slice(0, 80) });
  }
  if (conceptAction !== undefined) {
    await evalJs('(() => { const el = document.querySelector(\'input[value=\"option.b\"]\'); if (!el) return \'no-option\'; el.click(); return \'option-b\'; })()');
    await sleep(500);
    await click('提交作答');
    await sleep(30000);
    await record('06-correct-feedback', (t) => t.includes('反馈') || t.includes('已达成') || t.includes('等待'));
    await click('解释一下');
    await sleep(5000);
    await record('07-explain', (t) => t.includes('解释') || t.includes('助手'));
  }
  if (conceptAction !== undefined) {
    await click('改文字再试');
    await sleep(1200);
    await evalJs('(() => { const el = document.querySelector(\'input[value=\"option.a\"]\'); if (!el) return \'no-option\'; el.click(); return \'option-a\'; })()');
    await sleep(500);
    await click('提交作答');
    await sleep(30000);
    await record('08-misconception', (t) => t.includes('反馈') || t.includes('未达成') || t.includes('待确认'));
  }
  writeFileSync(path.join(out, 'journey.json'), `${JSON.stringify({ url, steps, chromeStderrTail: stderr.slice(-2000), at: new Date().toISOString() }, null, 2)}\n`, 'utf8');
  client.close();
  console.log(JSON.stringify({ ok: steps.every((s) => s.ok !== false), steps: steps.map((s) => s.name) }));
} catch (error) {
  writeFileSync(path.join(out, 'journey-error.json'), `${JSON.stringify({ error: error.message, stderr: stderr.slice(-3000), steps }, null, 2)}\n`, 'utf8');
  console.error(error.message);
  process.exitCode = 1;
} finally {
  chrome.kill('SIGKILL');
}

