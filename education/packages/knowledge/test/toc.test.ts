import { describe, expect, it } from 'vitest';
import { buildTocIndex, type TocIndex } from '../src/toc-index.js';
import { readPackFixture } from './helpers/fixtures.js';

function indexOf(name: string): TocIndex {
  const built = buildTocIndex(readPackFixture(name));
  if (!built.ok) throw new Error(`toc invalid: ${JSON.stringify(built.issues)}`);
  return built.value;
}

describe('TOC index (A11)', () => {
  const toc = indexOf('valid-partial.json');

  it('exposes exactly one volume root and ordered children', () => {
    expect(toc.root()?.id).toBe('toc.volume');
    expect(toc.roots.map((node) => node.id)).toEqual(['toc.volume']);
    expect(toc.childrenOf('toc.volume').map((node) => node.id)).toEqual(['toc.ch1', 'toc.ch2']);
    expect(toc.childrenOf('toc.ch1').map((node) => node.order)).toEqual([0, 1]);
  });

  it('resolves parent, path and depth', () => {
    expect(toc.parentOf('toc.ch1.s2')?.id).toBe('toc.ch1');
    expect(toc.parentOf('toc.volume')).toBeNull();
    expect(toc.pathTo('toc.ch1.s2').map((node) => node.id)).toEqual([
      'toc.volume',
      'toc.ch1',
      'toc.ch1.s2',
    ]);
    expect(toc.depthOf('toc.ch1.s2')).toBe(2);
  });

  it('bounds subtree depth', () => {
    expect(toc.subtreeOf('toc.ch1').map((node) => node.id)).toEqual([
      'toc.ch1',
      'toc.ch1.s1',
      'toc.ch1.s2',
    ]);
    expect(toc.subtreeOf('toc.ch1', { maxDepth: 0 }).map((node) => node.id)).toEqual(['toc.ch1']);
    expect(toc.subtreeOf('toc.volume', { maxDepth: 1 }).map((node) => node.id)).toEqual([
      'toc.volume',
      'toc.ch1',
      'toc.ch2',
    ]);
  });

  it('counts a concept placed in several sections exactly once', () => {
    expect(toc.placementsOf('concept.cell').map((node) => node.id)).toEqual([
      'toc.ch1.s1',
      'toc.ch2.s1',
    ]);
    // chapter 1 has two sections; concept.cell is placed in one of them and
    // concept.cell-division in the other, so two distinct concepts, not three.
    expect(toc.conceptIdsIn('toc.ch1')).toEqual(['concept.cell', 'concept.cell-division']);
    expect(toc.conceptIdsIn('toc.volume')).toEqual([
      'concept.cell',
      'concept.cell-division',
      'concept.cell-structure',
    ]);
    expect(toc.conceptCountIn('toc.volume')).toBe(3);
    expect(toc.conceptIdsIn('toc.ch1', { includeDescendants: false })).toEqual([]);
    expect(toc.conceptsInChapter('toc.ch2.s1')).toEqual([
      'concept.cell',
      'concept.cell-structure',
    ]);
  });

  it('returns undefined/null for unknown ids instead of throwing', () => {
    expect(toc.node('toc.missing')).toBeUndefined();
    expect(toc.childrenOf('toc.missing')).toEqual([]);
    expect(toc.parentOf('toc.missing')).toBeNull();
    expect(toc.pathTo('toc.missing')).toEqual([]);
    expect(toc.depthOf('toc.missing')).toBeUndefined();
    expect(toc.placementsOf('concept.missing')).toEqual([]);
  });

  it('rejects a toc cycle and a toc orphan with explicit issue codes', () => {
    const cycle = buildTocIndex(readPackFixture('invalid-toc-cycle.json'));
    expect(cycle.ok).toBe(false);
    if (!cycle.ok) expect(cycle.issues.map((issue) => issue.code)).toContain('TOC_CYCLE');

    const orphan = buildTocIndex(readPackFixture('invalid-toc-orphan.json'));
    expect(orphan.ok).toBe(false);
    if (!orphan.ok) expect(orphan.issues.map((issue) => issue.code)).toContain('TOC_ORPHAN');
  });
});
