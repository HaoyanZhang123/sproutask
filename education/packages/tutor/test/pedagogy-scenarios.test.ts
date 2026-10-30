/**
 * 12 teaching-behaviour classes (07 §4) replayed twice against the mock gateway.
 *
 * The scripted gateway is explicitly `isMock: true`; every step asserts the
 * teaching action, whether sources were cited, whether an answer was disclosed,
 * whether difficulty was reduced and whether any tool call escaped the
 * allowlist. Round 2 must produce the same normalised trace as round 1.
 *
 * This is an engineering regression, not a semantic model evaluation: live model
 * judgement and real DSH semantics belong to T13/T15.
 */

import { describe, expect, it } from 'vitest';
import type { MockTurnStep, TutorTurnInput, TutorTurnOutcome } from '../src/index.js';
import {
  makeCandidate,
  met,
  notMet,
  startHarness,
  unclear,
  writeEvidence,
  type Harness,
} from './helpers.js';

interface StepExpectation {
  readonly action: string;
  readonly disclosure?: boolean;
  readonly difficulty?: 'same' | 'reduced' | 'increased';
  readonly guidance?: string;
  readonly factualClaims?: boolean;
  readonly requiresSource?: boolean;
  readonly messageIncludes?: readonly string[];
  readonly rejectedReasons?: readonly string[];
  readonly toolDenials?: readonly string[];
  readonly auditIncludes?: readonly string[];
  readonly attemptHelpKinds?: readonly string[];
  readonly feedbackPending?: boolean;
  readonly consecutiveFailures?: number;
  readonly stateDifficulty?: 'standard' | 'reduced';
}

interface StepDefinition {
  readonly input: Omit<TutorTurnInput, 'sessionId' | 'revision' | 'requestId'>;
  readonly expect: StepExpectation;
}

interface ScenarioDefinition {
  readonly id: string;
  readonly label: string;
  readonly mode?: 'learn' | 'review';
  readonly conceptId?: string;
  readonly script: readonly MockTurnStep[];
  readonly steps: readonly StepDefinition[];
  readonly finalAssert?: (outcomes: readonly TutorTurnOutcome[], harness: Harness) => void;
}

interface NormalisedStep {
  readonly action: string;
  readonly guidance: string;
  readonly disclosure: boolean;
  readonly difficulty: string;
  readonly factualClaims: boolean;
  readonly sourceRefs: readonly string[];
  readonly messageHasSourceCitation: boolean;
  readonly messageHasDisclosureNote: boolean;
  readonly rejectedReasons: readonly string[];
  readonly toolDenials: readonly string[];
  readonly attemptHelpKinds: readonly string[];
  readonly feedbackPending: boolean | null;
  readonly consecutiveFailures: number;
  readonly stateDifficulty: string;
}

function normalise(outcome: TutorTurnOutcome): NormalisedStep {
  return {
    action: outcome.decision.action,
    guidance: outcome.decision.guidance,
    disclosure: outcome.decision.disclosure,
    difficulty: outcome.decision.difficulty,
    factualClaims: outcome.decision.factualClaims,
    sourceRefs: outcome.decision.sourceRefs,
    messageHasSourceCitation: outcome.message.includes('参考：'),
    messageHasDisclosureNote: outcome.message.includes('已标记为看过答案'),
    rejectedReasons: (outcome.attemptOutcome?.rejectedCandidates ?? []).map((item) => item.reason),
    toolDenials: outcome.toolResults
      .filter((tool) => !tool.ok)
      .map((tool) => `${tool.name}:${tool.code ?? 'UNKNOWN'}`),
    attemptHelpKinds: (outcome.attemptOutcome?.attempt.helpUsed ?? []).map((help) => help.kind),
    feedbackPending: outcome.attemptOutcome?.feedbackPending ?? null,
    consecutiveFailures: outcome.state.consecutiveFailures,
    stateDifficulty: outcome.state.difficulty,
  };
}

async function runScenario(
  definition: ScenarioDefinition,
  round: number,
): Promise<{ readonly steps: readonly NormalisedStep[]; readonly outcomes: readonly TutorTurnOutcome[]; readonly harness: Harness }> {
  const harness = await startHarness({
    turns: definition.script,
    ...(definition.mode === undefined ? {} : { mode: definition.mode }),
    ...(definition.conceptId === undefined ? {} : { conceptId: definition.conceptId }),
  });
  const outcomes: TutorTurnOutcome[] = [];
  const steps: NormalisedStep[] = [];
  for (const [index, step] of definition.steps.entries()) {
    const state = harness.service.getState(harness.session.id);
    expect(state).not.toBeNull();
    const result = await harness.service.submitTurn(harness.ctx(`${definition.id}.round${round}.step${index}`), {
      requestId: `${definition.id}.round${round}.step${index}`,
      sessionId: harness.session.id,
      revision: state?.revision ?? 0,
      ...step.input,
    });
    expect(result.ok, `${definition.id} step ${index} failed: ${result.ok ? '' : JSON.stringify(result.error)}`).toBe(true);
    if (!result.ok) throw new Error('unreachable');
    const outcome = result.data;
    outcomes.push(outcome);
    const normalised = normalise(outcome);
    steps.push(normalised);

    const expectation = step.expect;
    expect(outcome.decision.action, `${definition.id}#${index} action`).toBe(expectation.action);
    if (expectation.disclosure !== undefined) {
      expect(outcome.decision.disclosure, `${definition.id}#${index} disclosure`).toBe(expectation.disclosure);
    }
    if (expectation.difficulty !== undefined) {
      expect(outcome.decision.difficulty, `${definition.id}#${index} difficulty`).toBe(expectation.difficulty);
    }
    if (expectation.guidance !== undefined) {
      expect(outcome.decision.guidance, `${definition.id}#${index} guidance`).toBe(expectation.guidance);
    }
    if (expectation.factualClaims !== undefined) {
      expect(outcome.decision.factualClaims, `${definition.id}#${index} factualClaims`).toBe(
        expectation.factualClaims,
      );
    }
    if (expectation.requiresSource === true) {
      expect(outcome.decision.sourceRefs.length, `${definition.id}#${index} source refs`).toBeGreaterThan(0);
      expect(normalised.messageHasSourceCitation, `${definition.id}#${index} citation`).toBe(true);
    }
    for (const text of expectation.messageIncludes ?? []) {
      expect(outcome.message, `${definition.id}#${index} message`).toContain(text);
    }
    if (expectation.rejectedReasons !== undefined) {
      expect(normalised.rejectedReasons, `${definition.id}#${index} rejected`).toEqual(
        expectation.rejectedReasons,
      );
    }
    if (expectation.toolDenials !== undefined) {
      expect(normalised.toolDenials, `${definition.id}#${index} tool denials`).toEqual(
        expectation.toolDenials,
      );
    }
    for (const kind of expectation.auditIncludes ?? []) {
      expect(
        outcome.audit.map((event) => event.kind),
        `${definition.id}#${index} audit`,
      ).toContain(kind);
    }
    if (expectation.attemptHelpKinds !== undefined) {
      expect(normalised.attemptHelpKinds, `${definition.id}#${index} help kinds`).toEqual(
        expectation.attemptHelpKinds,
      );
    }
    if (expectation.feedbackPending !== undefined) {
      expect(normalised.feedbackPending, `${definition.id}#${index} feedbackPending`).toBe(
        expectation.feedbackPending,
      );
    }
    if (expectation.consecutiveFailures !== undefined) {
      expect(normalised.consecutiveFailures, `${definition.id}#${index} failures`).toBe(
        expectation.consecutiveFailures,
      );
    }
    if (expectation.stateDifficulty !== undefined) {
      expect(normalised.stateDifficulty, `${definition.id}#${index} state difficulty`).toBe(
        expectation.stateDifficulty,
      );
    }
  }
  return { steps, outcomes, harness };
}

/* ------------------------------------------------------------ definitions */

const scenarios: readonly ScenarioDefinition[] = [
  {
    id: 'S01-correct-explanation',
    label: '正确解释：解释达到 rubric 标准 → 确认并推进',
    conceptId: 'concept.cell',
    script: [
      {
        text: '你抓住了“结构和功能的基本单位”，这就是评分要点。下一个活动换成迁移题。',
        signals: { answerQuality: 'correct' },
        grade: met(),
        evidenceCandidates: [makeCandidate()],
      },
    ],
    steps: [
      {
        input: {
          attempt: {
            activityId: 'activity.cell-explain',
            inputType: 'text',
            answerText: '细胞是生物体结构和功能的基本单位，所以它是基本单位。',
          },
        },
        expect: {
          action: 'confirm_understanding',
          disclosure: false,
          rejectedReasons: [],
          feedbackPending: false,
          consecutiveFailures: 0,
        },
      },
    ],
  },
  {
    id: 'S02-core-misconception',
    label: '核心误解：明确纠错并给来源，不把模型当事实来源',
    conceptId: 'concept.cell',
    script: [
      {
        text: '“所有细胞都一样大”是常见误解：细胞形态大小与功能相适应。',
        signals: { answerQuality: 'incorrect', coreMisconception: true },
        grade: notMet(),
        evidenceCandidates: [makeCandidate({ result: 'not_met' })],
      },
    ],
    steps: [
      {
        input: {
          attempt: {
            activityId: 'activity.cell-explain',
            inputType: 'text',
            answerText: '所有细胞都一样大，所以细胞没有区别。',
          },
        },
        expect: {
          action: 'explicit_correction',
          disclosure: false,
          factualClaims: true,
          requiresSource: true,
          rejectedReasons: [],
          consecutiveFailures: 1,
        },
      },
    ],
  },
  {
    id: 'S03-term-only',
    label: '只背术语：先追问自己的话解释一次（有上限）',
    conceptId: 'concept.cell',
    script: [
      {
        text: '你复述了定义的词，但还没说明它的意思。试着用自己的话讲一遍。',
        signals: { answerQuality: 'term_only' },
        grade: met(),
        evidenceCandidates: [makeCandidate({ result: 'met' })],
      },
    ],
    steps: [
      {
        input: {
          attempt: { activityId: 'activity.cell-explain', inputType: 'text', answerText: '细胞就是细胞。' },
        },
        expect: {
          action: 'probe_question',
          guidance: 'probe',
          disclosure: false,
          rejectedReasons: [],
          consecutiveFailures: 0,
        },
      },
    ],
  },
  {
    id: 'S04-repeated-failure',
    label: '连续答不出：第二次失败即降难度并给步骤化示范，不无限反问',
    conceptId: 'concept.cell',
    script: [
      {
        text: '先看一个提示：从“结构”和“功能”两个词入手。',
        signals: { answerQuality: 'incorrect' },
        grade: notMet(),
        evidenceCandidates: [makeCandidate({ result: 'not_met' })],
      },
      {
        text: '我带你一步步做：第一步找关键词，第二步连成一句话，第三步核对评分要点。',
        signals: { answerQuality: 'incorrect', intent: 'frustrated' },
        grade: notMet(),
        evidenceCandidates: [makeCandidate({ result: 'not_met' })],
      },
    ],
    steps: [
      {
        input: {
          attempt: { activityId: 'activity.cell-explain', inputType: 'text', answerText: '不知道。' },
        },
        expect: {
          action: 'hint',
          disclosure: false,
          difficulty: 'reduced',
          rejectedReasons: [],
          consecutiveFailures: 1,
        },
      },
      {
        input: {
          attempt: { activityId: 'activity.cell-explain', inputType: 'text', answerText: '还是不知道。' },
        },
        expect: {
          action: 'worked_example',
          disclosure: true,
          difficulty: 'reduced',
          stateDifficulty: 'reduced',
          rejectedReasons: [],
          consecutiveFailures: 2,
        },
      },
    ],
  },
  {
    id: 'S05-requested-explanation',
    label: '请求完整解释：直接分层解释并给来源，不拒答',
    conceptId: 'concept.cell',
    script: [
      {
        text: '第一层：细胞是生物体结构和功能的基本单位；第二层：不同细胞形态与功能相适应。',
        signals: { intent: 'requests_explanation' },
      },
    ],
    steps: [
      {
        input: { message: '我完全不理解，能完整解释一下吗？', helpRequest: 'explanation' },
        expect: {
          action: 'layered_explanation',
          disclosure: false,
          factualClaims: true,
          requiresSource: true,
        },
      },
    ],
  },
  {
    id: 'S06-wants-answer',
    label: '只要答案：直接给答案并标记 disclosure，之后作答不算独立证据',
    conceptId: 'concept.cell',
    script: [
      {
        text: '完整答案见上，评分要点来自本活动的 rubric。',
        signals: { intent: 'wants_answer' },
      },
      {
        text: '在看过答案后你还答出来了，这只能算 assisted 证据。',
        signals: { answerQuality: 'correct' },
        grade: met(),
        evidenceCandidates: [makeCandidate({ assistance: 'unassisted' })],
      },
    ],
    steps: [
      {
        input: { message: '别问了，直接告诉我答案。' },
        expect: {
          action: 'answer_disclosure',
          disclosure: true,
          factualClaims: true,
          requiresSource: true,
          messageIncludes: ['已标记为看过答案', '这是本题的完整答案'],
        },
      },
      {
        input: {
          attempt: {
            activityId: 'activity.cell-explain',
            inputType: 'text',
            answerText: '细胞是结构和功能的基本单位。',
          },
        },
        expect: {
          action: 'confirm_understanding',
          rejectedReasons: ['DISCLOSURE_INDEPENDENCE_LOST'],
          attemptHelpKinds: ['answer'],
          feedbackPending: true,
        },
      },
    ],
  },
  {
    id: 'S07-frustration',
    label: '受挫：降低压力并解释，不继续追问',
    conceptId: 'concept.cell',
    script: [
      {
        text: '先不用一次答完整，我们拆成两步：先看结构，再说功能。',
        signals: { intent: 'frustrated' },
      },
    ],
    steps: [
      {
        input: { message: '太难了，我不想做了。' },
        expect: {
          action: 'layered_explanation',
          difficulty: 'reduced',
          disclosure: false,
          factualClaims: true,
          requiresSource: true,
        },
      },
    ],
  },
  {
    id: 'S08-missing-prerequisite',
    label: '无前置：给出前置概念但不锁定当前概念',
    conceptId: 'concept.cell-structure',
    script: [
      {
        text: '你卡住的地方可能是前置概念“细胞”。先补这一块，再回来也可以。',
        signals: { intent: 'confused', missingPrerequisite: true },
      },
    ],
    steps: [
      {
        input: { message: '我不知道细胞结构是什么，前面是不是没学过？' },
        expect: {
          action: 'prerequisite_support',
          difficulty: 'reduced',
          disclosure: false,
          messageIncludes: ['前置概念：细胞', '不会锁定当前概念'],
          factualClaims: true,
          requiresSource: true,
        },
      },
    ],
  },
  {
    id: 'S09-answer-viewed-then-answer',
    label: '已看答案再答：证据标 assisted，不冒充独立掌握',
    conceptId: 'concept.cell',
    script: [
      {
        text: '这是完整答案：细胞是生物体结构和功能的基本单位。',
        signals: { intent: 'wants_answer' },
      },
      {
        text: '你复述得对，但这是看过答案后的作答。',
        signals: { answerQuality: 'correct' },
        grade: met(),
        evidenceCandidates: [makeCandidate({ assistance: 'assisted' })],
      },
    ],
    steps: [
      {
        input: { message: '给我答案吧。' },
        expect: { action: 'answer_disclosure', disclosure: true, factualClaims: true, requiresSource: true },
      },
      {
        input: {
          attempt: {
            activityId: 'activity.cell-explain',
            inputType: 'text',
            answerText: '细胞是生物体结构和功能的基本单位。',
          },
        },
        expect: {
          action: 'confirm_understanding',
          attemptHelpKinds: ['answer'],
          rejectedReasons: [],
          feedbackPending: false,
        },
      },
    ],
    finalAssert: (outcomes, harness) => {
      const committed = harness.learner.committed.at(-1);
      expect(committed?.assistance).toBe('assisted');
      expect(outcomes[1]?.attemptOutcome?.outcomes.length).toBe(1);
    },
  },
  {
    id: 'S10-textbook-conflict',
    label: '教材与学生说法冲突：分开列依据，不编造权威',
    conceptId: 'concept.cell',
    script: [
      {
        text: '你提到的说法和材料不一致。我把你的说法和材料依据分开列：材料依据是来源记录，学生说法是数据。',
        signals: { intent: 'textbook_conflict', textbookConflict: true },
      },
    ],
    steps: [
      {
        input: { message: '我记得书上说所有细胞都一样大，和这里讲的不一样。' },
        expect: {
          action: 'source_conflict',
          disclosure: false,
          factualClaims: true,
          requiresSource: true,
          messageIncludes: ['两边依据分开看'],
        },
      },
    ],
  },
  {
    id: 'S11-blurry-image',
    label: '模糊图片：不猜、不判错，要求重传或文字描述',
    conceptId: 'concept.cell',
    script: [
      {
        text: '图片无法辨认，不能据此判断对错。请重传清晰图片，或用文字描述你标注的部位。',
        signals: { imageQuality: 'blurry', answerQuality: 'unclear' },
        grade: unclear(),
        evidenceCandidates: [],
      },
    ],
    steps: [
      {
        input: {
          attempt: {
            activityId: 'activity.cell-explain',
            inputType: 'image',
            answerAssetId: 'asset.answer.t07.fixture',
          },
          imageQuality: 'blurry',
        },
        expect: {
          action: 'clarify_image',
          disclosure: false,
          rejectedReasons: [],
          feedbackPending: true,
          consecutiveFailures: 0,
          messageIncludes: ['这张图片我无法确认', '当作答错'],
        },
      },
    ],
    finalAssert: (_outcomes, harness) => {
      expect(harness.learner.count('recordGradedAttempt')).toBe(0);
      expect(harness.learner.cancelledAttempts.length).toBeGreaterThan(0);
    },
  },
  {
    id: 'S12-cross-chapter-transfer',
    label: '跨章迁移：给迁移桥接并引用来源；模型越权工具调用被拒绝',
    conceptId: 'concept.cell',
    script: [
      {
        text: '同一条原理可以迁移：细胞是基本单位，所以不同章节都在讨论细胞的结构与功能。',
        signals: { intent: 'transfer_question', crossChapter: true },
        toolCalls: [
          { name: 'bash', args: { command: 'Get-ChildItem C:\\' } },
          { name: 'read_file', args: { path: 'C:\\Windows\\win.ini' } },
        ],
      },
    ],
    steps: [
      {
        input: { message: '这一节和后面的章节有什么关系？能不能迁移过去？' },
        expect: {
          action: 'transfer_bridge',
          disclosure: false,
          factualClaims: true,
          requiresSource: true,
          toolDenials: ['bash:UNKNOWN_TOOL', 'read_file:UNKNOWN_TOOL'],
          auditIncludes: ['permission.denied', 'tool.rejected'],
        },
      },
    ],
  },
];

describe('12 teaching-behaviour classes, two independent replay rounds (mock gateway)', () => {
  it('records 12/12 expected actions in both rounds with identical traces', async () => {
    const rounds: { round: number; scenarios: Record<string, readonly NormalisedStep[]> }[] = [];
    for (const round of [1, 2]) {
      const observed: Record<string, readonly NormalisedStep[]> = {};
      for (const definition of scenarios) {
        const ran = await runScenario(definition, round);
        definition.finalAssert?.(ran.outcomes, ran.harness);
        observed[definition.id] = ran.steps;
      }
      rounds.push({ round, scenarios: observed });
    }
    expect(Object.keys(rounds[0]?.scenarios ?? {})).toHaveLength(12);
    expect(rounds[1]?.scenarios).toEqual(rounds[0]?.scenarios);

    const evidence = {
      task: 'T07',
      kind: 'teaching-behaviour-replay',
      generatedAt: new Date().toISOString(),
      model: {
        provider: 'edu-mock',
        model: 'scripted-tutor-1',
        isMock: true,
        note: 'scripted mock gateway; NOT a real DSH or live model run (T13/T15 own live semantics)',
      },
      content: {
        pack: 'pack.biology-7a',
        version: '1.0.0',
        scope: 'frozen T01 synthetic fixture pack (no real textbook text)',
      },
      scenarios: scenarios.map((definition) => ({ id: definition.id, label: definition.label })),
      rounds,
      summary: {
        scenarioCount: scenarios.length,
        rounds: rounds.length,
        expectedActions: scenarios.map((definition) => ({
          id: definition.id,
          actions: definition.steps.map((step) => step.expect.action),
        })),
        result: 'PASS (offline regression, both rounds identical)',
      },
    };
    const written = writeEvidence('replay-12-classes.json', evidence);
    // eslint-disable-next-line no-console
    console.log(`T07 evidence: ${written.file} sha256=${written.sha256}`);
  });

  it('uses a mock-labelled model descriptor only', async () => {
    const harness = await startHarness({
      turns: [{ text: 'mock', signals: {}, grade: met(), evidenceCandidates: [makeCandidate()] }],
    });
    const state = harness.service.getState(harness.session.id);
    const result = await harness.service.submitTurn(harness.ctx('mock-label-check'), {
      requestId: 'mock-label-check',
      sessionId: harness.session.id,
      revision: state?.revision ?? 0,
      attempt: { activityId: 'activity.cell-explain', inputType: 'text', answerText: '细胞是基本单位。' },
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.model.isMock).toBe(true);
    expect(result.data.gateway).toBe('mock');
  });
});

export { scenarios };
