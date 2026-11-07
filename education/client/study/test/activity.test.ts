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
  textarea,
  tick,
} from './helpers.js';

afterEach(cleanupStudies);

describe('题目、草稿与原地反馈', () => {
  it('autosaves the draft, submits before feedback, and shows the in-place result without internal words', async () => {
    const { container, study } = await mountStudy();
    setAnswer(pageRoot(container), '细胞是生物体结构和功能的基本单位');
    await tick(20);
    expect(study.controller.getState().draftStatus).toBe('saved');
    expect(textOf(byTestId(container, 'study-draft-status'))).toContain('草稿已保存在本机');

    submitAnswer(pageRoot(container));
    await tick(40);
    expect(study.controller.getState().phase).toBe('feedback');

    // 原地反馈：结论 chip + 一句结论 + 依据 + 出处 + 下一步
    const feedback = byTestId(container, 'study-feedback-grade');
    expect(feedback.closest('[data-testid="study-feedback"]')).not.toBeNull();
    const text = textOf(feedback);
    expect(text).toContain('答对了');
    expect(text).toContain('你已经说清了细胞是生物体结构和功能的基本单位');
    expect(text).toContain('下一次可以尝试用不同细胞的例子迁移');
    expect(text).toContain('自己想的，没用提示');
    expect(text).toContain('这次看的是哪些要点');
    expect(text).toContain('说到了');
    expect(text).toContain('不能据此推断长期掌握');
    expect(text).not.toContain('证据候选');
    expect(text).not.toContain('评分版本');
    expect(text).not.toContain('三轴');

    // 下一步：下一题（这一节还有题）+ 再看看材料（ghost）
    expect(buttonByAction(feedback, 'next-question').textContent).toContain('下一题');
    expect(buttonByAction(feedback, 'review-material').textContent).toContain('再看看材料');
    // 答对后不再出现「改文字再试」
    expect(feedback.querySelector('button[data-action="edit-answer"]')).toBeNull();

    expectCleanStudentCopy(pageRoot(container));

    // 交卷后不再挂着「草稿已保存」
    expect(byTestId(container, 'study-draft-status').dataset['state']).toBe('none');

    // 提交后焦点落在原地反馈里
    expect(document.activeElement?.closest('[data-testid="study-feedback"]')).not.toBeNull();

    // 提交后仍能看到自己写了什么（回显在题目下方）
    expect(textOf(byTestId(container, 'study-answer-echo'))).toContain('细胞是生物体结构和功能的基本单位');

    // 出处是可点的 chip，点开仍是同一个出处弹层
    const source = feedback.querySelector<HTMLButtonElement>('button[data-source-ref="source.p18"]');
    expect(source).not.toBeNull();
    expect(source?.textContent).toContain('课本第 12 页');
    source?.click();
    expect(container.querySelector('[data-testid="study-source-popover"]')).not.toBeNull();
  });

  it('moves to the next question with the existing load path', async () => {
    const { container, study } = await mountStudy();
    setAnswer(pageRoot(container), '细胞');
    submitAnswer(pageRoot(container));
    await tick(40);
    expect(study.controller.getState().workspace?.activity.id).toBe('activity.cell-recall');

    buttonByAction(byTestId(container, 'study-feedback'), 'next-question').click();
    await tick(60);
    expect(study.controller.getState().workspace?.activity.id).toBe('activity.cell-explain');
    expect(textOf(pageRoot(container))).toContain('第 2 题，共 5 题');
    expect(textOf(pageRoot(container))).toContain('fixture explain');
    expect(study.controller.getState().phase).toBe('draft');
  });

  it('keeps an unsaved draft visible in plain words instead of pretending it saved', async () => {
    const { container, study } = await mountStudy({ scenario: 'draft-failed' });
    setAnswer(pageRoot(container), '细胞是基本单位');
    await tick(30);
    expect(study.controller.getState().draftStatus).toBe('failed');
    const status = byTestId(container, 'study-draft-status');
    expect(status.dataset['state']).toBe('failed');
    expect(textOf(status)).toContain('离开前请重试');
    // 答案还在页面里，不会因为没保存就丢掉
    expect(textarea(pageRoot(container)).value).toBe('细胞是基本单位');
  });

  it('restores the same activity and draft after leaving and reopening /workspace', async () => {
    const { container, shell } = await mountStudy();
    setAnswer(pageRoot(container), '我保存的草稿');
    await tick(20);
    await shell.navigate('/map');
    await tick(10);
    await shell.navigate('/workspace?concept=concept.cell&mode=learn');
    await tick(40);
    expect(textarea(pageRoot(container)).value).toBe('我保存的草稿');
    expect(textOf(byTestId(container, 'study-draft-status'))).toContain('草稿已保存在本机');
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

  it('keeps a skip as a non-punitive state and moves to the next question', async () => {
    const { container, study } = await mountStudy();
    const firstActivity = study.controller.getState().workspace?.activity.id;
    buttonByAction(pageRoot(container), 'skip-question').click();
    await tick(60);
    const state = study.controller.getState();
    expect(state.phase).toBe('draft');
    expect(state.finishReceipt).toBeNull();
    // 跳过不等于完成，但要能换到下一题；学习记录里不会记成答错。
    expect(state.workspace?.activity.id).not.toBe(firstActivity);
  });

  it('shows clarification actions and does not judge an unclear answer as wrong', async () => {
    const { container } = await mountStudy({ scenario: 'clarify' });
    setAnswer(pageRoot(container), '不清楚');
    submitAnswer(pageRoot(container));
    await tick(40);
    const feedback = byTestId(container, 'study-feedback-grade');
    const text = textOf(feedback);
    expect(text).toContain('还需要再看看');
    expect(text).toContain('不会判你答错');
    expect(text).toContain('重新拍一张');
    expect(text).toContain('改用文字作答');
    expectCleanStudentCopy(pageRoot(container));
  });

  it('offers retry after failed grading without duplicating the answer', async () => {
    const { container, study } = await mountStudy({ scenario: 'failed-grading' });
    setAnswer(pageRoot(container), '细胞');
    submitAnswer(pageRoot(container));
    await tick(40);
    expect(study.controller.getState().phase).toBe('failed');
    expect(textOf(pageRoot(container))).toContain('原答已经保存');
    buttonByAction(pageRoot(container), 'retry-grading').click();
    await tick(40);
    expect(study.controller.getState().phase).toBe('feedback');
    expect(container.querySelector('[data-testid="study-feedback-grade"]')).not.toBeNull();
  });

  it('keeps the draft and reports offline/unavailable feedback without faking a grade', async () => {
    const { container, study } = await mountStudy({ scenario: 'offline' });
    setAnswer(pageRoot(container), '细胞');
    submitAnswer(pageRoot(container));
    await tick(40);
    expect(study.controller.getState().phase).toBe('failed');
    expect(textOf(pageRoot(container))).toContain('云端反馈暂不可用');
    expect(textOf(pageRoot(container))).toContain('服务暂时不可用');
    expect(container.querySelector('[data-testid="study-feedback-grade"]')).toBeNull();
    expect(container.querySelector('textarea[aria-label="你的回答"]')).not.toBeNull();
    expect(buttonByAction(pageRoot(container), 'retry-grading')).toBeDefined();
    expect(buttonByAction(pageRoot(container), 'edit-answer')).toBeDefined();
    expectCleanStudentCopy(pageRoot(container));
  });

  it('separates self-report from the learning-record state', async () => {
    const { container, study } = await mountStudy();
    setAnswer(pageRoot(container), '细胞');
    submitAnswer(pageRoot(container));
    await tick(40);
    expect(textOf(pageRoot(container))).toContain('你觉得自己学会了吗');
    buttonByAction(pageRoot(container), 'self-report-can_explain').click();
    await tick(20);
    expect(study.controller.getState().selfReport?.claimedState).toBe('can_explain');
    const selfReport = textOf(byTestId(container, 'study-self-report'));
    expect(selfReport).toContain('选一个，记下来。');
    expect(selfReport).toContain('能解释');
    expect(selfReport).not.toContain('单独保存');
    expect(selfReport).not.toContain('系统证据');
    expect(selfReport).not.toContain('不替代');
    expect(textOf(pageRoot(container))).toContain('学习状态');
    expectCleanStudentCopy(pageRoot(container));
  });


  it('offers 改文字再试 only when the answer needs another try', async () => {
    const { container } = await mountStudy();
    setAnswer(pageRoot(container), '不知道');
    submitAnswer(pageRoot(container));
    await tick(40);
    const feedback = byTestId(container, 'study-feedback-grade');
    expect(textOf(feedback)).toContain('再练一次');
    expect(buttonByAction(feedback, 'edit-answer')).toBeDefined();
    expectCleanStudentCopy(feedback);
  });

  it('keeps one conclusion, translates internal grading words and dedupes source pages', async () => {
    const { container } = await mountStudy({ scenario: 'model-dup' });
    setAnswer(pageRoot(container), '细胞是生物体结构和功能的基本单位');
    submitAnswer(pageRoot(container));
    await tick(40);
    const feedback = byTestId(container, 'study-feedback-grade');
    const text = textOf(feedback);

    // 同一句只出现一次，而且「答案键」已经翻译
    const conclusion = '选项与正确答案完全一致。';
    expect(text.split(conclusion).length - 1).toBe(1);
    expect(text).not.toContain('答案键');
    expect(text).not.toContain('criterion');
    expect(text).not.toContain('option.b');
    expect(text).toContain('要点');
    // 只复述对错的句子删掉
    expect(text).not.toContain('选择正确');

    // 出处：同页去重、最多 3 个、没有兜底 chip、对不上页的引用不显示
    const chips = [...feedback.querySelectorAll<HTMLButtonElement>('[data-testid="study-feedback-sources"] button')];
    expect(chips.length).toBeLessThanOrEqual(3);
    // 没有课本页码的出处不显示页码，也不回退成内部 PDF 页码（红线禁词）。
    expect(chips.map((chip) => chip.textContent)).toEqual(['课本第 12 页', '课本原文']);
    expect(text).not.toContain('出处在课本里');

    // 答对时只留 下一题 / 再看看材料
    expect(buttonByAction(feedback, 'next-question')).toBeDefined();
    expect(feedback.querySelector('button[data-action="edit-answer"]')).toBeNull();
    expectCleanStudentCopy(pageRoot(container));
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
      await tick(40);
    }
    expect(study.controller.getState().tutorState?.consecutiveFailures).toBeGreaterThanOrEqual(2);
    const lower = buttonByAction(pageRoot(container), 'lower-difficulty');
    expect(lower.textContent).toContain('换一种讲法');
    lower.click();
    await tick(20);
    expect(textOf(pageRoot(container))).toContain('换一种更简单的讲法');
  });
});
