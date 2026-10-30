/**
 * Study workspace controller.
 *
 * The UI owns only view transitions and draft autosave. Teaching decisions,
 * disclosure, grading, evidence and review outcomes come from the injected
 * T07/T06 service facade; no local state is presented as persisted truth.
 */

import type {
  Activity,
  ConceptProgress,
  RequestContext,
  SelfReport,
  ServiceError,
  Session,
} from '@edu/domain';
import type { StartedTutorSession, TutorSessionState } from '@edu/tutor';
import {
  button,
  clear,
  emptyState,
  h,
  loadingState,
  notice,
  progressSummary,
  renderErrorBanner,
  statusChip,
  Modal,
} from '../../shell/src/index.js';
import {
  mountAnswerForm,
  mountFeedbackView,
  supportsAnswerForm,
  type AnswerFormController,
  type AnswerFormValue,
  type FeedbackViewController,
} from '../../visuals/src/index.js';
import {
  summarizeConceptState,
  type MapPayload,
} from '../../map/src/index.js';
import type { EducationPageContext } from '../../shell/src/index.js';
import { ActivityStateMachine } from './machine.js';
import { openSourcePopover } from './source-view.js';
import {
  ASSISTANCE_NOTE,
  DRAFT_SAVED,
  DRAFT_UNSAVED,
  END_NOTE,
  HELP_ACTIONS,
  LOW_DIFFICULTY_NOTE,
  PHASE_LABELS,
  PHASE_TONES,
  REVIEW_REASON_LABELS,
  SKIP_NOTE,
  answerInputType,
  decisionNotice,
  encodeAnswer,
  formatStudyTime,
} from './labels.js';
import type {
  StudyActivityPhase,
  StudyDataSource,
  StudyDecision,
  StudyDraft,
  StudyDraftKey,
  StudyFinishReceipt,
  StudyGradeResult,
  StudyImageInfo,
  StudyReviewCandidate,
  StudyReviewRange,
  StudySource,
  StudyTurnOutcome,
  StudyTurnState,
  StudyWorkspace,
} from './types.js';

type DraftStatus = 'none' | 'saving' | 'saved' | 'failed';

/** Locally selected image; bytes never leave the page before explicit confirm. */
interface ImageDraft {
  readonly base64: string;
  readonly mime: 'image/png' | 'image/jpeg';
  readonly width: number;
  readonly height: number;
  readonly fileName: string;
  readonly byteSize: number;
  /** Local data URL used for the preview; never a remote URL. */
  readonly dataUrl: string;
}

const IMAGE_MIMES: readonly string[] = ['image/png', 'image/jpeg'];
const IMAGE_MAX_BYTES = 5 * 1024 * 1024;

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunk = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunk) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunk));
  }
  return btoa(binary);
}

function pngSize(bytes: Uint8Array): { width: number; height: number } | null {
  if (bytes.length < 24) return null;
  const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (signature.some((value, index) => bytes[index] !== value)) return null;
  return {
    width: (bytes[16]! << 24) | (bytes[17]! << 16) | (bytes[18]! << 8) | bytes[19]!,
    height: (bytes[20]! << 24) | (bytes[21]! << 16) | (bytes[22]! << 8) | bytes[23]!,
  };
}

function jpegSize(bytes: Uint8Array): { width: number; height: number } | null {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return null;
  let offset = 2;
  while (offset + 9 < bytes.length) {
    if (bytes[offset] !== 0xff) {
      offset += 1;
      continue;
    }
    const marker = bytes[offset + 1] ?? 0;
    if (marker === 0xd8 || marker === 0xd9 || (marker >= 0xd0 && marker <= 0xd7)) {
      offset += 2;
      continue;
    }
    const length = ((bytes[offset + 2] ?? 0) << 8) | (bytes[offset + 3] ?? 0);
    if (length < 2) return null;
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
      return {
        height: ((bytes[offset + 5] ?? 0) << 8) | (bytes[offset + 6] ?? 0),
        width: ((bytes[offset + 7] ?? 0) << 8) | (bytes[offset + 8] ?? 0),
      };
    }
    offset += 2 + length;
  }
  return null;
}

async function readImageFile(file: File): Promise<ImageDraft> {
  const mime = file.type.toLowerCase();
  if (!IMAGE_MIMES.includes(mime)) {
    throw new Error('只支持 PNG 或 JPEG 图片；请重新拍照或选择图片。');
  }
  if (file.size > IMAGE_MAX_BYTES) {
    throw new Error('图片超过 5 MB；请压缩、重拍，或改用文字作答。');
  }
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  if (bytes.length === 0) {
    throw new Error('图片是空文件；请重新选择。');
  }
  const base64 = bytesToBase64(bytes);
  const size = mime === 'image/png' ? pngSize(bytes) : jpegSize(bytes);
  return {
    base64,
    mime: mime as ImageDraft['mime'],
    width: size?.width ?? 0,
    height: size?.height ?? 0,
    fileName: file.name.length > 0 ? file.name : '作答图片',
    byteSize: file.size,
    dataUrl: `data:${mime};base64,${base64}`,
  };
}

export interface StudyControllerOptions {
  readonly dataSource: StudyDataSource;
  readonly createRequest: () => RequestContext;
  readonly returnPath?: string | null;
}

interface ChatMessage {
  readonly role: 'student' | 'assistant' | 'system';
  readonly text: string;
  readonly disclosure: boolean;
}

interface Intent {
  readonly conceptId: string | null;
  readonly mode: 'learn' | 'review';
  readonly sessionId: string | null;
  readonly activityId: string | null;
  readonly fromResume: boolean;
}

interface StateSummary {
  readonly learning: string;
  readonly understanding: string;
  readonly review: string;
  readonly due: string;
  readonly selfReport: string;
}

export class StudyController {
  private readonly options: StudyControllerOptions;
  private readonly machine = new ActivityStateMachine();
  private readonly renderers = new Set<() => void>();
  private pageContext: EducationPageContext | null = null;
  private navigate: ((path: string) => void) | null = null;
  private materialContainer: HTMLElement | null = null;
  private chatContainer: HTMLElement | null = null;
  private activityContainer: HTMLElement | null = null;
  private feedbackContainer: HTMLElement | null = null;
  private feedbackRoot: HTMLElement | null = null;
  private draftStatusNode: HTMLElement | null = null;

  private intent: Intent = { conceptId: null, mode: 'learn', sessionId: null, activityId: null, fromResume: false };
  private workspace: StudyWorkspace | null = null;
  private session: StartedTutorSession | null = null;
  private tutorState: StudyTurnState | TutorSessionState | null = null;
  private progress: ConceptProgress | null = null;
  private selfReport: SelfReport | null = null;
  private activity: Activity | null = null;
  private answer: AnswerFormValue | null = null;
  private draft: StudyDraft | null = null;
  private draftStatus: DraftStatus = 'none';
  private draftError: ServiceError | null = null;
  private draftToken = 0;
  private loading = true;
  private error: ServiceError | null = null;
  private loadToken = 0;
  private loadedKey = '';
  private phase: StudyActivityPhase = 'draft';
  private form: AnswerFormController | null = null;
  private formActivityId: string | null = null;
  private feedback: StudyGradeResult | null = null;
  private feedbackController: FeedbackViewController | null = null;
  private attemptId: string | null = null;
  private failedError: ServiceError | null = null;
  private failureNotice = '';
  private lateNotice = '';
  private skipNotice = '';
  private finishReceipt: StudyFinishReceipt | null = null;
  private finishLabel = '';
  private reviewRange: StudyReviewRange | null = null;
  private reviewSelected = new Set<string>();
  private reviewSkipped = false;
  private reviewNotice = '';
  private messages: ChatMessage[] = [];
  private chatText = '';
  private chatNotice = '';
  private chatError: ServiceError | null = null;
  private helpNotice = '';
  private submitGen = 0;
  private currentToken: { cancelled: boolean } | null = null;
  private lastSubmitRequestId: string | null = null;
  private imageMode = false;
  private imageDraft: ImageDraft | null = null;
  private imagePreviewed = false;
  private imageBusy = false;
  private imageNotice = '';
  private imageFileError = '';
  private imageResult: StudyImageInfo | null = null;
  private imageError: ServiceError | null = null;
  private imageInput: HTMLInputElement | null = null;
  private imageGen = 0;

  constructor(options: StudyControllerOptions) {
    this.options = options;
  }

  getState(): Readonly<{
    phase: StudyActivityPhase;
    workspace: StudyWorkspace | null;
    session: StartedTutorSession | null;
    tutorState: StudyTurnState | TutorSessionState | null;
    feedback: StudyGradeResult | null;
    selfReport: SelfReport | null;
    draftStatus: DraftStatus;
    reviewRange: StudyReviewRange | null;
    messages: readonly ChatMessage[];
    finishReceipt: StudyFinishReceipt | null;
    loading: boolean;
    error: ServiceError | null;
  }> {
    return {
      phase: this.phase,
      workspace: this.workspace,
      session: this.session,
      tutorState: this.tutorState,
      feedback: this.feedback,
      selfReport: this.selfReport,
      draftStatus: this.draftStatus,
      reviewRange: this.reviewRange,
      messages: [...this.messages],
      finishReceipt: this.finishReceipt,
      loading: this.loading,
      error: this.error,
    };
  }

  /* ------------------------------------------------------------ mounting */

  async onPageMount(context: EducationPageContext): Promise<void> {
    this.pageContext = context;
    this.navigate = context.navigate;
    const nextIntent = this.resolveIntent(context);
    const key = `${nextIntent.conceptId ?? 'none'}|${nextIntent.mode}|${nextIntent.sessionId ?? 'new'}|${nextIntent.activityId ?? 'none'}`;
    this.intent = nextIntent;
    if (key !== this.loadedKey) {
      this.loadedKey = key;
      this.resetView();
      await this.load(key);
    } else {
      this.notify();
    }
  }

  onPageUnmount(): void {
    this.submitGen += 1;
    if (this.currentToken !== null) this.currentToken.cancelled = true;
    this.pageContext = null;
    this.navigate = null;
    this.renderers.clear();
    this.form?.unmount();
    this.form = null;
    this.feedbackController?.unmount();
    this.feedbackController = null;
    this.imageInput = null;
    this.materialContainer = null;
    this.chatContainer = null;
    this.activityContainer = null;
    this.feedbackContainer = null;
    this.feedbackRoot = null;
    this.draftStatusNode = null;
  }

  mountMaterial(container: HTMLElement): void {
    this.materialContainer = container;
    this.renderers.add(() => this.renderMaterial());
    this.renderMaterial();
  }

  mountChat(container: HTMLElement): void {
    this.chatContainer = container;
    this.renderers.add(() => this.renderChat());
    this.renderChat();
  }

  mountActivity(container: HTMLElement): void {
    this.activityContainer = container;
    this.renderers.add(() => this.renderActivity());
    this.renderActivity();
  }

  mountFeedback(container: HTMLElement): void {
    this.feedbackContainer = container;
    container.tabIndex = -1;
    this.renderers.add(() => this.renderFeedback());
    this.renderFeedback();
  }

  private notify(): void {
    for (const renderer of this.renderers) renderer();
  }

  /* --------------------------------------------------------------- intent */

  private resolveIntent(context: EducationPageContext): Intent {
    const state = context.services.getState();
    const path = state.currentPath;
    const query = new URLSearchParams(path.includes('?') ? path.slice(path.indexOf('?') + 1) : '');
    const queryConcept = query.get('concept');
    const queryMode = query.get('mode');
    const queryActivity = query.get('activity');
    const resume = state.resume;
    if (resume !== null && queryConcept === null && queryMode === null) {
      return {
        conceptId: resume.session.conceptId,
        mode: resume.session.mode === 'review' ? 'review' : 'learn',
        sessionId: resume.session.id,
        activityId: resume.activityId,
        fromResume: true,
      };
    }
    const mode = queryMode === 'review' ? 'review' : 'learn';
    return {
      conceptId: queryConcept,
      mode,
      sessionId: null,
      activityId: queryActivity,
      fromResume: false,
    };
  }

  private resetView(): void {
    this.workspace = null;
    this.session = null;
    this.tutorState = null;
    this.progress = null;
    this.selfReport = null;
    this.activity = null;
    this.answer = null;
    this.draft = null;
    this.draftStatus = 'none';
    this.draftError = null;
    this.phase = 'draft';
    this.machine.reset();
    this.form?.unmount();
    this.form = null;
    this.feedback = null;
    this.feedbackController?.unmount();
    this.feedbackController = null;
    this.attemptId = null;
    this.failedError = null;
    this.failureNotice = '';
    this.lateNotice = '';
    this.skipNotice = '';
    this.finishReceipt = null;
    this.finishLabel = '';
    this.reviewRange = null;
    this.reviewSelected.clear();
    this.reviewSkipped = false;
    this.reviewNotice = '';
    this.messages = [];
    this.chatText = '';
    this.chatNotice = '';
    this.chatError = null;
    this.helpNotice = '';
    this.imageMode = false;
    this.imageDraft = null;
    this.imagePreviewed = false;
    this.imageBusy = false;
    this.imageNotice = '';
    this.imageFileError = '';
    this.imageResult = null;
    this.imageError = null;
    this.imageInput = null;
    this.loading = true;
    this.error = null;
  }

  private async load(key: string): Promise<void> {
    const token = ++this.loadToken;
    this.loading = true;
    this.error = null;
    this.notify();
    if (this.intent.conceptId === null) {
      if (this.intent.mode === 'review') {
        const range = await this.options.dataSource.loadReviewRange(this.request());
        if (token !== this.loadToken) return;
        this.loading = false;
        if (!range.ok) this.error = range.error;
        else {
          this.reviewRange = range.data;
          this.reviewSelected = new Set(range.data.candidates.slice(0, 1).map((entry) => entry.conceptId));
          this.reviewNotice = '请选择推荐范围，或跳过推荐自选范围。';
          this.messages = [assistant('先选择复习范围；开始后会先回忆，再给反馈。')];
        }
        this.notify();
        return;
      }
      this.loading = false;
      this.error = null;
      this.notify();
      return;
    }
    const result = await this.options.dataSource.loadWorkspace(this.request(), {
      conceptId: this.intent.conceptId,
      mode: this.intent.mode,
      sessionId: this.intent.sessionId ?? undefined,
      activityId: this.intent.activityId,
    });
    if (token !== this.loadToken) return;
    if (!result.ok) {
      this.loading = false;
      this.error = result.error;
      this.loadedKey = key;
      this.notify();
      return;
    }
    this.workspace = result.data;
    this.progress = result.data.progress;
    this.selfReport = result.data.selfReport;
    this.activity = result.data.activity;
    this.loading = false;
    this.reviewRange = this.intent.mode === 'review' && !this.intent.fromResume ? result.data.reviewRange : null;
    if (this.reviewRange !== null) {
      this.reviewSelected = new Set(
        this.intent.conceptId === null
          ? this.reviewRange.candidates.slice(0, 1).map((entry) => entry.conceptId)
          : [this.intent.conceptId],
      );
      this.notify();
      return;
    }
    await this.startSession();
  }

  private async startSession(): Promise<void> {
    if (this.workspace === null) return;
    const result = await this.options.dataSource.startSession(this.request(), {
      conceptId: this.workspace.concept.id,
      mode: this.intent.mode,
      sessionId: this.intent.sessionId ?? undefined,
      activityId: this.workspace.activity.id,
    });
    if (!result.ok) {
      this.error = result.error;
      this.notify();
      return;
    }
    this.session = result.data;
    this.tutorState = result.data.state;
    this.activity = this.workspace.activity;
    this.phase = 'draft';
    this.machine.reset();
    this.feedback = null;
    this.finishReceipt = null;
    const draft = await this.options.dataSource.loadDraft(this.request(), this.draftKey());
    if (draft.ok && draft.data !== null) {
      this.draft = draft.data;
      this.answer = draft.data.answer;
      this.draftStatus = 'saved';
    }
    this.messages = [
      assistant(
        this.intent.mode === 'review'
          ? '复习先回忆，再给反馈。可以随时打开材料、要提示或结束本轮。'
          : '先读材料，再试着用自己的话回答；随时可以要提示、解释或示范。',
      ),
    ];
    this.notify();
  }

  private request(): RequestContext {
    return this.options.createRequest();
  }

  private draftKey(): StudyDraftKey {
    return {
      conceptId: this.workspace?.concept.id ?? this.intent.conceptId ?? '',
      mode: this.intent.mode,
      activityId: this.activity?.id ?? '',
    };
  }

  /* --------------------------------------------------------------- drafts */

  private async autosave(value: AnswerFormValue): Promise<void> {
    this.answer = value;
    if (this.workspace === null || this.activity === null) return;
    const token = ++this.draftToken;
    this.draftStatus = 'saving';
    this.draftError = null;
    this.updateDraftStatusNodes();
    const draft: StudyDraft = {
      conceptId: this.workspace.concept.id,
      mode: this.intent.mode,
      activityId: this.activity.id,
      answer: value,
      savedAt: new Date().toISOString(),
    };
    const result = await this.options.dataSource.saveDraft(this.request(), draft);
    if (token !== this.draftToken) return;
    if (result.ok) {
      this.draft = draft;
      this.draftStatus = 'saved';
    } else {
      this.draftStatus = 'failed';
      this.draftError = result.error;
    }
    this.updateDraftStatusNodes();
    if (this.phase === 'draft') this.notify();
  }

  private updateDraftStatusNodes(): void {    if (this.draftStatusNode !== null) {
      this.draftStatusNode.textContent =
        this.draftStatus === 'saved'
          ? DRAFT_SAVED
          : this.draftStatus === 'saving'
            ? '正在保存草稿…'
            : this.draftStatus === 'failed'
              ? DRAFT_UNSAVED
              : '';
      this.draftStatusNode.dataset['state'] = this.draftStatus;
    }
  }

  /* ------------------------------------------------------------ activity */

  async submit(value?: AnswerFormValue): Promise<void> {
    const answer = value ?? this.answer;
    if (answer === null || this.session === null || this.activity === null || this.workspace === null) return;
    if (this.phase !== 'draft' && this.phase !== 'failed' && this.phase !== 'cancelled') return;
    if (!hasAnswer(answer)) {
      this.failureNotice = '先写一点内容，或选择一个选项，再提交。';
      this.notify();
      return;
    }
    this.answer = answer;
    this.failedError = null;
    this.failureNotice = '';
    this.lateNotice = '';
    if (this.phase === 'failed' || this.phase === 'cancelled') this.machine.reset();
    this.machine.transition('submitted');
    this.phase = 'submitted';
    this.notify();
    const generation = ++this.submitGen;
    const token = { cancelled: false };
    this.currentToken = token;
    await Promise.resolve();
    if (generation !== this.submitGen) return;
    this.machine.transition('grading');
    this.phase = 'grading';
    this.notify();
    const request = this.request();
    const requestId = request.requestId;
    this.lastSubmitRequestId = requestId;
    const result = await this.options.dataSource.submitTurn(
      { ...request, signal: token as never },
      {
        requestId,
        sessionId: this.session.session.id,
        revision: this.tutorState?.revision ?? this.session.state.revision,
        attempt: {
          activityId: this.activity.id,
          inputType: answerInputType(answer),
          answerText: encodeAnswer(this.activity, answer),
        },
      },
    );
    if (generation !== this.submitGen) {
      this.lateNotice = '这次反馈返回得太晚，已丢弃为迟到结果；不会写回当前活动或其他概念。';
      this.notify();
      return;
    }
    if (token.cancelled) return;
    if (!result.ok) {
      this.phase = 'failed';
      this.failedError = result.error;
      this.failureNotice =
        result.error.code === 'UNAVAILABLE'
          ? '云端反馈暂不可用；本地材料、原答和草稿仍保留，不会伪造模型回复。'
          : '';
      this.machine.transition('failed');
      this.notify();
      return;
    }
    this.applyTurn(result.data);
  }

  private applyTurn(outcome: StudyTurnOutcome): void {
    this.tutorState = outcome.state;
    this.messages = [...this.messages, assistant(outcome.message, outcome.decision.disclosure)];
    this.helpNotice = decisionNotice(outcome.decision) ?? '';
    const attempt = outcome.attemptOutcome;
    if (attempt === null) {
      this.phase = this.phase === 'grading' || this.phase === 'submitted' ? 'draft' : this.phase;
      this.notify();
      return;
    }
    this.attemptId = attempt.attemptId;
    if (!attempt.persisted) {
      this.phase = 'failed';
      this.machine.transition('failed');
      this.failedError = { code: 'STORAGE_FAILED', message: '原答没有保存成功', retryable: true };
      this.notify();
      return;
    }
    if (this.imageMode) {
      this.imageResult = outcome.image ?? this.imageResult;
      if (attempt.grade !== null && attempt.grade.requiresClarification) {
        this.feedback = attempt.grade;
        this.phase = 'feedback';
        this.machine.transition('feedback');
        this.imageNotice = '这次图片只记为待澄清，没有写入成绩；可以重拍或改用文字。';
        this.notify();
        this.focusFeedback();
        return;
      }
    }
    if (attempt.feedbackPending || attempt.grade === null) {
      if (this.imageMode) {
        this.imageResult = outcome.image ?? this.imageResult;
        this.imageNotice =
          attempt.duplicate
            ? '这张图片此前已经提交过；本次不重复记答，也不再判分。'
            : '图片已保存为待批改；反馈暂时没有完成，可以重试批改或改用文字作答。';
        this.phase = 'feedback';
        this.machine.transition('feedback');
        this.notify();
        return;
      }
      this.phase = 'failed';
      this.machine.transition('failed');
      this.failureNotice = '原答已经保存，反馈暂时没有完成；可以重试批改，不需要重新作答。';
      this.notify();
      return;
    }
    this.feedback = attempt.grade;
    this.phase = 'feedback';
    this.machine.transition('feedback');
    this.form?.unmount();
    this.form = null;
    void this.clearDraft();
    this.notify();
    this.focusFeedback();
  }

  cancelTurn(): void {
    if (this.phase !== 'submitted' && this.phase !== 'grading') return;
    this.submitGen += 1;
    if (this.currentToken !== null) this.currentToken.cancelled = true;
    this.currentToken = null;
    this.machine.transition('cancelled');
    this.phase = 'cancelled';
    this.lateNotice = '已取消本次反馈；之后到达的结果会丢弃，原答和草稿仍保留。';
    this.notify();
  }

  async retry(): Promise<void> {
    if (this.session === null) return;
    if (this.attemptId !== null) {
      const request = this.request();
      this.phase = 'grading';
      this.machine.transition('grading');
      this.notify();
      const result = await this.options.dataSource.retryPendingGrading(request, {
        sessionId: this.session.session.id,
        requestId: request.requestId,
      });
      if (!result.ok) {
        this.phase = 'failed';
        this.failedError = result.error;
        this.notify();
        return;
      }
      if (result.data.grade !== null) {
        this.feedback = result.data.grade;
        this.phase = 'feedback';
        this.machine.transition('feedback');
        void this.clearDraft();
        this.notify();
        this.focusFeedback();
      } else {
        this.phase = 'failed';
        this.notify();
      }
      return;
    }
    this.phase = 'draft';
    this.machine.reset();
    await this.submit(this.answer ?? undefined);
  }

  editAnswer(): void {
    if (this.phase !== 'feedback' && this.phase !== 'failed' && this.phase !== 'cancelled') return;
    this.phase = 'draft';
    this.machine.reset();
    this.form?.unmount();
    this.form = null;
    this.notify();
  }

  async skip(): Promise<void> {
    if (this.session === null) return;
    const request = this.request();
    const result = await this.options.dataSource.skip(request, {
      requestId: request.requestId,
      sessionId: this.session.session.id,
      revision: this.tutorState?.revision ?? this.session.state.revision,
    });
    if (!result.ok) {
      this.chatError = result.error;
      this.notify();
      return;
    }
    this.tutorState = result.data.state;
    this.skipNotice = result.data.message || SKIP_NOTE;
    this.messages = [...this.messages, system(this.skipNotice)];
    this.notify();
  }

  async finishRound(): Promise<void> {
    if (this.session === null) return;
    const request = this.request();
    const revision = this.tutorState?.revision ?? this.session.state.revision;
    const result =
      this.intent.mode === 'review'
        ? await this.options.dataSource.finishReview(request, {
            requestId: request.requestId,
            sessionId: this.session.session.id,
            revision,
          })
        : await this.options.dataSource.finishLearning(request, {
            requestId: request.requestId,
            sessionId: this.session.session.id,
            revision,
          });
    if (!result.ok) {
      this.failedError = result.error;
      this.notify();
      return;
    }
    this.finishReceipt = result.data;
    this.finishLabel = this.intent.mode === 'review' ? '本轮复习结果' : '本轮学习结果';
    this.phase = 'feedback';
    this.machine.transition(this.phase);
    this.form?.unmount();
    this.form = null;
    const progress = await this.options.dataSource.loadProgress(request, this.workspace?.concept.id ?? '');
    if (progress.ok) this.progress = progress.data;
    this.notify();
    this.focusFeedback();
  }

  leaveUnfinished(): void {
    void this.persistNow();
    this.navigate?.('/map');
  }

  async lowerDifficulty(): Promise<void> {
    await this.sendMessage('我连续没答出来，请换一种更简单的讲法。');
  }

  async sendHelp(kind: 'hint' | 'explanation' | 'example' | 'worked_solution' | 'answer'): Promise<void> {
    if (this.session === null) return;
    const action = HELP_ACTIONS.find((entry) => entry.kind === kind);
    this.messages = [...this.messages, { role: 'student', text: action?.label ?? kind, disclosure: false }];
    this.helpNotice = action?.note ?? '';
    this.notify();
    const request = this.request();
    const result = await this.options.dataSource.submitTurn(request, {
      requestId: request.requestId,
      sessionId: this.session.session.id,
      revision: this.tutorState?.revision ?? this.session.state.revision,
      helpRequest: kind,
    });
    if (!result.ok) {
      this.chatError = result.error;
      this.notify();
      return;
    }
    this.tutorState = result.data.state;
    this.messages = [...this.messages, assistant(result.data.message, result.data.decision.disclosure)];
    this.helpNotice = decisionNotice(result.data.decision) ?? action?.note ?? '';
    this.notify();
  }

  async sendMessage(text: string): Promise<void> {
    const value = text.trim();
    if (value.length === 0 || this.session === null) return;
    this.chatText = '';
    this.messages = [...this.messages, { role: 'student', text: value, disclosure: false }];
    this.notify();
    const request = this.request();
    const result = await this.options.dataSource.submitTurn(request, {
      requestId: request.requestId,
      sessionId: this.session.session.id,
      revision: this.tutorState?.revision ?? this.session.state.revision,
      message: value,
    });
    if (!result.ok) {
      this.chatError = result.error;
      this.notify();
      return;
    }
    this.tutorState = result.data.state;
    this.messages = [...this.messages, assistant(result.data.message, result.data.decision.disclosure)];
    this.helpNotice = decisionNotice(result.data.decision) ?? this.helpNotice;
    this.notify();
  }

  setChatText(text: string): void {
    this.chatText = text;
  }

  async saveSelfReport(state: 'uncertain' | 'basically_understood' | 'can_explain'): Promise<void> {
    if (this.workspace === null) return;
    const result = await this.options.dataSource.saveSelfReport(this.request(), {
      conceptId: this.workspace.concept.id,
      claimedState: state,
    });
    if (result.ok) {
      this.selfReport = result.data;
      this.notify();
    } else {
      this.failedError = result.error;
      this.notify();
    }
  }

  async startReview(conceptId: string): Promise<void> {
    if (this.workspace !== null && this.workspace.concept.id === conceptId) {
      await this.startSession();
      this.reviewRange = null;
      this.notify();
      return;
    }
    const workspace = await this.options.dataSource.loadWorkspace(this.request(), {
      conceptId,
      mode: 'review',
    });
    if (!workspace.ok) {
      this.error = workspace.error;
      this.notify();
      return;
    }
    this.workspace = workspace.data;
    this.progress = workspace.data.progress;
    this.selfReport = workspace.data.selfReport;
    this.activity = workspace.data.activity;
    this.intent = { ...this.intent, conceptId };
    this.reviewRange = null;
    await this.startSession();
  }

  toggleReview(conceptId: string, selected: boolean): void {
    if (selected) this.reviewSelected.add(conceptId);
    else this.reviewSelected.delete(conceptId);
  }

  skipReviewRange(): void {
    this.reviewSkipped = true;
    this.reviewNotice = '已跳过推荐；可以自选范围开始复习，不会自动生成掌握判断。';
    this.notify();
  }

  async deferReview(): Promise<void> {
    const conceptId = [...this.reviewSelected][0] ?? this.reviewRange?.candidates[0]?.conceptId;
    if (conceptId === undefined) return;
    const result = await this.options.dataSource.deferReview(this.request(), conceptId);
    if (!result.ok) {
      this.reviewNotice = '暂缓没有完成；请稍后重试。';
      this.notify();
      return;
    }
    this.reviewNotice = `已暂缓一次；新的待复习时间：${formatStudyTime(result.data.dueAt)}。不会改为“已复习”。`;
    this.notify();
  }

  startImageMode(): void {
    if (this.workspace === null || this.workspace.imageFlow === null) return;
    this.imageMode = true;
    this.form?.unmount();
    this.form = null;
    this.imageDraft = null;
    this.imagePreviewed = false;
    this.imageBusy = false;
    this.imageNotice = '';
    this.imageFileError = '';
    this.imageResult = null;
    this.imageError = null;
    this.notify();
  }

  stopImageMode(): void {
    this.imageGen += 1;
    this.imageMode = false;
    this.imageDraft = null;
    this.imagePreviewed = false;
    this.imageBusy = false;
    this.imageNotice = '';
    this.imageFileError = '';
    this.imageResult = null;
    this.imageError = null;
    this.imageInput = null;
    if (this.phase === 'feedback' || this.phase === 'failed') {
      this.phase = 'draft';
      this.feedback = null;
      this.machine.reset();
    }
    this.notify();
  }

  /** Reads the selected file locally; nothing is uploaded at this point. */
  private async chooseImage(file: File): Promise<void> {
    const generation = ++this.imageGen;
    if (this.phase === 'feedback' || this.phase === 'failed') {
      this.phase = 'draft';
      this.feedback = null;
      this.machine.reset();
    }
    this.imageBusy = true;
    this.imageDraft = null;
    this.imagePreviewed = false;
    this.imageFileError = '';
    this.imageNotice = '';
    this.imageResult = null;
    this.imageError = null;
    this.notify();
    try {
      const draft = await readImageFile(file);
      if (generation !== this.imageGen) return;
      this.imageDraft = draft;
      this.imageNotice = '图片只在本机预览；确认发送后才会通过模型服务识别。';
    } catch (error) {
      if (generation !== this.imageGen) return;
      this.imageDraft = null;
      this.imageFileError = error instanceof Error ? error.message : '图片读取失败，请重新选择。';
    } finally {
      if (generation === this.imageGen) {
        this.imageBusy = false;
        this.notify();
      }
    }
  }

  previewImage(): void {
    if (this.imageDraft === null) return;
    this.imagePreviewed = true;
    this.notify();
  }

  private retakeImage(): void {
    this.imageGen += 1;
    this.imageDraft = null;
    this.imagePreviewed = false;
    this.imageBusy = false;
    this.imageResult = null;
    this.imageError = null;
    this.imageFileError = '';
    this.imageNotice = '请重新拍照或选择图片；上一张没有上传。';
    if (this.phase === 'feedback' || this.phase === 'failed') {
      this.phase = 'draft';
      this.feedback = null;
      this.machine.reset();
    }
    this.notify();
    this.imageInput?.focus();
  }

  private cancelImageWait(): void {
    if (!this.imageBusy) return;
    this.imageGen += 1;
    this.imageBusy = false;
    this.imageNotice = '已取消等待这次识别；图片仍保留在本机，不会自动重发。';
    this.notify();
  }

  approveImageSend(): void {
    const draft = this.imageDraft;
    if (draft === null || this.workspace === null || this.session === null || this.activity === null) return;
    if (this.imageBusy) return;
    if (this.phase === 'feedback' || this.phase === 'submitted' || this.phase === 'grading') return;
    const submitImage = this.options.dataSource.submitImageAnswer;
    if (submitImage === undefined) {
      this.imageError = { code: 'UNSUPPORTED', message: '当前构建没有图片判分通道；可以改用文字作答。', retryable: false };
      this.notify();
      return;
    }
    const generation = ++this.imageGen;
    this.imageBusy = true;
    this.imageError = null;
    this.imageNotice = '';
    if (this.phase === 'draft' || this.phase === 'failed' || this.phase === 'cancelled') {
      this.machine.reset();
      this.machine.transition('submitted');
      this.machine.transition('grading');
      this.phase = 'grading';
    }
    this.notify();
    const request = this.request();
    void submitImage
      .call(this.options.dataSource, request, {
        sessionId: this.session.session.id,
        activityId: this.activity.id,
        assetId: `asset.image.local.${draft.base64.length}`,
        answerText: null,
        base64: draft.base64,
        mime: draft.mime,
        width: draft.width,
        height: draft.height,
      })
      .then((result) => {
        if (generation !== this.imageGen) return;
        this.imageBusy = false;
        if (!result.ok) {
          this.phase = 'failed';
          this.machine.transition('failed');
          this.imageError = result.error;
          this.notify();
          return;
        }
        this.imageResult = result.data.image ?? null;
        if (result.data.attemptOutcome === null) {
          this.phase = 'failed';
          this.machine.transition('failed');
          this.imageError = {
            code: 'STORAGE_FAILED',
            message: '判分已返回，但没有收到保存结果；这次不会当作已记录。',
            retryable: true,
          };
          this.notify();
          return;
        }
        this.applyTurn(result.data);
      })
      .catch((error: unknown) => {
        if (generation !== this.imageGen) return;
        this.imageBusy = false;
        this.phase = 'failed';
        this.machine.transition('failed');
        this.imageError = {
          code: 'UNAVAILABLE',
          message: error instanceof Error ? error.message : '图片判分请求失败，请稍后重试。',
          retryable: true,
        };
        this.notify();
      });
  }

  private async clearDraft(): Promise<void> {
    if (this.workspace === null) return;
    await this.options.dataSource.clearDraft(this.request(), this.draftKey());
    this.draft = null;
    this.answer = null;
    this.draftStatus = 'saved';
    this.updateDraftStatusNodes();
  }

  private async persistNow(): Promise<void> {
    if (this.answer !== null) await this.autosave(this.answer);
  }

  private focusFeedback(): void {
    const root = this.feedbackRoot;
    const target = root?.querySelector<HTMLElement>('button') ?? root;
    target?.focus();
  }

  /* -------------------------------------------------------------- renders */

  private renderMaterial(): void {
    const container = this.materialContainer;
    if (container === null) return;
    clear(container);
    if (this.loading) {
      container.append(loadingState({ title: '正在打开学习材料…' }));
      return;
    }
    if (this.error !== null) {
      container.append(
        renderErrorBanner(this.error, {
          onRetry: () => void this.load(this.loadedKey),
          onBack: () => this.navigate?.('/map'),
          backLabel: '返回地图',
        }),
      );
      return;
    }
    if (this.workspace === null) {
      container.append(
        emptyState({
          title: '还没有选择学习活动',
          body: '从地图选择概念，或在首页继续上次。',
          actions: [
            { label: '去地图', onClick: () => this.navigate?.('/map'), tone: 'primary' },
            { label: '返回首页', onClick: () => this.navigate?.('/home') },
          ],
        }),
      );
      return;
    }
    const workspace = this.workspace;
    const summary = this.summary();
    container.append(
      h(
        'div',
        { class: 'edu-study-material', 'data-testid': 'study-material' },
        h('p', { class: 'edu-muted', 'data-testid': 'study-focus' }, `${workspace.courseEditionLabel} · 内容包 ${workspace.packVersion} · ${this.intent.mode === 'review' ? '复习' : '学习'}`),
        h('h2', { class: 'edu-card__title' }, workspace.concept.title),
        h('p', { class: 'edu-card__meta' }, `${workspace.scope === 'partial' ? '部分内容（未达全册）' : '全册范围'} · ${workspace.trustMode === 'candidate' ? '候选内容（未核实）' : '正式内容'}`),
        h('h3', { class: 'edu-card__title' }, '学习目标'),
        h('ul', { class: 'edu-study-list' }, ...workspace.concept.learningObjectives.map((objective) => h('li', {}, objective))),
        h('h3', { class: 'edu-card__title' }, '材料'),
        h('p', { class: 'edu-study-text' }, workspace.concept.explanation),
        workspace.concept.misconceptions.length > 0
          ? h(
              'div',
              { class: 'edu-study-misconceptions' },
              h('h3', { class: 'edu-card__title' }, '容易混淆'),
              ...workspace.concept.misconceptions.map((entry) => h('p', { class: 'edu-study-text' }, `${entry.statement} → ${entry.correction}`)),
            )
          : null,
        h('h3', { class: 'edu-card__title' }, '出处'),
        ...workspace.sources.map((source) => {
          const sourceButton = button('查看出处', () => this.openSource(source, sourceButton), {
            small: true,
            dataAction: 'study-source',
          });
          return h(
            'div',
            { class: 'edu-study-source-row' },
            sourceButton,
            h('span', { class: 'edu-muted' }, source.label),
          );
        }),
        h('p', { class: 'edu-study-status', 'data-testid': 'study-draft-status' }, this.draftStatus === 'saved' ? DRAFT_SAVED : this.draftStatus === 'saving' ? '正在保存草稿…' : this.draftStatus === 'failed' ? DRAFT_UNSAVED : ''),
        h('div', { class: 'edu-inline-actions' }, ...this.axisChips(summary)),
        workspace.compatibility !== null
          ? notice({
              tone: 'warning',
              title: '内容版本不兼容',
              body: `上次内容版本 ${workspace.compatibility.previousPackVersion}，当前 ${workspace.compatibility.currentPackVersion}。${workspace.compatibility.reason} 旧记录仍可查看，不会静默迁移。`,
              actions: [
                { label: '查看旧记录', onClick: () => this.navigate?.('/records') },
                { label: '去教材库', onClick: () => this.navigate?.('/library') },
              ],
            })
          : null,
        workspace.notice !== null ? h('p', { class: 'edu-muted', 'data-testid': 'study-fixture-notice' }, workspace.notice) : null,
      ),
    );
  }

  private renderChat(): void {
    const container = this.chatContainer;
    if (container === null) return;
    clear(container);
    const root = h('div', { class: 'edu-study-chat', 'data-testid': 'study-chat' }, h('h3', { class: 'edu-card__title' }, '学习助手'));
    for (const message of this.messages) {
      root.append(
        h(
          'div',
          { class: `edu-study-message edu-study-message--${message.role}`, 'data-role': message.role },
          h('span', { class: 'edu-muted' }, message.role === 'student' ? '你' : message.role === 'assistant' ? '助手' : '状态'),
          h('p', {}, message.text),
          message.disclosure ? statusChip('本轮包含 disclosure', 'attention') : null,
        ),
      );
    }
    const actions = h('div', { class: 'edu-study-help-actions', 'data-testid': 'study-help-actions' });
    for (const action of HELP_ACTIONS) {
      actions.append(
        button(action.label, () => void this.sendHelp(action.kind), {
          small: true,
          dataAction: `help-${action.kind}`,
          title: action.note,
        }),
      );
    }
    root.append(actions);
    if (this.helpNotice.length > 0) {
      root.append(h('p', { class: 'edu-notice edu-notice--warning', role: 'status', 'data-testid': 'study-help-notice' }, this.helpNotice));
    }
    if (this.chatError !== null) {
      root.append(
        renderErrorBanner(this.chatError, {
          onRetry: () => void this.sendMessage('请重试这次请求。'),
          backLabel: '继续读材料',
          onBack: () => undefined,
        }),
      );
    }
    const input = h('textarea', {
      class: 'edu-input',
      rows: 3,
      'aria-label': '给学习助手发消息',
      'data-testid': 'study-chat-input',
      oninput: (event: Event) => {
        this.chatText = (event.currentTarget as HTMLTextAreaElement).value;
      },
    });
    input.value = this.chatText;
    root.append(
      h(
        'div',
        { class: 'edu-study-chat-input' },
        input,
        button('发送', () => void this.sendMessage(input.value), {
          small: true,
          tone: 'primary',
          dataAction: 'send-chat',
          disabled: this.session === null,
        }),
      ),
      h('p', { class: 'edu-muted' }, '多行文字换行不会自动提交；使用“发送”按钮。提示、解释、示范和看答案都可随时请求。'),
    );
    if (this.tutorState !== null && this.tutorState.consecutiveFailures >= 2) {
      root.append(
        h('div', { class: 'edu-study-low-difficulty' }, h('p', { class: 'edu-muted' }, LOW_DIFFICULTY_NOTE), button('换一种讲法', () => void this.lowerDifficulty(), { small: true, dataAction: 'lower-difficulty' })),
      );
    }
    container.append(root);
  }

  private renderActivity(): void {
    const container = this.activityContainer;
    if (container === null) return;
    if (this.reviewRange !== null && this.session === null) {
      this.renderReviewRange(container);
      return;
    }
    if (this.loading) {
      clear(container);
      container.append(loadingState({ title: '正在准备活动…' }));
      return;
    }
    if (this.error !== null) {
      clear(container);
      container.append(renderErrorBanner(this.error, { onRetry: () => void this.load(this.loadedKey), backLabel: '返回地图', onBack: () => this.navigate?.('/map') }));
      return;
    }
    if (this.workspace === null || this.activity === null) {
      clear(container);
      container.append(emptyState({ title: '还没有打开活动', body: '从地图选择概念后进入学习或复习。', actions: [{ label: '去地图', onClick: () => this.navigate?.('/map'), tone: 'primary' }] }));
      return;
    }
    if (this.imageMode) {
      this.renderImageAnswer(container);
      return;
    }
    // Do not rebuild the form on draft autosave.
    if (this.form !== null && this.phase === 'draft' && this.formActivityId === this.activity.id) {
      return;
    }
    clear(container);
    const root = h('div', { class: 'edu-study-activity', 'data-testid': 'study-activity' });
    const draftStatus = h('p', { class: 'edu-study-status', 'data-testid': 'study-activity-draft-status' });
    this.draftStatusNode = draftStatus;
    this.updateDraftStatusNodes();
    root.append(
      h('div', { class: 'edu-study-activity-head' },
        h('h2', { class: 'edu-card__title' }, '当前活动'),
        statusChip(PHASE_LABELS[this.phase], PHASE_TONES[this.phase]),
      ),
      h('p', { class: 'edu-card__meta' }, `${this.activity.type === 'recall' ? '回忆' : this.activity.type === 'explain' ? '解释' : this.activity.type === 'choice' ? '选择' : this.activity.type === 'relation' ? '关系' : this.activity.type === 'diagram_label' ? '图示标注' : '迁移'} · 版本 ${this.activity.version}`),
      h('p', { class: 'edu-study-stem' }, this.activity.stem),
      draftStatus,
    );
    if (this.lateNotice.length > 0) root.append(h('p', { class: 'edu-notice edu-notice--warning', role: 'status' }, this.lateNotice));
    if (this.failureNotice.length > 0) root.append(h('p', { class: 'edu-notice edu-notice--warning', role: 'status' }, this.failureNotice));
    if (this.skipNotice.length > 0) root.append(h('p', { class: 'edu-notice edu-notice--info', role: 'status' }, this.skipNotice));
    if (this.failedError !== null) {
      root.append(
        renderErrorBanner(this.failedError, {
          onRetry: () => void this.retry(),
          backLabel: '改文字',
          onBack: () => this.editAnswer(),
        }),
      );
    }
    if (this.phase === 'failed') {
      root.append(
        h('div', { class: 'edu-inline-actions' },
          button('重试批改', () => void this.retry(), { small: true, tone: 'primary', dataAction: 'retry-grading' }),
          button('改文字', () => this.editAnswer(), { small: true, dataAction: 'edit-answer' }),
        ),
      );
    }
    if (this.finishReceipt !== null) {
      root.append(this.finishSummary());
      container.append(root);
      return;
    }
    if (this.phase === 'submitted' || this.phase === 'grading') {
      root.append(
        h('div', { class: 'edu-study-pending', role: 'status' },
          h('p', {}, this.phase === 'submitted' ? '原答已提交，正在保存…' : '原答已保存，正在等待反馈…'),
          h('p', { class: 'edu-muted' }, '反馈完成前不会显示为已掌握；可以取消，原答和草稿会保留。'),
        ),
        button('取消本次反馈', () => this.cancelTurn(), { small: true, tone: 'danger-ghost', dataAction: 'cancel-turn' }),
      );
      container.append(root);
      return;
    }
    if (this.phase === 'feedback') {
      root.append(
        h('p', { class: 'edu-muted' }, '本次作答已提交；反馈在右侧。你可以改文字再试一次，或结束本轮。'),
        h('div', { class: 'edu-inline-actions' },
          button('改文字再试', () => this.editAnswer(), { small: true, dataAction: 'edit-answer' }),
          button('结束本轮', () => void this.finishRound(), { small: true, tone: 'primary', dataAction: 'finish-round' }),
          button('暂不完成，返回地图', () => this.leaveUnfinished(), { small: true }),
        ),
      );
      container.append(root);
      return;
    }
    this.renderForm(root);
    container.append(root);
  }

  private renderForm(root: HTMLElement): void {
    if (this.activity === null) return;
    this.form?.unmount();
    this.form = null;
    if (!supportsAnswerForm(this.activity)) {
      root.append(
        h('p', { class: 'edu-notice edu-notice--info' }, '这是图示标注活动；请在下方图示区完成，或使用编号列表/文字替代路径。'),
      );
    } else {
      const form = mountAnswerForm(root, {
        activity: this.activity,
        initial: this.answer,
        onSubmit: (value) => void this.submit(value),
        onCancel: () => this.leaveUnfinished(),
      });
      this.form = form;
      this.formActivityId = this.activity.id;
      if (form !== null) {
        const save = (): void => {
          const value = form.getValue();
          this.answer = value;
          void this.autosave(value);
        };
        form.element.addEventListener('input', save);
        form.element.addEventListener('change', save);
      }
    }
    const actions = h('div', { class: 'edu-inline-actions' },
      button('跳过本题', () => void this.skip(), { small: true, dataAction: 'skip-question' }),
      button('结束本轮', () => void this.finishRound(), { small: true, tone: 'primary', dataAction: 'finish-round' }),
      button('暂不完成，返回地图', () => this.leaveUnfinished(), { small: true }),
    );
    if (this.workspace?.imageFlow !== null && this.workspace !== null) {
      actions.append(button('改用图片作答', () => this.startImageMode(), { small: true, dataAction: 'image-answer' }));
    }
    root.append(actions, h('p', { class: 'edu-muted' }, SKIP_NOTE));
  }

  /**
   * Image answer entry. The file input, explicit local preview and the
   * confirm-send step are separate: selecting a file never uploads anything.
   */
  private renderImageAnswer(container: HTMLElement): void {
    clear(container);
    const root = h(
      'div',
      { class: 'edu-study-activity edu-study-image', 'data-testid': 'study-activity' },
      h(
        'div',
        { class: 'edu-study-activity-head' },
        h('h2', { class: 'edu-card__title' }, '上传图片作答'),
        statusChip(PHASE_LABELS[this.phase], PHASE_TONES[this.phase]),
      ),
      h('p', { class: 'edu-muted' }, '拍照或选择图片（PNG / JPEG，不超过 5 MB）。选择不等于发送：先在本机预览，再确认发送给模型识别。'),
      h('p', { class: 'edu-card__meta' }, this.activity?.stem ?? ''),
    );

    const inputId = 'edu-study-image-file';
    const fileInput = h('input', {
      type: 'file',
      id: inputId,
      class: 'edu-study-image-file',
      accept: 'image/png,image/jpeg',
      'aria-label': '拍照或选择作答图片（PNG 或 JPEG）',
      'data-testid': 'image-file-input',
      onchange: (event: Event) => {
        const file = (event.currentTarget as HTMLInputElement).files?.[0];
        if (file !== undefined) void this.chooseImage(file);
      },
    });
    this.imageInput = fileInput;
    root.append(
      h(
        'div',
        { class: 'edu-study-image-picker' },
        h('label', { class: 'edu-button edu-button--small', for: inputId }, '拍照 / 选择图片'),
        fileInput,
      ),
    );

    if (this.imageBusy) {
      root.append(
        h(
          'p',
          { class: 'edu-study-status', role: 'status', 'data-testid': 'image-busy' },
          '正在读取或识别图片，请稍候……不会自动重发。',
        ),
        button('取消等待', () => this.cancelImageWait(), { small: true, dataAction: 'image-cancel-wait' }),
      );
    }

    if (this.imageDraft !== null) {
      const draft = this.imageDraft;
      root.append(
        h(
          'p',
          { class: 'edu-study-status', 'data-testid': 'image-file-meta' },
          `已选择：${draft.fileName} · ${draft.width > 0 && draft.height > 0 ? `${draft.width}×${draft.height} · ` : ''}${draft.mime} · ${Math.max(1, Math.round(draft.byteSize / 1024))} KB`,
        ),
      );
      if (this.imagePreviewed) {
        root.append(
          h('img', {
            class: 'edu-study-image-preview',
            src: draft.dataUrl,
            alt: '待发送的作答图片预览',
            'data-testid': 'image-preview',
          }),
        );
      } else {
        root.append(h('p', { class: 'edu-visual-preview-placeholder' }, '图片预览仅在本机显示。'));
      }
    } else if (!this.imageBusy) {
      root.append(
        h('p', { class: 'edu-muted' }, '还没有选择图片。选好并预览后，再确认发送给模型识别。'),
      );
    }

    const actions = h('div', { class: 'edu-inline-actions' });
    if (this.imageDraft !== null && !this.imageBusy) {
      const preview = button('预览图片', () => this.previewImage(), { small: true, dataAction: 'image-preview' });
      preview.dataset['imageAction'] = 'preview';
      actions.append(
        preview,
        button('重新选择', () => this.retakeImage(), { small: true, dataAction: 'image-retake' }),
      );
    }
    const canSend = this.imageDraft !== null && this.imagePreviewed && !this.imageBusy;
    const send = button('确认发送给模型识别', () => this.approveImageSend(), {
      small: true,
      tone: 'primary',
      disabled: !canSend,
      title:
        this.imageDraft === null
          ? '请先选择图片'
          : this.imagePreviewed
            ? '将把这张图片发送给模型服务识别'
            : '请先预览再确认发送',
      dataAction: 'image-answer-send',
    });
    send.dataset['imageAction'] = 'confirm-send';
    actions.append(send, button('取消本次作答', () => this.stopImageMode(), { small: true, dataAction: 'image-cancel' }));
    root.append(actions);

    root.append(
      h(
        'p',
        { class: 'edu-cloud-note' },
        '发送说明：图片会通过模型服务识别，用于给出反馈；不会上传整本教材或其他学习记录。发送前可以随时取消。',
      ),
    );

    if (this.imageNotice.length > 0) {
      root.append(h('p', { class: 'edu-muted', role: 'status', 'data-testid': 'image-notice' }, this.imageNotice));
    }
    if (this.imageFileError.length > 0) {
      root.append(
        h('p', { class: 'edu-danger-text', role: 'alert', 'data-testid': 'image-file-error' }, this.imageFileError),
      );
    }
    if (this.imageError !== null) {
      root.append(
        renderErrorBanner(this.imageError, {
          onRetry: () => this.approveImageSend(),
          backLabel: '改用文字作答',
          onBack: () => this.stopImageMode(),
        }),
      );
    }
    if (this.imageResult !== null) root.append(this.imageResultSection());
    container.append(root);
  }

  private imageResultSection(): HTMLElement {
    const info = this.imageResult;
    const grade = this.feedback;
    const section = h('div', { class: 'edu-study-image-result', 'data-testid': 'image-result' });
    const clarification =
      info?.stage === 'clarification_required' || grade?.requiresClarification === true;
    if (clarification) {
      section.append(
        h('h3', { class: 'edu-card__title' }, '这张图片还不能判读'),
        h(
          'p',
          { class: 'edu-notice edu-notice--warning', role: 'status' },
          grade?.feedback ??
            info?.clarification?.message ??
            '图片质量或识别结果不足以形成判断；系统不会因此判你答错。',
        ),
      );
      const reasons = [
        ...(info?.qualitySignal?.reasons ?? []),
        ...(info?.clarification?.reasons ?? []),
      ].filter((reason, index, all) => reason.length > 0 && all.indexOf(reason) === index);
      if (reasons.length > 0) {
        section.append(h('ul', { class: 'edu-study-list' }, ...reasons.map((reason) => h('li', {}, reason))));
      }
      if (grade !== null) {
        const sources = grade.sourceRefs.map((ref) => {
          const source = this.workspace?.sources.find((entry) => entry.sourceRefId === ref);
          if (source === undefined) return ref;
          return source.printedPage === null ? `PDF 第 ${source.pdfPage} 页` : `课本第 ${source.printedPage} 页`;
        });
        if (sources.length > 0) {
          section.append(h('p', { class: 'edu-muted' }, `出处：${[...new Set(sources)].join('、')}`));
        }
        section.append(
          h('p', { class: 'edu-muted', 'data-testid': 'image-grader-version' }, `评分版本：${grade.graderVersion}`),
        );
      }
      section.append(
        h(
          'p',
          { class: 'edu-muted' },
          '这次只记为待澄清（draft/pending），不会写入成绩；可以重拍、重新选择，或改用文字作答。',
        ),
      );
    } else if (grade !== null) {
      section.append(h('h3', { class: 'edu-card__title' }, '本次图片判分'));
      if (grade.feedback.length > 0) section.append(h('p', { class: 'edu-study-text' }, grade.feedback));
      const label = { yes: '已达成', no: '未达成', unclear: '待确认' } as const;
      section.append(
        h(
          'ul',
          { class: 'edu-study-list', 'data-testid': 'image-criteria' },
          ...grade.criteria.map((criterion) =>
            h('li', {}, `要点 ${criterion.criterionId}：${label[criterion.met]}。${criterion.rationale}`),
          ),
        ),
      );
      if (grade.uncertainties.length > 0) {
        section.append(
          h('div', { 'data-testid': 'image-uncertainties' },
            h('p', { class: 'edu-muted' }, '不确定项'),
            h('ul', { class: 'edu-study-list' }, ...grade.uncertainties.map((item) => h('li', {}, item))),
          ),
        );
      }
      const sources = grade.sourceRefs.map((ref) => {
        const source = this.workspace?.sources.find((entry) => entry.sourceRefId === ref);
        if (source === undefined) return ref;
        return source.printedPage === null ? `PDF 第 ${source.pdfPage} 页` : `课本第 ${source.printedPage} 页`;
      });
      if (sources.length > 0) {
        section.append(h('p', { class: 'edu-muted', 'data-testid': 'image-sources' }, `出处：${[...new Set(sources)].join('、')}`));
      }
      section.append(
        h('p', { class: 'edu-muted', 'data-testid': 'image-grader-version' }, `评分版本：${grade.graderVersion}`),
      );
      const persistence = info?.persistence;
      if (persistence?.duplicate === true) {
        section.append(h('p', { class: 'edu-muted' }, '同一张图片此前已经提交；本次没有重复记答，也没有再次调用模型。'));
      } else if (persistence?.assessmentCommitted === false) {
        section.append(h('p', { class: 'edu-muted' }, '原答与证据已保存；理解判断仍需更多证据，未升级为“已掌握”。'));
      }
    } else {
      section.append(
        h('p', { class: 'edu-muted', role: 'status' }, this.imageNotice || '这次图片没有形成可显示的结果。'),
      );
    }
    if (info?.persistence?.error !== undefined && info?.persistence?.error !== null) {
      section.append(
        h('p', { class: 'edu-danger-text', role: 'alert' }, `记录没有写入：${info.persistence.error.message}`),
      );
    }
    section.append(
      h(
        'div',
        { class: 'edu-inline-actions' },
        button('重新上传', () => this.retakeImage(), { small: true, dataAction: 'image-retake-result' }),
        button('改用文字作答', () => this.stopImageMode(), { small: true, dataAction: 'image-text-fallback' }),
        grade !== null && !clarification
          ? button('结束本轮', () => void this.finishRound(), { small: true, tone: 'primary', dataAction: 'image-finish' })
          : null,
      ),
    );
    return section;
  }

  private renderReviewRange(container: HTMLElement): void {
    clear(container);
    const range = this.reviewRange;
    const root = h('div', { class: 'edu-study-activity', 'data-testid': 'study-review-range' }, h('h2', { class: 'edu-card__title' }, '复习范围'));
    root.append(h('p', { class: 'edu-muted' }, '先看推荐范围和理由；可以调整、跳过推荐或暂缓一次。复习开始后先回忆，再给反馈。'));
    if (range === null || range.candidates.length === 0) {
      root.append(emptyState({ title: '当前没有待复习项目', body: '仍可自选范围，或回到地图选择概念。', actions: [{ label: '去地图自选', onClick: () => this.navigate?.('/map'), tone: 'primary' }] }));
      container.append(root);
      return;
    }
    const list = h('ul', { class: 'edu-study-review-list' });
    for (const candidate of range.candidates) {
      list.append(this.reviewCandidateRow(candidate));
    }
    root.append(list, h('p', { class: 'edu-note' }, range.note));
    if (this.reviewNotice.length > 0) root.append(h('p', { class: 'edu-muted', role: 'status' }, this.reviewNotice));
    if (this.reviewSkipped) root.append(h('p', { class: 'edu-muted' }, '已跳过推荐；仍可从下面的范围自选。'));
    root.append(
      h('div', { class: 'edu-inline-actions' },
        button('开始复习', () => {
          const chosen = [...this.reviewSelected][0] ?? range.candidates[0]?.conceptId ?? null;
          if (chosen !== null) void this.startReview(chosen);
        }, { tone: 'primary', dataAction: 'start-review' }),
        button('跳过推荐', () => this.skipReviewRange(), { small: true, dataAction: 'skip-review-range' }),
        button('暂缓一次', () => void this.deferReview(), { small: true, dataAction: 'defer-review' }),
        button('返回地图', () => this.navigate?.('/map'), { small: true }),
      ),
    );
    container.append(root);
  }

  private reviewCandidateRow(candidate: StudyReviewCandidate): HTMLElement {
    const input = h('input', {
      type: 'checkbox',
      id: `review-${candidate.conceptId}`,
      checked: this.reviewSelected.has(candidate.conceptId),
      onchange: (event: Event) => this.toggleReview(candidate.conceptId, (event.currentTarget as HTMLInputElement).checked),
    });
    return h(
      'li',
      { class: 'edu-study-review-item' },
      h('label', { class: 'edu-study-review-label', for: `review-${candidate.conceptId}` },
        input,
        h('span', { class: 'edu-card__title' }, candidate.title),
        statusChip(REVIEW_REASON_LABELS[candidate.reason], candidate.reason === 'needs_support' ? 'attention' : 'progress'),
        h('span', { class: 'edu-muted' }, candidate.dueAt === null ? '暂无安排' : `待复习：${formatStudyTime(candidate.dueAt)}`),
        candidate.lastReviewedAt !== null ? h('span', { class: 'edu-muted' }, `上次复习：${formatStudyTime(candidate.lastReviewedAt)}`) : null,
      ),
    );
  }

  private renderFeedback(): void {
    const container = this.feedbackContainer;
    if (container === null) return;
    clear(container);
    const root = h('div', { class: 'edu-study-feedback', 'data-testid': 'study-feedback', tabindex: -1 });
    this.feedbackRoot = root;
    if (this.loading) {
      root.append(loadingState({ title: '反馈会在这里显示' }));
    } else if (this.finishReceipt !== null) {
      root.append(this.finishSummary());
    } else if (this.feedback !== null) {
      this.feedbackController?.unmount();
      const feedbackHost = h('div', { 'data-testid': 'study-feedback-grade' });
      root.append(feedbackHost);
      this.feedbackController = mountFeedbackView(feedbackHost, {
        grade: this.feedback,
        sourceLabel: (sourceRefId) => {
          const source = this.workspace?.sources.find((entry) => entry.sourceRefId === sourceRefId);
          return source === undefined ? `出处 ${sourceRefId}` : source.printedPage === null ? `来源 · PDF 第 ${source.pdfPage} 页` : `来源 · 课本第 ${source.printedPage} 页`;
        },
        onOpenSource: (sourceRefId) => this.openSourceById(sourceRefId),
        onClarificationAction: (action) => {
          this.chatNotice = `已记录澄清动作：${action}；不会因此判错。`;
          this.notify();
        },
        candidateOnly: true,
      });
      root.append(this.axisSection());
      root.append(this.selfReportSection());
      root.append(
        h('div', { class: 'edu-inline-actions' },
          button('改文字再试', () => this.editAnswer(), { small: true, dataAction: 'edit-answer' }),
          button('结束本轮', () => void this.finishRound(), { small: true, tone: 'primary', dataAction: 'finish-round' }),
        ),
      );
    } else {
      root.append(
        h('p', { class: 'edu-muted' }, '提交作答后，这里会显示逐条要点、待确认项、出处、评分版本与证据候选；不会显示掌握百分比。'),
        this.axisSection(),
        this.selfReportSection(),
      );
    }
    if (this.chatNotice.length > 0) root.append(h('p', { class: 'edu-muted', role: 'status' }, this.chatNotice));
    container.append(root);
  }

  private finishSummary(): HTMLElement {
    const summary = this.summary();
    const receipt = this.finishReceipt;
    const root = h('div', { class: 'edu-study-finish', 'data-testid': 'study-finish' },
      h('h3', { class: 'edu-card__title' }, this.finishLabel || '本轮结果'),
      h('p', { class: 'edu-study-status' }, summary.review),
      h('div', { class: 'edu-inline-actions' }, ...this.axisChips(summary)),
    );
    if (receipt !== null) {
      root.append(
        h('p', { class: 'edu-muted' }, `复习安排：${formatStudyTime(receipt.dueAt)} · 策略 ${receipt.policyVersion}${receipt.early ? ' · 提前复习' : ''}`),
      );
    }
    root.append(
      h('p', { class: 'edu-muted' }, '活动结束与理解判断分开记录；结束本轮不会自动把理解升级为“表现稳定”。'),
      h('div', { class: 'edu-inline-actions' },
        button('返回地图', () => this.navigate?.('/map'), { small: true, tone: 'primary' }),
        button('查看记录', () => this.navigate?.('/records'), { small: true }),
      ),
    );
    return root;
  }

  private summary(): StateSummary {
    const workspace = this.workspace;
    if (workspace === null) {
      return { learning: '尚未开始', understanding: '尚无足够证据', review: '尚未复习', due: '暂无复习安排', selfReport: '未填写' };
    }
    const payload = this.mapPayload();
    const summary = summarizeConceptState(payload, workspace.concept.id);
    return {
      learning: summary.learning.label,
      understanding: summary.understanding.label,
      review: summary.review.historyLabel,
      due: summary.review.dueLabel,
      selfReport: summary.selfReportLabel ?? '未填写（可选）',
    };
  }

  private mapPayload(): MapPayload {
    const workspace = this.workspace;
    if (workspace === null) {
      throw new Error('workspace is not loaded');
    }
    return {
      courseEditionId: workspace.courseEditionId,
      courseEditionLabel: workspace.courseEditionLabel,
      packId: workspace.packId,
      packVersion: workspace.packVersion,
      trustMode: workspace.trustMode,
      scope: workspace.scope,
      coverageStatus: workspace.coverageStatus,
      toc: [],
      concepts: [workspace.concept],
      relations: [],
      progress: this.progress === null ? [] : [this.progress],
      selfReports: this.selfReport === null ? [] : [this.selfReport],
      evidence: [],
      sources: [],
      initialTocNodeId: null,
      initialConceptId: workspace.concept.id,
      fixture: workspace.fixture,
      notice: workspace.notice,
    };
  }

  private axisChips(summary: StateSummary): HTMLElement[] {
    return [
      statusChip(`学习进程：${summary.learning}`, 'neutral'),
      statusChip(`理解证据：${summary.understanding}`, summary.understanding.includes('需巩固') ? 'attention' : summary.understanding.includes('表现稳定') ? 'positive' : 'neutral'),
      statusChip(`复习：${summary.review}`, summary.review.includes('仍需巩固') ? 'attention' : 'neutral'),
      statusChip(`待复习：${summary.due}`, summary.due === '待复习' ? 'attention' : 'neutral'),
    ];
  }

  private axisSection(): HTMLElement {
    const summary = this.summary();
    return h('section', { class: 'edu-study-axis', 'data-testid': 'study-axis-summary' },
      h('h3', { class: 'edu-card__title' }, '三轴状态（与记录页一致）'),
      h('div', { class: 'edu-inline-actions' }, ...this.axisChips(summary)),
      h('p', { class: 'edu-muted' }, `自评（学生自述）：${summary.selfReport}。自评独立保存，不替代系统证据。`),
    );
  }

  private selfReportSection(): HTMLElement {
    const section = h('section', { class: 'edu-study-self-report', 'data-testid': 'study-self-report' },
      h('h3', { class: 'edu-card__title' }, '自评（可选）'),
      h('p', { class: 'edu-muted' }, '这是你的感受，单独保存；不会改变系统判断，也不会覆盖证据。'),
    );
    for (const [state, label] of [['uncertain', '不确定'], ['basically_understood', '基本会'], ['can_explain', '能解释']] as const) {
      section.append(button(label, () => void this.saveSelfReport(state), { small: true, dataAction: `self-report-${state}` }));
    }
    if (this.selfReport !== null) {
      section.append(h('p', { class: 'edu-muted' }, `已保存自评：${this.selfReport.claimedState === 'can_explain' ? '能解释' : this.selfReport.claimedState === 'basically_understood' ? '基本会' : '不确定'} · ${formatStudyTime(this.selfReport.createdAt)}`));
    }
    return section;
  }

  private openSource(source: StudySource, trigger: HTMLElement | null): void {
    const parent = this.materialContainer ?? this.activityContainer;
    if (parent === null) return;
    openSourcePopover(parent, trigger ?? parent, this.workspace?.sources ?? [], source.sourceRefId);
  }

  private openSourceById(sourceRefId: string): void {
    const source = this.workspace?.sources.find((entry) => entry.sourceRefId === sourceRefId);
    if (source === undefined) {
      this.chatNotice = '这条出处暂时不可用；没有跳转到任何页面。';
      this.notify();
      return;
    }
    this.openSource(source, null);
  }
}

function hasAnswer(value: AnswerFormValue): boolean {
  if (value.kind === 'text') return value.text.trim().length > 0;
  if (value.kind === 'choice') return value.optionIds.length > 0;
  return value.pairs.length > 0;
}

function assistant(text: string, disclosure = false): ChatMessage {
  return { role: 'assistant', text, disclosure };
}

function system(text: string): ChatMessage {
  return { role: 'system', text, disclosure: false };
}
