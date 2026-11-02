/**
 * Storage root layout and path safety.
 *
 * All deletion/export operations resolve absolute paths and verify they stay
 * inside the storage root; symlinked escapes are rejected via realpath.
 */

import { createHash } from 'node:crypto';
import {
  existsSync,
  mkdirSync,
  readFileSync,
  realpathSync,
  statSync,
} from 'node:fs';
import path from 'node:path';

export interface StoragePaths {
  readonly root: string;
  readonly journalDir: string;
  readonly journalFile: string;
  readonly lockFile: string;
  readonly quarantineDir: string;
  readonly snapshotsDir: string;
  readonly migrationDir: string;
  readonly receiptsDir: string;
  readonly trashDir: string;
}

export class StoragePathError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'StoragePathError';
  }
}

export function resolveStorageRoot(root: string): string {
  if (typeof root !== 'string' || root.trim().length === 0) {
    throw new StoragePathError('storage root must be a non-empty path');
  }
  if (!path.isAbsolute(root)) {
    throw new StoragePathError('storage root must be an absolute path');
  }
  return path.resolve(root);
}

export function createStoragePaths(rootInput: string): StoragePaths {
  const root = resolveStorageRoot(rootInput);
  const journalDir = path.join(root, 'journal');
  return {
    root,
    journalDir,
    journalFile: path.join(journalDir, 'events.jsonl'),
    lockFile: path.join(journalDir, 'events.lock'),
    quarantineDir: path.join(journalDir, 'quarantine'),
    snapshotsDir: path.join(root, 'snapshots'),
    migrationDir: path.join(root, 'migration'),
    receiptsDir: path.join(root, 'receipts'),
    trashDir: path.join(root, '.trash'),
  };
}

export function ensureStorageDirs(paths: StoragePaths): void {
  for (const dir of [
    paths.root,
    paths.journalDir,
    paths.quarantineDir,
    paths.snapshotsDir,
    paths.migrationDir,
    paths.receiptsDir,
    paths.trashDir,
  ]) {
    mkdirSync(dir, { recursive: true });
  }
}

export function isInside(root: string, target: string): boolean {
  const relative = path.relative(path.resolve(root), path.resolve(target));
  return relative.length > 0 && relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative);
}

/** Resolve a root-relative path, rejecting traversal. */
export function resolveInside(paths: StoragePaths, relative: string): string {
  const target = path.resolve(paths.root, relative);
  if (!isInside(paths.root, target)) {
    throw new StoragePathError(`path escapes the storage root: ${relative}`);
  }
  return target;
}

/**
 * Validate an absolute target for deletion: it must exist (or its parent must),
 * resolve inside the root, and the root itself cannot be deleted.
 */
export function assertDeleteTarget(paths: StoragePaths, target: string): string {
  const resolved = path.resolve(target);
  if (resolved === paths.root) {
    throw new StoragePathError('refusing to delete the storage root itself');
  }
  if (!isInside(paths.root, resolved)) {
    throw new StoragePathError(`delete target escapes the storage root: ${target}`);
  }
  if (existsSync(resolved)) {
    const real = realpathSync(resolved);
    const realRoot = realpathSync(paths.root);
    if (!isInside(realRoot, real) && real !== realRoot) {
      throw new StoragePathError(`delete target resolves outside the storage root via symlink: ${target}`);
    }
    return real;
  }
  return resolved;
}

export function sha256Text(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

export function sha256File(file: string): string {
  const stats = statSync(file);
  if (!stats.isFile()) throw new StoragePathError(`not a file: ${file}`);
  return createHash('sha256').update(readFileSync(file)).digest('hex');
}

/** Safe file-name component for learner scoped snapshots. */
export function safeFileName(value: string): string {
  const encoded = Buffer.from(value, 'utf8').toString('base64url');
  if (encoded.length === 0) throw new StoragePathError('empty identifier cannot be used as a file name');
  return encoded;
}

/** Filesystem-friendly UTC stamp derived from an injected clock value. */
export function fileStamp(timestamp: string): string {
  return timestamp.replace(/[^0-9A-Za-z]/g, '-');
}

export function countLines(text: string): number {
  if (text.length === 0) return 0;
  return text.split(/\r?\n/).filter((line) => line.length > 0).length;
}
