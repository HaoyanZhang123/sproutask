/**
 * Learner side invariants (05 §3, §5, §9).
 *
 * These are pure deterministic rules. Scheduling policy tuning, persistence
 * and projection implementation belong to T02/T06; T01 freezes the semantics
 * and the rejection boundaries.
 */

import {
  ANSWER_DISCLOSING_HELP_KINDS,
  type Assistance,
  type EvidenceKind,
  type Id,
  type ReviewOutcome,
  type Timestamp,
  type TrustMode,
  type UnderstandingState,
  type Validity,
} from '../primitives.js';
import type {
  ActivityAttempt,
  Assessment,
  ConceptProgress,
  Evidence,
  ReviewRecord,
  SelfReport,
  Session,
} from '../entities/learning.js';
import { attemptAssistance, validateAssessment } from '../entities/learning.js';
import { IssueCollector, finish, type ValidationResult } from '../validation.js';

export interface AssessmentEvidenceOptions {
  readonly evidences: readonly Evidence[];
  readonly attempts?: readonly ActivityAttempt[];
}

function isCounterEvidence(evidence: Evidence): boolean {
  if (evidence.criterionResults.length === 0) return false;
  return evidence.criterionResults.every((result) => result.result === 'not_met');
}

function isLowConfidence(evidence: Evidence): boolean {
  if (evidence.validity === 'pending') return true;
  if (evidence.assessmentOrigin === 'model') {
    return evidence.uncertainty === null || evidence.uncertainty > 0.5;
  }
  return false;
}

/**
 * Structural assessment validation plus the evidence/attempt pool checks:
 * supported needs explain + transfer/discriminate evidence from two completed
 * activities, at least one unassisted, and no unresolved counter evidence.
 */
export function validateAssessmentWithEvidence(
  input: unknown,
  options: AssessmentEvidenceOptions,
): ValidationResult<Assessment> {
  const structural = validateAssessment(input);
  if (!structural.ok) return structural;
  const assessment = structural.value;
  const issues = new IssueCollector();
  const evidenceById = new Map(options.evidences.map((evidence) => [evidence.id, evidence]));
  const attemptById = new Map((options.attempts ?? []).map((attempt) => [attempt.id, attempt]));
  const resolved: Evidence[] = [];

  for (const evidenceId of assessment.evidenceIds) {
    const evidence = evidenceById.get(evidenceId);
    if (evidence === undefined) {
      issues.add(
        'DANGLING_REFERENCE',
        '$.evidenceIds',
        `evidence ${evidenceId} does not exist`,
      );
      continue;
    }
    resolved.push(evidence);
    if (evidence.conceptId !== assessment.conceptId) {
      issues.add(
        'INVALID_REFERENCE',
        `$.evidenceIds.${evidenceId}.conceptId`,
        'evidence belongs to another concept',
      );
    }
    if (
      evidence.learnerId !== assessment.learnerId ||
      evidence.courseEditionId !== assessment.courseEditionId ||
      evidence.packVersion !== assessment.packVersion
    ) {
      issues.add(
        'INVALID_REFERENCE',
        `$.evidenceIds.${evidenceId}`,
        'evidence is bound to a different learner / course edition / pack version',
      );
    }
    if (evidence.validity === 'stale' || evidence.validity === 'needs_recheck') {
      issues.add(
        'INVALID_REFERENCE',
        `$.evidenceIds.${evidenceId}.validity`,
        `evidence validity ${evidence.validity} cannot support a current assessment`,
      );
    }
  }

  if (assessment.state === 'supported') {
    if (assessment.validity !== 'current') {
      issues.add(
        'LOW_CONFIDENCE_UPGRADE',
        '$.validity',
        'supported requires validity=current',
      );
    }
    const current = resolved.filter((evidence) => evidence.validity === 'current');
    const kinds = new Set<EvidenceKind>(current.map((evidence) => evidence.kind));
    if (!kinds.has('explain') || !(kinds.has('transfer') || kinds.has('discriminate'))) {
      issues.add(
        'ASSESSMENT_WITHOUT_EVIDENCE',
        '$.state',
        'supported needs both explanation and transfer/discrimination evidence',
      );
    }
    const attemptIds = new Set(
      current.map((evidence) => evidence.attemptId).filter((value): value is string => value !== null),
    );
    if (attemptIds.size < 2) {
      issues.add(
        'ASSESSMENT_WITHOUT_EVIDENCE',
        '$.evidenceIds',
        'supported requires evidence from at least two completed activities',
      );
    }
    const independent = current.filter((evidence) => {
      const attempt = attemptById.get(evidence.attemptId);
      if (attempt !== undefined) {
        return attemptAssistance(attempt) === 'unassisted';
      }
      return evidence.assistance === 'unassisted';
    });
    if (independent.length === 0) {
      issues.add(
        'ASSESSMENT_WITHOUT_EVIDENCE',
        '$.state',
        'supported requires at least one unassisted attempt without a disclosed answer',
      );
    }
    if (current.some(isCounterEvidence)) {
      issues.add(
        'ASSESSMENT_COUNTER_EVIDENCE',
        '$.evidenceIds',
        'supported cannot coexist with unresolved counter evidence',
      );
    }
    if (current.some((evidence) => isLowConfidence(evidence))) {
      issues.add(
        'ASSESSMENT_WITHOUT_EVIDENCE',
        '$.evidenceIds',
        'low-confidence model evidence cannot support a strong state',
      );
    }
  }

  return finish(assessment, issues);
}

/**
 * Candidate trial sessions may record drafts but can never produce a formal
 * supported state; everything is bound to the same content version.
 */
export function validateAssessmentForSession(
  input: unknown,
  session: Session,
): ValidationResult<Assessment> {
  const structural = validateAssessment(input);
  if (!structural.ok) return structural;
  const assessment = structural.value;
  const issues = new IssueCollector();
  if (assessment.conceptId !== session.conceptId) {
    issues.add('INVALID_REFERENCE', '$.conceptId', 'assessment belongs to another concept');
  }
  if (assessment.learnerId !== session.learnerId) {
    issues.add('INVALID_REFERENCE', '$.learnerId', 'assessment belongs to another learner');
  }
  if (
    assessment.courseEditionId !== session.courseEditionId ||
    assessment.packVersion !== session.packVersion
  ) {
    issues.add(
      'INVALID_REFERENCE',
      '$.packVersion',
      'assessment is bound to a different course edition / pack version',
    );
  }
  if (session.trustMode === 'candidate') {
    if (assessment.state === 'supported') {
      issues.add(
        'CANDIDATE_STRONG_CLAIM',
        '$.state',
        'candidate sessions cannot produce supported understanding',
      );
    }
    if (assessment.validity === 'current') {
      issues.add(
        'CANDIDATE_STRONG_CLAIM',
        '$.validity',
        'candidate trial assessments must remain pending/needs_recheck',
      );
    }
  }
  return finish(assessment, issues);
}

/** Evidence can only be persisted against the attempt it came from. */
export function checkEvidenceAgainstAttempt(
  evidence: Evidence,
  attempt: ActivityAttempt,
): ValidationResult<Evidence> {
  const issues = new IssueCollector();
  if (evidence.attemptId !== attempt.id) {
    issues.add('INVALID_REFERENCE', '$.attemptId', 'evidence does not belong to this attempt');
  }
  if (evidence.learnerId !== attempt.learnerId) {
    issues.add('INVALID_REFERENCE', '$.learnerId', 'evidence belongs to another learner');
  }
  if (
    evidence.courseEditionId !== attempt.courseEditionId ||
    evidence.packVersion !== attempt.packVersion
  ) {
    issues.add(
      'INVALID_REFERENCE',
      '$.packVersion',
      'evidence is bound to a different course edition / pack version',
    );
  }
  if (!attempt.conceptIds.includes(evidence.conceptId)) {
    issues.add(
      'INVALID_REFERENCE',
      '$.conceptId',
      'evidence concept is not part of the submitted activity',
    );
  }
  const derivedAssistance: Assistance = attemptAssistance(attempt);
  if (evidence.assistance !== derivedAssistance) {
    issues.add(
      'INVALID_REFERENCE',
      '$.assistance',
      `assistance must be ${derivedAssistance} for this attempt (answer disclosure is derived)`,
    );
  }
  return finish(evidence, issues);
}

export function isAnswerDisclosed(attempt: Pick<ActivityAttempt, 'helpUsed'>): boolean {
  return attempt.helpUsed.some((help) => ANSWER_DISCLOSING_HELP_KINDS.includes(help.kind));
}

export interface UnderstandingEvidenceInput {
  readonly kind: EvidenceKind;
  readonly assistance: Assistance;
  readonly assessmentOrigin: 'rule' | 'model' | 'human';
  readonly uncertainty: number | null;
  readonly validity: Validity;
  readonly criterionResults: readonly { readonly result: 'met' | 'not_met' | 'unclear' }[];
  readonly attemptId: Id;
  readonly activityId: Id | null;
  readonly coreMisconception: boolean;
  readonly answerDisclosed: boolean;
}

export interface DeriveUnderstandingInput {
  readonly conceptId: Id;
  readonly rubricVersion: string;
  readonly trustMode: TrustMode;
  readonly evidences: readonly UnderstandingEvidenceInput[];
  readonly completedActivities: number;
}

export interface UnderstandingDerivation {
  readonly state: UnderstandingState;
  readonly rationale: readonly string[];
  readonly rubricVersion: string;
  readonly pendingEvidenceCount: number;
  readonly counterEvidenceCount: number;
  readonly requiresRecheck: boolean;
}

/**
 * Deterministic rule skeleton from 05 §3.2. Thresholds are product
 * heuristics, not a validated psychometric model; callers must store the
 * rubricVersion with the judgement.
 */
export function deriveUnderstandingState(input: DeriveUnderstandingInput): UnderstandingDerivation {
  const rationale: string[] = [];
  if (input.trustMode === 'candidate') {
    return {
      state: 'unassessed',
      rationale: ['candidate trust mode: formal understanding stays unassessed'],
      rubricVersion: input.rubricVersion,
      pendingEvidenceCount: input.evidences.length,
      counterEvidenceCount: 0,
      requiresRecheck: false,
    };
  }

  const pending = input.evidences.filter(
    (evidence) =>
      evidence.validity === 'pending' ||
      (evidence.assessmentOrigin === 'model' &&
        (evidence.uncertainty === null || evidence.uncertainty > 0.5)),
  );
  const current = input.evidences.filter(
    (evidence) => evidence.validity === 'current' && !pending.includes(evidence),
  );
  const independent = current.filter(
    (evidence) => evidence.assistance === 'unassisted' && !evidence.answerDisclosed,
  );
  // Counter evidence must be independent too: an assisted answer, or one given after
  // the answer was disclosed, cannot demote a judgement (REVIEW-01 H-01, 05 §3.2).
  const counter = independent.filter(
    (evidence) =>
      evidence.coreMisconception ||
      (evidence.criterionResults.length > 0 &&
        evidence.criterionResults.every((result) => result.result === 'not_met')),
  );
  const kinds = new Set(independent.map((evidence) => evidence.kind));
  const attemptIds = new Set(independent.map((evidence) => evidence.attemptId));
  let requiresRecheck = false;

  if (counter.length > 0) {
    rationale.push('unresolved counter evidence / core misconception');
    return {
      state: 'needs_support',
      rationale,
      rubricVersion: input.rubricVersion,
      pendingEvidenceCount: pending.length,
      counterEvidenceCount: counter.length,
      requiresRecheck,
    };
  }
  if (independent.length === 0) {
    rationale.push('no valid independent evidence; viewing/self-report does not upgrade');
    return {
      state: 'unassessed',
      rationale,
      rubricVersion: input.rubricVersion,
      pendingEvidenceCount: pending.length,
      counterEvidenceCount: 0,
      requiresRecheck: false,
    };
  }
  const hasExplain = kinds.has('explain');
  const hasTransferOrDiscriminate = kinds.has('transfer') || kinds.has('discriminate');
  if (hasExplain && hasTransferOrDiscriminate && attemptIds.size >= 2) {
    rationale.push('explanation plus transfer/discrimination evidence from separate attempts');
    return {
      state: 'supported',
      rationale,
      rubricVersion: input.rubricVersion,
      pendingEvidenceCount: pending.length,
      counterEvidenceCount: 0,
      requiresRecheck: false,
    };
  }
  if (hasExplain || hasTransferOrDiscriminate) {
    rationale.push('valid explanation/discrimination evidence but transfer or cross-attempt consistency is missing');
    return {
      state: 'developing',
      rationale,
      rubricVersion: input.rubricVersion,
      pendingEvidenceCount: pending.length,
      counterEvidenceCount: 0,
      requiresRecheck: false,
    };
  }
  rationale.push('only recall/label evidence; limited judgement');
  if (input.evidences.some((evidence) => evidence.validity === 'needs_recheck')) {
    requiresRecheck = true;
    rationale.push('some evidence needs recheck after content revision');
  }
  return {
    state: 'developing',
    rationale,
    rubricVersion: input.rubricVersion,
    pendingEvidenceCount: pending.length,
    counterEvidenceCount: 0,
    requiresRecheck,
  };
}

export interface SelfReportProjection {
  readonly progress: ConceptProgress;
  /** Self report is stored separately and never rewrites understanding. */
  readonly learningClaimIgnored: true;
  readonly diagnosticSuggested: boolean;
  readonly claimedState: SelfReport['claimedState'];
}

export function applySelfReport(
  progress: ConceptProgress,
  report: SelfReport,
): ValidationResult<SelfReportProjection> {
  const issues = new IssueCollector();
  if (
    progress.learnerId !== report.learnerId ||
    progress.courseEditionId !== report.courseEditionId ||
    progress.packVersion !== report.packVersion ||
    progress.conceptId !== report.conceptId
  ) {
    issues.add(
      'INVALID_REFERENCE',
      '$.conceptId',
      'self report is bound to a different learner / course edition / pack version / concept',
    );
  }
  if (issues.count > 0) return { ok: false, issues: issues.list };
  return finish(
    {
      progress,
      learningClaimIgnored: true,
      diagnosticSuggested: true,
      claimedState: report.claimedState,
    },
    issues,
  );
}

/** Candidate progress must never display formal understanding. */
export function validateProgressForTrust(
  progress: ConceptProgress,
  trustMode: TrustMode,
): ValidationResult<ConceptProgress> {
  const issues = new IssueCollector();
  if (trustMode === 'candidate' && progress.understanding.state !== 'unassessed') {
    issues.add(
      'CANDIDATE_STRONG_CLAIM',
      '$.understanding.state',
      'candidate trial progress must keep formal understanding unassessed',
    );
  }
  return finish(progress, issues);
}

export function isEverReviewed(review: ReviewRecord): boolean {
  return review.lastCompletedAt !== null;
}

/** Reviewed and due are independent (05 §3.3). */
export function isReviewDue(review: ReviewRecord, now: Timestamp): boolean {
  if (review.dueAt === null) return false;
  const due = Date.parse(review.dueAt);
  const current = Date.parse(now);
  if (!Number.isFinite(due) || !Number.isFinite(current)) return false;
  return current >= due;
}

export interface ReviewProjection {
  readonly everReviewed: boolean;
  readonly isDue: boolean;
  readonly latestOutcome: ReviewOutcome | null;
}

export function projectReview(review: ReviewRecord, now: Timestamp): ReviewProjection {
  return {
    everReviewed: isEverReviewed(review),
    isDue: isReviewDue(review, now),
    latestOutcome: review.latestOutcome,
  };
}
