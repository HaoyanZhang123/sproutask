import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { IMPORTER_ERROR_CODES, importerError, type ImporterErrorCode } from '../src/errors.js';
import type { ManagedAssetStore } from '../src/import/types.js';
import { buildPdf, textPage } from './helpers/pdf-builder.js';
import { createTestImporter, importRequest, writeFixture } from './helpers/harness.js';

describe('import failure visibility (A29 / T03 step 1)', () => {
  it('rejects a PDF whose bytes are not a PDF', async () => {
    const harness = await createTestImporter();
    try {
      const bytes = new TextEncoder().encode('%PDF-1.7\n%%EOF\n not really a pdf');
      const fixturePath = await writeFixture(harness.rootDir, 'corrupt.pdf', bytes);
      const { handle } = await harness.store.registerFile(fixturePath);
      const result = await harness.importer.start(harness.ctx('request-1'), importRequest(handle, null));
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error.code).toBe('VALIDATION_FAILED');
      expect(result.error.message).toContain('损坏');
    } finally {
      await harness.cleanup();
    }
  });

  it('rejects an encrypted PDF with an explicit password message', async () => {
    const harness = await createTestImporter();
    try {
      const bytes = buildPdf([textPage([{ x: 72, y: 700, size: 12, text: 'secret' }])], {
        encrypted: true,
        title: 'encrypted fixture',
      });
      const fixturePath = await writeFixture(harness.rootDir, 'encrypted.pdf', bytes);
      const { handle } = await harness.store.registerFile(fixturePath);
      const result = await harness.importer.start(harness.ctx('request-1'), importRequest(handle, null));
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error.code).toBe('VALIDATION_FAILED');
      expect(result.error.message).toContain('密码');
    } finally {
      await harness.cleanup();
    }
  });

  it('rejects a confirmed page count that disagrees with the file', async () => {
    const harness = await createTestImporter();
    try {
      const bytes = buildPdf([textPage([{ x: 72, y: 700, size: 12, text: 'two pages' }])], {});
      const fixturePath = await writeFixture(harness.rootDir, 'pages.pdf', bytes);
      const { handle } = await harness.store.registerFile(fixturePath);
      const result = await harness.importer.start(harness.ctx('request-1'), importRequest(handle, 7));
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error.code).toBe('VALIDATION_FAILED');
      expect(result.error.message).toContain('页数');
    } finally {
      await harness.cleanup();
    }
  });

  it('never reads an arbitrary path handed in as an asset id', async () => {
    const harness = await createTestImporter();
    try {
      const fixturePath = await writeFixture(harness.rootDir, 'a.pdf', buildPdf([textPage([])], {}));
      const handle = { assetId: fixturePath, sha256: 'a'.repeat(64), originalName: 'a.pdf' };
      const result = await harness.importer.start(harness.ctx('request-1'), importRequest(handle, null));
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error.code).toBe('INVALID_INPUT');
    } finally {
      await harness.cleanup();
    }
  });

  it('refuses a managed handle that resolves outside the allowed roots', async () => {
    const harness = await createTestImporter();
    const elsewhere = await mkdtemp(join(os.tmpdir(), 't03-outside-'));
    try {
      const outsidePath = join(elsewhere, 'outside.pdf');
      await writeFile(outsidePath, buildPdf([textPage([])], {}));
      const handle = await harness.store.registerRaw('asset:outside', outsidePath, 'b'.repeat(64));
      const result = await harness.importer.start(harness.ctx('request-1'), importRequest(handle, null));
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error.code).toBe('INVALID_INPUT');
      expect(result.error.message).toContain('允许');
    } finally {
      await harness.cleanup();
      await rm(elsewhere, { recursive: true, force: true });
    }
  });

  it('rejects a file whose bytes no longer match the registered hash', async () => {
    const harness = await createTestImporter();
    try {
      const fixturePath = await writeFixture(harness.rootDir, 'hash.pdf', buildPdf([textPage([])], {}));
      const handle = await harness.store.registerRaw('asset:hash', fixturePath, 'c'.repeat(64));
      const result = await harness.importer.start(harness.ctx('request-1'), importRequest(handle, null));
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error.code).toBe('VALIDATION_FAILED');
      expect(result.error.message).toContain('不一致');
    } finally {
      await harness.cleanup();
    }
  });

  it('reports a vanished source file instead of throwing', async () => {
    const harness = await createTestImporter();
    try {
      const handle = { assetId: 'asset:missing', sha256: 'd'.repeat(64), originalName: 'gone.pdf' };
      const result = await harness.importer.start(harness.ctx('request-1'), importRequest(handle, null));
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error.code).toBe('NOT_FOUND');
      expect(result.error.message).toContain('找不到');
    } finally {
      await harness.cleanup();
    }
  });

  it('imports through a Chinese directory and file name', async () => {
    const harness = await createTestImporter({ ocr: { pages: [{ page: 2, lines: [] }] } });
    try {
      const bytes = buildPdf(
        [textPage([{ x: 72, y: 700, size: 12, text: 'Chinese path page one.' }]), 'q Q'],
        { title: 'chinese path' },
      );
      const fixturePath = await writeFixture(harness.rootDir, join('中文 目录', '教材 扫描件.pdf'), bytes);
      const { handle } = await harness.store.registerFile(fixturePath);
      const result = await harness.importer.start(harness.ctx('request-1'), importRequest(handle, 2));
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.data.completedUnits).toBe(2);
      const artifacts = await harness.importer.artifacts(harness.ctx('read'), result.data.id);
      expect(artifacts.ok).toBe(true);
      if (!artifacts.ok) return;
      expect(artifacts.data.pageMap).toHaveLength(2);
    } finally {
      await harness.cleanup();
    }
  });

  it('surfaces a full disk as a retryable failure without publishing artifacts', async () => {
    const harness = await createTestImporter({ ocr: { pages: [{ page: 1, lines: [] }] } });
    const failing: ManagedAssetStore = {
      allowedRoots: harness.store.allowedRoots,
      resolve: (assetId) => harness.store.resolve(assetId),
      put: async () => {
        const error = new Error('no space left on device') as NodeJS.ErrnoException;
        error.code = 'ENOSPC';
        throw error;
      },
    };
    const { rebuildImporter } = await import('./helpers/harness.js');
    try {
      const bytes = buildPdf(['q Q'], { title: 'disk full' });
      const fixturePath = await writeFixture(harness.rootDir, 'disk.pdf', bytes);
      const { handle } = await harness.store.registerFile(fixturePath);
      const store = failing;
      const rebuilt = rebuildImporter(harness, { assetStore: store, ocr: { pages: [{ page: 1, lines: [] }] } });
      const result = await rebuilt.importer.start(harness.ctx('request-1'), importRequest(handle, 1));
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.data.status).toBe('failed');
      expect(result.data.error?.code).toBe('STORAGE_FULL');
      expect(result.data.retryable).toBe(true);
      const artifacts = await rebuilt.importer.artifacts(harness.ctx('read'), result.data.id);
      // No structure artifacts were published for the failed run.
      expect(artifacts.ok).toBe(false);
      const retried = await rebuilt.importer.retry(harness.ctx('retry'), result.data.id);
      expect(retried.ok).toBe(true);
      if (!retried.ok) return;
      expect(retried.data.failedPages).toEqual([1]);
    } finally {
      await harness.cleanup();
    }
  });

  it('has an error code for every failure in the importer taxonomy', async () => {
    expect(IMPORTER_ERROR_CODES.length).toBeGreaterThanOrEqual(25);
    for (const code of IMPORTER_ERROR_CODES) {
      const info = importerError(code as ImporterErrorCode);
      expect(info.code).toBe(code);
      expect(info.message.length).toBeGreaterThan(0);
      expect(typeof info.retryable).toBe('boolean');
    }
  });
});
