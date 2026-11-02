/**
 * Deterministic ID generator. IDs are opaque and generated, never derived from
 * titles or timestamps; production may swap in a UUID generator behind the
 * same port.
 */

import type { Id, IdGenerator } from '@edu/domain';

export interface SequentialIdOptions {
  readonly prefix?: string;
  readonly startAt?: number;
}

export function createSequentialIdGenerator(options: SequentialIdOptions = {}): IdGenerator {
  let counter = options.startAt ?? 1;
  const prefix = options.prefix ?? 'id';
  return {
    next(scope: string): Id {
      const normalized = scope.trim().length > 0 ? scope.trim() : prefix;
      const value = `${normalized}.${counter}`;
      counter += 1;
      return value;
    },
  };
}
