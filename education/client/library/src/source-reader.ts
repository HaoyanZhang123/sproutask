/**
 * Controlled source reader.
 *
 * PDF page order and printed page label are shown in separate columns with
 * explicit units. The page image is addressed only by a host-managed assetId
 * plus normalized bbox; fixture mode shows a schematic placeholder, never a
 * fabricated textbook page. A failed lookup shows an explanation and a return
 * path, never a guessed page.
 */

import type { RequestContext, SourceBlock, Figure } from '@edu/domain';
import {
  Modal,
  button,
  h,
  clear,
  renderErrorBanner,
  statusChip,
} from '../../shell/src/index.js';
import {
  BLOCK_TYPE_LABELS,
  REVIEW_STATE_LABELS,
  SOURCE_VERIFICATION_LABELS,
} from './labels.js';
import type { LibraryDataSource, SourceListItem, SourceView } from './types.js';

export interface SourceReaderOptions {
  readonly dataSource: LibraryDataSource;
  readonly createRequest: () => RequestContext;
  readonly returnPath: string | null;
  readonly navigate: ((path: string) => void) | null;
}

export class SourceReader {
  private readonly options: SourceReaderOptions;
  private modal: Modal | null = null;
  private content: HTMLElement | null = null;
  private trigger: HTMLElement | null = null;
  private items: readonly SourceListItem[] = [];
  private index = 0;
  private loadToken = 0;

  constructor(options: SourceReaderOptions) {
    this.options = options;
  }

  open(items: readonly SourceListItem[], index: number, trigger: HTMLElement, parent: HTMLElement): void {
    this.items = items;
    this.index = Math.max(0, Math.min(index, items.length - 1));
    this.trigger = trigger;
    const content = h('div', {
      class: 'edu-lib-reader',
      'data-testid': 'source-reader',
      tabindex: -1,
    });
    this.content = content;
    this.modal = new Modal('来源阅读', content, '关闭来源');
    this.modal.element.addEventListener('keydown', (event) => this.onKeydown(event));
    this.modal.open(trigger, parent);
    void this.load();
  }

  close(): void {
    this.loadToken += 1;
    this.modal?.close();
    this.modal = null;
    this.content = null;
    this.trigger = null;
  }

  private onKeydown(event: KeyboardEvent): void {
    if (this.content === null) return;
    if (event.key === 'ArrowDown' || event.key === 'ArrowRight') {
      if (this.index >= this.items.length - 1) return;
      event.preventDefault();
      this.index += 1;
      void this.load();
    } else if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') {
      if (this.index <= 0) return;
      event.preventDefault();
      this.index -= 1;
      void this.load();
    }
  }

  private async load(): Promise<void> {
    const content = this.content;
    if (content === null) return;
    const item = this.items[this.index];
    if (item === undefined) {
      clear(content);
      content.append(
        h('p', { class: 'edu-state__body' }, '没有可打开的来源条目。'),
        h('div', { class: 'edu-inline-actions' }, button('返回教材库', () => this.close())),
      );
      return;
    }
    const token = ++this.loadToken;
    clear(content);
    content.append(h('p', { class: 'edu-state__body', role: 'status' }, '正在打开来源…'));
    const result = await this.options.dataSource.openSource(this.options.createRequest(), item.sourceRefId);
    if (token !== this.loadToken || this.content === null) return;
    clear(content);
    if (!result.ok) {
      content.append(
        h('h3', { class: 'edu-card__title' }, '无法定位来源'),
        h(
          'p',
          { class: 'edu-lib-status-line' },
          '来源文件、页码或资产不可用；没有跳转到任何页面，也不会编造引用位置。',
        ),
        renderErrorBanner(result.error, {
          headingLevel: 'h3',
          onBack: () => this.close(),
          backLabel: '返回教材库',
        }),
      );
      return;
    }
    this.renderSource(content, result.data);
    content.focus();
  }

  private renderSource(content: HTMLElement, source: SourceView): void {
    content.append(
      h(
        'div',
        { class: 'edu-lib-reader-nav' },
        button('上一处', () => {
          if (this.index > 0) {
            this.index -= 1;
            void this.load();
          }
        }, { small: true, disabled: this.index <= 0 }),
        button('下一处', () => {
          if (this.index < this.items.length - 1) {
            this.index += 1;
            void this.load();
          }
        }, { small: true, disabled: this.index >= this.items.length - 1 }),
        h('span', { class: 'edu-muted' }, `第 ${this.index + 1} / ${this.items.length} 处 · 可用 ↑/↓ 切换`),
      ),
      h(
        'p',
        { class: 'edu-lib-status-line' },
        `${source.bookTitle} · ${source.editionLabel} · ${source.pageCount} 页`,
      ),
      h(
        'div',
        { class: 'edu-lib-page-info' },
        h(
          'div',
          { class: 'edu-lib-page-info__box', 'data-testid': 'source-pdf-page' },
          h('p', { class: 'edu-lib-page-info__label' }, 'PDF 页序（1 基）'),
          h('p', { class: 'edu-lib-page-info__value' }, `PDF 第 ${source.sourceRef.pdfPage} 页`),
        ),
        h(
          'div',
          { class: 'edu-lib-page-info__box', 'data-testid': 'source-printed-page' },
          h('p', { class: 'edu-lib-page-info__label' }, '印刷页码（课本页脚/页眉标签）'),
          h(
            'p',
            { class: 'edu-lib-page-info__value' },
            source.sourceRef.printedPage === null
              ? '未识别（不推算）'
              : `课本第 ${source.sourceRef.printedPage} 页`,
          ),
        ),
      ),
      h(
        'p',
        { class: 'edu-lib-status-line' },
        'PDF 页序与印刷页码是不同单位，不能互相替代；未识别时不做偏移猜测。',
      ),
    );

    if (source.candidate) {
      content.append(statusChip('候选来源（未核实）', 'attention'));
    }
    content.append(
      h(
        'div',
        { class: 'edu-inline-actions' },
        statusChip(SOURCE_VERIFICATION_LABELS[source.sourceRef.verification.state], 'neutral'),
        statusChip(`审校：${REVIEW_STATE_LABELS[source.candidate ? 'candidate' : source.block?.reviewState ?? source.figure?.reviewState ?? 'candidate']}`, 'neutral'),
        h('span', { class: 'edu-muted', 'data-testid': 'source-verification' }, `来源核实：${source.sourceRef.verification.notes ?? '无说明'}`),
      ),
    );

    if (source.pageImage === null) {
      content.append(
        h(
          'p',
          { class: 'edu-lib-status-line' },
          '本来源没有受控页图；只显示准确页码与出处，不伪造页面图像。',
        ),
      );
    } else {
      const image = source.pageImage;
      const page = h('div', {
        class: 'edu-lib-page',
        role: 'img',
        'aria-label': image.altText,
        'data-asset-id': image.assetId,
        'data-testid': 'source-page-image',
      });
      page.append(
        h(
          'span',
          { class: 'edu-lib-page__fixture' },
          `受控页图位置 · ${image.assetId}${image.fixtureOnly ? '（fixture 示意，不含真实页面图像）' : ''}`,
        ),
      );
      const region = h('span', {
        class: 'edu-lib-region',
        'data-bbox': `${image.bbox.x},${image.bbox.y},${image.bbox.width},${image.bbox.height}`,
        'data-testid': 'source-bbox',
      });
      region.style.left = `${image.bbox.x * 100}%`;
      region.style.top = `${image.bbox.y * 100}%`;
      region.style.width = `${image.bbox.width * 100}%`;
      region.style.height = `${image.bbox.height * 100}%`;
      region.append(h('span', { class: 'edu-lib-region__label' }, '当前区域'));
      page.append(region);
      content.append(
        page,
        h(
          'p',
          { class: 'edu-lib-status-line' },
          '区域使用归一化坐标（0–1）；只接受宿主受管页图句柄，不使用本机路径。',
        ),
      );
    }

    if (source.block !== null) content.append(this.renderBlock(source.block));
    if (source.figure !== null) content.append(this.renderFigure(source.figure));

    const actions = h('div', { class: 'edu-inline-actions' });
    if (this.options.returnPath !== null && this.options.navigate !== null) {
      actions.append(
        button(
          '返回原活动',
          () => {
            const path = this.options.returnPath;
            this.close();
            if (path !== null) this.options.navigate?.(path);
          },
          { small: true, tone: 'primary' },
        ),
      );
    }
    actions.append(button('关闭来源', () => this.close(), { small: true }));
    content.append(
      h(
        'p',
        { class: 'edu-muted' },
        '查看来源不会提交作答、不会改变理解判断；关闭后焦点返回刚才的来源按钮。',
      ),
      actions,
    );
  }

  private renderBlock(block: SourceBlock): HTMLElement {
    return h(
      'div',
      { class: 'edu-lib-block', 'data-block-id': block.id },
      h('p', { class: 'edu-card__title' }, `${BLOCK_TYPE_LABELS[block.type]}来源块`),
      h(
        'p',
        { class: 'edu-lib-block__text' },
        block.revisedText ?? block.originalText,
      ),
      h(
        'p',
        { class: 'edu-lib-status-line' },
        `提取方式：${block.extractionMethod === 'ocr' ? 'OCR' : block.extractionMethod === 'text_layer' ? '文本层' : '人工'} · 审校：${REVIEW_STATE_LABELS[block.reviewState]}`,
      ),
    );
  }

  private renderFigure(figure: Figure): HTMLElement {
    return h(
      'div',
      { class: 'edu-lib-block', 'data-figure-id': figure.id },
      h('p', { class: 'edu-card__title' }, '图示来源'),
      h('p', { class: 'edu-lib-block__text' }, figure.caption ?? '未提供图注'),
      h(
        'p',
        { class: 'edu-lib-status-line' },
        `类型：${figure.type === 'diagram' ? '示意图' : figure.type === 'photo' ? '照片' : figure.type} · 当前资产：${figure.activeAssetId} · 审校：${REVIEW_STATE_LABELS[figure.reviewState]}`,
      ),
    );
  }
}
