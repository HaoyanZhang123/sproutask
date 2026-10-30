/**
 * Source catalogue and controlled page image resolution (05 §2 SourceRef,
 * A07/A08 contributions; R03).
 *
 * Rules enforced here, with explicit error codes instead of thrown errors:
 * - `pdfPage` is 1 based and must fall inside the bound book instance
 *   `pageCount`; a baseline source has no local page count.
 * - `bbox` is normalized to [0,1] page coordinates and must stay inside the
 *   page (or a requested region must).
 * - `blockId` / `figureId` must resolve and must belong to the same book
 *   instance as the source ref.
 * - A page image is addressed only by a host managed `assetId` plus normalized
 *   coordinates. No filesystem path is ever returned (or accepted) here.
 */

import {
  isManagedAssetId,
  validateBookInstance,
  validateFigure,
  validateSourceBlock,
  validateSourceRef,
  type BookInstance,
  type Figure,
  type Id,
  type NormalizedBBox,
  type SourceBlock,
  type SourceRef,
  type ValidationResult,
} from '@edu/domain';
import {
  failBuild,
  failValue,
  knowledgeError,
  knowledgeIssue,
  okBuild,
  okValue,
  type BuildResult,
  type KnowledgeIssue,
  type KnowledgeResult,
} from './knowledge-errors.js';

export interface ResolvedSourceRef {
  readonly sourceRef: SourceRef;
  readonly bookInstance: BookInstance | null;
  readonly pdfPage: number;
  readonly printedPage: string | null;
  readonly bbox: NormalizedBBox | null;
  readonly block: SourceBlock | null;
  readonly figure: Figure | null;
  readonly pageCount: number | null;
  readonly checks: {
    readonly pageWithinBook: boolean;
    readonly bboxNormalized: boolean;
    readonly blockBelongsToBook: boolean;
    readonly figureBelongsToBook: boolean;
    /** True when the referenced block/figure belongs to this exact ref. */
    readonly sameSourceRef: boolean;
  };
}

/**
 * A page image is a controlled handle. `assetId` is a host managed asset, the
 * region uses normalized page coordinates; the host alone maps it to bytes.
 */
export interface PageImageHandle {
  readonly assetId: Id;
  readonly bookInstanceId: Id;
  readonly pdfPage: number;
  readonly printedPage: string | null;
  readonly region: NormalizedBBox | null;
  readonly coordinateSpace: 'normalized_page';
}

export interface PageImageRequest {
  /** Optional sub region of the page; defaults to the source ref bbox. */
  readonly region?: NormalizedBBox | null;
  /** Optional expected asset id; rejected when it is a path or mismatches. */
  readonly assetId?: Id;
}

export interface SourceCatalogInput {
  readonly bookInstances?: readonly unknown[];
  readonly sourceRefs: readonly unknown[];
  readonly sourceBlocks?: readonly unknown[];
  readonly figures?: readonly unknown[];
}

export interface SourceCatalog {
  readonly bookInstanceCount: number;
  readonly sourceRefCount: number;
  readonly sourceBlockCount: number;
  readonly figureCount: number;
  bookInstance(id: Id): BookInstance | undefined;
  sourceRef(id: Id): SourceRef | undefined;
  sourceBlock(id: Id): SourceBlock | undefined;
  figure(id: Id): Figure | undefined;
  sourceRefsForBook(bookInstanceId: Id): readonly SourceRef[];
  resolve(sourceRefId: Id): KnowledgeResult<ResolvedSourceRef>;
  pageImage(sourceRefId: Id, request?: PageImageRequest): KnowledgeResult<PageImageHandle>;
}

/** Controlled page image asset id: derived from the managed book asset. */
export function pageImageAssetId(bookInstance: BookInstance, pdfPage: number): string {
  return `${bookInstance.managedAssetId}.p${pdfPage}`;
}

export function validateNormalizedBBox(input: unknown): KnowledgeResult<NormalizedBBox> {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    return failValue(knowledgeError('BBOX_INVALID', 'bbox must be an object with x/y/width/height'));
  }
  const record = input as Record<string, unknown>;
  const keys = Object.keys(record);
  if (keys.some((key) => key !== 'x' && key !== 'y' && key !== 'width' && key !== 'height')) {
    return failValue(
      knowledgeError('BBOX_INVALID', 'bbox accepts only x, y, width and height', { path: '$.bbox' }),
    );
  }
  const values: Record<string, number> = {};
  for (const key of ['x', 'y', 'width', 'height']) {
    const raw = record[key];
    if (typeof raw !== 'number' || !Number.isFinite(raw)) {
      return failValue(
        knowledgeError('BBOX_INVALID', `bbox ${key} must be a finite number`, { path: `$.bbox.${key}` }),
      );
    }
    values[key] = raw;
  }
  const { x, y, width, height } = values as { x: number; y: number; width: number; height: number };
  if (x < 0 || x > 1 || y < 0 || y > 1 || width < 0 || width > 1 || height < 0 || height > 1) {
    return failValue(
      knowledgeError('BBOX_OUT_OF_RANGE', 'bbox values must be normalized to the [0,1] page area', {
        path: '$.bbox',
      }),
    );
  }
  if (width <= 0 || height <= 0) {
    return failValue(
      knowledgeError('BBOX_OUT_OF_RANGE', 'bbox width and height must be greater than 0', {
        path: '$.bbox',
      }),
    );
  }
  if (x + width > 1 || y + height > 1) {
    return failValue(
      knowledgeError('BBOX_OUT_OF_RANGE', 'bbox must stay inside the normalized page area', {
        path: '$.bbox',
      }),
    );
  }
  return okValue({ x, y, width, height });
}

function collect<T>(
  input: readonly unknown[] | undefined,
  label: string,
  validate: (value: unknown) => ValidationResult<T>,
): { values: T[]; issues: KnowledgeIssue[] } {
  const values: T[] = [];
  const issues: KnowledgeIssue[] = [];
  for (const [index, raw] of (input ?? []).entries()) {
    const result = validate(raw);
    if (!result.ok) {
      for (const entry of result.issues) {
        issues.push({
          code: entry.code,
          path: `$.${label}[${index}]${entry.path.replace(/^\$/, '')}`,
          message: entry.message,
        });
      }
      continue;
    }
    values.push(result.value);
  }
  return { values, issues };
}

export function createSourceCatalog(input: SourceCatalogInput): BuildResult<SourceCatalog> {
  const issues: KnowledgeIssue[] = [];
  const books = collect<BookInstance>(input.bookInstances, 'bookInstances', validateBookInstance);
  const refs = collect<SourceRef>(input.sourceRefs, 'sourceRefs', validateSourceRef);
  const blocks = collect<SourceBlock>(input.sourceBlocks, 'sourceBlocks', validateSourceBlock);
  const figures = collect<Figure>(input.figures, 'figures', validateFigure);
  issues.push(...books.issues, ...refs.issues, ...blocks.issues, ...figures.issues);
  if (issues.length > 0) return failBuild(issues);

  const booksById = new Map<Id, BookInstance>();
  for (const book of books.values) {
    if (booksById.has(book.id)) {
      issues.push(knowledgeIssue('DUPLICATE_ID', `$.bookInstances.${book.id}`, 'duplicate book instance id'));
      continue;
    }
    booksById.set(book.id, book);
  }
  const refsById = new Map<Id, SourceRef>();
  for (const ref of refs.values) {
    if (refsById.has(ref.id)) {
      issues.push(knowledgeIssue('DUPLICATE_ID', `$.sourceRefs.${ref.id}`, 'duplicate source ref id'));
      continue;
    }
    refsById.set(ref.id, ref);
  }
  const blocksById = new Map<Id, SourceBlock>();
  for (const block of blocks.values) {
    if (blocksById.has(block.id)) {
      issues.push(knowledgeIssue('DUPLICATE_ID', `$.sourceBlocks.${block.id}`, 'duplicate source block id'));
      continue;
    }
    blocksById.set(block.id, block);
  }
  const figuresById = new Map<Id, Figure>();
  for (const figure of figures.values) {
    if (figuresById.has(figure.id)) {
      issues.push(knowledgeIssue('DUPLICATE_ID', `$.figures.${figure.id}`, 'duplicate figure id'));
      continue;
    }
    figuresById.set(figure.id, figure);
  }
  if (issues.length > 0) return failBuild(issues);

  const resolve = (sourceRefId: Id): KnowledgeResult<ResolvedSourceRef> => {
    const sourceRef = refsById.get(sourceRefId);
    if (sourceRef === undefined) {
      return failValue(
        knowledgeError('SOURCE_REF_NOT_FOUND', `source ref ${sourceRefId} is not in the catalogue`, {
          path: '$.sourceRefId',
        }),
      );
    }
    let bookInstance: BookInstance | null = null;
    let pageWithinBook = false;
    if (sourceRef.bookInstanceId !== null) {
      bookInstance = booksById.get(sourceRef.bookInstanceId) ?? null;
      if (bookInstance === null) {
        return failValue(
          knowledgeError(
            'BOOK_INSTANCE_NOT_FOUND',
            `book instance ${sourceRef.bookInstanceId} for source ref ${sourceRef.id} is not available`,
            { path: '$.bookInstanceId' },
          ),
        );
      }
      if (
        !Number.isInteger(sourceRef.pdfPage) ||
        sourceRef.pdfPage < 1 ||
        sourceRef.pdfPage > bookInstance.pageCount
      ) {
        return failValue(
          knowledgeError(
            'PDF_PAGE_OUT_OF_RANGE',
            `pdfPage ${sourceRef.pdfPage} is outside 1..${bookInstance.pageCount}`,
            { path: '$.pdfPage' },
          ),
        );
      }
      pageWithinBook = true;
    }

    let bboxNormalized = true;
    if (sourceRef.bbox !== null) {
      const checked = validateNormalizedBBox(sourceRef.bbox);
      if (!checked.ok) return checked;
      bboxNormalized = true;
    }

    let block: SourceBlock | null = null;
    let blockBelongsToBook = sourceRef.blockId === null;
    let sameSourceRef = true;
    if (sourceRef.blockId !== null) {
      block = blocksById.get(sourceRef.blockId) ?? null;
      if (block === null) {
        return failValue(
          knowledgeError('BLOCK_NOT_FOUND', `source block ${sourceRef.blockId} is not in the catalogue`, {
            path: '$.blockId',
          }),
        );
      }
      const blockRef = refsById.get(block.sourceRefId);
      blockBelongsToBook =
        blockRef !== undefined &&
        blockRef.bookInstanceId !== null &&
        blockRef.bookInstanceId === sourceRef.bookInstanceId;
      sameSourceRef = block.sourceRefId === sourceRef.id;
      if (!blockBelongsToBook) {
        return failValue(
          knowledgeError(
            'BLOCK_NOT_IN_SOURCE',
            `block ${block.id} does not belong to book instance ${String(sourceRef.bookInstanceId)}`,
            { path: '$.blockId' },
          ),
        );
      }
    }

    let figure: Figure | null = null;
    let figureBelongsToBook = sourceRef.figureId === null;
    if (sourceRef.figureId !== null) {
      figure = figuresById.get(sourceRef.figureId) ?? null;
      if (figure === null) {
        return failValue(
          knowledgeError('FIGURE_NOT_FOUND', `figure ${sourceRef.figureId} is not in the catalogue`, {
            path: '$.figureId',
          }),
        );
      }
      const figureRef = refsById.get(figure.sourceRefId);
      figureBelongsToBook =
        figureRef !== undefined &&
        figureRef.bookInstanceId !== null &&
        figureRef.bookInstanceId === sourceRef.bookInstanceId;
      sameSourceRef = sameSourceRef && figure.sourceRefId === sourceRef.id;
      if (!figureBelongsToBook) {
        return failValue(
          knowledgeError(
            'FIGURE_NOT_IN_SOURCE',
            `figure ${figure.id} does not belong to book instance ${String(sourceRef.bookInstanceId)}`,
            { path: '$.figureId' },
          ),
        );
      }
    }

    return okValue({
      sourceRef,
      bookInstance,
      pdfPage: sourceRef.pdfPage,
      printedPage: sourceRef.printedPage,
      bbox: sourceRef.bbox,
      block,
      figure,
      pageCount: bookInstance === null ? null : bookInstance.pageCount,
      checks: {
        pageWithinBook,
        bboxNormalized,
        blockBelongsToBook,
        figureBelongsToBook,
        sameSourceRef,
      },
    });
  };

  const catalog: SourceCatalog = {
    bookInstanceCount: booksById.size,
    sourceRefCount: refsById.size,
    sourceBlockCount: blocksById.size,
    figureCount: figuresById.size,
    bookInstance: (id) => booksById.get(id),
    sourceRef: (id) => refsById.get(id),
    sourceBlock: (id) => blocksById.get(id),
    figure: (id) => figuresById.get(id),
    sourceRefsForBook: (bookInstanceId) =>
      [...refsById.values()]
        .filter((ref) => ref.bookInstanceId === bookInstanceId)
        .sort((left, right) => {
          if (left.pdfPage !== right.pdfPage) return left.pdfPage - right.pdfPage;
          return left.id < right.id ? -1 : left.id > right.id ? 1 : 0;
        }),
    resolve,
    pageImage: (sourceRefId, request = {}) => {
      const resolved = resolve(sourceRefId);
      if (!resolved.ok) return resolved;
      const value = resolved.value;
      if (value.bookInstance === null) {
        return failValue(
          knowledgeError(
            'BASELINE_SOURCE_NOT_LOCAL',
            `source ref ${sourceRefId} resolves through a baseline source; no local page image`,
            { path: '$.sourceRefId' },
          ),
        );
      }
      const expectedAssetId = pageImageAssetId(value.bookInstance, value.pdfPage);
      if (request.assetId !== undefined) {
        if (!isManagedAssetId(request.assetId)) {
          return failValue(
            knowledgeError(
              'ASSET_NOT_MANAGED',
              'page image requests take a host managed asset id, never an OS path',
              { path: '$.assetId' },
            ),
          );
        }
        if (request.assetId !== expectedAssetId) {
          return failValue(
            knowledgeError(
              'ASSET_NOT_FOUND',
              `asset ${request.assetId} is not the controlled page image for page ${value.pdfPage}`,
              { path: '$.assetId' },
            ),
          );
        }
      }
      const requestedRegion = request.region === undefined ? value.bbox : request.region;
      let region: NormalizedBBox | null = null;
      if (requestedRegion !== null) {
        const checked = validateNormalizedBBox(requestedRegion);
        if (!checked.ok) return checked;
        region = checked.value;
      }
      return okValue({
        assetId: expectedAssetId,
        bookInstanceId: value.bookInstance.id,
        pdfPage: value.pdfPage,
        printedPage: value.printedPage,
        region,
        coordinateSpace: 'normalized_page',
      });
    },
  };
  return okBuild(catalog);
}
