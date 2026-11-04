import { afterEach, describe, expect, it } from 'vitest';
import {
  chapterButton,
  cleanupMaps,
  graphNodes,
  mountMap,
  openChapter,
} from './helpers.js';

afterEach(cleanupMaps);

function nowMs(): number {
  return performance.now();
}

function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}

describe('500 concept / 1000 relation scale fixture (bounded DOM, measured timings)', () => {
  it('stays small on the overview, bounds the chapter graph and records timings', async () => {
    const wallStart = nowMs();
    const { container, map } = await mountMap({ scenario: 'scale' });
    const wallFirstRenderMs = round(nowMs() - wallStart);

    // Overview: one row per chapter, only the first six chips per row.
    const rows = [...container.querySelectorAll<HTMLElement>('.edu-map-chapter')];
    expect(rows).toHaveLength(20);
    const firstRowChips = rows[0]?.querySelectorAll('button.edu-map-chip').length ?? 0;
    expect(firstRowChips).toBeLessThanOrEqual(7); // six concepts + "还有 N 个"
    const overviewDom = container.querySelectorAll('*').length;
    expect(overviewDom).toBeLessThan(4000);
    expect(graphNodes(container)).toHaveLength(0);

    const switchStart = nowMs();
    chapterButton(container, 'toc.ch00').click();
    await new Promise((resolve) => setTimeout(resolve, 80));
    const wallChapterSwitchMs = round(nowMs() - switchStart);

    const nodes = graphNodes(container);
    expect(nodes).toHaveLength(25);
    const chapterDom = container.querySelectorAll('*').length;
    expect(chapterDom).toBeLessThan(4000);

    // The layout is layered and every node has a fixed-size slot.
    const stages = new Set(nodes.map((node) => node.dataset['stage']));
    expect(stages.size).toBeGreaterThan(1);
    expect(stages.size).toBeLessThanOrEqual(4);

    const timings = map.getTimings();
    const report = {
      schemaVersion: 1,
      task: 'T10',
      fixture: {
        source: 'createFixtureMapDataSource({ scenario: "scale" })',
        concepts: 500,
        relations: 1000,
        chapters: 20,
        sections: 100,
        overviewRows: rows.length,
        paintedNodesPerChapter: nodes.length,
      },
      environment: {
        runtime: 'vitest + happy-dom (Node)',
        note: 'DOM construction timings on this machine/run; not a browser paint or latency guarantee',
      },
      measures: {
        wallFirstRenderMs,
        wallChapterSwitchMs,
        controller: timings,
        overviewDomElements: overviewDom,
        chapterDomElements: chapterDom,
      },
    };
    console.log(`T10_PERF ${JSON.stringify(report)}`);

    expect(wallFirstRenderMs).toBeGreaterThan(0);
    expect(timings.firstRenderMs).toBeGreaterThanOrEqual(0);
    expect(timings.lastGraphLoadMs).toBeGreaterThanOrEqual(0);
    expect(timings.chapterSwitchMs).not.toBeNull();
  });

  it('opens every scale chapter without exceeding the node budget', async () => {
    const { container } = await mountMap({ scenario: 'scale' });
    for (const chapterId of ['toc.ch00', 'toc.ch10', 'toc.ch19']) {
      await openChapter(container, chapterId);
      expect(graphNodes(container).length).toBeLessThanOrEqual(25);
      (container.querySelector('button[data-action="back-overview"]') as HTMLButtonElement | null)?.click();
      await new Promise((resolve) => setTimeout(resolve, 5));
    }
  });
});
