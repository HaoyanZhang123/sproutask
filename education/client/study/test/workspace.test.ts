import { afterEach, describe, expect, it } from 'vitest';
import {
  buttonByAction,
  buttonByText,
  cleanupStudies,
  mountStudy,
  pageRoot,
  setAnswer,
  textOf,
  tick,
} from './helpers.js';

afterEach(cleanupStudies);

describe('study workspace layout and material', () => {
  it('renders material, activity, chat and feedback regions with fixture marking and no development entries', async () => {
    const { container } = await mountStudy();
    const page = pageRoot(container);
    expect(page.dataset['pageId']).toBe('study');
    expect(container.querySelector('[data-testid="study-material-panel"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="study-main-panel"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="study-chat-panel"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="study-feedback-panel"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="study-activity-slot"] [data-testid="study-activity"]')).not.toBeNull();
    const text = textOf(page);
    expect(text).toContain('演示数据（fixture）');
    expect(text).toContain('细胞');
    expect(text).toContain('学习目标');
    expect(text).toContain('材料');
    expect(text).toContain('学习助手');
    expect(text).toContain('反馈');
    expect(text).toContain('当前活动');
    expect(text).not.toMatch(/终端|源码|插件市场|开发者工具|DevTools|Skill/i);
    expect(text).not.toMatch(/掌握率|\d+(?:\.\d+)?\s*%/);
    expect(container.querySelector('[data-testid="edu-context-bar"]')).not.toBeNull();
    const context = textOf(container.querySelector('[data-testid="edu-context-bar"]') as HTMLElement);
    expect(context).toContain('教材');
    expect(context).toContain('当前概念');
    expect(context).toContain('模式');
    expect(context).toContain('本地保存');
    expect(context).toContain('返回位置');
  });

  it('shows PDF page order and printed page separately in the source popover', async () => {
    const { container } = await mountStudy();
    const source = buttonByAction(pageRoot(container), 'study-source');
    source.focus();
    source.click();
    const popover = container.querySelector<HTMLElement>('[data-testid="study-source-popover"]');
    expect(popover).not.toBeNull();
    expect(textOf(container.querySelector('[data-testid="study-source-pdf"]') as HTMLElement)).toContain('PDF 第 18 页');
    expect(textOf(container.querySelector('[data-testid="study-source-printed"]') as HTMLElement)).toContain('课本第 12 页');
    expect(textOf(popover as HTMLElement)).toContain('不同单位');
    dispatchEscape(container);
    expect(document.activeElement).toBe(source);
  });

  it('resumes the home cursor into the same study session', async () => {
    const { container, shell } = await mountStudy({ path: '/home' });
    buttonByAction(container, 'resume-last').click();
    await tick(50);
    expect(shell.getState().currentPath).toBe('/workspace');
    expect(shell.getState().resume?.activityId).toBe('activity.cell-recall');
    expect(textOf(pageRoot(container))).toContain('当前活动');
    expect(textOf(pageRoot(container))).toContain('细胞');
  });

  it('explains incompatible content and offers old-record / library exits', async () => {
    const { container } = await mountStudy({ scenario: 'incompatible' });
    const text = textOf(pageRoot(container));
    expect(text).toContain('内容版本不兼容');
    expect(text).toContain('0.9.0');
    expect(text).toContain('1.0.0');
    expect(buttonByText(pageRoot(container), '查看旧记录')).toBeDefined();
    expect(buttonByText(pageRoot(container), '去教材库')).toBeDefined();
  });

  it('exposes help/explanation/example/answer and discloses assistance in Chinese', async () => {
    const { container } = await mountStudy();
    const chat = container.querySelector<HTMLElement>('[data-testid="study-chat-panel"]') as HTMLElement;
    expect(buttonByAction(chat, 'help-hint')).toBeDefined();
    expect(buttonByAction(chat, 'help-explanation')).toBeDefined();
    expect(buttonByAction(chat, 'help-example')).toBeDefined();
    expect(buttonByAction(chat, 'help-worked_solution')).toBeDefined();
    expect(buttonByAction(chat, 'help-answer')).toBeDefined();
    buttonByAction(chat, 'help-answer').click();
    await tick(10);
    const text = textOf(chat);
    expect(text).toContain('disclosure');
    expect(text).toContain('不能作为独立');
    expect(text).toContain('不是惩罚');
  });
});

function dispatchEscape(root: HTMLElement): void {
  const dialog = root.querySelector<HTMLElement>('[data-edu-modal="true"] [role="dialog"]');
  if (dialog !== null) {
    dialog.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
  }
}
