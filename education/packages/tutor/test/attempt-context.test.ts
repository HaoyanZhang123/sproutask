/**
 * 「小芽看不到你选了什么」回归：聊天轮必须带上最近一次作答 + 判定摘要。
 *
 * 线上实测：学生刚提交完选择题再问"这道题为什么"，模型回答"我这边暂时还没
 * 看到你选的具体选项"。根因是会话上下文里只有证据摘要，没有"选了哪一项/判得
 * 怎么样"。这里同时锁住摘要生成（选项 id → 选项文字）和上下文区块。
 */
import { describe, expect, it } from 'vitest';

import { buildAttemptDigest, buildTutorContext } from '../src/context.js';
import type { Activity, GradeResult } from '@edu/domain';

import { createKnowledgeHarness, FakeLearner } from './helpers.js';

function choiceActivity(): Activity {
  const { pack } = createKnowledgeHarness();
  const activity = pack.activities.find((entry) => entry.answerSchema.kind === 'choice');
  if (activity === undefined) throw new Error('fixture pack has no choice activity');
  return activity;
}

function optionIdOf(activity: Activity): string {
  if (activity.answerSchema.kind !== 'choice') throw new Error('expected a choice activity');
  const option = activity.answerSchema.options[0];
  if (option === undefined) throw new Error('choice activity has no options');
  return option.id;
}

function optionLabelOf(activity: Activity): string {
  if (activity.answerSchema.kind !== 'choice') throw new Error('expected a choice activity');
  const option = activity.answerSchema.options[0];
  if (option === undefined) throw new Error('choice activity has no options');
  return option.label;
}

function gradeFor(activity: Activity, met: 'yes' | 'no'): GradeResult {
  void activity;
  return {
    schemaVersion: 1,
    attemptId: 'attempt.digest.1',
    criteria: [{ criterionId: 'criterion.digest.1', met, rationale: 'fixture' }],
    feedback: '选项与正确答案一致。',
    uncertainties: [],
    evidenceCandidates: [],
    requiresClarification: false,
    sourceRefs: [],
    graderVersion: 'rule-v1',
  };
}

describe('attempt digest（最近一次作答摘要）', () => {
  it('renders the chosen option as its label, not the internal option id', () => {
    const activity = choiceActivity();
    const digest = buildAttemptDigest({
      activity,
      rubric: null,
      answerText: JSON.stringify({ kind: 'choice', optionIds: [optionIdOf(activity)] }),
      answerAssetId: null,
      grade: gradeFor(activity, 'yes'),
    });
    expect(digest.studentAnswer).toBe(optionLabelOf(activity));
    expect(digest.studentAnswer).not.toContain(optionIdOf(activity));
    expect(digest.verdict).toBe('correct');
    expect(digest.activityStem).toBe(activity.stem);
  });

  it('marks a failed criterion as an incorrect attempt', () => {
    const activity = choiceActivity();
    const digest = buildAttemptDigest({
      activity,
      rubric: null,
      answerText: JSON.stringify({ kind: 'choice', optionIds: ['option.wrong'] }),
      answerAssetId: null,
      grade: gradeFor(activity, 'no'),
    });
    expect(digest.verdict).toBe('incorrect');
  });

  it('puts the digest into the turn context so the model cannot claim it forgot', async () => {
    const { knowledge, pack } = createKnowledgeHarness();
    const activity = choiceActivity();
    const conceptId = activity.conceptIds[0];
    if (conceptId === undefined) throw new Error('activity has no concept');
    const digest = buildAttemptDigest({
      activity,
      rubric: null,
      answerText: JSON.stringify({ kind: 'choice', optionIds: [optionIdOf(activity)] }),
      answerAssetId: null,
      grade: gradeFor(activity, 'yes'),
    });

    const built = await buildTutorContext(
      { content: knowledge, learner: new FakeLearner() },
      { requestId: 'context.attempt.1', learnerId: 'learner.t07.fixture', now: '2026-10-29T08:00:00Z' },
      {
        session: {
          schemaVersion: 1,
          id: 'session.context.attempt',
          learnerId: 'learner.t07.fixture',
          courseEditionId: pack.courseEditionId,
          packVersion: pack.version,
          trustMode: 'published',
          conceptId,
          mode: 'learn',
          status: 'active',
          startedAt: '2026-10-29T08:00:00Z',
          endedAt: null,
          resumeCursor: { activityId: activity.id, cursor: null },
          dshSessionId: null,
        },
        state: {
          sessionId: 'session.context.attempt',
          learnerId: 'learner.t07.fixture',
          conceptId,
          courseEditionId: pack.courseEditionId,
          packVersion: pack.version,
          mode: 'learn',
          revision: 1,
          turnCount: 1,
          consecutiveFailures: 0,
          consecutiveProbes: 0,
          helpKinds: [],
          disclosure: false,
          difficulty: 'standard',
          representation: 'text',
          reviewStage: null,
          currentActivityId: activity.id,
          status: 'active',
          lastAction: null,
          pendingGradingAttemptId: null,
        },
        packKey: { courseEditionId: pack.courseEditionId, packVersion: pack.version },
        conceptId,
        activityId: activity.id,
        studentMessage: '这道题为什么选这个？',
        skill: {
          id: 'subject-biology',
          version: '0.1.0',
          subject: 'biology',
          constraints: [],
          instruction: '你是生物学习引导者。',
        },
        toolNames: ['edu_get_concept'],
        maxPrerequisites: 0,
        maxEvidenceItems: 0,
        attempt: digest,
      },
    );

    expect(built.ok).toBe(true);
    if (!built.ok) return;
    const block = built.data.prompt.blocks.find((entry) => entry.kind === 'current_attempt');
    expect(block).toBeDefined();
    expect(block?.content).toContain(`学生这次选/写的是：${digest.studentAnswer}`);
    expect(block?.content).toContain('判定：正确');
    expect(block?.content).toContain('不要再问');
    expect(block?.trust).toBe('untrusted_data');
  });
});
