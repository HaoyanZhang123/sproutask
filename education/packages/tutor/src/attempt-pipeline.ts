/**
 * Attempt submission + grading pipeline (05 §7 two-phase commit, card T07 §4).
 *
 * Phase 1: the raw answer is persisted through the learner service before any
 * model call. If the model fails, times out or is cancelled, the attempt stays
 * saved with pending feedback and can be re-graded for the *same* attempt —
 * never a second answer, never a second assessment for one grading key.
 *
 * Phase 2: the model grade is validated by the evidence guard; only accepted
 * evidence is handed to `learner.recordGradedAttempt`, which commits the
 * assessment + progress effects in one journal line.
 */

import type {
  Activity,
  ActivityAttempt,
  AttemptInputType,
  Clock,
  Evidence,
  GradeResult,
  HelpKind,
  Id,
  IdGenerator,
  RequestContext,
  Rubric,
  ServiceResult,
  Session,
} from '@edu/domain';
import { validateActivityAttempt } from '@edu/domain';
import type {
  AuditSink,
  TutorAttemptOutcome,
  TutorError,
  TutorLearnerPort,
  TutorModelGateway,
  TutorSignals,
} from './types.js';
import { errorFromThrown, fromServiceError, isCancelled, tutorError } from './errors.js';
import { guardEvidence, type EvidenceGuardResult } from './evidence-guard.js';

export interface AttemptPipelineDeps {
  readonly learner: TutorLearnerPort;
  readonly ids: IdGenerator;
  readonly clock: Clock;
  readonly gateway: TutorModelGateway;
  readonly onAudit?: AuditSink;
}

export interface AttemptPipelineInput {
  readonly session: Session;
  readonly activity: Activity;
  readonly rubric: Rubric;
  readonly requestId: string;
  readonly inputType: AttemptInputType;
  readonly answerText: string | null;
  readonly answerAssetId: Id | null;
  /** Help already given in this round, recorded on the attempt (05 §3.2). */
  readonly helpKinds: readonly HelpKind[];
  /** An answer/worked solution was disclosed in this round. */
  readonly disclosureInRound: boolean;
  readonly coreMisconception: boolean;
  readonly resolvableSourceRefs: readonly Id[];
  readonly rubricVersion: string;
  /**
   * Activity-level source declaration (default true). Hosts may pass the value
   * from curriculum metadata until the frozen Activity schema carries it.
   */
  readonly sourceRequired?: boolean;
  readonly timeoutMs?: number;
  readonly signals: TutorSignals;
}

export type AttemptPipelineResult =
  | { readonly ok: true; readonly outcome: TutorAttemptOutcome }
  | {
      readonly ok: false;
      readonly error: TutorError;
      readonly attemptId: Id | null;
      readonly attemptPersisted: boolean;
      readonly duplicate: boolean;
      readonly feedbackPending: boolean;
      /** Re-runs grading for the same persisted attempt; null before persistence. */
      readonly retry: (() => Promise<AttemptPipelineResult>) | null;
    };

export interface BuiltAttempt {
  readonly attempt: ActivityAttempt;
}

export type BuiltAttemptResult =
  | { readonly ok: true; readonly data: ActivityAttempt }
  | { readonly ok: false; readonly error: TutorError };

export function buildAttempt(
  ids: IdGenerator,
  clock: Clock,
  input: {
    readonly session: Session;
    readonly activity: Activity;
    readonly requestId: string;
    readonly inputType: AttemptInputType;
    readonly answerText: string | null;
    readonly answerAssetId: Id | null;
    readonly helpKinds: readonly HelpKind[];
  },
): BuiltAttemptResult {
  const now = clock.now();
  const attempt: ActivityAttempt = {
    schemaVersion: 1,
    id: ids.next('attempt'),
    requestId: input.requestId,
    learnerId: input.session.learnerId,
    sessionId: input.session.id,
    courseEditionId: input.session.courseEditionId,
    packVersion: input.session.packVersion,
    activityId: input.activity.id,
    activityVersion: input.activity.version,
    conceptIds: [...input.activity.conceptIds],
    inputType: input.inputType,
    answerAssetId: input.answerAssetId,
    answerText: input.answerText,
    submittedAt: now,
    helpUsed: [...new Set(input.helpKinds)].map((kind) => ({ kind, usedAt: now })),
    evidenceIds: [],
  };
  const validation = validateActivityAttempt(attempt);
  if (!validation.ok) {
    return {
      ok: false,
      error: tutorError(
        'INVALID_INPUT',
        `attempt rejected: ${validation.issues[0]?.message ?? 'invalid attempt'}`,
      ),
    };
  }
  return { ok: true, data: validation.value };
}

function gradingRevisionKey(attemptId: Id, graderVersion: string): string {
  return `${attemptId}|${graderVersion}|0`;
}

async function markGradingNotCommitted(
  deps: AttemptPipelineDeps,
  ctx: RequestContext,
  request: {
    readonly attemptId: Id;
    readonly graderVersion: string;
    readonly cancelled: boolean;
    readonly reason: string;
  },
): Promise<void> {
  const written = await deps.learner.cancelAttemptGrading(
    { ...ctx, requestId: `${ctx.requestId}:grade-state` },
    {
      attemptId: request.attemptId,
      graderVersion: request.graderVersion,
      revision: 0,
      reason: request.reason,
      cancelled: request.cancelled,
    },
  );
  if (!written.ok) {
    deps.onAudit?.({
      at: deps.clock.now(),
      kind: 'gateway.error',
      subject: request.attemptId,
      reason: `could not record grading state: ${written.error.code}`,
    });
  }
}

async function gradeAndCommit(
  deps: AttemptPipelineDeps,
  ctx: RequestContext,
  input: AttemptPipelineInput,
  attempt: ActivityAttempt,
): Promise<AttemptPipelineResult> {
  const modelRunId = deps.ids.next('model-run');
  let grade: GradeResult;
  try {
    const graded = await deps.gateway.grade(ctx, {
      sessionId: input.session.id,
      attempt,
      activity: input.activity,
      rubric: input.rubric,
      modelRunId,
    });
    if (!graded.ok) {
      const error = fromServiceError(graded.error);
      await markGradingNotCommitted(deps, ctx, {
        attemptId: attempt.id,
        graderVersion: 'rule-v1',
        cancelled: error.code === 'CANCELLED',
        reason: `grading failed: ${error.code}`,
      });
      deps.onAudit?.({
        at: deps.clock.now(),
        kind: 'gateway.error',
        subject: attempt.id,
        reason: `grading failed: ${error.code}`,
      });
      return {
        ok: false,
        error,
        attemptId: attempt.id,
        attemptPersisted: true,
        duplicate: false,
        feedbackPending: true,
        retry: () => gradeAndCommit(deps, ctx, input, attempt),
      };
    }
    grade = graded.data;
  } catch (error) {
    const mapped = errorFromThrown(error);
    await markGradingNotCommitted(deps, ctx, {
      attemptId: attempt.id,
      graderVersion: 'rule-v1',
      cancelled: mapped.code === 'CANCELLED',
      reason: `grading failed: ${mapped.code}`,
    });
    return {
      ok: false,
      error: mapped,
      attemptId: attempt.id,
      attemptPersisted: true,
      duplicate: false,
      feedbackPending: true,
      retry: () => gradeAndCommit(deps, ctx, input, attempt),
    };
  }

  /* Cancellation / timeout observed after the model call: no late commit. */
  if (isCancelled(ctx.signal)) {
    await markGradingNotCommitted(deps, ctx, {
      attemptId: attempt.id,
      graderVersion: grade.graderVersion,
      cancelled: true,
      reason: 'cancelled after the model response; late result not committed',
    });
    deps.onAudit?.({
      at: deps.clock.now(),
      kind: 'turn.cancelled',
      subject: attempt.id,
      reason: 'grading response arrived after cancellation',
    });
    return {
      ok: false,
      error: tutorError('CANCELLED', 'the grading request was cancelled'),
      attemptId: attempt.id,
      attemptPersisted: true,
      duplicate: false,
      feedbackPending: true,
      retry: () => gradeAndCommit(deps, ctx, input, attempt),
    };
  }

  const guarded: EvidenceGuardResult = guardEvidence({
    attempt,
    activity: input.activity,
    rubric: input.rubric,
    rubricVersion: input.rubricVersion,
    grade,
    disclosureInRound: input.disclosureInRound,
    resolvableSourceRefs: input.resolvableSourceRefs,
    coreMisconception: input.coreMisconception,
    ...(input.sourceRequired === undefined ? {} : { sourceRequired: input.sourceRequired }),
    ids: deps.ids,
    clock: deps.clock,
  });

  for (const rejected of guarded.rejected) {
    deps.onAudit?.({
      at: deps.clock.now(),
      kind: 'evidence.rejected',
      subject: `${attempt.id}#${rejected.candidateIndex}`,
      reason: `${rejected.reason}: ${rejected.message}`,
      detail: { conceptId: rejected.conceptId },
    });
  }

  if (guarded.accepted.length === 0) {
    await markGradingNotCommitted(deps, ctx, {
      attemptId: attempt.id,
      graderVersion: grade.graderVersion,
      cancelled: false,
      reason: 'no evidence candidate passed the guard',
    });
    return {
      ok: true,
      outcome: {
        attempt,
        attemptId: attempt.id,
        persisted: true,
        duplicate: false,
        grade,
        outcomes: [],
        rejectedCandidates: guarded.rejected,
        feedbackPending: true,
        completedAt: deps.clock.now(),
      },
    };
  }

  const committed = await deps.learner.recordGradedAttempt(
    { ...ctx, requestId: `${ctx.requestId}:assessment` },
    {
      attemptId: attempt.id,
      evidence: guarded.accepted,
      rubricVersion: input.activity.rubricVersion,
      evaluatorVersion: grade.graderVersion,
      coreMisconceptionEvidenceIds: guarded.coreMisconceptionEvidenceIds,
    },
  );
  if (!committed.ok) {
    const error = fromServiceError(committed.error);
    await markGradingNotCommitted(deps, ctx, {
      attemptId: attempt.id,
      graderVersion: grade.graderVersion,
      cancelled: false,
      reason: `assessment commit failed: ${error.code}`,
    });
    return {
      ok: false,
      error,
      attemptId: attempt.id,
      attemptPersisted: true,
      duplicate: false,
      feedbackPending: true,
      retry: () => gradeAndCommit(deps, ctx, input, attempt),
    };
  }

  deps.onAudit?.({
    at: deps.clock.now(),
    kind: 'evidence.committed',
    subject: attempt.id,
    reason: `committed ${guarded.accepted.length} evidence record(s) for grading revision ${gradingRevisionKey(attempt.id, grade.graderVersion)}`,
    detail: {
      rejected: guarded.rejected.length,
      coreMisconception: guarded.coreMisconceptionEvidenceIds.length,
    },
  });

  return {
    ok: true,
    outcome: {
      attempt,
      attemptId: attempt.id,
      persisted: true,
      duplicate: committed.data.some((outcome) => outcome.duplicate),
      grade,
      outcomes: committed.data,
      rejectedCandidates: guarded.rejected,
      feedbackPending: false,
      completedAt: deps.clock.now(),
    },
  };
}

/**
 * Persists the answer first, then grades it. Returns a retry closure on model
 * failure so the same attempt can be re-graded without a new submission.
 */
export async function submitAndGradeAttempt(
  deps: AttemptPipelineDeps,
  ctx: RequestContext,
  input: AttemptPipelineInput,
): Promise<AttemptPipelineResult> {
  if (isCancelled(ctx.signal)) {
    return {
      ok: false,
      error: tutorError('CANCELLED', 'the turn was cancelled before saving the answer'),
      attemptId: null,
      attemptPersisted: false,
      duplicate: false,
      feedbackPending: false,
      retry: null,
    };
  }

  const built = buildAttempt(deps.ids, deps.clock, {
    session: input.session,
    activity: input.activity,
    requestId: input.requestId,
    inputType: input.inputType,
    answerText: input.answerText,
    answerAssetId: input.answerAssetId,
    helpKinds: input.helpKinds,
  });
  if (!built.ok) {
    return {
      ok: false,
      error: built.error,
      attemptId: null,
      attemptPersisted: false,
      duplicate: false,
      feedbackPending: false,
      retry: null,
    };
  }
  const attempt = built.data;

  const saved = await deps.learner.submitAttempt(
    { ...ctx, requestId: input.requestId },
    attempt,
  );
  if (!saved.ok) {
    return {
      ok: false,
      error: fromServiceError(saved.error),
      attemptId: null,
      attemptPersisted: false,
      duplicate: false,
      feedbackPending: false,
      retry: null,
    };
  }

  // `duplicate` 只可能是"同一个 requestId 的旧回执"。若这次是学生新写的一版答案，
  // 继续往下走会拿旧 attempt 去写评分状态，最后抛 NOT_FOUND，界面上就是
  // "提交没有完成 / 找不到这项内容"。这里直接让学生重试，不掩盖问题。
  if (saved.data.duplicate) {
    deps.onAudit?.({
      at: deps.clock.now(),
      kind: 'gateway.error',
      subject: attempt.id,
      reason: 'answer was not saved: the request id was already used by an earlier submission',
    });
    return {
      ok: false,
      error: tutorError(
        'CONFLICT',
        'this submission reused an earlier request id, so the answer was not saved; please submit again',
        true,
      ),
      attemptId: null,
      attemptPersisted: false,
      duplicate: true,
      feedbackPending: false,
      retry: null,
    };
  }

  if (input.timeoutMs !== undefined && input.timeoutMs <= 0) {
    await markGradingNotCommitted(deps, ctx, {
      attemptId: attempt.id,
      graderVersion: 'rule-v1',
      cancelled: false,
      reason: 'timeout before grading',
    });
    return {
      ok: false,
      error: tutorError('TIMEOUT', 'grading timed out; the saved answer can be re-graded', true),
      attemptId: attempt.id,
      attemptPersisted: true,
      duplicate: saved.data.duplicate,
      feedbackPending: true,
      retry: () => gradeAndCommit(deps, ctx, input, attempt),
    };
  }

  const graded = await gradeAndCommit(deps, ctx, input, attempt);
  if (graded.ok) {
    return {
      ok: true,
      outcome: { ...graded.outcome, duplicate: graded.outcome.duplicate || saved.data.duplicate },
    };
  }
  return { ...graded, duplicate: saved.data.duplicate };
}

export type { Evidence };
