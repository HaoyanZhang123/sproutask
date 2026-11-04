import { afterEach, describe, expect, it } from 'vitest';
import {
  buttonByAction,
  buttonByText,
  cleanupLibraries,
  dispatchKey,
  el,
  mountLibrary,
  openSourcesFold,
  pageRoot,
  textOf,
  tick,
} from './helpers.js';

afterEach(cleanupLibraries);

/** 展开“课本原文从哪来”，再打开第一条来源。 */
async function openFirstSource(container: HTMLElement): Promise<HTMLButtonElement> {
  const fold = openSourcesFold(container);
  const open = buttonByAction(fold, 'open-source');
  open.focus();
  open.click();
  await tick(10);
  return open;
}

describe('打开原句：PDF 页和课本页分开写', () => {
  it('原文对照：两个页码单位分开写，并标出这句在页面上的位置', async () => {
    const { container } = await mountLibrary();
    const trigger = await openFirstSource(container);
    expect(container.querySelector('[data-testid="source-reader"]')).not.toBeNull();
    expect(textOf(el(container, 'source-pdf-page'))).toContain('PDF 第 18 页');
    expect(textOf(el(container, 'source-printed-page'))).toContain('课本第 12 页');
    expect(textOf(container)).toContain('PDF 第几页和课本上印的页码不是一回事');
    const image = el(container, 'source-page-image');
    expect(image.dataset['assetId']).toBe('asset.page.p18.fixture');
    // 页图只用应用给的句柄，不显示本机路径
    expect(textOf(image)).not.toContain('asset.page.p18');
    const bbox = el(container, 'source-bbox');
    expect(bbox.dataset['bbox']).toBe('0.12,0.18,0.55,0.13');
    expect(bbox.getAttribute('style')).toContain('left: 12%');
    expect(textOf(container)).toContain('fixture revised text');
    expect(textOf(container)).toContain('人工核对过');
    expect(textOf(container)).toContain('看原文不会提交作答');
    dispatchKey(container.querySelector('[data-edu-modal="true"] [role="dialog"]') as HTMLElement, 'Escape');
    expect(container.querySelector('[data-edu-modal="true"]')?.hasAttribute('hidden')).toBe(true);
    expect(document.activeElement).toBe(trigger);
  });

  it('键盘上下切换来源；认不出课本页就留空，不推算', async () => {
    const { container } = await mountLibrary();
    await openFirstSource(container);
    const dialog = container.querySelector<HTMLElement>('[data-edu-modal="true"] [role="dialog"]');
    expect(dialog).not.toBeNull();
    if (dialog === null) return;
    dispatchKey(dialog, 'ArrowDown');
    await tick(10);
    expect(textOf(el(container, 'source-printed-page'))).toContain('未识别（不推算）');
    expect(textOf(container)).toContain('合成细胞结构图');
    const bbox = el(container, 'source-bbox');
    expect(bbox.dataset['bbox']).toBe('0.2,0.25,0.4,0.3');
  });

  it('来源打不开时说明原因并给出回去的路，不伪造页面', async () => {
    const { container } = await mountLibrary({ scenario: 'source-missing' });
    await openFirstSource(container);
    const readerText = textOf(el(container, 'source-reader'));
    expect(readerText).toContain('无法定位来源');
    expect(readerText).toContain('没有跳到别的页面');
    expect(readerText).toContain('不会编一个位置');
    expect(container.querySelector('[data-testid="source-page-image"]')).toBeNull();
    expect(container.querySelector('[data-testid="source-pdf-page"]')).toBeNull();
    expect(buttonByText(el(container, 'source-reader'), '回去看课本')).toBeDefined();
  });

  it('从学习里点进来时，还能回到原来的活动', async () => {
    const { container, shell } = await mountLibrary({
      returnPath: '/workspace?mode=learn&concept=concept.cell',
    });
    await openFirstSource(container);
    buttonByText(el(container, 'source-reader'), '返回原活动').click();
    await tick(20);
    expect(shell.getState().currentPath).toContain('/workspace?mode=learn');
  });

  it('原文阅读区不出现本机路径、堆栈或密钥', async () => {
    const { container } = await mountLibrary();
    await openFirstSource(container);
    const text = textOf(container);
    expect(text).not.toMatch(/node_modules|at Object\.|E:\\|C:\\|sk-[A-Za-z0-9]|Bearer\s+[A-Za-z0-9]/);
  });

  it('折叠块默认收着，展开后按钮可键盘聚焦', async () => {
    const { container } = await mountLibrary();
    const page = pageRoot(container);
    expect(el(page, 'library-sources-body').hasAttribute('hidden')).toBe(true);
    const fold = openSourcesFold(container);
    expect(fold.querySelectorAll('button[data-action="open-source"]').length).toBe(2);
    const states = [...fold.querySelectorAll<HTMLElement>('.edu-chip')];
    // 折叠块收起时整页只有一个 chip；展开后来源各自带文字状态
    for (const chip of states) expect((chip.textContent ?? '').trim().length).toBeGreaterThan(0);
  });
});
