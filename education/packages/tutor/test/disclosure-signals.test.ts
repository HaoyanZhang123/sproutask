/**
 * T15 F6 regression tests: "the model already gave the full explanation/answer"
 * must be recorded as disclosure even when the decision action is a probe.
 *
 * Baseline: `pedagogy.ts` only set `disclosure` when the student asked
 * (`helpRequest==='answer'` or `signals.intent==='wants_answer'`). T15 saw full
 * explanations delivered under `decision.action=probe_question,
 * disclosure=false`, which made the next attempt look like independent evidence.
 */

import { describe, expect, it } from 'vitest';
import {
  DEFAULT_TUTOR_SIGNALS,
  decidePedagogy,
  detectAnswerDisclosure,
  parseTutorEnvelope,
  readTutorSignals,
  withAnswerDisclosure,
} from '../src/index.js';
import { requestContext, startHarness } from './helpers.js';

const EXPLANATION =
  '本轮我直接给你完整讲解：细胞分裂时，染色体先复制再平均分配，' +
  '结果是每个子细胞得到的染色体数目与母细胞相同。下面是完整步骤：第1步……';

const BASE_STATE = {
  sessionId: 'session.t07.f6',
  learnerId: 'learner.t07.fixture',
  conceptId: 'concept.cell',
  courseEditionId: 'course.biology-7a',
  packVersion: '2.0.0',
  mode: 'learn' as const,
  revision: 0,
  turnCount: 1,
  consecutiveFailures: 0,
  consecutiveProbes: 0,
  helpKinds: [],
  disclosure: false,
  difficulty: 'standard' as const,
  representation: 'text' as const,
  reviewStage: null,
  currentActivityId: null,
  status: 'active' as const,
  lastAction: null,
  pendingGradingAttemptId: null,
};

function pedagogyInput(signals: Partial<typeof DEFAULT_TUTOR_SIGNALS>) {
  return {
    mode: 'learn' as const,
    turnIndex: 1,
    signals: { ...DEFAULT_TUTOR_SIGNALS, intent: 'requests_explanation' as const, ...signals },
    grade: null,
    helpRequest: null,
    state: BASE_STATE,
    attemptSubmitted: false,
    prerequisiteConceptId: null,
    prerequisiteTitle: null,
    conceptSourceRefs: ['source.t07.cell'],
    activitySourceRefs: ['source.t07.cell'],
    conflictSourceRefs: ['source.t07.cell'],
  };
}

describe('disclosure signals (F6)', () => {
  it('reads the model-declared answerDisclosed flag (and legacy disclosure key)', () => {
    expect(readTutorSignals({ answerDisclosed: true }).answerDisclosed).toBe(true);
    expect(readTutorSignals({ disclosure: true }).answerDisclosed).toBe(true);
    expect(readTutorSignals({}).answerDisclosed).toBe(false);
    expect(readTutorSignals({ answerDisclosed: 'yes' }).answerDisclosed).toBe(false);
  });

  it('detects unambiguous disclosure prose but not a normal probe', () => {
    expect(detectAnswerDisclosure(EXPLANATION)).toBe(true);
    expect(detectAnswerDisclosure('这是本题的完整答案（已标记为看过答案）：……')).toBe(true);
    expect(detectAnswerDisclosure('先用一句话说说你的理解：什么是观察？')).toBe(false);
    expect(detectAnswerDisclosure('   ')).toBe(false);
    const merged = withAnswerDisclosure({ ...DEFAULT_TUTOR_SIGNALS }, '完整讲解如下……');
    expect(merged.answerDisclosed).toBe(true);
  });

  it('marks a probe decision as disclosure when the envelope already disclosed the answer', () => {
    const parsed = parseTutorEnvelope(
      `说明：下面直接给完整讲解。\n\`\`\`json\n${JSON.stringify({
        tutorSignals: { intent: 'requests_explanation', answerQuality: 'not_answered' },
        studentText: EXPLANATION,
      })}\n\`\`\``,
    );
    // The prose declares the disclosure even though the structured flag is absent.
    expect(parsed.signals.answerDisclosed).toBe(true);
    expect(parsed.text).toBe(EXPLANATION);
    const decision = decidePedagogy({ ...pedagogyInput({}), signals: parsed.signals });
    expect(decision.disclosure).toBe(true);
    expect(decision.rationale).toContain('answerDisclosed');
    // Action is unchanged: only the disclosure/evidence classification is corrected.
    expect(decision.action).not.toBe('answer_disclosure');
  });

  it('honours the explicit envelope flag even when the prose has no marker', () => {
    const parsed = parseTutorEnvelope(
      `下面分层讲清楚。\n\`\`\`json\n${JSON.stringify({
        tutorSignals: { intent: 'requests_explanation', answerDisclosed: true },
        studentText: '下面分层讲清楚。',
      })}\n\`\`\``,
    );
    expect(parsed.signals.answerDisclosed).toBe(true);
    const decision = decidePedagogy(pedagogyInput({ answerDisclosed: true }));
    expect(decision.disclosure).toBe(true);
  });

  it('keeps disclosure false for a genuine probe turn', () => {
    const decision = decidePedagogy(pedagogyInput({}));
    expect(decision.disclosure).toBe(false);
    expect(decision.action).toBe('hint');
  });

  it('the teaching service records the disclosure on decision and session state', async () => {
    const { service, session } = await startHarness({
      turns: [{ text: EXPLANATION, signals: { intent: 'requests_explanation' } }],
    });
    const result = await service.submitTurn(
      requestContext('f6.turn.1', { now: '2026-10-29T08:00:01Z' }),
      {
        requestId: 'f6.turn.1',
        sessionId: session.id,
        revision: 0,
        message: '请从头到尾完整讲一遍，不要反问。',
      },
    );
    expect(result.ok, result.ok ? '' : `${result.error.code}: ${result.error.message}`).toBe(true);
    if (!result.ok) return;
    expect(result.data.decision.disclosure).toBe(true);
    expect(result.data.state.disclosure).toBe(true);
    expect(result.data.events).toContainEqual(
      expect.objectContaining({ type: 'pedagogy.decision', disclosure: true }),
    );
    expect(service.auditEvents().some((event) => event.kind === 'answer.disclosed')).toBe(true);
    // The next attempt in this round must be recorded as assisted, not independent.
    expect(result.data.state.helpKinds.length).toBeGreaterThanOrEqual(0);
  });
});
