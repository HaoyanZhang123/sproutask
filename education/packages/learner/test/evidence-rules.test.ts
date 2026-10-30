import { describe, expect, it } from 'vitest';
import type { ActivityAttempt, Evidence, HelpUsage } from '@edu/domain';
import { createReviewPolicy } from '../src/policy.js';
import {
  CONCEPT_CELL,
  CONCEPT_ENERGY,
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

function nextRequest(prefix: string): string {
  flow += 1;
  return `${prefix}-${flow}`;
}

function key(conceptId = CONCEPT_CELL) {
  return {
    learnerId: LEARNER_ID,
    courseEditionId: COURSE_EDITION_ID,
    packVersion: PACK_VERSION,
    conceptId,
  };
}

async function startLearn(
  harness: LearnerHarness,
  conceptId = CONCEPT_CELL,
  startedAt = '2026-10-29T01:00:00Z',
) {
  const ctx = requestContext(harness, nextRequest('session'), startedAt);
  const session = makeSession({ conceptId, startedAt });
  expectOk(await harness.learner.startSession(ctx, session));
  return session;
}

async function submitAttempt(
  harness: LearnerHarness,
  sessionId: string,
  conceptId = CONCEPT_CELL,
  helpUsed: readonly HelpUsage[] = [],
): Promise<ActivityAttempt> {
  const attempt = makeAttempt({
    sessionId,
    conceptIds: [conceptId],
    helpUsed,
    submittedAt: harness.clock.now(),
  });
  expectOk(
    await harness.learner.submitAttempt(requestContext(harness, nextRequest('attempt')), attempt),
  );
  return attempt;
}

async function grade(
  harness: LearnerHarness,
  attemptId: string,
  evidence: readonly Evidence[],
  options: {
    readonly coreMisconceptionEvidenceIds?: readonly string[];
    readonly evaluatorVersion?: string;
    readonly rubricVersion?: string;
  } = {},
) {
  return harness.learner.recordGradedAttempt(requestContext(harness, nextRequest('grade')), {
    attemptId,
    evidence,
    rubricVersion: options.rubricVersion ?? 'rubric-bio-7a-v1',
    evaluatorVersion: options.evaluatorVersion ?? 'grader-rule-v1',
    coreMisconceptionEvidenceIds: options.coreMisconceptionEvidenceIds,
  });
}

async function supportedConcept(harness: LearnerHarness, conceptId = CONCEPT_CELL) {
  const session = await startLearn(harness, conceptId);
  const attempt1 = await submitAttempt(harness, session.id, conceptId);
  const first = expectOk(
    await grade(harness, attempt1.id, [
      makeEvidence({
        attemptId: attempt1.id,
        conceptId,
        kind: 'explain',
        createdAt: harness.clock.now(),
      }),
    ]),
  );
  expect(first[0]?.derivedState).toBe('developing');
  const attempt2 = await submitAttempt(harness, session.id, conceptId);
  const second = expectOk(
    await grade(harness, attempt2.id, [
      makeEvidence({
        attemptId: attempt2.id,
        conceptId,
        kind: 'transfer',
        createdAt: harness.clock.now(),
      }),
    ]),
  );
  expect(second[0]?.derivedState).toBe('supported');
  return { session, second };
}

describe('evidence rules (assisted, low confidence, counter evidence, reverse fallback)', () => {
  it('records an answer helped by a worked solution as assisted and cannot judge understanding', async () => {
    const harness = await LearnerHarness.create();
    try {
      const session = await startLearn(harness);
      const attempt = await submitAttempt(harness, session.id, CONCEPT_CELL, [
        { kind: 'worked_solution', usedAt: harness.clock.now() },
      ]);
      const evidence = makeEvidence({
        attemptId: attempt.id,
        assistance: 'assisted',
        createdAt: harness.clock.now(),
      });
      const outcomes = expectOk(await grade(harness, attempt.id, [evidence]));
      expect(outcomes).toHaveLength(1);
      expect(outcomes[0]?.kind).toBe('evidence_only');
      expect(outcomes[0]?.derivedState).toBe('unassessed');
      expect(outcomes[0]?.assessment).toBeNull();
      expect(outcomes[0]?.rationale.join(' ')).toContain('no valid independent evidence');

      const progress = expectOk(
        await harness.learner.get(requestContext(harness, 'assisted-progress'), key()),
      );
      expect(progress.understanding.state).toBe('unassessed');
      expect(progress.understanding.assessmentId).toBeNull();

      const explanation = expectOk(
        await harness.learner.explain(requestContext(harness, 'assisted-explain'), {
          conceptId: CONCEPT_CELL,
        }),
      );
      expect(explanation.evidence).toHaveLength(1);
      expect(explanation.evidence[0]?.assistance).toBe('assisted');
      expect(explanation.history).toEqual([]);
    } finally {
      harness.cleanup();
    }
  });

  it('treats an answer after a shown explanation as non-independent for this round', async () => {
    const harness = await LearnerHarness.create();
    try {
      const session = await startLearn(harness);
      const attempt = await submitAttempt(harness, session.id, CONCEPT_CELL, [
        { kind: 'explanation', usedAt: harness.clock.now() },
      ]);
      const evidence = makeEvidence({
        attemptId: attempt.id,
        assistance: 'unassisted',
        createdAt: harness.clock.now(),
      });
      const outcomes = expectOk(await grade(harness, attempt.id, [evidence]));
      expect(outcomes[0]?.kind).toBe('evidence_only');
      expect(outcomes[0]?.derivedState).toBe('unassessed');
      const progress = expectOk(
        await harness.learner.get(requestContext(harness, 'explanation-progress'), key()),
      );
      expect(progress.understanding.state).toBe('unassessed');
    } finally {
      harness.cleanup();
    }
  });

  it('keeps low-confidence model evidence pending without changing the state', async () => {
    const harness = await LearnerHarness.create();
    try {
      const session = await startLearn(harness);
      const attempt = await submitAttempt(harness, session.id);
      const evidence = makeEvidence({
        attemptId: attempt.id,
        assessmentOrigin: 'model',
        modelRunId: 'model-run-low-confidence-1',
        uncertainty: 0.82,
        createdAt: harness.clock.now(),
      });
      const outcomes = expectOk(await grade(harness, attempt.id, [evidence]));
      expect(outcomes[0]?.kind).toBe('evidence_only');
      expect(outcomes[0]?.derivedState).toBe('unassessed');
      expect(outcomes[0]?.pendingEvidenceIds).toContain(evidence.id);

      const progress = expectOk(
        await harness.learner.get(requestContext(harness, 'low-confidence-progress'), key()),
      );
      expect(progress.understanding.state).toBe('unassessed');

      const explanation = expectOk(
        await harness.learner.explain(requestContext(harness, 'low-confidence-explain'), {
          conceptId: CONCEPT_CELL,
        }),
      );
      expect(explanation.pendingEvidenceIds).toContain(evidence.id);
      expect(explanation.evidence[0]?.validity).toBe('pending');
      expect(explanation.history).toEqual([]);
    } finally {
      harness.cleanup();
    }
  });

  it('derives supported only from explain + transfer evidence across two activities, with versions and rationale', async () => {
    const harness = await LearnerHarness.create();
    try {
      const { second } = await supportedConcept(harness);
      const outcome = second[0];
      expect(outcome?.kind).toBe('assessment');
      const assessment = outcome?.assessment;
      expect(assessment?.state).toBe('supported');
      expect(assessment?.validity).toBe('current');
      expect(assessment?.rationale.length).toBeGreaterThan(0);
      expect(assessment?.rubricVersion).toBe('rubric-bio-7a-v1');
      expect(assessment?.evaluatorVersion).toBe('grader-rule-v1');
      expect(assessment?.evidenceIds.length).toBe(2);
      expect(outcome?.committedEvidenceIds.length).toBe(2);

      const explanation = expectOk(
        await harness.learner.explain(requestContext(harness, 'supported-explain'), {
          conceptId: CONCEPT_CELL,
        }),
      );
      expect(explanation.state).toBe('supported');
      expect(explanation.history).toHaveLength(2);
      expect(explanation.history[0]?.state).toBe('developing');
      expect(explanation.history[1]?.state).toBe('supported');
      expect(explanation.history.every((item) => item.rubricVersion === 'rubric-bio-7a-v1')).toBe(true);
      expect(explanation.history.every((item) => item.rationale.length > 0)).toBe(true);
      expect(explanation.pendingEvidenceIds).toEqual([]);
      expect(explanation.counterEvidenceIds).toEqual([]);
    } finally {
      harness.cleanup();
    }
  });

  it('falls back to needs_support on a credible counter example and keeps the old judgement in history', async () => {
    const harness = await LearnerHarness.create();
    try {
      const { session } = await supportedConcept(harness);
      const attempt3 = await submitAttempt(harness, session.id);
      const counter = makeEvidence({
        attemptId: attempt3.id,
        kind: 'discriminate',
        criterionResults: [{ criterionId: 'criterion-discriminate', result: 'not_met', note: null }],
        createdAt: harness.clock.now(),
      });
      const outcomes = expectOk(await grade(harness, attempt3.id, [counter]));
      expect(outcomes[0]?.derivedState).toBe('needs_support');
      expect(outcomes[0]?.assessment?.state).toBe('needs_support');
      expect(outcomes[0]?.rationale.join(' ')).toContain('counter evidence');

      const explanation = expectOk(
        await harness.learner.explain(requestContext(harness, 'fallback-explain'), {
          conceptId: CONCEPT_CELL,
        }),
      );
      expect(explanation.state).toBe('needs_support');
      expect(explanation.counterEvidenceIds).toContain(counter.id);
      expect(explanation.history.map((item) => item.state)).toEqual([
        'developing',
        'supported',
        'needs_support',
      ]);
      expect(explanation.history[1]?.state).toBe('supported');
    } finally {
      harness.cleanup();
    }
  });

  it('flags a core misconception as counter evidence even when criteria were met', async () => {
    const harness = await LearnerHarness.create();
    try {
      const session = await startLearn(harness, CONCEPT_ENERGY);
      const attempt = await submitAttempt(harness, session.id, CONCEPT_ENERGY);
      const misconception = makeEvidence({
        attemptId: attempt.id,
        conceptId: CONCEPT_ENERGY,
        kind: 'explain',
        createdAt: harness.clock.now(),
      });
      const outcomes = expectOk(
        await grade(harness, attempt.id, [misconception], {
          coreMisconceptionEvidenceIds: [misconception.id],
        }),
      );
      expect(outcomes[0]?.derivedState).toBe('needs_support');
      expect(outcomes[0]?.rationale.join(' ')).toContain('core misconception');
      const explanation = expectOk(
        await harness.learner.explain(requestContext(harness, 'misconception-explain'), {
          conceptId: CONCEPT_ENERGY,
        }),
      );
      expect(explanation.state).toBe('needs_support');
      expect(explanation.evidence[0]?.coreMisconception).toBe(true);
    } finally {
      harness.cleanup();
    }
  });

  it('cancelled grading publishes no judgement, does not re-create the answer and leaves learning in progress', async () => {
    const harness = await LearnerHarness.create();
    try {
      const session = await startLearn(harness);
      const attempt = await submitAttempt(harness, session.id);
      expectOk(
        await harness.learner.cancelAttemptGrading(requestContext(harness, 'cancel-grading'), {
          attemptId: attempt.id,
          graderVersion: 'grader-rule-v1',
          revision: 0,
          reason: 'student_cancelled_feedback',
          cancelled: true,
        }),
      );
      const late = makeEvidence({ attemptId: attempt.id, createdAt: harness.clock.now() });
      const error = expectError(await grade(harness, attempt.id, [late]));
      expect(error.code).toBe('CONTRACT_REJECTED');
      expect(error.message).toContain('cancelled');

      const progress = expectOk(
        await harness.learner.get(requestContext(harness, 'cancelled-progress'), key()),
      );
      expect(progress.learning.state).toBe('in_progress');
      expect(progress.understanding.state).toBe('unassessed');
      const attempts = harness.journalCommands().filter((command) => command['type'] === 'attempt.submitted');
      expect(attempts).toHaveLength(1);
      const committed = harness.journalCommands().filter(
        (command) => command['type'] === 'assessment.committed',
      );
      expect(committed).toHaveLength(0);
    } finally {
      harness.cleanup();
    }
  });

  it('marks evidence stale after time and drops a strong state without asserting forgetting', async () => {
    const policy = createReviewPolicy({ timeZone: 'Asia/Shanghai', staleAfterDays: 7 });
    const harness = await LearnerHarness.create({ policy, start: '2026-10-29T01:00:00Z' });
    try {
      const { session } = await supportedConcept(harness);
      expectOk(
        await harness.learner.completeLearning(requestContext(harness, 'stale-learning-complete'), {
          sessionId: session.id,
          conceptId: CONCEPT_CELL,
          completedAt: '2026-10-29T02:00:00Z',
        }),
      );
      harness.clock.set('2026-11-06T02:00:00Z');
      const refreshed = expectOk(
        await harness.learner.refreshValidity(requestContext(harness, 'stale-refresh')),
      );
      expect(refreshed.staledConceptIds).toContain(CONCEPT_CELL);

      const progress = expectOk(
        await harness.learner.get(requestContext(harness, 'stale-progress'), key()),
      );
      expect(progress.understanding.validity).toBe('stale');
      // The frozen domain invariant forbids keeping supported with stale
      // evidence; developing + stale is the weakest claim consistent with
      // "time passed", never needs_support ("forgotten").
      expect(progress.understanding.state).toBe('developing');
      expect(progress.understanding.state).not.toBe('needs_support');

      const explanation = expectOk(
        await harness.learner.explain(requestContext(harness, 'stale-explain'), {
          conceptId: CONCEPT_CELL,
        }),
      );
      expect(explanation.stale).toBe(true);
      expect(explanation.requiresRecheck).toBe(true);
      expect(explanation.history.every((item) => item.validity === 'stale')).toBe(true);
      expect(explanation.review.everReviewed).toBe(false);
      expect(explanation.review.isDue).toBe(true);

      const entry = harness.learner.projectionEntries.find(
        (item) => item.progress.conceptId === CONCEPT_CELL,
      );
      expect(entry?.staleHistory[0]?.reason).toBe(
        'time_elapsed_validity_refresh_not_forgetting',
      );

      const lineCount = harness.journalLines().length;
      const again = expectOk(
        await harness.learner.refreshValidity(requestContext(harness, 'stale-refresh-again')),
      );
      expect(again.staledConceptIds).toEqual([]);
      expect(harness.journalLines()).toHaveLength(lineCount);
    } finally {
      harness.cleanup();
    }
  });
});
