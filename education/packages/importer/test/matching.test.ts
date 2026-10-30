import { describe, expect, it } from 'vitest';

import { matchBookIdentity, type KnownBook } from '../src/matching.js';

const KNOWN: KnownBook[] = [
  {
    bookInstanceId: 'book:aaaaaaaa',
    originalSha256: 'a'.repeat(64),
    pageCount: 146,
    confirmedMetadata: {
      title: '义务教育教科书 生物学 七年级 上册',
      publisher: '人民教育出版社',
      editionLabel: '2024年6月第1版',
    },
  },
  {
    bookInstanceId: 'book:bbbbbbbb',
    originalSha256: 'b'.repeat(64),
    pageCount: 120,
    confirmedMetadata: {
      title: '义务教育教科书 生物学 七年级 上册',
      publisher: '某地方出版社',
      editionLabel: '2019年6月第1版',
    },
  },
];

const SAME_EDITION = {
  title: '义务教育教科书 生物学 七年级 上册',
  publisher: '人民教育出版社',
  editionLabel: '2024年6月第1版',
};

describe('edition matching (A07)', () => {
  it('hits the same book instance for identical bytes', () => {
    const result = matchBookIdentity({
      sha256: 'a'.repeat(64),
      pageCount: 146,
      metadata: SAME_EDITION,
      known: KNOWN,
    });
    expect(result.kind).toBe('same_hash');
    expect(result.bookInstanceId).toBe('book:aaaaaaaa');
    expect(result.requiresPageMapping).toBe(false);
    expect(result.trustMode).toBe('published');
  });

  it('treats another scan of the same edition as a rescan that needs a page mapping', () => {
    const result = matchBookIdentity({
      sha256: 'c'.repeat(64),
      pageCount: 146,
      metadata: { ...SAME_EDITION, title: '义务教育教科书  生物学  七年级  上册  扫描版' },
      known: KNOWN,
    });
    // A different title string is not the same edition: no automatic binding.
    expect(result.kind).toBe('no_match');

    const sameTitle = matchBookIdentity({
      sha256: 'c'.repeat(64),
      pageCount: 146,
      metadata: SAME_EDITION,
      known: KNOWN,
    });
    expect(sameTitle.kind).toBe('same_edition_rescan');
    expect(sameTitle.requiresPageMapping).toBe(true);
    expect(sameTitle.trustMode).toBe('candidate');
    expect(sameTitle.bookInstanceId).toBeNull();
    expect(sameTitle.reasons.join(' ')).toContain('page mapping');
  });

  it('refuses to bind the same title from a different publisher or edition', () => {
    const otherPublisher = matchBookIdentity({
      sha256: 'd'.repeat(64),
      pageCount: 146,
      metadata: { ...SAME_EDITION, publisher: '另一家出版社' },
      known: KNOWN,
    });
    expect(otherPublisher.kind).toBe('different_edition');
    expect(otherPublisher.bookInstanceId).toBeNull();
    expect(otherPublisher.trustMode).toBe('candidate');

    const otherEdition = matchBookIdentity({
      sha256: 'e'.repeat(64),
      pageCount: 146,
      metadata: { ...SAME_EDITION, editionLabel: '2019年6月第1版' },
      known: KNOWN,
    });
    expect(otherEdition.kind).toBe('different_edition');
  });

  it('treats a different page count as a different print, not a rescan', () => {
    const result = matchBookIdentity({
      sha256: 'f'.repeat(64),
      pageCount: 150,
      metadata: SAME_EDITION,
      known: KNOWN,
    });
    expect(result.kind).toBe('different_edition');
    expect(result.reasons.join(' ')).toContain('page count');
  });

  it('never guesses an identity from a file name', () => {
    const result = matchBookIdentity({
      sha256: 'g'.repeat(64),
      pageCount: 146,
      metadata: null,
      known: KNOWN,
    });
    expect(result.kind).toBe('no_match');
    expect(result.bookInstanceId).toBeNull();
    expect(result.reasons.join(' ')).toContain('file name');
  });
});
