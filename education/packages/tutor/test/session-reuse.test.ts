/**
 * 「继续上次 / 换题」必须复用同一把学习的 session。
 *
 * 线上实测：14 条 session.started 只对应 1 次完成学习——每次重进或换题都新开
 * 一条会话。这里的回归保证：同一 id 再次 startSession 时返回原会话、只切当前
 * 题目，并且不会重复写 session.started。
 */
import { describe, expect, it } from 'vitest';

import { startHarness } from './helpers.js';

/** 复用只发生在 startSession 上，不触发教学回合，所以不需要剧本。 */
const NO_TURNS = [{ text: 'ok' }] as const;

describe('session reuse for 继续上次 / 下一题', () => {
  it('returns the same session instead of starting a new one', async () => {
    const harness = await startHarness({ turns: [...NO_TURNS] });
    const first = harness.session;

    const again = await harness.service.startSession(harness.ctx('session.t07.reuse.1'), {
      conceptId: 'concept.cell',
      mode: 'learn',
      sessionId: first.id,
    });

    expect(again.ok).toBe(true);
    if (again.ok) {
      expect(again.data.session.id).toBe(first.id);
      expect(again.data.state.sessionId).toBe(first.id);
    }
    expect(harness.learner.count('startSession')).toBe(1);
  });

  it('switches the current activity inside the same session', async () => {
    const harness = await startHarness({ turns: [...NO_TURNS] });
    const firstActivityId = harness.session.resumeCursor.activityId;
    const next = harness.pack.activities.find(
      (activity) => activity.conceptIds.includes('concept.cell') && activity.id !== firstActivityId,
    );
    if (next === undefined) return;

    const again = await harness.service.startSession(harness.ctx('session.t07.reuse.2'), {
      conceptId: 'concept.cell',
      mode: 'learn',
      sessionId: harness.session.id,
      activityId: next.id,
    });

    expect(again.ok).toBe(true);
    if (again.ok) {
      expect(again.data.session.id).toBe(harness.session.id);
      expect(again.data.state.currentActivityId).toBe(next.id);
    }
    expect(harness.learner.count('startSession')).toBe(1);
  });
});
