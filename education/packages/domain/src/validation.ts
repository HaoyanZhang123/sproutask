/**
 * Hand written runtime validation toolkit.
 *
 * The domain package intentionally has zero third party runtime dependencies,
 * so validators are composed from these small helpers instead of a schema
 * library. Every object reader rejects unknown keys: boundary payloads are
 * strict, only explicitly declared fields are accepted.
 */

import { SCHEMA_VERSION } from './versions.js';
import {
  isManagedAssetId,
  isOpaqueId,
  isPlainObject,
  isSha256,
  isValidRfc3339Utc,
  type NormalizedBBox,
  type Id,
} from './primitives.js';

export type IssueCode =
  | 'UNKNOWN_FIELD'
  | 'MISSING_FIELD'
  | 'INVALID_TYPE'
  | 'INVALID_ID'
  | 'INVALID_TIMESTAMP'
  | 'INVALID_HASH'
  | 'INVALID_ENUM'
  | 'INVALID_NUMBER'
  | 'INVALID_FORMAT'
  | 'INVALID_ASSET'
  | 'INVALID_BBOX'
  | 'INVALID_PAGE'
  | 'UNSAFE_CONTENT'
  | 'SCHEMA_VERSION_MISMATCH'
  | 'DUPLICATE_ID'
  | 'DANGLING_REFERENCE'
  | 'INVALID_REFERENCE'
  | 'COURSE_IDENTITY_UNVERIFIED'
  | 'TOC_INVALID_TREE'
  | 'TOC_CYCLE'
  | 'TOC_ORPHAN'
  | 'TOC_MULTIPLE_ROOTS'
  | 'TOC_TYPE_ORDER'
  | 'TOC_DUPLICATE_ORDER'
  | 'RELATION_SELF_LOOP'
  | 'RELATION_CYCLE'
  | 'RELATION_DUPLICATE'
  | 'RELATION_ENDPOINT_ORDER'
  | 'RELATION_SOURCE_REQUIRED'
  | 'RELATION_RATIONALE_REQUIRED'
  | 'MISSING_SOURCE'
  | 'MISSING_OBJECTIVE'
  | 'REVIEW_STATE_INVALID'
  | 'PACK_SCOPE_INVALID'
  | 'PACK_COVERAGE_INVALID'
  | 'PACK_IMMUTABLE'
  | 'PACK_STATUS_INVALID'
  | 'PACK_CONTENT_HASH_MISMATCH'
  | 'COVERAGE_INCOMPLETE'
  | 'COVERAGE_REFERENCE_INVALID'
  | 'TRUST_MODE_VIOLATION'
  | 'CANDIDATE_STRONG_CLAIM'
  | 'ASSESSMENT_WITHOUT_EVIDENCE'
  | 'ASSESSMENT_STATE_INVALID'
  | 'ASSESSMENT_COUNTER_EVIDENCE'
  | 'SESSION_STATE_INVALID'
  | 'ATTEMPT_COMMIT_INVALID'
  | 'ATTEMPT_ANSWER_INVALID'
  | 'EVIDENCE_MODEL_RUN_REQUIRED'
  | 'LOW_CONFIDENCE_UPGRADE'
  | 'PROGRESS_INVARIANT'
  | 'REVIEW_INVARIANT'
  | 'IMPORT_INVARIANT'
  | 'IMPORT_LATE_RESULT'
  | 'IMPORT_TRANSITION_INVALID'
  | 'COMPATIBILITY_INVALID'
  | 'COMPATIBILITY_UNVERIFIED'
  | 'STALE_REVISION'
  | 'REQUEST_DUPLICATE'
  | 'JOURNAL_TAIL_PARTIAL'
  | 'JOURNAL_CORRUPT_LINE'
  | 'JOURNAL_SEQ_ORDER'
  | 'SNAPSHOT_INVALID'
  | 'GRADE_CLARIFICATION_CONFLICT'
  | 'DIAGRAM_UNSAFE';

export interface Issue {
  readonly code: IssueCode;
  readonly path: string;
  readonly message: string;
}

export type ValidationResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly issues: readonly Issue[] };

export type Validator<T> = (input: unknown) => ValidationResult<T>;

export class IssueCollector {
  readonly list: Issue[] = [];

  add(code: IssueCode, path: string, message: string): void {
    this.list.push({ code, path, message });
  }

  get count(): number {
    return this.list.length;
  }
}

export const UNKNOWN_KEY_SENTINEL = '\u0000unknown';

export function readObject(
  value: unknown,
  path: string,
  allowed: readonly string[],
  issues: IssueCollector,
): Record<string, unknown> | null {
  if (!isPlainObject(value)) {
    issues.add('INVALID_TYPE', path, 'expected a plain object');
    return null;
  }
  for (const key of Object.keys(value)) {
    if (key === UNKNOWN_KEY_SENTINEL) continue;
    if (!allowed.includes(key)) {
      issues.add('UNKNOWN_FIELD', `${path}.${key}`, `unknown field "${key}" is not allowed`);
    }
  }
  return value;
}

export interface StringRule {
  readonly optional?: boolean;
  readonly nullable?: boolean;
  readonly enum?: readonly string[];
  readonly pattern?: RegExp;
  readonly patternMessage?: string;
  readonly minLength?: number;
  readonly maxLength?: number;
}

export function readString(
  obj: Record<string, unknown>,
  key: string,
  path: string,
  issues: IssueCollector,
  rule: StringRule = {},
): string | null {
  const at = `${path}.${key}`;
  const raw = obj[key];
  if (raw === undefined) {
    if (!rule.optional) issues.add('MISSING_FIELD', at, 'required field is missing');
    return null;
  }
  if (raw === null) {
    if (rule.nullable) return null;
    issues.add('INVALID_TYPE', at, 'null is not allowed for this field');
    return null;
  }
  if (typeof raw !== 'string') {
    issues.add('INVALID_TYPE', at, 'expected a string');
    return null;
  }
  if (rule.minLength !== undefined && raw.trim().length < rule.minLength) {
    issues.add('INVALID_FORMAT', at, `expected non-empty string (min length ${rule.minLength})`);
    return null;
  }
  if (rule.maxLength !== undefined && raw.length > rule.maxLength) {
    issues.add('INVALID_FORMAT', at, `string exceeds max length ${rule.maxLength}`);
    return null;
  }
  if (rule.pattern !== undefined && !rule.pattern.test(raw)) {
    issues.add('INVALID_FORMAT', at, rule.patternMessage ?? 'value does not match the required pattern');
    return null;
  }
  if (rule.enum !== undefined && !rule.enum.includes(raw)) {
    issues.add('INVALID_ENUM', at, `expected one of: ${rule.enum.join(', ')}`);
    return null;
  }
  return raw;
}

export function readId(
  obj: Record<string, unknown>,
  key: string,
  path: string,
  issues: IssueCollector,
  rule: { optional?: boolean; nullable?: boolean } = {},
): Id | null {
  const value = readString(obj, key, path, issues, {
    ...rule,
    patternMessage: 'expected an opaque ID (no whitespace, no path separators, max 128 chars)',
  });
  if (value !== null && !isOpaqueId(value)) {
    issues.add('INVALID_ID', `${path}.${key}`, 'expected an opaque ID (no whitespace, no path separators, max 128 chars)');
    return null;
  }
  return value;
}

export function readTimestamp(
  obj: Record<string, unknown>,
  key: string,
  path: string,
  issues: IssueCollector,
  rule: { optional?: boolean; nullable?: boolean } = {},
): string | null {
  const value = readString(obj, key, path, issues, rule);
  if (value !== null && !isValidRfc3339Utc(value)) {
    issues.add(
      'INVALID_TIMESTAMP',
      `${path}.${key}`,
      'expected an RFC3339 UTC timestamp ending in Z (e.g. 2026-10-29T09:00:00Z)',
    );
    return null;
  }
  return value;
}

export function readSha256(
  obj: Record<string, unknown>,
  key: string,
  path: string,
  issues: IssueCollector,
  rule: { optional?: boolean; nullable?: boolean } = {},
): string | null {
  const value = readString(obj, key, path, issues, rule);
  if (value !== null && !isSha256(value)) {
    issues.add('INVALID_HASH', `${path}.${key}`, 'expected a lowercase hex SHA-256 (64 chars)');
    return null;
  }
  return value;
}

export function readManagedAssetId(
  obj: Record<string, unknown>,
  key: string,
  path: string,
  issues: IssueCollector,
  rule: { optional?: boolean; nullable?: boolean } = {},
): string | null {
  const value = readId(obj, key, path, issues, rule);
  if (value !== null && !isManagedAssetId(value)) {
    issues.add('INVALID_ASSET', `${path}.${key}`, 'expected a host managed asset handle, not an OS path');
    return null;
  }
  return value;
}

export function readNumber(
  obj: Record<string, unknown>,
  key: string,
  path: string,
  issues: IssueCollector,
  rule: { optional?: boolean; nullable?: boolean; min?: number; max?: number; integer?: boolean } = {},
): number | null {
  const at = `${path}.${key}`;
  const raw = obj[key];
  if (raw === undefined) {
    if (!rule.optional) issues.add('MISSING_FIELD', at, 'required field is missing');
    return null;
  }
  if (raw === null) {
    if (rule.nullable) return null;
    issues.add('INVALID_TYPE', at, 'null is not allowed for this field');
    return null;
  }
  if (typeof raw !== 'number' || !Number.isFinite(raw)) {
    issues.add('INVALID_TYPE', at, 'expected a finite number');
    return null;
  }
  if (rule.integer === true && !Number.isInteger(raw)) {
    issues.add('INVALID_NUMBER', at, 'expected an integer');
    return null;
  }
  if (rule.min !== undefined && raw < rule.min) {
    issues.add('INVALID_NUMBER', at, `expected a value >= ${rule.min}`);
    return null;
  }
  if (rule.max !== undefined && raw > rule.max) {
    issues.add('INVALID_NUMBER', at, `expected a value <= ${rule.max}`);
    return null;
  }
  return raw;
}

export function readBoolean(
  obj: Record<string, unknown>,
  key: string,
  path: string,
  issues: IssueCollector,
  rule: { optional?: boolean } = {},
): boolean | null {
  const at = `${path}.${key}`;
  const raw = obj[key];
  if (raw === undefined) {
    if (!rule.optional) issues.add('MISSING_FIELD', at, 'required field is missing');
    return null;
  }
  if (typeof raw !== 'boolean') {
    issues.add('INVALID_TYPE', at, 'expected a boolean');
    return null;
  }
  return raw;
}

export function readArray<T>(
  obj: Record<string, unknown>,
  key: string,
  path: string,
  issues: IssueCollector,
  readItem: (value: unknown, at: string, issues: IssueCollector) => T | null,
  rule: { optional?: boolean; minItems?: number; maxItems?: number } = {},
): T[] | null {
  const at = `${path}.${key}`;
  const raw = obj[key];
  if (raw === undefined) {
    if (!rule.optional) issues.add('MISSING_FIELD', at, 'required array is missing');
    return null;
  }
  if (!Array.isArray(raw)) {
    issues.add('INVALID_TYPE', at, 'expected an array');
    return null;
  }
  if (rule.minItems !== undefined && raw.length < rule.minItems) {
    issues.add('INVALID_FORMAT', at, `expected at least ${rule.minItems} item(s)`);
    return null;
  }
  if (rule.maxItems !== undefined && raw.length > rule.maxItems) {
    issues.add('INVALID_FORMAT', at, `expected at most ${rule.maxItems} item(s)`);
    return null;
  }
  const items: T[] = [];
  raw.forEach((item, index) => {
    const parsed = readItem(item, `${at}[${index}]`, issues);
    if (parsed !== null) items.push(parsed);
  });
  return items;
}

export function readStringArray(
  obj: Record<string, unknown>,
  key: string,
  path: string,
  issues: IssueCollector,
  rule: { optional?: boolean; nullable?: boolean; minItems?: number; idItems?: boolean } = {},
): string[] | null {
  const raw = obj[key];
  if (raw === null && rule.nullable === true) return null;
  return readArray<string>(
    obj,
    key,
    path,
    issues,
    (value, at, collector) => {
      if (typeof value !== 'string') {
        collector.add('INVALID_TYPE', at, 'expected a string');
        return null;
      }
      if (value.trim().length === 0) {
        collector.add('INVALID_FORMAT', at, 'expected a non-empty string');
        return null;
      }
      if (rule.idItems === true && !isOpaqueId(value)) {
        collector.add('INVALID_ID', at, 'expected an opaque ID');
        return null;
      }
      return value;
    },
    { optional: rule.optional, minItems: rule.minItems },
  );
}

export function readEnum<T extends string>(
  obj: Record<string, unknown>,
  key: string,
  path: string,
  issues: IssueCollector,
  allowed: readonly T[],
  rule: { optional?: boolean; nullable?: boolean } = {},
): T | null {
  const value = readString(obj, key, path, issues, {
    optional: rule.optional,
    nullable: rule.nullable,
    enum: allowed,
  });
  return value as T | null;
}

export function readSchemaVersion(
  obj: Record<string, unknown>,
  path: string,
  issues: IssueCollector,
): 1 | null {
  const raw = obj['schemaVersion'];
  if (raw === undefined) {
    issues.add('MISSING_FIELD', `${path}.schemaVersion`, 'schemaVersion is required');
    return null;
  }
  if (raw !== SCHEMA_VERSION) {
    issues.add(
      'SCHEMA_VERSION_MISMATCH',
      `${path}.schemaVersion`,
      `expected ${SCHEMA_VERSION}, got ${String(raw)}`,
    );
    return null;
  }
  return SCHEMA_VERSION;
}

export function readBBox(
  obj: Record<string, unknown>,
  key: string,
  path: string,
  issues: IssueCollector,
  rule: { optional?: boolean; nullable?: boolean } = {},
): NormalizedBBox | null {
  const at = `${path}.${key}`;
  const raw = obj[key];
  if (raw === undefined) {
    if (!rule.optional) issues.add('MISSING_FIELD', at, 'bbox is required (use null when unknown)');
    return null;
  }
  if (raw === null) {
    if (rule.nullable) return null;
    issues.add('INVALID_BBOX', at, 'null bbox is not allowed here');
    return null;
  }
  const inner = readObject(raw, at, ['x', 'y', 'width', 'height'], issues);
  if (inner === null) return null;
  const x = readNumber(inner, 'x', at, issues, { min: 0, max: 1 });
  const y = readNumber(inner, 'y', at, issues, { min: 0, max: 1 });
  const width = readNumber(inner, 'width', at, issues, { min: 0, max: 1 });
  const height = readNumber(inner, 'height', at, issues, { min: 0, max: 1 });
  if (x === null || y === null || width === null || height === null) return null;
  if (width <= 0 || height <= 0) {
    issues.add('INVALID_BBOX', at, 'width and height must be > 0');
    return null;
  }
  if (x + width > 1 || y + height > 1) {
    issues.add('INVALID_BBOX', at, 'bbox must stay inside the normalized [0,1] page area');
    return null;
  }
  return { x, y, width, height };
}

export function finish<T>(value: T | null, issues: IssueCollector): ValidationResult<T> {
  if (issues.count > 0 || value === null) {
    if (issues.count === 0) {
      issues.add('INVALID_TYPE', '$', 'value is not a valid object');
    }
    return { ok: false, issues: issues.list };
  }
  return { ok: true, value };
}

export function validateWith<T>(reader: (value: unknown, path: string, issues: IssueCollector) => T | null) {
  return (input: unknown): ValidationResult<T> => {
    const issues = new IssueCollector();
    const value = reader(input, '$', issues);
    return finish(value, issues);
  };
}

/** Rejects model generated scripts / HTML in user visible text fields. */
export function checkSafeText(value: string, path: string, issues: IssueCollector): boolean {
  const lowered = value.toLowerCase();
  const unsafe =
    lowered.includes('<script') ||
    lowered.includes('<iframe') ||
    lowered.includes('javascript:') ||
    lowered.includes('<object') ||
    lowered.includes('<embed');
  if (unsafe) {
    issues.add('UNSAFE_CONTENT', path, 'script/HTML embedding is not allowed in controlled text');
    return false;
  }
  return true;
}

export function issue(code: IssueCode, path: string, message: string): Issue {
  return { code, path, message };
}

export function errorResult<T>(issues: readonly Issue[]): ValidationResult<T> {
  return { ok: false, issues };
}

export function valueResult<T>(value: T): ValidationResult<T> {
  return { ok: true, value };
}
