import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { Activity } from '@edu/domain';

import { mountAnswerForm, supportsAnswerForm } from '../src/answer-forms.js';

function activity(overrides: Partial<Activity> & Pick<Activity, 'answerSchema'>): Activity {
  return {
    schemaVersion: 1,
    id: 'activity.test',
    version: '1',
    courseEditionId: 'course.biology-7a',
    conceptIds: ['concept.cell'],
    type: 'choice',
    stem: '下列哪一项是细胞的基本结构？',
    sourceRefs: ['source.p18'],
    renderSpec: null,
    rubricId: 'rubric.cell',
    rubricVersion: '1',
    answerDisclosurePolicy: 'after_independent_attempt',
    ...overrides,
  };
}

describe('answer forms (A21 text/choice/relation paths)', () => {
  let container: HTMLElement;
  beforeEach(() => {
    document.body.innerHTML = '';
    container = document.createElement('div');
    document.body.append(container);
  });

  it('collects a single choice answer and reports keyboard-friendly controls', () => {
    const submit = vi.fn();
    const form = mountAnswerForm(container, {
      activity: activity({
        answerSchema: {
          kind: 'choice',
          selection: 'single',
          options: [
            { id: 'option.a', label: '细胞核' },
            { id: 'option.b', label: '书本' },
          ],
          correctOptionIds: ['option.a'],
        },
      }),
      onSubmit: submit,
    });
    expect(form).not.toBeNull();
    const radios = container.querySelectorAll<HTMLInputElement>('input[type="radio"]');
    expect(radios).toHaveLength(2);
    radios[0].checked = true;
    (container.querySelector('.edu-visual-actions button') as HTMLButtonElement).click();
    expect(submit).toHaveBeenCalledWith({ kind: 'choice', optionIds: ['option.a'] });
    form?.unmount();
    expect(container.querySelector('section')).toBeNull();
  });

  it('supports multiple selection and text answers with a max length', () => {
    const multi = mountAnswerForm(container, {
      activity: activity({
        type: 'choice',
        answerSchema: {
          kind: 'choice',
          selection: 'multiple',
          options: [
            { id: 'a', label: 'A' },
            { id: 'b', label: 'B' },
          ],
          correctOptionIds: ['a', 'b'],
        },
      }),
      onSubmit: () => undefined,
    });
    const checkboxes = container.querySelectorAll<HTMLInputElement>('input[type="checkbox"]');
    checkboxes[0].checked = true;
    checkboxes[1].checked = true;
    expect(multi?.getValue()).toEqual({ kind: 'choice', optionIds: ['a', 'b'] });
    multi?.unmount();

    const text = mountAnswerForm(container, {
      activity: activity({ type: 'explain', answerSchema: { kind: 'text', maxLength: 20 } }),
      onSubmit: () => undefined,
    });
    const textarea = container.querySelector<HTMLTextAreaElement>('textarea');
    expect(textarea).not.toBeNull();
    expect(textarea?.maxLength).toBe(20);
    if (textarea !== null) {
      textarea.value = '观察要有目的有计划';
      textarea.dispatchEvent(new Event('input'));
    }
    expect(text?.getValue()).toEqual({ kind: 'text', text: '观察要有目的有计划' });
    expect(container.textContent).toContain('20 字');
    text?.unmount();
  });

  it('collects relation pairs with an optional relation kind', () => {
    const submit = vi.fn();
    const form = mountAnswerForm(container, {
      activity: activity({
        type: 'relation',
        answerSchema: {
          kind: 'relation',
          pairs: [
            { fromId: 'concept.cell', toId: 'concept.cell-structure' },
            { fromId: 'concept.cell-structure', toId: 'concept.cell-division' },
          ],
        },
      }),
      relationNodes: [
        { id: 'concept.cell', label: '细胞' },
        { id: 'concept.cell-structure', label: '细胞结构' },
        { id: 'concept.cell-division', label: '细胞分裂' },
      ],
      onSubmit: submit,
    });
    const selects = container.querySelectorAll<HTMLSelectElement>('select');
    expect(selects.length).toBeGreaterThanOrEqual(3);
    selects[0].value = 'concept.cell';
    selects[1].value = 'concept.cell-structure';
    selects[2].value = 'prerequisite';
    (container.querySelector('.edu-visual-actions button') as HTMLButtonElement).click();
    expect(submit).toHaveBeenCalledWith({
      kind: 'relation',
      pairs: [{ fromId: 'concept.cell', toId: 'concept.cell-structure', relation: 'prerequisite' }],
    });
    form?.unmount();
  });

  it('routes diagram activities to the diagram view instead of a generic form', () => {
    const diagramActivity = activity({
      type: 'diagram_label',
      answerSchema: { kind: 'diagram_label', targets: [{ id: 'target.nucleus', label: '细胞核' }] },
    });
    expect(supportsAnswerForm(diagramActivity)).toBe(false);
    expect(mountAnswerForm(container, { activity: diagramActivity, onSubmit: () => undefined })).toBeNull();
    expect(container.querySelector('section')).toBeNull();

    const textActivity = activity({ type: 'explain', answerSchema: { kind: 'text', maxLength: null } });
    expect(supportsAnswerForm(textActivity)).toBe(true);
  });
});
