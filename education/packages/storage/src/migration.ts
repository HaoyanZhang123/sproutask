/**
 * Explicit legacy data migration.
 *
 * Migration never runs automatically. It copies the source to a backup first,
 * writes one receipt per source line, and records old `mastered` as completed
 * learning with understanding=unassessed. A legacy mastered flag must never be
 * promoted to `supported`.
 */

import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import path from 'node:path';
import type { Clock, IdGenerator, ServiceResult } from '@edu/domain';
import { errResult, isOpaqueId, okResult } from '@edu/domain';
import type {
  MigrationReceipt,
  MigrationReceiptItem,
} from './types.js';
import type { StoragePaths } from './paths.js';
import { fileStamp, sha256File } from './paths.js';
import type { JournalStore } from './journal.js';

interface LegacyFile {
  readonly absolute: string;
  readonly relativeName: string;
}

function collectLegacyFiles(sourcePath: string): LegacyFile[] {
  const stats = statSync(sourcePath);
  if (stats.isFile()) {
    return [{ absolute: sourcePath, relativeName: path.basename(sourcePath) }];
  }
  const files: LegacyFile[] = [];
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir).sort()) {
      const full = path.join(dir, entry);
      if (statSync(full).isDirectory()) walk(full);
      else if (entry.endsWith('.jsonl') || entry.endsWith('.json')) {
        files.push({ absolute: full, relativeName: path.relative(sourcePath, full).split(path.sep).join('/') });
      }
    }
  };
  walk(sourcePath);
  return files;
}

export interface MigrateLegacyRequest {
  readonly sourcePath: string;
  readonly backupDir?: string;
}

export class MigrationService {
  constructor(
    private readonly paths: StoragePaths,
    private readonly journal: JournalStore,
    private readonly clock: Clock,
    private readonly ids: IdGenerator,
  ) {}

  migrateLegacy(request: MigrateLegacyRequest): ServiceResult<MigrationReceipt> {
    if (!path.isAbsolute(request.sourcePath) || !existsSync(request.sourcePath)) {
      return errResult('INVALID_INPUT', 'legacy sourcePath must be an existing absolute path', false);
    }
    if (!this.journal.isWritable) {
      return errResult(
        'CONTRACT_REJECTED',
        'legacy migration requires a writable journal; repair corruption before migrating',
        false,
      );
    }
    const sourceFiles = collectLegacyFiles(request.sourcePath);
    if (sourceFiles.length === 0) {
      return errResult('INVALID_INPUT', 'legacy source contains no .jsonl/.json files', false);
    }
    const stamp = fileStamp(this.clock.now());
    const backupDir =
      request.backupDir ?? path.join(this.paths.migrationDir, `backup-${stamp}-${fileStamp(this.ids.next('legacy-backup'))}`);
    if (!path.isAbsolute(backupDir)) {
      return errResult('INVALID_INPUT', 'legacy backupDir must be an absolute path', false);
    }
    const backupFiles: { path: string; sha256: string }[] = [];
    try {
      mkdirSync(backupDir, { recursive: true });
      for (const file of sourceFiles) {
        const target = path.join(backupDir, ...file.relativeName.split('/'));
        mkdirSync(path.dirname(target), { recursive: true });
        copyFileSync(file.absolute, target);
        backupFiles.push({ path: target, sha256: sha256File(target) });
      }
    } catch (error) {
      return errResult(
        'STORAGE_FAILED',
        `legacy backup failed before migration: ${(error as Error).message}`,
        true,
      );
    }

    const items: MigrationReceiptItem[] = [];
    for (const file of sourceFiles) {
      const fileHash = sha256File(file.absolute);
      const sourceLines = readFileSync(file.absolute, 'utf8').split(/\r?\n/);
      sourceLines.forEach((line, index) => {
        const lineNumber = index + 1;
        if (line.trim().length === 0) return;
        let record: Record<string, unknown>;
        try {
          const parsed: unknown = JSON.parse(line);
          if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
            items.push(rejected(file, lineNumber, 'line is not a JSON object'));
            return;
          }
          record = parsed as Record<string, unknown>;
        } catch (error) {
          items.push(rejected(file, lineNumber, `invalid JSON: ${(error as Error).message}`));
          return;
        }
        const learnerId =
          typeof record.learnerId === 'string'
            ? record.learnerId
            : typeof record.learner_id === 'string'
              ? record.learner_id
              : null;
        if (learnerId === null || !isOpaqueId(learnerId)) {
          items.push(rejected(file, lineNumber, 'missing or invalid learnerId; anonymous migration refused'));
          return;
        }
        const legacyState = detectLegacyState(record);
        if (legacyState === null) {
          items.push({
            sourceFile: file.relativeName,
            line: lineNumber,
            status: 'skipped',
            reason: 'not a recognized legacy learning record',
            eventId: null,
            seq: null,
          });
          return;
        }
        const conceptId =
          typeof record.conceptId === 'string'
            ? record.conceptId
            : typeof record.concept_id === 'string'
              ? record.concept_id
              : null;
        const mapped =
          legacyState === 'mastered'
            ? { learning: 'completed', understanding: 'unassessed', strongConclusion: false }
            : { learning: 'in_progress', understanding: 'unassessed', strongConclusion: false };
        const requestId = `legacy:${fileHash}:${lineNumber}`;
        const eventId = this.ids.next('legacy-event');
        const receipt = this.journal.appendSync(
          {
            requestId,
            learnerId,
            now: this.clock.now(),
          },
          {
            eventId,
            requestId,
            occurredAt: this.clock.now(),
            learnerId,
            type: 'legacy.migrated',
            payload: {
              sourceFile: file.relativeName,
              sourceLine: lineNumber,
              legacyState,
              conceptId,
              mapped,
              note:
                legacyState === 'mastered'
                  ? 'legacy mastered is preserved as completed learning only; understanding stays unassessed'
                  : 'legacy exploring is preserved as an activity trace only',
            },
            effects: [],
          },
        );
        if (!receipt.ok) {
          items.push({
            sourceFile: file.relativeName,
            line: lineNumber,
            status: 'rejected',
            reason: `migration append failed: ${receipt.error.message}`,
            eventId: null,
            seq: null,
          });
          return;
        }
        items.push({
          sourceFile: file.relativeName,
          line: lineNumber,
          status: receipt.data.duplicate ? 'skipped' : 'migrated',
          reason: receipt.data.duplicate
            ? 'already migrated (same source file hash and line)'
            : legacyState === 'mastered'
              ? 'migrated as completed learning; understanding=unassessed'
              : 'migrated as in_progress activity trace; understanding=unassessed',
          eventId: receipt.data.eventId,
          seq: receipt.data.seq,
        });
      });
    }

    const receiptsPath = path.join(
      this.paths.migrationDir,
      `receipts-${stamp}-${fileStamp(this.ids.next('legacy-receipt'))}.jsonl`,
    );
    try {
      mkdirSync(this.paths.migrationDir, { recursive: true });
      writeFileSync(
        receiptsPath,
        `${items.map((item) => JSON.stringify(item)).join('\n')}${items.length > 0 ? '\n' : ''}`,
        'utf8',
      );
    } catch (error) {
      return errResult(
        'STORAGE_FAILED',
        `migration receipts could not be written: ${(error as Error).message}`,
        true,
      );
    }

    const receipt: MigrationReceipt = {
      schemaVersion: 1,
      source: request.sourcePath,
      backupDir,
      backupFiles,
      items,
      migrated: items.filter((item) => item.status === 'migrated').length,
      skipped: items.filter((item) => item.status === 'skipped').length,
      rejected: items.filter((item) => item.status === 'rejected').length,
      createdAt: this.clock.now(),
      receiptsPath,
    };
    return okResult(receipt, receipt.migrated);
  }
}

function rejected(file: LegacyFile, line: number, reason: string): MigrationReceiptItem {
  return {
    sourceFile: file.relativeName,
    line,
    status: 'rejected',
    reason,
    eventId: null,
    seq: null,
  };
}

function detectLegacyState(record: Record<string, unknown>): 'mastered' | 'exploring' | null {
  if (record.mastered === true) return 'mastered';
  if (record.exploring === true) return 'exploring';
  const state = record.state ?? record.status;
  if (state === 'mastered') return 'mastered';
  if (state === 'exploring') return 'exploring';
  return null;
}
