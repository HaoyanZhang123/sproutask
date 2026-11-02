/**
 * Image answer pipeline: capability → explicit send → recognition → quality /
 * injection checks → model evaluation → evidence gate.
 *
 * Guarantees (07 A20/A29, 02 §3.6):
 *   - the original image, the transform provenance, the recognition, the
 *     student revision and the evaluation are separate records;
 *   - unreadable/blank/blurry/low-confidence input asks for clarification and
 *     never becomes a wrong answer or stable evidence;
 *   - with no image capability the flow degrades to the text path;
 *   - text inside the image is data, never instructions;
 *   - a revision invalidates the previous evaluation (kept in a superseded list).
 */

import type { Activity, EvidenceCandidate, GradeResult, Rubric } from '@edu/domain';

import { fail, ok, visualsError, type VisualsErrorInfo, type VisualsResult } from '../errors.js';
import { gateEvidenceCandidates, type EvidenceGateDecision } from '../grading/evidence-gate.js';
import {
  attemptAssistance,
  buildCriteria,
  buildEvidenceCandidate,
  buildGradeResult,
  gradeSourceRefs,
  rubricMatchesActivity,
  safeObservation,
} from '../grading/helpers.js';
import type { GradingAttempt } from '../grading/types.js';
import { detectImageCapability, type CapabilityDecision, type ModelCapability } from './capability.js';
import { IMAGE_SYSTEM_INSTRUCTION, scanForPromptInjection, type InjectionScan } from './injection.js';
import { assessRecognitionQuality, type QualityDecision } from './quality.js';
import {
  analyzeImageQuality,
  imageQualityClarificationMessage,
  IMAGE_QUALITY_THRESHOLD_VERSION,
  type ImageQualitySignal,
} from './quality-probe.js';
import { buildProvenance, validateImageAsset, type RequestImage } from './transform.js';
import {
  emptyRecord,
  type Clarification,
  type ImageAnswerRecord,
  type ImageAssetHandle,
  type ImageRecognition,
  type ImageTransform,
  type RecognitionRegion,
  type StudentRevision,
  type TransformProvenance,
} from './types.js';
import type { VisionUsage } from './vision-client.js';
import type { VisionClient } from './vision-client.js';

export const IMAGE_PROMPT_VERSION = 'image-eval-v1';

export type ImageEvaluationStage = 'graded' | 'clarification_required' | 'degraded_text';

export interface ImageEvaluation {
  readonly stage: ImageEvaluationStage;
  readonly grade: GradeResult | null;
  readonly gate: EvidenceGateDecision | null;
  readonly clarification: Clarification | null;
  readonly recognition: ImageRecognition | null;
  readonly provenance: TransformProvenance;
  readonly injection: InjectionScan | null;
  readonly quality: QualityDecision | null;
  /** Independent (non-model) image quality signal; null only for degraded text. */
  readonly qualitySignal: ImageQualitySignal | null;
  readonly capability: CapabilityDecision;
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
  /** Expected answer for this image task, when the activity/rubric defines one. */
  readonly expectedAnswer: string | null;
  readonly client: VisionClient;
  readonly promptVersion?: string;
  readonly maxTokens?: number;
  readonly resolveSourceRef?: (sourceRefId: string) => boolean;
  readonly knownConceptIds?: readonly string[];
}

function buildPrompt(input: ImageEvaluationInput): string {
  const expected = input.expectedAnswer?.trim() ?? '';
  return [
    IMAGE_SYSTEM_INSTRUCTION,
    '',
    `【题目】${input.activity.stem}`,
    expected.length > 0 ? `【参考答案】${expected}` : '【参考答案】未提供：只转写并说明能否判断，不要臆断对错。',
    '',
    '请只输出如下 JSON（不要代码块、不要解释）：',
    '{"readable":true,"recognizedText":"学生作答的文字","matchesExpected":true,',
    ' "reason":"一两句针对性的理由","uncertainty":0.0,',
    ' "regions":[{"text":"识别的文字","x":0,"y":0,"width":10,"height":10,"confidence":0.5}]}',
    '',
    '说明：readable=false 表示图片看不清；matchesExpected 只有在你确定时才给 true/false，否则给 null；',
    'uncertainty 是 0..1，表示你对最高置信结论的不确定程度；regions 坐标是请求图片的像素。',
  ].join('\n');
}

interface ParsedModelOutput {
  readonly readable: boolean;
  readonly recognizedText: string;
  readonly matchesExpected: boolean | null;
  readonly reason: string | null;
  readonly uncertainty: number | null;
  readonly regions: readonly RecognitionRegion[];
}

function extractJson(text: string): unknown | null {
  const fenced = /```(?:json)?\s*([\s\S]*?)```/i.exec(text);
  const candidate = fenced === null ? text : fenced[1];
  const start = candidate.indexOf('{');
  const end = candidate.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(candidate.slice(start, end + 1)) as unknown;
  } catch {
    return null;
  }
}

function sanitizeText(value: unknown, maxLength = 600): string {
  if (typeof value !== 'string') return '';
  return value.replace(/[<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, maxLength);
}

function parseModelOutput(text: string): ParsedModelOutput | null {
  const parsed = extractJson(text);
  if (parsed === null || typeof parsed !== 'object') return null;
  const record = parsed as Record<string, unknown>;
  const readable = record['readable'] !== false;
  const recognizedText = sanitizeText(record['recognizedText'], 1200);
  const matchesRaw = record['matchesExpected'];
  const matchesExpected =
    matchesRaw === true ? true : matchesRaw === false ? false : null;
  const reasonRaw = record['reason'];
  const reason = typeof reasonRaw === 'string' ? sanitizeText(reasonRaw, 300) : null;
  const uncertaintyRaw = record['uncertainty'];
  const uncertainty =
    typeof uncertaintyRaw === 'number' && Number.isFinite(uncertaintyRaw)
      ? Math.min(1, Math.max(0, uncertaintyRaw))
      : null;
  const regionsRaw = record['regions'];
  const regions: RecognitionRegion[] = [];
  if (Array.isArray(regionsRaw)) {
    for (const item of regionsRaw.slice(0, 30)) {
      if (typeof item !== 'object' || item === null) continue;
      const region = item as Record<string, unknown>;
      const x = typeof region['x'] === 'number' ? region['x'] : 0;
      const y = typeof region['y'] === 'number' ? region['y'] : 0;
      const width = typeof region['width'] === 'number' ? region['width'] : 0;
      const height = typeof region['height'] === 'number' ? region['height'] : 0;
      regions.push({
        text: sanitizeText(region['text'], 200),
        bbox: { x, y, width, height },
        confidence: typeof region['confidence'] === 'number' ? region['confidence'] : null,
      });
    }
  }
  return { readable, recognizedText, matchesExpected, reason, uncertainty, regions };
}

function criteriaFor(
  rubric: Rubric,
  matchesExpected: boolean | null,
  reason: string | null,
): GradeResult['criteria'] {
  return buildCriteria(rubric, () => ({
    met: matchesExpected === true ? 'yes' : matchesExpected === false ? 'no' : 'unclear',
    rationale:
      reason !== null && reason.length > 0
        ? reason
        : matchesExpected === true
          ? '图片中的作答与参考答案一致'
          : matchesExpected === false
            ? '图片中的作答与参考答案不一致'
            : '图片内容不足以判断',
  }));
}

export async function evaluateImageAnswer(
  input: ImageEvaluationInput,
): Promise<VisualsResult<ImageEvaluation>> {
  const assetCheck = validateImageAsset(input.asset);
  if (!assetCheck.ok) return assetCheck;
  if (input.asset.byteSize > 8 * 1024 * 1024) {
    return fail(visualsError('ASSET_TOO_LARGE'));
  }
  const promptVersion = input.promptVersion ?? IMAGE_PROMPT_VERSION;
  const provenanceResult = buildProvenance({
    asset: input.asset,
    transform: input.transform,
    request: input.requestImage,
    promptVersion,
  });
  if (!provenanceResult.ok) return provenanceResult;
  const provenance = provenanceResult.value;
  const capability = detectImageCapability(input.client.capabilities);

  if (!capability.image) {
    return ok({
      stage: 'degraded_text',
      grade: null,
      gate: null,
      clarification: {
        reasons: ['当前模型路线没有图像能力'],
        message: capability.message ?? visualsError('VISION_UNAVAILABLE').message,
        actions: capability.actions,
      },
      recognition: null,
      provenance,
      injection: null,
      quality: null,
      qualitySignal: null,
      capability,
      model: input.client.capabilities.model,
      modelRunId: null,
      latencyMs: 0,
      usage: null,
    });
  }

  /*
   * Independent quality check before the model call. A confident model answer
   * must not override a blurry/tilted upload: the student is asked to retake or
   * switch to text, and no evidence is produced. Invalid/unsupported images
   * yield `unavailable` and do not force clarification.
   */
  const qualitySignal = analyzeImageQuality({
    base64: input.requestImage.base64,
    mime: input.requestImage.mime,
    width: input.requestImage.width,
    height: input.requestImage.height,
  });
  if (qualitySignal.forcedClarification) {
    const criteria = input.rubric.criteria.map((criterion) => ({
      criterionId: criterion.criterionId,
      met: 'unclear' as const,
      rationale: '图片质量不足，未形成判断',
    }));
    const grade = buildGradeResult({
      attemptId: input.attempt.id,
      criteria,
      feedback: imageQualityClarificationMessage(qualitySignal),
      uncertainties: [
        `quality_signal:${JSON.stringify(qualitySignal.metrics)}`,
        `threshold_version:${IMAGE_QUALITY_THRESHOLD_VERSION}`,
      ],
      evidenceCandidates: [],
      requiresClarification: true,
      sourceRefs: input.activity.sourceRefs,
      graderVersion: `image-quality-${IMAGE_QUALITY_THRESHOLD_VERSION}`,
    });
    return ok({
      stage: 'clarification_required',
      grade,
      gate: null,
      clarification: {
        reasons: qualitySignal.reasons,
        message: imageQualityClarificationMessage(qualitySignal),
        actions: ['retake', 'text_fallback', 'edit_text'],
      },
      recognition: null,
      provenance,
      injection: null,
      quality: null,
      qualitySignal,
      capability,
      model: input.client.capabilities.model,
      modelRunId: null,
      latencyMs: 0,
      usage: null,
    });
  }

  const called = await input.client.call({
    base64: input.requestImage.base64,
    mime: input.requestImage.mime,
    prompt: buildPrompt(input),
    maxTokens: input.maxTokens ?? 700,
  });
  if (!called.ok) return called;
  const parsed = parseModelOutput(called.value.text);
  if (parsed === null) return fail(visualsError('VISION_RESPONSE_INVALID', { retryable: true }));

  const injection = scanForPromptInjection(parsed.recognizedText);
  const recognition: ImageRecognition = {
    readable: parsed.readable,
    text: parsed.recognizedText,
    matchesExpected: parsed.matchesExpected,
    reason: parsed.reason,
    uncertainty: parsed.uncertainty,
    regions: parsed.regions,
    model: called.value.model,
    modelRunId: called.value.modelRunId,
    latencyMs: called.value.latencyMs,
    usage: called.value.usage,
  };
  const quality = assessRecognitionQuality({
    readable: parsed.readable,
    recognizedText: parsed.recognizedText,
    matchesExpected: parsed.matchesExpected,
    uncertainty: parsed.uncertainty,
    regionCount: parsed.regions.length,
    rotationDegrees: input.transform.rotation,
    injectionSuspected: injection.suspected,
  });

  if (quality.clarify) {
    return ok({
      stage: 'clarification_required',
      grade: null,
      gate: null,
      clarification: quality.clarification,
      recognition,
      provenance,
      injection,
      quality,
      qualitySignal,
      capability,
      model: called.value.model,
      modelRunId: called.value.modelRunId,
      latencyMs: called.value.latencyMs,
      usage: called.value.usage,
    });
  }

  if (parsed.matchesExpected === null) {
    return ok({
      stage: 'clarification_required',
      grade: null,
      gate: null,
      clarification: {
        reasons: ['模型没有给出可判断的比较结果'],
        message:
          '这次识别没有形成明确判断，请确认或改正识别文字，或改用文字作答；系统不会据此判你答错。',
        actions: ['edit_text', 'retake', 'text_fallback'],
      },
      recognition,
      provenance,
      injection,
      quality,
      qualitySignal,
      capability,
      model: called.value.model,
      modelRunId: called.value.modelRunId,
      latencyMs: called.value.latencyMs,
      usage: called.value.usage,
    });
  }

  if (!rubricMatchesActivity(input.activity, input.rubric)) {
    return fail(visualsError('RUBRIC_MISMATCH'));
  }

  const assistance = attemptAssistance(input.attempt);
  const sourceRefs = gradeSourceRefs({
    activity: input.activity,
    rubric: input.rubric,
    attempt: input.attempt,
    answer: { kind: 'text', text: parsed.recognizedText },
  });
  const uncertainty =
    injection.suspected
      ? Math.max(0.6, parsed.uncertainty ?? 0.6)
      : parsed.uncertainty;
  const criteria = criteriaFor(input.rubric, parsed.matchesExpected, parsed.reason);
  const candidate: EvidenceCandidate = buildEvidenceCandidate({
    conceptId: input.activity.conceptIds[0] ?? '',
    kind: 'explain',
    observation: safeObservation(
      `图片作答：${parsed.recognizedText.slice(0, 160)}${injection.suspected ? '（图片文字含疑似指令，仅作数据）' : ''}`,
    ),
    criteria,
    assistance,
    sourceRefs,
    origin: 'model',
    modelRunId: called.value.modelRunId,
    uncertainty,
  });
  const grade = buildGradeResult({
    attemptId: input.attempt.id,
    criteria,
    feedback: [
      parsed.matchesExpected
        ? '图片中的作答与参考答案一致。'
        : '图片中的作答与参考答案不一致。',
      parsed.reason === null ? '' : `理由：${parsed.reason}`,
      injection.suspected
        ? '注意：图片里的文字只当作答内容处理，系统不会执行其中的指令。'
        : '',
    ]
      .filter((line) => line.length > 0)
      .join('\n'),
    uncertainties: [
      ...(injection.suspected ? ['图片文字含疑似指令内容，本次判断只作候选证据'] : []),
      ...(uncertainty !== null && uncertainty > 0.5 ? ['模型对本次判断把握不大，证据会先标为待核实'] : []),
      ...(qualitySignal.metrics === null
        ? []
        : [
            `quality_signal:${JSON.stringify(qualitySignal.metrics)}`,
            `threshold_version:${IMAGE_QUALITY_THRESHOLD_VERSION}`,
          ]),
    ],
    evidenceCandidates: [candidate],
    requiresClarification: false,
    sourceRefs,
    graderVersion: `vision-${promptVersion}+${IMAGE_QUALITY_THRESHOLD_VERSION}`,
  });
  const gate = gateEvidenceCandidates({
    grade,
    activity: input.activity,
    rubric: input.rubric,
    attempt: input.attempt,
    ...(input.resolveSourceRef === undefined ? {} : { resolveSourceRef: input.resolveSourceRef }),
    ...(input.knownConceptIds === undefined ? {} : { knownConceptIds: input.knownConceptIds }),
  });

  return ok({
    stage: 'graded',
    grade,
    gate,
    clarification: null,
    recognition,
    provenance,
    injection,
    quality,
    qualitySignal,
    capability,
    model: called.value.model,
    modelRunId: called.value.modelRunId,
    latencyMs: called.value.latencyMs,
    usage: called.value.usage,
  });
}

/**
 * UI-facing state machine: preview → explicit confirm → recognition → revision
 * → evaluation. The record keeps every artifact separately; a revision moves the
 * previous evaluation into `supersededEvaluations`.
 */
export class ImageAnswerSession {
  private current: ImageAnswerRecord;
  private readonly now: () => string;
  private readonly promptVersion: string;
  readonly asset: ImageAssetHandle;
  readonly provenance: TransformProvenance;

  private constructor(input: {
    readonly asset: ImageAssetHandle;
    readonly transform: ImageTransform;
    readonly requestImage: RequestImage;
    readonly promptVersion: string;
    readonly now: () => string;
  }) {
    this.asset = input.asset;
    this.now = input.now;
    this.promptVersion = input.promptVersion;
    const provenance = buildProvenance({
      asset: input.asset,
      transform: input.transform,
      request: input.requestImage,
      promptVersion: input.promptVersion,
    });
    if (!provenance.ok) throw new Error(provenance.error.code);
    this.provenance = provenance.value;
    this.current = emptyRecord(input.asset, this.provenance);
  }

  static create(input: {
    readonly asset: ImageAssetHandle;
    readonly transform: ImageTransform;
    readonly requestImage: RequestImage;
    readonly promptVersion?: string;
    readonly now?: () => string;
  }): VisualsResult<ImageAnswerSession> {
    const assetCheck = validateImageAsset(input.asset);
    if (!assetCheck.ok) return assetCheck;
    try {
      return ok(
        new ImageAnswerSession({
          asset: input.asset,
          transform: input.transform,
          requestImage: input.requestImage,
          promptVersion: input.promptVersion ?? IMAGE_PROMPT_VERSION,
          now: input.now ?? (() => new Date().toISOString()),
        }),
      );
    } catch {
      return fail(visualsError('ASSET_INVALID'));
    }
  }

  get record(): ImageAnswerRecord {
    return this.current;
  }

  get promptVersionValue(): string {
    return this.promptVersion;
  }

  /** Selection is not sending: the student sees the preview first. */
  preview(): ImageAnswerRecord {
    this.current = { ...this.current, stage: 'previewed' };
    return this.current;
  }

  /** Explicit confirmation before any cloud request (02 §3.6). */
  confirmSend(): VisualsResult<ImageAnswerRecord> {
    if (this.current.stage !== 'previewed') {
      return fail(visualsError('UNSUPPORTED', { detailsRef: 'stage-preview-required' }));
    }
    this.current = { ...this.current, stage: 'send_confirmed' };
    return ok(this.current);
  }

  attachRecognition(recognition: ImageRecognition): ImageAnswerRecord {
    this.current = { ...this.current, stage: 'recognized', recognition };
    return this.current;
  }

  /** Student correction; the previous evaluation becomes stale, never edited. */
  revise(input: { readonly text: string; readonly note?: string | null }): VisualsResult<ImageAnswerRecord> {
    const text = input.text.replace(/\s+/g, ' ').trim();
    if (text.length === 0) return fail(visualsError('ANSWER_EMPTY'));
    const revision: StudentRevision = {
      text,
      at: this.now(),
      note: input.note ?? null,
    };
    const superseded =
      this.current.gradeRef === null
        ? this.current.supersededEvaluations
        : [...this.current.supersededEvaluations, this.current.gradeRef];
    this.current = {
      ...this.current,
      stage: 'recognized',
      revision,
      supersededEvaluations: superseded,
      gradeRef: null,
    };
    return ok(this.current);
  }

  attachEvaluation(evaluationRef: string): ImageAnswerRecord {
    this.current = {
      ...this.current,
      stage: 'graded',
      gradeRef: evaluationRef,
    };
    return this.current;
  }

  attachClarification(): ImageAnswerRecord {
    this.current = { ...this.current, stage: 'clarification_required' };
    return this.current;
  }

  degradeToText(): ImageAnswerRecord {
    this.current = { ...this.current, stage: 'degraded_text' };
    return this.current;
  }

  cancel(): ImageAnswerRecord {
    this.current = { ...this.current, stage: 'cancelled', gradeRef: null };
    return this.current;
  }

  /** The text the next evaluation should use (student revision wins). */
  effectiveText(): string | null {
    return this.current.revision?.text ?? this.current.recognition?.text ?? null;
  }
}

export type { VisualsErrorInfo };
