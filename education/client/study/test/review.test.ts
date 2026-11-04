import { afterEach, describe, expect, it } from 'vitest';
import {
  buttonByAction,
  buttonByText,
  byTestId,
  cleanupStudies,
  expectCleanStudentCopy,
  mountStudy,
  pageRoot,
  setAnswer,
  submitAnswer,
  textOf,
  tick,
} from './helpers.js';

afterEach(cleanupStudies);

describe('复习模式', () => {
  it('shows the recommended range in the work page and can defer or skip before starting', async () => {
    const { container } = await mountStudy({ scenario: 'review-needs-support', path: '/workspace?mode=review' });
    const range = byTestId(container, 'study-review-range');
    const text = textOf(range);
    expect(text).toContain('复习范围');
    expect(text).toContain('已到复习时间');
    expect(text).toContain('最近证据显示需巩固');
    expect(text).toContain('暂缓一次');
    expect(range.closest('[data-testid="study-work-page"]')).not.toBeNull();

    buttonByAction(pageRoot(container), 'defer-review').click();
    await tick(20);
    expect(textOf(pageRoot(container))).toContain('已暂缓一次');
    buttonByAction(pageRoot(container), 'skip-review-range').click();
    await tick(10);
    expect(textOf(pageRoot(container))).toContain('已跳过推荐');
  });

  it('starts with recall, gives in-place feedback, and records review separately from due review', async () => {
    const { container, study } = await mountStudy({ scenario: 'review-needs-support', path: '/workspace?mode=review' });
    buttonByAction(pageRoot(container), 'start-review').click();
    await tick(40);
    expect(study.controller.getState().session?.state.mode).toBe('review');
    expect(textOf(pageRoot(container))).toContain('复习先回忆');

    setAnswer(pageRoot(container), '不知道');
    submitAnswer(pageRoot(container));
    await tick(40);
    expect(study.controller.getState().phase).toBe('feedback');
    expect(textOf(byTestId(container, 'study-feedback-grade'))).toContain('再练一次');

    buttonByAction(pageRoot(container), 'finish-round').click();
    await tick(40);
    expect(study.controller.getState().finishReceipt).not.toBeNull();
    const summary = textOf(byTestId(container, 'study-finish'));
    expect(summary).toContain('复习完成');
    expect(summary).toContain('待复习');
    expect(summary).toContain('复习安排');
    expect(summary).not.toMatch(/掌握率|\d+(?:\.\d+)?\s*%/);
    expectCleanStudentCopy(container);
    // 结果在原来的右页里，不另起一张卡
    expect(byTestId(container, 'study-finish').closest('[data-testid="study-feedback"]')).not.toBeNull();
  });

  it('allows adjusting the recommended range before starting', async () => {
    const { container, study } = await mountStudy({ scenario: 'review-needs-support', path: '/workspace?mode=review' });
    const first = container.querySelector<HTMLInputElement>('#review-concept\\.cell');
    const second = container.querySelector<HTMLInputElement>('#review-concept\\.cell-structure');
    expect(first).not.toBeNull();
    expect(second).not.toBeNull();
    first?.click();
    second?.click();
    buttonByAction(pageRoot(container), 'start-review').click();
    await tick(40);
    expect(study.controller.getState().session?.session.conceptId).toBe('concept.cell-structure');
    expect(study.controller.getState().session?.state.mode).toBe('review');
    expect(textOf(pageRoot(container))).toContain('图示标注题');
  });

  it('offers a self-selected path when the recommendation queue is empty', async () => {
    const { container } = await mountStudy({ scenario: 'review-empty', path: '/workspace?mode=review' });
    expect(textOf(pageRoot(container))).toContain('当前没有待复习项目');
    expect(buttonByText(pageRoot(container), '去地图自选')).toBeDefined();
  });
});
