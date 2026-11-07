/**
 * 全链路自动走查场景（SCENARIOS.survey）。
 *
 * 单独放一个文件，避免和 scenarios.mjs 里几百行改动互相踩。
 * 逻辑：用「真实入口」进每个页面 → 枚举页面上真实渲染的 data-action →
 * 逐个点过去 → 记录点击失败/白屏/内部词/失败提示。
 */

import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { expectNoErrors, goNav, snapshot } from './scenarios.mjs';

const FORBIDDEN =
  /activity\.|source\.|concept\.[a-z]|disclosure|evidence|DSH|tok\/s|内容包|三轴|受控|基准/;
const FAILURE_HINT =
  /出了点问题|操作没有完成|提交没有完成|找不到这项内容|被安全检查拒绝|无法完成|功能还没有接入/;

export async function survey(context, report) {
  const { cdp, outDir } = context;

  const results = [];
  const renderedActions = {};
  const untested = [];

  const wait = (ms) => new Promise((done) => setTimeout(done, ms));

  const probe = async (action, pageName) => {
    const record = { page: pageName, action, found: false, ok: true, notes: [] };
    // 元素在 DOM 里但不可见 = 它需要前置动作（例如「确认」只在弹窗打开后才可见）。
    // 这种情况记成"跳过并说明原因"，不能算通过、也不能算失败。
    const state = await cdp.evaluate(`(() => {
      const nodes = [...document.querySelectorAll('[data-action="${action}"]')];
      if (nodes.length === 0) return { exists: false };
      const visible = nodes.some((el) => {
        const rect = el.getBoundingClientRect();
        const style = getComputedStyle(el);
        return rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden'
          && style.pointerEvents !== 'none' && !el.disabled;
      });
      return { exists: true, visible };
    })()`);
    if (state?.exists !== true) return record;
    record.found = true;
    if (state.visible !== true) {
      record.skipped = true;
      record.notes.push('需要先打开对应弹窗才可点');
      return record;
    }
    try {
      await cdp.click(`[data-action="${action}"]`, { label: action });
    } catch (error) {
      record.ok = false;
      record.notes.push(`点击失败：${error.message}`);
      return record;
    }
    await wait(1400);
    const alive = await cdp.evaluate(
      `Boolean(document.querySelector('[data-testid]')) && document.body.textContent.trim().length > 0`,
    );
    if (alive !== true) {
      record.ok = false;
      record.notes.push('点击后页面没有内容（疑似白屏）');
    }
    // 只读学生真能看到的文字：去掉 script/style，否则会把引导注入的
    // __DSH_BOOT_READY__ 当成内部词（那是误报）。
    const text = String(
      await cdp.evaluate(`(() => {
        const clone = document.body.cloneNode(true);
        clone.querySelectorAll('script, style, template').forEach((el) => el.remove());
        return clone.textContent || '';
      })()`),
    );
    const bad = text.match(FORBIDDEN);
    if (bad !== null) {
      record.ok = false;
      const at = text.indexOf(bad[0]);
      record.notes.push(
        `露出内部词：${bad[0]}（…${text.slice(Math.max(0, at - 40), at + 40).replace(/\s+/g, ' ')}…）`,
      );
    }
    const failure = text.match(FAILURE_HINT);
    if (failure !== null) record.notes.push(`页面提示：${failure[0]}`);
    return record;
  };

  // 每页用真实入口。导航栏只有 今天/学习/进展；目录从首页卡片进；设置从顶栏进。
  const clickTextButton = async (text) => {
    const clicked = await cdp.evaluate(`(() => {
      const button = [...document.querySelectorAll('button')]
        .find((el) => (el.textContent || '').trim().includes(${JSON.stringify(text)}));
      if (!button) return false;
      button.click();
      return true;
    })()`);
    if (clicked !== true) throw new Error(`找不到按钮：${text}`);
  };

  const pages = [
    { name: '今天', enter: async () => goNav(context, '今天') },
    { name: '进展', enter: async () => goNav(context, '进展') },
    {
      name: '设置',
      enter: async () => {
        await clickTextButton('设置');
      },
    },
    {
      name: '目录',
      enter: async () => {
        await goNav(context, '今天');
        await wait(800);
        await clickTextButton('去目录挑一个');
      },
    },
    {
      name: '学习台',
      enter: async () => {
        await goNav(context, '学习');
        await cdp.waitFor(`document.querySelector('[data-action="toggle-material"]') !== null`, {
          label: '学习台',
          timeoutMs: 60_000,
        });
      },
    },
  ];

  for (const page of pages) {
    await report.step(`走查：${page.name}`, async () => {
      // 先在同一页上枚举它真实渲染的所有动作。
      await page.enter();
      await wait(1200);
      await cdp.waitFor(`document.querySelector('[data-testid="edu-nav"]') !== null`, {
        label: `${page.name} 主导航`,
        timeoutMs: 30_000,
      });
      await snapshot(context, `survey-${page.name}`);
      const rendered = await cdp.evaluate(
        `[...new Set([...document.querySelectorAll('[data-action]')].map((el) => el.getAttribute('data-action')))]`,
      );
      renderedActions[page.name] = rendered ?? [];

      // 每个动作都重新进一次页面再点：点完常常会换页/改状态，不重进就会点到
      // 别的页面残留的同名元素，或者把剩下的动作全变成"未测"。
      for (const action of rendered ?? []) {
        await page.enter();
        await wait(900);
        const record = await probe(action, page.name);
        results.push(record);
        if (!record.found) {
          untested.push(`${page.name}/${action}（重进后未出现）`);
        }
        // 点「结束本轮」会关掉会话，重进可能起不来；失败也不中断，记下来即可。
      }
    });
  }

  // 需要前置条件（例如「确认」要先打开弹窗）的记为 skipped，不算通过也不算失败。
  const problems = results.filter((entry) => entry.found && !entry.ok && entry.skipped !== true);
  const skipped = results.filter((entry) => entry.skipped === true);
  const hints = results.filter((entry) => entry.notes.some((note) => note.startsWith('页面提示')));

  mkdirSync(outDir, { recursive: true });
  writeFileSync(
    join(outDir, 'survey.json'),
    `${JSON.stringify({ results, problems, skipped, hints, renderedActions, untested }, null, 2)}\n`,
    'utf8',
  );

  console.log(
    `走查 ${results.length} 个动作：找到 ${results.filter((e) => e.found).length}、` +
      `有问题 ${problems.length}、需前置条件 ${skipped.length}、失败提示 ${hints.length}、未测 ${untested.length}`,
  );
  for (const [page, actions] of Object.entries(renderedActions)) {
    console.log(`  ${page}：${actions.join('、')}`);
  }
  if (untested.length > 0) console.log(`  未测：${untested.join('、')}`);
  for (const entry of problems) console.log(`  ✗ ${entry.page}/${entry.action}：${entry.notes.join('；')}`);
  for (const entry of hints) console.log(`  ! ${entry.page}/${entry.action}：${entry.notes.join('；')}`);

  await report.step('可点动作不炸', async () => {
    if (problems.length > 0) {
      throw new Error(
        `${problems.length} 个动作有问题：` +
          problems.map((entry) => `${entry.page}/${entry.action}（${entry.notes.join('；')}）`).join(' | '),
      );
    }
  });
  await report.step('整体无报错', () => expectNoErrors(context));
}
