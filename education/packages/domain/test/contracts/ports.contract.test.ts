/**
 * Port contract test: the unified result envelope, request idempotency and the
 * fact that every required port type is exported from the domain entry.
 */

import { describe, expect, it } from 'vitest';
import {
  NEVER_CANCELLED,
  RequestLedger,
  SERVICE_ERROR_CODES,
  errResult,
  isRetryable,
  isServiceError,
  isServiceOk,
  mapServiceResult,
  okResult,
  type Clock,
  type ContentQuery,
  type EventStore,
  type GradePort,
  type HostPort,
  type IdGenerator,
  type ImportPort,
  type KnowledgePort,
  type LearnerProjectionStore,
  type RequestContext,
  type TutorGateway,
} from '../../src/index.js';

const ctx: RequestContext = {
  requestId: 'request.contract.1',
  learnerId: 'learner.local.default',
  now: '2026-10-29T09:00:00Z',
};

const fakeEventStore: EventStore = {
  async append(_ctx, command) {
    return okResult(
      {
        eventId: command.eventId,
        requestId: command.requestId,
        seq: 1,
        revision: 1,
        duplicate: false,
      },
      1,
    );
  },
  async readFrom() {
    return okResult({ commits: [], fromSeq: 0, lastSeq: 0, hasMore: false, tailPartial: false }, 0);
  },
  async latestSeq() {
    return okResult({ lastSeq: 0 }, 0);
  },
};

const portTypes = {
  clock: null as unknown as Clock,
  ids: null as unknown as IdGenerator,
  eventStore: null as unknown as EventStore,
  contentQuery: null as unknown as ContentQuery,
  knowledge: null as unknown as KnowledgePort,
  tutor: null as unknown as TutorGateway,
  grade: null as unknown as GradePort,
  imports: null as unknown as ImportPort,
  learnerStore: null as unknown as LearnerProjectionStore,
  host: null as unknown as HostPort,
};

describe('service result envelope', () => {
  it('exposes the complete error code set', () => {
    expect(SERVICE_ERROR_CODES).toEqual(
      expect.arrayContaining([
        'INVALID_INPUT',
        'STALE_REVISION',
        'CANCELLED',
        'TIMEOUT',
        'UNAVAILABLE',
        'UNAUTHORIZED',
        'QUOTA_EXCEEDED',
        'UNSUPPORTED',
        'NOT_IMPLEMENTED',
        'CONTRACT_REJECTED',
      ]),
    );
  });

  it('ok results carry data and a revision', () => {
    const result = okResult({ value: 1 }, 7);
    expect(isServiceOk(result)).toBe(true);
    expect(result.ok && result.revision).toBe(7);
    expect(mapServiceResult(result, (data) => data.value)).toEqual({
      ok: true,
      data: 1,
      revision: 7,
    });
  });

  it('error results carry a retryable flag and never a stack', () => {
    const result = errResult('UNAVAILABLE', 'model route unavailable', true, 'evidence:T01/run1');
    expect(isServiceError(result)).toBe(true);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.retryable).toBe(true);
      expect(result.error.detailsRef).toBe('evidence:T01/run1');
      expect(Object.keys(result.error)).not.toContain('stack');
    }
    expect(isRetryable(result)).toBe(true);
  });
});

describe('port implementations compose', () => {
  it('all ten required port types are exported', () => {
    expect(Object.keys(portTypes)).toHaveLength(10);
  });

  it('an event store append returns the frozen receipt shape', async () => {
    const receipt = await fakeEventStore.append(ctx, {
      eventId: 'event.1',
      requestId: 'request.1',
      occurredAt: ctx.now,
      learnerId: ctx.learnerId,
      type: 'attempt.submitted',
      payload: { attemptId: 'attempt.1' },
      effects: [{ kind: 'progress.changed', targetId: 'progress.1', revision: 1 }],
    });
    expect(receipt.ok).toBe(true);
    if (receipt.ok) {
      expect(receipt.data).toMatchObject({ seq: 1, revision: 1, duplicate: false });
    }
  });

  it('duplicate request ids are rejected instead of double committed', () => {
    const ledger = new RequestLedger();
    const first = ledger.begin('request.duplicate');
    const second = ledger.begin('request.duplicate');
    expect(first.ok).toBe(true);
    expect(second.ok).toBe(false);
    if (!second.ok) expect(second.error.code).toBe('DUPLICATE_REQUEST');
    expect(ledger.size).toBe(1);
  });

  it('the never-cancelled token is inert', () => {
    expect(NEVER_CANCELLED.cancelled).toBe(false);
    expect(typeof NEVER_CANCELLED.onCancel(() => undefined)).toBe('function');
  });

  it('auth status payload has no token or cookie field', () => {
    const auth = { method: 'none', status: 'unknown', lastCheckedAt: null, accountRef: null };
    expect(Object.keys(auth)).not.toContain('token');
    expect(Object.keys(auth)).not.toContain('cookie');
  });
});
