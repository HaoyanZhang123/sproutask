/**
 * T04 knowledge error surface.
 *
 * The frozen service envelope (05 §6) only allows a closed set of
 * `ServiceErrorCode` values, so knowledge-level failures carry a
 * domain specific `code` (explicit, documented, testable) plus the service
 * code the port adapter must use. Callers therefore never have to parse
 * message strings to branch on "page out of range" vs "unknown book".
 */

import type { Issue, IssueCode, ServiceError, ServiceErrorCode } from '@edu/domain';

/** Issue codes T04 adds on top of the frozen domain issue vocabulary. */
export const T04_ISSUE_CODES = [
  'COVERAGE_TOTALS_MISMATCH',
  'COVERAGE_TARGET_MISSING_SECTION',
  'COVERAGE_EXCLUSION_REASON_MISSING',
  'COVERAGE_EXCLUSION_DUPLICATE',
  'FULL_VOLUME_CLAIM_INVALID',
  'REVIEW_TRANSITION_INVALID',
  'COMPATIBILITY_DIFF_UNCOVERED',
  'COMPATIBILITY_STRONG_CLAIM',
  'COMPATIBILITY_HASH_MISMATCH',
  'PUBLISH_REQUIRES_CURATOR',
] as const;

export type T04IssueCode = (typeof T04_ISSUE_CODES)[number];
export type KnowledgeIssueCode = IssueCode | T04IssueCode;

export interface KnowledgeIssue {
  readonly code: KnowledgeIssueCode;
  readonly path: string;
  readonly message: string;
}

export const KNOWLEDGE_ERROR_CODES = [
  'INVALID_QUERY',
  'PACK_INVALID',
  'PACK_NOT_FOUND',
  'CONCEPT_NOT_FOUND',
  'TOC_NODE_NOT_FOUND',
  'SOURCE_REF_NOT_FOUND',
  'BOOK_INSTANCE_NOT_FOUND',
  'BLOCK_NOT_FOUND',
  'BLOCK_NOT_IN_SOURCE',
  'FIGURE_NOT_FOUND',
  'FIGURE_NOT_IN_SOURCE',
  'PDF_PAGE_OUT_OF_RANGE',
  'PAGE_COUNT_UNKNOWN',
  'BBOX_INVALID',
  'BBOX_OUT_OF_RANGE',
  'ASSET_NOT_MANAGED',
  'ASSET_NOT_FOUND',
  'BASELINE_SOURCE_NOT_LOCAL',
  'PACK_ALREADY_PUBLISHED',
  'PACK_CONTENT_HASH_MISMATCH',
  'PACK_IMMUTABLE',
  'REVIEW_TRANSITION_INVALID',
  'COVERAGE_INVALID',
  'COMPATIBILITY_MISMATCH',
  'COMPATIBILITY_DIFF_UNCOVERED',
  'COMPATIBILITY_MAP_NOT_FOUND',
  'CONCEPT_STATE_NOT_PUBLISHED',
  'PACK_NOT_USABLE',
  'PUBLISH_REQUIRES_CURATOR',
] as const;

export type KnowledgeErrorCode = (typeof KNOWLEDGE_ERROR_CODES)[number];

export interface KnowledgeError {
  readonly code: KnowledgeErrorCode;
  /** Frozen port envelope code this failure maps to. */
  readonly serviceCode: ServiceErrorCode;
  readonly message: string;
  readonly retryable: boolean;
  readonly path?: string;
  readonly issues?: readonly KnowledgeIssue[];
}

export type KnowledgeResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: KnowledgeError };

export type BuildResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly issues: readonly KnowledgeIssue[] };

const SERVICE_CODE_MAP: Record<KnowledgeErrorCode, ServiceErrorCode> = {
  INVALID_QUERY: 'INVALID_INPUT',
  PACK_INVALID: 'VALIDATION_FAILED',
  PACK_NOT_FOUND: 'NOT_FOUND',
  CONCEPT_NOT_FOUND: 'NOT_FOUND',
  TOC_NODE_NOT_FOUND: 'NOT_FOUND',
  SOURCE_REF_NOT_FOUND: 'NOT_FOUND',
  BOOK_INSTANCE_NOT_FOUND: 'NOT_FOUND',
  BLOCK_NOT_FOUND: 'NOT_FOUND',
  BLOCK_NOT_IN_SOURCE: 'VALIDATION_FAILED',
  FIGURE_NOT_FOUND: 'NOT_FOUND',
  FIGURE_NOT_IN_SOURCE: 'VALIDATION_FAILED',
  PDF_PAGE_OUT_OF_RANGE: 'INVALID_INPUT',
  PAGE_COUNT_UNKNOWN: 'UNSUPPORTED',
  BBOX_INVALID: 'INVALID_INPUT',
  BBOX_OUT_OF_RANGE: 'INVALID_INPUT',
  ASSET_NOT_MANAGED: 'INVALID_INPUT',
  ASSET_NOT_FOUND: 'NOT_FOUND',
  BASELINE_SOURCE_NOT_LOCAL: 'UNSUPPORTED',
  PACK_ALREADY_PUBLISHED: 'CONFLICT',
  PACK_CONTENT_HASH_MISMATCH: 'VALIDATION_FAILED',
  PACK_IMMUTABLE: 'CONFLICT',
  REVIEW_TRANSITION_INVALID: 'CONTRACT_REJECTED',
  COVERAGE_INVALID: 'CONTRACT_REJECTED',
  COMPATIBILITY_MISMATCH: 'VALIDATION_FAILED',
  COMPATIBILITY_DIFF_UNCOVERED: 'CONTRACT_REJECTED',
  COMPATIBILITY_MAP_NOT_FOUND: 'NOT_FOUND',
  CONCEPT_STATE_NOT_PUBLISHED: 'CONTRACT_REJECTED',
  PACK_NOT_USABLE: 'CONTRACT_REJECTED',
  PUBLISH_REQUIRES_CURATOR: 'CONTRACT_REJECTED',
};

export function knowledgeIssue(
  code: KnowledgeIssueCode,
  path: string,
  message: string,
): KnowledgeIssue {
  return { code, path, message };
}

export function issuesFromDomain(issues: readonly Issue[]): readonly KnowledgeIssue[] {
  return issues.map((entry) => ({ code: entry.code, path: entry.path, message: entry.message }));
}

export function knowledgeError(
  code: KnowledgeErrorCode,
  message: string,
  options: { readonly path?: string; readonly retryable?: boolean; readonly issues?: readonly KnowledgeIssue[] } = {},
): KnowledgeError {
  const base: KnowledgeError = {
    code,
    serviceCode: SERVICE_CODE_MAP[code],
    message,
    retryable: options.retryable ?? false,
  };
  const withPath = options.path === undefined ? base : { ...base, path: options.path };
  return options.issues === undefined ? withPath : { ...withPath, issues: options.issues };
}

export function okValue<T>(value: T): KnowledgeResult<T> {
  return { ok: true, value };
}

export function failValue<T>(error: KnowledgeError): KnowledgeResult<T> {
  return { ok: false, error };
}

export function failBuild<T>(issues: readonly KnowledgeIssue[]): BuildResult<T> {
  return { ok: false, issues };
}

export function okBuild<T>(value: T): BuildResult<T> {
  return { ok: true, value };
}

export function packInvalidFromIssues(
  issues: readonly KnowledgeIssue[],
  message = 'content pack failed validation',
): KnowledgeError {
  return knowledgeError('PACK_INVALID', message, { issues });
}

/** Maps a knowledge result onto the frozen `ServiceResult` envelope. */
export function toServiceResult<T>(
  result: KnowledgeResult<T>,
  revision: number,
): { readonly ok: true; readonly data: T; readonly revision: number } | { readonly ok: false; readonly error: ServiceError } {
  if (result.ok) return { ok: true, data: result.value, revision };
  return { ok: false, error: toServiceError(result.error) };
}

export function toServiceError(error: KnowledgeError): ServiceError {
  const base = {
    code: error.serviceCode,
    message: error.message,
    retryable: error.retryable,
  };
  return error.path === undefined ? base : { ...base, detailsRef: `knowledge:${error.path}` };
}
