import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { ImportStorage } from '../src/import/storage.js';
import { buildPdf, textPage } from './helpers/pdf-builder.js';
import { createTestImporter, importRequest, writeFixture } from './helpers/harness.js';

const SCAN_LINES = [
  { text: '第 3 单 元 植 物', box: { x: 200, y: 300, width: 900, height: 60 } },
  { text: '5', box: { x: 780, y: 2080, width: 40, height: 30 } },
];

// Already-normalized lines produce no revisions, so the retry path may
// re-extract them (pages with revisions are intentionally never overwritten).
const NORMALIZED_SCAN_LINES = [
  { text: '第3单元植物', box: { x: 200, y: 300, width: 900, height: 60 } },
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
    { title: 'cancel stage guards book' },
  );
}

function threeTextPages(): Uint8Array {
  return buildPdf(
    [
      textPage([{ x: 72, y: 700, size: 12, text: 'Cloud guard page one.' }]),
      textPage([{ x: 72, y: 700, size: 12, text: 'Cloud guard page two.' }]),
      textPage([{ x: 72, y: 700, size: 12, text: 'Cloud guard page three.' }]),
    ],
    { title: 'cloud guard book' },
  );
}

async function waitForJob(rootDir: string, timeoutMs = 5000): Promise<string> {
  const storage = new ImportStorage(rootDir);
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const jobs = await storage.listJobs();
    if (jobs.length > 0) return jobs[0].job.id;
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  throw new Error('import job was never created');
}

async function artifactFingerprint(rootDir: string, jobId: string): Promise<string> {
  const storage = new ImportStorage(rootDir);
  const dir = storage.artifactsDir(jobId);
  const names = ['blocks.jsonl', 'figures.json', 'manifest.json', 'page-map.json', 'revisions.jsonl', 'toc-candidates.json'];
  const hash = createHash('sha256');
  for (const name of names) {
    const content = await readFile(path.join(dir, name), 'utf8').catch(() => '<missing>');
    hash.update(`${name}\0${content}\0`);
  }
  return hash.digest('hex');
}

async function lateEntries(rootDir: string, jobId: string): Promise<{ page: number | null; stage: string; reason: string }[]> {
  const storage = new ImportStorage(rootDir);
  const file = path.join(storage.jobDir(jobId), 'rejected-late-results.jsonl');
  const text = await readFile(file, 'utf8').catch(() => '');
  return text
    .split('\n')
    .filter((line) => line.trim().length > 0)
    .map((line) => JSON.parse(line) as { page: number | null; stage: string; reason: string });
}

describe('cancel guards on publish paths (H-02)', () => {
  it('cancels during cloud concept extraction and never advances to await_review', async () => {
    let releaseGate: () => void = () => undefined;
    let enteredCloud: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      releaseGate = resolve;
    });
    const entered = new Promise<void>((resolve) => {
      enteredCloud = resolve;
    });
    const harness = await createTestImporter({
      network: 'available',
      cloudConcepts: {
        async extract() {
          enteredCloud();
          await gate;
          return { conceptCount: 3, costUsd: 0.001 };
        },
      },
    });
    try {
      const file = await writeFixture(harness.rootDir, 'cloud.pdf', threeTextPages());
      const { handle } = await harness.store.registerFile(file);
      const running = harness.importer.start(harness.ctx('request-1'), importRequest(handle, 3));
      const jobId = await waitForJob(harness.rootDir);
      await entered;
      const beforeCancel = await artifactFingerprint(harness.rootDir, jobId);
      const cancelled = await harness.importer.cancel(harness.ctx('cancel-1'), jobId);
      expect(cancelled.ok).toBe(true);
      if (!cancelled.ok) return;
      const stageAtCancel = cancelled.data.stage;
      expect(cancelled.data.status).toBe('cancelled');
      releaseGate();

      const finished = await running;
      expect(finished.ok).toBe(true);
      if (!finished.ok) return;
      // The late cloud result must not overwrite the cancelled status/stage.
      expect(finished.data.status).toBe('cancelled');
      expect(finished.data.stage).toBe(stageAtCancel);
      expect(finished.data.stage).not.toBe('await_review');

      // No product artifact was rewritten after the cancel.
      expect(await artifactFingerprint(harness.rootDir, jobId)).toBe(beforeCancel);

      // The late stage result only went to the rejected ledger.
      const late = await lateEntries(harness.rootDir, jobId);
      expect(late.some((entry) => entry.stage === 'concepts' && entry.reason === 'cancel-before-cloud-result')).toBe(true);

      // The persisted job stays cancelled too (disk is the source of truth).
      const storage = new ImportStorage(harness.rootDir);
      const persisted = await storage.readJob(jobId);
      expect(persisted?.job.status).toBe('cancelled');
      expect(persisted?.job.stage).toBe(stageAtCancel);
    } finally {
      await harness.cleanup();
    }
  });

  it('cancels between cloud completion and the final transition', async () => {
    let importerRef: { cancel(ctx: { now: string }, jobId: string): Promise<unknown> } | null = null;
    let cancelledInsideCloud = false;
    const harness = await createTestImporter({ network: 'available' });
    const storage = new ImportStorage(harness.rootDir);
    const racing = (
      await import('../src/importer.js')
    ).createImporter({
      assets: harness.store,
      backend: new (
        await import('../src/engines/pdf-backend.js')
      ).PdfDocumentBackend({ ocr: harness.ocr }),
      paths: { rootDir: harness.rootDir },
      clock: harness.clock,
      ids: harness.ids,
      binding: {
        async bind() {
          return { bookInstanceId: null, baselineSourceId: 'baseline:fixture-1' };
        },
      },
      network: { status: 'available' },
      cloudConcepts: {
        async extract() {
          const jobs = await storage.listJobs();
          const target = jobs[0];
          if (target !== undefined && importerRef !== null) {
            await importerRef.cancel(harness.ctx('cancel-inside'), target.job.id);
            cancelledInsideCloud = true;
          }
          return { conceptCount: 1, costUsd: 0 };
        },
      },
      ocr: { batchSize: 2, savePageImages: true, targetWidth: 1200 },
    });
    importerRef = racing;
    try {
      const file = await writeFixture(harness.rootDir, 'cloud-race.pdf', threeTextPages());
      const { handle } = await harness.store.registerFile(file);
      const result = await racing.start(harness.ctx('request-1'), importRequest(handle, 3));
      expect(cancelledInsideCloud).toBe(true);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.data.status).toBe('cancelled');
      expect(result.data.stage).not.toBe('await_review');
      const late = await lateEntries(harness.rootDir, result.data.id);
      expect(late.some((entry) => entry.stage === 'concepts')).toBe(true);
    } finally {
      await harness.cleanup();
    }
  });
  it('reports a full disk during the cloud stage as STORAGE_FULL without publishing', async () => {
    const harness = await createTestImporter({
      network: 'available',
      cloudConcepts: {
        async extract() {
          const error = new Error('no space left on device') as NodeJS.ErrnoException;
          error.code = 'ENOSPC';
          throw error;
        },
      },
    });
    try {
      const file = await writeFixture(harness.rootDir, 'cloud-disk.pdf', threeTextPages());
      const { handle } = await harness.store.registerFile(file);
      const result = await harness.importer.start(harness.ctx('request-1'), importRequest(handle, 3));
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.data.status).toBe('failed');
      expect(result.data.error?.code).toBe('STORAGE_FULL');
      expect(result.data.error?.retryable).toBe(true);
      expect(result.data.stage).not.toBe('await_review');
      // Input/work already extracted is preserved for retry.
      expect(result.data.completedUnits).toBe(3);
      const late = await lateEntries(harness.rootDir, result.data.id);
      expect(late).toHaveLength(0);
    } finally {
      await harness.cleanup();
    }
  });

  it('does not write a retried page back after a cancel', async () => {
    let releaseGate: () => void = () => undefined;
    let enteredRetryPage: () => void = () => undefined;
    let armed = false;
    const gate = new Promise<void>((resolve) => {
      releaseGate = resolve;
    });
    const entered = new Promise<void>((resolve) => {
      enteredRetryPage = resolve;
    });
    const harness = await createTestImporter({
      batchSize: 1,
      ocr: {
        pages: [
          { page: 2, lines: NORMALIZED_SCAN_LINES },
          { page: 3, lines: NORMALIZED_SCAN_LINES },
          { page: 4, lines: NORMALIZED_SCAN_LINES },
        ],
        beforePage: async (page) => {
          if (armed && page === 3) {
            enteredRetryPage();
            await gate;
          }
        },
      },
    });
    try {
      const file = await writeFixture(harness.rootDir, 'retry-cancel.pdf', fourPages());
      const { handle } = await harness.store.registerFile(file);
      const started = await harness.importer.start(harness.ctx('request-1'), importRequest(handle, 4));
      expect(started.ok).toBe(true);
      if (!started.ok) return;
      expect(started.data.completedUnits).toBe(4);
      const jobId = started.data.id;
      const beforeRetry = await artifactFingerprint(harness.rootDir, jobId);
      const storage = new ImportStorage(harness.rootDir);

      armed = true;
      const retrying = harness.importer.retry(harness.ctx('retry-1'), jobId, { pages: [3, 4] });
      await entered;
      const cancelled = await harness.importer.cancel(harness.ctx('cancel-1'), jobId);
      expect(cancelled.ok).toBe(true);
      if (!cancelled.ok) return;
      releaseGate();
      const retried = await retrying;
      expect(retried.ok).toBe(true);
      if (!retried.ok) return;
      expect(retried.data.job.status).toBe('cancelled');
      // Pages cleared before retry are not written back after the cancel.
      expect(await storage.readCache({ sha256: handle.sha256, parserVersion: 'pdf-importer-v1', page: 3 })).toBeNull();
      expect(await storage.readCache({ sha256: handle.sha256, parserVersion: 'pdf-importer-v1', page: 4 })).toBeNull();
      // Artifacts were not rebuilt after the cancel.
      expect(await artifactFingerprint(harness.rootDir, jobId)).toBe(beforeRetry);
      const late = await lateEntries(harness.rootDir, jobId);
      expect(late.some((entry) => entry.stage === 'extract' && entry.page === 3)).toBe(true);
      const persisted = await storage.readJob(jobId);
      expect(persisted?.job.status).toBe('cancelled');
    } finally {
      await harness.cleanup();
    }
  });
});
