/**
 * Shared primitive contract values.
 *
 * IDs are opaque: no validator parses meaning out of an ID and no helper
 * derives an ID from a title. Time values are RFC3339 UTC strings; the domain
 * never reads the system clock, callers inject a Clock port.
 */

export type Id = string;
export type Timestamp = string;
export type Sha256 = string;

/** Opaque ID: printable, no whitespace, no path separators, bounded length. */
export const OPAQUE_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:@-]{0,127}$/;

/** RFC3339 with a mandatory `Z` suffix (UTC only). */
export const RFC3339_UTC_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?Z$/;

/** Lowercase hex SHA-256. */
export const SHA256_PATTERN = /^[a-f0-9]{64}$/;

/** Subject slugs are data, not a closed domain enum (A28: new subjects). */
export const SUBJECT_SLUG_PATTERN = /^[a-z][a-z0-9-]{1,31}$/;

/** Version labels are opaque strings with a bounded, printable shape. */
export const VERSION_LABEL_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:+-]{0,63}$/;

export const REVIEW_STATES = [
  'candidate',
  'machine_checked',
  'curator_checked',
  'published',
  'rejected',
] as const;
export type ReviewState = (typeof REVIEW_STATES)[number];

export const TRUST_MODES = ['published', 'candidate'] as const;
export type TrustMode = (typeof TRUST_MODES)[number];

export const ACTOR_KINDS = ['human_curator', 'ai_static_reviewer', 'system'] as const;
export type ActorKind = (typeof ACTOR_KINDS)[number];

export const COURSE_EDITION_STATUSES = ['unverified', 'verified', 'rejected'] as const;
export type CourseEditionStatus = (typeof COURSE_EDITION_STATUSES)[number];

export const SOURCE_VERIFICATION_STATES = [
  'unverified',
  'machine_matched',
  'human_checked',
  'rejected',
] as const;
export type SourceVerificationState = (typeof SOURCE_VERIFICATION_STATES)[number];

export const TOC_NODE_TYPES = ['volume', 'unit', 'chapter', 'section'] as const;
export type TocNodeType = (typeof TOC_NODE_TYPES)[number];

export const RELATION_TYPES = ['prerequisite', 'related'] as const;
export type RelationType = (typeof RELATION_TYPES)[number];

export const RELATION_BASES = ['explicit_source', 'pedagogical_inference'] as const;
export type RelationBasis = (typeof RELATION_BASES)[number];

export const PACK_SCOPES = ['partial', 'full_volume'] as const;
export type PackScope = (typeof PACK_SCOPES)[number];

export const PACK_COVERAGE_STATUSES = ['partial', 'complete'] as const;
export type PackCoverageStatus = (typeof PACK_COVERAGE_STATUSES)[number];

export const PACK_STATUSES = ['draft', 'candidate', 'published', 'rejected'] as const;
export type PackStatus = (typeof PACK_STATUSES)[number];

export const LEARNING_STATES = ['not_started', 'in_progress', 'completed'] as const;
export type LearningState = (typeof LEARNING_STATES)[number];

export const UNDERSTANDING_STATES = [
  'unassessed',
  'needs_support',
  'developing',
  'supported',
] as const;
export type UnderstandingState = (typeof UNDERSTANDING_STATES)[number];

/** States an Assessment (a judgment) may hold; `unassessed` means "no judgment". */
export const ASSESSMENT_STATES = ['needs_support', 'developing', 'supported'] as const;
export type AssessmentState = (typeof ASSESSMENT_STATES)[number];

export const REVIEW_OUTCOMES = ['needs_support', 'developing', 'supported'] as const;
export type ReviewOutcome = (typeof REVIEW_OUTCOMES)[number];

export const EVIDENCE_KINDS = ['recall', 'explain', 'discriminate', 'transfer', 'label'] as const;
export type EvidenceKind = (typeof EVIDENCE_KINDS)[number];

export const ASSISTANCE_LEVELS = ['assisted', 'unassisted'] as const;
export type Assistance = (typeof ASSISTANCE_LEVELS)[number];

export const ASSESSMENT_ORIGINS = ['rule', 'model', 'human'] as const;
export type AssessmentOrigin = (typeof ASSESSMENT_ORIGINS)[number];

export const VALIDITY_STATES = ['current', 'stale', 'pending', 'needs_recheck'] as const;
export type Validity = (typeof VALIDITY_STATES)[number];

export const SESSION_MODES = ['learn', 'review', 'diagnostic'] as const;
export type SessionMode = (typeof SESSION_MODES)[number];

export const SESSION_STATUSES = ['active', 'completed', 'abandoned'] as const;
export type SessionStatus = (typeof SESSION_STATUSES)[number];

export const ATTEMPT_INPUT_TYPES = [
  'text',
  'choice',
  'diagram_label',
  'relation',
  'image',
] as const;
export type AttemptInputType = (typeof ATTEMPT_INPUT_TYPES)[number];

export const HELP_KINDS = ['hint', 'explanation', 'example', 'worked_solution', 'answer'] as const;
export type HelpKind = (typeof HELP_KINDS)[number];

/** Help kinds that disclose an answer and therefore force `assisted` evidence. */
export const ANSWER_DISCLOSING_HELP_KINDS: readonly HelpKind[] = ['worked_solution', 'answer'];

export const ACTIVITY_TYPES = [
  'recall',
  'explain',
  'choice',
  'diagram_label',
  'relation',
  'transfer',
  'image_review',
] as const;
export type ActivityType = (typeof ACTIVITY_TYPES)[number];

export const SELF_REPORT_STATES = ['uncertain', 'basically_understood', 'can_explain'] as const;
export type SelfReportState = (typeof SELF_REPORT_STATES)[number];

export const IMPORT_STAGES = [
  'accepted',
  'identify',
  'extract',
  'structure',
  'concepts',
  'validate',
  'await_review',
  'ready',
] as const;
export type ImportStage = (typeof IMPORT_STAGES)[number];

export const IMPORT_STATUSES = [
  'queued',
  'running',
  'paused',
  'failed',
  'cancelled',
  'completed',
] as const;
export type ImportStatus = (typeof IMPORT_STATUSES)[number];

export const COMPATIBILITY_MAPPING_KINDS = [
  'unchanged',
  'renamed',
  'split',
  'merged',
  'removed',
  'added',
  'rubric_changed',
  'source_revised',
] as const;
export type CompatibilityMappingKind = (typeof COMPATIBILITY_MAPPING_KINDS)[number];

export const EVIDENCE_EFFECTS = ['inherit', 'stale', 'recheck', 'reset'] as const;
export type EvidenceEffect = (typeof EVIDENCE_EFFECTS)[number];

export const REALTIME_TOPICS = [
  'import.progress',
  'session.output',
  'progress.changed',
  'content.changed',
  'runtime.status',
] as const;
export type RealtimeTopic = (typeof REALTIME_TOPICS)[number];

export interface NormalizedBBox {
  /** Normalized 0..1 coordinates relative to the page width/height. */
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export function isValidRfc3339Utc(value: string): boolean {
  if (!RFC3339_UTC_PATTERN.test(value)) return false;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed);
}

export function isOpaqueId(value: string): boolean {
  return OPAQUE_ID_PATTERN.test(value);
}

export function isSha256(value: string): boolean {
  return SHA256_PATTERN.test(value);
}

/**
 * Managed asset IDs are handles owned by the host. They must never look like
 * an OS path, otherwise callers could smuggle filesystem access into public
 * payloads (05 §2, 06 §4).
 */
export function isManagedAssetId(value: string): boolean {
  if (!isOpaqueId(value)) return false;
  if (value.includes('/') || value.includes('\\')) return false;
  if (/^[A-Za-z]:/.test(value)) return false;
  return true;
}

export function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
