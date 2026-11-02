import { afterEach, describe, expect, it } from 'vitest';
import {
  buttonByAction,
  buttonByText,
  cleanupStudies,
  mountStudy,
  pageRoot,
  setAnswer,
  submitAnswer,
  textOf,
  textarea,
  tick,
} from './helpers.js';

afterEach(cleanupStudies);

describe('activity state machine, draft and feedback', () => {
  it('autosaves the draft, submits before feedback, and shows three-axis feedback without percentages', async () => {
    const { container, study } = await mountStudy();
    setAnswer(pageRoot(container), '细胞是生物体结构和功能的基本单位');
    await tick(20);
    expect(study.controller.getState().draftStatus).toBe('saved');
    expect(textOf(pageRoot(container))).toContain('草稿已保存在本机');
    submitAnswer(pageRoot(container));
    await tick(30);
    expect(study.controller.getState().phase).toBe('feedback');
    const feedback = container.querySelector<HTMLElement>('[data-testid="study-feedback-grade"]');
    expect(feedback).not.toBeNull();
    expect(textOf(feedback as HTMLElement)).toContain('已达成');
    expect(textOf(feedback as HTMLElement)).toContain('评分版本');
    expect(textOf(feedback as HTMLElement)).toContain('证据候选');
    expect(textOf(feedback as HTMLElement)).toContain('1 条证据候选');
    expect(textOf(feedback as HTMLElement)).toContain('不能据此推断长期掌握');
    const active = document.activeElement as HTMLElement | null;
    expect(active?.closest('[data-testid="study-feedback-panel"]')).not.toBeNull();
    const source = (feedback as HTMLElement).querySelector<HTMLButtonElement>('button[data-source-ref="source.p18"]');
    expect(source).not.toBeNull();
    source?.click();
    expect(container.querySelector('[data-testid="study-source-popover"]')).not.toBeNull();
    expect(textOf(pageRoot(container))).toContain('三轴状态');
    expect(textOf(pageRoot(container))).not.toMatch(/掌握率|\d+(?:\.\d+)?\s*%/);
  });

  it('restores the same activity and draft after leaving and reopening /workspace', async () => {
    const { container, shell } = await mountStudy();
    setAnswer(pageRoot(container), '我保存的草稿');
    await tick(20);
    await shell.navigate('/map');
    await tick(10);
    await shell.navigate('/workspace?concept=concept.cell&mode=learn');
    await tick(30);
    expect(textarea(pageRoot(container)).value).toBe('我保存的草稿');
    expect(textOf(pageRoot(container))).toContain('草稿已保存在本机');
  });

  it('cancels an in-flight turn and discards a late result', async () => {
    const { container, study, data } = await mountStudy({ scenario: 'late' });
    setAnswer(pageRoot(container), '细胞');
    submitAnswer(pageRoot(container));
    await tick(20);
    expect(study.controller.getState().phase).toBe('grading');
    buttonByAction(pageRoot(container), 'cancel-turn').click();
    await tick(10);
    expect(study.controller.getState().phase).toBe('cancelled');
    expect(textOf(pageRoot(container))).toContain('已取消本次反馈');
    (data as import('../src/index.js').FixtureStudyDataSource).resolveLate();
    await tick(20);
    expect(study.controller.getState().phase).toBe('cancelled');
    expect(textOf(pageRoot(container))).toContain('迟到');
    expect(container.querySelector('[data-testid="study-feedback-grade"]')).toBeNull();
  });

  it('does not write a late result into another page or concept', async () => {
    const { container, shell, data } = await mountStudy({ scenario: 'late' });
    setAnswer(pageRoot(container), '细胞');
    submitAnswer(pageRoot(container));
    await tick(20);
    await shell.navigate('/map');
    await tick(10);
    (data as import('../src/index.js').FixtureStudyDataSource).resolveLate();
    await tick(20);
    expect(container.querySelector('[data-testid="study-feedback-grade"]')).toBeNull();
    await shell.navigate('/workspace?concept=concept.cell&mode=learn');
    await tick(20);
    expect(shell.getState().currentPath).toContain('/workspace');
  });

  it('keeps a skip as a non-punitive state and does not fake completion', async () => {
    const { container, study } = await mountStudy();
    buttonByAction(pageRoot(container), 'skip-question').click();
    await tick(20);
    expect(study.controller.getState().phase).toBe('draft');
    expect(textOf(pageRoot(container))).toContain('已跳过本题');
    expect(textOf(pageRoot(container))).toContain('不会记为答错');
    expect(study.controller.getState().finishReceipt).toBeNull();
  });

  it('shows clarification actions and does not judge an unclear answer as wrong', async () => {
    const { container } = await mountStudy({ scenario: 'clarify' });
    setAnswer(pageRoot(container), '不清楚');
    submitAnswer(pageRoot(container));
    await tick(30);
    const feedback = container.querySelector<HTMLElement>('[data-testid="study-feedback-grade"]');
    expect(feedback).not.toBeNull();
    const text = textOf(feedback as HTMLElement);
    expect(text).toContain('还需要确认');
    expect(text).toContain('不会判你答错');
    expect(text).toContain('重新拍一张');
    expect(text).toContain('改用文字作答');
  });

  it('offers retry after failed grading without duplicating the answer', async () => {
    const { container, study } = await mountStudy({ scenario: 'failed-grading' });
    setAnswer(pageRoot(container), '细胞');
    submitAnswer(pageRoot(container));
    await tick(30);
    expect(study.controller.getState().phase).toBe('failed');
    expect(textOf(pageRoot(container))).toContain('原答已经保存');
    buttonByAction(pageRoot(container), 'retry-grading').click();
    await tick(30);
    expect(study.controller.getState().phase).toBe('feedback');
    expect(container.querySelector('[data-testid="study-feedback-grade"]')).not.toBeNull();
  });

  it('keeps the draft and reports offline/unavailable feedback without faking a grade', async () => {
    const { container, study } = await mountStudy({ scenario: 'offline' });
    setAnswer(pageRoot(container), '细胞');
    submitAnswer(pageRoot(container));
    await tick(30);
    expect(study.controller.getState().phase).toBe('failed');
    expect(textOf(pageRoot(container))).toContain('云端反馈暂不可用');
    expect(textOf(pageRoot(container))).toContain('服务暂时不可用');
    expect(container.querySelector('[data-testid="study-feedback-grade"]')).toBeNull();
    expect(container.querySelector('textarea[aria-label="你的回答"]')).not.toBeNull();
    expect(buttonByAction(pageRoot(container), 'retry-grading')).toBeDefined();
    expect(buttonByAction(pageRoot(container), 'edit-answer')).toBeDefined();
  });

  it('separates self-report from the system understanding state', async () => {
    const { container, study } = await mountStudy();
    setAnswer(pageRoot(container), '细胞');
    submitAnswer(pageRoot(container));
    await tick(30);
    buttonByAction(pageRoot(container), 'self-report-can_explain').click();
    await tick(20);
    expect(study.controller.getState().selfReport?.claimedState).toBe('can_explain');
    expect(textOf(pageRoot(container))).toContain('自评（学生自述）');
    expect(textOf(pageRoot(container))).toContain('能解释');
    expect(textOf(pageRoot(container))).toContain('不替代系统证据');
  });

  it('offers a reduced-difficulty path after repeated failures and asks the service, not the UI, to decide', async () => {
    const { container, study } = await mountStudy();
    for (let index = 0; index < 2; index += 1) {
      if (index > 0) {
        buttonByAction(pageRoot(container), 'edit-answer').click();
        await tick(10);
      }
      setAnswer(pageRoot(container), '不知道');
      submitAnswer(pageRoot(container));
      await tick(30);
    }
    expect(study.controller.getState().tutorState?.consecutiveFailures).toBeGreaterThanOrEqual(2);
    const lower = buttonByAction(pageRoot(container), 'lower-difficulty');
    expect(lower.textContent).toContain('换一种讲法');
    lower.click();
    await tick(20);
    expect(textOf(pageRoot(container))).toContain('换一种更简单的讲法');
  });
});
