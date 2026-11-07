import { describe, expect, it } from 'vitest';

import { validateGradeResult } from '@edu/domain';

import {
  attemptFor,
  cellDiagram,
  criterion,
  domainFixtureActivity,
  domainFixtureRelations,
  domainFixtureRubric,
  makeActivity,
  makeRubric,
} from './helpers/fixtures.js';
import { gradeAttempt, gradeChoice, gradeDiagramLabel, gradeRelation, gradeText } from '../src/grading/grade.js';
import type { GradingAttempt, GradingContext } from '../src/grading/types.js';

function expectValidGrade(grade: unknown): void {
  const validated = validateGradeResult(grade);
  if (!validated.ok) {
    throw new Error(`GradeResult invalid: ${JSON.stringify(validated.issues)}`);
  }
}

describe('deterministic rule grading (A21)', () => {
  const diagramActivity = domainFixtureActivity((activity) => activity.answerSchema.kind === 'diagram_label');
  const cellRubric = domainFixtureRubric('rubric.cell');

  it('grades every structural label and produces a valid GradeResult', () => {
    const context: GradingContext = {
      activity: diagramActivity,
      rubric: cellRubric,
      attempt: attemptFor(diagramActivity),
      answer: { kind: 'diagram_label', labels: [{ targetId: 'target.nucleus', text: '细胞核' }] },
    };
    const graded = gradeDiagramLabel(context);
    expect(graded.ok).toBe(true);
    if (!graded.ok) return;
    expectValidGrade(graded.value);
    expect(graded.value.criteria.every((criterion) => criterion.met === 'yes')).toBe(true);
    expect(graded.value.requiresClarification).toBe(false);
    expect(graded.value.evidenceCandidates).toHaveLength(1);
    expect(graded.value.evidenceCandidates[0].kind).toBe('label');
    expect(graded.value.graderVersion).toBe('rule-diagram-label-v1');

    const wrong = gradeDiagramLabel({
      ...context,
      answer: { kind: 'diagram_label', labels: [{ targetId: 'target.nucleus', text: '细胞膜' }] },
    });
    expect(wrong.ok).toBe(true);
    if (!wrong.ok) return;
    expect(wrong.value.criteria.every((criterion) => criterion.met === 'no')).toBe(true);
    expect(wrong.value.feedback).toContain('细胞核');

    const partial = gradeDiagramLabel({
      ...context,
      answer: { kind: 'diagram_label', labels: [] },
    });
    expect(partial.ok).toBe(false);
  });

  it('grades choice answers and refuses to invent a missing answer key', () => {
    const withoutKey = domainFixtureActivity((activity) => activity.answerSchema.kind === 'choice');
    const noKey = gradeChoice({
      activity: withoutKey,
      rubric: domainFixtureRubric('rubric.cell'),
      attempt: attemptFor(withoutKey),
      answer: { kind: 'choice', optionIds: ['option.a'] },
    });
    expect(noKey.ok).toBe(true);
    if (!noKey.ok) return;
    expect(noKey.value.criteria.every((criterion) => criterion.met === 'unclear')).toBe(true);
    expect(noKey.value.evidenceCandidates).toHaveLength(0);
    expect(noKey.value.uncertainties.join(' ')).toContain('答案键');

    const withKey = makeActivity({
      id: 'activity.test-choice',
      type: 'choice',
      answerSchema: {
        kind: 'choice',
        selection: 'single',
        options: [
          { id: 'option.a', label: '细胞核' },
          { id: 'option.b', label: '书本' },
        ],
        correctOptionIds: ['option.a'],
      },
    });
    const rubric = domainFixtureRubric('rubric.cell');
    const correct = gradeChoice({
      activity: withKey,
      rubric,
      attempt: attemptFor(withKey),
      answer: { kind: 'choice', optionIds: ['option.a'] },
    });
    expect(correct.ok).toBe(true);
    if (!correct.ok) return;
    expectValidGrade(correct.value);
    expect(correct.value.criteria.every((criterion) => criterion.met === 'yes')).toBe(true);
    expect(correct.value.evidenceCandidates[0].kind).toBe('discriminate');

    const wrong = gradeChoice({
      activity: withKey,
      rubric,
      attempt: attemptFor(withKey),
      answer: { kind: 'choice', optionIds: ['option.b'] },
    });
    expect(wrong.ok).toBe(true);
    if (!wrong.ok) return;
    expect(wrong.value.criteria.every((criterion) => criterion.met === 'no')).toBe(true);
    expect(wrong.value.feedback).toContain('书本');

    const unknownOption = gradeChoice({
      activity: withKey,
      rubric,
      attempt: attemptFor(withKey),
      answer: { kind: 'choice', optionIds: ['option.z'] },
    });
    expect(unknownOption.ok).toBe(false);
    if (unknownOption.ok) return;
    expect(unknownOption.error.code).toBe('ANSWER_OPTION_UNKNOWN');
  });

  it('grades relation endpoints, direction and kind against the content pack', () => {
    const activity = domainFixtureActivity((entry) => entry.answerSchema.kind === 'relation');
    const rubric = domainFixtureRubric('rubric.cell');
    const knownRelations = domainFixtureRelations();
    const base = {
      activity,
      rubric,
      attempt: attemptFor(activity),
      knownRelations,
    } as const;

    const correct = gradeRelation({
      ...base,
      answer: {
        kind: 'relation',
        pairs: [
          { fromId: 'concept.cell', toId: 'concept.cell-structure' },
          { fromId: 'concept.cell-structure', toId: 'concept.cell-division' },
        ],
      },
    });
    expect(correct.ok).toBe(true);
    if (!correct.ok) return;
    expectValidGrade(correct.value);
    expect(correct.value.criteria.every((criterion) => criterion.met === 'yes')).toBe(true);

    const reversed = gradeRelation({
      ...base,
      answer: {
        kind: 'relation',
        pairs: [
          { fromId: 'concept.cell-structure', toId: 'concept.cell' },
          { fromId: 'concept.cell-structure', toId: 'concept.cell-division' },
        ],
      },
    });
    expect(reversed.ok).toBe(true);
    if (!reversed.ok) return;
    expect(reversed.value.criteria.every((criterion) => criterion.met === 'no')).toBe(true);
    expect(reversed.value.feedback).toContain('方向');

    const kindMismatch = gradeRelation({
      ...base,
      answer: {
        kind: 'relation',
        pairs: [
          { fromId: 'concept.cell', toId: 'concept.cell-structure', relation: 'related' },
          { fromId: 'concept.cell-structure', toId: 'concept.cell-division', relation: 'prerequisite' },
        ],
      },
    });
    expect(kindMismatch.ok).toBe(true);
    if (!kindMismatch.ok) return;
    expect(kindMismatch.value.criteria.every((criterion) => criterion.met === 'no')).toBe(true);
    expect(kindMismatch.value.feedback).toContain('关系类型');

    // related is symmetric: the reversed pair with kind=related is accepted.
    const symmetric = gradeRelation({
      ...base,
      answer: {
        kind: 'relation',
        pairs: [
          { fromId: 'concept.cell', toId: 'concept.cell-structure' },
          { fromId: 'concept.cell-structure', toId: 'concept.cell-division' },
          { fromId: 'concept.cell-division', toId: 'concept.cell', relation: 'related' },
        ],
      },
    });
    expect(symmetric.ok).toBe(true);
    if (!symmetric.ok) return;
    // The extra pair is still an extra pair for the expected set.
    expect(symmetric.value.criteria.every((criterion) => criterion.met === 'no')).toBe(true);

    const unknownKind = makeActivity({
      id: 'activity.unknown-relation',
      type: 'relation',
      rubricId: 'rubric.unknown-relation',
      rubricVersion: '1',
      answerSchema: {
        kind: 'relation',
        pairs: [{ fromId: 'concept.a', toId: 'concept.b' }],
      },
    });
    const unknownRubric = makeRubric({
      id: 'rubric.unknown-relation',
      version: '1',
      criteria: [criterion('criterion.unknown')],
    });
    const unknown = gradeRelation({
      activity: unknownKind,
      rubric: unknownRubric,
      attempt: attemptFor(unknownKind),
      knownRelations: [],
      answer: { kind: 'relation', pairs: [{ fromId: 'concept.a', toId: 'concept.b', relation: 'prerequisite' }] },
    });
    expect(unknown.ok).toBe(true);
    if (!unknown.ok) return;
    expect(unknown.value.criteria.every((criterion) => criterion.met === 'unclear')).toBe(true);
    expect(unknown.value.requiresClarification).toBe(true);
    expect(unknown.value.evidenceCandidates).toHaveLength(0);
  });

  it('grades short text answers with rubric evidence and never turns "unclear" into wrong', () => {
    const rubric = makeRubric({
      id: 'rubric.text',
      version: '1',
      criteria: [criterion('criterion.text')],
    });
    const activity = makeActivity({
      id: 'activity.text',
      type: 'explain',
      answerSchema: { kind: 'text', maxLength: 500 },
      rubricId: rubric.id,
    });

    const meeting = gradeText({
      activity,
      rubric,
      attempt: attemptFor(activity),
      answer: { kind: 'text', text: '观察要有目的有计划；用自己的话说明观察需要目的和计划，不是随便看看。' },
    });
    expect(meeting.ok).toBe(true);
    if (!meeting.ok) return;
    expectValidGrade(meeting.value);
    expect(meeting.value.criteria[0].met).toBe('yes');
    expect(meeting.value.evidenceCandidates).toHaveLength(1);

    const misconception = gradeText({
      activity,
      rubric,
      attempt: attemptFor(activity),
      answer: { kind: 'text', text: '看见过就等于观察过，所以每天路过校园就是观察。' },
    });
    expect(misconception.ok).toBe(true);
    if (!misconception.ok) return;
    expect(misconception.value.criteria[0].met).toBe('no');
    expect(misconception.value.feedback).toContain('看见过就等于观察过');

    const unclear = gradeText({
      activity,
      rubric,
      attempt: attemptFor(activity),
      answer: { kind: 'text', text: '我觉得生物学很有意思，老师说要多看看。' },
    });
    expect(unclear.ok).toBe(true);
    if (!unclear.ok) return;
    expect(unclear.value.criteria.every((criterion) => criterion.met === 'unclear')).toBe(true);
    expect(unclear.value.requiresClarification).toBe(true);
    expect(unclear.value.evidenceCandidates).toHaveLength(0);
    // Not wrong: no criterion is marked "no".
    expect(unclear.value.criteria.some((criterion) => criterion.met === 'no')).toBe(false);

    const empty = gradeText({
      activity,
      rubric,
      attempt: attemptFor(activity),
      answer: { kind: 'text', text: '   ' },
    });
    expect(empty.ok).toBe(false);
    if (empty.ok) return;
    expect(empty.error.code).toBe('ANSWER_EMPTY');
  });

  /**
   * 线上事故回归：学生写得自然但用词和评分要点不完全一样时，规则批改曾经
   * 判不清（阈值 0.5 偏高），而"把词罗列一遍"反而能过——等于奖励罗列、
   * 惩罚表达。这条用例锁住两个方向：正常表达要判对，误解与离题不能判对。
   */
  it('accepts 自然表达 while still refusing 误解 and 离题', () => {
    const activity = makeActivity({
      id: 'activity.test.observe-order',
      type: 'transfer',
      conceptIds: ['concept.test.observe'],
      answerSchema: { kind: 'text', maxLength: 600 },
      rubricId: 'rubric.test.observe-order',
    });
    const rawCriterion = (
      criterionId: string,
      description: string,
      acceptableEvidence: readonly string[],
      commonMisconceptions: readonly string[],
    ) => ({
      ...criterion(criterionId),
      description,
      acceptableEvidence,
      commonMisconceptions,
    });
    const rubric = makeRubric({
      id: 'rubric.test.observe-order',
      version: '1',
      conceptIds: ['concept.test.observe'],
      criteria: [
        rawCriterion(
          'criterion.test.sequence',
          '能按合理顺序描述一次观察活动的过程',
          [
            '顺序包含确定目的、明确对象、观察记录、交流结果四个环节（措辞可不同）',
            '能说明按顺序观察有助于不遗漏、可复核',
          ],
          ['观察顺序无所谓，看到什么算什么'],
        ),
        rawCriterion(
          'criterion.test.record',
          '能说出观察记录的要素，并说明记录要真实、及时',
          [
            '列出时间、地点、天气、观察人、生物名称、特征、生活环境中的至少三项',
            '说明记录应及时、真实客观，不能凭回忆补记',
          ],
          ['记录可以事后凭记忆补'],
        ),
      ],
    });

    const grade = (text: string) => {
      const graded = gradeText({
        activity,
        rubric,
        attempt: attemptFor(activity),
        answer: { kind: 'text', text },
      });
      expect(graded.ok).toBe(true);
      if (!graded.ok) throw new Error('grade failed');
      expectValidGrade(graded.value);
      return graded.value;
    };

    // 用词和评分要点不完全一样的正常表达：必须判得出，且产出证据。
    const natural = grade(
      '先确定观察的目的，再明确要观察的对象，然后按一定的顺序察看并及时记录，最后和同学交流结果。记录表要写清时间、地点、天气、观察人和生物名称，记录必须及时、真实客观，因为事后凭记忆补记容易遗漏。',
    );
    expect(natural.criteria.some((criterion) => criterion.met === 'yes')).toBe(true);
    expect(natural.evidenceCandidates.length).toBeGreaterThan(0);
    expect(natural.requiresClarification).toBe(false);

    // 误解：命中 commonMisconceptions，必须判 no，不能判对。
    const misconception = grade(
      '观察顺序无所谓，看到什么算什么。记录可以事后凭记忆补，只记录符合预期的现象就行。',
    );
    expect(misconception.criteria.some((criterion) => criterion.met === 'no')).toBe(true);
    expect(misconception.criteria.every((criterion) => criterion.met === 'yes')).toBe(false);

    // 离题：仍然 unclear，不产出证据、也不判错。
    const offTopic = grade('我觉得观察很有趣，可以学到很多东西。');
    expect(offTopic.criteria.every((criterion) => criterion.met === 'unclear')).toBe(true);
    expect(offTopic.evidenceCandidates).toHaveLength(0);
    expect(offTopic.requiresClarification).toBe(true);
    expect(offTopic.criteria.some((criterion) => criterion.met === 'no')).toBe(false);
  });

  it('rejects answer/schema/rubric mismatches instead of grading them', () => {
    const activity = domainFixtureActivity((entry) => entry.answerSchema.kind === 'diagram_label');
    const rubric = domainFixtureRubric('rubric.cell');
    const mismatchedAnswer = gradeDiagramLabel({
      activity,
      rubric,
      attempt: attemptFor(activity),
      answer: { kind: 'choice', optionIds: ['option.a'] },
    });
    expect(mismatchedAnswer.ok).toBe(false);

    const wrongRubric = gradeDiagramLabel({
      activity,
      rubric: makeRubric({ id: 'rubric.other', version: '9', criteria: [criterion('c')] }),
      attempt: attemptFor(activity),
      answer: { kind: 'diagram_label', labels: [{ targetId: 'target.nucleus', text: '细胞核' }] },
    });
    expect(wrongRubric.ok).toBe(false);
    if (wrongRubric.ok) return;
    expect(wrongRubric.error.code).toBe('RUBRIC_MISMATCH');

    const typeMismatch = gradeAttempt({
      activity: makeActivity({
        id: 'activity.type-mismatch',
        type: 'recall',
        answerSchema: {
          kind: 'choice',
          selection: 'single',
          options: [{ id: 'a', label: 'A' }, { id: 'b', label: 'B' }],
          correctOptionIds: null,
        },
      }),
      rubric: domainFixtureRubric('rubric.cell'),
      attempt: attemptFor(activity),
      answer: { kind: 'choice', optionIds: ['a'] },
    });
    expect(typeMismatch.ok).toBe(false);
  });

  it('keeps assisted attempts assisted in the evidence candidate', () => {
    const activity = domainFixtureActivity((entry) => entry.answerSchema.kind === 'diagram_label');
    const rubric = domainFixtureRubric('rubric.cell');
    const assistedAttempt: GradingAttempt = attemptFor(activity, {
      helpUsed: [{ kind: 'worked_solution', usedAt: '2026-10-29T10:00:00Z' }],
    });
    const graded = gradeDiagramLabel({
      activity,
      rubric,
      attempt: assistedAttempt,
      answer: { kind: 'diagram_label', labels: [{ targetId: 'target.nucleus', text: '细胞核' }] },
    });
    expect(graded.ok).toBe(true);
    if (!graded.ok) return;
    expect(graded.value.evidenceCandidates[0].assistance).toBe('assisted');
  });

  it('renders the cell diagram fixture with the same plan shape used by the graders', () => {
    const spec = cellDiagram();
    expect(spec.nodes).toHaveLength(3);
  });
});
