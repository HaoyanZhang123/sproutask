/**
 * Deterministic mock tutor used only by offline tests.
 *
 * It is explicitly labelled `isMock: true` and never announces DSH access. It
 * exists so T02–T12 can exercise orchestration without a real model budget.
 */

import type {
  ModelDescriptor,
  RequestContext,
  ServiceResult,
  TutorCapabilities,
  TutorGateway,
  TutorSessionBinding,
  TutorSessionStartRequest,
  TutorTurnRequest,
  TutorTurnResult,
} from '@edu/domain';
import { errResult, okResult } from '@edu/domain';

export const MOCK_MODEL: ModelDescriptor = {
  provider: 'mock',
  model: 'mock-tutor-v1',
  text: true,
  image: false,
  isMock: true,
};

export interface MockTutorOptions {
  readonly replies?: readonly string[];
  readonly failWith?: { readonly code: 'UNAVAILABLE' | 'TIMEOUT'; readonly message: string };
}

export interface MockTutorGateway extends TutorGateway {
  readonly kind: 'mock';
  readonly calls: readonly string[];
}

export function createMockTutorGateway(options: MockTutorOptions = {}): MockTutorGateway {
  const calls: string[] = [];
  const replies = [...(options.replies ?? [])];
  const revisions = new Map<string, number>();

  const failure = <T>(): ServiceResult<T> =>
    options.failWith === undefined
      ? errResult<T>('UNAVAILABLE', 'mock tutor is not configured')
      : errResult<T>(options.failWith.code, options.failWith.message, true);

  return {
    kind: 'mock',
    calls,
    async capabilities(_ctx: RequestContext): Promise<ServiceResult<TutorCapabilities>> {
      return okResult(
        { model: MOCK_MODEL, text: true, image: false, authStatus: 'unavailable' },
        0,
      );
    },
    async startSession(
      ctx: RequestContext,
      request: TutorSessionStartRequest,
    ): Promise<ServiceResult<TutorSessionBinding>> {
      calls.push('startSession');
      if (options.failWith !== undefined) return failure();
      const revision = revisions.get(request.session.id) ?? 0;
      return okResult(
        {
          educationSessionId: request.session.id,
          dshSessionId: null,
          model: MOCK_MODEL,
          revision,
        },
        revision,
      );
    },
    async resumeSession(
      _ctx: RequestContext,
      request: { readonly sessionId: string; readonly revision: number },
    ): Promise<ServiceResult<TutorSessionBinding>> {
      calls.push('resumeSession');
      if (options.failWith !== undefined) return failure();
      const revision = revisions.get(request.sessionId) ?? request.revision;
      return okResult(
        {
          educationSessionId: request.sessionId,
          dshSessionId: null,
          model: MOCK_MODEL,
          revision,
        },
        revision,
      );
    },
    async sendTurn(
      ctx: RequestContext,
      request: TutorTurnRequest,
    ): Promise<ServiceResult<TutorTurnResult>> {
      calls.push('sendTurn');
      if (options.failWith !== undefined) return failure();
      const revision = (revisions.get(request.sessionId) ?? 0) + 1;
      revisions.set(request.sessionId, revision);
      const text =
        replies.shift() ??
        `[mock] deterministic reply for session ${request.sessionId} at ${ctx.now} (not a DSH model call)`;
      return okResult(
        {
          sessionId: request.sessionId,
          revision,
          text,
          streaming: false,
          model: MOCK_MODEL,
          toolNames: [],
        },
        revision,
      );
    },
    async endSession(
      ctx: RequestContext,
      _request: { readonly sessionId: string; readonly reason: 'completed' | 'abandoned' },
    ): Promise<ServiceResult<{ readonly endedAt: string }>> {
      calls.push('endSession');
      if (options.failWith !== undefined) return failure();
      return okResult({ endedAt: ctx.now }, 0);
    },
  };
}
