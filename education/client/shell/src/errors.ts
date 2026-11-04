/**
 * Service error presentation (05 §6).
 *
 * The host/API renders `{ok:false,error}`; the client never invents its own
 * error protocol, never displays `detailsRef` (a local reference), stack
 * traces or paths, and maps every known code to a Chinese sentence with a
 * recovery hint. Unknown codes fall back to a generic message.
 */

import type { ServiceError } from '@edu/domain';
import { h } from './dom.js';
import { safeErrorCode } from './labels.js';

/** Accepts the frozen ServiceError plus unknown backend codes (fallback path). */
export interface ErrorLike {
  readonly code: string;
  readonly message: string;
  readonly retryable: boolean;
  readonly detailsRef?: string;
}

export interface ErrorCopy {
  readonly title: string;
  readonly detail: string;
  readonly action: string;
}

export const SERVICE_ERROR_COPY: Record<string, ErrorCopy> = {
  INVALID_INPUT: {
    title: '输入需要修改',
    detail: '提交的内容格式不正确，请检查后再试。',
    action: '返回修改',
  },
  VALIDATION_FAILED: {
    title: '内容没有通过检查',
    detail: '这次操作的数据不完整或与当前内容版本不匹配。',
    action: '检查后重试',
  },
  NOT_FOUND: {
    title: '找不到这项内容',
    detail: '它可能已被移动、删除或不属于当前教材版本。',
    action: '返回上一页',
  },
  DUPLICATE_REQUEST: {
    title: '这次操作已经记录',
    detail: '重复提交不会再次计数，可以继续查看已有记录。',
    action: '查看记录',
  },
  STALE_REVISION: {
    title: '内容已经有了更新',
    detail: '你看到的版本不是最新的；为避免串写，本次操作没有继续。',
    action: '刷新后重试',
  },
  CONFLICT: {
    title: '暂时不能同时进行',
    detail: '另一个操作正在写入本地记录，请稍后再试。',
    action: '重试',
  },
  CANCELLED: {
    title: '操作已取消',
    detail: '已保存的内容不会被删除；未完成的部分没有记为作答或完成。',
    action: '返回',
  },
  TIMEOUT: {
    title: '等待超时',
    detail: '这次请求没有在预期时间内完成，输入仍保留在本页。',
    action: '重试',
  },
  UNAVAILABLE: {
    title: '服务暂时不可用',
    detail: '本地已有材料与记录仍可查看；云服务恢复后可再试。',
    action: '稍后重试',
  },
  UNAUTHORIZED: {
    title: '没有完成授权',
    detail: '这项操作需要有效的模型服务授权；本地内容仍然可读。',
    action: '查看账户状态',
  },
  QUOTA_EXCEEDED: {
    title: '模型服务额度不足',
    detail: '本次没有产生模型回复；已保存的本地记录不受影响。',
    action: '查看账户状态',
  },
  UNSUPPORTED: {
    title: '当前服务不支持这项操作',
    detail: '可以改用文字作答或查看本地材料，不需要重复提交。',
    action: '改用其他方式',
  },
  NOT_IMPLEMENTED: {
    title: '这项功能还没有接入',
    detail: '当前版本还不能完成这一步；已有内容仍可查看。',
    action: '返回',
  },
  CONTRACT_REJECTED: {
    title: '这次操作被安全检查拒绝',
    detail: '请求不符合当前内容或数据规则，本地记录没有被修改。',
    action: '返回检查',
  },
  STORAGE_FAILED: {
    title: '本地保存没有完成',
    detail: '这次修改尚未写入本机，请不要把当前内容当作已保存。',
    action: '重试保存',
  },
};

export interface DescribedError {
  readonly code: string;
  readonly title: string;
  readonly detail: string;
  readonly action: string;
  readonly retryable: boolean;
  readonly known: boolean;
}

export function describeServiceError(error: ErrorLike): DescribedError {
  const copy = SERVICE_ERROR_COPY[error.code] as ErrorCopy | undefined;
  const code = safeErrorCode(error.code);
  if (copy === undefined) {
    return {
      code,
      title: '操作没有完成',
      detail: '发生了未归类的错误。可以重试；如果反复出现，请返回并查看本地记录。',
      action: '重试',
      retryable: error.retryable,
      known: false,
    };
  }
  return {
    code,
    title: copy.title,
    detail: copy.detail,
    action: error.retryable ? copy.action : '返回',
    retryable: error.retryable,
    known: true,
  };
}

export interface ErrorBannerOptions {
  readonly onRetry?: () => void;
  readonly onBack?: () => void;
  readonly retryLabel?: string;
  readonly backLabel?: string;
  readonly headingLevel?: 'h2' | 'h3';
}

/** Renders a structured service error. Never renders message, detailsRef or stack. */
export function renderErrorBanner(error: ErrorLike, options: ErrorBannerOptions = {}): HTMLElement {
  const described = describeServiceError(error);
  const headingTag = options.headingLevel ?? 'h2';
  const banner = h(
    'div',
    {
      class: 'edu-notice edu-notice--danger',
      role: 'alert',
      'data-edu-error': described.code,
      'aria-live': 'assertive',
    },
    h(headingTag as 'h2', { class: 'edu-notice__title' }, described.title),
    h('p', { class: 'edu-notice__body' }, described.detail),
  );
  const actions = h('div', { class: 'edu-notice__actions' });
  if (described.retryable && options.onRetry !== undefined) {
    actions.append(
      h(
        'button',
        { type: 'button', class: 'edu-button edu-button--primary edu-button--small', onclick: options.onRetry },
        options.retryLabel ?? described.action,
      ),
    );
  }
  if (options.onBack !== undefined) {
    actions.append(
      h(
        'button',
        { type: 'button', class: 'edu-button edu-button--small', onclick: options.onBack },
        options.backLabel ?? '返回',
      ),
    );
  }
  if (actions.childNodes.length > 0) banner.append(actions);
  return banner;
}
