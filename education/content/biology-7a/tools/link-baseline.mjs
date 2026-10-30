#!/usr/bin/env node
/**
 * T05 local-only helper: bind the hand-picked OCR blocks (source/block-selection.json)
 * to domain `SourceRef` locators and emit:
 *   - source/source-refs.json   (SourceRef entities, safe to commit: locators only)
 *   - source/block-index.json   (blockId -> page/bbox/type/text hash; never the text)
 *
 * The textbook is a scanned PDF. Original OCR text, page images and the PDF live
 * in the local, git-ignored T03 baseline; this script only copies locator data
 * plus a SHA-256 binding of the original OCR text.
 *
 * Usage:
 *   node content/biology-7a/tools/link-baseline.mjs \
 *     [--baseline <T03 run dir>] [--checked-at <RFC3339 UTC>]
 *
 * Without --baseline it uses the recorded default path (this machine only).
 * A machine without the local baseline cannot regenerate these files; the
 * committed files remain sufficient for `selfcheck.mjs`.
 */

import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const packRoot = path.resolve(here, '..');

/** @typedef {{ key: string, blockId: string, note: string }} RefSelection */
/** @typedef {{ schemaVersion: number, refs: RefSelection[], baselineRun: string, baselineJob: string }} SelectionFile */
/** @typedef {{ bbox: {x:number,y:number,width:number,height:number} | null, id: string, pdfPage: number, printedPage: string | null, blockId: string | null }} RawSourceRef */
/** @typedef {{ id: string, type: string, originalText: string, revisedText: string | null, textConfidence: number | null }} RawBlock */
/** @typedef {{ sourceRef: RawSourceRef, block: RawBlock }} BlockRow */
/** @typedef {{ page: number, printedPage: string | null, pageImageAssetId: string, charCount: number }} PageMapRow */

const args = process.argv.slice(2);
/** @param {string} name @returns {string | null} */
function argValue(name) {
  const index = args.indexOf(name);
  if (index < 0) return null;
  const value = args[index + 1];
  return value === undefined ? null : value;
}

const defaultBaseline = path.resolve(
  packRoot,
  '../../.local/evidence/T03/run-20261029T185619+0800',
);
const baseline = path.resolve(argValue('--baseline') ?? defaultBaseline);
const checkedAt = argValue('--checked-at') ?? new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');

const jobDir = path.join(baseline, 'jobs', 'import-2b97e28b318c-5062933f');
const blocksPath = path.join(jobDir, 'artifacts', 'blocks.jsonl');
const pageMapPath = path.join(jobDir, 'artifacts', 'page-map.json');
const selectionPath = path.join(packRoot, 'source', 'block-selection.json');

/** @param {string} file */
function sha256File(file) {
  return createHash('sha256').update(readFileSync(file)).digest('hex');
}

/** @param {string} text */
function sha256Text(text) {
  return createHash('sha256').update(text, 'utf8').digest('hex');
}

/** @param {string} label @param {unknown} condition */
function assert(label, condition) {
  if (!condition) {
    console.error(`link-baseline: ${label}`);
    process.exit(1);
  }
}

/** @type {SelectionFile} */
const selection = JSON.parse(readFileSync(selectionPath, 'utf8'));
assert('block-selection.json has refs', Array.isArray(selection.refs) && selection.refs.length > 0);

/** @type {Map<string, BlockRow>} */
const blocksById = new Map();
for (const line of readFileSync(blocksPath, 'utf8').split(/\r?\n/)) {
  if (line.trim().length === 0) continue;
  /** @type {BlockRow} */
  const row = JSON.parse(line);
  assert(`duplicate block id ${row.block.id}`, !blocksById.has(row.block.id));
  blocksById.set(row.block.id, row);
}

/** @type {Map<number, PageMapRow>} */
const pageMap = new Map();
for (const row of JSON.parse(readFileSync(pageMapPath, 'utf8'))) {
  pageMap.set(row.page, row);
}

const usedKeys = new Set();
const refIds = new Set();
const refs = [];
const blockIndex = [];
const problems = [];

for (const item of selection.refs) {
  assert(`duplicate selection key ${item.key}`, !usedKeys.has(item.key));
  usedKeys.add(item.key);
  const row = blocksById.get(item.blockId);
  if (row === undefined) {
    problems.push(`selected block ${item.blockId} (${item.key}) is not in the T03 baseline`);
    continue;
  }
  const ref = row.sourceRef;
  if (ref.bbox === null) problems.push(`block ${item.blockId} has no bbox`);
  // printedPage stays null when the page carries no footer label (e.g. the TOC
  // pages); the contract forbids inventing an offset, so null is expected there.
  const pageRow = pageMap.get(ref.pdfPage);
  if (pageRow === undefined) problems.push(`page ${ref.pdfPage} missing from page-map`);
  const refId = `source.bio7a.${item.key}`;
  if (refIds.has(refId)) problems.push(`duplicate source ref id ${refId}`);
  refIds.add(refId);

  refs.push({
    schemaVersion: 1,
    id: refId,
    bookInstanceId: 'book.bio7a.33eed60c',
    baselineSourceId: null,
    pdfPage: ref.pdfPage,
    printedPage: ref.printedPage,
    bbox: ref.bbox,
    blockId: item.blockId,
    figureId: null,
    verification: {
      state: 'machine_matched',
      actorKind: 'ai_static_reviewer',
      checkedAt,
      notes: `AI 依据 T03 OCR 页图/页脚标签核对定位（非人工核对）；选择说明：${item.note}`,
    },
  });
  blockIndex.push({
    blockId: item.blockId,
    sourceRefId: refId,
    t03SourceRefId: ref.id,
    pdfPage: ref.pdfPage,
    printedPage: ref.printedPage,
    bbox: ref.bbox,
    type: row.block.type,
    textConfidence: row.block.textConfidence,
    textSha256: sha256Text(row.block.originalText),
    textLength: row.block.originalText.length,
    pageImageAssetId: pageRow === undefined ? null : pageRow.pageImageAssetId,
  });
}

assert(`selection problems:\n  ${problems.join('\n  ')}`, problems.length === 0);

const sourceRefs = {
  schemaVersion: 1,
  kind: 't05-source-refs',
  generatedAt: checkedAt,
  baseline: {
    runId: selection.baselineRun,
    jobId: selection.baselineJob,
    parserVersion: 'pdf-importer-v1',
    bookInstanceId: 'book.bio7a.33eed60c',
    sourceFileSha256: '33eed60ce56aa402ae683b9c3a573f2fd780b766d635b04580d604928a23e59f',
    blocksSha256: sha256File(blocksPath),
    pageMapSha256: sha256File(pageMapPath),
  },
  note: '仅定位数据：pdfPage/printedPage/bbox/blockId + 文本指纹在 block-index.json；原文与页图留在 .local，不进 Git。',
  refs,
};

const blockIndexFile = {
  schemaVersion: 1,
  kind: 't05-block-index',
  generatedAt: checkedAt,
  note: 'blockId 到页/区域/文本指纹的绑定。textSha256 对应 T03 originalText（本机证据），本文件不含任何教材正文。',
  blocks: blockIndex,
};

writeFileSync(path.join(packRoot, 'source', 'source-refs.json'), `${JSON.stringify(sourceRefs, null, 2)}\n`, 'utf8');
writeFileSync(path.join(packRoot, 'source', 'block-index.json'), `${JSON.stringify(blockIndexFile, null, 2)}\n`, 'utf8');

console.log(`link-baseline: ${refs.length} source refs, ${blockIndex.length} block bindings`);
console.log(`  pages: ${[...new Set(refs.map((ref) => ref.pdfPage))].sort((a, b) => a - b).join(', ')}`);
console.log(`  wrote source/source-refs.json, source/block-index.json`);
