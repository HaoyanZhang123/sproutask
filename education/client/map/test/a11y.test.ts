import { afterEach, describe, expect, it } from 'vitest';
import { DESIGN_TOKENS } from '../../shell/src/index.js';
import { mapStyles } from '../src/index.js';
import {
  buttonByView,
  buttonsOf,
  cleanupMaps,
  dispatchKey,
  graphEdges,
  graphNodes,
  listNodes,
  mountMap,
  openChapter,
  textOf,
  tick,
} from './helpers.js';

afterEach(cleanupMaps);

describe('map accessibility, keyboard equivalence and responsive layout', () => {
  it('uses native buttons and keeps every concept reachable by Tab', async () => {
    const { container } = await mountMap();
    for (const control of buttonsOf(container)) expect(control.type).toBe('button');
    // overview chips are buttons, not spans with click handlers
    const chips = [...container.querySelectorAll<HTMLButtonElement>('button.edu-map-chip')];
    expect(chips.length).toBeGreaterThan(5);
    for (const chip of chips) expect(chip.hasAttribute('tabindex')).toBe(false);

    await openChapter(container, 'toc.ch1');
    const nodes = graphNodes(container);
    expect(nodes.length).toBeGreaterThan(0);
    for (const node of nodes) {
      expect(node.hasAttribute('tabindex')).toBe(false);
      const label = node.getAttribute('aria-label') ?? '';
      expect(label).toContain('先修');
      expect(label).toContain('后继');
    }
    buttonByView(container, 'list').click();
    await tick(5);
    for (const item of listNodes(container)) {
      expect(item.type).toBe('button');
      expect(item.hasAttribute('tabindex')).toBe(false);
    }
  });

  it('carries state with words and shapes, and simplifies the graph to a vertical list on narrow screens', async () => {
    const narrow = await mountMap({ viewportWidth: 1024 });
    await openChapter(narrow.container, 'toc.ch1');
    const vertical = narrow.container.querySelector('[data-testid="map-graph"]');
    expect(vertical?.getAttribute('data-orientation')).toBe('vertical');
    for (const node of graphNodes(narrow.container)) {
      // flow list: no absolute coordinates, so nothing can overflow sideways
      expect(node.style.left).toBe('');
      expect(node.style.top).toBe('');
    }
    expect(textOf(vertical as HTMLElement)).toContain('先学');
    expect(narrow.container.querySelectorAll('.edu-map-graph__edges')).toHaveLength(0);

    const wide = await mountMap({ viewportWidth: 1440 });
    await openChapter(wide.container, 'toc.ch1');
    expect(wide.container.querySelector('[data-testid="map-graph"]')?.getAttribute('data-orientation')).toBe(
      'horizontal',
    );
    for (const edge of graphEdges(wide.container)) {
      expect(edge.closest('svg')?.getAttribute('aria-hidden')).toBe('true');
    }
    const legend = wide.container.querySelector('[data-testid="map-legend"]');
    expect(textOf(legend as HTMLElement)).toContain('要再练');
    expect(textOf(legend as HTMLElement)).toContain('比较稳');
  });

  it('keeps visible focus styles and only token-backed colours / font sizes', () => {
    expect(mapStyles).toContain(':focus-visible');
    expect(mapStyles).toContain('var(--edu-focus-ring)');
    expect(mapStyles).toContain('min-width: 0');
    expect(mapStyles).toContain('minmax(0, 1fr)');
    expect(mapStyles).toContain('overflow-wrap: anywhere');
    expect(mapStyles).toContain('max-width: 100%');
    expect(mapStyles).toContain('@media (max-width: 1099px)');
    // no literal colours anywhere (only token variables)
    expect(mapStyles).not.toMatch(/#[0-9a-fA-F]{3,8}/);
    expect(mapStyles).not.toMatch(/rgba?\(/);
    for (const match of mapStyles.matchAll(/font-size:\s*([^;]+);/g)) {
      const value = (match[1] ?? '').trim();
      expect(value).toMatch(/^var\(--edu-font-/);
      expect(value).not.toMatch(/\d+px/);
    }
    // every colour declaration references a token variable
    for (const match of mapStyles.matchAll(/(?:^|[\s;])(?:color|background|border-color):\s*([^;]+);/g)) {
      const value = (match[1] ?? '').trim();
      if (value === 'transparent' || value === 'currentColor' || value === 'none') continue;
      if (value.startsWith('none')) continue;
      expect(value, value).toMatch(/var\(--edu-/);
    }
  });

  it('fits the three acceptance viewports and releases the page on navigation', async () => {
    const { shell, container } = await mountMap();
    for (const [width, height] of [
      [1280, 800],
      [1440, 900],
      [1024, 768],
    ] as const) {
      const budget = shell.layoutBudget(width, height);
      expect(budget.fits).toBe(true);
      expect(budget.horizontalOverflow).toBe(false);
    }
    expect(document.querySelectorAll('[data-edu-map-style="true"]')).toHaveLength(1);
    expect(container.querySelector('[data-testid="map-page"]')).not.toBeNull();
    await shell.navigate('/home');
    expect(container.querySelector('[data-testid="map-page"]')).toBeNull();
    expect(container.querySelector('[data-testid="map-overview"]')).toBeNull();
  });

  it('lets Escape leave a chapter without trapping focus', async () => {
    const { container } = await mountMap();
    await openChapter(container, 'toc.ch1');
    const title = container.querySelector('[data-testid="map-chapter-title"]') as HTMLElement;
    title.focus();
    dispatchKey(title, 'Escape');
    await tick(5);
    expect(container.querySelector('[data-testid="map-overview"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="map-chapter-title"]')).toBeNull();
  });

  it('uses the shell compact breakpoint for the narrow chapter layout', () => {
    expect(DESIGN_TOKENS.breakpoints.compact).toBe(1100);
  });
});
