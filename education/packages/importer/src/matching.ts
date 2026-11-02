/**
 * Baseline / edition matching (05 §4, A07).
 *
 * Three outcomes must stay distinguishable and are never collapsed into "same
 * book":
 *   same_hash            identical file bytes -> idempotent reuse;
 *   same_edition_rescan  same title/publisher/edition, different bytes -> needs
 *                        cover/copyright/TOC/page-count verification and a new
 *                        page mapping before it may bind a reviewed baseline;
 *   different_edition    same title but another edition/print -> no automatic
 *                        binding at all;
 *   no_match             no known book.
 *
 * Only the caller (library/host) may act on a match; the importer never binds a
 * baseline by guessing.
 */

import type { Id, TrustMode } from '@edu/domain';

export type MatchKind = 'same_hash' | 'same_edition_rescan' | 'different_edition' | 'no_match';

export interface BookMetadata {
  readonly title: string | null;
  readonly publisher: string | null;
  readonly editionLabel: string | null;
}

export interface KnownBook {
  readonly bookInstanceId: Id;
  readonly originalSha256: string;
  readonly pageCount: number;
  readonly confirmedMetadata: BookMetadata;
}

export interface MatchInput {
  readonly sha256: string;
  readonly pageCount: number;
  readonly metadata: BookMetadata | null;
  readonly known: readonly KnownBook[];
}

export interface MatchResult {
  readonly kind: MatchKind;
  readonly bookInstanceId: Id | null;
  /** True when the caller must re-verify cover/copyright/TOC/page mapping. */
  readonly requiresPageMapping: boolean;
  /** A rescan is only usable as `candidate` until a human/machine check passes. */
  readonly trustMode: TrustMode;
  readonly reasons: readonly string[];
}

function normalize(value: string | null | undefined): string {
  return (value ?? '').trim().toLowerCase().replace(/\s+/g, '');
}

function sameEdition(left: BookMetadata, right: BookMetadata): boolean {
  const title = normalize(left.title);
  const otherTitle = normalize(right.title);
  if (title.length === 0 || otherTitle.length === 0 || title !== otherTitle) return false;
  const publisher = normalize(left.publisher);
  const otherPublisher = normalize(right.publisher);
  const edition = normalize(left.editionLabel);
  const otherEdition = normalize(right.editionLabel);
  if (publisher.length > 0 && otherPublisher.length > 0 && publisher !== otherPublisher) return false;
  if (edition.length > 0 && otherEdition.length > 0 && edition !== otherEdition) return false;
  return true;
}

export function matchBookIdentity(input: MatchInput): MatchResult {
  const exact = input.known.find((book) => book.originalSha256 === input.sha256);
  if (exact !== undefined) {
    return {
      kind: 'same_hash',
      bookInstanceId: exact.bookInstanceId,
      requiresPageMapping: false,
      trustMode: 'published',
      reasons: [`same sha256 as book instance ${exact.bookInstanceId}`],
    };
  }

  const metadata = input.metadata;
  if (metadata === null) {
    return {
      kind: 'no_match',
      bookInstanceId: null,
      requiresPageMapping: false,
      trustMode: 'candidate',
      reasons: ['no confirmed metadata; a file name is not an identity'],
    };
  }

  const candidates = input.known.filter((book) => sameEdition(book.confirmedMetadata, metadata));
  if (candidates.length === 0) {
    const titleOnly = input.known.filter(
      (book) => normalize(book.confirmedMetadata.title) === normalize(metadata.title) && normalize(metadata.title).length > 0,
    );
    if (titleOnly.length > 0) {
      return {
        kind: 'different_edition',
        bookInstanceId: null,
        requiresPageMapping: false,
        trustMode: 'candidate',
        reasons: [
          'same title but publisher/edition differs from every known book instance',
          ...titleOnly.map((book) => `known edition: ${book.confirmedMetadata.editionLabel ?? 'unknown'}`),
        ],
      };
    }
    return {
      kind: 'no_match',
      bookInstanceId: null,
      requiresPageMapping: false,
      trustMode: 'candidate',
      reasons: ['no known book instance for this title'],
    };
  }

  const samePageCount = candidates.filter((book) => book.pageCount === input.pageCount);
  if (samePageCount.length === 0) {
    return {
      kind: 'different_edition',
      bookInstanceId: null,
      requiresPageMapping: false,
      trustMode: 'candidate',
      reasons: [
        'same edition label but a different page count: treat as a different print until a curator confirms',
        ...candidates.map((book) => `known pageCount: ${book.pageCount}, new pageCount: ${input.pageCount}`),
      ],
    };
  }

  return {
    kind: 'same_edition_rescan',
    bookInstanceId: null,
    requiresPageMapping: true,
    trustMode: 'candidate',
    reasons: [
      'same edition metadata and page count, different file bytes: verify cover/copyright/TOC and rebuild the page mapping',
      ...samePageCount.map((book) => `candidate book instance: ${book.bookInstanceId}`),
    ],
  };
}
