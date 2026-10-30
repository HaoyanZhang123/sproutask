/**
 * Pure-Node document backend: PDF structure probe and text-layer extraction.
 * OCR is delegated to an `OcrPort` (Windows WinRT for real runs, deterministic
 * fake for tests), so "text layer first, OCR only for scanned pages" stays a
 * single decision point in the pipeline.
 */

import { readFile } from 'node:fs/promises';

import type { NormalizedBBox } from '@edu/domain';

import { ImporterFailure, importerError, type ImporterErrorInfo } from '../errors.js';
import type {
  ImportBackend,
  OcrAvailability,
  OcrOptions,
  OcrPageOutcome,
  PdfProbe,
  TextLayerPageLike,
} from '../import/types.js';
import { PdfDocument } from '../pdf/document.js';
import { extractTextLayer } from '../pdf/text.js';
import type { OcrPort } from './ocr-port.js';

export interface PdfBackendOptions {
  readonly ocr: OcrPort;
  readonly backendId?: string;
}

function toImporterError(error: unknown): ImporterErrorInfo {
  if (error instanceof ImporterFailure) return error.info;
  const code = (error as { info?: { code?: string } } | null)?.info?.code;
  if (code === 'PDF_CORRUPT' || code === 'PDF_ENCRYPTED' || code === 'PDF_NO_PAGES' || code === 'UNSUPPORTED') {
    return importerError(code);
  }
  return importerError('PDF_READ_FAILED');
}

export class PdfDocumentBackend implements ImportBackend {
  readonly id: string;
  private readonly ocr: OcrPort;
  private readonly documents = new Map<string, Promise<PdfDocument>>();

  constructor(options: PdfBackendOptions) {
    this.ocr = options.ocr;
    this.id = options.backendId ?? `node-pdf+${options.ocr.id}`;
  }

  private document(absolutePath: string): Promise<PdfDocument> {
    const cached = this.documents.get(absolutePath);
    if (cached !== undefined) return cached;
    const loaded = readFile(absolutePath).then((bytes) => PdfDocument.open(bytes));
    this.documents.set(absolutePath, loaded);
    return loaded;
  }

  async probePdf(absolutePath: string): Promise<PdfProbe> {
    const doc = await this.document(absolutePath);
    const size = (await readFile(absolutePath)).length;
    return {
      pageCount: doc.info.pageCount,
      encrypted: doc.info.encrypted,
      recoveredXref: doc.info.recovered,
      headerVersion: doc.info.headerVersion,
      title: doc.info.title,
      producer: doc.info.producer,
      creator: doc.info.creator,
      sizeBytes: size,
    };
  }

  async readTextLayer(absolutePath: string, page: number): Promise<TextLayerPageLike> {
    const doc = await this.document(absolutePath);
    const extracted = extractTextLayer(doc, page);
    return {
      available: extracted.available,
      reason: extracted.reason,
      lines: extracted.lines.map((line) => ({
        text: line.text,
        bbox: line.bbox as NormalizedBBox,
        fontSize: line.fontSize,
      })),
      glyphCount: extracted.glyphCount,
      undecodableGlyphs: extracted.undecodableGlyphs,
    };
  }

  async ocrAvailability(): Promise<OcrAvailability> {
    return this.ocr.availability();
  }

  async ocrPages(
    request: {
      readonly absolutePath: string;
      readonly pages: readonly number[];
      readonly options: OcrOptions;
      readonly assetFor: (page: number) => { readonly assetId: string; readonly absolutePath: string };
      readonly workDir: string;
      readonly shouldStop: () => boolean;
    },
    onPage: (outcome: OcrPageOutcome) => void,
  ): Promise<{ readonly availability: OcrAvailability; readonly unprocessedPages: readonly number[] }> {
    return this.ocr.ocrPages(request, onPage);
  }
}

/** Error helper shared by the engines. */
export function pageError(page: number, error: ImporterErrorInfo): OcrPageOutcome {
  return { ok: false, page, error };
}
