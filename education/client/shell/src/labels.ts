/**
 * Student-facing Chinese labels. English enum symbols never reach the DOM.
 */

import type {
  Assistance,
  EvidenceKind,
  LearningState,
  ReviewOutcome,
  SelfReportState,
  SessionMode,
  SessionStatus,
  TrustMode,
  UnderstandingState,
  Validity,
} from '@edu/domain';

export const PAGE_TITLES = {
  home: '今天',
  firstRun: '首次使用',
  library: '我的课本',
  map: '知识地图',
  workspace: '学习',
  records: '进展',
  account: '设置',
  notFound: '页面不存在',
} as const;

export const LEARNING_LABELS: Record<LearningState, string> = {
  not_started: '未开始',
  in_progress: '进行中',
  completed: '本轮已完成',
};

export const UNDERSTANDING_LABELS: Record<UnderstandingState, string> = {
  unassessed: '尚无足够证据',
  needs_support: '需巩固',
  developing: '初步理解',
  supported: '表现稳定',
};

export const REVIEW_OUTCOME_LABELS: Record<ReviewOutcome, string> = {
  needs_support: '需巩固',
  developing: '初步理解',
  supported: '表现稳定',
};

export const SELF_REPORT_LABELS: Record<SelfReportState, string> = {
  uncertain: '不确定',
  basically_understood: '基本会',
  can_explain: '能解释',
};

export const SESSION_MODE_LABELS: Record<SessionMode, string> = {
  learn: '学习',
  review: '复习',
  diagnostic: '短诊断',
};

export const SESSION_STATUS_LABELS: Record<SessionStatus, string> = {
  active: '进行中',
  completed: '已完成',
  abandoned: '已中止',
};

export const EVIDENCE_KIND_LABELS: Record<EvidenceKind, string> = {
  recall: '回忆',
  explain: '解释',
  discriminate: '辨析',
  transfer: '迁移',
  label: '标注',
};

export const ASSISTANCE_LABELS: Record<Assistance, string> = {
  unassisted: '独立完成',
  assisted: '使用了提示或示范',
};

export const VALIDITY_LABELS: Record<Validity, string> = {
  current: '当前有效',
  stale: '已过期',
  pending: '待确认',
  needs_recheck: '待重新确认',
};

export const TRUST_MODE_LABELS: Record<TrustMode, string> = {
  published: '已核对',
  candidate: '待核实',
};

export const SUBJECT_LABELS: Record<string, string> = {
  biology: '生物',
  physics: '物理',
  chemistry: '化学',
};

export const REVIEW_REASON_LABELS = {
  due: '已到复习时间',
  needs_support: '最近证据显示需巩固',
  chosen: '你自选的范围',
} as const;

export function subjectLabel(subject: string): string {
  return SUBJECT_LABELS[subject] ?? subject;
}

export function courseEditionLabel(input: {
  readonly grade: number;
  readonly term: number;
  readonly subject: string;
  readonly editionLabel: string;
}): string {
  // Student-facing short form: the full edition string (plus its verification
  // note) belongs on the library card, not in every page header.
  void input.editionLabel;
  return `${input.grade}年级${termName(input.term)} · ${subjectLabel(input.subject)}`;
}

export function termName(term: number): string {
  if (term === 1) return '上册';
  if (term === 2) return '下册';
  return `第${term}学期`;
}

export function formatDateTime(timestamp: string | null): string {
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

export function formatDate(timestamp: string | null): string {
  if (timestamp === null) return '—';
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return timestamp;
  try {
    return new Intl.DateTimeFormat('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(date);
  } catch {
    return timestamp;
  }
}

export function positionLabel(activityId: string | null, cursor: string | null): string {
  if (activityId === null && cursor === null) return '未记录上次位置';
  const parts: string[] = [];
  if (activityId !== null) parts.push(`活动 ${activityId}`);
  if (cursor !== null) parts.push(`位置 ${cursor}`);
  return parts.join(' · ');
}

/** Only these characters may be echoed from an unknown backend error code. */
export function safeErrorCode(code: string): string {
  if (/^[A-Za-z0-9_.-]{1,32}$/.test(code)) return code;
  return 'UNKNOWN';
}
