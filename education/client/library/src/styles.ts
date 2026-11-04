/** Library-specific styles; tokens/layout come from @edu/client-shell. */

import { DESIGN_TOKENS as T } from '../../shell/src/index.js';

export const LIBRARY_STYLE_ATTRIBUTE = 'data-edu-library-style';

const COMPACT_WIDTH = T.breakpoints.compact - 1;

export const libraryStyles = `
.edu-lib { min-width: 0; display: grid; gap: var(--edu-space-lg); }
.edu-lib *,
.edu-lib *::before,
.edu-lib *::after { box-sizing: border-box; }
.edu-lib [data-edu-slot] { min-width: 0; }
.edu-lib__content,
.edu-lib__import { display: grid; gap: var(--edu-space-md); min-width: 0; }

/* ---------- 首屏那一张课本卡 ---------- */
.edu-lib-hero {
  display: grid;
  grid-template-columns: minmax(8rem, 10rem) minmax(0, 1fr);
  gap: var(--edu-space-lg);
  align-items: start;
  padding: var(--edu-space-lg);
  background: var(--edu-color-surface);
  border: 1px solid var(--edu-color-line);
  border-radius: var(--edu-radius-lg);
  box-shadow: ${T.shadows.card};
  min-width: 0;
}
.edu-lib-hero__main { display: grid; gap: var(--edu-space-xxs); min-width: 0; }
.edu-lib-hero__eyebrow {
  margin: 0;
  font-size: var(--edu-font-xs);
  font-weight: 800;
  letter-spacing: 0.14em;
  color: var(--edu-color-ink-faint);
}
.edu-lib-hero__title { margin: 0; font-size: var(--edu-font-xxl); line-height: 1.25; overflow-wrap: anywhere; }
.edu-lib-hero__meta { margin: 0; color: var(--edu-color-ink-muted); font-size: var(--edu-font-sm); overflow-wrap: anywhere; }
.edu-lib-hero__status { display: flex; flex-wrap: wrap; align-items: center; gap: var(--edu-space-xs); margin: var(--edu-space-xs) 0 0; }
.edu-lib-hero__scope { color: var(--edu-color-ink-faint); font-size: var(--edu-font-xs); }
.edu-lib-hero__range { margin: var(--edu-space-xs) 0 0; max-width: 46ch; overflow-wrap: anywhere; }
.edu-lib-hero__actions { display: flex; flex-wrap: wrap; gap: var(--edu-space-xs); margin-top: var(--edu-space-sm); }
.edu-lib-cover {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  gap: var(--edu-space-sm);
  aspect-ratio: 3 / 4.1;
  padding: var(--edu-space-md) var(--edu-space-sm);
  border: 1px solid var(--edu-color-accent-strong);
  border-radius: var(--edu-radius-sm);
  background: linear-gradient(160deg, var(--edu-color-accent-strong), var(--edu-color-accent));
  color: var(--edu-color-on-accent);
  box-shadow: ${T.shadows.card};
  min-width: 0;
  overflow-wrap: anywhere;
}
.edu-lib-cover__brand { font-size: var(--edu-font-xs); letter-spacing: 0.14em; opacity: 0.86; }
.edu-lib-cover__subject { font-size: var(--edu-font-xl); font-weight: 800; letter-spacing: 0.16em; line-height: 1.3; }
.edu-lib-cover__grade { font-size: var(--edu-font-sm); opacity: 0.92; }

/* ---------- 换一本 ---------- */
.edu-lib-chooser { gap: var(--edu-space-xs); min-width: 0; }
.edu-lib-chooser:not([hidden]) { display: grid; }
.edu-lib-chooser__empty { margin: 0; color: var(--edu-color-ink-faint); font-size: var(--edu-font-sm); overflow-wrap: anywhere; }
.edu-lib-choice {
  display: flex;
  align-items: center;
  gap: var(--edu-space-sm);
  width: 100%;
  min-width: 0;
  padding: var(--edu-space-sm) var(--edu-space-md);
  border: 1px solid var(--edu-color-line);
  border-radius: var(--edu-radius-md);
  background: var(--edu-color-surface);
  color: var(--edu-color-ink);
  font: inherit;
  text-align: left;
  cursor: pointer;
}
.edu-lib-choice:hover { background: var(--edu-color-surface-muted); }
.edu-lib-choice[data-state="candidate"] { border-left: 0.3rem solid var(--edu-color-warning); }
.edu-lib-choice[data-state="unavailable"] { border-left: 0.3rem solid var(--edu-color-danger); }
.edu-lib-choice__text { display: flex; flex-direction: column; gap: var(--edu-space-xxs); min-width: 0; }
.edu-lib-choice__title { font-weight: 700; overflow-wrap: anywhere; }
.edu-lib-choice__meta { color: var(--edu-color-ink-muted); font-size: var(--edu-font-sm); overflow-wrap: anywhere; }
.edu-lib-choice__state { margin-left: auto; flex: none; font-size: var(--edu-font-xs); color: var(--edu-color-ink-faint); }

/* ---------- 试看提示 ---------- */
.edu-lib-trial-banner {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--edu-space-xs);
  padding: var(--edu-space-sm) var(--edu-space-md);
  border: 1px solid var(--edu-color-warning);
  border-left-width: 0.3rem;
  border-radius: var(--edu-radius-md);
  background: var(--edu-color-warning-soft);
  color: var(--edu-color-warning);
  font-weight: 600;
  overflow-wrap: anywhere;
}

/* ---------- 课本原文从哪来（折叠） ---------- */
.edu-lib-sources { min-width: 0; border-top: 1px solid var(--edu-color-line); padding-top: var(--edu-space-sm); }
.edu-lib-sources__toggle {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: var(--edu-space-xs);
  width: 100%;
  padding: var(--edu-space-xs) 0;
  border: 0;
  background: none;
  color: var(--edu-color-ink);
  font: inherit;
  text-align: left;
  cursor: pointer;
}
.edu-lib-sources__count { font-weight: 700; }
.edu-lib-sources__hint { color: var(--edu-color-ink-muted); font-size: var(--edu-font-sm); }
.edu-lib-sources__chevron { margin-left: auto; color: var(--edu-color-ink-faint); }
.edu-lib-sources__toggle[aria-expanded="true"] .edu-lib-sources__chevron { transform: rotate(90deg); }
.edu-lib-sources__body { gap: var(--edu-space-xs); margin-top: var(--edu-space-xs); min-width: 0; }
.edu-lib-sources__body:not([hidden]) { display: grid; }
.edu-lib-sources__note { margin: 0; color: var(--edu-color-ink-muted); font-size: var(--edu-font-sm); overflow-wrap: anywhere; }

/* ---------- 来源列表 ---------- */
.edu-lib-source-list { list-style: none; padding: 0; margin: 0; display: grid; gap: var(--edu-space-xs); }
.edu-lib-source-item {
  display: flex;
  flex-wrap: wrap;
  gap: var(--edu-space-xs);
  align-items: center;
  justify-content: space-between;
  padding: var(--edu-space-xs) var(--edu-space-sm);
  border: 1px solid var(--edu-color-line);
  border-radius: var(--edu-radius-sm);
  background: var(--edu-color-surface);
  min-width: 0;
}
.edu-lib-source-item__label { display: grid; gap: var(--edu-space-xxs); min-width: 0; }
.edu-lib-source-item__pages { font-weight: 600; overflow-wrap: anywhere; }
.edu-lib-source-item__what { color: var(--edu-color-ink-muted); font-size: var(--edu-font-sm); overflow-wrap: anywhere; }
.edu-lib-source-item__actions { margin-top: 0; }

/* ---------- 导入 ---------- */
.edu-lib-stage-list { list-style: none; margin: var(--edu-space-sm) 0; padding: 0; display: grid; gap: var(--edu-space-xxs); }
.edu-lib-stage {
  display: flex;
  flex-wrap: wrap;
  gap: var(--edu-space-xs);
  align-items: baseline;
  padding: var(--edu-space-xs) var(--edu-space-sm);
  border-left: 0.25rem solid var(--edu-color-line);
  background: var(--edu-color-surface-muted);
  border-radius: 0 ${T.radii.sm} ${T.radii.sm} 0;
  min-width: 0;
}
.edu-lib-stage[aria-current="step"] {
  border-left-color: var(--edu-color-accent);
  background: var(--edu-color-accent-soft);
  font-weight: 700;
}
.edu-lib-stage[data-state="done"] { border-left-color: var(--edu-color-success); }
.edu-lib-stage[data-state="blocked"] { border-left-color: var(--edu-color-danger); }
.edu-lib-stage__name { min-width: 0; overflow-wrap: anywhere; }
.edu-lib-stage__state { color: var(--edu-color-ink-muted); font-size: var(--edu-font-xs); }
.edu-lib-job {
  border: 1px solid var(--edu-color-line);
  border-radius: var(--edu-radius-lg);
  padding: var(--edu-space-md);
  background: var(--edu-color-surface);
  min-width: 0;
}
.edu-lib-job__head { display: flex; flex-wrap: wrap; gap: var(--edu-space-xs); align-items: center; justify-content: space-between; }
.edu-lib-job__title { margin: 0; font-size: var(--edu-font-lg); overflow-wrap: anywhere; }
.edu-lib-form { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 15rem), 1fr)); gap: var(--edu-space-sm); margin: var(--edu-space-sm) 0; }
.edu-lib-form .edu-field { min-width: 0; }
.edu-lib-form input { width: 100%; }
.edu-lib-file {
  border: 1px dashed var(--edu-color-line-strong);
  border-radius: var(--edu-radius-md);
  padding: var(--edu-space-sm);
  margin: var(--edu-space-sm) 0;
  min-width: 0;
  overflow-wrap: anywhere;
}

/* ---------- 来源阅读（对话框内） ---------- */
.edu-lib-reader { display: grid; gap: var(--edu-space-md); min-width: 0; }
.edu-lib-page-info { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 14rem), 1fr)); gap: var(--edu-space-sm); }
.edu-lib-page-info__box { border: 1px solid var(--edu-color-line); border-radius: var(--edu-radius-md); padding: var(--edu-space-sm); min-width: 0; }
.edu-lib-page-info__label { margin: 0; color: var(--edu-color-ink-muted); font-size: var(--edu-font-sm); }
.edu-lib-page-info__value { margin: var(--edu-space-xxs) 0 0; font-size: var(--edu-font-lg); font-weight: 700; overflow-wrap: anywhere; }
.edu-lib-page {
  position: relative;
  width: 100%;
  max-width: 32rem;
  aspect-ratio: 3 / 4;
  margin: var(--edu-space-sm) auto;
  border: 1px solid var(--edu-color-line-strong);
  border-radius: var(--edu-radius-sm);
  background:
    repeating-linear-gradient(0deg, color-mix(in srgb, var(--edu-color-line) 70%, transparent) 0 1px, transparent 1px 1.5rem),
    var(--edu-color-surface-muted);
  overflow: hidden;
}
.edu-lib-page__fixture {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  padding: var(--edu-space-md);
  color: var(--edu-color-ink-muted);
  text-align: center;
  font-size: var(--edu-font-sm);
}
.edu-lib-region {
  position: absolute;
  border: 0.2rem solid var(--edu-color-focus);
  background: var(--edu-color-warning-soft);
  box-sizing: border-box;
  pointer-events: none;
}
.edu-lib-region__label {
  position: absolute;
  left: 0;
  top: -1.45rem;
  padding: 0 var(--edu-space-xxs);
  background: var(--edu-color-focus);
  color: var(--edu-color-on-accent);
  font-size: var(--edu-font-xs);
  white-space: nowrap;
}
.edu-lib-block { border: 1px solid var(--edu-color-line); border-radius: var(--edu-radius-sm); padding: var(--edu-space-sm); margin-top: var(--edu-space-sm); min-width: 0; }
.edu-lib-block__text { margin: var(--edu-space-xs) 0 0; overflow-wrap: anywhere; }
.edu-lib-reader-nav { display: flex; flex-wrap: wrap; gap: var(--edu-space-xs); align-items: center; }
.edu-lib-status-line { margin: var(--edu-space-xs) 0; color: var(--edu-color-ink-muted); font-size: var(--edu-font-sm); overflow-wrap: anywhere; }

/* ---------- 窄屏：整页单列 ---------- */
@media (max-width: ${COMPACT_WIDTH}px) {
  .edu-lib-hero { grid-template-columns: minmax(0, 1fr); }
  .edu-lib-cover { width: 8rem; }
}
@media (max-width: 719px) {
  .edu-lib-page { max-width: 100%; }
  .edu-lib-hero__actions .edu-button { width: 100%; }
  .edu-lib-choice { align-items: flex-start; }
  .edu-lib-choice__state { margin-left: 0; }
}
`;

export function ensureLibraryStyles(doc: Document): HTMLStyleElement {
  const existing = doc.head.querySelector<HTMLStyleElement>(`style[${LIBRARY_STYLE_ATTRIBUTE}]`);
  if (existing !== null) return existing;
  const style = doc.createElement('style');
  style.setAttribute(LIBRARY_STYLE_ATTRIBUTE, 'true');
  style.textContent = libraryStyles;
  doc.head.append(style);
  return style;
}
