import { EducationShell, type EducationShellOptions } from '../src/index.js';
import {
  createFixtureShellDataSource,
  type FixtureScenario,
} from '../src/data/fixture-data.js';

export interface MountedShell {
  readonly shell: EducationShell;
  readonly container: HTMLElement;
  readonly ready: Promise<void>;
}

const tracked: MountedShell[] = [];

export function makeContainer(): HTMLElement {
  const container = document.createElement('div');
  document.body.append(container);
  return container;
}

export function fixtureOptions(
  scenario: FixtureScenario = 'ready',
  initialPath = '/home',
  extra: Partial<EducationShellOptions> = {},
): EducationShellOptions {
  return {
    data: createFixtureShellDataSource({ scenario }),
    initialPath,
    ...extra,
  };
}

export function startShell(options: EducationShellOptions): MountedShell {
  const container = makeContainer();
  const shell = new EducationShell(options);
  const ready = shell.mount(container);
  const mounted: MountedShell = { shell, container, ready };
  tracked.push(mounted);
  return mounted;
}

export async function mountShell(options: EducationShellOptions): Promise<MountedShell> {
  const mounted = startShell(options);
  await mounted.ready;
  return mounted;
}

export async function cleanupShells(): Promise<void> {
  for (const entry of tracked.splice(0)) {
    try {
      await entry.shell.unmount();
    } catch {
      /* already disposed */
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

export function pageRoot(container: HTMLElement): HTMLElement {
  const page = container.querySelector<HTMLElement>('[data-page-id]');
  if (page === null) throw new Error('page root not found');
  return page;
}

export function hasPercent(text: string): boolean {
  return /\d+(?:\.\d+)?\s*%/.test(text);
}

export function dispatchKey(target: EventTarget, key: string, options: KeyboardEventInit = {}): void {
  target.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...options }));
}

/** happy-dom does not implement native button activation, so tests emulate Enter after asserting semantics. */
export function pressEnter(target: HTMLElement): void {
  dispatchKey(target, 'Enter');
  target.click();
}

export function bodyTextExcludingStyle(): string {
  const clone = document.body.cloneNode(true) as HTMLElement;
  clone.querySelectorAll('style, script').forEach((node) => node.remove());
  return textOf(clone);
}
