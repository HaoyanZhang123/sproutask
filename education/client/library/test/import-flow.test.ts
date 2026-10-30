import { afterEach, describe, expect, it } from 'vitest';
import {
  buttonByAction,
  cleanupLibraries,
  mountLibrary,
  setInput,
  textOf,
  tick,
} from './helpers.js';
import { FixtureLibraryDataSource } from '../src/index.js';

afterEach(cleanupLibraries);

async function chooseAndStart(container: HTMLElement): Promise<void> {
  buttonByAction(container, 'choose-file').click();
  await tick(10);
  buttonByAction(container, 'start-import').click();
  await tick(20);
}

describe('library import flow', () => {
  it('shows metadata confirmation, real stages/units, monotonic updates and cancel/resume', async () => {
    const mounted = await mountLibrary();
    const { container, library, data } = mounted;
    buttonByAction(container, 'choose-file').click();
    await tick(10);
    const selected = container.querySelector<HTMLElement>('[data-testid="library-selected-file"]');
    expect(selected).not.toBeNull();
    expect(textOf(selected as HTMLElement)).toContain('合成教材.pdf');
    expect(textOf(selected as HTMLElement)).toContain('不会上传整本');
    buttonByAction(container, 'start-import').click();
    await tick(20);
    expect(container.querySelector('[data-testid="library-import-job"]')).not.toBeNull();
    expect(library.controller.getState().job?.stage).toBe('extract');
    expect(textOf(container)).toContain('当前阶段：提取内容');
    expect(textOf(container)).toContain('4 / 200');

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
    expect(textOf(container)).toContain('整理结构');
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
    expect(textOf(container)).toContain('迟到结果不会写入');

    buttonByAction(container, 'resume-import').click();
    await tick(10);
    expect(library.controller.getState().job?.status).toBe('running');
    expect(textOf(container)).toContain('已恢复同一导入任务');
  });

  it('shows same-hash idempotency and does not duplicate the book', async () => {
    const { container } = await mountLibrary({ scenario: 'duplicate' });
    await chooseAndStart(container);
    expect(container.querySelector('[data-testid="library-duplicate-notice"]')).not.toBeNull();
    expect(textOf(container)).toContain('同一文件已存在');
    expect(textOf(container)).toContain('不会重复建书');
  });

  it('keeps await_review as pending review, never as import completion', async () => {
    const { container } = await mountLibrary({ scenario: 'await-review' });
    await chooseAndStart(container);
    const pending = container.querySelector<HTMLElement>('[data-testid="library-await-review"]');
    expect(pending).not.toBeNull();
    expect(textOf(pending as HTMLElement)).toContain('待审核：不是导入完成');
    expect(container.querySelector('[data-testid="library-ready"]')).toBeNull();
    expect(textOf(container)).toContain('当前阶段：等待审校');
    expect(textOf(pending as HTMLElement)).toContain('不显示“已完成”');
  });

  it('surfaces same-edition rescan as candidate/page-mapping review', async () => {
    const { container } = await mountLibrary({ scenario: 'same-edition-rescan' });
    await chooseAndStart(container);
    const match = container.querySelector<HTMLElement>('[data-testid="library-match-notice"]');
    expect(match).not.toBeNull();
    expect(textOf(match as HTMLElement)).toContain('同版不同扫描');
    expect(textOf(match as HTMLElement)).toContain('候选');
  });

  it('shows a ready state only for the declared scope', async () => {
    const { container } = await mountLibrary({ scenario: 'ready' });
    await chooseAndStart(container);
    const ready = container.querySelector<HTMLElement>('[data-testid="library-ready"]');
    expect(ready).not.toBeNull();
    expect(textOf(ready as HTMLElement)).toContain('按包声明的范围');
  });

  it('keeps a long-running job visible across a page remount and re-subscribes to progress', async () => {
    const mounted = await mountLibrary();
    await chooseAndStart(mounted.container);
    const { shell, library, data } = mounted;
    expect(library.controller.getState().job?.status).toBe('running');
    await shell.navigate('/home');
    await tick(10);
    await shell.navigate('/library');
    await tick(20);
    expect(library.controller.getState().job?.status).toBe('running');
    expect(textOf(mounted.container)).toContain('导入任务');
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

  it('rejects a metadata page count that does not match the file', async () => {
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
