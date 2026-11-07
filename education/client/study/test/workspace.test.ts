import { afterEach, describe, expect, it } from 'vitest';
import {
  buttonByAction,
  buttonByText,
  byTestId,
  cleanupStudies,
  dispatchKeyOn,
  expectCleanStudentCopy,
  mountStudy,
  openSprout,
  pageRoot,
  setViewportWidth,
  textOf,
  tick,
} from './helpers.js';

afterEach(cleanupStudies);

describe('学习台：摊开的课本 + 练习本', () => {
  it('renders one desk with a textbook page and a work page, and no development words', async () => {
    const { container } = await mountStudy();
    const page = pageRoot(container);
    expect(page.dataset['pageId']).toBe('study');
    expect(page.querySelector('.edu-page__title')?.textContent).toBe('学习');

    // 一张台子，不许多张卡
    expect(container.querySelectorAll('[data-testid="study-desk"]')).toHaveLength(1);
    expect(container.querySelector('[data-testid="study-text-page"]')).not.toBeNull();
    const work = byTestId(container, 'study-work-page');
    expect(work.querySelector('[data-testid="study-question"] [data-testid="study-activity"]')).not.toBeNull();

    // 左页：课本（页脚页码、学习目标、可折叠的容易混淆 / 出处）
    const textbook = textOf(byTestId(container, 'study-text-page'));
    expect(textbook).toContain('课本原文');
    expect(textbook).toContain('课本第 12 页');
    expect(textbook).toContain('学习目标');
    expect(textbook).toContain('容易混淆');
    expect(textbook).toContain('这一页的出处');
    expect(textbook).toContain('— 12 —');
    expect(textbook).toContain('细胞');

    // 右页：题目（题干 + 整行选项/输入 + 底栏三件事）
    const question = textOf(byTestId(container, 'study-question'));
    expect(question).toContain('第 1 题');
    expect(question).toContain('回忆题');
    expect(question).toContain('细胞是什么');
    expect(textOf(work)).toContain('需要一点提示');
    expect(textOf(work)).toContain('先跳过');
    expect(textOf(work)).toContain('提交作答');

    // 反馈位就在右页里（原地展开），不是第二张卡
    const feedback = byTestId(container, 'study-feedback');
    expect(feedback.closest('[data-testid="study-work-page"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="study-feedback-slot"]')?.contains(feedback)).toBe(true);

    const text = textOf(page);
    expectCleanStudentCopy(page);
    expect(text).not.toMatch(/掌握率|\d+(?:\.\d+)?\s*%/);
    expect(text).not.toMatch(/\brem\b/i);
    expect(container.querySelector('[data-testid="edu-topbar"]')).not.toBeNull();
  });

  it('shows PDF page order and printed page separately in the source popover', async () => {
    const { container } = await mountStudy();
    const sources = byTestId(container, 'study-sources');
    const source = sources.querySelector<HTMLButtonElement>('button[data-action="study-source"]');
    expect(source).not.toBeNull();
    (source as HTMLButtonElement).focus();
    (source as HTMLButtonElement).click();
    const popover = container.querySelector<HTMLElement>('[data-testid="study-source-popover"]');
    expect(popover).not.toBeNull();
    // 学生界面只报课本页码；"PDF 页序""印刷页码"是内部定位术语（红线禁词）。
    expect(textOf(byTestId(container, 'study-source-printed'))).toContain('课本第 12 页');
    expect(textOf(popover as HTMLElement)).not.toContain('PDF');
    expect(textOf(popover as HTMLElement)).not.toContain('页序');
    expectCleanStudentCopy(popover as HTMLElement);
    dispatchKeyOn(container.querySelector('[data-edu-modal="true"] [role="dialog"]') as HTMLElement, 'Escape');
    expect(document.activeElement).toBe(source);
  });

  it('resumes the home cursor into the same study session', async () => {
    const { container, shell } = await mountStudy({ path: '/home' });
    buttonByAction(container, 'resume-last').click();
    await tick(50);
    expect(shell.getState().currentPath).toBe('/workspace');
    expect(shell.getState().resume?.activityId).toBe('activity.cell-recall');
    expect(textOf(pageRoot(container))).toContain('第 1 题');
    expect(textOf(pageRoot(container))).toContain('细胞');
  });

  it('shows an empty desk when nothing is selected yet', async () => {
    const { container } = await mountStudy({ path: '/workspace' });
    await tick(30);
    const text = textOf(pageRoot(container));
    expect(text).toContain('还没有选好这一节');
    expect(text).toContain('还没有打开题目');
    expect(text).toContain('去地图');
  });

  it('shows a readable error when the concept cannot be opened', async () => {
    const { container } = await mountStudy({ path: '/workspace?concept=concept.missing&mode=learn' });
    await tick(40);
    const text = textOf(pageRoot(container));
    expect(text).toContain('找不到这项内容');
    expect(text).toContain('返回地图');
    expectCleanStudentCopy(pageRoot(container));
  });

  it('explains incompatible content and offers old-record / library exits', async () => {
    const { container } = await mountStudy({ scenario: 'incompatible' });
    const page = pageRoot(container);
    const text = textOf(page);
    expect(text).toContain('内容版本不兼容');
    expect(text).toContain('0.9.0');
    expect(text).toContain('1.0.0');
    expect(text).toContain('旧记录仍可查看');
    expect(buttonByText(page, '查看旧记录')).toBeDefined();
    expect(buttonByText(page, '去教材库')).toBeDefined();
  });
});

describe('小芽：右下浮起按钮 + 右侧对话层', () => {
  it('opens a labelled sheet, moves focus inside, and Escape returns focus to the pill', async () => {
    const { container } = await mountStudy();
    const pill = byTestId<HTMLButtonElement>(container, 'ask-sprout-pill');
    const sheet = byTestId(container, 'sprout-sheet');
    expect(pill.textContent).toContain('问小芽');
    expect(pill.getAttribute('aria-controls')).toBe(sheet.id);
    expect(pill.getAttribute('aria-expanded')).toBe('false');
    expect(sheet.hasAttribute('hidden')).toBe(true);

    openSprout(container);
    expect(sheet.hasAttribute('hidden')).toBe(false);
    expect(pill.getAttribute('aria-expanded')).toBe('true');
    expect(sheet.contains(document.activeElement)).toBe(true);

    dispatchKeyOn(document.activeElement as HTMLElement, 'Escape');
    expect(sheet.hasAttribute('hidden')).toBe(true);
    expect(document.activeElement).toBe(pill);
  });

  it('offers 给我提示 / 解释一下 / 举个例子 and discloses a shown answer in plain words', async () => {
    const { container } = await mountStudy();
    const sheet = openSprout(container);
    expect(buttonByAction(sheet, 'help-hint')).toBeDefined();
    expect(buttonByAction(sheet, 'help-explanation')).toBeDefined();
    expect(buttonByAction(sheet, 'help-example')).toBeDefined();
    expect(textOf(sheet)).toContain('给我提示');
    expect(textOf(sheet)).toContain('解释一下');
    expect(textOf(sheet)).toContain('举个例子');
    buttonByAction(container, 'help-answer').click();
    await tick(20);
    const text = textOf(sheet);
    expect(text).toContain('用过提示');
    expect(text).toContain('不能作为独立');
    expect(text).toContain('不是惩罚');
  });

  it('keeps the textarea focusable and sends a message from the sheet', async () => {
    const { container, study } = await mountStudy();
    const sheet = openSprout(container);
    const input = sheet.querySelector<HTMLTextAreaElement>('textarea[aria-label="给小芽发消息"]');
    expect(input).not.toBeNull();
    expect(byTestId(sheet, 'sprout-send').getAttribute('data-action')).toBe('send-chat');
    (input as HTMLTextAreaElement).value = '为什么观察要有目的';
    (input as HTMLTextAreaElement).dispatchEvent(new Event('input', { bubbles: true }));
    (input as HTMLTextAreaElement).focus();
    byTestId<HTMLButtonElement>(sheet, 'sprout-send').click();
    await tick(30);
    expect(textOf(sheet)).toContain('为什么观察要有目的');
    expect(document.activeElement).toBe(sheet.querySelector('textarea[aria-label="给小芽发消息"]'));
    expect(study.controller.getState().messages.length).toBeGreaterThan(1);
  });

  it('keeps Tab inside the sheet while it is open', async () => {
    const { container } = await mountStudy();
    const sheet = openSprout(container);
    const focusables = [...sheet.querySelectorAll<HTMLElement>('button, textarea')];
    const last = focusables[focusables.length - 1] as HTMLElement;
    last.focus();
    dispatchKeyOn(last, 'Tab');
    expect(sheet.contains(document.activeElement)).toBe(true);
    expect(document.activeElement).toBe(focusables[0]);
  });
});

describe('窄屏：对开变单页，课本收进抽屉', () => {
  it('turns the textbook into a drawer below 1100px and closes it with Escape', async () => {
    setViewportWidth(1024);
    try {
      const { container } = await mountStudy();
      const desk = byTestId(container, 'study-desk');
      const toggle = byTestId<HTMLButtonElement>(container, 'study-material-toggle');
      const textbook = byTestId(container, 'study-text-page');
      expect(toggle.getAttribute('aria-controls')).toBe(textbook.id);
      expect(desk.dataset['materialOpen']).not.toBe('true');

      toggle.click();
      await tick(0);
      expect(desk.dataset['materialOpen']).toBe('true');
      expect(toggle.getAttribute('aria-expanded')).toBe('true');
      expect(document.activeElement).toBe(textbook);

      dispatchKeyOn(textbook, 'Escape');
      expect(desk.dataset['materialOpen']).toBe('false');
      expect(toggle.getAttribute('aria-expanded')).toBe('false');
      expect(document.activeElement).toBe(toggle);
    } finally {
      setViewportWidth(1280);
    }
  });

  it('brings the textbook back from the feedback on a wide screen', async () => {
    setViewportWidth(1440);
    try {
      const { container } = await mountStudy();
      const page = pageRoot(container);
      const input = page.querySelector<HTMLTextAreaElement>('textarea[aria-label="你的回答"]');
      expect(input).not.toBeNull();
      (input as HTMLTextAreaElement).value = '细胞是基本单位';
      (input as HTMLTextAreaElement).dispatchEvent(new Event('input', { bubbles: true }));
      buttonByText(page, '提交作答').click();
      await tick(40);
      buttonByAction(page, 'review-material').click();
      expect(document.activeElement).toBe(byTestId(container, 'study-text-page'));
    } finally {
      setViewportWidth(1280);
    }
  });
});
