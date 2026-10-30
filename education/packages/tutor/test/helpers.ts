/**
 * T07 test helpers.
 *
 * Content comes from the frozen T01 pack (`valid-partial.json`) through the
 * accepted T04 `KnowledgeService`; the media/source catalogue here is synthetic
 * (no textbook text or images). The learner is a typed in-memory fake that
 * implements the exact `TutorLearnerPort` subset, so the tutor service's calls
 * (attempt persistence, evidence commit, review completion) can be asserted
 * without inventing a second storage protocol. Real `LearnerService` wiring is
 * T13's integration step; the type-level Pick guarantees signature parity.
 */

import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type {
  ActivityAttempt,
  Assessment,
  BookInstance,
  Clock,
  ConceptProgress,
  ContentPack,
  Evidence,
  EvidenceCandidate,
  GradeResult,
  HelpKind,
  Id,
  IdGenerator,
  PackKey,
  ProgressKey,
  RequestContext,
  ServiceResult,
  ServiceError,
  Session,
  SourceRef,
  Timestamp,
} from '@edu/domain';
import { errResult, okResult } from '@edu/domain';
import type {
  AssessmentOutcome,
  LearnerService,
  LearningCompletionResult,
  ReviewCompletionResult,
  ReviewQueueItem,
  SubmitAttemptResult,
  UnderstandingExplanation,
} from '@edu/learner';
import { KnowledgeService, createSourceCatalog } from '@edu/knowledge';
import {
  createMockTutorGateway,
  createTutorService,
  type MockTurnStep,
  type TutorLearnerPort,
  type TutorMode,
  type TutorPedagogyPolicy,
  type TutorService,
} from '../src/index.js';

export const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const educationRoot = path.resolve(packageRoot, '../..');
export const domainFixturesRoot = path.resolve(educationRoot, 'packages/domain/fixtures');
export const evidenceRoot = path.resolve(educationRoot, '.local/evidence/T07');
export const LEARNER_ID = 'learner.t07.fixture';
export const PACK_KEY: PackKey = { courseEditionId: 'course.biology-7a', packVersion: '1.0.0' };
export const FIXED_NOW = '2026-10-29T08:00:00Z';

export function readFixtureJson<T = unknown>(relativePath: string): T {
  return JSON.parse(readFileSync(path.resolve(domainFixturesRoot, relativePath), 'utf8')) as T;
}

export function loadPack(): ContentPack {
  return readFixtureJson<ContentPack>('packs/valid-partial.json');
}

export function sha256File(file: string): string {
  return createHash('sha256').update(readFileSync(file)).digest('hex');
}

export function writeEvidence(fileName: string, data: unknown): { file: string; sha256: string } {
  mkdirSync(evidenceRoot, { recursive: true });
  const file = path.resolve(evidenceRoot, fileName);
  writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
  return { file, sha256: sha256File(file) };
}

/* --------------------------------------------------------------- content */

export function createKnowledgeHarness(): {
  readonly knowledge: KnowledgeService;
  readonly pack: ContentPack;
} {
  const pack = loadPack();
  const book: BookInstance = {
    schemaVersion: 1,
    id: 'book.t07.fixture',
    courseEditionId: pack.courseEditionId,
    originalSha256: 'a'.repeat(64),
    pageCount: 40,
    managedAssetId: 'asset.book.t07',
    confirmedMetadata: { title: null, publisher: null, editionLabel: null, confirmedAt: null },
    createdAt: '2026-10-01T00:00:00Z',
  };
  const refs: readonly SourceRef[] = ['source.p18', 'source.p19', 'source.p20', 'source.p26'].map(
    (id, index) => ({
      schemaVersion: 1,
      id,
      bookInstanceId: book.id,
      baselineSourceId: null,
      pdfPage: 18 + index,
      printedPage: null,
      bbox: null,
      blockId: null,
      figureId: null,
      verification: {
        state: 'machine_matched',
        actorKind: 'ai_static_reviewer',
        checkedAt: '2026-10-02T00:00:00Z',
        notes: 'synthetic T07 source fixture (no textbook text or image)',
      },
    }),
  );
  const catalogue = createSourceCatalog({ bookInstances: [book], sourceRefs: refs });
  if (!catalogue.ok) {
    throw new Error(`source catalogue fixture rejected: ${catalogue.issues[0]?.message ?? 'unknown'}`);
  }
  const knowledge = new KnowledgeService({ sources: catalogue.value });
  const registered = knowledge.registerPack(pack);
  if (!registered.ok) {
    throw new Error(`pack fixture rejected: ${registered.issues[0]?.message ?? 'unknown'}`);
  }
  return { knowledge, pack };
}

/* ---------------------------------------------------------------- clock/ids */

export interface FixedClock extends Clock {
  advance(ms: number): void;
  set(iso: Timestamp): void;
}

export function createFixedClock(start: Timestamp = FIXED_NOW): FixedClock {
  let current = Date.parse(start);
  return {
    now() {
      return new Date(current).toISOString().replace(/\.\d{3}Z$/, 'Z');
    },
    advance(ms: number) {
      current += ms;
    },
    set(iso: Timestamp) {
      current = Date.parse(iso);
    },
  };
}

export function createSequentialIds(): IdGenerator {
  let counter = 0;
  return {
    next(prefix: string) {
      counter += 1;
      return `${prefix}.t07.${counter}`;
    },
  };
}

export function requestContext(
  requestId: string,
  options: { readonly learnerId?: Id; readonly now?: Timestamp } = {},
): RequestContext {
  return {
    requestId,
    learnerId: options.learnerId ?? LEARNER_ID,
    now: options.now ?? FIXED_NOW,
  };
}

/* -------------------------------------------------------------- fake learner */

function emptyProgress(conceptId: Id, packVersion = PACK_KEY.packVersion): ConceptProgress {
  return {
    schemaVersion: 1,
    learnerId: LEARNER_ID,
    courseEditionId: PACK_KEY.courseEditionId,
    packVersion,
    conceptId,
    learning: { state: 'not_started', startedAt: null, lastCompletedAt: null },
    understanding: { state: 'unassessed', assessmentId: null, updatedAt: null, validity: 'current' },
    review: {
      lastCompletedAt: null,
      dueAt: null,
      activeSessionId: null,
      latestOutcome: null,
      policyVersion: 'review-policy-v1',
    },
    lastPosition: { sessionId: null, activityId: null, cursor: null, updatedAt: null },
    revision: 0,
  };
}

type RecordedCall = { readonly name: string; readonly args: unknown };

/**
 * In-memory implementation of the exact learner subset the tutor depends on.
 * It records every call and keeps a minimal three-axis projection so the
 * service's flow (persist → record → review) can be asserted.
 */
export class FakeLearner implements TutorLearnerPort {
  readonly calls: RecordedCall[] = [];
  /** When set, completeReview returns this error (F4 error-mapping tests). */
  completeReviewError: ServiceError | null = null;
  readonly attempts = new Map<Id, ActivityAttempt>();
  readonly evidence: Evidence[] = [];
  readonly committed: Evidence[] = [];
  readonly cancelledAttempts: { attemptId: Id; cancelled: boolean; reason: string }[] = [];
  private readonly requestSeqs = new Map<string, number>();
  private readonly progress = new Map<Id, ConceptProgress>();
  private readonly sessions = new Map<Id, Session>();
  private seq = 0;
  private evidenceByAttempt = 0;

  count(name: string): number {
    return this.calls.filter((call) => call.name === name).length;
  }

  lastCall(name: string): RecordedCall | undefined {
    return [...this.calls].reverse().find((call) => call.name === name);
  }

  progressOf(conceptId: Id): ConceptProgress {
    return this.progress.get(conceptId) ?? emptyProgress(conceptId);
  }

  private record(name: string, args: unknown): void {
    this.calls.push({ name, args });
  }

  private nextSeq(): number {
    this.seq += 1;
    return this.seq;
  }

  private setProgress(progress: ConceptProgress): void {
    this.progress.set(progress.conceptId, progress);
  }

  async startSession(
    ctx: RequestContext,
    session: Session,
  ): Promise<ServiceResult<{ sessionId: Id; duplicate: boolean; seq: number }>> {
    this.record('startSession', { ctx, session });
    if (session.learnerId !== LEARNER_ID) {
      return errResult('UNAUTHORIZED', 'session belongs to another learner');
    }
    const prior = this.requestSeqs.get(ctx.requestId);
    if (prior !== undefined) return okResult({ sessionId: session.id, duplicate: true, seq: prior }, prior);
    const seq = this.nextSeq();
    this.requestSeqs.set(ctx.requestId, seq);
    this.sessions.set(session.id, session);
    const current = this.progressOf(session.conceptId);
    if (current.learning.state === 'not_started') {
      this.setProgress({
        ...current,
        learning: { ...current.learning, state: 'in_progress', startedAt: session.startedAt },
        lastPosition: {
          sessionId: session.id,
          activityId: session.resumeCursor.activityId,
          cursor: null,
          updatedAt: session.startedAt,
        },
        revision: current.revision + 1,
      });
    }
    return okResult({ sessionId: session.id, duplicate: false, seq }, seq);
  }

  async endSession(
    ctx: RequestContext,
    request: { readonly sessionId: Id; readonly status: 'completed' | 'abandoned'; readonly endedAt: Timestamp },
  ): Promise<ServiceResult<{ sessionId: Id; duplicate: boolean }>> {
    this.record('endSession', { ctx, request });
    const session = this.sessions.get(request.sessionId);
    if (session === undefined) return errResult('NOT_FOUND', `no session ${request.sessionId}`);
    this.sessions.set(request.sessionId, { ...session, status: request.status, endedAt: request.endedAt });
    return okResult({ sessionId: request.sessionId, duplicate: this.requestSeqs.has(ctx.requestId) }, 0);
  }

  async submitAttempt(
    ctx: RequestContext,
    attempt: ActivityAttempt,
  ): Promise<ServiceResult<SubmitAttemptResult>> {
    this.record('submitAttempt', { ctx, attempt });
    const prior = this.attempts.get(attempt.id);
    if (prior !== undefined) {
      return okResult(
        { attemptId: attempt.id, seq: this.requestSeqs.get(ctx.requestId) ?? 0, duplicate: true },
        0,
      );
    }
    const seq = this.nextSeq();
    this.requestSeqs.set(ctx.requestId, seq);
    this.attempts.set(attempt.id, attempt);
    return okResult({ attemptId: attempt.id, seq, duplicate: false }, seq);
  }

  async recordGradedAttempt(
    ctx: RequestContext,
    request: {
      readonly attemptId: Id;
      readonly evidence: readonly Evidence[];
      readonly rubricVersion: string;
      readonly evaluatorVersion: string;
      readonly coreMisconceptionEvidenceIds?: readonly Id[];
    },
  ): Promise<ServiceResult<readonly AssessmentOutcome[]>> {
    this.record('recordGradedAttempt', { ctx, request });
    const attempt = this.attempts.get(request.attemptId);
    if (attempt === undefined) return errResult('NOT_FOUND', `no saved attempt ${request.attemptId}`);
    this.evidence.push(...request.evidence);
    this.committed.push(...request.evidence);
    const byConcept = new Map<Id, Evidence[]>();
    for (const evidence of request.evidence) {
      const list = byConcept.get(evidence.conceptId) ?? [];
      list.push(evidence);
      byConcept.set(evidence.conceptId, list);
    }
    const outcomes: AssessmentOutcome[] = [];
    for (const [conceptId, evidence] of byConcept) {
      const allMet = evidence.every((item) => item.criterionResults.every((result) => result.result === 'met'));
      const anyNotMet = evidence.some((item) => item.criterionResults.some((result) => result.result === 'not_met'));
      const derivedState = allMet ? 'supported' : anyNotMet ? 'needs_support' : 'developing';
      const current = this.progressOf(conceptId);
      this.evidenceByAttempt += 1;
      const assessment: Assessment = {
        schemaVersion: 1,
        id: `assessment.t07.${this.evidenceByAttempt}`,
        attemptId: attempt.id,
        conceptId,
        learnerId: LEARNER_ID,
        courseEditionId: attempt.courseEditionId,
        packVersion: attempt.packVersion,
        state: derivedState,
        rationale: `fixture assessment for ${conceptId}`,
        evidenceIds: evidence.map((item) => item.id),
        rubricVersion: request.rubricVersion,
        evaluatorVersion: request.evaluatorVersion,
        assessedAt: ctx.now,
        validity: 'current',
        revision: current.revision + 1,
      };
      const updated: ConceptProgress = {
        ...current,
        understanding: {
          state: derivedState,
          assessmentId: assessment.id,
          updatedAt: ctx.now,
          validity: 'current',
        },
        lastPosition: {
          sessionId: attempt.sessionId,
          activityId: attempt.activityId,
          cursor: null,
          updatedAt: ctx.now,
        },
        revision: current.revision + 1,
      };
      this.setProgress(updated);
      outcomes.push({
        conceptId,
        kind: 'assessment',
        progress: updated,
        assessment,
        committedEvidenceIds: evidence.map((item) => item.id),
        pendingEvidenceIds: [],
        derivedState,
        rationale: [assessment.rationale],
        rubricVersion: request.rubricVersion,
        evaluatorVersion: request.evaluatorVersion,
        duplicate: false,
      });
    }
    return okResult(outcomes, this.seq);
  }

  async cancelAttemptGrading(
    ctx: RequestContext,
    request: {
      readonly attemptId: Id;
      readonly graderVersion: string;
      readonly revision: number;
      readonly reason: string;
      readonly cancelled: boolean;
    },
  ): Promise<ServiceResult<{ attemptId: Id; duplicate: boolean; phase: string }>> {
    this.record('cancelAttemptGrading', { ctx, request });
    this.cancelledAttempts.push({
      attemptId: request.attemptId,
      cancelled: request.cancelled,
      reason: request.reason,
    });
    return okResult(
      {
        attemptId: request.attemptId,
        duplicate: false,
        phase: request.cancelled ? 'assessment_cancelled' : 'assessment_failed',
      },
      0,
    );
  }

  async get(ctx: RequestContext, key: ProgressKey): Promise<ServiceResult<ConceptProgress>> {
    this.record('get', { ctx, key });
    if (key.learnerId !== LEARNER_ID) return errResult('UNAUTHORIZED', 'key belongs to another learner');
    return okResult(this.progressOf(key.conceptId), 0);
  }

  async list(
    ctx: RequestContext,
    key: {
      readonly learnerId: Id;
      readonly courseEditionId: Id;
      readonly packVersion: string;
      readonly conceptIds?: readonly Id[];
    },
  ): Promise<ServiceResult<readonly ConceptProgress[]>> {
    this.record('list', { ctx, key });
    if (key.learnerId !== LEARNER_ID) return errResult('UNAUTHORIZED', 'key belongs to another learner');
    const ids = key.conceptIds ?? [...this.progress.keys()];
    return okResult(ids.map((conceptId) => this.progressOf(conceptId)), 0);
  }

  async reviewQueue(
    ctx: RequestContext,
    request: { readonly now?: Timestamp; readonly limit?: number } = {},
  ): Promise<ServiceResult<readonly ReviewQueueItem[]>> {
    this.record('reviewQueue', { ctx, request });
    const now = request.now ?? ctx.now;
    const items: ReviewQueueItem[] = [];
    for (const progress of this.progress.values()) {
      const dueAt = progress.review.dueAt;
      if (dueAt === null || Date.parse(now) < Date.parse(dueAt)) continue;
      items.push({
        conceptId: progress.conceptId,
        courseEditionId: progress.courseEditionId,
        packVersion: progress.packVersion,
        dueAt,
        overdue: Date.parse(now) > Date.parse(dueAt),
        activeSessionId: progress.review.activeSessionId,
        latestOutcome: progress.review.latestOutcome,
        everReviewed: progress.review.lastCompletedAt !== null,
      });
    }
    return okResult(items.slice(0, request.limit ?? 50), 0);
  }

  async explain(
    ctx: RequestContext,
    key: { readonly conceptId: Id; readonly courseEditionId?: Id; readonly packVersion?: string },
  ): Promise<ServiceResult<UnderstandingExplanation>> {
    this.record('explain', { ctx, key });
    if (!this.progress.has(key.conceptId)) {
      return errResult('NOT_FOUND', `no progress for concept ${key.conceptId}`);
    }
    const progress = this.progressOf(key.conceptId);
    return okResult(
      {
        progress,
        state: progress.understanding.state,
        validity: progress.understanding.validity,
        assessmentId: progress.understanding.assessmentId,
        updatedAt: progress.understanding.updatedAt,
        rationale: '',
        rubricVersion: null,
        evaluatorVersion: null,
        assessedAt: null,
        evidence: this.evidence
          .filter((item) => item.conceptId === key.conceptId)
          .map((item) => ({
            evidenceId: item.id,
            attemptId: item.attemptId,
            kind: item.kind,
            observation: item.observation,
            criterionResults: item.criterionResults,
            assistance: item.assistance,
            answerDisclosed: false,
            coreMisconception: false,
            validity: item.validity,
            createdAt: item.createdAt,
          })),
        history: [],
        pendingEvidenceIds: [],
        counterEvidenceIds: [],
        stale: false,
        requiresRecheck: false,
        review: {
          dueAt: progress.review.dueAt,
          everReviewed: progress.review.lastCompletedAt !== null,
          isDue: progress.review.dueAt !== null && Date.parse(ctx.now) >= Date.parse(progress.review.dueAt),
        },
        historyInherited: false,
        trustMode: 'published',
        policyNote: 'fixture learner projection (T07 test double); not a real mastery claim',
      },
      0,
    );
  }

  async completeLearning(
    ctx: RequestContext,
    request: { readonly sessionId: Id; readonly conceptId: Id; readonly completedAt: Timestamp },
  ): Promise<ServiceResult<LearningCompletionResult>> {
    this.record('completeLearning', { ctx, request });
    const current = this.progressOf(request.conceptId);
    const dueAt = new Date(Date.parse(request.completedAt) + 24 * 60 * 60 * 1000)
      .toISOString()
      .replace(/\.\d{3}Z$/, 'Z');
    const progress: ConceptProgress = {
      ...current,
      learning: {
        state: 'completed',
        startedAt: current.learning.startedAt ?? request.completedAt,
        lastCompletedAt: request.completedAt,
      },
      review: { ...current.review, dueAt, activeSessionId: null },
      revision: current.revision + 1,
    };
    this.setProgress(progress);
    return okResult(
      { progress, dueAt, policyVersion: 'review-policy-v1', duplicate: false },
      progress.revision,
    );
  }

  async completeReview(
    ctx: RequestContext,
    request: {
      readonly sessionId: Id;
      readonly conceptId: Id;
      readonly completedAt: Timestamp;
      readonly outcome?: 'needs_support' | 'developing' | 'supported';
    },
  ): Promise<ServiceResult<ReviewCompletionResult>> {
    this.record('completeReview', { ctx, request });
    if (this.completeReviewError !== null) {
      return errResult(
        this.completeReviewError.code,
        this.completeReviewError.message,
        this.completeReviewError.retryable,
        this.completeReviewError.detailsRef,
      );
    }
    const current = this.progressOf(request.conceptId);
    const outcome = request.outcome ?? 'developing';
    const previousDueAt = current.review.dueAt;
    const dueAt = new Date(Date.parse(request.completedAt) + 3 * 24 * 60 * 60 * 1000)
      .toISOString()
      .replace(/\.\d{3}Z$/, 'Z');
    const progress: ConceptProgress = {
      ...current,
      review: {
        ...current.review,
        lastCompletedAt: request.completedAt,
        dueAt,
        latestOutcome: outcome,
        activeSessionId: null,
      },
      revision: current.revision + 1,
    };
    this.setProgress(progress);
    return okResult(
      {
        progress,
        dueAt,
        outcome,
        early: previousDueAt !== null && Date.parse(request.completedAt) < Date.parse(previousDueAt),
        previousDueAt,
        policyVersion: 'review-policy-v1',
        duplicate: false,
      },
      progress.revision,
    );
  }
}

/* ---------------------------------------------------------------- harness */

export interface HarnessOptions {
  readonly turns: readonly MockTurnStep[];
  readonly mode?: TutorMode;
  readonly conceptId?: Id;
  readonly activityId?: Id;
  readonly policy?: Partial<TutorPedagogyPolicy>;
  readonly learner?: FakeLearner;
  readonly clock?: FixedClock;
  readonly modelImage?: boolean;
  /** H-04: activity-level source declaration resolver (default true). */
  readonly sourceRequiredForActivity?: (activity: import('@edu/domain').Activity) => boolean;
}

export interface Harness {
  readonly service: TutorService;
  readonly learner: FakeLearner;
  readonly gateway: ReturnType<typeof createMockTutorGateway>;
  readonly clock: FixedClock;
  readonly ids: IdGenerator;
  readonly session: Session;
  readonly pack: ContentPack;
  readonly packKey: PackKey;
  ctx(requestId: string): RequestContext;
}

export async function startHarness(options: HarnessOptions): Promise<Harness> {
  const { knowledge, pack } = createKnowledgeHarness();
  const clock = options.clock ?? createFixedClock();
  const ids = createSequentialIds();
  const learner = options.learner ?? new FakeLearner();
  const gateway = createMockTutorGateway({
    turns: options.turns,
    model: options.modelImage === true ? { image: true } : undefined,
  });
  const service = createTutorService({
    content: knowledge,
    learner,
    gateway,
    clock,
    ids,
    learnerId: LEARNER_ID,
    packKey: PACK_KEY,
    ...(options.policy === undefined ? {} : { policy: { ...options.policy } as TutorPedagogyPolicy }),
    ...(options.sourceRequiredForActivity === undefined
      ? {}
      : { sourceRequiredForActivity: options.sourceRequiredForActivity }),
  });
  const started = await service.startSession(requestContext('session.t07.start'), {
    conceptId: options.conceptId ?? 'concept.cell',
    mode: options.mode ?? 'learn',
    ...(options.activityId === undefined ? {} : { activityId: options.activityId }),
  });
  if (!started.ok) {
    throw new Error(`could not start T07 harness session: ${started.error.code} ${started.error.message}`);
  }
  return {
    service,
    learner,
    gateway,
    clock,
    ids,
    session: started.data.session,
    pack,
    packKey: PACK_KEY,
    ctx(requestId: string) {
      return requestContext(requestId);
    },
  };
}

/* --------------------------------------------------------------- evidence */

export function makeCandidate(
  overrides: Partial<EvidenceCandidate> & {
    readonly criterionId?: Id;
    readonly result?: 'met' | 'not_met' | 'unclear';
  } = {},
): EvidenceCandidate {
  const { criterionId = 'criterion.cell.identify', result = 'met', ...rest } = overrides;
  return {
    conceptId: 'concept.cell',
    kind: 'explain',
    observation: 'synthetic T07 evidence observation (fixture, no textbook text)',
    criterionResults: [{ criterionId, result, note: null }],
    assistance: 'unassisted',
    sourceRefs: ['source.p18'],
    assessmentOrigin: 'model',
    modelRunId: 'mock-run-1',
    uncertainty: 0.2,
    ...rest,
  };
}

export function makeGrade(options: {
  readonly criteria: readonly { criterionId: Id; met: 'yes' | 'no' | 'unclear'; rationale?: string }[];
  readonly candidates?: readonly EvidenceCandidate[];
  readonly requiresClarification?: boolean;
}): MockTurnStep['grade'] {
  return {
    criteria: options.criteria.map((criterion) => ({
      criterionId: criterion.criterionId,
      met: criterion.met,
      rationale: criterion.rationale ?? 'scripted fixture rationale',
    })),
    feedback: 'scripted fixture feedback (mock, not a real model)',
    ...(options.candidates === undefined ? {} : {}),
    ...(options.requiresClarification === undefined
      ? {}
      : { requiresClarification: options.requiresClarification }),
  };
}

export function met(): MockTurnStep['grade'] {
  return makeGrade({ criteria: [{ criterionId: 'criterion.cell.identify', met: 'yes' }] });
}

export function notMet(): MockTurnStep['grade'] {
  return makeGrade({ criteria: [{ criterionId: 'criterion.cell.identify', met: 'no' }] });
}

export function unclear(): MockTurnStep['grade'] {
  return makeGrade({
    criteria: [{ criterionId: 'criterion.cell.identify', met: 'unclear' }],
    requiresClarification: true,
  });
}

export type { GradeResult, Evidence, HelpKind, LearnerService };
