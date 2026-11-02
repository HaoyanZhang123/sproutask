/**
 * Rule based grading port backed by `@edu/visuals`.
 *
 * Open text is graded deterministically against the rubric; image answers are
 * explicitly UNSUPPORTED on this route (no vision model is called by the rule
 * grader). A model grade path may wrap this port later; this adapter never
 * fabricates a score.
 */

import type { ActivityAttempt, GradePort, GradeRequest, GradeResult, ServiceResult } from '@edu/domain';
import { errResult, okResult } from '@edu/domain';
import { gradeAttempt, type GradedAnswer } from '@edu/visuals';

function answerFor(attempt: ActivityAttempt, kind: string): GradedAnswer | null {
  const text = attempt.answerText;
  if (attempt.inputType === 'image') return null;
  if (text === null) return null;
  if (kind === 'text') return { kind: 'text', text };
  try {
    const parsed: unknown = JSON.parse(text);
    if (kind === 'choice') {
      if (Array.isArray(parsed)) {
        const optionIds = parsed.filter((item): item is string => typeof item === 'string');
        return optionIds.length > 0 ? { kind: 'choice', optionIds } : null;
      }
      if (typeof parsed === 'string') return { kind: 'choice', optionIds: [parsed] };
      if (typeof parsed === 'object' && parsed !== null) {
        const optionIds = (parsed as { optionIds?: unknown }).optionIds;
        if (Array.isArray(optionIds)) {
          const ids = optionIds.filter((item): item is string => typeof item === 'string');
          if (ids.length > 0) return { kind: 'choice', optionIds: ids };
        }
      }
      return null;
    }
    if (kind === 'diagram_label') {
      const record = parsed as { labels?: unknown };
      if (!Array.isArray(record.labels)) return null;
      const labels = record.labels
        .map((label) => label as { targetId?: unknown; text?: unknown })
        .filter(
          (label): label is { targetId: string; text: string } =>
            typeof label.targetId === 'string' && typeof label.text === 'string',
        );
      return labels.length > 0 ? { kind: 'diagram_label', labels } : null;
    }
    if (kind === 'relation') {
      const record = parsed as { pairs?: unknown };
      if (!Array.isArray(record.pairs)) return null;
      const pairs = record.pairs
        .map((pair) => pair as { fromId?: unknown; toId?: unknown; relation?: unknown })
        .filter(
          (pair): pair is { fromId: string; toId: string; relation?: 'prerequisite' | 'related' | null } =>
            typeof pair.fromId === 'string' && typeof pair.toId === 'string',
        )
        .map((pair) => ({
          fromId: pair.fromId,
          toId: pair.toId,
          relation:
            pair.relation === 'prerequisite' || pair.relation === 'related' ? pair.relation : null,
        }));
      return pairs.length > 0 ? { kind: 'relation', pairs } : null;
    }
  } catch {
    return null;
  }
  return null;
}

export function createRuleGradePort(): GradePort {
  return {
    async grade(_ctx, request: GradeRequest): Promise<ServiceResult<GradeResult>> {
      const kind = request.activity.answerSchema.kind;
      const answer = answerFor(request.attempt, kind);
      if (answer === null) {
        return errResult(
          'UNSUPPORTED',
          attemptUnsupportedReason(request.attempt, kind),
          false,
        );
      }
      const result = gradeAttempt({
        activity: request.activity,
        rubric: request.rubric,
        attempt: {
          id: request.attempt.id,
          activityId: request.attempt.activityId,
          activityVersion: request.attempt.activityVersion,
          answerText: request.attempt.answerText,
          answerAssetId: request.attempt.answerAssetId,
          inputType: request.attempt.inputType,
          helpUsed: request.attempt.helpUsed,
        },
        answer,
        graderVersion: 'rule-v1',
      });
      if (!result.ok) {
        const code = result.error.code === 'ANSWER_INVALID' ? 'INVALID_INPUT' : 'UNSUPPORTED';
        return errResult(code, `rule grader rejected the answer: ${result.error.code}`, false);
      }
      return okResult(result.value, 0);
    },
  };
}

function attemptUnsupportedReason(attempt: ActivityAttempt, kind: string): string {
  if (attempt.inputType === 'image') {
    return 'image grading requires a vision model route and is not enabled on the rule grader';
  }
  return `rule grader has no answer projection for ${kind}/${attempt.inputType}`;
}
