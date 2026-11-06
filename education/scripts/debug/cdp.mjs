// @ts-check
/**
 * 极小的 WebView2 / Chromium DevTools Protocol 客户端（只用 Node 内建能力）。
 *
 * 只做调试台需要的事：连页面、执行脚本、点击、等元素、截图、收集控制台错误。
 * 不引入依赖：Node 24 自带全局 WebSocket。
 */
import { spawn } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync, existsSync, rmSync, cpSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

const sleep = (ms) => new Promise((done) => setTimeout(done, ms));

async function waitForJson(url, timeoutMs, label) {
  const deadline = Date.now() + timeoutMs;
  let last = '';
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.ok) return await response.json();
      last = `HTTP ${response.status}`;
    } catch (error) {
      last = error instanceof Error ? error.message : String(error);
    }
    await sleep(400);
  }
  throw new Error(`等待 ${label} 超时（${last}）`);
}

export class CdpPage {
  /** @param {WebSocket} socket */
  constructor(socket) {
    this.socket = socket;
    this.nextId = 1;
    /** @type {Map<number, {resolve: (v: any) => void, reject: (e: Error) => void}>} */
    this.pending = new Map();
    /** @type {{type: string, text: string}[]} */
    this.consoleErrors = [];
    /** @type {string[]} */
    this.exceptions = [];
    /** @type {{url: string, status: number}[]} */
    this.failedRequests = [];
    socket.addEventListener('message', (event) => {
      const message = JSON.parse(String(event.data));
      if (typeof message.id === 'number') {
        const entry = this.pending.get(message.id);
        if (entry === undefined) return;
        this.pending.delete(message.id);
        if (message.error) entry.reject(new Error(message.error.message));
        else entry.resolve(message.result);
        return;
      }
      this.#handleEvent(message);
    });
  }

  #handleEvent(message) {
    if (message.method === 'Runtime.consoleAPICalled' && message.params.type === 'error') {
      const text = (message.params.args ?? [])
        .map((arg) => arg.value ?? arg.description ?? '')
        .join(' ')
        .slice(0, 400);
      this.consoleErrors.push({ type: 'console', text });
    }
    if (message.method === 'Runtime.exceptionThrown') {
      const details = message.params.exceptionDetails;
      this.exceptions.push(
        String(details?.exception?.description ?? details?.text ?? 'exception').slice(0, 400),
      );
    }
    if (message.method === 'Log.entryAdded' && message.params.entry.level === 'error') {
      this.consoleErrors.push({ type: 'log', text: String(message.params.entry.text ?? '').slice(0, 400) });
    }
    if (message.method === 'Network.responseReceived') {
      const { response } = message.params;
      if (typeof response.status === 'number' && response.status >= 400) {
        this.failedRequests.push({ url: String(response.url).slice(0, 200), status: response.status });
      }
    }
    if (message.method === 'Network.loadingFailed' && message.params.errorText !== 'net::ERR_ABORTED') {
      this.failedRequests.push({ url: 'loadingFailed', status: 0 });
    }
  }

  send(method, params = {}) {
    const id = this.nextId++;
    this.socket.send(JSON.stringify({ id, method, params }));
    return new Promise((resolvePromise, rejectPromise) => {
      this.pending.set(id, { resolve: resolvePromise, reject: rejectPromise });
      setTimeout(() => {
        if (this.pending.has(id)) {
          this.pending.delete(id);
          rejectPromise(new Error(`CDP 调用超时：${method}`));
        }
      }, 30_000);
    });
  }

  async enable() {
    await this.send('Runtime.enable');
    await this.send('Log.enable');
    await this.send('Page.enable');
    await this.send('Network.enable');
  }

  /** 在页面里求值；返回 JSON 可序列化结果。 */
  async evaluate(expression) {
    const result = await this.send('Runtime.evaluate', {
      expression,
      awaitPromise: true,
      returnByValue: true,
      expression_hash: undefined,
    });
    if (result.exceptionDetails) {
      throw new Error(`页面脚本异常：${result.exceptionDetails.text ?? ''} ${expression.slice(0, 80)}`);
    }
    return result.result?.value;
  }

  async waitFor(expression, { timeoutMs = 20_000, label = expression } = {}) {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      if (await this.evaluate(`Boolean(${expression})`).catch(() => false)) return true;
      await sleep(150);
    }
    throw new Error(`等待超时：${label}`);
  }

  /** 点击匹配到的第一个可见元素；找不到或不可点就抛错。 */
  async click(selector, { label } = {}) {
    const outcome = await this.evaluate(`(() => {
      const all = [...document.querySelectorAll(${JSON.stringify(selector)})];
      const target = all.find((el) => {
        const rect = el.getBoundingClientRect();
        const style = getComputedStyle(el);
        return rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.pointerEvents !== 'none' && !el.disabled;
      });
      if (!target) return { ok: false, reason: 'not-found', total: all.length };
      target.scrollIntoView({ block: 'center' });
      target.click();
      return { ok: true, text: (target.textContent || '').trim().slice(0, 40) };
    })()`);
    if (!outcome?.ok) {
      throw new Error(`点击失败（${label ?? selector}）：${outcome?.reason ?? 'unknown'}，匹配 ${outcome?.total ?? 0} 个`);
    }
    return outcome.text;
  }

  /** 按可见文字点击按钮（只匹配文字，不点第一个）。 */
  async clickText(text) {
    const outcome = await this.evaluate(`(() => {
      const wanted = ${JSON.stringify(text)};
      const visible = (el) => {
        const rect = el.getBoundingClientRect();
        const style = getComputedStyle(el);
        return rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.pointerEvents !== 'none';
      };
      const nodes = [...document.querySelectorAll('button, [role="button"], a')].filter(visible);
      const exact = nodes.find((el) => (el.textContent || '').trim() === wanted);
      const partial = nodes.find((el) => (el.textContent || '').trim().includes(wanted));
      const target = exact ?? partial;
      if (!target) return { ok: false, candidates: nodes.map((el) => (el.textContent || '').trim().slice(0, 16)) };
      if (target.disabled) return { ok: false, reason: 'disabled' };
      target.scrollIntoView({ block: 'center' });
      target.click();
      return { ok: true, text: (target.textContent || '').trim().slice(0, 40) };
    })()`);
    if (!outcome?.ok) {
      throw new Error(
        `按文字点击失败：${text}${outcome?.reason ? `（${outcome.reason}）` : ''}，候选：${JSON.stringify(outcome?.candidates ?? []).slice(0, 240)}`,
      );
    }
    return outcome.text;
  }

  /** 给输入框填值并触发 input/change（模拟真实输入，不依赖焦点）。 */
  async fill(selector, value) {
    const outcome = await this.evaluate(`(() => {
      const el = document.querySelector(${JSON.stringify(selector)});
      if (!el) return { ok: false, reason: 'not-found' };
      const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
      const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
      setter?.call(el, ${JSON.stringify(value)});
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
      return { ok: true };
    })()`);
    if (!outcome?.ok) throw new Error(`填写失败：${selector}`);
  }

  /** 选中一个单选项（按可见文字）。 */
  async choose(labelText) {
    const outcome = await this.evaluate(`(() => {
      const wanted = ${JSON.stringify(labelText)};
      const labels = [...document.querySelectorAll('label, .edu-choice, [data-testid*="option"]')];
      const match = labels.find((el) => (el.textContent || '').trim().includes(wanted));
      const input = match?.querySelector('input') ?? match;
      if (!input) return { ok: false };
      if (input instanceof HTMLInputElement) {
        input.click();
      } else {
        match.click();
      }
      return { ok: true, text: wanted };
    })()`);
    if (!outcome?.ok) throw new Error(`选项选择失败：${labelText}`);
  }

  /** 页面可见文字。 */
  text() {
    return this.evaluate('document.body.innerText').then((value) => String(value ?? ''));
  }

  /** 截图（物理像素：按显示器缩放比放大）。 */
  async screenshot(path, { scale = 2 } = {}) {
    const size = await this.evaluate(
      '({ width: window.innerWidth, height: window.innerHeight })',
    );
    const shot = await this.send('Page.captureScreenshot', {
      format: 'png',
      captureBeyondViewport: false,
      clip: { x: 0, y: 0, width: size.width, height: size.height, scale },
    });
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, Buffer.from(shot.data, 'base64'));
    return { path, width: Math.round(size.width * scale), height: Math.round(size.height * scale) };
  }

  close() {
    try {
      this.socket.close();
    } catch {
      /* already closed */
    }
  }
}

/**
 * 用隔离数据根启动已安装的芽问，并连上页面。
 * @param {{app: string, dataRoot: string, port: number, syncBundles?: string|null, keepData?: boolean, timeoutMs?: number}} options
 */
export async function launchApp(options) {
  const {
    app,
    dataRoot,
    port,
    syncBundles = null,
    keepData = false,
    secretsFrom = null,
    timeoutMs = 120_000,
  } = options;

  await killApp(app);

  if (!keepData && existsSync(dataRoot)) rmSync(dataRoot, { recursive: true, force: true });
  mkdirSync(dataRoot, { recursive: true });

  // 真实模型走查用：把 DPAPI 加密的 Key 复制进隔离根（同用户可解），
  // 学习记录仍然写进隔离目录，不碰用户真实数据。
  if (secretsFrom !== null && existsSync(secretsFrom)) {
    cpSync(secretsFrom, join(dataRoot, 'secrets'), { recursive: true });
  }

  if (syncBundles !== null) {
    for (const name of ['client-plugin', 'host-plugin']) {
      const from = join(syncBundles, name, 'lib');
      const to = join(dirname(app), 'app', 'runtime', name, 'lib');
      if (existsSync(from) && existsSync(to)) cpSync(from, to, { recursive: true });
    }
  }

  const child = spawn(app, [], {
    env: {
      ...process.env,
      SPROUTASK_DATA_ROOT: dataRoot,
      WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS: `--remote-debugging-port=${port}`,
    },
    stdio: 'ignore',
    detached: false,
  });

  const meta = join(dataRoot, 'logs', 'launch-meta.json');
  const deadline = Date.now() + timeoutMs;
  let status = 0;
  while (Date.now() < deadline) {
    await sleep(500);
    if (!existsSync(meta)) continue;
    try {
      const parsed = JSON.parse(readFileSync(meta, 'utf8'));
      status = Number(parsed.statusHttpStatus ?? 0);
      if (status === 200) break;
    } catch {
      /* 文件还在写 */
    }
  }
  if (status !== 200) {
    throw new Error(`本地服务未就绪：statusHttp=${status}（日志 ${join(dataRoot, 'logs')}）`);
  }

  const version = await waitForJson(`http://127.0.0.1:${port}/json/version`, 60_000, 'CDP');
  const targets = await waitForJson(`http://127.0.0.1:${port}/json/list`, 30_000, 'CDP targets');
  const page = (Array.isArray(targets) ? targets : []).find((entry) => entry.type === 'page');
  if (!page?.webSocketDebuggerUrl) throw new Error('没有可用的页面 target');

  const socket = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((ready, fail) => {
    socket.addEventListener('open', () => ready(null), { once: true });
    socket.addEventListener('error', () => fail(new Error('CDP WebSocket 连接失败')), {
      once: true,
    });
  });

  const cdp = new CdpPage(/** @type {WebSocket} */ (socket));
  await cdp.enable();
  await cdp.waitFor('document.readyState === "complete"', { label: '页面加载' });
  await sleep(600);

  return {
    cdp,
    child,
    browser: version.Browser,
    url: page.url,
    dataRoot,
    report: join(dataRoot, 'logs'),
    async close() {
      cdp.close();
      await killApp(app);
    },
  };
}

export async function killApp(app) {
  const { execFile } = await import('node:child_process');
  const run = (file, args) =>
    new Promise((done) => execFile(file, args, { windowsHide: true }, () => done(null)));
  const appDir = resolve(dirname(app));
  await run('taskkill.exe', ['/IM', 'SproutAsk.exe', '/T', '/F']).catch(() => {});
  await sleep(800);
  // 兜底：按安装目录清掉可能残留的 node 子进程（只动当前安装目录）。
  const ps = `
    Get-CimInstance Win32_Process |
      Where-Object { $_.Name -eq 'node.exe' -and $_.CommandLine -like '*${appDir.replace(/'/g, "''")}*' } |
      ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
  `;
  await run('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', ps]);
  await sleep(400);
}

/** 报告收集器：把步骤结果、断言、截图汇总成 JSON。 */
export function createReport(outDir) {
  mkdirSync(outDir, { recursive: true });
  const steps = [];
  return {
    steps,
    async step(name, run) {
      const startedAt = Date.now();
      try {
        const value = await run();
        steps.push({ name, ok: true, ms: Date.now() - startedAt });
        return value;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        steps.push({ name, ok: false, ms: Date.now() - startedAt, error: message });
        throw error;
      }
    },
    write(extra = {}) {
      const file = join(outDir, 'report.json');
      writeFileSync(
        file,
        `${JSON.stringify({ when: new Date().toISOString(), steps, ...extra }, null, 2)}\n`,
      );
      return file;
    },
  };
}

/** 学生界面禁词：出现即视为内部标识/开发术语泄漏。 */
export const FORBIDDEN_COPY = [
  { pattern: /tok\/s/, why: 'DSH 状态栏指标' },
  { pattern: /缓存命中/, why: 'DSH 状态栏指标' },
  { pattern: /·\s*\d+\s*步/, why: 'DSH 状态栏轮次' },
  { pattern: /activity\.[a-z0-9]/i, why: '内部活动标识' },
  { pattern: /concept\.[a-z0-9]/i, why: '内部概念标识' },
  { pattern: /source\.[a-z0-9]/i, why: '内部来源标识' },
  { pattern: /session\.[a-z0-9]/i, why: '内部会话标识' },
  { pattern: /rubric/i, why: '内部评分表' },
  { pattern: /disclosure/i, why: '内部披露术语' },
  { pattern: /evidence/i, why: '内部证据术语' },
  { pattern: /content pack/i, why: '内部内容包术语' },
  { pattern: /courseEdition|packVersion|trustMode/i, why: '内部契约字段' },
  { pattern: /三轴|回环|rem\b/i, why: '内部开发术语' },
  { pattern: /\bDSH\b/, why: '内核名' },
];

export function findForbiddenCopy(text) {
  return FORBIDDEN_COPY.filter((entry) => entry.pattern.test(text)).map((entry) => entry.why);
}
