import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { ImportStorage } from '../src/import/storage.js';
import { PARSER_VERSION } from '../src/import/types.js';
import { buildPdf, textPage } from './helpers/pdf-builder.js';
import {
  createTestImporter,
  importRequest,
  rebuildImporter,
  writeFixture,
} from './helpers/harness.js';

const SCAN_LINES = [
  { text: '第 3 单 元 植 物', box: { x: 200, y: 300, width: 900, height: 60 } },
  { text: '5', box: { x: 780, y: 2080, width: 40, height: 30 } },
];

function fourPages(): Uint8Array {
  return buildPdf(
    [
      textPage([{ x: 72, y: 700, size: 12, text: 'Text page one.' }]),
      'q Q',
      'q Q',
      'q Q',
    ],
    { title: 'cancel resume book' },
  );
}

async function waitForJobId(rootDir: string, timeoutMs = 5000): Promise<string> {
  const storage = new ImportStorage(rootDir);
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const jobs = await storage.listJobs();
    if (jobs.length > 0) return jobs[0].job.id;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error('import job was never created');
}

describe('cancel / resume / retry (A06)', () => {
  it('cancels mid-run, drops late results and never publishes them', async () => {
    let releaseGate: () => void = () => undefined;
    let enteredOcr: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      releaseGate = resolve;
    });
    const entered = new Promise<void>((resolve) => {
      enteredOcr = resolve;
    });
    const harness = await createTestImporter({
      batchSize: 1,
      ocr: {
        pages: [
          { page: 2, lines: SCAN_LINES, deliverAfterCancel: true },
          { page: 3, lines: SCAN_LINES, deliverAfterCancel: true },
          { page: 4, lines: SCAN_LINES, deliverAfterCancel: true },
        ],
        beforePage: async (page) => {
          if (page === 2) {
            enteredOcr();
            await gate;
          }
        },
      },
    });
    try {
      const file = await writeFixture(harness.rootDir, 'cancel.pdf', fourPages());
      const { handle } = await harness.store.registerFile(file);
      const running = harness.importer.start(harness.ctx('request-1'), importRequest(handle, 4));
      const jobId = await waitForJobId(harness.rootDir);
      await entered;
      const cancelResult = await harness.importer.cancel(harness.ctx('cancel-1'), jobId);
      expect(cancelResult.ok).toBe(true);
      if (!cancelResult.ok) return;
      expect(cancelResult.data.status).toBe('cancelled');
      releaseGate();

      const finished = await running;
      expect(finished.ok).toBe(true);
      if (!finished.ok) return;
      expect(finished.data.status).toBe('cancelled');
      expect(finished.data.stage === 'await_review').toBe(false);

      // Idempotent cancel.
      const again = await harness.importer.cancel(harness.ctx('cancel-2'), jobId);
      expect(again.ok).toBe(true);
      if (!again.ok) return;
      expect(again.data.status).toBe('cancelled');

      const storage = new ImportStorage(harness.rootDir);
      const lateLog = path.join(storage.jobDir(jobId), 'rejected-late-results.jsonl');
      const late = await readFile(lateLog, 'utf8').catch(() => '');
      expect(late).toContain('cancel-before-publish');
      // The late page never reached the cache or the published artifacts.
      const sha256 = handle.sha256;
      expect(await storage.readCache({ sha256, parserVersion: PARSER_VERSION, page: 2 })).toBeNull();
      const artifacts = await harness.importer.artifacts(harness.ctx('read'), jobId);
      if (artifacts.ok) {
        const pages = artifacts.data.pageMap.map((row) => row.page);
        expect(pages).not.toContain(2);
        expect(pages).not.toContain(3);
        expect(pages).not.toContain(4);
      }
    } finally {
      await harness.cleanup();
    }
  });

  it('resumes after cancel and is idempotent on the second resume', async () => {
    let releaseGate: () => void = () => undefined;
    let enteredOcr: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      releaseGate = resolve;
    });
    const entered = new Promise<void>((resolve) => {
      enteredOcr = resolve;
    });
    const harness = await createTestImporter({
      batchSize: 1,
      ocr: {
        pages: [
          { page: 2, lines: SCAN_LINES },
          { page: 3, lines: SCAN_LINES },
          { page: 4, lines: SCAN_LINES },
        ],
        beforePage: async (page) => {
          if (page === 2) {
            enteredOcr();
            await gate;
          }
        },
      },
    });
    try {
      const file = await writeFixture(harness.rootDir, 'resume.pdf', fourPages());
      const { handle } = await harness.store.registerFile(file);
      const running = harness.importer.start(harness.ctx('request-1'), importRequest(handle, 4));
      const jobId = await waitForJobId(harness.rootDir);
      await entered;
      await harness.importer.cancel(harness.ctx('cancel-1'), jobId);
      releaseGate();
      const started = await running;
      expect(started.ok).toBe(true);
      if (!started.ok) return;
      expect(started.data.status).toBe('cancelled');

      const rebuilt = rebuildImporter(harness, {
        batchSize: 1,
        ocr: {
          pages: [
            { page: 2, lines: SCAN_LINES },
            { page: 3, lines: SCAN_LINES },
            { page: 4, lines: SCAN_LINES },
          ],
        },
      });
      const resumed = await rebuilt.importer.resume(harness.ctx('resume-1'), jobId);
      expect(resumed.ok).toBe(true);
      if (!resumed.ok) return;
      expect(resumed.data.completedUnits).toBe(4);
      expect(resumed.data.status).not.toBe('cancelled');
      // The page extracted before the cancel came from the cache on resume.
      expect(rebuilt.ocr.ocrRequests).toEqual([2, 3, 4]);
      const first = await rebuilt.importer.artifacts(harness.ctx('read-1'), jobId);
      expect(first.ok).toBe(true);
      if (!first.ok) return;
      const firstJson = JSON.stringify(first.data);
      expect(first.data.pageMap.filter((row) => row.cached).map((row) => row.page)).toEqual([1]);

      const again = await rebuilt.importer.resume(harness.ctx('resume-2'), jobId);
      expect(again.ok).toBe(true);
      if (!again.ok) return;
      const second = await rebuilt.importer.artifacts(harness.ctx('read-2'), jobId);
      expect(second.ok).toBe(true);
      if (!second.ok) return;
      // Deterministic ids: a second resume cannot duplicate or mutate artifacts.
      expect(JSON.stringify(second.data)).toBe(firstJson);
    } finally {
      await harness.cleanup();
    }
  });

  it('retries only the requested pages and never overwrites revised OCR pages', async () => {
    const harness = await createTestImporter({
      batchSize: 1,
      ocr: { pages: [{ page: 2, lines: SCAN_LINES }, { page: 3, lines: SCAN_LINES }] },
    });
    try {
      const file = await writeFixture(harness.rootDir, 'retry.pdf', fourPages());
      const { handle } = await harness.store.registerFile(file);
      const started = await harness.importer.start(harness.ctx('request-1'), importRequest(handle, 4));
      expect(started.ok).toBe(true);
      if (!started.ok) return;
      expect(started.data.completedUnits).toBe(4);

      harness.ocr.ocrRequests.length = 0;
      const retried = await harness.importer.retry(harness.ctx('retry-1'), started.data.id, { pages: [1, 2] });
      expect(retried.ok).toBe(true);
      if (!retried.ok) return;
      // Page 1 is a clean text layer and is re-extracted; page 2 carries machine
      // revisions and must be reported as skipped, not silently overwritten.
      expect(retried.data.retriedPages).toEqual([1]);
      expect(retried.data.skippedPagesWithRevisions).toEqual([2]);
      expect(retried.data.failedPages).toEqual([]);
      expect(harness.ocr.ocrRequests).toEqual([]);
    } finally {
      await harness.cleanup();
    }
  });

  it('separates cache entries per parser version', async () => {
    const harness = await createTestImporter();
    try {
      const file = await writeFixture(
        harness.rootDir,
        'cache.pdf',
        buildPdf([textPage([{ x: 72, y: 700, size: 12, text: 'cache me' }])], {}),
      );
      const { handle, sha256 } = await harness.store.registerFile(file);
      const started = await harness.importer.start(harness.ctx('request-1'), importRequest(handle, 1));
      expect(started.ok).toBe(true);
      if (!started.ok) return;

      const storage = new ImportStorage(harness.rootDir);
      const currentPath = storage.cachePath({ sha256, parserVersion: PARSER_VERSION, page: 1 });
      expect(currentPath).toContain(PARSER_VERSION);
      const otherPath = storage.cachePath({ sha256, parserVersion: 'pdf-importer-v0', page: 1 });
      expect(otherPath).not.toBe(currentPath);
      expect(await storage.countCachedPages(sha256)).toBe(1);
      expect(await storage.countCachedPages(sha256, 'pdf-importer-v0')).toBe(0);
      expect(await storage.readCache({ sha256, parserVersion: 'pdf-importer-v0', page: 1 })).toBeNull();
    } finally {
      await harness.cleanup();
    }
  });
});
