/**
 * Temporary type-only shim for the public `@edu/visuals` API consumed by the
 * runtime composition (T11 cross-project type surface; see requests/T01.md).
 * esbuild resolves the real package at bundle time.
 */

import type { Activity, ActivityAttempt, GradeResult, Rubric } from '@edu/domain';

export interface DiagramLabelAnswerInput {
  readonly kind: 'diagram_label';
  readonly labels: readonly { readonly targetId: string; readonly text: string }[];
}

export interface ChoiceAnswerInput {
  readonly kind: 'choice';
  readonly optionIds: readonly string[];
}

export interface RelationAnswerInput {
  readonly kind: 'relation';
  readonly pairs: readonly {
    readonly fromId: string;
    readonly toId: string;
    readonly relation?: 'prerequisite' | 'related' | null;
  }[];
}

export interface TextAnswerInput {
  readonly kind: 'text';
  readonly text: string;
}

export type GradedAnswer =
  | DiagramLabelAnswerInput
  | ChoiceAnswerInput
  | RelationAnswerInput
  | TextAnswerInput;

export interface GradingAttempt {
  readonly id: string;
  readonly activityId: string;
  readonly activityVersion: string;
  readonly answerText: string | null;
  readonly answerAssetId: string | null;
  readonly inputType: ActivityAttempt['inputType'];
  readonly helpUsed: ActivityAttempt['helpUsed'];
}

export interface GradingContext {
  readonly activity: Activity;
  readonly rubric: Rubric;
  readonly attempt: GradingAttempt;
  readonly answer: GradedAnswer;
  readonly graderVersion?: string;
}

export interface VisualsError {
  readonly code: string;
  readonly message?: string;
  readonly retryable?: boolean;
}

export type VisualsResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: VisualsError };

export declare function gradeAttempt(context: GradingContext): VisualsResult<GradeResult>;

export const IMAGE_QUALITY_THRESHOLD_VERSION: string;

export interface ImageQualityThresholds {
  readonly blurLapVar: number;
  readonly tiltDegrees: number;
  readonly tiltPeakShare: number;
  readonly uniformIntensityVariance: number;
  readonly extremeAspect: readonly [number, number];
}

export interface ImageQualityMetrics {
  readonly width: number;
  readonly height: number;
  readonly aspectRatio: number;
  readonly laplacianVariance: number;
  readonly edgeDensity: number;
  readonly intensityVariance: number;
  readonly skewDegrees: number;
  readonly orientationPeakShare: number;
}

export interface ImageQualitySignal {
  readonly version: string;
  readonly status: string;
  readonly forcedClarification: boolean;
  readonly reasons: readonly string[];
  readonly metrics: ImageQualityMetrics | null;
  readonly thresholds: ImageQualityThresholds;
  readonly note: string;
}

export interface ImageQualityInput {
  readonly base64: string;
  readonly mime: string;
  readonly width: number;
  readonly height: number;
}

export declare function analyzeImageQuality(input: ImageQualityInput): ImageQualitySignal;

/* ---------------------------------------------------------------- image (F7) */

export type ImageMime = 'image/png' | 'image/jpeg' | 'image/webp';

export interface NormalizedBBox {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface ImageTransform {
  readonly rotation: 0 | 90 | 180 | 270;
  readonly crop: NormalizedBBox | null;
  readonly scale: number;
}

export const IDENTITY_TRANSFORM: ImageTransform;

export interface ImageAssetHandle {
  readonly assetId: string;
  readonly sha256: string;
  readonly mime: ImageMime;
  readonly width: number;
  readonly height: number;
  readonly byteSize: number;
}

export interface RequestImage {
  readonly base64: string;
  readonly mime: ImageMime;
  readonly width: number;
  readonly height: number;
}

export interface RecognitionRegion {
  readonly text: string;
  readonly bbox: NormalizedBBox;
  readonly confidence: number | null;
}

export interface ImageRecognition {
  readonly readable: boolean;
  readonly text: string;
  readonly matchesExpected: boolean | null;
  readonly reason: string | null;
  readonly uncertainty: number | null;
  readonly regions: readonly RecognitionRegion[];
  readonly model: string;
  readonly modelRunId: string | null;
  readonly latencyMs: number;
  readonly usage: VisionUsage | null;
}

export interface Clarification {
  readonly reasons: readonly string[];
  readonly message: string;
  readonly actions: readonly string[];
}

export interface TransformProvenance {
  readonly original: { readonly width: number; readonly height: number; readonly sha256: string };
  readonly applied: ImageTransform;
  readonly request: { readonly width: number; readonly height: number; readonly mime: ImageMime };
  readonly mapping: 'linear';
  readonly promptVersion: string;
}

export type ImageEvaluationStageName = 'graded' | 'clarification_required' | 'degraded_text';

export interface ImageEvaluation {
  readonly stage: ImageEvaluationStageName;
  readonly grade: GradeResult | null;
  readonly gate: unknown;
  readonly clarification: Clarification | null;
  readonly recognition: ImageRecognition | null;
  readonly provenance: TransformProvenance;
  readonly injection: { readonly suspected: boolean } | null;
  readonly quality: unknown;
  readonly qualitySignal: ImageQualitySignal | null;
  readonly capability: unknown;
  readonly model: string;
  readonly modelRunId: string | null;
  readonly latencyMs: number;
  readonly usage: VisionUsage | null;
}

export interface ImageEvaluationInput {
  readonly asset: ImageAssetHandle;
  readonly transform: ImageTransform;
  readonly requestImage: RequestImage;
  readonly activity: Activity;
  readonly rubric: Rubric;
  readonly attempt: GradingAttempt;
  readonly expectedAnswer: string | null;
  readonly client: VisionClient;
  readonly promptVersion?: string;
  readonly maxTokens?: number;
  readonly resolveSourceRef?: (sourceRefId: string) => boolean;
  readonly knownConceptIds?: readonly string[];
}

export declare function evaluateImageAnswer(
  input: ImageEvaluationInput,
): Promise<VisualsResult<ImageEvaluation>>;

export interface VisionUsage {
  readonly inputTokens: number | null;
  readonly outputTokens: number | null;
}

export interface VisionCallResult {
  readonly text: string;
  readonly model: string;
  readonly modelRunId: string;
  readonly latencyMs: number;
  readonly usage: VisionUsage | null;
}

export interface VisionRequest {
  readonly base64: string;
  readonly mime: string;
  readonly prompt: string;
  readonly maxTokens: number;
}

export interface ModelCapability {
  readonly provider: string;
  readonly model: string;
  readonly text: boolean;
  readonly image: boolean;
}

export interface VisionClient {
  readonly id?: string;
  readonly capabilities: ModelCapability;
  call(request: VisionRequest): Promise<VisualsResult<VisionCallResult>>;
}

export interface DeepSeekVisionOptions {
  readonly apiKey: string;
  readonly model: string;
  readonly endpoint?: string;
  readonly timeoutMs?: number;
  readonly maxTokens?: number;
  readonly authHeader?: 'bearer' | 'x-api-key';
}

export declare function createDeepSeekVisionClient(options: DeepSeekVisionOptions): VisionClient;
