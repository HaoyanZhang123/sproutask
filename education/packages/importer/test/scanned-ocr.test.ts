import { readFile } from 'node:fs/promises';

import { describe, expect, it } from 'vitest';

import { readPngSize } from '../src/util/png.js';
import { mixedBook, scannedBook, textBookPages } from './helpers/fixtures.js';
import {
  createTestImporter,
  importRequest,
  rebuildImporter,
  writeFixture,
} from './helpers/harness.js';

const PAGE2_LINES = [
  { text: '第 2 单 元 细 胞 的 生 活', box: { x: 200, y: 200, width: 1200, height: 60 } },
  { text: '图 2-1 显 微 镜', box: { x: 240, y: 1000, width: 600, height: 44 } },
  { text: '7', box: { x: 780, y: 2080, width: 40, height: 30 } },
];

describe('scanned page OCR (A05)', () => {
  it('OCRs only pages without a text layer and keeps the original page image', async () => {
    const harness = await createTestImporter({
      ocr: { pages: [{ page: 2, lines: PAGE2_LINES }] },
    });
    try {
      const book = mixedBook();
      const path = await writeFixture(harness.rootDir, 'mixed.pdf', book.bytes);
      const { handle } = await harness.store.registerFile(path);

      const result = await harness.importer.start(harness.ctx('request-1'), importRequest(handle, 3));
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      const job = result.data;
      expect(job.completedUnits).toBe(3);

      const artifacts = await harness.importer.artifacts(harness.ctx('read'), job.id);
      expect(artifacts.ok).toBe(true);
      if (!artifacts.ok) return;
      const { pageMap, blocks, figures, revisions } = artifacts.data;

      expect(pageMap.map((row) => row.method)).toEqual(['text_layer', 'ocr', 'text_layer']);
      // Only the scanned page went through the OCR engine.
      expect(harness.ocr.ocrRequests).toEqual([2]);

      const scanned = pageMap[1];
      expect(scanned.printedPage).toBe('7');
      expect(scanned.pageImageAssetId).not.toBeNull();
      expect(scanned.flags).toContain('ENGINE_SPACE_ARTIFACTS');
      expect(scanned.qualityScore).toBeGreaterThan(0);
      expect(scanned.qualityScore).toBeLessThan(1);
      expect(scanned.renderMs).toBeGreaterThan(0);

      const scannedBlocks = blocks.filter((row) => row.sourceRef.pdfPage === 2);
      // Two content blocks: the footer page number is printed-page evidence.
      expect(scannedBlocks).toHaveLength(2);
      for (const row of scannedBlocks) {
        expect(row.block.extractionMethod).toBe('ocr');
        expect(row.block.reviewState).toBe('candidate');
        expect(row.block.textConfidence).not.toBeNull();
        expect(row.block.textConfidence).toBe(scanned.qualityScore);
        expect(row.sourceRef.printedPage).toBe('7');
        expect(row.sourceRef.verification.state).toBe('unverified');
      }
      // Raw engine text is immutable; the clean-up lands in revisedText + ledger.
      const title = scannedBlocks.find((row) => row.block.originalText.includes('第 2 单 元'));
      expect(title?.block.originalText).toBe('第 2 单 元 细 胞 的 生 活');
      expect(title?.block.revisedText).toBe('第 2 单元细胞的生活');
      expect(revisions).toHaveLength(2);
      expect(revisions[0].normalizerVersion).toBe('ocr-normalize-v1');
      expect(revisions[0].originalSha256).not.toBe(revisions[0].revisedSha256);

      // The page image is a real PNG stored as a managed asset.
      const assetId = scanned.pageImageAssetId;
      expect(assetId).not.toBeNull();
      const asset = await harness.store.resolve(String(assetId));
      expect(asset).not.toBeNull();
      if (asset !== null) {
        const bytes = new Uint8Array(await readFile(asset.absolutePath));
        expect(readPngSize(bytes)).toEqual({ width: 1600, height: 2200 });
      }

      // The figure keeps the whole-page asset plus the caption position.
      expect(figures).toHaveLength(1);
      expect(figures[0].figure.caption).toBe('图 2-1 显微镜');
      expect(figures[0].figure.originalAssetId).toBe(assetId);
      expect(figures[0].figure.activeAssetId).toBe(assetId);
      expect(figures[0].figure.reviewState).toBe('candidate');
      expect(figures[0].sourceRef.pdfPage).toBe(2);
      expect(figures[0].sourceRef.printedPage).toBe('7');
      expect(figures[0].sourceRef.bbox).not.toBeNull();
      expect(figures[0].sourceRef.figureId).toBe(figures[0].figure.id);
    } finally {
      await harness.cleanup();
    }
  });

  it('marks a blank scan page instead of inventing text', async () => {
    const harness = await createTestImporter({ ocr: { pages: [{ page: 1, lines: [] }] } });
    try {
      const book = scannedBook(1);
      const path = await writeFixture(harness.rootDir, 'blank-scan.pdf', book.bytes);
      const { handle } = await harness.store.registerFile(path);
      const result = await harness.importer.start(harness.ctx('request-1'), importRequest(handle, 1));
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      const artifacts = await harness.importer.artifacts(harness.ctx('read'), result.data.id);
      expect(artifacts.ok).toBe(true);
      if (!artifacts.ok) return;
      expect(artifacts.data.pageMap[0].flags).toContain('EMPTY');
      expect(artifacts.data.pageMap[0].qualityScore).toBe(0);
      expect(artifacts.data.blocks).toHaveLength(0);
    } finally {
      await harness.cleanup();
    }
  });

  it('fails visibly when no OCR language pack is installed', async () => {
    const harness = await createTestImporter({ ocr: { unavailable: 'LANGUAGE_MISSING' } });
    try {
      const book = scannedBook(2);
      const path = await writeFixture(harness.rootDir, 'scan.pdf', book.bytes);
      const { handle } = await harness.store.registerFile(path);
      const result = await harness.importer.start(harness.ctx('request-1'), importRequest(handle, 2));
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.data.status).toBe('failed');
      expect(result.data.error?.code).toBe('OCR_LANGUAGE_UNAVAILABLE');
      expect(result.data.error?.retryable).toBe(true);
      expect(result.data.completedUnits).toBe(0);
      expect(result.data.totalUnits).toBe(2);
    } finally {
      await harness.cleanup();
    }
  });

  it('isolates a failed page and resumes it without redoing finished pages', async () => {
    const harness = await createTestImporter({
      batchSize: 1,
      ocr: {
        pages: [
          { page: 2, lines: PAGE2_LINES },
          { page: 3, failure: 'RATE_LIMIT' },
          { page: 4, lines: PAGE2_LINES },
        ],
      },
    });
    try {
      const pages = textBookPages();
      // Page 1 has a text layer; pages 2-4 are image-only scans.
      const bookPages = [pages[0], 'q Q', 'q Q', 'q Q'];
      const { buildPdf } = await import('./helpers/pdf-builder.js');
      const bytes = buildPdf(bookPages, { title: 'four pages' });
      const path = await writeFixture(harness.rootDir, 'four.pdf', bytes);
      const { handle } = await harness.store.registerFile(path);
      const first = await harness.importer.start(harness.ctx('request-1'), importRequest(handle, 4));
      expect(first.ok).toBe(true);
      if (!first.ok) return;
      expect(first.data.status).toBe('failed');
      expect(first.data.error?.code).toBe('CLOUD_RATE_LIMITED');
      expect(first.data.completedUnits).toBeGreaterThanOrEqual(2);
      expect(first.data.completedUnits).toBeLessThan(4);

      // App restart with a healthy engine: resume reuses cached pages.
      const rebuilt = rebuildImporter(harness, {
        batchSize: 1,
        ocr: {
          pages: [
            { page: 2, lines: PAGE2_LINES },
            { page: 3, lines: PAGE2_LINES },
            { page: 4, lines: PAGE2_LINES },
          ],
        },
      });
      const resumed = await rebuilt.importer.resume(harness.ctx('resume-1'), first.data.id);
      expect(resumed.ok).toBe(true);
      if (!resumed.ok) return;
      expect(resumed.data.completedUnits).toBe(4);
      expect(rebuilt.ocr.ocrRequests).toEqual([3]);
      const artifacts = await rebuilt.importer.artifacts(harness.ctx('read'), resumed.data.id);
      expect(artifacts.ok).toBe(true);
      if (!artifacts.ok) return;
      expect(artifacts.data.pageMap).toHaveLength(4);
      expect(artifacts.data.pageMap.filter((row) => row.cached).length).toBeGreaterThanOrEqual(2);
    } finally {
      await harness.cleanup();
    }
  });
});
