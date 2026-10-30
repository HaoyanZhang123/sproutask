/**
 * OCR text clean-up and quality scoring.
 *
 * The engine's raw output is the immutable `originalText` of a block. Clean-up
 * produces `revisedText` and a revision ledger entry, never an overwrite
 * (05 §2 "OCR 原稿与修订稿分别保留，原稿不可覆盖").
 *
 * Quality scoring is an explicit local heuristic: Windows.Media.Ocr exposes no
 * per-word probability, so the importer must not pretend to have one. The score
 * only drives the "low quality" review flag and page-level statistics.
 */

import type { PageQuality } from '../import/types.js';

const CJK = /[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]/;
const CJK_GAP = /(?<=[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff\u3000-\u303f\uff00-\uffef])\s+(?=[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff\u3000-\u303f\uff00-\uffef])/g;
const MULTI_SPACE = /[ \t]{2,}/g;

export function isCjkChar(char: string): boolean {
  return CJK.test(char);
}

/**
 * Collapses the CJK inter-character spaces the Windows OCR engine inserts and
 * squeezes runs of spaces. Latin words keep their single spaces.
 */
export function normalizeOcrText(raw: string): string {
  return raw
    .replace(CJK_GAP, '')
    .replace(MULTI_SPACE, ' ')
    .replace(/[ \t]+\n/g, '\n')
    .trim();
}

export interface QualityInput {
  readonly lines: readonly { readonly text: string }[];
  readonly method: 'text_layer' | 'ocr';
}

export function scoreQuality(input: QualityInput): PageQuality {
  const text = input.lines.map((line) => line.text).join('\n');
  const charCount = text.replace(/\s/g, '').length;
  const cjkChars = [...text].filter(isCjkChar).length;
  const latinChars = [...text].filter((char) => /[A-Za-z]/.test(char)).length;
  const replacementChars = (text.match(/\uFFFD/g) ?? []).length;
  const spaceRuns = (text.match(/ {2,}/g) ?? []).length;
  // The Windows engine puts spaces between CJK characters; count those gaps so
  // the page can be flagged even when no double spaces exist.
  const cjkSpaceGaps = (text.match(/[\u3400-\u4dbf\u4e00-\u9fff] [\u3400-\u4dbf\u4e00-\u9fff]/g) ?? []).length;
  const flags: string[] = [];
  let score = 0.9;

  if (input.method === 'ocr') {
    if (charCount === 0) {
      flags.push('EMPTY');
      score = 0;
    } else if (charCount < 30) {
      flags.push('LOW_CHARS');
      score -= 0.2;
    }
    if (replacementChars > 0) {
      flags.push('UNDECODABLE_GLYPHS');
      score -= Math.min(0.5, replacementChars / Math.max(1, charCount));
    }
    if (spaceRuns > 0 || cjkSpaceGaps > 0) flags.push('ENGINE_SPACE_ARTIFACTS');
    if (cjkChars === 0 && latinChars === 0) {
      flags.push('NO_WORD_CHARS');
      score -= 0.1;
    }
    if (charCount > 0 && cjkChars / charCount > 0.9 && (spaceRuns > 5 || cjkSpaceGaps > 5)) score -= 0.1;
  } else {
    flags.push('TEXT_LAYER');
    score = 1;
    if (charCount === 0) {
      flags.push('EMPTY');
      score = 0;
    }
  }
  return {
    score: Math.max(0, Math.min(1, Number(score.toFixed(3)))),
    flags,
    charCount,
    cjkChars,
    replacementChars,
    latinChars,
  };
}

/** Text used by structure detection (headings, captions, printed page labels). */
export function normalizedLineText(raw: string): string {
  return normalizeOcrText(raw);
}

export const CAPTION_PATTERN = /^(图|表|Figure|Table)\s*[0-9０-９一二三四五六七八九十]+(?:[-–—.．][0-9０-９一二三四五六七八九十]+)?(?:\s|$|[:：])/;
export const HEADING_PATTERN =
  /^(第\s*[0-9０-９一二三四五六七八九十百]+\s*[单元章节]|[0-9]+\.[0-9]+|第[一二三四五六七八九十]+章|(Unit|Chapter|Lesson|Part)\s+[0-9]+)/i;
export const TOC_MARKER_PATTERN = /^(目\s*录|Contents|CONTENTS)\s*$/;
export const TOC_ENTRY_PATTERN =
  /^(第\s*[0-9０-９一二三四五六七八九十百]+\s*[单元章节].*|[0-9]+(?:\.[0-9]+)+\s+.*)$/;
export const LIST_PATTERN = /^([（(]?\s*[0-9]{1,2}\s*[）).、]|[①-⑳]|[-•·]\s)/;
