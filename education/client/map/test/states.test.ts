import { afterEach, describe, expect, it } from 'vitest';
import { buildDemoPayload, createMapModel, resumeTarget } from '../src/index.js';
import {
  chapterRow,
  cleanupMaps,
  detailRoot,
  hasPercent,
  mountMap,
  openConcept,
  textOf,
  tick,
} from './helpers.js';

afterEach(cleanupMaps);

describe('four student states derived from the learner projection', () => {
  it('maps learning + understanding + review to 在学 / 要再练 / 比较稳 / 还没开始 without inventing state', () => {
    const model = createMapModel(buildDemoPayload('demo'));
    const state = (conceptId: string): string => model.summary(conceptId).state;
    // completed + supported + current evidence → 比较稳
    expect(state('concept.cell')).toBe('steady');
    // completed but only 初步理解 → still 在学
    expect(state('concept.cell-structure')).toBe('now');
    // started but no judgement yet → 在学
    expect(state('concept.cell-division')).toBe('now');
    expect(state('concept.organism')).toBe('steady');
    // understanding needs support (or last review needs support) → 要再练
    expect(state('concept.photosynthesis')).toBe('weak');
    // never touched → 还没开始
    expect(state('concept.respiration')).toBe('todo');
    // stale evidence never becomes 比较稳
    expect(state('concept.ecosystem')).toBe('now');
    for (const concept of model.payload.concepts) {
      const summary = model.summary(concept.id);
      expect(summary.stateLabel).toBe(
        { now: '在学', weak: '要再练', steady: '比较稳', todo: '还没开始' }[summary.state],
      );
    }
  });

  it('finds the concept with the newest local activity even if the source hint is stale', () => {
    const payload = { ...buildDemoPayload('demo'), initialConceptId: 'concept.cell', initialTocNodeId: 'toc.ch1' };
    const model = createMapModel(payload);
    const target = resumeTarget(payload, model.toc);
    // cell-division was started most recently (2026-10-29) and has an open session
    expect(target?.conceptId).toBe('concept.cell-division');
    expect(target?.chapterId).toBe('toc.ch1');
    expect(target?.title).toBe('细胞分裂');
  });

  it('shows the same four states as chips in the overview, tied to each chapter', async () => {
    const { container } = await mountMap();
    const stateOf = (chapterId: string, conceptId: string): string | null =>
      chapterRow(container, chapterId)
        .querySelector(`button.edu-map-chip[data-concept-id="${conceptId}"]`)
        ?.getAttribute('data-state') ?? null;
    expect(stateOf('toc.ch1', 'concept.cell')).toBe('steady');
    expect(stateOf('toc.ch1', 'concept.cell-structure')).toBe('now');
    expect(stateOf('toc.ch1', 'concept.cell-division')).toBe('now');
    expect(stateOf('toc.ch2', 'concept.photosynthesis')).toBe('weak');
    expect(stateOf('toc.ch2', 'concept.respiration')).toBe('todo');
    expect(stateOf('toc.ch3', 'concept.ecosystem')).toBe('now');
    expect(textOf(container)).toContain('还没开始');
    expect(hasPercent(textOf(container))).toBe(false);
  });

  it('opens a 要再练 concept with 先复习 as the primary action', async () => {
    const { container } = await mountMap();
    const detail = await openConcept(container, 'toc.ch2', 'concept.photosynthesis');
    expect(detail.getAttribute('data-state')).toBe('weak');
    expect(textOf(detail)).toContain('要再练');
    const review = detail.querySelector<HTMLButtonElement>('button[data-action="start-review"]');
    const learn = detail.querySelector<HTMLButtonElement>('button[data-action="start-learn"]');
    expect(review?.className).toContain('edu-button--primary');
    expect(learn?.className).not.toContain('edu-button--primary');
    expect(review?.getAttribute('data-route')).toBe(
      '/workspace?mode=review&concept=concept.photosynthesis',
    );
    // due review stays visible as its own fact
    expect(textOf(detail)).toContain('待复习');
  });

  it('keeps 还没开始 honest and starts learning from the detail card', async () => {
    const { container } = await mountMap();
    const detail = await openConcept(container, 'toc.ch2', 'concept.respiration');
    expect(detail.getAttribute('data-state')).toBe('todo');
    expect(textOf(detail)).toContain('还没开始');
    expect(textOf(detail)).toContain('课本第 28 页');
    expect(textOf(detail)).toContain('未核实');
    const learn = detail.querySelector<HTMLButtonElement>('button[data-action="start-learn"]');
    expect(learn?.className).toContain('edu-button--primary');
    expect(learn?.getAttribute('data-route')).toBe(
      '/workspace?mode=learn&concept=concept.respiration',
    );
  });

  it('marks candidate content as 未核实 and never shows a strong state', async () => {
    const { container } = await mountMap({ scenario: 'candidate' });
    expect(textOf(container)).toContain('候选内容（未核实）');
    expect(container.querySelector('[data-testid="map-candidate-banner"]')?.textContent).toContain(
      '候选内容还没核实',
    );
    expect(container.querySelectorAll('button.edu-map-chip[data-state="steady"]')).toHaveLength(0);
    expect(container.querySelectorAll('button.edu-map-chip[data-state="weak"]')).toHaveLength(0);
    const ch2 = chapterRow(container, 'toc.ch2');
    const detail = await openConcept(container, 'toc.ch2', 'concept.photosynthesis');
    expect(detail.getAttribute('data-state')).toBe('now');
    expect(textOf(detail)).toContain('未核实');
  });

  it('browsing the map never turns into learning progress', async () => {
    const { container } = await mountMap();
    const before = textOf(container);
    await openConcept(container, 'toc.ch2', 'concept.respiration');
    await tick(5);
    expect(textOf(detailRoot(container) as HTMLElement)).toContain('还没开始');
    container.querySelector<HTMLButtonElement>('button[data-action="back-overview"]')?.click();
    await tick(5);
    expect(textOf(container)).toContain('已学 6 / 7 个概念');
    expect(textOf(container)).not.toMatch(/掌握|覆盖率|%/);
    expect(before).toContain('2 个单元 · 3 章 · 5 节 · 7 个概念');
  });
});
