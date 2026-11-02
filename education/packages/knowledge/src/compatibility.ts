/**
 * Content diff and CompatibilityMap audit (05 §9; A11/A28 contributions).
 *
 * Two hard rules from the frozen contract are enforced here at the service
 * boundary:
 * 1. A new pack version never copies a strong understanding state. Every
 *    mapping projection must stay `unassessed`; a verified `inherit` mapping
 *    may only carry *learning history* (with a marker), never `supported`.
 * 2. Old evidence is not inherited just because the concept id is unchanged:
 *    an unverified mapping (including a same-id `unchanged` one) inherits
 *    nothing, which the audit reports explicitly as `inheritedConcepts` minus
 *    unverified mappings.
 */

import {
  projectProgressUnderCompatibility,
  validateCompatibilityMap,
  type CompatibilityMap,
  type CompatibilityMappingKind,
  type Concept,
  type ConceptMapping,
  type ContentPack,
  type Id,
} from '@edu/domain';
import {
  failBuild,
  knowledgeIssue,
  okBuild,
  type BuildResult,
  type KnowledgeIssue,
} from './knowledge-errors.js';
import { contentHashMatches } from './content-hash.js';

export interface PackDiff {
  readonly fromVersion: string;
  readonly toVersion: string;
  readonly versionsDiffer: boolean;
  readonly hashChanged: boolean;
  readonly addedConcepts: readonly Id[];
  readonly removedConcepts: readonly Id[];
  readonly renamedConcepts: readonly { readonly id: Id; readonly fromTitle: string; readonly toTitle: string }[];
  readonly changedObjectives: readonly { readonly id: Id; readonly from: readonly string[]; readonly to: readonly string[] }[];
  readonly changedRubrics: readonly Id[];
  readonly changedSourceRefs: readonly { readonly id: Id; readonly from: readonly Id[]; readonly to: readonly Id[] }[];
  readonly changedExplanations: readonly Id[];
  readonly addedRelations: readonly Id[];
  readonly removedRelations: readonly Id[];
  readonly addedTocNodes: readonly Id[];
  readonly removedTocNodes: readonly Id[];
  readonly retitledTocNodes: readonly { readonly id: Id; readonly from: string; readonly to: string }[];
}

function sameList(left: readonly string[], right: readonly string[]): boolean {
  if (left.length !== right.length) return false;
  const sortedLeft = [...left].sort();
  const sortedRight = [...right].sort();
  return sortedLeft.every((value, index) => value === sortedRight[index]);
}

export function diffPacks(from: ContentPack, to: ContentPack): PackDiff {
  const fromConcepts = new Map<Id, Concept>(from.concepts.map((concept) => [concept.id, concept]));
  const toConcepts = new Map<Id, Concept>(to.concepts.map((concept) => [concept.id, concept]));

  const addedConcepts = [...toConcepts.keys()].filter((id) => !fromConcepts.has(id)).sort();
  const removedConcepts = [...fromConcepts.keys()].filter((id) => !toConcepts.has(id)).sort();
  const renamedConcepts: { id: Id; fromTitle: string; toTitle: string }[] = [];
  const changedObjectives: { id: Id; from: readonly string[]; to: readonly string[] }[] = [];
  const changedRubrics: Id[] = [];
  const changedSourceRefs: { id: Id; from: readonly Id[]; to: readonly Id[] }[] = [];
  const changedExplanations: Id[] = [];

  for (const [id, before] of fromConcepts) {
    const after = toConcepts.get(id);
    if (after === undefined) continue;
    if (before.title !== after.title) {
      renamedConcepts.push({ id, fromTitle: before.title, toTitle: after.title });
    }
    if (!sameList(before.learningObjectives, after.learningObjectives)) {
      changedObjectives.push({ id, from: before.learningObjectives, to: after.learningObjectives });
    }
    if (!sameList(before.rubricIds, after.rubricIds)) changedRubrics.push(id);
    if (!sameList(before.sourceRefs, after.sourceRefs)) {
      changedSourceRefs.push({ id, from: before.sourceRefs, to: after.sourceRefs });
    }
    if (before.explanation !== after.explanation) changedExplanations.push(id);
  }

  const fromRelations = new Set(from.relations.map((relation) => relation.id));
  const toRelations = new Set(to.relations.map((relation) => relation.id));
  const addedRelations = [...toRelations].filter((id) => !fromRelations.has(id)).sort();
  const removedRelations = [...fromRelations].filter((id) => !toRelations.has(id)).sort();

  const fromToc = new Map(from.toc.map((node) => [node.id, node]));
  const toToc = new Map(to.toc.map((node) => [node.id, node]));
  const addedTocNodes = [...toToc.keys()].filter((id) => !fromToc.has(id)).sort();
  const removedTocNodes = [...fromToc.keys()].filter((id) => !toToc.has(id)).sort();
  const retitledTocNodes: { id: Id; from: string; to: string }[] = [];
  for (const [id, before] of fromToc) {
    const after = toToc.get(id);
    if (after === undefined) continue;
    if (before.title !== after.title) retitledTocNodes.push({ id, from: before.title, to: after.title });
  }

  return {
    fromVersion: from.version,
    toVersion: to.version,
    versionsDiffer: from.version !== to.version,
    hashChanged: from.contentHash !== to.contentHash,
    addedConcepts,
    removedConcepts,
    renamedConcepts,
    changedObjectives,
    changedRubrics: changedRubrics.sort(),
    changedSourceRefs,
    changedExplanations: changedExplanations.sort(),
    addedRelations,
    removedRelations,
    addedTocNodes,
    removedTocNodes,
    retitledTocNodes,
  };
}

export interface MappingProjectionAudit {
  readonly conceptId: Id | null;
  readonly kind: CompatibilityMappingKind;
  readonly verified: boolean;
  readonly carryLearningHistory: boolean;
  readonly staleEvidence: boolean;
  readonly understandingState: 'unassessed';
  readonly reason: string;
}

export interface CompatibilityAudit {
  readonly ok: boolean;
  readonly mapId: Id | null;
  readonly fromPackVersion: string | null;
  readonly toPackVersion: string | null;
  readonly issues: readonly KnowledgeIssue[];
  readonly uncoveredDiffItems: readonly string[];
  /** Concepts whose *learning history* may be shown with an inherited marker. */
  readonly inheritedConcepts: readonly Id[];
  /** Must always be empty: no mapping may copy a strong understanding state. */
  readonly strongStateCopies: readonly Id[];
  readonly projections: readonly MappingProjectionAudit[];
}

function referencedBy(mapping: ConceptMapping, conceptId: Id): boolean {
  return mapping.fromConceptId === conceptId || mapping.toConceptIds.includes(conceptId);
}

function kindOf(mapping: ConceptMapping): CompatibilityMappingKind {
  return mapping.kind;
}

/**
 * Validates a map against the two packs it claims to connect and audits what
 * the new pack may inherit.
 */
export function auditCompatibilityMap(
  input: unknown,
  from: ContentPack,
  to: ContentPack,
): BuildResult<CompatibilityAudit> {
  const parsed = validateCompatibilityMap(input);
  if (!parsed.ok) {
    return failBuild(
      parsed.issues.map((entry) => ({
        code: entry.code,
        path: entry.path,
        message: entry.message,
      })),
    );
  }
  const map: CompatibilityMap = parsed.value;
  const issues: KnowledgeIssue[] = [];

  if (map.courseEditionId !== from.courseEditionId || map.courseEditionId !== to.courseEditionId) {
    issues.push(
      knowledgeIssue(
        'COMPATIBILITY_INVALID',
        '$.courseEditionId',
        'compatibility map must connect packs of the same course edition',
      ),
    );
  }
  if (map.fromPackVersion !== from.version || map.toPackVersion !== to.version) {
    issues.push(
      knowledgeIssue(
        'COMPATIBILITY_INVALID',
        '$.fromPackVersion',
        `map connects ${map.fromPackVersion} -> ${map.toPackVersion}, packs are ${from.version} -> ${to.version}`,
      ),
    );
  }
  if (map.fromContentHash !== from.contentHash) {
    issues.push(
      knowledgeIssue(
        'COMPATIBILITY_HASH_MISMATCH',
        '$.fromContentHash',
        'map from hash does not match the actual previous pack content hash',
      ),
    );
  }
  if (map.toContentHash !== to.contentHash) {
    issues.push(
      knowledgeIssue(
        'COMPATIBILITY_HASH_MISMATCH',
        '$.toContentHash',
        'map to hash does not match the actual new pack content hash',
      ),
    );
  }
  if (!contentHashMatches(from) || !contentHashMatches(to)) {
    issues.push(
      knowledgeIssue(
        'COMPATIBILITY_HASH_MISMATCH',
        '$.toContentHash',
        'a pack content hash does not match its canonical content; recompute before releasing',
      ),
    );
  }

  const fromIds = new Set(from.concepts.map((concept) => concept.id));
  const toIds = new Set(to.concepts.map((concept) => concept.id));
  const seenFrom = new Set<Id>();
  for (const [index, mapping] of map.mappings.entries()) {
    if (mapping.fromConceptId !== null && seenFrom.has(mapping.fromConceptId)) {
      issues.push(
        knowledgeIssue(
          'COMPATIBILITY_INVALID',
          `$.mappings[${index}].fromConceptId`,
          `concept ${mapping.fromConceptId} is mapped more than once`,
        ),
      );
    }
    if (mapping.fromConceptId !== null) seenFrom.add(mapping.fromConceptId);
    if (mapping.fromConceptId !== null && !fromIds.has(mapping.fromConceptId)) {
      issues.push(
        knowledgeIssue(
          'COMPATIBILITY_INVALID',
          `$.mappings[${index}].fromConceptId`,
          `old concept ${mapping.fromConceptId} does not exist in ${from.version}`,
        ),
      );
    }
    if (mapping.kind !== 'removed') {
      for (const targetId of mapping.toConceptIds) {
        if (!toIds.has(targetId)) {
          issues.push(
            knowledgeIssue(
              'COMPATIBILITY_INVALID',
              `$.mappings[${index}].toConceptIds`,
              `new concept ${targetId} does not exist in ${to.version}`,
            ),
          );
        }
      }
    }
  }

  const diff = diffPacks(from, to);
  const uncovered: string[] = [];
  const required = (label: string, conceptId: Id, predicate: (mapping: ConceptMapping) => boolean): void => {
    if (!map.mappings.some((mapping) => referencedBy(mapping, conceptId) && predicate(mapping))) {
      uncovered.push(label);
      issues.push(
        knowledgeIssue(
          'COMPATIBILITY_DIFF_UNCOVERED',
          '$.mappings',
          `${label} is not covered by a reviewed compatibility mapping`,
        ),
      );
    }
  };

  for (const conceptId of diff.addedConcepts) {
    required(`added concept ${conceptId}`, conceptId, (mapping) => kindOf(mapping) === 'added');
  }
  for (const conceptId of diff.removedConcepts) {
    required(`removed concept ${conceptId}`, conceptId, (mapping) => kindOf(mapping) === 'removed');
  }
  for (const renamed of diff.renamedConcepts) {
    required(`renamed concept ${renamed.id}`, renamed.id, (mapping) => kindOf(mapping) !== 'unchanged');
  }
  for (const objective of diff.changedObjectives) {
    required(
      `changed objectives for ${objective.id}`,
      objective.id,
      (mapping) => kindOf(mapping) === 'renamed' || kindOf(mapping) === 'rubric_changed' || kindOf(mapping) === 'source_revised',
    );
  }
  for (const conceptId of diff.changedRubrics) {
    required(
      `changed rubric for ${conceptId}`,
      conceptId,
      (mapping) => kindOf(mapping) === 'rubric_changed' || kindOf(mapping) === 'renamed',
    );
  }
  for (const sourceChange of diff.changedSourceRefs) {
    required(
      `changed source refs for ${sourceChange.id}`,
      sourceChange.id,
      (mapping) => kindOf(mapping) === 'source_revised' || kindOf(mapping) === 'renamed',
    );
  }
  for (const conceptId of diff.changedExplanations) {
    required(
      `changed explanation for ${conceptId}`,
      conceptId,
      (mapping) => kindOf(mapping) === 'source_revised' || kindOf(mapping) === 'renamed',
    );
  }

  const projections: MappingProjectionAudit[] = [];
  const inheritedConcepts: Id[] = [];
  const strongStateCopies: Id[] = [];
  for (const mapping of map.mappings) {
    const projection = projectProgressUnderCompatibility(mapping);
    const conceptId = mapping.toConceptIds[0] ?? mapping.fromConceptId ?? null;
    projections.push({
      conceptId,
      kind: mapping.kind,
      verified: mapping.review.verified,
      carryLearningHistory: projection.carryLearningHistory,
      staleEvidence: projection.staleEvidence,
      understandingState: projection.understandingState,
      reason: projection.reason,
    });
    if (projection.understandingState !== 'unassessed') {
      if (conceptId !== null) strongStateCopies.push(conceptId);
      issues.push(
        knowledgeIssue(
          'COMPATIBILITY_STRONG_CLAIM',
          '$.mappings',
          `mapping ${mapping.kind} would copy a strong understanding state into the new pack`,
        ),
      );
    }
    if (!mapping.review.verified && mapping.evidenceEffect === 'inherit') {
      issues.push(
        knowledgeIssue(
          'COMPATIBILITY_UNVERIFIED',
          '$.mappings',
          'an unverified mapping cannot inherit history (same id is not evidence)',
        ),
      );
    }
    if (projection.carryLearningHistory && conceptId !== null) inheritedConcepts.push(conceptId);
  }

  const ok = issues.length === 0 && strongStateCopies.length === 0;
  return okBuild({
    ok,
    mapId: map.id,
    fromPackVersion: map.fromPackVersion,
    toPackVersion: map.toPackVersion,
    issues,
    uncoveredDiffItems: uncovered,
    inheritedConcepts,
    strongStateCopies,
    projections,
  });
}
