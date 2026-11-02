/**
 * Evidence guard tests (card T07: "模型只建议不落盘").
 *
 * Forged or contract-invalid evidence candidates must be rejected with an
 * audited reason and must never reach the learner service (no grade written).
 */

import { describe, expect, it } from 'vitest';
import type { Activity, EvidenceCandidate, GradeResult, Rubric } from '@edu/domain';
import { guardEvidence } from '../src/index.js';
import { buildAttempt } from '../src/index.js';
import {
  createFixedClock,
  createSequentialIds,
  loadPack,
  makeCandidate,
  met,
  startHarness,
} from './helpers.js';

const pack = loadPack();
const activity = pack.activities.find((item) => item.id === 'activity.cell-explain') as Activity;
const rubric = pack.rubrics.find((item) => item.id === activity.rubricId) as Rubric;
const clock = createFixedClock();
const ids = createSequentialIds();

function attemptWithHelpKinds(helpKinds: readonly ('hint' | 'explanation' | 'example' | 'worked_solution' | 'answer')[]) {
  const built = buildAttempt(ids, clock, {
    session: {
      schemaVersion: 1,
      id: 'session.guard.fixture',
      learnerId: 'learner.t07.fixture',
      courseEditionId: pack.courseEditionId,
      packVersion: pack.version,
      trustMode: 'published',
      conceptId: 'concept.cell',
      mode: 'learn',
      status: 'active',
      startedAt: '2026-10-29T08:00:00Z',
      endedAt: null,
      resumeCursor: { activityId: activity.id, cursor: null },
      dshSessionId: null,
    },
    activity,
    requestId: 'request.guard.fixture',
    inputType: 'text',
    answerText: '细胞是生物体结构和功能的基本单位。',
    answerAssetId: null,
    helpKinds,
  });
  if (!built.ok) throw new Error(`attempt fixture failed: ${built.error.message}`);
  return built.data;
}

function gradeWith(candidates: readonly EvidenceCandidate[], attemptId: string): GradeResult {
  const base = met();
  if (base === undefined) throw new Error('missing grade fixture');
  return {
    schemaVersion: 1,
    attemptId,
    criteria: base.criteria,
    feedback: base.feedback ?? 'fixture feedback',
    uncertainties: [],
    evidenceCandidates: candidates,
    requiresClarification: base.requiresClarification ?? false,
    sourceRefs: base.sourceRefs ?? [],
    graderVersion: base.graderVersion ?? 'mock-grader-v1',
  };
}

function guard(
  attempt: ReturnType<typeof attemptWithHelpKinds>,
  candidates: readonly EvidenceCandidate[],
  overrides: {
    readonly rubricVersion?: string;
    readonly disclosureInRound?: boolean;
    readonly activity?: Activity;
    readonly sourceRequired?: boolean;
  } = {},
) {
  const guardedActivity = overrides.activity ?? activity;
  return guardEvidence({
    attempt,
    activity: guardedActivity,
    rubric,
    rubricVersion: overrides.rubricVersion ?? activity.rubricVersion,
    grade: gradeWith(candidates, attempt.id),
    disclosureInRound: overrides.disclosureInRound ?? false,
    resolvableSourceRefs: [
      ...new Set([...rubric.criteria.flatMap((c) => c.feedbackSourceRefs), ...activity.sourceRefs]),
    ],
    coreMisconception: false,
    ...(overrides.sourceRequired === undefined ? {} : { sourceRequired: overrides.sourceRequired }),
    ids,
    clock,
  });
}

describe('evidence guard rejections', () => {
  it('accepts a contract-valid model candidate and stamps the attempt id', () => {
    const attempt = attemptWithHelpKinds([]);
    const result = guard(attempt, [makeCandidate()]);
    expect(result.gradeInvalid).toBe(false);
    expect(result.rejected).toEqual([]);
    expect(result.accepted).toHaveLength(1);
    expect(result.accepted[0]?.attemptId).toBe(attempt.id);
    expect(result.accepted[0]?.assistance).toBe('unassisted');
  });

  it('rejects an `unassisted` claim when the attempt already used an answer', () => {
    const attempt = attemptWithHelpKinds(['answer']);
    const result = guard(attempt, [makeCandidate({ assistance: 'unassisted' })]);
    expect(result.accepted).toEqual([]);
    expect(result.rejected[0]?.reason).toBe('DISCLOSURE_INDEPENDENCE_LOST');
  });

  it('forces assisted when an explanation was shown even if the model says assisted', () => {
    const attempt = attemptWithHelpKinds(['explanation']);
    const result = guard(attempt, [makeCandidate({ assistance: 'assisted' })]);
    expect(result.accepted[0]?.assistance).toBe('assisted');
  });

  it('rejects a source ref that is not resolvable for the concept/activity/rubric', () => {
    const attempt = attemptWithHelpKinds([]);
    const result = guard(attempt, [makeCandidate({ sourceRefs: ['source.foreign'] })]);
    expect(result.rejected[0]?.reason).toBe('SOURCE_UNRESOLVED');
    expect(result.accepted).toEqual([]);
  });

  // H-04: empty source refs must not slip through (aligned with @edu/visuals
  // gate, which rejects `sourceRefs.length === 0`).
  it('rejects a candidate with no source refs by default (EVIDENCE_SOURCE_REQUIRED)', () => {
    const attempt = attemptWithHelpKinds([]);
    const result = guard(attempt, [makeCandidate({ sourceRefs: [] })]);
    expect(result.gradeInvalid).toBe(false);
    expect(result.accepted).toEqual([]);
    expect(result.rejected).toHaveLength(1);
    expect(result.rejected[0]?.reason).toBe('EVIDENCE_SOURCE_REQUIRED');
    expect(result.rejected[0]?.message).toContain('at least one resolvable source ref');
  });

  it('rejects empty source refs even when other candidates in the same grade are valid', () => {
    const attempt = attemptWithHelpKinds([]);
    const result = guard(attempt, [makeCandidate(), makeCandidate({ sourceRefs: [] })]);
    expect(result.accepted).toHaveLength(1);
    expect(result.rejected).toHaveLength(1);
    expect(result.rejected[0]?.candidateIndex).toBe(1);
    expect(result.rejected[0]?.reason).toBe('EVIDENCE_SOURCE_REQUIRED');
  });

  it('honours an activity that explicitly declares sourceRequired:false (hypothetical metadata)', () => {
    const attempt = attemptWithHelpKinds([]);
    const exemptActivity = { ...activity, sourceRequired: false } as Activity;
    const result = guard(attempt, [makeCandidate({ sourceRefs: [] })], { activity: exemptActivity });
    expect(result.rejected).toEqual([]);
    expect(result.accepted).toHaveLength(1);
    expect(result.accepted[0]?.sourceRefs).toEqual([]);
  });

  it('honours an explicit host-level sourceRequired:false declaration (T13 metadata seat)', () => {
    const attempt = attemptWithHelpKinds([]);
    const result = guard(attempt, [makeCandidate({ sourceRefs: [] })], { sourceRequired: false });
    expect(result.rejected).toEqual([]);
    expect(result.accepted).toHaveLength(1);
  });

  it('rejects an unknown rubric criterion', () => {
    const attempt = attemptWithHelpKinds([]);
    const result = guard(attempt, [makeCandidate({ criterionId: 'criterion.unknown' })]);
    expect(result.rejected[0]?.reason).toBe('CRITERION_UNKNOWN');
  });

  it('rejects every candidate when the session rubric version does not match the activity', () => {
    const attempt = attemptWithHelpKinds([]);
    const result = guard(attempt, [makeCandidate()], { rubricVersion: '999' });
    expect(result.gradeInvalid).toBe(true);
    expect(result.rejected[0]?.reason).toBe('RUBRIC_VERSION_MISMATCH');
  });

  it('rejects a grade that belongs to a different attempt', () => {
    const attempt = attemptWithHelpKinds([]);
    const result = guardEvidence({
      attempt,
      activity,
      rubric,
      rubricVersion: activity.rubricVersion,
      grade: gradeWith([makeCandidate()], 'attempt.someone.else'),
      disclosureInRound: false,
      resolvableSourceRefs: activity.sourceRefs,
      coreMisconception: false,
      ids,
      clock,
    });
    expect(result.gradeInvalid).toBe(true);
    expect(result.rejected[0]?.reason).toBe('ATTEMPT_MISMATCH');
  });

  it('rejects a candidate for a concept outside the submitted activity', () => {
    const attempt = attemptWithHelpKinds([]);
    const result = guard(attempt, [makeCandidate({ conceptId: 'concept.cell-division' })]);
    expect(result.rejected[0]?.reason).toBe('CONCEPT_NOT_IN_ACTIVITY');
  });

  it('rejects contract-invalid model grades (missing model run id or clarification conflict)', () => {
    const attempt = attemptWithHelpKinds([]);
    const missingRun = guard(attempt, [makeCandidate({ modelRunId: null })]);
    expect(missingRun.gradeInvalid).toBe(true);
    expect(missingRun.rejected[0]?.reason).toBe('INVALID_EVIDENCE_SHAPE');

    const clarification = guardEvidence({
      attempt,
      activity,
      rubric,
      rubricVersion: activity.rubricVersion,
      grade: {
        ...gradeWith([makeCandidate()], attempt.id),
        requiresClarification: true,
      },
      disclosureInRound: false,
      resolvableSourceRefs: activity.sourceRefs,
      coreMisconception: false,
      ids,
      clock,
    });
    expect(clarification.gradeInvalid).toBe(true);
    expect(clarification.rejected[0]?.reason).toBe('INVALID_EVIDENCE_SHAPE');
  });
});

describe('forged evidence never reaches the learner', () => {
  it('audits the rejection and writes no grade when the model claims independence after disclosure', async () => {
    const { service, learner, session } = await startHarness({
      turns: [
        { text: '这是完整答案：细胞是生物体结构和功能的基本单位。', signals: { intent: 'wants_answer' } },
        {
          text: '看过答案后的作答只能算 assisted。',
          signals: { answerQuality: 'correct' },
          grade: met(),
          evidenceCandidates: [makeCandidate({ assistance: 'unassisted' })],
        },
      ],
    });
    const answer = await service.submitTurn({ requestId: 'forge-1', learnerId: 'learner.t07.fixture', now: '2026-10-29T08:00:01Z' }, {
      requestId: 'forge-1',
      sessionId: session.id,
      revision: 0,
      message: '给我答案。',
    });
    expect(answer.ok).toBe(true);
    if (!answer.ok) return;
    const attempt = await service.submitTurn({ requestId: 'forge-2', learnerId: 'learner.t07.fixture', now: '2026-10-29T08:00:02Z' }, {
      requestId: 'forge-2',
      sessionId: session.id,
      revision: answer.data.revision,
      attempt: { activityId: 'activity.cell-explain', inputType: 'text', answerText: '细胞是基本单位。' },
    });
    expect(attempt.ok).toBe(true);
    if (!attempt.ok) return;
    expect(attempt.data.attemptOutcome?.rejectedCandidates.map((item) => item.reason)).toEqual([
      'DISCLOSURE_INDEPENDENCE_LOST',
    ]);
    expect(attempt.data.attemptOutcome?.feedbackPending).toBe(true);
    expect(learner.committed).toHaveLength(0);
    expect(learner.count('recordGradedAttempt')).toBe(0);
    expect(attempt.data.audit.some((event) => event.kind === 'evidence.rejected')).toBe(true);
    expect(attempt.data.message).toContain('未通过服务校验');
  });

  it('does not commit a candidate whose concept is outside the activity', async () => {
    const { service, learner, session } = await startHarness({
      turns: [
        {
          text: '这份证据不属于当前活动。',
          signals: { answerQuality: 'correct' },
          grade: met(),
          evidenceCandidates: [makeCandidate({ conceptId: 'concept.cell-division' })],
        },
      ],
    });
    const result = await service.submitTurn({ requestId: 'forge-concept-1', learnerId: 'learner.t07.fixture', now: '2026-10-29T08:00:01Z' }, {
      requestId: 'forge-concept-1',
      sessionId: session.id,
      revision: 0,
      attempt: { activityId: 'activity.cell-explain', inputType: 'text', answerText: '细胞是基本单位。' },
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.attemptOutcome?.rejectedCandidates[0]?.reason).toBe('CONCEPT_NOT_IN_ACTIVITY');
    expect(learner.count('recordGradedAttempt')).toBe(0);
    expect(result.data.audit.some((event) => event.kind === 'evidence.rejected')).toBe(true);
  });

  // H-04 end-to-end: empty source refs are rejected, audited and never written.
  it('rejects a model candidate with empty sourceRefs end-to-end (audited, no grade written)', async () => {
    const { service, learner, session } = await startHarness({
      turns: [
        {
          text: '这条证据没有出处，不能写入成绩。',
          signals: { answerQuality: 'correct' },
          grade: met(),
          evidenceCandidates: [makeCandidate({ sourceRefs: [] })],
        },
      ],
    });
    const result = await service.submitTurn({ requestId: 'h04-empty-1', learnerId: 'learner.t07.fixture', now: '2026-10-29T08:00:01Z' }, {
      requestId: 'h04-empty-1',
      sessionId: session.id,
      revision: 0,
      attempt: { activityId: 'activity.cell-explain', inputType: 'text', answerText: '细胞是基本单位。' },
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.attemptOutcome?.rejectedCandidates.map((item) => item.reason)).toEqual([
      'EVIDENCE_SOURCE_REQUIRED',
    ]);
    expect(result.data.attemptOutcome?.feedbackPending).toBe(true);
    expect(learner.committed).toHaveLength(0);
    expect(learner.count('recordGradedAttempt')).toBe(0);
    const audit = result.data.audit.filter((event) => event.kind === 'evidence.rejected');
    expect(audit).toHaveLength(1);
    expect(audit[0]?.reason).toContain('EVIDENCE_SOURCE_REQUIRED');
    expect(result.data.message).toContain('未通过服务校验');
  });

  it('allows empty sourceRefs only when the activity declares sourceRequired:false', async () => {
    const { service, learner, session } = await startHarness({
      turns: [
        {
          text: '这个活动不需要教材出处（显式声明）。',
          signals: { answerQuality: 'correct' },
          grade: met(),
          evidenceCandidates: [makeCandidate({ sourceRefs: [] })],
        },
      ],
      sourceRequiredForActivity: (activity) => activity.id !== 'activity.cell-explain',
    });
    const result = await service.submitTurn({ requestId: 'h04-exempt-1', learnerId: 'learner.t07.fixture', now: '2026-10-29T08:00:01Z' }, {
      requestId: 'h04-exempt-1',
      sessionId: session.id,
      revision: 0,
      attempt: { activityId: 'activity.cell-explain', inputType: 'text', answerText: '细胞是基本单位。' },
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.attemptOutcome?.rejectedCandidates).toEqual([]);
    expect(learner.committed).toHaveLength(1);
    expect(learner.committed[0]?.sourceRefs).toEqual([]);
  });
});
