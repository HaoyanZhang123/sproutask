/**
 * Source / catalog contract entities (05 §2): CourseEdition, BookInstance,
 * SourceRef, SourceBlock, Figure, TocNode.
 */

import {
  ACTOR_KINDS,
  COURSE_EDITION_STATUSES,
  REVIEW_STATES,
  SOURCE_VERIFICATION_STATES,
  SUBJECT_SLUG_PATTERN,
  TOC_NODE_TYPES,
  TRUST_MODES,
  VERSION_LABEL_PATTERN,
  type ActorKind,
  type CourseEditionStatus,
  type Id,
  type NormalizedBBox,
  type ReviewState,
  type Sha256,
  type SourceVerificationState,
  type Timestamp,
  type TocNodeType,
} from '../primitives.js';
import {
  IssueCollector,
  checkSafeText,
  finish,
  readArray,
  readBBox,
  readEnum,
  readId,
  readManagedAssetId,
  readNumber,
  readObject,
  readSchemaVersion,
  readSha256,
  readString,
  readStringArray,
  readTimestamp,
  validateWith,
  type ValidationResult,
} from '../validation.js';

export type SourceIdentityKind = 'cover' | 'copyright_page' | 'colophon' | 'toc' | 'none';

export interface SourceIdentity {
  readonly verifiedFrom: SourceIdentityKind;
  readonly notes: string;
  readonly sha256: Sha256 | null;
}

export interface CourseEdition {
  readonly schemaVersion: 1;
  readonly id: Id;
  readonly subject: string;
  readonly grade: number;
  readonly term: 1 | 2;
  readonly publisher: string;
  readonly editionLabel: string;
  readonly sourceIdentity: SourceIdentity;
  readonly status: CourseEditionStatus;
}

export interface ConfirmedBookMetadata {
  readonly title: string | null;
  readonly publisher: string | null;
  readonly editionLabel: string | null;
  readonly confirmedAt: Timestamp | null;
}

export interface BookInstance {
  readonly schemaVersion: 1;
  readonly id: Id;
  readonly courseEditionId: Id;
  readonly originalSha256: Sha256;
  readonly pageCount: number;
  readonly managedAssetId: Id;
  readonly confirmedMetadata: ConfirmedBookMetadata;
  readonly createdAt: Timestamp;
}

export interface SourceVerification {
  readonly state: SourceVerificationState;
  readonly actorKind: ActorKind | null;
  readonly checkedAt: Timestamp | null;
  readonly notes: string | null;
}

export interface SourceRef {
  readonly schemaVersion: 1;
  readonly id: Id;
  /** Exactly one of bookInstanceId / baselineSourceId resolves the source. */
  readonly bookInstanceId: Id | null;
  readonly baselineSourceId: Id | null;
  /** 1-based PDF page index. Never a printed page number. */
  readonly pdfPage: number;
  /** Printed page label, explicitly null when unknown. Never fabricate an offset. */
  readonly printedPage: string | null;
  readonly bbox: NormalizedBBox | null;
  readonly blockId: Id | null;
  readonly figureId: Id | null;
  readonly verification: SourceVerification;
}

export type SourceBlockType = 'heading' | 'paragraph' | 'caption' | 'table' | 'list';
export type ExtractionMethod = 'text_layer' | 'ocr' | 'manual';

export interface SourceBlock {
  readonly schemaVersion: 1;
  readonly id: Id;
  readonly sourceRefId: Id;
  readonly type: SourceBlockType;
  /** Immutable extraction output; revisions are appended, never overwritten. */
  readonly originalText: string;
  readonly revisedText: string | null;
  readonly extractionMethod: ExtractionMethod;
  readonly textConfidence: number | null;
  readonly reviewState: ReviewState;
}

export type FigureType = 'photo' | 'diagram' | 'chart' | 'map' | 'other';

export interface Figure {
  readonly schemaVersion: 1;
  readonly id: Id;
  readonly sourceRefId: Id;
  readonly type: FigureType;
  /** Immutable original asset, kept even after a revised crop exists. */
  readonly originalAssetId: Id;
  /** Currently displayed asset (may equal originalAssetId). */
  readonly activeAssetId: Id;
  readonly caption: string | null;
  readonly extractionMethod: ExtractionMethod;
  readonly reviewState: ReviewState;
}

export interface TocNode {
  readonly schemaVersion: 1;
  readonly id: Id;
  readonly courseEditionId: Id;
  readonly parentId: Id | null;
  readonly type: TocNodeType;
  readonly title: string;
  readonly order: number;
  readonly sourceRefs: readonly Id[];
}

const SOURCE_IDENTITY_KINDS: readonly SourceIdentityKind[] = [
  'cover',
  'copyright_page',
  'colophon',
  'toc',
  'none',
];

function readSourceIdentity(
  value: unknown,
  path: string,
  issues: IssueCollector,
): SourceIdentity | null {
  const obj = readObject(value, path, ['verifiedFrom', 'notes', 'sha256'], issues);
  if (obj === null) return null;
  const verifiedFrom = readEnum(obj, 'verifiedFrom', path, issues, SOURCE_IDENTITY_KINDS);
  const notes = readString(obj, 'notes', path, issues, { minLength: 1, maxLength: 2000 });
  const sha256 = readSha256(obj, 'sha256', path, issues, { nullable: true });
  if (verifiedFrom === null || notes === null) return null;
  return { verifiedFrom, notes, sha256 };
}

function readCourseEdition(
  value: unknown,
  path: string,
  issues: IssueCollector,
): CourseEdition | null {
  const obj = readObject(
    value,
    path,
    [
      'schemaVersion',
      'id',
      'subject',
      'grade',
      'term',
      'publisher',
      'editionLabel',
      'sourceIdentity',
      'status',
    ],
    issues,
  );
  if (obj === null) return null;
  readSchemaVersion(obj, path, issues);
  const id = readId(obj, 'id', path, issues);
  const subject = readString(obj, 'subject', path, issues, {
    pattern: SUBJECT_SLUG_PATTERN,
    patternMessage: 'subject must be a data slug, not a hardcoded domain enum',
  });
  const grade = readNumber(obj, 'grade', path, issues, { integer: true, min: 1, max: 12 });
  const termRaw = readNumber(obj, 'term', path, issues, { integer: true, min: 1, max: 2 });
  const publisher = readString(obj, 'publisher', path, issues, { minLength: 1 });
  const editionLabel = readString(obj, 'editionLabel', path, issues, { minLength: 1 });
  const sourceIdentity = readSourceIdentity(obj['sourceIdentity'], `${path}.sourceIdentity`, issues);
  const status = readEnum(obj, 'status', path, issues, COURSE_EDITION_STATUSES);
  if (
    id === null ||
    subject === null ||
    grade === null ||
    termRaw === null ||
    publisher === null ||
    editionLabel === null ||
    sourceIdentity === null ||
    status === null
  ) {
    return null;
  }
  if (status === 'verified' && (sourceIdentity.verifiedFrom === 'none' || sourceIdentity.sha256 === null)) {
    issues.add(
      'COURSE_IDENTITY_UNVERIFIED',
      `${path}.sourceIdentity`,
      'a verified course edition needs cover/copyright evidence and a file hash',
    );
    return null;
  }
  return {
    schemaVersion: 1,
    id,
    subject,
    grade,
    term: termRaw === 1 ? 1 : 2,
    publisher,
    editionLabel,
    sourceIdentity,
    status,
  };
}

export const validateCourseEdition: (input: unknown) => ValidationResult<CourseEdition> =
  validateWith(readCourseEdition);

function readConfirmedMetadata(
  value: unknown,
  path: string,
  issues: IssueCollector,
): ConfirmedBookMetadata | null {
  const obj = readObject(value, path, ['title', 'publisher', 'editionLabel', 'confirmedAt'], issues);
  if (obj === null) return null;
  const title = readString(obj, 'title', path, issues, { nullable: true });
  const publisher = readString(obj, 'publisher', path, issues, { nullable: true });
  const editionLabel = readString(obj, 'editionLabel', path, issues, { nullable: true });
  const confirmedAt = readTimestamp(obj, 'confirmedAt', path, issues, { nullable: true });
  return { title, publisher, editionLabel, confirmedAt };
}

function readBookInstance(
  value: unknown,
  path: string,
  issues: IssueCollector,
): BookInstance | null {
  const obj = readObject(
    value,
    path,
    [
      'schemaVersion',
      'id',
      'courseEditionId',
      'originalSha256',
      'pageCount',
      'managedAssetId',
      'confirmedMetadata',
      'createdAt',
    ],
    issues,
  );
  if (obj === null) return null;
  readSchemaVersion(obj, path, issues);
  const id = readId(obj, 'id', path, issues);
  const courseEditionId = readId(obj, 'courseEditionId', path, issues);
  const originalSha256 = readSha256(obj, 'originalSha256', path, issues);
  const pageCount = readNumber(obj, 'pageCount', path, issues, { integer: true, min: 1 });
  const managedAssetId = readManagedAssetId(obj, 'managedAssetId', path, issues);
  const confirmedMetadata = readConfirmedMetadata(
    obj['confirmedMetadata'],
    `${path}.confirmedMetadata`,
    issues,
  );
  const createdAt = readTimestamp(obj, 'createdAt', path, issues);
  if (
    id === null ||
    courseEditionId === null ||
    originalSha256 === null ||
    pageCount === null ||
    managedAssetId === null ||
    confirmedMetadata === null ||
    createdAt === null
  ) {
    return null;
  }
  return {
    schemaVersion: 1,
    id,
    courseEditionId,
    originalSha256,
    pageCount,
    managedAssetId,
    confirmedMetadata,
    createdAt,
  };
}

export const validateBookInstance: (input: unknown) => ValidationResult<BookInstance> =
  validateWith(readBookInstance);

function readSourceVerification(
  value: unknown,
  path: string,
  issues: IssueCollector,
): SourceVerification | null {
  const obj = readObject(value, path, ['state', 'actorKind', 'checkedAt', 'notes'], issues);
  if (obj === null) return null;
  const state = readEnum(obj, 'state', path, issues, SOURCE_VERIFICATION_STATES);
  const actorKind = readEnum(obj, 'actorKind', path, issues, ACTOR_KINDS, { nullable: true });
  const checkedAt = readTimestamp(obj, 'checkedAt', path, issues, { nullable: true });
  const notes = readString(obj, 'notes', path, issues, { nullable: true });
  if (state === null) return null;
  if ((state === 'machine_matched' || state === 'human_checked') && checkedAt === null) {
    issues.add('INVALID_REFERENCE', `${path}.checkedAt`, `state ${state} requires checkedAt`);
    return null;
  }
  if (state === 'human_checked' && actorKind !== 'human_curator') {
    issues.add(
      'INVALID_REFERENCE',
      `${path}.actorKind`,
      'human_checked source references require a human_curator actor (AI must not claim expert review)',
    );
    return null;
  }
  return { state, actorKind, checkedAt, notes };
}

function readSourceRef(value: unknown, path: string, issues: IssueCollector): SourceRef | null {
  const obj = readObject(
    value,
    path,
    [
      'schemaVersion',
      'id',
      'bookInstanceId',
      'baselineSourceId',
      'pdfPage',
      'printedPage',
      'bbox',
      'blockId',
      'figureId',
      'verification',
    ],
    issues,
  );
  if (obj === null) return null;
  readSchemaVersion(obj, path, issues);
  const id = readId(obj, 'id', path, issues);
  const bookInstanceId = readId(obj, 'bookInstanceId', path, issues, { nullable: true });
  const baselineSourceId = readId(obj, 'baselineSourceId', path, issues, { nullable: true });
  const pdfPage = readNumber(obj, 'pdfPage', path, issues, { integer: true, min: 1 });
  const printedPage = readString(obj, 'printedPage', path, issues, { nullable: true });
  const bbox = readBBox(obj, 'bbox', path, issues, { nullable: true });
  const blockId = readId(obj, 'blockId', path, issues, { nullable: true });
  const figureId = readId(obj, 'figureId', path, issues, { nullable: true });
  const verification = readSourceVerification(
    obj['verification'],
    `${path}.verification`,
    issues,
  );
  if ((bookInstanceId === null) === (baselineSourceId === null)) {
    issues.add(
      'INVALID_REFERENCE',
      path,
      'exactly one of bookInstanceId / baselineSourceId must be set',
    );
    return null;
  }
  if (blockId !== null && figureId !== null) {
    issues.add('INVALID_REFERENCE', path, 'blockId and figureId are mutually exclusive');
    return null;
  }
  if (id === null || pdfPage === null || verification === null) {
    return null;
  }
  return {
    schemaVersion: 1,
    id,
    bookInstanceId,
    baselineSourceId,
    pdfPage,
    printedPage,
    bbox,
    blockId,
    figureId,
    verification,
  };
}

export const validateSourceRef: (input: unknown) => ValidationResult<SourceRef> =
  validateWith(readSourceRef);

const SOURCE_BLOCK_TYPES: readonly SourceBlockType[] = [
  'heading',
  'paragraph',
  'caption',
  'table',
  'list',
];
const EXTRACTION_METHODS: readonly ExtractionMethod[] = ['text_layer', 'ocr', 'manual'];

function readSourceBlock(
  value: unknown,
  path: string,
  issues: IssueCollector,
): SourceBlock | null {
  const obj = readObject(
    value,
    path,
    [
      'schemaVersion',
      'id',
      'sourceRefId',
      'type',
      'originalText',
      'revisedText',
      'extractionMethod',
      'textConfidence',
      'reviewState',
    ],
    issues,
  );
  if (obj === null) return null;
  readSchemaVersion(obj, path, issues);
  const id = readId(obj, 'id', path, issues);
  const sourceRefId = readId(obj, 'sourceRefId', path, issues);
  const type = readEnum(obj, 'type', path, issues, SOURCE_BLOCK_TYPES);
  const originalText = readString(obj, 'originalText', path, issues, { minLength: 1 });
  const revisedText = readString(obj, 'revisedText', path, issues, { nullable: true });
  const extractionMethod = readEnum(obj, 'extractionMethod', path, issues, EXTRACTION_METHODS);
  const textConfidence = readNumber(obj, 'textConfidence', path, issues, {
    nullable: true,
    min: 0,
    max: 1,
  });
  const reviewState = readEnum(obj, 'reviewState', path, issues, REVIEW_STATES);
  if (
    id === null ||
    sourceRefId === null ||
    type === null ||
    originalText === null ||
    extractionMethod === null ||
    reviewState === null
  ) {
    return null;
  }
  if (extractionMethod === 'ocr' && textConfidence === null) {
    issues.add('INVALID_FORMAT', `${path}.textConfidence`, 'OCR blocks must record textConfidence');
    return null;
  }
  if (originalText.trim().length === 0) {
    issues.add('INVALID_FORMAT', `${path}.originalText`, 'original extraction text must not be empty');
    return null;
  }
  return {
    schemaVersion: 1,
    id,
    sourceRefId,
    type,
    originalText,
    revisedText,
    extractionMethod,
    textConfidence,
    reviewState,
  };
}

export const validateSourceBlock: (input: unknown) => ValidationResult<SourceBlock> =
  validateWith(readSourceBlock);

const FIGURE_TYPES: readonly FigureType[] = ['photo', 'diagram', 'chart', 'map', 'other'];

function readFigure(value: unknown, path: string, issues: IssueCollector): Figure | null {
  const obj = readObject(
    value,
    path,
    [
      'schemaVersion',
      'id',
      'sourceRefId',
      'type',
      'originalAssetId',
      'activeAssetId',
      'caption',
      'extractionMethod',
      'reviewState',
    ],
    issues,
  );
  if (obj === null) return null;
  readSchemaVersion(obj, path, issues);
  const id = readId(obj, 'id', path, issues);
  const sourceRefId = readId(obj, 'sourceRefId', path, issues);
  const type = readEnum(obj, 'type', path, issues, FIGURE_TYPES);
  const originalAssetId = readManagedAssetId(obj, 'originalAssetId', path, issues);
  const activeAssetId = readManagedAssetId(obj, 'activeAssetId', path, issues);
  const caption = readString(obj, 'caption', path, issues, { nullable: true });
  const extractionMethod = readEnum(obj, 'extractionMethod', path, issues, EXTRACTION_METHODS);
  const reviewState = readEnum(obj, 'reviewState', path, issues, REVIEW_STATES);
  if (
    id === null ||
    sourceRefId === null ||
    type === null ||
    originalAssetId === null ||
    activeAssetId === null ||
    extractionMethod === null ||
    reviewState === null
  ) {
    return null;
  }
  return {
    schemaVersion: 1,
    id,
    sourceRefId,
    type,
    originalAssetId,
    activeAssetId,
    caption,
    extractionMethod,
    reviewState,
  };
}

export const validateFigure: (input: unknown) => ValidationResult<Figure> =
  validateWith(readFigure);

function readTocNode(value: unknown, path: string, issues: IssueCollector): TocNode | null {
  const obj = readObject(
    value,
    path,
    ['schemaVersion', 'id', 'courseEditionId', 'parentId', 'type', 'title', 'order', 'sourceRefs'],
    issues,
  );
  if (obj === null) return null;
  readSchemaVersion(obj, path, issues);
  const id = readId(obj, 'id', path, issues);
  const courseEditionId = readId(obj, 'courseEditionId', path, issues);
  const parentId = readId(obj, 'parentId', path, issues, { nullable: true });
  const type = readEnum(obj, 'type', path, issues, TOC_NODE_TYPES);
  const title = readString(obj, 'title', path, issues, { minLength: 1 });
  const order = readNumber(obj, 'order', path, issues, { integer: true, min: 0 });
  const sourceRefs = readStringArray(obj, 'sourceRefs', path, issues, { idItems: true });
  if (
    id === null ||
    courseEditionId === null ||
    type === null ||
    title === null ||
    order === null ||
    sourceRefs === null
  ) {
    return null;
  }
  if (!checkSafeText(title, `${path}.title`, issues)) return null;
  return {
    schemaVersion: 1,
    id,
    courseEditionId,
    parentId,
    type,
    title,
    order,
    sourceRefs,
  };
}

export const validateTocNode: (input: unknown) => ValidationResult<TocNode> =
  validateWith(readTocNode);

/** Content entities inside a pack must share the pack's course edition. */
export function checkEditionBinding(
  entities: readonly { readonly id: Id; readonly courseEditionId: Id }[],
  courseEditionId: Id,
  path: string,
): IssueCollector {
  const issues = new IssueCollector();
  for (const entity of entities) {
    if (entity.courseEditionId !== courseEditionId) {
      issues.add(
        'INVALID_REFERENCE',
        `${path}.${entity.id}.courseEditionId`,
        `content entity belongs to course edition ${entity.courseEditionId}, expected ${courseEditionId}`,
      );
    }
  }
  return issues;
}

/**
 * Copying a pack must not be used to smuggle a trust-mode change: candidate
 * packs are only usable in explicit candidate trust mode.
 */
export function checkTrustModeForPack(
  packTrustMode: (typeof TRUST_MODES)[number],
  sessionTrustMode: (typeof TRUST_MODES)[number],
  path: string,
): IssueCollector {
  const issues = new IssueCollector();
  if (packTrustMode === 'candidate' && sessionTrustMode !== 'candidate') {
    issues.add(
      'TRUST_MODE_VIOLATION',
      path,
      'candidate content can only be used in explicit candidate trust mode',
    );
  }
  if (packTrustMode === 'published' && sessionTrustMode === 'candidate') {
    issues.add(
      'TRUST_MODE_VIOLATION',
      path,
      'a published pack cannot be downgraded to candidate trust mode for formal learning',
    );
  }
  return issues;
}


