import { afterEach, describe, expect, it } from 'vitest';
import {
  buttonByAction,
  cleanupMaps,
  edgesOf,
  graphNodes,
  mountMap,
  textOf,
  treeItem,
} from './helpers.js';

afterEach(cleanupMaps);

async function openChapter(container: HTMLElement, tocId: string): Promise<void> {
  treeItem(container, tocId).click();
  await new Promise((resolve) => setTimeout(resolve, 25));
}

describe('local concept graph and relation semantics (A11/A12 L2)', () => {
  it('opens a bounded chapter graph instead of the whole volume', async () => {
    const { container, map } = await mountMap();
    // default chapter is the last studied one (1 concept + 1 external)
    expect(graphNodes(container).length).toBeLessThanOrEqual(24);
    await openChapter(container, 'toc.ch1');
    const nodes = graphNodes(container);
    expect(nodes).toHaveLength(3);
    expect(nodes.map((node) => node.dataset['conceptId']).sort()).toEqual([
      'concept.cell',
      'concept.cell-division',
      'concept.cell-structure',
    ]);
    expect(map.getTimings().lastGraphLoadMs).toBeGreaterThanOrEqual(0);
    const canvas = container.querySelector<HTMLElement>('[data-testid="map-graph-canvas"]');
    expect(Number(canvas?.dataset['nodeCount'])).toBe(3);
    // no concept from other chapters is painted on first render
    expect(nodes.some((node) => node.dataset['conceptId'] === 'concept.ecosystem')).toBe(false);
  });

  it('distinguishes prerequisite and related edges by line style, legend and text list', async () => {
    const { container } = await mountMap();
    await openChapter(container, 'toc.ch1');
    const edges = edgesOf(container);
    const prerequisiteEdges = edges.filter((edge) => edge.dataset['edgeType'] === 'prerequisite');
    const relatedEdges = edges.filter((edge) => edge.dataset['edgeType'] === 'related');
    expect(prerequisiteEdges).toHaveLength(1);
    expect(relatedEdges).toHaveLength(1);
    expect(prerequisiteEdges[0]?.className).toContain('edu-map-edge--prerequisite');
    expect(relatedEdges[0]?.className).toContain('edu-map-edge--related');
    expect(prerequisiteEdges[0]?.getAttribute('aria-hidden')).toBe('true');

    const legend = container.querySelector('[data-testid="map-graph-legend"]');
    expect(legend?.textContent).toContain('先修（实线箭头）');
    expect(legend?.textContent).toContain('相关（虚线）');

    container.querySelector<HTMLButtonElement>('button[data-view-mode="relations"]')?.click();
    await new Promise((resolve) => setTimeout(resolve, 5));
    const table = container.querySelector<HTMLElement>('[data-testid="map-relation-list"]');
    expect(table).not.toBeNull();
    const rows = [...(table as HTMLElement).querySelectorAll<HTMLElement>('tbody tr')];
    expect(rows).toHaveLength(2);
    const prerequisiteRow = rows.find((row) => row.dataset['edgeType'] === 'prerequisite');
    expect(prerequisiteRow?.textContent).toContain('先修');
    expect(prerequisiteRow?.textContent).toContain('教学推断（非教材原文）');
    expect(prerequisiteRow?.textContent).toContain('先理解结构再理解分裂');
    const relatedRow = rows.find((row) => row.dataset['edgeType'] === 'related');
    expect(relatedRow?.textContent).toContain('相关');
    expect(relatedRow?.textContent).toContain('教材明示');
    expect(relatedRow?.textContent).toContain('PDF 第 19 页');
  });

  it('offers an equivalent text concept list for the same chapter', async () => {
    const { container } = await mountMap();
    await openChapter(container, 'toc.ch1');
    container
      .querySelector<HTMLButtonElement>('button[data-view-mode="concepts"]')
      ?.click();
    await new Promise((resolve) => setTimeout(resolve, 5));
    const list = container.querySelector('[data-testid="map-concept-list"]');
    expect(list).not.toBeNull();
    const buttons = [...(list as HTMLElement).querySelectorAll('button')];
    expect(buttons).toHaveLength(3);
    expect(textOf(container)).toContain('同概念多节只计一次');
  });

  it('shows cross-chapter relations as expandable, bounded neighborhoods', async () => {
    const { container } = await mountMap();
    await openChapter(container, 'toc.ch1');
    const external = container.querySelector('[data-testid="map-external-concepts"]');
    expect(external).not.toBeNull();
    expect(textOf(external as HTMLElement)).toContain('跨章关联 3 个');
    expect(
      external?.querySelector('[data-concept-id="concept.ecosystem"]'),
    ).not.toBeNull();

    const expandButtons = external?.querySelectorAll<HTMLButtonElement>(
      'button[data-action="expand-external"]',
    );
    expect(expandButtons?.length).toBe(3);
    const ecosystemRow = external?.querySelector<HTMLElement>('[data-concept-id="concept.ecosystem"]');
    ecosystemRow?.querySelector<HTMLButtonElement>('button[data-action="expand-external"]')?.click();
    await new Promise((resolve) => setTimeout(resolve, 25));

    expect(textOf(container)).toContain('已展开跨章局部邻域');
    const nodes = graphNodes(container);
    expect(nodes.length).toBeGreaterThan(1);
    expect(nodes.length).toBeLessThanOrEqual(25);
    expect(nodes.some((node) => node.dataset['conceptId'] === 'concept.ecosystem')).toBe(true);
    const collapse = buttonByAction(container, 'collapse-external');
    collapse.click();
    await new Promise((resolve) => setTimeout(resolve, 25));
    expect(container.querySelector('[data-testid="map-external-concepts"]')).not.toBeNull();
  });

  it('pages extra in-chapter concepts behind an explicit expand button', async () => {
    const { container } = await mountMap({ scenario: 'scale' });
    expect(graphNodes(container).length).toBe(24);
    expect(textOf(container)).toContain('本章还有 1 个概念未显示');
    const showMore = buttonByAction(container, 'show-more-concepts');
    showMore.click();
    await new Promise((resolve) => setTimeout(resolve, 40));
    expect(graphNodes(container).length).toBe(25);
    expect(textOf(container)).not.toContain('本章还有 1 个概念未显示');
  });

  it('suggests an unlearned prerequisite without blocking the target concept', async () => {
    const { container } = await mountMap();
    // open chapter 2 and select photosynthesis (its prerequisite cell is in ch1)
    await openChapter(container, 'toc.ch2');
    container.querySelector<HTMLButtonElement>('button[data-concept-id="concept.photosynthesis"]')?.click();
    await new Promise((resolve) => setTimeout(resolve, 25));
    const prerequisites = container.querySelector('[data-testid="map-detail-prerequisites"]');
    expect(prerequisites).not.toBeNull();
    expect(textOf(prerequisites as HTMLElement)).toContain('建议先学（不阻断进入）');
    expect(textOf(prerequisites as HTMLElement)).toContain('理解光合作用前先认识细胞');
    const learnAnyway = buttonByAction(container, 'learn-target-anyway');
    expect(learnAnyway.disabled).toBe(false);
    const startLearn = buttonByAction(container, 'start-learn');
    expect(startLearn.disabled).toBe(false);
    const lookFirst = buttonByAction(container, 'look-first');
    lookFirst.click();
    await new Promise((resolve) => setTimeout(resolve, 25));
    expect(textOf(prerequisites as HTMLElement)).toContain('已学：细胞');
    expect(
      container.querySelector('[data-testid="map-detail"]')?.getAttribute('data-concept-id'),
    ).toBe('concept.cell-division');
  });
});
