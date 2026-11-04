import { afterEach, describe, expect, it } from 'vitest';
import {
  buttonByAction,
  cleanupLibraries,
  el,
  mountLibrary,
  setInput,
  textOf,
  tick,
} from './helpers.js';
import { FixtureLibraryDataSource } from '../src/index.js';

afterEach(cleanupLibraries);

/** 导入入口：导入面板里的“选择本地 PDF”+“开始导入”。 */
async function chooseAndStart(container: HTMLElement): Promise<void> {
  buttonByAction(container, 'choose-file').click();
  await tick(10);
  buttonByAction(container, 'start-import').click();
  await tick(20);
}

describe('导入新的课本：流程和真实进度', () => {
  it('确认信息 → 真实阶段/页数 → 只前进不进倒退 → 取消后恢复', async () => {
    const mounted = await mountLibrary();
    const { container, library, data } = mounted;
    // 从课本页的“导入新的”也能进入同一条流程
    el<HTMLButtonElement>(pageFor(container), 'library-import').click();
    await tick(20);
    const selected = el(container, 'library-selected-file');
    expect(textOf(selected)).toContain('合成教材.pdf');
    expect(textOf(selected)).toContain('不会上传整本');
    expect(textOf(selected)).not.toMatch(/指纹|sha256/i);

    buttonByAction(container, 'start-import').click();
    await tick(20);
    expect(el(container, 'library-import-job')).not.toBeNull();
    expect(library.controller.getState().job?.stage).toBe('extract');
    expect(textOf(container)).toContain('现在：读出页面文字');
    expect(textOf(container)).toContain('4 / 200');
    // 进度条面板不出现工程字段
    expect(textOf(container)).not.toMatch(/解析器|parserVersion|任务 job\./);

    const source = data as FixtureLibraryDataSource;
    const current = library.controller.getState().job;
    expect(current).not.toBeNull();
    if (current === null) return;
    source.emitJob({
      ...current,
      stage: 'structure',
      status: 'running',
      completedUnits: 5,
      checkpoint: { ...current.checkpoint, stage: 'structure', lastCompletedUnit: 5 },
      updatedAt: '2026-10-29T10:05:00Z',
    });
    await tick(10);
    expect(textOf(container)).toContain('整理章节');
    expect(textOf(container)).toContain('5 / 200');

    const advanced = library.controller.getState().job;
    if (advanced === null) return;
    source.emitJob({
      ...advanced,
      stage: 'extract',
      completedUnits: 2,
      checkpoint: { ...advanced.checkpoint, stage: 'extract' },
    });
    await tick(10);
    expect(textOf(container)).toContain('5 / 200');
    expect(library.controller.getState().job?.stage).toBe('structure');

    buttonByAction(container, 'cancel-import').click();
    await tick(10);
    expect(textOf(container)).toContain('导入已取消');
    expect(library.controller.getState().job?.status).toBe('cancelled');
    const cancelled = library.controller.getState().job;
    if (cancelled === null) return;
    source.emitJob({ ...cancelled, stage: 'ready', status: 'completed', completedUnits: 200 });
    await tick(10);
    expect(container.querySelector('[data-testid="library-ready"]')).toBeNull();
    expect(library.controller.getState().job?.status).toBe('cancelled');
    expect(textOf(container)).toContain('取消之后才回来的结果');

    buttonByAction(container, 'resume-import').click();
    await tick(10);
    expect(library.controller.getState().job?.status).toBe('running');
    expect(textOf(container)).toContain('已接着上次的导入继续');
  });

  it('同一个文件不会重复建课本', async () => {
    const { container } = await mountLibrary({ scenario: 'duplicate' });
    await chooseAndStart(container);
    expect(container.querySelector('[data-testid="library-duplicate-notice"]')).not.toBeNull();
    expect(textOf(container)).toContain('这本书之前导入过');
    expect(textOf(container)).toContain('没有重复建课本');
  });

  it('等确认不等于导入完成', async () => {
    const { container } = await mountLibrary({ scenario: 'await-review' });
    await chooseAndStart(container);
    const pending = el(container, 'library-await-review');
    expect(textOf(pending)).toContain('还在核对，不算导入完成');
    expect(container.querySelector('[data-testid="library-ready"]')).toBeNull();
    expect(textOf(container)).toContain('现在：等你确认');
    expect(textOf(pending)).toContain('现在不会显示“完成”');
    // 等确认时不给“接着导入”，避免看起来像还能一键完成
    expect(container.querySelector('button[data-action="resume-import"]')).toBeNull();
  });

  it('同一版的另一份扫描先当参考', async () => {
    const { container } = await mountLibrary({ scenario: 'same-edition-rescan' });
    await chooseAndStart(container);
    const match = el(container, 'library-match-notice');
    expect(textOf(match)).toContain('同一版的另一份扫描');
    expect(textOf(match)).toContain('先当参考');
  });

  it('只有真的做完才说“这本可以用了”', async () => {
    const { container } = await mountLibrary({ scenario: 'ready' });
    await chooseAndStart(container);
    const ready = el(container, 'library-ready');
    expect(textOf(ready)).toContain('这本可以用了');
    expect(textOf(ready)).toContain('一部分');
  });

  it('导入进行中离开再回来，进度还在并继续接收更新', async () => {
    const mounted = await mountLibrary();
    await chooseAndStart(mounted.container);
    const { shell, library, data } = mounted;
    expect(library.controller.getState().job?.status).toBe('running');
    await shell.navigate('/home');
    await tick(10);
    await shell.navigate('/library');
    await tick(20);
    expect(library.controller.getState().job?.status).toBe('running');
    expect(textOf(mounted.container)).toContain('导入进度');
    const source = data as FixtureLibraryDataSource;
    const current = library.controller.getState().job;
    if (current === null) return;
    source.emitJob({
      ...current,
      stage: 'structure',
      completedUnits: 6,
      checkpoint: { ...current.checkpoint, stage: 'structure', lastCompletedUnit: 6 },
    });
    await tick(10);
    expect(textOf(mounted.container)).toContain('6 / 200');
  });

  it('页数和文件对不上时不开始导入', async () => {
    const mounted = await mountLibrary();
    const { container } = mounted;
    buttonByAction(container, 'choose-file').click();
    await tick(10);
    const pageCount = container.querySelector<HTMLInputElement>('#library-meta-pageCount');
    expect(pageCount).not.toBeNull();
    if (pageCount === null) return;
    setInput(pageCount, '201');
    buttonByAction(container, 'start-import').click();
    await tick(20);
    expect(mounted.library.controller.getState().job).toBeNull();
    const alert = container.querySelector<HTMLElement>('[role="alert"]');
    expect(alert).not.toBeNull();
    expect(textOf(alert as HTMLElement)).toContain('这次操作被安全检查拒绝');
  });
});

function pageFor(container: HTMLElement): HTMLElement {
  const page = container.querySelector<HTMLElement>('[data-page-id]');
  if (page === null) throw new Error('page root not found');
  return page;
}
