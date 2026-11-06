/**
 * Teaching orchestration service (T07 card steps 1–5).
 *
 * One service owns the learn/review session lifecycle:
 *   - session start binds content + learner + model gateway (mock or DSH);
 *   - each turn persists a submitted answer first, grades it, guards the
 *     model's evidence candidates and only then commits evidence;
 *   - the pedagogical decision is deterministic and explainable, and the
 *     student-facing message always states sources and disclosure honestly;
 *   - skip / end / cancel / timeout are explicit paths that never fake
 *     completion and never commit a late result;
 *   - the same service backs the education tool registry (no second agent
 *     loop, no direct model writes).
 */

import type {
  Activity,
  AttemptInputType,
  Clock,
  Concept,
  ContentPack,
  HelpKind,
  Id,
  IdGenerator,
  ModelDescriptor,
  PackKey,
  RequestContext,
  Rubric,
  ServiceResult,
  Session,
  Timestamp,
} from '@edu/domain';
import { errResult, okResult } from '@edu/domain';
import { roundIndependence } from '@edu/learner';
import type { UnderstandingExplanation } from '@edu/learner';
import { buildAttemptDigest, buildReferenceAnswer, buildTutorContext } from './context.js';
import type { TutorAttemptDigest } from './context.js';
import { errorFromThrown, fromServiceError, isCancelled, tutorError, TutorException } from './errors.js';
import { createEducationToolRegistry, type EducationToolRegistry } from './tools.js';
import {
  activityTypesForStage,
  composeStudentMessage,
  decidePedagogy,
  detectExplicitAnswerRequest,
  helpKindsForAction,
  readTutorSignals,
  reviewStageOfAction,
  summarizeGrade,
  withAnswerDisclosure,
  type GradeSummary,
} from './pedagogy.js';
import { submitAndGradeAttempt, type AttemptPipelineResult } from './attempt-pipeline.js';
import { buildBiologySkillBundle } from './skill.js';
import { DEFAULT_PEDAGOGY_POLICY, DEFAULT_TUTOR_SIGNALS } from './types.js';
import type {
  AuditSink,
  BiologySkillBundle,
  PedagogicalDecision,
  ReviewStage,
  TutorAttemptOutcome,
  TutorAuditEvent,
  TutorContentPort,
  TutorGatewayBinding,
  TutorLearnerPort,
  TutorMode,
  TutorModelGateway,
  TutorPedagogyPolicy,
  TutorProgressExplanation,
  TutorSessionState,
  TutorStreamEvent,
  TutorToolInvocationResult,
  TutorToolSessionResolver,
  TutorToolSessionSnapshot,
  TutorTurnInput,
  TutorTurnOutcome,
  TutorError,
} from './types.js';

/**
 * T15 F5: a DSH session id collision surfaces as a restore-path TypeError or as
 * the explicit SESSION_RESUME_FAILED marker emitted by the DSH adapter. Either
 * way the failed bind made zero model calls, so one retry with a fresh id is
 * safe and does not hide a transport failure.
 */
const SESSION_BINDING_FAILURE_PATTERN =
  /SESSION_RESUME_FAILED|Cannot read propert|Cannot set propert|reading 'length'|is not a function|undefined \(reading/i;

export function isSessionBindingFailure(error: { readonly message: string }): boolean {
  return SESSION_BINDING_FAILURE_PATTERN.test(error.message);
}

export interface TutorServiceOptions {  readonly content: TutorContentPort;
  readonly learner: TutorLearnerPort;
  readonly gateway: TutorModelGateway;
  readonly clock: Clock;
  readonly ids: IdGenerator;
  readonly learnerId: Id;
  /** Pack bound by the host for this learner; never taken from model args. */
  readonly packKey: PackKey;
  readonly policy?: TutorPedagogyPolicy;
  readonly skill?: BiologySkillBundle;
  readonly onAudit?: AuditSink;
  readonly maxRows?: number;
  /**
   * Optional activity-level source declaration resolver (default true).
   * Evidence candidates with no source refs are rejected unless this returns
   * `false` for the activity (activity explicitly declares sourceRequired:false).
   */
  readonly sourceRequiredForActivity?: (activity: Activity) => boolean;
}

export interface TutorStartSessionRequest {
  readonly conceptId: Id;
  readonly mode: TutorMode;
  readonly sessionId?: Id;
  readonly activityId?: Id | null;
}

export interface StartedTutorSession {
  readonly session: Session;
  readonly state: TutorSessionState;
  readonly model: ModelDescriptor;
  readonly gateway: 'mock' | 'dsh';
  readonly dshSessionId: Id | null;
}

interface PendingRetry {
  readonly attemptId: Id;
  readonly run: () => Promise<AttemptPipelineResult>;
}

interface InternalSession {
  session: Session;
  state: TutorSessionState;
  readonly model: ModelDescriptor;
  readonly dshSessionId: Id | null;
  helpKinds: readonly HelpKind[];
  disclosure: boolean;
  pendingRetry: PendingRetry | null;
  /** Terminal operation receipt for retry idempotency (finish/skip/end). */
  lastCompletion: { readonly requestId: string; readonly data: unknown } | null;
  /** 最近一次作答摘要：聊天轮里让模型知道"学生刚选了什么/判得怎么样"。 */
  lastAttempt: TutorAttemptDigest | null;
  readonly auditStart: number;
}

export interface TutorService extends TutorToolSessionResolver {
  startSession(
    ctx: RequestContext,
    request: TutorStartSessionRequest,
  ): Promise<ServiceResult<StartedTutorSession>>;
  getState(sessionId: Id): TutorSessionState | null;
  submitTurn(ctx: RequestContext, input: TutorTurnInput): Promise<ServiceResult<TutorTurnOutcome>>;
  retryPendingGrading(
    ctx: RequestContext,
    request: { readonly sessionId: Id; readonly requestId: string },
  ): Promise<ServiceResult<TutorAttemptOutcome>>;
  skip(
    ctx: RequestContext,
    request: Omit<TutorTurnInput, 'attempt' | 'message' | 'helpRequest' | 'skip' | 'end'>,
  ): Promise<ServiceResult<TutorTurnOutcome>>;
  end(
    ctx: RequestContext,
    request: Omit<TutorTurnInput, 'attempt' | 'message' | 'helpRequest' | 'skip' | 'end'> & {
      readonly completed: boolean;
    },
  ): Promise<ServiceResult<TutorTurnOutcome>>;
  finishLearning(
    ctx: RequestContext,
    request: { readonly requestId: string; readonly sessionId: Id; readonly revision: number },
  ): Promise<
    ServiceResult<{
      readonly progress: unknown;
      readonly dueAt: Timestamp;
      readonly policyVersion: string;
    }>
  >;
  finishReview(
    ctx: RequestContext,
    request: {
      readonly requestId: string;
      readonly sessionId: Id;
      readonly revision: number;
      readonly outcome?: 'needs_support' | 'developing' | 'supported';
    },
  ): Promise<
    ServiceResult<{
      readonly progress: unknown;
      readonly dueAt: Timestamp;
      readonly outcome: string;
      readonly early: boolean;
    }>
  >;
  explainProgress(
    ctx: RequestContext,
    request: { readonly conceptId: Id },
  ): Promise<ServiceResult<TutorProgressExplanation>>;
  readonly tools: EducationToolRegistry;
  auditEvents(): readonly TutorAuditEvent[];
}

function findActivity(pack: ContentPack, activityId: Id): Activity | undefined {
  return pack.activities.find((activity) => activity.id === activityId);
}

function findRubric(pack: ContentPack, activity: Activity): Rubric | undefined {
  return pack.rubrics.find((rubric) => rubric.id === activity.rubricId);
}

function preferredActivities(
  pack: ContentPack,
  conceptId: Id,
  mode: TutorMode,
  reviewStage: ReviewStage | null,
): readonly Activity[] {
  const candidates = pack.activities.filter((activity) => activity.conceptIds.includes(conceptId));
  if (mode === 'review') {
    const ordered: Activity[] = [];
    for (const type of activityTypesForStage(reviewStage ?? 'recall')) {
      for (const activity of candidates) {
        if (activity.type === type && !ordered.includes(activity)) ordered.push(activity);
      }
    }
    return ordered.length > 0 ? ordered : candidates;
  }
  const learnOrder = ['explain', 'recall', 'choice', 'diagram_label', 'relation', 'transfer', 'image_review'];
  return [...candidates].sort((left, right) => {
    const leftIndex = learnOrder.indexOf(left.type);
    const rightIndex = learnOrder.indexOf(right.type);
    return (leftIndex === -1 ? 99 : leftIndex) - (rightIndex === -1 ? 99 : rightIndex);
  });
}

function pickInitialActivity(pack: ContentPack, conceptId: Id, mode: TutorMode): Activity | null {
  return preferredActivities(pack, conceptId, mode, mode === 'review' ? 'recall' : null)[0] ?? null;
}

function pickNextActivity(
  pack: ContentPack,
  conceptId: Id,
  currentId: Id | null,
  mode: TutorMode,
  reviewStage: ReviewStage | null,
): Activity | null {
  const ordered = preferredActivities(pack, conceptId, mode, reviewStage);
  if (ordered.length === 0) return null;
  if (currentId === null) return ordered[0] ?? null;
  const index = ordered.findIndex((activity) => activity.id === currentId);
  if (index === -1) return ordered[0] ?? null;
  return ordered[(index + 1) % ordered.length] ?? ordered[0] ?? null;
}

function rejectedNote(outcome: TutorAttemptOutcome): string | null {
  if (outcome.rejectedCandidates.length === 0) return null;
  return `（有 ${outcome.rejectedCandidates.length} 条模型证据候选未通过服务校验，未写入成绩；原因已记录审计。）`;
}

function independenceNote(attempt: import('@edu/domain').ActivityAttempt): string | null {
  const independence = roundIndependence(attempt);
  if (!independence.independent) {
    return '（本轮使用了提示/解释或已看答案，这次作答计入 assisted 证据，不算独立掌握证据。）';
  }
  return null;
}

function mapTutorErrorToService<T>(error: TutorError): ServiceResult<T> {
  return errResult(
    error.code === 'AUTH'
      ? 'UNAUTHORIZED'
      : error.code === 'QUOTA'
        ? 'QUOTA_EXCEEDED'
        : error.code === 'NETWORK'
          ? 'UNAVAILABLE'
          : error.code === 'CANCELLED'
            ? 'CANCELLED'
            : error.code === 'TIMEOUT'
              ? 'TIMEOUT'
              : error.code === 'FORBIDDEN'
                ? 'UNAUTHORIZED'
                : error.code === 'INVALID_INPUT' || error.code === 'UNKNOWN_TOOL'
                  ? 'INVALID_INPUT'
                  : error.code === 'NOT_FOUND'
                    ? 'NOT_FOUND'
                    : error.code === 'STALE_REVISION'
                      ? 'STALE_REVISION'
                      : error.code === 'CONTRACT_REJECTED'
                        ? 'CONTRACT_REJECTED'
                        : error.code === 'STORAGE'
                          ? 'STORAGE_FAILED'
                          : error.code === 'UNSUPPORTED'
                            ? 'UNSUPPORTED'
                            : 'CONFLICT',
    error.message,
    error.retryable,
    error.detailsRef,
  );
}

export function createTutorService(options: TutorServiceOptions): TutorService {
  const { content, learner, gateway, clock, ids, learnerId, packKey } = options;
  const policy = options.policy ?? DEFAULT_PEDAGOGY_POLICY;
  const skill = options.skill ?? buildBiologySkillBundle();
  const maxRows = options.maxRows ?? 20;
  const sessions = new Map<Id, InternalSession>();
  const auditLog: TutorAuditEvent[] = [];
  const holder: { service: TutorService | null } = { service: null };

  function emitAudit(event: TutorAuditEvent): void {
    auditLog.push(event);
    options.onAudit?.(event);
  }

  function audit(
    kind: TutorAuditEvent['kind'],
    subject: string,
    reason: string,
    detail?: Readonly<Record<string, unknown>>,
  ): void {
    emitAudit({
      at: clock.now(),
      kind,
      subject,
      reason,
      ...(detail === undefined ? {} : { detail }),
    });
  }

  function fail<T>(error: TutorError): ServiceResult<T> {
    return mapTutorErrorToService(error);
  }

  function snapshotOf(session: InternalSession): TutorSessionState {
    return { ...session.state, helpKinds: [...session.helpKinds] };
  }

  function auditSlice(session: InternalSession): readonly TutorAuditEvent[] {
    return auditLog.slice(session.auditStart);
  }

  function requireSession(sessionId: Id): InternalSession {
    const session = sessions.get(sessionId);
    if (session === undefined) {
      throw new TutorException('NOT_FOUND', `no teaching session ${sessionId}`);
    }
    return session;
  }

  function checkActive(session: InternalSession): void {
    if (session.state.status !== 'active') {
      throw new TutorException('CONFLICT', `session ${session.session.id} is ${session.state.status}`);
    }
  }

  function checkRevision(session: InternalSession, revision: number): void {
    if (revision !== session.state.revision) {
      throw new TutorException(
        'STALE_REVISION',
        `turn revision ${revision} does not match session revision ${session.state.revision}`,
      );
    }
  }

  /**
   * Terminal operations (finish/skip/end) are idempotent user actions, not
   * model turns. The revision is an optimistic hint, not a hard late-response
   * fence: the runtime local fallback reports a synthetic revision without
   * advancing the tutor session, so requiring exact equality makes review
   * completion impossible after a fallback turn. A *future* revision is still
   * rejected, and the real guard is the learner/journal state + requestId
   * idempotency + terminal status.
   */
  function checkTerminalRevision(session: InternalSession, revision: number, action: string): void {
    if (!Number.isInteger(revision) || revision < 0) {
      throw new TutorException('INVALID_INPUT', `${action} needs a non-negative integer revision`);
    }
    if (revision > session.state.revision) {
      throw new TutorException(
        'STALE_REVISION',
        `${action} revision ${revision} is ahead of session revision ${session.state.revision}`,
      );
    }
  }

  async function loadPack(ctx: RequestContext): Promise<ContentPack> {
    const pack = await content.getPack(ctx, packKey);
    if (!pack.ok) throw new TutorException(fromServiceError(pack.error).code, pack.error.message);
    return pack.data;
  }

  async function loadConcept(ctx: RequestContext, conceptId: Id): Promise<Concept> {
    const view = await content.getConcept(ctx, { ...packKey, conceptId });
    if (!view.ok) throw new TutorException(fromServiceError(view.error).code, view.error.message);
    return view.data.concept;
  }

  const registry = createEducationToolRegistry({
    content,
    learner,
    clock,
    ids,
    learnerId,
    packKey,
    sessions: {
      snapshot(ctx, sessionId) {
        const service = holder.service;
        if (service === null) {
          return errResult('UNSUPPORTED', 'the tutor service is not initialized yet');
        }
        return service.snapshot(ctx, sessionId);
      },
      async commitAttempt(ctx, request) {
        const service = holder.service;
        if (service === null) {
          return errResult('UNSUPPORTED', 'the tutor service is not initialized yet');
        }
        return service.commitAttempt(ctx, request);
      },
    },
    onAudit: emitAudit,
    maxRows,
  });

  async function contextPrerequisites(
    ctx: RequestContext,
    conceptId: Id,
  ): Promise<readonly Concept[]> {
    const view = await content.getConcept(ctx, { ...packKey, conceptId });
    if (!view.ok) return [];
    const relations = view.data.relations.filter(
      (relation) => relation.type === 'prerequisite' && relation.toConceptId === conceptId,
    );
    const prerequisites: Concept[] = [];
    for (const relation of relations.slice(0, 2)) {
      const prerequisite = await content.getConcept(ctx, {
        ...packKey,
        conceptId: relation.fromConceptId,
      });
      if (prerequisite.ok) prerequisites.push(prerequisite.data.concept);
    }
    return prerequisites;
  }

  async function runAttempt(
    ctx: RequestContext,
    session: InternalSession,
    request: {
      readonly requestId: string;
      readonly activityId: Id;
      readonly inputType: AttemptInputType;
      readonly answerText: string | null;
      readonly answerAssetId: Id | null;
      readonly timeoutMs?: number;
    },
  ): Promise<{
    readonly pack: ContentPack;
    readonly result: AttemptPipelineResult;
    readonly summary: GradeSummary | null;
  }> {
    const pack = await loadPack(ctx);
    const activity = findActivity(pack, request.activityId);
    if (activity === undefined) {
      throw new TutorException('NOT_FOUND', `activity ${request.activityId} is not in this content pack`);
    }
    const rubric = findRubric(pack, activity);
    if (rubric === undefined) {
      throw new TutorException(
        'CONTRACT_REJECTED',
        `activity ${activity.id} references missing rubric ${activity.rubricId}`,
      );
    }
    const concept = await loadConcept(ctx, session.state.conceptId);
    const resolvableSourceRefs = [
      ...new Set([
        ...concept.sourceRefs,
        ...activity.sourceRefs,
        ...rubric.criteria.flatMap((criterion) => criterion.feedbackSourceRefs),
      ]),
    ];
    const result = await submitAndGradeAttempt(
      { learner, ids, clock, gateway, onAudit: emitAudit },
      ctx,
      {
        session: session.session,
        activity,
        rubric,
        requestId: request.requestId,
        inputType: request.inputType,
        answerText: request.answerText,
        answerAssetId: request.answerAssetId,
        helpKinds: [...session.helpKinds],
        disclosureInRound: session.disclosure,
        coreMisconception: false,
        resolvableSourceRefs,
        rubricVersion: activity.rubricVersion,
        ...(options.sourceRequiredForActivity === undefined
          ? {}
          : { sourceRequired: options.sourceRequiredForActivity(activity) }),
        timeoutMs: request.timeoutMs,
        signals: DEFAULT_TUTOR_SIGNALS,
      },
    );
    if (!result.ok) {
      if (result.attemptId !== null) {
        session.state = {
          ...session.state,
          pendingGradingAttemptId: result.attemptId,
          revision: session.state.revision + 1,
          turnCount: session.state.turnCount + 1,
        };
        session.pendingRetry =
          result.retry === null ? null : { attemptId: result.attemptId, run: result.retry };
        audit('gateway.error', result.attemptId, `${result.error.code}: ${result.error.message}`);
      }
      return { pack, result, summary: null };
    }
    session.helpKinds = [];
    session.disclosure = false;
    const summary =
      result.outcome.grade === null
        ? null
        : summarizeGrade(result.outcome.grade, DEFAULT_TUTOR_SIGNALS);
    session.pendingRetry = null;
    return { pack, result, summary };
  }

  function applyAttemptActivity(
    session: InternalSession,
    pack: ContentPack,
    summary: GradeSummary | null,
  ): void {
    if (summary !== null && summary.correct === 'yes') {
      session.state = {
        ...session.state,
        currentActivityId:
          pickNextActivity(
            pack,
            session.state.conceptId,
            session.state.currentActivityId,
            session.state.mode,
            session.state.reviewStage,
          )?.id ?? session.state.currentActivityId,
      };
    }
    session.state = {
      ...session.state,
      pendingGradingAttemptId: null,
    };
  }

  function applyDecision(
    session: InternalSession,
    decision: PedagogicalDecision,
    attemptSubmitted: boolean,
    summary: GradeSummary | null,
  ): void {
    const helpKinds = attemptSubmitted
      ? []
      : [...new Set([...session.helpKinds, ...helpKindsForAction(decision.action)])];
    const disclosure = attemptSubmitted ? false : session.disclosure || decision.disclosure;
    const difficulty =
      decision.difficulty === 'reduced'
        ? 'reduced'
        : decision.difficulty === 'increased'
          ? 'standard'
          : session.state.difficulty;
    const representation =
      decision.action === 'worked_example'
        ? 'step_by_step'
        : decision.action === 'review_discriminate'
          ? 'diagram'
          : session.state.representation;
    const failures =
      summary === null
        ? session.state.consecutiveFailures
        : summary.correct === 'no'
          ? session.state.consecutiveFailures + 1
          : summary.correct === 'yes'
            ? 0
            : session.state.consecutiveFailures;
    session.helpKinds = helpKinds;
    session.disclosure = disclosure;
    if (decision.disclosure) {
      audit('answer.disclosed', session.session.id, `action ${decision.action} disclosed the answer/steps`);
    }
    if (decision.difficulty === 'reduced') {
      audit(
        'difficulty.reduced',
        session.session.id,
        `action ${decision.action} reduced difficulty after ${failures} failure(s)`,
      );
    }
    if (decision.reviewStage !== null) {
      audit('review.stage', session.session.id, `review stage -> ${decision.reviewStage}`);
    }
    session.state = {
      ...session.state,
      revision: session.state.revision + 1,
      turnCount: session.state.turnCount + 1,
      helpKinds,
      disclosure,
      difficulty,
      representation,
      consecutiveFailures: failures,
      consecutiveProbes: decision.guidance === 'probe' ? session.state.consecutiveProbes + 1 : 0,
      reviewStage: decision.reviewStage ?? session.state.reviewStage,
      lastAction: decision.action,
    };
  }

  function buildEvents(
    session: InternalSession,
    parts: {
      readonly attempt: boolean;
      readonly modelDeltas: readonly string[];
      readonly toolResults: readonly TutorToolInvocationResult[];
      readonly decision: PedagogicalDecision;
    },
  ): readonly TutorStreamEvent[] {
    const events: TutorStreamEvent[] = [
      { type: 'turn.started', sessionId: session.session.id, revision: session.state.revision },
      { type: 'phase', phase: 'context' },
    ];
    if (parts.attempt) {
      events.push({ type: 'phase', phase: 'persisting_attempt' });
      events.push({ type: 'phase', phase: 'grading' });
    }
    for (const tool of parts.toolResults) {
      events.push({ type: 'tool.requested', name: tool.name });
      events.push({
        type: 'tool.result',
        name: tool.name,
        ok: tool.ok,
        code: tool.ok ? null : (tool.code ?? 'UNSUPPORTED'),
      });
    }
    for (const delta of parts.modelDeltas) {
      events.push({ type: 'model.delta', text: delta });
      events.push({ type: 'phase', phase: 'streaming' });
    }
    events.push({
      type: 'pedagogy.decision',
      action: parts.decision.action,
      disclosure: parts.decision.disclosure,
      difficulty: parts.decision.difficulty,
    });
    events.push({ type: 'phase', phase: 'committing' });
    events.push({ type: 'turn.completed', revision: session.state.revision });
    return events;
  }

  function decisionFor(
    session: InternalSession,
    input: {
      readonly signals: ReturnType<typeof readTutorSignals>;
      readonly summary: GradeSummary | null;
      readonly helpRequest: HelpKind | null;
      readonly attemptSubmitted: boolean;
      readonly prerequisites: readonly Concept[];
      readonly concept: Concept;
      readonly activity: Activity | null;
    },
  ): PedagogicalDecision {
    return decidePedagogy({
      mode: session.state.mode,
      turnIndex: session.state.turnCount,
      signals: input.signals,
      grade: input.summary,
      helpRequest: input.helpRequest,
      state: session.state,
      attemptSubmitted: input.attemptSubmitted,
      prerequisiteConceptId: input.prerequisites[0]?.id ?? null,
      prerequisiteTitle: input.prerequisites[0]?.title ?? null,
      conceptSourceRefs: input.concept.sourceRefs,
      activitySourceRefs: input.activity?.sourceRefs ?? [],
      conflictSourceRefs: input.concept.sourceRefs,
      policy,
    });
  }

  function conflictNote(
    signals: ReturnType<typeof readTutorSignals>,
    concept: Concept,
    activity: Activity | null,
  ): string | null {
    if (!signals.textbookConflict) return null;
    const refs = [...new Set([...concept.sourceRefs, ...(activity?.sourceRefs ?? [])])];
    return `两边依据分开看：学生说法=你说的内容（数据，不当作教材原文）；材料依据=${
      refs.join('、') || '当前内容包没有可解析来源'
    }。若材料与你说法冲突，以可解析来源为准；来源缺失时保持“待核实”，不编造页码。`;
  }

  function renderedMessage(
    session: InternalSession,
    decision: PedagogicalDecision,
    modelText: string,
    context: {
      readonly concept: Concept;
      readonly activity: Activity | null;
      readonly rubric: Rubric | null;
      readonly prerequisites: readonly Concept[];
      readonly signals: ReturnType<typeof readTutorSignals>;
      readonly attemptNote: string | null;
      readonly rejected: string | null;
    },
  ): string {
    const sourceRefs = decision.sourceRefs;
    const sourceMissing = decision.factualClaims && sourceRefs.length === 0;
    const referenceAnswer =
      decision.action === 'answer_disclosure' && context.activity !== null
        ? buildReferenceAnswer(context.activity, context.rubric, context.concept)
        : null;
    void session;
    return composeStudentMessage(decision, modelText, {
      conceptTitle: context.concept.title,
      activityStem: context.activity?.stem ?? null,
      referenceAnswer,
      prerequisiteTitle: context.prerequisites[0]?.title ?? null,
      conflictNote: conflictNote(context.signals, context.concept, context.activity),
      sourceRefs,
      sourceMissing,
      evidenceNote:
        [context.attemptNote, context.rejected].filter((item): item is string => item !== null).join('') ||
        null,
    });
  }

  async function emitModelAndDecide(
    ctx: RequestContext,
    session: InternalSession,
    input: {
      readonly requestId: string;
      readonly message: string | null;
      readonly helpRequest: HelpKind | null;
      readonly attemptSubmitted: boolean;
      readonly gradeResult: import('@edu/domain').GradeResult | null;
      readonly concept: Concept;
      readonly activity: Activity | null;
      readonly pack: ContentPack;
      readonly prerequisites: readonly Concept[];
      readonly attemptNote: string | null;
      readonly rejected: string | null;
      /** 最近一次作答（聊天轮也要带上，模型才知道学生刚选了什么）。 */
      readonly attempt: TutorAttemptDigest | null;
    },
  ): Promise<
    ServiceResult<{
      readonly decision: PedagogicalDecision;
      readonly message: string;
      readonly toolResults: readonly TutorToolInvocationResult[];
      readonly model: ModelDescriptor;
      readonly modelDeltas: readonly string[];
      readonly signals: ReturnType<typeof readTutorSignals>;
      readonly summary: GradeSummary | null;
    }>
  > {
    const contextResult = await buildTutorContext(
      { content, learner },
      ctx,
      {
        session: session.session,
        state: session.state,
        packKey,
        conceptId: session.state.conceptId,
        activityId: input.activity?.id ?? null,
        studentMessage: input.message,
        skill,
        toolNames: [...registry.names],
        maxPrerequisites: 2,
        maxEvidenceItems: 5,
        attempt: input.attempt,
      },
    );
    if (!contextResult.ok) return { ok: false, error: contextResult.error };

    let modelTurn;
    try {
      modelTurn = await gateway.completeTurn(ctx, {
        session: session.session,
        state: session.state,
        prompt: contextResult.data.prompt,
        stream: true,
      });
    } catch (error) {
      const mapped = errorFromThrown(error);
      audit('gateway.error', session.session.id, `${mapped.code}: ${mapped.message}`);
      return fail(mapped);
    }
    if (!modelTurn.ok) {
      const mapped = fromServiceError(modelTurn.error);
      audit('gateway.error', session.session.id, `${mapped.code}: ${mapped.message}`);
      return fail(mapped);
    }
    if (isCancelled(ctx.signal)) {
      audit('turn.cancelled', session.session.id, 'model response arrived after cancellation');
      return fail(tutorError('CANCELLED', 'the turn was cancelled before the teaching response'));
    }
    const turn = modelTurn.data;
    if (gateway.kind === 'mock' && !turn.model.isMock) {
      return fail(
        tutorError(
          'UNSUPPORTED',
          'a mock gateway must label its model descriptor as isMock:true; refusing to treat scripted text as live',
        ),
      );
    }
    // F6: the envelope's `answerDisclosed` flag plus a conservative prose check
    // (the T15 probes showed full explanations delivered under probe_question).
    const signals = withAnswerDisclosure(readTutorSignals(turn.signals), turn.text);
    // The model's semantic reading only arrives with the turn; it completes the
    // grade summary (core misconception / term-only) without re-grading.
    const summary =
      input.gradeResult === null ? null : summarizeGrade(input.gradeResult, signals);

    const toolResults: TutorToolInvocationResult[] = [];
    for (const [index, proposal] of turn.toolCalls.entries()) {
      const outcome = await registry.call(proposal.name, proposal.args, {
        requestId: `${input.requestId}:tool:${index}`,
        ...(ctx.signal === undefined ? {} : { signal: ctx.signal }),
      });
      toolResults.push({
        name: outcome.tool,
        ok: outcome.ok,
        code: outcome.error?.code ?? null,
        message: outcome.error?.message ?? null,
        data: outcome.value,
      });
    }

    let decision = decisionFor(session, {
      signals,
      summary,
      helpRequest: input.helpRequest,
      attemptSubmitted: input.attemptSubmitted,
      prerequisites: input.prerequisites,
      concept: input.concept,
      activity: input.activity,
    });
    // 学生明确要答案时，不赌模型是否自觉披露：直接切到 answer_disclosure。
    if (
      decision.action !== 'answer_disclosure' &&
      input.activity !== null &&
      detectExplicitAnswerRequest(input.message)
    ) {
      decision = {
        ...decision,
        action: 'answer_disclosure',
        disclosure: true,
        rationale: `${decision.rationale}; explicit answer request → deterministic disclosure`,
      };
      audit('answer.disclosed', session.session.id, 'student explicitly asked for the answer (rule)');
    }
    const message = renderedMessage(session, decision, turn.text, {
      concept: input.concept,
      activity: input.activity,
      rubric:
        input.activity === null
          ? null
          : (findRubric(input.pack, input.activity) ?? null),
      prerequisites: input.prerequisites,
      signals,
      attemptNote: input.attemptNote,
      rejected: input.rejected,
    });
    const modelDeltas = turn.text.length === 0 ? [] : [turn.text];
    return okResult(
      { decision, message, toolResults, model: turn.model, modelDeltas, signals, summary },
      0,
    );
  }

  function buildOutcome(
    session: InternalSession,
    parts: {
      readonly decision: PedagogicalDecision;
      readonly message: string;
      readonly events: readonly TutorStreamEvent[];
      readonly model: ModelDescriptor;
      readonly attemptOutcome: TutorAttemptOutcome | null;
      readonly toolResults: readonly TutorToolInvocationResult[];
    },
  ): TutorTurnOutcome {
    return {
      sessionId: session.session.id,
      revision: session.state.revision,
      mode: session.state.mode,
      message: parts.message,
      decision: parts.decision,
      state: snapshotOf(session),
      events: parts.events,
      model: parts.model,
      gateway: gateway.kind,
      attemptOutcome: parts.attemptOutcome,
      toolResults: parts.toolResults,
      sourceCitation: {
        required: parts.decision.factualClaims,
        refs: parts.decision.sourceRefs,
        missing: parts.decision.factualClaims && parts.decision.sourceRefs.length === 0,
      },
      audit: auditSlice(session),
    };
  }

  function stoppedDecision(action: 'skip' | 'end', rationale: string): PedagogicalDecision {
    return {
      action,
      rationale,
      guidance: 'none',
      disclosure: false,
      difficulty: 'same',
      representationChanged: false,
      factualClaims: false,
      sourceRefs: [],
      reviewStage: null,
    };
  }

  async function stopSession(
    ctx: RequestContext,
    request: {
      readonly requestId: string;
      readonly sessionId: Id;
      readonly revision: number;
      readonly timeoutMs?: number;
    },
    action: 'skip' | 'end',
    completed: boolean,
  ): Promise<ServiceResult<TutorTurnOutcome>> {
    const session = sessions.get(request.sessionId);
    if (session === undefined) {
      return fail(tutorError('NOT_FOUND', `no teaching session ${request.sessionId}`));
    }
    if (session.state.status !== 'active') {
      return fail(tutorError('CONFLICT', 'the session is not active'));
    }
    try {
      checkTerminalRevision(session, request.revision, action === 'skip' ? 'skip' : 'end');
    } catch (error) {
      return fail(errorFromThrown(error));
    }
    const endedAt = nowIso(clock);
    const status = action === 'skip' ? 'abandoned' : completed ? 'completed' : 'abandoned';
    const ended = await learner.endSession(
      { ...ctx, requestId: `${request.requestId}:end` },
      { sessionId: session.session.id, status, endedAt },
    );
    if (!ended.ok) return fail(fromServiceError(ended.error));
    if (action === 'skip') {
      audit('session.skipped', session.session.id, 'student skipped; no completion and no wrong answer recorded');
    }
    const decision = stoppedDecision(
      action,
      action === 'skip' ? 'student chose to skip; progress is not faked' : 'session ended explicitly',
    );
    session.state = {
      ...session.state,
      status,
      revision: session.state.revision + 1,
      lastAction: action,
    };
    session.session = { ...session.session, status, endedAt };
    session.lastCompletion = { requestId: request.requestId, data: { sessionId: session.session.id, status } };
    const message = composeStudentMessage(
      decision,
      action === 'skip'
        ? '你可以随时回到地图选择其他概念，这次不会记为完成。'
        : completed
          ? '本次学习完成，记录已经保存。'
          : '这次到这里，记录已经保存。',
      {
        conceptTitle: '',
        activityStem: null,
        referenceAnswer: null,
        prerequisiteTitle: null,
        conflictNote: null,
        sourceRefs: [],
        sourceMissing: false,
        evidenceNote: null,
      },
    );
    return okResult(
      buildOutcome(session, {
        decision,
        message,
        events: buildEvents(session, {
          attempt: false,
          modelDeltas: [],
          toolResults: [],
          decision,
        }),
        model: session.model,
        attemptOutcome: null,
        toolResults: [],
      }),
      session.state.revision,
    );
  }

  const service: TutorService = {
    tools: registry,
    auditEvents() {
      return auditLog.slice();
    },
    getState(sessionId: Id) {
      const session = sessions.get(sessionId);
      return session === undefined ? null : snapshotOf(session);
    },

    async startSession(ctx, request) {
      if (ctx.requestId.trim().length === 0) {
        return fail(tutorError('INVALID_INPUT', 'requestId must not be empty'));
      }
      if (request.mode !== 'learn' && request.mode !== 'review') {
        return fail(tutorError('INVALID_INPUT', 'mode must be learn or review'));
      }
      // 复用同一把学习：会话与 DSH 绑定都还在内存里时直接沿用，只把"当前题"
      // 指到学生要看的那道。否则每次换题/重进都新开一条 session，学习记录会
      // 被拆成一堆碎片（线上实测 14 条 session / 1 次完成）。
      if (request.sessionId !== undefined && request.sessionId !== null) {
        const existing = sessions.get(request.sessionId);
        if (existing !== undefined) {
          if (existing.state.status !== 'active') {
            return fail(tutorError('CONFLICT', 'the session is not active', false));
          }
          const nextActivityId =
            request.activityId === undefined || request.activityId === null
              ? existing.state.currentActivityId
              : request.activityId;
          if (nextActivityId !== existing.state.currentActivityId) {
            existing.state = { ...existing.state, currentActivityId: nextActivityId };
          }
          return okResult(
            {
              session: { ...existing.session, dshSessionId: existing.dshSessionId },
              state: snapshotOf(existing),
              model: existing.model,
              gateway: gateway.kind,
              dshSessionId: existing.dshSessionId,
            },
            existing.state.revision,
          );
        }
      }
      let concept: Concept;
      let pack: ContentPack;
      try {
        concept = await loadConcept(ctx, request.conceptId);
        pack = await loadPack(ctx);
      } catch (error) {
        return fail(errorFromThrown(error));
      }
      const activity =
        request.activityId === undefined || request.activityId === null
          ? pickInitialActivity(pack, concept.id, request.mode)
          : (findActivity(pack, request.activityId) ?? null);
      if (request.activityId !== undefined && request.activityId !== null && activity === null) {
        return fail(tutorError('NOT_FOUND', `activity ${request.activityId} is not in this content pack`));
      }
      const startedAt = nowIso(clock);
      const buildSession = (id: Id): Session => ({
        schemaVersion: 1,
        id,
        learnerId,
        courseEditionId: packKey.courseEditionId,
        packVersion: packKey.packVersion,
        trustMode: pack.status === 'candidate' ? 'candidate' : 'published',
        conceptId: concept.id,
        mode: request.mode,
        status: 'active',
        startedAt,
        endedAt: null,
        resumeCursor: { activityId: activity?.id ?? null, cursor: null },
        dshSessionId: null,
      });
      let session = buildSession(request.sessionId ?? ids.next('session'));
      const bind = async (
        candidate: Session,
      ): Promise<
        | { readonly ok: true; readonly binding: TutorGatewayBinding }
        | { readonly ok: false; readonly error: TutorError }
      > => {
        try {
          const started = await gateway.startSession(ctx, candidate);
          if (!started.ok) {
            const mapped = fromServiceError(started.error);
            audit('gateway.error', candidate.id, `${mapped.code}: ${mapped.message}`);
            return { ok: false, error: mapped };
          }
          return { ok: true, binding: started.data };
        } catch (error) {
          const mapped = errorFromThrown(error);
          audit('gateway.error', candidate.id, `${mapped.code}: ${mapped.message}`);
          return { ok: false, error: mapped };
        }
      };
      let bound = await bind(session);
      // A failed bind made zero model calls, so one retry with a fresh id is
      // always safe. Callers can also pass an id (page reload / resume hands us
      // `session.resume.<ts>`): DSH may still hit the restore TypeError for that
      // id, and failing the whole page there is what students see as a dead end.
      // Retry with the store-aware next id instead; the education layer
      // re-injects its own context on every turn, so no model context is lost.
      if (!bound.ok && isSessionBindingFailure(bound.error)) {
        // T15 F5: a session id that already exists in the DSH store makes the
        // agent restore path throw before any model call. Allocate the next
        // (store-aware) id and retry exactly once; still 0 model calls.
        const retryId = ids.next('session');
        audit(
          'session.retry',
          session.id,
          `SESSION_RESUME_FAILED; retrying start with a fresh session id ${retryId} (0 model calls)`,
        );
        const retried = buildSession(retryId);
        const second = await bind(retried);
        if (second.ok) {
          session = retried;
          bound = second;
        }
      }
      if (!bound.ok) return fail(bound.error);
      const binding = bound.binding;
      const boundSession: Session = { ...session, dshSessionId: binding.dshSessionId };
      const registered = await learner.startSession(ctx, boundSession);
      if (!registered.ok) {
        await gateway.endSession(ctx, { sessionId: session.id, reason: 'abandoned' });
        return fail(fromServiceError(registered.error));
      }
      const state: TutorSessionState = {
        sessionId: boundSession.id,
        learnerId,
        conceptId: concept.id,
        courseEditionId: packKey.courseEditionId,
        packVersion: packKey.packVersion,
        mode: request.mode,
        revision: 0,
        turnCount: 0,
        consecutiveFailures: 0,
        consecutiveProbes: 0,
        helpKinds: [],
        disclosure: false,
        difficulty: 'standard',
        representation: 'text',
        reviewStage: request.mode === 'review' ? 'recall' : null,
        currentActivityId: activity?.id ?? null,
        status: 'active',
        lastAction: null,
        pendingGradingAttemptId: null,
      };
      const internal: InternalSession = {
        session: boundSession,
        state,
        model: binding.model,
        dshSessionId: binding.dshSessionId,
        helpKinds: [],
        disclosure: false,
        pendingRetry: null,
        lastCompletion: null,
        lastAttempt: null,
        auditStart: auditLog.length,
      };
      sessions.set(boundSession.id, internal);
      return okResult(
        {
          session: boundSession,
          state: snapshotOf(internal),
          model: binding.model,
          gateway: gateway.kind,
          dshSessionId: binding.dshSessionId,
        },
        0,
      );
    },

    async submitTurn(ctx, input) {
      if (isCancelled(ctx.signal)) {
        return fail(tutorError('CANCELLED', 'the turn was cancelled before it started'));
      }
      if (input.requestId.trim().length === 0) {
        return fail(tutorError('INVALID_INPUT', 'requestId must not be empty'));
      }
      let session: InternalSession;
      try {
        session = requireSession(input.sessionId);
        checkActive(session);
        checkRevision(session, input.revision);
      } catch (error) {
        return fail(errorFromThrown(error));
      }
      if (input.timeoutMs !== undefined && input.timeoutMs <= 0) {
        return fail(tutorError('TIMEOUT', 'the turn timed out before it started', true));
      }
      if (input.skip === true) {
        return stopSession(ctx, input, 'skip', false);
      }
      if (input.end === true) {
        return stopSession(ctx, input, 'end', false);
      }

      let pack: ContentPack;
      let concept: Concept;
      try {
        pack = await loadPack(ctx);
        concept = await loadConcept(ctx, session.state.conceptId);
      } catch (error) {
        return fail(errorFromThrown(error));
      }

      if (input.attempt !== undefined && input.attempt !== null) {
        try {
          const ran = await runAttempt(ctx, session, {
            requestId: input.attempt.requestId ?? input.requestId,
            activityId: input.attempt.activityId,
            inputType: input.attempt.inputType,
            answerText: input.attempt.answerText ?? null,
            answerAssetId: input.attempt.answerAssetId ?? null,
            timeoutMs: input.timeoutMs,
          });
          if (!ran.result.ok) {
            const saved = ran.result;
            return fail({
              ...saved.error,
              detailsRef: saved.error.detailsRef ?? saved.attemptId ?? undefined,
            });
          }
          const attemptOutcome = ran.result.outcome;
          const answeredActivity = findActivity(ran.pack, attemptOutcome.attempt.activityId) ?? null;
          // 把这次"选了什么/判得怎么样"存下来：本轮反馈要用，下一轮聊天也要用。
          const attemptDigest =
            answeredActivity === null
              ? null
              : buildAttemptDigest({
                  activity: answeredActivity,
                  rubric: findRubric(ran.pack, answeredActivity) ?? null,
                  answerText: attemptOutcome.attempt.answerText,
                  answerAssetId: attemptOutcome.attempt.answerAssetId,
                  grade: attemptOutcome.grade,
                });
          if (attemptDigest !== null) session.lastAttempt = attemptDigest;
          const prerequisites = await contextPrerequisites(ctx, session.state.conceptId);
          const decisions = await emitModelAndDecide(ctx, session, {
            requestId: input.requestId,
            message: input.message ?? null,
            helpRequest: input.helpRequest ?? null,
            attemptSubmitted: true,
            gradeResult: attemptOutcome.grade,
            concept,
            activity: answeredActivity,
            pack: ran.pack,
            prerequisites,
            attemptNote: independenceNote(attemptOutcome.attempt),
            rejected: rejectedNote(attemptOutcome),
            attempt: attemptDigest,
          });
          if (!decisions.ok) return decisions;
          const decision = decisions.data.decision;
          applyDecision(session, decision, true, decisions.data.summary);
          applyAttemptActivity(session, ran.pack, decisions.data.summary);
          const events = buildEvents(session, {
            attempt: true,
            modelDeltas: decisions.data.modelDeltas,
            toolResults: decisions.data.toolResults,
            decision,
          });
          return okResult(
            buildOutcome(session, {
              decision,
              message: decisions.data.message,
              events,
              model: decisions.data.model,
              attemptOutcome,
              toolResults: decisions.data.toolResults,
            }),
            session.state.revision,
          );
        } catch (error) {
          return fail(errorFromThrown(error));
        }
      }

      /* No answer this turn: teaching/help exchange only. */
      try {
        const prerequisites = await contextPrerequisites(ctx, session.state.conceptId);
        const currentActivity =
          session.state.currentActivityId === null
            ? null
            : (findActivity(pack, session.state.currentActivityId) ?? null);
        const decisions = await emitModelAndDecide(ctx, session, {
          requestId: input.requestId,
          message: input.message ?? null,
          helpRequest: input.helpRequest ?? null,
          attemptSubmitted: false,
          gradeResult: null,
          concept,
          activity: currentActivity,
          pack,
          prerequisites,
          attemptNote: null,
          rejected: null,
          // 聊天轮沿用上一题的作答摘要：学生说"这一步为什么"，指的是他刚选的那一项。
          attempt: session.lastAttempt,
        });
        if (!decisions.ok) return decisions;
        const decision = decisions.data.decision;
        applyDecision(session, decision, false, null);
        const events = buildEvents(session, {
          attempt: false,
          modelDeltas: decisions.data.modelDeltas,
          toolResults: decisions.data.toolResults,
          decision,
        });
        return okResult(
          buildOutcome(session, {
            decision,
            message: decisions.data.message,
            events,
            model: decisions.data.model,
            attemptOutcome: null,
            toolResults: decisions.data.toolResults,
          }),
          session.state.revision,
        );
      } catch (error) {
        return fail(errorFromThrown(error));
      }
    },

    async retryPendingGrading(ctx, request) {
      const session = sessions.get(request.sessionId);
      if (session === undefined) {
        return fail(tutorError('NOT_FOUND', `no teaching session ${request.sessionId}`));
      }
      const pending = session.pendingRetry;
      if (pending === null) {
        return fail(tutorError('CONFLICT', 'this session has no pending grading to retry'));
      }
      const retried = await pending.run();
      if (!retried.ok) return fail(retried.error);
      session.pendingRetry = null;
      session.state = {
        ...session.state,
        pendingGradingAttemptId: null,
        revision: session.state.revision + 1,
      };
      audit('tool.called', retried.outcome.attemptId, 'grading retried for the saved attempt');
      return okResult(retried.outcome, session.state.revision);
    },

    async skip(ctx, request) {
      return stopSession(ctx, request, 'skip', false);
    },

    async end(ctx, request) {
      return stopSession(ctx, request, 'end', request.completed);
    },

    async finishLearning(ctx, request) {
      const session = sessions.get(request.sessionId);
      if (session === undefined) {
        return fail(tutorError('NOT_FOUND', `no teaching session ${request.sessionId}`));
      }
      if (session.state.mode !== 'learn') {
        return fail(tutorError('CONFLICT', 'only a learn session can complete a learning unit'));
      }
      if (session.state.status === 'completed') {
        if (session.lastCompletion?.requestId === request.requestId) {
          return okResult(
            session.lastCompletion.data as {
              readonly progress: unknown;
              readonly dueAt: Timestamp;
              readonly policyVersion: string;
            },
            session.state.revision,
          );
        }
        return fail(tutorError('CONFLICT', 'the learning unit is already completed'));
      }
      if (session.state.status !== 'active') {
        return fail(tutorError('CONFLICT', 'the session is not active'));
      }
      try {
        checkTerminalRevision(session, request.revision, 'finish-learning');
      } catch (error) {
        return fail(errorFromThrown(error));
      }
      const completedAt = nowIso(clock);
      const completed = await learner.completeLearning(
        { ...ctx, requestId: `${request.requestId}:complete` },
        {
          sessionId: session.session.id,
          conceptId: session.state.conceptId,
          completedAt,
        },
      );
      if (!completed.ok) return fail(fromServiceError(completed.error));
      const ended = await learner.endSession(
        { ...ctx, requestId: `${request.requestId}:end` },
        { sessionId: session.session.id, status: 'completed', endedAt: completedAt },
      );
      if (!ended.ok) return fail(fromServiceError(ended.error));
      const data = {
        progress: completed.data.progress,
        dueAt: completed.data.dueAt,
        policyVersion: completed.data.policyVersion,
      };
      session.state = { ...session.state, status: 'completed', revision: session.state.revision + 1 };
      session.session = { ...session.session, status: 'completed', endedAt: completedAt };
      session.lastCompletion = { requestId: request.requestId, data };
      return okResult(data, session.state.revision);
    },

    async finishReview(ctx, request) {
      const session = sessions.get(request.sessionId);
      if (session === undefined) {
        return fail(tutorError('NOT_FOUND', `no teaching session ${request.sessionId}`));
      }
      if (session.state.mode !== 'review') {
        return fail(tutorError('CONFLICT', 'only a review session can complete a review'));
      }
      if (session.state.status === 'completed') {
        if (session.lastCompletion?.requestId === request.requestId) {
          return okResult(
            session.lastCompletion.data as {
              readonly progress: unknown;
              readonly dueAt: Timestamp;
              readonly outcome: string;
              readonly early: boolean;
            },
            session.state.revision,
          );
        }
        return fail(tutorError('CONFLICT', 'the review is already completed'));
      }
      if (session.state.status !== 'active') {
        return fail(tutorError('CONFLICT', 'the session is not active'));
      }
      try {
        checkTerminalRevision(session, request.revision, 'finish-review');
      } catch (error) {
        return fail(errorFromThrown(error));
      }
      const completedAt = nowIso(clock);
      const completed = await learner.completeReview(
        { ...ctx, requestId: `${request.requestId}:complete` },
        {
          sessionId: session.session.id,
          conceptId: session.state.conceptId,
          completedAt,
          ...(request.outcome === undefined ? {} : { outcome: request.outcome }),
        },
      );
      if (!completed.ok) return fail(fromServiceError(completed.error));
      const ended = await learner.endSession(
        { ...ctx, requestId: `${request.requestId}:end` },
        { sessionId: session.session.id, status: 'completed', endedAt: completedAt },
      );
      if (!ended.ok) return fail(fromServiceError(ended.error));
      const data = {
        progress: completed.data.progress,
        dueAt: completed.data.dueAt,
        outcome: completed.data.outcome,
        early: completed.data.early,
      };
      session.state = { ...session.state, status: 'completed', revision: session.state.revision + 1 };
      session.session = { ...session.session, status: 'completed', endedAt: completedAt };
      session.lastCompletion = { requestId: request.requestId, data };
      return okResult(data, session.state.revision);
    },

    async explainProgress(ctx, request) {
      const explained: ServiceResult<UnderstandingExplanation> = await learner.explain(ctx, {
        conceptId: request.conceptId,
        courseEditionId: packKey.courseEditionId,
        packVersion: packKey.packVersion,
      });
      if (!explained.ok) return fail(fromServiceError(explained.error));
      return okResult(
        {
          explanation: explained.data,
          evidence: explained.data.evidence,
          note: '每个理解判断都带 rubric/evaluator 版本与理由；自评不在此对象内，也没有掌握百分比。',
        },
        explained.revision,
      );
    },

    /* ---------------------------------------------------- tool resolver */

    snapshot(_ctx, sessionId) {
      const session = sessions.get(sessionId);
      if (session === undefined) {
        return errResult('NOT_FOUND', `no teaching session ${sessionId}`);
      }
      if (session.session.learnerId !== learnerId) {
        return errResult('UNAUTHORIZED', 'session belongs to another learner');
      }
      return okResult<TutorToolSessionSnapshot>(
        { session: session.session, state: snapshotOf(session) },
        session.state.revision,
      );
    },

    async commitAttempt(ctx, request) {
      const session = sessions.get(request.sessionId);
      if (session === undefined) {
        return errResult('NOT_FOUND', `no teaching session ${request.sessionId}`);
      }
      if (session.state.status !== 'active') {
        return errResult('CONFLICT', 'the session is not active');
      }
      try {
        const ran = await runAttempt(ctx, session, {
          requestId: ctx.requestId,
          activityId: request.activityId,
          inputType: request.inputType,
          answerText: request.answerText,
          answerAssetId: request.answerAssetId,
        });
        if (!ran.result.ok) return fail(ran.result.error);
        applyAttemptActivity(session, ran.pack, ran.summary);
        return okResult(ran.result.outcome, session.state.revision);
      } catch (error) {
        return fail(errorFromThrown(error));
      }
    },
  };

  holder.service = service;
  return service;
}

function nowIso(clock: Clock): Timestamp {
  return clock.now();
}

export type { TutorAuditEvent, TutorSessionState, TutorToolSessionResolver, ReviewStage };
