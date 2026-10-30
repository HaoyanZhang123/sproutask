/**
 * Content hash binding (05 §2: content identity uses SHA-256 of canonical
 * content JSON, computed host side; the frozen domain layer stays crypto free).
 */

import { createHash } from 'node:crypto';
import { canonicalContentJson, type CanonicalContentInput, type ContentPack } from '@edu/domain';

export function computeContentHash(pack: CanonicalContentInput): string {
  return createHash('sha256').update(canonicalContentJson(pack), 'utf8').digest('hex');
}

export function contentHashMatches(pack: ContentPack): boolean {
  return computeContentHash(pack) === pack.contentHash;
}
