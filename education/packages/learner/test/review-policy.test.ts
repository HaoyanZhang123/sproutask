import { describe, expect, it } from 'vitest';
import {
  createReviewPolicy,
  deferDue,
  describeReviewPolicy,
  dueAfterLearning,
  dueAfterReview,
  isStaleByAge,
  REVIEW_POLICY_HEURISTIC_NOTE,
} from '../src/policy.js';
import { formatLocalDateTime, localDayAtOffset } from '../src/time.js';

describe('review-policy-v1 (product heuristic, injected clock/zone)', () => {
  const shanghai = createReviewPolicy({ timeZone: 'Asia/Shanghai' });

  it('schedules the first review on the next local day at the configured slot', () => {
    expect(shanghai.version).toBe('review-policy-v1');
    expect(shanghai.intervals).toEqual({ needs_support: 1, developing: 3, supported: 7 });
    const due = dueAfterLearning(shanghai, '2026-10-29T07:00:00Z');
    expect(due).toBe('2026-10-30T01:00:00Z');
    expect(formatLocalDateTime(due, shanghai.timeZone)).toBe('2026-10-30T09:00:00');
  });

  it('uses local calendar days, not UTC days (cross-day boundary)', () => {
    const completed = '2026-10-28T23:00:00Z'; // 2026-10-29 07:00 in Shanghai
    const due = dueAfterLearning(shanghai, completed);
    expect(formatLocalDateTime(completed, shanghai.timeZone)).toBe('2026-10-29T07:00:00');
    expect(formatLocalDateTime(due, shanghai.timeZone)).toBe('2026-10-30T09:00:00');
    expect(due).toBe('2026-10-30T01:00:00Z');
    expect(new Date(due).getUTCDate()).not.toBe(new Date(completed).getUTCDate());
  });

  it('maps review outcomes to 1 / 3 / 7 day intervals', () => {
    const completed = '2026-10-30T02:00:00Z'; // 10:00 local
    expect(formatLocalDateTime(dueAfterReview(shanghai, completed, 'needs_support'), shanghai.timeZone)).toBe(
      '2026-10-31T09:00:00',
    );
    expect(formatLocalDateTime(dueAfterReview(shanghai, completed, 'developing'), shanghai.timeZone)).toBe(
      '2026-11-02T09:00:00',
    );
    expect(formatLocalDateTime(dueAfterReview(shanghai, completed, 'supported'), shanghai.timeZone)).toBe(
      '2026-11-06T09:00:00',
    );
  });

  it('resolves a DST spring-forward gap forward to a valid local time', () => {
    const newYork = createReviewPolicy({
      timeZone: 'America/New_York',
      reviewLocalTime: { hour: 2, minute: 30 },
    });
    const completed = '2026-03-07T10:00:00Z';
    const due = dueAfterLearning(newYork, completed);
    expect(due).toBe('2026-03-08T07:30:00Z');
    expect(formatLocalDateTime(due, newYork.timeZone)).toBe('2026-03-08T03:30:00');
  });

  it('chooses the earlier instant for an ambiguous DST fall-back local time', () => {
    const newYork = createReviewPolicy({
      timeZone: 'America/New_York',
      reviewLocalTime: { hour: 1, minute: 30 },
    });
    const completed = '2026-10-31T12:00:00Z';
    const due = dueAfterLearning(newYork, completed);
    expect(due).toBe('2026-11-01T05:30:00Z'); // 01:30 EDT, not 01:30 EST
    expect(formatLocalDateTime(due, newYork.timeZone)).toBe('2026-11-01T01:30:00');
  });

  it('defers exactly one local day while keeping the wall-clock time', () => {
    expect(deferDue(shanghai, '2026-10-30T01:00:00Z')).toBe('2026-10-31T01:00:00Z');
  });

  it('requires a new policy version when defaults change', () => {
    expect(() =>
      createReviewPolicy({ timeZone: 'UTC', intervals: { supported: 10 } }),
    ).toThrowError(/new policy version/);
    const pilot = createReviewPolicy({
      version: 'review-policy-pilot',
      timeZone: 'UTC',
      intervals: { needs_support: 2, developing: 5, supported: 9 },
    });
    expect(pilot.version).toBe('review-policy-pilot');
    expect(pilot.intervals).toMatchObject({ needs_support: 2, developing: 5, supported: 9 });
    expect(describeReviewPolicy(pilot).heuristicNote).toBe(REVIEW_POLICY_HEURISTIC_NOTE);
  });

  it('marks only old evidence stale, never "forgotten" as a state', () => {
    expect(isStaleByAge(shanghai, '2026-10-01T00:00:00Z', '2026-10-30T23:59:59Z')).toBe(false);
    expect(isStaleByAge(shanghai, '2026-10-01T00:00:00Z', '2026-10-31T00:00:01Z')).toBe(true);
  });

  it('keeps local day arithmetic deterministic around a DST gap', () => {
    const due = localDayAtOffset('2026-03-07T10:00:00Z', 'America/New_York', 1, {
      hour: 2,
      minute: 30,
      second: 0,
    });
    expect(due).toBe('2026-03-08T07:30:00Z');
  });
});
