/**
 * Versioned review scheduling policy (05 §3.3).
 *
 * This is an explicitly labelled PRODUCT HEURISTIC, not a validated memory
 * algorithm: the 1/3/7 day spacing and the staleness horizon are tunable
 * defaults, not scientific forgetting curves. Any change of a default must
 * bump `version` so stored `review.policyVersion` stays meaningful.
 */

import type { ReviewOutcome, Timestamp } from '@edu/domain';
import { REVIEW_POLICY_VERSION, VERSION_LABEL_PATTERN } from '@edu/domain';
import {
  isValidTimeZone,
  localDayAtOffset,
  parseInstant,
  sameWallClockNextDay,
  type LocalTimeOfDay,
} from './time.js';

export const REVIEW_POLICY_HEURISTIC_NOTE =
  'product heuristic only; not a validated memory model and never a mastery percentage';

export interface ReviewPolicy {
  readonly version: string;
  readonly timeZone: string;
  /** Local wall-clock slot used for scheduled review days. */
  readonly reviewLocalTime: LocalTimeOfDay;
  /** First review after a learning activity completes: next local day. */
  readonly firstReviewDays: number;
  readonly intervals: Readonly<Record<ReviewOutcome, number>>;
  /** Evidence older than this many days is marked stale on explicit refresh. */
  readonly staleAfterDays: number;
}

export interface ReviewPolicyConfig {
  readonly version?: string;
  readonly timeZone?: string;
  readonly reviewLocalTime?: Partial<LocalTimeOfDay>;
  readonly firstReviewDays?: number;
  readonly intervals?: Partial<Record<ReviewOutcome, number>>;
  readonly staleAfterDays?: number;
}

export const DEFAULT_REVIEW_INTERVALS: Readonly<Record<ReviewOutcome, number>> = {
  needs_support: 1,
  developing: 3,
  supported: 7,
};

function requireDays(label: string, value: number, minimum = 1, maximum = 365): number {
  if (!Number.isInteger(value) || value < minimum || value > maximum) {
    throw new Error(`${label} must be an integer between ${minimum} and ${maximum}`);
  }
  return value;
}

function requireTimeOfDay(value: Partial<LocalTimeOfDay> | undefined): LocalTimeOfDay {
  const hour = value?.hour ?? 9;
  const minute = value?.minute ?? 0;
  const second = value?.second ?? 0;
  if (!Number.isInteger(hour) || hour < 0 || hour > 23) {
    throw new Error('review local hour must be 0..23');
  }
  if (!Number.isInteger(minute) || minute < 0 || minute > 59) {
    throw new Error('review local minute must be 0..59');
  }
  if (!Number.isInteger(second) || second < 0 || second > 59) {
    throw new Error('review local second must be 0..59');
  }
  return { hour, minute, second };
}

/**
 * Build a review policy. Defaults implement `review-policy-v1`:
 * learning completion -> next local day; review outcome needs_support -> 1 day,
 * developing -> 3 days, supported -> 7 days. Overriding an interval without a
 * new version is rejected so projections cannot silently change meaning.
 */
export function createReviewPolicy(config: ReviewPolicyConfig = {}): ReviewPolicy {
  const version = config.version ?? REVIEW_POLICY_VERSION;
  if (!VERSION_LABEL_PATTERN.test(version)) {
    throw new Error(`invalid review policy version: ${version}`);
  }
  const timeZone = config.timeZone ?? 'UTC';
  if (!isValidTimeZone(timeZone)) {
    throw new Error(`invalid IANA time zone: ${timeZone}`);
  }
  const reviewLocalTime = requireTimeOfDay(config.reviewLocalTime);
  const firstReviewDays = requireDays('firstReviewDays', config.firstReviewDays ?? 1);
  const intervals: Record<ReviewOutcome, number> = {
    needs_support: requireDays(
      'needs_support interval',
      config.intervals?.needs_support ?? DEFAULT_REVIEW_INTERVALS.needs_support,
    ),
    developing: requireDays(
      'developing interval',
      config.intervals?.developing ?? DEFAULT_REVIEW_INTERVALS.developing,
    ),
    supported: requireDays(
      'supported interval',
      config.intervals?.supported ?? DEFAULT_REVIEW_INTERVALS.supported,
    ),
  };
  const staleAfterDays = requireDays('staleAfterDays', config.staleAfterDays ?? 30, 1, 3650);
  const changedDefaults =
    firstReviewDays !== DEFAULT_REVIEW_INTERVALS.needs_support ||
    intervals.needs_support !== DEFAULT_REVIEW_INTERVALS.needs_support ||
    intervals.developing !== DEFAULT_REVIEW_INTERVALS.developing ||
    intervals.supported !== DEFAULT_REVIEW_INTERVALS.supported;
  if (changedDefaults && version === REVIEW_POLICY_VERSION) {
    throw new Error(
      `custom review intervals require a new policy version (default ${REVIEW_POLICY_VERSION} keeps 1/3/7 days)`,
    );
  }
  return {
    version,
    timeZone,
    reviewLocalTime,
    firstReviewDays,
    intervals,
    staleAfterDays,
  };
}

/** Due instant for a completed learning activity (next local day at the slot). */
export function dueAfterLearning(policy: ReviewPolicy, completedAt: Timestamp): Timestamp {
  return localDayAtOffset(
    completedAt,
    policy.timeZone,
    policy.firstReviewDays,
    policy.reviewLocalTime,
  );
}

/** Due instant after a completed review, based on its evidenced outcome. */
export function dueAfterReview(
  policy: ReviewPolicy,
  completedAt: Timestamp,
  outcome: ReviewOutcome,
): Timestamp {
  return localDayAtOffset(
    completedAt,
    policy.timeZone,
    policy.intervals[outcome],
    policy.reviewLocalTime,
  );
}

/** One allowed deferral: push the due instant to the next local day, same wall time. */
export function deferDue(policy: ReviewPolicy, dueAt: Timestamp): Timestamp {
  return sameWallClockNextDay(dueAt, policy.timeZone);
}

/** True when evidence has aged past the heuristic staleness horizon. */
export function isStaleByAge(policy: ReviewPolicy, assessedAt: Timestamp, now: Timestamp): boolean {
  const age = parseInstant(now) - parseInstant(assessedAt);
  return age > policy.staleAfterDays * 86_400_000;
}

/** Serializable policy description for reports/UI; carries the heuristic note. */
export function describeReviewPolicy(policy: ReviewPolicy): Record<string, unknown> {
  return {
    version: policy.version,
    timeZone: policy.timeZone,
    reviewLocalTime: policy.reviewLocalTime,
    firstReviewDays: policy.firstReviewDays,
    intervals: policy.intervals,
    staleAfterDays: policy.staleAfterDays,
    heuristicNote: REVIEW_POLICY_HEURISTIC_NOTE,
  };
}
