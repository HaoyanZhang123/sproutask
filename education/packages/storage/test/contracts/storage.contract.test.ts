/**
 * Storage contract test: consumes the frozen T01 fixtures and the EventStore
 * port shape, proving no second protocol was invented.
 */

import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { EventStore } from '@edu/domain';
import {
  cleanup,
  fixtureText,
  journalCommand,
  openStorage,
  requestContext,
  tmpRoot,
} from '../helpers.js';
import {
  createStorageFeature,
  createStoragePaths,
  ensureStorageDirs,
  safeFileName,
} from '../../src/index.js';

let root: string;

beforeEach(() => {
  root = tmpRoot('contract');
  ensureStorageDirs(createStoragePaths(root));
});

afterEach(() => {
  cleanup(root);
});

function writeJournal(text: string): void {
  writeFileSync(path.join(root, 'journal', 'events.jsonl'), text, 'utf8');
}

describe('EventStore port contract', () => {
  it('exposes the frozen append/read/latestSeq envelope', async () => {
    const storage = await openStorage(root);
    try {
      const store: EventStore = storage;
      const appended = await store.append(requestContext('req.contract'), journalCommand('req.contract'));
      expect(appended.ok).toBe(true);
      if (appended.ok) {
        expect(appended.data).toMatchObject({
          requestId: 'req.contract',
          seq: 1,
          revision: 1,
          duplicate: false,
        });
      }
      const read = await store.readFrom(requestContext('req.contract.read'), 0, 10);
      expect(read.ok).toBe(true);
      if (read.ok) expect(read.data.commits[0]?.requestId).toBe('req.contract');
      const latest = await store.latestSeq(requestContext('req.contract.seq'));
      expect(latest.ok && latest.data.lastSeq).toBe(1);
      const invalid = await store.readFrom(requestContext('req.contract.read'), 0, 5000);
      expect(invalid.ok).toBe(false);
      if (!invalid.ok) expect(invalid.error.code).toBe('INVALID_INPUT');
    } finally {
      storage.close();
    }
  });

  it('is consumed through the composition factory and registers only against its own store', async () => {
    const feature = await createStorageFeature({
      root,
      clock: { now: () => '2026-10-29T09:00:00Z' },
      ids: { next: (prefix) => `${prefix}.contract` },
    });
    expect(feature.ok).toBe(true);
    if (!feature.ok) return;
    expect(feature.data.featureModule.feature.id).toBe('@edu/storage');
    expect(feature.data.featureModule.feature.apiVersion).toBe(1);
    expect(feature.data.featureModule.feature.requiredCapabilities).toEqual([]);
    expect(() =>
      feature.data.featureModule.registerEducationFeature({}, { eventStore: feature.data.eventStore }),
    ).not.toThrow();
    expect(() =>
      feature.data.featureModule.registerEducationFeature({}, { eventStore: null }),
    ).toThrow(/must be composed with services.eventStore/);
    feature.data.storage.close();
  });
});

describe('T01 journal fixtures', () => {
  it('repairs the half-written tail fixture', async () => {
    writeJournal(fixtureText('journal/tail-half-line.jsonl'));
    const storage = await openStorage(root);
    try {
      expect(storage.status.mode).toBe('writable');
      expect(storage.status.tailPartialRepaired).toBe(true);
      expect(storage.status.lastSeq).toBe(2);
    } finally {
      storage.close();
    }
  });

  it('degrades to read-only on the middle corruption fixture', async () => {
    writeJournal(fixtureText('journal/middle-corruption.jsonl'));
    const storage = await openStorage(root);
    try {
      expect(storage.status.mode).toBe('read_only');
      expect(storage.status.corruptLines[0]?.line).toBe(2);
    } finally {
      storage.close();
    }
  });

  it('deduplicates the persisted duplicate requestId fixture', async () => {
    writeJournal(fixtureText('journal/duplicate-request-id.jsonl'));
    const storage = await openStorage(root);
    try {
      expect(storage.status.lastSeq).toBe(3);
      expect(storage.status.duplicateRequestCommits).toBe(1);
      // 重发的是 seq 1 那条命令本身（attempt.submitted / attempt.journal.1），
      // 幂等只对"同一条命令"成立；撞 id 的不同命令会被判为 CONFLICT。
      const retry = await storage.append(
        requestContext('request.duplicate'),
        {
          ...journalCommand('request.duplicate'),
          type: 'attempt.submitted',
          payload: { attemptId: 'attempt.journal.1' },
        },
      );
      expect(retry.ok).toBe(true);
      if (retry.ok) {
        expect(retry.data.duplicate).toBe(true);
        expect(retry.data.seq).toBe(1);
      }
    } finally {
      storage.close();
    }
  });

  it('rejects a reused requestId that carries a different command', async () => {
    writeJournal(fixtureText('journal/duplicate-request-id.jsonl'));
    const storage = await openStorage(root);
    try {
      const reused = await storage.append(
        requestContext('request.duplicate'),
        journalCommand('request.duplicate'),
      );
      expect(reused.ok).toBe(false);
      if (!reused.ok) expect(reused.error.code).toBe('CONFLICT');
      expect(storage.status.lastSeq).toBe(3);
    } finally {
      storage.close();
    }
  });

  it('rebuilds the invalid snapshot fixture from the journal', async () => {
    writeJournal(fixtureText('journal/duplicate-request-id.jsonl'));
    const snapshot = fixtureText('snapshots/invalid.json');
    writeFileSync(
      path.join(root, 'snapshots', `${safeFileName('learner.local.default')}.json`),
      snapshot,
      'utf8',
    );
    const storage = await openStorage(root);
    try {
      const loaded = storage.loadSnapshot('learner.local.default');
      expect(loaded.ok).toBe(true);
      if (loaded.ok) {
        expect(loaded.data.rebuilt).toBe(true);
        expect(loaded.data.reason).toBe('invalid_snapshot');
        expect(loaded.data.snapshot?.lastSeq).toBe(3);
      }
    } finally {
      storage.close();
    }
  });
});
