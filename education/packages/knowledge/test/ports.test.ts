import { describe, expect, it } from 'vitest';
import type {
  CompatibilityMap,
  ContentQuery,
  KnowledgePort,
  RequestContext,
} from '@edu/domain';
import { KnowledgeService } from '../src/knowledge-service.js';
import { createSourceCatalog } from '../src/source-catalog.js';
import {
  buildSupportedProgress,
  buildSourceCatalogFixture,
  clone,
  readFixtureJson,
  readPackFixture,
} from './helpers/fixtures.js';
import { computeContentHash } from '../src/content-hash.js';
import { progressLookup } from '../src/progress-projection.js';

const ctx: RequestContext = {
  requestId: 'request.query',
  learnerId: 'learner.local',
  now: '2026-10-29T09:00:00Z',
};

function buildService(): { service: KnowledgeService; key: { courseEditionId: string; packVersion: string } } {
  const catalog = createSourceCatalog(buildSourceCatalogFixture());
  if (!catalog.ok) throw new Error('catalogue invalid');
  const service = new KnowledgeService({ sources: catalog.value });
  const registered = service.registerPack(readPackFixture('valid-partial.json'));
  if (!registered.ok) throw new Error(`pack invalid: ${JSON.stringify(registered.issues)}`);
  return {
    service,
    key: { courseEditionId: 'course.biology-7a', packVersion: '1.0.0' },
  };
}

describe('knowledge service implements the frozen ports', () => {
  it('satisfies ContentQuery and KnowledgePort', async () => {
    const { service, key } = buildService();
    const contentQuery: ContentQuery = service;
    const knowledgePort: KnowledgePort = service;

    const summary = await contentQuery.getPackSummary(ctx, key);
    expect(summary.ok).toBe(true);
    if (summary.ok) {
      expect(summary.data.trustMode).toBe('published');
      expect(summary.data.coverageStatus).toBe('partial');
      expect(summary.revision).toBe(1);
    }

    const toc = await contentQuery.getToc(ctx, key);
    expect(toc.ok).toBe(true);
    if (toc.ok) expect(toc.data.nodes).toHaveLength(6);

    const subtree = await contentQuery.getToc(ctx, {
      ...key,
      rootTocNodeId: 'toc.ch1',
      maxDepth: 1,
    });
    expect(subtree.ok).toBe(true);
    if (subtree.ok) expect(subtree.data.nodes.map((node) => node.id)).toEqual([
      'toc.ch1',
      'toc.ch1.s1',
      'toc.ch1.s2',
    ]);

    const unknownRoot = await contentQuery.getToc(ctx, { ...key, rootTocNodeId: 'toc.missing' });
    expect(unknownRoot.ok).toBe(false);
    if (!unknownRoot.ok) {
      expect(unknownRoot.error.code).toBe('NOT_FOUND');
      expect(unknownRoot.error.retryable).toBe(false);
    }

    const concept = await contentQuery.getConcept(ctx, { ...key, conceptId: 'concept.cell' });
    expect(concept.ok).toBe(true);
    if (concept.ok) {
      expect(concept.data.concept.id).toBe('concept.cell');
      expect(concept.data.relations).toHaveLength(2);
    }

    const neighborhood = await contentQuery.getNeighborhood(ctx, {
      ...key,
      conceptId: 'concept.cell',
      maxDepth: 2,
      maxNodes: 5,
    });
    expect(neighborhood.ok).toBe(true);
    if (neighborhood.ok) {
      expect(neighborhood.data.concepts.length).toBeLessThanOrEqual(5);
      expect(neighborhood.data.centerConceptId).toBe('concept.cell');
    }

    const source = await contentQuery.resolveSource(ctx, 'source.p18');
    expect(source.ok).toBe(true);
    if (source.ok) {
      expect(source.data.pdfPage).toBe(18);
      expect(source.data.bookInstance?.id).toBe('book.fixture');
    }
    const missingSource = await contentQuery.resolveSource(ctx, 'source.missing');
    expect(missingSource.ok).toBe(false);
    if (!missingSource.ok) expect(missingSource.error.code).toBe('NOT_FOUND');

    const pack = await knowledgePort.getPack(ctx, key);
    expect(pack.ok).toBe(true);
    if (pack.ok) expect(pack.data.concepts).toHaveLength(3);

    const coverage = await knowledgePort.checkCoverage(ctx, key);
    expect(coverage.ok).toBe(true);
    if (coverage.ok) {
      expect(coverage.data.targetSections).toBe(3);
      expect(coverage.data.coveredSections).toBe(1);
      expect(coverage.data.conceptCount).toBe(3);
      expect(coverage.data.unresolved).toEqual([]);
    }

    const missingPack = await knowledgePort.getPack(ctx, {
      courseEditionId: 'course.biology-7a',
      packVersion: '9.9.9',
    });
    expect(missingPack.ok).toBe(false);
    if (!missingPack.ok) expect(missingPack.error.code).toBe('NOT_FOUND');
  });

  it('reports candidate packs with candidate trust mode', async () => {
    const catalog = createSourceCatalog(buildSourceCatalogFixture());
    if (!catalog.ok) throw new Error('catalogue invalid');
    const service = new KnowledgeService({ sources: catalog.value });
    const registered = service.registerPack(readPackFixture('valid-candidate.json'));
    expect(registered.ok).toBe(true);
    const summary = await service.getPackSummary(ctx, {
      courseEditionId: 'course.biology-7a',
      packVersion: '0.9.0-candidate',
    });
    expect(summary.ok).toBe(true);
    if (summary.ok) expect(summary.data.trustMode).toBe('candidate');
  });

  it('refuses rejected content for teaching reads', async () => {
    const catalog = createSourceCatalog(buildSourceCatalogFixture());
    if (!catalog.ok) throw new Error('catalogue invalid');
    const service = new KnowledgeService({ sources: catalog.value });
    const rejected = clone(readPackFixture('valid-partial.json'));
    (rejected as { status: string }).status = 'rejected';
    (rejected as { version: string }).version = '2.0.0';
    const registered = service.registerPack({ ...rejected, contentHash: computeContentHash(rejected) });
    expect(registered.ok).toBe(true);
    const read = await service.getConcept(ctx, {
      courseEditionId: 'course.biology-7a',
      packVersion: '2.0.0',
      conceptId: 'concept.cell',
    });
    expect(read.ok).toBe(false);
    if (!read.ok) {
      expect(read.error.code).toBe('CONTRACT_REJECTED');
      expect(read.error.message).toContain('rejected');
    }
  });

  it('returns an audited compatibility map through the port', async () => {
    const catalog = createSourceCatalog(buildSourceCatalogFixture());
    if (!catalog.ok) throw new Error('catalogue invalid');
    const from = readPackFixture('valid-partial.json');
    const to = clone(from);
    (to as { version: string }).version = '1.1.0';
    const nextPack = { ...to, contentHash: computeContentHash(to) };
    const fixture = readFixtureJson<{ map: CompatibilityMap }>('compatibility/rename-verified.json');
    const map: CompatibilityMap = {
      ...fixture.map,
      fromContentHash: from.contentHash,
      toContentHash: nextPack.contentHash,
    };
    const service = new KnowledgeService({ sources: catalog.value, compatibilityMaps: [map] });
    expect(service.registerPack(from).ok).toBe(true);
    expect(service.registerPack(nextPack).ok).toBe(true);

    const found = await service.getCompatibilityMap(ctx, {
      courseEditionId: 'course.biology-7a',
      packVersion: '1.1.0',
      fromPackVersion: '1.0.0',
    });
    expect(found.ok).toBe(true);
    if (found.ok) expect(found.data.id).toBe(map.id);

    const missing = await service.getCompatibilityMap(ctx, {
      courseEditionId: 'course.biology-7a',
      packVersion: '3.0.0',
      fromPackVersion: '1.0.0',
    });
    expect(missing.ok).toBe(false);
    if (!missing.ok) expect(missing.error.code).toBe('NOT_FOUND');
  });

  it('offers T04 additions: search, page images and state projection', () => {
    const { service, key } = buildService();
    const hits = service.searchConcepts('细胞');
    expect(hits[0]?.conceptId).toBe('concept.cell');

    const image = service.resolvePageImage('source.p18');
    expect(image.ok).toBe(true);
    if (image.ok) expect(image.value.coordinateSpace).toBe('normalized_page');

    const progress = buildSupportedProgress();
    const published = service.projectStates(
      key,
      ['concept.cell', 'concept.cell-structure'],
      progressLookup([progress]),
      'published',
    );
    expect(published.ok).toBe(true);
    if (published.ok) expect(published.value).toHaveLength(2);

    const candidate = service.projectStates(
      key,
      ['concept.cell'],
      progressLookup([progress]),
      'candidate',
    );
    expect(candidate.ok).toBe(true);
    if (candidate.ok) expect(candidate.value[0]?.understanding.state).toBe('unassessed');

    const unknownConcept = service.projectStates(
      key,
      ['concept.missing'],
      progressLookup([]),
      'published',
    );
    expect(unknownConcept.ok).toBe(false);
    if (!unknownConcept.ok) expect(unknownConcept.error.code).toBe('CONCEPT_NOT_FOUND');
  });
});
