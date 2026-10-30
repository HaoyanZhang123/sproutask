/**
 * Managed source assets (T03 step 1, 06 §4 "教材读取限制到用户显式导入资产").
 *
 * The public API only accepts a host-managed asset handle plus explicitly
 * confirmed metadata. Paths are resolved by the host, re-checked against the
 * allowed roots (symlinks resolved), hashed locally, and probed as PDFs before
 * anything is cached or published.
 */

import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { realpath, stat } from 'node:fs/promises';
import path from 'node:path';

import { isManagedAssetId, type ManagedFileHandle } from '@edu/domain';

import { fail, importerError, ok, type ImporterResult } from './errors.js';
import type { ImportBackend, ManagedAssetStore, PdfProbe } from './import/types.js';

export interface VerifiedAsset {
  readonly assetId: string;
  readonly absolutePath: string;
  readonly sha256: string;
  readonly sizeBytes: number;
  readonly probe: PdfProbe;
}

export async function sha256File(absolutePath: string): Promise<string> {
  const hash = createHash('sha256');
  await new Promise<void>((resolve, reject) => {
    const stream = createReadStream(absolutePath);
    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('end', () => resolve());
    stream.on('error', reject);
  });
  return hash.digest('hex');
}

export function sha256Bytes(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex');
}

function normalizeForCompare(value: string): string {
  const resolved = path.resolve(value);
  return process.platform === 'win32' ? resolved.toLowerCase() : resolved;
}

/** True when `candidate` (already resolved) is inside one of the allowed roots. */
export function isInsideRoots(candidate: string, allowedRoots: readonly string[]): boolean {
  const target = normalizeForCompare(candidate);
  return allowedRoots.some((root) => {
    const normalizedRoot = normalizeForCompare(root);
    return target === normalizedRoot || target.startsWith(`${normalizedRoot}${path.sep}`);
  });
}

export interface VerifyAssetInput {
  readonly store: ManagedAssetStore;
  readonly handle: ManagedFileHandle;
  readonly backend: ImportBackend;
  /** Host-confirmed page count; null means "not confirmed yet". */
  readonly confirmedPageCount: number | null;
}

/**
 * Validates a managed asset end to end: handle shape, path containment,
 * existence, content hash and PDF structure (encryption/page count).
 */
export async function verifyManagedAsset(input: VerifyAssetInput): Promise<ImporterResult<VerifiedAsset>> {
  const { store, handle, backend, confirmedPageCount } = input;

  if (!isManagedAssetId(handle.assetId)) return fail(importerError('ASSET_HANDLE_INVALID'));

  const resolved = await store.resolve(handle.assetId);
  if (resolved === null) return fail(importerError('ASSET_NOT_FOUND'));

  if (!path.isAbsolute(resolved.absolutePath)) return fail(importerError('ASSET_HANDLE_INVALID'));

  let real: string;
  try {
    real = await realpath(resolved.absolutePath);
  } catch {
    return fail(importerError('ASSET_NOT_FOUND'));
  }
  if (!isInsideRoots(real, store.allowedRoots)) return fail(importerError('ASSET_PATH_OUTSIDE_ROOT'));

  let stats;
  try {
    stats = await stat(real);
  } catch {
    return fail(importerError('ASSET_NOT_FOUND'));
  }
  if (!stats.isFile()) return fail(importerError('ASSET_NOT_A_FILE'));

  let actualSha256: string;
  try {
    actualSha256 = await sha256File(real);
  } catch {
    return fail(importerError('PDF_READ_FAILED'));
  }
  if (actualSha256 !== handle.sha256.toLowerCase()) {
    return fail(importerError('ASSET_HASH_MISMATCH', { detailsRef: `sha256:${actualSha256.slice(0, 12)}` }));
  }

  let probe: PdfProbe;
  try {
    probe = await backend.probePdf(real);
  } catch (error) {
    return fail(toProbeError(error));
  }
  if (probe.encrypted) return fail(importerError('PDF_ENCRYPTED'));
  if (probe.pageCount < 1) return fail(importerError('PDF_NO_PAGES'));
  if (confirmedPageCount !== null && confirmedPageCount !== probe.pageCount) {
    return fail(
      importerError('ASSET_METADATA_MISMATCH', {
        detailsRef: `confirmed:${confirmedPageCount};actual:${probe.pageCount}`,
      }),
    );
  }

  return ok({
    assetId: handle.assetId,
    absolutePath: real,
    sha256: actualSha256,
    sizeBytes: stats.size,
    probe,
  });
}

function toProbeError(error: unknown): ReturnType<typeof importerError> {
  const code = (error as { info?: { code?: string } } | null)?.info?.code;
  if (code === 'PDF_ENCRYPTED' || code === 'PDF_CORRUPT' || code === 'PDF_NO_PAGES' || code === 'UNSUPPORTED') {
    return importerError(code as 'PDF_ENCRYPTED' | 'PDF_CORRUPT' | 'PDF_NO_PAGES' | 'UNSUPPORTED');
  }
  return importerError('PDF_READ_FAILED');
}

const ASSET_ID_PREFIX = 'asset:pg-';

/**
 * File-system backed managed asset store.
 *
 * `allowedRoots` are explicit host grants (for the benchmark run the real
 * textbook lives outside the education tree, so the CLI adds the workspace
 * root explicitly). Produced page images get deterministic content-hash ids so
 * the same page is never stored twice and a different scan never reuses them.
 */
export class FileAssetStore implements ManagedAssetStore {
  readonly allowedRoots: readonly string[];
  private readonly assetDir: string;
  private readonly sources = new Map<string, string>();

  constructor(i: { readonly rootDir: string; readonly allowedRoots?: readonly string[] }) {
    const root = path.resolve(i.rootDir);
    this.assetDir = path.join(root, 'assets', 'pages');
    this.allowedRoots = [root, ...(i.allowedRoots ?? []).map((entry) => path.resolve(entry))];
  }

  /**
   * Host-side registration of an imported source file. The path must still be
   * inside `allowedRoots`; containment is re-checked on every resolve.
   */
  register(assetId: string, absolutePath: string): void {
    if (!isManagedAssetId(assetId)) throw importerError('ASSET_HANDLE_INVALID');
    this.sources.set(assetId, absolutePath);
  }

  async resolve(assetId: string): Promise<{ readonly absolutePath: string } | null> {
    if (!isManagedAssetId(assetId)) return null;
    const registered = this.sources.get(assetId);
    if (registered !== undefined) return { absolutePath: registered };
    if (!assetId.startsWith(ASSET_ID_PREFIX)) {
      // Imported source files are registered by the host, not by this store.
      return null;
    }
    const digest = assetId.slice(ASSET_ID_PREFIX.length);
    if (!/^[a-f0-9]{16,64}$/.test(digest)) return null;
    const absolutePath = path.join(this.assetDir, digest.slice(0, 2), `${digest}.png`);
    return { absolutePath };
  }

  async put(input: {
    readonly bytes: Uint8Array;
    readonly fileName: string;
    readonly sha256: string;
  }): Promise<{ readonly assetId: string; readonly relativePath: string }> {
    const { mkdir, writeFile } = await import('node:fs/promises');
    const digest = input.sha256.slice(0, 32);
    const relativePath = path.join('assets', 'pages', digest.slice(0, 2), `${digest}.png`);
    const absolutePath = path.join(path.resolve(this.assetDir, '..', '..'), relativePath);
    await mkdir(path.dirname(absolutePath), { recursive: true });
    await writeFile(absolutePath, input.bytes);
    return { assetId: `${ASSET_ID_PREFIX}${digest}`, relativePath };
  }
}
