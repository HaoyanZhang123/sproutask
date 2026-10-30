/**
 * Map controller: owns map view state, loads read models through `MapDataSource`
 * and renders the two shell panels (`map:content`, `map:details`).
 *
 * It is strictly read-only: browsing the tree/graph, searching, filtering and
 * opening a detail never writes learning state. "开始学习/开始复习" only
 * navigates; the workspace (T12) owns mutating flows.
 */

import type { ServiceError } from '@edu/domain';
import {
  button,
  clear,
  h,
  loadingState,
  renderErrorBanner,
  type EducationPageContext,
} from '../../shell/src/index.js';
import {
  aggregateMapSummary,
  buildTocModel,
  matchesStateFilter,
  summarizeConceptState,
  type MapViewMode,
  type StateFilter,
  type TocTreeModel,
} from './model.js';
import {
  renderConceptList,
  renderDetail,
  renderFilterBar,
  renderFixtureNotice,
  renderGraph,
  renderPackBadges,
  renderRangeHeader,
  renderRelationList,
  renderSearch,
  renderSummaryBar,
  renderTree,
  renderTreeHelp,
  renderViewTabs,
  type MapActions,
} from './views.js';
import {
  MAP_DEPTH_CAP,
  MAP_EXPAND_DEPTH_CAP,
  MAP_EXPAND_NODE_CAP,
  MAP_NODE_CAP,
  MAP_PAGE_SIZE,
  MAP_SEARCH_LIMIT,
  type ConceptDetail,
  type ConceptSearchHit,
  type GraphSlice,
  type MapDataSource,
  type MapPayload,
  type MapRequest,
} from './types.js';

export interface MapControllerOptions {
  readonly dataSource: MapDataSource;
  readonly createRequest: () => MapRequest;
  readonly pageSize?: number;
}

export interface MapTimings {
  readonly mapLoadMs: number;
  readonly firstRenderMs: number;
  readonly lastGraphLoadMs: number;
  readonly lastRenderMs: number;
  readonly chapterSwitchMs: number | null;
}

type LoadState = 'idle' | 'loading' | 'ready' | 'error';

function nowMs(): number {
  const perf = (globalThis as { performance?: { now?: () => number } }).performance;
  if (perf !== undefined && typeof perf.now === 'function') return perf.now();
  return Date.now();
}

function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}

export class MapController {
  private readonly dataSource: MapDataSource;
  private readonly createRequest: () => MapRequest;
  private readonly pageSize: number;

  private context: EducationPageContext | null = null;
  private contentHost: HTMLElement | null = null;
  private detailsHost: HTMLElement | null = null;

  private payload: MapPayload | null = null;
  private tocModel: TocTreeModel | null = null;
  private loadState: LoadState = 'idle';
  private error: ServiceError | null = null;

  private expandedIds = new Set<string>();
  private selectedNodeId: string | null = null;
  private scopeChapterId: string | null = null;
  private selectedConceptId: string | null = null;
  private focusTocId: string | null = null;
  private focusTocRequested = false;
  private pendingConceptFocus: string | null = null;

  private viewMode: MapViewMode = 'graph';
  private filter: StateFilter = 'all';
  private query = '';
  private submittedQuery: string | null = null;
  private searchHits: readonly ConceptSearchHit[] | null = null;
  private searchError: ServiceError | null = null;

  private chapterGraph: GraphSlice | null = null;
  private expandedSlice: GraphSlice | null = null;
  private visibleConceptCount = MAP_NODE_CAP;

  private detail: ConceptDetail | null = null;
  private detailError: ServiceError | null = null;

  private loadPromise: Promise<void> | null = null;
  private disposed = false;
  private keydownBound = false;

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
    this.pageSize = options.pageSize ?? MAP_PAGE_SIZE;
    this.visibleConceptCount = MAP_NODE_CAP;
    this.actions = {
      selectNode: (nodeId) => void this.selectNode(nodeId),
      toggleNode: (nodeId) => this.toggleNode(nodeId),
      selectConcept: (conceptId) => void this.selectConcept(conceptId),
      setViewMode: (mode) => {
        this.viewMode = mode;
        this.render();
      },
      setFilter: (filter) => {
        this.filter = filter;
        this.render();
      },
      clearFilter: () => {
        this.filter = 'all';
        this.render();
      },
      setQuery: (value) => {
        // Keep the caret: typing updates state only, the input is not rebuilt.
        this.query = value;
      },
      submitSearch: () => void this.submitSearch(),
      clearSearch: () => {
        this.query = '';
        this.submittedQuery = null;
        this.searchHits = null;
        this.searchError = null;
        this.render();
      },
      showMoreConcepts: () => void this.showMoreConcepts(),
      expandExternal: (conceptId) => void this.expandExternal(conceptId),
      collapseExternal: () => {
        this.expandedSlice = null;
        this.render();
      },
      navigate: (path) => {
        if (this.context !== null) this.context.navigate(path);
      },
    };
  }

  getTimings(): MapTimings {
    return this.timings;
  }

  onPageMount(context: EducationPageContext): void {
    this.context = context;
    this.disposed = false;
    void this.ensureLoaded();
  }

  onPageUnmount(): void {
    this.contentHost = null;
    this.detailsHost = null;
  }

  dispose(): void {
    this.disposed = true;
    this.contentHost = null;
    this.detailsHost = null;
  }

  mountContent(host: HTMLElement): void {
    this.contentHost = host;
    if (!this.keydownBound) {
      host.addEventListener('keydown', (event) => this.onTreeKeyDown(event));
      this.keydownBound = true;
    }
    void this.ensureLoaded();
    this.render();
  }

  unmountContent(): void {
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

  /* ----------------------------------------------------------- data loading */

  private async ensureLoaded(): Promise<void> {
    if (this.payload !== null || this.loadState === 'loading') return;
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
    this.timings = { ...this.timings, mapLoadMs: round(nowMs() - started) };
    this.payload = result.data;
    this.tocModel = buildTocModel(result.data);
    this.loadState = 'ready';
    this.error = null;
    this.selectInitialRange(result.data);
    await this.loadChapterGraph();
    const initialConceptId = result.data.initialConceptId;
    if (initialConceptId !== null) {
      this.selectedConceptId = initialConceptId;
      await this.loadDetail(initialConceptId);
    }
    const firstRender = nowMs();
    this.render();
    this.timings = { ...this.timings, firstRenderMs: round(nowMs() - firstRender) };
  }

  private selectInitialRange(payload: MapPayload): void {
    const model = this.tocModel;
    if (model === null) return;
    const chapterFromConcept = (() => {
      if (payload.initialConceptId === null) return null;
      const concept = payload.concepts.find((entry) => entry.id === payload.initialConceptId);
      if (concept === undefined) return null;
      const firstPlacement = concept.placements[0];
      return firstPlacement === undefined ? null : model.chapterOf(firstPlacement);
    })();
    const initialNode =
      chapterFromConcept ??
      (payload.initialTocNodeId === null ? null : model.node(payload.initialTocNodeId)) ??
      model.chapters()[0] ??
      model.roots[0] ??
      null;
    const chapter = initialNode === null ? null : model.chapterOf(initialNode.id) ?? initialNode;
    this.scopeChapterId = chapter?.id ?? null;
    this.selectedNodeId = chapter?.id ?? null;
    // Volume + units stay open so chapters are always reachable (chapter-level
    // folding); only the current chapter reveals its sections.
    this.expandedIds = new Set<string>(
      payload.toc.filter((node) => node.type === 'volume' || node.type === 'unit').map((node) => node.id),
    );
    for (const root of model.roots) this.expandedIds.add(root.id);
    if (chapter !== null) {
      for (const ancestorId of model.ancestorsOf(chapter.id)) this.expandedIds.add(ancestorId);
      this.expandedIds.add(chapter.id);
    }
    this.focusTocId = chapter?.id ?? null;
  }

  private async loadChapterGraph(): Promise<void> {
    const chapterId = this.scopeChapterId;
    if (chapterId === null) return;
    const started = nowMs();
    const result = await this.dataSource.loadChapterGraph(this.createRequest(), chapterId, {
      maxNodes: MAP_NODE_CAP * 4,
      maxDepth: MAP_DEPTH_CAP,
      visibleConceptCount: this.visibleConceptCount,
    });
    if (this.disposed) return;
    this.timings = { ...this.timings, lastGraphLoadMs: round(nowMs() - started) };
    if (result.ok) {
      this.chapterGraph = result.data;
      this.expandedSlice = null;
    } else {
      this.chapterGraph = null;
      this.error = result.error;
    }
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

  private async selectNode(nodeId: string): Promise<void> {
    const model = this.tocModel;
    if (model === null || this.payload === null) return;
    const node = model.node(nodeId);
    if (node === undefined) return;
    this.selectedNodeId = nodeId;
    this.focusTocId = nodeId;
    this.focusTocRequested = true;
    const chapter = model.chapterOf(nodeId);
    if (chapter !== null) {
      if (!this.expandedIds.has(chapter.id)) this.expandedIds.add(chapter.id);
      for (const ancestorId of model.ancestorsOf(chapter.id)) this.expandedIds.add(ancestorId);
    }
    const nextScope = chapter?.id ?? nodeId;
    const changed = nextScope !== this.scopeChapterId;
    this.scopeChapterId = nextScope;
    if (changed) {
      this.selectedConceptId = null;
      this.detail = null;
      this.expandedSlice = null;
      this.visibleConceptCount = MAP_NODE_CAP;
      const started = nowMs();
      await this.loadChapterGraph();
      this.timings = { ...this.timings, chapterSwitchMs: round(nowMs() - started) };
    }
    this.render();
  }

  private toggleNode(nodeId: string): void {
    if (this.expandedIds.has(nodeId)) this.expandedIds.delete(nodeId);
    else this.expandedIds.add(nodeId);
    this.focusTocId = nodeId;
    this.focusTocRequested = true;
    this.render();
  }

  private async selectConcept(conceptId: string): Promise<void> {
    const payload = this.payload;
    const model = this.tocModel;
    if (payload === null || model === null) return;
    const concept = payload.concepts.find((entry) => entry.id === conceptId);
    if (concept === undefined) return;
    this.selectedConceptId = conceptId;
    this.pendingConceptFocus = conceptId;
    this.viewMode = this.viewMode === 'concepts' ? 'concepts' : this.viewMode;
    const firstPlacement = concept.placements[0];
    const chapter = firstPlacement === undefined ? null : model.chapterOf(firstPlacement);
    if (chapter !== null && chapter.id !== this.scopeChapterId) {
      this.scopeChapterId = chapter.id;
      this.selectedNodeId = chapter.id;
      this.focusTocId = chapter.id;
      for (const ancestorId of model.ancestorsOf(chapter.id)) this.expandedIds.add(ancestorId);
      this.expandedIds.add(chapter.id);
      this.visibleConceptCount = Math.max(MAP_NODE_CAP, this.visibleConceptCount);
      const started = nowMs();
      await this.loadChapterGraph();
      this.timings = { ...this.timings, chapterSwitchMs: round(nowMs() - started) };
    }
    await this.loadDetail(conceptId);
    this.render();
  }

  private async submitSearch(): Promise<void> {
    const query = this.query.trim();
    this.submittedQuery = query;
    if (query.length === 0) {
      this.searchHits = null;
      this.searchError = null;
      this.render();
      return;
    }
    const result = await this.dataSource.searchConcepts(
      this.createRequest(),
      query,
      MAP_SEARCH_LIMIT,
    );
    if (result.ok) {
      this.searchHits = result.data;
      this.searchError = null;
    } else {
      this.searchHits = null;
      this.searchError = result.error;
    }
    this.render();
  }

  private async showMoreConcepts(): Promise<void> {
    this.visibleConceptCount += this.pageSize;
    this.expandedSlice = null;
    await this.loadChapterGraph();
    this.render();
  }

  private async expandExternal(conceptId: string): Promise<void> {
    const result = await this.dataSource.expandConcept(this.createRequest(), conceptId, {
      maxNodes: MAP_EXPAND_NODE_CAP,
      maxDepth: MAP_EXPAND_DEPTH_CAP,
    });
    if (this.disposed) return;
    if (result.ok) {
      this.expandedSlice = result.data;
      this.selectedConceptId = conceptId;
      this.pendingConceptFocus = conceptId;
      await this.loadDetail(conceptId);
      this.render();
    }
  }

  private retry(): void {
    this.payload = null;
    this.tocModel = null;
    this.loadState = 'idle';
    this.error = null;
    this.chapterGraph = null;
    this.expandedSlice = null;
    this.detail = null;
    this.selectedConceptId = null;
    this.detailError = null;
    void this.ensureLoaded();
  }

  /* ------------------------------------------------------------- keyboard */

  private onTreeKeyDown(event: Event): void {
    const keyboard = event as KeyboardEvent;
    const target = keyboard.target;
    if (!(target instanceof HTMLElement)) return;
    const item = target.closest<HTMLElement>('[data-toc-id]');
    if (item === null) return;
    const model = this.tocModel;
    if (model === null) return;
    const rows = model.visibleRows(this.expandedIds);
    const index = rows.findIndex((row) => row.node.id === item.dataset['tocId']);
    if (index < 0) return;
    const row = rows[index];
    if (row === undefined) return;
    const focusRow = (nextIndex: number): void => {
      const next = rows[nextIndex];
      if (next === undefined) return;
      this.focusTocId = next.node.id;
      this.focusTocRequested = true;
      this.render();
    };
    switch (keyboard.key) {
      case 'ArrowDown':
        keyboard.preventDefault();
        focusRow(Math.min(rows.length - 1, index + 1));
        break;
      case 'ArrowUp':
        keyboard.preventDefault();
        focusRow(Math.max(0, index - 1));
        break;
      case 'ArrowRight': {
        keyboard.preventDefault();
        if (row.hasChildren && !row.expanded) {
          this.expandedIds.add(row.node.id);
          this.focusTocId = row.node.id;
          this.focusTocRequested = true;
          this.render();
        } else if (row.hasChildren) {
          focusRow(index + 1);
        }
        break;
      }
      case 'ArrowLeft': {
        keyboard.preventDefault();
        if (row.expanded && row.hasChildren) {
          this.expandedIds.delete(row.node.id);
          this.focusTocId = row.node.id;
          this.focusTocRequested = true;
          this.render();
        } else if (row.node.parentId !== null) {
          const parentIndex = rows.findIndex((entry) => entry.node.id === row.node.parentId);
          focusRow(parentIndex >= 0 ? parentIndex : index - 1);
        }
        break;
      }
      case 'Home':
        keyboard.preventDefault();
        focusRow(0);
        break;
      case 'End':
        keyboard.preventDefault();
        focusRow(rows.length - 1);
        break;
      case 'Enter':
      case ' ':
        keyboard.preventDefault();
        void this.selectNode(row.node.id);
        break;
      default:
        break;
    }
  }

  private focusTocItem(nodeId: string): void {
    if (this.contentHost === null) return;
    const element = this.contentHost.querySelector<HTMLElement>(`[data-toc-id="${nodeId}"]`);
    element?.focus();
  }

  private focusConcept(conceptId: string): void {
    for (const host of [this.contentHost, this.detailsHost]) {
      if (host === null) continue;
      const element = host.querySelector<HTMLElement>(`[data-concept-id="${conceptId}"]`);
      if (element !== null) {
        element.focus();
        return;
      }
    }
  }

  /* --------------------------------------------------------------- render */

  private render(): void {
    if (this.disposed) return;
    const started = nowMs();
    if (this.contentHost !== null) this.renderContent(this.contentHost);
    if (this.detailsHost !== null) this.renderDetails(this.detailsHost);
    this.timings = { ...this.timings, lastRenderMs: round(nowMs() - started) };
    if (this.focusTocRequested && this.focusTocId !== null) {
      this.focusTocRequested = false;
      this.focusTocItem(this.focusTocId);
    }
    const conceptFocus = this.pendingConceptFocus;
    if (conceptFocus !== null) {
      this.pendingConceptFocus = null;
      this.focusConcept(conceptFocus);
    }
  }

  private renderContent(host: HTMLElement): void {
    clear(host);
    if (this.loadState === 'loading') {
      host.append(
        loadingState({
          title: '正在打开当前教材的地图…',
          body: '只读取已保存的目录、概念与状态；浏览不会改变学习进程。',
        }),
      );
      return;
    }
    if (this.loadState === 'error') {
      host.append(
        renderErrorBanner(this.error ?? { code: 'STORAGE_FAILED', message: '地图暂时无法打开', retryable: true }, {
          onRetry: () => this.retry(),
          onBack: () => this.actions.navigate('/library'),
          backLabel: '去教材库',
        }),
      );
      return;
    }
    const payload = this.payload;
    const model = this.tocModel;
    if (payload === null || model === null) return;

    const fixture = renderFixtureNotice(payload);
    if (fixture !== null) host.append(fixture);
    host.append(renderPackBadges(payload));
    host.append(renderSummaryBar(payload, aggregateMapSummary(payload)));
    host.append(
      renderSearch(
        this.query,
        this.submittedQuery,
        this.searchHits,
        this.searchError?.code === undefined ? null : '搜索暂时没有完成，可以重试或清除搜索。',
        this.actions,
      ),
    );
    host.append(renderFilterBar(this.filter, this.actions));

    const treePane = h('div', { class: 'edu-map-navpane', 'data-testid': 'map-navpane' });
    treePane.append(
      h('h2', { class: 'edu-map-pane-title' }, '教材目录'),
      renderTree(model.visibleRows(this.expandedIds), this.selectedNodeId, this.focusTocId, this.actions),
      renderTreeHelp(),
    );
    const workPane = h('div', { class: 'edu-map-workpane', 'data-testid': 'map-workpane' });
    workPane.append(renderViewTabs(this.viewMode, this.actions));

    const slice = this.activeSlice();
    const visibleConceptIds = this.visibleConceptIds(slice);
    if (slice !== null) {
      workPane.append(renderRangeHeader(slice, payload, visibleConceptIds, this.actions));
    }
    if (this.viewMode === 'relations') {
      workPane.append(
        slice === null
          ? h('p', { class: 'edu-map-help' }, '还没有可显示的关系。')
          : renderRelationList(slice, payload, visibleConceptIds, this.actions),
      );
    } else if (this.viewMode === 'concepts') {
      const concepts =
        slice === null
          ? []
          : slice.concepts.filter((concept) => {
              const summary = summarizeConceptState(payload, concept.id);
              return matchesStateFilter(summary, this.filter);
            });
      workPane.append(renderConceptList(concepts, payload, this.filter, this.actions));
    } else {
      if (slice === null) {
        workPane.append(h('p', { class: 'edu-map-help' }, '当前范围没有可绘制的概念。'));
      } else if (visibleConceptIds.length === 0) {
        workPane.append(
          h(
            'div',
            { class: 'edu-map-empty', 'data-testid': 'map-graph-filtered-empty' },
            h('p', {}, '当前筛选没有匹配的概念，图暂不绘制。'),
            button('清除筛选', this.actions.clearFilter, {
              tone: 'primary',
              dataAction: 'clear-filter',
            }),
          ),
        );
      } else {
        workPane.append(renderGraph(slice, payload, visibleConceptIds, this.actions));
      }
    }
    host.append(h('div', { class: 'edu-map-main' }, treePane, workPane));
  }

  private renderDetails(host: HTMLElement): void {
    clear(host);
    if (this.detail !== null && this.payload !== null) {
      host.append(renderDetail(this.detail, this.payload, this.actions));
      return;
    }
    if (this.detailError !== null) {
      host.append(
        h(
          'p',
          { class: 'edu-map-notice', role: 'alert', 'data-testid': 'map-detail-error' },
          '这个概念详情暂时打不开；目录、关系列表和概念列表仍可使用。',
        ),
      );
    }
    host.append(
      h(
        'div',
        { class: 'edu-map-detail edu-map-detail--empty', 'data-testid': 'map-detail-placeholder' },
        h('h2', { class: 'edu-map-detail__title' }, '概念详情'),
        h(
          'p',
          {},
          '从左侧目录、关系图或概念列表选择一个概念：可以查看三轴状态、建议先修、出处与学习/复习入口。',
        ),
        h('p', { class: 'edu-map-help' }, '只看地图不会把概念标记为已学；开始学习/复习在独立工作区进行。'),
      ),
    );
  }

  private activeSlice(): GraphSlice | null {
    return this.expandedSlice ?? this.chapterGraph;
  }

  private visibleConceptIds(slice: GraphSlice | null): readonly string[] {
    const payload = this.payload;
    if (slice === null || payload === null) return [];
    return slice.concepts
      .filter((concept) => matchesStateFilter(summarizeConceptState(payload, concept.id), this.filter))
      .map((concept) => concept.id);
  }
}
