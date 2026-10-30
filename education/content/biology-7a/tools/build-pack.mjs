#!/usr/bin/env node
/**
 * T05 content pack builder.
 *
 * Source of truth = fragments/*.json + source/source-refs.json. This tool
 * assembles the domain `ContentPack` (pack.json), computes the canonical
 * content hash, and writes the review views:
 *   - concepts/concepts.json            (per concept + expanded source refs)
 *   - coverage/coverage-manifest.json   (chapter level coverage ledger)
 *   - review/review-ledger.json         (first AI static review record)
 *
 * It also fails hard when a fragment references a source ref, activity or
 * rubric that does not exist, so a stale fragment cannot silently ship.
 *
 * Usage:
 *   node content/biology-7a/tools/build-pack.mjs [--check]
 *
 * --check rebuilds in memory and compares with the files on disk (exit 1 on
 * drift) without writing anything.
 */

import { existsSync } from 'node:fs';
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expandSpec } from './spec-expand.mjs';

registerHooks({
  resolve(specifier, context, nextResolve) {
    try {
      return nextResolve(specifier, context);
    } catch (error) {
      if (specifier.endsWith('.js') && context.parentURL !== undefined) {
        const candidate = new URL(`${specifier.slice(0, -3)}.ts`, context.parentURL);
        if (existsSync(fileURLToPath(candidate))) {
          return { url: candidate.href, shortCircuit: true };
        }
      }
      throw error;
    }
  },
});

const here = path.dirname(fileURLToPath(import.meta.url));
const packRoot = path.resolve(here, '..');

/**
 * @param {string} relative
 * @returns {any}
 */
function readJson(relative) {
  return JSON.parse(readFileSync(path.join(packRoot, relative), 'utf8'));
}

/** @param {string} label @param {boolean} condition @param {string} [detail] */
function assert(label, condition, detail = '') {
  if (!condition) {
    console.error(`build-pack: ${label}${detail === '' ? '' : `\n  ${detail}`}`);
    process.exit(1);
  }
}

/** @param {any[]} list @returns {string[]} */
function idsOf(list) {
  return list.map((item) => item.id);
}

/**
 * @param {string} text
 * @returns {string}
 */
function normalizeNote(text) {
  return text;
}

const meta = readJson('fragments/pack-meta.json');
const toc = readJson('fragments/toc.json').toc;
const baseConcepts = readJson('fragments/concepts.json').concepts;
const baseRelations = readJson('fragments/relations.json').relations;
const baseActivities = readJson('fragments/activities.json').activities;
const baseRubrics = readJson('fragments/rubrics.json').rubrics;
const coverage = readJson('fragments/coverage.json');
const reviewNotes = readJson('fragments/review-notes.json');
const sourceRefs = readJson('source/source-refs.json');

const knowledge = await import('../../../packages/knowledge/src/index.ts');

/** @type {string[]} */
const problems = [];
/** @param {string} message */
function problem(message) {
  problems.push(message);
}

const refIds = new Set(idsOf(sourceRefs.refs));

// T14: expand the compact per-section specs (fragments/specs/*.json) into
// domain Concept/Activity/Rubric entities and merge them with the T05 section.
const specConcepts = [];
const specActivities = [];
const specRubrics = [];
const specsDir = path.join(packRoot, 'fragments', 'specs');
if (existsSync(specsDir)) {
  for (const file of readdirSync(specsDir).filter((entry) => entry.endsWith('.json')).sort()) {
    const spec = JSON.parse(readFileSync(path.join(specsDir, file), 'utf8'));
    const expanded = expandSpec(spec, refIds);
    for (const message of expanded.problems) problem(`${file}: ${message}`);
    specConcepts.push(...expanded.concepts);
    specActivities.push(...expanded.activities);
    specRubrics.push(...expanded.rubrics);
  }
}
const concepts = [...baseConcepts, ...specConcepts];
const activities = [...baseActivities, ...specActivities];
const rubrics = [...baseRubrics, ...specRubrics];
const relations = existsSync(path.join(packRoot, 'fragments', 'relations-full.json'))
  ? [...baseRelations, ...readJson('fragments/relations-full.json').relations]
  : baseRelations;

const duplicateConceptIds = concepts.map((concept) => concept.id).filter((id, index, list) => list.indexOf(id) !== index);
if (duplicateConceptIds.length > 0) problem(`duplicate concept ids: ${duplicateConceptIds.join(', ')}`);

// Coverage sections are computed from concept placements so a concept can never
// be counted twice or silently dropped from the declared target sections.
const tocById = new Map(toc.map((node) => [node.id, node]));
const sectionNodes = toc.filter((node) => node.type === 'section');
const declaredTargets = coverage.targetTocNodeIds ?? sectionNodes.map((node) => node.id);
const coverageSections = declaredTargets.map((tocNodeId) => {
  const node = tocById.get(tocNodeId);
  const placed = concepts.filter((concept) => concept.placements.includes(tocNodeId)).map((concept) => concept.id);
  return {
    tocNodeId,
    sourceRefs: node === undefined ? [] : node.sourceRefs,
    conceptIds: placed,
    status: placed.length === 0 ? 'blocked' : 'covered',
    notes: placed.length === 0 ? '该节尚无概念，登记为缺口（不删分母）。' : null,
  };
});

const tocIds = new Set(idsOf(toc));
const conceptIds = new Set(idsOf(concepts));
const relationIds = new Set(idsOf(relations));
const activityIds = new Set(idsOf(activities));
const rubricIds = new Set(idsOf(rubrics));

// --- reference integrity -------------------------------------------------
for (const node of toc) {
  for (const ref of node.sourceRefs) if (!refIds.has(ref)) problem(`toc ${node.id} has unknown source ref ${ref}`);
}
for (const concept of concepts) {
  for (const ref of concept.sourceRefs) if (!refIds.has(ref)) problem(`concept ${concept.id} has unknown source ref ${ref}`);
  for (const bad of concept.misconceptions) {
    for (const ref of bad.sourceRefs) if (!refIds.has(ref)) problem(`concept ${concept.id} misconception has unknown source ref ${ref}`);
  }
  for (const placement of concept.placements) if (!tocIds.has(placement)) problem(`concept ${concept.id} has unknown placement ${placement}`);
  for (const rubricId of concept.rubricIds) if (!rubricIds.has(rubricId)) problem(`concept ${concept.id} has unknown rubric ${rubricId}`);
  for (const activityId of concept.activityIds) if (!activityIds.has(activityId)) problem(`concept ${concept.id} has unknown activity ${activityId}`);
}
for (const relation of relations) {
  if (!conceptIds.has(relation.fromConceptId)) problem(`relation ${relation.id} from concept missing`);
  if (!conceptIds.has(relation.toConceptId)) problem(`relation ${relation.id} to concept missing`);
  for (const ref of relation.sourceRefs) if (!refIds.has(ref)) problem(`relation ${relation.id} has unknown source ref ${ref}`);
}
for (const activity of activities) {
  for (const conceptId of activity.conceptIds) if (!conceptIds.has(conceptId)) problem(`activity ${activity.id} has unknown concept ${conceptId}`);
  for (const ref of activity.sourceRefs) if (!refIds.has(ref)) problem(`activity ${activity.id} has unknown source ref ${ref}`);
  if (!rubricIds.has(activity.rubricId)) problem(`activity ${activity.id} has unknown rubric ${activity.rubricId}`);
  if (activity.renderSpec !== null) {
    for (const ref of activity.renderSpec.sourceRefs) {
      if (!refIds.has(ref)) problem(`activity ${activity.id} renderSpec has unknown source ref ${ref}`);
    }
  }
}
for (const rubric of rubrics) {
  for (const conceptId of rubric.conceptIds) if (!conceptIds.has(conceptId)) problem(`rubric ${rubric.id} has unknown concept ${conceptId}`);
  for (const criterion of rubric.criteria) {
    for (const ref of criterion.feedbackSourceRefs) {
      if (!refIds.has(ref)) problem(`rubric ${rubric.id} criterion ${criterion.criterionId} has unknown source ref ${ref}`);
    }
  }
}
for (const section of coverageSections) {
  if (!tocIds.has(section.tocNodeId)) problem(`coverage section ${section.tocNodeId} is not a toc node`);
  for (const ref of section.sourceRefs) if (!refIds.has(ref)) problem(`coverage section ${section.tocNodeId} has unknown source ref ${ref}`);
  for (const conceptId of section.conceptIds) if (!conceptIds.has(conceptId)) problem(`coverage section ${section.tocNodeId} has unknown concept ${conceptId}`);
}
for (const exclusion of coverage.exclusions ?? []) {
  for (const ref of exclusion.sourceRefs) if (!refIds.has(ref)) problem(`exclusion ${exclusion.item} has unknown source ref ${ref}`);
}
for (const targetId of declaredTargets) if (!tocIds.has(targetId)) problem(`coverage target ${targetId} is not a toc node`);

// every concept must be placed inside at least one target section
const targetConcepts = new Set(coverageSections.flatMap((section) => section.conceptIds));
for (const concept of concepts) {
  if (!targetConcepts.has(concept.id)) problem(`concept ${concept.id} is not referenced by any coverage section`);
}
// every declared source ref should be used somewhere in the pack or its ledgers
const usedRefs = new Set();
for (const node of toc) node.sourceRefs.forEach((ref) => usedRefs.add(ref));
concepts.forEach((concept) => {
  concept.sourceRefs.forEach((ref) => usedRefs.add(ref));
  concept.misconceptions.forEach((bad) => bad.sourceRefs.forEach((ref) => usedRefs.add(ref)));
});
relations.forEach((relation) => relation.sourceRefs.forEach((ref) => usedRefs.add(ref)));
activities.forEach((activity) => {
  activity.sourceRefs.forEach((ref) => usedRefs.add(ref));
  if (activity.renderSpec !== null) activity.renderSpec.sourceRefs.forEach((ref) => usedRefs.add(ref));
});
rubrics.forEach((rubric) => rubric.criteria.forEach((criterion) => criterion.feedbackSourceRefs.forEach((ref) => usedRefs.add(ref))));
coverageSections.forEach((section) => section.sourceRefs.forEach((ref) => usedRefs.add(ref)));
(coverage.exclusions ?? []).forEach((exclusion) => exclusion.sourceRefs.forEach((ref) => usedRefs.add(ref)));
const unusedRefs = [...refIds].filter((ref) => !usedRefs.has(ref));
if (unusedRefs.length > 0) {
  console.log(`build-pack: note: ${unusedRefs.length} catalogue anchors are not referenced by this pack (kept for future sections)`);
}

assert('fragment reference problems', problems.length === 0, problems.join('\n  '));

// --- review ledger -------------------------------------------------------
const checkedAt = reviewNotes.checkedAt;
const actorLabel = reviewNotes.review.actorLabel;
const scopeByKind = {
  concept: '概念标题/目标/解释/易错点/出处/活动入口与 rubric 绑定',
  rubric: '关键标准/可接受表达/常见误概念/反例/迁移题/反馈出处',
  relation: '关系类型/basis/rationale/出处/先修无环',
  activity: '题干/作答 schema/rubric 绑定/出处/答案披露策略/图示静态结构',
};

/**
 * @param {string} kind
 * @param {number} index
 * @param {string} entityId
 * @returns {any}
 */
function ledgerStamp(kind, index, entityId) {
  return {
    schemaVersion: 1,
    id: `ledger.t05.${kind}.${String(index + 1).padStart(2, '0')}`,
    entityKind: kind,
    entityId,
    from: 'candidate',
    to: 'machine_checked',
    actorKind: 'ai_static_reviewer',
    actorLabel,
    checkedAt,
    scope: normalizeNote(scopeByKind[kind]),
    notes: '首次 AI 静态检查（非教师专家审核）；发现与修订记录见 coverage/review-report.md。',
    evidenceRefs: ['evidence.t05.selfcheck'],
  };
}

const reviewLedger = [
  ...reviewNotes.packEntries,
  ...concepts.map((concept, index) => ledgerStamp('concept', index, concept.id)),
  ...rubrics.map((rubric, index) => ledgerStamp('rubric', index, rubric.id)),
  ...relations.map((relation, index) => ledgerStamp('relation', index, relation.id)),
  ...activities.map((activity, index) => ledgerStamp('activity', index, activity.id)),
];

// --- assemble ------------------------------------------------------------
const coverageManifest = {
  schemaVersion: 1,
  courseEditionId: meta.courseEditionId,
  generatedAt: meta.generatedAt,
  targetTocNodeIds: declaredTargets,
  sections: coverageSections,
  exclusions: coverage.exclusions ?? [],
  totals: {
    targetSections: declaredTargets.length,
    coveredSections: coverageSections.filter((section) => section.status === 'covered').length,
    conceptCount: concepts.length,
  },
};

/** @type {any} */
const pack = {
  schemaVersion: 1,
  id: meta.id,
  version: meta.version,
  courseEditionId: meta.courseEditionId,
  scope: meta.scope,
  coverageStatus: meta.coverageStatus,
  status: meta.status,
  contentHash: '0'.repeat(64),
  toc,
  concepts,
  relations,
  activities,
  rubrics,
  coverageManifest,
  reviewLedger,
};
pack.contentHash = knowledge.computeContentHash(pack);

const validation = knowledge.validatePack(pack);
assert('pack validation failed', validation.ok, JSON.stringify(validation.issues, null, 2));
assert('pack status is candidate', pack.status === 'candidate');
assert('publication gate must stay not-ready for a candidate pack', validation.publicationReady === false);
assert('content hash must match canonical content', knowledge.contentHashMatches(pack));

// --- review views -------------------------------------------------------
const refById = new Map(sourceRefs.refs.map((ref) => [ref.id, ref]));
const conceptsView = {
  schemaVersion: 1,
  kind: 't05-concepts-review-view',
  packId: pack.id,
  packVersion: pack.version,
  note: '人工/AI 审阅视图：概念按 domain Concept 字段展开，sourceRefs 附页与区域定位。pack.json 内的 concept.sourceRefs 仍是 id 引用。',
  concepts: concepts.map((concept) => ({
    ...concept,
    sourceRefDetails: concept.sourceRefs.map((ref) => refById.get(ref)),
    rubricRefs: concept.rubricIds.map((rubricId) => rubrics.find((rubric) => rubric.id === rubricId)),
    activities: concept.activityIds.map((activityId) => activities.find((activity) => activity.id === activityId)),
  })),
};

const pageLabels = readJson('source/page-labels.json').pages;
const labelOfPage = new Map(pageLabels.map((row) => [row.pdfPage, row.printedPage]));
const childrenOf = new Map();
for (const node of toc) {
  const key = node.parentId ?? '<root>';
  const list = childrenOf.get(key) ?? [];
  list.push(node);
  childrenOf.set(key, list);
}
for (const list of childrenOf.values()) list.sort((left, right) => left.order - right.order);

const units = (childrenOf.get('toc.bio7a.volume') ?? []).filter((node) => node.type === 'unit');
const orderedSections = [];
for (const unit of units) {
  for (const chapter of (childrenOf.get(unit.id) ?? []).filter((node) => node.type === 'chapter')) {
    for (const section of (childrenOf.get(chapter.id) ?? []).filter((node) => node.type === 'section')) {
      orderedSections.push({ unit, chapter, section });
    }
  }
}
const pageRanges = readJson('fragments/section-pages.json');
const sectionRange = new Map(pageRanges.sections.map((row) => [row.tocNodeId, { start: row.pdfPageStart, end: row.pdfPageEnd }]));
const chapterRange = new Map(pageRanges.chapters.map((row) => [row.tocNodeId, { start: row.pdfPageStart, end: row.pdfPageEnd }]));
const unitRange = new Map(pageRanges.units.map((row) => [row.tocNodeId, { start: row.pdfPageStart, end: row.pdfPageEnd }]));
/** @param {number | null} start @param {number | null} end */
function printedLabelRange(start, end) {
  if (start === null || end === null) return null;
  const labels = pageLabels
    .filter((row) => row.pdfPage >= start && row.pdfPage <= end && typeof row.printedPage === 'string')
    .map((row) => Number.parseInt(String(row.printedPage), 10))
    .filter((value) => Number.isFinite(value) && value >= 1);
  if (labels.length === 0) return null;
  return { min: Math.min(...labels), max: Math.max(...labels), count: labels.length };
}

const chapterLedger = [];
for (const unit of units) {
  for (const chapter of (childrenOf.get(unit.id) ?? []).filter((node) => node.type === 'chapter')) {
    const sections = (childrenOf.get(chapter.id) ?? []).filter((node) => node.type === 'section');
    const placed = sections.flatMap((section) => concepts.filter((concept) => concept.placements.includes(section.id)));
    const covered = sections.filter((section) => concepts.some((concept) => concept.placements.includes(section.id)));
    const range = chapterRange.get(chapter.id) ?? { start: null, end: null };
    chapterLedger.push({
      tocPath: `${unit.title} / ${chapter.title}`,
      tocEntries: { units: 1, chapters: 1, sections: sections.length, total: sections.length + 1 },
      pdfPageStart: range.start,
      pdfPageEnd: range.end,
      printedPageStart: range.start === null ? null : labelOfPage.get(range.start) ?? null,
      printedPageEnd: range.end === null ? null : labelOfPage.get(range.end) ?? null,
      printedLabelRange: printedLabelRange(range.start, range.end),
      includedConcepts: placed.length,
      learningEntries: placed.filter((concept) => concept.activityIds.length >= 2 && concept.rubricIds.length >= 1).length,
      coveredSections: covered.length,
      targetSections: sections.length,
      openIssues: covered.length === sections.length ? 0 : sections.length - covered.length,
    });
  }
}

const sectionRanges = orderedSections.map((entry) => {
  const range = sectionRange.get(entry.section.id) ?? { start: null, end: null };
  const placed = concepts.filter((concept) => concept.placements.includes(entry.section.id));
  return {
    tocNodeId: entry.section.id,
    tocPath: `${entry.unit.title} / ${entry.chapter.title} / ${entry.section.title}`,
    pdfPageStart: range.start,
    pdfPageEnd: range.end,
    printedPageStart: range.start === null ? null : labelOfPage.get(range.start) ?? null,
    printedPageEnd: range.end === null ? null : labelOfPage.get(range.end) ?? null,
    printedLabelRange: printedLabelRange(range.start, range.end),
    conceptIds: placed.map((concept) => concept.id),
    status: placed.length === 0 ? 'blocked' : 'covered',
  };
});
const unitLedger = units.map((unit) => {
  const range = unitRange.get(unit.id) ?? { start: null, end: null };
  const chapters = (childrenOf.get(unit.id) ?? []).filter((node) => node.type === 'chapter');
  return {
    tocNodeId: unit.id,
    title: unit.title,
    pdfPageStart: range.start,
    pdfPageEnd: range.end,
    printedPageStart: range.start === null ? null : labelOfPage.get(range.start) ?? null,
    printedPageEnd: range.end === null ? null : labelOfPage.get(range.end) ?? null,
    printedLabelRange: printedLabelRange(range.start, range.end),
    chapters: chapters.length,
  };
});

const coverageView = {
  schemaVersion: 1,
  kind: 't14-coverage-ledger',
  generatedAt: meta.generatedAt,
  baseline: {
    runId: sourceRefs.baseline.runId,
    jobId: sourceRefs.baseline.jobId,
    parserVersion: sourceRefs.baseline.parserVersion,
    sourceFileSha256: sourceRefs.baseline.sourceFileSha256,
    pageCount: 146,
    pageLabelCoverage: { pagesWithLabel: pageLabels.filter((row) => row.printedPage !== null).length, pagesWithoutLabel: pageLabels.filter((row) => row.printedPage === null).length },
    pageLabelRule: 'printedPage 逐页取自页脚标签；null 表示无标签，禁止按偏移推算。',
  },
  pack: {
    id: pack.id,
    version: pack.version,
    scope: pack.scope,
    coverageStatus: pack.coverageStatus,
    status: pack.status,
    contentHash: pack.contentHash,
  },
  chapterLedger,
  unitLedger,
  sectionRanges,
  nonSectionPages: pageRanges.nonSectionPages ?? [],
  totals: {
    units: units.length,
    chapters: chapterLedger.length,
    sections: orderedSections.length,
    targetSections: coverageManifest.totals.targetSections,
    coveredSections: coverageManifest.totals.coveredSections,
    conceptCount: concepts.length,
    activities: activities.length,
    rubrics: rubrics.length,
    relations: relations.length,
    sourceRefs: sourceRefs.refs.length,
  },
  exclusions: coverageManifest.exclusions,
  pendingHumanReview: reviewNotes.review.humanReviewRequired,
  notFullVolume: false,
  note: '全册覆盖台账（2 单元 / 7 章 / 22 节）。覆盖率是内容覆盖，不是学生掌握率；图义视觉核对与人工审校仍未完成。',
};

const reviewView = {
  schemaVersion: 1,
  kind: 't05-review-ledger',
  packId: pack.id,
  packVersion: pack.version,
  baseline: { runId: sourceRefs.baseline.runId, jobId: sourceRefs.baseline.jobId },
  review: reviewNotes.review,
  entries: pack.reviewLedger,
};

const outputs = [
  ['pack.json', `${JSON.stringify(pack, null, 2)}\n`],
  ['concepts/concepts.json', `${JSON.stringify(conceptsView, null, 2)}\n`],
  ['coverage/coverage-manifest.json', `${JSON.stringify(coverageView, null, 2)}\n`],
  ['review/review-ledger.json', `${JSON.stringify(reviewView, null, 2)}\n`],
];

const checkMode = process.argv.includes('--check');
/** @type {string[]} */
const drift = [];
for (const [relative, text] of outputs) {
  const absolute = path.join(packRoot, relative);
  if (checkMode) {
    const existing = existsSync(absolute) ? readFileSync(absolute, 'utf8') : '';
    if (existing !== text) drift.push(relative);
  } else {
    mkdirSync(path.dirname(absolute), { recursive: true });
    writeFileSync(absolute, text, 'utf8');
  }
}

if (checkMode) {
  if (drift.length > 0) {
    console.error(`build-pack: generated files are stale: ${drift.join(', ')}`);
    process.exitCode = 1;
  } else {
    console.log('build-pack --check: generated files are up to date');
  }
} else {
  console.log(`build-pack: ${pack.id}@${pack.version} (${pack.status}/${pack.scope}/${pack.coverageStatus})`);
  console.log(`  toc=${pack.toc.length} concepts=${pack.concepts.length} activities=${pack.activities.length} rubrics=${pack.rubrics.length} relations=${pack.relations.length} refs=${sourceRefs.refs.length}`);
  console.log(`  coverage: target=${coverageManifest.totals.targetSections} covered=${coverageManifest.totals.coveredSections} exclusions=${coverageManifest.exclusions.length}`);
  console.log(`  contentHash=${pack.contentHash}`);
  console.log('  wrote pack.json, concepts/concepts.json, coverage/coverage-manifest.json, review/review-ledger.json');
}
