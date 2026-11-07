import { existsSync, mkdirSync, readFileSync, statSync, utimesSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  baseOptions,
  cleanup,
  journalCommand,
  openStorage,
  requestContext,
  tmpRoot,
} from './helpers.js';
import { StorageService, type LockAuditEvent } from '../src/index.js';

let root: string;

beforeEach(() => {
  root = tmpRoot('journal');
});

afterEach(() => {
  cleanup(root);
});

function journalFile(): string {
  return path.join(root, 'journal', 'events.jsonl');
}

function journalLines(): string[] {
  if (!existsSync(journalFile())) return [];
  return readFileSync(journalFile(), 'utf8')
    .split(/\r?\n/)
    .filter((line) => line.length > 0);
}

describe('single writer JSONL journal', () => {
  it('appends complete commands with server assigned monotonic seq', async () => {
    const storage = await openStorage(root);
    try {
      const first = await storage.append(requestContext('req.1'), journalCommand('req.1'));
      const second = await storage.append(requestContext('req.2'), journalCommand('req.2'));
      expect(first.ok).toBe(true);
      expect(second.ok).toBe(true);
      if (first.ok) expect(first.data).toMatchObject({ seq: 1, revision: 1, duplicate: false });
      if (second.ok) expect(second.data).toMatchObject({ seq: 2, revision: 2, duplicate: false });

      const slice = await storage.readFrom(requestContext('req.read'), 0, 10);
      expect(slice.ok).toBe(true);
      if (slice.ok) {
        expect(slice.data.commits.map((commit) => commit.seq)).toEqual([1, 2]);
        expect(slice.data.lastSeq).toBe(2);
        expect(slice.data.hasMore).toBe(false);
        expect(slice.data.corrupted).toBe(false);
      }
      const latest = await storage.latestSeq(requestContext('req.seq'));
      expect(latest.ok && latest.data.lastSeq).toBe(2);

      const lines = journalLines();
      expect(lines).toHaveLength(2);
      expect(JSON.parse(lines[0] as string).seq).toBe(1);
      expect(JSON.parse(lines[1] as string).seq).toBe(2);
    } finally {
      storage.close();
    }
  });

  it('deduplicates a requestId persistently and returns the original receipt', async () => {
    const storage = await openStorage(root);
    try {
      const first = await storage.append(requestContext('req.duplicate'), journalCommand('req.duplicate'));
      // 真正的重发：同一条命令（同 type/payload），只有 eventId 与时间可能不同。
      const retry = await storage.append(
        requestContext('req.duplicate'),
        journalCommand('req.duplicate', { eventId: 'event.other' }),
      );
      expect(first.ok).toBe(true);
      expect(retry.ok).toBe(true);
      if (first.ok && retry.ok) {
        expect(retry.data.duplicate).toBe(true);
        expect(retry.data.seq).toBe(first.data.seq);
        expect(retry.data.eventId).toBe(first.data.eventId);
      }
      expect(journalLines()).toHaveLength(1);

      // Persistence: reopening keeps the dedupe index.
      storage.close();
      const reopened = await openStorage(root);
      try {
        const afterReopen = await reopened.append(
          requestContext('req.duplicate'),
          journalCommand('req.duplicate'),
        );
        expect(afterReopen.ok && afterReopen.data.duplicate).toBe(true);
        expect(journalLines()).toHaveLength(1);
      } finally {
        reopened.close();
      }
    } finally {
      storage.close();
    }
  });

  it('rejects a reused requestId that carries a different command instead of dropping it', async () => {
    const storage = await openStorage(root);
    try {
      const first = await storage.append(requestContext('req.reused'), journalCommand('req.reused'));
      expect(first.ok).toBe(true);

      // 不同命令撞了同一个 requestId：不能静默当成重发（那会丢新数据）。
      const reused = await storage.append(
        requestContext('req.reused'),
        journalCommand('req.reused', { payload: { note: 'different command' } }),
      );
      expect(reused.ok).toBe(false);
      if (!reused.ok) expect(reused.error.code).toBe('CONFLICT');
      expect(journalLines()).toHaveLength(1);
    } finally {
      storage.close();
    }
  });

  it('rejects invalid commands and learner/request mismatches before writing', async () => {
    const storage = await openStorage(root);
    try {
      const badPayload = {
        ...journalCommand('req.bad'),
        payload: 'not-an-object' as unknown as Record<string, unknown>,
      };
      const invalid = await storage.append(requestContext('req.bad'), badPayload);
      expect(invalid.ok).toBe(false);
      if (!invalid.ok) expect(invalid.error.code).toBe('VALIDATION_FAILED');

      const mismatch = await storage.append(requestContext('req.ctx'), journalCommand('req.command'));
      expect(mismatch.ok).toBe(false);
      if (!mismatch.ok) expect(mismatch.error.code).toBe('INVALID_INPUT');

      const forgedLearner = await storage.append(
        requestContext('req.learner'),
        journalCommand('req.learner', { learnerId: 'learner.other' }),
      );
      expect(forgedLearner.ok).toBe(false);
      if (!forgedLearner.ok) expect(forgedLearner.error.code).toBe('UNAUTHORIZED');
      expect(journalLines()).toHaveLength(0);
    } finally {
      storage.close();
    }
  });

  it('refuses a second writer instance until the first closes', async () => {
    const first = await openStorage(root);
    const second = await StorageService.open(baseOptions(root));
    expect(second.ok).toBe(false);
    if (!second.ok) {
      expect(second.error.code).toBe('CONFLICT');
      expect(second.error.message).toContain('only one writer instance');
    }
    first.close();
    expect(existsSync(path.join(root, 'journal', 'events.lock'))).toBe(false);
    const third = await StorageService.open(baseOptions(root));
    expect(third.ok).toBe(true);
    if (third.ok) third.data.close();
  });

  it('reclaims a lock left behind by a dead process', async () => {
    const child = spawnSync(process.execPath, ['-e', '0'], { stdio: 'ignore' });
    expect(child.pid).toBeGreaterThan(0);
    mkdirSync(path.join(root, 'journal'), { recursive: true });
    writeFileSync(
      path.join(root, 'journal', 'events.lock'),
      `${JSON.stringify({
        schemaVersion: 1,
        pid: child.pid,
        token: 'dead-writer',
        createdAt: '2026-10-28T09:00:00Z',
      })}\n`,
      'utf8',
    );
    const storage = await openStorage(root);
    try {
      expect(storage.status.mode).toBe('writable');
      expect(storage.status.lockHeld).toBe(true);
    } finally {
      storage.close();
    }
    expect(existsSync(path.join(root, 'journal', 'events.lock'))).toBe(false);
  });

  it('reclaims a stale lock whose pid was reused and records lock.reclaimed (F8)', async () => {
    mkdirSync(path.join(root, 'journal'), { recursive: true });
    const lockPath = path.join(root, 'journal', 'events.lock');
    // The recorded pid is this very process, but the lock is old: this is the
    // pid-reuse accident that used to block plugin startup forever.
    writeFileSync(
      lockPath,
      `${JSON.stringify({
        schemaVersion: 1,
        pid: process.pid,
        token: 'reused-pid-writer',
        createdAt: '2020-01-01T00:00:00Z',
      })}\n`,
      'utf8',
    );
    utimesSync(lockPath, new Date('2020-01-01T00:00:00Z'), new Date('2020-01-01T00:00:00Z'));
    const audit: LockAuditEvent[] = [];
    const clock = { now: () => new Date().toISOString() };
    const storage = await openStorage(root, { clock, onAudit: (event) => audit.push(event) });
    try {
      expect(storage.status.mode).toBe('writable');
      expect(storage.status.lockHeld).toBe(true);
      expect(storage.status.lockReclaimed?.reason).toBe('stale_timeout');
      expect(storage.recoveryReport().recoverySteps.some((step) => step.startsWith('lock.reclaimed:stale_timeout'))).toBe(true);
      expect(audit).toHaveLength(1);
      expect(audit[0]).toMatchObject({
        kind: 'lock.reclaimed',
        subject: lockPath,
        reason: 'stale_timeout',
      });
    } finally {
      storage.close();
    }
  });

  it('reclaims an unreadable lock only after the configured TTL (F8)', async () => {
    mkdirSync(path.join(root, 'journal'), { recursive: true });
    const lockPath = path.join(root, 'journal', 'events.lock');
    writeFileSync(lockPath, 'not-json\n', 'utf8');
    utimesSync(lockPath, new Date('2020-01-01T00:00:00Z'), new Date('2020-01-01T00:00:00Z'));
    const audit: LockAuditEvent[] = [];
    const clock = { now: () => new Date().toISOString() };
    const storage = await openStorage(root, {
      clock,
      lockStaleMs: 5_000,
      onAudit: (event) => audit.push(event),
    });
    try {
      expect(storage.status.mode).toBe('writable');
      expect(storage.status.lockReclaimed?.reason).toBe('unreadable_lock');
      expect(audit[0]?.reason).toBe('unreadable_lock');
    } finally {
      storage.close();
    }
  });

  it('refuses a live lock younger than the TTL (F8)', async () => {
    mkdirSync(path.join(root, 'journal'), { recursive: true });
    const lockPath = path.join(root, 'journal', 'events.lock');
    writeFileSync(
      lockPath,
      `${JSON.stringify({
        schemaVersion: 1,
        pid: process.pid,
        token: 'live-writer',
        createdAt: new Date().toISOString(),
      })}\n`,
      'utf8',
    );
    const audit: LockAuditEvent[] = [];
    const clock = { now: () => new Date().toISOString() };
    const opened = await StorageService.open(
      baseOptions(root, { clock, lockStaleMs: 120_000, onAudit: (event) => audit.push(event) }),
    );
    expect(opened.ok).toBe(false);
    if (!opened.ok) {
      expect(opened.error.code).toBe('CONFLICT');
      expect(opened.error.message).toContain('only one writer instance');
    }
    expect(audit).toEqual([]);
    // The refused open must not delete someone else's live lock.
    expect(existsSync(lockPath)).toBe(true);
  });

  it('surfaces disk-full/permission write failures and does not fake a save', async () => {
    const io: { beforeAppend?: () => void } = {
      beforeAppend: () => {
        throw new Error('ENOSPC: no space left on device');
      },
    };
    const storage = await openStorage(root, { io });
    try {
      const failed = await storage.append(requestContext('req.fail'), journalCommand('req.fail'));
      expect(failed.ok).toBe(false);
      if (!failed.ok) {
        expect(failed.error.code).toBe('STORAGE_FAILED');
        expect(failed.error.retryable).toBe(true);
        expect(failed.error.message).toContain('ENOSPC');
      }
      expect(existsSync(journalFile()) ? readFileSync(journalFile(), 'utf8') : '').toBe('');
      const latestAfterFailure = await storage.latestSeq(requestContext('req.seq.fail'));
      expect(latestAfterFailure.ok && latestAfterFailure.data.lastSeq).toBe(0);

      io.beforeAppend = undefined;
      const recovered = await storage.append(requestContext('req.fail'), journalCommand('req.fail'));
      expect(recovered.ok).toBe(true);
      if (recovered.ok) expect(recovered.data.seq).toBe(1);
      expect(journalLines()).toHaveLength(1);
    } finally {
      storage.close();
    }
  });

  it('rejects appends after close and supports paged reads', async () => {
    const storage = await openStorage(root);
    for (let index = 1; index <= 3; index += 1) {
      const receipt = await storage.append(requestContext(`req.p${index}`), journalCommand(`req.p${index}`));
      expect(receipt.ok).toBe(true);
    }
    const page1 = await storage.readFrom(requestContext('req.page'), 0, 2);
    expect(page1.ok).toBe(true);
    if (page1.ok) {
      expect(page1.data.commits).toHaveLength(2);
      expect(page1.data.hasMore).toBe(true);
    }
    const page2 = await storage.readFrom(requestContext('req.page'), 2, 2);
    expect(page2.ok).toBe(true);
    if (page2.ok) {
      expect(page2.data.commits.map((commit) => commit.seq)).toEqual([3]);
      expect(page2.data.hasMore).toBe(false);
    }
    storage.close();
    const afterClose = await storage.append(requestContext('req.closed'), journalCommand('req.closed'));
    expect(afterClose.ok).toBe(false);
    if (!afterClose.ok) expect(afterClose.error.code).toBe('STORAGE_FAILED');
    const sizeBefore = statSync(journalFile()).size;
    expect(sizeBefore).toBeGreaterThan(0);
  });

  it('isolates learners in the same storage root (M-01)', async () => {
    const storage = await openStorage(root);
    try {
      const learnerA = { learnerId: 'learner.a' };
      const learnerB = { learnerId: 'learner.b' };
      const appendA = await storage.append(
        requestContext('req.a', learnerA),
        journalCommand('req.a', learnerA),
      );
      const appendB = await storage.append(
        requestContext('req.b', learnerB),
        journalCommand('req.b', learnerB),
      );
      expect(appendA.ok && appendA.data.seq).toBe(1);
      expect(appendB.ok && appendB.data.seq).toBe(2);

      const readA = await storage.readFrom(requestContext('req.read.a', learnerA), 0, 10);
      expect(readA.ok).toBe(true);
      if (readA.ok) {
        expect(readA.data.commits.map((commit) => commit.learnerId)).toEqual(['learner.a']);
        expect(readA.data.commits.map((commit) => commit.seq)).toEqual([1]);
        expect(readA.data.lastSeq).toBe(1);
        expect(readA.data.hasMore).toBe(false);
      }
      const readB = await storage.readFrom(requestContext('req.read.b', learnerB), 0, 10);
      expect(readB.ok).toBe(true);
      if (readB.ok) {
        expect(readB.data.commits.map((commit) => commit.learnerId)).toEqual(['learner.b']);
        expect(readB.data.commits.map((commit) => commit.seq)).toEqual([2]);
        expect(readB.data.lastSeq).toBe(2);
      }
      // A learner with no rows must not see another learner's rows or their seq.
      const readUnknown = await storage.readFrom(
        requestContext('req.read.c', { learnerId: 'learner.c' }),
        0,
        10,
      );
      expect(readUnknown.ok).toBe(true);
      if (readUnknown.ok) {
        expect(readUnknown.data.commits).toEqual([]);
        expect(readUnknown.data.lastSeq).toBe(0);
        expect(readUnknown.data.hasMore).toBe(false);
      }
      const latestA = await storage.latestSeq(requestContext('req.latest.a', learnerA));
      expect(latestA.ok && latestA.data.lastSeq).toBe(1);
      const latestUnknown = await storage.latestSeq(
        requestContext('req.latest.c', { learnerId: 'learner.c' }),
      );
      expect(latestUnknown.ok && latestUnknown.data.lastSeq).toBe(0);
    } finally {
      storage.close();
    }
  });

  it('rejects invalid read windows', async () => {
    const storage = await openStorage(root);
    try {
      const badLimit = await storage.readFrom(requestContext('req.read'), 0, 0);
      expect(badLimit.ok).toBe(false);
      if (!badLimit.ok) expect(badLimit.error.code).toBe('INVALID_INPUT');
      const badFrom = await storage.readFrom(requestContext('req.read'), -1, 10);
      expect(badFrom.ok).toBe(false);
    } finally {
      storage.close();
    }
  });
});
