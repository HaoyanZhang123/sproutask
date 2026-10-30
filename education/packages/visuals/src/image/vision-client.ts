/**
 * Vision client port + deterministic fake (T11 step 3/5).
 *
 * Real routes implement `call`; tests and offline demos use `FakeVisionClient`,
 * which is always labelled as fake so it can never be mistaken for a real
 * image-model result.
 */

import type { VisualsResult } from '../errors.js';
import type { ModelCapability } from './capability.js';
import type { ImageMime } from './types.js';

export interface VisionRequest {
  readonly base64: string;
  readonly mime: ImageMime;
  readonly prompt: string;
  readonly maxTokens: number;
}

export interface VisionUsage {
  readonly inputTokens: number | null;
  readonly outputTokens: number | null;
}

export interface VisionCallResult {
  readonly text: string;
  readonly model: string;
  /** Traceable id for the call; required before model evidence is accepted. */
  readonly modelRunId: string | null;
  readonly latencyMs: number;
  readonly usage: VisionUsage | null;
}

export interface VisionClient {
  readonly id: string;
  readonly capabilities: ModelCapability;
  call(request: VisionRequest): Promise<VisualsResult<VisionCallResult>>;
}

export interface FakeVisionOptions {
  readonly capabilities?: Partial<ModelCapability>;
  readonly responseText?: string;
  readonly latencyMs?: number;
  readonly failure?: 'VISION_AUTH_FAILED' | 'VISION_QUOTA_EXCEEDED' | 'VISION_NETWORK_FAILED' | 'VISION_TIMEOUT';
  readonly modelRunId?: string | null;
}

/** Deterministic fake; `isMock` stays true so evidence provenance is obvious. */
export class FakeVisionClient implements VisionClient {
  readonly id = 'fake-vision';
  readonly capabilities: ModelCapability;
  private readonly options: FakeVisionOptions;

  constructor(options: FakeVisionOptions = {}) {
    this.options = options;
    this.capabilities = {
      provider: 'fake',
      model: 'fake-vision-1',
      text: true,
      image: true,
      ...options.capabilities,
    };
  }

  async call(request: VisionRequest): Promise<VisualsResult<VisionCallResult>> {
    void request;
    const { visualsError } = await import('../errors.js');
    const failure = this.options.failure;
    if (failure !== undefined) {
      return { ok: false, error: visualsError(failure) };
    }
    return {
      ok: true,
      value: {
        text: this.options.responseText ?? '{"readable":true,"recognizedText":"","matchesExpected":null,"reason":null,"uncertainty":0.9,"regions":[]}',
        model: this.capabilities.model,
        modelRunId: this.options.modelRunId === undefined ? 'fake-run-1' : this.options.modelRunId,
        latencyMs: this.options.latencyMs ?? 5,
        usage: { inputTokens: 0, outputTokens: 0 },
      },
    };
  }
}
