import { afterEach, describe, expect, it } from 'vitest';
import { buttonsOf, cleanupShells, fixtureOptions, mountShell, pageRoot, textOf } from './helpers.js';

afterEach(cleanupShells);

describe('settings: key, font and about', () => {
  it('shows the key state without exposing credentials', async () => {
    const { container } = await mountShell(fixtureOptions('ready', '/account'));
    const page = pageRoot(container);
    const apiKey = container.querySelector<HTMLElement>('[data-testid="account-api-key"]');
    expect(apiKey).not.toBeNull();
    expect(textOf(apiKey as HTMLElement)).toContain('已配置');
    expect(textOf(apiKey as HTMLElement)).toContain('不会显示完整 Key');
    expect(textOf(page)).toContain('记录只在本机');
    expect(textOf(page)).not.toMatch(/sk-[A-Za-z0-9]|Bearer\s+[A-Za-z0-9]|api[_-]?key\s*=/);
    for (const control of buttonsOf(page)) {
      expect((control.textContent ?? '').trim()).not.toMatch(/登录|退出|授权/);
    }
  });

  it('states that local content remains readable when the key is not configured', async () => {
    const { container } = await mountShell(fixtureOptions('unconfigured-key', '/account'));
    const text = textOf(container.querySelector('[data-testid="account-api-key"]') as HTMLElement);
    expect(text).toContain('还没有配置');
    expect(text).toContain('读教材');
    expect(text).toContain('智能反馈');
    expect(textOf(container)).toContain('还没有配置模型 Key');
  });

  it('shows technical state folded under about, without tool or development controls', async () => {
    const { container } = await mountShell(fixtureOptions('ready', '/account'));
    const about = container.querySelector<HTMLElement>('[data-testid="account-about"]');
    expect(about).not.toBeNull();
    const text = textOf(about as HTMLElement);
    expect(text).toContain('DSH 内核');
    expect(text).toContain('未连接');
    expect(text).toContain('文字模型');
    expect(text).not.toMatch(/工具调用|受控学习工具|回环/);
  });

  it('allows a larger display font without changing study state', async () => {
    const { container } = await mountShell(fixtureOptions('ready', '/account'));
    const root = container.querySelector<HTMLElement>('[data-edu-shell="true"]');
    expect(root?.dataset['fontScale']).toBe('standard');
    const large = container.querySelector<HTMLButtonElement>('button[data-action="font-large"]');
    expect(large).not.toBeNull();
    large?.click();
    expect(root?.dataset['fontScale']).toBe('large');
    expect(large?.getAttribute('aria-pressed')).toBe('true');
    const standard = container.querySelector<HTMLButtonElement>('button[data-action="font-standard"]');
    standard?.click();
    expect(root?.dataset['fontScale']).toBe('standard');
  });
});
