/**
 * @edu/client-visuals public API (T11).
 *
 * Framework-free DOM views: controlled diagram (with the equivalent numbered
 * keyboard path), choice/text/relation forms, image answer flow with explicit
 * send + clarification, and feedback rendering. The panels mount into the T08
 * shell slots `study:visuals` / `study:feedback`.
 */

export {
  mountDiagramView,
  type DiagramLabelAnswer,
  type DiagramPlanEdge,
  type DiagramPlanLike,
  type DiagramPlanNode,
  type DiagramPlanRegion,
  type DiagramViewOptions,
  type DiagramViewController,
} from './diagram-view.js';
export {
  mountAnswerForm,
  supportsAnswerForm,
  type AnswerFormController,
  type AnswerFormOptions,
  type AnswerFormValue,
  type RelationNodeOption,
} from './answer-forms.js';
export {
  CLARIFICATION_ACTIONS,
  mountFeedbackView,
  type ClarificationActionId,
  type FeedbackGradeLike,
  type FeedbackViewOptions,
  type FeedbackViewController,
} from './feedback-view.js';
export {
  mountImageFlow,
  type ImageFlowController,
  type ImageFlowLike,
  type ImageFlowOptions,
  type ImageFlowStage,
} from './image-flow.js';
export {
  createSlotPanel,
  registerVisualsPanels,
  type PanelRegistryLike,
  type ShellPanelContextLike,
  type ShellPanelLike,
  type SlotPanelController,
  type VisualsPanels,
  type VisualsSlotName,
} from './panels.js';
