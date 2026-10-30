import { afterEach, describe, expect, it } from 'vitest';
import { cleanupMaps, graphNodes, mountMap } from './helpers.js';

afterEach(cleanupMaps);

function nowMs(): number {
  return performance.now();
}

function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}

describe('500 concept / 1000 relation bounded rendering and measured timings (A12 L3 contribution)', () => {
  it('records first render and chapter switch timings without painting the whole volume', async () => {
    const wallStart = nowMs();
    const { container, map } = await mountMap({ scenario: 'scale' });
    const wallFirstRenderMs = round(nowMs() - wallStart);

    const firstNodes = graphNodes(container);
    expect(firstNodes).toHaveLength(24);
    const firstDomElements = container.querySelectorAll('*').length;
    expect(firstDomElements).toBeLessThan(4000);

    const treeItems = [
      ...container.querySelectorAll<HTMLElement>('[role="treeitem"][data-node-type="chapter"]'),
    ];
    expect(treeItems).toHaveLength(20);
    const selectedId = container
      .querySelector('[role="treeitem"][aria-selected="true"]')
      ?.getAttribute('data-toc-id');
    const target = treeItems.find((item) => item.getAttribute('data-toc-id') !== selectedId);
    expect(target).toBeDefined();
    if (target === undefined) return;

    const switchStart = nowMs();
    target.click();
    await new Promise((resolve) => setTimeout(resolve, 80));
    const wallChapterSwitchMs = round(nowMs() - switchStart);

    const switchedNodes = graphNodes(container);
    expect(switchedNodes).toHaveLength(24);
    const switchedDomElements = container.querySelectorAll('*').length;
    expect(switchedDomElements).toBeLessThan(4000);

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
        paintedNodesPerChapter: 24,
      },
      environment: {
        runtime: 'vitest + happy-dom (Node)',
        note: 'DOM construction timings on this machine/run; not a browser paint or latency guarantee',
      },
      measures: {
        wallFirstRenderMs,
        wallChapterSwitchMs,
        controller: timings,
        firstRenderNodes: firstNodes.length,
        firstRenderDomElements: firstDomElements,
        chapterSwitchNodes: switchedNodes.length,
        chapterSwitchDomElements: switchedDomElements,
      },
    };
    console.log(`T10_PERF ${JSON.stringify(report)}`);

    expect(wallFirstRenderMs).toBeGreaterThan(0);
    expect(timings.firstRenderMs).toBeGreaterThanOrEqual(0);
    expect(timings.lastGraphLoadMs).toBeGreaterThanOrEqual(0);
    expect(timings.chapterSwitchMs).not.toBeNull();
  });
});
