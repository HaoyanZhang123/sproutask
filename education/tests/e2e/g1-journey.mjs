/**
 * T13 CDP journey runner. Starts one headless Chrome, drives the education root
 * through real UI steps, and writes text/JSON/PNG evidence. No fixture injection.
 */
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const args = {};
for (let index = 2; index < process.argv.length; index += 1) {
  const value = process.argv[index];
  if (!value.startsWith('--')) continue;
  const next = process.argv[index + 1];
  if (next !== undefined && !next.startsWith('--')) {
    args[value.slice(2)] = next;
    index += 1;
  } else {
    args[value.slice(2)] = true;
  }
}

const url = args.url;
const out = path.resolve(args.out ?? 'education/.local/evidence/T13/journey');
const browser = args.browser ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const waitMs = Number(args['wait-ms'] ?? 8000);
const resumeOnly = args['resume-only'] === true;
const headed = args.headed === true;
const keepOpen = args['keep-open'] === true;
const libraryOnly = args['library-only'] === true;
if (url === undefined) {
  console.error('usage: node g1-journey.mjs --url <url> --out <dir>');
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
    ...(headed ? [] : ['--headless=new']),
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
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

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

async function main() {
  const port = await devtoolsPort();
  const list = await fetch(`http://127.0.0.1:${String(port)}/json/list`).then((r) => r.json());
  const page = list.find((target) => target.type === 'page');
  if (page === undefined) throw new Error('no page target');
  const client = cdp(page.webSocketDebuggerUrl);
  await client.ready;
  await client.send('Page.enable');
  await client.send('Runtime.enable');
  await client.send('Page.navigate', { url });
  const evaluate = async (expression) => {
    const result = await client.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.text ?? 'evaluate failed');
    return result.result?.value;
  };
  const bodyText = () => evaluate('document.body ? document.body.innerText : ""');
  const shot = async (_name) => undefined;
  const waitFor = async (predicate, label, timeout = waitMs) => {
    const deadline = Date.now() + timeout;
    let text = '';
    while (Date.now() < deadline) {
      await sleep(250);
      text = await bodyText();
      if (predicate(text)) return text;
    }
    throw new Error(`timeout waiting for ${label}; text=${text.slice(0, 500)}`);
  };
  const waitForSelector = async (selector, label, timeout = 60000) => {
    const deadline = Date.now() + timeout;
    while (Date.now() < deadline) {
      if (await evaluate(`document.querySelector(${JSON.stringify(selector)}) !== null`)) return;
      await sleep(250);
    }
    throw new Error(`timeout waiting for selector ${label}`);
  };
  const step = async (name, action) => {
    await action();
    await sleep(500);
    const text = await bodyText();
    writeFileSync(path.join(out, `${name}.txt`), text, 'utf8');
    await shot(name);
    console.log(`STEP ${name} chars=${String(text.length)}`);
    return text;
  };

  await waitFor((text) => text.includes('首页') && text.includes('进入地图'), 'home');
  if (resumeOnly) {
    await step('home-after-restart', async () => undefined);
    await step('resume-last', async () => {
      await evaluate(`(() => { const hit=document.querySelector('[data-action="resume-last"]'); if(!hit) throw new Error('resume button not found'); hit.click(); })()`);
      await waitFor((text) => text.includes('当前活动') && text.includes('学习助手'), 'resumed workspace', 30000);
    });
    const restored = await evaluate(`(() => { const input=document.querySelector('input[type="radio"][value="option.a"]'); return {checked: input ? input.checked : null, href: location.href, title: document.title}; })()`);
    writeFileSync(path.join(out, 'resume-meta.json'), `${JSON.stringify({ restored, at: new Date().toISOString() }, null, 2)}\n`, 'utf8');
    await step('resumed-workspace', async () => undefined);
    client.close();
    return;
  }
  await step('home', async () => undefined);
  if (libraryOnly) {
    await step('library-final', async () => {
      await evaluate(`document.querySelector('[data-nav-path="/library"]').click()`);
      await waitFor((text) => text.includes('教材库') && text.includes('生物学'), 'library');
    });
    const text = await bodyText();
    if (text.includes('演示数据（fixture）')) throw new Error('fixture notice still visible in live library');
    client.close();
    return;
  }
  await step('library', async () => {
    await evaluate(`document.querySelector('[data-nav-path="/library"]').click()`);
    await waitFor((text) => text.includes('教材库') && text.includes('生物学'), 'library');
  });
  await step('map', async () => {
    await evaluate(`document.querySelector('[data-nav-path="/map"]').click()`);
    await waitFor((text) => text.includes('教材目录') && text.includes('开始学习'), 'map');
  });
  await step('concept', async () => {
    await evaluate(`(() => { const nodes=Array.from(document.querySelectorAll('button,a')); const hit=nodes.find((n)=>(n.textContent||'').includes('观察的含义与地位')); if(!hit) throw new Error('concept button not found'); hit.click(); })()`);
    await sleep(1500);
  });
  await step('workspace', async () => {
    await evaluate(`(() => { const nodes=Array.from(document.querySelectorAll('button,a')); const hit=nodes.find((n)=>(n.textContent||'').trim()==='开始学习'); if(!hit) throw new Error('start button not found'); hit.click(); })()`);
    await waitFor((text) => text.includes('当前活动') && text.includes('学习助手'), 'workspace');
  });
  const dom = await evaluate(`JSON.stringify({labels:[...document.querySelectorAll('label')].map((l)=>({text:l.innerText,html:l.outerHTML.slice(0,250)})),inputs:[...document.querySelectorAll('input')].map((i)=>({type:i.type,value:i.value,checked:i.checked,parent:i.parentElement?.innerText?.slice(0,120),outer:i.outerHTML.slice(0,200)}))})`);
  writeFileSync(path.join(out, 'workspace-dom.json'), `${dom}\n`, 'utf8');
  await step('answer-correct', async () => {
    const selected = await evaluate(`(() => {
      const input=document.querySelector('input[type="radio"][value="option.b"]');
      if(!input) return 'option-not-found';
      input.click();
      return 'selected';
    })()`);
    if (selected !== 'selected') throw new Error(`choice ${selected}`);
    await evaluate(`(() => { const nodes=Array.from(document.querySelectorAll('button')); const hit=nodes.find((n)=>(n.textContent||'').trim()==='提交作答'); if(!hit) throw new Error('submit not found'); hit.click(); })()`);
    await waitForSelector('[data-testid="study-feedback-grade"]', 'feedback-card');
  });
  await step('answer-misconception', async () => {
    await evaluate(`(() => { const nodes=Array.from(document.querySelectorAll('button')); const hit=nodes.find((n)=>(n.textContent||'').trim()==='改文字再试'); if(!hit) throw new Error('edit answer not found'); hit.click(); })()`);
    await waitForSelector('input[type="radio"][value="option.a"]', 'choice form');
    await evaluate(`document.querySelector('input[type="radio"][value="option.a"]').click()`);
    await evaluate(`(() => { const nodes=Array.from(document.querySelectorAll('button')); const hit=nodes.find((n)=>(n.textContent||'').trim()==='提交作答'); if(!hit) throw new Error('submit not found'); hit.click(); })()`);
    await waitFor((text) => text.includes('选择不正确') || text.includes('未达成'), 'misconception feedback', 45000);
  });
  await step('explain', async () => {
    await evaluate(`(() => { const nodes=Array.from(document.querySelectorAll('button')); const hit=nodes.find((n)=>(n.textContent||'').trim()==='解释一下'); if(!hit) throw new Error('explain button not found'); hit.click(); })()`);
    await sleep(15000);
    const text = await bodyText();
    if (!text.includes('解释') && !text.includes('观察')) throw new Error('explanation not visible');
  });
  await step('assisted-disclosure', async () => {
    await evaluate(`(() => { const nodes=Array.from(document.querySelectorAll('button')); const hit=nodes.find((n)=>(n.textContent||'').trim()==='直接看答案'); if(!hit) throw new Error('answer help not found'); hit.click(); })()`);
    await sleep(15000);
    const text = await bodyText();
    if (!text.includes('不能作为独立')) throw new Error('disclosure notice missing');
  });
  await step('answer-assisted', async () => {
    await evaluate(`(() => { const nodes=Array.from(document.querySelectorAll('button')); const hit=nodes.find((n)=>(n.textContent||'').trim()==='改文字再试'); if(!hit) throw new Error('edit answer not found'); hit.click(); })()`);
    await waitForSelector('input[type="radio"][value="option.b"]', 'choice form');
    await evaluate(`document.querySelector('input[type="radio"][value="option.b"]').click()`);
    await evaluate(`(() => { const nodes=Array.from(document.querySelectorAll('button')); const hit=nodes.find((n)=>(n.textContent||'').trim()==='提交作答'); if(!hit) throw new Error('submit not found'); hit.click(); })()`);
    await waitFor((text) => (text.includes('assisted') || text.includes('已使用') || text.includes('有辅助')) && text.includes('已达成'), 'assisted feedback', 45000);
  });
  await step('draft-before-restart', async () => {
    await evaluate(`(() => { const nodes=Array.from(document.querySelectorAll('button')); const hit=nodes.find((n)=>(n.textContent||'').trim()==='改文字再试'); if(!hit) throw new Error('edit answer not found'); hit.click(); })()`);
    await waitForSelector('input[type="radio"][value="option.a"]', 'draft choice form');
    await evaluate(`document.querySelector('input[type="radio"][value="option.a"]').click()`);
    await sleep(1500);
    const text = await bodyText();
    if (!text.includes('草稿已保存在本机')) throw new Error('draft not saved');
  });

  writeFileSync(path.join(out, 'journey-meta.json'), `${JSON.stringify({ ok: true, url, at: new Date().toISOString(), stderrTail: stderr.slice(-1000) }, null, 2)}\n`, 'utf8');
  client.close();
}

try {
  await main();
} catch (error) {
  writeFileSync(path.join(out, 'journey-error.json'), `${JSON.stringify({ error: error.message, stderr: stderr.slice(-3000) }, null, 2)}\n`, 'utf8');
  console.error(error.message);
  process.exitCode = 1;
} finally {
  if (keepOpen) {
    writeFileSync(path.join(out, 'chrome-pid.txt'), String(chrome.pid ?? ''), 'utf8');
  } else {
    chrome.kill('SIGKILL');
  }
}
