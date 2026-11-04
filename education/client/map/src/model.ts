/**
 * Map display model: two-level knowledge map.
 *
 * - `buildTocModel` keeps the catalog index (still the only source of
 *   chapter/section membership and order).
 * - `createMapModel` derives the whole-volume overview (unit → chapter rows and
 *   four-state concept chips) and one chapter view (ordered concepts,
 *   in-chapter relations, cross-chapter links and the layered layout).
 * - State is derived from the frozen learner projection only: the four student
 *   states (在学 / 要再练 / 比较稳 / 还没开始) are labels over learning +
 *   understanding + review; nothing here writes or upgrades learning state.
 */

import type {
  Concept,
  ConceptProgress,
  Id,
  Relation,
  ReviewOutcome,
  SelfReport,
  TocNodeLike,
  Validity,
} from '@edu/domain';
import type { StatusTone } from '../../shell/src/index.js';
import {
  LEARNING_LABELS,
  SELF_REPORT_LABELS,
  UNDERSTANDING_LABELS,
  VALIDITY_LABELS,
} from '../../shell/src/index.js';
import { layoutChapter, type ChapterLayout } from './layout.js';
import type { MapPayload } from './types.js';

export type MapViewMode = 'graph' | 'list';

export const VIEW_MODE_LABELS: Record<MapViewMode, string> = {
  graph: '关系图',
  list: '列表',
};

/** Four student-facing concept states. Colour, words and shape all carry it. */
export type ConceptState = 'now' | 'weak' | 'steady' | 'todo';
export type ConceptShape = 'ring' | 'triangle' | 'diamond' | 'square';

export interface ConceptStateMeta {
  readonly label: string;
  readonly tone: StatusTone;
  readonly shape: ConceptShape;
}

export const CONCEPT_STATE_META: Record<ConceptState, ConceptStateMeta> = {
  now: { label: '在学', tone: 'info', shape: 'ring' },
  weak: { label: '要再练', tone: 'attention', shape: 'triangle' },
  steady: { label: '比较稳', tone: 'positive', shape: 'diamond' },
  todo: { label: '还没开始', tone: 'neutral', shape: 'square' },
};

export const CONCEPT_STATE_ORDER: readonly ConceptState[] = ['now', 'weak', 'steady', 'todo'];

/* ------------------------------------------------------------- tree model */

export interface TocTreeModel {
  readonly roots: readonly TocNodeLike[];
  node(id: Id): TocNodeLike | undefined;
  childrenOf(id: Id): readonly TocNodeLike[];
  pathOf(id: Id): readonly TocNodeLike[];
  chapterOf(id: Id): TocNodeLike | null;
  ancestorsOf(id: Id): readonly Id[];
  subtreeNodeIds(id: Id): readonly Id[];
  /** Concepts under `id`, in catalog (toc) order. */
  orderedConceptIdsIn(id: Id): readonly Id[];
  chapters(): readonly TocNodeLike[];
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

  const placements = new Map<Id, Id[]>();
  for (const concept of payload.concepts) {
    for (const placement of concept.placements) {
      const list = placements.get(placement) ?? [];
      list.push(concept.id);
      placements.set(placement, list);
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

  const orderedCache = new Map<Id, readonly Id[]>();
  const orderedConceptIdsIn = (id: Id): readonly Id[] => {
    const cached = orderedCache.get(id);
    if (cached !== undefined) return cached;
    const seen = new Set<Id>();
    const ordered: Id[] = [];
    for (const nodeId of subtreeNodeIds(id)) {
      for (const conceptId of placements.get(nodeId) ?? []) {
        if (seen.has(conceptId)) continue;
        seen.add(conceptId);
        ordered.push(conceptId);
      }
    }
    orderedCache.set(id, ordered);
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

  const chapters = (): readonly TocNodeLike[] => {
    const output: TocNodeLike[] = [];
    const walk = (nodes: readonly TocNodeLike[]): void => {
      for (const node of nodes) {
        if (node.type === 'chapter') output.push(node);
        const kids = children.get(node.id) ?? [];
        if (kids.length > 0) walk(kids);
      }
    };
    walk(roots);
    // Guard against a toc whose chapters are not reachable from a root.
    for (const node of sortNodes(payload.toc.filter((entry) => entry.type === 'chapter'))) {
      if (!output.includes(node)) output.push(node);
    }
    return output;
  };

  return {
    roots,
    node: (id) => byId.get(id),
    childrenOf: (id) => children.get(id) ?? [],
    pathOf,
    chapterOf,
    ancestorsOf: (id) => pathOf(id).slice(0, -1).map((node) => node.id),
    subtreeNodeIds,
    orderedConceptIdsIn,
    chapters,
  };
}

/* --------------------------------------------------------- state summaries */

export interface ConceptStateSummary {
  readonly conceptId: Id;
  readonly title: string;
  readonly state: ConceptState;
  readonly stateLabel: string;
  readonly tone: StatusTone;
  readonly learningLabel: string;
  readonly understandingLabel: string;
  readonly reviewLabel: string;
  readonly due: boolean;
  readonly needsSupport: boolean;
  readonly selfReportLabel: string | null;
}

const REVIEW_HISTORY_LABELS: Record<ReviewOutcome, string> = {
  needs_support: '仍需巩固',
  developing: '初步理解',
  supported: '表现稳定',
};

function deriveConceptState(
  progress: ConceptProgress | null,
  trustMode: MapPayload['trustMode'],
): ConceptState {
  if (progress === null) return 'todo';
  const learning = progress.learning.state;
  const understanding = progress.understanding.state;
  const needsSupport =
    understanding === 'needs_support' || progress.review.latestOutcome === 'needs_support';
  if (trustMode === 'candidate') {
    // Candidate content cannot carry a strong conclusion (比较稳 / 要再练).
    return learning === 'not_started' && understanding === 'unassessed' ? 'todo' : 'now';
  }
  if (needsSupport) return 'weak';
  const current = progress.understanding.validity === 'current';
  if (learning === 'completed' && understanding === 'supported' && current) return 'steady';
  if (learning !== 'not_started') return 'now';
  if (understanding !== 'unassessed') return 'now';
  if (progress.review.dueAt !== null) return 'now';
  return 'todo';
}

function understandingText(progress: ConceptProgress, trustMode: MapPayload['trustMode']): string {
  const raw = progress.understanding.state;
  const validity: Validity = progress.understanding.validity;
  if (trustMode === 'candidate') return '尚无足够证据（候选内容，未核实）';
  const label = UNDERSTANDING_LABELS[raw];
  return validity === 'current' ? label : `${label}（${VALIDITY_LABELS[validity]}）`;
}

/* -------------------------------------------------------------- overview */

export interface OverviewChapter {
  readonly chapter: TocNodeLike;
  readonly unit: TocNodeLike | null;
  readonly sections: readonly TocNodeLike[];
  readonly concepts: readonly Concept[];
  readonly learnedCount: number;
}

export interface OverviewUnit {
  readonly unit: TocNodeLike | null;
  /** Unit title, or the volume title when the volume has no units. */
  readonly title: string;
  /** e.g. 第一单元 / 第二单元; null when the volume has no unit layer. */
  readonly numberLabel: string | null;
  readonly chapters: readonly OverviewChapter[];
  readonly conceptCount: number;
  readonly learnedCount: number;
}

export interface OverviewTotals {
  readonly units: number;
  readonly chapters: number;
  readonly sections: number;
  readonly concepts: number;
  readonly learned: number;
}

export interface MapOverview {
  readonly units: readonly OverviewUnit[];
  readonly totals: OverviewTotals;
}

export interface OverviewFilterResult {
  readonly active: boolean;
  readonly query: string;
  readonly matchCount: number;
  readonly units: readonly OverviewUnit[];
}

const CHINESE_UNIT_NUMBERS = ['一', '二', '三', '四', '五', '六', '七', '八', '九', '十'] as const;

function unitNumberLabel(index: number): string {
  const value = CHINESE_UNIT_NUMBERS[index];
  return value === undefined ? `第 ${index + 1} 单元` : `第${value}单元`;
}

/* --------------------------------------------------------------- chapter */

export interface MapChapter {
  readonly chapter: TocNodeLike;
  readonly unit: TocNodeLike | null;
  readonly path: readonly TocNodeLike[];
  readonly sections: readonly TocNodeLike[];
  readonly concepts: readonly Concept[];
  readonly relations: readonly Relation[];
  /** Relations with one endpoint outside this chapter. */
  readonly externalRelations: readonly Relation[];
  readonly layout: ChapterLayout;
  readonly previousChapterId: Id | null;
  readonly nextChapterId: Id | null;
}

export interface RelationPeer {
  readonly relationId: Id;
  readonly conceptId: Id;
  readonly title: string;
  readonly inChapter: boolean;
  readonly learned: boolean;
}

export interface SourcePage {
  readonly sourceRefId: Id;
  readonly label: string;
  readonly unverified: boolean;
  readonly available: boolean;
}

/* ------------------------------------------------------------- map model */

export interface MapModel {
  readonly payload: MapPayload;
  readonly toc: TocTreeModel;
  summary(conceptId: Id): ConceptStateSummary;
  overview(): MapOverview;
  chapter(chapterId: Id): MapChapter | null;
  chapterOfConcept(conceptId: Id): TocNodeLike | null;
  filterOverview(query: string): OverviewFilterResult;
}

export function createMapModel(payload: MapPayload): MapModel {
  const toc = buildTocModel(payload);
  const conceptsById = new Map<Id, Concept>(payload.concepts.map((concept) => [concept.id, concept]));
  const progressById = new Map<Id, ConceptProgress>(
    payload.progress.map((entry) => [entry.conceptId, entry]),
  );
  const selfReportById = new Map<Id, SelfReport>(
    payload.selfReports.map((entry) => [entry.conceptId, entry]),
  );
  const chapterOfConcept = (conceptId: Id): TocNodeLike | null => {
    const concept = conceptsById.get(conceptId);
    if (concept === undefined) return null;
    const placement = concept.placements[0];
    return placement === undefined ? null : toc.chapterOf(placement);
  };

  const summaryCache = new Map<Id, ConceptStateSummary>();
  const summary = (conceptId: Id): ConceptStateSummary => {
    const cached = summaryCache.get(conceptId);
    if (cached !== undefined) return cached;
    const concept = conceptsById.get(conceptId);
    const progress = progressById.get(conceptId) ?? null;
    const state = deriveConceptState(progress, payload.trustMode);
    const selfReport = selfReportById.get(conceptId) ?? null;
    const reviewLabel =
      progress === null || progress.review.lastCompletedAt === null
        ? '尚未复习'
        : progress.review.dueAt !== null
          ? '待复习'
          : progress.review.latestOutcome === null
            ? '已复习'
            : `复习：${REVIEW_HISTORY_LABELS[progress.review.latestOutcome]}`;
    const value: ConceptStateSummary = {
      conceptId,
      title: concept?.title ?? conceptId,
      state,
      stateLabel: CONCEPT_STATE_META[state].label,
      tone: CONCEPT_STATE_META[state].tone,
      learningLabel: progress === null ? LEARNING_LABELS.not_started : LEARNING_LABELS[progress.learning.state],
      understandingLabel:
        progress === null ? UNDERSTANDING_LABELS.unassessed : understandingText(progress, payload.trustMode),
      reviewLabel,
      due: progress !== null && progress.review.dueAt !== null,
      needsSupport:
        progress !== null &&
        (progress.understanding.state === 'needs_support' ||
          progress.review.latestOutcome === 'needs_support'),
      selfReportLabel:
        selfReport === null ? null : `你之前自评：${SELF_REPORT_LABELS[selfReport.claimedState]}`,
    };
    summaryCache.set(conceptId, value);
    return value;
  };

  const sectionsUnder = (chapterId: Id): readonly TocNodeLike[] =>
    toc
      .subtreeNodeIds(chapterId)
      .filter((nodeId) => toc.node(nodeId)?.type === 'section')
      .map((nodeId) => toc.node(nodeId))
      .filter((node): node is TocNodeLike => node !== undefined);

  // “已学”只表示有学习记录（在学/完成），不是掌握结论；候选内容也照样可以计数。
  const isLearned = (conceptId: Id): boolean => {
    const state = progressById.get(conceptId)?.learning.state;
    return state === 'in_progress' || state === 'completed';
  };

  const makeChapter = (chapter: TocNodeLike, unit: TocNodeLike | null): OverviewChapter => {
    const concepts = toc
      .orderedConceptIdsIn(chapter.id)
      .map((conceptId) => conceptsById.get(conceptId))
      .filter((concept): concept is Concept => concept !== undefined);
    return {
      chapter,
      unit,
      sections: sectionsUnder(chapter.id),
      concepts,
      learnedCount: concepts.filter((concept) => isLearned(concept.id)).length,
    };
  };

  let cachedOverview: MapOverview | null = null;
  const overview = (): MapOverview => {
    if (cachedOverview !== null) return cachedOverview;
    const units = payload.toc
      .filter((node) => node.type === 'unit')
      .sort((left, right) => left.order - right.order || left.id.localeCompare(right.id));
    const groups: OverviewUnit[] = [];
    const covered = new Set<Id>();
    units.forEach((unit, index) => {
      const chapters = toc
        .subtreeNodeIds(unit.id)
        .filter((nodeId) => nodeId !== unit.id)
        .map((nodeId) => toc.node(nodeId))
        .filter((node): node is TocNodeLike => node !== undefined && node.type === 'chapter');
      const entries = chapters.map((chapter) => {
        covered.add(chapter.id);
        return makeChapter(chapter, unit);
      });
      const distinct = new Set<Id>();
      for (const entry of entries) for (const concept of entry.concepts) distinct.add(concept.id);
      groups.push({
        unit,
        title: unit.title,
        numberLabel: unitNumberLabel(index),
        chapters: entries,
        conceptCount: distinct.size,
        learnedCount: entries.reduce((total, entry) => total + entry.learnedCount, 0),
      });
    });

    // Chapters that live directly under the volume (no unit layer in this book).
    const remaining = toc
      .chapters()
      .filter((chapter) => !covered.has(chapter.id));
    const byParent = new Map<Id | null, TocNodeLike[]>();
    for (const chapter of remaining) {
      const list = byParent.get(chapter.parentId) ?? [];
      list.push(chapter);
      byParent.set(chapter.parentId, list);
    }
    for (const [parentId, chapters] of byParent) {
      const parent = parentId === null ? null : toc.node(parentId) ?? null;
      const entries = chapters.map((chapter) => makeChapter(chapter, null));
      const distinct = new Set<Id>();
      for (const entry of entries) for (const concept of entry.concepts) distinct.add(concept.id);
      groups.push({
        unit: null,
        title: parent?.title ?? '全册',
        numberLabel: null,
        chapters: entries,
        conceptCount: distinct.size,
        learnedCount: entries.reduce((total, entry) => total + entry.learnedCount, 0),
      });
    }

    const allConcepts = new Set<Id>();
    for (const group of groups) {
      for (const entry of group.chapters) for (const concept of entry.concepts) allConcepts.add(concept.id);
    }
    let learned = 0;
    for (const conceptId of allConcepts) if (isLearned(conceptId)) learned += 1;
    cachedOverview = {
      units: groups,
      totals: {
        units: payload.toc.filter((node) => node.type === 'unit').length,
        chapters: payload.toc.filter((node) => node.type === 'chapter').length,
        sections: payload.toc.filter((node) => node.type === 'section').length,
        concepts: allConcepts.size,
        learned,
      },
    };
    return cachedOverview;
  };

  const filterOverview = (query: string): OverviewFilterResult => {
    const base = overview();
    const needle = query.trim().toLowerCase();
    if (needle.length === 0) {
      const matchCount = base.units.reduce(
        (total, unit) => total + unit.chapters.reduce((sum, entry) => sum + entry.concepts.length, 0),
        0,
      );
      return { active: false, query: '', matchCount, units: base.units };
    }
    const matches = (concept: Concept): boolean =>
      concept.title.toLowerCase().includes(needle) ||
      concept.aliases.some((alias) => alias.toLowerCase().includes(needle));
    const matchedIds = new Set<Id>();
    const units: OverviewUnit[] = [];
    for (const unit of base.units) {
      const chapters: OverviewChapter[] = [];
      for (const entry of unit.chapters) {
        const matched = entry.concepts.filter((concept) => matches(concept));
        if (matched.length === 0) continue;
        for (const concept of matched) matchedIds.add(concept.id);
        chapters.push({ ...entry, concepts: matched });
      }
      if (chapters.length === 0) continue;
      units.push({ ...unit, chapters });
    }
    return { active: true, query: query.trim(), matchCount: matchedIds.size, units };
  };

  const chapterCache = new Map<Id, MapChapter | null>();
  const chapter = (chapterId: Id): MapChapter | null => {
    const cached = chapterCache.get(chapterId);
    if (cached !== undefined) return cached;
    const node = toc.node(chapterId);
    if (node === undefined || node.type !== 'chapter') {
      chapterCache.set(chapterId, null);
      return null;
    }
    const parent = node.parentId === null ? null : toc.node(node.parentId) ?? null;
    const unit = parent?.type === 'unit' ? parent : null;
    const concepts = toc
      .orderedConceptIdsIn(node.id)
      .map((conceptId) => conceptsById.get(conceptId))
      .filter((concept): concept is Concept => concept !== undefined);
    const conceptIds = new Set<Id>(concepts.map((concept) => concept.id));
    const relations = payload.relations.filter(
      (relation) =>
        conceptIds.has(relation.fromConceptId) && conceptIds.has(relation.toConceptId),
    );
    const externalRelations = payload.relations.filter((relation) => {
      const fromInside = conceptIds.has(relation.fromConceptId);
      const toInside = conceptIds.has(relation.toConceptId);
      return (fromInside && !toInside) || (!fromInside && toInside);
    });
    const layout = layoutChapter({
      conceptIds: concepts.map((concept) => concept.id),
      relations,
    });
    const chapters = toc.chapters();
    const index = chapters.findIndex((entry) => entry.id === node.id);
    const value: MapChapter = {
      chapter: node,
      unit,
      path: toc.pathOf(node.id),
      sections: sectionsUnder(node.id),
      concepts,
      relations,
      externalRelations,
      layout,
      previousChapterId: index > 0 ? (chapters[index - 1]?.id ?? null) : null,
      nextChapterId: index >= 0 && index < chapters.length - 1 ? (chapters[index + 1]?.id ?? null) : null,
    };
    chapterCache.set(chapterId, value);
    return value;
  };

  return {
    payload,
    toc,
    summary,
    overview,
    chapter,
    chapterOfConcept,
    filterOverview,
  };
}

/* ---------------------------------------------------------------- helpers */

/** Relations around one concept, split into 先修 / 后继 / 相关 (cross-chapter included). */
export function relationPeers(
  payload: MapPayload,
  conceptId: Id,
  chapterConceptIds: ReadonlySet<Id>,
): { prerequisites: RelationPeer[]; successors: RelationPeer[]; related: RelationPeer[] } {
  const titleOf = (id: Id): string =>
    payload.concepts.find((concept) => concept.id === id)?.title ?? id;
  const learned = (id: Id): boolean => {
    const state = payload.progress.find((entry) => entry.conceptId === id)?.learning.state;
    return state === 'in_progress' || state === 'completed';
  };
  const prerequisites: RelationPeer[] = [];
  const successors: RelationPeer[] = [];
  const related: RelationPeer[] = [];
  for (const relation of payload.relations) {
    const isFrom = relation.fromConceptId === conceptId;
    const isTo = relation.toConceptId === conceptId;
    if (!isFrom && !isTo) continue;
    const otherId = isFrom ? relation.toConceptId : relation.fromConceptId;
    const peer: RelationPeer = {
      relationId: relation.id,
      conceptId: otherId,
      title: titleOf(otherId),
      inChapter: chapterConceptIds.has(otherId),
      learned: learned(otherId),
    };
    if (relation.type === 'related') related.push(peer);
    else if (isTo) prerequisites.push(peer);
    else successors.push(peer);
  }
  return { prerequisites, successors, related };
}

/** Textbook page(s) for a concept; `未核实` when the page was not human checked. */
export function sourcePagesFor(payload: MapPayload, sourceRefs: readonly Id[]): SourcePage[] {
  const pages: SourcePage[] = [];
  const seen = new Set<string>();
  for (const sourceRefId of sourceRefs) {
    const source = payload.sources.find((entry) => entry.sourceRefId === sourceRefId);
    if (source === undefined) {
      const key = `${sourceRefId}|unknown`;
      if (seen.has(key)) continue;
      seen.add(key);
      pages.push({ sourceRefId, label: '出处未核实', unverified: true, available: false });
      continue;
    }
    const page = source.printedPage ?? String(source.pdfPage);
    const key = `${page}|${source.bookAvailable ? 'y' : 'n'}`;
    if (seen.has(key)) continue;
    seen.add(key);
    pages.push({
      sourceRefId,
      label: `课本第 ${page} 页`,
      unverified: source.verification !== 'human_checked',
      available: source.bookAvailable,
    });
  }
  return pages;
}

export interface ResumeTarget {
  readonly chapterId: Id;
  readonly conceptId: Id | null;
  readonly title: string | null;
}

/** Newest local learning/review timestamp for one concept, if it has any. */
function latestActivityOf(progress: ConceptProgress): string | null {
  const stamps = [
    progress.understanding.updatedAt,
    progress.review.lastCompletedAt,
    progress.learning.lastCompletedAt,
    progress.learning.startedAt,
  ].filter((value): value is string => typeof value === 'string' && value.length > 0);
  if (stamps.length === 0) return null;
  return stamps.sort()[stamps.length - 1] ?? null;
}

/** Concept with the most recent local activity; null when nothing was studied yet. */
function latestStudiedConceptId(payload: MapPayload): Id | null {
  let bestId: Id | null = null;
  let bestAt = '';
  for (const progress of payload.progress) {
    const at = latestActivityOf(progress);
    if (at === null) continue;
    if (at > bestAt) {
      bestAt = at;
      bestId = progress.conceptId;
    }
  }
  return bestId;
}

/** "回到我正在学的": the concept with the newest local activity, then the source hint. */
export function resumeTarget(payload: MapPayload, toc: TocTreeModel): ResumeTarget | null {
  const latestId = latestStudiedConceptId(payload);
  const latestConcept =
    latestId === null ? null : payload.concepts.find((concept) => concept.id === latestId) ?? null;
  const initialConcept = payload.initialConceptId === null
    ? null
    : payload.concepts.find((concept) => concept.id === payload.initialConceptId) ?? null;
  const fallbackConcept =
    latestConcept ??
    initialConcept ??
    payload.concepts.find((concept) => {
      const progress = payload.progress.find((entry) => entry.conceptId === concept.id);
      return progress?.learning.state === 'in_progress';
    }) ??
    null;
  const conceptChapter = fallbackConcept === null ? null : (() => {
    const placement = fallbackConcept.placements[0];
    return placement === undefined ? null : toc.chapterOf(placement);
  })();
  const chapter =
    conceptChapter ??
    (payload.initialTocNodeId === null ? null : toc.chapterOf(payload.initialTocNodeId)) ??
    toc.chapters()[0] ??
    null;
  if (chapter === null) return null;
  return {
    chapterId: chapter.id,
    conceptId: fallbackConcept?.id ?? null,
    title: fallbackConcept?.title ?? null,
  };
}

/** All relation peers for a chapter's concept, used by the list view. */
export function chapterPeers(
  payload: MapPayload,
  chapter: MapChapter,
): ReadonlyMap<Id, { prerequisites: RelationPeer[]; successors: RelationPeer[] }> {
  const ids = new Set<Id>(chapter.concepts.map((concept) => concept.id));
  const result = new Map<Id, { prerequisites: RelationPeer[]; successors: RelationPeer[] }>();
  for (const conceptId of ids) {
    const peers = relationPeers(payload, conceptId, ids);
    result.set(conceptId, {
      prerequisites: peers.prerequisites,
      successors: peers.successors,
    });
  }
  return result;
}
