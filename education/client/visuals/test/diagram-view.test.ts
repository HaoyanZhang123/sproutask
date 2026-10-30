import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { DiagramSpec } from '@edu/domain';

import { mountDiagramView, type DiagramPlanLike } from '../src/diagram-view.js';

const plan: DiagramPlanLike = {
  width: 400,
  height: 220,
  altText: '细胞结构示意图：细胞、细胞核与细胞膜',
  nodes: [
    { id: 'node.cell', label: '细胞', number: 1, x: 20, y: 20, width: 150, height: 54 },
    { id: 'node.nucleus', label: '细胞核', number: 2, x: 200, y: 20, width: 150, height: 54 },
    { id: 'node.membrane', label: '细胞膜', number: 3, x: 110, y: 120, width: 150, height: 54 },
  ],
  edges: [{ id: 'edge.1', from: 'node.cell', to: 'node.nucleus', directed: true, label: '包含', x1: 170, y1: 47, x2: 200, y2: 47 }],
  regions: [
    { id: 'region.nucleus', bbox: { x: 0.2, y: 0.2, width: 0.3, height: 0.3 }, altText: '细胞核所在区域' },
  ],
  numberedTargets: [
    { number: 1, nodeId: 'node.cell', label: '细胞' },
    { number: 2, nodeId: 'node.nucleus', label: '细胞核' },
    { number: 3, nodeId: 'node.membrane', label: '细胞膜' },
  ],
};

const spec: DiagramSpec = {
  schemaVersion: 1,
  nodes: plan.nodes.map((node) => ({ id: node.id, label: node.label, kind: 'structure' })),
  edges: [{ id: 'edge.1', from: 'node.cell', to: 'node.nucleus', label: '包含', directed: true }],
  labels: [],
  regions: plan.regions.map((region) => ({
    id: region.id,
    assetId: 'asset.figure.cell',
    bbox: region.bbox,
    altText: region.altText,
  })),
  altText: plan.altText,
  sourceRefs: ['source.p26'],
};

describe('diagram view (A19 keyboard equivalence)', () => {
  let container: HTMLElement;

  beforeEach(() => {
    document.body.innerHTML = '';
    container = document.createElement('div');
    document.body.append(container);
  });

  it('renders a diagram with an accessible title/description and a numbered list', () => {
    const controller = mountDiagramView(container, { spec, plan, onSubmit: () => undefined });
    const svg = container.querySelector('svg');
    expect(svg).not.toBeNull();
    expect(svg?.getAttribute('role')).toBe('img');
    expect(container.querySelector('svg title')?.textContent).toBe('结构示意图');
    expect(container.querySelector('svg desc')?.textContent).toContain('细胞核');
    expect(container.textContent).toContain('示意，非教材原图');
    const inputs = container.querySelectorAll('input[type="text"]');
    expect(inputs).toHaveLength(3);
    expect(container.textContent).toContain('1. 细胞');
    controller.unmount();
    expect(container.querySelector('svg')).toBeNull();
  });

  it('produces the same semantic answer for the numbered path and the click path', () => {
    const submitted: { labels: readonly { targetId: string; text: string }[] }[] = [];
    const controller = mountDiagramView(container, {
      spec,
      plan,
      onSubmit: (answer) => submitted.push(answer),
    });

    const inputs = container.querySelectorAll<HTMLInputElement>('input[type="text"]');
    inputs[1].value = ' 细胞核 ';
    (container.querySelector('.edu-visual-actions button') as HTMLButtonElement | null)?.click();
    expect(submitted.at(-1)?.labels).toEqual([{ targetId: 'node.nucleus', text: '细胞核' }]);

    // Clicking a diagram node focuses the equivalent numbered input.
    const node = container.querySelector('svg g rect[aria-label^="部位 2"]');
    expect(node).not.toBeNull();
    (node as SVGRectElement).dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(document.activeElement).toBe(inputs[1]);

    controller.setAnswer([{ targetId: 'node.cell', text: '细胞' }, { targetId: 'node.membrane', text: '细胞膜' }]);
    expect(controller.getAnswer().labels).toHaveLength(2);
    controller.unmount();
  });

  it('never turns diagram text into markup', () => {
    const hostilePlan: DiagramPlanLike = {
      ...plan,
      altText: '<img src=x onerror=alert(1)>',
      nodes: plan.nodes.map((node) =>
        node.id === 'node.cell' ? { ...node, label: '<script>alert(1)</script>' } : node,
      ),
    };
    const onSubmit = vi.fn();
    const controller = mountDiagramView(container, {
      spec: { ...spec, altText: hostilePlan.altText },
      plan: hostilePlan,
      onSubmit,
    });
    expect(container.querySelector('script')).toBeNull();
    expect(container.querySelector('img[src="x"]')).toBeNull();
    expect(container.querySelector('svg text')?.textContent).toContain('<script>');
    expect(container.textContent).toContain('<img src=x onerror=alert(1)>');
    controller.unmount();
  });
});
