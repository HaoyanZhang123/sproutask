import { describe, expect, it } from 'vitest';
import { createReviewPolicy } from '../src/policy.js';
import {
  CONCEPT_CELL,
  CONCEPT_ORGAN,
  COURSE_EDITION_ID,
  LEARNER_ID,
  LearnerHarness,
  PACK_VERSION,
  expectError,
  expectOk,
  makeAttempt,
  makeEvidence,
  makeSelfReport,
  makeSession,
  requestContext,
} from './helpers.js';

let evidenceFlow = 0;

function nextEvidenceRequest(prefix: string): string {
  evidenceFlow += 1;
  return `${prefix}-${evidenceFlow}`;
}

async function recordEvidence(
  harness: LearnerHarness,
  sessionId: string,
  conceptId: string,
  options: {
    readonly kind?: 'explain' | 'transfer';
    readonly result?: 'met' | 'not_met';
  } = {},
): Promise<void> {
  const attempt = makeAttempt({
    sessionId,
    conceptIds: [conceptId],
    submittedAt: harness.clock.now(),
  });
  expectOk(
    await harness.learner.submitAttempt(
      requestContext(harness, nextEvidenceRequest('three-axis-attempt')),
      attempt,
    ),
  );
  const evidence = makeEvidence({
    attemptId: attempt.id,
    conceptId,
    kind: options.kind ?? 'explain',
    criterionResults: [
      {
        criterionId: 'criterion-three-axis',
        result: options.result ?? 'met',
        note: null,
      },
    ],
    createdAt: harness.clock.now(),
  });
  expectOk(
    await harness.learner.recordGradedAttempt(
      requestContext(harness, nextEvidenceRequest('three-axis-grade')),
      {
        attemptId: attempt.id,
        evidence: [evidence],
        rubricVersion: 'rubric-bio-7a-v1',
        evaluatorVersion: 'grader-rule-v1',
      },
    ),
  );
}

function key(conceptId = CONCEPT_CELL) {
  return {
    learnerId: LEARNER_ID,
    courseEditionId: COURSE_EDITION_ID,
    packVersion: PACK_VERSION,
    conceptId,
  };
}

async function learnSession(
  harness: LearnerHarness,
  options: {
    readonly conceptId?: string;
    readonly requestId: string;
    readonly startedAt?: string;
    readonly mode?: 'learn' | 'review' | 'diagnostic';
  },
) {
  const ctx = requestContext(harness, options.requestId);
  const session = makeSession({
    conceptId: options.conceptId ?? CONCEPT_CELL,
    mode: options.mode ?? 'learn',
    startedAt: options.startedAt ?? harness.clock.now(),
  });
  expectOk(await harness.learner.startSession(ctx, session));
  return session;
}

describe('three-axis projection on a real journal', () => {
  it('keeps learning, understanding and review independent; self report never writes them', async () => {
    const harness = await LearnerHarness.create({ start: '2026-10-29T01:00:00Z' });
    try {
      const initial = expectOk(
        await harness.learner.get(requestContext(harness, 'get-initial'), key()),
      );
      expect(initial.learning).toEqual({ state: 'not_started', startedAt: null, lastCompletedAt: null });
      expect(initial.understanding.state).toBe('unassessed');
      expect(initial.review).toMatchObject({
        lastCompletedAt: null,
        dueAt: null,
        activeSessionId: null,
        latestOutcome: null,
        policyVersion: 'review-policy-v1',
      });

      const session = await learnSession(harness, {
        requestId: 'start-1',
        startedAt: '2026-10-29T01:00:00Z',
      });
      const started = expectOk(await harness.learner.get(requestContext(harness, 'get-started'), key()));
      expect(started.learning.state).toBe('in_progress');
      expect(started.learning.startedAt).toBe('2026-10-29T01:00:00Z');
      expect(started.understanding.state).toBe('unassessed');
      expect(started.review.dueAt).toBeNull();

      // Leaving early neither completes nor judges.
      harness.clock.set('2026-10-29T01:20:00Z');
      expectOk(
        await harness.learner.endSession(requestContext(harness, 'end-abandoned'), {
          sessionId: session.id,
          status: 'abandoned',
          endedAt: '2026-10-29T01:20:00Z',
        }),
      );
      const abandoned = expectOk(
        await harness.learner.get(requestContext(harness, 'get-abandoned'), key()),
      );
      expect(abandoned.learning.state).toBe('in_progress');
      expect(abandoned.learning.lastCompletedAt).toBeNull();
      expect(abandoned.understanding.state).toBe('unassessed');

      // A separate completed learning activity sets learning + next review only.
      harness.clock.set('2026-10-29T02:00:00Z');
      const second = await learnSession(harness, {
        requestId: 'start-2',
        startedAt: '2026-10-29T02:00:00Z',
      });
      harness.clock.set('2026-10-29T02:30:00Z');
      const completion = expectOk(
        await harness.learner.completeLearning(requestContext(harness, 'complete-learning'), {
          sessionId: second.id,
          conceptId: CONCEPT_CELL,
          completedAt: '2026-10-29T02:30:00Z',
        }),
      );
      expect(completion.dueAt).toBe('2026-10-30T01:00:00Z');
      const completed = expectOk(
        await harness.learner.get(requestContext(harness, 'get-completed'), key()),
      );
      expect(completed.learning.state).toBe('completed');
      expect(completed.learning.lastCompletedAt).toBe('2026-10-29T02:30:00Z');
      expect(completed.understanding.state).toBe('unassessed');
      expect(completed.review.dueAt).toBe('2026-10-30T01:00:00Z');
      expect(completed.review.lastCompletedAt).toBeNull();

      // Self report is stored separately and must not touch any axis.
      const beforeReport = JSON.stringify(completed);
      const selfReport = makeSelfReport({ conceptId: CONCEPT_CELL, claimedState: 'can_explain' });
      const reportResult = expectOk(
        await harness.learner.recordSelfReport(
          requestContext(harness, 'self-report'),
          selfReport,
        ),
      );
      expect(reportResult.storedSeparately).toBe(true);
      expect(reportResult.selfReportCount).toBe(1);
      const afterReport = expectOk(
        await harness.learner.get(requestContext(harness, 'get-after-report'), key()),
      );
      expect(JSON.stringify(afterReport)).toBe(beforeReport);
      expect(afterReport.understanding.state).toBe('unassessed');
      const reports = expectOk(
        await harness.learner.listSelfReports(requestContext(harness, 'list-reports')),
      );
      expect(reports.map((report) => report.id)).toEqual([selfReport.id]);
    } finally {
      harness.cleanup();
    }
  });

  it('completing a review records the outcome without promoting understanding; reviewed and due coexist', async () => {
    const harness = await LearnerHarness.create({ start: '2026-10-29T01:00:00Z' });
    try {
      const session = await learnSession(harness, {
        requestId: 'start-learn',
        startedAt: '2026-10-29T01:00:00Z',
      });
      expectOk(
        await harness.learner.completeLearning(requestContext(harness, 'complete-learning'), {
          sessionId: session.id,
          conceptId: CONCEPT_CELL,
          completedAt: '2026-10-29T01:30:00Z',
        }),
      );
      // A review outcome is now derived from the latest evidenced assessment.
      await recordEvidence(harness, session.id, CONCEPT_CELL, { result: 'not_met' });

      // Review after the due instant, with a weaker evidenced outcome.
      harness.clock.set('2026-10-30T02:00:00Z');
      const reviewSession = await learnSession(harness, {
        requestId: 'start-review',
        mode: 'review',
        startedAt: '2026-10-30T02:00:00Z',
      });
      harness.clock.set('2026-10-30T02:10:00Z');
      const reviewed = expectOk(
        await harness.learner.completeReview(requestContext(harness, 'complete-review'), {
          sessionId: reviewSession.id,
          conceptId: CONCEPT_CELL,
          completedAt: '2026-10-30T02:10:00Z',
        }),
      );
      expect(reviewed.outcome).toBe('needs_support');
      expect(reviewed.early).toBe(false);
      expect(reviewed.progress.review.lastCompletedAt).toBe('2026-10-30T02:10:00Z');
      expect(reviewed.progress.review.latestOutcome).toBe('needs_support');
      expect(reviewed.progress.review.dueAt).toBe('2026-10-31T01:00:00Z');
      // Review completion mirrors the assessed state; it does not fabricate a
      // stronger or weaker understanding judgement.
      expect(reviewed.progress.understanding.state).toBe('needs_support');

      harness.clock.set('2026-10-31T02:00:00Z');
      const explanation = expectOk(
        await harness.learner.explain(requestContext(harness, 'explain-reviewed'), {
          conceptId: CONCEPT_CELL,
        }),
      );
      expect(explanation.review.everReviewed).toBe(true);
      expect(explanation.review.isDue).toBe(true);
      expect(explanation.progress.review.latestOutcome).toBe('needs_support');
    } finally {
      harness.cleanup();
    }
  });

  it('rejects a review outcome that disagrees with the latest assessment or has no assessment', async () => {
    const harness = await LearnerHarness.create({ start: '2026-10-29T01:00:00Z' });
    try {
      const learn = await learnSession(harness, {
        requestId: 'outcome-learn',
        startedAt: '2026-10-29T01:00:00Z',
      });
      await recordEvidence(harness, learn.id, CONCEPT_CELL, { result: 'met' });
      expectOk(
        await harness.learner.completeLearning(requestContext(harness, 'outcome-complete'), {
          sessionId: learn.id,
          conceptId: CONCEPT_CELL,
          completedAt: '2026-10-29T01:30:00Z',
        }),
      );
      harness.clock.set('2026-10-30T02:00:00Z');
      const review = await learnSession(harness, {
        requestId: 'outcome-review',
        mode: 'review',
        startedAt: '2026-10-30T02:00:00Z',
      });
      const mismatch = expectError(
        await harness.learner.completeReview(requestContext(harness, 'outcome-mismatch'), {
          sessionId: review.id,
          conceptId: CONCEPT_CELL,
          completedAt: '2026-10-30T02:10:00Z',
          outcome: 'supported',
        }),
      );
      expect(mismatch.message).toContain('REVIEW_OUTCOME_MISMATCH');
      const beforeReview = expectOk(
        await harness.learner.get(requestContext(harness, 'outcome-before-review'), key()),
      );
      expect(beforeReview.review.lastCompletedAt).toBeNull();
      expect(beforeReview.review.latestOutcome).toBeNull();

      const matched = expectOk(
        await harness.learner.completeReview(requestContext(harness, 'outcome-matched'), {
          sessionId: review.id,
          conceptId: CONCEPT_CELL,
          completedAt: '2026-10-30T02:10:00Z',
        }),
      );
      expect(matched.outcome).toBe('developing');
      expect(matched.progress.review.latestOutcome).toBe('developing');
      expect(matched.progress.understanding.state).toBe('developing');

      // No assessment at all: review completion must not create a
      // supported review outcome while understanding stays unassessed.
      const organReview = await learnSession(harness, {
        requestId: 'no-assessment-review',
        conceptId: CONCEPT_ORGAN,
        mode: 'review',
        startedAt: '2026-10-30T03:00:00Z',
      });
      const noAssessment = expectError(
        await harness.learner.completeReview(requestContext(harness, 'no-assessment-complete'), {
          sessionId: organReview.id,
          conceptId: CONCEPT_ORGAN,
          completedAt: '2026-10-30T03:10:00Z',
          outcome: 'supported',
        }),
      );
      expect(noAssessment.message).toContain('REVIEW_OUTCOME_MISMATCH');
      const organ = expectOk(
        await harness.learner.get(requestContext(harness, 'no-assessment-progress'), key(CONCEPT_ORGAN)),
      );
      expect(organ.understanding.state).toBe('unassessed');
      expect(organ.review.lastCompletedAt).toBeNull();
      expect(organ.review.latestOutcome).toBeNull();
    } finally {
      harness.cleanup();
    }
  });

  it('records an early review and a single deferral as events without rewriting history', async () => {
    const harness = await LearnerHarness.create({ start: '2026-10-29T01:00:00Z' });
    try {
      const session = await learnSession(harness, {
        requestId: 'learn-early',
        startedAt: '2026-10-29T01:00:00Z',
      });
      expectOk(
        await harness.learner.completeLearning(requestContext(harness, 'complete-early'), {
          sessionId: session.id,
          conceptId: CONCEPT_CELL,
          completedAt: '2026-10-29T01:30:00Z',
        }),
      );
      await recordEvidence(harness, session.id, CONCEPT_CELL, { result: 'met' });

      // Defer once: due moves one local day, history keeps the old due instant.
      const deferred = expectOk(
        await harness.learner.deferReview(requestContext(harness, 'defer-once'), {
          conceptId: CONCEPT_CELL,
          reason: 'student_deferred_once',
        }),
      );
      expect(deferred.previousDueAt).toBe('2026-10-30T01:00:00Z');
      expect(deferred.newDueAt).toBe('2026-10-31T01:00:00Z');
      expect(deferred.progress.review.lastCompletedAt).toBeNull();
      expect(deferred.progress.review.latestOutcome).toBeNull();
      const secondDefer = expectError(
        await harness.learner.deferReview(requestContext(harness, 'defer-twice'), {
          conceptId: CONCEPT_CELL,
        }),
      );
      expect(secondDefer.code).toBe('CONFLICT');
      expect(secondDefer.message).toContain('only once');

      // Early review before the (deferred) due instant.
      harness.clock.set('2026-10-31T00:30:00Z');
      const reviewSession = await learnSession(harness, {
        requestId: 'start-early-review',
        mode: 'review',
        startedAt: '2026-10-31T00:30:00Z',
      });
      harness.clock.set('2026-10-31T00:45:00Z');
      const early = expectOk(
        await harness.learner.completeReview(requestContext(harness, 'early-review'), {
          sessionId: reviewSession.id,
          conceptId: CONCEPT_CELL,
          completedAt: '2026-10-31T00:45:00Z',
          outcome: 'developing',
        }),
      );
      expect(early.early).toBe(true);
      expect(early.previousDueAt).toBe('2026-10-31T01:00:00Z');
      expect(early.dueAt).toBe('2026-11-03T01:00:00Z');

      const earlyCommand = [...harness.journalCommands()]
        .reverse()
        .find((command) => command['type'] === 'review.completed');
      expect(earlyCommand?.['payload']).toMatchObject({
        early: true,
        previousDueAt: '2026-10-31T01:00:00Z',
        dueAt: '2026-11-03T01:00:00Z',
      });

      const entry = harness.learner.projectionEntries.find(
        (item) => item.progress.conceptId === CONCEPT_CELL,
      );
      expect(entry?.reviewHistory.map((item) => item.kind)).toEqual(['deferred', 'completed']);
      expect(entry?.reviewHistory[0]?.previousDueAt).toBe('2026-10-30T01:00:00Z');
    } finally {
      harness.cleanup();
    }
  });

  it('does not put a not-started or diagnostic-only concept into the review queue', async () => {
    const harness = await LearnerHarness.create({ start: '2026-10-29T01:00:00Z' });
    try {
      const queue = expectOk(
        await harness.learner.reviewQueue(requestContext(harness, 'queue-empty'), {
          now: '2026-12-01T00:00:00Z',
        }),
      );
      expect(queue).toEqual([]);

      const diagnostic = await learnSession(harness, {
        requestId: 'start-diagnostic',
        conceptId: CONCEPT_ORGAN,
        mode: 'diagnostic',
        startedAt: '2026-10-29T01:00:00Z',
      });
      expectOk(
        await harness.learner.completeDiagnostic(requestContext(harness, 'complete-diagnostic'), {
          sessionId: diagnostic.id,
          testedConceptIds: [CONCEPT_ORGAN],
          skipped: false,
          completedAt: '2026-10-29T01:05:00Z',
        }),
      );
      const list = expectOk(
        await harness.learner.list(requestContext(harness, 'list-after-diagnostic'), {
          learnerId: LEARNER_ID,
          courseEditionId: COURSE_EDITION_ID,
          packVersion: PACK_VERSION,
        }),
      );
      expect(list).toEqual([]);
      const organ = expectOk(
        await harness.learner.get(requestContext(harness, 'get-diagnostic-concept'), key(CONCEPT_ORGAN)),
      );
      expect(organ.learning.state).toBe('not_started');
      expect(organ.understanding.state).toBe('unassessed');
      expect(organ.review.dueAt).toBeNull();

      // Opening a learning session is underway, never "learned".
      const learn = await learnSession(harness, {
        requestId: 'start-cell',
        startedAt: '2026-10-29T02:00:00Z',
      });
      const inProgress = expectOk(
        await harness.learner.get(requestContext(harness, 'get-in-progress'), key()),
      );
      expect(inProgress.learning.state).toBe('in_progress');
      expect(inProgress.learning.state).not.toBe('completed');
      void learn;
    } finally {
      harness.cleanup();
    }
  });

  it('builds a deduplicated review queue sorted by dueAt', async () => {
    const harness = await LearnerHarness.create({ start: '2026-10-29T01:00:00Z' });
    try {
      const cellSession = await learnSession(harness, {
        requestId: 'queue-cell-session',
        startedAt: '2026-10-29T01:00:00Z',
      });
      expectOk(
        await harness.learner.completeLearning(requestContext(harness, 'queue-cell-complete'), {
          sessionId: cellSession.id,
          conceptId: CONCEPT_CELL,
          completedAt: '2026-10-29T01:30:00Z',
        }),
      );
      harness.clock.set('2026-10-30T02:00:00Z');
      const organSession = await learnSession(harness, {
        conceptId: CONCEPT_ORGAN,
        requestId: 'queue-organ-session',
        startedAt: '2026-10-30T02:00:00Z',
      });
      expectOk(
        await harness.learner.completeLearning(requestContext(harness, 'queue-organ-complete'), {
          sessionId: organSession.id,
          conceptId: CONCEPT_ORGAN,
          completedAt: '2026-10-30T02:30:00Z',
        }),
      );
      const queue = expectOk(
        await harness.learner.reviewQueue(requestContext(harness, 'queue-due'), {
          now: '2026-11-05T00:00:00Z',
          limit: 10,
        }),
      );
      expect(queue.map((item) => item.conceptId)).toEqual([CONCEPT_CELL, CONCEPT_ORGAN]);
      expect(queue[0]?.dueAt).toBe('2026-10-30T01:00:00Z');
      expect(queue[1]?.dueAt).toBe('2026-10-31T01:00:00Z');
      expect(queue.every((item) => item.overdue)).toBe(true);
      expect(queue[0]?.everReviewed).toBe(false);
    } finally {
      harness.cleanup();
    }
  });

  it('schedules a DST-gap review from the injected clock on a real journal', async () => {
    const policy = createReviewPolicy({
      timeZone: 'America/New_York',
      reviewLocalTime: { hour: 2, minute: 30 },
    });
    const harness = await LearnerHarness.create({
      policy,
      start: '2026-03-07T10:00:00Z',
    });
    try {
      const session = await learnSession(harness, {
        requestId: 'dst-session',
        startedAt: '2026-03-07T10:00:00Z',
      });
      const completion = expectOk(
        await harness.learner.completeLearning(requestContext(harness, 'dst-complete'), {
          sessionId: session.id,
          conceptId: CONCEPT_CELL,
          completedAt: '2026-03-07T10:05:00Z',
        }),
      );
      // 02:30 local does not exist on 2026-03-08; it resolves forward to 03:30 EDT.
      expect(completion.dueAt).toBe('2026-03-08T07:30:00Z');
      const progress = expectOk(
        await harness.learner.get(requestContext(harness, 'dst-progress'), key()),
      );
      expect(progress.review.dueAt).toBe('2026-03-08T07:30:00Z');
    } finally {
      harness.cleanup();
    }
  });
});
