/**
 * Printed page labels (footers/headers) and PDF-page mapping evidence.
 *
 * `pdfPage` is the 1-based index inside the file; `printedPage` is what the
 * book prints on the page. They are stored separately and a missing printed
 * label stays `null` — no offset is ever inferred from a guess (05 §2, A08).
 */

import type { PageExtraction, PrintedPageEvidence } from '../import/types.js';
import { normalizedLineText } from './text.js';

interface LineLike {
  readonly text: string;
  readonly bbox: { readonly x: number; readonly y: number; readonly width: number; readonly height: number };
}

interface LabelPattern {
  readonly regex: RegExp;
  readonly confidence: 'high' | 'medium';
}

const LABEL_PATTERNS: readonly LabelPattern[] = [
  { regex: /^[-–—·.．\s]*(\d{1,4})[-–—·.．\s]*$/, confidence: 'high' },
  { regex: /^第\s*(\d{1,4})\s*页$/, confidence: 'high' },
  { regex: /^[Pp]\.?\s*(\d{1,4})$/, confidence: 'medium' },
  { regex: /^[（(]\s*(\d{1,4})\s*[）)]$/, confidence: 'medium' },
];

const ROMAN = /^[-–—·.．\s]*([ivxlcdm]{1,7})[-–—·.．\s]*$/i;

function marginLines(lines: readonly LineLike[], count: number): LineLike[] {
  const candidates: LineLike[] = [];
  for (const line of lines) {
    const bottom = line.bbox.y + line.bbox.height;
    if (line.bbox.y >= 0.86 || bottom <= 0.10) candidates.push(line);
  }
  if (candidates.length > 0) return candidates.slice(0, count);
  // Fall back to the physical first/last lines when margins are not separated.
  return [...lines.slice(0, 2), ...lines.slice(-2)].filter(
    (line, index, all) => all.indexOf(line) === index,
  );
}

/** Detects a printed page label for one page, or null when there is none. */
export function detectPrintedPage(extraction: PageExtraction): PrintedPageEvidence | null {
  const candidates = marginLines(extraction.lines, 6);
  for (const line of candidates) {
    const text = normalizedLineText(line.text);
    if (text.length === 0 || text.length > 24) continue;
    for (const pattern of LABEL_PATTERNS) {
      const match = pattern.regex.exec(text);
      if (match === null) continue;
      return {
        page: extraction.page,
        printedPage: match[1],
        sourceLine: line.text,
        confidence: pattern.confidence,
      };
    }
    const roman = ROMAN.exec(text);
    if (roman !== null) {
      return {
        page: extraction.page,
        printedPage: roman[1].toLowerCase(),
        sourceLine: line.text,
        confidence: 'medium',
      };
    }
  }
  return null;
}

export interface PageMappingSummary {
  readonly pagesWithPrintedPage: number;
  readonly pagesWithoutPrintedPage: number;
  /** Distinct `printedPage - pdfPage` offsets (an offset is evidence, not an assumption). */
  readonly offsets: readonly { readonly offset: number; readonly count: number }[];
  readonly dominantOffset: number | null;
  /** True only when every labelled page agrees on a single offset. */
  readonly consistent: boolean;
}

export function summarizePageMapping(evidences: readonly PrintedPageEvidence[]): PageMappingSummary {
  const offsets = new Map<number, number>();
  for (const evidence of evidences) {
    const printed = Number.parseInt(evidence.printedPage, 10);
    if (!Number.isFinite(printed)) continue;
    const offset = printed - evidence.page;
    offsets.set(offset, (offsets.get(offset) ?? 0) + 1);
  }
  const rows = [...offsets.entries()]
    .map(([offset, count]) => ({ offset, count }))
    .sort((left, right) => left.offset - right.offset);
  const dominant = rows.length === 0 ? null : [...rows].sort((a, b) => b.count - a.count)[0].offset;
  return {
    pagesWithPrintedPage: evidences.length,
    pagesWithoutPrintedPage: 0,
    offsets: rows,
    dominantOffset: dominant,
    consistent: rows.length === 1,
  };
}
