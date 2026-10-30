/** Library presentational components built from the T08 shell primitives. */

import {
  button,
  h,
  statusChip,
  type StatusTone,
} from '../../shell/src/index.js';
import {
  COVERAGE_LABELS,
  EDITION_VERIFICATION_LABELS,
  MATERIAL_STATE_LABELS,
  MATERIAL_STATE_NOTES,
  MATERIAL_STATE_TONES,
  REVIEW_STATE_LABELS,
  SCOPE_LABELS,
  TRUST_MODE_LABELS,
  formatFingerprint,
  SOURCE_VERIFICATION_LABELS,
  formatBytes,
} from './labels.js';
import type { LibraryBook, SelectedFile, SourceListItem } from './types.js';

export function fixtureNotice(text: string): HTMLElement {
  return h(
    'div',
    {
      class: 'edu-notice edu-notice--warning',
      role: 'status',
      'data-testid': 'library-fixture-notice',
      'data-edu-fixture': 'true',
    },
    h('p', { class: 'edu-notice__title' }, '演示数据（fixture）'),
    h('p', { class: 'edu-notice__body' }, text),
    h(
      'p',
      { class: 'edu-notice__body' },
      '不得把这里的教材、页码、导入进度或来源当作真实材料/真实 API 结果；真实材料与服务接入后会替换为正式数据。',
    ),
  );
}

export interface BookCardHandlers {
  readonly candidateTrial: boolean;
  readonly onViewSources: (book: LibraryBook) => void;
  readonly onTrialCandidate: (book: LibraryBook, trigger: HTMLElement) => void;
  readonly onExitTrial: () => void;
  readonly onChooseFile: () => void;
  readonly onSetCurrent?: (book: LibraryBook) => void;
}

export function bookCard(book: LibraryBook, handlers: BookCardHandlers): HTMLElement {
  const tone: StatusTone = MATERIAL_STATE_TONES[book.materialState];
  const card = h('article', {
    class: 'edu-lib-book',
    'data-state': book.materialState,
    'data-testid': `library-book-${book.id}`,
    'data-book-id': book.id,
  });
  card.append(
    h(
      'div',
      { class: 'edu-lib-book__head' },
      h('h3', { class: 'edu-lib-book__title' }, book.title),
      h(
        'div',
        { class: 'edu-inline-actions' },
        statusChip(MATERIAL_STATE_LABELS[book.materialState], tone),
        book.isCurrent ? statusChip('当前教材', 'positive') : null,
      ),
    ),
    h(
      'p',
      { class: 'edu-lib-book__meta' },
      `${book.publisher} · ${book.editionLabel} · ${book.grade}年级${book.term === 1 ? '上册' : '下册'}`,
    ),
    h(
      'div',
      { class: 'edu-inline-actions' },
      statusChip(REVIEW_STATE_LABELS[book.reviewState], reviewTone(book.reviewState)),
      statusChip(TRUST_MODE_LABELS[book.trustMode], book.trustMode === 'candidate' ? 'attention' : 'neutral'),
      statusChip(EDITION_VERIFICATION_LABELS[book.editionVerification], book.editionVerification === 'verified' ? 'positive' : 'attention'),
    ),
    h(
      'dl',
      { class: 'edu-kv' },
      h('dt', {}, '页数'),
      h('dd', {}, book.pageCount > 0 ? `${book.pageCount} 页` : '—'),
      h('dt', {}, '文件指纹'),
      h('dd', { class: 'edu-lib-inline-code' }, formatFingerprint(book.sha256)),
      h('dt', {}, '内容范围'),
      h('dd', {}, `${SCOPE_LABELS[book.scope]} · ${COVERAGE_LABELS[book.coverageStatus]}`),
      h('dt', {}, '材料状态'),
      h('dd', {}, MATERIAL_STATE_NOTES[book.materialState]),
    ),
  );
  if (book.materialState === 'candidate') {
    card.append(
      h(
        'p',
        { class: 'edu-warning-text', 'data-testid': `candidate-warning-${book.id}` },
        '候选 · 未核实 · 不可作为基准或强掌握结论。显式试用后仍保留未核实标识。',
      ),
    );
  }
  if (book.materialState === 'unavailable') {
    card.append(
      h(
        'p',
        { class: 'edu-danger-text', 'data-testid': `unavailable-reason-${book.id}` },
        `不可用原因：${book.unavailableReason ?? '材料不可用'}`,
      ),
    );
  }
  const actions = h('div', { class: 'edu-lib-book__actions' });
  if (book.materialState === 'baseline') {
    if (!book.isCurrent && handlers.onSetCurrent !== undefined) {
      actions.append(button('设为当前教材', () => handlers.onSetCurrent?.(book), { small: true }));
    }
    actions.append(button('查看来源', () => handlers.onViewSources(book), { small: true }));
  } else if (book.materialState === 'candidate') {
    if (handlers.candidateTrial) {
      actions.append(button('退出候选试用', handlers.onExitTrial, { small: true, tone: 'danger-ghost' }));
      actions.append(button('查看候选来源', () => handlers.onViewSources(book), { small: true }));
    } else {
      const trialButton = button(
        '显式试用候选（未核实）',
        () => handlers.onTrialCandidate(book, trialButton),
        { small: true, tone: 'primary', dataAction: 'trial-candidate' },
      );
      actions.append(trialButton);
    }
  } else {
    actions.append(button('重新选择文件', handlers.onChooseFile, { small: true, tone: 'primary' }));
    actions.append(button('查看记录', () => handlers.onViewSources(book), { small: true }));
  }
  card.append(actions);
  return card;
}

export function candidateBanner(onExit: () => void): HTMLElement {
  return h(
    'div',
    { class: 'edu-lib-candidate-banner', role: 'status', 'data-testid': 'library-candidate-banner' },
    h('span', {}, '当前为候选试用（未核实） · 强结论已禁用 · 不能视为基准'),
    button('退出候选试用', onExit, { small: true, tone: 'default' }),
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
      `大小 ${formatBytes(file.sizeBytes)} · 检测页数 ${file.detectedPageCount} · 指纹 ${formatFingerprint(file.handle.sha256)}`,
    ),
    h(
      'p',
      { class: 'edu-card__meta' },
      '选择本身不会上传整本；确认元数据后才开始导入。',
    ),
  );
}

export function sourceListItem(item: SourceListItem, onOpen: (item: SourceListItem, trigger: HTMLElement) => void): HTMLElement {
  const trigger = button(
    '打开来源',
    () => onOpen(item, trigger),
    { small: true, dataAction: 'open-source' },
  );
  return h(
    'li',
    { class: 'edu-lib-source-item', 'data-source-id': item.sourceRefId },
    h(
      'span',
      { class: 'edu-lib-source-item__label' },
      item.label,
      h(
        'span',
        { class: 'edu-muted' },
        ` · PDF 第 ${item.pdfPage} 页 · ${item.printedPage === null ? '印刷页未识别' : `课本第 ${item.printedPage} 页`} · ${SOURCE_VERIFICATION_LABELS[item.verification]}`,
      ),
    ),
    h(
      'span',
      { class: 'edu-inline-actions' },
      item.candidate ? statusChip('候选来源（未核实）', 'attention') : statusChip(REVIEW_STATE_LABELS[item.reviewState], reviewTone(item.reviewState)),
      trigger,
    ),
  );
}

function reviewTone(reviewState: LibraryBook['reviewState']): StatusTone {
  if (reviewState === 'published' || reviewState === 'curator_checked') return 'positive';
  if (reviewState === 'candidate') return 'attention';
  if (reviewState === 'rejected') return 'danger';
  return 'progress';
}
