/**
 * Knowledge service facade (05 §6 `graph.getToc` / `graph.getNeighborhood` /
 * `graph.getConcept` / `source.resolve` / `knowledge.*`).
 *
 * The class implements the frozen `ContentQuery` and `KnowledgePort` interfaces
 * so later consumers (map UI, tool layer, runtime composition) can depend on
 * the port types instead of importing this file's internals. Richer T04
 * specific reads (search, chapter view, page images, state projection) are
 * additive methods on the same object.
 */

import type {
  CompatibilityMap,
  ContentPack,
  ContentQuery,
  ConceptView,
  CoverageReport,
  Id,
  KnowledgePort,
  Neighborhood as DomainNeighborhood,
  PackKey,
  PackSummary,
  RequestContext,
  ServiceResult,
  SourceSummary,
  TocView,
} from '@edu/domain';
import {
  failValue,
  knowledgeError,
  okValue,
  toServiceResult,
  type BuildResult,
  type KnowledgeResult,
} from './knowledge-errors.js';
import { loadPack, type PackSnapshot } from './pack-loader.js';
import {
  DEFAULT_NEIGHBORHOOD_NODES,
  type BoundedNeighborhood,
  type ConceptSearchHit,
  type SearchOptions,
} from './graph-index.js';
import { auditCompatibilityMap, type CompatibilityAudit } from './compatibility.js';
import type {
  PageImageHandle,
  PageImageRequest,
  ResolvedSourceRef,
  SourceCatalog,
} from './source-catalog.js';
import {
  projectGraphStates,
  type CandidateConceptState,
  type ConceptTrustMode,
  type ProgressLookup,
  type PublishedConceptState,
} from './progress-projection.js';
import type { CompatibilityMap as CompatibilityMapType } from '@edu/domain';

interface PackEntry {
  readonly snapshot: PackSnapshot;
  readonly revision: number;
}

export interface KnowledgeServiceOptions {
  readonly sources: SourceCatalog;
  /** Untrusted compatibility maps; audited on lookup. */
  readonly compatibilityMaps?: readonly CompatibilityMapType[];
}

function keyString(key: PackKey): string {
  return `${key.courseEditionId}|${key.packVersion}`;
}

export class KnowledgeService implements ContentQuery, KnowledgePort {
  private readonly entries = new Map<string, PackEntry>();
  private readonly sources: SourceCatalog;
  private readonly compatibilityMaps: CompatibilityMapType[];

  constructor(options: KnowledgeServiceOptions) {
    this.sources = options.sources;
    this.compatibilityMaps = [...(options.compatibilityMaps ?? [])];
  }

  /* ------------------------------------------------------------- registry */

  registerPack(input: unknown): BuildResult<PackSnapshot> {
    const loaded = loadPack(input);
    if (!loaded.ok) return loaded;
    const snapshot = loaded.value;
    const key = keyString({
      courseEditionId: snapshot.pack.courseEditionId,
      packVersion: snapshot.pack.version,
    });
    const previous = this.entries.get(key);
    this.entries.set(key, {
      snapshot,
      revision: (previous?.revision ?? 0) + 1,
    });
    return loaded;
  }

  registerCompatibilityMap(map: CompatibilityMapType): void {
    this.compatibilityMaps.push(map);
  }

  listPacks(): readonly PackSummary[] {
    return [...this.entries.values()].map((entry) => this.toSummary(entry.snapshot.pack));
  }

  get sourceCatalog(): SourceCatalog {
    return this.sources;
  }

  /* ------------------------------------------------------------- internals */

  private toSummary(pack: ContentPack): PackSummary {
    return {
      id: pack.id,
      version: pack.version,
      scope: pack.scope,
      coverageStatus: pack.coverageStatus,
      status: pack.status,
      trustMode: pack.status === 'candidate' ? 'candidate' : 'published',
      contentHash: pack.contentHash,
      courseEditionId: pack.courseEditionId,
    };
  }

  private lookup(key: PackKey): KnowledgeResult<PackEntry> {
    const entry = this.entries.get(keyString(key));
    if (entry === undefined) {
      return failValue(
        knowledgeError(
          'PACK_NOT_FOUND',
          `content pack ${key.courseEditionId}@${key.packVersion} is not registered`,
          { path: '$.packVersion' },
        ),
      );
    }
    const status = entry.snapshot.pack.status;
    if (status !== 'published' && status !== 'candidate') {
      return failValue(
        knowledgeError(
          'PACK_NOT_USABLE',
          `content pack ${key.courseEditionId}@${key.packVersion} is ${status}; rejected/draft content cannot enter teaching`,
          { path: '$.packVersion' },
        ),
      );
    }
    return okValue(entry);
  }

  private revisionOf(key: PackKey): number {
    return this.entries.get(keyString(key))?.revision ?? 0;
  }

  /* ------------------------------------------------------- ContentQuery */

  async getPackSummary(ctx: RequestContext, key: PackKey): Promise<ServiceResult<PackSummary>> {
    void ctx;
    const entry = this.lookup(key);
    if (!entry.ok) return toServiceResult(entry, this.revisionOf(key));
    return { ok: true, data: this.toSummary(entry.value.snapshot.pack), revision: entry.value.revision };
  }

  async getToc(
    ctx: RequestContext,
    key: PackKey & { readonly rootTocNodeId?: Id; readonly maxDepth?: number },
  ): Promise<ServiceResult<TocView>> {
    void ctx;
    const entry = this.lookup(key);
    if (!entry.ok) return toServiceResult(entry, this.revisionOf(key));
    const snapshot = entry.value.snapshot;
    let nodes = snapshot.toc.nodes;
    if (key.rootTocNodeId !== undefined) {
      if (snapshot.toc.node(key.rootTocNodeId) === undefined) {
        return toServiceResult(
          failValue(
            knowledgeError('TOC_NODE_NOT_FOUND', `toc node ${key.rootTocNodeId} does not exist`, {
              path: '$.rootTocNodeId',
            }),
          ),
          entry.value.revision,
        );
      }
      if (key.maxDepth !== undefined && (!Number.isInteger(key.maxDepth) || key.maxDepth < 0)) {
        return toServiceResult(
          failValue(
            knowledgeError('INVALID_QUERY', 'maxDepth must be a non negative integer', {
              path: '$.maxDepth',
            }),
          ),
          entry.value.revision,
        );
      }
      const rootNodeId = key.rootTocNodeId;
      const maxDepth = key.maxDepth;
      nodes = snapshot.toc.subtreeOf(
        rootNodeId,
        maxDepth === undefined ? {} : { maxDepth },
      );
    }
    return {
      ok: true,
      data: {
        packId: snapshot.pack.id,
        packVersion: snapshot.pack.version,
        nodes,
      },
      revision: entry.value.revision,
    };
  }

  async getConcept(
    ctx: RequestContext,
    key: PackKey & { readonly conceptId: Id },
  ): Promise<ServiceResult<ConceptView>> {
    void ctx;
    const entry = this.lookup(key);
    if (!entry.ok) return toServiceResult(entry, this.revisionOf(key));
    const snapshot = entry.value.snapshot;
    const concept = snapshot.graph.concept(key.conceptId);
    if (concept === undefined) {
      return toServiceResult(
        failValue(
          knowledgeError('CONCEPT_NOT_FOUND', `concept ${key.conceptId} is not in this pack`, {
            path: '$.conceptId',
          }),
        ),
        entry.value.revision,
      );
    }
    return {
      ok: true,
      data: {
        packId: snapshot.pack.id,
        packVersion: snapshot.pack.version,
        concept,
        relations: snapshot.graph.relationsOf(concept.id),
      },
      revision: entry.value.revision,
    };
  }

  async getNeighborhood(
    ctx: RequestContext,
    key: PackKey & { readonly conceptId: Id; readonly maxDepth?: number; readonly maxNodes?: number },
  ): Promise<ServiceResult<DomainNeighborhood>> {
    void ctx;
    const entry = this.lookup(key);
    if (!entry.ok) return toServiceResult(entry, this.revisionOf(key));
    const snapshot = entry.value.snapshot;
    const neighborhood = snapshot.graph.neighborhood(key.conceptId, {
      maxDepth: key.maxDepth,
      maxNodes: key.maxNodes,
    });
    if (!neighborhood.ok) return toServiceResult(neighborhood, entry.value.revision);
    const value = neighborhood.value;
    return {
      ok: true,
      data: {
        packId: value.packId,
        packVersion: value.packVersion,
        centerConceptId: value.centerConceptId,
        concepts: value.concepts,
        relations: value.relations,
        truncated: value.truncated,
      },
      revision: entry.value.revision,
    };
  }

  async resolveSource(ctx: RequestContext, sourceRefId: Id): Promise<ServiceResult<SourceSummary>> {
    void ctx;
    const resolved = this.sources.resolve(sourceRefId);
    if (!resolved.ok) return toServiceResult(resolved, 0);
    const value = resolved.value;
    return {
      ok: true,
      data: {
        sourceRef: value.sourceRef,
        bookInstance: value.bookInstance,
        pdfPage: value.pdfPage,
        printedPage: value.printedPage,
        bbox: value.bbox,
      },
      revision: 0,
    };
  }

  /* ------------------------------------------------------ KnowledgePort */

  async getPack(ctx: RequestContext, key: PackKey): Promise<ServiceResult<ContentPack>> {
    void ctx;
    const entry = this.lookup(key);
    if (!entry.ok) return toServiceResult(entry, this.revisionOf(key));
    return { ok: true, data: entry.value.snapshot.pack, revision: entry.value.revision };
  }

  async getCompatibilityMap(
    ctx: RequestContext,
    key: PackKey & { readonly fromPackVersion: string },
  ): Promise<ServiceResult<CompatibilityMap>> {
    void ctx;
    const entry = this.lookup(key);
    if (!entry.ok) return toServiceResult(entry, this.revisionOf(key));
    const snapshot = entry.value.snapshot;
    const from = this.entries.get(
      keyString({ courseEditionId: key.courseEditionId, packVersion: key.fromPackVersion }),
    );
    const map = this.compatibilityMaps.find(
      (candidate) =>
        candidate.courseEditionId === key.courseEditionId &&
        candidate.fromPackVersion === key.fromPackVersion &&
        candidate.toPackVersion === key.packVersion,
    );
    if (map === undefined || from === undefined) {
      return toServiceResult(
        failValue(
          knowledgeError(
            'COMPATIBILITY_MAP_NOT_FOUND',
            `no compatibility map from ${key.fromPackVersion} to ${key.packVersion}`,
            { path: '$.fromPackVersion' },
          ),
        ),
        entry.value.revision,
      );
    }
    const audit = auditCompatibilityMap(map, from.snapshot.pack, snapshot.pack);
    if (!audit.ok) {
      return toServiceResult(failValue(knowledgeError('COMPATIBILITY_MISMATCH', audit.issues[0]?.message ?? 'compatibility map failed audit', { issues: audit.issues })), entry.value.revision);
    }
    return { ok: true, data: map, revision: entry.value.revision };
  }

  async checkCoverage(ctx: RequestContext, key: PackKey): Promise<ServiceResult<CoverageReport>> {
    void ctx;
    const entry = this.lookup(key);
    if (!entry.ok) return toServiceResult(entry, this.revisionOf(key));
    const snapshot = entry.value.snapshot;
    const coverage = snapshot.coverage;
    return {
      ok: true,
      data: {
        courseEditionId: snapshot.pack.courseEditionId,
        packVersion: snapshot.pack.version,
        scope: snapshot.pack.scope,
        coverageStatus: snapshot.pack.coverageStatus,
        targetSections: coverage.targetSections,
        coveredSections: coverage.coveredSections,
        conceptCount: snapshot.pack.concepts.length,
        manifest: snapshot.pack.coverageManifest,
        unresolved: coverage.issues.map((issue) => `${issue.code}: ${issue.message}`),
      },
      revision: entry.value.revision,
    };
  }

  /* ------------------------------------------------------- T04 additions */

  searchConcepts(query: string, options: SearchOptions = {}): readonly ConceptSearchHit[] {
    const hits: ConceptSearchHit[] = [];
    for (const entry of this.entries.values()) {
      hits.push(...entry.snapshot.graph.search(query, options));
    }
    return hits.slice(0, options.limit ?? 20);
  }

  chapterView(
    key: PackKey & { readonly chapterTocNodeId: Id; readonly maxNodes?: number },
  ): KnowledgeResult<BoundedNeighborhood> {
    const entry = this.lookup(key);
    if (!entry.ok) return entry;
    const snapshot = entry.value.snapshot;
    const node = snapshot.toc.node(key.chapterTocNodeId);
    if (node === undefined) {
      return failValue(
        knowledgeError('TOC_NODE_NOT_FOUND', `toc node ${key.chapterTocNodeId} does not exist`, {
          path: '$.chapterTocNodeId',
        }),
      );
    }
    if (node.type !== 'chapter') {
      return failValue(
        knowledgeError('INVALID_QUERY', 'chapterView requires a chapter toc node', {
          path: '$.chapterTocNodeId',
        }),
      );
    }
    return snapshot.graph.viewOf(snapshot.toc.conceptIdsIn(node.id), {
      maxNodes: key.maxNodes ?? DEFAULT_NEIGHBORHOOD_NODES,
    });
  }

  resolveSourceRef(sourceRefId: Id): KnowledgeResult<ResolvedSourceRef> {
    return this.sources.resolve(sourceRefId);
  }

  resolvePageImage(
    sourceRefId: Id,
    request: PageImageRequest = {},
  ): KnowledgeResult<PageImageHandle> {
    return this.sources.pageImage(sourceRefId, request);
  }

  auditCompatibility(
    fromKey: PackKey,
    toKey: PackKey,
    map: unknown,
  ): BuildResult<CompatibilityAudit> {
    const from = this.entries.get(keyString(fromKey));
    const to = this.entries.get(keyString(toKey));
    if (from === undefined || to === undefined) {
      return {
        ok: false,
        issues: [
          {
            code: 'INVALID_REFERENCE',
            path: '$.packVersion',
            message: 'both pack versions must be registered before auditing a compatibility map',
          },
        ],
      };
    }
    return auditCompatibilityMap(map, from.snapshot.pack, to.snapshot.pack);
  }

  projectStates(
    key: PackKey,
    conceptIds: readonly Id[],
    lookup: ProgressLookup,
    mode: 'published',
  ): KnowledgeResult<readonly PublishedConceptState[]>;
  projectStates(
    key: PackKey,
    conceptIds: readonly Id[],
    lookup: ProgressLookup,
    mode: 'candidate',
  ): KnowledgeResult<readonly CandidateConceptState[]>;
  projectStates(
    key: PackKey,
    conceptIds: readonly Id[],
    lookup: ProgressLookup,
    mode: ConceptTrustMode,
  ): KnowledgeResult<readonly (PublishedConceptState | CandidateConceptState)[]>;
  projectStates(
    key: PackKey,
    conceptIds: readonly Id[],
    lookup: ProgressLookup,
    mode: ConceptTrustMode,
  ): KnowledgeResult<readonly (PublishedConceptState | CandidateConceptState)[]> {
    const entry = this.lookup(key);
    if (!entry.ok) return entry;
    for (const conceptId of conceptIds) {
      if (entry.value.snapshot.graph.concept(conceptId) === undefined) {
        return failValue(
          knowledgeError('CONCEPT_NOT_FOUND', `concept ${conceptId} is not in this pack`, {
            path: '$.conceptIds',
          }),
        );
      }
    }
    return okValue(projectGraphStates(conceptIds, lookup, mode));
  }
}
