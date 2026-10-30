import { describe, expect, it } from 'vitest';

import { validateDiagramSpec, type DiagramSpec } from '@edu/domain';

import {
  buildDiagramTargets,
  normalizeDiagramLabelAnswer,
  normalizeLabelText,
  sameDiagramLabelAnswer,
} from '../src/diagram/equivalence.js';
import { planDiagram } from '../src/diagram/layout.js';
import { renderDiagramSvg } from '../src/diagram/svg.js';
import { unsafeTextReason, validateControlledDiagram } from '../src/diagram/validate.js';
import { cellDiagram } from './helpers/fixtures.js';

function mutate(change: (spec: DiagramSpec) => DiagramSpec): DiagramSpec {
  return change(cellDiagram());
}

describe('controlled DiagramSpec (A19/A24)', () => {
  it('accepts a valid diagram, validates with the domain contract and lays it out deterministically', () => {
    const spec = cellDiagram();
    expect(validateDiagramSpec(spec).ok).toBe(true);
    const validated = validateControlledDiagram(spec);
    expect(validated.ok).toBe(true);
    if (!validated.ok) return;
    const planA = planDiagram(validated.value);
    const planB = planDiagram(validated.value);
    expect(planA).toEqual(planB);
    expect(planA.nodes).toHaveLength(3);
    expect(planA.numberedTargets.map((target) => target.number)).toEqual([1, 2, 3]);
    expect(planA.width).toBeGreaterThan(0);
    expect(planA.height).toBeGreaterThan(0);
  });

  it('rejects markup, scripts and event handlers in controlled text', () => {
    const spec = mutate((base) => ({
      ...base,
      nodes: base.nodes.map((node) =>
        node.id === 'node.cell' ? { ...node, label: '<img src=x onerror=alert(1)>' } : node,
      ),
    }));
    const result = validateControlledDiagram(spec);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('DIAGRAM_UNSAFE_TEXT');
    expect(unsafeTextReason('javascript:alert(1)')).not.toBeNull();
    expect(unsafeTextReason('正常的中文标签')).toBeNull();
  });

  it('rejects dangling edge endpoints, out-of-range bbox, empty diagrams and missing alt text', () => {
    const dangling = mutate((base) => ({
      ...base,
      edges: [{ id: 'edge.bad', from: 'node.cell', to: 'node.unknown', label: null, directed: true }],
    }));
    expect(validateControlledDiagram(dangling).ok).toBe(false);

    const outOfRange = mutate((base) => ({
      ...base,
      regions: [
        {
          id: 'region.bad',
          assetId: 'asset.figure.cell',
          bbox: { x: 0.8, y: 0.8, width: 0.5, height: 0.5 },
          altText: '越界区域',
        },
      ],
    }));
    expect(validateControlledDiagram(outOfRange).ok).toBe(false);

    const empty = mutate((base) => ({ ...base, nodes: [], edges: [], labels: [], regions: [] }));
    expect(validateControlledDiagram(empty).ok).toBe(false);

    const noAlt = mutate((base) => ({ ...base, altText: '' }));
    expect(validateControlledDiagram(noAlt).ok).toBe(false);
  });

  it('renders static SVG without scripts, event attributes or external references', () => {
    const validated = validateControlledDiagram(cellDiagram());
    expect(validated.ok).toBe(true);
    if (!validated.ok) return;
    const svg = renderDiagramSvg(planDiagram(validated.value));
    expect(svg.startsWith('<svg')).toBe(true);
    expect(svg).toContain('role="img"');
    expect(svg).toContain('<title');
    expect(svg).toContain('<desc');
    expect(svg).not.toMatch(/<script/i);
    expect(svg).not.toMatch(/on[a-z]+\s*=/i);
    expect(svg).not.toMatch(/javascript:/i);
    expect(svg).not.toMatch(/<foreignObject/i);
    expect(svg).not.toMatch(/xlink:href|href=/i);
    // Amber text is escaped, never emitted as markup.
    const withAmpersand = mutate((base) => ({
      ...base,
      altText: '细胞结构 & 功能',
      nodes: base.nodes.map((node) => (node.id === 'node.cell' ? { ...node, label: '细胞 & 结构' } : node)),
    }));
    const okSpec = validateControlledDiagram(withAmpersand);
    expect(okSpec.ok).toBe(true);
    if (!okSpec.ok) return;
    const escaped = renderDiagramSvg(planDiagram(okSpec.value));
    expect(escaped).toContain('&amp;');
    expect(escaped).not.toContain('细胞 & 结构');
  });

  it('gives the same semantic answer through point-click and numbered paths', () => {
    const validated = validateControlledDiagram(cellDiagram());
    expect(validated.ok).toBe(true);
    if (!validated.ok) return;
    const plan = planDiagram(validated.value);
    const targets = buildDiagramTargets(plan);
    const nucleus = targets.find((target) => target.nodeId === 'node.nucleus');
    expect(nucleus).toBeDefined();
    if (nucleus === undefined) return;

    const clickPath = normalizeDiagramLabelAnswer(
      [{ targetId: 'node.nucleus', text: ' 细胞核 ' }],
      targets,
    );
    const numberedPath = normalizeDiagramLabelAnswer(
      [{ number: nucleus.number, text: '细胞核' }],
      targets,
    );
    expect(clickPath.ok).toBe(true);
    expect(numberedPath.ok).toBe(true);
    if (!clickPath.ok || !numberedPath.ok) return;
    expect(sameDiagramLabelAnswer(clickPath.value, numberedPath.value)).toBe(true);
    expect(normalizeLabelText(' 细胞 核 。')).toBe('细胞核');
  });

  it('rejects unknown targets and empty label text on both answer paths', () => {
    const validated = validateControlledDiagram(cellDiagram());
    expect(validated.ok).toBe(true);
    if (!validated.ok) return;
    const targets = buildDiagramTargets(planDiagram(validated.value));
    const unknown = normalizeDiagramLabelAnswer([{ targetId: 'node.missing', text: '细胞核' }], targets);
    expect(unknown.ok).toBe(false);
    if (unknown.ok) return;
    expect(unknown.error.code).toBe('ANSWER_TARGET_UNKNOWN');

    const empty = normalizeDiagramLabelAnswer([{ targetId: 'node.nucleus', text: '   ' }], targets);
    expect(empty.ok).toBe(false);
    if (empty.ok) return;
    expect(empty.error.code).toBe('ANSWER_EMPTY');

    const badNumber = normalizeDiagramLabelAnswer([{ number: 99, text: '细胞核' }], targets);
    expect(badNumber.ok).toBe(false);
  });
});
