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
