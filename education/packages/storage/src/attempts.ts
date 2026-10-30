/**
 * Two-phase attempt / assessment commits (05 §7).
 *
 * Phase 1 persists the raw answer with pending feedback before any model call.
 * Phase 2 writes evidence + progress/review effects into the same journal line.
 * Retry only re-runs grading for the same attempt; assessment commits dedupe on
 * `attemptId|graderVersion|revision`.
 */

import type {
  ActivityAttempt,
  Assessment,
  AttemptCommitState,
  Evidence,
  JournalCommand,
  JournalEffect,
  RequestContext,
  ServiceError,
  ServiceResult,
} from '@edu/domain';
import {
  assessmentCommitKey,
  errResult,
  okResult,
  validateActivityAttempt,
  validateAssessment,
  validateAttemptCommitState,
  validateEvidence,
} from '@edu/domain';
import type { JournalStore } from './journal.js';
import type { AttemptSnapshotState } from './types.js';
import { replayLearner } from './replay.js';

export interface AttemptSubmitReceipt {
  readonly attemptId: string;
  readonly seq: number;
  readonly duplicate: boolean;
}

export interface AssessmentCommitReceipt {
  readonly attemptId: string;
  readonly dedupeKey: string;
  readonly seq: number;
  readonly duplicate: boolean;
}

export interface AssessmentFailureReceipt {
  readonly attemptId: string;
  readonly phase: 'assessment_failed' | 'assessment_cancelled';
  readonly seq: number;
  readonly duplicate: boolean;
}

export interface AttemptCommitService {
  submitAttempt(ctx: RequestContext, attempt: ActivityAttempt): Promise<ServiceResult<AttemptSubmitReceipt>>;
  commitAssessment(
    ctx: RequestContext,
    request: {
      readonly assessment: Assessment;
      readonly evidence: readonly Evidence[];
      readonly effects?: readonly JournalEffect[];
      readonly graderVersion: string;
    },
  ): Promise<ServiceResult<AssessmentCommitReceipt>>;
  failAssessment(
    ctx: RequestContext,
    request: {
      readonly attemptId: string;
      readonly graderVersion: string;
      readonly revision: number;
      readonly reason: string;
    },
  ): Promise<ServiceResult<AssessmentFailureReceipt>>;
  cancelAssessment(
    ctx: RequestContext,
    request: {
      readonly attemptId: string;
      readonly graderVersion: string;
      readonly revision: number;
      readonly reason: string;
    },
  ): Promise<ServiceResult<AssessmentFailureReceipt>>;
  getState(ctx: RequestContext, attemptId: string): Promise<ServiceResult<AttemptCommitState>>;
  listPending(ctx: RequestContext): Promise<ServiceResult<readonly AttemptCommitState[]>>;
}

interface CommitIndexes {
  readonly assessmentKeys: ReadonlyMap<string, JournalCommand>;
}

export function createAttemptCommitService(
  journal: JournalStore,
  ids: { next(prefix: string): string },
): AttemptCommitService {
  const replay = (learnerId: string) =>
    replayLearner(learnerId, journal.allCommits(), journal.lastSeq);

  const indexes = (): CommitIndexes => {
    const assessmentKeys = new Map<string, JournalCommand>();
    for (const command of journal.allCommits()) {
      if (command.type !== 'assessment.committed') continue;
      const key = command.payload['dedupeKey'];
      if (typeof key === 'string') assessmentKeys.set(key, command);
    }
    return { assessmentKeys };
  };

  const stateToDomain = (state: AttemptSnapshotState): ServiceResult<AttemptCommitState> => {
    const validation = validateAttemptCommitState({
      schemaVersion: 1,
      attemptId: state.attemptId,
      phase: state.phase,
      feedbackState: state.feedbackState,
      revision: state.revision,
      lastRequestId: state.lastRequestId,
      updatedAt: state.updatedAt,
    });
    if (!validation.ok) {
      return errResult(
        'CONTRACT_REJECTED',
        `stored attempt state is invalid: ${validation.issues[0]?.message ?? 'unknown'}`,
        false,
      );
    }
    return okResult(validation.value, state.revision);
  };

  const submitAttempt: AttemptCommitService['submitAttempt'] = async (ctx, attempt) => {
    const validation = validateActivityAttempt(attempt);
    if (!validation.ok) {
      return errResult(
        'VALIDATION_FAILED',
        `attempt rejected: ${validation.issues[0]?.message ?? 'unknown'}`,
        false,
      );
    }
    if (ctx.learnerId !== attempt.learnerId) {
      return errResult('UNAUTHORIZED', 'attempt belongs to another learner', false);
    }
    const existing = replay(attempt.learnerId).attempts.get(attempt.id);
    if (existing !== undefined) {
      if (existing.lastRequestId === ctx.requestId) {
        const original = journal.findByRequestId(ctx.requestId);
        return okResult(
          {
            attemptId: attempt.id,
            seq: original?.seq ?? journal.lastSeq,
            duplicate: true,
          },
          original?.seq ?? journal.lastSeq,
        );
      }
      return errResult(
        'CONFLICT',
        'attempt was already saved; retry grading for that attempt instead of creating a new answer',
        false,
      );
    }
    const receipt = await journal.append(ctx, {
      eventId: ids.next('event'),
      requestId: ctx.requestId,
      occurredAt: ctx.now,
      learnerId: ctx.learnerId,
      type: 'attempt.submitted',
      payload: { attempt: validation.value, feedback: { state: 'pending' } },
      effects: [{ kind: 'attempt.pending', targetId: attempt.id, revision: 0 }],
    });
    if (!receipt.ok) return failFrom(receipt);
    return okResult(
      { attemptId: attempt.id, seq: receipt.data.seq, duplicate: receipt.data.duplicate },
      receipt.data.revision,
    );
  };

  const commitAssessment: AttemptCommitService['commitAssessment'] = async (ctx, request) => {
    const assessmentValidation = validateAssessment(request.assessment);
    if (!assessmentValidation.ok) {
      return errResult(
        'VALIDATION_FAILED',
        `assessment rejected: ${assessmentValidation.issues[0]?.message ?? 'unknown'}`,
        false,
      );
    }
    const assessment = assessmentValidation.value;
    if (assessment.attemptId === null) {
      return errResult('INVALID_INPUT', 'assessment must reference a saved attempt', false);
    }
    if (request.graderVersion.trim().length === 0) {
      return errResult('INVALID_INPUT', 'graderVersion must not be empty', false);
    }
    if (request.evidence.length === 0) {
      return errResult('VALIDATION_FAILED', 'assessment commit requires evidence', false);
    }
    const replayState = replay(ctx.learnerId);
    const evidenceIds = new Set<string>();
    for (const item of request.evidence) {
      const evidenceValidation = validateEvidence(item);
      if (!evidenceValidation.ok) {
        return errResult(
          'VALIDATION_FAILED',
          `evidence rejected: ${evidenceValidation.issues[0]?.message ?? 'unknown'}`,
          false,
        );
      }
      const evidence = evidenceValidation.value;
      if (
        evidence.learnerId !== assessment.learnerId ||
        evidence.courseEditionId !== assessment.courseEditionId ||
        evidence.packVersion !== assessment.packVersion ||
        evidence.conceptId !== assessment.conceptId
      ) {
        return errResult(
          'INVALID_INPUT',
          'evidence is bound to a different learner/course edition/pack version/concept',
          false,
        );
      }
      if (!replayState.attempts.has(evidence.attemptId)) {
        return errResult(
          'INVALID_INPUT',
          'evidence references an attempt that was not saved first',
          false,
        );
      }
      evidenceIds.add(evidence.id);
    }
    if (
      evidenceIds.size !== assessment.evidenceIds.length ||
      assessment.evidenceIds.some((id) => !evidenceIds.has(id))
    ) {
      return errResult(
        'INVALID_INPUT',
        'assessment evidenceIds must exactly match the committed evidence',
        false,
      );
    }

    let dedupeKey: string;
    try {
      dedupeKey = assessmentCommitKey(assessment.attemptId, request.graderVersion, assessment.revision);
    } catch (error) {
      return errResult('INVALID_INPUT', (error as Error).message, false);
    }

    const state = replayState.attempts.get(assessment.attemptId);
    if (state === undefined) {
      return errResult(
        'INVALID_INPUT',
        'attempt must be saved (attempt.submitted) before an assessment is committed',
        false,
      );
    }
    if (state.phase === 'assessment_cancelled') {
      return errResult(
        'CONTRACT_REJECTED',
        'a cancelled grading request must not publish a late assessment',
        false,
      );
    }
    const existingByKey = indexes().assessmentKeys.get(dedupeKey);
    if (existingByKey !== undefined) {
      return okResult(
        { attemptId: assessment.attemptId, dedupeKey, seq: existingByKey.seq, duplicate: true },
        existingByKey.seq,
      );
    }
    if (state.phase === 'assessment_committed') {
      return errResult(
        'CONFLICT',
        'assessment revision differs from the committed judgment; use the same revision to retry',
        false,
      );
    }

    const effects: JournalEffect[] = [
      ...(request.effects ?? []),
      {
        kind: 'assessment.committed',
        targetId: assessment.id,
        revision: assessment.revision,
      },
    ];
    const receipt = await journal.append(ctx, {
      eventId: ids.next('event'),
      requestId: ctx.requestId,
      occurredAt: ctx.now,
      learnerId: ctx.learnerId,
      type: 'assessment.committed',
      payload: {
        assessment,
        evidence: request.evidence,
        graderVersion: request.graderVersion,
        dedupeKey,
      },
      effects,
    });
    if (!receipt.ok) return failFrom(receipt);
    return okResult(
      {
        attemptId: assessment.attemptId,
        dedupeKey,
        seq: receipt.data.seq,
        duplicate: receipt.data.duplicate,
      },
      receipt.data.revision,
    );
  };

  const failOrCancel = async (
    ctx: RequestContext,
    request: {
      readonly attemptId: string;
      readonly graderVersion: string;
      readonly revision: number;
      readonly reason: string;
    },
    kind: 'failed' | 'cancelled',
  ): Promise<ServiceResult<AssessmentFailureReceipt>> => {
    if (request.graderVersion.trim().length === 0 || !Number.isInteger(request.revision) || request.revision < 0) {
      return errResult('INVALID_INPUT', 'graderVersion and a non-negative revision are required', false);
    }
    const state = replay(ctx.learnerId).attempts.get(request.attemptId);
    if (state === undefined) {
      return errResult('INVALID_INPUT', 'attempt must be saved before grading can fail/cancel', false);
    }
    if (state.phase === 'assessment_committed') {
      return errResult('CONFLICT', 'a committed assessment cannot be failed/cancelled', false);
    }
    const type = kind === 'failed' ? 'assessment.failed' : 'assessment.cancelled';
    const receipt = await journal.append(ctx, {
      eventId: ids.next('event'),
      requestId: ctx.requestId,
      occurredAt: ctx.now,
      learnerId: ctx.learnerId,
      type,
      payload: {
        attemptId: request.attemptId,
        graderVersion: request.graderVersion,
        revision: request.revision,
        reason: request.reason,
      },
      effects: [
        {
          kind: kind === 'failed' ? 'attempt.feedback.failed' : 'attempt.feedback.cancelled',
          targetId: request.attemptId,
          revision: request.revision,
        },
      ],
    });
    if (!receipt.ok) return failFrom(receipt);
    return okResult(
      {
        attemptId: request.attemptId,
        phase: kind === 'failed' ? 'assessment_failed' : 'assessment_cancelled',
        seq: receipt.data.seq,
        duplicate: receipt.data.duplicate,
      },
      receipt.data.revision,
    );
  };

  return {
    submitAttempt,
    commitAssessment,
    failAssessment: (ctx, request) => failOrCancel(ctx, request, 'failed'),
    cancelAssessment: (ctx, request) => failOrCancel(ctx, request, 'cancelled'),
    async getState(ctx, attemptId) {
      const state = replay(ctx.learnerId).attempts.get(attemptId);
      if (state === undefined) {
        return errResult('NOT_FOUND', `no saved attempt ${attemptId}`, false);
      }
      return stateToDomain(state);
    },
    async listPending(ctx) {
      const states = [...replay(ctx.learnerId).attempts.values()]
        .filter((state) => state.phase === 'attempt_saved' || state.phase === 'assessment_failed')
        .map((state) => stateToDomain(state));
      const values: AttemptCommitState[] = [];
      for (const state of states) {
        if (!state.ok) return state;
        values.push(state.data);
      }
      return okResult(values, journal.lastSeq);
    },
  };
}

function failFrom<T>(result: { readonly ok: false; readonly error: ServiceError }): ServiceResult<T> {
  return { ok: false, error: result.error };
}
