/** Persistent context strip: textbook, pack version, concept, mode, save state, back. */

import { h } from '../dom.js';
import { button } from './button.js';

export interface ContextBarInput {
  readonly courseEdition: string | null;
  readonly packVersion: string | null;
  readonly concept: string | null;
  readonly mode: string | null;
  readonly saveState: 'saved' | 'saving' | 'failed' | 'unknown';
  readonly fixture: boolean;
  readonly backTarget: string | null;
  readonly onBack?: () => void;
}

const SAVE_LABELS = {
  saved: '已保存',
  saving: '正在保存',
  failed: '尚未保存',
  unknown: '保存状态未知',
} as const;

export function renderContextBar(input: ContextBarInput): HTMLElement {
  const bar = h('div', {
    class: 'edu-context',
    'data-testid': 'edu-context-bar',
    'aria-label': '当前学习上下文',
  });
  const item = (label: string, value: string, testId: string): HTMLElement =>
    h(
      'span',
      { class: 'edu-context__item', 'data-context-item': testId },
      h('span', { class: 'edu-context__label' }, label),
      h('span', { class: 'edu-context__value' }, value),
    );

  bar.append(
    item('教材', input.courseEdition ?? '尚未选择教材', 'course-edition'),
    item('内容包', input.packVersion === null ? '—' : `版本 ${input.packVersion}`, 'pack-version'),
    item('当前概念', input.concept ?? '尚未选择概念', 'concept'),
    item('模式', input.mode ?? '未开始', 'mode'),
    h(
      'span',
      { class: 'edu-context__item', 'data-context-item': 'save-state' },
      h('span', { class: 'edu-context__label' }, '本地保存'),
      h(
        'span',
        {
          class: 'edu-context__value edu-save-status',
          'data-state': input.saveState,
          'aria-live': 'polite',
        },
        SAVE_LABELS[input.saveState],
      ),
    ),
    item('返回位置', input.backTarget ?? '首页', 'back-position'),
  );

  const toolbar = h('span', { class: 'edu-context__toolbar' });
  if (input.backTarget !== null && input.onBack !== undefined) {
    toolbar.append(
      button(`返回${input.backTarget}`, input.onBack, { small: true, dataAction: 'context-back' }),
    );
  }
  if (toolbar.childNodes.length > 0) bar.append(toolbar);
  return bar;
}
