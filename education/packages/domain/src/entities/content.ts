/**
 * Content contract entities (05 §2, §4, §5): Concept, Relation, Rubric,
 * Activity, DiagramSpec, CoverageManifest, ReviewLedgerEntry and ContentPack.
 */

import {
  ACTOR_KINDS,
  ACTIVITY_TYPES,
  PACK_COVERAGE_STATUSES,
  PACK_SCOPES,
  PACK_STATUSES,
  RELATION_BASES,
  RELATION_TYPES,
  REVIEW_STATES,
  VERSION_LABEL_PATTERN,
  isPlainObject,
  type ActivityType,
  type ActorKind,
  type EvidenceEffect,
  type Id,
  type PackCoverageStatus,
  type PackScope,
  type PackStatus,
  type RelationBasis,
  type RelationType,
  type ReviewState,
  type Sha256,
  type Timestamp,
  type NormalizedBBox,
} from '../primitives.js';
import {
  IssueCollector,
  checkSafeText,
  finish,
  readArray,
  readBBox,
  readBoolean,
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

export interface Misconception {
  readonly statement: string;
  readonly correction: string;
  readonly sourceRefs: readonly Id[];
}

export interface Concept {
  readonly schemaVersion: 1;
  readonly id: Id;
  readonly courseEditionId: Id;
  readonly title: string;
  readonly aliases: readonly string[];
  readonly placements: readonly Id[];
  readonly learningObjectives: readonly string[];
  readonly explanation: string;
  readonly misconceptions: readonly Misconception[];
  readonly sourceRefs: readonly Id[];
  readonly rubricIds: readonly Id[];
  readonly activityIds: readonly Id[];
  readonly reviewState: ReviewState;
}

export interface Relation {
  readonly schemaVersion: 1;
  readonly id: Id;
  readonly courseEditionId: Id;
  readonly fromConceptId: Id;
  readonly toConceptId: Id;
  /** prerequisite: understand `from` before `to`; related: symmetric association. */
  readonly type: RelationType;
  readonly basis: RelationBasis;
  readonly rationale: string;
  readonly sourceRefs: readonly Id[];
  readonly reviewState: ReviewState;
}

export interface RubricCriterion {
  readonly criterionId: Id;
  readonly description: string;
  readonly acceptableEvidence: readonly string[];
  readonly commonMisconceptions: readonly string[];
  readonly counterExamples: readonly string[];
  readonly transferItems: readonly string[];
  readonly feedbackSourceRefs: readonly Id[];
}

export interface Rubric {
  readonly schemaVersion: 1;
  readonly id: Id;
  readonly version: string;
  readonly courseEditionId: Id;
  readonly conceptIds: readonly Id[];
  readonly criteria: readonly RubricCriterion[];
  readonly reviewState: ReviewState;
}

export interface DiagramNode {
  readonly id: Id;
  readonly label: string;
  readonly kind: 'concept' | 'structure' | 'process' | 'region';
}

export interface DiagramEdge {
  readonly id: Id;
  readonly from: Id;
  readonly to: Id;
  readonly label: string | null;
  readonly directed: boolean;
}

export interface DiagramLabel {
  readonly id: Id;
  readonly text: string;
  readonly targetId: Id | null;
}

export interface DiagramRegion {
  readonly id: Id;
  readonly assetId: Id;
  readonly bbox: NormalizedBBox;
  readonly altText: string;
}

/**
 * Static controlled structure only: no scripts, no arbitrary HTML, no layout
 * code. Regions reference host managed assets with normalized coordinates.
 */
export interface DiagramSpec {
  readonly schemaVersion: 1;
  readonly nodes: readonly DiagramNode[];
  readonly edges: readonly DiagramEdge[];
  readonly labels: readonly DiagramLabel[];
  readonly regions: readonly DiagramRegion[];
  readonly altText: string;
  readonly sourceRefs: readonly Id[];
}

export type AnswerSchema =
  | { readonly kind: 'text'; readonly maxLength: number | null }
  | {
      readonly kind: 'choice';
      readonly selection: 'single' | 'multiple';
      readonly options: readonly { readonly id: Id; readonly label: string }[];
      readonly correctOptionIds: readonly Id[] | null;
    }
  | { readonly kind: 'diagram_label'; readonly targets: readonly { readonly id: Id; readonly label: string }[] }
  | {
      readonly kind: 'relation';
      readonly pairs: readonly { readonly fromId: Id; readonly toId: Id }[];
    };

export const ANSWER_DISCLOSURE_POLICIES = [
  'after_independent_attempt',
  'after_help_request',
  'manual_review',
] as const;
export type AnswerDisclosurePolicy = (typeof ANSWER_DISCLOSURE_POLICIES)[number];

export interface Activity {
  readonly schemaVersion: 1;
  readonly id: Id;
  readonly version: string;
  readonly courseEditionId: Id;
  readonly conceptIds: readonly Id[];
  readonly type: ActivityType;
  readonly stem: string;
  readonly sourceRefs: readonly Id[];
  readonly renderSpec: DiagramSpec | null;
  readonly answerSchema: AnswerSchema;
  readonly rubricId: Id;
  readonly rubricVersion: string;
  readonly answerDisclosurePolicy: AnswerDisclosurePolicy;
}

export const COVERAGE_SECTION_STATUSES = ['covered', 'partial', 'excluded', 'blocked'] as const;
export type CoverageSectionStatus = (typeof COVERAGE_SECTION_STATUSES)[number];

export interface CoverageSection {
  readonly tocNodeId: Id;
  readonly sourceRefs: readonly Id[];
  readonly conceptIds: readonly Id[];
  readonly status: CoverageSectionStatus;
  readonly notes: string | null;
}

export interface CoverageExclusion {
  readonly item: string;
  readonly reason: string;
  readonly sourceRefs: readonly Id[];
}

export interface CoverageManifest {
  readonly schemaVersion: 1;
  readonly courseEditionId: Id;
  readonly generatedAt: Timestamp;
  readonly targetTocNodeIds: readonly Id[];
  readonly sections: readonly CoverageSection[];
  readonly exclusions: readonly CoverageExclusion[];
  readonly totals: {
    readonly targetSections: number;
    readonly coveredSections: number;
    readonly conceptCount: number;
  };
}

export interface ReviewLedgerEntry {
  readonly schemaVersion: 1;
  readonly id: Id;
  readonly entityKind:
    | 'content_pack'
    | 'concept'
    | 'relation'
    | 'activity'
    | 'rubric'
    | 'source_ref';
  readonly entityId: Id;
  readonly from: ReviewState | null;
  readonly to: ReviewState;
  readonly actorKind: ActorKind;
  readonly actorLabel: string | null;
  readonly checkedAt: Timestamp;
  readonly scope: string;
  readonly notes: string | null;
  readonly evidenceRefs: readonly Id[];
}

export interface ContentPack {
  readonly schemaVersion: 1;
  readonly id: Id;
  readonly version: string;
  readonly courseEditionId: Id;
  readonly scope: PackScope;
  readonly coverageStatus: PackCoverageStatus;
  readonly status: PackStatus;
  /** SHA-256 of canonical content JSON; computed host side (see contract-lock). */
  readonly contentHash: Sha256;
  readonly toc: readonly TocNodeLike[];
  readonly concepts: readonly Concept[];
  readonly relations: readonly Relation[];
  readonly activities: readonly Activity[];
  readonly rubrics: readonly Rubric[];
  readonly coverageManifest: CoverageManifest;
  readonly reviewLedger: readonly ReviewLedgerEntry[];
}

/** Minimal structural shape used to avoid an import cycle with sources.ts. */
export interface TocNodeLike {
  readonly schemaVersion: 1;
  readonly id: Id;
  readonly courseEditionId: Id;
  readonly parentId: Id | null;
  readonly type: 'volume' | 'unit' | 'chapter' | 'section';
  readonly title: string;
  readonly order: number;
  readonly sourceRefs: readonly Id[];
}

function readMisconception(
  value: unknown,
  path: string,
  issues: IssueCollector,
): Misconception | null {
  const obj = readObject(value, path, ['statement', 'correction', 'sourceRefs'], issues);
  if (obj === null) return null;
  const statement = readString(obj, 'statement', path, issues, { minLength: 1 });
  const correction = readString(obj, 'correction', path, issues, { minLength: 1 });
  const sourceRefs = readStringArray(obj, 'sourceRefs', path, issues, { idItems: true });
  if (statement === null || correction === null || sourceRefs === null) return null;
  return { statement, correction, sourceRefs };
}

export function readConceptAt(value: unknown, path: string, issues: IssueCollector): Concept | null {
  const obj = readObject(
    value,
    path,
    [
      'schemaVersion',
      'id',
      'courseEditionId',
      'title',
      'aliases',
      'placements',
      'learningObjectives',
      'explanation',
      'misconceptions',
      'sourceRefs',
      'rubricIds',
      'activityIds',
      'reviewState',
    ],
    issues,
  );
  if (obj === null) return null;
  readSchemaVersion(obj, path, issues);
  const id = readId(obj, 'id', path, issues);
  const courseEditionId = readId(obj, 'courseEditionId', path, issues);
  const title = readString(obj, 'title', path, issues, { minLength: 1 });
  const aliases = readStringArray(obj, 'aliases', path, issues, { optional: true });
  const placements = readStringArray(obj, 'placements', path, issues, { idItems: true, minItems: 1 });
  const learningObjectives = readStringArray(obj, 'learningObjectives', path, issues, {
    minItems: 1,
  });
  const explanation = readString(obj, 'explanation', path, issues, { minLength: 1 });
  const misconceptions = readArray(obj, 'misconceptions', path, issues, readMisconception, {
    optional: true,
  });
  const sourceRefs = readStringArray(obj, 'sourceRefs', path, issues, { idItems: true });
  const rubricIds = readStringArray(obj, 'rubricIds', path, issues, { idItems: true });
  const activityIds = readStringArray(obj, 'activityIds', path, issues, { idItems: true });
  const reviewState = readEnum(obj, 'reviewState', path, issues, REVIEW_STATES);
  if (
    id === null ||
    courseEditionId === null ||
    title === null ||
    placements === null ||
    learningObjectives === null ||
    explanation === null ||
    sourceRefs === null ||
    rubricIds === null ||
    activityIds === null ||
    reviewState === null
  ) {
    return null;
  }
  if (!checkSafeText(explanation, `${path}.explanation`, issues)) return null;
  return {
    schemaVersion: 1,
    id,
    courseEditionId,
    title,
    aliases: aliases ?? [],
    placements,
    learningObjectives,
    explanation,
    misconceptions: misconceptions ?? [],
    sourceRefs,
    rubricIds,
    activityIds,
    reviewState,
  };
}

export const validateConcept: (input: unknown) => ValidationResult<Concept> =
  validateWith(readConceptAt);

export function readRelationAt(
  value: unknown,
  path: string,
  issues: IssueCollector,
): Relation | null {
  const obj = readObject(
    value,
    path,
    [
      'schemaVersion',
      'id',
      'courseEditionId',
      'fromConceptId',
      'toConceptId',
      'type',
      'basis',
      'rationale',
      'sourceRefs',
      'reviewState',
    ],
    issues,
  );
  if (obj === null) return null;
  readSchemaVersion(obj, path, issues);
  const id = readId(obj, 'id', path, issues);
  const courseEditionId = readId(obj, 'courseEditionId', path, issues);
  const fromConceptId = readId(obj, 'fromConceptId', path, issues);
  const toConceptId = readId(obj, 'toConceptId', path, issues);
  const type = readEnum(obj, 'type', path, issues, RELATION_TYPES);
  const basis = readEnum(obj, 'basis', path, issues, RELATION_BASES);
  const rationale = readString(obj, 'rationale', path, issues, { minLength: 1 });
  const sourceRefs = readStringArray(obj, 'sourceRefs', path, issues, { idItems: true });
  const reviewState = readEnum(obj, 'reviewState', path, issues, REVIEW_STATES);
  if (
    id === null ||
    courseEditionId === null ||
    fromConceptId === null ||
    toConceptId === null ||
    type === null ||
    basis === null ||
    rationale === null ||
    sourceRefs === null ||
    reviewState === null
  ) {
    return null;
  }
  return {
    schemaVersion: 1,
    id,
    courseEditionId,
    fromConceptId,
    toConceptId,
    type,
    basis,
    rationale,
    sourceRefs,
    reviewState,
  };
}

export const validateRelation: (input: unknown) => ValidationResult<Relation> =
  validateWith(readRelationAt);

function readRubricCriterion(
  value: unknown,
  path: string,
  issues: IssueCollector,
): RubricCriterion | null {
  const obj = readObject(
    value,
    path,
    [
      'criterionId',
      'description',
      'acceptableEvidence',
      'commonMisconceptions',
      'counterExamples',
      'transferItems',
      'feedbackSourceRefs',
    ],
    issues,
  );
  if (obj === null) return null;
  const criterionId = readId(obj, 'criterionId', path, issues);
  const description = readString(obj, 'description', path, issues, { minLength: 1 });
  const acceptableEvidence = readStringArray(obj, 'acceptableEvidence', path, issues, {
    minItems: 1,
  });
  const commonMisconceptions = readStringArray(obj, 'commonMisconceptions', path, issues, {
    optional: true,
  });
  const counterExamples = readStringArray(obj, 'counterExamples', path, issues, {
    optional: true,
  });
  const transferItems = readStringArray(obj, 'transferItems', path, issues, { optional: true });
  const feedbackSourceRefs = readStringArray(obj, 'feedbackSourceRefs', path, issues, {
    idItems: true,
    optional: true,
  });
  if (
    criterionId === null ||
    description === null ||
    acceptableEvidence === null
  ) {
    return null;
  }
  return {
    criterionId,
    description,
    acceptableEvidence,
    commonMisconceptions: commonMisconceptions ?? [],
    counterExamples: counterExamples ?? [],
    transferItems: transferItems ?? [],
    feedbackSourceRefs: feedbackSourceRefs ?? [],
  };
}

export function readRubricAt(value: unknown, path: string, issues: IssueCollector): Rubric | null {
  const obj = readObject(
    value,
    path,
    ['schemaVersion', 'id', 'version', 'courseEditionId', 'conceptIds', 'criteria', 'reviewState'],
    issues,
  );
  if (obj === null) return null;
  readSchemaVersion(obj, path, issues);
  const id = readId(obj, 'id', path, issues);
  const version = readString(obj, 'version', path, issues, {
    pattern: VERSION_LABEL_PATTERN,
    patternMessage: 'rubric version must be a bounded printable label',
  });
  const courseEditionId = readId(obj, 'courseEditionId', path, issues);
  const conceptIds = readStringArray(obj, 'conceptIds', path, issues, { idItems: true, minItems: 1 });
  const criteria = readArray(obj, 'criteria', path, issues, readRubricCriterion, { minItems: 1 });
  const reviewState = readEnum(obj, 'reviewState', path, issues, REVIEW_STATES);
  if (
    id === null ||
    version === null ||
    courseEditionId === null ||
    conceptIds === null ||
    criteria === null ||
    reviewState === null
  ) {
    return null;
  }
  return { schemaVersion: 1, id, version, courseEditionId, conceptIds, criteria, reviewState };
}

export const validateRubric: (input: unknown) => ValidationResult<Rubric> =
  validateWith(readRubricAt);

const DIAGRAM_NODE_KINDS = ['concept', 'structure', 'process', 'region'] as const;

function readDiagramNode(value: unknown, path: string, issues: IssueCollector): DiagramNode | null {
  const obj = readObject(value, path, ['id', 'label', 'kind'], issues);
  if (obj === null) return null;
  const id = readId(obj, 'id', path, issues);
  const label = readString(obj, 'label', path, issues, { minLength: 1 });
  const kind = readEnum(obj, 'kind', path, issues, DIAGRAM_NODE_KINDS);
  if (id === null || label === null || kind === null) return null;
  if (!checkSafeText(label, `${path}.label`, issues)) return null;
  return { id, label, kind };
}

function readDiagramEdge(value: unknown, path: string, issues: IssueCollector): DiagramEdge | null {
  const obj = readObject(value, path, ['id', 'from', 'to', 'label', 'directed'], issues);
  if (obj === null) return null;
  const id = readId(obj, 'id', path, issues);
  const from = readId(obj, 'from', path, issues);
  const to = readId(obj, 'to', path, issues);
  const label = readString(obj, 'label', path, issues, { nullable: true });
  const directed = readBoolean(obj, 'directed', path, issues);
  if (id === null || from === null || to === null || directed === null) return null;
  return { id, from, to, label, directed };
}

function readDiagramLabel(
  value: unknown,
  path: string,
  issues: IssueCollector,
): DiagramLabel | null {
  const obj = readObject(value, path, ['id', 'text', 'targetId'], issues);
  if (obj === null) return null;
  const id = readId(obj, 'id', path, issues);
  const text = readString(obj, 'text', path, issues, { minLength: 1 });
  const targetId = readId(obj, 'targetId', path, issues, { nullable: true });
  if (id === null || text === null) return null;
  if (!checkSafeText(text, `${path}.text`, issues)) return null;
  return { id, text, targetId };
}

function readDiagramRegion(
  value: unknown,
  path: string,
  issues: IssueCollector,
): DiagramRegion | null {
  const obj = readObject(value, path, ['id', 'assetId', 'bbox', 'altText'], issues);
  if (obj === null) return null;
  const id = readId(obj, 'id', path, issues);
  const assetId = readManagedAssetId(obj, 'assetId', path, issues);
  const bbox = readBBox(obj, 'bbox', path, issues);
  const altText = readString(obj, 'altText', path, issues, { minLength: 1 });
  if (id === null || assetId === null || bbox === null || altText === null) return null;
  if (!checkSafeText(altText, `${path}.altText`, issues)) return null;
  return { id, assetId, bbox, altText };
}

export function readDiagramSpecAt(
  value: unknown,
  path: string,
  issues: IssueCollector,
): DiagramSpec | null {
  const obj = readObject(
    value,
    path,
    ['schemaVersion', 'nodes', 'edges', 'labels', 'regions', 'altText', 'sourceRefs'],
    issues,
  );
  if (obj === null) return null;
  readSchemaVersion(obj, path, issues);
  const nodes = readArray(obj, 'nodes', path, issues, readDiagramNode, { maxItems: 200 });
  const edges = readArray(obj, 'edges', path, issues, readDiagramEdge, { maxItems: 400 });
  const labels = readArray(obj, 'labels', path, issues, readDiagramLabel, { optional: true, maxItems: 100 });
  const regions = readArray(obj, 'regions', path, issues, readDiagramRegion, {
    optional: true,
    maxItems: 50,
  });
  const altText = readString(obj, 'altText', path, issues, { minLength: 1 });
  const sourceRefs = readStringArray(obj, 'sourceRefs', path, issues, { idItems: true });
  if (
    nodes === null ||
    edges === null ||
    altText === null ||
    sourceRefs === null
  ) {
    return null;
  }
  if (!checkSafeText(altText, `${path}.altText`, issues)) return null;
  const nodeIds = new Set(nodes.map((node) => node.id));
  edges.forEach((edge, index) => {
    if (!nodeIds.has(edge.from) || !nodeIds.has(edge.to)) {
      issues.add(
        'DANGLING_REFERENCE',
        `${path}.edges[${index}]`,
        `edge endpoints must resolve to diagram nodes (${edge.from} -> ${edge.to})`,
      );
    }
  });
  (labels ?? []).forEach((label, index) => {
    if (label.targetId !== null && !nodeIds.has(label.targetId)) {
      issues.add(
        'DANGLING_REFERENCE',
        `${path}.labels[${index}].targetId`,
        `label target ${label.targetId} does not resolve to a diagram node`,
      );
    }
  });
  return {
    schemaVersion: 1,
    nodes,
    edges,
    labels: labels ?? [],
    regions: regions ?? [],
    altText,
    sourceRefs,
  };
}

export const validateDiagramSpec: (input: unknown) => ValidationResult<DiagramSpec> =
  validateWith(readDiagramSpecAt);

const ANSWER_SCHEMA_KINDS = ['text', 'choice', 'diagram_label', 'relation'] as const;

function readChoiceOption(
  value: unknown,
  path: string,
  issues: IssueCollector,
): { id: Id; label: string } | null {
  const obj = readObject(value, path, ['id', 'label'], issues);
  if (obj === null) return null;
  const id = readId(obj, 'id', path, issues);
  const label = readString(obj, 'label', path, issues, { minLength: 1 });
  if (id === null || label === null) return null;
  if (!checkSafeText(label, `${path}.label`, issues)) return null;
  return { id, label };
}

function readAnswerSchema(value: unknown, path: string, issues: IssueCollector): AnswerSchema | null {
  if (!isPlainObject(value)) {
    issues.add('INVALID_TYPE', path, 'expected an answer schema object');
    return null;
  }
  const kind = value['kind'];
  if (typeof kind !== 'string' || !ANSWER_SCHEMA_KINDS.includes(kind as never)) {
    issues.add('INVALID_ENUM', `${path}.kind`, `expected one of: ${ANSWER_SCHEMA_KINDS.join(', ')}`);
    return null;
  }
  if (kind === 'text') {
    const obj = readObject(value, path, ['kind', 'maxLength'], issues);
    if (obj === null) return null;
    const maxLength = readNumber(obj, 'maxLength', path, issues, {
      integer: true,
      min: 1,
      nullable: true,
    });
    return { kind: 'text', maxLength };
  }
  if (kind === 'choice') {
    const obj = readObject(
      value,
      path,
      ['kind', 'selection', 'options', 'correctOptionIds'],
      issues,
    );
    if (obj === null) return null;
    const selection = readEnum(obj, 'selection', path, issues, ['single', 'multiple'] as const);
    const options = readArray(obj, 'options', path, issues, readChoiceOption, { minItems: 2 });
    const correctOptionIds = readStringArray(obj, 'correctOptionIds', path, issues, {
      idItems: true,
      optional: true,
      nullable: true,
    });
    if (selection === null || options === null) return null;
    const optionIds = new Set(options.map((option) => option.id));
    for (const id of correctOptionIds ?? []) {
      if (!optionIds.has(id)) {
        issues.add('DANGLING_REFERENCE', `${path}.correctOptionIds`, `option ${id} is not declared`);
      }
    }
    return { kind: 'choice', selection, options, correctOptionIds };
  }
  if (kind === 'diagram_label') {
    const obj = readObject(value, path, ['kind', 'targets'], issues);
    if (obj === null) return null;
    const targets = readArray(
      obj,
      'targets',
      path,
      issues,
      (item, at, collector) => {
        const inner = readObject(item, at, ['id', 'label'], collector);
        if (inner === null) return null;
        const id = readId(inner, 'id', at, collector);
        const label = readString(inner, 'label', at, collector, { minLength: 1 });
        if (id === null || label === null) return null;
        return { id, label };
      },
      { minItems: 1 },
    );
    if (targets === null) return null;
    return { kind: 'diagram_label', targets };
  }
  const obj = readObject(value, path, ['kind', 'pairs'], issues);
  if (obj === null) return null;
  const pairs = readArray(
    obj,
    'pairs',
    path,
    issues,
    (item, at, collector) => {
      const inner = readObject(item, at, ['fromId', 'toId'], collector);
      if (inner === null) return null;
      const fromId = readId(inner, 'fromId', at, collector);
      const toId = readId(inner, 'toId', at, collector);
      if (fromId === null || toId === null) return null;
      return { fromId, toId };
    },
    { minItems: 1 },
  );
  if (pairs === null) return null;
  return { kind: 'relation', pairs };
}

export function readActivityAt(
  value: unknown,
  path: string,
  issues: IssueCollector,
): Activity | null {
  const obj = readObject(
    value,
    path,
    [
      'schemaVersion',
      'id',
      'version',
      'courseEditionId',
      'conceptIds',
      'type',
      'stem',
      'sourceRefs',
      'renderSpec',
      'answerSchema',
      'rubricId',
      'rubricVersion',
      'answerDisclosurePolicy',
    ],
    issues,
  );
  if (obj === null) return null;
  readSchemaVersion(obj, path, issues);
  const id = readId(obj, 'id', path, issues);
  const version = readString(obj, 'version', path, issues, {
    pattern: VERSION_LABEL_PATTERN,
    patternMessage: 'activity version must be a bounded printable label',
  });
  const courseEditionId = readId(obj, 'courseEditionId', path, issues);
  const conceptIds = readStringArray(obj, 'conceptIds', path, issues, {
    idItems: true,
    minItems: 1,
  });
  const type = readEnum(obj, 'type', path, issues, ACTIVITY_TYPES);
  const stem = readString(obj, 'stem', path, issues, { minLength: 1 });
  const sourceRefs = readStringArray(obj, 'sourceRefs', path, issues, { idItems: true });
  const renderSpecRaw = obj['renderSpec'];
  let renderSpec: DiagramSpec | null = null;
  if (renderSpecRaw === null) {
    renderSpec = null;
  } else if (renderSpecRaw !== undefined) {
    renderSpec = readDiagramSpecAt(renderSpecRaw, `${path}.renderSpec`, issues);
  }
  const answerSchema = readAnswerSchema(obj['answerSchema'], `${path}.answerSchema`, issues);
  const rubricId = readId(obj, 'rubricId', path, issues);
  const rubricVersion = readString(obj, 'rubricVersion', path, issues, {
    pattern: VERSION_LABEL_PATTERN,
  });
  const answerDisclosurePolicy = readEnum(
    obj,
    'answerDisclosurePolicy',
    path,
    issues,
    ANSWER_DISCLOSURE_POLICIES,
  );
  if (
    id === null ||
    version === null ||
    courseEditionId === null ||
    conceptIds === null ||
    type === null ||
    stem === null ||
    sourceRefs === null ||
    answerSchema === null ||
    rubricId === null ||
    rubricVersion === null ||
    answerDisclosurePolicy === null
  ) {
    return null;
  }
  if (!checkSafeText(stem, `${path}.stem`, issues)) return null;
  if (type === 'diagram_label' && renderSpec === null) {
    issues.add('INVALID_REFERENCE', `${path}.renderSpec`, 'diagram_label activities require a renderSpec');
    return null;
  }
  const expectedSchemaKind =
    type === 'diagram_label'
      ? 'diagram_label'
      : type === 'relation'
        ? 'relation'
        : type === 'choice'
          ? 'choice'
          : 'text';
  if (answerSchema.kind !== expectedSchemaKind) {
    issues.add(
      'INVALID_REFERENCE',
      `${path}.answerSchema.kind`,
      `activity type ${type} requires answer schema ${expectedSchemaKind}, got ${answerSchema.kind}`,
    );
    return null;
  }
  return {
    schemaVersion: 1,
    id,
    version,
    courseEditionId,
    conceptIds,
    type,
    stem,
    sourceRefs,
    renderSpec,
    answerSchema,
    rubricId,
    rubricVersion,
    answerDisclosurePolicy,
  };
}

export const validateActivity: (input: unknown) => ValidationResult<Activity> =
  validateWith(readActivityAt);

function readCoverageSection(
  value: unknown,
  path: string,
  issues: IssueCollector,
): CoverageSection | null {
  const obj = readObject(
    value,
    path,
    ['tocNodeId', 'sourceRefs', 'conceptIds', 'status', 'notes'],
    issues,
  );
  if (obj === null) return null;
  const tocNodeId = readId(obj, 'tocNodeId', path, issues);
  const sourceRefs = readStringArray(obj, 'sourceRefs', path, issues, { idItems: true });
  const conceptIds = readStringArray(obj, 'conceptIds', path, issues, { idItems: true });
  const status = readEnum(obj, 'status', path, issues, COVERAGE_SECTION_STATUSES);
  const notes = readString(obj, 'notes', path, issues, { nullable: true });
  if (
    tocNodeId === null ||
    sourceRefs === null ||
    conceptIds === null ||
    status === null
  ) {
    return null;
  }
  if (status === 'covered' && (sourceRefs.length === 0 || conceptIds.length === 0)) {
    issues.add(
      'COVERAGE_INCOMPLETE',
      path,
      'a covered section requires source refs and at least one concept',
    );
    return null;
  }
  return { tocNodeId, sourceRefs, conceptIds, status, notes };
}

function readCoverageExclusion(
  value: unknown,
  path: string,
  issues: IssueCollector,
): CoverageExclusion | null {
  const obj = readObject(value, path, ['item', 'reason', 'sourceRefs'], issues);
  if (obj === null) return null;
  const item = readString(obj, 'item', path, issues, { minLength: 1 });
  const reason = readString(obj, 'reason', path, issues, { minLength: 1 });
  const sourceRefs = readStringArray(obj, 'sourceRefs', path, issues, { idItems: true });
  if (item === null || reason === null || sourceRefs === null) return null;
  return { item, reason, sourceRefs };
}

export function readCoverageManifestAt(
  value: unknown,
  path: string,
  issues: IssueCollector,
): CoverageManifest | null {
  const obj = readObject(
    value,
    path,
    ['schemaVersion', 'courseEditionId', 'generatedAt', 'targetTocNodeIds', 'sections', 'exclusions', 'totals'],
    issues,
  );
  if (obj === null) return null;
  readSchemaVersion(obj, path, issues);
  const courseEditionId = readId(obj, 'courseEditionId', path, issues);
  const generatedAt = readTimestamp(obj, 'generatedAt', path, issues);
  const targetTocNodeIds = readStringArray(obj, 'targetTocNodeIds', path, issues, {
    idItems: true,
    minItems: 1,
  });
  const sections = readArray(obj, 'sections', path, issues, readCoverageSection, { minItems: 1 });
  const exclusions = readArray(obj, 'exclusions', path, issues, readCoverageExclusion, {
    optional: true,
  });
  const totalsObj = readObject(
    obj['totals'],
    `${path}.totals`,
    ['targetSections', 'coveredSections', 'conceptCount'],
    issues,
  );
  let totals: CoverageManifest['totals'] | null = null;
  if (totalsObj !== null) {
    const targetSections = readNumber(totalsObj, 'targetSections', `${path}.totals`, issues, {
      integer: true,
      min: 1,
    });
    const coveredSections = readNumber(totalsObj, 'coveredSections', `${path}.totals`, issues, {
      integer: true,
      min: 0,
    });
    const conceptCount = readNumber(totalsObj, 'conceptCount', `${path}.totals`, issues, {
      integer: true,
      min: 0,
    });
    if (targetSections !== null && coveredSections !== null && conceptCount !== null) {
      totals = { targetSections, coveredSections, conceptCount };
    }
  }
  if (
    courseEditionId === null ||
    generatedAt === null ||
    targetTocNodeIds === null ||
    sections === null ||
    totals === null
  ) {
    return null;
  }
  return {
    schemaVersion: 1,
    courseEditionId,
    generatedAt,
    targetTocNodeIds,
    sections,
    exclusions: exclusions ?? [],
    totals,
  };
}

export const validateCoverageManifest: (input: unknown) => ValidationResult<CoverageManifest> =
  validateWith(readCoverageManifestAt);

export function readReviewLedgerEntryAt(
  value: unknown,
  path: string,
  issues: IssueCollector,
): ReviewLedgerEntry | null {
  const obj = readObject(
    value,
    path,
    [
      'schemaVersion',
      'id',
      'entityKind',
      'entityId',
      'from',
      'to',
      'actorKind',
      'actorLabel',
      'checkedAt',
      'scope',
      'notes',
      'evidenceRefs',
    ],
    issues,
  );
  if (obj === null) return null;
  readSchemaVersion(obj, path, issues);
  const id = readId(obj, 'id', path, issues);
  const entityKind = readEnum(
    obj,
    'entityKind',
    path,
    issues,
    ['content_pack', 'concept', 'relation', 'activity', 'rubric', 'source_ref'] as const,
  );
  const entityId = readId(obj, 'entityId', path, issues);
  const from = readEnum(obj, 'from', path, issues, REVIEW_STATES, { nullable: true });
  const to = readEnum(obj, 'to', path, issues, REVIEW_STATES);
  const actorKind = readEnum(obj, 'actorKind', path, issues, ACTOR_KINDS);
  const actorLabel = readString(obj, 'actorLabel', path, issues, { nullable: true });
  const checkedAt = readTimestamp(obj, 'checkedAt', path, issues);
  const scope = readString(obj, 'scope', path, issues, { minLength: 1 });
  const notes = readString(obj, 'notes', path, issues, { nullable: true });
  const evidenceRefs = readStringArray(obj, 'evidenceRefs', path, issues, {
    idItems: true,
    optional: true,
  });
  if (
    id === null ||
    entityKind === null ||
    entityId === null ||
    to === null ||
    actorKind === null ||
    checkedAt === null ||
    scope === null
  ) {
    return null;
  }
  if (to === 'curator_checked' && actorKind !== 'human_curator') {
    issues.add(
      'REVIEW_STATE_INVALID',
      `${path}.actorKind`,
      'curator_checked requires a human_curator actorKind; AI review must not claim human curation',
    );
    return null;
  }
  return {
    schemaVersion: 1,
    id,
    entityKind,
    entityId,
    from,
    to,
    actorKind,
    actorLabel,
    checkedAt,
    scope,
    notes,
    evidenceRefs: evidenceRefs ?? [],
  };
}

export const validateReviewLedgerEntry: (input: unknown) => ValidationResult<ReviewLedgerEntry> =
  validateWith(readReviewLedgerEntryAt);

/** Structural read only; cross entity invariants live in rules/pack-rules.ts. */
export function readContentPackAt(
  value: unknown,
  path: string,
  issues: IssueCollector,
): ContentPack | null {
  const obj = readObject(
    value,
    path,
    [
      'schemaVersion',
      'id',
      'version',
      'courseEditionId',
      'scope',
      'coverageStatus',
      'status',
      'contentHash',
      'toc',
      'concepts',
      'relations',
      'activities',
      'rubrics',
      'coverageManifest',
      'reviewLedger',
    ],
    issues,
  );
  if (obj === null) return null;
  readSchemaVersion(obj, path, issues);
  const id = readId(obj, 'id', path, issues);
  const version = readString(obj, 'version', path, issues, {
    pattern: VERSION_LABEL_PATTERN,
    patternMessage: 'pack version must be a bounded printable label',
  });
  const courseEditionId = readId(obj, 'courseEditionId', path, issues);
  const scope = readEnum(obj, 'scope', path, issues, PACK_SCOPES);
  const coverageStatus = readEnum(obj, 'coverageStatus', path, issues, PACK_COVERAGE_STATUSES);
  const status = readEnum(obj, 'status', path, issues, PACK_STATUSES);
  const contentHash = readSha256(obj, 'contentHash', path, issues);
  const toc = readArray(
    obj,
    'toc',
    path,
    issues,
    (item, at, collector) => {
      const node = readObject(
        item,
        at,
        ['schemaVersion', 'id', 'courseEditionId', 'parentId', 'type', 'title', 'order', 'sourceRefs'],
        collector,
      );
      if (node === null) return null;
      readSchemaVersion(node, at, collector);
      const nodeId = readId(node, 'id', at, collector);
      const edition = readId(node, 'courseEditionId', at, collector);
      const parentId = readId(node, 'parentId', at, collector, { nullable: true });
      const type = readEnum(node, 'type', at, collector, ['volume', 'unit', 'chapter', 'section'] as const);
      const title = readString(node, 'title', at, collector, { minLength: 1 });
      const order = readNumber(node, 'order', at, collector, { integer: true, min: 0 });
      const sourceRefs = readStringArray(node, 'sourceRefs', at, collector, { idItems: true });
      if (
        nodeId === null ||
        edition === null ||
        type === null ||
        title === null ||
        order === null ||
        sourceRefs === null
      ) {
        return null;
      }
      if (!checkSafeText(title, `${at}.title`, collector)) return null;
      return {
        schemaVersion: 1,
        id: nodeId,
        courseEditionId: edition,
        parentId,
        type,
        title,
        order,
        sourceRefs,
      } as TocNodeLike;
    },
    { minItems: 1 },
  );
  const concepts = readArray(obj, 'concepts', path, issues, readConceptAt, { minItems: 1 });
  const relations = readArray(obj, 'relations', path, issues, readRelationAt, { optional: true });
  const activities = readArray(obj, 'activities', path, issues, readActivityAt, { optional: true });
  const rubrics = readArray(obj, 'rubrics', path, issues, readRubricAt, { optional: true });
  const coverageManifest = readCoverageManifestAt(
    obj['coverageManifest'],
    `${path}.coverageManifest`,
    issues,
  );
  const reviewLedger = readArray(
    obj,
    'reviewLedger',
    path,
    issues,
    readReviewLedgerEntryAt,
    { optional: true },
  );
  if (
    id === null ||
    version === null ||
    courseEditionId === null ||
    scope === null ||
    coverageStatus === null ||
    status === null ||
    contentHash === null ||
    toc === null ||
    concepts === null ||
    coverageManifest === null
  ) {
    return null;
  }
  return {
    schemaVersion: 1,
    id,
    version,
    courseEditionId,
    scope,
    coverageStatus,
    status,
    contentHash,
    toc,
    concepts,
    relations: relations ?? [],
    activities: activities ?? [],
    rubrics: rubrics ?? [],
    coverageManifest,
    reviewLedger: reviewLedger ?? [],
  };
}

export const validateContentPackStructure: (input: unknown) => ValidationResult<ContentPack> =
  validateWith(readContentPackAt);


