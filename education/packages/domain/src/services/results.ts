/**
 * Unified service result envelopes (05 §6).
 *
 * Every port method resolves to `{ok:true,data,revision}` or
 * `{ok:false,error:{code,message,retryable,detailsRef?}}`. Internal stack
 * traces and secrets never appear in the student facing message.
 */

export const SERVICE_ERROR_CODES = [
  'INVALID_INPUT',
  'VALIDATION_FAILED',
  'NOT_FOUND',
  'DUPLICATE_REQUEST',
  'STALE_REVISION',
  'CONFLICT',
  'CANCELLED',
  'TIMEOUT',
  'UNAVAILABLE',
  'UNAUTHORIZED',
  'QUOTA_EXCEEDED',
  'UNSUPPORTED',
  'NOT_IMPLEMENTED',
  'CONTRACT_REJECTED',
  'STORAGE_FAILED',
] as const;

export type ServiceErrorCode = (typeof SERVICE_ERROR_CODES)[number];

export interface ServiceError {
  readonly code: ServiceErrorCode;
  readonly message: string;
  readonly retryable: boolean;
  /** Reference to a local evidence/log record, never a secret or raw path. */
  readonly detailsRef?: string;
}

export type ServiceResult<T> =
  | { readonly ok: true; readonly data: T; readonly revision: number }
  | { readonly ok: false; readonly error: ServiceError };

export function okResult<T>(data: T, revision: number): ServiceResult<T> {
  return { ok: true, data, revision };
}

export function errResult<T>(
  code: ServiceErrorCode,
  message: string,
  retryable = false,
  detailsRef?: string,
): ServiceResult<T> {
  return {
    ok: false,
    error: detailsRef === undefined ? { code, message, retryable } : { code, message, retryable, detailsRef },
  };
}

export function isServiceOk<T>(
  result: ServiceResult<T>,
): result is { readonly ok: true; readonly data: T; readonly revision: number } {
  return result.ok;
}

export function isServiceError<T>(
  result: ServiceResult<T>,
): result is { readonly ok: false; readonly error: ServiceError } {
  return !result.ok;
}

export function mapServiceResult<T, U>(
  result: ServiceResult<T>,
  map: (data: T) => U,
): ServiceResult<U> {
  if (!result.ok) return result;
  return okResult(map(result.data), result.revision);
}

export function unwrapServiceResult<T>(result: ServiceResult<T>): T {
  if (!result.ok) {
    throw new Error(`service error ${result.error.code}: ${result.error.message}`);
  }
  return result.data;
}

export function isRetryable(result: ServiceResult<unknown>): boolean {
  return !result.ok && result.error.retryable;
}
