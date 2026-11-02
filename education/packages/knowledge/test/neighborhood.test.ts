import { describe, expect, it } from 'vitest';
import { DEFAULT_NEIGHBORHOOD_DEPTH, DEFAULT_NEIGHBORHOOD_NODES } from '../src/graph-index.js';
import { loadPack } from '../src/pack-loader.js';
import { KnowledgeService } from '../src/knowledge-service.js';
import { createSourceCatalog } from '../src/source-catalog.js';
import {
  buildLargePack,
  buildSourceCatalogFixture,
  buildStarPack,
  writeEvidence,
} from './helpers/fixtures.js';

function snapshotOf(input: unknown) {
  const loaded = loadPack(input);
  if (!loaded.ok) throw new Error(`pack invalid: ${JSON.stringify(loaded.issues)}`);
  return loaded.value;
}

function serviceWithPack(pack: unknown): KnowledgeService {
  const catalog = createSourceCatalog(buildSourceCatalogFixture());
  if (!catalog.ok) throw new Error('source catalogue invalid');
  const service = new KnowledgeService({ sources: catalog.value });
  const registered = service.registerPack(pack);
  if (!registered.ok) throw new Error(`pack invalid: ${JSON.stringify(registered.issues)}`);
  return service;
}

describe('bounded local neighborhood (500 concepts / 1000 relations)', () => {
  const large = buildLargePack();
  const snapshot = snapshotOf(large);
  const graph = snapshot.graph;

  it('loads the contract scale fixture with authored relations only', () => {
    expect(graph.conceptCount).toBe(500);
    expect(graph.relationCount).toBe(1000);
    expect(graph.prerequisiteCount + graph.relatedCount).toBe(1000);
    expect(graph.prerequisiteCount).toBe(499);
    expect(graph.relatedCount).toBe(501);
  });

  it('never exceeds the node cap and never returns dangling edges', () => {
    for (const maxNodes of [1, 5, 9, 25, 40, 200]) {
      const result = graph.neighborhood('concept.big0250', { maxDepth: 4, maxNodes });
      expect(result.ok).toBe(true);
      if (!result.ok) continue;
      expect(result.value.concepts.length).toBeLessThanOrEqual(maxNodes);
      expect(result.value.stats.maxNodeLimit).toBe(maxNodes);
      const included = new Set(result.value.concepts.map((concept) => concept.id));
      for (const relation of result.value.relations) {
        expect(included.has(relation.fromConceptId)).toBe(true);
        expect(included.has(relation.toConceptId)).toBe(true);
      }
    }
  });

  it('defaults to a chapter sized local graph', () => {
    const result = graph.neighborhood('concept.big0250');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.stats.maxDepthLimit).toBe(DEFAULT_NEIGHBORHOOD_DEPTH);
    expect(result.value.stats.maxNodeLimit).toBe(DEFAULT_NEIGHBORHOOD_NODES);
    expect(result.value.concepts.length).toBeLessThanOrEqual(DEFAULT_NEIGHBORHOOD_NODES);
    expect(result.value.concepts[0]?.id).toBe('concept.big0250');
  });

  it('truncates a dense hub at the cap', () => {
    const star = snapshotOf(buildStarPack(40));
    const hub = star.graph.neighborhood('concept.star.hub');
    expect(hub.ok).toBe(true);
    if (!hub.ok) return;
    expect(hub.value.concepts).toHaveLength(DEFAULT_NEIGHBORHOOD_NODES);
    expect(hub.value.truncated).toBe(true);
    expect(hub.value.relations).toHaveLength(DEFAULT_NEIGHBORHOOD_NODES - 1);
  });

  it('serves bounded chapter views through the service', () => {
    const service = serviceWithPack(large);
    const key = { courseEditionId: 'course.biology-large', packVersion: '1.0.0' };
    const chapter = service.chapterView({ ...key, chapterTocNodeId: 'toc.big.ch00' });
    expect(chapter.ok).toBe(true);
    if (chapter.ok) {
      expect(chapter.value.concepts).toHaveLength(25);
      expect(chapter.value.truncated).toBe(false);
    }
    const bounded = service.chapterView({
      ...key,
      chapterTocNodeId: 'toc.big.ch00',
      maxNodes: 10,
    });
    expect(bounded.ok).toBe(true);
    if (bounded.ok) {
      expect(bounded.value.concepts).toHaveLength(10);
      expect(bounded.value.truncated).toBe(true);
    }
    const section = service.chapterView({ ...key, chapterTocNodeId: 'toc.big.ch00.s1' });
    expect(section.ok).toBe(false);
    if (!section.ok) expect(section.error.code).toBe('INVALID_QUERY');
    const missing = service.chapterView({ ...key, chapterTocNodeId: 'toc.missing' });
    expect(missing.ok).toBe(false);
    if (!missing.ok) expect(missing.error.code).toBe('TOC_NODE_NOT_FOUND');
  });

  it('rejects invalid limits and unknown centres with explicit codes', () => {
    const unknown = graph.neighborhood('concept.missing');
    expect(unknown.ok).toBe(false);
    if (!unknown.ok) expect(unknown.error.code).toBe('CONCEPT_NOT_FOUND');

    const zeroNodes = graph.neighborhood('concept.big0250', { maxNodes: 0 });
    expect(zeroNodes.ok).toBe(false);
    if (!zeroNodes.ok) expect(zeroNodes.error.code).toBe('INVALID_QUERY');

    const hugeDepth = graph.neighborhood('concept.big0250', { maxDepth: 99 });
    expect(hugeDepth.ok).toBe(false);
    if (!hugeDepth.ok) expect(hugeDepth.error.code).toBe('INVALID_QUERY');

    const emptyTypes = graph.neighborhood('concept.big0250', { includeRelationTypes: [] });
    expect(emptyTypes.ok).toBe(false);
    if (!emptyTypes.ok) expect(emptyTypes.error.code).toBe('INVALID_QUERY');
  });

  it('records measured single query timings (no invented latency guarantee)', () => {
    const service = serviceWithPack(large);
    const key = { courseEditionId: 'course.biology-large', packVersion: '1.0.0' };
    const requests = [
      { maxDepth: 1, maxNodes: 10 },
      { maxDepth: 2, maxNodes: 25 },
      { maxDepth: 3, maxNodes: 50 },
      { maxDepth: 4, maxNodes: 200 },
    ];
    const measurements = requests.map((options) => {
      const wallStarted = performance.now();
      const result = graph.neighborhood('concept.big0250', options);
      const wallDurationMs = performance.now() - wallStarted;
      if (!result.ok) throw new Error(`neighborhood failed: ${result.error.code}`);
      return {
        options,
        concepts: result.value.concepts.length,
        relations: result.value.relations.length,
        truncated: result.value.truncated,
        maxDepthReached: result.value.stats.maxDepthReached,
        reportedDurationMs: result.value.stats.durationMs,
        wallDurationMs: Math.round(wallDurationMs * 1000) / 1000,
      };
    });
    const chapterStarted = performance.now();
    const chapterView = service.chapterView({ ...key, chapterTocNodeId: 'toc.big.ch00' });
    const chapterWallMs = performance.now() - chapterStarted;
    expect(chapterView.ok).toBe(true);

    const star = snapshotOf(buildStarPack(40));
    const denseHub = [25, 50, 200].map((cap) => {
      const hubStarted = performance.now();
      const hub = star.graph.neighborhood('concept.star.hub', { maxDepth: 1, maxNodes: cap });
      const hubWallMs = performance.now() - hubStarted;
      if (!hub.ok) throw new Error(`hub neighborhood failed: ${hub.error.code}`);
      return {
        maxNodes: cap,
        concepts: hub.value.concepts.length,
        relations: hub.value.relations.length,
        truncated: hub.value.truncated,
        reportedDurationMs: hub.value.stats.durationMs,
        wallDurationMs: Math.round(hubWallMs * 1000) / 1000,
      };
    });

    const evidencePath = writeEvidence('neighborhood-bench.json', {
      schemaVersion: 1,
      task: 'T04',
      fixture: {
        pack: 'pack.biology-large',
        version: '1.0.0',
        concepts: graph.conceptCount,
        relations: graph.relationCount,
      },
      machine: {
        node: process.version,
        platform: process.platform,
        arch: process.arch,
        note: 'single local Windows dev machine; measured in this run, not a latency guarantee',
      },
      measurements,
      chapterView: {
        chapterTocNodeId: 'toc.big.ch00',
        concepts: chapterView.ok ? chapterView.value.concepts.length : -1,
        wallDurationMs: Math.round(chapterWallMs * 1000) / 1000,
        reportedDurationMs: chapterView.ok ? chapterView.value.stats.durationMs : -1,
      },
      denseHub: {
        fixture: 'pack.biology-star (hub + 40 related leaves)',
        measurements: denseHub,
      },
    });
    console.log(
      `[T04] 500/1000 neighborhood measured: ${measurements
        .map(
          (entry) =>
            `depth${entry.options.maxDepth}/cap${entry.options.maxNodes} -> ${entry.concepts} concepts, ${entry.reportedDurationMs}ms`,
        )
        .join(' | ')} | chapter -> ${chapterView.ok ? chapterView.value.concepts.length : -1} concepts, ${Math.round(chapterWallMs * 1000) / 1000}ms | dense hub -> ${denseHub
        .map((entry) => `cap${entry.maxNodes}:${entry.concepts}/${entry.truncated ? 'truncated' : 'full'}`)
        .join(', ')} | evidence ${evidencePath}`,
    );
    for (const entry of measurements) {
      expect(entry.concepts).toBeLessThanOrEqual(entry.options.maxNodes);
      expect(entry.reportedDurationMs).toBeGreaterThanOrEqual(0);
    }
    for (const entry of denseHub) {
      expect(entry.concepts).toBeLessThanOrEqual(entry.maxNodes);
    }
  });
});

describe('concept search by title and alias', () => {
  const graph = snapshotOf(buildLargePack()).graph;

  it('matches titles and aliases case insensitively', () => {
    const exact = graph.search('合成概念 12');
    expect(exact[0]?.conceptId).toBe('concept.big0012');
    expect(exact[0]?.matchedOn).toBe('title');
    const alias = graph.search('ALIAS-12');
    expect(alias[0]?.conceptId).toBe('concept.big0012');
    expect(alias[0]?.matchedOn).toBe('alias');
    const chineseAlias = graph.search('别名120');
    expect(chineseAlias[0]?.conceptId).toBe('concept.big0120');
    expect(chineseAlias[0]?.matchedOn).toBe('alias');
  });

  it('returns an empty list for blank queries and honours the limit', () => {
    expect(graph.search('')).toEqual([]);
    expect(graph.search('   ')).toEqual([]);
    expect(graph.search('alias', { limit: 7 })).toHaveLength(7);
    expect(graph.search('no-such-concept')).toEqual([]);
    expect(graph.search('alias', { limit: 500 })).toHaveLength(100);
  });

  it('ranks exact title above alias and prefix above substring', () => {
    const hits = graph.search('别名1', { limit: 5 });
    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0]?.score).toBeGreaterThanOrEqual(hits[hits.length - 1]?.score ?? 0);
  });
});
