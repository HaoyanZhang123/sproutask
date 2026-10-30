import { describe, expect, it } from 'vitest';
import { FEATURE_API_VERSION } from '@edu/domain';
import {
  FeatureRegistrationError,
  FeatureRegistry,
  PageRegistry,
  createRequestContextFactory,
  type EducationFeatureModule,
  type EducationServices,
  type FeatureRegistrationContext,
} from '../src/index.js';
import { createFixedClock } from '../src/adapters/system-clock.js';
import { createMockTutorGateway } from '../src/adapters/mock-tutor.js';
import { createNotBoundTutorGateway } from '../src/adapters/dsh-not-bound.js';

function services(): EducationServices {
  return {
    clock: createFixedClock('2026-10-29T09:00:00Z'),
    ids: { next: (prefix) => `${prefix}.1` },
    tutor: createMockTutorGateway(),
    host: {
      async capabilities() {
        return {
          ok: true as const,
          data: {
            dsh: { bound: false, version: null, sourceRef: null },
            model: { text: true, image: false },
            tools: [],
            network: 'loopback_only' as const,
          },
          revision: 0,
        };
      },
      async authStatus() {
        return {
          ok: true as const,
          data: { method: 'none' as const, status: 'unavailable' as const, lastCheckedAt: null, accountRef: null },
          revision: 0,
        };
      },
    },
    eventStore: null,
    contentQuery: null,
    knowledge: null,
    grade: null,
    imports: null,
    learnerStore: null,
  };
}

function context(): FeatureRegistrationContext {
  const clock = createFixedClock('2026-10-29T09:00:00Z');
  return {
    runtimeCapabilities: {
      dsh: { bound: false, version: null, sourceRef: null },
      model: { text: true, image: false },
      tools: [],
      network: 'loopback_only',
    },
    pages: new PageRegistry(),
    createRequestContext: createRequestContextFactory(clock),
  };
}

function featureModule(id: string, requiredCapabilities: EducationFeatureModule['feature']['requiredCapabilities'] = []): EducationFeatureModule {
  return {
    feature: {
      id,
      version: '1.0.0',
      apiVersion: FEATURE_API_VERSION,
      requiredCapabilities,
      description: `test feature ${id}`,
    },
    registerEducationFeature(ctx) {
      ctx.pages.register({
        id: `${id}.home`,
        path: `/${id}`,
        title: 'test page',
        requiresLearner: false,
        mount() {
          /* no-op */
        },
        unmount() {
          /* no-op */
        },
      });
    },
  };
}

describe('feature registry', () => {
  it('rejects duplicate feature ids and wrong api versions', () => {
    const registry = new FeatureRegistry();
    registry.register(featureModule('@edu/a'));
    expect(() => registry.register(featureModule('@edu/a'))).toThrow(FeatureRegistrationError);

    const wrongVersion = featureModule('@edu/b');
    const bad: EducationFeatureModule = {
      ...wrongVersion,
      feature: { ...wrongVersion.feature, apiVersion: 99 as never },
    };
    expect(() => registry.register(bad)).toThrow(FeatureRegistrationError);
  });

  it('starts features in registration order and skips missing capabilities', async () => {
    const registry = new FeatureRegistry();
    registry.register(featureModule('@edu/text', ['model.text']));
    registry.register(featureModule('@edu/image', ['model.image']));
    const ctx = context();
    const result = await registry.start(ctx, services());
    expect(result.started).toEqual(['@edu/text']);
    expect(result.skipped[0]).toContain('@edu/image');
    expect(ctx.pages.resolve('/@edu/text')).toBeDefined();
    expect(ctx.pages.resolve('/@edu/image')).toBeUndefined();
  });

  it('cannot register after start', async () => {
    const registry = new FeatureRegistry();
    await registry.start(context(), services());
    expect(() => registry.register(featureModule('@edu/late'))).toThrow(FeatureRegistrationError);
  });
});

describe('page registry', () => {
  it('rejects duplicate ids and paths', () => {
    const pages = new PageRegistry();
    pages.register({
      id: 'home',
      path: '/',
      title: 'home',
      requiresLearner: false,
      mount() {},
      unmount() {},
    });
    expect(() =>
      pages.register({
        id: 'home',
        path: '/other',
        title: 'duplicate id',
        requiresLearner: false,
        mount() {},
        unmount() {},
      }),
    ).toThrow();
    expect(() =>
      pages.register({
        id: 'other',
        path: '/',
        title: 'duplicate path',
        requiresLearner: false,
        mount() {},
        unmount() {},
      }),
    ).toThrow();
  });

  it('mounts and unmounts a registered page', async () => {
    const pages = new PageRegistry();
    const lifecycle: string[] = [];
    pages.register({
      id: 'library',
      path: '/library',
      title: 'library',
      requiresLearner: true,
      mount() {
        lifecycle.push('mount');
      },
      unmount() {
        lifecycle.push('unmount');
      },
    });
    await pages.mount('library', { container: {}, services: services(), navigate: () => undefined });
    await pages.unmount('library');
    expect(lifecycle).toEqual(['mount', 'unmount']);
  });
});

describe('not bound adapter is honest', () => {
  it('the not-bound tutor gateway never pretends to be a model', async () => {
    const gateway = createNotBoundTutorGateway();
    expect(gateway.kind).toBe('dsh');
    const ctx = {
      requestId: 'request.1',
      learnerId: 'learner.1',
      now: '2026-10-29T09:00:00Z',
    };
    const result = await gateway.startSession(ctx, {
      session: {
        schemaVersion: 1,
        id: 'session.1',
        learnerId: 'learner.1',
        courseEditionId: 'course.1',
        packVersion: '1.0.0',
        trustMode: 'published',
        conceptId: 'concept.1',
        mode: 'learn',
        status: 'active',
        startedAt: '2026-10-29T08:00:00Z',
        endedAt: null,
        resumeCursor: { activityId: null, cursor: null },
        dshSessionId: null,
      },
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('NOT_IMPLEMENTED');
      expect(result.error.message).toContain('T00.runtimeReady BLOCKED');
    }
  });
});
