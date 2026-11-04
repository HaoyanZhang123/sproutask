/**
 * Education runtime composition root (phase B).
 *
 * Wires the frozen domain ports to real local packages and the fixed DSH host:
 * knowledge (the pack snapshot from content/biology-7a + source catalog), learner
 * projection and storage, rule grading (visuals), tutor tool registry, DSH tutor
 * gateway, host capabilities/auth status, i18n/DTO services and a page registry.
 *
 * Content trust (`trustMode`) is derived from the loaded pack's `status`
 * snapshot, never hardcoded: published packs teach as `published`, everything
 * else stays on the safe `candidate` default.
 *
 * Side effects are limited to the isolated data root passed by the host; the
 * client learns nothing about credentials (only auth status).
 */

import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import type {
  AuthStatus,
  Clock,
  ContentQuery,
  EventStore,
  GradePort,
  HostPort,
  Id,
  IdGenerator,
  ImportPort,
  KnowledgePort,
  LearnerProjectionStore,
  PackStatus,
  RequestContext,
  RuntimeCapabilities,
  ServiceResult,
  Session,
  Timestamp,
  TutorCapabilities,
  TutorGateway,
} from '@edu/domain';
import { errResult, okResult } from '@edu/domain';
import { StorageService } from '@edu/storage';
import { createSourceCatalog, KnowledgeService, loadPack } from '@edu/knowledge';
import { createLearnerFeature, LearnerService } from '@edu/learner';
import {
  adaptTutorGateway,
  createEducationToolRegistry,
  createTutorService,
  type EducationToolRegistry,
  type TutorToolDependencies,
} from '@edu/tutor';
import type { PackKey } from '@edu/domain';
import { createRuleGradePort } from './adapters/rule-grade.js';
import {
  assertDshTutorHost,
  createDshTutorGateway,
  dshVersionDescriptor,
  turnBudgetFromEnv,
  type DshAgentsLike,
  type DshSessionsLike,
} from './adapters/dsh-tutor.js';
import { createNotBoundTutorGateway } from './adapters/dsh-not-bound.js';
import { createSystemClock } from './adapters/system-clock.js';
import { createDshSessionIdGenerator } from './adapters/session-ids.js';
import { PageRegistry } from './pages.js';

export interface I18nService {
  readonly locale: 'zh-CN';
  t(key: string): string;
  readonly messages: Readonly<Record<string, string>>;
}

export interface DtoService {
  shellBootstrap(): {
    readonly title: string;
    readonly learnerId: string;
    readonly packKey: PackKey;
    /** Derived from the loaded pack snapshot: `published` only for a curator-published pack. */
    readonly trustMode: 'candidate' | 'published';
    readonly fixtureData: false;
    readonly packVersion: string;
    readonly conceptCount: number;
    readonly tools: readonly string[];
  };
}

export interface EducationRuntimeOptions {
  readonly workspaceRoot: string;
  readonly dataRoot: string;
  readonly env?: NodeJS.ProcessEnv;
  readonly agents?: DshAgentsLike;
  readonly sessions?: DshSessionsLike;
  readonly dshVersion?: string;
  /** DSH_HOME holding the persisted session store; defaults to env or `<dataRoot>/../dsh-home`. */
  readonly dshHome?: string | null;
  /** Explicit id generator (tests); production uses the DSH-store-aware one. */
  readonly ids?: IdGenerator;
  readonly learnerId?: string;
  readonly model?: { readonly provider: string; readonly model: string; readonly maxTokens?: number };
  readonly onAudit?: (event: unknown) => void;
}

export interface EducationRuntimeComposition {
  readonly status: 'ready' | 'degraded';
  readonly blockers: readonly string[];
  readonly clock: Clock;
  readonly ids: IdGenerator;
  readonly storage: StorageService;
  readonly learner: LearnerService;
  readonly knowledge: KnowledgeService;
  readonly content: ContentQuery;
  readonly knowledgePort: KnowledgePort;
  readonly eventStore: EventStore;
  readonly grade: GradePort;
  readonly tutorGateway: TutorGateway;
  readonly tutor: ReturnType<typeof createTutorService>;
  readonly tools: EducationToolRegistry;
  readonly host: HostPort;
  readonly pages: PageRegistry;
  readonly i18n: I18nService;
  readonly dto: DtoService;
  readonly packKey: PackKey;
  /** Trust derived once from the same pack snapshot the composition loaded. */
  readonly trustMode: 'candidate' | 'published';
  /** Audit sink for route-level decisions (persisted by the host plugin). */
  readonly audit?: (event: unknown) => void;
  readonly services: {
    readonly clock: Clock;
    readonly ids: IdGenerator;
    readonly eventStore: EventStore;
    readonly contentQuery: ContentQuery;
    readonly knowledge: KnowledgePort;
    readonly grade: GradePort;
    readonly imports: ImportPort;
    readonly learnerStore: LearnerProjectionStore;
    readonly host: HostPort;
    readonly tutor: TutorGateway;
  };
  liveSelftest(): Promise<ServiceResult<{ readonly text: string; readonly sessionId: string }>>;
  close(): void;
}

const MESSAGES: Record<string, string> = {
  'app.title': '芽问',
  'nav.library': '我的课本',
  'nav.map': '知识地图',
  'nav.workspace': '学习',
  'nav.records': '进展',
  'status.localFirst': '学习记录保存在本机',
  'status.fixture': '开发阶段使用示例数据',
  'auth.apiKeyConfigured': 'API Key 已配置',
  'auth.apiKeyMissing': 'API Key 未配置',
  'error.unavailable': '当前功能不可用',
};

function readJson(file: string): unknown {
  return JSON.parse(readFileSync(file, 'utf8')) as unknown;
}

/**
 * Content trust is a property of the loaded pack snapshot (05 §2), never a
 * constant: a pack the human curator published teaches as `published`, every
 * other status (draft/candidate/rejected) keeps the safe `candidate` default.
 */
export function trustModeFromPackStatus(status: PackStatus): 'candidate' | 'published' {
  return status === 'published' ? 'published' : 'candidate';
}

function unavailableImportPort(): ImportPort {
  const fail = <T>(): ServiceResult<T> =>
    errResult('NOT_IMPLEMENTED', 'PDF import is not wired into the phase-B host yet (T13/T03)', false);
  return {
    start: async () => fail(),
    status: async () => fail(),
    cancel: async () => fail(),
    resume: async () => fail(),
  };
}

function createI18n(): I18nService {
  return {
    locale: 'zh-CN',
    messages: MESSAGES,
    t(key: string): string {
      return MESSAGES[key] ?? key;
    },
  };
}

function createHostPort(input: {
  readonly dshBound: boolean;
  readonly dshVersion: string;
  readonly text: boolean;
  readonly image: boolean;
  readonly tools: readonly string[];
  readonly authMethod: 'api_key' | 'none';
  readonly authStatus: 'available' | 'unavailable' | 'unknown';
  readonly checkedAt: Timestamp;
}): HostPort {
  const capabilitiesBase = {
    dsh: input.dshBound
      ? dshVersionDescriptor(input.dshVersion)
      : { bound: false as const, version: null, sourceRef: null },
    model: { text: input.text, image: input.image },
    tools: input.tools,
    network: 'loopback_only' as const,
  };
  const capabilities: RuntimeCapabilities = capabilitiesBase;
  const auth: AuthStatus = {
    method: input.authMethod,
    status: input.authStatus,
    lastCheckedAt: input.checkedAt,
    accountRef: null,
  };
  return {
    async capabilities(): Promise<ServiceResult<RuntimeCapabilities>> {
      return okResult(capabilities, 0);
    },
    async authStatus(): Promise<ServiceResult<AuthStatus>> {
      return okResult(auth, 0);
    },
  };
}

function selftestSession(input: {
  readonly learnerId: string;
  readonly packKey: PackKey;
  readonly conceptId: string;
  readonly now: Timestamp;
  readonly trustMode: 'candidate' | 'published';
}): Session {
  return {
    schemaVersion: 1,
    id: `session.edu.selftest.${Date.parse(input.now)}`,
    learnerId: input.learnerId,
    courseEditionId: input.packKey.courseEditionId,
    packVersion: input.packKey.packVersion,
    trustMode: input.trustMode,
    conceptId: input.conceptId,
    mode: 'learn',
    status: 'active',
    startedAt: input.now,
    endedAt: null,
    resumeCursor: { activityId: null, cursor: null },
    dshSessionId: null,
  };
}

/**
 * Resolve the DSH home that owns the persisted session store. The packaged
 * launcher sets DSH_HOME explicitly; the sibling layout (`<root>/dsh-home`)
 * covers the dev/headless harness. Null means "no store to check".
 */
export function resolveDshHome(input: {
  readonly explicit?: string | null;
  readonly env?: NodeJS.ProcessEnv;
  readonly dataRoot: string;
}): string | null {
  const explicit = (input.explicit ?? '').trim();
  if (explicit.length > 0) return path.resolve(explicit);
  const fromEnv = (input.env?.['DSH_HOME'] ?? '').trim();
  if (fromEnv.length > 0) return path.resolve(fromEnv);
  const sibling = path.resolve(input.dataRoot, '..', 'dsh-home');
  return existsSync(sibling) ? sibling : null;
}

export async function composeEducationRuntime(
  options: EducationRuntimeOptions,
): Promise<ServiceResult<EducationRuntimeComposition>> {
  const clock = createSystemClock();
  const env = options.env ?? process.env;
  // F5: session ids must not collide with DSH's persisted sessions
  // (`<DSH_HOME>/sessions/**/session.N`), otherwise the first start after a
  // restart hits the broken restore path (0 model calls, TypeError).
  const dshHome = resolveDshHome({ explicit: options.dshHome, env, dataRoot: options.dataRoot });
  const ids = options.ids ?? createDshSessionIdGenerator({ prefix: 'edu', dshHome });
  const learnerId = options.learnerId ?? 'learner.local.default';
  const workspaceRoot = path.resolve(options.workspaceRoot);
  const contentRoot = path.join(workspaceRoot, 'content', 'biology-7a');

  let packJson: unknown;
  let sourceRefsJson: { readonly refs?: readonly unknown[] };
  let courseEditionJson: { readonly bookInstance?: unknown; readonly courseEdition?: unknown };
  let blockIndexJson: { readonly blocks?: readonly Record<string, unknown>[] };
  try {
    packJson = readJson(path.join(contentRoot, 'pack.json'));
    sourceRefsJson = readJson(path.join(contentRoot, 'source', 'source-refs.json')) as typeof sourceRefsJson;
    courseEditionJson = readJson(path.join(contentRoot, 'source', 'course-edition.json')) as typeof courseEditionJson;
    blockIndexJson = readJson(path.join(contentRoot, 'source', 'block-index.json')) as typeof blockIndexJson;
  } catch (error) {
    return errResult('STORAGE_FAILED', `education content could not be read: ${(error as Error).message}`, false);
  }
  const loaded = loadPack(packJson);
  if (!loaded.ok) {
    return errResult('CONTRACT_REJECTED', 'the content pack failed knowledge validation', false);
  }
  const pack = loaded.value.pack;
  const blocks = (blockIndexJson.blocks ?? []).map((block, index) => {
    const type = block['type'];
    return {
      schemaVersion: 1 as const,
      id: typeof block['blockId'] === 'string' ? block['blockId'] : `block.missing.${index}`,
      sourceRefId: typeof block['sourceRefId'] === 'string' ? block['sourceRefId'] : '',
      type:
        type === 'heading' || type === 'caption' || type === 'table' || type === 'list'
          ? type
          : ('paragraph' as const),
      originalText: `[source text withheld from runtime bundle; sha256=${
        typeof block['textSha256'] === 'string' ? block['textSha256'] : 'unknown'
      }]`,
      revisedText: null,
      extractionMethod: 'ocr' as const,
      textConfidence:
        typeof block['textConfidence'] === 'number' ? block['textConfidence'] : 0.5,
      reviewState: 'curator_checked' as const,
    };
  });
  const catalog = createSourceCatalog({
    bookInstances: courseEditionJson.bookInstance === undefined ? [] : [courseEditionJson.bookInstance],
    sourceRefs: sourceRefsJson.refs ?? [],
    sourceBlocks: blocks,
  });
  if (!catalog.ok) {
    return errResult('CONTRACT_REJECTED', 'the source catalog failed domain validation', false);
  }
  const knowledge = new KnowledgeService({ sources: catalog.value });
  knowledge.registerPack(packJson);

  const storageResult = await StorageService.open({
    root: path.resolve(options.dataRoot),
    clock,
    ids,
    onAudit: (event) => options.onAudit?.(event),
  });
  if (!storageResult.ok) {
    return errResult(storageResult.error.code, storageResult.error.message, storageResult.error.retryable, storageResult.error.detailsRef);
  }
  const storage = storageResult.data;
  const learnerFeature = await createLearnerFeature({ storage, clock, ids, learnerId });
  if (!learnerFeature.ok) {
    storage.close();
    return errResult(learnerFeature.error.code, learnerFeature.error.message, learnerFeature.error.retryable, learnerFeature.error.detailsRef);
  }
  const learner = learnerFeature.data.learner;

  const packKey: PackKey = { courseEditionId: pack.courseEditionId, packVersion: pack.version };
  const trustMode = trustModeFromPackStatus(pack.status);
  const firstConcept = pack.concepts[0]?.id;
  if (firstConcept === undefined) {
    storage.close();
    return errResult('CONTRACT_REJECTED', 'the content pack contains no concept', false);
  }

  const apiKeyPresent = (env['DEEPSEEK_API_KEY'] ?? '').trim().length > 0;
  const model = options.model ?? {
    provider: 'deepseek-official',
    model: 'deepseek-flash',
    maxTokens: 3200,
  };
  const dshBound = assertDshTutorHost({ agents: options.agents, sessions: options.sessions });
  const dshAgents = dshBound ? (options.agents as DshAgentsLike) : null;
  const dshSessions = dshBound ? (options.sessions as DshSessionsLike) : null;
  const tutorGateway: TutorGateway =
    dshAgents !== null && dshSessions !== null
      ? createDshTutorGateway({
          agents: dshAgents,
          sessions: dshSessions,
          model,
          authStatus: apiKeyPresent ? 'available' : 'unavailable',
          image: true,
          clock,
          dshVersion: options.dshVersion ?? '0.2.1-rc.3',
          turnBudget: turnBudgetFromEnv(env),
          onTurn: (info) => options.onAudit?.({ kind: 'tutor.turn', ...info }),
          onPartialTurn: (evidence) =>
            options.onAudit?.({ kind: 'tutor.turn.partial', ...evidence }),
          onDebug: (record) => options.onAudit?.({ kind: 'dsh.debug', ...record }),
        })
      : createNotBoundTutorGateway();

  const grade = createRuleGradePort();
  const tutor = createTutorService({
    content: knowledge,
    learner,
    gateway: adaptTutorGateway({ gateway: tutorGateway, gradePort: grade }),
    clock,
    ids,
    learnerId,
    packKey,
    onAudit: (event) => options.onAudit?.(event),
  });
  const toolsDeps: TutorToolDependencies = {
    content: knowledge,
    learner,
    clock,
    ids,
    learnerId,
    packKey,
    onAudit: (event) => options.onAudit?.(event),
  };
  const tools = createEducationToolRegistry(toolsDeps);

  const host = createHostPort({
    dshBound,
    dshVersion: options.dshVersion ?? '0.2.1-rc.3',
    text: true,
    image: apiKeyPresent,
    tools: tools.names,
    authMethod: apiKeyPresent ? 'api_key' : 'none',
    authStatus: apiKeyPresent ? 'available' : 'unavailable',
    checkedAt: clock.now(),
  });

  const pages = new PageRegistry();
  const pageSpecs = [
    ['home', '/', '今天'],
    ['library', '/library', '我的课本'],
    ['map', '/map', '知识地图'],
    ['workspace', '/workspace', '学习'],
    ['records', '/records', '进展'],
    ['account', '/account', '设置'],
  ] as const;
  for (const [id, route, title] of pageSpecs) {
    pages.register({
      id,
      path: route,
      title,
      requiresLearner: true,
      mount() {
        /* The client shell owns DOM; the host registry only publishes routes. */
      },
      unmount() {
        /* no host-side DOM to tear down */
      },
    });
  }

  const i18n = createI18n();
  const dto: DtoService = {
    shellBootstrap() {
      return {
        title: i18n.t('app.title'),
        learnerId,
        packKey,
        trustMode,
        fixtureData: false,
        packVersion: pack.version,
        conceptCount: pack.concepts.length,
        tools: tools.names,
      };
    },
  };
  const imports = unavailableImportPort();
  const blockers: string[] = [];
  if (!dshBound) blockers.push('DSH agents/sessions are not available in this host scope');
  if (!apiKeyPresent) blockers.push('DEEPSEEK_API_KEY is not present; text/image model calls are unavailable');

  const composition: EducationRuntimeComposition = {
    status: dshBound && apiKeyPresent ? 'ready' : 'degraded',
    blockers,
    clock,
    ids,
    storage,
    learner,
    knowledge,
    content: knowledge,
    knowledgePort: knowledge,
    eventStore: storage,
    grade,
    tutorGateway,
    tutor,
    audit: (event) => options.onAudit?.(event),
    tools,
    host,
    pages,
    i18n,
    dto,
    packKey,
    trustMode,
    services: {
      clock,
      ids,
      eventStore: storage,
      contentQuery: knowledge,
      knowledge,
      grade,
      imports,
      learnerStore: learner,
      host,
      tutor: tutorGateway,
    },
    async liveSelftest() {
      const now = clock.now();
      const session = selftestSession({ learnerId, packKey, conceptId: firstConcept, now, trustMode });
      const request: RequestContext = {
        requestId: ids.next('selftest'),
        learnerId,
        now,
      };
      const started = await tutorGateway.startSession(request, { session });
      if (!started.ok) return started;
      const prompt =
        `请调用教育工具 edu_get_concept 读取概念 ${firstConcept}，` +
        `再对它的第一个 sourceRef 调用 edu_resolve_source，` +
        '然后用中文回答：概念标题，以及来源的 PDF 页与印刷页。不要编造页码。';
      const turn = await tutorGateway.sendTurn(request, {
        sessionId: session.id,
        revision: started.data.revision,
        message: prompt,
        activityId: null,
        stream: false,
      });
      await tutorGateway.endSession(request, { sessionId: session.id, reason: 'completed' });
      if (!turn.ok) return turn;
      return okResult({ text: turn.data.text, sessionId: session.id }, turn.data.revision);
    },
    close() {
      storage.close();
    },
  };
  return okResult(composition, storage.lastSeq);
}

export type { TutorCapabilities, Id };

