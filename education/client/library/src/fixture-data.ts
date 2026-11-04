/**
 * FIXTURE LIBRARY SOURCE — explicitly marked.
 *
 * Synthetic books, jobs and source views only. It consumes T01 source DTO
 * fixtures (never textbook text or images) and must not be presented as a real
 * API. T13 replaces it with ImportPort/ContentQuery adapters.
 */

import {
  errResult,
  okResult,
  validateBookInstance,
  validateFigure,
  validateImportJob,
  validateSourceBlock,
  validateSourceRef,
  type BookInstance,
  type Figure,
  type ImportJob,
  type ImportError,
  type ImportStage,
  type ImportStartRequest,
  type ImportStatus,
  type RequestContext,
  type ServiceError,
  type ServiceResult,
  type SourceBlock,
  type SourceRef,
  type ValidationResult,
} from '@edu/domain';

import bookJson from '../../../packages/domain/fixtures/entities/book-instance.json';
import figureJson from '../../../packages/domain/fixtures/entities/figure.json';
import sourceJson from '../../../packages/domain/fixtures/entities/source-ref.json';
import blockJson from '../../../packages/domain/fixtures/entities/source-block.json';

import type {
  ImportStartOutcome,
  LibraryBook,
  LibraryDataSource,
  LibraryResult,
  SelectedFile,
  SourceListItem,
  SourceView,
} from './types.js';

export const FIXTURE_LIBRARY_NOTICE =
  '演示数据（fixture）：这里的课本、导入进度和来源都是合成样例，不是真实教材。';

export type LibraryScenario =
  | 'running'
  | 'ready'
  | 'await-review'
  | 'same-edition-rescan'
  | 'failed-pdf'
  | 'failed-ocr-language'
  | 'failed-storage-full'
  | 'failed-permission'
  | 'offline-paused'
  | 'cancelled'
  | 'duplicate'
  | 'source-missing'
  | 'file-missing'
  | 'no-books';

export interface FixtureLibraryOptions {
  readonly scenario?: LibraryScenario;
}

function unwrap<T>(result: ValidationResult<T>, label: string): T {
  if (!result.ok) {
    throw new Error(`fixture contract violation in ${label}: ${result.issues.map((issue) => issue.code).join(',')}`);
  }
  return result.value;
}

const BOOK: BookInstance = unwrap(validateBookInstance(bookJson), 'entities/book-instance.json');
const SOURCE_P18: SourceRef = unwrap(validateSourceRef(sourceJson), 'entities/source-ref.json');
const BLOCK_P18: SourceBlock = unwrap(validateSourceBlock(blockJson), 'entities/source-block.json');
const FIGURE_P26: Figure = unwrap(validateFigure(figureJson), 'entities/figure.json');
const SOURCE_P26: SourceRef = unwrap(
  validateSourceRef({
    ...SOURCE_P18,
    id: 'source.p26',
    pdfPage: 26,
    printedPage: null,
    bbox: { x: 0.2, y: 0.25, width: 0.4, height: 0.3 },
    blockId: null,
    figureId: FIGURE_P26.id,
  }),
  'synthetic source.p26',
);
const SOURCE_CANDIDATE: SourceRef = unwrap(
  validateSourceRef({
    ...SOURCE_P18,
    id: 'source.candidate.p18',
    printedPage: null,
    verification: { state: 'unverified', actorKind: null, checkedAt: null, notes: 'fixture candidate' },
  }),
  'synthetic source.candidate.p18',
);
const BLOCK_CANDIDATE: SourceBlock = unwrap(
  validateSourceBlock({
    ...BLOCK_P18,
    id: 'block.candidate.p18',
    sourceRefId: SOURCE_CANDIDATE.id,
    reviewState: 'candidate',
  }),
  'synthetic block.candidate.p18',
);

const NOW = '2026-10-29T10:00:00Z';
const JOB_ID = 'job.import.fixture';
const LEARNER = 'learner.local.default';

const BOOKS: readonly LibraryBook[] = [
  {
    id: BOOK.id,
    title: '合成生物教材（fixture）',
    publisher: '合成出版社（fixture，非真实版本）',
    editionLabel: '2024 七年级上册 · 合成样例',
    grade: 7,
    term: 1,
    subject: 'biology',
    pageCount: BOOK.pageCount,
    sha256: BOOK.originalSha256,
    materialState: 'baseline',
    reviewState: 'published',
    trustMode: 'published',
    scope: 'partial',
    coverageStatus: 'partial',
    editionVerification: 'verified',
    fileState: 'present',
    isCurrent: true,
    unavailableReason: null,
  },
  {
    id: 'book.candidate.fixture',
    title: '候选生物教材（fixture）',
    publisher: '未知出版社（fixture）',
    editionLabel: '版次认不出来 · 样例',
    grade: 7,
    term: 1,
    subject: 'biology',
    pageCount: 200,
    sha256: '3333333333333333333333333333333333333333333333333333333333333333',
    materialState: 'candidate',
    reviewState: 'candidate',
    trustMode: 'candidate',
    scope: 'partial',
    coverageStatus: 'partial',
    editionVerification: 'unverified',
    fileState: 'present',
    isCurrent: false,
    unavailableReason: null,
  },
  {
    id: 'book.unavailable.fixture',
    title: '打不开的课本（fixture）',
    publisher: '未知出版社（fixture）',
    editionLabel: '打不开的样例',
    grade: 7,
    term: 1,
    subject: 'biology',
    pageCount: 0,
    sha256: '4444444444444444444444444444444444444444444444444444444444444444',
    materialState: 'unavailable',
    reviewState: 'rejected',
    trustMode: 'candidate',
    scope: 'partial',
    coverageStatus: 'partial',
    editionVerification: 'rejected',
    fileState: 'corrupt',
    isCurrent: false,
    unavailableReason: '这个 PDF 打不开，没有读到能用的页面；也没有凭空造一本空课本。',
  },
];

function job(input: {
  readonly stage: ImportStage;
  readonly status: ImportStatus;
  readonly completedUnits: number;
  readonly totalUnits?: number;
  readonly error?: ImportError | null;
  readonly retryable?: boolean;
}): ImportJob {
  const totalUnits = input.totalUnits ?? 200;
  return unwrap(
    validateImportJob({
      schemaVersion: 1,
      id: JOB_ID,
      requestId: `request.${JOB_ID}`,
      sha256: BOOK.originalSha256,
      stage: input.stage,
      status: input.status,
      checkpoint: {
        stage: input.stage,
        lastCompletedUnit: input.completedUnits,
        parserCacheKey: 'pdf-importer-v1',
      },
      completedUnits: input.completedUnits,
      totalUnits,
      error: input.error ?? null,
      retryable: input.retryable ?? true,
      parserVersion: 'pdf-importer-v1',
      modelVersion: null,
      costUsage: { calls: 0, inputTokens: 0, outputTokens: 0, estimatedCostUsd: null },
      createdAt: NOW,
      updatedAt: NOW,
    }),
    'synthetic import job',
  );
}

function importError(code: string, retryable: boolean): ImportError {
  return { code, message: code, retryable };
}

export class FixtureLibraryDataSource implements LibraryDataSource {
  readonly kind = 'fixture' as const;
  readonly notice = FIXTURE_LIBRARY_NOTICE;
  readonly scenario: LibraryScenario;
  private currentJob: ImportJob | null = null;
  private readonly listeners = new Map<string, Set<(job: ImportJob) => void>>();

  constructor(options: FixtureLibraryOptions = {}) {
    this.scenario = options.scenario ?? 'running';
  }

  async listBooks(_context: RequestContext): Promise<LibraryResult<readonly LibraryBook[]>> {
    if (this.scenario === 'no-books') return okResult([], 1);
    return this.scenario === 'offline-paused'
      ? { ...okResult(BOOKS, 1), offline: true }
      : okResult(BOOKS, 1);
  }

  async listSources(
    _context: RequestContext,
    bookId: string,
  ): Promise<ServiceResult<readonly SourceListItem[]>> {
    if (bookId === 'book.candidate.fixture') {
      return okResult(
        [
          {
            sourceRefId: SOURCE_CANDIDATE.id,
            pdfPage: SOURCE_CANDIDATE.pdfPage,
            printedPage: null,
            label: '候选段落',
            kind: 'block',
            reviewState: 'candidate',
            verification: 'unverified',
            candidate: true,
          },
        ],
        1,
      );
    }
    if (bookId !== BOOK.id) return okResult([], 1);
    return okResult(
      [
        {
          sourceRefId: SOURCE_P18.id,
          pdfPage: SOURCE_P18.pdfPage,
          printedPage: SOURCE_P18.printedPage,
          label: '段落 · 细胞是生物体结构和功能的基本单位',
          kind: 'block',
          reviewState: BLOCK_P18.reviewState,
          verification: SOURCE_P18.verification.state,
          candidate: false,
        },
        {
          sourceRefId: SOURCE_P26.id,
          pdfPage: SOURCE_P26.pdfPage,
          printedPage: null,
          label: '图示 · 合成细胞结构图',
          kind: 'figure',
          reviewState: FIGURE_P26.reviewState,
          verification: SOURCE_P26.verification.state,
          candidate: false,
        },
      ],
      1,
    );
  }

  async openSource(_context: RequestContext, sourceRefId: string): Promise<ServiceResult<SourceView>> {
    if (this.scenario === 'source-missing') {
      return errResult('NOT_FOUND', '来源不存在或页码超出范围', false);
    }
    if (sourceRefId === SOURCE_CANDIDATE.id) {
      return okResult(
        {
          bookTitle: '候选生物教材（fixture）',
          editionLabel: '版次认不出来 · 样例',
          pageCount: 200,
          bookSha256: '3333333333333333333333333333333333333333333333333333333333333333',
          sourceRef: SOURCE_CANDIDATE,
          block: BLOCK_CANDIDATE,
          figure: null,
          pageImage: {
            assetId: 'asset.page.candidate.p18',
            bbox: { x: 0.1, y: 0.12, width: 0.6, height: 0.2 },
            altText: 'PDF 第 18 页上这段文字的位置（样例）',
            fixtureOnly: true,
          },
          candidate: true,
        },
        1,
      );
    }
    if (sourceRefId === SOURCE_P26.id) {
      return okResult(
        {
          bookTitle: '合成生物教材（fixture）',
          editionLabel: '2024 七年级上册 · 合成样例',
          pageCount: BOOK.pageCount,
          bookSha256: BOOK.originalSha256,
          sourceRef: SOURCE_P26,
          block: null,
          figure: FIGURE_P26,
          pageImage: {
            assetId: 'asset.page.p26.fixture',
            bbox: { x: 0.2, y: 0.25, width: 0.4, height: 0.3 },
            altText: 'PDF 第 26 页上图示的位置',
            fixtureOnly: true,
          },
          candidate: false,
        },
        1,
      );
    }
    if (sourceRefId !== SOURCE_P18.id) {
      return errResult('NOT_FOUND', '来源不存在或页码超出范围', false);
    }
    return okResult(
      {
        bookTitle: '合成生物教材（fixture）',
        editionLabel: '2024 七年级上册 · 合成样例',
        pageCount: BOOK.pageCount,
        bookSha256: BOOK.originalSha256,
        sourceRef: SOURCE_P18,
        block: BLOCK_P18,
        figure: null,
        pageImage: {
          assetId: 'asset.page.p18.fixture',
          bbox: { x: 0.12, y: 0.18, width: 0.55, height: 0.13 },
          altText: 'PDF 第 18 页上这段文字的位置',
          fixtureOnly: true,
        },
        candidate: false,
      },
      1,
    );
  }

  async chooseFile(_context: RequestContext): Promise<ServiceResult<SelectedFile | null>> {
    if (this.scenario === 'file-missing') {
      return errResult('NOT_FOUND', '选中文件不存在或无法读取', true);
    }
    return okResult(
      {
        handle: {
          assetId: 'asset.upload.fixture',
          sha256: BOOK.originalSha256,
          originalName: '合成教材.pdf',
        },
        fileName: '合成教材.pdf',
        sizeBytes: 4_194_304,
        detectedPageCount: BOOK.pageCount,
        suggestedMetadata: {
          title: null,
          publisher: null,
          editionLabel: null,
          pageCount: BOOK.pageCount,
        },
      },
      1,
    );
  }

  async startImport(
    _context: RequestContext,
    request: ImportStartRequest,
  ): Promise<ServiceResult<ImportStartOutcome>> {
    if (request.confirmedMetadata !== null && request.confirmedMetadata.pageCount !== null && request.confirmedMetadata.pageCount !== BOOK.pageCount) {
      return errResult('CONTRACT_REJECTED', '元数据页数与文件不一致', false);
    }
    const built = this.buildJobForScenario();
    if (built === null) {
      return errResult('CONTRACT_REJECTED', 'fixture 未配置导入任务', false);
    }
    this.currentJob = built.job;
    return okResult(built, 1);
  }

  private buildJobForScenario(): ImportStartOutcome | null {
    const match = (kind: ImportStartOutcome['match']['kind'], label: string): ImportStartOutcome['match'] => ({
      kind,
      label,
      baselineBookId: kind === 'same_hash' || kind === 'same_edition_rescan' ? BOOK.id : null,
    });
    switch (this.scenario) {
      case 'duplicate':
        return {
          job: job({ stage: 'structure', status: 'paused', completedUnits: 200 }),
          reused: true,
          match: match('same_hash', '同一文件已存在：复用任务，不会重复建书'),
          scope: 'partial',
          coverageStatus: 'partial',
        };
      case 'same-edition-rescan':
        return {
          job: job({ stage: 'structure', status: 'paused', completedUnits: 120 }),
          reused: false,
          match: match('same_edition_rescan', '同版不同扫描：需要页码映射，当前按候选处理'),
          scope: 'partial',
          coverageStatus: 'partial',
        };
      case 'await-review':
        return {
          job: job({ stage: 'await_review', status: 'paused', completedUnits: 200, retryable: false }),
          reused: false,
          match: match('different_edition', '未匹配已核实版本：生成待核实候选'),
          scope: 'partial',
          coverageStatus: 'partial',
        };
      case 'offline-paused':
        return {
          job: job({
            stage: 'structure',
            status: 'paused',
            completedUnits: 200,
            error: importError('CLOUD_EXTRACTION_PAUSED', true),
            retryable: true,
          }),
          reused: false,
          match: match('different_edition', '未匹配已核实版本：生成待核实候选'),
          scope: 'partial',
          coverageStatus: 'partial',
        };
      case 'failed-pdf':
        return {
          job: job({
            stage: 'extract',
            status: 'failed',
            completedUnits: 3,
            error: importError('PDF_CORRUPT', false),
            retryable: false,
          }),
          reused: false,
          match: match('unknown', '无法辨认教材版本'),
          scope: 'partial',
          coverageStatus: 'partial',
        };
      case 'failed-ocr-language':
        return {
          job: job({
            stage: 'extract',
            status: 'failed',
            completedUnits: 0,
            error: importError('OCR_LANGUAGE_UNAVAILABLE', true),
            retryable: true,
          }),
          reused: false,
          match: match('unknown', '无法辨认教材版本'),
          scope: 'partial',
          coverageStatus: 'partial',
        };
      case 'failed-storage-full':
        return {
          job: job({
            stage: 'structure',
            status: 'failed',
            completedUnits: 12,
            error: importError('STORAGE_FULL', true),
            retryable: true,
          }),
          reused: false,
          match: match('unknown', '无法辨认教材版本'),
          scope: 'partial',
          coverageStatus: 'partial',
        };
      case 'failed-permission':
        return {
          job: job({
            stage: 'structure',
            status: 'failed',
            completedUnits: 8,
            error: importError('STORAGE_WRITE_FAILED', true),
            retryable: true,
          }),
          reused: false,
          match: match('unknown', '无法辨认教材版本'),
          scope: 'partial',
          coverageStatus: 'partial',
        };
      case 'cancelled':
        return {
          job: job({ stage: 'extract', status: 'cancelled', completedUnits: 5 }),
          reused: false,
          match: match('different_edition', '未匹配已核实版本：生成待核实候选'),
          scope: 'partial',
          coverageStatus: 'partial',
        };
      case 'ready':
        return {
          job: job({ stage: 'ready', status: 'completed', completedUnits: 200, retryable: false }),
          reused: false,
          match: match('different_edition', '未匹配已核实版本：生成待核实候选'),
          scope: 'partial',
          coverageStatus: 'partial',
        };
      case 'running':
        return {
          job: job({ stage: 'extract', status: 'running', completedUnits: 4 }),
          reused: false,
          match: match('different_edition', '未匹配已核实版本：生成待核实候选'),
          scope: 'partial',
          coverageStatus: 'partial',
        };
      case 'source-missing':
      case 'file-missing':
      case 'no-books':
        return null;
      default:
        return {
          job: job({ stage: 'extract', status: 'running', completedUnits: 4 }),
          reused: false,
          match: match('different_edition', '未匹配已核实版本：生成待核实候选'),
          scope: 'partial',
          coverageStatus: 'partial',
        };
    }
  }

  async jobStatus(_context: RequestContext, jobId: string): Promise<ServiceResult<ImportJob>> {
    if (this.currentJob === null || this.currentJob.id !== jobId) {
      return errResult('NOT_FOUND', '找不到导入任务', false);
    }
    return okResult(this.currentJob, 1);
  }

  async cancelImport(_context: RequestContext, jobId: string): Promise<ServiceResult<ImportJob>> {
    if (this.currentJob === null || this.currentJob.id !== jobId) {
      return errResult('NOT_FOUND', '找不到导入任务', false);
    }
    if (this.currentJob.status === 'cancelled') return okResult(this.currentJob, 2);
    const next = job({
      stage: this.currentJob.stage,
      status: 'cancelled',
      completedUnits: this.currentJob.completedUnits,
      totalUnits: this.currentJob.totalUnits,
      retryable: true,
    });
    this.currentJob = next;
    this.emit(next);
    return okResult(next, 2);
  }

  async resumeImport(_context: RequestContext, jobId: string): Promise<ServiceResult<ImportJob>> {
    if (this.currentJob === null || this.currentJob.id !== jobId) {
      return errResult('NOT_FOUND', '找不到导入任务', false);
    }
    const next = job({
      stage: this.currentJob.stage === 'await_review' ? 'validate' : this.currentJob.stage,
      status: 'running',
      completedUnits: Math.min(this.currentJob.completedUnits + 1, this.currentJob.totalUnits),
      totalUnits: this.currentJob.totalUnits,
    });
    this.currentJob = next;
    this.emit(next);
    return okResult(next, 2);
  }

  async retryImport(_context: RequestContext, jobId: string): Promise<ServiceResult<ImportJob>> {
    if (this.currentJob === null || this.currentJob.id !== jobId) {
      return errResult('NOT_FOUND', '找不到导入任务', false);
    }
    if (!this.currentJob.retryable) {
      return errResult('CONTRACT_REJECTED', '这个失败不能直接重试', false);
    }
    const next = job({
      stage: this.currentJob.stage,
      status: 'running',
      completedUnits: this.currentJob.completedUnits,
      totalUnits: this.currentJob.totalUnits,
    });
    this.currentJob = next;
    this.emit(next);
    return okResult(next, 2);
  }

  watchImport(jobId: string, listener: (job: ImportJob) => void): () => void {
    const set = this.listeners.get(jobId) ?? new Set<(job: ImportJob) => void>();
    set.add(listener);
    this.listeners.set(jobId, set);
    return () => {
      set.delete(listener);
      if (set.size === 0) this.listeners.delete(jobId);
    };
  }

  /** Test hook: emit a (possibly forged/late) update to exercise the UI guard. */
  emitJob(next: ImportJob): void {
    this.emit(next);
  }

  private emit(next: ImportJob): void {
    for (const listener of this.listeners.get(next.id) ?? []) listener(next);
  }
}

export function createFixtureLibraryDataSource(options: FixtureLibraryOptions = {}): FixtureLibraryDataSource {
  return new FixtureLibraryDataSource(options);
}

export { LEARNER as FIXTURE_LEARNER };
