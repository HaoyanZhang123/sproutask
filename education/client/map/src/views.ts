/**
 * Two-level map DOM views. Pure render functions: they receive the display
 * model + actions and return elements; they never fetch or mutate learning
 * state.
 *
 * Accessibility invariants:
 * - every action is a native `<button>`; Tab order follows reading order;
 * - concept state is always colour + word + shape, never colour alone;
 * - the graph is decorative (aria-hidden) edges + real buttons, and the same
 *   chapter data is always available as a nested list (`列表`);
 * - narrow screens get a vertical stage list instead of a sideways graph.
 */

import type { Id } from '@edu/domain';
import { appendChildren, button, h, statusChip } from '../../shell/src/index.js';
import { CHAPTER_GRAPH_METRICS, pxToRem, relationPath, type ChapterLayoutNode } from './layout.js';
import {
  CONCEPT_STATE_META,
  CONCEPT_STATE_ORDER,
  VIEW_MODE_LABELS,
  chapterPeers,
  relationPeers,
  sourcePagesFor,
  type ConceptState,
  type ConceptStateSummary,
  type MapChapter,
  type MapModel,
  type MapViewMode,
  type OverviewChapter,
  type OverviewFilterResult,
  type OverviewUnit,
  type RelationPeer,
} from './model.js';
import type { ConceptDetail, MapPayload } from './types.js';

export interface MapActions {
  readonly openChapter: (chapterId: Id) => void;
  readonly backToOverview: () => void;
  readonly selectConcept: (conceptId: Id) => void;
  readonly setViewMode: (mode: MapViewMode) => void;
  readonly setQuery: (value: string) => void;
  readonly clearSearch: () => void;
  readonly resume: () => void;
  readonly navigate: (path: string) => void;
  readonly retry: () => void;
}

const SVG_NS = 'http://www.w3.org/2000/svg';
const OVERVIEW_CHIP_LIMIT = 6;

/* -------------------------------------------------------------- svg icons */

function svgElement<K extends keyof SVGElementTagNameMap>(
  tag: K,
  attrs: Readonly<Record<string, string | number>> = {},
): SVGElementTagNameMap[K] {
  const element = document.createElementNS(SVG_NS, tag);
  for (const [name, value] of Object.entries(attrs)) element.setAttribute(name, String(value));
  return element;
}

export type MapIconName = 'search' | 'pin' | 'chevron';

export function renderIcon(name: MapIconName): SVGSVGElement {
  const svg = svgElement('svg', {
    viewBox: '0 0 24 24',
    class: 'edu-map-icon',
    'aria-hidden': 'true',
    focusable: 'false',
  });
  const stroked = (d: string): SVGPathElement => {
    const path = svgElement('path', {
      d,
      fill: 'none',
      stroke: 'currentColor',
      'stroke-width': '1.8',
      'stroke-linecap': 'round',
      'stroke-linejoin': 'round',
    });
    svg.append(path);
    return path;
  };
  if (name === 'search') {
    svg.append(
      svgElement('circle', {
        cx: '11',
        cy: '11',
        r: '6.2',
        fill: 'none',
        stroke: 'currentColor',
        'stroke-width': '1.8',
      }),
    );
    stroked('m16 16 4 4');
  } else if (name === 'pin') {
    stroked('M12 21s6-5.4 6-10a6 6 0 1 0-12 0c0 4.6 6 10 6 10Z');
    svg.append(svgElement('circle', { cx: '12', cy: '11', r: '2.2', fill: 'currentColor' }));
  } else {
    stroked('m9 6 6 6-6 6');
  }
  return svg;
}

/* --------------------------------------------------------- state encoding */

export function renderStateGlyph(state: ConceptState): HTMLElement {
  return h('span', {
    class: 'edu-map-state-glyph',
    'data-state': state,
    'data-shape': CONCEPT_STATE_META[state].shape,
    'aria-hidden': 'true',
  });
}

/** Colour + word + shape together. `compact` keeps the word, hides nothing. */
export function renderStateBadge(state: ConceptState): HTMLElement {
  return h(
    'span',
    { class: 'edu-map-state', 'data-state': state, 'data-state-label': CONCEPT_STATE_META[state].label },
    renderStateGlyph(state),
    h('span', { class: 'edu-map-state__label' }, CONCEPT_STATE_META[state].label),
  );
}

export function renderStateLegend(): HTMLElement {
  const list = h('ul', {
    class: 'edu-map-legend',
    'data-testid': 'map-legend',
    'aria-label': '概念状态图例',
  });
  for (const state of CONCEPT_STATE_ORDER) {
    list.append(
      h(
        'li',
        { class: 'edu-map-legend__item', 'data-state': state },
        renderStateGlyph(state),
        h('span', {}, CONCEPT_STATE_META[state].label),
      ),
    );
  }
  return list;
}

/* ----------------------------------------------------------------- chrome */

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
      payload.trustMode === 'candidate' ? '候选内容（未核实）' : '已核对',
      payload.trustMode === 'candidate' ? 'attention' : 'neutral',
      { testId: 'map-trust-badge' },
    ),
  );
  holder.append(
    statusChip(
      payload.scope === 'partial' ? '部分内容（未覆盖全册）' : '全册',
      payload.scope === 'partial' ? 'attention' : 'neutral',
      { testId: 'map-scope-badge' },
    ),
  );
  if (payload.trustMode === 'candidate') {
    holder.append(
      h(
        'p',
        { class: 'edu-map-candidate-banner', role: 'status', 'data-testid': 'map-candidate-banner' },
        '候选内容还没核实：只显示你练过什么，不下结论。',
      ),
    );
  }
  return holder;
}

export function renderOverviewToolbar(
  model: MapModel,
  filter: OverviewFilterResult,
  actions: MapActions,
): HTMLElement {
  const overview = model.overview();
  const totals = overview.totals;
  const holder = h('div', { class: 'edu-map-toolbar', 'data-testid': 'map-toolbar' });
  holder.append(
    h(
      'div',
      { class: 'edu-map-summary' },
      h(
        'p',
        { class: 'edu-map-summary__title', 'data-testid': 'map-summary' },
        `${totals.units} 个单元 · ${totals.chapters} 章 · ${totals.sections} 节 · ${totals.concepts} 个概念`,
      ),
      h('p', { class: 'edu-map-summary__line' }, `已学 ${totals.learned} / ${totals.concepts} 个概念`),
    ),
  );

  const inputId = 'edu-map-search-input';
  const form = h('form', {
    class: 'edu-map-search',
    role: 'search',
    'data-testid': 'map-search',
    onsubmit: (event: Event) => {
      event.preventDefault();
    },
  });
  appendChildren(form, [
    h('label', { class: 'edu-visually-hidden', for: inputId }, '按概念标题搜索'),
    renderIcon('search'),
    h('input', {
      id: inputId,
      class: 'edu-map-search__input',
      type: 'search',
      value: filter.active ? filter.query : '',
      placeholder: '搜概念，比如“细胞”',
      autocomplete: 'off',
      'aria-label': '按概念标题搜索',
      'data-testid': 'map-search-input',
      oninput: (event: Event) => actions.setQuery((event.target as HTMLInputElement).value),
    }),
    filter.active
      ? button('清除', () => actions.clearSearch(), { small: true, dataAction: 'clear-search' })
      : null,
  ]);
  holder.append(form);
  holder.append(
    button('回到我正在学的', () => actions.resume(), {
      small: true,
      dataAction: 'resume',
    }),
  );
  if (filter.active) {
    holder.append(
      h(
        'p',
        { class: 'edu-map-search__status', role: 'status', 'data-testid': 'map-search-status' },
        filter.matchCount === 0
          ? `没有找到与“${filter.query}”匹配的概念。`
          : `找到 ${filter.matchCount} 个概念，只显示匹配的章。`,
      ),
    );
  }
  return holder;
}

/* --------------------------------------------------------------- overview */

function renderChapterRow(
  entry: OverviewChapter,
  model: MapModel,
  filtering: boolean,
  actions: MapActions,
): HTMLElement {
  const titleId = `edu-map-chapter-title-${entry.chapter.id}`;
  const head = h('div', { class: 'edu-map-chapter__head' });
  head.append(
    h(
      'button',
      {
        type: 'button',
        class: 'edu-map-chapter__open',
        'data-action': 'open-chapter',
        'data-chapter-id': entry.chapter.id,
        onclick: () => actions.openChapter(entry.chapter.id),
      },
      h('span', { class: 'edu-map-chapter__name', id: titleId }, entry.chapter.title),
      renderIcon('chevron'),
    ),
    h(
      'span',
      { class: 'edu-map-chapter__meta' },
      `${entry.sections.length} 节 · ${entry.concepts.length} 个概念`,
    ),
  );

  const chips = h('ul', {
    class: 'edu-map-chips',
    'aria-label': `${entry.chapter.title}的概念`,
  });
  const visible = filtering ? entry.concepts : entry.concepts.slice(0, OVERVIEW_CHIP_LIMIT);
  for (const concept of visible) {
    const summary = model.summary(concept.id);
    chips.append(
      h(
        'li',
        { class: 'edu-map-chips__item' },
        h(
          'button',
          {
            type: 'button',
            class: 'edu-map-chip',
            'data-state': summary.state,
            'data-concept-id': concept.id,
            'aria-label': `${summary.title}，${summary.stateLabel}`,
            onclick: () => actions.selectConcept(concept.id),
          },
          h('span', { class: 'edu-map-chip__title' }, summary.title),
          h(
            'span',
            { class: 'edu-map-chip__state' },
            renderStateGlyph(summary.state),
            h('span', {}, summary.stateLabel),
          ),
        ),
      ),
    );
  }
  const hidden = entry.concepts.length - visible.length;
  if (!filtering && hidden > 0) {
    chips.append(
      h(
        'li',
        { class: 'edu-map-chips__item' },
        h(
          'button',
          {
            type: 'button',
            class: 'edu-map-chip edu-map-chip--more',
            'data-action': 'open-chapter',
            'data-chapter-id': entry.chapter.id,
            onclick: () => actions.openChapter(entry.chapter.id),
          },
          `还有 ${hidden} 个`,
        ),
      ),
    );
  }

  return h('li', { class: 'edu-map-chapter', 'data-chapter-id': entry.chapter.id }, head, chips);
}

function renderUnit(unit: OverviewUnit, model: MapModel, filtering: boolean, actions: MapActions): HTMLElement {
  const section = h('section', {
    class: 'edu-map-unit',
    'data-testid': 'map-unit',
    'data-unit-id': unit.unit?.id ?? 'volume',
    'aria-labelledby': `edu-map-unit-${unit.unit?.id ?? 'volume'}`,
  });
  const head = h('div', { class: 'edu-map-unit__head' });
  // 内容里的章标题可能已经带“第一单元”，避免重复显示两遍。
  if (unit.numberLabel !== null && !unit.title.startsWith(unit.numberLabel)) {
    head.append(h('p', { class: 'edu-map-unit__no' }, unit.numberLabel));
  }
  head.append(
    h('h2', { class: 'edu-map-unit__title', id: `edu-map-unit-${unit.unit?.id ?? 'volume'}` }, unit.title),
    h(
      'p',
      { class: 'edu-map-unit__stat' },
      `${unit.conceptCount} 个概念 · 已学 ${unit.learnedCount} 个`,
    ),
  );
  const list = h('ul', { class: 'edu-map-chapters' });
  for (const chapter of unit.chapters) {
    list.append(renderChapterRow(chapter, model, filtering, actions));
  }
  section.append(head, list);
  return section;
}

export function renderOverview(
  filter: OverviewFilterResult,
  model: MapModel,
  actions: MapActions,
): HTMLElement {
  const holder = h('div', { class: 'edu-map-overview', 'data-testid': 'map-overview' });
  holder.append(renderOverviewToolbar(model, filter, actions));
  holder.append(renderStateLegend());
  if (filter.units.length === 0) {
    holder.append(
      h(
        'div',
        { class: 'edu-map-empty', 'data-testid': 'map-overview-empty' },
        h('h2', {}, filter.active ? '没有找到匹配的概念' : '全册还没有可浏览的章'),
        h(
          'p',
          {},
          filter.active
            ? '换个词试试，或者清除搜索看整册。'
            : '等课本内容准备完后，这里会按单元列出每一章。',
        ),
        filter.active ? button('清除搜索', () => actions.clearSearch(), { dataAction: 'clear-search' }) : null,
      ),
    );
    return holder;
  }
  for (const unit of filter.units) {
    holder.append(renderUnit(unit, model, filter.active, actions));
  }
  return holder;
}

/* ------------------------------------------------------------- chapter top */

export function renderChapterHeader(
  chapter: MapChapter,
  viewMode: MapViewMode,
  actions: MapActions,
): HTMLElement {
  const holder = h('div', { class: 'edu-map-chapter-top' });
  const crumb = h('nav', { class: 'edu-map-crumb', 'aria-label': '当前位置' });
  crumb.append(
    h(
      'button',
      {
        type: 'button',
        class: 'edu-map-crumb__link',
        'data-action': 'back-overview',
        onclick: () => actions.backToOverview(),
      },
      '知识地图',
    ),
    h('span', { class: 'edu-map-crumb__sep', 'aria-hidden': 'true' }, '/'),
  );
  if (chapter.unit !== null) {
    crumb.append(
      h('span', { class: 'edu-map-crumb__muted' }, chapter.unit.title),
      h('span', { class: 'edu-map-crumb__sep', 'aria-hidden': 'true' }, '/'),
    );
  }
  crumb.append(
    h(
      'b',
      {
        class: 'edu-map-crumb__current',
        tabindex: -1,
        'data-testid': 'map-chapter-title',
      },
      chapter.chapter.title,
    ),
  );

  const toggle = h('div', {
    class: 'edu-map-toggle',
    role: 'group',
    'aria-label': '视图切换',
    'data-testid': 'map-view-toggle',
  });
  for (const mode of ['graph', 'list'] as const) {
    toggle.append(
      h(
        'button',
        {
          type: 'button',
          class: 'edu-map-toggle__button',
          'aria-pressed': viewMode === mode ? 'true' : 'false',
          'data-view-mode': mode,
          onclick: () => actions.setViewMode(mode),
        },
        VIEW_MODE_LABELS[mode],
      ),
    );
  }
  crumb.append(toggle);
  holder.append(crumb);

  const meta = h('div', { class: 'edu-map-chapter-top__meta' });
  meta.append(
    h(
      'p',
      { class: 'edu-map-chapter-top__stat' },
      `${chapter.sections.length} 节 · ${chapter.concepts.length} 个概念`,
    ),
  );
  const nav = h('div', { class: 'edu-map-chapter-top__nav' });
  nav.append(
    button('上一章', () => chapter.previousChapterId !== null && actions.openChapter(chapter.previousChapterId), {
      small: true,
      disabled: chapter.previousChapterId === null,
      dataAction: 'previous-chapter',
    }),
    button('下一章', () => chapter.nextChapterId !== null && actions.openChapter(chapter.nextChapterId), {
      small: true,
      disabled: chapter.nextChapterId === null,
      dataAction: 'next-chapter',
    }),
  );
  meta.append(nav);
  holder.append(meta);
  if (chapter.layout.degraded) {
    holder.append(
      h(
        'p',
        { class: 'edu-map-notice', role: 'note', 'data-testid': 'map-degraded-note' },
        '这一章的先修关系有互相指向，图里按课本目录顺序排列。',
      ),
    );
  }
  holder.append(renderStateLegend());
  return holder;
}

/* ----------------------------------------------------------------- graph */

function edgeMarkerId(active: boolean): string {
  return active ? 'edu-map-arrow-active' : 'edu-map-arrow';
}

function buildEdgeSvg(chapter: MapChapter, selectedConceptId: Id | null): SVGSVGElement {
  const layout = chapter.layout;
  const svg = svgElement('svg', {
    class: 'edu-map-graph__edges',
    viewBox: `0 0 ${layout.width} ${layout.height}`,
    'aria-hidden': 'true',
    focusable: 'false',
    'data-testid': 'map-graph-edges',
  });
  const defs = svgElement('defs');
  for (const [id, active] of [
    ['edu-map-arrow', false],
    ['edu-map-arrow-active', true],
  ] as const) {
    const marker = svgElement('marker', {
      id,
      viewBox: '0 0 10 10',
      refX: '8',
      refY: '5',
      markerWidth: '7',
      markerHeight: '7',
      orient: 'auto-start-reverse',
    });
    marker.append(svgElement('path', { d: 'M0 0 L10 5 L0 10 z', class: active ? 'edu-map-arrow is-active' : 'edu-map-arrow' }));
    defs.append(marker);
  }
  svg.append(defs);
  for (const relation of chapter.relations) {
    const from = layout.byId.get(relation.fromConceptId);
    const to = layout.byId.get(relation.toConceptId);
    if (from === undefined || to === undefined) continue;
    // 同层的“相关”关系在图上会横穿整列；文字视图仍保留，图上不画，避免视觉噪音。
    if (from.stage === to.stage && relation.type === 'related') continue;
    const path = relationPath(from, to);
    if (path.length === 0) continue;
    const active =
      selectedConceptId !== null &&
      (relation.fromConceptId === selectedConceptId || relation.toConceptId === selectedConceptId);
    const pathElement = svgElement('path', {
      d: path,
      class: [
        'edu-map-edge',
        `edu-map-edge--${relation.type}`,
        selectedConceptId === null ? '' : active ? 'is-active' : 'is-dimmed',
      ]
        .filter((value) => value.length > 0)
        .join(' '),
      'data-relation-id': relation.id,
      'data-edge-type': relation.type,
    });
    if (relation.type === 'prerequisite') {
      pathElement.setAttribute('marker-end', `url(#${edgeMarkerId(active)})`);
    }
    svg.append(pathElement);
  }
  return svg;
}

interface NodePaint {
  readonly summary: ConceptStateSummary;
  readonly peers: { readonly prerequisites: readonly RelationPeer[]; readonly successors: readonly RelationPeer[] };
  readonly relation: 'selected' | 'prerequisite' | 'next' | null;
}

function renderGraphNode(
  layoutNode: ChapterLayoutNode,
  paint: NodePaint,
  actions: MapActions,
): HTMLElement {
  const { summary } = paint;
  const classes = ['edu-map-node'];
  if (paint.relation === 'selected') classes.push('is-selected');
  if (paint.relation === 'prerequisite') classes.push('is-prerequisite');
  if (paint.relation === 'next') classes.push('is-next');
  const ariaLabel = `${summary.title}。${summary.stateLabel}。先修 ${paint.peers.prerequisites.length} 个，后继 ${paint.peers.successors.length} 个。`;
  return h(
    'button',
    {
      type: 'button',
      class: classes.join(' '),
      'data-concept-id': summary.conceptId,
      'data-state': summary.state,
      'data-layer': String(layoutNode.layer),
      'data-stage': String(layoutNode.stage),
      'data-row': String(layoutNode.row),
      'data-x': String(layoutNode.x),
      'data-y': String(layoutNode.y),
      'aria-pressed': paint.relation === 'selected' ? 'true' : 'false',
      'aria-label': ariaLabel,
      style: `left:${pxToRem(layoutNode.x)};top:${pxToRem(layoutNode.y)}`,
      onclick: () => actions.selectConcept(summary.conceptId),
    },
    h('span', { class: 'edu-map-node__title' }, summary.title),
    h(
      'span',
      { class: 'edu-map-node__meta' },
      renderStateGlyph(summary.state),
      h('span', { class: 'edu-map-node__state' }, summary.stateLabel),
    ),
  );
}

function renderWideGraph(
  chapter: MapChapter,
  selectedConceptId: Id | null,
  model: MapModel,
  actions: MapActions,
): HTMLElement {
  const layout = chapter.layout;
  const peers = chapterPeers(model.payload, chapter);
  const selectedPeers =
    selectedConceptId === null
      ? null
      : relationPeers(
          model.payload,
          selectedConceptId,
          new Set(chapter.concepts.map((concept) => concept.id)),
        );
  const prerequisiteIds = new Set((selectedPeers?.prerequisites ?? []).map((peer) => peer.conceptId));
  const nextIds = new Set((selectedPeers?.successors ?? []).map((peer) => peer.conceptId));

  const canvas = h('div', {
    class: 'edu-map-graph__canvas',
    'data-testid': 'map-graph-canvas',
    'data-node-count': String(chapter.concepts.length),
    'data-edge-count': String(chapter.relations.length),
    style: `width:${pxToRem(layout.width)};height:${pxToRem(layout.height)}`,
  });
  layout.stageLabels.forEach((label, stage) => {
    canvas.append(
      h(
        'span',
        {
          class: 'edu-map-graph__level',
          'data-stage': String(stage),
          style: `left:${pxToRem(CHAPTER_GRAPH_METRICS.padding + stage * (CHAPTER_GRAPH_METRICS.nodeWidth + CHAPTER_GRAPH_METRICS.gapX))}`,
        },
        label,
      ),
    );
  });
  canvas.append(buildEdgeSvg(chapter, selectedConceptId));
  for (const layoutNode of layout.nodes) {
    const summary = model.summary(layoutNode.conceptId);
    const relation =
      layoutNode.conceptId === selectedConceptId
        ? 'selected'
        : prerequisiteIds.has(layoutNode.conceptId)
          ? 'prerequisite'
          : nextIds.has(layoutNode.conceptId)
            ? 'next'
            : null;
    canvas.append(
      renderGraphNode(
        layoutNode,
        {
          summary,
          peers: peers.get(layoutNode.conceptId) ?? { prerequisites: [], successors: [] },
          relation,
        },
        actions,
      ),
    );
  }
  return h(
    'div',
    {
      class: 'edu-map-graph',
      'data-testid': 'map-graph',
      'data-orientation': 'horizontal',
      role: 'group',
      'aria-label': `${chapter.chapter.title}的概念关系`,
    },
    h('div', { class: 'edu-map-graph__scroll' }, canvas),
    h(
      'p',
      { class: 'edu-map-graph__legend' },
      '实线＝先学，虚线＝相关',
    ),
  );
}

function renderCompactGraph(
  chapter: MapChapter,
  selectedConceptId: Id | null,
  model: MapModel,
  actions: MapActions,
): HTMLElement {
  const layout = chapter.layout;
  const peers = chapterPeers(model.payload, chapter);
  const list = h('ol', { class: 'edu-map-stages' });
  layout.stages.forEach((ids, stage) => {
    const stageItem = h('li', { class: 'edu-map-stages__item', 'data-stage': String(stage) });
    stageItem.append(
      h('h3', { class: 'edu-map-stages__label' }, layout.stageLabels[stage] ?? ''),
    );
    const nodes = h('ul', { class: 'edu-map-stages__nodes' });
    for (const conceptId of ids) {
      const layoutNode = layout.byId.get(conceptId);
      if (layoutNode === undefined) continue;
      const summary = model.summary(conceptId);
      const nodePeers = peers.get(conceptId) ?? { prerequisites: [], successors: [] };
      const classes = ['edu-map-node', 'edu-map-node--flow'];
      if (conceptId === selectedConceptId) classes.push('is-selected');
      nodes.append(
        h(
          'li',
          { class: 'edu-map-stages__node' },
          h(
            'button',
            {
              type: 'button',
              class: classes.join(' '),
              'data-concept-id': conceptId,
              'data-state': summary.state,
              'data-layer': String(layoutNode.layer),
              'data-stage': String(layoutNode.stage),
              'aria-pressed': conceptId === selectedConceptId ? 'true' : 'false',
              'aria-label': `${summary.title}。${summary.stateLabel}。先修 ${nodePeers.prerequisites.length} 个，后继 ${nodePeers.successors.length} 个。`,
              onclick: () => actions.selectConcept(conceptId),
            },
            h('span', { class: 'edu-map-node__title' }, summary.title),
            h(
              'span',
              { class: 'edu-map-node__meta' },
              renderStateGlyph(summary.state),
              h('span', { class: 'edu-map-node__state' }, summary.stateLabel),
              h(
                'span',
                { class: 'edu-map-node__links' },
                `先修 ${nodePeers.prerequisites.length} · 后继 ${nodePeers.successors.length}`,
              ),
            ),
          ),
        ),
      );
    }
    stageItem.append(nodes);
    list.append(stageItem);
  });
  return h(
    'div',
    {
      class: 'edu-map-graph edu-map-graph--compact',
      'data-testid': 'map-graph',
      'data-orientation': 'vertical',
      role: 'group',
      'aria-label': `${chapter.chapter.title}的概念关系`,
    },
    h('p', { class: 'edu-map-help' }, '窄屏下按层级从上往下排，点概念看详情。'),
    list,
  );
}

export function renderChapterGraph(
  chapter: MapChapter,
  selectedConceptId: Id | null,
  narrow: boolean,
  model: MapModel,
  actions: MapActions,
): HTMLElement {
  if (chapter.concepts.length === 0) {
    return h(
      'div',
      { class: 'edu-map-empty', 'data-testid': 'map-graph-empty' },
      h('h2', {}, '这一章还没有可显示的概念'),
      h('p', {}, '先按目录浏览其他章，或者回到全册看看。'),
      button('回到全册', () => actions.backToOverview(), { dataAction: 'back-overview' }),
    );
  }
  return narrow
    ? renderCompactGraph(chapter, selectedConceptId, model, actions)
    : renderWideGraph(chapter, selectedConceptId, model, actions);
}

/* ------------------------------------------------------------------ list */

function peerButtons(
  peers: readonly RelationPeer[],
  emptyText: string,
  actions: MapActions,
): HTMLElement {
  if (peers.length === 0) {
    return h('p', { class: 'edu-map-list__empty' }, emptyText);
  }
  const list = h('ul', { class: 'edu-map-list__relations' });
  for (const peer of peers) {
    list.append(
      h(
        'li',
        {},
        h(
          'button',
          {
            type: 'button',
            class: 'edu-map-link',
            'data-peer-id': peer.conceptId,
            'data-in-chapter': peer.inChapter ? 'true' : 'false',
            onclick: () => actions.selectConcept(peer.conceptId),
          },
          peer.title,
        ),
        peer.inChapter ? null : h('span', { class: 'edu-map-list__cross' }, '（另一章）'),
        peer.learned ? null : h('span', { class: 'edu-map-list__hint' }, ' · 还没学过'),
      ),
    );
  }
  return list;
}

export function renderChapterList(
  chapter: MapChapter,
  selectedConceptId: Id | null,
  model: MapModel,
  actions: MapActions,
): HTMLElement {
  const holder = h('div', {
    class: 'edu-map-nested-wrap',
    'data-testid': 'map-graph-list',
    role: 'group',
    'aria-label': `${chapter.chapter.title}的概念列表`,
  });
  holder.append(
    h(
      'p',
      { class: 'edu-map-help' },
      '列表和关系图是同一份数据；每个概念下面写着它先学什么、接着学什么。用 Tab 可以走完。',
    ),
  );
  if (chapter.concepts.length === 0) {
    holder.append(
      h(
        'div',
        { class: 'edu-map-empty', 'data-testid': 'map-graph-list-empty' },
        h('p', {}, '这一章还没有可显示的概念。'),
        button('回到全册', () => actions.backToOverview(), { dataAction: 'back-overview' }),
      ),
    );
    return holder;
  }
  const layout = chapter.layout;
  const peers = chapterPeers(model.payload, chapter);
  const conceptIds = new Set(chapter.concepts.map((concept) => concept.id));
  const root = h('ol', { class: 'edu-map-nested' });
  layout.stages.forEach((ids, stage) => {
    const stageItem = h('li', {
      class: 'edu-map-nested__stage',
      'data-stage': String(stage),
      'data-testid': 'map-list-stage',
    });
    stageItem.append(h('h3', { class: 'edu-map-nested__stage-title' }, layout.stageLabels[stage] ?? ''));
    const concepts = h('ul', { class: 'edu-map-nested__concepts' });
    for (const conceptId of ids) {
      const summary = model.summary(conceptId);
      const nodePeers = peers.get(conceptId) ?? { prerequisites: [], successors: [] };
      const peersAll = relationPeers(model.payload, conceptId, conceptIds);
      const classes = ['edu-map-nested__button'];
      if (conceptId === selectedConceptId) classes.push('is-selected');
      const item = h(
        'li',
        { class: 'edu-map-nested__concept', 'data-concept-id': conceptId },
        h(
          'button',
          {
            type: 'button',
            class: classes.join(' '),
            'data-concept-id': conceptId,
            'data-state': summary.state,
            'aria-pressed': conceptId === selectedConceptId ? 'true' : 'false',
            onclick: () => actions.selectConcept(conceptId),
          },
          h('span', { class: 'edu-map-nested__title' }, summary.title),
          h(
            'span',
            { class: 'edu-map-nested__meta' },
            renderStateBadge(summary.state),
            h(
              'span',
              { class: 'edu-map-nested__counts' },
              `先修 ${nodePeers.prerequisites.length} · 后继 ${nodePeers.successors.length}`,
            ),
          ),
          summary.selfReportLabel !== null ? h('span', { class: 'edu-map-nested__self' }, summary.selfReportLabel) : null,
        ),
        h(
          'div',
          { class: 'edu-map-nested__peers' },
          h('p', { class: 'edu-map-nested__peer-label' }, '先修'),
          peerButtons(peersAll.prerequisites, '没有登记先修概念', actions),
          h('p', { class: 'edu-map-nested__peer-label' }, '后继'),
          peerButtons(peersAll.successors, '没有登记后继概念', actions),
        ),
      );
      concepts.append(item);
    }
    stageItem.append(concepts);
    root.append(stageItem);
  });
  holder.append(root);
  return holder;
}

/* ---------------------------------------------------------------- detail */

function detailChip(label: string, extraClass = ''): HTMLElement {
  return h('span', { class: `edu-map-detail__chip${extraClass.length > 0 ? ` ${extraClass}` : ''}` }, label);
}

function relationRow(
  label: string,
  peers: readonly RelationPeer[],
  emptyText: string,
  actions: MapActions,
): HTMLElement {
  const row = h('div', { class: 'edu-map-detail__relations-row' });
  row.append(h('p', { class: 'edu-map-detail__relations-label' }, label));
  if (peers.length === 0) {
    row.append(h('p', { class: 'edu-map-detail__meta' }, emptyText));
    return row;
  }
  const list = h('ul', { class: 'edu-map-detail__peers' });
  for (const peer of peers) {
    const learned = peer.learned ? '已学' : '还没学';
    const peerButton = button(`${peer.title}`, () => actions.selectConcept(peer.conceptId), {
      small: true,
      dataAction: 'open-peer',
    });
    peerButton.setAttribute('data-peer-id', peer.conceptId);
    list.append(
      h(
        'li',
        {},
        peerButton,
        h(
          'span',
          { class: 'edu-map-detail__meta' },
          `${learned}${peer.inChapter ? '' : ' · 另一章'}`,
        ),
      ),
    );
  }
  row.append(list);
  return row;
}

export function renderDetail(
  detail: ConceptDetail,
  model: MapModel,
  chapter: MapChapter | null,
  actions: MapActions,
): HTMLElement {
  const summary = model.summary(detail.concept.id);
  const chapterIds = new Set((chapter?.concepts ?? []).map((concept) => concept.id));
  const peers = relationPeers(model.payload, detail.concept.id, chapterIds);
  const pages = sourcePagesFor(model.payload, detail.concept.sourceRefs);
  const root = h('article', {
    class: 'edu-map-detail',
    'aria-label': '概念详情',
    'data-testid': 'map-detail',
    'data-concept-id': detail.concept.id,
    'data-state': summary.state,
  });
  root.append(
    h('h2', { class: 'edu-map-detail__title', tabindex: -1, 'data-testid': 'map-detail-title' }, detail.concept.title),
    h('p', { class: 'edu-map-detail__explanation' }, detail.concept.explanation),
  );
  const meta = h('div', { class: 'edu-map-detail__meta-row', 'data-testid': 'map-detail-meta' });
  meta.append(renderStateBadge(summary.state));
  if (pages.length === 0) {
    meta.append(detailChip('出处还没登记'));
  } else {
    for (const page of pages) meta.append(detailChip(page.label));
    // Say it once for the whole concept instead of once per page.
    if (pages.some((page) => page.unverified)) {
      meta.append(detailChip('未核实', 'edu-map-detail__chip--attention'));
    }
    if (pages.some((page) => !page.available)) meta.append(detailChip('材料不在本机'));
  }
  if (summary.due) meta.append(detailChip('待复习', 'edu-map-detail__chip--info'));
  root.append(meta);
  if (summary.selfReportLabel !== null) {
    root.append(
      h('p', { class: 'edu-map-detail__self', 'data-testid': 'map-detail-self-report' }, summary.selfReportLabel),
    );
  }
  const relations = h('section', {
    class: 'edu-map-detail__relations',
    'data-testid': 'map-detail-relations',
  });
  relations.append(
    h('h3', {}, '关系'),
    relationRow('先修（建议先理解）', peers.prerequisites, '没有登记先修概念。', actions),
    relationRow('后继（学完这里可以接着去）', peers.successors, '没有登记后继概念。', actions),
  );
  if (peers.related.length > 0) {
    relations.append(
      relationRow('相关（没有先后）', peers.related, '', actions),
    );
  }
  root.append(relations);

  const learnRoute = `/workspace?mode=learn&concept=${detail.concept.id}`;
  const reviewRoute = `/workspace?mode=review&concept=${detail.concept.id}`;
  const preferred = summary.state === 'weak' ? 'review' : 'learn';
  const actionsRow = h('div', { class: 'edu-map-detail__actions', 'data-testid': 'map-detail-actions' });
  const learn = button('开始学习', () => actions.navigate(learnRoute), {
    tone: preferred === 'learn' ? 'primary' : 'default',
    dataAction: 'start-learn',
  });
  learn.setAttribute('data-route', learnRoute);
  const review = button('先复习', () => actions.navigate(reviewRoute), {
    tone: preferred === 'review' ? 'primary' : 'default',
    dataAction: 'start-review',
  });
  review.setAttribute('data-route', reviewRoute);
  actionsRow.append(learn, review);
  root.append(actionsRow);
  return root;
}

export function renderDetailPrompt(chapter: MapChapter | null): HTMLElement {
  return h(
    'div',
    {
      class: 'edu-map-detail edu-map-detail--empty',
      'data-testid': 'map-detail-placeholder',
    },
    h('h2', { class: 'edu-map-detail__title' }, '概念详情'),
    h(
      'p',
      {},
      chapter === null
        ? '点一个概念，看它和谁连着。'
        : '点一个概念看详情。',
    ),
    h('p', { class: 'edu-map-help' }, '只看地图不会改变你的学习进度。'),
  );
}

