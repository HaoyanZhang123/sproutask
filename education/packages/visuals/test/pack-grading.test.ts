/**
 * 用真实内容包逐题验证规则评分器：每题都用内容包自己认可的答法作答一次。
 *
 * 目的：确认没有任何题型出现"按标准答案作答也判不清"，以及文字题一定能产出
 * 证据候选（否则提交会被判成"没有反馈"）。
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import { gradeAttempt } from '../src/grading/grade.js';

const packPath = path.resolve(import.meta.dirname, '../../../content/biology-7a/pack.json');
const pack = JSON.parse(readFileSync(packPath, 'utf8'));

interface Criterion {
  readonly criterionId: string;
  readonly acceptableEvidence?: readonly string[];
}
interface RubricLike {
  readonly id: string;
  readonly criteria?: readonly Criterion[];
}
interface ActivityLike {
  readonly id: string;
  readonly type: string;
  readonly version: string;
  readonly rubricId: string;
  readonly rubricVersion: string;
  readonly courseEditionId: string;
  readonly conceptIds: readonly string[];
  readonly sourceRefs?: readonly string[];
  readonly answerSchema: {
    readonly kind: string;
    readonly correctOptionIds?: readonly string[] | null;
    readonly maxLength?: number | null;
  };
}

const rubrics = new Map<string, RubricLike>(
  ((pack.rubrics ?? []) as RubricLike[]).map((rubric) => [rubric.id, rubric]),
);
const activities = (pack.activities ?? []) as ActivityLike[];

describe('rule grading against the real content pack', () => {
  it('never reports "unclear" for a text answer that matches the rubric verbatim', () => {
    const unclear: string[] = [];
    const noEvidence: string[] = [];
    let checked = 0;

    for (const activity of activities) {
      if (activity.answerSchema.kind !== 'text') continue;
      const rubric = rubrics.get(activity.rubricId);
      if (rubric === undefined) continue;
      const evidence = (rubric.criteria ?? []).flatMap((criterion) => criterion.acceptableEvidence ?? []);
      if (evidence.length === 0) continue;
      checked += 1;
      // 内容包自己列的"可接受作答"就是标准答案；它必须能被判出来。
      const text = evidence.join('；');
      const graded = gradeAttempt({
        activity: activity as never,
        rubric: rubric as never,
        attempt: {
          id: `attempt.probe.${activity.id}`,
          activityId: activity.id,
          activityVersion: activity.version,
          answerText: text,
          answerAssetId: null,
          inputType: 'text',
          helpUsed: [],
        } as never,
        answer: { kind: 'text', text } as never,
        graderVersion: 'rule-v1',
      });
      if (!graded.ok) {
        unclear.push(`${activity.id}: 评分失败 ${graded.error.code}`);
        continue;
      }
      const grade = graded.value;
      if (!grade.criteria.some((criterion) => criterion.met === 'yes')) {
        unclear.push(`${activity.id}: 标准答案仍判不清`);
      }
      if (grade.evidenceCandidates.length === 0) {
        noEvidence.push(activity.id);
      }
    }

    expect(checked).toBeGreaterThan(20);
    expect(unclear, `标准答案判不清的文字题：${unclear.join(' | ')}`).toEqual([]);
    expect(noEvidence, `标准答案没有产出证据候选：${noEvidence.join(' | ')}`).toEqual([]);
  });

  it('grades every choice activity as correct when the key is selected', () => {
    const failures: string[] = [];
    for (const activity of activities) {
      if (activity.answerSchema.kind !== 'choice') continue;
      const rubric = rubrics.get(activity.rubricId);
      const correct = activity.answerSchema.correctOptionIds ?? [];
      if (rubric === undefined || correct.length === 0) continue;
      const graded = gradeAttempt({
        activity: activity as never,
        rubric: rubric as never,
        attempt: {
          id: `attempt.probe.${activity.id}`,
          activityId: activity.id,
          activityVersion: activity.version,
          answerText: JSON.stringify({ kind: 'choice', optionIds: [...correct] }),
          answerAssetId: null,
          inputType: 'choice',
          helpUsed: [],
        } as never,
        answer: { kind: 'choice', optionIds: [...correct] } as never,
        graderVersion: 'rule-v1',
      });
      if (!graded.ok) {
        failures.push(`${activity.id}: ${graded.error.code}`);
        continue;
      }
      if (graded.value.criteria.some((criterion) => criterion.met !== 'yes')) {
        failures.push(`${activity.id}: 选对答案仍非全 yes`);
      }
      if (graded.value.evidenceCandidates.length === 0) {
        failures.push(`${activity.id}: 选对答案没有证据候选`);
      }
    }
    expect(failures, failures.join(' | ')).toEqual([]);
  });
});
