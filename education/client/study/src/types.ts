/**
 * T12 study workspace seam.
 *
 * The UI calls the accepted teaching service (T07 `TutorService` shape) and the
 * learner projection (T06), but it never instantiates them or invents teaching
 * policy. T13 supplies a facade implementing this interface; the fixture in
 * this package is explicitly labelled 演示数据（fixture）.
 */

import type {
  Activity,
  Concept,
  ConceptProgress,
  HelpKind,
  Id,
  RequestContext,
  SelfReport,
  ServiceResult,
  SourceVerificationState,
  Timestamp,
  TrustMode,
} from '@edu/domain';
import type {
  TutorAttemptOutcome,
  TutorMode,
  TutorSessionState,
  TutorStartSessionRequest,
  TutorTurnInput,
  TutorTurnOutcome,
  StartedTutorSession,
} from '@edu/tutor';
import type { AnswerFormValue, ImageFlowLike } from '../../visuals/src/index.js';
import type { PackCoverageStatus, PackScope } from '@edu/domain';

export type StudyMode = TutorMode;

export type StudyActivityPhase = 'draft' | 'submitted' | 'grading' | 'feedback' | 'failed' | 'cancelled';

export const STUDY_PHASES: readonly StudyActivityPhase[] = [
  'draft',
  'submitted',
  'grading',
  'feedback',
  'failed',
  'cancelled',
];

export interface StudySource {
  readonly sourceRefId: Id;
  readonly pdfPage: number;
  readonly printedPage: string | null;
  readonly label: string;
  readonly verification: SourceVerificationState;
}

export interface StudyWorkspace {
  readonly courseEditionId: Id;
  readonly courseEditionLabel: string;
  readonly packId: Id;
  readonly packVersion: string;
  readonly trustMode: TrustMode;
  readonly scope: PackScope;
  readonly coverageStatus: PackCoverageStatus;
  readonly concept: Concept;
  readonly activities: readonly Activity[];
  readonly activity: Activity;
  readonly progress: ConceptProgress | null;
  readonly selfReport: SelfReport | null;
  readonly sources: readonly StudySource[];
  readonly reviewRange: StudyReviewRange | null;
  readonly compatibility: {
    readonly previousPackVersion: string;
    readonly currentPackVersion: string;
    readonly reason: string;
  } | null;
  readonly imageFlow: ImageFlowLike | null;
  readonly fixture: boolean;
  readonly notice: string | null;
}

export interface StudyReviewCandidate {
  readonly conceptId: Id;
  readonly title: string;
  readonly reason: 'due' | 'needs_support' | 'chosen';
  readonly dueAt: Timestamp | null;
  readonly lastReviewedAt: Timestamp | null;
  readonly activityId: Id | null;
}

export interface StudyReviewRange {
  readonly candidates: readonly StudyReviewCandidate[];
  readonly policyVersion: string;
  readonly note: string;
}

export interface StudyDraft {
  readonly conceptId: Id;
  readonly mode: StudyMode;
  readonly activityId: Id;
  readonly answer: AnswerFormValue;
  readonly savedAt: Timestamp;
}

export interface StudyDraftKey {
  readonly conceptId: Id;
  readonly mode: StudyMode;
  readonly activityId: Id;
}

export interface StudyFinishReceipt {
  /** The concrete progress object is read back via `loadProgress`; keep unknown to match T07. */
  readonly progress: unknown;
  readonly dueAt: Timestamp;
  readonly policyVersion: string;
  readonly outcome?: string | null;
  readonly early?: boolean;
}

/**
 * Structural subset of T07 `TutorService` used by the workspace. The real
 * service is assignable to this shape; methods not needed by the UI are left
 * out on purpose.
 */
export interface StudyTutorPort {
  startSession(ctx: RequestContext, request: TutorStartSessionRequest): Promise<ServiceResult<StartedTutorSession>>;
  submitTurn(ctx: RequestContext, input: TutorTurnInput): Promise<ServiceResult<StudyTurnOutcome>>;
  skip(
    ctx: RequestContext,
    request: Omit<TutorTurnInput, 'attempt' | 'message' | 'helpRequest' | 'skip' | 'end'>,
  ): Promise<ServiceResult<StudyTurnOutcome>>;
  end(
    ctx: RequestContext,
    request: Omit<TutorTurnInput, 'attempt' | 'message' | 'helpRequest' | 'skip' | 'end'> & {
      readonly completed: boolean;
    },
  ): Promise<ServiceResult<StudyTurnOutcome>>;
  finishLearning(
    ctx: RequestContext,
    request: { readonly requestId: string; readonly sessionId: Id; readonly revision: number },
  ): Promise<ServiceResult<StudyFinishReceipt>>;
  finishReview(
    ctx: RequestContext,
    request: {
      readonly requestId: string;
      readonly sessionId: Id;
      readonly revision: number;
      readonly outcome?: 'needs_support' | 'developing' | 'supported';
    },
  ): Promise<ServiceResult<StudyFinishReceipt>>;
  retryPendingGrading(
    ctx: RequestContext,
    request: { readonly sessionId: Id; readonly requestId: string },
  ): Promise<ServiceResult<StudyAttemptOutcome>>;
}

export interface StudyDecision {
  readonly action: string;
  readonly rationale: string;
  readonly disclosure: boolean;
  readonly guidance: string;
  readonly difficulty: 'same' | 'reduced' | 'increased';
  readonly representationChanged?: boolean;
  readonly factualClaims?: boolean;
  readonly sourceRefs: readonly Id[];
  readonly reviewStage?: string | null;
}

export interface StudyTurnState {
  readonly revision: number;
  readonly consecutiveFailures: number;
  readonly difficulty: 'standard' | 'reduced';
  readonly currentActivityId: Id | null;
  readonly reviewStage: 'recall' | 'discriminate' | 'transfer' | 'prerequisite' | null;
  readonly status: 'active' | 'completed' | 'abandoned';
  readonly helpKinds: readonly HelpKind[];
  readonly disclosure: boolean;
}

export interface StudyGradeResult {
  readonly criteria: readonly {
    readonly criterionId: Id;
    readonly met: 'yes' | 'no' | 'unclear';
    readonly rationale: string;
  }[];
  readonly feedback: string;
  readonly uncertainties: readonly string[];
  readonly evidenceCandidates: readonly unknown[];
  readonly requiresClarification: boolean;
  readonly sourceRefs: readonly Id[];
  readonly graderVersion: string;
}

export interface StudyAttemptOutcome {
  readonly attempt: import('@edu/domain').ActivityAttempt;
  readonly attemptId: Id;
  readonly persisted: boolean;
  readonly duplicate: boolean;
  readonly grade: StudyGradeResult | null;
  readonly feedbackPending: boolean;
  readonly completedAt: Timestamp;
}

/** Structural subset of T07 `TutorTurnOutcome` consumed by the UI. */
export interface StudyTurnOutcome {
  readonly revision: number;
  readonly message: string;
  readonly decision: StudyDecision;
  readonly state: StudyTurnState;
  readonly attemptOutcome: StudyAttemptOutcome | null;
  /** Present for image answers; absent on text turns. */
  readonly image?: StudyImageInfo | null;
}

export interface StudyImageSubmit {
  /** Session the activity was started in; the attempt is bound to it. */
  readonly sessionId: Id;
  readonly activityId: Id;
  readonly assetId: Id;
  readonly answerText: string | null;
  /** Selected image bytes (base64, no data: prefix); required by the real route. */
  readonly base64?: string | null;
  readonly mime?: string;
  readonly width?: number;
  readonly height?: number;
}

export interface StudyImageQualitySignal {
  readonly status: string;
  readonly forcedClarification: boolean;
  readonly reasons: readonly string[];
  readonly note: string;
}

/**
 * Image-specific result metadata from `/edu/api/g1/image`. `stage` is the
 * pipeline stage (`graded` / `clarification_required` / `degraded_text` /
 * `pending_existing`), never a local verdict.
 */
export interface StudyImageInfo {
  readonly stage: string;
  readonly modelCalled: boolean;
  readonly evidenceCandidates: readonly unknown[];
  readonly gate: {
    readonly refused: boolean;
    readonly reasons: readonly string[];
    readonly accepted?: readonly unknown[];
    readonly rejected?: readonly unknown[];
  } | null;
  readonly qualitySignal: StudyImageQualitySignal | null;
  readonly clarification: {
    readonly reasons: readonly string[];
    readonly message: string;
    readonly actions: readonly string[];
  } | null;
  readonly persistence: {
    readonly attemptId?: Id;
    readonly sessionId?: Id | null;
    readonly duplicate?: boolean;
    readonly assessmentCommitted?: boolean;
    readonly evidenceAccepted?: number;
    readonly evidenceRejected?: number;
    readonly feedbackPending?: boolean;
    readonly note?: string;
    readonly error?: { readonly code: string; readonly message: string } | null;
  } | null;
}

export interface StudyDataSource extends StudyTutorPort {
  readonly kind: 'fixture' | 'live';
  readonly notice: string | null;
  loadWorkspace(
    ctx: RequestContext,
    input: {
      readonly conceptId: Id;
      readonly mode: StudyMode;
      readonly sessionId?: Id;
      readonly activityId?: Id | null;
    },
  ): Promise<ServiceResult<StudyWorkspace>>;
  loadProgress(ctx: RequestContext, conceptId: Id): Promise<ServiceResult<ConceptProgress>>;
  loadReviewRange(ctx: RequestContext): Promise<ServiceResult<StudyReviewRange>>;
  deferReview(
    ctx: RequestContext,
    conceptId: Id,
  ): Promise<ServiceResult<{ readonly dueAt: Timestamp; readonly deferred: true }>>;
  loadDraft(ctx: RequestContext, key: StudyDraftKey): Promise<ServiceResult<StudyDraft | null>>;
  saveDraft(ctx: RequestContext, draft: StudyDraft): Promise<ServiceResult<{ readonly savedAt: Timestamp }>>;
  clearDraft(ctx: RequestContext, key: StudyDraftKey): Promise<ServiceResult<{ readonly cleared: true }>>;
  saveSelfReport(
    ctx: RequestContext,
    input: { readonly conceptId: Id; readonly claimedState: 'uncertain' | 'basically_understood' | 'can_explain' },
  ): Promise<ServiceResult<SelfReport>>;
  submitImageAnswer?(
    ctx: RequestContext,
    input: StudyImageSubmit,
  ): Promise<ServiceResult<StudyTurnOutcome>>;
}

export type { TutorTurnOutcome, TutorSessionState, AnswerFormValue, ImageFlowLike };
