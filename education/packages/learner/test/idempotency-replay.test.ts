import { describe, expect, it } from 'vitest';
import {
  CONCEPT_CELL,
  COURSE_EDITION_ID,
  LEARNER_ID,
  LearnerHarness,
  PACK_VERSION,
  expectOk,
  makeAttempt,
  makeEvidence,
  makeSelfReport,
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

describe('two-phase idempotency and journal replay equality', () => {
  it('deduplicates repeated requestIds, keeps one answer, and replays to the same projection', async () => {
    const harness = await LearnerHarness.create({ start: '2026-10-29T01:00:00Z' });
    try {
      const session = makeSession({ startedAt: '2026-10-29T01:00:00Z' });
      expectOk(
        await harness.learner.startSession(requestContext(harness, 'idem-session'), session),
      );

      const attempt = makeAttempt({
        sessionId: session.id,
        submittedAt: '2026-10-29T01:05:00Z',
      });
      const submitCtx = requestContext(harness, 'idem-attempt');
      const firstSubmit = expectOk(await harness.learner.submitAttempt(submitCtx, attempt));
      const linesAfterSubmit = harness.journalLines().length;
      const secondSubmit = expectOk(await harness.learner.submitAttempt(submitCtx, attempt));
      expect(secondSubmit.duplicate).toBe(true);
      expect(secondSubmit.seq).toBe(firstSubmit.seq);
      expect(harness.journalLines()).toHaveLength(linesAfterSubmit);
      expect(
        harness.journalCommands().filter((command) => command['type'] === 'attempt.submitted'),
      ).toHaveLength(1);

      const evidence = makeEvidence({
        attemptId: attempt.id,
        createdAt: '2026-10-29T01:06:00Z',
      });
      const gradeCtx = requestContext(harness, 'idem-grade');
      const firstGrade = expectOk(
        await harness.learner.recordGradedAttempt(gradeCtx, {
          attemptId: attempt.id,
          evidence: [evidence],
          rubricVersion: 'rubric-bio-7a-v1',
          evaluatorVersion: 'grader-rule-v1',
        }),
      );
      const linesAfterGrade = harness.journalLines().length;
      const secondGrade = expectOk(
        await harness.learner.recordGradedAttempt(gradeCtx, {
          attemptId: attempt.id,
          evidence: [evidence],
          rubricVersion: 'rubric-bio-7a-v1',
          evaluatorVersion: 'grader-rule-v1',
        }),
      );
      expect(secondGrade[0]?.duplicate).toBe(true);
      expect(secondGrade[0]?.assessment?.id).toBe(firstGrade[0]?.assessment?.id);
      expect(harness.journalLines()).toHaveLength(linesAfterGrade);
      expect(
        harness.journalCommands().filter((command) => command['type'] === 'assessment.committed'),
      ).toHaveLength(1);

      const learnCtx = requestContext(harness, 'idem-complete');
      const firstCompletion = expectOk(
        await harness.learner.completeLearning(learnCtx, {
          sessionId: session.id,
          conceptId: CONCEPT_CELL,
          completedAt: '2026-10-29T01:30:00Z',
        }),
      );
      const linesAfterCompletion = harness.journalLines().length;
      const secondCompletion = expectOk(
        await harness.learner.completeLearning(learnCtx, {
          sessionId: session.id,
          conceptId: CONCEPT_CELL,
          completedAt: '2026-10-29T01:30:00Z',
        }),
      );
      expect(secondCompletion.duplicate).toBe(true);
      expect(secondCompletion.dueAt).toBe(firstCompletion.dueAt);
      expect(harness.journalLines()).toHaveLength(linesAfterCompletion);

      const report = makeSelfReport({ conceptId: CONCEPT_CELL });
      const reportCtx = requestContext(harness, 'idem-report');
      expectOk(await harness.learner.recordSelfReport(reportCtx, report));
      const linesAfterReport = harness.journalLines().length;
      const secondReport = expectOk(await harness.learner.recordSelfReport(reportCtx, report));
      expect(secondReport.duplicate).toBe(true);
      expect(harness.journalLines()).toHaveLength(linesAfterReport);

      const scopeCtx = requestContext(harness, 'idem-scope');
      expectOk(
        await harness.learner.declareLearnedScope(scopeCtx, {
          conceptIds: [CONCEPT_CELL],
          availableConceptIds: [CONCEPT_CELL],
        }),
      );
      const linesAfterScope = harness.journalLines().length;
      const secondScope = expectOk(
        await harness.learner.declareLearnedScope(scopeCtx, {
          conceptIds: [CONCEPT_CELL],
          availableConceptIds: [CONCEPT_CELL],
        }),
      );
      expect(secondScope.duplicate).toBe(true);
      expect(harness.journalLines()).toHaveLength(linesAfterScope);

      // The journal is a real JSONL file with monotonically increasing seq.
      const commands = harness.journalCommands();
      expect(commands.length).toBeGreaterThanOrEqual(6);
      const seqs = commands.map((command) => Number(command['seq']));
      expect(seqs).toEqual([...seqs].sort((a, b) => a - b));
      expect(new Set(seqs).size).toBe(seqs.length);

      // Replayed projection equals the live projection field by field.
      const replay = expectOk(
        await harness.learner.compareReplay(requestContext(harness, 'compare-replay')),
      );
      expect(replay.identical).toBe(true);
      expect(replay.invalidPayloads).toEqual([]);
      expect(JSON.stringify(replay.replayed)).toBe(JSON.stringify(replay.live));

      const beforeReopen = JSON.stringify(
        expectOk(
          await harness.learner.get(requestContext(harness, 'before-reopen'), key()),
        ),
      );
      await harness.reopen();
      const afterReopen = JSON.stringify(
        expectOk(
          await harness.learner.get(requestContext(harness, 'after-reopen'), key()),
        ),
      );
      expect(afterReopen).toBe(beforeReopen);

      // Idempotency still holds after replay: no second completion line.
      const linesAfterReopen = harness.journalLines().length;
      const completionAfterReopen = expectOk(
        await harness.learner.completeLearning(
          requestContext(harness, 'idem-complete'),
          {
            sessionId: session.id,
            conceptId: CONCEPT_CELL,
            completedAt: '2026-10-29T01:30:00Z',
          },
        ),
      );
      expect(completionAfterReopen.duplicate).toBe(true);
      expect(harness.journalLines()).toHaveLength(linesAfterReopen);
    } finally {
      harness.cleanup();
    }
  });

  it('does not duplicate an answer or a review when a second request reuses the attempt', async () => {
    const harness = await LearnerHarness.create({ start: '2026-10-29T01:00:00Z' });
    try {
      const session = makeSession({ startedAt: '2026-10-29T01:00:00Z' });
      expectOk(await harness.learner.startSession(requestContext(harness, 'retry-session'), session));
      const attempt = makeAttempt({ sessionId: session.id, submittedAt: '2026-10-29T01:05:00Z' });
      expectOk(
        await harness.learner.submitAttempt(requestContext(harness, 'retry-attempt'), attempt),
      );
      expectOk(
        await harness.learner.completeLearning(requestContext(harness, 'retry-learn'), {
          sessionId: session.id,
          conceptId: CONCEPT_CELL,
          completedAt: '2026-10-29T01:30:00Z',
        }),
      );
      const evidence = makeEvidence({ attemptId: attempt.id, createdAt: '2026-10-29T01:06:00Z' });
      const first = expectOk(
        await harness.learner.recordGradedAttempt(requestContext(harness, 'retry-grade-1'), {
          attemptId: attempt.id,
          evidence: [evidence],
          rubricVersion: 'rubric-bio-7a-v1',
          evaluatorVersion: 'grader-rule-v1',
        }),
      );
      expect(first[0]?.kind).toBe('assessment');
      const attemptLines = harness.journalCommands().filter(
        (command) => command['type'] === 'attempt.submitted',
      );
      expect(attemptLines).toHaveLength(1);

      // A second requestId for the same attempt is a re-grade path, not a new
      // answer: it may add a new revision line but must never add an attempt.
      await harness.learner.recordGradedAttempt(requestContext(harness, 'retry-grade-2'), {
        attemptId: attempt.id,
        evidence: [evidence],
        rubricVersion: 'rubric-bio-7a-v1',
        evaluatorVersion: 'grader-rule-v1',
      });
      expect(
        harness.journalCommands().filter((command) => command['type'] === 'attempt.submitted'),
      ).toHaveLength(1);

      const reviewSession = makeSession({
        conceptId: CONCEPT_CELL,
        mode: 'review',
        startedAt: '2026-10-30T02:00:00Z',
      });
      harness.clock.set('2026-10-30T02:00:00Z');
      expectOk(
        await harness.learner.startSession(
          requestContext(harness, 'review-session'),
          reviewSession,
        ),
      );
      const reviewCtx = requestContext(harness, 'review-complete-idem');
      const completion = expectOk(
        await harness.learner.completeReview(reviewCtx, {
          sessionId: reviewSession.id,
          conceptId: CONCEPT_CELL,
          completedAt: '2026-10-30T02:10:00Z',
          outcome: 'developing',
        }),
      );
      const linesAfterReview = harness.journalLines().length;
      const secondCompletion = expectOk(
        await harness.learner.completeReview(reviewCtx, {
          sessionId: reviewSession.id,
          conceptId: CONCEPT_CELL,
          completedAt: '2026-10-30T02:10:00Z',
          outcome: 'developing',
        }),
      );
      expect(secondCompletion.duplicate).toBe(true);
      expect(secondCompletion.dueAt).toBe(completion.dueAt);
      expect(harness.journalLines()).toHaveLength(linesAfterReview);
    } finally {
      harness.cleanup();
    }
  });
});
