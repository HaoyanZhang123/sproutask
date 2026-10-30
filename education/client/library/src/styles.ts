/** Library-specific styles; tokens/layout come from @edu/client-shell. */

import { DESIGN_TOKENS as T } from '../../shell/src/index.js';

export const LIBRARY_STYLE_ATTRIBUTE = 'data-edu-library-style';

export const libraryStyles = `
.edu-lib { min-width: 0; }
.edu-lib *,
.edu-lib *::before,
.edu-lib *::after { box-sizing: border-box; }
.edu-lib-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 20rem), 1fr));
  gap: ${T.spacing.md};
  min-width: 0;
}
.edu-lib-book {
  min-width: 0;
  background: var(--edu-color-surface);
  border: 1px solid var(--edu-color-line);
  border-radius: var(--edu-radius-lg);
  padding: ${T.spacing.md};
  display: flex;
  flex-direction: column;
  gap: ${T.spacing.sm};
}
.edu-lib-book[data-state="candidate"] { border-color: ${T.colors.warning}; border-left-width: 0.4rem; }
.edu-lib-book[data-state="unavailable"] { border-color: ${T.colors.danger}; border-left-width: 0.4rem; }
.edu-lib-book__head { display: flex; flex-wrap: wrap; gap: ${T.spacing.xs}; align-items: center; justify-content: space-between; }
.edu-lib-book__title { margin: 0; font-size: var(--edu-font-lg); overflow-wrap: anywhere; }
.edu-lib-book__meta { margin: 0; color: var(--edu-color-ink-muted); font-size: var(--edu-font-sm); overflow-wrap: anywhere; }
.edu-lib-book__actions { display: flex; flex-wrap: wrap; gap: ${T.spacing.xs}; margin-top: auto; padding-top: ${T.spacing.xs}; }
.edu-lib-candidate-banner {
  position: sticky; top: 0; z-index: 3;
  margin-bottom: ${T.spacing.md};
  padding: ${T.spacing.sm} ${T.spacing.md};
  border: 1px solid ${T.colors.warning};
  border-left-width: 0.4rem;
  border-radius: var(--edu-radius-md);
  background: ${T.colors.warningSoft};
  color: ${T.colors.warning};
  font-weight: 600;
  overflow-wrap: anywhere;
}
.edu-lib-candidate-banner button { margin-left: ${T.spacing.xs}; }
.edu-lib-stage-list { list-style: none; margin: ${T.spacing.sm} 0; padding: 0; display: grid; gap: ${T.spacing.xxs}; }
.edu-lib-stage {
  display: flex; flex-wrap: wrap; gap: ${T.spacing.xs}; align-items: baseline;
  padding: ${T.spacing.xs} ${T.spacing.sm};
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
.edu-lib-job { border: 1px solid var(--edu-color-line); border-radius: var(--edu-radius-lg); padding: ${T.spacing.md}; background: var(--edu-color-surface); min-width: 0; }
.edu-lib-job__head { display: flex; flex-wrap: wrap; gap: ${T.spacing.xs}; align-items: center; justify-content: space-between; }
.edu-lib-job__title { margin: 0; font-size: var(--edu-font-lg); overflow-wrap: anywhere; }
.edu-lib-form { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 15rem), 1fr)); gap: ${T.spacing.sm}; margin: ${T.spacing.sm} 0; }
.edu-lib-form .edu-field { min-width: 0; }
.edu-lib-form input { width: 100%; }
.edu-lib-file {
  border: 1px dashed var(--edu-color-line-strong);
  border-radius: var(--edu-radius-md);
  padding: ${T.spacing.sm};
  margin: ${T.spacing.sm} 0;
  min-width: 0;
  overflow-wrap: anywhere;
}
.edu-lib-source-list { list-style: none; padding: 0; margin: ${T.spacing.sm} 0; display: grid; gap: ${T.spacing.xs}; }
.edu-lib-source-item {
  display: flex; flex-wrap: wrap; gap: ${T.spacing.xs}; align-items: center; justify-content: space-between;
  padding: ${T.spacing.xs} ${T.spacing.sm};
  border: 1px solid var(--edu-color-line);
  border-radius: var(--edu-radius-sm);
  background: var(--edu-color-surface);
  min-width: 0;
}
.edu-lib-source-item__label { min-width: 0; overflow-wrap: anywhere; }
.edu-lib-reader { display: grid; gap: ${T.spacing.md}; min-width: 0; }
.edu-lib-page-info { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 14rem), 1fr)); gap: ${T.spacing.sm}; }
.edu-lib-page-info__box { border: 1px solid var(--edu-color-line); border-radius: var(--edu-radius-md); padding: ${T.spacing.sm}; min-width: 0; }
.edu-lib-page-info__label { margin: 0; color: var(--edu-color-ink-muted); font-size: var(--edu-font-sm); }
.edu-lib-page-info__value { margin: ${T.spacing.xxs} 0 0; font-size: var(--edu-font-lg); font-weight: 700; overflow-wrap: anywhere; }
.edu-lib-page {
  position: relative;
  width: 100%;
  max-width: 32rem;
  aspect-ratio: 3 / 4;
  margin: ${T.spacing.sm} auto;
  border: 1px solid var(--edu-color-line-strong);
  border-radius: var(--edu-radius-sm);
  background:
    repeating-linear-gradient(0deg, rgba(0,0,0,0.03) 0 1px, transparent 1px 1.5rem),
    var(--edu-color-surface-muted);
  overflow: hidden;
}
.edu-lib-page__fixture {
  position: absolute; inset: 0;
  display: grid; place-items: center;
  padding: ${T.spacing.md};
  color: var(--edu-color-ink-muted);
  text-align: center;
  font-size: var(--edu-font-sm);
}
.edu-lib-region {
  position: absolute;
  border: 0.2rem solid ${T.colors.focus};
  background: rgba(154, 75, 0, 0.18);
  box-sizing: border-box;
  pointer-events: none;
}
.edu-lib-region__label {
  position: absolute; left: 0; top: -1.45rem;
  padding: 0 ${T.spacing.xxs};
  background: ${T.colors.focus};
  color: #fff;
  font-size: var(--edu-font-xs);
  white-space: nowrap;
}
.edu-lib-block { border: 1px solid var(--edu-color-line); border-radius: var(--edu-radius-sm); padding: ${T.spacing.sm}; margin-top: ${T.spacing.sm}; min-width: 0; }
.edu-lib-block__text { margin: ${T.spacing.xs} 0 0; overflow-wrap: anywhere; }
.edu-lib-reader-nav { display: flex; flex-wrap: wrap; gap: ${T.spacing.xs}; align-items: center; }
.edu-lib-reader-nav .edu-button { min-height: 2.25rem; }
.edu-lib-status-line { margin: ${T.spacing.xs} 0; color: var(--edu-color-ink-muted); font-size: var(--edu-font-sm); overflow-wrap: anywhere; }
.edu-lib-inline-code { font-family: ui-monospace, "Cascadia Mono", monospace; font-size: var(--edu-font-xs); overflow-wrap: anywhere; }
@media (max-width: 719px) {
  .edu-lib-page { max-width: 100%; }
  .edu-lib-book__actions .edu-button { width: 100%; }
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
