/**
 * Scoped export and confirmed deletion.
 *
 * Export writes hashed copies plus a manifest into an explicit absolute target.
 * Delete requires a prepared plan (scope + resolved absolute targets) AND an
 * explicit boolean confirmation; every target is re-resolved and checked to be
 * inside the storage root before anything is removed. Deleting learning records
 * never touches imported textbook sources or shared content.
 */

import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import path from 'node:path';
import type { Clock, IdGenerator, ServiceResult, Timestamp } from '@edu/domain';
import { errResult, okResult } from '@edu/domain';
import type {
  DeleteAuditEntry,
  DeletePlan,
  DeleteReceipt,
  DeleteScope,
  ExportManifest,
  ExportReceipt,
  ExportRequest,
  ExportScope,
  ExportedFile,
} from './types.js';
import {
  DELETE_AUDIT_FILE,
  DELETE_PLAN_MISMATCH,
  DELETE_SCOPES,
  EXPORT_SCOPES,
} from './types.js';
import type { StoragePaths } from './paths.js';
import {
  StoragePathError,
  assertDeleteTarget,
  fileStamp,
  resolveInside,
  sha256File,
} from './paths.js';
import type { JournalStore } from './journal.js';

function isAbsoluteDirectory(value: string): boolean {
  return path.isAbsolute(value);
}

function collectFiles(root: string): string[] {
  if (!existsSync(root)) return [];
  const files: string[] = [];
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir)) {
      const full = path.join(dir, entry);
      if (statSync(full).isDirectory()) walk(full);
      else if (entry !== 'events.lock') files.push(full);
    }
  };
  walk(root);
  return files.sort();
}

export class MaintenanceService {
  constructor(
    private readonly paths: StoragePaths,
    private readonly journal: JournalStore,
    private readonly clock: Clock,
    private readonly ids: IdGenerator,
  ) {}

  private rootsForScope(scope: ExportScope): string[] {
    if (scope === 'journal') return [this.paths.journalDir];
    if (scope === 'snapshots') return [this.paths.snapshotsDir];
    if (scope === 'learning_records') return [this.paths.journalDir, this.paths.snapshotsDir];
    return [
      this.paths.journalDir,
      this.paths.snapshotsDir,
      this.paths.migrationDir,
      this.paths.receiptsDir,
    ];
  }

  exportData(request: ExportRequest): ServiceResult<ExportReceipt> {
    if (!EXPORT_SCOPES.includes(request.scope)) {
      return errResult('INVALID_INPUT', `unknown export scope ${String(request.scope)}`, false);
    }
    if (request.requestId.trim().length === 0) {
      return errResult('INVALID_INPUT', 'export requires a requestId', false);
    }
    if (!isAbsoluteDirectory(request.targetDir)) {
      return errResult('INVALID_INPUT', 'export targetDir must be an absolute path', false);
    }
    const exportId = `export-${fileStamp(this.clock.now())}-${fileStamp(this.ids.next('export'))}`;
    const directory = path.join(request.targetDir, exportId);
    const files: ExportedFile[] = [];
    try {
      mkdirSync(directory, { recursive: true });
      for (const root of this.rootsForScope(request.scope)) {
        for (const file of collectFiles(root)) {
          const relativePath = path.relative(this.paths.root, file).split(path.sep).join('/');
          const destination = path.join(directory, ...relativePath.split('/'));
          mkdirSync(path.dirname(destination), { recursive: true });
          const bytes = readFileSync(file);
          writeFileSync(destination, bytes);
          files.push({
            relativePath,
            sha256: sha256File(destination),
            bytes: bytes.byteLength,
          });
        }
      }
      const manifest: ExportManifest = {
        schemaVersion: 1,
        exportId,
        scope: request.scope,
        createdAt: this.clock.now(),
        files,
      };
      const manifestPath = path.join(directory, 'manifest.json');
      writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
      return okResult({ exportId, directory, manifestPath, manifest }, files.length);
    } catch (error) {
      return errResult(
        'STORAGE_FAILED',
        `export failed (disk full/permission): ${(error as Error).message}`,
        true,
      );
    }
  }

  /** Root-relative folders for a delete scope; shared by plan and re-check. */
  private scopeRelativeTargets(scope: DeleteScope): string[] {
    if (scope === 'learning_records') return ['journal', 'snapshots'];
    if (scope === 'journal') return ['journal'];
    if (scope === 'snapshots') return ['snapshots'];
    return ['migration'];
  }

  /**
   * Canonical delete targets recomputed from the *scope*, never from the
   * caller supplied plan. `assertDeleteTarget` resolves symlinks through
   * realpath and rejects anything outside the storage root.
   */
  private expectedDeleteTargets(scope: DeleteScope): string[] {
    return this.scopeRelativeTargets(scope).map((relative) =>
      assertDeleteTarget(this.paths, resolveInside(this.paths, relative)),
    );
  }

  /** Case-insensitive comparison key (Windows path semantics); realpath already applied. */
  private static compareKey(target: string): string {
    return process.platform === 'win32' ? target.toLowerCase() : target;
  }

  private auditTrailPath(): string {
    return path.join(this.paths.receiptsDir, DELETE_AUDIT_FILE);
  }

  /**
   * Append-only audit line. Throws on I/O failure so an authorized deletion can
   * abort before touching any target when the audit trail cannot be written.
   */
  private appendDeleteAudit(entry: DeleteAuditEntry): string {
    const auditPath = this.auditTrailPath();
    mkdirSync(this.paths.receiptsDir, { recursive: true });
    appendFileSync(auditPath, `${JSON.stringify(entry)}\n`, 'utf8');
    return auditPath;
  }

  private tryAppendDeleteAudit(entry: DeleteAuditEntry): string | null {
    try {
      return this.appendDeleteAudit(entry);
    } catch {
      return null;
    }
  }

  prepareDelete(scope: DeleteScope): ServiceResult<DeletePlan> {
    if (!DELETE_SCOPES.includes(scope)) {
      return errResult('INVALID_INPUT', `unknown delete scope ${String(scope)}`, false);
    }
    let targets: string[];
    try {
      targets = this.scopeRelativeTargets(scope).map((relative) => resolveInside(this.paths, relative));
    } catch (error) {
      return errResult('CONTRACT_REJECTED', (error as Error).message, false);
    }
    const warnings = [
      'imported textbook source files are not part of storage delete scopes and are never deleted here',
      'shared content packs are not part of storage delete scopes',
    ];
    if (scope === 'learning_records') {
      warnings.push('export a copy first if you want to keep a personal record before deleting');
    }
    return okResult(
      {
        schemaVersion: 1,
        planId: this.ids.next('delete-plan'),
        scope,
        root: this.paths.root,
        targets,
        createdAt: this.clock.now(),
        requiresConfirmation: true,
        warnings,
      },
      targets.length,
    );
  }

  deleteData(plan: DeletePlan, confirm: boolean): ServiceResult<DeleteReceipt> {
    if (confirm !== true) {
      return errResult(
        'CONTRACT_REJECTED',
        'delete requires an explicit second confirmation (confirm: true)',
        false,
      );
    }
    const planId = typeof plan.planId === 'string' ? plan.planId : 'unknown-plan';
    const rawTargets: string[] = Array.isArray(plan.targets)
      ? plan.targets.filter((target): target is string => typeof target === 'string')
      : [];
    if (plan.schemaVersion !== 1 || plan.root !== this.paths.root) {
      if (DELETE_SCOPES.includes(plan.scope)) {
        this.tryAppendDeleteAudit({
          schemaVersion: 1,
          at: this.clock.now(),
          planId,
          scope: plan.scope,
          outcome: 'rejected',
          code: 'DELETE_PLAN_ROOT_MISMATCH',
          expectedTargets: [],
          providedTargets: rawTargets,
          deletedTargets: null,
        });
      }
      return errResult('CONTRACT_REJECTED', 'delete plan does not belong to this storage root', false);
    }
    if (!DELETE_SCOPES.includes(plan.scope)) {
      return errResult('INVALID_INPUT', `unknown delete scope ${String(plan.scope)}`, false);
    }
    if (existsSync(this.paths.lockFile) || this.journal.getCurrentMode() !== 'closed') {
      return errResult('CONFLICT', 'close the storage instance before deleting journal data', false);
    }

    const rejectPlan = (
      code: string,
      expected: readonly string[],
      provided: readonly string[],
    ): ServiceResult<DeleteReceipt> => {
      this.tryAppendDeleteAudit({
        schemaVersion: 1,
        at: this.clock.now(),
        planId,
        scope: plan.scope,
        outcome: 'rejected',
        code,
        expectedTargets: expected,
        providedTargets: provided,
        deletedTargets: null,
      });
      return errResult(
        'CONTRACT_REJECTED',
        `${DELETE_PLAN_MISMATCH}: delete plan targets do not match the recomputed scope ${plan.scope} (${code}); no data was deleted`,
        false,
        `delete-audit:${planId}`,
      );
    };

    if (!Array.isArray(plan.targets) || plan.targets.length !== rawTargets.length) {
      return rejectPlan('DELETE_TARGETS_INVALID', [], rawTargets);
    }

    let expectedTargets: string[];
    try {
      expectedTargets = this.expectedDeleteTargets(plan.scope);
    } catch (error) {
      this.tryAppendDeleteAudit({
        schemaVersion: 1,
        at: this.clock.now(),
        planId,
        scope: plan.scope,
        outcome: 'rejected',
        code: 'DELETE_SCOPE_RESOLVE_FAILED',
        expectedTargets: [],
        providedTargets: rawTargets,
        deletedTargets: null,
      });
      return errResult(
        'CONTRACT_REJECTED',
        error instanceof StoragePathError ? error.message : 'delete scope could not be resolved',
        false,
      );
    }

    let providedTargets: string[];
    try {
      providedTargets = rawTargets.map((target) => assertDeleteTarget(this.paths, target));
    } catch (error) {
      this.tryAppendDeleteAudit({
        schemaVersion: 1,
        at: this.clock.now(),
        planId,
        scope: plan.scope,
        outcome: 'rejected',
        code: 'DELETE_TARGET_REJECTED',
        expectedTargets,
        providedTargets: rawTargets,
        deletedTargets: null,
      });
      return errResult(
        'CONTRACT_REJECTED',
        error instanceof StoragePathError
          ? error.message
          : `delete plan target rejected: ${(error as Error).message}`,
        false,
      );
    }

    const expectedKeys = new Set(expectedTargets.map((target) => MaintenanceService.compareKey(target)));
    const providedKeys = new Set(providedTargets.map((target) => MaintenanceService.compareKey(target)));
    const duplicates = providedTargets.length !== providedKeys.size;
    const missing = [...expectedKeys].filter((key) => !providedKeys.has(key));
    const extra = [...providedKeys].filter((key) => !expectedKeys.has(key));
    if (duplicates || missing.length > 0 || extra.length > 0 || expectedKeys.size !== providedKeys.size) {
      return rejectPlan(
        `TARGET_SET_MISMATCH:missing=${missing.length}:extra=${extra.length}:duplicates=${
          duplicates ? 'yes' : 'no'
        }`,
        expectedTargets,
        providedTargets,
      );
    }

    // Audit the authorization before touching data; a failed audit aborts the
    // deletion instead of allowing an unaudited destructive operation.
    let auditPath: string;
    try {
      auditPath = this.appendDeleteAudit({
        schemaVersion: 1,
        at: this.clock.now(),
        planId,
        scope: plan.scope,
        outcome: 'authorized',
        code: 'DELETE_AUTHORIZED',
        expectedTargets,
        providedTargets,
        deletedTargets: null,
      });
    } catch (error) {
      return errResult(
        'STORAGE_FAILED',
        `delete audit could not be written, nothing was deleted: ${(error as Error).message}`,
        true,
      );
    }

    const deleted: string[] = [];
    try {
      // Only the recomputed canonical targets are ever removed.
      for (const resolved of expectedTargets) {
        if (existsSync(resolved)) {
          rmSync(resolved, { recursive: true, force: false });
          deleted.push(resolved);
        }
      }
      const createdAt = this.clock.now();
      const receipt: DeleteReceipt = {
        schemaVersion: 1,
        planId,
        scope: plan.scope,
        deleted,
        receiptPath: path.join(
          this.paths.receiptsDir,
          `delete-${fileStamp(createdAt)}-${fileStamp(planId)}.json`,
        ),
        auditPath,
        createdAt,
      };
      mkdirSync(this.paths.receiptsDir, { recursive: true });
      writeFileSync(receipt.receiptPath, `${JSON.stringify(receipt, null, 2)}\n`, 'utf8');
      this.tryAppendDeleteAudit({
        schemaVersion: 1,
        at: createdAt,
        planId,
        scope: plan.scope,
        outcome: 'authorized',
        code: 'DELETE_COMPLETED',
        expectedTargets,
        providedTargets,
        deletedTargets: deleted,
      });
      return okResult(receipt, deleted.length);
    } catch (error) {
      return errResult(
        'STORAGE_FAILED',
        `delete failed (permission/path): ${(error as Error).message}`,
        false,
      );
    }
  }

  now(): Timestamp {
    return this.clock.now();
  }
}
