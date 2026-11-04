import { EducationShell, createFixtureShellDataSource } from '../../shell/src/index.js';
import {
  createFixtureMapDataSource,
  createMapUi,
  type MapDataSource,
  type MapScenario,
  type MapUi,
  type MapPayload,
} from '../src/index.js';
import type { MapRequest } from '../src/types.js';

export interface MountedMap {
  readonly shell: EducationShell;
  readonly container: HTMLElement;
  readonly map: MapUi;
  readonly ready: Promise<void>;
}

export interface StartMapOptions {
  readonly scenario?: MapScenario;
  readonly viewportWidth?: number;
  readonly dataSource?: MapDataSource;
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

export function startMap(options: StartMapOptions = {}): MountedMap {
  const map = createMapUi({
    dataSource: options.dataSource ?? createFixtureMapDataSource({ scenario: options.scenario }),
    createRequest: makeRequest,
    viewportWidth: options.viewportWidth ?? 1440,
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

export async function mountMap(options: StartMapOptions = {}): Promise<MountedMap> {
  const mounted = startMap(options);
  await mounted.ready;
  await waitFor(() => mounted.container.querySelector('[data-testid="map-overview"]') !== null);
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

export function buttonsOf(root: ParentNode): HTMLButtonElement[] {
  return [...root.querySelectorAll<HTMLButtonElement>('button')];
}

export function buttonByAction(root: ParentNode, action: string): HTMLButtonElement {
  const found = root.querySelector<HTMLButtonElement>(`button[data-action="${action}"]`);
  if (found === null) throw new Error(`button not found: ${action}`);
  return found;
}

export function buttonByView(root: ParentNode, mode: string): HTMLButtonElement {
  const found = root.querySelector<HTMLButtonElement>(`button[data-view-mode="${mode}"]`);
  if (found === null) throw new Error(`view toggle not found: ${mode}`);
  return found;
}

export function chapterRow(container: HTMLElement, chapterId: string): HTMLElement {
  const found = container.querySelector<HTMLElement>(`.edu-map-chapter[data-chapter-id="${chapterId}"]`);
  if (found === null) throw new Error(`chapter row not found: ${chapterId}`);
  return found;
}

export function chapterButton(container: HTMLElement, chapterId: string): HTMLButtonElement {
  const found = container.querySelector<HTMLButtonElement>(
    `button[data-action="open-chapter"][data-chapter-id="${chapterId}"]`,
  );
  if (found === null) throw new Error(`chapter button not found: ${chapterId}`);
  return found;
}

export async function openChapter(container: HTMLElement, chapterId: string): Promise<void> {
  chapterButton(container, chapterId).click();
  await tick(5);
}

export function graphNodes(container: HTMLElement): HTMLButtonElement[] {
  return [...container.querySelectorAll<HTMLButtonElement>('button.edu-map-node')];
}

export function graphEdges(container: HTMLElement): SVGElement[] {
  return [...container.querySelectorAll<SVGElement>('.edu-map-edge')];
}

export function listNodes(container: HTMLElement): HTMLButtonElement[] {
  return [
    ...container.querySelectorAll<HTMLButtonElement>(
      '[data-testid="map-graph-list"] button.edu-map-nested__button',
    ),
  ];
}

export function detailRoot(container: HTMLElement): HTMLElement | null {
  return container.querySelector<HTMLElement>('[data-testid="map-detail"]');
}

export function detailConceptId(container: HTMLElement): string | null {
  return detailRoot(container)?.getAttribute('data-concept-id') ?? null;
}

export async function waitForDetail(container: HTMLElement, conceptId: string): Promise<HTMLElement> {
  await waitFor(
    () =>
      container.querySelector(
        `[data-testid="map-detail"][data-concept-id="${conceptId}"]`,
      ) !== null,
  );
  return container.querySelector<HTMLElement>(
    `[data-testid="map-detail"][data-concept-id="${conceptId}"]`,
  ) as HTMLElement;
}

export async function openConcept(
  container: HTMLElement,
  chapterId: string,
  conceptId: string,
): Promise<HTMLElement> {
  if (container.querySelector(`button[data-action="back-overview"]`) === null) {
    await openChapter(container, chapterId);
  }
  container.querySelector<HTMLButtonElement>(`button.edu-map-node[data-concept-id="${conceptId}"]`)?.click();
  return waitForDetail(container, conceptId);
}

export function dispatchKey(target: EventTarget, key: string, options: KeyboardEventInit = {}): void {
  target.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...options }));
}

export function hasPercent(text: string): boolean {
  return /\d+(?:\.\d+)?\s*%/.test(text);
}

/** Override parts of the demo read model while keeping the fixture seam. */
export function sourceWithPayload(overrides: Partial<MapPayload>): MapDataSource {
  const base = createFixtureMapDataSource();
  return {
    kind: 'fixture',
    notice: null,
    async loadMap(request) {
      const result = await base.loadMap(request);
      if (!result.ok) return result;
      return { ...result, data: { ...result.data, ...overrides } };
    },
    loadChapterGraph: (request, tocNodeId, options) => base.loadChapterGraph(request, tocNodeId, options),
    expandConcept: (request, conceptId, options) => base.expandConcept(request, conceptId, options),
    searchConcepts: (request, query, limit) => base.searchConcepts(request, query, limit),
    loadConceptDetail: (request, conceptId) => base.loadConceptDetail(request, conceptId),
  };
}

/** A failing source that can be switched to a working one for the retry test. */
export function flakySource(fallback: MapDataSource): MapDataSource {
  let attempts = 0;
  return {
    kind: 'fixture',
    notice: null,
    async loadMap(request) {
      attempts += 1;
      if (attempts === 1) {
        return {
          ok: false,
          error: { code: 'UNAVAILABLE', message: '地图暂时打不开', retryable: true },
        };
      }
      return fallback.loadMap(request);
    },
    loadChapterGraph: (request, tocNodeId, options) => fallback.loadChapterGraph(request, tocNodeId, options),
    expandConcept: (request, conceptId, options) => fallback.expandConcept(request, conceptId, options),
    searchConcepts: (request, query, limit) => fallback.searchConcepts(request, query, limit),
    loadConceptDetail: (request, conceptId) => fallback.loadConceptDetail(request, conceptId),
  };
}
