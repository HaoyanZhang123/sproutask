/**
 * Composition-root factory for the learner feature.
 *
 * The feature module is structural (like @edu/storage) so the T13 integrator can
 * register it without this package importing the runtime shell.
 */

import { FEATURE_API_VERSION, okResult, type ServiceResult } from '@edu/domain';
import { LearnerService } from './learner-service.js';
import type { LearnerFeatureModuleLike, LearnerServiceOptions } from './types.js';

export interface LearnerFeature {
  readonly learner: LearnerService;
  readonly projectionStore: LearnerService;
  readonly featureModule: LearnerFeatureModuleLike;
}

export function createLearnerFeatureModule(learner: LearnerService): LearnerFeatureModuleLike {
  return {
    feature: {
      id: '@edu/learner',
      version: '0.1.0',
      apiVersion: FEATURE_API_VERSION,
      requiredCapabilities: [],
      description:
        'Three-axis learner projection, evidence rules, versioned review policy, first-use plan, aggregates and compatibility mapping',
    },
    registerEducationFeature(_context, services) {
      const bag = services as { readonly projectionStore?: unknown } | null;
      if (bag !== null && bag.projectionStore !== undefined && bag.projectionStore !== learner) {
        throw new Error(
          '@edu/learner must be registered with services.projectionStore set to this learner service',
        );
      }
    },
  };
}

export async function createLearnerFeature(
  options: LearnerServiceOptions,
): Promise<ServiceResult<LearnerFeature>> {
  const opened = await LearnerService.open(options);
  if (!opened.ok) return opened;
  const learner = opened.data;
  return okResult(
    {
      learner,
      projectionStore: learner,
      featureModule: createLearnerFeatureModule(learner),
    },
    opened.revision,
  );
}
