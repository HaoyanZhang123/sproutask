/**
 * T01 feature module for `@edu/visuals` (06 §2).
 *
 * The package is a service/library feature: it ships no pages of its own. The
 * client panels live in `@edu/client-visuals` and are registered by T12/T13
 * into the shell slots `study:visuals` / `study:feedback`.
 */

import { FEATURE_API_VERSION } from '@edu/domain';

import type { ModelCapability } from './image/capability.js';

export const visualsFeature = {
  id: '@edu/visuals',
  version: '0.1.0',
  apiVersion: FEATURE_API_VERSION,
  requiredCapabilities: [] as const,
  description:
    'Controlled DiagramSpec validation/rendering, deterministic rule grading, evidence gate and image-answer pipeline (explicit send, clarification, no injected instructions).',
} as const;

export interface VisualsRegistrationContext {
  readonly runtimeCapabilities: {
    readonly model: { readonly text: boolean; readonly image: boolean };
    readonly dsh: { readonly bound: boolean };
  };
}

export interface VisualsRegistrationServices {
  readonly grade?: { readonly kind: string } | null;
}

export class VisualsRegistrationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'VisualsRegistrationError';
  }
}

/**
 * Registers the feature. Rule grading needs no capability; the image path is
 * enabled only when the runtime reports an image-capable model route.
 */
export function registerEducationFeature(
  context: VisualsRegistrationContext,
  services: VisualsRegistrationServices,
): { readonly imageEnabled: boolean; readonly capability: ModelCapability } {
  void services;
  const capability: ModelCapability = {
    provider: 'runtime',
    model: 'runtime-route',
    text: context.runtimeCapabilities.model.text,
    image: context.runtimeCapabilities.model.image,
  };
  return { imageEnabled: capability.image, capability };
}

export const visualsFeatureModule = {
  feature: visualsFeature,
  registerEducationFeature,
};
