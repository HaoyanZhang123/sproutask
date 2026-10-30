/**
 * Single writer lock for the journal.
 *
 * A second storage instance (same or another process) must not append. A lock
 * left behind by a crashed process is reclaimed when its pid is dead. A lock
 * whose holder cannot be trusted after the stale TTL (for example the pid was
 * reused by an unrelated process) is reclaimed as well.
 *
 * The TTL is based on the lock file's mtime, and a live holder refreshes that
 * mtime with a heartbeat. Without the heartbeat a long-running process would
 * look "stale" after `lockStaleMs` and a second writer could steal the journal,
 * so the heartbeat is what makes TTL-based reclamation safe.
 */

import {
  closeSync,
  existsSync,
  fsyncSync,
  openSync,
  readFileSync,
  statSync,
  unlinkSync,
  utimesSync,
  writeFileSync,
  writeSync,
} from 'node:fs';
import type { Clock, IdGenerator, ServiceResult, Timestamp } from '@edu/domain';
import { errResult, okResult } from '@edu/domain';

/** Default TTL after which a lock is considered stale even if its pid looks alive. */
export const DEFAULT_LOCK_STALE_MS = 120_000;

export interface WriterLock {
  readonly path: string;
  readonly token: string;
  readonly pid: number;
  readonly createdAt: Timestamp;
  release(): void;
}

interface LockMetadata {
  readonly schemaVersion: 1;
  readonly pid: number;
  readonly token: string;
  readonly createdAt: Timestamp;
}

export type LockReclaimReason =
  | 'holder_dead'
  | 'stale_timeout'
  | 'unreadable_lock';

export interface LockReclaim {
  readonly reason: LockReclaimReason;
  readonly pid: number | null;
  readonly ageMs: number | null;
  readonly staleMs: number;
  readonly token: string | null;
}

/** Audit record emitted when a stale lock is reclaimed (`kind=lock.reclaimed`). */
export interface LockAuditEvent {
  readonly kind: 'lock.reclaimed';
  readonly subject: string;
  readonly reason: LockReclaimReason;
  readonly detail: Readonly<Record<string, unknown>>;
}

export type LockAuditSink = (event: LockAuditEvent) => void;

function isPidAlive(pid: number): boolean {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    // EPERM means the process exists but we cannot signal it.
    return code === 'EPERM';
  }
}

function readMetadata(lockPath: string): LockMetadata | null {
  try {
    const parsed: unknown = JSON.parse(readFileSync(lockPath, 'utf8'));
    if (
      parsed !== null &&
      typeof parsed === 'object' &&
      Number.isInteger((parsed as LockMetadata).pid) &&
      typeof (parsed as LockMetadata).token === 'string'
    ) {
      return parsed as LockMetadata;
    }
    return null;
  } catch {
    return null;
  }
}

function clockNow(clock: Clock): number {
  const parsed = Date.parse(clock.now());
  return Number.isFinite(parsed) ? parsed : Date.now();
}

/** Age of the lock from both its mtime and its recorded createdAt (max). */
function lockAgeMs(lockPath: string, nowMs: number, createdAt?: string): number | null {
  let mtimeAge: number | null = null;
  try {
    mtimeAge = Math.max(0, nowMs - statSync(lockPath).mtimeMs);
  } catch {
    mtimeAge = null;
  }
  let createdAge: number | null = null;
  if (createdAt !== undefined) {
    const parsed = Date.parse(createdAt);
    if (Number.isFinite(parsed)) createdAge = Math.max(0, nowMs - parsed);
  }
  if (mtimeAge === null) return createdAge;
  if (createdAge === null) return mtimeAge;
  return Math.max(mtimeAge, createdAge);
}

function emitAudit(
  sink: LockAuditSink | undefined,
  event: LockAuditEvent,
): void {
  if (sink === undefined) return;
  try {
    sink(event);
  } catch {
    // Auditing must never prevent recovery or corrupt the lock decision.
  }
}

export interface AcquireLockOptions {
  readonly clock: Clock;
  readonly ids: IdGenerator;
  readonly staleMs?: number;
  /** Receives `lock.reclaimed` so the host can write its runtime audit log. */
  readonly onAudit?: LockAuditSink;
}

export interface AcquireLockResult {
  readonly lock: WriterLock;
  /** Non-null when an existing lock was reclaimed during acquisition. */
  readonly reclaimed: LockReclaim | null;
}

/**
 * Refresh the lock metadata/mtime while it is held. `unref()` keeps the timer
 * from keeping the process alive; the timer is cleared on release. Refreshing
 * `createdAt` as well as mtime keeps the TTL correct even if a tool only looks
 * at the recorded timestamp.
 */
function startHeartbeat(
  lockPath: string,
  staleMs: number,
  pid: number,
  token: string,
): NodeJS.Timeout {
  const interval = Math.max(1_000, Math.floor(staleMs / 3));
  const timer = setInterval(() => {
    try {
      const now = new Date();
      const current: LockMetadata = {
        schemaVersion: 1,
        pid,
        token,
        createdAt: now.toISOString(),
      };
      writeFileSync(lockPath, `${JSON.stringify(current)}\n`, 'utf8');
      utimesSync(lockPath, now, now);
    } catch {
      // If the file disappeared, release/recovery handles it.
    }
  }, interval);
  timer.unref?.();
  return timer;
}

export function acquireWriterLock(
  lockPath: string,
  options: AcquireLockOptions,
): ServiceResult<AcquireLockResult> {
  const staleMs = options.staleMs ?? DEFAULT_LOCK_STALE_MS;
  const token = options.ids.next('lock');
  const createdAt = options.clock.now();
  const metadata: LockMetadata = { schemaVersion: 1, pid: process.pid, token, createdAt };
  let reclaimed: LockReclaim | null = null;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const fd = openSync(lockPath, 'wx');
      try {
        writeSync(fd, `${JSON.stringify(metadata)}\n`, null, 'utf8');
        fsyncSync(fd);
      } finally {
        closeSync(fd);
      }
      const heartbeat = startHeartbeat(lockPath, staleMs, process.pid, token);
      return okResult(
        {
          lock: {
            path: lockPath,
            token,
            pid: process.pid,
            createdAt,
            release: () => {
              clearInterval(heartbeat);
              releaseWriterLock(lockPath, token);
            },
          },
          reclaimed,
        },
        0,
      );
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') {
        return errResult(
          'STORAGE_FAILED',
          `cannot create journal lock: ${(error as Error).message}`,
          true,
        );
      }
      const nowMs = clockNow(options.clock);
      const existing = readMetadata(lockPath);
      if (existing !== null) {
        const alive = isPidAlive(existing.pid);
        const ageMs = lockAgeMs(lockPath, nowMs, existing.createdAt);
        // A live pid younger than the TTL is a real writer. A live pid older
        // than the TTL is likely pid reuse, so the lock is reclaimed.
        if (alive && (ageMs === null || ageMs < staleMs)) {
          return errResult(
            'CONFLICT',
            `journal is locked by pid ${existing.pid}; only one writer instance is allowed`,
            false,
          );
        }
        const reclaim: LockReclaim = {
          reason: alive ? 'stale_timeout' : 'holder_dead',
          pid: existing.pid,
          ageMs,
          staleMs,
          token: existing.token,
        };
        reclaimed = reclaim;
        try {
          unlinkSync(lockPath);
        } catch (unlinkError) {
          return errResult(
            'STORAGE_FAILED',
            `stale journal lock could not be removed: ${(unlinkError as Error).message}`,
            true,
          );
        }
        emitAudit(options.onAudit, {
          kind: 'lock.reclaimed',
          subject: lockPath,
          reason: reclaim.reason,
          detail: {
            pid: reclaim.pid,
            ageMs: reclaim.ageMs,
            staleMs: reclaim.staleMs,
            token: reclaim.token,
          },
        });
        // Crashed/stale writer: reclaim the lock once and retry acquisition.
        continue;
      }
      // Unreadable/empty lock: only reclaim after the stale TTL.
      const ageMs = lockAgeMs(lockPath, nowMs);
      if (ageMs !== null && ageMs >= staleMs) {
        try {
          unlinkSync(lockPath);
        } catch (unlinkError) {
          return errResult(
            'STORAGE_FAILED',
            `unreadable journal lock could not be removed: ${(unlinkError as Error).message}`,
            true,
          );
        }
        emitAudit(options.onAudit, {
          kind: 'lock.reclaimed',
          subject: lockPath,
          reason: 'unreadable_lock',
          detail: { pid: null, ageMs, staleMs, token: null },
        });
        reclaimed = {
          reason: 'unreadable_lock',
          pid: null,
          ageMs,
          staleMs,
          token: null,
        };
        continue;
      }
      return errResult(
        'CONFLICT',
        'journal lock exists but is unreadable; wait for the stale TTL or remove it after confirming no writer is alive',
        false,
      );
    }
  }
  return errResult('CONFLICT', 'journal lock could not be acquired', false);
}

export function releaseWriterLock(lockPath: string, token: string): void {
  if (!existsSync(lockPath)) return;
  const metadata = readMetadata(lockPath);
  if (metadata !== null && metadata.token !== token) return;
  try {
    unlinkSync(lockPath);
  } catch {
    // Releasing a lock must never throw on shutdown; stale recovery handles it.
  }
}
