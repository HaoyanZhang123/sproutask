/**
 * Framework-agnostic stylesheet for the education shell.
 *
 * Everything is emitted as one plain CSS string (no CSS-in-JS runtime); the
 * shell injects it once per document. Type and spacing use rem so a larger
 * base font or browser zoom does not clip controls, and status is always
 * accompanied by a text label (colour is never the only carrier).
 */

import { DESIGN_TOKENS as T } from './tokens.js';

export const EDUCATION_STYLE_ATTRIBUTE = 'data-edu-shell-style';

export const educationStyles = `
.edu-shell {
  --edu-font-base: ${T.baseFontSize};
  --edu-font-xs: ${T.fontSizes.xs};
  --edu-font-sm: ${T.fontSizes.sm};
  --edu-font-md: ${T.fontSizes.md};
  --edu-font-lg: ${T.fontSizes.lg};
  --edu-font-xl: ${T.fontSizes.xl};
  --edu-font-xxl: ${T.fontSizes.xxl};
  --edu-font-display: ${T.fontSizes.display};
  --edu-space-xxs: ${T.spacing.xxs};
  --edu-space-xs: ${T.spacing.xs};
  --edu-space-sm: ${T.spacing.sm};
  --edu-space-md: ${T.spacing.md};
  --edu-space-lg: ${T.spacing.lg};
  --edu-space-xl: ${T.spacing.xl};
  --edu-space-xxl: ${T.spacing.xxl};
  --edu-color-canvas: ${T.colors.canvas};
  --edu-color-surface: ${T.colors.surface};
  --edu-color-surface-muted: ${T.colors.surfaceMuted};
  --edu-color-surface-paper: ${T.colors.surfacePaper};
  --edu-color-ink: ${T.colors.ink};
  --edu-color-ink-muted: ${T.colors.inkMuted};
  --edu-color-ink-faint: ${T.colors.inkFaint};
  --edu-color-line: ${T.colors.line};
  --edu-color-line-strong: ${T.colors.lineStrong};
  --edu-color-accent: ${T.colors.accent};
  --edu-color-accent-strong: ${T.colors.accentStrong};
  --edu-color-accent-soft: ${T.colors.accentSoft};
  --edu-color-focus: ${T.colors.focus};
  --edu-color-info: ${T.colors.info};
  --edu-color-info-soft: ${T.colors.infoSoft};
  --edu-color-warning: ${T.colors.warning};
  --edu-color-warning-soft: ${T.colors.warningSoft};
  --edu-color-danger: ${T.colors.danger};
  --edu-color-danger-soft: ${T.colors.dangerSoft};
  --edu-color-success: ${T.colors.success};
  --edu-color-success-soft: ${T.colors.successSoft};
  --edu-color-neutral-soft: ${T.colors.neutralSoft};
  --edu-color-on-accent: ${T.colors.onAccent};
  --edu-focus-ring: ${T.focusRing};
  --edu-radius-sm: ${T.radii.sm};
  --edu-radius-md: ${T.radii.md};
  --edu-radius-lg: ${T.radii.lg};
  --edu-radius-xl: ${T.radii.xl};
  --edu-radius-pill: ${T.radii.pill};
  --edu-shadow-card: ${T.shadows.card};
  --edu-shadow-pop: ${T.shadows.pop};
  box-sizing: border-box;
  min-height: 100vh;
  max-width: 100%;
  color: var(--edu-color-ink);
  background: var(--edu-color-canvas);
  font-family: "Segoe UI", "Microsoft YaHei", system-ui, sans-serif;
  font-size: var(--edu-font-base);
  line-height: ${T.lineHeights.normal};
}
.edu-shell *,
.edu-shell *::before,
.edu-shell *::after { box-sizing: border-box; }
.edu-shell img,
.edu-shell svg,
.edu-shell video { max-width: 100%; height: auto; }
.edu-shell a { color: var(--edu-color-accent-strong); }
.edu-shell :is(a, button, input, select, textarea, [tabindex]):focus-visible {
  outline: var(--edu-focus-ring);
  outline-offset: 3px;
}
.edu-shell[data-font-scale="large"] { --edu-font-base: 1.5rem; }
.edu-shell button { font: inherit; }

.edu-visually-hidden {
  position: absolute !important;
  width: 1px; height: 1px;
  padding: 0; margin: -1px;
  overflow: hidden; clip: rect(0 0 0 0);
  white-space: nowrap; border: 0;
}
.edu-skip-link {
  position: absolute; left: var(--edu-space-md); top: calc(-1 * var(--edu-space-xxl));
  z-index: 30; padding: var(--edu-space-sm) var(--edu-space-md);
  background: var(--edu-color-surface); color: var(--edu-color-ink);
  border-radius: var(--edu-radius-sm);
}
.edu-skip-link:focus { top: var(--edu-space-md); }
.edu-header {
  background: var(--edu-color-surface);
  border-bottom: 1px solid var(--edu-color-line);
  padding: var(--edu-space-sm) var(--edu-space-lg);
}
.edu-header__top {
  display: flex; flex-wrap: wrap; gap: var(--edu-space-sm);
  align-items: center; justify-content: space-between;
  max-width: 86rem; margin-inline: auto;
}
.edu-brand {
  display: inline-flex; align-items: center; gap: var(--edu-space-sm);
  border: 0; background: none; color: var(--edu-color-ink);
  font-size: var(--edu-font-lg); font-weight: 700; padding: var(--edu-space-xs);
  cursor: pointer;
}
.edu-brand__mark {
  display: inline-grid; place-items: center;
  width: 2rem; height: 2rem; border-radius: var(--edu-radius-md);
  background: var(--edu-color-accent-soft); color: var(--edu-color-accent-strong);
  font-size: var(--edu-font-sm);
}
.edu-header__tools { display: flex; flex-wrap: wrap; gap: var(--edu-space-sm); align-items: center; }
.edu-account-link {
  display: inline-flex; flex-wrap: wrap; align-items: center; gap: var(--edu-space-xs);
  padding: var(--edu-space-xs) var(--edu-space-sm);
  border: 1px solid var(--edu-color-line); border-radius: var(--edu-radius-pill);
  background: var(--edu-color-surface); color: var(--edu-color-ink);
  font-size: var(--edu-font-sm); cursor: pointer;
}
.edu-account-link .edu-chip { font-size: var(--edu-font-xs); }
.edu-fixture-badge {
  display: inline-flex; align-items: center; gap: var(--edu-space-xxs);
  padding: var(--edu-space-xxs) var(--edu-space-xs);
  border-radius: var(--edu-radius-pill);
  background: var(--edu-color-warning-soft); color: var(--edu-color-warning);
  border: 1px solid currentColor;
  font-size: var(--edu-font-xs); font-weight: 600;
}
.edu-context {
  display: flex; flex-wrap: wrap; gap: var(--edu-space-xs) var(--edu-space-md);
  align-items: baseline; max-width: 86rem; margin: var(--edu-space-sm) auto 0;
  padding-top: var(--edu-space-sm); border-top: 1px dashed var(--edu-color-line);
  min-width: 0; font-size: var(--edu-font-sm);
}
.edu-context__item { display: inline-flex; flex-wrap: wrap; gap: var(--edu-space-xxs); min-width: 0; }
.edu-context__label { color: var(--edu-color-ink-muted); }
.edu-context__value { color: var(--edu-color-ink); font-weight: 600; overflow-wrap: anywhere; }
.edu-context__toolbar { margin-left: auto; display: flex; gap: var(--edu-space-xs); flex-wrap: wrap; }

.edu-layout {
  display: grid;
  grid-template-columns: ${T.layout.sidebarRem}rem minmax(0, 1fr);
  gap: ${T.layout.gapRem}rem;
  width: 100%;
  max-width: 86rem;
  margin-inline: auto;
  padding: ${T.layout.pagePaddingRem}rem;
  align-items: start;
}
.edu-sidebar { min-width: 0; }
.edu-nav {
  display: flex; flex-direction: column; gap: var(--edu-space-xxs);
  background: var(--edu-color-surface);
  border: 1px solid var(--edu-color-line);
  border-radius: var(--edu-radius-lg);
  padding: var(--edu-space-xs);
  position: sticky; top: var(--edu-space-md);
}
.edu-nav__link {
  display: flex; align-items: center; justify-content: space-between; gap: var(--edu-space-xs);
  width: 100%; padding: var(--edu-space-sm) var(--edu-space-md);
  border: 0; border-radius: var(--edu-radius-md);
  background: transparent; color: var(--edu-color-ink); text-align: left;
  font-size: var(--edu-font-md); cursor: pointer;
}
.edu-nav__link:hover { background: var(--edu-color-surface-muted); }
.edu-nav__link[aria-current="page"] {
  background: var(--edu-color-accent-soft);
  color: var(--edu-color-accent-strong);
  font-weight: 700;
  box-shadow: inset 3px 0 0 var(--edu-color-accent);
}
.edu-nav__current {
  font-size: var(--edu-font-xs); font-weight: 600;
  border: 1px solid currentColor; border-radius: var(--edu-radius-pill);
  padding: 0 var(--edu-space-xs);
}
.edu-main { min-width: 0; outline: none; }
.edu-main__inner { width: 100%; max-width: 72rem; margin-inline: auto; min-width: 0; }
.edu-page { min-width: 0; }
.edu-page__header { margin-bottom: var(--edu-space-lg); }
.edu-page__title { margin: 0 0 var(--edu-space-xs); font-size: var(--edu-font-xxl); line-height: ${T.lineHeights.tight}; overflow-wrap: anywhere; }
/* The page title receives programmatic focus for screen readers; keep it ring-free. */
.edu-shell .edu-page__title:focus,
.edu-shell .edu-page__title:focus-visible { outline: none; }
.edu-page__lead { margin: 0; color: var(--edu-color-ink-muted); max-width: 62rem; }
.edu-section { margin-top: var(--edu-space-xl); min-width: 0; }
.edu-section__title { margin: 0 0 var(--edu-space-sm); font-size: var(--edu-font-xl); }
.edu-section__lead { margin: 0 0 var(--edu-space-md); color: var(--edu-color-ink-muted); }
.edu-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 17rem), 1fr)); gap: var(--edu-space-md); min-width: 0; }
.edu-entry-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 18rem), 1fr)); gap: var(--edu-space-md); min-width: 0; }
.edu-card, .edu-entry {
  min-width: 0;
  background: var(--edu-color-surface);
  border: 1px solid var(--edu-color-line);
  border-radius: var(--edu-radius-lg);
  padding: var(--edu-space-md);
}
.edu-entry { display: flex; flex-direction: column; gap: var(--edu-space-sm); }
.edu-entry--primary { border-color: var(--edu-color-accent); box-shadow: inset 0 4px 0 var(--edu-color-accent); }
.edu-entry__eyebrow { margin: 0; color: var(--edu-color-ink-muted); font-size: var(--edu-font-sm); }
.edu-entry__title { margin: 0; font-size: var(--edu-font-xl); overflow-wrap: anywhere; }
.edu-entry__body { margin: 0; color: var(--edu-color-ink-muted); overflow-wrap: anywhere; }
.edu-entry__actions { display: flex; flex-wrap: wrap; gap: var(--edu-space-xs); margin-top: auto; padding-top: var(--edu-space-xs); }
.edu-card__title { margin: 0 0 var(--edu-space-xs); font-size: var(--edu-font-lg); overflow-wrap: anywhere; }
.edu-card__meta { margin: 0; color: var(--edu-color-ink-muted); font-size: var(--edu-font-sm); overflow-wrap: anywhere; }
.edu-muted { color: var(--edu-color-ink-muted); }
.edu-warning-text { color: var(--edu-color-warning); font-weight: 600; }
.edu-danger-text { color: var(--edu-color-danger); font-weight: 600; }
.edu-inline-actions { display: flex; flex-wrap: wrap; gap: var(--edu-space-xs); align-items: center; margin-top: var(--edu-space-sm); }
.edu-progress { min-width: 0; }
.edu-progress__head { display: flex; flex-wrap: wrap; gap: var(--edu-space-xs); justify-content: space-between; align-items: baseline; }
.edu-progress__label { font-weight: 600; }
.edu-progress__value { color: var(--edu-color-ink-muted); font-size: var(--edu-font-sm); }
.edu-progress__bar { width: 100%; height: 0.9rem; accent-color: var(--edu-color-accent); }
.edu-progress__note { margin: var(--edu-space-xs) 0 0; color: var(--edu-color-ink-muted); font-size: var(--edu-font-sm); }
.edu-kv { display: grid; grid-template-columns: minmax(7rem, max-content) minmax(0, 1fr); gap: var(--edu-space-xxs) var(--edu-space-sm); margin: 0; font-size: var(--edu-font-sm); }
.edu-kv dt { color: var(--edu-color-ink-muted); }
.edu-kv dd { margin: 0; min-width: 0; overflow-wrap: anywhere; }

.edu-button {
  display: inline-flex; align-items: center; justify-content: center; gap: var(--edu-space-xs);
  min-height: 2.75rem; padding: var(--edu-space-xs) var(--edu-space-md);
  border-radius: var(--edu-radius-md); border: 1px solid var(--edu-color-line-strong);
  background: var(--edu-color-surface); color: var(--edu-color-ink);
  font-size: var(--edu-font-md); font-weight: 600; cursor: pointer;
  text-align: center; text-decoration: none;
}
.edu-button:hover { background: var(--edu-color-surface-muted); }
.edu-button--primary { background: var(--edu-color-accent); border-color: var(--edu-color-accent); color: var(--edu-color-on-accent); }
.edu-button--primary:hover { background: var(--edu-color-accent-strong); }
.edu-button--danger { background: var(--edu-color-danger); border-color: var(--edu-color-danger); color: #fff; }
.edu-button--ghost { border-color: transparent; background: transparent; color: var(--edu-color-accent-strong); text-decoration: underline; }
.edu-button--danger-ghost { border-color: var(--edu-color-danger); background: var(--edu-color-danger-soft); color: var(--edu-color-danger); }
.edu-button[disabled] { opacity: 0.55; cursor: not-allowed; }
.edu-button--small { min-height: 2.25rem; font-size: var(--edu-font-sm); padding: var(--edu-space-xxs) var(--edu-space-sm); }

.edu-chip {
  display: inline-flex; align-items: center; gap: var(--edu-space-xxs);
  padding: var(--edu-space-xxs) var(--edu-space-xs);
  border-radius: var(--edu-radius-pill);
  border: 1px solid currentColor;
  font-size: var(--edu-font-sm); font-weight: 600;
  white-space: normal; overflow-wrap: anywhere;
}
.edu-chip__dot { width: 0.55rem; height: 0.55rem; border-radius: 50%; background: currentColor; flex: none; }
.edu-chip[data-tone="neutral"] { color: var(--edu-color-ink-muted); background: var(--edu-color-neutral-soft); }
.edu-chip[data-tone="progress"] { color: var(--edu-color-info); background: var(--edu-color-info-soft); }
.edu-chip[data-tone="info"] { color: var(--edu-color-info); background: var(--edu-color-info-soft); }
.edu-chip[data-tone="attention"] { color: var(--edu-color-warning); background: var(--edu-color-warning-soft); }
.edu-chip[data-tone="positive"] { color: var(--edu-color-success); background: var(--edu-color-success-soft); }
.edu-chip[data-tone="danger"] { color: var(--edu-color-danger); background: var(--edu-color-danger-soft); }

.edu-notice {
  margin: var(--edu-space-md) 0; padding: var(--edu-space-sm) var(--edu-space-md);
  border: 1px solid var(--edu-color-line-strong); border-left-width: 0.35rem;
  border-radius: var(--edu-radius-md); background: var(--edu-color-surface);
  min-width: 0; overflow-wrap: anywhere;
}
.edu-notice--info { background: var(--edu-color-info-soft); border-color: var(--edu-color-info); }
.edu-notice--warning { background: var(--edu-color-warning-soft); border-color: var(--edu-color-warning); }
.edu-notice--danger { background: var(--edu-color-danger-soft); border-color: var(--edu-color-danger); }
.edu-notice__title { margin: 0 0 var(--edu-space-xxs); font-weight: 700; }
.edu-notice__body { margin: 0; }
.edu-notice__actions { margin-top: var(--edu-space-sm); display: flex; flex-wrap: wrap; gap: var(--edu-space-xs); }
.edu-offline-bar {
  display: flex; flex-wrap: wrap; gap: var(--edu-space-xs); align-items: center;
  padding: var(--edu-space-xs) var(--edu-space-md);
  background: var(--edu-color-warning-soft); color: var(--edu-color-warning);
  border-bottom: 1px solid var(--edu-color-warning);
  font-size: var(--edu-font-sm); font-weight: 600;
}
.edu-save-status { font-weight: 600; }
.edu-save-status[data-state="failed"] { color: var(--edu-color-danger); }
.edu-save-status[data-state="saving"] { color: var(--edu-color-warning); }
.edu-save-status[data-state="saved"] { color: var(--edu-color-success); }

.edu-state { padding: var(--edu-space-lg); border: 1px dashed var(--edu-color-line-strong); border-radius: var(--edu-radius-lg); background: var(--edu-color-surface); min-width: 0; }
.edu-state__title { margin: 0 0 var(--edu-space-xs); font-size: var(--edu-font-lg); }
.edu-state__body { margin: 0; color: var(--edu-color-ink-muted); overflow-wrap: anywhere; }
.edu-state__actions { display: flex; flex-wrap: wrap; gap: var(--edu-space-xs); margin-top: var(--edu-space-md); }
.edu-loading { display: flex; flex-wrap: wrap; gap: var(--edu-space-sm); align-items: center; }
.edu-loading__mark { width: 1rem; height: 1rem; border-radius: 50%; border: 0.2rem solid var(--edu-color-line); border-top-color: var(--edu-color-accent); }

.edu-filters { display: flex; flex-wrap: wrap; gap: var(--edu-space-sm); align-items: end; margin-bottom: var(--edu-space-md); }
.edu-field { display: flex; flex-direction: column; gap: var(--edu-space-xxs); min-width: 0; }
.edu-field__label { font-size: var(--edu-font-sm); font-weight: 600; color: var(--edu-color-ink-muted); }
.edu-select, .edu-input {
  min-height: 2.5rem; min-width: 0; max-width: 100%;
  padding: var(--edu-space-xxs) var(--edu-space-xs);
  border: 1px solid var(--edu-color-line-strong); border-radius: var(--edu-radius-sm);
  background: var(--edu-color-surface); color: var(--edu-color-ink); font: inherit;
}
.edu-checkbox { display: flex; gap: var(--edu-space-xs); align-items: flex-start; font-size: var(--edu-font-sm); }
.edu-checkbox input { width: 1.15rem; height: 1.15rem; margin-top: 0.15rem; flex: none; }
.edu-key-form { display: grid; gap: var(--edu-space-xs); margin-top: var(--edu-space-md); max-width: 42rem; }
.edu-key-form .edu-input { width: 100%; }
.edu-field-label { font-weight: 600; }
.edu-key-intro { border-left: 0.35rem solid var(--edu-color-accent); }
.edu-key-intro__steps { margin: var(--edu-space-sm) 0; padding-left: var(--edu-space-lg); display: grid; gap: var(--edu-space-xs); }
.edu-key-intro__steps strong { display: block; }
.edu-key-intro__steps span { color: var(--edu-color-ink-muted); font-size: var(--edu-font-sm); }
.edu-choice-list { display: grid; gap: var(--edu-space-xs); margin: var(--edu-space-sm) 0; }
.edu-choice { display: flex; gap: var(--edu-space-xs); align-items: flex-start; padding: var(--edu-space-xs); border: 1px solid var(--edu-color-line); border-radius: var(--edu-radius-sm); }
.edu-choice input { margin-top: 0.2rem; }

.edu-axis { border: 1px solid var(--edu-color-line); border-radius: var(--edu-radius-md); padding: var(--edu-space-sm); background: var(--edu-color-surface); min-width: 0; }
.edu-axis__head { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: var(--edu-space-xs); margin-bottom: var(--edu-space-xs); }
.edu-axis__title { margin: 0; font-size: var(--edu-font-md); }
.edu-axis__body { margin: 0; color: var(--edu-color-ink-muted); font-size: var(--edu-font-sm); overflow-wrap: anywhere; }
.edu-axis-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 15rem), 1fr)); gap: var(--edu-space-sm); margin-top: var(--edu-space-sm); }
.edu-self-report { border-style: dashed; background: var(--edu-color-surface-muted); }
.edu-list { list-style: none; margin: 0; padding: 0; display: grid; gap: var(--edu-space-sm); }
.edu-list__item { min-width: 0; padding: var(--edu-space-sm); border: 1px solid var(--edu-color-line); border-radius: var(--edu-radius-md); background: var(--edu-color-surface); }
.edu-evidence { border: 1px solid var(--edu-color-line); border-radius: var(--edu-radius-md); padding: var(--edu-space-sm); min-width: 0; }
.edu-evidence__head { display: flex; flex-wrap: wrap; align-items: center; gap: var(--edu-space-xs); justify-content: space-between; }
.edu-evidence__title { margin: 0; font-size: var(--edu-font-md); }
.edu-evidence__text { margin: var(--edu-space-xs) 0; overflow-wrap: anywhere; }
.edu-tag { display: inline-block; padding: 0 var(--edu-space-xs); border: 1px solid var(--edu-color-line-strong); border-radius: var(--edu-radius-pill); font-size: var(--edu-font-xs); color: var(--edu-color-ink-muted); }
.edu-timeline { margin: var(--edu-space-sm) 0 0; padding: 0; list-style: none; display: grid; gap: var(--edu-space-xs); }
.edu-timeline li { padding-left: var(--edu-space-sm); border-left: 0.2rem solid var(--edu-color-line); font-size: var(--edu-font-sm); }
.edu-slot { min-width: 0; }
.edu-footer { max-width: 86rem; margin: var(--edu-space-lg) auto 0; padding: var(--edu-space-lg) var(--edu-space-xl); color: var(--edu-color-ink-faint); font-size: var(--edu-font-sm); border-top: 1px solid var(--edu-color-line); overflow-wrap: anywhere; }
.edu-footer p { margin: 0 0 var(--edu-space-xxs); }

/* ---------- v2 外壳：顶栏 + 三个主入口 + 单列内容（2026-11 界面重构） ---------- */
.edu-topbar {
  position: sticky; top: 0; z-index: 20;
  display: flex; align-items: center; gap: var(--edu-space-lg);
  padding: var(--edu-space-sm) var(--edu-space-xl);
  background: color-mix(in srgb, var(--edu-color-canvas) 94%, transparent);
  border-bottom: 1px solid var(--edu-color-line);
  backdrop-filter: blur(8px);
}
.edu-brand { display: inline-flex; align-items: center; gap: var(--edu-space-xs); border: 0; background: none; padding: var(--edu-space-xxs) var(--edu-space-xs); cursor: pointer; color: var(--edu-color-ink); }
.edu-brand__mark { width: 1.9rem; height: 1.9rem; color: var(--edu-color-accent); flex: none; }
.edu-brand__text { display: inline-flex; flex-direction: column; line-height: 1.05; font-weight: 800; font-size: var(--edu-font-lg); letter-spacing: 0.02em; }
.edu-brand__text small { margin-top: 0.18rem; font-size: 0.625rem; font-weight: 700; letter-spacing: 0.28em; color: var(--edu-color-ink-faint); }
.edu-topbar .edu-nav { display: flex; flex-direction: row; align-items: center; gap: 4px; padding: 4px; border: 0; border-radius: var(--edu-radius-pill); background: var(--edu-color-surface-muted); position: static; }
.edu-tab { border: 0; background: transparent; color: var(--edu-color-ink-muted); font: inherit; font-size: var(--edu-font-sm); font-weight: 700; padding: 0.45rem 1.1rem; border-radius: var(--edu-radius-pill); cursor: pointer; }
.edu-tab:hover { color: var(--edu-color-ink); }
.edu-tab[aria-current="page"] { background: var(--edu-color-surface); color: var(--edu-color-accent-strong); box-shadow: 0 1px 3px rgba(31, 36, 33, 0.12); }
.edu-topbar__tools { margin-left: auto; display: flex; align-items: center; gap: var(--edu-space-xs); }
.edu-settings-link { border: 1px solid var(--edu-color-line); background: var(--edu-color-surface); color: var(--edu-color-ink-muted); font: inherit; font-size: var(--edu-font-sm); font-weight: 600; padding: 0.45rem 0.95rem; border-radius: var(--edu-radius-pill); cursor: pointer; }
.edu-settings-link:hover { color: var(--edu-color-ink); background: var(--edu-color-surface-muted); }
.edu-content { width: 100%; max-width: 86rem; margin-inline: auto; padding: var(--edu-space-lg) var(--edu-space-xl) var(--edu-space-xxl); }
.edu-main { min-width: 0; }
.edu-main__inner { width: 100%; max-width: 76rem; margin-inline: auto; }
.edu-footer { max-width: 86rem; margin: 0 auto; padding: var(--edu-space-lg) var(--edu-space-xl) var(--edu-space-xl); color: var(--edu-color-ink-faint); font-size: var(--edu-font-sm); border-top: 1px solid var(--edu-color-line); text-align: center; }
.edu-footer p { margin: 0; }
.edu-page__title { margin: 0 0 var(--edu-space-xs); font-size: var(--edu-font-display); line-height: 1.2; letter-spacing: -0.01em; }
.edu-page__lead { margin: 0 0 var(--edu-space-xl); color: var(--edu-color-ink-muted); font-size: var(--edu-font-md); max-width: 62ch; }
.edu-page__header { margin-bottom: var(--edu-space-lg); }
.edu-section { margin-top: var(--edu-space-xl); }
.edu-section__title { margin: 0 0 var(--edu-space-sm); font-size: var(--edu-font-xl); }
.edu-section__lead { margin: 0 0 var(--edu-space-md); color: var(--edu-color-ink-muted); }
.edu-card, .edu-entry, .edu-state { border-radius: var(--edu-radius-lg); border-color: var(--edu-color-line); box-shadow: 0 1px 2px rgba(31, 36, 33, 0.04), 0 10px 28px rgba(31, 36, 33, 0.05); }
.edu-button { border-radius: var(--edu-radius-pill); border-color: var(--edu-color-line); min-height: 2.75rem; font-weight: 700; }
.edu-button--primary { box-shadow: 0 8px 18px rgba(47, 107, 79, 0.2); }
.edu-chip { border-color: transparent; background: var(--edu-color-neutral-soft); color: var(--edu-color-ink-muted); }

/* 今天 */
.edu-today { display: grid; grid-template-columns: minmax(0, 1.6fr) minmax(17rem, 1fr); gap: var(--edu-space-lg); align-items: start; }
.edu-hero { position: relative; overflow: hidden; padding: var(--edu-space-xl); background: linear-gradient(135deg, #f2f8f2 0%, var(--edu-color-surface) 62%); border: 1px solid #d9e7dc; border-radius: var(--edu-radius-xl); box-shadow: 0 1px 2px rgba(31, 36, 33, 0.04), 0 14px 36px rgba(31, 36, 33, 0.06); }
.edu-hero__eyebrow { margin: 0; font-size: var(--edu-font-xs); font-weight: 800; letter-spacing: 0.12em; color: var(--edu-color-ink-muted); }
.edu-hero__title { margin: var(--edu-space-xs) 0 var(--edu-space-sm); font-size: clamp(1.5rem, 2.4vw, 1.9rem); line-height: 1.25; }
.edu-hero__meta { display: flex; flex-wrap: wrap; gap: var(--edu-space-xs); margin-bottom: var(--edu-space-md); }
.edu-hero__body { margin: 0 0 var(--edu-space-lg); color: var(--edu-color-ink-muted); max-width: 52ch; }
.edu-hero__actions { display: flex; flex-wrap: wrap; gap: var(--edu-space-xs); align-items: center; }
.edu-today__side-title { margin: 0 0 var(--edu-space-sm); font-size: var(--edu-font-md); }
.edu-task { display: flex; align-items: center; gap: var(--edu-space-sm); width: 100%; margin-bottom: var(--edu-space-xs); padding: var(--edu-space-sm) var(--edu-space-md); border: 1px solid var(--edu-color-line); border-radius: var(--edu-radius-md); background: var(--edu-color-surface); text-align: left; cursor: pointer; font: inherit; color: var(--edu-color-ink); }
.edu-task:hover { background: #fffdf7; }
.edu-task__icon { display: grid; place-items: center; width: 2.25rem; height: 2.25rem; border-radius: var(--edu-radius-sm); flex: none; font-size: 1rem; }
.edu-task__icon--amber { background: var(--edu-color-warning-soft); color: var(--edu-color-warning); }
.edu-task__icon--blue { background: var(--edu-color-info-soft); color: var(--edu-color-info); }
.edu-task__icon--green { background: var(--edu-color-accent-soft); color: var(--edu-color-accent-strong); }
.edu-task__icon--neutral { background: var(--edu-color-surface-muted); color: var(--edu-color-ink-muted); }
.edu-task__text { display: flex; flex-direction: column; min-width: 0; }
.edu-task__text b { font-size: var(--edu-font-md); font-weight: 700; }
.edu-task__text span { font-size: var(--edu-font-sm); color: var(--edu-color-ink-faint); overflow-wrap: anywhere; }
.edu-task__arrow { margin-left: auto; color: var(--edu-color-ink-faint); font-size: 1.4rem; line-height: 1; }
.edu-today__progress { display: flex; align-items: center; gap: var(--edu-space-lg); flex-wrap: wrap; margin-top: var(--edu-space-lg); padding: var(--edu-space-md) var(--edu-space-lg); background: var(--edu-color-surface); border: 1px solid var(--edu-color-line); border-radius: var(--edu-radius-lg); }
.edu-today__nums { display: flex; gap: var(--edu-space-xl); }
.edu-num b { display: block; font-size: 1.6rem; line-height: 1.1; }
.edu-num span { font-size: var(--edu-font-xs); color: var(--edu-color-ink-faint); }
.edu-bar { flex: 1 1 16rem; min-width: 12rem; }
.edu-bar__track { display: flex; height: 0.55rem; border-radius: 999px; background: var(--edu-color-surface-muted); overflow: hidden; }
.edu-bar__learn { background: var(--edu-color-accent); }
.edu-bar__review { background: var(--edu-color-warning); }
.edu-bar__caption { margin: var(--edu-space-xs) 0 0; font-size: var(--edu-font-xs); color: var(--edu-color-ink-faint); }
@media (max-width: ${T.breakpoints.compact - 1}px) {
  .edu-topbar { gap: var(--edu-space-sm); padding-inline: var(--edu-space-md); }
  .edu-content { padding-inline: var(--edu-space-md); }
  .edu-brand__text small { display: none; }
  .edu-today { grid-template-columns: minmax(0, 1fr); }
}
@media (max-width: 719px) {
  .edu-topbar { flex-wrap: wrap; }
  .edu-brand { order: 1; }
  .edu-topbar__tools { order: 2; }
  .edu-topbar .edu-nav { order: 3; width: 100%; justify-content: center; }
  .edu-page__title { font-size: var(--edu-font-xxl); }
  .edu-kv { grid-template-columns: minmax(0, 1fr); }
}

.edu-dialog-backdrop {
  position: fixed; inset: 0; z-index: 40;
  display: grid; place-items: center;
  padding: var(--edu-space-md);
  background: rgba(18, 33, 24, 0.55);
}
.edu-dialog-backdrop[hidden] { display: none; }
.edu-dialog {
  width: min(42rem, 100%); max-height: 88vh; overflow: auto;
  background: var(--edu-color-surface); color: var(--edu-color-ink);
  border-radius: var(--edu-radius-lg); border: 1px solid var(--edu-color-line-strong);
  padding: var(--edu-space-lg); box-shadow: 0 1rem 3rem rgba(0, 0, 0, 0.25);
}
.edu-dialog__title { margin: 0 0 var(--edu-space-sm); font-size: var(--edu-font-xl); overflow-wrap: anywhere; }
.edu-dialog__impact { margin: 0 0 var(--edu-space-md); padding-left: var(--edu-space-lg); }
.edu-dialog__impact li { margin-bottom: var(--edu-space-xxs); overflow-wrap: anywhere; }
.edu-dialog__actions { display: flex; flex-wrap: wrap; gap: var(--edu-space-xs); justify-content: flex-end; margin-top: var(--edu-space-lg); }
.edu-dialog__status { margin: var(--edu-space-sm) 0 0; font-size: var(--edu-font-sm); }

@media (max-width: ${T.breakpoints.compact - 1}px) {
  .edu-layout { grid-template-columns: minmax(0, 1fr); padding: var(--edu-space-md); }
  .edu-sidebar { order: -1; }
  .edu-nav { position: static; flex-direction: row; flex-wrap: wrap; }
  .edu-nav__link { width: auto; flex: 1 1 auto; justify-content: center; }
  .edu-header { padding-inline: var(--edu-space-md); }
  .edu-context__toolbar { margin-left: 0; }
}
@media (max-width: 719px) {
  .edu-header__top { align-items: flex-start; }
  .edu-entry__actions .edu-button { width: 100%; }
  .edu-kv { grid-template-columns: minmax(0, 1fr); }
  .edu-kv dt { margin-top: var(--edu-space-xs); }
}
@media (prefers-reduced-motion: reduce) {
  .edu-shell *, .edu-shell *::before, .edu-shell *::after { animation-duration: 0.01ms !important; transition-duration: 0.01ms !important; }
}
`;

/** Ensures one stylesheet per document; returns the style element. */
export function ensureEducationStyles(doc: Document): HTMLStyleElement {
  const existing = doc.head.querySelector<HTMLStyleElement>(`style[${EDUCATION_STYLE_ATTRIBUTE}]`);
  if (existing !== null) return existing;
  const style = doc.createElement('style');
  style.setAttribute(EDUCATION_STYLE_ATTRIBUTE, 'true');
  style.textContent = educationStyles;
  doc.head.append(style);
  return style;
}
