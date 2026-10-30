import { afterEach, describe, expect, it } from 'vitest';
import {
  buttonByAction,
  buttonByText,
  cleanupLibraries,
  dispatchKey,
  mountLibrary,
  pageRoot,
  textOf,
  tick,
} from './helpers.js';

afterEach(cleanupLibraries);

async function openFirstSource(container: HTMLElement): Promise<HTMLButtonElement> {
  const page = pageRoot(container);
  buttonByText(page, '查看来源').click();
  await tick(10);
  const open = buttonByAction(page, 'open-source');
  open.focus();
  open.click();
  await tick(10);
  return open;
}

describe('controlled source reading', () => {
  it('separates PDF page order from printed page and highlights the controlled bbox', async () => {
    const { container } = await mountLibrary();
    const trigger = await openFirstSource(container);
    const reader = container.querySelector<HTMLElement>('[data-testid="source-reader"]');
    expect(reader).not.toBeNull();
    expect(textOf(container.querySelector('[data-testid="source-pdf-page"]') as HTMLElement)).toContain(
      'PDF 第 18 页',
    );
    expect(textOf(container.querySelector('[data-testid="source-printed-page"]') as HTMLElement)).toContain(
      '课本第 12 页',
    );
    expect(textOf(container)).toContain('PDF 页序与印刷页码是不同单位');
    const image = container.querySelector<HTMLElement>('[data-testid="source-page-image"]');
    expect(image?.dataset['assetId']).toBe('asset.page.p18.fixture');
    const bbox = container.querySelector<HTMLElement>('[data-testid="source-bbox"]');
    expect(bbox?.dataset['bbox']).toBe('0.12,0.18,0.55,0.13');
    expect(bbox?.getAttribute('style')).toContain('left: 12%');
    expect(textOf(container)).toContain('fixture revised text');
    expect(textOf(container)).toContain('来源人工核对');
    expect(textOf(container)).toContain('查看来源不会提交作答');
    dispatchKey(container.querySelector('[data-edu-modal="true"] [role="dialog"]') as HTMLElement, 'Escape');
    expect(container.querySelector('[data-edu-modal="true"]')?.hasAttribute('hidden')).toBe(true);
    expect(document.activeElement).toBe(trigger);
  });

  it('switches highlights by keyboard and shows an unidentified printed page as null, not a guess', async () => {
    const { container } = await mountLibrary();
    await openFirstSource(container);
    const dialog = container.querySelector<HTMLElement>('[data-edu-modal="true"] [role="dialog"]');
    expect(dialog).not.toBeNull();
    if (dialog === null) return;
    dispatchKey(dialog, 'ArrowDown');
    await tick(10);
    expect(textOf(container.querySelector('[data-testid="source-printed-page"]') as HTMLElement)).toContain(
      '未识别（不推算）',
    );
    expect(textOf(container)).toContain('合成细胞结构图');
    const bbox = container.querySelector<HTMLElement>('[data-testid="source-bbox"]');
    expect(bbox?.dataset['bbox']).toBe('0.2,0.25,0.4,0.3');
  });

  it('explains a failed source lookup and offers a return path without a fake page', async () => {
    const { container } = await mountLibrary({ scenario: 'source-missing' });
    await openFirstSource(container);
    const readerText = textOf(container.querySelector('[data-testid="source-reader"]') as HTMLElement);
    expect(readerText).toContain('无法定位来源');
    expect(readerText).toContain('没有跳转到任何页面');
    expect(readerText).toContain('不会编造引用位置');
    expect(container.querySelector('[data-testid="source-page-image"]')).toBeNull();
    expect(container.querySelector('[data-testid="source-pdf-page"]')).toBeNull();
    expect(buttonByText(container.querySelector('[data-testid="source-reader"]') as HTMLElement, '返回教材库')).toBeDefined();
  });

  it('keeps a return-to-activity path while viewing a source', async () => {
    const { container, shell } = await mountLibrary({
      returnPath: '/workspace?mode=learn&concept=concept.cell',
    });
    await openFirstSource(container);
    buttonByText(container.querySelector('[data-testid="source-reader"]') as HTMLElement, '返回原活动').click();
    await tick(20);
    expect(shell.getState().currentPath).toContain('/workspace?mode=learn');
    expect(textOf(pageRoot(container))).toContain('准备开始');
  });

  it('does not render raw paths, stacks or secrets in the source reader', async () => {
    const { container } = await mountLibrary();
    await openFirstSource(container);
    const text = textOf(container);
    expect(text).not.toMatch(/node_modules|at Object\.|E:\\\\|C:\\\\|sk-[A-Za-z0-9]|Bearer\s+[A-Za-z0-9]/);
  });
});
