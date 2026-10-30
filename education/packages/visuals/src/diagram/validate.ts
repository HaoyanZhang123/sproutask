/**
 * Controlled DiagramSpec validation (T11 step 1, 05 §5, A19/A24).
 *
 * `@edu/domain` already enforces the structural contract (unknown fields, ids,
 * bbox range, dangling edge/label targets, altText presence). This layer adds
 * the rendering boundary: nothing that could become markup, script or an event
 * handler may pass, and a diagram must have at least one answerable part.
 */

import { validateDiagramSpec, type DiagramSpec } from '@edu/domain';

import { fail, ok, visualsError, type VisualsResult } from '../errors.js';

export interface DiagramIssue {
  readonly code: string;
  readonly path: string;
  readonly message: string;
}

export const MAX_DIAGRAM_NODES = 120;
export const MAX_DIAGRAM_EDGES = 240;
export const MAX_TEXT_LENGTH = 200;

const UNSAFE_FRAGMENTS = [
  '<',
  '>',
  'javascript:',
  'vbscript:',
  'data:text/html',
  'data:image/svg',
  'onerror',
  'onclick',
  'onload',
  'onmouseover',
  'expression(',
] as const;

const CONTROL_CHARACTERS = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/;

/** Returns a short reason when controlled text would become markup/script. */
export function unsafeTextReason(text: string): string | null {
  const lowered = text.toLowerCase();
  for (const fragment of UNSAFE_FRAGMENTS) {
    if (lowered.includes(fragment)) return `contains "${fragment}"`;
  }
  if (/\son[a-z]+\s*=/.test(lowered)) return 'contains an event handler attribute';
  if (CONTROL_CHARACTERS.test(text)) return 'contains control characters';
  return null;
}

function pushIfUnsafe(
  issues: DiagramIssue[],
  text: string,
  path: string,
): void {
  const reason = unsafeTextReason(text);
  if (reason !== null) {
    issues.push({
      code: 'DIAGRAM_UNSAFE_TEXT',
      path,
      message: `受控文本不能包含网页/脚本内容（${reason}）`,
    });
  }
  if (text.length > MAX_TEXT_LENGTH) {
    issues.push({ code: 'DIAGRAM_INVALID', path, message: `文本超过 ${MAX_TEXT_LENGTH} 字符` });
  }
}

/**
 * Validates a controlled diagram for rendering and answering.
 * Returns the domain-validated spec on success; never returns an unsafe spec.
 */
export function validateControlledDiagram(input: unknown): VisualsResult<DiagramSpec> {
  const structural = validateDiagramSpec(input);
  if (!structural.ok) {
    const first = structural.issues[0];
    const code = first?.code === 'UNSAFE_CONTENT' ? 'DIAGRAM_UNSAFE_TEXT' : 'DIAGRAM_INVALID';
    return fail(
      visualsError(code, {
        detailsRef: first === undefined ? undefined : `${first.code}:${first.path}`,
      }),
    );
  }
  const spec = structural.value;
  const issues: DiagramIssue[] = [];

  if (spec.nodes.length === 0) {
    issues.push({ code: 'DIAGRAM_EMPTY', path: '$.nodes', message: '示意图至少需要一个可作答部位' });
  }
  if (spec.nodes.length > MAX_DIAGRAM_NODES) {
    issues.push({ code: 'DIAGRAM_TOO_LARGE', path: '$.nodes', message: `节点数超过 ${MAX_DIAGRAM_NODES}` });
  }
  if (spec.edges.length > MAX_DIAGRAM_EDGES) {
    issues.push({ code: 'DIAGRAM_TOO_LARGE', path: '$.edges', message: `连线数超过 ${MAX_DIAGRAM_EDGES}` });
  }
  if (spec.altText.trim().length === 0) {
    issues.push({ code: 'DIAGRAM_ALT_TEXT_MISSING', path: '$.altText', message: '缺少文字替代说明' });
  } else {
    pushIfUnsafe(issues, spec.altText, '$.altText');
  }

  const nodeIds = new Set(spec.nodes.map((node) => node.id));
  const labelIds = new Set(spec.labels.map((label) => label.id));
  const edgeIds = new Set(spec.edges.map((edge) => edge.id));
  const regionIds = new Set(spec.regions.map((region) => region.id));
  const allIds = new Set<string>();
  for (const [collection, ids] of [
    ['node', nodeIds],
    ['label', labelIds],
    ['edge', edgeIds],
    ['region', regionIds],
  ] as const) {
    for (const id of ids) {
      if (allIds.has(id)) {
        issues.push({ code: 'DIAGRAM_INVALID', path: `$.${collection}s`, message: `元素 id 重复：${id}` });
      }
      allIds.add(id);
    }
  }

  spec.nodes.forEach((node, index) => {
    pushIfUnsafe(issues, node.label, `$.nodes[${index}].label`);
  });
  spec.edges.forEach((edge, index) => {
    if (edge.from === edge.to) {
      issues.push({ code: 'DIAGRAM_INVALID', path: `$.edges[${index}]`, message: '连线不能指向自身' });
    }
    if (edge.label !== null) pushIfUnsafe(issues, edge.label, `$.edges[${index}].label`);
  });
  spec.labels.forEach((label, index) => {
    pushIfUnsafe(issues, label.text, `$.labels[${index}].text`);
    if (label.targetId !== null && !nodeIds.has(label.targetId)) {
      issues.push({
        code: 'DIAGRAM_DANGLING_REFERENCE',
        path: `$.labels[${index}].targetId`,
        message: `标注指向不存在的部位：${label.targetId}`,
      });
    }
  });
  spec.regions.forEach((region, index) => {
    pushIfUnsafe(issues, region.altText, `$.regions[${index}].altText`);
    const { x, y, width, height } = region.bbox;
    if (x < 0 || y < 0 || width <= 0 || height <= 0 || x + width > 1 || y + height > 1) {
      issues.push({
        code: 'DIAGRAM_BBOX_OUT_OF_RANGE',
        path: `$.regions[${index}].bbox`,
        message: '区域坐标必须落在 0..1 的归一化画面内',
      });
    }
  });

  if (issues.length > 0) {
    const first = issues[0];
    return fail(
      visualsError(first.code as 'DIAGRAM_INVALID', {
        detailsRef: `${first.path}`,
      }),
    );
  }
  return ok(spec);
}
