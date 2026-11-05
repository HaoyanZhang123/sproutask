/**
 * T15 F5 regression tests: session ids must not reuse a DSH-persisted session.
 *
 * Reproduction baseline (T15): after a restart the first `tutor/start` allocated
 * `session.N`, which already existed under `<DSH_HOME>/sessions/_no-cwd/`, and
 * the DSH restore path threw `TypeError: Cannot read properties of undefined
 * (reading 'length')` with 0 model calls. These tests are offline: the fake DSH
 * agents only bind a session, they never call a model.
 */

import { mkdirSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import {
  composeEducationRuntime,
  createDshSessionIdGenerator,
  type DshAgentsLike,
  type DshSessionLike,
} from '../src/index.js';
import type { Id, IdGenerator } from '@edu/domain';

const here = path.dirname(fileURLToPath(import.meta.url));
const educationRoot = path.resolve(here, '..', '..');

const roots: string[] = [];

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

function tempRoot(label: string): string {
  const root = path.join(
    os.tmpdir(),
    `edu-f5-${label}-${Date.now()}-${Math.random().toString(16).slice(2)}`,
  );
  mkdirSync(root, { recursive: true });
  roots.push(root);
  return root;
}

function seedPersistedSession(dshHome: string, sessionId: string): void {
  mkdirSync(path.join(dshHome, 'sessions', '_no-cwd', sessionId), { recursive: true });
}

const handle = {
  agent: {
    followup() {
      /* binding only; no model turn in this test */
    },
    async whenIdle() {
      /* no-op */
    },
  },
  async dispose() {
    /* no-op */
  },
};

const emptySession: DshSessionLike = {
  deriveMessages: () => [],
};

interface FakeAgents extends DshAgentsLike {
  readonly createdIds: Id[];
}

/**
 * Fake `ctx.agents`: a create for an id that already exists in the persisted
 * store reproduces the exact TypeError T15 observed (restore path), while a
 * fresh id succeeds. No model request is ever made by `create`.
 */
function fakeAgents(options: {
  readonly dshHome: string | null;
  readonly persisted: readonly string[];
}): FakeAgents {
  const createdIds: Id[] = [];
  const occupied = new Set(options.persisted);
  return {
    createdIds,
    async create(input) {
      const id = input.sessionId ?? 'session.unknown';
      createdIds.push(id);
      if (occupied.has(id)) {
        throw new TypeError("Cannot read properties of undefined (reading 'length')");
      }
      return handle;
    },
    async resume(input) {
      createdIds.push(input.sessionId);
      return handle;
    },
  };
}

async function firstConceptId(): Promise<Id> {
  return 'concept.bio7a.observation.meaning';
}

/**
 * Deterministic generator for the retry tests: the first `session` id is fixed,
 * so composition-time id consumption for other scopes cannot shift it.
 */
function sessionFirstIds(firstIds: readonly string[]): IdGenerator {
  let sessionIndex = 0;
  let otherIndex = 0;
  return {
    next(scope: string): Id {
      if (scope.trim() === 'session') {
        const value = firstIds[sessionIndex] ?? `session.${sessionIndex + 3}`;
        sessionIndex += 1;
        return value;
      }
      otherIndex += 1;
      return `${scope.trim()}.f5.${otherIndex}`;
    },
  };
}

describe('DSH-store-aware session ids (F5)', () => {
  it('skips session ids already persisted under <DSH_HOME>/sessions', () => {
    const root = tempRoot('ids');
    const dshHome = path.join(root, 'dsh-home');
    seedPersistedSession(dshHome, 'session.3');
    seedPersistedSession(dshHome, 'session.4');
    // startAt models "the process counter already reached 3", exactly the T15 case.
    const ids = createDshSessionIdGenerator({ dshHome, startAt: 3 });
    const first = ids.next('session');
    expect(first).not.toBe('session.3');
    expect(first).not.toBe('session.4');
    expect(first).toBe('session.5');
    // Other scopes keep the opaque sequential shape (ids are never parsed).
    expect(ids.next('concept')).toMatch(/^concept\.\d+$/);
    // Two sessions in the same process never collide either.
    const second = ids.next('session');
    expect(second).toMatch(/^session\.\d+$/);
    expect(second).not.toBe(first);
  });

  it('also skips ids from a flat file store and is safe without a store', () => {
    const root = tempRoot('flat');
    const sessionsRoot = path.join(root, 'sessions');
    mkdirSync(sessionsRoot, { recursive: true });
    const ids = createDshSessionIdGenerator({ sessionsRoot, startAt: 1, maxSkips: 100 });
    expect(ids.next('session')).toBe('session.1');
    const noStore = createDshSessionIdGenerator({ dshHome: null, startAt: 1 });
    expect(noStore.next('session')).toBe('session.1');
  });

  it('starts a session without a TypeError when session.3 is already on disk', async () => {
    const root = tempRoot('start');
    const dshHome = path.join(root, 'dsh-home');
    seedPersistedSession(dshHome, 'session.3');
    const agents = fakeAgents({ dshHome, persisted: ['session.3'] });
    const ids = createDshSessionIdGenerator({ dshHome, startAt: 3 });
    const composed = await composeEducationRuntime({
      workspaceRoot: educationRoot,
      dataRoot: path.join(root, 'data'),
      env: {} as NodeJS.ProcessEnv,
      dshHome,
      ids,
      agents,
      sessions: { get: () => emptySession },
    });
    expect(composed.ok).toBe(true);
    if (!composed.ok) return;
    const composition = composed.data;
    try {
      const started = await composition.tutor.startSession(
        {
          requestId: 'f5.start.1',
          learnerId: 'learner.local.default',
          now: composition.clock.now(),
        },
        { conceptId: await firstConceptId(), mode: 'learn' },
      );
      expect(started.ok, started.ok ? '' : `${started.error.code}: ${started.error.message}`).toBe(
        true,
      );
      if (!started.ok) return;
      expect(started.data.session.id).not.toBe('session.3');
      expect(started.data.session.id.startsWith('session.')).toBe(true);
      expect(started.data.dshSessionId).toBe(started.data.session.id);
      expect(agents.createdIds).toEqual([started.data.session.id]);
    } finally {
      composition.close();
    }
  });

  it('retries once with a fresh id when the first bind hits the restore TypeError', async () => {
    const root = tempRoot('retry');
    // Deliberately unsafe generator: the first candidate is session.3.
    const ids: IdGenerator = sessionFirstIds(['session.3']);
    const agents = fakeAgents({ dshHome: null, persisted: ['session.3'] });
    const composed = await composeEducationRuntime({
      workspaceRoot: educationRoot,
      dataRoot: path.join(root, 'data'),
      env: {} as NodeJS.ProcessEnv,
      dshHome: null,
      ids,
      agents,
      sessions: { get: () => emptySession },
    });
    expect(composed.ok).toBe(true);
    if (!composed.ok) return;
    const composition = composed.data;
    try {
      const started = await composition.tutor.startSession(
        {
          requestId: 'f5.start.retry',
          learnerId: 'learner.local.default',
          now: composition.clock.now(),
        },
        { conceptId: await firstConceptId(), mode: 'learn' },
      );
      expect(started.ok, started.ok ? '' : `${started.error.code}: ${started.error.message}`).toBe(
        true,
      );
      if (!started.ok) return;
      expect(agents.createdIds).toEqual(['session.3', 'session.4']);
      expect(started.data.session.id).toBe('session.4');
      // The retry only re-binds the DSH session: no model turn was made.
      expect(composition.tutor.getState(started.data.session.id)?.turnCount).toBe(0);
    } finally {
      composition.close();
    }
  });

  it('retries with a fresh id when the caller supplied a colliding session id', async () => {
    const root = tempRoot('supplied');
    // The caller supplies session.3; the retry allocates the next store-aware id.
    const ids = sessionFirstIds(['session.4']);
    const agents = fakeAgents({ dshHome: null, persisted: ['session.3'] });
    const composed = await composeEducationRuntime({
      workspaceRoot: educationRoot,
      dataRoot: path.join(root, 'data'),
      env: {} as NodeJS.ProcessEnv,
      dshHome: null,
      ids,
      agents,
      sessions: { get: () => emptySession },
    });
    expect(composed.ok).toBe(true);
    if (!composed.ok) return;
    const composition = composed.data;
    try {
      const started = await composition.tutor.startSession(
        {
          requestId: 'f5.start.supplied',
          learnerId: 'learner.local.default',
          now: composition.clock.now(),
        },
        {
          conceptId: await firstConceptId(),
          mode: 'learn',
          sessionId: 'session.3' as Id,
        },
      );
      expect(started.ok, started.ok ? '' : `${started.error.code}: ${started.error.message}`).toBe(
        true,
      );
      if (!started.ok) return;
      expect(started.data.session.id).toBe('session.4');
      expect(agents.createdIds).toEqual(['session.3', 'session.4']);
      // The retry only re-binds the DSH session: no model turn was made.
      expect(composition.tutor.getState(started.data.session.id)?.turnCount).toBe(0);
    } finally {
      composition.close();
    }
  });

  it('converts a persistent TypeError into a structured SESSION_RESUME_FAILED error', async () => {
    const root = tempRoot('structured');
    const agents = fakeAgents({ dshHome: null, persisted: ['session.3', 'session.4'] });
    const ids: IdGenerator = sessionFirstIds(['session.3', 'session.4']);
    const composed = await composeEducationRuntime({
      workspaceRoot: educationRoot,
      dataRoot: path.join(root, 'data'),
      env: {} as NodeJS.ProcessEnv,
      dshHome: null,
      ids,
      agents,
      sessions: { get: () => emptySession },
    });
    expect(composed.ok).toBe(true);
    if (!composed.ok) return;
    const composition = composed.data;
    try {
      const started = await composition.tutor.startSession(
        {
          requestId: 'f5.start.structured',
          learnerId: 'learner.local.default',
          now: composition.clock.now(),
        },
        { conceptId: await firstConceptId(), mode: 'learn' },
      );
      expect(started.ok).toBe(false);
      if (started.ok) return;
      expect(started.error.code).toBe('UNAVAILABLE');
      expect(started.error.message).toContain('SESSION_RESUME_FAILED');
      expect(started.error.message).not.toContain('reading \'length\'');
      expect(agents.createdIds).toEqual(['session.3', 'session.4']);
      expect(composition.tutor.auditEvents().some((event) => event.kind === 'session.retry')).toBe(
        true,
      );
    } finally {
      composition.close();
    }
  });
});
