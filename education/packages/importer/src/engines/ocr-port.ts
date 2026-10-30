/**
 * OCR engine port. The importer core never talks to an OS API directly: the
 * Windows WinRT backend, the deterministic test backend and any future engine
 * implement this interface, so the pipeline can be exercised offline.
 */

import type { Id } from '@edu/domain';

import type { OcrAvailability, OcrOptions, OcrPageOutcome } from '../import/types.js';

export interface OcrRequest {
  readonly absolutePath: string;
  readonly pages: readonly number[];
  readonly options: OcrOptions;
  readonly assetFor: (page: number) => { readonly assetId: Id; readonly absolutePath: string };
  readonly workDir: string;
  readonly shouldStop: () => boolean;
}

export interface OcrPort {
  readonly id: string;
  availability(): Promise<OcrAvailability>;
  ocrPages(
    request: OcrRequest,
    onPage: (outcome: OcrPageOutcome) => void,
  ): Promise<{ readonly availability: OcrAvailability; readonly unprocessedPages: readonly number[] }>;
}
