/**
 * Journal replay for learner scoped snapshots.
 *
 * The journal stays the authority; snapshots are disposable caches rebuilt by
 * this reducer. Unknown or invalid payloads are surfaced in `invalidPayloads`
 * instead of being silently treated as valid learning facts.
 */

import type {
  ActivityAttempt,
  Assessment,
  Evidence,
  JournalCommand,
  JournalEffect,
  SelfReport,
} from '@edu/domain';
import {
  validateActivityAttempt,
  validateAssessment,
  validateEvidence,
  validateSelfReport,
} from '@edu/domain';
import type { AttemptSnapshotState, LearnerReplayState } from './types.js';

function emptyState(learnerId: string, lastSeq: number): {
  attempts: Map<string, AttemptSnapshotState>;
  evidence: Evidence[];
  assessments: Assessment[];
  selfReports: SelfReport[];
  progressEffects: JournalEffect[];
  legacyRecords: Record<string, unknown>[];
  invalidPayloads: { seq: number; message: string }[];
} {
  return {
    attempts: new Map<string, AttemptSnapshotState>(),
    evidence: [],
    assessments: [],
    selfReports: [],
    progressEffects: [],
    legacyRecords: [],
    invalidPayloads: [],
  };
}

function payloadRecord(command: JournalCommand): Record<string, unknown> {
  return command.payload;
}

export function replayLearner(
  learnerId: string,
  commits: readonly JournalCommand[],
  journalLastSeq: number,
): LearnerReplayState {
  const state = emptyState(learnerId, journalLastSeq);
  let processed = 0;

  for (const command of commits) {
    if (command.learnerId !== learnerId) continue;
    processed += 1;
    const payload = payloadRecord(command);
    if (command.type === 'attempt.submitted') {
      const result = validateActivityAttempt(payload['attempt']);
      if (!result.ok) {
        state.invalidPayloads.push({
          seq: command.seq,
          message: `attempt.submitted payload invalid: ${result.issues[0]?.message ?? 'unknown'}`,
        });
        continue;
      }
      const attempt: ActivityAttempt = result.value;
      state.attempts.set(attempt.id, {
        attemptId: attempt.id,
        attempt,
        phase: 'attempt_saved',
        feedbackState: 'pending',
        revision: 0,
        lastRequestId: command.requestId,
        updatedAt: command.occurredAt,
      });
      continue;
    }
    if (command.type === 'assessment.committed') {
      const assessmentResult = validateAssessment(payload['assessment']);
      if (!assessmentResult.ok) {
        state.invalidPayloads.push({
          seq: command.seq,
          message: `assessment.committed assessment invalid: ${assessmentResult.issues[0]?.message ?? 'unknown'}`,
        });
        continue;
      }
      const assessment: Assessment = assessmentResult.value;
      const evidenceRaw = payload['evidence'];
      if (!Array.isArray(evidenceRaw)) {
        state.invalidPayloads.push({
          seq: command.seq,
          message: 'assessment.committed evidence must be an array',
        });
        continue;
      }
      const evidence: Evidence[] = [];
      let evidenceOk = true;
      for (const item of evidenceRaw) {
        const evidenceResult = validateEvidence(item);
        if (!evidenceResult.ok) {
          evidenceOk = false;
          state.invalidPayloads.push({
            seq: command.seq,
            message: `assessment.committed evidence invalid: ${evidenceResult.issues[0]?.message ?? 'unknown'}`,
          });
          break;
        }
        evidence.push(evidenceResult.value);
      }
      if (!evidenceOk) continue;
      const attempt = state.attempts.get(assessment.attemptId ?? '');
      if (attempt === undefined) {
        state.invalidPayloads.push({
          seq: command.seq,
          message: 'assessment.committed has no saved attempt (attempt must be saved first)',
        });
        continue;
      }
      state.attempts.set(attempt.attemptId, {
        ...attempt,
        phase: 'assessment_committed',
        feedbackState: 'saved',
        revision: assessment.revision,
        lastRequestId: command.requestId,
        updatedAt: command.occurredAt,
      });
      for (const item of evidence) {
        if (!state.evidence.some((existing) => existing.id === item.id)) state.evidence.push(item);
      }
      if (!state.assessments.some((existing) => existing.id === assessment.id)) {
        state.assessments.push(assessment);
      }
      state.progressEffects.push(...command.effects);
      continue;
    }
    if (command.type === 'assessment.failed' || command.type === 'assessment.cancelled') {
      const attemptId = payload['attemptId'];
      const revision = payload['revision'];
      if (typeof attemptId !== 'string' || typeof revision !== 'number') {
        state.invalidPayloads.push({
          seq: command.seq,
          message: `${command.type} payload needs attemptId and revision`,
        });
        continue;
      }
      const attempt = state.attempts.get(attemptId);
      if (attempt === undefined) continue;
      state.attempts.set(attemptId, {
        ...attempt,
        phase: command.type === 'assessment.failed' ? 'assessment_failed' : 'assessment_cancelled',
        feedbackState: command.type === 'assessment.failed' ? 'failed' : 'cancelled',
        revision,
        lastRequestId: command.requestId,
        updatedAt: command.occurredAt,
      });
      continue;
    }
    if (command.type === 'self_report.recorded') {
      const result = validateSelfReport(payload['selfReport']);
      if (!result.ok) {
        state.invalidPayloads.push({
          seq: command.seq,
          message: `self_report.recorded payload invalid: ${result.issues[0]?.message ?? 'unknown'}`,
        });
        continue;
      }
      state.selfReports.push(result.value);
      continue;
    }
    if (command.type === 'legacy.migrated') {
      state.legacyRecords.push(payload);
    }
  }

  return {
    learnerId,
    lastSeq: journalLastSeq,
    commits: processed,
    attempts: state.attempts,
    evidence: state.evidence,
    assessments: state.assessments,
    selfReports: state.selfReports,
    progressEffects: state.progressEffects,
    legacyRecords: state.legacyRecords,
    invalidPayloads: state.invalidPayloads,
  };
}

export function replayStatePayload(state: LearnerReplayState): Record<string, unknown> {
  return {
    schemaVersion: 1,
    learnerId: state.learnerId,
    lastSeq: state.lastSeq,
    commits: state.commits,
    attempts: Object.fromEntries(
      [...state.attempts.entries()].map(([attemptId, attempt]) => [attemptId, attempt]),
    ),
    evidence: state.evidence,
    assessments: state.assessments,
    selfReports: state.selfReports,
    progressEffects: state.progressEffects,
    legacyRecords: state.legacyRecords,
    invalidPayloads: state.invalidPayloads,
  };
}
