/**
 * Canonical JSON used for content hashing.
 *
 * The content hash covers immutable content only: identity, scope and the
 * toc/concepts/relations/activities/rubrics/coverage manifest. Publication
 * state (status) and the review ledger are workflow metadata and are excluded,
 * so re-review does not change the content identity. Hosts compute SHA-256 of
 * this string; the domain only provides the canonical form.
 */

import type { ContentPack } from './entities/content.js';

export type CanonicalContentInput = Pick<
  ContentPack,
  | 'schemaVersion'
  | 'id'
  | 'version'
  | 'courseEditionId'
  | 'scope'
  | 'coverageStatus'
  | 'toc'
  | 'concepts'
  | 'relations'
  | 'activities'
  | 'rubrics'
  | 'coverageManifest'
>;

function sortValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortValue);
  if (value !== null && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    const sorted: Record<string, unknown> = {};
    for (const key of Object.keys(record).sort()) {
      const entry = record[key];
      if (entry !== undefined) sorted[key] = sortValue(entry);
    }
    return sorted;
  }
  return value;
}

export function stableStringify(value: unknown): string {
  return JSON.stringify(sortValue(value));
}

export function canonicalContentJson(pack: CanonicalContentInput): string {
  return stableStringify({
    schemaVersion: pack.schemaVersion,
    id: pack.id,
    version: pack.version,
    courseEditionId: pack.courseEditionId,
    scope: pack.scope,
    coverageStatus: pack.coverageStatus,
    toc: pack.toc,
    concepts: pack.concepts,
    relations: pack.relations,
    activities: pack.activities,
    rubrics: pack.rubrics,
    coverageManifest: pack.coverageManifest,
  });
}
