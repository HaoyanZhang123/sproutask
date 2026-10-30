import { describe, expect, it } from 'vitest';
import type { CompatibilityMap, Concept, ContentPack, CoverageSection } from '@edu/domain';
import { auditCompatibilityMap, diffPacks } from '../src/compatibility.js';
import { computeContentHash } from '../src/content-hash.js';
import { clone, readFixtureJson, readPackFixture } from './helpers/fixtures.js';

interface MutablePack {
  concepts: Concept[];
  coverageManifest: { sections: CoverageSection[]; totals: { conceptCount: number } };
}

const from = readPackFixture('valid-partial.json');

function nextVersion(mutate?: (pack: MutablePack) => void): ContentPack {
  const next = clone(from);
  (next as { version: string }).version = '1.1.0';
  if (mutate !== undefined) mutate(next as unknown as MutablePack);
  return { ...next, contentHash: computeContentHash(next) };
}

function withAddedConcept(pack: MutablePack): void {
  const concepts = pack.concepts.map((concept) => ({ ...concept }));
  concepts.push({
    schemaVersion: 1,
    id: 'concept.new',
    courseEditionId: 'course.biology-7a',
    title: '新增概念',
    aliases: [],
    placements: ['toc.ch1.s2'],
    learningObjectives: ['新增概念目标'],
    explanation: '合成新增概念',
    misconceptions: [],
    sourceRefs: ['source.p19'],
    rubricIds: [],
    activityIds: [],
    reviewState: 'published',
  });
  const sections = pack.coverageManifest.sections.map((section) => ({
    ...section,
    conceptIds: [...section.conceptIds],
  }));
  const target = sections.find((section) => section.tocNodeId === 'toc.ch1.s2');
  if (target !== undefined) target.conceptIds.push('concept.new');
  pack.concepts = concepts;
  pack.coverageManifest.sections = sections;
  pack.coverageManifest.totals.conceptCount = concepts.length;
}

function withoutDivision(pack: MutablePack): void {
  pack.concepts = pack.concepts.filter((concept) => concept.id !== 'concept.cell-division');
  pack.coverageManifest.sections = pack.coverageManifest.sections.map((section) => ({
    ...section,
    conceptIds: section.conceptIds.filter((conceptId) => conceptId !== 'concept.cell-division'),
  }));
  pack.coverageManifest.totals.conceptCount = 2;
}

function mapWith(
  to: ContentPack,
  source: { readonly map: CompatibilityMap },
  overrides: Partial<CompatibilityMap> = {},
): CompatibilityMap {
  return {
    ...source.map,
    courseEditionId: to.courseEditionId,
    fromPackVersion: from.version,
    toPackVersion: to.version,
    fromContentHash: from.contentHash,
    toContentHash: to.contentHash,
    ...overrides,
  };
}

describe('content diff and compatibility audit (05 §9)', () => {
  it('differs two versions by concept, rubric, source and toc changes', () => {
    const added = nextVersion(withAddedConcept);
    const addDiff = diffPacks(from, added);
    expect(addDiff.versionsDiffer).toBe(true);
    expect(addDiff.hashChanged).toBe(true);
    expect(addDiff.addedConcepts).toEqual(['concept.new']);
    expect(addDiff.removedConcepts).toEqual([]);

    const removed = nextVersion(withoutDivision);
    const removeDiff = diffPacks(from, removed);
    expect(removeDiff.removedConcepts).toEqual(['concept.cell-division']);
    expect(removeDiff.addedConcepts).toEqual([]);

    const changed = nextVersion((pack) => {
      const concepts = pack.concepts.map((concept) => ({
        ...concept,
        rubricIds: [...concept.rubricIds],
        sourceRefs: [...concept.sourceRefs],
      }));
      const target = concepts.find((concept) => concept.id === 'concept.cell');
      if (target !== undefined) target.rubricIds = [];
      pack.concepts = concepts;
    });
    const changeDiff = diffPacks(from, changed);
    expect(changeDiff.changedRubrics).toEqual(['concept.cell']);
  });

  it('rejects a map whose hashes do not match the actual packs', () => {
    const to = nextVersion(withAddedConcept);
    const fixture = readFixtureJson<{ map: CompatibilityMap }>('compatibility/rename-verified.json');
    const audit = auditCompatibilityMap(fixture.map, from, to);
    expect(audit.ok).toBe(true);
    if (!audit.ok) return;
    expect(audit.value.ok).toBe(false);
    expect(audit.value.issues.map((issue) => issue.code)).toContain('COMPATIBILITY_HASH_MISMATCH');
  });

  it('rejects a map that does not cover the content diff', () => {
    const to = nextVersion(withAddedConcept);
    const fixture = readFixtureJson<{ map: CompatibilityMap }>('compatibility/rename-verified.json');
    const audit = auditCompatibilityMap(mapWith(to, fixture), from, to);
    expect(audit.ok).toBe(true);
    if (!audit.ok) return;
    expect(audit.value.ok).toBe(false);
    expect(audit.value.issues.map((issue) => issue.code)).toContain('COMPATIBILITY_DIFF_UNCOVERED');
  });

  it('accepts a reviewed map that covers every diff item without copying strong states', () => {
    const to = nextVersion(withAddedConcept);
    const fixture = readFixtureJson<{ map: CompatibilityMap }>('compatibility/rename-verified.json');
    const map = mapWith(to, fixture, {
      mappings: [
        ...fixture.map.mappings,
        {
          fromConceptId: null,
          toConceptIds: ['concept.new'],
          kind: 'added',
          rationale: 'new concept added in 1.1.0',
          review: {
            verified: true,
            actorKind: 'human_curator',
            checkedAt: '2026-10-02T09:00:00Z',
            notes: 'reviewed addition',
          },
          evidenceEffect: 'reset',
        },
      ],
    });
    const audit = auditCompatibilityMap(map, from, to);
    expect(audit.ok, JSON.stringify(audit.ok ? '' : audit.issues)).toBe(true);
    if (!audit.ok) return;
    expect(audit.value.uncoveredDiffItems).toEqual([]);
    expect(audit.value.strongStateCopies).toEqual([]);
    for (const projection of audit.value.projections) {
      expect(projection.understandingState).toBe('unassessed');
    }
    // verified unchanged + inherit may carry learning history with a marker
    expect(audit.value.inheritedConcepts).toEqual(['concept.cell']);
  });

  it('never migrates old evidence just because the concept id is unchanged', () => {
    const to = nextVersion();
    const fixture = readFixtureJson<{ map: CompatibilityMap }>(
      'compatibility/rename-unverified.json',
    );
    const audit = auditCompatibilityMap(mapWith(to, fixture), from, to);
    expect(audit.ok).toBe(true);
    if (!audit.ok) return;
    expect(audit.value.inheritedConcepts).toEqual([]);
    expect(audit.value.projections[0]?.carryLearningHistory).toBe(false);
    expect(audit.value.projections[0]?.understandingState).toBe('unassessed');
    expect(audit.value.projections[0]?.reason).toBe('compatibility_unverified');
  });

  it('keeps understanding unassessed even for a verified inherit mapping', () => {
    const to = nextVersion();
    const fixture = readFixtureJson<{ map: CompatibilityMap }>('compatibility/rename-verified.json');
    const audit = auditCompatibilityMap(mapWith(to, fixture), from, to);
    expect(audit.ok).toBe(true);
    if (!audit.ok) return;
    expect(audit.value.inheritedConcepts).toEqual(['concept.cell']);
    expect(audit.value.strongStateCopies).toEqual([]);
    for (const projection of audit.value.projections) {
      expect(projection.understandingState).toBe('unassessed');
    }
  });

  it('rejects a map that connects the wrong pack versions', () => {
    const to = nextVersion();
    const fixture = readFixtureJson<{ map: CompatibilityMap }>('compatibility/rename-verified.json');
    const audit = auditCompatibilityMap(mapWith(to, fixture, { toPackVersion: '9.9.9' }), from, to);
    expect(audit.ok).toBe(true);
    if (!audit.ok) return;
    expect(audit.value.ok).toBe(false);
    expect(audit.value.issues.map((issue) => issue.code)).toContain('COMPATIBILITY_INVALID');
  });
});
