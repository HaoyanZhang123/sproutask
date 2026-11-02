/**
 * FIXTURE STUDY SOURCE — explicitly marked.
 *
 * Synthetic workspace, scripted teaching turns and local draft storage. It uses
 * T01 pack/activity/source fixtures and the frozen session/attempt types; it is
 * not a real model, not a real journal, and is labelled as fixture in the UI.
 * T13 replaces it with TutorService + LearnerService + KnowledgeService.
 */

import {
  errResult,
  okResult,
  validateActivityAttempt,
  validateConceptProgress,
  validateContentPackStructure,
  validateFigure,
  validateGradeResult,
  validateSelfReport,
  validateSession,
  validateSourceBlock,
  validateSourceRef,
  type Activity,
  type Concept,
  type ConceptProgress,
  type Figure,
  type GradeResult,
  type RequestContext,
  type SelfReport,
  type ServiceResult,
  type Session,
  type SourceBlock,
  type SourceRef,
  type ValidationResult,
} from '@edu/domain';
import type {
  TutorSessionState,
  TutorStartSessionRequest,
  TutorTurnInput,
} from '@edu/tutor';

import packJson from '../../../packages/domain/fixtures/packs/valid-partial.json';
import reviewedAndDueJson from '../../../packages/domain/fixtures/progress/reviewed-and-due.json';
import learnedNeedsSupportJson from '../../../packages/domain/fixtures/progress/learned-needs-support.json';
import noEvidenceJson from '../../../packages/domain/fixtures/progress/no-evidence.json';
import selfReportJson from '../../../packages/domain/fixtures/self-reports/cell.json';
import sourceRefJson from '../../../packages/domain/fixtures/entities/source-ref.json';
import sourceBlockJson from '../../../packages/domain/fixtures/entities/source-block.json';
import figureJson from '../../../packages/domain/fixtures/entities/figure.json';

import type {
  StudyDataSource,
  StudyDecision,
  StudyDraft,
  StudyDraftKey,
  StudyFinishReceipt,
  StudyImageInfo,
  StudyImageSubmit,
  StudyReviewCandidate,
  StudyReviewRange,
  StudySource,
  StudyTurnOutcome,
  StudyTurnState,
  StudyWorkspace,
} from './types.js';

export const FIXTURE_STUDY_NOTICE =
  '演示数据（fixture）：本页的教材、活动、教学回合、反馈与草稿均为合成样例，不是真实模型或真实 API 结果。';

export type StudyScenario =
  | 'ready'
  | 'review-needs-support'
  | 'review-empty'
  | 'fresh'
  | 'failed-grading'
  | 'offline'
  | 'late'
  | 'clarify'
  | 'incompatible'
  | 'image'
  | 'image-clarification';

export interface FixtureStudyOptions {
  readonly scenario?: StudyScenario;
}

function unwrap<T>(result: ValidationResult<T>, label: string): T {
  if (!result.ok) {
    throw new Error(`fixture contract violation in ${label}: ${result.issues.map((issue) => issue.code).join(',')}`);
  }
  return result.value;
}

const PACK = unwrap(validateContentPackStructure(packJson), 'packs/valid-partial.json');
const CONCEPT = PACK.concepts.find((entry) => entry.id === 'concept.cell') as Concept;
const CONCEPT_STRUCTURE = PACK.concepts.find((entry) => entry.id === 'concept.cell-structure') as Concept;
const ACTIVITY = PACK.activities.find((entry) => entry.id === 'activity.cell-recall') as Activity;
const ACTIVITY_STRUCTURE = PACK.activities.find((entry) => entry.id === 'activity.cell-label') as Activity;
const ACTIVITIES = PACK.activities.filter((entry) => entry.conceptIds.includes(CONCEPT.id));
const BASE_REVIEWED = unwrap(validateConceptProgress(reviewedAndDueJson), 'progress/reviewed-and-due.json');
const BASE_NEEDS_SUPPORT = unwrap(validateConceptProgress(learnedNeedsSupportJson), 'progress/learned-needs-support.json');
const BASE_UNASSESSED = unwrap(validateConceptProgress(noEvidenceJson), 'progress/no-evidence.json');
const SELF_REPORT = unwrap(validateSelfReport(selfReportJson), 'self-reports/cell.json');
const SOURCE_REF = unwrap(validateSourceRef(sourceRefJson), 'entities/source-ref.json');
const SOURCE_BLOCK = unwrap(validateSourceBlock(sourceBlockJson), 'entities/source-block.json');
const FIGURE = unwrap(validateFigure(figureJson), 'entities/figure.json');
const SOURCES: readonly StudySource[] = [
  {
    sourceRefId: SOURCE_REF.id,
    pdfPage: SOURCE_REF.pdfPage,
    printedPage: SOURCE_REF.printedPage,
    label: `${SOURCE_BLOCK.type === 'paragraph' ? '段落' : '来源'} · ${SOURCE_BLOCK.id}`,
    verification: SOURCE_REF.verification.state,
  },
  {
    sourceRefId: FIGURE.sourceRefId,
    pdfPage: 26,
    printedPage: null,
    label: `图示 · ${FIGURE.id}`,
    verification: 'human_checked',
  },
];

const NOW = '2026-10-29T10:00:00Z';

function cloneProgress(base: ConceptProgress): ConceptProgress {
  return JSON.parse(JSON.stringify(base)) as ConceptProgress;
}

function tomorrow(timestamp: string): string {
  return new Date(Date.parse(timestamp) + 86_400_000).toISOString();
}

function reviewRange(progress: ConceptProgress, forceNeedsSupport = false): StudyReviewRange {
  const candidates: StudyReviewCandidate[] = [
    {
      conceptId: progress.conceptId,
      title: '细胞',
      reason: forceNeedsSupport || progress.review.latestOutcome === 'needs_support' ? 'needs_support' : 'due',
      dueAt: progress.review.dueAt,
      lastReviewedAt: progress.review.lastCompletedAt,
      activityId: ACTIVITY.id,
    },
    {
      conceptId: 'concept.cell-structure',
      title: '细胞结构',
      reason: 'due',
      dueAt: '2026-10-30T09:00:00Z',
      lastReviewedAt: null,
      activityId: 'activity.cell-label',
    },
  ];
  return {
    candidates,
    policyVersion: 'review-policy-v1',
    note: '推荐理由来自学习完成时间与最近证据；不是记忆算法分数，也不显示掌握百分比。',
  };
}

function sessionFor(concept: Concept, activity: Activity, mode: 'learn' | 'review', sessionId: string): Session {
  return unwrap(
    validateSession({
      schemaVersion: 1,
      id: sessionId,
      learnerId: 'learner.local.default',
      courseEditionId: concept.courseEditionId,
      packVersion: PACK.version,
      trustMode: 'published',
      conceptId: concept.id,
      mode,
      status: 'active',
      startedAt: NOW,
      endedAt: null,
      resumeCursor: { activityId: activity.id, cursor: 'activity-start' },
      dshSessionId: null,
    }),
    'fixture study session',
  );
}

function stateFor(
  session: Session,
  activity: Activity,
  mode: 'learn' | 'review',
  revision: number,
  overrides: Partial<TutorSessionState> = {},
): TutorSessionState {
  return {
    sessionId: session.id,
    learnerId: session.learnerId,
    conceptId: session.conceptId,
    courseEditionId: session.courseEditionId,
    packVersion: session.packVersion,
    mode,
    revision,
    turnCount: revision,
    consecutiveFailures: 0,
    consecutiveProbes: 0,
    helpKinds: [],
    disclosure: false,
    difficulty: 'standard',
    representation: 'text',
    reviewStage: mode === 'review' ? 'recall' : null,
    currentActivityId: activity.id,
    status: 'active',
    lastAction: null,
    pendingGradingAttemptId: null,
    ...overrides,
  };
}

function gradeFor(attemptId: string, correct: boolean, disclosure: boolean, requiresClarification = false): GradeResult {
  return unwrap(
    validateGradeResult({
      schemaVersion: 1,
      attemptId,
      criteria: [
        {
          criterionId: 'criterion.cell.identify',
          met: requiresClarification ? 'unclear' : correct ? 'yes' : 'no',
          rationale: requiresClarification
            ? '这次作答信息不足，暂时不能判断是否说清了“基本单位”。'
            : correct
              ? '回答说明了细胞是生物体结构和功能的基本单位。'
              : '回答还没有说明“基本单位”这一关键关系。',
        },
      ],
      feedback: requiresClarification
        ? '这次作答还不够清楚，暂时不能判断；可以补充文字或重新上传更清楚的图片。'
        : correct
          ? '你已经说清了细胞是生物体结构和功能的基本单位。下一次可以尝试用不同细胞的例子迁移。'
          : '目前还缺少“基本单位”这一关键说明；可以回看材料中的定义后再试一次。',
      uncertainties: requiresClarification
        ? ['这次作答信息不足，不能据此判断；不会判你答错。']
        : [
            '这次只有一次文本作答；不能据此推断长期掌握。',
            ...(disclosure ? ['本轮看过完整答案/示范，这次作答不能作为独立证据。'] : []),
          ],
      evidenceCandidates: correct && !requiresClarification
        ? [
            {
              conceptId: 'concept.cell',
              kind: 'explain',
              observation: '学生说明细胞是生物体结构和功能的基本单位。',
              criterionResults: [{ criterionId: 'criterion.cell.identify', result: 'met', note: null }],
              assistance: disclosure ? 'assisted' : 'unassisted',
              sourceRefs: ['source.p18'],
              assessmentOrigin: 'rule',
              modelRunId: null,
              uncertainty: null,
            },
          ]
        : [],
      requiresClarification,
      sourceRefs: ['source.p18'],
      graderVersion: 'fixture-rule-v1',
    }),
    'fixture grade',
  );
}

function attemptFor(
  input: TutorTurnInput,
  activity: Activity,
  session: Session,
): import('@edu/domain').ActivityAttempt {
  const attempt = input.attempt;
  if (attempt === null || attempt === undefined) {
    throw new Error('fixture attempt missing');
  }
  const helpUsed = input.helpRequest === null || input.helpRequest === undefined ? [] : [{ kind: input.helpRequest, usedAt: NOW }];
  return unwrap(
    validateActivityAttempt({
      schemaVersion: 1,
      id: `attempt.${input.requestId}`,
      requestId: input.requestId,
      learnerId: session.learnerId,
      sessionId: session.id,
      courseEditionId: session.courseEditionId,
      packVersion: session.packVersion,
      activityId: activity.id,
      activityVersion: activity.version,
      conceptIds: activity.conceptIds,
      inputType: attempt.inputType,
      answerAssetId: attempt.answerAssetId ?? null,
      answerText: attempt.answerText ?? null,
      submittedAt: NOW,
      helpUsed,
      evidenceIds: [],
    }),
    'fixture activity attempt',
  );
}

export class FixtureStudyDataSource implements StudyDataSource {
  readonly kind = 'fixture' as const;
  readonly notice = FIXTURE_STUDY_NOTICE;
  readonly scenario: StudyScenario;
  private progress: ConceptProgress;
  private selfReport: SelfReport | null;
  private session: Session | null = null;
  private state: TutorSessionState | null = null;
  private currentConcept: Concept = CONCEPT;
  private currentActivity: Activity = ACTIVITY;
  private graded = false;
  private readonly drafts = new Map<string, StudyDraft>();
  private pendingResolve: ((result: ServiceResult<StudyTurnOutcome>) => void) | null = null;
  private deferred = false;

  constructor(options: FixtureStudyOptions = {}) {
    this.scenario = options.scenario ?? 'ready';
    this.progress =
      this.scenario === 'fresh'
        ? cloneProgress(BASE_UNASSESSED)
        : this.scenario === 'review-needs-support'
          ? cloneProgress(BASE_NEEDS_SUPPORT)
          : cloneProgress(BASE_REVIEWED);
    this.selfReport = this.scenario === 'fresh' ? null : SELF_REPORT;
  }

  async loadWorkspace(
    _ctx: RequestContext,
    input: { readonly conceptId: string; readonly mode: 'learn' | 'review'; readonly activityId?: string | null },
  ): Promise<ServiceResult<StudyWorkspace>> {
    if (input.conceptId !== CONCEPT.id && input.conceptId !== CONCEPT_STRUCTURE.id) {
      return errResult('NOT_FOUND', '找不到这个概念', false);
    }
    const concept = input.conceptId === CONCEPT_STRUCTURE.id ? CONCEPT_STRUCTURE : CONCEPT;
    const activities =
      concept.id === CONCEPT_STRUCTURE.id ? [ACTIVITY_STRUCTURE] : ACTIVITIES;
    const activity = activities.find((entry) => entry.id === input.activityId) ?? activities[0] ?? ACTIVITY;
    if (concept.id === CONCEPT_STRUCTURE.id) {
      this.progress = unwrap(
        validateConceptProgress({
          ...cloneProgress(BASE_UNASSESSED),
          conceptId: CONCEPT_STRUCTURE.id,
        }),
        'fixture structure progress',
      );
      this.selfReport = null;
    }
    this.currentConcept = concept;
    this.currentActivity = activity;
    return okResult(
      {
        courseEditionId: concept.courseEditionId,
        courseEditionLabel: '2024 七年级上册 · 生物 · 合成样例（fixture）',
        packId: PACK.id,
        packVersion: PACK.version,
        trustMode: 'published',
        scope: PACK.scope,
        coverageStatus: PACK.coverageStatus,
        concept,
        activities,
        activity,
        progress: this.progress,
        selfReport: this.selfReport,
        sources: SOURCES,
        reviewRange:
          input.mode === 'review'
            ? reviewRange(this.progress, this.scenario === 'review-needs-support')
            : null,
        compatibility:
          this.scenario === 'incompatible'
            ? {
                previousPackVersion: '0.9.0',
                currentPackVersion: PACK.version,
                reason: '内容包修订了评分标准，旧证据不能直接沿用。',
              }
            : null,
        imageFlow:
          this.scenario === 'image' || this.scenario === 'image-clarification'
            ? {
                stage: 'selected',
                asset: { assetId: 'asset.image.fixture', width: 900, height: 600, mime: 'image/png' },
                recognition: null,
                revision: null,
                clarification: null,
                degradedMessage: null,
                injectionNotice: null,
              }
            : null,
        fixture: true,
        notice: FIXTURE_STUDY_NOTICE,
      },
      1,
    );
  }

  async loadProgress(_ctx: RequestContext, conceptId: string): Promise<ServiceResult<ConceptProgress>> {
    if (conceptId !== CONCEPT.id && conceptId !== CONCEPT_STRUCTURE.id) {
      return errResult('NOT_FOUND', '找不到概念进度', false);
    }
    return okResult(this.progress, 1);
  }

  async loadReviewRange(_ctx: RequestContext): Promise<ServiceResult<StudyReviewRange>> {
    if (this.scenario === 'review-empty') {
      return okResult(
        {
          candidates: [],
          policyVersion: 'review-policy-v1',
          note: '当前没有待复习项目；可以自选范围或回到地图。',
        },
        1,
      );
    }
    return okResult(reviewRange(this.progress, this.scenario === 'review-needs-support'), 1);
  }

  async deferReview(
    _ctx: RequestContext,
    conceptId: string,
  ): Promise<ServiceResult<{ readonly dueAt: string; readonly deferred: true }>> {
    if (conceptId !== CONCEPT.id && conceptId !== CONCEPT_STRUCTURE.id) {
      return errResult('NOT_FOUND', '找不到待复习概念', false);
    }
    const dueAt = tomorrow(this.progress.review.dueAt ?? NOW);
    this.progress = {
      ...this.progress,
      review: { ...this.progress.review, dueAt },
    };
    return okResult({ dueAt, deferred: true }, 2);
  }

  async loadDraft(_ctx: RequestContext, key: StudyDraftKey): Promise<ServiceResult<StudyDraft | null>> {
    return okResult(this.drafts.get(this.draftKey(key)) ?? null, 1);
  }

  async saveDraft(_ctx: RequestContext, draft: StudyDraft): Promise<ServiceResult<{ readonly savedAt: string }>> {
    this.drafts.set(this.draftKey(draft), draft);
    return okResult({ savedAt: draft.savedAt }, 2);
  }

  async clearDraft(_ctx: RequestContext, key: StudyDraftKey): Promise<ServiceResult<{ readonly cleared: true }>> {
    this.drafts.delete(this.draftKey(key));
    return okResult({ cleared: true }, 2);
  }

  async saveSelfReport(
    _ctx: RequestContext,
    input: { readonly conceptId: string; readonly claimedState: 'uncertain' | 'basically_understood' | 'can_explain' },
  ): Promise<ServiceResult<SelfReport>> {
    const report = unwrap(
      validateSelfReport({
        schemaVersion: 1,
        id: `self-report.${input.conceptId}.${input.claimedState}`,
        learnerId: 'learner.local.default',
        courseEditionId: CONCEPT.courseEditionId,
        packVersion: PACK.version,
        conceptId: input.conceptId,
        claimedState: input.claimedState,
        createdAt: NOW,
      }),
      'fixture self report',
    );
    this.selfReport = report;
    return okResult(report, 2);
  }

  async startSession(
    _ctx: RequestContext,
    request: TutorStartSessionRequest,
  ): Promise<ServiceResult<import('@edu/tutor').StartedTutorSession>> {
    const mode = request.mode;
    const session = sessionFor(this.currentConcept, this.currentActivity, mode, request.sessionId ?? `session.study.${mode}.1`);
    this.session = session;
    this.state = stateFor(session, this.currentActivity, mode, 0);
    return okResult(
      {
        session,
        state: this.state,
        model: { provider: 'fixture', model: 'fixture', text: true, image: true, isMock: true },
        gateway: 'mock',
        dshSessionId: null,
      },
      1,
    );
  }

  async submitTurn(_ctx: RequestContext, input: TutorTurnInput): Promise<ServiceResult<StudyTurnOutcome>> {
    if (this.scenario === 'offline') {
      return errResult('UNAVAILABLE', '云推理不可用；本地材料仍可阅读', true);
    }
    if (this.scenario === 'late') {
      return new Promise<ServiceResult<StudyTurnOutcome>>((resolve) => {
        this.pendingResolve = resolve;
        this.deferred = true;
      });
    }
    if (this.session === null || this.state === null) {
      return errResult('NOT_FOUND', '还没有开始学习会话', false);
    }
    if (this.scenario === 'failed-grading' && input.attempt !== null && input.attempt !== undefined) {
      const attempt = attemptFor(input, this.currentActivity, this.session);
      return okResult(
        {
          revision: this.state.revision + 1,
          message: '原答已经保存，但反馈暂时没有完成。可以重试批改，不需要重新作答。',
          decision: {
            action: 'end',
            rationale: 'fixture grading failure',
            disclosure: false,
            guidance: 'none',
            difficulty: 'same',
            sourceRefs: [],
          },
          state: { ...this.state, revision: this.state.revision + 1, pendingGradingAttemptId: attempt.id } as StudyTurnState,
          attemptOutcome: {
            attempt,
            attemptId: attempt.id,
            persisted: true,
            duplicate: false,
            grade: null,
            feedbackPending: true,
            completedAt: NOW,
          },
        },
        2,
      );
    }
    return this.normalTurn(input);
  }

  private normalTurn(
    input: TutorTurnInput,
    options: {
      readonly image?: StudyImageInfo;
      readonly requiresClarification?: boolean;
      readonly correct?: boolean;
    } = {},
  ): ServiceResult<StudyTurnOutcome> {
    if (this.session === null || this.state === null) {
      return errResult('NOT_FOUND', '还没有开始学习会话', false);
    }
    const helpRequest = input.helpRequest ?? null;
    const disclosure = helpRequest === 'answer' || helpRequest === 'worked_solution';
    const hasAttempt = input.attempt !== null && input.attempt !== undefined;
    if (hasAttempt) this.graded = true;
    const answerText = input.attempt?.answerText ?? '';
    const correct = options.correct ?? (hasAttempt && (answerText.includes('细胞') || answerText.includes('单位')));
    const attempt = hasAttempt ? attemptFor(input, this.currentActivity, this.session) : null;
    const grade = attempt === null
      ? null
      : gradeFor(
          attempt.id,
          correct,
          disclosure,
          options.requiresClarification ?? this.scenario === 'clarify',
        );
    const helpKinds = helpRequest === null ? [] : [helpRequest];
    const consecutiveFailures = hasAttempt && !correct ? this.state.consecutiveFailures + 1 : this.state.consecutiveFailures;
    const decision: StudyDecision = {
      action: helpRequest === null ? (hasAttempt ? (correct ? 'confirm_understanding' : 'explicit_correction') : 'probe_question') : helpAction(helpRequest),
      rationale: helpRequest === null ? 'fixture teaching decision' : `student requested ${helpRequest}`,
      disclosure,
      guidance: helpRequest === 'answer' ? 'answer' : helpRequest === 'worked_solution' ? 'demonstration' : helpRequest === null ? 'none' : 'hint',
      difficulty: consecutiveFailures >= 2 ? 'reduced' : 'same',
      sourceRefs: ['source.p18'],
    };
    const message = helpRequest === null
      ? hasAttempt
        ? correct
          ? '你已经说清了细胞是基本单位，试着用不同细胞的例子再迁移一次。'
          : '这里还缺少“基本单位”的关键说明；先看看材料里的定义，再试一次。'
        : '先回忆一下：细胞为什么被称为生物体结构和功能的基本单位？'
      : helpRequest === 'answer'
        ? '这是本题的完整答案：细胞是生物体结构和功能的基本单位。看答案后这次作答会标为 disclosure，不能作为独立证据。'
        : helpRequest === 'worked_solution'
          ? '分步示范：1) 找到“基本单位”；2) 说明结构；3) 说明功能。看过完整步骤后，这次作答会标为 disclosure。'
          : helpRequest === 'explanation'
            ? '解释：细胞之所以是基本单位，是因为生物体的结构和功能都以细胞为基础。'
            : helpRequest === 'example'
              ? '例子：神经细胞和红细胞形态不同，但都由细胞构成。'
              : '提示：先看材料中“基本单位”这四个字，再说明结构和功能的关系。';
    const revision = this.state.revision + 1;
    const nextState: StudyTurnState = {
      revision,
      consecutiveFailures,
      difficulty: consecutiveFailures >= 2 ? 'reduced' : 'standard',
      currentActivityId: this.currentActivity.id,
      reviewStage: this.state.reviewStage,
      status: 'active',
      helpKinds,
      disclosure,
    };
    this.state = { ...this.state, ...nextState };
    return okResult(
      {
        revision,
        message,
        decision,
        state: nextState,
        attemptOutcome:
          attempt === null
            ? null
            : {
                attempt,
                attemptId: attempt.id,
                persisted: true,
                duplicate: false,
                grade,
                feedbackPending: options.requiresClarification === true,
                completedAt: NOW,
              },
        ...(options.image === undefined ? {} : { image: options.image }),
      },
      2,
    );
  }

  async skip(
    _ctx: RequestContext,
    request: { readonly sessionId: string; readonly revision: number; readonly requestId: string },
  ): Promise<ServiceResult<StudyTurnOutcome>> {
    if (this.session === null || this.state === null) return errResult('NOT_FOUND', '还没有开始学习会话', false);
    const revision = request.revision + 1;
    const nextState: StudyTurnState = {
      revision,
      consecutiveFailures: this.state.consecutiveFailures,
      difficulty: this.state.difficulty,
      currentActivityId: this.currentActivity.id,
      reviewStage: this.state.reviewStage,
      status: 'active',
      helpKinds: [],
      disclosure: false,
    };
    this.state = { ...this.state, ...nextState };
    return okResult(
      {
        revision,
        message: '已跳过本题；不会记为答错，也不会伪造活动完成。',
        decision: { action: 'skip', rationale: 'student skipped', disclosure: false, guidance: 'none', difficulty: 'same', sourceRefs: [] },
        state: nextState,
        attemptOutcome: null,
      },
      2,
    );
  }

  async end(
    _ctx: RequestContext,
    request: { readonly sessionId: string; readonly revision: number; readonly requestId: string; readonly completed: boolean },
  ): Promise<ServiceResult<StudyTurnOutcome>> {
    if (this.session === null || this.state === null) return errResult('NOT_FOUND', '还没有开始学习会话', false);
    const revision = request.revision + 1;
    const nextState: StudyTurnState = {
      revision,
      consecutiveFailures: this.state.consecutiveFailures,
      difficulty: this.state.difficulty,
      currentActivityId: null,
      reviewStage: this.state.reviewStage,
      status: request.completed ? 'completed' : 'abandoned',
      helpKinds: [],
      disclosure: false,
    };
    this.state = { ...this.state, ...nextState };
    return okResult(
      {
        revision,
        message: request.completed ? '本轮已结束。' : '本轮暂不完成；已保存的内容仍保留。',
        decision: { action: 'end', rationale: 'session end', disclosure: false, guidance: 'none', difficulty: 'same', sourceRefs: [] },
        state: nextState,
        attemptOutcome: null,
      },
      2,
    );
  }

  async finishLearning(
    _ctx: RequestContext,
    request: { readonly requestId: string; readonly sessionId: string; readonly revision: number },
  ): Promise<ServiceResult<StudyFinishReceipt>> {
    const completed = this.graded;
    this.progress = {
      ...this.progress,
      learning: completed
        ? { state: 'completed', startedAt: this.progress.learning.startedAt ?? NOW, lastCompletedAt: NOW }
        : { state: 'in_progress', startedAt: this.progress.learning.startedAt ?? NOW, lastCompletedAt: null },
      lastPosition: { ...this.progress.lastPosition, updatedAt: NOW },
    };
    return okResult(
      {
        progress: this.progress,
        dueAt: tomorrow(NOW),
        policyVersion: 'review-policy-v1',
        outcome: null,
        early: false,
      },
      3,
    );
  }

  async finishReview(
    _ctx: RequestContext,
    request: {
      readonly requestId: string;
      readonly sessionId: string;
      readonly revision: number;
      readonly outcome?: 'needs_support' | 'developing' | 'supported';
    },
  ): Promise<ServiceResult<StudyFinishReceipt>> {
    if (!this.graded) {
      return okResult(
        {
          progress: this.progress,
          dueAt: this.progress.review.dueAt ?? tomorrow(NOW),
          policyVersion: 'review-policy-v1',
          outcome: null,
          early: false,
        },
        3,
      );
    }
    const outcome = request.outcome ?? (this.scenario === 'review-needs-support' ? 'needs_support' : 'needs_support');
    const dueAt = tomorrow(NOW);
    this.progress = {
      ...this.progress,
      understanding: {
        ...this.progress.understanding,
        state: outcome === 'needs_support' ? 'needs_support' : this.progress.understanding.state,
        updatedAt: NOW,
      },
      review: {
        ...this.progress.review,
        lastCompletedAt: NOW,
        dueAt,
        latestOutcome: outcome,
      },
    };
    this.progress = unwrap(validateConceptProgress(this.progress), 'fixture review progress');
    return okResult(
      {
        progress: this.progress,
        dueAt,
        policyVersion: 'review-policy-v1',
        outcome,
        early: false,
      },
      3,
    );
  }

  async retryPendingGrading(
    _ctx: RequestContext,
    request: { readonly sessionId: string; readonly requestId: string },
  ): Promise<ServiceResult<import('./types.js').StudyAttemptOutcome>> {
    if (this.session === null) return errResult('NOT_FOUND', '还没有开始学习会话', false);
    const attemptId = this.state?.pendingGradingAttemptId ?? `attempt.${request.requestId}`;
    const attempt = unwrap(
      validateActivityAttempt({
        schemaVersion: 1,
        id: attemptId,
        requestId: request.requestId,
        learnerId: this.session.learnerId,
        sessionId: this.session.id,
        courseEditionId: this.session.courseEditionId,
        packVersion: this.session.packVersion,
        activityId: this.currentActivity.id,
        activityVersion: this.currentActivity.version,
        conceptIds: this.currentActivity.conceptIds,
        inputType: 'text',
        answerAssetId: null,
        answerText: 'fixture retried answer',
        submittedAt: NOW,
        helpUsed: [],
        evidenceIds: [],
      }),
      'fixture retry attempt',
    );
    return okResult(
      {
        attempt,
        attemptId,
        persisted: true,
        duplicate: false,
        grade: gradeFor(attemptId, true, false),
        feedbackPending: false,
        completedAt: NOW,
      },
      3,
    );
  }

  async submitImageAnswer(
    _ctx: RequestContext,
    input: StudyImageSubmit,
  ): Promise<ServiceResult<StudyTurnOutcome>> {
    if (this.scenario !== 'image' && this.scenario !== 'image-clarification') {
      return errResult('UNSUPPORTED', '当前 fixture 没有图片识别结果', false);
    }
    const clarification = this.scenario === 'image-clarification';
    const reasons = [
      '图片较模糊（清晰度 12 < 40）',
      '图片可能有 8° 倾斜，请摆正后重拍',
      '图片几乎是空白/均匀色块',
    ];
    const image: StudyImageInfo = {
      stage: clarification ? 'clarification_required' : 'graded',
      modelCalled: false,
      evidenceCandidates: [],
      gate: null,
      qualitySignal: {
        status: clarification ? 'blurry' : 'ok',
        forcedClarification: clarification,
        reasons: clarification ? reasons : [],
        note: 'fixture 质量门（合成样例，非真实模型）。',
      },
      clarification: clarification
        ? {
            reasons,
            message:
              'fixture：图片质量不足，未形成判断；请重拍或改用文字。这次只记为待澄清，不会写入成绩。',
            actions: ['retake', 'text_fallback'],
          }
        : null,
      persistence: {
        attemptId: `attempt.image.${input.assetId}`,
        sessionId: input.sessionId,
        duplicate: false,
        assessmentCommitted: !clarification,
        evidenceAccepted: clarification ? 0 : 1,
        evidenceRejected: 0,
        feedbackPending: clarification,
        note: clarification ? 'fixture: clarification attempt kept pending' : 'fixture: graded and committed',
      },
    };
    return this.normalTurn(
      {
        requestId: `request.image.${input.assetId}`,
        sessionId: this.session?.id ?? 'session.study.learn.1',
        revision: this.state?.revision ?? 0,
        attempt: {
          activityId: input.activityId,
          inputType: 'image',
          answerAssetId: input.assetId,
          answerText: null,
        },
        imageQuality: 'clear',
      },
      { image, requiresClarification: clarification, correct: !clarification },
    );
  }

  resolveLate(result?: ServiceResult<StudyTurnOutcome>): void {
    if (this.pendingResolve === null) return;
    const resolve = this.pendingResolve;
    this.pendingResolve = null;
    resolve(
      result ?? {
        ok: true,
        revision: 1,
        data: {
          revision: 1,
          message: '迟到的反馈',
          decision: { action: 'confirm_understanding', rationale: 'late fixture', disclosure: false, guidance: 'none', difficulty: 'same', sourceRefs: [] },
          state: { revision: 1, consecutiveFailures: 0, difficulty: 'standard', currentActivityId: ACTIVITY.id, reviewStage: null, status: 'active', helpKinds: [], disclosure: false },
          attemptOutcome: null,
        },
      },
    );
  }

  private draftKey(key: StudyDraftKey): string {
    return `${key.conceptId}|${key.mode}|${key.activityId}`;
  }
}

function helpAction(kind: string): string {
  if (kind === 'hint') return 'hint';
  if (kind === 'explanation') return 'layered_explanation';
  if (kind === 'example') return 'example';
  if (kind === 'worked_solution') return 'worked_example';
  return 'answer_disclosure';
}

export function createFixtureStudyDataSource(options: FixtureStudyOptions = {}): FixtureStudyDataSource {
  return new FixtureStudyDataSource(options);
}
