import { describe, expect, it } from 'vitest';
import { validateContentPack } from '@edu/domain';
import { buildKnowledgeGraph, type KnowledgeGraph } from '../src/graph-index.js';
import { clone, readPackFixture } from './helpers/fixtures.js';

function graphOf(name: string): KnowledgeGraph {
  const built = buildKnowledgeGraph(readPackFixture(name));
  if (!built.ok) throw new Error(`graph invalid: ${JSON.stringify(built.issues)}`);
  return built.value;
}

function issueCodesOf(name: string): readonly string[] {
  const built = buildKnowledgeGraph(readPackFixture(name));
  expect(built.ok).toBe(false);
  return built.ok ? [] : built.issues.map((issue) => issue.code);
}

describe('concept graph (A11)', () => {
  const graph = graphOf('valid-partial.json');

  it('indexes prerequisite and related edges separately', () => {
    expect(graph.conceptCount).toBe(3);
    expect(graph.relationCount).toBe(3);
    expect(graph.prerequisiteCount).toBe(2);
    expect(graph.relatedCount).toBe(1);
    expect(graph.successors('concept.cell')).toEqual(['concept.cell-structure']);
    expect(graph.predecessors('concept.cell-division')).toEqual(['concept.cell-structure']);
    expect(graph.relatedTo('concept.cell-division')).toEqual(['concept.cell']);
    expect(graph.relationsOf('concept.cell')).toHaveLength(2);
  });

  it('produces a deterministic topological order for the prerequisite DAG', () => {
    expect(graph.prerequisiteTopologicalOrder()).toEqual([
      'concept.cell',
      'concept.cell-structure',
      'concept.cell-division',
    ]);
  });

  it('rejects a self loop, a prerequisite cycle, dangling refs and duplicate ids', () => {
    expect(issueCodesOf('invalid-self-loop.json')).toContain('RELATION_SELF_LOOP');
    expect(issueCodesOf('invalid-prereq-cycle.json')).toContain('RELATION_CYCLE');
    expect(issueCodesOf('invalid-dangling-placement.json')).toContain('DANGLING_REFERENCE');
    expect(issueCodesOf('invalid-duplicate-id.json')).toContain('DUPLICATE_ID');
    expect(issueCodesOf('invalid-related-order.json')).toContain('RELATION_ENDPOINT_ORDER');
  });

  it('allows related edges to form a cycle (only prerequisites must be a DAG)', () => {
    const pack = clone(readPackFixture('valid-partial.json'));
    const relations = [...pack.relations];
    relations.push(
      {
        schemaVersion: 1,
        id: 'relation.related.cell-structure',
        courseEditionId: pack.courseEditionId,
        fromConceptId: 'concept.cell',
        toConceptId: 'concept.cell-structure',
        type: 'related',
        basis: 'pedagogical_inference',
        rationale: 'related cycle fixture edge',
        sourceRefs: [],
        reviewState: 'published',
      },
      {
        schemaVersion: 1,
        id: 'relation.related.cycle-close',
        courseEditionId: pack.courseEditionId,
        fromConceptId: 'concept.cell-division',
        toConceptId: 'concept.cell-structure',
        type: 'related',
        basis: 'pedagogical_inference',
        rationale: 'closes the related cycle',
        sourceRefs: [],
        reviewState: 'published',
      },
    );
    const candidate = { ...pack, relations } as typeof pack;
    const validation = validateContentPack(candidate);
    expect(validation.ok, JSON.stringify(validation.ok ? '' : validation.issues)).toBe(true);
    const built = buildKnowledgeGraph(candidate);
    expect(built.ok).toBe(true);
    if (built.ok) {
      expect(built.value.relatedTo('concept.cell-structure')).toEqual([
        'concept.cell',
        'concept.cell-division',
      ]);
    }
  });

  it('requires a prerequisite to carry a basis and a rationale', () => {
    const pack = clone(readPackFixture('valid-partial.json'));
    const broken = clone(pack) as unknown as Record<string, unknown>;
    const relations = (broken['relations'] as Record<string, unknown>[]).map((relation) => ({
      ...relation,
    }));
    const first = relations[0] as Record<string, unknown>;
    first['rationale'] = '   ';
    broken['relations'] = relations;
    const validation = validateContentPack(broken);
    expect(validation.ok).toBe(false);
    if (!validation.ok) {
      expect(validation.issues.map((issue) => issue.code)).toContain('INVALID_FORMAT');
    }

    const missingBasis = clone(readPackFixture('valid-partial.json')) as unknown as Record<string, unknown>;
    const relationList = (missingBasis['relations'] as Record<string, unknown>[]).map((relation) => ({
      ...relation,
    }));
    delete (relationList[0] as Record<string, unknown>)['basis'];
    missingBasis['relations'] = relationList;
    const basisValidation = validateContentPack(missingBasis);
    expect(basisValidation.ok).toBe(false);
    if (!basisValidation.ok) {
      expect(basisValidation.issues.map((issue) => issue.code)).toContain('MISSING_FIELD');
    }
  });

  it('rejects prerequisite edges across course editions or pack versions', () => {
    const otherEdition = clone(readPackFixture('valid-partial.json')) as unknown as Record<string, unknown>;
    const relations = (otherEdition['relations'] as Record<string, unknown>[]).map((relation) => ({
      ...relation,
    }));
    (relations[0] as Record<string, unknown>)['courseEditionId'] = 'course.biology-other';
    otherEdition['relations'] = relations;
    const validation = validateContentPack(otherEdition);
    expect(validation.ok).toBe(false);
    if (!validation.ok) expect(validation.issues.map((issue) => issue.code)).toContain('INVALID_REFERENCE');

    const crossVersion = clone(readPackFixture('valid-partial.json')) as unknown as Record<string, unknown>;
    const crossRelations = (crossVersion['relations'] as Record<string, unknown>[]).map((relation) => ({
      ...relation,
    }));
    (crossRelations[0] as Record<string, unknown>)['toConceptId'] = 'concept.other-version';
    crossVersion['relations'] = crossRelations;
    const crossValidation = validateContentPack(crossVersion);
    expect(crossValidation.ok).toBe(false);
    if (!crossValidation.ok) {
      expect(crossValidation.issues.map((issue) => issue.code)).toContain('DANGLING_REFERENCE');
    }
  });

  it('never derives prerequisite edges from TOC order', () => {
    // A pack can have a strict table of contents and no relations at all: the
    // graph then contains zero prerequisite edges, and a chapter local graph
    // stays disconnected. Bulk-generating edges from TOC order is refused
    // because those edges would have no basis (source evidence or rationale).
    const pack = clone(readPackFixture('valid-partial.json')) as unknown as Record<string, unknown>;
    pack['relations'] = [];
    const validation = validateContentPack(pack);
    expect(validation.ok).toBe(true);
    const built = buildKnowledgeGraph(pack as never);
    expect(built.ok).toBe(true);
    if (!built.ok) return;
    expect(built.value.prerequisiteCount).toBe(0);
    expect(built.value.successors('concept.cell')).toEqual([]);
    const neighborhood = built.value.neighborhood('concept.cell');
    expect(neighborhood.ok).toBe(true);
    if (neighborhood.ok) expect(neighborhood.value.concepts.map((concept) => concept.id)).toEqual(['concept.cell']);

    // Counter example: edges "generated from section order" with no source
    // evidence at all are structurally rejected (no basis).
    const autoGenerated = clone(readPackFixture('valid-partial.json')) as unknown as Record<string, unknown>;
    autoGenerated['relations'] = [
      {
        schemaVersion: 1,
        id: 'relation.auto.toc-order',
        courseEditionId: 'course.biology-7a',
        fromConceptId: 'concept.cell',
        toConceptId: 'concept.cell-division',
        type: 'prerequisite',
        basis: 'explicit_source',
        rationale: 'derived from toc order only',
        sourceRefs: [],
        reviewState: 'published',
      },
    ];
    const autoValidation = validateContentPack(autoGenerated);
    expect(autoValidation.ok).toBe(false);
    if (!autoValidation.ok) {
      expect(autoValidation.issues.map((issue) => issue.code)).toContain('RELATION_SOURCE_REQUIRED');
    }
  });
});
