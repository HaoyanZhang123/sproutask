/**
 * Error taxonomy tests (card T07: AUTH / QUOTA / UNSUPPORTED / NETWORK /
 * CANCELLED / INVALID_INPUT with retryable flags, mapped from adapter errors
 * without leaking provider payloads).
 */

import { describe, expect, it } from 'vitest';
import { errorFromThrown, parseTutorEnvelope } from '../src/index.js';
import { startHarness } from './helpers.js';

describe('adapter error mapping', () => {
  it('maps credential, quota, transport, unsupported and abort errors', () => {
    const auth = errorFromThrown({ code: 'INVALID_CREDENTIAL', message: 'bad key sk-ABCDEFGH1234' });
    expect(auth.code).toBe('AUTH');
    expect(auth.message).not.toContain('sk-ABCDEFGH1234');

    const missing = errorFromThrown({ code: 'MISSING_CREDENTIAL' });
    expect(missing.code).toBe('AUTH');

    const quota = errorFromThrown({ status: 429, message: 'rate limited' });
    expect(quota.code).toBe('QUOTA');

    const network = errorFromThrown({ code: 'ECONNREFUSED', message: 'connect failed' });
    expect(network.code).toBe('NETWORK');
    expect(network.retryable).toBe(true);

    const unsupported = errorFromThrown({ code: 'IMAGE_OFFLOAD_REQUIRED' });
    expect(unsupported.code).toBe('UNSUPPORTED');

    const cancelled = errorFromThrown(Object.assign(new Error('aborted'), { name: 'AbortError' }));
    expect(cancelled.code).toBe('CANCELLED');

    const pathLeak = errorFromThrown({ message: 'cannot read C:\\Users\\student\\secret.txt' });
    expect(pathLeak.message).not.toContain('C:\\Users\\student');
  });

  it('maps scripted gateway failures to structured service errors and audits them', async () => {
    const cases = [
      { scripted: 'AUTH' as const, expected: 'UNAUTHORIZED' as const },
      { scripted: 'QUOTA' as const, expected: 'QUOTA_EXCEEDED' as const },
      { scripted: 'UNSUPPORTED' as const, expected: 'UNSUPPORTED' as const },
      { scripted: 'NETWORK' as const, expected: 'UNAVAILABLE' as const },
      { scripted: 'CANCELLED' as const, expected: 'CANCELLED' as const },
    ];
    for (const item of cases) {
      const { service, session } = await startHarness({
        turns: [{ text: '', signals: {}, error: item.scripted }],
      });
      const result = await service.submitTurn(
        { requestId: `error-${item.scripted}`, learnerId: 'learner.t07.fixture', now: '2026-10-29T08:00:01Z' },
        { requestId: `error-${item.scripted}`, sessionId: session.id, revision: 0, message: '你好' },
      );
      expect(result.ok, `${item.scripted} should fail`).toBe(false);
      if (result.ok) continue;
      expect(result.error.code, item.scripted).toBe(item.expected);
      if (item.scripted === 'NETWORK') expect(result.error.retryable).toBe(true);
      expect(service.auditEvents().some((event) => event.kind === 'gateway.error')).toBe(true);
    }
  });
});

describe('DSH gateway adapter envelope', () => {
  it('strips a fenced JSON teaching envelope and validates unknown signal values', () => {
    const parsed = parseTutorEnvelope(
      '先说说你的理解：\n```json\n{"tutorSignals":{"intent":"frustrated","answerQuality":"incorrect","confidence":0.7},"studentText":"先说说你的理解："}\n```',
    );
    expect(parsed.text).toBe('先说说你的理解：');
    expect(parsed.signals.intent).toBe('frustrated');
    expect(parsed.signals.answerQuality).toBe('incorrect');
    expect(parsed.signals.confidence).toBe(0.7);
    const malformed = parseTutorEnvelope('普通回复，没有结构块');
    expect(malformed.signals.intent).toBe('none');
    const badEnum = parseTutorEnvelope('```json\n{"tutorSignals":{"intent":"run_shell"}}\n```');
    expect(badEnum.signals.intent).toBe('none');
  });
});
