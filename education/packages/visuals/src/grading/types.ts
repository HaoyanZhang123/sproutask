/**
 * Grading input/output types (05 §5).
 *
 * The external result is always the frozen domain `GradeResult`; the input is
 * a normalized attempt answer so the same rule graders can be fed by the DOM
 * forms, by T12's workspace or by tests.
 */

import type { Activity, ActivityAttempt, EvidenceCandidate, GradeCriterion, GradeResult, Rubric } from '@edu/domain';

export interface DiagramLabelAnswerInput {
  readonly kind: 'diagram_label';
  readonly labels: readonly { readonly targetId: string; readonly text: string }[];
}

export interface ChoiceAnswerInput {
  readonly kind: 'choice';
  readonly optionIds: readonly string[];
}

export interface RelationPairInput {
  readonly fromId: string;
  readonly toId: string;
  /** Optional declared relation kind (prerequisite / related). */
  readonly relation?: 'prerequisite' | 'related' | null;
}

export interface RelationAnswerInput {
  readonly kind: 'relation';
  readonly pairs: readonly RelationPairInput[];
}

export interface TextAnswerInput {
  readonly kind: 'text';
  readonly text: string;
}

export type GradedAnswer =
  | DiagramLabelAnswerInput
  | ChoiceAnswerInput
  | RelationAnswerInput
  | TextAnswerInput;

export interface KnownRelation {
  readonly fromConceptId: string;
  readonly toConceptId: string;
  readonly type: 'prerequisite' | 'related';
}

/** Minimal attempt projection the graders need; never writes to the journal. */
export interface GradingAttempt {
  readonly id: string;
  readonly activityId: string;
  readonly activityVersion: string;
  readonly answerText: string | null;
  readonly answerAssetId: string | null;
  readonly inputType: ActivityAttempt['inputType'];
  readonly helpUsed: ActivityAttempt['helpUsed'];
}

export interface GradingContext {
  readonly activity: Activity;
  readonly rubric: Rubric;
  readonly attempt: GradingAttempt;
  readonly answer: GradedAnswer;
  /** Diagram render plan targets (needed for the diagram_label grader). */
  readonly diagramTargets?: readonly { readonly number: number; readonly nodeId: string; readonly label: string }[];
  /** Relations from the knowledge pack, when the caller can resolve them. */
  readonly knownRelations?: readonly KnownRelation[];
  readonly graderVersion?: string;
}

export interface GradeFeedbackParts {
  readonly criteria: readonly GradeCriterion[];
  readonly feedback: string;
  readonly uncertainties: readonly string[];
  readonly evidenceCandidates: readonly EvidenceCandidate[];
  readonly requiresClarification: boolean;
  readonly sourceRefs: readonly string[];
}

export interface RuleGradeOutcome {
  readonly result: GradeResult;
  /** Model-run id for model graders; null for deterministic rules. */
  readonly modelRunId: string | null;
}

/** The frozen evidence kinds this package may propose. */
export type CandidateKind = EvidenceCandidate['kind'];

export const RULE_GRADER_VERSION = 'rule-grader-v1';
