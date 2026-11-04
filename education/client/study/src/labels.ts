/** Student-facing study/review labels and answer encoding. */

import type { Activity, AttemptInputType } from '@edu/domain';
import type { AnswerFormValue } from '../../visuals/src/index.js';
import type { StudyActivityPhase, StudyDecision } from './types.js';

/** Student-facing activity type names; version numbers stay out of the page. */
export const ACTIVITY_TYPE_LABELS: Record<string, string> = {
  recall: '回忆题',
  explain: '解释题',
  choice: '选择题',
  relation: '关系题',
  diagram_label: '图示标注题',
  transfer: '迁移题',
};

export const PHASE_LABELS: Record<StudyActivityPhase, string> = {  draft: '草稿',
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
  { kind: 'hint', label: '给我提示', note: '会记下这次用过提示；提示不等于完整答案。' },
  { kind: 'explanation', label: '解释一下', note: '会记下这次用过解释。' },
  { kind: 'example', label: '举个例子', note: '会记下这次用过例子。' },
  {
    kind: 'worked_solution',
    label: '分步示范',
    note: '会显示完整步骤，这次作答会标为「用过提示」。',
  },
  {
    kind: 'answer',
    label: '直接看答案',
    note: '会显示答案，这次作答会标为「用过提示」。',
  },
];

export const SKIP_NOTE = '跳过这一题不会记为答错，也不会把没做的题记成做过；之后可以回来。';
export const END_NOTE = '结束本轮只记录实际做过的部分；没做的不会标成已完成。';
export const DRAFT_SAVED = '草稿已保存在本机。';
export const DRAFT_UNSAVED = '草稿尚未保存；离开前请重试。';

/** 提交后原地反馈的第一行：一句结论，不出现分数或百分比。 */
export const VERDICT_LABELS = {
  correct: '答对了',
  practise: '再练一次',
  clarify: '还需要再看看',
  neutral: '收到反馈',
} as const;

/** 要点结论（批改要点的人话版本）。 */
export const CRITERION_LABELS: Record<'yes' | 'no' | 'unclear', string> = {
  yes: '说到了',
  no: '还差一点',
  unclear: '还需要确认',
};

export const REVIEW_REASON_LABELS: Record<'due' | 'needs_support' | 'chosen', string> = {
  due: '已到复习时间',
  needs_support: '最近证据显示需巩固',
  chosen: '你自选的范围',
};

export const DISCLOSURE_NOTE =
  '本轮已经看过完整答案或分步示范。按记录规则，这次作答会标为「用过提示」，不能作为独立完成的凭证；这只是记录方式，不是惩罚。';

export const ASSISTANCE_NOTE =
  '本轮用过提示、解释或示例，记录里会注明「用过提示」。这次算不算独立完成由学习记录判断，页面不替你下结论。';

export const LOW_DIFFICULTY_NOTE =
  '连着几次没答出来时，可以换一种讲法；具体怎么讲由小芽决定，页面不会自己改。';

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
