/**
 * Learner service: three-axis progress projection, evidence rules and review
 * scheduling on top of the T02 journal.
 *
 * The journal is the authority. Every mutation appends one complete journal
 * command through storage, then folds the accepted command into the in-memory
 * projection. A fresh service folds the same commands from disk, which is the
 * replay-equality guarantee exercised by the T06 tests.
 */

import type {
  AppendReceipt,
  Assessment,
  Clock,
  ConceptProgress,
  Evidence,
  Id,
  IdGenerator,
  JournalCommand,
  JournalCommandInput,
  JournalEffect,
  LearnerProjectionStore,
  ProgressKey,
  ProgressWriteReceipt,
  RequestContext,
  ReviewOutcome,
  SelfReport,
  ServiceResult,
  Session,
  Timestamp,
  TrustMode,
} from '@edu/domain';
import {
  applySelfReport as applySelfReportRule,
  checkEvidenceAgainstAttempt,
  errResult,
  isOpaqueId,
  isValidRfc3339Utc,
  okResult,
  projectReview,
  validateActivityAttempt,
  validateAssessment,
  validateAssessmentForSession,
  validateAssessmentWithEvidence,
  validateEvidence,
  validateSelfReport,
  validateSession,
} from '@edu/domain';
import type { StorageService } from '@edu/storage';
import { aggregateEntries, trustModeOf } from './aggregate.js';
import type { AggregateInput, AggregateResult, AggregateConcept, LearnerServiceOptions } from './types.js';
import type { AggregateView, FirstUsePlanView } from './aggregate.js';
import { buildFirstUsePlan } from './aggregate.js';
import { planCompatibility, type CompatibilityPlan } from './compatibility.js';
import {
  assessmentRationale,
  buildAssessment,
  deriveConceptUnderstanding,
  normalizeCommittedEvidence,
  roundIndependence,
  type DerivationResult,
  type RoundIndependence,
} from './evidence.js';
import {
  createReviewPolicy,
  deferDue,
  dueAfterLearning,
  dueAfterReview,
  isStaleByAge,
  REVIEW_POLICY_HEURISTIC_NOTE,
  type ReviewPolicy,
} from './policy.js';
import {
  createConceptProgress,
  LEARNER_COMMAND_TYPES,
  LearnerProjector,
  REVIEW_POLICY_NOTE,
  type ConceptEntry,
  type EffectiveAssessment,
  type EffectiveEvidence,
} from './projection.js';
import {
  formatLocalDateTime,
  parseInstant,
  toRfc3339Utc,
} from './time.js';
import type {
  AssessmentHistoryItem,
  AssessmentOutcome,
  CompatibilityApplyResult,
  EvidenceExplanationItem,
  FirstUsePlan,
  LearningCompletionResult,
  ReplayComparison,
  ReviewCompletionResult,
  ReviewDeferralResult,
  ReviewQueueItem,
  ScopeDeclarationResult,
  SelfReportResult,
  SubmitAttemptResult,
  UnderstandingExplanation,
  ValidityRefreshResult,
} from './types.js';

const REPLAY_REQUEST_ID = 'learner.replay';

export class LearnerService implements LearnerProjectionStore {
  private readonly projector: LearnerProjector;

  private constructor(
    private readonly storage: StorageService,
    private readonly clock: Clock,
    private readonly ids: IdGenerator,
    private readonly learnerId: Id,
    readonly policy: ReviewPolicy,
    projector: LearnerProjector,
  ) {
    this.projector = projector;
  }

  static async open(options: LearnerServiceOptions): Promise<ServiceResult<LearnerService>> {
    if (!isOpaqueId(options.learnerId)) {
      return errResult('INVALID_INPUT', 'learnerId must be an opaque id');
    }
    let policy: ReviewPolicy;
    try {
      policy = options.policy ?? createReviewPolicy();
    } catch (error) {
      return errResult('INVALID_INPUT', (error as Error).message);
    }
    const status = options.storage.status;
    if (!status.writable) {
      return errResult(
        'CONTRACT_REJECTED',
        `learner service requires a writable storage; current mode=${status.mode}. ${options.storage.recoveryReport().recoverySteps.join('; ')}`,
      );
    }
    const projector = new LearnerProjector(options.learnerId, policy.version);
    const read = await LearnerService.readAll(options.storage, {
      requestId: REPLAY_REQUEST_ID,
      learnerId: options.learnerId,
      now: options.clock.now(),
    });
    if (!read.ok) return read;
    for (const command of read.data.commits) projector.apply(command);
    return okResult(
      new LearnerService(
        options.storage,
        options.clock,
        options.ids,
        options.learnerId,
        policy,
        projector,
      ),
      read.data.lastSeq,
    );
  }

  private static async readAll(
    storage: StorageService,
    ctx: RequestContext,
  ): Promise<ServiceResult<{ commits: readonly JournalCommand[]; lastSeq: number }>> {
    const commits: JournalCommand[] = [];
    let from = 0;
    let lastSeq = 0;
    for (let page = 0; page < 10_000; page += 1) {
      const slice = await storage.readFrom(ctx, from, 1000);
      if (!slice.ok) return slice;
      commits.push(...slice.data.commits);
      lastSeq = slice.data.lastSeq;
      if (!slice.data.hasMore) break;
      if (slice.data.commits.length === 0) break;
      from = lastSeq;
    }
    return okResult({ commits, lastSeq }, lastSeq);
  }

  /* --------------------------------------------------------------- helpers */

  private checkCtx(ctx: RequestContext): import('@edu/domain').ServiceError | null {
    if (ctx.learnerId !== this.learnerId) {
      return {
        code: 'UNAUTHORIZED',
        message: 'request context belongs to another learner',
        retryable: false,
      };
    }
    if (!isValidRfc3339Utc(ctx.now)) {
      return { code: 'INVALID_INPUT', message: 'ctx.now must be RFC3339 UTC', retryable: false };
    }
    return null;
  }

  private now(ctx: RequestContext, override?: Timestamp): Timestamp {
    const value = override ?? ctx.now;
    if (!isValidRfc3339Utc(value)) {
      throw new Error(`invalid timestamp: ${value}`);
    }
    return value;
  }

  private commandCtx(ctx: RequestContext, requestId: string, occurredAt: Timestamp): RequestContext {
    return { ...ctx, requestId, now: occurredAt };
  }

  private async append(
    ctx: RequestContext,
    input: {
      readonly requestId?: string;
      readonly occurredAt?: Timestamp;
      readonly type: string;
      readonly payload: Record<string, unknown>;
      readonly effects?: readonly JournalEffect[];
    },
  ): Promise<ServiceResult<{ readonly receipt: AppendReceipt; readonly command: JournalCommand }>> {
    const ctxError = this.checkCtx(ctx);
    if (ctxError !== null) return { ok: false, error: ctxError };
    const requestId = input.requestId ?? ctx.requestId;
    let occurredAt: Timestamp;
    try {
      occurredAt = this.now(ctx, input.occurredAt);
    } catch (error) {
      return errResult('INVALID_INPUT', (error as Error).message);
    }
    const knownSeq = this.projector.requestSeqOf(requestId);
    if (knownSeq !== null) {
      const command: JournalCommand = {
        schemaVersion: 1,
        eventId: `event.duplicate.${knownSeq}`,
        requestId,
        seq: knownSeq,
        occurredAt,
        learnerId: this.learnerId,
        type: input.type,
        payload: input.payload,
        effects: input.effects ?? [],
      };
      return okResult(
        {
          receipt: {
            eventId: command.eventId,
            requestId,
            seq: knownSeq,
            revision: knownSeq,
            duplicate: true,
          },
          command,
        },
        knownSeq,
      );
    }
    const commandInput: JournalCommandInput = {
      eventId: this.ids.next('event'),
      requestId,
      occurredAt,
      learnerId: this.learnerId,
      type: input.type,
      payload: input.payload,
      effects: input.effects ?? [],
    };
    const commandCtx = this.commandCtx(ctx, requestId, occurredAt);
    const written = await this.storage.append(commandCtx, commandInput);
    if (!written.ok) return written;
    const command: JournalCommand = { ...commandInput, schemaVersion: 1, seq: written.data.seq };
    if (!written.data.duplicate) this.projector.apply(command);
    return okResult({ receipt: written.data, command }, written.data.seq);
  }

  private progressFor(key: {
    readonly learnerId: Id;
    readonly courseEditionId: Id;
    readonly packVersion: string;
    readonly conceptId: Id;
  }): ConceptProgress {
    const entry = this.projector.getEntry(key);
    return (
      entry?.progress ??
      createConceptProgress(
        {
          learnerId: this.learnerId,
          courseEditionId: key.courseEditionId,
          packVersion: key.packVersion,
          conceptId: key.conceptId,
        },
        this.policy.version,
      )
    );
  }

  private progressList(): readonly ConceptProgress[] {
    return this.projector.listEntries().map((entry) => entry.progress);
  }

  private revision(): number {
    return this.storage.lastSeq;
  }

  /* -------------------------------------------------------------- sessions */

  async startSession(
    ctx: RequestContext,
    session: Session,
  ): Promise<ServiceResult<{ readonly sessionId: Id; readonly duplicate: boolean; readonly seq: number }>> {
    const ctxError = this.checkCtx(ctx);
    if (ctxError !== null) return { ok: false, error: ctxError };
    const validation = validateSession(session);
    if (!validation.ok) {
      return errResult(
        'VALIDATION_FAILED',
        `session rejected: ${validation.issues[0]?.message ?? 'unknown'}`,
      );
    }
    if (session.learnerId !== this.learnerId) {
      return errResult('UNAUTHORIZED', 'session belongs to another learner');
    }
    if (session.status !== 'active') {
      return errResult('VALIDATION_FAILED', 'session.start requires status=active');
    }
    const existing = this.projector.sessions.get(session.id);
    if (existing !== undefined) {
      const priorRequest = this.projector.requestSeqOf(ctx.requestId);
      if (priorRequest !== null) {
        return okResult(
          { sessionId: session.id, duplicate: true, seq: priorRequest },
          priorRequest,
        );
      }
      return errResult('CONFLICT', `session ${session.id} already exists`);
    }
    const effectKind =
      session.mode === 'learn'
        ? 'learning.started'
        : session.mode === 'review'
          ? 'review.session_started'
          : 'diagnostic.started';
    const written = await this.append(ctx, {
      type: LEARNER_COMMAND_TYPES.sessionStarted,
      payload: { session },
      effects: [{ kind: effectKind, targetId: session.conceptId, revision: 0 }],
    });
    if (!written.ok) return written;
    return okResult(
      { sessionId: session.id, duplicate: written.data.receipt.duplicate, seq: written.data.receipt.seq },
      written.revision,
    );
  }

  async endSession(
    ctx: RequestContext,
    request: { readonly sessionId: Id; readonly status: 'completed' | 'abandoned'; readonly endedAt: Timestamp },
  ): Promise<ServiceResult<{ readonly sessionId: Id; readonly duplicate: boolean }>> {
    const ctxError = this.checkCtx(ctx);
    if (ctxError !== null) return { ok: false, error: ctxError };
    const session = this.projector.sessions.get(request.sessionId);
    if (session === undefined) return errResult('NOT_FOUND', `no session ${request.sessionId}`);
    const knownEnd = this.projector.requestSeqOf(ctx.requestId);
    if (knownEnd !== null) {
      return okResult(
        { sessionId: request.sessionId, duplicate: true },
        knownEnd,
      );
    }
    if (session.status !== 'active') {
      return errResult('CONFLICT', `session ${request.sessionId} is not active`);
    }
    if (!isValidRfc3339Utc(request.endedAt)) {
      return errResult('INVALID_INPUT', 'endedAt must be RFC3339 UTC');
    }
    if (Date.parse(request.endedAt) < Date.parse(session.startedAt)) {
      return errResult('INVALID_INPUT', 'endedAt must not precede session.startedAt');
    }
    const written = await this.append(ctx, {
      type: LEARNER_COMMAND_TYPES.sessionEnded,
      payload: { sessionId: request.sessionId, status: request.status, endedAt: request.endedAt },
      effects: [
        {
          kind: request.status === 'completed' ? 'session.completed' : 'session.abandoned',
          targetId: request.sessionId,
          revision: 0,
        },
      ],
    });
    if (!written.ok) return written;
    return okResult(
      { sessionId: request.sessionId, duplicate: written.data.receipt.duplicate },
      written.revision,
    );
  }

  /* -------------------------------------------------------------- learning */

  async completeLearning(
    ctx: RequestContext,
    request: { readonly sessionId: Id; readonly conceptId: Id; readonly completedAt: Timestamp },
  ): Promise<ServiceResult<LearningCompletionResult>> {
    const ctxError = this.checkCtx(ctx);
    if (ctxError !== null) return { ok: false, error: ctxError };
    const session = this.projector.sessions.get(request.sessionId);
    if (session === undefined) return errResult('NOT_FOUND', `no session ${request.sessionId}`);
    if (session.mode !== 'learn') {
      return errResult('CONTRACT_REJECTED', 'only a learn session can complete a learning activity');
    }
    if (session.conceptId !== request.conceptId) {
      return errResult('INVALID_INPUT', 'session concept does not match the completed concept');
    }
    if (!isValidRfc3339Utc(request.completedAt)) {
      return errResult('INVALID_INPUT', 'completedAt must be RFC3339 UTC');
    }
    if (Date.parse(request.completedAt) < Date.parse(session.startedAt)) {
      return errResult('INVALID_INPUT', 'completedAt must not precede session.startedAt');
    }
    const key = {
      learnerId: this.learnerId,
      courseEditionId: session.courseEditionId,
      packVersion: session.packVersion,
      conceptId: request.conceptId,
    };
    const entry = this.projector.getEntry(key);
    const knownCompletion = this.projector.requestSeqOf(ctx.requestId);
    if (knownCompletion !== null) {
      const dueAt = entry?.progress.review.dueAt ?? dueAfterLearning(this.policy, request.completedAt);
      return okResult(
        {
          progress: entry?.progress ?? this.progressFor(key),
          dueAt,
          policyVersion: entry?.progress.review.policyVersion ?? this.policy.version,
          duplicate: true,
        },
        knownCompletion,
      );
    }
    if (
      entry !== null &&
      entry.progress.learning.lastCompletedAt !== null &&
      Date.parse(request.completedAt) <= Date.parse(entry.progress.learning.lastCompletedAt)
    ) {
      return errResult(
        'CONFLICT',
        'a repeated learning completion must have a later completedAt than the recorded completion',
      );
    }
    const dueAt = dueAfterLearning(this.policy, request.completedAt);
    const written = await this.append(ctx, {
      type: LEARNER_COMMAND_TYPES.learningCompleted,
      payload: {
        sessionId: request.sessionId,
        conceptId: request.conceptId,
        completedAt: request.completedAt,
        dueAt,
        policyVersion: this.policy.version,
        trustMode: session.trustMode,
      },
      effects: [{ kind: 'learning.completed', targetId: request.conceptId, revision: 0 }],
    });
    if (!written.ok) return written;
    return okResult(
      {
        progress: this.progressFor(key),
        dueAt,
        policyVersion: this.policy.version,
        duplicate: written.data.receipt.duplicate,
      },
      written.revision,
    );
  }

  /* ---------------------------------------------------------------- review */

  async completeReview(
    ctx: RequestContext,
    request: {
      readonly sessionId: Id;
      readonly conceptId: Id;
      readonly completedAt: Timestamp;
      readonly outcome?: ReviewOutcome;
    },
  ): Promise<ServiceResult<ReviewCompletionResult>> {
    const ctxError = this.checkCtx(ctx);
    if (ctxError !== null) return { ok: false, error: ctxError };
    const session = this.projector.sessions.get(request.sessionId);
    if (session === undefined) return errResult('NOT_FOUND', `no session ${request.sessionId}`);
    if (session.mode !== 'review') {
      return errResult('CONTRACT_REJECTED', 'only a review session can complete a review');
    }
    if (session.conceptId !== request.conceptId) {
      return errResult('INVALID_INPUT', 'session concept does not match the reviewed concept');
    }
    if (!isValidRfc3339Utc(request.completedAt)) {
      return errResult('INVALID_INPUT', 'completedAt must be RFC3339 UTC');
    }
    if (Date.parse(request.completedAt) < Date.parse(session.startedAt)) {
      return errResult('INVALID_INPUT', 'completedAt must not precede session.startedAt');
    }
    const key = {
      learnerId: this.learnerId,
      courseEditionId: session.courseEditionId,
      packVersion: session.packVersion,
      conceptId: request.conceptId,
    };
    const entry = this.projector.getEntry(key);
    const knownReview = this.projector.requestSeqOf(ctx.requestId);
    if (knownReview !== null) {
      const history = entry?.reviewHistory
        .filter((item) => item.kind === 'completed' && item.at === request.completedAt)
        .at(-1);
      return okResult(
        {
          progress: entry?.progress ?? this.progressFor(key),
          dueAt: entry?.progress.review.dueAt ?? dueAfterReview(this.policy, request.completedAt, 'needs_support'),
          outcome: entry?.progress.review.latestOutcome ?? 'needs_support',
          early: history?.early ?? false,
          previousDueAt: history?.previousDueAt ?? null,
          policyVersion: entry?.progress.review.policyVersion ?? this.policy.version,
          duplicate: true,
        },
        knownReview,
      );
    }
    if (session.status !== 'active') {
      return errResult(
        'CONTRACT_REJECTED',
        'REVIEW_SESSION_NOT_ACTIVE: only an active review session can be completed',
      );
    }
    const expectedOutcome =
      entry === null || entry.progress.understanding.state === 'unassessed'
        ? null
        : entry.progress.understanding.state;
    let outcome: ReviewOutcome;
    if (expectedOutcome !== null) {
      if (request.outcome !== undefined && request.outcome !== expectedOutcome) {
        return errResult(
          'CONTRACT_REJECTED',
          `REVIEW_OUTCOME_MISMATCH: explicit outcome ${request.outcome} differs from the latest assessment ${expectedOutcome}`,
        );
      }
      outcome = expectedOutcome;
    } else {
      /*
       * No current assessment is the normal state for a candidate content pack
       * (formal understanding must stay unassessed) and for evidence-only
       * rounds. Review completion must still work: `needs_support` is the
       * absence-of-support review outcome and is not a mastery claim, so it may
       * be recorded without an Assessment. `developing` needs current evidence
       * from this session; `supported` always needs an Assessment.
       */
      const requested: ReviewOutcome = request.outcome ?? 'needs_support';
      if (requested !== 'needs_support') {
        if (requested === 'supported') {
          return errResult(
            'CONTRACT_REJECTED',
            'REVIEW_OUTCOME_MISMATCH: supported requires an Assessment; a review activity cannot promote understanding',
          );
        }
        const sessionEvidence = (entry?.evidence ?? []).filter(
          (item) =>
            item.validity === 'current' &&
            [...this.projector.attempts.values()].some(
              (attempt) =>
                attempt.id === item.evidence.attemptId && attempt.sessionId === request.sessionId,
            ),
        );
        if (sessionEvidence.length === 0) {
          return errResult(
            'CONTRACT_REJECTED',
            `REVIEW_OUTCOME_UNEVIDENCED: outcome ${requested} needs current evidence from this review session`,
          );
        }
        const hasCounter = sessionEvidence.some(
          (item) =>
            item.coreMisconception ||
            (item.evidence.criterionResults.length > 0 &&
              item.evidence.criterionResults.every((result) => result.result !== 'met')),
        );
        const hasMet = sessionEvidence.some((item) =>
          item.evidence.criterionResults.some((result) => result.result === 'met'),
        );
        const ceiling: ReviewOutcome = hasCounter ? 'needs_support' : hasMet ? 'developing' : 'needs_support';
        if (ceiling !== 'developing') {
          return errResult(
            'CONTRACT_REJECTED',
            `REVIEW_OUTCOME_MISMATCH: outcome ${requested} is stronger than the current evidence allows (${ceiling})`,
          );
        }
      }
      outcome = requested;
    }
    const previousDueAt = entry?.progress.review.dueAt ?? null;
    const early =
      previousDueAt !== null && Date.parse(request.completedAt) < Date.parse(previousDueAt);
    const dueAt = dueAfterReview(this.policy, request.completedAt, outcome);
    const written = await this.append(ctx, {
      type: LEARNER_COMMAND_TYPES.reviewCompleted,
      payload: {
        sessionId: request.sessionId,
        conceptId: request.conceptId,
        outcome,
        completedAt: request.completedAt,
        early,
        previousDueAt,
        dueAt,
        policyVersion: this.policy.version,
      },
      effects: [{ kind: 'review.completed', targetId: request.conceptId, revision: 0 }],
    });
    if (!written.ok) return written;
    return okResult(
      {
        progress: this.progressFor(key),
        dueAt,
        outcome,
        early,
        previousDueAt,
        policyVersion: this.policy.version,
        duplicate: written.data.receipt.duplicate,
      },
      written.revision,
    );
  }

  async deferReview(
    ctx: RequestContext,
    request: {
      readonly conceptId: Id;
      readonly courseEditionId?: Id;
      readonly packVersion?: string;
      readonly reason?: string;
    },
  ): Promise<ServiceResult<ReviewDeferralResult>> {
    const ctxError = this.checkCtx(ctx);
    if (ctxError !== null) return { ok: false, error: ctxError };
    const entry = this.projector.findLatestEntry(
      request.conceptId,
      request.courseEditionId,
      request.packVersion,
    );
    if (entry === null) return errResult('NOT_FOUND', `no progress for concept ${request.conceptId}`);
    const knownRequest = this.projector.requestSeqOf(ctx.requestId);
    if (knownRequest !== null) {
      const currentDue = entry.progress.review.dueAt;
      if (currentDue === null) return errResult('CONFLICT', 'review is not scheduled');
      const deferral = [...entry.reviewHistory]
        .reverse()
        .find((item) => item.kind === 'deferred' && item.dueAt === currentDue);
      return okResult(
        {
          progress: entry.progress,
          previousDueAt: deferral?.previousDueAt ?? currentDue,
          newDueAt: currentDue,
          duplicate: true,
        },
        knownRequest,
      );
    }
    const dueAt = entry.progress.review.dueAt;
    if (dueAt === null) {
      return errResult('CONFLICT', 'this concept has no scheduled review to defer');
    }
    if (entry.deferralDueAt === dueAt) {
      return errResult(
        'CONFLICT',
        'a review can be deferred only once per due cycle; deferral already used',
      );
    }
    const newDueAt = deferDue(this.policy, dueAt);
    const written = await this.append(ctx, {
      type: LEARNER_COMMAND_TYPES.reviewDeferred,
      payload: {
        conceptId: entry.progress.conceptId,
        courseEditionId: entry.progress.courseEditionId,
        packVersion: entry.progress.packVersion,
        previousDueAt: dueAt,
        newDueAt,
        deferredAt: ctx.now,
        reason: request.reason ?? 'student_deferred_once',
        policyVersion: this.policy.version,
      },
      effects: [{ kind: 'review.deferred', targetId: entry.progress.conceptId, revision: 0 }],
    });
    if (!written.ok) return written;
    return okResult(
      {
        progress: this.projector.getEntry(entry.progress)?.progress ?? entry.progress,
        previousDueAt: dueAt,
        newDueAt,
        duplicate: written.data.receipt.duplicate,
      },
      written.revision,
    );
  }

  async reviewQueue(
    ctx: RequestContext,
    request: { readonly now?: Timestamp; readonly limit?: number } = {},
  ): Promise<ServiceResult<readonly ReviewQueueItem[]>> {
    const ctxError = this.checkCtx(ctx);
    if (ctxError !== null) return { ok: false, error: ctxError };
    let now: Timestamp;
    try {
      now = this.now(ctx, request.now);
    } catch (error) {
      return errResult('INVALID_INPUT', (error as Error).message);
    }
    const limit = request.limit ?? 50;
    if (!Number.isInteger(limit) || limit < 1 || limit > 500) {
      return errResult('INVALID_INPUT', 'limit must be an integer 1..500');
    }
    const byConcept = new Map<Id, ReviewQueueItem>();
    for (const entry of this.projector.entries()) {
      const progress = entry.progress;
      if (progress.learning.state !== 'completed') continue;
      if (trustModeOf(entry) === 'candidate') continue;
      const dueAt = progress.review.dueAt;
      if (dueAt === null || Date.parse(now) < Date.parse(dueAt)) continue;
      const item: ReviewQueueItem = {
        conceptId: progress.conceptId,
        courseEditionId: progress.courseEditionId,
        packVersion: progress.packVersion,
        dueAt,
        overdue: Date.parse(now) > Date.parse(dueAt),
        activeSessionId: progress.review.activeSessionId,
        latestOutcome: progress.review.latestOutcome,
        everReviewed: progress.review.lastCompletedAt !== null,
      };
      const existing = byConcept.get(progress.conceptId);
      if (
        existing === undefined ||
        Date.parse(item.dueAt) < Date.parse(existing.dueAt) ||
        (item.dueAt === existing.dueAt && item.packVersion > existing.packVersion)
      ) {
        byConcept.set(progress.conceptId, item);
      }
    }
    const queue = [...byConcept.values()].sort((left, right) => {
      const dueDiff = Date.parse(left.dueAt) - Date.parse(right.dueAt);
      if (dueDiff !== 0) return dueDiff;
      return left.conceptId < right.conceptId ? -1 : left.conceptId > right.conceptId ? 1 : 0;
    });
    return okResult(queue.slice(0, limit), this.revision());
  }

  /* -------------------------------------------------------------- self report */

  async recordSelfReport(ctx: RequestContext, selfReport: SelfReport): Promise<ServiceResult<SelfReportResult>> {
    const ctxError = this.checkCtx(ctx);
    if (ctxError !== null) return { ok: false, error: ctxError };
    const validation = validateSelfReport(selfReport);
    if (!validation.ok) {
      return errResult(
        'VALIDATION_FAILED',
        `self report rejected: ${validation.issues[0]?.message ?? 'unknown'}`,
      );
    }
    if (selfReport.learnerId !== this.learnerId) {
      return errResult('UNAUTHORIZED', 'self report belongs to another learner');
    }
    const progress = this.progressFor(selfReport);
    const rule = applySelfReportRule(progress, validation.value);
    if (!rule.ok) {
      return errResult(
        'VALIDATION_FAILED',
        `self report rejected: ${rule.issues[0]?.message ?? 'unknown'}`,
      );
    }
    const written = await this.append(ctx, {
      type: LEARNER_COMMAND_TYPES.selfReportRecorded,
      payload: { selfReport: validation.value },
      effects: [{ kind: 'self_report.recorded', targetId: selfReport.conceptId, revision: 0 }],
    });
    if (!written.ok) return written;
    return okResult(
      {
        progress: this.progressFor(selfReport),
        storedSeparately: true as const,
        diagnosticSuggested: true as const,
        selfReportId: selfReport.id,
        selfReportCount: this.projector.selfReports.length,
        duplicate: written.data.receipt.duplicate,
      },
      written.revision,
    );
  }

  async listSelfReports(
    ctx: RequestContext,
    filter: { readonly conceptId?: Id } = {},
  ): Promise<ServiceResult<readonly SelfReport[]>> {
    const ctxError = this.checkCtx(ctx);
    if (ctxError !== null) return { ok: false, error: ctxError };
    const reports = this.projector.selfReports.filter(
      (report) => filter.conceptId === undefined || report.conceptId === filter.conceptId,
    );
    return okResult(reports, this.revision());
  }

  /* --------------------------------------------------------------- first use */

  async declareLearnedScope(
    ctx: RequestContext,
    request: {
      readonly conceptIds: readonly Id[];
      readonly availableConceptIds: readonly Id[];
      readonly limit?: number;
    },
  ): Promise<ServiceResult<ScopeDeclarationResult>> {
    const ctxError = this.checkCtx(ctx);
    if (ctxError !== null) return { ok: false, error: ctxError };
    if (request.conceptIds.some((id) => !isOpaqueId(id))) {
      return errResult('INVALID_INPUT', 'conceptIds must be opaque ids');
    }
    let plan: FirstUsePlanView;
    try {
      plan = buildFirstUsePlan(request.conceptIds, request.availableConceptIds, request.limit ?? 5);
    } catch (error) {
      return errResult('INVALID_INPUT', (error as Error).message);
    }
    const written = await this.append(ctx, {
      type: LEARNER_COMMAND_TYPES.scopeDeclared,
      payload: {
        conceptIds: plan.declaredScope,
        declaredAt: ctx.now,
        source: 'first_use',
      },
      effects: [{ kind: 'scope.declared', targetId: this.learnerId, revision: 0 }],
    });
    if (!written.ok) return written;
    return okResult(
      { ...plan, declaredAt: ctx.now, duplicate: written.data.receipt.duplicate },
      written.revision,
    );
  }

  async completeDiagnostic(
    ctx: RequestContext,
    request: {
      readonly sessionId: Id;
      readonly testedConceptIds: readonly Id[];
      readonly skipped: boolean;
      readonly completedAt: Timestamp;
    },
  ): Promise<ServiceResult<{ readonly skipped: boolean; readonly duplicate: boolean }>> {
    const ctxError = this.checkCtx(ctx);
    if (ctxError !== null) return { ok: false, error: ctxError };
    const session = this.projector.sessions.get(request.sessionId);
    if (session === undefined) return errResult('NOT_FOUND', `no session ${request.sessionId}`);
    if (session.mode !== 'diagnostic') {
      return errResult('CONTRACT_REJECTED', 'diagnostic completion requires a diagnostic session');
    }
    if (!isValidRfc3339Utc(request.completedAt)) {
      return errResult('INVALID_INPUT', 'completedAt must be RFC3339 UTC');
    }
    const written = await this.append(ctx, {
      type: LEARNER_COMMAND_TYPES.diagnosticCompleted,
      payload: {
        sessionId: request.sessionId,
        testedConceptIds: [...new Set(request.testedConceptIds)],
        skipped: request.skipped,
        completedAt: request.completedAt,
      },
      effects: [{ kind: 'diagnostic.completed', targetId: request.sessionId, revision: 0 }],
    });
    if (!written.ok) return written;
    return okResult(
      { skipped: request.skipped, duplicate: written.data.receipt.duplicate },
      written.revision,
    );
  }

  /* --------------------------------------------------------------- evidence */

  async submitAttempt(ctx: RequestContext, attempt: import('@edu/domain').ActivityAttempt): Promise<ServiceResult<SubmitAttemptResult>> {
    const ctxError = this.checkCtx(ctx);
    if (ctxError !== null) return { ok: false, error: ctxError };
    const validation = validateActivityAttempt(attempt);
    if (!validation.ok) {
      return errResult(
        'VALIDATION_FAILED',
        `attempt rejected: ${validation.issues[0]?.message ?? 'unknown'}`,
      );
    }
    if (attempt.learnerId !== this.learnerId) {
      return errResult('UNAUTHORIZED', 'attempt belongs to another learner');
    }
    const existing = this.projector.attempts.get(attempt.id);
    if (existing !== undefined) {
      const priorRequest = this.projector.attemptRequestIdOf(attempt.id);
      if (priorRequest === ctx.requestId) {
        const seq = this.projector.requestSeqOf(ctx.requestId) ?? this.revision();
        return okResult({ attemptId: attempt.id, seq, duplicate: true }, seq);
      }
      return errResult(
        'CONFLICT',
        'attempt was already saved; retry grading for that attempt instead of creating a new answer',
      );
    }
    const written = await this.append(ctx, {
      type: LEARNER_COMMAND_TYPES.attemptSubmitted,
      payload: { attempt: validation.value, feedback: { state: 'pending' } },
      effects: [{ kind: 'attempt.pending', targetId: attempt.id, revision: 0 }],
    });
    if (!written.ok) return written;
    return okResult(
      {
        attemptId: attempt.id,
        seq: written.data.receipt.seq,
        duplicate: written.data.receipt.duplicate,
      },
      written.revision,
    );
  }

  async cancelAttemptGrading(
    ctx: RequestContext,
    request: {
      readonly attemptId: Id;
      readonly graderVersion: string;
      readonly revision: number;
      readonly reason: string;
      readonly cancelled: boolean;
    },
  ): Promise<ServiceResult<{ readonly attemptId: Id; readonly duplicate: boolean; readonly phase: string }>> {
    const ctxError = this.checkCtx(ctx);
    if (ctxError !== null) return { ok: false, error: ctxError };
    const receipt = request.cancelled
      ? await this.storage.attempts.cancelAssessment(ctx, {
          attemptId: request.attemptId,
          graderVersion: request.graderVersion,
          revision: request.revision,
          reason: request.reason,
        })
      : await this.storage.attempts.failAssessment(ctx, {
          attemptId: request.attemptId,
          graderVersion: request.graderVersion,
          revision: request.revision,
          reason: request.reason,
        });
    if (!receipt.ok) return receipt;
    if (!receipt.data.duplicate) {
      this.projector.apply({
        schemaVersion: 1,
        eventId: `event.storage.${receipt.data.seq}`,
        requestId: ctx.requestId,
        seq: receipt.data.seq,
        occurredAt: ctx.now,
        learnerId: this.learnerId,
        type: request.cancelled
          ? LEARNER_COMMAND_TYPES.assessmentCancelled
          : LEARNER_COMMAND_TYPES.assessmentFailed,
        payload: {
          attemptId: request.attemptId,
          graderVersion: request.graderVersion,
          revision: request.revision,
          reason: request.reason,
        },
        effects: [],
      });
    }
    return okResult(
      {
        attemptId: request.attemptId,
        duplicate: receipt.data.duplicate,
        phase: receipt.data.phase,
      },
      receipt.revision,
    );
  }

  /**
   * Record the evidence of a graded attempt and, when the evidence supports a
   * judgement, commit Assessment + Evidence + progress effects in one journal
   * line (05 §7). Evidence-only paths keep low-confidence/assisted/unassessed
   * cases from changing the understanding state.
   */
  async recordGradedAttempt(
    ctx: RequestContext,
    request: {
      readonly attemptId: Id;
      readonly evidence: readonly Evidence[];
      readonly rubricVersion: string;
      readonly evaluatorVersion: string;
      readonly coreMisconceptionEvidenceIds?: readonly Id[];
    },
  ): Promise<ServiceResult<readonly AssessmentOutcome[]>> {
    const ctxError = this.checkCtx(ctx);
    if (ctxError !== null) return { ok: false, error: ctxError };
    const attempt = this.projector.attempts.get(request.attemptId);
    if (attempt === undefined) {
      return errResult('NOT_FOUND', `no saved attempt ${request.attemptId}`);
    }
    const session = this.projector.sessions.get(attempt.sessionId);
    if (session === undefined) {
      return errResult(
        'CONTRACT_REJECTED',
        'attempt grading requires the session to be started first',
      );
    }
    const attemptState = await this.storage.attempts.getState(ctx, request.attemptId);
    if (!attemptState.ok) return attemptState;
    if (attemptState.data.phase === 'assessment_cancelled') {
      return errResult(
        'CONTRACT_REJECTED',
        'a cancelled grading request must not publish a late assessment',
      );
    }
    if (request.evidence.length === 0) {
      return errResult('VALIDATION_FAILED', 'at least one evidence record is required');
    }
    if (!/^[A-Za-z0-9][A-Za-z0-9._:+-]{0,63}$/.test(request.rubricVersion)) {
      return errResult('INVALID_INPUT', 'rubricVersion has an invalid shape');
    }
    if (!/^[A-Za-z0-9][A-Za-z0-9._:+-]{0,63}$/.test(request.evaluatorVersion)) {
      return errResult('INVALID_INPUT', 'evaluatorVersion has an invalid shape');
    }
    const normalized: Evidence[] = [];
    const answerDisclosedIds: Id[] = [];
    const coreIds = [...new Set(request.coreMisconceptionEvidenceIds ?? [])];
    const independence = roundIndependence(attempt);
    for (const evidence of request.evidence) {
      let validation = validateEvidence(evidence);
      if (!validation.ok) {
        return errResult(
          'VALIDATION_FAILED',
          `evidence rejected: ${validation.issues[0]?.message ?? 'unknown'}`,
        );
      }
      const againstAttempt = checkEvidenceAgainstAttempt(validation.value, attempt);
      if (!againstAttempt.ok) {
        return errResult(
          'VALIDATION_FAILED',
          `evidence does not match its attempt: ${againstAttempt.issues[0]?.message ?? 'unknown'}`,
        );
      }
      if (!attempt.conceptIds.includes(validation.value.conceptId)) {
        return errResult('INVALID_INPUT', 'evidence concept is not part of the submitted activity');
      }
      const withPending = normalizeCommittedEvidence(validation.value);
      if (withPending.validity === 'stale' || withPending.validity === 'needs_recheck') {
        return errResult('INVALID_INPUT', 'new evidence cannot be committed already stale');
      }
      validation = validateEvidence(withPending);
      if (!validation.ok) {
        return errResult(
          'VALIDATION_FAILED',
          `evidence rejected after normalization: ${validation.issues[0]?.message ?? 'unknown'}`,
        );
      }
      normalized.push(validation.value);
      if (independence.answerDisclosed) answerDisclosedIds.push(validation.value.id);
    }

    const byConcept = new Map<Id, Evidence[]>();
    for (const evidence of normalized) {
      const list = byConcept.get(evidence.conceptId) ?? [];
      list.push(evidence);
      byConcept.set(evidence.conceptId, list);
    }

    const outcomes: AssessmentOutcome[] = [];
    for (const [conceptId, newEvidence] of [...byConcept.entries()].sort(([a], [b]) =>
      a < b ? -1 : a > b ? 1 : 0,
    )) {
      const key = {
        learnerId: this.learnerId,
        courseEditionId: attempt.courseEditionId,
        packVersion: attempt.packVersion,
        conceptId,
      };
      const entry = this.projector.getEntry(key);
      if (entry === null) {
        return errResult(
          'CONTRACT_REJECTED',
          `no projection entry for concept ${conceptId}; start the session before grading`,
        );
      }
      const trustMode: TrustMode = entry.trustModeSeen.has('published')
        ? 'published'
        : entry.trustModeSeen.has('candidate')
          ? 'candidate'
          : 'published';
      const baseRequestId = ctx.requestId;
      const knownAssessmentRequest = this.projector.requestSeqOf(
        `${baseRequestId}:${conceptId}:assessment`,
      );
      const knownEvidenceRequest = this.projector.requestSeqOf(
        `${baseRequestId}:${conceptId}:evidence`,
      );
      if (knownAssessmentRequest !== null || knownEvidenceRequest !== null) {
        const latest = [...entry.assessments]
          .reverse()
          .find((item) => item.assessment.id === entry.progress.understanding.assessmentId)
          ?.assessment;
        outcomes.push({
          conceptId,
          kind: latest === undefined ? 'evidence_only' : 'assessment',
          progress: entry.progress,
          assessment: latest ?? null,
          committedEvidenceIds:
            latest?.evidenceIds ?? entry.evidence.map((item) => item.evidence.id),
          pendingEvidenceIds: entry.evidence
            .filter((item) => item.validity === 'pending')
            .map((item) => item.evidence.id),
          derivedState: entry.progress.understanding.state,
          rationale: latest === undefined ? [] : latest.rationale.split('; '),
          rubricVersion: latest?.rubricVersion ?? request.rubricVersion,
          evaluatorVersion: latest?.evaluatorVersion ?? request.evaluatorVersion,
          duplicate: true,
        });
        continue;
      }
      const priorCore = entry.evidence
        .filter((item) => item.coreMisconception)
        .map((item) => item.evidence.id);
      const priorAnswer = entry.evidence
        .filter((item) => item.answerDisclosed)
        .map((item) => item.evidence.id);
      const combined: EffectiveEvidence[] = entry.evidence.map((item) => ({ ...item }));
      for (const evidence of newEvidence) {
        combined.push({
          evidence,
          validity: evidence.validity,
          staledAt: null,
          coreMisconception: coreIds.includes(evidence.id),
          answerDisclosed:
            answerDisclosedIds.includes(evidence.id) || independence.answerDisclosed,
        });
      }
      const derivation = deriveConceptUnderstanding({
        conceptId,
        rubricVersion: request.rubricVersion,
        trustMode,
        evidences: combined,
        attempts: this.projector.attempts,
        coreMisconceptionEvidenceIds: [...new Set([...priorCore, ...coreIds])],
      });
      const stateChanged =
        entry.progress.understanding.state !== derivation.derivation.state;
      const newCurrentIndependent = newEvidence.some(
        (evidence) =>
          derivation.currentEvidenceIds.includes(evidence.id) && independence.independent,
      );
      if (
        trustMode === 'candidate' ||
        derivation.derivation.state === 'unassessed' ||
        (!stateChanged && !newCurrentIndependent)
      ) {
        const written = await this.append(ctx, {
          requestId: `${baseRequestId}:${conceptId}:evidence`,
          type: LEARNER_COMMAND_TYPES.evidenceRecorded,
          payload: {
            evidence: newEvidence,
            coreMisconceptionEvidenceIds: coreIds.filter((id) =>
              newEvidence.some((evidence) => evidence.id === id),
            ),
            answerDisclosedEvidenceIds: answerDisclosedIds,
            trustMode,
          },
          effects: [],
        });
        if (!written.ok) return written;
        outcomes.push({
          conceptId,
          kind: 'evidence_only',
          progress: this.progressFor(key),
          assessment: null,
          committedEvidenceIds: newEvidence.map((evidence) => evidence.id),
          pendingEvidenceIds: derivation.pendingEvidenceIds,
          derivedState: derivation.derivation.state,
          rationale: derivation.derivation.rationale,
          rubricVersion: request.rubricVersion,
          evaluatorVersion: request.evaluatorVersion,
          duplicate: written.data.receipt.duplicate,
        });
        continue;
      }

      const currentEvidenceIds = derivation.currentEvidenceIds;
      const committedEvidence = combined
        .filter((item) => currentEvidenceIds.includes(item.evidence.id))
        .map((item) => item.evidence);
      if (committedEvidence.length === 0) {
        return errResult('CONTRACT_REJECTED', 'derived assessment has no current evidence');
      }
      const newCurrent = newEvidence.find((evidence) => currentEvidenceIds.includes(evidence.id));
      const attemptId =
        newCurrent?.attemptId ?? committedEvidence[committedEvidence.length - 1]?.attemptId;
      if (attemptId === undefined) {
        return errResult('CONTRACT_REJECTED', 'derived assessment has no attempt binding');
      }
      const rationale = assessmentRationale(derivation.derivation, {
        pendingCount: derivation.pendingEvidenceIds.length,
        counterCount: derivation.counterEvidenceIds.length,
        trustMode,
        rubricVersion: request.rubricVersion,
      });
      const assessment = buildAssessment({
        conceptId,
        learnerId: this.learnerId,
        courseEditionId: attempt.courseEditionId,
        packVersion: attempt.packVersion,
        state: derivation.derivation.state,
        rationale,
        evidenceIds: currentEvidenceIds,
        attemptId,
        rubricVersion: request.rubricVersion,
        evaluatorVersion: request.evaluatorVersion,
        assessedAt: this.now(ctx),
        revision: entry.assessments.length,
        validity: derivation.derivation.requiresRecheck ? 'needs_recheck' : 'current',
        ids: this.ids,
      });
      const evidenceCheck = validateAssessmentWithEvidence(assessment, {
        evidences: combined.map((item) => ({ ...item.evidence, validity: item.validity })),
        attempts: [...this.projector.attempts.values()],
      });
      if (!evidenceCheck.ok) {
        return errResult(
          'VALIDATION_FAILED',
          `assessment rejected: ${evidenceCheck.issues[0]?.message ?? 'unknown'}`,
        );
      }
      const sessionCheck = validateAssessmentForSession(assessment, session);
      if (!sessionCheck.ok) {
        return errResult(
          'VALIDATION_FAILED',
          `assessment rejected for session: ${sessionCheck.issues[0]?.message ?? 'unknown'}`,
        );
      }
      const assessmentRequestId = `${baseRequestId}:${conceptId}:assessment`;
      const assessmentCtx = this.commandCtx(ctx, assessmentRequestId, ctx.now);
      const receipt = await this.storage.attempts.commitAssessment(assessmentCtx, {
        assessment,
        evidence: committedEvidence,
        effects: [
          {
            kind: 'understanding.updated',
            targetId: conceptId,
            revision: assessment.revision,
          },
        ],
        graderVersion: request.evaluatorVersion,
      });
      if (!receipt.ok) return receipt;
      if (!receipt.data.duplicate) {
        this.projector.apply({
          schemaVersion: 1,
          eventId: `event.storage.${receipt.data.seq}`,
          requestId: assessmentRequestId,
          seq: receipt.data.seq,
          occurredAt: ctx.now,
          learnerId: this.learnerId,
          type: LEARNER_COMMAND_TYPES.assessmentCommitted,
          payload: {
            assessment,
            evidence: committedEvidence,
            graderVersion: request.evaluatorVersion,
            dedupeKey: receipt.data.dedupeKey,
            coreMisconceptionEvidenceIds: coreIds,
            answerDisclosedEvidenceIds: answerDisclosedIds,
          },
          effects: [],
        });
      }
      const pendingNew = newEvidence.filter(
        (evidence) =>
          derivation.pendingEvidenceIds.includes(evidence.id) &&
          !currentEvidenceIds.includes(evidence.id),
      );
      if (pendingNew.length > 0) {
        const pendingWritten = await this.append(ctx, {
          requestId: `${baseRequestId}:${conceptId}:pending`,
          type: LEARNER_COMMAND_TYPES.evidenceRecorded,
          payload: {
            evidence: pendingNew,
            coreMisconceptionEvidenceIds: coreIds.filter((id) =>
              pendingNew.some((evidence) => evidence.id === id),
            ),
            answerDisclosedEvidenceIds: answerDisclosedIds,
            trustMode,
          },
          effects: [],
        });
        if (!pendingWritten.ok) return pendingWritten;
      }
      outcomes.push({
        conceptId,
        kind: 'assessment',
        progress: this.progressFor(key),
        assessment,
        committedEvidenceIds: committedEvidence.map((evidence) => evidence.id),
        pendingEvidenceIds: pendingNew.map((evidence) => evidence.id),
        derivedState: derivation.derivation.state,
        rationale,
        rubricVersion: request.rubricVersion,
        evaluatorVersion: request.evaluatorVersion,
        duplicate: receipt.data.duplicate,
      });
    }
    return okResult(outcomes, this.revision());
  }

  /* ------------------------------------------------------------- explanation */

  async explain(
    ctx: RequestContext,
    key: { readonly conceptId: Id; readonly courseEditionId?: Id; readonly packVersion?: string },
  ): Promise<ServiceResult<UnderstandingExplanation>> {
    const ctxError = this.checkCtx(ctx);
    if (ctxError !== null) return { ok: false, error: ctxError };
    const entry = this.projector.findLatestEntry(
      key.conceptId,
      key.courseEditionId,
      key.packVersion,
    );
    if (entry === null) return errResult('NOT_FOUND', `no progress for concept ${key.conceptId}`);
    const latest = [...entry.assessments]
      .filter((item) => item.assessment.id === entry.progress.understanding.assessmentId)
      .at(-1);
    const review = projectReview(entry.progress.review, ctx.now);
    const explanation: UnderstandingExplanation = {
      progress: entry.progress,
      state: entry.progress.understanding.state,
      validity: entry.progress.understanding.validity,
      assessmentId: entry.progress.understanding.assessmentId,
      updatedAt: entry.progress.understanding.updatedAt,
      rationale: latest?.assessment.rationale ?? '',
      rubricVersion: latest?.assessment.rubricVersion ?? null,
      evaluatorVersion: latest?.assessment.evaluatorVersion ?? null,
      assessedAt: latest?.assessment.assessedAt ?? null,
      evidence: entry.evidence.map((item) => this.explainEvidence(item)),
      history: entry.assessments.map((item) => this.explainHistory(item)),
      pendingEvidenceIds: entry.evidence
        .filter((item) => item.validity === 'pending')
        .map((item) => item.evidence.id),
      counterEvidenceIds: entry.evidence
        .filter((item) => this.isIndependentCounterEvidence(item))
        .map((item) => item.evidence.id),
      stale: entry.evidence.some(
        (item) => item.validity === 'stale' || item.validity === 'needs_recheck',
      ),
      requiresRecheck: entry.assessments.some(
        (item) => item.validity === 'needs_recheck' || item.validity === 'stale',
      ),
      review: {
        dueAt: entry.progress.review.dueAt,
        everReviewed: review.everReviewed,
        isDue: review.isDue,
      },
      historyInherited: entry.historyInherited,
      trustMode: entry.trustModeSeen.has('candidate') && !entry.trustModeSeen.has('published')
        ? 'candidate'
        : 'published',
      policyNote: REVIEW_POLICY_NOTE,
    };
    return okResult(explanation, entry.progress.revision);
  }

  /**
   * A counter evidence item can only demote understanding when it is current,
   * independent and not given after disclosure (REVIEW-01 H-01 / 05 §3.2).
   */
  private isIndependentCounterEvidence(item: EffectiveEvidence): boolean {
    if (item.validity !== 'current') return false;
    const attempt = this.projector.attempts.get(item.evidence.attemptId);
    if (attempt === undefined) return false;
    if (item.evidence.assistance !== 'unassisted' || item.answerDisclosed) return false;
    if (!roundIndependence(attempt).independent) return false;
    return (
      item.coreMisconception ||
      (item.evidence.criterionResults.length > 0 &&
        item.evidence.criterionResults.every((result) => result.result === 'not_met'))
    );
  }

  private explainEvidence(item: EffectiveEvidence): EvidenceExplanationItem {    return {
      evidenceId: item.evidence.id,
      attemptId: item.evidence.attemptId,
      kind: item.evidence.kind,
      observation: item.evidence.observation,
      criterionResults: item.evidence.criterionResults,
      assistance: item.evidence.assistance,
      answerDisclosed: item.answerDisclosed,
      coreMisconception: item.coreMisconception,
      validity: item.validity,
      createdAt: item.evidence.createdAt,
    };
  }

  private explainHistory(item: EffectiveAssessment): AssessmentHistoryItem {
    return {
      assessmentId: item.assessment.id,
      state: item.assessment.state,
      validity: item.validity,
      assessedAt: item.assessment.assessedAt,
      rationale: item.assessment.rationale,
      evidenceIds: item.assessment.evidenceIds,
      rubricVersion: item.assessment.rubricVersion,
      evaluatorVersion: item.assessment.evaluatorVersion,
      staledAt: item.staledAt,
    };
  }

  /* ------------------------------------------------------------ aggregates */

  async aggregate(ctx: RequestContext, input: AggregateInput): Promise<ServiceResult<AggregateResult>> {
    const ctxError = this.checkCtx(ctx);
    if (ctxError !== null) return { ok: false, error: ctxError };
    let now: Timestamp;
    try {
      now = this.now(ctx, input.now);
    } catch (error) {
      return errResult('INVALID_INPUT', (error as Error).message);
    }
    const view: AggregateView = aggregateEntries(this.projector.entries(), {
      availableConceptIds: input.availableConceptIds,
      candidateConceptIds: input.candidateConceptIds,
      now,
    });
    return okResult(
      {
        availableTotal: view.availableTotal,
        learnedCount: view.learnedCount,
        inProgressCount: view.inProgressCount,
        dueCount: view.dueCount,
        needsSupportCount: view.needsSupportCount,
        candidateCount: view.candidateCount,
        candidateConceptIds: view.candidateConceptIds,
        activityCoverage: view.activityCoverage,
        concepts: view.concepts.map(
          (concept): AggregateConcept => ({
            conceptId: concept.conceptId,
            courseEditionId: concept.courseEditionId,
            packVersion: concept.packVersion,
            learning: concept.learning,
            understanding: concept.understanding,
            reviewDue: concept.reviewDue,
            dueAt: concept.dueAt,
            trustMode: concept.trustMode,
            historyInherited: concept.historyInherited,
          }),
        ),
        policyNote: view.policyNote,
      },
      this.revision(),
    );
  }

  async firstUsePlan(
    ctx: RequestContext,
    request: { readonly declaredConceptIds: readonly Id[]; readonly availableConceptIds: readonly Id[]; readonly limit?: number },
  ): Promise<ServiceResult<FirstUsePlan>> {
    const ctxError = this.checkCtx(ctx);
    if (ctxError !== null) return { ok: false, error: ctxError };
    try {
      return okResult(
        buildFirstUsePlan(request.declaredConceptIds, request.availableConceptIds, request.limit ?? 5),
        this.revision(),
      );
    } catch (error) {
      return errResult('INVALID_INPUT', (error as Error).message);
    }
  }

  /* ---------------------------------------------------------- time validity */

  async refreshValidity(
    ctx: RequestContext,
    request: { readonly now?: Timestamp } = {},
  ): Promise<ServiceResult<ValidityRefreshResult>> {
    const ctxError = this.checkCtx(ctx);
    if (ctxError !== null) return { ok: false, error: ctxError };
    let now: Timestamp;
    try {
      now = this.now(ctx, request.now);
    } catch (error) {
      return errResult('INVALID_INPUT', (error as Error).message);
    }
    const staledConceptIds: Id[] = [];
    for (const entry of this.projector.entries()) {
      const assessed = entry.assessments.filter((item) => item.validity === 'current');
      if (assessed.length === 0) continue;
      const assessmentIds = assessed.map((item) => item.assessment.id);
      const evidenceIds = entry.evidence
        .filter((item) => item.validity === 'current')
        .map((item) => item.evidence.id);
      const assessedAt = assessed[assessed.length - 1]?.assessment.assessedAt;
      if (assessedAt === undefined || !isStaleByAge(this.policy, assessedAt, now)) continue;
      const written = await this.append(ctx, {
        requestId: `${ctx.requestId}:${entry.progress.conceptId}:stale`,
        occurredAt: now,
        type: LEARNER_COMMAND_TYPES.evidenceStaled,
        payload: {
          conceptId: entry.progress.conceptId,
          courseEditionId: entry.progress.courseEditionId,
          packVersion: entry.progress.packVersion,
          assessmentIds,
          evidenceIds,
          staledAt: now,
          reason: 'time_elapsed_validity_refresh_not_forgetting',
          policyVersion: this.policy.version,
        },
        effects: [
          {
            kind: 'evidence.staled',
            targetId: entry.progress.conceptId,
            revision: entry.progress.revision + 1,
          },
        ],
      });
      if (!written.ok) return written;
      if (!written.data.receipt.duplicate) staledConceptIds.push(entry.progress.conceptId);
    }
    const staleSet = new Set(staledConceptIds);
    return okResult(
      {
        staledConceptIds,
        progress: this.projector
          .entries()
          .filter((entry) => staleSet.has(entry.progress.conceptId))
          .map((entry) => entry.progress),
        duplicate: staledConceptIds.length === 0,
      },
      this.revision(),
    );
  }

  /* -------------------------------------------------------- compatibility */

  async applyCompatibilityMap(
    ctx: RequestContext,
    map: import('@edu/domain').CompatibilityMap,
  ): Promise<ServiceResult<CompatibilityApplyResult>> {
    const ctxError = this.checkCtx(ctx);
    if (ctxError !== null) return { ok: false, error: ctxError };
    const existing = this.projector.compatibility.find((item) => item.mapId === map.id);
    if (existing !== undefined) {
      const known = this.projector.requestSeqOf(ctx.requestId);
      if (known !== null) {
        return okResult(
          {
            mapId: existing.mapId,
            fromPackVersion: existing.fromPackVersion,
            toPackVersion: existing.toPackVersion,
            newConceptIds: existing.toConceptIds,
            inheritedConceptIds: existing.inheritedConceptIds,
            evidenceEffects: existing.evidenceEffects.map((effect) => ({ ...effect })),
            duplicate: true,
          },
          known,
        );
      }
      return errResult('CONFLICT', `compatibility map ${map.id} was already applied`);
    }
    let plan: CompatibilityPlan;
    try {
      plan = planCompatibility(this.projector.entries(), map, this.policy.version, this.learnerId);
    } catch (error) {
      return errResult('VALIDATION_FAILED', (error as Error).message);
    }
    const written = await this.append(ctx, {
      type: LEARNER_COMMAND_TYPES.compatibilityApplied,
      payload: {
        map,
        newEntries: plan.newEntries,
        evidenceEffects: plan.evidenceEffects,
        inheritedConceptIds: plan.inheritedConceptIds,
        createdAt: ctx.now,
      },
      effects: [{ kind: 'progress.compatibility_applied', targetId: map.id, revision: 0 }],
    });
    if (!written.ok) return written;
    return okResult(
      {
        mapId: map.id,
        fromPackVersion: map.fromPackVersion,
        toPackVersion: map.toPackVersion,
        newConceptIds: plan.newEntries.map((entry) => entry.conceptId),
        inheritedConceptIds: plan.inheritedConceptIds,
        evidenceEffects: plan.evidenceEffects.map((effect) => ({ ...effect })),
        duplicate: written.data.receipt.duplicate,
      },
      written.revision,
    );
  }

  /* -------------------------------------------------------------- port API */

  async get(ctx: RequestContext, key: ProgressKey): Promise<ServiceResult<ConceptProgress>> {
    const ctxError = this.checkCtx(ctx);
    if (ctxError !== null) return { ok: false, error: ctxError };
    if (key.learnerId !== this.learnerId) {
      return errResult('UNAUTHORIZED', 'key belongs to another learner');
    }
    return okResult(this.progressFor(key), this.revision());
  }

  async list(
    ctx: RequestContext,
    key: {
      readonly learnerId: Id;
      readonly courseEditionId: Id;
      readonly packVersion: string;
      readonly conceptIds?: readonly Id[];
    },
  ): Promise<ServiceResult<readonly ConceptProgress[]>> {
    const ctxError = this.checkCtx(ctx);
    if (ctxError !== null) return { ok: false, error: ctxError };
    if (key.learnerId !== this.learnerId) {
      return errResult('UNAUTHORIZED', 'key belongs to another learner');
    }
    const entries = this.projector.listEntries({
      courseEditionId: key.courseEditionId,
      packVersion: key.packVersion,
      conceptIds: key.conceptIds,
    });
    return okResult(entries.map((entry) => entry.progress), this.revision());
  }

  async applyAssessment(
    ctx: RequestContext,
    request: { readonly assessment: Assessment; readonly evidence: readonly Evidence[] },
  ): Promise<ServiceResult<ProgressWriteReceipt>> {
    const ctxError = this.checkCtx(ctx);
    if (ctxError !== null) return { ok: false, error: ctxError };
    const validation = validateAssessment(request.assessment);
    if (!validation.ok) {
      return errResult(
        'VALIDATION_FAILED',
        `assessment rejected: ${validation.issues[0]?.message ?? 'unknown'}`,
      );
    }
    if (request.assessment.learnerId !== this.learnerId) {
      return errResult('UNAUTHORIZED', 'assessment belongs to another learner');
    }
    const evidenceCheck = validateAssessmentWithEvidence(validation.value, {
      evidences: request.evidence,
      attempts: [...this.projector.attempts.values()],
    });
    if (!evidenceCheck.ok) {
      return errResult(
        'VALIDATION_FAILED',
        `assessment rejected: ${evidenceCheck.issues[0]?.message ?? 'unknown'}`,
      );
    }
    const receipt = await this.storage.attempts.commitAssessment(ctx, {
      assessment: validation.value,
      evidence: request.evidence,
      effects: [
        {
          kind: 'understanding.updated',
          targetId: validation.value.conceptId,
          revision: validation.value.revision,
        },
      ],
      graderVersion: validation.value.evaluatorVersion,
    });
    if (!receipt.ok) return receipt;
    if (!receipt.data.duplicate) {
      this.projector.apply({
        schemaVersion: 1,
        eventId: `event.storage.${receipt.data.seq}`,
        requestId: ctx.requestId,
        seq: receipt.data.seq,
        occurredAt: ctx.now,
        learnerId: this.learnerId,
        type: LEARNER_COMMAND_TYPES.assessmentCommitted,
        payload: {
          assessment: validation.value,
          evidence: request.evidence,
          graderVersion: validation.value.evaluatorVersion,
          dedupeKey: receipt.data.dedupeKey,
        },
        effects: [],
      });
    }
    const key = {
      learnerId: this.learnerId,
      courseEditionId: validation.value.courseEditionId,
      packVersion: validation.value.packVersion,
      conceptId: validation.value.conceptId,
    };
    const entry = this.projector.getEntry(key);
    if (entry === null) {
      return errResult('CONTRACT_REJECTED', 'assessment did not produce a projection entry');
    }
    return okResult(
      { progress: entry.progress, revision: entry.progress.revision },
      receipt.revision,
    );
  }

  async applySelfReport(
    ctx: RequestContext,
    request: { readonly selfReport: SelfReport },
  ): Promise<ServiceResult<{ readonly progress: ConceptProgress; readonly diagnosticSuggested: boolean }>> {
    const result = await this.recordSelfReport(ctx, request.selfReport);
    if (!result.ok) return result;
    return okResult(
      { progress: result.data.progress, diagnosticSuggested: result.data.diagnosticSuggested },
      result.revision,
    );
  }

  async dueReview(
    ctx: RequestContext,
    request: { readonly learnerId: Id; readonly now: Timestamp; readonly limit: number },
  ): Promise<ServiceResult<readonly ConceptProgress[]>> {
    if (request.learnerId !== this.learnerId) {
      return errResult('UNAUTHORIZED', 'due review request belongs to another learner');
    }
    const queue = await this.reviewQueue(ctx, { now: request.now, limit: request.limit });
    if (!queue.ok) return queue;
    const progress = queue.data
      .map((item) =>
        this.projector.getEntry({
          learnerId: this.learnerId,
          courseEditionId: item.courseEditionId,
          packVersion: item.packVersion,
          conceptId: item.conceptId,
        }),
      )
      .filter((entry): entry is ConceptEntry => entry !== null)
      .map((entry) => entry.progress);
    return okResult(progress, this.revision());
  }

  /* ------------------------------------------------------------- diagnostics */

  async compareReplay(
    ctx: RequestContext,
  ): Promise<ServiceResult<ReplayComparison>> {
    const ctxError = this.checkCtx(ctx);
    if (ctxError !== null) return { ok: false, error: ctxError };
    const read = await LearnerService.readAll(this.storage, {
      requestId: `${REPLAY_REQUEST_ID}.compare`,
      learnerId: this.learnerId,
      now: this.clock.now(),
    });
    if (!read.ok) return read;
    const replayed = new LearnerProjector(this.learnerId, this.policy.version);
    for (const command of read.data.commits) replayed.apply(command);
    const live = JSON.stringify(this.progressList());
    const fromJournal = JSON.stringify(replayed.listEntries().map((entry) => entry.progress));
    return okResult(
      {
        learnerId: this.learnerId,
        live: this.progressList(),
        replayed: replayed.listEntries().map((entry) => entry.progress),
        identical: live === fromJournal,
        journalCommits: read.data.commits.length,
        invalidPayloads: replayed.invalidPayloads,
      },
      read.data.lastSeq,
    );
  }

  /** Convenience view carrying the review/learning axes and policy description. */
  get policyVersion(): string {
    return this.policy.version;
  }

  get timeZone(): string {
    return this.policy.timeZone;
  }

  describeReviewPolicy(): Record<string, unknown> {
    return {
      version: this.policy.version,
      timeZone: this.policy.timeZone,
      reviewLocalTime: this.policy.reviewLocalTime,
      firstReviewDays: this.policy.firstReviewDays,
      intervals: this.policy.intervals,
      staleAfterDays: this.policy.staleAfterDays,
      heuristicNote: REVIEW_POLICY_HEURISTIC_NOTE,
    };
  }

  /** Human readable next review text used by tests/report; never persisted. */
  describeDue(dueAt: Timestamp): string {
    return formatLocalDateTime(parseInstant(dueAt), this.policy.timeZone);
  }

  /** Exposed for integration checks; projections remain event derived. */
  get projectionEntries(): readonly ConceptEntry[] {
    return this.projector.entries();
  }

  /** Self reports are a separate store; never merged into ConceptProgress. */
  get selfReports(): readonly SelfReport[] {
    return this.projector.selfReports;
  }

  get scopeDeclarations(): readonly import('./projection.js').ScopeDeclaration[] {
    return this.projector.scopeDeclarations;
  }

  get diagnostics(): readonly import('./projection.js').DiagnosticRecord[] {
    return this.projector.diagnostics;
  }

  get appliedCompatibility(): readonly import('./projection.js').AppliedCompatibility[] {
    return this.projector.compatibility;
  }

  /** Timestamp helper for report/diagnostic code. */
  canonicalNow(): Timestamp {
    return toRfc3339Utc(parseInstant(this.clock.now()));
  }
}
