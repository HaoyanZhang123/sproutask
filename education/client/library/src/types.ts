/**
 * T09 view/service seam.
 *
 * The UI does not import importer or knowledge internals. T13 adapts the frozen
 * T03 `ImportPort`/`ImportJob` and T04 `resolveSource` shapes to this interface;
 * the fixture source is explicitly marked and used only for component tests.
 */

import type {
  Figure,
  ImportJob,
  ManagedFileHandle,
  PackCoverageStatus,
  PackScope,
  RequestContext,
  ReviewState,
  ServiceResult,
  SourceBlock,
  SourceRef,
  SourceVerificationState,
  Timestamp,
  TrustMode,
} from '@edu/domain';

export type LibraryMaterialState = 'baseline' | 'candidate' | 'unavailable';

export type EditionVerification = 'verified' | 'machine_matched' | 'unverified' | 'rejected';

export interface LibraryBook {
  readonly id: string;
  readonly title: string;
  readonly publisher: string;
  readonly editionLabel: string;
  readonly grade: number;
  readonly term: number;
  readonly subject: string;
  readonly pageCount: number;
  readonly sha256: string;
  readonly materialState: LibraryMaterialState;
  readonly reviewState: ReviewState;
  readonly trustMode: TrustMode;
  readonly scope: PackScope;
  readonly coverageStatus: PackCoverageStatus;
  readonly editionVerification: EditionVerification;
  readonly fileState: 'present' | 'missing' | 'corrupt';
  readonly isCurrent: boolean;
  readonly unavailableReason: string | null;
}

export interface SuggestedMetadata {
  readonly title: string | null;
  readonly publisher: string | null;
  readonly editionLabel: string | null;
  readonly pageCount: number | null;
}

export interface SelectedFile {
  readonly handle: ManagedFileHandle;
  readonly fileName: string;
  readonly sizeBytes: number;
  readonly detectedPageCount: number;
  readonly suggestedMetadata: SuggestedMetadata;
}

export interface ImportMatch {
  readonly kind: 'same_hash' | 'same_edition_rescan' | 'different_edition' | 'unknown';
  readonly label: string;
  readonly baselineBookId: string | null;
}

export interface ImportStartOutcome {
  readonly job: ImportJob;
  /** True when the same hash already exists; the job is reused, not duplicated. */
  readonly reused: boolean;
  readonly match: ImportMatch;
  readonly scope: PackScope;
  readonly coverageStatus: PackCoverageStatus;
}

export interface SourceListItem {
  readonly sourceRefId: string;
  readonly pdfPage: number;
  readonly printedPage: string | null;
  readonly label: string;
  readonly kind: 'block' | 'figure' | 'page';
  readonly reviewState: ReviewState;
  readonly verification: SourceVerificationState;
  readonly candidate: boolean;
}

export interface SourcePageImage {
  /** Host-managed handle only; never an OS path. */
  readonly assetId: string;
  readonly bbox: { readonly x: number; readonly y: number; readonly width: number; readonly height: number };
  readonly altText: string;
  /** Fixture placeholder has no real page bitmap; real host supplies it. */
  readonly fixtureOnly: boolean;
}

export interface SourceView {
  readonly bookTitle: string;
  readonly editionLabel: string;
  readonly pageCount: number;
  readonly bookSha256: string;
  readonly sourceRef: SourceRef;
  readonly block: SourceBlock | null;
  readonly figure: Figure | null;
  readonly pageImage: SourcePageImage | null;
  readonly candidate: boolean;
}

export type LibraryResult<T> = ServiceResult<T> & { readonly offline?: boolean };

export interface LibraryDataSource {
  readonly kind: 'fixture' | 'live';
  readonly notice: string | null;
  listBooks(context: RequestContext): Promise<LibraryResult<readonly LibraryBook[]>>;
  listSources(context: RequestContext, bookId: string): Promise<LibraryResult<readonly SourceListItem[]>>;
  openSource(context: RequestContext, sourceRefId: string): Promise<LibraryResult<SourceView>>;
  chooseFile(context: RequestContext): Promise<LibraryResult<SelectedFile | null>>;
  startImport(
    context: RequestContext,
    request: {
      readonly file: ManagedFileHandle;
      readonly confirmedMetadata: {
        readonly title: string | null;
        readonly publisher: string | null;
        readonly editionLabel: string | null;
        readonly pageCount: number | null;
      } | null;
    },
  ): Promise<LibraryResult<ImportStartOutcome>>;
  jobStatus(context: RequestContext, jobId: string): Promise<LibraryResult<ImportJob>>;
  cancelImport(context: RequestContext, jobId: string): Promise<LibraryResult<ImportJob>>;
  resumeImport(context: RequestContext, jobId: string): Promise<LibraryResult<ImportJob>>;
  retryImport(context: RequestContext, jobId: string): Promise<LibraryResult<ImportJob>>;
  /** Optional realtime bridge for `import.progress`; fixture tests can emit pushes. */
  watchImport?(jobId: string, listener: (job: ImportJob) => void): () => void;
}

export interface LibraryRequestFactory {
  (): RequestContext;
}

export interface MetadataDraft {
  readonly title: string;
  readonly publisher: string;
  readonly editionLabel: string;
  readonly pageCount: string;
}

export interface LibraryNotice {
  readonly text: string;
  readonly at: Timestamp;
}
