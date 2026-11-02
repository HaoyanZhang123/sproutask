/** Accessible modal dialog (evidence detail and similar read-only content). */

import { focusableElements, h } from '../dom.js';
import { button } from './button.js';

let modalCounter = 0;

export class Modal {
  readonly element: HTMLDivElement;
  private readonly titleId: string;
  private trigger: HTMLElement | null = null;
  private isOpen = false;

  constructor(title: string, content: HTMLElement, closeLabel = '关闭') {
    modalCounter += 1;
    this.titleId = `edu-modal-title-${modalCounter}`;
    const backdrop = h('div', { class: 'edu-dialog-backdrop', hidden: true, 'data-edu-modal': 'true' });
    const dialog = h('div', {
      class: 'edu-dialog',
      role: 'dialog',
      'aria-modal': 'true',
      'aria-labelledby': this.titleId,
      tabindex: -1,
    });
    const closeButton = button(closeLabel, () => this.close(), { dataAction: 'modal-close' });
    dialog.append(
      h('h2', { class: 'edu-dialog__title', id: this.titleId }, title),
      content,
      h('div', { class: 'edu-dialog__actions' }, closeButton),
    );
    backdrop.append(dialog);
    backdrop.addEventListener('keydown', (event) => this.onKeydown(event));
    this.element = backdrop;
  }

  open(trigger: HTMLElement, parent: HTMLElement): void {
    if (this.isOpen) return;
    this.isOpen = true;
    this.trigger = trigger;
    if (this.element.parentElement !== parent) parent.append(this.element);
    this.element.removeAttribute('hidden');
    const focusable = focusableElements(this.element);
    (focusable[0] ?? this.element).focus();
  }

  close(): void {
    if (!this.isOpen) return;
    this.isOpen = false;
    this.element.setAttribute('hidden', '');
    const trigger = this.trigger;
    this.trigger = null;
    if (trigger !== null && trigger.isConnected) trigger.focus();
  }

  private onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      event.preventDefault();
      this.close();
      return;
    }
    if (event.key !== 'Tab') return;
    const focusable = focusableElements(this.element);
    if (focusable.length === 0) return;
    const first = focusable[0]!;
    const last = focusable[focusable.length - 1]!;
    const active = this.element.ownerDocument.activeElement;
    if (event.shiftKey && active === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus();
    }
  }
}
