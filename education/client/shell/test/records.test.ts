import { afterEach, describe, expect, it } from 'vitest';
import {
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

const BANNED = /内容包|activity\.|source\.|step-|三轴|证据候选|基准|回环|\brem\b|受控|本地保存|掌握百分比|覆盖率|评分版本/i;
const NOW = '2026-10-29T10:00:00Z';

function statText(container: HTMLElement, testId: string): string {
  const card = container.querySelector<HTMLElement>(`[data-testid="${testId}"]`);
  if (card === null) throw new Error(`stat card not found: ${testId}`);
  return (card.querySelector('.edu-progress-stat__value')?.textContent ?? '').trim();
}

function rows(container: HTMLElement): HTMLElement[] {
  return [...container.querySelectorAll<HTMLElement>('[data-testid="progress-row"]')];
}

function rowFor(container: HTMLElement, conceptId: string): HTMLElement {
  const found = container.querySelector<HTMLElement>(`[data-testid="progress-row"][data-concept-id="${conceptId}"]`);
  if (found === null) throw new Error(`row not found: ${conceptId}`);
  return found;
}

function triggerOf(row: HTMLElement): HTMLButtonElement {
  const found = row.querySelector<HTMLButtonElement>('button[data-action="toggle-row"]');
  if (found === null) throw new Error('row trigger not found');
  return found;
}

function detailOf(row: HTMLElement): HTMLElement {
  const trigger = triggerOf(row);
  const id = trigger.getAttribute('aria-controls');
  const found = id === null ? null : row.querySelector<HTMLElement>(`#${id}`);
  if (found === null) throw new Error('row detail not found');
  return found;
}

/** Local calendar day label, recomputed so the test is timezone-portable. */
function dayLabel(timestamp: string): string {
  const date = new Date(timestamp);
  const now = new Date(NOW);
  const dayStart = (value: Date): number => new Date(value.getFullYear(), value.getMonth(), value.getDate()).getTime();
  const dateText = `${date.getMonth() + 1} 月 ${date.getDate()} 日`;
  const days = Math.round((dayStart(now) - dayStart(date)) / 86400000);
  if (days === 0) return `今天 · ${dateText}`;
  if (days === 1) return `昨天 · ${dateText}`;
  return dateText;
}

describe('progress page', () => {
  it('shows three honest overview numbers and no percentage or ranking', async () => {
    const { container } = await mountShell(fixtureOptions('ready', '/records'));
    const page = pageRoot(container);
    expect(page.querySelector('h1')?.textContent).toBe('我的进展');

    expect(statText(container, 'progress-stat-learned')).toBe('2');
    expect(statText(container, 'progress-stat-practice')).toBe('1');
    expect(statText(container, 'progress-stat-due')).toBe('2');
    const overview = container.querySelector<HTMLElement>('[data-testid="progress-stats"]');
    const overviewText = textOf(overview as HTMLElement);
    expect(overviewText).toContain('学过的概念');
    expect(overviewText).toContain('全册 3 个');
    expect(overviewText).toContain('要再练一练');
    expect(overviewText).toContain('最近一次判断还需要再练');
    expect(overviewText).toContain('等待复习');
    expect(overviewText).toContain('到时间回来看看');

    const text = textOf(page);
    expect(hasPercent(text)).toBe(false);
    expect(text).not.toMatch(/掌握率|掌握百分比|综合战力|班级排名/);
    expect(text).not.toMatch(BANNED);
    // No internal identifiers leave the DOM as visible text.
    expect(text).not.toMatch(/activity\.|source\.|step-/);
    expect(text).not.toContain('内容覆盖计数');
    expect(text).not.toContain('四轴');
  });

  it('groups activity by day and shows the compact row summary', async () => {
    const { container } = await mountShell(fixtureOptions('ready', '/records'));
    const days = [...container.querySelectorAll<HTMLElement>('[data-testid="progress-day"]')];
    expect(days).toHaveLength(2);
    expect(textOf(days[0] as HTMLElement)).toContain(dayLabel('2026-10-29T08:00:00Z'));
    expect(textOf(days[1] as HTMLElement)).toContain(dayLabel('2026-10-28T08:00:00Z'));
    expect(rows(container)).toHaveLength(2);

    const cell = rowFor(container, 'concept.cell');
    expect(textOf(cell)).toContain('细胞');
    expect(textOf(cell)).toContain('答对了');
    expect(textOf(cell)).toContain('学习 · 2 题里答对 2 题');
    expect(textOf(cell)).toMatch(/学习 · 2 题里答对 2 题 · \d{2}:\d{2}/);
    expect(textOf(cell)).toContain('课本第 18 页');

    const structure = rowFor(container, 'concept.cell-structure');
    expect(textOf(structure)).toContain('细胞结构');
    expect(textOf(structure)).toContain('要再练');
    expect(textOf(structure)).toContain('学习 · 1 题里答对 0 题');
    expect(textOf(structure)).toContain('课本第 26 页');

    // Concepts with no activity yet do not invent a timeline row.
    expect(container.querySelector('[data-concept-id="concept.cell-division"]')).toBeNull();
  });

  it('expands a row to show what was seen, source pages and the student opinion', async () => {
    const { container } = await mountShell(fixtureOptions('ready', '/records'));
    const cell = rowFor(container, 'concept.cell');
    const trigger = triggerOf(cell);
    const detail = detailOf(cell);
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    expect(detail.hasAttribute('hidden')).toBe(true);

    trigger.focus();
    trigger.click();
    expect(trigger.getAttribute('aria-expanded')).toBe('true');
    expect(detail.hasAttribute('hidden')).toBe(false);
    expect(document.activeElement).toBe(trigger);

    const text = textOf(detail);
    expect(text).toContain('这次看到了什么');
    expect(text).toContain('解释');
    expect(text).toContain('迁移');
    expect(text).toContain('课本第 18 页');
    expect(text).toContain('你自己觉得呢？');
    expect(text).toContain('先记下你的感觉');

    const opinion = [...detail.querySelectorAll<HTMLButtonElement>('button[data-action="self-report"]')];
    expect(opinion.map((control) => (control.textContent ?? '').trim())).toEqual([
      '不确定',
      '基本会',
      '能解释',
    ]);
    const pressed = (label: string): string | null =>
      opinion.find((control) => (control.textContent ?? '').trim() === label)?.getAttribute('aria-pressed') ?? null;
    // The stored self-report is shown, not silently replaced.
    expect(pressed('能解释')).toBe('true');
    expect(pressed('不确定')).toBe('false');

    const uncertain = opinion.find((control) => (control.textContent ?? '').trim() === '不确定');
    uncertain?.click();
    expect(pressed('不确定')).toBe('true');
    expect(pressed('能解释')).toBe('false');
    expect(textOf(detail)).toContain('先记下你的感觉：不确定');

    // The opinion survives an in-page re-render (filter change).
    const select = container.querySelector<HTMLSelectElement>('#records-filter-concept');
    select!.value = 'concept.cell-structure';
    select!.dispatchEvent(new Event('change', { bubbles: true }));
    select!.value = 'all';
    select!.dispatchEvent(new Event('change', { bubbles: true }));
    const after = detailOf(rowFor(container, 'concept.cell'));
    const afterUncertain = [...after.querySelectorAll<HTMLButtonElement>('button[data-action="self-report"]')].find(
      (control) => (control.textContent ?? '').trim() === '不确定',
    );
    expect(afterUncertain?.getAttribute('aria-pressed')).toBe('true');
  });

  it('keeps one concept filter and recovers from an empty filter result', async () => {
    const { container } = await mountShell(fixtureOptions('ready', '/records'));
    const select = container.querySelector<HTMLSelectElement>('#records-filter-concept');
    expect(select).not.toBeNull();
    expect(container.querySelectorAll('#records-filter-mode')).toHaveLength(0);
    expect(container.querySelectorAll('#records-filter-time')).toHaveLength(0);

    select!.value = 'concept.cell';
    select!.dispatchEvent(new Event('change', { bubbles: true }));
    expect(rows(container)).toHaveLength(1);
    expect(container.querySelector('[data-concept-id="concept.cell-structure"]')).toBeNull();

    select!.value = 'concept.cell-division';
    select!.dispatchEvent(new Event('change', { bubbles: true }));
    const empty = container.querySelector<HTMLElement>('[data-testid="records-filter-empty"]');
    expect(empty).not.toBeNull();
    expect(textOf(empty as HTMLElement)).toContain('当前筛选没有记录');
    buttonByText(empty as HTMLElement, '清除筛选').click();
    expect(rows(container)).toHaveLength(2);
  });

  it('exports through the real api after explaining the impact', async () => {
    const { shell, container } = await mountShell(fixtureOptions('ready', '/records'));
    buttonByAction(container, 'export-records').click();
    const dialog = container.querySelector<HTMLElement>('[data-edu-dialog="default"]');
    expect(dialog).not.toBeNull();
    const text = textOf(dialog as HTMLElement);
    expect(text).toContain('导出学习记录');
    expect(text).toContain('导出内容');
    expect(text).toContain('不含课本原文');
    buttonByAction(dialog as HTMLElement, 'confirm').click();
    await tick(10);
    const status = container.querySelector<HTMLElement>('[data-testid="records-action-status"]');
    expect(textOf(status as HTMLElement)).toContain('已导出');
    expect(textOf(status as HTMLElement)).toContain('条记录');
    expect(shell.getState().currentPath).toBe('/records');
  });

  it('requires an acknowledgement before deleting and still mentions the textbook boundary', async () => {
    const { container } = await mountShell(fixtureOptions('ready', '/records'));
    buttonByAction(container, 'delete-records').click();
    const dialog = container.querySelector<HTMLElement>('[data-edu-dialog="danger"]');
    expect(dialog).not.toBeNull();
    const text = textOf(dialog as HTMLElement);
    expect(text).toContain('不可撤销');
    expect(text).toContain('课本文件不会被删除');
    expect(text).toContain('课本文件和课本原图不会被删除');
    const confirm = buttonByAction(dialog as HTMLElement, 'confirm');
    expect(confirm.disabled).toBe(true);
    const checkbox = dialog?.querySelector<HTMLInputElement>('input[type="checkbox"]');
    expect(checkbox).not.toBeNull();
    checkbox?.click();
    expect(confirm.disabled).toBe(false);
    confirm.click();
    await tick(30);
    expect(container.querySelector('[data-testid="records-empty"]')).not.toBeNull();
    expect(textOf(pageRoot(container))).toContain('还没有学习记录');
  });

  it('keeps removing the textbook link separate from deleting learning records', async () => {
    const { container } = await mountShell(fixtureOptions('ready', '/records'));
    buttonByAction(container, 'remove-book-link').click();
    const dialogs = [...container.querySelectorAll<HTMLElement>('[data-edu-dialog="danger"]')];
    const dialog = dialogs.find((candidate) => textOf(candidate).includes('移除这本课本'));
    expect(dialog).not.toBeUndefined();
    expect(textOf(dialog as HTMLElement)).toContain('不会删除课本源文件');
    const checkbox = dialog?.querySelector<HTMLInputElement>('input[type="checkbox"]');
    checkbox?.click();
    buttonByAction(dialog as HTMLElement, 'confirm').click();
    await tick(10);
    expect(textOf(pageRoot(container))).toContain('教材源文件没有被删除');
    expect(rows(container)).toHaveLength(2);
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
    // Data actions stay reachable even when there is nothing to show.
    expect(empty.container.querySelector('[data-testid="records-data-management"]')).not.toBeNull();
    await empty.shell.unmount();

    const offline = await mountShell(fixtureOptions('records-offline', '/records'));
    expect(textOf(offline.container)).toContain('当前离线');
    expect(rows(offline.container)).toHaveLength(2);
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
    expect(textOf(pending.container)).toContain('正在打开进展…');
    expect(pending.container.querySelector('[data-edu-state="loading"]')).not.toBeNull();
    await pending.shell.unmount();
  });

  it('keeps every status chip textual and the row trigger keyboard-operable', async () => {
    const { container } = await mountShell(fixtureOptions('ready', '/records'));
    const chips = [...pageRoot(container).querySelectorAll<HTMLElement>('.edu-chip')];
    expect(chips.length).toBeGreaterThan(3);
    for (const chip of chips) {
      expect((chip.textContent ?? '').trim().length).toBeGreaterThan(0);
      expect(chip.dataset['statusLabel']?.length ?? 0).toBeGreaterThan(0);
      expect(chip.getAttribute('data-tone')).not.toBeNull();
    }
    const trigger = triggerOf(rowFor(container, 'concept.cell'));
    expect(trigger.tagName).toBe('BUTTON');
    expect(trigger.tabIndex).toBeGreaterThanOrEqual(0);
    trigger.click();
    expect(trigger.getAttribute('aria-expanded')).toBe('true');
    trigger.click();
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
  });
});
