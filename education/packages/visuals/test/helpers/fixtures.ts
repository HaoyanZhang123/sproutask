/**
 * Test fixtures: the frozen T01 content pack plus locally built activities for
 * cases the pack does not cover (choice answer keys, relation kinds).
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  validateActivity,
  validateDiagramSpec,
  validateRubric,
  type Activity,
  type AnswerSchema,
  type DiagramSpec,
  type Rubric,
  type RubricCriterion,
} from '@edu/domain';

import type { GradingAttempt } from '../../src/grading/types.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PACK_PATH = path.resolve(HERE, '..', '..', '..', 'domain', 'fixtures', 'packs', 'valid-partial.json');

interface PackLike {
  readonly activities: readonly unknown[];
  readonly rubrics: readonly unknown[];
  readonly concepts: readonly { readonly id: string }[];
  readonly relations: readonly {
    readonly fromConceptId: string;
    readonly toConceptId: string;
    readonly type: 'prerequisite' | 'related';
    readonly basis: string;
    readonly rationale: string;
    readonly sourceRefs: readonly string[];
    readonly reviewState: string;
  }[];
}

function loadPack(): PackLike {
  return JSON.parse(readFileSync(PACK_PATH, 'utf8')) as PackLike;
}

export function domainFixtureActivity(predicate: (activity: Activity) => boolean): Activity {
  const pack = loadPack();
  for (const raw of pack.activities) {
    const validated = validateActivity(raw);
    if (validated.ok && predicate(validated.value)) return validated.value;
  }
  throw new Error('fixture activity not found');
}

export function domainFixtureRubric(id: string): Rubric {
  const pack = loadPack();
  for (const raw of pack.rubrics) {
    const validated = validateRubric(raw);
    if (validated.ok && validated.value.id === id) return validated.value;
  }
  throw new Error(`fixture rubric not found: ${id}`);
}

export function domainFixtureDiagram(activity: Activity): DiagramSpec {
  if (activity.renderSpec === null) throw new Error('activity has no renderSpec');
  const validated = validateDiagramSpec(activity.renderSpec);
  if (!validated.ok) throw new Error('fixture diagram invalid');
  return validated.value;
}

/** Relations from the frozen pack, used to check relation kinds against content. */
export function domainFixtureRelations(): readonly {
  readonly fromConceptId: string;
  readonly toConceptId: string;
  readonly type: 'prerequisite' | 'related';
}[] {
  const pack = loadPack();
  return pack.relations.map((relation) => ({
    fromConceptId: relation.fromConceptId,
    toConceptId: relation.toConceptId,
    type: relation.type,
  }));
}

export function attemptFor(
  activity: Activity,
  overrides: Partial<GradingAttempt> = {},
): GradingAttempt {
  return {
    id: `attempt.${activity.id}`,
    activityId: activity.id,
    activityVersion: activity.version,
    answerText: null,
    answerAssetId: null,
    inputType: 'text',
    helpUsed: [],
    ...overrides,
  };
}

export function criterion(criterionId: string): RubricCriterion {
  return {
    criterionId,
    description: `criterion ${criterionId}`,
    acceptableEvidence: ['用自己的话说明观察需要有目的有计划'],
    commonMisconceptions: ['看见过就等于观察过'],
    counterExamples: [],
    transferItems: [],
    feedbackSourceRefs: [],
  };
}

export function makeActivity(overrides: {
  readonly id: string;
  readonly type: Activity['type'];
  readonly answerSchema: AnswerSchema;
  readonly rubricId?: string;
  readonly rubricVersion?: string;
  readonly conceptIds?: readonly string[];
  readonly renderSpec?: DiagramSpec | null;
  readonly stem?: string;
  readonly disclosure?: Activity['answerDisclosurePolicy'];
}): Activity {
  return {
    schemaVersion: 1,
    id: overrides.id,
    version: '1',
    courseEditionId: 'course.biology-7a',
    conceptIds: overrides.conceptIds ?? ['concept.cell'],
    type: overrides.type,
    stem: overrides.stem ?? `stem for ${overrides.id}`,
    sourceRefs: ['source.p18'],
    renderSpec: overrides.renderSpec ?? null,
    answerSchema: overrides.answerSchema,
    rubricId: overrides.rubricId ?? 'rubric.cell',
    rubricVersion: overrides.rubricVersion ?? '1',
    answerDisclosurePolicy: overrides.disclosure ?? 'after_independent_attempt',
  };
}

export function makeRubric(overrides: {
  readonly id: string;
  readonly version: string;
  readonly criteria: readonly RubricCriterion[];
  readonly conceptIds?: readonly string[];
}): Rubric {
  return {
    schemaVersion: 1,
    id: overrides.id,
    version: overrides.version,
    courseEditionId: 'course.biology-7a',
    conceptIds: overrides.conceptIds ?? ['concept.cell'],
    criteria: overrides.criteria,
    reviewState: 'machine_checked',
  };
}

/** A small cell diagram with two structure nodes and one region. */
export function cellDiagram(): DiagramSpec {
  return {
    schemaVersion: 1,
    nodes: [
      { id: 'node.cell', label: '细胞', kind: 'structure' },
      { id: 'node.nucleus', label: '细胞核', kind: 'structure' },
      { id: 'node.membrane', label: '细胞膜', kind: 'structure' },
    ],
    edges: [{ id: 'edge.contains', from: 'node.cell', to: 'node.nucleus', label: '包含', directed: true }],
    labels: [{ id: 'label.1', text: '请在图中标出细胞核', targetId: 'node.nucleus' }],
    regions: [
      {
        id: 'region.nucleus',
        assetId: 'asset.figure.cell',
        bbox: { x: 0.2, y: 0.2, width: 0.3, height: 0.3 },
        altText: '细胞核所在区域',
      },
    ],
    altText: '细胞结构示意图：细胞、细胞核与细胞膜',
    sourceRefs: ['source.p26'],
  };
}
