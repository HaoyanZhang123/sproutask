/**
 * @edu/storage public service surface.
 *
 * Consumers get the frozen EventStore port plus learner snapshot management,
 * two-phase attempt commits, scoped export/delete and explicit legacy
 * migration. The factory in factory.ts provides the composition-root bridge.
 */

import type {
  AppendReceipt,
  Clock,
  EventStore,
  IdGenerator,
  JournalCommandInput,
  RequestContext,
  ServiceResult,
  Snapshot,
  Timestamp,
} from '@edu/domain';
import { errResult, okResult } from '@edu/domain';
import type {
  DeletePlan,
  DeleteReceipt,
  DeleteScope,
  ExportReceipt,
  ExportRequest,
  ExportScope,
  OpenStorageOptions,
  RecoveryReport,
  SnapshotLoadResult,
  SnapshotSaveReceipt,
  StorageJournalSlice,
  StorageStatus,
} from './types.js';
import { createStoragePaths, ensureStorageDirs } from './paths.js';
import { JournalStore } from './journal.js';
import { SnapshotStore } from './snapshot.js';
import { createAttemptCommitService, type AttemptCommitService } from './attempts.js';
import { MaintenanceService } from './maintenance.js';
import { MigrationService, type MigrateLegacyRequest } from './migration.js';
import type { MigrationReceipt } from './types.js';

export class StorageService implements EventStore {
  private readonly journal: JournalStore;
  private readonly snapshots: SnapshotStore;
  readonly attempts: AttemptCommitService;
  private readonly maintenance: MaintenanceService;
  private readonly migration: MigrationService;

  private constructor(
    private readonly options: OpenStorageOptions,
    journal: JournalStore,
    snapshots: SnapshotStore,
    attempts: AttemptCommitService,
    maintenance: MaintenanceService,
    migration: MigrationService,
  ) {
    this.journal = journal;
    this.snapshots = snapshots;
    this.attempts = attempts;
    this.maintenance = maintenance;
    this.migration = migration;
  }

  static async open(options: OpenStorageOptions): Promise<ServiceResult<StorageService>> {
    if (options.clock === undefined || options.ids === undefined) {
      return errResult('INVALID_INPUT', 'storage requires an injected clock and id generator');
    }
    try {
      const paths = createStoragePaths(options.root);
      ensureStorageDirs(paths);
      const journalResult = JournalStore.open(paths, options);
      if (!journalResult.ok) return journalResult;
      const journal = journalResult.data;
      const snapshots = new SnapshotStore(
        paths,
        journal,
        options.clock,
        options.ids,
        options.io ?? {},
      );
      const attempts = createAttemptCommitService(journal, options.ids);
      const maintenance = new MaintenanceService(paths, journal, options.clock, options.ids);
      const migration = new MigrationService(paths, journal, options.clock, options.ids);
      return okResult(
        new StorageService(options, journal, snapshots, attempts, maintenance, migration),
        journal.lastSeq,
      );
    } catch (error) {
      return errResult(
        'STORAGE_FAILED',
        `storage root could not be prepared: ${(error as Error).message}`,
        true,
      );
    }
  }

  get root(): string {
    return this.journal.getRecoveryReport().root;
  }

  get lastSeq(): number {
    return this.journal.lastSeq;
  }

  get status(): StorageStatus {
    return this.journal.getStatus();
  }

  recoveryReport(): RecoveryReport {
    return this.journal.getRecoveryReport();
  }

  async append(
    ctx: RequestContext,
    command: JournalCommandInput,
  ): Promise<ServiceResult<AppendReceipt>> {
    return this.journal.append(ctx, command);
  }

  async readFrom(
    ctx: RequestContext,
    fromSeq: number,
    limit: number,
  ): Promise<ServiceResult<StorageJournalSlice>> {
    return this.journal.readFrom(ctx, fromSeq, limit);
  }

  async latestSeq(ctx: RequestContext): Promise<ServiceResult<{ readonly lastSeq: number }>> {
    return this.journal.latestSeq(ctx);
  }

  saveSnapshot(
    learnerId: string,
    lastSeq: number,
    payload: Record<string, unknown>,
  ): ServiceResult<SnapshotSaveReceipt> {
    return this.snapshots.save(learnerId, lastSeq, payload);
  }

  loadSnapshot(learnerId: string): ServiceResult<SnapshotLoadResult> {
    return this.snapshots.load(learnerId);
  }

  rebuildSnapshot(learnerId: string): ServiceResult<SnapshotLoadResult> {
    return this.snapshots.rebuild(learnerId);
  }

  exportData(scope: ExportScope, targetDir: string, requestId: string): ServiceResult<ExportReceipt> {
    const request: ExportRequest = { scope, targetDir, requestId };
    return this.maintenance.exportData(request);
  }

  prepareDelete(scope: DeleteScope): ServiceResult<DeletePlan> {
    return this.maintenance.prepareDelete(scope);
  }

  deleteData(plan: DeletePlan, confirm: boolean): ServiceResult<DeleteReceipt> {
    return this.maintenance.deleteData(plan, confirm);
  }

  migrateLegacy(request: MigrateLegacyRequest): ServiceResult<MigrationReceipt> {
    return this.migration.migrateLegacy(request);
  }

  /** Replay the journal for one learner (snapshot source of truth). */
  replay(learnerId: string) {
    return this.snapshots.replay(learnerId);
  }

  close(): void {
    this.journal.close();
  }

  isClosed(): boolean {
    return this.journal.getCurrentMode() === 'closed';
  }

  asEventStore(): EventStore {
    return this;
  }

  now(): Timestamp {
    return this.options.clock?.now() ?? '';
  }
}

export type { Clock, IdGenerator, Snapshot };
