/**
 * Evidence normalization and understanding derivation for T06.
 *
 * The frozen domain rules (`deriveUnderstandingState`, `attemptAssistance`,
 * `checkEvidenceAgainstAttempt`) stay the single source of truth. This module
 * adds the learner policy layer that 05 §3.2 requires on top of them:
 * - model low confidence / explicit uncertainty becomes `validity=pending`;
 * - an answer that was produced after seeing an explanation or a worked
 *   solution is not independent evidence for that round (stricter than the
 *   domain minimum, which only forces `assisted` for answer disclosure);
 * - every judgement keeps a rationale and the rubric/evaluator versions.
 */

import type {
  ActivityAttempt,
  Assessment,
  Evidence,
  Id,
  IdGenerator,
  Timestamp,
  TrustMode,
  UnderstandingState,
  Validity,
} from '@edu/domain';
import {
  attemptAssistance,
  deriveUnderstandingState,
  isAnswerDisclosed,
  type DeriveUnderstandingInput,
  type UnderstandingDerivation,
  type UnderstandingEvidenceInput,
} from '@edu/domain';
import type { EffectiveEvidence } from './projection.js';

/** Model uncertainty above this threshold is low confidence (product heuristic). */
export const LOW_CONFIDENCE_UNCERTAINTY_THRESHOLD = 0.5;

/**
 * Help kinds that make the following answer non-independent for this round.
 * `worked_solution`/`answer` already force `assisted` in the frozen domain;
 * `explanation` is added here because the product contract says a shown
 * explanation cannot be used as independent evidence in the same round.
 */
export const ROUND_INDEPENDENCE_BLOCKING_HELP_KINDS = [
  'explanation',
  'worked_solution',
  'answer',
] as const;

export interface RoundIndependence {
  readonly independent: boolean;
  readonly answerDisclosed: boolean;
  readonly helpKinds: readonly string[];
}

/** Whether an attempt counts as independent evidence for this round. */
export function roundIndependence(attempt: ActivityAttempt): RoundIndependence {
  const helpKinds = attempt.helpUsed.map((help) => help.kind);
  const answeredWithDisclosure = isAnswerDisclosed(attempt);
  const explained = helpKinds.some((kind) =>
    (ROUND_INDEPENDENCE_BLOCKING_HELP_KINDS as readonly string[]).includes(kind),
  );
  const answerDisclosed = answeredWithDisclosure || explained;
  return {
    independent: !answerDisclosed && attemptAssistance(attempt) === 'unassisted',
    answerDisclosed,
    helpKinds,
  };
}

/** Low confidence / explicit pending evidence must not change understanding. */
export function normalizeCommittedEvidence(evidence: Evidence): Evidence {
  const modelLowConfidence =
    evidence.assessmentOrigin === 'model' &&
    (evidence.uncertainty === null ||
      evidence.uncertainty > LOW_CONFIDENCE_UNCERTAINTY_THRESHOLD);
  if (evidence.validity === 'pending' || modelLowConfidence) {
    return { ...evidence, validity: 'pending' };
  }
  return evidence;
}

export interface DerivationResult {
  readonly derivation: UnderstandingDerivation;
  readonly pendingEvidenceIds: readonly Id[];
  readonly counterEvidenceIds: readonly Id[];
  readonly independentEvidenceIds: readonly Id[];
  readonly currentEvidenceIds: readonly Id[];
  readonly inputs: readonly UnderstandingEvidenceInput[];
}

export interface DerivationRequest {
  readonly conceptId: Id;
  readonly rubricVersion: string;
  readonly trustMode: TrustMode;
  readonly evidences: readonly EffectiveEvidence[];
  readonly attempts: ReadonlyMap<Id, ActivityAttempt>;
  readonly coreMisconceptionEvidenceIds: readonly Id[];
}

function isCounter(effective: EffectiveEvidence): boolean {
  if (effective.coreMisconception) return true;
  if (effective.evidence.criterionResults.length === 0) return false;
  return effective.evidence.criterionResults.every((result) => result.result === 'not_met');
}

/**
 * Build the deterministic derivation input from stored evidence. Validity
 * overlays (stale/needs_recheck after revision or time passage) are respected;
 * pending checks are also surfaced for the rationale writer.
 */
export function deriveConceptUnderstanding(request: DerivationRequest): DerivationResult {
  const inputs: UnderstandingEvidenceInput[] = [];
  const pendingEvidenceIds: Id[] = [];
  const counterEvidenceIds: Id[] = [];
  const independentEvidenceIds: Id[] = [];
  const currentEvidenceIds: Id[] = [];

  for (const effective of request.evidences) {
    const attempt = request.attempts.get(effective.evidence.attemptId);
    const independence =
      attempt === undefined
        ? { independent: false, answerDisclosed: false }
        : roundIndependence(attempt);
    const validity = effective.validity;
    const lowConfidence =
      effective.evidence.assessmentOrigin === 'model' &&
      (effective.evidence.uncertainty === null ||
        effective.evidence.uncertainty > LOW_CONFIDENCE_UNCERTAINTY_THRESHOLD);
    const isPending = validity === 'pending' || lowConfidence;
    const coreMisconception =
      effective.coreMisconception ||
      request.coreMisconceptionEvidenceIds.includes(effective.evidence.id);
    const input: UnderstandingEvidenceInput = {
      kind: effective.evidence.kind,
      assistance: effective.evidence.assistance,
      assessmentOrigin: effective.evidence.assessmentOrigin,
      uncertainty: effective.evidence.uncertainty,
      validity,
      criterionResults: effective.evidence.criterionResults,
      attemptId: effective.evidence.attemptId,
      activityId: attempt?.activityId ?? null,
      coreMisconception,
      answerDisclosed: effective.answerDisclosed || independence.answerDisclosed,
    };
    inputs.push(input);

    if (isPending) pendingEvidenceIds.push(effective.evidence.id);
    if (validity === 'current' && !isPending) {
      currentEvidenceIds.push(effective.evidence.id);
      // Counter evidence must be independent too (05 §3.2; REVIEW-01 H-01).
      // The domain helper enforces the same rule; keeping this reporting list
      // aligned prevents rationale/explain from attributing a demotion to an
      // assisted or after-disclosure answer.
      if (independence.independent && isCounter(effective)) {
        counterEvidenceIds.push(effective.evidence.id);
      }
      if (independence.independent) independentEvidenceIds.push(effective.evidence.id);
    }
  }

  const derivationInput: DeriveUnderstandingInput = {
    conceptId: request.conceptId,
    rubricVersion: request.rubricVersion,
    trustMode: request.trustMode,
    evidences: inputs,
    completedActivities: new Set(inputs.map((input) => input.attemptId)).size,
  };
  return {
    derivation: deriveUnderstandingState(derivationInput),
    pendingEvidenceIds,
    counterEvidenceIds,
    independentEvidenceIds,
    currentEvidenceIds,
    inputs,
  };
}

export interface BuildAssessmentRequest {
  readonly conceptId: Id;
  readonly learnerId: Id;
  readonly courseEditionId: Id;
  readonly packVersion: string;
  readonly state: Exclude<UnderstandingState, 'unassessed'>;
  readonly rationale: readonly string[];
  readonly evidenceIds: readonly Id[];
  readonly attemptId: Id;
  readonly rubricVersion: string;
  readonly evaluatorVersion: string;
  readonly assessedAt: Timestamp;
  readonly revision: number;
  readonly validity: Validity;
  readonly ids: IdGenerator;
}

/** Build an Assessment that always carries rationale, evidence ids and versions. */
export function buildAssessment(request: BuildAssessmentRequest): Assessment {
  if (request.evidenceIds.length === 0) {
    throw new Error('an assessment requires at least one evidence id');
  }
  if (request.rationale.length === 0) {
    throw new Error('an assessment requires a rationale');
  }
  return {
    schemaVersion: 1,
    id: request.ids.next('assessment'),
    attemptId: request.attemptId,
    conceptId: request.conceptId,
    learnerId: request.learnerId,
    courseEditionId: request.courseEditionId,
    packVersion: request.packVersion,
    state: request.state,
    rationale: request.rationale.join('; '),
    evidenceIds: [...new Set(request.evidenceIds)],
    rubricVersion: request.rubricVersion,
    evaluatorVersion: request.evaluatorVersion,
    assessedAt: request.assessedAt,
    validity: request.validity,
    revision: request.revision,
  };
}

/** Rationale suffix that keeps every judgement explainable. */
export function assessmentRationale(
  derivation: UnderstandingDerivation,
  extras: {
    readonly pendingCount: number;
    readonly counterCount: number;
    readonly trustMode: TrustMode;
    readonly rubricVersion: string;
  },
): string[] {
  const rationale = [...derivation.rationale];
  if (extras.pendingCount > 0) {
    rationale.push(
      `${extras.pendingCount} low-confidence evidence record(s) kept pending and excluded from the judgement`,
    );
  }
  if (extras.counterCount > 0) {
    rationale.push('new counter evidence lowered this judgement; previous judgements stay in history');
  }
  if (extras.trustMode === 'candidate') {
    rationale.push('candidate trust mode: no formal understanding claim');
  }
  rationale.push(
    `rubric ${extras.rubricVersion}; product heuristic, not a validated psychometric or memory model`,
  );
  return rationale;
}
