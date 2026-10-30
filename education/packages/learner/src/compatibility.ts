/**
 * Content version compatibility (05 §9).
 *
 * A new pack never copies a formal understanding judgement. Verified
 * unchanged/renamed mappings may carry learning history with a marker;
 * affected evidence is flagged stale/needs_recheck; unverified mappings carry
 * nothing and leave the new concept unassessed.
 */

import type { CompatibilityMap, ConceptProgress, EvidenceEffect, Id, Timestamp } from '@edu/domain';import { projectProgressUnderCompatibility, validateCompatibilityMap } from '@edu/domain';
import type { ConceptEntry, CompatibilityEvidenceEffect } from './projection.js';
import { createConceptProgress } from './projection.js';

export interface CompatibilityPlan {
  readonly newEntries: readonly ConceptProgress[];
  readonly evidenceEffects: readonly CompatibilityEvidenceEffect[];
  readonly inheritedConceptIds: readonly Id[];
}

interface LearningAccumulator {
  state: ConceptProgress['learning']['state'];
  startedAt: Timestamp | null;
  lastCompletedAt: Timestamp | null;
}

function emptyLearning(): LearningAccumulator {
  return { state: 'not_started', startedAt: null, lastCompletedAt: null };
}

function learningRank(state: ConceptProgress['learning']['state']): number {
  if (state === 'completed') return 2;
  if (state === 'in_progress') return 1;
  return 0;
}

function mergeLearning(
  current: LearningAccumulator,
  incoming: ConceptProgress['learning'],
): LearningAccumulator {
  const state =
    learningRank(incoming.state) > learningRank(current.state) ? incoming.state : current.state;
  const startedAt =
    current.startedAt === null
      ? incoming.startedAt
      : incoming.startedAt === null
        ? current.startedAt
        : Date.parse(incoming.startedAt) < Date.parse(current.startedAt)
          ? incoming.startedAt
          : current.startedAt;
  const lastCompletedAt =
    current.lastCompletedAt === null
      ? incoming.lastCompletedAt
      : incoming.lastCompletedAt === null
        ? current.lastCompletedAt
        : Date.parse(incoming.lastCompletedAt) > Date.parse(current.lastCompletedAt)
          ? incoming.lastCompletedAt
          : current.lastCompletedAt;
  return { state, startedAt, lastCompletedAt };
}

/**
 * Compute the new-pack projection entries for a compatibility map. Pure: the
 * service appends the result to the journal so replay reproduces it exactly.
 */
export function planCompatibility(
  entries: readonly ConceptEntry[],
  map: CompatibilityMap,
  policyVersion: string,
  learnerId: Id,
): CompatibilityPlan {
  const validated = validateCompatibilityMap(map);
  if (!validated.ok) {
    throw new Error(
      `compatibility map rejected: ${validated.issues[0]?.message ?? 'unknown'}`,
    );
  }
  const oldEntries = entries.filter(
    (entry) =>
      entry.progress.courseEditionId === map.courseEditionId &&
      entry.progress.packVersion === map.fromPackVersion,
  );
  const oldByConcept = new Map<Id, ConceptEntry>();
  for (const entry of oldEntries) oldByConcept.set(entry.progress.conceptId, entry);

  const learningByTarget = new Map<Id, LearningAccumulator>();
  const inherited = new Set<Id>();
  const staleTarget = new Set<Id>();
  const evidenceEffects: CompatibilityEvidenceEffect[] = [];

  for (const mapping of map.mappings) {
    const projection = projectProgressUnderCompatibility(mapping);
    const fromConceptId = mapping.fromConceptId;
    const old = fromConceptId === null ? undefined : oldByConcept.get(fromConceptId);
    if (old !== undefined && mapping.kind !== 'added') {
      const effect: EvidenceEffect = mapping.review.verified
        ? mapping.evidenceEffect
        : 'stale';
      evidenceEffects.push({
        conceptId: old.progress.conceptId,
        packVersion: map.fromPackVersion,
        effect,
        reason: projection.reason,
      });
    }
    if (mapping.kind === 'added' || mapping.kind === 'removed') continue;
    if (old === undefined) continue;
    const carry = projection.carryLearningHistory && old.progress.learning.state !== 'not_started';
    for (const targetConceptId of mapping.toConceptIds) {
      if (projection.staleEvidence) staleTarget.add(targetConceptId);
      if (carry) {
        const current = learningByTarget.get(targetConceptId) ?? emptyLearning();
        learningByTarget.set(
          targetConceptId,
          mergeLearning(current, old.progress.learning),
        );
        inherited.add(targetConceptId);
      } else if (!learningByTarget.has(targetConceptId)) {
        learningByTarget.set(targetConceptId, emptyLearning());
      }
    }
  }

  const newEntries: ConceptProgress[] = [];
  for (const [conceptId, learning] of [...learningByTarget.entries()].sort(([a], [b]) =>
    a < b ? -1 : a > b ? 1 : 0,
  )) {
    const base = createConceptProgress(
      {
        learnerId,
        courseEditionId: map.courseEditionId,
        packVersion: map.toPackVersion,
        conceptId,
      },
      policyVersion,
    );
    newEntries.push({
      ...base,
      learning: {
        state: learning.state,
        startedAt: learning.startedAt,
        lastCompletedAt: learning.lastCompletedAt,
      },
      understanding: {
        state: 'unassessed',
        assessmentId: null,
        updatedAt: null,
        validity: staleTarget.has(conceptId) ? 'needs_recheck' : 'current',
      },
      review: {
        lastCompletedAt: null,
        dueAt: null,
        activeSessionId: null,
        latestOutcome: null,
        policyVersion,
      },
      lastPosition: { sessionId: null, activityId: null, cursor: null, updatedAt: null },
      revision: 0,
    });
  }

  return {
    newEntries,
    evidenceEffects,
    inheritedConceptIds: [...inherited].sort(),
  };
}
