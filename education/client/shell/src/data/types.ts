/**
 * Client view payloads.
 *
 * These are *read models* assembled from the frozen domain DTOs (T01). They do
 * not add persistence or service semantics; T13 replaces the fixture source
 * with the real service facade without changing the shell.
 */

import type {
  Assessment,
  AuthStatus,
  Concept,
  ConceptProgress,
  CourseEdition,
  Evidence,
  Id,
  Learner,
  PackSummary,
  RuntimeCapabilities,
  SelfReport,
  ServiceResult,
  Session,
  Timestamp,
} from '@edu/domain';

export interface ShellRequest {
  readonly requestId: string;
  readonly learnerId: Id;
  readonly now: Timestamp;
}

/** First-use "already learned" claim: a student statement, never an assessment. */
export interface LearnedRangeClaim {
  readonly id: Id;
  readonly learnerId: Id;
  readonly courseEditionId: Id;
  readonly packVersion: string;
  readonly scope: 'selected' | 'all_unlearned' | 'uncertain';
  readonly conceptIds: readonly Id[];
  readonly diagnosticSkipped: boolean;
  readonly createdAt: Timestamp;
  /** Explicit marker so no consumer can mistake this for system evidence. */
  readonly statementOnly: true;
}

export interface CompatibilityNotice {
  readonly previousPackVersion: string;
  readonly currentPackVersion: string;
  readonly affectedConceptIds: readonly Id[];
  readonly reason: string;
}

export interface ShellSnapshot {
  readonly learner: Learner;
  readonly courseEdition: CourseEdition;
  readonly pack: PackSummary;
  readonly concepts: readonly Concept[];
  readonly auth: {
    readonly account: AuthStatus;
    readonly apiKey: AuthStatus;
  };
  readonly capabilities: RuntimeCapabilities;
  /** True while the shell is fed by frozen fixtures; never claims a live API. */
  readonly fixture: boolean;
  readonly notice: string | null;
}

export interface ReviewItem {
  readonly conceptId: Id;
  readonly conceptTitle: string;
  readonly dueAt: Timestamp;
  readonly reason: 'due' | 'needs_support';
}

export interface HomePayload {
  readonly now: Timestamp;
  readonly activeSession: Session | null;
  readonly lastCompletedSession: Session | null;
  readonly progress: readonly ConceptProgress[];
  readonly dueReviews: readonly ReviewItem[];
  readonly totalConcepts: number;
  readonly learnedConceptCount: number;
  readonly firstRun: boolean;
  readonly compatibility: CompatibilityNotice | null;
}

export interface RecordsPayload {
  readonly now: Timestamp;
  readonly progresses: readonly ConceptProgress[];
  readonly sessions: readonly Session[];
  readonly evidence: readonly Evidence[];
  readonly assessments: readonly Assessment[];
  readonly selfReports: readonly SelfReport[];
  readonly rangeClaim: LearnedRangeClaim | null;
  readonly saveState: 'saved' | 'failed';
}

export interface ResumePayload {
  readonly session: Session;
  readonly conceptTitle: string;
  readonly courseEditionTitle: string;
  readonly activityId: Id | null;
  readonly cursor: string | null;
  readonly positionLabel: string;
  readonly draftRestored: boolean;
  readonly packVersion: string;
}

export interface RangeSaveInput {
  readonly scope: LearnedRangeClaim['scope'];
  readonly conceptIds: readonly Id[];
  readonly diagnosticSkipped: boolean;
}

export interface RangeSaveReceipt {
  readonly range: LearnedRangeClaim;
  readonly diagnosticSuggested: boolean;
}

export type DeleteScope = 'learning_records' | 'book_link';

export interface ExportReceipt {
  readonly scope: 'learning_records';
  readonly exportedAt: Timestamp;
  readonly recordCount: number;
  readonly note: string;
}

export interface DeleteReceipt {
  readonly scope: DeleteScope;
  readonly deletedAt: Timestamp;
  readonly removedSessions: number;
  readonly removedEvidence: number;
  readonly removedSelfReports: number;
  readonly note: string;
}

/** Service envelope plus an offline hint used only for banners. */
export type DataResult<T> = ServiceResult<T> & { readonly offline?: boolean };

export function okData<T>(data: T, revision: number, offline = false): DataResult<T> {
  return offline ? { ok: true, data, revision, offline: true } : { ok: true, data, revision };
}

/**
 * Read-only service seam implemented by the fixture source now and by the real
 * host facade in T13. Every mutation still carries a requestId.
 */
export interface ShellDataSource {
  readonly kind: 'fixture' | 'live';
  readonly notice: string | null;
  loadSnapshot(request: ShellRequest): Promise<DataResult<ShellSnapshot>>;
  loadHome(request: ShellRequest): Promise<DataResult<HomePayload>>;
  loadRecords(request: ShellRequest): Promise<DataResult<RecordsPayload>>;
  resumeSession(request: ShellRequest, sessionId: Id): Promise<DataResult<ResumePayload>>;
  saveRange(request: ShellRequest, input: RangeSaveInput): Promise<DataResult<RangeSaveReceipt>>;
  exportData(request: ShellRequest, scope: 'learning_records'): Promise<DataResult<ExportReceipt>>;
  deleteData(request: ShellRequest, scope: DeleteScope): Promise<DataResult<DeleteReceipt>>;
}
