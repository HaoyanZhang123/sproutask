import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  cleanup,
  fixtureText,
  openStorage,
  requestContext,
  tmpRoot,
} from './helpers.js';
import { createStoragePaths, ensureStorageDirs, sha256File } from '../src/index.js';

let root: string;
let legacyRoot: string;

beforeEach(() => {
  root = tmpRoot('migration');
  legacyRoot = tmpRoot('legacy-source');
  ensureStorageDirs(createStoragePaths(root));
});

afterEach(() => {
  cleanup(root);
  cleanup(legacyRoot);
});

function writeLegacy(): string {
  const file = path.join(legacyRoot, 'legacy.jsonl');
  const lines = [
    JSON.stringify({ learnerId: 'learner.local.default', mastered: true, conceptId: 'concept.cell' }),
    JSON.stringify({ learnerId: 'learner.local.default', exploring: true, conceptId: 'concept.cell-structure' }),
    JSON.stringify({ learnerId: 'learner.local.default', state: 'unknown' }),
    JSON.stringify({ mastered: true, conceptId: 'concept.cell' }),
    '{not valid json',
  ];
  writeFileSync(file, `${lines.join('\n')}\n`, 'utf8');
  return file;
}

function journalCommands(): Record<string, unknown>[] {
  const file = path.join(root, 'journal', 'events.jsonl');
  if (!existsSync(file)) return [];
  return readFileSync(file, 'utf8')
    .split(/\r?\n/)
    .filter((line) => line.length > 0)
    .map((line) => JSON.parse(line) as Record<string, unknown>);
}

describe('explicit legacy migration', () => {
  it('backs up the source, writes per line receipts and never promotes mastered to supported', async () => {
    const source = writeLegacy();
    const original = readFileSync(source, 'utf8');
    const storage = await openStorage(root);
    try {
      expect(journalCommands()).toHaveLength(0);
      const result = storage.migrateLegacy({ sourcePath: legacyRoot });
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      const receipt = result.data;
      expect(receipt.migrated).toBe(2);
      expect(receipt.skipped).toBe(1);
      expect(receipt.rejected).toBe(2);
      expect(receipt.backupFiles).toHaveLength(1);
      expect(receipt.backupFiles[0]?.sha256).toBe(sha256File(source));
      expect(existsSync(receipt.receiptsPath)).toBe(true);
      const receiptLines = readFileSync(receipt.receiptsPath, 'utf8')
        .split(/\r?\n/)
        .filter((line) => line.length > 0);
      expect(receiptLines).toHaveLength(5);

      const commands = journalCommands();
      expect(commands).toHaveLength(2);
      expect(commands.every((command) => command['type'] === 'legacy.migrated')).toBe(true);
      const masteredPayload = commands[0]?.['payload'] as {
        legacyState: string;
        mapped: { learning: string; understanding: string; strongConclusion: boolean };
      };
      expect(masteredPayload.legacyState).toBe('mastered');
      expect(masteredPayload.mapped).toMatchObject({
        learning: 'completed',
        understanding: 'unassessed',
        strongConclusion: false,
      });
      const exploringPayload = commands[1]?.['payload'] as {
        legacyState: string;
        mapped: { learning: string; understanding: string };
      };
      expect(exploringPayload.legacyState).toBe('exploring');
      expect(exploringPayload.mapped).toMatchObject({
        learning: 'in_progress',
        understanding: 'unassessed',
      });

      const replay = storage.replay('learner.local.default');
      expect(replay.assessments).toHaveLength(0);
      expect(replay.legacyRecords).toHaveLength(2);
      // The legacy source is read-only input: it must not be modified or deleted.
      expect(readFileSync(source, 'utf8')).toBe(original);
      expect(existsSync(source)).toBe(true);
    } finally {
      storage.close();
    }
  });

  it('is idempotent on retry and does not duplicate migrated facts', async () => {
    writeLegacy();
    const storage = await openStorage(root);
    try {
      const first = storage.migrateLegacy({ sourcePath: legacyRoot });
      expect(first.ok).toBe(true);
      const second = storage.migrateLegacy({ sourcePath: legacyRoot });
      expect(second.ok).toBe(true);
      if (!second.ok) return;
      expect(second.data.migrated).toBe(0);
      expect(second.data.skipped).toBe(3);
      expect(second.data.rejected).toBe(2);
      expect(journalCommands()).toHaveLength(2);
    } finally {
      storage.close();
    }
  });

  it('rejects migration while the journal is read-only and rejects missing sources', async () => {
    writeFileSync(path.join(root, 'journal', 'events.jsonl'), fixtureText('journal/middle-corruption.jsonl'));
    const storage = await openStorage(root);
    try {
      const blocked = storage.migrateLegacy({ sourcePath: legacyRoot });
      expect(blocked.ok).toBe(false);
      if (!blocked.ok) expect(blocked.error.code).toBe('CONTRACT_REJECTED');
      const missing = storage.migrateLegacy({ sourcePath: path.join(legacyRoot, 'missing.jsonl') });
      expect(missing.ok).toBe(false);
      if (!missing.ok) expect(missing.error.code).toBe('INVALID_INPUT');
    } finally {
      storage.close();
    }
  });

  it('does not migrate automatically when storage is opened', async () => {
    writeLegacy();
    const storage = await openStorage(root);
    try {
      expect(journalCommands()).toHaveLength(0);
      expect(storage.status.commitCount).toBe(0);
    } finally {
      storage.close();
    }
  });
});
