/**
 * requestId idempotency helper shared by tests and future services.
 * Duplicate submissions must not create a second attempt or evidence record.
 */

import type { ServiceResult } from './results.js';
import { errResult, okResult } from './results.js';

export class RequestLedger {
  private readonly seen = new Set<string>();

  /** Returns DUPLICATE_REQUEST without mutating state when already recorded. */
  begin(requestId: string): ServiceResult<{ readonly requestId: string }> {
    if (requestId.trim().length === 0) {
      return errResult('INVALID_INPUT', 'requestId must not be empty');
    }
    if (this.seen.has(requestId)) {
      return errResult('DUPLICATE_REQUEST', `requestId ${requestId} was already committed`);
    }
    this.seen.add(requestId);
    return okResult({ requestId }, this.seen.size);
  }

  has(requestId: string): boolean {
    return this.seen.has(requestId);
  }

  get size(): number {
    return this.seen.size;
  }

  forget(requestId: string): boolean {
    return this.seen.delete(requestId);
  }
}

/** Duplicate request ids in a batch, preserving first-seen order. */
export function findDuplicateRequestIds(
  items: readonly { readonly requestId: string }[],
): string[] {
  const seen = new Set<string>();
  const duplicates: string[] = [];
  for (const item of items) {
    if (seen.has(item.requestId)) {
      if (!duplicates.includes(item.requestId)) duplicates.push(item.requestId);
    } else {
      seen.add(item.requestId);
    }
  }
  return duplicates;
}
