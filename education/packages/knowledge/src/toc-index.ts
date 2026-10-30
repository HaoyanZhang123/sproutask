/**
 * TOC index (05 §2 TocNode, A11 tree queries).
 *
 * A pack is a single volume tree and a concept may be placed in more than one
 * section. Every "count" here is a distinct concept count: one concept placed
 * in two sections is still one learnable concept, which is what the progress
 * aggregate (05 §3.4) and the map UI need.
 *
 * Tree validity (single root, no cycle, no orphan, unique sibling order,
 * type hierarchy) is owned by the frozen domain validator, so this index only
 * builds navigation on top of it instead of re-implementing the rules.
 */

import {
  checkTocTree,
  type ContentPack,
  type Id,
  type TocNodeLike,
} from '@edu/domain';
import {
  failBuild,
  issuesFromDomain,
  okBuild,
  type BuildResult,
} from './knowledge-errors.js';

export interface TocIndex {
  readonly packId: Id;
  readonly packVersion: string;
  readonly nodes: readonly TocNodeLike[];
  readonly roots: readonly TocNodeLike[];
  node(id: Id): TocNodeLike | undefined;
  root(): TocNodeLike | null;
  depthOf(id: Id): number | undefined;
  parentOf(id: Id): TocNodeLike | null;
  childrenOf(id: Id): readonly TocNodeLike[];
  pathTo(id: Id): readonly TocNodeLike[];
  subtreeOf(id: Id, options?: { readonly maxDepth?: number }): readonly TocNodeLike[];
  conceptIdsIn(id: Id, options?: { readonly includeDescendants?: boolean }): readonly Id[];
  conceptCountIn(id: Id, options?: { readonly includeDescendants?: boolean }): number;
  placementsOf(conceptId: Id): readonly TocNodeLike[];
  chapterOf(id: Id): TocNodeLike | null;
  conceptsInChapter(nodeId: Id): readonly Id[];
}

function sortSiblings(nodes: readonly TocNodeLike[]): readonly TocNodeLike[] {
  return [...nodes].sort((left, right) => {
    if (left.order !== right.order) return left.order - right.order;
    return left.id < right.id ? -1 : left.id > right.id ? 1 : 0;
  });
}

export function buildTocIndex(pack: ContentPack): BuildResult<TocIndex> {
  const tree = checkTocTree(pack.toc, pack.courseEditionId);
  if (!tree.ok) return failBuild(issuesFromDomain(tree.issues));

  const { byId, roots, childrenOf, depthOf } = tree.value;
  const children = new Map<Id, readonly TocNodeLike[]>();
  for (const [parentId, list] of childrenOf) children.set(parentId, sortSiblings(list));

  const conceptIdsByPlacement = new Map<Id, Set<Id>>();
  const placementsByConcept = new Map<Id, TocNodeLike[]>();
  for (const concept of pack.concepts) {
    for (const placement of concept.placements) {
      const bucket = conceptIdsByPlacement.get(placement) ?? new Set<Id>();
      bucket.add(concept.id);
      conceptIdsByPlacement.set(placement, bucket);
      const list = placementsByConcept.get(concept.id) ?? [];
      const node = byId.get(placement);
      if (node !== undefined) list.push(node);
      placementsByConcept.set(concept.id, list);
    }
  }

  const childrenOfNode = (id: Id): readonly TocNodeLike[] => children.get(id) ?? [];

  const subtreeOf = (id: Id, options: { readonly maxDepth?: number } = {}): readonly TocNodeLike[] => {
    const start = byId.get(id);
    if (start === undefined) return [];
    const maxDepth = options.maxDepth ?? Number.POSITIVE_INFINITY;
    const output: TocNodeLike[] = [];
    const queue: Array<{ readonly node: TocNodeLike; readonly level: number }> = [
      { node: start, level: 0 },
    ];
    while (queue.length > 0) {
      const current = queue.shift() as { readonly node: TocNodeLike; readonly level: number };
      output.push(current.node);
      if (current.level >= maxDepth) continue;
      for (const child of childrenOfNode(current.node.id)) {
        queue.push({ node: child, level: current.level + 1 });
      }
    }
    return output;
  };

  const nodeIdsFor = (id: Id, includeDescendants: boolean): readonly Id[] => {
    if (!byId.has(id)) return [];
    if (!includeDescendants) return [id];
    return subtreeOf(id).map((node) => node.id);
  };

  const conceptIdsIn = (
    id: Id,
    options: { readonly includeDescendants?: boolean } = {},
  ): readonly Id[] => {
    const includeDescendants = options.includeDescendants ?? true;
    const distinct = new Set<Id>();
    for (const nodeId of nodeIdsFor(id, includeDescendants)) {
      for (const conceptId of conceptIdsByPlacement.get(nodeId) ?? []) distinct.add(conceptId);
    }
    return [...distinct].sort();
  };

  const chapterOf = (id: Id): TocNodeLike | null => {
    let cursor = byId.get(id);
    let guard = 0;
    while (cursor !== undefined && guard < pack.toc.length + 1) {
      if (cursor.type === 'chapter') return cursor;
      cursor = cursor.parentId === null ? undefined : byId.get(cursor.parentId);
      guard += 1;
    }
    return null;
  };

  const index: TocIndex = {
    packId: pack.id,
    packVersion: pack.version,
    nodes: pack.toc,
    roots,
    node: (id) => byId.get(id),
    root: () => roots[0] ?? null,
    depthOf: (id) => depthOf.get(id),
    parentOf: (id) => {
      const node = byId.get(id);
      if (node === undefined) return null;
      if (node.parentId === null) return null;
      return byId.get(node.parentId) ?? null;
    },
    childrenOf: childrenOfNode,
    pathTo: (id) => {
      const path: TocNodeLike[] = [];
      let cursor = byId.get(id);
      let guard = 0;
      while (cursor !== undefined && guard < pack.toc.length + 1) {
        path.unshift(cursor);
        cursor = cursor.parentId === null ? undefined : byId.get(cursor.parentId);
        guard += 1;
      }
      return path;
    },
    subtreeOf,
    conceptIdsIn,
    conceptCountIn: (id, options) => conceptIdsIn(id, options).length,
    placementsOf: (conceptId) =>
      [...(placementsByConcept.get(conceptId) ?? [])].sort((left, right) => {
        if (left.order !== right.order) return left.order - right.order;
        return left.id < right.id ? -1 : left.id > right.id ? 1 : 0;
      }),
    chapterOf,
    conceptsInChapter: (nodeId) => {
      const chapter = chapterOf(nodeId);
      if (chapter === null) return [];
      return conceptIdsIn(chapter.id);
    },
  };
  return okBuild(index);
}
