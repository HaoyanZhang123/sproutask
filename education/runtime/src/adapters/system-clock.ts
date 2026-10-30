/**
 * Injected clock. The domain never reads the wall clock; this edge adapter is
 * the only place system time enters the application.
 */

import type { Clock, Timestamp } from '@edu/domain';

export function createSystemClock(): Clock {
  return {
    now(): Timestamp {
      return new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
    },
  };
}

/** Fixed clock for deterministic tests and fixtures. */
export function createFixedClock(at: Timestamp): Clock {
  return {
    now(): Timestamp {
      return at;
    },
  };
}
