/**
 * Evidence guard (card T07: "模型只建议不落盘").
 *
 * A model may only *propose* evidence candidates. This module validates every
 * candidate against the frozen attempt/activity/rubric contract before the
 * learner service is allowed to commit anything:
 *
 *   - the grade must belong to the submitted attempt;
 *   - the evidence concept must be part of the activity;
 *   - assistance must reflect the actual help/disclosure of this round
 *     (a model claiming `unassisted` after an answer was shown is a forgery);
 *   - every source ref must be resolvable inside the concept/activity/rubric;
 *   - every criterion id must exist in the rubric and the rubric version must
 *     match the activity;
 *   - model-origin candidates must carry a model run id and an uncertainty.
 *
 * Rejected candidates are returned with reasons (the caller audits them) and
 * never reach storage. Accepted candidates become `Evidence` entities; the
 * learner service still applies its own evidence rules on top.
 */

import type {
  Activity,
  ActivityAttempt,
  Clock,
  Evidence,
  EvidenceCandidate,
  GradeResult,
  Id,
  IdGenerator,
  Rubric,
} from '@edu/domain';
import { validateEvidence, validateGradeResult } from '@edu/domain';
import { roundIndependence } from '@edu/learner';
import type { EvidenceRejection, EvidenceRejectionReason } from './types.js';

export interface EvidenceGuardRequest {
  readonly attempt: ActivityAttempt;
  readonly activity: Activity;
  readonly rubric: Rubric;
  /** Rubric version the session/turn declared; must match the activity. */
  readonly rubricVersion: string;
  readonly grade: GradeResult;
  /** An answer/worked solution was disclosed in this round. */
  readonly disclosureInRound: boolean;
  /** Resolvable source refs (concept + activity + rubric feedback sources). */
  readonly resolvableSourceRefs: readonly Id[];
  readonly coreMisconception: boolean;
  readonly ids: IdGenerator;
  readonly clock: Clock;
  /**
   * Explicit source declaration for this activity. When omitted, the activity's
   * own (optional, host-supplied) `sourceRequired` metadata is read; default is
   * `true` — evidence must cite at least one resolvable source ref.
   */
  readonly sourceRequired?: boolean;
}

/**
 * Reads the optional activity-level source declaration.
 *
 * The frozen `Activity` schema has no `sourceRequired` field yet (adding one is
 * a T01 contract change), so this reads an optional metadata property that the
 * host/content layer may attach (e.g. from curriculum metadata). Missing or
 * non-boolean means "source required".
 */
export function activityDeclaresSourceRequired(activity: Activity): boolean {
  const declared = (activity as Activity & { readonly sourceRequired?: unknown }).sourceRequired;
  return typeof declared === 'boolean' ? declared : true;
}

export interface EvidenceGuardResult {
  readonly accepted: readonly Evidence[];
  readonly rejected: readonly EvidenceRejection[];
  readonly coreMisconceptionEvidenceIds: readonly Id[];
  /** True when the grade itself is contract-invalid and nothing may be committed. */
  readonly gradeInvalid: boolean;
}

function rejection(
  index: number,
  candidate: EvidenceCandidate,
  reason: EvidenceRejectionReason,
  message: string,
): EvidenceRejection {
  return { candidateIndex: index, conceptId: candidate.conceptId, reason, message };
}

export function guardEvidence(request: EvidenceGuardRequest): EvidenceGuardResult {
  const gradeValidation = validateGradeResult(request.grade);
  if (!gradeValidation.ok) {
    const message = gradeValidation.issues[0]?.message ?? 'grade result is contract-invalid';
    return {
      accepted: [],
      rejected: request.grade.evidenceCandidates.map((candidate, index) =>
        rejection(index, candidate, 'INVALID_EVIDENCE_SHAPE', message),
      ),
      coreMisconceptionEvidenceIds: [],
      gradeInvalid: true,
    };
  }
  if (request.grade.attemptId !== request.attempt.id) {
    return {
      accepted: [],
      rejected: request.grade.evidenceCandidates.map((candidate, index) =>
        rejection(index, candidate, 'ATTEMPT_MISMATCH', 'grade belongs to a different attempt'),
      ),
      coreMisconceptionEvidenceIds: [],
      gradeInvalid: true,
    };
  }
  if (request.rubricVersion !== request.activity.rubricVersion) {
    return {
      accepted: [],
      rejected: request.grade.evidenceCandidates.map((candidate, index) =>
        rejection(
          index,
          candidate,
          'RUBRIC_VERSION_MISMATCH',
          `session rubric ${request.rubricVersion} does not match activity rubric ${request.activity.rubricVersion}`,
        ),
      ),
      coreMisconceptionEvidenceIds: [],
      gradeInvalid: true,
    };
  }

  const independence = roundIndependence(request.attempt);
  const effectiveDisclosure = independence.answerDisclosed || request.disclosureInRound;
  const allowedSources = new Set<string>([...request.resolvableSourceRefs, ...request.activity.sourceRefs]);
  const criterionIds = new Set(request.rubric.criteria.map((criterion) => criterion.criterionId));
  const activityConceptIds = new Set([...request.activity.conceptIds, ...request.attempt.conceptIds]);
  const sourceRequired = request.sourceRequired ?? activityDeclaresSourceRequired(request.activity);

  const accepted: Evidence[] = [];
  const rejected: EvidenceRejection[] = [];
  const coreIds: Id[] = [];

  for (const [index, candidate] of request.grade.evidenceCandidates.entries()) {
    if (request.grade.requiresClarification) {
      rejected.push(
        rejection(index, candidate, 'CLARIFICATION_CONFLICT', 'an unclear answer must not produce evidence'),
      );
      continue;
    }
    if (!activityConceptIds.has(candidate.conceptId)) {
      rejected.push(
        rejection(index, candidate, 'CONCEPT_NOT_IN_ACTIVITY', 'evidence concept is not part of the submitted activity'),
      );
      continue;
    }
    if (effectiveDisclosure && candidate.assistance === 'unassisted') {
      rejected.push(
        rejection(
          index,
          candidate,
          'DISCLOSURE_INDEPENDENCE_LOST',
          'an answer/explanation was already shown in this round; independence cannot be claimed',
        ),
      );
      continue;
    }
    if (sourceRequired && candidate.sourceRefs.length === 0) {
      rejected.push(
        rejection(
          index,
          candidate,
          'EVIDENCE_SOURCE_REQUIRED',
          'evidence must cite at least one resolvable source ref (activity sourceRequired=true)',
        ),
      );
      continue;
    }
    const unresolvedSource = candidate.sourceRefs.find((sourceRef) => !allowedSources.has(sourceRef));
    if (unresolvedSource !== undefined) {
      rejected.push(
        rejection(
          index,
          candidate,
          'SOURCE_UNRESOLVED',
          `source ref ${unresolvedSource} is not resolvable for this concept/activity/rubric`,
        ),
      );
      continue;
    }
    const unknownCriterion = candidate.criterionResults.find(
      (result) => !criterionIds.has(result.criterionId),
    );
    if (unknownCriterion !== undefined) {
      rejected.push(
        rejection(
          index,
          candidate,
          'CRITERION_UNKNOWN',
          `criterion ${unknownCriterion.criterionId} does not exist in rubric ${request.rubric.id}`,
        ),
      );
      continue;
    }
    if (candidate.assessmentOrigin === 'model') {
      if (candidate.modelRunId === null) {
        rejected.push(rejection(index, candidate, 'MODEL_RUN_MISSING', 'model evidence requires a model run id'));
        continue;
      }
      if (candidate.uncertainty === null) {
        rejected.push(rejection(index, candidate, 'UNCERTAINTY_MISSING', 'model evidence requires uncertainty'));
        continue;
      }
    }

    const evidence: Evidence = {
      schemaVersion: 1,
      id: request.ids.next('evidence'),
      attemptId: request.attempt.id,
      learnerId: request.attempt.learnerId,
      courseEditionId: request.attempt.courseEditionId,
      packVersion: request.attempt.packVersion,
      conceptId: candidate.conceptId,
      kind: candidate.kind,
      observation: candidate.observation,
      criterionResults: candidate.criterionResults,
      assistance: effectiveDisclosure ? 'assisted' : candidate.assistance,
      sourceRefs: candidate.sourceRefs,
      assessmentOrigin: candidate.assessmentOrigin,
      modelRunId: candidate.modelRunId,
      uncertainty: candidate.uncertainty,
      validity: 'current',
      createdAt: request.clock.now(),
    };
    const validation = validateEvidence(evidence);
    if (!validation.ok) {
      rejected.push(
        rejection(
          index,
          candidate,
          'INVALID_EVIDENCE_SHAPE',
          validation.issues[0]?.message ?? 'evidence failed the frozen validator',
        ),
      );
      continue;
    }
    accepted.push(validation.value);
    if (
      request.coreMisconception &&
      candidate.criterionResults.some((result) => result.result === 'not_met')
    ) {
      coreIds.push(evidence.id);
    }
  }

  return {
    accepted,
    rejected,
    coreMisconceptionEvidenceIds: coreIds,
    gradeInvalid: false,
  };
}
