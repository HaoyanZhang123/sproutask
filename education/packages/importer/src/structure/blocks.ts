/**
 * Page -> SourceBlock / Figure structure.
 *
 * Text-layer pages are re-flowed into paragraph blocks using font size and
 * vertical gaps; OCR pages keep one block per recognized line so page/line
 * positions stay honest. Figure records always keep the immutable page image
 * asset (A05: original page image + caption position); cropping a figure
 * region needs CV work that is explicitly deferred, so the recorded region is
 * the caption line, not an invented rectangle.
 */

import { createHash } from 'node:crypto';

import type { SourceBlockType } from '@edu/domain';

import type {
  BlockRecord,
  FigureRecord,
  PageExtraction,
  RevisionRecord,
} from '../import/types.js';
import { OCR_NORMALIZER_VERSION, PARSER_VERSION } from '../import/types.js';
import {
  CAPTION_PATTERN,
  HEADING_PATTERN,
  LIST_PATTERN,
  normalizeOcrText,
  normalizedLineText,
} from './text.js';

export interface StructureInput {
  readonly extraction: PageExtraction;
  readonly sha256: string;
}

export interface StructureOutput {
  readonly blocks: readonly BlockRecord[];
  readonly figures: readonly FigureRecord[];
  readonly revisions: readonly RevisionRecord[];
  /**
   * Short decorative header lines in the top margin (page furniture the OCR
   * engine turns into noise). They are counted, not silently dropped: the page
   * map carries the count so downstream reviewers can see it.
   */
  readonly headerArtifacts: readonly { readonly text: string; readonly bbox: BlockRecord['bbox'] }[];
}

function digest(input: string): string {
  return createHash('sha256').update(input).digest('hex').slice(0, 24);
}

function blockIds(sha256: string, page: number, index: number): { blockId: string; sourceRefId: string } {
  const base = `${sha256}|${PARSER_VERSION}|${page}|${index}`;
  return {
    blockId: `block:${digest(`block|${base}`)}`,
    sourceRefId: `source:${digest(`source|${base}`)}`,
  };
}

function figureIds(sha256: string, page: number, index: number): { figureId: string; sourceRefId: string } {
  const base = `${sha256}|${PARSER_VERSION}|${page}|figure|${index}`;
  return {
    figureId: `figure:${digest(`figure|${base}`)}`,
    sourceRefId: `source:${digest(`source-figure|${base}`)}`,
  };
}

function classifyText(text: string, fontSize: number | null, bodyFontSize: number): SourceBlockType {
  if (CAPTION_PATTERN.test(text)) return 'caption';
  if (HEADING_PATTERN.test(text)) return 'heading';
  if (fontSize !== null && bodyFontSize > 0 && fontSize >= bodyFontSize * 1.25 && text.length <= 40) {
    return 'heading';
  }
  if (LIST_PATTERN.test(text)) return 'list';
  return 'paragraph';
}

/**
 * Body text size is the most frequent font size (mode). A median is skewed by a
 * big title on a title page, which would hide real headings on that page.
 */
function dominantFontSize(values: readonly number[]): number {
  if (values.length === 0) return 0;
  const counts = new Map<number, number>();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  let best = 0;
  let bestCount = -1;
  for (const [size, count] of counts) {
    if (count > bestCount || (count === bestCount && size < best)) {
      best = size;
      bestCount = count;
    }
  }
  return best;
}

function unionBBox(
  boxes: readonly { readonly x: number; readonly y: number; readonly width: number; readonly height: number }[],
): { x: number; y: number; width: number; height: number } | null {
  if (boxes.length === 0) return null;
  const x = Math.min(...boxes.map((box) => box.x));
  const y = Math.min(...boxes.map((box) => box.y));
  const right = Math.max(...boxes.map((box) => box.x + box.width));
  const bottom = Math.max(...boxes.map((box) => box.y + box.height));
  return { x, y, width: right - x, height: bottom - y };
}

export function buildPageStructure(input: StructureInput): StructureOutput {
  const { extraction, sha256 } = input;
  const blocks: BlockRecord[] = [];
  const figures: FigureRecord[] = [];
  const revisions: RevisionRecord[] = [];
  // Page-number footers/headers are catalogued as printed-page evidence, not as
  // content blocks.
  const withoutPageNumbers = extraction.lines.filter((line) => !isMarginPageNumber(line));
  const headerArtifacts = withoutPageNumbers
    .filter((line) => isTopMarginArtifact(line))
    .map((line) => ({ text: line.text, bbox: line.bbox }));
  const contentLines = withoutPageNumbers.filter((line) => !isTopMarginArtifact(line));
  const bodyFontSize = dominantFontSize(
    contentLines.flatMap((line) => (line.fontSize === null ? [] : [line.fontSize])),
  );
  const lowQuality = extraction.quality.score < 0.6 || extraction.quality.flags.includes('UNDECODABLE_GLYPHS');
  const extractionLines = contentLines;

  const pushBlock = (index: number, text: string, revisedText: string | null, bbox: BlockRecord['bbox'], type: SourceBlockType): void => {
    const ids = blockIds(sha256, extraction.page, index);
    blocks.push({
      page: extraction.page,
      index,
      type,
      bbox,
      originalText: text,
      revisedText,
      extractionMethod: extraction.method === 'ocr' ? 'ocr' : 'text_layer',
      textConfidence: extraction.method === 'ocr' ? extraction.quality.score : null,
      reviewState: extraction.method === 'ocr' ? 'candidate' : 'machine_checked',
      lowQuality,
      blockId: ids.blockId,
      sourceRefId: ids.sourceRefId,
    });
    if (revisedText !== null && revisedText !== text) {
      revisions.push({
        page: extraction.page,
        blockId: ids.blockId,
        normalizerVersion: OCR_NORMALIZER_VERSION,
        originalSha256: createHash('sha256').update(text).digest('hex'),
        revisedSha256: createHash('sha256').update(revisedText).digest('hex'),
        action: 'cjk-space-collapse',
        at: '',
      });
    }
  };

  if (extraction.method === 'ocr') {
    let index = 0;
    for (const line of extractionLines) {
      const raw = line.text;
      if (raw.trim().length === 0) continue;
      const normalized = normalizeOcrText(raw);
      const type = classifyText(normalized, line.fontSize, bodyFontSize);
      pushBlock(index, raw, normalized === raw ? null : normalized, line.bbox, type);
      index += 1;
    }
  } else {
    // Text layer: merge consecutive lines of the same column into paragraphs.
    let index = 0;
    let pending: { texts: string[]; boxes: { x: number; y: number; width: number; height: number }[]; fontSize: number | null } | null = null;
    const flush = (): void => {
      if (pending === null || pending.texts.length === 0) {
        pending = null;
        return;
      }
      const text = pending.texts.join('');
      const normalized = normalizeOcrText(text);
      const type = classifyText(normalized, pending.fontSize, bodyFontSize);
      pushBlock(index, text, normalized === text ? null : normalized, unionBBox(pending.boxes), type);
      index += 1;
      pending = null;
    };
    for (const line of extractionLines) {
      const text = line.text;
      if (text.trim().length === 0) continue;
      const normalized = normalizedLineText(text);
      const type = classifyText(normalized, line.fontSize, bodyFontSize);
      if (type !== 'paragraph') {
        flush();
        pushBlock(index, text, normalized === text ? null : normalized, line.bbox, type);
        index += 1;
        continue;
      }
      const previous = pending;
      if (previous !== null) {
        const lastBox = previous.boxes[previous.boxes.length - 1];
        const gap = line.bbox.y - (lastBox.y + lastBox.height);
        const sameColumn =
          line.bbox.x < lastBox.x + lastBox.width && line.bbox.x + line.bbox.width > lastBox.x;
        if (gap <= Math.max(0.012, lastBox.height * 1.1) && sameColumn) {
          previous.texts.push(text);
          previous.boxes.push(line.bbox);
          continue;
        }
        flush();
      }
      pending = { texts: [text], boxes: [line.bbox], fontSize: line.fontSize };
    }
    flush();
  }

  // Figure candidates: caption lines on pages that keep an original page image.
  if (extraction.pageImageAssetId !== null) {
    let index = 0;
    for (const line of extractionLines) {
      const normalized = normalizedLineText(line.text);
      if (!CAPTION_PATTERN.test(normalized)) continue;
      const ids = figureIds(sha256, extraction.page, index);
      figures.push({
        page: extraction.page,
        caption: normalized,
        captionBbox: line.bbox,
        type: inferFigureType(normalized),
        originalAssetId: extraction.pageImageAssetId,
        activeAssetId: extraction.pageImageAssetId,
        extractionMethod: extraction.method === 'ocr' ? 'ocr' : 'text_layer',
        figureId: ids.figureId,
        sourceRefId: ids.sourceRefId,
      });
      index += 1;
    }
  }

  return { blocks, figures, revisions, headerArtifacts };
}

/**
 * Decorative header text (running head, ornament) sits in the very top margin
 * and OCR often renders it as a handful of meaningless characters. Real
 * headings do not start above 8% of the page height.
 */
function isTopMarginArtifact(line: {
  readonly bbox: { readonly y: number; readonly height: number };
  readonly text: string;
}): boolean {
  if (line.bbox.y + line.bbox.height > 0.08) return false;
  const text = line.text.replace(/\s/g, '');
  if (text.length === 0 || text.length > 6) return false;
  return !/^[0-9ivxlcdm]+$/i.test(text);
}

/** A bare page number in a page margin is a printed-page label, not content. */
function isMarginPageNumber(line: { readonly bbox: { readonly y: number; readonly height: number }; readonly text: string }): boolean {
  const inMargin = line.bbox.y >= 0.86 || line.bbox.y + line.bbox.height <= 0.10;
  if (!inMargin) return false;
  return /^[-–—·.．\s]*(\d{1,4}|[ivxlcdm]{1,7})[-–—·.．\s]*$/i.test(line.text.replace(/\s+/g, ''));
}

function inferFigureType(caption: string): FigureRecord['type'] {
  if (/照|摄/.test(caption)) return 'photo';
  if (/统计|曲线|柱状|折线/.test(caption)) return 'chart';
  if (/地图|分布图/.test(caption)) return 'map';
  if (/示意|结构|模式|解剖/.test(caption)) return 'diagram';
  return 'other';
}
