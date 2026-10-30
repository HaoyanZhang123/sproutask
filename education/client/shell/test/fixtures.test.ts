import { describe, expect, it } from 'vitest';
import {
  FIXTURE_NOTICE,
  buildFixtureDataset,
  createFixtureShellDataSource,
  type ShellRequest,
} from '../src/index.js';

const REQUEST: ShellRequest = {
  requestId: 'request.test.1',
  learnerId: 'learner.local.default',
  now: '2026-10-29T10:00:00Z',
};

describe('fixture-only data source', () => {
  it('validates the frozen T01 fixtures and marks itself as fixture at every layer', async () => {
    const dataset = buildFixtureDataset();
    expect(dataset.pack.concepts.map((concept) => concept.id)).toContain('concept.cell');
    expect(dataset.sessions.map((session) => session.id)).toEqual([
      'session.cell.1',
      'session.cell-structure.1',
    ]);
    expect(dataset.progresses).toHaveLength(3);
    expect(dataset.selfReports[0]?.claimedState).toBe('can_explain');

    const source = createFixtureShellDataSource();
    expect(source.kind).toBe('fixture');
    expect(source.notice).toBe(FIXTURE_NOTICE);
    expect(source.notice).toContain('演示数据');
    expect(source.notice).toContain('不是真实教材');
    const snapshot = await source.loadSnapshot(REQUEST);
    expect(snapshot.ok).toBe(true);
    if (!snapshot.ok) return;
    expect(snapshot.data.fixture).toBe(true);
    expect(snapshot.data.auth.account.status).toBe('unavailable');
    expect(snapshot.data.auth.apiKey.status).toBe('available');
    expect(snapshot.data.capabilities.tools).toEqual([]);
    expect(JSON.stringify(snapshot.data)).not.toMatch(/sk-[A-Za-z0-9]|Bearer\s+[A-Za-z0-9]/);
  });

  it('keeps the reviewed+due, needs-support and unassessed progress combinations distinct', async () => {
    const source = createFixtureShellDataSource();
    const records = await source.loadRecords(REQUEST);
    expect(records.ok).toBe(true);
    if (!records.ok) return;
    const cell = records.data.progresses.find((entry) => entry.conceptId === 'concept.cell');
    const structure = records.data.progresses.find((entry) => entry.conceptId === 'concept.cell-structure');
    const division = records.data.progresses.find((entry) => entry.conceptId === 'concept.cell-division');
    expect(cell?.learning.state).toBe('completed');
    expect(cell?.review.lastCompletedAt).not.toBeNull();
    expect(cell?.review.dueAt).not.toBeNull();
    expect(structure?.understanding.state).toBe('needs_support');
    expect(division?.understanding.state).toBe('unassessed');
    expect(division?.learning.state).toBe('not_started');
    const history = records.data.assessments.filter((entry) => entry.conceptId === 'concept.cell');
    expect(history.length).toBe(2);
    expect(history.map((entry) => entry.state)).toContain('developing');
  });

  it('returns structured errors and explicit receipts instead of free-form failures', async () => {
    const failing = createFixtureShellDataSource({ scenario: 'records-error' });
    const error = await failing.loadRecords(REQUEST);
    expect(error.ok).toBe(false);
    if (error.ok) return;
    expect(error.error.code).toBe('STORAGE_FAILED');
    expect(error.error.retryable).toBe(true);

    const source = createFixtureShellDataSource();
    const exported = await source.exportData(REQUEST, 'learning_records');
    expect(exported.ok).toBe(true);
    if (exported.ok) {
      expect(exported.data.note).toContain('不含教材原文件');
      expect(exported.data.recordCount).toBeGreaterThan(0);
    }
    const deleted = await source.deleteData(REQUEST, 'learning_records');
    expect(deleted.ok).toBe(true);
    if (deleted.ok) {
      expect(deleted.data.note).toContain('教材文件与共享内容没有被删除');
      expect(deleted.data.removedEvidence).toBeGreaterThan(0);
    }
    const after = await source.loadRecords(REQUEST);
    expect(after.ok).toBe(true);
    if (after.ok) expect(after.data.progresses).toHaveLength(0);
  });
});
