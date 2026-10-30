/**
 * Explicitly synthetic map data source (演示数据（fixture）).
 *
 * Everything here is generated in code: no textbook text, no page images, no
 * user data. Two scenarios exist:
 * - `demo`: a small 3-chapter tree with multi-placement concepts, prerequisite
 *   and related relations (including cross-chapter ones) and every three-axis
 *   combination the UI has to label;
 * - `scale`: 500 concepts / 1000 relations used for the bounded rendering and
 *   timing evidence.
 *
 * The source derives the bounded chapter graph and the concept neighborhood
 * locally; T13 replaces this whole object with a facade backed by
 * `@edu/knowledge` `KnowledgeService` + the learner projection store, keeping
 * the same `MapDataSource` shape.
 *
 * The fixture is *not* a published content pack: it is a read model. Tests
 * validate its toc/concepts/relations with the frozen domain validators.
 */

import {
  type Concept,
  type ConceptProgress,
  type Evidence,
  type Id,
  type Relation,
  type SelfReport,
  type SourceVerificationState,
  type TocNodeLike,
} from '@edu/domain';
import { okData, type DataResult } from '../../shell/src/index.js';
import {
  MAP_DEPTH_CAP,
  MAP_NODE_CAP,
  MAP_SEARCH_LIMIT,
  type ChapterGraphOptions,
  type ConceptDetail,
  type ConceptSearchHit,
  type GraphSlice,
  type MapDataSource,
  type MapPayload,
  type MapRequest,
  type MapSourceSummary,
} from './types.js';

export type MapScenario = 'demo' | 'candidate' | 'scale';

const COURSE_EDITION_ID = 'course.biology-demo';
const PACK_ID = 'pack.biology-demo';
const PACK_VERSION = '1.0.0';

/** Wall clock only for measuring a local query; never a fact source. */
function nowMs(): number {
  const perf = (globalThis as { performance?: { now?: () => number } }).performance;
  if (perf !== undefined && typeof perf.now === 'function') return perf.now();
  return Date.now();
}

function roundMs(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function tocNode(
  id: string,
  parentId: string | null,
  type: TocNodeLike['type'],
  title: string,
  order: number,
  sourceRef = 'source.p18',
): TocNodeLike {
  return {
    schemaVersion: 1,
    id,
    courseEditionId: COURSE_EDITION_ID,
    parentId,
    type,
    title,
    order,
    sourceRefs: [sourceRef],
  };
}

function concept(
  id: string,
  title: string,
  placements: readonly string[],
  aliases: readonly string[],
  sourceRefs: readonly string[],
  reviewState: Concept['reviewState'] = 'published',
): Concept {
  return {
    schemaVersion: 1,
    id,
    courseEditionId: COURSE_EDITION_ID,
    title,
    aliases,
    placements,
    learningObjectives: [`能说明“${title}”的要点（合成示例目标）`],
    explanation: `合成解释：${title}（演示数据，不是教材原文）。`,
    misconceptions: [],
    sourceRefs,
    rubricIds: [],
    activityIds: [],
    reviewState,
  };
}

function relation(
  id: string,
  fromConceptId: string,
  toConceptId: string,
  type: Relation['type'],
  basis: Relation['basis'],
  rationale: string,
  sourceRefs: readonly string[],
  reviewState: Relation['reviewState'] = 'published',
): Relation {
  return {
    schemaVersion: 1,
    id,
    courseEditionId: COURSE_EDITION_ID,
    fromConceptId,
    toConceptId,
    type,
    basis,
    rationale,
    sourceRefs,
    reviewState,
  };
}

function progress(
  conceptId: string,
  learning: ConceptProgress['learning'],
  understanding: ConceptProgress['understanding'],
  review: ConceptProgress['review'],
  revision: number,
): ConceptProgress {
  return {
    schemaVersion: 1,
    learnerId: 'learner.local.demo',
    courseEditionId: COURSE_EDITION_ID,
    packVersion: PACK_VERSION,
    conceptId,
    learning,
    understanding,
    review,
    lastPosition: { sessionId: null, activityId: null, cursor: null, updatedAt: null },
    revision,
  };
}

function evidence(
  id: string,
  conceptId: string,
  kind: Evidence['kind'],
  observation: string,
  met: Evidence['criterionResults'][number]['result'],
  validity: Evidence['validity'],
  assistance: Evidence['assistance'] = 'unassisted',
): Evidence {
  return {
    schemaVersion: 1,
    id,
    attemptId: `attempt.${id}`,
    learnerId: 'learner.local.demo',
    courseEditionId: COURSE_EDITION_ID,
    packVersion: PACK_VERSION,
    conceptId,
    kind,
    observation,
    criterionResults: [{ criterionId: `criterion.${conceptId}`, result: met, note: null }],
    assistance,
    sourceRefs: ['source.p18'],
    assessmentOrigin: 'rule',
    modelRunId: null,
    uncertainty: null,
    validity,
    createdAt: '2026-10-20T09:00:00Z',
  };
}

const REVIEW_POLICY = 'review-policy-v1';

const SOURCE_CATALOGUE: Readonly<Record<string, MapSourceSummary>> = {
  'source.p18': {
    sourceRefId: 'source.p18',
    pdfPage: 18,
    printedPage: null,
    bookAvailable: true,
    verification: 'machine_matched',
    label: 'PDF 第 18 页 · 印刷页未标注 · 机器匹配（非人工核对）',
  },
  'source.p19': {
    sourceRefId: 'source.p19',
    pdfPage: 19,
    printedPage: null,
    bookAvailable: true,
    verification: 'machine_matched',
    label: 'PDF 第 19 页 · 印刷页未标注 · 机器匹配（非人工核对）',
  },
  'source.p26': {
    sourceRefId: 'source.p26',
    pdfPage: 26,
    printedPage: null,
    bookAvailable: true,
    verification: 'unverified',
    label: 'PDF 第 26 页 · 印刷页未标注 · 未核实',
  },
  'source.p27': {
    sourceRefId: 'source.p27',
    pdfPage: 27,
    printedPage: null,
    bookAvailable: true,
    verification: 'unverified',
    label: 'PDF 第 27 页 · 印刷页未标注 · 未核实',
  },
  'source.p28': {
    sourceRefId: 'source.p28',
    pdfPage: 28,
    printedPage: null,
    bookAvailable: true,
    verification: 'unverified',
    label: 'PDF 第 28 页 · 印刷页未标注 · 未核实',
  },
  'source.p34': {
    sourceRefId: 'source.p34',
    pdfPage: 34,
    printedPage: null,
    bookAvailable: false,
    verification: 'unverified',
    label: 'PDF 第 34 页 · 本机材料不可用（保留出处位置）',
  },
};

function sourceFor(sourceRefId: string): MapSourceSummary {
  return (
    SOURCE_CATALOGUE[sourceRefId] ?? {
      sourceRefId,
      pdfPage: 1,
      printedPage: null,
      bookAvailable: false,
      verification: 'unverified' as SourceVerificationState,
      label: '出处信息未在本机材料中核实',
    }
  );
}

/* ------------------------------------------------------------------ demo */

function demoTree(): TocNodeLike[] {
  return [
    tocNode('toc.volume', null, 'volume', '合成演示教材（七上）', 0),
    tocNode('toc.unit1', 'toc.volume', 'unit', '第 1 单元 生物体的结构层次', 0),
    tocNode('toc.ch1', 'toc.unit1', 'chapter', '第 1 章 细胞', 0, 'source.p18'),
    tocNode('toc.ch1.s1', 'toc.ch1', 'section', '第 1 节 细胞的基本结构', 0, 'source.p18'),
    tocNode('toc.ch1.s2', 'toc.ch1', 'section', '第 2 节 细胞的生活', 1, 'source.p19'),
    tocNode('toc.ch2', 'toc.unit1', 'chapter', '第 2 章 绿色植物的生活', 1, 'source.p26'),
    tocNode('toc.ch2.s1', 'toc.ch2', 'section', '第 1 节 光合作用', 0, 'source.p26'),
    tocNode('toc.ch2.s2', 'toc.ch2', 'section', '第 2 节 呼吸作用', 1, 'source.p28'),
    tocNode('toc.unit2', 'toc.volume', 'unit', '第 2 单元 生物与环境', 1, 'source.p34'),
    tocNode('toc.ch3', 'toc.unit2', 'chapter', '第 3 章 生态系统', 0, 'source.p34'),
    tocNode('toc.ch3.s1', 'toc.ch3', 'section', '第 1 节 生态系统的组成', 0, 'source.p34'),
  ];
}

function demoConcepts(reviewState: Concept['reviewState'] = 'published'): Concept[] {
  return [
    concept(
      'concept.cell',
      '细胞',
      ['toc.ch1.s1', 'toc.ch3.s1'],
      ['cell', '细胞（基本单位）'],
      ['source.p18'],
      reviewState,
    ),
    concept('concept.cell-structure', '细胞结构', ['toc.ch1.s1'], [], ['source.p18'], reviewState),
    concept('concept.cell-division', '细胞分裂', ['toc.ch1.s2'], [], ['source.p19'], reviewState),
    concept('concept.organism', '生物体的结构层次', ['toc.ch2.s1'], [], ['source.p26'], reviewState),
    concept('concept.photosynthesis', '光合作用', ['toc.ch2.s1'], ['photosynthesis'], ['source.p26', 'source.p27'], reviewState),
    concept('concept.respiration', '呼吸作用', ['toc.ch2.s2'], [], ['source.p28'], reviewState),
    concept('concept.ecosystem', '生态系统', ['toc.ch3.s1'], [], ['source.p34'], reviewState),
  ];
}

function demoRelations(reviewState: Relation['reviewState'] = 'published'): Relation[] {
  return [
    relation(
      'relation.prereq.cell-organism',
      'concept.cell',
      'concept.organism',
      'prerequisite',
      'explicit_source',
      '理解生物体的结构层次前，先认识细胞是基本单位（合成示例，依据出处第 18 页）。',
      ['source.p18'],
      reviewState,
    ),
    relation(
      'relation.prereq.structure-division',
      'concept.cell-structure',
      'concept.cell-division',
      'prerequisite',
      'pedagogical_inference',
      '先理解结构再理解分裂，属于教学推断，不是教材原文结论。',
      [],
      reviewState,
    ),
    relation(
      'relation.related.cell-division',
      'concept.cell',
      'concept.cell-division',
      'related',
      'explicit_source',
      '细胞与细胞分裂是相关概念，没有先后要求（合成示例）。',
      ['source.p19'],
      reviewState,
    ),
    relation(
      'relation.prereq.cell-photosynthesis',
      'concept.cell',
      'concept.photosynthesis',
      'prerequisite',
      'pedagogical_inference',
      '理解光合作用前先认识细胞（跨章建议，不阻断进入）。',
      [],
      reviewState,
    ),
    relation(
      'relation.prereq.division-photosynthesis',
      'concept.cell-division',
      'concept.photosynthesis',
      'prerequisite',
      'pedagogical_inference',
      '先理解细胞分裂，再理解光合作用产物的去向，属于教学推断。',
      [],
      reviewState,
    ),
    relation(
      'relation.related.cell-ecosystem',
      'concept.cell',
      'concept.ecosystem',
      'related',
      'explicit_source',
      '细胞与生态系统是跨章相关概念（合成示例）。',
      ['source.p34'],
      reviewState,
    ),
  ];
}

function demoProgress(): ConceptProgress[] {
  return [
    progress(
      'concept.cell',
      {
        state: 'completed',
        startedAt: '2026-10-20T08:00:00Z',
        lastCompletedAt: '2026-10-20T08:40:00Z',
      },
      {
        state: 'supported',
        assessmentId: 'assessment.demo.cell',
        updatedAt: '2026-10-20T08:40:00Z',
        validity: 'current',
      },
      {
        lastCompletedAt: '2026-10-21T09:00:00Z',
        dueAt: '2026-10-28T09:00:00Z',
        activeSessionId: null,
        latestOutcome: 'supported',
        policyVersion: REVIEW_POLICY,
      },
      4,
    ),
    progress(
      'concept.cell-structure',
      {
        state: 'completed',
        startedAt: '2026-10-21T08:00:00Z',
        lastCompletedAt: '2026-10-21T08:30:00Z',
      },
      {
        state: 'developing',
        assessmentId: 'assessment.demo.cell-structure',
        updatedAt: '2026-10-21T08:30:00Z',
        validity: 'current',
      },
      {
        lastCompletedAt: '2026-10-22T09:00:00Z',
        dueAt: '2026-10-25T09:00:00Z',
        activeSessionId: null,
        latestOutcome: 'developing',
        policyVersion: REVIEW_POLICY,
      },
      3,
    ),
    progress(
      'concept.cell-division',
      {
        state: 'in_progress',
        startedAt: '2026-10-29T08:00:00Z',
        lastCompletedAt: null,
      },
      { state: 'unassessed', assessmentId: null, updatedAt: null, validity: 'current' },
      {
        lastCompletedAt: null,
        dueAt: null,
        activeSessionId: 'session.demo.cell-division',
        latestOutcome: null,
        policyVersion: REVIEW_POLICY,
      },
      2,
    ),
    progress(
      'concept.organism',
      {
        state: 'completed',
        startedAt: '2026-10-23T08:00:00Z',
        lastCompletedAt: '2026-10-23T08:30:00Z',
      },
      {
        state: 'supported',
        assessmentId: 'assessment.demo.organism',
        updatedAt: '2026-10-23T08:30:00Z',
        validity: 'current',
      },
      {
        lastCompletedAt: null,
        dueAt: null,
        activeSessionId: null,
        latestOutcome: null,
        policyVersion: REVIEW_POLICY,
      },
      2,
    ),
    progress(
      'concept.photosynthesis',
      {
        state: 'completed',
        startedAt: '2026-10-24T08:00:00Z',
        lastCompletedAt: '2026-10-24T08:30:00Z',
      },
      {
        state: 'needs_support',
        assessmentId: 'assessment.demo.photosynthesis',
        updatedAt: '2026-10-24T08:30:00Z',
        validity: 'current',
      },
      {
        lastCompletedAt: '2026-10-27T09:00:00Z',
        dueAt: '2026-10-28T09:00:00Z',
        activeSessionId: null,
        latestOutcome: 'needs_support',
        policyVersion: REVIEW_POLICY,
      },
      3,
    ),
    progress(
      'concept.ecosystem',
      {
        state: 'completed',
        startedAt: '2026-10-25T08:00:00Z',
        lastCompletedAt: '2026-10-25T08:30:00Z',
      },
      {
        state: 'developing',
        assessmentId: 'assessment.demo.ecosystem',
        updatedAt: '2026-10-25T08:30:00Z',
        validity: 'stale',
      },
      {
        lastCompletedAt: null,
        dueAt: null,
        activeSessionId: null,
        latestOutcome: null,
        policyVersion: REVIEW_POLICY,
      },
      2,
    ),
  ];
}

function demoEvidence(): Evidence[] {
  return [
    evidence('evidence.demo.cell-explain', 'concept.cell', 'explain', '用自己的话解释了细胞是基本单位。', 'met', 'current'),
    evidence(
      'evidence.demo.photosynthesis-recall',
      'concept.photosynthesis',
      'recall',
      '把光合作用的原料说错了一部分。',
      'not_met',
      'current',
    ),
    evidence(
      'evidence.demo.ecosystem-transfer',
      'concept.ecosystem',
      'transfer',
      '举了一个生态系统的例子，但证据已过期。',
      'met',
      'stale',
    ),
  ];
}

function demoPayload(scenario: MapScenario): MapPayload {
  const candidate = scenario === 'candidate';
  const reviewState: Concept['reviewState'] = candidate ? 'machine_checked' : 'published';
  return {
    courseEditionId: COURSE_EDITION_ID,
    courseEditionLabel: '7年级上册 · 生物 · 合成演示教材（非真实版本）',
    packId: PACK_ID,
    packVersion: PACK_VERSION,
    trustMode: candidate ? 'candidate' : 'published',
    scope: 'partial',
    coverageStatus: 'partial',
    toc: demoTree(),
    concepts: demoConcepts(reviewState),
    relations: demoRelations(reviewState === 'published' ? 'published' : 'machine_checked'),
    progress: demoProgress(),
    selfReports: [
      {
        schemaVersion: 1,
        id: 'self-report.demo.cell',
        learnerId: 'learner.local.demo',
        courseEditionId: COURSE_EDITION_ID,
        packVersion: PACK_VERSION,
        conceptId: 'concept.cell',
        claimedState: 'basically_understood',
        createdAt: '2026-10-20T08:45:00Z',
      },
      {
        schemaVersion: 1,
        id: 'self-report.demo.photosynthesis',
        learnerId: 'learner.local.demo',
        courseEditionId: COURSE_EDITION_ID,
        packVersion: PACK_VERSION,
        conceptId: 'concept.photosynthesis',
        claimedState: 'uncertain',
        createdAt: '2026-10-27T09:10:00Z',
      },
    ],
    evidence: demoEvidence(),
    sources: Object.values(SOURCE_CATALOGUE),
    initialTocNodeId: null,
    initialConceptId: null,
    fixture: true,
    notice: candidate
      ? '演示数据（fixture）· 候选内容场景：候选包禁用强结论，仅供显式试用演示。'
      : '演示数据（fixture）：合成目录、概念与关系，不是真实教材或真实 API 结果。',
  };
}

/* ----------------------------------------------------------------- scale */

export interface ScaleFixtureOptions {
  readonly conceptCount?: number;
  readonly prerequisiteCount?: number;
  readonly relatedCount?: number;
  readonly chapters?: number;
  readonly sectionsPerChapter?: number;
}

export function buildScalePayload(options: ScaleFixtureOptions = {}): MapPayload {
  const conceptCount = options.conceptCount ?? 500;
  const prerequisiteCount = options.prerequisiteCount ?? 499;
  const relatedCount = options.relatedCount ?? 501;
  const chapters = options.chapters ?? 20;
  const sectionsPerChapter = options.sectionsPerChapter ?? 5;
  const sectionCount = chapters * sectionsPerChapter;
  const conceptsPerSection = Math.ceil(conceptCount / sectionCount);

  const toc: TocNodeLike[] = [tocNode('toc.volume', null, 'volume', '合成演示教材（全册规模）', 0)];
  const sectionIds: string[] = [];
  for (let chapter = 0; chapter < chapters; chapter += 1) {
    const chapterId = `toc.ch${String(chapter).padStart(2, '0')}`;
    toc.push(
      tocNode(chapterId, 'toc.volume', 'chapter', `第 ${chapter + 1} 章（合成）`, chapter),
    );
    for (let section = 0; section < sectionsPerChapter; section += 1) {
      const sectionId = `${chapterId}.s${section + 1}`;
      sectionIds.push(sectionId);
      toc.push(
        tocNode(sectionId, chapterId, 'section', `第 ${chapter + 1} 章 第 ${section + 1} 节`, section),
      );
    }
  }

  const conceptId = (index: number): string => `concept.scale${String(index).padStart(4, '0')}`;
  const concepts: Concept[] = [];
  for (let index = 0; index < conceptCount; index += 1) {
    const sectionIndex = Math.min(sectionIds.length - 1, Math.floor(index / conceptsPerSection));
    concepts.push(
      concept(
        conceptId(index),
        `合成概念 ${index}`,
        [sectionIds[sectionIndex] as string],
        [`alias-${index}`, `别名${index}`],
        ['source.p18'],
      ),
    );
  }

  const relations: Relation[] = [];
  for (let index = 0; index < prerequisiteCount; index += 1) {
    relations.push(
      relation(
        `relation.scale.prereq.${String(index).padStart(4, '0')}`,
        conceptId(index % conceptCount),
        conceptId((index + 1) % conceptCount),
        'prerequisite',
        'pedagogical_inference',
        '合成 fixture 中的教学顺序假设（非教材依据）。',
        [],
      ),
    );
  }
  const relatedPairs = new Set<string>();
  let cursor = 0;
  while (relatedPairs.size < relatedCount && cursor < relatedCount * 8) {
    const step = 1 + Math.floor(cursor / conceptCount);
    const left = cursor % conceptCount;
    const right = (left + step) % conceptCount;
    cursor += 1;
    if (left === right) continue;
    const low = Math.min(left, right);
    const high = Math.max(left, right);
    const key = `${low}<->${high}`;
    if (relatedPairs.has(key)) continue;
    relatedPairs.add(key);
    relations.push(
      relation(
        `relation.scale.related.${String(relatedPairs.size).padStart(4, '0')}`,
        conceptId(low),
        conceptId(high),
        'related',
        'pedagogical_inference',
        '合成 fixture 中的相关关联。',
        [],
      ),
    );
  }

  const states: ConceptProgress[] = concepts.slice(0, 120).map((entry, index) => {
    const variant = index % 6;
    const base = {
      startedAt: '2026-10-20T08:00:00Z',
      lastCompletedAt: '2026-10-20T08:40:00Z',
    };
    if (variant === 0) {
      return progress(
        entry.id,
        { state: 'completed', ...base },
        {
          state: 'supported',
          assessmentId: `assessment.scale.${index}`,
          updatedAt: '2026-10-20T08:40:00Z',
          validity: 'current',
        },
        {
          lastCompletedAt: '2026-10-21T09:00:00Z',
          dueAt: '2026-10-28T09:00:00Z',
          activeSessionId: null,
          latestOutcome: 'supported',
          policyVersion: REVIEW_POLICY,
        },
        2,
      );
    }
    if (variant === 1) {
      return progress(
        entry.id,
        { state: 'completed', ...base },
        {
          state: 'needs_support',
          assessmentId: `assessment.scale.${index}`,
          updatedAt: '2026-10-20T08:40:00Z',
          validity: 'current',
        },
        {
          lastCompletedAt: '2026-10-21T09:00:00Z',
          dueAt: '2026-10-28T09:00:00Z',
          activeSessionId: null,
          latestOutcome: 'needs_support',
          policyVersion: REVIEW_POLICY,
        },
        2,
      );
    }
    if (variant === 2) {
      return progress(
        entry.id,
        { state: 'in_progress', startedAt: '2026-10-28T08:00:00Z', lastCompletedAt: null },
        { state: 'unassessed', assessmentId: null, updatedAt: null, validity: 'current' },
        {
          lastCompletedAt: null,
          dueAt: null,
          activeSessionId: null,
          latestOutcome: null,
          policyVersion: REVIEW_POLICY,
        },
        1,
      );
    }
    if (variant === 3) {
      return progress(
        entry.id,
        { state: 'completed', ...base },
        {
          state: 'developing',
          assessmentId: `assessment.scale.${index}`,
          updatedAt: '2026-10-20T08:40:00Z',
          validity: 'current',
        },
        {
          lastCompletedAt: null,
          dueAt: null,
          activeSessionId: null,
          latestOutcome: null,
          policyVersion: REVIEW_POLICY,
        },
        2,
      );
    }
    if (variant === 4) {
      return progress(
        entry.id,
        { state: 'completed', ...base },
        {
          state: 'developing',
          assessmentId: `assessment.scale.${index}`,
          updatedAt: '2026-10-20T08:40:00Z',
          validity: 'stale',
        },
        {
          lastCompletedAt: null,
          dueAt: null,
          activeSessionId: null,
          latestOutcome: null,
          policyVersion: REVIEW_POLICY,
        },
        2,
      );
    }
    return progress(
      entry.id,
      { state: 'not_started', startedAt: null, lastCompletedAt: null },
      { state: 'unassessed', assessmentId: null, updatedAt: null, validity: 'current' },
      {
        lastCompletedAt: null,
        dueAt: null,
        activeSessionId: null,
        latestOutcome: null,
        policyVersion: REVIEW_POLICY,
      },
      1,
    );
  });

  return {
    courseEditionId: COURSE_EDITION_ID,
    courseEditionLabel: '7年级上册 · 生物 · 合成演示教材（500 概念规模 fixture）',
    packId: 'pack.biology-scale-demo',
    packVersion: '1.0.0',
    trustMode: 'published',
    scope: 'partial',
    coverageStatus: 'partial',
    toc,
    concepts,
    relations,
    progress: states,
    selfReports: [],
    evidence: demoEvidence(),
    sources: Object.values(SOURCE_CATALOGUE),
    initialTocNodeId: null,
    initialConceptId: null,
    fixture: true,
    notice:
      '演示数据（fixture）· 500 概念 / 1000 关系规模示例：用于有界渲染与耗时记录，不是真实教材。',
  };
}

/* ------------------------------------------------------------- derivation */

interface TreeIndex {
  readonly byId: ReadonlyMap<Id, TocNodeLike>;
  readonly childrenOf: ReadonlyMap<Id, readonly TocNodeLike[]>;
  readonly chapterOf: (nodeId: Id) => TocNodeLike | null;
  readonly subtreeIds: (nodeId: Id) => readonly Id[];
}

function buildTreeIndex(toc: readonly TocNodeLike[]): TreeIndex {
  const byId = new Map<Id, TocNodeLike>();
  for (const node of toc) byId.set(node.id, node);
  const childrenOf = new Map<Id, TocNodeLike[]>();
  for (const node of toc) {
    if (node.parentId === null) continue;
    const list = childrenOf.get(node.parentId) ?? [];
    list.push(node);
    childrenOf.set(node.parentId, list);
  }
  for (const list of childrenOf.values()) {
    list.sort((left, right) => (left.order !== right.order ? left.order - right.order : left.id < right.id ? -1 : 1));
  }
  const chapterOf = (nodeId: Id): TocNodeLike | null => {
    let cursor = byId.get(nodeId);
    let guard = 0;
    while (cursor !== undefined && guard <= toc.length) {
      if (cursor.type === 'chapter') return cursor;
      cursor = cursor.parentId === null ? undefined : byId.get(cursor.parentId);
      guard += 1;
    }
    return null;
  };
  const subtreeIds = (nodeId: Id): readonly Id[] => {
    const start = byId.get(nodeId);
    if (start === undefined) return [];
    const output: Id[] = [];
    const queue: TocNodeLike[] = [start];
    while (queue.length > 0) {
      const current = queue.shift() as TocNodeLike;
      output.push(current.id);
      for (const child of childrenOf.get(current.id) ?? []) queue.push(child);
    }
    return output;
  };
  return { byId, childrenOf, chapterOf, subtreeIds };
}

function conceptOrder(
  tocIndex: TreeIndex,
  concepts: readonly Concept[],
  scopeNodeId: Id | null,
): readonly Id[] {
  const ids: Id[] = [];
  const placements = new Map<Id, Id[]>();
  for (const entry of concepts) placements.set(entry.id, [...entry.placements]);
  const scopeIds = scopeNodeId === null ? null : new Set(tocIndex.subtreeIds(scopeNodeId));
  const seen = new Set<Id>();
  const visit = (nodeId: Id): void => {
    for (const entry of concepts) {
      if (seen.has(entry.id)) continue;
      if (!(placements.get(entry.id) ?? []).includes(nodeId)) continue;
      if (scopeIds !== null && !(scopeIds.has(nodeId))) continue;
      seen.add(entry.id);
      ids.push(entry.id);
    }
  };
  const roots = [...tocIndex.byId.values()].filter((node) => node.parentId === null);
  const walk = (node: TocNodeLike): void => {
    visit(node.id);
    for (const child of tocIndex.childrenOf.get(node.id) ?? []) walk(child);
  };
  for (const root of roots) walk(root);
  if (scopeNodeId === null) {
    for (const entry of concepts) {
      if (!seen.has(entry.id)) ids.push(entry.id);
    }
  }
  return ids;
}

function chapterConceptIds(tocIndex: TreeIndex, concepts: readonly Concept[], chapterId: Id): readonly Id[] {
  const scope = new Set(tocIndex.subtreeIds(chapterId));
  const ordered = conceptOrder(tocIndex, concepts, chapterId);
  return ordered.filter((conceptId) => {
    const entry = concepts.find((candidate) => candidate.id === conceptId);
    return entry !== undefined && entry.placements.some((placement) => scope.has(placement));
  });
}

function relationsTouching(relations: readonly Relation[], conceptId: Id): readonly Relation[] {
  return relations.filter(
    (entry) => entry.fromConceptId === conceptId || entry.toConceptId === conceptId,
  );
}

function emptySlice(packVersion: string): GraphSlice {
  return {
    packVersion,
    centerConceptId: null,
    scopeTocNodeId: null,
    concepts: [],
    relations: [],
    externalConcepts: [],
    truncated: false,
    hiddenConceptCount: 0,
    stats: { maxNodes: 0, maxDepth: 0, visitedConcepts: 0, visitedRelations: 0, durationMs: 0 },
  };
}

function normOptions(options: ChapterGraphOptions): { maxNodes: number; maxDepth: number; visible: number } {
  const maxNodes = Math.max(1, Math.min(MAP_NODE_CAP * 4, Math.trunc(options.maxNodes)));
  const maxDepth = Math.max(1, Math.min(MAP_DEPTH_CAP + 2, Math.trunc(options.maxDepth)));
  const visible = Math.max(
    1,
    Math.min(maxNodes, Math.trunc(options.visibleConceptCount ?? maxNodes)),
  );
  return { maxNodes, maxDepth, visible };
}

class FixtureMapDataSource implements MapDataSource {
  readonly kind = 'fixture' as const;
  readonly notice = '演示数据（fixture）：不是真实教材或真实 API 结果。';

  private readonly payload: MapPayload;
  private readonly tocIndex: TreeIndex;
  private readonly conceptById: ReadonlyMap<Id, Concept>;
  private readonly relationsByConcept: ReadonlyMap<Id, readonly Relation[]>;

  constructor(payload: MapPayload) {
    this.payload = payload;
    this.tocIndex = buildTreeIndex(payload.toc);
    this.conceptById = new Map(payload.concepts.map((entry) => [entry.id, entry]));
    const byConcept = new Map<Id, Relation[]>();
    for (const entry of payload.relations) {
      for (const conceptId of [entry.fromConceptId, entry.toConceptId]) {
        const list = byConcept.get(conceptId) ?? [];
        list.push(entry);
        byConcept.set(conceptId, list);
      }
    }
    this.relationsByConcept = byConcept;
  }

  async loadMap(_request: MapRequest): Promise<DataResult<MapPayload>> {
    const chapters = this.payload.toc.filter((node) => node.type === 'chapter');
    const latest = [...this.payload.progress]
      .filter((entry) => entry.understanding.updatedAt !== null)
      .sort((left, right) =>
        (left.understanding.updatedAt ?? '') < (right.understanding.updatedAt ?? '') ? 1 : -1,
      )[0];
    const latestConcept = latest === undefined ? undefined : this.conceptById.get(latest.conceptId);
    const latestChapter =
      latestConcept === undefined ? null : this.tocIndex.chapterOf(latestConcept.placements[0] as Id);
    const initialChapter = latestChapter ?? chapters[0] ?? null;
    const initialConceptId =
      latestConcept?.id ??
      (initialChapter === null
        ? null
        : (chapterConceptIds(this.tocIndex, this.payload.concepts, initialChapter.id)[0] ?? null));
    return okData(
      {
        ...this.payload,
        initialTocNodeId: initialChapter?.id ?? null,
        initialConceptId,
      },
      1,
    );
  }

  async loadChapterGraph(
    _request: MapRequest,
    tocNodeId: Id,
    options: ChapterGraphOptions,
  ): Promise<DataResult<GraphSlice>> {
    const started = nowMs();
    const { maxDepth, visible } = normOptions(options);
    const chapter = this.tocIndex.chapterOf(tocNodeId);
    if (chapter === null) return okData(emptySlice(this.payload.packVersion), 1);

    const allIds = chapterConceptIds(this.tocIndex, this.payload.concepts, chapter.id);
    const visibleIds = allIds.slice(0, visible);
    const visibleSet = new Set(visibleIds);
    const paintedRelations = this.payload.relations.filter(
      (entry) =>
        visibleSet.has(entry.fromConceptId) && visibleSet.has(entry.toConceptId),
    );
    const externalIds = new Set<Id>();
    const touching = this.payload.relations.filter(
      (entry) => visibleSet.has(entry.fromConceptId) || visibleSet.has(entry.toConceptId),
    );
    for (const entry of touching) {
      if (!visibleSet.has(entry.fromConceptId)) externalIds.add(entry.fromConceptId);
      if (!visibleSet.has(entry.toConceptId)) externalIds.add(entry.toConceptId);
    }
    const externalConcepts = [...externalIds]
      .sort()
      .map((id) => this.conceptById.get(id))
      .filter((entry): entry is Concept => entry !== undefined);

    const centerId = options.centerConceptId ?? visibleIds[0] ?? null;
    const concepts = visibleIds
      .map((id) => this.conceptById.get(id))
      .filter((entry): entry is Concept => entry !== undefined);
    const hiddenConceptCount = Math.max(0, allIds.length - concepts.length);
    const durationMs = roundMs(nowMs() - started);
    return okData(
      {
        packVersion: this.payload.packVersion,
        centerConceptId: centerId,
        scopeTocNodeId: chapter.id,
        concepts,
        relations: paintedRelations,
        externalConcepts,
        truncated: externalConcepts.length > 0 || hiddenConceptCount > 0,
        hiddenConceptCount,
        stats: {
          maxNodes: Math.max(1, visible),
          maxDepth,
          visitedConcepts: concepts.length,
          visitedRelations: paintedRelations.length,
          durationMs,
        },
      },
      1,
    );
  }

  async expandConcept(
    _request: MapRequest,
    conceptId: Id,
    options: { readonly maxNodes: number; readonly maxDepth: number },
  ): Promise<DataResult<GraphSlice>> {
    const started = nowMs();
    const center = this.conceptById.get(conceptId);
    if (center === undefined) {
      return {
        ok: false,
        error: { code: 'NOT_FOUND', message: '概念不在当前内容包中', retryable: false },
      };
    }
    const maxNodes = Math.max(1, Math.min(MAP_NODE_CAP * 8, Math.trunc(options.maxNodes)));
    const maxDepth = Math.max(0, Math.min(MAP_DEPTH_CAP + 4, Math.trunc(options.maxDepth)));
    const included = new Set<Id>([conceptId]);
    let frontier: Id[] = [conceptId];
    let depth = 0;
    let truncated = false;
    while (frontier.length > 0 && depth < maxDepth) {
      const next: Id[] = [];
      for (const current of frontier) {
        for (const entry of this.relationsByConcept.get(current) ?? []) {
          const neighbor =
            entry.fromConceptId === current ? entry.toConceptId : entry.fromConceptId;
          if (included.has(neighbor)) continue;
          if (included.size >= maxNodes) {
            truncated = true;
            continue;
          }
          included.add(neighbor);
          next.push(neighbor);
        }
      }
      depth += 1;
      frontier = next.sort();
    }
    const concepts = [...included]
      .map((id) => this.conceptById.get(id))
      .filter((entry): entry is Concept => entry !== undefined);
    const includedSet = new Set(concepts.map((entry) => entry.id));
    const relations = this.payload.relations.filter(
      (entry) => includedSet.has(entry.fromConceptId) && includedSet.has(entry.toConceptId),
    );
    const durationMs = roundMs(nowMs() - started);
    return okData(
      {
        packVersion: this.payload.packVersion,
        centerConceptId: conceptId,
        scopeTocNodeId: null,
        concepts,
        relations,
        externalConcepts: [],
        truncated,
        hiddenConceptCount: 0,
        stats: {
          maxNodes,
          maxDepth,
          visitedConcepts: concepts.length,
          visitedRelations: relations.length,
          durationMs,
        },
      },
      1,
    );
  }

  async searchConcepts(
    _request: MapRequest,
    query: string,
    limit: number,
  ): Promise<DataResult<readonly ConceptSearchHit[]>> {
    const needle = query.trim().toLowerCase();
    if (needle.length === 0) return okData([], 1);
    const capped = Math.max(1, Math.min(limit, MAP_SEARCH_LIMIT));
    const hits: ConceptSearchHit[] = [];
    for (const entry of this.payload.concepts) {
      const title = entry.title.toLowerCase();
      let score = 0;
      let matchedOn: ConceptSearchHit['matchedOn'] = 'title';
      let matchedText = entry.title;
      if (title === needle) score = 100;
      else if (title.startsWith(needle)) score = 80;
      else if (title.includes(needle)) score = 60;
      for (const alias of entry.aliases) {
        const lowered = alias.toLowerCase();
        if (lowered === needle && score < 95) {
          score = 95;
          matchedOn = 'alias';
          matchedText = alias;
        } else if (lowered.startsWith(needle) && score < 75) {
          score = 75;
          matchedOn = 'alias';
          matchedText = alias;
        } else if (lowered.includes(needle) && score < 55) {
          score = 55;
          matchedOn = 'alias';
          matchedText = alias;
        }
      }
      if (score === 0) continue;
      const placement = entry.placements[0] as Id;
      const chapter = this.tocIndex.chapterOf(placement);
      hits.push({
        conceptId: entry.id,
        title: entry.title,
        matchedOn,
        matchedText,
        tocNodeId: chapter?.id ?? null,
        tocTitle: chapter?.title ?? null,
        score,
      });
    }
    hits.sort((left, right) => {
      if (left.score !== right.score) return right.score - left.score;
      return left.title.localeCompare(right.title, 'zh-Hans-CN');
    });
    return okData(hits.slice(0, capped), 1);
  }

  async loadConceptDetail(
    _request: MapRequest,
    conceptId: Id,
  ): Promise<DataResult<ConceptDetail>> {
    const entry = this.conceptById.get(conceptId);
    if (entry === undefined) {
      return {
        ok: false,
        error: { code: 'NOT_FOUND', message: '概念不在当前内容包中', retryable: false },
      };
    }
    const relations = this.relationsByConcept.get(conceptId) ?? [];
    const prerequisites = relations.filter(
      (candidate) => candidate.type === 'prerequisite' && candidate.toConceptId === conceptId,
    );
    const sources = [...new Set(entry.sourceRefs)].map((ref) => sourceFor(ref));
    const placements = entry.placements.map((placement) => {
      const node = this.tocIndex.byId.get(placement);
      const path: string[] = [];
      let cursor = node;
      let guard = 0;
      while (cursor !== undefined && guard <= this.payload.toc.length) {
        path.unshift(cursor.title);
        cursor = cursor.parentId === null ? undefined : this.tocIndex.byId.get(cursor.parentId);
        guard += 1;
      }
      return {
        tocNodeId: placement,
        title: node?.title ?? placement,
        type: node?.type ?? ('section' as const),
        path,
      };
    });
    return okData(
      {
        concept: entry,
        progress: this.payload.progress.find((p) => p.conceptId === conceptId) ?? null,
        selfReport: this.payload.selfReports.find((p) => p.conceptId === conceptId) ?? null,
        relations,
        prerequisites,
        evidence: this.payload.evidence.filter((e) => e.conceptId === conceptId),
        sources,
        placements,
      },
      1,
    );
  }
}

export function createFixtureMapDataSource(options: { readonly scenario?: MapScenario } = {}): MapDataSource {
  const scenario = options.scenario ?? 'demo';
  const payload = scenario === 'scale' ? buildScalePayload() : demoPayload(scenario);
  return new FixtureMapDataSource(payload);
}

/** Exposed for tests: build the raw payload without the source wrapper. */
export function buildDemoPayload(scenario: MapScenario = 'demo'): MapPayload {
  return demoPayload(scenario);
}
