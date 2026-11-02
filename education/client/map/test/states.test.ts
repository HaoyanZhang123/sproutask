import { afterEach, describe, expect, it } from 'vitest';
import {
  buttonByAction,
  cleanupMaps,
  hasPercent,
  mountMap,
  textOf,
  treeItem,
} from './helpers.js';

afterEach(cleanupMaps);

async function tick(ms = 20): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function openChapter(container: HTMLElement, tocId: string): Promise<void> {
  treeItem(container, tocId).click();
  await tick();
}

async function openConcept(container: HTMLElement, tocId: string, conceptId: string): Promise<void> {
  await openChapter(container, tocId);
  container.querySelector<HTMLButtonElement>(`button[data-concept-id="${conceptId}"]`)?.click();
  await tick(25);
}

function chipTestId(container: HTMLElement, id: string): string {
  return (container.querySelector(`[data-testid="${id}"]`)?.textContent ?? '').replace(/\s+/g, ' ').trim();
}

describe('three-axis state, self report and aggregate honesty (A18/A12 L2)', () => {
  it('shows learning, understanding and review as separate labels (reviewed but still needs support)', async () => {
    const { container } = await mountMap();
    await openConcept(container, 'toc.ch2', 'concept.photosynthesis');
    const detail = container.querySelector<HTMLElement>('[data-testid="map-detail"]');
    expect(detail?.dataset['conceptId']).toBe('concept.photosynthesis');
    expect(chipTestId(container, 'detail-learning')).toContain('本轮已完成');
    expect(chipTestId(container, 'detail-understanding')).toContain('需巩固');
    // A18: a finished review with a wrong answer keeps both facts visible.
    expect(chipTestId(container, 'detail-review-history')).toContain('复习完成 · 仍需巩固');
    expect(chipTestId(container, 'detail-review-due')).toContain('待复习');
    expect(textOf(detail as HTMLElement)).toContain('你的自评：不确定（学生自述，不算证据）');
    expect(textOf(detail as HTMLElement)).toContain('证据：共 1 条');
  });

  it('labels stale evidence instead of presenting a strong state as current', async () => {
    const { container } = await mountMap();
    expect(chipTestId(container, 'detail-understanding')).toContain('初步理解');
    expect(chipTestId(container, 'detail-understanding')).toContain('已过期');
    expect(textOf(container)).toContain('证据：共 1 条');
  });

  it('marks candidate content and disables strong claims', async () => {
    const { container } = await mountMap({ scenario: 'candidate' });
    expect(container.querySelector('[data-testid="map-candidate-banner"]')).not.toBeNull();
    await openConcept(container, 'toc.ch2', 'concept.photosynthesis');
    const understanding = chipTestId(container, 'detail-understanding');
    expect(understanding).toContain('候选内容禁用强结论');
    expect(understanding).not.toContain('需巩固');
    expect(container.querySelector('[data-testid="map-candidate-claim-warning"]')).not.toBeNull();
    expect(textOf(container)).toContain('候选概念 7 个（单列，不进入正式分母）');
    expect(textOf(container)).toContain('已学 0 / 可学习 0');
  });

  it('keeps the formal denominator deduplicated and shows no mastery percentage', async () => {
    const { container } = await mountMap();
    expect(textOf(container)).toContain('活动覆盖（按去重概念计数）：已学 5 / 可学习 7');
    expect(textOf(container)).toContain('部分内容（未覆盖全册）');
    expect(textOf(container)).not.toContain('掌握率');
    expect(hasPercent(textOf(container))).toBe(false);
    // 8 placements but 7 distinct concepts; the tree badge already proves dedupe.
    expect(treeItem(container, 'toc.volume').dataset['label']).toContain('7 个概念');
  });

  it('does not treat browsing or opening a page as learning progress', async () => {
    const { container } = await mountMap();
    await openConcept(container, 'toc.ch2', 'concept.respiration');
    expect(chipTestId(container, 'detail-learning')).toContain('未开始');
    expect(chipTestId(container, 'detail-understanding')).toContain('尚无足够证据');
    // browse other chapters and come back: no state is invented
    await openChapter(container, 'toc.ch1');
    await openChapter(container, 'toc.ch2');
    await openConcept(container, 'toc.ch2', 'concept.respiration');
    expect(chipTestId(container, 'detail-learning')).toContain('未开始');
    expect(textOf(container)).toContain('活动覆盖（按去重概念计数）：已学 5 / 可学习 7');
  });

  it('filters by state and offers a clear-filter action when nothing matches', async () => {
    const { container } = await mountMap();
    await openChapter(container, 'toc.ch2');
    container.querySelector<HTMLButtonElement>('button[data-filter="needs_support"]')?.click();
    await tick(5);
    const nodes = [...container.querySelectorAll<HTMLElement>('button.edu-map-node')];
    expect(nodes.map((node) => node.dataset['conceptId'])).toEqual(['concept.photosynthesis']);

    container.querySelector<HTMLButtonElement>('button[data-view-mode="concepts"]')?.click();
    await tick(5);
    expect(
      [...container.querySelectorAll<HTMLElement>('[data-testid="map-concept-list"] li')],
    ).toHaveLength(1);

    await openChapter(container, 'toc.ch3');
    container.querySelector<HTMLButtonElement>('button[data-filter="needs_support"]')?.click();
    await tick(5);
    container.querySelector<HTMLButtonElement>('button[data-view-mode="graph"]')?.click();
    await tick(5);
    expect(container.querySelector('[data-testid="map-graph-filtered-empty"]')).not.toBeNull();
    buttonByAction(container, 'clear-filter').click();
    await tick(5);
    expect(container.querySelector('[data-testid="map-graph-filtered-empty"]')).toBeNull();
    expect(container.querySelectorAll('button.edu-map-node').length).toBeGreaterThan(0);
  });

  it('searches by alias, keeps the keyword and locates the matching chapter', async () => {
    const { container } = await mountMap();
    const input = container.querySelector<HTMLInputElement>('[data-testid="map-search-input"]');
    expect(input).not.toBeNull();
    if (input === null) return;
    input.value = 'cell';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    buttonByAction(container, 'search').click();
    await tick(25);
    const results = container.querySelector<HTMLElement>('[data-testid="map-search-results"]');
    expect(results?.textContent).toContain('细胞');
    expect(results?.textContent).toContain('命中别名');
    (results?.querySelector('button') as HTMLButtonElement).click();
    await tick(30);
    expect(
      container.querySelector('[data-testid="map-detail"]')?.getAttribute('data-concept-id'),
    ).toBe('concept.cell');
    const after = container.querySelector<HTMLInputElement>('[data-testid="map-search-input"]');
    expect(after?.value).toBe('cell');
    buttonByAction(container, 'clear-search').click();
    await tick(5);
    expect(container.querySelector('[data-testid="map-search-results"]')).toBeNull();
  });
});
