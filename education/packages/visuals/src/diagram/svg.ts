/**
 * Safe SVG rendering for a controlled diagram.
 *
 * The output is a plain SVG string: only static shapes and escaped text, no
 * scripts, no event attributes, no foreignObject, no external references. The
 * client uses the same escaping helper, so the DOM and string paths cannot
 * drift apart.
 */

import type { DiagramRenderPlan } from './layout.js';

export function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export interface SvgOptions {
  /** Optional accessible heading id prefix; defaults to "diagram". */
  readonly idPrefix?: string;
  readonly showNumbers?: boolean;
}

const KIND_FILL: Record<string, string> = {
  concept: '#e8f1fb',
  structure: '#eaf6ee',
  process: '#fdf2e3',
  region: '#f4ecfa',
};

/** Renders the plan as a static, script-free SVG document fragment. */
export function renderDiagramSvg(plan: DiagramRenderPlan, options: SvgOptions = {}): string {
  const prefix = (options.idPrefix ?? 'diagram').replace(/[^A-Za-z0-9_-]/g, '');
  const titleId = `${prefix}-title`;
  const descId = `${prefix}-desc`;
  const showNumbers = options.showNumbers !== false;
  const parts: string[] = [];
  parts.push(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${plan.width} ${plan.height}" ` +
      `role="img" aria-labelledby="${titleId} ${descId}" class="edu-diagram" data-edu-diagram="true">`,
  );
  parts.push(`<title id="${titleId}">示意图</title>`);
  parts.push(`<desc id="${descId}">${escapeXml(plan.altText)}</desc>`);
  parts.push(`<rect x="0" y="0" width="${plan.width}" height="${plan.height}" fill="#ffffff"/>`);

  for (const region of plan.regions) {
    const x = region.bbox.x * plan.width;
    const y = region.bbox.y * plan.height;
    const width = region.bbox.width * plan.width;
    const height = region.bbox.height * plan.height;
    parts.push(
      `<g class="edu-diagram-region" data-region-id="${escapeXml(region.id)}">` +
        `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${width.toFixed(1)}" height="${height.toFixed(1)}" ` +
        `fill="none" stroke="#9a6fb0" stroke-dasharray="6 4" stroke-width="2"/>` +
        `<text x="${(x + 4).toFixed(1)}" y="${(y + 16).toFixed(1)}" font-size="12" fill="#6a4b7c">${escapeXml(region.altText)}</text>` +
        `</g>`,
    );
  }

  for (const edge of plan.edges) {
    parts.push(
      `<line class="edu-diagram-edge" data-edge-id="${escapeXml(edge.id)}" x1="${edge.x1.toFixed(1)}" ` +
        `y1="${edge.y1.toFixed(1)}" x2="${edge.x2.toFixed(1)}" y2="${edge.y2.toFixed(1)}" ` +
        `stroke="#7c8a99" stroke-width="2"${edge.directed ? ' marker-end="url(#arrow)"' : ''}/>`,
    );
    if (edge.label !== null && edge.label.length > 0) {
      const midX = (edge.x1 + edge.x2) / 2;
      const midY = (edge.y1 + edge.y2) / 2;
      parts.push(
        `<text x="${midX.toFixed(1)}" y="${midY.toFixed(1)}" font-size="12" fill="#4a5563">${escapeXml(edge.label)}</text>`,
      );
    }
  }

  for (const node of plan.nodes) {
    const fill = KIND_FILL[node.kind] ?? '#f2f4f7';
    parts.push(
      `<g class="edu-diagram-node" data-node-id="${escapeXml(node.id)}" data-node-number="${node.number}">` +
        `<rect x="${node.x}" y="${node.y}" width="${node.width}" height="${node.height}" rx="8" ` +
        `fill="${fill}" stroke="#3f5a75" stroke-width="2"/>` +
        `<text x="${node.x + 12}" y="${node.y + 32}" font-size="16" fill="#16202b">` +
        `${escapeXml(showNumbers ? `${node.number}. ${node.label}` : node.label)}</text>` +
        `</g>`,
    );
  }
  parts.push('</svg>');
  return parts.join('');
}

/** Marker definition kept separate so it can be injected once per page. */
export const DIAGRAM_SVG_DEFS =
  '<svg xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false" width="0" height="0">' +
  '<defs><marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">' +
  '<path d="M 0 0 L 10 5 L 0 10 z" fill="#7c8a99"/></marker></defs></svg>';
