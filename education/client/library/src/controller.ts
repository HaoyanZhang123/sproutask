/**
 * Library controller: owns view state shared by the page and its two panels.
 * It never decides whether content is a baseline; that is a server match result.
 *
 * The page follows one rule: 一页只说一件事 —— 现在用的是哪本、哪一版、内容从哪来、
 * 能不能用。内部术语只留在代码里，不上屏。
 */

import type { ImportJob, RequestContext, ServiceError } from '@edu/domain';
import {
  ConfirmDialog,
  button,
  clear,
  emptyState,
  h,
  loadingState,
  notice,
  progressSummary,
  renderErrorBanner,
  statusChip,
} from '../../shell/src/index.js';
import { SourceReader } from './source-reader.js';
import {
  STAGE_LABELS,
  STAGE_ORDER,
  STATUS_LABELS,
  STATUS_TONES,
  describeImportError,
  formatLocalTime,
  stageStateLabel,
} from './labels.js';
import {
  bookChooser,
  bookHero,
  selectedFileCard,
  sourceListItem,
  trialBanner,
} from './components.js';
import { canCancel, canResume, canRetry, reduceJobUpdate } from './job-model.js';
import type {
  ImportMatch,
  ImportStartOutcome,
  LibraryBook,
  LibraryDataSource,
  MetadataDraft,
  SelectedFile,
  SourceListItem,
} from './types.js';

export interface LibraryControllerOptions {
  readonly dataSource: LibraryDataSource;
  readonly createRequest: () => RequestContext;
  readonly returnPath?: string | null;
}

interface LibraryState {
  books: readonly LibraryBook[];
  booksLoading: boolean;
  booksError: ServiceError | null;
  offline: boolean;
  selectedBookId: string | null;
  chooserOpen: boolean;
  sources: readonly SourceListItem[];
  sourcesLoading: boolean;
  sourcesError: ServiceError | null;
  sourcesOpen: boolean;
  selectedFile: SelectedFile | null;
  metadataDraft: MetadataDraft | null;
  job: ImportJob | null;
  match: ImportMatch | null;
  reused: boolean;
  importError: ServiceError | null;
  jobBusy: boolean;
  candidateTrialBookId: string | null;
  actionNotice: string;
}

export class LibraryController {
  private readonly options: LibraryControllerOptions;
  private readonly state: LibraryState = {
    books: [],
    booksLoading: false,
    booksError: null,
    offline: false,
    selectedBookId: null,
    chooserOpen: false,
    sources: [],
    sourcesLoading: false,
    sourcesError: null,
    sourcesOpen: false,
    selectedFile: null,
    metadataDraft: null,
    job: null,
    match: null,
    reused: false,
    importError: null,
    jobBusy: false,
    candidateTrialBookId: null,
    actionNotice: '',
  };
  private readonly renderers = new Set<() => void>();
  private contentContainer: HTMLElement | null = null;
  private importContainer: HTMLElement | null = null;
  private navigate: ((path: string) => void) | null = null;
  private loaded = false;
  private loadingPromise: Promise<void> | null = null;
  private sourcesToken = 0;
  private unsubscribeJob: (() => void) | null = null;
  private reader: SourceReader | null = null;
  private active = false;

  constructor(options: LibraryControllerOptions) {
    this.options = options;
  }

  getState(): Readonly<LibraryState> {
    return this.state;
  }

  onPageMount(): void {
    this.active = true;
    if (this.state.job !== null) this.subscribeJob(this.state.job.id);
  }

  onPageUnmount(): void {
    this.active = false;
    this.unsubscribeJob?.();
    this.unsubscribeJob = null;
    this.reader?.close();
    this.reader = null;
    this.renderers.clear();
    this.contentContainer = null;
    this.importContainer = null;
  }

  mountContent(container: HTMLElement, context: { readonly navigate: (path: string) => void }): void {
    this.contentContainer = container;
    this.navigate = context.navigate;
    this.renderers.add(() => this.renderContent());
    this.renderContent();
    void this.ensureBooks();
  }

  mountImport(container: HTMLElement, context: { readonly navigate: (path: string) => void }): void {
    this.importContainer = container;
    this.navigate = context.navigate;
    this.renderers.add(() => this.renderImport());
    this.renderImport();
    void this.ensureBooks();
  }

  async ensureBooks(force = false): Promise<void> {
    if (this.loaded && !force) return;
    if (this.loadingPromise !== null && !force) return this.loadingPromise;
    this.loadingPromise = (async () => {
      this.state.booksLoading = true;
      this.state.booksError = null;
      this.notify();
      const result = await this.options.dataSource.listBooks(this.options.createRequest());
      if (!result.ok) {
        this.state.booksLoading = false;
        this.state.booksError = result.error;
        this.state.offline = result.offline === true;
        this.notify();
        return;
      }
      this.state.books = result.data;
      this.state.offline = result.offline === true;
      this.state.booksLoading = false;
      this.loaded = true;
      const selected =
        result.data.find((book) => book.isCurrent) ??
        result.data.find((book) => book.materialState === 'baseline') ??
        result.data[0] ??
        null;
      this.state.selectedBookId = selected?.id ?? null;
      this.notify();
      if (selected !== null) await this.loadSources(selected.id);
    })();
    await this.loadingPromise;
    this.loadingPromise = null;
  }

  async selectBook(bookId: string): Promise<void> {
    if (this.state.selectedBookId === bookId && this.state.sources.length > 0) {
      this.state.selectedBookId = bookId;
      this.notify();
      return;
    }
    this.state.selectedBookId = bookId;
    this.state.sources = [];
    this.state.sourcesError = null;
    this.notify();
    await this.loadSources(bookId);
  }

  async loadSources(bookId: string): Promise<void> {
    const token = ++this.sourcesToken;
    this.state.sourcesLoading = true;
    this.state.sourcesError = null;
    this.notify();
    const result = await this.options.dataSource.listSources(this.options.createRequest(), bookId);
    if (token !== this.sourcesToken) return;
    this.state.sourcesLoading = false;
    if (!result.ok) {
      this.state.sourcesError = result.error;
      this.notify();
      return;
    }
    this.state.sources = result.data;
    this.notify();
  }

  /** 换一本：只切换当前课本，不猜测、不合并。 */
  chooseBook(book: LibraryBook): void {
    this.state.chooserOpen = false;
    void this.selectBook(book.id);
  }

  toggleChooser(): void {
    this.state.chooserOpen = !this.state.chooserOpen;
    this.notify();
    this.focusInContent('[data-action="switch-book"]');
  }

  toggleSources(): void {
    this.state.sourcesOpen = !this.state.sourcesOpen;
    this.notify();
    this.focusInContent('[data-action="toggle-sources"]');
  }

  /** 主按钮“用这本开始”：候选课本先要一次显式确认，然后进入地图。 */
  startCurrentBook(book: LibraryBook, trigger: HTMLElement): void {
    if (book.materialState === 'unavailable') return;
    if (book.materialState === 'candidate' && this.state.candidateTrialBookId !== book.id) {
      this.startCandidateTrial(book, trigger);
      return;
    }
    this.state.selectedBookId = book.id;
    this.navigate?.('/map');
  }

  /** 次按钮“导入新的”：沿用既有导入流程，接着走选择文件与元数据确认。 */
  openImportPanel(): void {
    const run = async (): Promise<void> => {
      if (this.state.job === null && this.state.selectedFile === null) await this.chooseFile();
      this.focusImportPanel();
    };
    void run();
  }

  async chooseFile(): Promise<void> {
    if (this.state.jobBusy) return;
    this.state.jobBusy = true;
    this.state.importError = null;
    this.notify();
    const result = await this.options.dataSource.chooseFile(this.options.createRequest());
    this.state.jobBusy = false;
    if (!result.ok) {
      this.state.importError = result.error;
      this.notify();
      return;
    }
    this.state.selectedFile = result.data;
    this.state.metadataDraft =
      result.data === null
        ? null
        : {
            title: result.data.suggestedMetadata.title ?? '',
            publisher: result.data.suggestedMetadata.publisher ?? '',
            editionLabel: result.data.suggestedMetadata.editionLabel ?? '',
            pageCount:
              result.data.suggestedMetadata.pageCount === null
                ? ''
                : String(result.data.suggestedMetadata.pageCount),
          };
    this.notify();
  }

  updateMetadata(field: keyof MetadataDraft, value: string): void {
    if (this.state.metadataDraft === null) return;
    this.state.metadataDraft = { ...this.state.metadataDraft, [field]: value };
  }

  async startImport(): Promise<void> {
    const file = this.state.selectedFile;
    const draft = this.state.metadataDraft;
    if (file === null || draft === null || this.state.jobBusy) return;
    const pageCount = draft.pageCount.trim() === '' ? null : Number(draft.pageCount);
    if (pageCount !== null && (!Number.isInteger(pageCount) || pageCount <= 0)) {
      this.state.actionNotice = '页数要填正整数；这次没有开始导入。';
      this.notify();
      return;
    }
    this.state.jobBusy = true;
    this.state.importError = null;
    this.state.actionNotice = '';
    this.notify();
    const result = await this.options.dataSource.startImport(this.options.createRequest(), {
      file: file.handle,
      confirmedMetadata: {
        title: draft.title.trim() === '' ? null : draft.title.trim(),
        publisher: draft.publisher.trim() === '' ? null : draft.publisher.trim(),
        editionLabel: draft.editionLabel.trim() === '' ? null : draft.editionLabel.trim(),
        pageCount,
      },
    });
    this.state.jobBusy = false;
    if (!result.ok) {
      this.state.importError = result.error;
      this.notify();
      return;
    }
    this.acceptImportOutcome(result.data);
  }

  private acceptImportOutcome(outcome: ImportStartOutcome): void {
    this.state.job = outcome.job;
    this.state.match = outcome.match;
    this.state.reused = outcome.reused;
    this.state.importError = null;
    this.state.actionNotice = '';
    this.subscribeJob(outcome.job.id);
    this.notify();
  }

  private subscribeJob(jobId: string): void {
    this.unsubscribeJob?.();
    this.unsubscribeJob = null;
    if (this.options.dataSource.watchImport !== undefined) {
      this.unsubscribeJob = this.options.dataSource.watchImport(jobId, (next) => this.applyJob(next));
    }
  }

  applyJob(next: ImportJob): void {
    const reduced = reduceJobUpdate(this.state.job, next);
    if (this.state.job !== null && reduced === this.state.job) return;
    this.state.job = reduced;
    this.notify();
  }

  async refreshJob(): Promise<void> {
    const job = this.state.job;
    if (job === null) return;
    const result = await this.options.dataSource.jobStatus(this.options.createRequest(), job.id);
    if (result.ok) this.applyJob(result.data);
    else this.state.importError = result.error;
    this.notify();
  }

  async cancelImport(): Promise<void> {
    const job = this.state.job;
    if (job === null || this.state.jobBusy) return;
    this.state.jobBusy = true;
    this.notify();
    const result = await this.options.dataSource.cancelImport(this.options.createRequest(), job.id);
    this.state.jobBusy = false;
    if (!result.ok) {
      this.state.importError = result.error;
    } else {
      this.state.job = result.data;
      this.state.actionNotice = '已取消导入；取消之后才回来的结果不会写进课本或学习记录。';
    }
    this.notify();
  }

  async resumeImport(): Promise<void> {
    const job = this.state.job;
    if (job === null || this.state.jobBusy) return;
    this.state.jobBusy = true;
    this.notify();
    const result = await this.options.dataSource.resumeImport(this.options.createRequest(), job.id);
    this.state.jobBusy = false;
    if (!result.ok) {
      this.state.importError = result.error;
    } else {
      this.state.job = result.data;
      this.state.actionNotice = '已接着上次的导入继续，不会重复建一本。';
    }
    this.notify();
  }

  async retryImport(): Promise<void> {
    const job = this.state.job;
    if (job === null || this.state.jobBusy) return;
    this.state.jobBusy = true;
    this.notify();
    const result = await this.options.dataSource.retryImport(this.options.createRequest(), job.id);
    this.state.jobBusy = false;
    if (!result.ok) {
      this.state.importError = result.error;
    } else {
      this.state.job = result.data;
      this.state.actionNotice = '已重试出错的那一步；做过的页面不会重复记。';
    }
    this.notify();
  }

  resetImport(): void {
    this.unsubscribeJob?.();
    this.unsubscribeJob = null;
    this.state.selectedFile = null;
    this.state.metadataDraft = null;
    this.state.job = null;
    this.state.match = null;
    this.state.reused = false;
    this.state.importError = null;
    this.state.actionNotice = '';
    this.notify();
  }

  startCandidateTrial(book: LibraryBook, trigger: HTMLElement): void {
    const dialog = new ConfirmDialog({
      title: '先试看这本',
      tone: 'default',
      acknowledgement: '我知道这本还没核对过，只能当参考。',
      impact: [
        '试看时页面会一直提示这本还没核对，结论也会更保守。',
        '点了确认也不会把它变成已经核对过的课本。',
        '随时可以退出试看，换回核对过的课本。',
      ],
      confirmLabel: '开始试看',
      onConfirm: () => {
        this.state.candidateTrialBookId = book.id;
        this.state.selectedBookId = book.id;
        this.state.chooserOpen = false;
        this.notify();
        void this.loadSources(book.id);
        this.navigate?.('/map');
      },
    });
    const parent = this.contentContainer ?? trigger.parentElement ?? trigger.ownerDocument.body;
    dialog.open(trigger, parent);
  }

  exitCandidateTrial(): void {
    this.state.candidateTrialBookId = null;
    this.notify();
    const baseline = this.state.books.find((book) => book.materialState === 'baseline');
    if (baseline !== undefined) void this.selectBook(baseline.id);
  }

  openSource(item: SourceListItem, trigger: HTMLElement): void {
    if (this.contentContainer === null) return;
    if (this.reader === null) {
      this.reader = new SourceReader({
        dataSource: this.options.dataSource,
        createRequest: this.options.createRequest,
        returnPath: this.options.returnPath ?? null,
        navigate: this.navigate,
      });
    }
    const index = this.state.sources.findIndex((source) => source.sourceRefId === item.sourceRefId);
    this.reader.open(this.state.sources, index < 0 ? 0 : index, trigger, this.contentContainer);
  }

  private currentBook(): LibraryBook | null {
    const id = this.state.selectedBookId;
    const found = id === null ? null : this.state.books.find((book) => book.id === id) ?? null;
    return found ?? this.state.books[0] ?? null;
  }

  private notify(): void {
    for (const renderer of this.renderers) renderer();
  }

  private focusInContent(selector: string): void {
    const container = this.contentContainer;
    if (container === null) return;
    container.querySelector<HTMLElement>(selector)?.focus();
  }

  private focusImportPanel(): void {
    const container = this.importContainer;
    if (container === null) return;
    container.querySelector<HTMLElement>('[data-testid="library-import-heading"]')?.focus();
    if (typeof container.scrollIntoView === 'function') {
      container.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  private renderContent(): void {
    const container = this.contentContainer;
    if (container === null) return;
    clear(container);
    const root = h('div', { class: 'edu-lib__content', 'data-testid': 'library-content-panel' });

    if (this.state.candidateTrialBookId !== null) {
      root.append(trialBanner(() => this.exitCandidateTrial()));
    }
    if (this.state.booksLoading) {
      root.append(loadingState({ title: '正在看这台电脑上的课本…', body: '没读到之前不会显示任何课本。' }));
      container.append(root);
      return;
    }
    if (this.state.booksError !== null) {
      root.append(
        renderErrorBanner(this.state.booksError, {
          onRetry: () => void this.ensureBooks(true),
          backLabel: '回到今天',
          onBack: () => this.navigate?.('/home'),
        }),
      );
      container.append(root);
      return;
    }
    const current = this.currentBook();
    if (current === null) {
      root.append(
        emptyState({
          title: '还没有课本',
          body: '先选一个本地 PDF，把正在用的那本放进来；不会凭空生成一本空课本。',
          testId: 'library-empty',
          actions: [
            { label: '选择本地 PDF', onClick: () => void this.chooseFile(), tone: 'primary' },
            { label: '看看记录', onClick: () => this.navigate?.('/records') },
          ],
        }),
      );
      container.append(root);
      return;
    }

    root.append(
      bookHero(current, {
        sourceCount: this.state.sources.length,
        chooserOpen: this.state.chooserOpen,
        onStart: (book, trigger) => this.startCurrentBook(book, trigger),
        onToggleChooser: () => this.toggleChooser(),
        onImport: () => this.openImportPanel(),
      }),
    );
    root.append(
      bookChooser(this.state.books, current.id, (book) => this.chooseBook(book), this.state.chooserOpen),
    );
    if (this.state.offline) {
      root.append(
        notice({
          tone: 'warning',
          title: '当前离线',
          body: '已经在本机的课本和原文还能看；需要联网的步骤会停下来，不会假装完成。',
          testId: 'library-offline',
        }),
      );
    }
    root.append(this.renderSources(current));
    root.append(
      h(
        'p',
        { class: 'edu-muted', 'data-testid': 'library-fixture-notice' },
        this.options.dataSource.notice ?? '演示数据（fixture）：这里的课本和来源都是样例，不是真实教材。',
      ),
    );
    container.append(root);
  }

  private renderSources(book: LibraryBook): HTMLElement {
    const open = this.state.sourcesOpen;
    const count = this.state.sources.length;
    const section = h('section', {
      class: 'edu-lib-sources',
      'data-testid': 'library-sources',
      'data-open': open ? 'true' : 'false',
    });
    const toggle = h(
      'button',
      {
        type: 'button',
        class: 'edu-lib-sources__toggle',
        'data-action': 'toggle-sources',
        'aria-expanded': open ? 'true' : 'false',
        'aria-controls': 'library-sources-body',
        onclick: () => this.toggleSources(),
      },
      h('span', { class: 'edu-lib-sources__count' }, count > 0 ? `${count} 条来源` : '课本原文'),
      h('span', { class: 'edu-lib-sources__hint' }, '课本原文从哪来'),
      h('span', { class: 'edu-lib-sources__chevron', 'aria-hidden': 'true' }, '▸'),
    );
    section.append(toggle);
    const body = h('div', {
      class: 'edu-lib-sources__body',
      id: 'library-sources-body',
      'data-testid': 'library-sources-body',
      hidden: !open,
    });
    if (!open) {
      section.append(body);
      return section;
    }
    body.append(
      h(
        'p',
        { class: 'edu-lib-sources__note' },
        'PDF 第几页和课本第几页不是同一个数字：每条来源两样都写着，点开能对照原句；认不出课本页时不会猜。',
      ),
    );
    if (this.state.sourcesLoading) {
      body.append(loadingState({ title: '正在读这本的原文位置…' }));
    } else if (this.state.sourcesError !== null) {
      body.append(
        renderErrorBanner(this.state.sourcesError, {
          headingLevel: 'h3',
          onRetry: () => void this.loadSources(this.state.selectedBookId ?? ''),
          backLabel: '回到今天',
          onBack: () => this.navigate?.('/home'),
        }),
      );
    } else if (this.state.sources.length === 0) {
      body.append(
        h(
          'p',
          { class: 'edu-state__body' },
          book.materialState === 'unavailable'
            ? '这本打不开，所以没有能对照的原文；不会伪造页面。'
            : '这本还没有能对照的原文位置。',
        ),
      );
    } else {
      const list = h('ul', { class: 'edu-lib-source-list' });
      for (const item of this.state.sources) {
        list.append(sourceListItem(item, (selected, trigger) => this.openSource(selected, trigger)));
      }
      body.append(list);
    }
    section.append(body);
    return section;
  }

  private renderImport(): void {
    const container = this.importContainer;
    if (container === null) return;
    clear(container);
    const root = h('section', { class: 'edu-lib__import', 'data-testid': 'library-import-panel' });
    root.append(
      h(
        'h2',
        { class: 'edu-section__title', tabindex: -1, 'data-testid': 'library-import-heading' },
        '导入新的课本',
      ),
      h(
        'p',
        { class: 'edu-section__lead' },
        '选一个本地 PDF，确认书名和版次后开始。',
      ),
    );
    if (this.state.offline) {
      root.append(
        notice({
          tone: 'warning',
          title: '当前离线',
          body: '本机已经导入的内容还能看；需要联网的步骤会停下来，不会假装完成。',
        }),
      );
    }

    if (this.state.job === null) {
      if (this.state.importError !== null) {
        root.append(
          renderErrorBanner(this.state.importError, {
            headingLevel: 'h3',
            onRetry: () => void this.chooseFile(),
            backLabel: '重新选择文件',
            onBack: () => void this.chooseFile(),
          }),
        );
      }
      if (this.state.selectedFile === null) {
        const choose = button('选择本地 PDF', () => void this.chooseFile(), {
          tone: 'primary',
          disabled: this.state.jobBusy,
          dataAction: 'choose-file',
        });
        root.append(h('div', { class: 'edu-inline-actions' }, choose));
      } else {
        root.append(selectedFileCard(this.state.selectedFile), this.renderMetadataForm());
      }
    } else {
      root.append(this.renderJob(this.state.job));
    }
    if (this.state.actionNotice.length > 0) {
      root.append(
        h(
          'p',
          {
            class: 'edu-notice edu-notice--info',
            role: 'status',
            'data-testid': 'library-action-notice',
          },
          this.state.actionNotice,
        ),
      );
    }
    container.append(root);
  }

  private renderMetadataForm(): HTMLElement {
    const draft = this.state.metadataDraft;
    if (draft === null) return h('p', {});
    const form = h('form', {
      class: 'edu-lib-form',
      'data-testid': 'library-metadata-form',
      onsubmit: (event: Event) => {
        event.preventDefault();
        void this.startImport();
      },
    });
    const field = (label: string, name: keyof MetadataDraft, type = 'text'): HTMLElement => {
      const input = h('input', {
        class: 'edu-input',
        type,
        id: `library-meta-${name}`,
        value: draft[name],
        oninput: (event: Event) => this.updateMetadata(name, (event.currentTarget as HTMLInputElement).value),
      });
      return h(
        'div',
        { class: 'edu-field' },
        h('label', { class: 'edu-field__label', for: `library-meta-${name}` }, label),
        input,
      );
    };
    form.append(
      field('书名（可以空着）', 'title'),
      field('出版社（可以空着）', 'publisher'),
      field('版次/印次（可以空着）', 'editionLabel'),
      field('页数', 'pageCount', 'number'),
    );
    form.append(
      h(
        'div',
        { class: 'edu-inline-actions' },
        button('开始导入', () => void this.startImport(), {
          tone: 'primary',
          disabled: this.state.jobBusy,
          dataAction: 'start-import',
        }),
        button('重新选择文件', () => void this.chooseFile(), {
          small: true,
          disabled: this.state.jobBusy,
        }),
      ),
    );
    form.append(
      h(
        'p',
        { class: 'edu-card__meta' },
        '这些信息只用来对上同一本书，不会因为填了书名就变成核对过的课本。页数和文件对不上时不会开始导入。',
      ),
    );
    return form;
  }

  private renderJob(job: ImportJob): HTMLElement {
    const wrapper = h('div', { class: 'edu-lib-job', 'data-testid': 'library-import-job' });
    wrapper.append(
      h(
        'div',
        { class: 'edu-lib-job__head' },
        h('h3', { class: 'edu-lib-job__title' }, '导入进度'),
        h(
          'div',
          { class: 'edu-inline-actions' },
          statusChip(STATUS_LABELS[job.status], STATUS_TONES[job.status]),
          statusChip(`现在：${STAGE_LABELS[job.stage]}`, job.stage === 'await_review' ? 'attention' : 'progress'),
        ),
      ),
      h('p', { class: 'edu-lib-status-line' }, `最近更新：${formatLocalTime(job.updatedAt)}`),
      progressSummary({
        label: '已经处理',
        current: job.completedUnits,
        total: job.totalUnits,
        note: '页数和阶段来自导入过程本身；没做完的不会显示成完成。',
      }),
    );

    const stages = h('ol', { class: 'edu-lib-stage-list', 'data-testid': 'library-stages' });
    for (const stage of STAGE_ORDER) {
      const current = stage === job.stage;
      const index = STAGE_ORDER.indexOf(stage);
      const currentIndex = STAGE_ORDER.indexOf(job.stage);
      const done = index < currentIndex;
      const blocked = current && (job.status === 'failed' || job.status === 'cancelled');
      stages.append(
        h(
          'li',
          {
            class: 'edu-lib-stage',
            'aria-current': current ? 'step' : undefined,
            'data-state': done ? 'done' : blocked ? 'blocked' : current ? 'current' : 'future',
          },
          h('span', { class: 'edu-lib-stage__name' }, STAGE_LABELS[stage]),
          h('span', { class: 'edu-lib-stage__state' }, stageStateLabel(stage, job.stage, job.status)),
        ),
      );
    }
    wrapper.append(stages);

    if (this.state.reused) {
      wrapper.append(
        notice({
          tone: 'info',
          title: '这本书之前导入过',
          body: '没有重复建课本，接着用原来那一份。',
          testId: 'library-duplicate-notice',
        }),
      );
    }
    if (this.state.match !== null) {
      wrapper.append(
        notice({
          tone: this.state.match.kind === 'same_hash' || this.state.match.kind === 'same_edition_rescan' ? 'info' : 'warning',
          title: '这本和已有的课本对上了吗',
          body: matchSentence(this.state.match),
          testId: 'library-match-notice',
        }),
      );
    }

    if (job.stage === 'await_review') {
      wrapper.append(
        notice({
          tone: 'warning',
          title: '还在核对，不算导入完成',
          body: '内容已经整理好，等确认过才能当成核对过的课本；现在不会显示“完成”。',
          testId: 'library-await-review',
        }),
      );
    } else if (job.stage === 'ready' && job.status === 'completed') {
      wrapper.append(
        notice({
          tone: 'info',
          title: '这本可以用了',
          body: '目前放进去的是这本书的一部分；范围之外的章节还看不到，也不会假装都有。',
          testId: 'library-ready',
        }),
      );
    }

    if (job.error !== null) {
      const copy = describeImportError(job.error.code, job.error.retryable);
      const tone = job.status === 'paused' ? 'warning' : 'danger';
      wrapper.append(
        h(
          'div',
          {
            class: `edu-notice edu-notice--${tone}`,
            role: job.status === 'failed' ? 'alert' : 'status',
            'data-testid': 'library-import-error',
          },
          h('p', { class: 'edu-notice__title' }, copy.title),
          h('p', { class: 'edu-notice__body' }, copy.detail),
          h('p', { class: 'edu-notice__body' }, `下一步：${copy.next}`),
        ),
      );
    }

    if (job.status === 'cancelled') {
      wrapper.append(
        notice({
          tone: 'info',
          title: '导入已取消',
          body: '取消之后才回来的结果不会写进课本或学习记录；可以接着恢复，也可以重新选择文件。',
          testId: 'library-cancelled',
        }),
      );
    }

    const actions = h('div', { class: 'edu-inline-actions' });
    if (canCancel(job)) {
      actions.append(
        button('取消导入', () => void this.cancelImport(), {
          small: true,
          tone: 'danger-ghost',
          disabled: this.state.jobBusy,
          dataAction: 'cancel-import',
        }),
      );
    }
    if (canRetry(job)) {
      actions.append(
        button('重试出错的那一步', () => void this.retryImport(), {
          small: true,
          tone: 'primary',
          disabled: this.state.jobBusy,
          dataAction: 'retry-import',
        }),
      );
    } else if (canResume(job) && job.stage !== 'await_review') {
      actions.append(
        button(job.status === 'failed' ? '接着做' : '接着导入', () => void this.resumeImport(), {
          small: true,
          disabled: this.state.jobBusy,
          dataAction: 'resume-import',
        }),
      );
    }
    actions.append(
      button('刷新进度', () => void this.refreshJob(), {
        small: true,
        disabled: this.state.jobBusy,
        dataAction: 'refresh-import',
      }),
    );
    actions.append(button('重新选择文件', () => this.resetImport(), { small: true }));
    if (job.stage === 'ready' || job.stage === 'await_review') {
      actions.append(button('去地图看看', () => this.navigate?.('/map'), { small: true }));
    }
    wrapper.append(actions);
    return wrapper;
  }
}

/** 匹配结果用学生话讲，不直接念服务端标签。 */
function matchSentence(match: ImportMatch): string {
  switch (match.kind) {
    case 'same_hash':
      return '同一个文件已经在这台电脑上，接着用原来那一份。';
    case 'same_edition_rescan':
      return '同一版的另一份扫描：页码要重新对一遍，先当参考。';
    case 'different_edition':
      return '和已经核对过的版本对不上，先当参考。';
    default:
      return '没认出是哪一版，先当参考用。';
  }
}

export type { LibraryState };
