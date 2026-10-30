/**
 * Library controller: owns view state shared by the page and its two panels.
 * It never decides whether content is a baseline; that is a server match result.
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
import { bookCard, candidateBanner, fixtureNotice, selectedFileCard, sourceListItem } from './components.js';
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
  sources: readonly SourceListItem[];
  sourcesLoading: boolean;
  sourcesError: ServiceError | null;
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
    sources: [],
    sourcesLoading: false,
    sourcesError: null,
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
      this.state.actionNotice = '页数需要是正整数；没有开始导入。';
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
      this.state.actionNotice = '已取消导入；取消后到达的迟到结果不会写入教材或学习记录。';
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
      this.state.actionNotice = '已恢复同一导入任务；不会重复建书。';
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
      this.state.actionNotice = '已重试失败阶段；不会重复记录已完成页。';
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
      title: '以候选身份试用（未核实）',
      tone: 'danger',
      acknowledgement: '我了解候选内容未核实，不能作为基准或强掌握结论。',
      impact: [
        '候选身份会贯穿地图、阅读与反馈；界面持续显示“候选（未核实）”。',
        '不会因为点击确认就把候选变成已审校基准。',
        '可以随时退出候选试用，回到已核实材料。',
      ],
      confirmLabel: '确认以候选身份试用',
      onConfirm: () => {
        this.state.candidateTrialBookId = book.id;
        this.state.selectedBookId = book.id;
        this.state.actionNotice = '已进入候选试用；强结论仍被禁用，候选标识不会消失。';
        this.notify();
        void this.loadSources(book.id);
      },
    });
    const parent = this.contentContainer ?? trigger.parentElement ?? trigger.ownerDocument.body;
    dialog.open(trigger, parent);
  }

  exitCandidateTrial(): void {
    this.state.candidateTrialBookId = null;
    this.state.actionNotice = '已退出候选试用。';
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

  private notify(): void {
    for (const renderer of this.renderers) renderer();
  }

  private renderContent(): void {
    const container = this.contentContainer;
    if (container === null) return;
    clear(container);
    const root = h('div', { class: 'edu-lib', 'data-testid': 'library-content-panel' });
    root.append(fixtureNotice(this.options.dataSource.notice ?? '演示数据（fixture）'));
    if (this.state.candidateTrialBookId !== null) {
      root.append(candidateBanner(() => this.exitCandidateTrial()));
    }
    if (this.state.booksLoading) {
      root.append(loadingState({ title: '正在读取教材库…', body: '不会显示虚构的教材或进度。' }));
      container.append(root);
      return;
    }
    if (this.state.booksError !== null) {
      root.append(
        renderErrorBanner(this.state.booksError, {
          onRetry: () => void this.ensureBooks(true),
          backLabel: '返回首页',
          onBack: () => this.navigate?.('/home'),
        }),
      );
      container.append(root);
      return;
    }
    if (this.state.books.length === 0) {
      root.append(
        emptyState({
          title: '还没有可用教材',
          body: '先选择本地 PDF 或连接已有教材；不会生成空壳全册地图。',
          testId: 'library-empty',
          actions: [
            { label: '选择本地 PDF', onClick: () => void this.chooseFile(), tone: 'primary' },
            { label: '查看记录', onClick: () => this.navigate?.('/records') },
          ],
        }),
      );
      container.append(root);
      return;
    }

    const groups: readonly { title: string; state: LibraryBook['materialState']; books: readonly LibraryBook[] }[] = [
      { title: '本期匹配基准', state: 'baseline', books: this.state.books.filter((book) => book.materialState === 'baseline') },
      { title: '待核实候选', state: 'candidate', books: this.state.books.filter((book) => book.materialState === 'candidate') },
      { title: '不可用材料', state: 'unavailable', books: this.state.books.filter((book) => book.materialState === 'unavailable') },
    ];
    for (const group of groups) {
      if (group.books.length === 0) continue;
      const section = h(
        'section',
        { class: 'edu-section', 'data-testid': `library-group-${group.state}` },
        h('h2', { class: 'edu-section__title' }, group.title),
        h(
          'p',
          { class: 'edu-section__lead' },
          group.state === 'candidate'
            ? '候选内容未核实；只有显式试用后才会打开，标识会持续可见。'
            : group.state === 'unavailable'
              ? '这些材料不可用，但不会删除其他教材或个人记录。'
              : '已匹配本期基准；内容范围仍需按包声明显示。',
        ),
      );
      const grid = h('div', { class: 'edu-lib-grid' });
      for (const book of group.books) {
        grid.append(
          bookCard(book, {
            candidateTrial: this.state.candidateTrialBookId === book.id,
            onViewSources: (selected) => void this.selectBook(selected.id),
            onTrialCandidate: (selected, trigger) => this.startCandidateTrial(selected, trigger),
            onExitTrial: () => this.exitCandidateTrial(),
            onChooseFile: () => {
              this.resetImport();
              void this.chooseFile();
            },
            onSetCurrent: (selected) => void this.selectBook(selected.id),
          }),
        );
      }
      section.append(grid);
      root.append(section);
    }

    root.append(this.renderSources());
    container.append(root);
  }

  private renderSources(): HTMLElement {
    const book = this.state.books.find((entry) => entry.id === this.state.selectedBookId) ?? null;
    const section = h(
      'section',
      { class: 'edu-section', 'data-testid': 'library-sources' },
      h('h2', { class: 'edu-section__title' }, '来源阅读'),
      h(
        'p',
        { class: 'edu-section__lead' },
        book === null
          ? '选择一本教材后查看来源。'
          : `${book.title} · PDF 页序与印刷页码分开显示；查看来源不会提交作答。`,
      ),
    );
    if (this.state.sourcesLoading) {
      section.append(loadingState({ title: '正在读取来源列表…' }));
      return section;
    }
    if (this.state.sourcesError !== null) {
      section.append(
        renderErrorBanner(this.state.sourcesError, {
          onRetry: () => void this.loadSources(this.state.selectedBookId ?? ''),
          backLabel: '返回教材库',
          onBack: () => this.navigate?.('/library'),
        }),
      );
      return section;
    }
    if (this.state.sources.length === 0) {
      section.append(
        h(
          'p',
          { class: 'edu-state__body' },
          book?.materialState === 'unavailable'
            ? '不可用材料没有可阅读来源；教材库不会伪造页面。'
            : '当前教材还没有可显示的来源条目。',
        ),
      );
      return section;
    }
    const list = h('ul', { class: 'edu-lib-source-list' });
    for (const item of this.state.sources) {
      list.append(sourceListItem(item, (selected, trigger) => this.openSource(selected, trigger)));
    }
    section.append(list);
    return section;
  }

  private renderImport(): void {
    const container = this.importContainer;
    if (container === null) return;
    clear(container);
    const root = h('div', { class: 'edu-lib', 'data-testid': 'library-import-panel' });
    root.append(
      h('h2', { class: 'edu-section__title' }, '导入教材'),
      h(
        'p',
        { class: 'edu-section__lead' },
        '选择本地 PDF 后确认元数据再开始；进度、取消、恢复与失败都显示真实阶段。上传范围会在发送前说明，不默认上传整本。',
      ),
      h(
        'p',
        { class: 'edu-muted', 'data-testid': 'library-import-fixture' },
        '导入任务为演示数据（fixture），不是真实解析结果。',
      ),
    );
    if (this.state.candidateTrialBookId !== null) {
      root.append(candidateBanner(() => this.exitCandidateTrial()));
    }
    if (this.state.offline) {
      root.append(
        notice({
          tone: 'warning',
          title: '当前离线',
          body: '本地选择与已完成页面仍可查看；云端步骤会暂停，不会伪装完成。',
        }),
      );
    }

    if (this.state.job === null) {
      if (this.state.importError !== null) {
        root.append(
          renderErrorBanner(this.state.importError, {
            onRetry: () => void this.chooseFile(),
            backLabel: '重新选择文件',
            onBack: () => void this.chooseFile(),
          }),
        );
      }
      if (this.state.selectedFile === null) {
        root.append(
          h(
            'div',
            { class: 'edu-lib-file' },
            h('p', { class: 'edu-card__title' }, '还没有选择文件'),
            h(
              'p',
              { class: 'edu-card__meta' },
              '只接受宿主管理的 PDF；选择本身不会上传或导入。',
            ),
            h(
              'div',
              { class: 'edu-inline-actions' },
              button('选择本地 PDF 文件', () => void this.chooseFile(), {
                tone: 'primary',
                disabled: this.state.jobBusy,
                dataAction: 'choose-file',
              }),
            ),
          ),
        );
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
          { class: 'edu-notice edu-notice--info', role: 'status', 'data-testid': 'library-action-notice' },
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
      return h('div', { class: 'edu-field' }, h('label', { class: 'edu-field__label', for: `library-meta-${name}` }, label), input);
    };
    form.append(
      field('书名（可空）', 'title'),
      field('出版社（可空）', 'publisher'),
      field('版次/印次（可空）', 'editionLabel'),
      field('页数', 'pageCount', 'number'),
    );
    form.append(
      h(
        'div',
        { class: 'edu-inline-actions' },
        button('确认元数据并开始导入', () => void this.startImport(), {
          tone: 'primary',
          disabled: this.state.jobBusy,
          dataAction: 'start-import',
        }),
        button('重新选择文件', () => void this.chooseFile(), { small: true, disabled: this.state.jobBusy }),
      ),
    );
    form.append(
      h(
        'p',
        { class: 'edu-card__meta' },
        '元数据只用于匹配/候选标识，不会因为填写书名就成为已核实基准。页数与实际文件不一致时服务会拒绝。',
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
        h('h3', { class: 'edu-lib-job__title' }, `导入任务 ${job.id}`),
        h(
          'div',
          { class: 'edu-inline-actions' },
          statusChip(STATUS_LABELS[job.status], STATUS_TONES[job.status]),
          statusChip(`当前阶段：${STAGE_LABELS[job.stage]}`, job.stage === 'await_review' ? 'attention' : 'progress'),
        ),
      ),
      h(
        'p',
        { class: 'edu-lib-status-line' },
        `解析器 ${job.parserVersion} · 更新于 ${formatLocalTime(job.updatedAt)}`,
      ),
      progressSummary({
        label: '已处理页数',
        current: job.completedUnits,
        total: job.totalUnits,
        note: '阶段与页数由导入服务返回；界面不伪造进度，也不把等待审校当作完成。',
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
          title: '同一文件已存在，已复用任务',
          body: '没有重复建书；同一指纹的既有任务被继续使用。',
          testId: 'library-duplicate-notice',
        }),
      );
    }
    if (this.state.match !== null) {
      wrapper.append(
        notice({
          tone: this.state.match.kind === 'same_hash' || this.state.match.kind === 'same_edition_rescan' ? 'info' : 'warning',
          title: '匹配结果',
          body: this.state.match.label,
          testId: 'library-match-notice',
        }),
      );
    }

    if (job.stage === 'await_review') {
      wrapper.append(
        notice({
          tone: 'warning',
          title: '待审核：不是导入完成',
          body: '内容已到达审校队列；在审校完成前不能作为已核实基准，也不显示“已完成”。',
          testId: 'library-await-review',
        }),
      );
    } else if (job.stage === 'ready' && job.status === 'completed') {
      wrapper.append(
        notice({
          tone: 'info',
          title: '材料就绪（按包声明的范围）',
          body: '材料已就绪；若为部分范围，不等于全册就绪。请查看内容范围与来源。',
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
          h('p', { class: 'edu-notice__body' }, `错误代码：${copy.code}`),
        ),
      );
    }

    if (job.status === 'cancelled') {
      wrapper.append(
        notice({
          tone: 'info',
          title: '导入已取消',
          body: '取消后到达的迟到结果不会写入教材或学习记录；可以恢复同一任务或重新选择文件。',
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
        button('重试失败阶段', () => void this.retryImport(), {
          small: true,
          tone: 'primary',
          disabled: this.state.jobBusy,
          dataAction: 'retry-import',
        }),
      );
    } else if (canResume(job) && job.stage !== 'await_review') {
      actions.append(
        button(job.status === 'failed' ? '恢复任务' : '恢复导入', () => void this.resumeImport(), {
          small: true,
          disabled: this.state.jobBusy,
          dataAction: 'resume-import',
        }),
      );
    }
    actions.append(
      button('刷新状态', () => void this.refreshJob(), {
        small: true,
        disabled: this.state.jobBusy,
        dataAction: 'refresh-import',
      }),
    );
    actions.append(button('重新选择文件', () => this.resetImport(), { small: true }));
    if (job.stage === 'ready' || job.stage === 'await_review') {
      actions.append(button('去地图查看材料', () => this.navigate?.('/map'), { small: true }));
    }
    wrapper.append(actions);
    return wrapper;
  }
}

export type { LibraryState };
