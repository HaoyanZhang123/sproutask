import { EducationShell, createFixtureShellDataSource } from '../../shell/src/index.js';
import {
  createFixtureMapDataSource,
  createMapUi,
  type MapScenario,
  type MapUi,
} from '../src/index.js';
import type { MapRequest } from '../src/types.js';

export interface MountedMap {
  readonly shell: EducationShell;
  readonly container: HTMLElement;
  readonly map: MapUi;
  readonly ready: Promise<void>;
}

const tracked: MountedMap[] = [];
let requestCounter = 0;

export function makeRequest(): MapRequest {
  requestCounter += 1;
  return {
    requestId: `request.test.map.${requestCounter}`,
    learnerId: 'learner.local.default',
    now: '2026-10-29T10:00:00Z',
  };
}

export function makeContainer(): HTMLElement {
  const container = document.createElement('div');
  document.body.append(container);
  return container;
}

export function startMap(options: { readonly scenario?: MapScenario } = {}): MountedMap {
  const map = createMapUi({
    dataSource: createFixtureMapDataSource({ scenario: options.scenario }),
    createRequest: makeRequest,
  });
  const shell = new EducationShell({ data: createFixtureShellDataSource(), initialPath: '/map' });
  map.register(shell);
  const container = makeContainer();
  const ready = shell.mount(container);
  const mounted: MountedMap = { shell, container, map, ready };
  tracked.push(mounted);
  return mounted;
}

export function tick(ms = 0): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function waitFor(
  predicate: () => boolean,
  options: { readonly timeoutMs?: number } = {},
): Promise<void> {
  const deadline = Date.now() + (options.timeoutMs ?? 3000);
  while (!predicate()) {
    if (Date.now() > deadline) throw new Error('waitFor timed out');
    await tick(5);
  }
}

export async function mountMap(options: { readonly scenario?: MapScenario } = {}): Promise<MountedMap> {
  const mounted = startMap(options);
  await mounted.ready;
  await waitFor(() => mounted.container.querySelector('[data-testid="map-tree"]') !== null);
  await tick(0);
  return mounted;
}

export async function cleanupMaps(): Promise<void> {
  for (const entry of tracked.splice(0)) {
    try {
      await entry.shell.unmount();
    } catch {
      /* already unmounted */
    }
    entry.map.controller.dispose();
  }
  document.body.replaceChildren();
}

export function textOf(root: ParentNode): string {
  return (root.textContent ?? '').replace(/\s+/g, ' ').trim();
}

export function pageRoot(container: HTMLElement): HTMLElement {
  const page = container.querySelector<HTMLElement>('[data-page-id]');
  if (page === null) throw new Error('page root not found');
  return page;
}

export function buttonsOf(root: ParentNode): HTMLButtonElement[] {
  return [...root.querySelectorAll<HTMLButtonElement>('button')];
}

export function buttonByAction(root: ParentNode, action: string): HTMLButtonElement {
  const found = root.querySelector<HTMLButtonElement>(`button[data-action="${action}"]`);
  if (found === null) throw new Error(`button not found: ${action}`);
  return found;
}

export function treeItem(container: HTMLElement, tocId: string): HTMLElement {
  const found = container.querySelector<HTMLElement>(`[data-toc-id="${tocId}"]`);
  if (found === null) throw new Error(`tree item not found: ${tocId}`);
  return found;
}

export function graphNodes(container: HTMLElement): HTMLButtonElement[] {
  return [...container.querySelectorAll<HTMLButtonElement>('button.edu-map-node')];
}

export function edgesOf(container: HTMLElement): HTMLElement[] {
  return [...container.querySelectorAll<HTMLElement>('.edu-map-edge')];
}

export function dispatchKey(target: EventTarget, key: string, options: KeyboardEventInit = {}): void {
  target.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...options }));
}

export function hasPercent(text: string): boolean {
  return /\d+(?:\.\d+)?\s*%/.test(text);
}
