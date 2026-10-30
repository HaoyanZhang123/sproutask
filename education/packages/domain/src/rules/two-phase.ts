/**
 * Two-phase attempt/assessment commit semantics (05 §7).
 *
 * Phase 1: `attempt_saved` persists the raw answer and a pending feedback
 * state; once durable the answer is confirmed saved, before any model call.
 * Phase 2: `assessment_committed` writes the evidence + progress/review
 * effects atomically (one journal line). Failure/cancel only changes the
 * pending feedback state and never marks the answer wrong. A cancelled grading
 * request must not publish a late assessment.
 */

import type { Id, Timestamp } from '../primitives.js';
import {
  IssueCollector,
  finish,
  readEnum,
  readId,
  readNumber,
  readObject,
  readSchemaVersion,
  readString,
  readTimestamp,
  validateWith,
  type ValidationResult,
} from '../validation.js';

export const ATTEMPT_COMMIT_PHASES = [
  'attempt_saved',
  'assessment_committed',
  'assessment_failed',
  'assessment_cancelled',
] as const;
export type AttemptCommitPhase = (typeof ATTEMPT_COMMIT_PHASES)[number];

export const FEEDBACK_STATES = ['pending', 'saved', 'failed', 'cancelled'] as const;
export type FeedbackState = (typeof FEEDBACK_STATES)[number];

export interface AttemptCommitState {
  readonly schemaVersion: 1;
  readonly attemptId: Id;
  readonly phase: AttemptCommitPhase;
  readonly feedbackState: FeedbackState;
  /** Monotonic commit revision for this attempt. */
  readonly revision: number;
  readonly lastRequestId: string;
  readonly updatedAt: Timestamp;
}

const PHASE_FEEDBACK: Record<AttemptCommitPhase, FeedbackState> = {
  attempt_saved: 'pending',
  assessment_committed: 'saved',
  assessment_failed: 'failed',
  assessment_cancelled: 'cancelled',
};

function readAttemptCommitState(
  value: unknown,
  path: string,
  issues: IssueCollector,
): AttemptCommitState | null {
  const obj = readObject(
    value,
    path,
    ['schemaVersion', 'attemptId', 'phase', 'feedbackState', 'revision', 'lastRequestId', 'updatedAt'],
    issues,
  );
  if (obj === null) return null;
  readSchemaVersion(obj, path, issues);
  const attemptId = readId(obj, 'attemptId', path, issues);
  const phase = readEnum(obj, 'phase', path, issues, ATTEMPT_COMMIT_PHASES);
  const feedbackState = readEnum(obj, 'feedbackState', path, issues, FEEDBACK_STATES);
  const revision = readNumber(obj, 'revision', path, issues, { integer: true, min: 0 });
  const lastRequestId = readString(obj, 'lastRequestId', path, issues, {
    minLength: 1,
    maxLength: 128,
  });
  const updatedAt = readTimestamp(obj, 'updatedAt', path, issues);
  if (
    attemptId === null ||
    phase === null ||
    feedbackState === null ||
    revision === null ||
    lastRequestId === null ||
    updatedAt === null
  ) {
    return null;
  }
  if (PHASE_FEEDBACK[phase] !== feedbackState) {
    issues.add(
      'ATTEMPT_COMMIT_INVALID',
      `${path}.feedbackState`,
      `phase ${phase} requires feedbackState=${PHASE_FEEDBACK[phase]}`,
    );
    return null;
  }
  return { schemaVersion: 1, attemptId, phase, feedbackState, revision, lastRequestId, updatedAt };
}

export const validateAttemptCommitState: (input: unknown) => ValidationResult<AttemptCommitState> =
  validateWith(readAttemptCommitState);

/**
 * Phase transition guard.
 * - answer is always saved before assessment: only attempt_saved may start a
 *   grading round;
 * - failed grading can be retried on the same attempt (revision increases);
 * - cancelled grading rejects a late committed assessment;
 * - committed is terminal for that attempt (re-grading needs a new attempt).
 */
export function transitionAttemptCommit(
  previous: AttemptCommitState,
  next: AttemptCommitState,
): ValidationResult<AttemptCommitState> {
  const issues = new IssueCollector();
  if (previous.attemptId !== next.attemptId) {
    issues.add('ATTEMPT_COMMIT_INVALID', '$.attemptId', 'a commit state cannot move across attempts');
  }
  if (next.revision < previous.revision) {
    issues.add('ATTEMPT_COMMIT_INVALID', '$.revision', 'commit revision must not decrease');
  }
  if (previous.phase === next.phase && previous.revision === next.revision) {
    // Idempotent retry of the same commit: accepted, nothing changes.
    if (previous.lastRequestId === next.lastRequestId) return finish(previous, issues);
  }
  if (previous.phase === 'assessment_committed' && next.phase !== 'assessment_committed') {
    issues.add(
      'ATTEMPT_COMMIT_INVALID',
      '$.phase',
      'a committed assessment is terminal; retries must not create a new attempt',
    );
  }
  if (previous.phase === 'assessment_cancelled' && next.phase === 'assessment_committed') {
    issues.add(
      'ATTEMPT_COMMIT_INVALID',
      '$.phase',
      'a cancelled grading request must not publish a late assessment',
    );
  }
  if (next.phase === 'assessment_committed' && next.revision <= previous.revision && previous.phase !== 'assessment_committed') {
    issues.add(
      'ATTEMPT_COMMIT_INVALID',
      '$.revision',
      'a committed assessment must advance the attempt revision',
    );
  }
  if (next.phase !== 'attempt_saved' && next.phase !== 'assessment_committed') {
    // failed/cancelled must not judge the answer; feedback state is pending-like.
    if (next.feedbackState !== 'failed' && next.feedbackState !== 'cancelled') {
      issues.add('ATTEMPT_COMMIT_INVALID', '$.feedbackState', 'failure/cancel only changes feedback state');
    }
  }
  return finish(next, issues);
}

/** Dedupe key required by 05 §7 for assessment commits. */
export function assessmentCommitKey(
  attemptId: Id,
  graderVersion: string,
  revision: number,
): string {
  if (attemptId.trim().length === 0 || graderVersion.trim().length === 0) {
    throw new Error('assessmentCommitKey requires attemptId and graderVersion');
  }
  if (!Number.isInteger(revision) || revision < 0) {
    throw new Error('assessmentCommitKey requires a non-negative integer revision');
  }
  return `${attemptId}|${graderVersion}|${revision}`;
}
