import { afterEach, describe, expect, it } from 'vitest';
import {
  buttonByAction,
  buttonByText,
  buttonsOf,
  cleanupLibraries,
  mountLibrary,
  pageRoot,
  textOf,
} from './helpers.js';

afterEach(cleanupLibraries);

describe('library book states', () => {
  it('separates baseline, candidate and unavailable material and keeps fixture marking visible', async () => {
    const { container } = await mountLibrary();
    const page = pageRoot(container);
    const text = textOf(page);
    expect(page.querySelector('[data-testid="library-group-baseline"]')).not.toBeNull();
    expect(page.querySelector('[data-testid="library-group-candidate"]')).not.toBeNull();
    expect(page.querySelector('[data-testid="library-group-unavailable"]')).not.toBeNull();
    expect(text).toContain('演示数据（fixture）');
    expect(text).toContain('本期匹配基准');
    expect(text).toContain('待核实候选');
    expect(text).toContain('不可用材料');
    expect(text).toContain('部分内容（未达全册）');
    expect(text).toContain('页数');
    expect(text).toContain('文件指纹');
    expect(text).toContain('候选 · 未核实 · 不可作为基准或强掌握结论');
    expect(text).toContain('PDF 交叉引用损坏');
    expect(text).not.toMatch(/掌握率|\d+(?:\.\d+)?\s*%/);
    expect(page.querySelector('[data-testid="library-book-book.candidate.fixture"]')?.getAttribute('data-state')).toBe('candidate');
  });

  it('requires explicit acknowledged candidate trial and never turns it into a baseline', async () => {
    const { container, library } = await mountLibrary();
    const page = pageRoot(container);
    expect(buttonsOf(page).some((entry) => entry.textContent?.trim() === '查看候选来源')).toBe(false);
    const trialButton = buttonByAction(page, 'trial-candidate');
    expect(trialButton.textContent).toContain('显式试用候选');
    trialButton.focus();
    trialButton.click();
    const dialog = container.querySelector<HTMLElement>('[data-edu-dialog="danger"]');
    expect(dialog).not.toBeNull();
    const dialogText = textOf(dialog as HTMLElement);
    expect(dialogText).toContain('候选内容未核实');
    expect(dialogText).toContain('不能作为基准');
    const confirm = buttonByAction(dialog as HTMLElement, 'confirm');
    expect(confirm.disabled).toBe(true);
    dialog?.querySelector<HTMLInputElement>('input[type="checkbox"]')?.click();
    expect(confirm.disabled).toBe(false);
    confirm.click();
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(container.querySelector('[data-testid="library-candidate-banner"]')).not.toBeNull();
    expect(textOf(pageRoot(container))).toContain('当前为候选试用（未核实）');
    expect(buttonsOf(pageRoot(container)).some((entry) => entry.textContent?.trim() === '查看候选来源')).toBe(true);
    const candidateBook = library.controller
      .getState()
      .books.find((book) => book.id === 'book.candidate.fixture');
    expect(candidateBook?.reviewState).toBe('candidate');
    expect(candidateBook?.materialState).toBe('candidate');
    expect(textOf(pageRoot(container))).not.toContain('本期匹配基准（已通过候选确认）');
    buttonByText(container.querySelector('[data-testid="library-candidate-banner"]') as HTMLElement, '退出候选试用').click();
    expect(container.querySelector('[data-testid="library-candidate-banner"]')).toBeNull();
  });

  it('shows a clear empty library and a file-selection next step', async () => {
    const { container } = await mountLibrary({ scenario: 'no-books' });
    expect(container.querySelector('[data-testid="library-empty"]')).not.toBeNull();
    expect(textOf(container)).toContain('还没有可用教材');
    expect(buttonByText(container, '选择本地 PDF')).toBeDefined();
  });
});
