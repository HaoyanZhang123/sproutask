/**
 * T14/S5 regression on the HTTP-facing G1 facade: a structured partial-turn
 * failure must reach the caller (retryable, with its kept source refs) instead
 * of being replaced by the local rule grader.
 *
 * The pre-fix behaviour mapped every `UNAVAILABLE`/`NETWORK` turn failure to
 * `localRuleTurn`, which reported `action: 'local_fallback'` and 0 anchors —
 * hiding a turn that had actually resolved 9 source refs over 14 tool calls.
 */

import { describe, expect, it } from 'vitest';
import { errResult, okResult } from '@edu/domain';
import { G1Service } from '../src/g1-service.js';
import { TURN_BUDGET_EXCEEDED, TURN_NO_TEXT } from '../src/adapters/dsh-tutor.js';
import type { EducationRuntimeComposition } from '../src/runtime-composition.js';

const PACK = {
  data: {
    courseEditionId: 'course.bio7a',
    version: '2.0.0',
    activities: [],
    rubrics: [],
  },
};

function serviceWith(
  submitTurn: () => Promise<ReturnType<typeof errResult> | ReturnType<typeof okResult>>,
  audited: unknown[] = [],
): G1Service {
  const composition = {
    clock: { now: () => '2026-10-31T00:00:00Z' },
    audit: (event: unknown) => audited.push(event),
    tutor: { submitTurn },
    knowledge: { getPack: async () => okResult(PACK, 0) },
    storage: { append: async () => okResult({ revision: 1 }, 1) },
    grade: { grade: async () => errResult('UNSUPPORTED', 'no grader in this fake', false) },
  } as unknown as EducationRuntimeComposition;
  return new G1Service(composition, 'E:/fake/workspace');
}

const turnInput = {
  sessionId: 'session.f7s1s5.s5',
  revision: 0,
  message: '细菌和真菌在结构上最主要的区别是什么？',
  activityId: null,
  stream: false,
};

describe('G1 tutor turn: structured partial turns are not silently downgraded', () => {
  it('returns the TURN_NO_TEXT error (with kept refs) instead of the local rule fallback', async () => {
    const audited: unknown[] = [];
    const service = serviceWith(
      async () =>
        errResult(
          'UNAVAILABLE',
          `${TURN_NO_TEXT}: the DSH turn ended without assistant text after 14 tool call(s); kept sources: source.bio7a.sec.u2ch3s2.heading, source.bio7a.sec.u2ch3s3.obj1 (+7) pdf pages: 112/113/118/120`,
          true,
          'dsh.turn.partial:session.f7s1s5.s5:65',
        ),
      audited,
    );

    const result = await service.tutorTurn('g1.tutor.turn.1', turnInput);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.message).toContain(TURN_NO_TEXT);
    expect(result.error.message).toContain('source.bio7a.sec.u2ch3s2.heading');
    expect(result.error.retryable).toBe(true);
    expect(result.error.detailsRef).toBe('dsh.turn.partial:session.f7s1s5.s5:65');
    // The decision that produced this answer is recorded, not the local grader.
    expect(audited).toHaveLength(1);
    expect((audited[0] as { kind: string }).kind).toBe('tutor.turn.unavailable');
  });

  it('keeps a timeout out of the local fallback as well', async () => {
    const service = serviceWith(async () =>
      errResult(
        'TIMEOUT',
        `${TURN_BUDGET_EXCEEDED}: the DSH turn exceeded 45000 ms after 3 tool call(s); kept sources: source.bio7a.sec.u2ch3s2.heading`,
        true,
      ),
    );
    const result = await service.tutorTurn('g1.tutor.turn.2', turnInput);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.message).toContain(TURN_BUDGET_EXCEEDED);
  });

  it('still falls back for a plain transport failure (unchanged product behaviour)', async () => {
    // The tutor service maps a NETWORK transport failure onto UNAVAILABLE before
    // the G1 facade sees it; only the partial-turn markers opt out of the fallback.
    const service = serviceWith(async () =>
      errResult('UNAVAILABLE', 'the model route is unreachable; retry or continue offline', true),
    );
    const result = await service.tutorTurn('g1.tutor.turn.3', turnInput);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const data = result.data as { decision: { action: string }; gateway: string };
    expect(data.decision.action).toBe('local_fallback');
    expect(data.gateway).toBe('local');
  });
});
