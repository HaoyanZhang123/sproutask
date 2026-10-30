/**
 * Map display model: tree navigation rows, chapter scope, three-axis labels,
 * aggregate counts (deduplicated by conceptId) and a deterministic graph layout.
 *
 * This file contains UI derivation only. It never invents content, never
 * upgrades a state and never merges the three axes: every label is composed
 * from the frozen `@edu/domain` fields plus the T06 semantics (learning,
 * understanding, review are independent; self-report stays separate).
 */

import type {
  Concept,
  ConceptProgress,
  Id,
  LearningState,
  Relation,
  ReviewOutcome,
  TocNodeLike,
  UnderstandingState,
  Validity,
} from '@edu/domain';
import {
  LEARNING_LABELS,
  SELF_REPORT_LABELS,
  UNDERSTANDING_LABELS,
  VALIDITY_LABELS,
} from '../../shell/src/index.js';
import type { GraphSlice, MapPayload } from './types.js';

export type Tone = 'neutral' | 'progress' | 'attention' | 'positive' | 'danger' | 'info';

/** Review history wording distinct from the understanding axis. */
export const REVIEW_HISTORY_LABELS: Record<ReviewOutcome, string> = {
  needs_support: '仍需巩固',
  developing: '初步理解',
  supported: '表现稳定',
};

export type StateFilter = 'all' | 'needs_support' | 'due' | 'unassessed';

export const FILTER_LABELS: Record<StateFilter, string> = {
  all: '全部概念',
  needs_support: '理解：需巩固',
  due: '复习：待复习',
  unassessed: '理解：尚无足够证据',
};

export type MapViewMode = 'graph' | 'relations' | 'concepts';

export const VIEW_MODE_LABELS: Record<MapViewMode, string> = {
  graph: '关系图',
  relations: '关系列表（文字替代）',
  concepts: '本章概念列表',
};

/* ------------------------------------------------------------- tree model */

export interface TocTreeRow {
  readonly node: TocNodeLike;
  readonly depth: number;
  readonly hasChildren: boolean;
  readonly expanded: boolean;
  /** Distinct concepts in this subtree (a multi-placement concept counts once). */
  readonly conceptCount: number;
  readonly learnedCount: number;
  readonly dueCount: number;
  readonly needsSupportCount: number;
}

export interface TocTreeModel {
  readonly roots: readonly TocNodeLike[];
  node(id: Id): TocNodeLike | undefined;
  childrenOf(id: Id): readonly TocNodeLike[];
  pathOf(id: Id): readonly TocNodeLike[];
  chapterOf(id: Id): TocNodeLike | null;
  ancestorsOf(id: Id): readonly Id[];
  subtreeNodeIds(id: Id): readonly Id[];
  conceptIdsIn(id: Id): readonly Id[];
  chapters(): readonly TocNodeLike[];
  visibleRows(expandedIds: ReadonlySet<Id>): readonly TocTreeRow[];
}

function sortNodes(nodes: readonly TocNodeLike[]): readonly TocNodeLike[] {
  return [...nodes].sort((left, right) =>
    left.order !== right.order ? left.order - right.order : left.id < right.id ? -1 : 1,
  );
}

export function buildTocModel(payload: MapPayload): TocTreeModel {
  const byId = new Map<Id, TocNodeLike>(payload.toc.map((node) => [node.id, node]));
  const children = new Map<Id, readonly TocNodeLike[]>();
  for (const node of payload.toc) {
    if (node.parentId === null) continue;
    const list = [...(children.get(node.parentId) ?? []), node];
    children.set(node.parentId, sortNodes(list));
  }
  const roots = sortNodes(payload.toc.filter((node) => node.parentId === null));

  const placements = new Map<Id, Set<Id>>();
  for (const concept of payload.concepts) {
    for (const placement of concept.placements) {
      const set = placements.get(placement) ?? new Set<Id>();
      set.add(concept.id);
      placements.set(placement, set);
    }
  }

  const subtreeCache = new Map<Id, readonly Id[]>();
  const subtreeNodeIds = (id: Id): readonly Id[] => {
    const cached = subtreeCache.get(id);
    if (cached !== undefined) return cached;
    const start = byId.get(id);
    if (start === undefined) return [];
    const output: Id[] = [];
    const stack: TocNodeLike[] = [start];
    while (stack.length > 0) {
      const current = stack.pop() as TocNodeLike;
      output.push(current.id);
      const kids = children.get(current.id) ?? [];
      for (let index = kids.length - 1; index >= 0; index -= 1) stack.push(kids[index] as TocNodeLike);
    }
    subtreeCache.set(id, output);
    return output;
  };

  const conceptCache = new Map<Id, readonly Id[]>();
  const conceptIdsIn = (id: Id): readonly Id[] => {
    const cached = conceptCache.get(id);
    if (cached !== undefined) return cached;
    const distinct = new Set<Id>();
    for (const nodeId of subtreeNodeIds(id)) {
      for (const conceptId of placements.get(nodeId) ?? []) distinct.add(conceptId);
    }
    const ordered = payload.concepts.filter((concept) => distinct.has(concept.id)).map((concept) => concept.id);
    conceptCache.set(id, ordered);
    return ordered;
  };

  const chapterOf = (id: Id): TocNodeLike | null => {
    let cursor = byId.get(id);
    let guard = 0;
    while (cursor !== undefined && guard <= payload.toc.length) {
      if (cursor.type === 'chapter') return cursor;
      cursor = cursor.parentId === null ? undefined : byId.get(cursor.parentId);
      guard += 1;
    }
    return null;
  };

  const pathOf = (id: Id): readonly TocNodeLike[] => {
    const path: TocNodeLike[] = [];
    let cursor = byId.get(id);
    let guard = 0;
    while (cursor !== undefined && guard <= payload.toc.length) {
      path.unshift(cursor);
      cursor = cursor.parentId === null ? undefined : byId.get(cursor.parentId);
      guard += 1;
    }
    return path;
  };

  const progressByConcept = new Map<Id, ConceptProgress>(
    payload.progress.map((entry) => [entry.conceptId, entry]),
  );
  const stateById = new Map<Id, ConceptStateSummary>(
    payload.concepts.map((concept) => [concept.id, summarizeConceptState(payload, concept.id)]),
  );

  const visibleRows = (expandedIds: ReadonlySet<Id>): readonly TocTreeRow[] => {
    const rows: TocTreeRow[] = [];
    const walk = (node: TocNodeLike, depth: number): void => {
      const kids = children.get(node.id) ?? [];
      const conceptIds = conceptIdsIn(node.id);
      let learned = 0;
      let due = 0;
      let needsSupport = 0;
      for (const conceptId of conceptIds) {
        const state = stateById.get(conceptId);
        const entry = progressByConcept.get(conceptId);
        if (entry?.learning.state === 'completed') learned += 1;
        if (entry?.review.dueAt !== null && entry?.review.dueAt !== undefined) due += 1;
        if (state?.understanding.state === 'needs_support') needsSupport += 1;
      }
      rows.push({
        node,
        depth,
        hasChildren: kids.length > 0,
        expanded: expandedIds.has(node.id),
        conceptCount: conceptIds.length,
        learnedCount: learned,
        dueCount: due,
        needsSupportCount: needsSupport,
      });
      if (expandedIds.has(node.id)) {
        for (const child of kids) walk(child, depth + 1);
      }
    };
    for (const root of roots) walk(root, 0);
    return rows;
  };

  return {
    roots,
    node: (id) => byId.get(id),
    childrenOf: (id) => children.get(id) ?? [],
    pathOf,
    chapterOf,
    ancestorsOf: (id) => pathOf(id).slice(0, -1).map((node) => node.id),
    subtreeNodeIds,
    conceptIdsIn,
    chapters: () => payload.toc.filter((node) => node.type === 'chapter'),
    visibleRows,
  };
}

/* --------------------------------------------------------- state summaries */

export interface ConceptStateSummary {
  readonly conceptId: Id;
  readonly title: string;
  readonly learning: { readonly state: LearningState; readonly label: string; readonly tone: Tone };
  readonly understanding: {
    readonly state: UnderstandingState;
    readonly label: string;
    readonly tone: Tone;
    readonly validity: Validity | null;
    readonly validityLabel: string | null;
    readonly strongClaimAllowed: boolean;
    readonly candidateDisabled: boolean;
  };
  readonly review: {
    readonly historyLabel: string;
    readonly dueLabel: string;
    readonly activeLabel: string | null;
    readonly tone: Tone;
  };
  readonly selfReportLabel: string | null;
  readonly evidenceCount: number;
  readonly currentIndependentEvidenceCount: number;
  readonly needsAttention: boolean;
}

function learningTone(state: LearningState): Tone {
  if (state === 'completed') return 'positive';
  if (state === 'in_progress') return 'progress';
  return 'neutral';
}

function understandingTone(state: UnderstandingState): Tone {
  if (state === 'supported') return 'positive';
  if (state === 'needs_support') return 'attention';
  if (state === 'developing') return 'progress';
  return 'neutral';
}

export function summarizeConceptState(payload: MapPayload, conceptId: Id): ConceptStateSummary {
  const concept = payload.concepts.find((entry) => entry.id === conceptId);
  const progress = payload.progress.find((entry) => entry.conceptId === conceptId) ?? null;
  const selfReport = payload.selfReports.find((entry) => entry.conceptId === conceptId) ?? null;
  const evidence = payload.evidence.filter((entry) => entry.conceptId === conceptId);
  const candidate = payload.trustMode === 'candidate';
  const learningState = progress?.learning.state ?? 'not_started';
  const rawUnderstanding = progress?.understanding.state ?? 'unassessed';
  const validity = progress === null ? null : progress.understanding.validity;
  const validityLabel =
    validity === null || validity === 'current' ? null : VALIDITY_LABELS[validity];
  const candidateDisabled = candidate && rawUnderstanding !== 'unassessed';
  const understandingState: UnderstandingState = candidate ? 'unassessed' : rawUnderstanding;
  const understandingText = candidate
    ? `${UNDERSTANDING_LABELS.unassessed}（候选内容禁用强结论）`
    : `${UNDERSTANDING_LABELS[understandingState]}${validityLabel === null ? '' : `（${validityLabel}）`}`;
  const outcome = progress?.review.latestOutcome ?? null;
  const historyLabel =
    progress?.review.lastCompletedAt === null || progress?.review.lastCompletedAt === undefined
      ? '尚未复习'
      : outcome === null
        ? '已复习'
        : `复习完成 · ${REVIEW_HISTORY_LABELS[outcome]}`;
  const dueLabel =
    progress?.review.dueAt === null || progress?.review.dueAt === undefined
      ? '暂无复习安排'
      : '待复习';
  const reviewTone: Tone =
    outcome === 'needs_support' ? 'attention' : progress?.review.dueAt ? 'info' : 'neutral';
  return {
    conceptId,
    title: concept?.title ?? conceptId,
    learning: { state: learningState, label: LEARNING_LABELS[learningState], tone: learningTone(learningState) },
    understanding: {
      state: understandingState,
      label: understandingText,
      tone: understandingTone(understandingState),
      validity,
      validityLabel,
      strongClaimAllowed: !candidate,
      candidateDisabled,
    },
    review: {
      historyLabel,
      dueLabel,
      activeLabel: progress?.review.activeSessionId ? '复习进行中' : null,
      tone: reviewTone,
    },
    selfReportLabel:
      selfReport === null
        ? null
        : `你的自评：${SELF_REPORT_LABELS[selfReport.claimedState]}（学生自述，不算证据）`,
    evidenceCount: evidence.length,
    currentIndependentEvidenceCount: evidence.filter(
      (entry) => entry.assistance === 'unassisted' && entry.validity === 'current',
    ).length,
    needsAttention:
      understandingState === 'needs_support' ||
      (understandingState === 'unassessed' && learningState !== 'not_started'),
  };
}

export function matchesStateFilter(summary: ConceptStateSummary, filter: StateFilter): boolean {
  if (filter === 'all') return true;
  if (filter === 'needs_support') return summary.understanding.state === 'needs_support';
  if (filter === 'unassessed') return summary.understanding.state === 'unassessed';
  return summary.review.dueLabel === '待复习';
}

export interface MapAggregate {
  readonly formalTotal: number;
  readonly learned: number;
  readonly due: number;
  readonly needsSupport: number;
  readonly unassessed: number;
  readonly candidateTotal: number;
  readonly activityCoverageLabel: string;
}

/**
 * Aggregate counts by distinct conceptId. A concept placed in two sections is
 * counted once; candidate concepts are listed separately and never enter the
 * formal denominator (T06 semantics). No mastery percentage is produced.
 */
export function aggregateMapSummary(payload: MapPayload): MapAggregate {
  const formal = payload.concepts.filter((concept) => concept.reviewState !== 'candidate');
  const candidateTotal = payload.concepts.length - formal.length;
  const progressByConcept = new Map<Id, ConceptProgress>(
    payload.progress.map((entry) => [entry.conceptId, entry]),
  );
  let learned = 0;
  let due = 0;
  let needsSupport = 0;
  let unassessed = 0;
  for (const concept of formal) {
    const progress = progressByConcept.get(concept.id);
    const summary = summarizeConceptState(payload, concept.id);
    if (progress?.learning.state === 'completed') learned += 1;
    if (progress?.review.dueAt !== null && progress?.review.dueAt !== undefined) due += 1;
    if (summary.understanding.state === 'needs_support') needsSupport += 1;
    if (summary.understanding.state === 'unassessed') unassessed += 1;
  }
  const formalTotal = payload.trustMode === 'candidate' ? 0 : formal.length;
  const formalLearned = payload.trustMode === 'candidate' ? 0 : learned;
  return {
    formalTotal,
    learned: formalLearned,
    due: payload.trustMode === 'candidate' ? 0 : due,
    needsSupport: payload.trustMode === 'candidate' ? 0 : needsSupport,
    unassessed: payload.trustMode === 'candidate' ? 0 : unassessed,
    candidateTotal:
      payload.trustMode === 'candidate' ? payload.concepts.length : candidateTotal,
    activityCoverageLabel: `活动覆盖（按去重概念计数）：已学 ${formalLearned} / 可学习 ${formalTotal}`,
  };
}

/* ------------------------------------------------------------ graph layout */

export interface GraphPosition {
  readonly col: number;
  readonly row: number;
}

export interface GraphLayout {
  readonly positions: ReadonlyMap<Id, GraphPosition>;
  readonly columns: number;
  readonly rows: number;
  readonly centerConceptId: Id | null;
}

/** Deterministic layered layout: distance from the centre, then concept id. */
export function layoutGraph(
  slice: GraphSlice,
  visibleConceptIds: readonly Id[],
  centerConceptId: Id | null,
): GraphLayout {
  const visible = new Set(visibleConceptIds);
  const adjacency = new Map<Id, Id[]>();
  for (const relation of slice.relations) {
    if (!visible.has(relation.fromConceptId) || !visible.has(relation.toConceptId)) continue;
    const left = adjacency.get(relation.fromConceptId) ?? [];
    left.push(relation.toConceptId);
    adjacency.set(relation.fromConceptId, left);
    const right = adjacency.get(relation.toConceptId) ?? [];
    right.push(relation.fromConceptId);
    adjacency.set(relation.toConceptId, right);
  }
  const layer = new Map<Id, number>();
  const center = centerConceptId !== null && visible.has(centerConceptId) ? centerConceptId : (visibleConceptIds[0] ?? null);
  if (center !== null) {
    layer.set(center, 0);
    let frontier: Id[] = [center];
    let depth = 0;
    while (frontier.length > 0 && depth < 8) {
      depth += 1;
      const next: Id[] = [];
      for (const current of [...frontier].sort()) {
        for (const neighbor of adjacency.get(current) ?? []) {
          if (layer.has(neighbor)) continue;
          layer.set(neighbor, depth);
          next.push(neighbor);
        }
      }
      frontier = next.sort();
    }
  }
  let maxLayer = 0;
  for (const entry of visibleConceptIds) {
    if (!layer.has(entry)) layer.set(entry, 0);
    maxLayer = Math.max(maxLayer, layer.get(entry) ?? 0);
  }
  const byLayer = new Map<number, Id[]>();
  for (const entry of [...visibleConceptIds].sort()) {
    const value = layer.get(entry) ?? 0;
    const list = byLayer.get(value) ?? [];
    list.push(entry);
    byLayer.set(value, list);
  }
  const positions = new Map<Id, GraphPosition>();
  let rows = 0;
  for (const [col, ids] of [...byLayer.entries()].sort((left, right) => left[0] - right[0])) {
    ids.forEach((id, row) => positions.set(id, { col, row }));
    rows = Math.max(rows, ids.length);
  }
  return {
    positions,
    columns: Math.max(1, maxLayer + 1),
    rows: Math.max(1, rows),
    centerConceptId: center,
  };
}

export function filterGraphSlice(
  slice: GraphSlice,
  conceptIds: readonly Id[],
): { readonly concepts: readonly Concept[]; readonly relations: readonly Relation[] } {
  const visible = new Set(conceptIds);
  return {
    concepts: slice.concepts.filter((concept) => visible.has(concept.id)),
    relations: slice.relations.filter(
      (relation) => visible.has(relation.fromConceptId) && visible.has(relation.toConceptId),
    ),
  };
}

export function prerequisiteSources(
  payload: MapPayload,
  conceptId: Id,
): readonly { readonly relation: Relation; readonly concept: Concept | null; readonly learned: boolean }[] {
  const incoming = payload.relations.filter(
    (relation) => relation.type === 'prerequisite' && relation.toConceptId === conceptId,
  );
  return incoming.map((relation) => {
    const concept = payload.concepts.find((entry) => entry.id === relation.fromConceptId) ?? null;
    const progress = payload.progress.find((entry) => entry.conceptId === relation.fromConceptId) ?? null;
    return { relation, concept, learned: progress?.learning.state === 'completed' };
  });
}
