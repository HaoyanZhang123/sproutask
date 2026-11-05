/**
 * Real DSH tutor gateway.
 *
 * Bridges the frozen `TutorGateway` port to the fixed DSH `ctx.agents` /
 * `ctx.sessions` services. The DSH agent owns the model loop and tool calls;
 * this adapter only creates/resumes a live agent, injects the learner turn,
 * waits for idle, and reads the committed assistant message back.
 */

import type {
  ModelDescriptor,
  RequestContext,
  ServiceResult,
  Session,
  Timestamp,
  TutorCapabilities,
  TutorGateway,
  TutorSessionBinding,
  TutorSessionStartRequest,
  TutorTurnRequest,
  TutorTurnResult,
} from '@edu/domain';
import { errResult, okResult } from '@edu/domain';
import { neutralizeUnsupportedPages } from './page-claims.js';

export interface DshMessageLike {
  readonly id?: string;
  readonly role: string;
  readonly content?:
    | readonly { readonly type?: string; readonly text?: string; readonly name?: string }[]
    | string;
}

export interface DshSessionLike {
  deriveMessages(): readonly DshMessageLike[];
  readonly seq?: number;
}

export interface DshAgentLike {
  /** The live session this agent drives (authoritative for assistant commits). */
  readonly session?: DshSessionLike;
  /** Agent-scoped context; exposes the system-prompt registry in the real host. */
  readonly ctx?: {
    readonly systemPrompt?: {
      section(section: {
        readonly name: string;
        readonly order: number;
        readonly text: string | (() => string);
        readonly interpolate?: boolean;
      }): () => void;
    };
  };
  followup(input: {
    readonly id?: string;
    readonly role?: 'user';
    readonly content: readonly { readonly type: 'text'; readonly text: string }[];
    readonly source: { readonly kind: string };
  }): void | Promise<void>;
  whenIdle(): Promise<void>;
}

export interface DshAgentHandleLike {
  readonly agent: DshAgentLike;
  dispose(): Promise<void>;
}

export interface DshAgentsLike {
  create(options: {
    readonly sessionId?: string;
    readonly agentOptions: {
      readonly provider: string;
      readonly model: string;
      readonly maxTokens?: number;
    };
  }): Promise<DshAgentHandleLike>;
  resume?(options: {
    readonly sessionId: string;
    readonly agentOptions: {
      readonly provider: string;
      readonly model: string;
      readonly maxTokens?: number;
    };
  }): Promise<DshAgentHandleLike>;
}

export interface DshSessionsLike {
  get(sessionId: string): DshSessionLike | undefined;
}

export interface DshTutorGatewayOptions {
  readonly agents: DshAgentsLike;
  readonly sessions: DshSessionsLike;
  readonly model: { readonly provider: string; readonly model: string; readonly maxTokens?: number };
  readonly authStatus: 'available' | 'unavailable' | 'unknown';
  readonly image: boolean;
  readonly clock: { now(): Timestamp };
  readonly dshVersion: string;
  /** Turn budget; DSH itself has none (see the T14/S5 note above). */
  readonly turnBudget?: DshTurnBudget;
  /** Persists the evidence a failed turn already obtained (never silently dropped). */
  readonly onPartialTurn?: (evidence: DshTurnEvidence) => void;
  readonly onTurn?: (info: {
    readonly sessionId: string;
    readonly revision: number;
    readonly text: string;
    readonly model: ModelDescriptor;
  }) => void;
  readonly onDebug?: (record: Record<string, unknown>) => void;
}

function textOf(message: DshMessageLike): string {
  if (typeof message.content === 'string') return message.content;
  if (!Array.isArray(message.content)) return '';
  return message.content
    .filter((block) => block.type === 'text' && typeof block.text === 'string')
    .map((block) => block.text)
    .join('\n');
}

/**
 * T15 F5: a session id that already exists in the DSH store makes
 * `agents.create`/`agents.resume` go through the restore path, which can throw
 * `TypeError: Cannot read properties of undefined (reading 'length')` before any
 * model call. Such a failure is structural, not a transport error, so it is
 * converted to a structured service error. The teaching service may retry once
 * with a fresh session id.
 */
export const SESSION_RESUME_FAILED = 'SESSION_RESUME_FAILED';

export function isSessionBindingTypeError(error: unknown): boolean {
  if (error instanceof TypeError) return true;
  const message = error instanceof Error ? error.message : String(error);
  return /Cannot read propert|Cannot set propert|is not a function|reading 'length'|undefined \(reading/i.test(
    message,
  );
}

/* ------------------------------------------------------------------ *
 * T14/S5 turn budget: DSH itself has NO built-in turn budget.
 *
 * The DSH agent loop documents this explicitly: "No built-in turn budget —
 * tool calls or steering continue the current turn; a policy that bounds
 * runaway turns must cancel from an existing lifecycle extension point such
 * as `agent/turn-stopping`" (@deepseek-ai/dsh-agent-loop README, Known
 * limitations). The education runtime is therefore the only place that can
 * bound a turn: it must cap wall-clock time and tool round-trips, and it must
 * keep whatever the turn already obtained (tool names, resolved source refs,
 * PDF/printed pages, partial text) instead of dropping it.
 *
 * The v11 S5 failure (`/edu/api/g1/tutor/turn`, u2.ch3 sample, 35.4 s, 14 tool
 * calls, 0 anchors) ended with a final assistant message that contained only
 * a `reasoning` block — so `textOf` returned '' and the generic
 * "DSH turn produced no assistant text" error discarded 14 tool results and
 * every resolved source ref. These markers make that condition structured and
 * recoverable, and mark the error as "partial turn kept" so the host does not
 * silently replace the model turn with the local rule grader.
 * ------------------------------------------------------------------ */

export const TURN_BUDGET_EXCEEDED = 'TURN_BUDGET_EXCEEDED';
export const TURN_TOOL_CAP_EXCEEDED = 'TURN_TOOL_CAP_EXCEEDED';
export const TURN_NO_TEXT = 'TURN_NO_TEXT';
export const TURN_IN_PROGRESS = 'TURN_IN_PROGRESS';

const PARTIAL_TURN_MARKERS = [
  TURN_BUDGET_EXCEEDED,
  TURN_TOOL_CAP_EXCEEDED,
  TURN_NO_TEXT,
] as const;

/** True for a structured turn failure that kept partial evidence. */
export function isPartialTurnFailure(message: string): boolean {
  return PARTIAL_TURN_MARKERS.some((marker) => message.includes(marker));
}

export interface DshTurnBudget {
  /** Wall-clock budget for one turn (idle wait). */
  readonly turnTimeoutMs?: number;
  /** Tool round-trip cap for one turn (assistant `tool-call` blocks). */
  readonly maxToolCalls?: number;
  /** How often the turn is inspected while the agent runs. */
  readonly pollIntervalMs?: number;
}

export const DEFAULT_TURN_BUDGET = {
  turnTimeoutMs: 45_000,
  // 10 killed real turns that legitimately called 11–13 tools (2026-11-02:
  // "生物分类"/"无脊椎动物" probes); 14 keeps the wall-clock bound while letting
  // the model finish, and the per-call cost stays inside the turn budget.
  maxToolCalls: 14,
  pollIntervalMs: 500,
} as const;

/**
 * Turn budget from the host environment. A deployment can widen it, but an
 * unset or malformed value always falls back to a bounded default: a turn may
 * never run unbounded (that is the S5 defect this guards against).
 */
export function turnBudgetFromEnv(env: NodeJS.ProcessEnv | undefined): DshTurnBudget {
  const read = (name: string, fallback: number): number => {
    const raw = env?.[name];
    if (raw === undefined || raw.trim().length === 0) return fallback;
    const value = Number(raw);
    return Number.isFinite(value) && value > 0 ? Math.floor(value) : fallback;
  };
  return {
    turnTimeoutMs: read('EDU_TURN_TIMEOUT_MS', DEFAULT_TURN_BUDGET.turnTimeoutMs),
    maxToolCalls: read('EDU_TURN_MAX_TOOL_CALLS', DEFAULT_TURN_BUDGET.maxToolCalls),
    pollIntervalMs: read('EDU_TURN_POLL_MS', DEFAULT_TURN_BUDGET.pollIntervalMs),
  };
}

/** What the turn already obtained, kept even when the turn fails. */
export interface DshTurnEvidence {
  readonly sessionId: string;
  readonly turnId: string;
  readonly reason: 'timeout' | 'tool-cap' | 'no-text';
  readonly elapsedMs: number;
  readonly toolCalls: number;
  readonly toolNames: readonly string[];
  readonly sourceRefs: readonly string[];
  readonly pdfPages: readonly number[];
  readonly printedPages: readonly string[];
  readonly assistantChars: number;
  readonly partialText: string;
  readonly seq: number | null;
}

type TurnWait =
  | { readonly kind: 'idle' }
  | { readonly kind: 'timeout' }
  | { readonly kind: 'tool-cap'; readonly toolCalls: number };

function blocksOf(message: DshMessageLike): readonly { readonly type?: string; readonly text?: string; readonly name?: string }[] {
  return Array.isArray(message.content) ? message.content : [];
}

function toolNamesOf(message: DshMessageLike): readonly string[] {
  const names: string[] = [];
  for (const block of blocksOf(message)) {
    if (block.type === 'tool-call' && typeof block.name === 'string' && block.name.length > 0) {
      names.push(block.name);
    }
  }
  return names;
}

function toolCallCountOf(messages: readonly DshMessageLike[]): number {
  let count = 0;
  for (const message of messages) {
    if (message.role !== 'assistant') continue;
    count += toolNamesOf(message).length;
  }
  return count;
}

function reasoningCharsOf(message: DshMessageLike): number {
  let chars = 0;
  for (const block of blocksOf(message)) {
    if (block.type === 'reasoning' && typeof block.text === 'string') chars += block.text.length;
  }
  return chars;
}

/**
 * The messages committed in *this* turn: everything after the learner message
 * the adapter injected. A resumed/compacted session rewrites history, so the
 * message id is the anchor and the pre-followup length is only a fallback.
 */
function turnMessages(
  messages: readonly DshMessageLike[],
  learnerMessageId: string,
  boundary: number,
): readonly DshMessageLike[] {
  const index = messages.findIndex((message) => message.id === learnerMessageId);
  if (index >= 0) return messages.slice(index + 1);
  return messages.slice(Math.min(boundary, messages.length));
}

/** Tool names, source refs and pages already resolved during the turn. */
function collectTurnEvidence(messages: readonly DshMessageLike[]): {
  readonly toolNames: readonly string[];
  readonly sourceRefs: readonly string[];
  readonly pdfPages: readonly number[];
  readonly printedPages: readonly string[];
  readonly toolCalls: number;
} {
  const toolNames = new Set<string>();
  const sourceRefs = new Set<string>();
  const pdfPages = new Set<number>();
  const printedPages = new Set<string>();
  let toolCalls = 0;
  const scan = (raw: string): void => {
    // Tool results reach the transcript as text and/or JSON; normalize escaped
    // newlines first (a JSON dump would otherwise merge a ref with the next
    // line), then unescape so `\"pdfPage\": 112` and `pdfPage=112` read alike.
    const normalized = raw.replace(/\\[nrt]/g, ' ').replace(/\\+/g, '');
    for (const match of normalized.match(/source\.[a-z0-9][a-z0-9._-]*/gi) ?? []) {
      sourceRefs.add(match.replace(/[.,;]+$/, ''));
    }
    for (const match of normalized.matchAll(/pdfPage"?\s*[:=]\s*"?(\d{1,4})/gi)) {
      const page = Number(match[1]);
      if (Number.isInteger(page) && page > 0) pdfPages.add(page);
    }
    for (const match of normalized.matchAll(/printedPage"?\s*[:=]\s*"?(?:\\")?([0-9]{1,4})/gi)) {
      printedPages.add(match[1]!);
    }
  };
  for (const message of messages) {
    for (const block of blocksOf(message)) {
      if (typeof block.text === 'string') scan(block.text);
    }
    if (message.role === 'tool') {
      scan(JSON.stringify(message));
    }
    if (message.role === 'assistant') {
      const names = toolNamesOf(message);
      toolCalls += names.length;
      for (const name of names) toolNames.add(name);
    }
  }
  return {
    toolNames: [...toolNames].sort(),
    sourceRefs: [...sourceRefs].sort(),
    pdfPages: [...pdfPages].sort((left, right) => left - right),
    printedPages: [...printedPages].sort(),
    toolCalls,
  };
}

/** Waits for idle while enforcing the wall-clock and tool-call budgets. */
function waitForTurn(
  idle: Promise<void>,
  readToolCalls: () => number,
  limits: { readonly timeoutMs: number; readonly maxToolCalls: number; readonly pollIntervalMs: number },
  onIdleError: (error: unknown) => void,
): Promise<TurnWait> {
  return new Promise<TurnWait>((resolve) => {
    let settled = false;
    const finish = (value: TurnWait): void => {
      if (settled) return;
      settled = true;
      clearInterval(timer);
      resolve(value);
    };
    const startedAt = Date.now();
    const interval = Math.max(1, limits.pollIntervalMs);
    const timer: ReturnType<typeof setInterval> = setInterval(() => {
      if (Date.now() - startedAt >= limits.timeoutMs) {
        finish({ kind: 'timeout' });
        return;
      }
      const calls = readToolCalls();
      if (calls > limits.maxToolCalls) finish({ kind: 'tool-cap', toolCalls: calls });
    }, interval);
    (timer as unknown as { unref?: () => void }).unref?.();
    idle.then(
      () => finish({ kind: 'idle' }),
      (error: unknown) => {
        onIdleError(error);
        finish({ kind: 'idle' });
      },
    );
  });
}

function sessionResumeFailure(error: unknown): ServiceResult<TutorSessionBinding> {
  // The raw TypeError text stays in the debug log, never in the student/service
  // message: only the structured marker and the recoverable condition surface.
  void error;
  return errResult(
    'UNAVAILABLE',
    `${SESSION_RESUME_FAILED}: the DSH session could not be created or resumed; a fresh session id is required`,
    true,
  );
}

/** DSH 的恢复路径实测会卡 ~60s 才抛错；超时就当作绑定失败，交给上层换新 id。 */
const SESSION_START_TIMEOUT_MS = 12_000;

function withTimeout<T>(work: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`SESSION_START_TIMEOUT after ${timeoutMs}ms`)),
      timeoutMs,
    );
    timer.unref?.();
    work.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

export function createDshTutorGateway(options: DshTutorGatewayOptions): TutorGateway {
  const model: ModelDescriptor = {
    provider: options.model.provider,
    model: options.model.model,
    text: true,
    image: options.image,
    isMock: false,
  };
  const handles = new Map<string, DshAgentHandleLike>();
  const revisions = new Map<string, number>();
  const instructions = new Map<string, { text: string }>();
  /** Sessions whose DSH turn is still running (see the budget note above). */
  const running = new Map<string, Promise<void>>();

  const open = async (session: Session): Promise<ServiceResult<TutorSessionBinding>> => {
    const existing = handles.get(session.id);
    if (existing === undefined) {
      let handle: DshAgentHandleLike | null = null;
      try {
        handle = await withTimeout(
          options.agents.create({
            sessionId: session.id,
            agentOptions: {
              provider: options.model.provider,
              model: options.model.model,
              maxTokens: options.model.maxTokens,
            },
          }),
          SESSION_START_TIMEOUT_MS,
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (message.includes('SESSION_START_TIMEOUT')) {
          options.onDebug?.({
            event: 'dsh.session.create-timeout',
            sessionId: session.id,
            message,
          });
          return sessionResumeFailure(error);
        }
        // A page reload or a second browser tab can ask for the same education
        // session while the DSH agent is still alive. Resume it instead of
        // failing the whole turn with "session already exists".
        if (options.agents.resume !== undefined && message.includes('already exists')) {
          try {
            handle = await withTimeout(
              options.agents.resume({
                sessionId: session.id,
                agentOptions: {
                  provider: options.model.provider,
                  model: options.model.model,
                  maxTokens: options.model.maxTokens,
                },
              }),
              SESSION_START_TIMEOUT_MS,
            );
          } catch (resumeError) {
            options.onDebug?.({
              event: 'dsh.session.resume-failed',
              sessionId: session.id,
              message: resumeError instanceof Error ? resumeError.message : String(resumeError),
            });
            return sessionResumeFailure(resumeError);
          }
        } else if (isSessionBindingTypeError(error)) {
          // F5: the restore path throws a TypeError for a stale/occupied id.
          // Return a structured error instead of leaking a bare TypeError.
          options.onDebug?.({
            event: 'dsh.session.create-failed',
            sessionId: session.id,
            message,
          });
          return sessionResumeFailure(error);
        } else {
          throw error;
        }
      }
      if (handle === null) {
        return sessionResumeFailure(new Error('no DSH agent handle returned'));
      }
      handles.set(session.id, handle);
      const instruction = { text: '' };
      instructions.set(session.id, instruction);
      try {
        const systemPrompt = handle.agent.ctx?.systemPrompt;
        if (systemPrompt !== undefined) {
          systemPrompt.section({
            name: `edu:teaching-skill:${session.id}`,
            order: 100,
            text: () => instruction.text,
            interpolate: false,
          });
        }
      } catch (error) {
        options.onDebug?.({
          event: 'dsh.system-instruction.error',
          sessionId: session.id,
          message: (error as Error).message,
        });
      }
    }
    const revision = revisions.get(session.id) ?? 0;
    return okResult(
      {
        educationSessionId: session.id,
        dshSessionId: session.id,
        model,
        revision,
      },
      revision,
    );
  };

  return {
    kind: 'dsh',
    async capabilities(_ctx: RequestContext): Promise<ServiceResult<TutorCapabilities>> {
      return okResult(
        {
          model,
          text: true,
          image: options.image,
          authStatus: options.authStatus,
        },
        0,
      );
    },
    startSession(_ctx: RequestContext, request: TutorSessionStartRequest) {
      return open(request.session);
    },
    async resumeSession(
      _ctx: RequestContext,
      request: { readonly sessionId: string; readonly revision: number },
    ): Promise<ServiceResult<TutorSessionBinding>> {
      if (handles.has(request.sessionId)) {
        return okResult(
          {
            educationSessionId: request.sessionId,
            dshSessionId: request.sessionId,
            model,
            revision: revisions.get(request.sessionId) ?? request.revision,
          },
          revisions.get(request.sessionId) ?? request.revision,
        );
      }
      if (options.agents.resume === undefined) {
        return errResult('NOT_FOUND', 'no resumable DSH agent for this session', false);
      }
      let handle: DshAgentHandleLike;
      try {
        handle = await withTimeout(
          options.agents.resume({
            sessionId: request.sessionId,
            agentOptions: {
              provider: options.model.provider,
              model: options.model.model,
              maxTokens: options.model.maxTokens,
            },
          }),
          SESSION_START_TIMEOUT_MS,
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (isSessionBindingTypeError(error) || message.includes('SESSION_START_TIMEOUT')) {
          options.onDebug?.({
            event: 'dsh.session.resume-failed',
            sessionId: request.sessionId,
            message,
          });
          return sessionResumeFailure(error);
        }
        throw error;
      }
      handles.set(request.sessionId, handle);
      const instruction = { text: '' };
      instructions.set(request.sessionId, instruction);
      try {
        handle.agent.ctx?.systemPrompt?.section({
          name: `edu:teaching-skill:${request.sessionId}`,
          order: 100,
          text: () => instruction.text,
          interpolate: false,
        });
      } catch (error) {
        options.onDebug?.({
          event: 'dsh.system-instruction.error',
          sessionId: request.sessionId,
          message: (error as Error).message,
        });
      }
      return okResult(
        {
          educationSessionId: request.sessionId,
          dshSessionId: request.sessionId,
          model,
          revision: request.revision,
        },
        request.revision,
      );
    },
    async sendTurn(ctx: RequestContext, request: TutorTurnRequest): Promise<ServiceResult<TutorTurnResult>> {
      const handle = handles.get(request.sessionId);
      if (handle === undefined) {
        return errResult('NOT_FOUND', 'DSH agent is not started for this session', false);
      }
      if (request.message === null || request.message.trim().length === 0) {
        return errResult('INVALID_INPUT', 'a learner turn needs a message', false);
      }
      if (running.has(request.sessionId)) {
        // A budget breach returns while DSH keeps finishing the abandoned turn.
        // Injecting another learner message would corrupt the transcript, so the
        // next turn is refused until the abandoned turn goes idle.
        return errResult(
          'CONFLICT',
          `${TURN_IN_PROGRESS}: the previous DSH turn is still running; wait for it to go idle and retry`,
          true,
        );
      }
      const instruction = instructions.get(request.sessionId);
      if (instruction !== undefined) {
        instruction.text = request.systemInstruction ?? '';
        options.onDebug?.({
          event: 'dsh.system-instruction',
          sessionId: request.sessionId,
          chars: instruction.text.length,
        });
      }
      const budget = {
        turnTimeoutMs: options.turnBudget?.turnTimeoutMs ?? DEFAULT_TURN_BUDGET.turnTimeoutMs,
        maxToolCalls: options.turnBudget?.maxToolCalls ?? DEFAULT_TURN_BUDGET.maxToolCalls,
        pollIntervalMs: options.turnBudget?.pollIntervalMs ?? DEFAULT_TURN_BUDGET.pollIntervalMs,
      };
      const turnId = `turn-${String(Date.now())}-${Math.random().toString(36).slice(2, 8)}`;
      const learnerMessageId = `msg-${String(Date.now())}-${Math.random().toString(36).slice(2, 10)}`;
      const sessionBefore = handle.agent.session ?? options.sessions.get(request.sessionId);
      const boundary = sessionBefore?.deriveMessages().length ?? 0;
      const startedAt = Date.now();
      await handle.agent.followup({
        role: 'user',
        id: learnerMessageId,
        content: [{ type: 'text', text: request.message }],
        source: { kind: 'user' },
      });
      options.onDebug?.({
        event: 'dsh.followup',
        sessionId: request.sessionId,
        turnId,
        seq: handle.agent.session?.seq ?? options.sessions.get(request.sessionId)?.seq ?? null,
      });

      const idle = Promise.resolve(handle.agent.whenIdle());
      let idleError: unknown = null;
      let tracked: Promise<void>;
      tracked = idle
        .then(
          () => undefined,
          () => undefined,
        )
        .finally(() => {
          if (running.get(request.sessionId) === tracked) running.delete(request.sessionId);
        });
      running.set(request.sessionId, tracked);
      const outcome = await waitForTurn(
        idle,
        () => {
          const live = handle.agent.session ?? options.sessions.get(request.sessionId);
          return live === undefined ? 0 : toolCallCountOf(turnMessages(live.deriveMessages(), learnerMessageId, boundary));
        },
        { timeoutMs: budget.turnTimeoutMs, maxToolCalls: budget.maxToolCalls, pollIntervalMs: budget.pollIntervalMs },
        (error) => {
          idleError = error;
        },
      );
      if (outcome.kind === 'idle' && idleError !== null) throw idleError;

      const session = handle.agent.session ?? options.sessions.get(request.sessionId);
      if (session === undefined) {
        return errResult('UNAVAILABLE', 'DSH session disappeared after the turn', true);
      }
      const messages = session.deriveMessages();
      const turn = turnMessages(messages, learnerMessageId, boundary);
      const evidence = collectTurnEvidence(turn);
      const assistantTexts = turn
        .filter((message) => message.role === 'assistant' && textOf(message).trim().length > 0)
        .map((message) => textOf(message));
      // The v11 S5 failure: the last assistant message held only a `reasoning`
      // block, so the old "take the last assistant message or fail" rule threw
      // away the text of earlier steps. Prefer the last step that wrote text.
      const lastText = assistantTexts.length === 0 ? '' : assistantTexts[assistantTexts.length - 1]!;
      // Pages the model may cite are exactly the ones the tools returned in this
      // turn; anything else is rewritten before the student sees it.
      const pageCheck = neutralizeUnsupportedPages(lastText, evidence);
      if (pageCheck.replaced.length > 0) {
        options.onDebug?.({
          event: 'dsh.page-claims.replaced',
          sessionId: request.sessionId,
          turnId,
          replaced: pageCheck.replaced,
          pdfPages: evidence.pdfPages,
          printedPages: evidence.printedPages,
        });
      }
      const text = pageCheck.text;
      const elapsedMs = Date.now() - startedAt;
      const reasoningChars = turn
        .filter((message) => message.role === 'assistant')
        .reduce((total, message) => total + reasoningCharsOf(message), 0);
      options.onDebug?.({
        event: 'dsh.idle',
        sessionId: request.sessionId,
        turnId,
        seq: session.seq ?? null,
        messages: turn.length,
        sessionMessages: messages.length,
        roles: turn.map((message) => message.role),
        texts: turn
          .filter((message) => message.role === 'assistant')
          .map((message) => textOf(message).slice(0, 200)),
        shape: turn.map((message) => ({
          role: message.role,
          blocks: Array.isArray(message.content)
            ? message.content.map((block) => block.type ?? '?')
            : typeof message.content,
        })),
        raw: turn.slice(-8).map((message) => JSON.stringify(message).slice(0, 700)),
      });

      if (outcome.kind !== 'idle' || text.trim().length === 0) {
        const reason: DshTurnEvidence['reason'] =
          outcome.kind === 'idle' ? 'no-text' : outcome.kind === 'timeout' ? 'timeout' : 'tool-cap';
        const partial: DshTurnEvidence = {
          sessionId: request.sessionId,
          turnId,
          reason,
          elapsedMs,
          toolCalls: evidence.toolCalls,
          toolNames: evidence.toolNames,
          sourceRefs: evidence.sourceRefs,
          pdfPages: evidence.pdfPages,
          printedPages: evidence.printedPages,
          assistantChars: text.length,
          partialText: text.slice(0, 400),
          seq: session.seq ?? null,
        };
        // Keep what the turn already obtained: the audit record carries the full
        // list, the student-facing error carries the short list.
        options.onDebug?.({ event: 'dsh.turn.partial', ...partial });
        options.onPartialTurn?.(partial);
        const kept =
          evidence.sourceRefs.length === 0
            ? 'no source ref was resolved'
            : `kept sources: ${evidence.sourceRefs.slice(0, 3).join(', ')}${
                evidence.sourceRefs.length > 3 ? ` (+${String(evidence.sourceRefs.length - 3)})` : ''
              }`;
        const pages =
          evidence.pdfPages.length === 0 ? '' : ` pdf pages: ${evidence.pdfPages.slice(0, 6).join('/')}`;
        const detail =
          reason === 'timeout'
            ? `the DSH turn exceeded ${String(budget.turnTimeoutMs)} ms after ${String(evidence.toolCalls)} tool call(s)`
            : reason === 'tool-cap'
              ? `the DSH turn made ${String(evidence.toolCalls)} tool call(s), over the ${String(budget.maxToolCalls)} cap`
              : `the DSH turn ended without assistant text after ${String(evidence.toolCalls)} tool call(s), ${String(reasoningChars)} reasoning chars`;
        const marker =
          reason === 'timeout'
            ? TURN_BUDGET_EXCEEDED
            : reason === 'tool-cap'
              ? TURN_TOOL_CAP_EXCEEDED
              : TURN_NO_TEXT;
        return errResult(
          reason === 'timeout' ? 'TIMEOUT' : 'UNAVAILABLE',
          `${marker}: ${detail}; ${kept}${pages}`,
          true,
          `${'dsh.turn.partial'}:${request.sessionId}:${String(session.seq ?? 0)}`,
        );
      }
      const revision = (revisions.get(request.sessionId) ?? 0) + 1;
      revisions.set(request.sessionId, revision);
      options.onTurn?.({ sessionId: request.sessionId, revision, text, model });
      return okResult(
        {
          sessionId: request.sessionId,
          revision,
          text,
          streaming: false,
          model,
          toolNames: evidence.toolNames,
        },
        revision,
      );
    },
    async endSession(
      _ctx: RequestContext,
      request: { readonly sessionId: string; readonly reason: 'completed' | 'abandoned' },
    ): Promise<ServiceResult<{ readonly endedAt: Timestamp }>> {
      const handle = handles.get(request.sessionId);
      if (handle !== undefined) {
        await handle.dispose();
        handles.delete(request.sessionId);
      }
      revisions.delete(request.sessionId);
      running.delete(request.sessionId);
      return okResult({ endedAt: options.clock.now() }, 0);
    },
  };
}

/** Guard used by the composition root before advertising a real DSH route. */
export function assertDshTutorHost(host: {
  readonly agents?: unknown;
  readonly sessions?: unknown;
}): host is { readonly agents: DshAgentsLike; readonly sessions: DshSessionsLike } {
  const candidate = host as { agents?: { create?: unknown }; sessions?: { get?: unknown } };
  return typeof candidate.agents?.create === 'function' && typeof candidate.sessions?.get === 'function';
}

export function dshVersionDescriptor(version: string): { bound: true; version: string; sourceRef: string } {
  return { bound: true, version, sourceRef: 'docs/rebuild/runtime-lock.json#source' };
}
