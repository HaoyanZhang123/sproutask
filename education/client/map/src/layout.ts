/**
 * Deterministic chapter graph layout (no third-party graph library).
 *
 * Rules:
 * - Layer = longest prerequisite path from a chapter's own starting concepts
 *   (`先学 → 接着学 → 再学`). Any concept deeper than the fourth stage shares
 *   the `连起来` stage, so the graph never grows sideways without bound.
 * - A cycle (a concept that would be its own prerequisite) cannot be layered;
 *   the layout then degrades to plain catalog order.
 * - Nodes inside one stage keep catalog order, so the same input always paints
 *   the same picture.
 * - Node size is fixed; positions use `nodeWidth/nodeHeight` + gaps, so two
 *   nodes can never overlap.
 */

import type { Id, Relation } from '@edu/domain';

/** Design pixels at the 16px base font; render code converts them to rem. */
export const CHAPTER_GRAPH_METRICS = {
  nodeWidth: 200,
  nodeHeight: 88,
  gapX: 48,
  gapY: 24,
  padding: 24,
  /** Space reserved above the first row for the stage labels. */
  labelHeight: 28,
  maxStages: 4,
  unitPx: 16,
} as const;

export const STAGE_LABELS = ['先学', '接着学', '再学', '连起来'] as const;
export const CATALOG_STAGE_LABEL = '按目录顺序';

export interface ChapterLayoutNode {
  readonly conceptId: Id;
  /** Longest prerequisite path from the chapter start (0 = 先学). */
  readonly layer: number;
  /** Display column 0..maxStages-1. */
  readonly stage: number;
  /** Row inside the stage, in catalog order. */
  readonly row: number;
  readonly x: number;
  readonly y: number;
}

export interface ChapterLayout {
  /** Paint order: stage by stage, row by row. */
  readonly nodes: readonly ChapterLayoutNode[];
  readonly byId: ReadonlyMap<Id, ChapterLayoutNode>;
  readonly stages: readonly (readonly Id[])[];
  readonly stageLabels: readonly string[];
  readonly width: number;
  readonly height: number;
  /** True when prerequisite relations contained a cycle and order was used. */
  readonly degraded: boolean;
  readonly nodeWidth: number;
  readonly nodeHeight: number;
}

export interface ChapterLayoutInput {
  /** Chapter concept ids in catalog (toc) order. */
  readonly conceptIds: readonly Id[];
  /** Relations already limited to this chapter; only `prerequisite` is layered. */
  readonly relations: readonly Relation[];
  readonly maxStages?: number;
}

function toRem(px: number): number {
  return px / CHAPTER_GRAPH_METRICS.unitPx;
}

export function pxToRem(px: number): string {
  return `${toRem(px)}rem`;
}

function buildNodes(
  orderedIds: readonly Id[],
  layers: ReadonlyMap<Id, number>,
  stageOf: (id: Id) => number,
  maxStages: number,
): { nodes: ChapterLayoutNode[]; stages: Id[][]; maxRows: number; stageCount: number } {
  const orderIndex = new Map<Id, number>(orderedIds.map((id, index) => [id, index]));
  const buckets = new Map<number, Id[]>();
  for (const id of orderedIds) {
    const stage = stageOf(id);
    const list = buckets.get(stage) ?? [];
    list.push(id);
    buckets.set(stage, list);
  }
  const nodes: ChapterLayoutNode[] = [];
  const stages: Id[][] = [];
  let maxRows = 0;
  const stageCount =
    buckets.size === 0
      ? 0
      : Math.max(0, Math.min(maxStages, Math.max(...[...buckets.keys()].map((key) => key + 1))));
  for (let stage = 0; stage < stageCount; stage += 1) {
    const ids = buckets.get(stage) ?? [];
    ids.sort((left, right) => {
      const layerDiff = (layers.get(left) ?? 0) - (layers.get(right) ?? 0);
      if (layerDiff !== 0) return layerDiff;
      return (orderIndex.get(left) ?? 0) - (orderIndex.get(right) ?? 0);
    });
    stages.push(ids);
    maxRows = Math.max(maxRows, ids.length);
    ids.forEach((id, row) => {
      nodes.push({
        conceptId: id,
        layer: layers.get(id) ?? 0,
        stage,
        row,
        x: CHAPTER_GRAPH_METRICS.padding + stage * (CHAPTER_GRAPH_METRICS.nodeWidth + CHAPTER_GRAPH_METRICS.gapX),
        y:
          CHAPTER_GRAPH_METRICS.padding +
          CHAPTER_GRAPH_METRICS.labelHeight +
          row * (CHAPTER_GRAPH_METRICS.nodeHeight + CHAPTER_GRAPH_METRICS.gapY),
      });
    });
  }
  return { nodes, stages, maxRows, stageCount };
}

function sizeOf(stageCount: number, maxRows: number): { width: number; height: number } {
  const { nodeWidth, nodeHeight, gapX, gapY, padding, labelHeight } = CHAPTER_GRAPH_METRICS;
  const width = padding * 2 + Math.max(0, stageCount) * nodeWidth + Math.max(0, stageCount - 1) * gapX;
  const height =
    padding * 2 +
    labelHeight +
    Math.max(0, maxRows) * nodeHeight +
    Math.max(0, maxRows - 1) * gapY;
  return { width: Math.max(padding * 2, width), height: Math.max(padding * 2 + labelHeight, height) };
}

function stageLabelsFor(stageCount: number): string[] {
  const labels: string[] = [];
  for (let stage = 0; stage < stageCount; stage += 1) {
    labels.push(STAGE_LABELS[Math.min(stage, STAGE_LABELS.length - 1)] ?? STAGE_LABELS[0]);
  }
  return labels;
}

export function layoutChapter(input: ChapterLayoutInput): ChapterLayout {
  const { conceptIds, relations } = input;
  const maxStages = Math.max(1, Math.min(CHAPTER_GRAPH_METRICS.maxStages, input.maxStages ?? CHAPTER_GRAPH_METRICS.maxStages));
  const orderIndex = new Map<Id, number>(conceptIds.map((id, index) => [id, index]));
  const inChapter = new Set<Id>(conceptIds);

  // Deduplicate parallel prerequisite edges so a pair can only count once.
  const edges = new Map<Id, Set<Id>>();
  const indegree = new Map<Id, number>();
  for (const id of conceptIds) indegree.set(id, 0);
  for (const relation of relations) {
    if (relation.type !== 'prerequisite') continue;
    if (!inChapter.has(relation.fromConceptId) || !inChapter.has(relation.toConceptId)) continue;
    const targets = edges.get(relation.fromConceptId) ?? new Set<Id>();
    if (targets.has(relation.toConceptId)) continue;
    targets.add(relation.toConceptId);
    edges.set(relation.fromConceptId, targets);
    indegree.set(relation.toConceptId, (indegree.get(relation.toConceptId) ?? 0) + 1);
  }

  const layers = new Map<Id, number>(conceptIds.map((id) => [id, 0]));
  const ready = conceptIds.filter((id) => (indegree.get(id) ?? 0) === 0).sort(
    (left, right) => (orderIndex.get(left) ?? 0) - (orderIndex.get(right) ?? 0),
  );
  let processed = 0;
  while (ready.length > 0) {
    const current = ready.shift() as Id;
    processed += 1;
    const targets = [...(edges.get(current) ?? [])].sort(
      (left, right) => (orderIndex.get(left) ?? 0) - (orderIndex.get(right) ?? 0),
    );
    for (const target of targets) {
      layers.set(target, Math.max(layers.get(target) ?? 0, (layers.get(current) ?? 0) + 1));
      const next = (indegree.get(target) ?? 0) - 1;
      indegree.set(target, next);
      if (next === 0) {
        ready.push(target);
        ready.sort((left, right) => (orderIndex.get(left) ?? 0) - (orderIndex.get(right) ?? 0));
      }
    }
  }

  const degraded = processed !== conceptIds.length;
  if (degraded) {
    // A cycle means dependency order is not trustworthy: fall back to catalog
    // order in a single column instead of inventing a level.
    const nodes = conceptIds.map((id, row) => ({
      conceptId: id,
      layer: 0,
      stage: 0,
      row,
      x: CHAPTER_GRAPH_METRICS.padding,
      y:
        CHAPTER_GRAPH_METRICS.padding +
        CHAPTER_GRAPH_METRICS.labelHeight +
        row * (CHAPTER_GRAPH_METRICS.nodeHeight + CHAPTER_GRAPH_METRICS.gapY),
    }));
    const size = sizeOf(1, conceptIds.length);
    return {
      nodes,
      byId: new Map(nodes.map((node) => [node.conceptId, node])),
      stages: conceptIds.length === 0 ? [] : [conceptIds],
      stageLabels: conceptIds.length === 0 ? [] : [CATALOG_STAGE_LABEL],
      width: size.width,
      height: size.height,
      degraded: true,
      nodeWidth: CHAPTER_GRAPH_METRICS.nodeWidth,
      nodeHeight: CHAPTER_GRAPH_METRICS.nodeHeight,
    };
  }

  const stageOf = (id: Id): number => Math.min(layers.get(id) ?? 0, maxStages - 1);
  const built = buildNodes(conceptIds, layers, stageOf, maxStages);
  const size = sizeOf(built.stageCount, built.maxRows);
  return {
    nodes: built.nodes,
    byId: new Map(built.nodes.map((node) => [node.conceptId, node])),
    stages: built.stages,
    stageLabels: stageLabelsFor(built.stageCount),
    width: size.width,
    height: size.height,
    degraded: false,
    nodeWidth: CHAPTER_GRAPH_METRICS.nodeWidth,
    nodeHeight: CHAPTER_GRAPH_METRICS.nodeHeight,
  };
}

function nodeCenter(node: ChapterLayoutNode): { x: number; y: number } {
  return {
    x: node.x + CHAPTER_GRAPH_METRICS.nodeWidth / 2,
    y: node.y + CHAPTER_GRAPH_METRICS.nodeHeight / 2,
  };
}

/**
 * SVG path for one relation. Forward prerequisite edges leave the right edge
 * and enter the left edge; same-stage (or backward) edges loop around the right
 * side, where no node is painted.
 */
export function relationPath(from: ChapterLayoutNode, to: ChapterLayoutNode): string {
  if (from.conceptId === to.conceptId) return '';
  const { nodeWidth, nodeHeight } = CHAPTER_GRAPH_METRICS;
  const startY = from.y + nodeHeight / 2;
  const endY = to.y + nodeHeight / 2;
  if (from.stage === to.stage) {
    const startX = from.x + nodeWidth;
    const bulge = startX + 40;
    return `M ${startX} ${startY} C ${bulge} ${startY}, ${bulge} ${endY}, ${from.x + nodeWidth} ${endY}`;
  }
  const startX = from.x + nodeWidth;
  const endX = to.x;
  const midX = (startX + endX) / 2;
  return `M ${startX} ${startY} C ${midX} ${startY}, ${midX} ${endY}, ${endX} ${endY}`;
}

/** Hit-test helper for tests: distance between two nodes' centres. */
export function centerDistance(left: ChapterLayoutNode, right: ChapterLayoutNode): number {
  const a = nodeCenter(left);
  const b = nodeCenter(right);
  return Math.hypot(a.x - b.x, a.y - b.y);
}
