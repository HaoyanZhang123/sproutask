/**
 * Learner snapshots: disposable caches rebuilt from the journal.
 *
 * Save uses temp file + fsync + rename so a crash cannot leave a half snapshot
 * as the latest. Load validates JSON shape, content hash and lastSeq; any bad
 * snapshot falls back to journal replay and is replaced.
 */

import {
  closeSync,
  existsSync,
  fsyncSync,
  openSync,
  readFileSync,
  renameSync,
  unlinkSync,
  writeFileSync,
  writeSync,
} from 'node:fs';
import type { Clock, IdGenerator, ServiceResult, Snapshot } from '@edu/domain';
import {
  checkSnapshotAgainstJournal,
  errResult,
  okResult,
  stableStringify,
  validateSnapshot,
} from '@edu/domain';
import path from 'node:path';
import type { StorageIoHooks, SnapshotLoadReason, SnapshotLoadResult, SnapshotSaveReceipt } from './types.js';
import type { StoragePaths } from './paths.js';
import { fileStamp, safeFileName, sha256Text } from './paths.js';
import type { JournalStore } from './journal.js';
import { replayLearner, replayStatePayload } from './replay.js';

export class SnapshotStore {
  constructor(
    private readonly paths: StoragePaths,
    private readonly journal: JournalStore,
    private readonly clock: Clock,
    private readonly ids: IdGenerator,
    private readonly io: StorageIoHooks = {},
  ) {}

  private fileFor(learnerId: string): string {
    return path.join(this.paths.snapshotsDir, `${safeFileName(learnerId)}.json`);
  }

  save(learnerId: string, lastSeq: number, payload: Record<string, unknown>): ServiceResult<SnapshotSaveReceipt> {
    if (!this.journal.isWritable) {
      return errResult(
        'CONTRACT_REJECTED',
        'snapshot cannot be written while the journal is read-only due to corruption',
        false,
      );
    }
    if (!Number.isInteger(lastSeq) || lastSeq < 0 || lastSeq > this.journal.lastSeq) {
      return errResult(
        'INVALID_INPUT',
        `snapshot lastSeq ${String(lastSeq)} must be between 0 and the journal lastSeq ${this.journal.lastSeq}`,
        false,
      );
    }
    const snapshot: Snapshot = {
      schemaVersion: 1,
      learnerId,
      lastSeq,
      createdAt: this.clock.now(),
      stateHash: sha256Text(stableStringify(payload)),
      payload,
    };
    const file = this.fileFor(learnerId);
    const replaced = existsSync(file);
    const temp = `${file}.tmp-${fileStamp(this.ids.next('snapshot'))}`;
    const content = `${JSON.stringify(snapshot, null, 2)}\n`;
    try {
      this.io.beforeSnapshot?.();
      const fd = openSync(temp, 'w');
      try {
        writeSync(fd, content, null, 'utf8');
        fsyncSync(fd);
      } finally {
        closeSync(fd);
      }
      renameSync(temp, file);
    } catch (error) {
      try {
        if (existsSync(temp)) unlinkSync(temp);
      } catch {
        // the temp file is harmless; do not mask the original failure
      }
      return errResult(
        'STORAGE_FAILED',
        `snapshot replace failed (disk full/permission): ${(error as Error).message}`,
        true,
      );
    }
    return okResult(
      {
        learnerId,
        path: file,
        sha256: sha256Text(content),
        lastSeq,
        replaced,
        snapshot,
      },
      lastSeq,
    );
  }

  load(learnerId: string): ServiceResult<SnapshotLoadResult> {
    const file = this.fileFor(learnerId);
    if (!existsSync(file)) {
      return okResult(
        { learnerId, snapshot: null, rebuilt: false, reason: 'missing', invalidReason: null },
        this.journal.lastSeq,
      );
    }
    let snapshot: Snapshot;
    try {
      const parsed: unknown = JSON.parse(readFileSync(file, 'utf8'));
      const validation = validateSnapshot(parsed);
      if (!validation.ok) {
        return this.rebuild(
          learnerId,
          'invalid_snapshot',
          validation.issues.map((issue) => `${issue.path} ${issue.message}`).join('; '),
        );
      }
      snapshot = validation.value;
    } catch (error) {
      return this.rebuild(learnerId, 'invalid_snapshot', `snapshot is not valid JSON: ${(error as Error).message}`);
    }

    const recomputed = sha256Text(stableStringify(snapshot.payload));
    if (recomputed !== snapshot.stateHash) {
      return this.rebuild(learnerId, 'invalid_snapshot', 'snapshot stateHash does not match payload');
    }
    const againstJournal = checkSnapshotAgainstJournal(snapshot, this.journal.lastSeq);
    if (!againstJournal.ok) {
      return this.rebuild(
        learnerId,
        'snapshot_ahead',
        againstJournal.issues.map((issue) => issue.message).join('; '),
      );
    }
    return okResult(
      { learnerId, snapshot, rebuilt: false, reason: 'valid', invalidReason: null },
      snapshot.lastSeq,
    );
  }

  rebuild(learnerId: string, reason: SnapshotLoadReason = 'rebuilt_from_journal', invalidReason: string | null = null): ServiceResult<SnapshotLoadResult> {
    if (!this.journal.isWritable) {
      return errResult(
        'CONTRACT_REJECTED',
        `snapshot cannot be rebuilt from a corrupt journal; recovery: ${this.journal
          .getRecoveryReport()
          .recoverySteps.join('; ')}`,
        false,
      );
    }
    const replay = replayLearner(learnerId, this.journal.allCommits(), this.journal.lastSeq);
    const payload = replayStatePayload(replay);
    const saved = this.save(learnerId, this.journal.lastSeq, payload);
    if (!saved.ok) return saved;
    return okResult(
      {
        learnerId,
        snapshot: saved.data.snapshot,
        rebuilt: true,
        reason,
        invalidReason,
      },
      saved.data.snapshot.lastSeq,
    );
  }

  replay(learnerId: string) {
    return replayLearner(learnerId, this.journal.allCommits(), this.journal.lastSeq);
  }
}
