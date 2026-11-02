import { randomUUID } from 'node:crypto';
import { mkdirSync, readFileSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type {
  ActivityAttempt,
  Assessment,
  Clock,
  Evidence,
  IdGenerator,
  ServiceResult,
} from '@edu/domain';
import { StorageService } from '../src/index.js';
import type { OpenStorageOptions } from '../src/index.js';

const fixturesRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../domain/fixtures',
);

export function tmpRoot(label: string): string {
  const root = path.join(os.tmpdir(), `edu-storage-${label}-${randomUUID()}`);
  mkdirSync(root, { recursive: true });
  return root;
}

export function cleanup(root: string): void {
  rmSync(root, { recursive: true, force: true });
}

export function createClock(now = '2026-10-29T09:00:00Z'): Clock {
  return { now: () => now };
}

export function createIds(): IdGenerator {
  let counter = 0;
  return {
    next(prefix: string): string {
      counter += 1;
      return `${prefix}.${counter}`;
    },
  };
}

export function baseOptions(root: string, overrides: Partial<OpenStorageOptions> = {}): OpenStorageOptions {
  const options: OpenStorageOptions = {
    root,
    clock: createClock(),
    ids: createIds(),
    ...overrides,
  };
  return options;
}

export async function openStorage(
  root: string,
  overrides: Partial<OpenStorageOptions> = {},
): Promise<StorageService> {
  const opened = await StorageService.open(baseOptions(root, overrides));
  if (!opened.ok) {
    throw new Error(`storage open failed: ${JSON.stringify(opened.error)}`);
  }
  return opened.data;
}

export function unwrap<T>(result: ServiceResult<T>, label = 'result'): T {
  if (!result.ok) {
    throw new Error(`${label} failed: ${JSON.stringify(result.error)}`);
  }
  return result.data;
}

export function fixture<T>(relativePath: string): T {
  return JSON.parse(readFileSync(path.join(fixturesRoot, relativePath), 'utf8')) as T;
}

export function fixtureText(relativePath: string): string {
  return readFileSync(path.join(fixturesRoot, relativePath), 'utf8');
}

export function requestContext(
  requestId: string,
  overrides: { learnerId?: string; now?: string } = {},
) {
  return {
    requestId,
    learnerId: overrides.learnerId ?? 'learner.local.default',
    now: overrides.now ?? '2026-10-29T09:00:00Z',
  };
}

export interface AttemptBundle {
  readonly assessment: Assessment;
  readonly evidences: readonly Evidence[];
  readonly attempts: readonly ActivityAttempt[];
}

export function validAttemptBundle(): AttemptBundle {
  return fixture<AttemptBundle>('assessments/supported-valid.json');
}

export function attemptFixture(): ActivityAttempt {
  return fixture<ActivityAttempt>('attempts/unassisted.json');
}

export function evidenceFixture(): Evidence {
  return fixture<Evidence>('evidence/unassisted.json');
}

export function journalCommand(
  requestId: string,
  overrides: Record<string, unknown> = {},
): {
  eventId: string;
  requestId: string;
  occurredAt: string;
  learnerId: string;
  type: string;
  payload: Record<string, unknown>;
  effects: { kind: string; targetId: string; revision: number }[];
} {
  return {
    eventId: `event.${requestId}`,
    requestId,
    occurredAt: '2026-10-29T09:00:00Z',
    learnerId: 'learner.local.default',
    type: 'review.completed',
    payload: { note: 'journal test' },
    effects: [{ kind: 'progress.changed', targetId: 'concept.cell', revision: 1 }],
    ...overrides,
  };
}
