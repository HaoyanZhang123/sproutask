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
  renderErrorBanner,
  statusChip,
} from '../../shell/src/index.js';
import {
  mountAnswerForm,
  supportsAnswerForm,
  type AnswerFormController,
  type AnswerFormValue,
  type FeedbackViewController,
} from '../../visuals/src/index.js';
import {
  LEARNING_LABELS,
  REVIEW_OUTCOME_LABELS,
  SELF_REPORT_LABELS,
  UNDERSTANDING_LABELS,
  VALIDITY_LABELS,
  type EducationPageContext,
} from '../../shell/src/index.js';
import { ActivityStateMachine } from './machine.js';
import { openSourcePopover } from './source-view.js';
import {
  ACTIVITY_TYPE_LABELS,
  CRITERION_LABELS,
  DRAFT_SAVED,
  DRAFT_UNSAVED,
  HELP_ACTIONS,
  LOW_DIFFICULTY_NOTE,
  REVIEW_REASON_LABELS,
  VERDICT_LABELS,
  answerInputType,
  decisionNotice,
  encodeAnswer,
  formatStudyTime,
} from './labels.js';
import { chevronIcon } from './icons.js';
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

/** 学习台顶部两条带子：标题/保存/结束本轮，以及「第几题 / 共几题」。 */
export interface StudyChromeElements {
  readonly top: HTMLElement;
  readonly ribbon: HTMLElement;
  /** 窄屏课本抽屉条上的「课本原文 · 课本第 N 页」。 */
  readonly materialSummary: HTMLElement;
}

/**
 * 模型输出常带轻量 Markdown（`**加粗**`、短列表、`#` 标题）。聊天气泡直接
 * 当纯文本显示会露出星号、挤成一坨。这里做最小、安全的渲染：段落、加粗、
 * 列表；其余一律按纯文本，绝不解析 HTML。
 */
function richText(text: string): DocumentFragment {
  const fragment = document.createDocumentFragment();
  let list: HTMLUListElement | null = null;

  const appendInline = (target: HTMLElement, raw: string): void => {
    const line = raw.replace(/^#{1,6}\s*/, '').trim();
    if (line.length === 0) return;
    for (const part of line.split(/(\*\*[^*]+\*\*)/g)) {
      if (part.length === 0) continue;
      if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
        const strong = document.createElement('strong');
        strong.textContent = part.slice(2, -2);
        target.append(strong);
        continue;
      }
      target.append(document.createTextNode(part.replace(/\*\*/g, '')));
    }
  };

  for (const rawLine of text.replace(/\r\n/g, '\n').split('\n')) {
    const line = rawLine.trim();
    if (line.length === 0) {
      if (list !== null) {
        fragment.append(list);
        list = null;
      }
      continue;
    }
    const bullet = /^(?:[-*•]|\d+[.、])\s+/.test(line);
    if (bullet) {
      if (list === null) list = document.createElement('ul');
      const item = document.createElement('li');
      appendInline(item, line.replace(/^(?:[-*•]|\d+[.、])\s+/, ''));
      list.append(item);
      continue;
    }
    if (list !== null) {
      fragment.append(list);
      list = null;
    }
    const paragraph = document.createElement('p');
    appendInline(paragraph, line);
    fragment.append(paragraph);
  }
  if (list !== null) fragment.append(list);
  return fragment;
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
  private chrome: StudyChromeElements | null = null;
  private chromeTitle: HTMLElement | null = null;
  private chromeMode: HTMLElement | null = null;
  private chromeFinish: HTMLButtonElement | null = null;
  private ribbonBars: HTMLElement | null = null;
  private ribbonCap: HTMLElement | null = null;
  private ribbonBarCount = -1;
  private chatThread: HTMLElement | null = null;
  private chatNoticeHost: HTMLElement | null = null;
  private chatErrorHost: HTMLElement | null = null;
  private chatLowHost: HTMLElement | null = null;
  private chatInputNode: HTMLTextAreaElement | null = null;
  private chatSendNode: HTMLButtonElement | null = null;
  private openChatHook: (() => void) | null = null;
  private openMaterialHook: (() => void) | null = null;

  private intent: Intent = { conceptId: null, mode: 'learn', sessionId: null, activityId: null, fromResume: false };
  private workspace: StudyWorkspace | null = null;
  private session: StartedTutorSession | null = null;
  private tutorState: StudyTurnState | TutorSessionState | null = null;
  private progress: ConceptProgress | null = null;
  private selfReport: SelfReport | null = null;
  private activity: Activity | null = null;
  private answer: AnswerFormValue | null = null;
  /** 提交后用于回显「你写的 / 你选的」；草稿被清空也不丢。 */
  private lastAnswer: AnswerFormValue | null = null;
  private draft: StudyDraft | null = null;
  private draftStatus: DraftStatus = 'none';
  private draftError: ServiceError | null = null;
  private draftToken = 0;
  private loading = true;
  private error: ServiceError | null = null;
  private loadToken = 0;
  private loadedKey = '';
  private waitingNotice = '';
  private conflictRetryTimer: ReturnType<typeof setTimeout> | null = null;
  private conflictRetryCount = 0;
  private activeSessionId: string | null = null;
  private waitingStartedAt = 0;
  private waitingTimer: ReturnType<typeof setInterval> | null = null;
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
    this.clearConflictRetry();
    if (this.waitingTimer !== null) {
      clearInterval(this.waitingTimer);
      this.waitingTimer = null;
    }
    this.waitingStartedAt = 0;
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
    this.chrome = null;
    this.chromeTitle = null;
    this.chromeMode = null;
    this.chromeFinish = null;
    this.ribbonBars = null;
    this.ribbonCap = null;
    this.ribbonBarCount = -1;
    this.chatThread = null;
    this.chatNoticeHost = null;
    this.chatErrorHost = null;
    this.chatLowHost = null;
    this.chatInputNode = null;
    this.chatSendNode = null;
    this.openChatHook = null;
    this.openMaterialHook = null;
  }

  /** 页面骨架把三条带子交给控制器，控制器只填内容。 */
  mountChrome(elements: StudyChromeElements): void {
    this.chrome = elements;
    this.chromeTitle = h('h2', { class: 'edu-study-top__title', 'data-testid': 'study-title' }, '学习');
    this.chromeMode = h('p', { class: 'edu-study-top__mode', 'data-testid': 'study-mode' });
    const save = h('span', {
      class: 'edu-study-save',
      'data-testid': 'study-draft-status',
      'data-state': 'none',
      'aria-live': 'polite',
    });
    this.draftStatusNode = save;
    this.chromeFinish = button('结束本轮', () => void this.finishRound(), {
      small: true,
      tone: 'ghost',
      dataAction: 'finish-round',
    });
    const leave = button('先不学了', () => this.leaveUnfinished(), {
      small: true,
      tone: 'ghost',
      dataAction: 'leave-unfinished',
    });
    elements.top.append(
      h('div', { class: 'edu-study-top__main' }, this.chromeTitle, this.chromeMode),
      h('div', { class: 'edu-study-top__side' }, save, this.chromeFinish, leave),
    );
    this.ribbonBars = h('div', { class: 'edu-study-ribbon__bars', 'aria-hidden': 'true' });
    this.ribbonCap = h('span', { class: 'edu-study-ribbon__cap', 'data-testid': 'study-ribbon-cap' });
    elements.ribbon.append(this.ribbonBars, this.ribbonCap);
    this.renderers.add(() => this.renderChrome());
    this.renderChrome();
  }

  /** 小芽浮层的开合由页面骨架负责，控制器只请求「打开」。 */
  setChatOpener(open: () => void): void {
    this.openChatHook = open;
  }

  /** 「再看看材料」：窄屏开抽屉、宽屏聚焦课本。 */
  setMaterialOpener(open: () => void): void {
    this.openMaterialHook = open;
  }

  mountMaterial(container: HTMLElement): void {
    this.materialContainer = container;
    this.renderers.add(() => this.renderMaterial());
    this.renderMaterial();
  }

  mountChat(container: HTMLElement): void {
    this.chatContainer = container;
    container.replaceChildren();
    const thread = h('ol', { class: 'sprout-thread', 'data-testid': 'sprout-thread', 'aria-live': 'polite' });
    const quick = h('div', { class: 'sprout-quick', 'data-testid': 'study-help-actions' });
    const moreHost = h('div', { class: 'sprout-quick', 'data-testid': 'study-help-more', hidden: true });
    const noticeHost = h('div', { class: 'sprout-sheet__notice', 'data-testid': 'study-help-notice' });
    const errorHost = h('div', { class: 'sprout-sheet__error' });
    const lowHost = h('div', { class: 'sprout-sheet__low', 'data-testid': 'study-low-difficulty' });
    // 三个日常快捷入口直接露出；「分步示范 / 直接看答案」收在「更多帮助」里，
    // 免得第一次用的学生一次面对五个并列按钮。
    for (const action of HELP_ACTIONS.slice(0, 3)) {
      quick.append(
        button(action.label, () => void this.sendHelp(action.kind), {
          small: true,
          dataAction: `help-${action.kind}`,
          title: action.note,
        }),
      );
    }
    const moreButton = button(
      '更多帮助',
      () => {
        const opening = moreHost.hasAttribute('hidden');
        if (opening) moreHost.removeAttribute('hidden');
        else moreHost.setAttribute('hidden', '');
        moreButton.setAttribute('aria-expanded', opening ? 'true' : 'false');
      },
      { small: true, dataAction: 'help-more' },
    );
    moreButton.setAttribute('aria-expanded', 'false');
    quick.append(moreButton);
    for (const action of HELP_ACTIONS.slice(3)) {
      moreHost.append(
        button(action.label, () => void this.sendHelp(action.kind), {
          small: true,
          dataAction: `help-${action.kind}`,
          title: action.note,
        }),
      );
    }
    const input = h('textarea', {
      class: 'edu-input',
      rows: 3,
      placeholder: '问小芽一句，比如“这一步为什么”“给我一点提示”',
      'aria-label': '给小芽发消息',
      'data-testid': 'sprout-input',
      oninput: (event: Event) => {
        this.chatText = (event.currentTarget as HTMLTextAreaElement).value;
      },
    });
    input.value = this.chatText;
    const send = button('发送', () => void this.sendMessage(input.value), {
      small: true,
      tone: 'primary',
      dataAction: 'send-chat',
    });
    send.setAttribute('data-testid', 'sprout-send');
    const compose = h('div', { class: 'sprout-compose' }, input, send);
    container.append(thread, quick, moreHost, noticeHost, errorHost, lowHost, compose);
    this.chatThread = thread;
    this.chatNoticeHost = noticeHost;
    this.chatErrorHost = errorHost;
    this.chatLowHost = lowHost;
    this.chatInputNode = input;
    this.chatSendNode = send;
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
    this.ensureWaitingTimer();
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
    this.lastAnswer = null;
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

  /**
   * 上一轮还在回答时打开/刷新学习台，服务会返回 CONFLICT；这不是错误页，而是
   * "稍等一下就好"。这里自动重试，并把课本/题目区显示成等待状态，而不是整页报错。
   * 最多重试约 36 秒，之后才把真实错误交给错误卡。
   */
  private scheduleIfTurnBusy(error: ServiceError, run: () => void): boolean {
    const busy =
      error.code === 'CONFLICT' && /TURN_IN_PROGRESS|already exists/i.test(error.message);
    if (!busy) return false;
    this.conflictRetryCount += 1;
    if (this.conflictRetryCount > 24) return false;
    if (this.conflictRetryTimer !== null) clearTimeout(this.conflictRetryTimer);
    this.loading = true;
    this.error = null;
    this.waitingNotice = '小芽还在回答上一题，稍等…';
    this.notify();
    this.conflictRetryTimer = setTimeout(() => {
      this.conflictRetryTimer = null;
      run();
    }, 1500);
    return true;
  }

  private clearConflictRetry(): void {
    if (this.conflictRetryTimer !== null) {
      clearTimeout(this.conflictRetryTimer);
      this.conflictRetryTimer = null;
    }
    this.conflictRetryCount = 0;
    this.waitingNotice = '';
  }

  /** 正在加载页面或等小芽回答：用秒数让"卡住"变成可感知的等待。 */
  private isWaitingState(): boolean {
    return this.loading || this.phase === 'submitted' || this.phase === 'grading';
  }

  private ensureWaitingTimer(): void {
    if (this.isWaitingState()) {
      if (this.waitingStartedAt === 0) this.waitingStartedAt = Date.now();
      if (this.waitingTimer === null) {
        this.waitingTimer = setInterval(() => this.tickWaiting(), 1000);
      }
      return;
    }
    if (this.waitingTimer !== null) {
      clearInterval(this.waitingTimer);
      this.waitingTimer = null;
    }
    this.waitingStartedAt = 0;
  }

  /** 只改等待文案里的秒数，不重渲染整页——每秒重渲染会吞掉点击、打断滚动。 */
  private tickWaiting(): void {
    if (!this.isWaitingState()) {
      this.ensureWaitingTimer();
      return;
    }
    const suffix = this.waitSuffix();
    for (const node of document.querySelectorAll<HTMLElement>('[data-wait-base]')) {
      if (!node.isConnected) continue;
      node.textContent = `${node.dataset['waitBase'] ?? ''}${suffix}`;
    }
  }

  private waitingSeconds(): number {
    return this.waitingStartedAt === 0
      ? 0
      : Math.max(0, Math.round((Date.now() - this.waitingStartedAt) / 1000));
  }

  private waitSuffix(): string {
    const seconds = this.waitingSeconds();
    return seconds >= 2 ? `（已等 ${seconds} 秒）` : '';
  }

  private async load(key: string, retrying = false): Promise<void> {
    const token = ++this.loadToken;
    if (!retrying) {
      if (this.conflictRetryTimer !== null) {
        clearTimeout(this.conflictRetryTimer);
        this.conflictRetryTimer = null;
      }
      this.conflictRetryCount = 0;
      this.waitingNotice = '';
    }
    this.loading = true;
    this.error = null;
    this.notify();
    if (this.intent.conceptId === null) {
      if (this.intent.mode === 'review') {
        const range = await this.options.dataSource.loadReviewRange(this.request());
        if (token !== this.loadToken) return;
        this.loading = false;
        if (!range.ok) {
          if (this.scheduleIfTurnBusy(range.error, () => void this.load(key, true))) return;
          this.error = range.error;
        } else {
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
      if (this.scheduleIfTurnBusy(result.error, () => void this.load(key, true))) return;
      this.loading = false;
      this.error = result.error;
      this.loadedKey = key;
      this.notify();
      return;
    }
    this.clearConflictRetry();
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

  private async startSession(retrying = false): Promise<void> {
    if (this.workspace === null) return;
    if (!retrying) {
      if (this.conflictRetryTimer !== null) {
        clearTimeout(this.conflictRetryTimer);
        this.conflictRetryTimer = null;
      }
      this.conflictRetryCount = 0;
      this.waitingNotice = '';
    }
    const result = await this.options.dataSource.startSession(this.request(), {
      conceptId: this.workspace.concept.id,
      mode: this.intent.mode,
      sessionId: this.intent.sessionId ?? this.activeSessionId ?? undefined,
      activityId: this.workspace.activity.id,
    });
    if (!result.ok) {
      if (this.scheduleIfTurnBusy(result.error, () => void this.startSession(true))) return;
      this.error = result.error;
      this.notify();
      return;
    }
    this.clearConflictRetry();
    this.session = result.data;
    // 记住这把学习用的是哪条会话：换题/重进时继续用它，而不是每次新开一条。
    this.activeSessionId = result.data.session.id;
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
          : '先读材料，再自己回答。',
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
    this.lastAnswer = this.answer ?? this.lastAnswer;
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

  /**
   * 「先跳过」= 放过这一题、直接做下一题，不是结束本轮。
   *
   * 旧实现调了 tutor skip——那会把整条 session 标成 abandoned（等于放弃本轮），
   * 于是每跳一题就多一条 session，学习记录被拆成碎片。结束本轮/先不学了另有入口。
   */
  async skip(): Promise<void> {
    if (this.session === null) return;
    this.skipNotice = '这道先放过，不记为答对也不记为答错。';
    this.messages = [...this.messages, system(this.skipNotice)];
    if (this.nextActivityId() !== null) {
      await this.nextQuestion();
      return;
    }
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
    // 交卷后草稿本来就清空了：不要还挂着「草稿已保存」让人误会。
    this.draftStatus = 'none';
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

  private renderChrome(): void {
    const chrome = this.chrome;
    if (chrome === null) return;
    const workspace = this.workspace;
    if (this.chromeTitle !== null) {
      this.chromeTitle.textContent = workspace === null ? '学习' : workspace.concept.title;
    }
    if (this.chromeMode !== null) {
      this.chromeMode.textContent = this.intent.mode === 'review' ? '复习' : '学习';
    }
    if (this.draftStatusNode !== null) {
      const text =
        this.draftStatus === 'saved'
          ? DRAFT_SAVED
          : this.draftStatus === 'saving'
            ? '正在保存…'
            : this.draftStatus === 'failed'
              ? DRAFT_UNSAVED
              : '';
      this.draftStatusNode.textContent = text;
      this.draftStatusNode.dataset['state'] = this.draftStatus;
    }
    if (this.chromeFinish !== null) {
      this.chromeFinish.disabled = this.session === null || this.finishReceipt !== null;
    }
    const sources = workspace === null ? [] : uniqueSources(workspace.sources);
    const firstSource = sources[0];
    chrome.materialSummary.textContent =
      workspace === null
        ? '课本原文'
        : firstSource !== undefined && firstSource.printedPage !== null
          ? `课本原文 · 课本第 ${firstSource.printedPage} 页`
          : '课本原文';

    // 进度条：一道题一段，已答过/正在答/还没答靠形状 + 文字说明，不只靠颜色。
    const activities = workspace?.activities ?? [];
    const index = workspace === null ? -1 : activities.findIndex((entry) => entry.id === workspace.activity.id);
    if (this.ribbonBars !== null) {
      if (this.ribbonBarCount !== activities.length) {
        this.ribbonBars.replaceChildren();
        for (let bar = 0; bar < activities.length; bar += 1) {
          this.ribbonBars.append(h('span', { class: 'edu-study-ribbon__bar', 'data-state': 'todo' }));
        }
        this.ribbonBarCount = activities.length;
      }
      const bars = [...this.ribbonBars.children];
      bars.forEach((bar, barIndex) => {
        if (!(bar instanceof HTMLElement)) return;
        bar.dataset['state'] = barIndex < index ? 'done' : barIndex === index ? 'now' : 'todo';
      });
    }
    if (this.ribbonCap !== null) {
      if (this.finishReceipt !== null) this.ribbonCap.textContent = '本轮结束，下一轮接着来';
      else if (activities.length === 0) this.ribbonCap.textContent = '';
      else if (index >= 0) this.ribbonCap.textContent = `第 ${index + 1} 题，共 ${activities.length} 题`;
      else this.ribbonCap.textContent = `共 ${activities.length} 题`;
    }
  }

  private renderMaterial(): void {
    const container = this.materialContainer;
    if (container === null) return;
    clear(container);
    if (this.loading) {
      const base = this.waitingNotice.length > 0 ? this.waitingNotice : '正在打开这一节的课本…';
      const state = loadingState({ title: `${base}${this.waitSuffix()}` });
      const title = state.querySelector<HTMLElement>('.edu-state__title');
      if (title !== null) title.dataset['waitBase'] = base;
      container.append(state);
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
    if (this.workspace === null && this.reviewRange !== null) {
      container.append(
        h(
          'div',
          { class: 'edu-study-material' },
          h('div', { class: 'edu-study-kicker' }, h('h3', {}, '复习')),
          h('p', { class: 'edu-study-page-text' }, '先从右边挑一个要复习的范围；选好后这一页会换成对应课本。'),
        ),
      );
      return;
    }
    if (this.workspace === null) {
      container.append(
        emptyState({
          title: '还没有选好这一节',
          body: '从地图选一个概念，或者在首页接着上次。',
          actions: [
            { label: '去地图', onClick: () => this.navigate?.('/map'), tone: 'primary' },
            { label: '返回首页', onClick: () => this.navigate?.('/home') },
          ],
        }),
      );
      return;
    }
    const workspace = this.workspace;
    const doc = container.ownerDocument;
    const sources = uniqueSources(workspace.sources);
    const pageLabel =
      sources.length > 0 && sources[0] !== undefined && sources[0].printedPage !== null
        ? `课本第 ${sources[0].printedPage} 页`
        : null;
    container.append(
      h(
        'div',
        { class: 'edu-study-material', 'data-testid': 'study-material' },
        h(
          'div',
          { class: 'edu-study-kicker' },
          h('h3', {}, '课本原文'),
          pageLabel === null
            ? statusChip('页脚页码待核实', 'attention')
            : h('span', { class: 'edu-chip', 'data-tone': 'neutral' }, pageLabel),
        ),
        h('p', { class: 'edu-study-page-text' }, workspace.concept.explanation),
        workspace.concept.learningObjectives.length > 0
          ? h(
              'div',
              {},
              h('h4', { class: 'edu-study-subtitle' }, '学习目标'),
              h(
                'ul',
                { class: 'edu-study-list' },
                ...workspace.concept.learningObjectives.map((objective) => h('li', {}, objective)),
              ),
            )
          : null,
        workspace.concept.misconceptions.length > 0
          ? h(
              'details',
              { class: 'edu-study-fold', open: true, 'data-testid': 'study-misconceptions' },
              h(
                'summary',
                {},
                h('span', { class: 'edu-study-fold__chev' }, chevronIcon(doc)),
                '容易混淆',
              ),
              h(
                'div',
                { class: 'edu-study-fold__body' },
                ...workspace.concept.misconceptions.map((entry) =>
                  h('p', {}, `${entry.statement} → ${entry.correction}`),
                ),
              ),
            )
          : null,
        sources.length > 0
          ? h(
              'details',
              { class: 'edu-study-fold', 'data-testid': 'study-sources' },
              h(
                'summary',
                {},
                h('span', { class: 'edu-study-fold__chev' }, chevronIcon(doc)),
                '这一页的出处',
              ),
              h(
                'div',
                { class: 'edu-study-fold__body edu-study-source-row' },
                ...sources.map((source) => {
                  const trigger = h(
                    'button',
                    {
                      type: 'button',
                      class: 'edu-study-source-chip',
                      'data-action': 'study-source',
                      onclick: () => this.openSource(source, trigger),
                    },
                    sourceLabel(source),
                  );
                  return trigger;
                }),
              ),
            )
          : null,
        pageLabel !== null && sources[0] !== undefined
          ? h('span', { class: 'edu-study-page-num' }, `— ${sources[0].printedPage} —`)
          : null,
        workspace.compatibility !== null
          ? notice({
              tone: 'warning',
              title: '内容版本不兼容',
              body: `上次用的版本是 ${workspace.compatibility.previousPackVersion}，现在是 ${workspace.compatibility.currentPackVersion}。${workspace.compatibility.reason} 旧记录仍可查看，不会悄悄迁移。`,
              actions: [
                { label: '查看旧记录', onClick: () => this.navigate?.('/records') },
                { label: '去教材库', onClick: () => this.navigate?.('/library') },
              ],
            })
          : null,
        workspace.notice !== null
          ? h('p', { class: 'edu-study-muted', 'data-testid': 'study-fixture-notice' }, workspace.notice)
          : null,
      ),
    );
  }

  private renderChat(): void {
    const thread = this.chatThread;
    if (thread === null) return;
    thread.replaceChildren(...this.messages.map((message) => this.messageBubble(message)));
    if (this.messages.length === 0) {
      thread.append(
        h(
          'li',
          { class: 'sprout-msg', 'data-role': 'assistant' },
          h('span', { class: 'sprout-msg__who' }, '小芽'),
          h('p', {}, '我是小芽。课本哪句没看懂、题目怎么想，都可以直接问我。'),
        ),
      );
    }
    if (this.chatNoticeHost !== null) {
      this.chatNoticeHost.replaceChildren();
      if (this.helpNotice.length > 0) {
        this.chatNoticeHost.append(
          h('p', { class: 'edu-study-note sprout-sheet__note', role: 'status' }, this.helpNotice),
        );
      }
    }
    if (this.chatErrorHost !== null) {
      this.chatErrorHost.replaceChildren();
      if (this.chatError !== null) {
        this.chatErrorHost.append(
          renderErrorBanner(this.chatError, {
            onRetry: () => void this.sendMessage('请再试一次。'),
            backLabel: '先继续读',
            onBack: () => undefined,
          }),
        );
      }
    }
    if (this.chatLowHost !== null) {
      this.chatLowHost.replaceChildren();
      if (this.tutorState !== null && this.tutorState.consecutiveFailures >= 2) {
        this.chatLowHost.append(
          h('p', { class: 'edu-study-note' }, LOW_DIFFICULTY_NOTE),
          button('换一种讲法', () => void this.lowerDifficulty(), {
            small: true,
            dataAction: 'lower-difficulty',
          }),
        );
      }
    }
    if (this.chatSendNode !== null) this.chatSendNode.disabled = this.session === null;
    if (this.chatInputNode !== null && this.chatInputNode.value !== this.chatText) {
      this.chatInputNode.value = this.chatText;
    }
  }

  private messageBubble(message: ChatMessage): HTMLElement {
    return h(
      'li',
      { class: 'sprout-msg', 'data-role': message.role },
      h(
        'span',
        { class: 'sprout-msg__who' },
        message.role === 'student' ? '你' : message.role === 'assistant' ? '小芽' : '提示',
      ),
      h('div', { class: 'sprout-msg__text' }, richText(message.text)),
      message.disclosure ? statusChip('这次看过完整答案', 'attention') : null,
    );
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
      const base = this.waitingNotice.length > 0 ? this.waitingNotice : '正在准备这一题…';
      const state = loadingState({ title: `${base}${this.waitSuffix()}` });
      const title = state.querySelector<HTMLElement>('.edu-state__title');
      if (title !== null) title.dataset['waitBase'] = base;
      container.append(state);
      return;
    }
    if (this.error !== null) {
      clear(container);
      container.append(
        renderErrorBanner(this.error, {
          onRetry: () => void this.load(this.loadedKey),
          backLabel: '返回地图',
          onBack: () => this.navigate?.('/map'),
        }),
      );
      return;
    }
    if (this.workspace === null || this.activity === null) {
      clear(container);
      container.append(
        emptyState({
          title: '还没有打开题目',
          body: '从地图选一个概念，再进入学习或复习。',
          testId: 'study-empty',
          actions: [{ label: '去地图', onClick: () => this.navigate?.('/map'), tone: 'primary' }],
        }),
      );
      return;
    }
    // 草稿自动保存会触发重绘；此时不要重建表单，否则光标会丢。
    if (this.form !== null && this.phase === 'draft' && this.formActivityId === this.activity.id) {
      return;
    }
    clear(container);
    const root = h('div', { class: 'edu-study-activity', 'data-testid': 'study-activity' });
    root.append(this.questionHead(), this.stemBlock());
    if (this.lateNotice.length > 0) {
      root.append(h('p', { class: 'edu-notice edu-notice--warning', role: 'status' }, this.lateNotice));
    }
    if (this.failureNotice.length > 0) {
      root.append(h('p', { class: 'edu-notice edu-notice--warning', role: 'status' }, this.failureNotice));
    }
    if (this.skipNotice.length > 0) {
      root.append(h('p', { class: 'edu-notice edu-notice--info', role: 'status' }, this.skipNotice));
    }
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
        h(
          'div',
          { class: 'edu-study-slot-actions' },
          button('重试批改', () => void this.retry(), {
            small: true,
            tone: 'primary',
            dataAction: 'retry-grading',
          }),
          button('改文字', () => this.editAnswer(), { small: true, dataAction: 'edit-answer' }),
        ),
      );
    }
    if (this.imageMode) {
      this.renderImageAnswer(root);
      container.append(root);
      return;
    }
    if (this.finishReceipt !== null) {
      root.append(h('p', { class: 'edu-study-note' }, '这一轮已经结束；结果和下一步在下面。'));
      container.append(root);
      return;
    }
    if (this.phase === 'submitted' || this.phase === 'grading') {
      const seconds = this.waitingSeconds();
      const pendingBase = this.phase === 'submitted' ? '原答已提交，正在保存…' : '小芽正在回答…';
      root.append(
        h(
          'div',
          { class: 'edu-study-pending', role: 'status' },
          h('p', { 'data-wait-base': pendingBase }, `${pendingBase}${this.waitSuffix()}`),
          h(
            'p',
            { class: 'edu-study-note' },
            seconds >= 20
              ? '比平时久一点，可以继续等；网络慢时也会这样。原答和草稿已经保存。'
              : '反馈完成前不会显示为已掌握；可以取消，原答和草稿会保留。',
          ),
        ),
        button('取消本次反馈', () => this.cancelTurn(), {
          small: true,
          tone: 'danger-ghost',
          dataAction: 'cancel-turn',
        }),
      );
      container.append(root);
      return;
    }
    if (this.phase === 'feedback') {
      root.append(this.answerEcho());
      container.append(root);
      return;
    }
    this.renderForm(root);
    container.append(root);
  }

  private questionHead(): HTMLElement {
    const parts: HTMLElement[] = [];
    const number = this.questionNumber();
    if (number !== null) {
      parts.push(h('span', {}, number));
      parts.push(h('span', { class: 'edu-study-q-head__dot', 'aria-hidden': 'true' }, '·'));
    }
    parts.push(h('span', {}, ACTIVITY_TYPE_LABELS[this.activity?.type ?? ''] ?? '这一题'));
    const phaseNote =
      this.phase === 'feedback'
        ? '已作答'
        : this.phase === 'failed'
          ? '提交没有完成'
          : this.phase === 'submitted' || this.phase === 'grading'
            ? '正在批改'
            : null;
    if (phaseNote !== null) {
      parts.push(h('span', { class: 'edu-study-q-head__dot', 'aria-hidden': 'true' }, '·'));
      parts.push(h('span', {}, phaseNote));
    }
    return h('p', { class: 'edu-study-q-head' }, ...parts);
  }

  private stemBlock(): HTMLElement {
    return h('h3', { class: 'edu-study-stem', 'data-testid': 'study-stem' }, this.activity?.stem ?? '');
  }

  private questionNumber(): string | null {
    const workspace = this.workspace;
    if (workspace === null) return null;
    const index = workspace.activities.findIndex((entry) => entry.id === workspace.activity.id);
    return index >= 0 ? `第 ${index + 1} 题` : null;
  }

  private renderForm(root: HTMLElement): void {
    if (this.activity === null) return;
    this.form?.unmount();
    this.form = null;
    const body = h('div', { class: 'edu-study-answer-body' });
    let submitButton: HTMLButtonElement | null = null;
    if (!supportsAnswerForm(this.activity)) {
      body.append(
        h(
          'p',
          { class: 'edu-notice edu-notice--info' },
          '这是图示标注题；图示打不开时，可以用文字把位置和名称写清楚。',
        ),
      );
    } else {
      const form = mountAnswerForm(body, {
        activity: this.activity,
        // 草稿在交卷后清空；「改文字再试」仍回到上次写的内容，不用从空白开始。
        initial: this.answer ?? this.lastAnswer,
        onSubmit: (value) => void this.submit(value),
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
        // 表单自带的「提交作答」搬到题目页底栏，和「需要一点提示 / 先跳过」同一行。
        const actions = form.element.querySelector<HTMLElement>('.edu-visual-actions');
        submitButton = actions?.querySelector<HTMLButtonElement>('.edu-button--primary') ?? null;
        actions?.remove();
      }
    }
    const foot = h('div', { class: 'edu-study-work-foot' });
    foot.append(
      h(
        'button',
        {
          type: 'button',
          class: 'edu-study-hint-link',
          'data-action': 'hint',
          onclick: () => this.requestHint(),
        },
        '需要一点提示',
      ),
    );
    const right = h('div', { class: 'edu-study-work-foot__right' });
    if (this.workspace !== null && this.workspace.imageFlow !== null) {
      right.append(
        button('改用图片作答', () => this.startImageMode(), {
          small: true,
          dataAction: 'image-answer',
        }),
      );
    }
    right.append(button('先跳过', () => void this.skip(), { small: true, dataAction: 'skip-question' }));
    if (submitButton !== null) {
      const submit = submitButton;
      submit.setAttribute('data-action', 'submit-answer');
      right.append(submit);
    }
    foot.append(right);
    root.append(body, foot);
  }

  private answerEcho(): HTMLElement {
    const wrap = h('div', { class: 'edu-study-answer', 'data-testid': 'study-answer-echo' });
    const answer = this.answer ?? this.lastAnswer;
    const activity = this.activity;
    if (answer === null || activity === null) {
      wrap.append(h('span', { class: 'edu-study-answer__label' }, '你的作答'), '已提交');
      return wrap;
    }
    if (answer.kind === 'choice') {
      const schema = activity.answerSchema;
      const labels =
        schema.kind === 'choice'
          ? schema.options
              .filter((option) => answer.optionIds.includes(option.id))
              .map((option) => option.label)
          : [];
      wrap.append(
        h('span', { class: 'edu-study-answer__label' }, '你选的'),
        h('span', {}, labels.length > 0 ? labels.join('、') : '还没有选择'),
      );
      return wrap;
    }
    if (answer.kind === 'text') {
      wrap.append(
        h('span', { class: 'edu-study-answer__label' }, '你写的'),
        h('span', {}, answer.text.trim().length > 0 ? answer.text : '（没有写下内容）'),
      );
      return wrap;
    }
    wrap.append(
      h('span', { class: 'edu-study-answer__label' }, '你的作答'),
      h('span', {}, `已提交 ${answer.pairs.length} 条关系`),
    );
    return wrap;
  }

  /**
   * 图片作答入口。选文件、本机预览、确认发送是三步：选文件本身从不上传。
   */
  private renderImageAnswer(root: HTMLElement): void {
    if (this.activity === null) return;
    root.append(
      h(
        'p',
        { class: 'edu-study-note' },
        '拍照或选择图片（PNG / JPEG，不超过 5 MB）。选图不等于发送：先在本机预览，再确认发送给模型识别。',
      ),
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
        root.append(h('p', { class: 'edu-visual-preview-placeholder' }, '图片预览只在这台电脑上显示。'));
      }
    } else if (!this.imageBusy) {
      root.append(h('p', { class: 'edu-study-note' }, '还没有选择图片。选好并预览后，再确认发送。'));
    }
    const actions = h('div', { class: 'edu-study-slot-actions' });
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
    actions.append(
      send,
      button('取消本次作答', () => this.stopImageMode(), { small: true, dataAction: 'image-cancel' }),
    );
    root.append(actions);
    root.append(
      h(
        'p',
        { class: 'edu-study-cloud-note' },
        '发送说明：图片会通过模型服务识别，用来给出反馈；不会上传整本教材或其他学习记录。发送前可以随时取消。',
      ),
    );
    if (this.imageNotice.length > 0) {
      root.append(
        h('p', { class: 'edu-study-status', role: 'status', 'data-testid': 'image-notice' }, this.imageNotice),
      );
    }
    if (this.imageFileError.length > 0) {
      root.append(
        h(
          'p',
          { class: 'edu-danger-text', role: 'alert', 'data-testid': 'image-file-error' },
          this.imageFileError,
        ),
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
  }

  /**
   * 图片本身的补充说明；判读结论统一交给原地反馈区，避免同一句话出现两次。
   * 这里只留图片质量/记录状态这类图片特有的信息。
   */
  private imageResultSection(): HTMLElement {
    const info = this.imageResult;
    const grade = this.feedback;
    const section = h('div', { class: 'edu-study-image-result', 'data-testid': 'image-result' });
    const clarification = info?.stage === 'clarification_required' || grade?.requiresClarification === true;
    if (clarification) {
      section.append(
        h('h3', { class: 'edu-study-subtitle' }, '这张图片还不能判读'),
        h(
          'p',
          { class: 'edu-notice edu-notice--warning', role: 'status' },
          studentCopy(
            info?.clarification?.message ??
              '图片质量或识别结果不足以形成判断；系统不会因此判你答错。',
          ),
        ),
      );
      const reasons = [...(info?.qualitySignal?.reasons ?? []), ...(info?.clarification?.reasons ?? [])].filter(
        (reason, index, all) => reason.length > 0 && all.indexOf(reason) === index,
      );
      if (reasons.length > 0) {
        section.append(
          h(
            'ul',
            { class: 'edu-study-list' },
            ...reasons.map((reason) => h('li', {}, studentCopy(reason))),
          ),
        );
      }
      section.append(
        h(
          'p',
          { class: 'edu-study-note' },
          '这次只记为待澄清，不会写入成绩；可以重拍、重新选择，或改用文字作答。',
        ),
      );
    } else if (info !== null) {
      section.append(h('h3', { class: 'edu-study-subtitle' }, '图片已保存'));
      const persistence = info.persistence;
      if (persistence?.duplicate === true) {
        section.append(h('p', { class: 'edu-study-note' }, '同一张图片此前已经交过；这次没有重复记录，也没有再次调用模型。'));
      } else if (persistence?.assessmentCommitted === false) {
        section.append(h('p', { class: 'edu-study-note' }, '原答与记录已保存；理解判断还需要更多证据，没有升级为「已掌握」。'));
      } else {
        section.append(h('p', { class: 'edu-study-note' }, '图片已经保存；判读结果在下面。'));
      }
    } else {
      section.append(
        h('p', { class: 'edu-study-note', role: 'status' }, this.imageNotice || '这次图片没有形成可显示的结果。'),
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
        { class: 'edu-study-slot-actions' },
        button('重新上传', () => this.retakeImage(), { small: true, dataAction: 'image-retake-result' }),
        button('改用文字作答', () => this.stopImageMode(), { small: true, dataAction: 'image-text-fallback' }),
      ),
    );
    return section;
  }

  private renderReviewRange(container: HTMLElement): void {
    clear(container);
    const range = this.reviewRange;
    const root = h('div', { class: 'edu-study-activity', 'data-testid': 'study-review-range' });
    root.append(
      h('p', { class: 'edu-study-q-head' }, h('span', {}, '复习范围')),
      h('p', { class: 'edu-study-note' }, '先看推荐的范围和理由；可以调整、跳过推荐，或暂缓一次。开始后先回忆，再给反馈。'),
    );
    if (range === null || range.candidates.length === 0) {
      root.append(
        emptyState({
          title: '当前没有待复习项目',
          body: '仍可自选范围，或回到地图选择概念。',
          actions: [{ label: '去地图自选', onClick: () => this.navigate?.('/map'), tone: 'primary' }],
        }),
      );
      container.append(root);
      return;
    }
    const list = h('ul', { class: 'edu-study-review-list' });
    for (const candidate of range.candidates) {
      list.append(this.reviewCandidateRow(candidate));
    }
    root.append(list, h('p', { class: 'edu-study-note' }, range.note));
    if (this.reviewNotice.length > 0) {
      root.append(h('p', { class: 'edu-study-note', role: 'status' }, this.reviewNotice));
    }
    if (this.reviewSkipped) {
      root.append(h('p', { class: 'edu-study-note' }, '已跳过推荐；仍可从下面的范围自选。'));
    }
    root.append(
      h(
        'div',
        { class: 'edu-study-result__actions' },
        button(
          '开始复习',
          () => {
            const chosen = [...this.reviewSelected][0] ?? range.candidates[0]?.conceptId ?? null;
            if (chosen !== null) void this.startReview(chosen);
          },
          { tone: 'primary', dataAction: 'start-review' },
        ),
        button('跳过推荐', () => this.skipReviewRange(), { small: true, dataAction: 'skip-review-range' }),
        button('暂缓一次', () => void this.deferReview(), { small: true, dataAction: 'defer-review' }),
        button('返回地图', () => this.navigate?.('/map'), { small: true, dataAction: 'back-to-map' }),
      ),
    );
    container.append(root);
  }

  private reviewCandidateRow(candidate: StudyReviewCandidate): HTMLElement {
    const input = h('input', {
      type: 'checkbox',
      id: `review-${candidate.conceptId}`,
      checked: this.reviewSelected.has(candidate.conceptId),
      onchange: (event: Event) =>
        this.toggleReview(candidate.conceptId, (event.currentTarget as HTMLInputElement).checked),
    });
    return h(
      'li',
      { class: 'edu-study-review-item' },
      h(
        'label',
        { class: 'edu-study-review-label', for: `review-${candidate.conceptId}` },
        input,
        h('span', { class: 'edu-card__title' }, candidate.title),
        statusChip(
          REVIEW_REASON_LABELS[candidate.reason],
          candidate.reason === 'needs_support' ? 'attention' : 'progress',
        ),
        h(
          'span',
          { class: 'edu-muted' },
          candidate.dueAt === null ? '暂无安排' : `待复习：${formatStudyTime(candidate.dueAt)}`,
        ),
        candidate.lastReviewedAt !== null
          ? h('span', { class: 'edu-muted' }, `上次复习：${formatStudyTime(candidate.lastReviewedAt)}`)
          : null,
      ),
    );
  }

  private renderFeedback(): void {
    const container = this.feedbackContainer;
    if (container === null) return;
    clear(container);
    const root = h('div', { class: 'edu-study-feedback', 'data-testid': 'study-feedback', tabindex: -1 });
    this.feedbackRoot = root;
    if (this.finishReceipt !== null) {
      root.append(this.finishSummary());
    } else if (this.feedback !== null) {
      root.append(this.feedbackResult());
      root.append(this.axisSection(), this.selfReportSection());
    } else if (this.loading) {
      root.append(h('p', { class: 'edu-study-note' }, '答完这一题，结论和依据会出现在这里。'));
    }
    if (this.chatNotice.length > 0) {
      root.append(h('p', { class: 'edu-study-note', role: 'status' }, this.chatNotice));
    }
    container.append(root);
  }

  /**
   * 原地反馈。
   *
   * 标题层级只有「结论 chip + 一句结论」；依据段落只在还有别的信息时出现。
   * 同一句话在整块反馈里最多出现一次（结论 / 依据 / 要点 / 不确定项共用一份
   * 已展示清单），模型的内部字段（答案键、criterion、正确项 id）先翻译成学生话。
   */
  private feedbackResult(): HTMLElement {
    const grade = this.feedback;
    const wrap = h('div', { class: 'edu-study-result', 'data-testid': 'study-feedback-grade' });
    if (grade === null) return wrap;
    const verdict = this.verdict();
    const assisted = this.tutorState?.disclosure === true;
    const shown = new Set<string>([normalizedCopy(verdict.label)]);

    // 「选择正确。」这类只是复述结论的句子不进正文：对错已经由 chip 说了。
    const feedbackSentences = splitSentences(studentCopy(grade.feedback)).filter(
      (sentence) => !isVerdictOnlySentence(sentence),
    );
    let conclusion = feedbackSentences[0] ?? '';
    let rest = feedbackSentences.slice(1);
    if (conclusion.length === 0) {
      conclusion =
        grade.criteria
          .map((criterion) => studentCopy(criterion.rationale).trim())
          .find((rationale) => rationale.length > 0) ?? '';
      rest = feedbackSentences;
    }
    if (conclusion.length > 0) shown.add(normalizedCopy(conclusion));

    const reasons: string[] = [];
    for (const sentence of rest) {
      const key = normalizedCopy(sentence);
      if (key.length === 0 || shown.has(key)) continue;
      shown.add(key);
      reasons.push(sentence);
      if (reasons.length >= 2) break;
    }

    const verdictRow = h('div', { class: 'edu-study-verdict' }, statusChip(verdict.label, verdict.tone));
    verdictRow.append(
      statusChip(assisted ? '这次用过提示' : '自己想的，没用提示', assisted ? 'attention' : 'neutral'),
    );
    if (conclusion.length > 0) {
      verdictRow.append(
        h('p', { class: 'edu-study-verdict__line', 'data-testid': 'study-verdict' }, conclusion),
      );
    }
    wrap.append(verdictRow);
    if (reasons.length > 0) {
      wrap.append(h('p', { class: 'edu-study-why' }, reasons.join('')));
    }

    if (grade.requiresClarification) {
      wrap.append(
        h(
          'div',
          { class: 'edu-study-clarify' },
          h('p', { class: 'edu-study-note' }, '系统不会因为图片不清或信息不足而判你答错。可以这样继续：'),
          this.clarificationActions(),
        ),
      );
    }

    // 出处：只留本轮真的用到、而且能对上页码的页；同一页只出现一次，最多 3 个。
    const pages = this.feedbackSourcePages(grade.sourceRefs);
    if (pages.length > 0) {
      const row = h('div', { class: 'edu-study-result__sources', 'data-testid': 'study-feedback-sources' });
      for (const page of pages) {
        row.append(
          h(
            'button',
            {
              type: 'button',
              class: 'edu-study-source-chip',
              'data-source-ref': page.sourceRefId,
              onclick: (event: Event) =>
                this.openSourceById(page.sourceRefId, event.currentTarget as HTMLElement | null),
            },
            page.label,
          ),
        );
      }
      wrap.append(row);
    }

    const detailRows: string[] = [];
    for (const criterion of grade.criteria) {
      const rationale = studentCopy(criterion.rationale).trim();
      if (rationale.length === 0) continue;
      const key = normalizedCopy(rationale);
      if (shown.has(key)) continue;
      shown.add(key);
      detailRows.push(`${CRITERION_LABELS[criterion.met]}：${rationale}`);
    }
    for (const uncertainty of grade.uncertainties) {
      const item = studentCopy(uncertainty).trim();
      if (item.length === 0) continue;
      const key = normalizedCopy(item);
      if (shown.has(key)) continue;
      shown.add(key);
      detailRows.push(item);
    }
    if (detailRows.length > 0) {
      wrap.append(
        h(
          'details',
          { class: 'edu-study-detail', 'data-testid': 'study-feedback-criteria' },
          h('summary', {}, '这次看的是哪些要点'),
          h('ul', { class: 'edu-study-criteria' }, ...detailRows.map((row) => h('li', {}, row))),
        ),
      );
    }

    const hasNext = this.nextActivityId() !== null;
    const needsAnotherTry = verdict.tone === 'attention';
    const primary = hasNext
      ? button('下一题', () => void this.nextQuestion(), { tone: 'primary', dataAction: 'next-question' })
      : button('再答一次', () => this.editAnswer(), { tone: 'primary', dataAction: 'edit-answer' });
    wrap.append(
      h(
        'div',
        { class: 'edu-study-result__actions' },
        primary,
        button('再看看材料', () => this.showMaterial(), { tone: 'ghost', dataAction: 'review-material' }),
      ),
    );
    // 只有还需要重答时才给「改文字再试」；答对时只留「下一题 / 再看看材料」。
    if (hasNext && needsAnotherTry) {
      wrap.append(
        h(
          'div',
          { class: 'edu-study-result__more' },
          button('改文字再试', () => this.editAnswer(), { small: true, dataAction: 'edit-answer' }),
        ),
      );
    }
    return wrap;
  }

  /** 本轮真的用过、且能对上页码的出处（同页去重，最多 3 个）。 */
  private feedbackSourcePages(
    sourceRefs: readonly string[],
  ): readonly { readonly sourceRefId: string; readonly label: string }[] {
    const sources = this.workspace?.sources ?? [];
    const seen = new Set<string>();
    const pages: { sourceRefId: string; label: string }[] = [];
    for (const ref of sourceRefs) {
      const source = sources.find((entry) => entry.sourceRefId === ref);
      if (source === undefined) continue;
      const label = sourceLabel(source);
      if (seen.has(label)) continue;
      seen.add(label);
      pages.push({ sourceRefId: source.sourceRefId, label });
      if (pages.length >= 3) break;
    }
    return pages;
  }

  private verdict(): { readonly label: string; readonly tone: 'positive' | 'attention' | 'neutral' } {
    const grade = this.feedback;
    if (grade === null) return { label: VERDICT_LABELS.neutral, tone: 'neutral' };
    if (grade.requiresClarification) return { label: VERDICT_LABELS.clarify, tone: 'attention' };
    if (grade.criteria.some((criterion) => criterion.met === 'no')) {
      return { label: VERDICT_LABELS.practise, tone: 'attention' };
    }
    if (grade.criteria.length > 0 && grade.criteria.every((criterion) => criterion.met === 'yes')) {
      return { label: VERDICT_LABELS.correct, tone: 'positive' };
    }
    if (grade.criteria.some((criterion) => criterion.met === 'unclear')) {
      return { label: VERDICT_LABELS.clarify, tone: 'attention' };
    }
    return { label: VERDICT_LABELS.neutral, tone: 'neutral' };
  }

  private clarificationActions(): HTMLElement {
    const row = h('div', { class: 'edu-study-clarify__actions' });
    const actions: readonly { readonly id: string; readonly label: string; readonly run: () => void }[] = [
      {
        id: 'retake',
        label: '重新拍一张',
        run: () => {
          if (this.workspace !== null && this.workspace.imageFlow !== null) this.startImageMode();
          else this.chatNotice = '可以换一个更清楚的角度重新上传。';
          this.notify();
        },
      },
      {
        id: 'rotate',
        label: '旋转后重试',
        run: () => {
          this.chatNotice = '把图片摆正后再试一次，会更容易看清。';
          this.notify();
        },
      },
      {
        id: 'edit_text',
        label: '改正识别文字',
        run: () => this.editAnswer(),
      },
      {
        id: 'text_fallback',
        label: '改用文字作答',
        run: () => {
          if (this.imageMode) this.stopImageMode();
          else this.editAnswer();
        },
      },
      {
        id: 'retry_later',
        label: '稍后再试',
        run: () => {
          this.chatNotice = '可以稍后再试；这一题不会因此判错。';
          this.notify();
        },
      },
    ];
    for (const action of actions) {
      row.append(
        h(
          'button',
          {
            type: 'button',
            class: 'edu-button edu-button--small',
            'data-clarification-action': action.id,
            onclick: action.run,
          },
          action.label,
        ),
      );
    }
    return row;
  }

  private finishSummary(): HTMLElement {
    const summary = this.summary();
    const receipt = this.finishReceipt;
    const root = h(
      'div',
      { class: 'edu-study-finish', 'data-testid': 'study-finish' },
      h('h3', { class: 'edu-study-finish__title' }, this.finishLabel || '本轮结果'),
      h('p', { class: 'edu-study-finish__line' }, summary.review),
      h('div', { class: 'edu-study-finish__chips' }, ...this.axisChips(summary)),
    );
    if (receipt !== null) {
      root.append(
        h(
          'p',
          { class: 'edu-study-note' },
          `复习安排：${formatStudyTime(receipt.dueAt)}${receipt.early === true ? '（可以提前复习）' : ''}`,
        ),
      );
    }
    root.append(
      h(
        'p',
        { class: 'edu-study-note' },
        '结束本轮只记录实际做过的部分；不会把没做的题记成已完成，也不会把理解升级成「表现稳定」。',
      ),
      h(
        'div',
        { class: 'edu-study-result__actions' },
        button('回地图', () => this.navigate?.('/map'), { tone: 'primary', dataAction: 'back-to-map' }),
        button('看记录', () => this.navigate?.('/records'), { dataAction: 'view-records' }),
      ),
    );
    return root;
  }

  /**
   * 学习状态只读投影片段，不写回任何东西。标签复用 shell 的同一套学生话，
   * 因此学习页和记录页不会出现两套说法。
   */
  private summary(): StateSummary {
    const workspace = this.workspace;
    if (workspace === null) {
      return {
        learning: LEARNING_LABELS.not_started,
        understanding: UNDERSTANDING_LABELS.unassessed,
        review: '尚未复习',
        due: '暂无复习安排',
        selfReport: '未填写（可选）',
      };
    }
    const progress = this.progress;
    const learningState = progress?.learning.state ?? 'not_started';
    const understandingState = progress?.understanding.state ?? 'unassessed';
    const validity = progress?.understanding.validity ?? null;
    const understanding =
      validity === null || validity === 'current'
        ? UNDERSTANDING_LABELS[understandingState]
        : `${UNDERSTANDING_LABELS[understandingState]}（${VALIDITY_LABELS[validity]}）`;
    const outcome = progress?.review.latestOutcome ?? null;
    const historyLabel =
      progress?.review.lastCompletedAt === null || progress?.review.lastCompletedAt === undefined
        ? '尚未复习'
        : outcome === null
          ? '已复习'
          : `复习完成 · ${REVIEW_OUTCOME_LABELS[outcome]}`;
    const dueLabel =
      progress?.review.dueAt === null || progress?.review.dueAt === undefined ? '暂无复习安排' : '待复习';
    const selfReportLabel =
      this.selfReport === null ? null : SELF_REPORT_LABELS[this.selfReport.claimedState];
    return {
      learning: LEARNING_LABELS[learningState],
      understanding,
      review: historyLabel,
      due: dueLabel,
      selfReport: selfReportLabel ?? '未填写（可选）',
    };
  }

  private axisChips(summary: StateSummary): HTMLElement[] {
    return [
      statusChip(`学习：${summary.learning}`, 'neutral'),
      statusChip(
        `理解：${summary.understanding}`,
        summary.understanding.includes('需巩固')
          ? 'attention'
          : summary.understanding.includes('表现稳定')
            ? 'positive'
            : 'neutral',
      ),
      statusChip(`复习：${summary.review}`, summary.review.includes('仍需巩固') ? 'attention' : 'neutral'),
      statusChip(
        summary.due === '待复习' ? '复习安排：待复习' : '复习安排：暂无',
        summary.due === '待复习' ? 'attention' : 'neutral',
      ),
    ];
  }

  private axisSection(): HTMLElement {
    const summary = this.summary();
    return h(
      'details',
      { class: 'edu-study-detail', 'data-testid': 'study-axis-summary' },
      h('summary', {}, '学习状态'),
      h('div', { class: 'edu-study-axis__chips' }, ...this.axisChips(summary)),
      h('p', { class: 'edu-study-note' }, `你的自评：${summary.selfReport}。`),
    );
  }

  private selfReportSection(): HTMLElement {
    const section = h(
      'div',
      { class: 'edu-study-self-report', 'data-testid': 'study-self-report' },
      h('h3', { class: 'edu-study-subtitle' }, '你觉得自己学会了吗？（可选）'),
      h('p', { class: 'edu-study-note' }, '选一个，记下来。'),
    );
    const row = h('div', { class: 'edu-study-result__more' });
    for (const [state, label] of [
      ['uncertain', '不确定'],
      ['basically_understood', '基本会'],
      ['can_explain', '能解释'],
    ] as const) {
      row.append(
        button(label, () => void this.saveSelfReport(state), {
          small: true,
          dataAction: `self-report-${state}`,
        }),
      );
    }
    section.append(row);
    if (this.selfReport !== null) {
      const claimed =
        this.selfReport.claimedState === 'can_explain'
          ? '能解释'
          : this.selfReport.claimedState === 'basically_understood'
            ? '基本会'
            : '不确定';
      section.append(
        h('p', { class: 'edu-study-note' }, `已保存自评：${claimed} · ${formatStudyTime(this.selfReport.createdAt)}`),
      );
    }
    return section;
  }

  /* -------------------------------------------------------------- actions */

  private intentKey(): string {
    const intent = this.intent;
    return `${intent.conceptId ?? 'none'}|${intent.mode}|${intent.sessionId ?? 'new'}|${intent.activityId ?? 'none'}`;
  }

  /** 这一节里当前题目之后还有没有题（没有就退化成「再答一次」）。 */
  private nextActivityId(): string | null {
    const workspace = this.workspace;
    if (workspace === null) return null;
    const index = workspace.activities.findIndex((entry) => entry.id === workspace.activity.id);
    if (index < 0 || index + 1 >= workspace.activities.length) return null;
    return workspace.activities[index + 1]?.id ?? null;
  }

  /** 只用现有的 loadWorkspace/startSession 路径换下一题，不新增数据语义。 */
  async nextQuestion(): Promise<void> {
    const nextId = this.nextActivityId();
    if (nextId === null) {
      this.editAnswer();
      return;
    }
    this.intent = { ...this.intent, activityId: nextId, fromResume: false };
    const key = this.intentKey();
    this.loadedKey = key;
    this.resetView();
    await this.load(key);
    if (this.workspace !== null && this.workspace.activity.id !== nextId) {
      this.chatNotice = '这一节暂时换不到下一道题；刚才的记录不受影响，可以先结束本轮。';
      this.notify();
    }
  }

  private requestHint(): void {
    this.openChatHook?.();
    void this.sendHelp('hint');
  }

  private showMaterial(): void {
    if (this.openMaterialHook !== null) {
      this.openMaterialHook();
      return;
    }
    this.materialContainer?.scrollIntoView?.({ block: 'start' });
  }

  private openSource(source: StudySource, trigger: HTMLElement | null): void {
    // 弹层挂在页面容器上：窄屏时课本是带 transform 的抽屉，挂在里面会跟着抽屉一起藏起来。
    const parent =
      this.pageContext?.container ?? this.materialContainer ?? this.activityContainer;
    if (parent === null) return;
    openSourcePopover(parent, trigger ?? parent, this.workspace?.sources ?? [], source.sourceRefId);
  }

  private openSourceById(sourceRefId: string, trigger: HTMLElement | null = null): void {
    const source = this.workspace?.sources.find((entry) => entry.sourceRefId === sourceRefId);
    if (source === undefined) {
      this.chatNotice = '这条出处暂时打不开；没有跳到任何页面。';
      this.notify();
      return;
    }
    this.openSource(source, trigger);
  }
}

/** 把模型/评分里的内部词换成学生话；认不出来的保留原文，不臆造内容。 */
function studentCopy(value: string): string {
  return value
    .replace(/答案键/gu, '正确答案')
    .replace(/正确项\s*id/giu, '正确选项')
    .replace(/\bcriterion(?:Id)?(?:\.[A-Za-z0-9_-]+)+/giu, '要点')
    .replace(/\bcriterion(?:Id)?\b/giu, '要点')
    .replace(/\boption(?:\.[A-Za-z0-9_-]+)+/giu, '这个选项')
    .replace(/\boption[._][A-Za-z0-9_-]+/giu, '这个选项')
    .replace(/\bactivity(?:\.[A-Za-z0-9_-]+)+/giu, '这道题')
    .replace(/\bsource(?:\.[A-Za-z0-9_-]+)+/giu, '出处');
}

function splitSentences(value: string): string[] {
  return value
    .split(/(?<=[。！？!?])/u)
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
}

/** 比较“同一句话”时忽略空白与标点。 */
function normalizedCopy(value: string): string {
  return value.replace(/[\s。！？!?，,、；;：:「」“”"'（）()]/gu, '').toLowerCase();
}

/** 只复述对错、不提供信息的句子（「选择正确。」「答对了」）。 */
function isVerdictOnlySentence(value: string): boolean {
  return /^(选择正确|选择不正确|回答正确|回答不正确|完全正确|答对了|答错了|正确|不正确)[。！!]?$/u.test(
    value.trim(),
  );
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

/**
 * One row per textbook page: several source refs can resolve to the same page
 * (a heading, a body block and a chapter opener), which used to print the same
 * line five times.
 */
function uniqueSources(sources: readonly StudySource[]): readonly StudySource[] {
  const seen = new Set<string>();
  const result: StudySource[] = [];
  for (const source of sources) {
    const key = `${source.pdfPage}|${source.printedPage ?? ''}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(source);
  }
  return result;
}

function sourceLabel(source: StudySource): string {
  const printed = source.printedPage?.trim() ?? '';
  return printed.length > 0 ? `课本第 ${printed} 页` : `PDF 第 ${source.pdfPage} 页`;
}
