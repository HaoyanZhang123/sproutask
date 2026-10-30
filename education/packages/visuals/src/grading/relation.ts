/**
 * Deterministic relation grader (prerequisite / related).
 *
 * Endpoint correctness comes from the activity answer schema (directed pairs).
 * The relation *kind* is checked against the knowledge pack's Relations when the
 * caller provides them: prerequisite is directed, related is symmetric. With no
 * known relation the kind is reported as unclear instead of guessed.
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
import type { GradingContext, KnownRelation } from './types.js';

export const RELATION_GRADER_VERSION = 'rule-relation-v1';

interface PairResult {
  readonly kind: 'matched' | 'wrong_direction' | 'missing' | 'extra' | 'kind_mismatch' | 'kind_unknown';
  readonly from: string;
  readonly to: string;
  readonly submittedKind: 'prerequisite' | 'related' | null;
}

function findKnown(
  known: readonly KnownRelation[] | undefined,
  from: string,
  to: string,
): KnownRelation | null {
  if (known === undefined) return null;
  const directed = known.find((relation) => relation.fromConceptId === from && relation.toConceptId === to);
  if (directed !== undefined) return directed;
  const symmetric = known.find(
    (relation) =>
      relation.type === 'related' &&
      relation.fromConceptId === to &&
      relation.toConceptId === from,
  );
  return symmetric ?? null;
}

export function gradeRelation(context: GradingContext): VisualsResult<GradeResult> {
  const { activity, rubric, attempt, answer } = context;
  if (!rubricMatchesActivity(activity, rubric)) return fail(visualsError('RUBRIC_MISMATCH'));
  if (activity.answerSchema.kind !== 'relation' || answer.kind !== 'relation') {
    return fail(visualsError('ANSWER_INVALID'));
  }
  if (answer.pairs.length === 0) return fail(visualsError('ANSWER_EMPTY'));

  const expected = activity.answerSchema.pairs;
  const results: PairResult[] = [];
  const usedSubmitted = new Set<number>();

  for (const pair of expected) {
    const index = answer.pairs.findIndex(
      (submitted, position) =>
        !usedSubmitted.has(position) && submitted.fromId === pair.fromId && submitted.toId === pair.toId,
    );
    const reversedIndex = answer.pairs.findIndex(
      (submitted, position) =>
        !usedSubmitted.has(position) && submitted.fromId === pair.toId && submitted.toId === pair.fromId,
    );
    if (index >= 0) {
      usedSubmitted.add(index);
      const submitted = answer.pairs[index];
      const submittedKind = submitted.relation ?? null;
      if (submittedKind === null) {
        results.push({ kind: 'matched', from: pair.fromId, to: pair.toId, submittedKind: null });
        continue;
      }
      const known = findKnown(context.knownRelations, pair.fromId, pair.toId);
      if (known === null) {
        results.push({ kind: 'kind_unknown', from: pair.fromId, to: pair.toId, submittedKind });
        continue;
      }
      results.push({
        kind: known.type === submittedKind ? 'matched' : 'kind_mismatch',
        from: pair.fromId,
        to: pair.toId,
        submittedKind,
      });
      continue;
    }
    if (reversedIndex >= 0) {
      usedSubmitted.add(reversedIndex);
      const submitted = answer.pairs[reversedIndex];
      results.push({
        kind: 'wrong_direction',
        from: pair.fromId,
        to: pair.toId,
        submittedKind: submitted.relation ?? null,
      });
      continue;
    }
    results.push({ kind: 'missing', from: pair.fromId, to: pair.toId, submittedKind: null });
  }

  answer.pairs.forEach((pair, index) => {
    if (usedSubmitted.has(index)) return;
    results.push({ kind: 'extra', from: pair.fromId, to: pair.toId, submittedKind: pair.relation ?? null });
  });

  const matched = results.filter((entry) => entry.kind === 'matched').length;
  const definiteWrong = results.some((entry) =>
    ['wrong_direction', 'missing', 'extra', 'kind_mismatch'].includes(entry.kind),
  );
  const allMatched = matched === expected.length && results.every((entry) => entry.kind === 'matched');
  const kindUnknown = results.some((entry) => entry.kind === 'kind_unknown');

  const criteria = buildCriteria(rubric, () => ({
    met: allMatched ? 'yes' : definiteWrong ? 'no' : 'unclear',
    rationale: allMatched
      ? `全部 ${expected.length} 组关系连接正确`
      : definiteWrong
        ? `${definiteWrongCount(results)} 处连接与答案不一致`
        : '关系类型缺少可核对依据，暂不能判断',
  }));

  const describe = (entry: PairResult): string => {
    const kindText = entry.submittedKind === null ? '' : `（关系：${entry.submittedKind}）`;
    switch (entry.kind) {
      case 'matched':
        return `· ${entry.from} → ${entry.to}：正确${kindText}`;
      case 'wrong_direction':
        return `· ${entry.from} → ${entry.to}：方向反了${kindText}`;
      case 'missing':
        return `· ${entry.from} → ${entry.to}：缺少这条关系`;
      case 'extra':
        return `· ${entry.from} → ${entry.to}：答案里没有这条关系${kindText}`;
      case 'kind_mismatch':
        return `· ${entry.from} → ${entry.to}：关系类型不对${kindText}`;
      case 'kind_unknown':
        return `· ${entry.from} → ${entry.to}：关系类型暂时无法核对${kindText}`;
    }
  };

  const uncertainties: string[] = [];
  if (kindUnknown) uncertainties.push('部分关系类型缺少内容依据，未作为错误处理');

  const feedback = [
    allMatched ? '关系连接全部正确。' : definiteWrong ? '关系连接有不一致的地方：' : '关系连接基本成立，但类型还需确认：',
    ...results.map(describe),
  ].join('\n');

  const assistance = attemptAssistance(attempt);
  const sourceRefs = gradeSourceRefs(context);
  const evidenceCandidates =
    allMatched || definiteWrong
      ? [
          buildEvidenceCandidate({
            conceptId: activity.conceptIds[0] ?? '',
            kind: 'transfer',
            observation: safeObservation(
              allMatched
                ? `关系题全部正确（${expected.length} 组）`
                : `关系题有 ${definiteWrongCount(results)} 处不一致`,
            ),
            criteria,
            assistance,
            sourceRefs,
            origin: 'rule',
            modelRunId: null,
            uncertainty: allMatched ? 0 : 0.2,
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
      requiresClarification: kindUnknown && !definiteWrong,
      sourceRefs,
      graderVersion: context.graderVersion ?? RELATION_GRADER_VERSION,
    }),
  );
}

function definiteWrongCount(results: readonly PairResult[]): number {
  return results.filter((entry) =>
    ['wrong_direction', 'missing', 'extra', 'kind_mismatch'].includes(entry.kind),
  ).length;
}
