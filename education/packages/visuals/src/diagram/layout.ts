/**
 * Deterministic diagram layout.
 *
 * The frozen DiagramSpec has no coordinates (only regions carry a bbox), so the
 * renderer must lay nodes out itself. The algorithm is pure arithmetic:
 * layered longest-path for DAGs, stable grid fallback for cycles/isolated
 * nodes. No randomness, no model involvement, so tests and screenshots are
 * reproducible.
 */

import type { DiagramSpec } from '@edu/domain';

export interface RenderNode {
  readonly id: string;
  readonly label: string;
  readonly kind: 'concept' | 'structure' | 'process' | 'region';
  /** 1-based number used by the keyboard/text equivalent answer path. */
  readonly number: number;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly depth: number;
}

export interface RenderEdge {
  readonly id: string;
  readonly from: string;
  readonly to: string;
  readonly directed: boolean;
  readonly label: string | null;
  readonly x1: number;
  readonly y1: number;
  readonly x2: number;
  readonly y2: number;
}

export interface RenderRegion {
  readonly id: string;
  readonly bbox: { readonly x: number; readonly y: number; readonly width: number; readonly height: number };
  readonly altText: string;
}

export interface DiagramRenderPlan {
  readonly width: number;
  readonly height: number;
  readonly altText: string;
  readonly nodes: readonly RenderNode[];
  readonly edges: readonly RenderEdge[];
  readonly regions: readonly RenderRegion[];
  /** Numbered list used by the keyboard/text alternative answer path. */
  readonly numberedTargets: readonly { readonly number: number; readonly nodeId: string; readonly label: string }[];
}

const NODE_WIDTH = 150;
const NODE_HEIGHT = 54;
const H_GAP = 34;
const V_GAP = 46;
const PADDING = 24;

function depthByLongestPath(spec: DiagramSpec, nodeIds: readonly string[]): Map<string, number> {
  const incoming = new Map<string, string[]>(nodeIds.map((id) => [id, []]));
  for (const edge of spec.edges) {
    const list = incoming.get(edge.to);
    if (list !== undefined) list.push(edge.from);
  }
  const depth = new Map<string, number>();
  const visiting = new Set<string>();
  const resolve = (id: string): number => {
    const cached = depth.get(id);
    if (cached !== undefined) return cached;
    if (visiting.has(id)) return 0; // cycle: break deterministically
    visiting.add(id);
    const parents = incoming.get(id) ?? [];
    let value = 0;
    for (const parent of parents) {
      if (!incoming.has(parent)) continue;
      value = Math.max(value, resolve(parent) + 1);
    }
    visiting.delete(id);
    const bounded = Math.min(value, 6);
    depth.set(id, bounded);
    return bounded;
  };
  for (const id of nodeIds) resolve(id);
  return depth;
}

/** Builds a stable render plan (same input always yields the same plan). */
export function planDiagram(spec: DiagramSpec): DiagramRenderPlan {
  const nodes = [...spec.nodes]
    .map((node) => ({ ...node }))
    .sort((left, right) => (left.id < right.id ? -1 : left.id > right.id ? 1 : 0));
  const nodeIds = nodes.map((node) => node.id);
  const depth = depthByLongestPath(spec, nodeIds);
  const columns = new Map<number, string[]>();
  for (const node of nodes) {
    const level = depth.get(node.id) ?? 0;
    const column = columns.get(level) ?? [];
    column.push(node.id);
    columns.set(level, column);
  }
  const levelCount = Math.max(1, ...[...columns.keys()].map((level) => level + 1));
  // Wide diagrams wrap into a grid so a 60-node diagram does not become a strip.
  const perColumnLimit = 8;
  const levels = [...columns.keys()].sort((a, b) => a - b);
  const rowsPerLevel = new Map<number, number>();
  for (const level of levels) {
    const ids = columns.get(level) ?? [];
    rowsPerLevel.set(level, Math.ceil(ids.length / perColumnLimit));
  }
  const totalRows = [...rowsPerLevel.values()].reduce((sum, count) => sum + count, 0);
  const widestColumn = Math.min(perColumnLimit, Math.max(...levels.map((level) => (columns.get(level) ?? []).length)));

  const width = PADDING * 2 + Math.max(1, Math.min(levelCount, 4)) * (NODE_WIDTH + H_GAP) - H_GAP;
  const height = Math.max(220, PADDING * 2 + totalRows * (NODE_HEIGHT + V_GAP) - V_GAP);

  const positions = new Map<string, { x: number; y: number; depth: number }>();
  let rowCursor = 0;
  for (const level of levels) {
    const ids = columns.get(level) ?? [];
    const rows = rowsPerLevel.get(level) ?? 1;
    for (let row = 0; row < rows; row += 1) {
      const slice = ids.slice(row * perColumnLimit, (row + 1) * perColumnLimit);
      slice.forEach((id, indexInRow) => {
        positions.set(id, {
          x: PADDING + indexInRow * (NODE_WIDTH + H_GAP),
          y: PADDING + (rowCursor + row) * (NODE_HEIGHT + V_GAP),
          depth: level,
        });
      });
    }
    rowCursor += rows;
  }
  void widestColumn;

  const renderNodes: RenderNode[] = nodes.map((node, index) => {
    const position = positions.get(node.id) ?? { x: PADDING, y: PADDING, depth: 0 };
    return {
      id: node.id,
      label: node.label,
      kind: node.kind,
      number: index + 1,
      x: position.x,
      y: position.y,
      width: NODE_WIDTH,
      height: NODE_HEIGHT,
      depth: position.depth,
    };
  });
  const byId = new Map(renderNodes.map((node) => [node.id, node]));

  const renderEdges: RenderEdge[] = spec.edges.map((edge) => {
    const from = byId.get(edge.from);
    const to = byId.get(edge.to);
    const x1 = from === undefined ? PADDING : from.x + from.width / 2;
    const y1 = from === undefined ? PADDING : from.y + from.height / 2;
    const x2 = to === undefined ? PADDING : to.x + to.width / 2;
    const y2 = to === undefined ? PADDING : to.y + to.height / 2;
    return {
      id: edge.id,
      from: edge.from,
      to: edge.to,
      directed: edge.directed,
      label: edge.label,
      x1,
      y1,
      x2,
      y2,
    };
  });

  return {
    width,
    height,
    altText: spec.altText,
    nodes: renderNodes,
    edges: renderEdges,
    regions: spec.regions.map((region) => ({
      id: region.id,
      bbox: region.bbox,
      altText: region.altText,
    })),
    numberedTargets: renderNodes.map((node) => ({
      number: node.number,
      nodeId: node.id,
      label: node.label,
    })),
  };
}
