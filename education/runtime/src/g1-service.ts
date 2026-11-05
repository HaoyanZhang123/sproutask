/**
 * T13 G1 facade over the real phase-B composition: the content pack snapshot from
 * content/biology-7a, real source catalog, real learner journal/projection and
 * real TutorService. Trust follows the pack status (published vs candidate); a
 * candidate pack keeps formal understanding unassessed.
 */

import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import type {
  Activity,
  ActivityAttempt,
  ContentPack,
  GradeResult,
  RequestContext,
  Rubric,
  Session,
} from '@edu/domain';
import { okResult, errResult, validateActivityAttempt, type ServiceError, type ServiceResult } from '@edu/domain';
import { guardEvidence } from '@edu/tutor';
import type { AssessmentOutcome } from '@edu/learner';
import {
  analyzeImageQuality,
  evaluateImageAnswer,
  IDENTITY_TRANSFORM,
  IMAGE_QUALITY_THRESHOLD_VERSION,
  type ImageMime,
  type VisionClient,
} from '@edu/visuals';
import type { EducationRuntimeComposition } from './runtime-composition.js';
import { trustModeFromPackStatus } from './runtime-composition.js';
import { isPartialTurnFailure } from './adapters/dsh-tutor.js';

/**
 * F7 wiring: the product image route grades with the real `@edu/visuals`
 * pipeline. The host supplies the key-backed vision client (the route never
 * invents a model route), and `imageAvailable` only drives the workspace
 * `imageFlow` capability flag.
 */
export interface G1ImageOptions {
  readonly visionClient?: () => VisionClient | null;
  readonly imageAvailable?: () => boolean;
  readonly modelName?: string;
}

function pngDimensions(bytes: Buffer): { width: number; height: number } | null {
  if (bytes.length < 24) return null;
  const signature = bytes.subarray(0, 8).toString('hex');
  if (signature !== '89504e470d0a1a0a') return null;
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
}

/**
 * Deterministic expected answer for the activity the image belongs to. A choice
 * activity knows its correct labels, a diagram task knows its target labels;
 * everything else stays null so the model only transcribes and asks instead of
 * inventing a verdict.
 */
function expectedAnswerFor(
  activity: Activity,
  _rubric: Rubric,
): { readonly text: string | null; readonly source: string } {
  const schema = activity.answerSchema;
  if (schema.kind === 'choice') {
    const correct = new Set(schema.correctOptionIds ?? []);
    const labels = schema.options
      .filter((option) => correct.has(option.id))
      .map((option) => option.label.trim())
      .filter((label) => label.length > 0);
    if (labels.length > 0) {
      return { text: labels.join('；'), source: 'activity.answerSchema.correctOptionIds' };
    }
  }
  if (schema.kind === 'diagram_label') {
    const labels = schema.targets.map((target) => target.label.trim()).filter((label) => label.length > 0);
    if (labels.length > 0) {
      return { text: labels.join('；'), source: 'activity.answerSchema.targets' };
    }
  }
  return { text: null, source: 'none' };
}

/** Map the visuals taxonomy onto the frozen service error codes. */
function imageServiceError(error: { readonly code: string; readonly message?: string; readonly retryable?: boolean }): {
  readonly code: ServiceError['code'];
  readonly message: string;
  readonly retryable: boolean;
} {
  const message = error.message ?? '图片判分失败，请稍后重试。';
  const retryable = error.retryable ?? false;
  switch (error.code) {
    case 'VISION_QUOTA_EXCEEDED':
      return { code: 'QUOTA_EXCEEDED', message, retryable: true };
    case 'VISION_TIMEOUT':
      return { code: 'TIMEOUT', message, retryable: true };
    case 'VISION_AUTH_FAILED':
    case 'VISION_NETWORK_FAILED':
    case 'VISION_RESPONSE_INVALID':
    case 'VISION_UNAVAILABLE':
      return { code: 'UNAVAILABLE', message, retryable };
    case 'RUBRIC_MISMATCH':
      return { code: 'CONTRACT_REJECTED', message, retryable: false };
    case 'ASSET_INVALID':
    case 'ASSET_TOO_LARGE':
    case 'ASSET_UNSUPPORTED_FORMAT':
      return { code: 'INVALID_INPUT', message, retryable };
    default:
      return { code: 'UNAVAILABLE', message, retryable };
  }
}

export interface G1Draft {
  readonly conceptId: string;
  readonly mode: 'learn' | 'review';
  readonly activityId: string;
  readonly answer: unknown;
  readonly savedAt: string;
}

interface JournalSession {
  readonly seq: number;
  readonly session: Session;
}

function readJson(file: string): Record<string, unknown> {
  return JSON.parse(readFileSync(file, 'utf8')) as Record<string, unknown>;
}

function failFrom<T>(result: { readonly ok: false; readonly error: ServiceError }): ServiceResult<T> {
  return { ok: false, error: result.error };
}

export class G1Service {
  private readonly localSessions = new Map<
    string,
    { conceptId: string; mode: 'learn' | 'review'; activityId: string | null }
  >();
  /**
   * Per-process cache of already-graded image attempts. Re-submitting the same
   * bytes (same deterministic attempt id) returns this record instead of
   * calling the model again; the journal idempotency key is the durable guard.
   */
  private readonly imageResults = new Map<string, Record<string, unknown>>();

  constructor(
    private readonly composition: EducationRuntimeComposition,
    private readonly workspaceRoot: string,
    private readonly imageOptions: G1ImageOptions = {},
  ) {}

  private imageCapability(): boolean {
    try {
      return this.imageOptions.imageAvailable?.() === true;
    } catch {
      return false;
    }
  }

  /**
   * Workspace image capability. The client only shows the image entry when this
   * is non-null, so it is derived from a real key-backed vision route — never a
   * constant. Selection/preview still happens in the client.
   */
  private imageFlow(): Record<string, unknown> | null {
    if (!this.imageCapability()) return null;
    return {
      stage: 'selected',
      asset: { assetId: 'asset.image.local.pending', width: 0, height: 0, mime: 'image/png', base64: null },
      recognition: null,
      revision: null,
      clarification: null,
      degradedMessage: null,
      injectionNotice: null,
    };
  }

  private ctx(requestId: string): RequestContext {
    return {
      requestId,
      learnerId: 'learner.local.default',
      now: this.composition.clock.now(),
    };
  }

  private async journalSessions(): Promise<{
    readonly sessions: readonly JournalSession[];
    readonly active: Session | null;
  }> {
    const ctx = this.ctx('g1.sessions');
    const latest = await this.composition.storage.latestSeq(ctx);
    const from = latest.ok ? Math.max(0, latest.data.lastSeq - 999) : 0;
    const slice = await this.composition.storage.readFrom(ctx, from, 1000);
    if (!slice.ok) return { sessions: [], active: null };
    const started = new Map<string, JournalSession>();
    const ended = new Map<string, { status: 'completed' | 'abandoned'; endedAt: string }>();
    for (const commit of slice.data.commits) {
      const payload = commit.payload as Record<string, unknown>;
      if (commit.type === 'session.started') {
        const session = payload['session'] as Session | undefined;
        if (session !== undefined && session !== null) {
          started.set(session.id, { seq: commit.seq, session });
        }
      }
      if (commit.type === 'session.ended') {
        const sessionId = payload['sessionId'];
        const status = payload['status'];
        const endedAt = payload['endedAt'];
        if (
          typeof sessionId === 'string' &&
          (status === 'completed' || status === 'abandoned') &&
          typeof endedAt === 'string'
        ) {
          ended.set(sessionId, { status, endedAt });
        }
      }
    }
    const sessions = [...started.values()]
      .map((entry) => {
        const end = ended.get(entry.session.id);
        return end === undefined
          ? entry
          : {
              seq: entry.seq,
              session: { ...entry.session, status: end.status, endedAt: end.endedAt },
            };
      })
      .sort((left, right) => left.seq - right.seq);
    const active =
      [...sessions]
        .reverse()
        .find((entry) => entry.session.status === 'active')?.session ?? null;
    return { sessions, active };
  }

  private async latestDraft(conceptId?: string, mode?: 'learn' | 'review'): Promise<G1Draft | null> {
    const slice = await this.composition.storage.readFrom(this.ctx('g1.draft.latest'), 0, 1000);
    if (!slice.ok) return null;
    let latest: G1Draft | null = null;
    for (const commit of slice.data.commits) {
      if (commit.type !== 'draft.saved') continue;
      const draft = (commit.payload as Record<string, unknown>)['draft'] as G1Draft | undefined;
      if (draft === undefined) continue;
      if (conceptId !== undefined && draft.conceptId !== conceptId) continue;
      if (mode !== undefined && draft.mode !== mode) continue;
      latest = draft;
    }
    return latest;
  }

  library(): ServiceResult<Record<string, unknown>> {
    try {
      const edition = readJson(
        path.join(this.workspaceRoot, 'content', 'biology-7a', 'source', 'course-edition.json'),
      );
      const book = edition['bookInstance'] as Record<string, unknown>;
      const metadata = book['confirmedMetadata'] as Record<string, unknown>;
      return okResult(
        {
          id: String(book['id']),
          title: String(metadata['title'] ?? 'Biology grade 7'),
          publisher: String(metadata['publisher'] ?? ''),
          editionLabel: String(metadata['editionLabel'] ?? ''),
          pageCount: Number(book['pageCount']),
          sha256: String(book['originalSha256']),
          materialState: 'candidate',
          // No pack fetch on this synchronous path: use the snapshot the
          // composition loaded at startup (same pack.json), never a constant.
          trustMode: this.composition.trustMode,
          scope: 'full_volume',
          coverageStatus: 'complete',
          notice: 'Candidate trial: progress and drafts are recorded, formal understanding stays unassessed.',
        },
        1,
      );
    } catch (error) {
      return errResult('STORAGE_FAILED', `book metadata failed: ${(error as Error).message}`, false);
    }
  }

  async source(sourceRefId: string): Promise<ServiceResult<Record<string, unknown>>> {
    const ctx = this.ctx('g1.source');
    const resolved = await this.composition.content.resolveSource(ctx, sourceRefId);
    if (!resolved.ok) return resolved;
    const book = this.library();
    const library = book.ok ? book.data : {};
    return okResult(
      {
        bookTitle: String(library['title'] ?? 'Biology grade 7'),
        editionLabel: String(library['editionLabel'] ?? ''),
        pageCount: Number(library['pageCount'] ?? 0),
        bookSha256: String(library['sha256'] ?? ''),
        sourceRef: resolved.data.sourceRef,
        block: null,
        figure: null,
        pageImage: null,
        candidate: true,
      },
      1,
    );
  }

  async sourceSummaries(): Promise<ServiceResult<readonly Record<string, unknown>[]>> {
    const ctx = this.ctx('g1.sources');
    const pack = await this.composition.knowledge.getPack(ctx, this.composition.packKey);
    if (!pack.ok) return pack;
    const ids = [...new Set(pack.data.concepts.flatMap((concept) => concept.sourceRefs))];
    const items: Record<string, unknown>[] = [];
    for (const sourceRefId of ids.slice(0, 30)) {
      const resolved = await this.composition.content.resolveSource(ctx, sourceRefId);
      if (!resolved.ok) continue;
      const ref = resolved.data.sourceRef;
      items.push({
        sourceRefId,
        pdfPage: resolved.data.pdfPage,
        printedPage: resolved.data.printedPage,
        label: `source ${ref.blockId !== null ? 'block' : ref.figureId !== null ? 'figure' : 'page'} - PDF page ${String(resolved.data.pdfPage)}`,
        kind: ref.blockId !== null ? 'block' : ref.figureId !== null ? 'figure' : 'page',
        reviewState: 'candidate',
        verification: ref.verification.state,
        candidate: true,
      });
    }
    return okResult(items, pack.revision);
  }

  async map(): Promise<ServiceResult<Record<string, unknown>>> {
    const ctx = this.ctx('g1.map');
    const pack = await this.composition.knowledge.getPack(ctx, this.composition.packKey);
    if (!pack.ok) return pack;
    const progress = await this.composition.learner.list(ctx, {
      learnerId: 'learner.local.default',
      courseEditionId: this.composition.packKey.courseEditionId,
      packVersion: this.composition.packKey.packVersion,
    });
    const replay = this.composition.storage.replay('learner.local.default');
    // The map detail shows "出处与材料"; before this it always said "还没有登记
    // 出处" because the payload carried an empty source catalogue while every
    // concept already had resolvable sourceRefs.
    const catalogueRefs = [
      ...new Set([
        ...pack.data.concepts.flatMap((concept) => concept.sourceRefs),
        ...pack.data.toc.flatMap((node) => node.sourceRefs),
      ]),
    ];
    const sources: Record<string, unknown>[] = [];
    for (const sourceRefId of catalogueRefs) {
      const resolved = await this.composition.content.resolveSource(ctx, sourceRefId);
      if (!resolved.ok) continue;
      const ref = resolved.data.sourceRef;
      const printed = resolved.data.printedPage === null ? '' : String(resolved.data.printedPage).trim();
      sources.push({
        sourceRefId,
        pdfPage: resolved.data.pdfPage,
        printedPage: resolved.data.printedPage,
        label: printed.length > 0 ? `课本第 ${printed} 页` : `PDF 第 ${String(resolved.data.pdfPage)} 页`,
        bookAvailable: true,
        verification: ref.verification.state,
      });
    }
    return okResult(
      {
        courseEditionId: pack.data.courseEditionId,
        courseEditionLabel: 'Biology grade 7',
        packId: pack.data.id,
        packVersion: pack.data.version,
        trustMode: trustModeFromPackStatus(pack.data.status),
        scope: pack.data.scope,
        coverageStatus: pack.data.coverageStatus,
        toc: pack.data.toc,
        concepts: pack.data.concepts,
        relations: pack.data.relations,
        progress: progress.ok ? progress.data : [],
        selfReports: replay.selfReports,
        evidence: replay.evidence,
        sources,
        initialTocNodeId: pack.data.toc.find((node) => node.type === 'section')?.id ?? null,
        initialConceptId: pack.data.concepts[0]?.id ?? null,
        fixture: false,
        notice: null,
      },
      pack.revision,
    );
  }

  async study(
    conceptId: string,
    activityId?: string | null,
  ): Promise<ServiceResult<Record<string, unknown>>> {
    const ctx = this.ctx('g1.study');
    const pack = await this.composition.knowledge.getPack(ctx, this.composition.packKey);
    if (!pack.ok) return pack;
    const concept = pack.data.concepts.find((entry) => entry.id === conceptId);
    if (concept === undefined) return errResult('NOT_FOUND', 'concept is not in this pack', false);
    const activities = pack.data.activities.filter((activity) =>
      activity.conceptIds.includes(conceptId),
    );
    // 「下一题 / 跳过」靠 activityId 指定要打开哪道题；之前这里恒取 activities[0]，
    // 真机上点下一题就永远停在第 1 题。找不到就退回第一题，不让页面挂掉。
    const requested =
      typeof activityId === 'string' && activityId.length > 0
        ? activities.find((activity) => activity.id === activityId) ?? null
        : null;
    const currentActivity = requested ?? activities[0] ?? null;
    const rubricIds = new Set(concept.rubricIds);
    const rubrics = pack.data.rubrics.filter((rubric) => rubricIds.has(rubric.id));
    const progress = await this.composition.learner.get(ctx, {
      learnerId: 'learner.local.default',
      courseEditionId: this.composition.packKey.courseEditionId,
      packVersion: this.composition.packKey.packVersion,
      conceptId,
    });
    const replay = this.composition.storage.replay('learner.local.default');
    const sources = [];
    for (const sourceRefId of concept.sourceRefs) {
      const resolved = await this.composition.content.resolveSource(ctx, sourceRefId);
      if (!resolved.ok) continue;
      sources.push({
        sourceRefId,
        pdfPage: resolved.data.pdfPage,
        printedPage: resolved.data.printedPage,
        label: `source block - PDF page ${String(resolved.data.pdfPage)}`,
        verification: resolved.data.sourceRef.verification.state,
      });
    }
    return okResult(
      {
        courseEditionId: pack.data.courseEditionId,
        courseEditionLabel: 'Biology grade 7',
        packId: pack.data.id,
        packVersion: pack.data.version,
        trustMode: trustModeFromPackStatus(pack.data.status),
        scope: pack.data.scope,
        coverageStatus: pack.data.coverageStatus,
        concept,
        activities,
        activity: currentActivity,
        rubrics,
        progress: progress.ok ? progress.data : null,
        selfReport:
          replay.selfReports.find((report) => report.conceptId === conceptId) ?? null,
        sources,
        reviewRange: null,
        compatibility: null,
        imageFlow: this.imageFlow(),
        fixture: false,
        notice: null,
      },
      pack.revision,
    );
  }

  async snapshot(): Promise<ServiceResult<Record<string, unknown>>> {
    const now = this.composition.clock.now();
    try {
      const edition = readJson(
        path.join(this.workspaceRoot, 'content', 'biology-7a', 'source', 'course-edition.json'),
      );
      const courseEdition = edition['courseEdition'] as Record<string, unknown>;
      const book = edition['bookInstance'] as Record<string, unknown>;
      const pack = await this.composition.knowledge.getPack(this.ctx('g1.snapshot'), this.composition.packKey);
      // The pack block reports the trust of the fetched snapshot. `getPack` can
      // only fail here if the composition itself lost its registered pack; in
      // that defensive branch there is no snapshot to derive from, so the safe
      // `candidate` default is kept instead of guessing `published`.
      const packStatus = pack.ok ? pack.data.status : 'candidate';
      return okResult(
        {
          learner: { schemaVersion: 1, id: 'learner.local.default', createdAt: now },
          courseEdition,
          pack: {
            id: 'pack.biology-7a.observation',
            version: '2.0.0',
            scope: 'full_volume',
            coverageStatus: 'complete',
            status: packStatus,
            trustMode: trustModeFromPackStatus(packStatus),
            contentHash: String(book['originalSha256'] ?? ''),
            courseEditionId: String(courseEdition['id']),
          },
          concepts: pack.ok ? pack.data.concepts : [],
          auth: {
            account: { method: 'account', status: 'unavailable', lastCheckedAt: null, accountRef: null },
            apiKey: { method: 'api_key', status: 'available', lastCheckedAt: now, accountRef: null },
          },
          capabilities: {
            dsh: { bound: true, version: '0.2.1-rc.3', sourceRef: 'docs/rebuild/runtime-lock.json#source' },
            model: { text: true, image: (process.env['DEEPSEEK_API_KEY'] ?? '').length > 0 },
            tools: this.composition.tools.names,
            network: 'loopback_only',
          },
          fixture: false,
          notice: null,
        },
        1,
      );
    } catch (error) {
      return errResult('STORAGE_FAILED', `snapshot failed: ${(error as Error).message}`, false);
    }
  }

  /**
   * Synthesize the active session from the learner projection. `trustMode` is
   * passed in from the pack snapshot the caller loaded (see `home`/`resume`),
   * because a projection row does not carry the pack status.
   */
  private sessionFromProgress(
    progress: {
      readonly conceptId: string;
      readonly courseEditionId: string;
      readonly packVersion: string;
      readonly lastPosition: {
        readonly sessionId: string | null;
        readonly activityId: string | null;
        readonly cursor: string | null;
        readonly updatedAt: string | null;
      };
    },
    trustMode: 'candidate' | 'published',
  ): Session | null {
    if (progress.lastPosition.sessionId === null) return null;
    return {
      schemaVersion: 1,
      id: progress.lastPosition.sessionId,
      learnerId: 'learner.local.default',
      courseEditionId: progress.courseEditionId,
      packVersion: progress.packVersion,
      trustMode,
      conceptId: progress.conceptId,
      mode: 'learn',
      status: 'active',
      startedAt: progress.lastPosition.updatedAt ?? this.composition.clock.now(),
      endedAt: null,
      resumeCursor: {
        activityId: progress.lastPosition.activityId,
        cursor: progress.lastPosition.cursor,
      },
      dshSessionId: null,
    };
  }

  async home(): Promise<ServiceResult<Record<string, unknown>>> {
    const ctx = this.ctx('g1.home');
    const progress = await this.composition.learner.list(ctx, {
      learnerId: 'learner.local.default',
      courseEditionId: this.composition.packKey.courseEditionId,
      packVersion: this.composition.packKey.packVersion,
    });
    const pack = await this.composition.knowledge.getPack(ctx, this.composition.packKey);
    // Session trust follows the pack snapshot fetched above; if it is somehow
    // unreadable there is no snapshot, so the safe `candidate` default stands.
    const packTrust = pack.ok ? trustModeFromPackStatus(pack.data.status) : ('candidate' as const);
    const list = progress.ok ? progress.data : [];
    const journal = await this.journalSessions();
    const latestPosition = [...list]
      .filter((entry) => entry.lastPosition.sessionId !== null)
      .sort((left, right) =>
        String(right.lastPosition.updatedAt).localeCompare(String(left.lastPosition.updatedAt)),
      )[0];
    const activeSession =
      journal.active ??
      (latestPosition === undefined ? null : this.sessionFromProgress(latestPosition, packTrust));
    const lastCompleted =
      [...journal.sessions]
        .reverse()
        .find((entry) => entry.session.status === 'completed')?.session ?? null;
    return okResult(
      {
        now: ctx.now,
        activeSession,
        lastCompletedSession: lastCompleted,
        progress: list,
        dueReviews: [],
        totalConcepts: pack.ok ? pack.data.concepts.length : 0,
        learnedConceptCount: list.filter((entry) => entry.learning.state !== 'not_started').length,
        firstRun: list.length === 0,
        compatibility: null,
      },
      progress.ok ? progress.revision : 0,
    );
  }

  async resumeSession(sessionId: string): Promise<ServiceResult<Record<string, unknown>>> {
    const ctx = this.ctx('g1.resume');
    const pack = await this.composition.knowledge.getPack(ctx, this.composition.packKey);
    if (!pack.ok) return pack;
    // A projection row has no trust field, so a synthesized session takes the
    // trust of the pack snapshot fetched above. An explicit journal session
    // keeps the trust it recorded when it started.
    const packTrust = trustModeFromPackStatus(pack.data.status);
    const journal = await this.journalSessions();
    let entry = journal.sessions.find((candidate) => candidate.session.id === sessionId);
    if (entry === undefined) {
      const listed = await this.composition.learner.list(ctx, {
        learnerId: 'learner.local.default',
        courseEditionId: this.composition.packKey.courseEditionId,
        packVersion: this.composition.packKey.packVersion,
      });
      const progress = listed.ok
        ? listed.data.find((candidate) => candidate.lastPosition.sessionId === sessionId)
        : undefined;
      const synthesized =
        progress === undefined ? null : this.sessionFromProgress(progress, packTrust);
      if (synthesized === null) return errResult('NOT_FOUND', '没有可继续的活动', false);
      entry = { seq: 0, session: synthesized };
    }
    const concept = pack.data.concepts.find((candidate) => candidate.id === entry.session.conceptId);
    const draftMode =
      entry.session.mode === 'review' ? 'review' : entry.session.mode === 'learn' ? 'learn' : undefined;
    const draft = await this.latestDraft(entry.session.conceptId, draftMode);
    const resumedSession: Session = {
      ...entry.session,
      id: `session.resume.${String(Date.now())}`,
      status: 'active',
      startedAt: ctx.now,
      endedAt: null,
      dshSessionId: null,
    };
    return okResult(
      {
        session: resumedSession,
        conceptTitle: concept?.title ?? entry.session.conceptId,
        courseEditionTitle: 'Biology grade 7',
        activityId: draft?.activityId ?? entry.session.resumeCursor.activityId ?? null,
        cursor: entry.session.resumeCursor.cursor ?? null,
        positionLabel: draft === null ? '上次学习位置' : '已恢复本机草稿',
        draftRestored: draft !== null,
        packVersion: entry.session.packVersion,
      },
      pack.revision,
    );
  }

  async records(): Promise<ServiceResult<Record<string, unknown>>> {
    const ctx = this.ctx('g1.records');
    const progress = await this.composition.learner.list(ctx, {
      learnerId: 'learner.local.default',
      courseEditionId: this.composition.packKey.courseEditionId,
      packVersion: this.composition.packKey.packVersion,
    });
    const replay = this.composition.storage.replay('learner.local.default');
    const journal = await this.journalSessions();
    return okResult(
      {
        now: ctx.now,
        progresses: progress.ok ? progress.data : [],
        sessions: journal.sessions.map((entry) => entry.session),
        evidence: replay.evidence,
        assessments: replay.assessments,
        selfReports: replay.selfReports,
        rangeClaim: null,
        saveState: 'saved',
      },
      progress.ok ? progress.revision : 0,
    );
  }

  async progress(conceptId: string): Promise<ServiceResult<unknown>> {
    return this.composition.learner.get(this.ctx('g1.progress'), {
      learnerId: 'learner.local.default',
      courseEditionId: this.composition.packKey.courseEditionId,
      packVersion: this.composition.packKey.packVersion,
      conceptId,
    });
  }

  async saveDraft(draft: G1Draft, requestId: string): Promise<ServiceResult<{ savedAt: string }>> {
    const ctx = this.ctx(requestId);
    const receipt = await this.composition.storage.append(ctx, {
      eventId: `event.draft.${String(Date.now())}`,
      requestId,
      occurredAt: ctx.now,
      learnerId: ctx.learnerId,
      type: 'draft.saved',
      payload: { draft },
      effects: [],
    });
    if (!receipt.ok) return failFrom(receipt);
    return okResult({ savedAt: ctx.now }, receipt.data.revision);
  }

  async loadDraft(key: {
    conceptId: string;
    mode: 'learn' | 'review';
    activityId: string;
  }): Promise<ServiceResult<G1Draft | null>> {
    const ctx = this.ctx('g1.draft.load');
    const slice = await this.composition.storage.readFrom(ctx, 0, 1000);
    if (!slice.ok) return slice;
    let latest: G1Draft | null = null;
    for (const commit of slice.data.commits) {
      if (commit.type !== 'draft.saved') continue;
      const draft = commit.payload['draft'] as G1Draft | undefined;
      if (
        draft !== undefined &&
        draft.conceptId === key.conceptId &&
        draft.mode === key.mode &&
        draft.activityId === key.activityId
      ) {
        latest = draft;
      }
    }
    return okResult(latest, slice.revision);
  }

  async clearDraft(key: {
    conceptId: string;
    mode: 'learn' | 'review';
    activityId: string;
  }): Promise<ServiceResult<{ cleared: true }>> {
    const ctx = this.ctx('g1.draft.clear');
    const receipt = await this.composition.storage.append(ctx, {
      eventId: `event.draft.cleared.${String(Date.now())}`,
      requestId: `g1.draft.clear.${String(Date.now())}`,
      occurredAt: ctx.now,
      learnerId: ctx.learnerId,
      type: 'draft.cleared',
      payload: { key },
      effects: [],
    });
    if (!receipt.ok) return failFrom(receipt);
    return okResult({ cleared: true }, receipt.data.revision);
  }

  async saveSelfReport(
    conceptId: string,
    claimedState: 'uncertain' | 'basically_understood' | 'can_explain',
    requestId: string,
  ): Promise<ServiceResult<{ recorded: true; understanding: 'unassessed' }>> {
    const ctx = this.ctx(requestId);
    const report = {
      schemaVersion: 1,
      id: `self-report.${String(Date.now())}`,
      learnerId: ctx.learnerId,
      courseEditionId: this.composition.packKey.courseEditionId,
      packVersion: this.composition.packKey.packVersion,
      conceptId,
      claimedState,
      createdAt: ctx.now,
    };
    const receipt = await this.composition.storage.append(ctx, {
      eventId: `event.self-report.${String(Date.now())}`,
      requestId,
      occurredAt: ctx.now,
      learnerId: ctx.learnerId,
      type: 'self_report.recorded',
      payload: { selfReport: report },
      effects: [],
    });
    if (!receipt.ok) return failFrom(receipt);
    return okResult(
      { ...report, recorded: true, understanding: 'unassessed' },
      receipt.data.revision,
    );
  }

  async startTutor(
    requestId: string,
    input: { conceptId: string; mode: 'learn' | 'review'; activityId?: string | null; sessionId?: string },
  ): Promise<ServiceResult<unknown>> {
    let effective = input;
    // 「继续上次」会把一个已经开过的 session id 再传回来。直接用它去 create，
    // DSH 会走恢复路径：实测能卡 ~60s 再抛 TypeError，最后才靠重试换新 id。
    // 这里先用 resume 语义换一个全新的 id（概念/模式/活动沿用原会话），
    // 避免任何一次打开学习台先等一分钟。
    if (typeof input.sessionId === 'string' && input.sessionId.length > 0) {
      const journal = await this.journalSessions();
      const known = journal.sessions.some((entry) => entry.session.id === input.sessionId);
      if (known) {
        const resumed = await this.resumeSession(input.sessionId);
        if (resumed.ok) {
          const data = resumed.data as {
            readonly session?: { readonly id?: string; readonly conceptId?: string; readonly mode?: 'learn' | 'review' };
            readonly activityId?: string | null;
          };
          const session = data.session;
          if (
            typeof session?.id === 'string' &&
            typeof session.conceptId === 'string' &&
            (session.mode === 'learn' || session.mode === 'review')
          ) {
            effective = {
              conceptId: session.conceptId,
              mode: session.mode,
              activityId: input.activityId ?? data.activityId ?? null,
              sessionId: session.id,
            };
            this.composition.audit?.({
              kind: 'session.rebound',
              at: this.ctx(requestId).now,
              from: input.sessionId,
              to: session.id,
            });
          }
        }
      }
    }
    const started = await this.composition.tutor.startSession(this.ctx(requestId), effective);
    if (started.ok) {
      const sessionId = (started.data as { session?: { id?: string } }).session?.id;
      if (typeof sessionId === 'string') {
        this.localSessions.set(sessionId, {
          conceptId: effective.conceptId,
          mode: effective.mode,
          activityId: effective.activityId ?? null,
        });
      }
    }
    return started;
  }

  async tutorTurn(requestId: string, input: Record<string, unknown>): Promise<ServiceResult<unknown>> {
    let real: ServiceResult<unknown>;
    try {
      real = await this.composition.tutor.submitTurn(this.ctx(requestId), input as never);
    } catch (error) {
      this.composition.audit?.({
        kind: 'tutor.turn.threw',
        requestId,
        sessionId: typeof input['sessionId'] === 'string' ? input['sessionId'] : null,
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? (error.stack ?? null) : null,
      });
      return this.localRuleTurn(requestId, input);
    }
    if (real.ok) return real;
    if (isPartialTurnFailure(real.error.message)) {
      // S5 fix: a turn that hit its budget or ended without text already holds
      // real evidence (tool names, resolved source refs, PDF pages). Returning
      // the structured error keeps that evidence visible and retryable; silently
      // swapping in the local rule grader would report 0 anchors and hide the
      // partial result behind an unrelated "local" answer.
      this.composition.audit?.({
        kind: 'tutor.turn.unavailable',
        requestId,
        sessionId: typeof input['sessionId'] === 'string' ? input['sessionId'] : null,
        code: real.error.code,
        message: real.error.message,
        detailsRef: real.error.detailsRef ?? null,
      });
      return real;
    }
    if (
      ['UNAVAILABLE', 'NETWORK', 'TIMEOUT', 'TRANSPORT', 'SERVER', 'INVALID_INPUT'].includes(real.error.code)
    ) {
      // The local fallback is silent to the student; keep the *reason* in the audit
      // log so "model transport unavailable" is diagnosable after the fact.
      this.composition.audit?.({
        kind: 'tutor.turn.local-fallback',
        requestId,
        sessionId: typeof input['sessionId'] === 'string' ? input['sessionId'] : null,
        code: real.error.code,
        message: real.error.message,
        detailsRef: real.error.detailsRef ?? null,
      });
      return this.localRuleTurn(requestId, input);
    }
    return real;
  }

  /**
   * Product fallback when the DSH web carrier cannot complete a model turn.
   * It never pretends to be a model: it grades with the deterministic
   * `@edu/visuals` rule grader and returns a clearly local outcome. The model
   * route remains the primary path; the fallback keeps local practice usable.
   */
  private async localRuleTurn(
    requestId: string,
    input: Record<string, unknown>,
  ): Promise<ServiceResult<unknown>> {
    const ctx = this.ctx(requestId);
    const sessionId = typeof input['sessionId'] === 'string' ? input['sessionId'] : '';
    let session = this.localSessions.get(sessionId);
    if (session === undefined) {
      const fallbackAttempt = input['attempt'] as { activityId?: string } | null | undefined;
      session = {
        conceptId: '',
        mode: 'learn',
        activityId: fallbackAttempt?.activityId ?? null,
      };
    }
    const pack = await this.composition.knowledge.getPack(ctx, this.composition.packKey);
    if (!pack.ok) return pack;
    const attemptInput = input['attempt'] as
      | { activityId?: string; inputType?: string; answerText?: string | null }
      | null
      | undefined;
    const helpRequest = typeof input['helpRequest'] === 'string' ? input['helpRequest'] : null;
    if (attemptInput === null || attemptInput === undefined) {
      const message =
        helpRequest === null
          ? '当前模型通道不可用；本地材料与规则批改仍可使用。请先阅读材料并提交答案。'
          : '当前模型通道不可用，无法生成新的解释；请先阅读材料，或用规则批改查看答案要点。';
      return okResult(
        {
          sessionId,
          revision: Number(input['revision'] ?? 0) + 1,
          mode: session.mode,
          message,
          decision: {
            action: 'local_fallback',
            rationale: 'model transport unavailable; local rule route',
            disclosure: false,
            guidance: message,
            difficulty: 'same',
            sourceRefs: [],
            reviewStage: null,
          },
          state: {
            revision: Number(input['revision'] ?? 0) + 1,
            consecutiveFailures: 0,
            difficulty: 'standard',
            currentActivityId: session.activityId,
            reviewStage: null,
            status: 'active',
            helpKinds: helpRequest === null ? [] : [helpRequest],
            disclosure: false,
          },
          attemptOutcome: null,
          events: [],
          gateway: 'local',
          model: { provider: 'local', model: 'rule-grader', text: true, image: false },
          toolResults: [],
          sourceCitation: { required: false, refs: [], missing: false },
          audit: [],
        },
        1,
      );
    }
    const activity = pack.data.activities.find(
      (entry) => entry.id === attemptInput.activityId,
    );
    if (activity === undefined) return errResult('NOT_FOUND', 'activity is not in this pack', false);
    const rubric = pack.data.rubrics.find((entry) => entry.id === activity.rubricId);
    if (rubric === undefined) return errResult('NOT_FOUND', 'rubric is not in this pack', false);
    const attempt = {
      schemaVersion: 1 as const,
      id: `attempt.local.${String(Date.now())}`,
      requestId,
      learnerId: ctx.learnerId,
      sessionId,
      courseEditionId: pack.data.courseEditionId,
      packVersion: pack.data.version,
      activityId: activity.id,
      activityVersion: activity.version,
      conceptIds: [...activity.conceptIds],
      inputType: (attemptInput.inputType ?? 'text') as never,
      answerAssetId: null,
      answerText: attemptInput.answerText ?? null,
      submittedAt: ctx.now,
      helpUsed: helpRequest === null ? [] : [helpRequest as never],
      evidenceIds: [],
    };
    const graded = await this.composition.grade.grade(ctx, {
      attempt: attempt as never,
      activity,
      rubric,
      mode: 'rule',
      modelRunId: null,
    });
    if (!graded.ok) return graded;
    const receipt = await this.composition.storage.append(ctx, {
      eventId: `event.attempt.local.${String(Date.now())}`,
      requestId,
      occurredAt: ctx.now,
      learnerId: ctx.learnerId,
      type: 'attempt.recorded',
      payload: { attempt, grade: graded.data, local: true },
      effects: [],
    });
    const message = graded.data.feedback;
    return okResult(
      {
        sessionId,
        revision: Number(input['revision'] ?? 0) + 1,
        mode: session.mode,
        message,
        decision: {
          action: 'feedback',
          rationale: 'deterministic rule grader; local fallback',
          disclosure: false,
          guidance: message,
          difficulty: 'same',
          sourceRefs: graded.data.sourceRefs,
          reviewStage: null,
        },
        state: {
          revision: Number(input['revision'] ?? 0) + 1,
          consecutiveFailures: graded.data.criteria.some((criterion) => criterion.met === 'no') ? 1 : 0,
          difficulty: 'standard',
          currentActivityId: activity.id,
          reviewStage: null,
          status: 'active',
          helpKinds: helpRequest === null ? [] : [helpRequest],
          disclosure: false,
        },
        attemptOutcome: {
          attempt,
          attemptId: attempt.id,
          persisted: receipt.ok,
          duplicate: false,
          grade: graded.data,
          outcomes: [],
          rejectedCandidates: [],
          feedbackPending: false,
          completedAt: ctx.now,
        },
        events: [],
        gateway: 'local',
        model: { provider: 'local', model: 'rule-grader', text: true, image: false },
        toolResults: [],
        sourceCitation: { required: false, refs: graded.data.sourceRefs, missing: false },
        audit: [],
      },
      receipt.ok ? receipt.data.revision : 1,
    );
  }

  async tutorSkip(requestId: string, input: Record<string, unknown>): Promise<ServiceResult<unknown>> {
    return this.composition.tutor.skip(this.ctx(requestId), input as never);
  }

  async tutorEnd(requestId: string, input: Record<string, unknown>): Promise<ServiceResult<unknown>> {
    return this.composition.tutor.end(this.ctx(requestId), input as never);
  }

  async tutorRetry(requestId: string, input: Record<string, unknown>): Promise<ServiceResult<unknown>> {
    return this.composition.tutor.retryPendingGrading(this.ctx(requestId), input as never);
  }

  async finishLearning(requestId: string, input: Record<string, unknown>): Promise<ServiceResult<unknown>> {
    return this.composition.tutor.finishLearning(this.ctx(requestId), input as never);
  }

  async finishReview(requestId: string, input: Record<string, unknown>): Promise<ServiceResult<unknown>> {
    return this.composition.tutor.finishReview(this.ctx(requestId), input as never);
  }

  async imageQuality(
    requestId: string,
    input: {
      readonly base64: string;
      readonly mime: string;
      readonly width: number;
      readonly height: number;
      readonly activityId?: string | null;
      /** Study session the client already started; the attempt is bound to it. */
      readonly sessionId?: string | null;
    },
  ): Promise<ServiceResult<Record<string, unknown>>> {
    const ctx = this.ctx(requestId);
    const pack = await this.composition.knowledge.getPack(ctx, this.composition.packKey);
    if (!pack.ok) return pack;
    const activity =
      (input.activityId === undefined || input.activityId === null
        ? undefined
        : pack.data.activities.find((entry) => entry.id === input.activityId)) ??
      pack.data.activities[0];
    if (activity === undefined) return errResult('NOT_FOUND', 'activity is not in this pack', false);
    const rubric = pack.data.rubrics.find((entry) => entry.id === activity.rubricId);
    if (rubric === undefined) return errResult('NOT_FOUND', 'rubric is not in this pack', false);
    const bytes = Buffer.from(input.base64, 'base64');
    const sha256 = createHash('sha256').update(bytes).digest('hex');
    const measured = pngDimensions(bytes);
    const width = input.width > 0 ? input.width : (measured?.width ?? 0);
    const height = input.height > 0 ? input.height : (measured?.height ?? 0);
    const assetId = `asset.image.${sha256.slice(0, 16)}`;
    const expected = expectedAnswerFor(activity, rubric);

    // Resolve only the refs this activity/rubric may cite; the gate then checks
    // every candidate source against the catalog (no invented pages).
    const allowedRefs = new Set<string>([
      ...activity.sourceRefs,
      ...rubric.criteria.flatMap((criterion) => [...criterion.feedbackSourceRefs]),
    ]);
    const resolvable = new Set<string>();
    for (const ref of allowedRefs) {
      const resolved = await this.composition.content.resolveSource(ctx, ref);
      if (resolved.ok) resolvable.add(ref);
    }

    const signal = analyzeImageQuality({
      base64: input.base64,
      mime: input.mime,
      width: input.width,
      height: input.height,
    });
    const thresholdVersion = IMAGE_QUALITY_THRESHOLD_VERSION;
    if (signal.status === 'unavailable') {
      return okResult(
        {
          stage: 'quality_unavailable',
          modelCalled: false,
          modelWouldBeCalled: false,
          qualitySignal: signal,
          threshold_version: thresholdVersion,
          requiresClarification: false,
          note: '图片质量探针不可用（仅支持 8-bit 非隔行 PNG）；未调用模型，也未产生证据。',
        },
        pack.revision,
      );
    }

    const client = this.imageOptions.visionClient?.() ?? null;
    // A forced quality clarification is still a real submission attempt, so it
    // is persisted as pending (never as a grade). With no model route and a
    // clear image there is nothing to record.
    const needsAttempt = signal.forcedClarification || client !== null;
    let session: Session | null = null;
    let attempt: ActivityAttempt | null = null;
    if (needsAttempt) {
      session = await this.imageSession(ctx, pack.data, activity, input.sessionId ?? null);
      if (session === null) {
        return errResult(
          'UNAVAILABLE',
          '图片判分需要先开始学习会话；请回到活动页重试，或改用文字作答。',
          true,
        );
      }
      attempt = this.buildImageAttempt({ session, pack: pack.data, activity, assetId, sha256 });
      if (attempt === null) {
        return errResult('INVALID_INPUT', '图片作答记录不符合契约，未写入任何记录。', false);
      }
      const saved = await this.composition.learner.submitAttempt(
        { ...ctx, requestId: attempt.requestId },
        attempt,
      );
      if (!saved.ok) return failFrom(saved);
      if (saved.data.duplicate) {
        return this.duplicateImageResult(pack.data, activity, rubric, attempt);
      }
    }

    if (signal.forcedClarification && attempt !== null) {
      const grade = {
        schemaVersion: 1 as const,
        attemptId: attempt.id,
        criteria: rubric.criteria.map((criterion) => ({
          criterionId: criterion.criterionId,
          met: 'unclear' as const,
          rationale: '图片质量不足，未形成判断',
        })),
        feedback: `图片质量未达可判读标准：${signal.reasons.join('；')}。请重拍、旋转或改用文字；系统不会因此判错。`,
        uncertainties: [
          `quality_signal:${JSON.stringify(signal.metrics)}`,
          `threshold_version:${thresholdVersion}`,
        ],
        evidenceCandidates: [],
        requiresClarification: true,
        sourceRefs: [...activity.sourceRefs],
        graderVersion: `image-quality-${thresholdVersion}`,
      };
      const data: Record<string, unknown> = {
        stage: 'clarification_required',
        modelCalled: false,
        modelWouldBeCalled: false,
        qualitySignal: signal,
        threshold_version: thresholdVersion,
        requiresClarification: true,
        evidenceCandidates: [],
        grade,
        attemptOutcome: {
          attempt,
          attemptId: attempt.id,
          persisted: true,
          duplicate: false,
          grade,
          outcomes: [],
          rejectedCandidates: [],
          feedbackPending: true,
          completedAt: ctx.now,
        },
        persistence: {
          attemptId: attempt.id,
          sessionId: session?.id ?? null,
          duplicate: false,
          assessmentCommitted: false,
          evidenceAccepted: 0,
          evidenceRejected: 0,
          feedbackPending: true,
          note: 'quality gate clarification: the attempt is pending; no assessment/grade was written',
        },
      };
      this.imageResults.set(attempt.id, data);
      return okResult(data, pack.revision);
    }
    /*
     * F7: the quality gate passed, so this is a real image answer and the
     * product grades it with the same `evaluateImageAnswer` pipeline the visual
     * baseline uses (recognition → quality/injection → model evaluation →
     * evidence gate). A missing key degrades to the text path instead of
     * pretending to grade.
     */
    if (client === null) {
      return okResult(
        {
          stage: 'degraded_text',
          modelCalled: false,
          modelWouldBeCalled: true,
          qualitySignal: signal,
          threshold_version: thresholdVersion,
          requiresClarification: true,
          clarification: {
            reasons: ['没有可用的图像识别通道'],
            message: '当前没有可用的图像识别通道（未配置模型 Key）。可以改用文字作答；这次不会判对错。',
            actions: ['text_fallback', 'retry_later'],
          },
          evidenceCandidates: [],
          activityId: activity.id,
          activityVersion: activity.version,
          rubricId: rubric.id,
          note: '质量门已通过，但未配置模型 Key；未调用模型，也未产生证据。',
        },
        pack.revision,
      );
    }

    if (attempt === null) {
      return errResult('INVALID_INPUT', '图片作答记录缺失，未调用模型。', false);
    }
    const evaluation = await evaluateImageAnswer({
      asset: {
        assetId,
        sha256,
        mime: input.mime as ImageMime,
        width,
        height,
        byteSize: bytes.byteLength,
      },
      transform: IDENTITY_TRANSFORM,
      requestImage: {
        base64: input.base64,
        mime: input.mime as ImageMime,
        width,
        height,
      },
      activity,
      rubric,
      attempt,
      expectedAnswer: expected.text,
      client,
      resolveSourceRef: (ref) => resolvable.has(ref),
      knownConceptIds: pack.data.concepts.map((concept) => concept.id),
    });
    if (!evaluation.ok) {
      const mapped = imageServiceError(evaluation.error);
      return errResult(mapped.code, mapped.message, mapped.retryable);
    }
    const value = evaluation.value;
    const grade = value.grade;
    let outcomes: readonly AssessmentOutcome[] = [];
    let rejected: readonly unknown[] = [];
    let assessmentCommitted = false;
    let feedbackPending = true;
    let commitError: ServiceError | null = null;
    let evidenceAccepted = 0;
    if (grade !== null && !grade.requiresClarification) {
      /*
       * Reuse the same tutor guard the text pipeline uses: a model-origin
       * candidate may only become evidence when it matches the attempt,
       * activity, rubric, assistance and resolvable sources.
       */
      const guarded = guardEvidence({
        attempt,
        activity,
        rubric,
        rubricVersion: activity.rubricVersion,
        grade,
        disclosureInRound: false,
        resolvableSourceRefs: [...resolvable],
        coreMisconception: false,
        ids: this.composition.ids,
        clock: this.composition.clock,
      });
      rejected = guarded.rejected.map((item) => ({
        candidateIndex: item.candidateIndex,
        conceptId: item.conceptId,
        reason: item.reason,
        message: item.message,
      }));
      evidenceAccepted = guarded.accepted.length;
      if (guarded.accepted.length > 0) {
        /*
         * One idempotent grading request per attempt: re-submitting the same
         * image reuses the attempt id and the assessment dedupe key, so the
         * journal never gets a second answer or a second assessment.
         */
        const committed = await this.composition.learner.recordGradedAttempt(
          { ...ctx, requestId: `${attempt.requestId}:assessment` },
          {
            attemptId: attempt.id,
            evidence: guarded.accepted,
            rubricVersion: activity.rubricVersion,
            evaluatorVersion: grade.graderVersion,
            coreMisconceptionEvidenceIds: guarded.coreMisconceptionEvidenceIds,
          },
        );
        if (committed.ok) {
          outcomes = committed.data;
          assessmentCommitted = committed.data.some((outcome) => outcome.kind === 'assessment');
          feedbackPending = false;
        } else {
          commitError = committed.error;
        }
      }
    }
    const data: Record<string, unknown> = {
      stage: value.stage,
      modelCalled: value.modelRunId !== null,
      modelWouldBeCalled: true,
      qualitySignal: value.qualitySignal ?? signal,
      threshold_version: thresholdVersion,
      requiresClarification: value.clarification !== null || grade?.requiresClarification === true,
      clarification: value.clarification,
      grade,
      gate: value.gate,
      evidenceCandidates: grade?.evidenceCandidates ?? [],
      recognition:
        value.recognition === null
          ? null
          : {
              readable: value.recognition.readable,
              text: value.recognition.text,
              matchesExpected: value.recognition.matchesExpected,
              reason: value.recognition.reason,
              uncertainty: value.recognition.uncertainty,
              regions: value.recognition.regions,
            },
      activityId: activity.id,
      activityVersion: activity.version,
      rubricId: rubric.id,
      expectedAnswer: expected.text,
      expectedAnswerSource: expected.source,
      model: value.model,
      modelRunId: value.modelRunId,
      modelLatencyMs: value.latencyMs,
      usage: value.usage,
      provenance: value.provenance,
      injectionSuspected: value.injection?.suspected ?? false,
      attemptOutcome: {
        attempt,
        attemptId: attempt.id,
        persisted: true,
        duplicate: false,
        grade,
        outcomes,
        rejectedCandidates: rejected,
        feedbackPending,
        completedAt: ctx.now,
      },
      persistence: {
        attemptId: attempt.id,
        sessionId: session?.id ?? null,
        duplicate: false,
        assessmentCommitted,
        evidenceAccepted,
        evidenceRejected: rejected.length,
        feedbackPending,
        ...(commitError === null ? {} : { error: commitError }),
      },
    };
    this.imageResults.set(attempt.id, data);
    return okResult(data, pack.revision);
  }

  /**
   * Resolve the session the image attempt belongs to. The client normally
   * passes the session it already started; a missing/ended/foreign session
   * falls back to the active one for this concept, and only then to a new
   * session so a real answer is never lost just because the page reloaded.
   */
  private async imageSession(
    ctx: RequestContext,
    pack: ContentPack,
    activity: Activity,
    requested: string | null,
  ): Promise<Session | null> {
    const journal = await this.journalSessions();
    const sessions = [...journal.sessions].reverse().map((entry) => entry.session);
    const candidates = [
      ...(requested === null ? [] : sessions.filter((session) => session.id === requested)),
      ...(journal.active === null ? [] : [journal.active]),
    ];
    const chosen = candidates.find(
      (session) =>
        session.status === 'active' &&
        session.packVersion === pack.version &&
        session.courseEditionId === pack.courseEditionId &&
        activity.conceptIds.includes(session.conceptId),
    );
    if (chosen !== undefined) return chosen;
    const conceptId = activity.conceptIds[0];
    if (conceptId === undefined) return null;
    /*
     * No usable session (page reload / direct route use). Create one through
     * the learner service directly: image grading must not depend on a model
     * gateway binding, and an offline transport would otherwise lose the answer.
     */
    const session: Session = {
      schemaVersion: 1,
      id: this.composition.ids.next('session'),
      learnerId: ctx.learnerId,
      courseEditionId: pack.courseEditionId,
      packVersion: pack.version,
      trustMode: trustModeFromPackStatus(pack.status),
      conceptId,
      mode: 'learn',
      status: 'active',
      startedAt: this.composition.clock.now(),
      endedAt: null,
      resumeCursor: { activityId: activity.id, cursor: null },
      dshSessionId: null,
    };
    const started = await this.composition.learner.startSession(
      { ...ctx, requestId: `${ctx.requestId}:image-session` },
      session,
    );
    return started.ok ? session : null;
  }

  /**
   * Deterministic attempt identity: same learner + session + activity + image
   * bytes give the same attempt id and request id. That is the idempotency key
   * that stops a re-submitted image from becoming a second answer.
   */
  private buildImageAttempt(input: {
    readonly session: Session;
    readonly pack: ContentPack;
    readonly activity: Activity;
    readonly assetId: string;
    readonly sha256: string;
  }): ActivityAttempt | null {
    const digest = createHash('sha256')
      .update(`${input.session.id}|${input.activity.id}|${input.sha256}`)
      .digest('hex')
      .slice(0, 32);
    const validated = validateActivityAttempt({
      schemaVersion: 1,
      id: `attempt.image.${digest}`,
      requestId: `request.image.${digest}`,
      learnerId: input.session.learnerId,
      sessionId: input.session.id,
      courseEditionId: input.pack.courseEditionId,
      packVersion: input.pack.version,
      activityId: input.activity.id,
      activityVersion: input.activity.version,
      conceptIds: [...input.activity.conceptIds],
      inputType: 'image',
      answerAssetId: input.assetId,
      answerText: null,
      submittedAt: this.composition.clock.now(),
      helpUsed: [],
      evidenceIds: [],
    });
    return validated.ok ? validated.value : null;
  }

  /**
   * A duplicate submission must not call the model again and must not append a
   * journal line. Return the cached result when this process graded it before;
   * otherwise rebuild a display-only grade from the committed assessment.
   */
  private async duplicateImageResult(
    pack: ContentPack,
    activity: Activity,
    rubric: Rubric,
    attempt: ActivityAttempt,
  ): Promise<ServiceResult<Record<string, unknown>>> {
    const cached = this.imageResults.get(attempt.id);
    if (cached !== undefined) {
      const attemptOutcome = cached['attemptOutcome'] as Record<string, unknown> | undefined;
      const persistence = cached['persistence'] as Record<string, unknown> | undefined;
      return okResult(
        {
          ...cached,
          attemptOutcome:
            attemptOutcome === undefined
              ? null
              : { ...attemptOutcome, duplicate: true },
          persistence:
            persistence === undefined
              ? undefined
              : { ...persistence, duplicate: true, note: 'duplicate image submission: existing journal record reused' },
        },
        this.composition.storage.lastSeq,
      );
    }
    const committed = await this.findImageAssessment(attempt.id);
    const grade = committed === null ? null : this.reconstructImageGrade(attempt.id, committed);
    return okResult(
      {
        stage: grade === null ? 'pending_existing' : 'graded',
        modelCalled: false,
        modelWouldBeCalled: false,
        qualitySignal: null,
        threshold_version: IMAGE_QUALITY_THRESHOLD_VERSION,
        requiresClarification: grade === null,
        clarification:
          grade === null
            ? {
                reasons: ['这张图片此前已提交，仍在等待澄清或批改'],
                message:
                  '这张图片此前已经提交过；本次不重复记答，也不会再调用模型。可以重新选择一张更清楚的图片。',
                actions: ['retake', 'text_fallback'],
              }
            : null,
        grade,
        evidenceCandidates: [],
        activityId: activity.id,
        activityVersion: activity.version,
        rubricId: rubric.id,
        attemptOutcome: {
          attempt,
          attemptId: attempt.id,
          persisted: true,
          duplicate: true,
          grade,
          outcomes: [],
          rejectedCandidates: [],
          feedbackPending: grade === null,
          completedAt: this.composition.clock.now(),
        },
        persistence: {
          attemptId: attempt.id,
          sessionId: attempt.sessionId,
          duplicate: true,
          assessmentCommitted: grade !== null,
          evidenceAccepted: 0,
          evidenceRejected: 0,
          feedbackPending: grade === null,
          note: 'duplicate image submission: the attempt was already saved; no new journal line was written',
        },
      },
      this.composition.storage.lastSeq,
    );
  }

  private async findImageAssessment(
    attemptId: string,
  ): Promise<Record<string, unknown> | null> {
    const ctx = this.ctx('g1.image.assessment');
    const latest = await this.composition.storage.latestSeq(ctx);
    const from = latest.ok ? Math.max(0, latest.data.lastSeq - 999) : 0;
    const slice = await this.composition.storage.readFrom(ctx, from, 1000);
    if (!slice.ok) return null;
    for (const commit of [...slice.data.commits].reverse()) {
      if (commit.type !== 'assessment.committed') continue;
      const payload = commit.payload as Record<string, unknown>;
      const assessment = payload['assessment'] as Record<string, unknown> | undefined;
      if (assessment !== undefined && assessment['attemptId'] === attemptId) return payload;
    }
    return null;
  }

  private reconstructImageGrade(
    attemptId: string,
    payload: Record<string, unknown>,
  ): GradeResult | null {
    const assessment = payload['assessment'] as Record<string, unknown> | undefined;
    const evidence = Array.isArray(payload['evidence'])
      ? (payload['evidence'] as readonly Record<string, unknown>[])
      : [];
    if (assessment === undefined) return null;
    const criteria = new Map<string, { criterionId: string; met: 'yes' | 'no' | 'unclear'; rationale: string }>();
    const sourceRefs = new Set<string>();
    for (const record of evidence) {
      for (const ref of Array.isArray(record['sourceRefs']) ? (record['sourceRefs'] as readonly string[]) : []) {
        sourceRefs.add(ref);
      }
      const results = Array.isArray(record['criterionResults'])
        ? (record['criterionResults'] as readonly Record<string, unknown>[])
        : [];
      for (const result of results) {
        const criterionId = typeof result['criterionId'] === 'string' ? result['criterionId'] : null;
        if (criterionId === null || criteria.has(criterionId)) continue;
        const raw = result['result'];
        criteria.set(criterionId, {
          criterionId,
          met: raw === 'met' ? 'yes' : raw === 'not_met' ? 'no' : 'unclear',
          rationale: typeof result['note'] === 'string' && result['note'].length > 0 ? result['note'] : '既有记录中的要点结果',
        });
      }
    }
    const graderVersion = assessment['evaluatorVersion'];
    if (typeof graderVersion !== 'string' || graderVersion.length === 0) return null;
    return {
      schemaVersion: 1,
      attemptId,
      criteria: [...criteria.values()],
      feedback:
        '这张图片此前已经提交过；本次返回既有记录，不重复记答、不重复调用模型。',
      uncertainties: [],
      evidenceCandidates: [],
      requiresClarification: false,
      sourceRefs: [...sourceRefs],
      graderVersion,
    };
  }

  toolNames(): readonly string[] {
    return this.composition.tools.names;
  }
}

