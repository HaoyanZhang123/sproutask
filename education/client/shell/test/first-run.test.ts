import { afterEach, describe, expect, it } from 'vitest';
import { buttonByText, cleanupShells, fixtureOptions, mountShell, pageRoot, textOf, tick } from './helpers.js';

afterEach(cleanupShells);

describe('first use', () => {
  it('explains local storage vs cloud feedback and the current textbook', async () => {
    const { container } = await mountShell(fixtureOptions('ready', '/first-run'));
    const text = textOf(pageRoot(container));
    expect(text).toContain('学习记录保存在这台电脑');
    expect(text).toContain('发给模型服务');
    expect(text).toContain('不会上传整本教材');
    expect(text).not.toContain('本地匿名档案');
    expect(text).toContain('当前教材');
    expect(text).toContain('内容按课本整理');
    expect(text).toContain('短诊断');
    expect(text).toContain('道题，随时可以停');
  });

  it('saves a self-reported range as a statement, not as understanding evidence', async () => {
    const { shell, container } = await mountShell(fixtureOptions('ready', '/first-run'));
    const form = container.querySelector<HTMLElement>('[data-testid="first-run-range-form"]');
    expect(form).not.toBeNull();
    const checkboxes = form?.querySelectorAll<HTMLInputElement>('input[type="checkbox"]') ?? [];
    expect(checkboxes.length).toBeGreaterThan(0);
    checkboxes[0]?.click();
    buttonByText(form as HTMLElement, '保存自述范围').click();
    await tick(10);
    const status = container.querySelector<HTMLElement>('[data-testid="first-run-save-status"]');
    expect(textOf(status as HTMLElement)).toContain('记下了');
    expect(textOf(status as HTMLElement)).toContain('不会当作已经学会');
    const range = shell.getState().rangeClaim;
    expect(range?.scope).toBe('selected');
    expect(range?.conceptIds.length).toBe(1);
    expect(range?.statementOnly).toBe(true);
    expect(shell.getState().saveState).toBe('saved');
  });

  it('allows skipping the diagnostic without inventing mastery', async () => {
    const { shell, container } = await mountShell(fixtureOptions('ready', '/first-run'));
    buttonByText(pageRoot(container), '跳过诊断').click();
    const status = container.querySelector<HTMLElement>('[data-testid="first-run-diagnostic-status"]');
    expect(textOf(status as HTMLElement)).toContain('已跳过');
    expect(textOf(status as HTMLElement)).toContain('不影响后面的学习');
    expect(textOf(status as HTMLElement)).not.toContain('已掌握');
    expect(shell.getState().diagnosticSkipped).toBe(true);
  });

  it('navigates to a diagnostic workspace when the student starts it', async () => {
    const { shell, container } = await mountShell(fixtureOptions('ready', '/first-run'));
    buttonByText(pageRoot(container), '开始短诊断').click();
    await tick(20);
    expect(shell.getState().currentPath).toContain('/workspace?mode=diagnostic');
    expect(textOf(pageRoot(container))).toContain('准备开始：细胞 · 短诊断');
  });

  it('keeps the range selection when saving fails and offers retry and a map exit', async () => {
    const { container } = await mountShell(fixtureOptions('save-failed', '/first-run'));
    const form = container.querySelector<HTMLElement>('[data-testid="first-run-range-form"]');
    const checkbox = form?.querySelector<HTMLInputElement>('input[type="checkbox"]');
    checkbox?.click();
    buttonByText(form as HTMLElement, '保存自述范围').click();
    await tick(10);
    const alert = container.querySelector<HTMLElement>('[role="alert"]');
    expect(alert).not.toBeNull();
    expect(textOf(alert as HTMLElement)).toContain('本地保存没有完成');
    expect(buttonByText(alert as HTMLElement, '重试保存')).toBeDefined();
    expect(buttonByText(alert as HTMLElement, '先看地图')).toBeDefined();
    expect(checkbox?.checked).toBe(true);
    expect(textOf(container)).toContain('尚未写入本机');
  });

  it('states that local content stays readable when the API key is missing', async () => {
    const { container } = await mountShell(fixtureOptions('unconfigured-key', '/first-run'));
    const text = textOf(pageRoot(container));
    expect(text).toContain('还没有连接');
    expect(text).toContain('连上之后才有讲解和批改');
    expect(text).toContain('现在可以读教材');
  });
});
