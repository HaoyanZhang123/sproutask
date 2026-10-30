/**
 * Modal confirmation dialog.
 *
 * Used for export/delete: the impact is always spelled out before the student
 * can confirm, destructive actions additionally require an explicit
 * acknowledgement checkbox, Escape cancels, focus is trapped while open and
 * restored to the trigger on close.
 */

import { focusableElements, h, clear } from '../dom.js';
import { button } from './button.js';

let dialogCounter = 0;

export interface ConfirmDialogOptions {
  readonly title: string;
  readonly impact: readonly string[];
  readonly confirmLabel: string;
  readonly cancelLabel?: string;
  readonly tone?: 'default' | 'danger';
  readonly acknowledgement?: string;
  readonly onConfirm: () => void;
  readonly onCancel?: () => void;
}

export class ConfirmDialog {
  readonly element: HTMLDivElement;
  private readonly options: ConfirmDialogOptions;
  private readonly titleId: string;
  private readonly cancelButton: HTMLButtonElement;
  private readonly confirmButton: HTMLButtonElement;
  private trigger: HTMLElement | null = null;
  private isOpen = false;

  constructor(options: ConfirmDialogOptions) {
    this.options = options;
    dialogCounter += 1;
    this.titleId = `edu-dialog-title-${dialogCounter}`;

    const backdrop = h('div', {
      class: 'edu-dialog-backdrop',
      hidden: true,
      'data-edu-dialog': options.tone === 'danger' ? 'danger' : 'default',
    });
    const dialog = h('div', {
      class: 'edu-dialog',
      role: 'dialog',
      'aria-modal': 'true',
      'aria-labelledby': this.titleId,
      tabindex: -1,
    });
    dialog.append(
      h('h2', { class: 'edu-dialog__title', id: this.titleId }, options.title),
      h(
        'ul',
        { class: 'edu-dialog__impact' },
        ...options.impact.map((line) => h('li', {}, line)),
      ),
    );

    if (options.acknowledgement !== undefined) {
      const checkboxId = `${this.titleId}-ack`;
      const checkbox = h('input', { type: 'checkbox', id: checkboxId });
      dialog.append(
        h(
          'label',
          { class: 'edu-checkbox', for: checkboxId },
          checkbox,
          h('span', {}, options.acknowledgement),
        ),
      );
      this.confirmButton = button(options.confirmLabel, () => this.confirm(), {
        tone: options.tone === 'danger' ? 'danger' : 'primary',
        disabled: true,
        dataAction: 'confirm',
      });
      checkbox.addEventListener('change', () => {
        this.confirmButton.disabled = !checkbox.checked;
      });
    } else {
      this.confirmButton = button(options.confirmLabel, () => this.confirm(), {
        tone: options.tone === 'danger' ? 'danger' : 'primary',
        dataAction: 'confirm',
      });
    }

    this.cancelButton = button(options.cancelLabel ?? '取消', () => this.close(true), {
      dataAction: 'cancel',
    });
    dialog.append(h('div', { class: 'edu-dialog__actions' }, this.cancelButton, this.confirmButton));
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
    this.cancelButton.focus();
  }

  close(restoreFocus: boolean): void {
    if (!this.isOpen) return;
    this.isOpen = false;
    this.element.setAttribute('hidden', '');
    const trigger = this.trigger;
    this.trigger = null;
    if (restoreFocus && trigger !== null && trigger.isConnected) trigger.focus();
  }

  cancel(): void {
    if (!this.isOpen) return;
    this.close(true);
    this.options.onCancel?.();
  }

  confirm(): void {
    if (!this.isOpen || this.confirmButton.disabled) return;
    this.close(false);
    this.options.onConfirm();
  }

  get openState(): boolean {
    return this.isOpen;
  }

  private onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      event.preventDefault();
      this.cancel();
      return;
    }
    if (event.key !== 'Tab') return;
    const focusable = focusableElements(this.element);
    if (focusable.length === 0) return;
    const first = focusable[0]!;
    const last = focusable[focusable.length - 1]!;
    const active = this.element.ownerDocument.activeElement;
    if (event.shiftKey && (active === first || active === null)) {
      event.preventDefault();
      last.focus();
      return;
    }
    if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus();
    }
  }
}

/** Small helper for the "copy text" fallback in save-failure states. */
export function copyTextFallback(value: string): 'copied' | 'manual' {
  try {
    const clipboard = globalThis.navigator.clipboard;
    if (clipboard !== undefined && typeof clipboard.writeText === 'function') {
      void clipboard.writeText(value).catch(() => undefined);
      return 'copied';
    }
  } catch {
    return 'manual';
  }
  return 'manual';
}

/** Clears and re-appends a dialog into a container (used by re-rendered pages). */
export function resetDialogContainer(container: HTMLElement): void {
  clear(container);
}
