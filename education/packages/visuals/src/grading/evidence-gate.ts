/**
 * Evidence-candidate gate (T11 step 4, 05 §3.2/§5).
 *
 * Model and rule outputs are only *candidates*. This service re-checks them
 * against the attempt, activity, rubric, assistance and source references
 * before anything may reach `@edu/learner`; rejected candidates are kept in an
 * audit list with a stable reason code (never silently dropped).
 */

import type { Activity, EvidenceCandidate, GradeResult, Rubric } from '@edu/domain';

import { fail, ok, visualsError, type VisualsErrorCode, type VisualsResult } from '../errors.js';
import { attemptAssistance } from './helpers.js';
import type { GradingAttempt } from './types.js';

export interface EvidenceGateInput {
  readonly grade: GradeResult;
  readonly activity: Activity;
  readonly rubric: Rubric;
  readonly attempt: GradingAttempt;
  /** Host resolver for source references (library/knowledge). */
  readonly resolveSourceRef?: (sourceRefId: string) => boolean;
  /** Optional known concept ids of the bound content pack. */
  readonly knownConceptIds?: readonly string[];
}

export interface RejectedCandidate {
  readonly index: number;
  readonly code: VisualsErrorCode;
  readonly message: string;
  readonly candidate: EvidenceCandidate;
}

export interface EvidenceGateAudit {
  readonly index: number;
  readonly outcome: 'accepted' | 'rejected';
  readonly code: VisualsErrorCode | null;
  readonly note: string;
}

export interface EvidenceGateDecision {
  readonly attemptId: string;
  readonly accepted: readonly EvidenceCandidate[];
  readonly rejected: readonly RejectedCandidate[];
  readonly audit: readonly EvidenceGateAudit[];
  /** True when the whole grade was refused (attempt mismatch / clarification). */
  readonly refused: boolean;
  readonly reasons: readonly string[];
}

export interface LearnerEvidencePort {
  submitEvidence(input: {
    readonly attemptId: string;
    readonly activityId: string;
    readonly conceptIds: readonly string[];
    readonly candidates: readonly EvidenceCandidate[];
  }): Promise<VisualsResult<{ readonly accepted: number }>>;
}

function hasUnsafeText(text: string): boolean {
  return /[<>]/.test(text) || text.trim().length === 0;
}

/** Pure decision function; no I/O, so it is fully unit-testable. */
export function gateEvidenceCandidates(input: EvidenceGateInput): EvidenceGateDecision {
  const { grade, activity, rubric, attempt } = input;
  const rejected: RejectedCandidate[] = [];
  const audit: EvidenceGateAudit[] = [];
  const reasons: string[] = [];

  const refuse = (code: VisualsErrorCode, message: string): EvidenceGateDecision => {
    for (const [index, candidate] of grade.evidenceCandidates.entries()) {
      rejected.push({ index, code, message, candidate });
      audit.push({ index, outcome: 'rejected', code, note: message });
    }
    return {
      attemptId: grade.attemptId,
      accepted: [],
      rejected,
      audit,
      refused: true,
      reasons: [message],
    };
  };

  if (grade.attemptId !== attempt.id) {
    return refuse('ATTEMPT_MISMATCH', '反馈对应的作答与当前作答不一致');
  }
  if (attempt.activityId !== activity.id || attempt.activityVersion !== activity.version) {
    return refuse('ATTEMPT_MISMATCH', '作答属于另一个活动版本，不能写入本次学习记录');
  }
  if (grade.requiresClarification) {
    return refuse('CLARIFICATION_REQUIRED', '本次结果仍需学生确认，不形成理解证据');
  }

  const rubricCriteria = new Set(rubric.criteria.map((criterion) => criterion.criterionId));
  const allowedSources = new Set<string>(activity.sourceRefs);
  for (const criterion of rubric.criteria) {
    for (const ref of criterion.feedbackSourceRefs) allowedSources.add(ref);
  }
  const knownConcepts = new Set(
    input.knownConceptIds ?? [...activity.conceptIds],
  );
  const expectedAssistance = attemptAssistance(attempt);
  const accepted: EvidenceCandidate[] = [];

  grade.evidenceCandidates.forEach((candidate, index) => {
    const reject = (code: VisualsErrorCode, message: string): void => {
      rejected.push({ index, code, message, candidate });
      audit.push({ index, outcome: 'rejected', code, note: message });
    };
    if (!knownConcepts.has(candidate.conceptId)) {
      reject('EVIDENCE_REJECTED', `证据概念不在本次内容版本中：${candidate.conceptId}`);
      return;
    }
    if (candidate.criterionResults.length === 0) {
      reject('EVIDENCE_REJECTED', '证据没有对应任何评分要点');
      return;
    }
    for (const result of candidate.criterionResults) {
      if (!rubricCriteria.has(result.criterionId)) {
        reject('EVIDENCE_REJECTED', `证据引用了评分标准里不存在的要点：${result.criterionId}`);
        return;
      }
    }
    if (candidate.assistance !== expectedAssistance) {
      reject('ASSISTANCE_MISMATCH', '证据的提示使用情况与作答记录不一致');
      return;
    }
    if (candidate.assessmentOrigin === 'model' && (candidate.modelRunId === null || candidate.modelRunId.length === 0)) {
      reject('MODEL_RUN_MISSING', '模型证据缺少可追溯的调用记录');
      return;
    }
    if (candidate.assessmentOrigin === 'rule' && candidate.modelRunId !== null) {
      reject('EVIDENCE_REJECTED', '规则证据不应带有模型调用记录');
      return;
    }
    if (candidate.sourceRefs.length === 0) {
      reject('EVIDENCE_REJECTED', '证据缺少出处');
      return;
    }
    for (const ref of candidate.sourceRefs) {
      if (!allowedSources.has(ref)) {
        reject('EVIDENCE_REJECTED', `证据出处不属于这道题或评分标准：${ref}`);
        return;
      }
      if (input.resolveSourceRef !== undefined && !input.resolveSourceRef(ref)) {
        reject('SOURCE_UNRESOLVED', `证据出处无法解析：${ref}`);
        return;
      }
    }
    if (hasUnsafeText(candidate.observation) || candidate.observation.length > 400) {
      reject('EVIDENCE_REJECTED', '证据描述为空或包含不安全内容');
      return;
    }
    if (
      candidate.uncertainty !== null &&
      (!Number.isFinite(candidate.uncertainty) || candidate.uncertainty < 0 || candidate.uncertainty > 1)
    ) {
      reject('EVIDENCE_REJECTED', '证据的不确定度超出 0..1');
      return;
    }
    const pendingDueToLowConfidence =
      candidate.assessmentOrigin === 'model' &&
      (candidate.uncertainty === null || candidate.uncertainty > 0.5);
    accepted.push(candidate);
    audit.push({
      index,
      outcome: 'accepted',
      code: null,
      note: pendingDueToLowConfidence ? 'low_confidence_pending' : 'accepted',
    });
  });

  if (accepted.length === 0 && rejected.length === 0) {
    reasons.push('本次结果没有证据候选');
  } else if (accepted.length === 0) {
    reasons.push('全部证据候选未通过校验');
  }
  return {
    attemptId: grade.attemptId,
    accepted,
    rejected,
    audit,
    refused: false,
    reasons,
  };
}

/** Hands accepted candidates to the learner port; the gate result stays the audit source. */
export async function submitAcceptedEvidence(input: {
  readonly decision: EvidenceGateDecision;
  readonly activity: Activity;
  readonly sink: LearnerEvidencePort;
}): Promise<VisualsResult<{ readonly accepted: number; readonly rejected: number }>> {
  if (input.decision.refused) {
    return fail(visualsError('EVIDENCE_REJECTED', { retryable: true }));
  }
  if (input.decision.accepted.length === 0) {
    return ok({ accepted: 0, rejected: input.decision.rejected.length });
  }
  const submitted = await input.sink.submitEvidence({
    attemptId: input.decision.attemptId,
    activityId: input.activity.id,
    conceptIds: input.activity.conceptIds,
    candidates: input.decision.accepted,
  });
  if (!submitted.ok) return submitted;
  return ok({ accepted: submitted.value.accepted, rejected: input.decision.rejected.length });
}

export function gradeLooksValid(grade: GradeResult): boolean {
  return grade.criteria.length > 0 && grade.graderVersion.length > 0;
}
