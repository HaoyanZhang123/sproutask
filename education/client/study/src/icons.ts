/**
 * 学习台用的内联 SVG 图标（不用图标库、不引外部资源）。
 *
 * 图标一律 aria-hidden：它是装饰，旁边的文字才是可读信息。
 */

const SVG_NS = 'http://www.w3.org/2000/svg';

export interface IconPath {
  readonly d: string;
  /** true = 实心填充；否则按描边画。 */
  readonly filled?: boolean;
  readonly opacity?: string;
}

function icon(documentRef: Document, paths: readonly IconPath[]): SVGSVGElement {
  const svg = documentRef.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  svg.setAttribute('class', 'edu-study-icon');
  for (const spec of paths) {
    const path = documentRef.createElementNS(SVG_NS, 'path');
    path.setAttribute('d', spec.d);
    if (spec.filled === true) {
      path.setAttribute('fill', 'currentColor');
    } else {
      path.setAttribute('fill', 'none');
      path.setAttribute('stroke', 'currentColor');
      path.setAttribute('stroke-width', '1.8');
      path.setAttribute('stroke-linecap', 'round');
      path.setAttribute('stroke-linejoin', 'round');
    }
    if (spec.opacity !== undefined) path.setAttribute('opacity', spec.opacity);
    svg.append(path);
  }
  return svg;
}

/** 芽问的「小芽」标记。 */
export function sproutIcon(documentRef: Document): SVGSVGElement {
  return icon(documentRef, [
    { d: 'M12 21v-6.2' },
    { d: 'M12 14.8c0-3.4-2.6-5.6-6.2-5.6C5.6 12.9 8 15 12 14.8Z', filled: true, opacity: '0.85' },
    { d: 'M12 13.4c.3-3 2.6-4.9 5.8-4.9.2 3.3-2 5.2-5.8 4.9Z', filled: true, opacity: '0.55' },
  ]);
}

/** 课本。 */
export function bookIcon(documentRef: Document): SVGSVGElement {
  return icon(documentRef, [
    { d: 'M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5z' },
    { d: 'M4 20.5A2.5 2.5 0 0 1 6.5 18H20' },
  ]);
}

/** 折叠箭头（默认朝右，展开时由 CSS 旋转）。 */
export function chevronIcon(documentRef: Document): SVGSVGElement {
  return icon(documentRef, [{ d: 'm9 6 6 6-6 6' }]);
}

/** 关闭。 */
export function closeIcon(documentRef: Document): SVGSVGElement {
  return icon(documentRef, [{ d: 'm6 6 12 12M18 6 6 18' }]);
}
