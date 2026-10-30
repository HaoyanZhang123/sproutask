/**
 * Learner side contract entities (05 §2, §3, §9): Learner, Session,
 * ActivityAttempt, Evidence, Assessment, SelfReport, ConceptProgress.
 */

import {
  ANSWER_DISCLOSING_HELP_KINDS,
  ASSESSMENT_ORIGINS,
  ASSESSMENT_STATES,
  ASSISTANCE_LEVELS,
  ATTEMPT_INPUT_TYPES,
  EVIDENCE_KINDS,
  HELP_KINDS,
  LEARNING_STATES,
  REVIEW_OUTCOMES,
  REVIEW_STATES,
  SELF_REPORT_STATES,
  SESSION_MODES,
  SESSION_STATUSES,
  TRUST_MODES,
  UNDERSTANDING_STATES,
  VALIDITY_STATES,
  VERSION_LABEL_PATTERN,
  type AssessmentOrigin,
  type AssessmentState,
  type Assistance,
  type AttemptInputType,
  type EvidenceKind,
  type HelpKind,
  type Id,
  type LearningState,
  type ReviewOutcome,
  type SelfReportState,
  type SessionMode,
  type SessionStatus,
  type Timestamp,
  type TrustMode,
  type UnderstandingState,
  type Validity,
} from '../primitives.js';
import {
  IssueCollector,
  checkSafeText,
  finish,
  readArray,
  readEnum,
  readId,
  readManagedAssetId,
  readNumber,
  readObject,
  readSchemaVersion,
  readString,
  readStringArray,
  readTimestamp,
  validateWith,
  type ValidationResult,
} from '../validation.js';

export interface Learner {
  readonly schemaVersion: 1;
  readonly id: Id;
  readonly createdAt: Timestamp;
}

export interface ResumeCursor {
  readonly activityId: Id | null;
  readonly cursor: string | null;
}

export interface Session {
  readonly schemaVersion: 1;
  readonly id: Id;
  readonly learnerId: Id;
  readonly courseEditionId: Id;
  readonly packVersion: string;
  readonly trustMode: TrustMode;
  readonly conceptId: Id;
  readonly mode: SessionMode;
  readonly status: SessionStatus;
  readonly startedAt: Timestamp;
  readonly endedAt: Timestamp | null;
  readonly resumeCursor: ResumeCursor;
  /** DSH session handle. Null until the real runtime binding exists. */
  readonly dshSessionId: Id | null;
}

export interface HelpUsage {
  readonly kind: HelpKind;
  readonly usedAt: Timestamp | null;
}

export interface ActivityAttempt {
  readonly schemaVersion: 1;
  readonly id: Id;
  readonly requestId: string;
  readonly learnerId: Id;
  readonly sessionId: Id;
  readonly courseEditionId: Id;
  readonly packVersion: string;
  readonly activityId: Id;
  readonly activityVersion: string;
  readonly conceptIds: readonly Id[];
  readonly inputType: AttemptInputType;
  readonly answerAssetId: Id | null;
  readonly answerText: string | null;
  readonly submittedAt: Timestamp;
  readonly helpUsed: readonly HelpUsage[];
  readonly evidenceIds: readonly Id[];
}

export type CriterionResultValue = 'met' | 'not_met' | 'unclear';

export interface CriterionResult {
  readonly criterionId: Id;
  readonly result: CriterionResultValue;
  readonly note: string | null;
}

export interface Evidence {
  readonly schemaVersion: 1;
  readonly id: Id;
  readonly attemptId: Id;
  readonly learnerId: Id;
  readonly courseEditionId: Id;
  readonly packVersion: string;
  readonly conceptId: Id;
  readonly kind: EvidenceKind;
  readonly observation: string;
  readonly criterionResults: readonly CriterionResult[];
  readonly assistance: Assistance;
  readonly sourceRefs: readonly Id[];
  readonly assessmentOrigin: AssessmentOrigin;
  readonly modelRunId: string | null;
  readonly uncertainty: number | null;
  readonly validity: Validity;
  readonly createdAt: Timestamp;
}

export interface Assessment {
  readonly schemaVersion: 1;
  readonly id: Id;
  /** Retry/idempotency key: assessment commits de-duplicate on attempt+grader+revision. */
  readonly attemptId: Id | null;
  readonly conceptId: Id;
  readonly learnerId: Id;
  readonly courseEditionId: Id;
  readonly packVersion: string;
  readonly state: AssessmentState;
  readonly rationale: string;
  readonly evidenceIds: readonly Id[];
  readonly rubricVersion: string;
  readonly evaluatorVersion: string;
  readonly assessedAt: Timestamp;
  readonly validity: Validity;
  readonly revision: number;
}

export interface SelfReport {
  readonly schemaVersion: 1;
  readonly id: Id;
  readonly learnerId: Id;
  readonly courseEditionId: Id;
  readonly packVersion: string;
  readonly conceptId: Id;
  readonly claimedState: SelfReportState;
  readonly createdAt: Timestamp;
}

export interface LearningProgress {
  readonly state: LearningState;
  readonly startedAt: Timestamp | null;
  readonly lastCompletedAt: Timestamp | null;
}

export interface UnderstandingProgress {
  readonly state: UnderstandingState;
  readonly assessmentId: Id | null;
  readonly updatedAt: Timestamp | null;
  readonly validity: Validity;
}

/**
 * Review is deliberately four independent values (05 §3.3): reviewed and due
 * may be true at the same time.
 */
export interface ReviewRecord {
  readonly lastCompletedAt: Timestamp | null;
  readonly dueAt: Timestamp | null;
  readonly activeSessionId: Id | null;
  readonly latestOutcome: ReviewOutcome | null;
  readonly policyVersion: string;
}

export interface LastPosition {
  readonly sessionId: Id | null;
  readonly activityId: Id | null;
  readonly cursor: string | null;
  readonly updatedAt: Timestamp | null;
}

export interface ConceptProgress {
  readonly schemaVersion: 1;
  readonly learnerId: Id;
  readonly courseEditionId: Id;
  readonly packVersion: string;
  readonly conceptId: Id;
  readonly learning: LearningProgress;
  readonly understanding: UnderstandingProgress;
  readonly review: ReviewRecord;
  readonly lastPosition: LastPosition;
  /** Monotonic projection revision; only event projection may increase it. */
  readonly revision: number;
}

export function progressKey(progress: {
  readonly learnerId: Id;
  readonly courseEditionId: Id;
  readonly packVersion: string;
  readonly conceptId: Id;
}): string {
  return [progress.learnerId, progress.courseEditionId, progress.packVersion, progress.conceptId].join('|');
}

function readLearner(value: unknown, path: string, issues: IssueCollector): Learner | null {
  const obj = readObject(value, path, ['schemaVersion', 'id', 'createdAt'], issues);
  if (obj === null) return null;
  readSchemaVersion(obj, path, issues);
  const id = readId(obj, 'id', path, issues);
  const createdAt = readTimestamp(obj, 'createdAt', path, issues);
  if (id === null || createdAt === null) return null;
  return { schemaVersion: 1, id, createdAt };
}

export const validateLearner: (input: unknown) => ValidationResult<Learner> =
  validateWith(readLearner);

function readResumeCursor(
  value: unknown,
  path: string,
  issues: IssueCollector,
): ResumeCursor | null {
  const obj = readObject(value, path, ['activityId', 'cursor'], issues);
  if (obj === null) return null;
  const activityId = readId(obj, 'activityId', path, issues, { nullable: true });
  const cursor = readString(obj, 'cursor', path, issues, { nullable: true, maxLength: 500 });
  return { activityId, cursor };
}

export function readSessionAt(value: unknown, path: string, issues: IssueCollector): Session | null {
  const obj = readObject(
    value,
    path,
    [
      'schemaVersion',
      'id',
      'learnerId',
      'courseEditionId',
      'packVersion',
      'trustMode',
      'conceptId',
      'mode',
      'status',
      'startedAt',
      'endedAt',
      'resumeCursor',
      'dshSessionId',
    ],
    issues,
  );
  if (obj === null) return null;
  readSchemaVersion(obj, path, issues);
  const id = readId(obj, 'id', path, issues);
  const learnerId = readId(obj, 'learnerId', path, issues);
  const courseEditionId = readId(obj, 'courseEditionId', path, issues);
  const packVersion = readString(obj, 'packVersion', path, issues, {
    pattern: VERSION_LABEL_PATTERN,
  });
  const trustMode = readEnum(obj, 'trustMode', path, issues, TRUST_MODES);
  const conceptId = readId(obj, 'conceptId', path, issues);
  const mode = readEnum(obj, 'mode', path, issues, SESSION_MODES);
  const status = readEnum(obj, 'status', path, issues, SESSION_STATUSES);
  const startedAt = readTimestamp(obj, 'startedAt', path, issues);
  const endedAt = readTimestamp(obj, 'endedAt', path, issues, { nullable: true });
  const resumeCursor = readResumeCursor(obj['resumeCursor'], `${path}.resumeCursor`, issues);
  const dshSessionId = readId(obj, 'dshSessionId', path, issues, { nullable: true });
  if (
    id === null ||
    learnerId === null ||
    courseEditionId === null ||
    packVersion === null ||
    trustMode === null ||
    conceptId === null ||
    mode === null ||
    status === null ||
    startedAt === null ||
    resumeCursor === null
  ) {
    return null;
  }
  if (status === 'active' && endedAt !== null) {
    issues.add('SESSION_STATE_INVALID', `${path}.endedAt`, 'active sessions must not have endedAt');
    return null;
  }
  if (status !== 'active' && endedAt === null) {
    issues.add(
      'SESSION_STATE_INVALID',
      `${path}.endedAt`,
      `${status} sessions require an endedAt timestamp`,
    );
    return null;
  }
  if (endedAt !== null && Date.parse(endedAt) < Date.parse(startedAt)) {
    issues.add('SESSION_STATE_INVALID', `${path}.endedAt`, 'endedAt must not precede startedAt');
    return null;
  }
  return {
    schemaVersion: 1,
    id,
    learnerId,
    courseEditionId,
    packVersion,
    trustMode,
    conceptId,
    mode,
    status,
    startedAt,
    endedAt,
    resumeCursor,
    dshSessionId,
  };
}

export const validateSession: (input: unknown) => ValidationResult<Session> =
  validateWith(readSessionAt);

function readHelpUsage(value: unknown, path: string, issues: IssueCollector): HelpUsage | null {
  const obj = readObject(value, path, ['kind', 'usedAt'], issues);
  if (obj === null) return null;
  const kind = readEnum(obj, 'kind', path, issues, HELP_KINDS);
  const usedAt = readTimestamp(obj, 'usedAt', path, issues, { nullable: true });
  if (kind === null) return null;
  return { kind, usedAt };
}

export function readAttemptAt(
  value: unknown,
  path: string,
  issues: IssueCollector,
): ActivityAttempt | null {
  const obj = readObject(
    value,
    path,
    [
      'schemaVersion',
      'id',
      'requestId',
      'learnerId',
      'sessionId',
      'courseEditionId',
      'packVersion',
      'activityId',
      'activityVersion',
      'conceptIds',
      'inputType',
      'answerAssetId',
      'answerText',
      'submittedAt',
      'helpUsed',
      'evidenceIds',
    ],
    issues,
  );
  if (obj === null) return null;
  readSchemaVersion(obj, path, issues);
  const id = readId(obj, 'id', path, issues);
  const requestId = readString(obj, 'requestId', path, issues, { minLength: 1, maxLength: 128 });
  const learnerId = readId(obj, 'learnerId', path, issues);
  const sessionId = readId(obj, 'sessionId', path, issues);
  const courseEditionId = readId(obj, 'courseEditionId', path, issues);
  const packVersion = readString(obj, 'packVersion', path, issues, {
    pattern: VERSION_LABEL_PATTERN,
  });
  const activityId = readId(obj, 'activityId', path, issues);
  const activityVersion = readString(obj, 'activityVersion', path, issues, {
    pattern: VERSION_LABEL_PATTERN,
  });
  const conceptIds = readStringArray(obj, 'conceptIds', path, issues, {
    idItems: true,
    minItems: 1,
  });
  const inputType = readEnum(obj, 'inputType', path, issues, ATTEMPT_INPUT_TYPES);
  const answerAssetId = readManagedAssetId(obj, 'answerAssetId', path, issues, { nullable: true });
  const answerText = readString(obj, 'answerText', path, issues, { nullable: true, maxLength: 20000 });
  const submittedAt = readTimestamp(obj, 'submittedAt', path, issues);
  const helpUsed = readArray(obj, 'helpUsed', path, issues, readHelpUsage, { optional: true });
  const evidenceIds = readStringArray(obj, 'evidenceIds', path, issues, {
    idItems: true,
    optional: true,
  });
  if (
    id === null ||
    requestId === null ||
    learnerId === null ||
    sessionId === null ||
    courseEditionId === null ||
    packVersion === null ||
    activityId === null ||
    activityVersion === null ||
    conceptIds === null ||
    inputType === null ||
    submittedAt === null
  ) {
    return null;
  }
  if (inputType === 'image') {
    if (answerAssetId === null) {
      issues.add('ATTEMPT_ANSWER_INVALID', `${path}.answerAssetId`, 'image answers require an asset id');
      return null;
    }
    if (answerText !== null) {
      issues.add('ATTEMPT_ANSWER_INVALID', `${path}.answerText`, 'image answers must not carry answerText');
      return null;
    }
  } else {
    if (answerText === null || answerText.trim().length === 0) {
      issues.add('ATTEMPT_ANSWER_INVALID', `${path}.answerText`, 'this answer type requires text');
      return null;
    }
    if (answerAssetId !== null) {
      issues.add('ATTEMPT_ANSWER_INVALID', `${path}.answerAssetId`, 'only image answers carry an asset');
      return null;
    }
  }
  return {
    schemaVersion: 1,
    id,
    requestId,
    learnerId,
    sessionId,
    courseEditionId,
    packVersion,
    activityId,
    activityVersion,
    conceptIds,
    inputType,
    answerAssetId,
    answerText,
    submittedAt,
    helpUsed: helpUsed ?? [],
    evidenceIds: evidenceIds ?? [],
  };
}

export const validateActivityAttempt: (input: unknown) => ValidationResult<ActivityAttempt> =
  validateWith(readAttemptAt);

/** assistance is derived from help usage, not from UI labels. */
export function attemptAssistance(attempt: Pick<ActivityAttempt, 'helpUsed'>): Assistance {
  return attempt.helpUsed.some((help) => ANSWER_DISCLOSING_HELP_KINDS.includes(help.kind))
    ? 'assisted'
    : 'unassisted';
}

function readCriterionResult(
  value: unknown,
  path: string,
  issues: IssueCollector,
): CriterionResult | null {
  const obj = readObject(value, path, ['criterionId', 'result', 'note'], issues);
  if (obj === null) return null;
  const criterionId = readId(obj, 'criterionId', path, issues);
  const result = readEnum(obj, 'result', path, issues, ['met', 'not_met', 'unclear'] as const);
  const note = readString(obj, 'note', path, issues, { nullable: true, maxLength: 2000 });
  if (criterionId === null || result === null) return null;
  return { criterionId, result, note };
}

export function readEvidenceAt(
  value: unknown,
  path: string,
  issues: IssueCollector,
): Evidence | null {
  const obj = readObject(
    value,
    path,
    [
      'schemaVersion',
      'id',
      'attemptId',
      'learnerId',
      'courseEditionId',
      'packVersion',
      'conceptId',
      'kind',
      'observation',
      'criterionResults',
      'assistance',
      'sourceRefs',
      'assessmentOrigin',
      'modelRunId',
      'uncertainty',
      'validity',
      'createdAt',
    ],
    issues,
  );
  if (obj === null) return null;
  readSchemaVersion(obj, path, issues);
  const id = readId(obj, 'id', path, issues);
  const attemptId = readId(obj, 'attemptId', path, issues);
  const learnerId = readId(obj, 'learnerId', path, issues);
  const courseEditionId = readId(obj, 'courseEditionId', path, issues);
  const packVersion = readString(obj, 'packVersion', path, issues, {
    pattern: VERSION_LABEL_PATTERN,
  });
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
  const validity = readEnum(obj, 'validity', path, issues, VALIDITY_STATES);
  const createdAt = readTimestamp(obj, 'createdAt', path, issues);
  if (
    id === null ||
    attemptId === null ||
    learnerId === null ||
    courseEditionId === null ||
    packVersion === null ||
    conceptId === null ||
    kind === null ||
    observation === null ||
    criterionResults === null ||
    assistance === null ||
    sourceRefs === null ||
    assessmentOrigin === null ||
    validity === null ||
    createdAt === null
  ) {
    return null;
  }
  if (assessmentOrigin === 'model' && modelRunId === null) {
    issues.add(
      'EVIDENCE_MODEL_RUN_REQUIRED',
      `${path}.modelRunId`,
      'model originated evidence must record the model run id',
    );
    return null;
  }
  if (assessmentOrigin === 'model' && uncertainty === null) {
    issues.add(
      'EVIDENCE_MODEL_RUN_REQUIRED',
      `${path}.uncertainty`,
      'model originated evidence must record uncertainty',
    );
    return null;
  }
  if (!checkSafeText(observation, `${path}.observation`, issues)) return null;
  return {
    schemaVersion: 1,
    id,
    attemptId,
    learnerId,
    courseEditionId,
    packVersion,
    conceptId,
    kind,
    observation,
    criterionResults,
    assistance,
    sourceRefs,
    assessmentOrigin,
    modelRunId,
    uncertainty,
    validity,
    createdAt,
  };
}

export const validateEvidence: (input: unknown) => ValidationResult<Evidence> =
  validateWith(readEvidenceAt);

export function readAssessmentAt(
  value: unknown,
  path: string,
  issues: IssueCollector,
): Assessment | null {
  const obj = readObject(
    value,
    path,
    [
      'schemaVersion',
      'id',
      'attemptId',
      'conceptId',
      'learnerId',
      'courseEditionId',
      'packVersion',
      'state',
      'rationale',
      'evidenceIds',
      'rubricVersion',
      'evaluatorVersion',
      'assessedAt',
      'validity',
      'revision',
    ],
    issues,
  );
  if (obj === null) return null;
  readSchemaVersion(obj, path, issues);
  const id = readId(obj, 'id', path, issues);
  const attemptId = readId(obj, 'attemptId', path, issues, { nullable: true });
  const conceptId = readId(obj, 'conceptId', path, issues);
  const learnerId = readId(obj, 'learnerId', path, issues);
  const courseEditionId = readId(obj, 'courseEditionId', path, issues);
  const packVersion = readString(obj, 'packVersion', path, issues, {
    pattern: VERSION_LABEL_PATTERN,
  });
  const state = readEnum(obj, 'state', path, issues, ASSESSMENT_STATES);
  const rationale = readString(obj, 'rationale', path, issues, { minLength: 1 });
  const evidenceIds = readStringArray(obj, 'evidenceIds', path, issues, { idItems: true });
  const rubricVersion = readString(obj, 'rubricVersion', path, issues, {
    pattern: VERSION_LABEL_PATTERN,
  });
  const evaluatorVersion = readString(obj, 'evaluatorVersion', path, issues, {
    pattern: VERSION_LABEL_PATTERN,
  });
  const assessedAt = readTimestamp(obj, 'assessedAt', path, issues);
  const validity = readEnum(obj, 'validity', path, issues, VALIDITY_STATES);
  const revision = readNumber(obj, 'revision', path, issues, { integer: true, min: 0 });
  if (
    id === null ||
    conceptId === null ||
    learnerId === null ||
    courseEditionId === null ||
    packVersion === null ||
    state === null ||
    rationale === null ||
    evidenceIds === null ||
    rubricVersion === null ||
    evaluatorVersion === null ||
    assessedAt === null ||
    validity === null ||
    revision === null
  ) {
    return null;
  }
  if (evidenceIds.length === 0) {
    issues.add(
      'ASSESSMENT_WITHOUT_EVIDENCE',
      `${path}.evidenceIds`,
      'an assessment requires at least one evidence id',
    );
    return null;
  }
  if (validity === 'pending' && state === 'supported') {
    issues.add(
      'LOW_CONFIDENCE_UPGRADE',
      `${path}.state`,
      'pending/low-confidence assessments must not set state=supported',
    );
    return null;
  }
  return {
    schemaVersion: 1,
    id,
    attemptId,
    conceptId,
    learnerId,
    courseEditionId,
    packVersion,
    state,
    rationale,
    evidenceIds,
    rubricVersion,
    evaluatorVersion,
    assessedAt,
    validity,
    revision,
  };
}

export const validateAssessment: (input: unknown) => ValidationResult<Assessment> =
  validateWith(readAssessmentAt);

export function readSelfReportAt(
  value: unknown,
  path: string,
  issues: IssueCollector,
): SelfReport | null {
  const obj = readObject(
    value,
    path,
    [
      'schemaVersion',
      'id',
      'learnerId',
      'courseEditionId',
      'packVersion',
      'conceptId',
      'claimedState',
      'createdAt',
    ],
    issues,
  );
  if (obj === null) return null;
  readSchemaVersion(obj, path, issues);
  const id = readId(obj, 'id', path, issues);
  const learnerId = readId(obj, 'learnerId', path, issues);
  const courseEditionId = readId(obj, 'courseEditionId', path, issues);
  const packVersion = readString(obj, 'packVersion', path, issues, {
    pattern: VERSION_LABEL_PATTERN,
  });
  const conceptId = readId(obj, 'conceptId', path, issues);
  const claimedState = readEnum(obj, 'claimedState', path, issues, SELF_REPORT_STATES);
  const createdAt = readTimestamp(obj, 'createdAt', path, issues);
  if (
    id === null ||
    learnerId === null ||
    courseEditionId === null ||
    packVersion === null ||
    conceptId === null ||
    claimedState === null ||
    createdAt === null
  ) {
    return null;
  }
  return {
    schemaVersion: 1,
    id,
    learnerId,
    courseEditionId,
    packVersion,
    conceptId,
    claimedState,
    createdAt,
  };
}

export const validateSelfReport: (input: unknown) => ValidationResult<SelfReport> =
  validateWith(readSelfReportAt);

function readLearningProgress(
  value: unknown,
  path: string,
  issues: IssueCollector,
): LearningProgress | null {
  const obj = readObject(value, path, ['state', 'startedAt', 'lastCompletedAt'], issues);
  if (obj === null) return null;
  const state = readEnum(obj, 'state', path, issues, LEARNING_STATES);
  const startedAt = readTimestamp(obj, 'startedAt', path, issues, { nullable: true });
  const lastCompletedAt = readTimestamp(obj, 'lastCompletedAt', path, issues, { nullable: true });
  if (state === null) return null;
  if (state === 'not_started' && (startedAt !== null || lastCompletedAt !== null)) {
    issues.add('PROGRESS_INVARIANT', path, 'not_started progress must not carry timestamps');
    return null;
  }
  if (state === 'in_progress' && startedAt === null) {
    issues.add('PROGRESS_INVARIANT', `${path}.startedAt`, 'in_progress requires startedAt');
    return null;
  }
  if (state === 'completed' && lastCompletedAt === null) {
    issues.add('PROGRESS_INVARIANT', `${path}.lastCompletedAt`, 'completed requires lastCompletedAt');
    return null;
  }
  return { state, startedAt, lastCompletedAt };
}

function readUnderstandingProgress(
  value: unknown,
  path: string,
  issues: IssueCollector,
): UnderstandingProgress | null {
  const obj = readObject(value, path, ['state', 'assessmentId', 'updatedAt', 'validity'], issues);
  if (obj === null) return null;
  const state = readEnum(obj, 'state', path, issues, UNDERSTANDING_STATES);
  const assessmentId = readId(obj, 'assessmentId', path, issues, { nullable: true });
  const updatedAt = readTimestamp(obj, 'updatedAt', path, issues, { nullable: true });
  const validity = readEnum(obj, 'validity', path, issues, VALIDITY_STATES);
  if (state === null || validity === null) return null;
  if (state === 'unassessed' && assessmentId !== null) {
    issues.add('PROGRESS_INVARIANT', `${path}.assessmentId`, 'unassessed must not point at an assessment');
    return null;
  }
  if (state !== 'unassessed' && assessmentId === null) {
    issues.add('PROGRESS_INVARIANT', `${path}.assessmentId`, 'an assessed state requires assessmentId');
    return null;
  }
  if (state === 'supported' && validity !== 'current') {
    issues.add(
      'PROGRESS_INVARIANT',
      `${path}.state`,
      'supported requires validity=current; stale evidence cannot keep a strong state',
    );
    return null;
  }
  return { state, assessmentId, updatedAt, validity };
}

function readReviewRecord(value: unknown, path: string, issues: IssueCollector): ReviewRecord | null {
  const obj = readObject(
    value,
    path,
    ['lastCompletedAt', 'dueAt', 'activeSessionId', 'latestOutcome', 'policyVersion'],
    issues,
  );
  if (obj === null) return null;
  const lastCompletedAt = readTimestamp(obj, 'lastCompletedAt', path, issues, { nullable: true });
  const dueAt = readTimestamp(obj, 'dueAt', path, issues, { nullable: true });
  const activeSessionId = readId(obj, 'activeSessionId', path, issues, { nullable: true });
  const latestOutcome = readEnum(obj, 'latestOutcome', path, issues, REVIEW_OUTCOMES, {
    nullable: true,
  });
  const policyVersion = readString(obj, 'policyVersion', path, issues, { minLength: 1 });
  if (policyVersion === null) return null;
  if ((lastCompletedAt === null) !== (latestOutcome === null)) {
    issues.add(
      'REVIEW_INVARIANT',
      path,
      'lastCompletedAt and latestOutcome must both be null or both be set',
    );
    return null;
  }
  return { lastCompletedAt, dueAt, activeSessionId, latestOutcome, policyVersion };
}

function readLastPosition(
  value: unknown,
  path: string,
  issues: IssueCollector,
): LastPosition | null {
  const obj = readObject(value, path, ['sessionId', 'activityId', 'cursor', 'updatedAt'], issues);
  if (obj === null) return null;
  const sessionId = readId(obj, 'sessionId', path, issues, { nullable: true });
  const activityId = readId(obj, 'activityId', path, issues, { nullable: true });
  const cursor = readString(obj, 'cursor', path, issues, { nullable: true, maxLength: 500 });
  const updatedAt = readTimestamp(obj, 'updatedAt', path, issues, { nullable: true });
  return { sessionId, activityId, cursor, updatedAt };
}

export function readConceptProgressAt(
  value: unknown,
  path: string,
  issues: IssueCollector,
): ConceptProgress | null {
  const obj = readObject(
    value,
    path,
    [
      'schemaVersion',
      'learnerId',
      'courseEditionId',
      'packVersion',
      'conceptId',
      'learning',
      'understanding',
      'review',
      'lastPosition',
      'revision',
    ],
    issues,
  );
  if (obj === null) return null;
  readSchemaVersion(obj, path, issues);
  const learnerId = readId(obj, 'learnerId', path, issues);
  const courseEditionId = readId(obj, 'courseEditionId', path, issues);
  const packVersion = readString(obj, 'packVersion', path, issues, {
    pattern: VERSION_LABEL_PATTERN,
  });
  const conceptId = readId(obj, 'conceptId', path, issues);
  const learning = readLearningProgress(obj['learning'], `${path}.learning`, issues);
  const understanding = readUnderstandingProgress(
    obj['understanding'],
    `${path}.understanding`,
    issues,
  );
  const review = readReviewRecord(obj['review'], `${path}.review`, issues);
  const lastPosition = readLastPosition(obj['lastPosition'], `${path}.lastPosition`, issues);
  const revision = readNumber(obj, 'revision', path, issues, { integer: true, min: 0 });
  if (
    learnerId === null ||
    courseEditionId === null ||
    packVersion === null ||
    conceptId === null ||
    learning === null ||
    understanding === null ||
    review === null ||
    lastPosition === null ||
    revision === null
  ) {
    return null;
  }
  return {
    schemaVersion: 1,
    learnerId,
    courseEditionId,
    packVersion,
    conceptId,
    learning,
    understanding,
    review,
    lastPosition,
    revision,
  };
}

export const validateConceptProgress: (input: unknown) => ValidationResult<ConceptProgress> =
  validateWith(readConceptProgressAt);


