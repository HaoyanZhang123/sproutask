/**
 * Public importer facade (06 §2 service registration, 05 §6 ports).
 *
 * Consumers get:
 *   - `createImporter(deps)`             full service (start/status/cancel/resume/retry/artifacts)
 *   - `importer.port`                    the frozen `ImportPort` shape for the composition root
 *   - `importer.registerEducationFeature` the T01 feature module factory
 *
 * T09/T05 read `artifacts()` / `pageMap()` / `pageArtifacts()`; they never touch
 * the local job files directly.
 */

import {
  FEATURE_API_VERSION,
  type ImportJob,
  type ImportPort,
  type ImportStartRequest,
  type RequestContext,
  type ServiceResult,
} from '@edu/domain';

import { ImportService } from './import/service.js';
import { ImportStorage } from './import/storage.js';
import type {
  ImportArtifacts,
  ImportEvent,
  ImporterDependencies,
  PageArtifacts,
  PageMapRow,
  RetryOptions,
  RetryOutcome,
} from './import/types.js';
import { buildEngineStatus, type EngineStatus } from './materials.js';

export interface ImporterFacade {
  start(ctx: RequestContext, request: ImportStartRequest): Promise<ServiceResult<ImportJob>>;
  status(ctx: RequestContext, jobId: string): Promise<ServiceResult<ImportJob>>;
  cancel(ctx: RequestContext, jobId: string): Promise<ServiceResult<ImportJob>>;
  resume(ctx: RequestContext, jobId: string): Promise<ServiceResult<ImportJob>>;
  retry(
    ctx: RequestContext,
    jobId: string,
    options?: RetryOptions,
  ): Promise<ServiceResult<RetryOutcome>>;
  artifacts(ctx: RequestContext, jobId: string): Promise<ServiceResult<ImportArtifacts>>;
  pageMap(ctx: RequestContext, jobId: string): Promise<ServiceResult<readonly PageMapRow[]>>;
  pageArtifacts(
    ctx: RequestContext,
    jobId: string,
    page: number,
  ): Promise<ServiceResult<PageArtifacts>>;
  engineStatus(): Promise<EngineStatus>;
  readonly port: ImportPort;
}

export interface ImporterOptions extends ImporterDependencies {
  /** Optional progress tap shared with the realtime `import.progress` topic. */
  readonly onEvent?: (event: ImportEvent) => void;
}

export class Importer implements ImporterFacade {
  readonly service: ImportService;
  readonly storage: ImportStorage;
  private readonly deps: ImporterOptions;

  constructor(deps: ImporterOptions) {
    this.deps = deps;
    this.service = new ImportService(
      deps.onEvent === undefined
        ? deps
        : {
            ...deps,
            onProgress: (event) => {
              deps.onProgress?.(event);
              deps.onEvent?.(event);
            },
          },
    );
    this.storage = new ImportStorage(deps.paths.rootDir);
  }

  private ctx(input: RequestContext): { requestId: string; now: string } {
    return { requestId: input.requestId, now: input.now };
  }

  async start(ctx: RequestContext, request: ImportStartRequest): Promise<ServiceResult<ImportJob>> {
    return this.service.start(this.ctx(ctx), request);
  }

  async status(ctx: RequestContext, jobId: string): Promise<ServiceResult<ImportJob>> {
    return this.service.status(this.ctx(ctx), jobId);
  }

  async cancel(ctx: RequestContext, jobId: string): Promise<ServiceResult<ImportJob>> {
    return this.service.cancel(this.ctx(ctx), jobId);
  }

  async resume(ctx: RequestContext, jobId: string): Promise<ServiceResult<ImportJob>> {
    return this.service.resume(this.ctx(ctx), jobId);
  }

  async retry(
    ctx: RequestContext,
    jobId: string,
    options: RetryOptions = {},
  ): Promise<ServiceResult<RetryOutcome>> {
    return this.service.retry(this.ctx(ctx), jobId, options);
  }

  async artifacts(ctx: RequestContext, jobId: string): Promise<ServiceResult<ImportArtifacts>> {
    return this.service.artifacts(this.ctx(ctx), jobId);
  }

  async pageMap(ctx: RequestContext, jobId: string): Promise<ServiceResult<readonly PageMapRow[]>> {
    return this.service.pageMap(this.ctx(ctx), jobId);
  }

  async pageArtifacts(
    ctx: RequestContext,
    jobId: string,
    page: number,
  ): Promise<ServiceResult<PageArtifacts>> {
    return this.service.pageArtifacts(this.ctx(ctx), jobId, page);
  }

  async engineStatus(): Promise<EngineStatus> {
    return buildEngineStatus({
      backendId: this.deps.backend.id,
      ocr: await this.deps.backend.ocrAvailability(),
      ocrOptions: this.service.ocrOptions,
    });
  }

  /** The frozen `ImportPort` view used by the composition root (T13). */
  get port(): ImportPort {
    return {
      start: (ctx, request) => this.start(ctx, request),
      status: (ctx, jobId) => this.status(ctx, jobId),
      cancel: (ctx, jobId) => this.cancel(ctx, jobId),
      resume: (ctx, jobId) => this.resume(ctx, jobId),
    };
  }
}

export function createImporter(deps: ImporterOptions): Importer {
  return new Importer(deps);
}

/**
 * T01 feature module. The importer owns no pages and no host registration file:
 * it only asserts that the composition root wired `services.imports` to this
 * importer (or another ImportPort implementation).
 */
export const importerFeature = {
  id: '@edu/importer',
  version: '0.1.0',
  apiVersion: FEATURE_API_VERSION,
  requiredCapabilities: [] as const,
  description:
    'Managed PDF import: text layer first, per-page OCR fallback, page/printed-page separation, resumable cached jobs.',
} as const;

export interface ImporterRegistrationServices {
  readonly imports: ImportPort | null;
}

export interface ImporterRegistrationContext {
  readonly pages: { registerPage?: unknown };
}

export class ImporterRegistrationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ImporterRegistrationError';
  }
}

export function registerEducationFeature(
  context: ImporterRegistrationContext,
  services: ImporterRegistrationServices,
): void {
  void context;
  if (services.imports === null) {
    throw new ImporterRegistrationError(
      '@edu/importer requires the composition root to provide EducationServices.imports (ImportPort); it registers no UI pages of its own.',
    );
  }
}

export const importerFeatureModule = {
  feature: importerFeature,
  registerEducationFeature,
};
