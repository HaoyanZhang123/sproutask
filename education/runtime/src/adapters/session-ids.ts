/**
 * Session ID allocation that never reuses a DSH-persisted session id (T15 F5).
 *
 * Root cause of F5: `createSequentialIdGenerator()` only counts in memory, so
 * every process restart minted `session.1`, `session.2`, ... again. DSH persists
 * its sessions under `<DSH_HOME>/sessions/<cwd>/session.N`, and `agents.create`
 * with an id that already exists in that store goes through the restore path and
 * failed with `TypeError: Cannot read properties of undefined (reading
 * 'length')` (0 model calls). The first start after a restart therefore always
 * failed until the caller retried with the next number.
 *
 * This adapter keeps the opaque `session.N` shape but skips every id that is
 * already on disk, and falls back to a timestamp/UUID-suffixed id if the store
 * cannot be read or is exhausted. Session ids are opaque strings to DSH, so the
 * fallback is safe.
 */

import { readdirSync, type Dirent } from 'node:fs';
import path from 'node:path';
import type { Id, IdGenerator } from '@edu/domain';
import { createSequentialIdGenerator, type SequentialIdOptions } from './sequential-ids.js';

export interface DshSessionIdOptions extends SequentialIdOptions {
  /** Resolved DSH_HOME. Absent/null disables the store scan. */
  readonly dshHome?: string | null;
  /** Explicit sessions root (defaults to `<dshHome>/sessions`); mainly for tests. */
  readonly sessionsRoot?: string | null;
  /** Upper bound on skipped ids before using the unique fallback. */
  readonly maxSkips?: number;
}

/** DSH stores one directory per session: `session.2`, `session.budget.probe.<ts>`, ... */
const SESSION_ENTRY = /^session[\w.:@-]+$/;

/** Recursively collects the `session.*` names under the DSH session store. */
export function listDshSessionIds(sessionsRoot: string | null | undefined): Set<string> {
  const found = new Set<string>();
  if (typeof sessionsRoot !== 'string' || sessionsRoot.length === 0) return found;
  const walk = (dir: string, depth: number): void => {
    let entries: Dirent[];
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      // A missing/unreadable store is not an error: the caller just gets fewer
      // reserved ids. Never let evidence probing break session start.
      return;
    }
    for (const entry of entries) {
      if (entry.isDirectory()) {
        if (SESSION_ENTRY.test(entry.name)) found.add(entry.name);
        if (depth > 0) walk(path.join(dir, entry.name), depth - 1);
      } else if (entry.isFile() && SESSION_ENTRY.test(entry.name)) {
        // Defensive: tolerate a flat file store (`session.N.json`).
        found.add(entry.name.replace(/\.(json|jsonl|zstd)$/, ''));
      }
    }
  };
  walk(sessionsRoot, 3);
  return found;
}

/**
 * Sequential ids for ordinary scopes, but `session` ids are checked against the
 * DSH session store first. Existing ids are skipped; ids handed out by this
 * generator are reserved for the process lifetime.
 */
export function createDshSessionIdGenerator(options: DshSessionIdOptions = {}): IdGenerator {
  const base = createSequentialIdGenerator(options);
  const sessionsRoot =
    options.sessionsRoot ??
    (typeof options.dshHome === 'string' && options.dshHome.length > 0
      ? path.join(options.dshHome, 'sessions')
      : null);
  const maxSkips = options.maxSkips ?? 10_000;
  const reserved = new Set<string>();

  return {
    next(scope: string): Id {
      const normalized = scope.trim();
      if (normalized !== 'session') return base.next(scope);
      for (let attempt = 0; attempt < maxSkips; attempt += 1) {
        const candidate = base.next('session');
        if (reserved.has(candidate)) continue;
        const occupied = listDshSessionIds(sessionsRoot);
        if (!occupied.has(candidate)) {
          reserved.add(candidate);
          return candidate;
        }
      }
      // The store could not be read or every scanned number was taken. DSH treats
      // the session id as an opaque string, so a unique suffix is still valid and
      // cannot collide with a persisted `session.N`.
      const fallback = `session.${Date.now().toString(36)}.${Math.random().toString(36).slice(2, 10)}`;
      reserved.add(fallback);
      return fallback;
    },
  };
}
