/**
 * Cross entity invariants for content packs (05 §2, §4, §9).
 *
 * `validateContentPack` = structural parse + every cross reference / scope /
 * publication rule below. The content hash is format checked here; fixture and
 * host tests recompute SHA-256 of canonicalContentJson to bind the hash to the
 * content (the domain stays crypto free).
 */

import type { ContentPack, Concept, Relation, TocNodeLike } from '../entities/content.js';
import { validateContentPackStructure, type TocNodeLike as TocNode } from '../entities/content.js';
import { IssueCollector, finish, type ValidationResult } from '../validation.js';
import type { Id } from '../primitives.js';

const TOC_TYPE_RANK: Record<TocNodeLike['type'], number> = {
  volume: 0,
  unit: 1,
  chapter: 2,
  section: 3,
};

export interface TocTreeIndex {
  readonly byId: ReadonlyMap<Id, TocNodeLike>;
  readonly roots: readonly TocNodeLike[];
  readonly childrenOf: ReadonlyMap<Id, readonly TocNodeLike[]>;
  readonly depthOf: ReadonlyMap<Id, number>;
}

export function checkTocTree(
  nodes: readonly TocNodeLike[],
  courseEditionId: Id,
): ValidationResult<TocTreeIndex> {
  const issues = new IssueCollector();
  const byId = new Map<Id, TocNodeLike>();
  for (const node of nodes) {
    if (byId.has(node.id)) {
      issues.add('DUPLICATE_ID', `$.toc.${node.id}`, `duplicate toc node id ${node.id}`);
      continue;
    }
    byId.set(node.id, node);
    if (node.courseEditionId !== courseEditionId) {
      issues.add(
        'INVALID_REFERENCE',
        `$.toc.${node.id}.courseEditionId`,
        `toc node belongs to ${node.courseEditionId}, expected ${courseEditionId}`,
      );
    }
  }

  const roots: TocNodeLike[] = [];
  const childrenOf = new Map<Id, TocNodeLike[]>();
  const siblingOrder = new Set<string>();
  for (const node of nodes) {
    if (node.parentId === null) {
      roots.push(node);
      if (node.type !== 'volume') {
        issues.add('TOC_TYPE_ORDER', `$.toc.${node.id}.type`, 'the toc root must be a volume node');
      }
    } else {
      const parent = byId.get(node.parentId);
      if (parent === undefined) {
        issues.add(
          'TOC_ORPHAN',
          `$.toc.${node.id}.parentId`,
          `parent ${node.parentId} does not exist in this pack`,
        );
      } else if (TOC_TYPE_RANK[parent.type] >= TOC_TYPE_RANK[node.type]) {
        issues.add(
          'TOC_TYPE_ORDER',
          `$.toc.${node.id}.type`,
          `${node.type} cannot be a child of ${parent.type}`,
        );
      }
      const list = childrenOf.get(node.parentId) ?? [];
      list.push(node);
      childrenOf.set(node.parentId, list);
    }
    const siblingKey = `${node.parentId ?? '<root>'}|${node.order}`;
    if (siblingOrder.has(siblingKey)) {
      issues.add(
        'TOC_DUPLICATE_ORDER',
        `$.toc.${node.id}.order`,
        `sibling order ${node.order} is used more than once`,
      );
    }
    siblingOrder.add(siblingKey);
  }

  if (roots.length !== 1) {
    issues.add(
      'TOC_MULTIPLE_ROOTS',
      '$.toc',
      `a volume toc must have exactly one root, found ${roots.length}`,
    );
  }

  // Cycle detection: walk parent chains, bounded by node count.
  for (const node of nodes) {
    const visited = new Set<Id>([node.id]);
    let cursor = node.parentId;
    let steps = 0;
    while (cursor !== null) {
      steps += 1;
      if (steps > nodes.length || visited.has(cursor)) {
        issues.add('TOC_CYCLE', `$.toc.${node.id}`, 'toc parent chain contains a cycle');
        break;
      }
      visited.add(cursor);
      cursor = byId.get(cursor)?.parentId ?? null;
    }
  }

  // Reachability from the root: anything unreachable is an orphan/cycle artifact.
  const depthOf = new Map<Id, number>();
  const queue: TocNodeLike[] = [];
  const root = roots[0];
  if (root !== undefined) {
    depthOf.set(root.id, 0);
    queue.push(root);
  }
  while (queue.length > 0) {
    const current = queue.shift() as TocNodeLike;
    const depth = depthOf.get(current.id) ?? 0;
    for (const child of childrenOf.get(current.id) ?? []) {
      if (depthOf.has(child.id)) continue;
      depthOf.set(child.id, depth + 1);
      queue.push(child);
    }
  }
  for (const node of nodes) {
    if (!depthOf.has(node.id)) {
      issues.add('TOC_ORPHAN', `$.toc.${node.id}`, 'toc node is not reachable from the volume root');
    }
  }

  return finish({ byId, roots, childrenOf, depthOf }, issues);
}

export interface RelationIndex {
  readonly byId: ReadonlyMap<Id, Relation>;
  readonly prerequisiteAdjacency: ReadonlyMap<Id, readonly Id[]>;
}

export function checkRelations(
  relations: readonly Relation[],
  conceptIds: ReadonlySet<Id>,
  courseEditionId: Id,
): ValidationResult<RelationIndex> {
  const issues = new IssueCollector();
  const byId = new Map<Id, Relation>();
  const prerequisitePairs = new Set<string>();
  const relatedPairs = new Set<string>();
  const adjacency = new Map<Id, Id[]>();

  for (const relation of relations) {
    if (byId.has(relation.id)) {
      issues.add('DUPLICATE_ID', `$.relations.${relation.id}`, `duplicate relation id ${relation.id}`);
      continue;
    }
    byId.set(relation.id, relation);
    if (relation.courseEditionId !== courseEditionId) {
      issues.add(
        'INVALID_REFERENCE',
        `$.relations.${relation.id}.courseEditionId`,
        `relation belongs to ${relation.courseEditionId}, expected ${courseEditionId}`,
      );
    }
    if (!conceptIds.has(relation.fromConceptId)) {
      issues.add(
        'DANGLING_REFERENCE',
        `$.relations.${relation.id}.fromConceptId`,
        `concept ${relation.fromConceptId} does not exist in this pack`,
      );
    }
    if (!conceptIds.has(relation.toConceptId)) {
      issues.add(
        'DANGLING_REFERENCE',
        `$.relations.${relation.id}.toConceptId`,
        `concept ${relation.toConceptId} does not exist in this pack`,
      );
    }
    if (relation.fromConceptId === relation.toConceptId) {
      issues.add(
        'RELATION_SELF_LOOP',
        `$.relations.${relation.id}`,
        'relations must not point a concept at itself',
      );
      continue;
    }
    if (relation.basis === 'explicit_source' && relation.sourceRefs.length === 0) {
      issues.add(
        'RELATION_SOURCE_REQUIRED',
        `$.relations.${relation.id}.sourceRefs`,
        'explicit_source relations require source refs',
      );
    }
    if (relation.basis === 'pedagogical_inference' && relation.rationale.trim().length === 0) {
      issues.add(
        'RELATION_RATIONALE_REQUIRED',
        `$.relations.${relation.id}.rationale`,
        'pedagogical inference relations require a rationale',
      );
    }
    if (relation.type === 'prerequisite') {
      const pair = `${relation.fromConceptId}->${relation.toConceptId}`;
      if (prerequisitePairs.has(pair)) {
        issues.add('RELATION_DUPLICATE', `$.relations.${relation.id}`, 'duplicate prerequisite edge');
      }
      prerequisitePairs.add(pair);
      const list = adjacency.get(relation.fromConceptId) ?? [];
      list.push(relation.toConceptId);
      adjacency.set(relation.fromConceptId, list);
    } else {
      const pair = [relation.fromConceptId, relation.toConceptId].sort().join('<->');
      if (relatedPairs.has(pair)) {
        issues.add('RELATION_DUPLICATE', `$.relations.${relation.id}`, 'duplicate related edge');
      }
      relatedPairs.add(pair);
      if (relation.fromConceptId > relation.toConceptId) {
        issues.add(
          'RELATION_ENDPOINT_ORDER',
          `$.relations.${relation.id}`,
          'related endpoints must be stored in sorted order (dedupe requirement)',
        );
      }
    }
  }

  // Prerequisite cycle detection (DFS colouring).
  const visiting = new Set<Id>();
  const visited = new Set<Id>();
  const stack: Id[] = [];
  const dfs = (node: Id): void => {
    if (visited.has(node)) return;
    if (visiting.has(node)) {
      issues.add(
        'RELATION_CYCLE',
        '$.relations',
        `prerequisite cycle detected: ${[...stack, node].join(' -> ')}`,
      );
      return;
    }
    visiting.add(node);
    stack.push(node);
    for (const next of adjacency.get(node) ?? []) dfs(next);
    stack.pop();
    visiting.delete(node);
    visited.add(node);
  };
  for (const conceptId of adjacency.keys()) dfs(conceptId);

  return finish({ byId, prerequisiteAdjacency: adjacency }, issues);
}

function checkDuplicateEntityIds(pack: ContentPack): IssueCollector {
  const issues = new IssueCollector();
  const seen = new Map<Id, string>();
  const register = (id: Id, bucket: string): void => {
    const previous = seen.get(id);
    if (previous !== undefined) {
      issues.add('DUPLICATE_ID', `$.${bucket}.${id}`, `id ${id} already used by ${previous}`);
    } else {
      seen.set(id, bucket);
    }
  };
  for (const node of pack.toc) register(node.id, 'toc');
  for (const concept of pack.concepts) register(concept.id, 'concepts');
  for (const relation of pack.relations) register(relation.id, 'relations');
  for (const activity of pack.activities) register(activity.id, 'activities');
  for (const rubric of pack.rubrics) register(rubric.id, 'rubrics');
  for (const entry of pack.reviewLedger) register(entry.id, 'reviewLedger');
  return issues;
}

function checkConceptReferences(pack: ContentPack, concept: Concept): IssueCollector {
  const issues = new IssueCollector();
  const tocIds = new Set(pack.toc.map((node) => node.id));
  const rubricIds = new Set(pack.rubrics.map((rubric) => rubric.id));
  const activityIds = new Set(pack.activities.map((activity) => activity.id));
  for (const placement of concept.placements) {
    if (!tocIds.has(placement)) {
      issues.add(
        'DANGLING_REFERENCE',
        `$.concepts.${concept.id}.placements`,
        `toc node ${placement} does not exist in this pack`,
      );
    }
  }
  for (const rubricId of concept.rubricIds) {
    if (!rubricIds.has(rubricId)) {
      issues.add(
        'DANGLING_REFERENCE',
        `$.concepts.${concept.id}.rubricIds`,
        `rubric ${rubricId} does not exist in this pack`,
      );
    }
  }
  for (const activityId of concept.activityIds) {
    if (!activityIds.has(activityId)) {
      issues.add(
        'DANGLING_REFERENCE',
        `$.concepts.${concept.id}.activityIds`,
        `activity ${activityId} does not exist in this pack`,
      );
    }
  }
  if (concept.reviewState === 'published') {
    if (concept.sourceRefs.length === 0) {
      issues.add(
        'MISSING_SOURCE',
        `$.concepts.${concept.id}.sourceRefs`,
        'a published concept requires source refs',
      );
    }
    if (concept.learningObjectives.length === 0) {
      issues.add(
        'MISSING_OBJECTIVE',
        `$.concepts.${concept.id}.learningObjectives`,
        'a published concept requires observable learning objectives',
      );
    }
  }
  return issues;
}

function checkActivityReferences(pack: ContentPack): IssueCollector {
  const issues = new IssueCollector();
  const conceptIds = new Set(pack.concepts.map((concept) => concept.id));
  const rubrics = new Map(pack.rubrics.map((rubric) => [rubric.id, rubric]));
  for (const activity of pack.activities) {
    for (const conceptId of activity.conceptIds) {
      if (!conceptIds.has(conceptId)) {
        issues.add(
          'DANGLING_REFERENCE',
          `$.activities.${activity.id}.conceptIds`,
          `concept ${conceptId} does not exist in this pack`,
        );
      }
    }
    const rubric = rubrics.get(activity.rubricId);
    if (rubric === undefined) {
      issues.add(
        'DANGLING_REFERENCE',
        `$.activities.${activity.id}.rubricId`,
        `rubric ${activity.rubricId} does not exist in this pack`,
      );
    } else if (rubric.version !== activity.rubricVersion) {
      issues.add(
        'INVALID_REFERENCE',
        `$.activities.${activity.id}.rubricVersion`,
        `activity binds rubric version ${activity.rubricVersion}, rubric is ${rubric.version}`,
      );
    }
  }
  for (const rubric of pack.rubrics) {
    for (const conceptId of rubric.conceptIds) {
      if (!conceptIds.has(conceptId)) {
        issues.add(
          'DANGLING_REFERENCE',
          `$.rubrics.${rubric.id}.conceptIds`,
          `concept ${conceptId} does not exist in this pack`,
        );
      }
    }
  }
  return issues;
}

function checkCoverage(pack: ContentPack): IssueCollector {
  const issues = new IssueCollector();
  const tocIds = new Set(pack.toc.map((node) => node.id));
  const conceptIds = new Set(pack.concepts.map((concept) => concept.id));
  const manifest = pack.coverageManifest;
  if (manifest.courseEditionId !== pack.courseEditionId) {
    issues.add(
      'INVALID_REFERENCE',
      '$.coverageManifest.courseEditionId',
      'coverage manifest belongs to another course edition',
    );
  }
  const target = new Set(manifest.targetTocNodeIds);
  if (target.size !== manifest.targetTocNodeIds.length) {
    issues.add('DUPLICATE_ID', '$.coverageManifest.targetTocNodeIds', 'duplicate target toc ids');
  }
  for (const targetId of target) {
    if (!tocIds.has(targetId)) {
      issues.add(
        'COVERAGE_REFERENCE_INVALID',
        '$.coverageManifest.targetTocNodeIds',
        `target toc node ${targetId} does not exist in this pack`,
      );
    }
  }
  const sectionsByToc = new Map<Id, (typeof manifest.sections)[number]>();
  for (const section of manifest.sections) {
    if (sectionsByToc.has(section.tocNodeId)) {
      issues.add(
        'COVERAGE_REFERENCE_INVALID',
        `$.coverageManifest.sections.${section.tocNodeId}`,
        'duplicate coverage section',
      );
    }
    sectionsByToc.set(section.tocNodeId, section);
    if (!target.has(section.tocNodeId)) {
      issues.add(
        'COVERAGE_REFERENCE_INVALID',
        `$.coverageManifest.sections.${section.tocNodeId}`,
        'coverage section is not listed in targetTocNodeIds',
      );
    }
    if (!tocIds.has(section.tocNodeId)) {
      issues.add(
        'COVERAGE_REFERENCE_INVALID',
        `$.coverageManifest.sections.${section.tocNodeId}`,
        'coverage section toc node does not exist',
      );
    }
    for (const conceptId of section.conceptIds) {
      if (!conceptIds.has(conceptId)) {
        issues.add(
          'DANGLING_REFERENCE',
          `$.coverageManifest.sections.${section.tocNodeId}.conceptIds`,
          `concept ${conceptId} does not exist in this pack`,
        );
      }
    }
  }
  const covered = manifest.sections.filter((section) => section.status === 'covered').length;
  if (covered !== manifest.totals.coveredSections) {
    issues.add(
      'COVERAGE_INCOMPLETE',
      '$.coverageManifest.totals.coveredSections',
      `coveredSections is ${manifest.totals.coveredSections}, counted ${covered}`,
    );
  }
  if (manifest.totals.targetSections !== manifest.targetTocNodeIds.length) {
    issues.add(
      'COVERAGE_INCOMPLETE',
      '$.coverageManifest.totals.targetSections',
      'targetSections must equal targetTocNodeIds length',
    );
  }
  if (manifest.totals.conceptCount !== pack.concepts.length) {
    issues.add(
      'COVERAGE_INCOMPLETE',
      '$.coverageManifest.totals.conceptCount',
      'conceptCount must equal the number of concepts in the pack',
    );
  }
  if (pack.coverageStatus === 'complete') {
    if (covered !== target.size || manifest.sections.length !== target.size) {
      issues.add(
        'COVERAGE_INCOMPLETE',
        '$.coverageStatus',
        'coverageStatus=complete requires every target section to be covered',
      );
    }
  }
  return issues;
}

function checkPublicationRules(pack: ContentPack): IssueCollector {
  const issues = new IssueCollector();
  if (pack.scope === 'partial' && pack.coverageStatus === 'complete') {
    issues.add(
      'PACK_SCOPE_INVALID',
      '$.coverageStatus',
      'a partial scope cannot claim complete volume coverage',
    );
  }
  if (pack.status === 'published') {
    if (pack.scope === 'partial' && pack.coverageStatus === 'complete') {
      issues.add(
        'PACK_SCOPE_INVALID',
        '$.coverageStatus',
        'published partial packs must keep coverageStatus=partial',
      );
    }
    if (pack.scope === 'full_volume' && pack.coverageStatus !== 'complete') {
      issues.add(
        'COVERAGE_INCOMPLETE',
        '$.coverageStatus',
        'a published full volume pack requires coverageStatus=complete',
      );
    }
    for (const concept of pack.concepts) {
      if (concept.reviewState !== 'published') {
        issues.add(
          'REVIEW_STATE_INVALID',
          `$.concepts.${concept.id}.reviewState`,
          'a published pack may only contain published concepts',
        );
      }
    }
    for (const relation of pack.relations) {
      if (relation.reviewState !== 'published' && relation.reviewState !== 'curator_checked') {
        issues.add(
          'REVIEW_STATE_INVALID',
          `$.relations.${relation.id}.reviewState`,
          'published packs require reviewed relations',
        );
      }
    }
    for (const activity of pack.activities) {
      if (!pack.rubrics.some((rubric) => rubric.id === activity.rubricId)) {
        issues.add(
          'REVIEW_STATE_INVALID',
          `$.activities.${activity.id}.rubricId`,
          'published packs require each activity rubric to exist and be reviewed',
        );
      }
    }
    for (const rubric of pack.rubrics) {
      if (rubric.reviewState !== 'published' && rubric.reviewState !== 'curator_checked') {
        issues.add(
          'REVIEW_STATE_INVALID',
          `$.rubrics.${rubric.id}.reviewState`,
          'published packs require reviewed rubrics',
        );
      }
    }
    const packLedger = pack.reviewLedger.filter(
      (entry) => entry.entityKind === 'content_pack' && entry.entityId === pack.id,
    );
    if (packLedger.length === 0) {
      issues.add(
        'REVIEW_STATE_INVALID',
        '$.reviewLedger',
        'a published pack requires at least one review ledger entry for the pack',
      );
    }
  }
  if (pack.status === 'candidate') {
    for (const concept of pack.concepts) {
      if (concept.reviewState === 'published') {
        issues.add(
          'CANDIDATE_STRONG_CLAIM',
          `$.concepts.${concept.id}.reviewState`,
          'candidate packs cannot contain published concepts',
        );
      }
    }
    if (pack.reviewLedger.some((entry) => entry.to === 'published')) {
      issues.add(
        'CANDIDATE_STRONG_CLAIM',
        '$.reviewLedger',
        'candidate packs must not claim a published review decision',
      );
    }
  }
  if (pack.status === 'rejected') {
    // Rejected packs remain valid data for audit; the teaching/trust guard
    // (not the structural validator) refuses to load them.
  }
  return issues;
}

function checkReviewLedger(pack: ContentPack): IssueCollector {
  const issues = new IssueCollector();
  const known = new Set<Id>([
    pack.id,
    ...pack.toc.map((node) => node.id),
    ...pack.concepts.map((concept) => concept.id),
    ...pack.relations.map((relation) => relation.id),
    ...pack.activities.map((activity) => activity.id),
    ...pack.rubrics.map((rubric) => rubric.id),
  ]);
  for (const entry of pack.reviewLedger) {
    if (!known.has(entry.entityId)) {
      issues.add(
        'DANGLING_REFERENCE',
        `$.reviewLedger.${entry.id}.entityId`,
        `review ledger entity ${entry.entityId} does not exist in this pack`,
      );
    }
  }
  return issues;
}

export interface ContentPackValidationOptions {
  /** Optional known source ref ids (book instance store) for dangling checks. */
  readonly sourceRefIds?: ReadonlySet<Id>;
}

export function validateContentPack(
  input: unknown,
  options: ContentPackValidationOptions = {},
): ValidationResult<ContentPack> {
  const structural = validateContentPackStructure(input);
  if (!structural.ok) return structural;
  const pack = structural.value;
  const issues = new IssueCollector();

  const toc = checkTocTree(pack.toc, pack.courseEditionId);
  if (!toc.ok) issues.list.push(...toc.issues);
  const conceptIds = new Set(pack.concepts.map((concept) => concept.id));
  const relations = checkRelations(pack.relations, conceptIds, pack.courseEditionId);
  if (!relations.ok) issues.list.push(...relations.issues);

  issues.list.push(...checkDuplicateEntityIds(pack).list);
  for (const concept of pack.concepts) {
    issues.list.push(...checkConceptReferences(pack, concept).list);
    if (concept.courseEditionId !== pack.courseEditionId) {
      issues.add(
        'INVALID_REFERENCE',
        `$.concepts.${concept.id}.courseEditionId`,
        'concept belongs to another course edition',
      );
    }
    if (options.sourceRefIds !== undefined) {
      for (const sourceRefId of concept.sourceRefs) {
        if (!options.sourceRefIds.has(sourceRefId)) {
          issues.add(
            'DANGLING_REFERENCE',
            `$.concepts.${concept.id}.sourceRefs`,
            `source ref ${sourceRefId} does not resolve in the bound book instance`,
          );
        }
      }
    }
  }
  issues.list.push(...checkActivityReferences(pack).list);
  issues.list.push(...checkCoverage(pack).list);
  issues.list.push(...checkPublicationRules(pack).list);
  issues.list.push(...checkReviewLedger(pack).list);

  return finish(pack, issues);
}

/**
 * Publication is append only: an existing (id, version) content identity can
 * never be rewritten in place. A new version must have a different content
 * hash. This is the guard T04 uses before writing a published pack.
 */
export function validateContentPackUpdate(
  previous: ContentPack,
  next: ContentPack,
): ValidationResult<ContentPack> {
  const issues = new IssueCollector();
  if (previous.id !== next.id) {
    issues.add('INVALID_REFERENCE', '$.id', 'content pack id must not change across updates');
  }
  if (previous.courseEditionId !== next.courseEditionId) {
    issues.add(
      'INVALID_REFERENCE',
      '$.courseEditionId',
      'course edition must not change across pack updates',
    );
  }
  if (previous.version === next.version && previous.contentHash !== next.contentHash) {
    issues.add(
      'PACK_IMMUTABLE',
      '$.contentHash',
      'a published pack version is immutable; publish a new version instead of rewriting content',
    );
  }
  if (previous.version !== next.version && previous.contentHash === next.contentHash) {
    issues.add(
      'PACK_IMMUTABLE',
      '$.version',
      'a new pack version must change the content hash',
    );
  }
  if (previous.status === 'published' && next.status === 'draft') {
    issues.add('PACK_STATUS_INVALID', '$.status', 'a published pack cannot be reverted to draft');
  }
  return finish(next, issues);
}
