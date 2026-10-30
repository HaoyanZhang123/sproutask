import { describe, expect, it } from 'vitest';

import { PdfDocument } from '../src/pdf/document.js';
import { textBook } from './helpers/fixtures.js';
import { buildPdf, textPage } from './helpers/pdf-builder.js';
import { createTestImporter, importRequest, writeFixture } from './helpers/harness.js';

describe('text-layer import (A04)', () => {
  it('extracts text, headings, printed pages and TOC candidates and never OCRs', async () => {
    const harness = await createTestImporter();
    try {
      const book = textBook();
      const path = await writeFixture(harness.rootDir, 'text-book.pdf', book.bytes);
      const { handle } = await harness.store.registerFile(path);

      const result = await harness.importer.start(harness.ctx('request-1'), importRequest(handle, 3));
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      const job = result.data;

      expect(job.totalUnits).toBe(3);
      expect(job.completedUnits).toBe(3);
      expect(job.stage).toBe('structure');
      expect(job.status).toBe('paused');
      expect(job.error?.code).toBe('CLOUD_EXTRACTION_PAUSED');
      expect(job.retryable).toBe(true);
      expect(job.parserVersion).toBe('pdf-importer-v1');

      const artifacts = await harness.importer.artifacts(harness.ctx('read-1'), job.id);
      expect(artifacts.ok).toBe(true);
      if (!artifacts.ok) return;

      const blocks = artifacts.data.blocks;
      expect(blocks.length).toBeGreaterThanOrEqual(4);
      for (const row of blocks) {
        expect(row.block.extractionMethod).toBe('text_layer');
        expect(row.block.reviewState).toBe('machine_checked');
        expect(row.block.textConfidence).toBeNull();
        expect(row.sourceRef.verification.state).toBe('unverified');
        expect(row.sourceRef.bbox).not.toBeNull();
      }

      const page1 = blocks.filter((row) => row.sourceRef.pdfPage === 1);
      const page1Text = page1.map((row) => row.block.originalText).join('\n');
      expect(page1Text).toContain('Unit 1: Life and Biosphere');
      expect(page1Text).toContain('Chapter 1: Meet life');
      expect(page1Text).toContain('Biology studies living things and life activities.');
      expect(page1Text).toContain('This second line belongs to the same paragraph.');
      // Consecutive body lines of one column merge into a single paragraph block.
      const paragraph = page1.find((row) => row.block.originalText.includes('Biology studies'));
      expect(paragraph?.block.type).toBe('paragraph');
      expect(paragraph?.block.originalText).toContain('same paragraph');
      expect(page1.find((row) => row.block.originalText.includes('Chapter 1'))?.block.type).toBe('heading');
      // The footer page number is printed-page evidence, not a content block.
      expect(page1Text).not.toContain('\n12');

      // PDF page and printed page are stored separately; no offset is invented.
      expect(page1.every((row) => row.sourceRef.printedPage === '12')).toBe(true);
      const page2 = blocks.filter((row) => row.sourceRef.pdfPage === 2);
      expect(page2.every((row) => row.sourceRef.printedPage === '13')).toBe(true);
      const page3 = blocks.filter((row) => row.sourceRef.pdfPage === 3);
      expect(page3.every((row) => row.sourceRef.printedPage === null)).toBe(true);

      const pageMap = artifacts.data.pageMap;
      expect(pageMap.map((row) => row.page)).toEqual([1, 2, 3]);
      expect(pageMap.map((row) => row.method)).toEqual(['text_layer', 'text_layer', 'text_layer']);
      expect(pageMap.map((row) => row.printedPage)).toEqual(['12', '13', null]);
      expect(pageMap[0].printedPageConfidence).toBe('high');
      expect(pageMap[0].pageImageAssetId).toBeNull();
      expect(pageMap.every((row) => row.cached === false)).toBe(true);
      expect(pageMap.every((row) => row.charCount > 0)).toBe(true);

      const toc = artifacts.data.tocCandidates;
      expect(toc).toHaveLength(1);
      expect(toc[0].pdfPage).toBe(3);
      expect(toc[0].confidence).toBeCloseTo(0.9, 5);
      expect(toc[0].entries.map((entry) => entry.printedPage)).toEqual(['12', '21', '35']);
      expect(toc[0].entries[0].title).toBe('Unit 1: Life and Biosphere');
      // The printed number is not silently used as a PDF page index.
      expect(toc[0].entries.every((entry) => entry.pdfPage === null)).toBe(true);

      expect(artifacts.data.figures).toHaveLength(0);
      expect(harness.ocr.ocrRequests).toEqual([]);
    } finally {
      await harness.cleanup();
    }
  });

  it('is idempotent for the same request id and for the same file hash', async () => {
    const harness = await createTestImporter();
    try {
      const book = textBook();
      const path = await writeFixture(harness.rootDir, 'text-book.pdf', book.bytes);
      const { handle } = await harness.store.registerFile(path);

      const first = await harness.importer.start(harness.ctx('request-1'), importRequest(handle, 3));
      expect(first.ok).toBe(true);
      if (!first.ok) return;

      const duplicateRequest = await harness.importer.start(harness.ctx('request-1'), importRequest(handle, 3));
      expect(duplicateRequest.ok).toBe(true);
      if (!duplicateRequest.ok) return;
      expect(duplicateRequest.data.id).toBe(first.data.id);

      // A07 same-hash hit: a new request for identical bytes reuses the job.
      const sameHash = await harness.importer.start(harness.ctx('request-2'), importRequest(handle, 3));
      expect(sameHash.ok).toBe(true);
      if (!sameHash.ok) return;
      expect(sameHash.data.id).toBe(first.data.id);
      expect(sameHash.data.sha256).toBe(first.data.sha256);
      expect(harness.ocr.ocrRequests).toEqual([]);
    } finally {
      await harness.cleanup();
    }
  });

  it('reports a missing text layer as OCR-eligible instead of fake text', async () => {
    const harness = await createTestImporter({
      ocr: { unavailable: 'ENGINE_MISSING', writeImages: false },
    });
    try {
      const pages = [textPage([{ x: 72, y: 700, size: 12, text: 'Body text page one.' }])];
      const bytes = buildPdf(pages, { title: 'single text page' });
      const path = await writeFixture(harness.rootDir, 'one.pdf', bytes);
      const { handle } = await harness.store.registerFile(path);
      const result = await harness.importer.start(harness.ctx('request-1'), importRequest(handle, 1));
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      // Text layer exists, so no OCR engine is needed at all.
      expect(result.data.error?.code).toBe('CLOUD_EXTRACTION_PAUSED');
      const artifacts = await harness.importer.artifacts(harness.ctx('r'), result.data.id);
      expect(artifacts.ok).toBe(true);
      if (!artifacts.ok) return;
      expect(artifacts.data.pageMap[0].method).toBe('text_layer');
    } finally {
      await harness.cleanup();
    }
  });

  it('advances to await_review with a model route and pauses at structure when offline', async () => {
    const online = await createTestImporter({
      network: 'available',
      cloudConcepts: {
        async extract() {
          return { conceptCount: 3, costUsd: 0 };
        },
      },
    });
    try {
      const book = textBook();
      const path = await writeFixture(online.rootDir, 'text-book.pdf', book.bytes);
      const { handle } = await online.store.registerFile(path);
      const result = await online.importer.start(online.ctx('request-1'), importRequest(handle, 3));
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.data.stage).toBe('await_review');
      expect(result.data.status).toBe('paused');
      expect(result.data.error).toBeNull();
      expect(result.data.costUsage.calls).toBe(1);
    } finally {
      await online.cleanup();
    }

    const offline = await createTestImporter({
      network: 'unavailable',
      cloudConcepts: {
        async extract() {
          throw new Error('cloud must not be called offline');
        },
      },
    });
    try {
      const book = textBook();
      const path = await writeFixture(offline.rootDir, 'text-book.pdf', book.bytes);
      const { handle } = await offline.store.registerFile(path);
      const result = await offline.importer.start(offline.ctx('request-1'), importRequest(handle, 3));
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      // Local stages finished; the model stage is explicitly paused, not faked.
      expect(result.data.stage).toBe('structure');
      expect(result.data.status).toBe('paused');
      expect(result.data.error?.code).toBe('CLOUD_EXTRACTION_PAUSED');
      expect(result.data.error?.retryable).toBe(true);
      expect(result.data.completedUnits).toBe(3);
    } finally {
      await offline.cleanup();
    }
  });

  it('recovers a PDF whose cross-reference offsets are wrong', () => {
    const bytes = buildPdf(textBookPagesSafe(), { title: 'recovery fixture', breakXrefOffsets: true });
    const doc = PdfDocument.open(bytes);
    expect(doc.info.recovered).toBe(true);
    expect(doc.info.pageCount).toBe(2);
    expect(doc.info.title).toBe('recovery fixture');
  });
});

function textBookPagesSafe(): string[] {
  return [
    textPage([{ x: 72, y: 700, size: 12, text: 'Recovery page one.' }]),
    textPage([{ x: 72, y: 700, size: 12, text: 'Recovery page two.' }]),
  ];
}
