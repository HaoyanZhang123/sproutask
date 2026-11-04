import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import {
  type AuthKeyCategory,
  type AuthKeyClearReceipt,
  type AuthKeyFailure,
  type AuthKeyPort,
  type AuthKeyResult,
  type AuthKeySaveReceipt,
  type AuthKeyStatus,
  createHttpAuthKeyPort,
  maskedKeySuffix,
} from '../src/index.js';
import {
  buttonByAction,
  buttonByText,
  cleanupShells,
  fixtureOptions,
  mountShell,
  pageRoot,
  textOf,
  tick,
} from './helpers.js';

const sourceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'src');
const INTRO_KEY = 'edu.client.key-intro.dismissed';

function failure(category: AuthKeyCategory, retryable = true): AuthKeyFailure {
  return {
    category,
    code: category === 'auth' ? 'UNAUTHORIZED' : category === 'format' ? 'INVALID_INPUT' : 'UNAVAILABLE',
    message: `test-${category}`,
    retryable,
  };
}

class MemoryKeyPort implements AuthKeyPort {
  configured: boolean;
  suffix: string | null;
  readonly failures: Partial<Record<'save' | 'load' | 'clear', AuthKeyFailure>>;
  saveCalls = 0;
  clearCalls = 0;
  lastSaved: string | null = null;

  constructor(
    configured = false,
    failures: Partial<Record<'save' | 'load' | 'clear', AuthKeyFailure>> = {},
    suffix: string | null = null,
  ) {
    this.configured = configured;
    this.failures = failures;
    this.suffix = suffix;
  }

  async loadStatus(): Promise<AuthKeyResult<AuthKeyStatus>> {
    if (this.failures.load !== undefined) return { ok: false, error: this.failures.load };
    return {
      ok: true,
      data: {
        configured: this.configured,
        maskedSuffix: this.suffix,
        lastCheckedAt: '2026-10-30T00:00:00Z',
      },
    };
  }

  async save(apiKey: string): Promise<AuthKeyResult<AuthKeySaveReceipt>> {
    this.saveCalls += 1;
    if (this.failures.save !== undefined) return { ok: false, error: this.failures.save };
    this.lastSaved = apiKey;
    this.configured = true;
    this.suffix = maskedKeySuffix(apiKey);
    return { ok: true, data: { configured: true, maskedSuffix: this.suffix } };
  }

  async clear(): Promise<AuthKeyResult<AuthKeyClearReceipt>> {
    this.clearCalls += 1;
    if (this.failures.clear !== undefined) return { ok: false, error: this.failures.clear };
    this.configured = false;
    this.suffix = null;
    return { ok: true, data: { configured: false } };
  }
}

function keyInput(container: HTMLElement): HTMLInputElement {
  const input = container.querySelector<HTMLInputElement>('[data-testid="account-key-input"]');
  if (input === null) throw new Error('key input missing');
  return input;
}

async function saveWith(container: HTMLElement, value: string): Promise<void> {
  const input = keyInput(container);
  input.value = value;
  input.dispatchEvent(new Event('input', { bubbles: true }));
  buttonByAction(pageRoot(container), 'save-key').click();
  await tick(20);
}

afterEach(async () => {
  localStorage.removeItem(INTRO_KEY);
  await cleanupShells();
});

describe('first-start key guide and local mode', () => {
  it('shows the three-step guide only without a key, and skip keeps local reading available', async () => {
    const { container } = await mountShell(fixtureOptions('unconfigured-key', '/home'));
    const guide = container.querySelector<HTMLElement>('[data-testid="first-start-guide"]');
    expect(guide).not.toBeNull();
    const text = textOf(guide as HTMLElement);
    expect(text).toContain('记录只在这台电脑');
    expect(text).toContain('教材原文与学习记录保存在本机');
    expect(text).toContain('云端只收当前这一题');
    expect(text).toContain('随时能改');
    expect(buttonByAction(guide as HTMLElement, 'skip-key-intro')).toBeDefined();
    expect(buttonByAction(guide as HTMLElement, 'open-account-key')).toBeDefined();
    expect(container.querySelector('[data-testid="local-mode-badge"]')).not.toBeNull();

    buttonByAction(guide as HTMLElement, 'skip-key-intro').click();
    expect(container.querySelector('[data-testid="first-start-guide"]')).toBeNull();
    expect(localStorage.getItem(INTRO_KEY)).toBe('1');
    expect(textOf(container)).toContain('去目录挑一个概念');
  });

  it('does not show the first-start guide when the host already reports configured', async () => {
    const keyPort = new MemoryKeyPort(true, {}, '1234');
    const { container } = await mountShell(fixtureOptions('unconfigured-key', '/home', { keyPort }));
    await tick(20);
    expect(container.querySelector('[data-testid="first-start-guide"]')).toBeNull();
    expect(container.querySelector('[data-testid="local-mode-badge"]')).toBeNull();
  });
});

describe('API key entry and host status', () => {
  it('uses a password field, never echoes the key, and stores only a masked suffix', async () => {
    const keyPort = new MemoryKeyPort(false);
    const { container, shell } = await mountShell(fixtureOptions('unconfigured-key', '/account', { keyPort }));
    const input = keyInput(container);
    expect(input.type).toBe('password');
    const secret = 'sk-test-key-1234';
    await saveWith(container, secret);
    expect(input.value).toBe('');
    expect(keyPort.lastSaved).toBe(secret);
    expect(textOf(container)).not.toContain(secret);
    expect(textOf(container)).not.toMatch(/sk-[A-Za-z0-9]/);
    expect(textOf(container)).toContain('已配置（****1234）');
    expect(textOf(container)).toContain('不会显示完整 Key');
    expect(textOf(container)).not.toContain('本地模式');
    expect(shell.getState().keyStatus).toBe('configured');
    expect(container.querySelector('[data-testid="local-mode-badge"]')).toBeNull();
  });

  it('classifies format, auth, network, quota and endpoint-missing failures in Chinese', async () => {
    const cases: readonly {
      readonly failure: AuthKeyFailure;
      readonly expected: string;
      readonly key: string;
    }[] = [
      { failure: failure('format', false), expected: '格式不对', key: 'sk-good-1234' },
      { failure: failure('auth', false), expected: 'Key 没有被接受', key: 'sk-good-1234' },
      { failure: failure('network', true), expected: '没能连上本机服务', key: 'sk-good-1234' },
      { failure: failure('quota', true), expected: '配额不足', key: 'sk-good-1234' },
    ];
    for (const item of cases) {
      const keyPort = new MemoryKeyPort(false, { save: item.failure });
      const { container } = await mountShell(fixtureOptions('unconfigured-key', '/account', { keyPort }));
      await saveWith(container, item.key);
      expect(textOf(container)).toContain(item.expected);
      expect(textOf(container)).toContain('Key 没有保存');
      expect(keyInput(container).value).toBe('');
      await cleanupShells();
    }

    const local = await mountShell(fixtureOptions('unconfigured-key', '/account'));
    await saveWith(local.container, 'sk-good-1234');
    expect(textOf(local.container)).toContain('接口还没准备好');
    expect(textOf(local.container)).toContain('没有保存');
    expect(local.shell.getState().keyStatus).toBe('missing');
  });

  it('rejects an invalid format before calling the host and never persists a key in browser storage', async () => {
    const keyPort = new MemoryKeyPort(false);
    const { container } = await mountShell(fixtureOptions('unconfigured-key', '/account', { keyPort }));
    await saveWith(container, 'not-a-key');
    expect(keyPort.saveCalls).toBe(0);
    expect(textOf(container)).toContain('格式不对');
    expect(textOf(container)).toContain('sk-');

    const setItem = localStorage.setItem.bind(localStorage);
    const sessionSetItem = sessionStorage.setItem.bind(sessionStorage);
    const calls: string[] = [];
    localStorage.setItem = (key: string, value: string) => {
      calls.push(`${key}\n${value}`);
      setItem(key, value);
    };
    sessionStorage.setItem = (key: string, value: string) => {
      calls.push(`${key}\n${value}`);
      sessionSetItem(key, value);
    };
    try {
      await saveWith(container, 'sk-another-5678');
    } finally {
      localStorage.setItem = setItem;
      sessionStorage.setItem = sessionSetItem;
    }
    expect(calls.join('\n')).not.toMatch(/sk-another-5678|sk-test/);
  });

  it('shows an explicit not-implemented error for a 404 host endpoint', async () => {
    const keyPort = createHttpAuthKeyPort({
      fetchImpl: (async () => new Response('', { status: 404 })) as typeof fetch,
    });
    const { container } = await mountShell(fixtureOptions('unconfigured-key', '/account', { keyPort }));
    await saveWith(container, 'sk-good-1234');
    expect(textOf(container)).toContain('接口还没准备好');
    expect(textOf(container)).not.toContain('/edu/api/auth/key');
    expect(textOf(container)).toContain('没有保存');
  });

  it('clears the key, returns to local mode, and reads configured state after reopening', async () => {
    const keyPort = new MemoryKeyPort(true, {}, '4321');
    const first = await mountShell(fixtureOptions('ready', '/account', { keyPort }));
    expect(textOf(first.container)).toContain('已配置（****4321）');
    buttonByAction(pageRoot(first.container), 'clear-key').click();
    await tick(10);
    const confirm = first.container.querySelector<HTMLButtonElement>('[data-edu-dialog] button[data-action="confirm"]');
    expect(confirm).not.toBeNull();
    confirm?.click();
    await tick(20);
    expect(first.shell.getState().keyStatus).toBe('missing');
    expect(textOf(first.container)).toContain('已回到本地模式');
    expect(first.container.querySelector('[data-testid="local-mode-badge"]')).not.toBeNull();
    await cleanupShells();

    const reopened = await mountShell(fixtureOptions('unconfigured-key', '/account', { keyPort: new MemoryKeyPort(true, {}, '9876') }));
    await tick(20);
    expect(reopened.shell.getState().keyStatus).toBe('configured');
    expect(textOf(reopened.container)).toContain('已配置（****9876）');
  });
});

describe('client source key hygiene', () => {
  it('does not persist apiKey values to localStorage or sessionStorage', () => {
    const offenders: string[] = [];
    for (const file of readdirSync(sourceRoot, { recursive: true })) {
      if (!String(file).endsWith('.ts')) continue;
      const full = path.join(sourceRoot, String(file));
      const source = readFileSync(full, 'utf8');
      if (/localStorage\s*\.\s*setItem\s*\([^)]*apiKey/is.test(source)) offenders.push(`${file}:localStorage`);
      if (/sessionStorage\s*\.\s*setItem\s*\([^)]*apiKey/is.test(source)) offenders.push(`${file}:sessionStorage`);
      if (/localStorage\s*\.\s*setItem\s*\([^)]*sk-/is.test(source)) offenders.push(`${file}:key-literal`);
    }
    expect(offenders).toEqual([]);
  });
});
