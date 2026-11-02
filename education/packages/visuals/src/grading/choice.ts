/**
 * Deterministic choice grader. Missing answer keys are reported as
 * "cannot judge" — the grader never invents a correct option.
 */

import type { GradeResult } from '@edu/domain';

import { fail, ok, visualsError, type VisualsResult } from '../errors.js';
import {
  attemptAssistance,
  buildCriteria,
  buildEvidenceCandidate,
  buildGradeResult,
  gradeSourceRefs,
  rubricMatchesActivity,
  safeObservation,
} from './helpers.js';
import type { GradingContext } from './types.js';

export const CHOICE_GRADER_VERSION = 'rule-choice-v1';

export function gradeChoice(context: GradingContext): VisualsResult<GradeResult> {
  const { activity, rubric, attempt, answer } = context;
  if (!rubricMatchesActivity(activity, rubric)) return fail(visualsError('RUBRIC_MISMATCH'));
  if (activity.answerSchema.kind !== 'choice' || answer.kind !== 'choice') {
    return fail(visualsError('ANSWER_INVALID'));
  }
  if (answer.optionIds.length === 0) return fail(visualsError('ANSWER_EMPTY'));

  const schema = activity.answerSchema;
  const optionIds = new Set(schema.options.map((option) => option.id));
  for (const id of answer.optionIds) {
    if (!optionIds.has(id)) return fail(visualsError('ANSWER_OPTION_UNKNOWN'));
  }
  if (schema.selection === 'single' && answer.optionIds.length !== 1) {
    return fail(visualsError('ANSWER_INVALID'));
  }

  const assistance = attemptAssistance(attempt);
  const sourceRefs = gradeSourceRefs(context);

  if (schema.correctOptionIds === null) {
    const criteria = buildCriteria(rubric, () => ({
      met: 'unclear',
      rationale: '本题内容包未提供答案键，规则批改无法判断',
    }));
    return ok(
      buildGradeResult({
        attemptId: attempt.id,
        criteria,
        feedback: '这道题暂时缺少答案键，不能自动判断对错。你的选择已保存，可由后续内容审核补全后再评。',
        uncertainties: ['内容包缺少答案键（correctOptionIds）'],
        evidenceCandidates: [],
        requiresClarification: false,
        sourceRefs,
        graderVersion: context.graderVersion ?? CHOICE_GRADER_VERSION,
      }),
    );
  }

  const selected = new Set(answer.optionIds);
  const correct = new Set(schema.correctOptionIds);
  const missing = [...correct].filter((id) => !selected.has(id));
  const extra = [...selected].filter((id) => !correct.has(id));
  const isCorrect = missing.length === 0 && extra.length === 0;
  const labelOf = (id: string): string => schema.options.find((option) => option.id === id)?.label ?? id;

  const criteria = buildCriteria(rubric, () => ({
    met: isCorrect ? 'yes' : 'no',
    rationale: isCorrect
      ? '选项与答案键完全一致'
      : `多选/漏选：${[...extra, ...missing].map(labelOf).join('、')}`,
  }));

  const feedback = isCorrect
    ? '选择正确。'
    : [
        '选择不正确。',
        extra.length > 0 ? `· 不该选的：${extra.map(labelOf).join('、')}` : null,
        missing.length > 0 ? `· 漏选的：${missing.map(labelOf).join('、')}` : null,
      ]
        .filter((line): line is string => line !== null)
        .join('\n');

  const evidenceCandidates = [
    buildEvidenceCandidate({
      conceptId: activity.conceptIds[0] ?? '',
      kind: 'discriminate',
      observation: safeObservation(
        `${isCorrect ? '选择题正确' : '选择题错误'}：选择 ${answer.optionIds.map(labelOf).join('、')}`,
      ),
      criteria,
      assistance,
      sourceRefs,
      origin: 'rule',
      modelRunId: null,
      uncertainty: 0,
    }),
  ];

  return ok(
    buildGradeResult({
      attemptId: attempt.id,
      criteria,
      feedback,
      uncertainties: [],
      evidenceCandidates,
      requiresClarification: false,
      sourceRefs,
      graderVersion: context.graderVersion ?? CHOICE_GRADER_VERSION,
    }),
  );
}
