import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  cleanup,
  journalCommand,
  openStorage,
  requestContext,
  tmpRoot,
} from './helpers.js';
import { sha256File } from '../src/index.js';

let root: string;
let exportRoot: string;

beforeEach(() => {
  root = tmpRoot('maintenance');
  exportRoot = tmpRoot('export-target');
});

afterEach(() => {
  cleanup(root);
  cleanup(exportRoot);
});

describe('scoped export', () => {
  it('exports journal and snapshots with a hashed manifest', async () => {
    const storage = await openStorage(root);
    try {
      await storage.append(requestContext('req.1'), journalCommand('req.1'));
      await storage.append(requestContext('req.2'), journalCommand('req.2'));
      storage.saveSnapshot('learner.local.default', 2, { value: 'exported' });
      const exported = storage.exportData('learning_records', exportRoot, 'req.export');
      expect(exported.ok).toBe(true);
      if (!exported.ok) return;
      const files = exported.data.manifest.files.map((file) => file.relativePath);
      expect(files).toContain('journal/events.jsonl');
      expect(files.some((file) => file.startsWith('snapshots/'))).toBe(true);
      expect(files).not.toContain('journal/events.lock');
      const manifestOnDisk = JSON.parse(
        readFileSync(exported.data.manifestPath, 'utf8'),
      ) as typeof exported.data.manifest;
      expect(manifestOnDisk.exportId).toBe(exported.data.exportId);
      for (const file of exported.data.manifest.files) {
        const exportedFile = path.join(exported.data.directory, ...file.relativePath.split('/'));
        expect(existsSync(exportedFile)).toBe(true);
        expect(sha256File(exportedFile)).toBe(file.sha256);
      }
    } finally {
      storage.close();
    }
  });

  it('rejects relative export targets and unknown scopes', async () => {
    const storage = await openStorage(root);
    try {
      const relative = storage.exportData('journal', 'relative-dir', 'req.export');
      expect(relative.ok).toBe(false);
      if (!relative.ok) expect(relative.error.code).toBe('INVALID_INPUT');
      const unknown = storage.exportData('unknown' as never, exportRoot, 'req.export');
      expect(unknown.ok).toBe(false);
    } finally {
      storage.close();
    }
  });
});

describe('confirmed deletion', () => {
  it('requires confirmation and a closed store, then deletes only the selected scope', async () => {
    const storage = await openStorage(root);
    await storage.append(requestContext('req.1'), journalCommand('req.1'));
    storage.saveSnapshot('learner.local.default', 1, { value: 'keep?' });
    const plan = storage.prepareDelete('learning_records');
    expect(plan.ok).toBe(true);
    if (!plan.ok) throw new Error('delete plan missing');
    expect(plan.data.requiresConfirmation).toBe(true);
    expect(plan.data.targets.length).toBe(2);
    expect(plan.data.targets.every((target) => target.startsWith(root))).toBe(true);
    expect(plan.data.warnings.join(' ')).toContain('textbook source');

    const missingConfirmation = storage.deleteData(plan.data, false);
    expect(missingConfirmation.ok).toBe(false);
    if (!missingConfirmation.ok) expect(missingConfirmation.error.code).toBe('CONTRACT_REJECTED');

    const whileOpen = storage.deleteData(plan.data, true);
    expect(whileOpen.ok).toBe(false);
    if (!whileOpen.ok) expect(whileOpen.error.code).toBe('CONFLICT');

    storage.close();
    const deleted = storage.deleteData(plan.data, true);
    expect(deleted.ok).toBe(true);
    if (deleted.ok) {
      expect(existsSync(path.join(root, 'journal', 'events.jsonl'))).toBe(false);
      expect(existsSync(path.join(root, 'snapshots'))).toBe(false);
      expect(existsSync(deleted.data.receiptPath)).toBe(true);
      const receipt = JSON.parse(readFileSync(deleted.data.receiptPath, 'utf8')) as {
        deleted: string[];
        auditPath?: string;
      };
      expect(receipt.deleted.length).toBe(2);
      expect(receipt.auditPath).toBe(deleted.data.auditPath);
      expect(deleted.data.auditPath).toBeTruthy();
      const auditLines = readFileSync(deleted.data.auditPath as string, 'utf8')
        .split(/\r?\n/)
        .filter((line) => line.length > 0)
        .map((line) => JSON.parse(line) as { outcome: string; code: string; deletedTargets: string[] | null });
      expect(auditLines.some((line) => line.code === 'DELETE_AUTHORIZED')).toBe(true);
      expect(auditLines.some((line) => line.code === 'DELETE_COMPLETED')).toBe(true);
      const completed = auditLines.find((line) => line.code === 'DELETE_COMPLETED');
      expect(completed?.outcome).toBe('authorized');
      expect(completed?.deletedTargets?.length).toBe(2);
    }

    const reopened = await openStorage(root);
    try {
      expect(reopened.lastSeq).toBe(0);
      const latest = await reopened.latestSeq(requestContext('req.after.delete'));
      expect(latest.ok && latest.data.lastSeq).toBe(0);
    } finally {
      reopened.close();
    }
  });

  it('rejects a forged plan whose target escapes the storage root', async () => {
    const storage = await openStorage(root);
    const plan = storage.prepareDelete('journal');
    expect(plan.ok).toBe(true);
    if (!plan.ok) throw new Error('delete plan missing');
    const outside = path.join(exportRoot, 'must-not-delete');
    storage.close();
    const forged = { ...plan.data, targets: [outside] };
    const result = storage.deleteData(forged, true);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('CONTRACT_REJECTED');
    expect(existsSync(outside)).toBe(false);
  });

  it('rejects a forged plan that adds another root-internal target (B-02)', async () => {
    const storage = await openStorage(root);
    await storage.append(requestContext('req.b02'), journalCommand('req.b02'));
    const plan = storage.prepareDelete('journal');
    expect(plan.ok).toBe(true);
    if (!plan.ok) throw new Error('delete plan missing');
    storage.close();
    const receiptsDir = path.join(root, 'receipts');
    const forged = { ...plan.data, targets: [...plan.data.targets, receiptsDir] };
    const result = storage.deleteData(forged, true);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('CONTRACT_REJECTED');
      expect(result.error.message).toContain('DELETE_PLAN_MISMATCH');
      expect(result.error.detailsRef).toContain(plan.data.planId);
    }
    // Nothing outside the recomputed scope was removed.
    expect(existsSync(path.join(root, 'journal', 'events.jsonl'))).toBe(true);
    expect(existsSync(receiptsDir)).toBe(true);
    expect(existsSync(path.join(root, 'snapshots'))).toBe(true);

    const audit = readFileSync(path.join(receiptsDir, 'delete-audit.jsonl'), 'utf8')
      .split(/\r?\n/)
      .filter((line) => line.length > 0)
      .map((line) => JSON.parse(line) as {
        outcome: string;
        code: string;
        expectedTargets: string[];
        providedTargets: string[];
      });
    const rejected = audit[audit.length - 1];
    expect(rejected?.outcome).toBe('rejected');
    expect(rejected?.code).toContain('TARGET_SET_MISMATCH');
    expect(rejected?.expectedTargets.length).toBe(1);
    expect(rejected?.providedTargets.length).toBe(2);
  });

  it('rejects missing or duplicated targets instead of deleting a partial scope (B-02)', async () => {
    const storage = await openStorage(root);
    const plan = storage.prepareDelete('snapshots');
    expect(plan.ok).toBe(true);
    if (!plan.ok) throw new Error('delete plan missing');
    storage.close();

    const missing = storage.deleteData({ ...plan.data, targets: [] }, true);
    expect(missing.ok).toBe(false);
    if (!missing.ok) expect(missing.error.message).toContain('DELETE_PLAN_MISMATCH');
    expect(existsSync(path.join(root, 'snapshots'))).toBe(true);

    const duplicated = storage.deleteData(
      { ...plan.data, targets: [plan.data.targets[0] as string, plan.data.targets[0] as string] },
      true,
    );
    expect(duplicated.ok).toBe(false);
    if (!duplicated.ok) expect(duplicated.error.message).toContain('DELETE_PLAN_MISMATCH');
    expect(existsSync(path.join(root, 'snapshots'))).toBe(true);
  });

  it.skipIf(process.platform !== 'win32')(
    'accepts realpath/case-equivalent targets on Windows but still deletes only the scope (B-02)',
    async () => {
      const storage = await openStorage(root);
      const plan = storage.prepareDelete('snapshots');
      expect(plan.ok).toBe(true);
      if (!plan.ok) throw new Error('delete plan missing');
      storage.close();
      const upper = { ...plan.data, targets: plan.data.targets.map((target) => target.toUpperCase()) };
      const deleted = storage.deleteData(upper, true);
      expect(deleted.ok).toBe(true);
      expect(existsSync(path.join(root, 'snapshots'))).toBe(false);
      // Journal and receipts are untouched by the snapshots scope.
      expect(existsSync(path.join(root, 'journal'))).toBe(true);
      expect(existsSync(path.join(root, 'receipts'))).toBe(true);
    },
  );

  it('keeps the delete plan scoped to its own storage root', async () => {
    const storage = await openStorage(root);
    const plan = storage.prepareDelete('snapshots');
    expect(plan.ok).toBe(true);
    if (!plan.ok) throw new Error('delete plan missing');
    storage.close();
    const foreign = { ...plan.data, root: path.join(root, 'other-root') };
    const result = storage.deleteData(foreign, true);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('CONTRACT_REJECTED');
  });

  it('lists migration backups as a separate delete scope', async () => {
    const storage = await openStorage(root);
    try {
      const plan = storage.prepareDelete('migration_backups');
      expect(plan.ok).toBe(true);
      if (plan.ok) expect(plan.data.targets[0]).toBe(path.join(root, 'migration'));
      const files = readdirSync(root).sort();
      expect(files).toContain('migration');
    } finally {
      storage.close();
    }
  });
});
