/** Shared empty / loading / notice / offline / save-failure states. */

import { h } from '../dom.js';
import { button, type ButtonOptions } from './button.js';

export interface StateAction {
  readonly label: string;
  readonly onClick: () => void;
  readonly tone?: ButtonOptions['tone'];
}

export interface EmptyStateOptions {
  readonly title: string;
  readonly body: string;
  readonly actions?: readonly StateAction[];
  readonly testId?: string;
}

export function emptyState(options: EmptyStateOptions): HTMLElement {
  const element = h(
    'div',
    { class: 'edu-state', 'data-edu-state': 'empty', 'data-testid': options.testId ?? 'edu-empty-state' },
    h('h2', { class: 'edu-state__title' }, options.title),
    h('p', { class: 'edu-state__body' }, options.body),
  );
  if ((options.actions ?? []).length > 0) {
    const actions = h('div', { class: 'edu-state__actions' });
    for (const action of options.actions ?? []) {
      actions.append(button(action.label, action.onClick, { tone: action.tone ?? 'default' }));
    }
    element.append(actions);
  }
  return element;
}

export interface LoadingStateOptions {
  readonly title: string;
  readonly body?: string;
  readonly onCancel?: () => void;
}

export function loadingState(options: LoadingStateOptions): HTMLElement {
  const element = h(
    'div',
    {
      class: 'edu-state',
      role: 'status',
      'aria-live': 'polite',
      'data-edu-state': 'loading',
      'data-testid': 'edu-loading-state',
    },
    h(
      'div',
      { class: 'edu-loading' },
      h('span', { class: 'edu-loading__mark', 'aria-hidden': 'true' }),
      h('h2', { class: 'edu-state__title' }, options.title),
    ),
    options.body !== undefined ? h('p', { class: 'edu-state__body' }, options.body) : null,
  );
  if (options.onCancel !== undefined) {
    element.append(
      h('div', { class: 'edu-state__actions' }, button('取消并返回', options.onCancel, { tone: 'default' })),
    );
  }
  return element;
}

export type NoticeTone = 'info' | 'warning' | 'danger';

export interface NoticeOptions {
  readonly tone?: NoticeTone;
  readonly title: string;
  readonly body?: string;
  readonly actions?: readonly StateAction[];
  readonly testId?: string;
  readonly role?: 'status' | 'alert' | 'note';
}

export function notice(options: NoticeOptions): HTMLElement {
  const element = h(
    'div',
    {
      class: `edu-notice edu-notice--${options.tone ?? 'info'}`,
      role: options.role ?? 'status',
      'data-testid': options.testId,
    },
    h('p', { class: 'edu-notice__title' }, options.title),
    options.body !== undefined ? h('p', { class: 'edu-notice__body' }, options.body) : null,
  );
  if ((options.actions ?? []).length > 0) {
    const actions = h('div', { class: 'edu-notice__actions' });
    for (const action of options.actions ?? []) {
      actions.append(button(action.label, action.onClick, { tone: action.tone ?? 'default', small: true }));
    }
    element.append(actions);
  }
  return element;
}

export function offlineNotice(onRetry: () => void): HTMLElement {
  return h(
    'div',
    { class: 'edu-offline-bar', role: 'status', 'data-edu-state': 'offline', 'data-testid': 'edu-offline' },
    h('span', {}, '当前离线'),
    h(
      'span',
      {},
      '已有材料和记录仍可查看；云端反馈暂不可用，草稿保存在本机，恢复网络后可手动重试。',
    ),
    button('重试连接', onRetry, { tone: 'default', small: true }),
  );
}

export interface SaveFailedOptions {
  readonly onRetry: () => void;
  readonly onCopy: () => void;
}

export function saveFailedNotice(options: SaveFailedOptions): HTMLElement {
  return notice({
    tone: 'danger',
    role: 'alert',
    title: '尚未保存',
    body: '本次修改还没有写入本机。离开前请重试保存或复制文字；界面不会显示为已保存。',
    testId: 'edu-save-failed',
    actions: [
      { label: '重试保存', onClick: options.onRetry, tone: 'primary' },
      { label: '复制文字', onClick: options.onCopy },
    ],
  });
}

export function fixtureBadge(text = '演示数据（fixture）'): HTMLElement {
  return h(
    'span',
    { class: 'edu-fixture-badge', 'data-edu-fixture': 'true', title: '当前页面不是真实 API 结果' },
    h('span', { 'aria-hidden': 'true' }, '◆'),
    h('span', {}, text),
  );
}
