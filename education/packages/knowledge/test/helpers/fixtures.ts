/**
 * Test helpers.
 *
 * The knowledge package consumes the frozen domain fixtures
 * (`@edu/domain`'s `fixtures/` tree, produced by T01) instead of inventing a
 * second protocol. Only the large synthetic graph needed for the bounded
 * neighborhood measurement and the source catalogue used by the source
 * resolution tests are generated here.
 */

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type {
  ActorKind,
  Concept,
  ConceptProgress,
  ContentPack,
  CoverageSection,
  Relation,
  ReviewLedgerEntry,
  ReviewState,
  SourceBlock,
  SourceRef,
  BookInstance,
  Figure,
  TocNodeLike,
} from '@edu/domain';
import { computeContentHash } from '../../src/content-hash.js';

export const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export const educationRoot = path.resolve(packageRoot, '../..');
export const domainFixturesRoot = path.resolve(educationRoot, 'packages/domain/fixtures');
export const evidenceRoot = path.resolve(educationRoot, '.local/evidence/T04');

export function readFixtureJson<T = unknown>(relative: string): T {
  const full = path.resolve(domainFixturesRoot, relative);
  return JSON.parse(readFileSync(full, 'utf8')) as T;
}

export function readPackFixture(name: string): ContentPack {
  return readFixtureJson<ContentPack>(`packs/${name}`);
}

export function clone<T>(value: T): T {
  return structuredClone(value);
}

export function writeEvidence(fileName: string, data: unknown): string {
  mkdirSync(evidenceRoot, { recursive: true });
  const target = path.resolve(evidenceRoot, fileName);
  writeFileSync(target, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
  return target;
}

/* ------------------------------------------------------------ large graph */

export interface LargePackOptions {
  readonly conceptCount?: number;
  readonly prerequisiteCount?: number;
  readonly relatedCount?: number;
}

const SHA_A = 'a'.repeat(64);

function conceptId(index: number): string {
  return `concept.big${String(index).padStart(4, '0')}`;
}

/**
 * 500 concepts / 1000 relations synthetic pack (06 §6 scale fixture).
 * Every relation is *authored*: no edge is derived from TOC order.
 */
export function buildLargePack(options: LargePackOptions = {}): ContentPack {
  const conceptCount = options.conceptCount ?? 500;
  const prerequisiteCount = options.prerequisiteCount ?? 499;
  const relatedCount = options.relatedCount ?? 501;
  const courseEditionId = 'course.biology-large';
  const sourceRef = 'source.big.p1';
  const sectionCount = Math.ceil(conceptCount / 5);
  const chapters = Math.ceil(sectionCount / 5);

  const toc: TocNodeLike[] = [
    {
      schemaVersion: 1,
      id: 'toc.big.volume',
      courseEditionId,
      parentId: null,
      type: 'volume',
      title: '合成全册',
      order: 0,
      sourceRefs: [sourceRef],
    },
  ];
  const sectionIds: string[] = [];
  for (let chapter = 0; chapter < chapters; chapter += 1) {
    const chapterId = `toc.big.ch${String(chapter).padStart(2, '0')}`;
    toc.push({
      schemaVersion: 1,
      id: chapterId,
      courseEditionId,
      parentId: 'toc.big.volume',
      type: 'chapter',
      title: `第 ${chapter + 1} 章`,
      order: chapter,
      sourceRefs: [sourceRef],
    });
    for (let section = 0; section < 5; section += 1) {
      const sectionId = `${chapterId}.s${section + 1}`;
      if (sectionIds.length >= sectionCount) break;
      sectionIds.push(sectionId);
      toc.push({
        schemaVersion: 1,
        id: sectionId,
        courseEditionId,
        parentId: chapterId,
        type: 'section',
        title: `第 ${chapter + 1} 章 第 ${section + 1} 节`,
        order: section,
        sourceRefs: [sourceRef],
      });
    }
  }

  const concepts: Concept[] = [];
  for (let index = 0; index < conceptCount; index += 1) {
    const placement = sectionIds[Math.min(sectionIds.length - 1, Math.floor(index / 5))] as string;
    concepts.push({
      schemaVersion: 1,
      id: conceptId(index),
      courseEditionId,
      title: `合成概念 ${index}`,
      aliases: [`alias-${index}`, `别名${index}`],
      placements: [placement],
      learningObjectives: [`能说明合成概念 ${index} 的要点`],
      explanation: `合成解释 ${index}（自有 fixture，无教材原文）`,
      misconceptions: [],
      sourceRefs: [sourceRef],
      rubricIds: [],
      activityIds: [],
      reviewState: 'published',
    });
  }

  const relations: Relation[] = [];
  for (let index = 0; index < prerequisiteCount; index += 1) {
    const from = conceptId(index % conceptCount);
    const to = conceptId((index + 1) % conceptCount);
    relations.push({
      schemaVersion: 1,
      id: `relation.big.prereq.${String(index).padStart(4, '0')}`,
      courseEditionId,
      fromConceptId: from,
      toConceptId: to,
      type: 'prerequisite',
      basis: 'pedagogical_inference',
      rationale: '合成 fixture 中的教学顺序假设（非教材依据）',
      sourceRefs: [],
      reviewState: 'published',
    });
  }
  const relatedPairs = new Set<string>();
  let relatedCursor = 0;
  while (relatedPairs.size < relatedCount && relatedCursor < relatedCount * 8) {
    const step = 1 + Math.floor(relatedCursor / conceptCount);
    const left = relatedCursor % conceptCount;
    const right = (left + step) % conceptCount;
    relatedCursor += 1;
    if (left === right) continue;
    const low = Math.min(left, right);
    const high = Math.max(left, right);
    const key = `${low}<->${high}`;
    if (relatedPairs.has(key)) continue;
    relatedPairs.add(key);
    relations.push({
      schemaVersion: 1,
      id: `relation.big.related.${String(relatedPairs.size).padStart(4, '0')}`,
      courseEditionId,
      fromConceptId: conceptId(low),
      toConceptId: conceptId(high),
      type: 'related',
      basis: 'pedagogical_inference',
      rationale: '合成 fixture 中的相关关联',
      sourceRefs: [],
      reviewState: 'published',
    });
  }

  const sections: CoverageSection[] = sectionIds.map((sectionId, index) => {
    const ids = concepts
      .slice(index * 5, index * 5 + 5)
      .map((concept) => concept.id);
    return {
      tocNodeId: sectionId,
      sourceRefs: [sourceRef],
      conceptIds: ids,
      status: 'covered',
      notes: null,
    };
  });

  const pack: Omit<ContentPack, 'contentHash'> = {
    schemaVersion: 1,
    id: 'pack.biology-large',
    version: '1.0.0',
    courseEditionId,
    scope: 'full_volume',
    coverageStatus: 'complete',
    status: 'published',
    toc,
    concepts,
    relations,
    activities: [],
    rubrics: [],
    coverageManifest: {
      schemaVersion: 1,
      courseEditionId,
      generatedAt: '2026-10-01T00:00:00Z',
      targetTocNodeIds: sectionIds,
      sections,
      exclusions: [],
      totals: {
        targetSections: sectionIds.length,
        coveredSections: sections.length,
        conceptCount: concepts.length,
      },
    },
    reviewLedger: [
      {
        schemaVersion: 1,
        id: 'ledger.big.pack',
        entityKind: 'content_pack',
        entityId: 'pack.biology-large',
        from: 'curator_checked',
        to: 'published',
        actorKind: 'human_curator',
        actorLabel: 'synthetic fixture reviewer (not a real expert)',
        checkedAt: '2026-10-02T00:00:00Z',
        scope: 'synthetic scale fixture',
        notes: null,
        evidenceRefs: [],
      },
    ],
  };
  const contentHash = computeContentHash(pack as ContentPack);
  return { ...pack, contentHash } as ContentPack;
}

/** Star shaped pack: one hub concept related to `leaves` other concepts. */
export function buildStarPack(leaves = 40): ContentPack {
  const courseEditionId = 'course.biology-star';
  const sourceRef = 'source.star.p1';
  const toc: TocNodeLike[] = [
    {
      schemaVersion: 1,
      id: 'toc.star.volume',
      courseEditionId,
      parentId: null,
      type: 'volume',
      title: '合成星形',
      order: 0,
      sourceRefs: [sourceRef],
    },
    {
      schemaVersion: 1,
      id: 'toc.star.ch1',
      courseEditionId,
      parentId: 'toc.star.volume',
      type: 'chapter',
      title: '第 1 章',
      order: 0,
      sourceRefs: [sourceRef],
    },
    {
      schemaVersion: 1,
      id: 'toc.star.ch1.s1',
      courseEditionId,
      parentId: 'toc.star.ch1',
      type: 'section',
      title: '第 1 节',
      order: 0,
      sourceRefs: [sourceRef],
    },
  ];
  const concepts: Concept[] = [
    {
      schemaVersion: 1,
      id: 'concept.star.hub',
      courseEditionId,
      title: '中心概念',
      aliases: ['hub'],
      placements: ['toc.star.ch1.s1'],
      learningObjectives: ['中心概念目标'],
      explanation: '合成中心概念',
      misconceptions: [],
      sourceRefs: [sourceRef],
      rubricIds: [],
      activityIds: [],
      reviewState: 'published',
    },
  ];
  const relations: Relation[] = [];
  for (let index = 0; index < leaves; index += 1) {
    const leafId = `concept.star.leaf${String(index).padStart(2, '0')}`;
    concepts.push({
      schemaVersion: 1,
      id: leafId,
      courseEditionId,
      title: `叶子概念 ${index}`,
      aliases: [],
      placements: ['toc.star.ch1.s1'],
      learningObjectives: [`叶子 ${index} 目标`],
      explanation: `合成叶子 ${index}`,
      misconceptions: [],
      sourceRefs: [sourceRef],
      rubricIds: [],
      activityIds: [],
      reviewState: 'published',
    });
    relations.push({
      schemaVersion: 1,
      id: `relation.star.related.${String(index).padStart(2, '0')}`,
      courseEditionId,
      fromConceptId: 'concept.star.hub',
      toConceptId: leafId,
      type: 'related',
      basis: 'pedagogical_inference',
      rationale: '合成星形关联',
      sourceRefs: [],
      reviewState: 'published',
    });
  }
  const pack: Omit<ContentPack, 'contentHash'> = {
    schemaVersion: 1,
    id: 'pack.biology-star',
    version: '1.0.0',
    courseEditionId,
    scope: 'partial',
    coverageStatus: 'partial',
    status: 'published',
    toc,
    concepts,
    relations,
    activities: [],
    rubrics: [],
    coverageManifest: {
      schemaVersion: 1,
      courseEditionId,
      generatedAt: '2026-10-01T00:00:00Z',
      targetTocNodeIds: ['toc.star.ch1.s1'],
      sections: [
        {
          tocNodeId: 'toc.star.ch1.s1',
          sourceRefs: [sourceRef],
          conceptIds: concepts.map((concept) => concept.id),
          status: 'covered',
          notes: null,
        },
      ],
      exclusions: [],
      totals: {
        targetSections: 1,
        coveredSections: 1,
        conceptCount: concepts.length,
      },
    },
    reviewLedger: [
      {
        schemaVersion: 1,
        id: 'ledger.star.pack',
        entityKind: 'content_pack',
        entityId: 'pack.biology-star',
        from: 'curator_checked',
        to: 'published',
        actorKind: 'human_curator',
        actorLabel: 'synthetic fixture reviewer (not a real expert)',
        checkedAt: '2026-10-02T00:00:00Z',
        scope: 'synthetic star fixture',
        notes: null,
        evidenceRefs: [],
      },
    ],
  };
  return { ...pack, contentHash: computeContentHash(pack as ContentPack) } as ContentPack;
}

/* -------------------------------------------------------- source catalog */

export interface SourceCatalogFixture {
  readonly bookInstances: readonly BookInstance[];
  readonly sourceRefs: readonly SourceRef[];
  readonly sourceBlocks: readonly SourceBlock[];
  readonly figures: readonly Figure[];
}

const BASE_BOOK: BookInstance = {
  schemaVersion: 1,
  id: 'book.fixture',
  courseEditionId: 'course.biology-7a',
  originalSha256: SHA_A,
  pageCount: 40,
  managedAssetId: 'asset.book.fixture',
  confirmedMetadata: { title: null, publisher: null, editionLabel: null, confirmedAt: null },
  createdAt: '2026-10-01T00:00:00Z',
};

const OTHER_BOOK: BookInstance = {
  ...BASE_BOOK,
  id: 'book.other',
  courseEditionId: 'course.biology-other',
  pageCount: 10,
  managedAssetId: 'asset.book.other',
};

function ref(
  id: string,
  overrides: Partial<SourceRef> & { readonly bookInstanceId?: string | null },
): SourceRef {
  const bookInstanceId = overrides.bookInstanceId === undefined ? 'book.fixture' : overrides.bookInstanceId;
  return {
    schemaVersion: 1,
    id,
    bookInstanceId,
    baselineSourceId: bookInstanceId === null ? 'baseline.fixture' : null,
    pdfPage: overrides.pdfPage ?? 18,
    printedPage: overrides.printedPage ?? null,
    bbox: overrides.bbox ?? null,
    blockId: overrides.blockId ?? null,
    figureId: overrides.figureId ?? null,
    verification: {
      state: 'machine_matched',
      actorKind: 'ai_static_reviewer',
      checkedAt: '2026-10-02T00:00:00Z',
      notes: 'synthetic source fixture (not a real textbook page)',
    },
  };
}

export function buildSourceCatalogFixture(): SourceCatalogFixture {
  const sourceRefs: SourceRef[] = [
    ref('source.p18', { bbox: { x: 0.1, y: 0.1, width: 0.8, height: 0.8 } }),
    ref('source.p18.text', { blockId: 'block.p18' }),
    ref('source.p18.figure', { figureId: 'figure.p18' }),
    ref('source.p99', { pdfPage: 99 }),
    ref('source.unknown-book', { bookInstanceId: 'book.missing' }),
    ref('source.baseline', { bookInstanceId: null, pdfPage: 3 }),
    ref('source.other.p1', { bookInstanceId: 'book.other', pdfPage: 1 }),
    ref('source.block-missing', { blockId: 'block.missing' }),
    ref('source.figure-missing', { figureId: 'figure.missing' }),
    ref('source.cross-book-block', { blockId: 'block.other' }),
    ref('source.cross-book-figure', { figureId: 'figure.other' }),
  ];
  const sourceBlocks: SourceBlock[] = [
    {
      schemaVersion: 1,
      id: 'block.p18',
      sourceRefId: 'source.p18',
      type: 'paragraph',
      originalText: '合成 fixture 段落（无教材原文）',
      revisedText: null,
      extractionMethod: 'text_layer',
      textConfidence: null,
      reviewState: 'machine_checked',
    },
    {
      schemaVersion: 1,
      id: 'block.other',
      sourceRefId: 'source.other.p1',
      type: 'paragraph',
      originalText: '另一本书的合成段落',
      revisedText: null,
      extractionMethod: 'text_layer',
      textConfidence: null,
      reviewState: 'machine_checked',
    },
  ];
  const figures: Figure[] = [
    {
      schemaVersion: 1,
      id: 'figure.p18',
      sourceRefId: 'source.p18',
      type: 'diagram',
      originalAssetId: 'asset.figure.cell',
      activeAssetId: 'asset.figure.cell',
      caption: '合成细胞示意图',
      extractionMethod: 'manual',
      reviewState: 'machine_checked',
    },
    {
      schemaVersion: 1,
      id: 'figure.other',
      sourceRefId: 'source.other.p1',
      type: 'diagram',
      originalAssetId: 'asset.figure.other',
      activeAssetId: 'asset.figure.other',
      caption: null,
      extractionMethod: 'manual',
      reviewState: 'machine_checked',
    },
  ];
  return {
    bookInstances: [BASE_BOOK, OTHER_BOOK],
    sourceRefs,
    sourceBlocks,
    figures,
  };
}

/* ------------------------------------------------------------- progress */

export function buildSupportedProgress(
  overrides: Partial<ConceptProgress> = {},
): ConceptProgress {
  return {
    schemaVersion: 1,
    learnerId: 'learner.local',
    courseEditionId: 'course.biology-7a',
    packVersion: '1.0.0',
    conceptId: 'concept.cell',
    learning: {
      state: 'completed',
      startedAt: '2026-10-01T00:00:00Z',
      lastCompletedAt: '2026-10-01T01:00:00Z',
    },
    understanding: {
      state: 'supported',
      assessmentId: 'assessment.fixture',
      updatedAt: '2026-10-01T01:00:00Z',
      validity: 'current',
    },
    review: {
      lastCompletedAt: '2026-10-02T00:00:00Z',
      dueAt: '2026-10-09T00:00:00Z',
      activeSessionId: null,
      latestOutcome: 'supported',
      policyVersion: 'review-policy-v1',
    },
    lastPosition: { sessionId: null, activityId: null, cursor: null, updatedAt: null },
    revision: 3,
    ...overrides,
  };
}

/* --------------------------------------------------- H-03 publish review */

export interface CuratorReleaseOptions {
  readonly packActorKind?: ActorKind;
  readonly packFrom?: ReviewState;
  readonly packTo?: ReviewState;
  readonly includeEntityEntries?: boolean;
  readonly entityActorKind?: ActorKind;
}

/**
 * Builds a review-ledger chain for publication tests: every reviewed entity gets
 * a human curator record and the pack gets a curator_checked -> published
 * transition. Options allow constructing the negative cases (AI signer, missing
 * curator step, missing entity records).
 */
export function withCuratorRelease(
  pack: ContentPack,
  options: CuratorReleaseOptions = {},
): ContentPack {
  const ledger: ReviewLedgerEntry[] = [];
  const base = {
    schemaVersion: 1 as const,
    actorLabel: 'synthetic curator record (not a real expert)',
    checkedAt: '2026-10-02T09:00:00Z',
    scope: 'H-03 publish review fixture',
    notes: null,
    evidenceRefs: [] as string[],
  };
  const add = (
    kind: ReviewLedgerEntry['entityKind'],
    entityId: string,
    from: ReviewState | null,
    to: ReviewState,
    actorKind: ActorKind,
  ): void => {
    ledger.push({
      ...base,
      id: `ledger.rework.${kind}.${entityId}`,
      entityKind: kind,
      entityId,
      from,
      to,
      actorKind,
    });
  };
  if (options.includeEntityEntries !== false) {
    const actor = options.entityActorKind ?? 'human_curator';
    for (const concept of pack.concepts) {
      if (concept.reviewState === 'published' || concept.reviewState === 'curator_checked') {
        add('concept', concept.id, 'machine_checked', concept.reviewState, actor);
      }
    }
    for (const relation of pack.relations) {
      if (relation.reviewState === 'published' || relation.reviewState === 'curator_checked') {
        add('relation', relation.id, 'machine_checked', relation.reviewState, actor);
      }
    }
    for (const rubric of pack.rubrics) {
      if (rubric.reviewState === 'published' || rubric.reviewState === 'curator_checked') {
        add('rubric', rubric.id, 'machine_checked', rubric.reviewState, actor);
      }
    }
  }
  const packTo = options.packTo ?? 'published';
  const packFrom = options.packFrom ?? (packTo === 'published' ? 'curator_checked' : 'candidate');
  add('content_pack', pack.id, packFrom, packTo, options.packActorKind ?? 'human_curator');
  return { ...pack, reviewLedger: ledger };
}