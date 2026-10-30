/**
 * Structured tutor errors (card T07: AUTH / QUOTA / UNSUPPORTED / NETWORK /
 * CANCELLED / INVALID_INPUT, plus the tool allowlist and stale-turn cases).
 *
 * Every error crossing the service/tool boundary is a value, never a thrown
 * stack trace. Student-facing messages never contain internals, credentials,
 * absolute paths or raw provider payloads.
 */

import type { ServiceError, ServiceResult } from '@edu/domain';
import { errResult } from '@edu/domain';
import type { TutorError, TutorErrorCode } from './types.js';

export class TutorException extends Error {
  readonly code: TutorErrorCode;
  readonly retryable: boolean;
  readonly detailsRef: string | undefined;

  constructor(code: TutorErrorCode, message: string, retryable = false, detailsRef?: string) {
    super(sanitizeMessage(message));
    this.name = 'TutorException';
    this.code = code;
    this.retryable = retryable;
    this.detailsRef = detailsRef;
  }
}

export function tutorError(
  code: TutorErrorCode,
  message: string,
  retryable = false,
  detailsRef?: string,
): TutorError {
  return detailsRef === undefined
    ? { code, message: sanitizeMessage(message), retryable }
    : { code, message: sanitizeMessage(message), retryable, detailsRef };
}

/** Removes absolute paths and credential-shaped fragments from a message. */
export function sanitizeMessage(message: string): string {
  const withoutWindowsPaths = message.replace(/[A-Za-z]:\\[^\s"']+/g, '<path>');
  const withoutTokens = withoutWindowsPaths.replace(/\b(Bearer|sk-)[A-Za-z0-9._-]{8,}/g, '<redacted>');
  return withoutTokens.slice(0, 400);
}

const DOMAIN_CODE_BY_TUTOR_CODE: Readonly<Record<TutorErrorCode, ServiceError['code']>> = {
  AUTH: 'UNAUTHORIZED',
  QUOTA: 'QUOTA_EXCEEDED',
  UNSUPPORTED: 'UNSUPPORTED',
  NETWORK: 'UNAVAILABLE',
  CANCELLED: 'CANCELLED',
  TIMEOUT: 'TIMEOUT',
  INVALID_INPUT: 'INVALID_INPUT',
  UNKNOWN_TOOL: 'INVALID_INPUT',
  FORBIDDEN: 'UNAUTHORIZED',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  STALE_REVISION: 'STALE_REVISION',
  CONTRACT_REJECTED: 'CONTRACT_REJECTED',
  STORAGE: 'STORAGE_FAILED',
};

const TUTOR_CODE_BY_DOMAIN_CODE: Partial<Record<ServiceError['code'], TutorErrorCode>> = {
  UNAUTHORIZED: 'AUTH',
  QUOTA_EXCEEDED: 'QUOTA',
  UNSUPPORTED: 'UNSUPPORTED',
  UNAVAILABLE: 'NETWORK',
  CANCELLED: 'CANCELLED',
  TIMEOUT: 'TIMEOUT',
  INVALID_INPUT: 'INVALID_INPUT',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  STALE_REVISION: 'STALE_REVISION',
  STORAGE_FAILED: 'STORAGE',
  VALIDATION_FAILED: 'INVALID_INPUT',
  DUPLICATE_REQUEST: 'CONFLICT',
  CONTRACT_REJECTED: 'CONTRACT_REJECTED',
  NOT_IMPLEMENTED: 'UNSUPPORTED',
};

export function toServiceError(error: TutorError): ServiceError {
  return error.detailsRef === undefined
    ? {
        code: DOMAIN_CODE_BY_TUTOR_CODE[error.code],
        message: error.message,
        retryable: error.retryable,
      }
    : {
        code: DOMAIN_CODE_BY_TUTOR_CODE[error.code],
        message: error.message,
        retryable: error.retryable,
        detailsRef: error.detailsRef,
      };
}

export function fromServiceError(error: ServiceError): TutorError {
  return tutorError(
    TUTOR_CODE_BY_DOMAIN_CODE[error.code] ?? 'CONFLICT',
    error.message,
    error.retryable,
    error.detailsRef,
  );
}

export function failWith<T>(error: TutorError): ServiceResult<T> {
  return errResult(toServiceError(error).code, error.message, error.retryable, error.detailsRef);
}

export function asServiceResultError<T>(error: TutorError): ServiceResult<T> {
  return { ok: false, error: toServiceError(error) };
}

/**
 * Maps a thrown adapter/transport error onto the contractual taxonomy.
 * Provider panels are only read for stable code names; their payload is never
 * echoed to the learner.
 */
export function errorFromThrown(error: unknown): TutorError {
  if (error instanceof TutorException) {
    return tutorError(error.code, error.message, error.retryable, error.detailsRef);
  }
  const value = error as {
    readonly name?: unknown;
    readonly code?: unknown;
    readonly status?: unknown;
    readonly message?: unknown;
  };
  const name = typeof value?.name === 'string' ? value.name : '';
  const code = typeof value?.code === 'string' ? value.code : '';
  const status = typeof value?.status === 'number' ? value.status : null;
  const message = typeof value?.message === 'string' ? value.message : String(error);

  if (name === 'AbortError' || code === 'ABORT_ERR' || code === 'CANCELLED') {
    return tutorError('CANCELLED', 'the request was cancelled');
  }
  if (code === 'INVALID_CREDENTIAL' || code === 'MISSING_CREDENTIAL' || code === 'UNAUTHORIZED') {
    return tutorError('AUTH', 'model authorization is not available');
  }
  if (code === 'QUOTA' || code === 'ACCOUNT_QUOTA' || code === 'RATE_LIMIT' || status === 402 || status === 429) {
    return tutorError('QUOTA', 'model quota or rate limit reached; retry later', true);
  }
  if (code === 'NO_ADAPTER' || code === 'FETCH_FAILED' || /fetch|network|ECONN|ENOTFOUND|ETIMEDOUT/i.test(code)) {
    return tutorError('NETWORK', 'the model route is unreachable; retry or continue offline', true);
  }
  if (code === 'IMAGE_OFFLOAD_REQUIRED') {
    return tutorError('UNSUPPORTED', 'the selected model route does not support this image request');
  }
  if (code === 'UNSUPPORTED' || code === 'NOT_IMPLEMENTED' || status === 400 || status === 404) {
    return tutorError('UNSUPPORTED', 'the model route does not support this request');
  }
  if (status === 401 || status === 403) {
    return tutorError('AUTH', 'model authorization failed');
  }
  return tutorError('NETWORK', `model request failed: ${sanitizeMessage(message)}`, true);
}

export function isCancelled(signal: { readonly cancelled: boolean } | undefined): boolean {
  return signal !== undefined && signal.cancelled;
}
