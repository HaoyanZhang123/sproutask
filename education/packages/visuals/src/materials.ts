/**
 * Materials inventory for T16 packaging (T11 step 5).
 *
 * T11 adds no local binaries and no third-party runtime dependency: image
 * understanding is an explicit cloud route. This list is what the packaged app
 * must check and disclose.
 */

import type { ModelCapability } from './image/capability.js';

export type VisualsMaterialKind = 'cloud-route' | 'node-builtin' | 'evidence-tool' | 'not-used';

export interface VisualsMaterial {
  readonly name: string;
  readonly kind: VisualsMaterialKind;
  readonly required: boolean;
  readonly usedFor: string;
  readonly license: string;
  readonly redistributable: boolean;
  readonly detection: string;
  readonly notes: string;
}

export const VISUALS_MATERIALS: readonly VisualsMaterial[] = [
  {
    name: 'DeepSeek chat completions API (image_url block)',
    kind: 'cloud-route',
    required: false,
    usedFor: 'image answer recognition + feedback when the student explicitly sends an image',
    license: 'model service terms; not redistributable',
    redistributable: false,
    detection: 'runtime model capability probe (text/image) before enabling the image button',
    notes: 'No image bytes leave the machine before explicit send. Without this route the app degrades to the text path; it never fakes image feedback.',
  },
  {
    name: 'Node.js built-ins (global fetch, crypto, fs)',
    kind: 'node-builtin',
    required: true,
    usedFor: 'HTTP client for the vision route, hashing, local evidence files',
    license: 'Node.js license (MIT), provided by the packaged runtime',
    redistributable: true,
    detection: 'provided by the Electron/Node runtime; no native addon',
    notes: 'No npm image/vision dependency; nothing to rebuild per Electron version.',
  },
  {
    name: 'Windows PowerShell + System.Drawing (evidence tool only)',
    kind: 'evidence-tool',
    required: false,
    usedFor: 'generating the synthetic test images for the T11 real-model evidence run',
    license: 'Windows OS component',
    redistributable: false,
    detection: 'only the evidence CLI uses it; not imported by the shipped app',
    notes: 'The product itself never generates images. Test images are program-synthesized, not real student handwriting.',
  },
  {
    name: 'Tesseract / external OCR / image ML libraries',
    kind: 'not-used',
    required: false,
    usedFor: 'not used by T11',
    license: 'not applicable',
    redistributable: false,
    detection: 'must not be required',
    notes: 'Explicit non-dependency: image understanding is the model route only.',
  },
];

export interface VisualsEngineStatus {
  readonly capability: ModelCapability;
  readonly materials: readonly VisualsMaterial[];
  /** True when rule grading and diagram answers work with no network at all. */
  readonly offlineCapable: boolean;
  readonly promptVersion: string;
}

export function materialInventory(): readonly VisualsMaterial[] {
  return VISUALS_MATERIALS;
}

export function buildVisualsEngineStatus(input: {
  readonly capability: ModelCapability;
  readonly promptVersion: string;
}): VisualsEngineStatus {
  return {
    capability: input.capability,
    materials: VISUALS_MATERIALS,
    offlineCapable: true,
    promptVersion: input.promptVersion,
  };
}
