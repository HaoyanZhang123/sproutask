import { afterEach, describe, expect, it } from 'vitest';
import {
  buttonByAction,
  cleanupLibraries,
  el,
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

describe('导入失败与离线：照实说明 + 可重试', () => {
  it('文件读不到时说清楚，也不留一个假的已选文件', async () => {
    const { container } = await mountLibrary({ scenario: 'file-missing' });
    buttonByAction(container, 'choose-file').click();
    await tick(10);
    const alert = container.querySelector<HTMLElement>('[role="alert"]');
    expect(alert).not.toBeNull();
    expect(textOf(alert as HTMLElement)).toContain('找不到这项内容');
    expect(container.querySelector('[data-testid="library-selected-file"]')).toBeNull();
    expect(textOf(container)).toContain('重新选择文件');
  });

  it('PDF 损坏时不给一键重试，只给出重新选择', async () => {
    const { container } = await mountLibrary({ scenario: 'failed-pdf' });
    await startImport(container);
    const error = el(container, 'library-import-error');
    const text = textOf(error);
    expect(text).toContain('PDF 文件损坏');
    expect(text).toContain('没有发布');
    expect(container.querySelector('button[data-action="retry-import"]')).toBeNull();
    expect(textOf(container)).toContain('重新选择文件');
  });

  it('缺中文识别语言包时给出能做的事', async () => {
    const { container } = await mountLibrary({ scenario: 'failed-ocr-language' });
    await startImport(container);
    const error = el(container, 'library-import-error');
    expect(textOf(error)).toContain('缺少中文识别语言包');
    expect(textOf(error)).toContain('安装中文识别语言包');
    expect(container.querySelector('button[data-action="retry-import"]')).not.toBeNull();
  });

  it('磁盘满时说明没有删掉已有记录', async () => {
    const { container } = await mountLibrary({ scenario: 'failed-storage-full' });
    await startImport(container);
    const error = el(container, 'library-import-error');
    expect(textOf(error)).toContain('磁盘空间不足');
    expect(textOf(error)).toContain('原有记录没有被删除');
    expect(container.querySelector('button[data-action="retry-import"]')).not.toBeNull();
  });

  it('写不进本机存储时不假装已经保存', async () => {
    const { container } = await mountLibrary({ scenario: 'failed-permission' });
    await startImport(container);
    const error = el(container, 'library-import-error');
    expect(textOf(error)).toContain('写进本机存储失败');
    expect(textOf(error)).toContain('不会显示成已完成');
    expect(container.querySelector('button[data-action="retry-import"]')).not.toBeNull();
  });

  it('没联网时把需要联网的步骤停下来，而不是假装做完', async () => {
    const { container } = await mountLibrary({ scenario: 'offline-paused' });
    expect(textOf(container)).toContain('当前离线');
    await startImport(container);
    const error = el(container, 'library-import-error');
    const text = textOf(error);
    expect(text).toContain('联网的整理步骤先停了下来');
    expect(text).toContain('不会假装已经完成');
    expect(text).toContain('本机的步骤已经做完');
    expect(container.querySelector('button[data-action="resume-import"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="library-ready"]')).toBeNull();
  });

  it('不显示原始报错、堆栈或本机路径', async () => {
    const { container } = await mountLibrary({ scenario: 'failed-pdf' });
    await startImport(container);
    const text = textOf(container);
    expect(text).not.toMatch(/node_modules|at Object\.|E:\\|C:\\|secret|stack/i);
    expect(text).not.toContain('detailsRef');
  });
});
