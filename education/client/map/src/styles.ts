/**
 * Two-level knowledge map styles. Colours, type sizes, spacing and radii come
 * from @edu/client-shell tokens only (`var(--edu-*)`); no literal colours and
 * no px font sizes, so the browser font scale keeps the page usable.
 *
 * The graph node box is a fixed size on purpose: the layout algorithm reserves
 * exactly that size, so nodes can never overlap.
 */

export const MAP_STYLE_ATTRIBUTE = 'data-edu-map-style';

export const mapStyles = `
.edu-map { min-width: 0; }
.edu-map *, .edu-map *::before, .edu-map *::after { box-sizing: border-box; }
.edu-map h2, .edu-map h3 { margin: 0 0 var(--edu-space-xs); font-size: var(--edu-font-lg); overflow-wrap: anywhere; }
.edu-map p { margin: 0 0 var(--edu-space-xs); }
.edu-map-help { color: var(--edu-color-ink-muted); font-size: var(--edu-font-sm); overflow-wrap: anywhere; }
.edu-map-icon { width: 1em; height: 1em; flex: 0 0 auto; color: var(--edu-color-ink-faint); }
.edu-map-link {
  border: 0; background: none; padding: 0; color: var(--edu-color-accent-strong);
  text-decoration: underline; font: inherit; text-align: left; overflow-wrap: anywhere;
}
.edu-map-link:focus-visible { outline: var(--edu-focus-ring); outline-offset: 2px; }

/* ------------------------------------------------------------ notices */
.edu-map-fixture {
  display: flex; flex-wrap: wrap; gap: var(--edu-space-xs); align-items: baseline;
  margin-bottom: var(--edu-space-sm);
  padding: var(--edu-space-xs) var(--edu-space-sm);
  border: 1px dashed var(--edu-color-warning);
  border-radius: var(--edu-radius-md);
  background: var(--edu-color-warning-soft);
  color: var(--edu-color-warning);
  overflow-wrap: anywhere;
}
.edu-map-badges { display: flex; flex-wrap: wrap; gap: var(--edu-space-xs); align-items: center; margin-bottom: var(--edu-space-sm); }
.edu-map-candidate-banner {
  flex-basis: 100%;
  margin: 0;
  padding: var(--edu-space-xs) var(--edu-space-sm);
  border-left: 0.3rem solid var(--edu-color-warning);
  background: var(--edu-color-warning-soft);
  color: var(--edu-color-warning);
  border-radius: 0 var(--edu-radius-sm) var(--edu-radius-sm) 0;
  overflow-wrap: anywhere;
}
.edu-map-notice {
  margin: 0 0 var(--edu-space-sm);
  padding: var(--edu-space-xs) var(--edu-space-sm);
  border: 1px solid var(--edu-color-warning);
  border-radius: var(--edu-radius-md);
  background: var(--edu-color-warning-soft);
  color: var(--edu-color-warning);
  overflow-wrap: anywhere;
}
.edu-map-empty {
  padding: var(--edu-space-lg);
  border: 1px dashed var(--edu-color-line-strong);
  border-radius: var(--edu-radius-lg);
  background: var(--edu-color-surface-muted);
  min-width: 0;
}
.edu-map-empty h2 { font-size: var(--edu-font-lg); }
.edu-map-empty p { color: var(--edu-color-ink-muted); }

/* ------------------------------------------------------------ toolbar */
.edu-map-toolbar {
  display: flex; flex-wrap: wrap; gap: var(--edu-space-sm);
  align-items: center; margin-bottom: var(--edu-space-sm); min-width: 0;
}
.edu-map-summary { margin-right: auto; min-width: 0; }
.edu-map-summary__title { margin: 0; font-size: var(--edu-font-lg); font-weight: 700; overflow-wrap: anywhere; }
.edu-map-summary__line { margin: 0; color: var(--edu-color-ink-muted); font-size: var(--edu-font-sm); }
.edu-map-search {
  display: flex; align-items: center; gap: var(--edu-space-xs);
  flex: 1 1 16rem; min-width: 0; max-width: 100%;
  padding: var(--edu-space-xxs) var(--edu-space-sm);
  border: 1px solid var(--edu-color-line);
  border-radius: var(--edu-radius-pill);
  background: var(--edu-color-surface);
}
.edu-map-search__input {
  flex: 1 1 auto; min-width: 0; max-width: 100%;
  border: 0; background: transparent; color: var(--edu-color-ink);
  font: inherit; font-size: var(--edu-font-sm);
}
.edu-map-search__input:focus-visible { outline: var(--edu-focus-ring); outline-offset: 2px; }
.edu-map-search__status {
  flex-basis: 100%; margin: 0;
  color: var(--edu-color-ink-muted); font-size: var(--edu-font-sm); overflow-wrap: anywhere;
}

/* ------------------------------------------------------------ state keys */
.edu-map-legend {
  display: flex; flex-wrap: wrap; gap: var(--edu-space-sm);
  list-style: none; margin: var(--edu-space-xs) 0 var(--edu-space-md); padding: 0;
  font-size: var(--edu-font-sm); color: var(--edu-color-ink-muted);
}
.edu-map-legend__item { display: inline-flex; align-items: center; gap: var(--edu-space-xxs); }
.edu-map-state-glyph { display: inline-block; width: 0.7rem; height: 0.7rem; flex: 0 0 auto; }
.edu-map-state-glyph[data-state="now"] { color: var(--edu-color-info); border: 0.12rem solid currentColor; border-radius: var(--edu-radius-pill); }
.edu-map-state-glyph[data-state="weak"] {
  color: var(--edu-color-warning); background: currentColor;
  clip-path: polygon(50% 0%, 100% 100%, 0% 100%);
}
.edu-map-state-glyph[data-state="steady"] { color: var(--edu-color-success); background: currentColor; transform: rotate(45deg); }
.edu-map-state-glyph[data-state="todo"] { color: var(--edu-color-ink-faint); border: 0.12rem dashed currentColor; }
.edu-map-state { display: inline-flex; align-items: center; gap: var(--edu-space-xxs); font-size: var(--edu-font-xs); font-weight: 600; }
.edu-map-state[data-state="now"] { color: var(--edu-color-info); }
.edu-map-state[data-state="weak"] { color: var(--edu-color-warning); }
.edu-map-state[data-state="steady"] { color: var(--edu-color-success); }
.edu-map-state[data-state="todo"] { color: var(--edu-color-ink-muted); }

/* ------------------------------------------------------------ overview */
.edu-map-overview { min-width: 0; }
.edu-map-unit { margin-bottom: var(--edu-space-xl); min-width: 0; }
.edu-map-unit__head {
  display: flex; flex-wrap: wrap; align-items: baseline; gap: var(--edu-space-xs) var(--edu-space-sm);
  margin-bottom: var(--edu-space-xs);
}
.edu-map-unit__no { margin: 0; font-size: var(--edu-font-xs); font-weight: 700; letter-spacing: 0.1em; color: var(--edu-color-ink-muted); }
.edu-map-unit__title { margin: 0; font-size: var(--edu-font-xl); overflow-wrap: anywhere; }
.edu-map-unit__stat { margin: 0 0 0 auto; color: var(--edu-color-ink-muted); font-size: var(--edu-font-sm); }
.edu-map-chapters {
  list-style: none; margin: 0; padding: 0;
  border: 1px solid var(--edu-color-line); border-radius: var(--edu-radius-lg);
  overflow: hidden; background: var(--edu-color-surface); min-width: 0;
}
.edu-map-chapter {
  display: grid; grid-template-columns: minmax(0, 1fr);
  gap: var(--edu-space-xs);
  padding: var(--edu-space-sm) var(--edu-space-md);
  border-bottom: 1px dashed var(--edu-color-line);
  min-width: 0;
}
.edu-map-chapter:last-child { border-bottom: 0; }
.edu-map-chapter__head { display: flex; flex-wrap: wrap; align-items: baseline; gap: var(--edu-space-xs) var(--edu-space-sm); min-width: 0; }
.edu-map-chapter__open {
  display: inline-flex; align-items: center; gap: var(--edu-space-xxs);
  border: 0; background: none; padding: var(--edu-space-xxs) 0;
  color: var(--edu-color-ink); font: inherit; font-size: var(--edu-font-md); font-weight: 700;
  text-align: left; cursor: pointer; min-width: 0; overflow-wrap: anywhere;
}
.edu-map-chapter__open:hover { text-decoration: underline; text-underline-offset: 0.2em; }
.edu-map-chapter__meta { color: var(--edu-color-ink-muted); font-size: var(--edu-font-sm); }
.edu-map-chapter__progress { margin-left: auto; color: var(--edu-color-ink-muted); font-size: var(--edu-font-sm); }
.edu-map-chips { display: flex; flex-wrap: wrap; gap: var(--edu-space-xs); list-style: none; margin: 0; padding: 0; min-width: 0; }
.edu-map-chips__item { min-width: 0; max-width: 100%; }
.edu-map-chip {
  display: inline-flex; align-items: center; gap: var(--edu-space-xs);
  max-width: 100%; padding: var(--edu-space-xxs) var(--edu-space-sm);
  border: 1px solid var(--edu-color-line); border-radius: var(--edu-radius-pill);
  background: var(--edu-color-surface); color: var(--edu-color-ink);
  font: inherit; font-size: var(--edu-font-sm); cursor: pointer; min-width: 0;
}
.edu-map-chip:hover { border-color: var(--edu-color-line-strong); }
.edu-map-chip[data-state="now"] { border-color: var(--edu-color-info); background: var(--edu-color-info-soft); }
.edu-map-chip[data-state="weak"] { border-color: var(--edu-color-warning); background: var(--edu-color-warning-soft); }
.edu-map-chip[data-state="steady"] { border-color: var(--edu-color-success); background: var(--edu-color-success-soft); }
.edu-map-chip[data-state="todo"] { border-style: dashed; background: var(--edu-color-surface); }
.edu-map-chip__title {
  color: var(--edu-color-ink); font-weight: 600;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 14rem;
}
.edu-map-chip__state { display: inline-flex; align-items: center; gap: var(--edu-space-xxs); color: var(--edu-color-ink-muted); font-size: var(--edu-font-xs); white-space: nowrap; }
.edu-map-chip--more { color: var(--edu-color-ink-muted); background: var(--edu-color-surface-muted); border-color: transparent; }

/* --------------------------------------------------------- chapter header */
.edu-map-chapter-top { min-width: 0; }
.edu-map-crumb { display: flex; flex-wrap: wrap; align-items: center; gap: var(--edu-space-xs); font-size: var(--edu-font-sm); color: var(--edu-color-ink-muted); min-width: 0; }
.edu-map-crumb__link { border: 0; background: none; padding: 0; color: var(--edu-color-accent-strong); font: inherit; cursor: pointer; text-decoration: underline; }
.edu-map-crumb__sep { color: var(--edu-color-ink-faint); }
.edu-map-crumb__muted { color: var(--edu-color-ink-muted); }
.edu-map-crumb__current { color: var(--edu-color-ink); overflow-wrap: anywhere; }
.edu-map-toggle {
  display: inline-flex; gap: var(--edu-space-xxs); margin-left: auto;
  padding: var(--edu-space-xxs); border-radius: var(--edu-radius-pill);
  background: var(--edu-color-surface-muted);
}
.edu-map-toggle__button {
  border: 0; background: transparent; color: var(--edu-color-ink-muted);
  font: inherit; font-size: var(--edu-font-sm); font-weight: 600;
  padding: var(--edu-space-xxs) var(--edu-space-sm);
  border-radius: var(--edu-radius-pill); cursor: pointer;
}
.edu-map-toggle__button[aria-pressed="true"] { background: var(--edu-color-surface); color: var(--edu-color-ink); }
.edu-map-chapter-top__meta { display: flex; flex-wrap: wrap; align-items: center; gap: var(--edu-space-sm); margin: var(--edu-space-xs) 0; }
.edu-map-chapter-top__stat { margin: 0; color: var(--edu-color-ink-muted); font-size: var(--edu-font-sm); }
.edu-map-chapter-top__nav { margin-left: auto; display: flex; gap: var(--edu-space-xs); }

/* ---------------------------------------------------------------- graph */
.edu-map-graph { min-width: 0; }
.edu-map-graph__scroll {
  overflow-x: auto; overflow-y: hidden;
  max-width: 100%;
  border: 1px solid var(--edu-color-line);
  border-radius: var(--edu-radius-lg);
  background: var(--edu-color-surface);
}
.edu-map-graph__canvas { position: relative; min-width: 0; margin-inline: auto; }
.edu-map-graph__edges { position: absolute; inset: 0; width: 100%; height: 100%; pointer-events: none; }
.edu-map-edge { fill: none; stroke-width: 0.14rem; }
.edu-map-edge--prerequisite { stroke: var(--edu-color-accent); }
.edu-map-edge--related { stroke: var(--edu-color-info); stroke-dasharray: 0.4rem 0.35rem; }
.edu-map-edge.is-active { stroke-width: 0.22rem; opacity: 1; }
.edu-map-edge.is-dimmed { opacity: 0.35; }
.edu-map-arrow { fill: var(--edu-color-line-strong); }
.edu-map-arrow.is-active { fill: var(--edu-color-accent); }
.edu-map-graph__level {
  position: absolute; top: var(--edu-space-xxs);
  font-size: var(--edu-font-xs); font-weight: 700; letter-spacing: 0.12em;
  color: var(--edu-color-ink-faint);
}
.edu-map-node {
  position: absolute;
  display: flex; flex-direction: column; gap: var(--edu-space-xxs);
  width: 12.5rem; height: 5.5rem;
  padding: var(--edu-space-xs) var(--edu-space-sm);
  text-align: left;
  border: 1px solid var(--edu-color-line-strong);
  border-radius: var(--edu-radius-md);
  background: var(--edu-color-surface);
  color: var(--edu-color-ink); font: inherit;
  overflow: hidden; cursor: pointer; min-width: 0;
}
.edu-map-node[data-state="now"] { border-color: var(--edu-color-info); background: var(--edu-color-info-soft); }
.edu-map-node[data-state="weak"] { border-color: var(--edu-color-warning); background: var(--edu-color-warning-soft); }
.edu-map-node[data-state="steady"] { border-color: var(--edu-color-success); background: var(--edu-color-success-soft); }
.edu-map-node[data-state="todo"] { border-style: dashed; }
.edu-map-node.is-selected { border-color: var(--edu-color-accent); box-shadow: 0 0 0 0.2rem var(--edu-color-accent-soft); }
.edu-map-node.is-prerequisite { border-left-width: 0.35rem; border-left-color: var(--edu-color-accent); }
.edu-map-node.is-next { border-right-width: 0.35rem; border-right-color: var(--edu-color-accent); }
.edu-map-node__title {
  font-weight: 700; font-size: var(--edu-font-sm); overflow-wrap: anywhere;
  display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
}
.edu-map-node__meta {
  display: flex; align-items: center; gap: var(--edu-space-xxs);
  margin-top: auto; font-size: var(--edu-font-xs); color: var(--edu-color-ink-muted);
  min-width: 0; flex-wrap: wrap;
}
.edu-map-node__links { color: var(--edu-color-ink-faint); }
.edu-map-node--flow { position: static; width: 100%; height: auto; min-height: 3.75rem; }
.edu-map-node:focus-visible, .edu-map-chip:focus-visible, .edu-map-chapter__open:focus-visible,
.edu-map-toggle__button:focus-visible, .edu-map-nested__button:focus-visible, .edu-map-crumb__link:focus-visible {
  outline: var(--edu-focus-ring); outline-offset: 2px;
}
.edu-map-graph__legend { margin: var(--edu-space-xs) 0; color: var(--edu-color-ink-muted); font-size: var(--edu-font-sm); }

/* ---------------------------------------------------------- compact graph */
.edu-map-graph--compact .edu-map-stages { list-style: none; margin: var(--edu-space-xs) 0 0; padding: 0; display: flex; flex-direction: column; gap: var(--edu-space-md); }
.edu-map-stages__item { padding-left: var(--edu-space-sm); border-left: 0.25rem solid var(--edu-color-line); min-width: 0; }
.edu-map-stages__label { margin: 0 0 var(--edu-space-xs); font-size: var(--edu-font-sm); letter-spacing: 0.1em; color: var(--edu-color-ink-muted); }
.edu-map-stages__nodes { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: var(--edu-space-xs); min-width: 0; }

/* ------------------------------------------------------------- list view */
.edu-map-nested-wrap {
  border: 1px solid var(--edu-color-line); border-radius: var(--edu-radius-lg);
  background: var(--edu-color-surface); padding: var(--edu-space-md); min-width: 0;
}
.edu-map-nested { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: var(--edu-space-md); min-width: 0; }
.edu-map-nested__stage { min-width: 0; }
.edu-map-nested__stage-title { margin: 0 0 var(--edu-space-xs); font-size: var(--edu-font-md); letter-spacing: 0.1em; color: var(--edu-color-ink-muted); }
.edu-map-nested__concepts { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: var(--edu-space-xs); min-width: 0; }
.edu-map-nested__concept { border: 1px solid var(--edu-color-line); border-radius: var(--edu-radius-md); padding: var(--edu-space-xs); min-width: 0; }
.edu-map-nested__button {
  display: flex; flex-wrap: wrap; align-items: center; gap: var(--edu-space-xs);
  width: 100%; border: 0; background: none; color: var(--edu-color-ink);
  font: inherit; text-align: left; cursor: pointer; padding: var(--edu-space-xxs); min-width: 0;
}
.edu-map-nested__button.is-selected { outline: 0.125rem solid var(--edu-color-accent); outline-offset: 2px; }
.edu-map-nested__title { font-weight: 700; overflow-wrap: anywhere; }
.edu-map-nested__meta { display: flex; flex-wrap: wrap; align-items: center; gap: var(--edu-space-xs); margin-left: auto; color: var(--edu-color-ink-muted); font-size: var(--edu-font-sm); }
.edu-map-nested__counts { color: var(--edu-color-ink-faint); font-size: var(--edu-font-xs); }
.edu-map-nested__self { flex-basis: 100%; font-size: var(--edu-font-xs); color: var(--edu-color-ink-muted); }
.edu-map-nested__peers {
  margin-top: var(--edu-space-xxs); padding-top: var(--edu-space-xxs);
  border-top: 1px dashed var(--edu-color-line);
  display: flex; flex-wrap: wrap; align-items: baseline; gap: var(--edu-space-xs); min-width: 0;
}
.edu-map-nested__peer-label { margin: 0; font-size: var(--edu-font-xs); color: var(--edu-color-ink-faint); }
.edu-map-list__relations { list-style: none; margin: 0; padding: 0; display: flex; flex-wrap: wrap; gap: var(--edu-space-xs); font-size: var(--edu-font-sm); min-width: 0; }
.edu-map-list__relations li { display: inline-flex; flex-wrap: wrap; gap: var(--edu-space-xxs); align-items: baseline; }
.edu-map-list__cross, .edu-map-list__hint { color: var(--edu-color-ink-muted); font-size: var(--edu-font-xs); }
.edu-map-list__empty { margin: 0; color: var(--edu-color-ink-faint); font-size: var(--edu-font-xs); }

/* ---------------------------------------------------------------- detail */
.edu-map-detail {
  margin-top: var(--edu-space-md);
  padding: var(--edu-space-lg);
  background: var(--edu-color-surface);
  border: 1px solid var(--edu-color-line);
  border-radius: var(--edu-radius-lg);
  min-width: 0;
}
.edu-map-detail__title { margin: 0 0 var(--edu-space-xxs); font-size: var(--edu-font-xl); overflow-wrap: anywhere; }
.edu-map-detail__explanation { margin: 0 0 var(--edu-space-sm); color: var(--edu-color-ink-muted); font-size: var(--edu-font-md); line-height: 1.7; overflow-wrap: anywhere; }
.edu-map-detail__meta-row { display: flex; flex-wrap: wrap; align-items: center; gap: var(--edu-space-xs); margin-bottom: var(--edu-space-sm); }
.edu-map-detail__chip {
  display: inline-flex; align-items: center; padding: var(--edu-space-xxs) var(--edu-space-xs);
  border: 1px solid var(--edu-color-line); border-radius: var(--edu-radius-pill);
  background: var(--edu-color-surface-muted); color: var(--edu-color-ink-muted);
  font-size: var(--edu-font-xs);
}
.edu-map-detail__chip--attention { color: var(--edu-color-warning); background: var(--edu-color-warning-soft); border-color: var(--edu-color-warning); }
.edu-map-detail__chip--info { color: var(--edu-color-info); background: var(--edu-color-info-soft); border-color: var(--edu-color-info); }
.edu-map-detail__self { margin: 0 0 var(--edu-space-sm); font-size: var(--edu-font-sm); color: var(--edu-color-ink-muted); overflow-wrap: anywhere; }
.edu-map-detail__relations { margin-top: var(--edu-space-sm); border-top: 1px solid var(--edu-color-line); padding-top: var(--edu-space-sm); }
.edu-map-detail__relations h3 { margin: 0 0 var(--edu-space-xs); font-size: var(--edu-font-md); }
.edu-map-detail__relations-row { margin-bottom: var(--edu-space-xs); }
.edu-map-detail__relations-label { margin: 0; font-size: var(--edu-font-xs); color: var(--edu-color-ink-faint); }
.edu-map-detail__peers { list-style: none; margin: 0; padding: 0; display: flex; flex-wrap: wrap; gap: var(--edu-space-xs); min-width: 0; }
.edu-map-detail__peers li { display: inline-flex; flex-wrap: wrap; align-items: baseline; gap: var(--edu-space-xxs); min-width: 0; }
.edu-map-detail__meta { color: var(--edu-color-ink-muted); font-size: var(--edu-font-xs); overflow-wrap: anywhere; }
.edu-map-detail__actions { display: flex; flex-wrap: wrap; gap: var(--edu-space-xs); margin-top: var(--edu-space-md); }

/* -------------------------------------------------------------- compact */
@media (max-width: 1099px) {
  .edu-map-toolbar { align-items: stretch; }
  .edu-map-search { flex-basis: 100%; }
  .edu-map-unit__stat { margin-left: 0; }
  .edu-map-chapter__progress { margin-left: 0; }
  .edu-map-chip__title { max-width: 10rem; }
  .edu-map-crumb__current { flex-basis: 100%; }
  .edu-map-toggle { margin-left: 0; }
  .edu-map-chapter-top__nav { margin-left: 0; }
  .edu-map-detail { padding: var(--edu-space-md); }
  .edu-map-nested__meta { margin-left: 0; }
}

/* --------------------------------------------------- reduced motion/print */
@media (prefers-reduced-motion: reduce) {
  .edu-map * { transition: none; animation: none; }
}
`;

export function ensureMapStyles(doc: Document): void {
  if (doc.querySelector(`style[${MAP_STYLE_ATTRIBUTE}="true"]`) !== null) return;
  const style = doc.createElement('style');
  style.setAttribute(MAP_STYLE_ATTRIBUTE, 'true');
  style.textContent = mapStyles;
  doc.head.append(style);
}
