/**
 * Composition-root factory (T01 runtime registration contract).
 *
 * The storage package deliberately does not import @edu/runtime; the module
 * shape is structural so the main integrator can pass it to
 * FeatureRegistry.register. Create the composition with
 * `createEducationComposition({ eventStore: feature.eventStore, ... })`, then
 * register the module. Registration verifies the composition was wired with
 * this exact EventStore; it never mutates a readonly service bag.
 */

import type { EventStore, ServiceResult } from '@edu/domain';
import { FEATURE_API_VERSION, errResult, okResult } from '@edu/domain';
import type { OpenStorageOptions, StorageFeatureModuleLike } from './types.js';
import { StorageService } from './storage-service.js';

export interface StorageFeature {
  readonly storage: StorageService;
  readonly eventStore: EventStore;
  readonly featureModule: StorageFeatureModuleLike;
}

export function createStorageFeatureModule(storage: StorageService): StorageFeatureModuleLike {
  const eventStore = storage.asEventStore();
  return {
    feature: {
      id: '@edu/storage',
      version: '0.1.0',
      apiVersion: FEATURE_API_VERSION,
      requiredCapabilities: [],
      description: 'Local single-writer JSONL journal, snapshots, recovery, export/delete and legacy migration',
    },
    registerEducationFeature(_context, services) {
      if (services.eventStore !== eventStore) {
        throw new Error(
          '@edu/storage must be composed with services.eventStore set to this storage instance; refusing to register against another store',
        );
      }
    },
  };
}

export async function createStorageFeature(
  options: OpenStorageOptions,
): Promise<ServiceResult<StorageFeature>> {
  const opened = await StorageService.open(options);
  if (!opened.ok) return opened;
  const storage = opened.data;
  return okResult(
    {
      storage,
      eventStore: storage.asEventStore(),
      featureModule: createStorageFeatureModule(storage),
    },
    opened.revision,
  );
}

export { errResult };
