import { afterEach, describe, expect, it } from 'vitest';
import {
  bodyTextExcludingStyle,
  buttonByAction,
  buttonByText,
  cleanupShells,
  fixtureOptions,
  hasPercent,
  mountShell,
  pageRoot,
  startShell,
  textOf,
  tick,
} from './helpers.js';

afterEach(cleanupShells);

describe('records and evidence', () => {
  it('renders the three axes separately, keeps self-report independent and shows no mastery percentage', async () => {
    const { container } = await mountShell(fixtureOptions('ready', '/records'));
    const page = pageRoot(container);
    const text = textOf(page);
    expect(page.querySelector('[data-axis="learning"]')).not.toBeNull();
    expect(page.querySelector('[data-axis="understanding"]')).not.toBeNull();
    expect(page.querySelector('[data-axis="review"]')).not.toBeNull();
    expect(page.querySelector('[data-axis="self-report"]')).not.toBeNull();
    expect(text).toContain('本轮已完成');
    expect(text).toContain('表现稳定');
    expect(text).toContain('已复习');
    expect(text).toContain('待复习');
    expect(text).toContain('自评（学生自述）');
    expect(text).toContain('能解释');
    expect(text).toContain('判断变化');
    expect(text).toContain('示例历史判断');
    expect(hasPercent(text)).toBe(false);
    expect(text).not.toMatch(/掌握率|掌握百分比|综合战力|班级排名/);
    expect(text).not.toMatch(/sk-[A-Za-z0-9]|Bearer\s+[A-Za-z0-9]|api[_-]?key\s*=|C:\\\\|E:\\\\|node_modules|at Object\./);
  });

  it('opens a single judgment rationale with evidence, time and versions, then Escape restores focus', async () => {
    const { container } = await mountShell(fixtureOptions('ready', '/records'));
    const card = container.querySelector<HTMLElement>('[data-testid="record-concept.cell"]');
    expect(card).not.toBeNull();
    const trigger = buttonByAction(card as HTMLElement, 'open-evidence');
    trigger.focus();
    trigger.click();
    const modal = container.querySelector<HTMLElement>('[data-edu-modal="true"]');
    expect(modal).not.toBeNull();
    expect(modal?.hasAttribute('hidden')).toBe(false);
    const detail = container.querySelector<HTMLElement>('[data-testid="edu-evidence-detail"]');
    expect(detail).not.toBeNull();
    const text = textOf(detail as HTMLElement);
    expect(text).toContain('判断依据：细胞');
    expect(text).toContain('理由');
    expect(text).toContain('评分标准版本');
    expect(text).toContain('判断器版本');
    expect(text).toContain('内容包版本');
    expect(text).toContain('fixture observation');
    expect(text).toContain('独立完成');
    expect(text).toContain('source.p18');
    const dialog = modal?.querySelector<HTMLElement>('[role="dialog"]');
    expect(dialog).not.toBeNull();
    dialog?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    expect(modal?.hasAttribute('hidden')).toBe(true);
    expect(document.activeElement).toBe(trigger);
  });

  it('allows both the old and current judgment rationale to be reopened', async () => {
    const { container } = await mountShell(fixtureOptions('ready', '/records'));
    const history = container.querySelector<HTMLElement>('[data-testid="record-assessment-history"]');
    expect(history).not.toBeNull();
    const buttons = history?.querySelectorAll<HTMLButtonElement>('[data-action="open-historical-evidence"]') ?? [];
    expect(buttons.length).toBe(2);
    buttons[0]?.focus();
    buttons[0]?.click();
    const detail = container.querySelector<HTMLElement>('[data-testid="edu-evidence-detail"]');
    expect(detail).not.toBeNull();
    const text = textOf(detail as HTMLElement);
    expect(text).toContain('初步理解');
    expect(text).toContain('示例历史判断');
    const dialog = container.querySelector<HTMLElement>('[data-edu-modal="true"] [role="dialog"]');
    dialog?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
  });

  it('filters by concept/mode and clears an empty filter result', async () => {
    const { container } = await mountShell(fixtureOptions('ready', '/records'));
    const conceptSelect = container.querySelector<HTMLSelectElement>('#records-filter-concept');
    expect(conceptSelect).not.toBeNull();
    if (conceptSelect === null) return;
    conceptSelect.value = 'concept.cell-structure';
    conceptSelect.dispatchEvent(new Event('change', { bubbles: true }));
    expect(container.querySelector('[data-testid="record-concept.cell-structure"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="record-concept.cell"]')).toBeNull();

    const modeSelect = container.querySelector<HTMLSelectElement>('#records-filter-mode');
    expect(modeSelect).not.toBeNull();
    if (modeSelect === null) return;
    modeSelect.value = 'review';
    modeSelect.dispatchEvent(new Event('change', { bubbles: true }));
    const empty = container.querySelector<HTMLElement>('[data-testid="records-filter-empty"]');
    expect(empty).not.toBeNull();
    expect(textOf(empty as HTMLElement)).toContain('当前筛选没有记录');
    buttonByText(empty as HTMLElement, '清除筛选').click();
    expect(container.querySelector('[data-testid="record-concept.cell"]')).not.toBeNull();
  });

  it('explains export impact and confirms before exporting', async () => {
    const { container } = await mountShell(fixtureOptions('ready', '/records'));
    buttonByAction(container, 'export-records').click();
    const dialog = container.querySelector<HTMLElement>('[data-edu-dialog="default"]');
    expect(dialog).not.toBeNull();
    const text = textOf(dialog as HTMLElement);
    expect(text).toContain('导出内容');
    expect(text).toContain('不会包含教材原文件');
    expect(text).toContain('保存到你选择的位置');
    buttonByAction(dialog as HTMLElement, 'confirm').click();
    await tick(10);
    const status = container.querySelector<HTMLElement>('[data-testid="records-action-status"]');
    expect(textOf(status as HTMLElement)).toContain('已导出');
  });

  it('requires an acknowledgement before deleting learning records and states the source-file boundary', async () => {
    const { container } = await mountShell(fixtureOptions('ready', '/records'));
    buttonByAction(container, 'delete-records').click();
    const dialog = container.querySelector<HTMLElement>('[data-edu-dialog="danger"]');
    expect(dialog).not.toBeNull();
    const text = textOf(dialog as HTMLElement);
    expect(text).toContain('不可撤销');
    expect(text).toContain('教材文件');
    expect(text).toContain('不会被删除');
    const confirm = buttonByAction(dialog as HTMLElement, 'confirm');
    expect(confirm.disabled).toBe(true);
    const checkbox = dialog?.querySelector<HTMLInputElement>('input[type="checkbox"]');
    expect(checkbox).not.toBeNull();
    checkbox?.click();
    expect(confirm.disabled).toBe(false);
    confirm.click();
    await tick(20);
    expect(container.querySelector('[data-testid="records-empty"]')).not.toBeNull();
    expect(textOf(pageRoot(container))).toContain('还没有学习记录');
  });

  it('separates removing the book link from deleting records', async () => {
    const { container } = await mountShell(fixtureOptions('ready', '/records'));
    buttonByAction(container, 'remove-book-link').click();
    const dialogs = [...container.querySelectorAll<HTMLElement>('[data-edu-dialog="danger"]')];
    const dialog = dialogs.find((candidate) => textOf(candidate).includes('移除这本教材'));
    expect(dialog).not.toBeUndefined();
    expect(textOf(dialog as HTMLElement)).toContain('不会删除教材源文件');
    const checkbox = dialog?.querySelector<HTMLInputElement>('input[type="checkbox"]');
    checkbox?.click();
    buttonByAction(dialog as HTMLElement, 'confirm').click();
    await tick(10);
    expect(textOf(pageRoot(container))).toContain('教材源文件没有被删除');
  });

  it('shows the unsaved state with retry and copy actions', async () => {
    const { container } = await mountShell(fixtureOptions('save-failed', '/records'));
    const banner = container.querySelector<HTMLElement>('[data-testid="edu-save-failed"]');
    expect(banner).not.toBeNull();
    expect(textOf(banner as HTMLElement)).toContain('尚未保存');
    expect(buttonByText(banner as HTMLElement, '重试保存')).toBeDefined();
    expect(buttonByText(banner as HTMLElement, '复制文字')).toBeDefined();
  });

  it('renders empty, offline, error and loading states with Chinese recovery actions', async () => {
    const empty = await mountShell(fixtureOptions('records-empty', '/records'));
    expect(empty.container.querySelector('[data-testid="records-empty"]')).not.toBeNull();
    expect(textOf(empty.container)).toContain('还没有学习记录');
    await empty.shell.unmount();

    const offline = await mountShell(fixtureOptions('records-offline', '/records'));
    expect(textOf(offline.container)).toContain('当前离线');
    expect(offline.container.querySelector('[data-testid="record-concept.cell"]')).not.toBeNull();
    expect(buttonByText(offline.container, '重试连接')).toBeDefined();
    await offline.shell.unmount();

    const error = await mountShell(fixtureOptions('records-error', '/records'));
    const alert = error.container.querySelector<HTMLElement>('[role="alert"]');
    expect(alert).not.toBeNull();
    expect(textOf(alert as HTMLElement)).toContain('本地保存没有完成');
    expect(buttonByText(alert as HTMLElement, '重试保存')).toBeDefined();
    expect(buttonByText(alert as HTMLElement, '返回首页')).toBeDefined();
    await error.shell.unmount();

    const pending = startShell(fixtureOptions('records-pending', '/records'));
    await tick(10);
    expect(textOf(pending.container)).toContain('正在打开记录…');
    expect(pending.container.querySelector('[data-edu-state="loading"]')).not.toBeNull();
    await pending.shell.unmount();
  });
});
