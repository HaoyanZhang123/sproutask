/**
 * Deduplicated aggregation and first-use planning (05 §3.4, 01 §5).
 *
 * Counts are per unique conceptId, never per placement or per pack version:
 * the same concept remapped into a newer pack must not inflate "learned" or
 * "due" totals. Percentages are learning-activity coverage with an explicit
 * denominator; they are never labelled as mastery.
 */

import type { ConceptProgress, Id, Timestamp, TrustMode, UnderstandingState } from '@edu/domain';
import type { ConceptEntry } from './projection.js';
import { isReviewDue } from '@edu/domain';

export const AGGREGATE_NOTE =
  'counts are unique conceptIds; percentage is activity coverage only, not a mastery rate';

export interface AggregateOptions {
  readonly availableConceptIds: readonly Id[];
  readonly candidateConceptIds?: readonly Id[];
  readonly now: Timestamp;
}

export interface AggregateConceptView {
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

export interface AggregateView {
  readonly availableTotal: number;
  readonly learnedCount: number;
  readonly inProgressCount: number;
  readonly dueCount: number;
  readonly needsSupportCount: number;
  readonly candidateCount: number;
  readonly candidateConceptIds: readonly Id[];
  readonly activityCoverage: {
    readonly numerator: number;
    readonly denominator: number;
    readonly percent: number | null;
    readonly label: 'activity_coverage_not_mastery';
  };
  readonly concepts: readonly AggregateConceptView[];
  readonly policyNote: string;
}

export function trustModeOf(entry: ConceptEntry): TrustMode {
  if (entry.trustModeSeen.has('published')) return 'published';
  if (entry.trustModeSeen.has('candidate')) return 'candidate';
  return 'published';
}

function updatedAtMs(entry: ConceptEntry): number {
  const value = entry.progress.lastPosition.updatedAt;
  return value === null ? 0 : Date.parse(value);
}

/** Deterministic representative choice when one concept exists in several packs. */
function representativeScore(entry: ConceptEntry): readonly [number, number, number, string] {
  return [
    trustModeOf(entry) === 'published' ? 1 : 0,
    entry.progress.revision,
    updatedAtMs(entry),
    entry.progress.packVersion,
  ];
}

function compareScore(
  left: readonly [number, number, number, string],
  right: readonly [number, number, number, string],
): number {
  if (left[0] !== right[0]) return left[0] - right[0];
  if (left[1] !== right[1]) return left[1] - right[1];
  if (left[2] !== right[2]) return left[2] - right[2];
  if (left[3] !== right[3]) return left[3] < right[3] ? -1 : 1;
  return 0;
}

export function aggregateEntries(
  entries: readonly ConceptEntry[],
  options: AggregateOptions,
): AggregateView {
  const available = [...new Set(options.availableConceptIds)];
  const candidateInput = new Set(options.candidateConceptIds ?? []);

  const byConcept = new Map<Id, ConceptEntry[]>();
  for (const entry of entries) {
    const list = byConcept.get(entry.progress.conceptId) ?? [];
    list.push(entry);
    byConcept.set(entry.progress.conceptId, list);
  }
  const representatives = new Map<Id, ConceptEntry>();
  for (const [conceptId, list] of byConcept.entries()) {
    const sorted = [...list].sort((left, right) =>
      compareScore(representativeScore(left), representativeScore(right)),
    );
    const winner = sorted[sorted.length - 1];
    if (winner !== undefined) representatives.set(conceptId, winner);
  }

  const concepts: AggregateConceptView[] = [];
  const candidateIds = new Set<Id>();
  let learnedCount = 0;
  let inProgressCount = 0;
  let dueCount = 0;
  let needsSupportCount = 0;

  const allConceptIds = new Set<Id>([...available, ...candidateInput]);
  // Candidate trial concepts are listed separately and never enter the formal
  // "learnable" denominator or the formal counts (05 §3.4).
  for (const conceptId of [...allConceptIds].sort()) {
    const entry = representatives.get(conceptId);
    if (entry === undefined) continue;
    const trustMode = trustModeOf(entry);
    if (candidateInput.has(conceptId) || trustMode === 'candidate') candidateIds.add(conceptId);
  }
  const formalAvailable = available.filter((conceptId) => !candidateIds.has(conceptId));
  const formalSet = new Set(formalAvailable);

  for (const conceptId of [...allConceptIds].sort()) {
    const entry = representatives.get(conceptId);
    if (entry === undefined) continue;
    const trustMode = trustModeOf(entry);
    const candidate = candidateIds.has(conceptId);
    const due =
      isReviewDue(entry.progress.review, options.now) &&
      entry.progress.learning.state === 'completed';
    concepts.push({
      conceptId,
      courseEditionId: entry.progress.courseEditionId,
      packVersion: entry.progress.packVersion,
      learning: entry.progress.learning.state,
      understanding: entry.progress.understanding.state,
      reviewDue: due,
      dueAt: entry.progress.review.dueAt,
      trustMode,
      historyInherited: entry.historyInherited,
    });
    if (candidate || !formalSet.has(conceptId)) continue;
    if (entry.progress.learning.state === 'completed') learnedCount += 1;
    if (entry.progress.learning.state === 'in_progress') inProgressCount += 1;
    if (due) dueCount += 1;
    if (entry.progress.understanding.state === 'needs_support') needsSupportCount += 1;
  }

  const denominator = formalAvailable.length;
  const percent = denominator > 0 ? Math.round((learnedCount / denominator) * 1000) / 10 : null;
  return {
    availableTotal: denominator,
    learnedCount,
    inProgressCount,
    dueCount,
    needsSupportCount,
    candidateCount: candidateIds.size,
    candidateConceptIds: [...candidateIds].sort(),
    activityCoverage: {
      numerator: learnedCount,
      denominator,
      percent,
      label: 'activity_coverage_not_mastery',
    },
    concepts,
    policyNote: AGGREGATE_NOTE,
  };
}

export interface FirstUsePlanView {
  readonly declaredScope: readonly Id[];
  readonly diagnosticSuggestions: readonly { readonly conceptId: Id; readonly reason: string }[];
  readonly untestedConceptIds: readonly Id[];
  readonly note: string;
  readonly diagnosticSkipped: boolean;
}

const FIRST_USE_NOTE =
  'self reported "already learned" range is a scope declaration only; it never writes system learned state, and untested concepts stay unassessed';

/**
 * First-use plan: the declaration is kept as a scope only. The short diagnostic
 * recommendations are a bounded sample; concepts outside it remain unassessed.
 */
export function buildFirstUsePlan(
  declaredConceptIds: readonly Id[],
  availableConceptIds: readonly Id[],
  limit = 5,
): FirstUsePlanView {
  const available = [...new Set(availableConceptIds)];
  const availableSet = new Set(available);
  const declaredScope = [...new Set(declaredConceptIds)];
  if (!Number.isInteger(limit) || limit < 1) {
    throw new Error('diagnostic suggestion limit must be a positive integer');
  }
  const eligible = declaredScope.filter((conceptId) => availableSet.has(conceptId));
  const selected = eligible.slice(0, limit);
  const selectedSet = new Set(selected);
  return {
    declaredScope,
    diagnosticSuggestions: selected.map((conceptId) => ({
      conceptId,
      reason: 'self_reported_learned_scope: verify with a short diagnostic; not system learned',
    })),
    untestedConceptIds: available.filter((conceptId) => !selectedSet.has(conceptId)),
    note: FIRST_USE_NOTE,
    diagnosticSkipped: selected.length === 0,
  };
}
