import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  cleanup,
  fixtureText,
  openStorage,
  requestContext,
  journalCommand,
  tmpRoot,
} from './helpers.js';
import {
  createStoragePaths,
  ensureStorageDirs,
  safeFileName,
} from '../src/index.js';

let root: string;

beforeEach(() => {
  root = tmpRoot('recovery');
  ensureStorageDirs(createStoragePaths(root));
});

afterEach(() => {
  cleanup(root);
});

function writeJournal(text: string): void {
  writeFileSync(path.join(root, 'journal', 'events.jsonl'), text, 'utf8');
}

function snapshotFiles(): string[] {
  return readdirSync(path.join(root, 'snapshots'));
}

describe('journal recovery', () => {
  it('quarantines a half-written tail line and keeps the complete prefix writable', async () => {
    const original = fixtureText('journal/tail-half-line.jsonl');
    writeJournal(original);
    const storage = await openStorage(root);
    try {
      expect(storage.status.mode).toBe('writable');
      expect(storage.status.tailPartialRepaired).toBe(true);
      expect(storage.status.lastSeq).toBe(2);
      expect(storage.status.commitCount).toBe(2);
      expect(storage.status.quarantineFiles.length).toBeGreaterThanOrEqual(2);
      expect(fixtureText('journal/tail-half-line.jsonl')).toBe(original);

      const appended = await storage.append(requestContext('req.after.tail'), journalCommand('req.after.tail'));
      expect(appended.ok).toBe(true);
      if (appended.ok) expect(appended.data.seq).toBe(3);
      const lines = readFileSync(path.join(root, 'journal', 'events.jsonl'), 'utf8')
        .split(/\r?\n/)
        .filter((line) => line.length > 0);
      expect(lines).toHaveLength(3);
    } finally {
      storage.close();
    }
  });

  it('degrades to read-only on middle corruption and refuses new grades', async () => {
    writeJournal(fixtureText('journal/middle-corruption.jsonl'));
    const storage = await openStorage(root);
    try {
      expect(storage.status.mode).toBe('read_only');
      expect(storage.status.writable).toBe(false);
      expect(storage.status.corruptLines).toHaveLength(1);
      expect(storage.status.corruptLines[0]?.line).toBe(2);
      expect(storage.recoveryReport().recoverySteps.length).toBeGreaterThan(0);

      const append = await storage.append(requestContext('req.corrupt'), journalCommand('req.corrupt'));
      expect(append.ok).toBe(false);
      if (!append.ok) {
        expect(append.error.code).toBe('CONTRACT_REJECTED');
        expect(append.error.message).toContain('read-only');
      }
      const read = await storage.readFrom(requestContext('req.read'), 0, 10);
      expect(read.ok).toBe(true);
      if (read.ok) {
        expect(read.data.corrupted).toBe(true);
        expect(read.data.commits).toHaveLength(1);
        expect(read.data.recoverySteps.length).toBeGreaterThan(0);
      }
      // The original journal is preserved untouched.
      expect(fixtureText('journal/middle-corruption.jsonl')).toBe(
        readFileSync(path.join(root, 'journal', 'events.jsonl'), 'utf8'),
      );
    } finally {
      storage.close();
    }
  });

  it('degrades to read-only when seq is not monotonic', async () => {
    const fixture = fixtureText('journal/duplicate-request-id.jsonl')
      .split(/\r?\n/)
      .filter((line) => line.length > 0);
    writeJournal(`${fixture[1]}\n${fixture[0]}\n`);
    const storage = await openStorage(root);
    try {
      expect(storage.status.mode).toBe('read_only');
      expect(storage.status.nonMonotonicSeq).toBe(true);
    } finally {
      storage.close();
    }
  });
});

describe('snapshots', () => {
  it('saves and loads a snapshot with a content hash and atomic replace', async () => {
    const storage = await openStorage(root);
    try {
      await storage.append(requestContext('req.1'), journalCommand('req.1'));
      await storage.append(requestContext('req.2'), journalCommand('req.2'));
      const first = storage.saveSnapshot('learner.local.default', 2, { value: 1 });
      expect(first.ok).toBe(true);
      if (first.ok) {
        expect(first.data.replaced).toBe(false);
        expect(first.data.sha256).toMatch(/^[a-f0-9]{64}$/);
      }
      const loaded = storage.loadSnapshot('learner.local.default');
      expect(loaded.ok).toBe(true);
      if (loaded.ok) {
        expect(loaded.data.rebuilt).toBe(false);
        expect(loaded.data.reason).toBe('valid');
        expect(loaded.data.snapshot?.payload['value']).toBe(1);
      }
      const second = storage.saveSnapshot('learner.local.default', 2, { value: 2 });
      expect(second.ok && second.data.replaced).toBe(true);
      expect(snapshotFiles().filter((file) => !file.includes('.tmp-'))).toHaveLength(1);
      const reloaded = storage.loadSnapshot('learner.local.default');
      expect(reloaded.ok && reloaded.data.snapshot?.payload['value']).toBe(2);
    } finally {
      storage.close();
    }
  });

  it('rebuilds a snapshot whose payload hash was tampered with', async () => {
    const storage = await openStorage(root);
    try {
      await storage.append(requestContext('req.1'), journalCommand('req.1'));
      storage.saveSnapshot('learner.local.default', 1, { value: 'original' });
      const [file] = snapshotFiles();
      const full = path.join(root, 'snapshots', file as string);
      const snapshot = JSON.parse(readFileSync(full, 'utf8')) as Record<string, unknown>;
      snapshot.payload = { value: 'tampered' };
      writeFileSync(full, `${JSON.stringify(snapshot, null, 2)}\n`, 'utf8');
      const loaded = storage.loadSnapshot('learner.local.default');
      expect(loaded.ok).toBe(true);
      if (loaded.ok) {
        expect(loaded.data.rebuilt).toBe(true);
        expect(loaded.data.reason).toBe('invalid_snapshot');
        expect(loaded.data.invalidReason).toContain('stateHash');
        expect(loaded.data.snapshot?.lastSeq).toBe(1);
      }
      const again = storage.loadSnapshot('learner.local.default');
      expect(again.ok && again.data.rebuilt).toBe(false);
    } finally {
      storage.close();
    }
  });

  it('rebuilds a snapshot that is ahead of the journal', async () => {
    const storage = await openStorage(root);
    try {
      await storage.append(requestContext('req.1'), journalCommand('req.1'));
      storage.saveSnapshot('learner.local.default', 1, { value: 'ok' });
      await storage.append(requestContext('req.2'), journalCommand('req.2'));
      const [file] = snapshotFiles();
      const full = path.join(root, 'snapshots', file as string);
      const snapshot = JSON.parse(readFileSync(full, 'utf8')) as Record<string, unknown>;
      snapshot.lastSeq = 99;
      writeFileSync(full, `${JSON.stringify(snapshot, null, 2)}\n`, 'utf8');
      const loaded = storage.loadSnapshot('learner.local.default');
      expect(loaded.ok).toBe(true);
      if (loaded.ok) {
        expect(loaded.data.rebuilt).toBe(true);
        expect(loaded.data.reason).toBe('snapshot_ahead');
        expect(loaded.data.snapshot?.lastSeq).toBe(2);
      }
    } finally {
      storage.close();
    }
  });

  it('rebuilds a snapshot file that is not valid JSON', async () => {
    const storage = await openStorage(root);
    try {
      await storage.append(requestContext('req.1'), journalCommand('req.1'));
      storage.saveSnapshot('learner.local.default', 1, { value: 'ok' });
      const [file] = snapshotFiles();
      writeFileSync(path.join(root, 'snapshots', file as string), '{broken', 'utf8');
      const loaded = storage.loadSnapshot('learner.local.default');
      expect(loaded.ok).toBe(true);
      if (loaded.ok) {
        expect(loaded.data.rebuilt).toBe(true);
        expect(loaded.data.snapshot?.lastSeq).toBe(1);
      }
    } finally {
      storage.close();
    }
  });

  it('cannot rebuild from a corrupt journal and reports the recovery steps', async () => {
    writeJournal(fixtureText('journal/middle-corruption.jsonl'));
    const storage = await openStorage(root);
    try {
      const invalidSnapshotPath = path.join(
        root,
        'snapshots',
        `${safeFileName('learner.local.default')}.json`,
      );
      writeFileSync(invalidSnapshotPath, '{broken', 'utf8');
      const loaded = storage.loadSnapshot('learner.local.default');
      expect(loaded.ok).toBe(false);
      if (!loaded.ok) {
        expect(loaded.error.code).toBe('CONTRACT_REJECTED');
        expect(loaded.error.message).toContain('recovery');
      }
      const saved = storage.saveSnapshot('learner.local.default', 1, { value: 1 });
      expect(saved.ok).toBe(false);
    } finally {
      storage.close();
    }
  });

  it('rejects a snapshot lastSeq beyond the journal', async () => {
    const storage = await openStorage(root);
    try {
      await storage.append(requestContext('req.1'), journalCommand('req.1'));
      const saved = storage.saveSnapshot('learner.local.default', 2, { value: 1 });
      expect(saved.ok).toBe(false);
      if (!saved.ok) expect(saved.error.code).toBe('INVALID_INPUT');
    } finally {
      storage.close();
    }
  });

  it('reports a missing snapshot without inventing one', async () => {
    const storage = await openStorage(root);
    try {
      const loaded = storage.loadSnapshot('learner.local.default');
      expect(loaded.ok).toBe(true);
      if (loaded.ok) {
        expect(loaded.data.snapshot).toBeNull();
        expect(loaded.data.rebuilt).toBe(false);
        expect(loaded.data.reason).toBe('missing');
      }
      expect(snapshotFiles()).toHaveLength(0);
    } finally {
      storage.close();
    }
  });
});
