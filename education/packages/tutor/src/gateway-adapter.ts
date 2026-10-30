/**
 * Adapter from the frozen DSH `TutorGateway` port to the structured tutor
 * gateway used by the teaching service.
 *
 * Real DSH semantics (agent loop, session restore, tool allowlist at host level)
 * are T13's responsibility. This adapter only defines *how* a DSH turn becomes
 * the structured envelope: the DSH profile must ask the model to emit a fenced
 * JSON block with `tutorSignals` (and optionally `evidenceCandidates`); the
 * adapter strips that block from the student-visible text, validates the signal
 * envelope and passes tool use to the host (the host owns the loop).
 *
 * Without a `GradePort` the adapter reports UNSUPPORTED for grading instead of
 * faking a grade.
 */

import type {
  ActivityAttempt,
  GradePort,
  ModelDescriptor,
  RequestContext,
  ServiceResult,
  Session,
  Timestamp,
  TutorCapabilities,
  TutorGateway,
  TutorTurnResult,
} from '@edu/domain';
import { errResult, okResult } from '@edu/domain';
import type {
  TutorGatewayBinding,
  TutorGradeRequest,
  TutorModelGateway,
  TutorModelToolCall,
  TutorModelTurn,
  TutorModelTurnRequest,
} from './types.js';
import { readTutorSignals, withAnswerDisclosure } from './pedagogy.js';
import { fromServiceError } from './errors.js';

export interface DomainGatewayAdapterOptions {
  /** Fixed DSH gateway (host binding is T13). */
  readonly gateway: TutorGateway;
  /** Frozen grading port; a text-only route cannot grade by itself. */
  readonly gradePort?: GradePort;
}

interface ParsedEnvelope {
  readonly text: string;
  readonly signals: ReturnType<typeof readTutorSignals>;
  readonly evidenceCandidates: TutorModelTurn['evidenceCandidates'];
  readonly modelRunId: string | null;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

/**
 * Extracts the structured teaching envelope from a model reply.
 * The envelope is model output (untrusted): invalid pieces are dropped, not
 * trusted. It is never executed and never expands tool permissions.
 */
export function parseTutorEnvelope(rawText: string): ParsedEnvelope {
  const fence = /```(?:json)?\s*([\s\S]*?)```/i.exec(rawText);
  const candidateText = fence?.[1]?.trim();
  if (candidateText === undefined || candidateText.length === 0) {
    return {
      text: rawText.trim(),
      signals: withAnswerDisclosure(readTutorSignals({}), rawText),
      evidenceCandidates: [],
      modelRunId: null,
    };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(candidateText);
  } catch {
    return {
      text: rawText.trim(),
      signals: withAnswerDisclosure(readTutorSignals({}), rawText),
      evidenceCandidates: [],
      modelRunId: null,
    };
  }
  const record = asRecord(parsed);
  if (record === null) {
    return {
      text: rawText.trim(),
      signals: withAnswerDisclosure(readTutorSignals({}), rawText),
      evidenceCandidates: [],
      modelRunId: null,
    };
  }
  const candidates = Array.isArray(record.evidenceCandidates) ? record.evidenceCandidates : [];
  const cleaned =
    typeof record.studentText === 'string'
      ? record.studentText
      : typeof record.message === 'string'
        ? record.message
        : rawText.replace(fence?.[0] ?? '', '').trim();
  // F6: a model that gives the complete answer/steps under a probe decision must
  // still be recorded as disclosure. The explicit flag wins; unambiguous prose
  // markers are the safety net.
  const signals = withAnswerDisclosure(readTutorSignals(record.tutorSignals ?? record.signals ?? {}), cleaned);
  const modelRunId =
    typeof record.modelRunId === 'string' && record.modelRunId.length > 0 ? record.modelRunId : null;
  return {
    text: cleaned,
    signals,
    evidenceCandidates: candidates as TutorModelTurn['evidenceCandidates'],
    modelRunId,
  };
}

function mapServiceError<T>(error: { code: string; message: string; retryable: boolean; detailsRef?: string }): ServiceResult<T> {
  const mapped = fromServiceError(error as never);
  return errResult(
    error.code as never,
    mapped.message,
    mapped.retryable,
    mapped.detailsRef,
  );
}

export function adaptTutorGateway(options: DomainGatewayAdapterOptions): TutorModelGateway {
  const { gateway, gradePort } = options;

  return {
    kind: gateway.kind,
    async capabilities(ctx: RequestContext): Promise<ServiceResult<TutorCapabilities>> {
      return gateway.capabilities(ctx);
    },
    async startSession(
      ctx: RequestContext,
      session: Session,
    ): Promise<ServiceResult<TutorGatewayBinding>> {
      const started = await gateway.startSession(ctx, { session });
      if (!started.ok) return mapServiceError(started.error);
      return okResult(
        { model: started.data.model, dshSessionId: started.data.dshSessionId },
        started.revision,
      );
    },
    async completeTurn(
      ctx: RequestContext,
      request: TutorModelTurnRequest,
    ): Promise<ServiceResult<TutorModelTurn>> {
      const studentBlock = request.prompt.blocks.find((block) => block.kind === 'student_input');
      const sent: ServiceResult<TutorTurnResult> = await gateway.sendTurn(ctx, {
        sessionId: request.session.id,
        revision: request.state.revision,
        message: studentBlock?.content ?? null,
        activityId: request.state.currentActivityId,
        stream: request.stream,
        // T15 finding F2: the Skill/teaching policy must reach the model, not just the student text.
        systemInstruction: request.prompt.systemInstruction,
      });
      if (!sent.ok) return mapServiceError(sent.error);
      const envelope = parseTutorEnvelope(sent.data.text);
      const model: ModelDescriptor = sent.data.model;
      const toolCalls: readonly TutorModelToolCall[] = [];
      return okResult(
        {
          text: envelope.text,
          signals: envelope.signals,
          evidenceCandidates: envelope.evidenceCandidates,
          toolCalls,
          modelRunId: envelope.modelRunId,
          model,
        },
        sent.revision,
      );
    },
    async grade(
      ctx: RequestContext,
      request: TutorGradeRequest,
    ): Promise<ServiceResult<import('@edu/domain').GradeResult>> {
      if (gradePort === undefined) {
        return errResult(
          'UNSUPPORTED',
          'this DSH route has no GradePort wired; grading is unavailable until T13 binds one',
        );
      }
      const attempt: ActivityAttempt = request.attempt;
      return gradePort.grade(ctx, {
        attempt,
        activity: request.activity,
        rubric: request.rubric,
        mode: 'model',
        modelRunId: request.modelRunId,
      });
    },
    async endSession(
      ctx: RequestContext,
      request: { readonly sessionId: string; readonly reason: 'completed' | 'abandoned' },
    ): Promise<ServiceResult<{ readonly endedAt: Timestamp }>> {
      return gateway.endSession(ctx, request);
    },
  };
}
