/**
 * Scripted mock teaching gateway (offline replay only).
 *
 * The descriptor is always `isMock: true` so no report can mistake a scripted
 * turn for a real DSH/model response. The mock returns the same structured
 * envelope a live model must return: semantic signals, evidence candidates,
 * tool-call proposals and a scripted grade. One script entry serves both the
 * grading call and the teaching turn of the same step; only `completeTurn`
 * advances the cursor.
 */

import type {
  EvidenceCandidate,
  GradeCriterion,
  GradeResult,
  Id,
  ModelDescriptor,
  RequestContext,
  ServiceResult,
  Session,
  Timestamp,
  TutorCapabilities,
} from '@edu/domain';
import { errResult, okResult } from '@edu/domain';
import type {
  TutorErrorCode,
  TutorGatewayBinding,
  TutorGradeRequest,
  TutorModelGateway,
  TutorModelToolCall,
  TutorModelTurn,
  TutorModelTurnRequest,
  TutorSignals,
} from './types.js';
import { DEFAULT_TUTOR_SIGNALS } from './types.js';
import { readTutorSignals } from './pedagogy.js';
import { toServiceError, tutorError } from './errors.js';

export interface MockGradeScript {
  readonly criteria: readonly GradeCriterion[];
  readonly feedback?: string;
  readonly uncertainties?: readonly string[];
  readonly requiresClarification?: boolean;
  readonly sourceRefs?: readonly Id[];
  readonly graderVersion?: string;
}

export interface MockTurnStep {
  readonly text: string;
  readonly signals?: Partial<TutorSignals>;
  readonly evidenceCandidates?: readonly EvidenceCandidate[];
  readonly grade?: MockGradeScript;
  readonly toolCalls?: readonly TutorModelToolCall[];
  /** Scripted transport/auth/quota failure for the teaching turn. */
  readonly error?: TutorErrorCode;
  /** Scripted failure of the grading call only. */
  readonly gradeError?: TutorErrorCode;
  /** Fails only the first grading call for this step, then succeeds (retry test). */
  readonly gradeErrorOnce?: TutorErrorCode;
  /** Hook used to cancel/timeout the turn between persistence and grading. */
  readonly beforeGrade?: () => void | Promise<void>;
  readonly beforeTurn?: () => void | Promise<void>;
}

export interface MockGatewayOptions {
  readonly turns: readonly MockTurnStep[];
  readonly model?: Partial<ModelDescriptor>;
}

export interface MockTutorGateway extends TutorModelGateway {
  /** Clears per-session cursors (used between the two replay rounds). */
  reset(): void;
  turnIndex(sessionId: Id): number;
  readonly scriptedTurns: number;
}

const DEFAULT_MOCK_MODEL: ModelDescriptor = {
  provider: 'edu-mock',
  model: 'scripted-tutor-1',
  text: true,
  image: false,
  isMock: true,
};

function errorResult<T>(code: TutorErrorCode, message: string, retryable = false): ServiceResult<T> {
  const error = tutorError(code, message, retryable);
  return errResult(toServiceError(error).code, error.message, error.retryable, error.detailsRef);
}

export function createMockTutorGateway(options: MockGatewayOptions): MockTutorGateway {
  const model: ModelDescriptor = { ...DEFAULT_MOCK_MODEL, ...options.model, isMock: true };
  const cursors = new Map<Id, number>();
  const gradeCounts = new Map<Id, number>();

  function cursorOf(sessionId: Id): number {
    return cursors.get(sessionId) ?? 0;
  }

  function stepAt(sessionId: Id): MockTurnStep | undefined {
    return options.turns[cursorOf(sessionId)];
  }

  return {
    kind: 'mock',
    scriptedTurns: options.turns.length,
    reset() {
      cursors.clear();
      gradeCounts.clear();
    },
    turnIndex(sessionId: Id) {
      return cursorOf(sessionId);
    },
    async capabilities(_ctx: RequestContext): Promise<ServiceResult<TutorCapabilities>> {
      return okResult({ model, text: true, image: model.image, authStatus: 'available' as const }, 0);
    },
    async startSession(
      _ctx: RequestContext,
      session: Session,
    ): Promise<ServiceResult<TutorGatewayBinding>> {
      cursors.set(session.id, 0);
      return okResult({ model, dshSessionId: null }, 0);
    },
    async completeTurn(
      _ctx: RequestContext,
      request: TutorModelTurnRequest,
    ): Promise<ServiceResult<TutorModelTurn>> {
      const step = stepAt(request.session.id);
      if (step === undefined) {
        return errorResult('UNSUPPORTED', 'mock script exhausted; no further scripted turn');
      }
      if (step.error !== undefined) {
        return errorResult(step.error, `scripted gateway failure: ${step.error}`, step.error === 'NETWORK');
      }
      if (step.beforeTurn !== undefined) {
        await step.beforeTurn();
      }
      const index = cursorOf(request.session.id);
      cursors.set(request.session.id, index + 1);
      return okResult(
        {
          text: step.text,
          signals: readTutorSignals({ ...DEFAULT_TUTOR_SIGNALS, ...step.signals }),
          evidenceCandidates: step.evidenceCandidates ?? [],
          toolCalls: step.toolCalls ?? [],
          modelRunId: `mock-run-${index + 1}`,
          model,
        },
        index + 1,
      );
    },
    async grade(
      _ctx: RequestContext,
      request: TutorGradeRequest,
    ): Promise<ServiceResult<GradeResult>> {
      const step = stepAt(request.sessionId);
      if (step === undefined) {
        return errorResult('UNSUPPORTED', 'mock script exhausted; no scripted grade for this turn');
      }
      const gradeCount = (gradeCounts.get(request.sessionId) ?? 0) + 1;
      gradeCounts.set(request.sessionId, gradeCount);
      if (step.gradeErrorOnce !== undefined && gradeCount === 1) {
        return errorResult(
          step.gradeErrorOnce,
          `scripted first grading failure: ${step.gradeErrorOnce}`,
          step.gradeErrorOnce === 'NETWORK' || step.gradeErrorOnce === 'QUOTA' || step.gradeErrorOnce === 'TIMEOUT',
        );
      }
      if (step.gradeError !== undefined) {
        return errorResult(
          step.gradeError,
          `scripted grading failure: ${step.gradeError}`,
          step.gradeError === 'NETWORK' || step.gradeError === 'QUOTA' || step.gradeError === 'TIMEOUT',
        );
      }
      if (step.beforeGrade !== undefined) {
        await step.beforeGrade();
      }
      if (step.grade === undefined) {
        return errorResult('UNSUPPORTED', 'mock script has no grade for this turn');
      }
      const grade: GradeResult = {
        schemaVersion: 1,
        attemptId: request.attempt.id,
        criteria: [...step.grade.criteria],
        feedback: step.grade.feedback ?? 'scripted mock feedback (not a real model)',
        uncertainties: [...(step.grade.uncertainties ?? [])],
        evidenceCandidates: [...(step.evidenceCandidates ?? [])],
        requiresClarification: step.grade.requiresClarification ?? false,
        sourceRefs: [...(step.grade.sourceRefs ?? [])],
        graderVersion: step.grade.graderVersion ?? 'mock-grader-v1',
      };
      return okResult(grade, 0);
    },
    async endSession(
      _ctx: RequestContext,
      _request: { readonly sessionId: Id; readonly reason: 'completed' | 'abandoned' },
    ): Promise<ServiceResult<{ readonly endedAt: Timestamp }>> {
      return okResult({ endedAt: '1970-01-01T00:00:00Z' }, 0);
    },
  };
}

export type { EvidenceCandidate, GradeCriterion };
