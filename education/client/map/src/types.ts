/**
 * T10 map read-model seam.
 *
 * The map UI never reads a content pack file, the journal or the learner
 * store. It consumes a *read model* assembled by the data source:
 * - the solved-in fixture source in this package, and
 * - the real facade supplied by T13 (backed by `@edu/knowledge`
 *   `KnowledgeService` + the learner projection store).
 *
 * All payload entities are the frozen `@edu/domain` DTOs, so no second protocol
 * is introduced. `GraphSlice` is deliberately bounded (node count + depth) and
 * reports whether anything was cut, so the UI can offer an explicit "展开"
 * action instead of painting the whole volume.
 */

import type {
  Concept,
  ConceptProgress,
  Evidence,
  Id,
  PackCoverageStatus,
  PackScope,
  Relation,
  SelfReport,
  SourceVerificationState,
  Timestamp,
  TocNodeLike,
  TrustMode,
} from '@edu/domain';
import type { DataResult, ShellRequest } from '../../shell/src/index.js';

export type MapRequest = ShellRequest;

/** Source availability summary. Never a filesystem path. */
export interface MapSourceSummary {
  readonly sourceRefId: Id;
  readonly pdfPage: number;
  readonly printedPage: string | null;
  readonly bookAvailable: boolean;
  readonly verification: SourceVerificationState;
  readonly label: string;
}

export interface MapPayload {
  readonly courseEditionId: Id;
  readonly courseEditionLabel: string;
  readonly packId: Id;
  readonly packVersion: string;
  readonly trustMode: TrustMode;
  readonly scope: PackScope;
  readonly coverageStatus: PackCoverageStatus;
  readonly toc: readonly TocNodeLike[];
  readonly concepts: readonly Concept[];
  readonly relations: readonly Relation[];
  readonly progress: readonly ConceptProgress[];
  readonly selfReports: readonly SelfReport[];
  readonly evidence: readonly Evidence[];
  readonly sources: readonly MapSourceSummary[];
  /** Chapter (or section) to open first; null when the toc has no chapter. */
  readonly initialTocNodeId: Id | null;
  readonly initialConceptId: Id | null;
  /** True only for the demo fixture source; the UI labels it prominently. */
  readonly fixture: boolean;
  readonly notice: string | null;
}

export interface GraphStats {
  readonly maxNodes: number;
  readonly maxDepth: number;
  readonly visitedConcepts: number;
  readonly visitedRelations: number;
  /** Measured by the data source for this single query (not a promise). */
  readonly durationMs: number;
}

export interface GraphSlice {
  readonly packVersion: string;
  readonly centerConceptId: Id | null;
  readonly scopeTocNodeId: Id | null;
  readonly concepts: readonly Concept[];
  readonly relations: readonly Relation[];
  /** Cross-chapter concepts that participate in relations but are not painted. */
  readonly externalConcepts: readonly Concept[];
  /** True when some relation endpoints were left outside the painted set. */
  readonly truncated: boolean;
  /** Same-chapter concepts that exist but were not painted because of caps. */
  readonly hiddenConceptCount: number;
  readonly stats: GraphStats;
}

export interface ChapterGraphOptions {
  /** Hard cap on painted concepts. */
  readonly maxNodes: number;
  /** Hard cap on relation hops from the chapter centre (1 = direct only). */
  readonly maxDepth: number;
  /** Explicit user expansion: how many in-chapter concepts to paint. */
  readonly visibleConceptCount?: number;
  /** Concept to centre the bounded neighborhood on (defaults to first). */
  readonly centerConceptId?: Id;
}

export interface ConceptSearchHit {
  readonly conceptId: Id;
  readonly title: string;
  readonly matchedOn: 'title' | 'alias';
  readonly matchedText: string;
  readonly tocNodeId: Id | null;
  readonly tocTitle: string | null;
  /** Ranking score used only for ordering; not a mastery signal. */
  readonly score: number;
}

export interface ConceptPlacementSummary {
  readonly tocNodeId: Id;
  readonly title: string;
  readonly type: TocNodeLike['type'];
  readonly path: readonly string[];
}

export interface ConceptDetail {
  readonly concept: Concept;
  readonly progress: ConceptProgress | null;
  readonly selfReport: SelfReport | null;
  readonly relations: readonly Relation[];
  /** Incoming prerequisite relations: "建议先学" sources, never a hard lock. */
  readonly prerequisites: readonly Relation[];
  readonly evidence: readonly Evidence[];
  readonly sources: readonly MapSourceSummary[];
  readonly placements: readonly ConceptPlacementSummary[];
}

/**
 * Read seam implemented by the fixture source now and by the real host facade
 * in T13. Every call carries a request id; nothing here mutates learning state.
 */
export interface MapDataSource {
  readonly kind: 'fixture' | 'live';
  readonly notice: string | null;
  loadMap(request: MapRequest): Promise<DataResult<MapPayload>>;
  loadChapterGraph(
    request: MapRequest,
    tocNodeId: Id,
    options: ChapterGraphOptions,
  ): Promise<DataResult<GraphSlice>>;
  expandConcept(
    request: MapRequest,
    conceptId: Id,
    options: { readonly maxNodes: number; readonly maxDepth: number },
  ): Promise<DataResult<GraphSlice>>;
  searchConcepts(
    request: MapRequest,
    query: string,
    limit: number,
  ): Promise<DataResult<readonly ConceptSearchHit[]>>;
  loadConceptDetail(request: MapRequest, conceptId: Id): Promise<DataResult<ConceptDetail>>;
}

export type MapDataResult<T> = DataResult<T>;

/** Default caps: a chapter sized local graph, never the whole volume. */
export const MAP_NODE_CAP = 24;
export const MAP_DEPTH_CAP = 2;
export const MAP_EXPAND_NODE_CAP = 25;
export const MAP_EXPAND_DEPTH_CAP = 2;
export const MAP_PAGE_SIZE = 12;
export const MAP_SEARCH_LIMIT = 12;

export function isMapUnavailableError(error: { readonly code: string }): boolean {
  return error.code === 'NOT_FOUND' || error.code === 'STORAGE_FAILED';
}

export type MapTimestamp = Timestamp;
