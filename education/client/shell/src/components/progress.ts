/**
 * Text-first progress summary.
 *
 * A native <progress> element plus a visible "current / total" label. It never
 * renders a mastery percentage and is exported for other client packages
 * (library import progress, study completion, etc.).
 */

import { h } from '../dom.js';

export interface ProgressSummaryInput {
  readonly label: string;
  readonly current: number;
  readonly total: number;
  readonly note?: string;
  readonly testId?: string;
}

export function progressSummary(input: ProgressSummaryInput): HTMLElement {
  const total = Math.max(0, Math.floor(input.total));
  const current = Math.max(0, Math.min(Math.floor(input.current), total));
  return h(
    'div',
    { class: 'edu-progress', 'data-testid': input.testId ?? 'edu-progress' },
    h(
      'div',
      { class: 'edu-progress__head' },
      h('span', { class: 'edu-progress__label' }, input.label),
      h('span', { class: 'edu-progress__value' }, `${current} / ${total}`),
    ),
    h('progress', {
      class: 'edu-progress__bar',
      value: current,
      max: total,
      'aria-label': input.label,
    }),
    input.note !== undefined ? h('p', { class: 'edu-progress__note' }, input.note) : null,
  );
}
