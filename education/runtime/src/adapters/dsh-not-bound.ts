/**
 * Explicit "DSH runtime not bound" adapter.
 *
 * T00.runtimeReady is BLOCKED (no approved fixed DSH build source yet), so T01
 * must not fake a binding. Every tutor operation returns a clearly labelled
 * failure; capability queries still answer truthfully with bound: false.
 */

import type {
  AuthStatus,
  DshRuntimeInfo,
  HostPort,
  ModelDescriptor,
  RequestContext,
  RuntimeCapabilities,
  ServiceResult,
  TutorCapabilities,
  TutorGateway,
  TutorSessionBinding,
  TutorSessionStartRequest,
  TutorTurnRequest,
  TutorTurnResult,
} from '@edu/domain';
import { errResult, okResult } from '@edu/domain';

export const DSH_NOT_BOUND_MESSAGE = 'DSH runtime not bound: T00.runtimeReady BLOCKED';

const UNBOUND_MODEL: ModelDescriptor = {
  provider: 'none',
  model: 'none',
  text: false,
  image: false,
  isMock: false,
};

export interface DshRuntimeAdapter {
  readonly adapterVersion: string;
  probe(ctx: RequestContext): Promise<ServiceResult<DshRuntimeInfo>>;
  capabilities(ctx: RequestContext): Promise<ServiceResult<RuntimeCapabilities>>;
  authStatus(ctx: RequestContext): Promise<ServiceResult<AuthStatus>>;
  createTutorGateway(): TutorGateway;
}

export function createNotBoundTutorGateway(): TutorGateway {
  const fail = <T>(): ServiceResult<T> =>
    errResult<T>('NOT_IMPLEMENTED', DSH_NOT_BOUND_MESSAGE, false);
  return {
    kind: 'dsh',
    async capabilities(_ctx: RequestContext): Promise<ServiceResult<TutorCapabilities>> {
      return dirUnavailable();
    },
    async startSession(
      _ctx: RequestContext,
      _request: TutorSessionStartRequest,
    ): Promise<ServiceResult<TutorSessionBinding>> {
      return fail();
    },
    async resumeSession(
      _ctx: RequestContext,
      _request: { readonly sessionId: string; readonly revision: number },
    ): Promise<ServiceResult<TutorSessionBinding>> {
      return fail();
    },
    async sendTurn(
      _ctx: RequestContext,
      _request: TutorTurnRequest,
    ): Promise<ServiceResult<TutorTurnResult>> {
      return fail();
    },
    async endSession(
      _ctx: RequestContext,
      _request: { readonly sessionId: string; readonly reason: 'completed' | 'abandoned' },
    ): Promise<ServiceResult<{ readonly endedAt: string }>> {
      return fail();
    },
  };
}

function dirUnavailable(): ServiceResult<TutorCapabilities> {
  // Not an error: the truthful state is "no model route available".
  return errResult('UNAVAILABLE', DSH_NOT_BOUND_MESSAGE, false);
}

export function createNotBoundDshRuntimeAdapter(): DshRuntimeAdapter {
  return {
    adapterVersion: 'dsh-adapter-not-bound-0.1.0',
    async probe(_ctx: RequestContext): Promise<ServiceResult<DshRuntimeInfo>> {
      return errResult('NOT_IMPLEMENTED', DSH_NOT_BOUND_MESSAGE, false);
    },
    async capabilities(_ctx: RequestContext): Promise<ServiceResult<RuntimeCapabilities>> {
      return okResult(
        {
          dsh: { bound: false, version: null, sourceRef: null },
          model: { text: false, image: false },
          tools: [],
          network: 'loopback_only',
        },
        0,
      );
    },
    async authStatus(_ctx: RequestContext): Promise<ServiceResult<AuthStatus>> {
      return okResult(
        { method: 'none', status: 'unknown', lastCheckedAt: null, accountRef: null },
        0,
      );
    },
    createTutorGateway(): TutorGateway {
      return createNotBoundTutorGateway();
    },
  };
}

export function createHostPortFromAdapter(adapter: DshRuntimeAdapter): HostPort {
  return {
    capabilities: (ctx) => adapter.capabilities(ctx),
    authStatus: (ctx) => adapter.authStatus(ctx),
  };
}

export function unboundRuntimeCapabilities(): RuntimeCapabilities {
  return {
    dsh: { bound: false, version: null, sourceRef: null },
    model: { text: false, image: false },
    tools: [],
    network: 'loopback_only',
  };
}

export { UNBOUND_MODEL };
