/**
 * Deterministic structural-labelling grader (point-click and numbered-list
 * paths produce the same answer, so they are graded by the same code).
 */

import type { GradeResult } from '@edu/domain';

import { fail, ok, visualsError, type VisualsResult } from '../errors.js';
import { normalizeText } from '../text/normalize.js';
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

export const DIAGRAM_LABEL_GRADER_VERSION = 'rule-diagram-label-v1';

export function gradeDiagramLabel(context: GradingContext): VisualsResult<GradeResult> {
  const { activity, rubric, attempt, answer } = context;
  if (!rubricMatchesActivity(activity, rubric)) return fail(visualsError('RUBRIC_MISMATCH'));
  if (activity.answerSchema.kind !== 'diagram_label' || answer.kind !== 'diagram_label') {
    return fail(visualsError('ANSWER_INVALID'));
  }
  if (answer.labels.length === 0) return fail(visualsError('ANSWER_EMPTY'));

  const expected = new Map(activity.answerSchema.targets.map((target) => [target.id, target.label]));
  const perTarget: { targetId: string; expected: string; submitted: string | null; correct: boolean }[] = [];
  for (const target of activity.answerSchema.targets) {
    const submitted = answer.labels.find((label) => label.targetId === target.id);
    if (submitted === undefined) {
      perTarget.push({ targetId: target.id, expected: target.label, submitted: null, correct: false });
      continue;
    }
    perTarget.push({
      targetId: target.id,
      expected: target.label,
      submitted: submitted.text,
      correct: normalizeText(submitted.text) === normalizeText(target.label),
    });
  }
  for (const label of answer.labels) {
    if (!expected.has(label.targetId)) return fail(visualsError('ANSWER_TARGET_UNKNOWN'));
  }

  const answered = perTarget.filter((entry) => entry.submitted !== null);
  const wrong = answered.filter((entry) => !entry.correct);
  const unanswered = perTarget.length - answered.length;
  const allCorrect = answered.length === perTarget.length && wrong.length === 0;
  const anyDefiniteWrong = wrong.length > 0;

  const criteria = buildCriteria(rubric, () => ({
    met: allCorrect ? 'yes' : anyDefiniteWrong ? 'no' : 'unclear',
    rationale: allCorrect
      ? `全部 ${perTarget.length} 个部位标注正确`
      : anyDefiniteWrong
        ? `${wrong.length} 个部位标注与正确答案不一致`
        : '还有部位未标注，暂不能判断',
  }));

  const details = perTarget
    .map((entry) =>
      entry.submitted === null
        ? `· 部位 ${entry.targetId}：未标注（应为「${entry.expected}」）`
        : entry.correct
          ? `· 部位 ${entry.targetId}：正确（${entry.submitted}）`
          : `· 部位 ${entry.targetId}：你写的是「${entry.submitted}」，正确答案是「${entry.expected}」`,
    )
    .join('\n');
  const feedback = [
    allCorrect ? '标注全部正确。' : anyDefiniteWrong ? '部分部位标注不正确，逐项看看：' : '标注还不完整：',
    details,
  ].join('\n');

  const uncertainties: string[] = [];
  if (unanswered > 0) uncertainties.push(`还有 ${unanswered} 个部位没有标注`);
  if (activity.answerDisclosurePolicy === 'manual_review') {
    uncertainties.push('本题按内容设置需要人工复核，自动判断只作参考');
  }

  const assistance = attemptAssistance(attempt);
  const sourceRefs = gradeSourceRefs(context);
  const evidenceCandidates =
    allCorrect || anyDefiniteWrong
      ? [
          buildEvidenceCandidate({
            conceptId: activity.conceptIds[0] ?? '',
            kind: 'label',
            observation: safeObservation(
              allCorrect
                ? `结构标注全部正确（${perTarget.length} 个部位）`
                : `结构标注有 ${wrong.length}/${perTarget.length} 个部位不正确`,
            ),
            criteria,
            assistance,
            sourceRefs,
            origin: 'rule',
            modelRunId: null,
            uncertainty: allCorrect ? 0 : 0.2,
          }),
        ]
      : [];

  return ok(
    buildGradeResult({
      attemptId: attempt.id,
      criteria,
      feedback,
      uncertainties,
      evidenceCandidates,
      requiresClarification: unanswered > 0,
      sourceRefs,
      graderVersion: context.graderVersion ?? DIAGRAM_LABEL_GRADER_VERSION,
    }),
  );
}
