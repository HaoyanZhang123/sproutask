/** Map-specific styles; design tokens come from @edu/client-shell. */

import { DESIGN_TOKENS as T } from '../../shell/src/index.js';

export const MAP_STYLE_ATTRIBUTE = 'data-edu-map-style';

export const mapStyles = `
.edu-map { min-width: 0; }
.edu-map *, .edu-map *::before, .edu-map *::after { box-sizing: border-box; }
.edu-map h2, .edu-map h3 { margin: 0 0 ${T.spacing.xs}; font-size: var(--edu-font-lg); overflow-wrap: anywhere; }
.edu-map p { margin: 0 0 ${T.spacing.xs}; }
.edu-map-main {
  display: grid;
  grid-template-columns: minmax(0, 17rem) minmax(0, 1fr);
  gap: ${T.spacing.md};
  align-items: start;
  min-width: 0;
}
@media (max-width: 1180px) {
  .edu-map-main { grid-template-columns: minmax(0, 1fr); }
}
.edu-map-navpane, .edu-map-workpane, .edu-map-detail { min-width: 0; }
.edu-map-navpane {
  background: var(--edu-color-surface);
  border: 1px solid var(--edu-color-line);
  border-radius: var(--edu-radius-lg);
  padding: ${T.spacing.sm};
}
.edu-map-pane-title { font-size: var(--edu-font-md); color: var(--edu-color-ink-muted); }
.edu-map-tree { list-style: none; margin: 0; padding: 0; }
.edu-map-tree__item {
  display: block;
  min-width: 0;
  border-radius: var(--edu-radius-sm);
  border-left: 0.2rem solid transparent;
}
.edu-map-tree__item.is-selected { border-left-color: var(--edu-color-accent); background: var(--edu-color-accent-soft); }
.edu-map-tree__item:focus-visible { outline: ${T.focusRing}; outline-offset: 2px; }
.edu-map-tree__row { display: flex; flex-wrap: wrap; align-items: center; gap: ${T.spacing.xxs}; min-width: 0; padding: ${T.spacing.xxs} ${T.spacing.xs}; }
.edu-map-tree__toggle {
  border: 1px solid var(--edu-color-line);
  background: var(--edu-color-surface);
  color: var(--edu-color-ink);
  border-radius: var(--edu-radius-sm);
  width: 1.6rem;
  height: 1.6rem;
  line-height: 1;
  padding: 0;
  font-size: var(--edu-font-sm);
  flex: 0 0 auto;
}
.edu-map-tree__toggle[aria-hidden="true"] { opacity: 0.6; }
.edu-map-tree__title { font-weight: 600; overflow-wrap: anywhere; min-width: 0; }
.edu-map-tree__counts { color: var(--edu-color-ink-muted); font-size: var(--edu-font-xs); overflow-wrap: anywhere; }
.edu-map-help { color: var(--edu-color-ink-muted); font-size: var(--edu-font-xs); overflow-wrap: anywhere; }
.edu-map-fixture {
  display: flex; flex-wrap: wrap; gap: ${T.spacing.xs}; align-items: baseline;
  margin-bottom: ${T.spacing.sm};
  padding: ${T.spacing.xs} ${T.spacing.sm};
  border: 1px dashed ${T.colors.warning};
  border-radius: var(--edu-radius-md);
  background: ${T.colors.warningSoft};
  color: ${T.colors.warning};
  overflow-wrap: anywhere;
}
.edu-map-badges { display: flex; flex-wrap: wrap; gap: ${T.spacing.xs}; align-items: center; margin-bottom: ${T.spacing.xs}; }
.edu-map-candidate-banner {
  flex-basis: 100%;
  padding: ${T.spacing.xs} ${T.spacing.sm};
  border-left: 0.3rem solid ${T.colors.warning};
  background: ${T.colors.warningSoft};
  color: ${T.colors.warning};
  border-radius: 0 var(--edu-radius-sm) var(--edu-radius-sm) 0;
}
.edu-map-summary {
  display: grid;
  gap: ${T.spacing.xxs};
  margin-bottom: ${T.spacing.sm};
  padding: ${T.spacing.xs} ${T.spacing.sm};
  border: 1px solid var(--edu-color-line);
  border-radius: var(--edu-radius-md);
  background: var(--edu-color-surface-muted);
  min-width: 0;
}
.edu-map-summary__line { color: var(--edu-color-ink-muted); font-size: var(--edu-font-sm); overflow-wrap: anywhere; }
.edu-map-search { display: flex; flex-wrap: wrap; gap: ${T.spacing.xs}; align-items: center; min-width: 0; }
.edu-map-search__label { font-size: var(--edu-font-sm); color: var(--edu-color-ink-muted); }
.edu-map-search__input { min-width: 0; max-width: 100%; flex: 1 1 12rem; font-size: var(--edu-font-md); padding: ${T.spacing.xxs} ${T.spacing.xs}; }
.edu-map-search__results { list-style: none; margin: ${T.spacing.xs} 0; padding: 0; display: grid; gap: ${T.spacing.xxs}; }
.edu-map-search__results li { overflow-wrap: anywhere; min-width: 0; }
.edu-map-search__meta { color: var(--edu-color-ink-muted); font-size: var(--edu-font-xs); }
.edu-map-filters { display: flex; flex-wrap: wrap; gap: ${T.spacing.xxs}; align-items: center; margin: ${T.spacing.xs} 0; }
.edu-map-filters__label { font-size: var(--edu-font-sm); color: var(--edu-color-ink-muted); }
.edu-map-filter, .edu-map-tab {
  border: 1px solid var(--edu-color-line);
  background: var(--edu-color-surface);
  color: var(--edu-color-ink);
  border-radius: ${T.radii.pill};
  padding: ${T.spacing.xxs} ${T.spacing.sm};
  font-size: var(--edu-font-sm);
  min-width: 0;
}
.edu-map-filter[aria-pressed="true"], .edu-map-tab[aria-pressed="true"] {
  border-color: var(--edu-color-accent);
  background: var(--edu-color-accent-soft);
  font-weight: 700;
}
.edu-map-tabs { display: flex; flex-wrap: wrap; gap: ${T.spacing.xs}; margin-bottom: ${T.spacing.xs}; }
.edu-map-range {
  margin-bottom: ${T.spacing.xs};
  padding: ${T.spacing.xs} ${T.spacing.sm};
  border: 1px solid var(--edu-color-line);
  border-radius: var(--edu-radius-md);
  background: var(--edu-color-surface-muted);
  min-width: 0;
}
.edu-map-range__title { font-weight: 700; overflow-wrap: anywhere; }
.edu-map-range__meta { color: var(--edu-color-ink-muted); font-size: var(--edu-font-sm); overflow-wrap: anywhere; }
.edu-map-external { margin-top: ${T.spacing.xs}; display: grid; gap: ${T.spacing.xxs}; }
.edu-map-external__title { font-size: var(--edu-font-sm); color: var(--edu-color-ink-muted); }
.edu-map-external__item { display: flex; flex-wrap: wrap; gap: ${T.spacing.xs}; align-items: center; min-width: 0; }
.edu-map-legend { list-style: none; margin: 0 0 ${T.spacing.xs}; padding: 0; display: grid; gap: ${T.spacing.xxs}; }
.edu-map-legend__item { display: flex; flex-wrap: wrap; gap: ${T.spacing.xs}; align-items: center; font-size: var(--edu-font-sm); overflow-wrap: anywhere; }
.edu-map-legend__line { display: inline-block; width: 2.5rem; height: 0; border-top-width: 0.18rem; border-top-style: solid; position: relative; }
.edu-map-legend__line--prerequisite { border-top-color: ${T.colors.accent}; }
.edu-map-legend__line--prerequisite::after {
  content: ''; position: absolute; right: -0.05rem; top: -0.32rem;
  border-left: 0.5rem solid ${T.colors.accent};
  border-top: 0.25rem solid transparent;
  border-bottom: 0.25rem solid transparent;
}
.edu-map-legend__line--related { border-top-color: ${T.colors.info}; border-top-style: dashed; }
.edu-map-canvas__scroll {
  overflow: auto;
  max-width: 100%;
  border: 1px solid var(--edu-color-line);
  border-radius: var(--edu-radius-md);
  background: var(--edu-color-surface);
  padding: ${T.spacing.sm};
}
.edu-map-canvas { position: relative; min-width: 0; }
.edu-map-canvas__edges { position: absolute; inset: 0; pointer-events: none; }
.edu-map-edge { position: absolute; height: 0; transform-origin: 0 0; border-top-width: 0.16rem; border-top-style: solid; }
.edu-map-edge--prerequisite { border-top-color: ${T.colors.accent}; border-top-style: solid; }
.edu-map-edge--related { border-top-color: ${T.colors.info}; border-top-style: dashed; }
.edu-map-edge--prerequisite::after {
  content: ''; position: absolute; right: -0.05rem; top: -0.3rem;
  border-left: 0.5rem solid ${T.colors.accent};
  border-top: 0.24rem solid transparent;
  border-bottom: 0.24rem solid transparent;
}
.edu-map-node {
  position: absolute;
  width: 11rem;
  min-height: 5.5rem;
  display: grid;
  gap: ${T.spacing.xxs};
  align-content: start;
  text-align: left;
  padding: ${T.spacing.xs};
  border: 1px solid var(--edu-color-line-strong);
  border-left-width: 0.3rem;
  border-radius: var(--edu-radius-md);
  background: var(--edu-color-surface);
  color: var(--edu-color-ink);
  font-size: var(--edu-font-sm);
  overflow-wrap: anywhere;
  min-width: 0;
}
.edu-map-node.is-center { border-color: var(--edu-color-accent); box-shadow: 0 0 0 2px var(--edu-color-accent-soft); }
.edu-map-node[data-understanding="needs_support"] { border-left-color: ${T.colors.warning}; }
.edu-map-node[data-understanding="developing"] { border-left-color: ${T.colors.info}; }
.edu-map-node[data-understanding="supported"] { border-left-color: ${T.colors.success}; }
.edu-map-node:focus-visible { outline: ${T.focusRing}; outline-offset: 2px; }
.edu-map-node__title { font-weight: 700; overflow-wrap: anywhere; }
.edu-map-node__state { color: var(--edu-color-ink-muted); font-size: var(--edu-font-xs); overflow-wrap: anywhere; }
.edu-map-node__due { font-size: var(--edu-font-xs); color: ${T.colors.info}; }
.edu-map-relations-wrap { min-width: 0; overflow-x: auto; }
.edu-map-relations { width: 100%; border-collapse: collapse; table-layout: fixed; font-size: var(--edu-font-sm); }
.edu-map-relations caption { text-align: left; font-weight: 700; padding-bottom: ${T.spacing.xxs}; overflow-wrap: anywhere; }
.edu-map-relations th, .edu-map-relations td { border-bottom: 1px solid var(--edu-color-line); padding: ${T.spacing.xxs}; vertical-align: top; overflow-wrap: anywhere; text-align: left; }
.edu-map-relations th { color: var(--edu-color-ink-muted); font-size: var(--edu-font-xs); }
.edu-map-relations__rationale { max-width: 18rem; }
.edu-map-link {
  border: 0; background: none; padding: 0; color: var(--edu-color-accent-strong);
  text-decoration: underline; font-size: inherit; text-align: left; overflow-wrap: anywhere;
}
.edu-map-link:focus-visible { outline: ${T.focusRing}; outline-offset: 2px; }
.edu-map-concept-list { list-style: none; margin: 0; padding: 0; display: grid; gap: ${T.spacing.xxs}; }
.edu-map-concept-list__item { min-width: 0; }
.edu-map-concept-list__button {
  width: 100%; display: flex; flex-wrap: wrap; gap: ${T.spacing.xxs}; align-items: center;
  text-align: left; padding: ${T.spacing.xs}; min-width: 0;
  border: 1px solid var(--edu-color-line); border-radius: var(--edu-radius-md);
  background: var(--edu-color-surface); color: var(--edu-color-ink); font-size: var(--edu-font-md);
}
.edu-map-concept-list__button:focus-visible { outline: ${T.focusRing}; outline-offset: 2px; }
.edu-map-concept-list__title { font-weight: 600; overflow-wrap: anywhere; }
.edu-map-concept-list__states { display: flex; flex-wrap: wrap; gap: ${T.spacing.xxs}; }
.edu-map-empty {
  padding: ${T.spacing.md}; border: 1px dashed var(--edu-color-line-strong);
  border-radius: var(--edu-radius-md); background: var(--edu-color-surface-muted); min-width: 0;
}
.edu-map-detail {
  background: var(--edu-color-surface);
  border: 1px solid var(--edu-color-line);
  border-radius: var(--edu-radius-lg);
  padding: ${T.spacing.md};
  min-width: 0;
}
.edu-map-detail__title { font-size: var(--edu-font-xl); overflow-wrap: anywhere; }
.edu-map-detail__meta { color: var(--edu-color-ink-muted); font-size: var(--edu-font-sm); overflow-wrap: anywhere; }
.edu-map-detail__states { display: flex; flex-wrap: wrap; gap: ${T.spacing.xxs}; align-items: center; margin: ${T.spacing.xs} 0; }
.edu-map-detail__axis { font-size: var(--edu-font-xs); color: var(--edu-color-ink-muted); }
.edu-map-detail__self { padding: ${T.spacing.xxs} ${T.spacing.xs}; border-left: 0.25rem solid var(--edu-color-line-strong); background: var(--edu-color-surface-muted); overflow-wrap: anywhere; }
.edu-map-detail__section { margin-top: ${T.spacing.sm}; border-top: 1px solid var(--edu-color-line); padding-top: ${T.spacing.xs}; }
.edu-map-detail__relation { font-size: var(--edu-font-sm); overflow-wrap: anywhere; }
.edu-map-detail__source { font-size: var(--edu-font-sm); overflow-wrap: anywhere; }
.edu-map-detail__actions { display: flex; flex-wrap: wrap; gap: ${T.spacing.xs}; margin-top: ${T.spacing.sm}; }
.edu-map-prereq {
  border: 1px solid var(--edu-color-line);
  border-left: 0.3rem solid ${T.colors.warning};
  border-radius: 0 var(--edu-radius-sm) var(--edu-radius-sm) 0;
  padding: ${T.spacing.xs};
  margin-bottom: ${T.spacing.xs};
  background: ${T.colors.warningSoft};
  min-width: 0;
}
.edu-map-prereq.is-learned { border-left-color: ${T.colors.success}; background: ${T.colors.successSoft}; }
.edu-map-prereq__title { font-weight: 700; overflow-wrap: anywhere; }
.edu-map-prereq__meta { font-size: var(--edu-font-xs); color: var(--edu-color-ink-muted); overflow-wrap: anywhere; }
.edu-map-prereq__actions { display: flex; flex-wrap: wrap; gap: ${T.spacing.xs}; margin-top: ${T.spacing.xxs}; }
.edu-map-notice {
  padding: ${T.spacing.xs} ${T.spacing.sm};
  border: 1px solid ${T.colors.warning};
  border-radius: var(--edu-radius-md);
  background: ${T.colors.warningSoft};
  color: ${T.colors.warning};
  overflow-wrap: anywhere;
}
`;

export function ensureMapStyles(doc: Document): void {
  if (doc.querySelector(`style[${MAP_STYLE_ATTRIBUTE}="true"]`) !== null) return;
  const style = doc.createElement('style');
  style.setAttribute(MAP_STYLE_ATTRIBUTE, 'true');
  style.textContent = mapStyles;
  doc.head.append(style);
}
