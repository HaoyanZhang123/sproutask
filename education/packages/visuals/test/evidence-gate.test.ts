import { describe, expect, it } from 'vitest';

import type { EvidenceCandidate, GradeResult } from '@edu/domain';

import {
  gateEvidenceCandidates,
  submitAcceptedEvidence,
  type LearnerEvidencePort,
} from '../src/grading/evidence-gate.js';
import { gradeDiagramLabel } from '../src/grading/grade.js';
import { attemptFor, domainFixtureActivity, domainFixtureRubric } from './helpers/fixtures.js';

const activity = domainFixtureActivity((entry) => entry.answerSchema.kind === 'diagram_label');
const rubric = domainFixtureRubric('rubric.cell');

function goodGrade(): GradeResult {
  const graded = gradeDiagramLabel({
    activity,
    rubric,
    attempt: attemptFor(activity),
    answer: { kind: 'diagram_label', labels: [{ targetId: 'target.nucleus', text: '细胞核' }] },
  });
  if (!graded.ok) throw new Error('fixture grade failed');
  return graded.value;
}

function withCandidate(grade: GradeResult, patch: Partial<EvidenceCandidate>): GradeResult {
  return { ...grade, evidenceCandidates: [{ ...grade.evidenceCandidates[0], ...patch }] };
}

describe('evidence-candidate gate (A21/T11 step 4)', () => {
  it('accepts a well-formed rule candidate and records the audit', () => {
    const decision = gateEvidenceCandidates({ grade: goodGrade(), activity, rubric, attempt: attemptFor(activity) });
    expect(decision.refused).toBe(false);
    expect(decision.accepted).toHaveLength(1);
    expect(decision.rejected).toHaveLength(0);
    expect(decision.audit[0].outcome).toBe('accepted');
    expect(decision.audit[0].note).toBe('accepted');
  });

  it('refuses the whole grade when the attempt or activity does not match', () => {
    const mismatchedAttempt = gateEvidenceCandidates({
      grade: goodGrade(),
      activity,
      rubric,
      attempt: attemptFor(activity, { id: 'attempt.other' }),
    });
    expect(mismatchedAttempt.refused).toBe(true);
    expect(mismatchedAttempt.reasons[0]).toContain('作答');

    const staleActivity = gateEvidenceCandidates({
      grade: goodGrade(),
      activity: { ...activity, version: '2' },
      rubric,
      attempt: attemptFor(activity),
    });
    expect(staleActivity.refused).toBe(true);
  });

  it('refuses to turn a clarification state into evidence', () => {
    const grade = { ...goodGrade(), requiresClarification: true };
    const decision = gateEvidenceCandidates({ grade, activity, rubric, attempt: attemptFor(activity) });
    expect(decision.refused).toBe(true);
    expect(decision.accepted).toHaveLength(0);
    expect(decision.rejected[0].code).toBe('CLARIFICATION_REQUIRED');
  });

  it('rejects tampered candidates with a specific reason and keeps them in the audit', () => {
    const base = goodGrade();
    const cases: { patch: Partial<EvidenceCandidate>; code: string }[] = [
      { patch: { conceptId: 'concept.unknown' }, code: 'EVIDENCE_REJECTED' },
      { patch: { criterionResults: [{ criterionId: 'criterion.unknown', result: 'met', note: null }] }, code: 'EVIDENCE_REJECTED' },
      { patch: { assistance: 'assisted' }, code: 'ASSISTANCE_MISMATCH' },
      { patch: { assessmentOrigin: 'model', modelRunId: null }, code: 'MODEL_RUN_MISSING' },
      { patch: { sourceRefs: ['source.other-page'] }, code: 'EVIDENCE_REJECTED' },
      { patch: { observation: '   ' }, code: 'EVIDENCE_REJECTED' },
      { patch: { uncertainty: 1.5 }, code: 'EVIDENCE_REJECTED' },
    ];
    for (const testCase of cases) {
      const decision = gateEvidenceCandidates({
        grade: withCandidate(base, testCase.patch),
        activity,
        rubric,
        attempt: attemptFor(activity),
      });
      expect(decision.accepted).toHaveLength(0);
      expect(decision.rejected[0].code).toBe(testCase.code);
      expect(decision.audit[0].outcome).toBe('rejected');
    }
  });

  it('rejects a source reference the host cannot resolve', () => {
    const decision = gateEvidenceCandidates({
      grade: goodGrade(),
      activity,
      rubric,
      attempt: attemptFor(activity),
      resolveSourceRef: () => false,
    });
    expect(decision.accepted).toHaveLength(0);
    expect(decision.rejected[0].code).toBe('SOURCE_UNRESOLVED');
  });

  it('keeps a low-confidence model candidate but flags it as pending', () => {
    const grade = withCandidate(goodGrade(), {
      assessmentOrigin: 'model',
      modelRunId: 'run-1',
      uncertainty: 0.7,
    });
    const decision = gateEvidenceCandidates({ grade, activity, rubric, attempt: attemptFor(activity) });
    expect(decision.accepted).toHaveLength(1);
    expect(decision.audit[0].note).toBe('low_confidence_pending');
  });

  it('submits only accepted candidates to the learner port', async () => {
    const received: EvidenceCandidate[][] = [];
    const sink: LearnerEvidencePort = {
      async submitEvidence(input) {
        received.push([...input.candidates]);
        return { ok: true, value: { accepted: input.candidates.length } };
      },
    };
    const decision = gateEvidenceCandidates({ grade: goodGrade(), activity, rubric, attempt: attemptFor(activity) });
    const submitted = await submitAcceptedEvidence({ decision, activity, sink });
    expect(submitted.ok).toBe(true);
    if (!submitted.ok) return;
    expect(submitted.value).toEqual({ accepted: 1, rejected: 0 });
    expect(received).toHaveLength(1);

    const refused = gateEvidenceCandidates({
      grade: goodGrade(),
      activity,
      rubric,
      attempt: attemptFor(activity, { id: 'attempt.other' }),
    });
    const notSubmitted = await submitAcceptedEvidence({ decision: refused, activity, sink });
    expect(notSubmitted.ok).toBe(false);
    if (notSubmitted.ok) return;
    expect(notSubmitted.error.code).toBe('EVIDENCE_REJECTED');
  });
});
