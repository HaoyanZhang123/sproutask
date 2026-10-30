/**
 * T13 draft/restart probe: create an unsubmitted draft, then inspect it after a
 * same-data-root restart. Real product UI and real host draft endpoint.
 */
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const url = process.argv[2];
const stage = process.argv[3] ?? 'before';
const out = path.resolve(process.argv[4] ?? `education/.local/evidence/T13/product-ui/draft-${stage}`);
mkdirSync(out, { recursive: true });
const profile = path.join(out, 'chrome-profile');
mkdirSync(profile, { recursive: true });
const chrome = spawn(
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  ['--headless=new','--disable-gpu','--no-first-run','--no-default-browser-check','--hide-scrollbars','--window-size=1280,900',`--user-data-dir=${profile}`,'--remote-debugging-port=0','about:blank'],
  { stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true },
);
let stderr = '';
chrome.stderr.on('data', (c) => (stderr += c.toString('utf8')));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function getPort() {
  const file = path.join(profile, 'DevToolsActivePort');
  for (let i = 0; i < 300; i += 1) {
    if (existsSync(file)) {
      const n = readFileSync(file, 'utf8').split(/\r?\n/)[0];
      if (n && /^\d+$/.test(n.trim())) return Number(n.trim());
    }
    await sleep(100);
  }
  throw new Error('no DevToolsActivePort');
}
function cdp(socket) {
  const ws = new WebSocket(socket);
  let id = 1;
  const pending = new Map();
  ws.addEventListener('message', (e) => {
    const m = JSON.parse(e.data);
    if (m.id && pending.has(m.id)) {
      const { resolve, reject } = pending.get(m.id);
      pending.delete(m.id);
      m.error ? reject(new Error(JSON.stringify(m.error))) : resolve(m.result);
    }
  });
  const ready = new Promise((resolve, reject) => {
    ws.addEventListener('open', resolve, { once: true });
    ws.addEventListener('error', reject, { once: true });
  });
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const n = id++;
    pending.set(n, { resolve, reject });
    ws.send(JSON.stringify({ id: n, method, params }));
  });
  return { ready, send, close: () => ws.close() };
}
try {
  const p = await getPort();
  const targets = await fetch(`http://127.0.0.1:${p}/json/list`).then((r) => r.json());
  const page = targets.find((t) => t.type === 'page');
  const c = cdp(page.webSocketDebuggerUrl);
  await c.ready;
  await c.send('Page.enable');
  await c.send('Runtime.enable');
  const ev = async (expr) => (await c.send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true })).result?.value;
  const body = async () => (await ev('document.body ? document.body.innerText : ""')) ?? '';
  const click = async (needle) => ev(`(() => { const q=${JSON.stringify(needle)}; const els=[...document.querySelectorAll('button,a,[role="button"]')]; const el=els.find(x=>(x.textContent||'').trim()===q)||els.find(x=>(x.textContent||'').includes(q)); if(!el)return 'not-found'; el.click(); return 'clicked'; })()`);
  const checked = async () => JSON.parse((await ev(`JSON.stringify([...document.querySelectorAll('input')].filter((x)=>x.checked).map((x)=>x.value))`)) ?? '[]');
  const draft = async () => {
    const text = await ev(`fetch('/edu/api/g1/draft?conceptId=concept.bio7a.observation.purpose-object&mode=learn&activityId=activity.bio7a.c2.choice-purpose',{credentials:'same-origin'}).then(r=>r.text())`);
    try { return JSON.parse(text); } catch { return { raw: text }; }
  };
  await c.send('Page.navigate', { url });
  await sleep(2500);
  const clicked = await click('继续上次');
  await sleep(2500);
  let selected = null;
  if (stage === 'before') {
    selected = await ev(`(() => { const el=document.querySelector('input[value="option.c"]'); if(!el)return 'not-found'; el.click(); return 'selected'; })()`);
    await sleep(2500);
  }
  const text = await body();
  const shot = await c.send('Page.captureScreenshot', { format: 'png' });
  writeFileSync(path.join(out, 'page.png'), Buffer.from(shot.data, 'base64'));
  const result = { stage, url, clicked, selected, checked: await checked(), draft: await draft(), hasSaved: text.includes('草稿已保存在本机'), body: text.slice(0, 4000), stderr: stderr.slice(-1500), at: new Date().toISOString() };
  writeFileSync(path.join(out, 'draft-restart.json'), `${JSON.stringify(result, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify({ stage, clicked, selected, checked: result.checked, draft: result.draft, hasSaved: result.hasSaved }));
  c.close();
} catch (error) {
  writeFileSync(path.join(out, 'draft-restart-error.json'), `${JSON.stringify({ error: error.message, stderr: stderr.slice(-2000) }, null, 2)}\n`, 'utf8');
  console.error(error.message);
  process.exitCode = 1;
} finally {
  chrome.kill('SIGKILL');
}
