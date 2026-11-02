/**
 * Feature and page registration contract (06 §2).
 *
 * Every future package exports a module whose `registerEducationFeature`
 * receives the composition context and the frozen service ports. Registration
 * order is centralized once in runtime; feature packages never edit a shared
 * host registration file.
 */

import { FEATURE_API_VERSION } from '@edu/domain';
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
  ServiceResult,
  TutorGateway,
} from '@edu/domain';
import type { PageRegistry } from './pages.js';

export const FEATURE_CONTRACT_VERSION = FEATURE_API_VERSION;

export type HostCapabilityName = 'dsh.runtime' | 'model.text' | 'model.image';

export interface EducationServices {
  readonly clock: Clock;
  readonly ids: IdGenerator;
  readonly tutor: TutorGateway;
  readonly host: HostPort;
  readonly eventStore: EventStore | null;
  readonly contentQuery: ContentQuery | null;
  readonly knowledge: KnowledgePort | null;
  readonly grade: GradePort | null;
  readonly imports: ImportPort | null;
  readonly learnerStore: LearnerProjectionStore | null;
}

export interface FeatureRegistrationContext {
  readonly runtimeCapabilities: RuntimeCapabilities;
  readonly pages: PageRegistry;
  /** Base context factory: features bind learner/requestId server side. */
  readonly createRequestContext: (input: {
    readonly requestId: string;
    readonly learnerId: string;
  }) => RequestContext;
}

export interface EducationFeature {
  /** e.g. @edu/tutor or client/library; stable and unique. */
  readonly id: string;
  readonly version: string;
  readonly apiVersion: typeof FEATURE_API_VERSION;
  readonly requiredCapabilities: readonly HostCapabilityName[];
  readonly description: string;
}

/**
 * The exact factory every feature package must export. It may register pages
 * through `context.pages`, but must not mutate shared runtime files.
 */
export interface EducationFeatureModule {
  readonly feature: EducationFeature;
  registerEducationFeature(
    context: FeatureRegistrationContext,
    services: EducationServices,
  ): void | Promise<void>;
}

export interface FeatureStartResult {
  readonly started: readonly string[];
  readonly skipped: readonly string[];
}

export class FeatureRegistrationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FeatureRegistrationError';
  }
}

function capabilityAvailable(
  capability: HostCapabilityName,
  capabilities: RuntimeCapabilities,
): boolean {
  if (capability === 'dsh.runtime') return capabilities.dsh.bound;
  if (capability === 'model.text') return capabilities.model.text;
  return capabilities.model.image;
}

export class FeatureRegistry {
  private readonly modules = new Map<string, EducationFeatureModule>();
  private started = false;

  register(module: EducationFeatureModule): void {
    if (this.started) {
      throw new FeatureRegistrationError('cannot register features after the registry started');
    }
    if (module.feature.id.trim().length === 0) {
      throw new FeatureRegistrationError('feature id must not be empty');
    }
    if (module.feature.apiVersion !== FEATURE_API_VERSION) {
      throw new FeatureRegistrationError(
        `feature ${module.feature.id} targets apiVersion ${String(module.feature.apiVersion)}, expected ${FEATURE_API_VERSION}`,
      );
    }
    if (this.modules.has(module.feature.id)) {
      throw new FeatureRegistrationError(`duplicate feature id: ${module.feature.id}`);
    }
    this.modules.set(module.feature.id, module);
  }

  list(): readonly EducationFeature[] {
    return [...this.modules.values()].map((module) => module.feature);
  }

  async start(
    context: FeatureRegistrationContext,
    services: EducationServices,
  ): Promise<FeatureStartResult> {
    if (this.started) {
      throw new FeatureRegistrationError('feature registry already started');
    }
    this.started = true;
    const started: string[] = [];
    const skipped: string[] = [];
    for (const module of this.modules.values()) {
      const missing = module.feature.requiredCapabilities.filter(
        (capability) => !capabilityAvailable(capability, context.runtimeCapabilities),
      );
      if (missing.length > 0) {
        skipped.push(`${module.feature.id} (missing: ${missing.join(', ')})`);
        continue;
      }
      await module.registerEducationFeature(context, services);
      started.push(module.feature.id);
    }
    return { started, skipped };
  }
}

export function createRequestContextFactory(
  clock: Clock,
): FeatureRegistrationContext['createRequestContext'] {
  return (input) => ({
    requestId: input.requestId,
    learnerId: input.learnerId,
    now: clock.now(),
    signal: undefined,
    timeoutMs: undefined,
  });
}

export type { ServiceResult };
