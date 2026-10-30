/**
 * Synthetic book fixtures: small PDFs built at test time (no binary fixtures in
 * Git, no 40 MB textbook in the test loop).
 */

import { SCANNED_PAGE_CONTENT, buildPdf, textPage } from './pdf-builder.js';

export interface SyntheticBook {
  readonly bytes: Uint8Array;
  readonly pageCount: number;
}

const LINE = { x: 72, size: 12 } as const;

/** Three text-layer pages: title/heading/paragraph, a second body page, a TOC. */
export function textBookPages(): string[] {
  return [
    textPage([
      { x: 72, y: 780, size: 22, text: 'Unit 1: Life and Biosphere', font: 'F2' },
      { x: 72, y: 748, size: 16, text: 'Chapter 1: Meet life', font: 'F2' },
      { x: 72, y: 716, size: 12, text: 'Biology studies living things and life activities.' },
      { x: 72, y: 698, size: 12, text: 'This second line belongs to the same paragraph.' },
      { x: 72, y: 24, size: 9, text: '12' },
    ]),
    textPage([
      { x: 72, y: 716, size: 12, text: 'Cells are the basic unit of life.' },
      { x: 72, y: 24, size: 9, text: '13' },
    ]),
    textPage([
      { x: 72, y: 780, size: 18, text: 'Contents', font: 'F2' },
      { x: 72, y: 740, size: 12, text: 'Unit 1: Life and Biosphere........12' },
      { x: 72, y: 716, size: 12, text: 'Unit 2: Cells and microscopes........21' },
      { x: 72, y: 692, size: 12, text: 'Unit 3: Green plants........35' },
    ]),
  ];
}

export function textBook(): SyntheticBook {
  const pages = textBookPages();
  return { bytes: buildPdf(pages, { title: 'Synthetic text book' }), pageCount: pages.length };
}

/** Mixed book: a text page, a scanned (image-only) page, a text page. */
export function mixedBook(): SyntheticBook {
  const pages = textBookPages();
  const mixed = [pages[0], SCANNED_PAGE_CONTENT, pages[1]];
  return { bytes: buildPdf(mixed, { title: 'Synthetic mixed book' }), pageCount: mixed.length };
}

/** Pure scanned book: every page has an empty content stream. */
export function scannedBook(pageCount: number): SyntheticBook {
  const pages = Array.from({ length: pageCount }, () => SCANNED_PAGE_CONTENT);
  return { bytes: buildPdf(pages, { title: 'Synthetic scanned book' }), pageCount };
}

/** A single text page used by parsing unit tests. */
export function onePageBook(text: string): SyntheticBook {
  const bytes = buildPdf([textPage([{ ...LINE, y: 700, text }])], { title: 'one page' });
  return { bytes, pageCount: 1 };
}
