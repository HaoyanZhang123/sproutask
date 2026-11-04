import type { RequestContext } from '@edu/domain';
import {
  EducationShell,
  createFixtureShellDataSource,
} from '../../shell/src/index.js';
import {
  createFixtureLibraryDataSource,
  createLibraryUi,
  type FixtureLibraryDataSource,
  type LibraryDataSource,
  type LibraryScenario,
  type LibraryUi,
} from '../src/index.js';
export interface MountedLibrary {
  readonly shell: EducationShell;
  readonly container: HTMLElement;
  readonly library: LibraryUi;
  readonly data: LibraryDataSource;
  readonly ready: Promise<void>;
}

const tracked: MountedLibrary[] = [];
let requestCounter = 0;

export function makeRequest(): RequestContext {
  requestCounter += 1;
  return {
    requestId: `request.test.library.${requestCounter}`,
    learnerId: 'learner.local.default',
    now: '2026-10-29T10:00:00Z',
  };
}

export function makeContainer(): HTMLElement {
  const container = document.createElement('div');
  document.body.append(container);
  return container;
}

export function startLibrary(options: {
  readonly scenario?: LibraryScenario;
  readonly dataSource?: LibraryDataSource;
  readonly returnPath?: string | null;
} = {}): MountedLibrary {
  const data = options.dataSource ?? createFixtureLibraryDataSource({ scenario: options.scenario });
  const library = createLibraryUi({
    dataSource: data,
    createRequest: makeRequest,
    returnPath: options.returnPath ?? null,
  });
  const shell = new EducationShell({
    data: createFixtureShellDataSource(),
    initialPath: '/library',
  });
  library.register(shell);
  const container = makeContainer();
  const ready = shell.mount(container);
  const mounted: MountedLibrary = { shell, container, library, data, ready };
  tracked.push(mounted);
  return mounted;
}

/** Mounts and waits for books + the first source list to land. */
export async function mountLibrary(options: Parameters<typeof startLibrary>[0] = {}): Promise<MountedLibrary> {
  const mounted = startLibrary(options);
  await mounted.ready;
  await tick(20);
  return mounted;
}

export async function cleanupLibraries(): Promise<void> {
  for (const entry of tracked.splice(0)) {
    try {
      await entry.shell.unmount();
    } catch {
      /* already unmounted */
    }
  }
  document.body.replaceChildren();
}

export function tick(ms = 0): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function textOf(root: ParentNode): string {
  return (root.textContent ?? '').replace(/\s+/g, ' ').trim();
}

export function pageRoot(container: HTMLElement): HTMLElement {
  const page = container.querySelector<HTMLElement>('[data-page-id]');
  if (page === null) throw new Error('page root not found');
  return page;
}

export function byTestId<T extends HTMLElement = HTMLElement>(root: ParentNode, testId: string): T | null {
  return root.querySelector<T>(`[data-testid="${testId}"]`);
}

/** Same as `byTestId`, but fails loudly instead of returning null. */
export function el<T extends HTMLElement = HTMLElement>(root: ParentNode, testId: string): T {
  const found = byTestId<T>(root, testId);
  if (found === null) throw new Error(`testid not found: ${testId}`);
  return found;
}

export function chipsOf(root: ParentNode): HTMLElement[] {
  return [...root.querySelectorAll<HTMLElement>('.edu-chip')];
}

export function buttonsOf(root: ParentNode): HTMLButtonElement[] {
  return [...root.querySelectorAll<HTMLButtonElement>('button')];
}

export function buttonByAction(root: ParentNode, action: string): HTMLButtonElement {
  const found = root.querySelector<HTMLButtonElement>(`button[data-action="${action}"]`);
  if (found === null) throw new Error(`button not found: ${action}`);
  return found;
}

export function buttonByText(root: ParentNode, label: string): HTMLButtonElement {
  const found = buttonsOf(root).find((candidate) => (candidate.textContent ?? '').trim() === label);
  if (found === undefined) throw new Error(`button not found by text: ${label}`);
  return found;
}

export function inputById(root: ParentNode, id: string): HTMLInputElement {
  const input = root.querySelector<HTMLInputElement>(`#${id}`);
  if (input === null) throw new Error(`input not found: ${id}`);
  return input;
}

export function setInput(input: HTMLInputElement, value: string): void {
  input.value = value;
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

export function hasPercent(text: string): boolean {
  return /\d+(?:\.\d+)?\s*%/.test(text);
}

export function dispatchKey(target: EventTarget, key: string, options: KeyboardEventInit = {}): void {
  target.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...options }));
}

/** 换到另一本课本（先展开“换一本”，再点整行按钮）。 */
export async function switchToBook(
  container: HTMLElement,
  bookId: string,
): Promise<HTMLButtonElement> {
  const page = pageRoot(container);
  buttonByAction(page, 'switch-book').click();
  const row = page.querySelector<HTMLButtonElement>(`button[data-action="choose-book"][data-book-id="${bookId}"]`);
  if (row === null) throw new Error(`book row not found: ${bookId}`);
  row.click();
  await tick(20);
  return row;
}

/** 展开“课本原文从哪来”。 */
export function openSourcesFold(container: HTMLElement): HTMLElement {
  const page = pageRoot(container);
  buttonByAction(page, 'toggle-sources').click();
  return el(page, 'library-sources');
}
