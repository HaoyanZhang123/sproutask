/** Student-facing study/review labels and answer encoding. */

import type { Activity, AttemptInputType } from '@edu/domain';
import type { AnswerFormValue } from '../../visuals/src/index.js';
import type { StudyActivityPhase, StudyDecision } from './types.js';

export const PHASE_LABELS: Record<StudyActivityPhase, string> = {
  draft: '草稿',
  submitted: '已提交，正在保存',
  grading: '正在等待反馈',
  feedback: '有反馈',
  failed: '提交未完成',
  cancelled: '已取消',
};

export const PHASE_TONES: Record<StudyActivityPhase, 'neutral' | 'progress' | 'attention' | 'positive' | 'danger'> = {
  draft: 'neutral',
  submitted: 'progress',
  grading: 'progress',
  feedback: 'positive',
  failed: 'danger',
  cancelled: 'neutral',
};

export const HELP_ACTIONS: readonly {
  readonly kind: 'hint' | 'explanation' | 'example' | 'worked_solution' | 'answer';
  readonly label: string;
  readonly note: string;
}[] = [
  { kind: 'hint', label: '给我提示', note: '会记为使用提示；提示不等于完整答案。' },
  { kind: 'explanation', label: '解释一下', note: '会记为使用解释；解释仍可能保留独立思考空间。' },
  { kind: 'example', label: '看个示范', note: '会记为使用示例；示范会影响本次独立证据判断。' },
  {
    kind: 'worked_solution',
    label: '分步示范',
    note: '会显示完整步骤，属于 disclosure；本次作答不能作为独立证据。',
  },
  {
    kind: 'answer',
    label: '直接看答案',
    note: '会显示答案，属于 disclosure；本次作答不能作为独立证据。',
  },
];

export const SKIP_NOTE = '跳过本题不会记为答错，也不会伪造活动完成；可以稍后回来。';
export const END_NOTE = '结束本轮只记录实际做过的部分；未完成内容不会被标为已完成。';
export const DRAFT_SAVED = '草稿已保存在本机。';
export const DRAFT_UNSAVED = '草稿尚未保存；离开前请重试。';

export const REVIEW_REASON_LABELS: Record<'due' | 'needs_support' | 'chosen', string> = {
  due: '已到复习时间',
  needs_support: '最近证据显示需巩固',
  chosen: '你自选的范围',
};

export const DISCLOSURE_NOTE =
  '本轮已经显示完整答案或分步示范。按证据规则，接下来这次作答会标为使用了 disclosure/assisted，不能作为独立掌握证据；这是记录方式，不是惩罚。';

export const ASSISTANCE_NOTE =
  '本轮已使用提示、解释或示例。系统会把帮助使用记录在本次作答中；是否算独立证据由服务规则判断，不由界面自行决定。';

export const LOW_DIFFICULTY_NOTE =
  '连续受挫时可以选择换一种讲法；具体降低难度或换表示由教学服务决定，界面不自行改教学策略。';

export function decisionNotice(decision: StudyDecision): string | null {
  if (decision.disclosure) return DISCLOSURE_NOTE;
  if (decision.action === 'hint' || decision.action === 'layered_explanation' || decision.action === 'example' || decision.action === 'worked_example') {
    return ASSISTANCE_NOTE;
  }
  return null;
}

export function answerInputType(value: AnswerFormValue): AttemptInputType {
  if (value.kind === 'text') return 'text';
  if (value.kind === 'choice') return 'choice';
  return 'relation';
}

/**
 * Encode a DOM form answer into the `ActivityAttempt.answerText` transport.
 * T13's GradePort must decode by `activity.answerSchema.kind` (documented in
 * the T12 report). Keeping this in one function prevents the UI from inventing
 * a second grading policy.
 */
export function encodeAnswer(activity: Activity, value: AnswerFormValue): string {
  switch (value.kind) {
    case 'text':
      return value.text;
    case 'choice':
      return JSON.stringify({ kind: 'choice', optionIds: value.optionIds });
    case 'relation':
      return JSON.stringify({ kind: 'relation', pairs: value.pairs });
    default:
      return JSON.stringify(value);
  }
}

export function formatStudyTime(timestamp: string | null): string {
  if (timestamp === null) return '—';
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return timestamp;
  try {
    return new Intl.DateTimeFormat('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  } catch {
    return timestamp;
  }
}
