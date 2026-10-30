/**
 * Importer error taxonomy.
 *
 * Every failure leaves this package as an explicit code plus a student-facing
 * Chinese message and a retryable flag; no bare exception crosses the public
 * boundary (05 §6 error envelope, A29 failure visibility). Codes are stable
 * English identifiers, messages are what a student/app shell shows.
 */

export const IMPORTER_ERROR_CODES = [
  /** The caller passed something that is not a host-managed asset handle. */
  'ASSET_HANDLE_INVALID',
  /** The handle resolved to a path outside the allowed managed roots. */
  'ASSET_PATH_OUTSIDE_ROOT',
  'ASSET_NOT_FOUND',
  'ASSET_NOT_A_FILE',
  /** The bytes on disk no longer match the declared hash. */
  'ASSET_HASH_MISMATCH',
  /** Confirmed metadata disagrees with the file (page count etc.). */
  'ASSET_METADATA_MISMATCH',
  'PDF_CORRUPT',
  'PDF_ENCRYPTED',
  'PDF_NO_PAGES',
  'PDF_READ_FAILED',
  /** Text layer exists but cannot be decoded (font encoding/CID without map). */
  'TEXT_LAYER_UNAVAILABLE',
  'OCR_ENGINE_UNAVAILABLE',
  'OCR_LANGUAGE_UNAVAILABLE',
  'PAGE_RENDER_FAILED',
  'PAGE_OCR_FAILED',
  'JOB_NOT_FOUND',
  'JOB_CANCELLED',
  /** A page/stage result finished after cancel and must not be published. */
  'LATE_RESULT_REJECTED',
  'CHECKPOINT_CORRUPT',
  'CHECKPOINT_VERSION_MISMATCH',
  /** Local stages finished, but model extraction needs a cloud route. */
  'CLOUD_EXTRACTION_PAUSED',
  'CLOUD_AUTH_FAILED',
  'CLOUD_RATE_LIMITED',
  'STORAGE_FULL',
  'STORAGE_WRITE_FAILED',
  'INPUT_MISSING',
  'UNSUPPORTED',
] as const;

export type ImporterErrorCode = (typeof IMPORTER_ERROR_CODES)[number];

export interface ImporterErrorInfo {
  readonly code: ImporterErrorCode;
  /** Student-facing Chinese message. Never contains a raw path, stack or secret. */
  readonly message: string;
  readonly retryable: boolean;
  /** Local evidence reference, never a secret. */
  readonly detailsRef?: string;
}

const MESSAGES: Record<ImporterErrorCode, { message: string; retryable: boolean }> = {
  ASSET_HANDLE_INVALID: {
    message: '导入来源无效：只接受应用托管的教材文件，不能直接读取任意路径。',
    retryable: false,
  },
  ASSET_PATH_OUTSIDE_ROOT: {
    message: '导入来源不在允许的本地资料目录内，已拒绝读取。',
    retryable: false,
  },
  ASSET_NOT_FOUND: {
    message: '找不到这份教材文件，可能已被移动或删除。请重新选择文件。',
    retryable: false,
  },
  ASSET_NOT_A_FILE: {
    message: '选中的不是一个可读取的文件。',
    retryable: false,
  },
  ASSET_HASH_MISMATCH: {
    message: '教材文件内容与登记的信息不一致（文件已变化）。请重新导入。',
    retryable: false,
  },
  ASSET_METADATA_MISMATCH: {
    message: '确认的页数与文件实际页数不一致，请核对后重新确认。',
    retryable: false,
  },
  PDF_CORRUPT: {
    message: '这个 PDF 结构损坏，无法解析。请换一份可正常打开的 PDF。',
    retryable: false,
  },
  PDF_ENCRYPTED: {
    message: '这个 PDF 有密码保护，暂时不能导入。请先移除密码后再导入。',
    retryable: false,
  },
  PDF_NO_PAGES: {
    message: '这个 PDF 没有可用页面。',
    retryable: false,
  },
  PDF_READ_FAILED: {
    message: '读取 PDF 内容失败，可以稍后重试。',
    retryable: true,
  },
  TEXT_LAYER_UNAVAILABLE: {
    message: '这一页没有可用的文字层，已改用文字识别。',
    retryable: true,
  },
  OCR_ENGINE_UNAVAILABLE: {
    message: '本机没有可用的文字识别引擎，扫描页暂时无法识别。已保留页面图片。',
    retryable: true,
  },
  OCR_LANGUAGE_UNAVAILABLE: {
    message: '本机缺少中文文字识别语言包，扫描页暂时无法识别。',
    retryable: true,
  },
  PAGE_RENDER_FAILED: {
    message: '这一页渲染成图片失败，可以单独重试这一页。',
    retryable: true,
  },
  PAGE_OCR_FAILED: {
    message: '这一页文字识别失败，可以单独重试这一页。',
    retryable: true,
  },
  JOB_NOT_FOUND: {
    message: '找不到这个导入任务。',
    retryable: false,
  },
  JOB_CANCELLED: {
    message: '导入已取消，已完成的部分会保留。',
    retryable: true,
  },
  LATE_RESULT_REJECTED: {
    message: '导入已取消，之后到达的解析结果不会写入。',
    retryable: false,
  },
  CHECKPOINT_CORRUPT: {
    message: '导入进度记录损坏，可以从头重新解析（人工修订不会丢失）。',
    retryable: true,
  },
  CHECKPOINT_VERSION_MISMATCH: {
    message: '解析器版本变化，旧缓存不再复用，将重新解析。',
    retryable: true,
  },
  CLOUD_EXTRACTION_PAUSED: {
    message: '本地解析已完成；目录与概念抽取需要模型服务，当前离线已暂停，联网后可继续。',
    retryable: true,
  },
  CLOUD_AUTH_FAILED: {
    message: '模型服务鉴权失败，已保留本次导入的本地解析结果，登录后可继续。',
    retryable: true,
  },
  CLOUD_RATE_LIMITED: {
    message: '模型服务限流，稍后可继续；已完成的页面不会重复解析。',
    retryable: true,
  },
  STORAGE_FULL: {
    message: '磁盘空间不足，本次结果没有写入。清理空间后可以重试。',
    retryable: true,
  },
  STORAGE_WRITE_FAILED: {
    message: '写入本地解析结果失败，可以重试；已保存的页面不会重复解析。',
    retryable: true,
  },
  INPUT_MISSING: {
    message: '缺少必需的导入输入。',
    retryable: false,
  },
  UNSUPPORTED: {
    message: '暂不支持这项操作。',
    retryable: false,
  },
};

export function importerError(
  code: ImporterErrorCode,
  options: { readonly retryable?: boolean; readonly detailsRef?: string } = {},
): ImporterErrorInfo {
  const base = MESSAGES[code];
  const info: ImporterErrorInfo = {
    code,
    message: base.message,
    retryable: options.retryable ?? base.retryable,
    ...(options.detailsRef === undefined ? {} : { detailsRef: options.detailsRef }),
  };
  return info;
}

/** Thrown internally; public methods convert it into the error envelope. */
export class ImporterFailure extends Error {
  readonly info: ImporterErrorInfo;

  constructor(info: ImporterErrorInfo) {
    super(`${info.code}: ${info.message}`);
    this.name = 'ImporterFailure';
    this.info = info;
  }

  static of(code: ImporterErrorCode, options?: { retryable?: boolean; detailsRef?: string }): ImporterFailure {
    return new ImporterFailure(importerError(code, options));
  }
}

export type ImporterResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: ImporterErrorInfo };

export function ok<T>(value: T): ImporterResult<T> {
  return { ok: true, value };
}

export function fail<T = never>(info: ImporterErrorInfo): ImporterResult<T> {
  return { ok: false, error: info };
}

/** Maps a Node/fs error onto the importer taxonomy (disk full vs other write errors). */
export function storageError(cause: unknown): ImporterErrorInfo {
  const code = (cause as NodeJS.ErrnoException | null)?.code;
  if (code === 'ENOSPC' || code === 'EDQUOT') return importerError('STORAGE_FULL');
  return importerError('STORAGE_WRITE_FAILED');
}
