import { afterEach, describe, expect, it } from 'vitest';
import {
  cleanupMaps,
  dispatchKey,
  mountMap,
  pageRoot,
  textOf,
  treeItem,
} from './helpers.js';

afterEach(cleanupMaps);

function visibleItems(container: HTMLElement): HTMLElement[] {
  return [...container.querySelectorAll<HTMLElement>('[role="treeitem"]')];
}

describe('map page mounting and tree navigation (A12/A23 L2)', () => {
  it('takes over /map through registerPage and fills both map slots', async () => {
    const { shell, container } = await mountMap();
    expect(shell.getState().currentPath).toBe('/map');
    expect(pageRoot(container).dataset['pageId']).toBe('map');
    expect(container.querySelector('[data-testid="map-fallback"]')).toBeNull();
    expect(
      container.querySelector('[data-edu-slot="map:content"] [data-testid="map-tree"]'),
    ).not.toBeNull();
    expect(
      container.querySelector('[data-edu-slot="map:details"] [data-testid="map-detail"]'),
    ).not.toBeNull();
    expect(container.querySelector('[data-testid="map-fixture-notice"]')).not.toBeNull();
    expect(textOf(container)).toContain('演示数据（fixture）');
    expect(textOf(container)).not.toMatch(/终端|源码|插件市场|开发者工具|DevTools|Skill/i);
  });

  it('renders the real hierarchy, opens the last studied chapter and collapses the others', async () => {
    const { container } = await mountMap();
    const tree = container.querySelector<HTMLElement>('[data-testid="map-tree"]');
    expect(tree?.getAttribute('role')).toBe('tree');
    expect(tree?.getAttribute('aria-label')).toBe('教材目录');

    // volume(1) > unit(2) > chapter(3); the ecosystem chapter is the last touched one.
    expect(treeItem(container, 'toc.volume').getAttribute('aria-level')).toBe('1');
    expect(treeItem(container, 'toc.unit1').getAttribute('aria-level')).toBe('2');
    expect(treeItem(container, 'toc.ch3').getAttribute('aria-level')).toBe('3');
    expect(treeItem(container, 'toc.ch3').getAttribute('aria-selected')).toBe('true');
    expect(treeItem(container, 'toc.ch3').getAttribute('aria-expanded')).toBe('true');
    expect(container.querySelector('[data-toc-id="toc.ch3.s1"]')).not.toBeNull();

    // other chapters stay collapsed to section level (chapter-level folding)
    expect(treeItem(container, 'toc.ch1').getAttribute('aria-expanded')).toBe('false');
    expect(container.querySelector('[data-toc-id="toc.ch1.s1"]')).toBeNull();
  });

  it('counts distinct concepts per range (multi-placement concept counted once)', async () => {
    const { container } = await mountMap();
    // chapter 1 holds cell (also placed in ch3), cell-structure, cell-division.
    expect(treeItem(container, 'toc.ch1').dataset['label']).toContain('3 个概念');
    // the whole volume holds 7 distinct concepts although there are 8 placements.
    expect(treeItem(container, 'toc.volume').dataset['label']).toContain('7 个概念');
    // chapter 3 has 2 distinct concepts: cell (also placed in chapter 1) and ecosystem\n    expect(treeItem(container, 'toc.ch3').dataset['label']).toContain('2 个概念');
    expect(textOf(container)).toContain('已学 5');
    expect(textOf(container)).toContain('可学习 7');
  });

  it('moves through the tree with arrows, expands/collapses and selects', async () => {
    const { container } = await mountMap();
    const ch3 = treeItem(container, 'toc.ch3');
    ch3.focus();
    expect(document.activeElement).toBe(ch3);

    // ArrowDown → first section of the open chapter
    dispatchKey(ch3, 'ArrowDown');
    expect(treeItem(container, 'toc.ch3.s1')).not.toBeNull();
    expect(document.activeElement).toBe(treeItem(container, 'toc.ch3.s1'));

    // ArrowLeft → back to the parent chapter
    dispatchKey(treeItem(container, 'toc.ch3.s1'), 'ArrowLeft');
    expect(document.activeElement).toBe(treeItem(container, 'toc.ch3'));

    // ArrowLeft again → collapse the chapter (sections disappear)
    dispatchKey(treeItem(container, 'toc.ch3'), 'ArrowLeft');
    expect(container.querySelector('[data-toc-id="toc.ch3.s1"]')).toBeNull();
    expect(treeItem(container, 'toc.ch3').getAttribute('aria-expanded')).toBe('false');
    expect(document.activeElement).toBe(treeItem(container, 'toc.ch3'));

    // ArrowRight → expand again, ArrowRight again → first child
    dispatchKey(treeItem(container, 'toc.ch3'), 'ArrowRight');
    expect(container.querySelector('[data-toc-id="toc.ch3.s1"]')).not.toBeNull();
    dispatchKey(treeItem(container, 'toc.ch3'), 'ArrowRight');
    expect(document.activeElement).toBe(treeItem(container, 'toc.ch3.s1'));

    // Home/End stay inside the tree
    dispatchKey(treeItem(container, 'toc.ch3.s1'), 'Home');
    expect(document.activeElement).toBe(treeItem(container, 'toc.volume'));
    dispatchKey(treeItem(container, 'toc.volume'), 'End');
    const items = visibleItems(container);
    expect(document.activeElement).toBe(items[items.length - 1]);

    // Enter selects chapter 1, folds it open and switches the graph scope
    treeItem(container, 'toc.ch1').focus();
    dispatchKey(treeItem(container, 'toc.ch1'), 'Enter');
    await new Promise((resolve) => setTimeout(resolve, 25));
    expect(treeItem(container, 'toc.ch1').getAttribute('aria-selected')).toBe('true');
    expect(container.querySelector('[data-toc-id="toc.ch1.s1"]')).not.toBeNull();
    expect(textOf(container)).toContain('当前范围：第 1 章 细胞');
    const nodes = [...container.querySelectorAll<HTMLElement>('button.edu-map-node')];
    expect(nodes.map((node) => node.dataset['conceptId']).sort()).toEqual([
      'concept.cell',
      'concept.cell-division',
      'concept.cell-structure',
    ]);
  });

  it('keeps selection and returns to the chapter when the page is re-entered', async () => {
    const { shell, container } = await mountMap();
    treeItem(container, 'toc.ch1').click();
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(textOf(container)).toContain('当前范围：第 1 章 细胞');

    await shell.navigate('/home');
    expect(container.querySelector('[data-testid="map-page"]')).toBeNull();
    await shell.navigate('/map');
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(container.querySelector('[data-testid="map-tree"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="map-fixture-notice"]')).not.toBeNull();
  });
});
