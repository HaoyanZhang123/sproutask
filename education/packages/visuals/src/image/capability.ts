/**
 * Model capability detection and the explicit text fallback (04 §T11, A20/A29).
 *
 * Capability comes from the runtime/route status, never from a model name. When
 * there is no image capability the app must disable image feedback and offer
 * the text path; it must not pretend to "understand" the image or grade it.
 */

export interface ModelCapability {
  readonly provider: string;
  readonly model: string;
  readonly text: boolean;
  readonly image: boolean;
  /** Why image is unavailable, when known (route/account/unsupported). */
  readonly imageUnavailableReason?: string | null;
}

export interface CapabilityDecision {
  readonly image: boolean;
  readonly text: boolean;
  /** Student-facing explanation for the fallback, or null when image works. */
  readonly message: string | null;
  readonly actions: readonly ('text_fallback' | 'retry_later')[];
}

export function detectImageCapability(capability: ModelCapability): CapabilityDecision {
  if (capability.image) {
    return { image: true, text: capability.text, message: null, actions: [] };
  }
  return {
    image: false,
    text: capability.text,
    message:
      '当前模型没有图像能力，已改为文字作答路径；图片仍会保存在本机，不会因此判你答错。',
    actions: capability.text ? ['text_fallback'] : ['retry_later'],
  };
}
