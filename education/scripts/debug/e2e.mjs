// @ts-check
/**
 * 芽问端到端调试台：用 CDP 驱真实桌面应用跑真实界面，不花模型额度。
 *
 * 用法：
 *   node education/scripts/debug/e2e.mjs --dump
 *   node education/scripts/debug/e2e.mjs --eval "document.title"
 *   node education/scripts/debug/e2e.mjs --shot home
 *   node education/scripts/debug/e2e.mjs --run smoke
 *   node education/scripts/debug/e2e.mjs --run walkthrough --keep
 *   node education/scripts/debug/e2e.mjs --run live --secrets <真实 Key 目录>
 *
 * 约定：
 * - 默认用隔离数据根 E:\DSH\tmp\e2e\data，绝不碰用户真实学习记录；
 * - 默认把仓库里刚构建的 client/host bundle 同步进安装目录（改完代码不用重装）；
 * - 每次运行写 output/e2e/<时间>/report.json + 截图。
 */
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { createReport, findForbiddenCopy, launchApp } from './cdp.mjs';
import { SCENARIOS } from './scenarios.mjs';

const HERE = fileURLToPath(new URL('.', import.meta.url));
const REPO = resolve(HERE, '..', '..', '..');

/** @param {string[]} argv */
function parseArgs(argv) {
  /** @type {Record<string, string|boolean>} */
  const options = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith('--')) continue;
    const key = token.slice(2);
    const next = argv[index + 1];
    if (next !== undefined && !next.startsWith('--')) {
      options[key] = next;
      index += 1;
    } else {
      options[key] = true;
    }
  }
  return options;
}

const options = parseArgs(process.argv.slice(2));
const app = String(options.app ?? 'E:\\芽问\\current\\SproutAsk.exe');
const dataRoot = String(options.data ?? 'E:\\DSH\\tmp\\e2e\\data');
const port = Number(options.port ?? 9222);
const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const outDir = resolve(REPO, String(options.out ?? join('output', 'e2e', stamp)));
const syncBundles = options['no-sync'] === true ? null : resolve(REPO, 'education', 'runtime');

if (!existsSync(app)) {
  console.error(`找不到应用：${app}`);
  process.exit(2);
}

mkdirSync(outDir, { recursive: true });

/** @type {Awaited<ReturnType<typeof launchApp>>|null} */
let session = null;

try {
  session = await launchApp({
    app,
    dataRoot,
    port,
    syncBundles,
    keepData: options.keep === true,
    secretsFrom: typeof options.secrets === 'string' ? options.secrets : null,
  });
  const { cdp } = session;
  console.log(`应用已启动：${session.browser}`);
  console.log(`页面：${session.url}`);

  if (options.dump === true) {
    await dump(cdp, outDir);
  } else if (typeof options.eval === 'string') {
    const value = await cdp.evaluate(options.eval);
    console.log(JSON.stringify(value, null, 2));
  } else if (typeof options.shot === 'string') {
    const shot = await cdp.screenshot(join(outDir, `${options.shot}.png`));
    console.log(`截图：${shot.path} (${shot.width}x${shot.height})`);
  } else if (typeof options.run === 'string') {
    const scenario = SCENARIOS[options.run];
    if (scenario === undefined) {
      console.error(`没有这个场景：${options.run}，可选：${Object.keys(SCENARIOS).join(', ')}`);
      process.exit(2);
    }
    const report = createReport(outDir);
    const context = { cdp, outDir, app, dataRoot, stamp, imageFile: options.image };
    let failure = null;
    try {
      await scenario(context, report);
    } catch (error) {
      failure = error instanceof Error ? error.message : String(error);
    }
    const file = report.write({
      scenario: options.run,
      browser: session.browser,
      url: session.url,
      dataRoot,
      ok: failure === null && report.steps.every((step) => step.ok),
      failure,
      forbidden: findForbiddenCopy(await cdp.text().catch(() => '')),
      consoleErrors: cdp.consoleErrors,
      exceptions: cdp.exceptions,
      failedRequests: cdp.failedRequests,
    });
    console.log(`\n报告：${file}`);
    for (const step of report.steps) {
      console.log(`${step.ok ? '✓' : '✗'} ${step.name} (${step.ms}ms)${step.error ? ` — ${step.error}` : ''}`);
    }
    if (cdp.exceptions.length > 0) console.log(`页面异常 ${cdp.exceptions.length} 条：${cdp.exceptions[0]}`);
    if (cdp.consoleErrors.length > 0) {
      console.log(`控制台错误 ${cdp.consoleErrors.length} 条：${cdp.consoleErrors[0].text}`);
    }
    if (cdp.failedRequests.length > 0) {
      console.log(`失败请求 ${cdp.failedRequests.length} 条：${JSON.stringify(cdp.failedRequests.slice(0, 3))}`);
    }
    if (failure !== null) {
      console.error(`\n场景失败：${failure}`);
      process.exitCode = 1;
    }
  } else {
    console.log('没有指定动作：--dump / --eval / --shot / --run');
  }
} finally {
  if (session !== null) await session.close();
}

/** @param {import('./cdp.mjs').CdpPage} cdp @param {string} outDir */
async function dump(cdp, outDir) {
  const structure = await cdp.evaluate(`(() => {
    const testids = [...document.querySelectorAll('[data-testid]')].map((el) => el.dataset.testid);
    const actions = [...document.querySelectorAll('[data-action]')].map((el) => ({
      action: el.dataset.action,
      text: (el.textContent || '').trim().slice(0, 30),
      disabled: 'disabled' in el ? el.disabled : false,
    }));
    const nav = [...document.querySelectorAll('[data-testid="edu-nav"] a, [data-testid="edu-nav"] button')].map((el) => ({
      text: (el.textContent || '').trim(),
      href: el.getAttribute('href'),
      path: el.dataset.path,
    }));
    return {
      title: document.title,
      path: location.pathname + location.search,
      testids: [...new Set(testids)],
      actions,
      nav,
    };
  })()`);
  const shot = await cdp.screenshot(join(outDir, 'dump.png'));
  const text = await cdp.text();
  writeFileSync(join(outDir, 'dump.json'), `${JSON.stringify({ structure, text }, null, 2)}\n`);
  console.log(JSON.stringify(structure, null, 2));
  console.log(`\n截图：${shot.path}`);
  console.log(`页面文字（前 800 字）：\n${text.slice(0, 800)}`);
  const forbidden = findForbiddenCopy(text);
  if (forbidden.length > 0) console.log(`\n⚠ 疑似泄漏：${forbidden.join('、')}`);
  if (cdp.exceptions.length > 0) console.log(`⚠ 页面异常：${cdp.exceptions.slice(0, 3).join(' | ')}`);
  if (cdp.consoleErrors.length > 0) {
    console.log(`⚠ 控制台错误：${cdp.consoleErrors.slice(0, 3).map((entry) => entry.text).join(' | ')}`);
  }
}
