#!/usr/bin/env node
/**
 * Builds the pristine JSON fixtures consumed by every later task.
 *
 * The generator is deterministic: run it after editing fixture content, commit
 * the generated JSON. Content hashes are SHA-256 over the same canonical JSON
 * shape implemented in packages/domain/src/canonical.ts; the contract test
 * recomputes them with the domain implementation and node:crypto, so the two
 * implementations cannot silently diverge.
 */

import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const educationRoot = path.resolve(here, '..');
const fixturesRoot = path.join(educationRoot, 'packages', 'domain', 'fixtures');

const SHA_A = 'a'.repeat(64);
const SHA_B = 'b'.repeat(64);
const SHA_C = 'c'.repeat(64);
const SHA_BOOK = '1'.repeat(64);
const HASH_PLACEHOLDER = '__CONTENT_HASH__';

const ids = {
  edition: 'course.biology-7a',
  book: 'book.biology-7a.local',
  learner: 'learner.local.default',
  pack: 'pack.biology-7a',
  tocVolume: 'toc.volume',
  tocChapter1: 'toc.ch1',
  tocChapter2: 'toc.ch2',
  toc1_1: 'toc.ch1.s1',
  toc1_2: 'toc.ch1.s2',
  toc2_1: 'toc.ch2.s1',
  conceptCell: 'concept.cell',
  conceptStructure: 'concept.cell-structure',
  conceptDivision: 'concept.cell-division',
  rubric: 'rubric.cell',
  activityRecall: 'activity.cell-recall',
  activityExplain: 'activity.cell-explain',
  activityLabel: 'activity.cell-label',
  activityTransfer: 'activity.cell-transfer',
  activityRelation: 'activity.cell-relation',
  sourceP18: 'source.p18',
  sourceP19: 'source.p19',
  sourceP20: 'source.p20',
  sourceP26: 'source.p26',
  sourceP27: 'source.p27',
  session: 'session.cell.1',
};

const timestamps = {
  created: '2026-10-01T00:00:00Z',
  checked: '2026-10-02T09:00:00Z',
  now: '2026-10-29T09:00:00Z',
  started: '2026-10-29T08:00:00Z',
  submitted: '2026-10-29T08:10:00Z',
  assessed: '2026-10-29T08:20:00Z',
  reviewLast: '2026-10-27T09:00:00Z',
  reviewDue: '2026-10-28T09:00:00Z',
};

function courseEdition() {
  return {
    schemaVersion: 1,
    id: ids.edition,
    subject: 'biology',
    grade: 7,
    term: 1,
    publisher: 'fixture publisher (not a verified real edition)',
    editionLabel: '2024 grade 7 volume 1 fixture',
    sourceIdentity: {
      verifiedFrom: 'cover',
      notes: 'synthetic fixture; real textbook evidence required by T05/T14',
      sha256: SHA_A,
    },
    status: 'verified',
  };
}

function bookInstance() {
  return {
    schemaVersion: 1,
    id: ids.book,
    courseEditionId: ids.edition,
    originalSha256: SHA_BOOK,
    pageCount: 200,
    managedAssetId: 'asset.book.biology7a',
    confirmedMetadata: {
      title: 'fixture biology book',
      publisher: 'fixture publisher',
      editionLabel: '2024 grade 7 volume 1 fixture',
      confirmedAt: timestamps.created,
    },
    createdAt: timestamps.created,
  };
}

function sourceRef(id, pdfPage, printedPage) {
  return {
    schemaVersion: 1,
    id,
    bookInstanceId: ids.book,
    baselineSourceId: null,
    pdfPage,
    printedPage,
    bbox: null,
    blockId: null,
    figureId: null,
    verification: {
      state: 'human_checked',
      actorKind: 'human_curator',
      checkedAt: timestamps.checked,
      notes: 'fixture source mapping',
    },
  };
}

function sourceBlock() {
  return {
    schemaVersion: 1,
    id: 'block.cell.ocr.1',
    sourceRefId: ids.sourceP18,
    type: 'paragraph',
    originalText: 'fixture OCR original text (kept, never overwritten)',
    revisedText: 'fixture revised text',
    extractionMethod: 'ocr',
    textConfidence: 0.92,
    reviewState: 'curator_checked',
  };
}

function figure() {
  return {
    schemaVersion: 1,
    id: 'figure.cell.1',
    sourceRefId: ids.sourceP26,
    type: 'diagram',
    originalAssetId: 'asset.figure.cell',
    activeAssetId: 'asset.figure.cell',
    caption: 'fixture cell diagram (synthetic)',
    extractionMethod: 'manual',
    reviewState: 'curator_checked',
  };
}

function diagramSpec() {
  return {
    schemaVersion: 1,
    nodes: [
      { id: 'node.cell', label: '细胞', kind: 'structure' },
      { id: 'node.nucleus', label: '细胞核', kind: 'structure' },
    ],
    edges: [],
    labels: [],
    regions: [
      {
        id: 'region.nucleus',
        assetId: 'asset.figure.cell',
        bbox: { x: 0.2, y: 0.2, width: 0.3, height: 0.3 },
        altText: '细胞核所在的区域',
      },
    ],
    altText: 'fixture cell structure diagram with a highlighted nucleus region',
    sourceRefs: [ids.sourceP26],
  };
}

function toc() {
  return [
    {
      schemaVersion: 1,
      id: ids.tocVolume,
      courseEditionId: ids.edition,
      parentId: null,
      type: 'volume',
      title: 'fixture volume',
      order: 0,
      sourceRefs: [ids.sourceP18],
    },
    {
      schemaVersion: 1,
      id: ids.tocChapter1,
      courseEditionId: ids.edition,
      parentId: ids.tocVolume,
      type: 'chapter',
      title: 'fixture chapter 1',
      order: 0,
      sourceRefs: [ids.sourceP18],
    },
    {
      schemaVersion: 1,
      id: ids.tocChapter2,
      courseEditionId: ids.edition,
      parentId: ids.tocVolume,
      type: 'chapter',
      title: 'fixture chapter 2',
      order: 1,
      sourceRefs: [ids.sourceP26],
    },
    {
      schemaVersion: 1,
      id: ids.toc1_1,
      courseEditionId: ids.edition,
      parentId: ids.tocChapter1,
      type: 'section',
      title: 'fixture section 1.1',
      order: 0,
      sourceRefs: [ids.sourceP18],
    },
    {
      schemaVersion: 1,
      id: ids.toc1_2,
      courseEditionId: ids.edition,
      parentId: ids.tocChapter1,
      type: 'section',
      title: 'fixture section 1.2',
      order: 1,
      sourceRefs: [ids.sourceP19],
    },
    {
      schemaVersion: 1,
      id: ids.toc2_1,
      courseEditionId: ids.edition,
      parentId: ids.tocChapter2,
      type: 'section',
      title: 'fixture section 2.1',
      order: 0,
      sourceRefs: [ids.sourceP26],
    },
  ];
}

function concepts(reviewState = 'published') {
  return [
    {
      schemaVersion: 1,
      id: ids.conceptCell,
      courseEditionId: ids.edition,
      title: '细胞',
      aliases: ['cell'],
      placements: [ids.toc1_1, ids.toc2_1],
      learningObjectives: ['能说明细胞是生物体结构和功能的基本单位'],
      explanation: 'fixture explanation: 细胞是生物体结构和功能的基本单位。',
      misconceptions: [
        {
          statement: '所有细胞都一样大',
          correction: '不同细胞形态大小不同',
          sourceRefs: [ids.sourceP18],
        },
      ],
      sourceRefs: [ids.sourceP18],
      rubricIds: [ids.rubric],
      activityIds: [ids.activityRecall, ids.activityExplain, ids.activityLabel],
      reviewState,
    },
    {
      schemaVersion: 1,
      id: ids.conceptStructure,
      courseEditionId: ids.edition,
      title: '细胞结构',
      aliases: [],
      placements: [ids.toc2_1],
      learningObjectives: ['能指出细胞核等结构的位置'],
      explanation: 'fixture explanation: 细胞由细胞膜、细胞质、细胞核等结构组成。',
      misconceptions: [],
      sourceRefs: [ids.sourceP26],
      rubricIds: [ids.rubric],
      activityIds: [ids.activityLabel],
      reviewState,
    },
    {
      schemaVersion: 1,
      id: ids.conceptDivision,
      courseEditionId: ids.edition,
      title: '细胞分裂',
      aliases: [],
      placements: [ids.toc1_2],
      learningObjectives: ['能描述细胞分裂使细胞数目增多'],
      explanation: 'fixture explanation: 细胞分裂使细胞数目增多。',
      misconceptions: [],
      sourceRefs: [ids.sourceP19, ids.sourceP20],
      rubricIds: [ids.rubric],
      activityIds: [ids.activityRelation],
      reviewState,
    },
  ];
}

function relations() {
  return [
    {
      schemaVersion: 1,
      id: 'relation.prereq.cell-structure',
      courseEditionId: ids.edition,
      fromConceptId: ids.conceptCell,
      toConceptId: ids.conceptStructure,
      type: 'prerequisite',
      basis: 'explicit_source',
      rationale: '理解细胞结构前先认识细胞（fixture）',
      sourceRefs: [ids.sourceP19],
      reviewState: 'published',
    },
    {
      schemaVersion: 1,
      id: 'relation.prereq.division',
      courseEditionId: ids.edition,
      fromConceptId: ids.conceptStructure,
      toConceptId: ids.conceptDivision,
      type: 'prerequisite',
      basis: 'pedagogical_inference',
      rationale: 'fixture pedagogical inference, not a textbook dependency claim',
      sourceRefs: [],
      reviewState: 'published',
    },
    {
      schemaVersion: 1,
      id: 'relation.related.cell-division',
      courseEditionId: ids.edition,
      fromConceptId: ids.conceptCell,
      toConceptId: ids.conceptDivision,
      type: 'related',
      basis: 'explicit_source',
      rationale: 'fixture related association',
      sourceRefs: [ids.sourceP20],
      reviewState: 'published',
    },
  ];
}

function rubric(reviewState = 'published') {
  return {
    schemaVersion: 1,
    id: ids.rubric,
    version: '1',
    courseEditionId: ids.edition,
    conceptIds: [ids.conceptCell, ids.conceptStructure, ids.conceptDivision],
    criteria: [
      {
        criterionId: 'criterion.cell.identify',
        description: '能说明细胞是生物体结构和功能的基本单位',
        acceptableEvidence: ['用自己的话解释细胞的作用'],
        commonMisconceptions: ['把所有细胞都当成同样大小'],
        counterExamples: ['认为细胞不是生物体的组成部分'],
        transferItems: ['举例说明不同细胞形态不同'],
        feedbackSourceRefs: [ids.sourceP18],
      },
    ],
    reviewState,
  };
}

function activities() {
  return [
    {
      schemaVersion: 1,
      id: ids.activityRecall,
      version: '1',
      courseEditionId: ids.edition,
      conceptIds: [ids.conceptCell],
      type: 'recall',
      stem: 'fixture recall: 细胞是什么？',
      sourceRefs: [ids.sourceP18],
      renderSpec: null,
      answerSchema: { kind: 'text', maxLength: 500 },
      rubricId: ids.rubric,
      rubricVersion: '1',
      answerDisclosurePolicy: 'after_independent_attempt',
    },
    {
      schemaVersion: 1,
      id: ids.activityExplain,
      version: '1',
      courseEditionId: ids.edition,
      conceptIds: [ids.conceptCell],
      type: 'explain',
      stem: 'fixture explain: 用自己的话说明细胞为什么是基本单位。',
      sourceRefs: [ids.sourceP18],
      renderSpec: null,
      answerSchema: { kind: 'text', maxLength: 2000 },
      rubricId: ids.rubric,
      rubricVersion: '1',
      answerDisclosurePolicy: 'after_independent_attempt',
    },
    {
      schemaVersion: 1,
      id: ids.activityLabel,
      version: '1',
      courseEditionId: ids.edition,
      conceptIds: [ids.conceptCell, ids.conceptStructure],
      type: 'diagram_label',
      stem: 'fixture diagram: 在图中标出细胞核。',
      sourceRefs: [ids.sourceP26],
      renderSpec: diagramSpec(),
      answerSchema: {
        kind: 'diagram_label',
        targets: [{ id: 'target.nucleus', label: '细胞核' }],
      },
      rubricId: ids.rubric,
      rubricVersion: '1',
      answerDisclosurePolicy: 'after_independent_attempt',
    },
    {
      schemaVersion: 1,
      id: ids.activityTransfer,
      version: '1',
      courseEditionId: ids.edition,
      conceptIds: [ids.conceptCell],
      type: 'transfer',
      stem: 'fixture transfer: 举例说明不同细胞形态不同。',
      sourceRefs: [ids.sourceP20],
      renderSpec: null,
      answerSchema: { kind: 'text', maxLength: 2000 },
      rubricId: ids.rubric,
      rubricVersion: '1',
      answerDisclosurePolicy: 'after_independent_attempt',
    },
    {
      schemaVersion: 1,
      id: ids.activityRelation,
      version: '1',
      courseEditionId: ids.edition,
      conceptIds: [ids.conceptDivision],
      type: 'relation',
      stem: 'fixture relation: 连接细胞、细胞结构与细胞分裂。',
      sourceRefs: [ids.sourceP19],
      renderSpec: null,
      answerSchema: {
        kind: 'relation',
        pairs: [
          { fromId: ids.conceptCell, toId: ids.conceptStructure },
          { fromId: ids.conceptStructure, toId: ids.conceptDivision },
        ],
      },
      rubricId: ids.rubric,
      rubricVersion: '1',
      answerDisclosurePolicy: 'after_independent_attempt',
    },
    {
      schemaVersion: 1,
      id: 'activity.cell-choice',
      version: '1',
      courseEditionId: ids.edition,
      conceptIds: [ids.conceptCell],
      type: 'choice',
      stem: 'fixture choice: 下列哪一项是细胞的基本结构？',
      sourceRefs: [ids.sourceP18],
      renderSpec: null,
      answerSchema: {
        kind: 'choice',
        selection: 'single',
        options: [
          { id: 'option.a', label: '细胞核' },
          { id: 'option.b', label: '书本' },
        ],
        correctOptionIds: null,
      },
      rubricId: ids.rubric,
      rubricVersion: '1',
      answerDisclosurePolicy: 'after_independent_attempt',
    },
  ];
}

const coverageTargets = [ids.toc1_1, ids.toc1_2, ids.toc2_1];

function coverageManifest(coverageStatus = 'partial') {
  const sections =
    coverageStatus === 'complete'
      ? [
          {
            tocNodeId: ids.toc1_1,
            sourceRefs: [ids.sourceP18],
            conceptIds: [ids.conceptCell],
            status: 'covered',
            notes: null,
          },
          {
            tocNodeId: ids.toc1_2,
            sourceRefs: [ids.sourceP19],
            conceptIds: [ids.conceptDivision],
            status: 'covered',
            notes: null,
          },
          {
            tocNodeId: ids.toc2_1,
            sourceRefs: [ids.sourceP26],
            conceptIds: [ids.conceptCell, ids.conceptStructure],
            status: 'covered',
            notes: null,
          },
        ]
      : [
          {
            tocNodeId: ids.toc1_1,
            sourceRefs: [ids.sourceP18],
            conceptIds: [ids.conceptCell],
            status: 'covered',
            notes: null,
          },
          {
            tocNodeId: ids.toc1_2,
            sourceRefs: [ids.sourceP19],
            conceptIds: [ids.conceptDivision],
            status: 'partial',
            notes: 'fixture partial coverage',
          },
          {
            tocNodeId: ids.toc2_1,
            sourceRefs: [ids.sourceP26],
            conceptIds: [ids.conceptCell, ids.conceptStructure],
            status: 'blocked',
            notes: 'fixture blocked section',
          },
        ];
  return {
    schemaVersion: 1,
    courseEditionId: ids.edition,
    generatedAt: timestamps.created,
    targetTocNodeIds: coverageTargets,
    sections,
    exclusions: [
      {
        item: 'fixture textbook images',
        reason: 'fixtures never include real textbook images or text',
        sourceRefs: [],
      },
    ],
    totals: {
      targetSections: coverageTargets.length,
      coveredSections:
        coverageStatus === 'complete' ? coverageTargets.length : 1,
      conceptCount: 3,
    },
  };
}

function reviewLedger(packStatus, version) {
  const base = [
    {
      schemaVersion: 1,
      id: 'ledger.concept.cell',
      entityKind: 'concept',
      entityId: ids.conceptCell,
      from: 'machine_checked',
      to: 'published',
      actorKind: 'human_curator',
      actorLabel: 'fixture reviewer (not a real expert)',
      checkedAt: timestamps.checked,
      scope: 'fixture concept review',
      notes: null,
      evidenceRefs: [],
    },
    {
      schemaVersion: 1,
      id: 'ledger.concept.structure',
      entityKind: 'concept',
      entityId: ids.conceptStructure,
      from: 'machine_checked',
      to: 'published',
      actorKind: 'human_curator',
      actorLabel: 'fixture reviewer (not a real expert)',
      checkedAt: timestamps.checked,
      scope: 'fixture concept review',
      notes: null,
      evidenceRefs: [],
    },
    {
      schemaVersion: 1,
      id: 'ledger.concept.division',
      entityKind: 'concept',
      entityId: ids.conceptDivision,
      from: 'machine_checked',
      to: 'published',
      actorKind: 'human_curator',
      actorLabel: 'fixture reviewer (not a real expert)',
      checkedAt: timestamps.checked,
      scope: 'fixture concept review',
      notes: null,
      evidenceRefs: [],
    },
    {
      schemaVersion: 1,
      id: 'ledger.rubric.cell',
      entityKind: 'rubric',
      entityId: ids.rubric,
      from: 'machine_checked',
      to: 'published',
      actorKind: 'human_curator',
      actorLabel: 'fixture reviewer (not a real expert)',
      checkedAt: timestamps.checked,
      scope: 'fixture rubric review',
      notes: null,
      evidenceRefs: [],
    },
  ];
  return [
    {
      schemaVersion: 1,
      id: 'ledger.pack',
      entityKind: 'content_pack',
      entityId: ids.pack,
      from: packStatus === 'published' ? 'curator_checked' : 'machine_checked',
      to: packStatus,
      actorKind: packStatus === 'published' ? 'human_curator' : 'ai_static_reviewer',
      actorLabel: 'fixture reviewer (not a real expert)',
      checkedAt: timestamps.checked,
      scope: 'fixture scope review',
      notes: null,
      evidenceRefs: [],
    },
    ...base,
  ];
}

function pack(overrides = {}) {
  const base = {
    schemaVersion: 1,
    id: ids.pack,
    version: '1.0.0',
    courseEditionId: ids.edition,
    scope: 'partial',
    coverageStatus: 'partial',
    status: 'published',
    contentHash: HASH_PLACEHOLDER,
    toc: toc(),
    concepts: concepts(),
    relations: relations(),
    activities: activities(),
    rubrics: [rubric()],
    coverageManifest: coverageManifest('partial'),
    reviewLedger: reviewLedger('published', '1.0.0'),
  };
  return { ...base, ...overrides };
}

function fullPack() {
  return pack({
    version: '1.1.0',
    scope: 'full_volume',
    coverageStatus: 'complete',
    coverageManifest: coverageManifest('complete'),
  });
}

function candidatePack() {
  return pack({
    version: '0.9.0-candidate',
    status: 'candidate',
    concepts: concepts('machine_checked'),
    reviewState: undefined,
    relations: relations().map((relation) => ({ ...relation, reviewState: 'machine_checked' })),
    rubrics: [rubric('machine_checked')],
    reviewLedger: [
      {
        schemaVersion: 1,
        id: 'ledger.candidate.pack',
        entityKind: 'content_pack',
        entityId: ids.pack,
        from: null,
        to: 'candidate',
        actorKind: 'ai_static_reviewer',
        actorLabel: 'fixture machine check',
        checkedAt: timestamps.checked,
        scope: 'candidate fixture',
        notes: null,
        evidenceRefs: [],
      },
    ],
  });
}

function deepClone(value) {
  return JSON.parse(JSON.stringify(value));
}

function invalidSelfLoop() {
  const target = pack();
  target.relations.push({
    ...deepClone(target.relations[0]),
    id: 'relation.invalid.self-loop',
    fromConceptId: ids.conceptCell,
    toConceptId: ids.conceptCell,
  });
  return target;
}

function invalidPrereqCycle() {
  const target = pack();
  target.relations.push({
    schemaVersion: 1,
    id: 'relation.invalid.cycle',
    courseEditionId: ids.edition,
    fromConceptId: ids.conceptDivision,
    toConceptId: ids.conceptCell,
    type: 'prerequisite',
    basis: 'explicit_source',
    rationale: 'fixture cycle',
    sourceRefs: [ids.sourceP19],
    reviewState: 'published',
  });
  return target;
}

function invalidDanglingPlacement() {
  const target = pack();
  target.concepts[0].placements.push('toc.missing');
  return target;
}

function invalidDuplicateId() {
  const target = pack();
  target.concepts.push(deepClone(target.concepts[0]));
  return target;
}

function invalidSchemaVersion() {
  const target = pack();
  target.schemaVersion = 2;
  return target;
}

function invalidRelatedOrder() {
  const target = pack();
  target.relations.push({
    ...deepClone(target.relations[2]),
    id: 'relation.invalid.related-order',
    fromConceptId: ids.conceptDivision,
    toConceptId: ids.conceptCell,
  });
  return target;
}

function invalidPartialComplete() {
  return pack({ coverageStatus: 'complete', coverageManifest: coverageManifest('complete') });
}

function invalidUnknownField() {
  const target = pack();
  target.unexpectedKey = true;
  return target;
}

function invalidDanglingRubric() {
  const target = pack();
  target.activities[0].rubricId = 'rubric.missing';
  return target;
}

function invalidPublishedMissingSource() {
  const target = pack();
  target.concepts[0].sourceRefs = [];
  return target;
}

function invalidContentHash() {
  return pack({ contentHash: '0'.repeat(64) });
}

function invalidTocCycle() {
  const target = pack();
  target.toc.find((node) => node.id === ids.tocChapter2).parentId = ids.tocChapter2;
  return target;
}

function invalidTocOrphan() {
  const target = pack();
  target.toc.find((node) => node.id === ids.tocChapter2).parentId = 'toc.missing';
  return target;
}

function invalidFullPartial() {
  return pack({
    version: '1.2.0',
    scope: 'full_volume',
    coverageStatus: 'partial',
    coverageManifest: coverageManifest('partial'),
  });
}

function validSession(status = 'active') {
  return {
    schemaVersion: 1,
    id: ids.session,
    learnerId: ids.learner,
    courseEditionId: ids.edition,
    packVersion: '1.0.0',
    trustMode: 'published',
    conceptId: ids.conceptCell,
    mode: 'learn',
    status,
    startedAt: timestamps.started,
    endedAt: status === 'active' ? null : '2026-10-29T08:30:00Z',
    resumeCursor: { activityId: ids.activityRecall, cursor: 'step-1' },
    dshSessionId: null,
  };
}

function attempt(kind, helpUsed = []) {
  const suffix = kind === 'explain' ? 'explain' : 'transfer';
  return {
    schemaVersion: 1,
    id: `attempt.cell.${suffix}`,
    requestId: `request.attempt.${suffix}`,
    learnerId: ids.learner,
    sessionId: ids.session,
    courseEditionId: ids.edition,
    packVersion: '1.0.0',
    activityId: kind === 'explain' ? ids.activityExplain : ids.activityTransfer,
    activityVersion: '1',
    conceptIds: [ids.conceptCell],
    inputType: 'text',
    answerAssetId: null,
    answerText:
      kind === 'explain'
        ? 'fixture answer: 细胞是生物体结构和功能的基本单位，所以是基本单位。'
        : 'fixture answer: 例如神经细胞和红细胞形态不同。',
    submittedAt: timestamps.submitted,
    helpUsed,
    evidenceIds: [`evidence.cell.${suffix}`],
  };
}

function evidence(kind, assistance = 'unassisted') {
  const suffix = kind === 'explain' ? 'explain' : 'transfer';
  return {
    schemaVersion: 1,
    id: `evidence.cell.${suffix}`,
    attemptId: `attempt.cell.${suffix}`,
    learnerId: ids.learner,
    courseEditionId: ids.edition,
    packVersion: '1.0.0',
    conceptId: ids.conceptCell,
    kind,
    observation:
      kind === 'explain'
        ? 'fixture observation: explained the cell as the basic unit'
        : 'fixture observation: transferred the idea to different cell shapes',
    criterionResults: [{ criterionId: 'criterion.cell.identify', result: 'met', note: null }],
    assistance,
    sourceRefs: [ids.sourceP18],
    assessmentOrigin: 'rule',
    modelRunId: null,
    uncertainty: null,
    validity: 'current',
    createdAt: timestamps.submitted,
  };
}

function assessment(overrides = {}) {
  return {
    schemaVersion: 1,
    id: 'assessment.cell.supported',
    attemptId: 'attempt.cell.explain',
    conceptId: ids.conceptCell,
    learnerId: ids.learner,
    courseEditionId: ids.edition,
    packVersion: '1.0.0',
    state: 'supported',
    rationale: 'fixture rationale: explanation plus transfer evidence',
    evidenceIds: ['evidence.cell.explain', 'evidence.cell.transfer'],
    rubricVersion: '1',
    evaluatorVersion: 'rule-v1',
    assessedAt: timestamps.assessed,
    validity: 'current',
    revision: 1,
    ...overrides,
  };
}

function progress(overrides = {}) {
  const base = {
    schemaVersion: 1,
    learnerId: ids.learner,
    courseEditionId: ids.edition,
    packVersion: '1.0.0',
    conceptId: ids.conceptCell,
    learning: {
      state: 'completed',
      startedAt: timestamps.started,
      lastCompletedAt: timestamps.submitted,
    },
    understanding: {
      state: 'supported',
      assessmentId: 'assessment.cell.supported',
      updatedAt: timestamps.assessed,
      validity: 'current',
    },
    review: {
      lastCompletedAt: timestamps.reviewLast,
      dueAt: timestamps.reviewDue,
      activeSessionId: null,
      latestOutcome: 'developing',
      policyVersion: 'review-policy-v1',
    },
    lastPosition: {
      sessionId: ids.session,
      activityId: ids.activityRecall,
      cursor: 'step-1',
      updatedAt: timestamps.started,
    },
    revision: 3,
  };
  return { ...base, ...overrides };
}

function selfReport() {
  return {
    schemaVersion: 1,
    id: 'self-report.cell.1',
    learnerId: ids.learner,
    courseEditionId: ids.edition,
    packVersion: '1.0.0',
    conceptId: ids.conceptCell,
    claimedState: 'can_explain',
    createdAt: timestamps.now,
  };
}

function importJob(overrides = {}) {
  return {
    schemaVersion: 1,
    id: 'import.job.1',
    requestId: 'request.import.1',
    sha256: SHA_C,
    stage: 'await_review',
    status: 'running',
    checkpoint: {
      stage: 'await_review',
      lastCompletedUnit: 42,
      parserCacheKey: 'pdf-parser-v1|sha256:c',
    },
    completedUnits: 42,
    totalUnits: 42,
    error: null,
    retryable: true,
    parserVersion: 'pdf-parser-v1',
    modelVersion: 'fixture-model-v0',
    costUsage: { calls: 0, inputTokens: 0, outputTokens: 0, estimatedCostUsd: 0 },
    createdAt: timestamps.created,
    updatedAt: timestamps.now,
    ...overrides,
  };
}

function compatibilityMap(overrides = {}) {
  const base = {
    schemaVersion: 1,
    id: 'compatibility.1.0.0-to-1.1.0',
    courseEditionId: ids.edition,
    fromPackVersion: '1.0.0',
    toPackVersion: '1.1.0',
    fromContentHash: SHA_A,
    toContentHash: SHA_B,
    mappings: [
      {
        fromConceptId: ids.conceptCell,
        toConceptIds: [ids.conceptCell],
        kind: 'unchanged',
        rationale: 'fixture unchanged mapping',
        review: {
          verified: false,
          actorKind: null,
          checkedAt: null,
          notes: 'fixture unverified mapping',
        },
        evidenceEffect: 'stale',
      },
    ],
    createdAt: timestamps.checked,
  };
  return { ...base, ...overrides };
}

function journalCommits() {
  const effect = (revision) => [
    { kind: 'progress.changed', targetId: 'progress.cell', revision },
  ];
  return [
    {
      schemaVersion: 1,
      eventId: 'event.1',
      requestId: 'request.duplicate',
      seq: 1,
      occurredAt: '2026-10-29T08:00:00Z',
      learnerId: ids.learner,
      type: 'attempt.submitted',
      payload: { attemptId: 'attempt.journal.1' },
      effects: effect(1),
    },
    {
      schemaVersion: 1,
      eventId: 'event.2',
      requestId: 'request.duplicate',
      seq: 2,
      occurredAt: '2026-10-29T08:01:00Z',
      learnerId: ids.learner,
      type: 'assessment.committed',
      payload: { attemptId: 'attempt.journal.1', graderVersion: 'rule-v1' },
      effects: effect(2),
    },
    {
      schemaVersion: 1,
      eventId: 'event.3',
      requestId: 'request.unique',
      seq: 3,
      occurredAt: '2026-10-29T08:02:00Z',
      learnerId: ids.learner,
      type: 'review.completed',
      payload: { outcome: 'developing' },
      effects: effect(3),
    },
  ];
}

function stableStringify(value) {
  const sort = (input) => {
    if (Array.isArray(input)) return input.map(sort);
    if (input !== null && typeof input === 'object') {
      const sorted = {};
      for (const key of Object.keys(input).sort()) {
        if (input[key] !== undefined) sorted[key] = sort(input[key]);
      }
      return sorted;
    }
    return input;
  };
  return JSON.stringify(sort(value));
}

function contentHash(packValue) {
  const canonical = {
    schemaVersion: packValue.schemaVersion,
    id: packValue.id,
    version: packValue.version,
    courseEditionId: packValue.courseEditionId,
    scope: packValue.scope,
    coverageStatus: packValue.coverageStatus,
    toc: packValue.toc,
    concepts: packValue.concepts,
    relations: packValue.relations,
    activities: packValue.activities,
    rubrics: packValue.rubrics,
    coverageManifest: packValue.coverageManifest,
  };
  return createHash('sha256').update(stableStringify(canonical), 'utf8').digest('hex');
}

function writeJson(relativePath, value) {
  const fullPath = path.join(fixturesRoot, relativePath);
  mkdirSync(path.dirname(fullPath), { recursive: true });
  writeFileSync(fullPath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function writeText(relativePath, text) {
  const fullPath = path.join(fixturesRoot, relativePath);
  mkdirSync(path.dirname(fullPath), { recursive: true });
  writeFileSync(fullPath, text, 'utf8');
}

function main() {
  const cases = [];
  const writePack = (id, file, packValue, expect) => {
    packValue.contentHash = contentHash(packValue);
    writeJson(file, packValue);
    cases.push({ id, kind: 'contentPack', file, expect });
  };

  writePack('pack.valid.partial', 'packs/valid-partial.json', pack(), { ok: true });
  writePack('pack.valid.full', 'packs/valid-full.json', fullPack(), { ok: true });
  writePack('pack.valid.candidate', 'packs/valid-candidate.json', candidatePack(), { ok: true });
  cases.push({
    id: 'pack.hash.partial',
    kind: 'contentHash',
    file: 'packs/valid-partial.json',
    expect: { matches: true },
  });
  cases.push({
    id: 'pack.hash.full',
    kind: 'contentHash',
    file: 'packs/valid-full.json',
    expect: { matches: true },
  });
  cases.push({
    id: 'pack.hash.candidate',
    kind: 'contentHash',
    file: 'packs/valid-candidate.json',
    expect: { matches: true },
  });

  const invalidPacks = [
    ['pack.invalid.self-loop', 'packs/invalid-self-loop.json', invalidSelfLoop, ['RELATION_SELF_LOOP']],
    ['pack.invalid.prereq-cycle', 'packs/invalid-prereq-cycle.json', invalidPrereqCycle, ['RELATION_CYCLE']],
    ['pack.invalid.dangling-placement', 'packs/invalid-dangling-placement.json', invalidDanglingPlacement, ['DANGLING_REFERENCE']],
    ['pack.invalid.duplicate-id', 'packs/invalid-duplicate-id.json', invalidDuplicateId, ['DUPLICATE_ID']],
    ['pack.invalid.schema-version', 'packs/invalid-schema-version.json', invalidSchemaVersion, ['SCHEMA_VERSION_MISMATCH']],
    ['pack.invalid.related-order', 'packs/invalid-related-order.json', invalidRelatedOrder, ['RELATION_ENDPOINT_ORDER']],
    ['pack.invalid.partial-complete', 'packs/invalid-partial-complete.json', invalidPartialComplete, ['PACK_SCOPE_INVALID']],
    ['pack.invalid.unknown-field', 'packs/invalid-unknown-field.json', invalidUnknownField, ['UNKNOWN_FIELD']],
    ['pack.invalid.dangling-rubric', 'packs/invalid-dangling-rubric.json', invalidDanglingRubric, ['DANGLING_REFERENCE']],
    ['pack.invalid.published-missing-source', 'packs/invalid-published-missing-source.json', invalidPublishedMissingSource, ['MISSING_SOURCE']],
    ['pack.invalid.toc-cycle', 'packs/invalid-toc-cycle.json', invalidTocCycle, ['TOC_CYCLE']],
    ['pack.invalid.toc-orphan', 'packs/invalid-toc-orphan.json', invalidTocOrphan, ['TOC_ORPHAN']],
    ['pack.invalid.full-partial', 'packs/invalid-full-partial.json', invalidFullPartial, ['COVERAGE_INCOMPLETE']],
  ];
  for (const [id, file, build, errorCodes] of invalidPacks) {
    writePack(id, file, build(), { ok: false, errorCodes });
  }
  writeJson('packs/invalid-content-hash.json', invalidContentHash());
  cases.push({
    id: 'pack.invalid.content-hash',
    kind: 'contentPack',
    file: 'packs/invalid-content-hash.json',
    expect: { ok: true },
  });
  cases.push({
    id: 'pack.hash.mismatch',
    kind: 'contentHash',
    file: 'packs/invalid-content-hash.json',
    expect: { matches: false },
  });

  writeJson('entities/course-edition.json', courseEdition());
  cases.push({ id: 'entity.course-edition', kind: 'courseEdition', file: 'entities/course-edition.json', expect: { ok: true } });
  writeJson('entities/book-instance.json', bookInstance());
  cases.push({ id: 'entity.book-instance', kind: 'bookInstance', file: 'entities/book-instance.json', expect: { ok: true } });
  writeJson('entities/source-ref.json', sourceRef(ids.sourceP18, 18, '12'));
  cases.push({ id: 'entity.source-ref', kind: 'sourceRef', file: 'entities/source-ref.json', expect: { ok: true } });
  writeJson('entities/source-ref-unknown-printed-page.json', sourceRef(ids.sourceP27, 27, null));
  cases.push({
    id: 'entity.source-ref.unknown-printed-page',
    kind: 'sourceRef',
    file: 'entities/source-ref-unknown-printed-page.json',
    expect: { ok: true },
  });
  writeJson('entities/source-ref-invalid-page.json', sourceRef('source.invalid', 0, '1'));
  cases.push({
    id: 'entity.source-ref.invalid-page',
    kind: 'sourceRef',
    file: 'entities/source-ref-invalid-page.json',
    expect: { ok: false, errorCodes: ['INVALID_NUMBER'] },
  });
  const missingPrintedPage = deepClone(sourceRef('source.invalid.printed-page', 18, '12'));
  delete missingPrintedPage.printedPage;
  writeJson('entities/source-ref-missing-printed-page.json', missingPrintedPage);
  cases.push({
    id: 'entity.source-ref.missing-printed-page',
    kind: 'sourceRef',
    file: 'entities/source-ref-missing-printed-page.json',
    expect: { ok: false, errorCodes: ['MISSING_FIELD'] },
  });
  writeJson('entities/source-block.json', sourceBlock());
  cases.push({ id: 'entity.source-block', kind: 'sourceBlock', file: 'entities/source-block.json', expect: { ok: true } });
  writeJson('entities/figure.json', figure());
  cases.push({ id: 'entity.figure', kind: 'figure', file: 'entities/figure.json', expect: { ok: true } });
  writeJson('entities/learner.json', {
    schemaVersion: 1,
    id: ids.learner,
    createdAt: timestamps.created,
  });
  cases.push({ id: 'entity.learner', kind: 'learner', file: 'entities/learner.json', expect: { ok: true } });

  writeJson('sessions/active.json', validSession('active'));
  cases.push({ id: 'session.active', kind: 'session', file: 'sessions/active.json', expect: { ok: true } });
  writeJson('sessions/completed.json', validSession('completed'));
  cases.push({ id: 'session.completed', kind: 'session', file: 'sessions/completed.json', expect: { ok: true } });
  writeJson('sessions/invalid-active-ended.json', { ...validSession('active'), endedAt: '2026-10-29T08:30:00Z' });
  cases.push({
    id: 'session.invalid-active-ended',
    kind: 'session',
    file: 'sessions/invalid-active-ended.json',
    expect: { ok: false, errorCodes: ['SESSION_STATE_INVALID'] },
  });

  const unassisted = attempt('explain');
  const assisted = attempt('transfer', [{ kind: 'answer', usedAt: timestamps.submitted }]);
  writeJson('attempts/unassisted.json', unassisted);
  cases.push({ id: 'attempt.unassisted', kind: 'attempt', file: 'attempts/unassisted.json', expect: { ok: true, assistance: 'unassisted' } });
  writeJson('attempts/assisted.json', assisted);
  cases.push({ id: 'attempt.assisted', kind: 'attempt', file: 'attempts/assisted.json', expect: { ok: true, assistance: 'assisted' } });
  const invalidAnswer = deepClone(unassisted);
  invalidAnswer.answerText = null;
  writeJson('attempts/invalid-answer.json', invalidAnswer);
  cases.push({
    id: 'attempt.invalid-answer',
    kind: 'attempt',
    file: 'attempts/invalid-answer.json',
    expect: { ok: false, errorCodes: ['ATTEMPT_ANSWER_INVALID'] },
  });

  writeJson('evidence/unassisted.json', evidence('explain'));
  cases.push({ id: 'evidence.unassisted', kind: 'evidence', file: 'evidence/unassisted.json', expect: { ok: true } });
  writeJson('evidence/assisted.json', evidence('transfer', 'assisted'));
  cases.push({ id: 'evidence.assisted', kind: 'evidence', file: 'evidence/assisted.json', expect: { ok: true } });

  const evidenceExplain = evidence('explain');
  const evidenceTransfer = evidence('transfer');
  const attemptExplain = attempt('explain');
  const attemptTransfer = attempt('transfer');
  writeJson('assessments/supported-valid.json', {
    assessment: assessment(),
    evidences: [evidenceExplain, evidenceTransfer],
    attempts: [attemptExplain, attemptTransfer],
  });
  cases.push({
    id: 'assessment.supported.valid',
    kind: 'assessmentBundle',
    file: 'assessments/supported-valid.json',
    expect: { ok: true, state: 'supported' },
  });
  writeJson('assessments/supported-insufficient.json', {
    assessment: assessment({ evidenceIds: ['evidence.cell.explain'] }),
    evidences: [evidenceExplain],
    attempts: [attemptExplain],
  });
  cases.push({
    id: 'assessment.supported.insufficient',
    kind: 'assessmentBundle',
    file: 'assessments/supported-insufficient.json',
    expect: { ok: false, errorCodes: ['ASSESSMENT_WITHOUT_EVIDENCE'] },
  });
  const counterTransfer = deepClone(evidenceTransfer);
  counterTransfer.criterionResults = [
    { criterionId: 'criterion.cell.identify', result: 'not_met', note: null },
  ];
  writeJson('assessments/supported-counter-evidence.json', {
    assessment: assessment(),
    evidences: [evidenceExplain, counterTransfer],
    attempts: [attemptExplain, attemptTransfer],
  });
  cases.push({
    id: 'assessment.supported.counter-evidence',
    kind: 'assessmentBundle',
    file: 'assessments/supported-counter-evidence.json',
    expect: { ok: false, errorCodes: ['ASSESSMENT_COUNTER_EVIDENCE'] },
  });
  writeJson('assessments/candidate-supported.json', {
    assessment: assessment(),
    session: { ...validSession('active'), trustMode: 'candidate' },
  });
  cases.push({
    id: 'assessment.candidate-supported',
    kind: 'assessmentForSession',
    file: 'assessments/candidate-supported.json',
    expect: { ok: false, errorCodes: ['CANDIDATE_STRONG_CLAIM'] },
  });
  writeJson('assessments/pending-supported.json', assessment({ validity: 'pending' }));
  cases.push({
    id: 'assessment.pending-supported',
    kind: 'assessment',
    file: 'assessments/pending-supported.json',
    expect: { ok: false, errorCodes: ['LOW_CONFIDENCE_UPGRADE'] },
  });

  writeJson('progress/reviewed-and-due.json', progress());
  cases.push({
    id: 'progress.reviewed-and-due',
    kind: 'progress',
    file: 'progress/reviewed-and-due.json',
    expect: { ok: true, everReviewed: true, isDue: true, now: timestamps.now },
  });
  writeJson(
    'progress/learned-needs-support.json',
    progress({
      understanding: {
        state: 'needs_support',
        assessmentId: 'assessment.cell.needs-support',
        updatedAt: timestamps.assessed,
        validity: 'current',
      },
    }),
  );
  cases.push({
    id: 'progress.learned-needs-support',
    kind: 'progress',
    file: 'progress/learned-needs-support.json',
    expect: { ok: true, state: 'needs_support' },
  });
  writeJson(
    'progress/no-evidence.json',
    progress({
      learning: { state: 'not_started', startedAt: null, lastCompletedAt: null },
      understanding: {
        state: 'unassessed',
        assessmentId: null,
        updatedAt: null,
        validity: 'current',
      },
      review: {
        lastCompletedAt: null,
        dueAt: null,
        activeSessionId: null,
        latestOutcome: null,
        policyVersion: 'review-policy-v1',
      },
      lastPosition: { sessionId: null, activityId: null, cursor: null, updatedAt: null },
      revision: 0,
    }),
  );
  cases.push({
    id: 'progress.no-evidence',
    kind: 'progress',
    file: 'progress/no-evidence.json',
    expect: { ok: true, state: 'unassessed' },
  });
  writeJson(
    'progress/invalid-supported-stale.json',
    progress({
      understanding: {
        state: 'supported',
        assessmentId: 'assessment.cell.stale',
        updatedAt: timestamps.assessed,
        validity: 'stale',
      },
    }),
  );
  cases.push({
    id: 'progress.invalid-supported-stale',
    kind: 'progress',
    file: 'progress/invalid-supported-stale.json',
    expect: { ok: false, errorCodes: ['PROGRESS_INVARIANT'] },
  });

  writeJson('self-reports/cell.json', selfReport());
  cases.push({ id: 'self-report.valid', kind: 'selfReport', file: 'self-reports/cell.json', expect: { ok: true } });

  writeJson('import/await-review.json', importJob());
  cases.push({ id: 'import.await-review', kind: 'importJob', file: 'import/await-review.json', expect: { ok: true } });
  writeJson('import/cancel-late-result.json', {
    job: importJob({ status: 'cancelled', stage: 'extract', checkpoint: { stage: 'extract', lastCompletedUnit: 10, parserCacheKey: null }, completedUnits: 10, updatedAt: timestamps.now }),
    update: { stage: 'concepts', status: 'running', completedUnits: 20, updatedAt: timestamps.now },
  });
  cases.push({
    id: 'import.cancel-late-result',
    kind: 'importTransition',
    file: 'import/cancel-late-result.json',
    expect: { ok: false, errorCodes: ['IMPORT_LATE_RESULT'] },
  });
  writeJson('import/invalid-completed-await-review.json', importJob({ status: 'completed' }));
  cases.push({
    id: 'import.invalid-completed-await-review',
    kind: 'importJob',
    file: 'import/invalid-completed-await-review.json',
    expect: { ok: false, errorCodes: ['IMPORT_INVARIANT'] },
  });

  writeJson('compatibility/rename-unverified.json', {
    map: compatibilityMap(),
    expectProjection: {
      reason: 'compatibility_unverified',
      carryLearningHistory: false,
      staleEvidence: true,
    },
  });
  cases.push({
    id: 'compatibility.rename-unverified',
    kind: 'compatibility',
    file: 'compatibility/rename-unverified.json',
    expect: {
      ok: true,
      projectionReason: 'compatibility_unverified',
      carryLearningHistory: false,
      staleEvidence: true,
    },
  });
  writeJson('compatibility/rename-verified.json', {
    map: compatibilityMap({
      mappings: [
        {
          fromConceptId: ids.conceptCell,
          toConceptIds: [ids.conceptCell],
          kind: 'unchanged',
          rationale: 'fixture verified unchanged mapping',
          review: {
            verified: true,
            actorKind: 'human_curator',
            checkedAt: timestamps.checked,
            notes: 'fixture verification record',
          },
          evidenceEffect: 'inherit',
        },
      ],
    }),
    expectProjection: {
      reason: 'requires_current_pack_evidence',
      carryLearningHistory: true,
      staleEvidence: false,
    },
  });
  cases.push({
    id: 'compatibility.rename-verified',
    kind: 'compatibility',
    file: 'compatibility/rename-verified.json',
    expect: {
      ok: true,
      projectionReason: 'requires_current_pack_evidence',
      carryLearningHistory: true,
      staleEvidence: false,
    },
  });
  writeJson('compatibility/rubric-changed-verified.json', {
    map: compatibilityMap({
      mappings: [
        {
          fromConceptId: ids.conceptCell,
          toConceptIds: [ids.conceptCell],
          kind: 'rubric_changed',
          rationale: 'fixture rubric change',
          review: {
            verified: true,
            actorKind: 'human_curator',
            checkedAt: timestamps.checked,
            notes: 'fixture verification record',
          },
          evidenceEffect: 'recheck',
        },
      ],
    }),
    expectProjection: {
      reason: 'evidence_stale',
      carryLearningHistory: false,
      staleEvidence: true,
    },
  });
  cases.push({
    id: 'compatibility.rubric-changed-verified',
    kind: 'compatibility',
    file: 'compatibility/rubric-changed-verified.json',
    expect: {
      ok: true,
      projectionReason: 'evidence_stale',
      carryLearningHistory: false,
      staleEvidence: true,
    },
  });

  writeJson('grade/unclear-image.json', {
    schemaVersion: 1,
    attemptId: 'attempt.image.1',
    criteria: [
      {
        criterionId: 'criterion.cell.identify',
        met: 'unclear',
        rationale: 'fixture image is too blurry to judge',
      },
    ],
    feedback: 'fixture feedback: 图片无法辨认，请重传或改用文字描述。',
    uncertainties: ['image blurry'],
    evidenceCandidates: [],
    requiresClarification: true,
    sourceRefs: [ids.sourceP18],
    graderVersion: 'rule-v1',
  });
  cases.push({ id: 'grade.unclear-image', kind: 'grade', file: 'grade/unclear-image.json', expect: { ok: true, requiresClarification: true } });
  writeJson('grade/invalid-clarification-with-evidence.json', {
    schemaVersion: 1,
    attemptId: 'attempt.image.1',
    criteria: [
      {
        criterionId: 'criterion.cell.identify',
        met: 'unclear',
        rationale: 'fixture unclear',
      },
    ],
    feedback: 'fixture feedback',
    uncertainties: ['image blurry'],
    evidenceCandidates: [
      {
        conceptId: ids.conceptCell,
        kind: 'label',
        observation: 'fixture guessed label',
        criterionResults: [{ criterionId: 'criterion.cell.identify', result: 'unclear', note: null }],
        assistance: 'unassisted',
        sourceRefs: [ids.sourceP18],
        assessmentOrigin: 'rule',
        modelRunId: null,
        uncertainty: null,
      },
    ],
    requiresClarification: true,
    sourceRefs: [ids.sourceP18],
    graderVersion: 'rule-v1',
  });
  cases.push({
    id: 'grade.invalid-clarification-with-evidence',
    kind: 'grade',
    file: 'grade/invalid-clarification-with-evidence.json',
    expect: { ok: false, errorCodes: ['GRADE_CLARIFICATION_CONFLICT'] },
  });

  writeJson('snapshots/invalid.json', {
    schemaVersion: 1,
    learnerId: ids.learner,
    lastSeq: -1,
    createdAt: timestamps.now,
    stateHash: SHA_A,
    payload: {},
  });
  cases.push({
    id: 'snapshot.invalid',
    kind: 'snapshot',
    file: 'snapshots/invalid.json',
    expect: { ok: false, errorCodes: ['INVALID_NUMBER'] },
  });

  writeJson('events/late-session-response.json', {
    envelope: {
      schemaVersion: 1,
      eventId: 'event.session.output.1',
      topic: 'session.output',
      entityId: ids.session,
      revision: 3,
      seq: 10,
      payload: { conceptId: ids.conceptCell, sessionId: ids.session, text: 'fixture late output', isMock: false },
    },
    expected: { sessionId: ids.session, revision: 5, conceptId: ids.conceptCell },
  });
  cases.push({
    id: 'event.late-session-response',
    kind: 'sessionOutput',
    file: 'events/late-session-response.json',
    expect: { ok: false, errorCodes: ['STALE_REVISION'] },
  });

  const commits = journalCommits();
  writeText(
    'journal/duplicate-request-id.jsonl',
    `${JSON.stringify(commits[0])}\n${JSON.stringify(commits[1])}\n${JSON.stringify(commits[2])}\n`,
  );
  cases.push({
    id: 'journal.duplicate-request-id',
    kind: 'journalText',
    file: 'journal/duplicate-request-id.jsonl',
    expect: { ok: true, duplicateRequestIds: ['request.duplicate'] },
  });
  writeText(
    'journal/tail-half-line.jsonl',
    `${JSON.stringify(commits[0])}\n${JSON.stringify(commits[1])}\n{"schemaVersion":1,"eventId":"event.tail-half","requestId":"request.tail","seq":3`,
  );
  cases.push({
    id: 'journal.tail-half-line',
    kind: 'journalText',
    file: 'journal/tail-half-line.jsonl',
    expect: { ok: true, tailPartial: true },
  });
  writeText(
    'journal/middle-corruption.jsonl',
    `${JSON.stringify(commits[0])}\n{broken json in the middle}\n${JSON.stringify(commits[2])}\n`,
  );
  cases.push({
    id: 'journal.middle-corruption',
    kind: 'journalText',
    file: 'journal/middle-corruption.jsonl',
    expect: { ok: false, corruptLines: [2] },
  });

  writeJson('manifest.json', {
    schemaVersion: 1,
    generatedBy: 'education/scripts/build-fixtures.mjs',
    description:
      'Minimal contract fixtures from 05 §8. Synthetic content only; no textbook text or images.',
    cases,
  });

  // eslint-disable-next-line no-console
  console.log(`wrote ${cases.length} fixture cases to ${fixturesRoot}`);
}

main();
