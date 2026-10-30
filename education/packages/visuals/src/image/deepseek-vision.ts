/**
 * DeepSeek image client (OpenAI-compatible chat completions, `image_url` block).
 *
 * The API key is passed in by the caller (host key store / process env) and is
 * never logged, embedded in errors or written to evidence. Error responses map
 * onto the visuals taxonomy so the UI can distinguish auth / quota / network /
 * timeout without leaking provider details.
 */

import { visualsError, type VisualsResult } from '../errors.js';
import type { ModelCapability } from './capability.js';
import type { VisionCallResult, VisionClient, VisionRequest } from './vision-client.js';

export interface DeepSeekVisionOptions {
  readonly apiKey: string;
  readonly model: string;
  readonly endpoint?: string;
  readonly timeoutMs?: number;
  /** Injectable for tests; defaults to globalThis.fetch. */
  readonly fetchImpl?: typeof fetch;
  /** DeepSeek accepts both; default matches the documented OpenAI-compatible route. */
  readonly authHeader?: 'bearer' | 'x-api-key';
  /** Reasoning models spend output tokens on reasoning; keep this generous. */
  readonly maxTokens?: number;
}

interface ChatCompletionResponse {
  readonly id?: string;
  readonly model?: string;
  readonly choices?: readonly {
    readonly message?: { readonly content?: string | null };
    readonly finish_reason?: string | null;
  }[];
  readonly usage?: {
    readonly prompt_tokens?: number;
    readonly completion_tokens?: number;
  };
}

const DEFAULT_ENDPOINT = 'https://api.deepseek.com';
const DEFAULT_TIMEOUT_MS = 60_000;

export function createDeepSeekVisionClient(options: DeepSeekVisionOptions): VisionClient {
  const endpoint = (options.endpoint ?? DEFAULT_ENDPOINT).replace(/\/$/, '');
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  const capabilities: ModelCapability = {
    provider: 'deepseek-official',
    model: options.model,
    text: true,
    image: true,
  };

  return {
    id: 'deepseek-vision',
    capabilities,
    async call(request: VisionRequest): Promise<VisualsResult<VisionCallResult>> {
      if (options.apiKey.trim().length === 0) {
        return { ok: false, error: visualsError('VISION_AUTH_FAILED') };
      }
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      const started = Date.now();
      try {
        const authHeader =
          options.authHeader === 'x-api-key'
            ? { 'x-api-key': options.apiKey }
            : { authorization: `Bearer ${options.apiKey}` };
        const response = await fetchImpl(`${endpoint}/chat/completions`, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            ...authHeader,
          },
          body: JSON.stringify({
            model: options.model,
            messages: [
              { role: 'system', content: request.prompt },
              {
                role: 'user',
                content: [
                  { type: 'text', text: '请阅读这张图片并按系统说明返回 JSON。' },
                  {
                    type: 'image_url',
                    image_url: { url: `data:${request.mime};base64,${request.base64}` },
                  },
                ],
              },
            ],
            max_tokens: Math.max(request.maxTokens, options.maxTokens ?? 0),
            temperature: 0,
            stream: false,
          }),
          signal: controller.signal,
        });
        const latencyMs = Date.now() - started;
        if (!response.ok) {
          const status = response.status;
          const code =
            status === 401 || status === 403
              ? 'VISION_AUTH_FAILED'
              : status === 402 || status === 429
                ? 'VISION_QUOTA_EXCEEDED'
                : status === 400 || status === 404
                  ? 'VISION_UNAVAILABLE'
                  : 'VISION_NETWORK_FAILED';
          return { ok: false, error: visualsError(code, { retryable: status === 429 || status >= 500 }) };
        }
        const payload = (await response.json()) as ChatCompletionResponse;
        const content = payload.choices?.[0]?.message?.content ?? '';
        if (content.trim().length === 0) {
          // A reasoning model can consume the whole budget before answering.
          return { ok: false, error: visualsError('VISION_RESPONSE_INVALID', { retryable: true }) };
        }
        const usage =
          payload.usage === undefined
            ? null
            : {
                inputTokens: payload.usage.prompt_tokens ?? null,
                outputTokens: payload.usage.completion_tokens ?? null,
              };
        return {
          ok: true,
          value: {
            text: content,
            model: payload.model ?? options.model,
            modelRunId: payload.id ?? `deepseek:${options.model}:${started}`,
            latencyMs,
            usage,
          },
        };
      } catch (error) {
        const aborted = (error as { name?: string } | null)?.name === 'AbortError';
        return {
          ok: false,
          error: visualsError(aborted ? 'VISION_TIMEOUT' : 'VISION_NETWORK_FAILED', { retryable: true }),
        };
      } finally {
        clearTimeout(timer);
      }
    },
  };
}
