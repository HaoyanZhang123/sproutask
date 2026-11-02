import { afterEach, describe, expect, it } from 'vitest';
import {
  buttonByAction,
  cleanupStudies,
  mountStudy,
  pageRoot,
  setAnswer,
  submitAnswer,
  textOf,
  tick,
} from './helpers.js';
import { evaluateLayout } from '../../shell/src/index.js';
import { studyStyles } from '../src/index.js';

afterEach(cleanupStudies);

describe('study accessibility, layout and shell registration', () => {
  it('takes over /workspace and fills the activity/feedback slots without touching map tests', async () => {
    const { container, shell } = await mountStudy();
    expect(shell.getState().currentPath).toContain('/workspace');
    expect(pageRoot(container).dataset['pageId']).toBe('study');
    expect(container.querySelector('[data-testid="study-activity-slot"] [data-testid="study-activity"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="study-feedback-slot"] [data-testid="study-feedback"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="study-visuals-slot"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="workspace-empty"]')).toBeNull();
    expect(container.querySelector('[data-testid="edu-context-bar"]')).not.toBeNull();
  });

  it('keeps a logical 1280x800 / 1440x900 layout without horizontal overflow', () => {
    for (const [width, height] of [
      [1280, 800],
      [1440, 900],
    ] as const) {
      const budget = evaluateLayout(width, height, 20);
      expect(budget.fits).toBe(true);
      expect(budget.horizontalOverflow).toBe(false);
    }
    expect(studyStyles).toContain('minmax(0, 1.05fr)');
    expect(studyStyles).toContain('minmax(0, 1fr)');
    expect(studyStyles).toContain('min-width: 0');
    expect(studyStyles).toContain('overflow-wrap: anywhere');
    for (const match of studyStyles.matchAll(/font-size:\s*([^;]+);/g)) {
      expect((match[1] ?? '').trim()).not.toMatch(/\d+px/);
    }
  });

  it('uses native controls, labelled inputs and moves focus to feedback after grading', async () => {
    const { container } = await mountStudy();
    for (const control of [...container.querySelectorAll<HTMLButtonElement>('button')]) {
      expect(control.type).toBe('button');
    }
    expect(container.querySelector('textarea[aria-label="你的回答"]')).not.toBeNull();
    expect(container.querySelector('textarea[aria-label="给学习助手发消息"]')).not.toBeNull();
    setAnswer(pageRoot(container), '细胞');
    submitAnswer(pageRoot(container));
    await tick(30);
    const active = document.activeElement as HTMLElement | null;
    expect(active?.closest('[data-testid="study-feedback-panel"]')).not.toBeNull();
  });

  it('uses text plus colour for status and never a mastery percentage', async () => {
    const { container } = await mountStudy();
    const chips = [...container.querySelectorAll<HTMLElement>('.edu-chip')];
    expect(chips.length).toBeGreaterThan(0);
    for (const chip of chips) {
      expect((chip.textContent ?? '').trim().length).toBeGreaterThan(0);
      expect(chip.dataset['tone']).toBeDefined();
    }
    expect(textOf(pageRoot(container))).not.toMatch(/掌握率|\d+(?:\.\d+)?\s*%/);
    expect(textOf(pageRoot(container))).not.toMatch(/终端|源码|插件市场|开发者工具|DevTools|Skill/i);
    expect(textOf(pageRoot(container))).not.toMatch(/sk-[A-Za-z0-9]|Bearer\s+[A-Za-z0-9]|E:\\\\|C:\\\\|node_modules|at Object\./);
  });
});
