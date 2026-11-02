import { describe, expect, it } from 'vitest';
import { describeServiceError, renderErrorBanner } from '../src/index.js';
import { textOf } from './helpers.js';

describe('structured service errors', () => {
  it('maps known codes to Chinese copy and a recovery action', () => {
    const described = describeServiceError({
      code: 'STORAGE_FAILED',
      message: 'internal detail must not be shown',
      retryable: true,
      detailsRef: 'local-evidence-reference',
    });
    expect(described.title).toBe('本地保存没有完成');
    expect(described.retryable).toBe(true);
    expect(described.known).toBe(true);
    const banner = renderErrorBanner({
      code: 'UNAUTHORIZED',
      message: 'internal detail',
      retryable: false,
      detailsRef: 'local-evidence-reference',
    });
    const text = textOf(banner);
    expect(text).toContain('没有完成授权');
    expect(text).toContain('本地内容仍然可读');
    expect(text).not.toContain('internal detail');
    expect(text).not.toContain('detailsRef');
    expect(text).not.toContain('secret');
    expect(text).not.toContain('token');
  });

  it('falls back safely for unknown or unsafe error codes', () => {
    const unknown = renderErrorBanner({ code: 'FUTURE_CODE', message: 'x', retryable: false });
    expect(textOf(unknown)).toContain('操作没有完成');
    expect(textOf(unknown)).toContain('错误代码：FUTURE_CODE');
    const unsafe = renderErrorBanner({ code: '..\\..\\secret', message: 'x', retryable: false });
    expect(textOf(unsafe)).toContain('错误代码：UNKNOWN');
    expect(textOf(unsafe)).not.toContain('secret');
  });
});
