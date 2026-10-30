/**
 * Table-of-contents candidate detection.
 *
 * The importer only *proposes* TOC pages and entries: T04 freezes the real TOC
 * and T14 reviews it. Entries keep the printed page number printed in the book
 * and leave `pdfPage` null unless the label is unambiguous (the printed number
 * is not the PDF page index — no offset is invented here).
 */

import type { PageExtraction, TocCandidateRecord, TocEntryRecord } from '../import/types.js';
import { TOC_ENTRY_PATTERN, TOC_MARKER_PATTERN, normalizedLineText } from './text.js';

const LEADER_PATTERN = /^(.+?)[\s.．·…-]{2,}(\d{1,4})\s*$/;

export interface TocDetectionOptions {
  /** Only the front matter is scanned for a TOC. */
  readonly maxPages: number;
  /** A page without the printed marker still becomes a candidate above this score. */
  readonly minEntriesWithoutMarker: number;
}

export const DEFAULT_TOC_OPTIONS: TocDetectionOptions = {
  maxPages: 40,
  minEntriesWithoutMarker: 6,
};

function parseEntry(line: string): TocEntryRecord | null {
  const text = normalizedLineText(line);
  if (text.length === 0) return null;
  const leader = LEADER_PATTERN.exec(text);
  if (leader !== null) {
    const title = leader[1].replace(/[\s.．·…-]+$/, '').trim();
    if (title.length < 2) return null;
    return { title, pdfPage: null, printedPage: leader[2] };
  }
  if (TOC_ENTRY_PATTERN.test(text)) {
    return { title: text, pdfPage: null, printedPage: null };
  }
  return null;
}

export function detectTocCandidates(
  pages: readonly PageExtraction[],
  options: TocDetectionOptions = DEFAULT_TOC_OPTIONS,
): TocCandidateRecord[] {
  const candidates: TocCandidateRecord[] = [];
  const considered = pages.slice(0, Math.max(1, options.maxPages));
  for (const page of considered) {
    const lines = page.lines.map((line) => normalizedLineText(line.text));
    const markerIndex = lines.findIndex((line) => TOC_MARKER_PATTERN.test(line));
    const entries = lines
      .map((line) => parseEntry(line))
      .filter((entry): entry is TocEntryRecord => entry !== null);
    if (markerIndex >= 0 && entries.length >= 1) {
      candidates.push({
        pdfPage: page.page,
        title: lines[markerIndex],
        entries,
        confidence: 0.9,
      });
      continue;
    }
    if (entries.length >= options.minEntriesWithoutMarker && page.method === 'text_layer') {
      candidates.push({
        pdfPage: page.page,
        title: '目录（未识别到标题标记）',
        entries,
        confidence: 0.55,
      });
    }
  }
  return candidates;
}
