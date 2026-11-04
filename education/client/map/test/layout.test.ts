import { describe, expect, it } from 'vitest';
import type { Relation } from '@edu/domain';
import {
  CATALOG_STAGE_LABEL,
  CHAPTER_GRAPH_METRICS,
  STAGE_LABELS,
  layoutChapter,
  relationPath,
  type ChapterLayoutNode,
} from '../src/layout.js';

function relation(
  id: string,
  from: string,
  to: string,
  type: Relation['type'] = 'prerequisite',
): Relation {
  return {
    schemaVersion: 1,
    id,
    courseEditionId: 'course.test',
    fromConceptId: from,
    toConceptId: to,
    type,
    basis: 'explicit_source',
    rationale: '',
    sourceRefs: [],
    reviewState: 'published',
  };
}

function chains(count: number): { ids: string[]; relations: Relation[] } {
  const ids = Array.from({ length: count }, (_, index) => `c${index + 1}`);
  const relations = ids.slice(1).map((id, index) => relation(`r${index}`, `c${index + 1}`, id));
  return { ids, relations };
}

function overlaps(left: ChapterLayoutNode, right: ChapterLayoutNode): boolean {
  return (
    Math.abs(left.x - right.x) < CHAPTER_GRAPH_METRICS.nodeWidth &&
    Math.abs(left.y - right.y) < CHAPTER_GRAPH_METRICS.nodeHeight
  );
}

describe('chapter graph layout (deterministic, layered, non-overlapping)', () => {
  it('lays prerequisites out in strictly increasing layers and never overlaps nodes', () => {
    const { ids, relations } = chains(5);
    const layout = layoutChapter({ conceptIds: ids, relations });
    expect(layout.nodes).toHaveLength(5);
    expect(layout.degraded).toBe(false);
    for (const current of layout.nodes) {
      expect(Number.isFinite(current.x)).toBe(true);
      expect(Number.isFinite(current.y)).toBe(true);
      expect(current.x).toBeGreaterThanOrEqual(CHAPTER_GRAPH_METRICS.padding);
      expect(current.x + CHAPTER_GRAPH_METRICS.nodeWidth).toBeLessThanOrEqual(layout.width);
      expect(current.y + CHAPTER_GRAPH_METRICS.nodeHeight).toBeLessThanOrEqual(layout.height);
    }
    for (let left = 0; left < layout.nodes.length; left += 1) {
      for (let right = left + 1; right < layout.nodes.length; right += 1) {
        expect(overlaps(layout.nodes[left] as ChapterLayoutNode, layout.nodes[right] as ChapterLayoutNode)).toBe(
          false,
        );
      }
    }
    // A prerequisite always points to a deeper (never earlier) layer/stage.
    for (const edge of relations) {
      const from = layout.byId.get(edge.fromConceptId);
      const to = layout.byId.get(edge.toConceptId);
      expect(from).toBeDefined();
      expect(to).toBeDefined();
      if (from === undefined || to === undefined) continue;
      expect(to.layer).toBeGreaterThan(from.layer);
      expect(to.stage).toBeGreaterThanOrEqual(from.stage);
      expect(to.stage).toBeLessThanOrEqual(STAGE_LABELS.length - 1);
    }
    // Layer count is strict even when display stages clamp at four.
    expect(layout.byId.get('c3')?.layer).toBe(2);
    expect(layout.byId.get('c5')?.layer).toBe(4);
    expect(layout.byId.get('c5')?.stage).toBe(3);
    expect(layout.stageLabels).toEqual([...STAGE_LABELS]);
  });

  it('keeps catalog order inside a stage and for independent roots', () => {
    const layout = layoutChapter({
      conceptIds: ['b', 'a', 'c'],
      relations: [relation('r1', 'a', 'c'), relation('r2', 'b', 'c')],
    });
    expect(layout.byId.get('b')?.row).toBe(0);
    expect(layout.byId.get('a')?.row).toBe(1);
    expect(layout.byId.get('c')?.stage).toBe(1);
    // same column ⇒ same x, different y (fixed pitch above the node height)
    expect(layout.byId.get('b')?.x).toBe(layout.byId.get('a')?.x);
    expect(
      Math.abs((layout.byId.get('a')?.y ?? 0) - (layout.byId.get('b')?.y ?? 0)),
    ).toBeGreaterThanOrEqual(CHAPTER_GRAPH_METRICS.nodeHeight + CHAPTER_GRAPH_METRICS.gapY - 0.001);
  });

  it('ignores related edges for layering but still returns deterministic coordinates', () => {
    const first = layoutChapter({
      conceptIds: ['a', 'b'],
      relations: [relation('r1', 'b', 'a', 'related')],
    });
    expect(first.byId.get('a')?.layer).toBe(0);
    expect(first.byId.get('b')?.layer).toBe(0);
    const second = layoutChapter({
      conceptIds: ['a', 'b'],
      relations: [relation('r1', 'b', 'a', 'related')],
    });
    expect(second.nodes).toEqual(first.nodes);
  });

  it('degrades to catalog order when prerequisite relations contain a cycle', () => {
    const layout = layoutChapter({
      conceptIds: ['a', 'b', 'c'],
      relations: [relation('r1', 'a', 'b'), relation('r2', 'b', 'a'), relation('r3', 'b', 'c')],
    });
    expect(layout.degraded).toBe(true);
    expect(layout.stageLabels).toEqual([CATALOG_STAGE_LABEL]);
    expect(layout.stages).toHaveLength(1);
    expect(layout.nodes.map((node) => node.conceptId)).toEqual(['a', 'b', 'c']);
    expect(layout.nodes.map((node) => node.row)).toEqual([0, 1, 2]);
    for (let left = 0; left < layout.nodes.length; left += 1) {
      for (let right = left + 1; right < layout.nodes.length; right += 1) {
        expect(overlaps(layout.nodes[left] as ChapterLayoutNode, layout.nodes[right] as ChapterLayoutNode)).toBe(
          false,
        );
      }
    }
  });

  it('handles an empty chapter without inventing nodes', () => {
    const layout = layoutChapter({ conceptIds: [], relations: [] });
    expect(layout.nodes).toEqual([]);
    expect(layout.stages).toEqual([]);
    expect(layout.stageLabels).toEqual([]);
    expect(layout.width).toBeGreaterThan(0);
    expect(layout.height).toBeGreaterThan(0);
  });

  it('produces drawable bezier edges, including same-stage and self edges', () => {
    const { ids, relations } = chains(3);
    const layout = layoutChapter({
      conceptIds: ids,
      relations: [...relations, relation('related1', 'c1', 'c2', 'related')],
    });
    const from = layout.byId.get('c1');
    const to = layout.byId.get('c2');
    expect(from).toBeDefined();
    expect(to).toBeDefined();
    if (from === undefined || to === undefined) return;
    expect(relationPath(from, to)).toMatch(/^M .+ C .+$/);
    expect(relationPath(from, from)).toBe('');
    // same stage: loops around the right edge
    const same = { ...from, stage: to.stage };
    expect(relationPath(same, to)).toMatch(/^M .+ C .+$/);
  });
});
