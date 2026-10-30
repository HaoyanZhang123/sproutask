/**
 * T14/S5 regression: a DSH turn that loops on tools or ends with a
 * reasoning-only assistant message must not lose the evidence it obtained.
 *
 * The v11 product run (`/edu/api/g1/tutor/turn`, u2.ch3 sample) spent 35.4 s on
 * 14 tool round-trips and then failed with `NETWORK: DSH turn produced no
 * assistant text`, fell back to the local rule grader and reported 0 anchors.
 * These tests pin the fixed contract:
 *   - a turn has a wall-clock budget and a tool-call cap;
 *   - exceeding either yields a structured, retryable error marker;
 *   - the tool names / resolved source refs / PDF pages are kept and surfaced;
 *   - a later assistant step without text no longer hides an earlier answer.
 */

import { describe, expect, it, vi } from 'vitest';
import type { RequestContext, Session } from '@edu/domain';
import {
  createDshTutorGateway,
  isPartialTurnFailure,
  TURN_BUDGET_EXCEEDED,
  TURN_IN_PROGRESS,
  TURN_NO_TEXT,
  TURN_TOOL_CAP_EXCEEDED,
  type DshAgentHandleLike,
  type DshMessageLike,
  type DshSessionLike,
} from '../src/index.js';

const ctx: RequestContext = {
  requestId: 'request.s5',
  learnerId: 'learner.1',
  now: '2026-10-31T00:00:00Z',
};

function session(): Session {
  return {
    schemaVersion: 1 as const,
    id: 'session.s5',
    learnerId: 'learner.1',
    courseEditionId: 'course.bio7a',
    packVersion: '2.0.0',
    trustMode: 'candidate' as const,
    conceptId: 'concept.bio7a.u2ch3s2.bacteria',
    mode: 'learn' as const,
    status: 'active' as const,
    startedAt: '2026-10-31T00:00:00Z',
    endedAt: null,
    resumeCursor: { activityId: null, cursor: null },
    dshSessionId: null,
  };
}

/** A fake DSH session: messages appended by the fake agent's scripted steps. */
class FakeSession implements DshSessionLike {
  messages: DshMessageLike[] = [
    { role: 'system', content: [{ type: 'text', text: 'tutor persona' }] },
  ];
  seq = 0;

  deriveMessages(): readonly DshMessageLike[] {
    return this.messages;
  }

  push(message: DshMessageLike): void {
    this.messages.push(message);
    this.seq += 1;
  }
}

interface ScriptedAgent {
  readonly agent: {
    session: FakeSession;
    followup(input: {
      id?: string;
      content: readonly { type: 'text'; text: string }[];
    }): void;
    whenIdle(): Promise<void>;
  };
}


function toolStep(names: readonly string[], id = `step-${String(Date.now())}`): DshMessageLike {
  return {
    id,
    role: 'assistant',
    content: [
      { type: 'reasoning', text: 'we should look at the concept sources' },
      ...names.map((name, index) => ({ type: 'tool-call', name, id: `call-${String(index)}` })),
    ],
  };
}

function toolResult(sourceRefs: readonly string[], pages: readonly number[]): DshMessageLike {
  const text = [
    `sourceRefs: ${sourceRefs.join(', ')}`,
    ...pages.map((page) => `edu_resolve_source -> pdfPage=${String(page)} printedPage=null`),
  ].join('\n');
  return { role: 'tool', content: [{ type: 'text', text }] };
}

function assistantText(text: string): DshMessageLike {
  return { role: 'assistant', content: [{ type: 'reasoning', text: 'settled' }, { type: 'text', text }] };
}

function harness(options: {
  readonly run: (session: FakeSession) => Promise<void>;
}) {
  const fakeSession = new FakeSession();
  let resolveIdle: (() => void) | null = null;
  const idle = new Promise<void>((resolve) => {
    resolveIdle = resolve;
  });
  const handle: DshAgentHandleLike = {
    agent: {
      session: fakeSession,
      followup(input) {
        // The adapter injects the learner turn; commit it like DSH does so the
        // turn boundary (message id) is real in this fake session.
        fakeSession.push({
          id: input.id ?? `msg-${String(fakeSession.seq)}`,
          role: 'user',
          content: [{ type: 'text', text: input.content[0]?.text ?? '' }],
        });
        void options.run(fakeSession).then(() => resolveIdle?.());
      },
      whenIdle() {
        return idle;
      },
    },
    dispose: async () => undefined,
  };
  const agents = {
    create: async () => handle,
  };
  return { agents, sessions: { get: () => fakeSession }, fakeSession };
}

function gateway(
  harnessResult: ReturnType<typeof harness>,
  budget: { turnTimeoutMs: number; maxToolCalls: number; pollIntervalMs: number },
  onPartialTurn?: (evidence: unknown) => void,
) {
  return createDshTutorGateway({
    agents: harnessResult.agents,
    sessions: harnessResult.sessions,
    model: { provider: 'deepseek-official', model: 'deepseek-flash', maxTokens: 3200 },
    authStatus: 'available',
    image: true,
    clock: { now: () => '2026-10-31T00:00:00Z' as never },
    dshVersion: '0.2.1-rc.3',
    turnBudget: budget,
    onDebug: () => undefined,
    ...(onPartialTurn === undefined ? {} : { onPartialTurn }),
  });
}

async function started(gw: ReturnType<typeof gateway>): Promise<void> {
  const binding = await gw.startSession(ctx, { session: session() });
  expect(binding.ok).toBe(true);
}

describe('DSH turn budget (T14/S5)', () => {
  it('stops a runaway tool loop at the cap and keeps the resolved sources', async () => {
    const partials: unknown[] = [];
    // The fake agent appends tool steps in a burst, far past the cap.
    const run = async (fakeSession: FakeSession): Promise<void> => {
      for (let step = 0; step < 12; step += 1) {
        fakeSession.push(toolStep(['edu_get_concept', 'edu_resolve_source'], `assistant-${String(step)}`));
        fakeSession.push(toolResult(['source.bio7a.sec.u2ch3s2.heading'], [112 + step]));
        await new Promise((resolve) => setTimeout(resolve, 2));
      }
    };
    const h = harness({ run });
    const gw = gateway(h, { turnTimeoutMs: 5_000, maxToolCalls: 4, pollIntervalMs: 5 }, (evidence) =>
      partials.push(evidence),
    );
    await started(gw);

    const result = await gw.sendTurn(ctx, {
      sessionId: 'session.s5',
      revision: 0,
      message: '细菌和真菌在结构上最主要的区别是什么？',
      activityId: null,
      stream: false,
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('UNAVAILABLE');
    expect(result.error.message).toContain(TURN_TOOL_CAP_EXCEEDED);
    expect(isPartialTurnFailure(result.error.message)).toBe(true);
    expect(result.error.retryable).toBe(true);
    // Evidence is surfaced, not discarded.
    expect(result.error.message).toContain('source.bio7a.sec.u2ch3s2.heading');
    expect(result.error.message).toContain('pdf pages:');
    expect(result.error.detailsRef).toMatch(/^dsh\.turn\.partial:session\.s5:/);

    expect(partials).toHaveLength(1);
    const evidence = partials[0] as {
      reason: string;
      toolCalls: number;
      toolNames: string[];
      sourceRefs: string[];
      pdfPages: number[];
    };
    expect(evidence.reason).toBe('tool-cap');
    expect(evidence.toolCalls).toBeGreaterThan(4);
    expect(evidence.toolNames).toEqual(['edu_get_concept', 'edu_resolve_source']);
    expect(evidence.sourceRefs).toContain('source.bio7a.sec.u2ch3s2.heading');
    expect(evidence.pdfPages.length).toBeGreaterThan(0);
  });

  it('converts a wall-clock overrun into a structured TIMEOUT with partial evidence', async () => {
    const partials: unknown[] = [];
    const run = async (fakeSession: FakeSession): Promise<void> => {
      fakeSession.push(toolStep(['edu_get_concept'], 'assistant-slow'));
      fakeSession.push(toolResult(['source.bio7a.sec.u2ch3s2.obj1'], [112]));
      // Never resolves: the agent is stuck waiting on the model.
      await new Promise<void>(() => undefined);
    };
    const h = harness({ run });
    const gw = gateway(h, { turnTimeoutMs: 25, maxToolCalls: 10, pollIntervalMs: 5 }, (evidence) =>
      partials.push(evidence),
    );
    await started(gw);

    const result = await gw.sendTurn(ctx, {
      sessionId: 'session.s5',
      revision: 0,
      message: '请解释细菌的结构',
      activityId: null,
      stream: false,
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('TIMEOUT');
    expect(result.error.message).toContain(TURN_BUDGET_EXCEEDED);
    expect(result.error.message).toContain('source.bio7a.sec.u2ch3s2.obj1');
    expect((partials[0] as { reason: string }).reason).toBe('timeout');

    // The abandoned DSH turn is still running: a second turn must not be
    // injected into the transcript until it goes idle.
    const second = await gw.sendTurn(ctx, {
      sessionId: 'session.s5',
      revision: 0,
      message: '再讲一次',
      activityId: null,
      stream: false,
    });
    expect(second.ok).toBe(false);
    if (!second.ok) {
      expect(second.error.code).toBe('CONFLICT');
      expect(second.error.message).toContain(TURN_IN_PROGRESS);
    }
  });

  it('reports a reasoning-only turn as TURN_NO_TEXT but keeps the tool evidence', async () => {
    const partials: unknown[] = [];
    const run = async (fakeSession: FakeSession): Promise<void> => {
      // Exactly the v11 S5 shape: several tool steps, then a final assistant
      // message that only contains a `reasoning` block.
      fakeSession.push(toolStep(['edu_get_concept'], 'assistant-1'));
      fakeSession.push(toolResult(['source.bio7a.sec.u2ch3s2.heading'], [112]));
      fakeSession.push(toolStep(['edu_resolve_source', 'edu_list_activities'], 'assistant-2'));
      fakeSession.push(toolResult(['source.bio7a.sec.u2ch3s3.obj1'], [118]));
      fakeSession.push({
        role: 'assistant',
        content: [{ type: 'reasoning', text: 'Need produce answer but the budget is gone' }],
      });
    };
    const h = harness({ run });
    const gw = gateway(h, { turnTimeoutMs: 5_000, maxToolCalls: 10, pollIntervalMs: 5 }, (evidence) =>
      partials.push(evidence),
    );
    await started(gw);

    const result = await gw.sendTurn(ctx, {
      sessionId: 'session.s5',
      revision: 0,
      message: '细菌和真菌在结构上最主要的区别是什么？',
      activityId: null,
      stream: false,
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.message).toContain(TURN_NO_TEXT);
    expect(result.error.message).not.toContain('DSH turn produced no assistant text');
    expect(result.error.message).toContain('source.bio7a.sec.u2ch3s2.heading');
    const evidence = partials[0] as {
      reason: string;
      toolCalls: number;
      toolNames: string[];
      sourceRefs: string[];
      pdfPages: number[];
      assistantChars: number;
    };
    expect(evidence.reason).toBe('no-text');
    expect(evidence.toolCalls).toBe(3);
    expect(evidence.toolNames).toEqual([
      'edu_get_concept',
      'edu_list_activities',
      'edu_resolve_source',
    ]);
    expect(evidence.sourceRefs).toEqual([
      'source.bio7a.sec.u2ch3s2.heading',
      'source.bio7a.sec.u2ch3s3.obj1',
    ]);
    expect(evidence.pdfPages).toEqual([112, 118]);
    expect(evidence.assistantChars).toBe(0);
  });

  it('uses the last assistant step that wrote text instead of failing on a trailing reasoning step', async () => {
    const run = async (fakeSession: FakeSession): Promise<void> => {
      fakeSession.push(toolStep(['edu_get_concept'], 'assistant-1'));
      fakeSession.push(toolResult(['source.bio7a.sec.u2ch3s2.heading'], [112]));
      fakeSession.push(assistantText('细菌没有成形的细胞核，属于原核生物。'));
      fakeSession.push({ role: 'assistant', content: [{ type: 'reasoning', text: 'final thoughts only' }] });
    };
    const h = harness({ run });
    const gw = gateway(h, { turnTimeoutMs: 5_000, maxToolCalls: 10, pollIntervalMs: 5 });
    await started(gw);

    const result = await gw.sendTurn(ctx, {
      sessionId: 'session.s5',
      revision: 0,
      message: '细菌有细胞核吗？',
      activityId: null,
      stream: false,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.text).toBe('细菌没有成形的细胞核，属于原核生物。');
    expect(result.data.toolNames).toEqual(['edu_get_concept']);
    // Only the text this turn produced — never a previous turn's answer.
    expect(result.data.revision).toBe(1);
  });

  it('ignores an older turn: a later turn with no assistant text is not answered with the previous reply', async () => {
    let followup = 0;
    const h = harness({
      run: async (fakeSession: FakeSession): Promise<void> => {
        followup += 1;
        if (followup === 1) {
          fakeSession.push(assistantText('上一轮的回答。'));
          return;
        }
        // Second turn: the model reasons and never writes text.
        fakeSession.push({ role: 'assistant', content: [{ type: 'reasoning', text: 'still thinking' }] });
      },
    });
    const gw = gateway(h, { turnTimeoutMs: 5_000, maxToolCalls: 10, pollIntervalMs: 5 });
    await started(gw);
    const turnOne = await gw.sendTurn(ctx, {
      sessionId: 'session.s5',
      revision: 0,
      message: '第一轮',
      activityId: null,
      stream: false,
    });
    expect(turnOne.ok).toBe(true);

    const turnTwo = await gw.sendTurn(ctx, {
      sessionId: 'session.s5',
      revision: 1,
      message: '第二轮',
      activityId: null,
      stream: false,
    });
    expect(turnTwo.ok).toBe(false);
    if (turnTwo.ok) return;
    expect(turnTwo.error.message).toContain(TURN_NO_TEXT);
    expect(turnTwo.error.message).not.toContain('上一轮的回答');
  });
});
