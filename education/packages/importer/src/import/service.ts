/**
 * The import service: managed asset -> identify -> extract (text layer first,
 * OCR for scanned pages) -> structure -> concepts/model -> validate ->
 * await_review, with per-page caching, checkpoints, cancel/resume/retry and a
 * hard "no late results after cancel" rule.
 *
 * It never publishes content: `await_review` is a real state (T04/T05 review
 * freezes the TOC and concepts). A missing model route pauses the job with an
 * explicit code instead of pretending the import finished.
 */

import { readFile, rm } from 'node:fs/promises';
import path from 'node:path';

import {
  IMPORT_STAGES,
  applyImportProgress,
  errResult,
  okResult,
  validateFigure,
  validateImportJob,
  validateSourceBlock,
  validateSourceRef,
  type Figure,
  type ImportJob,
  type ImportStartRequest,
  type ServiceErrorCode,
  type ServiceResult,
  type SourceBlock,
  type SourceRef,
} from '@edu/domain';

import { verifyManagedAsset } from '../assets.js';
import {
  ImporterFailure,
  importerError,
  storageError,
  type ImporterErrorInfo,
} from '../errors.js';
import { buildPageStructure } from '../structure/blocks.js';
import { detectPrintedPage } from '../structure/page-map.js';
import { scoreQuality } from '../structure/text.js';
import { detectTocCandidates } from '../structure/toc.js';
import { ImportStorage } from './storage.js';
import {
  DEFAULT_OCR_OPTIONS,
  PARSER_VERSION,
  type BlockRecord,
  type ImportArtifacts,
  type ImportBackend,
  type ImportEvent,
  type ImportRequest,
  type ImportResult,
  type ImportStage,
  type ImporterDependencies,
  type OcrPage,
  type OcrPageOutcome,
  type PageArtifacts,
  type PageExtraction,
  type PageMapRow,
  type RetryOptions,
  type RetryOutcome,
  type StoredJob,
} from './types.js';

interface Runtime {
  readonly jobId: string;
  readonly epoch: number;
  cancelRequested: boolean;
}

const SERVICE_CODE_BY_IMPORT_ERROR: Partial<Record<string, ServiceErrorCode>> = {
  ASSET_HANDLE_INVALID: 'INVALID_INPUT',
  ASSET_PATH_OUTSIDE_ROOT: 'INVALID_INPUT',
  ASSET_NOT_FOUND: 'NOT_FOUND',
  ASSET_NOT_A_FILE: 'INVALID_INPUT',
  ASSET_HASH_MISMATCH: 'VALIDATION_FAILED',
  ASSET_METADATA_MISMATCH: 'VALIDATION_FAILED',
  PDF_CORRUPT: 'VALIDATION_FAILED',
  PDF_ENCRYPTED: 'VALIDATION_FAILED',
  PDF_NO_PAGES: 'VALIDATION_FAILED',
  PDF_READ_FAILED: 'UNAVAILABLE',
  TEXT_LAYER_UNAVAILABLE: 'UNAVAILABLE',
  OCR_ENGINE_UNAVAILABLE: 'UNAVAILABLE',
  OCR_LANGUAGE_UNAVAILABLE: 'UNAVAILABLE',
  PAGE_RENDER_FAILED: 'UNAVAILABLE',
  PAGE_OCR_FAILED: 'UNAVAILABLE',
  JOB_NOT_FOUND: 'NOT_FOUND',
  JOB_CANCELLED: 'CANCELLED',
  LATE_RESULT_REJECTED: 'CANCELLED',
  CHECKPOINT_CORRUPT: 'CONFLICT',
  CHECKPOINT_VERSION_MISMATCH: 'CONFLICT',
  CLOUD_EXTRACTION_PAUSED: 'UNAVAILABLE',
  CLOUD_AUTH_FAILED: 'UNAUTHORIZED',
  CLOUD_RATE_LIMITED: 'QUOTA_EXCEEDED',
  STORAGE_FULL: 'STORAGE_FAILED',
  STORAGE_WRITE_FAILED: 'STORAGE_FAILED',
  INPUT_MISSING: 'INVALID_INPUT',
  UNSUPPORTED: 'UNSUPPORTED',
};

export function toServiceError(info: ImporterErrorInfo): {
  readonly code: ServiceErrorCode;
  readonly message: string;
  readonly retryable: boolean;
  readonly detailsRef?: string;
} {
  return {
    code: SERVICE_CODE_BY_IMPORT_ERROR[info.code] ?? 'CONFLICT',
    message: info.message,
    retryable: info.retryable,
    ...(info.detailsRef === undefined ? {} : { detailsRef: info.detailsRef }),
  };
}

function classifyError(error: unknown, fallback: ImporterErrorInfo): ImporterErrorInfo {
  if (error instanceof ImporterFailure) return error.info;
  const code = (error as NodeJS.ErrnoException | null)?.code;
  if (code === 'ENOSPC' || code === 'EDQUOT' || code === 'EACCES' || code === 'EPERM') {
    return storageError(error);
  }
  return fallback;
}

/**
 * Cloud stage failures: a full disk (or permission) during the concepts stage is
 * a storage failure, not a model quota problem; everything else is a model-route
 * failure. Cancellation is handled separately before this is called.
 */
function classifyCloudError(error: unknown): ImporterErrorInfo {
  if (error instanceof ImporterFailure) return error.info;
  const code = (error as NodeJS.ErrnoException | null)?.code;
  if (code === 'ENOSPC' || code === 'EDQUOT' || code === 'EACCES' || code === 'EPERM') {
    return storageError(error);
  }
  return importerError('CLOUD_RATE_LIMITED');
}

export class ImportService {
  private readonly storage: ImportStorage;
  private readonly running = new Map<string, Runtime>();
  private readonly deps: ImporterDependencies;

  constructor(deps: ImporterDependencies) {
    this.deps = deps;
    this.storage = new ImportStorage(deps.paths.rootDir);
  }

  get ocrOptions() {
    return { ...DEFAULT_OCR_OPTIONS, ...(this.deps.ocr ?? {}) };
  }

  /* ------------------------------------------------------------- lifecycle */

  async start(ctx: { requestId: string; now: string }, request: ImportStartRequest): Promise<ImportResult> {
    const existingByRequest = await this.findByIdempotencyKey(ctx.requestId);
    if (existingByRequest !== null) {
      return okResult(existingByRequest.job, revisionOf(existingByRequest.job));
    }

    const verified = await verifyManagedAsset({
      store: this.deps.assets,
      handle: request.file,
      backend: this.deps.backend,
      confirmedPageCount: request.confirmedMetadata?.pageCount ?? null,
    });
    if (!verified.ok) return errResult(...serviceErrorParts(verified.error));

    const binding = await this.deps.binding.bind({
      sha256: verified.value.sha256,
      pageCount: verified.value.probe.pageCount,
      confirmedMetadata: request.confirmedMetadata,
      probe: verified.value.probe,
      now: ctx.now,
    });
    if ((binding.bookInstanceId === null) === (binding.baselineSourceId === null)) {
      return errResult(
        'INVALID_INPUT',
        '图书绑定必须且只能给出 bookInstanceId 或 baselineSourceId 之一。',
        false,
      );
    }

    const jobs = await this.storage.listJobs();
    const sameHash = jobs.find(
      (job) =>
        job.sha256 === verified.value.sha256 &&
        job.job.parserVersion === PARSER_VERSION &&
        job.bookInstanceId === binding.bookInstanceId &&
        job.baselineSourceId === binding.baselineSourceId,
    );
    if (sameHash !== undefined && (await this.storage.readArtifacts(sameHash.job.id)) !== null) {
      // A07 same-hash hit: re-importing the identical file is idempotent.
      return okResult(sameHash.job, revisionOf(sameHash.job));
    }

    const now = this.deps.clock.now();
    const jobId = this.deps.ids.next('import');
    const totalUnits = verified.value.probe.pageCount;
    const initial: ImportJob = {
      schemaVersion: 1,
      id: jobId,
      requestId: ctx.requestId,
      sha256: verified.value.sha256,
      stage: 'accepted',
      status: 'queued',
      checkpoint: { stage: 'accepted', lastCompletedUnit: null, parserCacheKey: null },
      completedUnits: 0,
      totalUnits,
      error: null,
      retryable: true,
      parserVersion: PARSER_VERSION,
      modelVersion: null,
      costUsage: { calls: 0, inputTokens: 0, outputTokens: 0, estimatedCostUsd: null },
      createdAt: now,
      updatedAt: now,
    };
    const stored: StoredJob = {
      schemaVersion: 1,
      job: initial,
      assetId: verified.value.assetId,
      sha256: verified.value.sha256,
      pageCount: totalUnits,
      absolutePath: verified.value.absolutePath,
      fileName: request.file.originalName ?? null,
      bookInstanceId: binding.bookInstanceId,
      baselineSourceId: binding.baselineSourceId,
      runEpoch: 1,
      cancelRequested: false,
      probe: verified.value.probe,
      ocrOptions: this.ocrOptions,
      backendId: this.deps.backend.id,
      cacheHits: [],
      notes: [],
    };
    const validated = validateImportJob(initial);
    if (!validated.ok) {
      return errResult('CONTRACT_REJECTED', '导入任务记录不符合公共契约，已拒绝创建。', false);
    }
    await this.storage.writeJob(stored);
    const executed = await this.execute(stored, 1);
    return okResult(executed.job, revisionOf(executed.job));
  }

  async status(ctx: { now: string }, jobId: string): Promise<ImportResult> {
    void ctx;
    const stored = await this.storage.readJob(jobId);
    if (stored === null) return errResult(...serviceErrorParts(importerError('JOB_NOT_FOUND')));
    return okResult(stored.job, revisionOf(stored.job));
  }

  async cancel(ctx: { now: string }, jobId: string): Promise<ImportResult> {
    void ctx;
    const stored = await this.storage.readJob(jobId);
    if (stored === null) return errResult(...serviceErrorParts(importerError('JOB_NOT_FOUND')));
    if (stored.job.status === 'completed' || stored.job.status === 'cancelled') {
      return okResult(stored.job, revisionOf(stored.job));
    }
    const runtime = this.running.get(jobId);
    if (runtime !== undefined) runtime.cancelRequested = true;
    const updated: StoredJob = {
      ...stored,
      cancelRequested: true,
      job: { ...stored.job, status: 'cancelled', retryable: true, updatedAt: this.deps.clock.now() },
    };
    const validated = validateImportJob(updated.job);
    if (!validated.ok) return errResult('CONTRACT_REJECTED', '取消后的导入状态不符合公共契约。', false);
    await this.storage.writeJob(updated);
    await this.emit(updated);
    return okResult(updated.job, revisionOf(updated.job));
  }

  async resume(ctx: { now: string }, jobId: string): Promise<ImportResult> {
    void ctx;
    const stored = await this.storage.readJob(jobId);
    if (stored === null) return errResult(...serviceErrorParts(importerError('JOB_NOT_FOUND')));
    if (stored.job.status === 'completed') return okResult(stored.job, revisionOf(stored.job));
    const nextEpoch = stored.runEpoch + 1;
    const resumed: StoredJob = {
      ...stored,
      cancelRequested: false,
      runEpoch: nextEpoch,
      job: { ...stored.job, status: 'running', retryable: true, updatedAt: this.deps.clock.now() },
    };
    await this.storage.writeJob(resumed);
    const executed = await this.execute(resumed, nextEpoch);
    return okResult(executed.job, revisionOf(executed.job));
  }

  /**
   * Retries only the requested (or unfinished) pages. Pages carrying a machine
   * revision are skipped, so a clean re-extraction never overwrites the
   * revised text that a curator may already have accepted.
   */
  async retry(
    ctx: { now: string },
    jobId: string,
    options: RetryOptions = {},
  ): Promise<ServiceResult<RetryOutcome>> {
    void ctx;
    const stored = await this.storage.readJob(jobId);
    if (stored === null) return errResult(...serviceErrorParts(importerError('JOB_NOT_FOUND')));

    const existingPages = await this.storage.readPages(jobId);
    const pagesWithRevisions = new Set(
      existingPages.filter((page) => page.revisions.length > 0).map((page) => page.extraction.page),
    );
    const requested =
      options.pages !== undefined
        ? [...options.pages]
        : Array.from({ length: stored.pageCount }, (_, index) => index + 1).filter(
            (page) => !existingPages.some((entry) => entry.extraction.page === page),
          );
    const skippedPagesWithRevisions = requested.filter((page) => pagesWithRevisions.has(page));
    const pagesToRetry = requested.filter((page) => !pagesWithRevisions.has(page));
    if (pagesToRetry.length === 0) {
      return okResult(
        { job: stored.job, retriedPages: [], skippedPagesWithRevisions, failedPages: [] },
        revisionOf(stored.job),
      );
    }
    for (const page of pagesToRetry) {
      await this.storage.clearCachePage(stored.sha256, page);
    }

    const runtime: Runtime = { jobId, epoch: stored.runEpoch + 1, cancelRequested: false };
    this.running.set(jobId, runtime);
    const retried: number[] = [];
    const failed: number[] = [];
    let working: StoredJob = {
      ...stored,
      runEpoch: runtime.epoch,
      cancelRequested: false,
      cacheHits: stored.cacheHits.filter((page) => !pagesToRetry.includes(page)),
      job: { ...stored.job, status: 'running', error: null, updatedAt: this.deps.clock.now() },
    };
    // A cancel can land between reading the job and this write; never overwrite
    // `cancelled` with `running`.
    const cancelledBeforeStart = await this.cancelledState(working, runtime);
    if (cancelledBeforeStart !== null) {
      this.running.delete(jobId);
      return okResult(
        {
          job: cancelledBeforeStart.job,
          retriedPages: [],
          skippedPagesWithRevisions,
          failedPages: [],
        },
        revisionOf(cancelledBeforeStart.job),
      );
    }
    await this.storage.writeJob(working);
    try {
      const extraction = await this.extractPages(working, runtime, pagesToRetry, true);
      retried.push(...extraction.succeeded);
      failed.push(...extraction.failed.map((entry) => entry.page));
      const cancelledAfterExtract = await this.cancelledState(working, runtime);
      if (cancelledAfterExtract !== null) {
        working = cancelledAfterExtract;
      } else {
        working = (await this.storage.readJob(jobId)) ?? working;
        if (extraction.failed.length > 0) {
          working = await this.refreshProgress(working);
          working = await this.failJob(working, extraction.failed[0].error);
        } else {
          const completed = await this.buildStructure(working, runtime);
          if (!completed) {
            working = (await this.storage.readJob(jobId)) ?? working;
          } else {
            working = (await this.storage.readJob(jobId)) ?? working;
            const stageIndex = IMPORT_STAGES.indexOf(working.job.stage);
            working =
              stageIndex <= IMPORT_STAGES.indexOf('validate')
                ? await this.transition(working, { stage: 'await_review', status: 'paused' })
                : await this.updateJob(working, { status: 'paused', error: null });
          }
        }
      }
    } finally {
      this.running.delete(jobId);
    }
    return okResult(
      {
        job: working.job,
        retriedPages: retried,
        skippedPagesWithRevisions,
        failedPages: failed,
      },
      revisionOf(working.job),
    );
  }

  async artifacts(ctx: { now: string }, jobId: string): Promise<ServiceResult<ImportArtifacts>> {
    void ctx;
    const stored = await this.storage.readJob(jobId);
    if (stored === null) return errResult(...serviceErrorParts(importerError('JOB_NOT_FOUND')));
    const artifacts = await this.storage.readArtifacts(jobId);
    if (artifacts === null) {
      return errResult(...serviceErrorParts(importerError('CHECKPOINT_CORRUPT', { retryable: true })));
    }
    return okResult(artifacts, revisionOf(stored.job));
  }

  async pageMap(ctx: { now: string }, jobId: string): Promise<ServiceResult<readonly PageMapRow[]>> {
    const artifacts = await this.artifacts(ctx, jobId);
    if (!artifacts.ok) return artifacts;
    return okResult(artifacts.data.pageMap, artifacts.revision);
  }

  /** Page artifacts (blocks/figures/revisions) of one page, for UI and review. */
  async pageArtifacts(
    ctx: { now: string },
    jobId: string,
    page: number,
  ): Promise<ServiceResult<PageArtifacts>> {
    void ctx;
    const stored = await this.storage.readJob(jobId);
    if (stored === null) return errResult(...serviceErrorParts(importerError('JOB_NOT_FOUND')));
    const entry = await this.storage.readPageArtifacts(jobId, page);
    if (entry === null) {
      return errResult(...serviceErrorParts(importerError('CHECKPOINT_CORRUPT', { retryable: true })));
    }
    return okResult(entry, revisionOf(stored.job));
  }

  /* -------------------------------------------------------------- pipeline */

  private async findByIdempotencyKey(requestId: string): Promise<StoredJob | null> {
    const jobs = await this.storage.listJobs();
    return jobs.find((job) => job.job.requestId === requestId) ?? null;
  }

  private async execute(stored: StoredJob, epoch: number): Promise<StoredJob> {
    const runtime: Runtime = { jobId: stored.job.id, epoch, cancelRequested: stored.cancelRequested };
    this.running.set(stored.job.id, runtime);
    let working = stored;
    try {
      // A cancel can arrive between job creation and this call (very common for
      // an immediately-cancelled import), so seed from the freshest on-disk job.
      const fresh = await this.storage.readJob(stored.job.id);
      if (fresh !== null) {
        working = fresh;
        runtime.cancelRequested = fresh.cancelRequested || fresh.job.status === 'cancelled';
      }
      if (runtime.cancelRequested) return this.finalizeCancelled(working);
      const entryIndex = IMPORT_STAGES.indexOf(working.job.stage);

      if (entryIndex <= IMPORT_STAGES.indexOf('identify')) {
        working = await this.transition(working, { stage: 'identify', status: 'running' });
      }
      if (runtime.cancelRequested) return this.finalizeCancelled(working);

      if (entryIndex <= IMPORT_STAGES.indexOf('extract')) {
        working = await this.transition(working, { stage: 'extract', status: 'running' });
        const extraction = await this.extractPages(working, runtime, null, false);
        working = (await this.storage.readJob(working.job.id)) ?? working;
        if (runtime.cancelRequested) return this.finalizeCancelled(working);
        working = await this.refreshProgress(working);
        if (extraction.failed.length > 0) {
          return this.failJob(working, extraction.failed[0].error);
        }
      }
      if (runtime.cancelRequested) return this.finalizeCancelled(working);

      if (entryIndex <= IMPORT_STAGES.indexOf('structure')) {
        working = await this.transition(working, { stage: 'structure', status: 'running' });
        let structureCompleted = false;
        try {
          structureCompleted = await this.buildStructure(working, runtime);
        } catch (error) {
          const cancelledOnError = await this.cancelledState(working, runtime);
          if (cancelledOnError !== null) return this.finalizeCancelled(cancelledOnError);
          return this.failJob(working, classifyError(error, importerError('STORAGE_WRITE_FAILED')));
        }
        if (!structureCompleted) {
          const cancelledDuringStructure = await this.cancelledState(working, runtime);
          return this.finalizeCancelled(cancelledDuringStructure ?? working);
        }
        if (runtime.cancelRequested) return this.finalizeCancelled(working);
        working = (await this.storage.readJob(working.job.id)) ?? working;
      }

      // Cancel re-check before the model stage: a cancel that landed after the
      // structure stage must not even announce `concepts`.
      const beforeCloud = await this.cancelledState(working, runtime);
      if (beforeCloud !== null) return this.finalizeCancelled(beforeCloud);

      const cloud = await this.tryCloudConcepts(working, runtime);
      working = cloud.stored;
      if (cloud.cancelled) return this.finalizeCancelled(working);
      // A failed model stage must stop here; do not keep advancing the stage.
      if (working.job.status === 'failed') return working;
      if (cloud.paused) return this.pauseForCloud(working);

      const afterCloud = await this.cancelledState(working, runtime);
      if (afterCloud !== null) return this.finalizeCancelled(afterCloud);

      if (entryIndex <= IMPORT_STAGES.indexOf('validate')) {
        const beforeValidate = await this.cancelledState(working, runtime);
        if (beforeValidate !== null) return this.finalizeCancelled(beforeValidate);
        working = await this.transition(working, { stage: 'validate', status: 'running' });
        const problem = await this.validateArtifacts(working);
        const cancelledDuringValidate = await this.cancelledState(working, runtime);
        if (cancelledDuringValidate !== null) return this.finalizeCancelled(cancelledDuringValidate);
        if (problem !== null) return this.failJob(working, problem);
      }
      // Final publish re-check: this is the write that used to overwrite a
      // concurrent `cancelled` status with `await_review`.
      const beforeFinal = await this.cancelledState(working, runtime);
      if (beforeFinal !== null) return this.finalizeCancelled(beforeFinal);
      const finalJob = await this.transition(working, { stage: 'await_review', status: 'paused' });
      if (finalJob.job.status === 'cancelled' || finalJob.cancelRequested) {
        await this.recordLateResult(working, {
          page: null,
          stage: 'await_review',
          reason: 'cancel-before-final-transition',
        });
        return this.finalizeCancelled(finalJob);
      }
      return finalJob;
    } catch (error) {
      return this.failJob(working, classifyError(error, importerError('STORAGE_WRITE_FAILED')));
    } finally {
      this.running.delete(stored.job.id);
    }
  }

  /* ------------------------------------------------------------- extraction */

  private async extractPages(
    stored: StoredJob,
    runtime: Runtime,
    onlyPages: readonly number[] | null,
    force: boolean,
  ): Promise<{ succeeded: number[]; failed: { page: number; error: ImporterErrorInfo }[] }> {
    const pages =
      onlyPages === null
        ? Array.from({ length: stored.pageCount }, (_, index) => index + 1)
        : [...onlyPages].filter((page) => page >= 1 && page <= stored.pageCount);
    const succeeded: number[] = [];
    const failed: { page: number; error: ImporterErrorInfo }[] = [];
    const needsOcr: number[] = [];
    const cacheHits = new Set(stored.cacheHits);

    for (const page of pages) {
      if ((await this.cancelledState(stored, runtime)) !== null) break;
      if (!force) {
        const cached = await this.storage.readCache({
          sha256: stored.sha256,
          parserVersion: PARSER_VERSION,
          page,
        });
        if (cached !== null) {
          succeeded.push(page);
          cacheHits.add(page);
          continue;
        }
      }
      try {
        const textLayer = await this.deps.backend.readTextLayer(stored.absolutePath, page);
        if (textLayer.available && textLayer.lines.length > 0) {
          const extraction: PageExtraction = {
            page,
            method: 'text_layer',
            textAvailable: true,
            unavailableReason: null,
            lines: textLayer.lines.map((line) => ({
              text: line.text,
              bbox: line.bbox,
              fontSize: line.fontSize,
            })),
            glyphCount: textLayer.glyphCount,
            undecodableGlyphs: textLayer.undecodableGlyphs,
            quality: scoreQuality({ lines: textLayer.lines, method: 'text_layer' }),
            pageImageAssetId: null,
            renderMs: 0,
            ocrMs: 0,
            parserVersion: PARSER_VERSION,
            sha256: stored.sha256,
          };
          // Re-check the on-disk cancel state before writing the page result.
          if ((await this.cancelledState(stored, runtime)) !== null) {
            await this.recordLateResult(stored, {
              page,
              stage: 'extract',
              reason: 'cancel-before-publish',
            });
            break;
          }
          await this.storage.writeCache(extraction);
          succeeded.push(page);
          continue;
        }
        needsOcr.push(page);
      } catch (error) {
        failed.push({ page, error: classifyError(error, importerError('PDF_READ_FAILED')) });
      }
    }

    if (needsOcr.length > 0 && !runtime.cancelRequested) {
      const availability = await this.deps.backend.ocrAvailability();
      if (!availability.available) {
        const info = importerError(
          availability.reason === 'LANGUAGE_MISSING' ? 'OCR_LANGUAGE_UNAVAILABLE' : 'OCR_ENGINE_UNAVAILABLE',
        );
        for (const page of needsOcr) failed.push({ page, error: info });
      } else {
        const batches = chunk(needsOcr, Math.max(1, stored.ocrOptions.batchSize));
        for (const batch of batches) {
          if ((await this.cancelledState(stored, runtime)) !== null) break;
          const outcomes: OcrPageOutcome[] = [];
          const workDir = this.storage.workDir(stored.job.id);
          const { unprocessedPages } = await this.deps.backend.ocrPages(
            {
              absolutePath: stored.absolutePath,
              pages: batch,
              options: stored.ocrOptions,
              workDir,
              assetFor: (page) => ({
                assetId: `asset:render-${String(page).padStart(4, '0')}`,
                absolutePath: path.join(workDir, 'render', `page-${String(page).padStart(4, '0')}.png`),
              }),
              shouldStop: () => runtime.cancelRequested,
            },
            (outcome) => outcomes.push(outcome),
          );
          for (const outcome of outcomes) {
            if ((await this.cancelledState(stored, runtime)) !== null) {
              // A page result that arrived after cancel must never be published:
              // only the rejected-results ledger records it.
              if (outcome.ok) {
                await this.recordLateResult(stored, {
                  page: outcome.page.page,
                  stage: 'extract',
                  reason: 'cancel-before-publish',
                });
              }
              continue;
            }
            if (!outcome.ok) {
              failed.push({ page: outcome.page, error: outcome.error });
              continue;
            }
            try {
              const extraction = await this.persistOcrPage(stored, outcome.page, runtime);
              const cancelledBeforeCache = await this.cancelledState(stored, runtime);
              if (cancelledBeforeCache !== null) {
                await this.recordLateResult(stored, {
                  page: outcome.page.page,
                  stage: 'extract',
                  reason: 'cancel-before-cache',
                });
                continue;
              }
              await this.storage.writeCache(extraction);
              succeeded.push(outcome.page.page);
            } catch (error) {
              const cancelledOnError = await this.cancelledState(stored, runtime);
              if (cancelledOnError !== null) continue;
              failed.push({
                page: outcome.page.page,
                error: classifyError(error, importerError('STORAGE_WRITE_FAILED')),
              });
            }
          }
          if ((await this.cancelledState(stored, runtime)) !== null) break;
          for (const page of unprocessedPages) {
            if (!failed.some((entry) => entry.page === page) && !succeeded.includes(page)) {
              failed.push({ page, error: importerError('PAGE_OCR_FAILED', { retryable: true }) });
            }
          }
          await this.persistCacheHits(stored, cacheHits);
          await this.emit(stored);
        }
      }
    }

    if ((await this.cancelledState(stored, runtime)) !== null) {
      return { succeeded, failed };
    }
    if (cacheHits.size !== stored.cacheHits.length) await this.persistCacheHits(stored, cacheHits);
    return { succeeded, failed };
  }

  private async persistCacheHits(stored: StoredJob, hits: ReadonlySet<number>): Promise<void> {
    const current = await this.storage.readJob(stored.job.id);
    if (current === null) return;
    if (current.cancelRequested || current.job.status === 'cancelled') return;
    await this.storage.writeJob({ ...current, cacheHits: [...hits].sort((a, b) => a - b) });
  }

  private async persistOcrPage(
    stored: StoredJob,
    ocrPage: OcrPage,
    runtime: Runtime | null = null,
  ): Promise<PageExtraction> {
    if ((await this.cancelledState(stored, runtime)) !== null) {
      throw ImporterFailure.of('JOB_CANCELLED', { retryable: true });
    }
    const width = ocrPage.imageWidth > 0 ? ocrPage.imageWidth : 1;
    const height = ocrPage.imageHeight > 0 ? ocrPage.imageHeight : 1;
    let pageImageAssetId: string | null = null;
    if (stored.ocrOptions.savePageImages && ocrPage.pageImagePath !== null) {
      const bytes = await readBinary(ocrPage.pageImagePath);
      if (bytes === null) throw ImporterFailure.of('PAGE_OCR_FAILED');
      if (this.deps.assets.put === undefined) {
        throw ImporterFailure.of('STORAGE_WRITE_FAILED', { detailsRef: 'asset-store:no-put' });
      }
      if ((await this.cancelledState(stored, runtime)) !== null) {
        throw ImporterFailure.of('JOB_CANCELLED', { retryable: true });
      }
      try {
        const put = await this.deps.assets.put({
          bytes,
          fileName: `page-${String(ocrPage.page).padStart(4, '0')}.png`,
          sha256: ImportStorage.contentId(bytes),
        });
        pageImageAssetId = put.assetId;
        await rm(ocrPage.pageImagePath, { force: true });
      } catch (error) {
        throw new ImporterFailure(classifyError(error, importerError('STORAGE_WRITE_FAILED')));
      }
    }
    const lines = ocrPage.lines
      .map((line) => ({
        text: line.text,
        bbox: {
          x: clamp01(line.box.x / width),
          y: clamp01(line.box.y / height),
          width: clamp01(line.box.width / width),
          height: clamp01(line.box.height / height),
        },
        fontSize: null,
      }))
      .filter((line) => line.text.trim().length > 0);
    return {
      page: ocrPage.page,
      method: 'ocr',
      textAvailable: true,
      unavailableReason: null,
      lines,
      glyphCount: lines.reduce((sum, line) => sum + line.text.length, 0),
      undecodableGlyphs: 0,
      quality: scoreQuality({ lines, method: 'ocr' }),
      pageImageAssetId,
      renderMs: ocrPage.renderMs,
      ocrMs: ocrPage.ocrMs,
      parserVersion: PARSER_VERSION,
      sha256: stored.sha256,
    };
  }

  /* -------------------------------------------------------------- structure */

  private async buildStructure(stored: StoredJob, runtime: Runtime | null = null): Promise<boolean> {
    const pages: PageArtifacts[] = [];
    for (let page = 1; page <= stored.pageCount; page += 1) {
      if ((await this.cancelledState(stored, runtime)) !== null) return false;
      const cached = await this.storage.readCache({
        sha256: stored.sha256,
        parserVersion: PARSER_VERSION,
        page,
      });
      if (cached === null) continue;
      const structure = buildPageStructure({ extraction: cached, sha256: stored.sha256 });
      const at = this.deps.clock.now();
      const pageArtifacts: PageArtifacts = {
        extraction: cached,
        blocks: structure.blocks,
        figures: structure.figures,
        revisions: structure.revisions.map((revision) => ({ ...revision, at })),
        headerArtifactCount: structure.headerArtifacts.length,
      };
      await this.storage.writePageArtifacts(stored.job.id, pageArtifacts);
      pages.push(pageArtifacts);
    }
    // The published artifacts (blocks/figures/toc/page-map) are the product of
    // the structure stage; never write them after a cancel.
    if ((await this.cancelledState(stored, runtime)) !== null) return false;
    const artifacts = this.toArtifacts(stored, pages);
    await this.storage.writeArtifacts(stored.job.id, artifacts);
    return true;
  }

  private toArtifacts(stored: StoredJob, pages: readonly PageArtifacts[]): ImportArtifacts {
    const blocks: { sourceRef: SourceRef; block: SourceBlock }[] = [];
    const figures: { sourceRef: SourceRef; figure: Figure }[] = [];
    const revisions = pages.flatMap((page) => page.revisions);
    const pageMap: PageMapRow[] = [];
    const cacheHits = new Set(stored.cacheHits);

    for (const page of pages) {
      const evidence = detectPrintedPage(page.extraction);
      pageMap.push({
        page: page.extraction.page,
        method: page.extraction.method,
        printedPage: evidence?.printedPage ?? null,
        printedPageConfidence: evidence?.confidence ?? null,
        printedPageEvidence: evidence?.sourceLine ?? null,
        charCount: page.extraction.quality.charCount,
        qualityScore: page.extraction.quality.score,
        flags:
          page.headerArtifactCount > 0
            ? [...page.extraction.quality.flags, 'HEADER_ARTIFACT_DROPPED']
            : page.extraction.quality.flags,
        pageImageAssetId: page.extraction.pageImageAssetId,
        renderMs: page.extraction.renderMs,
        ocrMs: page.extraction.ocrMs,
        cached: cacheHits.has(page.extraction.page),
        headerArtifactCount: page.headerArtifactCount,
      });
      const printedPage = evidence?.printedPage ?? null;
      const verification = {
        state: 'unverified' as const,
        actorKind: null,
        checkedAt: null,
        notes: 'importer: machine extraction, awaiting review',
      };
      for (const block of page.blocks) {
        const sourceRef: SourceRef = {
          schemaVersion: 1,
          id: block.sourceRefId,
          bookInstanceId: stored.bookInstanceId,
          baselineSourceId: stored.baselineSourceId,
          pdfPage: block.page,
          printedPage,
          bbox: block.bbox,
          blockId: block.blockId,
          figureId: null,
          verification,
        };
        const sourceBlock: SourceBlock = {
          schemaVersion: 1,
          id: block.blockId,
          sourceRefId: block.sourceRefId,
          type: block.type,
          originalText: block.originalText,
          revisedText: block.revisedText,
          extractionMethod: block.extractionMethod,
          textConfidence: block.textConfidence,
          reviewState: block.reviewState,
        };
        if (!validateSourceRef(sourceRef).ok || !validateSourceBlock(sourceBlock).ok) {
          throw ImporterFailure.of('UNSUPPORTED', { detailsRef: `validator:${block.blockId}` });
        }
        blocks.push({ sourceRef, block: sourceBlock });
      }
      for (const figure of page.figures) {
        const sourceRef: SourceRef = {
          schemaVersion: 1,
          id: figure.sourceRefId,
          bookInstanceId: stored.bookInstanceId,
          baselineSourceId: stored.baselineSourceId,
          pdfPage: figure.page,
          printedPage,
          bbox: figure.captionBbox,
          blockId: null,
          figureId: figure.figureId,
          verification,
        };
        const figureEntity: Figure = {
          schemaVersion: 1,
          id: figure.figureId,
          sourceRefId: figure.sourceRefId,
          type: figure.type,
          originalAssetId: figure.originalAssetId,
          activeAssetId: figure.activeAssetId,
          caption: figure.caption,
          extractionMethod: figure.extractionMethod,
          reviewState: figure.extractionMethod === 'ocr' ? 'candidate' : 'machine_checked',
        };
        if (!validateSourceRef(sourceRef).ok || !validateFigure(figureEntity).ok) {
          throw ImporterFailure.of('UNSUPPORTED', { detailsRef: `validator:${figure.figureId}` });
        }
        figures.push({ sourceRef, figure: figureEntity });
      }
    }

    const tocCandidates = detectTocCandidates(pages.map((page) => page.extraction));
    return {
      jobId: stored.job.id,
      blocks,
      figures,
      tocCandidates,
      pageMap,
      revisions,
      bookInstanceId: stored.bookInstanceId,
      baselineSourceId: stored.baselineSourceId,
    };
  }

  /* ----------------------------------------------------------------- stages */

  private async tryCloudConcepts(
    stored: StoredJob,
    runtime: Runtime | null,
  ): Promise<{ readonly stored: StoredJob; readonly paused: boolean; readonly cancelled: boolean }> {
    const cancelledBefore = await this.cancelledState(stored, runtime);
    if (cancelledBefore !== null) {
      return { stored: cancelledBefore, paused: false, cancelled: true };
    }
    const network = this.deps.network?.status ?? 'available';
    const cloud = this.deps.cloudConcepts ?? null;
    if (cloud === null || network === 'unavailable') return { stored, paused: true, cancelled: false };
    const artifacts = await this.storage.readArtifacts(stored.job.id);
    if (artifacts === null) return { stored, paused: true, cancelled: false };
    const text = artifacts.blocks
      .map((row) => row.block.revisedText ?? row.block.originalText)
      .join('\n')
      .slice(0, 200_000);
    // The concepts stage starts the model call; a cancel before it must not even
    // announce the stage.
    const next = await this.transition(stored, { stage: 'concepts', status: 'running' });
    const cancelledAtStage = await this.cancelledState(next, runtime);
    if (cancelledAtStage !== null) {
      return { stored: cancelledAtStage, paused: false, cancelled: true };
    }
    try {
      const result = await cloud.extract({ jobId: stored.job.id, text, now: this.deps.clock.now() });
      // A cancel may arrive while the model call is in flight: the result is a
      // late stage result and may only go to the rejected-results ledger.
      const cancelledAfter = await this.cancelledState(next, runtime);
      if (cancelledAfter !== null) {
        await this.recordLateResult(next, {
          page: null,
          stage: 'concepts',
          reason: 'cancel-before-cloud-result',
        });
        return { stored: cancelledAfter, paused: false, cancelled: true };
      }
      const updated = await this.updateJob(next, {
        costUsage: {
          calls: next.job.costUsage.calls + 1,
          inputTokens: next.job.costUsage.inputTokens,
          outputTokens: next.job.costUsage.outputTokens,
          estimatedCostUsd: result.costUsd,
        },
      });
      if (updated.job.status === 'cancelled' || updated.cancelRequested) {
        await this.recordLateResult(next, {
          page: null,
          stage: 'concepts',
          reason: 'cancel-before-cost-commit',
        });
        return { stored: updated, paused: false, cancelled: true };
      }
      return { stored: updated, paused: false, cancelled: false };
    } catch (error) {
      const cancelledOnError = await this.cancelledState(next, runtime);
      if (cancelledOnError !== null) {
        await this.recordLateResult(next, {
          page: null,
          stage: 'concepts',
          reason: 'cancel-before-cloud-error',
        });
        return { stored: cancelledOnError, paused: false, cancelled: true };
      }
      return { stored: await this.failJob(next, classifyCloudError(error)), paused: false, cancelled: false };
    }
  }

  private async pauseForCloud(stored: StoredJob): Promise<StoredJob> {
    const cancelled = await this.cancelledState(stored, this.runtimeFor(stored.job.id));
    if (cancelled !== null) return cancelled;
    const info = importerError('CLOUD_EXTRACTION_PAUSED');
    const updated = await this.updateJob(stored, {
      status: 'paused',
      error: { code: info.code, message: info.message, retryable: info.retryable },
      retryable: true,
    });
    await this.emit(updated);
    return updated;
  }

  private async validateArtifacts(stored: StoredJob): Promise<ImporterErrorInfo | null> {
    const artifacts = await this.storage.readArtifacts(stored.job.id);
    if (artifacts === null) return importerError('CHECKPOINT_CORRUPT', { retryable: true });
    if (artifacts.pageMap.length !== stored.pageCount) {
      return importerError('CHECKPOINT_CORRUPT', { retryable: true });
    }
    for (const row of artifacts.blocks) {
      if (!validateSourceRef(row.sourceRef).ok) {
        return importerError('UNSUPPORTED', { detailsRef: `source-ref:${row.block.id}` });
      }
      if (!validateSourceBlock(row.block).ok) {
        return importerError('UNSUPPORTED', { detailsRef: `source-block:${row.block.id}` });
      }
    }
    return null;
  }

  /* ----------------------------------------------------------------- helpers */

  /**
   * Re-reads the job from disk and reports whether a cancel is now in effect
   * (either requested on disk or by the in-memory runtime). A cancelled import
   * must never publish another stage, status, cache entry or artifact; callers
   * use the returned fresh record only to finalize `cancelled`.
   */
  private async cancelledState(stored: StoredJob, runtime: Runtime | null): Promise<StoredJob | null> {
    const fresh = (await this.storage.readJob(stored.job.id)) ?? stored;
    const cancelled =
      runtime?.cancelRequested === true || fresh.cancelRequested || fresh.job.status === 'cancelled';
    if (!cancelled) return null;
    if (runtime !== null) runtime.cancelRequested = true;
    return fresh;
  }

  private runtimeFor(jobId: string): Runtime | null {
    return this.running.get(jobId) ?? null;
  }

  /** Only this ledger may be written after a cancel; never the job or artifacts. */
  private async recordLateResult(
    stored: StoredJob,
    input: { readonly page: number | null; readonly stage: ImportStage; readonly reason: string },
  ): Promise<void> {
    try {
      await this.storage.appendLateResult(stored.job.id, {
        page: input.page,
        stage: input.stage,
        at: this.deps.clock.now(),
        reason: input.reason,
      });
    } catch {
      /* the ledger is evidence, not the source of truth */
    }
  }

  private async transition(
    stored: StoredJob,
    patch: { readonly stage?: ImportJob['stage']; readonly status?: ImportJob['status'] },
  ): Promise<StoredJob> {
    const cancelled = await this.cancelledState(stored, this.runtimeFor(stored.job.id));
    if (cancelled !== null) return cancelled;
    const next = applyImportProgress(stored.job, { ...patch, updatedAt: this.deps.clock.now() });
    if (!next.ok) throw ImporterFailure.of('UNSUPPORTED', { detailsRef: 'state-transition' });
    const updated: StoredJob = {
      ...stored,
      job: { ...next.value, checkpoint: { ...next.value.checkpoint, stage: next.value.stage } },
    };
    if (!validateImportJob(updated.job).ok) {
      throw ImporterFailure.of('UNSUPPORTED', { detailsRef: 'state-contract' });
    }
    await this.storage.writeJob(updated);
    await this.emit(updated);
    return updated;
  }

  private async updateJob(
    stored: StoredJob,
    patch: {
      readonly status?: ImportJob['status'];
      readonly error?: ImportJob['error'];
      readonly retryable?: boolean;
      readonly costUsage?: ImportJob['costUsage'];
      readonly completedUnits?: number;
      readonly checkpoint?: ImportJob['checkpoint'];
    },
  ): Promise<StoredJob> {
    const cancelled = await this.cancelledState(stored, this.runtimeFor(stored.job.id));
    if (cancelled !== null) return cancelled;
    const next = applyImportProgress(stored.job, { ...patch, updatedAt: this.deps.clock.now() });
    if (!next.ok) throw ImporterFailure.of('UNSUPPORTED', { detailsRef: 'state-patch' });
    // `applyImportProgress` (domain) does not carry costUsage: apply it here so
    // model stage accounting is not silently dropped.
    const updated: StoredJob = {
      ...stored,
      job: { ...next.value, costUsage: patch.costUsage ?? next.value.costUsage },
    };
    if (!validateImportJob(updated.job).ok) {
      throw ImporterFailure.of('UNSUPPORTED', { detailsRef: 'state-contract' });
    }
    await this.storage.writeJob(updated);
    return updated;
  }

  private async refreshProgress(stored: StoredJob): Promise<StoredJob> {
    const cancelled = await this.cancelledState(stored, this.runtimeFor(stored.job.id));
    if (cancelled !== null) return cancelled;
    // Progress counts pages extracted into the (sha256, parserVersion) cache, so
    // it is already correct before the structure stage writes page artifacts.
    const extracted = await this.storage.countCachedPages(stored.sha256);
    if (extracted <= stored.job.completedUnits) return stored;
    const updated = await this.updateJob(stored, {
      completedUnits: extracted,
      checkpoint: { ...stored.job.checkpoint, lastCompletedUnit: extracted },
    });
    await this.emit(updated);
    return updated;
  }

  private async failJob(stored: StoredJob, info: ImporterErrorInfo): Promise<StoredJob> {
    const cancelled = await this.cancelledState(stored, this.runtimeFor(stored.job.id));
    if (cancelled !== null) return cancelled;
    const updated = await this.updateJob(stored, {
      status: 'failed',
      error: { code: info.code, message: info.message, retryable: info.retryable },
      retryable: info.retryable,
    });
    await this.emit(updated);
    return updated;
  }

  private async finalizeCancelled(stored: StoredJob): Promise<StoredJob> {
    const updated: StoredJob = {
      ...stored,
      cancelRequested: true,
      job: { ...stored.job, status: 'cancelled', retryable: true, updatedAt: this.deps.clock.now() },
    };
    await this.storage.writeJob(updated);
    await this.emit(updated);
    return updated;
  }

  private async emit(stored: StoredJob): Promise<void> {
    const job = stored.job;
    const event: ImportEvent = {
      schemaVersion: 1,
      eventId: this.deps.ids.next('event'),
      topic: 'import.progress',
      jobId: job.id,
      stage: job.stage,
      status: job.status,
      completedUnits: job.completedUnits,
      totalUnits: job.totalUnits,
      payload: {
        page: job.checkpoint.lastCompletedUnit,
        method: null,
        message: job.error?.message ?? null,
        engine: stored.backendId,
      },
      at: this.deps.clock.now(),
    };
    try {
      await this.storage.appendEvent(job.id, event);
    } catch {
      /* the event log is evidence; the job file is the source of truth */
    }
    this.deps.onProgress?.(event);
  }
}

/* -------------------------------------------------------------------- utils */

function revisionOf(job: ImportJob): number {
  const parsed = Date.parse(job.updatedAt);
  return Number.isFinite(parsed) ? parsed : 1;
}

function serviceErrorParts(info: ImporterErrorInfo): [ServiceErrorCode, string, boolean] {
  const mapped = toServiceError(info);
  return [mapped.code, mapped.message, mapped.retryable];
}

function chunk<T>(items: readonly T[], size: number): T[][] {
  const out: T[][] = [];
  for (let index = 0; index < items.length; index += size) out.push(items.slice(index, index + size));
  return out;
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

async function readBinary(file: string): Promise<Uint8Array | null> {
  try {
    return new Uint8Array(await readFile(file));
  } catch {
    return null;
  }
}

/** Blocks are only used through the artifacts; kept for callers that need it. */
export type { BlockRecord, ImportBackend, ImportRequest };
