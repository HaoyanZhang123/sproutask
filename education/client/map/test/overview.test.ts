import { afterEach, describe, expect, it } from 'vitest';
import {
  buttonByAction,
  chapterButton,
  chapterRow,
  cleanupMaps,
  dispatchKey,
  flakySource,
  graphNodes,
  hasPercent,
  mountMap,
  openChapter,
  sourceWithPayload,
  startMap,
  textOf,
  tick,
  waitFor,
} from './helpers.js';
import { createFixtureMapDataSource } from '../src/index.js';
import type { MapDataSource } from '../src/types.js';

afterEach(cleanupMaps);

const BANNED = [
  '内容包',
  'activity.',
  'source.',
  'step-',
  '三轴',
  '证据候选',
  '基准',
  '回环',
  'rem',
  '掌握百分比',
  '覆盖率',
  '评分版本',
  '工具调用',
];

function expectStudentCopy(text: string): void {
  for (const word of BANNED) expect(text, word).not.toContain(word);
  expect(hasPercent(text)).toBe(false);
}

describe('whole-volume overview (level one)', () => {
  it('groups chapters by unit and shows section/concept counts and progress', async () => {
    const { container } = await mountMap();
    const overview = container.querySelector('[data-testid="map-overview"]');
    expect(overview).not.toBeNull();
    const units = [...container.querySelectorAll<HTMLElement>('[data-testid="map-unit"]')];
    expect(units.map((unit) => unit.dataset['unitId'])).toEqual(['toc.unit1', 'toc.unit2']);
    expect(textOf(container)).toContain('2 个单元 · 3 章 · 5 节 · 7 个概念');
    expect(textOf(container)).toContain('已学 6 / 7 个概念');

    const first = chapterRow(container, 'toc.ch1');
    expect(textOf(first)).toContain('第 1 章 细胞');
    expect(textOf(first)).toContain('2 节 · 3 个概念');
    expect(chapterRow(container, 'toc.ch2').textContent).toContain('第 2 章 绿色植物的生活');
    expect(chapterRow(container, 'toc.ch3').textContent).toContain('第 3 章 生态系统');
  });

  it('never relies on colour alone: every chip has a state word and a shape', async () => {
    const { container } = await mountMap();
    const chips = [...container.querySelectorAll<HTMLButtonElement>('button.edu-map-chip[data-state]')];
    expect(chips.length).toBeGreaterThan(5);
    for (const chip of chips) {
      const state = chip.dataset['state'];
      expect(chip.querySelector('.edu-map-state-glyph')?.getAttribute('data-state')).toBe(state);
      expect(chip.querySelector('.edu-map-chip__state')?.textContent?.trim().length).toBeGreaterThan(0);
    }
    const cellChip = container.querySelector<HTMLButtonElement>('button.edu-map-chip[data-concept-id="concept.cell"]');
    expect(cellChip?.dataset['state']).toBe('steady');
    expect(textOf(cellChip as HTMLElement)).toContain('比较稳');
    const weakChip = container.querySelector<HTMLButtonElement>(
      'button.edu-map-chip[data-concept-id="concept.photosynthesis"]',
    );
    expect(weakChip?.dataset['state']).toBe('weak');
    expect(textOf(weakChip as HTMLElement)).toContain('要再练');
    const legend = container.querySelector('[data-testid="map-legend"]');
    expect(textOf(legend as HTMLElement)).toBe('在学要再练比较稳还没开始');
  });

  it('opens a chapter, then returns to the overview with focus back on that chapter', async () => {
    const { container } = await mountMap();
    chapterButton(container, 'toc.ch1').click();
    await tick(5);
    expect(container.querySelector('[data-testid="map-overview"]')).toBeNull();
    expect(container.querySelector('[data-testid="map-chapter-title"]')?.textContent).toBe('第 1 章 细胞');
    expect(container.querySelector('[data-testid="map-chapter-title"]')).toBe(document.activeElement);
    expect(graphNodes(container)).toHaveLength(3);

    buttonByAction(container, 'back-overview').click();
    await tick(5);
    expect(container.querySelector('[data-testid="map-overview"]')).not.toBeNull();
    expect(document.activeElement).toBe(
      chapterButton(container, 'toc.ch1'),
    );
  });

  it('filters by concept title while typing and restores the whole book when cleared', async () => {
    const { container } = await mountMap();
    const input = container.querySelector<HTMLInputElement>('[data-testid="map-search-input"]');
    expect(input).not.toBeNull();
    if (input === null) return;
    input.focus();
    input.value = '细胞';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    await tick(5);

    expect(container.querySelector('[data-testid="map-search-status"]')?.textContent).toContain(
      '找到 3 个概念',
    );
    const chapters = [...container.querySelectorAll<HTMLElement>('.edu-map-chapter')];
    expect(chapters.map((row) => row.dataset['chapterId'])).toEqual(['toc.ch1', 'toc.ch3']);
    expect(
      container.querySelectorAll('button.edu-map-chip[data-concept-id="concept.photosynthesis"]'),
    ).toHaveLength(0);
    // the input is re-rendered but focus and its value return to it
    const focused = container.querySelector<HTMLInputElement>('[data-testid="map-search-input"]');
    expect(document.activeElement).toBe(focused);
    expect(focused?.value).toBe('细胞');

    if (focused === null) return;
    focused.value = '不存在';
    focused.dispatchEvent(new Event('input', { bubbles: true }));
    await tick(5);
    expect(container.querySelector('[data-testid="map-overview-empty"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="map-search-status"]')?.textContent).toContain(
      '没有找到',
    );
    buttonByAction(container, 'clear-search').click();
    await tick(5);
    expect(container.querySelector('[data-testid="map-overview"]')).not.toBeNull();
    expect(container.querySelectorAll('.edu-map-chapter')).toHaveLength(3);
  });

  it('jumps back to the concept that was studied last', async () => {
    const { container } = await mountMap();
    // the fixture marks the latest understanding update as the current concept
    buttonByAction(container, 'resume').click();
    await waitFor(
      () => container.querySelector('[data-testid="map-detail"][data-concept-id="concept.cell-division"]') !== null,
    );
    expect(container.querySelector('[data-testid="map-chapter-title"]')?.textContent).toContain(
      '第 1 章',
    );
  });

  it('shows the loading state, the failure state and a retry that recovers', async () => {
    const delayed: MapDataSource = {
      ...createFixtureMapDataSource(),
      async loadMap(request) {
        await tick(40);
        return createFixtureMapDataSource().loadMap(request);
      },
    };
    const mounted = startMap({ dataSource: delayed });
    await tick(5);
    expect(mounted.container.querySelector('[data-testid="edu-loading-state"]')).not.toBeNull();

    const flaky = flakySource(createFixtureMapDataSource());
    mounted.map.controller.dispose();
    const retried = startMap({ dataSource: flaky });
    await waitFor(() => retried.container.querySelector('[data-edu-error]') !== null);
    const banner = retried.container.querySelector('[data-edu-error]');
    expect(banner?.getAttribute('data-edu-error')).toBe('UNAVAILABLE');
    expect(banner?.textContent).not.toContain('UNAVAILABLE');
    expect(banner?.textContent).toContain('服务暂时不可用');
    expect(banner?.querySelector('button')).not.toBeNull();
    (banner?.querySelector('button') as HTMLButtonElement).click();
    await waitFor(() => retried.container.querySelector('[data-testid="map-overview"]') !== null);
  });

  it('renders an honest empty state when the catalog has no chapter', async () => {
    const { container } = await mountMap({
      dataSource: sourceWithPayload({
        toc: [
          {
            schemaVersion: 1,
            id: 'toc.volume',
            courseEditionId: 'course.biology-demo',
            parentId: null,
            type: 'volume',
            title: '空册',
            order: 0,
            sourceRefs: [],
          },
        ],
        concepts: [],
        relations: [],
        progress: [],
        evidence: [],
        selfReports: [],
      }),
    });
    expect(container.querySelector('[data-testid="map-overview-empty"]')).not.toBeNull();
    expect(textOf(container)).toContain('全册还没有可浏览的章');
  });

  it('leaves Escape to return from a chapter, and keeps student copy clean', async () => {
    const { container } = await mountMap();
    const text = textOf(container);
    expectStudentCopy(text);
    await openChapter(container, 'toc.ch1');
    dispatchKey(container.querySelector('[data-testid="map-chapter-title"]') as HTMLElement, 'Escape');
    await tick(5);
    expect(container.querySelector('[data-testid="map-overview"]')).not.toBeNull();
    expectStudentCopy(textOf(container));
  });
});
