import { afterEach, describe, expect, it } from 'vitest';
import { buttonsOf, cleanupShells, fixtureOptions, mountShell, pageRoot, textOf } from './helpers.js';

afterEach(cleanupShells);

describe('account and model-service status', () => {
  it('shows model-account and API-key states separately without exposing credentials', async () => {
    const { container } = await mountShell(fixtureOptions('ready', '/account'));
    const page = pageRoot(container);
    const account = container.querySelector<HTMLElement>('[data-testid="account-model-account"]');
    const apiKey = container.querySelector<HTMLElement>('[data-testid="account-api-key"]');
    expect(account).not.toBeNull();
    expect(apiKey).not.toBeNull();
    expect(textOf(account as HTMLElement)).toContain('不可用');
    expect(textOf(account as HTMLElement)).toContain('不使用平台账户授权');
    expect(textOf(account as HTMLElement)).toContain('用户已明确该路线不允许');
    expect(textOf(apiKey as HTMLElement)).toContain('已配置');
    expect(textOf(apiKey as HTMLElement)).toContain('不回显');
    expect(textOf(page)).toContain('更换模型账号不会删除学情');
    expect(textOf(page)).toContain('不会删除本机教材');
    expect(textOf(page)).not.toMatch(/sk-[A-Za-z0-9]|Bearer\s+[A-Za-z0-9]|api[_-]?key\s*=|C:\\\\|E:\\\\/);
    for (const control of buttonsOf(page)) {
      expect((control.textContent ?? '').trim()).not.toMatch(/登录|退出|授权/);
    }
  });

  it('states that local content remains readable when the key is not configured', async () => {
    const { container } = await mountShell(fixtureOptions('unconfigured-key', '/account'));
    const text = textOf(container.querySelector('[data-testid="account-api-key"]') as HTMLElement);
    expect(text).toContain('未配置');
    expect(text).toContain('可读本地内容');
    expect(text).toContain('云推理不可用');
    expect(textOf(container)).toContain('API Key 未配置');
  });

  it('reports runtime capabilities without offering tool or development controls', async () => {
    const { container } = await mountShell(fixtureOptions('ready', '/account'));
    const runtime = container.querySelector<HTMLElement>('[data-testid="account-runtime"]');
    expect(runtime).not.toBeNull();
    const text = textOf(runtime as HTMLElement);
    expect(text).toContain('DSH 运行内核');
    expect(text).toContain('未绑定');
    expect(text).toContain('0 项');
    expect(text).toContain('仅本机回环');
    expect(text).toContain('系统级文件与命令能力不属于学生权限');
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
