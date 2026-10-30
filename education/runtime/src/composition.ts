/**
 * Composition root (06 §2, §5).
 *
 * Wires the frozen ports once. Feature packages only receive `EducationServices`
 * and register through FeatureRegistry/PageRegistry. With no approved DSH
 * runtime the composition reports `blocked` with the explicit T00 reason and
 * never substitutes a mock for production.
 */

import type {
  Clock,
  ContentQuery,
  EventStore,
  GradePort,
  HostPort,
  IdGenerator,
  ImportPort,
  KnowledgePort,
  LearnerProjectionStore,
  RequestContext,
  RuntimeCapabilities,
  TutorGateway,
} from '@edu/domain';
import { errResult, okResult } from '@edu/domain';
import { createSystemClock } from './adapters/system-clock.js';
import { createSequentialIdGenerator } from './adapters/sequential-ids.js';
import {
  DSH_NOT_BOUND_MESSAGE,
  createHostPortFromAdapter,
  createNotBoundTutorGateway,
  unboundRuntimeCapabilities,
  type DshRuntimeAdapter,
} from './adapters/dsh-not-bound.js';
import { createMockTutorGateway } from './adapters/mock-tutor.js';
import { FeatureRegistry, createRequestContextFactory, type EducationServices } from './registry.js';
import { PageRegistry } from './pages.js';

export type CompositionStatus = 'dsh_bound' | 'test_only' | 'blocked';

export interface CompositionOptions {
  readonly clock?: Clock;
  readonly ids?: IdGenerator;
  readonly tutor?: TutorGateway;
  readonly host?: HostPort;
  readonly runtimeCapabilities?: RuntimeCapabilities;
  readonly eventStore?: EventStore;
  readonly contentQuery?: ContentQuery;
  readonly knowledge?: KnowledgePort;
  readonly grade?: GradePort;
  readonly imports?: ImportPort;
  readonly learnerStore?: LearnerProjectionStore;
}

export interface EducationComposition {
  readonly services: EducationServices;
  readonly features: FeatureRegistry;
  readonly pages: PageRegistry;
  readonly status: CompositionStatus;
  readonly blockers: readonly string[];
  readonly runtimeCapabilities: RuntimeCapabilities;
}

function buildComposition(
  options: CompositionOptions,
  status: CompositionStatus,
  blockers: readonly string[],
): EducationComposition {
  const clock = options.clock ?? createSystemClock();
  const ids = options.ids ?? createSequentialIdGenerator();
  const tutor = options.tutor ?? createNotBoundTutorGateway();
  const runtimeCapabilities = options.runtimeCapabilities ?? unboundRuntimeCapabilities();
  const host: HostPort =
    options.host ?? {
      async capabilities(ctx: RequestContext) {
        return okResult(runtimeCapabilities, 0);
      },
      async authStatus() {
        return errResult('UNAVAILABLE', 'host auth status is not wired', false);
      },
    };
  const services: EducationServices = {
    clock,
    ids,
    tutor,
    host,
    eventStore: options.eventStore ?? null,
    contentQuery: options.contentQuery ?? null,
    knowledge: options.knowledge ?? null,
    grade: options.grade ?? null,
    imports: options.imports ?? null,
    learnerStore: options.learnerStore ?? null,
  };
  return {
    services,
    features: new FeatureRegistry(),
    pages: new PageRegistry(),
    status,
    blockers,
    runtimeCapabilities,
  };
}

/**
 * Synchronous composition. Without a tutor it uses the not-bound gateway and
 * reports blocked; mock tutors produce `test_only`, never `dsh_bound`.
 */
export function createEducationComposition(options: CompositionOptions = {}): EducationComposition {
  const tutor = options.tutor;
  if (tutor === undefined) {
    return buildComposition(options, 'blocked', [DSH_NOT_BOUND_MESSAGE]);
  }
  if (tutor.kind === 'mock') {
    return buildComposition(options, 'test_only', ['mock tutor: not evidence of DSH access']);
  }
  const capabilities = options.runtimeCapabilities;
  if (capabilities === undefined || !capabilities.dsh.bound) {
    return buildComposition(options, 'blocked', [DSH_NOT_BOUND_MESSAGE]);
  }
  return buildComposition(options, 'dsh_bound', []);
}

/** Offline composition helper; clearly test only. */
export function createTestComposition(options: CompositionOptions = {}): EducationComposition {
  return buildComposition(
    {
      ...options,
      tutor: options.tutor ?? createMockTutorGateway(),
      runtimeCapabilities: options.runtimeCapabilities ?? {
        dsh: { bound: false, version: null, sourceRef: null },
        model: { text: true, image: false },
        tools: [],
        network: 'loopback_only',
      },
    },
    'test_only',
    ['test composition: mock/offline ports only'],
  );
}

export interface AdapterCompositionResult {
  readonly composition: EducationComposition;
  readonly probeError: string | null;
}

/**
 * Production entry: probe the adapter, then wire the real tutor gateway. A
 * failed probe yields a blocked composition with the actual adapter message.
 */
export async function createCompositionFromAdapter(
  adapter: DshRuntimeAdapter,
  options: CompositionOptions = {},
): Promise<AdapterCompositionResult> {
  const clock = options.clock ?? createSystemClock();
  const ids = options.ids ?? createSequentialIdGenerator();
  const ctx: RequestContext = { requestId: 'runtime.probe', learnerId: 'local.runtime', now: clock.now() };
  const probe = await adapter.probe(ctx);
  const capabilitiesResult = await adapter.capabilities(ctx);
  const runtimeCapabilities = capabilitiesResult.ok
    ? capabilitiesResult.data
    : unboundRuntimeCapabilities();
  const tutor = options.tutor ?? adapter.createTutorGateway();
  const components = buildComposition(
    {
      ...options,
      clock,
      ids,
      tutor,
      host: options.host ?? createHostPortFromAdapter(adapter),
      runtimeCapabilities,
    },
    probe.ok && runtimeCapabilities.dsh.bound ? 'dsh_bound' : 'blocked',
    probe.ok ? [] : [probe.error.message],
  );
  return { composition: components, probeError: probe.ok ? null : probe.error.message };
}

export { createRequestContextFactory };
