/**
 * @edu/visuals public API (T11).
 *
 * - controlled DiagramSpec validation, deterministic layout and safe SVG;
 * - equivalent keyboard/numbered answer path for structural labelling;
 * - deterministic graders (diagram label / choice / relation / text) returning
 *   the frozen `GradeResult`;
 * - evidence-candidate gate before anything reaches `@edu/learner`;
 * - image-answer pipeline with capability detection, explicit send,
 *   transform provenance, clarification and prompt-injection defence;
 * - materials inventory for T16.
 */

export {
  VISUALS_ERROR_CODES,
  VisualsFailure,
  fail,
  ok,
  visualsError,
  type VisualsErrorCode,
  type VisualsErrorInfo,
  type VisualsResult,
} from './errors.js';

export {
  MAX_DIAGRAM_EDGES,
  MAX_DIAGRAM_NODES,
  MAX_TEXT_LENGTH,
  unsafeTextReason,
  validateControlledDiagram,
  type DiagramIssue,
} from './diagram/validate.js';
export {
  planDiagram,
  type DiagramRenderPlan,
  type RenderEdge,
  type RenderNode,
  type RenderRegion,
} from './diagram/layout.js';
export { DIAGRAM_SVG_DEFS, escapeXml, renderDiagramSvg, type SvgOptions } from './diagram/svg.js';
export {
  buildDiagramTargets,
  normalizeDiagramLabelAnswer,
  normalizeLabelText,
  sameDiagramLabelAnswer,
  type DiagramTargetOption,
  type LabelSelectionInput,
  type NormalizedLabelAnswer,
} from './diagram/equivalence.js';

export {
  RULE_GRADER_VERSION,
  type ChoiceAnswerInput,
  type DiagramLabelAnswerInput,
  type GradedAnswer,
  type GradingAttempt,
  type GradingContext,
  type KnownRelation,
  type RelationAnswerInput,
  type RelationPairInput,
  type TextAnswerInput,
} from './grading/types.js';
export { gradeAttempt, gradeChoice, gradeDiagramLabel, gradeRelation, gradeText } from './grading/grade.js';
export { CHOICE_GRADER_VERSION } from './grading/choice.js';
export { DIAGRAM_LABEL_GRADER_VERSION } from './grading/diagram-label.js';
export { RELATION_GRADER_VERSION } from './grading/relation.js';
export { TEXT_GRADER_VERSION } from './grading/text.js';
export {
  gateEvidenceCandidates,
  gradeLooksValid,
  submitAcceptedEvidence,
  type EvidenceGateAudit,
  type EvidenceGateDecision,
  type EvidenceGateInput,
  type LearnerEvidencePort,
  type RejectedCandidate,
} from './grading/evidence-gate.js';

export {
  detectImageCapability,
  type CapabilityDecision,
  type ModelCapability,
} from './image/capability.js';
export {
  IMAGE_SYSTEM_INSTRUCTION,
  scanForPromptInjection,
  type InjectionScan,
} from './image/injection.js';
export { assessRecognitionQuality, type QualityDecision, type QualityInput } from './image/quality.js';
export {
  analyzeImageQuality,
  imageQualityClarificationMessage,
  IMAGE_QUALITY_THRESHOLDS,
  IMAGE_QUALITY_THRESHOLD_VERSION,
  type ImageQualityInput,
  type ImageQualityMetrics,
  type ImageQualitySignal,
  type ImageQualityStatus,
  type ImageQualityThresholds,
} from './image/quality-probe.js';
export {
  IMAGE_PROMPT_VERSION,
  ImageAnswerSession,
  evaluateImageAnswer,
  type ImageEvaluation,
  type ImageEvaluationInput,
  type ImageEvaluationStage,
} from './image/pipeline.js';
export {
  buildProvenance,
  mapOriginalToRequest,
  mapRegionToOriginal,
  mapRequestToOriginal,
  validateImageAsset,
  type RequestImage,
} from './image/transform.js';
export {
  IDENTITY_TRANSFORM,
  MAX_IMAGE_BYTES,
  SUPPORTED_IMAGE_MIME,
  emptyRecord,
  type Clarification,
  type ClarificationAction,
  type ImageAnswerRecord,
  type ImageAssetHandle,
  type ImageMime,
  type ImageRecognition,
  type ImageStage,
  type ImageTransform,
  type RecognitionRegion,
  type RotationDegrees,
  type StudentRevision,
  type TransformProvenance,
} from './image/types.js';
export {
  FakeVisionClient,
  type FakeVisionOptions,
  type VisionCallResult,
  type VisionClient,
  type VisionRequest,
  type VisionUsage,
} from './image/vision-client.js';
export { createDeepSeekVisionClient, type DeepSeekVisionOptions } from './image/deepseek-vision.js';
export {
  VISUALS_MATERIALS,
  buildVisualsEngineStatus,
  materialInventory,
  type VisualsEngineStatus,
  type VisualsMaterial,
  type VisualsMaterialKind,
} from './materials.js';
export {
  VisualsRegistrationError,
  registerEducationFeature,
  visualsFeature,
  visualsFeatureModule,
  type VisualsRegistrationContext,
  type VisualsRegistrationServices,
} from './feature.js';
