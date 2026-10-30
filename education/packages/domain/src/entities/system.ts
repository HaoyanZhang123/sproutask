/**
 * Import, grading, compatibility and journal contract entities
 * (05 §4, §5, §7, §8, §9).
 */

import {
  ACTOR_KINDS,
  COMPATIBILITY_MAPPING_KINDS,
  EVIDENCE_EFFECTS,
  EVIDENCE_KINDS,
  ASSESSMENT_ORIGINS,
  ASSISTANCE_LEVELS,
  IMPORT_STAGES,
  IMPORT_STATUSES,
  REALTIME_TOPICS,
  VALIDITY_STATES,
  VERSION_LABEL_PATTERN,
  isPlainObject,
  type ActorKind,
  type AssessmentOrigin,
  type Assistance,
  type CompatibilityMappingKind,
  type EvidenceEffect,
  type EvidenceKind,
  type Id,
  type ImportStage,
  type ImportStatus,
  type RealtimeTopic,
  type Timestamp,
} from '../primitives.js';
import {
  IssueCollector,
  checkSafeText,
  finish,
  readArray,
  readBoolean,
  readEnum,
  readId,
  readNumber,
  readObject,
  readSchemaVersion,
  readSha256,
  readString,
  readStringArray,
  readTimestamp,
  validateWith,
  type Issue,
  type ValidationResult,
} from '../validation.js';

/* ------------------------------------------------------------------ import */

export interface ImportError {
  readonly code: string;
  readonly message: string;
  readonly retryable: boolean;
}

export interface ImportCheckpoint {
  readonly stage: ImportStage;
  readonly lastCompletedUnit: number | null;
  readonly parserCacheKey: string | null;
}

export interface ImportCostUsage {
  readonly calls: number;
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly estimatedCostUsd: number | null;
}

export interface ImportJob {
  readonly schemaVersion: 1;
  readonly id: Id;
  readonly requestId: string;
  readonly sha256: string;
  readonly stage: ImportStage;
  readonly status: ImportStatus;
  readonly checkpoint: ImportCheckpoint;
  readonly completedUnits: number;
  readonly totalUnits: number;
  readonly error: ImportError | null;
  readonly retryable: boolean;
  readonly parserVersion: string;
  readonly modelVersion: string | null;
  readonly costUsage: ImportCostUsage;
  readonly createdAt: Timestamp;
  readonly updatedAt: Timestamp;
}

function readImportError(value: unknown, path: string, issues: IssueCollector): ImportError | null {
  const obj = readObject(value, path, ['code', 'message', 'retryable'], issues);
  if (obj === null) return null;
  const code = readString(obj, 'code', path, issues, { minLength: 1 });
  const message = readString(obj, 'message', path, issues, { minLength: 1 });
  const retryable = readBoolean(obj, 'retryable', path, issues);
  if (code === null || message === null || retryable === null) return null;
  return { code, message, retryable };
}

function readImportCheckpoint(
  value: unknown,
  path: string,
  issues: IssueCollector,
): ImportCheckpoint | null {
  const obj = readObject(value, path, ['stage', 'lastCompletedUnit', 'parserCacheKey'], issues);
  if (obj === null) return null;
  const stage = readEnum(obj, 'stage', path, issues, IMPORT_STAGES);
  const lastCompletedUnit = readNumber(obj, 'lastCompletedUnit', path, issues, {
    integer: true,
    min: 0,
    nullable: true,
  });
  const parserCacheKey = readString(obj, 'parserCacheKey', path, issues, {
    nullable: true,
    maxLength: 200,
  });
  if (stage === null) return null;
  return { stage, lastCompletedUnit, parserCacheKey };
}

function readImportCostUsage(
  value: unknown,
  path: string,
  issues: IssueCollector,
): ImportCostUsage | null {
  const obj = readObject(
    value,
    path,
    ['calls', 'inputTokens', 'outputTokens', 'estimatedCostUsd'],
    issues,
  );
  if (obj === null) return null;
  const calls = readNumber(obj, 'calls', path, issues, { integer: true, min: 0 });
  const inputTokens = readNumber(obj, 'inputTokens', path, issues, { integer: true, min: 0 });
  const outputTokens = readNumber(obj, 'outputTokens', path, issues, { integer: true, min: 0 });
  const estimatedCostUsd = readNumber(obj, 'estimatedCostUsd', path, issues, {
    nullable: true,
    min: 0,
  });
  if (calls === null || inputTokens === null || outputTokens === null) return null;
  return { calls, inputTokens, outputTokens, estimatedCostUsd };
}

export function readImportJobAt(
  value: unknown,
  path: string,
  issues: IssueCollector,
): ImportJob | null {
  const obj = readObject(
    value,
    path,
    [
      'schemaVersion',
      'id',
      'requestId',
      'sha256',
      'stage',
      'status',
      'checkpoint',
      'completedUnits',
      'totalUnits',
      'error',
      'retryable',
      'parserVersion',
      'modelVersion',
      'costUsage',
      'createdAt',
      'updatedAt',
    ],
    issues,
  );
  if (obj === null) return null;
  readSchemaVersion(obj, path, issues);
  const id = readId(obj, 'id', path, issues);
  const requestId = readString(obj, 'requestId', path, issues, { minLength: 1, maxLength: 128 });
  const sha256 = readSha256(obj, 'sha256', path, issues);
  const stage = readEnum(obj, 'stage', path, issues, IMPORT_STAGES);
  const status = readEnum(obj, 'status', path, issues, IMPORT_STATUSES);
  const checkpoint = readImportCheckpoint(obj['checkpoint'], `${path}.checkpoint`, issues);
  const completedUnits = readNumber(obj, 'completedUnits', path, issues, { integer: true, min: 0 });
  const totalUnits = readNumber(obj, 'totalUnits', path, issues, { integer: true, min: 1 });
  const errorRaw = obj['error'];
  let error: ImportError | null = null;
  if (errorRaw !== null && errorRaw !== undefined) {
    error = readImportError(errorRaw, `${path}.error`, issues);
  }
  const retryable = readBoolean(obj, 'retryable', path, issues);
  const parserVersion = readString(obj, 'parserVersion', path, issues, {
    pattern: VERSION_LABEL_PATTERN,
  });
  const modelVersion = readString(obj, 'modelVersion', path, issues, {
    nullable: true,
    maxLength: 128,
  });
  const costUsage = readImportCostUsage(obj['costUsage'], `${path}.costUsage`, issues);
  const createdAt = readTimestamp(obj, 'createdAt', path, issues);
  const updatedAt = readTimestamp(obj, 'updatedAt', path, issues);
  if (
    id === null ||
    requestId === null ||
    sha256 === null ||
    stage === null ||
    status === null ||
    checkpoint === null ||
    completedUnits === null ||
    totalUnits === null ||
    retryable === null ||
    parserVersion === null ||
    costUsage === null ||
    createdAt === null ||
    updatedAt === null
  ) {
    return null;
  }
  if (completedUnits > totalUnits) {
    issues.add('IMPORT_INVARIANT', `${path}.completedUnits`, 'completedUnits exceeds totalUnits');
    return null;
  }
  if (Date.parse(updatedAt) < Date.parse(createdAt)) {
    issues.add('IMPORT_INVARIANT', `${path}.updatedAt`, 'updatedAt precedes createdAt');
    return null;
  }
  if (status === 'failed' && error === null) {
    issues.add('IMPORT_INVARIANT', `${path}.error`, 'failed imports require an error');
    return null;
  }
  if (status === 'completed' && stage !== 'ready') {
    issues.add(
      'IMPORT_INVARIANT',
      `${path}.status`,
      'completed imports must be at stage=ready (await_review is not completion)',
    );
    return null;
  }
  if (stage === 'await_review' && status === 'completed') {
    issues.add(
      'IMPORT_INVARIANT',
      `${path}.status`,
      'await_review means pending review and cannot be reported as completed',
    );
    return null;
  }
  return {
    schemaVersion: 1,
    id,
    requestId,
    sha256,
    stage,
    status,
    checkpoint,
    completedUnits,
    totalUnits,
    error,
    retryable,
    parserVersion,
    modelVersion,
    costUsage,
    createdAt,
    updatedAt,
  };
}

export const validateImportJob: (input: unknown) => ValidationResult<ImportJob> =
  validateWith(readImportJobAt);

export interface ImportProgressUpdate {
  readonly stage?: ImportStage;
  readonly status?: ImportStatus;
  readonly completedUnits?: number;
  readonly totalUnits?: number;
  readonly checkpoint?: ImportCheckpoint;
  readonly error?: ImportError | null;
  readonly retryable?: boolean;
  readonly updatedAt: Timestamp;
}

/**
 * Applies a progress update. Cancelled jobs never publish late results; stages
 * are monotonic and progress never moves backwards.
 */
export function applyImportProgress(
  job: ImportJob,
  update: ImportProgressUpdate,
): ValidationResult<ImportJob> {
  const issues = new IssueCollector();
  const nextStage = update.stage ?? job.stage;
  const nextStatus = update.status ?? job.status;
  const nextCompleted = update.completedUnits ?? job.completedUnits;
  const nextTotal = update.totalUnits ?? job.totalUnits;
  const stageIndex = IMPORT_STAGES.indexOf(nextStage);
  const currentIndex = IMPORT_STAGES.indexOf(job.stage);

  if (job.status === 'cancelled' && nextStage !== job.stage) {
    issues.add(
      'IMPORT_LATE_RESULT',
      '$.stage',
      'a cancelled import must not publish late stage results',
    );
  }
  if (stageIndex < currentIndex) {
    issues.add('IMPORT_TRANSITION_INVALID', '$.stage', 'import stages must not move backwards');
  }
  if (nextCompleted < job.completedUnits) {
    issues.add(
      'IMPORT_TRANSITION_INVALID',
      '$.completedUnits',
      'completedUnits must not decrease',
    );
  }
  if (nextCompleted > nextTotal) {
    issues.add('IMPORT_INVARIANT', '$.completedUnits', 'completedUnits exceeds totalUnits');
  }
  if (nextStatus === 'completed' && nextStage !== 'ready') {
    issues.add(
      'IMPORT_INVARIANT',
      '$.status',
      'only a ready import can be completed; await_review is pending',
    );
  }
  if (nextStatus === 'failed' && update.error == null) {
    issues.add('IMPORT_INVARIANT', '$.error', 'failed imports require an error');
  }
  if (
    update.checkpoint !== undefined &&
    update.checkpoint !== null &&
    update.checkpoint.stage !== nextStage
  ) {
    issues.add(
      'IMPORT_INVARIANT',
      '$.checkpoint.stage',
      'checkpoint stage must match the job stage',
    );
  }
  if (issues.count > 0) return { ok: false, issues: issues.list };

  const next: ImportJob = {
    ...job,
    stage: nextStage,
    status: nextStatus,
    completedUnits: nextCompleted,
    totalUnits: nextTotal,
    checkpoint: update.checkpoint ?? job.checkpoint,
    error: update.error !== undefined ? update.error : job.error,
    retryable: update.retryable ?? job.retryable,
    updatedAt: update.updatedAt,
  };
  return finish(next, issues);
}

/* ---------------------------------------------------------- compatibility */

export interface CompatibilityReview {
  readonly verified: boolean;
  readonly actorKind: ActorKind | null;
  readonly checkedAt: Timestamp | null;
  readonly notes: string | null;
}

export interface ConceptMapping {
  readonly fromConceptId: Id | null;
  readonly toConceptIds: readonly Id[];
  readonly kind: CompatibilityMappingKind;
  readonly rationale: string;
  readonly review: CompatibilityReview;
  readonly evidenceEffect: EvidenceEffect;
}

export interface CompatibilityMap {
  readonly schemaVersion: 1;
  readonly id: Id;
  readonly courseEditionId: Id;
  readonly fromPackVersion: string;
  readonly toPackVersion: string;
  readonly fromContentHash: string;
  readonly toContentHash: string;
  readonly mappings: readonly ConceptMapping[];
  readonly createdAt: Timestamp;
}

function readCompatibilityReview(
  value: unknown,
  path: string,
  issues: IssueCollector,
): CompatibilityReview | null {
  const obj = readObject(value, path, ['verified', 'actorKind', 'checkedAt', 'notes'], issues);
  if (obj === null) return null;
  const verified = readBoolean(obj, 'verified', path, issues);
  const actorKind = readEnum(obj, 'actorKind', path, issues, ACTOR_KINDS, { nullable: true });
  const checkedAt = readTimestamp(obj, 'checkedAt', path, issues, { nullable: true });
  const notes = readString(obj, 'notes', path, issues, { nullable: true, maxLength: 2000 });
  if (verified === null) return null;
  if (verified && actorKind === null) {
    issues.add(
      'COMPATIBILITY_INVALID',
      `${path}.actorKind`,
      'a verified compatibility mapping requires a review actor',
    );
    return null;
  }
  return { verified, actorKind, checkedAt, notes };
}

function readConceptMapping(
  value: unknown,
  path: string,
  issues: IssueCollector,
): ConceptMapping | null {
  const obj = readObject(
    value,
    path,
    ['fromConceptId', 'toConceptIds', 'kind', 'rationale', 'review', 'evidenceEffect'],
    issues,
  );
  if (obj === null) return null;
  const fromConceptId = readId(obj, 'fromConceptId', path, issues, { nullable: true });
  const toConceptIds = readStringArray(obj, 'toConceptIds', path, issues, { idItems: true });
  const kind = readEnum(obj, 'kind', path, issues, COMPATIBILITY_MAPPING_KINDS);
  const rationale = readString(obj, 'rationale', path, issues, { minLength: 1 });
  const review = readCompatibilityReview(obj['review'], `${path}.review`, issues);
  const evidenceEffect = readEnum(obj, 'evidenceEffect', path, issues, EVIDENCE_EFFECTS);
  if (kind === null || rationale === null || review === null || evidenceEffect === null) {
    return null;
  }
  if (kind === 'added' && fromConceptId !== null) {
    issues.add('COMPATIBILITY_INVALID', `${path}.fromConceptId`, 'added concepts have no old id');
    return null;
  }
  if (kind === 'removed' && (toConceptIds ?? []).length !== 0) {
    issues.add('COMPATIBILITY_INVALID', `${path}.toConceptIds`, 'removed concepts have no new id');
    return null;
  }
  if (kind === 'split' && (toConceptIds ?? []).length < 2) {
    issues.add('COMPATIBILITY_INVALID', `${path}.toConceptIds`, 'split requires at least two new ids');
    return null;
  }
  if (kind === 'merged' && (toConceptIds ?? []).length !== 1) {
    issues.add('COMPATIBILITY_INVALID', `${path}.toConceptIds`, 'merged maps to exactly one new id');
    return null;
  }
  if (kind === 'unchanged' || kind === 'renamed') {
    if (fromConceptId === null || (toConceptIds ?? []).length !== 1) {
      issues.add(
        'COMPATIBILITY_INVALID',
        path,
        `${kind} mappings require one old and one new concept id`,
      );
      return null;
    }
  }
  if (evidenceEffect === 'inherit' && !review.verified) {
    issues.add(
      'COMPATIBILITY_UNVERIFIED',
      `${path}.evidenceEffect`,
      'history can only be inherited through a verified mapping',
    );
    return null;
  }
  return {
    fromConceptId,
    toConceptIds: toConceptIds ?? [],
    kind,
    rationale,
    review,
    evidenceEffect,
  };
}

export function readCompatibilityMapAt(
  value: unknown,
  path: string,
  issues: IssueCollector,
): CompatibilityMap | null {
  const obj = readObject(
    value,
    path,
    [
      'schemaVersion',
      'id',
      'courseEditionId',
      'fromPackVersion',
      'toPackVersion',
      'fromContentHash',
      'toContentHash',
      'mappings',
      'createdAt',
    ],
    issues,
  );
  if (obj === null) return null;
  readSchemaVersion(obj, path, issues);
  const id = readId(obj, 'id', path, issues);
  const courseEditionId = readId(obj, 'courseEditionId', path, issues);
  const fromPackVersion = readString(obj, 'fromPackVersion', path, issues, {
    pattern: VERSION_LABEL_PATTERN,
  });
  const toPackVersion = readString(obj, 'toPackVersion', path, issues, {
    pattern: VERSION_LABEL_PATTERN,
  });
  const fromContentHash = readSha256(obj, 'fromContentHash', path, issues);
  const toContentHash = readSha256(obj, 'toContentHash', path, issues);
  const mappings = readArray(obj, 'mappings', path, issues, readConceptMapping, { minItems: 1 });
  const createdAt = readTimestamp(obj, 'createdAt', path, issues);
  if (
    id === null ||
    courseEditionId === null ||
    fromPackVersion === null ||
    toPackVersion === null ||
    fromContentHash === null ||
    toContentHash === null ||
    mappings === null ||
    createdAt === null
  ) {
    return null;
  }
  if (fromPackVersion === toPackVersion) {
    issues.add(
      'COMPATIBILITY_INVALID',
      `${path}.toPackVersion`,
      'a compatibility map must connect two different pack versions',
    );
    return null;
  }
  if (fromContentHash === toContentHash) {
    issues.add(
      'COMPATIBILITY_INVALID',
      `${path}.toContentHash`,
      'content hashes must differ for a new pack version',
    );
    return null;
  }
  return {
    schemaVersion: 1,
    id,
    courseEditionId,
    fromPackVersion,
    toPackVersion,
    fromContentHash,
    toContentHash,
    mappings,
    createdAt,
  };
}

export const validateCompatibilityMap: (input: unknown) => ValidationResult<CompatibilityMap> =
  validateWith(readCompatibilityMapAt);

export interface CompatibilityProjection {
  readonly conceptId: Id | null;
  readonly understandingState: 'unassessed';
  readonly reason:
    | 'compatibility_unverified'
    | 'evidence_stale'
    | 'requires_current_pack_evidence'
    | 'concept_removed'
    | 'concept_added';
  readonly carryLearningHistory: boolean;
  readonly staleEvidence: boolean;
  readonly mappingKind: CompatibilityMappingKind | null;
}

/**
 * A new pack never copies a strong understanding state. Verified unchanged /
 * renamed mappings may show inherited learning history with a marker; affected
 * evidence is marked stale/needs_recheck instead of being promoted.
 */
export function projectProgressUnderCompatibility(
  mapping: ConceptMapping | undefined,
): CompatibilityProjection {
  if (mapping === undefined) {
    return {
      conceptId: null,
      understandingState: 'unassessed',
      reason: 'compatibility_unverified',
      carryLearningHistory: false,
      staleEvidence: true,
      mappingKind: null,
    };
  }
  const targetConceptId = mapping.toConceptIds[0] ?? mapping.fromConceptId ?? '';
  const base = {
    conceptId: targetConceptId,
    understandingState: 'unassessed' as const,
    mappingKind: mapping.kind,
  };
  if (mapping.kind === 'removed') {
    return {
      ...base,
      reason: 'concept_removed',
      carryLearningHistory: false,
      staleEvidence: true,
    };
  }
  if (mapping.kind === 'added') {
    return {
      ...base,
      reason: 'concept_added',
      carryLearningHistory: false,
      staleEvidence: false,
    };
  }
  if (!mapping.review.verified) {
    return {
      ...base,
      reason: 'compatibility_unverified',
      carryLearningHistory: false,
      staleEvidence: true,
    };
  }
  if (mapping.evidenceEffect === 'inherit') {
    return {
      ...base,
      reason: 'requires_current_pack_evidence',
      carryLearningHistory: true,
      staleEvidence: false,
    };
  }
  return {
    ...base,
    reason: 'evidence_stale',
    carryLearningHistory: mapping.evidenceEffect === 'stale',
    staleEvidence: true,
  };
}

/* ------------------------------------------------------------------ grade */

export interface GradeCriterion {
  readonly criterionId: Id;
  readonly met: 'yes' | 'no' | 'unclear';
  readonly rationale: string;
}

export interface EvidenceCandidate {
  readonly conceptId: Id;
  readonly kind: EvidenceKind;
  readonly observation: string;
  readonly criterionResults: readonly {
    readonly criterionId: Id;
    readonly result: 'met' | 'not_met' | 'unclear';
    readonly note: string | null;
  }[];
  readonly assistance: Assistance;
  readonly sourceRefs: readonly Id[];
  readonly assessmentOrigin: AssessmentOrigin;
  readonly modelRunId: string | null;
  readonly uncertainty: number | null;
}

export interface GradeResult {
  readonly schemaVersion: 1;
  readonly attemptId: Id;
  readonly criteria: readonly GradeCriterion[];
  readonly feedback: string;
  readonly uncertainties: readonly string[];
  readonly evidenceCandidates: readonly EvidenceCandidate[];
  readonly requiresClarification: boolean;
  readonly sourceRefs: readonly Id[];
  readonly graderVersion: string;
}

function readGradeCriterion(
  value: unknown,
  path: string,
  issues: IssueCollector,
): GradeCriterion | null {
  const obj = readObject(value, path, ['criterionId', 'met', 'rationale'], issues);
  if (obj === null) return null;
  const criterionId = readId(obj, 'criterionId', path, issues);
  const met = readEnum(obj, 'met', path, issues, ['yes', 'no', 'unclear'] as const);
  const rationale = readString(obj, 'rationale', path, issues, { minLength: 1 });
  if (criterionId === null || met === null || rationale === null) return null;
  return { criterionId, met, rationale };
}

function readEvidenceCandidate(
  value: unknown,
  path: string,
  issues: IssueCollector,
): EvidenceCandidate | null {
  const obj = readObject(
    value,
    path,
    [
      'conceptId',
      'kind',
      'observation',
      'criterionResults',
      'assistance',
      'sourceRefs',
      'assessmentOrigin',
      'modelRunId',
      'uncertainty',
    ],
    issues,
  );
  if (obj === null) return null;
  const conceptId = readId(obj, 'conceptId', path, issues);
  const kind = readEnum(obj, 'kind', path, issues, EVIDENCE_KINDS);
  const observation = readString(obj, 'observation', path, issues, { minLength: 1 });
  const criterionResults = readArray(obj, 'criterionResults', path, issues, readCriterionResult, {
    minItems: 1,
  });
  const assistance = readEnum(obj, 'assistance', path, issues, ASSISTANCE_LEVELS);
  const sourceRefs = readStringArray(obj, 'sourceRefs', path, issues, { idItems: true });
  const assessmentOrigin = readEnum(obj, 'assessmentOrigin', path, issues, ASSESSMENT_ORIGINS);
  const modelRunId = readString(obj, 'modelRunId', path, issues, { nullable: true, maxLength: 200 });
  const uncertainty = readNumber(obj, 'uncertainty', path, issues, {
    nullable: true,
    min: 0,
    max: 1,
  });
  if (
    conceptId === null ||
    kind === null ||
    observation === null ||
    criterionResults === null ||
    assistance === null ||
    sourceRefs === null ||
    assessmentOrigin === null
  ) {
    return null;
  }
  if (!checkSafeText(observation, `${path}.observation`, issues)) return null;
  return {
    conceptId,
    kind,
    observation,
    criterionResults,
    assistance,
    sourceRefs,
    assessmentOrigin,
    modelRunId,
    uncertainty,
  };
}

function readCriterionResult(
  value: unknown,
  path: string,
  issues: IssueCollector,
): EvidenceCandidate['criterionResults'][number] | null {
  const obj = readObject(value, path, ['criterionId', 'result', 'note'], issues);
  if (obj === null) return null;
  const criterionId = readId(obj, 'criterionId', path, issues);
  const result = readEnum(obj, 'result', path, issues, ['met', 'not_met', 'unclear'] as const);
  const note = readString(obj, 'note', path, issues, { nullable: true, maxLength: 2000 });
  if (criterionId === null || result === null) return null;
  return { criterionId, result, note };
}

export function readGradeResultAt(
  value: unknown,
  path: string,
  issues: IssueCollector,
): GradeResult | null {
  const obj = readObject(
    value,
    path,
    [
      'schemaVersion',
      'attemptId',
      'criteria',
      'feedback',
      'uncertainties',
      'evidenceCandidates',
      'requiresClarification',
      'sourceRefs',
      'graderVersion',
    ],
    issues,
  );
  if (obj === null) return null;
  readSchemaVersion(obj, path, issues);
  const attemptId = readId(obj, 'attemptId', path, issues);
  const criteria = readArray(obj, 'criteria', path, issues, readGradeCriterion, { minItems: 1 });
  const feedback = readString(obj, 'feedback', path, issues, { minLength: 1 });
  const uncertainties = readStringArray(obj, 'uncertainties', path, issues, { optional: true });
  const evidenceCandidates = readArray(obj, 'evidenceCandidates', path, issues, readEvidenceCandidate, {
    optional: true,
  });
  const requiresClarification = readBoolean(obj, 'requiresClarification', path, issues);
  const sourceRefs = readStringArray(obj, 'sourceRefs', path, issues, { idItems: true });
  const graderVersion = readString(obj, 'graderVersion', path, issues, {
    pattern: VERSION_LABEL_PATTERN,
  });
  if (
    attemptId === null ||
    criteria === null ||
    feedback === null ||
    requiresClarification === null ||
    sourceRefs === null ||
    graderVersion === null
  ) {
    return null;
  }
  if (requiresClarification && (evidenceCandidates ?? []).length > 0) {
    issues.add(
      'GRADE_CLARIFICATION_CONFLICT',
      `${path}.evidenceCandidates`,
      'an unclear image/answer must not produce evidence candidates (no guessing)',
    );
    return null;
  }
  for (const [index, candidate] of (evidenceCandidates ?? []).entries()) {
    if (candidate.assessmentOrigin === 'model' && candidate.modelRunId === null) {
      issues.add(
        'EVIDENCE_MODEL_RUN_REQUIRED',
        `${path}.evidenceCandidates[${index}].modelRunId`,
        'model evidence candidates must record the model run id',
      );
    }
    if (candidate.assessmentOrigin === 'model' && candidate.uncertainty === null) {
      issues.add(
        'EVIDENCE_MODEL_RUN_REQUIRED',
        `${path}.evidenceCandidates[${index}].uncertainty`,
        'model evidence candidates must record uncertainty',
      );
    }
  }
  if (!checkSafeText(feedback, `${path}.feedback`, issues)) return null;
  return {
    schemaVersion: 1,
    attemptId,
    criteria,
    feedback,
    uncertainties: uncertainties ?? [],
    evidenceCandidates: evidenceCandidates ?? [],
    requiresClarification,
    sourceRefs,
    graderVersion,
  };
}

export const validateGradeResult: (input: unknown) => ValidationResult<GradeResult> =
  validateWith(readGradeResultAt);

/* ----------------------------------------------------------------- journal */

export interface JournalEffect {
  readonly kind: string;
  readonly targetId: Id;
  readonly revision: number;
}

export interface JournalCommand {
  readonly schemaVersion: 1;
  readonly eventId: Id;
  readonly requestId: string;
  readonly seq: number;
  readonly occurredAt: Timestamp;
  readonly learnerId: Id;
  readonly type: string;
  readonly payload: Record<string, unknown>;
  readonly effects: readonly JournalEffect[];
}

function readJournalEffect(
  value: unknown,
  path: string,
  issues: IssueCollector,
): JournalEffect | null {
  const obj = readObject(value, path, ['kind', 'targetId', 'revision'], issues);
  if (obj === null) return null;
  const kind = readString(obj, 'kind', path, issues, {
    pattern: /^[a-z][a-z0-9_.]{1,63}$/,
    patternMessage: 'effect kind must be a lowercase dotted identifier',
  });
  const targetId = readId(obj, 'targetId', path, issues);
  const revision = readNumber(obj, 'revision', path, issues, { integer: true, min: 0 });
  if (kind === null || targetId === null || revision === null) return null;
  return { kind, targetId, revision };
}

export function readJournalCommandAt(
  value: unknown,
  path: string,
  issues: IssueCollector,
): JournalCommand | null {
  const obj = readObject(
    value,
    path,
    ['schemaVersion', 'eventId', 'requestId', 'seq', 'occurredAt', 'learnerId', 'type', 'payload', 'effects'],
    issues,
  );
  if (obj === null) return null;
  readSchemaVersion(obj, path, issues);
  const eventId = readId(obj, 'eventId', path, issues);
  const requestId = readString(obj, 'requestId', path, issues, { minLength: 1, maxLength: 128 });
  const seq = readNumber(obj, 'seq', path, issues, { integer: true, min: 0 });
  const occurredAt = readTimestamp(obj, 'occurredAt', path, issues);
  const learnerId = readId(obj, 'learnerId', path, issues);
  const type = readString(obj, 'type', path, issues, {
    pattern: /^[a-z][a-z0-9_.]{1,63}$/,
    patternMessage: 'command type must be a lowercase dotted identifier',
  });
  const payloadRaw = obj['payload'];
  let payload: Record<string, unknown> | null = null;
  if (!isPlainObject(payloadRaw)) {
    issues.add('INVALID_TYPE', `${path}.payload`, 'payload must be a plain object');
  } else {
    payload = payloadRaw;
  }
  const effects = readArray(obj, 'effects', path, issues, readJournalEffect, { optional: true });
  if (
    eventId === null ||
    requestId === null ||
    seq === null ||
    occurredAt === null ||
    learnerId === null ||
    type === null ||
    payload === null
  ) {
    return null;
  }
  return {
    schemaVersion: 1,
    eventId,
    requestId,
    seq,
    occurredAt,
    learnerId,
    type,
    payload,
    effects: effects ?? [],
  };
}

export const validateJournalCommand: (input: unknown) => ValidationResult<JournalCommand> =
  validateWith(readJournalCommandAt);

export interface JournalCorruptLine {
  readonly line: number;
  readonly message: string;
}

export interface JournalClassification {
  /** True when no middle corruption / schema error was found (tail partial is recoverable). */
  readonly ok: boolean;
  readonly commits: readonly JournalCommand[];
  readonly duplicateRequestIds: readonly string[];
  readonly tailPartial: boolean;
  readonly corruptLines: readonly JournalCorruptLine[];
  readonly nonMonotonicSeq: boolean;
  readonly issues: readonly Issue[];
}

/**
 * Pure classifier for JSONL text. T02 owns durable storage; this classifies
 * what a journal reader must do: isolate a half-written tail line, refuse to
 * silently skip middle corruption, and surface duplicate request ids.
 */
export function classifyJournalText(text: string): JournalClassification {
  const lines = text.split(/\r?\n/);
  while (lines.length > 0 && lines[lines.length - 1] === '') lines.pop();
  const commits: JournalCommand[] = [];
  const duplicateRequestIds: string[] = [];
  const corruptLines: JournalCorruptLine[] = [];
  const issues: Issue[] = [];
  const seenRequests = new Set<string>();
  let tailPartial = false;
  let nonMonotonicSeq = false;
  let previousSeq: number | null = null;

  lines.forEach((line, index) => {
    const lineNumber = index + 1;
    const isLast = index === lines.length - 1;
    if (line.trim().length === 0) {
      corruptLines.push({ line: lineNumber, message: 'blank line inside journal' });
      return;
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(line);
    } catch {
      if (isLast) {
        tailPartial = true;
        issues.push({
          code: 'JOURNAL_TAIL_PARTIAL',
          path: `$[line ${lineNumber}]`,
          message: 'isolated a half-written tail line; keep it for recovery and do not append after it',
        });
      } else {
        corruptLines.push({ line: lineNumber, message: 'invalid JSON in the middle of the journal' });
        issues.push({
          code: 'JOURNAL_CORRUPT_LINE',
          path: `$[line ${lineNumber}]`,
          message: 'middle corruption must be reported, not silently skipped',
        });
      }
      return;
    }
    const collector = new IssueCollector();
    const commit = readJournalCommandAt(parsed, `$[line ${lineNumber}]`, collector);
    if (commit === null || collector.count > 0) {
      corruptLines.push({ line: lineNumber, message: 'journal line does not match the command schema' });
      issues.push(...collector.list);
      return;
    }
    if (previousSeq !== null && commit.seq <= previousSeq) {
      nonMonotonicSeq = true;
      issues.push({
        code: 'JOURNAL_SEQ_ORDER',
        path: `$[line ${lineNumber}].seq`,
        message: 'seq must strictly increase; client clocks never decide order',
      });
    }
    previousSeq = commit.seq;
    if (seenRequests.has(commit.requestId)) {
      duplicateRequestIds.push(commit.requestId);
    } else {
      seenRequests.add(commit.requestId);
    }
    commits.push(commit);
  });

  return {
    ok: corruptLines.length === 0 && !nonMonotonicSeq,
    commits,
    duplicateRequestIds,
    tailPartial,
    corruptLines,
    nonMonotonicSeq,
    issues,
  };
}

export interface Snapshot {
  readonly schemaVersion: 1;
  readonly learnerId: Id;
  readonly lastSeq: number;
  readonly createdAt: Timestamp;
  readonly stateHash: string;
  readonly payload: Record<string, unknown>;
}

function readSnapshot(value: unknown, path: string, issues: IssueCollector): Snapshot | null {
  const obj = readObject(
    value,
    path,
    ['schemaVersion', 'learnerId', 'lastSeq', 'createdAt', 'stateHash', 'payload'],
    issues,
  );
  if (obj === null) return null;
  readSchemaVersion(obj, path, issues);
  const learnerId = readId(obj, 'learnerId', path, issues);
  const lastSeq = readNumber(obj, 'lastSeq', path, issues, { integer: true, min: 0 });
  const createdAt = readTimestamp(obj, 'createdAt', path, issues);
  const stateHash = readSha256(obj, 'stateHash', path, issues);
  const payloadRaw = obj['payload'];
  let payload: Record<string, unknown> | null = null;
  if (!isPlainObject(payloadRaw)) {
    issues.add('SNAPSHOT_INVALID', `${path}.payload`, 'snapshot payload must be a plain object');
  } else {
    payload = payloadRaw;
  }
  if (learnerId === null || lastSeq === null || createdAt === null || stateHash === null || payload === null) {
    return null;
  }
  return { schemaVersion: 1, learnerId, lastSeq, createdAt, stateHash, payload };
}

export const validateSnapshot: (input: unknown) => ValidationResult<Snapshot> =
  validateWith(readSnapshot);

export function checkSnapshotAgainstJournal(
  snapshot: Snapshot,
  journalLastSeq: number,
): ValidationResult<Snapshot> {
  const issues = new IssueCollector();
  if (snapshot.lastSeq > journalLastSeq) {
    issues.add(
      'SNAPSHOT_INVALID',
      '$.lastSeq',
      'snapshot is ahead of the journal; discard and replay the journal',
    );
  }
  return finish(snapshot, issues);
}

/* --------------------------------------------------------------- realtime */

export interface RealtimeEnvelope {
  readonly schemaVersion: 1;
  readonly eventId: Id;
  readonly topic: RealtimeTopic;
  readonly entityId: Id;
  readonly revision: number;
  readonly seq: number;
  readonly payload: Record<string, unknown>;
}

function readRealtimeEnvelope(
  value: unknown,
  path: string,
  issues: IssueCollector,
): RealtimeEnvelope | null {
  const obj = readObject(
    value,
    path,
    ['schemaVersion', 'eventId', 'topic', 'entityId', 'revision', 'seq', 'payload'],
    issues,
  );
  if (obj === null) return null;
  readSchemaVersion(obj, path, issues);
  const eventId = readId(obj, 'eventId', path, issues);
  const topic = readEnum(obj, 'topic', path, issues, REALTIME_TOPICS);
  const entityId = readId(obj, 'entityId', path, issues);
  const revision = readNumber(obj, 'revision', path, issues, { integer: true, min: 0 });
  const seq = readNumber(obj, 'seq', path, issues, { integer: true, min: 0 });
  const payloadRaw = obj['payload'];
  let payload: Record<string, unknown> | null = null;
  if (!isPlainObject(payloadRaw)) {
    issues.add('INVALID_TYPE', `${path}.payload`, 'payload must be a plain object');
  } else {
    payload = payloadRaw;
  }
  if (
    eventId === null ||
    topic === null ||
    entityId === null ||
    revision === null ||
    seq === null ||
    payload === null
  ) {
    return null;
  }
  return { schemaVersion: 1, eventId, topic, entityId, revision, seq, payload };
}

export const validateRealtimeEnvelope: (input: unknown) => ValidationResult<RealtimeEnvelope> =
  validateWith(readRealtimeEnvelope);

export interface SessionOutputExpectation {
  readonly sessionId: Id;
  readonly revision: number;
  readonly conceptId: Id;
}

/**
 * Late model output must not be written into a different concept/session
 * after the user switched context (05 §7).
 */
export function checkSessionOutputFreshness(
  envelope: RealtimeEnvelope,
  expected: SessionOutputExpectation,
): ValidationResult<RealtimeEnvelope> {
  const issues = new IssueCollector();
  if (envelope.topic !== 'session.output') {
    issues.add('STALE_REVISION', '$.topic', 'expected a session.output envelope');
  }
  if (envelope.revision !== expected.revision) {
    issues.add(
      'STALE_REVISION',
      '$.revision',
      `stale session response: revision ${envelope.revision}, current ${expected.revision}`,
    );
  }
  if (envelope.entityId !== expected.sessionId) {
    issues.add('STALE_REVISION', '$.entityId', 'response belongs to another session');
  }
  const payloadConcept = envelope.payload['conceptId'];
  if (payloadConcept !== expected.conceptId) {
    issues.add(
      'STALE_REVISION',
      '$.payload.conceptId',
      `response belongs to concept ${String(payloadConcept)}, current ${expected.conceptId}`,
    );
  }
  return finish(envelope, issues);
}


