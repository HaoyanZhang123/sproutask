/**
 * Service port contracts (05 §6, 04 T01).
 *
 * Implementations belong to T02–T12; T01 freezes the payloads, cancellation
 * and error envelope so no consumer invents its own protocol. Domain code
 * depends only on these interfaces, never on DSH/Electron/UI runtimes.
 */

import type {
  Activity,
  ContentPack,
  CoverageManifest,
  Relation,
  Rubric,
} from '../entities/content.js';
import type { Concept, TocNodeLike } from '../entities/content.js';
import type {
  ActivityAttempt,
  Assessment,
  ConceptProgress,
  Evidence,
  SelfReport,
  Session,
} from '../entities/learning.js';
import type {
  CompatibilityMap,
  GradeResult,
  ImportJob,
  JournalCommand,
} from '../entities/system.js';
import type { BookInstance, SourceRef } from '../entities/sources.js';
import type { Id, NormalizedBBox, PackCoverageStatus, PackScope, PackStatus, Timestamp, TrustMode } from '../primitives.js';
import type { ServiceResult } from './results.js';

/* ---------------------------------------------------------------- runtime */

export interface Clock {
  /** RFC3339 UTC. The only place a wall clock may enter the system. */
  now(): Timestamp;
}

export interface IdGenerator {
  /** Opaque IDs are generated, never derived from titles or timestamps. */
  next(prefix: string): Id;
}

export interface CancellationToken {
  readonly cancelled: boolean;
  onCancel(listener: () => void): () => void;
}

export const NEVER_CANCELLED: CancellationToken = {
  cancelled: false,
  onCancel: () => () => {
    /* no cancellation source */
  },
};

export interface RequestContext {
  /** Mutation idempotency key; hosts bind learner identity server side. */
  readonly requestId: string;
  readonly learnerId: Id;
  readonly now: Timestamp;
  readonly signal?: CancellationToken;
  readonly timeoutMs?: number;
}

export interface PackKey {
  readonly courseEditionId: Id;
  readonly packVersion: string;
}

/* -------------------------------------------------------------- event log */

export type JournalCommandInput = Omit<JournalCommand, 'schemaVersion' | 'seq'>;

export interface AppendReceipt {
  readonly eventId: Id;
  readonly requestId: string;
  readonly seq: number;
  readonly revision: number;
  /** True when the request id was already persisted and nothing was appended. */
  readonly duplicate: boolean;
}

export interface JournalSlice {
  readonly commits: readonly JournalCommand[];
  readonly fromSeq: number;
  readonly lastSeq: number;
  readonly hasMore: boolean;
  /** A half-written tail line was isolated and must not be appended after. */
  readonly tailPartial: boolean;
}

export interface EventStore {
  append(ctx: RequestContext, command: JournalCommandInput): Promise<ServiceResult<AppendReceipt>>;
  readFrom(ctx: RequestContext, fromSeq: number, limit: number): Promise<ServiceResult<JournalSlice>>;
  latestSeq(ctx: RequestContext): Promise<ServiceResult<{ readonly lastSeq: number }>>;
}

/* ------------------------------------------------------------ content read */

export interface PackSummary {
  readonly id: Id;
  readonly version: string;
  readonly scope: PackScope;
  readonly coverageStatus: PackCoverageStatus;
  readonly status: PackStatus;
  readonly trustMode: TrustMode;
  readonly contentHash: string;
  readonly courseEditionId: Id;
}

export interface TocView {
  readonly packId: Id;
  readonly packVersion: string;
  readonly nodes: readonly TocNodeLike[];
}

export interface ConceptView {
  readonly packId: Id;
  readonly packVersion: string;
  readonly concept: Concept;
  readonly relations: readonly Relation[];
}

export interface Neighborhood {
  readonly packId: Id;
  readonly packVersion: string;
  readonly centerConceptId: Id;
  readonly concepts: readonly Concept[];
  readonly relations: readonly Relation[];
  readonly truncated: boolean;
}

export interface SourceSummary {
  readonly sourceRef: SourceRef;
  readonly bookInstance: BookInstance | null;
  readonly pdfPage: number;
  readonly printedPage: string | null;
  readonly bbox: NormalizedBBox | null;
}

export interface ContentQuery {
  getPackSummary(ctx: RequestContext, key: PackKey): Promise<ServiceResult<PackSummary>>;
  getToc(
    ctx: RequestContext,
    key: PackKey & { readonly rootTocNodeId?: Id; readonly maxDepth?: number },
  ): Promise<ServiceResult<TocView>>;
  getConcept(
    ctx: RequestContext,
    key: PackKey & { readonly conceptId: Id },
  ): Promise<ServiceResult<ConceptView>>;
  getNeighborhood(
    ctx: RequestContext,
    key: PackKey & { readonly conceptId: Id; readonly maxDepth?: number; readonly maxNodes?: number },
  ): Promise<ServiceResult<Neighborhood>>;
  resolveSource(ctx: RequestContext, sourceRefId: Id): Promise<ServiceResult<SourceSummary>>;
}

/* ---------------------------------------------------------------- knowledge */

export interface CoverageReport {
  readonly courseEditionId: Id;
  readonly packVersion: string;
  readonly scope: PackScope;
  readonly coverageStatus: PackCoverageStatus;
  readonly targetSections: number;
  readonly coveredSections: number;
  readonly conceptCount: number;
  readonly manifest: CoverageManifest;
  readonly unresolved: readonly string[];
}

export interface KnowledgePort {
  getPack(ctx: RequestContext, key: PackKey): Promise<ServiceResult<ContentPack>>;
  getCompatibilityMap(
    ctx: RequestContext,
    key: PackKey & { readonly fromPackVersion: string },
  ): Promise<ServiceResult<CompatibilityMap>>;
  checkCoverage(ctx: RequestContext, key: PackKey): Promise<ServiceResult<CoverageReport>>;
}

/* ------------------------------------------------------------------- tutor */

export interface ModelDescriptor {
  readonly provider: string;
  readonly model: string;
  readonly text: boolean;
  readonly image: boolean;
  /** Mock models are always labelled so tests cannot be mistaken for DSH. */
  readonly isMock: boolean;
}

export interface TutorCapabilities {
  readonly model: ModelDescriptor | null;
  readonly text: boolean;
  readonly image: boolean;
  readonly authStatus: 'available' | 'unavailable' | 'unknown';
}

export interface TutorSessionStartRequest {
  readonly session: Session;
}

export interface TutorSessionBinding {
  readonly educationSessionId: Id;
  /** Null until a real DSH runtime is bound (T00.runtimeReady). */
  readonly dshSessionId: Id | null;
  readonly model: ModelDescriptor;
  readonly revision: number;
}

export interface TutorTurnRequest {
  readonly sessionId: Id;
  readonly revision: number;
  readonly message: string | null;
  readonly activityId: Id | null;
  readonly stream: boolean;
  /**
   * Teaching policy text (Skill instruction) that the host must deliver to the
   * model as a system instruction. Optional for backward compatibility; a host
   * that ignores it cannot claim Skill-guided teaching (T15 finding F2).
   */
  readonly systemInstruction?: string | null;
}

export interface TutorTurnResult {
  readonly sessionId: Id;
  readonly revision: number;
  readonly text: string;
  readonly streaming: boolean;
  readonly model: ModelDescriptor;
  readonly toolNames: readonly string[];
}

export interface TutorGateway {
  readonly kind: 'dsh' | 'mock';
  capabilities(ctx: RequestContext): Promise<ServiceResult<TutorCapabilities>>;
  startSession(
    ctx: RequestContext,
    request: TutorSessionStartRequest,
  ): Promise<ServiceResult<TutorSessionBinding>>;
  resumeSession(
    ctx: RequestContext,
    request: { readonly sessionId: Id; readonly revision: number },
  ): Promise<ServiceResult<TutorSessionBinding>>;
  sendTurn(ctx: RequestContext, request: TutorTurnRequest): Promise<ServiceResult<TutorTurnResult>>;
  endSession(
    ctx: RequestContext,
    request: { readonly sessionId: Id; readonly reason: 'completed' | 'abandoned' },
  ): Promise<ServiceResult<{ readonly endedAt: Timestamp }>>;
}

/* ------------------------------------------------------------------ grade */

export interface GradeRequest {
  readonly attempt: ActivityAttempt;
  readonly activity: Activity;
  readonly rubric: Rubric;
  readonly mode: 'rule' | 'model';
  readonly modelRunId: string | null;
}

export interface GradePort {
  grade(ctx: RequestContext, request: GradeRequest): Promise<ServiceResult<GradeResult>>;
}

/* ----------------------------------------------------------------- import */

export interface ManagedFileHandle {
  readonly assetId: Id;
  readonly sha256: string;
  readonly originalName: string | null;
}

export interface ImportStartRequest {
  readonly file: ManagedFileHandle;
  readonly confirmedMetadata: {
    readonly title: string | null;
    readonly publisher: string | null;
    readonly editionLabel: string | null;
    readonly pageCount: number | null;
  } | null;
}

export interface ImportPort {
  start(ctx: RequestContext, request: ImportStartRequest): Promise<ServiceResult<ImportJob>>;
  status(ctx: RequestContext, jobId: Id): Promise<ServiceResult<ImportJob>>;
  cancel(ctx: RequestContext, jobId: Id): Promise<ServiceResult<ImportJob>>;
  resume(ctx: RequestContext, jobId: Id): Promise<ServiceResult<ImportJob>>;
}

/* --------------------------------------------------------------- learner */

export interface ProgressKey {
  readonly learnerId: Id;
  readonly courseEditionId: Id;
  readonly packVersion: string;
  readonly conceptId: Id;
}

export interface ProgressWriteReceipt {
  readonly progress: ConceptProgress;
  readonly revision: number;
}

export interface LearnerProjectionStore {
  get(ctx: RequestContext, key: ProgressKey): Promise<ServiceResult<ConceptProgress>>;
  list(
    ctx: RequestContext,
    key: {
      readonly learnerId: Id;
      readonly courseEditionId: Id;
      readonly packVersion: string;
      readonly conceptIds?: readonly Id[];
    },
  ): Promise<ServiceResult<readonly ConceptProgress[]>>;
  applyAssessment(
    ctx: RequestContext,
    request: { readonly assessment: Assessment; readonly evidence: readonly Evidence[] },
  ): Promise<ServiceResult<ProgressWriteReceipt>>;
  applySelfReport(
    ctx: RequestContext,
    request: { readonly selfReport: SelfReport },
  ): Promise<ServiceResult<{ readonly progress: ConceptProgress; readonly diagnosticSuggested: boolean }>>;
  dueReview(
    ctx: RequestContext,
    request: { readonly learnerId: Id; readonly now: Timestamp; readonly limit: number },
  ): Promise<ServiceResult<readonly ConceptProgress[]>>;
}

/* ------------------------------------------------------------------- host */

export interface DshRuntimeInfo {
  readonly bound: boolean;
  readonly version: string | null;
  /** Build/source reference; never a local installation path. */
  readonly sourceRef: string | null;
}

export interface RuntimeCapabilities {
  readonly dsh: DshRuntimeInfo;
  readonly model: { readonly text: boolean; readonly image: boolean };
  readonly tools: readonly string[];
  readonly network: 'loopback_only' | 'unavailable';
}

export interface AuthStatus {
  /** Account label only; tokens/cookies are never part of this payload. */
  readonly method: 'account' | 'api_key' | 'none';
  readonly status: 'available' | 'unavailable' | 'unknown';
  readonly lastCheckedAt: Timestamp | null;
  readonly accountRef: string | null;
}

export interface HostPort {
  capabilities(ctx: RequestContext): Promise<ServiceResult<RuntimeCapabilities>>;
  authStatus(ctx: RequestContext): Promise<ServiceResult<AuthStatus>>;
}
