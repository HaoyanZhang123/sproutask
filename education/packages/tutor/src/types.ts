/**
 * Public types for `@edu/tutor` (T07).
 *
 * The tutor package is the teaching service between the DSH agent loop and the
 * frozen education ports:
 *   - content reads go through `@edu/knowledge` (`ContentQuery` / `KnowledgePort`
 *     implementations are structurally compatible with `TutorContentPort`);
 *   - learner mutations go through `@edu/learner` (`LearnerService` satisfies
 *     `TutorLearnerPort` structurally);
 *   - the model is a `TutorModelGateway` (mock for offline replay, DSH adapter
 *     for T13). A gateway that only speaks plain text cannot be mistaken for a
 *     structured teaching gateway: `adaptTutorGateway` labels that limitation.
 *
 * No type here grants permissions. Tool permissions live in `tools.ts` as an
 * explicit allowlist and are enforced at call time, never by prompt text.
 */

import type {
  Activity,
  ActivityAttempt,
  AttemptInputType,
  CancellationToken,
  Clock,
  ConceptProgress,
  Evidence,
  EvidenceCandidate,
  GradeResult,
  HelpKind,
  Id,
  IdGenerator,
  ModelDescriptor,
  PackKey,
  RequestContext,
  ReviewOutcome,
  Rubric,
  ServiceResult,
  Session,
  Timestamp,
  TutorCapabilities,
} from '@edu/domain';
import type {
  AssessmentOutcome,
  LearnerService,
  ReviewQueueItem,
  UnderstandingExplanation,
} from '@edu/learner';

/* ------------------------------------------------------------------ modes */

export type TutorMode = 'learn' | 'review';

/* -------------------------------------------------------------- signals */

/**
 * Structured semantic reading of one learner turn.
 *
 * In live operation this is produced by the model (the only component allowed
 * to interpret free text); `readTutorSignals` only validates the envelope and
 * drops unknown values. Offline replay scripts the same envelope, so tests do
 * not pretend that keywords or punctuation equal semantic judgement.
 */
export type TutorIntent =
  | 'none'
  | 'wants_answer'
  | 'requests_explanation'
  | 'requests_hint'
  | 'requests_example'
  | 'frustrated'
  | 'confused'
  | 'off_topic'
  | 'textbook_conflict'
  | 'transfer_question'
  | 'skip'
  | 'end';

export type TutorAnswerQuality =
  | 'correct'
  | 'partial'
  | 'incorrect'
  | 'term_only'
  | 'unclear'
  | 'not_answered';

export interface TutorSignals {
  readonly intent: TutorIntent;
  /** 0..1 model confidence in its own reading; never a grade. */
  readonly confidence: number;
  readonly answerQuality: TutorAnswerQuality;
  readonly coreMisconception: boolean;
  readonly missingPrerequisite: boolean;
  readonly textbookConflict: boolean;
  readonly imageQuality: 'clear' | 'blurry' | 'unreadable' | null;
  readonly crossChapter: boolean;
  /**
   * The model itself states that this turn revealed the complete answer or a
   * complete worked solution (T15 F6). It is the authoritative disclosure signal
   * when present; a conservative text detector covers replies that declare the
   * disclosure only in prose.
   */
  readonly answerDisclosed: boolean;
}

export const DEFAULT_TUTOR_SIGNALS: TutorSignals = {
  intent: 'none',
  confidence: 0,
  answerQuality: 'not_answered',
  coreMisconception: false,
  missingPrerequisite: false,
  textbookConflict: false,
  imageQuality: null,
  crossChapter: false,
  answerDisclosed: false,
};

/* ------------------------------------------------------------ decisions */

export type PedagogicalActionKind =
  | 'probe_question'
  | 'hint'
  | 'layered_explanation'
  | 'example'
  | 'worked_example'
  | 'explicit_correction'
  | 'confirm_understanding'
  | 'answer_disclosure'
  | 'clarify_image'
  | 'prerequisite_support'
  | 'source_conflict'
  | 'transfer_bridge'
  | 'review_recall'
  | 'review_discriminate'
  | 'review_transfer'
  | 'review_prerequisite'
  | 'skip'
  | 'end';

export type GuidanceLevel = 'none' | 'probe' | 'hint' | 'explanation' | 'demonstration' | 'answer';

export type DifficultyDirection = 'same' | 'reduced' | 'increased';

export type ReviewStage = 'recall' | 'discriminate' | 'transfer' | 'prerequisite';

/**
 * One teaching decision. `disclosure` means the turn revealed the activity
 * answer (or a complete worked solution) and therefore poisons the independence
 * of the next attempt in this round. Explanations/corrections are allowed and
 * do not set `disclosure`, but they are still recorded as help usage.
 */
export interface PedagogicalDecision {
  readonly action: PedagogicalActionKind;
  readonly rationale: string;
  readonly guidance: GuidanceLevel;
  readonly disclosure: boolean;
  readonly difficulty: DifficultyDirection;
  readonly representationChanged: boolean;
  /** Factual claims require resolvable source refs; the service never invents them. */
  readonly factualClaims: boolean;
  readonly sourceRefs: readonly Id[];
  readonly reviewStage: ReviewStage | null;
}

export interface TutorPedagogyPolicy {
  /** Consecutive unresolved failures that force demonstration/reduced difficulty. */
  readonly escalateAfterFailures: number;
  /** Guidance-first probe cap: an unresolved probe must not repeat forever. */
  readonly maxConsecutiveProbes: number;
  /** Explanations, worked solutions and answers are always available on request. */
  readonly allowExplanation: true;
  readonly allowAnswerDisclosure: true;
}

export const DEFAULT_PEDAGOGY_POLICY: TutorPedagogyPolicy = {
  escalateAfterFailures: 2,
  maxConsecutiveProbes: 2,
  allowExplanation: true,
  allowAnswerDisclosure: true,
};

/* ------------------------------------------------------------- session */

export type TutorSessionStatus = 'active' | 'completed' | 'abandoned';

export interface TutorSessionState {
  readonly sessionId: Id;
  readonly learnerId: Id;
  readonly conceptId: Id;
  readonly courseEditionId: Id;
  readonly packVersion: string;
  readonly mode: TutorMode;
  readonly revision: number;
  readonly turnCount: number;
  readonly consecutiveFailures: number;
  readonly consecutiveProbes: number;
  /** Help kinds already given in the current answer round. */
  readonly helpKinds: readonly HelpKind[];
  /** A complete answer/worked solution was disclosed in the current round. */
  readonly disclosure: boolean;
  readonly difficulty: 'standard' | 'reduced';
  readonly representation: 'text' | 'diagram' | 'step_by_step';
  readonly reviewStage: ReviewStage | null;
  readonly currentActivityId: Id | null;
  readonly status: TutorSessionStatus;
  readonly lastAction: PedagogicalActionKind | null;
  readonly pendingGradingAttemptId: Id | null;
}

/* ---------------------------------------------------------------- turn */

export interface TutorAttemptInput {
  readonly activityId: Id;
  readonly inputType: AttemptInputType;
  readonly answerText?: string | null;
  readonly answerAssetId?: Id | null;
  /** Optional per-answer idempotency key; defaults to the turn request id. */
  readonly requestId?: string;
}

export interface TutorTurnInput {
  /** Mutation idempotency key for this turn; duplicates never double-count. */
  readonly requestId: string;
  readonly sessionId: Id;
  /** Session revision the caller observed; stale turns are rejected (05 §7). */
  readonly revision: number;
  readonly message?: string | null;
  readonly attempt?: TutorAttemptInput | null;
  readonly helpRequest?: HelpKind | null;
  readonly skip?: boolean;
  readonly end?: boolean;
  readonly imageQuality?: 'clear' | 'blurry' | 'unreadable' | null;
  readonly timeoutMs?: number;
}

export type TutorStreamEvent =
  | { readonly type: 'turn.started'; readonly sessionId: Id; readonly revision: number }
  | {
      readonly type: 'phase';
      readonly phase: 'context' | 'persisting_attempt' | 'grading' | 'streaming' | 'committing';
    }
  | { readonly type: 'model.delta'; readonly text: string }
  | { readonly type: 'tool.requested'; readonly name: string }
  | {
      readonly type: 'tool.result';
      readonly name: string;
      readonly ok: boolean;
      readonly code: TutorErrorCode | null;
    }
  | {
      readonly type: 'pedagogy.decision';
      readonly action: PedagogicalActionKind;
      readonly disclosure: boolean;
      readonly difficulty: DifficultyDirection;
    }
  | { readonly type: 'turn.completed'; readonly revision: number };

/**
 * Streaming events and the authoritative final state are deliberately separate
 * fields: `events` is display/progress only, `state` is what later turns and the
 * learner projection rely on.
 */
export interface TutorTurnOutcome {
  readonly sessionId: Id;
  readonly revision: number;
  readonly mode: TutorMode;
  readonly message: string;
  readonly decision: PedagogicalDecision;
  readonly state: TutorSessionState;
  readonly events: readonly TutorStreamEvent[];
  readonly model: ModelDescriptor;
  readonly gateway: 'mock' | 'dsh';
  readonly attemptOutcome: TutorAttemptOutcome | null;
  readonly toolResults: readonly TutorToolInvocationResult[];
  readonly sourceCitation: {
    readonly required: boolean;
    readonly refs: readonly Id[];
    readonly missing: boolean;
  };
  readonly audit: readonly TutorAuditEvent[];
}

export interface TutorAttemptOutcome {
  readonly attempt: ActivityAttempt;
  readonly attemptId: Id;
  /** The raw answer is persisted before any model grading (05 §7). */
  readonly persisted: boolean;
  readonly duplicate: boolean;
  readonly grade: GradeResult | null;
  readonly outcomes: readonly AssessmentOutcome[];
  readonly rejectedCandidates: readonly EvidenceRejection[];
  /** True when grading failed/was cancelled; the attempt can be re-graded. */
  readonly feedbackPending: boolean;
  readonly completedAt: Timestamp;
}

/* ---------------------------------------------------------------- audit */

export type TutorAuditKind =
  | 'permission.denied'
  | 'tool.rejected'
  | 'tool.called'
  | 'evidence.rejected'
  | 'evidence.committed'
  | 'turn.cancelled'
  | 'gateway.error'
  | 'context.untrusted_data'
  | 'answer.disclosed'
  | 'difficulty.reduced'
  | 'session.skipped'
  | 'session.retry'
  | 'review.stage';

export interface TutorAuditEvent {
  readonly at: Timestamp;
  readonly kind: TutorAuditKind;
  readonly subject: string;
  readonly reason: string;
  readonly detail?: Readonly<Record<string, unknown>>;
}

export type AuditSink = (event: TutorAuditEvent) => void;

/* ---------------------------------------------------------------- tools */

export interface TutorToolInvocation {
  readonly name: string;
  readonly args: unknown;
}

export interface TutorToolInvocationResult {
  readonly name: string;
  readonly ok: boolean;
  readonly code: TutorErrorCode | null;
  readonly message: string | null;
  readonly data: unknown;
}

export interface ToolCallContext {
  readonly requestId: string;
  readonly signal?: CancellationToken;
  readonly timeoutMs?: number;
}

export interface ToolOutputSchema {
  readonly type: 'object';
  readonly additionalProperties: boolean;
  readonly properties?: Readonly<Record<string, unknown>>;
  readonly required?: readonly string[];
}

export interface ToolRenderBlock {
  readonly type: 'text';
  readonly text: string;
}

export interface ToolCallOutcome {
  readonly tool: string;
  readonly requestId: string;
  readonly ok: boolean;
  readonly value: unknown;
  /** Structured tutor error (AUTH/QUOTA/UNSUPPORTED/NETWORK/CANCELLED/INVALID_INPUT/...). */
  readonly error: TutorError | null;
  readonly duplicate: boolean;
}

/**
 * Duck-typed DSH tool definition (runtime-lock: `ctx.tools.register(definition)`
 * with `defineTool()` shape `{name, description, parameters, output, execute}`).
 * Plain data on purpose: the package never imports dsh-tools, so it stays
 * compatible across DSH module instances.
 *
 * `execute` returns the tool value or throws `TutorException`; the registry's
 * `call()` is the never-throwing variant used by the service and tests.
 */
export interface EducationToolDefinition {
  readonly name: string;
  readonly description: string;
  readonly parameters: ToolParameterSchema;
  readonly output: {
    readonly schema: ToolOutputSchema;
    readonly render: (args: unknown, value: unknown) => readonly ToolRenderBlock[];
  };
  readonly execute: (args: unknown, context?: unknown) => Promise<unknown>;
}

export interface ToolParameterType {
  readonly type: 'string' | 'number' | 'integer' | 'boolean' | 'array' | 'object';
  readonly description?: string;
  readonly enum?: readonly string[];
  readonly minLength?: number;
  readonly maxLength?: number;
  readonly minItems?: number;
  readonly maxItems?: number;
  readonly items?: ToolParameterType;
  readonly properties?: Readonly<Record<string, ToolParameterType>>;
  readonly required?: readonly string[];
  readonly additionalProperties?: boolean;
  readonly minimum?: number;
  readonly maximum?: number;
}

export interface ToolParameterSchema extends ToolParameterType {
  readonly type: 'object';
  readonly properties: Readonly<Record<string, ToolParameterType>>;
  readonly required: readonly string[];
  readonly additionalProperties: false;
}

export interface ToolHost {
  tools: {
    register(definition: EducationToolDefinition): void;
  };
}

export interface RegisteredToolSet {
  readonly names: readonly string[];
  readonly definitions: readonly EducationToolDefinition[];
  readonly register: (host: ToolHost) => void;
}

/* ------------------------------------------------------------- evidence */

export interface EvidenceRejection {
  readonly candidateIndex: number;
  readonly conceptId: Id;
  readonly reason: EvidenceRejectionReason;
  readonly message: string;
}

export type EvidenceRejectionReason =
  | 'ATTEMPT_MISMATCH'
  | 'CONCEPT_NOT_IN_ACTIVITY'
  | 'ASSISTANCE_MISMATCH'
  | 'DISCLOSURE_INDEPENDENCE_LOST'
  | 'EVIDENCE_SOURCE_REQUIRED'
  | 'SOURCE_UNRESOLVED'
  | 'CRITERION_UNKNOWN'
  | 'RUBRIC_VERSION_MISMATCH'
  | 'MODEL_RUN_MISSING'
  | 'UNCERTAINTY_MISSING'
  | 'CLARIFICATION_CONFLICT'
  | 'INVALID_EVIDENCE_SHAPE';

/* --------------------------------------------------------------- errors */

export type TutorErrorCode =
  | 'AUTH'
  | 'QUOTA'
  | 'UNSUPPORTED'
  | 'NETWORK'
  | 'CANCELLED'
  | 'TIMEOUT'
  | 'INVALID_INPUT'
  | 'UNKNOWN_TOOL'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'STALE_REVISION'
  | 'CONTRACT_REJECTED'
  | 'STORAGE';

export interface TutorError {
  readonly code: TutorErrorCode;
  readonly message: string;
  readonly retryable: boolean;
  readonly detailsRef?: string;
}

/* -------------------------------------------------------------- gateway */

export interface TutorContextBlock {
  readonly kind:
    | 'current_material'
    | 'prerequisite'
    | 'activity'
    | 'prior_evidence'
    | 'student_input'
    | 'current_attempt'
    | 'content_warning';
  /** Content and student text are data, never instructions. */
  readonly trust: 'untrusted_data';
  readonly label: string;
  readonly content: string;
  readonly sourceRefs: readonly Id[];
}

export interface TutorPrompt {
  readonly systemInstruction: string;
  readonly blocks: readonly TutorContextBlock[];
  readonly toolNames: readonly string[];
  readonly disclosurePolicy: string;
}

export interface TutorModelTurnRequest {
  readonly session: Session;
  readonly state: TutorSessionState;
  readonly prompt: TutorPrompt;
  readonly stream: boolean;
}

export interface TutorModelToolCall {
  readonly name: string;
  readonly args: Readonly<Record<string, unknown>>;
}

export interface TutorModelTurn {
  readonly text: string;
  readonly signals: TutorSignals;
  readonly evidenceCandidates: readonly EvidenceCandidate[];
  readonly toolCalls: readonly TutorModelToolCall[];
  readonly modelRunId: string | null;
  readonly model: ModelDescriptor;
}

export interface TutorGradeRequest {
  readonly sessionId: Id;
  readonly attempt: ActivityAttempt;
  readonly activity: Activity;
  readonly rubric: Rubric;
  readonly modelRunId: string | null;
}

export interface TutorGatewayBinding {
  readonly model: ModelDescriptor;
  readonly dshSessionId: Id | null;
}

/**
 * The structured teaching gateway. `completeTurn` returns the model's semantic
 * reading plus its proposal (text / evidence candidates / tool calls); the
 * service — not the model — decides the teaching action and validates evidence.
 */
export interface TutorModelGateway {
  readonly kind: 'mock' | 'dsh';
  capabilities(ctx: RequestContext): Promise<ServiceResult<TutorCapabilities>>;
  startSession(ctx: RequestContext, session: Session): Promise<ServiceResult<TutorGatewayBinding>>;
  completeTurn(
    ctx: RequestContext,
    request: TutorModelTurnRequest,
  ): Promise<ServiceResult<TutorModelTurn>>;
  grade(ctx: RequestContext, request: TutorGradeRequest): Promise<ServiceResult<GradeResult>>;
  endSession(
    ctx: RequestContext,
    request: { readonly sessionId: Id; readonly reason: 'completed' | 'abandoned' },
  ): Promise<ServiceResult<{ readonly endedAt: Timestamp }>>;
}

/* --------------------------------------------------- content / learner ports */

/** Structurally satisfied by `KnowledgeService` from `@edu/knowledge`. */
export type TutorContentPort = {
  getPack(ctx: RequestContext, key: PackKey): Promise<ServiceResult<import('@edu/domain').ContentPack>>;
  getConcept(
    ctx: RequestContext,
    key: PackKey & { readonly conceptId: Id },
  ): Promise<ServiceResult<import('@edu/domain').ConceptView>>;
  resolveSource(
    ctx: RequestContext,
    sourceRefId: Id,
  ): Promise<ServiceResult<import('@edu/domain').SourceSummary>>;
};

/**
 * Structurally satisfied by the accepted `LearnerService`. `Pick` keeps the
 * exact method signatures, so this file fails to typecheck if the learner
 * contract drifts away from what the tutor service depends on.
 */
export type TutorLearnerPort = Pick<
  LearnerService,
  | 'startSession'
  | 'endSession'
  | 'submitAttempt'
  | 'recordGradedAttempt'
  | 'cancelAttemptGrading'
  | 'get'
  | 'list'
  | 'reviewQueue'
  | 'explain'
  | 'completeLearning'
  | 'completeReview'
>;

/* ----------------------------------------------------------- tool deps */

export interface TutorToolSessionSnapshot {
  readonly session: Session;
  readonly state: TutorSessionState;
}

/** Answer submission is delegated to the one teaching service (no second loop). */
export interface TutorToolSessionResolver {
  snapshot(ctx: RequestContext, sessionId: Id): ServiceResult<TutorToolSessionSnapshot>;
  commitAttempt(
    ctx: RequestContext,
    request: {
      readonly sessionId: Id;
      readonly activityId: Id;
      readonly inputType: AttemptInputType;
      readonly answerText: string | null;
      readonly answerAssetId: Id | null;
    },
  ): Promise<ServiceResult<TutorAttemptOutcome>>;
}

export interface TutorToolDependencies {
  readonly content: TutorContentPort;
  readonly learner: TutorLearnerPort;
  readonly clock: Clock;
  readonly ids: IdGenerator;
  readonly learnerId: Id;
  /** Pack bound by the host for this learner session (never from model args). */
  readonly packKey: PackKey;
  /** Optional because read-only tools work without a live teaching session. */
  readonly sessions?: TutorToolSessionResolver;
  readonly onAudit?: AuditSink;
  /** Hard cap on rows returned by list-like tools. */
  readonly maxRows?: number;
}

/* ------------------------------------------------------------- progress */

export interface TutorProgressSummary {
  readonly courseEditionId: Id;
  readonly packVersion: string;
  readonly activityCoverage: {
    readonly numerator: number;
    readonly denominator: number;
    readonly percent: number | null;
    readonly label: 'activity_coverage_not_mastery';
  };
  readonly concepts: readonly {
    readonly conceptId: Id;
    readonly learning: ConceptProgress['learning']['state'];
    readonly understanding: ConceptProgress['understanding']['state'];
    readonly understandingValidity: ConceptProgress['understanding']['validity'];
    readonly reviewDue: boolean;
    readonly dueAt: Timestamp | null;
  }[];
  readonly reviewQueue: readonly ReviewQueueItem[];
  /** Explicitly not a mastery percentage. */
  readonly note: string;
}

export interface TutorProgressExplanation {
  readonly explanation: UnderstandingExplanation;
  readonly evidence: UnderstandingExplanation['evidence'];
  readonly note: string;
}

/* ----------------------------------------------------------------- skill */

export interface BiologySkillConstraint {
  readonly id: string;
  readonly rule: string;
}

export interface BiologySkillBundle {
  readonly id: string;
  readonly version: string;
  readonly subject: string;
  readonly constraints: readonly BiologySkillConstraint[];
  readonly instruction: string;
}

/* -------------------------------------------------------------- exports */

export type {
  Activity,
  ActivityAttempt,
  ConceptProgress,
  Evidence,
  EvidenceCandidate,
  GradeResult,
  LearnerService,
  Rubric,
  Session,
};
