/**
 * Three axis state projection for graph/detail views (05 §3, §9; A11/A18
 * contributions).
 *
 * T04 only *consumes* the frozen projection contract: `ConceptProgress` and
 * `LearnerProjectionStore` are imported as types from `@edu/domain`. Storage and
 * the projection rules themselves belong to T02/T06; this module never writes
 * progress, never merges by conceptId alone, and never upgrades a state.
 *
 * Trust mode is encoded in the type system:
 * - `PublishedConceptState` is the only shape that may carry a strong
 *   understanding claim.
 * - `CandidateConceptState.understanding.state` is the literal `'unassessed'`
 *   and `strongClaimsAllowed` is `false`, so candidate content cannot be
 *   passed where a published state is required (the compiler rejects it).
 */

import {
  REVIEW_POLICY_VERSION,
  type ConceptProgress,
  type Id,
  type LearnerProjectionStore,
  type LearningProgress,
  type RequestContext,
  type ReviewRecord,
  type ServiceResult,
  type UnderstandingProgress,
  type Validity,
} from '@edu/domain';
import {
  failValue,
  knowledgeError,
  okValue,
  type KnowledgeResult,
} from './knowledge-errors.js';

export type ConceptTrustMode = 'published' | 'candidate';

/**
 * Read side of the learner projection store. Supplied by the storage/learner
 * owner (T02/T06); T04 never implements it.
 */
export type ProjectionStoreReader = Pick<LearnerProjectionStore, 'list'>;

/** Batch read of the pack bound progress (`learner+edition+version` key). */
export async function readPackProgress(
  reader: ProjectionStoreReader,
  ctx: RequestContext,
  key: {
    readonly learnerId: Id;
    readonly courseEditionId: Id;
    readonly packVersion: string;
    readonly conceptIds?: readonly Id[];
  },
): Promise<ServiceResult<readonly ConceptProgress[]>> {
  return reader.list(ctx, key);
}

export interface ProgressLookup {
  /** Returns the bound progress entry or null; never reads across versions. */
  get(conceptId: Id): ConceptProgress | null;
}

export function progressLookup(entries: readonly ConceptProgress[]): ProgressLookup {
  const byConcept = new Map<Id, ConceptProgress>();
  for (const entry of entries) byConcept.set(entry.conceptId, entry);
  return { get: (conceptId) => byConcept.get(conceptId) ?? null };
}

export interface PublishedConceptState {
  readonly conceptId: Id;
  readonly trustMode: 'published';
  readonly strongClaimsAllowed: true;
  readonly learning: LearningProgress;
  readonly understanding: UnderstandingProgress;
  readonly review: ReviewRecord;
  /** True only when a real assessment (evidence backed) exists. */
  readonly hasIndependentEvidence: boolean;
  readonly revision: number;
}

export interface CandidateConceptState {
  readonly conceptId: Id;
  readonly trustMode: 'candidate';
  readonly strongClaimsAllowed: false;
  readonly learning: LearningProgress;
  readonly understanding: {
    readonly state: 'unassessed';
    readonly assessmentId: null;
    readonly updatedAt: null;
    readonly validity: Validity;
    readonly reason: 'candidate_trust_mode';
  };
  readonly review: ReviewRecord;
  readonly hasIndependentEvidence: false;
  readonly revision: number;
}

export type ConceptStateProjection = PublishedConceptState | CandidateConceptState;

const EMPTY_LEARNING: LearningProgress = {
  state: 'not_started',
  startedAt: null,
  lastCompletedAt: null,
};

const EMPTY_REVIEW: ReviewRecord = {
  lastCompletedAt: null,
  dueAt: null,
  activeSessionId: null,
  latestOutcome: null,
  policyVersion: REVIEW_POLICY_VERSION,
};

const EMPTY_UNDERSTANDING: UnderstandingProgress = {
  state: 'unassessed',
  assessmentId: null,
  updatedAt: null,
  validity: 'current',
};

export function projectConceptState(
  conceptId: Id,
  progress: ConceptProgress | null,
  mode: 'published',
): PublishedConceptState;
export function projectConceptState(
  conceptId: Id,
  progress: ConceptProgress | null,
  mode: 'candidate',
): CandidateConceptState;
export function projectConceptState(
  conceptId: Id,
  progress: ConceptProgress | null,
  mode: ConceptTrustMode,
): ConceptStateProjection;
export function projectConceptState(
  conceptId: Id,
  progress: ConceptProgress | null,
  mode: ConceptTrustMode,
): ConceptStateProjection {
  const learning = progress?.learning ?? EMPTY_LEARNING;
  const review = progress?.review ?? EMPTY_REVIEW;
  const revision = progress?.revision ?? 0;
  if (mode === 'candidate') {
    return {
      conceptId,
      trustMode: 'candidate',
      strongClaimsAllowed: false,
      learning,
      understanding: {
        state: 'unassessed',
        assessmentId: null,
        updatedAt: null,
        validity: progress?.understanding.validity ?? 'current',
        reason: 'candidate_trust_mode',
      },
      review,
      hasIndependentEvidence: false,
      revision,
    };
  }
  const understanding = progress?.understanding ?? EMPTY_UNDERSTANDING;
  return {
    conceptId,
    trustMode: 'published',
    strongClaimsAllowed: true,
    learning,
    understanding,
    review,
    hasIndependentEvidence:
      understanding.assessmentId !== null && understanding.validity !== 'stale',
    revision,
  };
}

export function projectGraphStates(
  conceptIds: readonly Id[],
  lookup: ProgressLookup,
  mode: 'published',
): readonly PublishedConceptState[];
export function projectGraphStates(
  conceptIds: readonly Id[],
  lookup: ProgressLookup,
  mode: 'candidate',
): readonly CandidateConceptState[];
export function projectGraphStates(
  conceptIds: readonly Id[],
  lookup: ProgressLookup,
  mode: ConceptTrustMode,
): readonly ConceptStateProjection[];
export function projectGraphStates(
  conceptIds: readonly Id[],
  lookup: ProgressLookup,
  mode: ConceptTrustMode,
): readonly ConceptStateProjection[] {
  return conceptIds.map((conceptId) => projectConceptState(conceptId, lookup.get(conceptId), mode));
}

/** Runtime twin of the type guard: candidate states can never feed claims. */
export function assertPublishedState(
  state: ConceptStateProjection,
): KnowledgeResult<PublishedConceptState> {
  if (state.trustMode !== 'published') {
    return failValue(
      knowledgeError(
        'CONCEPT_STATE_NOT_PUBLISHED',
        `concept ${state.conceptId} is projected from candidate content; strong claims are disabled`,
        { path: '$.trustMode' },
      ),
    );
  }
  return okValue(state);
}

export interface StrongClaimSummary {
  readonly supported: number;
  readonly developing: number;
  readonly needsSupport: number;
  readonly unassessed: number;
  readonly dueForReview: number;
  readonly total: number;
}

/**
 * Aggregate of published states only. Candidate content cannot reach this
 * function at compile time, so a candidate can never inflate these counts.
 */
export function strongClaimSummary(states: readonly PublishedConceptState[]): StrongClaimSummary {
  let supported = 0;
  let developing = 0;
  let needsSupport = 0;
  let unassessed = 0;
  let dueForReview = 0;
  for (const state of states) {
    switch (state.understanding.state) {
      case 'supported':
        supported += 1;
        break;
      case 'developing':
        developing += 1;
        break;
      case 'needs_support':
        needsSupport += 1;
        break;
      default:
        unassessed += 1;
        break;
    }
    if (state.review.dueAt !== null) dueForReview += 1;
  }
  return { supported, developing, needsSupport, unassessed, dueForReview, total: states.length };
}
