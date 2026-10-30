/**
 * FIXTURE DATA SOURCE — explicitly marked as fixture.
 *
 * It consumes the frozen T01 domain fixtures directly (no copied protocol) and
 * assembles read models. It performs no network/file IO and must never be
 * presented as a live API: `kind`, `notice` and `snapshot.fixture` all mark it.
 * T13 replaces this source with the real host facade.
 */

import {
  validateAssessment,
  validateContentPackStructure,
  validateCourseEdition,
  validateEvidence,
  validateLearner,
  validateSelfReport,
  validateSession,
  validateConceptProgress,
  errResult,
  type Assessment,
  type AuthStatus,
  type Concept,
  type ConceptProgress,
  type ContentPack,
  type CourseEdition,
  type Evidence,
  type Learner,
  type SelfReport,
  type Session,
  type ValidationResult,
  type ServiceResult,
} from '@edu/domain';

import packJson from '../../../../packages/domain/fixtures/packs/valid-partial.json';
import courseEditionJson from '../../../../packages/domain/fixtures/entities/course-edition.json';
import learnerJson from '../../../../packages/domain/fixtures/entities/learner.json';
import activeSessionJson from '../../../../packages/domain/fixtures/sessions/active.json';
import completedSessionJson from '../../../../packages/domain/fixtures/sessions/completed.json';
import reviewedAndDueJson from '../../../../packages/domain/fixtures/progress/reviewed-and-due.json';
import learnedNeedsSupportJson from '../../../../packages/domain/fixtures/progress/learned-needs-support.json';
import noEvidenceJson from '../../../../packages/domain/fixtures/progress/no-evidence.json';
import supportedBundleJson from '../../../../packages/domain/fixtures/assessments/supported-valid.json';
import selfReportJson from '../../../../packages/domain/fixtures/self-reports/cell.json';

import { positionLabel } from '../labels.js';
import {
  okData,
  type CompatibilityNotice,
  type DataResult,
  type DeleteReceipt,
  type DeleteScope,
  type ExportReceipt,
  type HomePayload,
  type LearnedRangeClaim,
  type RangeSaveInput,
  type RangeSaveReceipt,
  type RecordsPayload,
  type ResumePayload,
  type ReviewItem,
  type ShellDataSource,
  type ShellRequest,
  type ShellSnapshot,
} from './types.js';

export const FIXTURE_NOTICE =
  '演示数据（fixture）：页面内容来自 T01 冻结契约样例，不是真实教材，也不代表真实模型或 API 结果。';

export type FixtureScenario =
  | 'ready'
  | 'first-run'
  | 'completed-only'
  | 'records-empty'
  | 'records-error'
  | 'records-offline'
  | 'records-pending'
  | 'save-failed'
  | 'incompatible'
  | 'no-due'
  | 'unconfigured-key'
  | 'resume-fails'
  | 'snapshot-error';

export interface FixtureDataSourceOptions {
  readonly scenario?: FixtureScenario;
}

function unwrap<T>(result: ValidationResult<T>, label: string): T {
  if (!result.ok) {
    const detail = result.issues.map((issue) => `${issue.path}: ${issue.code}`).join('; ');
    throw new Error(`fixture contract violation in ${label}: ${detail}`);
  }
  return result.value;
}

const PACK_RAW = packJson;
const PACK: ContentPack = unwrap(validateContentPackStructure(PACK_RAW), 'packs/valid-partial.json');
const COURSE_EDITION: CourseEdition = unwrap(
  validateCourseEdition(courseEditionJson),
  'entities/course-edition.json',
);
const LEARNER: Learner = unwrap(validateLearner(learnerJson), 'entities/learner.json');
const ACTIVE_SESSION: Session = unwrap(validateSession(activeSessionJson), 'sessions/active.json');
const COMPLETED_SESSION_RAW: Session = unwrap(
  validateSession(completedSessionJson),
  'sessions/completed.json',
);
const REVIEWED_AND_DUE: ConceptProgress = unwrap(
  validateConceptProgress(reviewedAndDueJson),
  'progress/reviewed-and-due.json',
);
const LEARNED_NEEDS_SUPPORT: ConceptProgress = unwrap(
  validateConceptProgress(learnedNeedsSupportJson),
  'progress/learned-needs-support.json',
);
const NO_EVIDENCE: ConceptProgress = unwrap(
  validateConceptProgress(noEvidenceJson),
  'progress/no-evidence.json',
);
const SELF_REPORT: SelfReport = unwrap(validateSelfReport(selfReportJson), 'self-reports/cell.json');

interface SupportedBundle {
  readonly assessment: Assessment;
  readonly evidences: readonly Evidence[];
}
const SUPPORTED_BUNDLE: SupportedBundle = {
  assessment: unwrap(
    validateAssessment((supportedBundleJson as { assessment: unknown }).assessment),
    'assessments/supported-valid.json#assessment',
  ),
  evidences: ((supportedBundleJson as { evidences: readonly unknown[] }).evidences).map((entry, index) =>
    unwrap(validateEvidence(entry), `assessments/supported-valid.json#evidences[${index}]`),
  ),
};

function cloneEvidenceForConcept(
  base: Evidence,
  input: { readonly id: string; readonly attemptId: string; readonly conceptId: string; readonly observation: string; readonly sourceRef: string; readonly createdAt: string; readonly criterionId: string; readonly result: 'met' | 'not_met' | 'unclear' },
): Evidence {
  return unwrap(
    validateEvidence({
      ...base,
      id: input.id,
      attemptId: input.attemptId,
      conceptId: input.conceptId,
      observation: input.observation,
      sourceRefs: [input.sourceRef],
      createdAt: input.createdAt,
      criterionResults: [
        { criterionId: input.criterionId, result: input.result, note: null },
      ],
    }),
    `synthetic evidence ${input.id}`,
  );
}

function cloneAssessment(
  base: Assessment,
  input: {
    readonly id: string;
    readonly conceptId: string;
    readonly state: Assessment['state'];
    readonly rationale: string;
    readonly evidenceIds: readonly string[];
    readonly assessedAt: string;
    readonly validity: Assessment['validity'];
    readonly revision: number;
  },
): Assessment {
  return unwrap(
    validateAssessment({
      ...base,
      id: input.id,
      conceptId: input.conceptId,
      state: input.state,
      rationale: input.rationale,
      evidenceIds: input.evidenceIds,
      assessedAt: input.assessedAt,
      validity: input.validity,
      revision: input.revision,
    }),
    `synthetic assessment ${input.id}`,
  );
}

function cloneProgress(
  base: ConceptProgress,
  input: {
    readonly conceptId: string;
    readonly assessmentId: string | null;
    readonly understandingState: ConceptProgress['understanding']['state'];
    readonly sessionId: string | null;
    readonly activityId: string | null;
    readonly cursor: string | null;
  },
): ConceptProgress {
  return unwrap(
    validateConceptProgress({
      ...base,
      conceptId: input.conceptId,
      understanding: {
        ...base.understanding,
        state: input.understandingState,
        assessmentId: input.assessmentId,
      },
      lastPosition: {
        ...base.lastPosition,
        sessionId: input.sessionId,
        activityId: input.activityId,
        cursor: input.cursor,
      },
    }),
    `synthetic progress ${input.conceptId}`,
  );
}

const EXTRA_EVIDENCE = cloneEvidenceForConcept(SUPPORTED_BUNDLE.evidences[0]!, {
  id: 'evidence.cell-structure.explain',
  attemptId: 'attempt.cell-structure.explain',
  conceptId: 'concept.cell-structure',
  observation: '示例观察：能指出细胞核的位置，但没有说明细胞膜的作用。',
  sourceRef: 'source.p26',
  createdAt: '2026-10-29T09:10:00Z',
  criterionId: 'criterion.cell.identify',
  result: 'not_met',
});

const CELL_STRUCTURE_ASSESSMENT = cloneAssessment(SUPPORTED_BUNDLE.assessment, {
  id: 'assessment.cell-structure.needs-support',
  conceptId: 'concept.cell-structure',
  state: 'needs_support',
  rationale: '示例判断：本次解释缺少细胞膜的作用，暂不能说明细胞结构之间的关系。',
  evidenceIds: [EXTRA_EVIDENCE.id],
  assessedAt: '2026-10-29T09:20:00Z',
  validity: 'current',
  revision: 1,
});

const CELL_HISTORY_ASSESSMENT = cloneAssessment(SUPPORTED_BUNDLE.assessment, {
  id: 'assessment.cell.developing',
  conceptId: 'concept.cell',
  state: 'developing',
  rationale: '示例历史判断：当时只有解释证据，缺少迁移作答，因此为初步理解。',
  evidenceIds: [SUPPORTED_BUNDLE.evidences[0]!.id],
  assessedAt: '2026-10-28T08:20:00Z',
  validity: 'stale',
  revision: 0,
});

const CELL_STRUCTURE_SESSION: Session = unwrap(
  validateSession({
    ...COMPLETED_SESSION_RAW,
    id: 'session.cell-structure.1',
    conceptId: 'concept.cell-structure',
    startedAt: '2026-10-28T08:00:00Z',
    endedAt: '2026-10-28T08:30:00Z',
    resumeCursor: { activityId: 'activity.cell-explain', cursor: 'step-2' },
  }),
  'synthetic session cell-structure',
);

const CELL_STRUCTURE_PROGRESS = cloneProgress(LEARNED_NEEDS_SUPPORT, {
  conceptId: 'concept.cell-structure',
  assessmentId: CELL_STRUCTURE_ASSESSMENT.id,
  understandingState: 'needs_support',
  sessionId: CELL_STRUCTURE_SESSION.id,
  activityId: 'activity.cell-explain',
  cursor: 'step-2',
});

const CELL_DIVISION_PROGRESS = cloneProgress(NO_EVIDENCE, {
  conceptId: 'concept.cell-division',
  assessmentId: null,
  understandingState: 'unassessed',
  sessionId: null,
  activityId: null,
  cursor: null,
});

export interface FixtureDataset {
  readonly learner: Learner;
  readonly courseEdition: CourseEdition;
  readonly pack: ContentPack;
  readonly concepts: readonly Concept[];
  readonly sessions: readonly Session[];
  readonly progresses: readonly ConceptProgress[];
  readonly evidence: readonly Evidence[];
  readonly assessments: readonly Assessment[];
  readonly selfReports: readonly SelfReport[];
}

export function buildFixtureDataset(): FixtureDataset {
  return {
    learner: LEARNER,
    courseEdition: COURSE_EDITION,
    pack: PACK,
    concepts: PACK.concepts,
    sessions: [ACTIVE_SESSION, CELL_STRUCTURE_SESSION],
    progresses: [REVIEWED_AND_DUE, CELL_STRUCTURE_PROGRESS, CELL_DIVISION_PROGRESS],
    evidence: [...SUPPORTED_BUNDLE.evidences, EXTRA_EVIDENCE],
    assessments: [SUPPORTED_BUNDLE.assessment, CELL_HISTORY_ASSESSMENT, CELL_STRUCTURE_ASSESSMENT],
    selfReports: [SELF_REPORT],
  };
}

const PACK_SUMMARY = {
  id: PACK.id,
  version: PACK.version,
  scope: PACK.scope,
  coverageStatus: PACK.coverageStatus,
  status: PACK.status,
  trustMode: PACK.status === 'published' ? ('published' as const) : ('candidate' as const),
  contentHash: PACK.contentHash,
  courseEditionId: PACK.courseEditionId,
};

const NOW = '2026-10-29T10:00:00Z';

function conceptTitle(concepts: readonly Concept[], conceptId: string): string {
  return concepts.find((concept) => concept.id === conceptId)?.title ?? conceptId;
}

function reviewItems(
  progress: readonly ConceptProgress[],
  concepts: readonly Concept[],
  now: string,
  includeDue: boolean,
): readonly ReviewItem[] {
  if (!includeDue) return [];
  return progress
    .filter((entry) => entry.review.dueAt !== null && Date.parse(entry.review.dueAt) <= Date.parse(now))
    .map((entry) => ({
      conceptId: entry.conceptId,
      conceptTitle: conceptTitle(concepts, entry.conceptId),
      dueAt: entry.review.dueAt as string,
      reason: entry.understanding.state === 'needs_support' ? ('needs_support' as const) : ('due' as const),
    }));
}

function emptyRecords(saveState: 'saved' | 'failed', rangeClaim: LearnedRangeClaim | null): RecordsPayload {
  return {
    now: NOW,
    progresses: [],
    sessions: [],
    evidence: [],
    assessments: [],
    selfReports: [],
    rangeClaim,
    saveState,
  };
}

export class FixtureShellDataSource implements ShellDataSource {
  readonly kind = 'fixture' as const;
  readonly notice = FIXTURE_NOTICE;
  readonly options: FixtureDataSourceOptions;

  private rangeClaim: LearnedRangeClaim | null = null;
  private deleted = false;
  private readonly pending = new Promise<never>(() => {
    /* intentionally never settles: records-pending scenario */
  });

  constructor(options: FixtureDataSourceOptions = {}) {
    this.options = options;
  }

  get scenario(): FixtureScenario {
    return this.options.scenario ?? 'ready';
  }

  private snapshot(): ShellSnapshot {
    const keyConfigured = this.scenario !== 'unconfigured-key';
    const account: AuthStatus = {
      method: 'account',
      status: 'unavailable',
      lastCheckedAt: NOW,
      accountRef: null,
    };
    const apiKey: AuthStatus = {
      method: 'api_key',
      status: keyConfigured ? 'available' : 'unavailable',
      lastCheckedAt: NOW,
      accountRef: null,
    };
    return {
      learner: LEARNER,
      courseEdition: COURSE_EDITION,
      pack: PACK_SUMMARY,
      concepts: PACK.concepts,
      auth: { account, apiKey },
      capabilities: {
        dsh: { bound: false, version: null, sourceRef: null },
        model: { text: keyConfigured, image: false },
        tools: [],
        network: 'loopback_only',
      },
      fixture: true,
      notice: FIXTURE_NOTICE,
    };
  }

  private home(): HomePayload {
    const firstRun = this.scenario === 'first-run';
    const progresses = firstRun || this.deleted ? [] : [REVIEWED_AND_DUE, CELL_STRUCTURE_PROGRESS, CELL_DIVISION_PROGRESS];
    const sessions =
      firstRun || this.deleted
        ? []
        : this.scenario === 'completed-only'
          ? [CELL_STRUCTURE_SESSION]
          : [ACTIVE_SESSION, CELL_STRUCTURE_SESSION];
    const compatibility: CompatibilityNotice | null =
      this.scenario === 'incompatible'
        ? {
            previousPackVersion: '0.9.0',
            currentPackVersion: PACK.version,
            affectedConceptIds: ['concept.cell'],
            reason: '内容包修订了该概念的评分标准，旧证据不能直接沿用。',
          }
        : null;
    return {
      now: NOW,
      activeSession: sessions.find((session) => session.status === 'active') ?? null,
      lastCompletedSession:
        sessions
          .filter((session) => session.status === 'completed')
          .sort((a, b) => Date.parse(b.endedAt ?? '') - Date.parse(a.endedAt ?? ''))[0] ?? null,
      progress: progresses,
      dueReviews: reviewItems(progresses, PACK.concepts, NOW, this.scenario !== 'no-due'),
      totalConcepts: PACK.concepts.length,
      learnedConceptCount: progresses.filter((entry) => entry.learning.state !== 'not_started').length,
      firstRun,
      compatibility,
    };
  }

  private records(): RecordsPayload {
    if (this.deleted || this.scenario === 'records-empty' || this.scenario === 'first-run') {
      return emptyRecords(this.scenario === 'save-failed' ? 'failed' : 'saved', this.rangeClaim);
    }
    return {
      now: NOW,
      progresses: [REVIEWED_AND_DUE, CELL_STRUCTURE_PROGRESS, CELL_DIVISION_PROGRESS],
      sessions: [ACTIVE_SESSION, CELL_STRUCTURE_SESSION],
      evidence: [...SUPPORTED_BUNDLE.evidences, EXTRA_EVIDENCE],
      assessments: [SUPPORTED_BUNDLE.assessment, CELL_HISTORY_ASSESSMENT, CELL_STRUCTURE_ASSESSMENT],
      selfReports: [SELF_REPORT],
      rangeClaim: this.rangeClaim,
      saveState: this.scenario === 'save-failed' ? 'failed' : 'saved',
    };
  }

  private offline(): boolean {
    return this.scenario === 'records-offline';
  }

  async loadSnapshot(_request: ShellRequest): Promise<DataResult<ShellSnapshot>> {
    if (this.scenario === 'snapshot-error') {
      return errResult<ShellSnapshot>('STORAGE_FAILED', '本地记录暂时无法读取', true);
    }
    return okData(this.snapshot(), 1, this.offline());
  }

  async loadHome(_request: ShellRequest): Promise<DataResult<HomePayload>> {
    return okData(this.home(), 1, this.offline());
  }

  async loadRecords(_request: ShellRequest): Promise<DataResult<RecordsPayload>> {
    if (this.scenario === 'records-pending') {
      return this.pending;
    }
    if (this.scenario === 'records-error') {
      return errResult<RecordsPayload>('STORAGE_FAILED', '本地记录暂时无法读取', true);
    }
    return okData(this.records(), 1, this.offline());
  }

  async resumeSession(_request: ShellRequest, sessionId: string): Promise<DataResult<ResumePayload>> {
    if (this.scenario === 'resume-fails') {
      return errResult<ResumePayload>('STALE_REVISION', '上次活动与当前内容版本不匹配', false);
    }
    const session = [ACTIVE_SESSION, CELL_STRUCTURE_SESSION].find((entry) => entry.id === sessionId);
    if (session === undefined) {
      return errResult<ResumePayload>('NOT_FOUND', '找不到上次活动', false);
    }
    return okData(
      {
        session,
        conceptTitle: conceptTitle(PACK.concepts, session.conceptId),
        courseEditionTitle: COURSE_EDITION.editionLabel,
        activityId: session.resumeCursor.activityId,
        cursor: session.resumeCursor.cursor,
        positionLabel: positionLabel(session.resumeCursor.activityId, session.resumeCursor.cursor),
        draftRestored: session.status === 'active' && session.resumeCursor.cursor !== null,
        packVersion: session.packVersion,
      },
      1,
    );
  }

  async saveRange(request: ShellRequest, input: RangeSaveInput): Promise<DataResult<RangeSaveReceipt>> {
    if (this.scenario === 'save-failed') {
      return errResult<RangeSaveReceipt>('STORAGE_FAILED', '自述范围没有写入本机', true);
    }
    const range: LearnedRangeClaim = {
      id: `range.${request.requestId}`,
      learnerId: request.learnerId,
      courseEditionId: PACK.courseEditionId,
      packVersion: PACK.version,
      scope: input.scope,
      conceptIds: input.conceptIds,
      diagnosticSkipped: input.diagnosticSkipped,
      createdAt: request.now,
      statementOnly: true,
    };
    this.rangeClaim = range;
    return okData({ range, diagnosticSuggested: input.scope !== 'selected' || input.conceptIds.length === 0 }, 2);
  }

  async exportData(_request: ShellRequest, _scope: 'learning_records'): Promise<DataResult<ExportReceipt>> {
    const data = this.records();
    return okData(
      {
        scope: 'learning_records',
        exportedAt: NOW,
        recordCount: data.progresses.length + data.evidence.length + data.selfReports.length,
        note: '导出内容只包含本机学习记录，不含教材原文件或共享内容。',
      },
      2,
    );
  }

  async deleteData(_request: ShellRequest, scope: DeleteScope): Promise<DataResult<DeleteReceipt>> {
    const removed = this.records();
    if (scope === 'learning_records') {
      this.deleted = true;
      this.rangeClaim = null;
    }
    return okData(
      {
        scope,
        deletedAt: NOW,
        removedSessions: scope === 'learning_records' ? removed.sessions.length : 0,
        removedEvidence: scope === 'learning_records' ? removed.evidence.length : 0,
        removedSelfReports: scope === 'learning_records' ? removed.selfReports.length : 0,
        note:
          scope === 'learning_records'
            ? '已删除本机学习记录；教材文件与共享内容没有被删除。'
            : '已移除本机教材关联；教材源文件没有被删除。',
      },
      3,
    );
  }
}

export function createFixtureShellDataSource(options: FixtureDataSourceOptions = {}): FixtureShellDataSource {
  return new FixtureShellDataSource(options);
}

export type { ShellDataSource };
