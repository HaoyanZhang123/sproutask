import { afterEach, describe, expect, it } from 'vitest';
import {
  buttonByAction,
  buttonByText,
  chipsOf,
  cleanupLibraries,
  el,
  mountLibrary,
  pageRoot,
  switchToBook,
  textOf,
  tick,
} from './helpers.js';

afterEach(cleanupLibraries);

/** 工程/审校术语一律不许上屏。 */
const FORBIDDEN = /机器匹配|覆盖完整|不可作为基准|强掌握结论|文件指纹|指纹|内容包版本|受控|解析器|审校|审核|覆盖未完成/;

describe('/library —— 我的课本：一页只说一件事', () => {
  it('首屏只有一张课本卡、一个核实标识和一句学生话', async () => {
    const { container } = await mountLibrary();
    const page = pageRoot(container);

    const card = el(page, 'library-book-card');
    expect(textOf(card)).toContain('现在用的是');
    expect(textOf(card)).toContain('合成生物教材（fixture）');
    expect(textOf(card)).toContain('合成出版社（fixture，非真实版本）');
    expect(textOf(card)).toContain('7 年级上册');

    // 整页只有一个核实 chip，而且带文字（不靠颜色）
    const chips = chipsOf(page);
    expect(chips.length).toBe(1);
    expect(chips[0]?.getAttribute('data-testid')).toBe('library-verified-chip');
    expect(textOf(el(page, 'library-verified-chip'))).toBe('已核对');
    expect(chips[0]?.dataset['tone']).toBe('positive');

    // 页码/范围是一句学生话
    expect(textOf(card)).toContain('全册 200 页');
    expect(textOf(card)).toContain('已经标出 2 处原文');

    // 主按钮 + 次按钮
    expect(textOf(el(page, 'library-start'))).toBe('用这本开始');
    expect(textOf(buttonByAction(page, 'switch-book'))).toBe('换一本');
    expect(textOf(el(page, 'library-import'))).toBe('导入新的');

    // 「课本原文从哪来」默认折起来，不是首屏主体
    const sources = el(page, 'library-sources');
    expect(sources.getAttribute('data-open')).toBe('false');
    expect(el(page, 'library-sources-body').hasAttribute('hidden')).toBe(true);
    expect(textOf(sources)).toContain('2 条来源');
    expect(textOf(sources)).toContain('课本原文从哪来');

    // 演示数据只留一行说明，不占首屏
    expect(textOf(el(page, 'library-fixture-notice'))).toContain('演示数据（fixture）');

    expect(textOf(page)).not.toMatch(FORBIDDEN);
    expect(textOf(container)).not.toMatch(/掌握率|\d+(?:\.\d+)?\s*%/);
  });

  it('展开后才出现来源列表，并写清 PDF 页与课本页是两回事', async () => {
    const { container } = await mountLibrary();
    const page = pageRoot(container);
    buttonByAction(page, 'toggle-sources').click();

    expect(el(page, 'library-sources').getAttribute('data-open')).toBe('true');
    expect(buttonByAction(page, 'toggle-sources').getAttribute('aria-expanded')).toBe('true');
    const body = el(page, 'library-sources-body');
    expect(textOf(body)).toContain('PDF 第几页和课本第几页不是同一个数字');
    const items = [...body.querySelectorAll<HTMLElement>('.edu-lib-source-item')];
    expect(items.length).toBe(2);
    expect(textOf(items[0] as HTMLElement)).toContain('PDF 第 18 页 · 课本第 12 页');
    expect(textOf(items[1] as HTMLElement)).toContain('PDF 第 26 页 · 课本页还没认出来');
    // 展开后的来源按钮是真正的 button，且可以键盘聚焦
    const open = buttonByAction(body, 'open-source');
    expect(open.type).toBe('button');
    open.focus();
    expect(document.activeElement).toBe(open);

    buttonByAction(page, 'toggle-sources').click();
    expect(el(page, 'library-sources-body').hasAttribute('hidden')).toBe(true);
    // 收起后焦点回到折叠按钮，键盘不丢位置
    expect(document.activeElement).toBe(buttonByAction(page, 'toggle-sources'));
  });

  it('换一本：只列其他课本，状态写文字、不再多一个 chip', async () => {
    const { container } = await mountLibrary();
    const page = pageRoot(container);
    buttonByAction(page, 'switch-book').click();

    const chooser = el(page, 'library-book-chooser');
    expect(chooser.hasAttribute('hidden')).toBe(false);
    const rows = [...chooser.querySelectorAll<HTMLButtonElement>('button[data-action="choose-book"]')];
    expect(rows.length).toBe(2);
    expect(rows.every((row) => row.type === 'button')).toBe(true);
    expect(textOf(chooser)).toContain('先当参考');
    expect(textOf(chooser)).toContain('打不开');
    expect(chipsOf(page).length).toBe(1);
    expect(buttonByAction(page, 'switch-book').getAttribute('aria-expanded')).toBe('true');
  });

  it('换到没核对过的课本：chip 变成“待核实”，整页仍然只有一个', async () => {
    const { container } = await mountLibrary();
    await switchToBook(container, 'book.candidate.fixture');
    const page = pageRoot(container);
    expect(el(page, 'library-book-card').getAttribute('data-book-id')).toBe('book.candidate.fixture');
    expect(textOf(el(page, 'library-verified-chip'))).toBe('待核实');
    expect(chipsOf(page).length).toBe(1);
    expect(el(page, 'library-book-chooser').hasAttribute('hidden')).toBe(true);
    // 候选课本仍然可以开始，但会先要求确认
    expect(textOf(el(page, 'library-start'))).toBe('用这本开始');
  });

  it('打不开的课本写原因、不给“用这本开始”', async () => {
    const { container } = await mountLibrary();
    await switchToBook(container, 'book.unavailable.fixture');
    const page = pageRoot(container);
    expect(textOf(el(page, 'library-verified-chip'))).toBe('打不开');
    expect(page.querySelector('[data-testid="library-start"]')).toBeNull();
    expect(textOf(el(page, 'library-book-card'))).toContain('这个 PDF 打不开');
    expect(chipsOf(page).length).toBe(1);
  });

  it('没核对过的课本要先显式确认才能试看，确认后进入地图', async () => {
    const { container, library, shell } = await mountLibrary();
    await switchToBook(container, 'book.candidate.fixture');
    const page = pageRoot(container);
    const start = el<HTMLButtonElement>(page, 'library-start');
    start.focus();
    start.click();

    const dialog = container.querySelector<HTMLElement>('[data-edu-dialog="default"]');
    expect(dialog).not.toBeNull();
    const dialogText = textOf(dialog as HTMLElement);
    expect(dialogText).toContain('还没核对过');
    expect(dialogText).toContain('只能当参考');
    const confirm = buttonByAction(dialog as HTMLElement, 'confirm');
    expect(confirm.disabled).toBe(true);
    dialog?.querySelector<HTMLInputElement>('input[type="checkbox"]')?.click();
    expect(confirm.disabled).toBe(false);
    confirm.click();
    await tick(20);

    const state = library.controller.getState();
    expect(state.candidateTrialBookId).toBe('book.candidate.fixture');
    expect(state.books.find((book) => book.id === 'book.candidate.fixture')?.materialState).toBe('candidate');
    expect(shell.getState().currentPath).toBe('/map');

    // 回到课本页：试看提示一直在，退出后消失
    await shell.navigate('/library');
    await tick(20);
    const banner = el(pageRoot(container), 'library-candidate-banner');
    expect(textOf(banner)).toContain('正在试看');
    buttonByText(banner, '退出试看').click();
    await tick(20);
    expect(container.querySelector('[data-testid="library-candidate-banner"]')).toBeNull();
    expect(library.controller.getState().candidateTrialBookId).toBeNull();
  });

  it('核对过的课本点“用这本开始”直接进地图，不弹确认', async () => {
    const { container, shell } = await mountLibrary();
    el<HTMLButtonElement>(pageRoot(container), 'library-start').click();
    await tick(20);
    expect(shell.getState().currentPath).toBe('/map');
    expect(container.querySelector('[data-edu-dialog]')).toBeNull();
  });

  it('没有课本时给出下一步，不显示空课本', async () => {
    const { container } = await mountLibrary({ scenario: 'no-books' });
    expect(container.querySelector('[data-testid="library-empty"]')).not.toBeNull();
    expect(textOf(container)).toContain('还没有课本');
    expect(buttonByText(container, '选择本地 PDF')).toBeDefined();
    expect(container.querySelector('[data-testid="library-book-card"]')).toBeNull();
  });
});
