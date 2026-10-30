import { describe, expect, it } from 'vitest';
import {
  CONCEPT_CELL,
  CONCEPT_ENERGY,
  CONCEPT_ORGAN,
  CONCEPT_TISSUE,
  COURSE_EDITION_ID,
  LEARNER_ID,
  LearnerHarness,
  PACK_VERSION,
  conceptMapping,
  expectOk,
  makeAttempt,
  makeCompatibilityMap,
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

function key(conceptId: string) {
  return {
    learnerId: LEARNER_ID,
    courseEditionId: COURSE_EDITION_ID,
    packVersion: PACK_VERSION,
    conceptId,
  };
}

async function completeLearning(
  harness: LearnerHarness,
  conceptId: string,
  completedAt: string,
): Promise<void> {
  const session = makeSession({ conceptId, startedAt: completedAt });
  expectOk(
    await harness.learner.startSession(
      requestContext(harness, nextRequest('start'), completedAt),
      session,
    ),
  );
  expectOk(
    await harness.learner.completeLearning(requestContext(harness, nextRequest('complete')), {
      sessionId: session.id,
      conceptId,
      completedAt,
    }),
  );
}

async function startLearn(
  harness: LearnerHarness,
  conceptId: string,
  trustMode: 'published' | 'candidate' = 'published',
) {
  const session = makeSession({ conceptId, trustMode, startedAt: harness.clock.now() });
  expectOk(
    await harness.learner.startSession(requestContext(harness, nextRequest('session')), session),
  );
  return session;
}

async function gradeOne(
  harness: LearnerHarness,
  sessionId: string,
  conceptId: string,
  kind: 'explain' | 'transfer',
) {
  const attempt = makeAttempt({ sessionId, conceptIds: [conceptId], submittedAt: harness.clock.now() });
  expectOk(
    await harness.learner.submitAttempt(requestContext(harness, nextRequest('attempt')), attempt),
  );
  const evidence = makeEvidence({
    attemptId: attempt.id,
    conceptId,
    kind,
    createdAt: harness.clock.now(),
  });
  return expectOk(
    await harness.learner.recordGradedAttempt(requestContext(harness, nextRequest('grade')), {
      attemptId: attempt.id,
      evidence: [evidence],
      rubricVersion: 'rubric-bio-7a-v1',
      evaluatorVersion: 'grader-rule-v1',
    }),
  );
}

describe('first-use scope declaration and deduplicated aggregates', () => {
  it('keeps the first-use learned range as a scope only and suggests a bounded diagnostic', async () => {
    const harness = await LearnerHarness.create();
    try {
      const declared = expectOk(
        await harness.learner.declareLearnedScope(requestContext(harness, 'declare-scope'), {
          conceptIds: [CONCEPT_CELL, CONCEPT_ORGAN, CONCEPT_TISSUE],
          availableConceptIds: [CONCEPT_CELL, CONCEPT_ORGAN, CONCEPT_TISSUE, CONCEPT_ENERGY],
          limit: 2,
        }),
      );
      expect(declared.declaredScope).toEqual([CONCEPT_CELL, CONCEPT_ORGAN, CONCEPT_TISSUE]);
      expect(declared.diagnosticSuggestions.map((item) => item.conceptId)).toEqual([
        CONCEPT_CELL,
        CONCEPT_ORGAN,
      ]);
      expect(declared.diagnosticSuggestions[0]?.reason).toContain('not system learned');
      expect(declared.untestedConceptIds).toEqual([CONCEPT_TISSUE, CONCEPT_ENERGY]);
      expect(declared.diagnosticSkipped).toBe(false);

      // Nothing was written to the learning/understanding/review axes.
      const list = expectOk(
        await harness.learner.list(requestContext(harness, 'list-after-scope'), {
          learnerId: LEARNER_ID,
          courseEditionId: COURSE_EDITION_ID,
          packVersion: PACK_VERSION,
        }),
      );
      expect(list).toEqual([]);
      const cell = expectOk(
        await harness.learner.get(requestContext(harness, 'cell-after-scope'), key(CONCEPT_CELL)),
      );
      expect(cell.learning.state).toBe('not_started');
      expect(cell.understanding.state).toBe('unassessed');

      // Skipping or aborting diagnostic changes nothing either.
      const diagnostic = makeSession({
        conceptId: CONCEPT_CELL,
        mode: 'diagnostic',
        startedAt: harness.clock.now(),
      });
      expectOk(
        await harness.learner.startSession(requestContext(harness, 'diagnostic-session'), diagnostic),
      );
      expectOk(
        await harness.learner.completeDiagnostic(requestContext(harness, 'diagnostic-skip'), {
          sessionId: diagnostic.id,
          testedConceptIds: [],
          skipped: true,
          completedAt: harness.clock.now(),
        }),
      );
      const afterDiagnostic = expectOk(
        await harness.learner.get(requestContext(harness, 'cell-after-diagnostic'), key(CONCEPT_CELL)),
      );
      expect(afterDiagnostic.learning.state).toBe('not_started');
      expect(afterDiagnostic.understanding.state).toBe('unassessed');
      expect(afterDiagnostic.review.dueAt).toBeNull();

      // The pure plan method matches the persisted declaration.
      const plan = expectOk(
        await harness.learner.firstUsePlan(requestContext(harness, 'pure-plan'), {
          declaredConceptIds: [CONCEPT_CELL, CONCEPT_ORGAN, CONCEPT_TISSUE],
          availableConceptIds: [CONCEPT_CELL, CONCEPT_ORGAN, CONCEPT_TISSUE, CONCEPT_ENERGY],
          limit: 2,
        }),
      );
      expect(plan.diagnosticSuggestions.map((item) => item.conceptId)).toEqual([
        CONCEPT_CELL,
        CONCEPT_ORGAN,
      ]);
    } finally {
      harness.cleanup();
    }
  });

  it('aggregates unique conceptIds with explicit denominator and separates candidate trials', async () => {
    const harness = await LearnerHarness.create({ start: '2026-10-29T01:30:00Z' });
    try {
      await completeLearning(harness, CONCEPT_CELL, '2026-10-29T02:00:00Z');
      await completeLearning(harness, CONCEPT_ORGAN, '2026-10-30T02:00:00Z');

      // TISSUE: in progress with a core misconception → needs_support.
      harness.clock.set('2026-10-30T03:00:00Z');
      const tissueSession = await startLearn(harness, CONCEPT_TISSUE);
      const tissueAttempt = makeAttempt({
        sessionId: tissueSession.id,
        conceptIds: [CONCEPT_TISSUE],
        submittedAt: harness.clock.now(),
      });
      expectOk(
        await harness.learner.submitAttempt(
          requestContext(harness, 'tissue-attempt'),
          tissueAttempt,
        ),
      );
      const tissueEvidence = makeEvidence({
        attemptId: tissueAttempt.id,
        conceptId: CONCEPT_TISSUE,
        createdAt: harness.clock.now(),
      });
      expectOk(
        await harness.learner.recordGradedAttempt(requestContext(harness, 'tissue-grade'), {
          attemptId: tissueAttempt.id,
          evidence: [tissueEvidence],
          rubricVersion: 'rubric-bio-7a-v1',
          evaluatorVersion: 'grader-rule-v1',
          coreMisconceptionEvidenceIds: [tissueEvidence.id],
        }),
      );

      // ENERGY: candidate trial cannot produce formal understanding.
      harness.clock.set('2026-10-30T04:00:00Z');
      const candidateSession = await startLearn(harness, CONCEPT_ENERGY, 'candidate');
      const candidateFirst = await gradeOne(
        harness,
        candidateSession.id,
        CONCEPT_ENERGY,
        'explain',
      );
      const candidateSecond = await gradeOne(
        harness,
        candidateSession.id,
        CONCEPT_ENERGY,
        'transfer',
      );
      expect(candidateFirst[0]?.kind).toBe('evidence_only');
      expect(candidateSecond[0]?.kind).toBe('evidence_only');
      const energy = expectOk(
        await harness.learner.get(requestContext(harness, 'energy-progress'), key(CONCEPT_ENERGY)),
      );
      expect(energy.understanding.state).toBe('unassessed');

      // Self report never changes aggregate counts.
      expectOk(
        await harness.learner.recordSelfReport(
          requestContext(harness, 'energy-self-report'),
          makeSelfReport({ conceptId: CONCEPT_ENERGY, claimedState: 'can_explain' }),
        ),
      );

      harness.clock.set('2026-11-10T00:00:00Z');
      const aggregate = expectOk(
        await harness.learner.aggregate(requestContext(harness, 'aggregate'), {
          availableConceptIds: [
            CONCEPT_CELL,
            CONCEPT_ORGAN,
            CONCEPT_TISSUE,
            CONCEPT_ENERGY,
            CONCEPT_ENERGY,
          ],
          candidateConceptIds: [CONCEPT_ENERGY],
          now: harness.clock.now(),
        }),
      );
      expect(aggregate.availableTotal).toBe(3);
      expect(aggregate.learnedCount).toBe(2);
      expect(aggregate.inProgressCount).toBe(1);
      expect(aggregate.dueCount).toBe(2);
      expect(aggregate.needsSupportCount).toBe(1);
      expect(aggregate.candidateCount).toBe(1);
      expect(aggregate.candidateConceptIds).toEqual([CONCEPT_ENERGY]);
      expect(aggregate.activityCoverage).toEqual({
        numerator: 2,
        denominator: 3,
        percent: 66.7,
        label: 'activity_coverage_not_mastery',
      });
      expect(aggregate.policyNote).toContain('not a mastery rate');

      // A compatibility mapping must not double count the same conceptId.
      const compatibility = expectOk(
        await harness.learner.applyCompatibilityMap(
          requestContext(harness, 'aggregate-compat'),
          makeCompatibilityMap({
            id: 'compat-aggregate-dedupe',
            mappings: [conceptMapping({ fromConceptId: CONCEPT_CELL, toConceptIds: [CONCEPT_CELL] })],
          }),
        ),
      );
      expect(compatibility.newConceptIds).toEqual([CONCEPT_CELL]);
      const afterCompatibility = expectOk(
        await harness.learner.aggregate(requestContext(harness, 'aggregate-after-compat'), {
          availableConceptIds: [CONCEPT_CELL, CONCEPT_ORGAN, CONCEPT_TISSUE, CONCEPT_ENERGY],
          candidateConceptIds: [CONCEPT_ENERGY],
          now: harness.clock.now(),
        }),
      );
      expect(afterCompatibility.learnedCount).toBe(2);
      expect(
        afterCompatibility.concepts.filter((concept) => concept.conceptId === CONCEPT_CELL),
      ).toHaveLength(1);
      expect(
        afterCompatibility.concepts.find((concept) => concept.conceptId === CONCEPT_ENERGY)
          ?.trustMode,
      ).toBe('candidate');
    } finally {
      harness.cleanup();
    }
  });
});
