/**
 * Map controller for the two-level knowledge map.
 *
 * State: overview (whole volume) ⇄ one chapter. It owns view state, loads read
 * models through `MapDataSource` and renders the two shell panels
 * (`map:content`, `map:details`). It is strictly read-only: browsing, searching
 * and opening a concept never write learning state. 开始学习 / 先复习 only
 * navigate; the workspace owns mutating flows.
 */

import type { ServiceError } from '@edu/domain';
import {
  DESIGN_TOKENS,
  clear,
  h,
  loadingState,
  renderErrorBanner,
  type EducationPageContext,
} from '../../shell/src/index.js';
import {
  createMapModel,
  resumeTarget,
  type MapChapter,
  type MapModel,
  type MapViewMode,
} from './model.js';
import {
  renderChapterGraph,
  renderChapterHeader,
  renderChapterList,
  renderDetail,
  renderDetailPrompt,
  renderFixtureNotice,
  renderOverview,
  renderPackBadges,
  type MapActions,
} from './views.js';
import type {
  ConceptDetail,
  MapDataSource,
  MapPayload,
  MapRequest,
} from './types.js';

export interface MapControllerOptions {
  readonly dataSource: MapDataSource;
  readonly createRequest: () => MapRequest;
  /** Optional fixed viewport width (tests); defaults to the real window. */
  readonly viewportWidth?: number;
}

export interface MapTimings {
  readonly mapLoadMs: number;
  readonly firstRenderMs: number;
  readonly lastGraphLoadMs: number;
  readonly lastRenderMs: number;
  readonly chapterSwitchMs: number | null;
}

type LoadState = 'idle' | 'loading' | 'ready' | 'error';
type MapLevel = 'overview' | 'chapter';
type PendingFocus = 'chapter-title' | `concept:${string}` | `chapter-row:${string}`;

function nowMs(): number {
  const perf = (globalThis as { performance?: { now?: () => number } }).performance;
  if (perf !== undefined && typeof perf.now === 'function') return perf.now();
  return Date.now();
}

function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function viewportFromWindow(): number {
  const width = (globalThis as { innerWidth?: number }).innerWidth;
  return typeof width === 'number' && Number.isFinite(width) && width > 0
    ? width
    : DESIGN_TOKENS.breakpoints.wide;
}

export class MapController {
  private readonly dataSource: MapDataSource;
  private readonly createRequest: () => MapRequest;

  private context: EducationPageContext | null = null;
  private contentHost: HTMLElement | null = null;
  private detailsHost: HTMLElement | null = null;

  private payload: MapPayload | null = null;
  private model: MapModel | null = null;
  private loadState: LoadState = 'idle';
  private error: ServiceError | null = null;

  private level: MapLevel = 'overview';
  private chapterId: string | null = null;
  private selectedConceptId: string | null = null;
  private viewMode: MapViewMode = 'graph';
  private query = '';
  private notice: string | null = null;

  private detail: ConceptDetail | null = null;
  private detailError: ServiceError | null = null;

  private viewportWidth: number;
  private resizeBound = false;
  private pendingFocus: PendingFocus | null = null;

  private loadPromise: Promise<void> | null = null;
  private disposed = false;

  private readonly actions: MapActions;
  private timings: MapTimings = {
    mapLoadMs: 0,
    firstRenderMs: 0,
    lastGraphLoadMs: 0,
    lastRenderMs: 0,
    chapterSwitchMs: null,
  };

  constructor(options: MapControllerOptions) {
    this.dataSource = options.dataSource;
    this.createRequest = options.createRequest;
    this.viewportWidth = options.viewportWidth ?? viewportFromWindow();
    this.actions = {
      openChapter: (chapterId) => this.openChapter(chapterId),
      backToOverview: () => this.backToOverview(),
      selectConcept: (conceptId) => void this.selectConcept(conceptId),
      setViewMode: (mode) => {
        this.viewMode = mode;
        this.render();
      },
      setQuery: (value) => {
        this.query = value;
        this.notice = null;
        this.render();
      },
      clearSearch: () => {
        this.query = '';
        this.render();
      },
      resume: () => void this.resume(),
      navigate: (path) => {
        if (this.context !== null) this.context.navigate(path);
      },
      retry: () => this.retry(),
    };
  }

  getTimings(): MapTimings {
    return this.timings;
  }

  /* ------------------------------------------------------------- mounting */

  onPageMount(context: EducationPageContext): void {
    this.context = context;
    this.disposed = false;
    void this.ensureLoaded();
  }

  onPageUnmount(): void {
    this.unmountContent();
    this.unmountDetails();
  }

  dispose(): void {
    this.disposed = true;
    this.unmountContent();
    this.unmountDetails();
  }

  mountContent(host: HTMLElement): void {
    this.contentHost = host;
    host.addEventListener('keydown', this.onKeyDown);
    this.bindResize(host.ownerDocument);
    void this.ensureLoaded();
    this.render();
  }

  unmountContent(): void {
    if (this.contentHost !== null) {
      this.contentHost.removeEventListener('keydown', this.onKeyDown);
      this.unbindResize(this.contentHost.ownerDocument);
    }
    this.contentHost = null;
  }

  mountDetails(host: HTMLElement): void {
    this.detailsHost = host;
    void this.ensureLoaded();
    this.render();
  }

  unmountDetails(): void {
    this.detailsHost = null;
  }

  /* ---------------------------------------------------------- data loading */

  private async ensureLoaded(): Promise<void> {
    // `error` waits for the explicit retry action, never for the next mount.
    if (this.payload !== null || this.loadState === 'loading' || this.loadState === 'error') return;
    if (this.loadPromise !== null) return this.loadPromise;
    this.loadState = 'loading';
    this.render();
    this.loadPromise = this.load();
    await this.loadPromise;
    this.loadPromise = null;
  }

  private async load(): Promise<void> {
    const started = nowMs();
    const result = await this.dataSource.loadMap(this.createRequest());
    if (this.disposed) return;
    if (!result.ok) {
      this.loadState = 'error';
      this.error = result.error;
      this.render();
      return;
    }
    const firstRender = nowMs();
    this.timings = { ...this.timings, mapLoadMs: round(firstRender - started) };
    this.payload = result.data;
    this.model = createMapModel(result.data);
    this.loadState = 'ready';
    this.error = null;
    this.render();
    this.timings = { ...this.timings, firstRenderMs: round(nowMs() - firstRender) };
  }

  private async loadDetail(conceptId: string): Promise<void> {
    const result = await this.dataSource.loadConceptDetail(this.createRequest(), conceptId);
    if (this.disposed) return;
    if (result.ok) {
      this.detail = result.data;
      this.detailError = null;
    } else {
      this.detail = null;
      this.detailError = result.error;
    }
  }

  /* -------------------------------------------------------------- commands */

  private openChapter(chapterId: string): void {
    const model = this.model;
    if (model === null) return;
    const chapter = model.chapter(chapterId);
    if (chapter === null) return;
    const changed = chapterId !== this.chapterId;
    this.level = 'chapter';
    this.chapterId = chapterId;
    this.notice = null;
    this.query = '';
    if (changed) {
      this.selectedConceptId = null;
      this.detail = null;
      this.detailError = null;
    }
    this.pendingFocus = 'chapter-title';
    const started = nowMs();
    this.render();
    const elapsed = round(nowMs() - started);
    this.timings = { ...this.timings, lastGraphLoadMs: elapsed, chapterSwitchMs: elapsed };
  }

  private backToOverview(): void {
    const previous = this.chapterId;
    this.level = 'overview';
    this.selectedConceptId = null;
    this.detail = null;
    this.detailError = null;
    this.notice = null;
    this.pendingFocus = previous === null ? null : `chapter-row:${previous}`;
    this.render();
  }

  private async selectConcept(conceptId: string): Promise<void> {
    const model = this.model;
    if (model === null) return;
    if (!model.payload.concepts.some((concept) => concept.id === conceptId)) return;
    const chapter = model.chapterOfConcept(conceptId);
    const chapterId = chapter?.id ?? this.chapterId;
    if (chapterId === null) return;
    const changed = chapterId !== this.chapterId;
    this.level = 'chapter';
    this.chapterId = chapterId;
    this.selectedConceptId = conceptId;
    this.notice = null;
    this.query = '';
    if (changed) {
      this.detail = null;
      this.detailError = null;
    }
    await this.loadDetail(conceptId);
    this.pendingFocus = `concept:${conceptId}`;
    this.render();
  }

  private async resume(): Promise<void> {
    const model = this.model;
    if (model === null) return;
    const target = resumeTarget(model.payload, model.toc);
    if (target === null) {
      this.level = 'overview';
      this.notice = '这本教材还没有可以继续学的概念，先点一章开始吧。';
      this.render();
      return;
    }
    if (target.conceptId !== null) {
      await this.selectConcept(target.conceptId);
      return;
    }
    this.openChapter(target.chapterId);
    this.notice = '还没有正在学的概念，先看看这一章。';
    this.render();
  }

  private retry(): void {
    this.payload = null;
    this.model = null;
    this.loadState = 'idle';
    this.error = null;
    this.chapterId = null;
    this.selectedConceptId = null;
    this.detail = null;
    this.detailError = null;
    this.level = 'overview';
    this.notice = null;
    void this.ensureLoaded();
  }

  /* ------------------------------------------------------------- keyboard */

  private readonly onKeyDown = (event: Event): void => {
    const keyboard = event as KeyboardEvent;
    if (keyboard.key !== 'Escape') return;
    if (this.level === 'chapter') {
      keyboard.preventDefault();
      this.backToOverview();
      return;
    }
    if (this.query.length > 0) {
      keyboard.preventDefault();
      this.query = '';
      this.render();
    }
  };

  private bindResize(doc: Document): void {
    if (this.resizeBound) return;
    const view = doc.defaultView;
    if (view === null) return;
    view.addEventListener('resize', this.onResize);
    this.resizeBound = true;
  }

  private unbindResize(doc: Document): void {
    if (!this.resizeBound) return;
    doc.defaultView?.removeEventListener('resize', this.onResize);
    this.resizeBound = false;
  }

  private readonly onResize = (): void => {
    const next = viewportFromWindow();
    if (next === this.viewportWidth) return;
    this.viewportWidth = next;
    this.render();
  };

  /* ----------------------------------------------------------------- render */

  private render(): void {
    if (this.disposed) return;
    const started = nowMs();
    const searchFocused = this.isSearchFocused();
    if (this.contentHost !== null) this.renderContent(this.contentHost);
    if (this.detailsHost !== null) this.renderDetails(this.detailsHost);
    this.timings = { ...this.timings, lastRenderMs: round(nowMs() - started) };
    if (searchFocused) this.restoreSearchFocus();
    this.applyPendingFocus();
  }

  private renderContent(host: HTMLElement): void {
    clear(host);
    if (this.loadState === 'loading') {
      host.append(
        loadingState({
          title: '正在打开知识地图…',
          body: '只读取已保存的目录和记录；浏览不会改变你的学习进度。',
        }),
      );
      return;
    }
    if (this.loadState === 'error') {
      host.append(
        renderErrorBanner(
          this.error ?? { code: 'UNAVAILABLE', message: '知识地图暂时打不开', retryable: true },
          {
            onRetry: () => this.actions.retry(),
            onBack: () => this.actions.navigate('/library'),
            backLabel: '去我的课本',
          },
        ),
      );
      return;
    }
    const model = this.model;
    if (model === null) return;
    const fixture = renderFixtureNotice(model.payload);
    if (fixture !== null) host.append(fixture);
    host.append(renderPackBadges(model.payload));
    if (this.notice !== null) {
      host.append(
        h(
          'p',
          { class: 'edu-map-notice', role: 'status', 'data-testid': 'map-notice' },
          this.notice,
        ),
      );
    }
    if (this.level === 'overview') {
      host.append(renderOverview(model.filterOverview(this.query), model, this.actions));
      return;
    }
    const chapter = this.chapterId === null ? null : model.chapter(this.chapterId);
    if (chapter === null) {
      this.level = 'overview';
      host.append(renderOverview(model.filterOverview(this.query), model, this.actions));
      return;
    }
    host.append(renderChapterHeader(chapter, this.viewMode, this.actions));
    if (this.viewMode === 'list') {
      host.append(renderChapterList(chapter, this.selectedConceptId, model, this.actions));
    } else {
      host.append(
        renderChapterGraph(
          chapter,
          this.selectedConceptId,
          this.viewportWidth < DESIGN_TOKENS.breakpoints.compact,
          model,
          this.actions,
        ),
      );
    }
  }

  private renderDetails(host: HTMLElement): void {
    clear(host);
    if (this.level !== 'chapter') return;
    const model = this.model;
    if (model === null) return;
    const chapter: MapChapter | null = this.chapterId === null ? null : model.chapter(this.chapterId);
    if (this.detail !== null) {
      host.append(renderDetail(this.detail, model, chapter, this.actions));
      return;
    }
    if (this.detailError !== null) {
      host.append(
        h(
          'p',
          { class: 'edu-map-notice', role: 'alert', 'data-testid': 'map-detail-error' },
          '这个概念详情暂时打不开；关系图和列表仍然可以用。',
        ),
      );
    }
    host.append(renderDetailPrompt(chapter));
  }

  private isSearchFocused(): boolean {
    if (this.contentHost === null) return false;
    const active = this.contentHost.ownerDocument.activeElement;
    return (
      active instanceof HTMLElement &&
      active.getAttribute('data-testid') === 'map-search-input'
    );
  }

  private restoreSearchFocus(): void {
    if (this.contentHost === null) return;
    const input = this.contentHost.querySelector<HTMLInputElement>('[data-testid="map-search-input"]');
    if (input === null) return;
    input.focus();
    const end = input.value.length;
    try {
      input.setSelectionRange(end, end);
    } catch {
      /* some environments do not implement selection on search inputs */
    }
  }

  private findInHosts(selector: string): HTMLElement | null {
    for (const host of [this.contentHost, this.detailsHost]) {
      const found = host?.querySelector<HTMLElement>(selector) ?? null;
      if (found !== null) return found;
    }
    return null;
  }

  private applyPendingFocus(): void {
    const target = this.pendingFocus;
    if (target === null) return;
    this.pendingFocus = null;
    if (target === 'chapter-title') {
      this.findInHosts('[data-testid="map-chapter-title"]')?.focus();
      return;
    }
    if (target.startsWith('chapter-row:')) {
      const id = target.slice('chapter-row:'.length);
      this.findInHosts(`button[data-action="open-chapter"][data-chapter-id="${id}"]`)?.focus();
      return;
    }
    const conceptId = target.slice('concept:'.length);
    const detailTitle = this.findInHosts(
      `[data-testid="map-detail"][data-concept-id="${conceptId}"] [data-testid="map-detail-title"]`,
    );
    if (detailTitle !== null) {
      detailTitle.focus();
      return;
    }
    this.findInHosts(`button.edu-map-node[data-concept-id="${conceptId}"]`)?.focus();
  }
}
