import { describe, expect, it } from 'vitest';
import {
  CONCEPT_CELL,
  COURSE_EDITION_ID,
  LEARNER_ID,
  LearnerHarness,
  PACK_VERSION,
  expectError,
  expectOk,
  makeAttempt,
  makeEvidence,
  makeSession,
  requestContext,
} from './helpers.js';

let flow = 0;
const next = (prefix: string): string => {
  flow += 1;
  return `${prefix}-${flow}`;
};

async function startReview(harness: LearnerHarness, requestId: string) {
  const session = makeSession({
    mode: 'review',
    trustMode: 'candidate',
    startedAt: harness.clock.now(),
  });
  expectOk(await harness.learner.startSession(requestContext(harness, requestId), session));
  return session;
}

async function recordSessionEvidence(
  harness: LearnerHarness,
  sessionId: string,
  result: 'met' | 'not_met',
): Promise<void> {
  const attempt = makeAttempt({
    sessionId,
    conceptIds: [CONCEPT_CELL],
    submittedAt: harness.clock.now(),
  });
  expectOk(await harness.learner.submitAttempt(requestContext(harness, next('f4-attempt')), attempt));
  const evidence = makeEvidence({
    attemptId: attempt.id,
    conceptId: CONCEPT_CELL,
    kind: 'recall',
    criterionResults: [{ criterionId: 'criterion-f4', result, note: null }],
    createdAt: harness.clock.now(),
  });
  expectOk(
    await harness.learner.recordGradedAttempt(requestContext(harness, next('f4-grade')), {
      attemptId: attempt.id,
      evidence: [evidence],
      rubricVersion: 'rubric-bio-7a-v1',
      evaluatorVersion: 'rule-v1',
    }),
  );
}

function key() {
  return {
    learnerId: LEARNER_ID,
    courseEditionId: COURSE_EDITION_ID,
    packVersion: PACK_VERSION,
    conceptId: CONCEPT_CELL,
  };
}

describe('review completion without an assessment (F4)', () => {
  it('completes a candidate-pack review as needs_support while understanding stays unassessed', async () => {
    const harness = await LearnerHarness.create({ start: '2026-10-29T09:00:00Z' });
    try {
      const review = await startReview(harness, 'f4-review-start');
      const completed = expectOk(
        await harness.learner.completeReview(requestContext(harness, 'f4-review-complete'), {
          sessionId: review.id,
          conceptId: CONCEPT_CELL,
          completedAt: '2026-10-29T09:10:00Z',
        }),
      );
      expect(completed.outcome).toBe('needs_support');
      expect(completed.progress.review.lastCompletedAt).toBe('2026-10-29T09:10:00Z');
      expect(completed.progress.review.latestOutcome).toBe('needs_support');
      // Candidate content must never be upgraded to a formal understanding.
      expect(completed.progress.understanding.state).toBe('unassessed');
      expect(completed.progress.learning.state).toBe('not_started');
    } finally {
      harness.cleanup();
    }
  });

  it('allows developing only when this session has current evidence; supported is refused', async () => {
    const harness = await LearnerHarness.create({ start: '2026-10-29T09:00:00Z' });
    try {
      const review = await startReview(harness, 'f4-evidence-review');
      const unevidenced = expectError(
        await harness.learner.completeReview(requestContext(harness, 'f4-unevidenced'), {
          sessionId: review.id,
          conceptId: CONCEPT_CELL,
          completedAt: '2026-10-29T09:05:00Z',
          outcome: 'developing',
        }),
      );
      expect(unevidenced.message).toContain('REVIEW_OUTCOME_UNEVIDENCED');

      await recordSessionEvidence(harness, review.id, 'met');
      const evidenced = expectOk(
        await harness.learner.completeReview(requestContext(harness, 'f4-evidenced'), {
          sessionId: review.id,
          conceptId: CONCEPT_CELL,
          completedAt: '2026-10-29T09:10:00Z',
          outcome: 'developing',
        }),
      );
      expect(evidenced.outcome).toBe('developing');
      expect(evidenced.progress.review.latestOutcome).toBe('developing');
      expect(evidenced.progress.understanding.state).toBe('unassessed');

      const second = await startReview(harness, 'f4-supported-review');
      const supported = expectError(
        await harness.learner.completeReview(requestContext(harness, 'f4-supported'), {
          sessionId: second.id,
          conceptId: CONCEPT_CELL,
          completedAt: '2026-10-29T09:20:00Z',
          outcome: 'supported',
        }),
      );
      expect(supported.message).toContain('REVIEW_OUTCOME_MISMATCH');
    } finally {
      harness.cleanup();
    }
  });

  it('rejects completion after revocation (session abandoned) and keeps no review result', async () => {
    const harness = await LearnerHarness.create({ start: '2026-10-29T09:00:00Z' });
    try {
      const review = await startReview(harness, 'f4-revoked-review');
      expectOk(
        await harness.learner.endSession(requestContext(harness, 'f4-revoke'), {
          sessionId: review.id,
          status: 'abandoned',
          endedAt: '2026-10-29T09:06:00Z',
        }),
      );
      const rejected = expectError(
        await harness.learner.completeReview(requestContext(harness, 'f4-revoked-complete'), {
          sessionId: review.id,
          conceptId: CONCEPT_CELL,
          completedAt: '2026-10-29T09:10:00Z',
        }),
      );
      expect(rejected.message).toContain('REVIEW_SESSION_NOT_ACTIVE');
      const progress = expectOk(await harness.learner.get(requestContext(harness, 'f4-revoked-get'), key()));
      expect(progress.review.lastCompletedAt).toBeNull();
      expect(progress.review.latestOutcome).toBeNull();
    } finally {
      harness.cleanup();
    }
  });

  it('is idempotent for the same request id (duplicate completion returns the first result)', async () => {
    const harness = await LearnerHarness.create({ start: '2026-10-29T09:00:00Z' });
    try {
      const review = await startReview(harness, 'f4-idem-review');
      const ctx = requestContext(harness, 'f4-idem-complete');
      const first = expectOk(
        await harness.learner.completeReview(ctx, {
          sessionId: review.id,
          conceptId: CONCEPT_CELL,
          completedAt: '2026-10-29T09:10:00Z',
        }),
      );
      const replay = expectOk(
        await harness.learner.completeReview(ctx, {
          sessionId: review.id,
          conceptId: CONCEPT_CELL,
          completedAt: '2026-10-29T09:10:00Z',
        }),
      );
      expect(first.duplicate).toBe(false);
      expect(replay.duplicate).toBe(true);
      expect(replay.progress.review.lastCompletedAt).toBe('2026-10-29T09:10:00Z');
    } finally {
      harness.cleanup();
    }
  });
});
