import { describe, expect, it } from 'vitest';
import {
  checkRelations,
  checkTocTree,
  validateConcept,
  validateConceptProgress,
  validateEvidence,
  validateRelation,
  validateSelfReport,
  validateTocNode,
} from '@edu/domain';
import {
  buildScalePayload,
  createFixtureMapDataSource,
  type MapDataSource,
  type MapPayload,
} from '../src/index.js';
import { buildDemoPayload } from '../src/fixture.js';
import { makeRequest } from './helpers.js';

function validatePayload(payload: MapPayload): void {
  for (const node of payload.toc) {
    const result = validateTocNode(node);
    expect(result.ok, JSON.stringify(result.ok ? '' : result.issues)).toBe(true);
  }
  for (const concept of payload.concepts) {
    const result = validateConcept(concept);
    expect(result.ok, JSON.stringify(result.ok ? '' : result.issues)).toBe(true);
  }
  for (const relation of payload.relations) {
    const result = validateRelation(relation);
    expect(result.ok, JSON.stringify(result.ok ? '' : result.issues)).toBe(true);
  }
  for (const progress of payload.progress) {
    const result = validateConceptProgress(progress);
    expect(result.ok, JSON.stringify(result.ok ? '' : result.issues)).toBe(true);
  }
  for (const report of payload.selfReports) {
    const result = validateSelfReport(report);
    expect(result.ok, JSON.stringify(result.ok ? '' : result.issues)).toBe(true);
  }
  for (const evidence of payload.evidence) {
    const result = validateEvidence(evidence);
    expect(result.ok, JSON.stringify(result.ok ? '' : result.issues)).toBe(true);
  }
  const tree = checkTocTree(payload.toc, payload.courseEditionId);
  expect(tree.ok, JSON.stringify(tree.ok ? '' : tree.issues)).toBe(true);
  const conceptIds = new Set(payload.concepts.map((concept) => concept.id));
  const relations = checkRelations(payload.relations, conceptIds, payload.courseEditionId);
  expect(relations.ok, JSON.stringify(relations.ok ? '' : relations.issues)).toBe(true);
}

describe('fixture data source (演示数据)', () => {
  it('builds a demo payload whose toc/concepts/relations pass the frozen domain validators', () => {
    const payload = buildDemoPayload('demo');
    expect(payload.fixture).toBe(true);
    expect(payload.notice).toContain('演示数据（fixture）');
    expect(payload.toc.some((node) => node.type === 'unit')).toBe(true);
    validatePayload(payload);
  });

  it('keeps the multi-placement concept as one distinct concept', () => {
    const payload = buildDemoPayload('demo');
    const cell = payload.concepts.find((concept) => concept.id === 'concept.cell');
    expect(cell?.placements).toHaveLength(2);
    const placementCount = payload.concepts.reduce(
      (total, concept) => total + concept.placements.length,
      0,
    );
    expect(placementCount).toBeGreaterThan(payload.concepts.length);
  });

  it('provides candidate content with candidate trust mode and a notice', () => {
    const payload = buildDemoPayload('candidate');
    expect(payload.trustMode).toBe('candidate');
    expect(payload.notice).toContain('候选内容');
    validatePayload(payload);
  });

  it('builds the 500 concept / 1000 relation scale fixture', () => {
    const payload = buildScalePayload();
    expect(payload.concepts).toHaveLength(500);
    expect(payload.relations).toHaveLength(1000);
    expect(payload.toc.filter((node) => node.type === 'chapter')).toHaveLength(20);
    validatePayload(payload);
  });

  it('never exposes filesystem paths in source summaries', () => {
    const payload = buildDemoPayload('demo');
    expect(payload.sources.length).toBeGreaterThan(0);
    for (const source of payload.sources) {
      expect(source.label).not.toMatch(/[A-Za-z]:\\/);
      expect(source.label).not.toMatch(/\.pdf/i);
      expect(source.sourceRefId).toMatch(/^[A-Za-z0-9][A-Za-z0-9._:@-]*$/);
    }
  });

  it('bounds chapter graphs and lists cross-chapter concepts separately', async () => {
    const source: MapDataSource = createFixtureMapDataSource({ scenario: 'demo' });
    const payload = (await source.loadMap(makeRequest())) as { ok: true; data: MapPayload };
    expect(payload.ok).toBe(true);

    const chapter = await source.loadChapterGraph(makeRequest(), 'toc.ch1', {
      maxNodes: 24,
      maxDepth: 2,
    });
    expect(chapter.ok).toBe(true);
    if (!chapter.ok) return;
    expect(chapter.data.concepts.length).toBeLessThanOrEqual(24);
    expect(chapter.data.scopeTocNodeId).toBe('toc.ch1');
    expect(chapter.data.externalConcepts.length).toBeGreaterThan(0);
    expect(chapter.data.truncated).toBe(true);
    // relations only connect painted concepts
    const painted = new Set(chapter.data.concepts.map((concept) => concept.id));
    for (const relation of chapter.data.relations) {
      expect(painted.has(relation.fromConceptId)).toBe(true);
      expect(painted.has(relation.toConceptId)).toBe(true);
    }
  });

  it('expands a cross-chapter concept into a bounded neighborhood', async () => {
    const source = createFixtureMapDataSource({ scenario: 'demo' });
    const expanded = await source.expandConcept(makeRequest(), 'concept.ecosystem', {
      maxNodes: 25,
      maxDepth: 2,
    });
    expect(expanded.ok).toBe(true);
    if (!expanded.ok) return;
    expect(expanded.data.concepts.length).toBeLessThanOrEqual(25);
    expect(expanded.data.centerConceptId).toBe('concept.ecosystem');
    expect(expanded.data.concepts.some((concept) => concept.id === 'concept.ecosystem')).toBe(true);
  });

  it('caps scale chapter graphs below the full volume and reports hidden counts', async () => {
    const source = createFixtureMapDataSource({ scenario: 'scale' });
    const chapter = await source.loadChapterGraph(makeRequest(), 'toc.ch10', {
      maxNodes: 24,
      maxDepth: 2,
    });
    expect(chapter.ok).toBe(true);
    if (!chapter.ok) return;
    expect(chapter.data.concepts).toHaveLength(24);
    expect(chapter.data.hiddenConceptCount).toBe(1);
    expect(chapter.data.stats.durationMs).toBeGreaterThanOrEqual(0);
  });

  it('searches titles and aliases with a deterministic limit', async () => {
    const source = createFixtureMapDataSource({ scenario: 'demo' });
    const byAlias = await source.searchConcepts(makeRequest(), 'cell', 12);
    expect(byAlias.ok).toBe(true);
    if (byAlias.ok) {
      expect(byAlias.data[0]?.conceptId).toBe('concept.cell');
      expect(byAlias.data[0]?.matchedOn).toBe('alias');
    }
    const byChineseTitle = await source.searchConcepts(makeRequest(), '光合作用', 12);
    expect(byChineseTitle.ok).toBe(true);
    if (byChineseTitle.ok) {
      expect(byChineseTitle.data[0]?.conceptId).toBe('concept.photosynthesis');
      expect(byChineseTitle.data[0]?.tocNodeId).toBe('toc.ch2');
    }
    const empty = await source.searchConcepts(makeRequest(), '   ', 12);
    expect(empty.ok).toBe(true);
    if (empty.ok) expect(empty.data).toEqual([]);
  });
});
