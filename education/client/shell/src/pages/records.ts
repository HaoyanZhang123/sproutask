/** Records: three axes, independent self-report, evidence detail, export/delete. */

import type { Assessment, ConceptProgress, SessionMode } from '@edu/domain';
import type { EducationPage, EducationPageContext } from '../contracts.js';
import type { RecordsPayload } from '../data/types.js';
import type { EducationShellApi } from '../shell-state.js';
import { h, clear } from '../dom.js';
import { button } from '../components/button.js';
import { renderContextBar } from '../components/context-bar.js';
import { ConfirmDialog, copyTextFallback } from '../components/confirm-dialog.js';
import { renderEvidenceDetail } from '../components/evidence-card.js';
import { Modal } from '../components/modal.js';
import { emptyState, notice, offlineNotice, saveFailedNotice } from '../components/states.js';
import { statusChip } from '../components/status-chip.js';
import { renderErrorBanner } from '../errors.js';
import {
  ASSISTANCE_LABELS,
  EVIDENCE_KIND_LABELS,
  LEARNING_LABELS,
  REVIEW_OUTCOME_LABELS,
  SELF_REPORT_LABELS,
  SESSION_MODE_LABELS,
  UNDERSTANDING_LABELS,
  VALIDITY_LABELS,
  formatDateTime,
  positionLabel,
} from '../labels.js';
import {
  conceptTitle,
  definePage,
  learningTone,
  pageHeading,
  understandingTone,
} from './common.js';

type TimeFilter = 'all' | '7' | '30';
type ModeFilter = 'all' | SessionMode;

interface FilterState {
  conceptId: string;
  mode: ModeFilter;
  time: TimeFilter;
}

const RANGE_SCOPE_LABELS = {
  selected: '学生自选的已学范围',
  all_unlearned: '全未学',
  uncertain: '暂不确定',
} as const;

function latestAssessment(assessments: readonly Assessment[], conceptId: string): Assessment | null {
  const matching = assessments
    .filter((assessment) => assessment.conceptId === conceptId)
    .sort((a, b) => {
      const timeDiff = Date.parse(a.assessedAt) - Date.parse(b.assessedAt);
      return timeDiff !== 0 ? timeDiff : a.revision - b.revision;
    });
  return matching[matching.length - 1] ?? null;
}

function assessmentsFor(assessments: readonly Assessment[], conceptId: string): readonly Assessment[] {
  return assessments
    .filter((assessment) => assessment.conceptId === conceptId)
    .sort((a, b) => {
      const timeDiff = Date.parse(a.assessedAt) - Date.parse(b.assessedAt);
      return timeDiff !== 0 ? timeDiff : a.revision - b.revision;
    });
}

function reviewAxis(progress: ConceptProgress): HTMLElement {
  const body: HTMLElement[] = [];
  const chips: HTMLElement[] = [];
  if (progress.review.lastCompletedAt !== null) {
    chips.push(statusChip('已复习', 'positive'));
    body.push(
      h(
        'p',
        { class: 'edu-axis__body' },
        `上次复习：${formatDateTime(progress.review.lastCompletedAt)}`,
      ),
    );
  }
  if (progress.review.dueAt !== null) {
    chips.push(statusChip('待复习', 'attention'));
    body.push(h('p', { class: 'edu-axis__body' }, `待复习安排：${formatDateTime(progress.review.dueAt)}`));
  }
  if (progress.review.lastCompletedAt === null && progress.review.dueAt === null) {
    chips.push(statusChip('未安排复习', 'neutral'));
    body.push(h('p', { class: 'edu-axis__body' }, '还没有复习完成时间或待复习安排。'));
  }
  if (progress.review.latestOutcome !== null) {
    body.push(
      h(
        'p',
        { class: 'edu-axis__body' },
        `最近结果：${REVIEW_OUTCOME_LABELS[progress.review.latestOutcome]}`,
      ),
    );
  }
  if (progress.review.activeSessionId !== null) {
    body.push(h('p', { class: 'edu-axis__body' }, '有一轮复习正在进行，可从工作区继续。'));
  }
  return axis('复习活动', chips, body, 'review');
}

function axis(title: string, chips: readonly HTMLElement[], body: readonly HTMLElement[], key: string): HTMLElement {
  return h(
    'section',
    { class: 'edu-axis', 'data-axis': key },
    h('div', { class: 'edu-axis__head' }, h('h3', { class: 'edu-axis__title' }, title), ...chips),
    ...body,
  );
}

export function createRecordsPage(): EducationPage {
  return definePage({
    id: 'shell.records',
    path: '/records',
    title: '记录',
    requiresLearner: true,
    fallback: true,
    mount(container, context: EducationPageContext) {
      const api = context.services.shell;
      const filter: FilterState = { conceptId: 'all', mode: 'all', time: 'all' };
      const modals: Modal[] = [];
      let statusText = '';

      const render = (): void => {
        const state = context.services.getState();
        const records = state.records;
        const snapshot = state.snapshot;
        clear(container);
        const statusRegion = h('p', {
          class: 'edu-dialog__status',
          role: 'status',
          'aria-live': 'polite',
          'data-testid': 'records-action-status',
          text: statusText,
        });
        container.append(
          pageHeading(
            '记录',
            '按教材、概念、模式和时间回看活动、理解证据、复习安排与自评；三轴分开显示，自评单独标注。',
          ),
        );
        if (records === null || snapshot === null) {
          container.append(
            emptyState({
              title: '还没有读到记录',
              body: '本地记录尚未打开。可以重试，或先返回首页。',
              actions: [
                { label: '重试', onClick: () => void api.refresh() },
                { label: '返回首页', onClick: () => void api.navigate('/home') },
              ],
            }),
          );
          return;
        }

        container.append(
          renderContextBar({
            courseEdition: `${snapshot.courseEdition.grade}年级 · ${snapshot.courseEdition.editionLabel}`,
            packVersion: snapshot.pack.version,
            concept: null,
            mode: null,
            saveState: state.saveState,
            fixture: snapshot.fixture,
            backTarget: null,
          }),
        );

        if (state.offline) container.append(offlineNotice(() => void api.refresh()));
        if (state.saveState === 'failed' || records.saveState === 'failed') {
          container.append(
            saveFailedNotice({
              onRetry: () => void api.retrySave(),
              onCopy: () => {
                const result = copyTextFallback('记录页面当前显示的内容尚未保存。');
                statusText = result === 'copied' ? '已复制提示文字。' : '无法访问剪贴板，请手动选择文字复制。';
                statusRegion.textContent = statusText;
              },
            }),
          );
        }

        const concepts = snapshot.concepts;
        const range = records.rangeClaim;
        const rangeSection = h(
          'section',
          { class: 'edu-section', 'data-testid': 'records-range-claim' },
          h('h2', { class: 'edu-section__title' }, '已学范围自述'),
          range === null
            ? h(
                'p',
                { class: 'edu-section__lead' },
                '还没有设置已学范围。这个自述用于推荐起点，不代表系统已经确认理解。',
              )
            : h(
                'p',
                { class: 'edu-section__lead' },
                `${RANGE_SCOPE_LABELS[range.scope]}${range.conceptIds.length > 0 ? `：${range.conceptIds.map((id) => conceptTitle(concepts, id)).join('、')}` : ''} · 保存于 ${formatDateTime(range.createdAt)}。这是学生自述，不是理解证据。`,
              ),
          h(
            'div',
            { class: 'edu-inline-actions' },
            button(range === null ? '去设置已学范围' : '修改已学范围', () => void api.navigate('/first-run'), {
              small: true,
            }),
          ),
        );
        container.append(rangeSection);

        if (records.progresses.length === 0) {
          container.append(
            emptyState({
              title: '还没有学习记录',
              body: '从地图选择概念开始学习后，这里会出现学习进程、理解证据与复习安排。',
              testId: 'records-empty',
              actions: [
                { label: '去地图选择概念', onClick: () => void api.navigate('/map'), tone: 'primary' },
                { label: '去教材库', onClick: () => void api.navigate('/library') },
              ],
            }),
          );
        } else {
          container.append(renderFilters(records, concepts, filter, render));
          const filtered = filterRecords(records, filter);
          if (filtered.length === 0) {
            container.append(
              emptyState({
                title: '当前筛选没有记录',
                body: '清除筛选可以看回全部记录。',
                testId: 'records-filter-empty',
                actions: [
                  {
                    label: '清除筛选',
                    onClick: () => {
                      filter.conceptId = 'all';
                      filter.mode = 'all';
                      filter.time = 'all';
                      render();
                    },
                    tone: 'primary',
                  },
                ],
              }),
            );
          } else {
            const list = h('div', { class: 'edu-list', 'data-testid': 'records-list' });
            for (const progress of filtered) {
              list.append(renderConceptCard(progress, records, concepts, container, modals));
            }
            container.append(list);
          }
        }

        container.append(renderDataManagement(api, statusRegion, (note) => {
          statusText = note;
          void api.refresh();
        }));
        container.append(statusRegion);
      };

      render();
      return undefined;
    },
    unmount() {
      // Modals are owned by the page container and removed with it; nothing global remains.
    },
  });
}

function renderFilters(
  records: RecordsPayload,
  concepts: Parameters<typeof conceptTitle>[0],
  filter: FilterState,
  rerender: () => void,
): HTMLElement {
  const toolbar = h('div', { class: 'edu-filters', 'data-testid': 'records-filters' });
  const conceptSelect = h('select', {
    class: 'edu-select',
    id: 'records-filter-concept',
    'aria-label': '按概念筛选',
    onchange: (event: Event) => {
      filter.conceptId = (event.currentTarget as HTMLSelectElement).value;
      rerender();
    },
  });
  conceptSelect.append(option('all', '全部概念', filter.conceptId === 'all'));
  for (const progress of records.progresses) {
    conceptSelect.append(
      option(
        progress.conceptId,
        conceptTitle(concepts, progress.conceptId),
        filter.conceptId === progress.conceptId,
      ),
    );
  }

  const modeSelect = h('select', {
    class: 'edu-select',
    id: 'records-filter-mode',
    'aria-label': '按模式筛选',
    onchange: (event: Event) => {
      filter.mode = (event.currentTarget as HTMLSelectElement).value as ModeFilter;
      rerender();
    },
  });
  modeSelect.append(option('all', '全部模式', filter.mode === 'all'));
  for (const mode of ['learn', 'review', 'diagnostic'] as const) {
    modeSelect.append(option(mode, SESSION_MODE_LABELS[mode], filter.mode === mode));
  }

  const timeSelect = h('select', {
    class: 'edu-select',
    id: 'records-filter-time',
    'aria-label': '按时间筛选',
    onchange: (event: Event) => {
      filter.time = (event.currentTarget as HTMLSelectElement).value as TimeFilter;
      rerender();
    },
  });
  timeSelect.append(option('all', '全部时间', filter.time === 'all'));
  timeSelect.append(option('7', '最近 7 天', filter.time === '7'));
  timeSelect.append(option('30', '最近 30 天', filter.time === '30'));

  toolbar.append(
    h(
      'div',
      { class: 'edu-field' },
      h('label', { class: 'edu-field__label', for: 'records-filter-book' }, '教材'),
      h(
        'select',
        { class: 'edu-select', id: 'records-filter-book', 'aria-label': '按教材筛选' },
        option('current', '当前教材（唯一）', true),
      ),
    ),
    h('div', { class: 'edu-field' }, h('label', { class: 'edu-field__label', for: 'records-filter-concept' }, '概念'), conceptSelect),
    h('div', { class: 'edu-field' }, h('label', { class: 'edu-field__label', for: 'records-filter-mode' }, '模式'), modeSelect),
    h('div', { class: 'edu-field' }, h('label', { class: 'edu-field__label', for: 'records-filter-time' }, '时间'), timeSelect),
    button('清除筛选', () => {
      filter.conceptId = 'all';
      filter.mode = 'all';
      filter.time = 'all';
      rerender();
    }, { small: true }),
  );
  return toolbar;
}

function option(value: string, label: string, selected: boolean): HTMLOptionElement {
  return h('option', { value, selected }, label);
}

function filterRecords(records: RecordsPayload, filter: FilterState): readonly ConceptProgress[] {
  const now = Date.parse(records.now);
  const days = filter.time === 'all' ? null : Number(filter.time);
  return records.progresses.filter((progress) => {
    if (filter.conceptId !== 'all' && progress.conceptId !== filter.conceptId) return false;
    if (filter.mode !== 'all') {
      const sessions = records.sessions.filter(
        (session) => session.conceptId === progress.conceptId && session.mode === filter.mode,
      );
      if (sessions.length === 0) return false;
    }
    if (days !== null) {
      const times = [
        progress.learning.lastCompletedAt,
        progress.understanding.updatedAt,
        progress.review.lastCompletedAt,
        progress.lastPosition.updatedAt,
      ].filter((value): value is string => value !== null);
      if (times.length === 0) return false;
      const recent = times.some((value) => now - Date.parse(value) <= days * 86400000);
      if (!recent) return false;
    }
    return true;
  });
}

function renderConceptCard(
  progress: ConceptProgress,
  records: RecordsPayload,
  concepts: Parameters<typeof conceptTitle>[0],
  pageContainer: HTMLElement,
  modals: Modal[],
): HTMLElement {
  const title = conceptTitle(concepts, progress.conceptId);
  const assessment = latestAssessment(records.assessments, progress.conceptId);
  const history = assessmentsFor(records.assessments, progress.conceptId);
  const evidence = records.evidence.filter((entry) => entry.conceptId === progress.conceptId);
  const selfReport = records.selfReports.find((entry) => entry.conceptId === progress.conceptId) ?? null;
  const latestSession =
    records.sessions
      .filter((session) => session.conceptId === progress.conceptId)
      .sort((a, b) => Date.parse(b.startedAt) - Date.parse(a.startedAt))[0] ?? null;

  const card = h(
    'article',
    { class: 'edu-card', 'data-concept-id': progress.conceptId, 'data-testid': `record-${progress.conceptId}` },
    h(
      'header',
      { class: 'edu-page__header' },
      h('h2', { class: 'edu-card__title' }, title),
      h(
        'p',
        { class: 'edu-card__meta' },
        `内容包 ${progress.packVersion} · ${latestSession === null ? '暂无活动' : `${SESSION_MODE_LABELS[latestSession.mode]} · ${positionLabel(latestSession.resumeCursor.activityId, latestSession.resumeCursor.cursor)}`}`,
      ),
    ),
  );

  const axisGrid = h('div', { class: 'edu-axis-grid' });
  axisGrid.append(
    axis(
      '学习进程',
      [statusChip(LEARNING_LABELS[progress.learning.state], learningTone(progress.learning.state))],
      [
        h(
          'p',
          { class: 'edu-axis__body' },
          progress.learning.lastCompletedAt === null
            ? `开始时间：${formatDateTime(progress.learning.startedAt)}`
            : `上次完成：${formatDateTime(progress.learning.lastCompletedAt)}`,
        ),
      ],
      'learning',
    ),
    axis(
      '理解证据',
      [
        statusChip(
          UNDERSTANDING_LABELS[progress.understanding.state],
          understandingTone(progress.understanding.state),
        ),
        statusChip(VALIDITY_LABELS[progress.understanding.validity], 'neutral'),
      ],
      [
        h(
          'p',
          { class: 'edu-axis__body' },
          assessment === null
            ? '还没有形成理解判断。'
            : `判断时间：${formatDateTime(assessment.assessedAt)} · 关联证据 ${evidence.length} 条`,
        ),
        ...(assessment !== null
          ? [
              h(
                'div',
                { class: 'edu-inline-actions' },
                button(
                  '查看依据',
                  () => {
                    const trigger = pageContainer.ownerDocument.activeElement;
                    const modal = new Modal(
                      `判断依据：${title}`,
                      renderEvidenceDetail({ conceptTitle: title, assessment, evidence }),
                    );
                    modals.push(modal);
                    modal.open(
                      trigger instanceof HTMLElement ? trigger : pageContainer,
                      pageContainer,
                    );
                  },
                  { small: true, dataAction: 'open-evidence' },
                ),
              ),
            ]
          : []),
      ],
      'understanding',
    ),
    reviewAxis(progress),
  );
  card.append(axisGrid);

  const selfAxis = h(
    'section',
    { class: 'edu-axis edu-self-report', 'data-axis': 'self-report' },
    h(
      'div',
      { class: 'edu-axis__head' },
      h('h3', { class: 'edu-axis__title' }, '自评（学生自述）'),
      selfReport === null
        ? statusChip('未填写（可选）', 'neutral')
        : statusChip(SELF_REPORT_LABELS[selfReport.claimedState], 'info'),
    ),
    h(
      'p',
      { class: 'edu-axis__body' },
      selfReport === null
        ? '自评是可选的学生观点，不会替代或覆盖理解证据判断。'
        : `学生自己的感受 · ${formatDateTime(selfReport.createdAt)}。与系统证据并列显示，不参与判定。`,
    ),
  );
  card.append(selfAxis);

  if (history.length > 0) {
    card.append(
      h('h3', { class: 'edu-card__title' }, '判断变化（旧 → 新）'),
      h(
        'ol',
        { class: 'edu-timeline', 'data-testid': 'record-assessment-history' },
        ...history.map((entry) => {
          const historicalEvidence = evidence.filter((item) => entry.evidenceIds.includes(item.id));
          return h(
            'li',
            {},
            h('time', { datetime: entry.assessedAt }, formatDateTime(entry.assessedAt)),
            ` · ${UNDERSTANDING_LABELS[entry.state]} · `,
            h('span', { class: 'edu-muted' }, entry.rationale),
            h(
              'div',
              { class: 'edu-inline-actions' },
              button(
                '查看当时依据',
                () => {
                  const trigger = pageContainer.ownerDocument.activeElement;
                  const modal = new Modal(
                    `判断依据（${formatDateTime(entry.assessedAt)}）：${title}`,
                    renderEvidenceDetail({
                      conceptTitle: title,
                      assessment: entry,
                      evidence: historicalEvidence,
                    }),
                  );
                  modals.push(modal);
                  modal.open(
                    trigger instanceof HTMLElement ? trigger : pageContainer,
                    pageContainer,
                  );
                },
                { small: true, dataAction: 'open-historical-evidence' },
              ),
            ),
          );
        }),
      ),
    );
  }

  if (evidence.length > 0) {
    card.append(
      h(
        'p',
        { class: 'edu-card__meta' },
        `已有证据：${evidence
          .map((entry) => `${EVIDENCE_KIND_LABELS[entry.kind]}（${ASSISTANCE_LABELS[entry.assistance]}）`)
          .join('、')}`,
      ),
    );
  }

  return card;
}

function renderDataManagement(
  api: EducationShellApi,
  status: HTMLElement,
  onDeleted: (note: string) => void,
): HTMLElement {
  const section = h(
    'section',
    { class: 'edu-section', 'data-testid': 'records-data-management' },
    h('h2', { class: 'edu-section__title' }, '导出与删除'),
    h(
      'p',
      { class: 'edu-section__lead' },
      '导出与删除只作用于本机学习记录；教材文件与共享内容不会被删除。每个操作都会先说明影响，再要求确认。',
    ),
  );

  const exportDialog = new ConfirmDialog({
    title: '导出我的记录',
    impact: [
      '导出内容：学习活动、作答、理解证据、自评与复习安排。',
      '不会包含教材原文件、教材原图或共享内容。',
      '导出文件会保存到你选择的位置；请自行妥善保管。',
    ],
    confirmLabel: '确认导出',
    onConfirm: () => {
      void (async () => {
        const result = await api.exportData();
        if (result.ok) {
          status.textContent = `已导出 ${result.data.recordCount} 条记录（演示数据，未写入真实文件）。${result.data.note}`;
        } else {
          status.replaceChildren(renderErrorBanner(result.error, { headingLevel: 'h3' }));
        }
      })();
    },
  });

  const deleteLearningDialog = new ConfirmDialog({
    title: '删除学习记录',
    tone: 'danger',
    acknowledgement: '我了解此操作不可撤销，且教材文件不会被删除。',
    impact: [
      '将删除本机匿名档案下的作答、理解证据、自评、学习进程与复习安排。',
      '教材文件、教材原图与共享内容不会被删除。',
      '删除后记录为空，重启后仍保持一致；不会自动从云端恢复。',
    ],
    confirmLabel: '确认删除学习记录',
    onConfirm: () => {
      void (async () => {
        const result = await api.deleteData('learning_records');
        if (result.ok) {
          status.textContent = result.data.note;
          onDeleted(result.data.note);
        } else {
          status.replaceChildren(renderErrorBanner(result.error, { headingLevel: 'h3' }));
        }
      })();
    },
  });

  const removeBookDialog = new ConfirmDialog({
    title: '移除这本教材的本机关联',
    tone: 'danger',
    acknowledgement: '我了解只移除本机关联，不会删除教材源文件。',
    impact: [
      '将移除本机与这本教材的关联和导入记录。',
      '不会删除教材 PDF、原图或共享内容。',
      '已保存的学习记录仍保留，可在记录中查看；不会自动迁移到其他教材。',
    ],
    confirmLabel: '确认移除教材关联',
    onConfirm: () => {
      void (async () => {
        const result = await api.deleteData('book_link');
        if (result.ok) {
          status.textContent = result.data.note;
        } else {
          status.replaceChildren(renderErrorBanner(result.error, { headingLevel: 'h3' }));
        }
      })();
    },
  });

  const actions = h('div', { class: 'edu-inline-actions' });
  const exportButton = button('导出我的记录', () => exportDialog.open(exportButton, section), {
    small: true,
    dataAction: 'export-records',
  });
  const deleteButton = button('删除学习记录', () => deleteLearningDialog.open(deleteButton, section), {
    small: true,
    tone: 'danger-ghost',
    dataAction: 'delete-records',
  });
  const bookButton = button('移除教材关联', () => removeBookDialog.open(bookButton, section), {
    small: true,
    tone: 'danger-ghost',
    dataAction: 'remove-book-link',
  });
  actions.append(exportButton, deleteButton, bookButton);
  section.append(actions);
  section.append(exportDialog.element, deleteLearningDialog.element, removeBookDialog.element);
  return section;
}
