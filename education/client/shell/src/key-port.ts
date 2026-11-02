/**
 * Host-side API-key management seam.
 *
 * The browser never persists, logs, or reflects the key. A live build talks to
 * the education host over same-origin HTTP; fixture builds use an explicit
 * "endpoint not implemented" port so a demo cannot pretend to save a key.
 */

import type { ServiceError } from '@edu/domain';

export type AuthKeyCategory =
  | 'format'
  | 'auth'
  | 'network'
  | 'quota'
  | 'not_implemented'
  | 'unknown';

export interface AuthKeyFailure extends ServiceError {
  readonly category: AuthKeyCategory;
}

export interface AuthKeyStatus {
  readonly configured: boolean;
  /** Host-provided masked suffix only; never the key or a reversible value. */
  readonly maskedSuffix: string | null;
  readonly lastCheckedAt: string | null;
}

export interface AuthKeySaveReceipt {
  readonly configured: true;
  readonly maskedSuffix: string | null;
}

export interface AuthKeyClearReceipt {
  readonly configured: false;
}

export type AuthKeyResult<T> =
  | { readonly ok: true; readonly data: T }
  | { readonly ok: false; readonly error: AuthKeyFailure };

export interface AuthKeyPort {
  /** Optional: returns configured state + masked suffix from the host. */
  loadStatus(): Promise<AuthKeyResult<AuthKeyStatus>>;
  save(apiKey: string): Promise<AuthKeyResult<AuthKeySaveReceipt>>;
  clear(): Promise<AuthKeyResult<AuthKeyClearReceipt>>;
}

const MIN_KEY_LENGTH = 12;
const MAX_KEY_LENGTH = 200;
const KEY_PATTERN = /^sk-[A-Za-z0-9_-]+$/;

/** Local validation only; never logs or returns the key. */
export function validateApiKey(value: string): AuthKeyFailure | null {
  const key = value.trim();
  if (key.length === 0) {
    return failure('format', 'INVALID_INPUT', '请输入模型 API Key。', false);
  }
  if (!KEY_PATTERN.test(key) || key.length < MIN_KEY_LENGTH || key.length > MAX_KEY_LENGTH) {
    return failure(
      'format',
      'INVALID_INPUT',
      '格式不正确：Key 应以 sk- 开头，长度在合理范围内，只包含字母、数字、_ 或 -。',
      false,
    );
  }
  return null;
}

/** Deliberately only a suffix; the full key never leaves this function. */
export function maskedKeySuffix(value: string): string | null {
  const key = value.trim();
  return key.length >= 4 ? key.slice(-4) : null;
}

export function createUnsupportedAuthKeyPort(): AuthKeyPort {
  const unavailable = (): AuthKeyResult<never> => ({
    ok: false,
    error: failure(
      'not_implemented',
      'UNSUPPORTED',
      '接口未实现：本机宿主尚未提供 /edu/api/auth/key。Key 没有保存，当前仍为本地模式。',
      false,
    ),
  });
  return {
    async loadStatus() {
      return unavailable();
    },
    async save() {
      return unavailable();
    },
    async clear() {
      return unavailable();
    },
  };
}

export interface HttpAuthKeyPortOptions {
  /** Injectable for happy-dom tests; defaults to global fetch. */
  readonly fetchImpl?: typeof fetch;
}

/**
 * Same-origin HTTP port. Contract:
 *   POST /edu/api/auth/key  {apiKey} -> {ok:true,status:'configured'} | error
 *   GET  /edu/api/auth/key           -> {ok:true,status|data:{configured,maskedSuffix}}
 *   DELETE /edu/api/auth/key        -> {ok:true,status:'missing'} | error
 *
 * The POST response must never contain the key. GET may expose only a masked
 * suffix for display; auth.status itself remains availability-only.
 */
export function createHttpAuthKeyPort(options: HttpAuthKeyPortOptions = {}): AuthKeyPort {
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  const endpoint = '/edu/api/auth/key';

  async function send(method: 'GET' | 'POST' | 'DELETE', body?: unknown): Promise<AuthKeyResult<unknown>> {
    if (typeof fetchImpl !== 'function') {
      return { ok: false, error: failure('network', 'UNAVAILABLE', '当前环境没有可用的网络接口。', true) };
    }
    let response: Response;
    try {
      response = await fetchImpl(endpoint, {
        method,
        credentials: 'same-origin',
        headers:
          body === undefined
            ? { accept: 'application/json' }
            : { accept: 'application/json', 'content-type': 'application/json' },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
    } catch {
      return {
        ok: false,
        error: failure('network', 'UNAVAILABLE', '网络失败：无法连接本机宿主端点；Key 没有保存。', true),
      };
    }
    let parsed: unknown = null;
    try {
      parsed = await response.json();
    } catch {
      parsed = null;
    }
    if (response.status === 404) return { ok: false, error: notImplemented() };
    if (response.status === 400 || response.status === 422) {
      return { ok: false, error: failure('format', 'INVALID_INPUT', '格式不正确：宿主没有接受这个 Key。', false) };
    }
    if (response.status === 401 || response.status === 403) {
      return {
        ok: false,
        error: failure('auth', 'UNAUTHORIZED', '鉴权失败：Key 未被模型服务接受；请检查后重试。', false),
      };
    }
    if (response.status === 429) {
      return {
        ok: false,
        error: failure('quota', 'UNAVAILABLE', '配额不足或请求受限；请更换 Key 或稍后重试。', true),
      };
    }
    if (response.status >= 500) {
      return {
        ok: false,
        error: failure('network', 'UNAVAILABLE', '网络或宿主服务暂时不可用；Key 没有保存。', true),
      };
    }
    if (!response.ok) {
      return {
        ok: false,
        error: failure('unknown', 'UNSUPPORTED', '保存没有完成；Key 没有保存。', false),
      };
    }
    const record = (parsed !== null && typeof parsed === 'object' ? parsed : {}) as Record<string, unknown>;
    if (record['ok'] === false) {
      return { ok: false, error: hostFailure(record['error']) };
    }
    const data =
      record['data'] !== null && typeof record['data'] === 'object'
        ? (record['data'] as Record<string, unknown>)
        : record;
    const configured =
      data['configured'] === true ||
      data['status'] === 'configured' ||
      record['status'] === 'configured';
    if (!configured) {
      return {
        ok: false,
        error: failure('unknown', 'UNSUPPORTED', '宿主没有确认 Key 已保存；界面不会假装成功。', false),
      };
    }
    const suffix = typeof data['maskedSuffix'] === 'string' ? data['maskedSuffix'] : null;
    const checkedAt = typeof data['lastCheckedAt'] === 'string' ? data['lastCheckedAt'] : null;
    return { ok: true, data: { configured: true, maskedSuffix: suffix, lastCheckedAt: checkedAt } };
  }

  return {
    async loadStatus() {
      const result = await send('GET');
      if (!result.ok) return result;
      const data = result.data as { configured?: unknown; maskedSuffix?: unknown; lastCheckedAt?: unknown };
      return {
        ok: true,
        data: {
          configured: data.configured === true,
          maskedSuffix: typeof data.maskedSuffix === 'string' ? data.maskedSuffix : null,
          lastCheckedAt: typeof data.lastCheckedAt === 'string' ? data.lastCheckedAt : null,
        },
      };
    },
    async save(apiKey) {
      const result = await send('POST', { apiKey });
      if (!result.ok) return result;
      const data = result.data as { maskedSuffix?: unknown };
      return {
        ok: true,
        data: {
          configured: true,
          maskedSuffix: typeof data.maskedSuffix === 'string' ? data.maskedSuffix : null,
        },
      };
    },
    async clear() {
      const result = await send('DELETE');
      if (!result.ok) return result;
      return { ok: true, data: { configured: false } };
    },
  };
}

function failure(
  category: AuthKeyCategory,
  code: ServiceError['code'],
  message: string,
  retryable: boolean,
): AuthKeyFailure {
  return { code, message, retryable, category };
}

function notImplemented(): AuthKeyFailure {
  return failure(
    'not_implemented',
    'UNSUPPORTED',
    '接口未实现：本机宿主尚未提供 /edu/api/auth/key。Key 没有保存，当前仍为本地模式。',
    false,
  );
}

function hostFailure(value: unknown): AuthKeyFailure {
  const record = (value !== null && typeof value === 'object' ? value : {}) as Record<string, unknown>;
  const rawCategory = record['category'];
  const category: AuthKeyCategory =
    rawCategory === 'format' ||
    rawCategory === 'auth' ||
    rawCategory === 'network' ||
    rawCategory === 'quota' ||
    rawCategory === 'not_implemented'
      ? rawCategory
      : record['code'] === 'UNAUTHORIZED'
        ? 'auth'
        : record['code'] === 'INVALID_INPUT'
          ? 'format'
          : 'unknown';
  return failure(
    category,
    (typeof record['code'] === 'string' ? record['code'] : 'UNSUPPORTED') as ServiceError['code'],
    typeof record['message'] === 'string' && record['message'].trim().length > 0
      ? record['message']
      : '保存没有完成；Key 没有保存。',
    record['retryable'] === true,
  );
}
