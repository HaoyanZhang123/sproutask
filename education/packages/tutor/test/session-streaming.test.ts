/**
 * Session lifecycle, streaming separation, failure/cancel/retry and review-mode
 * tests (T07 card: stream events separate from final state; skip/end/cancel/
 * timeout; attempt persisted first; review recall → discriminate → transfer).
 */

import { describe, expect, it } from 'vitest';
import type { CancellationToken } from '@edu/domain';
import { makeCandidate, met, startHarness } from './helpers.js';

function mutableToken(): CancellationToken & { cancel(): void } {
  let cancelled = false;
  const listeners = new Set<() => void>();
  return {
    get cancelled() {
      return cancelled;
    },
    onCancel(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    cancel() {
      cancelled = true;
      for (const listener of listeners) listener();
    },
  };
}

describe('streaming events vs final state', () => {
  it('streams deltas/tool events/phase but returns the authoritative state separately', async () => {
    const { service, session } = await startHarness({
      turns: [
        {
          text: '你把细胞说成基本单位，方向对了。',
          signals: { answerQuality: 'correct' },
          grade: met(),
          evidenceCandidates: [makeCandidate()],
          toolCalls: [{ name: 'edu_get_concept', args: { conceptId: 'concept.cell' } }],
        },
      ],
    });
    const state = service.getState(session.id);
    const result = await service.submitTurn({ requestId: 'stream-1', learnerId: 'learner.t07.fixture', now: '2026-10-29T08:00:01Z' }, {
      requestId: 'stream-1',
      sessionId: session.id,
      revision: state?.revision ?? 0,
      attempt: {
        activityId: 'activity.cell-explain',
        inputType: 'text',
        answerText: '细胞是生物体结构和功能的基本单位。',
      },
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const outcome = result.data;

    const eventTypes = outcome.events.map((event) => event.type);
    expect(eventTypes).toContain('turn.started');
    expect(eventTypes).toContain('model.delta');
    expect(eventTypes).toContain('tool.requested');
    expect(eventTypes).toContain('tool.result');
    expect(eventTypes).toContain('pedagogy.decision');
    expect(eventTypes).toContain('turn.completed');
    // No event carries the authoritative projection/state.
    for (const event of outcome.events) {
      expect('state' in event).toBe(false);
      expect(JSON.stringify(event)).not.toContain('"progress"');
      expect(JSON.stringify(event)).not.toContain('consecutiveFailures');
    }
    // The final state is only in `outcome.state` and is internally consistent.
    expect(outcome.state.revision).toBe(outcome.revision);
    expect(outcome.revision).toBeGreaterThan(state?.revision ?? 0);
    expect(outcome.events.at(-1)).toMatchObject({ type: 'turn.completed', revision: outcome.revision });
    expect(outcome.sourceCitation).toMatchObject({ required: false, refs: [] });
    const toolResult = outcome.toolResults[0];
    expect(toolResult?.ok).toBe(true);
    expect(outcome.events.some((event) => event.type === 'tool.result' && event.ok)).toBe(true);
  });
});

describe('skip / end / cancel / timeout', () => {
  it('skip abandons the session without faking completion or a wrong answer', async () => {
    const { service, learner, session } = await startHarness({
      turns: [{ text: 'unused', signals: {} }],
    });
    const skipped = await service.submitTurn({ requestId: 'skip-1', learnerId: 'learner.t07.fixture', now: '2026-10-29T08:00:01Z' }, {
      requestId: 'skip-1',
      sessionId: session.id,
      revision: 0,
      skip: true,
    });
    expect(skipped.ok).toBe(true);
    if (!skipped.ok) return;
    expect(skipped.data.decision.action).toBe('skip');
    expect(skipped.data.state.status).toBe('abandoned');
    expect(learner.count('completeLearning')).toBe(0);
    const endCall = learner.lastCall('endSession')?.args as {
      request: { status: string };
    };
    expect(endCall.request.status).toBe('abandoned');
  });

  it('explicit end abandons when the student did not complete the unit', async () => {
    const { service, learner, session } = await startHarness({ turns: [{ text: 'unused', signals: {} }] });
    const ended = await service.submitTurn({ requestId: 'end-1', learnerId: 'learner.t07.fixture', now: '2026-10-29T08:00:01Z' }, {
      requestId: 'end-1',
      sessionId: session.id,
      revision: 0,
      end: true,
    });
    expect(ended.ok).toBe(true);
    if (!ended.ok) return;
    expect(ended.data.decision.action).toBe('end');
    expect(ended.data.state.status).toBe('abandoned');
    expect(learner.count('completeLearning')).toBe(0);
  });

  it('cancelled turn is rejected before saving an answer', async () => {
    const token = mutableToken();
    token.cancel();
    const { service, learner, session } = await startHarness({ turns: [{ text: 'x', signals: {} }] });
    const result = await service.submitTurn(
      { requestId: 'cancel-pre-1', learnerId: 'learner.t07.fixture', now: '2026-10-29T08:00:01Z', signal: token },
      {
        requestId: 'cancel-pre-1',
        sessionId: session.id,
        revision: 0,
        attempt: { activityId: 'activity.cell-explain', inputType: 'text', answerText: '细胞。' },
      },
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('CANCELLED');
    expect(learner.count('submitAttempt')).toBe(0);
  });

  it('timeout before grading leaves the attempt saved and retryable, then keeps one attempt', async () => {
    const { service, learner, session } = await startHarness({
      turns: [
        {
          text: '重试后才拿到的反馈文本。',
          signals: { answerQuality: 'correct' },
          grade: met(),
          gradeErrorOnce: 'NETWORK',
          evidenceCandidates: [makeCandidate()],
        },
      ],
    });
    const failed = await service.submitTurn({ requestId: 'timeout-1', learnerId: 'learner.t07.fixture', now: '2026-10-29T08:00:01Z' }, {
      requestId: 'timeout-1',
      sessionId: session.id,
      revision: 0,
      attempt: {
        activityId: 'activity.cell-explain',
        inputType: 'text',
        answerText: '细胞是生物体结构和功能的基本单位。',
      },
    });
    expect(failed.ok).toBe(false);
    if (failed.ok) return;
    expect(failed.error.code).toBe('UNAVAILABLE');
    expect(learner.count('submitAttempt')).toBe(1);
    expect(learner.count('recordGradedAttempt')).toBe(0);
    expect(learner.cancelledAttempts.length).toBeGreaterThan(0);

    const retried = await service.retryPendingGrading(
      { requestId: 'timeout-1-retry', learnerId: 'learner.t07.fixture', now: '2026-10-29T08:00:02Z' },
      { sessionId: session.id, requestId: 'timeout-1-retry' },
    );
    expect(retried.ok).toBe(true);
    if (!retried.ok) return;
    expect(retried.data.attemptId).toBe((failed.error as { detailsRef?: string }).detailsRef);
    expect(learner.count('submitAttempt')).toBe(1);
    expect(learner.count('recordGradedAttempt')).toBe(1);
    expect(service.getState(session.id)?.pendingGradingAttemptId).toBeNull();
  });

  it('cancellation observed after the model response does not commit a late assessment', async () => {
    const token = mutableToken();
    const { service, learner, session } = await startHarness({
      turns: [
        {
          text: '迟到的反馈。',
          signals: { answerQuality: 'correct' },
          grade: met(),
          beforeGrade: () => token.cancel(),
          evidenceCandidates: [makeCandidate()],
        },
      ],
    });
    const result = await service.submitTurn(
      { requestId: 'cancel-late-1', learnerId: 'learner.t07.fixture', now: '2026-10-29T08:00:01Z', signal: token },
      {
        requestId: 'cancel-late-1',
        sessionId: session.id,
        revision: 0,
        attempt: {
          activityId: 'activity.cell-explain',
          inputType: 'text',
          answerText: '细胞是生物体结构和功能的基本单位。',
        },
      },
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('CANCELLED');
    expect(learner.count('submitAttempt')).toBe(1);
    expect(learner.count('recordGradedAttempt')).toBe(0);
    expect(learner.cancelledAttempts.some((item) => item.cancelled)).toBe(true);
  });

  it('rejects a stale turn revision', async () => {
    const { service, session } = await startHarness({ turns: [{ text: 'x', signals: {} }] });
    const result = await service.submitTurn({ requestId: 'stale-1', learnerId: 'learner.t07.fixture', now: '2026-10-29T08:00:01Z' }, {
      requestId: 'stale-1',
      sessionId: session.id,
      revision: 99,
      message: '你好',
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('STALE_REVISION');
  });
});

describe('review mode', () => {
  it('starts with recall, then discriminates and transfers, then completes the review', async () => {
    const { service, learner, session } = await startHarness({
      mode: 'review',
      turns: [
        { text: '先不看材料，回忆一下：细胞是什么？', signals: {} },
        {
          text: '回忆正确，换一个易混概念辨析。',
          signals: { answerQuality: 'correct' },
          grade: met(),
          evidenceCandidates: [makeCandidate()],
        },
        {
          text: '把这条原理迁移到新情境：举例说明不同细胞形态不同。',
          signals: { answerQuality: 'correct' },
          grade: met(),
          evidenceCandidates: [makeCandidate()],
        },
      ],
    });
    const first = await service.submitTurn({ requestId: 'review-1', learnerId: 'learner.t07.fixture', now: '2026-10-29T08:00:01Z' }, {
      requestId: 'review-1',
      sessionId: session.id,
      revision: 0,
      message: '开始复习',
    });
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    expect(first.data.decision.action).toBe('review_recall');
    expect(first.data.decision.reviewStage).toBe('recall');

    const second = await service.submitTurn({ requestId: 'review-2', learnerId: 'learner.t07.fixture', now: '2026-10-29T08:00:02Z' }, {
      requestId: 'review-2',
      sessionId: session.id,
      revision: first.data.revision,
      attempt: { activityId: 'activity.cell-recall', inputType: 'text', answerText: '细胞是生物体结构和功能的基本单位。' },
    });
    expect(second.ok).toBe(true);
    if (!second.ok) return;
    expect(second.data.decision.action).toBe('review_discriminate');
    expect(second.data.decision.factualClaims).toBe(true);

    const third = await service.submitTurn({ requestId: 'review-3', learnerId: 'learner.t07.fixture', now: '2026-10-29T08:00:03Z' }, {
      requestId: 'review-3',
      sessionId: session.id,
      revision: second.data.revision,
      attempt: { activityId: 'activity.cell-recall', inputType: 'text', answerText: '不同细胞形态不同，例如神经细胞与红细胞。' },
    });
    expect(third.ok).toBe(true);
    if (!third.ok) return;
    expect(third.data.decision.action).toBe('review_transfer');

    const completed = await service.finishReview(
      { requestId: 'review-complete', learnerId: 'learner.t07.fixture', now: '2026-10-29T08:00:04Z' },
      { requestId: 'review-complete', sessionId: session.id, revision: third.data.revision, outcome: 'developing' },
    );
    expect(completed.ok).toBe(true);
    if (!completed.ok) return;
    expect(completed.data.outcome).toBe('developing');
    expect(learner.count('completeReview')).toBe(1);
    expect(learner.count('completeLearning')).toBe(0);
    expect(service.getState(session.id)?.status).toBe('completed');
  });
});

describe('review completion revision semantics (F4)', () => {
  async function reviewHarness() {
    const harness = await startHarness({
      mode: 'review',
      turns: [{ text: '先回忆一下：细胞是什么？', signals: {} }],
    });
    const turned = await harness.service.submitTurn(
      { requestId: 'f4-review-turn', learnerId: 'learner.t07.fixture', now: '2026-10-29T08:00:01Z' },
      {
        requestId: 'f4-review-turn',
        sessionId: harness.session.id,
        revision: 0,
        message: '开始复习',
      },
    );
    expect(turned.ok).toBe(true);
    return harness;
  }

  it('accepts an older terminal revision (runtime fallback) and records the review once', async () => {
    const { service, learner, session } = await reviewHarness();
    const state = service.getState(session.id);
    expect(state?.revision).toBe(1);

    // Runtime local fallback reported revision 1 without advancing tutor state in
    // older builds; a client may still send 0. Terminal completion must work.
    const completed = await service.finishReview(
      { requestId: 'f4-finish', learnerId: 'learner.t07.fixture', now: '2026-10-29T08:00:02Z' },
      { requestId: 'f4-finish', sessionId: session.id, revision: 0 },
    );
    expect(completed.ok).toBe(true);
    if (!completed.ok) return;
    expect(completed.data.outcome).toBe('developing');
    expect(learner.count('completeReview')).toBe(1);
    expect(service.getState(session.id)?.status).toBe('completed');

    const replay = await service.finishReview(
      { requestId: 'f4-finish', learnerId: 'learner.t07.fixture', now: '2026-10-29T08:00:03Z' },
      { requestId: 'f4-finish', sessionId: session.id, revision: 0 },
    );
    expect(replay.ok).toBe(true);
    expect(learner.count('completeReview')).toBe(1);

    const second = await service.finishReview(
      { requestId: 'f4-finish-2', learnerId: 'learner.t07.fixture', now: '2026-10-29T08:00:04Z' },
      { requestId: 'f4-finish-2', sessionId: session.id, revision: 0 },
    );
    expect(second.ok).toBe(false);
    if (second.ok) return;
    expect(second.error.code).toBe('CONFLICT');
  });

  it('rejects a future revision but not a stale one', async () => {
    const { service, session } = await reviewHarness();
    const future = await service.finishReview(
      { requestId: 'f4-future', learnerId: 'learner.t07.fixture', now: '2026-10-29T08:00:02Z' },
      { requestId: 'f4-future', sessionId: session.id, revision: 9 },
    );
    expect(future.ok).toBe(false);
    if (future.ok) return;
    expect(future.error.code).toBe('STALE_REVISION');
  });

  it('surfaces a learner contract rejection as CONTRACT_REJECTED, not UNAUTHORIZED', async () => {
    const { service, learner, session } = await reviewHarness();
    learner.completeReviewError = {
      code: 'CONTRACT_REJECTED',
      message: 'REVIEW_OUTCOME_UNEVIDENCED: synthetic learner rejection',
      retryable: false,
    };
    const result = await service.finishReview(
      { requestId: 'f4-contract', learnerId: 'learner.t07.fixture', now: '2026-10-29T08:00:02Z' },
      { requestId: 'f4-contract', sessionId: session.id, revision: 1 },
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('CONTRACT_REJECTED');
    expect(result.error.message).toContain('REVIEW_OUTCOME_UNEVIDENCED');
    expect(service.getState(session.id)?.status).toBe('active');
  });

  it('refuses completion after the session was revoked (abandoned)', async () => {
    const { service, session } = await reviewHarness();
    const ended = await service.end(
      { requestId: 'f4-end', learnerId: 'learner.t07.fixture', now: '2026-10-29T08:00:02Z' },
      { requestId: 'f4-end', sessionId: session.id, revision: 0, completed: false },
    );
    expect(ended.ok).toBe(true);
    const finish = await service.finishReview(
      { requestId: 'f4-revoked', learnerId: 'learner.t07.fixture', now: '2026-10-29T08:00:03Z' },
      { requestId: 'f4-revoked', sessionId: session.id, revision: 0 },
    );
    expect(finish.ok).toBe(false);
    if (finish.ok) return;
    expect(finish.error.code).toBe('CONFLICT');
  });

  it('skip/end also tolerate an older terminal revision', async () => {
    const harness = await startHarness({ turns: [{ text: 'x', signals: {} }] });
    const turn = await harness.service.submitTurn(
      { requestId: 'f4-skip-turn', learnerId: 'learner.t07.fixture', now: '2026-10-29T08:00:01Z' },
      { requestId: 'f4-skip-turn', sessionId: harness.session.id, revision: 0, message: '你好' },
    );
    expect(turn.ok).toBe(true);
    const skipped = await harness.service.skip(
      { requestId: 'f4-skip', learnerId: 'learner.t07.fixture', now: '2026-10-29T08:00:02Z' },
      { requestId: 'f4-skip', sessionId: harness.session.id, revision: 0 },
    );
    expect(skipped.ok).toBe(true);
    expect(harness.service.getState(harness.session.id)?.status).toBe('abandoned');
  });
});
