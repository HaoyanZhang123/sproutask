import { afterEach, describe, expect, it } from 'vitest';
import { buttonByAction, buttonByText, cleanupShells, fixtureOptions, mountShell, pageRoot, textOf, tick } from './helpers.js';

afterEach(cleanupShells);

describe('home continue / map / review', () => {
  it('renders the exact saved cursor and resumes the same activity', async () => {
    const { shell, container } = await mountShell(fixtureOptions());
    const card = container.querySelector<HTMLElement>('[data-testid="home-continue"]');
    expect(card).not.toBeNull();
    const cardText = textOf(card as HTMLElement);
    expect(cardText).toContain('细胞');
    expect(cardText).toContain('学习');
    expect(cardText).toContain('activity.cell-recall');
    expect(cardText).toContain('step-1');
    expect(cardText).toContain('已保存草稿');

    buttonByAction(pageRoot(container), 'resume-last').click();
    await tick(10);
    expect(shell.getState().currentPath).toBe('/workspace');
    const resume = shell.getState().resume;
    expect(resume?.activityId).toBe('activity.cell-recall');
    expect(resume?.cursor).toBe('step-1');
    expect(resume?.session.id).toBe('session.cell.1');
    const text = textOf(pageRoot(container));
    expect(text).toContain('已恢复上次活动');
    expect(text).toContain('activity.cell-recall');
    expect(text).toContain('step-1');
    expect(text).toContain('已恢复本机草稿');
  });

  it('offers review/re-learn choices after a completed session instead of faking a resume', async () => {
    const { container } = await mountShell(fixtureOptions('completed-only'));
    const card = container.querySelector<HTMLElement>('[data-testid="home-completed"]');
    expect(card).not.toBeNull();
    const text = textOf(card as HTMLElement);
    expect(text).toContain('上次学习已完成');
    expect(text).toContain('细胞结构');
    expect(buttonByText(card as HTMLElement, '再学一次')).toBeDefined();
    expect(buttonByText(card as HTMLElement, '开始复习')).toBeDefined();
    expect(container.querySelector('[data-testid="home-continue"]')).toBeNull();
  });

  it('shows a clear first-use entry without inventing a last record', async () => {
    const { container } = await mountShell(fixtureOptions('first-run'));
    const card = container.querySelector<HTMLElement>('[data-testid="home-first-use"]');
    expect(card).not.toBeNull();
    expect(textOf(card as HTMLElement)).toContain('选择教材，开始学习');
    expect(container.querySelector('[data-testid="home-continue"]')).toBeNull();
    expect(container.querySelector('[data-testid="home-completed"]')).toBeNull();
  });

  it('explains incompatible content and keeps old records reachable', async () => {
    const { container } = await mountShell(fixtureOptions('incompatible'));
    const notice = container.querySelector<HTMLElement>('[data-testid="home-incompatible"]');
    expect(notice).not.toBeNull();
    const text = textOf(notice as HTMLElement);
    expect(text).toContain('0.9.0');
    expect(text).toContain('1.0.0');
    expect(text).toContain('不会自动迁移');
    expect(buttonByText(notice as HTMLElement, '查看旧记录')).toBeDefined();
    expect(buttonByText(notice as HTMLElement, '重新关联')).toBeDefined();
    expect(buttonByText(notice as HTMLElement, '开始新活动')).toBeDefined();
  });

  it('reports a failed resume and keeps old-record / library exits', async () => {
    const { shell, container } = await mountShell(fixtureOptions('resume-fails'));
    buttonByAction(pageRoot(container), 'resume-last').click();
    await tick(10);
    expect(shell.getState().currentPath).toBe('/home');
    const alert = container.querySelector<HTMLElement>('[role="alert"]');
    expect(alert).not.toBeNull();
    const text = textOf(alert as HTMLElement);
    expect(text).toContain('内容已经有了更新');
    expect(text).toContain('STALE_REVISION');
    expect(buttonByText(alert as HTMLElement, '查看旧记录')).toBeDefined();
    expect(shell.getState().resume).toBeNull();
  });

  it('opens review mode in the workspace from the home review entry', async () => {
    const { shell, container } = await mountShell(fixtureOptions());
    buttonByText(pageRoot(container), '开始复习').click();
    await tick(20);
    expect(shell.getState().currentPath).toContain('/workspace?mode=review');
    const text = textOf(pageRoot(container));
    expect(text).toContain('准备开始：复习');
    expect(text).toContain('请选择要复习的范围');
    expect(textOf(container.querySelector('[data-testid="edu-context-bar"]') as HTMLElement)).toContain('复习');
  });

  it('still offers a self-selected review range when nothing is due', async () => {
    const { container } = await mountShell(fixtureOptions('no-due'));
    const review = container.querySelector<HTMLElement>('[data-testid="home-review"]');
    expect(review).not.toBeNull();
    expect(textOf(review as HTMLElement)).toContain('当前没有待复习项目');
    expect(buttonByText(review as HTMLElement, '自选复习范围')).toBeDefined();
  });
});
