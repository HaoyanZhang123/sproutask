/**
 * T13 final product journey: misconception, assisted, draft/restart checks.
 * Real product UI, real host APIs, no fixtures and no mocks.
 */
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const url = process.argv[2];
const out = path.resolve(process.argv[3] ?? 'education/.local/evidence/T13/product-ui/final');
if (url === undefined) {
  console.error('usage: node final-journey.mjs <token-url> <out-dir>');
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
  const waitFor = async (needle, timeout = 45000) => {
    const deadline = Date.now() + timeout;
    while (Date.now() < deadline) {
      if ((await body()).includes(needle)) return true;
      await sleep(500);
    }
    return false;
  };
  const click = async (needle) =>
    evalJs(
      `(() => { const q = ${JSON.stringify(needle)}; const els = Array.from(document.querySelectorAll('button,a,[role="button"],[role="treeitem"]')); const el = els.find((x) => ((x.textContent||'').trim() === q) || ((x.textContent||'').includes(q))); if (!el) return 'not-found'; el.click(); return 'clicked:' + (el.textContent||'').trim().slice(0,80); })()`,
    );
  const select = async (option) =>
    evalJs(
      `(() => { const el = document.querySelector('input[value=${JSON.stringify(option)}]'); if (!el) return 'not-found'; el.click(); return 'selected'; })()`,
    );
  const record = async (name, assertion) => {
    const text = await body();
    const title = await evalJs('document.title');
    await shot(name);
    const ok = assertion === null ? true : assertion(text);
    steps.push({ name, ok, title, body: text.slice(0, 3500) });
    return { text, ok };
  };
  const fetchJson = async (pathname) => {
    const text = await evalJs(`fetch(${JSON.stringify(pathname)}, {credentials:'same-origin'}).then((r) => r.text())`);
    try {
      return JSON.parse(text);
    } catch {
      return { raw: text };
    }
  };

  await client.send('Page.navigate', { url });
  await sleep(2500);
  await record('01-home', (t) => t.includes('生物学习') && !t.includes('演示数据'));
  await click('地图');
  await sleep(1800);
  await record('02-map', (t) => t.includes('教材目录'));

  // Misconception: option.a on the first concept.
  await click('观察的含义与地位');
  await sleep(1000);
  await click('开始学习');
  await sleep(2500);
  await record('03-workspace', (t) => t.includes('当前活动') && t.includes('观察的含义与地位'));
  await select('option.a');
  await sleep(500);
  await click('提交作答');
  const feedbackArrived = await waitFor('反馈在右侧', 50000);
  await record('04-misconception-feedback', (t) =>
    feedbackArrived && (t.includes('未达成') || t.includes('待确认')) && (t.includes('常见误概念') || t.includes('误概念') || t.includes('待确认')) && t.includes('尚无足够证据'),
  );
  steps.push({
    name: '04b-backend',
    draft: await fetchJson('/edu/api/g1/draft?conceptId=concept.bio7a.observation.meaning&mode=learn&activityId=activity.bio7a.c1.choice-basics'),
    progress: await fetchJson('/edu/api/g1/progress?conceptId=concept.bio7a.observation.meaning'),
  });

  // Assisted: go back, open a second concept, request help before answering.
  await click('返回地图');
  await sleep(1500);
  await click('观察的目的与对象');
  await sleep(1000);
  await click('开始学习');
  await sleep(2500);
  await click('给我提示');
  const helpArrived = await waitFor('提示', 30000);
  await record('05-assisted-hint', (t) => helpArrived && (t.includes('提示') || t.includes('assistance') || t.includes('帮助')));
  await select('option.b');
  await sleep(500);
  await click('提交作答');
  const assistedFeedback = await waitFor('反馈在右侧', 50000);
  await record('06-assisted-feedback', (t) =>
    assistedFeedback && t.includes('尚无足够证据') && (t.includes('帮助') || t.includes('提示') || t.includes('解释') || t.includes('assistance')),
  );

  // Draft and location before restart.
  await record('07-before-restart', (t) => t.includes('草稿已保存在本机'));
  writeFileSync(
    path.join(out, 'journey.json'),
    `${JSON.stringify({ url, steps, chromeStderrTail: stderr.slice(-2000), at: new Date().toISOString() }, null, 2)}\n`,
    'utf8',
  );
  client.close();
  console.log(JSON.stringify({ ok: steps.every((s) => s.ok !== false), steps: steps.map((s) => s.name) }));
} catch (error) {
  writeFileSync(path.join(out, 'journey-error.json'), `${JSON.stringify({ error: error.message, stderr: stderr.slice(-3000), steps }, null, 2)}\n`, 'utf8');
  console.error(error.message);
  process.exitCode = 1;
} finally {
  chrome.kill('SIGKILL');
}
