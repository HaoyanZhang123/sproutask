/**
 * Framework-free feedback view for a `GradeResult` (05 §5, 02 §3.5).
 *
 * Every judgement shows: what was assessed, what is met / not met / still
 * uncertain, why, which sources, which grader version, and — when the input was
 * unclear — the explicit clarification actions instead of a fake verdict.
 */

export interface FeedbackGradeLike {
  readonly criteria: readonly {
    readonly criterionId: string;
    readonly met: 'yes' | 'no' | 'unclear';
    readonly rationale: string;
  }[];
  readonly feedback: string;
  readonly uncertainties: readonly string[];
  readonly evidenceCandidates: readonly unknown[];
  readonly requiresClarification: boolean;
  readonly sourceRefs: readonly string[];
  readonly graderVersion: string;
}

export const CLARIFICATION_ACTIONS = [
  { id: 'retake', label: '重新拍一张' },
  { id: 'rotate', label: '旋转后重试' },
  { id: 'edit_text', label: '改正识别文字' },
  { id: 'text_fallback', label: '改用文字作答' },
  { id: 'retry_later', label: '稍后再试' },
] as const;

export type ClarificationActionId = (typeof CLARIFICATION_ACTIONS)[number]['id'];

export interface FeedbackViewOptions {
  readonly grade: FeedbackGradeLike;
  readonly sourceLabel?: (sourceRefId: string) => string;
  readonly onClarificationAction?: (action: ClarificationActionId) => void;
  readonly onOpenSource?: (sourceRefId: string) => void;
  /** Extra warning, e.g. instructions found inside an uploaded image. */
  readonly injectionNotice?: string | null;
  /** True when the evidence candidates are only candidates (not yet committed). */
  readonly candidateOnly?: boolean;
}

export interface FeedbackViewController {
  readonly element: HTMLElement;
  unmount(): void;
}

const MET_LABEL: Record<'yes' | 'no' | 'unclear', string> = {
  yes: '已达成',
  no: '未达成',
  unclear: '待确认',
};

export function mountFeedbackView(
  container: HTMLElement,
  options: FeedbackViewOptions,
): FeedbackViewController {
  const { grade } = options;
  const root = document.createElement('section');
  root.className = 'edu-visual-feedback';
  root.dataset['eduVisual'] = 'feedback';
  root.setAttribute('aria-live', 'polite');

  const heading = document.createElement('h3');
  heading.textContent = grade.requiresClarification ? '还需要确认' : '这次作答的反馈';
  root.append(heading);

  if (options.injectionNotice !== null && options.injectionNotice !== undefined) {
    const notice = document.createElement('p');
    notice.className = 'edu-visual-injection';
    notice.setAttribute('role', 'note');
    notice.textContent = options.injectionNotice;
    root.append(notice);
  }

  const text = document.createElement('p');
  text.className = 'edu-visual-feedback-text';
  text.textContent = grade.feedback;
  root.append(text);

  const criteriaList = document.createElement('ul');
  criteriaList.className = 'edu-visual-criteria';
  criteriaList.setAttribute('aria-label', '评分要点');
  for (const criterion of grade.criteria) {
    const item = document.createElement('li');
    item.dataset['met'] = criterion.met;
    const badge = document.createElement('strong');
    badge.textContent = `【${MET_LABEL[criterion.met]}】`;
    const rationale = document.createElement('span');
    rationale.textContent = criterion.rationale;
    item.append(badge, rationale);
    criteriaList.append(item);
  }
  root.append(criteriaList);

  if (grade.uncertainties.length > 0) {
    const uncertain = document.createElement('div');
    uncertain.className = 'edu-visual-uncertainty';
    const title = document.createElement('p');
    title.textContent = '仍然不确定或需要留意：';
    uncertain.append(title);
    const list = document.createElement('ul');
    for (const reason of grade.uncertainties) {
      const item = document.createElement('li');
      item.textContent = reason;
      list.append(item);
    }
    uncertain.append(list);
    root.append(uncertain);
  }

  if (grade.requiresClarification) {
    const clarification = document.createElement('div');
    clarification.className = 'edu-visual-clarify';
    const note = document.createElement('p');
    note.textContent = '系统不会因为图片不清或信息不足而判你答错。可以这样继续：';
    clarification.append(note);
    const actions = document.createElement('div');
    actions.className = 'edu-visual-actions';
    for (const action of CLARIFICATION_ACTIONS) {
      const button = document.createElement('button');
      button.type = 'button';
      button.dataset['clarificationAction'] = action.id;
      button.textContent = action.label;
      button.addEventListener('click', () => options.onClarificationAction?.(action.id));
      actions.append(button);
    }
    clarification.append(actions);
    root.append(clarification);
  }

  if (grade.sourceRefs.length > 0) {
    const sources = document.createElement('div');
    sources.className = 'edu-visual-sources';
    const title = document.createElement('p');
    title.textContent = '依据出处：';
    sources.append(title);
    const list = document.createElement('ul');
    for (const ref of grade.sourceRefs) {
      const item = document.createElement('li');
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = options.sourceLabel === undefined ? ref : options.sourceLabel(ref);
      button.dataset['sourceRef'] = ref;
      button.addEventListener('click', () => options.onOpenSource?.(ref));
      item.append(button);
      list.append(item);
    }
    sources.append(list);
    root.append(sources);
  }

  const meta = document.createElement('p');
  meta.className = 'edu-visual-meta';
  const candidateNote = options.candidateOnly === true ? '；证据候选待确认后写入记录' : '';
  meta.textContent = `评分版本：${grade.graderVersion}；${grade.evidenceCandidates.length} 条证据候选${candidateNote}。`;
  root.append(meta);

  container.append(root);
  return {
    element: root,
    unmount() {
      root.remove();
    },
  };
}
