import { describe, expect, it } from 'vitest';
import { isManagedAssetId } from '@edu/domain';
import {
  createSourceCatalog,
  pageImageAssetId,
  validateNormalizedBBox,
  type SourceCatalog,
} from '../src/source-catalog.js';
import { buildSourceCatalogFixture } from './helpers/fixtures.js';

function catalogOf(): SourceCatalog {
  const built = createSourceCatalog(buildSourceCatalogFixture());
  if (!built.ok) throw new Error(`catalogue invalid: ${JSON.stringify(built.issues)}`);
  return built.value;
}

describe('source resolution (A07/A08 contribution, synthetic fixtures)', () => {
  const catalog = catalogOf();

  it('resolves pdf page, printed page, bbox and the bound book instance', () => {
    const resolved = catalog.resolve('source.p18');
    expect(resolved.ok).toBe(true);
    if (!resolved.ok) return;
    expect(resolved.value.pdfPage).toBe(18);
    expect(resolved.value.printedPage).toBeNull();
    expect(resolved.value.bbox).toEqual({ x: 0.1, y: 0.1, width: 0.8, height: 0.8 });
    expect(resolved.value.bookInstance?.id).toBe('book.fixture');
    expect(resolved.value.pageCount).toBe(40);
    expect(resolved.value.checks).toMatchObject({
      pageWithinBook: true,
      bboxNormalized: true,
    });
  });

  it('returns explicit error codes instead of throwing', () => {
    const unknownRef = catalog.resolve('source.missing');
    expect(unknownRef.ok).toBe(false);
    if (!unknownRef.ok) expect(unknownRef.error.code).toBe('SOURCE_REF_NOT_FOUND');

    const unknownBook = catalog.resolve('source.unknown-book');
    expect(unknownBook.ok).toBe(false);
    if (!unknownBook.ok) expect(unknownBook.error.code).toBe('BOOK_INSTANCE_NOT_FOUND');

    const outOfRange = catalog.resolve('source.p99');
    expect(outOfRange.ok).toBe(false);
    if (!outOfRange.ok) {
      expect(outOfRange.error.code).toBe('PDF_PAGE_OUT_OF_RANGE');
      expect(outOfRange.error.serviceCode).toBe('INVALID_INPUT');
    }

    const missingBlock = catalog.resolve('source.block-missing');
    expect(missingBlock.ok).toBe(false);
    if (!missingBlock.ok) expect(missingBlock.error.code).toBe('BLOCK_NOT_FOUND');

    const missingFigure = catalog.resolve('source.figure-missing');
    expect(missingFigure.ok).toBe(false);
    if (!missingFigure.ok) expect(missingFigure.error.code).toBe('FIGURE_NOT_FOUND');
  });

  it('requires block and figure assets to belong to the same book instance', () => {
    const ownBlock = catalog.resolve('source.p18.text');
    expect(ownBlock.ok).toBe(true);
    if (ownBlock.ok) {
      expect(ownBlock.value.block?.id).toBe('block.p18');
      expect(ownBlock.value.checks.blockBelongsToBook).toBe(true);
      // the block belongs to the same book instance but to another source ref
      expect(ownBlock.value.checks.sameSourceRef).toBe(false);
    }

    const ownFigure = catalog.resolve('source.p18.figure');
    expect(ownFigure.ok).toBe(true);
    if (ownFigure.ok) expect(ownFigure.value.figure?.activeAssetId).toBe('asset.figure.cell');

    const crossBlock = catalog.resolve('source.cross-book-block');
    expect(crossBlock.ok).toBe(false);
    if (!crossBlock.ok) expect(crossBlock.error.code).toBe('BLOCK_NOT_IN_SOURCE');

    const crossFigure = catalog.resolve('source.cross-book-figure');
    expect(crossFigure.ok).toBe(false);
    if (!crossFigure.ok) expect(crossFigure.error.code).toBe('FIGURE_NOT_IN_SOURCE');
  });

  it('validates normalized bbox ranges', () => {
    const valid = validateNormalizedBBox({ x: 0.1, y: 0.2, width: 0.3, height: 0.4 });
    expect(valid.ok).toBe(true);

    const outOfUnit = validateNormalizedBBox({ x: 1.2, y: 0, width: 0.1, height: 0.1 });
    expect(outOfUnit.ok).toBe(false);
    if (!outOfUnit.ok) expect(outOfUnit.error.code).toBe('BBOX_OUT_OF_RANGE');

    const outsidePage = validateNormalizedBBox({ x: 0.9, y: 0, width: 0.2, height: 0.1 });
    expect(outsidePage.ok).toBe(false);
    if (!outsidePage.ok) expect(outsidePage.error.code).toBe('BBOX_OUT_OF_RANGE');

    const zeroSize = validateNormalizedBBox({ x: 0.1, y: 0.1, width: 0, height: 0.2 });
    expect(zeroSize.ok).toBe(false);
    if (!zeroSize.ok) expect(zeroSize.error.code).toBe('BBOX_OUT_OF_RANGE');

    const wrongShape = validateNormalizedBBox({ x: '0.1', y: 0.1, width: 0.2, height: 0.2 });
    expect(wrongShape.ok).toBe(false);
    if (!wrongShape.ok) expect(wrongShape.error.code).toBe('BBOX_INVALID');

    const unknownField = validateNormalizedBBox({
      x: 0.1,
      y: 0.1,
      width: 0.2,
      height: 0.2,
      page: 18,
    });
    expect(unknownField.ok).toBe(false);
    if (!unknownField.ok) expect(unknownField.error.code).toBe('BBOX_INVALID');
  });

  it('hands out only a managed page image handle with normalized coordinates', () => {
    const image = catalog.pageImage('source.p18');
    expect(image.ok).toBe(true);
    if (!image.ok) return;
    const book = catalog.bookInstance('book.fixture');
    expect(book).toBeDefined();
    if (book === undefined) return;
    expect(image.value.assetId).toBe(pageImageAssetId(book, 18));
    expect(isManagedAssetId(image.value.assetId)).toBe(true);
    expect(image.value.coordinateSpace).toBe('normalized_page');
    expect(image.value.region).toEqual({ x: 0.1, y: 0.1, width: 0.8, height: 0.8 });

    const serialized = JSON.stringify(image.value);
    expect(serialized).not.toMatch(/[A-Za-z]:\\/);
    expect(serialized).not.toMatch(/\.pdf/i);
    expect(serialized).not.toMatch(/pagePath|filePath|osPath/);

    const subRegion = catalog.pageImage('source.p18', {
      region: { x: 0.2, y: 0.2, width: 0.3, height: 0.3 },
    });
    expect(subRegion.ok).toBe(true);
    if (subRegion.ok) expect(subRegion.value.region).toEqual({ x: 0.2, y: 0.2, width: 0.3, height: 0.3 });

    const badRegion = catalog.pageImage('source.p18', {
      region: { x: 1.1, y: 0, width: 0.2, height: 0.2 },
    });
    expect(badRegion.ok).toBe(false);
    if (!badRegion.ok) expect(badRegion.error.code).toBe('BBOX_OUT_OF_RANGE');

    const pathLikeAsset = catalog.pageImage('source.p18', { assetId: 'C:\\books\\biology.pdf' });
    expect(pathLikeAsset.ok).toBe(false);
    if (!pathLikeAsset.ok) expect(pathLikeAsset.error.code).toBe('ASSET_NOT_MANAGED');

    const wrongAsset = catalog.pageImage('source.p18', { assetId: 'asset.book.fixture.p19' });
    expect(wrongAsset.ok).toBe(false);
    if (!wrongAsset.ok) expect(wrongAsset.error.code).toBe('ASSET_NOT_FOUND');
  });

  it('refuses page images for baseline sources without a local page count', () => {
    const baseline = catalog.resolve('source.baseline');
    expect(baseline.ok).toBe(true);
    if (baseline.ok) {
      expect(baseline.value.bookInstance).toBeNull();
      expect(baseline.value.pageCount).toBeNull();
      expect(baseline.value.checks.pageWithinBook).toBe(false);
    }
    const image = catalog.pageImage('source.baseline');
    expect(image.ok).toBe(false);
    if (!image.ok) expect(image.error.code).toBe('BASELINE_SOURCE_NOT_LOCAL');
  });

  it('rejects malformed source entities with prefixed issue paths', () => {
    const invalid = createSourceCatalog({
      bookInstances: [],
      sourceRefs: [
        {
          schemaVersion: 1,
          id: 'source.bad',
          bookInstanceId: 'book.fixture',
          baselineSourceId: null,
          pdfPage: 0,
          printedPage: null,
          bbox: null,
          blockId: null,
          figureId: null,
          verification: { state: 'unverified', actorKind: null, checkedAt: null, notes: null },
        },
      ],
    });
    expect(invalid.ok).toBe(false);
    if (invalid.ok) return;
    expect(invalid.issues.length).toBeGreaterThan(0);
    expect(invalid.issues[0]?.path.startsWith('$.sourceRefs[0]')).toBe(true);
  });
});
