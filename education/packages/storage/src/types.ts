/**
 * Storage level types shared by the journal, snapshot, attempt and
 * maintenance modules. Domain port payloads stay authoritative; these types
 * only add storage specific status/recovery/export shapes.
 */

import type {
  Clock,
  EventStore,
  IdGenerator,
  JournalCommand,
  JournalSlice,
  Snapshot,
  Timestamp,
} from '@edu/domain';
import type { LockAuditEvent, LockAuditSink, LockReclaim } from './lock.js';

export type StorageMode = 'writable' | 'read_only' | 'closed';

export interface StorageIoHooks {
  /** Test hook: run before a journal append to simulate disk-full/crash. */
  readonly beforeAppend?: () => void;
  /** Test hook: run before a snapshot replace to simulate write failure. */
  readonly beforeSnapshot?: () => void;
}

export interface OpenStorageOptions {
  readonly root: string;
  readonly clock?: Clock;
  readonly ids?: IdGenerator;
  /**
   * A lock older than this is reclaimed even when the recorded pid still
   * exists (pid reuse). Live writers refresh the lock mtime with a heartbeat,
   * so a normal long-running process is not mistaken for a stale one.
   * Defaults to 120 s.
   */
  readonly lockStaleMs?: number;
  readonly io?: StorageIoHooks;
  /** Host audit sink; receives `lock.reclaimed` when a stale lock is recovered. */
  readonly onAudit?: LockAuditSink;
}

export interface CorruptLine {
  readonly line: number;
  readonly message: string;
}

export interface RecoveryReport {
  readonly schemaVersion: 1;
  readonly root: string;
  readonly journalPath: string;
  readonly mode: StorageMode;
  readonly writable: boolean;
  readonly lastSeq: number;
  readonly commitCount: number;
  readonly duplicateRequestCommits: number;
  readonly tailPartialRepaired: boolean;
  readonly corruptLines: readonly CorruptLine[];
  readonly nonMonotonicSeq: boolean;
  readonly quarantineFiles: readonly string[];
  readonly recoverySteps: readonly string[];
  /** Set when opening reclaimed a stale writer lock (`lock.reclaimed`). */
  readonly lockReclaimed?: LockReclaim | null;
}

export interface StorageStatus extends Omit<RecoveryReport, 'schemaVersion' | 'recoverySteps'> {
  readonly schemaVersion: 1;
  readonly lockHeld: boolean;
}

/** JournalSlice plus storage corruption visibility (structurally compatible). */
export interface StorageJournalSlice extends JournalSlice {
  readonly corrupted: boolean;
  readonly recoverySteps: readonly string[];
}

export interface SnapshotSaveReceipt {
  readonly learnerId: string;
  readonly path: string;
  readonly sha256: string;
  readonly lastSeq: number;
  readonly replaced: boolean;
  readonly snapshot: Snapshot;
}

export type SnapshotLoadReason =
  | 'valid'
  | 'missing'
  | 'invalid_snapshot'
  | 'snapshot_ahead'
  | 'rebuilt_from_journal';

export interface SnapshotLoadResult {
  readonly learnerId: string;
  readonly snapshot: Snapshot | null;
  readonly rebuilt: boolean;
  readonly reason: SnapshotLoadReason;
  readonly invalidReason: string | null;
}

export interface AttemptSnapshotState {
  readonly attemptId: string;
  readonly attempt: import('@edu/domain').ActivityAttempt;
  readonly phase: import('@edu/domain').AttemptCommitPhase;
  readonly feedbackState: import('@edu/domain').FeedbackState;
  readonly revision: number;
  readonly lastRequestId: string;
  readonly updatedAt: Timestamp;
}

export interface LearnerReplayState {
  readonly learnerId: string;
  readonly lastSeq: number;
  readonly commits: number;
  readonly attempts: ReadonlyMap<string, AttemptSnapshotState>;
  readonly evidence: readonly import('@edu/domain').Evidence[];
  readonly assessments: readonly import('@edu/domain').Assessment[];
  readonly selfReports: readonly import('@edu/domain').SelfReport[];
  readonly progressEffects: readonly import('@edu/domain').JournalEffect[];
  readonly legacyRecords: readonly Record<string, unknown>[];
  readonly invalidPayloads: readonly { readonly seq: number; readonly message: string }[];
}

export interface JournalReadView {
  readonly commands: readonly JournalCommand[];
  readonly lastSeq: number;
}

export interface EventStoreWithRecovery extends EventStore {
  recoveryReport(): RecoveryReport;
  close(): void;
}

export interface StorageFeatureModuleLike {
  readonly feature: {
    readonly id: string;
    readonly version: string;
    readonly apiVersion: 1;
    readonly requiredCapabilities: readonly [];
    readonly description: string;
  };
  registerEducationFeature(
    context: unknown,
    services: { readonly eventStore: EventStore | null },
  ): void;
}

export interface ExportRequest {
  readonly scope: ExportScope;
  readonly targetDir: string;
  readonly requestId: string;
}

export const EXPORT_SCOPES = ['learning_records', 'journal', 'snapshots', 'all'] as const;
export type ExportScope = (typeof EXPORT_SCOPES)[number];

export const DELETE_SCOPES = [
  'learning_records',
  'journal',
  'snapshots',
  'migration_backups',
] as const;
export type DeleteScope = (typeof DELETE_SCOPES)[number];

/**
 * Storage level sub-code for a forged/stale delete plan. The frozen service
 * enum has no dedicated delete code, so `deleteData` reports
 * `code: 'CONTRACT_REJECTED'` and prefixes the message with this token (also
 * exposed to consumers that want to branch without parsing free text).
 */
export const DELETE_PLAN_MISMATCH = 'DELETE_PLAN_MISMATCH';

/** Append-only audit trail for every delete attempt (kept inside receipts/). */
export const DELETE_AUDIT_FILE = 'delete-audit.jsonl';

export type DeleteAuditOutcome = 'authorized' | 'rejected';

export interface DeleteAuditEntry {
  readonly schemaVersion: 1;
  readonly at: Timestamp;
  readonly planId: string;
  readonly scope: DeleteScope;
  readonly outcome: DeleteAuditOutcome;
  readonly code: string | null;
  /** Canonical (realpath + case-normalized) targets recomputed from scope. */
  readonly expectedTargets: readonly string[];
  /** Canonical targets supplied by the caller (may be empty on early reject). */
  readonly providedTargets: readonly string[];
  /** Canonical targets actually removed (only present on success). */
  readonly deletedTargets: readonly string[] | null;
}

export interface ExportedFile {
  readonly relativePath: string;
  readonly sha256: string;
  readonly bytes: number;
}

export interface ExportManifest {
  readonly schemaVersion: 1;
  readonly exportId: string;
  readonly scope: ExportScope;
  readonly createdAt: Timestamp;
  readonly files: readonly ExportedFile[];
}

export interface ExportReceipt {
  readonly exportId: string;
  readonly directory: string;
  readonly manifestPath: string;
  readonly manifest: ExportManifest;
}

export interface DeletePlan {
  readonly schemaVersion: 1;
  readonly planId: string;
  readonly scope: DeleteScope;
  readonly root: string;
  readonly targets: readonly string[];
  readonly createdAt: Timestamp;
  readonly requiresConfirmation: true;
  readonly warnings: readonly string[];
}

export interface DeleteReceipt {
  readonly schemaVersion: 1;
  readonly planId: string;
  readonly scope: DeleteScope;
  readonly deleted: readonly string[];
  readonly receiptPath: string;
  /** Append-only audit trail path (same decision, machine readable). */
  readonly auditPath?: string;
  readonly createdAt: Timestamp;
}

export interface MigrationReceiptItem {
  readonly sourceFile: string;
  readonly line: number;
  readonly status: 'migrated' | 'skipped' | 'rejected';
  readonly reason: string;
  readonly eventId: string | null;
  readonly seq: number | null;
}

export interface MigrationReceipt {
  readonly schemaVersion: 1;
  readonly source: string;
  readonly backupDir: string;
  readonly backupFiles: readonly { readonly path: string; readonly sha256: string }[];
  readonly items: readonly MigrationReceiptItem[];
  readonly migrated: number;
  readonly skipped: number;
  readonly rejected: number;
  readonly createdAt: Timestamp;
  readonly receiptsPath: string;
}
