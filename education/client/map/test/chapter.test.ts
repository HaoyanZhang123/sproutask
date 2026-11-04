import { afterEach, describe, expect, it } from 'vitest';
import type { TocNodeLike } from '@edu/domain';
import {
  buttonByView,
  cleanupMaps,
  detailConceptId,
  graphEdges,
  graphNodes,
  listNodes,
  mountMap,
  openChapter,
  openConcept,
  sourceWithPayload,
  textOf,
  tick,
  waitForDetail,
} from './helpers.js';

afterEach(cleanupMaps);

function chapterNode(id: string, parentId: string, title: string, order: number): TocNodeLike {
  return {
    schemaVersion: 1,
    id,
    courseEditionId: 'course.biology-demo',
    parentId,
    type: 'chapter',
    title,
    order,
    sourceRefs: [],
  };
}

function nodePositions(container: HTMLElement): { left: number; top: number; id: string }[] {
  return graphNodes(container).map((node) => ({
    id: node.dataset['conceptId'] ?? '',
    left: Number(node.style.left.replace('rem', '')) * 16,
    top: Number(node.style.top.replace('rem', '')) * 16,
  }));
}

describe('chapter relation graph (level two)', () => {
  it('paints the chapter graph with layered positions, fixed node size and arrowed edges', async () => {
    const { container } = await mountMap();
    await openChapter(container, 'toc.ch1');

    const nodes = graphNodes(container);
    expect(nodes).toHaveLength(3);
    expect(nodes.map((node) => node.dataset['conceptId']).sort()).toEqual([
      'concept.cell',
      'concept.cell-division',
      'concept.cell-structure',
    ]);
    const positions = nodePositions(container);
    for (const node of graphNodes(container)) {
      expect(node.style.left).toMatch(/rem$/);
      expect(node.style.top).toMatch(/rem$/);
      expect(node.dataset['layer']).not.toBeUndefined();
      expect(node.dataset['stage']).not.toBeUndefined();
    }
    for (let left = 0; left < positions.length; left += 1) {
      for (let right = left + 1; right < positions.length; right += 1) {
        const a = positions[left] as { left: number; top: number };
        const b = positions[right] as { left: number; top: number };
        expect(Math.abs(a.left - b.left) >= 200 || Math.abs(a.top - b.top) >= 88).toBe(true);
      }
    }
    // 先学 / 接着学 labels above the columns that exist
    const levels = [...container.querySelectorAll<HTMLElement>('.edu-map-graph__level')].map(
      (level) => level.textContent,
    );
    expect(levels[0]).toBe('先学');
    expect(levels[1]).toBe('接着学');

    const edges = graphEdges(container);
    expect(edges).toHaveLength(2);
    const prerequisite = edges.find((edge) => edge.getAttribute('data-edge-type') === 'prerequisite');
    const related = edges.find((edge) => edge.getAttribute('data-edge-type') === 'related');
    expect(prerequisite?.getAttribute('marker-end')).toContain('edu-map-arrow');
    expect(related?.getAttribute('marker-end')).toBeNull();
    expect(prerequisite?.getAttribute('aria-hidden')).toBeNull();
    expect(prerequisite?.closest('svg')?.getAttribute('aria-hidden')).toBe('true');
  });

  it('highlights prerequisites and successors of the selected concept', async () => {
    const { container } = await mountMap();
    await openChapter(container, 'toc.ch1');
    await openConcept(container, 'toc.ch1', 'concept.cell');

    const structure = container.querySelector<HTMLElement>(
      'button.edu-map-node[data-concept-id="concept.cell-structure"]',
    );
    const division = container.querySelector<HTMLElement>(
      'button.edu-map-node[data-concept-id="concept.cell-division"]',
    );
    const cell = container.querySelector<HTMLElement>('button.edu-map-node[data-concept-id="concept.cell"]');
    expect(cell?.classList.contains('is-selected')).toBe(true);
    expect(cell?.getAttribute('aria-pressed')).toBe('true');
    // cell → division is a "related" edge (no prerequisite order)
    expect(division?.classList.contains('is-next')).toBe(false);
    expect(structure?.classList.contains('is-prerequisite')).toBe(false);

    const dimmed = graphEdges(container).filter((edge) => edge.classList.contains('is-dimmed'));
    expect(dimmed.length).toBeGreaterThan(0);

    container
      .querySelector<HTMLButtonElement>('button.edu-map-node[data-concept-id="concept.cell-division"]')
      ?.click();
    await waitForDetail(container, 'concept.cell-division');
    expect(
      container
        .querySelector('button.edu-map-node[data-concept-id="concept.cell-structure"]')
        ?.classList.contains('is-prerequisite'),
    ).toBe(true);
    const active = graphEdges(container).filter((edge) => edge.classList.contains('is-active'));
    expect(active).toHaveLength(2);
  });

  it('shows the detail card below the graph with state, page, relations and learning actions', async () => {
    const { container } = await mountMap();
    await openConcept(container, 'toc.ch1', 'concept.cell-division');
    const detail = container.querySelector<HTMLElement>('[data-testid="map-detail"]');
    expect(detail).not.toBeNull();
    if (detail === null) return;
    expect(detail.getAttribute('data-concept-id')).toBe('concept.cell-division');
    expect(textOf(detail)).toContain('细胞分裂');
    expect(textOf(detail)).toContain('课本第 19 页');
    expect(textOf(detail)).toContain('未核实');
    expect(textOf(detail)).toContain('在学');
    expect(textOf(detail)).toContain('先修（建议先理解）');
    expect(textOf(detail)).toContain('后继（学完这里可以接着去）');
    expect(detail.querySelector('[data-peer-id="concept.cell-structure"]')).not.toBeNull();
    expect(detail.querySelector('[data-peer-id="concept.photosynthesis"]')).not.toBeNull();

    const learn = detail.querySelector<HTMLButtonElement>('button[data-action="start-learn"]');
    const review = detail.querySelector<HTMLButtonElement>('button[data-action="start-review"]');
    expect(learn?.getAttribute('data-route')).toBe(
      '/workspace?mode=learn&concept=concept.cell-division',
    );
    expect(review?.getAttribute('data-route')).toBe(
      '/workspace?mode=review&concept=concept.cell-division',
    );
    expect(learn?.textContent).toBe('开始学习');
    expect(review?.textContent).toBe('先复习');
  });

  it('follows a cross-chapter relation into the other chapter', async () => {
    const { container } = await mountMap();
    await openConcept(container, 'toc.ch1', 'concept.cell-division');
    container
      .querySelector<HTMLButtonElement>('[data-testid="map-detail"] [data-peer-id="concept.photosynthesis"]')
      ?.click();
    await waitForDetail(container, 'concept.photosynthesis');
    expect(container.querySelector('[data-testid="map-chapter-title"]')?.textContent).toContain('第 2 章');
    expect(detailConceptId(container)).toBe('concept.photosynthesis');
  });

  it('walks chapters in catalog order across units', async () => {
    const { container } = await mountMap();
    await openChapter(container, 'toc.ch1');
    container.querySelector<HTMLButtonElement>('button[data-action="next-chapter"]')?.click();
    await tick(5);
    expect(container.querySelector('[data-testid="map-chapter-title"]')?.textContent).toContain('第 2 章');
    container.querySelector<HTMLButtonElement>('button[data-action="next-chapter"]')?.click();
    await tick(5);
    expect(container.querySelector('[data-testid="map-chapter-title"]')?.textContent).toContain('第 3 章');
    expect(
      (container.querySelector('button[data-action="next-chapter"]') as HTMLButtonElement).disabled,
    ).toBe(true);
  });

  it('offers the same chapter as a nested, fully tabbable list', async () => {
    const { container } = await mountMap();
    await openChapter(container, 'toc.ch1');
    const graphIds = graphNodes(container).map((node) => node.dataset['conceptId']).sort();
    buttonByView(container, 'list').click();
    await tick(5);

    expect(container.querySelector('[data-testid="map-graph-list"]')).not.toBeNull();
    expect(container.querySelector('button.edu-map-node')).toBeNull();
    const listConceptIds = listNodes(container).map((node) => node.dataset['conceptId']).sort();
    expect(listConceptIds).toEqual(graphIds);
    for (const button of listNodes(container)) {
      expect(button.type).toBe('button');
      expect(button.hasAttribute('tabindex')).toBe(false);
    }
    const stageTitles = [
      ...container.querySelectorAll<HTMLElement>('[data-testid="map-graph-list"] .edu-map-nested__stage-title'),
    ];
    expect(stageTitles.map((title) => title.textContent)).toEqual(['先学', '接着学']);
    // nested relation links are real buttons too
    expect(
      container.querySelectorAll('[data-testid="map-graph-list"] button.edu-map-link').length,
    ).toBeGreaterThan(0);

    const toggle = container.querySelector('[data-testid="map-view-toggle"]');
    expect(toggle?.querySelector('button[data-view-mode="list"]')?.getAttribute('aria-pressed')).toBe(
      'true',
    );
    buttonByView(container, 'graph').click();
    await tick(5);
    expect(graphNodes(container)).toHaveLength(3);
  });

  it('falls back to catalog order when prerequisite relations form a cycle', async () => {
    const cyclic = sourceWithPayload({
      relations: [
        {
          schemaVersion: 1,
          id: 'relation.cycle.1',
          courseEditionId: 'course.biology-demo',
          fromConceptId: 'concept.cell-structure',
          toConceptId: 'concept.cell-division',
          type: 'prerequisite',
          basis: 'explicit_source',
          rationale: '测试用环',
          sourceRefs: [],
          reviewState: 'published',
        },
        {
          schemaVersion: 1,
          id: 'relation.cycle.2',
          courseEditionId: 'course.biology-demo',
          fromConceptId: 'concept.cell-division',
          toConceptId: 'concept.cell-structure',
          type: 'prerequisite',
          basis: 'explicit_source',
          rationale: '测试用环',
          sourceRefs: [],
          reviewState: 'published',
        },
      ],
    });
    const { container } = await mountMap({ dataSource: cyclic });
    await openChapter(container, 'toc.ch1');
    expect(container.querySelector('[data-testid="map-degraded-note"]')?.textContent).toContain(
      '按课本目录顺序排列',
    );
    expect(container.querySelectorAll('.edu-map-graph__level')).toHaveLength(1);
    expect(textOf(container)).toContain('按目录顺序');
    expect(graphNodes(container)).toHaveLength(3);
  });

  it('shows an empty state for a chapter without concepts', async () => {
    const withEmptyChapter = sourceWithPayload({
      toc: [
        {
          schemaVersion: 1,
          id: 'toc.volume',
          courseEditionId: 'course.biology-demo',
          parentId: null,
          type: 'volume',
          title: '合成演示教材（七上）',
          order: 0,
          sourceRefs: [],
        },
        {
          schemaVersion: 1,
          id: 'toc.unit1',
          courseEditionId: 'course.biology-demo',
          parentId: 'toc.volume',
          type: 'unit',
          title: '第 1 单元 生物体的结构层次',
          order: 0,
          sourceRefs: [],
        },
        chapterNode('toc.ch1', 'toc.unit1', '第 1 章 细胞', 0),
        chapterNode('toc.ch9', 'toc.unit1', '第 9 章 空章', 1),
      ],
      initialTocNodeId: null,
      initialConceptId: null,
    });
    const { container } = await mountMap({ dataSource: withEmptyChapter });
    await openChapter(container, 'toc.ch9');
    expect(container.querySelector('[data-testid="map-graph-empty"]')).not.toBeNull();
    expect(textOf(container)).toContain('这一章还没有可显示的概念');
    // The chapter without concepts still shows a detail prompt, not an error.
    expect(container.querySelector('[data-testid="map-detail-placeholder"]')).not.toBeNull();
  });
});
