import { afterEach, describe, expect, it } from 'vitest';
import {
  buttonByAction,
  cleanupLibraries,
  mountLibrary,
  textOf,
  tick,
} from './helpers.js';

afterEach(cleanupLibraries);

async function startImport(container: HTMLElement): Promise<void> {
  buttonByAction(container, 'choose-file').click();
  await tick(10);
  buttonByAction(container, 'start-import').click();
  await tick(20);
}

describe('library import failure and offline states', () => {
  it('explains a missing/corrupt source file without a fake page', async () => {
    const { container } = await mountLibrary({ scenario: 'file-missing' });
    buttonByAction(container, 'choose-file').click();
    await tick(10);
    const alert = container.querySelector<HTMLElement>('[role="alert"]');
    expect(alert).not.toBeNull();
    expect(textOf(alert as HTMLElement)).toContain('找不到这项内容');
    expect(container.querySelector('[data-testid="library-selected-file"]')).toBeNull();
    expect(textOf(container)).toContain('重新选择文件');
  });

  it('shows PDF corruption with no retryable shortcut', async () => {
    const { container } = await mountLibrary({ scenario: 'failed-pdf' });
    await startImport(container);
    const error = container.querySelector<HTMLElement>('[data-testid="library-import-error"]');
    expect(error).not.toBeNull();
    const text = textOf(error as HTMLElement);
    expect(text).toContain('PDF 文件损坏');
    expect(text).toContain('错误代码：PDF_CORRUPT');
    expect(text).toContain('没有发布');
    expect(container.querySelector('button[data-action="retry-import"]')).toBeNull();
    expect(textOf(container)).toContain('重新选择文件');
  });

  it('shows a missing Chinese OCR language pack with an actionable retry', async () => {
    const { container } = await mountLibrary({ scenario: 'failed-ocr-language' });
    await startImport(container);
    const error = container.querySelector<HTMLElement>('[data-testid="library-import-error"]');
    expect(error).not.toBeNull();
    expect(textOf(error as HTMLElement)).toContain('缺少中文 OCR 语言包');
    expect(textOf(error as HTMLElement)).toContain('安装中文 OCR 语言包');
    expect(container.querySelector('button[data-action="retry-import"]')).not.toBeNull();
  });

  it('shows disk-full failure and keeps the source-file boundary', async () => {
    const { container } = await mountLibrary({ scenario: 'failed-storage-full' });
    await startImport(container);
    const error = container.querySelector<HTMLElement>('[data-testid="library-import-error"]');
    expect(error).not.toBeNull();
    expect(textOf(error as HTMLElement)).toContain('磁盘空间不足');
    expect(textOf(error as HTMLElement)).toContain('已有记录没有被删除');
    expect(container.querySelector('button[data-action="retry-import"]')).not.toBeNull();
  });

  it('shows a write-permission failure without pretending data was saved', async () => {
    const { container } = await mountLibrary({ scenario: 'failed-permission' });
    await startImport(container);
    const error = container.querySelector<HTMLElement>('[data-testid="library-import-error"]');
    expect(error).not.toBeNull();
    expect(textOf(error as HTMLElement)).toContain('写入本机存储失败');
    expect(textOf(error as HTMLElement)).toContain('不会显示为已完成');
    expect(container.querySelector('button[data-action="retry-import"]')).not.toBeNull();
  });

  it('pauses cloud extraction offline instead of pretending completion', async () => {
    const { container } = await mountLibrary({ scenario: 'offline-paused' });
    expect(textOf(container)).toContain('当前离线');
    await startImport(container);
    const error = container.querySelector<HTMLElement>('[data-testid="library-import-error"]');
    expect(error).not.toBeNull();
    const text = textOf(error as HTMLElement);
    expect(text).toContain('在线概念抽取暂缓');
    expect(text).toContain('没有伪装成导入完成');
    expect(text).toContain('本地解析已完成');
    expect(container.querySelector('button[data-action="resume-import"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="library-ready"]')).toBeNull();
  });

  it('does not render raw messages, stacks or private paths', async () => {
    const { container } = await mountLibrary({ scenario: 'failed-pdf' });
    await startImport(container);
    const text = textOf(container);
    expect(text).not.toMatch(/node_modules|at Object\.|E:\\\\|C:\\\\|secret|stack/i);
    expect(text).not.toContain('detailsRef');
  });
});
