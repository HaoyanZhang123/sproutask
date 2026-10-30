/** Native, keyboard-operable button. Every shell action is a real <button>. */

import { h } from '../dom.js';

export type ButtonTone = 'default' | 'primary' | 'danger' | 'ghost' | 'danger-ghost';

export interface ButtonOptions {
  readonly tone?: ButtonTone;
  readonly small?: boolean;
  readonly disabled?: boolean;
  readonly ariaLabel?: string;
  readonly title?: string;
  readonly dataAction?: string;
}

const TONE_CLASS: Record<ButtonTone, string> = {
  default: '',
  primary: 'edu-button--primary',
  danger: 'edu-button--danger',
  ghost: 'edu-button--ghost',
  'danger-ghost': 'edu-button--danger-ghost',
};

export function button(label: string, onClick: () => void, options: ButtonOptions = {}): HTMLButtonElement {
  const classes = ['edu-button'];
  const toneClass = TONE_CLASS[options.tone ?? 'default'];
  if (toneClass.length > 0) classes.push(toneClass);
  if (options.small === true) classes.push('edu-button--small');
  return h(
    'button',
    {
      type: 'button',
      class: classes.join(' '),
      onclick: onClick,
      disabled: options.disabled,
      'aria-label': options.ariaLabel,
      title: options.title,
      'data-action': options.dataAction,
    },
    label,
  );
}
