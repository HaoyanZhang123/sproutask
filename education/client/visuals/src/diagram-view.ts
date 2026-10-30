/**
 * Framework-free DOM view for a controlled diagram + its equivalent keyboard
 * answer path (02 §7, 07 A19/A21).
 *
 * The client never receives HTML strings from the service: it builds every node
 * with DOM APIs from the validated render plan, so diagram text cannot become
 * markup. Clicking a node focuses its numbered input; typing a number or text
 * produces the same semantic answer.
 */

import type { DiagramSpec, NormalizedBBox } from '@edu/domain';

export interface DiagramPlanNode {
  readonly id: string;
  readonly label: string;
  readonly number: number;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface DiagramPlanEdge {
  readonly id: string;
  readonly from: string;
  readonly to: string;
  readonly directed: boolean;
  readonly label: string | null;
  readonly x1: number;
  readonly y1: number;
  readonly x2: number;
  readonly y2: number;
}

export interface DiagramPlanRegion {
  readonly id: string;
  readonly bbox: NormalizedBBox;
  readonly altText: string;
}

/** Structural mirror of `@edu/visuals`' render plan (no cross-package import). */
export interface DiagramPlanLike {
  readonly width: number;
  readonly height: number;
  readonly altText: string;
  readonly nodes: readonly DiagramPlanNode[];
  readonly edges: readonly DiagramPlanEdge[];
  readonly regions: readonly DiagramPlanRegion[];
  readonly numberedTargets: readonly { readonly number: number; readonly nodeId: string; readonly label: string }[];
}

export interface DiagramLabelAnswer {
  readonly labels: readonly { readonly targetId: string; readonly text: string }[];
}

export interface DiagramViewOptions {
  readonly spec: DiagramSpec;
  readonly plan: DiagramPlanLike;
  readonly initial?: Readonly<Record<string, string>>;
  readonly onSubmit: (answer: DiagramLabelAnswer) => void;
  readonly onCancel?: () => void;
}

export interface DiagramViewController {
  readonly element: HTMLElement;
  getAnswer(): DiagramLabelAnswer;
  setAnswer(labels: readonly { readonly targetId: string; readonly text: string }[]): void;
  unmount(): void;
}

const SVG_NS = 'http://www.w3.org/2000/svg';

function svg<K extends keyof SVGElementTagNameMap>(
  tag: K,
  attributes: Readonly<Record<string, string | number>>,
): SVGElementTagNameMap[K] {
  const element = document.createElementNS(SVG_NS, tag);
  for (const [key, value] of Object.entries(attributes)) element.setAttribute(key, String(value));
  return element;
}

export function mountDiagramView(
  container: HTMLElement,
  options: DiagramViewOptions,
): DiagramViewController {
  const root = document.createElement('section');
  root.className = 'edu-visual-diagram';
  root.dataset['eduVisual'] = 'diagram';
  root.setAttribute('aria-label', options.spec.altText);

  const heading = document.createElement('h3');
  heading.textContent = '结构示意图（示意，非教材原图）';
  root.append(heading);

  const description = document.createElement('p');
  description.className = 'edu-visual-alt';
  description.textContent = options.plan.altText;
  root.append(description);

  const figure = document.createElement('figure');
  const svgRoot = svg('svg', {
    viewBox: `0 0 ${options.plan.width} ${options.plan.height}`,
    role: 'img',
    'aria-hidden': 'false',
    class: 'edu-visual-svg',
  });
  const title = svg('title', {});
  title.textContent = '结构示意图';
  svgRoot.append(title);
  const desc = svg('desc', {});
  desc.textContent = options.plan.altText;
  svgRoot.append(desc);
  svgRoot.append(svg('rect', { x: 0, y: 0, width: options.plan.width, height: options.plan.height, fill: '#fff' }));

  for (const region of options.plan.regions) {
    svgRoot.append(
      svg('rect', {
        x: region.bbox.x * options.plan.width,
        y: region.bbox.y * options.plan.height,
        width: region.bbox.width * options.plan.width,
        height: region.bbox.height * options.plan.height,
        fill: 'none',
        stroke: '#9a6fb0',
        'stroke-dasharray': '6 4',
      }),
    );
  }
  for (const edge of options.plan.edges) {
    svgRoot.append(
      svg('line', {
        x1: edge.x1,
        y1: edge.y1,
        x2: edge.x2,
        y2: edge.y2,
        stroke: '#7c8a99',
        'stroke-width': 2,
      }),
    );
  }
  const inputs = new Map<string, HTMLInputElement>();
  for (const node of options.plan.nodes) {
    const group = svg('g', {});
    const rect = svg('rect', {
      x: node.x,
      y: node.y,
      width: node.width,
      height: node.height,
      rx: 8,
      fill: '#e8f1fb',
      stroke: '#3f5a75',
    });
    rect.setAttribute('tabindex', '0');
    rect.setAttribute('role', 'button');
    rect.setAttribute('aria-label', `部位 ${node.number}：${node.label}`);
    const text = svg('text', { x: node.x + 12, y: node.y + 32, 'font-size': 16, fill: '#16202b' });
    text.textContent = `${node.number}. ${node.label}`;
    group.append(rect, text);
    rect.addEventListener('click', () => inputs.get(node.id)?.focus());
    rect.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        inputs.get(node.id)?.focus();
      }
    });
    svgRoot.append(group);
  }
  figure.append(svgRoot);
  root.append(figure);

  const list = document.createElement('ol');
  list.className = 'edu-visual-targets';
  list.setAttribute('aria-label', '按编号填写部位名称（与图上点选等价）');
  for (const target of options.plan.numberedTargets) {
    const item = document.createElement('li');
    const label = document.createElement('label');
    const number = document.createElement('span');
    number.className = 'edu-visual-target-number';
    number.textContent = `${target.number}. ${target.label}`;
    const input = document.createElement('input');
    input.type = 'text';
    input.id = `visual-target-${target.number}`;
    input.dataset['targetId'] = target.nodeId;
    input.setAttribute('aria-label', `第 ${target.number} 个部位：${target.label} 的名称`);
    input.value = options.initial?.[target.nodeId] ?? '';
    label.setAttribute('for', input.id);
    label.append(number);
    item.append(label, input);
    list.append(item);
    inputs.set(target.nodeId, input);
  }
  root.append(list);

  const actions = document.createElement('div');
  actions.className = 'edu-visual-actions';
  const submit = document.createElement('button');
  submit.type = 'button';
  submit.textContent = '提交标注';
  submit.addEventListener('click', () => {
    const answer = collect();
    options.onSubmit(answer);
  });
  actions.append(submit);
  if (options.onCancel !== undefined) {
    const cancel = document.createElement('button');
    cancel.type = 'button';
    cancel.textContent = '返回';
    cancel.addEventListener('click', () => options.onCancel?.());
    actions.append(cancel);
  }
  root.append(actions);

  function collect(): DiagramLabelAnswer {
    const labels: { targetId: string; text: string }[] = [];
    for (const target of options.plan.numberedTargets) {
      const input = inputs.get(target.nodeId);
      const text = input?.value.trim() ?? '';
      if (text.length > 0) labels.push({ targetId: target.nodeId, text });
    }
    return { labels };
  }

  container.append(root);
  return {
    element: root,
    getAnswer: collect,
    setAnswer(labels) {
      // Replacing the answer clears every field first: a partial setAnswer must
      // not silently keep a stale label from the previous answer.
      for (const input of inputs.values()) input.value = '';
      for (const label of labels) {
        const input = inputs.get(label.targetId);
        if (input !== undefined) input.value = label.text;
      }
    },
    unmount() {
      root.remove();
      inputs.clear();
    },
  };
}
