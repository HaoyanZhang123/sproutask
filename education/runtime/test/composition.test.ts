import { describe, expect, it } from 'vitest';
import {
  DSH_NOT_BOUND_MESSAGE,
  createCompositionFromAdapter,
  createEducationComposition,
  createNotBoundDshRuntimeAdapter,
  createTestComposition,
} from '../src/index.js';

const ctx = {
  requestId: 'request.composition',
  learnerId: 'learner.local.default',
  now: '2026-10-29T09:00:00Z',
};

describe('composition root', () => {
  it('without a bound runtime the composition is blocked with the exact reason', () => {
    const composition = createEducationComposition();
    expect(composition.status).toBe('blocked');
    expect(composition.blockers).toEqual([DSH_NOT_BOUND_MESSAGE]);
    expect(composition.services.tutor.kind).toBe('dsh');
    expect(composition.services.tutor.kind).not.toBe('mock');
  });

  it('test composition is labelled test_only and uses the mock tutor', () => {
    const composition = createTestComposition();
    expect(composition.status).toBe('test_only');
    expect(composition.services.tutor.kind).toBe('mock');
    expect(composition.blockers[0]).toContain('test composition');
  });

  it('probing the not-bound adapter keeps runtimeReady blocked', async () => {
    const { composition, probeError } = await createCompositionFromAdapter(
      createNotBoundDshRuntimeAdapter(),
    );
    expect(probeError).toBe(DSH_NOT_BOUND_MESSAGE);
    expect(composition.status).toBe('blocked');
    expect(composition.runtimeCapabilities.dsh.bound).toBe(false);
    const capabilities = await composition.services.host.capabilities(ctx);
    expect(capabilities.ok).toBe(true);
    if (capabilities.ok) {
      expect(capabilities.data.dsh.bound).toBe(false);
      expect(capabilities.data.tools).toEqual([]);
    }
    const auth = await composition.services.host.authStatus(ctx);
    expect(auth.ok).toBe(true);
    if (auth.ok) expect(auth.data.status).toBe('unknown');
  });

  it('registries start empty and are wired per composition', () => {
    const composition = createTestComposition();
    expect(composition.features.list()).toEqual([]);
    expect(composition.pages.list()).toEqual([]);
  });
});
