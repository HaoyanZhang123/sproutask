// @ts-check
/**
 * 端到端场景。每个场景接收 { cdp, outDir } 和 report 收集器。
 *
 * 原则：只断言学生能看见/能点到的东西；不靠内部状态猜测。
 * 阶段 2 的场景一律不触发模型调用（隔离数据根里没有 Key），因此不消耗额度。
 */
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { findForbiddenCopy } from './cdp.mjs';

/** @typedef {{cdp: import('./cdp.mjs').CdpPage, outDir: string}} Context */

/** 断言：页面文字不含内部标识/开发术语。 */
export async function expectCleanCopy({ cdp }, where = '') {
  const text = await cdp.text();
  const leaked = findForbiddenCopy(text);
  if (leaked.length > 0) {
    throw new Error(`${where} 学生界面出现内部术语：${leaked.join('、')}`);
  }
}

/** 断言：没有 JS 异常/控制台错误（可放宽到指定条数）。 */
export function expectNoErrors({ cdp }, tolerance = 0) {
  const errors = cdp.exceptions.length + cdp.consoleErrors.length;
  if (errors > tolerance) {
    const detail = cdp.exceptions[0] ?? cdp.consoleErrors[0]?.text ?? '';
    throw new Error(`页面报错 ${errors} 条：${String(detail).slice(0, 160)}`);
  }
}

/**
 * 把当前页面结构（testids / data-action / 可见按钮）写到 outDir，方便排查。
 * @param {Context} context
 * @param {string} name
 */
export async function snapshot(context, name) {
  const { cdp, outDir } = context;
  const structure = await cdp.evaluate(`(() => {
    const visible = (el) => {
      const rect = el.getBoundingClientRect();
      const style = getComputedStyle(el);
      return rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.display !== 'none';
    };
    return {
      title: document.title,
      path: location.pathname + location.search,
      testids: [...new Set([...document.querySelectorAll('[data-testid]')].map((el) => el.dataset.testid))],
      actions: [...document.querySelectorAll('[data-action]')]
        .filter(visible)
        .map((el) => ({ action: el.dataset.action, text: (el.textContent || '').trim().slice(0, 24), tag: el.tagName })),
      buttons: [...document.querySelectorAll('button')]
        .filter(visible)
        .map((el) => ({
          text: (el.textContent || '').trim().slice(0, 24),
          action: el.dataset.action ?? null,
          disabled: el.disabled,
        })),
      inputs: [...document.querySelectorAll('input, textarea, select')].filter(visible).map((el) => ({
        tag: el.tagName,
        type: el.getAttribute('type'),
        name: el.getAttribute('name') ?? el.getAttribute('aria-label') ?? el.dataset.testid ?? null,
      })),
    };
  })()`);
  const text = await cdp.text();
  writeFileSync(join(outDir, `${name}.json`), `${JSON.stringify({ structure, text }, null, 2)}\n`);
  await cdp.screenshot(join(outDir, `${name}.png`));
  return structure;
}

/** 点导航栏的某一项（今天 / 学习 / 进展）。 */
export async function goNav({ cdp }, label) {
  const clicked = await cdp.evaluate(`(() => {
    const nodes = [...document.querySelectorAll('[data-testid="edu-nav"] a, [data-testid="edu-nav"] button')];
    const target = nodes.find((el) => (el.textContent || '').trim() === ${JSON.stringify(label)});
    if (!target) return false;
    target.click();
    return true;
  })()`);
  if (!clicked) throw new Error(`导航里没有「${label}」`);
}

/** 等页面标题变成期望值（应用用内存路由，location 不变，标题会变）。 */
export async function waitTitle({ cdp }, keyword, timeoutMs = 20_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const title = await cdp.evaluate('document.title').catch(() => '');
    if (String(title).includes(keyword)) return String(title);
    await new Promise((done) => setTimeout(done, 200));
  }
  const actual = await cdp.evaluate('document.title').catch(() => '?');
  throw new Error(`等待标题含「${keyword}」超时，当前是「${actual}」`);
}

export const SCENARIOS = {
  /** 最小可用性：能打开、无报错、无内部术语泄漏。 */
  async smoke(context, report) {
    const { cdp, outDir } = context;
    await report.step('首页渲染', async () => {
      await cdp.waitFor('document.querySelector("[data-testid=\\"edu-nav\\"]")', { label: '主导航' });
      await cdp.screenshot(join(outDir, '01-home.png'));
    });
    await report.step('首页无内部术语', () => expectCleanCopy(context, '首页'));
    await report.step('首页无报错', () => expectNoErrors(context));
  },

  /** 全路径静态走查：不触发模型调用。 */
  async walkthrough(context, report) {
    const { cdp, outDir } = context;
    const titles = /** @type {Record<string,string>} */ ({});

    await report.step('首页', async () => {
      await cdp.waitFor('document.querySelector("[data-testid=\\"edu-nav\\"]")', { label: '主导航' });
      await snapshot(context, '01-home');
      titles['home'] = await cdp.evaluate('document.title');
      await expectCleanCopy(context, '首页');
    });

    await report.step('目录（学习）', async () => {
      await goNav(context, '学习');
      await new Promise((done) => setTimeout(done, 1500));
      titles['learn'] = await cdp.evaluate('document.title');
      await snapshot(context, '02-learn');
      await expectCleanCopy(context, '学习页');
    });

    await report.step('进展', async () => {
      await goNav(context, '进展');
      await new Promise((done) => setTimeout(done, 1500));
      titles['progress'] = await cdp.evaluate('document.title');
      await snapshot(context, '03-progress');
      await expectCleanCopy(context, '进展页');
    });

    await report.step('设置', async () => {
      await cdp.clickText('设置');
      await new Promise((done) => setTimeout(done, 1500));
      titles['settings'] = await cdp.evaluate('document.title');
      await snapshot(context, '04-settings');
      await expectCleanCopy(context, '设置页');
    });

    await report.step('回到今天', async () => {
      await goNav(context, '今天');
      await new Promise((done) => setTimeout(done, 1200));
      titles['home2'] = await cdp.evaluate('document.title');
      await snapshot(context, '05-home-again');
    });

    await report.step('整体无报错', () => expectNoErrors(context));
    console.log(`页面标题：${JSON.stringify(titles)}`);
  },

  /** 探索：从首页进入目录并 dump 结构，供后续场景编写选择器。 */
  async explore(context, report) {
    const { cdp } = context;
    await report.step('首页', async () => {
      await cdp.waitFor('document.querySelector("[data-testid=\\"edu-nav\\"]")', { label: '主导航' });
      await snapshot(context, '01-home');
    });
    await report.step('去目录', async () => {
      await cdp.clickText('去目录挑一个');
      await new Promise((done) => setTimeout(done, 2000));
      await snapshot(context, '02-library');
    });
    await report.step('选第一个概念', async () => {
      const picked = await cdp.evaluate(`(() => {
        const candidates = [...document.querySelectorAll('button, a, [role="button"]')].filter((el) => {
          const rect = el.getBoundingClientRect();
          const style = getComputedStyle(el);
          return rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden';
        });
        const target = candidates.find((el) => {
          const text = (el.textContent || '').trim();
          return text.length > 2 && !['芽问生物学习','今天','学习','进展','设置'].includes(text);
        });
        if (!target) return { ok: false, all: candidates.map((el) => (el.textContent || '').trim().slice(0, 20)) };
        target.click();
        return { ok: true, text: (target.textContent || '').trim().slice(0, 40) };
      })()`);
      if (!picked?.ok) throw new Error(`目录里没有可点的概念：${JSON.stringify(picked?.all ?? []).slice(0, 300)}`);
      await new Promise((done) => setTimeout(done, 3000));
      await snapshot(context, '03-study');
    });
  },

  /** 探索 2：目录 → 概念 → 学习页。 */
  async explore2(context, report) {
    const { cdp } = context;
    await report.step('首页→目录', async () => {
      await cdp.waitFor('document.querySelector("[data-testid=\\"edu-nav\\"]")', { label: '主导航' });
      await cdp.clickText('去目录挑一个');
      await new Promise((done) => setTimeout(done, 2000));
    });
    await report.step('点概念', async () => {
      await cdp.clickText('观察的目的与对象');
      await new Promise((done) => setTimeout(done, 2000));
      await snapshot(context, '02-concept');
    });
    await report.step('开始学习', async () => {
      const candidates = await cdp.evaluate(`[...document.querySelectorAll('button')].map((el) => (el.textContent || '').trim()).filter((t) => t.length > 0)`);
      console.log(`概念页按钮：${JSON.stringify(candidates).slice(0, 400)}`);
      for (const label of ['开始学习', '学习这一节', '开始', '学这一节']) {
        try {
          await cdp.clickText(label);
          await new Promise((done) => setTimeout(done, 3000));
          break;
        } catch {
          /* 试下一个 */
        }
      }
      await snapshot(context, '03-study');
    });
  },

  /** 学习主路径（无模型 Key，不花钱）：进题、作答、跳过、问小芽、结束本轮。 */
  async study(context, report) {
    const { cdp, outDir } = context;
    const title = () => cdp.evaluate('document.title');

    await report.step('进入学习页', async () => {
      await cdp.waitFor('document.querySelector("[data-testid=\\"edu-nav\\"]")', { label: '主导航' });
      await cdp.clickText('去目录挑一个');
      await cdp.waitFor('document.querySelector("[data-testid=\\"map-page\\"]")', {
        label: '知识地图内容',
        timeoutMs: 20_000,
      });
      await cdp.waitFor(
        `[...document.querySelectorAll('button')].some((el) => (el.textContent || '').includes('观察的目的与对象'))`,
        { label: '概念按钮', timeoutMs: 20_000 },
      );
      await cdp.clickText('观察的目的与对象');
      await new Promise((done) => setTimeout(done, 1500));
      await cdp.waitFor(
        `[...document.querySelectorAll('button')].some((el) => (el.textContent || '').trim() === '开始学习')`,
        { label: '开始学习按钮', timeoutMs: 20_000 },
      );
      await cdp.clickText('开始学习');
      await cdp.waitFor('document.querySelector("[data-testid=\\"study-question\\"]") !== null', {
        label: '题目',
        timeoutMs: 30_000,
      });
      await snapshot(context, '01-question');
    });

    await report.step('题目完整（题干 + 选项 + 主要按钮）', async () => {
      const info = await cdp.evaluate(`(() => ({
        stem: (document.querySelector('[data-testid="study-stem"]')?.textContent || '').trim(),
        options: document.querySelectorAll('input[type="radio"]').length,
        submit: Boolean(document.querySelector('[data-action="submit-answer"]')),
        skip: Boolean(document.querySelector('[data-action="skip-question"]')),
        hint: Boolean(document.querySelector('[data-action="hint"]')),
      }))()`);
      if (!info?.stem || info.stem.length < 6) throw new Error(`题干异常：「${info?.stem ?? ''}」`);
      if ((info?.options ?? 0) < 2) throw new Error(`选项过少：${info?.options}`);
      if (!info.submit || !info.skip) throw new Error('缺少提交/跳过按钮');
      await expectCleanCopy(context, '题目页');
    });

    await report.step('选一个答案并提交（无 Key，应优雅失败）', async () => {
      const picked = await cdp.evaluate(`(() => {
        const radios = [...document.querySelectorAll('input[type="radio"]')];
        if (!radios.length) return false;
        radios[0].click();
        return true;
      })()`);
      if (!picked) throw new Error('没有可选项');
      await cdp.click('[data-action="submit-answer"]', { label: '提交作答' });
      await new Promise((done) => setTimeout(done, 6000));
      await snapshot(context, '02-after-submit');
      const text = await cdp.text();
      // 没有 Key 时应给出学生话的"暂时不可用"，而不是内部错误码。
      if (/UNAVAILABLE|NETWORK|service_error|Error:/i.test(text)) {
        throw new Error('失败提示里出现内部错误码');
      }
      await expectCleanCopy(context, '提交后');
    });

    await report.step('换到下一题（提交成功走「下一题」，提交失败走「先跳过」）', async () => {
      const before = await cdp.evaluate(
        `(document.querySelector('[data-testid="study-stem"]')?.textContent || '').trim()`,
      );
      const hasNext = await cdp.evaluate(
        `Boolean(document.querySelector('[data-action="next-question"]'))`,
      );
      if (hasNext) {
        await cdp.click('[data-action="next-question"]', { label: '下一题' });
      } else {
        await cdp.click('[data-action="skip-question"]', { label: '先跳过' });
      }
      await new Promise((done) => setTimeout(done, 6000));
      const after = await cdp.evaluate(
        `(document.querySelector('[data-testid="study-stem"]')?.textContent || '').trim()`,
      );
      await snapshot(context, '03-after-next');
      if (after === before) throw new Error(`换题之后题目没变：「${String(before).slice(0, 40)}」`);
    });

    await report.step('问小芽：发一条消息（无 Key，应优雅失败）', async () => {
      await cdp.click('[data-action="open-sprout"]', { label: '问小芽' });
      await new Promise((done) => setTimeout(done, 600));
      await cdp.fill('[data-testid="sprout-input"]', '给我一点提示');
      await cdp.click('[data-testid="sprout-send"]', { label: '发送' });
      await new Promise((done) => setTimeout(done, 6000));
      await snapshot(context, '04-chat');
      const text = await cdp.text();
      if (/UNAVAILABLE|NETWORK|Error:/i.test(text)) throw new Error('聊天失败提示里出现内部错误码');
      await expectCleanCopy(context, '小芽对话');
    });

    await report.step('结束本轮', async () => {
      await cdp.click('[data-action="finish-round"]', { label: '结束本轮' });
      await new Promise((done) => setTimeout(done, 4000));
      await snapshot(context, '05-finish');
      const text = await cdp.text();
      if (!/本轮|完成|结果/.test(text)) throw new Error('结束本轮后没有结果区域');
      await expectCleanCopy(context, '结束本轮');
    });

    await report.step('进展页有记录', async () => {
      await goNav(context, '进展');
      await new Promise((done) => setTimeout(done, 1500));
      await snapshot(context, '06-progress');
      const text = await cdp.text();
      if (/还没有学习记录/.test(text)) throw new Error('刚学完但进展页仍显示"还没有学习记录"');
    });

    await report.step('整体无报错', () => expectNoErrors(context));
    console.log(`结束状态标题：${await title()}`);
  },

  /**
   * 全部概念的题目渲染走查（不花模型钱）。
   *
   * 逐个概念打开学习台，检查：题干非空、选项/输入控件齐全、页面没有内部标识、
   * 没有 JS 异常。目标是让"某类题型一渲染就露 factor.position"这种问题一次扫出来。
   */
  async questions(context, report) {
    const { cdp } = context;
    const conceptIds = await cdp.evaluate(
      `(async () => {
         const r = await fetch('/edu/api/g1/snapshot');
         const j = await r.json();
         return (j.data?.concepts ?? []).map((c) => c.id);
       })()`,
    );
    if (!Array.isArray(conceptIds) || conceptIds.length === 0) throw new Error('snapshot 里没有概念');

    const failures = [];
    let checked = 0;
    for (const conceptId of conceptIds) {
      const url = `/edu/api/g1/study?conceptId=${encodeURIComponent(conceptId)}`;
      const opened = await cdp.evaluate(`(async () => {
        const r = await fetch(${JSON.stringify(url)});
        const j = await r.json();
        if (!j.ok) return { ok: false, code: j.error?.code ?? 'unknown', message: j.error?.message ?? '' };
        return {
          ok: true,
          concept: j.data.concept.title,
          activities: (j.data.activities ?? []).map((a) => ({
            id: a.id,
            kind: a.answerSchema?.kind ?? null,
            stem: a.stem,
          })),
        };
      })()`);
      if (!opened?.ok) {
        failures.push(`${conceptId}: 打不开（${opened?.code ?? '?'}）`);
        continue;
      }
      for (const activity of opened.activities ?? []) {
        checked += 1;
        const problems = [];
        if (typeof activity.stem !== 'string' || activity.stem.trim().length < 6) problems.push('题干为空或过短');
        if (activity.kind === null) problems.push('缺少作答方式');
        if (/activity\.|concept\.|source\./.test(String(activity.stem))) problems.push('题干里出现内部标识');
        if (problems.length > 0) failures.push(`${opened.concept} / ${activity.id}: ${problems.join('、')}`);
      }
    }

    await report.step('所有题目可渲染', async () => {
      if (failures.length > 0) {
        throw new Error(`${failures.length} 处问题：${failures.slice(0, 5).join(' | ')}`);
      }
    });
    console.log(`检查了 ${conceptIds.length} 个概念、${checked} 道题`);
    await report.step('页面无报错', () => expectNoErrors(context));
  },
  /**
   * 旧的"提交后题目消失"复现路径：同一页面刷新/重进后再提交一次。
   * 修复前页内计数器会重用 request.study.N，第二次提交被当成重发而丢弃。
   */
  async resubmit(context, report) {
    const { cdp } = context;
    const openStudy = async () => {
      await cdp.waitFor('document.querySelector("[data-testid=\\"edu-nav\\"]")', { label: '主导航' });
      await cdp.clickText('去目录挑一个');
      await cdp.waitFor('document.querySelector("[data-testid=\\"map-page\\"]")', { label: '知识地图' });
      await cdp.waitFor(
        `[...document.querySelectorAll('button')].some((el) => (el.textContent || '').includes('观察的目的与对象'))`,
        { label: '概念按钮' },
      );
      await cdp.clickText('观察的目的与对象');
      await new Promise((done) => setTimeout(done, 1000));
      await cdp.waitFor(
        `[...document.querySelectorAll('button')].some((el) => (el.textContent || '').trim() === '开始学习')`,
        { label: '开始学习' },
      );
      await cdp.clickText('开始学习');
      await cdp.waitFor('document.querySelector("[data-testid=\\"study-question\\"]") !== null', {
        label: '题目',
        timeoutMs: 40_000,
      });
    };
    const submitFirst = async () => {
      await cdp.waitFor('document.querySelectorAll("input[type=\\"radio\\"]").length >= 1', {
        label: '选项',
        timeoutMs: 20_000,
      });
      await cdp.evaluate(`(() => { document.querySelectorAll('input[type="radio"]')[0].click(); return true; })()`);
      await cdp.click('[data-action="submit-answer"]', { label: '提交作答' });
      await cdp.waitFor('!document.querySelector("[data-wait-base]")', {
        label: '反馈完成',
        timeoutMs: 120_000,
      });
      await new Promise((done) => setTimeout(done, 1500));
    };

    await report.step('第一次提交', async () => {
      await openStudy();
      await submitFirst();
      await snapshot(context, '01-first');
    });

    await report.step('重新打开（模拟刷新）再提交', async () => {
      await cdp.evaluate('location.reload()');
      await new Promise((done) => setTimeout(done, 4000));
      await openStudy();
      await submitFirst();
      await snapshot(context, '02-second');
    });

    await report.step('两次提交都应有反馈', async () => {
      const text = await cdp.text();
      if (/提交没有完成|找不到这项内容/.test(text)) {
        throw new Error('重进后再次提交仍然失败');
      }
      await expectCleanCopy(context, '重进提交');
    });
    await report.step('整体无报错', () => expectNoErrors(context));
  },
  /**
   * 导出学习记录的完整 UI 路径：进展页 → 导出 → 选择保存位置。
   * 系统文件夹选择框会阻塞请求，所以本场景由外部（UIA）点「取消」，
   * 用来验证"取消后如实告诉学生没有写入任何文件"。
   */
  async 'export-ui'(context, report) {
    const { cdp } = context;
    await report.step('打开进展页', async () => {
      await cdp.waitFor('document.querySelector("[data-testid=\\"edu-nav\\"]")', { label: '主导航' });
      await cdp.clickText('进展');
      await cdp.waitFor('document.querySelector("[data-action=\\"export-records\\"]")', {
        label: '导出按钮',
        timeoutMs: 20_000,
      });
    });
    await report.step('点导出并确认（会弹出系统文件夹选择框）', async () => {
      await cdp.click('[data-action="export-records"]', { label: '导出学习记录' });
      await cdp.waitFor('document.querySelector("[data-edu-dialog=\\"default\\"]")', { label: '导出确认框' });
      await cdp.click('[data-action="confirm"]', { label: '选择保存位置' });
      await snapshot(context, '01-picker-open');
    });
    await report.step('选择框返回后如实提示结果', async () => {
      // 外部会点「确定」或关掉选择框；两种结果都必须给出真实反馈。
      const deadline = Date.now() + 120_000;
      let status = '';
      while (Date.now() < deadline) {
        status = await cdp.evaluate(
          `(document.querySelector('[data-testid="records-action-status"]')?.textContent || '').trim()`,
        );
        if (status.length > 0) break;
        await new Promise((done) => setTimeout(done, 1000));
      }
      await snapshot(context, '02-after-picker');
      if (!/已取消导出|已导出/.test(status)) {
        throw new Error(`选择框返回后提示不对：「${status}」`);
      }
      console.log(`导出结果提示：${status}`);
    });
    await report.step('整体无报错', () => expectNoErrors(context));
  },
  /** 真实模型走查（会花钱）：只在 --secrets 指向真实 Key 时运行。 */
  async live(context, report) {
    const { cdp, outDir } = context;
    const checks = [];
    const assertStudentCopy = async (where, text) => {
      const leaked = findForbiddenCopy(text);
      if (leaked.length > 0) throw new Error(`${where} 出现内部术语：${leaked.join('、')}`);
      if (/\*\*/.test(text)) throw new Error(`${where} 出现 Markdown 星号：${text.slice(0, 120)}`);
    };

    await report.step('进入学习页', async () => {
      await cdp.waitFor('document.querySelector("[data-testid=\\"edu-nav\\"]")', { label: '主导航' });
      await cdp.clickText('去目录挑一个');
      await cdp.waitFor('document.querySelector("[data-testid=\\"map-page\\"]")', { label: '知识地图' });
      await cdp.waitFor(
        `[...document.querySelectorAll('button')].some((el) => (el.textContent || '').includes('观察的目的与对象'))`,
        { label: '概念按钮' },
      );
      await cdp.clickText('观察的目的与对象');
      await new Promise((done) => setTimeout(done, 1200));
      await cdp.clickText('开始学习');
      await cdp.waitFor('document.querySelector("[data-testid=\\"study-question\\"]") !== null', {
        label: '题目',
        timeoutMs: 40_000,
      });
      await snapshot(context, '01-question');
    });

    await report.step('提交作答并拿到模型反馈', async () => {
      await cdp.evaluate(`(() => { const r = document.querySelectorAll('input[type="radio"]')[0]; r?.click(); return true; })()`);
      await cdp.click('[data-action="submit-answer"]', { label: '提交作答' });
      await cdp.waitFor(
        'document.querySelector("[data-testid=\\"study-feedback\\"]") !== null && !document.querySelector(\'[data-wait-base]\')',
        { label: '反馈出现', timeoutMs: 90_000 },
      );
      await new Promise((done) => setTimeout(done, 1500));
      await snapshot(context, '02-feedback');
      const text = await cdp.text();
      if (/没能连上模型|本地规则|规则批改/.test(text)) {
        throw new Error('反馈走了本地降级路径（模型未参与）');
      }
      await assertStudentCopy('反馈', text);
      checks.push({ step: 'feedback', excerpt: text.slice(0, 400) });
    });

    await report.step('问小芽：要提示并拿到模型回复', async () => {
      const before = await cdp.evaluate(
        `document.querySelectorAll('[data-testid="sprout-thread"] .sprout-msg').length`,
      );
      await cdp.click('[data-action="open-sprout"]', { label: '问小芽' });
      await new Promise((done) => setTimeout(done, 700));
      await cdp.fill('[data-testid="sprout-input"]', '给我一点提示，我自己再想想');
      await cdp.click('[data-testid="sprout-send"]', { label: '发送' });
      await cdp.waitFor(
        `document.querySelectorAll('[data-testid="sprout-thread"] .sprout-msg').length >= ${Number(before) + 2}`,
        { label: '小芽回复', timeoutMs: 90_000 },
      );
      await new Promise((done) => setTimeout(done, 1200));
      await snapshot(context, '03-chat');
      const chatText = await cdp.evaluate(
        `[...document.querySelectorAll('[data-testid="sprout-thread"] .sprout-msg')].map((el) => el.textContent || '').join('\\n')`,
      );
      if (String(chatText).includes('没能连上模型')) throw new Error('小芽走了本地降级路径（模型未参与）');
      // 回归：模型必须知道自己刚看的是哪份作答，不能再问"你选的是哪一项"。
      if (/没看到你选|没看到.*选项|请告诉我你选/.test(String(chatText))) {
        throw new Error(`聊天轮仍然不知道学生选了什么：${String(chatText).slice(-200)}`);
      }
      if (!/选了|选的是|你选|正确|答对|答错|先明确观察目的/.test(String(chatText))) {
        throw new Error(`聊天回复没有针对学生的选择：${String(chatText).slice(-200)}`);
      }
      await assertStudentCopy('小芽回复', String(chatText));
      checks.push({ step: 'chat', excerpt: String(chatText).slice(-400) });
    });

    await report.step('结束本轮并回进展页', async () => {
      await cdp.click('[data-action="finish-round"]', { label: '结束本轮' });
      await new Promise((done) => setTimeout(done, 4000));
      await snapshot(context, '04-finish');
      await goNav(context, '进展');
      await new Promise((done) => setTimeout(done, 1500));
      await snapshot(context, '05-progress');
      await expectCleanCopy(context, '进展页');
    });
  },

  /** 图片作答链路：选图 → 预览 → 确认发送 → 澄清或反馈（真实视觉调用 1 次）。 */
  async live3(context, report) {
    const { cdp, outDir } = context;
    const imagePath = String(context.imageFile ?? 'E:\\DSH\\tmp\\e2e\\cell-diagram.png');
    const assertClean = async (where, text) => {
      const leaked = findForbiddenCopy(text);
      if (leaked.length > 0) throw new Error(`${where} 出现内部术语：${leaked.join('、')}`);
      if (/\*\*/.test(text)) throw new Error(`${where} 出现 Markdown 星号`);
    };

    await report.step('进入学习页', async () => {
      await cdp.waitFor('document.querySelector("[data-testid=\\"edu-nav\\"]")', { label: '主导航' });
      await cdp.clickText('去目录挑一个');
      await cdp.waitFor('document.querySelector("[data-testid=\\"map-page\\"]")', { label: '知识地图' });
      await cdp.waitFor(
        `[...document.querySelectorAll('button')].some((el) => (el.textContent || '').includes('观察的目的与对象'))`,
        { label: '概念按钮' },
      );
      await cdp.clickText('观察的目的与对象');
      await new Promise((done) => setTimeout(done, 1200));
      await cdp.clickText('开始学习');
      await cdp.waitFor('document.querySelector("[data-testid=\\"study-question\\"]") !== null', {
        label: '题目',
        timeoutMs: 40_000,
      });
    });

    await report.step('切到图片作答并选图', async () => {
      // 表单/底栏是异步挂载的：等"提交作答"或"改用图片作答"出现再判断。
      await cdp.waitFor(
        `Boolean(document.querySelector('[data-action="submit-answer"]') || document.querySelector('[data-action="image-answer"]'))`,
        { label: '作答底栏', timeoutMs: 30_000 },
      );
      const hasImageMode = await cdp.evaluate(
        `Boolean(document.querySelector('[data-action="image-answer"]'))`,
      );
      if (!hasImageMode) throw new Error('当前题目没有"改用图片作答"入口');
      await cdp.click('[data-action="image-answer"]');
      await cdp.waitFor('document.querySelector("input[type=file]") !== null', {
        label: '文件输入框',
        timeoutMs: 20_000,
      });
      await cdp.setFileInput('input[type=file]', imagePath);
      await cdp.waitFor('document.querySelector("[data-testid=\\"image-file-meta\\"]") !== null', {
        label: '图片信息',
        timeoutMs: 30_000,
      });
      await new Promise((done) => setTimeout(done, 1500));
      await snapshot(context, '01-image-picked');
    });

    await report.step('确认发送并拿到识别结果', async () => {
      // 先点预览（若需要），再点"确认发送给模型识别"。
      for (const label of ['预览图片', '看一下图片', '预览']) {
        try {
          await cdp.clickText(label);
          break;
        } catch {
          /* 没有预览按钮就直接发 */
        }
      }
      const send = await cdp.evaluate(`(() => {
        const nodes = [...document.querySelectorAll('button')];
        const target = nodes.find((el) => (el.textContent || '').includes('确认发送'));
        if (!target) return { ok: false, all: nodes.map((el) => (el.textContent || '').trim()).filter(Boolean) };
        if (target.disabled) return { ok: false, reason: 'disabled' };
        target.click();
        return { ok: true };
      })()`);
      if (!send?.ok) throw new Error(`无法发送图片：${send?.reason ?? ''} ${JSON.stringify(send?.all ?? []).slice(0, 200)}`);
      await new Promise((done) => setTimeout(done, 2000));
      await cdp.waitFor(
        '!document.querySelector("[data-testid=\\"image-busy\\"]")',
        { label: '识别结束', timeoutMs: 120_000 },
      );
      await new Promise((done) => setTimeout(done, 1500));
      await snapshot(context, '02-image-result');
      const text = await cdp.text();
      if (/UNAVAILABLE|NETWORK|Error:/i.test(text)) throw new Error('图片链路出现内部错误码');
      if (!/识别|看清|图片|再拍|文字/.test(text)) throw new Error('识别结束后没有可读结果');
      await assertClean('图片结果', text);
      console.log(`\n[图片结果] ${text.slice(-600)}`);
    });

    await report.step('整体无报错', () => expectNoErrors(context));
  },
  /** 真实模型走查 2：答错后的反馈 + 直接要答案的披露路径。 */
  async live2(context, report) {
    const { cdp, outDir } = context;
    const assertStudentCopy = async (where, text) => {
      const leaked = findForbiddenCopy(text);
      if (leaked.length > 0) throw new Error(`${where} 出现内部术语：${leaked.join('、')}`);
      if (/\*\*/.test(text)) throw new Error(`${where} 出现 Markdown 星号：${text.slice(0, 120)}`);
    };

    await report.step('进入学习页', async () => {
      await cdp.waitFor('document.querySelector("[data-testid=\\"edu-nav\\"]")', { label: '主导航' });
      await cdp.clickText('去目录挑一个');
      await cdp.waitFor('document.querySelector("[data-testid=\\"map-page\\"]")', { label: '知识地图' });
      await cdp.waitFor(
        `[...document.querySelectorAll('button')].some((el) => (el.textContent || '').includes('观察的目的与对象'))`,
        { label: '概念按钮' },
      );
      await cdp.clickText('观察的目的与对象');
      await new Promise((done) => setTimeout(done, 1200));
      await cdp.clickText('开始学习');
      await cdp.waitFor('document.querySelector("[data-testid=\\"study-question\\"]") !== null', {
        label: '题目',
        timeoutMs: 40_000,
      });
    });

    await report.step('选一个错答案，看反馈是否讲清楚', async () => {
      await cdp.waitFor('document.querySelectorAll("input[type=\\"radio\\"]").length >= 2', {
        label: '选项渲染',
        timeoutMs: 30_000,
      });
      const picked = await cdp.evaluate(`(() => {
        const radios = [...document.querySelectorAll('input[type="radio"]')];
        if (radios.length < 2) return false;
        radios[1].click();
        return true;
      })()`);
      if (!picked) throw new Error('选项不足');
      await cdp.click('[data-action="submit-answer"]', { label: '提交作答' });
      await new Promise((done) => setTimeout(done, 800));
      // 反馈容器先出现、评分后到；等"评分结果"本身，而不是容器。
      await cdp.waitFor(
        'document.querySelector("[data-testid=\\"study-feedback-grade\\"]") !== null && !document.querySelector("[data-wait-base]")',
        { label: '评分结果', timeoutMs: 90_000 },
      );
      await new Promise((done) => setTimeout(done, 1200));
      await snapshot(context, '02-wrong-feedback');
      const text = await cdp.text();
      if (/没能连上模型/.test(text)) throw new Error('反馈走了本地降级路径');
      await assertStudentCopy('答错反馈', text);
      // 讲清楚：至少说明"为什么不对/该看什么"，而不是只报对错。
      if (!/目的|对象|第一步/.test(text)) throw new Error('答错反馈没有解释关键概念');
      console.log(`\n[答错反馈] ${text.slice(0, 500)}`);
    });

    await report.step('直接要答案：出现披露提示', async () => {
      await cdp.click('[data-action="open-sprout"]', { label: '问小芽' });
      await new Promise((done) => setTimeout(done, 700));
      await cdp.fill('[data-testid="sprout-input"]', '直接告诉我这道题选哪个吧');
      await cdp.click('[data-testid="sprout-send"]', { label: '发送' });
      await new Promise((done) => setTimeout(done, 1000));
      await cdp.waitFor(
        `[...document.querySelectorAll('[data-testid="sprout-thread"] .sprout-msg')].length >= 2`,
        { label: '小芽回复', timeoutMs: 90_000 },
      );
      await new Promise((done) => setTimeout(done, 1500));
      await snapshot(context, '03-disclosure');
      const chat = await cdp.evaluate(
        `[...document.querySelectorAll('[data-testid="sprout-thread"] .sprout-msg')].map((el) => el.textContent || '').join('\\n')`,
      );
      await assertStudentCopy('披露回复', String(chat));
      // 披露由教学决策决定：要么出现"看过完整答案"徽标，要么回复里直接给出正确选项。
      const disclosed = await cdp.evaluate(
        `document.body.innerText.includes('看过完整答案') || document.body.innerText.includes('看过答案')`,
      );
      const gaveAnswer = /先明确观察目的|先多拍照片|先跟随同学|先凭印象/.test(String(chat));
      // 规则保证：学生明确要答案 → answer_disclosure（不再依赖模型自觉）。
      if (!disclosed) {
        throw new Error(`明确要答案却没有披露提示；回复：${String(chat).slice(-200)}`);
      }
      if (!gaveAnswer) console.log('  ⚠ 有披露提示，但回复里没有逐字列出选项（可接受）');
      const lastReply = await cdp.evaluate(
        `(() => { const nodes = [...document.querySelectorAll('[data-testid="sprout-thread"] .sprout-msg[data-role="assistant"]')]; const last = nodes[nodes.length - 1]; return last ? (last.textContent || '').trim() : ''; })()`,
      );
      // 模板前缀必须换成披露口径；回复正文里出现"提示"这类自然语言不算问题。
      if (String(lastReply).startsWith('给你一个提示')) {
        throw new Error(`披露答案的回复仍用提示前缀：${String(lastReply).slice(0, 80)}`);
      }
      console.log(`\n[披露回复] disclosed=${disclosed} gaveAnswer=${gaveAnswer}\n开头：${String(lastReply).slice(0, 120)}\n${String(chat).slice(-500)}`);
    });

    await report.step('结束本轮', async () => {
      await cdp.click('[data-action="finish-round"]', { label: '结束本轮' });
      await new Promise((done) => setTimeout(done, 4000));
      await snapshot(context, '04-finish');
    });

    await report.step('整体无报错', () => expectNoErrors(context));
  },
};
