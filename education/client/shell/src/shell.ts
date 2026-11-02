/**
 * Education shell root.
 *
 * Framework-agnostic DOM controller: one root element, persistent context bar,
 * four-item navigation, page registry, slot registry and explicit read models.
 * It never reads credentials, never writes directly to storage, and renders
 * only structured status returned by the data source.
 */

import type {
  Clock,
  HostPort,
  IdGenerator,
  ServiceError,
} from '@edu/domain';
import type { ShellSnapshot } from './data/types.js';
import {
  createHttpAuthKeyPort,
  createUnsupportedAuthKeyPort,
  validateApiKey,
  type AuthKeyClearReceipt,
  type AuthKeyPort,
  type AuthKeyResult,
  type AuthKeySaveReceipt,
  type AuthKeyStatus,
} from './key-port.js';
import { renderContextBar } from './components/context-bar.js';
import { loadingState, fixtureBadge } from './components/states.js';
import { statusChip } from './components/status-chip.js';
import { button } from './components/button.js';
import {
  SHELL_SLOT_NAMES,
  type EducationPage,
  type EducationPageContext,
  type EducationShellServices,
  type ShellPanel,
} from './contracts.js';
import type {
  DataResult,
  DeleteReceipt,
  DeleteScope,
  ExportReceipt,
  RangeSaveInput,
  RangeSaveReceipt,
  ResumePayload,
  ShellDataSource,
  ShellRequest,
} from './data/types.js';
import { h, clear } from './dom.js';
import { renderErrorBanner } from './errors.js';
import {
  SESSION_MODE_LABELS,
  courseEditionLabel,
} from './labels.js';
import { evaluateLayout } from './layout.js';
import { EducationPageRegistry } from './pages/registry.js';
import { createAccountPage } from './pages/account.js';
import { createFirstRunPage } from './pages/first-run.js';
import { createHomePage } from './pages/home.js';
import {
  createLibraryFallbackPage,
  createMapFallbackPage,
  createNotFoundPage,
} from './pages/placeholders.js';
import { createRecordsPage } from './pages/records.js';
import { createWorkspacePage } from './pages/workspace.js';
import type {
  BackTarget,
  EducationShellApi,
  EducationShellViewState,
  SaveState,
} from './shell-state.js';
import { EducationSlotRegistry } from './slots.js';
import { ensureEducationStyles } from './styles.js';

type MutableState = { -readonly [K in keyof EducationShellViewState]: EducationShellViewState[K] };

export interface EducationShellOptions {
  readonly data: ShellDataSource;
  readonly initialPath?: string;
  readonly clock?: Clock;
  readonly ids?: IdGenerator;
  readonly host?: HostPort | null;
  readonly fontScale?: 'standard' | 'large';
  /** Same-origin host key endpoint; live data sources default to HTTP. */
  readonly keyPort?: AuthKeyPort;
}

export interface EducationShellController {
  readonly shell: EducationShell;
  readonly ready: Promise<void>;
  unmount(): Promise<void>;
}

const NAV_ITEMS = [
  { path: '/home', label: '首页' },
  { path: '/library', label: '教材库' },
  { path: '/map', label: '地图' },
  { path: '/workspace', label: '工作区' },
  { path: '/records', label: '记录' },
] as const;

export class EducationShell {
  readonly root: HTMLDivElement;
  readonly pages: EducationPageRegistry;
  readonly slots: EducationSlotRegistry;
  private readonly data: ShellDataSource;
  private readonly keyPort: AuthKeyPort;
  private readonly options: EducationShellOptions;
  private readonly clock: Clock;
  private readonly ids: IdGenerator;
  private readonly state: MutableState;
  private readonly api: EducationShellApi;
  private readonly services: EducationShellServices;
  private readonly navHost: HTMLElement;
  private readonly contextHost: HTMLElement;
  private readonly toolsHost: HTMLElement;
  private readonly main: HTMLElement;
  private readonly pageHost: HTMLElement;
  private readonly liveRegion: HTMLElement;
  private readonly history: BackTarget[] = [];
  private mountedPanels: { readonly panel: ShellPanel; readonly context: EducationPageContext }[] = [];
  private currentPage: EducationPage | null = null;
  private currentQuery = new URLSearchParams();
  private container: HTMLElement | null = null;
  private homePromise: Promise<boolean> | null = null;
  private recordsPromise: Promise<boolean> | null = null;
  private renderToken = 0;
  private requestCounter = 0;
  private disposed = false;
  private lastRangeInput: RangeSaveInput | null = null;

  constructor(options: EducationShellOptions) {
    this.options = options;
    this.data = options.data;
    this.keyPort =
      options.keyPort ??
      (options.data.kind === 'live' ? createHttpAuthKeyPort() : createUnsupportedAuthKeyPort());
    this.clock = options.clock ?? { now: () => new Date().toISOString() };
    this.ids =
      options.ids ??
      {
        next: (prefix: string) => {
          this.requestCounter += 1;
          return `${prefix}.${this.requestCounter}`;
        },
      };

    const initialPath = options.initialPath ?? readInitialPath();
    this.state = {
      currentPath: initialPath,
      currentPageTitle: '首页',
      snapshot: null,
      home: null,
      records: null,
      dataStatus: 'idle',
      pageError: null,
      fatalError: null,
      offline: false,
      saveState: 'unknown',
      resume: null,
      resumeError: null,
      rangeClaim: null,
      backTarget: null,
      diagnosticSkipped: false,
      fontScale: options.fontScale ?? 'standard',
      keyStatus: 'unknown',
      keySuffix: null,
    };

    this.api = {
      getState: () => this.state,
      navigate: (path) => this.navigate(path),
      back: () => this.back(),
      refresh: () => this.refresh(),
      resumeLast: () => this.resumeLast(),
      saveRange: (input) => this.saveRange(input),
      retrySave: () => this.retrySave(),
      exportData: () => this.exportData(),
      deleteData: (scope) => this.deleteData(scope),
      setDiagnosticSkipped: (skipped) => {
        this.state.diagnosticSkipped = skipped;
      },
      setFontScale: (scale) => this.setFontScale(scale),
      loadKeyStatus: () => this.loadKeyStatus(),
      saveKey: (apiKey) => this.saveKey(apiKey),
      clearKey: () => this.clearKey(),
    };

    this.pages = new EducationPageRegistry();
    this.slots = new EducationSlotRegistry();
    this.pages.register(createHomePage());
    this.pages.register(createLibraryFallbackPage());
    this.pages.register(createMapFallbackPage());
    this.pages.register(createWorkspacePage());
    this.pages.register(createRecordsPage());
    this.pages.register(createFirstRunPage());
    this.pages.register(createAccountPage());
    this.pages.register(createNotFoundPage());

    this.root = h('div', {
      class: 'edu-shell',
      'data-edu-shell': 'true',
      'data-font-scale': this.state.fontScale,
    });
    this.navHost = h('nav', { class: 'edu-nav', 'aria-label': '主导航', 'data-testid': 'edu-nav' });
    this.contextHost = h('div', { 'data-testid': 'edu-context-host' });
    this.toolsHost = h('div', { class: 'edu-header__tools', 'data-testid': 'edu-header-tools' });
    this.pageHost = h('div', { class: 'edu-main__inner', 'data-testid': 'page-host' });
    this.liveRegion = h('p', {
      class: 'edu-visually-hidden',
      role: 'status',
      'aria-live': 'polite',
      'data-testid': 'edu-live-region',
    });
    this.main = h(
      'main',
      { class: 'edu-main', id: 'edu-main', tabindex: -1, 'data-testid': 'edu-main' },
      this.pageHost,
      this.liveRegion,
    );

    const services: EducationShellServices = {
      data: this.data,
      shell: this.api,
      clock: this.clock,
      ids: this.ids,
      learnerId: null,
      host: options.host ?? null,
      slots: this.slots,
      getState: () => this.state,
    };
    // The learner id is bound after the local snapshot is read; it is never a
    // model-account id and never inferred from the data-source kind.
    Object.defineProperty(services, 'learnerId', {
      get: () => this.state.snapshot?.learner.id ?? null,
      enumerable: true,
    });
    this.services = services;

    this.buildFrame();
  }

  getState(): Readonly<EducationShellViewState> {
    return this.state;
  }

  private buildFrame(): void {
    const skip = h(
      'a',
      {
        class: 'edu-skip-link',
        href: '#edu-main',
        onclick: (event: Event) => {
          event.preventDefault();
          this.main.focus();
        },
      },
      '跳到主要内容',
    );
    const brand = h(
      'button',
      {
        type: 'button',
        class: 'edu-brand',
        onclick: () => void this.navigate('/home'),
        'data-action': 'brand-home',
      },
      h('span', { class: 'edu-brand__mark', 'aria-hidden': 'true' }, '育'),
      h('span', {}, '生物学习'),
    );
    const top = h('div', { class: 'edu-header__top' }, brand, this.toolsHost);
    const header = h('header', { class: 'edu-header' }, top, this.contextHost);
    const layout = h(
      'div',
      { class: 'edu-layout' },
      h('aside', { class: 'edu-sidebar' }, this.navHost),
      this.main,
    );
    const footer = h(
      'footer',
      { class: 'edu-footer' },
      h('p', {}, '学习记录只保存在这台电脑；智能反馈需要先配置模型服务。'),
    );
    this.root.append(skip, header, layout, footer);
    this.renderNav();
    this.renderHeaderTools();
    this.renderContext();
  }

  private renderNav(): void {
    clear(this.navHost);
    const current = this.state.currentPath.split('?')[0] ?? '/';
    for (const item of NAV_ITEMS) {
      const active = current === item.path || current.startsWith(`${item.path}/`);
      const link = h(
        'button',
        {
          type: 'button',
          class: 'edu-nav__link',
          'aria-current': active ? 'page' : undefined,
          'data-nav-path': item.path,
          onclick: () => void this.navigate(item.path),
        },
        h('span', {}, item.label),
        active ? h('span', { class: 'edu-nav__current' }, '当前') : null,
      );
      this.navHost.append(link);
    }
  }

  private renderHeaderTools(): void {
    clear(this.toolsHost);
    const snapshot = this.state.snapshot;
    if (this.state.keyStatus === 'missing') {
      const localMode = statusChip('本地模式', 'neutral');
      localMode.setAttribute('data-testid', 'local-mode-badge');
      localMode.title = '未配置模型 Key；教材、地图与记录仍可在本机使用。';
      this.toolsHost.append(localMode);
    }
    this.toolsHost.append(
      h(
        'button',
        {
          type: 'button',
          class: 'edu-account-link',
          onclick: () => void this.navigate('/account'),
          'data-action': 'account-status',
          title: '账户与模型服务状态分开显示；不包含凭据',
        },
        h('span', {}, '账户与模型服务'),
        snapshot === null
          ? statusChip('状态读取中', 'neutral')
          : snapshot.auth.apiKey.status === 'available'
            ? statusChip('云推理可用', 'positive')
            : statusChip('云推理不可用', 'attention'),
      ),
    );
    if (snapshot !== null && snapshot.fixture) this.toolsHost.append(fixtureBadge());
  }

  private renderContext(): void {
    const snapshot = this.state.snapshot;
    const path = this.state.currentPath.split('?')[0] ?? '';
    const routeQuery = queryOf(this.state.currentPath);
    const routeMode =
      path === '/workspace' &&
      (routeQuery.get('mode') === 'learn' ||
        routeQuery.get('mode') === 'review' ||
        routeQuery.get('mode') === 'diagnostic')
        ? (routeQuery.get('mode') as 'learn' | 'review' | 'diagnostic')
        : null;
    const routeConcept = path === '/workspace' ? routeQuery.get('concept') : null;
    const active = this.state.resume?.session ?? this.state.home?.activeSession ?? null;
    const conceptId = routeConcept ?? active?.conceptId ?? null;
    const concept =
      routeConcept !== null
        ? (snapshot?.concepts.find((entry) => entry.id === routeConcept)?.title ?? routeConcept)
        : (this.state.resume?.conceptTitle ??
          (conceptId === null || snapshot === null
            ? null
            : (snapshot.concepts.find((entry) => entry.id === conceptId)?.title ?? null)));
    const mode = routeMode ?? (active === null ? null : active.mode);
    clear(this.contextHost);
    this.contextHost.append(
      renderContextBar({
        courseEdition:
          snapshot === null ? null : courseEditionLabel(snapshot.courseEdition),
        packVersion: snapshot?.pack.version ?? null,
        concept,
        mode: mode === null ? null : SESSION_MODE_LABELS[mode],
        saveState: this.state.saveState,
        fixture: snapshot?.fixture ?? false,
        backTarget: this.state.backTarget?.label ?? null,
        onBack:
          this.state.backTarget === null ? undefined : () => void this.back(),
      }),
    );
    // The context bar is always visible; keep the page title in document metadata.
    const page = this.pages.resolve(this.state.currentPath.split('?')[0] ?? '');
    this.state.currentPageTitle = page?.title ?? '页面不存在';
  }

  async mount(container: HTMLElement): Promise<void> {
    if (this.container !== null) throw new Error('education shell is already mounted');
    this.container = container;
    ensureEducationStyles(container.ownerDocument);
    container.append(this.root);
    this.state.dataStatus = 'loading';
    const token = ++this.renderToken;
    const result = await this.data.loadSnapshot(this.newRequest());
    if (this.disposed || token !== this.renderToken) return;
    if (!result.ok) {
      this.state.fatalError = result.error;
      this.state.dataStatus = 'error';
      this.renderFatalError();
      return;
    }
    this.acceptSnapshot(result);
    await this.loadKeyStatus();
    this.renderHeaderTools();
    this.renderContext();
    await this.renderRoute();
  }

  async unmount(): Promise<void> {
    if (this.disposed) return;
    this.disposed = true;
    this.renderToken += 1;
    await this.unmountCurrentPage();
    this.container?.removeChild(this.root);
    this.container = null;
  }

  registerPage(page: EducationPage): void {
    this.pages.register(page);
    const currentPath = this.state.currentPath.split('?')[0] ?? '';
    if (currentPath === page.path && this.container !== null) void this.renderRoute();
  }

  registerPanel(name: (typeof SHELL_SLOT_NAMES)[number], panel: ShellPanel): () => void {
    return this.slots.register(name, panel);
  }

  async navigate(path: string, force = false): Promise<void> {
    const normalized = normalizePath(path);
    if (!force && normalized === this.state.currentPath) return;
    if (normalized !== this.state.currentPath) {
      this.history.push({
        path: this.state.currentPath,
        label: this.state.currentPageTitle,
      });
    }
    this.state.currentPath = normalized;
    this.state.backTarget = this.history[this.history.length - 1] ?? null;
    this.state.pageError = null;
    this.state.resumeError = null;
    if (optionsHasNewActivity(normalized)) this.state.resume = null;
    this.renderNav();
    this.renderContext();
    await this.renderRoute();
  }

  async back(): Promise<void> {
    const previous = this.history.pop();
    if (previous === undefined) return;
    this.state.currentPath = previous.path;
    this.state.backTarget = this.history[this.history.length - 1] ?? null;
    this.state.pageError = null;
    this.state.resumeError = null;
    this.renderNav();
    this.renderContext();
    await this.renderRoute();
  }

  async refresh(): Promise<void> {
    if (this.state.fatalError !== null) {
      this.state.fatalError = null;
      this.state.dataStatus = 'loading';
      const result = await this.data.loadSnapshot(this.newRequest());
      if (!result.ok) {
        this.state.fatalError = result.error;
        this.state.dataStatus = 'error';
        this.renderFatalError();
        return;
      }
      this.acceptSnapshot(result);
    } else {
      const result = await this.data.loadSnapshot(this.newRequest());
      if (result.ok) this.acceptSnapshot(result);
    }
    this.resetPageData();
    await this.loadKeyStatus();
    this.renderHeaderTools();
    this.renderContext();
    await this.renderRoute();
  }

  async resumeLast(): Promise<DataResult<ResumePayload>> {
    const homeReady = await this.ensureHome();
    if (!homeReady) {
      return { ok: false, error: this.state.pageError ?? storageError() };
    }
    const active = this.state.home?.activeSession ?? null;
    if (active === null) {
      return {
        ok: false,
        error: { code: 'NOT_FOUND', message: '没有可继续的活动', retryable: false },
      };
    }
    const result = await this.data.resumeSession(this.newRequest(), active.id);
    if (!result.ok) {
      this.state.resumeError = result.error;
      this.renderContext();
      await this.renderRoute();
      return result;
    }
    this.state.resume = result.data;
    this.state.resumeError = null;
    await this.navigate('/workspace', true);
    return result;
  }

  async saveRange(input: RangeSaveInput): Promise<DataResult<RangeSaveReceipt>> {
    this.lastRangeInput = input;
    this.setSaveState('saving');
    const result = await this.data.saveRange(this.newRequest(), input);
    if (result.ok) {
      this.state.rangeClaim = result.data.range;
      this.setSaveState('saved');
    } else {
      this.setSaveState('failed');
    }
    this.renderHeaderTools();
    return result;
  }

  async retrySave(): Promise<void> {
    if (this.lastRangeInput !== null) {
      await this.saveRange(this.lastRangeInput);
      return;
    }
    this.setSaveState('saved');
    await this.refresh();
  }

  async exportData(): Promise<DataResult<ExportReceipt>> {
    return this.data.exportData(this.newRequest(), 'learning_records');
  }

  async deleteData(scope: DeleteScope): Promise<DataResult<DeleteReceipt>> {
    const result = await this.data.deleteData(this.newRequest(), scope);
    if (result.ok && scope === 'learning_records') {
      this.state.rangeClaim = null;
      this.state.resume = null;
    }
    return result;
  }

  setDiagnosticSkipped(skipped: boolean): void {
    this.state.diagnosticSkipped = skipped;
  }

  setFontScale(scale: 'standard' | 'large'): void {
    this.state.fontScale = scale;
    this.root.dataset['fontScale'] = scale;
    this.renderContext();
  }

  async loadKeyStatus(): Promise<AuthKeyResult<AuthKeyStatus>> {
    const result = await this.keyPort.loadStatus();
    if (result.ok) {
      this.state.keyStatus = result.data.configured ? 'configured' : 'missing';
      this.state.keySuffix = result.data.maskedSuffix;
      this.renderHeaderTools();
    }
    return result;
  }

  async saveKey(apiKey: string): Promise<AuthKeyResult<AuthKeySaveReceipt>> {
    const invalid = validateApiKey(apiKey);
    if (invalid !== null) return { ok: false, error: invalid };
    const result = await this.keyPort.save(apiKey.trim());
    if (result.ok) {
      this.state.keyStatus = 'configured';
      this.state.keySuffix = result.data.maskedSuffix;
      this.renderHeaderTools();
    }
    return result;
  }

  async clearKey(): Promise<AuthKeyResult<AuthKeyClearReceipt>> {
    const result = await this.keyPort.clear();
    if (result.ok) {
      this.state.keyStatus = 'missing';
      this.state.keySuffix = null;
      this.renderHeaderTools();
    }
    return result;
  }

  private acceptSnapshot(result: DataResult<ShellSnapshot>): void {
    if (!result.ok) return;
    this.state.snapshot = result.data;
    this.state.offline = result.offline === true;
    this.state.dataStatus = 'ready';
    this.state.saveState = 'saved';
    this.state.fatalError = null;
    this.state.keyStatus =
      result.data.auth.apiKey.status === 'available' ? 'configured' : 'missing';
    this.state.keySuffix = null;
  }

  private resetPageData(): void {
    this.state.home = null;
    this.state.records = null;
    this.state.pageError = null;
    this.homePromise = null;
    this.recordsPromise = null;
  }

  private async renderRoute(): Promise<void> {
    const token = ++this.renderToken;
    await this.unmountCurrentPage();
    if (this.disposed || token !== this.renderToken) return;

    const path = this.state.currentPath.split('?')[0] ?? '/home';
    this.currentQuery = queryOf(this.state.currentPath);
    const page = this.pages.resolve(path) ?? this.pages.get('shell.not-found');
    if (page === undefined) return;
    this.state.currentPageTitle = page.title;
    this.renderContext();
    this.renderNav();
    this.pageHost.replaceChildren();
    const section = h('section', {
      class: 'edu-page',
      'data-page-id': page.id,
      'data-page-path': page.path,
    });
    section.append(
      h('h1', { class: 'edu-page__title' }, page.title),
      loadingState({
        title: `正在打开${page.title}…`,
        body: '保留页面标题和返回入口；不会显示虚构的教材、活动或成绩占位值。',
        onCancel: () => void this.navigate('/home'),
      }),
    );
    this.pageHost.append(section);
    this.main.focus();

    const ready = await this.ensurePageData(page);
    if (this.disposed || token !== this.renderToken) return;
    if (!ready) {
      this.renderPageError(section, page);
      return;
    }

    section.replaceChildren();
    this.currentPage = page;
    const pageContext: EducationPageContext = {
      container: section,
      services: this.services,
      navigate: (next) => void this.navigate(next),
    };
    try {
      await page.mount(pageContext);
    } catch {
      this.currentPage = null;
      this.renderPageError(section, page);
      return;
    }
    if (this.disposed || token !== this.renderToken) {
      await page.unmount();
      return;
    }
    await this.mountPanels(section, pageContext);
    this.announce(`已打开${page.title}页面`);
    this.focusMainHeading(section);
    const doc = this.root.ownerDocument;
    doc.title = `${page.title} · 生物学习`;
  }

  private async ensurePageData(page: EducationPage): Promise<boolean> {
    const homeRequired =
      page.id !== 'shell.library-fallback' &&
      page.id !== 'shell.map-fallback' &&
      page.id !== 'shell.not-found';
    if (homeRequired) {
      const homeReady = await this.ensureHome();
      if (!homeReady) return false;
    }
    if (page.id === 'shell.records') return this.ensureRecords();
    return true;
  }

  private async ensureHome(): Promise<boolean> {
    if (this.state.home !== null) return true;
    if (this.homePromise === null) this.homePromise = this.loadHome();
    return this.homePromise;
  }

  private async loadHome(): Promise<boolean> {
    const result = await this.data.loadHome(this.newRequest());
    if (!result.ok) {
      this.state.pageError = result.error;
      this.state.dataStatus = 'error';
      return false;
    }
    this.state.home = result.data;
    this.state.offline = result.offline === true || this.state.offline;
    this.state.dataStatus = 'ready';
    return true;
  }

  private async ensureRecords(): Promise<boolean> {
    if (this.state.records !== null) return true;
    if (this.recordsPromise === null) this.recordsPromise = this.loadRecords();
    return this.recordsPromise;
  }

  private async loadRecords(): Promise<boolean> {
    const result = await this.data.loadRecords(this.newRequest());
    if (!result.ok) {
      this.state.pageError = result.error;
      this.state.dataStatus = 'error';
      return false;
    }
    this.state.records = result.data;
    this.state.offline = result.offline === true || this.state.offline;
    if (result.data.rangeClaim !== null) this.state.rangeClaim = result.data.rangeClaim;
    this.state.dataStatus = 'ready';
    return true;
  }

  private renderPageError(section: HTMLElement, page: EducationPage): void {
    const error: ServiceError = this.state.pageError ?? storageError();
    section.replaceChildren(
      h('h1', { class: 'edu-page__title' }, page.title),
      renderErrorBanner(error, {
        onRetry: () => {
          this.state.pageError = null;
          this.homePromise = null;
          this.recordsPromise = null;
          void this.renderRoute();
        },
        onBack: () => void this.navigate('/home'),
        backLabel: '返回首页',
      }),
    );
  }

  private renderFatalError(): void {
    this.renderHeaderTools();
    this.renderContext();
    const section = h('section', { class: 'edu-page', 'data-page-id': 'fatal' });
    section.append(
      h('h1', { class: 'edu-page__title' }, '本地记录暂时无法打开'),
      renderErrorBanner(this.state.fatalError ?? storageError(), {
        onRetry: () => void this.refresh(),
        onBack: () => void this.navigate('/home'),
        backLabel: '返回首页',
      }),
    );
    this.pageHost.replaceChildren(section);
  }

  private setSaveState(state: SaveState): void {
    this.state.saveState = state;
    this.renderContext();
  }

  private newRequest(): ShellRequest {
    this.requestCounter += 1;
    return {
      requestId: this.ids.next('request'),
      learnerId: this.state.snapshot?.learner.id ?? 'learner.local.pending',
      now: this.clock.now(),
    };
  }

  private async mountPanels(section: HTMLElement, pageContext: EducationPageContext): Promise<void> {
    for (const name of SHELL_SLOT_NAMES) {
      const containers = section.querySelectorAll<HTMLElement>(`[data-edu-slot="${name}"]`);
      if (containers.length === 0) continue;
      const panels = this.slots.list(name);
      for (const container of containers) {
        for (const panel of panels) {
          const context: EducationPageContext = {
            container,
            services: pageContext.services,
            navigate: pageContext.navigate,
          };
          try {
            await panel.mount(context);
            this.mountedPanels.push({ panel, context });
          } catch {
            container.append(
              h(
                'p',
                { class: 'edu-notice edu-notice--warning', role: 'alert' },
                `“${name}”区域的组件没有成功打开；其他内容仍可使用。`,
              ),
            );
          }
        }
      }
    }
  }

  private async unmountCurrentPage(): Promise<void> {
    for (const entry of this.mountedPanels) {
      try {
        await entry.panel.unmount?.();
      } catch {
        /* a failing panel must not block navigation */
      }
    }
    this.mountedPanels = [];
    const page = this.currentPage;
    this.currentPage = null;
    if (page !== null) {
      try {
        await page.unmount();
      } catch {
        /* a failing page must not block navigation */
      }
    }
  }

  private announce(message: string): void {
    this.liveRegion.textContent = message;
  }

  private focusMainHeading(section: HTMLElement): void {
    const heading = section.querySelector<HTMLElement>('h1');
    if (heading !== null) {
      heading.focus();
    } else {
      this.main.focus();
    }
  }

  /** Debug/test-only layout budget for the current viewport. */
  layoutBudget(width: number, height: number): ReturnType<typeof evaluateLayout> {
    return evaluateLayout(width, height, this.state.fontScale === 'large' ? 25 : 20);
  }
}

function normalizePath(path: string): string {
  const value = path.trim();
  if (value.length === 0) return '/home';
  return value.startsWith('/') ? value : `/${value}`;
}

function queryOf(path: string): URLSearchParams {
  const index = path.indexOf('?');
  return new URLSearchParams(index >= 0 ? path.slice(index + 1) : '');
}

function optionsHasNewActivity(path: string): boolean {
  return path.includes('new=1') || path.includes('mode=diagnostic');
}

function storageError(): ServiceError {
  return { code: 'STORAGE_FAILED', message: '本地记录暂时无法读取', retryable: true };
}

function readInitialPath(): string {
  try {
    const hash = globalThis.location?.hash ?? '';
    if (hash.startsWith('#/')) return hash.slice(1);
  } catch {
    /* no browser location in this host */
  }
  return '/home';
}

export function mountEducationShell(
  container: HTMLElement,
  options: EducationShellOptions,
): EducationShellController {
  const shell = new EducationShell(options);
  const ready = shell.mount(container);
  return {
    shell,
    ready,
    unmount: () => shell.unmount(),
  };
}

/** Width helper used by integration tests (not a pixel-measurement claim). */
export function shellLayoutMode(width: number, height: number, baseFontPx = 20): string {
  return evaluateLayout(width, height, baseFontPx).mode;
}
