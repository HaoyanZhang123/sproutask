/**
 * Public learner service types.
 *
 * `ConceptProgress` stays the frozen domain entity (05 §2); these types only
 * add service level views: explanation payloads, review queue entries, first-use
 * plans, aggregates and compatibility results.
 */

import type {
  Assessment,
  Clock,
  ConceptProgress,
  Evidence,
  IdGenerator,
  Id,
  JournalCommand,
  RequestContext,
  ReviewOutcome,
  SelfReport,
  Session,
  Timestamp,
  TrustMode,
  UnderstandingState,
  Validity,
} from '@edu/domain';
import type { StorageService } from '@edu/storage';
import type { ReviewPolicy } from './policy.js';

export interface LearnerServiceOptions {
  /** Real storage instance; the learner package never opens files itself. */
  readonly storage: StorageService;
  readonly clock: Clock;
  readonly ids: IdGenerator;
  /** Host bound local anonymous learner; one service instance per learner. */
  readonly learnerId: Id;
  readonly policy?: ReviewPolicy;
}

export interface ProgressKeyLike {
  readonly learnerId: Id;
  readonly courseEditionId: Id;
  readonly packVersion: string;
  readonly conceptId: Id;
}

export interface SubmitAttemptResult {
  readonly attemptId: Id;
  readonly seq: number;
  readonly duplicate: boolean;
}

export interface AssessmentOutcome {
  readonly conceptId: Id;
  /** `assessment` when a judgement was committed; `evidence_only` otherwise. */
  readonly kind: 'assessment' | 'evidence_only';
  readonly progress: ConceptProgress;
  readonly assessment: Assessment | null;
  readonly committedEvidenceIds: readonly Id[];
  readonly pendingEvidenceIds: readonly Id[];
  readonly derivedState: UnderstandingState;
  readonly rationale: readonly string[];
  readonly rubricVersion: string;
  readonly evaluatorVersion: string;
  readonly duplicate: boolean;
}

export interface LearningCompletionResult {
  readonly progress: ConceptProgress;
  readonly dueAt: Timestamp;
  readonly policyVersion: string;
  readonly duplicate: boolean;
}

export interface ReviewCompletionResult {
  readonly progress: ConceptProgress;
  readonly dueAt: Timestamp;
  readonly outcome: ReviewOutcome;
  readonly early: boolean;
  readonly previousDueAt: Timestamp | null;
  readonly policyVersion: string;
  readonly duplicate: boolean;
}

export interface ReviewDeferralResult {
  readonly progress: ConceptProgress;
  readonly previousDueAt: Timestamp;
  readonly newDueAt: Timestamp;
  readonly duplicate: boolean;
}

export interface ReviewQueueItem {
  readonly conceptId: Id;
  readonly courseEditionId: Id;
  readonly packVersion: string;
  readonly dueAt: Timestamp;
  readonly overdue: boolean;
  readonly activeSessionId: Id | null;
  readonly latestOutcome: ReviewOutcome | null;
  readonly everReviewed: boolean;
}

export interface EvidenceExplanationItem {
  readonly evidenceId: Id;
  readonly attemptId: Id;
  readonly kind: Evidence['kind'];
  readonly observation: string;
  readonly criterionResults: Evidence['criterionResults'];
  readonly assistance: Evidence['assistance'];
  readonly answerDisclosed: boolean;
  readonly coreMisconception: boolean;
  readonly validity: Validity;
  readonly createdAt: Timestamp;
}

export interface AssessmentHistoryItem {
  readonly assessmentId: Id;
  readonly state: Assessment['state'];
  readonly validity: Validity;
  readonly assessedAt: Timestamp;
  readonly rationale: string;
  readonly evidenceIds: readonly Id[];
  readonly rubricVersion: string;
  readonly evaluatorVersion: string;
  readonly staledAt: Timestamp | null;
}

export interface UnderstandingExplanation {
  readonly progress: ConceptProgress;
  readonly state: UnderstandingState;
  readonly validity: Validity;
  readonly assessmentId: Id | null;
  readonly updatedAt: Timestamp | null;
  readonly rationale: string;
  readonly rubricVersion: string | null;
  readonly evaluatorVersion: string | null;
  readonly assessedAt: Timestamp | null;
  readonly evidence: readonly EvidenceExplanationItem[];
  readonly history: readonly AssessmentHistoryItem[];
  readonly pendingEvidenceIds: readonly Id[];
  readonly counterEvidenceIds: readonly Id[];
  readonly stale: boolean;
  readonly requiresRecheck: boolean;
  readonly review: {
    readonly dueAt: Timestamp | null;
    readonly everReviewed: boolean;
    readonly isDue: boolean;
  };
  readonly historyInherited: boolean;
  readonly trustMode: TrustMode;
  /** Every judgement carries its versions; this note forbids mastery % claims. */
  readonly policyNote: string;
}

export interface SelfReportResult {
  readonly progress: ConceptProgress;
  readonly storedSeparately: true;
  readonly diagnosticSuggested: boolean;
  readonly selfReportId: Id;
  readonly selfReportCount: number;
  readonly duplicate: boolean;
}

export interface DiagnosticSuggestion {
  readonly conceptId: Id;
  readonly reason: string;
}

export interface FirstUsePlan {
  readonly declaredScope: readonly Id[];
  readonly diagnosticSuggestions: readonly DiagnosticSuggestion[];
  readonly untestedConceptIds: readonly Id[];
  readonly note: string;
  readonly diagnosticSkipped: boolean;
}

export interface ScopeDeclarationResult extends FirstUsePlan {
  readonly declaredAt: Timestamp;
  readonly duplicate: boolean;
}

export interface AggregateInput {
  /** Frozen content denominator for this pack/edition; duplicates are collapsed. */
  readonly availableConceptIds: readonly Id[];
  /** Unpublished candidate concepts are counted but never mixed into formal totals. */
  readonly candidateConceptIds?: readonly Id[];
  readonly now: Timestamp;
}

export interface AggregateConcept {
  readonly conceptId: Id;
  readonly courseEditionId: Id;
  readonly packVersion: string;
  readonly learning: ConceptProgress['learning']['state'];
  readonly understanding: UnderstandingState;
  readonly reviewDue: boolean;
  readonly dueAt: Timestamp | null;
  readonly trustMode: TrustMode;
  readonly historyInherited: boolean;
}

export interface AggregateResult {
  readonly availableTotal: number;
  readonly learnedCount: number;
  readonly inProgressCount: number;
  readonly dueCount: number;
  readonly needsSupportCount: number;
  readonly candidateCount: number;
  readonly candidateConceptIds: readonly Id[];
  /** Learning-activity coverage only; never a mastery rate. */
  readonly activityCoverage: {
    readonly numerator: number;
    readonly denominator: number;
    readonly percent: number | null;
    readonly label: 'activity_coverage_not_mastery';
  };
  readonly concepts: readonly AggregateConcept[];
  readonly policyNote: string;
}

export interface CompatibilityApplyResult {
  readonly mapId: Id;
  readonly fromPackVersion: string;
  readonly toPackVersion: string;
  readonly newConceptIds: readonly Id[];
  readonly inheritedConceptIds: readonly Id[];
  readonly evidenceEffects: readonly {
    readonly conceptId: Id;
    readonly packVersion: string;
    readonly effect: string;
    readonly reason: string;
  }[];
  readonly duplicate: boolean;
}

export interface ValidityRefreshResult {
  readonly staledConceptIds: readonly Id[];
  readonly progress: readonly ConceptProgress[];
  readonly duplicate: boolean;
}

export interface LearnerFeatureModuleLike {
  readonly feature: {
    readonly id: string;
    readonly version: string;
    readonly apiVersion: 1;
    readonly requiredCapabilities: readonly [];
    readonly description: string;
  };
  registerEducationFeature(context: unknown, services: unknown): void;
}

export interface LearnerServiceCallbackContext {
  readonly ctx: RequestContext;
}

export interface ReplayComparison {
  readonly learnerId: Id;
  readonly live: readonly ConceptProgress[];
  readonly replayed: readonly ConceptProgress[];
  readonly identical: boolean;
  readonly journalCommits: number;
  readonly invalidPayloads: readonly { readonly seq: number; readonly message: string }[];
}

export type { JournalCommand, Session, SelfReport };
