/**
 * Importer-internal types shared by the pipeline, the caches and the engines.
 *
 * Public contract types (SourceRef/SourceBlock/Figure/ImportJob) come from
 * `@edu/domain`; everything here is local implementation detail that never
 * leaks into a public payload as an OS path.
 */

import type {
  BookInstance,
  Clock,
  ExtractionMethod,
  Figure,
  FigureType,
  Id,
  IdGenerator,
  ImportJob,
  ImportStage,
  ImportStartRequest,
  NormalizedBBox,
  RequestContext,
  ReviewState,
  ServiceResult,
  SourceBlock,
  SourceBlockType,
  SourceRef,
} from '@edu/domain';

import type { ImporterErrorInfo } from '../errors.js';

/** Bumping this invalidates every cached page (05 搂4 parserVersion cache key). */
export const PARSER_VERSION = 'pdf-importer-v1';
/** Version of the machine OCR clean-up pass; revisions are recorded, not silent. */
export const OCR_NORMALIZER_VERSION = 'ocr-normalize-v1';

export interface ImportPaths {
  /** Host-chosen local root; jobs/cache/assets live below it. */
  readonly rootDir: string;
}

export interface OcrOptions {
  /** Raster width delivered to the OCR engine (RenderOptions.DestinationWidth). */
  readonly targetWidth: number;
  /** Keep the rendered page image as a managed asset (A05 original page image). */
  readonly savePageImages: boolean;
  /** OCR engine language tag; defaults to zh-Hans-CN. */
  readonly language: string;
  /** Pages per backend invocation; smaller batches checkpoint more often. */
  readonly batchSize: number;
}

export const DEFAULT_OCR_OPTIONS: OcrOptions = {
  targetWidth: 2400,
  savePageImages: true,
  language: 'zh-Hans-CN',
  batchSize: 10,
};

export interface PdfProbe {
  readonly pageCount: number;
  readonly encrypted: boolean;
  readonly recoveredXref: boolean;
  readonly headerVersion: string;
  readonly title: string | null;
  readonly producer: string | null;
  readonly creator: string | null;
  readonly sizeBytes: number;
}

export interface OcrLine {
  /** Raw engine text, no clean-up applied. */
  readonly text: string;
  /** Pixels inside the rendered page image. */
  readonly box: { readonly x: number; readonly y: number; readonly width: number; readonly height: number };
}

export interface OcrPage {
  readonly page: number;
  readonly lines: readonly OcrLine[];
  readonly imageWidth: number;
  readonly imageHeight: number;
  readonly engine: string;
  readonly language: string;
  readonly renderMs: number;
  readonly ocrMs: number;
  /** Temporary render path; the pipeline moves it into the asset store. */
  readonly pageImagePath: string | null;
}

export type OcrPageOutcome =
  | { readonly ok: true; readonly page: OcrPage }
  | { readonly ok: false; readonly page: number; readonly error: ImporterErrorInfo };

export interface OcrAvailability {
  readonly available: boolean;
  readonly engine: string | null;
  readonly language: string | null;
  /** Machine-readable reason when unavailable (missing language pack, no engine...). */
  readonly reason: 'ENGINE_MISSING' | 'LANGUAGE_MISSING' | 'NOT_WINDOWS' | null;
}

export interface TextLayerPageLike {
  readonly available: boolean;
  readonly reason: string | null;
  readonly lines: readonly {
    readonly text: string;
    readonly bbox: NormalizedBBox;
    readonly fontSize: number;
  }[];
  readonly glyphCount: number;
  readonly undecodableGlyphs: number;
}

/**
 * A page pipeline backend: text layer extraction plus (optional) OCR.
 * Implementations must never read arbitrary paths themselves; the pipeline
 * hands them a verified absolute path from the managed asset store.
 */
export interface ImportBackend {
  readonly id: string;
  probePdf(absolutePath: string): Promise<PdfProbe>;
  readTextLayer(absolutePath: string, page: number): Promise<TextLayerPageLike>;
  ocrAvailability(): Promise<OcrAvailability>;
  /**
   * OCRs a batch of 1-based pages and calls `onPage` for each finished page so
   * the caller can checkpoint immediately. Must stop as soon as `shouldStop()`
   * returns true and report the pages it did not process.
   */
  ocrPages(
    request: {
      readonly absolutePath: string;
      readonly pages: readonly number[];
      readonly options: OcrOptions;
      readonly assetFor: (page: number) => { readonly assetId: Id; readonly absolutePath: string };
      readonly workDir: string;
      readonly shouldStop: () => boolean;
    },
    onPage: (outcome: OcrPageOutcome) => void,
  ): Promise<{ readonly availability: OcrAvailability; readonly unprocessedPages: readonly number[] }>;
}

export interface BookBinding {
  readonly bookInstanceId: Id | null;
  readonly baselineSourceId: Id | null;
}

/**
 * Host-owned library binding: the importer never invents a BookInstance and
 * never guesses a baseline match (05 搂4 same-hash / rescan / other edition).
 */
export interface BookBindingPort {
  bind(input: {
    readonly sha256: string;
    readonly pageCount: number;
    readonly confirmedMetadata: ImportStartRequest['confirmedMetadata'];
    readonly probe: PdfProbe;
    readonly now: string;
  }): Promise<BookBinding>;
}

export interface ManagedAssetStore {
  /** Host grants a handle -> absolute path inside an allowed root. */
  resolve(assetId: Id): Promise<{ readonly absolutePath: string } | null>;
  /** Absolute roots the host allows the importer to read. */
  readonly allowedRoots: readonly string[];
  /** Registers a produced asset (page image) and returns its managed handle. */
  put?(input: {
    readonly bytes: Uint8Array;
    readonly fileName: string;
    readonly sha256: string;
  }): Promise<{ readonly assetId: Id; readonly relativePath: string }>;
}

export type PageMethod = 'text_layer' | 'ocr';

export interface PageQuality {
  /** Local heuristic OCR quality score in 0..1 (engine exposes no probability). */
  readonly score: number;
  readonly flags: readonly string[];
  readonly charCount: number;
  readonly cjkChars: number;
  readonly replacementChars: number;
  readonly latinChars: number;
}

export interface PageExtraction {
  readonly page: number;
  readonly method: PageMethod;
  readonly textAvailable: boolean;
  readonly unavailableReason: string | null;
  readonly lines: readonly {
    readonly text: string;
    readonly bbox: NormalizedBBox;
    readonly fontSize: number | null;
  }[];
  readonly glyphCount: number;
  readonly undecodableGlyphs: number;
  readonly quality: PageQuality;
  readonly pageImageAssetId: Id | null;
  readonly renderMs: number;
  readonly ocrMs: number;
  readonly parserVersion: string;
  readonly sha256: string;
}

export interface BlockRecord {
  readonly page: number;
  readonly index: number;
  readonly type: SourceBlockType;
  readonly bbox: NormalizedBBox | null;
  readonly originalText: string;
  readonly revisedText: string | null;
  readonly extractionMethod: ExtractionMethod;
  readonly textConfidence: number | null;
  readonly reviewState: ReviewState;
  readonly lowQuality: boolean;
  readonly blockId: Id;
  readonly sourceRefId: Id;
}

export interface FigureRecord {
  readonly page: number;
  readonly caption: string;
  readonly captionBbox: NormalizedBBox | null;
  readonly type: FigureType;
  /** Whole-page image asset for scanned pages (figure cropping is deferred). */
  readonly originalAssetId: Id;
  readonly activeAssetId: Id;
  readonly extractionMethod: ExtractionMethod;
  readonly figureId: Id;
  readonly sourceRefId: Id;
}

export interface TocEntryRecord {
  readonly title: string;
  readonly pdfPage: number | null;
  readonly printedPage: string | null;
}

export interface TocCandidateRecord {
  readonly pdfPage: number;
  readonly title: string;
  readonly entries: readonly TocEntryRecord[];
  readonly confidence: number;
}

export interface PrintedPageEvidence {
  readonly page: number;
  readonly printedPage: string;
  readonly sourceLine: string;
  readonly confidence: 'high' | 'medium';
}

export interface PageMapRow {
  readonly page: number;
  readonly method: PageMethod;
  readonly printedPage: string | null;
  readonly printedPageConfidence: 'high' | 'medium' | null;
  readonly printedPageEvidence: string | null;
  readonly charCount: number;
  readonly qualityScore: number;
  readonly flags: readonly string[];
  readonly pageImageAssetId: Id | null;
  readonly renderMs: number;
  readonly ocrMs: number;
  readonly cached: boolean;
  readonly headerArtifactCount: number;
}

export interface RevisionRecord {
  readonly page: number;
  readonly blockId: Id;
  readonly normalizerVersion: string;
  readonly originalSha256: string;
  readonly revisedSha256: string;
  readonly action: string;
  readonly at: string;
}

export interface PageArtifacts {
  readonly extraction: PageExtraction;
  readonly blocks: readonly BlockRecord[];
  readonly figures: readonly FigureRecord[];
  readonly revisions: readonly RevisionRecord[];
  /** Decorative top-margin OCR noise that was excluded from the blocks. */
  readonly headerArtifactCount: number;
}

export interface ImportArtifacts {
  readonly jobId: Id;
  readonly blocks: readonly { readonly sourceRef: SourceRef; readonly block: SourceBlock }[];
  readonly figures: readonly { readonly sourceRef: SourceRef; readonly figure: Figure }[];
  readonly tocCandidates: readonly TocCandidateRecord[];
  readonly pageMap: readonly PageMapRow[];
  readonly revisions: readonly RevisionRecord[];
  readonly bookInstanceId: Id | null;
  readonly baselineSourceId: Id | null;
}

export type ImportEvent = {
  readonly schemaVersion: 1;
  readonly eventId: Id;
  readonly topic: 'import.progress';
  readonly jobId: Id;
  readonly stage: ImportStage;
  readonly status: ImportJob['status'];
  readonly completedUnits: number;
  readonly totalUnits: number;
  readonly payload: {
    readonly page: number | null;
    readonly method: PageMethod | null;
    readonly message: string | null;
    readonly engine: string | null;
  };
  readonly at: string;
};

export interface ImportProgressListener {
  (event: ImportEvent): void;
}

/** Serialized job state. `absolutePath` never appears in a public payload. */
export interface StoredJob {
  readonly schemaVersion: 1;
  readonly job: ImportJob;
  readonly assetId: Id;
  readonly sha256: string;
  readonly pageCount: number;
  readonly absolutePath: string;
  readonly fileName: string | null;
  readonly bookInstanceId: Id | null;
  readonly baselineSourceId: Id | null;
  readonly runEpoch: number;
  readonly cancelRequested: boolean;
  readonly probe: PdfProbe;
  readonly ocrOptions: OcrOptions;
  readonly backendId: string;
  /** Pages served from the (sha256, parserVersion) cache during this job. */
  readonly cacheHits: readonly number[];
  readonly notes: readonly string[];
}

export interface RetryOptions {
  /** Re-run only these 1-based pages (default: failed/incomplete pages). */
  readonly pages?: readonly number[];
}

export interface RetryOutcome {
  readonly job: ImportJob;
  readonly retriedPages: readonly number[];
  /** Pages skipped because a human revision exists (never overwritten). */
  readonly skippedPagesWithRevisions: readonly number[];
  readonly failedPages: readonly number[];
}

export interface ImporterDependencies {
  readonly assets: ManagedAssetStore;
  readonly backend: ImportBackend;
  readonly paths: ImportPaths;
  readonly clock: Clock;
  readonly ids: IdGenerator;
  readonly binding: BookBindingPort;
  readonly network?: { readonly status: 'available' | 'unavailable' };
  readonly ocr?: Partial<OcrOptions>;
  readonly concurrency?: number;
  readonly onProgress?: ImportProgressListener;
  /** Model-backed concept extraction; absent means cloud extraction pauses. */
  readonly cloudConcepts?: {
    extract(input: {
      readonly jobId: Id;
      readonly text: string;
      readonly now: string;
    }): Promise<{ readonly conceptCount: number; readonly costUsd: number | null }>;
  } | null;
}

/** Book instance is only used to type-check the binding port contract. */
export type BindingReference = Pick<BookInstance, 'id' | 'originalSha256' | 'pageCount'>;

export type ImportRequest = ImportStartRequest;
export type ImportResult = ServiceResult<ImportJob>;
export type Ctx = RequestContext;
export type { Clock, IdGenerator, ImportJob, ImportStage };
