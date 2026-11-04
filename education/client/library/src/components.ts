/** Presentational pieces of `/library`（我的课本）, built from shell primitives. */

import { button, h, statusChip } from '../../shell/src/index.js';
import {
  MATERIAL_STATE_WORDS,
  SOURCE_VERIFICATION_LABELS,
  SUBJECT_LABELS,
  formatBytes,
} from './labels.js';
import type { LibraryBook, SelectedFile, SourceListItem } from './types.js';

/** 年级/册次一句话，例如“七年级上册”。 */
export function gradeTerm(book: LibraryBook): string {
  return `${book.grade} 年级${book.term === 1 ? '上册' : '下册'}`;
}

/** 版本和内容都核对过才算“已经核对”。 */
export function bookIsVerified(book: LibraryBook): boolean {
  return (
    book.editionVerification === 'verified' &&
    (book.reviewState === 'published' || book.reviewState === 'curator_checked')
  );
}

/**
 * 整页唯一的核实标识：`待核实` 或 `已核对`（打不开的课本写 `打不开`）。
 * 其他位置一律用不带颜色的文字，避免同一句话重复出现。
 */
export function verifiedChip(book: LibraryBook): HTMLElement {
  if (book.materialState === 'unavailable') {
    return statusChip('打不开', 'danger', {
      testId: 'library-verified-chip',
      detail: '这本课本的文件读不出来，先换一本',
    });
  }
  return bookIsVerified(book)
    ? statusChip('已核对', 'positive', {
        testId: 'library-verified-chip',
        detail: '版本和内容都核对过了',
      })
    : statusChip('待核实', 'attention', {
        testId: 'library-verified-chip',
        detail: '版本或内容还没核对，先当参考',
      });
}

/** 纯 CSS 封面：不加载任何图片，也不含真实教材图。 */
export function bookCover(book: LibraryBook): HTMLElement {
  return h(
    'div',
    { class: 'edu-lib-cover', 'aria-hidden': 'true' },
    h('span', { class: 'edu-lib-cover__brand' }, '义务教育教科书'),
    h('span', { class: 'edu-lib-cover__subject' }, SUBJECT_LABELS[book.subject] ?? '课本'),
    h('span', { class: 'edu-lib-cover__grade' }, gradeTerm(book)),
  );
}

/** 一句学生话：这本收了哪些页、能对照多少处原文。 */
export function rangeSentence(book: LibraryBook, sourceCount: number): string {
  if (book.materialState === 'unavailable') {
    return book.unavailableReason ?? '这本课本打不开；已经保存的记录不受影响。';
  }
  const total = book.pageCount > 0 ? `全册 ${book.pageCount} 页` : '还没读到这本的页数';
  if (sourceCount === 0) return `${total}，还没有可以对照的原文。`;
  return `${total}，已经标出 ${sourceCount} 处原文，点开就能对照。`;
}

export interface BookHeroHandlers {
  readonly sourceCount: number;
  readonly onStart: (book: LibraryBook, trigger: HTMLElement) => void;
  readonly onToggleChooser: () => void;
  readonly onImport: () => void;
  readonly chooserOpen: boolean;
}

export function bookHero(book: LibraryBook, handlers: BookHeroHandlers): HTMLElement {
  const usable = book.materialState !== 'unavailable';
  const startButton = usable
    ? button(
        '用这本开始',
        () => {
          if (startButton !== null) handlers.onStart(book, startButton);
        },
        { tone: 'primary', dataAction: 'start-book' },
      )
    : null;
  if (startButton !== null) startButton.setAttribute('data-testid', 'library-start');

  const switchButton = button('换一本', () => handlers.onToggleChooser(), {
    dataAction: 'switch-book',
  });
  switchButton.setAttribute('aria-expanded', handlers.chooserOpen ? 'true' : 'false');
  switchButton.setAttribute('aria-controls', 'library-book-chooser');
  switchButton.setAttribute(
    'title',
    handlers.chooserOpen ? '收起其他课本' : '看看这台电脑上还有哪些课本',
  );

  const importButton = button('导入新的', () => handlers.onImport(), {
    dataAction: 'import-new',
  });
  importButton.setAttribute('data-testid', 'library-import');

  const actions = h('div', { class: 'edu-lib-hero__actions' });
  if (startButton !== null) actions.append(startButton);
  actions.append(switchButton, importButton);

  const card = h('article', {
    class: 'edu-lib-hero',
    'data-testid': 'library-book-card',
    'data-book-id': book.id,
    'data-state': book.materialState,
    'aria-label': '现在用的课本',
  });
  card.append(
    bookCover(book),
    h(
      'div',
      { class: 'edu-lib-hero__main' },
      h('p', { class: 'edu-lib-hero__eyebrow' }, '现在用的是'),
      h('h2', { class: 'edu-lib-hero__title' }, book.title),
      h('p', { class: 'edu-lib-hero__meta' }, `${book.publisher} · ${gradeTerm(book)}`),
      h(
        'p',
        { class: 'edu-lib-hero__status' },
        verifiedChip(book),
        h('span', { class: 'edu-lib-hero__scope' }, book.scope === 'partial' ? '先做了其中一部分' : '整册都在'),
      ),
      h('p', { class: 'edu-lib-hero__range' }, rangeSentence(book, handlers.sourceCount)),
      actions,
    ),
  );
  return card;
}

/** “换一本”展开的清单：整行都是按钮，状态只写文字。 */
export function bookChooser(
  books: readonly LibraryBook[],
  currentId: string | null,
  onChoose: (book: LibraryBook) => void,
  open: boolean,
): HTMLElement {
  const wrap = h('div', {
    class: 'edu-lib-chooser',
    id: 'library-book-chooser',
    'data-testid': 'library-book-chooser',
    role: 'group',
    'aria-label': '这台电脑上的课本',
    hidden: !open,
  });
  const others = books.filter((book) => book.id !== currentId);
  if (others.length === 0) {
    wrap.append(
      h(
        'p',
        { class: 'edu-lib-chooser__empty' },
        '这台电脑上只有这一本。要再添一本，点“导入新的”。',
      ),
    );
    return wrap;
  }
  for (const book of others) {
    const row = h(
      'button',
      {
        type: 'button',
        class: 'edu-lib-choice',
        'data-action': 'choose-book',
        'data-book-id': book.id,
        'data-state': book.materialState,
        onclick: () => onChoose(book),
      },
      h(
        'span',
        { class: 'edu-lib-choice__text' },
        h('span', { class: 'edu-lib-choice__title' }, book.title),
        h('span', { class: 'edu-lib-choice__meta' }, `${book.publisher} · ${gradeTerm(book)}`),
      ),
      h('span', { class: 'edu-lib-choice__state' }, MATERIAL_STATE_WORDS[book.materialState]),
    );
    wrap.append(row);
  }
  wrap.append(
    h(
      'p',
      { class: 'edu-lib-chooser__empty' },
      '换过去以后，这一页会跟着换成那本的页码和原文。',
    ),
  );
  return wrap;
}

/** 试看还没核对过的课本时的常驻提示（不是 chip）。 */
export function trialBanner(onExit: () => void): HTMLElement {
  return h(
    'div',
    { class: 'edu-lib-trial-banner', role: 'status', 'data-testid': 'library-candidate-banner' },
    h('span', {}, '正在试看这本还没核对过的课本，结论会比平时更保守。'),
    button('退出试看', onExit, { small: true }),
  );
}

export function selectedFileCard(file: SelectedFile): HTMLElement {
  return h(
    'div',
    { class: 'edu-lib-file', 'data-testid': 'library-selected-file' },
    h('p', { class: 'edu-card__title' }, `已选择：${file.fileName}`),
    h(
      'p',
      { class: 'edu-card__meta' },
      `大小 ${formatBytes(file.sizeBytes)} · 检测到 ${file.detectedPageCount} 页`,
    ),
    h('p', { class: 'edu-card__meta' }, '选中文件不会上传整本；确认下面的信息后才开始导入。'),
  );
}

export function sourceListItem(
  item: SourceListItem,
  onOpen: (item: SourceListItem, trigger: HTMLElement) => void,
): HTMLElement {
  const trigger = button('打开', () => onOpen(item, trigger), {
    small: true,
    dataAction: 'open-source',
  });
  const printed = item.printedPage === null ? '课本页还没认出来' : `课本第 ${item.printedPage} 页`;
  return h(
    'li',
    { class: 'edu-lib-source-item', 'data-source-id': item.sourceRefId },
    h(
      'span',
      { class: 'edu-lib-source-item__label' },
      h('span', { class: 'edu-lib-source-item__pages' }, `PDF 第 ${item.pdfPage} 页 · ${printed}`),
      h('span', { class: 'edu-lib-source-item__what' }, item.label),
    ),
    h(
      'span',
      { class: 'edu-inline-actions edu-lib-source-item__actions' },
      item.candidate
        ? statusChip('先当参考', 'attention')
        : statusChip(SOURCE_VERIFICATION_LABELS[item.verification], 'neutral'),
      trigger,
    ),
  );
}
