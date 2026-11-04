import { afterEach, describe, expect, it } from 'vitest';
import {
  buttonByText,
  byTestId,
  cleanupStudies,
  dispatchKeyOn,
  expectCleanStudentCopy,
  mountStudy,
  openSprout,
  pageRoot,
  textOf,
  tick,
} from './helpers.js';
import { DESIGN_TOKENS, evaluateLayout } from '../../shell/src/index.js';
import { studyStyles } from '../src/index.js';

afterEach(cleanupStudies);

describe('学习台的无障碍、布局与时序', () => {
  it('takes over /workspace and fills the desk inside the shell', async () => {
    const { container, shell } = await mountStudy();
    expect(shell.getState().currentPath).toContain('/workspace');
    expect(pageRoot(container).dataset['pageId']).toBe('study');
    expect(container.querySelector('[data-testid="study-question"] [data-testid="study-activity"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="study-feedback-slot"] [data-testid="study-feedback"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="study-visuals-slot"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="workspace-empty"]')).toBeNull();
    expect(container.querySelector('[data-testid="edu-topbar"]')).not.toBeNull();
    expect(byTestId(container, 'ask-sprout-pill')).not.toBeNull();
    expect(byTestId(container, 'sprout-sheet')).not.toBeNull();
  });

  it('keeps a logical 1280x800 / 1440x900 / 1024x768 layout without horizontal overflow', () => {
    for (const [width, height] of [
      [1280, 800],
      [1440, 900],
      [1024, 768],
    ] as const) {
      const budget = evaluateLayout(width, height, 16);
      expect(budget.fits).toBe(true);
      expect(budget.horizontalOverflow).toBe(false);
    }
  });

  it('keeps every study rule on shell tokens and never hardcodes colour, size or px type', () => {
    expect(studyStyles).toContain('minmax(0, 0.9fr)');
    expect(studyStyles).toContain('minmax(0, 1.1fr)');
    expect(studyStyles).toContain('min-width: 0');
    expect(studyStyles).toContain('overflow-wrap: anywhere');
    // 窄屏断点来自 token：breakpoints.compact - 1
    expect(studyStyles).toContain(`@media (max-width: ${DESIGN_TOKENS.breakpoints.compact - 1}px)`);
    // 颜色只走 var(--edu-color-*) 或 DESIGN_TOKENS 插值：出现的色值必须就是 token 本身
    const tokenColours = new Set<string>(Object.values(DESIGN_TOKENS.colors));
    for (const match of studyStyles.matchAll(/#[0-9a-fA-F]{3,8}\b/g)) {
      expect(tokenColours.has(match[0])).toBe(true);
    }
    // 字号只用 token，不允许 px
    for (const match of studyStyles.matchAll(/font-size:\s*([^;]+);/g)) {
      expect((match[1] ?? '').trim()).not.toMatch(/\d+px/);
    }
    expect(studyStyles).toContain('var(--edu-focus-ring)');
    expect(studyStyles).toContain('outline-offset');
  });

  it('uses native controls, labelled inputs and moves focus to the in-place feedback', async () => {
    const { container } = await mountStudy();
    for (const control of [...container.querySelectorAll<HTMLButtonElement>('button')]) {
      expect(control.type).toBe('button');
    }
    expect(container.querySelector('textarea[aria-label="你的回答"]')).not.toBeNull();
    expect(container.querySelector('textarea[aria-label="给小芽发消息"]')).not.toBeNull();

    const page = pageRoot(container);
    const input = page.querySelector<HTMLTextAreaElement>('textarea[aria-label="你的回答"]');
    (input as HTMLTextAreaElement).value = '细胞';
    (input as HTMLTextAreaElement).dispatchEvent(new Event('input', { bubbles: true }));
    buttonByText(page, '提交作答').click();
    await tick(40);
    const active = document.activeElement as HTMLElement | null;
    expect(active?.closest('[data-testid="study-feedback"]')).not.toBeNull();
    // 反馈是 aria-live 区，键盘可达
    const feedback = byTestId(container, 'study-feedback');
    expect(feedback.getAttribute('tabindex')).toBe('-1');
    expectCleanStudentCopy(container);
    expect(feedback.closest('[data-testid="study-work-page"]')).not.toBeNull();
  });

  it('uses text plus colour for status and never a mastery percentage', async () => {
    const { container } = await mountStudy();
    const chips = [...container.querySelectorAll<HTMLElement>('.edu-chip')];
    expect(chips.length).toBeGreaterThan(0);
    for (const chip of chips) {
      expect((chip.textContent ?? '').trim().length).toBeGreaterThan(0);
      expect(chip.dataset['tone']).toBeDefined();
    }
    const text = textOf(pageRoot(container));
    expect(text).not.toMatch(/掌握率|\d+(?:\.\d+)?\s*%/);
    expect(text).not.toMatch(/终端|源码|插件市场|开发者工具|DevTools|Skill/i);
    expect(text).not.toMatch(/sk-[A-Za-z0-9]|Bearer\s+[A-Za-z0-9]|E:\\|C:\\|node_modules|at Object\./);
  });

  it('keeps the pill keyboard operable: Enter opens, Escape closes, focus comes back', async () => {
    const { container } = await mountStudy();
    const pill = byTestId<HTMLButtonElement>(container, 'ask-sprout-pill');
    pill.focus();
    pill.click();
    const sheet = byTestId(container, 'sprout-sheet');
    expect(sheet.hasAttribute('hidden')).toBe(false);
    dispatchKeyOn(document.activeElement as HTMLElement, 'Escape');
    expect(sheet.hasAttribute('hidden')).toBe(true);
    expect(document.activeElement).toBe(pill);
    // 再次打开不应把焦点丢在 body 上
    openSprout(container);
    expect(byTestId(container, 'sprout-sheet').contains(document.activeElement)).toBe(true);
  });
});
