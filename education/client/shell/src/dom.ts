/**
 * Tiny DOM helpers. No virtual DOM, no framework, no innerHTML: every text
 * node is set through `textContent`, so student/fixture content can never be
 * interpreted as markup or script.
 */

export type DomChild = Node | string | number | null | undefined | false;

export type DomAttrValue =
  | string
  | number
  | boolean
  | null
  | undefined
  | ((event: Event) => void)
  | Readonly<Record<string, string>>;

export interface DomAttrs {
  readonly [name: string]: DomAttrValue;
}

export function appendChildren(parent: Node, children: readonly DomChild[]): void {
  const doc = parent.ownerDocument ?? globalThis.document;
  for (const child of children) {
    if (child === null || child === undefined || child === false) continue;
    if (typeof child === 'string' || typeof child === 'number') {
      parent.appendChild(doc.createTextNode(String(child)));
    } else {
      parent.appendChild(child);
    }
  }
}

/**
 * Creates an element. `class`, `text` and `dataset` are convenience keys; other
 * keys become attributes. `on*` keys take a function and are never serialized.
 */
export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: DomAttrs = {},
  ...children: readonly DomChild[]
): HTMLElementTagNameMap[K] {
  const doc = globalThis.document;
  const element = doc.createElement(tag);
  for (const [name, rawValue] of Object.entries(attrs)) {
    if (rawValue === null || rawValue === undefined || rawValue === false) continue;
    if (name === 'class') {
      element.className = String(rawValue);
      continue;
    }
    if (name === 'text') {
      element.textContent = String(rawValue);
      continue;
    }
    if (name === 'dataset') {
      for (const [key, value] of Object.entries(rawValue as Readonly<Record<string, string>>)) {
        element.dataset[key] = value;
      }
      continue;
    }
    if (name.startsWith('on') && typeof rawValue === 'function') {
      const eventName = name.slice(2).toLowerCase();
      element.addEventListener(eventName, rawValue as EventListener);
      continue;
    }    if (rawValue === true) {
      element.setAttribute(name, '');
      continue;
    }
    element.setAttribute(name, String(rawValue));
  }
  appendChildren(element, children);
  return element;
}

export function clear(node: Element): void {
  node.replaceChildren();
}

export function text(tag: keyof HTMLElementTagNameMap, value: string, attrs: DomAttrs = {}): HTMLElement {
  const element = h(tag, attrs);
  element.textContent = value;
  return element;
}

export function idFrom(value: string, prefix = 'edu'): string {
  const safe = value.replace(/[^A-Za-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '');
  return `${prefix}-${safe.length > 0 ? safe : 'x'}`;
}

export function isElement(value: unknown): value is HTMLElement {
  return typeof value === 'object' && value !== null && (value as Node).nodeType === 1;
}

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

export function focusableElements(root: ParentNode): HTMLElement[] {
  return [...root.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)].filter((element) => {
    if (element.hasAttribute('hidden')) return false;
    if (element.getAttribute('aria-hidden') === 'true') return false;
    let ancestor: HTMLElement | null = element;
    while (ancestor !== null) {
      if (ancestor.hasAttribute('hidden')) return false;
      ancestor = ancestor.parentElement;
    }
    return true;
  });
}

export function focusFirst(root: ParentNode): HTMLElement | null {
  const first = focusableElements(root)[0] ?? null;
  first?.focus();
  return first;
}

/** Small helper for tests that need to emulate a browser's native button activation. */
export function activate(element: HTMLElement): void {
  if (element instanceof globalThis.HTMLButtonElement) {
    element.click();
    return;
  }
  element.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
}

export function setHidden(element: HTMLElement, hidden: boolean): void {
  if (hidden) element.setAttribute('hidden', '');
  else element.removeAttribute('hidden');
}
