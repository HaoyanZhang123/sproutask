/**
 * Deterministic short-answer grader.
 *
 * This is a *rule* grader: it rewards answers that overlap the rubric's
 * acceptable evidence and flags rubric-listed misconceptions, and otherwise
 * says "unclear" rather than judging a free-text answer wrong. Open-ended
 * feedback is the model path (T07); the rule result stays the audit anchor.
 */

import type { GradeResult, RubricCriterion } from '@edu/domain';

import { fail, ok, visualsError, type VisualsResult } from '../errors.js';
import { normalizeText, textTokens, tokenOverlap, visibleLength } from '../text/normalize.js';
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

export const TEXT_GRADER_VERSION = 'rule-text-v1';

const MIN_SUBSTANTIVE_LENGTH = 12;
const ACCEPTABLE_OVERLAP = 0.5;
const TOKEN_UNCERTAINTY = 0.4;

interface CriterionDecision {
  readonly met: 'yes' | 'no' | 'unclear';
  readonly rationale: string;
  readonly misconception: string | null;
}

function decideCriterion(
  criterion: RubricCriterion,
  tokens: Set<string>,
  normalizedAnswerText: string,
): CriterionDecision {
  for (const misconception of criterion.commonMisconceptions) {
    const normalizedMisconception = normalizeText(misconception);
    if (normalizedMisconception.length >= 4 && normalizedAnswerText.includes(normalizedMisconception)) {
      return { met: 'no', rationale: `回答里出现了常见误解：${misconception}`, misconception };
    }
  }
  let best = 0;
  let bestEvidence: string | null = null;
  for (const evidence of criterion.acceptableEvidence) {
    const overlap = tokenOverlap(evidence, tokens);
    if (overlap > best) {
      best = overlap;
      bestEvidence = evidence;
    }
  }
  if (best >= ACCEPTABLE_OVERLAP && bestEvidence !== null) {
    return { met: 'yes', rationale: `回答覆盖了评分要点：${bestEvidence}`, misconception: null };
  }
  return {
    met: 'unclear',
    rationale: '回答还不足以判断这一条要点（规则批改不据此判错）',
    misconception: null,
  };
}

export function gradeText(context: GradingContext): VisualsResult<GradeResult> {
  const { activity, rubric, attempt, answer } = context;
  if (!rubricMatchesActivity(activity, rubric)) return fail(visualsError('RUBRIC_MISMATCH'));
  if (activity.answerSchema.kind !== 'text' || answer.kind !== 'text') {
    return fail(visualsError('ANSWER_INVALID'));
  }
  if (visibleLength(answer.text) === 0) return fail(visualsError('ANSWER_EMPTY'));
  const maxLength = activity.answerSchema.maxLength;
  if (maxLength !== null && visibleLength(answer.text) > maxLength) {
    return fail(visualsError('ANSWER_INVALID', { detailsRef: `maxLength:${maxLength}` }));
  }

  const tokens = textTokens(answer.text);
  const normalizedAnswerText = normalizeText(answer.text);
  const decisions = new Map<string, CriterionDecision>();
  for (const criterion of rubric.criteria) {
    decisions.set(criterion.criterionId, decideCriterion(criterion, tokens, normalizedAnswerText));
  }
  const criteria = buildCriteria(rubric, (criterion) => {
    const decision = decisions.get(criterion.criterionId) ?? {
      met: 'unclear' as const,
      rationale: '未找到对应评分要点',
      misconception: null,
    };
    return { met: decision.met, rationale: decision.rationale };
  });

  const yesCount = criteria.filter((criterion) => criterion.met === 'yes').length;
  const noCount = criteria.filter((criterion) => criterion.met === 'no').length;
  const allUnclear = criteria.every((criterion) => criterion.met === 'unclear');
  const tooShort = visibleLength(answer.text) < MIN_SUBSTANTIVE_LENGTH;

  const feedbackLines: string[] = [];
  if (noCount > 0) {
    feedbackLines.push('你的回答里有与教材说法不一致的地方：');
    for (const criterion of criteria.filter((entry) => entry.met === 'no')) {
      const misconception = decisions.get(criterion.criterionId)?.misconception ?? '';
      feedbackLines.push(`· ${misconception.length > 0 ? misconception : criterion.rationale}`);
    }
  }
  if (yesCount > 0) {
    feedbackLines.push(`已说清 ${yesCount} 条要点：${criteria
      .filter((criterion) => criterion.met === 'yes')
      .map((criterion) => criterion.rationale)
      .join('；')}`);
  }
  if (allUnclear) {
    feedbackLines.push(
      tooShort
        ? '回答还比较短，规则批改不能判断对错。可以补充你的理由或举一个例子；也可以让我用讲解方式帮你对照评分要点。'
        : '这段回答没有命中评分要点，规则批改不会据此判错。可以补充理由或例子，或让我给出讲解。',
    );
  }

  const uncertainties: string[] = [];
  if (yesCount > 0) uncertainties.push('规则批改按关键词覆盖判断，未做语义理解');
  if (allUnclear) uncertainties.push('自由回答需要更完整的解释或模型反馈才能判断');

  const assistance = attemptAssistance(attempt);
  const sourceRefs = gradeSourceRefs(context);
  const definite = yesCount > 0 || noCount > 0;
  const evidenceCandidates = definite
    ? [
        buildEvidenceCandidate({
          conceptId: activity.conceptIds[0] ?? '',
          kind: 'explain',
          observation: safeObservation(
            `文字回答：命中 ${yesCount} 条要点，${noCount} 条与教材不一致`,
          ),
          criteria,
          assistance,
          sourceRefs,
          origin: 'rule',
          modelRunId: null,
          uncertainty: noCount > 0 ? 0.2 : TOKEN_UNCERTAINTY,
        }),
      ]
    : [];

  return ok(
    buildGradeResult({
      attemptId: attempt.id,
      criteria,
      feedback: feedbackLines.join('\n'),
      uncertainties,
      evidenceCandidates,
      requiresClarification: allUnclear,
      sourceRefs,
      graderVersion: context.graderVersion ?? TEXT_GRADER_VERSION,
    }),
  );
}
