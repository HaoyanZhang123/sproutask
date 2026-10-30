/**
 * Map DOM views. Pure render functions: they receive data + actions and return
 * elements; they never fetch, mutate learning state or decide scope.
 *
 * Accessibility invariants encoded here:
 * - the tree is a real `role="tree"` with roving tabindex and aria-expanded;
 * - the graph is decorative edges + real `<button>` nodes (Tab/Enter works with
 *   no pointer geometry);
 * - the same relation set is always available as a text table, and the chapter
 *   concepts are always available as a text list;
 * - relation type and status are conveyed by words and line style, never by
 *   colour alone.
 */

import type { Concept, Id, Relation, TocNodeLike } from '@edu/domain';
import { appendChildren, button, h, statusChip, type StatusTone } from '../../shell/src/index.js';
import {
  FILTER_LABELS,
  VIEW_MODE_LABELS,
  type ConceptStateSummary,
  type GraphLayout,
  type MapAggregate,
  type MapViewMode,
  type StateFilter,
  type TocTreeRow,
  filterGraphSlice,
  layoutGraph,
} from './model.js';
import type {
  ConceptDetail,
  ConceptSearchHit,
  GraphSlice,
  MapPayload,
  MapSourceSummary,
} from './types.js';

export interface MapActions {
  readonly selectNode: (nodeId: Id) => void;
  readonly toggleNode: (nodeId: Id) => void;
  readonly selectConcept: (conceptId: Id) => void;
  readonly setViewMode: (mode: MapViewMode) => void;
  readonly setFilter: (filter: StateFilter) => void;
  readonly clearFilter: () => void;
  readonly setQuery: (value: string) => void;
  readonly submitSearch: () => void;
  readonly clearSearch: () => void;
  readonly showMoreConcepts: () => void;
  readonly expandExternal: (conceptId: Id) => void;
  readonly collapseExternal: () => void;
  readonly navigate: (path: string) => void;
}

export const RELATION_TYPE_LABELS: Record<Relation['type'], string> = {
  prerequisite: '先修',
  related: '相关',
};

export const RELATION_BASIS_LABELS: Record<Relation['basis'], string> = {
  explicit_source: '教材明示',
  pedagogical_inference: '教学推断（非教材原文）',
};

export const RELATION_DIRECTION_LABELS: Record<Relation['type'], string> = {
  prerequisite: '起点 → 终点（建议先理解起点）',
  related: '起点 ↔ 终点（无先后）',
};

const TRUST_TONE: Record<'published' | 'candidate', StatusTone> = {
  published: 'neutral',
  candidate: 'attention',
};

export function toneToStatus(tone: 'neutral' | 'progress' | 'attention' | 'positive' | 'danger' | 'info'): StatusTone {
  return tone;
}

/* ------------------------------------------------------------------ chrome */

export function renderFixtureNotice(payload: MapPayload): HTMLElement | null {
  if (!payload.fixture) return null;
  return h(
    'div',
    {
      class: 'edu-map-fixture',
      role: 'note',
      'data-testid': 'map-fixture-notice',
      'data-edu-fixture': 'true',
    },
    h('strong', {}, '演示数据（fixture）'),
    h('span', {}, payload.notice ?? '当前地图不是真实教材或真实 API 结果。'),
  );
}

export function renderPackBadges(payload: MapPayload): HTMLElement {
  const holder = h('div', { class: 'edu-map-badges', 'data-testid': 'map-pack-badges' });
  holder.append(
    statusChip(
      payload.trustMode === 'candidate' ? '候选内容（未核实）' : '已审核内容包',
      TRUST_TONE[payload.trustMode],
      { testId: 'map-trust-badge' },
    ),
  );
  if (payload.scope === 'partial') {
    holder.append(
      statusChip('部分内容（未覆盖全册）', 'attention', { testId: 'map-scope-badge' }),
    );
  } else {
    holder.append(statusChip('全册范围', 'neutral', { testId: 'map-scope-badge' }));
  }
  if (payload.trustMode === 'candidate') {
    holder.append(
      h(
        'p',
        { class: 'edu-map-candidate-banner', role: 'status', 'data-testid': 'map-candidate-banner' },
        '候选内容：可用于显式试用；理解状态固定为“尚无足够证据”，不会显示强结论。',
      ),
    );
  }
  return holder;
}

export function renderSummaryBar(payload: MapPayload, aggregate: MapAggregate): HTMLElement {
  return h(
    'div',
    { class: 'edu-map-summary', 'data-testid': 'map-summary' },
    h('p', { class: 'edu-map-summary__line' }, aggregate.activityCoverageLabel),
    h(
      'p',
      { class: 'edu-map-summary__line' },
      `待复习 ${aggregate.due} · 理解需巩固 ${aggregate.needsSupport} · 尚无足够证据 ${aggregate.unassessed}`,
    ),
    aggregate.candidateTotal > 0
      ? h(
          'p',
          { class: 'edu-map-summary__line' },
          `候选概念 ${aggregate.candidateTotal} 个（单列，不进入正式分母）`,
        )
      : null,
  );
}

export function renderViewTabs(active: MapViewMode, actions: MapActions): HTMLElement {
  const holder = h('div', {
    class: 'edu-map-tabs',
    role: 'group',
    'aria-label': '地图视图切换',
    'data-testid': 'map-view-tabs',
  });
  for (const mode of ['graph', 'relations', 'concepts'] as const) {
    const selected = mode === active;
    const element = h(
      'button',
      {
        type: 'button',
        class: 'edu-map-tab',
        'aria-pressed': selected ? 'true' : 'false',
        'data-view-mode': mode,
        onclick: () => actions.setViewMode(mode),
      },
      VIEW_MODE_LABELS[mode],
    );
    holder.append(element);
  }
  return holder;
}

export function renderFilterBar(active: StateFilter, actions: MapActions): HTMLElement {
  const holder = h('div', {
    class: 'edu-map-filters',
    role: 'group',
    'aria-label': '概念筛选',
    'data-testid': 'map-filters',
  });
  holder.append(h('span', { class: 'edu-map-filters__label' }, '筛选：'));
  for (const filter of ['all', 'needs_support', 'due', 'unassessed'] as const) {
    holder.append(
      h(
        'button',
        {
          type: 'button',
          class: 'edu-map-filter',
          'aria-pressed': filter === active ? 'true' : 'false',
          'data-filter': filter,
          onclick: () => actions.setFilter(filter),
        },
        FILTER_LABELS[filter],
      ),
    );
  }
  return holder;
}

/* -------------------------------------------------------------------- tree */

export function renderTree(
  rows: readonly TocTreeRow[],
  selectedNodeId: Id | null,
  focusId: Id | null,
  actions: MapActions,
): HTMLElement {
  const tree = h('ul', {
    role: 'tree',
    class: 'edu-map-tree',
    'aria-label': '教材目录',
    'data-testid': 'map-tree',
  });
  for (const row of rows) {
    const selected = row.node.id === selectedNodeId;
    const focusable = row.node.id === (focusId ?? rows[0]?.node.id ?? '');
    const label = `${row.node.title}，${row.conceptCount} 个概念，已学 ${row.learnedCount}`;
    const item = h(
      'li',
      {
        role: 'treeitem',
        'aria-level': row.depth + 1,
        'aria-selected': selected ? 'true' : 'false',
        'aria-expanded': row.hasChildren ? (row.expanded ? 'true' : 'false') : undefined,
        'data-toc-id': row.node.id,
        'data-node-type': row.node.type,
        'data-toc-focus': focusable ? 'true' : undefined,
        tabindex: focusable ? 0 : -1,
        class: `edu-map-tree__item${selected ? ' is-selected' : ''}`,
        onclick: () => actions.selectNode(row.node.id),
      },
      h(
        'span',
        { class: 'edu-map-tree__row' },
        h(
          'button',
          {
            type: 'button',
            class: 'edu-map-tree__toggle',
            tabindex: -1,
            'aria-label': row.hasChildren
              ? `${row.expanded ? '收起' : '展开'}${row.node.title}`
              : `${row.node.title} 没有子目录`,
            'aria-hidden': row.hasChildren ? undefined : 'true',
            'data-toggle-toc': row.hasChildren ? row.node.id : undefined,
            onclick: (event: Event) => {
              event.stopPropagation();
              if (row.hasChildren) actions.toggleNode(row.node.id);
            },
          },
          row.hasChildren ? (row.expanded ? '▾' : '▸') : '·',
        ),
        h('span', { class: 'edu-map-tree__title' }, row.node.title),
        h('span', { class: 'edu-map-tree__counts' }, `${row.conceptCount} 概念 · 已学 ${row.learnedCount}`),
        row.dueCount > 0
          ? statusChip(`待复习 ${row.dueCount}`, 'info', { detail: '该范围内的复习安排' })
          : null,
        row.needsSupportCount > 0
          ? statusChip(`需巩固 ${row.needsSupportCount}`, 'attention', { detail: '该范围内的理解状态' })
          : null,
      ),
    );
    item.dataset['label'] = label;
    tree.append(item);
  }
  return tree;
}

export function renderTreeHelp(): HTMLElement {
  return h(
    'p',
    { class: 'edu-map-help', 'data-testid': 'map-tree-help' },
    '键盘：↑/↓ 在目录项间移动，→ 展开或进入子目录，← 收起或回到上级，Enter/空格 选择范围。',
  );
}

/* ------------------------------------------------------------------- graph */

const NODE_W = 1100;
const NODE_H = 550;
const PITCH_X = 1250;
const PITCH_Y = 650;
const UNITS_PER_REM = 100;

function nodeCenter(position: { readonly col: number; readonly row: number }): { x: number; y: number } {
  return {
    x: position.col * PITCH_X + NODE_W / 2,
    y: position.row * PITCH_Y + NODE_H / 2,
  };
}

function renderEdge(
  relation: Relation,
  from: { readonly col: number; readonly row: number },
  to: { readonly col: number; readonly row: number },
): HTMLElement {
  const start = nodeCenter(from);
  const end = nodeCenter(to);
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const length = Math.sqrt(dx * dx + dy * dy);
  const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
  return h('div', {
    class: `edu-map-edge edu-map-edge--${relation.type}`,
    'data-edge-type': relation.type,
    'data-relation-id': relation.id,
    'aria-hidden': 'true',
    style: `left:${start.x / UNITS_PER_REM}rem;top:${start.y / UNITS_PER_REM}rem;width:${length / UNITS_PER_REM}rem;transform:rotate(${angle}deg)`,
  });
}

export function renderGraphLegend(externalCount: number): HTMLElement {
  return h(
    'ul',
    { class: 'edu-map-legend', 'data-testid': 'map-graph-legend', 'aria-label': '关系图图例' },
    h(
      'li',
      { class: 'edu-map-legend__item', 'data-legend': 'prerequisite' },
      h('span', { class: 'edu-map-legend__line edu-map-legend__line--prerequisite', 'aria-hidden': 'true' }),
      '先修（实线箭头）：建议先理解起点再学终点，不阻断进入。',
    ),
    h(
      'li',
      { class: 'edu-map-legend__item', 'data-legend': 'related' },
      h('span', { class: 'edu-map-legend__line edu-map-legend__line--related', 'aria-hidden': 'true' }),
      '相关（虚线）：只有关联，没有先后要求。',
    ),
    h(
      'li',
      { class: 'edu-map-legend__item', 'data-legend': 'external' },
      externalCount > 0
        ? `跨章节点 ${externalCount} 个：虚线框显示在“跨章关联”中，可显式展开。`
        : '跨章节点：当前范围没有跨章关系。',
    ),
  );
}

export function renderGraph(
  slice: GraphSlice,
  payload: MapPayload,
  visibleConceptIds: readonly Id[],
  actions: MapActions,
): HTMLElement {
  const layout: GraphLayout = layoutGraph(slice, visibleConceptIds, slice.centerConceptId);
  const filtered = filterGraphSlice(slice, visibleConceptIds);
  const widthRem = (layout.columns * PITCH_X) / UNITS_PER_REM;
  const heightRem = (layout.rows * PITCH_Y) / UNITS_PER_REM;
  const canvas = h('div', {
    class: 'edu-map-canvas',
    'data-testid': 'map-graph-canvas',
    'data-node-count': String(filtered.concepts.length),
    'data-edge-count': String(filtered.relations.length),
    style: `width:${widthRem}rem;height:${heightRem}rem`,
  });
  const edgeLayer = h('div', {
    class: 'edu-map-canvas__edges',
    'aria-hidden': 'true',
    'data-testid': 'map-graph-edges',
  });
  for (const relation of filtered.relations) {
    const from = layout.positions.get(relation.fromConceptId);
    const to = layout.positions.get(relation.toConceptId);
    if (from === undefined || to === undefined) continue;
    edgeLayer.append(renderEdge(relation, from, to));
  }
  canvas.append(edgeLayer);
  for (const concept of filtered.concepts) {
    const position = layout.positions.get(concept.id);
    if (position === undefined) continue;
    const summary = summarize(payload, concept.id);
    const selected = concept.id === slice.centerConceptId;
    canvas.append(
      h(
        'button',
        {
          type: 'button',
          class: `edu-map-node${selected ? ' is-center' : ''}`,
          'data-concept-id': concept.id,
          'data-understanding': summary.understanding.state,
          style: `left:${(position.col * PITCH_X) / UNITS_PER_REM}rem;top:${(position.row * PITCH_Y) / UNITS_PER_REM}rem`,
          'aria-label': `${concept.title}。学习进程：${summary.learning.label}。理解证据：${summary.understanding.label}。复习：${summary.review.historyLabel}，${summary.review.dueLabel}。`,
          onclick: () => actions.selectConcept(concept.id),
        },
        h('span', { class: 'edu-map-node__title' }, concept.title),
        h('span', { class: 'edu-map-node__state' }, `${summary.learning.label} · ${summary.understanding.label}`),
        summary.review.dueLabel === '待复习'
          ? h('span', { class: 'edu-map-node__due' }, '待复习')
          : null,
      ),
    );
  }
  return h(
    'div',
    { class: 'edu-map-graph', 'data-testid': 'map-graph' },
    renderGraphLegend(slice.externalConcepts.length),
    h('div', { class: 'edu-map-canvas__scroll' }, canvas),
    h(
      'p',
      { class: 'edu-map-help' },
      '图的键盘路径：Tab 在节点间移动，Enter/空格 选择概念；每种线型在“关系列表”中都有同等的文字记录。',
    ),
  );
}

import { summarizeConceptState } from './model.js';

function summarize(payload: MapPayload, conceptId: Id): ConceptStateSummary {
  return summarizeConceptState(payload, conceptId);
}

/* -------------------------------------------------------------- relations */

function relationEndpoints(
  payload: MapPayload,
  relation: Relation,
): { readonly from: string; readonly to: string } {
  const title = (conceptId: Id): string =>
    payload.concepts.find((entry) => entry.id === conceptId)?.title ?? conceptId;
  return { from: title(relation.fromConceptId), to: title(relation.toConceptId) };
}

function sourceLabel(payload: MapPayload, sourceRefId: Id): string {
  const source = payload.sources.find((entry) => entry.sourceRefId === sourceRefId);
  return source?.label ?? `出处 ${sourceRefId}（未在本机核实）`;
}

export function renderRelationList(
  slice: GraphSlice,
  payload: MapPayload,
  visibleConceptIds: readonly Id[],
  actions: MapActions,
): HTMLElement {
  const filtered = filterGraphSlice(slice, visibleConceptIds);
  const table = h(
    'table',
    { class: 'edu-map-relations', 'data-testid': 'map-relation-list' },
    h('caption', { class: 'edu-map-relations__caption' }, '当前范围的关系（文字替代，与关系图等价）'),
  );
  const head = h('tr');
  for (const label of ['起点', '关系', '方向', '终点', '依据', '理由', '出处']) {
    head.append(h('th', { scope: 'col' }, label));
  }
  table.append(h('thead', {}, head));
  const body = h('tbody');
  if (filtered.relations.length === 0) {
    body.append(
      h(
        'tr',
        {},
        h(
          'td',
          { colspan: 7 },
          visibleConceptIds.length === 0
            ? '当前筛选没有可选择的概念；清除筛选后可查看关系。'
            : '当前范围尚未建立有依据的关系，保留目录与概念列表，不合成依赖。',
        ),
      ),
    );
  }
  for (const relation of filtered.relations) {
    const { from, to } = relationEndpoints(payload, relation);
    const row = h(
      'tr',
      { 'data-relation-id': relation.id, 'data-edge-type': relation.type },
      h(
        'td',
        {},
        h(
          'button',
          {
            type: 'button',
            class: 'edu-map-link',
            onclick: () => actions.selectConcept(relation.fromConceptId),
          },
          from,
        ),
      ),
      h('td', { 'data-relation-type': relation.type }, RELATION_TYPE_LABELS[relation.type]),
      h('td', {}, RELATION_DIRECTION_LABELS[relation.type]),
      h(
        'td',
        {},
        h(
          'button',
          {
            type: 'button',
            class: 'edu-map-link',
            onclick: () => actions.selectConcept(relation.toConceptId),
          },
          to,
        ),
      ),
      h('td', { 'data-relation-basis': relation.basis }, RELATION_BASIS_LABELS[relation.basis]),
      h('td', { class: 'edu-map-relations__rationale' }, relation.rationale),
      h(
        'td',
        {},
        relation.sourceRefs.length === 0
          ? '教学推断（无教材出处）'
          : relation.sourceRefs.map((sourceRefId) => sourceLabel(payload, sourceRefId)).join('；'),
      ),
    );
    body.append(row);
  }
  table.append(body);
  return h(
    'div',
    { class: 'edu-map-relations-wrap' },
    table,
    h(
      'p',
      { class: 'edu-map-help' },
      '“先修”是建议而非锁：即使先修概念尚未学习，也可以直接进入终点概念。',
    ),
  );
}

/* ---------------------------------------------------------- concept lists */

export function renderConceptList(
  concepts: readonly Concept[],
  payload: MapPayload,
  filter: StateFilter,
  actions: MapActions,
): HTMLElement {
  const list = h('ul', { class: 'edu-map-concept-list', 'data-testid': 'map-concept-list' });
  if (concepts.length === 0) {
    return h(
      'div',
      { class: 'edu-map-empty', 'data-testid': 'map-concept-list-empty' },
      h('p', {}, filter === 'all' ? '当前范围没有可显示的概念。' : '当前筛选没有匹配的概念。'),
      filter === 'all'
        ? null
        : button('清除筛选', actions.clearFilter, { tone: 'primary', dataAction: 'clear-filter' }),
    );
  }
  for (const concept of concepts) {
    const summary = summarizeConceptState(payload, concept.id);
    list.append(
      h(
        'li',
        { class: 'edu-map-concept-list__item', 'data-concept-id': concept.id },
        h(
          'button',
          {
            type: 'button',
            class: 'edu-map-concept-list__button',
            onclick: () => actions.selectConcept(concept.id),
          },
          h('span', { class: 'edu-map-concept-list__title' }, concept.title),
          h(
            'span',
            { class: 'edu-map-concept-list__states' },
            statusChip(summary.learning.label, summary.learning.tone),
            statusChip(summary.understanding.label, summary.understanding.tone),
            statusChip(summary.review.historyLabel, summary.review.tone),
            summary.review.dueLabel === '待复习' ? statusChip('待复习', 'info') : null,
            summary.selfReportLabel !== null ? statusChip('含自评', 'neutral') : null,
          ),
        ),
      ),
    );
  }
  return h(
    'div',
    {},
    h(
      'p',
      { class: 'edu-map-help' },
      `本章共 ${concepts.length} 个去重概念；同概念多节只计一次。`,
    ),
    list,
  );
}

/* ----------------------------------------------------------- detail panel */

function renderStateChipRow(summary: ConceptStateSummary): HTMLElement {
  const row = h('div', { class: 'edu-map-detail__states', 'data-testid': 'map-detail-states' });
  appendChildren(row, [
    h('span', { class: 'edu-map-detail__axis' }, '学习进程：'),
    statusChip(summary.learning.label, summary.learning.tone, { testId: 'detail-learning' }),
    h('span', { class: 'edu-map-detail__axis' }, '理解证据：'),
    statusChip(summary.understanding.label, summary.understanding.tone, { testId: 'detail-understanding' }),
    h('span', { class: 'edu-map-detail__axis' }, '复习：'),
    statusChip(summary.review.historyLabel, summary.review.tone, { testId: 'detail-review-history' }),
    statusChip(summary.review.dueLabel, summary.review.dueLabel === '待复习' ? 'info' : 'neutral', {
      testId: 'detail-review-due',
    }),
    summary.review.activeLabel !== null
      ? statusChip(summary.review.activeLabel, 'progress', { testId: 'detail-review-active' })
      : null,
  ]);
  return row;
}

export function renderDetail(
  detail: ConceptDetail,
  payload: MapPayload,
  actions: MapActions,
): HTMLElement {
  const summary = summarizeConceptState(payload, detail.concept.id);
  const root = h('article', {
    class: 'edu-map-detail',
    'aria-label': '概念详情',
    'data-testid': 'map-detail',
    'data-concept-id': detail.concept.id,
  });
  appendChildren(root, [
    h('h2', { class: 'edu-map-detail__title', tabindex: -1 }, detail.concept.title),
    detail.concept.aliases.length > 0
      ? h('p', { class: 'edu-map-detail__meta' }, `别名：${detail.concept.aliases.join('、')}`)
      : null,
    h(
      'p',
      { class: 'edu-map-detail__meta' },
      `目录位置：${detail.placements
        .map((placement) => placement.path.join(' › '))
        .join('；')}`,
    ),
    renderStateChipRow(summary),
    summary.selfReportLabel !== null
      ? h(
          'p',
          { class: 'edu-map-detail__self', 'data-testid': 'map-detail-self-report' },
          summary.selfReportLabel,
        )
      : h(
          'p',
          { class: 'edu-map-detail__meta' },
          '自评：尚未填写（自评是学生观点，与系统证据分开显示）',
        ),
    h(
      'p',
      { class: 'edu-map-detail__meta', 'data-testid': 'map-detail-evidence' },
      summary.evidenceCount === 0
        ? '证据：还没有可见证据。'
        : `证据：共 ${summary.evidenceCount} 条，其中当前有效的独立证据 ${summary.currentIndependentEvidenceCount} 条。`,
    ),
  ]);

  if (summary.understanding.candidateDisabled) {
    root.append(
      h(
        'p',
        { class: 'edu-map-notice', role: 'status', 'data-testid': 'map-candidate-claim-warning' },
        '候选内容：即使本地记录里有理解判断，也只显示“尚无足够证据”，不显示强结论。',
      ),
    );
  }

  const prerequisites = detail.prerequisites.map((relation) => {
    const source = payload.concepts.find((entry) => entry.id === relation.fromConceptId) ?? null;
    const progress = payload.progress.find((entry) => entry.conceptId === relation.fromConceptId) ?? null;
    return { relation, source, learned: progress?.learning.state === 'completed' };
  });
  if (prerequisites.length > 0) {
    const pending = prerequisites.filter((entry) => !entry.learned);
    const block = h('section', {
      class: 'edu-map-detail__section',
      'data-testid': 'map-detail-prerequisites',
    });
    block.append(
      h('h3', {}, pending.length > 0 ? '建议先学（不阻断进入）' : '先修已学'),
      ...prerequisites.map((entry) =>
        h(
          'div',
          {
            class: `edu-map-prereq${entry.learned ? ' is-learned' : ''}`,
            'data-prereq-id': entry.relation.fromConceptId,
            'data-prereq-learned': entry.learned ? 'true' : 'false',
          },
          h(
            'p',
            { class: 'edu-map-prereq__title' },
            entry.learned ? `✓ 已学：${entry.source?.title ?? entry.relation.fromConceptId}` : `建议先学：${entry.source?.title ?? entry.relation.fromConceptId}`,
          ),
          h(
            'p',
            { class: 'edu-map-prereq__meta' },
            `${RELATION_TYPE_LABELS[entry.relation.type]} · ${RELATION_BASIS_LABELS[entry.relation.basis]} · 理由：${entry.relation.rationale}`,
          ),
          h(
            'p',
            { class: 'edu-map-prereq__meta' },
            entry.relation.sourceRefs.length === 0
              ? '出处：教学推断（无教材出处）'
              : `出处：${entry.relation.sourceRefs.map((ref) => sourceLabel(payload, ref)).join('；')}`,
          ),
          entry.learned
            ? null
            : h(
                'div',
                { class: 'edu-map-prereq__actions' },
                button(
                  `先看看${entry.source?.title ?? ''}`,
                  () => actions.selectConcept(entry.relation.fromConceptId),
                  { dataAction: 'look-first' },
                ),
                button('直接学习目标概念', () => {
                  actions.navigate(`/workspace?concept=${detail.concept.id}&mode=learn`);
                }, { dataAction: 'learn-target-anyway' }),
              ),
        ),
      ),
    );
    root.append(block);
  }

  const relations = h('section', {
    class: 'edu-map-detail__section',
    'data-testid': 'map-detail-relations',
  });
  relations.append(h('h3', {}, `关系（${detail.relations.length}）`));
  if (detail.relations.length === 0) {
    relations.append(h('p', { class: 'edu-map-detail__meta' }, '暂未建立关系；保留目录定位。'));
  }
  for (const relation of detail.relations) {
    const otherId =
      relation.fromConceptId === detail.concept.id ? relation.toConceptId : relation.fromConceptId;
    const other = payload.concepts.find((entry) => entry.id === otherId);
    relations.append(
      h(
        'p',
        { class: 'edu-map-detail__relation', 'data-relation-id': relation.id },
        `${RELATION_TYPE_LABELS[relation.type]} · ${RELATION_BASIS_LABELS[relation.basis]} · ${
          relation.fromConceptId === detail.concept.id ? '指向' : '来自'
        } ${other?.title ?? otherId} · 理由：${relation.rationale}`,
      ),
    );
  }
  root.append(relations);

  const sources = h('section', {
    class: 'edu-map-detail__section',
    'data-testid': 'map-detail-sources',
  });
  sources.append(h('h3', {}, '出处与材料'));
  if (detail.sources.length === 0) {
    sources.append(h('p', {}, '该概念还没有登记出处。'));
  }
  for (const source of detail.sources) {
    sources.append(
      h(
        'p',
        { class: 'edu-map-detail__source', 'data-source-ref': source.sourceRefId },
        source.label,
        source.bookAvailable ? h('span', {}, ' · 材料在本机可用') : h('span', {}, ' · 材料不可用'),
      ),
    );
  }
  root.append(sources);

  root.append(
    h(
      'div',
      { class: 'edu-map-detail__actions', 'data-testid': 'map-detail-actions' },
      button('开始学习', () => actions.navigate(`/workspace?concept=${detail.concept.id}&mode=learn`), {
        tone: 'primary',
        dataAction: 'start-learn',
      }),
      button('开始复习', () => actions.navigate(`/workspace?concept=${detail.concept.id}&mode=review`), {
        dataAction: 'start-review',
      }),
      button('查看关系列表', () => actions.setViewMode('relations'), { dataAction: 'show-relations' }),
      button('返回目录范围', () => {
        const placement = detail.placements[0];
        if (placement !== undefined) actions.selectNode(placement.tocNodeId);
      }, { dataAction: 'back-to-scope' }),
    ),
  );
  return root;
}

/* --------------------------------------------------------------- search */

export function renderSearch(
  query: string,
  submitted: string | null,
  hits: readonly ConceptSearchHit[] | null,
  error: string | null,
  actions: MapActions,
): HTMLElement {
  const inputId = 'edu-map-search-input';
  const form = h('form', {
    class: 'edu-map-search',
    role: 'search',
    'data-testid': 'map-search',
    onsubmit: (event: Event) => {
      event.preventDefault();
      actions.submitSearch();
    },
  });
  appendChildren(form, [
    h('label', { class: 'edu-map-search__label', for: inputId }, '搜索概念（标题或别名）'),
    h('input', {
      id: inputId,
      class: 'edu-map-search__input',
      type: 'search',
      value: query,
      autocomplete: 'off',
      'data-testid': 'map-search-input',
      oninput: (event: Event) => actions.setQuery((event.target as HTMLInputElement).value),
    }),
    button('搜索', () => actions.submitSearch(), { tone: 'primary', dataAction: 'search' }),
    submitted !== null ? button('清除搜索', () => actions.clearSearch(), { dataAction: 'clear-search' }) : null,
  ]);
  const holder = h('div', { class: 'edu-map-search-wrap' }, form);
  if (error !== null) holder.append(h('p', { class: 'edu-map-notice', role: 'alert' }, error));
  if (submitted !== null && hits !== null) {
    const results = h('ul', { class: 'edu-map-search__results', 'data-testid': 'map-search-results' });
    if (hits.length === 0) {
      results.append(h('li', {}, `没有找到与“${submitted}”匹配的概念；可以清除搜索或调整关键词。`));
    }
    for (const hit of hits) {
      results.append(
        h(
          'li',
          { 'data-concept-id': hit.conceptId },
          h(
            'button',
            {
              type: 'button',
              class: 'edu-map-link',
              onclick: () => actions.selectConcept(hit.conceptId),
            },
            hit.title,
          ),
          h('span', { class: 'edu-map-search__meta' }, ` · ${hit.tocTitle ?? '目录位置未知'} · 命中${hit.matchedOn === 'alias' ? '别名' : '标题'}“${hit.matchedText}”`),
        ),
      );
    }
    holder.append(results);
  }
  return holder;
}

/* ------------------------------------------------------------ range header */

export function renderRangeHeader(
  slice: GraphSlice,
  payload: MapPayload,
  visibleConceptIds: readonly Id[],
  actions: MapActions,
): HTMLElement {
  const chapter =
    slice.scopeTocNodeId === null
      ? null
      : payload.toc.find((node) => node.id === slice.scopeTocNodeId) ?? null;
  const holder = h('div', { class: 'edu-map-range', 'data-testid': 'map-range-header' });
  holder.append(
    h(
      'p',
      { class: 'edu-map-range__title' },
      slice.scopeTocNodeId === null
        ? '已展开跨章局部邻域（有界）'
        : `当前范围：${chapter?.title ?? slice.scopeTocNodeId}`,
    ),
    h(
      'p',
      { class: 'edu-map-range__meta' },
      `显示 ${visibleConceptIds.length} 个概念 · ${slice.stats.maxDepth} 层内 · 同概念多节只计一次`,
    ),
  );
  if (slice.scopeTocNodeId === null) {
    holder.append(
      button('返回本章范围', () => actions.collapseExternal(), { dataAction: 'collapse-external' }),
    );
  } else if (slice.hiddenConceptCount > 0) {
    holder.append(
      h(
        'p',
        { class: 'edu-map-range__meta', 'data-testid': 'map-hidden-count' },
        `本章还有 ${slice.hiddenConceptCount} 个概念未显示（不会一次铺满全册）。`,
      ),
      button(`展开更多概念（+12）`, () => actions.showMoreConcepts(), {
        dataAction: 'show-more-concepts',
      }),
    );
  }
  if (slice.externalConcepts.length > 0) {
    const external = h('div', {
      class: 'edu-map-external',
      'data-testid': 'map-external-concepts',
    });
    external.append(
      h('p', { class: 'edu-map-external__title' }, `跨章关联 ${slice.externalConcepts.length} 个（未直接绘制）`),
    );
    for (const concept of slice.externalConcepts) {
      external.append(
        h(
          'div',
          { class: 'edu-map-external__item', 'data-concept-id': concept.id },
          h('span', {}, concept.title),
          button('展开跨章', () => actions.expandExternal(concept.id), {
            small: true,
            dataAction: 'expand-external',
          }),
        ),
      );
    }
    holder.append(external);
  }
  return holder;
}
