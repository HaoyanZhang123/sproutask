/**
 * Ordered single-writer JSONL journal.
 *
 * - append: one complete command per line, fsynced before confirmation;
 * - requestId is persisted and deduplicated on replay and on retry;
 * - seq is assigned by storage, never by the client clock;
 * - a half-written tail line is quarantined and truncated before new appends;
 * - middle corruption / schema error / non-monotonic seq degrades to read-only
 *   with explicit recovery steps instead of silently skipping bad lines.
 */

import {
  closeSync,
  existsSync,
  fsyncSync,
  openSync,
  readFileSync,
  statSync,
  truncateSync,
  unlinkSync,
  writeFileSync,
  writeSync,
} from 'node:fs';
import path from 'node:path';
import type {
  AppendReceipt,
  Clock,
  IdGenerator,
  JournalCommand,
  JournalCommandInput,
  RequestContext,
  ServiceResult,
} from '@edu/domain';
import {
  classifyJournalText,
  errResult,
  okResult,
  validateJournalCommand,
} from '@edu/domain';
import type {
  CorruptLine,
  OpenStorageOptions,
  RecoveryReport,
  StorageIoHooks,
  StorageJournalSlice,
  StorageMode,
  StorageStatus,
} from './types.js';
import type { StoragePaths } from './paths.js';
import { fileStamp, sha256Text } from './paths.js';
import { acquireWriterLock, type LockReclaim, type WriterLock } from './lock.js';

interface JournalInternals {
  readonly paths: StoragePaths;
  readonly clock: Clock;
  readonly ids: IdGenerator;
  readonly io: StorageIoHooks;
  readonly lock: WriterLock;
  readonly lockReclaimed: LockReclaim | null;
  mode: StorageMode;
  commits: JournalCommand[];
  byRequest: Map<string, JournalCommand>;
  lastSeq: number;
  tailPartialRepaired: boolean;
  corruptLines: CorruptLine[];
  nonMonotonicSeq: boolean;
  quarantineFiles: string[];
  recoverySteps: string[];
  duplicateRequestCommits: number;
}

/**
 * Whether a stored commit is the *same* command as an incoming one (a real
 * retry), rather than a different command that reused a request id. Only the
 * caller-controlled fields are compared: seq/eventId/occurredAt differ per
 * attempt by design.
 */
function isSameCommand(
  existing: JournalCommand,
  incoming: { readonly type: string; readonly learnerId: string; readonly payload: unknown },
): boolean {
  if (existing.type !== incoming.type) return false;
  if (existing.learnerId !== incoming.learnerId) return false;
  try {
    return JSON.stringify(existing.payload) === JSON.stringify(incoming.payload);
  } catch {
    return false;
  }
}

function recoveryStepsFor(corrupt: boolean, tail: boolean): string[] {
  const steps: string[] = [];
  if (tail) steps.push('isolated the half-written tail line under journal/quarantine; the complete prefix was kept');
  if (corrupt) {
    steps.push('journal is read-only: a middle line is corrupt or seq is not monotonic');
    steps.push('restore the journal from a local backup, or export the good prefix and start a new data root');
    steps.push('do not append new attempts/assessments until the corruption is repaired');
  }
  return steps;
}

function goodPrefixCommits(text: string): JournalCommand[] {
  const commits: JournalCommand[] = [];
  let previousSeq = 0;
  const lines = text.split(/\r?\n/);
  for (const line of lines) {
    if (line.trim().length === 0) continue;
    try {
      const validation = validateJournalCommand(JSON.parse(line));
      if (!validation.ok || validation.value.seq <= previousSeq) break;
      commits.push(validation.value);
      previousSeq = validation.value.seq;
    } catch {
      break;
    }
  }
  return commits;
}

function loadJournal(
  paths: StoragePaths,
  clock: Clock,
  ids: IdGenerator,
): {
  commits: JournalCommand[];
  byRequest: Map<string, JournalCommand>;
  lastSeq: number;
  tailRepaired: boolean;
  corruptLines: CorruptLine[];
  nonMonotonicSeq: boolean;
  quarantineFiles: string[];
  duplicateRequestCommits: number;
} {
  const raw = existsSync(paths.journalFile) ? readFileSync(paths.journalFile, 'utf8') : '';
  let classification = classifyJournalText(raw);
  let text = raw;
  let tailRepaired = false;
  const quarantineFiles: string[] = [];

  if (classification.tailPartial) {
    const stamp = fileStamp(clock.now());
    const backupName = `tail-repair-${stamp}-${fileStamp(ids.next('tail'))}.jsonl`;
    const backupPath = path.join(paths.quarantineDir, backupName);
    const backupBytes = Buffer.byteLength(raw, 'utf8');
    const lastNewline = raw.lastIndexOf('\n');
    const prefix = lastNewline >= 0 ? raw.slice(0, lastNewline + 1) : '';
    writeFileSync(backupPath, raw, 'utf8');
    writeFileSync(paths.journalFile, prefix, 'utf8');
    const metaPath = path.join(paths.quarantineDir, backupName.replace(/\.jsonl$/, '.json'));
    writeFileSync(
      metaPath,
      `${JSON.stringify(
        {
          schemaVersion: 1,
          kind: 'tail_partial_repair',
          capturedAt: clock.now(),
          backupFile: backupName,
          backupSha256: sha256Text(raw),
          keptPrefixSha256: sha256Text(prefix),
          removedBytes: backupBytes - Buffer.byteLength(prefix, 'utf8'),
        },
        null,
        2,
      )}\n`,
      'utf8',
    );
    quarantineFiles.push(backupPath, metaPath);
    tailRepaired = true;
    text = prefix;
    classification = classifyJournalText(text);
  }

  const byRequest = new Map<string, JournalCommand>();
  const readOnly = classification.corruptLines.length > 0 || classification.nonMonotonicSeq;
  const commits = readOnly ? goodPrefixCommits(text) : classification.commits;
  for (const commit of commits) {
    if (!byRequest.has(commit.requestId)) byRequest.set(commit.requestId, commit);
  }
  const lastSeq = commits.reduce((max, commit) => Math.max(max, commit.seq), 0);
  return {
    commits: [...commits],
    byRequest,
    lastSeq,
    tailRepaired,
    corruptLines: [...classification.corruptLines],
    nonMonotonicSeq: classification.nonMonotonicSeq,
    quarantineFiles,
    duplicateRequestCommits: classification.duplicateRequestIds.length,
  };
}

export class JournalStore {
  private readonly state: JournalInternals;

  private constructor(state: JournalInternals) {
    this.state = state;
  }

  static open(paths: StoragePaths, options: OpenStorageOptions): ServiceResult<JournalStore> {
    const clock = options.clock;
    const ids = options.ids;
    if (clock === undefined || ids === undefined) {
      return errResult('INVALID_INPUT', 'storage requires an injected clock and id generator');
    }
    const lockResult = acquireWriterLock(paths.lockFile, {
      clock,
      ids,
      staleMs: options.lockStaleMs,
      ...(options.onAudit === undefined ? {} : { onAudit: options.onAudit }),
    });
    if (!lockResult.ok) return lockResult;
    const writerLock = lockResult.data.lock;
    const lockReclaimed = lockResult.data.reclaimed;

    try {
      const loaded = loadJournal(paths, clock, ids);
      const readOnly = loaded.corruptLines.length > 0 || loaded.nonMonotonicSeq;
      const state: JournalInternals = {
        paths,
        clock,
        ids,
        io: options.io ?? {},
        lock: writerLock,
        lockReclaimed,
        mode: readOnly ? 'read_only' : 'writable',
        commits: loaded.commits,
        byRequest: loaded.byRequest,
        lastSeq: loaded.lastSeq,
        tailPartialRepaired: loaded.tailRepaired,
        corruptLines: loaded.corruptLines,
        nonMonotonicSeq: loaded.nonMonotonicSeq,
        quarantineFiles: loaded.quarantineFiles,
        recoverySteps: [
          ...(lockReclaimed === null
            ? []
            : [
                `lock.reclaimed:${lockReclaimed.reason} (pid=${String(
                  lockReclaimed.pid,
                )}, ageMs=${String(lockReclaimed.ageMs)}, staleMs=${String(
                  lockReclaimed.staleMs,
                )})`,
              ]),
          ...recoveryStepsFor(readOnly, loaded.tailRepaired),
        ],
        duplicateRequestCommits: loaded.duplicateRequestCommits,
      };
      return okResult(new JournalStore(state), state.lastSeq);
    } catch (error) {
      writerLock.release();
      return errResult(
        'STORAGE_FAILED',
        `journal could not be opened: ${(error as Error).message}`,
        true,
      );
    }
  }

  get mode(): StorageMode {
    return this.state.mode;
  }

  get isWritable(): boolean {
    return this.state.mode === 'writable';
  }

  get lastSeq(): number {
    return this.state.lastSeq;
  }

  get journalPath(): string {
    return this.state.paths.journalFile;
  }

  getCurrentMode(): StorageMode {
    return this.state.mode;
  }

  getRecoveryReport(): RecoveryReport {
    return {
      schemaVersion: 1,
      root: this.state.paths.root,
      journalPath: this.state.paths.journalFile,
      mode: this.state.mode,
      writable: this.isWritable,
      lastSeq: this.state.lastSeq,
      commitCount: this.state.commits.length,
      duplicateRequestCommits: this.state.duplicateRequestCommits,
      tailPartialRepaired: this.state.tailPartialRepaired,
      corruptLines: [...this.state.corruptLines],
      nonMonotonicSeq: this.state.nonMonotonicSeq,
      quarantineFiles: [...this.state.quarantineFiles],
      recoverySteps: [...this.state.recoverySteps],
      lockReclaimed: this.state.lockReclaimed,
    };
  }

  getStatus(): StorageStatus {
    const report = this.getRecoveryReport();
    const { recoverySteps: _steps, ...rest } = report;
    return { ...rest, lockHeld: this.state.mode !== 'closed' };
  }

  allCommits(): readonly JournalCommand[] {
    return [...this.state.commits];
  }

  findByRequestId(requestId: string): JournalCommand | undefined {
    return this.state.byRequest.get(requestId);
  }

  async append(
    ctx: RequestContext,
    command: JournalCommandInput,
  ): Promise<ServiceResult<AppendReceipt>> {
    return this.appendSync(ctx, command);
  }

  appendSync(ctx: RequestContext, command: JournalCommandInput): ServiceResult<AppendReceipt> {
    if (this.state.mode === 'closed') {
      return errResult('STORAGE_FAILED', 'storage is closed', false);
    }
    if (this.state.mode === 'read_only') {
      return errResult(
        'CONTRACT_REJECTED',
        `journal is read-only due to corruption; recovery: ${this.state.recoverySteps.join('; ')}`,
        false,
      );
    }
    if (ctx.requestId.trim().length === 0) {
      return errResult('INVALID_INPUT', 'requestId must not be empty', false);
    }
    if (ctx.requestId !== command.requestId) {
      return errResult(
        'INVALID_INPUT',
        'requestId in the request context does not match the command requestId',
        false,
      );
    }
    if (ctx.learnerId !== command.learnerId) {
      return errResult(
        'UNAUTHORIZED',
        'command learner does not match the host bound learner',
        false,
      );
    }

    const existing = this.state.byRequest.get(command.requestId);
    if (existing !== undefined) {
      // 幂等只对"同一条命令重发"成立。不同命令撞了同一个 requestId，说明调用方
      // 生成了会重复的 id（例如页内计数器每次刷新从 1 重数）；此时若照样返回旧回执，
      // 新数据会被静默丢弃——线上表现为"提交没有完成 + 找不到这项内容"。
      if (!isSameCommand(existing, command)) {
        return errResult(
          'CONFLICT',
          `requestId ${command.requestId} was already used for a different command; a unique request id is required`,
          false,
        );
      }
      return okResult(
        {
          eventId: existing.eventId,
          requestId: existing.requestId,
          seq: existing.seq,
          revision: existing.seq,
          duplicate: true,
        },
        existing.seq,
      );
    }

    const nextSeq = this.state.lastSeq + 1;
    const candidate = {
      ...command,
      schemaVersion: 1 as const,
      seq: nextSeq,
    };
    const validation = validateJournalCommand(candidate);
    if (!validation.ok) {
      return errResult(
        'VALIDATION_FAILED',
        `journal command rejected: ${validation.issues
          .slice(0, 3)
          .map((issue) => `${issue.path} ${issue.message}`)
          .join('; ')}`,
        false,
      );
    }

    try {
      this.state.io.beforeAppend?.();
    } catch (error) {
      return errResult(
        'STORAGE_FAILED',
        `journal append failed before write: ${(error as Error).message}`,
        true,
      );
    }

    const line = `${JSON.stringify(validation.value)}\n`;
    const previousSize = existsSync(this.state.paths.journalFile)
      ? statSync(this.state.paths.journalFile).size
      : 0;
    let fd: number | null = null;
    try {
      fd = openSync(this.state.paths.journalFile, 'a');
      writeSync(fd, line, null, 'utf8');
      fsyncSync(fd);
      closeSync(fd);
      fd = null;
    } catch (error) {
      if (fd !== null) {
        try {
          closeSync(fd);
        } catch {
          // ignore close failure
        }
      }
      this.repairAfterFailedWrite(previousSize);
      return errResult(
        'STORAGE_FAILED',
        `journal append failed (disk full/permission/crash): ${(error as Error).message}`,
        true,
      );
    }

    this.state.commits.push(validation.value);
    this.state.byRequest.set(validation.value.requestId, validation.value);
    this.state.lastSeq = validation.value.seq;
    return okResult(
      {
        eventId: validation.value.eventId,
        requestId: validation.value.requestId,
        seq: validation.value.seq,
        revision: validation.value.seq,
        duplicate: false,
      },
      validation.value.seq,
    );
  }

  private repairAfterFailedWrite(previousSize: number): void {
    try {
      if (existsSync(this.state.paths.journalFile)) {
        truncateSync(this.state.paths.journalFile, previousSize);
      }
    } catch {
      // A failed repair leaves a tail partial line; the next open quarantines it.
    }
  }

  async readFrom(
    ctx: RequestContext,
    fromSeq: number,
    limit: number,
  ): Promise<ServiceResult<StorageJournalSlice>> {
    if (this.state.mode === 'closed') {
      return errResult('STORAGE_FAILED', 'storage is closed', false);
    }
    if (!Number.isInteger(fromSeq) || fromSeq < 0 || !Number.isInteger(limit) || limit < 1 || limit > 1000) {
      return errResult('INVALID_INPUT', 'fromSeq must be >=0 and limit must be 1..1000', false);
    }
    if (ctx.learnerId.trim().length === 0) {
      return errResult('INVALID_INPUT', 'learnerId must not be empty', false);
    }
    // The host binds the learner; a RequestContext must never read another
    // learner's rows from the same journal root.
    const learnerCommits = this.state.commits.filter((commit) => commit.learnerId === ctx.learnerId);
    const matching = learnerCommits.filter((commit) => commit.seq > fromSeq);
    const commits = matching.slice(0, limit);
    const learnerLastSeq = this.lastSeqFor(ctx.learnerId);
    const lastReturnedSeq = commits.length > 0 ? commits[commits.length - 1]!.seq : fromSeq;
    // On a partial page expose the last returned seq as the cursor so callers
    // (e.g. learner projection replay) can page without skipping rows; a
    // complete page reports the learner's latest seq.
    const cursorSeq = matching.length > limit ? lastReturnedSeq : learnerLastSeq;
    return okResult(
      {
        commits,
        fromSeq,
        lastSeq: cursorSeq,
        hasMore: matching.length > limit,
        tailPartial: this.state.tailPartialRepaired,
        corrupted: this.state.mode === 'read_only',
        recoverySteps: [...this.state.recoverySteps],
      },
      cursorSeq,
    );
  }

  async latestSeq(ctx: RequestContext): Promise<ServiceResult<{ readonly lastSeq: number }>> {
    if (this.state.mode === 'closed') {
      return errResult('STORAGE_FAILED', 'storage is closed', false);
    }
    if (ctx.learnerId.trim().length === 0) {
      return errResult('INVALID_INPUT', 'learnerId must not be empty', false);
    }
    const learnerLastSeq = this.lastSeqFor(ctx.learnerId);
    return okResult({ lastSeq: learnerLastSeq }, learnerLastSeq);
  }

  /** Highest seq written for one learner (0 when the learner has no rows). */
  private lastSeqFor(learnerId: string): number {
    let lastSeq = 0;
    for (const commit of this.state.commits) {
      if (commit.learnerId === learnerId && commit.seq > lastSeq) lastSeq = commit.seq;
    }
    return lastSeq;
  }

  close(): void {
    if (this.state.mode === 'closed') return;
    this.state.mode = 'closed';
    this.state.lock.release();
  }
}
