/**
 * Concept graph index (05 §2 Relation, A11).
 *
 * Invariants (self loop, prerequisite cycle, dangling endpoints, duplicate
 * edges, related endpoint ordering, prerequisite basis/rationale) are owned by
 * the frozen domain validator plus one T04 strictness rule: a *prerequisite*
 * edge must always carry a non-empty rationale, whichever basis it claims.
 *
 * T04 never derives prerequisite edges from TOC order. A pack whose table of
 * contents implies "section 1 before section 2" but whose `relations` array is
 * empty has zero prerequisite edges here (see `graph-order.test.ts`): only the
 * authored relations are graph truth.
 *
 * Neighborhood queries are always bounded by depth *and* node count so the map
 * can open a chapter sized local graph instead of the whole volume.
 */

import {
  checkRelations,
  validateContentPack,
  type Concept,
  type ContentPack,
  type Id,
  type Relation,
  type RelationType,
} from '@edu/domain';
import {
  failBuild,
  issuesFromDomain,
  knowledgeError,
  knowledgeIssue,
  okBuild,
  okValue,
  failValue,
  type BuildResult,
  type KnowledgeIssue,
  type KnowledgeResult,
} from './knowledge-errors.js';

/** Default local graph: chapter sized, not the whole volume. */
export const DEFAULT_NEIGHBORHOOD_DEPTH = 2;
export const DEFAULT_NEIGHBORHOOD_NODES = 25;
export const HARD_MAX_NEIGHBORHOOD_DEPTH = 6;
export const HARD_MAX_NEIGHBORHOOD_NODES = 200;
export const DEFAULT_SEARCH_LIMIT = 20;
export const HARD_MAX_SEARCH_LIMIT = 100;

export interface MonotonicTimer {
  nowMs(): number;
}

/**
 * Wall clock only for *measurements* (never for facts). `performance.now()` is
 * monotonic where available; `Date.now()` is the documented fallback.
 */
export const monotonicTimer: MonotonicTimer = {
  nowMs: () => {
    const candidate = (globalThis as { performance?: { now?: () => number } }).performance;
    if (candidate !== undefined && typeof candidate.now === 'function') return candidate.now();
    return Date.now();
  },
};

export interface NeighborhoodOptions {
  /** Maximum edge hops from the center concept (default 2). */
  readonly maxDepth?: number;
  /** Maximum number of concepts returned, center included (default 25). */
  readonly maxNodes?: number;
  /** Traversed relation types; defaults to prerequisite + related. */
  readonly includeRelationTypes?: readonly RelationType[];
}

export interface NeighborhoodStats {
  readonly maxDepthLimit: number;
  readonly maxNodeLimit: number;
  readonly visitedConcepts: number;
  readonly visitedRelations: number;
  readonly maxDepthReached: number;
  /** Measured duration of this single query, in milliseconds. */
  readonly durationMs: number;
}

export interface BoundedNeighborhood {
  readonly packId: Id;
  readonly packVersion: string;
  readonly centerConceptId: Id;
  readonly concepts: readonly Concept[];
  readonly relations: readonly Relation[];
  readonly truncated: boolean;
  readonly stats: NeighborhoodStats;
}

export type ConceptSearchMatch = 'title' | 'alias';

export interface ConceptSearchHit {
  readonly conceptId: Id;
  readonly title: string;
  readonly matchedOn: ConceptSearchMatch;
  readonly matchedText: string;
  readonly score: number;
}

export interface SearchOptions {
  readonly limit?: number;
}

export interface KnowledgeGraph {
  readonly packId: Id;
  readonly packVersion: string;
  readonly courseEditionId: Id;
  readonly conceptCount: number;
  readonly relationCount: number;
  readonly prerequisiteCount: number;
  readonly relatedCount: number;
  concepts(): readonly Concept[];
  relations(): readonly Relation[];
  concept(id: Id): Concept | undefined;
  relationsOf(id: Id): readonly Relation[];
  successors(id: Id): readonly Id[];
  predecessors(id: Id): readonly Id[];
  relatedTo(id: Id): readonly Id[];
  /** Deterministic Kahn order; the graph is a DAG, so this always completes. */
  prerequisiteTopologicalOrder(): readonly Id[];
  neighborhood(centerConceptId: Id, options?: NeighborhoodOptions): KnowledgeResult<BoundedNeighborhood>;
  /** Bounded view of an explicit concept set (used for chapter views). */
  viewOf(
    conceptIds: readonly Id[],
    options?: { readonly maxNodes?: number; readonly centerConceptId?: Id },
  ): KnowledgeResult<BoundedNeighborhood>;
  search(query: string, options?: SearchOptions): readonly ConceptSearchHit[];
}

interface NormalizedLimits {
  readonly maxDepth: number;
  readonly maxNodes: number;
  readonly types: readonly RelationType[];
}

function normalizeOptions(options: NeighborhoodOptions): KnowledgeResult<NormalizedLimits> {
  const rawDepth = options.maxDepth ?? DEFAULT_NEIGHBORHOOD_DEPTH;
  const rawNodes = options.maxNodes ?? DEFAULT_NEIGHBORHOOD_NODES;
  if (!Number.isInteger(rawDepth) || rawDepth < 0 || rawDepth > HARD_MAX_NEIGHBORHOOD_DEPTH) {
    return failValue(
      knowledgeError(
        'INVALID_QUERY',
        `maxDepth must be an integer between 0 and ${HARD_MAX_NEIGHBORHOOD_DEPTH}`,
        { path: '$.maxDepth' },
      ),
    );
  }
  if (!Number.isInteger(rawNodes) || rawNodes < 1 || rawNodes > HARD_MAX_NEIGHBORHOOD_NODES) {
    return failValue(
      knowledgeError(
        'INVALID_QUERY',
        `maxNodes must be an integer between 1 and ${HARD_MAX_NEIGHBORHOOD_NODES}`,
        { path: '$.maxNodes' },
      ),
    );
  }
  const types = options.includeRelationTypes ?? ['prerequisite', 'related'];
  if (types.length === 0) {
    return failValue(knowledgeError('INVALID_QUERY', 'includeRelationTypes must not be empty', {
      path: '$.includeRelationTypes',
    }));
  }
  return okValue({ maxDepth: rawDepth, maxNodes: rawNodes, types });
}

function sortedUnique(ids: readonly Id[]): readonly Id[] {
  return [...new Set(ids)].sort();
}

export function buildKnowledgeGraph(pack: ContentPack): BuildResult<KnowledgeGraph> {
  const validation = validateContentPack(pack);
  if (!validation.ok) return failBuild(issuesFromDomain(validation.issues));

  const issues: KnowledgeIssue[] = [];
  for (const relation of pack.relations) {
    if (relation.type !== 'prerequisite') continue;
    if (relation.rationale.trim().length === 0) {
      issues.push(
        knowledgeIssue(
          'RELATION_RATIONALE_REQUIRED',
          `$.relations.${relation.id}.rationale`,
          'a prerequisite edge requires a rationale, even when the basis is explicit_source',
        ),
      );
    }
  }
  if (issues.length > 0) return failBuild(issues);

  const conceptIds = new Set(pack.concepts.map((concept) => concept.id));
  const domainRelations = checkRelations(pack.relations, conceptIds, pack.courseEditionId);
  if (!domainRelations.ok) return failBuild(issuesFromDomain(domainRelations.issues));

  const conceptsById = new Map<Id, Concept>();
  for (const concept of pack.concepts) conceptsById.set(concept.id, concept);

  const outgoingPrereq = new Map<Id, Set<Id>>();
  const incomingPrereq = new Map<Id, Set<Id>>();
  const related = new Map<Id, Set<Id>>();
  const relationsByConcept = new Map<Id, Relation[]>();
  const registerRelation = (conceptId: Id, relation: Relation): void => {
    const list = relationsByConcept.get(conceptId) ?? [];
    list.push(relation);
    relationsByConcept.set(conceptId, list);
  };

  for (const relation of pack.relations) {
    if (relation.type === 'prerequisite') {
      const out = outgoingPrereq.get(relation.fromConceptId) ?? new Set<Id>();
      out.add(relation.toConceptId);
      outgoingPrereq.set(relation.fromConceptId, out);
      const incoming = incomingPrereq.get(relation.toConceptId) ?? new Set<Id>();
      incoming.add(relation.fromConceptId);
      incomingPrereq.set(relation.toConceptId, incoming);
    } else {
      const left = related.get(relation.fromConceptId) ?? new Set<Id>();
      left.add(relation.toConceptId);
      related.set(relation.fromConceptId, left);
      const right = related.get(relation.toConceptId) ?? new Set<Id>();
      right.add(relation.fromConceptId);
      related.set(relation.toConceptId, right);
    }
    registerRelation(relation.fromConceptId, relation);
    registerRelation(relation.toConceptId, relation);
  }

  const successors = (id: Id): readonly Id[] => sortedUnique([...(outgoingPrereq.get(id) ?? [])]);
  const predecessors = (id: Id): readonly Id[] => sortedUnique([...(incomingPrereq.get(id) ?? [])]);
  const relatedTo = (id: Id): readonly Id[] => sortedUnique([...(related.get(id) ?? [])]);

  const neighborsOf = (id: Id, types: readonly RelationType[]): readonly Id[] => {
    const collected: Id[] = [];
    if (types.includes('prerequisite')) collected.push(...successors(id), ...predecessors(id));
    if (types.includes('related')) collected.push(...relatedTo(id));
    return sortedUnique(collected);
  };

  const collectView = (
    requestedIds: readonly Id[],
    limits: NormalizedLimits,
  ): { neighbors: readonly Id[]; concepts: readonly Concept[]; relations: readonly Relation[]; truncated: boolean } => {
    const seen = new Set<Id>();
    const ordered: Id[] = [];
    for (const id of requestedIds) {
      if (!conceptsById.has(id) || seen.has(id)) continue;
      seen.add(id);
      ordered.push(id);
    }
    const truncatedByNodeLimit = ordered.length > limits.maxNodes;
    const kept = ordered.slice(0, limits.maxNodes);
    const included = new Set<Id>(kept);
    const concepts: Concept[] = [];
    for (const id of kept) {
      const concept = conceptsById.get(id);
      if (concept !== undefined) concepts.push(concept);
    }
    const relations = pack.relations.filter(
      (relation) =>
        included.has(relation.fromConceptId) && included.has(relation.toConceptId),
    );
    return {
      neighbors: kept,
      concepts,
      relations,
      truncated: truncatedByNodeLimit,
    };
  };

  const graph: KnowledgeGraph = {
    packId: pack.id,
    packVersion: pack.version,
    courseEditionId: pack.courseEditionId,
    conceptCount: pack.concepts.length,
    relationCount: pack.relations.length,
    prerequisiteCount: pack.relations.filter((relation) => relation.type === 'prerequisite').length,
    relatedCount: pack.relations.filter((relation) => relation.type === 'related').length,
    concepts: () => pack.concepts,
    relations: () => pack.relations,
    concept: (id) => conceptsById.get(id),
    relationsOf: (id) =>
      [...(relationsByConcept.get(id) ?? [])].sort((left, right) =>
        left.id < right.id ? -1 : left.id > right.id ? 1 : 0,
      ),
    successors,
    predecessors,
    relatedTo,
    prerequisiteTopologicalOrder: () => {
      const indegree = new Map<Id, number>();
      for (const concept of pack.concepts) indegree.set(concept.id, predecessors(concept.id).length);
      const ready = pack.concepts
        .filter((concept) => indegree.get(concept.id) === 0)
        .map((concept) => concept.id)
        .sort();
      const order: Id[] = [];
      while (ready.length > 0) {
        const current = ready.shift() as Id;
        order.push(current);
        for (const next of successors(current)) {
          const nextDegree = (indegree.get(next) ?? 0) - 1;
          indegree.set(next, nextDegree);
          if (nextDegree === 0) {
            ready.push(next);
            ready.sort();
          }
        }
      }
      return order;
    },
    neighborhood: (centerConceptId, options = {}) => {
      if (!conceptsById.has(centerConceptId)) {
        return failValue(
          knowledgeError('CONCEPT_NOT_FOUND', `concept ${centerConceptId} is not in this pack`, {
            path: '$.conceptId',
          }),
        );
      }
      const limits = normalizeOptions(options);
      if (!limits.ok) return limits;
      const startedAt = monotonicTimer.nowMs();
      const { maxDepth, maxNodes, types } = limits.value;
      const included = new Set<Id>([centerConceptId]);
      let frontier: Id[] = [centerConceptId];
      let depthReached = 0;
      let truncated = false;
      let depth = 0;
      while (frontier.length > 0 && depth < maxDepth) {
        const nextFrontier: Id[] = [];
        for (const current of frontier) {
          for (const neighbor of neighborsOf(current, types)) {
            if (included.has(neighbor)) continue;
            if (included.size >= maxNodes) {
              truncated = true;
              continue;
            }
            included.add(neighbor);
            nextFrontier.push(neighbor);
          }
        }
        depth += 1;
        if (nextFrontier.length === 0) break;
        depthReached = depth;
        frontier = nextFrontier.sort();
      }
      const view = collectView([...included], {
        maxDepth,
        maxNodes,
        types,
      });
      const durationMs = monotonicTimer.nowMs() - startedAt;
      return okValue({
        packId: pack.id,
        packVersion: pack.version,
        centerConceptId,
        concepts: view.concepts,
        relations: view.relations,
        truncated: truncated || view.truncated,
        stats: {
          maxDepthLimit: maxDepth,
          maxNodeLimit: maxNodes,
          visitedConcepts: view.concepts.length,
          visitedRelations: view.relations.length,
          maxDepthReached: depthReached,
          durationMs: Math.round(durationMs * 1000) / 1000,
        },
      });
    },
    viewOf: (requestedIds, options = {}) => {
      const limits = normalizeOptions({ maxNodes: options.maxNodes });
      if (!limits.ok) return limits;
      const startedAt = monotonicTimer.nowMs();
      const view = collectView(requestedIds, limits.value);
      const durationMs = monotonicTimer.nowMs() - startedAt;
      const center = options.centerConceptId;
      if (center !== undefined && !conceptsById.has(center)) {
        return failValue(
          knowledgeError('CONCEPT_NOT_FOUND', `concept ${center} is not in this pack`, {
            path: '$.conceptId',
          }),
        );
      }
      return okValue({
        packId: pack.id,
        packVersion: pack.version,
        centerConceptId: center ?? '',
        concepts: view.concepts,
        relations: view.relations,
        truncated: view.truncated,
        stats: {
          maxDepthLimit: limits.value.maxDepth,
          maxNodeLimit: limits.value.maxNodes,
          visitedConcepts: view.concepts.length,
          visitedRelations: view.relations.length,
          maxDepthReached: 0,
          durationMs: Math.round(durationMs * 1000) / 1000,
        },
      });
    },
    search: (query, options = {}) => {
      const requested = options.limit ?? DEFAULT_SEARCH_LIMIT;
      const limit =
        Number.isInteger(requested) && requested > 0
          ? Math.min(requested, HARD_MAX_SEARCH_LIMIT)
          : DEFAULT_SEARCH_LIMIT;
      const needle = query.trim().toLowerCase();
      if (needle.length === 0) return [];
      const hits: ConceptSearchHit[] = [];
      for (const concept of pack.concepts) {
        const title = concept.title.toLowerCase();
        const candidates: Array<Omit<ConceptSearchHit, 'conceptId' | 'title'>> = [];
        if (title === needle) candidates.push({ matchedOn: 'title', matchedText: concept.title, score: 100 });
        else if (title.startsWith(needle)) {
          candidates.push({ matchedOn: 'title', matchedText: concept.title, score: 80 });
        } else if (title.includes(needle)) {
          candidates.push({ matchedOn: 'title', matchedText: concept.title, score: 60 });
        }
        for (const alias of concept.aliases) {
          const lowered = alias.toLowerCase();
          if (lowered === needle) candidates.push({ matchedOn: 'alias', matchedText: alias, score: 95 });
          else if (lowered.startsWith(needle)) {
            candidates.push({ matchedOn: 'alias', matchedText: alias, score: 75 });
          } else if (lowered.includes(needle)) {
            candidates.push({ matchedOn: 'alias', matchedText: alias, score: 55 });
          }
        }
        if (candidates.length === 0) continue;
        candidates.sort((left, right) => right.score - left.score);
        const best = candidates[0] as Omit<ConceptSearchHit, 'conceptId' | 'title'>;
        hits.push({ conceptId: concept.id, title: concept.title, ...best });
      }
      return hits
        .sort((left, right) => {
          if (left.score !== right.score) return right.score - left.score;
          if (left.title.length !== right.title.length) return left.title.length - right.title.length;
          return left.conceptId < right.conceptId ? -1 : left.conceptId > right.conceptId ? 1 : 0;
        })
        .slice(0, limit);
    },
  };
  return okBuild(graph);
}
