/**
 * Progress (/records): three overview numbers, a day-grouped activity timeline
 * that expands in place (evidence, source pages, the student's own opinion) and
 * a low-key export/delete area at the bottom.
 *
 * Student wording only: no internal ids, pack versions, grader versions, axes
 * or evidence-candidate terms ever reach the DOM.
 */

import type {
  Assessment,
  Concept,
  ConceptProgress,
  Evidence,
  SelfReport,
  SelfReportState,
  Session,
} from '@edu/domain';
import type { EducationPage, EducationPageContext } from '../contracts.js';
import type { RecordsPayload } from '../data/types.js';
import type { EducationShellApi } from '../shell-state.js';
import type { StatusTone } from '../tokens.js';
import { clear, h, idFrom, setHidden } from '../dom.js';
import { button } from '../components/button.js';
import { ConfirmDialog, copyTextFallback } from '../components/confirm-dialog.js';
import { emptyState, offlineNotice, saveFailedNotice } from '../components/states.js';
import { statusChip } from '../components/status-chip.js';
import { renderErrorBanner } from '../errors.js';
import { EVIDENCE_KIND_LABELS, SELF_REPORT_LABELS, SESSION_MODE_LABELS } from '../labels.js';
import { conceptTitle, definePage, pageHeading } from './common.js';

const SELF_REPORT_OPTIONS: readonly SelfReportState[] = [
  'uncertain',
  'basically_understood',
  'can_explain',
];

interface TimelineRow {
  readonly progress: ConceptProgress;
  /** Latest activity timestamp used for the day group and the row time. */
  readonly at: string;
}

interface DayGroup {
  readonly key: string;
  readonly title: string;
  readonly rows: readonly TimelineRow[];
}

interface EvidenceSummary {
  readonly total: number;
  readonly met: number;
  readonly assisted: number;
}

/**
 * Page-local styles. 待并入 shell/styles.ts：届时删除本段与 ensureProgressStyles，
 * 类名保持 `.edu-progress-*` 可直接迁移。所有取值只用 --edu-* 变量。
 */
const PROGRESS_STYLE_ATTRIBUTE = 'data-edu-progress-style';

const PROGRESS_STYLES = `
.edu-progress-stats { display: grid; gap: var(--edu-space-md); grid-template-columns: repeat(auto-fit, minmax(min(100%, 13rem), 1fr)); margin: 0 0 var(--edu-space-lg); }
.edu-progress-stat { display: grid; gap: var(--edu-space-xxs); align-content: start; padding: var(--edu-space-lg); }
.edu-progress-stat__value { font-size: var(--edu-font-xxl); font-weight: 800; line-height: 1.1; letter-spacing: -0.01em; }
.edu-progress-stat__label { font-size: var(--edu-font-md); font-weight: 700; }
.edu-progress-stat__note { color: var(--edu-color-ink-muted); font-size: var(--edu-font-sm); }
.edu-progress-toolbar { display: flex; flex-wrap: wrap; align-items: end; gap: var(--edu-space-sm); margin: 0 0 var(--edu-space-md); }
.edu-progress-day { margin-top: var(--edu-space-lg); }
.edu-progress-day__title { margin: 0 0 var(--edu-space-sm); color: var(--edu-color-ink-muted); font-size: var(--edu-font-md); font-weight: 700; letter-spacing: 0.02em; }
.edu-progress-rows { list-style: none; margin: 0; padding: 0; display: grid; gap: var(--edu-space-sm); }
.edu-progress-item { min-width: 0; background: var(--edu-color-surface); border: 1px solid var(--edu-color-line); border-radius: var(--edu-radius-lg); box-shadow: 0 1px 2px rgba(31, 36, 33, 0.04), 0 8px 22px rgba(31, 36, 33, 0.04); overflow: hidden; }
.edu-progress-row { display: flex; align-items: center; gap: var(--edu-space-sm); width: 100%; padding: var(--edu-space-md) var(--edu-space-lg); border: 0; background: transparent; color: inherit; font: inherit; text-align: left; cursor: pointer; }
.edu-progress-row:hover { background: var(--edu-color-surface-muted); }
.edu-progress-row__main { display: grid; gap: var(--edu-space-xxs); flex: 1 1 auto; min-width: 0; }
.edu-progress-row__title { display: flex; flex-wrap: wrap; align-items: center; gap: var(--edu-space-xs); font-size: var(--edu-font-lg); font-weight: 800; overflow-wrap: anywhere; }
.edu-progress-row__meta { color: var(--edu-color-ink-muted); font-size: var(--edu-font-sm); overflow-wrap: anywhere; }
.edu-progress-row__tag { flex: none; white-space: nowrap; }
.edu-progress-row__chevron { flex: none; width: 1rem; height: 1rem; color: var(--edu-color-ink-faint); transition: transform 0.15s ease; }
.edu-progress-row[aria-expanded="true"] .edu-progress-row__chevron { transform: rotate(180deg); }
.edu-progress-detail { padding: var(--edu-space-md) var(--edu-space-lg) var(--edu-space-lg); border-top: 1px dashed var(--edu-color-line); background: color-mix(in srgb, var(--edu-color-surface-muted) 55%, transparent); }
.edu-progress-detail__title { margin: 0 0 var(--edu-space-xs); font-size: var(--edu-font-md); font-weight: 700; }
.edu-progress-pills { display: flex; flex-wrap: wrap; align-items: center; gap: var(--edu-space-xs); }
.edu-progress-self { display: flex; flex-wrap: wrap; align-items: center; gap: var(--edu-space-xs); margin-top: var(--edu-space-md); }
.edu-progress-self__label { color: var(--edu-color-ink-muted); font-size: var(--edu-font-sm); }
.edu-progress-self .edu-button[aria-pressed="true"] { border-color: var(--edu-color-accent); background: var(--edu-color-accent-soft); color: var(--edu-color-accent-strong); font-weight: 700; }
.edu-progress-self__note { flex-basis: 100%; margin: 0; color: var(--edu-color-ink-muted); font-size: var(--edu-font-sm); }
.edu-progress-manage { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: var(--edu-space-md); margin-top: var(--edu-space-xxl); padding: var(--edu-space-lg); border: 1px dashed var(--edu-color-line-strong); border-radius: var(--edu-radius-lg); }
.edu-progress-manage__text { min-width: 0; }
.edu-progress-manage__text h2 { margin: 0 0 var(--edu-space-xxs); font-size: var(--edu-font-lg); }
.edu-progress-manage__text p { margin: 0; max-width: 42rem; color: var(--edu-color-ink-muted); font-size: var(--edu-font-sm); }
.edu-progress-manage__actions { display: flex; flex-wrap: wrap; gap: var(--edu-space-xs); }
.edu-progress-status { margin: var(--edu-space-sm) 0 0; font-size: var(--edu-font-sm); }
@media (max-width: 640px) {
  .edu-progress-row { flex-wrap: wrap; }
  .edu-progress-row__chevron { margin-left: auto; }
  .edu-progress-row__tag { order: 3; }
  .edu-progress-stat { padding: var(--edu-space-md); }
}
`;

function ensureProgressStyles(doc: Document): void {
  if (doc.head.querySelector<HTMLStyleElement>(`style[${PROGRESS_STYLE_ATTRIBUTE}]`) !== null) return;
  const style = doc.createElement('style');
  style.setAttribute(PROGRESS_STYLE_ATTRIBUTE, 'true');
  style.textContent = PROGRESS_STYLES;
  doc.head.append(style);
}

function latestProgresses(progresses: readonly ConceptProgress[]): readonly ConceptProgress[] {
  const byConcept = new Map<string, ConceptProgress>();
  for (const progress of progresses) {
    const current = byConcept.get(progress.conceptId);
    if (current === undefined || progress.revision >= current.revision) {
      byConcept.set(progress.conceptId, progress);
    }
  }
  return [...byConcept.values()];
}

function sessionsFor(records: RecordsPayload, conceptId: string): readonly Session[] {
  return records.sessions
    .filter((session) => session.conceptId === conceptId)
    .sort(
      (left, right) =>
        Date.parse(right.endedAt ?? right.startedAt) - Date.parse(left.endedAt ?? left.startedAt),
    );
}

function evidenceFor(records: RecordsPayload, conceptId: string): readonly Evidence[] {
  return records.evidence
    .filter((entry) => entry.conceptId === conceptId)
    .sort((left, right) => Date.parse(left.createdAt) - Date.parse(right.createdAt));
}

function latestAssessmentFor(records: RecordsPayload, conceptId: string): Assessment | null {
  const matching = records.assessments
    .filter((entry) => entry.conceptId === conceptId)
    .sort((left, right) => {
      const timeDiff = Date.parse(left.assessedAt) - Date.parse(right.assessedAt);
      return timeDiff !== 0 ? timeDiff : left.revision - right.revision;
    });
  return matching[matching.length - 1] ?? null;
}

function latestSelfReportFor(records: RecordsPayload, conceptId: string): SelfReport | null {
  const matching = records.selfReports
    .filter((entry) => entry.conceptId === conceptId)
    .sort((left, right) => Date.parse(left.createdAt) - Date.parse(right.createdAt));
  return matching[matching.length - 1] ?? null;
}

function hasActivity(progress: ConceptProgress, records: RecordsPayload): boolean {
  return (
    progress.learning.state !== 'not_started' ||
    progress.learning.startedAt !== null ||
    sessionsFor(records, progress.conceptId).length > 0 ||
    evidenceFor(records, progress.conceptId).length > 0 ||
    latestAssessmentFor(records, progress.conceptId) !== null
  );
}

/** Latest activity timestamp: a session first, then any recorded step. */
function activityTime(progress: ConceptProgress, records: RecordsPayload): string | null {
  const session = sessionsFor(records, progress.conceptId)[0];
  if (session !== undefined) return session.endedAt ?? session.startedAt;
  const candidates: readonly (string | null)[] = [
    progress.learning.lastCompletedAt,
    progress.learning.startedAt,
    progress.understanding.updatedAt,
    latestAssessmentFor(records, progress.conceptId)?.assessedAt ?? null,
    ...evidenceFor(records, progress.conceptId).map((entry) => entry.createdAt),
    latestSelfReportFor(records, progress.conceptId)?.createdAt ?? null,
  ];
  let latest: string | null = null;
  let latestMs = Number.NEGATIVE_INFINITY;
  for (const candidate of candidates) {
    if (candidate === null) continue;
    const parsed = Date.parse(candidate);
    if (!Number.isNaN(parsed) && parsed > latestMs) {
      latestMs = parsed;
      latest = candidate;
    }
  }
  return latest;
}

function evidenceSummary(evidence: readonly Evidence[]): EvidenceSummary {
  return {
    total: evidence.length,
    met: evidence.filter(hasMetCriterion).length,
    assisted: evidence.filter((entry) => entry.assistance === 'assisted').length,
  };
}

function hasMetCriterion(entry: Evidence): boolean {
  return entry.criterionResults.length > 0 && entry.criterionResults.every((result) => result.result === 'met');
}

function rowStatus(
  progress: ConceptProgress,
  assessment: Assessment | null,
  evidence: readonly Evidence[],
): { readonly label: string; readonly tone: StatusTone } {
  if (progress.understanding.state === 'needs_support' || assessment?.state === 'needs_support') {
    return { label: '要再练', tone: 'attention' };
  }
  const summary = evidenceSummary(evidence);
  if (summary.total > 0) {
    return summary.met === summary.total
      ? { label: '答对了', tone: 'positive' }
      : { label: '要再练', tone: 'attention' };
  }
  if (progress.learning.state === 'completed') return { label: '完成', tone: 'neutral' };
  if (progress.understanding.state === 'developing' || progress.understanding.state === 'supported') {
    return { label: '完成', tone: 'neutral' };
  }
  return { label: '还在学', tone: 'progress' };
}

function rowMeta(progress: ConceptProgress, records: RecordsPayload, at: string): string {
  const session = sessionsFor(records, progress.conceptId)[0] ?? null;
  const summary = evidenceSummary(evidenceFor(records, progress.conceptId));
  const parts: string[] = [];
  if (session !== null) parts.push(SESSION_MODE_LABELS[session.mode]);
  parts.push(summary.total === 0 ? '还没有作答' : `${summary.total} 题里答对 ${summary.met} 题`);
  if (summary.assisted > 0) parts.push(`用了 ${summary.assisted} 次提示`);
  const time = timeText(at);
  if (time !== null) parts.push(time);
  return parts.join(' · ');
}

function timelineRows(records: RecordsPayload): readonly TimelineRow[] {
  const rows: TimelineRow[] = [];
  for (const progress of latestProgresses(records.progresses)) {
    if (!hasActivity(progress, records)) continue;
    const at = activityTime(progress, records);
    if (at === null) continue;
    rows.push({ progress, at });
  }
  return rows.sort((left, right) => Date.parse(right.at) - Date.parse(left.at));
}

function groupRowsByDay(rows: readonly TimelineRow[], now: string): readonly DayGroup[] {
  const groups: { key: string; title: string; rows: TimelineRow[] }[] = [];
  for (const row of rows) {
    const key = localDayKey(row.at);
    const last = groups[groups.length - 1];
    if (last !== undefined && last.key === key) {
      last.rows.push(row);
    } else {
      groups.push({ key, title: dayTitle(row.at, now), rows: [row] });
    }
  }
  return groups;
}

function parseTimestamp(timestamp: string): Date | null {
  const date = new Date(timestamp);
  return Number.isNaN(date.getTime()) ? null : date;
}

function localDayKey(timestamp: string): string {
  const date = parseTimestamp(timestamp);
  if (date === null) return timestamp;
  return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
}

function startOfLocalDay(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

function dayTitle(timestamp: string, now: string): string {
  const date = parseTimestamp(timestamp);
  if (date === null) return timestamp;
  const current = parseTimestamp(now);
  const dateText = `${date.getMonth() + 1} 月 ${date.getDate()} 日`;
  if (current === null) return dateText;
  const days = Math.round((startOfLocalDay(current) - startOfLocalDay(date)) / 86400000);
  if (days === 0) return `今天 · ${dateText}`;
  if (days === 1) return `昨天 · ${dateText}`;
  if (date.getFullYear() !== current.getFullYear()) return `${date.getFullYear()} 年 ${dateText}`;
  return dateText;
}

function timeText(timestamp: string): string | null {
  const date = parseTimestamp(timestamp);
  if (date === null) return null;
  const pad = (value: number): string => String(value).padStart(2, '0');
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/**
 * Only fragment ids shaped like `source.p18` carry a printed page we can trust.
 * Anything else yields no page label: we would rather show nothing than guess a
 * chapter or page number from an internal id.
 */
function sourcePages(refs: readonly string[]): readonly number[] {
  const pages = new Set<number>();
  for (const ref of refs) {
    const match = /^source\.p(\d+)$/.exec(ref);
    if (match !== null) pages.add(Number(match[1]));
  }
  return [...pages].sort((left, right) => left - right);
}

function pageLabel(pages: readonly number[]): string | null {
  if (pages.length === 0) return null;
  return `课本第 ${pages.join('、')} 页`;
}

export function createRecordsPage(): EducationPage {
  return definePage({
    id: 'shell.records',
    path: '/records',
    title: '进展',
    requiresLearner: true,
    fallback: true,
    mount(container, context: EducationPageContext) {
      const api = context.services.shell;
      ensureProgressStyles(container.ownerDocument);
      const filter = { conceptId: 'all' };
      const expanded = new Set<string>();
      const selfChoices = new Map<string, SelfReportState>();
      let statusText = '';
      let statusRegion: HTMLElement | null = null;

      const setStatus = (value: string): void => {
        statusText = value;
        if (statusRegion !== null) statusRegion.textContent = value;
      };

      const showStatusError = (error: Parameters<typeof renderErrorBanner>[0]): void => {
        statusText = '';
        if (statusRegion !== null) {
          statusRegion.replaceChildren(renderErrorBanner(error, { headingLevel: 'h3' }));
        }
      };

      const render = (): void => {
        const state = context.services.getState();
        const records = state.records;
        const snapshot = state.snapshot;
        clear(container);
        const page = h('div', { class: 'edu-progress-page' });
        container.append(page);
        page.append(
          pageHeading('我的进展', '看看学过什么、哪里还要再练。这里只记下你在这台电脑上的学习。'),
        );
        statusRegion = h('p', {
          class: 'edu-progress-status',
          role: 'status',
          'aria-live': 'polite',
          'data-testid': 'records-action-status',
          text: statusText,
        });

        if (records === null || snapshot === null) {
          page.append(
            emptyState({
              title: '还没有读到学习记录',
              body: '可以重试，或先回到今天。',
              actions: [
                { label: '重试', onClick: () => void api.refresh() },
                { label: '回到今天', onClick: () => void api.navigate('/home') },
              ],
            }),
          );
          page.append(statusRegion);
          return;
        }

        if (state.offline) page.append(offlineNotice(() => void api.refresh()));
        if (state.saveState === 'failed' || records.saveState === 'failed') {
          page.append(
            saveFailedNotice({
              onRetry: () => void api.retrySave(),
              onCopy: () => {
                const result = copyTextFallback('学习记录页面当前显示的内容还没有写入本机。');
                setStatus(
                  result === 'copied'
                    ? '已复制提示文字。'
                    : '无法访问剪贴板，请手动选择文字复制。',
                );
              },
            }),
          );
        }

        const now = records.now;
        const concepts = snapshot.concepts;
        const progresses = latestProgresses(records.progresses);
        const activities = progresses.filter((progress) => hasActivity(progress, records));

        if (records.progresses.length === 0) {
          page.append(
            emptyState({
              title: '还没有学习记录',
              body: '从知识地图挑一个概念开始，这里会按天记下你学了什么、哪里还要再练。',
              testId: 'records-empty',
              actions: [
                {
                  label: '去知识地图选概念',
                  onClick: () => void api.navigate('/map'),
                  tone: 'primary',
                },
                { label: '回到今天', onClick: () => void api.navigate('/home') },
                { label: '重新读取记录', onClick: () => void api.refresh() },
              ],
            }),
          );
        } else {
          page.append(renderStats(progresses, activities, now, concepts.length));
          page.append(
            renderToolbar(progresses, concepts, filter, {
              onChange: () => render(),
            }),
          );
          const rows = timelineRows(records).filter(
            (row) => filter.conceptId === 'all' || row.progress.conceptId === filter.conceptId,
          );
          if (rows.length === 0) {
            page.append(
              emptyState({
                title: '当前筛选没有记录',
                body: '清除筛选可以看回全部记录。',
                testId: 'records-filter-empty',
                actions: [
                  {
                    label: '清除筛选',
                    onClick: () => {
                      filter.conceptId = 'all';
                      render();
                    },
                    tone: 'primary',
                  },
                ],
              }),
            );
          } else {
            page.append(
              renderTimeline(rows, now, records, concepts, expanded, selfChoices, {
                onToggle: (conceptId, open) => {
                  if (open) expanded.add(conceptId);
                  else expanded.delete(conceptId);
                },
                onSelfChoice: (conceptId, choice) => selfChoices.set(conceptId, choice),
              }),
            );
          }
        }

        page.append(
          renderDataManagement(api, setStatus, showStatusError, () => {
            void api.refresh();
          }),
        );
        page.append(statusRegion);
      };

      render();
      return undefined;
    },
    unmount() {
      // Confirm dialogs and the page-local style live inside the page container.
    },
  });
}

function renderStats(
  progresses: readonly ConceptProgress[],
  activities: readonly ConceptProgress[],
  now: string,
  totalConcepts: number,
): HTMLElement {
  const learned = activities.length;
  const needsPractice = activities.filter(
    (progress) => progress.understanding.state === 'needs_support',
  ).length;
  const due = progresses.filter(
    (progress) =>
      progress.review.dueAt !== null && Date.parse(progress.review.dueAt) <= Date.parse(now),
  ).length;
  const section = h(
    'section',
    { class: 'edu-progress-stats', 'aria-label': '总览', 'data-testid': 'progress-stats' },
    statCard({
      testId: 'progress-stat-learned',
      value: learned,
      label: '学过的概念',
      note: `全册 ${totalConcepts} 个`,
    }),
    statCard({
      testId: 'progress-stat-practice',
      value: needsPractice,
      label: '要再练一练',
      note: needsPractice > 0 ? '最近一次判断还需要再练' : '最近没有需要再练的',
    }),
    statCard({
      testId: 'progress-stat-due',
      value: due,
      label: '等待复习',
      note: due > 0 ? '到时间回来看看' : '现在没有到期的复习',
    }),
  );
  return section;
}

function statCard(input: {
  readonly testId: string;
  readonly value: number;
  readonly label: string;
  readonly note: string;
}): HTMLElement {
  return h(
    'div',
    { class: 'edu-card edu-progress-stat', 'data-testid': input.testId },
    h('b', { class: 'edu-progress-stat__value' }, String(input.value)),
    h('span', { class: 'edu-progress-stat__label' }, input.label),
    h('span', { class: 'edu-progress-stat__note' }, input.note),
  );
}

function renderToolbar(
  progresses: readonly ConceptProgress[],
  concepts: readonly Concept[],
  filter: { conceptId: string },
  handlers: { readonly onChange: () => void },
): HTMLElement {
  const select = h('select', {
    class: 'edu-select',
    id: 'records-filter-concept',
    'aria-label': '按概念筛选',
    onchange: (event: Event) => {
      filter.conceptId = (event.currentTarget as HTMLSelectElement).value;
      handlers.onChange();
    },
  });
  select.append(option('all', '全部概念', filter.conceptId === 'all'));
  for (const progress of progresses) {
    select.append(
      option(
        progress.conceptId,
        conceptTitle(concepts, progress.conceptId),
        filter.conceptId === progress.conceptId,
      ),
    );
  }
  return h(
    'div',
    { class: 'edu-progress-toolbar', 'data-testid': 'progress-toolbar' },
    h(
      'div',
      { class: 'edu-field' },
      h('label', { class: 'edu-field__label', for: 'records-filter-concept' }, '看哪个概念'),
      select,
    ),
  );
}

function option(value: string, label: string, selected: boolean): HTMLOptionElement {
  return h('option', { value, selected }, label);
}

function renderTimeline(
  rows: readonly TimelineRow[],
  now: string,
  records: RecordsPayload,
  concepts: readonly Concept[],
  expanded: ReadonlySet<string>,
  selfChoices: ReadonlyMap<string, SelfReportState>,
  handlers: {
    readonly onToggle: (conceptId: string, open: boolean) => void;
    readonly onSelfChoice: (conceptId: string, choice: SelfReportState) => void;
  },
): HTMLElement {
  const timeline = h('div', { 'data-testid': 'progress-timeline' });
  for (const group of groupRowsByDay(rows, now)) {
    timeline.append(
      h(
        'section',
        { class: 'edu-progress-day', 'data-testid': 'progress-day' },
        h('h2', { class: 'edu-progress-day__title' }, group.title),
        h(
          'ul',
          { class: 'edu-progress-rows' },
          ...group.rows.map((row) =>
            renderRow({ ...row, records, concepts, expanded, selfChoices, handlers }),
          ),
        ),
      ),
    );
  }
  return timeline;
}

function renderRow(input: {
  readonly progress: ConceptProgress;
  readonly at: string;
  readonly records: RecordsPayload;
  readonly concepts: readonly Concept[];
  readonly expanded: ReadonlySet<string>;
  readonly selfChoices: ReadonlyMap<string, SelfReportState>;
  readonly handlers: {
    readonly onToggle: (conceptId: string, open: boolean) => void;
    readonly onSelfChoice: (conceptId: string, choice: SelfReportState) => void;
  };
}): HTMLElement {
  const { progress, at, records, concepts, expanded, selfChoices, handlers } = input;
  const concept = concepts.find((entry) => entry.id === progress.conceptId) ?? null;
  const evidence = evidenceFor(records, progress.conceptId);
  const assessment = latestAssessmentFor(records, progress.conceptId);
  const status = rowStatus(progress, assessment, evidence);
  const detailId = idFrom(progress.conceptId);
  const isOpen = expanded.has(progress.conceptId);
  const sourceTag = pageLabel(
    sourcePages([...(concept?.sourceRefs ?? []), ...evidence.flatMap((entry) => entry.sourceRefs)]),
  );
  const detail = renderDetail({
    progress,
    records,
    concept,
    evidence,
    detailId,
    isOpen,
    selfChoices,
    onSelfChoice: handlers.onSelfChoice,
  });
  const trigger = h(
    'button',
    {
      type: 'button',
      class: 'edu-progress-row',
      'aria-expanded': String(isOpen),
      'aria-controls': detailId,
      'data-action': 'toggle-row',
      onclick: () => {
        const willOpen = detail.hasAttribute('hidden');
        setHidden(detail, !willOpen);
        trigger.setAttribute('aria-expanded', String(willOpen));
        handlers.onToggle(progress.conceptId, willOpen);
      },
    },
    h(
      'span',
      { class: 'edu-progress-row__main' },
      h(
        'span',
        { class: 'edu-progress-row__title' },
        h('span', {}, conceptTitle(concepts, progress.conceptId)),
        statusChip(status.label, status.tone),
      ),
      h('span', { class: 'edu-progress-row__meta' }, rowMeta(progress, records, at)),
    ),
    sourceTag === null ? null : h('span', { class: 'edu-tag edu-progress-row__tag' }, sourceTag),
    h('span', { class: 'edu-progress-row__chevron', 'aria-hidden': 'true' }, '▾'),
  );
  return h(
    'li',
    { class: 'edu-progress-item', 'data-concept-id': progress.conceptId, 'data-testid': 'progress-row' },
    trigger,
    detail,
  );
}

function renderDetail(input: {
  readonly progress: ConceptProgress;
  readonly records: RecordsPayload;
  readonly concept: Concept | null;
  readonly evidence: readonly Evidence[];
  readonly detailId: string;
  readonly isOpen: boolean;
  readonly selfChoices: ReadonlyMap<string, SelfReportState>;
  readonly onSelfChoice: (conceptId: string, choice: SelfReportState) => void;
}): HTMLElement {
  const { progress, records, concept, evidence, detailId, isOpen } = input;
  const detail = h('div', {
    class: 'edu-progress-detail',
    id: detailId,
    hidden: !isOpen,
    'data-testid': 'progress-detail',
  });
  detail.append(h('h3', { class: 'edu-progress-detail__title' }, '这次看到了什么'));

  const pills = h('div', { class: 'edu-progress-pills', 'data-testid': 'progress-evidence' });
  if (evidence.length === 0) {
    pills.append(statusChip('还没有留下作答', 'neutral'));
  } else {
    for (const entry of evidence) {
      pills.append(statusChip(EVIDENCE_KIND_LABELS[entry.kind], 'info'));
    }
  }
  const pages = sourcePages([
    ...evidence.flatMap((entry) => entry.sourceRefs),
    ...(concept?.sourceRefs ?? []),
  ]);
  const pageText = pageLabel(pages);
  if (pageText !== null) pills.append(h('span', { class: 'edu-tag' }, pageText));
  detail.append(pills);

  const current =
    input.selfChoices.get(progress.conceptId) ??
    latestSelfReportFor(records, progress.conceptId)?.claimedState ??
    null;
  const note = h(
    'p',
    {
      class: 'edu-progress-self__note',
      role: 'status',
      'aria-live': 'polite',
      'data-testid': 'progress-self-note',
    },
    current === null ? '先记下你的感觉' : `先记下你的感觉：${SELF_REPORT_LABELS[current]}`,
  );
  const selfRow = h(
    'div',
    { class: 'edu-progress-self' },
    h('span', { class: 'edu-progress-self__label' }, '你自己觉得呢？'),
  );
  const controls = new Map<SelfReportState, HTMLButtonElement>();
  for (const state of SELF_REPORT_OPTIONS) {
    const control = button(
      SELF_REPORT_LABELS[state],
      () => {
        for (const [optionState, optionControl] of controls) {
          optionControl.setAttribute('aria-pressed', String(optionState === state));
        }
        note.textContent = `先记下你的感觉：${SELF_REPORT_LABELS[state]}`;
        input.onSelfChoice(progress.conceptId, state);
      },
      { small: true, dataAction: 'self-report' },
    );
    control.setAttribute('aria-pressed', String(current === state));
    controls.set(state, control);
    selfRow.append(control);
  }
  selfRow.append(note);
  detail.append(selfRow);
  return detail;
}

function renderDataManagement(
  api: EducationShellApi,
  onStatus: (value: string) => void,
  onError: (error: Parameters<typeof renderErrorBanner>[0]) => void,
  onDeleted: () => void,
): HTMLElement {
  const section = h(
    'section',
    {
      class: 'edu-progress-manage',
      'aria-labelledby': 'progress-manage-title',
      'data-testid': 'records-data-management',
    },
    h(
      'div',
      { class: 'edu-progress-manage__text' },
      h('h2', { id: 'progress-manage-title' }, '导出或删除学习记录'),
      h(
        'p',
        {},
        '学习记录只保存在这台电脑上。想带走或清空，都在这里；课本文件不会被删除。',
      ),
    ),
  );

  const exportDialog = new ConfirmDialog({
    title: '导出学习记录',
    impact: [
      '导出内容：你的作答、判断记录、自评和复习安排。',
      '不会包含课本原文件或课本原图。',
      '导出文件会保存到你选择的位置，请自行妥善保管。',
    ],
    confirmLabel: '确认导出',
    onConfirm: () => {
      void (async () => {
        const result = await api.exportData();
        if (result.ok) {
          onStatus(`已导出 ${result.data.recordCount} 条记录。${result.data.note}`);
        } else {
          onError(result.error);
        }
      })();
    },
  });

  const deleteLearningDialog = new ConfirmDialog({
    title: '删除学习记录',
    tone: 'danger',
    acknowledgement: '我了解删除不可撤销，课本文件不会被删除。',
    impact: [
      '会删除这台电脑上的作答、判断记录、自评和复习安排。',
      '课本文件和课本原图不会被删除。',
      '删除后记录为空，重启后仍然为空，不会自动从云端恢复。',
    ],
    confirmLabel: '确认删除学习记录',
    onConfirm: () => {
      void (async () => {
        const result = await api.deleteData('learning_records');
        if (result.ok) {
          onStatus(result.data.note);
          onDeleted();
        } else {
          onError(result.error);
        }
      })();
    },
  });

  const removeBookDialog = new ConfirmDialog({
    title: '移除这本课本的本机关联',
    tone: 'danger',
    acknowledgement: '我了解只移除本机关联，不会删除课本源文件。',
    impact: [
      '会移除这台电脑与这本课本的关联和导入记录。',
      '不会删除课本文件、课本原图或已经写好的内容。',
      '已保存的学习记录仍保留，可以在进展里查看。',
    ],
    confirmLabel: '确认移除关联',
    onConfirm: () => {
      void (async () => {
        const result = await api.deleteData('book_link');
        if (result.ok) {
          onStatus(result.data.note);
        } else {
          onError(result.error);
        }
      })();
    },
  });

  const actions = h('div', { class: 'edu-progress-manage__actions' });
  const exportButton = button('导出学习记录', () => exportDialog.open(exportButton, section), {
    small: true,
    dataAction: 'export-records',
  });
  const deleteButton = button('删除学习记录', () => deleteLearningDialog.open(deleteButton, section), {
    small: true,
    tone: 'danger-ghost',
    dataAction: 'delete-records',
  });
  const bookButton = button('移除这本课本的关联', () => removeBookDialog.open(bookButton, section), {
    small: true,
    tone: 'ghost',
    dataAction: 'remove-book-link',
  });
  actions.append(exportButton, deleteButton, bookButton);
  section.append(actions, exportDialog.element, deleteLearningDialog.element, removeBookDialog.element);
  return section;
}
