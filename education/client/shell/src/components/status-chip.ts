/** Status chip: token colour + an always-visible text label. */

import { h } from '../dom.js';
import type { StatusTone } from '../tokens.js';

export interface StatusChipOptions {
  readonly detail?: string;
  readonly testId?: string;
}

export function statusChip(label: string, tone: StatusTone = 'neutral', options: StatusChipOptions = {}): HTMLElement {
  return h(
    'span',
    {
      class: 'edu-chip',
      'data-tone': tone,
      'data-status-label': label,
      'data-testid': options.testId,
      title: options.detail,
    },
    h('span', { class: 'edu-chip__dot', 'aria-hidden': 'true' }),
    h('span', {}, label),
  );
}
