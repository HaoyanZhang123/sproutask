/**
 * Deterministic OCR port for offline tests.
 *
 * Tests must not depend on the 40 MB textbook: the fake returns fixed OCR lines
 * (including the real engine's known CJK space-quirk) and writes a real PNG for
 * the page image so the asset path is exercised end to end.
 */

import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { importerError } from '../errors.js';
import type { OcrAvailability, OcrLine, OcrPageOutcome } from '../import/types.js';
import { encodeGrayscalePng } from '../util/png.js';
import type { OcrPort, OcrRequest } from './ocr-port.js';

export interface FakeOcrLine {
  readonly text: string;
  readonly box: { readonly x: number; readonly y: number; readonly width: number; readonly height: number };
}

export type FakeOcrFailure = 'OCR_FAILED' | 'RATE_LIMIT' | 'AUTH_FAILED' | 'NETWORK';

export interface FakeOcrPage {
  readonly page: number;
  readonly lines?: readonly FakeOcrLine[];
  readonly failure?: FakeOcrFailure;
  readonly delayMs?: number;
  /** Ignores a cancel that already happened (used to prove late results are dropped). */
  readonly deliverAfterCancel?: boolean;
}

export interface FakeOcrOptions {
  readonly pages?: readonly FakeOcrPage[];
  readonly defaultLines?: readonly FakeOcrLine[];
  readonly imageSize?: { readonly width: number; readonly height: number };
  readonly unavailable?: 'ENGINE_MISSING' | 'LANGUAGE_MISSING' | null;
  /** Deterministic test hook: runs before a page is "recognized". */
  readonly beforePage?: (page: number) => Promise<void> | void;
  readonly writeImages?: boolean;
  readonly engine?: string;
  readonly language?: string;
}

export const DEFAULT_FAKE_LINES: readonly FakeOcrLine[] = [
  { text: '第 1 单 元 生 物 和 生 物 圈', box: { x: 200, y: 180, width: 1200, height: 60 } },
  { text: '图 1-1 显 微 镜 的 结 构', box: { x: 240, y: 900, width: 900, height: 44 } },
  { text: '12', box: { x: 760, y: 2090, width: 40, height: 30 } },
];

function failureToError(failure: FakeOcrFailure) {
  switch (failure) {
    case 'RATE_LIMIT':
      return importerError('CLOUD_RATE_LIMITED');
    case 'AUTH_FAILED':
      return importerError('CLOUD_AUTH_FAILED');
    case 'NETWORK':
      return importerError('PAGE_OCR_FAILED', { retryable: true, detailsRef: 'network' });
    case 'OCR_FAILED':
    default:
      return importerError('PAGE_OCR_FAILED');
  }
}

export class FakeOcrPort implements OcrPort {
  readonly id = 'fake-ocr';
  /** Pages handed to the engine, in call order (test evidence that cache was used). */
  readonly ocrRequests: number[] = [];
  private readonly pages: Map<number, FakeOcrPage>;
  private readonly options: FakeOcrOptions;

  constructor(options: FakeOcrOptions = {}) {
    this.options = options;
    this.pages = new Map((options.pages ?? []).map((page) => [page.page, page]));
  }

  async availability(): Promise<OcrAvailability> {
    if (this.options.unavailable != null) {
      return {
        available: false,
        engine: null,
        language: null,
        reason: this.options.unavailable,
      };
    }
    return {
      available: true,
      engine: this.options.engine ?? 'fake-ocr',
      language: this.options.language ?? 'zh-Hans-CN',
      reason: null,
    };
  }

  async ocrPages(
    request: OcrRequest,
    onPage: (outcome: OcrPageOutcome) => void,
  ): Promise<{ readonly availability: OcrAvailability; readonly unprocessedPages: readonly number[] }> {
    const availability = await this.availability();
    if (!availability.available) {
      for (const page of request.pages) {
        onPage({
          ok: false,
          page,
          error: importerError(
            availability.reason === 'LANGUAGE_MISSING' ? 'OCR_LANGUAGE_UNAVAILABLE' : 'OCR_ENGINE_UNAVAILABLE',
          ),
        });
      }
      return { availability, unprocessedPages: [] };
    }
    const unprocessed: number[] = [];
    const imageSize = this.options.imageSize ?? { width: 1600, height: 2200 };
    for (const pageNumber of request.pages) {
      this.ocrRequests.push(pageNumber);
      const spec = this.pages.get(pageNumber);
      const stop = request.shouldStop() && spec?.deliverAfterCancel !== true;
      if (stop) {
        unprocessed.push(pageNumber);
        continue;
      }
      if (this.options.beforePage !== undefined) await this.options.beforePage(pageNumber);
      if (spec?.delayMs !== undefined && spec.delayMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, spec.delayMs));
      }
      if (spec?.failure !== undefined) {
        onPage({ ok: false, page: pageNumber, error: failureToError(spec.failure) });
        continue;
      }
      const lines = spec?.lines ?? this.options.defaultLines ?? DEFAULT_FAKE_LINES;
      let imagePath: string | null = null;
      if (request.options.savePageImages && this.options.writeImages !== false) {
        imagePath = request.assetFor(pageNumber).absolutePath;
        await mkdir(path.dirname(imagePath), { recursive: true });
        const png = encodeGrayscalePng(imageSize.width, imageSize.height, (x, y) =>
          (x + y) % 97 === 0 ? 40 : 245,
        );
        await writeFile(imagePath, png);
      }
      onPage({
        ok: true,
        page: {
          page: pageNumber,
          lines: lines.map<OcrLine>((line) => ({ text: line.text, box: line.box })),
          imageWidth: imageSize.width,
          imageHeight: imageSize.height,
          engine: availability.engine ?? 'fake-ocr',
          language: availability.language ?? 'zh-Hans-CN',
          renderMs: 1,
          ocrMs: 1,
          pageImagePath: imagePath,
        },
      });
    }
    return { availability, unprocessedPages: unprocessed };
  }
}
