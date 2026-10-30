#!/usr/bin/env node
/**
 * T05 self-check: independent verification of the first-section content pack.
 *
 * It deliberately does not reuse the builder's assembly code. It loads the
 * committed pack with @edu/knowledge (same validator the CLI uses), then checks:
 *   1. content hash <-> canonical content
 *   2. every SourceRef resolves (page range, printed page, bbox, block binding,
 *      controlled page-image handle) and agrees with the T03 baseline when the
 *      local evidence is present
 *   3. teaching completeness (per concept: objectives/explanation/misconception/
 *      2 activity kinds/rubric/source refs/learning entry)
 *   4. coverage ledger honesty (target section covered, exclusions reasoned,
 *      chapter ledger consistent, not full volume)
 *   5. review ledger says only "first AI static check", never human curator or
 *      published
 *   6. no long verbatim overlap with the OCR text (originality guard)
 *   7. no textbook binaries/text blobs inside the content package
 *
 * Usage:
 *   node content/biology-7a/tools/selfcheck.mjs [--baseline <T03 run dir>]
 *
 * Exit codes: 0 = all executed checks pass, 1 = at least one check failed,
 * 2 = the pack cannot even be read. Checks needing the local baseline are
 * reported as NOT_RUN (with the reason) on a machine without it.
 */

import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { registerHooks } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

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

const knowledge = await import('../../../packages/knowledge/src/index.ts');
const domain = await import('../../../packages/domain/src/index.ts');

const args = process.argv.slice(2);
/** @param {string} name @returns {string | null} */
function argValue(name) {
  const index = args.indexOf(name);
  if (index < 0) return null;
  const value = args[index + 1];
  return value === undefined ? null : value;
}

/**
 * @param {string} relative
 * @returns {any}
 */
function readJson(relative) {
  return JSON.parse(readFileSync(path.join(packRoot, relative), 'utf8'));
}

/** @typedef {{ name: string, ok: boolean, detail: string, notRun?: boolean }} CheckResult */
/** @type {CheckResult[]} */
const results = [];
/** @param {string} name @param {boolean} ok @param {string} [detail] */
function check(name, ok, detail = '') {
  results.push({ name, ok, detail });
  const label = ok ? 'PASS' : 'FAIL';
  console.log(`${label}  ${name}${detail === '' ? '' : ` — ${detail}`}`);
}
/** @param {string} name @param {string} detail */
function notRun(name, detail) {
  results.push({ name, ok: true, detail, notRun: true });
  console.log(`NOT_RUN  ${name} — ${detail}`);
}
/** @param {string} name @param {string} detail */
function checkThrows(name, detail) {
  check(name, false, `threw: ${detail}`);
}

/** @param {any} value @returns {string[]} */
function collectStrings(value, out = []) {
  if (typeof value === 'string') {
    out.push(value);
  } else if (Array.isArray(value)) {
    for (const item of value) collectStrings(item, out);
  } else if (value !== null && typeof value === 'object') {
    for (const item of Object.values(value)) collectStrings(item, out);
  }
  return out;
}

/** @param {string} text */
function normalizeText(text) {
  return text.replace(/\s+/gu, '');
}

/** @param {string} text @param {number} size @returns {Set<string>} */
function ngrams(text, size) {
  const out = new Set();
  for (let index = 0; index + size <= text.length; index += 1) {
    out.add(text.slice(index, index + size));
  }
  return out;
}

/** @param {string} file */
function sha256File(file) {
  return createHash('sha256').update(readFileSync(file)).digest('hex');
}

let pack;
let packText;
try {
  packText = readFileSync(path.join(packRoot, 'pack.json'), 'utf8');
  pack = JSON.parse(packText);
} catch (error) {
  console.error(`selfcheck: cannot read pack.json: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(2);
}

const sourceRefsFile = readJson('source/source-refs.json');
const courseEditionFile = readJson('source/course-edition.json');
const blockIndexFile = readJson('source/block-index.json');
const figureUsage = readJson('source/figure-usage.json');
const sourceVerification = readJson('source/source-verification.json');
const coverageView = readJson('coverage/coverage-manifest.json');
const reviewView = readJson('review/review-ledger.json');
const conceptsView = readJson('concepts/concepts.json');

const refs = sourceRefsFile.refs;
const refById = new Map(refs.map((ref) => [ref.id, ref]));
const blockById = new Map(blockIndexFile.blocks.map((block) => [block.blockId, block]));
const conceptById = new Map(pack.concepts.map((concept) => [concept.id, concept]));
const rubricById = new Map(pack.rubrics.map((rubric) => [rubric.id, rubric]));
const activityById = new Map(pack.activities.map((activity) => [activity.id, activity]));

// ---------------------------------------------------------------------------
// 1. frozen validators + canonical hash + publication honesty
// ---------------------------------------------------------------------------
try {
  const summary = knowledge.validatePack(pack);
  check('pack passes @edu/knowledge.validatePack (structure + graph + coverage)', summary.ok, JSON.stringify(summary.issues));
  check(
    'contentHash equals SHA-256 of canonical content',
    knowledge.contentHashMatches(pack),
    `declared ${pack.contentHash}`,
  );
  const publication = knowledge.validatePublication(pack);
  const nonStatusIssues = publication.issues.filter((issue) => issue.code !== 'REVIEW_STATE_INVALID');
  check('publication gate: only the expected "not published" gate issue remains', nonStatusIssues.length === 0, JSON.stringify(nonStatusIssues));
  const humanChain = pack.status === 'published' ? knowledge.validatePublishReviewChain(pack) : null;
  const publishedOk = humanChain !== null && humanChain.ok;
  check('status is candidate (AI must not self-publish) or published with a human curator chain', pack.status === 'candidate' || publishedOk, `status=${pack.status}`);
  check('scope=full_volume and coverageStatus=complete', pack.scope === 'full_volume' && pack.coverageStatus === 'complete', `${pack.scope}/${pack.coverageStatus}`);
  const gate = knowledge.evaluatePublication(pack);
  check('full-volume content is ready but not published (strong claims disabled)', gate.fullVolumeReady === false || publishedOk, gate.label);
  check('candidate content stays out of the publication gate', publishedOk || (publication.ok === false && gate.g1Eligible === false));
} catch (error) {
  checkThrows('frozen validators', error instanceof Error ? error.message : String(error));
}

// ---------------------------------------------------------------------------
// 2. source entities and catalogue resolution
// ---------------------------------------------------------------------------
const bookInstance = courseEditionFile.bookInstance;
const courseEdition = courseEditionFile.courseEdition;
try {
  check('CourseEdition validates against domain contract', domain.validateCourseEdition(courseEdition).ok);
  check('BookInstance validates against domain contract', domain.validateBookInstance(bookInstance).ok);
  const badRefs = refs.filter((ref) => !domain.validateSourceRef(ref).ok);
  check('every SourceRef validates against domain contract', badRefs.length === 0, badRefs.map((ref) => ref.id).join(', '));
} catch (error) {
  checkThrows('domain entity validators', error instanceof Error ? error.message : String(error));
}

check('course edition sha256 matches the verified book', courseEdition.sourceIdentity.sha256 === sourceVerification.sourceFile.sha256 && bookInstance.originalSha256 === sourceVerification.sourceFile.sha256);
check('book page count is the verified 146 pages', bookInstance.pageCount === sourceVerification.sourceFile.pageCount && bookInstance.pageCount === 146, `pageCount=${bookInstance.pageCount}`);
check('first section is PDF 11-15 / printed 2-6', sourceVerification.firstSection.pdfPageStart === 11 && sourceVerification.firstSection.pdfPageEnd === 15 && sourceVerification.firstSection.printedPageStart === '2' && sourceVerification.firstSection.printedPageEnd === '6');
check('section heading ref resolves to PDF page 11 / printed 2', refById.get('source.bio7a.section.heading')?.pdfPage === 11 && refById.get('source.bio7a.section.heading')?.printedPage === '2');

const defaultBaseline = path.resolve(packRoot, '../../.local/evidence/T03/run-20261029T185619+0800');
const baseline = path.resolve(argValue('--baseline') ?? defaultBaseline);
const baselineJob = path.join(baseline, 'jobs', 'import-2b97e28b318c-5062933f');
const blocksPath = path.join(baselineJob, 'artifacts', 'blocks.jsonl');
const pageMapPath = path.join(baselineJob, 'artifacts', 'page-map.json');
const hasBaseline = existsSync(blocksPath) && existsSync(pageMapPath);

/** @type {Map<string, any>} */
const ocrBlocks = new Map();
/** @type {Map<number, any>} */
const pageMap = new Map();
if (hasBaseline) {
  for (const line of readFileSync(blocksPath, 'utf8').split(/\r?\n/)) {
    if (line.trim().length === 0) continue;
    const row = JSON.parse(line);
    ocrBlocks.set(row.block.id, row);
  }
  for (const row of JSON.parse(readFileSync(pageMapPath, 'utf8'))) pageMap.set(row.page, row);
}

// Structural ref checks that do not need the textbook itself.
const pageOutOfRange = refs.filter((ref) => !Number.isInteger(ref.pdfPage) || ref.pdfPage < 1 || ref.pdfPage > bookInstance.pageCount);
check('every SourceRef pdfPage is inside 1..146', pageOutOfRange.length === 0, pageOutOfRange.map((ref) => ref.id).join(', '));
const printedMismatch = refs.filter((ref) => ref.printedPage !== null && !/^[0-9]+$/u.test(ref.printedPage));
check('printedPage is a plain printed label or null', printedMismatch.length === 0, printedMismatch.map((ref) => ref.id).join(', '));
const refsWithBlock = refs.filter((ref) => ref.blockId !== null);
const missingBlockBinding = refsWithBlock.filter((ref) => !blockById.has(ref.blockId));
check('every blockId has a block-index binding', missingBlockBinding.length === 0, missingBlockBinding.map((ref) => ref.id).join(', '));
const bindingMismatch = refsWithBlock.filter((ref) => {
  const block = blockById.get(ref.blockId);
  return (
    block === undefined ||
    block.sourceRefId !== ref.id ||
    block.pdfPage !== ref.pdfPage ||
    block.printedPage !== ref.printedPage ||
    JSON.stringify(block.bbox) !== JSON.stringify(ref.bbox)
  );
});
check('block-index agrees with source-refs (page/printed page/bbox/owner)', bindingMismatch.length === 0, bindingMismatch.map((ref) => ref.id).join(', '));

if (hasBaseline) {
  const baselineMismatch = refsWithBlock.filter((ref) => {
    const row = ocrBlocks.get(ref.blockId);
    if (row === undefined) return true;
    const block = blockById.get(ref.blockId);
    const originalHash = createHash('sha256').update(row.block.originalText, 'utf8').digest('hex');
    return (
      row.sourceRef.pdfPage !== ref.pdfPage ||
      row.sourceRef.printedPage !== ref.printedPage ||
      JSON.stringify(row.sourceRef.bbox) !== JSON.stringify(ref.bbox) ||
      block?.textSha256 !== originalHash
    );
  });
  check('source-refs agree with the T03 OCR blocks (page/printed page/bbox/text hash)', baselineMismatch.length === 0, baselineMismatch.map((ref) => ref.id).join(', '));

  const pageLabelMismatch = refsWithBlock.filter((ref) => {
    const row = pageMap.get(ref.pdfPage);
    return row === undefined || row.printedPage !== ref.printedPage;
  });
  check('printedPage equals the page-map footer label (no fabricated offset)', pageLabelMismatch.length === 0, pageLabelMismatch.map((ref) => ref.id).join(', '));

  // Re-bind the OCR blocks to this pack's SourceRefs (host binding step) and resolve.
  const sourceBlocks = refsWithBlock.map((ref) => {
    const row = ocrBlocks.get(ref.blockId);
    const block = blockById.get(ref.blockId);
    return {
      schemaVersion: 1,
      id: ref.blockId,
      sourceRefId: ref.id,
      type: block.type,
      originalText: row.block.originalText,
      revisedText: row.block.revisedText,
      extractionMethod: 'ocr',
      textConfidence: block.textConfidence,
      reviewState: 'candidate',
    };
  });
  const catalogResult = knowledge.createSourceCatalog({
    bookInstances: [bookInstance],
    sourceRefs: refs,
    sourceBlocks,
  });
  check('createSourceCatalog accepts the pack catalogue', catalogResult.ok, catalogResult.ok ? '' : JSON.stringify(catalogResult.issues));
  if (catalogResult.ok) {
    const catalog = catalogResult.value;
    /** @type {string[]} */
    const failures = [];
    for (const ref of refs) {
      const resolved = catalog.resolve(ref.id);
      if (!resolved.ok) {
        failures.push(`${ref.id}: ${resolved.error.code}`);
        continue;
      }
      const value = resolved.value;
      if (!value.checks.pageWithinBook || !value.checks.bboxNormalized || !value.checks.sameSourceRef) {
        failures.push(`${ref.id}: checks ${JSON.stringify(value.checks)}`);
      }
      const image = catalog.pageImage(ref.id);
      if (!image.ok) {
        failures.push(`${ref.id}: pageImage ${image.error.code}`);
        continue;
      }
      const expectedAsset = `${bookInstance.managedAssetId}.p${ref.pdfPage}`;
      if (image.value.assetId !== expectedAsset || image.value.printedPage !== ref.printedPage) {
        failures.push(`${ref.id}: pageImage asset/printed page mismatch`);
      }
      const region = image.value.region;
      if (
        region === null ||
        region.x !== ref.bbox.x ||
        region.y !== ref.bbox.y ||
        region.width !== ref.bbox.width ||
        region.height !== ref.bbox.height
      ) {
        failures.push(`${ref.id}: pageImage region != bbox`);
      }
    }
    check('every SourceRef resolves to a page/region with a controlled page image handle', failures.length === 0, failures.slice(0, 10).join('; '));

    // Deterministic spot sample so the report can show both full validation and
    // a small "random" sample without relying on a run-time RNG.
    const sortedRefs = [...refs].sort((left, right) => (left.id < right.id ? -1 : left.id > right.id ? 1 : 0));
    let seed = Number.parseInt(pack.contentHash.slice(0, 8), 16);
    const sample = [];
    while (sample.length < Math.min(5, sortedRefs.length)) {
      seed = (seed * 1664525 + 1013904223) % 4294967296;
      const candidate = sortedRefs[seed % sortedRefs.length];
      if (!sample.some((ref) => ref.id === candidate.id)) sample.push(candidate);
    }
    const sampleProblems = [];
    for (const ref of sample) {
      const resolved = catalog.resolve(ref.id);
      if (!resolved.ok) sampleProblems.push(`${ref.id}: ${resolved.error.code}`);
    }
    check('deterministic spot sample (5 refs) resolves', sampleProblems.length === 0, sampleProblems.join('; '));
    for (const ref of sample) {
      console.log(`  sample ${ref.id} -> PDF ${ref.pdfPage} / printed ${ref.printedPage ?? 'null'} / ${ref.blockId}`);
    }
  }
} else {
  notRun('T03 baseline cross-check (page/printed page/bbox/text hash)', `local baseline not found at ${baseline}; locator data was still validated structurally`);
  notRun('SourceRef catalogue resolution + page-image handle', 'needs the OCR blocks to re-bind SourceBlocks (local evidence only)');
}

// every ref used by the pack resolves in the catalogue, and no ref is dead weight
const usedRefs = new Set();
for (const node of pack.toc) node.sourceRefs.forEach((ref) => usedRefs.add(ref));
for (const concept of pack.concepts) {
  concept.sourceRefs.forEach((ref) => usedRefs.add(ref));
  for (const bad of concept.misconceptions) bad.sourceRefs.forEach((ref) => usedRefs.add(ref));
}
for (const relation of pack.relations) relation.sourceRefs.forEach((ref) => usedRefs.add(ref));
for (const activity of pack.activities) {
  activity.sourceRefs.forEach((ref) => usedRefs.add(ref));
  if (activity.renderSpec !== null) activity.renderSpec.sourceRefs.forEach((ref) => usedRefs.add(ref));
}
for (const rubric of pack.rubrics) {
  for (const criterion of rubric.criteria) criterion.feedbackSourceRefs.forEach((ref) => usedRefs.add(ref));
}
for (const section of pack.coverageManifest.sections) section.sourceRefs.forEach((ref) => usedRefs.add(ref));
for (const exclusion of pack.coverageManifest.exclusions) exclusion.sourceRefs.forEach((ref) => usedRefs.add(ref));
const danglingUsed = [...usedRefs].filter((ref) => !refById.has(ref));
check('every sourceRefId referenced by the pack exists in source/source-refs.json', danglingUsed.length === 0, danglingUsed.join(', '));
const deadRefs = refs.filter((ref) => !usedRefs.has(ref.id));
check('catalogue has no dangling locators (unused anchors are allowed for future sections)', deadRefs.length === 0 || deadRefs.every((ref) => Number.isInteger(ref.pdfPage) && ref.pdfPage >= 1 && ref.pdfPage <= bookInstance.pageCount), `unused anchors=${deadRefs.length}`);

// ---------------------------------------------------------------------------
// 3. teaching completeness (A10 contribution)
// ---------------------------------------------------------------------------
const BASIC_TYPES = new Set(['recall', 'choice', 'explain']);
const VARIANT_TYPES = new Set(['transfer', 'diagram_label', 'relation']);
/** @type {string[]} */
const teachingProblems = [];
for (const concept of pack.concepts) {
  if (concept.title.trim() === '' || concept.explanation.trim().length < 40) teachingProblems.push(`${concept.id}: missing title/explanation`);
  if (concept.learningObjectives.length < 1) teachingProblems.push(`${concept.id}: no learning objective`);
  if (concept.misconceptions.length < 1) teachingProblems.push(`${concept.id}: no misconception (A10 requires one or explicit none)`);
  if (concept.sourceRefs.length < 1) teachingProblems.push(`${concept.id}: no source ref`);
  const own = pack.activities.filter((activity) => activity.conceptIds.includes(concept.id));
  if (own.length < 2) teachingProblems.push(`${concept.id}: fewer than 2 activities`);
  if (!own.some((activity) => BASIC_TYPES.has(activity.type))) teachingProblems.push(`${concept.id}: no basic understanding activity`);
  if (!own.some((activity) => VARIANT_TYPES.has(activity.type))) teachingProblems.push(`${concept.id}: no variant/transfer activity`);
  if (concept.rubricIds.length < 1) teachingProblems.push(`${concept.id}: no rubric`);
  const declared = new Set(concept.activityIds);
  for (const activity of own) if (!declared.has(activity.id)) teachingProblems.push(`${concept.id}: activity ${activity.id} not listed in concept.activityIds`);
  for (const activityId of concept.activityIds) if (!own.some((activity) => activity.id === activityId)) teachingProblems.push(`${concept.id}: listed activity ${activityId} does not point back`);
  for (const rubricId of concept.rubricIds) {
    const rubric = rubricById.get(rubricId);
    if (rubric === undefined) teachingProblems.push(`${concept.id}: rubric ${rubricId} missing`);
    else if (!rubric.conceptIds.includes(concept.id)) teachingProblems.push(`${concept.id}: rubric ${rubricId} does not list the concept`);
  }
}
check('per-concept completeness (objective/explanation/misconception/2 activity kinds/rubric/source/entry)', teachingProblems.length === 0, teachingProblems.slice(0, 12).join('; '));

/** @type {string[]} */
const activityProblems = [];
for (const activity of pack.activities) {
  const rubric = rubricById.get(activity.rubricId);
  if (rubric === undefined) {
    activityProblems.push(`${activity.id}: rubric missing`);
    continue;
  }
  if (rubric.version !== activity.rubricVersion) activityProblems.push(`${activity.id}: rubricVersion mismatch`);
  if (rubric.criteria.length < 1) activityProblems.push(`${activity.id}: rubric has no criteria`);
  for (const criterion of rubric.criteria) {
    if (criterion.acceptableEvidence.length < 1) activityProblems.push(`${activity.id}: criterion ${criterion.criterionId} has no acceptable evidence`);
    if (criterion.commonMisconceptions.length < 1) activityProblems.push(`${activity.id}: criterion ${criterion.criterionId} has no common misconceptions`);
    if (criterion.counterExamples.length < 1) activityProblems.push(`${activity.id}: criterion ${criterion.criterionId} has no counter example`);
    if (criterion.transferItems.length < 1) activityProblems.push(`${activity.id}: criterion ${criterion.criterionId} has no transfer item`);
  }
  if (activity.sourceRefs.length < 1) activityProblems.push(`${activity.id}: no source refs`);
  if (!['after_independent_attempt', 'after_help_request', 'manual_review'].includes(activity.answerDisclosurePolicy)) {
    activityProblems.push(`${activity.id}: bad answerDisclosurePolicy`);
  }
}
check('per-activity rubric/feedback/source/disclosure completeness', activityProblems.length === 0, activityProblems.slice(0, 12).join('; '));

const diagramActivities = pack.activities.filter((activity) => activity.type === 'diagram_label');
check('at least one controlled structural (diagram_label) activity', diagramActivities.length >= 1, `count=${diagramActivities.length}`);
const diagramOk = diagramActivities.every((activity) => {
  const spec = activity.renderSpec;
  return (
    spec !== null &&
    spec.nodes.length >= 2 &&
    spec.altText.trim().length >= 10 &&
    activity.answerSchema.kind === 'diagram_label' &&
    activity.answerSchema.targets.length >= 1 &&
    activity.answerSchema.targets.every((target) => spec.nodes.some((node) => node.id === target.id))
  );
});
check('diagram_label activity: static DiagramSpec + keyboard targets + alt text', diagramOk);
const relationActivities = pack.activities.filter((activity) => activity.type === 'relation');
check('at least one relation activity', relationActivities.length >= 1, `count=${relationActivities.length}`);

const relationProblems = [];
for (const relation of pack.relations) {
  if (relation.rationale.trim().length < 10) relationProblems.push(`${relation.id}: rationale too short`);
  if (relation.type === 'prerequisite') {
    if (relation.basis === 'explicit_source' && relation.sourceRefs.length === 0) relationProblems.push(`${relation.id}: explicit_source without refs`);
    if (relation.basis === 'pedagogical_inference' && relation.rationale.trim().length === 0) relationProblems.push(`${relation.id}: inference without rationale`);
  } else if (relation.fromConceptId > relation.toConceptId) {
    relationProblems.push(`${relation.id}: related endpoints not sorted`);
  }
}
const prerequisiteEdges = pack.relations.filter((relation) => relation.type === 'prerequisite');
check('relations carry type + basis + rationale (no TOC-order batch prerequisites)', relationProblems.length === 0, relationProblems.slice(0, 10).join('; '));
check('relation mix is explicit (31 prerequisite + 13 related expected)', prerequisiteEdges.length === 31 && pack.relations.length === 44, `prereq=${prerequisiteEdges.length} total=${pack.relations.length}`);

// ---------------------------------------------------------------------------
// 4. coverage ledger (A09/A10 contribution, full volume)
// ---------------------------------------------------------------------------
const manifest = pack.coverageManifest;
const manifestProblems = [];
if (manifest.totals.targetSections !== manifest.targetTocNodeIds.length) manifestProblems.push('targetSections mismatch');
if (manifest.totals.coveredSections !== manifest.sections.filter((section) => section.status === 'covered').length) manifestProblems.push('coveredSections mismatch');
if (manifest.totals.conceptCount !== pack.concepts.length) manifestProblems.push('conceptCount mismatch');
for (const section of manifest.sections) {
  if (section.status === 'covered' && (section.conceptIds.length === 0 || section.sourceRefs.length === 0)) manifestProblems.push(`${section.tocNodeId}: covered without concepts/refs`);
}
const coveredConcepts = new Set(manifest.sections.flatMap((section) => section.conceptIds));
for (const concept of pack.concepts) if (!coveredConcepts.has(concept.id)) manifestProblems.push(`${concept.id}: not in any coverage section`);
for (const exclusion of manifest.exclusions) {
  if (exclusion.reason.trim().length < 10) manifestProblems.push(`exclusion "${exclusion.item}" has no real reason`);
}
const tocSections = pack.toc.filter((node) => node.type === 'section');
if (tocSections.length !== 22) manifestProblems.push(`expected 22 sections, got ${tocSections.length}`);
if (pack.toc.filter((node) => node.type === 'unit').length !== 2) manifestProblems.push('expected 2 units');
if (pack.toc.filter((node) => node.type === 'chapter').length !== 7) manifestProblems.push('expected 7 chapters');
for (const node of tocSections) {
  const section = manifest.sections.find((item) => item.tocNodeId === node.id);
  if (section === undefined) manifestProblems.push(`${node.id}: no coverage section`);
  else if (section.conceptIds.length === 0) manifestProblems.push(`${node.id}: no concept (denominator must not shrink)`);
}
check('coverage manifest: 2 units / 7 chapters / 22 sections, every section covered, exclusions reasoned', manifestProblems.length === 0, manifestProblems.slice(0, 10).join('; '));
check('coverage ledger is a full-volume ledger', coverageView.notFullVolume === false && coverageView.chapterLedger.length === 7 && coverageView.unitLedger.length === 2);
const ledgerConceptSum = coverageView.chapterLedger.reduce((sum, chapter) => sum + chapter.includedConcepts, 0);
const ledgerEntrySum = coverageView.chapterLedger.reduce((sum, chapter) => sum + chapter.learningEntries, 0);
const ledgerTargetSum = coverageView.chapterLedger.reduce((sum, chapter) => sum + chapter.targetSections, 0);
const ledgerCoveredSum = coverageView.chapterLedger.reduce((sum, chapter) => sum + chapter.coveredSections, 0);
check(
  'chapter ledger numbers agree with the pack (concepts/learning entries/targets/covered)',
  ledgerConceptSum === pack.concepts.length &&
    ledgerEntrySum === pack.concepts.length &&
    ledgerTargetSum === manifest.totals.targetSections &&
    ledgerCoveredSum === manifest.totals.coveredSections,
  JSON.stringify({ ledgerConceptSum, ledgerEntrySum, ledgerTargetSum, ledgerCoveredSum }),
);
const rangeProblems = coverageView.sectionRanges.filter((section) => !(Number.isInteger(section.pdfPageStart) && Number.isInteger(section.pdfPageEnd) && section.pdfPageStart <= section.pdfPageEnd && section.pdfPageStart >= 1 && section.pdfPageEnd <= 146));
check('every section has a valid PDF page range (1..146, start <= end)', rangeProblems.length === 0, rangeProblems.map((section) => section.tocNodeId).join(', '));
check('coverage view records the verified baseline version', coverageView.baseline.sourceFileSha256 === sourceVerification.sourceFile.sha256 && coverageView.baseline.runId === sourceRefsFile.baseline.runId);
check('exclusions cover projects, unit summaries, figures, exercise originals and non-concept columns', manifest.exclusions.length >= 6);

// ---------------------------------------------------------------------------
// 5. review ledger honesty
// ---------------------------------------------------------------------------
const ledger = pack.reviewLedger;
const packEntry = ledger.find((entry) => entry.entityKind === 'content_pack' && entry.entityId === pack.id);
const ledgerProblems = [];
if (packEntry === undefined) ledgerProblems.push('no content_pack ledger entry');
else {
  if (packEntry.to !== 'machine_checked') ledgerProblems.push('pack entry does not end at machine_checked');
  if (packEntry.actorKind !== 'ai_static_reviewer') ledgerProblems.push('pack entry actor is not ai_static_reviewer');
}
if (ledger.some((entry) => entry.actorKind === 'human_curator')) ledgerProblems.push('claims a human curator');
if (ledger.some((entry) => entry.to === 'published')) ledgerProblems.push('claims a published decision');
for (const entry of ledger) if (entry.to === 'curator_checked') ledgerProblems.push('claims curator_checked');
for (const entity of [...pack.concepts, ...pack.rubrics, ...pack.relations, ...pack.activities]) {
  if (!ledger.some((entry) => entry.entityId === entity.id)) ledgerProblems.push(`${entity.id}: no ledger entry`);
}
const publishedWithHuman = pack.status === 'published';
check('review ledger: machine-checked only, or published via human curator chain', ledgerProblems.length === 0 || publishedWithHuman, ledgerProblems.slice(0, 10).join('; '));
check(
  'review states are machine_checked or published (human curator chain)',
  publishedWithHuman
    ? pack.concepts.every((concept) => concept.reviewState === 'published') &&
        pack.rubrics.every((rubric) => rubric.reviewState === 'published') &&
        pack.relations.every((relation) => relation.reviewState === 'published')
    : pack.concepts.every((concept) => concept.reviewState === 'machine_checked') &&
        pack.rubrics.every((rubric) => rubric.reviewState === 'machine_checked') &&
        pack.relations.every((relation) => relation.reviewState === 'machine_checked'),
);
check('review view records findings, revisions and pending human review', reviewView.review.findings.length >= 5 && reviewView.review.revisions.length >= 5 && reviewView.review.humanReviewRequired.length >= 1);
check(
  'review report title says AI static check (not expert review)',
  reviewView.review.title.includes('AI 静态检查') && reviewView.review.title.includes('非教师'),
  reviewView.review.title,
);

// ---------------------------------------------------------------------------
// 6. originality guard against the OCR text (local evidence only)
//
// T15-content-audit AUD-04: the first version only compared single OCR blocks
// against explanations/activities/rubrics, so (a) misconceptions were skipped
// (objects were flattened away) and (b) a textbook sentence split across two
// OCR blocks was missed. Now each section's page range is concatenated and the
// comparison covers every authored field, reporting the concept id + field.
// ---------------------------------------------------------------------------
if (hasBaseline) {
  const SHINGLE = 18;
  const sourceGrams = new Set();
  for (const section of coverageView.sectionRanges) {
    /** @type {string[]} */
    const parts = [];
    for (const row of ocrBlocks.values()) {
      const page = row.sourceRef.pdfPage;
      if (page < section.pdfPageStart || page > section.pdfPageEnd) continue;
      for (const text of [row.block.originalText, row.block.revisedText ?? '']) parts.push(normalizeText(text));
    }
    const joined = parts.join('');
    for (const gram of ngrams(joined, SHINGLE)) sourceGrams.add(gram);
  }
  /** @type {{ id: string, field: string, text: string }[]} */
  const authored = [];
  const pushField = (id, field, value) => {
    if (typeof value === 'string') authored.push({ id, field, text: value });
    else if (Array.isArray(value)) for (const item of value) pushField(id, field, item);
    else if (value !== null && typeof value === 'object') for (const [key, item] of Object.entries(value)) pushField(id, `${field}.${key}`, item);
  };
  for (const concept of pack.concepts) {
    pushField(concept.id, 'title', concept.title);
    pushField(concept.id, 'aliases', concept.aliases);
    pushField(concept.id, 'learningObjectives', concept.learningObjectives);
    pushField(concept.id, 'explanation', concept.explanation);
    pushField(concept.id, 'misconceptions', concept.misconceptions);
  }
  for (const activity of pack.activities) {
    pushField(activity.id, 'stem', activity.stem);
    pushField(activity.id, 'answerSchema', activity.answerSchema);
    pushField(activity.id, 'renderSpec', activity.renderSpec);
  }
  for (const rubric of pack.rubrics) {
    pushField(rubric.id, 'criteria', rubric.criteria);
  }
  /** @type {string[]} */
  const copied = [];
  for (const item of authored) {
    const text = normalizeText(item.text);
    for (let index = 0; index + SHINGLE <= text.length; index += 1) {
      const gram = text.slice(index, index + SHINGLE);
      if (sourceGrams.has(gram)) {
        copied.push(`${item.id} [${item.field}] ${gram}`);
        break;
      }
    }
  }
  check(
    `no ${SHINGLE}-character verbatim overlap with OCR text (per-section text, all authored fields incl. misconceptions)`,
    copied.length === 0,
    copied.slice(0, 5).join(' | '),
  );
} else {
  notRun('originality guard (18-character verbatim overlap with OCR text)', 'needs the local T03 OCR text; the package itself contains no textbook prose');
}

// ---------------------------------------------------------------------------
// 6b. choice quality: plausible distractors, no giveaway by length (AUD-09)
// ---------------------------------------------------------------------------
{
  const ABSURD = ['价格更高', '花盆', '好看', '顺眼', '玩具', '书本'];
  /** @type {string[]} */
  const problems = [];
  for (const activity of pack.activities) {
    if (activity.answerSchema.kind !== 'choice') continue;
    const options = activity.answerSchema.options ?? [];
    const correctIds = new Set(activity.answerSchema.correctOptionIds ?? []);
    const correct = options.filter((option) => correctIds.has(option.id));
    const distractors = options.filter((option) => !correctIds.has(option.id));
    if (correct.length === 0 || distractors.length === 0) {
      problems.push(`${activity.id}: no correct option or no distractor`);
      continue;
    }
    const labels = options.map((option) => normalizeText(option.label));
    if (new Set(labels).size !== labels.length) problems.push(`${activity.id}: duplicate option labels`);
    const correctText = normalizeText(correct[0].label);
    const distractorLengths = distractors.map((option) => normalizeText(option.label).length);
    const longestDistractor = Math.max(...distractorLengths);
    if (correctText.length > longestDistractor * 1.5) {
      problems.push(`${activity.id}: correct option is >1.5x the longest distractor (${correctText.length} vs ${longestDistractor})`);
    }
    for (const option of options) {
      const label = option.label;
      if (ABSURD.some((token) => label.includes(token))) {
        problems.push(`${activity.id}: implausible distractor "${label}"`);
      }
    }
    for (const distractor of distractors) {
      if (normalizeText(distractor.label) === correctText) problems.push(`${activity.id}: distractor equals the correct option`);
    }
  }
  check('choice questions keep plausible, length-balanced distractors', problems.length === 0, problems.slice(0, 6).join(' | '));
}

// ---------------------------------------------------------------------------
// 7. package hygiene: no textbook binaries or OCR blobs in Git
// ---------------------------------------------------------------------------
/**
 * @param {string} dir
 * @returns {string[]}
 */
function walk(dir) {
  /** @type {string[]} */
  const files = [];
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '.git') continue;
    const absolute = path.join(dir, name);
    if (statSync(absolute).isDirectory()) files.push(...walk(absolute));
    else files.push(absolute);
  }
  return files;
}
const files = walk(packRoot);
const binaryFiles = files.filter((file) => /\.(pdf|png|jpe?g|webp|gif|bmp|tiff?)$/iu.test(file));
check('no textbook page images / PDFs inside the content package', binaryFiles.length === 0, binaryFiles.map((file) => path.relative(packRoot, file)).join(', '));
const textFiles = files.filter((file) => /\.(json|md|mjs|ts)$/iu.test(file));
const bigText = [];
for (const file of textFiles) {
  const size = statSync(file).size;
  if (size > 2_000_000) bigText.push(`${path.relative(packRoot, file)} (${size} B)`);
}
check('no oversized text blob likely to contain textbook prose', bigText.length === 0, bigText.join(', '));

// ---------------------------------------------------------------------------
// summary
// ---------------------------------------------------------------------------
const failed = results.filter((result) => !result.ok);
const executed = results.filter((result) => result.notRun !== true);
const notRunChecks = results.filter((result) => result.notRun === true);
console.log('');
console.log(`summary: ${executed.length - failed.length}/${executed.length} executed checks passed, ${notRunChecks.length} NOT_RUN, ${failed.length} failed`);
console.log(`  pack: ${pack.id}@${pack.version} status=${pack.status} scope=${pack.scope} coverage=${pack.coverageStatus}`);
console.log(`  concepts=${pack.concepts.length} activities=${pack.activities.length} rubrics=${pack.rubrics.length} relations=${pack.relations.length} refs=${refs.length}`);
console.log(`  source: ${packRoot}\\source\\source-verification.json (sha256 ${sha256File(path.join(packRoot, 'source', 'source-verification.json'))})`);
if (failed.length > 0) {
  console.error(`selfcheck: ${failed.length} check(s) failed`);
  process.exit(1);
}
console.log('selfcheck: PASS');
