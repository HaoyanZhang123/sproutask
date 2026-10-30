/**
 * Framework-free answer forms for choice / text / relation activities
 * (02 §3.4/§7). Diagram labelling uses `mountDiagramView` (equivalent numbered
 * path lives there); `supportsAnswerForm` tells the caller which is applicable.
 */

import type { Activity, AnswerSchema } from '@edu/domain';

export type AnswerFormValue =
  | { readonly kind: 'choice'; readonly optionIds: readonly string[] }
  | { readonly kind: 'text'; readonly text: string }
  | {
      readonly kind: 'relation';
      readonly pairs: readonly { readonly fromId: string; readonly toId: string; readonly relation: 'prerequisite' | 'related' | null }[];
    };

export interface RelationNodeOption {
  readonly id: string;
  readonly label: string;
}

export interface AnswerFormOptions {
  readonly activity: Activity;
  readonly relationNodes?: readonly RelationNodeOption[];
  readonly initial?: AnswerFormValue | null;
  readonly onSubmit: (value: AnswerFormValue) => void;
  readonly onCancel?: () => void;
}

export interface AnswerFormController {
  readonly element: HTMLElement;
  getValue(): AnswerFormValue;
  unmount(): void;
}

export function supportsAnswerForm(activity: Activity): boolean {
  return activity.answerSchema.kind !== 'diagram_label';
}

export function mountAnswerForm(
  container: HTMLElement,
  options: AnswerFormOptions,
): AnswerFormController | null {
  const schema: AnswerSchema = options.activity.answerSchema;
  if (schema.kind === 'diagram_label') return null;

  const root = document.createElement('section');
  root.className = 'edu-visual-form';
  root.dataset['eduVisual'] = schema.kind;
  const heading = document.createElement('h3');
  heading.textContent = options.activity.stem;
  root.append(heading);

  const inputs: HTMLInputElement[] = [];
  let textarea: HTMLTextAreaElement | null = null;
  let addPairButton: HTMLButtonElement | null = null;
  const pairRows: HTMLElement[] = [];

  if (schema.kind === 'choice') {
    const fieldset = document.createElement('fieldset');
    const legend = document.createElement('legend');
    legend.textContent = schema.selection === 'single' ? '选择一个答案' : '可选择多个答案';
    fieldset.append(legend);
    for (const option of schema.options) {
      const label = document.createElement('label');
      label.className = 'edu-visual-option';
      const input = document.createElement('input');
      input.type = schema.selection === 'single' ? 'radio' : 'checkbox';
      input.name = `choice-${options.activity.id}`;
      input.value = option.id;
      const span = document.createElement('span');
      span.textContent = option.label;
      label.append(input, span);
      fieldset.append(label);
      inputs.push(input);
      if (
        options.initial?.kind === 'choice' &&
        options.initial.optionIds.includes(option.id)
      ) {
        input.checked = true;
      }
    }
    root.append(fieldset);
  }

  if (schema.kind === 'text') {
    textarea = document.createElement('textarea');
    textarea.rows = 5;
    if (schema.maxLength !== null) textarea.maxLength = schema.maxLength;
    textarea.setAttribute('aria-label', '你的回答');
    if (options.initial?.kind === 'text') textarea.value = options.initial.text;
    root.append(textarea);
    const counter = document.createElement('p');
    counter.className = 'edu-visual-counter';
    const update = (): void => {
      const max = schema.maxLength === null ? '' : ` / ${schema.maxLength}`;
      counter.textContent = `${textarea?.value.length ?? 0}${max} 字`;
    };
    textarea.addEventListener('input', update);
    update();
    root.append(counter);
  }

  if (schema.kind === 'relation') {
    const nodes = relationOptions(options, schema);
    const list = document.createElement('div');
    list.className = 'edu-visual-pairs';
    const addRow = (initial?: { fromId: string; toId: string; relation: 'prerequisite' | 'related' | null }): void => {
      const row = document.createElement('div');
      row.className = 'edu-visual-pair';
      row.append(
        select(nodes, '起点', initial?.fromId ?? nodes[0]?.id ?? ''),
        select(nodes, '终点', initial?.toId ?? nodes[1]?.id ?? ''),
        relationSelect(initial?.relation ?? null),
      );
      if (pairRows.length > 0) {
        const remove = document.createElement('button');
        remove.type = 'button';
        remove.textContent = '移除';
        remove.addEventListener('click', () => {
          row.remove();
          const index = pairRows.indexOf(row);
          if (index >= 0) pairRows.splice(index, 1);
        });
        row.append(remove);
      }
      list.append(row);
      pairRows.push(row);
    };
    addRow();
    if (options.initial?.kind === 'relation') {
      for (const pair of options.initial.pairs.slice(1)) addRow(pair);
    }
    root.append(list);
    addPairButton = document.createElement('button');
    addPairButton.type = 'button';
    addPairButton.textContent = '再加一条关系';
    addPairButton.addEventListener('click', () => addRow());
    root.append(addPairButton);
  }

  const actions = document.createElement('div');
  actions.className = 'edu-visual-actions';
  const submit = document.createElement('button');
  submit.type = 'button';
  submit.textContent = '提交作答';
  submit.addEventListener('click', () => options.onSubmit(collect()));
  actions.append(submit);
  if (options.onCancel !== undefined) {
    const cancel = document.createElement('button');
    cancel.type = 'button';
    cancel.textContent = '取消';
    cancel.addEventListener('click', () => options.onCancel?.());
    actions.append(cancel);
  }
  root.append(actions);

  function collect(): AnswerFormValue {
    if (schema.kind === 'choice') {
      return { kind: 'choice', optionIds: inputs.filter((input) => input.checked).map((input) => input.value) };
    }
    if (schema.kind === 'text') {
      return { kind: 'text', text: textarea?.value ?? '' };
    }
    const pairs: { fromId: string; toId: string; relation: 'prerequisite' | 'related' | null }[] = [];
    for (const row of pairRows) {
      const selects = [...row.querySelectorAll('select')];
      const from = selects[0]?.value ?? '';
      const to = selects[1]?.value ?? '';
      const relationValue = selects[2]?.value ?? '';
      if (from.length === 0 || to.length === 0) continue;
      pairs.push({
        fromId: from,
        toId: to,
        relation:
          relationValue === 'prerequisite' || relationValue === 'related' ? relationValue : null,
      });
    }
    return { kind: 'relation', pairs };
  }

  container.append(root);
  return {
    element: root,
    getValue: collect,
    unmount() {
      root.remove();
    },
  };
}

function relationOptions(
  options: AnswerFormOptions,
  schema: Extract<AnswerSchema, { kind: 'relation' }>,
): readonly RelationNodeOption[] {
  if (options.relationNodes !== undefined && options.relationNodes.length > 0) {
    return options.relationNodes;
  }
  const ids = new Set<string>();
  for (const pair of schema.pairs) {
    ids.add(pair.fromId);
    ids.add(pair.toId);
  }
  return [...ids].map((id) => ({ id, label: id }));
}

function select(nodes: readonly RelationNodeOption[], label: string, value: string): HTMLSelectElement {
  const element = document.createElement('select');
  element.setAttribute('aria-label', label);
  for (const node of nodes) {
    const option = document.createElement('option');
    option.value = node.id;
    option.textContent = node.label;
    option.selected = node.id === value;
    element.append(option);
  }
  return element;
}

function relationSelect(value: 'prerequisite' | 'related' | null): HTMLSelectElement {
  const element = document.createElement('select');
  element.setAttribute('aria-label', '关系类型');
  for (const [key, label] of [
    ['prerequisite', '先修（起点 → 终点）'],
    ['related', '相关'],
    ['', '不确定'],
  ] as const) {
    const option = document.createElement('option');
    option.value = key;
    option.textContent = label;
    option.selected = key === (value ?? '');
    element.append(option);
  }
  return element;
}
