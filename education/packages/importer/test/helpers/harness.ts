/**
 * Test harness: temporary workspace root, managed asset store, fixed clock and
 * deterministic ids. Tests never touch the real `.local/` directories.
 */

import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path, { dirname, join } from 'node:path';

import type { Clock, Id, IdGenerator, ManagedFileHandle, RequestContext } from '@edu/domain';

import { FileAssetStore, sha256Bytes } from '../../src/assets.js';
import { PdfDocumentBackend } from '../../src/engines/pdf-backend.js';
import { FakeOcrPort, type FakeOcrOptions } from '../../src/engines/fake-ocr.js';
import { createImporter, type Importer } from '../../src/importer.js';
import type { BookBindingPort, ManagedAssetStore } from '../../src/import/types.js';

export class FixedClock implements Clock {
  private millis: number;

  constructor(startIso = '2026-10-29T10:00:00.000Z') {
    this.millis = Date.parse(startIso);
  }

  now(): string {
    return new Date(this.millis).toISOString().replace(/\.\d{3}Z$/, 'Z');
  }

  advance(ms: number): void {
    this.millis += ms;
  }
}

export class SequentialIds implements IdGenerator {
  private counter = 0;

  next(prefix: string): Id {
    this.counter += 1;
    return `${prefix}:${String(this.counter).padStart(6, '0')}`;
  }
}

export class TestAssetStore implements ManagedAssetStore {
  readonly allowedRoots: readonly string[];
  private readonly handles = new Map<string, string>();
  private readonly rootDir: string;
  readonly files = new FileAssetStore({ rootDir: '__unused__' });

  constructor(rootDir: string, options: { readonly extraRoots?: readonly string[] } = {}) {
    this.rootDir = rootDir;
    this.allowedRoots = [path.resolve(rootDir), ...(options.extraRoots ?? []).map((entry) => path.resolve(entry))];
  }

  async registerFile(absolutePath: string): Promise<{ assetId: string; sha256: string; handle: ManagedFileHandle }> {
    const { readFile } = await import('node:fs/promises');
    const bytes = new Uint8Array(await readFile(absolutePath));
    const sha256 = sha256Bytes(bytes);
    const assetId = `asset:test-${sha256.slice(0, 12)}-${this.handles.size}`;
    this.handles.set(assetId, absolutePath);
    return {
      assetId,
      sha256,
      handle: { assetId, sha256, originalName: path.basename(absolutePath) },
    };
  }

  /** Registers a handle whose declared size/hash differs from the file on disk. */
  async registerRaw(assetId: string, absolutePath: string, sha256: string): Promise<ManagedFileHandle> {
    this.handles.set(assetId, absolutePath);
    return { assetId, sha256, originalName: path.basename(absolutePath) };
  }

  async resolve(assetId: string): Promise<{ absolutePath: string } | null> {
    const absolutePath = this.handles.get(assetId);
    return absolutePath === undefined ? null : { absolutePath };
  }

  async put(input: { bytes: Uint8Array; fileName: string; sha256: string }): Promise<{
    assetId: string;
    relativePath: string;
  }> {
    const digest = input.sha256.slice(0, 32);
    const relativePath = join('assets', 'pages', digest.slice(0, 2), `${digest}.png`);
    const absolutePath = join(this.rootDir, relativePath);
    await mkdir(dirname(absolutePath), { recursive: true });
    await writeFile(absolutePath, input.bytes);
    const assetId = `asset:pg-${digest}`;
    this.handles.set(assetId, absolutePath);
    return { assetId, relativePath };
  }
}

export interface TestImporterOptions {
  readonly ocr?: FakeOcrOptions;
  readonly network?: 'available' | 'unavailable';
  readonly cloudConcepts?: {
    extract(input: { jobId: Id; text: string; now: string }): Promise<{ conceptCount: number; costUsd: number | null }>;
  } | null;
  readonly binding?: BookBindingPort;
  readonly assetStore?: ManagedAssetStore;
  readonly batchSize?: number;
}

export interface TestImporter {
  readonly importer: Importer;
  readonly rootDir: string;
  readonly store: TestAssetStore;
  readonly ocr: FakeOcrPort;
  readonly clock: FixedClock;
  readonly ids: SequentialIds;
  ctx(requestId: string): RequestContext;
  cleanup(): Promise<void>;
}

export async function createTestImporter(options: TestImporterOptions = {}): Promise<TestImporter> {
  const rootDir = await mkdtemp(path.join(os.tmpdir(), 't03-importer-'));
  const store = new TestAssetStore(rootDir);
  const clock = new FixedClock();
  const ids = new SequentialIds();
  const ocr = new FakeOcrPort({ writeImages: true, ...options.ocr });
  const backend = new PdfDocumentBackend({ ocr });
  const binding: BookBindingPort = options.binding ?? {
    async bind() {
      return { bookInstanceId: null, baselineSourceId: 'baseline:fixture-1' };
    },
  };
  const importer = createImporter({
    assets: options.assetStore ?? store,
    backend,
    paths: { rootDir },
    clock,
    ids,
    binding,
    network: { status: options.network ?? 'unavailable' },
    cloudConcepts: options.cloudConcepts ?? null,
    ocr: { batchSize: options.batchSize ?? 2, savePageImages: true, targetWidth: 1200 },
  });
  return {
    importer,
    rootDir,
    store,
    ocr,
    clock,
    ids,
    ctx(requestId: string): RequestContext {
      return { requestId, learnerId: 'learner:test', now: clock.now() };
    },
    async cleanup() {
      await rm(rootDir, { recursive: true, force: true });
    },
  };
}

/**
 * Rebuilds the importer against the same local root with a fresh backend,
 * simulating an app restart (cached pages must be reused, not re-extracted).
 */
export function rebuildImporter(
  harness: TestImporter,
  options: TestImporterOptions = {},
): { readonly importer: Importer; readonly ocr: FakeOcrPort } {
  const ocr = new FakeOcrPort({ writeImages: true, ...options.ocr });
  const backend = new PdfDocumentBackend({ ocr });
  const binding: BookBindingPort = options.binding ?? {
    async bind() {
      return { bookInstanceId: null, baselineSourceId: 'baseline:fixture-1' };
    },
  };
  const importer = createImporter({
    assets: options.assetStore ?? harness.store,
    backend,
    paths: { rootDir: harness.rootDir },
    clock: harness.clock,
    ids: harness.ids,
    binding,
    network: { status: options.network ?? 'unavailable' },
    cloudConcepts: options.cloudConcepts ?? null,
    ocr: { batchSize: options.batchSize ?? 2, savePageImages: true, targetWidth: 1200 },
  });
  return { importer, ocr };
}

export async function writeFixture(
  rootDir: string,
  name: string,
  bytes: Uint8Array,
): Promise<string> {
  const absolutePath = path.join(rootDir, 'sources', name);
  await mkdir(path.dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, bytes);
  return absolutePath;
}

export function sha256Of(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex');
}

/** Request helper matching the frozen ImportStartRequest shape. */
export function importRequest(
  handle: ManagedFileHandle,
  pageCount: number | null = null,
): {
  file: ManagedFileHandle;
  confirmedMetadata: { title: string | null; publisher: string | null; editionLabel: string | null; pageCount: number | null } | null;
} {
  return {
    file: handle,
    confirmedMetadata:
      pageCount === null
        ? null
        : { title: '合成教材', publisher: '测试出版社', editionLabel: '第1版', pageCount },
  };
}
