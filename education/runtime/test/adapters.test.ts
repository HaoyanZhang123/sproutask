import { describe, expect, it } from 'vitest';
import {
  DSH_NOT_BOUND_MESSAGE,
  createFixedClock,
  createMockTutorGateway,
  createNotBoundDshRuntimeAdapter,
  createNotBoundTutorGateway,
  createSequentialIdGenerator,
  createSystemClock,
  MOCK_MODEL,
} from '../src/index.js';
import type { RequestContext } from '@edu/domain';

const ctx: RequestContext = {
  requestId: 'request.1',
  learnerId: 'learner.1',
  now: '2026-10-29T09:00:00Z',
};

describe('mock tutor gateway', () => {
  it('is explicitly labelled as mock', async () => {
    const gateway = createMockTutorGateway();
    expect(gateway.kind).toBe('mock');
    expect(MOCK_MODEL.isMock).toBe(true);
    const capabilities = await gateway.capabilities(ctx);
    expect(capabilities.ok).toBe(true);
    if (capabilities.ok) {
      expect(capabilities.data.model?.isMock).toBe(true);
      expect(capabilities.data.authStatus).toBe('unavailable');
    }
  });

  it('returns deterministic offline turns without a DSH session id', async () => {
    const gateway = createMockTutorGateway({ replies: ['first mock reply'] });
    const session = {
      schemaVersion: 1 as const,
      id: 'session.1',
      learnerId: 'learner.1',
      courseEditionId: 'course.1',
      packVersion: '1.0.0',
      trustMode: 'published' as const,
      conceptId: 'concept.1',
      mode: 'learn' as const,
      status: 'active' as const,
      startedAt: '2026-10-29T08:00:00Z',
      endedAt: null,
      resumeCursor: { activityId: null, cursor: null },
      dshSessionId: null,
    };
    const started = await gateway.startSession(ctx, { session });
    expect(started.ok).toBe(true);
    if (started.ok) expect(started.data.dshSessionId).toBeNull();

    const turn = await gateway.sendTurn(ctx, {
      sessionId: 'session.1',
      revision: 0,
      message: 'hello',
      activityId: null,
      stream: false,
    });
    expect(turn.ok).toBe(true);
    if (turn.ok) {
      expect(turn.data.text).toBe('first mock reply');
      expect(turn.data.model.isMock).toBe(true);
      expect(turn.data.revision).toBe(1);
    }
    expect(gateway.calls).toEqual(['startSession', 'sendTurn']);
  });

  it('can simulate an unavailable model route', async () => {
    const gateway = createMockTutorGateway({
      failWith: { code: 'UNAVAILABLE', message: 'mock route down' },
    });
    const result = await gateway.capabilities(ctx);
    expect(result.ok).toBe(true);
    const turn = await gateway.sendTurn(ctx, {
      sessionId: 'session.1',
      revision: 0,
      message: null,
      activityId: null,
      stream: false,
    });
    expect(turn.ok).toBe(false);
    if (!turn.ok) {
      expect(turn.error.code).toBe('UNAVAILABLE');
      expect(turn.error.retryable).toBe(true);
    }
  });
});

describe('not bound DSH adapter', () => {
  it('reports the exact T00 block instead of faking a binding', async () => {
    const adapter = createNotBoundDshRuntimeAdapter();
    const probe = await adapter.probe(ctx);
    expect(probe.ok).toBe(false);
    if (!probe.ok) {
      expect(probe.error.code).toBe('NOT_IMPLEMENTED');
      expect(probe.error.message).toBe(DSH_NOT_BOUND_MESSAGE);
      expect(probe.error.retryable).toBe(false);
    }
  });

  it('truthfully reports unbound capabilities without a token', async () => {
    const adapter = createNotBoundDshRuntimeAdapter();
    const capabilities = await adapter.capabilities(ctx);
    expect(capabilities.ok).toBe(true);
    if (capabilities.ok) {
      expect(capabilities.data.dsh.bound).toBe(false);
      expect(capabilities.data.model.text).toBe(false);
    }
    const auth = await adapter.authStatus(ctx);
    expect(auth.ok).toBe(true);
    if (auth.ok) {
      expect(auth.data.status).toBe('unknown');
      expect(Object.keys(auth.data)).not.toContain('token');
      expect(Object.keys(auth.data)).not.toContain('cookie');
    }
    const tutor = adapter.createTutorGateway();
    const tutorCapabilities = await tutor.capabilities(ctx);
    expect(tutorCapabilities.ok).toBe(false);
    if (!tutorCapabilities.ok) {
      expect(tutorCapabilities.error.message).toBe(DSH_NOT_BOUND_MESSAGE);
    }
  });

  it('the unbound tutor gateway kind is dsh, not mock', () => {
    const gateway = createNotBoundTutorGateway();
    expect(gateway.kind).toBe('dsh');
    expect(gateway.kind).not.toBe('mock');
  });
});

describe('edge adapters', () => {
  it('system clock returns RFC3339 UTC seconds', () => {
    const clock = createSystemClock();
    const now = clock.now();
    expect(now).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/);
  });

  it('fixed clock is stable', () => {
    const clock = createFixedClock('2026-10-29T09:00:00Z');
    expect(clock.now()).toBe(clock.now());
  });

  it('sequential ids are opaque and deterministic', () => {
    const ids = createSequentialIdGenerator();
    const first = ids.next('concept');
    const second = ids.next('concept');
    expect(first).toBe('concept.1');
    expect(second).toBe('concept.2');
    expect(first).toMatch(/^[A-Za-z0-9][A-Za-z0-9._:@-]{0,127}$/);
  });
});
