/// <reference lib="dom" />
/**
 * T13 live browser data sources. They only talk to the education host routes;
 * they never import a content pack or storage directly. Fixture sources stay in
 * the client packages for their own component tests.
 */

export interface LiveResult<T> {
  readonly ok: boolean;
  readonly data?: T;
  readonly error?: { readonly code: string; readonly message: string; readonly retryable?: boolean };
  readonly revision?: number;
  readonly offline?: boolean;
}

async function api<T>(path: string, init?: RequestInit): Promise<LiveResult<T>> {
  try {
    const response = await fetch(path, {
      credentials: 'same-origin',
      headers: { accept: 'application/json', ...(init?.body === undefined ? {} : { 'content-type': 'application/json' }) },
      ...init,
    });
    const body = (await response.json()) as LiveResult<T>;
    if (!response.ok && body.ok !== false) {
      return { ok: false, error: { code: `HTTP_${String(response.status)}`, message: 'request failed', retryable: true } };
    }
    return body;
  } catch (error) {
    return { ok: false, error: { code: 'NETWORK', message: (error as Error).message, retryable: true }, offline: true };
  }
}

function requestId(prefix: string): string {
  return `${prefix}.${String(Date.now())}.${String(Math.random()).slice(2, 8)}`;
}

export function createLiveShellDataSource(): any {
  return {
    kind: 'live',
    notice: null,
    async loadSnapshot() {
      return api('/edu/api/g1/snapshot');
    },
    async loadHome() {
      return api('/edu/api/g1/home');
    },
    async loadRecords() {
      return api('/edu/api/g1/records');
    },
    async resumeSession(_request: unknown, sessionId: string) {
      return api(`/edu/api/g1/resume?sessionId=${encodeURIComponent(sessionId)}`);
    },
    async saveRange() {
      return { ok: false, error: { code: 'UNSUPPORTED', message: 'range claim is not wired in this build' } };
    },
    async exportData() {
      return { ok: false, error: { code: 'UNSUPPORTED', message: 'export is not wired in this build' } };
    },
    async deleteData() {
      return { ok: false, error: { code: 'UNSUPPORTED', message: 'delete is not wired in this build' } };
    },
  };
}

export function createLiveLibraryDataSource(): any {
  return {
    kind: 'live',
    notice: '这本教材还在核对中，先用着。',
    async listBooks() {
      const book = await api<Record<string, unknown>>('/edu/api/g1/library');
      if (!book.ok || book.data === undefined) return book;
      return {
        ok: true,
        revision: book.revision ?? 1,
        data: [
          {
            ...book.data,
            grade: 7,
            term: 1,
            subject: 'biology',
            reviewState: 'candidate',
            editionVerification: 'machine_matched',
            fileState: 'present',
            isCurrent: true,
            unavailableReason: null,
          },
        ],
      };
    },
    async listSources() {
      return api('/edu/api/g1/sources');
    },
    async openSource(_context: unknown, sourceRefId: string) {
      return api(`/edu/api/g1/source?sourceRefId=${encodeURIComponent(sourceRefId)}`);
    },
    async chooseFile() {
      return { ok: false, error: { code: 'UNSUPPORTED', message: 'file picker must be opened by the desktop host' } };
    },
    async startImport() {
      return { ok: false, error: { code: 'UNSUPPORTED', message: 'import is available through the T03 importer API, not this UI build' } };
    },
    async getJob() {
      return { ok: false, error: { code: 'NOT_FOUND', message: 'no import job' } };
    },
    async cancelImport() {
      return { ok: false, error: { code: 'UNSUPPORTED', message: 'no import job' } };
    },
    async resumeImport() {
      return { ok: false, error: { code: 'UNSUPPORTED', message: 'no import job' } };
    },
    async retryImport() {
      return { ok: false, error: { code: 'UNSUPPORTED', message: 'no import job' } };
    },
    subscribe() {
      return () => undefined;
    },
  };
}

function descendants(toc: { id: string; parentId: string | null }[], rootId: string): Set<string> {
  const set = new Set<string>([rootId]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const node of toc) {
      if (node.parentId !== null && set.has(node.parentId) && !set.has(node.id)) {
        set.add(node.id);
        changed = true;
      }
    }
  }
  return set;
}

export function createLiveMapDataSource(): any {
  let cache: any = null;
  async function payload(): Promise<any> {
    if (cache !== null) return cache;
    const result = await api<any>('/edu/api/g1/map');
    if (!result.ok || result.data === undefined) return result;
    cache = result.data;
    return cache;
  }
  function graph(center: string | null, scope: string | null, maxNodes: number): any {
    if (cache === null) return null;
    const toc = cache.toc as { id: string; parentId: string | null }[];
    const scopeIds = scope === null ? null : descendants(toc, scope);
    const chapterConcepts = (cache.concepts as any[]).filter(
      (concept) => scopeIds === null || (concept.placements as string[]).some((placement) => scopeIds.has(placement)),
    );
    const chosen = chapterConcepts.slice(0, Math.max(1, maxNodes));
    const ids = new Set(chosen.map((concept) => concept.id));
    const relations = (cache.relations as any[]).filter(
      (relation) => ids.has(relation.fromConceptId) && ids.has(relation.toConceptId),
    );
    return {
      packVersion: cache.packVersion,
      centerConceptId: center,
      scopeTocNodeId: scope,
      concepts: chosen,
      relations,
      externalConcepts: [],
      truncated: chapterConcepts.length > chosen.length,
      hiddenConceptCount: Math.max(0, chapterConcepts.length - chosen.length),
      stats: { maxNodes, maxDepth: 2, visitedConcepts: chosen.length, visitedRelations: relations.length, durationMs: 0 },
    };
  }
  return {
    kind: 'live',
    notice: null,
    async loadMap() {
      const data = await payload();
      return data.ok === false ? data : { ok: true, revision: 1, data };
    },
    async loadChapterGraph(_request: unknown, tocNodeId: string, options: any) {
      const data = await payload();
      if (data.ok === false) return data;
      return { ok: true, revision: 1, data: graph(options?.centerConceptId ?? null, tocNodeId, options?.maxNodes ?? 24) };
    },
    async expandConcept(_request: unknown, conceptId: string, options: any) {
      const data = await payload();
      if (data.ok === false) return data;
      return { ok: true, revision: 1, data: graph(conceptId, null, options?.maxNodes ?? 25) };
    },
    async searchConcepts(_request: unknown, query: string, limit: number) {
      const data = await payload();
      if (data.ok === false) return data;
      const q = query.trim().toLowerCase();
      const hits = (data.concepts as any[])
        .filter((concept) => concept.title.toLowerCase().includes(q) || (concept.aliases as string[]).some((alias) => alias.toLowerCase().includes(q)))
        .slice(0, limit)
        .map((concept) => ({
          conceptId: concept.id,
          title: concept.title,
          matchedOn: concept.title.toLowerCase().includes(q) ? 'title' : 'alias',
          matchedText: concept.title,
          tocNodeId: concept.placements[0] ?? null,
          tocTitle: null,
          score: 1,
        }));
      return { ok: true, revision: 1, data: hits };
    },
    async loadConceptDetail(_request: unknown, conceptId: string) {
      const data = await payload();
      if (data.ok === false) return data;
      const concept = (data.concepts as any[]).find((entry) => entry.id === conceptId);
      if (concept === undefined) return { ok: false, error: { code: 'NOT_FOUND', message: 'concept not found' } };
      const relations = (data.relations as any[]).filter(
        (relation) => relation.fromConceptId === conceptId || relation.toConceptId === conceptId,
      );
      const tocNodes = Array.isArray(data.toc) ? (data.toc as any[]) : [];
      const tocById = new Map(tocNodes.map((node) => [node.id as string, node] as const));
      // The map payload carries the whole source catalogue; the detail only shows
      // the refs this concept actually declares.
      const catalogue = Array.isArray(data.sources) ? (data.sources as any[]) : [];
      const conceptRefs = new Set<string>(Array.isArray(concept.sourceRefs) ? concept.sourceRefs : []);
      const placementOf = (tocNodeId: string): { tocNodeId: string; title: string; type: string; path: string[] } => {
        const path: string[] = [];
        const seen = new Set<string>();
        let cursor = tocById.get(tocNodeId);
        while (cursor !== undefined && !seen.has(cursor.id)) {
          seen.add(cursor.id);
          path.unshift(String(cursor.title ?? cursor.id));
          cursor = cursor.parentId === null || cursor.parentId === undefined ? undefined : tocById.get(String(cursor.parentId));
        }
        const node = tocById.get(tocNodeId);
        return {
          tocNodeId,
          title: String(node?.title ?? '教材目录'),
          type: String(node?.type ?? 'section'),
          path: path.length > 0 ? path : [String(node?.title ?? '教材目录')],
        };
      };
      return {
        ok: true,
        revision: 1,
        data: {
          concept,
          progress: (data.progress as any[]).find((entry) => entry.conceptId === conceptId) ?? null,
          selfReport: (data.selfReports as any[]).find((entry) => entry.conceptId === conceptId) ?? null,
          relations,
          prerequisites: relations.filter((relation) => relation.type === 'prerequisite' && relation.toConceptId === conceptId),
          evidence: (data.evidence as any[]).filter((entry) => entry.conceptId === conceptId),
          sources: catalogue.filter((entry) => conceptRefs.has(String(entry.sourceRefId))),
          placements: (concept.placements as string[]).map((tocNodeId) => placementOf(tocNodeId)),
        },
      };
    },
  };
}

export function createLiveStudyDataSource(): any {
  function body(value: unknown): RequestInit {
    return { method: 'POST', body: JSON.stringify(value), headers: { 'x-edu-request-id': requestId('g1.study') } };
  }
  return {
    kind: 'live',
    notice: null,
    async loadWorkspace(_ctx: unknown, input: any) {
      const activityId =
        typeof input.activityId === 'string' && input.activityId.length > 0
          ? `&activityId=${encodeURIComponent(input.activityId)}`
          : '';
      return api(
        `/edu/api/g1/study?conceptId=${encodeURIComponent(input.conceptId)}${activityId}`,
      );
    },
    async startSession(_ctx: unknown, input: any) {
      return api('/edu/api/g1/tutor/start', body(input));
    },
    async submitTurn(_ctx: unknown, input: any) {
      const attempt = input.attempt;
      const answerText =
        attempt !== null && attempt !== undefined && typeof attempt.answerText === 'string'
          ? attempt.answerText
          : null;
      const fallbackMessage =
        attempt !== null && attempt !== undefined
          ? `我提交了活动 ${String(attempt.activityId ?? '')} 的作答（${String(
              attempt.inputType ?? 'text',
            )}）：${answerText ?? '(图片作答)'}。sessionId=${String(
              input.sessionId ?? '',
            )}。请根据这次真实提交的评分结果给出教学反馈，不要要求我重复提供 sessionId。`
          : input.helpRequest !== null && input.helpRequest !== undefined
            ? '请根据当前概念和活动给我帮助。'
            : '继续';
      const message =
        typeof input.message === 'string' && input.message.trim().length > 0
          ? input.message
          : fallbackMessage;
      return api('/edu/api/g1/tutor/turn', body({ ...input, message }));
    },
    async skip(_ctx: unknown, input: any) {
      return api('/edu/api/g1/tutor/skip', body(input));
    },
    async end(_ctx: unknown, input: any) {
      return api('/edu/api/g1/tutor/end', body(input));
    },
    async retryPendingGrading(_ctx: unknown, input: any) {
      return api('/edu/api/g1/tutor/retry', body(input));
    },
    async finishLearning(_ctx: unknown, input: any) {
      return api('/edu/api/g1/tutor/finish-learning', body(input));
    },
    async finishReview(_ctx: unknown, input: any) {
      return api('/edu/api/g1/tutor/finish-review', body(input));
    },
    async loadProgress(_ctx: unknown, conceptId: string) {
      return api(`/edu/api/g1/progress?conceptId=${encodeURIComponent(conceptId)}`);
    },
    async loadReviewRange() {
      return { ok: true, revision: 1, data: { candidates: [], policyVersion: 'review-policy-v1', note: 'no scheduled review items' } };
    },
    async deferReview() {
      return { ok: false, error: { code: 'UNSUPPORTED', message: 'review defer is not wired yet' } };
    },
    async loadDraft(_ctx: unknown, key: any) {
      return api(`/edu/api/g1/draft?${new URLSearchParams({ conceptId: key.conceptId, mode: key.mode, activityId: key.activityId }).toString()}`);
    },
    async saveDraft(_ctx: unknown, draft: any) {
      return api('/edu/api/g1/draft', body(draft));
    },
    async clearDraft(_ctx: unknown, key: any) {
      return api('/edu/api/g1/draft/clear', body(key));
    },
    async saveSelfReport(_ctx: unknown, input: any) {
      return api('/edu/api/g1/self-report', body(input));
    },
    /**
     * F7: image answers go through the real `/edu/api/g1/image` route, which
     * grades with `evaluateImageAnswer` after the quality gate and persists the
     * attempt through the learner pipeline. `attemptOutcome` is the journal
     * receipt (never null on a graded/clarification response); a duplicate
     * image submission returns the existing record marked `duplicate: true`.
     */
    async submitImageAnswer(_ctx: unknown, input: any) {
      const base64 = typeof input?.base64 === 'string' ? input.base64 : '';
      if (base64.length === 0) {
        return {
          ok: false,
          error: { code: 'UNSUPPORTED', message: '还没有选择图片；请先选择并预览后再发送。', retryable: true },
        };
      }
      const response = await api<any>('/edu/api/g1/image', body({
        base64,
        mime: typeof input.mime === 'string' ? input.mime : 'image/png',
        width: Number(input.width ?? 0),
        height: Number(input.height ?? 0),
        activityId: typeof input.activityId === 'string' ? input.activityId : null,
        sessionId: typeof input.sessionId === 'string' ? input.sessionId : null,
      }));
      if (response.ok !== true || response.data === undefined) return response;
      const data = response.data;
      const grade = data.grade ?? null;
      const stage = typeof data.stage === 'string' ? data.stage : 'unknown';
      const clarification = data.clarification ?? null;
      const message =
        typeof grade?.feedback === 'string' && grade.feedback.length > 0
          ? grade.feedback
          : typeof clarification?.message === 'string'
            ? clarification.message
            : '这次图片没有形成判断。';
      const sourceRefs = Array.isArray(grade?.sourceRefs) ? grade.sourceRefs : [];
      const revision = typeof response.revision === 'number' ? response.revision : 1;
      return {
        ok: true,
        revision,
        data: {
          revision,
          message,
          decision: {
            action: stage === 'graded' ? 'image_grade' : stage,
            rationale: `product image route: stage=${stage}, modelCalled=${String(data.modelCalled === true)}`,
            disclosure: false,
            guidance: message,
            difficulty: 'same',
            sourceRefs,
            reviewStage: null,
          },
          state: {
            revision,
            consecutiveFailures: 0,
            difficulty: 'standard',
            currentActivityId: typeof input.activityId === 'string' ? input.activityId : null,
            reviewStage: null,
            status: 'active',
            helpKinds: [],
            disclosure: false,
          },
          attemptOutcome: data.attemptOutcome ?? null,
          gateway: 'image',
          model: {
            provider: 'deepseek-official',
            model: typeof data.model === 'string' ? data.model : 'deepseek-flash',
            text: true,
            image: true,
          },
          sourceCitation: { required: false, refs: sourceRefs, missing: false },
          toolResults: [],
          audit: [],
          image: {
            stage,
            modelCalled: data.modelCalled === true,
            evidenceCandidates: Array.isArray(data.evidenceCandidates) ? data.evidenceCandidates : [],
            gate: data.gate ?? null,
            qualitySignal: data.qualitySignal ?? null,
            clarification,
            persistence: data.persistence ?? null,
          },
        },
      };
    },
  };
}
