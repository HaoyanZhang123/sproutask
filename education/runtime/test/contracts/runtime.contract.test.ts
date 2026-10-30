/**
 * Runtime port contract: every gateway call returns the frozen envelope and a
 * mock is never presented as a DSH binding.
 */

import { describe, expect, it } from 'vitest';
import type { RequestContext, Session } from '@edu/domain';
import {
  DSH_NOT_BOUND_MESSAGE,
  MOCK_MODEL,
  createMockTutorGateway,
  createNotBoundTutorGateway,
} from '../../src/index.js';

const ctx: RequestContext = {
  requestId: 'request.contract',
  learnerId: 'learner.local.default',
  now: '2026-10-29T09:00:00Z',
};

const session: Session = {
  schemaVersion: 1,
  id: 'session.contract',
  learnerId: 'learner.local.default',
  courseEditionId: 'course.biology-7a',
  packVersion: '1.0.0',
  trustMode: 'published',
  conceptId: 'concept.cell',
  mode: 'learn',
  status: 'active',
  startedAt: '2026-10-29T08:00:00Z',
  endedAt: null,
  resumeCursor: { activityId: null, cursor: null },
  dshSessionId: null,
};

describe('tutor gateway contract', () => {
  it('mock gateway resolves every method to the service envelope', async () => {
    const gateway = createMockTutorGateway();
    const capabilities = await gateway.capabilities(ctx);
    expect(capabilities).toHaveProperty('ok');
    expect(capabilities.ok).toBe(true);
    if (capabilities.ok) expect(capabilities.data.model).toEqual(MOCK_MODEL);

    const started = await gateway.startSession(ctx, { session });
    expect(started.ok).toBe(true);
    if (started.ok) expect(started.data.model.isMock).toBe(true);

    const resumed = await gateway.resumeSession(ctx, { sessionId: session.id, revision: 0 });
    expect(resumed.ok).toBe(true);

    const turn = await gateway.sendTurn(ctx, {
      sessionId: session.id,
      revision: 0,
      message: 'fixture',
      activityId: null,
      stream: false,
    });
    expect(turn.ok).toBe(true);
    if (turn.ok) expect(turn.data.revision).toBe(1);

    const ended = await gateway.endSession(ctx, { sessionId: session.id, reason: 'completed' });
    expect(ended.ok).toBe(true);
    if (ended.ok) expect(ended.data.endedAt).toBe(ctx.now);
  });

  it('not-bound gateway never resolves a turn and names the blocked gate', async () => {
    const gateway = createNotBoundTutorGateway();
    for (const result of [
      await gateway.startSession(ctx, { session }),
      await gateway.resumeSession(ctx, { sessionId: session.id, revision: 1 }),
      await gateway.sendTurn(ctx, {
        sessionId: session.id,
        revision: 1,
        message: null,
        activityId: null,
        stream: false,
      }),
      await gateway.endSession(ctx, { sessionId: session.id, reason: 'abandoned' }),
    ]) {
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('NOT_IMPLEMENTED');
        expect(result.error.message).toBe(DSH_NOT_BOUND_MESSAGE);
        expect(result.error.retryable).toBe(false);
      }
    }
  });
});
