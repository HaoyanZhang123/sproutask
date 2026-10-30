import { afterEach, describe, expect, it } from 'vitest';
import { DESIGN_TOKENS } from '../../shell/src/index.js';
import { mapStyles } from '../src/index.js';
import {
  buttonsOf,
  cleanupMaps,
  edgesOf,
  graphNodes,
  mountMap,
  textOf,
  treeItem,
} from './helpers.js';

afterEach(cleanupMaps);

describe('map accessibility, keyboard equivalence and layout budget (A23 L2)', () => {
  it('uses native controls and a real tree with roving tabindex', async () => {
    const { container } = await mountMap();
    for (const control of buttonsOf(container)) {
      expect(control.type).toBe('button');
    }
    const tree = container.querySelector<HTMLElement>('[data-testid="map-tree"]');
    expect(tree?.getAttribute('role')).toBe('tree');
    const items = [...container.querySelectorAll<HTMLElement>('[role="treeitem"]')];
    expect(items.length).toBeGreaterThan(5);
    const focusable = items.filter((item) => item.getAttribute('tabindex') === '0');
    expect(focusable).toHaveLength(1);
    for (const item of items) {
      expect(item.getAttribute('aria-level')).not.toBeNull();
      expect(item.getAttribute('aria-selected')).not.toBeNull();
    }
  });

  it('exposes graph nodes as keyboard buttons with a full text alternative', async () => {
    const { container } = await mountMap();
    treeItem(container, 'toc.ch1').click();
    await new Promise((resolve) => setTimeout(resolve, 25));
    const nodes = graphNodes(container);
    expect(nodes.length).toBeGreaterThan(0);
    for (const node of nodes) {
      const label = node.getAttribute('aria-label') ?? '';
      expect(label).toContain('学习进程：');
      expect(label).toContain('理解证据：');
      expect(label).toContain('复习：');
    }
    for (const edge of edgesOf(container)) {
      expect(edge.getAttribute('aria-hidden')).toBe('true');
    }
    const legend = container.querySelector('[data-testid="map-graph-legend"]');
    expect(textOf(legend as HTMLElement)).toContain('先修');
    expect(textOf(legend as HTMLElement)).toContain('相关');
    // The text relation table and the concept list both exist as equivalent paths.
    container.querySelector<HTMLButtonElement>('button[data-view-mode="relations"]')?.click();
    await new Promise((resolve) => setTimeout(resolve, 5));
    expect(container.querySelector('[data-testid="map-relation-list"]')).not.toBeNull();
    container.querySelector<HTMLButtonElement>('button[data-view-mode="concepts"]')?.click();
    await new Promise((resolve) => setTimeout(resolve, 5));
    expect(container.querySelector('[data-testid="map-concept-list"]')).not.toBeNull();
  });

  it('does not rely on colour alone for relation types, status or candidate state', async () => {
    const { container } = await mountMap();
    const chips = [...container.querySelectorAll<HTMLElement>('.edu-chip')];
    expect(chips.length).toBeGreaterThan(3);
    for (const chip of chips) {
      expect((chip.textContent ?? '').trim().length).toBeGreaterThan(0);
      expect(chip.dataset['tone']).toBeDefined();
    }
    await new Promise((resolve) => setTimeout(resolve, 10));
    const text = textOf(container);
    expect(text).toContain('先修（实线箭头）');
    expect(text).toContain('相关（虚线）');
    expect(text).toContain('部分内容（未覆盖全册）');
  });

  it('keeps visible focus styles and scalable, non-overflowing layout rules', () => {
    expect(mapStyles).toContain(':focus-visible');
    expect(mapStyles).toContain('outline');
    expect(mapStyles).toContain(DESIGN_TOKENS.focusRing);
    expect(mapStyles).toContain('min-width: 0');
    expect(mapStyles).toContain('minmax(0, 1fr)');
    expect(mapStyles).toContain('overflow-wrap: anywhere');
    expect(mapStyles).toContain('max-width: 100%');
    for (const match of mapStyles.matchAll(/font-size:\s*([^;]+);/g)) {
      const value = (match[1] ?? '').trim();
      expect(value, value).not.toMatch(/\d+px/);
    }
  });

  it('fits the 1280x800 and 1440x900 viewports without horizontal overflow', async () => {
    const { shell } = await mountMap();
    for (const [width, height] of [
      [1280, 800],
      [1440, 900],
      [1024, 768],
    ] as const) {
      const budget = shell.layoutBudget(width, height);
      expect(budget.fits).toBe(true);
      expect(budget.horizontalOverflow).toBe(false);
    }
  });

  it('mounts one map page, one style sheet and releases the page on navigation', async () => {
    const { shell, container } = await mountMap();
    expect(document.querySelectorAll('[data-edu-shell="true"]')).toHaveLength(1);
    expect(document.querySelectorAll('[data-edu-map-style="true"]')).toHaveLength(1);
    expect(container.querySelector('[data-testid="map-page"]')).not.toBeNull();
    await shell.navigate('/home');
    expect(container.querySelector('[data-testid="map-page"]')).toBeNull();
    expect(container.querySelector('[data-testid="map-tree"]')).toBeNull();
  });
});
