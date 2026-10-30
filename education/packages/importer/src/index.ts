/**
 * @edu/importer public API (T03).
 *
 * Zero third-party runtime dependencies: PDF parsing uses Node built-ins and
 * OCR uses Windows system components, so the package can be shipped inside the
 * packaged app without extra binaries (see `materials.ts` for the T16 list).
 */

export {
  IMPORTER_ERROR_CODES,
  ImporterFailure,
  fail,
  importerError,
  ok,
  storageError,
  type ImporterErrorCode,
  type ImporterErrorInfo,
  type ImporterResult,
} from './errors.js';

export * from './import/types.js';

export { ImportService, toServiceError } from './import/service.js';
export { ImportStorage, stableStringify } from './import/storage.js';
export {
  FileAssetStore,
  isInsideRoots,
  sha256Bytes,
  sha256File,
  verifyManagedAsset,
  type VerifiedAsset,
} from './assets.js';
export { PdfDocumentBackend } from './engines/pdf-backend.js';
export { WindowsOcrPort, resolvePowerShellPath } from './engines/windows-ocr.js';
export { FakeOcrPort, DEFAULT_FAKE_LINES, type FakeOcrPage, type FakeOcrOptions } from './engines/fake-ocr.js';
export type { OcrPort, OcrRequest } from './engines/ocr-port.js';
export { PdfDocument } from './pdf/document.js';
export { extractTextLayer, parseToUnicodeCMap, type TextLayerPage, type TextLine } from './pdf/text.js';
export { encodeGrayscalePng, readPngSize } from './util/png.js';
export {
  matchBookIdentity,
  type BookMetadata,
  type KnownBook,
  type MatchInput,
  type MatchKind,
  type MatchResult,
} from './matching.js';
export {
  ENGINE_MATERIALS,
  buildEngineStatus,
  materialInventory,
  type EngineMaterial,
  type EngineStatus,
  type MaterialKind,
} from './materials.js';
export {
  Importer,
  ImporterRegistrationError,
  createImporter,
  importerFeature,
  importerFeatureModule,
  registerEducationFeature,
  type ImporterFacade,
  type ImporterOptions,
  type ImporterRegistrationContext,
  type ImporterRegistrationServices,
} from './importer.js';
