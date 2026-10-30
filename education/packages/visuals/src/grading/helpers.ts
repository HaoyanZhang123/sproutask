/**
 * Shared helpers for the deterministic graders.
 *
 * Rule feedback only states what the rule can prove: how many criteria are met,
 * which distractors were chosen, which label was expected. It never invents a
 * model-style explanation and never turns "unclear" into "wrong".
 */

import {
  ANSWER_DISCLOSING_HELP_KINDS,
  type Activity,
  type ActivityAttempt,
  type Assistance,
  type EvidenceCandidate,
  type GradeCriterion,
  type GradeResult,
  type Rubric,
  type RubricCriterion,
} from '@edu/domain';

import type { GradingAttempt, GradingContext } from './types.js';

/** Assistance is derived from the recorded help usage, never from the UI state. */
export function attemptAssistance(attempt: Pick<GradingAttempt, 'helpUsed'>): Assistance {
  const disclosed = attempt.helpUsed.some((help) =>
    (ANSWER_DISCLOSING_HELP_KINDS as readonly string[]).includes(help.kind),
  );
  const explained = attempt.helpUsed.some((help) => help.kind === 'explanation');
  return disclosed || explained ? 'assisted' : 'unassisted';
}

export function rubricMatchesActivity(activity: Activity, rubric: Rubric): boolean {
  if (rubric.id !== activity.rubricId) return false;
  if (rubric.version !== activity.rubricVersion) return false;
  if (rubric.courseEditionId !== activity.courseEditionId) return false;
  return true;
}

/**
 * One `GradeCriterion` per rubric criterion. `met` is `unclear` unless the
 * grader has a deterministic reason to claim yes/no.
 */
export function buildCriteria(
  rubric: Rubric,
  decide: (criterion: RubricCriterion) => { met: GradeCriterion['met']; rationale: string },
): GradeCriterion[] {
  return rubric.criteria.map((criterion) => {
    const decision = decide(criterion);
    return {
      criterionId: criterion.criterionId,
      met: decision.met,
      rationale: decision.rationale,
    };
  });
}

export interface CandidateInput {
  readonly conceptId: string;
  readonly kind: EvidenceCandidate['kind'];
  readonly observation: string;
  readonly criteria: readonly GradeCriterion[];
  readonly assistance: Assistance;
  readonly sourceRefs: readonly string[];
  readonly origin: EvidenceCandidate['assessmentOrigin'];
  readonly modelRunId: string | null;
  readonly uncertainty: number | null;
}

export function buildEvidenceCandidate(input: CandidateInput): EvidenceCandidate {
  return {
    conceptId: input.conceptId,
    kind: input.kind,
    observation: input.observation,
    criterionResults: input.criteria.map((criterion) => ({
      criterionId: criterion.criterionId,
      result: criterion.met === 'yes' ? 'met' : criterion.met === 'no' ? 'not_met' : 'unclear',
      note: null,
    })),
    assistance: input.assistance,
    sourceRefs: [...input.sourceRefs],
    assessmentOrigin: input.origin,
    modelRunId: input.modelRunId,
    uncertainty: input.uncertainty,
  };
}

/** Deterministic source-ref list for a rule grade (activity refs first). */
export function gradeSourceRefs(context: GradingContext): string[] {
  const refs = new Set<string>([...context.activity.sourceRefs]);
  for (const criterion of context.rubric.criteria) {
    for (const ref of criterion.feedbackSourceRefs) refs.add(ref);
  }
  return [...refs];
}

export function buildGradeResult(input: {
  readonly attemptId: string;
  readonly criteria: readonly GradeCriterion[];
  readonly feedback: string;
  readonly uncertainties: readonly string[];
  readonly evidenceCandidates: readonly EvidenceCandidate[];
  readonly requiresClarification: boolean;
  readonly sourceRefs: readonly string[];
  readonly graderVersion: string;
}): GradeResult {
  return {
    schemaVersion: 1,
    attemptId: input.attemptId,
    criteria: [...input.criteria],
    feedback: input.feedback,
    uncertainties: [...input.uncertainties],
    evidenceCandidates: [...input.evidenceCandidates],
    requiresClarification: input.requiresClarification,
    sourceRefs: [...input.sourceRefs],
    graderVersion: input.graderVersion,
  };
}

/** Non-empty, safe text for a candidate observation (no markup). */
export function safeObservation(text: string): string {
  return text.replace(/[<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, 400);
}

export type { ActivityAttempt };
