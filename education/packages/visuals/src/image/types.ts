/**
 * Image-answer types (T11 step 3, 04 §T11, 02 §3.6).
 *
 * The original asset, the applied transform, the recognition result, the
 * student's revision and the evaluation are separate records. A revision
 * invalidates the previous evaluation instead of editing it in place.
 */

import type { NormalizedBBox } from '@edu/domain';

export const SUPPORTED_IMAGE_MIME = ['image/png', 'image/jpeg', 'image/webp'] as const;
export type ImageMime = (typeof SUPPORTED_IMAGE_MIME)[number];

export const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

export interface ImageAssetHandle {
  readonly assetId: string;
  readonly sha256: string;
  readonly mime: ImageMime;
  readonly width: number;
  readonly height: number;
  readonly byteSize: number;
}

export type RotationDegrees = 0 | 90 | 180 | 270;

export interface ImageTransform {
  /** Clockwise rotation applied before cropping. */
  readonly rotation: RotationDegrees;
  /** Crop in the rotated image, normalized 0..1; null means no crop. */
  readonly crop: NormalizedBBox | null;
  /** Downscale factor applied to the cropped image (1 = unchanged). */
  readonly scale: number;
}

export const IDENTITY_TRANSFORM: ImageTransform = { rotation: 0, crop: null, scale: 1 };

/** What was actually sent to the model, plus how to map back to the original. */
export interface TransformProvenance {
  readonly original: { readonly width: number; readonly height: number; readonly sha256: string };
  readonly applied: ImageTransform;
  readonly request: { readonly width: number; readonly height: number; readonly mime: ImageMime };
  readonly mapping: 'linear';
  readonly promptVersion: string;
}

export interface RecognitionRegion {
  readonly text: string;
  /** Pixels inside the request image. */
  readonly bbox: { readonly x: number; readonly y: number; readonly width: number; readonly height: number };
  readonly confidence: number | null;
}

export interface ImageRecognition {
  readonly readable: boolean;
  readonly text: string;
  /** Model-reported comparison with the expected answer; null when it cannot tell. */
  readonly matchesExpected: boolean | null;
  readonly reason: string | null;
  readonly uncertainty: number | null;
  readonly regions: readonly RecognitionRegion[];
  readonly model: string;
  readonly modelRunId: string | null;
  readonly latencyMs: number;
  readonly usage: { readonly inputTokens: number | null; readonly outputTokens: number | null } | null;
}

export interface StudentRevision {
  readonly text: string;
  readonly at: string;
  readonly note: string | null;
}

export type ClarificationAction = 'retake' | 'rotate' | 'edit_text' | 'text_fallback' | 'retry_later';

export interface Clarification {
  readonly reasons: readonly string[];
  readonly message: string;
  readonly actions: readonly ClarificationAction[];
}

export type ImageStage =
  | 'selected'
  | 'previewed'
  | 'send_confirmed'
  | 'recognized'
  | 'graded'
  | 'clarification_required'
  | 'degraded_text'
  | 'cancelled';

export interface ImageAnswerRecord {
  readonly asset: ImageAssetHandle;
  readonly provenance: TransformProvenance;
  readonly stage: ImageStage;
  readonly recognition: ImageRecognition | null;
  readonly revision: StudentRevision | null;
  /** Evaluations invalidated by a later revision are kept, never deleted. */
  readonly supersededEvaluations: readonly string[];
  readonly gradeRef: string | null;
}

export function emptyRecord(
  asset: ImageAssetHandle,
  provenance: TransformProvenance,
): ImageAnswerRecord {
  return {
    asset,
    provenance,
    stage: 'selected',
    recognition: null,
    revision: null,
    supersededEvaluations: [],
    gradeRef: null,
  };
}
