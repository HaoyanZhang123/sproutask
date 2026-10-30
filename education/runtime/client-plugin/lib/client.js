window.__ModuleLoader__.load({
  id: '@edu/client-root',
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;
    "use strict";
    var __create = Object.create;
    var __defProp = Object.defineProperty;
    var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
    var __getOwnPropNames = Object.getOwnPropertyNames;
    var __getProtoOf = Object.getPrototypeOf;
    var __hasOwnProp = Object.prototype.hasOwnProperty;
    var __export = (target, all) => {
      for (var name in all)
        __defProp(target, name, { get: all[name], enumerable: true });
    };
    var __copyProps = (to, from, except, desc) => {
      if (from && typeof from === "object" || typeof from === "function") {
        for (let key of __getOwnPropNames(from))
          if (!__hasOwnProp.call(to, key) && key !== except)
            __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
      }
      return to;
    };
    var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
      // If the importer is in node compatibility mode or this is not an ESM
      // file that has been converted to a CommonJS file using a Babel-
      // compatible transform (i.e. "__esModule" has not been set), then set
      // "default" to the CommonJS "module.exports" for node compatibility.
      isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
      mod
    ));
    var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
    
    // education/runtime/client-plugin/src/index.ts
    var index_exports = {};
    __export(index_exports, {
      EDUCATION_ROOT_TITLE: () => EDUCATION_ROOT_TITLE,
      apply: () => apply,
      dispose: () => dispose,
      inject: () => inject
    });
    module.exports = __toCommonJS(index_exports);
    var React = __toESM(require("react"), 1);
    
    // education/client/shell/src/tokens.ts
    var DESIGN_TOKENS = {
      /** 20px at a 16px root font. Deliberately larger than the browser default. */
      baseFontSize: "1.25rem",
      fontSizes: {
        xs: "0.75rem",
        sm: "0.875rem",
        md: "1rem",
        lg: "1.125rem",
        xl: "1.375rem",
        xxl: "1.75rem"
      },
      lineHeights: {
        tight: "1.25",
        normal: "1.55",
        relaxed: "1.7"
      },
      spacing: {
        xxs: "0.25rem",
        xs: "0.5rem",
        sm: "0.75rem",
        md: "1rem",
        lg: "1.5rem",
        xl: "2rem",
        xxl: "3rem"
      },
      radii: {
        sm: "0.35rem",
        md: "0.65rem",
        lg: "0.9rem",
        pill: "999rem"
      },
      colors: {
        canvas: "#f4f6f2",
        surface: "#ffffff",
        surfaceMuted: "#eef2ec",
        ink: "#17211b",
        inkMuted: "#465349",
        inkFaint: "#5f6d63",
        line: "#c7d1c8",
        lineStrong: "#8d9c90",
        accent: "#1f6b46",
        accentStrong: "#124a2f",
        accentSoft: "#e2f0e6",
        focus: "#9a4b00",
        info: "#1d4e89",
        infoSoft: "#e7eff9",
        warning: "#7a4600",
        warningSoft: "#fdf1dc",
        danger: "#9b1c1c",
        dangerSoft: "#fbe9e7",
        success: "#14603c",
        successSoft: "#dff1e5",
        neutralSoft: "#e9eeea",
        onAccent: "#ffffff"
      },
      focusRing: "3px solid #9a4b00",
      breakpoints: {
        /** Below this the sidebar collapses to a top navigation row. */
        compact: 1100,
        standard: 1280,
        wide: 1440
      },
      layout: {
        sidebarRem: 14,
        gapRem: 1.5,
        pagePaddingRem: 2,
        minContentRem: 20,
        maxContentRem: 72
      }
    };
    var STATUS_TONE_COLORS = {
      neutral: { fg: DESIGN_TOKENS.colors.inkMuted, bg: DESIGN_TOKENS.colors.neutralSoft },
      progress: { fg: DESIGN_TOKENS.colors.info, bg: DESIGN_TOKENS.colors.infoSoft },
      attention: { fg: DESIGN_TOKENS.colors.warning, bg: DESIGN_TOKENS.colors.warningSoft },
      positive: { fg: DESIGN_TOKENS.colors.success, bg: DESIGN_TOKENS.colors.successSoft },
      info: { fg: DESIGN_TOKENS.colors.info, bg: DESIGN_TOKENS.colors.infoSoft },
      danger: { fg: DESIGN_TOKENS.colors.danger, bg: DESIGN_TOKENS.colors.dangerSoft }
    };
    
    // education/client/shell/src/layout.ts
    function remToPx(rem, baseFontPx) {
      return rem * baseFontPx;
    }
    function evaluateLayout(viewportWidth, viewportHeight, baseFontPx = 20) {
      const sidebarWidthPx = remToPx(DESIGN_TOKENS.layout.sidebarRem, baseFontPx);
      const gapPx = remToPx(DESIGN_TOKENS.layout.gapRem, baseFontPx);
      const pagePaddingPx = remToPx(DESIGN_TOKENS.layout.pagePaddingRem, baseFontPx);
      const minContentWidthPx = remToPx(DESIGN_TOKENS.layout.minContentRem, baseFontPx);
      const compact = viewportWidth < DESIGN_TOKENS.breakpoints.compact;
      const sidebarFits = sidebarWidthPx + gapPx + minContentWidthPx <= viewportWidth;
      if (!compact && sidebarFits) {
        const contentWidthPx2 = viewportWidth - sidebarWidthPx - gapPx - pagePaddingPx * 2;
        return {
          viewportWidth,
          viewportHeight,
          baseFontPx,
          mode: "sidebar",
          navOrientation: "vertical",
          sidebarWidthPx,
          gapPx,
          contentWidthPx: contentWidthPx2,
          minContentWidthPx,
          pagePaddingPx,
          fits: contentWidthPx2 >= minContentWidthPx,
          horizontalOverflow: contentWidthPx2 < minContentWidthPx
        };
      }
      const contentWidthPx = viewportWidth - pagePaddingPx * 2;
      return {
        viewportWidth,
        viewportHeight,
        baseFontPx,
        mode: "stacked",
        navOrientation: "horizontal",
        sidebarWidthPx,
        gapPx,
        contentWidthPx,
        minContentWidthPx,
        pagePaddingPx,
        fits: contentWidthPx >= minContentWidthPx,
        horizontalOverflow: contentWidthPx < minContentWidthPx
      };
    }
    
    // education/client/shell/src/styles.ts
    var EDUCATION_STYLE_ATTRIBUTE = "data-edu-shell-style";
    var educationStyles = `
    .edu-shell {
      --edu-font-base: ${DESIGN_TOKENS.baseFontSize};
      --edu-font-xs: ${DESIGN_TOKENS.fontSizes.xs};
      --edu-font-sm: ${DESIGN_TOKENS.fontSizes.sm};
      --edu-font-md: ${DESIGN_TOKENS.fontSizes.md};
      --edu-font-lg: ${DESIGN_TOKENS.fontSizes.lg};
      --edu-font-xl: ${DESIGN_TOKENS.fontSizes.xl};
      --edu-font-xxl: ${DESIGN_TOKENS.fontSizes.xxl};
      --edu-space-xxs: ${DESIGN_TOKENS.spacing.xxs};
      --edu-space-xs: ${DESIGN_TOKENS.spacing.xs};
      --edu-space-sm: ${DESIGN_TOKENS.spacing.sm};
      --edu-space-md: ${DESIGN_TOKENS.spacing.md};
      --edu-space-lg: ${DESIGN_TOKENS.spacing.lg};
      --edu-space-xl: ${DESIGN_TOKENS.spacing.xl};
      --edu-space-xxl: ${DESIGN_TOKENS.spacing.xxl};
      --edu-color-canvas: ${DESIGN_TOKENS.colors.canvas};
      --edu-color-surface: ${DESIGN_TOKENS.colors.surface};
      --edu-color-surface-muted: ${DESIGN_TOKENS.colors.surfaceMuted};
      --edu-color-ink: ${DESIGN_TOKENS.colors.ink};
      --edu-color-ink-muted: ${DESIGN_TOKENS.colors.inkMuted};
      --edu-color-ink-faint: ${DESIGN_TOKENS.colors.inkFaint};
      --edu-color-line: ${DESIGN_TOKENS.colors.line};
      --edu-color-line-strong: ${DESIGN_TOKENS.colors.lineStrong};
      --edu-color-accent: ${DESIGN_TOKENS.colors.accent};
      --edu-color-accent-strong: ${DESIGN_TOKENS.colors.accentStrong};
      --edu-color-accent-soft: ${DESIGN_TOKENS.colors.accentSoft};
      --edu-color-focus: ${DESIGN_TOKENS.colors.focus};
      --edu-color-info: ${DESIGN_TOKENS.colors.info};
      --edu-color-info-soft: ${DESIGN_TOKENS.colors.infoSoft};
      --edu-color-warning: ${DESIGN_TOKENS.colors.warning};
      --edu-color-warning-soft: ${DESIGN_TOKENS.colors.warningSoft};
      --edu-color-danger: ${DESIGN_TOKENS.colors.danger};
      --edu-color-danger-soft: ${DESIGN_TOKENS.colors.dangerSoft};
      --edu-color-success: ${DESIGN_TOKENS.colors.success};
      --edu-color-success-soft: ${DESIGN_TOKENS.colors.successSoft};
      --edu-color-neutral-soft: ${DESIGN_TOKENS.colors.neutralSoft};
      --edu-color-on-accent: ${DESIGN_TOKENS.colors.onAccent};
      --edu-focus-ring: ${DESIGN_TOKENS.focusRing};
      --edu-radius-sm: ${DESIGN_TOKENS.radii.sm};
      --edu-radius-md: ${DESIGN_TOKENS.radii.md};
      --edu-radius-lg: ${DESIGN_TOKENS.radii.lg};
      --edu-radius-pill: ${DESIGN_TOKENS.radii.pill};
      box-sizing: border-box;
      min-height: 100vh;
      max-width: 100%;
      color: var(--edu-color-ink);
      background: var(--edu-color-canvas);
      font-family: "Segoe UI", "Microsoft YaHei", system-ui, sans-serif;
      font-size: var(--edu-font-base);
      line-height: ${DESIGN_TOKENS.lineHeights.normal};
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
      grid-template-columns: ${DESIGN_TOKENS.layout.sidebarRem}rem minmax(0, 1fr);
      gap: ${DESIGN_TOKENS.layout.gapRem}rem;
      width: 100%;
      max-width: 86rem;
      margin-inline: auto;
      padding: ${DESIGN_TOKENS.layout.pagePaddingRem}rem;
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
    .edu-page__title { margin: 0 0 var(--edu-space-xs); font-size: var(--edu-font-xxl); line-height: ${DESIGN_TOKENS.lineHeights.tight}; overflow-wrap: anywhere; }
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
    
    @media (max-width: ${DESIGN_TOKENS.breakpoints.compact - 1}px) {
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
    function ensureEducationStyles(doc) {
      const existing = doc.head.querySelector(`style[${EDUCATION_STYLE_ATTRIBUTE}]`);
      if (existing !== null) return existing;
      const style = doc.createElement("style");
      style.setAttribute(EDUCATION_STYLE_ATTRIBUTE, "true");
      style.textContent = educationStyles;
      doc.head.append(style);
      return style;
    }
    
    // education/client/shell/src/dom.ts
    function appendChildren(parent, children) {
      const doc = parent.ownerDocument ?? globalThis.document;
      for (const child of children) {
        if (child === null || child === void 0 || child === false) continue;
        if (typeof child === "string" || typeof child === "number") {
          parent.appendChild(doc.createTextNode(String(child)));
        } else {
          parent.appendChild(child);
        }
      }
    }
    function h(tag, attrs = {}, ...children) {
      const doc = globalThis.document;
      const element = doc.createElement(tag);
      for (const [name, rawValue] of Object.entries(attrs)) {
        if (rawValue === null || rawValue === void 0 || rawValue === false) continue;
        if (name === "class") {
          element.className = String(rawValue);
          continue;
        }
        if (name === "text") {
          element.textContent = String(rawValue);
          continue;
        }
        if (name === "dataset") {
          for (const [key, value] of Object.entries(rawValue)) {
            element.dataset[key] = value;
          }
          continue;
        }
        if (name.startsWith("on") && typeof rawValue === "function") {
          const eventName = name.slice(2).toLowerCase();
          element.addEventListener(eventName, rawValue);
          continue;
        }
        if (rawValue === true) {
          element.setAttribute(name, "");
          continue;
        }
        element.setAttribute(name, String(rawValue));
      }
      appendChildren(element, children);
      return element;
    }
    function clear(node) {
      node.replaceChildren();
    }
    var FOCUSABLE_SELECTOR = [
      "a[href]",
      "button:not([disabled])",
      "input:not([disabled])",
      "select:not([disabled])",
      "textarea:not([disabled])",
      '[tabindex]:not([tabindex="-1"])'
    ].join(",");
    function focusableElements(root) {
      return [...root.querySelectorAll(FOCUSABLE_SELECTOR)].filter((element) => {
        if (element.hasAttribute("hidden")) return false;
        if (element.getAttribute("aria-hidden") === "true") return false;
        let ancestor = element;
        while (ancestor !== null) {
          if (ancestor.hasAttribute("hidden")) return false;
          ancestor = ancestor.parentElement;
        }
        return true;
      });
    }
    
    // education/client/shell/src/labels.ts
    var LEARNING_LABELS = {
      not_started: "\u672A\u5F00\u59CB",
      in_progress: "\u8FDB\u884C\u4E2D",
      completed: "\u672C\u8F6E\u5DF2\u5B8C\u6210"
    };
    var UNDERSTANDING_LABELS = {
      unassessed: "\u5C1A\u65E0\u8DB3\u591F\u8BC1\u636E",
      needs_support: "\u9700\u5DE9\u56FA",
      developing: "\u521D\u6B65\u7406\u89E3",
      supported: "\u8868\u73B0\u7A33\u5B9A"
    };
    var REVIEW_OUTCOME_LABELS = {
      needs_support: "\u9700\u5DE9\u56FA",
      developing: "\u521D\u6B65\u7406\u89E3",
      supported: "\u8868\u73B0\u7A33\u5B9A"
    };
    var SELF_REPORT_LABELS = {
      uncertain: "\u4E0D\u786E\u5B9A",
      basically_understood: "\u57FA\u672C\u4F1A",
      can_explain: "\u80FD\u89E3\u91CA"
    };
    var SESSION_MODE_LABELS = {
      learn: "\u5B66\u4E60",
      review: "\u590D\u4E60",
      diagnostic: "\u77ED\u8BCA\u65AD"
    };
    var SESSION_STATUS_LABELS = {
      active: "\u8FDB\u884C\u4E2D",
      completed: "\u5DF2\u5B8C\u6210",
      abandoned: "\u5DF2\u4E2D\u6B62"
    };
    var EVIDENCE_KIND_LABELS = {
      recall: "\u56DE\u5FC6",
      explain: "\u89E3\u91CA",
      discriminate: "\u8FA8\u6790",
      transfer: "\u8FC1\u79FB",
      label: "\u6807\u6CE8"
    };
    var ASSISTANCE_LABELS = {
      unassisted: "\u72EC\u7ACB\u5B8C\u6210",
      assisted: "\u4F7F\u7528\u4E86\u63D0\u793A\u6216\u793A\u8303"
    };
    var VALIDITY_LABELS = {
      current: "\u5F53\u524D\u6709\u6548",
      stale: "\u5DF2\u8FC7\u671F",
      pending: "\u5F85\u786E\u8BA4",
      needs_recheck: "\u5F85\u91CD\u65B0\u786E\u8BA4"
    };
    var TRUST_MODE_LABELS = {
      published: "\u5DF2\u5BA1\u6838\u5185\u5BB9\u5305",
      candidate: "\u5019\u9009\u5185\u5BB9\uFF08\u672A\u6838\u5B9E\uFF09"
    };
    var SUBJECT_LABELS = {
      biology: "\u751F\u7269",
      physics: "\u7269\u7406",
      chemistry: "\u5316\u5B66"
    };
    var REVIEW_REASON_LABELS = {
      due: "\u5DF2\u5230\u590D\u4E60\u65F6\u95F4",
      needs_support: "\u6700\u8FD1\u8BC1\u636E\u663E\u793A\u9700\u5DE9\u56FA",
      chosen: "\u4F60\u81EA\u9009\u7684\u8303\u56F4"
    };
    function subjectLabel(subject) {
      return SUBJECT_LABELS[subject] ?? subject;
    }
    function courseEditionLabel(input) {
      return `${input.grade}\u5E74\u7EA7${termName(input.term)} \xB7 ${subjectLabel(input.subject)} \xB7 ${input.editionLabel}`;
    }
    function termName(term) {
      if (term === 1) return "\u4E0A\u518C";
      if (term === 2) return "\u4E0B\u518C";
      return `\u7B2C${term}\u5B66\u671F`;
    }
    function formatDateTime(timestamp) {
      if (timestamp === null) return "\u2014";
      const date = new Date(timestamp);
      if (Number.isNaN(date.getTime())) return timestamp;
      try {
        return new Intl.DateTimeFormat("zh-CN", {
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
          hour: "2-digit",
          minute: "2-digit"
        }).format(date);
      } catch {
        return timestamp;
      }
    }
    function positionLabel(activityId, cursor) {
      if (activityId === null && cursor === null) return "\u672A\u8BB0\u5F55\u4E0A\u6B21\u4F4D\u7F6E";
      const parts = [];
      if (activityId !== null) parts.push(`\u6D3B\u52A8 ${activityId}`);
      if (cursor !== null) parts.push(`\u4F4D\u7F6E ${cursor}`);
      return parts.join(" \xB7 ");
    }
    function safeErrorCode(code) {
      if (/^[A-Za-z0-9_.-]{1,32}$/.test(code)) return code;
      return "UNKNOWN";
    }
    
    // education/client/shell/src/errors.ts
    var SERVICE_ERROR_COPY = {
      INVALID_INPUT: {
        title: "\u8F93\u5165\u9700\u8981\u4FEE\u6539",
        detail: "\u63D0\u4EA4\u7684\u5185\u5BB9\u683C\u5F0F\u4E0D\u6B63\u786E\uFF0C\u8BF7\u68C0\u67E5\u540E\u518D\u8BD5\u3002",
        action: "\u8FD4\u56DE\u4FEE\u6539"
      },
      VALIDATION_FAILED: {
        title: "\u5185\u5BB9\u6CA1\u6709\u901A\u8FC7\u68C0\u67E5",
        detail: "\u8FD9\u6B21\u64CD\u4F5C\u7684\u6570\u636E\u4E0D\u5B8C\u6574\u6216\u4E0E\u5F53\u524D\u5185\u5BB9\u7248\u672C\u4E0D\u5339\u914D\u3002",
        action: "\u68C0\u67E5\u540E\u91CD\u8BD5"
      },
      NOT_FOUND: {
        title: "\u627E\u4E0D\u5230\u8FD9\u9879\u5185\u5BB9",
        detail: "\u5B83\u53EF\u80FD\u5DF2\u88AB\u79FB\u52A8\u3001\u5220\u9664\u6216\u4E0D\u5C5E\u4E8E\u5F53\u524D\u6559\u6750\u7248\u672C\u3002",
        action: "\u8FD4\u56DE\u4E0A\u4E00\u9875"
      },
      DUPLICATE_REQUEST: {
        title: "\u8FD9\u6B21\u64CD\u4F5C\u5DF2\u7ECF\u8BB0\u5F55",
        detail: "\u91CD\u590D\u63D0\u4EA4\u4E0D\u4F1A\u518D\u6B21\u8BA1\u6570\uFF0C\u53EF\u4EE5\u7EE7\u7EED\u67E5\u770B\u5DF2\u6709\u8BB0\u5F55\u3002",
        action: "\u67E5\u770B\u8BB0\u5F55"
      },
      STALE_REVISION: {
        title: "\u5185\u5BB9\u5DF2\u7ECF\u6709\u4E86\u66F4\u65B0",
        detail: "\u4F60\u770B\u5230\u7684\u7248\u672C\u4E0D\u662F\u6700\u65B0\u7684\uFF1B\u4E3A\u907F\u514D\u4E32\u5199\uFF0C\u672C\u6B21\u64CD\u4F5C\u6CA1\u6709\u7EE7\u7EED\u3002",
        action: "\u5237\u65B0\u540E\u91CD\u8BD5"
      },
      CONFLICT: {
        title: "\u6682\u65F6\u4E0D\u80FD\u540C\u65F6\u8FDB\u884C",
        detail: "\u53E6\u4E00\u4E2A\u64CD\u4F5C\u6B63\u5728\u5199\u5165\u672C\u5730\u8BB0\u5F55\uFF0C\u8BF7\u7A0D\u540E\u518D\u8BD5\u3002",
        action: "\u91CD\u8BD5"
      },
      CANCELLED: {
        title: "\u64CD\u4F5C\u5DF2\u53D6\u6D88",
        detail: "\u5DF2\u4FDD\u5B58\u7684\u5185\u5BB9\u4E0D\u4F1A\u88AB\u5220\u9664\uFF1B\u672A\u5B8C\u6210\u7684\u90E8\u5206\u6CA1\u6709\u8BB0\u4E3A\u4F5C\u7B54\u6216\u5B8C\u6210\u3002",
        action: "\u8FD4\u56DE"
      },
      TIMEOUT: {
        title: "\u7B49\u5F85\u8D85\u65F6",
        detail: "\u8FD9\u6B21\u8BF7\u6C42\u6CA1\u6709\u5728\u9884\u671F\u65F6\u95F4\u5185\u5B8C\u6210\uFF0C\u8F93\u5165\u4ECD\u4FDD\u7559\u5728\u672C\u9875\u3002",
        action: "\u91CD\u8BD5"
      },
      UNAVAILABLE: {
        title: "\u670D\u52A1\u6682\u65F6\u4E0D\u53EF\u7528",
        detail: "\u672C\u5730\u5DF2\u6709\u6750\u6599\u4E0E\u8BB0\u5F55\u4ECD\u53EF\u67E5\u770B\uFF1B\u4E91\u670D\u52A1\u6062\u590D\u540E\u53EF\u518D\u8BD5\u3002",
        action: "\u7A0D\u540E\u91CD\u8BD5"
      },
      UNAUTHORIZED: {
        title: "\u6CA1\u6709\u5B8C\u6210\u6388\u6743",
        detail: "\u8FD9\u9879\u64CD\u4F5C\u9700\u8981\u6709\u6548\u7684\u6A21\u578B\u670D\u52A1\u6388\u6743\uFF1B\u672C\u5730\u5185\u5BB9\u4ECD\u7136\u53EF\u8BFB\u3002",
        action: "\u67E5\u770B\u8D26\u6237\u72B6\u6001"
      },
      QUOTA_EXCEEDED: {
        title: "\u6A21\u578B\u670D\u52A1\u989D\u5EA6\u4E0D\u8DB3",
        detail: "\u672C\u6B21\u6CA1\u6709\u4EA7\u751F\u6A21\u578B\u56DE\u590D\uFF1B\u5DF2\u4FDD\u5B58\u7684\u672C\u5730\u8BB0\u5F55\u4E0D\u53D7\u5F71\u54CD\u3002",
        action: "\u67E5\u770B\u8D26\u6237\u72B6\u6001"
      },
      UNSUPPORTED: {
        title: "\u5F53\u524D\u670D\u52A1\u4E0D\u652F\u6301\u8FD9\u9879\u64CD\u4F5C",
        detail: "\u53EF\u4EE5\u6539\u7528\u6587\u5B57\u4F5C\u7B54\u6216\u67E5\u770B\u672C\u5730\u6750\u6599\uFF0C\u4E0D\u9700\u8981\u91CD\u590D\u63D0\u4EA4\u3002",
        action: "\u6539\u7528\u5176\u4ED6\u65B9\u5F0F"
      },
      NOT_IMPLEMENTED: {
        title: "\u8FD9\u9879\u529F\u80FD\u8FD8\u6CA1\u6709\u63A5\u5165",
        detail: "\u5F53\u524D\u7248\u672C\u8FD8\u4E0D\u80FD\u5B8C\u6210\u8FD9\u4E00\u6B65\uFF1B\u5DF2\u6709\u5185\u5BB9\u4ECD\u53EF\u67E5\u770B\u3002",
        action: "\u8FD4\u56DE"
      },
      CONTRACT_REJECTED: {
        title: "\u8FD9\u6B21\u64CD\u4F5C\u88AB\u5B89\u5168\u68C0\u67E5\u62D2\u7EDD",
        detail: "\u8BF7\u6C42\u4E0D\u7B26\u5408\u5F53\u524D\u5185\u5BB9\u6216\u6570\u636E\u89C4\u5219\uFF0C\u672C\u5730\u8BB0\u5F55\u6CA1\u6709\u88AB\u4FEE\u6539\u3002",
        action: "\u8FD4\u56DE\u68C0\u67E5"
      },
      STORAGE_FAILED: {
        title: "\u672C\u5730\u4FDD\u5B58\u6CA1\u6709\u5B8C\u6210",
        detail: "\u8FD9\u6B21\u4FEE\u6539\u5C1A\u672A\u5199\u5165\u672C\u673A\uFF0C\u8BF7\u4E0D\u8981\u628A\u5F53\u524D\u5185\u5BB9\u5F53\u4F5C\u5DF2\u4FDD\u5B58\u3002",
        action: "\u91CD\u8BD5\u4FDD\u5B58"
      }
    };
    function describeServiceError(error) {
      const copy = SERVICE_ERROR_COPY[error.code];
      const code = safeErrorCode(error.code);
      if (copy === void 0) {
        return {
          code,
          title: "\u64CD\u4F5C\u6CA1\u6709\u5B8C\u6210",
          detail: "\u53D1\u751F\u4E86\u672A\u5F52\u7C7B\u7684\u9519\u8BEF\u3002\u53EF\u4EE5\u91CD\u8BD5\uFF1B\u5982\u679C\u53CD\u590D\u51FA\u73B0\uFF0C\u8BF7\u8FD4\u56DE\u5E76\u67E5\u770B\u672C\u5730\u8BB0\u5F55\u3002",
          action: "\u91CD\u8BD5",
          retryable: error.retryable,
          known: false
        };
      }
      return {
        code,
        title: copy.title,
        detail: copy.detail,
        action: error.retryable ? copy.action : "\u8FD4\u56DE",
        retryable: error.retryable,
        known: true
      };
    }
    function renderErrorBanner(error, options = {}) {
      const described = describeServiceError(error);
      const headingTag = options.headingLevel ?? "h2";
      const banner = h(
        "div",
        {
          class: "edu-notice edu-notice--danger",
          role: "alert",
          "data-edu-error": described.code,
          "aria-live": "assertive"
        },
        h(headingTag, { class: "edu-notice__title" }, described.title),
        h("p", { class: "edu-notice__body" }, described.detail),
        h("p", { class: "edu-notice__body" }, `\u9519\u8BEF\u4EE3\u7801\uFF1A${described.code}`)
      );
      const actions = h("div", { class: "edu-notice__actions" });
      if (described.retryable && options.onRetry !== void 0) {
        actions.append(
          h(
            "button",
            { type: "button", class: "edu-button edu-button--primary edu-button--small", onclick: options.onRetry },
            options.retryLabel ?? described.action
          )
        );
      }
      if (options.onBack !== void 0) {
        actions.append(
          h(
            "button",
            { type: "button", class: "edu-button edu-button--small", onclick: options.onBack },
            options.backLabel ?? "\u8FD4\u56DE"
          )
        );
      }
      if (actions.childNodes.length > 0) banner.append(actions);
      return banner;
    }
    
    // education/client/shell/src/contracts.ts
    var SHELL_SLOT_NAMES = [
      "library:content",
      "library:import",
      "map:content",
      "map:details",
      "study:activity",
      "study:feedback",
      "study:visuals"
    ];
    
    // education/client/shell/src/key-port.ts
    var MIN_KEY_LENGTH = 12;
    var MAX_KEY_LENGTH = 200;
    var KEY_PATTERN = /^sk-[A-Za-z0-9_-]+$/;
    function validateApiKey(value) {
      const key = value.trim();
      if (key.length === 0) {
        return failure("format", "INVALID_INPUT", "\u8BF7\u8F93\u5165\u6A21\u578B API Key\u3002", false);
      }
      if (!KEY_PATTERN.test(key) || key.length < MIN_KEY_LENGTH || key.length > MAX_KEY_LENGTH) {
        return failure(
          "format",
          "INVALID_INPUT",
          "\u683C\u5F0F\u4E0D\u6B63\u786E\uFF1AKey \u5E94\u4EE5 sk- \u5F00\u5934\uFF0C\u957F\u5EA6\u5728\u5408\u7406\u8303\u56F4\u5185\uFF0C\u53EA\u5305\u542B\u5B57\u6BCD\u3001\u6570\u5B57\u3001_ \u6216 -\u3002",
          false
        );
      }
      return null;
    }
    function maskedKeySuffix(value) {
      const key = value.trim();
      return key.length >= 4 ? key.slice(-4) : null;
    }
    function createUnsupportedAuthKeyPort() {
      const unavailable = () => ({
        ok: false,
        error: failure(
          "not_implemented",
          "UNSUPPORTED",
          "\u63A5\u53E3\u672A\u5B9E\u73B0\uFF1A\u672C\u673A\u5BBF\u4E3B\u5C1A\u672A\u63D0\u4F9B /edu/api/auth/key\u3002Key \u6CA1\u6709\u4FDD\u5B58\uFF0C\u5F53\u524D\u4ECD\u4E3A\u672C\u5730\u6A21\u5F0F\u3002",
          false
        )
      });
      return {
        async loadStatus() {
          return unavailable();
        },
        async save() {
          return unavailable();
        },
        async clear() {
          return unavailable();
        }
      };
    }
    function createHttpAuthKeyPort(options = {}) {
      const fetchImpl = options.fetchImpl ?? globalThis.fetch;
      const endpoint = "/edu/api/auth/key";
      async function send(method, body) {
        if (typeof fetchImpl !== "function") {
          return { ok: false, error: failure("network", "UNAVAILABLE", "\u5F53\u524D\u73AF\u5883\u6CA1\u6709\u53EF\u7528\u7684\u7F51\u7EDC\u63A5\u53E3\u3002", true) };
        }
        let response;
        try {
          response = await fetchImpl(endpoint, {
            method,
            credentials: "same-origin",
            headers: body === void 0 ? { accept: "application/json" } : { accept: "application/json", "content-type": "application/json" },
            ...body === void 0 ? {} : { body: JSON.stringify(body) }
          });
        } catch {
          return {
            ok: false,
            error: failure("network", "UNAVAILABLE", "\u7F51\u7EDC\u5931\u8D25\uFF1A\u65E0\u6CD5\u8FDE\u63A5\u672C\u673A\u5BBF\u4E3B\u7AEF\u70B9\uFF1BKey \u6CA1\u6709\u4FDD\u5B58\u3002", true)
          };
        }
        let parsed = null;
        try {
          parsed = await response.json();
        } catch {
          parsed = null;
        }
        if (response.status === 404) return { ok: false, error: notImplemented() };
        if (response.status === 400 || response.status === 422) {
          return { ok: false, error: failure("format", "INVALID_INPUT", "\u683C\u5F0F\u4E0D\u6B63\u786E\uFF1A\u5BBF\u4E3B\u6CA1\u6709\u63A5\u53D7\u8FD9\u4E2A Key\u3002", false) };
        }
        if (response.status === 401 || response.status === 403) {
          return {
            ok: false,
            error: failure("auth", "UNAUTHORIZED", "\u9274\u6743\u5931\u8D25\uFF1AKey \u672A\u88AB\u6A21\u578B\u670D\u52A1\u63A5\u53D7\uFF1B\u8BF7\u68C0\u67E5\u540E\u91CD\u8BD5\u3002", false)
          };
        }
        if (response.status === 429) {
          return {
            ok: false,
            error: failure("quota", "UNAVAILABLE", "\u914D\u989D\u4E0D\u8DB3\u6216\u8BF7\u6C42\u53D7\u9650\uFF1B\u8BF7\u66F4\u6362 Key \u6216\u7A0D\u540E\u91CD\u8BD5\u3002", true)
          };
        }
        if (response.status >= 500) {
          return {
            ok: false,
            error: failure("network", "UNAVAILABLE", "\u7F51\u7EDC\u6216\u5BBF\u4E3B\u670D\u52A1\u6682\u65F6\u4E0D\u53EF\u7528\uFF1BKey \u6CA1\u6709\u4FDD\u5B58\u3002", true)
          };
        }
        if (!response.ok) {
          return {
            ok: false,
            error: failure("unknown", "UNSUPPORTED", "\u4FDD\u5B58\u6CA1\u6709\u5B8C\u6210\uFF1BKey \u6CA1\u6709\u4FDD\u5B58\u3002", false)
          };
        }
        const record = parsed !== null && typeof parsed === "object" ? parsed : {};
        if (record["ok"] === false) {
          return { ok: false, error: hostFailure(record["error"]) };
        }
        const data = record["data"] !== null && typeof record["data"] === "object" ? record["data"] : record;
        const configured = data["configured"] === true || data["status"] === "configured" || record["status"] === "configured";
        if (!configured) {
          return {
            ok: false,
            error: failure("unknown", "UNSUPPORTED", "\u5BBF\u4E3B\u6CA1\u6709\u786E\u8BA4 Key \u5DF2\u4FDD\u5B58\uFF1B\u754C\u9762\u4E0D\u4F1A\u5047\u88C5\u6210\u529F\u3002", false)
          };
        }
        const suffix = typeof data["maskedSuffix"] === "string" ? data["maskedSuffix"] : null;
        const checkedAt = typeof data["lastCheckedAt"] === "string" ? data["lastCheckedAt"] : null;
        return { ok: true, data: { configured: true, maskedSuffix: suffix, lastCheckedAt: checkedAt } };
      }
      return {
        async loadStatus() {
          const result = await send("GET");
          if (!result.ok) return result;
          const data = result.data;
          return {
            ok: true,
            data: {
              configured: data.configured === true,
              maskedSuffix: typeof data.maskedSuffix === "string" ? data.maskedSuffix : null,
              lastCheckedAt: typeof data.lastCheckedAt === "string" ? data.lastCheckedAt : null
            }
          };
        },
        async save(apiKey) {
          const result = await send("POST", { apiKey });
          if (!result.ok) return result;
          const data = result.data;
          return {
            ok: true,
            data: {
              configured: true,
              maskedSuffix: typeof data.maskedSuffix === "string" ? data.maskedSuffix : null
            }
          };
        },
        async clear() {
          const result = await send("DELETE");
          if (!result.ok) return result;
          return { ok: true, data: { configured: false } };
        }
      };
    }
    function failure(category, code, message, retryable) {
      return { code, message, retryable, category };
    }
    function notImplemented() {
      return failure(
        "not_implemented",
        "UNSUPPORTED",
        "\u63A5\u53E3\u672A\u5B9E\u73B0\uFF1A\u672C\u673A\u5BBF\u4E3B\u5C1A\u672A\u63D0\u4F9B /edu/api/auth/key\u3002Key \u6CA1\u6709\u4FDD\u5B58\uFF0C\u5F53\u524D\u4ECD\u4E3A\u672C\u5730\u6A21\u5F0F\u3002",
        false
      );
    }
    function hostFailure(value) {
      const record = value !== null && typeof value === "object" ? value : {};
      const rawCategory = record["category"];
      const category = rawCategory === "format" || rawCategory === "auth" || rawCategory === "network" || rawCategory === "quota" || rawCategory === "not_implemented" ? rawCategory : record["code"] === "UNAUTHORIZED" ? "auth" : record["code"] === "INVALID_INPUT" ? "format" : "unknown";
      return failure(
        category,
        typeof record["code"] === "string" ? record["code"] : "UNSUPPORTED",
        typeof record["message"] === "string" && record["message"].trim().length > 0 ? record["message"] : "\u4FDD\u5B58\u6CA1\u6709\u5B8C\u6210\uFF1BKey \u6CA1\u6709\u4FDD\u5B58\u3002",
        record["retryable"] === true
      );
    }
    
    // education/client/shell/src/components/button.ts
    var TONE_CLASS = {
      default: "",
      primary: "edu-button--primary",
      danger: "edu-button--danger",
      ghost: "edu-button--ghost",
      "danger-ghost": "edu-button--danger-ghost"
    };
    function button(label, onClick, options = {}) {
      const classes = ["edu-button"];
      const toneClass = TONE_CLASS[options.tone ?? "default"];
      if (toneClass.length > 0) classes.push(toneClass);
      if (options.small === true) classes.push("edu-button--small");
      return h(
        "button",
        {
          type: "button",
          class: classes.join(" "),
          onclick: onClick,
          disabled: options.disabled,
          "aria-label": options.ariaLabel,
          title: options.title,
          "data-action": options.dataAction
        },
        label
      );
    }
    
    // education/client/shell/src/components/context-bar.ts
    var SAVE_LABELS = {
      saved: "\u5DF2\u4FDD\u5B58",
      saving: "\u6B63\u5728\u4FDD\u5B58",
      failed: "\u5C1A\u672A\u4FDD\u5B58",
      unknown: "\u4FDD\u5B58\u72B6\u6001\u672A\u77E5"
    };
    function renderContextBar(input) {
      const bar = h("div", {
        class: "edu-context",
        "data-testid": "edu-context-bar",
        "aria-label": "\u5F53\u524D\u5B66\u4E60\u4E0A\u4E0B\u6587"
      });
      const item = (label, value, testId) => h(
        "span",
        { class: "edu-context__item", "data-context-item": testId },
        h("span", { class: "edu-context__label" }, label),
        h("span", { class: "edu-context__value" }, value)
      );
      bar.append(
        item("\u6559\u6750", input.courseEdition ?? "\u5C1A\u672A\u9009\u62E9\u6559\u6750", "course-edition"),
        item("\u5185\u5BB9\u5305", input.packVersion === null ? "\u2014" : `\u7248\u672C ${input.packVersion}`, "pack-version"),
        item("\u5F53\u524D\u6982\u5FF5", input.concept ?? "\u5C1A\u672A\u9009\u62E9\u6982\u5FF5", "concept"),
        item("\u6A21\u5F0F", input.mode ?? "\u672A\u5F00\u59CB", "mode"),
        h(
          "span",
          { class: "edu-context__item", "data-context-item": "save-state" },
          h("span", { class: "edu-context__label" }, "\u672C\u5730\u4FDD\u5B58"),
          h(
            "span",
            {
              class: "edu-context__value edu-save-status",
              "data-state": input.saveState,
              "aria-live": "polite"
            },
            SAVE_LABELS[input.saveState]
          )
        ),
        item("\u8FD4\u56DE\u4F4D\u7F6E", input.backTarget ?? "\u9996\u9875", "back-position")
      );
      const toolbar = h("span", { class: "edu-context__toolbar" });
      if (input.backTarget !== null && input.onBack !== void 0) {
        toolbar.append(
          button(`\u8FD4\u56DE${input.backTarget}`, input.onBack, { small: true, dataAction: "context-back" })
        );
      }
      if (toolbar.childNodes.length > 0) bar.append(toolbar);
      return bar;
    }
    
    // education/client/shell/src/components/states.ts
    function emptyState(options) {
      const element = h(
        "div",
        { class: "edu-state", "data-edu-state": "empty", "data-testid": options.testId ?? "edu-empty-state" },
        h("h2", { class: "edu-state__title" }, options.title),
        h("p", { class: "edu-state__body" }, options.body)
      );
      if ((options.actions ?? []).length > 0) {
        const actions = h("div", { class: "edu-state__actions" });
        for (const action of options.actions ?? []) {
          actions.append(button(action.label, action.onClick, { tone: action.tone ?? "default" }));
        }
        element.append(actions);
      }
      return element;
    }
    function loadingState(options) {
      const element = h(
        "div",
        {
          class: "edu-state",
          role: "status",
          "aria-live": "polite",
          "data-edu-state": "loading",
          "data-testid": "edu-loading-state"
        },
        h(
          "div",
          { class: "edu-loading" },
          h("span", { class: "edu-loading__mark", "aria-hidden": "true" }),
          h("h2", { class: "edu-state__title" }, options.title)
        ),
        options.body !== void 0 ? h("p", { class: "edu-state__body" }, options.body) : null
      );
      if (options.onCancel !== void 0) {
        element.append(
          h("div", { class: "edu-state__actions" }, button("\u53D6\u6D88\u5E76\u8FD4\u56DE", options.onCancel, { tone: "default" }))
        );
      }
      return element;
    }
    function notice(options) {
      const element = h(
        "div",
        {
          class: `edu-notice edu-notice--${options.tone ?? "info"}`,
          role: options.role ?? "status",
          "data-testid": options.testId
        },
        h("p", { class: "edu-notice__title" }, options.title),
        options.body !== void 0 ? h("p", { class: "edu-notice__body" }, options.body) : null
      );
      if ((options.actions ?? []).length > 0) {
        const actions = h("div", { class: "edu-notice__actions" });
        for (const action of options.actions ?? []) {
          actions.append(button(action.label, action.onClick, { tone: action.tone ?? "default", small: true }));
        }
        element.append(actions);
      }
      return element;
    }
    function offlineNotice(onRetry) {
      return h(
        "div",
        { class: "edu-offline-bar", role: "status", "data-edu-state": "offline", "data-testid": "edu-offline" },
        h("span", {}, "\u5F53\u524D\u79BB\u7EBF"),
        h(
          "span",
          {},
          "\u5DF2\u6709\u6750\u6599\u548C\u8BB0\u5F55\u4ECD\u53EF\u67E5\u770B\uFF1B\u4E91\u7AEF\u53CD\u9988\u6682\u4E0D\u53EF\u7528\uFF0C\u8349\u7A3F\u4FDD\u5B58\u5728\u672C\u673A\uFF0C\u6062\u590D\u7F51\u7EDC\u540E\u53EF\u624B\u52A8\u91CD\u8BD5\u3002"
        ),
        button("\u91CD\u8BD5\u8FDE\u63A5", onRetry, { tone: "default", small: true })
      );
    }
    function saveFailedNotice(options) {
      return notice({
        tone: "danger",
        role: "alert",
        title: "\u5C1A\u672A\u4FDD\u5B58",
        body: "\u672C\u6B21\u4FEE\u6539\u8FD8\u6CA1\u6709\u5199\u5165\u672C\u673A\u3002\u79BB\u5F00\u524D\u8BF7\u91CD\u8BD5\u4FDD\u5B58\u6216\u590D\u5236\u6587\u5B57\uFF1B\u754C\u9762\u4E0D\u4F1A\u663E\u793A\u4E3A\u5DF2\u4FDD\u5B58\u3002",
        testId: "edu-save-failed",
        actions: [
          { label: "\u91CD\u8BD5\u4FDD\u5B58", onClick: options.onRetry, tone: "primary" },
          { label: "\u590D\u5236\u6587\u5B57", onClick: options.onCopy }
        ]
      });
    }
    function fixtureBadge(text = "\u6F14\u793A\u6570\u636E\uFF08fixture\uFF09") {
      return h(
        "span",
        { class: "edu-fixture-badge", "data-edu-fixture": "true", title: "\u5F53\u524D\u9875\u9762\u4E0D\u662F\u771F\u5B9E API \u7ED3\u679C" },
        h("span", { "aria-hidden": "true" }, "\u25C6"),
        h("span", {}, text)
      );
    }
    
    // education/client/shell/src/components/status-chip.ts
    function statusChip(label, tone = "neutral", options = {}) {
      return h(
        "span",
        {
          class: "edu-chip",
          "data-tone": tone,
          "data-status-label": label,
          "data-testid": options.testId,
          title: options.detail
        },
        h("span", { class: "edu-chip__dot", "aria-hidden": "true" }),
        h("span", {}, label)
      );
    }
    
    // education/client/shell/src/pages/registry.ts
    var PageRegistryError = class extends Error {
      constructor(message) {
        super(message);
        this.name = "PageRegistryError";
      }
    };
    var EducationPageRegistry = class {
      pages = /* @__PURE__ */ new Map();
      byPath = /* @__PURE__ */ new Map();
      register(page) {
        if (page.id.trim().length === 0) throw new PageRegistryError("page id must not be empty");
        if (page.title.trim().length === 0) throw new PageRegistryError(`page ${page.id} title must not be empty`);
        if (!page.path.startsWith("/")) {
          throw new PageRegistryError(`page ${page.id} path must start with "/"`);
        }
        const existingId = this.pages.get(page.id) ?? null;
        const existingPath = this.byPath.get(page.path) ?? null;
        if (existingId !== null && existingId !== page) {
          if (existingId.fallback === true && page.fallback !== true) {
            this.pages.delete(existingId.id);
            this.byPath.delete(existingId.path);
          } else {
            throw new PageRegistryError(`duplicate page id: ${page.id}`);
          }
        }
        if (existingPath !== null && existingPath !== page) {
          if (existingPath.fallback === true && page.fallback !== true) {
            this.pages.delete(existingPath.id);
            this.byPath.delete(existingPath.path);
          } else {
            throw new PageRegistryError(`duplicate page path: ${page.path}`);
          }
        }
        this.pages.set(page.id, page);
        this.byPath.set(page.path, page);
      }
      list() {
        return [...this.pages.values()];
      }
      resolve(path) {
        return this.byPath.get(path);
      }
      get(id) {
        return this.pages.get(id);
      }
      async mount(id, context) {
        const page = this.pages.get(id);
        if (page === void 0) throw new PageRegistryError(`unknown page: ${id}`);
        await page.mount(context);
      }
      async unmount(id) {
        const page = this.pages.get(id);
        if (page === void 0) throw new PageRegistryError(`unknown page: ${id}`);
        await page.unmount();
      }
    };
    
    // education/client/shell/src/components/confirm-dialog.ts
    var dialogCounter = 0;
    var ConfirmDialog = class {
      element;
      options;
      titleId;
      cancelButton;
      confirmButton;
      trigger = null;
      isOpen = false;
      constructor(options) {
        this.options = options;
        dialogCounter += 1;
        this.titleId = `edu-dialog-title-${dialogCounter}`;
        const backdrop = h("div", {
          class: "edu-dialog-backdrop",
          hidden: true,
          "data-edu-dialog": options.tone === "danger" ? "danger" : "default"
        });
        const dialog = h("div", {
          class: "edu-dialog",
          role: "dialog",
          "aria-modal": "true",
          "aria-labelledby": this.titleId,
          tabindex: -1
        });
        dialog.append(
          h("h2", { class: "edu-dialog__title", id: this.titleId }, options.title),
          h(
            "ul",
            { class: "edu-dialog__impact" },
            ...options.impact.map((line) => h("li", {}, line))
          )
        );
        if (options.acknowledgement !== void 0) {
          const checkboxId = `${this.titleId}-ack`;
          const checkbox = h("input", { type: "checkbox", id: checkboxId });
          dialog.append(
            h(
              "label",
              { class: "edu-checkbox", for: checkboxId },
              checkbox,
              h("span", {}, options.acknowledgement)
            )
          );
          this.confirmButton = button(options.confirmLabel, () => this.confirm(), {
            tone: options.tone === "danger" ? "danger" : "primary",
            disabled: true,
            dataAction: "confirm"
          });
          checkbox.addEventListener("change", () => {
            this.confirmButton.disabled = !checkbox.checked;
          });
        } else {
          this.confirmButton = button(options.confirmLabel, () => this.confirm(), {
            tone: options.tone === "danger" ? "danger" : "primary",
            dataAction: "confirm"
          });
        }
        this.cancelButton = button(options.cancelLabel ?? "\u53D6\u6D88", () => this.close(true), {
          dataAction: "cancel"
        });
        dialog.append(h("div", { class: "edu-dialog__actions" }, this.cancelButton, this.confirmButton));
        backdrop.append(dialog);
        backdrop.addEventListener("keydown", (event) => this.onKeydown(event));
        this.element = backdrop;
      }
      open(trigger, parent) {
        if (this.isOpen) return;
        this.isOpen = true;
        this.trigger = trigger;
        if (this.element.parentElement !== parent) parent.append(this.element);
        this.element.removeAttribute("hidden");
        this.cancelButton.focus();
      }
      close(restoreFocus) {
        if (!this.isOpen) return;
        this.isOpen = false;
        this.element.setAttribute("hidden", "");
        const trigger = this.trigger;
        this.trigger = null;
        if (restoreFocus && trigger !== null && trigger.isConnected) trigger.focus();
      }
      cancel() {
        if (!this.isOpen) return;
        this.close(true);
        this.options.onCancel?.();
      }
      confirm() {
        if (!this.isOpen || this.confirmButton.disabled) return;
        this.close(false);
        this.options.onConfirm();
      }
      get openState() {
        return this.isOpen;
      }
      onKeydown(event) {
        if (event.key === "Escape") {
          event.preventDefault();
          this.cancel();
          return;
        }
        if (event.key !== "Tab") return;
        const focusable = focusableElements(this.element);
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        const active = this.element.ownerDocument.activeElement;
        if (event.shiftKey && (active === first || active === null)) {
          event.preventDefault();
          last.focus();
          return;
        }
        if (!event.shiftKey && active === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    function copyTextFallback(value) {
      try {
        const clipboard = globalThis.navigator.clipboard;
        if (clipboard !== void 0 && typeof clipboard.writeText === "function") {
          void clipboard.writeText(value).catch(() => void 0);
          return "copied";
        }
      } catch {
        return "manual";
      }
      return "manual";
    }
    
    // education/client/shell/src/pages/common.ts
    function definePage(input) {
      let active = false;
      return {
        id: input.id,
        path: input.path,
        title: input.title,
        requiresLearner: input.requiresLearner,
        fallback: input.fallback,
        async mount(context) {
          active = true;
          const container = context.container;
          await input.mount(container, context);
          return void 0;
        },
        async unmount() {
          if (!active) return;
          active = false;
          await input.unmount?.();
        }
      };
    }
    function pageHeading(title, lead) {
      return h(
        "header",
        { class: "edu-page__header" },
        h("h1", { class: "edu-page__title", tabindex: -1 }, title),
        lead !== void 0 ? h("p", { class: "edu-page__lead" }, lead) : null
      );
    }
    function conceptTitle(concepts, conceptId) {
      return concepts.find((concept2) => concept2.id === conceptId)?.title ?? conceptId;
    }
    function learningTone(state) {
      if (state === "completed") return "positive";
      if (state === "in_progress") return "progress";
      return "neutral";
    }
    function understandingTone(state) {
      if (state === "supported") return "positive";
      if (state === "needs_support") return "attention";
      if (state === "developing") return "progress";
      return "neutral";
    }
    
    // education/client/shell/src/pages/account.ts
    function createAccountPage() {
      return definePage({
        id: "shell.account",
        path: "/account",
        title: "\u8D26\u6237\u4E0E\u6A21\u578B\u670D\u52A1",
        requiresLearner: true,
        fallback: true,
        mount(container, context) {
          const api2 = context.services.shell;
          const state = context.services.getState();
          const snapshot = state.snapshot;
          container.append(
            pageHeading(
              "\u8D26\u6237\u4E0E\u6A21\u578B\u670D\u52A1",
              "\u5B66\u4E60\u8EAB\u4EFD\u3001\u6A21\u578B\u8D26\u6237\u4E0E API Key \u662F\u4E09\u5C42\u4E0D\u540C\u7684\u72B6\u6001\u3002\u754C\u9762\u53EA\u663E\u793A\u540E\u7AEF\u8FD4\u56DE\u7684\u53EF\u7528\u6027\uFF0C\u4E0D\u63A5\u6536\u6216\u5C55\u793A\u4EFB\u4F55\u51ED\u636E\u5185\u5BB9\u3002"
            )
          );
          if (snapshot === null) {
            container.append(
              notice({
                tone: "warning",
                title: "\u72B6\u6001\u8FD8\u6CA1\u6709\u8BFB\u5230",
                body: "\u53EF\u4EE5\u91CD\u8BD5\uFF1B\u672C\u5730\u5185\u5BB9\u4E0E\u8BB0\u5F55\u4E0D\u53D7\u5F71\u54CD\u3002",
                actions: [{ label: "\u91CD\u8BD5", onClick: () => void api2.refresh() }]
              })
            );
            return;
          }
          container.append(
            renderContextBar({
              courseEdition: courseEditionLabel(snapshot.courseEdition),
              packVersion: snapshot.pack.version,
              concept: null,
              mode: null,
              saveState: state.saveState,
              fixture: snapshot.fixture,
              backTarget: state.backTarget?.label ?? null,
              onBack: state.backTarget === null ? void 0 : () => void api2.back()
            })
          );
          container.append(
            h(
              "section",
              { class: "edu-section", "data-testid": "account-identity" },
              h("h2", { class: "edu-section__title" }, "\u672C\u5730\u5B66\u4E60\u8EAB\u4EFD"),
              h(
                "div",
                { class: "edu-card" },
                statusChip("\u672C\u5730\u533F\u540D\u6863\u6848", "positive"),
                h("p", { class: "edu-card__title" }, snapshot.learner.id),
                h(
                  "p",
                  { class: "edu-card__meta" },
                  `\u521B\u5EFA\u4E8E ${formatDateTime(snapshot.learner.createdAt)}\u3002\u5B66\u4E60\u8BB0\u5F55\u53EA\u5C5E\u4E8E\u8FD9\u4E2A\u672C\u673A\u8EAB\u4EFD\uFF1B\u6A21\u578B\u8D26\u53F7\u4E0D\u662F\u5B66\u4E60\u8EAB\u4EFD\u3002`
                )
              )
            )
          );
          const account = snapshot.auth.account;
          const accountUnavailable = account.status !== "available";
          container.append(
            h(
              "section",
              { class: "edu-section", "data-testid": "account-model-account" },
              h("h2", { class: "edu-section__title" }, "\u6A21\u578B\u8D26\u6237\uFF08\u5E73\u53F0\u6388\u6743\uFF09"),
              h(
                "div",
                { class: "edu-card" },
                statusChip(accountUnavailable ? "\u4E0D\u53EF\u7528" : "\u53EF\u7528", accountUnavailable ? "neutral" : "positive"),
                h(
                  "p",
                  { class: "edu-card__meta" },
                  accountUnavailable ? "\u672C\u4EA7\u54C1\u7EBF\u4E0D\u4F7F\u7528\u5E73\u53F0\u8D26\u6237\u6388\u6743\uFF08\u7528\u6237\u5DF2\u660E\u786E\u8BE5\u8DEF\u7EBF\u4E0D\u5141\u8BB8\uFF09\u3002\u56E0\u6B64\u8FD9\u91CC\u4E0D\u63D0\u4F9B\u767B\u5F55\u3001\u9000\u51FA\u6216\u6388\u6743\u5165\u53E3\uFF0C\u4E5F\u4E0D\u628A API Key \u663E\u793A\u6210\u8D26\u6237\u6388\u6743\u6210\u529F\u3002" : `\u8D26\u6237\u6388\u6743\u53EF\u7528\uFF1B\u6700\u540E\u68C0\u67E5\uFF1A${formatDateTime(account.lastCheckedAt)}\u3002`
                ),
                h(
                  "p",
                  { class: "edu-muted", "data-testid": "account-route-note" },
                  "\u8D26\u6237\u767B\u5F55\u3001\u53D6\u6D88\u3001\u5931\u8D25\u4E0E\u9000\u51FA\u72B6\u6001\u7531\u540E\u7AEF\u8FD4\u56DE\uFF1B\u5BA2\u6237\u7AEF\u4E0D\u81EA\u884C\u88C1\u526A\u6743\u9650\uFF0C\u4E5F\u4E0D\u7528\u9690\u85CF\u6309\u94AE\u4EE3\u66FF\u540E\u7AEF\u62D2\u7EDD\u3002"
                )
              )
            )
          );
          const apiKey = snapshot.auth.apiKey;
          let keyConfigured = apiKey.status === "available" || state.keyStatus === "configured";
          let keySuffix = state.keySuffix;
          const keySection = h(
            "section",
            { class: "edu-section", "data-testid": "account-api-key" },
            h("h2", { class: "edu-section__title" }, "API Key\uFF08\u6A21\u578B\u670D\u52A1\u914D\u7F6E\uFF09")
          );
          const keyCard = h("div", { class: "edu-card" });
          const keyStatusLine = h("div", {
            class: "edu-inline-actions",
            "data-testid": "account-key-status",
            role: "status",
            "aria-live": "polite"
          });
          const keyStatusText = h("p", {
            class: "edu-card__meta",
            "data-testid": "account-key-masked"
          });
          const keyFeedback = h("div", { "data-testid": "account-key-feedback" });
          const keyInput = h("input", {
            type: "password",
            id: "account-key-input",
            class: "edu-input",
            "aria-label": "\u6A21\u578B API Key",
            placeholder: "sk-\u2026",
            autocomplete: "off",
            autocapitalize: "off",
            spellcheck: false,
            "data-testid": "account-key-input"
          });
          keyInput.addEventListener("keydown", (event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              saveButton.click();
            }
          });
          const saveButton = button("\u4FDD\u5B58 Key", () => void saveKey(), {
            tone: "primary",
            small: true,
            dataAction: "save-key"
          });
          const clearButton = button("\u6E05\u9664 Key", () => openClearDialog(), {
            small: true,
            dataAction: "clear-key"
          });
          const clearDialog = new ConfirmDialog({
            title: "\u6E05\u9664\u6A21\u578B API Key\uFF1F",
            impact: [
              "\u6E05\u9664\u540E\u56DE\u5230\u672C\u5730\u6A21\u5F0F\uFF1A\u6559\u6750\u3001\u5730\u56FE\u3001\u8BB0\u5F55\u548C\u8349\u7A3F\u4ECD\u53EF\u8BFB\u3002",
              "\u4E91\u63A8\u7406\u4E0E\u6A21\u578B\u53CD\u9988\u4F1A\u4E0D\u53EF\u7528\uFF0C\u76F4\u5230\u91CD\u65B0\u914D\u7F6E\u3002",
              "\u4E0D\u4F1A\u5220\u9664\u4EFB\u4F55\u5B66\u4E60\u8BB0\u5F55\u3001\u8BC1\u636E\u6216\u81EA\u8BC4\u3002"
            ],
            confirmLabel: "\u6E05\u9664 Key \u5E76\u56DE\u5230\u672C\u5730\u6A21\u5F0F",
            tone: "danger",
            onConfirm: () => void clearKey()
          });
          const updateKeyState = () => {
            keyStatusLine.replaceChildren(
              statusChip(keyConfigured ? "\u5DF2\u914D\u7F6E" : "\u672A\u914D\u7F6E", keyConfigured ? "positive" : "attention")
            );
            keyStatusText.textContent = keyConfigured ? `\u5DF2\u914D\u7F6E\uFF08****${keySuffix ?? ""}\uFF09\u3002\u754C\u9762\u53EA\u663E\u793A\u8131\u654F\u72B6\u6001\uFF0C\u4E0D\u56DE\u663E\u3001\u4E0D\u590D\u5236\u3001\u4E0D\u5199\u5165\u5B66\u4E60\u8BB0\u5F55\u3002` : "API Key \u672A\u914D\u7F6E\uFF1A\u5F53\u524D\u4E3A\u672C\u5730\u6A21\u5F0F\uFF1B\u53EF\u8BFB\u672C\u5730\u5185\u5BB9\uFF08\u6559\u6750\u3001\u8BB0\u5F55\u548C\u8349\u7A3F\uFF09\uFF0C\u4E91\u63A8\u7406\u4E0D\u53EF\u7528\u3002";
            clearButton.disabled = !keyConfigured;
            saveButton.textContent = keyConfigured ? "\u66F4\u6362 Key" : "\u4FDD\u5B58 Key";
          };
          const showKeyFailure = (error) => {
            keyFeedback.replaceChildren(
              notice({
                tone: error.retryable ? "warning" : "info",
                title: keyErrorTitle(error.category),
                body: `${keyErrorBody(error.category)}${error.retryable ? " \u53EF\u4EE5\u91CD\u8BD5\uFF1BKey \u6CA1\u6709\u4FDD\u5B58\u3002" : ""}`,
                testId: "account-key-error"
              })
            );
          };
          const saveKey = async () => {
            keyFeedback.replaceChildren();
            const raw = keyInput.value.trim();
            keyInput.value = "";
            const invalid = validateApiKey(raw);
            if (invalid !== null) {
              showKeyFailure(invalid);
              return;
            }
            saveButton.disabled = true;
            keyFeedback.replaceChildren(
              h("p", { class: "edu-muted", role: "status" }, "\u6B63\u5728\u4EA4\u7ED9\u672C\u673A\u5BBF\u4E3B\u4FDD\u5B58\u2026")
            );
            try {
              const result = await api2.saveKey(raw);
              if (!result.ok) {
                showKeyFailure(result.error);
                return;
              }
              keyConfigured = true;
              keySuffix = result.data.maskedSuffix ?? maskedKeySuffix(raw);
              updateKeyState();
              keyFeedback.replaceChildren(
                notice({
                  tone: "info",
                  title: "\u5DF2\u4FDD\u5B58\u5230\u672C\u673A\u5BBF\u4E3B",
                  body: "\u5BBF\u4E3B\u5DF2\u786E\u8BA4\u914D\u7F6E\uFF1BKey \u4E0D\u4F1A\u51FA\u73B0\u5728\u9875\u9762\u3001\u65E5\u5FD7\u3001\u5FEB\u7167\u6216 URL \u4E2D\u3002",
                  testId: "account-key-saved"
                })
              );
            } finally {
              saveButton.disabled = false;
            }
          };
          const clearKey = async () => {
            keyFeedback.replaceChildren();
            clearButton.disabled = true;
            const result = await api2.clearKey();
            if (!result.ok) {
              showKeyFailure(result.error);
              clearButton.disabled = !keyConfigured;
              return;
            }
            keyConfigured = false;
            keySuffix = null;
            updateKeyState();
            keyFeedback.replaceChildren(
              notice({
                tone: "info",
                title: "\u5DF2\u56DE\u5230\u672C\u5730\u6A21\u5F0F",
                body: "\u6559\u6750\u3001\u5730\u56FE\u4E0E\u8BB0\u5F55\u4ECD\u53EF\u8BFB\uFF1B\u672A\u914D\u7F6E\u6A21\u578B Key \u65F6\u4E0D\u4F1A\u53D1\u9001\u4E91\u63A8\u7406\u8BF7\u6C42\u3002",
                testId: "account-key-cleared"
              })
            );
          };
          const openClearDialog = () => {
            if (keyConfigured) clearDialog.open(clearButton, keySection);
          };
          updateKeyState();
          keyCard.append(
            keyStatusLine,
            keyStatusText,
            h(
              "p",
              { class: "edu-muted" },
              "\u5BC6\u94A5\u53EA\u4EA4\u7ED9\u672C\u673A\u5BBF\u4E3B\u52A0\u5BC6\u4FDD\u5B58\uFF1B\u5BA2\u6237\u7AEF\u4E0D\u6301\u4E45\u5316\u3001\u4E0D\u5199 localStorage/sessionStorage\uFF0C\u4E5F\u4E0D\u4F1A\u628A Key \u653E\u8FDB URL \u6216\u65E5\u5FD7\u3002"
            ),
            h(
              "div",
              { class: "edu-key-form", "data-testid": "account-key-form" },
              h("label", { class: "edu-field-label", for: "account-key-input" }, "\u6A21\u578B API Key"),
              keyInput,
              h("div", { class: "edu-inline-actions" }, saveButton, clearButton),
              h(
                "p",
                { class: "edu-muted" },
                "\u53EA\u63A5\u53D7\u4EE5 sk- \u5F00\u5934\u7684\u5408\u7406\u957F\u5EA6 Key\uFF1B\u683C\u5F0F\u9519\u8BEF\u3001\u9274\u6743\u5931\u8D25\u3001\u7F51\u7EDC\u5931\u8D25\u3001\u914D\u989D\u4E0D\u8DB3\u4F1A\u5206\u522B\u63D0\u793A\u3002"
              )
            ),
            keyFeedback
          );
          keySection.append(keyCard);
          container.append(keySection);
          void api2.loadKeyStatus().then((result) => {
            if (!result.ok) return;
            keyConfigured = result.data.configured;
            keySuffix = result.data.maskedSuffix;
            updateKeyState();
          });
          const capabilities = snapshot.capabilities;
          container.append(
            h(
              "section",
              { class: "edu-section", "data-testid": "account-runtime" },
              h("h2", { class: "edu-section__title" }, "\u8FD0\u884C\u4E0E\u6A21\u578B\u80FD\u529B"),
              h(
                "div",
                { class: "edu-grid" },
                capabilityCard("DSH \u8FD0\u884C\u5185\u6838", capabilities.dsh.bound ? "\u5DF2\u7ED1\u5B9A" : "\u672A\u7ED1\u5B9A", capabilities.dsh.bound ? "positive" : "attention"),
                capabilityCard("\u6587\u672C\u6A21\u578B", capabilities.model.text ? "\u53EF\u7528" : "\u4E0D\u53EF\u7528", capabilities.model.text ? "positive" : "attention"),
                capabilityCard("\u56FE\u50CF\u6A21\u578B", capabilities.model.image ? "\u53EF\u7528" : "\u4E0D\u53EF\u7528", capabilities.model.image ? "positive" : "attention")
              ),
              h(
                "p",
                { class: "edu-muted" },
                `\u5F53\u524D\u53D7\u63A7\u5B66\u4E60\u5DE5\u5177\uFF1A${capabilities.tools.length} \u9879\uFF1B\u7F51\u7EDC\uFF1A${capabilities.network === "loopback_only" ? "\u4EC5\u672C\u673A\u56DE\u73AF" : "\u4E0D\u53EF\u7528"}\u3002\u7CFB\u7EDF\u7EA7\u6587\u4EF6\u4E0E\u547D\u4EE4\u80FD\u529B\u4E0D\u5C5E\u4E8E\u5B66\u751F\u6743\u9650\u3002`
              )
            )
          );
          container.append(
            h(
              "section",
              { class: "edu-section", "data-testid": "account-display" },
              h("h2", { class: "edu-section__title" }, "\u663E\u793A\u5B57\u53F7"),
              h(
                "p",
                { class: "edu-section__lead" },
                "\u9ED8\u8BA4\u4F7F\u7528 20px \u57FA\u51C6\u5B57\u53F7\uFF1B\u6240\u6709\u5B57\u53F7\u548C\u95F4\u8DDD\u7528 rem\uFF0C\u6D4F\u89C8\u5668\u7F29\u653E\u6216\u7CFB\u7EDF\u5B57\u4F53\u653E\u5927\u540E\u4E3B\u65C5\u7A0B\u4ECD\u53EF\u5B8C\u6210\u3002"
              )
            )
          );
          const displaySection = container.lastElementChild;
          const standardButton = button(
            "\u6807\u51C6\u5B57\u53F7\uFF0820px \u57FA\u51C6\uFF09",
            () => {
              api2.setFontScale("standard");
              updatePressed();
            },
            { small: true, dataAction: "font-standard" }
          );
          const largeButton = button(
            "\u8F83\u5927\u5B57\u53F7",
            () => {
              api2.setFontScale("large");
              updatePressed();
            },
            { small: true, dataAction: "font-large" }
          );
          const updatePressed = () => {
            const current = api2.getState().fontScale;
            standardButton.setAttribute("aria-pressed", String(current === "standard"));
            largeButton.setAttribute("aria-pressed", String(current === "large"));
          };
          updatePressed();
          displaySection.append(h("div", { class: "edu-inline-actions" }, standardButton, largeButton));
          container.append(
            notice({
              tone: "info",
              title: "\u66F4\u6362\u6A21\u578B\u8D26\u53F7\u4E0D\u4F1A\u5220\u9664\u5B66\u60C5",
              body: "\u9000\u51FA\u6216\u66F4\u6362\u6A21\u578B\u8D26\u6237\u3001\u670D\u52A1\u6388\u6743\u5931\u6548\uFF0C\u90FD\u4E0D\u4F1A\u5220\u9664\u672C\u673A\u6559\u6750\u3001\u6D3B\u52A8\u3001\u8BC1\u636E\u3001\u81EA\u8BC4\u6216\u590D\u4E60\u5B89\u6392\uFF1B\u4E5F\u4E0D\u4F1A\u81EA\u52A8\u7EED\u53D1\u4E4B\u524D\u7684\u8BF7\u6C42\u3002",
              actions: [
                { label: "\u67E5\u770B\u672C\u5730\u8BB0\u5F55\u4E0E\u6570\u636E\u7BA1\u7406", onClick: () => void api2.navigate("/records") },
                { label: "\u8FD4\u56DE\u9996\u9875", onClick: () => void api2.navigate("/home") }
              ]
            })
          );
          container.append(
            h(
              "p",
              { class: "edu-muted" },
              "\u5B66\u751F\u6743\u9650\u4E0D\u5305\u542B\u7CFB\u7EDF\u7EA7\u6587\u4EF6\u3001\u547D\u4EE4\u6216\u4EFB\u610F\u6587\u4EF6\u8BFB\u53D6\uFF1B\u8FD9\u4E9B\u9650\u5236\u7531\u540E\u7AEF\u6267\u884C\uFF0C\u4E0D\u4F9D\u8D56\u672C\u9875\u9690\u85CF\u5165\u53E3\u3002"
            )
          );
        }
      });
    }
    function capabilityCard(title, value, tone) {
      return h(
        "div",
        { class: "edu-card" },
        h("h3", { class: "edu-card__title" }, title),
        statusChip(value, tone)
      );
    }
    function keyErrorTitle(category) {
      switch (category) {
        case "format":
          return "\u683C\u5F0F\u9519\u8BEF";
        case "auth":
          return "\u9274\u6743\u5931\u8D25";
        case "network":
          return "\u7F51\u7EDC\u5931\u8D25";
        case "quota":
          return "\u914D\u989D\u4E0D\u8DB3";
        case "not_implemented":
          return "\u63A5\u53E3\u672A\u5B9E\u73B0";
        default:
          return "\u4FDD\u5B58\u6CA1\u6709\u5B8C\u6210";
      }
    }
    function keyErrorBody(category) {
      switch (category) {
        case "format":
          return "\u53EA\u63A5\u53D7\u4EE5 sk- \u5F00\u5934\u3001\u957F\u5EA6\u5408\u7406\u7684 Key\uFF1BKey \u6CA1\u6709\u4FDD\u5B58\u3002";
        case "auth":
          return "\u672C\u673A\u5BBF\u4E3B\u6CA1\u6709\u63A5\u53D7\u8FD9\u4E2A Key\uFF1B\u8BF7\u68C0\u67E5\u540E\u91CD\u8BD5\uFF0CKey \u6CA1\u6709\u4FDD\u5B58\u3002";
        case "network":
          return "\u65E0\u6CD5\u8FDE\u63A5\u672C\u673A\u5BBF\u4E3B\u7AEF\u70B9\uFF1BKey \u6CA1\u6709\u4FDD\u5B58\uFF0C\u5F53\u524D\u4ECD\u4E3A\u672C\u5730\u6A21\u5F0F\u3002";
        case "quota":
          return "\u8BE5 Key \u7684\u914D\u989D\u4E0D\u8DB3\u6216\u8BF7\u6C42\u53D7\u9650\uFF1B\u8BF7\u66F4\u6362 Key \u6216\u7A0D\u540E\u91CD\u8BD5\u3002";
        case "not_implemented":
          return "\u672C\u673A\u5BBF\u4E3B\u5C1A\u672A\u63D0\u4F9B /edu/api/auth/key\uFF1BKey \u6CA1\u6709\u4FDD\u5B58\uFF0C\u4E0D\u80FD\u5047\u88C5\u6210\u529F\u3002";
        default:
          return "\u5BBF\u4E3B\u6CA1\u6709\u786E\u8BA4\u4FDD\u5B58\uFF1BKey \u6CA1\u6709\u4FDD\u5B58\uFF0C\u5F53\u524D\u4ECD\u4E3A\u672C\u5730\u6A21\u5F0F\u3002";
      }
    }
    
    // education/client/shell/src/pages/first-run.ts
    function createFirstRunPage() {
      return definePage({
        id: "shell.first-run",
        path: "/first-run",
        title: "\u9996\u6B21\u4F7F\u7528",
        requiresLearner: true,
        fallback: true,
        mount(container, context) {
          const api2 = context.services.shell;
          const state = context.services.getState();
          const snapshot = state.snapshot;
          container.append(
            pageHeading(
              "\u9996\u6B21\u4F7F\u7528",
              "\u5148\u4E86\u89E3\u8BB0\u5F55\u4FDD\u5B58\u5728\u54EA\u91CC\u3001\u667A\u80FD\u53CD\u9988\u9700\u8981\u4EC0\u4E48\uFF0C\u518D\u9009\u62E9\u6559\u6750\u4E0E\u4F60\u5B66\u8FC7\u7684\u8303\u56F4\u3002"
            )
          );
          if (snapshot === null) {
            container.append(
              notice({
                tone: "warning",
                title: "\u8FD8\u6CA1\u6709\u53EF\u7528\u6559\u6750",
                body: "\u8BF7\u5148\u5728\u6559\u6750\u5E93\u9009\u62E9\u6216\u5BFC\u5165\u4E0E\u4F60\u8BFE\u672C\u5339\u914D\u7684\u6750\u6599\u3002",
                actions: [{ label: "\u53BB\u6559\u6750\u5E93", onClick: () => void api2.navigate("/library"), tone: "primary" }]
              })
            );
            return;
          }
          const courseLabel = courseEditionLabel(snapshot.courseEdition);
          container.append(
            renderContextBar({
              courseEdition: courseLabel,
              packVersion: snapshot.pack.version,
              concept: null,
              mode: null,
              saveState: state.saveState,
              fixture: snapshot.fixture,
              backTarget: state.backTarget?.label ?? null,
              onBack: state.backTarget === null ? void 0 : () => void api2.back()
            })
          );
          if (state.offline) container.append(offlineNotice(() => void api2.refresh()));
          container.append(
            notice({
              tone: "info",
              title: "\u5173\u4E8E\u4FDD\u5B58\u4E0E\u4E91\u7AEF\u670D\u52A1",
              body: "\u5B66\u4E60\u8BB0\u5F55\u4FDD\u5B58\u5728\u8FD9\u53F0\u7535\u8111\u3002\u667A\u80FD\u53CD\u9988\u9700\u8981\u5DF2\u914D\u7F6E\u7684\u6A21\u578B\u670D\u52A1\uFF1B\u4F7F\u7528\u4E91\u7AEF\u53CD\u9988\u65F6\uFF0C\u76F8\u5173\u4F5C\u7B54\u548C\u6240\u9009\u6750\u6599\u53EF\u80FD\u53D1\u9001\u5230\u8BE5\u670D\u52A1\u3002\u4E0D\u80FD\u628A\u5168\u90E8\u6570\u636E\u8BF4\u6210\u4ECE\u4E0D\u79BB\u673A\u3002"
            })
          );
          container.append(
            h(
              "section",
              { class: "edu-section" },
              h("h2", { class: "edu-section__title" }, "\u4F60\u7684\u672C\u5730\u5B66\u4E60\u8EAB\u4EFD"),
              h(
                "div",
                { class: "edu-card" },
                h("p", { class: "edu-card__title" }, `\u672C\u5730\u533F\u540D\u6863\u6848\uFF1A${snapshot.learner.id}`),
                h(
                  "p",
                  { class: "edu-card__meta" },
                  `\u521B\u5EFA\u4E8E ${formatDateTime(snapshot.learner.createdAt)}\u3002\u8FD9\u4E0D\u662F\u5E73\u53F0\u6A21\u578B\u8D26\u53F7\uFF1B\u6A21\u578B\u670D\u52A1\u8FDE\u63A5\u72B6\u6001\u5355\u72EC\u663E\u793A\uFF0C\u5207\u6362\u6A21\u578B\u8D26\u53F7\u4E0D\u4F1A\u5220\u9664\u5B66\u60C5\u3002`
                )
              )
            )
          );
          const textbook = h(
            "section",
            { class: "edu-section" },
            h("h2", { class: "edu-section__title" }, "\u5F53\u524D\u6559\u6750"),
            h(
              "div",
              { class: "edu-card" },
              h("p", { class: "edu-card__title" }, courseLabel),
              h(
                "p",
                { class: "edu-card__meta" },
                `\u5185\u5BB9\u5305\u7248\u672C ${snapshot.pack.version} \xB7 ${snapshot.pack.scope === "partial" ? "\u90E8\u5206\u5185\u5BB9" : "\u5168\u518C\u8303\u56F4"} \xB7 \u5BA1\u6821\u72B6\u6001\uFF1A${snapshot.fixture ? "\u5408\u6210 fixture\uFF08\u975E\u771F\u5B9E\u7248\u672C\uFF09" : snapshot.pack.status}`
              ),
              h(
                "div",
                { class: "edu-inline-actions" },
                button("\u53BB\u6559\u6750\u5E93\u9009\u62E9\u5339\u914D\u6559\u6750", () => void api2.navigate("/library"), { small: true })
              )
            )
          );
          container.append(textbook);
          let scope = "selected";
          let savedMessage = "";
          const selected = /* @__PURE__ */ new Set();
          const status = h("div", {
            role: "status",
            "aria-live": "polite",
            "data-testid": "first-run-save-status"
          });
          const conceptCheckboxes = h("div", { class: "edu-choice-list" });
          for (const concept2 of snapshot.concepts) {
            const input = h("input", { type: "checkbox", value: concept2.id });
            input.addEventListener("change", () => {
              scope = "selected";
              const radio2 = rangeForm.querySelector('input[value="selected"]');
              if (radio2 !== null) radio2.checked = true;
              if (input.checked) selected.add(concept2.id);
              else selected.delete(concept2.id);
              updateHint();
            });
            conceptCheckboxes.append(
              h("label", { class: "edu-choice" }, input, h("span", {}, `${concept2.title}\uFF08${concept2.id}\uFF09`))
            );
          }
          const hint = h("p", { class: "edu-section__lead", "data-testid": "first-run-range-hint" });
          const updateHint = (value = scope) => {
            hint.textContent = value === "selected" ? `\u5DF2\u9009\u62E9 ${selected.size} \u4E2A\u6982\u5FF5\u3002\u8FD9\u662F\u5B66\u751F\u81EA\u8FF0\uFF0C\u4E0D\u4F1A\u81EA\u52A8\u6807\u8BB0\u4E3A\u5DF2\u7406\u89E3\u3002` : value === "all_unlearned" ? "\u5168\u672A\u5B66\uFF1A\u5B66\u4E60\u5EFA\u8BAE\u4F1A\u4ECE\u5C1A\u65E0\u8BC1\u636E\u7684\u6982\u5FF5\u5F00\u59CB\uFF1B\u4E0D\u4F1A\u81EA\u52A8\u751F\u6210\u7406\u89E3\u5224\u65AD\u3002" : "\u6682\u4E0D\u786E\u5B9A\uFF1A\u53EF\u4EE5\u5148\u770B\u5730\u56FE\uFF0C\u4E4B\u540E\u968F\u65F6\u4FEE\u6539\u8303\u56F4\u3002";
          };
          updateHint();
          const currentScope = () => scope;
          const rangeForm = h(
            "form",
            {
              class: "edu-section",
              "data-testid": "first-run-range-form",
              onsubmit: (event) => event.preventDefault()
            },
            h("h2", { class: "edu-section__title" }, "\u6211\u5B66\u8FC7\u7684\u8303\u56F4\uFF08\u81EA\u8FF0\uFF09"),
            h(
              "p",
              { class: "edu-section__lead" },
              "\u53EF\u4EE5\u9009\u62E9\u90E8\u5206\u6982\u5FF5\u3001\u5168\u672A\u5B66\u6216\u6682\u4E0D\u786E\u5B9A\u3002\u8FD9\u4E2A\u9009\u62E9\u7528\u4E8E\u63A8\u8350\u8D77\u70B9\uFF0C\u4E0D\u662F\u7406\u89E3\u8BC1\u636E\uFF0C\u4E5F\u4E0D\u4F1A\u4E00\u952E\u628A\u5185\u5BB9\u6807\u4E3A\u5DF2\u638C\u63E1\u3002"
            ),
            h(
              "div",
              { class: "edu-choice-list" },
              radio("range", "selected", "\u9009\u62E9\u90E8\u5206\u6982\u5FF5", currentScope() === "selected", () => {
                scope = "selected";
                updateHint();
              }),
              radio("range", "all_unlearned", "\u5168\u672A\u5B66", currentScope() === "all_unlearned", () => {
                scope = "all_unlearned";
                updateHint();
              }),
              radio("range", "uncertain", "\u6682\u4E0D\u786E\u5B9A", currentScope() === "uncertain", () => {
                scope = "uncertain";
                updateHint();
              })
            ),
            conceptCheckboxes,
            hint,
            h(
              "div",
              { class: "edu-inline-actions" },
              button(
                "\u4FDD\u5B58\u81EA\u8FF0\u8303\u56F4",
                () => {
                  void (async () => {
                    const conceptIds = scope === "selected" ? [...selected] : [];
                    if (scope === "selected" && conceptIds.length === 0) {
                      status.replaceChildren(
                        notice({
                          tone: "warning",
                          title: "\u8FD8\u4E0D\u80FD\u4FDD\u5B58",
                          body: "\u8BF7\u81F3\u5C11\u9009\u62E9\u4E00\u4E2A\u6982\u5FF5\uFF1B\u4E5F\u53EF\u4EE5\u9009\u62E9\u201C\u5168\u672A\u5B66\u201D\u6216\u201C\u6682\u4E0D\u786E\u5B9A\u201D\u3002"
                        })
                      );
                      return;
                    }
                    const result = await api2.saveRange({
                      scope,
                      conceptIds,
                      diagnosticSkipped: state.diagnosticSkipped
                    });
                    if (result.ok) {
                      savedMessage = `\u5DF2\u4FDD\u5B58\u4E3A\u81EA\u8FF0\u8303\u56F4\uFF08${result.data.range.conceptIds.length} \u4E2A\u6982\u5FF5\uFF09\u3002\u5B83\u4E0D\u4F1A\u81EA\u52A8\u6807\u8BB0\u4E3A\u5DF2\u7406\u89E3\uFF1B\u4E4B\u540E\u53EF\u4EE5\u4FEE\u6539\u3002`;
                      status.replaceChildren(
                        notice({
                          tone: "info",
                          title: "\u81EA\u8FF0\u8303\u56F4\u5DF2\u4FDD\u5B58",
                          body: `${savedMessage}${result.data.diagnosticSuggested ? " \u5EFA\u8BAE\u5148\u770B\u5730\u56FE\uFF0C\u6216\u505A\u4E00\u6B21\u77ED\u8BCA\u65AD\u83B7\u5F97\u521D\u6B65\u8BC1\u636E\u3002" : ""}`
                        })
                      );
                    } else {
                      status.replaceChildren(
                        renderErrorBanner(result.error, {
                          onRetry: () => {
                            const saveButton = rangeForm.querySelector(
                              '[data-action="save-range"]'
                            );
                            saveButton?.click();
                          },
                          backLabel: "\u5148\u770B\u5730\u56FE",
                          onBack: () => void api2.navigate("/map")
                        })
                      );
                    }
                  })();
                },
                { tone: "primary", dataAction: "save-range" }
              ),
              button("\u5148\u770B\u5730\u56FE", () => void api2.navigate("/map"))
            ),
            status
          );
          container.append(rangeForm);
          const activityCount = new Set(
            snapshot.concepts.flatMap((concept2) => concept2.activityIds)
          ).size;
          const diagnosticStatus = h("p", {
            class: "edu-section__lead",
            role: "status",
            "aria-live": "polite",
            "data-testid": "first-run-diagnostic-status",
            text: state.diagnosticSkipped ? "\u5DF2\u8DF3\u8FC7\u8BCA\u65AD\uFF1B\u4E0D\u4F1A\u751F\u6210\u7406\u89E3\u5224\u65AD\uFF0C\u4E5F\u4E0D\u4F1A\u628A\u8DF3\u8FC7\u8BB0\u4E3A\u5B8C\u6210\u3002" : ""
          });
          const diagnostic = h(
            "section",
            { class: "edu-section", "data-testid": "first-run-diagnostic" },
            h("h2", { class: "edu-section__title" }, "\u77ED\u8BCA\u65AD\uFF08\u53EF\u9009\uFF09"),
            h(
              "p",
              { class: "edu-section__lead" },
              `\u5F53\u524D\u5185\u5BB9\u5305\u6709 ${activityCount} \u4E2A\u53EF\u7528\u6D3B\u52A8\u3002\u77ED\u8BCA\u65AD\u53EA\u8986\u76D6\u4F60\u9009\u62E9\u7684\u8303\u56F4\uFF0C\u9898\u6570\u6765\u81EA\u5B9E\u9645\u53EF\u7528\u6D3B\u52A8\uFF0C\u5F00\u59CB\u524D\u53EF\u89C1\uFF1B\u53EF\u968F\u65F6\u7ED3\u675F\uFF0C\u672A\u6D4B\u90E8\u5206\u4FDD\u6301\u201C\u5C1A\u65E0\u8DB3\u591F\u8BC1\u636E\u201D\u3002`
            ),
            h(
              "p",
              { class: "edu-muted" },
              "\u8BCA\u65AD\u4E0D\u662F\u4F7F\u7528\u95E8\u69DB\uFF1A\u8DF3\u8FC7\u3001\u5931\u8D25\u6216\u4E2D\u6B62\u90FD\u4E0D\u4F1A\u9501\u4F4F\u5B66\u4E60\uFF0C\u4E5F\u4E0D\u4F1A\u4F2A\u9020\u5DF2\u638C\u63E1\u3002"
            ),
            h(
              "div",
              { class: "edu-inline-actions" },
              button(
                "\u5F00\u59CB\u77ED\u8BCA\u65AD",
                () => {
                  const first = snapshot.concepts[0];
                  if (first === void 0) return;
                  void api2.navigate(`/workspace?mode=diagnostic&concept=${first.id}&new=1`);
                },
                { tone: "primary" }
              ),
              button(
                "\u8DF3\u8FC7\u8BCA\u65AD",
                () => {
                  api2.setDiagnosticSkipped(true);
                  diagnosticStatus.textContent = "\u5DF2\u8DF3\u8FC7\u8BCA\u65AD\uFF1B\u4E0D\u4F1A\u751F\u6210\u7406\u89E3\u5224\u65AD\uFF0C\u4E5F\u4E0D\u4F1A\u628A\u8DF3\u8FC7\u8BB0\u4E3A\u5B8C\u6210\u3002";
                }
              ),
              button("\u5148\u770B\u5730\u56FE", () => void api2.navigate("/map"))
            ),
            diagnosticStatus
          );
          container.append(diagnostic);
          const modelStatus = h(
            "section",
            { class: "edu-section" },
            h("h2", { class: "edu-section__title" }, "\u6A21\u578B\u670D\u52A1"),
            snapshot.auth.apiKey.status === "available" || state.keyStatus === "configured" ? h(
              "div",
              { class: "edu-card" },
              statusChip("API Key \u5DF2\u914D\u7F6E", "positive"),
              h("p", { class: "edu-card__meta" }, "\u4E91\u63A8\u7406\u53EF\u7528\u3002\u5B66\u751F\u8EAB\u4EFD\u4E0E\u6A21\u578B\u8D26\u53F7\u5206\u522B\u7BA1\u7406\u3002")
            ) : h(
              "div",
              { class: "edu-card" },
              statusChip("API Key \u672A\u914D\u7F6E", "attention"),
              h("p", { class: "edu-card__meta" }, "\u53EF\u8BFB\u672C\u5730\u5185\u5BB9\u3001\u4FDD\u5B58\u81EA\u8FF0\u8303\u56F4\u4E0E\u8349\u7A3F\uFF1B\u4E91\u63A8\u7406\u4E0D\u53EF\u7528\u3002"),
              h(
                "div",
                { class: "edu-inline-actions" },
                button("\u67E5\u770B\u8D26\u6237\u4E0E\u6A21\u578B\u670D\u52A1", () => void api2.navigate("/account"), { small: true })
              )
            )
          );
          container.append(modelStatus);
        }
      });
    }
    function radio(name, value, label, checked, onChange) {
      const id = `first-run-${name}-${value}`;
      const input = h("input", {
        type: "radio",
        name,
        value,
        id,
        checked,
        onchange: onChange
      });
      return h("label", { class: "edu-choice", for: id }, input, h("span", {}, label));
    }
    
    // education/client/shell/src/components/progress.ts
    function progressSummary(input) {
      const total = Math.max(0, Math.floor(input.total));
      const current = Math.max(0, Math.min(Math.floor(input.current), total));
      return h(
        "div",
        { class: "edu-progress", "data-testid": input.testId ?? "edu-progress" },
        h(
          "div",
          { class: "edu-progress__head" },
          h("span", { class: "edu-progress__label" }, input.label),
          h("span", { class: "edu-progress__value" }, `${current} / ${total}`)
        ),
        h("progress", {
          class: "edu-progress__bar",
          value: current,
          max: total,
          "aria-label": input.label
        }),
        input.note !== void 0 ? h("p", { class: "edu-progress__note" }, input.note) : null
      );
    }
    
    // education/client/shell/src/pages/home.ts
    function entryCard(input) {
      return h(
        "article",
        {
          class: `edu-entry${input.primary ? " edu-entry--primary" : ""}`,
          "data-testid": input.testId
        },
        h("p", { class: "edu-entry__eyebrow" }, input.eyebrow),
        h("h2", { class: "edu-entry__title" }, input.title),
        ...input.body.map((line) => h("p", { class: "edu-entry__body" }, line)),
        h("div", { class: "edu-entry__actions" }, ...input.actions)
      );
    }
    function createHomePage() {
      return definePage({
        id: "shell.home",
        path: "/home",
        title: "\u9996\u9875",
        requiresLearner: false,
        fallback: true,
        mount(container, context) {
          const api2 = context.services.shell;
          const state = context.services.getState();
          const snapshot = state.snapshot;
          const home = state.home;
          container.append(pageHeading("\u9996\u9875", "\u7EE7\u7EED\u4E0A\u6B21\u7684\u5B66\u4E60\uFF0C\u6216\u4ECE\u5730\u56FE\u548C\u590D\u4E60\u5F00\u59CB\u3002"));
          if (snapshot === null || home === null) {
            container.append(
              emptyState({
                title: "\u6B63\u5728\u51C6\u5907\u5B66\u4E60\u7A7A\u95F4",
                body: "\u8FD8\u6CA1\u6709\u8BFB\u5230\u672C\u673A\u6559\u6750\u4E0E\u8BB0\u5F55\u3002\u53EF\u4EE5\u7A0D\u540E\u91CD\u8BD5\u3002",
                actions: [{ label: "\u91CD\u8BD5", onClick: () => void api2.refresh() }]
              })
            );
            return;
          }
          if (state.offline) {
            container.append(offlineNotice(() => void api2.refresh()));
          }
          const courseLabel = courseEditionLabel(snapshot.courseEdition);
          container.append(
            renderContextBar({
              courseEdition: courseLabel,
              packVersion: snapshot.pack.version,
              concept: home.activeSession === null ? null : conceptTitle(snapshot.concepts, home.activeSession.conceptId),
              mode: home.activeSession === null ? null : SESSION_MODE_LABELS[home.activeSession.mode],
              saveState: state.saveState,
              fixture: snapshot.fixture,
              backTarget: null
            })
          );
          if (home.compatibility !== null) {
            container.append(
              notice({
                tone: "warning",
                title: "\u4E0A\u6B21\u5185\u5BB9\u4E0E\u5F53\u524D\u7248\u672C\u4E0D\u517C\u5BB9",
                body: `\u4E0A\u6B21\u4FDD\u5B58\u7684\u5185\u5BB9\u7248\u672C\u662F ${home.compatibility.previousPackVersion}\uFF0C\u5F53\u524D\u662F ${home.compatibility.currentPackVersion}\u3002${home.compatibility.reason} \u65E7\u8BB0\u5F55\u4ECD\u53EF\u67E5\u770B\uFF0C\u4F46\u4E0D\u4F1A\u81EA\u52A8\u8FC1\u79FB\u6210\u65B0\u7684\u7406\u89E3\u8BC1\u636E\u3002`,
                testId: "home-incompatible",
                actions: [
                  { label: "\u67E5\u770B\u65E7\u8BB0\u5F55", onClick: () => void api2.navigate("/records") },
                  { label: "\u91CD\u65B0\u5173\u8054", onClick: () => void api2.navigate("/library") },
                  {
                    label: "\u5F00\u59CB\u65B0\u6D3B\u52A8",
                    onClick: () => void api2.navigate("/workspace?mode=learn&new=1"),
                    tone: "primary"
                  }
                ]
              })
            );
          }
          if (state.resumeError !== null) {
            container.append(
              renderErrorBanner(state.resumeError, {
                onRetry: () => void api2.resumeLast(),
                onBack: () => void api2.navigate("/records"),
                backLabel: "\u67E5\u770B\u65E7\u8BB0\u5F55"
              })
            );
          }
          if (state.keyStatus === "missing" && !isKeyIntroDismissed()) {
            container.append(keyIntro(api2));
          }
          const entries = h("div", { class: "edu-entry-grid" });
          const active = home.activeSession;
          if (active !== null) {
            const title = conceptTitle(snapshot.concepts, active.conceptId);
            const cursorText = positionLabel(active.resumeCursor.activityId, active.resumeCursor.cursor);
            entries.append(
              entryCard({
                eyebrow: "\u7EE7\u7EED\u4E0A\u6B21",
                title,
                body: [
                  `${courseLabel} \xB7 \u5185\u5BB9\u5305 ${active.packVersion}`,
                  `\u6A21\u5F0F\uFF1A${SESSION_MODE_LABELS[active.mode]} \xB7 \u4E0A\u6B21\u4F4D\u7F6E\uFF1A${cursorText}`,
                  active.resumeCursor.cursor === null ? "\u6CA1\u6709\u5F85\u6062\u590D\u8349\u7A3F" : "\u5DF2\u4FDD\u5B58\u8349\u7A3F\uFF0C\u53EF\u539F\u4F4D\u6062\u590D"
                ],
                primary: true,
                testId: "home-continue",
                actions: [
                  button("\u7EE7\u7EED\u4E0A\u6B21", () => void api2.resumeLast(), { tone: "primary", dataAction: "resume-last" }),
                  button("\u67E5\u770B\u8BB0\u5F55", () => void api2.navigate("/records"))
                ]
              })
            );
          } else if (home.lastCompletedSession !== null) {
            const completed = home.lastCompletedSession;
            const title = conceptTitle(snapshot.concepts, completed.conceptId);
            entries.append(
              entryCard({
                eyebrow: "\u4E0A\u6B21\u5B66\u4E60\u5DF2\u5B8C\u6210",
                title,
                body: [
                  `${courseLabel} \xB7 \u5185\u5BB9\u5305 ${completed.packVersion}`,
                  `\u6A21\u5F0F\uFF1A${SESSION_MODE_LABELS[completed.mode]} \xB7 \u7ED3\u675F\u4E8E ${formatDateTime(completed.endedAt)}`,
                  "\u5DF2\u5B8C\u6210\u7684\u6D3B\u52A8\u53EF\u4EE5\u6253\u5F00\u6536\u5C3E\u8BB0\u5F55\uFF0C\u4E5F\u53EF\u4EE5\u5F00\u59CB\u65B0\u4E00\u8F6E\uFF0C\u4E0D\u4F1A\u8986\u76D6\u65E7\u8BC1\u636E\u3002"
                ],
                primary: true,
                testId: "home-completed",
                actions: [
                  button("\u67E5\u770B\u6536\u5C3E\u8BB0\u5F55", () => void api2.navigate("/records"), { tone: "primary" }),
                  button("\u518D\u5B66\u4E00\u6B21", () => void api2.navigate(`/workspace?mode=learn&concept=${completed.conceptId}&new=1`)),
                  button("\u5F00\u59CB\u590D\u4E60", () => void api2.navigate(`/workspace?mode=review&concept=${completed.conceptId}`))
                ]
              })
            );
          } else {
            entries.append(
              entryCard({
                eyebrow: "\u5F00\u59CB\u4F7F\u7528",
                title: "\u9009\u62E9\u6559\u6750\uFF0C\u5F00\u59CB\u5B66\u4E60",
                body: [
                  "\u8FD8\u6CA1\u6709\u5B66\u4E60\u8BB0\u5F55\u3002\u5148\u9009\u62E9\u4E0E\u4F60\u8BFE\u672C\u5339\u914D\u7684\u6559\u6750\uFF0C\u518D\u4ECE\u5730\u56FE\u9009\u62E9\u6982\u5FF5\u3002",
                  "\u8BB0\u5F55\u4FDD\u5B58\u5728\u8FD9\u53F0\u7535\u8111\uFF1B\u4E91\u7AEF\u53CD\u9988\u9700\u8981\u5DF2\u914D\u7F6E\u7684\u6A21\u578B\u670D\u52A1\u3002"
                ],
                primary: true,
                testId: "home-first-use",
                actions: [
                  button("\u9009\u62E9\u6559\u6750\uFF0C\u5F00\u59CB\u5B66\u4E60", () => void api2.navigate("/library"), { tone: "primary" }),
                  button("\u9996\u6B21\u4F7F\u7528\u8BF4\u660E", () => void api2.navigate("/first-run"))
                ]
              })
            );
          }
          const currentConcept = active?.conceptId ?? home.lastCompletedSession?.conceptId ?? null;
          entries.append(
            entryCard({
              eyebrow: "\u8FDB\u5165\u5730\u56FE",
              title: "\u6309\u76EE\u5F55\u627E\u6982\u5FF5",
              body: [
                currentConcept === null ? "\u5C1A\u672A\u9009\u62E9\u6982\u5FF5\uFF1B\u5730\u56FE\u4F1A\u4ECE\u771F\u5B9E\u6559\u6750\u76EE\u5F55\u5F00\u59CB\u3002" : `\u5F53\u524D\u6982\u5FF5\uFF1A${conceptTitle(snapshot.concepts, currentConcept)}`
              ],
              primary: false,
              testId: "home-map",
              actions: [
                button("\u8FDB\u5165\u5730\u56FE", () => void api2.navigate("/map"), { tone: "primary" }),
                button("\u67E5\u770B\u6559\u6750\u5E93", () => void api2.navigate("/library"))
              ]
            })
          );
          const reviewBody = [];
          if (home.dueReviews.length === 0) {
            reviewBody.push(h("p", { class: "edu-entry__body" }, "\u5F53\u524D\u6CA1\u6709\u5F85\u590D\u4E60\u9879\u76EE\uFF1B\u4ECD\u53EF\u81EA\u9009\u8303\u56F4\u590D\u4E60\u3002"));
          } else {
            reviewBody.push(
              h("p", { class: "edu-entry__body" }, `\u6709 ${home.dueReviews.length} \u4E2A\u6982\u5FF5\u5F85\u590D\u4E60\u3002`),
              h(
                "ul",
                { class: "edu-list", "data-testid": "home-review-list" },
                ...home.dueReviews.slice(0, 3).map(
                  (item) => h(
                    "li",
                    { class: "edu-list__item" },
                    h("strong", {}, item.conceptTitle),
                    h("span", { class: "edu-muted" }, ` \xB7 ${REVIEW_REASON_LABELS[item.reason]} \xB7 ${formatDateTime(item.dueAt)}`)
                  )
                )
              )
            );
          }
          const reviewActions = [];
          if (home.dueReviews.length > 0) {
            reviewActions.push(
              button("\u5F00\u59CB\u590D\u4E60", () => void api2.navigate("/workspace?mode=review"), { tone: "primary" })
            );
          }
          reviewActions.push(button("\u81EA\u9009\u590D\u4E60\u8303\u56F4", () => void api2.navigate("/map?intent=review")));
          entries.append(
            entryCard({
              eyebrow: "\u590D\u4E60",
              title: home.dueReviews.length === 0 ? "\u5F53\u524D\u6CA1\u6709\u5F85\u590D\u4E60\u9879\u76EE" : "\u6309\u5EFA\u8BAE\u6216\u81EA\u9009\u8303\u56F4\u590D\u4E60",
              body: [],
              primary: false,
              testId: "home-review",
              actions: reviewActions
            })
          );
          const reviewCard = entries.querySelector('[data-testid="home-review"]');
          if (reviewCard !== null) {
            const actions = reviewCard.querySelector(".edu-entry__actions");
            for (const node of reviewBody) reviewCard.insertBefore(node, actions);
          }
          container.append(entries);
          container.append(
            h(
              "section",
              { class: "edu-section", "data-testid": "home-progress" },
              progressSummary({
                label: "\u5DF2\u5B66\u6982\u5FF5",
                current: home.learnedConceptCount,
                total: home.totalConcepts,
                note: "\u5185\u5BB9\u8986\u76D6\u8BA1\u6570\uFF0C\u4E0D\u662F\u638C\u63E1\u7A0B\u5EA6\uFF1B\u81EA\u8BC4\u4E0E\u7406\u89E3\u8BC1\u636E\u5728\u8BB0\u5F55\u9875\u5206\u5F00\u663E\u793A\u3002"
              })
            )
          );
          const service = h(
            "section",
            { class: "edu-section", "aria-label": "\u670D\u52A1\u72B6\u6001" },
            h("h2", { class: "edu-section__title" }, "\u5F53\u524D\u670D\u52A1\u72B6\u6001"),
            h(
              "div",
              { class: "edu-grid" },
              statusCard("\u672C\u5730\u8BB0\u5F55", "\u53EF\u8BFB", "positive", "\u6559\u6750\u4E0E\u5DF2\u4FDD\u5B58\u8BB0\u5F55\u5728\u8FD9\u53F0\u7535\u8111\u4E0A\u3002"),
              statusCard(
                "\u6A21\u578B\u670D\u52A1",
                state.keyStatus === "configured" ? "API Key \u5DF2\u914D\u7F6E" : "API Key \u672A\u914D\u7F6E",
                state.keyStatus === "configured" ? "positive" : "attention",
                state.keyStatus === "configured" ? "\u4E91\u63A8\u7406\u53EF\u7528\uFF1B\u8BF7\u6C42\u8303\u56F4\u4EE5\u5B9E\u9645\u914D\u7F6E\u4E3A\u51C6\u3002" : "\u4ECD\u53EF\u8BFB\u672C\u5730\u5185\u5BB9\uFF1B\u4E91\u63A8\u7406\u4E0D\u53EF\u7528\u3002"
              ),
              statusCard(
                "\u5E73\u53F0\u8D26\u6237",
                "\u4E0D\u53EF\u7528",
                "neutral",
                "\u672C\u4EA7\u54C1\u7EBF\u4E0D\u4F7F\u7528\u5E73\u53F0\u8D26\u6237\u6388\u6743\uFF1B\u5B66\u4E60\u8EAB\u4EFD\u4E0E\u6A21\u578B\u8D26\u53F7\u5206\u5F00\u3002"
              )
            )
          );
          const fixtureFooter = h(
            "p",
            { class: "edu-muted", "data-testid": "home-fixture-note" },
            snapshot.notice ?? ""
          );
          if (snapshot.fixture) fixtureFooter.prepend(fixtureBadge());
          service.append(fixtureFooter);
          container.append(service);
        }
      });
    }
    function statusCard(title, value, tone, detail) {
      return h(
        "div",
        { class: "edu-card" },
        h("h3", { class: "edu-card__title" }, title),
        statusChip(value, tone),
        h("p", { class: "edu-card__meta" }, detail)
      );
    }
    var KEY_INTRO_DISMISSED = "edu.client.key-intro.dismissed";
    function isKeyIntroDismissed() {
      try {
        return globalThis.localStorage?.getItem(KEY_INTRO_DISMISSED) === "1";
      } catch {
        return false;
      }
    }
    function dismissKeyIntro() {
      try {
        globalThis.localStorage?.setItem(KEY_INTRO_DISMISSED, "1");
      } catch {
      }
    }
    function keyIntro(api2) {
      const section = h(
        "section",
        {
          class: "edu-section edu-key-intro",
          "aria-labelledby": "edu-key-intro-title",
          "data-testid": "first-start-guide"
        },
        h("h2", { class: "edu-section__title", id: "edu-key-intro-title" }, "\u5148\u4E86\u89E3\u4E09\u4EF6\u4E8B"),
        h(
          "p",
          { class: "edu-section__lead" },
          "\u8FD8\u6CA1\u6709\u914D\u7F6E\u6A21\u578B Key\uFF1B\u73B0\u5728\u53EF\u4EE5\u5148\u5728\u672C\u5730\u9605\u8BFB\u6559\u6750\u3001\u770B\u5730\u56FE\u548C\u8BB0\u5F55\uFF0C\u4E4B\u540E\u518D\u914D\u7F6E\u3002"
        ),
        h(
          "ol",
          { class: "edu-key-intro__steps" },
          h("li", {}, h("strong", {}, "\u8FD9\u662F\u672C\u5730\u5B66\u4E60\u5DE5\u4F5C\u533A"), h("span", {}, "\u6559\u6750\u539F\u6587\u4E0E\u5B66\u4E60\u8BB0\u5F55\u4FDD\u5B58\u5728\u8FD9\u53F0\u7535\u8111\uFF0C\u4E0D\u4E0A\u4F20\u6574\u672C\u6559\u6750\u3002")),
          h("li", {}, h("strong", {}, "\u4E91\u6A21\u578B\u53EA\u63A5\u6536\u5F53\u524D\u4EFB\u52A1\u5FC5\u8981\u7247\u6BB5"), h("span", {}, "\u53EA\u6709\u4F60\u5728\u9700\u8981\u667A\u80FD\u53CD\u9988\u65F6\uFF0C\u5F53\u524D\u9898\u76EE\u3001\u6240\u4F5C\u7B54\u4E0E\u5FC5\u8981\u6750\u6599\u7247\u6BB5\u4F1A\u53D1\u9001\u5230\u6A21\u578B\u670D\u52A1\u3002")),
          h("li", {}, h("strong", {}, "\u53EF\u4EE5\u968F\u65F6\u4FEE\u6539"), h("span", {}, "\u4E4B\u540E\u53EF\u5728\u201C\u8D26\u6237\u4E0E\u6A21\u578B\u670D\u52A1\u201D\u5F55\u5165\u3001\u66F4\u6362\u6216\u6E05\u9664 Key\uFF1B\u672A\u914D\u7F6E\u65F6\u4ECD\u53EF\u672C\u5730\u5B66\u4E60\u3002"))
        ),
        h(
          "div",
          { class: "edu-inline-actions" },
          button("\u53BB\u914D\u7F6E\u6A21\u578B Key", () => void api2.navigate("/account"), {
            tone: "primary",
            dataAction: "open-account-key"
          }),
          button(
            "\u8DF3\u8FC7\uFF0C\u5148\u7528\u672C\u5730\u6A21\u5F0F",
            () => {
              dismissKeyIntro();
              section.remove();
            },
            { dataAction: "skip-key-intro" }
          )
        )
      );
      return section;
    }
    
    // education/client/shell/src/pages/placeholders.ts
    function createLibraryFallbackPage() {
      return definePage({
        id: "shell.library-fallback",
        path: "/library",
        title: "\u6559\u6750\u5E93",
        requiresLearner: false,
        fallback: true,
        mount(container, context) {
          const api2 = context.services.shell;
          const state = context.services.getState();
          const snapshot = state.snapshot;
          container.append(pageHeading("\u6559\u6750\u5E93", "\u9009\u62E9\u5339\u914D\u6559\u6750\uFF0C\u67E5\u770B\u7248\u672C\u3001\u6750\u6599\u53EF\u7528\u6027\u3001\u51FA\u5904\u4E0E\u5BA1\u6821\u72B6\u6001\u3002"));
          if (snapshot !== null) {
            container.append(
              renderContextBar({
                courseEdition: courseEditionLabel(snapshot.courseEdition),
                packVersion: snapshot.pack.version,
                concept: null,
                mode: null,
                saveState: state.saveState,
                fixture: snapshot.fixture,
                backTarget: state.backTarget?.label ?? null,
                onBack: state.backTarget === null ? void 0 : () => void api2.back()
              })
            );
            container.append(
              h(
                "section",
                { class: "edu-section" },
                h("h2", { class: "edu-section__title" }, "\u5F53\u524D\u6559\u6750"),
                h(
                  "div",
                  { class: "edu-card" },
                  h("p", { class: "edu-card__title" }, courseEditionLabel(snapshot.courseEdition)),
                  statusChip(snapshot.fixture ? "\u5408\u6210 fixture\uFF08\u975E\u771F\u5B9E\u7248\u672C\uFF09" : snapshot.pack.status, "attention"),
                  h(
                    "p",
                    { class: "edu-card__meta" },
                    `\u5185\u5BB9\u5305 ${snapshot.pack.version} \xB7 ${snapshot.pack.scope === "partial" ? "\u90E8\u5206\u5185\u5BB9\uFF08\u5C1A\u672A\u8FBE\u5230\u5168\u518C\uFF09" : "\u5168\u518C\u8303\u56F4"}`
                  ),
                  h(
                    "p",
                    { class: "edu-card__meta" },
                    "\u8FD9\u91CC\u53EA\u663E\u793A\u6559\u6750\u6458\u8981\uFF1B\u5BFC\u5165\u3001\u6750\u6599\u53EF\u7528\u6027\u4E0E\u5BA1\u6821\u8BE6\u60C5\u4F1A\u5728\u6559\u6750\u5E93\u5185\u5BB9\u5C31\u7EEA\u540E\u63D0\u4F9B\u3002"
                  )
                )
              )
            );
          }
          container.append(
            emptyState({
              title: "\u6559\u6750\u5E93\u5185\u5BB9\u8FD8\u6CA1\u6709\u53EF\u663E\u793A\u7684\u6761\u76EE",
              body: "\u5F53\u524D\u4E0D\u4F1A\u751F\u6210\u7A7A\u58F3\u5168\u518C\u5730\u56FE\u6216\u865A\u6784\u6559\u6750\u3002\u53EF\u4EE5\u8FD4\u56DE\u9996\u9875\uFF0C\u6216\u67E5\u770B\u5DF2\u6709\u672C\u5730\u8BB0\u5F55\u3002",
              testId: "library-fallback",
              actions: [
                { label: "\u91CD\u65B0\u68C0\u67E5\u672C\u5730\u6750\u6599", onClick: () => void api2.refresh(), tone: "primary" },
                { label: "\u8FD4\u56DE\u9996\u9875", onClick: () => void api2.navigate("/home") },
                { label: "\u67E5\u770B\u8BB0\u5F55", onClick: () => void api2.navigate("/records") }
              ]
            })
          );
          container.append(
            h("div", { class: "edu-slot", "data-edu-slot": "library:content", "data-testid": "slot-library-content" }),
            h("div", { class: "edu-slot", "data-edu-slot": "library:import", "data-testid": "slot-library-import" })
          );
        }
      });
    }
    function createMapFallbackPage() {
      return definePage({
        id: "shell.map-fallback",
        path: "/map",
        title: "\u5730\u56FE",
        requiresLearner: false,
        fallback: true,
        mount(container, context) {
          const api2 = context.services.shell;
          const state = context.services.getState();
          const snapshot = state.snapshot;
          container.append(pageHeading("\u5730\u56FE", "\u6309\u771F\u5B9E\u6559\u6750\u76EE\u5F55\u5B9A\u4F4D\u6982\u5FF5\uFF0C\u67E5\u770B\u5C40\u90E8\u5173\u7CFB\u4E0E\u5F53\u524D\u8BC1\u636E\u3002"));
          if (snapshot !== null) {
            container.append(
              renderContextBar({
                courseEdition: courseEditionLabel(snapshot.courseEdition),
                packVersion: snapshot.pack.version,
                concept: null,
                mode: null,
                saveState: state.saveState,
                fixture: snapshot.fixture,
                backTarget: state.backTarget?.label ?? null,
                onBack: state.backTarget === null ? void 0 : () => void api2.back()
              })
            );
          }
          container.append(
            emptyState({
              title: "\u8FD8\u6CA1\u6709\u53EF\u663E\u793A\u7684\u6982\u5FF5\u5730\u56FE",
              body: "\u5730\u56FE\u53EA\u5C55\u793A\u5F53\u524D\u6559\u6750\u771F\u5B9E\u76EE\u5F55\u4E2D\u7684\u5185\u5BB9\uFF1B\u6CA1\u6709\u5339\u914D\u6750\u6599\u65F6\u4E0D\u4F1A\u5408\u6210\u8282\u70B9\u3002\u53EF\u4EE5\u5148\u53BB\u6559\u6750\u5E93\u9009\u62E9\u6750\u6599\u3002",
              testId: "map-fallback",
              actions: [
                { label: "\u53BB\u6559\u6750\u5E93", onClick: () => void api2.navigate("/library"), tone: "primary" },
                { label: "\u8FD4\u56DE\u9996\u9875", onClick: () => void api2.navigate("/home") },
                { label: "\u67E5\u770B\u8BB0\u5F55", onClick: () => void api2.navigate("/records") }
              ]
            })
          );
          container.append(
            h("div", { class: "edu-slot", "data-edu-slot": "map:content", "data-testid": "slot-map-content" }),
            h("div", { class: "edu-slot", "data-edu-slot": "map:details", "data-testid": "slot-map-details" })
          );
          void button;
        }
      });
    }
    function createNotFoundPage() {
      return definePage({
        id: "shell.not-found",
        path: "/not-found",
        title: "\u9875\u9762\u4E0D\u5B58\u5728",
        requiresLearner: false,
        fallback: true,
        mount(container, context) {
          container.append(
            pageHeading("\u627E\u4E0D\u5230\u8FD9\u4E2A\u9875\u9762", "\u5730\u5740\u53EF\u80FD\u5DF2\u7ECF\u53D8\u5316\u3002\u7528\u4E0B\u9762\u7684\u5165\u53E3\u56DE\u5230\u5B66\u4E60\u7A7A\u95F4\u3002"),
            emptyState({
              title: "\u9875\u9762\u4E0D\u5B58\u5728",
              body: "\u6CA1\u6709\u6539\u52A8\u4EFB\u4F55\u672C\u5730\u8BB0\u5F55\u3002",
              actions: [
                { label: "\u8FD4\u56DE\u9996\u9875", onClick: () => void context.services.shell.navigate("/home"), tone: "primary" },
                { label: "\u53BB\u6559\u6750\u5E93", onClick: () => void context.services.shell.navigate("/library") }
              ]
            })
          );
        }
      });
    }
    
    // education/client/shell/src/components/evidence-card.ts
    function renderEvidenceCard(evidence2, options = {}) {
      const card = h("article", {
        class: "edu-evidence",
        "data-evidence-id": evidence2.id,
        "data-evidence-kind": evidence2.kind
      });
      card.append(
        h(
          "div",
          { class: "edu-evidence__head" },
          h("h3", { class: "edu-evidence__title" }, `${EVIDENCE_KIND_LABELS[evidence2.kind]}\u8BC1\u636E`),
          h(
            "div",
            { class: "edu-inline-actions" },
            statusChip(ASSISTANCE_LABELS[evidence2.assistance], evidence2.assistance === "assisted" ? "attention" : "neutral"),
            statusChip(VALIDITY_LABELS[evidence2.validity], evidence2.validity === "current" ? "positive" : "attention")
          )
        ),
        h("p", { class: "edu-evidence__text" }, evidence2.observation),
        h(
          "dl",
          { class: "edu-kv" },
          h("dt", {}, "\u8BB0\u5F55\u65F6\u95F4"),
          h("dd", {}, h("time", { datetime: evidence2.createdAt }, formatDateTime(evidence2.createdAt))),
          h("dt", {}, "\u5185\u5BB9\u7248\u672C"),
          h("dd", {}, evidence2.packVersion),
          h("dt", {}, "\u51FA\u5904"),
          h("dd", {}, evidence2.sourceRefs.length > 0 ? evidence2.sourceRefs.join("\u3001") : "\u672A\u8BB0\u5F55\u51FA\u5904")
        )
      );
      if (options.onOpen !== void 0) {
        card.append(
          h(
            "div",
            { class: "edu-inline-actions" },
            button("\u67E5\u770B\u4F9D\u636E", options.onOpen, { small: true, dataAction: "evidence-open" })
          )
        );
      }
      return card;
    }
    function renderEvidenceDetail(input) {
      const container = h("div", { class: "edu-evidence-detail", "data-testid": "edu-evidence-detail" });
      container.append(h("h3", { class: "edu-section__title" }, `\u5224\u65AD\u4F9D\u636E\uFF1A${input.conceptTitle}`));
      if (input.assessment === null) {
        container.append(
          h("p", { class: "edu-muted" }, "\u5F53\u524D\u8FD8\u6CA1\u6709\u5F62\u6210\u7406\u89E3\u5224\u65AD\uFF0C\u56E0\u6B64\u6CA1\u6709\u53EF\u5C55\u5F00\u7684\u5224\u65AD\u7406\u7531\u3002")
        );
      } else {
        const assessment = input.assessment;
        container.append(
          h(
            "dl",
            { class: "edu-kv", "data-testid": "edu-assessment-rationale" },
            h("dt", {}, "\u5224\u65AD"),
            h("dd", {}, statusChip(UNDERSTANDING_LABELS[assessment.state], assessmentTone(assessment))),
            h("dt", {}, "\u7406\u7531"),
            h("dd", {}, assessment.rationale),
            h("dt", {}, "\u5224\u65AD\u65F6\u95F4"),
            h("dd", {}, h("time", { datetime: assessment.assessedAt }, formatDateTime(assessment.assessedAt))),
            h("dt", {}, "\u8BC4\u5206\u6807\u51C6\u7248\u672C"),
            h("dd", {}, assessment.rubricVersion),
            h("dt", {}, "\u5224\u65AD\u5668\u7248\u672C"),
            h("dd", {}, assessment.evaluatorVersion),
            h("dt", {}, "\u5185\u5BB9\u5305\u7248\u672C"),
            h("dd", {}, assessment.packVersion),
            h("dt", {}, "\u6709\u6548\u6027"),
            h("dd", {}, VALIDITY_LABELS[assessment.validity])
          )
        );
      }
      if (input.evidence.length === 0) {
        container.append(h("p", { class: "edu-muted" }, "\u8FD9\u6B21\u5224\u65AD\u6CA1\u6709\u5173\u8054\u8BC1\u636E\u3002"));
      } else {
        const list = h("div", { class: "edu-list", "data-testid": "edu-evidence-list" });
        for (const evidence2 of input.evidence) list.append(renderEvidenceCard(evidence2));
        container.append(h("h4", { class: "edu-card__title" }, `\u5173\u8054\u8BC1\u636E\uFF08${input.evidence.length} \u6761\uFF09`), list);
      }
      return container;
    }
    function assessmentTone(assessment) {
      if (assessment.state === "supported") return "positive";
      if (assessment.state === "needs_support") return "attention";
      return "progress";
    }
    
    // education/client/shell/src/components/modal.ts
    var modalCounter = 0;
    var Modal = class {
      element;
      titleId;
      trigger = null;
      isOpen = false;
      constructor(title, content, closeLabel = "\u5173\u95ED") {
        modalCounter += 1;
        this.titleId = `edu-modal-title-${modalCounter}`;
        const backdrop = h("div", { class: "edu-dialog-backdrop", hidden: true, "data-edu-modal": "true" });
        const dialog = h("div", {
          class: "edu-dialog",
          role: "dialog",
          "aria-modal": "true",
          "aria-labelledby": this.titleId,
          tabindex: -1
        });
        const closeButton = button(closeLabel, () => this.close(), { dataAction: "modal-close" });
        dialog.append(
          h("h2", { class: "edu-dialog__title", id: this.titleId }, title),
          content,
          h("div", { class: "edu-dialog__actions" }, closeButton)
        );
        backdrop.append(dialog);
        backdrop.addEventListener("keydown", (event) => this.onKeydown(event));
        this.element = backdrop;
      }
      open(trigger, parent) {
        if (this.isOpen) return;
        this.isOpen = true;
        this.trigger = trigger;
        if (this.element.parentElement !== parent) parent.append(this.element);
        this.element.removeAttribute("hidden");
        const focusable = focusableElements(this.element);
        (focusable[0] ?? this.element).focus();
      }
      close() {
        if (!this.isOpen) return;
        this.isOpen = false;
        this.element.setAttribute("hidden", "");
        const trigger = this.trigger;
        this.trigger = null;
        if (trigger !== null && trigger.isConnected) trigger.focus();
      }
      onKeydown(event) {
        if (event.key === "Escape") {
          event.preventDefault();
          this.close();
          return;
        }
        if (event.key !== "Tab") return;
        const focusable = focusableElements(this.element);
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        const active = this.element.ownerDocument.activeElement;
        if (event.shiftKey && active === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && active === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    
    // education/client/shell/src/pages/records.ts
    var RANGE_SCOPE_LABELS = {
      selected: "\u5B66\u751F\u81EA\u9009\u7684\u5DF2\u5B66\u8303\u56F4",
      all_unlearned: "\u5168\u672A\u5B66",
      uncertain: "\u6682\u4E0D\u786E\u5B9A"
    };
    function latestAssessment(assessments, conceptId) {
      const matching = assessments.filter((assessment) => assessment.conceptId === conceptId).sort((a, b) => {
        const timeDiff = Date.parse(a.assessedAt) - Date.parse(b.assessedAt);
        return timeDiff !== 0 ? timeDiff : a.revision - b.revision;
      });
      return matching[matching.length - 1] ?? null;
    }
    function assessmentsFor(assessments, conceptId) {
      return assessments.filter((assessment) => assessment.conceptId === conceptId).sort((a, b) => {
        const timeDiff = Date.parse(a.assessedAt) - Date.parse(b.assessedAt);
        return timeDiff !== 0 ? timeDiff : a.revision - b.revision;
      });
    }
    function reviewAxis(progress2) {
      const body = [];
      const chips = [];
      if (progress2.review.lastCompletedAt !== null) {
        chips.push(statusChip("\u5DF2\u590D\u4E60", "positive"));
        body.push(
          h(
            "p",
            { class: "edu-axis__body" },
            `\u4E0A\u6B21\u590D\u4E60\uFF1A${formatDateTime(progress2.review.lastCompletedAt)}`
          )
        );
      }
      if (progress2.review.dueAt !== null) {
        chips.push(statusChip("\u5F85\u590D\u4E60", "attention"));
        body.push(h("p", { class: "edu-axis__body" }, `\u5F85\u590D\u4E60\u5B89\u6392\uFF1A${formatDateTime(progress2.review.dueAt)}`));
      }
      if (progress2.review.lastCompletedAt === null && progress2.review.dueAt === null) {
        chips.push(statusChip("\u672A\u5B89\u6392\u590D\u4E60", "neutral"));
        body.push(h("p", { class: "edu-axis__body" }, "\u8FD8\u6CA1\u6709\u590D\u4E60\u5B8C\u6210\u65F6\u95F4\u6216\u5F85\u590D\u4E60\u5B89\u6392\u3002"));
      }
      if (progress2.review.latestOutcome !== null) {
        body.push(
          h(
            "p",
            { class: "edu-axis__body" },
            `\u6700\u8FD1\u7ED3\u679C\uFF1A${REVIEW_OUTCOME_LABELS[progress2.review.latestOutcome]}`
          )
        );
      }
      if (progress2.review.activeSessionId !== null) {
        body.push(h("p", { class: "edu-axis__body" }, "\u6709\u4E00\u8F6E\u590D\u4E60\u6B63\u5728\u8FDB\u884C\uFF0C\u53EF\u4ECE\u5DE5\u4F5C\u533A\u7EE7\u7EED\u3002"));
      }
      return axis("\u590D\u4E60\u6D3B\u52A8", chips, body, "review");
    }
    function axis(title, chips, body, key) {
      return h(
        "section",
        { class: "edu-axis", "data-axis": key },
        h("div", { class: "edu-axis__head" }, h("h3", { class: "edu-axis__title" }, title), ...chips),
        ...body
      );
    }
    function createRecordsPage() {
      return definePage({
        id: "shell.records",
        path: "/records",
        title: "\u8BB0\u5F55",
        requiresLearner: true,
        fallback: true,
        mount(container, context) {
          const api2 = context.services.shell;
          const filter = { conceptId: "all", mode: "all", time: "all" };
          const modals = [];
          let statusText = "";
          const render = () => {
            const state = context.services.getState();
            const records = state.records;
            const snapshot = state.snapshot;
            clear(container);
            const statusRegion = h("p", {
              class: "edu-dialog__status",
              role: "status",
              "aria-live": "polite",
              "data-testid": "records-action-status",
              text: statusText
            });
            container.append(
              pageHeading(
                "\u8BB0\u5F55",
                "\u6309\u6559\u6750\u3001\u6982\u5FF5\u3001\u6A21\u5F0F\u548C\u65F6\u95F4\u56DE\u770B\u6D3B\u52A8\u3001\u7406\u89E3\u8BC1\u636E\u3001\u590D\u4E60\u5B89\u6392\u4E0E\u81EA\u8BC4\uFF1B\u4E09\u8F74\u5206\u5F00\u663E\u793A\uFF0C\u81EA\u8BC4\u5355\u72EC\u6807\u6CE8\u3002"
              )
            );
            if (records === null || snapshot === null) {
              container.append(
                emptyState({
                  title: "\u8FD8\u6CA1\u6709\u8BFB\u5230\u8BB0\u5F55",
                  body: "\u672C\u5730\u8BB0\u5F55\u5C1A\u672A\u6253\u5F00\u3002\u53EF\u4EE5\u91CD\u8BD5\uFF0C\u6216\u5148\u8FD4\u56DE\u9996\u9875\u3002",
                  actions: [
                    { label: "\u91CD\u8BD5", onClick: () => void api2.refresh() },
                    { label: "\u8FD4\u56DE\u9996\u9875", onClick: () => void api2.navigate("/home") }
                  ]
                })
              );
              return;
            }
            container.append(
              renderContextBar({
                courseEdition: `${snapshot.courseEdition.grade}\u5E74\u7EA7 \xB7 ${snapshot.courseEdition.editionLabel}`,
                packVersion: snapshot.pack.version,
                concept: null,
                mode: null,
                saveState: state.saveState,
                fixture: snapshot.fixture,
                backTarget: null
              })
            );
            if (state.offline) container.append(offlineNotice(() => void api2.refresh()));
            if (state.saveState === "failed" || records.saveState === "failed") {
              container.append(
                saveFailedNotice({
                  onRetry: () => void api2.retrySave(),
                  onCopy: () => {
                    const result = copyTextFallback("\u8BB0\u5F55\u9875\u9762\u5F53\u524D\u663E\u793A\u7684\u5185\u5BB9\u5C1A\u672A\u4FDD\u5B58\u3002");
                    statusText = result === "copied" ? "\u5DF2\u590D\u5236\u63D0\u793A\u6587\u5B57\u3002" : "\u65E0\u6CD5\u8BBF\u95EE\u526A\u8D34\u677F\uFF0C\u8BF7\u624B\u52A8\u9009\u62E9\u6587\u5B57\u590D\u5236\u3002";
                    statusRegion.textContent = statusText;
                  }
                })
              );
            }
            const concepts = snapshot.concepts;
            const range = records.rangeClaim;
            const rangeSection = h(
              "section",
              { class: "edu-section", "data-testid": "records-range-claim" },
              h("h2", { class: "edu-section__title" }, "\u5DF2\u5B66\u8303\u56F4\u81EA\u8FF0"),
              range === null ? h(
                "p",
                { class: "edu-section__lead" },
                "\u8FD8\u6CA1\u6709\u8BBE\u7F6E\u5DF2\u5B66\u8303\u56F4\u3002\u8FD9\u4E2A\u81EA\u8FF0\u7528\u4E8E\u63A8\u8350\u8D77\u70B9\uFF0C\u4E0D\u4EE3\u8868\u7CFB\u7EDF\u5DF2\u7ECF\u786E\u8BA4\u7406\u89E3\u3002"
              ) : h(
                "p",
                { class: "edu-section__lead" },
                `${RANGE_SCOPE_LABELS[range.scope]}${range.conceptIds.length > 0 ? `\uFF1A${range.conceptIds.map((id) => conceptTitle(concepts, id)).join("\u3001")}` : ""} \xB7 \u4FDD\u5B58\u4E8E ${formatDateTime(range.createdAt)}\u3002\u8FD9\u662F\u5B66\u751F\u81EA\u8FF0\uFF0C\u4E0D\u662F\u7406\u89E3\u8BC1\u636E\u3002`
              ),
              h(
                "div",
                { class: "edu-inline-actions" },
                button(range === null ? "\u53BB\u8BBE\u7F6E\u5DF2\u5B66\u8303\u56F4" : "\u4FEE\u6539\u5DF2\u5B66\u8303\u56F4", () => void api2.navigate("/first-run"), {
                  small: true
                })
              )
            );
            container.append(rangeSection);
            if (records.progresses.length === 0) {
              container.append(
                emptyState({
                  title: "\u8FD8\u6CA1\u6709\u5B66\u4E60\u8BB0\u5F55",
                  body: "\u4ECE\u5730\u56FE\u9009\u62E9\u6982\u5FF5\u5F00\u59CB\u5B66\u4E60\u540E\uFF0C\u8FD9\u91CC\u4F1A\u51FA\u73B0\u5B66\u4E60\u8FDB\u7A0B\u3001\u7406\u89E3\u8BC1\u636E\u4E0E\u590D\u4E60\u5B89\u6392\u3002",
                  testId: "records-empty",
                  actions: [
                    { label: "\u53BB\u5730\u56FE\u9009\u62E9\u6982\u5FF5", onClick: () => void api2.navigate("/map"), tone: "primary" },
                    { label: "\u53BB\u6559\u6750\u5E93", onClick: () => void api2.navigate("/library") }
                  ]
                })
              );
            } else {
              container.append(renderFilters(records, concepts, filter, render));
              const filtered = filterRecords(records, filter);
              if (filtered.length === 0) {
                container.append(
                  emptyState({
                    title: "\u5F53\u524D\u7B5B\u9009\u6CA1\u6709\u8BB0\u5F55",
                    body: "\u6E05\u9664\u7B5B\u9009\u53EF\u4EE5\u770B\u56DE\u5168\u90E8\u8BB0\u5F55\u3002",
                    testId: "records-filter-empty",
                    actions: [
                      {
                        label: "\u6E05\u9664\u7B5B\u9009",
                        onClick: () => {
                          filter.conceptId = "all";
                          filter.mode = "all";
                          filter.time = "all";
                          render();
                        },
                        tone: "primary"
                      }
                    ]
                  })
                );
              } else {
                const list = h("div", { class: "edu-list", "data-testid": "records-list" });
                for (const progress2 of filtered) {
                  list.append(renderConceptCard(progress2, records, concepts, container, modals));
                }
                container.append(list);
              }
            }
            container.append(renderDataManagement(api2, statusRegion, (note) => {
              statusText = note;
              void api2.refresh();
            }));
            container.append(statusRegion);
          };
          render();
          return void 0;
        },
        unmount() {
        }
      });
    }
    function renderFilters(records, concepts, filter, rerender) {
      const toolbar = h("div", { class: "edu-filters", "data-testid": "records-filters" });
      const conceptSelect = h("select", {
        class: "edu-select",
        id: "records-filter-concept",
        "aria-label": "\u6309\u6982\u5FF5\u7B5B\u9009",
        onchange: (event) => {
          filter.conceptId = event.currentTarget.value;
          rerender();
        }
      });
      conceptSelect.append(option("all", "\u5168\u90E8\u6982\u5FF5", filter.conceptId === "all"));
      for (const progress2 of records.progresses) {
        conceptSelect.append(
          option(
            progress2.conceptId,
            conceptTitle(concepts, progress2.conceptId),
            filter.conceptId === progress2.conceptId
          )
        );
      }
      const modeSelect = h("select", {
        class: "edu-select",
        id: "records-filter-mode",
        "aria-label": "\u6309\u6A21\u5F0F\u7B5B\u9009",
        onchange: (event) => {
          filter.mode = event.currentTarget.value;
          rerender();
        }
      });
      modeSelect.append(option("all", "\u5168\u90E8\u6A21\u5F0F", filter.mode === "all"));
      for (const mode of ["learn", "review", "diagnostic"]) {
        modeSelect.append(option(mode, SESSION_MODE_LABELS[mode], filter.mode === mode));
      }
      const timeSelect = h("select", {
        class: "edu-select",
        id: "records-filter-time",
        "aria-label": "\u6309\u65F6\u95F4\u7B5B\u9009",
        onchange: (event) => {
          filter.time = event.currentTarget.value;
          rerender();
        }
      });
      timeSelect.append(option("all", "\u5168\u90E8\u65F6\u95F4", filter.time === "all"));
      timeSelect.append(option("7", "\u6700\u8FD1 7 \u5929", filter.time === "7"));
      timeSelect.append(option("30", "\u6700\u8FD1 30 \u5929", filter.time === "30"));
      toolbar.append(
        h(
          "div",
          { class: "edu-field" },
          h("label", { class: "edu-field__label", for: "records-filter-book" }, "\u6559\u6750"),
          h(
            "select",
            { class: "edu-select", id: "records-filter-book", "aria-label": "\u6309\u6559\u6750\u7B5B\u9009" },
            option("current", "\u5F53\u524D\u6559\u6750\uFF08\u552F\u4E00\uFF09", true)
          )
        ),
        h("div", { class: "edu-field" }, h("label", { class: "edu-field__label", for: "records-filter-concept" }, "\u6982\u5FF5"), conceptSelect),
        h("div", { class: "edu-field" }, h("label", { class: "edu-field__label", for: "records-filter-mode" }, "\u6A21\u5F0F"), modeSelect),
        h("div", { class: "edu-field" }, h("label", { class: "edu-field__label", for: "records-filter-time" }, "\u65F6\u95F4"), timeSelect),
        button("\u6E05\u9664\u7B5B\u9009", () => {
          filter.conceptId = "all";
          filter.mode = "all";
          filter.time = "all";
          rerender();
        }, { small: true })
      );
      return toolbar;
    }
    function option(value, label, selected) {
      return h("option", { value, selected }, label);
    }
    function filterRecords(records, filter) {
      const now = Date.parse(records.now);
      const days = filter.time === "all" ? null : Number(filter.time);
      return records.progresses.filter((progress2) => {
        if (filter.conceptId !== "all" && progress2.conceptId !== filter.conceptId) return false;
        if (filter.mode !== "all") {
          const sessions = records.sessions.filter(
            (session) => session.conceptId === progress2.conceptId && session.mode === filter.mode
          );
          if (sessions.length === 0) return false;
        }
        if (days !== null) {
          const times = [
            progress2.learning.lastCompletedAt,
            progress2.understanding.updatedAt,
            progress2.review.lastCompletedAt,
            progress2.lastPosition.updatedAt
          ].filter((value) => value !== null);
          if (times.length === 0) return false;
          const recent = times.some((value) => now - Date.parse(value) <= days * 864e5);
          if (!recent) return false;
        }
        return true;
      });
    }
    function renderConceptCard(progress2, records, concepts, pageContainer, modals) {
      const title = conceptTitle(concepts, progress2.conceptId);
      const assessment = latestAssessment(records.assessments, progress2.conceptId);
      const history = assessmentsFor(records.assessments, progress2.conceptId);
      const evidence2 = records.evidence.filter((entry) => entry.conceptId === progress2.conceptId);
      const selfReport = records.selfReports.find((entry) => entry.conceptId === progress2.conceptId) ?? null;
      const latestSession = records.sessions.filter((session) => session.conceptId === progress2.conceptId).sort((a, b) => Date.parse(b.startedAt) - Date.parse(a.startedAt))[0] ?? null;
      const card = h(
        "article",
        { class: "edu-card", "data-concept-id": progress2.conceptId, "data-testid": `record-${progress2.conceptId}` },
        h(
          "header",
          { class: "edu-page__header" },
          h("h2", { class: "edu-card__title" }, title),
          h(
            "p",
            { class: "edu-card__meta" },
            `\u5185\u5BB9\u5305 ${progress2.packVersion} \xB7 ${latestSession === null ? "\u6682\u65E0\u6D3B\u52A8" : `${SESSION_MODE_LABELS[latestSession.mode]} \xB7 ${positionLabel(latestSession.resumeCursor.activityId, latestSession.resumeCursor.cursor)}`}`
          )
        )
      );
      const axisGrid = h("div", { class: "edu-axis-grid" });
      axisGrid.append(
        axis(
          "\u5B66\u4E60\u8FDB\u7A0B",
          [statusChip(LEARNING_LABELS[progress2.learning.state], learningTone(progress2.learning.state))],
          [
            h(
              "p",
              { class: "edu-axis__body" },
              progress2.learning.lastCompletedAt === null ? `\u5F00\u59CB\u65F6\u95F4\uFF1A${formatDateTime(progress2.learning.startedAt)}` : `\u4E0A\u6B21\u5B8C\u6210\uFF1A${formatDateTime(progress2.learning.lastCompletedAt)}`
            )
          ],
          "learning"
        ),
        axis(
          "\u7406\u89E3\u8BC1\u636E",
          [
            statusChip(
              UNDERSTANDING_LABELS[progress2.understanding.state],
              understandingTone(progress2.understanding.state)
            ),
            statusChip(VALIDITY_LABELS[progress2.understanding.validity], "neutral")
          ],
          [
            h(
              "p",
              { class: "edu-axis__body" },
              assessment === null ? "\u8FD8\u6CA1\u6709\u5F62\u6210\u7406\u89E3\u5224\u65AD\u3002" : `\u5224\u65AD\u65F6\u95F4\uFF1A${formatDateTime(assessment.assessedAt)} \xB7 \u5173\u8054\u8BC1\u636E ${evidence2.length} \u6761`
            ),
            ...assessment !== null ? [
              h(
                "div",
                { class: "edu-inline-actions" },
                button(
                  "\u67E5\u770B\u4F9D\u636E",
                  () => {
                    const trigger = pageContainer.ownerDocument.activeElement;
                    const modal = new Modal(
                      `\u5224\u65AD\u4F9D\u636E\uFF1A${title}`,
                      renderEvidenceDetail({ conceptTitle: title, assessment, evidence: evidence2 })
                    );
                    modals.push(modal);
                    modal.open(
                      trigger instanceof HTMLElement ? trigger : pageContainer,
                      pageContainer
                    );
                  },
                  { small: true, dataAction: "open-evidence" }
                )
              )
            ] : []
          ],
          "understanding"
        ),
        reviewAxis(progress2)
      );
      card.append(axisGrid);
      const selfAxis = h(
        "section",
        { class: "edu-axis edu-self-report", "data-axis": "self-report" },
        h(
          "div",
          { class: "edu-axis__head" },
          h("h3", { class: "edu-axis__title" }, "\u81EA\u8BC4\uFF08\u5B66\u751F\u81EA\u8FF0\uFF09"),
          selfReport === null ? statusChip("\u672A\u586B\u5199\uFF08\u53EF\u9009\uFF09", "neutral") : statusChip(SELF_REPORT_LABELS[selfReport.claimedState], "info")
        ),
        h(
          "p",
          { class: "edu-axis__body" },
          selfReport === null ? "\u81EA\u8BC4\u662F\u53EF\u9009\u7684\u5B66\u751F\u89C2\u70B9\uFF0C\u4E0D\u4F1A\u66FF\u4EE3\u6216\u8986\u76D6\u7406\u89E3\u8BC1\u636E\u5224\u65AD\u3002" : `\u5B66\u751F\u81EA\u5DF1\u7684\u611F\u53D7 \xB7 ${formatDateTime(selfReport.createdAt)}\u3002\u4E0E\u7CFB\u7EDF\u8BC1\u636E\u5E76\u5217\u663E\u793A\uFF0C\u4E0D\u53C2\u4E0E\u5224\u5B9A\u3002`
        )
      );
      card.append(selfAxis);
      if (history.length > 0) {
        card.append(
          h("h3", { class: "edu-card__title" }, "\u5224\u65AD\u53D8\u5316\uFF08\u65E7 \u2192 \u65B0\uFF09"),
          h(
            "ol",
            { class: "edu-timeline", "data-testid": "record-assessment-history" },
            ...history.map((entry) => {
              const historicalEvidence = evidence2.filter((item) => entry.evidenceIds.includes(item.id));
              return h(
                "li",
                {},
                h("time", { datetime: entry.assessedAt }, formatDateTime(entry.assessedAt)),
                ` \xB7 ${UNDERSTANDING_LABELS[entry.state]} \xB7 `,
                h("span", { class: "edu-muted" }, entry.rationale),
                h(
                  "div",
                  { class: "edu-inline-actions" },
                  button(
                    "\u67E5\u770B\u5F53\u65F6\u4F9D\u636E",
                    () => {
                      const trigger = pageContainer.ownerDocument.activeElement;
                      const modal = new Modal(
                        `\u5224\u65AD\u4F9D\u636E\uFF08${formatDateTime(entry.assessedAt)}\uFF09\uFF1A${title}`,
                        renderEvidenceDetail({
                          conceptTitle: title,
                          assessment: entry,
                          evidence: historicalEvidence
                        })
                      );
                      modals.push(modal);
                      modal.open(
                        trigger instanceof HTMLElement ? trigger : pageContainer,
                        pageContainer
                      );
                    },
                    { small: true, dataAction: "open-historical-evidence" }
                  )
                )
              );
            })
          )
        );
      }
      if (evidence2.length > 0) {
        card.append(
          h(
            "p",
            { class: "edu-card__meta" },
            `\u5DF2\u6709\u8BC1\u636E\uFF1A${evidence2.map((entry) => `${EVIDENCE_KIND_LABELS[entry.kind]}\uFF08${ASSISTANCE_LABELS[entry.assistance]}\uFF09`).join("\u3001")}`
          )
        );
      }
      return card;
    }
    function renderDataManagement(api2, status, onDeleted) {
      const section = h(
        "section",
        { class: "edu-section", "data-testid": "records-data-management" },
        h("h2", { class: "edu-section__title" }, "\u5BFC\u51FA\u4E0E\u5220\u9664"),
        h(
          "p",
          { class: "edu-section__lead" },
          "\u5BFC\u51FA\u4E0E\u5220\u9664\u53EA\u4F5C\u7528\u4E8E\u672C\u673A\u5B66\u4E60\u8BB0\u5F55\uFF1B\u6559\u6750\u6587\u4EF6\u4E0E\u5171\u4EAB\u5185\u5BB9\u4E0D\u4F1A\u88AB\u5220\u9664\u3002\u6BCF\u4E2A\u64CD\u4F5C\u90FD\u4F1A\u5148\u8BF4\u660E\u5F71\u54CD\uFF0C\u518D\u8981\u6C42\u786E\u8BA4\u3002"
        )
      );
      const exportDialog = new ConfirmDialog({
        title: "\u5BFC\u51FA\u6211\u7684\u8BB0\u5F55",
        impact: [
          "\u5BFC\u51FA\u5185\u5BB9\uFF1A\u5B66\u4E60\u6D3B\u52A8\u3001\u4F5C\u7B54\u3001\u7406\u89E3\u8BC1\u636E\u3001\u81EA\u8BC4\u4E0E\u590D\u4E60\u5B89\u6392\u3002",
          "\u4E0D\u4F1A\u5305\u542B\u6559\u6750\u539F\u6587\u4EF6\u3001\u6559\u6750\u539F\u56FE\u6216\u5171\u4EAB\u5185\u5BB9\u3002",
          "\u5BFC\u51FA\u6587\u4EF6\u4F1A\u4FDD\u5B58\u5230\u4F60\u9009\u62E9\u7684\u4F4D\u7F6E\uFF1B\u8BF7\u81EA\u884C\u59A5\u5584\u4FDD\u7BA1\u3002"
        ],
        confirmLabel: "\u786E\u8BA4\u5BFC\u51FA",
        onConfirm: () => {
          void (async () => {
            const result = await api2.exportData();
            if (result.ok) {
              status.textContent = `\u5DF2\u5BFC\u51FA ${result.data.recordCount} \u6761\u8BB0\u5F55\uFF08\u6F14\u793A\u6570\u636E\uFF0C\u672A\u5199\u5165\u771F\u5B9E\u6587\u4EF6\uFF09\u3002${result.data.note}`;
            } else {
              status.replaceChildren(renderErrorBanner(result.error, { headingLevel: "h3" }));
            }
          })();
        }
      });
      const deleteLearningDialog = new ConfirmDialog({
        title: "\u5220\u9664\u5B66\u4E60\u8BB0\u5F55",
        tone: "danger",
        acknowledgement: "\u6211\u4E86\u89E3\u6B64\u64CD\u4F5C\u4E0D\u53EF\u64A4\u9500\uFF0C\u4E14\u6559\u6750\u6587\u4EF6\u4E0D\u4F1A\u88AB\u5220\u9664\u3002",
        impact: [
          "\u5C06\u5220\u9664\u672C\u673A\u533F\u540D\u6863\u6848\u4E0B\u7684\u4F5C\u7B54\u3001\u7406\u89E3\u8BC1\u636E\u3001\u81EA\u8BC4\u3001\u5B66\u4E60\u8FDB\u7A0B\u4E0E\u590D\u4E60\u5B89\u6392\u3002",
          "\u6559\u6750\u6587\u4EF6\u3001\u6559\u6750\u539F\u56FE\u4E0E\u5171\u4EAB\u5185\u5BB9\u4E0D\u4F1A\u88AB\u5220\u9664\u3002",
          "\u5220\u9664\u540E\u8BB0\u5F55\u4E3A\u7A7A\uFF0C\u91CD\u542F\u540E\u4ECD\u4FDD\u6301\u4E00\u81F4\uFF1B\u4E0D\u4F1A\u81EA\u52A8\u4ECE\u4E91\u7AEF\u6062\u590D\u3002"
        ],
        confirmLabel: "\u786E\u8BA4\u5220\u9664\u5B66\u4E60\u8BB0\u5F55",
        onConfirm: () => {
          void (async () => {
            const result = await api2.deleteData("learning_records");
            if (result.ok) {
              status.textContent = result.data.note;
              onDeleted(result.data.note);
            } else {
              status.replaceChildren(renderErrorBanner(result.error, { headingLevel: "h3" }));
            }
          })();
        }
      });
      const removeBookDialog = new ConfirmDialog({
        title: "\u79FB\u9664\u8FD9\u672C\u6559\u6750\u7684\u672C\u673A\u5173\u8054",
        tone: "danger",
        acknowledgement: "\u6211\u4E86\u89E3\u53EA\u79FB\u9664\u672C\u673A\u5173\u8054\uFF0C\u4E0D\u4F1A\u5220\u9664\u6559\u6750\u6E90\u6587\u4EF6\u3002",
        impact: [
          "\u5C06\u79FB\u9664\u672C\u673A\u4E0E\u8FD9\u672C\u6559\u6750\u7684\u5173\u8054\u548C\u5BFC\u5165\u8BB0\u5F55\u3002",
          "\u4E0D\u4F1A\u5220\u9664\u6559\u6750 PDF\u3001\u539F\u56FE\u6216\u5171\u4EAB\u5185\u5BB9\u3002",
          "\u5DF2\u4FDD\u5B58\u7684\u5B66\u4E60\u8BB0\u5F55\u4ECD\u4FDD\u7559\uFF0C\u53EF\u5728\u8BB0\u5F55\u4E2D\u67E5\u770B\uFF1B\u4E0D\u4F1A\u81EA\u52A8\u8FC1\u79FB\u5230\u5176\u4ED6\u6559\u6750\u3002"
        ],
        confirmLabel: "\u786E\u8BA4\u79FB\u9664\u6559\u6750\u5173\u8054",
        onConfirm: () => {
          void (async () => {
            const result = await api2.deleteData("book_link");
            if (result.ok) {
              status.textContent = result.data.note;
            } else {
              status.replaceChildren(renderErrorBanner(result.error, { headingLevel: "h3" }));
            }
          })();
        }
      });
      const actions = h("div", { class: "edu-inline-actions" });
      const exportButton = button("\u5BFC\u51FA\u6211\u7684\u8BB0\u5F55", () => exportDialog.open(exportButton, section), {
        small: true,
        dataAction: "export-records"
      });
      const deleteButton = button("\u5220\u9664\u5B66\u4E60\u8BB0\u5F55", () => deleteLearningDialog.open(deleteButton, section), {
        small: true,
        tone: "danger-ghost",
        dataAction: "delete-records"
      });
      const bookButton = button("\u79FB\u9664\u6559\u6750\u5173\u8054", () => removeBookDialog.open(bookButton, section), {
        small: true,
        tone: "danger-ghost",
        dataAction: "remove-book-link"
      });
      actions.append(exportButton, deleteButton, bookButton);
      section.append(actions);
      section.append(exportDialog.element, deleteLearningDialog.element, removeBookDialog.element);
      return section;
    }
    
    // education/client/shell/src/pages/workspace.ts
    function queryOf(path) {
      const index = path.indexOf("?");
      return new URLSearchParams(index >= 0 ? path.slice(index + 1) : "");
    }
    function createWorkspacePage() {
      return definePage({
        id: "shell.workspace",
        path: "/workspace",
        title: "\u5DE5\u4F5C\u533A",
        requiresLearner: true,
        fallback: true,
        mount(container, context) {
          const api2 = context.services.shell;
          const state = context.services.getState();
          const snapshot = state.snapshot;
          container.append(
            pageHeading("\u5DE5\u4F5C\u533A", "\u6750\u6599\u4E0E\u5F53\u524D\u6D3B\u52A8\u5728\u4E3B\u8981\u533A\u57DF\uFF1B\u89E3\u91CA\u4E0E\u53CD\u9988\u4F5C\u4E3A\u8F85\u52A9\u533A\uFF0C\u53EF\u6536\u8D77\u3002")
          );
          if (snapshot === null) {
            container.append(
              emptyState({
                title: "\u8FD8\u6CA1\u6709\u6253\u5F00\u5B66\u4E60\u6D3B\u52A8",
                body: "\u5148\u9009\u62E9\u6559\u6750\u548C\u6982\u5FF5\uFF0C\u518D\u8FDB\u5165\u5DE5\u4F5C\u533A\u3002",
                actions: [{ label: "\u53BB\u5730\u56FE", onClick: () => void api2.navigate("/map"), tone: "primary" }]
              })
            );
            return;
          }
          const resume = state.resume;
          const query = queryOf(state.currentPath);
          const queryMode = query.get("mode");
          const queryConcept = query.get("concept");
          const explicitMode = queryMode === "learn" || queryMode === "review" || queryMode === "diagnostic" ? queryMode : null;
          const currentMode = resume?.session.mode ?? state.home?.activeSession?.mode ?? null;
          const startsNewActivity = query.get("new") === "1" || explicitMode !== null && explicitMode !== currentMode;
          const active = startsNewActivity ? null : resume?.session ?? state.home?.activeSession ?? null;
          const mode = explicitMode ?? active?.mode ?? null;
          const conceptId = (startsNewActivity ? queryConcept : null) ?? active?.conceptId ?? queryConcept;
          const concept2 = conceptId === null ? null : conceptTitle(snapshot.concepts, conceptId);
          container.append(
            renderContextBar({
              courseEdition: courseEditionLabel(snapshot.courseEdition),
              packVersion: active?.packVersion ?? snapshot.pack.version,
              concept: concept2,
              mode: mode === null ? null : SESSION_MODE_LABELS[mode],
              saveState: state.saveState,
              fixture: snapshot.fixture,
              backTarget: state.backTarget?.label ?? null,
              onBack: state.backTarget === null ? void 0 : () => void api2.back()
            })
          );
          if (state.offline) container.append(offlineNotice(() => void api2.refresh()));
          if (active !== null && resume !== null) {
            container.append(
              h(
                "section",
                { class: "edu-section", "data-testid": "workspace-resume" },
                h("h2", { class: "edu-section__title" }, "\u5DF2\u6062\u590D\u4E0A\u6B21\u6D3B\u52A8"),
                h(
                  "div",
                  { class: "edu-card" },
                  h(
                    "dl",
                    { class: "edu-kv" },
                    h("dt", {}, "\u6559\u6750"),
                    h("dd", {}, courseEditionLabel(snapshot.courseEdition)),
                    h("dt", {}, "\u6982\u5FF5"),
                    h("dd", {}, resume.conceptTitle),
                    h("dt", {}, "\u6A21\u5F0F"),
                    h("dd", {}, SESSION_MODE_LABELS[active.mode]),
                    h("dt", {}, "\u6D3B\u52A8"),
                    h("dd", {}, resume.activityId ?? "\u672A\u8BB0\u5F55"),
                    h("dt", {}, "\u4E0A\u6B21\u4F4D\u7F6E"),
                    h("dd", {}, resume.cursor ?? "\u672A\u8BB0\u5F55"),
                    h("dt", {}, "\u4F4D\u7F6E\u8BF4\u660E"),
                    h("dd", {}, resume.positionLabel),
                    h("dt", {}, "\u5185\u5BB9\u5305"),
                    h("dd", {}, `${resume.packVersion} \xB7 ${TRUST_MODE_LABELS[active.trustMode]}`),
                    h("dt", {}, "\u8349\u7A3F"),
                    h("dd", {}, resume.draftRestored ? "\u5DF2\u6062\u590D\u672C\u673A\u8349\u7A3F" : "\u6CA1\u6709\u5F85\u6062\u590D\u8349\u7A3F"),
                    h("dt", {}, "\u4F1A\u8BDD\u72B6\u6001"),
                    h("dd", {}, SESSION_STATUS_LABELS[active.status]),
                    h("dt", {}, "\u5F00\u59CB\u65F6\u95F4"),
                    h("dd", {}, h("time", { datetime: active.startedAt }, formatDateTime(active.startedAt)))
                  ),
                  h(
                    "p",
                    { class: "edu-card__meta" },
                    "\u7EE7\u7EED\u7684\u662F\u540C\u4E00\u4E2A\u6D3B\u52A8\uFF0C\u4E0D\u4F1A\u65B0\u5EFA\u4E00\u4EFD\u5BF9\u8BDD\uFF1B\u5DF2\u4FDD\u5B58\u7684\u8349\u7A3F\u4E0E\u4F5C\u7B54\u4FDD\u6301\u539F\u4F4D\u3002"
                  )
                )
              )
            );
          } else if (mode !== null) {
            container.append(
              notice({
                tone: "info",
                title: concept2 === null ? `\u51C6\u5907\u5F00\u59CB\uFF1A${SESSION_MODE_LABELS[mode]}` : `\u51C6\u5907\u5F00\u59CB\uFF1A${concept2} \xB7 ${SESSION_MODE_LABELS[mode]}`,
                body: concept2 === null ? "\u8BF7\u9009\u62E9\u8981\u590D\u4E60\u7684\u8303\u56F4\uFF1B\u5F85\u590D\u4E60\u6982\u5FF5\u53EF\u4ECE\u5730\u56FE\u6216\u8BB0\u5F55\u4E2D\u6253\u5F00\u3002\u6D3B\u52A8\u9762\u677F\u4F1A\u5728\u8FD9\u91CC\u6302\u8F7D\u3002" : "\u6D3B\u52A8\u9762\u677F\u4F1A\u5728\u8FD9\u91CC\u6253\u5F00\u3002\u73B0\u5728\u8FD4\u56DE\u5730\u56FE\u3001\u8BB0\u5F55\u6216\u9996\u9875\u90FD\u4E0D\u4F1A\u4E22\u5931\u5F53\u524D\u6559\u6750\u4E0E\u6982\u5FF5\u9009\u62E9\u3002",
                actions: mode === "diagnostic" ? [
                  {
                    label: "\u4E2D\u6B62\u8BCA\u65AD\u5E76\u8FD4\u56DE\u9996\u9875",
                    onClick: () => {
                      api2.setDiagnosticSkipped(true);
                      void api2.navigate("/home");
                    }
                  }
                ] : concept2 === null ? [{ label: "\u53BB\u5730\u56FE\u9009\u62E9\u8303\u56F4", onClick: () => void api2.navigate("/map") }] : void 0
              })
            );
          } else {
            container.append(
              emptyState({
                title: "\u5DE5\u4F5C\u533A\u8FD8\u6CA1\u6709\u6253\u5F00\u7684\u5B66\u4E60\u6D3B\u52A8",
                body: "\u4ECE\u5730\u56FE\u9009\u62E9\u6982\u5FF5\u8FDB\u5165\u5B66\u4E60\uFF0C\u6216\u5728\u9996\u9875\u7EE7\u7EED\u4E0A\u6B21\uFF1B\u590D\u4E60\u4E5F\u53EF\u4EE5\u4ECE\u9996\u9875\u6216\u5730\u56FE\u5F00\u59CB\u3002",
                testId: "workspace-empty",
                actions: [
                  { label: "\u53BB\u5730\u56FE\u9009\u62E9\u6982\u5FF5", onClick: () => void api2.navigate("/map"), tone: "primary" },
                  { label: "\u8FD4\u56DE\u9996\u9875", onClick: () => void api2.navigate("/home") }
                ]
              })
            );
          }
          container.append(
            h(
              "section",
              { class: "edu-section", "data-testid": "workspace-slots" },
              h("h2", { class: "edu-section__title" }, "\u5B66\u4E60\u4E0E\u56FE\u793A\u533A\u57DF"),
              h(
                "p",
                { class: "edu-section__lead" },
                "\u5F53\u524D\u6D3B\u52A8\u3001\u53CD\u9988\u4E0E\u56FE\u793A\u5206\u522B\u5728\u8FD9\u91CC\u6302\u8F7D\uFF1B\u79BB\u5F00\u5DE5\u4F5C\u533A\u65F6\uFF0C\u5DF2\u6302\u8F7D\u7684\u9762\u677F\u4F1A\u5378\u8F7D\uFF0C\u72B6\u6001\u4ECD\u4FDD\u7559\u5728\u672C\u673A\u8BB0\u5F55\u4E2D\u3002"
              ),
              h("div", { class: "edu-slot", "data-edu-slot": "study:activity", "data-testid": "slot-study-activity" }),
              h("div", { class: "edu-slot", "data-edu-slot": "study:feedback", "data-testid": "slot-study-feedback" }),
              h("div", { class: "edu-slot", "data-edu-slot": "study:visuals", "data-testid": "slot-study-visuals" })
            )
          );
          container.append(
            h(
              "div",
              { class: "edu-inline-actions" },
              button("\u67E5\u770B\u8BB0\u5F55", () => void api2.navigate("/records")),
              button("\u8FD4\u56DE\u5730\u56FE", () => void api2.navigate("/map")),
              button("\u8FD4\u56DE\u9996\u9875", () => void api2.navigate("/home"))
            )
          );
        }
      });
    }
    
    // education/client/shell/src/slots.ts
    var SlotRegistryError = class extends Error {
      constructor(message) {
        super(message);
        this.name = "SlotRegistryError";
      }
    };
    var EducationSlotRegistry = class {
      panels = /* @__PURE__ */ new Map();
      constructor() {
        for (const name of SHELL_SLOT_NAMES) this.panels.set(name, []);
      }
      register(name, panel) {
        if (!SHELL_SLOT_NAMES.includes(name)) {
          throw new SlotRegistryError(`unknown shell slot: ${String(name)}`);
        }
        if (panel.id.trim().length === 0) throw new SlotRegistryError("panel id must not be empty");
        const list = this.panels.get(name);
        if (list.some((entry) => entry.id === panel.id)) {
          throw new SlotRegistryError(`duplicate panel id in ${name}: ${panel.id}`);
        }
        list.push(panel);
        return () => {
          const index = list.indexOf(panel);
          if (index >= 0) list.splice(index, 1);
        };
      }
      list(name) {
        return [...this.panels.get(name) ?? []];
      }
    };
    
    // education/client/shell/src/shell.ts
    var NAV_ITEMS = [
      { path: "/library", label: "\u6559\u6750\u5E93" },
      { path: "/map", label: "\u5730\u56FE" },
      { path: "/workspace", label: "\u5DE5\u4F5C\u533A" },
      { path: "/records", label: "\u8BB0\u5F55" }
    ];
    var EducationShell = class {
      root;
      pages;
      slots;
      data;
      keyPort;
      options;
      clock;
      ids;
      state;
      api;
      services;
      navHost;
      contextHost;
      toolsHost;
      main;
      pageHost;
      liveRegion;
      history = [];
      mountedPanels = [];
      currentPage = null;
      currentQuery = new URLSearchParams();
      container = null;
      homePromise = null;
      recordsPromise = null;
      renderToken = 0;
      requestCounter = 0;
      disposed = false;
      lastRangeInput = null;
      constructor(options) {
        this.options = options;
        this.data = options.data;
        this.keyPort = options.keyPort ?? (options.data.kind === "live" ? createHttpAuthKeyPort() : createUnsupportedAuthKeyPort());
        this.clock = options.clock ?? { now: () => (/* @__PURE__ */ new Date()).toISOString() };
        this.ids = options.ids ?? {
          next: (prefix) => {
            this.requestCounter += 1;
            return `${prefix}.${this.requestCounter}`;
          }
        };
        const initialPath = options.initialPath ?? readInitialPath();
        this.state = {
          currentPath: initialPath,
          currentPageTitle: "\u9996\u9875",
          snapshot: null,
          home: null,
          records: null,
          dataStatus: "idle",
          pageError: null,
          fatalError: null,
          offline: false,
          saveState: "unknown",
          resume: null,
          resumeError: null,
          rangeClaim: null,
          backTarget: null,
          diagnosticSkipped: false,
          fontScale: options.fontScale ?? "standard",
          keyStatus: "unknown",
          keySuffix: null
        };
        this.api = {
          getState: () => this.state,
          navigate: (path) => this.navigate(path),
          back: () => this.back(),
          refresh: () => this.refresh(),
          resumeLast: () => this.resumeLast(),
          saveRange: (input) => this.saveRange(input),
          retrySave: () => this.retrySave(),
          exportData: () => this.exportData(),
          deleteData: (scope) => this.deleteData(scope),
          setDiagnosticSkipped: (skipped) => {
            this.state.diagnosticSkipped = skipped;
          },
          setFontScale: (scale) => this.setFontScale(scale),
          loadKeyStatus: () => this.loadKeyStatus(),
          saveKey: (apiKey) => this.saveKey(apiKey),
          clearKey: () => this.clearKey()
        };
        this.pages = new EducationPageRegistry();
        this.slots = new EducationSlotRegistry();
        this.pages.register(createHomePage());
        this.pages.register(createLibraryFallbackPage());
        this.pages.register(createMapFallbackPage());
        this.pages.register(createWorkspacePage());
        this.pages.register(createRecordsPage());
        this.pages.register(createFirstRunPage());
        this.pages.register(createAccountPage());
        this.pages.register(createNotFoundPage());
        this.root = h("div", {
          class: "edu-shell",
          "data-edu-shell": "true",
          "data-font-scale": this.state.fontScale
        });
        this.navHost = h("nav", { class: "edu-nav", "aria-label": "\u4E3B\u5BFC\u822A", "data-testid": "edu-nav" });
        this.contextHost = h("div", { "data-testid": "edu-context-host" });
        this.toolsHost = h("div", { class: "edu-header__tools", "data-testid": "edu-header-tools" });
        this.pageHost = h("div", { class: "edu-main__inner", "data-testid": "page-host" });
        this.liveRegion = h("p", {
          class: "edu-visually-hidden",
          role: "status",
          "aria-live": "polite",
          "data-testid": "edu-live-region"
        });
        this.main = h(
          "main",
          { class: "edu-main", id: "edu-main", tabindex: -1, "data-testid": "edu-main" },
          this.pageHost,
          this.liveRegion
        );
        const services = {
          data: this.data,
          shell: this.api,
          clock: this.clock,
          ids: this.ids,
          learnerId: null,
          host: options.host ?? null,
          slots: this.slots,
          getState: () => this.state
        };
        Object.defineProperty(services, "learnerId", {
          get: () => this.state.snapshot?.learner.id ?? null,
          enumerable: true
        });
        this.services = services;
        this.buildFrame();
      }
      getState() {
        return this.state;
      }
      buildFrame() {
        const skip = h(
          "a",
          {
            class: "edu-skip-link",
            href: "#edu-main",
            onclick: (event) => {
              event.preventDefault();
              this.main.focus();
            }
          },
          "\u8DF3\u5230\u4E3B\u8981\u5185\u5BB9"
        );
        const brand = h(
          "button",
          {
            type: "button",
            class: "edu-brand",
            onclick: () => void this.navigate("/home"),
            "data-action": "brand-home"
          },
          h("span", { class: "edu-brand__mark", "aria-hidden": "true" }, "\u80B2"),
          h("span", {}, "\u751F\u7269\u5B66\u4E60")
        );
        const top = h("div", { class: "edu-header__top" }, brand, this.toolsHost);
        const header = h("header", { class: "edu-header" }, top, this.contextHost);
        const layout = h(
          "div",
          { class: "edu-layout" },
          h("aside", { class: "edu-sidebar" }, this.navHost),
          this.main
        );
        const footer = h(
          "footer",
          { class: "edu-footer" },
          h("p", {}, "\u5B66\u4E60\u8BB0\u5F55\u4FDD\u5B58\u5728\u8FD9\u53F0\u7535\u8111\uFF1B\u4E91\u7AEF\u667A\u80FD\u53CD\u9988\u9700\u8981\u5DF2\u914D\u7F6E\u7684\u6A21\u578B\u670D\u52A1\u3002"),
          h("p", {}, "\u5B66\u751F\u6743\u9650\u53EA\u5305\u542B\u5B66\u4E60\u76F8\u5173\u80FD\u529B\uFF1B\u7CFB\u7EDF\u7EA7\u6587\u4EF6\u4E0E\u547D\u4EE4\u80FD\u529B\u4E0D\u7531\u5BA2\u6237\u7AEF\u6388\u4E88\u3002")
        );
        this.root.append(skip, header, layout, footer);
        this.renderNav();
        this.renderHeaderTools();
        this.renderContext();
      }
      renderNav() {
        clear(this.navHost);
        const current = this.state.currentPath.split("?")[0] ?? "/";
        for (const item of NAV_ITEMS) {
          const active = current === item.path || current.startsWith(`${item.path}/`);
          const link = h(
            "button",
            {
              type: "button",
              class: "edu-nav__link",
              "aria-current": active ? "page" : void 0,
              "data-nav-path": item.path,
              onclick: () => void this.navigate(item.path)
            },
            h("span", {}, item.label),
            active ? h("span", { class: "edu-nav__current" }, "\u5F53\u524D") : null
          );
          this.navHost.append(link);
        }
      }
      renderHeaderTools() {
        clear(this.toolsHost);
        const snapshot = this.state.snapshot;
        if (this.state.keyStatus === "missing") {
          const localMode = statusChip("\u672C\u5730\u6A21\u5F0F", "neutral");
          localMode.setAttribute("data-testid", "local-mode-badge");
          localMode.title = "\u672A\u914D\u7F6E\u6A21\u578B Key\uFF1B\u6559\u6750\u3001\u5730\u56FE\u4E0E\u8BB0\u5F55\u4ECD\u53EF\u5728\u672C\u673A\u4F7F\u7528\u3002";
          this.toolsHost.append(localMode);
        }
        this.toolsHost.append(
          h(
            "button",
            {
              type: "button",
              class: "edu-account-link",
              onclick: () => void this.navigate("/account"),
              "data-action": "account-status",
              title: "\u8D26\u6237\u4E0E\u6A21\u578B\u670D\u52A1\u72B6\u6001\u5206\u5F00\u663E\u793A\uFF1B\u4E0D\u5305\u542B\u51ED\u636E"
            },
            h("span", {}, "\u8D26\u6237\u4E0E\u6A21\u578B\u670D\u52A1"),
            snapshot === null ? statusChip("\u72B6\u6001\u8BFB\u53D6\u4E2D", "neutral") : snapshot.auth.apiKey.status === "available" ? statusChip("\u4E91\u63A8\u7406\u53EF\u7528", "positive") : statusChip("\u4E91\u63A8\u7406\u4E0D\u53EF\u7528", "attention")
          )
        );
        if (snapshot !== null && snapshot.fixture) this.toolsHost.append(fixtureBadge());
      }
      renderContext() {
        const snapshot = this.state.snapshot;
        const path = this.state.currentPath.split("?")[0] ?? "";
        const routeQuery = queryOf2(this.state.currentPath);
        const routeMode = path === "/workspace" && (routeQuery.get("mode") === "learn" || routeQuery.get("mode") === "review" || routeQuery.get("mode") === "diagnostic") ? routeQuery.get("mode") : null;
        const routeConcept = path === "/workspace" ? routeQuery.get("concept") : null;
        const active = this.state.resume?.session ?? this.state.home?.activeSession ?? null;
        const conceptId = routeConcept ?? active?.conceptId ?? null;
        const concept2 = routeConcept !== null ? snapshot?.concepts.find((entry) => entry.id === routeConcept)?.title ?? routeConcept : this.state.resume?.conceptTitle ?? (conceptId === null || snapshot === null ? null : snapshot.concepts.find((entry) => entry.id === conceptId)?.title ?? null);
        const mode = routeMode ?? (active === null ? null : active.mode);
        clear(this.contextHost);
        this.contextHost.append(
          renderContextBar({
            courseEdition: snapshot === null ? null : courseEditionLabel(snapshot.courseEdition),
            packVersion: snapshot?.pack.version ?? null,
            concept: concept2,
            mode: mode === null ? null : SESSION_MODE_LABELS[mode],
            saveState: this.state.saveState,
            fixture: snapshot?.fixture ?? false,
            backTarget: this.state.backTarget?.label ?? null,
            onBack: this.state.backTarget === null ? void 0 : () => void this.back()
          })
        );
        const page = this.pages.resolve(this.state.currentPath.split("?")[0] ?? "");
        this.state.currentPageTitle = page?.title ?? "\u9875\u9762\u4E0D\u5B58\u5728";
      }
      async mount(container) {
        if (this.container !== null) throw new Error("education shell is already mounted");
        this.container = container;
        ensureEducationStyles(container.ownerDocument);
        container.append(this.root);
        this.state.dataStatus = "loading";
        const token = ++this.renderToken;
        const result = await this.data.loadSnapshot(this.newRequest());
        if (this.disposed || token !== this.renderToken) return;
        if (!result.ok) {
          this.state.fatalError = result.error;
          this.state.dataStatus = "error";
          this.renderFatalError();
          return;
        }
        this.acceptSnapshot(result);
        await this.loadKeyStatus();
        this.renderHeaderTools();
        this.renderContext();
        await this.renderRoute();
      }
      async unmount() {
        if (this.disposed) return;
        this.disposed = true;
        this.renderToken += 1;
        await this.unmountCurrentPage();
        this.container?.removeChild(this.root);
        this.container = null;
      }
      registerPage(page) {
        this.pages.register(page);
        const currentPath = this.state.currentPath.split("?")[0] ?? "";
        if (currentPath === page.path && this.container !== null) void this.renderRoute();
      }
      registerPanel(name, panel) {
        return this.slots.register(name, panel);
      }
      async navigate(path, force = false) {
        const normalized = normalizePath(path);
        if (!force && normalized === this.state.currentPath) return;
        if (normalized !== this.state.currentPath) {
          this.history.push({
            path: this.state.currentPath,
            label: this.state.currentPageTitle
          });
        }
        this.state.currentPath = normalized;
        this.state.backTarget = this.history[this.history.length - 1] ?? null;
        this.state.pageError = null;
        this.state.resumeError = null;
        if (optionsHasNewActivity(normalized)) this.state.resume = null;
        this.renderNav();
        this.renderContext();
        await this.renderRoute();
      }
      async back() {
        const previous = this.history.pop();
        if (previous === void 0) return;
        this.state.currentPath = previous.path;
        this.state.backTarget = this.history[this.history.length - 1] ?? null;
        this.state.pageError = null;
        this.state.resumeError = null;
        this.renderNav();
        this.renderContext();
        await this.renderRoute();
      }
      async refresh() {
        if (this.state.fatalError !== null) {
          this.state.fatalError = null;
          this.state.dataStatus = "loading";
          const result = await this.data.loadSnapshot(this.newRequest());
          if (!result.ok) {
            this.state.fatalError = result.error;
            this.state.dataStatus = "error";
            this.renderFatalError();
            return;
          }
          this.acceptSnapshot(result);
        } else {
          const result = await this.data.loadSnapshot(this.newRequest());
          if (result.ok) this.acceptSnapshot(result);
        }
        this.resetPageData();
        await this.loadKeyStatus();
        this.renderHeaderTools();
        this.renderContext();
        await this.renderRoute();
      }
      async resumeLast() {
        const homeReady = await this.ensureHome();
        if (!homeReady) {
          return { ok: false, error: this.state.pageError ?? storageError() };
        }
        const active = this.state.home?.activeSession ?? null;
        if (active === null) {
          return {
            ok: false,
            error: { code: "NOT_FOUND", message: "\u6CA1\u6709\u53EF\u7EE7\u7EED\u7684\u6D3B\u52A8", retryable: false }
          };
        }
        const result = await this.data.resumeSession(this.newRequest(), active.id);
        if (!result.ok) {
          this.state.resumeError = result.error;
          this.renderContext();
          await this.renderRoute();
          return result;
        }
        this.state.resume = result.data;
        this.state.resumeError = null;
        await this.navigate("/workspace", true);
        return result;
      }
      async saveRange(input) {
        this.lastRangeInput = input;
        this.setSaveState("saving");
        const result = await this.data.saveRange(this.newRequest(), input);
        if (result.ok) {
          this.state.rangeClaim = result.data.range;
          this.setSaveState("saved");
        } else {
          this.setSaveState("failed");
        }
        this.renderHeaderTools();
        return result;
      }
      async retrySave() {
        if (this.lastRangeInput !== null) {
          await this.saveRange(this.lastRangeInput);
          return;
        }
        this.setSaveState("saved");
        await this.refresh();
      }
      async exportData() {
        return this.data.exportData(this.newRequest(), "learning_records");
      }
      async deleteData(scope) {
        const result = await this.data.deleteData(this.newRequest(), scope);
        if (result.ok && scope === "learning_records") {
          this.state.rangeClaim = null;
          this.state.resume = null;
        }
        return result;
      }
      setDiagnosticSkipped(skipped) {
        this.state.diagnosticSkipped = skipped;
      }
      setFontScale(scale) {
        this.state.fontScale = scale;
        this.root.dataset["fontScale"] = scale;
        this.renderContext();
      }
      async loadKeyStatus() {
        const result = await this.keyPort.loadStatus();
        if (result.ok) {
          this.state.keyStatus = result.data.configured ? "configured" : "missing";
          this.state.keySuffix = result.data.maskedSuffix;
          this.renderHeaderTools();
        }
        return result;
      }
      async saveKey(apiKey) {
        const invalid = validateApiKey(apiKey);
        if (invalid !== null) return { ok: false, error: invalid };
        const result = await this.keyPort.save(apiKey.trim());
        if (result.ok) {
          this.state.keyStatus = "configured";
          this.state.keySuffix = result.data.maskedSuffix;
          this.renderHeaderTools();
        }
        return result;
      }
      async clearKey() {
        const result = await this.keyPort.clear();
        if (result.ok) {
          this.state.keyStatus = "missing";
          this.state.keySuffix = null;
          this.renderHeaderTools();
        }
        return result;
      }
      acceptSnapshot(result) {
        if (!result.ok) return;
        this.state.snapshot = result.data;
        this.state.offline = result.offline === true;
        this.state.dataStatus = "ready";
        this.state.saveState = "saved";
        this.state.fatalError = null;
        this.state.keyStatus = result.data.auth.apiKey.status === "available" ? "configured" : "missing";
        this.state.keySuffix = null;
      }
      resetPageData() {
        this.state.home = null;
        this.state.records = null;
        this.state.pageError = null;
        this.homePromise = null;
        this.recordsPromise = null;
      }
      async renderRoute() {
        const token = ++this.renderToken;
        await this.unmountCurrentPage();
        if (this.disposed || token !== this.renderToken) return;
        const path = this.state.currentPath.split("?")[0] ?? "/home";
        this.currentQuery = queryOf2(this.state.currentPath);
        const page = this.pages.resolve(path) ?? this.pages.get("shell.not-found");
        if (page === void 0) return;
        this.state.currentPageTitle = page.title;
        this.renderContext();
        this.renderNav();
        this.pageHost.replaceChildren();
        const section = h("section", {
          class: "edu-page",
          "data-page-id": page.id,
          "data-page-path": page.path
        });
        section.append(
          h("h1", { class: "edu-page__title" }, page.title),
          loadingState({
            title: `\u6B63\u5728\u6253\u5F00${page.title}\u2026`,
            body: "\u4FDD\u7559\u9875\u9762\u6807\u9898\u548C\u8FD4\u56DE\u5165\u53E3\uFF1B\u4E0D\u4F1A\u663E\u793A\u865A\u6784\u7684\u6559\u6750\u3001\u6D3B\u52A8\u6216\u6210\u7EE9\u5360\u4F4D\u503C\u3002",
            onCancel: () => void this.navigate("/home")
          })
        );
        this.pageHost.append(section);
        this.main.focus();
        const ready = await this.ensurePageData(page);
        if (this.disposed || token !== this.renderToken) return;
        if (!ready) {
          this.renderPageError(section, page);
          return;
        }
        section.replaceChildren();
        this.currentPage = page;
        const pageContext = {
          container: section,
          services: this.services,
          navigate: (next) => void this.navigate(next)
        };
        try {
          await page.mount(pageContext);
        } catch {
          this.currentPage = null;
          this.renderPageError(section, page);
          return;
        }
        if (this.disposed || token !== this.renderToken) {
          await page.unmount();
          return;
        }
        await this.mountPanels(section, pageContext);
        this.announce(`\u5DF2\u6253\u5F00${page.title}\u9875\u9762`);
        this.focusMainHeading(section);
        const doc = this.root.ownerDocument;
        doc.title = `${page.title} \xB7 \u751F\u7269\u5B66\u4E60`;
      }
      async ensurePageData(page) {
        const homeRequired = page.id !== "shell.library-fallback" && page.id !== "shell.map-fallback" && page.id !== "shell.not-found";
        if (homeRequired) {
          const homeReady = await this.ensureHome();
          if (!homeReady) return false;
        }
        if (page.id === "shell.records") return this.ensureRecords();
        return true;
      }
      async ensureHome() {
        if (this.state.home !== null) return true;
        if (this.homePromise === null) this.homePromise = this.loadHome();
        return this.homePromise;
      }
      async loadHome() {
        const result = await this.data.loadHome(this.newRequest());
        if (!result.ok) {
          this.state.pageError = result.error;
          this.state.dataStatus = "error";
          return false;
        }
        this.state.home = result.data;
        this.state.offline = result.offline === true || this.state.offline;
        this.state.dataStatus = "ready";
        return true;
      }
      async ensureRecords() {
        if (this.state.records !== null) return true;
        if (this.recordsPromise === null) this.recordsPromise = this.loadRecords();
        return this.recordsPromise;
      }
      async loadRecords() {
        const result = await this.data.loadRecords(this.newRequest());
        if (!result.ok) {
          this.state.pageError = result.error;
          this.state.dataStatus = "error";
          return false;
        }
        this.state.records = result.data;
        this.state.offline = result.offline === true || this.state.offline;
        if (result.data.rangeClaim !== null) this.state.rangeClaim = result.data.rangeClaim;
        this.state.dataStatus = "ready";
        return true;
      }
      renderPageError(section, page) {
        const error = this.state.pageError ?? storageError();
        section.replaceChildren(
          h("h1", { class: "edu-page__title" }, page.title),
          renderErrorBanner(error, {
            onRetry: () => {
              this.state.pageError = null;
              this.homePromise = null;
              this.recordsPromise = null;
              void this.renderRoute();
            },
            onBack: () => void this.navigate("/home"),
            backLabel: "\u8FD4\u56DE\u9996\u9875"
          })
        );
      }
      renderFatalError() {
        this.renderHeaderTools();
        this.renderContext();
        const section = h("section", { class: "edu-page", "data-page-id": "fatal" });
        section.append(
          h("h1", { class: "edu-page__title" }, "\u672C\u5730\u8BB0\u5F55\u6682\u65F6\u65E0\u6CD5\u6253\u5F00"),
          renderErrorBanner(this.state.fatalError ?? storageError(), {
            onRetry: () => void this.refresh(),
            onBack: () => void this.navigate("/home"),
            backLabel: "\u8FD4\u56DE\u9996\u9875"
          })
        );
        this.pageHost.replaceChildren(section);
      }
      setSaveState(state) {
        this.state.saveState = state;
        this.renderContext();
      }
      newRequest() {
        this.requestCounter += 1;
        return {
          requestId: this.ids.next("request"),
          learnerId: this.state.snapshot?.learner.id ?? "learner.local.pending",
          now: this.clock.now()
        };
      }
      async mountPanels(section, pageContext) {
        for (const name of SHELL_SLOT_NAMES) {
          const containers = section.querySelectorAll(`[data-edu-slot="${name}"]`);
          if (containers.length === 0) continue;
          const panels = this.slots.list(name);
          for (const container of containers) {
            for (const panel of panels) {
              const context = {
                container,
                services: pageContext.services,
                navigate: pageContext.navigate
              };
              try {
                await panel.mount(context);
                this.mountedPanels.push({ panel, context });
              } catch {
                container.append(
                  h(
                    "p",
                    { class: "edu-notice edu-notice--warning", role: "alert" },
                    `\u201C${name}\u201D\u533A\u57DF\u7684\u7EC4\u4EF6\u6CA1\u6709\u6210\u529F\u6253\u5F00\uFF1B\u5176\u4ED6\u5185\u5BB9\u4ECD\u53EF\u4F7F\u7528\u3002`
                  )
                );
              }
            }
          }
        }
      }
      async unmountCurrentPage() {
        for (const entry of this.mountedPanels) {
          try {
            await entry.panel.unmount?.();
          } catch {
          }
        }
        this.mountedPanels = [];
        const page = this.currentPage;
        this.currentPage = null;
        if (page !== null) {
          try {
            await page.unmount();
          } catch {
          }
        }
      }
      announce(message) {
        this.liveRegion.textContent = message;
      }
      focusMainHeading(section) {
        const heading = section.querySelector("h1");
        if (heading !== null) {
          heading.focus();
        } else {
          this.main.focus();
        }
      }
      /** Debug/test-only layout budget for the current viewport. */
      layoutBudget(width, height) {
        return evaluateLayout(width, height, this.state.fontScale === "large" ? 25 : 20);
      }
    };
    function normalizePath(path) {
      const value = path.trim();
      if (value.length === 0) return "/home";
      return value.startsWith("/") ? value : `/${value}`;
    }
    function queryOf2(path) {
      const index = path.indexOf("?");
      return new URLSearchParams(index >= 0 ? path.slice(index + 1) : "");
    }
    function optionsHasNewActivity(path) {
      return path.includes("new=1") || path.includes("mode=diagnostic");
    }
    function storageError() {
      return { code: "STORAGE_FAILED", message: "\u672C\u5730\u8BB0\u5F55\u6682\u65F6\u65E0\u6CD5\u8BFB\u53D6", retryable: true };
    }
    function readInitialPath() {
      try {
        const hash = globalThis.location?.hash ?? "";
        if (hash.startsWith("#/")) return hash.slice(1);
      } catch {
      }
      return "/home";
    }
    function mountEducationShell(container, options) {
      const shell = new EducationShell(options);
      const ready = shell.mount(container);
      return {
        shell,
        ready,
        unmount: () => shell.unmount()
      };
    }
    
    // education/client/shell/src/data/types.ts
    function okData(data, revision, offline = false) {
      return offline ? { ok: true, data, revision, offline: true } : { ok: true, data, revision };
    }
    
    // education/packages/domain/src/versions.ts
    var SCHEMA_VERSION = 1;
    
    // education/packages/domain/src/primitives.ts
    var OPAQUE_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:@-]{0,127}$/;
    var RFC3339_UTC_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?Z$/;
    var SHA256_PATTERN = /^[a-f0-9]{64}$/;
    var SUBJECT_SLUG_PATTERN = /^[a-z][a-z0-9-]{1,31}$/;
    var VERSION_LABEL_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:+-]{0,63}$/;
    var REVIEW_STATES = [
      "candidate",
      "machine_checked",
      "curator_checked",
      "published",
      "rejected"
    ];
    var TRUST_MODES = ["published", "candidate"];
    var ACTOR_KINDS = ["human_curator", "ai_static_reviewer", "system"];
    var COURSE_EDITION_STATUSES = ["unverified", "verified", "rejected"];
    var SOURCE_VERIFICATION_STATES = [
      "unverified",
      "machine_matched",
      "human_checked",
      "rejected"
    ];
    var TOC_NODE_TYPES = ["volume", "unit", "chapter", "section"];
    var RELATION_TYPES = ["prerequisite", "related"];
    var RELATION_BASES = ["explicit_source", "pedagogical_inference"];
    var PACK_SCOPES = ["partial", "full_volume"];
    var PACK_COVERAGE_STATUSES = ["partial", "complete"];
    var PACK_STATUSES = ["draft", "candidate", "published", "rejected"];
    var LEARNING_STATES = ["not_started", "in_progress", "completed"];
    var UNDERSTANDING_STATES = [
      "unassessed",
      "needs_support",
      "developing",
      "supported"
    ];
    var ASSESSMENT_STATES = ["needs_support", "developing", "supported"];
    var REVIEW_OUTCOMES = ["needs_support", "developing", "supported"];
    var EVIDENCE_KINDS = ["recall", "explain", "discriminate", "transfer", "label"];
    var ASSISTANCE_LEVELS = ["assisted", "unassisted"];
    var ASSESSMENT_ORIGINS = ["rule", "model", "human"];
    var VALIDITY_STATES = ["current", "stale", "pending", "needs_recheck"];
    var SESSION_MODES = ["learn", "review", "diagnostic"];
    var SESSION_STATUSES = ["active", "completed", "abandoned"];
    var ATTEMPT_INPUT_TYPES = [
      "text",
      "choice",
      "diagram_label",
      "relation",
      "image"
    ];
    var HELP_KINDS = ["hint", "explanation", "example", "worked_solution", "answer"];
    var ACTIVITY_TYPES = [
      "recall",
      "explain",
      "choice",
      "diagram_label",
      "relation",
      "transfer",
      "image_review"
    ];
    var SELF_REPORT_STATES = ["uncertain", "basically_understood", "can_explain"];
    var IMPORT_STAGES = [
      "accepted",
      "identify",
      "extract",
      "structure",
      "concepts",
      "validate",
      "await_review",
      "ready"
    ];
    var IMPORT_STATUSES = [
      "queued",
      "running",
      "paused",
      "failed",
      "cancelled",
      "completed"
    ];
    var COMPATIBILITY_MAPPING_KINDS = [
      "unchanged",
      "renamed",
      "split",
      "merged",
      "removed",
      "added",
      "rubric_changed",
      "source_revised"
    ];
    var EVIDENCE_EFFECTS = ["inherit", "stale", "recheck", "reset"];
    var REALTIME_TOPICS = [
      "import.progress",
      "session.output",
      "progress.changed",
      "content.changed",
      "runtime.status"
    ];
    function isValidRfc3339Utc(value) {
      if (!RFC3339_UTC_PATTERN.test(value)) return false;
      const parsed = Date.parse(value);
      return Number.isFinite(parsed);
    }
    function isOpaqueId(value) {
      return OPAQUE_ID_PATTERN.test(value);
    }
    function isSha256(value) {
      return SHA256_PATTERN.test(value);
    }
    function isManagedAssetId(value) {
      if (!isOpaqueId(value)) return false;
      if (value.includes("/") || value.includes("\\")) return false;
      if (/^[A-Za-z]:/.test(value)) return false;
      return true;
    }
    function isPlainObject(value) {
      return typeof value === "object" && value !== null && !Array.isArray(value);
    }
    
    // education/packages/domain/src/validation.ts
    var IssueCollector = class {
      list = [];
      add(code, path, message) {
        this.list.push({ code, path, message });
      }
      get count() {
        return this.list.length;
      }
    };
    var UNKNOWN_KEY_SENTINEL = "\0unknown";
    function readObject(value, path, allowed, issues) {
      if (!isPlainObject(value)) {
        issues.add("INVALID_TYPE", path, "expected a plain object");
        return null;
      }
      for (const key of Object.keys(value)) {
        if (key === UNKNOWN_KEY_SENTINEL) continue;
        if (!allowed.includes(key)) {
          issues.add("UNKNOWN_FIELD", `${path}.${key}`, `unknown field "${key}" is not allowed`);
        }
      }
      return value;
    }
    function readString(obj, key, path, issues, rule = {}) {
      const at = `${path}.${key}`;
      const raw = obj[key];
      if (raw === void 0) {
        if (!rule.optional) issues.add("MISSING_FIELD", at, "required field is missing");
        return null;
      }
      if (raw === null) {
        if (rule.nullable) return null;
        issues.add("INVALID_TYPE", at, "null is not allowed for this field");
        return null;
      }
      if (typeof raw !== "string") {
        issues.add("INVALID_TYPE", at, "expected a string");
        return null;
      }
      if (rule.minLength !== void 0 && raw.trim().length < rule.minLength) {
        issues.add("INVALID_FORMAT", at, `expected non-empty string (min length ${rule.minLength})`);
        return null;
      }
      if (rule.maxLength !== void 0 && raw.length > rule.maxLength) {
        issues.add("INVALID_FORMAT", at, `string exceeds max length ${rule.maxLength}`);
        return null;
      }
      if (rule.pattern !== void 0 && !rule.pattern.test(raw)) {
        issues.add("INVALID_FORMAT", at, rule.patternMessage ?? "value does not match the required pattern");
        return null;
      }
      if (rule.enum !== void 0 && !rule.enum.includes(raw)) {
        issues.add("INVALID_ENUM", at, `expected one of: ${rule.enum.join(", ")}`);
        return null;
      }
      return raw;
    }
    function readId(obj, key, path, issues, rule = {}) {
      const value = readString(obj, key, path, issues, {
        ...rule,
        patternMessage: "expected an opaque ID (no whitespace, no path separators, max 128 chars)"
      });
      if (value !== null && !isOpaqueId(value)) {
        issues.add("INVALID_ID", `${path}.${key}`, "expected an opaque ID (no whitespace, no path separators, max 128 chars)");
        return null;
      }
      return value;
    }
    function readTimestamp(obj, key, path, issues, rule = {}) {
      const value = readString(obj, key, path, issues, rule);
      if (value !== null && !isValidRfc3339Utc(value)) {
        issues.add(
          "INVALID_TIMESTAMP",
          `${path}.${key}`,
          "expected an RFC3339 UTC timestamp ending in Z (e.g. 2026-10-29T09:00:00Z)"
        );
        return null;
      }
      return value;
    }
    function readSha256(obj, key, path, issues, rule = {}) {
      const value = readString(obj, key, path, issues, rule);
      if (value !== null && !isSha256(value)) {
        issues.add("INVALID_HASH", `${path}.${key}`, "expected a lowercase hex SHA-256 (64 chars)");
        return null;
      }
      return value;
    }
    function readManagedAssetId(obj, key, path, issues, rule = {}) {
      const value = readId(obj, key, path, issues, rule);
      if (value !== null && !isManagedAssetId(value)) {
        issues.add("INVALID_ASSET", `${path}.${key}`, "expected a host managed asset handle, not an OS path");
        return null;
      }
      return value;
    }
    function readNumber(obj, key, path, issues, rule = {}) {
      const at = `${path}.${key}`;
      const raw = obj[key];
      if (raw === void 0) {
        if (!rule.optional) issues.add("MISSING_FIELD", at, "required field is missing");
        return null;
      }
      if (raw === null) {
        if (rule.nullable) return null;
        issues.add("INVALID_TYPE", at, "null is not allowed for this field");
        return null;
      }
      if (typeof raw !== "number" || !Number.isFinite(raw)) {
        issues.add("INVALID_TYPE", at, "expected a finite number");
        return null;
      }
      if (rule.integer === true && !Number.isInteger(raw)) {
        issues.add("INVALID_NUMBER", at, "expected an integer");
        return null;
      }
      if (rule.min !== void 0 && raw < rule.min) {
        issues.add("INVALID_NUMBER", at, `expected a value >= ${rule.min}`);
        return null;
      }
      if (rule.max !== void 0 && raw > rule.max) {
        issues.add("INVALID_NUMBER", at, `expected a value <= ${rule.max}`);
        return null;
      }
      return raw;
    }
    function readBoolean(obj, key, path, issues, rule = {}) {
      const at = `${path}.${key}`;
      const raw = obj[key];
      if (raw === void 0) {
        if (!rule.optional) issues.add("MISSING_FIELD", at, "required field is missing");
        return null;
      }
      if (typeof raw !== "boolean") {
        issues.add("INVALID_TYPE", at, "expected a boolean");
        return null;
      }
      return raw;
    }
    function readArray(obj, key, path, issues, readItem, rule = {}) {
      const at = `${path}.${key}`;
      const raw = obj[key];
      if (raw === void 0) {
        if (!rule.optional) issues.add("MISSING_FIELD", at, "required array is missing");
        return null;
      }
      if (!Array.isArray(raw)) {
        issues.add("INVALID_TYPE", at, "expected an array");
        return null;
      }
      if (rule.minItems !== void 0 && raw.length < rule.minItems) {
        issues.add("INVALID_FORMAT", at, `expected at least ${rule.minItems} item(s)`);
        return null;
      }
      if (rule.maxItems !== void 0 && raw.length > rule.maxItems) {
        issues.add("INVALID_FORMAT", at, `expected at most ${rule.maxItems} item(s)`);
        return null;
      }
      const items = [];
      raw.forEach((item, index) => {
        const parsed = readItem(item, `${at}[${index}]`, issues);
        if (parsed !== null) items.push(parsed);
      });
      return items;
    }
    function readStringArray(obj, key, path, issues, rule = {}) {
      const raw = obj[key];
      if (raw === null && rule.nullable === true) return null;
      return readArray(
        obj,
        key,
        path,
        issues,
        (value, at, collector) => {
          if (typeof value !== "string") {
            collector.add("INVALID_TYPE", at, "expected a string");
            return null;
          }
          if (value.trim().length === 0) {
            collector.add("INVALID_FORMAT", at, "expected a non-empty string");
            return null;
          }
          if (rule.idItems === true && !isOpaqueId(value)) {
            collector.add("INVALID_ID", at, "expected an opaque ID");
            return null;
          }
          return value;
        },
        { optional: rule.optional, minItems: rule.minItems }
      );
    }
    function readEnum(obj, key, path, issues, allowed, rule = {}) {
      const value = readString(obj, key, path, issues, {
        optional: rule.optional,
        nullable: rule.nullable,
        enum: allowed
      });
      return value;
    }
    function readSchemaVersion(obj, path, issues) {
      const raw = obj["schemaVersion"];
      if (raw === void 0) {
        issues.add("MISSING_FIELD", `${path}.schemaVersion`, "schemaVersion is required");
        return null;
      }
      if (raw !== SCHEMA_VERSION) {
        issues.add(
          "SCHEMA_VERSION_MISMATCH",
          `${path}.schemaVersion`,
          `expected ${SCHEMA_VERSION}, got ${String(raw)}`
        );
        return null;
      }
      return SCHEMA_VERSION;
    }
    function readBBox(obj, key, path, issues, rule = {}) {
      const at = `${path}.${key}`;
      const raw = obj[key];
      if (raw === void 0) {
        if (!rule.optional) issues.add("MISSING_FIELD", at, "bbox is required (use null when unknown)");
        return null;
      }
      if (raw === null) {
        if (rule.nullable) return null;
        issues.add("INVALID_BBOX", at, "null bbox is not allowed here");
        return null;
      }
      const inner = readObject(raw, at, ["x", "y", "width", "height"], issues);
      if (inner === null) return null;
      const x = readNumber(inner, "x", at, issues, { min: 0, max: 1 });
      const y = readNumber(inner, "y", at, issues, { min: 0, max: 1 });
      const width = readNumber(inner, "width", at, issues, { min: 0, max: 1 });
      const height = readNumber(inner, "height", at, issues, { min: 0, max: 1 });
      if (x === null || y === null || width === null || height === null) return null;
      if (width <= 0 || height <= 0) {
        issues.add("INVALID_BBOX", at, "width and height must be > 0");
        return null;
      }
      if (x + width > 1 || y + height > 1) {
        issues.add("INVALID_BBOX", at, "bbox must stay inside the normalized [0,1] page area");
        return null;
      }
      return { x, y, width, height };
    }
    function finish(value, issues) {
      if (issues.count > 0 || value === null) {
        if (issues.count === 0) {
          issues.add("INVALID_TYPE", "$", "value is not a valid object");
        }
        return { ok: false, issues: issues.list };
      }
      return { ok: true, value };
    }
    function validateWith(reader) {
      return (input) => {
        const issues = new IssueCollector();
        const value = reader(input, "$", issues);
        return finish(value, issues);
      };
    }
    function checkSafeText(value, path, issues) {
      const lowered = value.toLowerCase();
      const unsafe = lowered.includes("<script") || lowered.includes("<iframe") || lowered.includes("javascript:") || lowered.includes("<object") || lowered.includes("<embed");
      if (unsafe) {
        issues.add("UNSAFE_CONTENT", path, "script/HTML embedding is not allowed in controlled text");
        return false;
      }
      return true;
    }
    
    // education/packages/domain/src/entities/sources.ts
    var SOURCE_IDENTITY_KINDS = [
      "cover",
      "copyright_page",
      "colophon",
      "toc",
      "none"
    ];
    function readSourceIdentity(value, path, issues) {
      const obj = readObject(value, path, ["verifiedFrom", "notes", "sha256"], issues);
      if (obj === null) return null;
      const verifiedFrom = readEnum(obj, "verifiedFrom", path, issues, SOURCE_IDENTITY_KINDS);
      const notes = readString(obj, "notes", path, issues, { minLength: 1, maxLength: 2e3 });
      const sha256 = readSha256(obj, "sha256", path, issues, { nullable: true });
      if (verifiedFrom === null || notes === null) return null;
      return { verifiedFrom, notes, sha256 };
    }
    function readCourseEdition(value, path, issues) {
      const obj = readObject(
        value,
        path,
        [
          "schemaVersion",
          "id",
          "subject",
          "grade",
          "term",
          "publisher",
          "editionLabel",
          "sourceIdentity",
          "status"
        ],
        issues
      );
      if (obj === null) return null;
      readSchemaVersion(obj, path, issues);
      const id = readId(obj, "id", path, issues);
      const subject = readString(obj, "subject", path, issues, {
        pattern: SUBJECT_SLUG_PATTERN,
        patternMessage: "subject must be a data slug, not a hardcoded domain enum"
      });
      const grade = readNumber(obj, "grade", path, issues, { integer: true, min: 1, max: 12 });
      const termRaw = readNumber(obj, "term", path, issues, { integer: true, min: 1, max: 2 });
      const publisher = readString(obj, "publisher", path, issues, { minLength: 1 });
      const editionLabel = readString(obj, "editionLabel", path, issues, { minLength: 1 });
      const sourceIdentity = readSourceIdentity(obj["sourceIdentity"], `${path}.sourceIdentity`, issues);
      const status = readEnum(obj, "status", path, issues, COURSE_EDITION_STATUSES);
      if (id === null || subject === null || grade === null || termRaw === null || publisher === null || editionLabel === null || sourceIdentity === null || status === null) {
        return null;
      }
      if (status === "verified" && (sourceIdentity.verifiedFrom === "none" || sourceIdentity.sha256 === null)) {
        issues.add(
          "COURSE_IDENTITY_UNVERIFIED",
          `${path}.sourceIdentity`,
          "a verified course edition needs cover/copyright evidence and a file hash"
        );
        return null;
      }
      return {
        schemaVersion: 1,
        id,
        subject,
        grade,
        term: termRaw === 1 ? 1 : 2,
        publisher,
        editionLabel,
        sourceIdentity,
        status
      };
    }
    var validateCourseEdition = validateWith(readCourseEdition);
    function readConfirmedMetadata(value, path, issues) {
      const obj = readObject(value, path, ["title", "publisher", "editionLabel", "confirmedAt"], issues);
      if (obj === null) return null;
      const title = readString(obj, "title", path, issues, { nullable: true });
      const publisher = readString(obj, "publisher", path, issues, { nullable: true });
      const editionLabel = readString(obj, "editionLabel", path, issues, { nullable: true });
      const confirmedAt = readTimestamp(obj, "confirmedAt", path, issues, { nullable: true });
      return { title, publisher, editionLabel, confirmedAt };
    }
    function readBookInstance(value, path, issues) {
      const obj = readObject(
        value,
        path,
        [
          "schemaVersion",
          "id",
          "courseEditionId",
          "originalSha256",
          "pageCount",
          "managedAssetId",
          "confirmedMetadata",
          "createdAt"
        ],
        issues
      );
      if (obj === null) return null;
      readSchemaVersion(obj, path, issues);
      const id = readId(obj, "id", path, issues);
      const courseEditionId = readId(obj, "courseEditionId", path, issues);
      const originalSha256 = readSha256(obj, "originalSha256", path, issues);
      const pageCount = readNumber(obj, "pageCount", path, issues, { integer: true, min: 1 });
      const managedAssetId = readManagedAssetId(obj, "managedAssetId", path, issues);
      const confirmedMetadata = readConfirmedMetadata(
        obj["confirmedMetadata"],
        `${path}.confirmedMetadata`,
        issues
      );
      const createdAt = readTimestamp(obj, "createdAt", path, issues);
      if (id === null || courseEditionId === null || originalSha256 === null || pageCount === null || managedAssetId === null || confirmedMetadata === null || createdAt === null) {
        return null;
      }
      return {
        schemaVersion: 1,
        id,
        courseEditionId,
        originalSha256,
        pageCount,
        managedAssetId,
        confirmedMetadata,
        createdAt
      };
    }
    var validateBookInstance = validateWith(readBookInstance);
    function readSourceVerification(value, path, issues) {
      const obj = readObject(value, path, ["state", "actorKind", "checkedAt", "notes"], issues);
      if (obj === null) return null;
      const state = readEnum(obj, "state", path, issues, SOURCE_VERIFICATION_STATES);
      const actorKind = readEnum(obj, "actorKind", path, issues, ACTOR_KINDS, { nullable: true });
      const checkedAt = readTimestamp(obj, "checkedAt", path, issues, { nullable: true });
      const notes = readString(obj, "notes", path, issues, { nullable: true });
      if (state === null) return null;
      if ((state === "machine_matched" || state === "human_checked") && checkedAt === null) {
        issues.add("INVALID_REFERENCE", `${path}.checkedAt`, `state ${state} requires checkedAt`);
        return null;
      }
      if (state === "human_checked" && actorKind !== "human_curator") {
        issues.add(
          "INVALID_REFERENCE",
          `${path}.actorKind`,
          "human_checked source references require a human_curator actor (AI must not claim expert review)"
        );
        return null;
      }
      return { state, actorKind, checkedAt, notes };
    }
    function readSourceRef(value, path, issues) {
      const obj = readObject(
        value,
        path,
        [
          "schemaVersion",
          "id",
          "bookInstanceId",
          "baselineSourceId",
          "pdfPage",
          "printedPage",
          "bbox",
          "blockId",
          "figureId",
          "verification"
        ],
        issues
      );
      if (obj === null) return null;
      readSchemaVersion(obj, path, issues);
      const id = readId(obj, "id", path, issues);
      const bookInstanceId = readId(obj, "bookInstanceId", path, issues, { nullable: true });
      const baselineSourceId = readId(obj, "baselineSourceId", path, issues, { nullable: true });
      const pdfPage = readNumber(obj, "pdfPage", path, issues, { integer: true, min: 1 });
      const printedPage = readString(obj, "printedPage", path, issues, { nullable: true });
      const bbox = readBBox(obj, "bbox", path, issues, { nullable: true });
      const blockId = readId(obj, "blockId", path, issues, { nullable: true });
      const figureId = readId(obj, "figureId", path, issues, { nullable: true });
      const verification = readSourceVerification(
        obj["verification"],
        `${path}.verification`,
        issues
      );
      if (bookInstanceId === null === (baselineSourceId === null)) {
        issues.add(
          "INVALID_REFERENCE",
          path,
          "exactly one of bookInstanceId / baselineSourceId must be set"
        );
        return null;
      }
      if (blockId !== null && figureId !== null) {
        issues.add("INVALID_REFERENCE", path, "blockId and figureId are mutually exclusive");
        return null;
      }
      if (id === null || pdfPage === null || verification === null) {
        return null;
      }
      return {
        schemaVersion: 1,
        id,
        bookInstanceId,
        baselineSourceId,
        pdfPage,
        printedPage,
        bbox,
        blockId,
        figureId,
        verification
      };
    }
    var validateSourceRef = validateWith(readSourceRef);
    var SOURCE_BLOCK_TYPES = [
      "heading",
      "paragraph",
      "caption",
      "table",
      "list"
    ];
    var EXTRACTION_METHODS = ["text_layer", "ocr", "manual"];
    function readSourceBlock(value, path, issues) {
      const obj = readObject(
        value,
        path,
        [
          "schemaVersion",
          "id",
          "sourceRefId",
          "type",
          "originalText",
          "revisedText",
          "extractionMethod",
          "textConfidence",
          "reviewState"
        ],
        issues
      );
      if (obj === null) return null;
      readSchemaVersion(obj, path, issues);
      const id = readId(obj, "id", path, issues);
      const sourceRefId = readId(obj, "sourceRefId", path, issues);
      const type = readEnum(obj, "type", path, issues, SOURCE_BLOCK_TYPES);
      const originalText = readString(obj, "originalText", path, issues, { minLength: 1 });
      const revisedText = readString(obj, "revisedText", path, issues, { nullable: true });
      const extractionMethod = readEnum(obj, "extractionMethod", path, issues, EXTRACTION_METHODS);
      const textConfidence = readNumber(obj, "textConfidence", path, issues, {
        nullable: true,
        min: 0,
        max: 1
      });
      const reviewState = readEnum(obj, "reviewState", path, issues, REVIEW_STATES);
      if (id === null || sourceRefId === null || type === null || originalText === null || extractionMethod === null || reviewState === null) {
        return null;
      }
      if (extractionMethod === "ocr" && textConfidence === null) {
        issues.add("INVALID_FORMAT", `${path}.textConfidence`, "OCR blocks must record textConfidence");
        return null;
      }
      if (originalText.trim().length === 0) {
        issues.add("INVALID_FORMAT", `${path}.originalText`, "original extraction text must not be empty");
        return null;
      }
      return {
        schemaVersion: 1,
        id,
        sourceRefId,
        type,
        originalText,
        revisedText,
        extractionMethod,
        textConfidence,
        reviewState
      };
    }
    var validateSourceBlock = validateWith(readSourceBlock);
    var FIGURE_TYPES = ["photo", "diagram", "chart", "map", "other"];
    function readFigure(value, path, issues) {
      const obj = readObject(
        value,
        path,
        [
          "schemaVersion",
          "id",
          "sourceRefId",
          "type",
          "originalAssetId",
          "activeAssetId",
          "caption",
          "extractionMethod",
          "reviewState"
        ],
        issues
      );
      if (obj === null) return null;
      readSchemaVersion(obj, path, issues);
      const id = readId(obj, "id", path, issues);
      const sourceRefId = readId(obj, "sourceRefId", path, issues);
      const type = readEnum(obj, "type", path, issues, FIGURE_TYPES);
      const originalAssetId = readManagedAssetId(obj, "originalAssetId", path, issues);
      const activeAssetId = readManagedAssetId(obj, "activeAssetId", path, issues);
      const caption = readString(obj, "caption", path, issues, { nullable: true });
      const extractionMethod = readEnum(obj, "extractionMethod", path, issues, EXTRACTION_METHODS);
      const reviewState = readEnum(obj, "reviewState", path, issues, REVIEW_STATES);
      if (id === null || sourceRefId === null || type === null || originalAssetId === null || activeAssetId === null || extractionMethod === null || reviewState === null) {
        return null;
      }
      return {
        schemaVersion: 1,
        id,
        sourceRefId,
        type,
        originalAssetId,
        activeAssetId,
        caption,
        extractionMethod,
        reviewState
      };
    }
    var validateFigure = validateWith(readFigure);
    function readTocNode(value, path, issues) {
      const obj = readObject(
        value,
        path,
        ["schemaVersion", "id", "courseEditionId", "parentId", "type", "title", "order", "sourceRefs"],
        issues
      );
      if (obj === null) return null;
      readSchemaVersion(obj, path, issues);
      const id = readId(obj, "id", path, issues);
      const courseEditionId = readId(obj, "courseEditionId", path, issues);
      const parentId = readId(obj, "parentId", path, issues, { nullable: true });
      const type = readEnum(obj, "type", path, issues, TOC_NODE_TYPES);
      const title = readString(obj, "title", path, issues, { minLength: 1 });
      const order = readNumber(obj, "order", path, issues, { integer: true, min: 0 });
      const sourceRefs = readStringArray(obj, "sourceRefs", path, issues, { idItems: true });
      if (id === null || courseEditionId === null || type === null || title === null || order === null || sourceRefs === null) {
        return null;
      }
      if (!checkSafeText(title, `${path}.title`, issues)) return null;
      return {
        schemaVersion: 1,
        id,
        courseEditionId,
        parentId,
        type,
        title,
        order,
        sourceRefs
      };
    }
    var validateTocNode = validateWith(readTocNode);
    
    // education/packages/domain/src/entities/content.ts
    var ANSWER_DISCLOSURE_POLICIES = [
      "after_independent_attempt",
      "after_help_request",
      "manual_review"
    ];
    var COVERAGE_SECTION_STATUSES = ["covered", "partial", "excluded", "blocked"];
    function readMisconception(value, path, issues) {
      const obj = readObject(value, path, ["statement", "correction", "sourceRefs"], issues);
      if (obj === null) return null;
      const statement = readString(obj, "statement", path, issues, { minLength: 1 });
      const correction = readString(obj, "correction", path, issues, { minLength: 1 });
      const sourceRefs = readStringArray(obj, "sourceRefs", path, issues, { idItems: true });
      if (statement === null || correction === null || sourceRefs === null) return null;
      return { statement, correction, sourceRefs };
    }
    function readConceptAt(value, path, issues) {
      const obj = readObject(
        value,
        path,
        [
          "schemaVersion",
          "id",
          "courseEditionId",
          "title",
          "aliases",
          "placements",
          "learningObjectives",
          "explanation",
          "misconceptions",
          "sourceRefs",
          "rubricIds",
          "activityIds",
          "reviewState"
        ],
        issues
      );
      if (obj === null) return null;
      readSchemaVersion(obj, path, issues);
      const id = readId(obj, "id", path, issues);
      const courseEditionId = readId(obj, "courseEditionId", path, issues);
      const title = readString(obj, "title", path, issues, { minLength: 1 });
      const aliases = readStringArray(obj, "aliases", path, issues, { optional: true });
      const placements = readStringArray(obj, "placements", path, issues, { idItems: true, minItems: 1 });
      const learningObjectives = readStringArray(obj, "learningObjectives", path, issues, {
        minItems: 1
      });
      const explanation = readString(obj, "explanation", path, issues, { minLength: 1 });
      const misconceptions = readArray(obj, "misconceptions", path, issues, readMisconception, {
        optional: true
      });
      const sourceRefs = readStringArray(obj, "sourceRefs", path, issues, { idItems: true });
      const rubricIds = readStringArray(obj, "rubricIds", path, issues, { idItems: true });
      const activityIds = readStringArray(obj, "activityIds", path, issues, { idItems: true });
      const reviewState = readEnum(obj, "reviewState", path, issues, REVIEW_STATES);
      if (id === null || courseEditionId === null || title === null || placements === null || learningObjectives === null || explanation === null || sourceRefs === null || rubricIds === null || activityIds === null || reviewState === null) {
        return null;
      }
      if (!checkSafeText(explanation, `${path}.explanation`, issues)) return null;
      return {
        schemaVersion: 1,
        id,
        courseEditionId,
        title,
        aliases: aliases ?? [],
        placements,
        learningObjectives,
        explanation,
        misconceptions: misconceptions ?? [],
        sourceRefs,
        rubricIds,
        activityIds,
        reviewState
      };
    }
    var validateConcept = validateWith(readConceptAt);
    function readRelationAt(value, path, issues) {
      const obj = readObject(
        value,
        path,
        [
          "schemaVersion",
          "id",
          "courseEditionId",
          "fromConceptId",
          "toConceptId",
          "type",
          "basis",
          "rationale",
          "sourceRefs",
          "reviewState"
        ],
        issues
      );
      if (obj === null) return null;
      readSchemaVersion(obj, path, issues);
      const id = readId(obj, "id", path, issues);
      const courseEditionId = readId(obj, "courseEditionId", path, issues);
      const fromConceptId = readId(obj, "fromConceptId", path, issues);
      const toConceptId = readId(obj, "toConceptId", path, issues);
      const type = readEnum(obj, "type", path, issues, RELATION_TYPES);
      const basis = readEnum(obj, "basis", path, issues, RELATION_BASES);
      const rationale = readString(obj, "rationale", path, issues, { minLength: 1 });
      const sourceRefs = readStringArray(obj, "sourceRefs", path, issues, { idItems: true });
      const reviewState = readEnum(obj, "reviewState", path, issues, REVIEW_STATES);
      if (id === null || courseEditionId === null || fromConceptId === null || toConceptId === null || type === null || basis === null || rationale === null || sourceRefs === null || reviewState === null) {
        return null;
      }
      return {
        schemaVersion: 1,
        id,
        courseEditionId,
        fromConceptId,
        toConceptId,
        type,
        basis,
        rationale,
        sourceRefs,
        reviewState
      };
    }
    var validateRelation = validateWith(readRelationAt);
    function readRubricCriterion(value, path, issues) {
      const obj = readObject(
        value,
        path,
        [
          "criterionId",
          "description",
          "acceptableEvidence",
          "commonMisconceptions",
          "counterExamples",
          "transferItems",
          "feedbackSourceRefs"
        ],
        issues
      );
      if (obj === null) return null;
      const criterionId = readId(obj, "criterionId", path, issues);
      const description = readString(obj, "description", path, issues, { minLength: 1 });
      const acceptableEvidence = readStringArray(obj, "acceptableEvidence", path, issues, {
        minItems: 1
      });
      const commonMisconceptions = readStringArray(obj, "commonMisconceptions", path, issues, {
        optional: true
      });
      const counterExamples = readStringArray(obj, "counterExamples", path, issues, {
        optional: true
      });
      const transferItems = readStringArray(obj, "transferItems", path, issues, { optional: true });
      const feedbackSourceRefs = readStringArray(obj, "feedbackSourceRefs", path, issues, {
        idItems: true,
        optional: true
      });
      if (criterionId === null || description === null || acceptableEvidence === null) {
        return null;
      }
      return {
        criterionId,
        description,
        acceptableEvidence,
        commonMisconceptions: commonMisconceptions ?? [],
        counterExamples: counterExamples ?? [],
        transferItems: transferItems ?? [],
        feedbackSourceRefs: feedbackSourceRefs ?? []
      };
    }
    function readRubricAt(value, path, issues) {
      const obj = readObject(
        value,
        path,
        ["schemaVersion", "id", "version", "courseEditionId", "conceptIds", "criteria", "reviewState"],
        issues
      );
      if (obj === null) return null;
      readSchemaVersion(obj, path, issues);
      const id = readId(obj, "id", path, issues);
      const version = readString(obj, "version", path, issues, {
        pattern: VERSION_LABEL_PATTERN,
        patternMessage: "rubric version must be a bounded printable label"
      });
      const courseEditionId = readId(obj, "courseEditionId", path, issues);
      const conceptIds = readStringArray(obj, "conceptIds", path, issues, { idItems: true, minItems: 1 });
      const criteria = readArray(obj, "criteria", path, issues, readRubricCriterion, { minItems: 1 });
      const reviewState = readEnum(obj, "reviewState", path, issues, REVIEW_STATES);
      if (id === null || version === null || courseEditionId === null || conceptIds === null || criteria === null || reviewState === null) {
        return null;
      }
      return { schemaVersion: 1, id, version, courseEditionId, conceptIds, criteria, reviewState };
    }
    var validateRubric = validateWith(readRubricAt);
    var DIAGRAM_NODE_KINDS = ["concept", "structure", "process", "region"];
    function readDiagramNode(value, path, issues) {
      const obj = readObject(value, path, ["id", "label", "kind"], issues);
      if (obj === null) return null;
      const id = readId(obj, "id", path, issues);
      const label = readString(obj, "label", path, issues, { minLength: 1 });
      const kind = readEnum(obj, "kind", path, issues, DIAGRAM_NODE_KINDS);
      if (id === null || label === null || kind === null) return null;
      if (!checkSafeText(label, `${path}.label`, issues)) return null;
      return { id, label, kind };
    }
    function readDiagramEdge(value, path, issues) {
      const obj = readObject(value, path, ["id", "from", "to", "label", "directed"], issues);
      if (obj === null) return null;
      const id = readId(obj, "id", path, issues);
      const from = readId(obj, "from", path, issues);
      const to = readId(obj, "to", path, issues);
      const label = readString(obj, "label", path, issues, { nullable: true });
      const directed = readBoolean(obj, "directed", path, issues);
      if (id === null || from === null || to === null || directed === null) return null;
      return { id, from, to, label, directed };
    }
    function readDiagramLabel(value, path, issues) {
      const obj = readObject(value, path, ["id", "text", "targetId"], issues);
      if (obj === null) return null;
      const id = readId(obj, "id", path, issues);
      const text = readString(obj, "text", path, issues, { minLength: 1 });
      const targetId = readId(obj, "targetId", path, issues, { nullable: true });
      if (id === null || text === null) return null;
      if (!checkSafeText(text, `${path}.text`, issues)) return null;
      return { id, text, targetId };
    }
    function readDiagramRegion(value, path, issues) {
      const obj = readObject(value, path, ["id", "assetId", "bbox", "altText"], issues);
      if (obj === null) return null;
      const id = readId(obj, "id", path, issues);
      const assetId = readManagedAssetId(obj, "assetId", path, issues);
      const bbox = readBBox(obj, "bbox", path, issues);
      const altText = readString(obj, "altText", path, issues, { minLength: 1 });
      if (id === null || assetId === null || bbox === null || altText === null) return null;
      if (!checkSafeText(altText, `${path}.altText`, issues)) return null;
      return { id, assetId, bbox, altText };
    }
    function readDiagramSpecAt(value, path, issues) {
      const obj = readObject(
        value,
        path,
        ["schemaVersion", "nodes", "edges", "labels", "regions", "altText", "sourceRefs"],
        issues
      );
      if (obj === null) return null;
      readSchemaVersion(obj, path, issues);
      const nodes = readArray(obj, "nodes", path, issues, readDiagramNode, { maxItems: 200 });
      const edges = readArray(obj, "edges", path, issues, readDiagramEdge, { maxItems: 400 });
      const labels = readArray(obj, "labels", path, issues, readDiagramLabel, { optional: true, maxItems: 100 });
      const regions = readArray(obj, "regions", path, issues, readDiagramRegion, {
        optional: true,
        maxItems: 50
      });
      const altText = readString(obj, "altText", path, issues, { minLength: 1 });
      const sourceRefs = readStringArray(obj, "sourceRefs", path, issues, { idItems: true });
      if (nodes === null || edges === null || altText === null || sourceRefs === null) {
        return null;
      }
      if (!checkSafeText(altText, `${path}.altText`, issues)) return null;
      const nodeIds = new Set(nodes.map((node) => node.id));
      edges.forEach((edge, index) => {
        if (!nodeIds.has(edge.from) || !nodeIds.has(edge.to)) {
          issues.add(
            "DANGLING_REFERENCE",
            `${path}.edges[${index}]`,
            `edge endpoints must resolve to diagram nodes (${edge.from} -> ${edge.to})`
          );
        }
      });
      (labels ?? []).forEach((label, index) => {
        if (label.targetId !== null && !nodeIds.has(label.targetId)) {
          issues.add(
            "DANGLING_REFERENCE",
            `${path}.labels[${index}].targetId`,
            `label target ${label.targetId} does not resolve to a diagram node`
          );
        }
      });
      return {
        schemaVersion: 1,
        nodes,
        edges,
        labels: labels ?? [],
        regions: regions ?? [],
        altText,
        sourceRefs
      };
    }
    var validateDiagramSpec = validateWith(readDiagramSpecAt);
    var ANSWER_SCHEMA_KINDS = ["text", "choice", "diagram_label", "relation"];
    function readChoiceOption(value, path, issues) {
      const obj = readObject(value, path, ["id", "label"], issues);
      if (obj === null) return null;
      const id = readId(obj, "id", path, issues);
      const label = readString(obj, "label", path, issues, { minLength: 1 });
      if (id === null || label === null) return null;
      if (!checkSafeText(label, `${path}.label`, issues)) return null;
      return { id, label };
    }
    function readAnswerSchema(value, path, issues) {
      if (!isPlainObject(value)) {
        issues.add("INVALID_TYPE", path, "expected an answer schema object");
        return null;
      }
      const kind = value["kind"];
      if (typeof kind !== "string" || !ANSWER_SCHEMA_KINDS.includes(kind)) {
        issues.add("INVALID_ENUM", `${path}.kind`, `expected one of: ${ANSWER_SCHEMA_KINDS.join(", ")}`);
        return null;
      }
      if (kind === "text") {
        const obj2 = readObject(value, path, ["kind", "maxLength"], issues);
        if (obj2 === null) return null;
        const maxLength = readNumber(obj2, "maxLength", path, issues, {
          integer: true,
          min: 1,
          nullable: true
        });
        return { kind: "text", maxLength };
      }
      if (kind === "choice") {
        const obj2 = readObject(
          value,
          path,
          ["kind", "selection", "options", "correctOptionIds"],
          issues
        );
        if (obj2 === null) return null;
        const selection = readEnum(obj2, "selection", path, issues, ["single", "multiple"]);
        const options = readArray(obj2, "options", path, issues, readChoiceOption, { minItems: 2 });
        const correctOptionIds = readStringArray(obj2, "correctOptionIds", path, issues, {
          idItems: true,
          optional: true,
          nullable: true
        });
        if (selection === null || options === null) return null;
        const optionIds = new Set(options.map((option2) => option2.id));
        for (const id of correctOptionIds ?? []) {
          if (!optionIds.has(id)) {
            issues.add("DANGLING_REFERENCE", `${path}.correctOptionIds`, `option ${id} is not declared`);
          }
        }
        return { kind: "choice", selection, options, correctOptionIds };
      }
      if (kind === "diagram_label") {
        const obj2 = readObject(value, path, ["kind", "targets"], issues);
        if (obj2 === null) return null;
        const targets = readArray(
          obj2,
          "targets",
          path,
          issues,
          (item, at, collector) => {
            const inner = readObject(item, at, ["id", "label"], collector);
            if (inner === null) return null;
            const id = readId(inner, "id", at, collector);
            const label = readString(inner, "label", at, collector, { minLength: 1 });
            if (id === null || label === null) return null;
            return { id, label };
          },
          { minItems: 1 }
        );
        if (targets === null) return null;
        return { kind: "diagram_label", targets };
      }
      const obj = readObject(value, path, ["kind", "pairs"], issues);
      if (obj === null) return null;
      const pairs = readArray(
        obj,
        "pairs",
        path,
        issues,
        (item, at, collector) => {
          const inner = readObject(item, at, ["fromId", "toId"], collector);
          if (inner === null) return null;
          const fromId = readId(inner, "fromId", at, collector);
          const toId = readId(inner, "toId", at, collector);
          if (fromId === null || toId === null) return null;
          return { fromId, toId };
        },
        { minItems: 1 }
      );
      if (pairs === null) return null;
      return { kind: "relation", pairs };
    }
    function readActivityAt(value, path, issues) {
      const obj = readObject(
        value,
        path,
        [
          "schemaVersion",
          "id",
          "version",
          "courseEditionId",
          "conceptIds",
          "type",
          "stem",
          "sourceRefs",
          "renderSpec",
          "answerSchema",
          "rubricId",
          "rubricVersion",
          "answerDisclosurePolicy"
        ],
        issues
      );
      if (obj === null) return null;
      readSchemaVersion(obj, path, issues);
      const id = readId(obj, "id", path, issues);
      const version = readString(obj, "version", path, issues, {
        pattern: VERSION_LABEL_PATTERN,
        patternMessage: "activity version must be a bounded printable label"
      });
      const courseEditionId = readId(obj, "courseEditionId", path, issues);
      const conceptIds = readStringArray(obj, "conceptIds", path, issues, {
        idItems: true,
        minItems: 1
      });
      const type = readEnum(obj, "type", path, issues, ACTIVITY_TYPES);
      const stem = readString(obj, "stem", path, issues, { minLength: 1 });
      const sourceRefs = readStringArray(obj, "sourceRefs", path, issues, { idItems: true });
      const renderSpecRaw = obj["renderSpec"];
      let renderSpec = null;
      if (renderSpecRaw === null) {
        renderSpec = null;
      } else if (renderSpecRaw !== void 0) {
        renderSpec = readDiagramSpecAt(renderSpecRaw, `${path}.renderSpec`, issues);
      }
      const answerSchema = readAnswerSchema(obj["answerSchema"], `${path}.answerSchema`, issues);
      const rubricId = readId(obj, "rubricId", path, issues);
      const rubricVersion = readString(obj, "rubricVersion", path, issues, {
        pattern: VERSION_LABEL_PATTERN
      });
      const answerDisclosurePolicy = readEnum(
        obj,
        "answerDisclosurePolicy",
        path,
        issues,
        ANSWER_DISCLOSURE_POLICIES
      );
      if (id === null || version === null || courseEditionId === null || conceptIds === null || type === null || stem === null || sourceRefs === null || answerSchema === null || rubricId === null || rubricVersion === null || answerDisclosurePolicy === null) {
        return null;
      }
      if (!checkSafeText(stem, `${path}.stem`, issues)) return null;
      if (type === "diagram_label" && renderSpec === null) {
        issues.add("INVALID_REFERENCE", `${path}.renderSpec`, "diagram_label activities require a renderSpec");
        return null;
      }
      const expectedSchemaKind = type === "diagram_label" ? "diagram_label" : type === "relation" ? "relation" : type === "choice" ? "choice" : "text";
      if (answerSchema.kind !== expectedSchemaKind) {
        issues.add(
          "INVALID_REFERENCE",
          `${path}.answerSchema.kind`,
          `activity type ${type} requires answer schema ${expectedSchemaKind}, got ${answerSchema.kind}`
        );
        return null;
      }
      return {
        schemaVersion: 1,
        id,
        version,
        courseEditionId,
        conceptIds,
        type,
        stem,
        sourceRefs,
        renderSpec,
        answerSchema,
        rubricId,
        rubricVersion,
        answerDisclosurePolicy
      };
    }
    var validateActivity = validateWith(readActivityAt);
    function readCoverageSection(value, path, issues) {
      const obj = readObject(
        value,
        path,
        ["tocNodeId", "sourceRefs", "conceptIds", "status", "notes"],
        issues
      );
      if (obj === null) return null;
      const tocNodeId = readId(obj, "tocNodeId", path, issues);
      const sourceRefs = readStringArray(obj, "sourceRefs", path, issues, { idItems: true });
      const conceptIds = readStringArray(obj, "conceptIds", path, issues, { idItems: true });
      const status = readEnum(obj, "status", path, issues, COVERAGE_SECTION_STATUSES);
      const notes = readString(obj, "notes", path, issues, { nullable: true });
      if (tocNodeId === null || sourceRefs === null || conceptIds === null || status === null) {
        return null;
      }
      if (status === "covered" && (sourceRefs.length === 0 || conceptIds.length === 0)) {
        issues.add(
          "COVERAGE_INCOMPLETE",
          path,
          "a covered section requires source refs and at least one concept"
        );
        return null;
      }
      return { tocNodeId, sourceRefs, conceptIds, status, notes };
    }
    function readCoverageExclusion(value, path, issues) {
      const obj = readObject(value, path, ["item", "reason", "sourceRefs"], issues);
      if (obj === null) return null;
      const item = readString(obj, "item", path, issues, { minLength: 1 });
      const reason = readString(obj, "reason", path, issues, { minLength: 1 });
      const sourceRefs = readStringArray(obj, "sourceRefs", path, issues, { idItems: true });
      if (item === null || reason === null || sourceRefs === null) return null;
      return { item, reason, sourceRefs };
    }
    function readCoverageManifestAt(value, path, issues) {
      const obj = readObject(
        value,
        path,
        ["schemaVersion", "courseEditionId", "generatedAt", "targetTocNodeIds", "sections", "exclusions", "totals"],
        issues
      );
      if (obj === null) return null;
      readSchemaVersion(obj, path, issues);
      const courseEditionId = readId(obj, "courseEditionId", path, issues);
      const generatedAt = readTimestamp(obj, "generatedAt", path, issues);
      const targetTocNodeIds = readStringArray(obj, "targetTocNodeIds", path, issues, {
        idItems: true,
        minItems: 1
      });
      const sections = readArray(obj, "sections", path, issues, readCoverageSection, { minItems: 1 });
      const exclusions = readArray(obj, "exclusions", path, issues, readCoverageExclusion, {
        optional: true
      });
      const totalsObj = readObject(
        obj["totals"],
        `${path}.totals`,
        ["targetSections", "coveredSections", "conceptCount"],
        issues
      );
      let totals = null;
      if (totalsObj !== null) {
        const targetSections = readNumber(totalsObj, "targetSections", `${path}.totals`, issues, {
          integer: true,
          min: 1
        });
        const coveredSections = readNumber(totalsObj, "coveredSections", `${path}.totals`, issues, {
          integer: true,
          min: 0
        });
        const conceptCount = readNumber(totalsObj, "conceptCount", `${path}.totals`, issues, {
          integer: true,
          min: 0
        });
        if (targetSections !== null && coveredSections !== null && conceptCount !== null) {
          totals = { targetSections, coveredSections, conceptCount };
        }
      }
      if (courseEditionId === null || generatedAt === null || targetTocNodeIds === null || sections === null || totals === null) {
        return null;
      }
      return {
        schemaVersion: 1,
        courseEditionId,
        generatedAt,
        targetTocNodeIds,
        sections,
        exclusions: exclusions ?? [],
        totals
      };
    }
    var validateCoverageManifest = validateWith(readCoverageManifestAt);
    function readReviewLedgerEntryAt(value, path, issues) {
      const obj = readObject(
        value,
        path,
        [
          "schemaVersion",
          "id",
          "entityKind",
          "entityId",
          "from",
          "to",
          "actorKind",
          "actorLabel",
          "checkedAt",
          "scope",
          "notes",
          "evidenceRefs"
        ],
        issues
      );
      if (obj === null) return null;
      readSchemaVersion(obj, path, issues);
      const id = readId(obj, "id", path, issues);
      const entityKind = readEnum(
        obj,
        "entityKind",
        path,
        issues,
        ["content_pack", "concept", "relation", "activity", "rubric", "source_ref"]
      );
      const entityId = readId(obj, "entityId", path, issues);
      const from = readEnum(obj, "from", path, issues, REVIEW_STATES, { nullable: true });
      const to = readEnum(obj, "to", path, issues, REVIEW_STATES);
      const actorKind = readEnum(obj, "actorKind", path, issues, ACTOR_KINDS);
      const actorLabel = readString(obj, "actorLabel", path, issues, { nullable: true });
      const checkedAt = readTimestamp(obj, "checkedAt", path, issues);
      const scope = readString(obj, "scope", path, issues, { minLength: 1 });
      const notes = readString(obj, "notes", path, issues, { nullable: true });
      const evidenceRefs = readStringArray(obj, "evidenceRefs", path, issues, {
        idItems: true,
        optional: true
      });
      if (id === null || entityKind === null || entityId === null || to === null || actorKind === null || checkedAt === null || scope === null) {
        return null;
      }
      if (to === "curator_checked" && actorKind !== "human_curator") {
        issues.add(
          "REVIEW_STATE_INVALID",
          `${path}.actorKind`,
          "curator_checked requires a human_curator actorKind; AI review must not claim human curation"
        );
        return null;
      }
      return {
        schemaVersion: 1,
        id,
        entityKind,
        entityId,
        from,
        to,
        actorKind,
        actorLabel,
        checkedAt,
        scope,
        notes,
        evidenceRefs: evidenceRefs ?? []
      };
    }
    var validateReviewLedgerEntry = validateWith(readReviewLedgerEntryAt);
    function readContentPackAt(value, path, issues) {
      const obj = readObject(
        value,
        path,
        [
          "schemaVersion",
          "id",
          "version",
          "courseEditionId",
          "scope",
          "coverageStatus",
          "status",
          "contentHash",
          "toc",
          "concepts",
          "relations",
          "activities",
          "rubrics",
          "coverageManifest",
          "reviewLedger"
        ],
        issues
      );
      if (obj === null) return null;
      readSchemaVersion(obj, path, issues);
      const id = readId(obj, "id", path, issues);
      const version = readString(obj, "version", path, issues, {
        pattern: VERSION_LABEL_PATTERN,
        patternMessage: "pack version must be a bounded printable label"
      });
      const courseEditionId = readId(obj, "courseEditionId", path, issues);
      const scope = readEnum(obj, "scope", path, issues, PACK_SCOPES);
      const coverageStatus = readEnum(obj, "coverageStatus", path, issues, PACK_COVERAGE_STATUSES);
      const status = readEnum(obj, "status", path, issues, PACK_STATUSES);
      const contentHash = readSha256(obj, "contentHash", path, issues);
      const toc = readArray(
        obj,
        "toc",
        path,
        issues,
        (item, at, collector) => {
          const node = readObject(
            item,
            at,
            ["schemaVersion", "id", "courseEditionId", "parentId", "type", "title", "order", "sourceRefs"],
            collector
          );
          if (node === null) return null;
          readSchemaVersion(node, at, collector);
          const nodeId = readId(node, "id", at, collector);
          const edition = readId(node, "courseEditionId", at, collector);
          const parentId = readId(node, "parentId", at, collector, { nullable: true });
          const type = readEnum(node, "type", at, collector, ["volume", "unit", "chapter", "section"]);
          const title = readString(node, "title", at, collector, { minLength: 1 });
          const order = readNumber(node, "order", at, collector, { integer: true, min: 0 });
          const sourceRefs = readStringArray(node, "sourceRefs", at, collector, { idItems: true });
          if (nodeId === null || edition === null || type === null || title === null || order === null || sourceRefs === null) {
            return null;
          }
          if (!checkSafeText(title, `${at}.title`, collector)) return null;
          return {
            schemaVersion: 1,
            id: nodeId,
            courseEditionId: edition,
            parentId,
            type,
            title,
            order,
            sourceRefs
          };
        },
        { minItems: 1 }
      );
      const concepts = readArray(obj, "concepts", path, issues, readConceptAt, { minItems: 1 });
      const relations = readArray(obj, "relations", path, issues, readRelationAt, { optional: true });
      const activities = readArray(obj, "activities", path, issues, readActivityAt, { optional: true });
      const rubrics = readArray(obj, "rubrics", path, issues, readRubricAt, { optional: true });
      const coverageManifest = readCoverageManifestAt(
        obj["coverageManifest"],
        `${path}.coverageManifest`,
        issues
      );
      const reviewLedger = readArray(
        obj,
        "reviewLedger",
        path,
        issues,
        readReviewLedgerEntryAt,
        { optional: true }
      );
      if (id === null || version === null || courseEditionId === null || scope === null || coverageStatus === null || status === null || contentHash === null || toc === null || concepts === null || coverageManifest === null) {
        return null;
      }
      return {
        schemaVersion: 1,
        id,
        version,
        courseEditionId,
        scope,
        coverageStatus,
        status,
        contentHash,
        toc,
        concepts,
        relations: relations ?? [],
        activities: activities ?? [],
        rubrics: rubrics ?? [],
        coverageManifest,
        reviewLedger: reviewLedger ?? []
      };
    }
    var validateContentPackStructure = validateWith(readContentPackAt);
    
    // education/packages/domain/src/entities/learning.ts
    function readLearner(value, path, issues) {
      const obj = readObject(value, path, ["schemaVersion", "id", "createdAt"], issues);
      if (obj === null) return null;
      readSchemaVersion(obj, path, issues);
      const id = readId(obj, "id", path, issues);
      const createdAt = readTimestamp(obj, "createdAt", path, issues);
      if (id === null || createdAt === null) return null;
      return { schemaVersion: 1, id, createdAt };
    }
    var validateLearner = validateWith(readLearner);
    function readResumeCursor(value, path, issues) {
      const obj = readObject(value, path, ["activityId", "cursor"], issues);
      if (obj === null) return null;
      const activityId = readId(obj, "activityId", path, issues, { nullable: true });
      const cursor = readString(obj, "cursor", path, issues, { nullable: true, maxLength: 500 });
      return { activityId, cursor };
    }
    function readSessionAt(value, path, issues) {
      const obj = readObject(
        value,
        path,
        [
          "schemaVersion",
          "id",
          "learnerId",
          "courseEditionId",
          "packVersion",
          "trustMode",
          "conceptId",
          "mode",
          "status",
          "startedAt",
          "endedAt",
          "resumeCursor",
          "dshSessionId"
        ],
        issues
      );
      if (obj === null) return null;
      readSchemaVersion(obj, path, issues);
      const id = readId(obj, "id", path, issues);
      const learnerId = readId(obj, "learnerId", path, issues);
      const courseEditionId = readId(obj, "courseEditionId", path, issues);
      const packVersion = readString(obj, "packVersion", path, issues, {
        pattern: VERSION_LABEL_PATTERN
      });
      const trustMode = readEnum(obj, "trustMode", path, issues, TRUST_MODES);
      const conceptId = readId(obj, "conceptId", path, issues);
      const mode = readEnum(obj, "mode", path, issues, SESSION_MODES);
      const status = readEnum(obj, "status", path, issues, SESSION_STATUSES);
      const startedAt = readTimestamp(obj, "startedAt", path, issues);
      const endedAt = readTimestamp(obj, "endedAt", path, issues, { nullable: true });
      const resumeCursor = readResumeCursor(obj["resumeCursor"], `${path}.resumeCursor`, issues);
      const dshSessionId = readId(obj, "dshSessionId", path, issues, { nullable: true });
      if (id === null || learnerId === null || courseEditionId === null || packVersion === null || trustMode === null || conceptId === null || mode === null || status === null || startedAt === null || resumeCursor === null) {
        return null;
      }
      if (status === "active" && endedAt !== null) {
        issues.add("SESSION_STATE_INVALID", `${path}.endedAt`, "active sessions must not have endedAt");
        return null;
      }
      if (status !== "active" && endedAt === null) {
        issues.add(
          "SESSION_STATE_INVALID",
          `${path}.endedAt`,
          `${status} sessions require an endedAt timestamp`
        );
        return null;
      }
      if (endedAt !== null && Date.parse(endedAt) < Date.parse(startedAt)) {
        issues.add("SESSION_STATE_INVALID", `${path}.endedAt`, "endedAt must not precede startedAt");
        return null;
      }
      return {
        schemaVersion: 1,
        id,
        learnerId,
        courseEditionId,
        packVersion,
        trustMode,
        conceptId,
        mode,
        status,
        startedAt,
        endedAt,
        resumeCursor,
        dshSessionId
      };
    }
    var validateSession = validateWith(readSessionAt);
    function readHelpUsage(value, path, issues) {
      const obj = readObject(value, path, ["kind", "usedAt"], issues);
      if (obj === null) return null;
      const kind = readEnum(obj, "kind", path, issues, HELP_KINDS);
      const usedAt = readTimestamp(obj, "usedAt", path, issues, { nullable: true });
      if (kind === null) return null;
      return { kind, usedAt };
    }
    function readAttemptAt(value, path, issues) {
      const obj = readObject(
        value,
        path,
        [
          "schemaVersion",
          "id",
          "requestId",
          "learnerId",
          "sessionId",
          "courseEditionId",
          "packVersion",
          "activityId",
          "activityVersion",
          "conceptIds",
          "inputType",
          "answerAssetId",
          "answerText",
          "submittedAt",
          "helpUsed",
          "evidenceIds"
        ],
        issues
      );
      if (obj === null) return null;
      readSchemaVersion(obj, path, issues);
      const id = readId(obj, "id", path, issues);
      const requestId2 = readString(obj, "requestId", path, issues, { minLength: 1, maxLength: 128 });
      const learnerId = readId(obj, "learnerId", path, issues);
      const sessionId = readId(obj, "sessionId", path, issues);
      const courseEditionId = readId(obj, "courseEditionId", path, issues);
      const packVersion = readString(obj, "packVersion", path, issues, {
        pattern: VERSION_LABEL_PATTERN
      });
      const activityId = readId(obj, "activityId", path, issues);
      const activityVersion = readString(obj, "activityVersion", path, issues, {
        pattern: VERSION_LABEL_PATTERN
      });
      const conceptIds = readStringArray(obj, "conceptIds", path, issues, {
        idItems: true,
        minItems: 1
      });
      const inputType = readEnum(obj, "inputType", path, issues, ATTEMPT_INPUT_TYPES);
      const answerAssetId = readManagedAssetId(obj, "answerAssetId", path, issues, { nullable: true });
      const answerText = readString(obj, "answerText", path, issues, { nullable: true, maxLength: 2e4 });
      const submittedAt = readTimestamp(obj, "submittedAt", path, issues);
      const helpUsed = readArray(obj, "helpUsed", path, issues, readHelpUsage, { optional: true });
      const evidenceIds = readStringArray(obj, "evidenceIds", path, issues, {
        idItems: true,
        optional: true
      });
      if (id === null || requestId2 === null || learnerId === null || sessionId === null || courseEditionId === null || packVersion === null || activityId === null || activityVersion === null || conceptIds === null || inputType === null || submittedAt === null) {
        return null;
      }
      if (inputType === "image") {
        if (answerAssetId === null) {
          issues.add("ATTEMPT_ANSWER_INVALID", `${path}.answerAssetId`, "image answers require an asset id");
          return null;
        }
        if (answerText !== null) {
          issues.add("ATTEMPT_ANSWER_INVALID", `${path}.answerText`, "image answers must not carry answerText");
          return null;
        }
      } else {
        if (answerText === null || answerText.trim().length === 0) {
          issues.add("ATTEMPT_ANSWER_INVALID", `${path}.answerText`, "this answer type requires text");
          return null;
        }
        if (answerAssetId !== null) {
          issues.add("ATTEMPT_ANSWER_INVALID", `${path}.answerAssetId`, "only image answers carry an asset");
          return null;
        }
      }
      return {
        schemaVersion: 1,
        id,
        requestId: requestId2,
        learnerId,
        sessionId,
        courseEditionId,
        packVersion,
        activityId,
        activityVersion,
        conceptIds,
        inputType,
        answerAssetId,
        answerText,
        submittedAt,
        helpUsed: helpUsed ?? [],
        evidenceIds: evidenceIds ?? []
      };
    }
    var validateActivityAttempt = validateWith(readAttemptAt);
    function readCriterionResult(value, path, issues) {
      const obj = readObject(value, path, ["criterionId", "result", "note"], issues);
      if (obj === null) return null;
      const criterionId = readId(obj, "criterionId", path, issues);
      const result = readEnum(obj, "result", path, issues, ["met", "not_met", "unclear"]);
      const note = readString(obj, "note", path, issues, { nullable: true, maxLength: 2e3 });
      if (criterionId === null || result === null) return null;
      return { criterionId, result, note };
    }
    function readEvidenceAt(value, path, issues) {
      const obj = readObject(
        value,
        path,
        [
          "schemaVersion",
          "id",
          "attemptId",
          "learnerId",
          "courseEditionId",
          "packVersion",
          "conceptId",
          "kind",
          "observation",
          "criterionResults",
          "assistance",
          "sourceRefs",
          "assessmentOrigin",
          "modelRunId",
          "uncertainty",
          "validity",
          "createdAt"
        ],
        issues
      );
      if (obj === null) return null;
      readSchemaVersion(obj, path, issues);
      const id = readId(obj, "id", path, issues);
      const attemptId = readId(obj, "attemptId", path, issues);
      const learnerId = readId(obj, "learnerId", path, issues);
      const courseEditionId = readId(obj, "courseEditionId", path, issues);
      const packVersion = readString(obj, "packVersion", path, issues, {
        pattern: VERSION_LABEL_PATTERN
      });
      const conceptId = readId(obj, "conceptId", path, issues);
      const kind = readEnum(obj, "kind", path, issues, EVIDENCE_KINDS);
      const observation = readString(obj, "observation", path, issues, { minLength: 1 });
      const criterionResults = readArray(obj, "criterionResults", path, issues, readCriterionResult, {
        minItems: 1
      });
      const assistance = readEnum(obj, "assistance", path, issues, ASSISTANCE_LEVELS);
      const sourceRefs = readStringArray(obj, "sourceRefs", path, issues, { idItems: true });
      const assessmentOrigin = readEnum(obj, "assessmentOrigin", path, issues, ASSESSMENT_ORIGINS);
      const modelRunId = readString(obj, "modelRunId", path, issues, { nullable: true, maxLength: 200 });
      const uncertainty = readNumber(obj, "uncertainty", path, issues, {
        nullable: true,
        min: 0,
        max: 1
      });
      const validity = readEnum(obj, "validity", path, issues, VALIDITY_STATES);
      const createdAt = readTimestamp(obj, "createdAt", path, issues);
      if (id === null || attemptId === null || learnerId === null || courseEditionId === null || packVersion === null || conceptId === null || kind === null || observation === null || criterionResults === null || assistance === null || sourceRefs === null || assessmentOrigin === null || validity === null || createdAt === null) {
        return null;
      }
      if (assessmentOrigin === "model" && modelRunId === null) {
        issues.add(
          "EVIDENCE_MODEL_RUN_REQUIRED",
          `${path}.modelRunId`,
          "model originated evidence must record the model run id"
        );
        return null;
      }
      if (assessmentOrigin === "model" && uncertainty === null) {
        issues.add(
          "EVIDENCE_MODEL_RUN_REQUIRED",
          `${path}.uncertainty`,
          "model originated evidence must record uncertainty"
        );
        return null;
      }
      if (!checkSafeText(observation, `${path}.observation`, issues)) return null;
      return {
        schemaVersion: 1,
        id,
        attemptId,
        learnerId,
        courseEditionId,
        packVersion,
        conceptId,
        kind,
        observation,
        criterionResults,
        assistance,
        sourceRefs,
        assessmentOrigin,
        modelRunId,
        uncertainty,
        validity,
        createdAt
      };
    }
    var validateEvidence = validateWith(readEvidenceAt);
    function readAssessmentAt(value, path, issues) {
      const obj = readObject(
        value,
        path,
        [
          "schemaVersion",
          "id",
          "attemptId",
          "conceptId",
          "learnerId",
          "courseEditionId",
          "packVersion",
          "state",
          "rationale",
          "evidenceIds",
          "rubricVersion",
          "evaluatorVersion",
          "assessedAt",
          "validity",
          "revision"
        ],
        issues
      );
      if (obj === null) return null;
      readSchemaVersion(obj, path, issues);
      const id = readId(obj, "id", path, issues);
      const attemptId = readId(obj, "attemptId", path, issues, { nullable: true });
      const conceptId = readId(obj, "conceptId", path, issues);
      const learnerId = readId(obj, "learnerId", path, issues);
      const courseEditionId = readId(obj, "courseEditionId", path, issues);
      const packVersion = readString(obj, "packVersion", path, issues, {
        pattern: VERSION_LABEL_PATTERN
      });
      const state = readEnum(obj, "state", path, issues, ASSESSMENT_STATES);
      const rationale = readString(obj, "rationale", path, issues, { minLength: 1 });
      const evidenceIds = readStringArray(obj, "evidenceIds", path, issues, { idItems: true });
      const rubricVersion = readString(obj, "rubricVersion", path, issues, {
        pattern: VERSION_LABEL_PATTERN
      });
      const evaluatorVersion = readString(obj, "evaluatorVersion", path, issues, {
        pattern: VERSION_LABEL_PATTERN
      });
      const assessedAt = readTimestamp(obj, "assessedAt", path, issues);
      const validity = readEnum(obj, "validity", path, issues, VALIDITY_STATES);
      const revision = readNumber(obj, "revision", path, issues, { integer: true, min: 0 });
      if (id === null || conceptId === null || learnerId === null || courseEditionId === null || packVersion === null || state === null || rationale === null || evidenceIds === null || rubricVersion === null || evaluatorVersion === null || assessedAt === null || validity === null || revision === null) {
        return null;
      }
      if (evidenceIds.length === 0) {
        issues.add(
          "ASSESSMENT_WITHOUT_EVIDENCE",
          `${path}.evidenceIds`,
          "an assessment requires at least one evidence id"
        );
        return null;
      }
      if (validity === "pending" && state === "supported") {
        issues.add(
          "LOW_CONFIDENCE_UPGRADE",
          `${path}.state`,
          "pending/low-confidence assessments must not set state=supported"
        );
        return null;
      }
      return {
        schemaVersion: 1,
        id,
        attemptId,
        conceptId,
        learnerId,
        courseEditionId,
        packVersion,
        state,
        rationale,
        evidenceIds,
        rubricVersion,
        evaluatorVersion,
        assessedAt,
        validity,
        revision
      };
    }
    var validateAssessment = validateWith(readAssessmentAt);
    function readSelfReportAt(value, path, issues) {
      const obj = readObject(
        value,
        path,
        [
          "schemaVersion",
          "id",
          "learnerId",
          "courseEditionId",
          "packVersion",
          "conceptId",
          "claimedState",
          "createdAt"
        ],
        issues
      );
      if (obj === null) return null;
      readSchemaVersion(obj, path, issues);
      const id = readId(obj, "id", path, issues);
      const learnerId = readId(obj, "learnerId", path, issues);
      const courseEditionId = readId(obj, "courseEditionId", path, issues);
      const packVersion = readString(obj, "packVersion", path, issues, {
        pattern: VERSION_LABEL_PATTERN
      });
      const conceptId = readId(obj, "conceptId", path, issues);
      const claimedState = readEnum(obj, "claimedState", path, issues, SELF_REPORT_STATES);
      const createdAt = readTimestamp(obj, "createdAt", path, issues);
      if (id === null || learnerId === null || courseEditionId === null || packVersion === null || conceptId === null || claimedState === null || createdAt === null) {
        return null;
      }
      return {
        schemaVersion: 1,
        id,
        learnerId,
        courseEditionId,
        packVersion,
        conceptId,
        claimedState,
        createdAt
      };
    }
    var validateSelfReport = validateWith(readSelfReportAt);
    function readLearningProgress(value, path, issues) {
      const obj = readObject(value, path, ["state", "startedAt", "lastCompletedAt"], issues);
      if (obj === null) return null;
      const state = readEnum(obj, "state", path, issues, LEARNING_STATES);
      const startedAt = readTimestamp(obj, "startedAt", path, issues, { nullable: true });
      const lastCompletedAt = readTimestamp(obj, "lastCompletedAt", path, issues, { nullable: true });
      if (state === null) return null;
      if (state === "not_started" && (startedAt !== null || lastCompletedAt !== null)) {
        issues.add("PROGRESS_INVARIANT", path, "not_started progress must not carry timestamps");
        return null;
      }
      if (state === "in_progress" && startedAt === null) {
        issues.add("PROGRESS_INVARIANT", `${path}.startedAt`, "in_progress requires startedAt");
        return null;
      }
      if (state === "completed" && lastCompletedAt === null) {
        issues.add("PROGRESS_INVARIANT", `${path}.lastCompletedAt`, "completed requires lastCompletedAt");
        return null;
      }
      return { state, startedAt, lastCompletedAt };
    }
    function readUnderstandingProgress(value, path, issues) {
      const obj = readObject(value, path, ["state", "assessmentId", "updatedAt", "validity"], issues);
      if (obj === null) return null;
      const state = readEnum(obj, "state", path, issues, UNDERSTANDING_STATES);
      const assessmentId = readId(obj, "assessmentId", path, issues, { nullable: true });
      const updatedAt = readTimestamp(obj, "updatedAt", path, issues, { nullable: true });
      const validity = readEnum(obj, "validity", path, issues, VALIDITY_STATES);
      if (state === null || validity === null) return null;
      if (state === "unassessed" && assessmentId !== null) {
        issues.add("PROGRESS_INVARIANT", `${path}.assessmentId`, "unassessed must not point at an assessment");
        return null;
      }
      if (state !== "unassessed" && assessmentId === null) {
        issues.add("PROGRESS_INVARIANT", `${path}.assessmentId`, "an assessed state requires assessmentId");
        return null;
      }
      if (state === "supported" && validity !== "current") {
        issues.add(
          "PROGRESS_INVARIANT",
          `${path}.state`,
          "supported requires validity=current; stale evidence cannot keep a strong state"
        );
        return null;
      }
      return { state, assessmentId, updatedAt, validity };
    }
    function readReviewRecord(value, path, issues) {
      const obj = readObject(
        value,
        path,
        ["lastCompletedAt", "dueAt", "activeSessionId", "latestOutcome", "policyVersion"],
        issues
      );
      if (obj === null) return null;
      const lastCompletedAt = readTimestamp(obj, "lastCompletedAt", path, issues, { nullable: true });
      const dueAt = readTimestamp(obj, "dueAt", path, issues, { nullable: true });
      const activeSessionId = readId(obj, "activeSessionId", path, issues, { nullable: true });
      const latestOutcome = readEnum(obj, "latestOutcome", path, issues, REVIEW_OUTCOMES, {
        nullable: true
      });
      const policyVersion = readString(obj, "policyVersion", path, issues, { minLength: 1 });
      if (policyVersion === null) return null;
      if (lastCompletedAt === null !== (latestOutcome === null)) {
        issues.add(
          "REVIEW_INVARIANT",
          path,
          "lastCompletedAt and latestOutcome must both be null or both be set"
        );
        return null;
      }
      return { lastCompletedAt, dueAt, activeSessionId, latestOutcome, policyVersion };
    }
    function readLastPosition(value, path, issues) {
      const obj = readObject(value, path, ["sessionId", "activityId", "cursor", "updatedAt"], issues);
      if (obj === null) return null;
      const sessionId = readId(obj, "sessionId", path, issues, { nullable: true });
      const activityId = readId(obj, "activityId", path, issues, { nullable: true });
      const cursor = readString(obj, "cursor", path, issues, { nullable: true, maxLength: 500 });
      const updatedAt = readTimestamp(obj, "updatedAt", path, issues, { nullable: true });
      return { sessionId, activityId, cursor, updatedAt };
    }
    function readConceptProgressAt(value, path, issues) {
      const obj = readObject(
        value,
        path,
        [
          "schemaVersion",
          "learnerId",
          "courseEditionId",
          "packVersion",
          "conceptId",
          "learning",
          "understanding",
          "review",
          "lastPosition",
          "revision"
        ],
        issues
      );
      if (obj === null) return null;
      readSchemaVersion(obj, path, issues);
      const learnerId = readId(obj, "learnerId", path, issues);
      const courseEditionId = readId(obj, "courseEditionId", path, issues);
      const packVersion = readString(obj, "packVersion", path, issues, {
        pattern: VERSION_LABEL_PATTERN
      });
      const conceptId = readId(obj, "conceptId", path, issues);
      const learning = readLearningProgress(obj["learning"], `${path}.learning`, issues);
      const understanding = readUnderstandingProgress(
        obj["understanding"],
        `${path}.understanding`,
        issues
      );
      const review = readReviewRecord(obj["review"], `${path}.review`, issues);
      const lastPosition = readLastPosition(obj["lastPosition"], `${path}.lastPosition`, issues);
      const revision = readNumber(obj, "revision", path, issues, { integer: true, min: 0 });
      if (learnerId === null || courseEditionId === null || packVersion === null || conceptId === null || learning === null || understanding === null || review === null || lastPosition === null || revision === null) {
        return null;
      }
      return {
        schemaVersion: 1,
        learnerId,
        courseEditionId,
        packVersion,
        conceptId,
        learning,
        understanding,
        review,
        lastPosition,
        revision
      };
    }
    var validateConceptProgress = validateWith(readConceptProgressAt);
    
    // education/packages/domain/src/entities/system.ts
    function readImportError(value, path, issues) {
      const obj = readObject(value, path, ["code", "message", "retryable"], issues);
      if (obj === null) return null;
      const code = readString(obj, "code", path, issues, { minLength: 1 });
      const message = readString(obj, "message", path, issues, { minLength: 1 });
      const retryable = readBoolean(obj, "retryable", path, issues);
      if (code === null || message === null || retryable === null) return null;
      return { code, message, retryable };
    }
    function readImportCheckpoint(value, path, issues) {
      const obj = readObject(value, path, ["stage", "lastCompletedUnit", "parserCacheKey"], issues);
      if (obj === null) return null;
      const stage = readEnum(obj, "stage", path, issues, IMPORT_STAGES);
      const lastCompletedUnit = readNumber(obj, "lastCompletedUnit", path, issues, {
        integer: true,
        min: 0,
        nullable: true
      });
      const parserCacheKey = readString(obj, "parserCacheKey", path, issues, {
        nullable: true,
        maxLength: 200
      });
      if (stage === null) return null;
      return { stage, lastCompletedUnit, parserCacheKey };
    }
    function readImportCostUsage(value, path, issues) {
      const obj = readObject(
        value,
        path,
        ["calls", "inputTokens", "outputTokens", "estimatedCostUsd"],
        issues
      );
      if (obj === null) return null;
      const calls = readNumber(obj, "calls", path, issues, { integer: true, min: 0 });
      const inputTokens = readNumber(obj, "inputTokens", path, issues, { integer: true, min: 0 });
      const outputTokens = readNumber(obj, "outputTokens", path, issues, { integer: true, min: 0 });
      const estimatedCostUsd = readNumber(obj, "estimatedCostUsd", path, issues, {
        nullable: true,
        min: 0
      });
      if (calls === null || inputTokens === null || outputTokens === null) return null;
      return { calls, inputTokens, outputTokens, estimatedCostUsd };
    }
    function readImportJobAt(value, path, issues) {
      const obj = readObject(
        value,
        path,
        [
          "schemaVersion",
          "id",
          "requestId",
          "sha256",
          "stage",
          "status",
          "checkpoint",
          "completedUnits",
          "totalUnits",
          "error",
          "retryable",
          "parserVersion",
          "modelVersion",
          "costUsage",
          "createdAt",
          "updatedAt"
        ],
        issues
      );
      if (obj === null) return null;
      readSchemaVersion(obj, path, issues);
      const id = readId(obj, "id", path, issues);
      const requestId2 = readString(obj, "requestId", path, issues, { minLength: 1, maxLength: 128 });
      const sha256 = readSha256(obj, "sha256", path, issues);
      const stage = readEnum(obj, "stage", path, issues, IMPORT_STAGES);
      const status = readEnum(obj, "status", path, issues, IMPORT_STATUSES);
      const checkpoint = readImportCheckpoint(obj["checkpoint"], `${path}.checkpoint`, issues);
      const completedUnits = readNumber(obj, "completedUnits", path, issues, { integer: true, min: 0 });
      const totalUnits = readNumber(obj, "totalUnits", path, issues, { integer: true, min: 1 });
      const errorRaw = obj["error"];
      let error = null;
      if (errorRaw !== null && errorRaw !== void 0) {
        error = readImportError(errorRaw, `${path}.error`, issues);
      }
      const retryable = readBoolean(obj, "retryable", path, issues);
      const parserVersion = readString(obj, "parserVersion", path, issues, {
        pattern: VERSION_LABEL_PATTERN
      });
      const modelVersion = readString(obj, "modelVersion", path, issues, {
        nullable: true,
        maxLength: 128
      });
      const costUsage = readImportCostUsage(obj["costUsage"], `${path}.costUsage`, issues);
      const createdAt = readTimestamp(obj, "createdAt", path, issues);
      const updatedAt = readTimestamp(obj, "updatedAt", path, issues);
      if (id === null || requestId2 === null || sha256 === null || stage === null || status === null || checkpoint === null || completedUnits === null || totalUnits === null || retryable === null || parserVersion === null || costUsage === null || createdAt === null || updatedAt === null) {
        return null;
      }
      if (completedUnits > totalUnits) {
        issues.add("IMPORT_INVARIANT", `${path}.completedUnits`, "completedUnits exceeds totalUnits");
        return null;
      }
      if (Date.parse(updatedAt) < Date.parse(createdAt)) {
        issues.add("IMPORT_INVARIANT", `${path}.updatedAt`, "updatedAt precedes createdAt");
        return null;
      }
      if (status === "failed" && error === null) {
        issues.add("IMPORT_INVARIANT", `${path}.error`, "failed imports require an error");
        return null;
      }
      if (status === "completed" && stage !== "ready") {
        issues.add(
          "IMPORT_INVARIANT",
          `${path}.status`,
          "completed imports must be at stage=ready (await_review is not completion)"
        );
        return null;
      }
      if (stage === "await_review" && status === "completed") {
        issues.add(
          "IMPORT_INVARIANT",
          `${path}.status`,
          "await_review means pending review and cannot be reported as completed"
        );
        return null;
      }
      return {
        schemaVersion: 1,
        id,
        requestId: requestId2,
        sha256,
        stage,
        status,
        checkpoint,
        completedUnits,
        totalUnits,
        error,
        retryable,
        parserVersion,
        modelVersion,
        costUsage,
        createdAt,
        updatedAt
      };
    }
    var validateImportJob = validateWith(readImportJobAt);
    function applyImportProgress(job, update) {
      const issues = new IssueCollector();
      const nextStage = update.stage ?? job.stage;
      const nextStatus = update.status ?? job.status;
      const nextCompleted = update.completedUnits ?? job.completedUnits;
      const nextTotal = update.totalUnits ?? job.totalUnits;
      const stageIndex2 = IMPORT_STAGES.indexOf(nextStage);
      const currentIndex = IMPORT_STAGES.indexOf(job.stage);
      if (job.status === "cancelled" && nextStage !== job.stage) {
        issues.add(
          "IMPORT_LATE_RESULT",
          "$.stage",
          "a cancelled import must not publish late stage results"
        );
      }
      if (stageIndex2 < currentIndex) {
        issues.add("IMPORT_TRANSITION_INVALID", "$.stage", "import stages must not move backwards");
      }
      if (nextCompleted < job.completedUnits) {
        issues.add(
          "IMPORT_TRANSITION_INVALID",
          "$.completedUnits",
          "completedUnits must not decrease"
        );
      }
      if (nextCompleted > nextTotal) {
        issues.add("IMPORT_INVARIANT", "$.completedUnits", "completedUnits exceeds totalUnits");
      }
      if (nextStatus === "completed" && nextStage !== "ready") {
        issues.add(
          "IMPORT_INVARIANT",
          "$.status",
          "only a ready import can be completed; await_review is pending"
        );
      }
      if (nextStatus === "failed" && update.error == null) {
        issues.add("IMPORT_INVARIANT", "$.error", "failed imports require an error");
      }
      if (update.checkpoint !== void 0 && update.checkpoint !== null && update.checkpoint.stage !== nextStage) {
        issues.add(
          "IMPORT_INVARIANT",
          "$.checkpoint.stage",
          "checkpoint stage must match the job stage"
        );
      }
      if (issues.count > 0) return { ok: false, issues: issues.list };
      const next = {
        ...job,
        stage: nextStage,
        status: nextStatus,
        completedUnits: nextCompleted,
        totalUnits: nextTotal,
        checkpoint: update.checkpoint ?? job.checkpoint,
        error: update.error !== void 0 ? update.error : job.error,
        retryable: update.retryable ?? job.retryable,
        updatedAt: update.updatedAt
      };
      return finish(next, issues);
    }
    function readCompatibilityReview(value, path, issues) {
      const obj = readObject(value, path, ["verified", "actorKind", "checkedAt", "notes"], issues);
      if (obj === null) return null;
      const verified = readBoolean(obj, "verified", path, issues);
      const actorKind = readEnum(obj, "actorKind", path, issues, ACTOR_KINDS, { nullable: true });
      const checkedAt = readTimestamp(obj, "checkedAt", path, issues, { nullable: true });
      const notes = readString(obj, "notes", path, issues, { nullable: true, maxLength: 2e3 });
      if (verified === null) return null;
      if (verified && actorKind === null) {
        issues.add(
          "COMPATIBILITY_INVALID",
          `${path}.actorKind`,
          "a verified compatibility mapping requires a review actor"
        );
        return null;
      }
      return { verified, actorKind, checkedAt, notes };
    }
    function readConceptMapping(value, path, issues) {
      const obj = readObject(
        value,
        path,
        ["fromConceptId", "toConceptIds", "kind", "rationale", "review", "evidenceEffect"],
        issues
      );
      if (obj === null) return null;
      const fromConceptId = readId(obj, "fromConceptId", path, issues, { nullable: true });
      const toConceptIds = readStringArray(obj, "toConceptIds", path, issues, { idItems: true });
      const kind = readEnum(obj, "kind", path, issues, COMPATIBILITY_MAPPING_KINDS);
      const rationale = readString(obj, "rationale", path, issues, { minLength: 1 });
      const review = readCompatibilityReview(obj["review"], `${path}.review`, issues);
      const evidenceEffect = readEnum(obj, "evidenceEffect", path, issues, EVIDENCE_EFFECTS);
      if (kind === null || rationale === null || review === null || evidenceEffect === null) {
        return null;
      }
      if (kind === "added" && fromConceptId !== null) {
        issues.add("COMPATIBILITY_INVALID", `${path}.fromConceptId`, "added concepts have no old id");
        return null;
      }
      if (kind === "removed" && (toConceptIds ?? []).length !== 0) {
        issues.add("COMPATIBILITY_INVALID", `${path}.toConceptIds`, "removed concepts have no new id");
        return null;
      }
      if (kind === "split" && (toConceptIds ?? []).length < 2) {
        issues.add("COMPATIBILITY_INVALID", `${path}.toConceptIds`, "split requires at least two new ids");
        return null;
      }
      if (kind === "merged" && (toConceptIds ?? []).length !== 1) {
        issues.add("COMPATIBILITY_INVALID", `${path}.toConceptIds`, "merged maps to exactly one new id");
        return null;
      }
      if (kind === "unchanged" || kind === "renamed") {
        if (fromConceptId === null || (toConceptIds ?? []).length !== 1) {
          issues.add(
            "COMPATIBILITY_INVALID",
            path,
            `${kind} mappings require one old and one new concept id`
          );
          return null;
        }
      }
      if (evidenceEffect === "inherit" && !review.verified) {
        issues.add(
          "COMPATIBILITY_UNVERIFIED",
          `${path}.evidenceEffect`,
          "history can only be inherited through a verified mapping"
        );
        return null;
      }
      return {
        fromConceptId,
        toConceptIds: toConceptIds ?? [],
        kind,
        rationale,
        review,
        evidenceEffect
      };
    }
    function readCompatibilityMapAt(value, path, issues) {
      const obj = readObject(
        value,
        path,
        [
          "schemaVersion",
          "id",
          "courseEditionId",
          "fromPackVersion",
          "toPackVersion",
          "fromContentHash",
          "toContentHash",
          "mappings",
          "createdAt"
        ],
        issues
      );
      if (obj === null) return null;
      readSchemaVersion(obj, path, issues);
      const id = readId(obj, "id", path, issues);
      const courseEditionId = readId(obj, "courseEditionId", path, issues);
      const fromPackVersion = readString(obj, "fromPackVersion", path, issues, {
        pattern: VERSION_LABEL_PATTERN
      });
      const toPackVersion = readString(obj, "toPackVersion", path, issues, {
        pattern: VERSION_LABEL_PATTERN
      });
      const fromContentHash = readSha256(obj, "fromContentHash", path, issues);
      const toContentHash = readSha256(obj, "toContentHash", path, issues);
      const mappings = readArray(obj, "mappings", path, issues, readConceptMapping, { minItems: 1 });
      const createdAt = readTimestamp(obj, "createdAt", path, issues);
      if (id === null || courseEditionId === null || fromPackVersion === null || toPackVersion === null || fromContentHash === null || toContentHash === null || mappings === null || createdAt === null) {
        return null;
      }
      if (fromPackVersion === toPackVersion) {
        issues.add(
          "COMPATIBILITY_INVALID",
          `${path}.toPackVersion`,
          "a compatibility map must connect two different pack versions"
        );
        return null;
      }
      if (fromContentHash === toContentHash) {
        issues.add(
          "COMPATIBILITY_INVALID",
          `${path}.toContentHash`,
          "content hashes must differ for a new pack version"
        );
        return null;
      }
      return {
        schemaVersion: 1,
        id,
        courseEditionId,
        fromPackVersion,
        toPackVersion,
        fromContentHash,
        toContentHash,
        mappings,
        createdAt
      };
    }
    var validateCompatibilityMap = validateWith(readCompatibilityMapAt);
    function readGradeCriterion(value, path, issues) {
      const obj = readObject(value, path, ["criterionId", "met", "rationale"], issues);
      if (obj === null) return null;
      const criterionId = readId(obj, "criterionId", path, issues);
      const met = readEnum(obj, "met", path, issues, ["yes", "no", "unclear"]);
      const rationale = readString(obj, "rationale", path, issues, { minLength: 1 });
      if (criterionId === null || met === null || rationale === null) return null;
      return { criterionId, met, rationale };
    }
    function readEvidenceCandidate(value, path, issues) {
      const obj = readObject(
        value,
        path,
        [
          "conceptId",
          "kind",
          "observation",
          "criterionResults",
          "assistance",
          "sourceRefs",
          "assessmentOrigin",
          "modelRunId",
          "uncertainty"
        ],
        issues
      );
      if (obj === null) return null;
      const conceptId = readId(obj, "conceptId", path, issues);
      const kind = readEnum(obj, "kind", path, issues, EVIDENCE_KINDS);
      const observation = readString(obj, "observation", path, issues, { minLength: 1 });
      const criterionResults = readArray(obj, "criterionResults", path, issues, readCriterionResult2, {
        minItems: 1
      });
      const assistance = readEnum(obj, "assistance", path, issues, ASSISTANCE_LEVELS);
      const sourceRefs = readStringArray(obj, "sourceRefs", path, issues, { idItems: true });
      const assessmentOrigin = readEnum(obj, "assessmentOrigin", path, issues, ASSESSMENT_ORIGINS);
      const modelRunId = readString(obj, "modelRunId", path, issues, { nullable: true, maxLength: 200 });
      const uncertainty = readNumber(obj, "uncertainty", path, issues, {
        nullable: true,
        min: 0,
        max: 1
      });
      if (conceptId === null || kind === null || observation === null || criterionResults === null || assistance === null || sourceRefs === null || assessmentOrigin === null) {
        return null;
      }
      if (!checkSafeText(observation, `${path}.observation`, issues)) return null;
      return {
        conceptId,
        kind,
        observation,
        criterionResults,
        assistance,
        sourceRefs,
        assessmentOrigin,
        modelRunId,
        uncertainty
      };
    }
    function readCriterionResult2(value, path, issues) {
      const obj = readObject(value, path, ["criterionId", "result", "note"], issues);
      if (obj === null) return null;
      const criterionId = readId(obj, "criterionId", path, issues);
      const result = readEnum(obj, "result", path, issues, ["met", "not_met", "unclear"]);
      const note = readString(obj, "note", path, issues, { nullable: true, maxLength: 2e3 });
      if (criterionId === null || result === null) return null;
      return { criterionId, result, note };
    }
    function readGradeResultAt(value, path, issues) {
      const obj = readObject(
        value,
        path,
        [
          "schemaVersion",
          "attemptId",
          "criteria",
          "feedback",
          "uncertainties",
          "evidenceCandidates",
          "requiresClarification",
          "sourceRefs",
          "graderVersion"
        ],
        issues
      );
      if (obj === null) return null;
      readSchemaVersion(obj, path, issues);
      const attemptId = readId(obj, "attemptId", path, issues);
      const criteria = readArray(obj, "criteria", path, issues, readGradeCriterion, { minItems: 1 });
      const feedback = readString(obj, "feedback", path, issues, { minLength: 1 });
      const uncertainties = readStringArray(obj, "uncertainties", path, issues, { optional: true });
      const evidenceCandidates = readArray(obj, "evidenceCandidates", path, issues, readEvidenceCandidate, {
        optional: true
      });
      const requiresClarification = readBoolean(obj, "requiresClarification", path, issues);
      const sourceRefs = readStringArray(obj, "sourceRefs", path, issues, { idItems: true });
      const graderVersion = readString(obj, "graderVersion", path, issues, {
        pattern: VERSION_LABEL_PATTERN
      });
      if (attemptId === null || criteria === null || feedback === null || requiresClarification === null || sourceRefs === null || graderVersion === null) {
        return null;
      }
      if (requiresClarification && (evidenceCandidates ?? []).length > 0) {
        issues.add(
          "GRADE_CLARIFICATION_CONFLICT",
          `${path}.evidenceCandidates`,
          "an unclear image/answer must not produce evidence candidates (no guessing)"
        );
        return null;
      }
      for (const [index, candidate] of (evidenceCandidates ?? []).entries()) {
        if (candidate.assessmentOrigin === "model" && candidate.modelRunId === null) {
          issues.add(
            "EVIDENCE_MODEL_RUN_REQUIRED",
            `${path}.evidenceCandidates[${index}].modelRunId`,
            "model evidence candidates must record the model run id"
          );
        }
        if (candidate.assessmentOrigin === "model" && candidate.uncertainty === null) {
          issues.add(
            "EVIDENCE_MODEL_RUN_REQUIRED",
            `${path}.evidenceCandidates[${index}].uncertainty`,
            "model evidence candidates must record uncertainty"
          );
        }
      }
      if (!checkSafeText(feedback, `${path}.feedback`, issues)) return null;
      return {
        schemaVersion: 1,
        attemptId,
        criteria,
        feedback,
        uncertainties: uncertainties ?? [],
        evidenceCandidates: evidenceCandidates ?? [],
        requiresClarification,
        sourceRefs,
        graderVersion
      };
    }
    var validateGradeResult = validateWith(readGradeResultAt);
    function readJournalEffect(value, path, issues) {
      const obj = readObject(value, path, ["kind", "targetId", "revision"], issues);
      if (obj === null) return null;
      const kind = readString(obj, "kind", path, issues, {
        pattern: /^[a-z][a-z0-9_.]{1,63}$/,
        patternMessage: "effect kind must be a lowercase dotted identifier"
      });
      const targetId = readId(obj, "targetId", path, issues);
      const revision = readNumber(obj, "revision", path, issues, { integer: true, min: 0 });
      if (kind === null || targetId === null || revision === null) return null;
      return { kind, targetId, revision };
    }
    function readJournalCommandAt(value, path, issues) {
      const obj = readObject(
        value,
        path,
        ["schemaVersion", "eventId", "requestId", "seq", "occurredAt", "learnerId", "type", "payload", "effects"],
        issues
      );
      if (obj === null) return null;
      readSchemaVersion(obj, path, issues);
      const eventId = readId(obj, "eventId", path, issues);
      const requestId2 = readString(obj, "requestId", path, issues, { minLength: 1, maxLength: 128 });
      const seq = readNumber(obj, "seq", path, issues, { integer: true, min: 0 });
      const occurredAt = readTimestamp(obj, "occurredAt", path, issues);
      const learnerId = readId(obj, "learnerId", path, issues);
      const type = readString(obj, "type", path, issues, {
        pattern: /^[a-z][a-z0-9_.]{1,63}$/,
        patternMessage: "command type must be a lowercase dotted identifier"
      });
      const payloadRaw = obj["payload"];
      let payload = null;
      if (!isPlainObject(payloadRaw)) {
        issues.add("INVALID_TYPE", `${path}.payload`, "payload must be a plain object");
      } else {
        payload = payloadRaw;
      }
      const effects = readArray(obj, "effects", path, issues, readJournalEffect, { optional: true });
      if (eventId === null || requestId2 === null || seq === null || occurredAt === null || learnerId === null || type === null || payload === null) {
        return null;
      }
      return {
        schemaVersion: 1,
        eventId,
        requestId: requestId2,
        seq,
        occurredAt,
        learnerId,
        type,
        payload,
        effects: effects ?? []
      };
    }
    var validateJournalCommand = validateWith(readJournalCommandAt);
    function readSnapshot(value, path, issues) {
      const obj = readObject(
        value,
        path,
        ["schemaVersion", "learnerId", "lastSeq", "createdAt", "stateHash", "payload"],
        issues
      );
      if (obj === null) return null;
      readSchemaVersion(obj, path, issues);
      const learnerId = readId(obj, "learnerId", path, issues);
      const lastSeq = readNumber(obj, "lastSeq", path, issues, { integer: true, min: 0 });
      const createdAt = readTimestamp(obj, "createdAt", path, issues);
      const stateHash = readSha256(obj, "stateHash", path, issues);
      const payloadRaw = obj["payload"];
      let payload = null;
      if (!isPlainObject(payloadRaw)) {
        issues.add("SNAPSHOT_INVALID", `${path}.payload`, "snapshot payload must be a plain object");
      } else {
        payload = payloadRaw;
      }
      if (learnerId === null || lastSeq === null || createdAt === null || stateHash === null || payload === null) {
        return null;
      }
      return { schemaVersion: 1, learnerId, lastSeq, createdAt, stateHash, payload };
    }
    var validateSnapshot = validateWith(readSnapshot);
    function readRealtimeEnvelope(value, path, issues) {
      const obj = readObject(
        value,
        path,
        ["schemaVersion", "eventId", "topic", "entityId", "revision", "seq", "payload"],
        issues
      );
      if (obj === null) return null;
      readSchemaVersion(obj, path, issues);
      const eventId = readId(obj, "eventId", path, issues);
      const topic = readEnum(obj, "topic", path, issues, REALTIME_TOPICS);
      const entityId = readId(obj, "entityId", path, issues);
      const revision = readNumber(obj, "revision", path, issues, { integer: true, min: 0 });
      const seq = readNumber(obj, "seq", path, issues, { integer: true, min: 0 });
      const payloadRaw = obj["payload"];
      let payload = null;
      if (!isPlainObject(payloadRaw)) {
        issues.add("INVALID_TYPE", `${path}.payload`, "payload must be a plain object");
      } else {
        payload = payloadRaw;
      }
      if (eventId === null || topic === null || entityId === null || revision === null || seq === null || payload === null) {
        return null;
      }
      return { schemaVersion: 1, eventId, topic, entityId, revision, seq, payload };
    }
    var validateRealtimeEnvelope = validateWith(readRealtimeEnvelope);
    
    // education/packages/domain/src/services/results.ts
    function okResult(data, revision) {
      return { ok: true, data, revision };
    }
    function errResult(code, message, retryable = false, detailsRef) {
      return {
        ok: false,
        error: detailsRef === void 0 ? { code, message, retryable } : { code, message, retryable, detailsRef }
      };
    }
    
    // education/packages/domain/fixtures/packs/valid-partial.json
    var valid_partial_default = {
      schemaVersion: 1,
      id: "pack.biology-7a",
      version: "1.0.0",
      courseEditionId: "course.biology-7a",
      scope: "partial",
      coverageStatus: "partial",
      status: "published",
      contentHash: "5697ae79b64d4a3e798420d57376db5d32ff3a7c7899dba91933263b7dc854f7",
      toc: [
        {
          schemaVersion: 1,
          id: "toc.volume",
          courseEditionId: "course.biology-7a",
          parentId: null,
          type: "volume",
          title: "fixture volume",
          order: 0,
          sourceRefs: [
            "source.p18"
          ]
        },
        {
          schemaVersion: 1,
          id: "toc.ch1",
          courseEditionId: "course.biology-7a",
          parentId: "toc.volume",
          type: "chapter",
          title: "fixture chapter 1",
          order: 0,
          sourceRefs: [
            "source.p18"
          ]
        },
        {
          schemaVersion: 1,
          id: "toc.ch2",
          courseEditionId: "course.biology-7a",
          parentId: "toc.volume",
          type: "chapter",
          title: "fixture chapter 2",
          order: 1,
          sourceRefs: [
            "source.p26"
          ]
        },
        {
          schemaVersion: 1,
          id: "toc.ch1.s1",
          courseEditionId: "course.biology-7a",
          parentId: "toc.ch1",
          type: "section",
          title: "fixture section 1.1",
          order: 0,
          sourceRefs: [
            "source.p18"
          ]
        },
        {
          schemaVersion: 1,
          id: "toc.ch1.s2",
          courseEditionId: "course.biology-7a",
          parentId: "toc.ch1",
          type: "section",
          title: "fixture section 1.2",
          order: 1,
          sourceRefs: [
            "source.p19"
          ]
        },
        {
          schemaVersion: 1,
          id: "toc.ch2.s1",
          courseEditionId: "course.biology-7a",
          parentId: "toc.ch2",
          type: "section",
          title: "fixture section 2.1",
          order: 0,
          sourceRefs: [
            "source.p26"
          ]
        }
      ],
      concepts: [
        {
          schemaVersion: 1,
          id: "concept.cell",
          courseEditionId: "course.biology-7a",
          title: "\u7EC6\u80DE",
          aliases: [
            "cell"
          ],
          placements: [
            "toc.ch1.s1",
            "toc.ch2.s1"
          ],
          learningObjectives: [
            "\u80FD\u8BF4\u660E\u7EC6\u80DE\u662F\u751F\u7269\u4F53\u7ED3\u6784\u548C\u529F\u80FD\u7684\u57FA\u672C\u5355\u4F4D"
          ],
          explanation: "fixture explanation: \u7EC6\u80DE\u662F\u751F\u7269\u4F53\u7ED3\u6784\u548C\u529F\u80FD\u7684\u57FA\u672C\u5355\u4F4D\u3002",
          misconceptions: [
            {
              statement: "\u6240\u6709\u7EC6\u80DE\u90FD\u4E00\u6837\u5927",
              correction: "\u4E0D\u540C\u7EC6\u80DE\u5F62\u6001\u5927\u5C0F\u4E0D\u540C",
              sourceRefs: [
                "source.p18"
              ]
            }
          ],
          sourceRefs: [
            "source.p18"
          ],
          rubricIds: [
            "rubric.cell"
          ],
          activityIds: [
            "activity.cell-recall",
            "activity.cell-explain",
            "activity.cell-label"
          ],
          reviewState: "published"
        },
        {
          schemaVersion: 1,
          id: "concept.cell-structure",
          courseEditionId: "course.biology-7a",
          title: "\u7EC6\u80DE\u7ED3\u6784",
          aliases: [],
          placements: [
            "toc.ch2.s1"
          ],
          learningObjectives: [
            "\u80FD\u6307\u51FA\u7EC6\u80DE\u6838\u7B49\u7ED3\u6784\u7684\u4F4D\u7F6E"
          ],
          explanation: "fixture explanation: \u7EC6\u80DE\u7531\u7EC6\u80DE\u819C\u3001\u7EC6\u80DE\u8D28\u3001\u7EC6\u80DE\u6838\u7B49\u7ED3\u6784\u7EC4\u6210\u3002",
          misconceptions: [],
          sourceRefs: [
            "source.p26"
          ],
          rubricIds: [
            "rubric.cell"
          ],
          activityIds: [
            "activity.cell-label"
          ],
          reviewState: "published"
        },
        {
          schemaVersion: 1,
          id: "concept.cell-division",
          courseEditionId: "course.biology-7a",
          title: "\u7EC6\u80DE\u5206\u88C2",
          aliases: [],
          placements: [
            "toc.ch1.s2"
          ],
          learningObjectives: [
            "\u80FD\u63CF\u8FF0\u7EC6\u80DE\u5206\u88C2\u4F7F\u7EC6\u80DE\u6570\u76EE\u589E\u591A"
          ],
          explanation: "fixture explanation: \u7EC6\u80DE\u5206\u88C2\u4F7F\u7EC6\u80DE\u6570\u76EE\u589E\u591A\u3002",
          misconceptions: [],
          sourceRefs: [
            "source.p19",
            "source.p20"
          ],
          rubricIds: [
            "rubric.cell"
          ],
          activityIds: [
            "activity.cell-relation"
          ],
          reviewState: "published"
        }
      ],
      relations: [
        {
          schemaVersion: 1,
          id: "relation.prereq.cell-structure",
          courseEditionId: "course.biology-7a",
          fromConceptId: "concept.cell",
          toConceptId: "concept.cell-structure",
          type: "prerequisite",
          basis: "explicit_source",
          rationale: "\u7406\u89E3\u7EC6\u80DE\u7ED3\u6784\u524D\u5148\u8BA4\u8BC6\u7EC6\u80DE\uFF08fixture\uFF09",
          sourceRefs: [
            "source.p19"
          ],
          reviewState: "published"
        },
        {
          schemaVersion: 1,
          id: "relation.prereq.division",
          courseEditionId: "course.biology-7a",
          fromConceptId: "concept.cell-structure",
          toConceptId: "concept.cell-division",
          type: "prerequisite",
          basis: "pedagogical_inference",
          rationale: "fixture pedagogical inference, not a textbook dependency claim",
          sourceRefs: [],
          reviewState: "published"
        },
        {
          schemaVersion: 1,
          id: "relation.related.cell-division",
          courseEditionId: "course.biology-7a",
          fromConceptId: "concept.cell",
          toConceptId: "concept.cell-division",
          type: "related",
          basis: "explicit_source",
          rationale: "fixture related association",
          sourceRefs: [
            "source.p20"
          ],
          reviewState: "published"
        }
      ],
      activities: [
        {
          schemaVersion: 1,
          id: "activity.cell-recall",
          version: "1",
          courseEditionId: "course.biology-7a",
          conceptIds: [
            "concept.cell"
          ],
          type: "recall",
          stem: "fixture recall: \u7EC6\u80DE\u662F\u4EC0\u4E48\uFF1F",
          sourceRefs: [
            "source.p18"
          ],
          renderSpec: null,
          answerSchema: {
            kind: "text",
            maxLength: 500
          },
          rubricId: "rubric.cell",
          rubricVersion: "1",
          answerDisclosurePolicy: "after_independent_attempt"
        },
        {
          schemaVersion: 1,
          id: "activity.cell-explain",
          version: "1",
          courseEditionId: "course.biology-7a",
          conceptIds: [
            "concept.cell"
          ],
          type: "explain",
          stem: "fixture explain: \u7528\u81EA\u5DF1\u7684\u8BDD\u8BF4\u660E\u7EC6\u80DE\u4E3A\u4EC0\u4E48\u662F\u57FA\u672C\u5355\u4F4D\u3002",
          sourceRefs: [
            "source.p18"
          ],
          renderSpec: null,
          answerSchema: {
            kind: "text",
            maxLength: 2e3
          },
          rubricId: "rubric.cell",
          rubricVersion: "1",
          answerDisclosurePolicy: "after_independent_attempt"
        },
        {
          schemaVersion: 1,
          id: "activity.cell-label",
          version: "1",
          courseEditionId: "course.biology-7a",
          conceptIds: [
            "concept.cell",
            "concept.cell-structure"
          ],
          type: "diagram_label",
          stem: "fixture diagram: \u5728\u56FE\u4E2D\u6807\u51FA\u7EC6\u80DE\u6838\u3002",
          sourceRefs: [
            "source.p26"
          ],
          renderSpec: {
            schemaVersion: 1,
            nodes: [
              {
                id: "node.cell",
                label: "\u7EC6\u80DE",
                kind: "structure"
              },
              {
                id: "node.nucleus",
                label: "\u7EC6\u80DE\u6838",
                kind: "structure"
              }
            ],
            edges: [],
            labels: [],
            regions: [
              {
                id: "region.nucleus",
                assetId: "asset.figure.cell",
                bbox: {
                  x: 0.2,
                  y: 0.2,
                  width: 0.3,
                  height: 0.3
                },
                altText: "\u7EC6\u80DE\u6838\u6240\u5728\u7684\u533A\u57DF"
              }
            ],
            altText: "fixture cell structure diagram with a highlighted nucleus region",
            sourceRefs: [
              "source.p26"
            ]
          },
          answerSchema: {
            kind: "diagram_label",
            targets: [
              {
                id: "target.nucleus",
                label: "\u7EC6\u80DE\u6838"
              }
            ]
          },
          rubricId: "rubric.cell",
          rubricVersion: "1",
          answerDisclosurePolicy: "after_independent_attempt"
        },
        {
          schemaVersion: 1,
          id: "activity.cell-transfer",
          version: "1",
          courseEditionId: "course.biology-7a",
          conceptIds: [
            "concept.cell"
          ],
          type: "transfer",
          stem: "fixture transfer: \u4E3E\u4F8B\u8BF4\u660E\u4E0D\u540C\u7EC6\u80DE\u5F62\u6001\u4E0D\u540C\u3002",
          sourceRefs: [
            "source.p20"
          ],
          renderSpec: null,
          answerSchema: {
            kind: "text",
            maxLength: 2e3
          },
          rubricId: "rubric.cell",
          rubricVersion: "1",
          answerDisclosurePolicy: "after_independent_attempt"
        },
        {
          schemaVersion: 1,
          id: "activity.cell-relation",
          version: "1",
          courseEditionId: "course.biology-7a",
          conceptIds: [
            "concept.cell-division"
          ],
          type: "relation",
          stem: "fixture relation: \u8FDE\u63A5\u7EC6\u80DE\u3001\u7EC6\u80DE\u7ED3\u6784\u4E0E\u7EC6\u80DE\u5206\u88C2\u3002",
          sourceRefs: [
            "source.p19"
          ],
          renderSpec: null,
          answerSchema: {
            kind: "relation",
            pairs: [
              {
                fromId: "concept.cell",
                toId: "concept.cell-structure"
              },
              {
                fromId: "concept.cell-structure",
                toId: "concept.cell-division"
              }
            ]
          },
          rubricId: "rubric.cell",
          rubricVersion: "1",
          answerDisclosurePolicy: "after_independent_attempt"
        },
        {
          schemaVersion: 1,
          id: "activity.cell-choice",
          version: "1",
          courseEditionId: "course.biology-7a",
          conceptIds: [
            "concept.cell"
          ],
          type: "choice",
          stem: "fixture choice: \u4E0B\u5217\u54EA\u4E00\u9879\u662F\u7EC6\u80DE\u7684\u57FA\u672C\u7ED3\u6784\uFF1F",
          sourceRefs: [
            "source.p18"
          ],
          renderSpec: null,
          answerSchema: {
            kind: "choice",
            selection: "single",
            options: [
              {
                id: "option.a",
                label: "\u7EC6\u80DE\u6838"
              },
              {
                id: "option.b",
                label: "\u4E66\u672C"
              }
            ],
            correctOptionIds: null
          },
          rubricId: "rubric.cell",
          rubricVersion: "1",
          answerDisclosurePolicy: "after_independent_attempt"
        }
      ],
      rubrics: [
        {
          schemaVersion: 1,
          id: "rubric.cell",
          version: "1",
          courseEditionId: "course.biology-7a",
          conceptIds: [
            "concept.cell",
            "concept.cell-structure",
            "concept.cell-division"
          ],
          criteria: [
            {
              criterionId: "criterion.cell.identify",
              description: "\u80FD\u8BF4\u660E\u7EC6\u80DE\u662F\u751F\u7269\u4F53\u7ED3\u6784\u548C\u529F\u80FD\u7684\u57FA\u672C\u5355\u4F4D",
              acceptableEvidence: [
                "\u7528\u81EA\u5DF1\u7684\u8BDD\u89E3\u91CA\u7EC6\u80DE\u7684\u4F5C\u7528"
              ],
              commonMisconceptions: [
                "\u628A\u6240\u6709\u7EC6\u80DE\u90FD\u5F53\u6210\u540C\u6837\u5927\u5C0F"
              ],
              counterExamples: [
                "\u8BA4\u4E3A\u7EC6\u80DE\u4E0D\u662F\u751F\u7269\u4F53\u7684\u7EC4\u6210\u90E8\u5206"
              ],
              transferItems: [
                "\u4E3E\u4F8B\u8BF4\u660E\u4E0D\u540C\u7EC6\u80DE\u5F62\u6001\u4E0D\u540C"
              ],
              feedbackSourceRefs: [
                "source.p18"
              ]
            }
          ],
          reviewState: "published"
        }
      ],
      coverageManifest: {
        schemaVersion: 1,
        courseEditionId: "course.biology-7a",
        generatedAt: "2026-10-01T00:00:00Z",
        targetTocNodeIds: [
          "toc.ch1.s1",
          "toc.ch1.s2",
          "toc.ch2.s1"
        ],
        sections: [
          {
            tocNodeId: "toc.ch1.s1",
            sourceRefs: [
              "source.p18"
            ],
            conceptIds: [
              "concept.cell"
            ],
            status: "covered",
            notes: null
          },
          {
            tocNodeId: "toc.ch1.s2",
            sourceRefs: [
              "source.p19"
            ],
            conceptIds: [
              "concept.cell-division"
            ],
            status: "partial",
            notes: "fixture partial coverage"
          },
          {
            tocNodeId: "toc.ch2.s1",
            sourceRefs: [
              "source.p26"
            ],
            conceptIds: [
              "concept.cell",
              "concept.cell-structure"
            ],
            status: "blocked",
            notes: "fixture blocked section"
          }
        ],
        exclusions: [
          {
            item: "fixture textbook images",
            reason: "fixtures never include real textbook images or text",
            sourceRefs: []
          }
        ],
        totals: {
          targetSections: 3,
          coveredSections: 1,
          conceptCount: 3
        }
      },
      reviewLedger: [
        {
          schemaVersion: 1,
          id: "ledger.pack",
          entityKind: "content_pack",
          entityId: "pack.biology-7a",
          from: "curator_checked",
          to: "published",
          actorKind: "human_curator",
          actorLabel: "fixture reviewer (not a real expert)",
          checkedAt: "2026-10-02T09:00:00Z",
          scope: "fixture scope review",
          notes: null,
          evidenceRefs: []
        },
        {
          schemaVersion: 1,
          id: "ledger.concept.cell",
          entityKind: "concept",
          entityId: "concept.cell",
          from: "machine_checked",
          to: "published",
          actorKind: "human_curator",
          actorLabel: "fixture reviewer (not a real expert)",
          checkedAt: "2026-10-02T09:00:00Z",
          scope: "fixture concept review",
          notes: null,
          evidenceRefs: []
        },
        {
          schemaVersion: 1,
          id: "ledger.concept.structure",
          entityKind: "concept",
          entityId: "concept.cell-structure",
          from: "machine_checked",
          to: "published",
          actorKind: "human_curator",
          actorLabel: "fixture reviewer (not a real expert)",
          checkedAt: "2026-10-02T09:00:00Z",
          scope: "fixture concept review",
          notes: null,
          evidenceRefs: []
        },
        {
          schemaVersion: 1,
          id: "ledger.concept.division",
          entityKind: "concept",
          entityId: "concept.cell-division",
          from: "machine_checked",
          to: "published",
          actorKind: "human_curator",
          actorLabel: "fixture reviewer (not a real expert)",
          checkedAt: "2026-10-02T09:00:00Z",
          scope: "fixture concept review",
          notes: null,
          evidenceRefs: []
        },
        {
          schemaVersion: 1,
          id: "ledger.rubric.cell",
          entityKind: "rubric",
          entityId: "rubric.cell",
          from: "machine_checked",
          to: "published",
          actorKind: "human_curator",
          actorLabel: "fixture reviewer (not a real expert)",
          checkedAt: "2026-10-02T09:00:00Z",
          scope: "fixture rubric review",
          notes: null,
          evidenceRefs: []
        }
      ]
    };
    
    // education/packages/domain/fixtures/progress/reviewed-and-due.json
    var reviewed_and_due_default = {
      schemaVersion: 1,
      learnerId: "learner.local.default",
      courseEditionId: "course.biology-7a",
      packVersion: "1.0.0",
      conceptId: "concept.cell",
      learning: {
        state: "completed",
        startedAt: "2026-10-29T08:00:00Z",
        lastCompletedAt: "2026-10-29T08:10:00Z"
      },
      understanding: {
        state: "supported",
        assessmentId: "assessment.cell.supported",
        updatedAt: "2026-10-29T08:20:00Z",
        validity: "current"
      },
      review: {
        lastCompletedAt: "2026-10-27T09:00:00Z",
        dueAt: "2026-10-28T09:00:00Z",
        activeSessionId: null,
        latestOutcome: "developing",
        policyVersion: "review-policy-v1"
      },
      lastPosition: {
        sessionId: "session.cell.1",
        activityId: "activity.cell-recall",
        cursor: "step-1",
        updatedAt: "2026-10-29T08:00:00Z"
      },
      revision: 3
    };
    
    // education/packages/domain/fixtures/progress/learned-needs-support.json
    var learned_needs_support_default = {
      schemaVersion: 1,
      learnerId: "learner.local.default",
      courseEditionId: "course.biology-7a",
      packVersion: "1.0.0",
      conceptId: "concept.cell",
      learning: {
        state: "completed",
        startedAt: "2026-10-29T08:00:00Z",
        lastCompletedAt: "2026-10-29T08:10:00Z"
      },
      understanding: {
        state: "needs_support",
        assessmentId: "assessment.cell.needs-support",
        updatedAt: "2026-10-29T08:20:00Z",
        validity: "current"
      },
      review: {
        lastCompletedAt: "2026-10-27T09:00:00Z",
        dueAt: "2026-10-28T09:00:00Z",
        activeSessionId: null,
        latestOutcome: "developing",
        policyVersion: "review-policy-v1"
      },
      lastPosition: {
        sessionId: "session.cell.1",
        activityId: "activity.cell-recall",
        cursor: "step-1",
        updatedAt: "2026-10-29T08:00:00Z"
      },
      revision: 3
    };
    
    // education/packages/domain/fixtures/progress/no-evidence.json
    var no_evidence_default = {
      schemaVersion: 1,
      learnerId: "learner.local.default",
      courseEditionId: "course.biology-7a",
      packVersion: "1.0.0",
      conceptId: "concept.cell",
      learning: {
        state: "not_started",
        startedAt: null,
        lastCompletedAt: null
      },
      understanding: {
        state: "unassessed",
        assessmentId: null,
        updatedAt: null,
        validity: "current"
      },
      review: {
        lastCompletedAt: null,
        dueAt: null,
        activeSessionId: null,
        latestOutcome: null,
        policyVersion: "review-policy-v1"
      },
      lastPosition: {
        sessionId: null,
        activityId: null,
        cursor: null,
        updatedAt: null
      },
      revision: 0
    };
    
    // education/packages/domain/fixtures/self-reports/cell.json
    var cell_default = {
      schemaVersion: 1,
      id: "self-report.cell.1",
      learnerId: "learner.local.default",
      courseEditionId: "course.biology-7a",
      packVersion: "1.0.0",
      conceptId: "concept.cell",
      claimedState: "can_explain",
      createdAt: "2026-10-29T09:00:00Z"
    };
    
    // education/client/shell/src/client-entry.ts
    var EDUCATION_ROOT_SLOT = { name: "root", locale: "common" };
    function registerEducationRoot(slots, host, options) {
      let controller = null;
      const occupant = host.createRootOccupant(async (container) => {
        const mounted = mountEducationShell(container, options);
        controller = mounted;
        await mounted.ready;
        return mounted;
      });
      slots.register(EDUCATION_ROOT_SLOT, occupant);
      return {
        controller: () => controller,
        async dispose() {
          if (controller !== null) await controller.unmount();
          controller = null;
        }
      };
    }
    
    // education/client/library/src/labels.ts
    var MATERIAL_STATE_LABELS = {
      baseline: "\u672C\u671F\u5339\u914D\u57FA\u51C6",
      candidate: "\u5F85\u6838\u5B9E\u5019\u9009",
      unavailable: "\u4E0D\u53EF\u7528\u6750\u6599"
    };
    var MATERIAL_STATE_TONES = {
      baseline: "positive",
      candidate: "attention",
      unavailable: "danger"
    };
    var MATERIAL_STATE_NOTES = {
      baseline: "\u5DF2\u901A\u8FC7\u672C\u671F\u57FA\u51C6\u5339\u914D\uFF1B\u4ECD\u6309\u5185\u5BB9\u5305\u8303\u56F4\u663E\u793A\uFF0C\u90E8\u5206\u5185\u5BB9\u4E0D\u7B49\u4E8E\u5168\u518C\u5C31\u7EEA\u3002",
      candidate: "\u5019\u9009\u5185\u5BB9\u672A\u6838\u5B9E\uFF0C\u4E0D\u80FD\u4F5C\u4E3A\u57FA\u51C6\uFF0C\u4E5F\u4E0D\u80FD\u7528\u4E8E\u5F3A\u638C\u63E1\u7ED3\u8BBA\u3002",
      unavailable: "\u6750\u6599\u4E0D\u53EF\u7528\uFF1B\u5DF2\u4FDD\u5B58\u7684\u5176\u4ED6\u6559\u6750\u548C\u4E2A\u4EBA\u8BB0\u5F55\u4E0D\u53D7\u5F71\u54CD\u3002"
    };
    var EDITION_VERIFICATION_LABELS = {
      verified: "\u7248\u672C\u5DF2\u6838\u5B9E",
      machine_matched: "\u673A\u5668\u5339\u914D",
      unverified: "\u7248\u672C\u5F85\u6838\u5B9E",
      rejected: "\u7248\u672C\u88AB\u62D2\u7EDD"
    };
    var REVIEW_STATE_LABELS = {
      candidate: "\u5019\u9009\uFF08\u672A\u6838\u5B9E\uFF09",
      machine_checked: "\u673A\u5668\u68C0\u67E5\uFF08\u975E\u4E13\u5BB6\uFF09",
      curator_checked: "\u4EBA\u5DE5\u5BA1\u6821",
      published: "\u5DF2\u53D1\u5E03",
      rejected: "\u5DF2\u62D2\u7EDD"
    };
    var TRUST_MODE_LABELS2 = {
      published: "\u6B63\u5F0F\u5185\u5BB9",
      candidate: "\u5019\u9009\u8BD5\u7528\uFF08\u672A\u6838\u5B9E\uFF09"
    };
    var SCOPE_LABELS = {
      partial: "\u90E8\u5206\u5185\u5BB9\uFF08\u672A\u8FBE\u5168\u518C\uFF09",
      full_volume: "\u5168\u518C\u8303\u56F4"
    };
    var COVERAGE_LABELS = {
      partial: "\u8986\u76D6\u672A\u5B8C\u6210",
      complete: "\u8986\u76D6\u5B8C\u6574"
    };
    var SOURCE_VERIFICATION_LABELS = {
      unverified: "\u6765\u6E90\u5F85\u6838\u5B9E",
      machine_matched: "\u6765\u6E90\u673A\u5668\u5339\u914D",
      human_checked: "\u6765\u6E90\u4EBA\u5DE5\u6838\u5BF9",
      rejected: "\u6765\u6E90\u88AB\u62D2\u7EDD"
    };
    var STAGE_LABELS = {
      accepted: "\u63A5\u53D7\u4EFB\u52A1",
      identify: "\u8BC6\u522B\u6587\u4EF6",
      extract: "\u63D0\u53D6\u5185\u5BB9",
      structure: "\u6574\u7406\u7ED3\u6784",
      concepts: "\u751F\u6210\u6982\u5FF5\u5019\u9009",
      validate: "\u68C0\u67E5\u5185\u5BB9",
      await_review: "\u7B49\u5F85\u5BA1\u6821",
      ready: "\u6750\u6599\u5C31\u7EEA"
    };
    var STAGE_ORDER = [
      "accepted",
      "identify",
      "extract",
      "structure",
      "concepts",
      "validate",
      "await_review",
      "ready"
    ];
    var STATUS_LABELS = {
      queued: "\u6392\u961F\u4E2D",
      running: "\u8FDB\u884C\u4E2D",
      paused: "\u5DF2\u6682\u505C",
      failed: "\u5931\u8D25",
      cancelled: "\u5DF2\u53D6\u6D88",
      completed: "\u5DF2\u5B8C\u6210"
    };
    var STATUS_TONES = {
      queued: "neutral",
      running: "progress",
      paused: "attention",
      failed: "danger",
      cancelled: "neutral",
      completed: "positive"
    };
    var BLOCK_TYPE_LABELS = {
      heading: "\u6807\u9898",
      paragraph: "\u6BB5\u843D",
      caption: "\u56FE\u6CE8",
      table: "\u8868\u683C",
      list: "\u5217\u8868"
    };
    var IMPORT_ERROR_COPY = {
      PDF_CORRUPT: {
        title: "PDF \u6587\u4EF6\u635F\u574F",
        detail: "\u6587\u4EF6\u7ED3\u6784\u6216\u4EA4\u53C9\u5F15\u7528\u65E0\u6CD5\u8BFB\u53D6\uFF0C\u6CA1\u6709\u53D1\u5E03\u4E0D\u5B8C\u6574\u7684\u9875\u9762\u3002",
        next: "\u91CD\u65B0\u9009\u62E9\u6587\u4EF6\u6216\u4ECE\u5907\u4EFD\u6062\u590D\uFF1B\u5DF2\u5B8C\u6210\u7684\u672C\u5730\u6B65\u9AA4\u4F1A\u4FDD\u7559\u3002"
      },
      PDF_ENCRYPTED: {
        title: "PDF \u53D7\u5BC6\u7801\u4FDD\u62A4",
        detail: "\u5F53\u524D\u4E0D\u80FD\u8BFB\u53D6\u53D7\u52A0\u5BC6\u4FDD\u62A4\u7684\u6559\u6750\u6587\u4EF6\u3002",
        next: "\u8BF7\u89E3\u9664\u6587\u4EF6\u4FDD\u62A4\u6216\u6362\u7528\u672A\u52A0\u5BC6\u7684 PDF \u540E\u91CD\u8BD5\u3002"
      },
      PDF_NO_PAGES: {
        title: "\u6CA1\u6709\u53EF\u5BFC\u5165\u7684\u9875\u9762",
        detail: "PDF \u6CA1\u6709\u8BFB\u5230\u6709\u6548\u9875\uFF0C\u4E0D\u80FD\u751F\u6210\u7A7A\u58F3\u6559\u6750\u3002",
        next: "\u786E\u8BA4\u6587\u4EF6\u5B8C\u6574\u540E\u91CD\u65B0\u9009\u62E9\uFF1B\u4E0D\u4F1A\u81EA\u52A8\u521B\u5EFA\u7A7A\u6559\u6750\u3002"
      },
      PDF_READ_FAILED: {
        title: "\u8BFB\u53D6 PDF \u5931\u8D25",
        detail: "\u6587\u4EF6\u53EF\u80FD\u88AB\u5360\u7528\u3001\u635F\u574F\u6216\u6743\u9650\u4E0D\u8DB3\u3002",
        next: "\u5173\u95ED\u5360\u7528\u7A0B\u5E8F\u5E76\u786E\u8BA4\u6587\u4EF6\u53EF\u8BFB\uFF0C\u7136\u540E\u91CD\u8BD5\u3002"
      },
      TEXT_LAYER_UNAVAILABLE: {
        title: "\u6CA1\u6709\u53EF\u7528\u7684\u6587\u672C\u5C42",
        detail: "\u8BE5 PDF \u53EF\u80FD\u9700\u8981\u9010\u9875 OCR\uFF1B\u8FD9\u4E0D\u662F\u5B66\u751F\u4F5C\u7B54\u9519\u8BEF\u3002",
        next: "\u82E5\u672C\u673A OCR \u7EC4\u4EF6\u53EF\u7528\uFF0C\u5C06\u7EE7\u7EED\u626B\u63CF\u8BC6\u522B\uFF1B\u5426\u5219\u8BF7\u67E5\u770B\u6750\u6599\u8BF4\u660E\u3002"
      },
      OCR_ENGINE_UNAVAILABLE: {
        title: "\u672C\u673A OCR \u7EC4\u4EF6\u4E0D\u53EF\u7528",
        detail: "\u626B\u63CF\u9875\u9700\u8981 Windows \u81EA\u5E26\u7684 OCR \u7EC4\u4EF6\u3002",
        next: "\u5728\u7CFB\u7EDF\u7EC4\u4EF6\u4E2D\u542F\u7528 OCR \u540E\u91CD\u8BD5\uFF1B\u5DF2\u5B8C\u6210\u6587\u672C\u4E0D\u4F1A\u4E22\u5931\u3002"
      },
      OCR_LANGUAGE_UNAVAILABLE: {
        title: "\u7F3A\u5C11\u4E2D\u6587 OCR \u8BED\u8A00\u5305",
        detail: "\u672C\u673A OCR \u7EC4\u4EF6\u5B58\u5728\uFF0C\u4F46\u6CA1\u6709\u4E2D\u6587\u8BC6\u522B\u8BED\u8A00\u5305\u3002",
        next: "\u5728 Windows \u8BED\u8A00\u8BBE\u7F6E\u4E2D\u5B89\u88C5\u4E2D\u6587 OCR \u8BED\u8A00\u5305\u540E\u91CD\u8BD5\uFF1B\u5DF2\u5B8C\u6210\u9875\u4F1A\u4FDD\u7559\u3002"
      },
      PAGE_RENDER_FAILED: {
        title: "\u9875\u9762\u6E32\u67D3\u5931\u8D25",
        detail: "\u4E2A\u522B\u9875\u9762\u6CA1\u6709\u6210\u529F\u8F6C\u6210\u53EF\u8BC6\u522B\u56FE\u50CF\u3002",
        next: "\u91CD\u8BD5\u8BE5\u9875\uFF1B\u5176\u4ED6\u5DF2\u5B8C\u6210\u9875\u548C\u6765\u6E90\u4FE1\u606F\u4F1A\u4FDD\u7559\u3002"
      },
      PAGE_OCR_FAILED: {
        title: "\u5355\u9875\u8BC6\u522B\u5931\u8D25",
        detail: "\u8FD9\u4E00\u9875\u6CA1\u6709\u6210\u529F\u8BC6\u522B\uFF1B\u6CA1\u6709\u7F16\u9020\u9875\u9762\u6587\u5B57\u3002",
        next: "\u91CD\u8BD5\u8BE5\u9875\uFF0C\u6216\u7A0D\u540E\u91CD\u65B0\u5BFC\u5165\uFF1B\u5DF2\u5B8C\u6210\u7684\u9875\u9762\u4E0D\u4F1A\u91CD\u590D\u3002"
      },
      JOB_NOT_FOUND: {
        title: "\u627E\u4E0D\u5230\u5BFC\u5165\u4EFB\u52A1",
        detail: "\u4EFB\u52A1\u53EF\u80FD\u5DF2\u88AB\u6E05\u7406\u6216\u4E0D\u5C5E\u4E8E\u5F53\u524D\u6559\u6750\u3002",
        next: "\u56DE\u5230\u6559\u6750\u5E93\u91CD\u65B0\u9009\u62E9\u6587\u4EF6\uFF1B\u4E0D\u4F1A\u81EA\u52A8\u6539\u7528\u5176\u4ED6\u6559\u6750\u3002"
      },
      JOB_CANCELLED: {
        title: "\u5BFC\u5165\u5DF2\u53D6\u6D88",
        detail: "\u53D6\u6D88\u540E\u5230\u8FBE\u7684\u7ED3\u679C\u4E0D\u4F1A\u5199\u5165\u6559\u6750\u6216\u8BB0\u5F55\u3002",
        next: "\u53EF\u4EE5\u6062\u590D\u540C\u4E00\u4EFB\u52A1\uFF0C\u6216\u91CD\u65B0\u9009\u62E9\u6587\u4EF6\u3002"
      },
      LATE_RESULT_REJECTED: {
        title: "\u8FDF\u5230\u7ED3\u679C\u5DF2\u4E22\u5F03",
        detail: "\u53D6\u6D88\u4E4B\u540E\u8FD4\u56DE\u7684\u9875\u9762\u7ED3\u679C\u6CA1\u6709\u53D1\u5E03\uFF0C\u5DF2\u4FDD\u5B58\u5185\u5BB9\u4E0D\u53D7\u5F71\u54CD\u3002",
        next: "\u5982\u9700\u7EE7\u7EED\uFF0C\u8BF7\u6062\u590D\u4EFB\u52A1\u6216\u91CD\u65B0\u5BFC\u5165\u3002"
      },
      CHECKPOINT_CORRUPT: {
        title: "\u5BFC\u5165\u8FDB\u5EA6\u8BB0\u5F55\u635F\u574F",
        detail: "\u672C\u673A\u4FDD\u5B58\u7684\u9636\u6BB5\u4FE1\u606F\u65E0\u6CD5\u5B89\u5168\u6062\u590D\u3002",
        next: "\u91CD\u65B0\u5F00\u59CB\u5BFC\u5165\uFF1B\u539F\u6559\u6750\u548C\u5176\u4ED6\u8BB0\u5F55\u4E0D\u53D7\u5F71\u54CD\u3002"
      },
      CHECKPOINT_VERSION_MISMATCH: {
        title: "\u5BFC\u5165\u8FDB\u5EA6\u7248\u672C\u4E0D\u5339\u914D",
        detail: "\u4E0A\u6B21\u4EFB\u52A1\u7531\u4E0D\u540C\u89E3\u6790\u5668\u7248\u672C\u4FDD\u5B58\uFF0C\u4E0D\u80FD\u7EE7\u7EED\u5957\u7528\u3002",
        next: "\u91CD\u65B0\u5F00\u59CB\u5BFC\u5165\uFF0C\u6216\u67E5\u770B\u5DF2\u5B8C\u6210\u6750\u6599\u7684\u8BF4\u660E\u3002"
      },
      CLOUD_EXTRACTION_PAUSED: {
        title: "\u5728\u7EBF\u6982\u5FF5\u62BD\u53D6\u6682\u7F13",
        detail: "\u672C\u5730\u89E3\u6790\u5DF2\u5B8C\u6210\uFF0C\u4F46\u5F53\u524D\u79BB\u7EBF\u6216\u672A\u914D\u7F6E\u6A21\u578B\u670D\u52A1\uFF1B\u6CA1\u6709\u4F2A\u88C5\u6210\u5BFC\u5165\u5B8C\u6210\u3002",
        next: "\u7F51\u7EDC/\u6A21\u578B\u6062\u590D\u540E\u53EF\u6062\u590D\u5BFC\u5165\uFF1B\u5DF2\u6709\u672C\u5730\u6750\u6599\u4ECD\u53EF\u9605\u8BFB\u3002"
      },
      CLOUD_AUTH_FAILED: {
        title: "\u6A21\u578B\u670D\u52A1\u6CA1\u6709\u5B8C\u6210\u6388\u6743",
        detail: "\u9700\u8981\u6709\u6548\u6A21\u578B\u670D\u52A1\u624D\u80FD\u7EE7\u7EED\u6982\u5FF5\u62BD\u53D6\uFF1B\u672C\u5730\u6B65\u9AA4\u5DF2\u4FDD\u7559\u3002",
        next: "\u5728\u8D26\u6237\u9875\u786E\u8BA4\u670D\u52A1\u72B6\u6001\u540E\u91CD\u8BD5\uFF0C\u4E0D\u4F1A\u8981\u6C42\u7C98\u8D34\u4ED6\u4EBA\u5BC6\u94A5\u3002"
      },
      CLOUD_RATE_LIMITED: {
        title: "\u6A21\u578B\u670D\u52A1\u8BF7\u6C42\u8FC7\u591A",
        detail: "\u672C\u6B21\u4E91\u7AEF\u6B65\u9AA4\u6CA1\u6709\u5B8C\u6210\uFF0C\u5DF2\u5B8C\u6210\u9875\u9762\u4ECD\u4FDD\u7559\u3002",
        next: "\u7A0D\u540E\u91CD\u8BD5\uFF1B\u4E0D\u4F1A\u91CD\u590D\u8BA1\u8D39\u6216\u91CD\u590D\u5EFA\u4E66\u3002"
      },
      STORAGE_FULL: {
        title: "\u78C1\u76D8\u7A7A\u95F4\u4E0D\u8DB3",
        detail: "\u5BFC\u5165\u4EA7\u7269\u6CA1\u6709\u53D1\u5E03\uFF0C\u672C\u673A\u5DF2\u6709\u8BB0\u5F55\u6CA1\u6709\u88AB\u5220\u9664\u3002",
        next: "\u6E05\u7406\u78C1\u76D8\u7A7A\u95F4\u540E\u91CD\u8BD5\uFF1B\u5DF2\u5B8C\u6210\u7684\u9636\u6BB5\u53EF\u6062\u590D\u3002"
      },
      STORAGE_WRITE_FAILED: {
        title: "\u5199\u5165\u672C\u673A\u5B58\u50A8\u5931\u8D25",
        detail: "\u9875\u9762\u6216\u8FDB\u5EA6\u6CA1\u6709\u4FDD\u5B58\u6210\u529F\uFF0C\u754C\u9762\u4E0D\u4F1A\u663E\u793A\u4E3A\u5DF2\u5B8C\u6210\u3002",
        next: "\u68C0\u67E5\u78C1\u76D8\u6743\u9650\u4E0E\u7A7A\u95F4\u540E\u91CD\u8BD5\uFF1B\u4E0D\u4F1A\u4F2A\u9020\u5DF2\u4FDD\u5B58\u3002"
      },
      ASSET_HANDLE_INVALID: {
        title: "\u6587\u4EF6\u53E5\u67C4\u65E0\u6548",
        detail: "\u53EA\u80FD\u4F7F\u7528\u5BBF\u4E3B\u63D0\u4F9B\u7684\u53D7\u7BA1\u6587\u4EF6\uFF0C\u4E0D\u80FD\u76F4\u63A5\u8BFB\u53D6\u4EFB\u610F\u8DEF\u5F84\u3002",
        next: "\u8BF7\u901A\u8FC7\u201C\u9009\u62E9\u672C\u5730 PDF\u201D\u91CD\u65B0\u63D0\u4F9B\u6587\u4EF6\u3002"
      },
      ASSET_PATH_OUTSIDE_ROOT: {
        title: "\u6587\u4EF6\u4E0D\u5728\u5141\u8BB8\u7684\u76EE\u5F55\u5185",
        detail: "\u4E3A\u4FDD\u62A4\u672C\u673A\u6587\u4EF6\uFF0C\u5BFC\u5165\u53EA\u63A5\u53D7\u5BBF\u4E3B\u7BA1\u7406\u7684\u6559\u6750\u6587\u4EF6\u3002",
        next: "\u91CD\u65B0\u9009\u62E9\u6559\u6750\u6587\u4EF6\uFF1B\u4E0D\u4F1A\u5C1D\u8BD5\u8BBF\u95EE\u5176\u4ED6\u8DEF\u5F84\u3002"
      },
      ASSET_NOT_FOUND: {
        title: "\u627E\u4E0D\u5230\u6240\u9009\u6587\u4EF6",
        detail: "\u6587\u4EF6\u53EF\u80FD\u88AB\u79FB\u52A8\u3001\u91CD\u547D\u540D\u6216\u5220\u9664\u3002",
        next: "\u91CD\u65B0\u9009\u62E9\u6587\u4EF6\uFF1B\u5DF2\u4FDD\u5B58\u7684\u4E2A\u4EBA\u8BB0\u5F55\u4E0D\u53D7\u5F71\u54CD\u3002"
      },
      ASSET_NOT_A_FILE: {
        title: "\u6240\u9009\u5BF9\u8C61\u4E0D\u662F\u6587\u4EF6",
        detail: "\u4E0D\u80FD\u628A\u6587\u4EF6\u5939\u6216\u5176\u4ED6\u5BF9\u8C61\u5F53\u4F5C\u6559\u6750\u5BFC\u5165\u3002",
        next: "\u91CD\u65B0\u9009\u62E9 PDF \u6587\u4EF6\u3002"
      },
      ASSET_HASH_MISMATCH: {
        title: "\u6587\u4EF6\u6307\u7EB9\u4E0D\u4E00\u81F4",
        detail: "\u6587\u4EF6\u5728\u9009\u62E9\u540E\u53D1\u751F\u4E86\u53D8\u5316\uFF0C\u672A\u6309\u539F\u6587\u4EF6\u5BFC\u5165\u3002",
        next: "\u91CD\u65B0\u9009\u62E9\u6587\u4EF6\u5E76\u786E\u8BA4\u6307\u7EB9\u540E\u518D\u8BD5\u3002"
      },
      ASSET_METADATA_MISMATCH: {
        title: "\u6587\u4EF6\u4FE1\u606F\u4E0D\u4E00\u81F4",
        detail: "\u586B\u5199\u7684\u9875\u6570\u6216\u5143\u6570\u636E\u4E0E\u5B9E\u9645\u6587\u4EF6\u4E0D\u4E00\u81F4\u3002",
        next: "\u68C0\u67E5\u5143\u6570\u636E\u6216\u91CD\u65B0\u9009\u62E9\u6587\u4EF6\uFF1B\u4E0D\u4F1A\u7528\u9519\u8BEF\u4FE1\u606F\u7ED1\u5B9A\u6559\u6750\u3002"
      },
      INPUT_MISSING: {
        title: "\u7F3A\u5C11\u5BFC\u5165\u6587\u4EF6",
        detail: "\u6CA1\u6709\u6536\u5230\u53D7\u7BA1\u6587\u4EF6\uFF0C\u4EFB\u52A1\u6CA1\u6709\u5F00\u59CB\u3002",
        next: "\u5148\u9009\u62E9\u672C\u5730 PDF\uFF0C\u518D\u786E\u8BA4\u5F00\u59CB\u5BFC\u5165\u3002"
      },
      UNSUPPORTED: {
        title: "\u5F53\u524D\u6587\u4EF6\u7C7B\u578B\u4E0D\u652F\u6301",
        detail: "\u672C\u671F\u5BFC\u5165\u53EA\u652F\u6301 PDF\uFF1B\u6CA1\u6709\u628A\u5176\u4ED6\u683C\u5F0F\u4F2A\u88C5\u6210\u6559\u6750\u3002",
        next: "\u9009\u62E9 PDF \u6587\u4EF6\uFF0C\u6216\u67E5\u770B\u5DF2\u6709\u672C\u5730\u6750\u6599\u3002"
      }
    };
    function describeImportError(code, retryable) {
      const safe = /^[A-Za-z0-9_.-]{1,48}$/.test(code) ? code : "UNKNOWN";
      const copy = IMPORT_ERROR_COPY[safe];
      if (copy !== void 0) return { ...copy, code: safe, retryable };
      return {
        code: safe,
        retryable,
        title: "\u5BFC\u5165\u6CA1\u6709\u5B8C\u6210",
        detail: "\u53D1\u751F\u4E86\u672A\u5F52\u7C7B\u7684\u5BFC\u5165\u9519\u8BEF\uFF1B\u754C\u9762\u4E0D\u4F1A\u628A\u672A\u77E5\u7ED3\u679C\u6807\u6210\u5B8C\u6210\u3002",
        next: "\u53EF\u4EE5\u91CD\u8BD5\u6216\u91CD\u65B0\u9009\u62E9\u6587\u4EF6\uFF1B\u5DF2\u6709\u672C\u5730\u6750\u6599\u4ECD\u53EF\u9605\u8BFB\u3002"
      };
    }
    function formatFingerprint(sha256) {
      if (sha256.length <= 16) return sha256;
      return `${sha256.slice(0, 12)}\u2026${sha256.slice(-4)}`;
    }
    function formatBytes(bytes) {
      if (!Number.isFinite(bytes) || bytes < 0) return "\u672A\u77E5\u5927\u5C0F";
      if (bytes < 1024) return `${bytes} B`;
      if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
      return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    }
    function formatLocalTime(timestamp) {
      if (timestamp === null) return "\u2014";
      const date = new Date(timestamp);
      if (Number.isNaN(date.getTime())) return timestamp;
      try {
        return new Intl.DateTimeFormat("zh-CN", {
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
          hour: "2-digit",
          minute: "2-digit"
        }).format(date);
      } catch {
        return timestamp;
      }
    }
    function stageIndex(stage) {
      return STAGE_ORDER.indexOf(stage);
    }
    function stageStateLabel(stage, current, jobStatus) {
      const currentIndex = stageIndex(current);
      const index = stageIndex(stage);
      if (stage === current) {
        if (jobStatus === "failed") return "\u505C\u5728\u5F53\u524D\u9636\u6BB5";
        if (jobStatus === "cancelled") return "\u5DF2\u53D6\u6D88";
        if (stage === "await_review") return "\u5F85\u5BA1\u6838\uFF08\u4E0D\u662F\u5B8C\u6210\uFF09";
        if (stage === "ready") return "\u5DF2\u5B8C\u6210";
        return "\u8FDB\u884C\u4E2D";
      }
      if (index < currentIndex) return "\u5DF2\u901A\u8FC7";
      return "\u672A\u5F00\u59CB";
    }
    
    // education/client/library/src/source-reader.ts
    var SourceReader = class {
      options;
      modal = null;
      content = null;
      trigger = null;
      items = [];
      index = 0;
      loadToken = 0;
      constructor(options) {
        this.options = options;
      }
      open(items, index, trigger, parent) {
        this.items = items;
        this.index = Math.max(0, Math.min(index, items.length - 1));
        this.trigger = trigger;
        const content = h("div", {
          class: "edu-lib-reader",
          "data-testid": "source-reader",
          tabindex: -1
        });
        this.content = content;
        this.modal = new Modal("\u6765\u6E90\u9605\u8BFB", content, "\u5173\u95ED\u6765\u6E90");
        this.modal.element.addEventListener("keydown", (event) => this.onKeydown(event));
        this.modal.open(trigger, parent);
        void this.load();
      }
      close() {
        this.loadToken += 1;
        this.modal?.close();
        this.modal = null;
        this.content = null;
        this.trigger = null;
      }
      onKeydown(event) {
        if (this.content === null) return;
        if (event.key === "ArrowDown" || event.key === "ArrowRight") {
          if (this.index >= this.items.length - 1) return;
          event.preventDefault();
          this.index += 1;
          void this.load();
        } else if (event.key === "ArrowUp" || event.key === "ArrowLeft") {
          if (this.index <= 0) return;
          event.preventDefault();
          this.index -= 1;
          void this.load();
        }
      }
      async load() {
        const content = this.content;
        if (content === null) return;
        const item = this.items[this.index];
        if (item === void 0) {
          clear(content);
          content.append(
            h("p", { class: "edu-state__body" }, "\u6CA1\u6709\u53EF\u6253\u5F00\u7684\u6765\u6E90\u6761\u76EE\u3002"),
            h("div", { class: "edu-inline-actions" }, button("\u8FD4\u56DE\u6559\u6750\u5E93", () => this.close()))
          );
          return;
        }
        const token = ++this.loadToken;
        clear(content);
        content.append(h("p", { class: "edu-state__body", role: "status" }, "\u6B63\u5728\u6253\u5F00\u6765\u6E90\u2026"));
        const result = await this.options.dataSource.openSource(this.options.createRequest(), item.sourceRefId);
        if (token !== this.loadToken || this.content === null) return;
        clear(content);
        if (!result.ok) {
          content.append(
            h("h3", { class: "edu-card__title" }, "\u65E0\u6CD5\u5B9A\u4F4D\u6765\u6E90"),
            h(
              "p",
              { class: "edu-lib-status-line" },
              "\u6765\u6E90\u6587\u4EF6\u3001\u9875\u7801\u6216\u8D44\u4EA7\u4E0D\u53EF\u7528\uFF1B\u6CA1\u6709\u8DF3\u8F6C\u5230\u4EFB\u4F55\u9875\u9762\uFF0C\u4E5F\u4E0D\u4F1A\u7F16\u9020\u5F15\u7528\u4F4D\u7F6E\u3002"
            ),
            renderErrorBanner(result.error, {
              headingLevel: "h3",
              onBack: () => this.close(),
              backLabel: "\u8FD4\u56DE\u6559\u6750\u5E93"
            })
          );
          return;
        }
        this.renderSource(content, result.data);
        content.focus();
      }
      renderSource(content, source) {
        content.append(
          h(
            "div",
            { class: "edu-lib-reader-nav" },
            button("\u4E0A\u4E00\u5904", () => {
              if (this.index > 0) {
                this.index -= 1;
                void this.load();
              }
            }, { small: true, disabled: this.index <= 0 }),
            button("\u4E0B\u4E00\u5904", () => {
              if (this.index < this.items.length - 1) {
                this.index += 1;
                void this.load();
              }
            }, { small: true, disabled: this.index >= this.items.length - 1 }),
            h("span", { class: "edu-muted" }, `\u7B2C ${this.index + 1} / ${this.items.length} \u5904 \xB7 \u53EF\u7528 \u2191/\u2193 \u5207\u6362`)
          ),
          h(
            "p",
            { class: "edu-lib-status-line" },
            `${source.bookTitle} \xB7 ${source.editionLabel} \xB7 ${source.pageCount} \u9875`
          ),
          h(
            "div",
            { class: "edu-lib-page-info" },
            h(
              "div",
              { class: "edu-lib-page-info__box", "data-testid": "source-pdf-page" },
              h("p", { class: "edu-lib-page-info__label" }, "PDF \u9875\u5E8F\uFF081 \u57FA\uFF09"),
              h("p", { class: "edu-lib-page-info__value" }, `PDF \u7B2C ${source.sourceRef.pdfPage} \u9875`)
            ),
            h(
              "div",
              { class: "edu-lib-page-info__box", "data-testid": "source-printed-page" },
              h("p", { class: "edu-lib-page-info__label" }, "\u5370\u5237\u9875\u7801\uFF08\u8BFE\u672C\u9875\u811A/\u9875\u7709\u6807\u7B7E\uFF09"),
              h(
                "p",
                { class: "edu-lib-page-info__value" },
                source.sourceRef.printedPage === null ? "\u672A\u8BC6\u522B\uFF08\u4E0D\u63A8\u7B97\uFF09" : `\u8BFE\u672C\u7B2C ${source.sourceRef.printedPage} \u9875`
              )
            )
          ),
          h(
            "p",
            { class: "edu-lib-status-line" },
            "PDF \u9875\u5E8F\u4E0E\u5370\u5237\u9875\u7801\u662F\u4E0D\u540C\u5355\u4F4D\uFF0C\u4E0D\u80FD\u4E92\u76F8\u66FF\u4EE3\uFF1B\u672A\u8BC6\u522B\u65F6\u4E0D\u505A\u504F\u79FB\u731C\u6D4B\u3002"
          )
        );
        if (source.candidate) {
          content.append(statusChip("\u5019\u9009\u6765\u6E90\uFF08\u672A\u6838\u5B9E\uFF09", "attention"));
        }
        content.append(
          h(
            "div",
            { class: "edu-inline-actions" },
            statusChip(SOURCE_VERIFICATION_LABELS[source.sourceRef.verification.state], "neutral"),
            statusChip(`\u5BA1\u6821\uFF1A${REVIEW_STATE_LABELS[source.candidate ? "candidate" : source.block?.reviewState ?? source.figure?.reviewState ?? "candidate"]}`, "neutral"),
            h("span", { class: "edu-muted", "data-testid": "source-verification" }, `\u6765\u6E90\u6838\u5B9E\uFF1A${source.sourceRef.verification.notes ?? "\u65E0\u8BF4\u660E"}`)
          )
        );
        if (source.pageImage === null) {
          content.append(
            h(
              "p",
              { class: "edu-lib-status-line" },
              "\u672C\u6765\u6E90\u6CA1\u6709\u53D7\u63A7\u9875\u56FE\uFF1B\u53EA\u663E\u793A\u51C6\u786E\u9875\u7801\u4E0E\u51FA\u5904\uFF0C\u4E0D\u4F2A\u9020\u9875\u9762\u56FE\u50CF\u3002"
            )
          );
        } else {
          const image = source.pageImage;
          const page = h("div", {
            class: "edu-lib-page",
            role: "img",
            "aria-label": image.altText,
            "data-asset-id": image.assetId,
            "data-testid": "source-page-image"
          });
          page.append(
            h(
              "span",
              { class: "edu-lib-page__fixture" },
              `\u53D7\u63A7\u9875\u56FE\u4F4D\u7F6E \xB7 ${image.assetId}${image.fixtureOnly ? "\uFF08fixture \u793A\u610F\uFF0C\u4E0D\u542B\u771F\u5B9E\u9875\u9762\u56FE\u50CF\uFF09" : ""}`
            )
          );
          const region = h("span", {
            class: "edu-lib-region",
            "data-bbox": `${image.bbox.x},${image.bbox.y},${image.bbox.width},${image.bbox.height}`,
            "data-testid": "source-bbox"
          });
          region.style.left = `${image.bbox.x * 100}%`;
          region.style.top = `${image.bbox.y * 100}%`;
          region.style.width = `${image.bbox.width * 100}%`;
          region.style.height = `${image.bbox.height * 100}%`;
          region.append(h("span", { class: "edu-lib-region__label" }, "\u5F53\u524D\u533A\u57DF"));
          page.append(region);
          content.append(
            page,
            h(
              "p",
              { class: "edu-lib-status-line" },
              "\u533A\u57DF\u4F7F\u7528\u5F52\u4E00\u5316\u5750\u6807\uFF080\u20131\uFF09\uFF1B\u53EA\u63A5\u53D7\u5BBF\u4E3B\u53D7\u7BA1\u9875\u56FE\u53E5\u67C4\uFF0C\u4E0D\u4F7F\u7528\u672C\u673A\u8DEF\u5F84\u3002"
            )
          );
        }
        if (source.block !== null) content.append(this.renderBlock(source.block));
        if (source.figure !== null) content.append(this.renderFigure(source.figure));
        const actions = h("div", { class: "edu-inline-actions" });
        if (this.options.returnPath !== null && this.options.navigate !== null) {
          actions.append(
            button(
              "\u8FD4\u56DE\u539F\u6D3B\u52A8",
              () => {
                const path = this.options.returnPath;
                this.close();
                if (path !== null) this.options.navigate?.(path);
              },
              { small: true, tone: "primary" }
            )
          );
        }
        actions.append(button("\u5173\u95ED\u6765\u6E90", () => this.close(), { small: true }));
        content.append(
          h(
            "p",
            { class: "edu-muted" },
            "\u67E5\u770B\u6765\u6E90\u4E0D\u4F1A\u63D0\u4EA4\u4F5C\u7B54\u3001\u4E0D\u4F1A\u6539\u53D8\u7406\u89E3\u5224\u65AD\uFF1B\u5173\u95ED\u540E\u7126\u70B9\u8FD4\u56DE\u521A\u624D\u7684\u6765\u6E90\u6309\u94AE\u3002"
          ),
          actions
        );
      }
      renderBlock(block) {
        return h(
          "div",
          { class: "edu-lib-block", "data-block-id": block.id },
          h("p", { class: "edu-card__title" }, `${BLOCK_TYPE_LABELS[block.type]}\u6765\u6E90\u5757`),
          h(
            "p",
            { class: "edu-lib-block__text" },
            block.revisedText ?? block.originalText
          ),
          h(
            "p",
            { class: "edu-lib-status-line" },
            `\u63D0\u53D6\u65B9\u5F0F\uFF1A${block.extractionMethod === "ocr" ? "OCR" : block.extractionMethod === "text_layer" ? "\u6587\u672C\u5C42" : "\u4EBA\u5DE5"} \xB7 \u5BA1\u6821\uFF1A${REVIEW_STATE_LABELS[block.reviewState]}`
          )
        );
      }
      renderFigure(figure) {
        return h(
          "div",
          { class: "edu-lib-block", "data-figure-id": figure.id },
          h("p", { class: "edu-card__title" }, "\u56FE\u793A\u6765\u6E90"),
          h("p", { class: "edu-lib-block__text" }, figure.caption ?? "\u672A\u63D0\u4F9B\u56FE\u6CE8"),
          h(
            "p",
            { class: "edu-lib-status-line" },
            `\u7C7B\u578B\uFF1A${figure.type === "diagram" ? "\u793A\u610F\u56FE" : figure.type === "photo" ? "\u7167\u7247" : figure.type} \xB7 \u5F53\u524D\u8D44\u4EA7\uFF1A${figure.activeAssetId} \xB7 \u5BA1\u6821\uFF1A${REVIEW_STATE_LABELS[figure.reviewState]}`
          )
        );
      }
    };
    
    // education/client/library/src/components.ts
    function fixtureNotice(text) {
      return h(
        "div",
        {
          class: "edu-notice edu-notice--warning",
          role: "status",
          "data-testid": "library-fixture-notice",
          "data-edu-fixture": "true"
        },
        h("p", { class: "edu-notice__title" }, "\u6F14\u793A\u6570\u636E\uFF08fixture\uFF09"),
        h("p", { class: "edu-notice__body" }, text),
        h(
          "p",
          { class: "edu-notice__body" },
          "\u4E0D\u5F97\u628A\u8FD9\u91CC\u7684\u6559\u6750\u3001\u9875\u7801\u3001\u5BFC\u5165\u8FDB\u5EA6\u6216\u6765\u6E90\u5F53\u4F5C\u771F\u5B9E\u6750\u6599/\u771F\u5B9E API \u7ED3\u679C\uFF1B\u771F\u5B9E\u6750\u6599\u4E0E\u670D\u52A1\u63A5\u5165\u540E\u4F1A\u66FF\u6362\u4E3A\u6B63\u5F0F\u6570\u636E\u3002"
        )
      );
    }
    function bookCard(book, handlers) {
      const tone = MATERIAL_STATE_TONES[book.materialState];
      const card = h("article", {
        class: "edu-lib-book",
        "data-state": book.materialState,
        "data-testid": `library-book-${book.id}`,
        "data-book-id": book.id
      });
      card.append(
        h(
          "div",
          { class: "edu-lib-book__head" },
          h("h3", { class: "edu-lib-book__title" }, book.title),
          h(
            "div",
            { class: "edu-inline-actions" },
            statusChip(MATERIAL_STATE_LABELS[book.materialState], tone),
            book.isCurrent ? statusChip("\u5F53\u524D\u6559\u6750", "positive") : null
          )
        ),
        h(
          "p",
          { class: "edu-lib-book__meta" },
          `${book.publisher} \xB7 ${book.editionLabel} \xB7 ${book.grade}\u5E74\u7EA7${book.term === 1 ? "\u4E0A\u518C" : "\u4E0B\u518C"}`
        ),
        h(
          "div",
          { class: "edu-inline-actions" },
          statusChip(REVIEW_STATE_LABELS[book.reviewState], reviewTone(book.reviewState)),
          statusChip(TRUST_MODE_LABELS2[book.trustMode], book.trustMode === "candidate" ? "attention" : "neutral"),
          statusChip(EDITION_VERIFICATION_LABELS[book.editionVerification], book.editionVerification === "verified" ? "positive" : "attention")
        ),
        h(
          "dl",
          { class: "edu-kv" },
          h("dt", {}, "\u9875\u6570"),
          h("dd", {}, book.pageCount > 0 ? `${book.pageCount} \u9875` : "\u2014"),
          h("dt", {}, "\u6587\u4EF6\u6307\u7EB9"),
          h("dd", { class: "edu-lib-inline-code" }, formatFingerprint(book.sha256)),
          h("dt", {}, "\u5185\u5BB9\u8303\u56F4"),
          h("dd", {}, `${SCOPE_LABELS[book.scope]} \xB7 ${COVERAGE_LABELS[book.coverageStatus]}`),
          h("dt", {}, "\u6750\u6599\u72B6\u6001"),
          h("dd", {}, MATERIAL_STATE_NOTES[book.materialState])
        )
      );
      if (book.materialState === "candidate") {
        card.append(
          h(
            "p",
            { class: "edu-warning-text", "data-testid": `candidate-warning-${book.id}` },
            "\u5019\u9009 \xB7 \u672A\u6838\u5B9E \xB7 \u4E0D\u53EF\u4F5C\u4E3A\u57FA\u51C6\u6216\u5F3A\u638C\u63E1\u7ED3\u8BBA\u3002\u663E\u5F0F\u8BD5\u7528\u540E\u4ECD\u4FDD\u7559\u672A\u6838\u5B9E\u6807\u8BC6\u3002"
          )
        );
      }
      if (book.materialState === "unavailable") {
        card.append(
          h(
            "p",
            { class: "edu-danger-text", "data-testid": `unavailable-reason-${book.id}` },
            `\u4E0D\u53EF\u7528\u539F\u56E0\uFF1A${book.unavailableReason ?? "\u6750\u6599\u4E0D\u53EF\u7528"}`
          )
        );
      }
      const actions = h("div", { class: "edu-lib-book__actions" });
      if (book.materialState === "baseline") {
        if (!book.isCurrent && handlers.onSetCurrent !== void 0) {
          actions.append(button("\u8BBE\u4E3A\u5F53\u524D\u6559\u6750", () => handlers.onSetCurrent?.(book), { small: true }));
        }
        actions.append(button("\u67E5\u770B\u6765\u6E90", () => handlers.onViewSources(book), { small: true }));
      } else if (book.materialState === "candidate") {
        if (handlers.candidateTrial) {
          actions.append(button("\u9000\u51FA\u5019\u9009\u8BD5\u7528", handlers.onExitTrial, { small: true, tone: "danger-ghost" }));
          actions.append(button("\u67E5\u770B\u5019\u9009\u6765\u6E90", () => handlers.onViewSources(book), { small: true }));
        } else {
          const trialButton = button(
            "\u663E\u5F0F\u8BD5\u7528\u5019\u9009\uFF08\u672A\u6838\u5B9E\uFF09",
            () => handlers.onTrialCandidate(book, trialButton),
            { small: true, tone: "primary", dataAction: "trial-candidate" }
          );
          actions.append(trialButton);
        }
      } else {
        actions.append(button("\u91CD\u65B0\u9009\u62E9\u6587\u4EF6", handlers.onChooseFile, { small: true, tone: "primary" }));
        actions.append(button("\u67E5\u770B\u8BB0\u5F55", () => handlers.onViewSources(book), { small: true }));
      }
      card.append(actions);
      return card;
    }
    function candidateBanner(onExit) {
      return h(
        "div",
        { class: "edu-lib-candidate-banner", role: "status", "data-testid": "library-candidate-banner" },
        h("span", {}, "\u5F53\u524D\u4E3A\u5019\u9009\u8BD5\u7528\uFF08\u672A\u6838\u5B9E\uFF09 \xB7 \u5F3A\u7ED3\u8BBA\u5DF2\u7981\u7528 \xB7 \u4E0D\u80FD\u89C6\u4E3A\u57FA\u51C6"),
        button("\u9000\u51FA\u5019\u9009\u8BD5\u7528", onExit, { small: true, tone: "default" })
      );
    }
    function selectedFileCard(file) {
      return h(
        "div",
        { class: "edu-lib-file", "data-testid": "library-selected-file" },
        h("p", { class: "edu-card__title" }, `\u5DF2\u9009\u62E9\uFF1A${file.fileName}`),
        h(
          "p",
          { class: "edu-card__meta" },
          `\u5927\u5C0F ${formatBytes(file.sizeBytes)} \xB7 \u68C0\u6D4B\u9875\u6570 ${file.detectedPageCount} \xB7 \u6307\u7EB9 ${formatFingerprint(file.handle.sha256)}`
        ),
        h(
          "p",
          { class: "edu-card__meta" },
          "\u9009\u62E9\u672C\u8EAB\u4E0D\u4F1A\u4E0A\u4F20\u6574\u672C\uFF1B\u786E\u8BA4\u5143\u6570\u636E\u540E\u624D\u5F00\u59CB\u5BFC\u5165\u3002"
        )
      );
    }
    function sourceListItem(item, onOpen) {
      const trigger = button(
        "\u6253\u5F00\u6765\u6E90",
        () => onOpen(item, trigger),
        { small: true, dataAction: "open-source" }
      );
      return h(
        "li",
        { class: "edu-lib-source-item", "data-source-id": item.sourceRefId },
        h(
          "span",
          { class: "edu-lib-source-item__label" },
          item.label,
          h(
            "span",
            { class: "edu-muted" },
            ` \xB7 PDF \u7B2C ${item.pdfPage} \u9875 \xB7 ${item.printedPage === null ? "\u5370\u5237\u9875\u672A\u8BC6\u522B" : `\u8BFE\u672C\u7B2C ${item.printedPage} \u9875`} \xB7 ${SOURCE_VERIFICATION_LABELS[item.verification]}`
          )
        ),
        h(
          "span",
          { class: "edu-inline-actions" },
          item.candidate ? statusChip("\u5019\u9009\u6765\u6E90\uFF08\u672A\u6838\u5B9E\uFF09", "attention") : statusChip(REVIEW_STATE_LABELS[item.reviewState], reviewTone(item.reviewState)),
          trigger
        )
      );
    }
    function reviewTone(reviewState) {
      if (reviewState === "published" || reviewState === "curator_checked") return "positive";
      if (reviewState === "candidate") return "attention";
      if (reviewState === "rejected") return "danger";
      return "progress";
    }
    
    // education/client/library/src/job-model.ts
    function reduceJobUpdate(current, next) {
      if (current === null) return next;
      if (current.id !== next.id) return current;
      if (current.status === "cancelled" && (next.status !== "cancelled" || next.stage !== current.stage)) {
        return current;
      }
      if (current.status === "completed" && next.status !== "completed") return current;
      const result = applyImportProgress(current, {
        stage: next.stage,
        status: next.status,
        completedUnits: next.completedUnits,
        totalUnits: next.totalUnits,
        checkpoint: next.checkpoint,
        error: next.error,
        retryable: next.retryable,
        updatedAt: next.updatedAt
      });
      return result.ok ? result.value : current;
    }
    function canCancel(job) {
      return job.status === "running" || job.status === "paused" || job.status === "queued";
    }
    function canResume(job) {
      return job.status === "paused" || job.status === "cancelled" || job.status === "failed";
    }
    function canRetry(job) {
      return job.status === "failed" && job.retryable;
    }
    
    // education/client/library/src/controller.ts
    var LibraryController = class {
      options;
      state = {
        books: [],
        booksLoading: false,
        booksError: null,
        offline: false,
        selectedBookId: null,
        sources: [],
        sourcesLoading: false,
        sourcesError: null,
        selectedFile: null,
        metadataDraft: null,
        job: null,
        match: null,
        reused: false,
        importError: null,
        jobBusy: false,
        candidateTrialBookId: null,
        actionNotice: ""
      };
      renderers = /* @__PURE__ */ new Set();
      contentContainer = null;
      importContainer = null;
      navigate = null;
      loaded = false;
      loadingPromise = null;
      sourcesToken = 0;
      unsubscribeJob = null;
      reader = null;
      active = false;
      constructor(options) {
        this.options = options;
      }
      getState() {
        return this.state;
      }
      onPageMount() {
        this.active = true;
        if (this.state.job !== null) this.subscribeJob(this.state.job.id);
      }
      onPageUnmount() {
        this.active = false;
        this.unsubscribeJob?.();
        this.unsubscribeJob = null;
        this.reader?.close();
        this.reader = null;
        this.renderers.clear();
        this.contentContainer = null;
        this.importContainer = null;
      }
      mountContent(container, context) {
        this.contentContainer = container;
        this.navigate = context.navigate;
        this.renderers.add(() => this.renderContent());
        this.renderContent();
        void this.ensureBooks();
      }
      mountImport(container, context) {
        this.importContainer = container;
        this.navigate = context.navigate;
        this.renderers.add(() => this.renderImport());
        this.renderImport();
        void this.ensureBooks();
      }
      async ensureBooks(force = false) {
        if (this.loaded && !force) return;
        if (this.loadingPromise !== null && !force) return this.loadingPromise;
        this.loadingPromise = (async () => {
          this.state.booksLoading = true;
          this.state.booksError = null;
          this.notify();
          const result = await this.options.dataSource.listBooks(this.options.createRequest());
          if (!result.ok) {
            this.state.booksLoading = false;
            this.state.booksError = result.error;
            this.state.offline = result.offline === true;
            this.notify();
            return;
          }
          this.state.books = result.data;
          this.state.offline = result.offline === true;
          this.state.booksLoading = false;
          this.loaded = true;
          const selected = result.data.find((book) => book.isCurrent) ?? result.data.find((book) => book.materialState === "baseline") ?? result.data[0] ?? null;
          this.state.selectedBookId = selected?.id ?? null;
          this.notify();
          if (selected !== null) await this.loadSources(selected.id);
        })();
        await this.loadingPromise;
        this.loadingPromise = null;
      }
      async selectBook(bookId) {
        this.state.selectedBookId = bookId;
        this.state.sources = [];
        this.state.sourcesError = null;
        this.notify();
        await this.loadSources(bookId);
      }
      async loadSources(bookId) {
        const token = ++this.sourcesToken;
        this.state.sourcesLoading = true;
        this.state.sourcesError = null;
        this.notify();
        const result = await this.options.dataSource.listSources(this.options.createRequest(), bookId);
        if (token !== this.sourcesToken) return;
        this.state.sourcesLoading = false;
        if (!result.ok) {
          this.state.sourcesError = result.error;
          this.notify();
          return;
        }
        this.state.sources = result.data;
        this.notify();
      }
      async chooseFile() {
        if (this.state.jobBusy) return;
        this.state.jobBusy = true;
        this.state.importError = null;
        this.notify();
        const result = await this.options.dataSource.chooseFile(this.options.createRequest());
        this.state.jobBusy = false;
        if (!result.ok) {
          this.state.importError = result.error;
          this.notify();
          return;
        }
        this.state.selectedFile = result.data;
        this.state.metadataDraft = result.data === null ? null : {
          title: result.data.suggestedMetadata.title ?? "",
          publisher: result.data.suggestedMetadata.publisher ?? "",
          editionLabel: result.data.suggestedMetadata.editionLabel ?? "",
          pageCount: result.data.suggestedMetadata.pageCount === null ? "" : String(result.data.suggestedMetadata.pageCount)
        };
        this.notify();
      }
      updateMetadata(field, value) {
        if (this.state.metadataDraft === null) return;
        this.state.metadataDraft = { ...this.state.metadataDraft, [field]: value };
      }
      async startImport() {
        const file = this.state.selectedFile;
        const draft = this.state.metadataDraft;
        if (file === null || draft === null || this.state.jobBusy) return;
        const pageCount = draft.pageCount.trim() === "" ? null : Number(draft.pageCount);
        if (pageCount !== null && (!Number.isInteger(pageCount) || pageCount <= 0)) {
          this.state.actionNotice = "\u9875\u6570\u9700\u8981\u662F\u6B63\u6574\u6570\uFF1B\u6CA1\u6709\u5F00\u59CB\u5BFC\u5165\u3002";
          this.notify();
          return;
        }
        this.state.jobBusy = true;
        this.state.importError = null;
        this.state.actionNotice = "";
        this.notify();
        const result = await this.options.dataSource.startImport(this.options.createRequest(), {
          file: file.handle,
          confirmedMetadata: {
            title: draft.title.trim() === "" ? null : draft.title.trim(),
            publisher: draft.publisher.trim() === "" ? null : draft.publisher.trim(),
            editionLabel: draft.editionLabel.trim() === "" ? null : draft.editionLabel.trim(),
            pageCount
          }
        });
        this.state.jobBusy = false;
        if (!result.ok) {
          this.state.importError = result.error;
          this.notify();
          return;
        }
        this.acceptImportOutcome(result.data);
      }
      acceptImportOutcome(outcome) {
        this.state.job = outcome.job;
        this.state.match = outcome.match;
        this.state.reused = outcome.reused;
        this.state.importError = null;
        this.state.actionNotice = "";
        this.subscribeJob(outcome.job.id);
        this.notify();
      }
      subscribeJob(jobId) {
        this.unsubscribeJob?.();
        this.unsubscribeJob = null;
        if (this.options.dataSource.watchImport !== void 0) {
          this.unsubscribeJob = this.options.dataSource.watchImport(jobId, (next) => this.applyJob(next));
        }
      }
      applyJob(next) {
        const reduced = reduceJobUpdate(this.state.job, next);
        if (this.state.job !== null && reduced === this.state.job) return;
        this.state.job = reduced;
        this.notify();
      }
      async refreshJob() {
        const job = this.state.job;
        if (job === null) return;
        const result = await this.options.dataSource.jobStatus(this.options.createRequest(), job.id);
        if (result.ok) this.applyJob(result.data);
        else this.state.importError = result.error;
        this.notify();
      }
      async cancelImport() {
        const job = this.state.job;
        if (job === null || this.state.jobBusy) return;
        this.state.jobBusy = true;
        this.notify();
        const result = await this.options.dataSource.cancelImport(this.options.createRequest(), job.id);
        this.state.jobBusy = false;
        if (!result.ok) {
          this.state.importError = result.error;
        } else {
          this.state.job = result.data;
          this.state.actionNotice = "\u5DF2\u53D6\u6D88\u5BFC\u5165\uFF1B\u53D6\u6D88\u540E\u5230\u8FBE\u7684\u8FDF\u5230\u7ED3\u679C\u4E0D\u4F1A\u5199\u5165\u6559\u6750\u6216\u5B66\u4E60\u8BB0\u5F55\u3002";
        }
        this.notify();
      }
      async resumeImport() {
        const job = this.state.job;
        if (job === null || this.state.jobBusy) return;
        this.state.jobBusy = true;
        this.notify();
        const result = await this.options.dataSource.resumeImport(this.options.createRequest(), job.id);
        this.state.jobBusy = false;
        if (!result.ok) {
          this.state.importError = result.error;
        } else {
          this.state.job = result.data;
          this.state.actionNotice = "\u5DF2\u6062\u590D\u540C\u4E00\u5BFC\u5165\u4EFB\u52A1\uFF1B\u4E0D\u4F1A\u91CD\u590D\u5EFA\u4E66\u3002";
        }
        this.notify();
      }
      async retryImport() {
        const job = this.state.job;
        if (job === null || this.state.jobBusy) return;
        this.state.jobBusy = true;
        this.notify();
        const result = await this.options.dataSource.retryImport(this.options.createRequest(), job.id);
        this.state.jobBusy = false;
        if (!result.ok) {
          this.state.importError = result.error;
        } else {
          this.state.job = result.data;
          this.state.actionNotice = "\u5DF2\u91CD\u8BD5\u5931\u8D25\u9636\u6BB5\uFF1B\u4E0D\u4F1A\u91CD\u590D\u8BB0\u5F55\u5DF2\u5B8C\u6210\u9875\u3002";
        }
        this.notify();
      }
      resetImport() {
        this.unsubscribeJob?.();
        this.unsubscribeJob = null;
        this.state.selectedFile = null;
        this.state.metadataDraft = null;
        this.state.job = null;
        this.state.match = null;
        this.state.reused = false;
        this.state.importError = null;
        this.state.actionNotice = "";
        this.notify();
      }
      startCandidateTrial(book, trigger) {
        const dialog = new ConfirmDialog({
          title: "\u4EE5\u5019\u9009\u8EAB\u4EFD\u8BD5\u7528\uFF08\u672A\u6838\u5B9E\uFF09",
          tone: "danger",
          acknowledgement: "\u6211\u4E86\u89E3\u5019\u9009\u5185\u5BB9\u672A\u6838\u5B9E\uFF0C\u4E0D\u80FD\u4F5C\u4E3A\u57FA\u51C6\u6216\u5F3A\u638C\u63E1\u7ED3\u8BBA\u3002",
          impact: [
            "\u5019\u9009\u8EAB\u4EFD\u4F1A\u8D2F\u7A7F\u5730\u56FE\u3001\u9605\u8BFB\u4E0E\u53CD\u9988\uFF1B\u754C\u9762\u6301\u7EED\u663E\u793A\u201C\u5019\u9009\uFF08\u672A\u6838\u5B9E\uFF09\u201D\u3002",
            "\u4E0D\u4F1A\u56E0\u4E3A\u70B9\u51FB\u786E\u8BA4\u5C31\u628A\u5019\u9009\u53D8\u6210\u5DF2\u5BA1\u6821\u57FA\u51C6\u3002",
            "\u53EF\u4EE5\u968F\u65F6\u9000\u51FA\u5019\u9009\u8BD5\u7528\uFF0C\u56DE\u5230\u5DF2\u6838\u5B9E\u6750\u6599\u3002"
          ],
          confirmLabel: "\u786E\u8BA4\u4EE5\u5019\u9009\u8EAB\u4EFD\u8BD5\u7528",
          onConfirm: () => {
            this.state.candidateTrialBookId = book.id;
            this.state.selectedBookId = book.id;
            this.state.actionNotice = "\u5DF2\u8FDB\u5165\u5019\u9009\u8BD5\u7528\uFF1B\u5F3A\u7ED3\u8BBA\u4ECD\u88AB\u7981\u7528\uFF0C\u5019\u9009\u6807\u8BC6\u4E0D\u4F1A\u6D88\u5931\u3002";
            this.notify();
            void this.loadSources(book.id);
          }
        });
        const parent = this.contentContainer ?? trigger.parentElement ?? trigger.ownerDocument.body;
        dialog.open(trigger, parent);
      }
      exitCandidateTrial() {
        this.state.candidateTrialBookId = null;
        this.state.actionNotice = "\u5DF2\u9000\u51FA\u5019\u9009\u8BD5\u7528\u3002";
        this.notify();
        const baseline = this.state.books.find((book) => book.materialState === "baseline");
        if (baseline !== void 0) void this.selectBook(baseline.id);
      }
      openSource(item, trigger) {
        if (this.contentContainer === null) return;
        if (this.reader === null) {
          this.reader = new SourceReader({
            dataSource: this.options.dataSource,
            createRequest: this.options.createRequest,
            returnPath: this.options.returnPath ?? null,
            navigate: this.navigate
          });
        }
        const index = this.state.sources.findIndex((source) => source.sourceRefId === item.sourceRefId);
        this.reader.open(this.state.sources, index < 0 ? 0 : index, trigger, this.contentContainer);
      }
      notify() {
        for (const renderer of this.renderers) renderer();
      }
      renderContent() {
        const container = this.contentContainer;
        if (container === null) return;
        clear(container);
        const root = h("div", { class: "edu-lib", "data-testid": "library-content-panel" });
        root.append(fixtureNotice(this.options.dataSource.notice ?? "\u6F14\u793A\u6570\u636E\uFF08fixture\uFF09"));
        if (this.state.candidateTrialBookId !== null) {
          root.append(candidateBanner(() => this.exitCandidateTrial()));
        }
        if (this.state.booksLoading) {
          root.append(loadingState({ title: "\u6B63\u5728\u8BFB\u53D6\u6559\u6750\u5E93\u2026", body: "\u4E0D\u4F1A\u663E\u793A\u865A\u6784\u7684\u6559\u6750\u6216\u8FDB\u5EA6\u3002" }));
          container.append(root);
          return;
        }
        if (this.state.booksError !== null) {
          root.append(
            renderErrorBanner(this.state.booksError, {
              onRetry: () => void this.ensureBooks(true),
              backLabel: "\u8FD4\u56DE\u9996\u9875",
              onBack: () => this.navigate?.("/home")
            })
          );
          container.append(root);
          return;
        }
        if (this.state.books.length === 0) {
          root.append(
            emptyState({
              title: "\u8FD8\u6CA1\u6709\u53EF\u7528\u6559\u6750",
              body: "\u5148\u9009\u62E9\u672C\u5730 PDF \u6216\u8FDE\u63A5\u5DF2\u6709\u6559\u6750\uFF1B\u4E0D\u4F1A\u751F\u6210\u7A7A\u58F3\u5168\u518C\u5730\u56FE\u3002",
              testId: "library-empty",
              actions: [
                { label: "\u9009\u62E9\u672C\u5730 PDF", onClick: () => void this.chooseFile(), tone: "primary" },
                { label: "\u67E5\u770B\u8BB0\u5F55", onClick: () => this.navigate?.("/records") }
              ]
            })
          );
          container.append(root);
          return;
        }
        const groups = [
          { title: "\u672C\u671F\u5339\u914D\u57FA\u51C6", state: "baseline", books: this.state.books.filter((book) => book.materialState === "baseline") },
          { title: "\u5F85\u6838\u5B9E\u5019\u9009", state: "candidate", books: this.state.books.filter((book) => book.materialState === "candidate") },
          { title: "\u4E0D\u53EF\u7528\u6750\u6599", state: "unavailable", books: this.state.books.filter((book) => book.materialState === "unavailable") }
        ];
        for (const group of groups) {
          if (group.books.length === 0) continue;
          const section = h(
            "section",
            { class: "edu-section", "data-testid": `library-group-${group.state}` },
            h("h2", { class: "edu-section__title" }, group.title),
            h(
              "p",
              { class: "edu-section__lead" },
              group.state === "candidate" ? "\u5019\u9009\u5185\u5BB9\u672A\u6838\u5B9E\uFF1B\u53EA\u6709\u663E\u5F0F\u8BD5\u7528\u540E\u624D\u4F1A\u6253\u5F00\uFF0C\u6807\u8BC6\u4F1A\u6301\u7EED\u53EF\u89C1\u3002" : group.state === "unavailable" ? "\u8FD9\u4E9B\u6750\u6599\u4E0D\u53EF\u7528\uFF0C\u4F46\u4E0D\u4F1A\u5220\u9664\u5176\u4ED6\u6559\u6750\u6216\u4E2A\u4EBA\u8BB0\u5F55\u3002" : "\u5DF2\u5339\u914D\u672C\u671F\u57FA\u51C6\uFF1B\u5185\u5BB9\u8303\u56F4\u4ECD\u9700\u6309\u5305\u58F0\u660E\u663E\u793A\u3002"
            )
          );
          const grid = h("div", { class: "edu-lib-grid" });
          for (const book of group.books) {
            grid.append(
              bookCard(book, {
                candidateTrial: this.state.candidateTrialBookId === book.id,
                onViewSources: (selected) => void this.selectBook(selected.id),
                onTrialCandidate: (selected, trigger) => this.startCandidateTrial(selected, trigger),
                onExitTrial: () => this.exitCandidateTrial(),
                onChooseFile: () => {
                  this.resetImport();
                  void this.chooseFile();
                },
                onSetCurrent: (selected) => void this.selectBook(selected.id)
              })
            );
          }
          section.append(grid);
          root.append(section);
        }
        root.append(this.renderSources());
        container.append(root);
      }
      renderSources() {
        const book = this.state.books.find((entry) => entry.id === this.state.selectedBookId) ?? null;
        const section = h(
          "section",
          { class: "edu-section", "data-testid": "library-sources" },
          h("h2", { class: "edu-section__title" }, "\u6765\u6E90\u9605\u8BFB"),
          h(
            "p",
            { class: "edu-section__lead" },
            book === null ? "\u9009\u62E9\u4E00\u672C\u6559\u6750\u540E\u67E5\u770B\u6765\u6E90\u3002" : `${book.title} \xB7 PDF \u9875\u5E8F\u4E0E\u5370\u5237\u9875\u7801\u5206\u5F00\u663E\u793A\uFF1B\u67E5\u770B\u6765\u6E90\u4E0D\u4F1A\u63D0\u4EA4\u4F5C\u7B54\u3002`
          )
        );
        if (this.state.sourcesLoading) {
          section.append(loadingState({ title: "\u6B63\u5728\u8BFB\u53D6\u6765\u6E90\u5217\u8868\u2026" }));
          return section;
        }
        if (this.state.sourcesError !== null) {
          section.append(
            renderErrorBanner(this.state.sourcesError, {
              onRetry: () => void this.loadSources(this.state.selectedBookId ?? ""),
              backLabel: "\u8FD4\u56DE\u6559\u6750\u5E93",
              onBack: () => this.navigate?.("/library")
            })
          );
          return section;
        }
        if (this.state.sources.length === 0) {
          section.append(
            h(
              "p",
              { class: "edu-state__body" },
              book?.materialState === "unavailable" ? "\u4E0D\u53EF\u7528\u6750\u6599\u6CA1\u6709\u53EF\u9605\u8BFB\u6765\u6E90\uFF1B\u6559\u6750\u5E93\u4E0D\u4F1A\u4F2A\u9020\u9875\u9762\u3002" : "\u5F53\u524D\u6559\u6750\u8FD8\u6CA1\u6709\u53EF\u663E\u793A\u7684\u6765\u6E90\u6761\u76EE\u3002"
            )
          );
          return section;
        }
        const list = h("ul", { class: "edu-lib-source-list" });
        for (const item of this.state.sources) {
          list.append(sourceListItem(item, (selected, trigger) => this.openSource(selected, trigger)));
        }
        section.append(list);
        return section;
      }
      renderImport() {
        const container = this.importContainer;
        if (container === null) return;
        clear(container);
        const root = h("div", { class: "edu-lib", "data-testid": "library-import-panel" });
        root.append(
          h("h2", { class: "edu-section__title" }, "\u5BFC\u5165\u6559\u6750"),
          h(
            "p",
            { class: "edu-section__lead" },
            "\u9009\u62E9\u672C\u5730 PDF \u540E\u786E\u8BA4\u5143\u6570\u636E\u518D\u5F00\u59CB\uFF1B\u8FDB\u5EA6\u3001\u53D6\u6D88\u3001\u6062\u590D\u4E0E\u5931\u8D25\u90FD\u663E\u793A\u771F\u5B9E\u9636\u6BB5\u3002\u4E0A\u4F20\u8303\u56F4\u4F1A\u5728\u53D1\u9001\u524D\u8BF4\u660E\uFF0C\u4E0D\u9ED8\u8BA4\u4E0A\u4F20\u6574\u672C\u3002"
          ),
          h(
            "p",
            { class: "edu-muted", "data-testid": "library-import-fixture" },
            "\u5BFC\u5165\u4EFB\u52A1\u4E3A\u6F14\u793A\u6570\u636E\uFF08fixture\uFF09\uFF0C\u4E0D\u662F\u771F\u5B9E\u89E3\u6790\u7ED3\u679C\u3002"
          )
        );
        if (this.state.candidateTrialBookId !== null) {
          root.append(candidateBanner(() => this.exitCandidateTrial()));
        }
        if (this.state.offline) {
          root.append(
            notice({
              tone: "warning",
              title: "\u5F53\u524D\u79BB\u7EBF",
              body: "\u672C\u5730\u9009\u62E9\u4E0E\u5DF2\u5B8C\u6210\u9875\u9762\u4ECD\u53EF\u67E5\u770B\uFF1B\u4E91\u7AEF\u6B65\u9AA4\u4F1A\u6682\u505C\uFF0C\u4E0D\u4F1A\u4F2A\u88C5\u5B8C\u6210\u3002"
            })
          );
        }
        if (this.state.job === null) {
          if (this.state.importError !== null) {
            root.append(
              renderErrorBanner(this.state.importError, {
                onRetry: () => void this.chooseFile(),
                backLabel: "\u91CD\u65B0\u9009\u62E9\u6587\u4EF6",
                onBack: () => void this.chooseFile()
              })
            );
          }
          if (this.state.selectedFile === null) {
            root.append(
              h(
                "div",
                { class: "edu-lib-file" },
                h("p", { class: "edu-card__title" }, "\u8FD8\u6CA1\u6709\u9009\u62E9\u6587\u4EF6"),
                h(
                  "p",
                  { class: "edu-card__meta" },
                  "\u53EA\u63A5\u53D7\u5BBF\u4E3B\u7BA1\u7406\u7684 PDF\uFF1B\u9009\u62E9\u672C\u8EAB\u4E0D\u4F1A\u4E0A\u4F20\u6216\u5BFC\u5165\u3002"
                ),
                h(
                  "div",
                  { class: "edu-inline-actions" },
                  button("\u9009\u62E9\u672C\u5730 PDF \u6587\u4EF6", () => void this.chooseFile(), {
                    tone: "primary",
                    disabled: this.state.jobBusy,
                    dataAction: "choose-file"
                  })
                )
              )
            );
          } else {
            root.append(selectedFileCard(this.state.selectedFile), this.renderMetadataForm());
          }
        } else {
          root.append(this.renderJob(this.state.job));
        }
        if (this.state.actionNotice.length > 0) {
          root.append(
            h(
              "p",
              { class: "edu-notice edu-notice--info", role: "status", "data-testid": "library-action-notice" },
              this.state.actionNotice
            )
          );
        }
        container.append(root);
      }
      renderMetadataForm() {
        const draft = this.state.metadataDraft;
        if (draft === null) return h("p", {});
        const form = h("form", {
          class: "edu-lib-form",
          "data-testid": "library-metadata-form",
          onsubmit: (event) => {
            event.preventDefault();
            void this.startImport();
          }
        });
        const field = (label, name, type = "text") => {
          const input = h("input", {
            class: "edu-input",
            type,
            id: `library-meta-${name}`,
            value: draft[name],
            oninput: (event) => this.updateMetadata(name, event.currentTarget.value)
          });
          return h("div", { class: "edu-field" }, h("label", { class: "edu-field__label", for: `library-meta-${name}` }, label), input);
        };
        form.append(
          field("\u4E66\u540D\uFF08\u53EF\u7A7A\uFF09", "title"),
          field("\u51FA\u7248\u793E\uFF08\u53EF\u7A7A\uFF09", "publisher"),
          field("\u7248\u6B21/\u5370\u6B21\uFF08\u53EF\u7A7A\uFF09", "editionLabel"),
          field("\u9875\u6570", "pageCount", "number")
        );
        form.append(
          h(
            "div",
            { class: "edu-inline-actions" },
            button("\u786E\u8BA4\u5143\u6570\u636E\u5E76\u5F00\u59CB\u5BFC\u5165", () => void this.startImport(), {
              tone: "primary",
              disabled: this.state.jobBusy,
              dataAction: "start-import"
            }),
            button("\u91CD\u65B0\u9009\u62E9\u6587\u4EF6", () => void this.chooseFile(), { small: true, disabled: this.state.jobBusy })
          )
        );
        form.append(
          h(
            "p",
            { class: "edu-card__meta" },
            "\u5143\u6570\u636E\u53EA\u7528\u4E8E\u5339\u914D/\u5019\u9009\u6807\u8BC6\uFF0C\u4E0D\u4F1A\u56E0\u4E3A\u586B\u5199\u4E66\u540D\u5C31\u6210\u4E3A\u5DF2\u6838\u5B9E\u57FA\u51C6\u3002\u9875\u6570\u4E0E\u5B9E\u9645\u6587\u4EF6\u4E0D\u4E00\u81F4\u65F6\u670D\u52A1\u4F1A\u62D2\u7EDD\u3002"
          )
        );
        return form;
      }
      renderJob(job) {
        const wrapper = h("div", { class: "edu-lib-job", "data-testid": "library-import-job" });
        wrapper.append(
          h(
            "div",
            { class: "edu-lib-job__head" },
            h("h3", { class: "edu-lib-job__title" }, `\u5BFC\u5165\u4EFB\u52A1 ${job.id}`),
            h(
              "div",
              { class: "edu-inline-actions" },
              statusChip(STATUS_LABELS[job.status], STATUS_TONES[job.status]),
              statusChip(`\u5F53\u524D\u9636\u6BB5\uFF1A${STAGE_LABELS[job.stage]}`, job.stage === "await_review" ? "attention" : "progress")
            )
          ),
          h(
            "p",
            { class: "edu-lib-status-line" },
            `\u89E3\u6790\u5668 ${job.parserVersion} \xB7 \u66F4\u65B0\u4E8E ${formatLocalTime(job.updatedAt)}`
          ),
          progressSummary({
            label: "\u5DF2\u5904\u7406\u9875\u6570",
            current: job.completedUnits,
            total: job.totalUnits,
            note: "\u9636\u6BB5\u4E0E\u9875\u6570\u7531\u5BFC\u5165\u670D\u52A1\u8FD4\u56DE\uFF1B\u754C\u9762\u4E0D\u4F2A\u9020\u8FDB\u5EA6\uFF0C\u4E5F\u4E0D\u628A\u7B49\u5F85\u5BA1\u6821\u5F53\u4F5C\u5B8C\u6210\u3002"
          })
        );
        const stages = h("ol", { class: "edu-lib-stage-list", "data-testid": "library-stages" });
        for (const stage of STAGE_ORDER) {
          const current = stage === job.stage;
          const index = STAGE_ORDER.indexOf(stage);
          const currentIndex = STAGE_ORDER.indexOf(job.stage);
          const done = index < currentIndex;
          const blocked = current && (job.status === "failed" || job.status === "cancelled");
          stages.append(
            h(
              "li",
              {
                class: "edu-lib-stage",
                "aria-current": current ? "step" : void 0,
                "data-state": done ? "done" : blocked ? "blocked" : current ? "current" : "future"
              },
              h("span", { class: "edu-lib-stage__name" }, STAGE_LABELS[stage]),
              h("span", { class: "edu-lib-stage__state" }, stageStateLabel(stage, job.stage, job.status))
            )
          );
        }
        wrapper.append(stages);
        if (this.state.reused) {
          wrapper.append(
            notice({
              tone: "info",
              title: "\u540C\u4E00\u6587\u4EF6\u5DF2\u5B58\u5728\uFF0C\u5DF2\u590D\u7528\u4EFB\u52A1",
              body: "\u6CA1\u6709\u91CD\u590D\u5EFA\u4E66\uFF1B\u540C\u4E00\u6307\u7EB9\u7684\u65E2\u6709\u4EFB\u52A1\u88AB\u7EE7\u7EED\u4F7F\u7528\u3002",
              testId: "library-duplicate-notice"
            })
          );
        }
        if (this.state.match !== null) {
          wrapper.append(
            notice({
              tone: this.state.match.kind === "same_hash" || this.state.match.kind === "same_edition_rescan" ? "info" : "warning",
              title: "\u5339\u914D\u7ED3\u679C",
              body: this.state.match.label,
              testId: "library-match-notice"
            })
          );
        }
        if (job.stage === "await_review") {
          wrapper.append(
            notice({
              tone: "warning",
              title: "\u5F85\u5BA1\u6838\uFF1A\u4E0D\u662F\u5BFC\u5165\u5B8C\u6210",
              body: "\u5185\u5BB9\u5DF2\u5230\u8FBE\u5BA1\u6821\u961F\u5217\uFF1B\u5728\u5BA1\u6821\u5B8C\u6210\u524D\u4E0D\u80FD\u4F5C\u4E3A\u5DF2\u6838\u5B9E\u57FA\u51C6\uFF0C\u4E5F\u4E0D\u663E\u793A\u201C\u5DF2\u5B8C\u6210\u201D\u3002",
              testId: "library-await-review"
            })
          );
        } else if (job.stage === "ready" && job.status === "completed") {
          wrapper.append(
            notice({
              tone: "info",
              title: "\u6750\u6599\u5C31\u7EEA\uFF08\u6309\u5305\u58F0\u660E\u7684\u8303\u56F4\uFF09",
              body: "\u6750\u6599\u5DF2\u5C31\u7EEA\uFF1B\u82E5\u4E3A\u90E8\u5206\u8303\u56F4\uFF0C\u4E0D\u7B49\u4E8E\u5168\u518C\u5C31\u7EEA\u3002\u8BF7\u67E5\u770B\u5185\u5BB9\u8303\u56F4\u4E0E\u6765\u6E90\u3002",
              testId: "library-ready"
            })
          );
        }
        if (job.error !== null) {
          const copy = describeImportError(job.error.code, job.error.retryable);
          const tone = job.status === "paused" ? "warning" : "danger";
          wrapper.append(
            h(
              "div",
              {
                class: `edu-notice edu-notice--${tone}`,
                role: job.status === "failed" ? "alert" : "status",
                "data-testid": "library-import-error"
              },
              h("p", { class: "edu-notice__title" }, copy.title),
              h("p", { class: "edu-notice__body" }, copy.detail),
              h("p", { class: "edu-notice__body" }, `\u4E0B\u4E00\u6B65\uFF1A${copy.next}`),
              h("p", { class: "edu-notice__body" }, `\u9519\u8BEF\u4EE3\u7801\uFF1A${copy.code}`)
            )
          );
        }
        if (job.status === "cancelled") {
          wrapper.append(
            notice({
              tone: "info",
              title: "\u5BFC\u5165\u5DF2\u53D6\u6D88",
              body: "\u53D6\u6D88\u540E\u5230\u8FBE\u7684\u8FDF\u5230\u7ED3\u679C\u4E0D\u4F1A\u5199\u5165\u6559\u6750\u6216\u5B66\u4E60\u8BB0\u5F55\uFF1B\u53EF\u4EE5\u6062\u590D\u540C\u4E00\u4EFB\u52A1\u6216\u91CD\u65B0\u9009\u62E9\u6587\u4EF6\u3002",
              testId: "library-cancelled"
            })
          );
        }
        const actions = h("div", { class: "edu-inline-actions" });
        if (canCancel(job)) {
          actions.append(
            button("\u53D6\u6D88\u5BFC\u5165", () => void this.cancelImport(), {
              small: true,
              tone: "danger-ghost",
              disabled: this.state.jobBusy,
              dataAction: "cancel-import"
            })
          );
        }
        if (canRetry(job)) {
          actions.append(
            button("\u91CD\u8BD5\u5931\u8D25\u9636\u6BB5", () => void this.retryImport(), {
              small: true,
              tone: "primary",
              disabled: this.state.jobBusy,
              dataAction: "retry-import"
            })
          );
        } else if (canResume(job) && job.stage !== "await_review") {
          actions.append(
            button(job.status === "failed" ? "\u6062\u590D\u4EFB\u52A1" : "\u6062\u590D\u5BFC\u5165", () => void this.resumeImport(), {
              small: true,
              disabled: this.state.jobBusy,
              dataAction: "resume-import"
            })
          );
        }
        actions.append(
          button("\u5237\u65B0\u72B6\u6001", () => void this.refreshJob(), {
            small: true,
            disabled: this.state.jobBusy,
            dataAction: "refresh-import"
          })
        );
        actions.append(button("\u91CD\u65B0\u9009\u62E9\u6587\u4EF6", () => this.resetImport(), { small: true }));
        if (job.stage === "ready" || job.stage === "await_review") {
          actions.append(button("\u53BB\u5730\u56FE\u67E5\u770B\u6750\u6599", () => this.navigate?.("/map"), { small: true }));
        }
        wrapper.append(actions);
        return wrapper;
      }
    };
    
    // education/client/library/src/styles.ts
    var LIBRARY_STYLE_ATTRIBUTE = "data-edu-library-style";
    var libraryStyles = `
    .edu-lib { min-width: 0; }
    .edu-lib *,
    .edu-lib *::before,
    .edu-lib *::after { box-sizing: border-box; }
    .edu-lib-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(min(100%, 20rem), 1fr));
      gap: ${DESIGN_TOKENS.spacing.md};
      min-width: 0;
    }
    .edu-lib-book {
      min-width: 0;
      background: var(--edu-color-surface);
      border: 1px solid var(--edu-color-line);
      border-radius: var(--edu-radius-lg);
      padding: ${DESIGN_TOKENS.spacing.md};
      display: flex;
      flex-direction: column;
      gap: ${DESIGN_TOKENS.spacing.sm};
    }
    .edu-lib-book[data-state="candidate"] { border-color: ${DESIGN_TOKENS.colors.warning}; border-left-width: 0.4rem; }
    .edu-lib-book[data-state="unavailable"] { border-color: ${DESIGN_TOKENS.colors.danger}; border-left-width: 0.4rem; }
    .edu-lib-book__head { display: flex; flex-wrap: wrap; gap: ${DESIGN_TOKENS.spacing.xs}; align-items: center; justify-content: space-between; }
    .edu-lib-book__title { margin: 0; font-size: var(--edu-font-lg); overflow-wrap: anywhere; }
    .edu-lib-book__meta { margin: 0; color: var(--edu-color-ink-muted); font-size: var(--edu-font-sm); overflow-wrap: anywhere; }
    .edu-lib-book__actions { display: flex; flex-wrap: wrap; gap: ${DESIGN_TOKENS.spacing.xs}; margin-top: auto; padding-top: ${DESIGN_TOKENS.spacing.xs}; }
    .edu-lib-candidate-banner {
      position: sticky; top: 0; z-index: 3;
      margin-bottom: ${DESIGN_TOKENS.spacing.md};
      padding: ${DESIGN_TOKENS.spacing.sm} ${DESIGN_TOKENS.spacing.md};
      border: 1px solid ${DESIGN_TOKENS.colors.warning};
      border-left-width: 0.4rem;
      border-radius: var(--edu-radius-md);
      background: ${DESIGN_TOKENS.colors.warningSoft};
      color: ${DESIGN_TOKENS.colors.warning};
      font-weight: 600;
      overflow-wrap: anywhere;
    }
    .edu-lib-candidate-banner button { margin-left: ${DESIGN_TOKENS.spacing.xs}; }
    .edu-lib-stage-list { list-style: none; margin: ${DESIGN_TOKENS.spacing.sm} 0; padding: 0; display: grid; gap: ${DESIGN_TOKENS.spacing.xxs}; }
    .edu-lib-stage {
      display: flex; flex-wrap: wrap; gap: ${DESIGN_TOKENS.spacing.xs}; align-items: baseline;
      padding: ${DESIGN_TOKENS.spacing.xs} ${DESIGN_TOKENS.spacing.sm};
      border-left: 0.25rem solid var(--edu-color-line);
      background: var(--edu-color-surface-muted);
      border-radius: 0 ${DESIGN_TOKENS.radii.sm} ${DESIGN_TOKENS.radii.sm} 0;
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
    .edu-lib-job { border: 1px solid var(--edu-color-line); border-radius: var(--edu-radius-lg); padding: ${DESIGN_TOKENS.spacing.md}; background: var(--edu-color-surface); min-width: 0; }
    .edu-lib-job__head { display: flex; flex-wrap: wrap; gap: ${DESIGN_TOKENS.spacing.xs}; align-items: center; justify-content: space-between; }
    .edu-lib-job__title { margin: 0; font-size: var(--edu-font-lg); overflow-wrap: anywhere; }
    .edu-lib-form { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 15rem), 1fr)); gap: ${DESIGN_TOKENS.spacing.sm}; margin: ${DESIGN_TOKENS.spacing.sm} 0; }
    .edu-lib-form .edu-field { min-width: 0; }
    .edu-lib-form input { width: 100%; }
    .edu-lib-file {
      border: 1px dashed var(--edu-color-line-strong);
      border-radius: var(--edu-radius-md);
      padding: ${DESIGN_TOKENS.spacing.sm};
      margin: ${DESIGN_TOKENS.spacing.sm} 0;
      min-width: 0;
      overflow-wrap: anywhere;
    }
    .edu-lib-source-list { list-style: none; padding: 0; margin: ${DESIGN_TOKENS.spacing.sm} 0; display: grid; gap: ${DESIGN_TOKENS.spacing.xs}; }
    .edu-lib-source-item {
      display: flex; flex-wrap: wrap; gap: ${DESIGN_TOKENS.spacing.xs}; align-items: center; justify-content: space-between;
      padding: ${DESIGN_TOKENS.spacing.xs} ${DESIGN_TOKENS.spacing.sm};
      border: 1px solid var(--edu-color-line);
      border-radius: var(--edu-radius-sm);
      background: var(--edu-color-surface);
      min-width: 0;
    }
    .edu-lib-source-item__label { min-width: 0; overflow-wrap: anywhere; }
    .edu-lib-reader { display: grid; gap: ${DESIGN_TOKENS.spacing.md}; min-width: 0; }
    .edu-lib-page-info { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 14rem), 1fr)); gap: ${DESIGN_TOKENS.spacing.sm}; }
    .edu-lib-page-info__box { border: 1px solid var(--edu-color-line); border-radius: var(--edu-radius-md); padding: ${DESIGN_TOKENS.spacing.sm}; min-width: 0; }
    .edu-lib-page-info__label { margin: 0; color: var(--edu-color-ink-muted); font-size: var(--edu-font-sm); }
    .edu-lib-page-info__value { margin: ${DESIGN_TOKENS.spacing.xxs} 0 0; font-size: var(--edu-font-lg); font-weight: 700; overflow-wrap: anywhere; }
    .edu-lib-page {
      position: relative;
      width: 100%;
      max-width: 32rem;
      aspect-ratio: 3 / 4;
      margin: ${DESIGN_TOKENS.spacing.sm} auto;
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
      padding: ${DESIGN_TOKENS.spacing.md};
      color: var(--edu-color-ink-muted);
      text-align: center;
      font-size: var(--edu-font-sm);
    }
    .edu-lib-region {
      position: absolute;
      border: 0.2rem solid ${DESIGN_TOKENS.colors.focus};
      background: rgba(154, 75, 0, 0.18);
      box-sizing: border-box;
      pointer-events: none;
    }
    .edu-lib-region__label {
      position: absolute; left: 0; top: -1.45rem;
      padding: 0 ${DESIGN_TOKENS.spacing.xxs};
      background: ${DESIGN_TOKENS.colors.focus};
      color: #fff;
      font-size: var(--edu-font-xs);
      white-space: nowrap;
    }
    .edu-lib-block { border: 1px solid var(--edu-color-line); border-radius: var(--edu-radius-sm); padding: ${DESIGN_TOKENS.spacing.sm}; margin-top: ${DESIGN_TOKENS.spacing.sm}; min-width: 0; }
    .edu-lib-block__text { margin: ${DESIGN_TOKENS.spacing.xs} 0 0; overflow-wrap: anywhere; }
    .edu-lib-reader-nav { display: flex; flex-wrap: wrap; gap: ${DESIGN_TOKENS.spacing.xs}; align-items: center; }
    .edu-lib-reader-nav .edu-button { min-height: 2.25rem; }
    .edu-lib-status-line { margin: ${DESIGN_TOKENS.spacing.xs} 0; color: var(--edu-color-ink-muted); font-size: var(--edu-font-sm); overflow-wrap: anywhere; }
    .edu-lib-inline-code { font-family: ui-monospace, "Cascadia Mono", monospace; font-size: var(--edu-font-xs); overflow-wrap: anywhere; }
    @media (max-width: 719px) {
      .edu-lib-page { max-width: 100%; }
      .edu-lib-book__actions .edu-button { width: 100%; }
    }
    `;
    function ensureLibraryStyles(doc) {
      const existing = doc.head.querySelector(`style[${LIBRARY_STYLE_ATTRIBUTE}]`);
      if (existing !== null) return existing;
      const style = doc.createElement("style");
      style.setAttribute(LIBRARY_STYLE_ATTRIBUTE, "true");
      style.textContent = libraryStyles;
      doc.head.append(style);
      return style;
    }
    
    // education/client/library/src/page.ts
    function createLibraryPage(controller) {
      return {
        id: "library",
        path: "/library",
        title: "\u6559\u6750\u5E93",
        requiresLearner: false,
        fallback: false,
        mount(context) {
          ensureLibraryStyles(context.container.ownerDocument);
          controller.onPageMount();
          const root = h("div", { class: "edu-lib", "data-testid": "library-page" });
          root.append(
            h(
              "header",
              { class: "edu-page__header" },
              h("h1", { class: "edu-page__title", tabindex: -1 }, "\u6559\u6750\u5E93"),
              h(
                "p",
                { class: "edu-page__lead" },
                "\u533A\u5206\u672C\u671F\u5339\u914D\u57FA\u51C6\u3001\u5F85\u6838\u5B9E\u5019\u9009\u4E0E\u4E0D\u53EF\u7528\u6750\u6599\uFF1B\u67E5\u770B\u5BFC\u5165\u8FDB\u5EA6\u4E0E\u6765\u6E90\uFF0C\u5019\u9009\u6807\u8BC6\u59CB\u7EC8\u53EF\u89C1\u3002"
              )
            ),
            h("div", { "data-edu-slot": "library:content", "data-testid": "library-content-slot" }),
            h("div", { "data-edu-slot": "library:import", "data-testid": "library-import-slot" })
          );
          context.container.append(root);
        },
        unmount() {
          controller.onPageUnmount();
        }
      };
    }
    
    // education/packages/domain/fixtures/entities/figure.json
    var figure_default = {
      schemaVersion: 1,
      id: "figure.cell.1",
      sourceRefId: "source.p26",
      type: "diagram",
      originalAssetId: "asset.figure.cell",
      activeAssetId: "asset.figure.cell",
      caption: "fixture cell diagram (synthetic)",
      extractionMethod: "manual",
      reviewState: "curator_checked"
    };
    
    // education/packages/domain/fixtures/entities/source-ref.json
    var source_ref_default = {
      schemaVersion: 1,
      id: "source.p18",
      bookInstanceId: "book.biology-7a.local",
      baselineSourceId: null,
      pdfPage: 18,
      printedPage: "12",
      bbox: null,
      blockId: null,
      figureId: null,
      verification: {
        state: "human_checked",
        actorKind: "human_curator",
        checkedAt: "2026-10-02T09:00:00Z",
        notes: "fixture source mapping"
      }
    };
    
    // education/packages/domain/fixtures/entities/source-block.json
    var source_block_default = {
      schemaVersion: 1,
      id: "block.cell.ocr.1",
      sourceRefId: "source.p18",
      type: "paragraph",
      originalText: "fixture OCR original text (kept, never overwritten)",
      revisedText: "fixture revised text",
      extractionMethod: "ocr",
      textConfidence: 0.92,
      reviewState: "curator_checked"
    };
    
    // education/client/library/src/index.ts
    function defaultRequestFactory() {
      let counter = 0;
      return () => {
        counter += 1;
        return {
          requestId: `request.library.${counter}`,
          learnerId: "learner.local.default",
          now: (/* @__PURE__ */ new Date()).toISOString()
        };
      };
    }
    function createLibraryUi(options) {
      const controllerOptions = {
        dataSource: options.dataSource,
        createRequest: options.createRequest ?? defaultRequestFactory(),
        returnPath: options.returnPath ?? null
      };
      const controller = new LibraryController(controllerOptions);
      const page = createLibraryPage(controller);
      const contentPanel = {
        id: "library-content",
        mount(context) {
          controller.mountContent(context.container, context);
        },
        unmount() {
        }
      };
      const importPanel = {
        id: "library-import",
        mount(context) {
          controller.mountImport(context.container, context);
        },
        unmount() {
        }
      };
      const panels = [
        { name: "library:content", panel: contentPanel },
        { name: "library:import", panel: importPanel }
      ];
      return {
        page,
        panels,
        controller,
        register(shell) {
          shell.registerPage(page);
          const offs = panels.map((entry) => shell.registerPanel(entry.name, entry.panel));
          return () => {
            for (const off of offs) off();
          };
        }
      };
    }
    
    // education/client/map/src/model.ts
    var REVIEW_HISTORY_LABELS = {
      needs_support: "\u4ECD\u9700\u5DE9\u56FA",
      developing: "\u521D\u6B65\u7406\u89E3",
      supported: "\u8868\u73B0\u7A33\u5B9A"
    };
    var FILTER_LABELS = {
      all: "\u5168\u90E8\u6982\u5FF5",
      needs_support: "\u7406\u89E3\uFF1A\u9700\u5DE9\u56FA",
      due: "\u590D\u4E60\uFF1A\u5F85\u590D\u4E60",
      unassessed: "\u7406\u89E3\uFF1A\u5C1A\u65E0\u8DB3\u591F\u8BC1\u636E"
    };
    var VIEW_MODE_LABELS = {
      graph: "\u5173\u7CFB\u56FE",
      relations: "\u5173\u7CFB\u5217\u8868\uFF08\u6587\u5B57\u66FF\u4EE3\uFF09",
      concepts: "\u672C\u7AE0\u6982\u5FF5\u5217\u8868"
    };
    function sortNodes(nodes) {
      return [...nodes].sort(
        (left, right) => left.order !== right.order ? left.order - right.order : left.id < right.id ? -1 : 1
      );
    }
    function buildTocModel(payload) {
      const byId = new Map(payload.toc.map((node) => [node.id, node]));
      const children = /* @__PURE__ */ new Map();
      for (const node of payload.toc) {
        if (node.parentId === null) continue;
        const list = [...children.get(node.parentId) ?? [], node];
        children.set(node.parentId, sortNodes(list));
      }
      const roots = sortNodes(payload.toc.filter((node) => node.parentId === null));
      const placements = /* @__PURE__ */ new Map();
      for (const concept2 of payload.concepts) {
        for (const placement of concept2.placements) {
          const set = placements.get(placement) ?? /* @__PURE__ */ new Set();
          set.add(concept2.id);
          placements.set(placement, set);
        }
      }
      const subtreeCache = /* @__PURE__ */ new Map();
      const subtreeNodeIds = (id) => {
        const cached = subtreeCache.get(id);
        if (cached !== void 0) return cached;
        const start = byId.get(id);
        if (start === void 0) return [];
        const output = [];
        const stack = [start];
        while (stack.length > 0) {
          const current = stack.pop();
          output.push(current.id);
          const kids = children.get(current.id) ?? [];
          for (let index = kids.length - 1; index >= 0; index -= 1) stack.push(kids[index]);
        }
        subtreeCache.set(id, output);
        return output;
      };
      const conceptCache = /* @__PURE__ */ new Map();
      const conceptIdsIn = (id) => {
        const cached = conceptCache.get(id);
        if (cached !== void 0) return cached;
        const distinct = /* @__PURE__ */ new Set();
        for (const nodeId of subtreeNodeIds(id)) {
          for (const conceptId of placements.get(nodeId) ?? []) distinct.add(conceptId);
        }
        const ordered = payload.concepts.filter((concept2) => distinct.has(concept2.id)).map((concept2) => concept2.id);
        conceptCache.set(id, ordered);
        return ordered;
      };
      const chapterOf = (id) => {
        let cursor = byId.get(id);
        let guard = 0;
        while (cursor !== void 0 && guard <= payload.toc.length) {
          if (cursor.type === "chapter") return cursor;
          cursor = cursor.parentId === null ? void 0 : byId.get(cursor.parentId);
          guard += 1;
        }
        return null;
      };
      const pathOf = (id) => {
        const path = [];
        let cursor = byId.get(id);
        let guard = 0;
        while (cursor !== void 0 && guard <= payload.toc.length) {
          path.unshift(cursor);
          cursor = cursor.parentId === null ? void 0 : byId.get(cursor.parentId);
          guard += 1;
        }
        return path;
      };
      const progressByConcept = new Map(
        payload.progress.map((entry) => [entry.conceptId, entry])
      );
      const stateById = new Map(
        payload.concepts.map((concept2) => [concept2.id, summarizeConceptState(payload, concept2.id)])
      );
      const visibleRows = (expandedIds) => {
        const rows = [];
        const walk = (node, depth) => {
          const kids = children.get(node.id) ?? [];
          const conceptIds = conceptIdsIn(node.id);
          let learned = 0;
          let due = 0;
          let needsSupport = 0;
          for (const conceptId of conceptIds) {
            const state = stateById.get(conceptId);
            const entry = progressByConcept.get(conceptId);
            if (entry?.learning.state === "completed") learned += 1;
            if (entry?.review.dueAt !== null && entry?.review.dueAt !== void 0) due += 1;
            if (state?.understanding.state === "needs_support") needsSupport += 1;
          }
          rows.push({
            node,
            depth,
            hasChildren: kids.length > 0,
            expanded: expandedIds.has(node.id),
            conceptCount: conceptIds.length,
            learnedCount: learned,
            dueCount: due,
            needsSupportCount: needsSupport
          });
          if (expandedIds.has(node.id)) {
            for (const child of kids) walk(child, depth + 1);
          }
        };
        for (const root of roots) walk(root, 0);
        return rows;
      };
      return {
        roots,
        node: (id) => byId.get(id),
        childrenOf: (id) => children.get(id) ?? [],
        pathOf,
        chapterOf,
        ancestorsOf: (id) => pathOf(id).slice(0, -1).map((node) => node.id),
        subtreeNodeIds,
        conceptIdsIn,
        chapters: () => payload.toc.filter((node) => node.type === "chapter"),
        visibleRows
      };
    }
    function learningTone2(state) {
      if (state === "completed") return "positive";
      if (state === "in_progress") return "progress";
      return "neutral";
    }
    function understandingTone2(state) {
      if (state === "supported") return "positive";
      if (state === "needs_support") return "attention";
      if (state === "developing") return "progress";
      return "neutral";
    }
    function summarizeConceptState(payload, conceptId) {
      const concept2 = payload.concepts.find((entry) => entry.id === conceptId);
      const progress2 = payload.progress.find((entry) => entry.conceptId === conceptId) ?? null;
      const selfReport = payload.selfReports.find((entry) => entry.conceptId === conceptId) ?? null;
      const evidence2 = payload.evidence.filter((entry) => entry.conceptId === conceptId);
      const candidate = payload.trustMode === "candidate";
      const learningState = progress2?.learning.state ?? "not_started";
      const rawUnderstanding = progress2?.understanding.state ?? "unassessed";
      const validity = progress2 === null ? null : progress2.understanding.validity;
      const validityLabel = validity === null || validity === "current" ? null : VALIDITY_LABELS[validity];
      const candidateDisabled = candidate && rawUnderstanding !== "unassessed";
      const understandingState = candidate ? "unassessed" : rawUnderstanding;
      const understandingText = candidate ? `${UNDERSTANDING_LABELS.unassessed}\uFF08\u5019\u9009\u5185\u5BB9\u7981\u7528\u5F3A\u7ED3\u8BBA\uFF09` : `${UNDERSTANDING_LABELS[understandingState]}${validityLabel === null ? "" : `\uFF08${validityLabel}\uFF09`}`;
      const outcome = progress2?.review.latestOutcome ?? null;
      const historyLabel = progress2?.review.lastCompletedAt === null || progress2?.review.lastCompletedAt === void 0 ? "\u5C1A\u672A\u590D\u4E60" : outcome === null ? "\u5DF2\u590D\u4E60" : `\u590D\u4E60\u5B8C\u6210 \xB7 ${REVIEW_HISTORY_LABELS[outcome]}`;
      const dueLabel = progress2?.review.dueAt === null || progress2?.review.dueAt === void 0 ? "\u6682\u65E0\u590D\u4E60\u5B89\u6392" : "\u5F85\u590D\u4E60";
      const reviewTone2 = outcome === "needs_support" ? "attention" : progress2?.review.dueAt ? "info" : "neutral";
      return {
        conceptId,
        title: concept2?.title ?? conceptId,
        learning: { state: learningState, label: LEARNING_LABELS[learningState], tone: learningTone2(learningState) },
        understanding: {
          state: understandingState,
          label: understandingText,
          tone: understandingTone2(understandingState),
          validity,
          validityLabel,
          strongClaimAllowed: !candidate,
          candidateDisabled
        },
        review: {
          historyLabel,
          dueLabel,
          activeLabel: progress2?.review.activeSessionId ? "\u590D\u4E60\u8FDB\u884C\u4E2D" : null,
          tone: reviewTone2
        },
        selfReportLabel: selfReport === null ? null : `\u4F60\u7684\u81EA\u8BC4\uFF1A${SELF_REPORT_LABELS[selfReport.claimedState]}\uFF08\u5B66\u751F\u81EA\u8FF0\uFF0C\u4E0D\u7B97\u8BC1\u636E\uFF09`,
        evidenceCount: evidence2.length,
        currentIndependentEvidenceCount: evidence2.filter(
          (entry) => entry.assistance === "unassisted" && entry.validity === "current"
        ).length,
        needsAttention: understandingState === "needs_support" || understandingState === "unassessed" && learningState !== "not_started"
      };
    }
    function matchesStateFilter(summary, filter) {
      if (filter === "all") return true;
      if (filter === "needs_support") return summary.understanding.state === "needs_support";
      if (filter === "unassessed") return summary.understanding.state === "unassessed";
      return summary.review.dueLabel === "\u5F85\u590D\u4E60";
    }
    function aggregateMapSummary(payload) {
      const formal = payload.concepts.filter((concept2) => concept2.reviewState !== "candidate");
      const candidateTotal = payload.concepts.length - formal.length;
      const progressByConcept = new Map(
        payload.progress.map((entry) => [entry.conceptId, entry])
      );
      let learned = 0;
      let due = 0;
      let needsSupport = 0;
      let unassessed = 0;
      for (const concept2 of formal) {
        const progress2 = progressByConcept.get(concept2.id);
        const summary = summarizeConceptState(payload, concept2.id);
        if (progress2?.learning.state === "completed") learned += 1;
        if (progress2?.review.dueAt !== null && progress2?.review.dueAt !== void 0) due += 1;
        if (summary.understanding.state === "needs_support") needsSupport += 1;
        if (summary.understanding.state === "unassessed") unassessed += 1;
      }
      const formalTotal = payload.trustMode === "candidate" ? 0 : formal.length;
      const formalLearned = payload.trustMode === "candidate" ? 0 : learned;
      return {
        formalTotal,
        learned: formalLearned,
        due: payload.trustMode === "candidate" ? 0 : due,
        needsSupport: payload.trustMode === "candidate" ? 0 : needsSupport,
        unassessed: payload.trustMode === "candidate" ? 0 : unassessed,
        candidateTotal: payload.trustMode === "candidate" ? payload.concepts.length : candidateTotal,
        activityCoverageLabel: `\u6D3B\u52A8\u8986\u76D6\uFF08\u6309\u53BB\u91CD\u6982\u5FF5\u8BA1\u6570\uFF09\uFF1A\u5DF2\u5B66 ${formalLearned} / \u53EF\u5B66\u4E60 ${formalTotal}`
      };
    }
    function layoutGraph(slice, visibleConceptIds, centerConceptId) {
      const visible = new Set(visibleConceptIds);
      const adjacency = /* @__PURE__ */ new Map();
      for (const relation2 of slice.relations) {
        if (!visible.has(relation2.fromConceptId) || !visible.has(relation2.toConceptId)) continue;
        const left = adjacency.get(relation2.fromConceptId) ?? [];
        left.push(relation2.toConceptId);
        adjacency.set(relation2.fromConceptId, left);
        const right = adjacency.get(relation2.toConceptId) ?? [];
        right.push(relation2.fromConceptId);
        adjacency.set(relation2.toConceptId, right);
      }
      const layer = /* @__PURE__ */ new Map();
      const center = centerConceptId !== null && visible.has(centerConceptId) ? centerConceptId : visibleConceptIds[0] ?? null;
      if (center !== null) {
        layer.set(center, 0);
        let frontier = [center];
        let depth = 0;
        while (frontier.length > 0 && depth < 8) {
          depth += 1;
          const next = [];
          for (const current of [...frontier].sort()) {
            for (const neighbor of adjacency.get(current) ?? []) {
              if (layer.has(neighbor)) continue;
              layer.set(neighbor, depth);
              next.push(neighbor);
            }
          }
          frontier = next.sort();
        }
      }
      let maxLayer = 0;
      for (const entry of visibleConceptIds) {
        if (!layer.has(entry)) layer.set(entry, 0);
        maxLayer = Math.max(maxLayer, layer.get(entry) ?? 0);
      }
      const byLayer = /* @__PURE__ */ new Map();
      for (const entry of [...visibleConceptIds].sort()) {
        const value = layer.get(entry) ?? 0;
        const list = byLayer.get(value) ?? [];
        list.push(entry);
        byLayer.set(value, list);
      }
      const positions = /* @__PURE__ */ new Map();
      let rows = 0;
      for (const [col, ids] of [...byLayer.entries()].sort((left, right) => left[0] - right[0])) {
        ids.forEach((id, row) => positions.set(id, { col, row }));
        rows = Math.max(rows, ids.length);
      }
      return {
        positions,
        columns: Math.max(1, maxLayer + 1),
        rows: Math.max(1, rows),
        centerConceptId: center
      };
    }
    function filterGraphSlice(slice, conceptIds) {
      const visible = new Set(conceptIds);
      return {
        concepts: slice.concepts.filter((concept2) => visible.has(concept2.id)),
        relations: slice.relations.filter(
          (relation2) => visible.has(relation2.fromConceptId) && visible.has(relation2.toConceptId)
        )
      };
    }
    
    // education/client/map/src/views.ts
    var RELATION_TYPE_LABELS = {
      prerequisite: "\u5148\u4FEE",
      related: "\u76F8\u5173"
    };
    var RELATION_BASIS_LABELS = {
      explicit_source: "\u6559\u6750\u660E\u793A",
      pedagogical_inference: "\u6559\u5B66\u63A8\u65AD\uFF08\u975E\u6559\u6750\u539F\u6587\uFF09"
    };
    var RELATION_DIRECTION_LABELS = {
      prerequisite: "\u8D77\u70B9 \u2192 \u7EC8\u70B9\uFF08\u5EFA\u8BAE\u5148\u7406\u89E3\u8D77\u70B9\uFF09",
      related: "\u8D77\u70B9 \u2194 \u7EC8\u70B9\uFF08\u65E0\u5148\u540E\uFF09"
    };
    var TRUST_TONE = {
      published: "neutral",
      candidate: "attention"
    };
    function renderFixtureNotice(payload) {
      if (!payload.fixture) return null;
      return h(
        "div",
        {
          class: "edu-map-fixture",
          role: "note",
          "data-testid": "map-fixture-notice",
          "data-edu-fixture": "true"
        },
        h("strong", {}, "\u6F14\u793A\u6570\u636E\uFF08fixture\uFF09"),
        h("span", {}, payload.notice ?? "\u5F53\u524D\u5730\u56FE\u4E0D\u662F\u771F\u5B9E\u6559\u6750\u6216\u771F\u5B9E API \u7ED3\u679C\u3002")
      );
    }
    function renderPackBadges(payload) {
      const holder = h("div", { class: "edu-map-badges", "data-testid": "map-pack-badges" });
      holder.append(
        statusChip(
          payload.trustMode === "candidate" ? "\u5019\u9009\u5185\u5BB9\uFF08\u672A\u6838\u5B9E\uFF09" : "\u5DF2\u5BA1\u6838\u5185\u5BB9\u5305",
          TRUST_TONE[payload.trustMode],
          { testId: "map-trust-badge" }
        )
      );
      if (payload.scope === "partial") {
        holder.append(
          statusChip("\u90E8\u5206\u5185\u5BB9\uFF08\u672A\u8986\u76D6\u5168\u518C\uFF09", "attention", { testId: "map-scope-badge" })
        );
      } else {
        holder.append(statusChip("\u5168\u518C\u8303\u56F4", "neutral", { testId: "map-scope-badge" }));
      }
      if (payload.trustMode === "candidate") {
        holder.append(
          h(
            "p",
            { class: "edu-map-candidate-banner", role: "status", "data-testid": "map-candidate-banner" },
            "\u5019\u9009\u5185\u5BB9\uFF1A\u53EF\u7528\u4E8E\u663E\u5F0F\u8BD5\u7528\uFF1B\u7406\u89E3\u72B6\u6001\u56FA\u5B9A\u4E3A\u201C\u5C1A\u65E0\u8DB3\u591F\u8BC1\u636E\u201D\uFF0C\u4E0D\u4F1A\u663E\u793A\u5F3A\u7ED3\u8BBA\u3002"
          )
        );
      }
      return holder;
    }
    function renderSummaryBar(payload, aggregate) {
      return h(
        "div",
        { class: "edu-map-summary", "data-testid": "map-summary" },
        h("p", { class: "edu-map-summary__line" }, aggregate.activityCoverageLabel),
        h(
          "p",
          { class: "edu-map-summary__line" },
          `\u5F85\u590D\u4E60 ${aggregate.due} \xB7 \u7406\u89E3\u9700\u5DE9\u56FA ${aggregate.needsSupport} \xB7 \u5C1A\u65E0\u8DB3\u591F\u8BC1\u636E ${aggregate.unassessed}`
        ),
        aggregate.candidateTotal > 0 ? h(
          "p",
          { class: "edu-map-summary__line" },
          `\u5019\u9009\u6982\u5FF5 ${aggregate.candidateTotal} \u4E2A\uFF08\u5355\u5217\uFF0C\u4E0D\u8FDB\u5165\u6B63\u5F0F\u5206\u6BCD\uFF09`
        ) : null
      );
    }
    function renderViewTabs(active, actions) {
      const holder = h("div", {
        class: "edu-map-tabs",
        role: "group",
        "aria-label": "\u5730\u56FE\u89C6\u56FE\u5207\u6362",
        "data-testid": "map-view-tabs"
      });
      for (const mode of ["graph", "relations", "concepts"]) {
        const selected = mode === active;
        const element = h(
          "button",
          {
            type: "button",
            class: "edu-map-tab",
            "aria-pressed": selected ? "true" : "false",
            "data-view-mode": mode,
            onclick: () => actions.setViewMode(mode)
          },
          VIEW_MODE_LABELS[mode]
        );
        holder.append(element);
      }
      return holder;
    }
    function renderFilterBar(active, actions) {
      const holder = h("div", {
        class: "edu-map-filters",
        role: "group",
        "aria-label": "\u6982\u5FF5\u7B5B\u9009",
        "data-testid": "map-filters"
      });
      holder.append(h("span", { class: "edu-map-filters__label" }, "\u7B5B\u9009\uFF1A"));
      for (const filter of ["all", "needs_support", "due", "unassessed"]) {
        holder.append(
          h(
            "button",
            {
              type: "button",
              class: "edu-map-filter",
              "aria-pressed": filter === active ? "true" : "false",
              "data-filter": filter,
              onclick: () => actions.setFilter(filter)
            },
            FILTER_LABELS[filter]
          )
        );
      }
      return holder;
    }
    function renderTree(rows, selectedNodeId, focusId, actions) {
      const tree = h("ul", {
        role: "tree",
        class: "edu-map-tree",
        "aria-label": "\u6559\u6750\u76EE\u5F55",
        "data-testid": "map-tree"
      });
      for (const row of rows) {
        const selected = row.node.id === selectedNodeId;
        const focusable = row.node.id === (focusId ?? rows[0]?.node.id ?? "");
        const label = `${row.node.title}\uFF0C${row.conceptCount} \u4E2A\u6982\u5FF5\uFF0C\u5DF2\u5B66 ${row.learnedCount}`;
        const item = h(
          "li",
          {
            role: "treeitem",
            "aria-level": row.depth + 1,
            "aria-selected": selected ? "true" : "false",
            "aria-expanded": row.hasChildren ? row.expanded ? "true" : "false" : void 0,
            "data-toc-id": row.node.id,
            "data-node-type": row.node.type,
            "data-toc-focus": focusable ? "true" : void 0,
            tabindex: focusable ? 0 : -1,
            class: `edu-map-tree__item${selected ? " is-selected" : ""}`,
            onclick: () => actions.selectNode(row.node.id)
          },
          h(
            "span",
            { class: "edu-map-tree__row" },
            h(
              "button",
              {
                type: "button",
                class: "edu-map-tree__toggle",
                tabindex: -1,
                "aria-label": row.hasChildren ? `${row.expanded ? "\u6536\u8D77" : "\u5C55\u5F00"}${row.node.title}` : `${row.node.title} \u6CA1\u6709\u5B50\u76EE\u5F55`,
                "aria-hidden": row.hasChildren ? void 0 : "true",
                "data-toggle-toc": row.hasChildren ? row.node.id : void 0,
                onclick: (event) => {
                  event.stopPropagation();
                  if (row.hasChildren) actions.toggleNode(row.node.id);
                }
              },
              row.hasChildren ? row.expanded ? "\u25BE" : "\u25B8" : "\xB7"
            ),
            h("span", { class: "edu-map-tree__title" }, row.node.title),
            h("span", { class: "edu-map-tree__counts" }, `${row.conceptCount} \u6982\u5FF5 \xB7 \u5DF2\u5B66 ${row.learnedCount}`),
            row.dueCount > 0 ? statusChip(`\u5F85\u590D\u4E60 ${row.dueCount}`, "info", { detail: "\u8BE5\u8303\u56F4\u5185\u7684\u590D\u4E60\u5B89\u6392" }) : null,
            row.needsSupportCount > 0 ? statusChip(`\u9700\u5DE9\u56FA ${row.needsSupportCount}`, "attention", { detail: "\u8BE5\u8303\u56F4\u5185\u7684\u7406\u89E3\u72B6\u6001" }) : null
          )
        );
        item.dataset["label"] = label;
        tree.append(item);
      }
      return tree;
    }
    function renderTreeHelp() {
      return h(
        "p",
        { class: "edu-map-help", "data-testid": "map-tree-help" },
        "\u952E\u76D8\uFF1A\u2191/\u2193 \u5728\u76EE\u5F55\u9879\u95F4\u79FB\u52A8\uFF0C\u2192 \u5C55\u5F00\u6216\u8FDB\u5165\u5B50\u76EE\u5F55\uFF0C\u2190 \u6536\u8D77\u6216\u56DE\u5230\u4E0A\u7EA7\uFF0CEnter/\u7A7A\u683C \u9009\u62E9\u8303\u56F4\u3002"
      );
    }
    var NODE_W = 1100;
    var NODE_H = 550;
    var PITCH_X = 1250;
    var PITCH_Y = 650;
    var UNITS_PER_REM = 100;
    function nodeCenter(position) {
      return {
        x: position.col * PITCH_X + NODE_W / 2,
        y: position.row * PITCH_Y + NODE_H / 2
      };
    }
    function renderEdge(relation2, from, to) {
      const start = nodeCenter(from);
      const end = nodeCenter(to);
      const dx = end.x - start.x;
      const dy = end.y - start.y;
      const length = Math.sqrt(dx * dx + dy * dy);
      const angle = Math.atan2(dy, dx) * 180 / Math.PI;
      return h("div", {
        class: `edu-map-edge edu-map-edge--${relation2.type}`,
        "data-edge-type": relation2.type,
        "data-relation-id": relation2.id,
        "aria-hidden": "true",
        style: `left:${start.x / UNITS_PER_REM}rem;top:${start.y / UNITS_PER_REM}rem;width:${length / UNITS_PER_REM}rem;transform:rotate(${angle}deg)`
      });
    }
    function renderGraphLegend(externalCount) {
      return h(
        "ul",
        { class: "edu-map-legend", "data-testid": "map-graph-legend", "aria-label": "\u5173\u7CFB\u56FE\u56FE\u4F8B" },
        h(
          "li",
          { class: "edu-map-legend__item", "data-legend": "prerequisite" },
          h("span", { class: "edu-map-legend__line edu-map-legend__line--prerequisite", "aria-hidden": "true" }),
          "\u5148\u4FEE\uFF08\u5B9E\u7EBF\u7BAD\u5934\uFF09\uFF1A\u5EFA\u8BAE\u5148\u7406\u89E3\u8D77\u70B9\u518D\u5B66\u7EC8\u70B9\uFF0C\u4E0D\u963B\u65AD\u8FDB\u5165\u3002"
        ),
        h(
          "li",
          { class: "edu-map-legend__item", "data-legend": "related" },
          h("span", { class: "edu-map-legend__line edu-map-legend__line--related", "aria-hidden": "true" }),
          "\u76F8\u5173\uFF08\u865A\u7EBF\uFF09\uFF1A\u53EA\u6709\u5173\u8054\uFF0C\u6CA1\u6709\u5148\u540E\u8981\u6C42\u3002"
        ),
        h(
          "li",
          { class: "edu-map-legend__item", "data-legend": "external" },
          externalCount > 0 ? `\u8DE8\u7AE0\u8282\u70B9 ${externalCount} \u4E2A\uFF1A\u865A\u7EBF\u6846\u663E\u793A\u5728\u201C\u8DE8\u7AE0\u5173\u8054\u201D\u4E2D\uFF0C\u53EF\u663E\u5F0F\u5C55\u5F00\u3002` : "\u8DE8\u7AE0\u8282\u70B9\uFF1A\u5F53\u524D\u8303\u56F4\u6CA1\u6709\u8DE8\u7AE0\u5173\u7CFB\u3002"
        )
      );
    }
    function renderGraph(slice, payload, visibleConceptIds, actions) {
      const layout = layoutGraph(slice, visibleConceptIds, slice.centerConceptId);
      const filtered = filterGraphSlice(slice, visibleConceptIds);
      const widthRem = layout.columns * PITCH_X / UNITS_PER_REM;
      const heightRem = layout.rows * PITCH_Y / UNITS_PER_REM;
      const canvas = h("div", {
        class: "edu-map-canvas",
        "data-testid": "map-graph-canvas",
        "data-node-count": String(filtered.concepts.length),
        "data-edge-count": String(filtered.relations.length),
        style: `width:${widthRem}rem;height:${heightRem}rem`
      });
      const edgeLayer = h("div", {
        class: "edu-map-canvas__edges",
        "aria-hidden": "true",
        "data-testid": "map-graph-edges"
      });
      for (const relation2 of filtered.relations) {
        const from = layout.positions.get(relation2.fromConceptId);
        const to = layout.positions.get(relation2.toConceptId);
        if (from === void 0 || to === void 0) continue;
        edgeLayer.append(renderEdge(relation2, from, to));
      }
      canvas.append(edgeLayer);
      for (const concept2 of filtered.concepts) {
        const position = layout.positions.get(concept2.id);
        if (position === void 0) continue;
        const summary = summarize(payload, concept2.id);
        const selected = concept2.id === slice.centerConceptId;
        canvas.append(
          h(
            "button",
            {
              type: "button",
              class: `edu-map-node${selected ? " is-center" : ""}`,
              "data-concept-id": concept2.id,
              "data-understanding": summary.understanding.state,
              style: `left:${position.col * PITCH_X / UNITS_PER_REM}rem;top:${position.row * PITCH_Y / UNITS_PER_REM}rem`,
              "aria-label": `${concept2.title}\u3002\u5B66\u4E60\u8FDB\u7A0B\uFF1A${summary.learning.label}\u3002\u7406\u89E3\u8BC1\u636E\uFF1A${summary.understanding.label}\u3002\u590D\u4E60\uFF1A${summary.review.historyLabel}\uFF0C${summary.review.dueLabel}\u3002`,
              onclick: () => actions.selectConcept(concept2.id)
            },
            h("span", { class: "edu-map-node__title" }, concept2.title),
            h("span", { class: "edu-map-node__state" }, `${summary.learning.label} \xB7 ${summary.understanding.label}`),
            summary.review.dueLabel === "\u5F85\u590D\u4E60" ? h("span", { class: "edu-map-node__due" }, "\u5F85\u590D\u4E60") : null
          )
        );
      }
      return h(
        "div",
        { class: "edu-map-graph", "data-testid": "map-graph" },
        renderGraphLegend(slice.externalConcepts.length),
        h("div", { class: "edu-map-canvas__scroll" }, canvas),
        h(
          "p",
          { class: "edu-map-help" },
          "\u56FE\u7684\u952E\u76D8\u8DEF\u5F84\uFF1ATab \u5728\u8282\u70B9\u95F4\u79FB\u52A8\uFF0CEnter/\u7A7A\u683C \u9009\u62E9\u6982\u5FF5\uFF1B\u6BCF\u79CD\u7EBF\u578B\u5728\u201C\u5173\u7CFB\u5217\u8868\u201D\u4E2D\u90FD\u6709\u540C\u7B49\u7684\u6587\u5B57\u8BB0\u5F55\u3002"
        )
      );
    }
    function summarize(payload, conceptId) {
      return summarizeConceptState(payload, conceptId);
    }
    function relationEndpoints(payload, relation2) {
      const title = (conceptId) => payload.concepts.find((entry) => entry.id === conceptId)?.title ?? conceptId;
      return { from: title(relation2.fromConceptId), to: title(relation2.toConceptId) };
    }
    function sourceLabel(payload, sourceRefId) {
      const source = payload.sources.find((entry) => entry.sourceRefId === sourceRefId);
      return source?.label ?? `\u51FA\u5904 ${sourceRefId}\uFF08\u672A\u5728\u672C\u673A\u6838\u5B9E\uFF09`;
    }
    function renderRelationList(slice, payload, visibleConceptIds, actions) {
      const filtered = filterGraphSlice(slice, visibleConceptIds);
      const table = h(
        "table",
        { class: "edu-map-relations", "data-testid": "map-relation-list" },
        h("caption", { class: "edu-map-relations__caption" }, "\u5F53\u524D\u8303\u56F4\u7684\u5173\u7CFB\uFF08\u6587\u5B57\u66FF\u4EE3\uFF0C\u4E0E\u5173\u7CFB\u56FE\u7B49\u4EF7\uFF09")
      );
      const head = h("tr");
      for (const label of ["\u8D77\u70B9", "\u5173\u7CFB", "\u65B9\u5411", "\u7EC8\u70B9", "\u4F9D\u636E", "\u7406\u7531", "\u51FA\u5904"]) {
        head.append(h("th", { scope: "col" }, label));
      }
      table.append(h("thead", {}, head));
      const body = h("tbody");
      if (filtered.relations.length === 0) {
        body.append(
          h(
            "tr",
            {},
            h(
              "td",
              { colspan: 7 },
              visibleConceptIds.length === 0 ? "\u5F53\u524D\u7B5B\u9009\u6CA1\u6709\u53EF\u9009\u62E9\u7684\u6982\u5FF5\uFF1B\u6E05\u9664\u7B5B\u9009\u540E\u53EF\u67E5\u770B\u5173\u7CFB\u3002" : "\u5F53\u524D\u8303\u56F4\u5C1A\u672A\u5EFA\u7ACB\u6709\u4F9D\u636E\u7684\u5173\u7CFB\uFF0C\u4FDD\u7559\u76EE\u5F55\u4E0E\u6982\u5FF5\u5217\u8868\uFF0C\u4E0D\u5408\u6210\u4F9D\u8D56\u3002"
            )
          )
        );
      }
      for (const relation2 of filtered.relations) {
        const { from, to } = relationEndpoints(payload, relation2);
        const row = h(
          "tr",
          { "data-relation-id": relation2.id, "data-edge-type": relation2.type },
          h(
            "td",
            {},
            h(
              "button",
              {
                type: "button",
                class: "edu-map-link",
                onclick: () => actions.selectConcept(relation2.fromConceptId)
              },
              from
            )
          ),
          h("td", { "data-relation-type": relation2.type }, RELATION_TYPE_LABELS[relation2.type]),
          h("td", {}, RELATION_DIRECTION_LABELS[relation2.type]),
          h(
            "td",
            {},
            h(
              "button",
              {
                type: "button",
                class: "edu-map-link",
                onclick: () => actions.selectConcept(relation2.toConceptId)
              },
              to
            )
          ),
          h("td", { "data-relation-basis": relation2.basis }, RELATION_BASIS_LABELS[relation2.basis]),
          h("td", { class: "edu-map-relations__rationale" }, relation2.rationale),
          h(
            "td",
            {},
            relation2.sourceRefs.length === 0 ? "\u6559\u5B66\u63A8\u65AD\uFF08\u65E0\u6559\u6750\u51FA\u5904\uFF09" : relation2.sourceRefs.map((sourceRefId) => sourceLabel(payload, sourceRefId)).join("\uFF1B")
          )
        );
        body.append(row);
      }
      table.append(body);
      return h(
        "div",
        { class: "edu-map-relations-wrap" },
        table,
        h(
          "p",
          { class: "edu-map-help" },
          "\u201C\u5148\u4FEE\u201D\u662F\u5EFA\u8BAE\u800C\u975E\u9501\uFF1A\u5373\u4F7F\u5148\u4FEE\u6982\u5FF5\u5C1A\u672A\u5B66\u4E60\uFF0C\u4E5F\u53EF\u4EE5\u76F4\u63A5\u8FDB\u5165\u7EC8\u70B9\u6982\u5FF5\u3002"
        )
      );
    }
    function renderConceptList(concepts, payload, filter, actions) {
      const list = h("ul", { class: "edu-map-concept-list", "data-testid": "map-concept-list" });
      if (concepts.length === 0) {
        return h(
          "div",
          { class: "edu-map-empty", "data-testid": "map-concept-list-empty" },
          h("p", {}, filter === "all" ? "\u5F53\u524D\u8303\u56F4\u6CA1\u6709\u53EF\u663E\u793A\u7684\u6982\u5FF5\u3002" : "\u5F53\u524D\u7B5B\u9009\u6CA1\u6709\u5339\u914D\u7684\u6982\u5FF5\u3002"),
          filter === "all" ? null : button("\u6E05\u9664\u7B5B\u9009", actions.clearFilter, { tone: "primary", dataAction: "clear-filter" })
        );
      }
      for (const concept2 of concepts) {
        const summary = summarizeConceptState(payload, concept2.id);
        list.append(
          h(
            "li",
            { class: "edu-map-concept-list__item", "data-concept-id": concept2.id },
            h(
              "button",
              {
                type: "button",
                class: "edu-map-concept-list__button",
                onclick: () => actions.selectConcept(concept2.id)
              },
              h("span", { class: "edu-map-concept-list__title" }, concept2.title),
              h(
                "span",
                { class: "edu-map-concept-list__states" },
                statusChip(summary.learning.label, summary.learning.tone),
                statusChip(summary.understanding.label, summary.understanding.tone),
                statusChip(summary.review.historyLabel, summary.review.tone),
                summary.review.dueLabel === "\u5F85\u590D\u4E60" ? statusChip("\u5F85\u590D\u4E60", "info") : null,
                summary.selfReportLabel !== null ? statusChip("\u542B\u81EA\u8BC4", "neutral") : null
              )
            )
          )
        );
      }
      return h(
        "div",
        {},
        h(
          "p",
          { class: "edu-map-help" },
          `\u672C\u7AE0\u5171 ${concepts.length} \u4E2A\u53BB\u91CD\u6982\u5FF5\uFF1B\u540C\u6982\u5FF5\u591A\u8282\u53EA\u8BA1\u4E00\u6B21\u3002`
        ),
        list
      );
    }
    function renderStateChipRow(summary) {
      const row = h("div", { class: "edu-map-detail__states", "data-testid": "map-detail-states" });
      appendChildren(row, [
        h("span", { class: "edu-map-detail__axis" }, "\u5B66\u4E60\u8FDB\u7A0B\uFF1A"),
        statusChip(summary.learning.label, summary.learning.tone, { testId: "detail-learning" }),
        h("span", { class: "edu-map-detail__axis" }, "\u7406\u89E3\u8BC1\u636E\uFF1A"),
        statusChip(summary.understanding.label, summary.understanding.tone, { testId: "detail-understanding" }),
        h("span", { class: "edu-map-detail__axis" }, "\u590D\u4E60\uFF1A"),
        statusChip(summary.review.historyLabel, summary.review.tone, { testId: "detail-review-history" }),
        statusChip(summary.review.dueLabel, summary.review.dueLabel === "\u5F85\u590D\u4E60" ? "info" : "neutral", {
          testId: "detail-review-due"
        }),
        summary.review.activeLabel !== null ? statusChip(summary.review.activeLabel, "progress", { testId: "detail-review-active" }) : null
      ]);
      return row;
    }
    function renderDetail(detail, payload, actions) {
      const summary = summarizeConceptState(payload, detail.concept.id);
      const root = h("article", {
        class: "edu-map-detail",
        "aria-label": "\u6982\u5FF5\u8BE6\u60C5",
        "data-testid": "map-detail",
        "data-concept-id": detail.concept.id
      });
      appendChildren(root, [
        h("h2", { class: "edu-map-detail__title", tabindex: -1 }, detail.concept.title),
        detail.concept.aliases.length > 0 ? h("p", { class: "edu-map-detail__meta" }, `\u522B\u540D\uFF1A${detail.concept.aliases.join("\u3001")}`) : null,
        h(
          "p",
          { class: "edu-map-detail__meta" },
          `\u76EE\u5F55\u4F4D\u7F6E\uFF1A${detail.placements.map((placement) => placement.path.join(" \u203A ")).join("\uFF1B")}`
        ),
        renderStateChipRow(summary),
        summary.selfReportLabel !== null ? h(
          "p",
          { class: "edu-map-detail__self", "data-testid": "map-detail-self-report" },
          summary.selfReportLabel
        ) : h(
          "p",
          { class: "edu-map-detail__meta" },
          "\u81EA\u8BC4\uFF1A\u5C1A\u672A\u586B\u5199\uFF08\u81EA\u8BC4\u662F\u5B66\u751F\u89C2\u70B9\uFF0C\u4E0E\u7CFB\u7EDF\u8BC1\u636E\u5206\u5F00\u663E\u793A\uFF09"
        ),
        h(
          "p",
          { class: "edu-map-detail__meta", "data-testid": "map-detail-evidence" },
          summary.evidenceCount === 0 ? "\u8BC1\u636E\uFF1A\u8FD8\u6CA1\u6709\u53EF\u89C1\u8BC1\u636E\u3002" : `\u8BC1\u636E\uFF1A\u5171 ${summary.evidenceCount} \u6761\uFF0C\u5176\u4E2D\u5F53\u524D\u6709\u6548\u7684\u72EC\u7ACB\u8BC1\u636E ${summary.currentIndependentEvidenceCount} \u6761\u3002`
        )
      ]);
      if (summary.understanding.candidateDisabled) {
        root.append(
          h(
            "p",
            { class: "edu-map-notice", role: "status", "data-testid": "map-candidate-claim-warning" },
            "\u5019\u9009\u5185\u5BB9\uFF1A\u5373\u4F7F\u672C\u5730\u8BB0\u5F55\u91CC\u6709\u7406\u89E3\u5224\u65AD\uFF0C\u4E5F\u53EA\u663E\u793A\u201C\u5C1A\u65E0\u8DB3\u591F\u8BC1\u636E\u201D\uFF0C\u4E0D\u663E\u793A\u5F3A\u7ED3\u8BBA\u3002"
          )
        );
      }
      const prerequisites = detail.prerequisites.map((relation2) => {
        const source = payload.concepts.find((entry) => entry.id === relation2.fromConceptId) ?? null;
        const progress2 = payload.progress.find((entry) => entry.conceptId === relation2.fromConceptId) ?? null;
        return { relation: relation2, source, learned: progress2?.learning.state === "completed" };
      });
      if (prerequisites.length > 0) {
        const pending = prerequisites.filter((entry) => !entry.learned);
        const block = h("section", {
          class: "edu-map-detail__section",
          "data-testid": "map-detail-prerequisites"
        });
        block.append(
          h("h3", {}, pending.length > 0 ? "\u5EFA\u8BAE\u5148\u5B66\uFF08\u4E0D\u963B\u65AD\u8FDB\u5165\uFF09" : "\u5148\u4FEE\u5DF2\u5B66"),
          ...prerequisites.map(
            (entry) => h(
              "div",
              {
                class: `edu-map-prereq${entry.learned ? " is-learned" : ""}`,
                "data-prereq-id": entry.relation.fromConceptId,
                "data-prereq-learned": entry.learned ? "true" : "false"
              },
              h(
                "p",
                { class: "edu-map-prereq__title" },
                entry.learned ? `\u2713 \u5DF2\u5B66\uFF1A${entry.source?.title ?? entry.relation.fromConceptId}` : `\u5EFA\u8BAE\u5148\u5B66\uFF1A${entry.source?.title ?? entry.relation.fromConceptId}`
              ),
              h(
                "p",
                { class: "edu-map-prereq__meta" },
                `${RELATION_TYPE_LABELS[entry.relation.type]} \xB7 ${RELATION_BASIS_LABELS[entry.relation.basis]} \xB7 \u7406\u7531\uFF1A${entry.relation.rationale}`
              ),
              h(
                "p",
                { class: "edu-map-prereq__meta" },
                entry.relation.sourceRefs.length === 0 ? "\u51FA\u5904\uFF1A\u6559\u5B66\u63A8\u65AD\uFF08\u65E0\u6559\u6750\u51FA\u5904\uFF09" : `\u51FA\u5904\uFF1A${entry.relation.sourceRefs.map((ref) => sourceLabel(payload, ref)).join("\uFF1B")}`
              ),
              entry.learned ? null : h(
                "div",
                { class: "edu-map-prereq__actions" },
                button(
                  `\u5148\u770B\u770B${entry.source?.title ?? ""}`,
                  () => actions.selectConcept(entry.relation.fromConceptId),
                  { dataAction: "look-first" }
                ),
                button("\u76F4\u63A5\u5B66\u4E60\u76EE\u6807\u6982\u5FF5", () => {
                  actions.navigate(`/workspace?concept=${detail.concept.id}&mode=learn`);
                }, { dataAction: "learn-target-anyway" })
              )
            )
          )
        );
        root.append(block);
      }
      const relations = h("section", {
        class: "edu-map-detail__section",
        "data-testid": "map-detail-relations"
      });
      relations.append(h("h3", {}, `\u5173\u7CFB\uFF08${detail.relations.length}\uFF09`));
      if (detail.relations.length === 0) {
        relations.append(h("p", { class: "edu-map-detail__meta" }, "\u6682\u672A\u5EFA\u7ACB\u5173\u7CFB\uFF1B\u4FDD\u7559\u76EE\u5F55\u5B9A\u4F4D\u3002"));
      }
      for (const relation2 of detail.relations) {
        const otherId = relation2.fromConceptId === detail.concept.id ? relation2.toConceptId : relation2.fromConceptId;
        const other = payload.concepts.find((entry) => entry.id === otherId);
        relations.append(
          h(
            "p",
            { class: "edu-map-detail__relation", "data-relation-id": relation2.id },
            `${RELATION_TYPE_LABELS[relation2.type]} \xB7 ${RELATION_BASIS_LABELS[relation2.basis]} \xB7 ${relation2.fromConceptId === detail.concept.id ? "\u6307\u5411" : "\u6765\u81EA"} ${other?.title ?? otherId} \xB7 \u7406\u7531\uFF1A${relation2.rationale}`
          )
        );
      }
      root.append(relations);
      const sources = h("section", {
        class: "edu-map-detail__section",
        "data-testid": "map-detail-sources"
      });
      sources.append(h("h3", {}, "\u51FA\u5904\u4E0E\u6750\u6599"));
      if (detail.sources.length === 0) {
        sources.append(h("p", {}, "\u8BE5\u6982\u5FF5\u8FD8\u6CA1\u6709\u767B\u8BB0\u51FA\u5904\u3002"));
      }
      for (const source of detail.sources) {
        sources.append(
          h(
            "p",
            { class: "edu-map-detail__source", "data-source-ref": source.sourceRefId },
            source.label,
            source.bookAvailable ? h("span", {}, " \xB7 \u6750\u6599\u5728\u672C\u673A\u53EF\u7528") : h("span", {}, " \xB7 \u6750\u6599\u4E0D\u53EF\u7528")
          )
        );
      }
      root.append(sources);
      root.append(
        h(
          "div",
          { class: "edu-map-detail__actions", "data-testid": "map-detail-actions" },
          button("\u5F00\u59CB\u5B66\u4E60", () => actions.navigate(`/workspace?concept=${detail.concept.id}&mode=learn`), {
            tone: "primary",
            dataAction: "start-learn"
          }),
          button("\u5F00\u59CB\u590D\u4E60", () => actions.navigate(`/workspace?concept=${detail.concept.id}&mode=review`), {
            dataAction: "start-review"
          }),
          button("\u67E5\u770B\u5173\u7CFB\u5217\u8868", () => actions.setViewMode("relations"), { dataAction: "show-relations" }),
          button("\u8FD4\u56DE\u76EE\u5F55\u8303\u56F4", () => {
            const placement = detail.placements[0];
            if (placement !== void 0) actions.selectNode(placement.tocNodeId);
          }, { dataAction: "back-to-scope" })
        )
      );
      return root;
    }
    function renderSearch(query, submitted, hits, error, actions) {
      const inputId = "edu-map-search-input";
      const form = h("form", {
        class: "edu-map-search",
        role: "search",
        "data-testid": "map-search",
        onsubmit: (event) => {
          event.preventDefault();
          actions.submitSearch();
        }
      });
      appendChildren(form, [
        h("label", { class: "edu-map-search__label", for: inputId }, "\u641C\u7D22\u6982\u5FF5\uFF08\u6807\u9898\u6216\u522B\u540D\uFF09"),
        h("input", {
          id: inputId,
          class: "edu-map-search__input",
          type: "search",
          value: query,
          autocomplete: "off",
          "data-testid": "map-search-input",
          oninput: (event) => actions.setQuery(event.target.value)
        }),
        button("\u641C\u7D22", () => actions.submitSearch(), { tone: "primary", dataAction: "search" }),
        submitted !== null ? button("\u6E05\u9664\u641C\u7D22", () => actions.clearSearch(), { dataAction: "clear-search" }) : null
      ]);
      const holder = h("div", { class: "edu-map-search-wrap" }, form);
      if (error !== null) holder.append(h("p", { class: "edu-map-notice", role: "alert" }, error));
      if (submitted !== null && hits !== null) {
        const results = h("ul", { class: "edu-map-search__results", "data-testid": "map-search-results" });
        if (hits.length === 0) {
          results.append(h("li", {}, `\u6CA1\u6709\u627E\u5230\u4E0E\u201C${submitted}\u201D\u5339\u914D\u7684\u6982\u5FF5\uFF1B\u53EF\u4EE5\u6E05\u9664\u641C\u7D22\u6216\u8C03\u6574\u5173\u952E\u8BCD\u3002`));
        }
        for (const hit of hits) {
          results.append(
            h(
              "li",
              { "data-concept-id": hit.conceptId },
              h(
                "button",
                {
                  type: "button",
                  class: "edu-map-link",
                  onclick: () => actions.selectConcept(hit.conceptId)
                },
                hit.title
              ),
              h("span", { class: "edu-map-search__meta" }, ` \xB7 ${hit.tocTitle ?? "\u76EE\u5F55\u4F4D\u7F6E\u672A\u77E5"} \xB7 \u547D\u4E2D${hit.matchedOn === "alias" ? "\u522B\u540D" : "\u6807\u9898"}\u201C${hit.matchedText}\u201D`)
            )
          );
        }
        holder.append(results);
      }
      return holder;
    }
    function renderRangeHeader(slice, payload, visibleConceptIds, actions) {
      const chapter = slice.scopeTocNodeId === null ? null : payload.toc.find((node) => node.id === slice.scopeTocNodeId) ?? null;
      const holder = h("div", { class: "edu-map-range", "data-testid": "map-range-header" });
      holder.append(
        h(
          "p",
          { class: "edu-map-range__title" },
          slice.scopeTocNodeId === null ? "\u5DF2\u5C55\u5F00\u8DE8\u7AE0\u5C40\u90E8\u90BB\u57DF\uFF08\u6709\u754C\uFF09" : `\u5F53\u524D\u8303\u56F4\uFF1A${chapter?.title ?? slice.scopeTocNodeId}`
        ),
        h(
          "p",
          { class: "edu-map-range__meta" },
          `\u663E\u793A ${visibleConceptIds.length} \u4E2A\u6982\u5FF5 \xB7 ${slice.stats.maxDepth} \u5C42\u5185 \xB7 \u540C\u6982\u5FF5\u591A\u8282\u53EA\u8BA1\u4E00\u6B21`
        )
      );
      if (slice.scopeTocNodeId === null) {
        holder.append(
          button("\u8FD4\u56DE\u672C\u7AE0\u8303\u56F4", () => actions.collapseExternal(), { dataAction: "collapse-external" })
        );
      } else if (slice.hiddenConceptCount > 0) {
        holder.append(
          h(
            "p",
            { class: "edu-map-range__meta", "data-testid": "map-hidden-count" },
            `\u672C\u7AE0\u8FD8\u6709 ${slice.hiddenConceptCount} \u4E2A\u6982\u5FF5\u672A\u663E\u793A\uFF08\u4E0D\u4F1A\u4E00\u6B21\u94FA\u6EE1\u5168\u518C\uFF09\u3002`
          ),
          button(`\u5C55\u5F00\u66F4\u591A\u6982\u5FF5\uFF08+12\uFF09`, () => actions.showMoreConcepts(), {
            dataAction: "show-more-concepts"
          })
        );
      }
      if (slice.externalConcepts.length > 0) {
        const external = h("div", {
          class: "edu-map-external",
          "data-testid": "map-external-concepts"
        });
        external.append(
          h("p", { class: "edu-map-external__title" }, `\u8DE8\u7AE0\u5173\u8054 ${slice.externalConcepts.length} \u4E2A\uFF08\u672A\u76F4\u63A5\u7ED8\u5236\uFF09`)
        );
        for (const concept2 of slice.externalConcepts) {
          external.append(
            h(
              "div",
              { class: "edu-map-external__item", "data-concept-id": concept2.id },
              h("span", {}, concept2.title),
              button("\u5C55\u5F00\u8DE8\u7AE0", () => actions.expandExternal(concept2.id), {
                small: true,
                dataAction: "expand-external"
              })
            )
          );
        }
        holder.append(external);
      }
      return holder;
    }
    
    // education/client/map/src/types.ts
    var MAP_NODE_CAP = 24;
    var MAP_DEPTH_CAP = 2;
    var MAP_EXPAND_NODE_CAP = 25;
    var MAP_EXPAND_DEPTH_CAP = 2;
    var MAP_PAGE_SIZE = 12;
    var MAP_SEARCH_LIMIT = 12;
    
    // education/client/map/src/controller.ts
    function nowMs() {
      const perf = globalThis.performance;
      if (perf !== void 0 && typeof perf.now === "function") return perf.now();
      return Date.now();
    }
    function round(value) {
      return Math.round(value * 1e3) / 1e3;
    }
    var MapController = class {
      dataSource;
      createRequest;
      pageSize;
      context = null;
      contentHost = null;
      detailsHost = null;
      payload = null;
      tocModel = null;
      loadState = "idle";
      error = null;
      expandedIds = /* @__PURE__ */ new Set();
      selectedNodeId = null;
      scopeChapterId = null;
      selectedConceptId = null;
      focusTocId = null;
      focusTocRequested = false;
      pendingConceptFocus = null;
      viewMode = "graph";
      filter = "all";
      query = "";
      submittedQuery = null;
      searchHits = null;
      searchError = null;
      chapterGraph = null;
      expandedSlice = null;
      visibleConceptCount = MAP_NODE_CAP;
      detail = null;
      detailError = null;
      loadPromise = null;
      disposed = false;
      keydownBound = false;
      actions;
      timings = {
        mapLoadMs: 0,
        firstRenderMs: 0,
        lastGraphLoadMs: 0,
        lastRenderMs: 0,
        chapterSwitchMs: null
      };
      constructor(options) {
        this.dataSource = options.dataSource;
        this.createRequest = options.createRequest;
        this.pageSize = options.pageSize ?? MAP_PAGE_SIZE;
        this.visibleConceptCount = MAP_NODE_CAP;
        this.actions = {
          selectNode: (nodeId) => void this.selectNode(nodeId),
          toggleNode: (nodeId) => this.toggleNode(nodeId),
          selectConcept: (conceptId) => void this.selectConcept(conceptId),
          setViewMode: (mode) => {
            this.viewMode = mode;
            this.render();
          },
          setFilter: (filter) => {
            this.filter = filter;
            this.render();
          },
          clearFilter: () => {
            this.filter = "all";
            this.render();
          },
          setQuery: (value) => {
            this.query = value;
          },
          submitSearch: () => void this.submitSearch(),
          clearSearch: () => {
            this.query = "";
            this.submittedQuery = null;
            this.searchHits = null;
            this.searchError = null;
            this.render();
          },
          showMoreConcepts: () => void this.showMoreConcepts(),
          expandExternal: (conceptId) => void this.expandExternal(conceptId),
          collapseExternal: () => {
            this.expandedSlice = null;
            this.render();
          },
          navigate: (path) => {
            if (this.context !== null) this.context.navigate(path);
          }
        };
      }
      getTimings() {
        return this.timings;
      }
      onPageMount(context) {
        this.context = context;
        this.disposed = false;
        void this.ensureLoaded();
      }
      onPageUnmount() {
        this.contentHost = null;
        this.detailsHost = null;
      }
      dispose() {
        this.disposed = true;
        this.contentHost = null;
        this.detailsHost = null;
      }
      mountContent(host) {
        this.contentHost = host;
        if (!this.keydownBound) {
          host.addEventListener("keydown", (event) => this.onTreeKeyDown(event));
          this.keydownBound = true;
        }
        void this.ensureLoaded();
        this.render();
      }
      unmountContent() {
        this.contentHost = null;
      }
      mountDetails(host) {
        this.detailsHost = host;
        void this.ensureLoaded();
        this.render();
      }
      unmountDetails() {
        this.detailsHost = null;
      }
      /* ----------------------------------------------------------- data loading */
      async ensureLoaded() {
        if (this.payload !== null || this.loadState === "loading") return;
        if (this.loadPromise !== null) return this.loadPromise;
        this.loadState = "loading";
        this.render();
        this.loadPromise = this.load();
        await this.loadPromise;
        this.loadPromise = null;
      }
      async load() {
        const started = nowMs();
        const result = await this.dataSource.loadMap(this.createRequest());
        if (this.disposed) return;
        if (!result.ok) {
          this.loadState = "error";
          this.error = result.error;
          this.render();
          return;
        }
        this.timings = { ...this.timings, mapLoadMs: round(nowMs() - started) };
        this.payload = result.data;
        this.tocModel = buildTocModel(result.data);
        this.loadState = "ready";
        this.error = null;
        this.selectInitialRange(result.data);
        await this.loadChapterGraph();
        const initialConceptId = result.data.initialConceptId;
        if (initialConceptId !== null) {
          this.selectedConceptId = initialConceptId;
          await this.loadDetail(initialConceptId);
        }
        const firstRender = nowMs();
        this.render();
        this.timings = { ...this.timings, firstRenderMs: round(nowMs() - firstRender) };
      }
      selectInitialRange(payload) {
        const model = this.tocModel;
        if (model === null) return;
        const chapterFromConcept = (() => {
          if (payload.initialConceptId === null) return null;
          const concept2 = payload.concepts.find((entry) => entry.id === payload.initialConceptId);
          if (concept2 === void 0) return null;
          const firstPlacement = concept2.placements[0];
          return firstPlacement === void 0 ? null : model.chapterOf(firstPlacement);
        })();
        const initialNode = chapterFromConcept ?? (payload.initialTocNodeId === null ? null : model.node(payload.initialTocNodeId)) ?? model.chapters()[0] ?? model.roots[0] ?? null;
        const chapter = initialNode === null ? null : model.chapterOf(initialNode.id) ?? initialNode;
        this.scopeChapterId = chapter?.id ?? null;
        this.selectedNodeId = chapter?.id ?? null;
        this.expandedIds = new Set(
          payload.toc.filter((node) => node.type === "volume" || node.type === "unit").map((node) => node.id)
        );
        for (const root of model.roots) this.expandedIds.add(root.id);
        if (chapter !== null) {
          for (const ancestorId of model.ancestorsOf(chapter.id)) this.expandedIds.add(ancestorId);
          this.expandedIds.add(chapter.id);
        }
        this.focusTocId = chapter?.id ?? null;
      }
      async loadChapterGraph() {
        const chapterId = this.scopeChapterId;
        if (chapterId === null) return;
        const started = nowMs();
        const result = await this.dataSource.loadChapterGraph(this.createRequest(), chapterId, {
          maxNodes: MAP_NODE_CAP * 4,
          maxDepth: MAP_DEPTH_CAP,
          visibleConceptCount: this.visibleConceptCount
        });
        if (this.disposed) return;
        this.timings = { ...this.timings, lastGraphLoadMs: round(nowMs() - started) };
        if (result.ok) {
          this.chapterGraph = result.data;
          this.expandedSlice = null;
        } else {
          this.chapterGraph = null;
          this.error = result.error;
        }
      }
      async loadDetail(conceptId) {
        const result = await this.dataSource.loadConceptDetail(this.createRequest(), conceptId);
        if (this.disposed) return;
        if (result.ok) {
          this.detail = result.data;
          this.detailError = null;
        } else {
          this.detail = null;
          this.detailError = result.error;
        }
      }
      /* -------------------------------------------------------------- commands */
      async selectNode(nodeId) {
        const model = this.tocModel;
        if (model === null || this.payload === null) return;
        const node = model.node(nodeId);
        if (node === void 0) return;
        this.selectedNodeId = nodeId;
        this.focusTocId = nodeId;
        this.focusTocRequested = true;
        const chapter = model.chapterOf(nodeId);
        if (chapter !== null) {
          if (!this.expandedIds.has(chapter.id)) this.expandedIds.add(chapter.id);
          for (const ancestorId of model.ancestorsOf(chapter.id)) this.expandedIds.add(ancestorId);
        }
        const nextScope = chapter?.id ?? nodeId;
        const changed = nextScope !== this.scopeChapterId;
        this.scopeChapterId = nextScope;
        if (changed) {
          this.selectedConceptId = null;
          this.detail = null;
          this.expandedSlice = null;
          this.visibleConceptCount = MAP_NODE_CAP;
          const started = nowMs();
          await this.loadChapterGraph();
          this.timings = { ...this.timings, chapterSwitchMs: round(nowMs() - started) };
        }
        this.render();
      }
      toggleNode(nodeId) {
        if (this.expandedIds.has(nodeId)) this.expandedIds.delete(nodeId);
        else this.expandedIds.add(nodeId);
        this.focusTocId = nodeId;
        this.focusTocRequested = true;
        this.render();
      }
      async selectConcept(conceptId) {
        const payload = this.payload;
        const model = this.tocModel;
        if (payload === null || model === null) return;
        const concept2 = payload.concepts.find((entry) => entry.id === conceptId);
        if (concept2 === void 0) return;
        this.selectedConceptId = conceptId;
        this.pendingConceptFocus = conceptId;
        this.viewMode = this.viewMode === "concepts" ? "concepts" : this.viewMode;
        const firstPlacement = concept2.placements[0];
        const chapter = firstPlacement === void 0 ? null : model.chapterOf(firstPlacement);
        if (chapter !== null && chapter.id !== this.scopeChapterId) {
          this.scopeChapterId = chapter.id;
          this.selectedNodeId = chapter.id;
          this.focusTocId = chapter.id;
          for (const ancestorId of model.ancestorsOf(chapter.id)) this.expandedIds.add(ancestorId);
          this.expandedIds.add(chapter.id);
          this.visibleConceptCount = Math.max(MAP_NODE_CAP, this.visibleConceptCount);
          const started = nowMs();
          await this.loadChapterGraph();
          this.timings = { ...this.timings, chapterSwitchMs: round(nowMs() - started) };
        }
        await this.loadDetail(conceptId);
        this.render();
      }
      async submitSearch() {
        const query = this.query.trim();
        this.submittedQuery = query;
        if (query.length === 0) {
          this.searchHits = null;
          this.searchError = null;
          this.render();
          return;
        }
        const result = await this.dataSource.searchConcepts(
          this.createRequest(),
          query,
          MAP_SEARCH_LIMIT
        );
        if (result.ok) {
          this.searchHits = result.data;
          this.searchError = null;
        } else {
          this.searchHits = null;
          this.searchError = result.error;
        }
        this.render();
      }
      async showMoreConcepts() {
        this.visibleConceptCount += this.pageSize;
        this.expandedSlice = null;
        await this.loadChapterGraph();
        this.render();
      }
      async expandExternal(conceptId) {
        const result = await this.dataSource.expandConcept(this.createRequest(), conceptId, {
          maxNodes: MAP_EXPAND_NODE_CAP,
          maxDepth: MAP_EXPAND_DEPTH_CAP
        });
        if (this.disposed) return;
        if (result.ok) {
          this.expandedSlice = result.data;
          this.selectedConceptId = conceptId;
          this.pendingConceptFocus = conceptId;
          await this.loadDetail(conceptId);
          this.render();
        }
      }
      retry() {
        this.payload = null;
        this.tocModel = null;
        this.loadState = "idle";
        this.error = null;
        this.chapterGraph = null;
        this.expandedSlice = null;
        this.detail = null;
        this.selectedConceptId = null;
        this.detailError = null;
        void this.ensureLoaded();
      }
      /* ------------------------------------------------------------- keyboard */
      onTreeKeyDown(event) {
        const keyboard = event;
        const target = keyboard.target;
        if (!(target instanceof HTMLElement)) return;
        const item = target.closest("[data-toc-id]");
        if (item === null) return;
        const model = this.tocModel;
        if (model === null) return;
        const rows = model.visibleRows(this.expandedIds);
        const index = rows.findIndex((row2) => row2.node.id === item.dataset["tocId"]);
        if (index < 0) return;
        const row = rows[index];
        if (row === void 0) return;
        const focusRow = (nextIndex) => {
          const next = rows[nextIndex];
          if (next === void 0) return;
          this.focusTocId = next.node.id;
          this.focusTocRequested = true;
          this.render();
        };
        switch (keyboard.key) {
          case "ArrowDown":
            keyboard.preventDefault();
            focusRow(Math.min(rows.length - 1, index + 1));
            break;
          case "ArrowUp":
            keyboard.preventDefault();
            focusRow(Math.max(0, index - 1));
            break;
          case "ArrowRight": {
            keyboard.preventDefault();
            if (row.hasChildren && !row.expanded) {
              this.expandedIds.add(row.node.id);
              this.focusTocId = row.node.id;
              this.focusTocRequested = true;
              this.render();
            } else if (row.hasChildren) {
              focusRow(index + 1);
            }
            break;
          }
          case "ArrowLeft": {
            keyboard.preventDefault();
            if (row.expanded && row.hasChildren) {
              this.expandedIds.delete(row.node.id);
              this.focusTocId = row.node.id;
              this.focusTocRequested = true;
              this.render();
            } else if (row.node.parentId !== null) {
              const parentIndex = rows.findIndex((entry) => entry.node.id === row.node.parentId);
              focusRow(parentIndex >= 0 ? parentIndex : index - 1);
            }
            break;
          }
          case "Home":
            keyboard.preventDefault();
            focusRow(0);
            break;
          case "End":
            keyboard.preventDefault();
            focusRow(rows.length - 1);
            break;
          case "Enter":
          case " ":
            keyboard.preventDefault();
            void this.selectNode(row.node.id);
            break;
          default:
            break;
        }
      }
      focusTocItem(nodeId) {
        if (this.contentHost === null) return;
        const element = this.contentHost.querySelector(`[data-toc-id="${nodeId}"]`);
        element?.focus();
      }
      focusConcept(conceptId) {
        for (const host of [this.contentHost, this.detailsHost]) {
          if (host === null) continue;
          const element = host.querySelector(`[data-concept-id="${conceptId}"]`);
          if (element !== null) {
            element.focus();
            return;
          }
        }
      }
      /* --------------------------------------------------------------- render */
      render() {
        if (this.disposed) return;
        const started = nowMs();
        if (this.contentHost !== null) this.renderContent(this.contentHost);
        if (this.detailsHost !== null) this.renderDetails(this.detailsHost);
        this.timings = { ...this.timings, lastRenderMs: round(nowMs() - started) };
        if (this.focusTocRequested && this.focusTocId !== null) {
          this.focusTocRequested = false;
          this.focusTocItem(this.focusTocId);
        }
        const conceptFocus = this.pendingConceptFocus;
        if (conceptFocus !== null) {
          this.pendingConceptFocus = null;
          this.focusConcept(conceptFocus);
        }
      }
      renderContent(host) {
        clear(host);
        if (this.loadState === "loading") {
          host.append(
            loadingState({
              title: "\u6B63\u5728\u6253\u5F00\u5F53\u524D\u6559\u6750\u7684\u5730\u56FE\u2026",
              body: "\u53EA\u8BFB\u53D6\u5DF2\u4FDD\u5B58\u7684\u76EE\u5F55\u3001\u6982\u5FF5\u4E0E\u72B6\u6001\uFF1B\u6D4F\u89C8\u4E0D\u4F1A\u6539\u53D8\u5B66\u4E60\u8FDB\u7A0B\u3002"
            })
          );
          return;
        }
        if (this.loadState === "error") {
          host.append(
            renderErrorBanner(this.error ?? { code: "STORAGE_FAILED", message: "\u5730\u56FE\u6682\u65F6\u65E0\u6CD5\u6253\u5F00", retryable: true }, {
              onRetry: () => this.retry(),
              onBack: () => this.actions.navigate("/library"),
              backLabel: "\u53BB\u6559\u6750\u5E93"
            })
          );
          return;
        }
        const payload = this.payload;
        const model = this.tocModel;
        if (payload === null || model === null) return;
        const fixture = renderFixtureNotice(payload);
        if (fixture !== null) host.append(fixture);
        host.append(renderPackBadges(payload));
        host.append(renderSummaryBar(payload, aggregateMapSummary(payload)));
        host.append(
          renderSearch(
            this.query,
            this.submittedQuery,
            this.searchHits,
            this.searchError?.code === void 0 ? null : "\u641C\u7D22\u6682\u65F6\u6CA1\u6709\u5B8C\u6210\uFF0C\u53EF\u4EE5\u91CD\u8BD5\u6216\u6E05\u9664\u641C\u7D22\u3002",
            this.actions
          )
        );
        host.append(renderFilterBar(this.filter, this.actions));
        const treePane = h("div", { class: "edu-map-navpane", "data-testid": "map-navpane" });
        treePane.append(
          h("h2", { class: "edu-map-pane-title" }, "\u6559\u6750\u76EE\u5F55"),
          renderTree(model.visibleRows(this.expandedIds), this.selectedNodeId, this.focusTocId, this.actions),
          renderTreeHelp()
        );
        const workPane = h("div", { class: "edu-map-workpane", "data-testid": "map-workpane" });
        workPane.append(renderViewTabs(this.viewMode, this.actions));
        const slice = this.activeSlice();
        const visibleConceptIds = this.visibleConceptIds(slice);
        if (slice !== null) {
          workPane.append(renderRangeHeader(slice, payload, visibleConceptIds, this.actions));
        }
        if (this.viewMode === "relations") {
          workPane.append(
            slice === null ? h("p", { class: "edu-map-help" }, "\u8FD8\u6CA1\u6709\u53EF\u663E\u793A\u7684\u5173\u7CFB\u3002") : renderRelationList(slice, payload, visibleConceptIds, this.actions)
          );
        } else if (this.viewMode === "concepts") {
          const concepts = slice === null ? [] : slice.concepts.filter((concept2) => {
            const summary = summarizeConceptState(payload, concept2.id);
            return matchesStateFilter(summary, this.filter);
          });
          workPane.append(renderConceptList(concepts, payload, this.filter, this.actions));
        } else {
          if (slice === null) {
            workPane.append(h("p", { class: "edu-map-help" }, "\u5F53\u524D\u8303\u56F4\u6CA1\u6709\u53EF\u7ED8\u5236\u7684\u6982\u5FF5\u3002"));
          } else if (visibleConceptIds.length === 0) {
            workPane.append(
              h(
                "div",
                { class: "edu-map-empty", "data-testid": "map-graph-filtered-empty" },
                h("p", {}, "\u5F53\u524D\u7B5B\u9009\u6CA1\u6709\u5339\u914D\u7684\u6982\u5FF5\uFF0C\u56FE\u6682\u4E0D\u7ED8\u5236\u3002"),
                button("\u6E05\u9664\u7B5B\u9009", this.actions.clearFilter, {
                  tone: "primary",
                  dataAction: "clear-filter"
                })
              )
            );
          } else {
            workPane.append(renderGraph(slice, payload, visibleConceptIds, this.actions));
          }
        }
        host.append(h("div", { class: "edu-map-main" }, treePane, workPane));
      }
      renderDetails(host) {
        clear(host);
        if (this.detail !== null && this.payload !== null) {
          host.append(renderDetail(this.detail, this.payload, this.actions));
          return;
        }
        if (this.detailError !== null) {
          host.append(
            h(
              "p",
              { class: "edu-map-notice", role: "alert", "data-testid": "map-detail-error" },
              "\u8FD9\u4E2A\u6982\u5FF5\u8BE6\u60C5\u6682\u65F6\u6253\u4E0D\u5F00\uFF1B\u76EE\u5F55\u3001\u5173\u7CFB\u5217\u8868\u548C\u6982\u5FF5\u5217\u8868\u4ECD\u53EF\u4F7F\u7528\u3002"
            )
          );
        }
        host.append(
          h(
            "div",
            { class: "edu-map-detail edu-map-detail--empty", "data-testid": "map-detail-placeholder" },
            h("h2", { class: "edu-map-detail__title" }, "\u6982\u5FF5\u8BE6\u60C5"),
            h(
              "p",
              {},
              "\u4ECE\u5DE6\u4FA7\u76EE\u5F55\u3001\u5173\u7CFB\u56FE\u6216\u6982\u5FF5\u5217\u8868\u9009\u62E9\u4E00\u4E2A\u6982\u5FF5\uFF1A\u53EF\u4EE5\u67E5\u770B\u4E09\u8F74\u72B6\u6001\u3001\u5EFA\u8BAE\u5148\u4FEE\u3001\u51FA\u5904\u4E0E\u5B66\u4E60/\u590D\u4E60\u5165\u53E3\u3002"
            ),
            h("p", { class: "edu-map-help" }, "\u53EA\u770B\u5730\u56FE\u4E0D\u4F1A\u628A\u6982\u5FF5\u6807\u8BB0\u4E3A\u5DF2\u5B66\uFF1B\u5F00\u59CB\u5B66\u4E60/\u590D\u4E60\u5728\u72EC\u7ACB\u5DE5\u4F5C\u533A\u8FDB\u884C\u3002")
          )
        );
      }
      activeSlice() {
        return this.expandedSlice ?? this.chapterGraph;
      }
      visibleConceptIds(slice) {
        const payload = this.payload;
        if (slice === null || payload === null) return [];
        return slice.concepts.filter((concept2) => matchesStateFilter(summarizeConceptState(payload, concept2.id), this.filter)).map((concept2) => concept2.id);
      }
    };
    
    // education/client/map/src/styles.ts
    var MAP_STYLE_ATTRIBUTE = "data-edu-map-style";
    var mapStyles = `
    .edu-map { min-width: 0; }
    .edu-map *, .edu-map *::before, .edu-map *::after { box-sizing: border-box; }
    .edu-map h2, .edu-map h3 { margin: 0 0 ${DESIGN_TOKENS.spacing.xs}; font-size: var(--edu-font-lg); overflow-wrap: anywhere; }
    .edu-map p { margin: 0 0 ${DESIGN_TOKENS.spacing.xs}; }
    .edu-map-main {
      display: grid;
      grid-template-columns: minmax(0, 17rem) minmax(0, 1fr);
      gap: ${DESIGN_TOKENS.spacing.md};
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
      padding: ${DESIGN_TOKENS.spacing.sm};
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
    .edu-map-tree__item:focus-visible { outline: ${DESIGN_TOKENS.focusRing}; outline-offset: 2px; }
    .edu-map-tree__row { display: flex; flex-wrap: wrap; align-items: center; gap: ${DESIGN_TOKENS.spacing.xxs}; min-width: 0; padding: ${DESIGN_TOKENS.spacing.xxs} ${DESIGN_TOKENS.spacing.xs}; }
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
      display: flex; flex-wrap: wrap; gap: ${DESIGN_TOKENS.spacing.xs}; align-items: baseline;
      margin-bottom: ${DESIGN_TOKENS.spacing.sm};
      padding: ${DESIGN_TOKENS.spacing.xs} ${DESIGN_TOKENS.spacing.sm};
      border: 1px dashed ${DESIGN_TOKENS.colors.warning};
      border-radius: var(--edu-radius-md);
      background: ${DESIGN_TOKENS.colors.warningSoft};
      color: ${DESIGN_TOKENS.colors.warning};
      overflow-wrap: anywhere;
    }
    .edu-map-badges { display: flex; flex-wrap: wrap; gap: ${DESIGN_TOKENS.spacing.xs}; align-items: center; margin-bottom: ${DESIGN_TOKENS.spacing.xs}; }
    .edu-map-candidate-banner {
      flex-basis: 100%;
      padding: ${DESIGN_TOKENS.spacing.xs} ${DESIGN_TOKENS.spacing.sm};
      border-left: 0.3rem solid ${DESIGN_TOKENS.colors.warning};
      background: ${DESIGN_TOKENS.colors.warningSoft};
      color: ${DESIGN_TOKENS.colors.warning};
      border-radius: 0 var(--edu-radius-sm) var(--edu-radius-sm) 0;
    }
    .edu-map-summary {
      display: grid;
      gap: ${DESIGN_TOKENS.spacing.xxs};
      margin-bottom: ${DESIGN_TOKENS.spacing.sm};
      padding: ${DESIGN_TOKENS.spacing.xs} ${DESIGN_TOKENS.spacing.sm};
      border: 1px solid var(--edu-color-line);
      border-radius: var(--edu-radius-md);
      background: var(--edu-color-surface-muted);
      min-width: 0;
    }
    .edu-map-summary__line { color: var(--edu-color-ink-muted); font-size: var(--edu-font-sm); overflow-wrap: anywhere; }
    .edu-map-search { display: flex; flex-wrap: wrap; gap: ${DESIGN_TOKENS.spacing.xs}; align-items: center; min-width: 0; }
    .edu-map-search__label { font-size: var(--edu-font-sm); color: var(--edu-color-ink-muted); }
    .edu-map-search__input { min-width: 0; max-width: 100%; flex: 1 1 12rem; font-size: var(--edu-font-md); padding: ${DESIGN_TOKENS.spacing.xxs} ${DESIGN_TOKENS.spacing.xs}; }
    .edu-map-search__results { list-style: none; margin: ${DESIGN_TOKENS.spacing.xs} 0; padding: 0; display: grid; gap: ${DESIGN_TOKENS.spacing.xxs}; }
    .edu-map-search__results li { overflow-wrap: anywhere; min-width: 0; }
    .edu-map-search__meta { color: var(--edu-color-ink-muted); font-size: var(--edu-font-xs); }
    .edu-map-filters { display: flex; flex-wrap: wrap; gap: ${DESIGN_TOKENS.spacing.xxs}; align-items: center; margin: ${DESIGN_TOKENS.spacing.xs} 0; }
    .edu-map-filters__label { font-size: var(--edu-font-sm); color: var(--edu-color-ink-muted); }
    .edu-map-filter, .edu-map-tab {
      border: 1px solid var(--edu-color-line);
      background: var(--edu-color-surface);
      color: var(--edu-color-ink);
      border-radius: ${DESIGN_TOKENS.radii.pill};
      padding: ${DESIGN_TOKENS.spacing.xxs} ${DESIGN_TOKENS.spacing.sm};
      font-size: var(--edu-font-sm);
      min-width: 0;
    }
    .edu-map-filter[aria-pressed="true"], .edu-map-tab[aria-pressed="true"] {
      border-color: var(--edu-color-accent);
      background: var(--edu-color-accent-soft);
      font-weight: 700;
    }
    .edu-map-tabs { display: flex; flex-wrap: wrap; gap: ${DESIGN_TOKENS.spacing.xs}; margin-bottom: ${DESIGN_TOKENS.spacing.xs}; }
    .edu-map-range {
      margin-bottom: ${DESIGN_TOKENS.spacing.xs};
      padding: ${DESIGN_TOKENS.spacing.xs} ${DESIGN_TOKENS.spacing.sm};
      border: 1px solid var(--edu-color-line);
      border-radius: var(--edu-radius-md);
      background: var(--edu-color-surface-muted);
      min-width: 0;
    }
    .edu-map-range__title { font-weight: 700; overflow-wrap: anywhere; }
    .edu-map-range__meta { color: var(--edu-color-ink-muted); font-size: var(--edu-font-sm); overflow-wrap: anywhere; }
    .edu-map-external { margin-top: ${DESIGN_TOKENS.spacing.xs}; display: grid; gap: ${DESIGN_TOKENS.spacing.xxs}; }
    .edu-map-external__title { font-size: var(--edu-font-sm); color: var(--edu-color-ink-muted); }
    .edu-map-external__item { display: flex; flex-wrap: wrap; gap: ${DESIGN_TOKENS.spacing.xs}; align-items: center; min-width: 0; }
    .edu-map-legend { list-style: none; margin: 0 0 ${DESIGN_TOKENS.spacing.xs}; padding: 0; display: grid; gap: ${DESIGN_TOKENS.spacing.xxs}; }
    .edu-map-legend__item { display: flex; flex-wrap: wrap; gap: ${DESIGN_TOKENS.spacing.xs}; align-items: center; font-size: var(--edu-font-sm); overflow-wrap: anywhere; }
    .edu-map-legend__line { display: inline-block; width: 2.5rem; height: 0; border-top-width: 0.18rem; border-top-style: solid; position: relative; }
    .edu-map-legend__line--prerequisite { border-top-color: ${DESIGN_TOKENS.colors.accent}; }
    .edu-map-legend__line--prerequisite::after {
      content: ''; position: absolute; right: -0.05rem; top: -0.32rem;
      border-left: 0.5rem solid ${DESIGN_TOKENS.colors.accent};
      border-top: 0.25rem solid transparent;
      border-bottom: 0.25rem solid transparent;
    }
    .edu-map-legend__line--related { border-top-color: ${DESIGN_TOKENS.colors.info}; border-top-style: dashed; }
    .edu-map-canvas__scroll {
      overflow: auto;
      max-width: 100%;
      border: 1px solid var(--edu-color-line);
      border-radius: var(--edu-radius-md);
      background: var(--edu-color-surface);
      padding: ${DESIGN_TOKENS.spacing.sm};
    }
    .edu-map-canvas { position: relative; min-width: 0; }
    .edu-map-canvas__edges { position: absolute; inset: 0; pointer-events: none; }
    .edu-map-edge { position: absolute; height: 0; transform-origin: 0 0; border-top-width: 0.16rem; border-top-style: solid; }
    .edu-map-edge--prerequisite { border-top-color: ${DESIGN_TOKENS.colors.accent}; border-top-style: solid; }
    .edu-map-edge--related { border-top-color: ${DESIGN_TOKENS.colors.info}; border-top-style: dashed; }
    .edu-map-edge--prerequisite::after {
      content: ''; position: absolute; right: -0.05rem; top: -0.3rem;
      border-left: 0.5rem solid ${DESIGN_TOKENS.colors.accent};
      border-top: 0.24rem solid transparent;
      border-bottom: 0.24rem solid transparent;
    }
    .edu-map-node {
      position: absolute;
      width: 11rem;
      min-height: 5.5rem;
      display: grid;
      gap: ${DESIGN_TOKENS.spacing.xxs};
      align-content: start;
      text-align: left;
      padding: ${DESIGN_TOKENS.spacing.xs};
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
    .edu-map-node[data-understanding="needs_support"] { border-left-color: ${DESIGN_TOKENS.colors.warning}; }
    .edu-map-node[data-understanding="developing"] { border-left-color: ${DESIGN_TOKENS.colors.info}; }
    .edu-map-node[data-understanding="supported"] { border-left-color: ${DESIGN_TOKENS.colors.success}; }
    .edu-map-node:focus-visible { outline: ${DESIGN_TOKENS.focusRing}; outline-offset: 2px; }
    .edu-map-node__title { font-weight: 700; overflow-wrap: anywhere; }
    .edu-map-node__state { color: var(--edu-color-ink-muted); font-size: var(--edu-font-xs); overflow-wrap: anywhere; }
    .edu-map-node__due { font-size: var(--edu-font-xs); color: ${DESIGN_TOKENS.colors.info}; }
    .edu-map-relations-wrap { min-width: 0; overflow-x: auto; }
    .edu-map-relations { width: 100%; border-collapse: collapse; table-layout: fixed; font-size: var(--edu-font-sm); }
    .edu-map-relations caption { text-align: left; font-weight: 700; padding-bottom: ${DESIGN_TOKENS.spacing.xxs}; overflow-wrap: anywhere; }
    .edu-map-relations th, .edu-map-relations td { border-bottom: 1px solid var(--edu-color-line); padding: ${DESIGN_TOKENS.spacing.xxs}; vertical-align: top; overflow-wrap: anywhere; text-align: left; }
    .edu-map-relations th { color: var(--edu-color-ink-muted); font-size: var(--edu-font-xs); }
    .edu-map-relations__rationale { max-width: 18rem; }
    .edu-map-link {
      border: 0; background: none; padding: 0; color: var(--edu-color-accent-strong);
      text-decoration: underline; font-size: inherit; text-align: left; overflow-wrap: anywhere;
    }
    .edu-map-link:focus-visible { outline: ${DESIGN_TOKENS.focusRing}; outline-offset: 2px; }
    .edu-map-concept-list { list-style: none; margin: 0; padding: 0; display: grid; gap: ${DESIGN_TOKENS.spacing.xxs}; }
    .edu-map-concept-list__item { min-width: 0; }
    .edu-map-concept-list__button {
      width: 100%; display: flex; flex-wrap: wrap; gap: ${DESIGN_TOKENS.spacing.xxs}; align-items: center;
      text-align: left; padding: ${DESIGN_TOKENS.spacing.xs}; min-width: 0;
      border: 1px solid var(--edu-color-line); border-radius: var(--edu-radius-md);
      background: var(--edu-color-surface); color: var(--edu-color-ink); font-size: var(--edu-font-md);
    }
    .edu-map-concept-list__button:focus-visible { outline: ${DESIGN_TOKENS.focusRing}; outline-offset: 2px; }
    .edu-map-concept-list__title { font-weight: 600; overflow-wrap: anywhere; }
    .edu-map-concept-list__states { display: flex; flex-wrap: wrap; gap: ${DESIGN_TOKENS.spacing.xxs}; }
    .edu-map-empty {
      padding: ${DESIGN_TOKENS.spacing.md}; border: 1px dashed var(--edu-color-line-strong);
      border-radius: var(--edu-radius-md); background: var(--edu-color-surface-muted); min-width: 0;
    }
    .edu-map-detail {
      background: var(--edu-color-surface);
      border: 1px solid var(--edu-color-line);
      border-radius: var(--edu-radius-lg);
      padding: ${DESIGN_TOKENS.spacing.md};
      min-width: 0;
    }
    .edu-map-detail__title { font-size: var(--edu-font-xl); overflow-wrap: anywhere; }
    .edu-map-detail__meta { color: var(--edu-color-ink-muted); font-size: var(--edu-font-sm); overflow-wrap: anywhere; }
    .edu-map-detail__states { display: flex; flex-wrap: wrap; gap: ${DESIGN_TOKENS.spacing.xxs}; align-items: center; margin: ${DESIGN_TOKENS.spacing.xs} 0; }
    .edu-map-detail__axis { font-size: var(--edu-font-xs); color: var(--edu-color-ink-muted); }
    .edu-map-detail__self { padding: ${DESIGN_TOKENS.spacing.xxs} ${DESIGN_TOKENS.spacing.xs}; border-left: 0.25rem solid var(--edu-color-line-strong); background: var(--edu-color-surface-muted); overflow-wrap: anywhere; }
    .edu-map-detail__section { margin-top: ${DESIGN_TOKENS.spacing.sm}; border-top: 1px solid var(--edu-color-line); padding-top: ${DESIGN_TOKENS.spacing.xs}; }
    .edu-map-detail__relation { font-size: var(--edu-font-sm); overflow-wrap: anywhere; }
    .edu-map-detail__source { font-size: var(--edu-font-sm); overflow-wrap: anywhere; }
    .edu-map-detail__actions { display: flex; flex-wrap: wrap; gap: ${DESIGN_TOKENS.spacing.xs}; margin-top: ${DESIGN_TOKENS.spacing.sm}; }
    .edu-map-prereq {
      border: 1px solid var(--edu-color-line);
      border-left: 0.3rem solid ${DESIGN_TOKENS.colors.warning};
      border-radius: 0 var(--edu-radius-sm) var(--edu-radius-sm) 0;
      padding: ${DESIGN_TOKENS.spacing.xs};
      margin-bottom: ${DESIGN_TOKENS.spacing.xs};
      background: ${DESIGN_TOKENS.colors.warningSoft};
      min-width: 0;
    }
    .edu-map-prereq.is-learned { border-left-color: ${DESIGN_TOKENS.colors.success}; background: ${DESIGN_TOKENS.colors.successSoft}; }
    .edu-map-prereq__title { font-weight: 700; overflow-wrap: anywhere; }
    .edu-map-prereq__meta { font-size: var(--edu-font-xs); color: var(--edu-color-ink-muted); overflow-wrap: anywhere; }
    .edu-map-prereq__actions { display: flex; flex-wrap: wrap; gap: ${DESIGN_TOKENS.spacing.xs}; margin-top: ${DESIGN_TOKENS.spacing.xxs}; }
    .edu-map-notice {
      padding: ${DESIGN_TOKENS.spacing.xs} ${DESIGN_TOKENS.spacing.sm};
      border: 1px solid ${DESIGN_TOKENS.colors.warning};
      border-radius: var(--edu-radius-md);
      background: ${DESIGN_TOKENS.colors.warningSoft};
      color: ${DESIGN_TOKENS.colors.warning};
      overflow-wrap: anywhere;
    }
    `;
    function ensureMapStyles(doc) {
      if (doc.querySelector(`style[${MAP_STYLE_ATTRIBUTE}="true"]`) !== null) return;
      const style = doc.createElement("style");
      style.setAttribute(MAP_STYLE_ATTRIBUTE, "true");
      style.textContent = mapStyles;
      doc.head.append(style);
    }
    
    // education/client/map/src/page.ts
    function createMapPage(controller) {
      return {
        id: "map",
        path: "/map",
        title: "\u5730\u56FE",
        requiresLearner: false,
        fallback: false,
        mount(context) {
          ensureMapStyles(context.container.ownerDocument);
          controller.onPageMount(context);
          const root = h("div", { class: "edu-map", "data-testid": "map-page" });
          root.append(
            h(
              "header",
              { class: "edu-page__header" },
              h("h1", { class: "edu-page__title", tabindex: -1 }, "\u5730\u56FE"),
              h(
                "p",
                { class: "edu-page__lead" },
                "\u6309\u771F\u5B9E\u76EE\u5F55\u5B9A\u4F4D\u6982\u5FF5\uFF1B\u9ED8\u8BA4\u53EA\u770B\u5F53\u524D\u7AE0\u7684\u5C40\u90E8\u5173\u7CFB\uFF0C\u8DE8\u7AE0\u6982\u5FF5\u9700\u8981\u663E\u5F0F\u5C55\u5F00\u3002\u5148\u4FEE\u53EA\u662F\u5EFA\u8BAE\uFF0C\u4E0D\u9501\u4F4F\u8FDB\u5165\u3002"
              )
            ),
            h("div", {
              "data-edu-slot": "map:content",
              "data-testid": "map-content-slot",
              class: "edu-map-slot"
            }),
            h("div", {
              "data-edu-slot": "map:details",
              "data-testid": "map-details-slot",
              class: "edu-map-slot"
            })
          );
          context.container.append(root);
        },
        unmount() {
          controller.onPageUnmount();
        }
      };
    }
    
    // education/client/map/src/fixture.ts
    var COURSE_EDITION_ID = "course.biology-demo";
    var PACK_ID = "pack.biology-demo";
    var PACK_VERSION = "1.0.0";
    function nowMs2() {
      const perf = globalThis.performance;
      if (perf !== void 0 && typeof perf.now === "function") return perf.now();
      return Date.now();
    }
    function roundMs(value) {
      return Math.round(value * 1e3) / 1e3;
    }
    function tocNode(id, parentId, type, title, order, sourceRef = "source.p18") {
      return {
        schemaVersion: 1,
        id,
        courseEditionId: COURSE_EDITION_ID,
        parentId,
        type,
        title,
        order,
        sourceRefs: [sourceRef]
      };
    }
    function concept(id, title, placements, aliases, sourceRefs, reviewState = "published") {
      return {
        schemaVersion: 1,
        id,
        courseEditionId: COURSE_EDITION_ID,
        title,
        aliases,
        placements,
        learningObjectives: [`\u80FD\u8BF4\u660E\u201C${title}\u201D\u7684\u8981\u70B9\uFF08\u5408\u6210\u793A\u4F8B\u76EE\u6807\uFF09`],
        explanation: `\u5408\u6210\u89E3\u91CA\uFF1A${title}\uFF08\u6F14\u793A\u6570\u636E\uFF0C\u4E0D\u662F\u6559\u6750\u539F\u6587\uFF09\u3002`,
        misconceptions: [],
        sourceRefs,
        rubricIds: [],
        activityIds: [],
        reviewState
      };
    }
    function relation(id, fromConceptId, toConceptId, type, basis, rationale, sourceRefs, reviewState = "published") {
      return {
        schemaVersion: 1,
        id,
        courseEditionId: COURSE_EDITION_ID,
        fromConceptId,
        toConceptId,
        type,
        basis,
        rationale,
        sourceRefs,
        reviewState
      };
    }
    function progress(conceptId, learning, understanding, review, revision) {
      return {
        schemaVersion: 1,
        learnerId: "learner.local.demo",
        courseEditionId: COURSE_EDITION_ID,
        packVersion: PACK_VERSION,
        conceptId,
        learning,
        understanding,
        review,
        lastPosition: { sessionId: null, activityId: null, cursor: null, updatedAt: null },
        revision
      };
    }
    function evidence(id, conceptId, kind, observation, met, validity, assistance = "unassisted") {
      return {
        schemaVersion: 1,
        id,
        attemptId: `attempt.${id}`,
        learnerId: "learner.local.demo",
        courseEditionId: COURSE_EDITION_ID,
        packVersion: PACK_VERSION,
        conceptId,
        kind,
        observation,
        criterionResults: [{ criterionId: `criterion.${conceptId}`, result: met, note: null }],
        assistance,
        sourceRefs: ["source.p18"],
        assessmentOrigin: "rule",
        modelRunId: null,
        uncertainty: null,
        validity,
        createdAt: "2026-10-20T09:00:00Z"
      };
    }
    var REVIEW_POLICY = "review-policy-v1";
    var SOURCE_CATALOGUE = {
      "source.p18": {
        sourceRefId: "source.p18",
        pdfPage: 18,
        printedPage: null,
        bookAvailable: true,
        verification: "machine_matched",
        label: "PDF \u7B2C 18 \u9875 \xB7 \u5370\u5237\u9875\u672A\u6807\u6CE8 \xB7 \u673A\u5668\u5339\u914D\uFF08\u975E\u4EBA\u5DE5\u6838\u5BF9\uFF09"
      },
      "source.p19": {
        sourceRefId: "source.p19",
        pdfPage: 19,
        printedPage: null,
        bookAvailable: true,
        verification: "machine_matched",
        label: "PDF \u7B2C 19 \u9875 \xB7 \u5370\u5237\u9875\u672A\u6807\u6CE8 \xB7 \u673A\u5668\u5339\u914D\uFF08\u975E\u4EBA\u5DE5\u6838\u5BF9\uFF09"
      },
      "source.p26": {
        sourceRefId: "source.p26",
        pdfPage: 26,
        printedPage: null,
        bookAvailable: true,
        verification: "unverified",
        label: "PDF \u7B2C 26 \u9875 \xB7 \u5370\u5237\u9875\u672A\u6807\u6CE8 \xB7 \u672A\u6838\u5B9E"
      },
      "source.p27": {
        sourceRefId: "source.p27",
        pdfPage: 27,
        printedPage: null,
        bookAvailable: true,
        verification: "unverified",
        label: "PDF \u7B2C 27 \u9875 \xB7 \u5370\u5237\u9875\u672A\u6807\u6CE8 \xB7 \u672A\u6838\u5B9E"
      },
      "source.p28": {
        sourceRefId: "source.p28",
        pdfPage: 28,
        printedPage: null,
        bookAvailable: true,
        verification: "unverified",
        label: "PDF \u7B2C 28 \u9875 \xB7 \u5370\u5237\u9875\u672A\u6807\u6CE8 \xB7 \u672A\u6838\u5B9E"
      },
      "source.p34": {
        sourceRefId: "source.p34",
        pdfPage: 34,
        printedPage: null,
        bookAvailable: false,
        verification: "unverified",
        label: "PDF \u7B2C 34 \u9875 \xB7 \u672C\u673A\u6750\u6599\u4E0D\u53EF\u7528\uFF08\u4FDD\u7559\u51FA\u5904\u4F4D\u7F6E\uFF09"
      }
    };
    function sourceFor(sourceRefId) {
      return SOURCE_CATALOGUE[sourceRefId] ?? {
        sourceRefId,
        pdfPage: 1,
        printedPage: null,
        bookAvailable: false,
        verification: "unverified",
        label: "\u51FA\u5904\u4FE1\u606F\u672A\u5728\u672C\u673A\u6750\u6599\u4E2D\u6838\u5B9E"
      };
    }
    function demoTree() {
      return [
        tocNode("toc.volume", null, "volume", "\u5408\u6210\u6F14\u793A\u6559\u6750\uFF08\u4E03\u4E0A\uFF09", 0),
        tocNode("toc.unit1", "toc.volume", "unit", "\u7B2C 1 \u5355\u5143 \u751F\u7269\u4F53\u7684\u7ED3\u6784\u5C42\u6B21", 0),
        tocNode("toc.ch1", "toc.unit1", "chapter", "\u7B2C 1 \u7AE0 \u7EC6\u80DE", 0, "source.p18"),
        tocNode("toc.ch1.s1", "toc.ch1", "section", "\u7B2C 1 \u8282 \u7EC6\u80DE\u7684\u57FA\u672C\u7ED3\u6784", 0, "source.p18"),
        tocNode("toc.ch1.s2", "toc.ch1", "section", "\u7B2C 2 \u8282 \u7EC6\u80DE\u7684\u751F\u6D3B", 1, "source.p19"),
        tocNode("toc.ch2", "toc.unit1", "chapter", "\u7B2C 2 \u7AE0 \u7EFF\u8272\u690D\u7269\u7684\u751F\u6D3B", 1, "source.p26"),
        tocNode("toc.ch2.s1", "toc.ch2", "section", "\u7B2C 1 \u8282 \u5149\u5408\u4F5C\u7528", 0, "source.p26"),
        tocNode("toc.ch2.s2", "toc.ch2", "section", "\u7B2C 2 \u8282 \u547C\u5438\u4F5C\u7528", 1, "source.p28"),
        tocNode("toc.unit2", "toc.volume", "unit", "\u7B2C 2 \u5355\u5143 \u751F\u7269\u4E0E\u73AF\u5883", 1, "source.p34"),
        tocNode("toc.ch3", "toc.unit2", "chapter", "\u7B2C 3 \u7AE0 \u751F\u6001\u7CFB\u7EDF", 0, "source.p34"),
        tocNode("toc.ch3.s1", "toc.ch3", "section", "\u7B2C 1 \u8282 \u751F\u6001\u7CFB\u7EDF\u7684\u7EC4\u6210", 0, "source.p34")
      ];
    }
    function demoConcepts(reviewState = "published") {
      return [
        concept(
          "concept.cell",
          "\u7EC6\u80DE",
          ["toc.ch1.s1", "toc.ch3.s1"],
          ["cell", "\u7EC6\u80DE\uFF08\u57FA\u672C\u5355\u4F4D\uFF09"],
          ["source.p18"],
          reviewState
        ),
        concept("concept.cell-structure", "\u7EC6\u80DE\u7ED3\u6784", ["toc.ch1.s1"], [], ["source.p18"], reviewState),
        concept("concept.cell-division", "\u7EC6\u80DE\u5206\u88C2", ["toc.ch1.s2"], [], ["source.p19"], reviewState),
        concept("concept.organism", "\u751F\u7269\u4F53\u7684\u7ED3\u6784\u5C42\u6B21", ["toc.ch2.s1"], [], ["source.p26"], reviewState),
        concept("concept.photosynthesis", "\u5149\u5408\u4F5C\u7528", ["toc.ch2.s1"], ["photosynthesis"], ["source.p26", "source.p27"], reviewState),
        concept("concept.respiration", "\u547C\u5438\u4F5C\u7528", ["toc.ch2.s2"], [], ["source.p28"], reviewState),
        concept("concept.ecosystem", "\u751F\u6001\u7CFB\u7EDF", ["toc.ch3.s1"], [], ["source.p34"], reviewState)
      ];
    }
    function demoRelations(reviewState = "published") {
      return [
        relation(
          "relation.prereq.cell-organism",
          "concept.cell",
          "concept.organism",
          "prerequisite",
          "explicit_source",
          "\u7406\u89E3\u751F\u7269\u4F53\u7684\u7ED3\u6784\u5C42\u6B21\u524D\uFF0C\u5148\u8BA4\u8BC6\u7EC6\u80DE\u662F\u57FA\u672C\u5355\u4F4D\uFF08\u5408\u6210\u793A\u4F8B\uFF0C\u4F9D\u636E\u51FA\u5904\u7B2C 18 \u9875\uFF09\u3002",
          ["source.p18"],
          reviewState
        ),
        relation(
          "relation.prereq.structure-division",
          "concept.cell-structure",
          "concept.cell-division",
          "prerequisite",
          "pedagogical_inference",
          "\u5148\u7406\u89E3\u7ED3\u6784\u518D\u7406\u89E3\u5206\u88C2\uFF0C\u5C5E\u4E8E\u6559\u5B66\u63A8\u65AD\uFF0C\u4E0D\u662F\u6559\u6750\u539F\u6587\u7ED3\u8BBA\u3002",
          [],
          reviewState
        ),
        relation(
          "relation.related.cell-division",
          "concept.cell",
          "concept.cell-division",
          "related",
          "explicit_source",
          "\u7EC6\u80DE\u4E0E\u7EC6\u80DE\u5206\u88C2\u662F\u76F8\u5173\u6982\u5FF5\uFF0C\u6CA1\u6709\u5148\u540E\u8981\u6C42\uFF08\u5408\u6210\u793A\u4F8B\uFF09\u3002",
          ["source.p19"],
          reviewState
        ),
        relation(
          "relation.prereq.cell-photosynthesis",
          "concept.cell",
          "concept.photosynthesis",
          "prerequisite",
          "pedagogical_inference",
          "\u7406\u89E3\u5149\u5408\u4F5C\u7528\u524D\u5148\u8BA4\u8BC6\u7EC6\u80DE\uFF08\u8DE8\u7AE0\u5EFA\u8BAE\uFF0C\u4E0D\u963B\u65AD\u8FDB\u5165\uFF09\u3002",
          [],
          reviewState
        ),
        relation(
          "relation.prereq.division-photosynthesis",
          "concept.cell-division",
          "concept.photosynthesis",
          "prerequisite",
          "pedagogical_inference",
          "\u5148\u7406\u89E3\u7EC6\u80DE\u5206\u88C2\uFF0C\u518D\u7406\u89E3\u5149\u5408\u4F5C\u7528\u4EA7\u7269\u7684\u53BB\u5411\uFF0C\u5C5E\u4E8E\u6559\u5B66\u63A8\u65AD\u3002",
          [],
          reviewState
        ),
        relation(
          "relation.related.cell-ecosystem",
          "concept.cell",
          "concept.ecosystem",
          "related",
          "explicit_source",
          "\u7EC6\u80DE\u4E0E\u751F\u6001\u7CFB\u7EDF\u662F\u8DE8\u7AE0\u76F8\u5173\u6982\u5FF5\uFF08\u5408\u6210\u793A\u4F8B\uFF09\u3002",
          ["source.p34"],
          reviewState
        )
      ];
    }
    function demoProgress() {
      return [
        progress(
          "concept.cell",
          {
            state: "completed",
            startedAt: "2026-10-20T08:00:00Z",
            lastCompletedAt: "2026-10-20T08:40:00Z"
          },
          {
            state: "supported",
            assessmentId: "assessment.demo.cell",
            updatedAt: "2026-10-20T08:40:00Z",
            validity: "current"
          },
          {
            lastCompletedAt: "2026-10-21T09:00:00Z",
            dueAt: "2026-10-28T09:00:00Z",
            activeSessionId: null,
            latestOutcome: "supported",
            policyVersion: REVIEW_POLICY
          },
          4
        ),
        progress(
          "concept.cell-structure",
          {
            state: "completed",
            startedAt: "2026-10-21T08:00:00Z",
            lastCompletedAt: "2026-10-21T08:30:00Z"
          },
          {
            state: "developing",
            assessmentId: "assessment.demo.cell-structure",
            updatedAt: "2026-10-21T08:30:00Z",
            validity: "current"
          },
          {
            lastCompletedAt: "2026-10-22T09:00:00Z",
            dueAt: "2026-10-25T09:00:00Z",
            activeSessionId: null,
            latestOutcome: "developing",
            policyVersion: REVIEW_POLICY
          },
          3
        ),
        progress(
          "concept.cell-division",
          {
            state: "in_progress",
            startedAt: "2026-10-29T08:00:00Z",
            lastCompletedAt: null
          },
          { state: "unassessed", assessmentId: null, updatedAt: null, validity: "current" },
          {
            lastCompletedAt: null,
            dueAt: null,
            activeSessionId: "session.demo.cell-division",
            latestOutcome: null,
            policyVersion: REVIEW_POLICY
          },
          2
        ),
        progress(
          "concept.organism",
          {
            state: "completed",
            startedAt: "2026-10-23T08:00:00Z",
            lastCompletedAt: "2026-10-23T08:30:00Z"
          },
          {
            state: "supported",
            assessmentId: "assessment.demo.organism",
            updatedAt: "2026-10-23T08:30:00Z",
            validity: "current"
          },
          {
            lastCompletedAt: null,
            dueAt: null,
            activeSessionId: null,
            latestOutcome: null,
            policyVersion: REVIEW_POLICY
          },
          2
        ),
        progress(
          "concept.photosynthesis",
          {
            state: "completed",
            startedAt: "2026-10-24T08:00:00Z",
            lastCompletedAt: "2026-10-24T08:30:00Z"
          },
          {
            state: "needs_support",
            assessmentId: "assessment.demo.photosynthesis",
            updatedAt: "2026-10-24T08:30:00Z",
            validity: "current"
          },
          {
            lastCompletedAt: "2026-10-27T09:00:00Z",
            dueAt: "2026-10-28T09:00:00Z",
            activeSessionId: null,
            latestOutcome: "needs_support",
            policyVersion: REVIEW_POLICY
          },
          3
        ),
        progress(
          "concept.ecosystem",
          {
            state: "completed",
            startedAt: "2026-10-25T08:00:00Z",
            lastCompletedAt: "2026-10-25T08:30:00Z"
          },
          {
            state: "developing",
            assessmentId: "assessment.demo.ecosystem",
            updatedAt: "2026-10-25T08:30:00Z",
            validity: "stale"
          },
          {
            lastCompletedAt: null,
            dueAt: null,
            activeSessionId: null,
            latestOutcome: null,
            policyVersion: REVIEW_POLICY
          },
          2
        )
      ];
    }
    function demoEvidence() {
      return [
        evidence("evidence.demo.cell-explain", "concept.cell", "explain", "\u7528\u81EA\u5DF1\u7684\u8BDD\u89E3\u91CA\u4E86\u7EC6\u80DE\u662F\u57FA\u672C\u5355\u4F4D\u3002", "met", "current"),
        evidence(
          "evidence.demo.photosynthesis-recall",
          "concept.photosynthesis",
          "recall",
          "\u628A\u5149\u5408\u4F5C\u7528\u7684\u539F\u6599\u8BF4\u9519\u4E86\u4E00\u90E8\u5206\u3002",
          "not_met",
          "current"
        ),
        evidence(
          "evidence.demo.ecosystem-transfer",
          "concept.ecosystem",
          "transfer",
          "\u4E3E\u4E86\u4E00\u4E2A\u751F\u6001\u7CFB\u7EDF\u7684\u4F8B\u5B50\uFF0C\u4F46\u8BC1\u636E\u5DF2\u8FC7\u671F\u3002",
          "met",
          "stale"
        )
      ];
    }
    function demoPayload(scenario) {
      const candidate = scenario === "candidate";
      const reviewState = candidate ? "machine_checked" : "published";
      return {
        courseEditionId: COURSE_EDITION_ID,
        courseEditionLabel: "7\u5E74\u7EA7\u4E0A\u518C \xB7 \u751F\u7269 \xB7 \u5408\u6210\u6F14\u793A\u6559\u6750\uFF08\u975E\u771F\u5B9E\u7248\u672C\uFF09",
        packId: PACK_ID,
        packVersion: PACK_VERSION,
        trustMode: candidate ? "candidate" : "published",
        scope: "partial",
        coverageStatus: "partial",
        toc: demoTree(),
        concepts: demoConcepts(reviewState),
        relations: demoRelations(reviewState === "published" ? "published" : "machine_checked"),
        progress: demoProgress(),
        selfReports: [
          {
            schemaVersion: 1,
            id: "self-report.demo.cell",
            learnerId: "learner.local.demo",
            courseEditionId: COURSE_EDITION_ID,
            packVersion: PACK_VERSION,
            conceptId: "concept.cell",
            claimedState: "basically_understood",
            createdAt: "2026-10-20T08:45:00Z"
          },
          {
            schemaVersion: 1,
            id: "self-report.demo.photosynthesis",
            learnerId: "learner.local.demo",
            courseEditionId: COURSE_EDITION_ID,
            packVersion: PACK_VERSION,
            conceptId: "concept.photosynthesis",
            claimedState: "uncertain",
            createdAt: "2026-10-27T09:10:00Z"
          }
        ],
        evidence: demoEvidence(),
        sources: Object.values(SOURCE_CATALOGUE),
        initialTocNodeId: null,
        initialConceptId: null,
        fixture: true,
        notice: candidate ? "\u6F14\u793A\u6570\u636E\uFF08fixture\uFF09\xB7 \u5019\u9009\u5185\u5BB9\u573A\u666F\uFF1A\u5019\u9009\u5305\u7981\u7528\u5F3A\u7ED3\u8BBA\uFF0C\u4EC5\u4F9B\u663E\u5F0F\u8BD5\u7528\u6F14\u793A\u3002" : "\u6F14\u793A\u6570\u636E\uFF08fixture\uFF09\uFF1A\u5408\u6210\u76EE\u5F55\u3001\u6982\u5FF5\u4E0E\u5173\u7CFB\uFF0C\u4E0D\u662F\u771F\u5B9E\u6559\u6750\u6216\u771F\u5B9E API \u7ED3\u679C\u3002"
      };
    }
    function buildScalePayload(options = {}) {
      const conceptCount = options.conceptCount ?? 500;
      const prerequisiteCount = options.prerequisiteCount ?? 499;
      const relatedCount = options.relatedCount ?? 501;
      const chapters = options.chapters ?? 20;
      const sectionsPerChapter = options.sectionsPerChapter ?? 5;
      const sectionCount = chapters * sectionsPerChapter;
      const conceptsPerSection = Math.ceil(conceptCount / sectionCount);
      const toc = [tocNode("toc.volume", null, "volume", "\u5408\u6210\u6F14\u793A\u6559\u6750\uFF08\u5168\u518C\u89C4\u6A21\uFF09", 0)];
      const sectionIds = [];
      for (let chapter = 0; chapter < chapters; chapter += 1) {
        const chapterId = `toc.ch${String(chapter).padStart(2, "0")}`;
        toc.push(
          tocNode(chapterId, "toc.volume", "chapter", `\u7B2C ${chapter + 1} \u7AE0\uFF08\u5408\u6210\uFF09`, chapter)
        );
        for (let section = 0; section < sectionsPerChapter; section += 1) {
          const sectionId = `${chapterId}.s${section + 1}`;
          sectionIds.push(sectionId);
          toc.push(
            tocNode(sectionId, chapterId, "section", `\u7B2C ${chapter + 1} \u7AE0 \u7B2C ${section + 1} \u8282`, section)
          );
        }
      }
      const conceptId = (index) => `concept.scale${String(index).padStart(4, "0")}`;
      const concepts = [];
      for (let index = 0; index < conceptCount; index += 1) {
        const sectionIndex = Math.min(sectionIds.length - 1, Math.floor(index / conceptsPerSection));
        concepts.push(
          concept(
            conceptId(index),
            `\u5408\u6210\u6982\u5FF5 ${index}`,
            [sectionIds[sectionIndex]],
            [`alias-${index}`, `\u522B\u540D${index}`],
            ["source.p18"]
          )
        );
      }
      const relations = [];
      for (let index = 0; index < prerequisiteCount; index += 1) {
        relations.push(
          relation(
            `relation.scale.prereq.${String(index).padStart(4, "0")}`,
            conceptId(index % conceptCount),
            conceptId((index + 1) % conceptCount),
            "prerequisite",
            "pedagogical_inference",
            "\u5408\u6210 fixture \u4E2D\u7684\u6559\u5B66\u987A\u5E8F\u5047\u8BBE\uFF08\u975E\u6559\u6750\u4F9D\u636E\uFF09\u3002",
            []
          )
        );
      }
      const relatedPairs = /* @__PURE__ */ new Set();
      let cursor = 0;
      while (relatedPairs.size < relatedCount && cursor < relatedCount * 8) {
        const step = 1 + Math.floor(cursor / conceptCount);
        const left = cursor % conceptCount;
        const right = (left + step) % conceptCount;
        cursor += 1;
        if (left === right) continue;
        const low = Math.min(left, right);
        const high = Math.max(left, right);
        const key = `${low}<->${high}`;
        if (relatedPairs.has(key)) continue;
        relatedPairs.add(key);
        relations.push(
          relation(
            `relation.scale.related.${String(relatedPairs.size).padStart(4, "0")}`,
            conceptId(low),
            conceptId(high),
            "related",
            "pedagogical_inference",
            "\u5408\u6210 fixture \u4E2D\u7684\u76F8\u5173\u5173\u8054\u3002",
            []
          )
        );
      }
      const states = concepts.slice(0, 120).map((entry, index) => {
        const variant = index % 6;
        const base = {
          startedAt: "2026-10-20T08:00:00Z",
          lastCompletedAt: "2026-10-20T08:40:00Z"
        };
        if (variant === 0) {
          return progress(
            entry.id,
            { state: "completed", ...base },
            {
              state: "supported",
              assessmentId: `assessment.scale.${index}`,
              updatedAt: "2026-10-20T08:40:00Z",
              validity: "current"
            },
            {
              lastCompletedAt: "2026-10-21T09:00:00Z",
              dueAt: "2026-10-28T09:00:00Z",
              activeSessionId: null,
              latestOutcome: "supported",
              policyVersion: REVIEW_POLICY
            },
            2
          );
        }
        if (variant === 1) {
          return progress(
            entry.id,
            { state: "completed", ...base },
            {
              state: "needs_support",
              assessmentId: `assessment.scale.${index}`,
              updatedAt: "2026-10-20T08:40:00Z",
              validity: "current"
            },
            {
              lastCompletedAt: "2026-10-21T09:00:00Z",
              dueAt: "2026-10-28T09:00:00Z",
              activeSessionId: null,
              latestOutcome: "needs_support",
              policyVersion: REVIEW_POLICY
            },
            2
          );
        }
        if (variant === 2) {
          return progress(
            entry.id,
            { state: "in_progress", startedAt: "2026-10-28T08:00:00Z", lastCompletedAt: null },
            { state: "unassessed", assessmentId: null, updatedAt: null, validity: "current" },
            {
              lastCompletedAt: null,
              dueAt: null,
              activeSessionId: null,
              latestOutcome: null,
              policyVersion: REVIEW_POLICY
            },
            1
          );
        }
        if (variant === 3) {
          return progress(
            entry.id,
            { state: "completed", ...base },
            {
              state: "developing",
              assessmentId: `assessment.scale.${index}`,
              updatedAt: "2026-10-20T08:40:00Z",
              validity: "current"
            },
            {
              lastCompletedAt: null,
              dueAt: null,
              activeSessionId: null,
              latestOutcome: null,
              policyVersion: REVIEW_POLICY
            },
            2
          );
        }
        if (variant === 4) {
          return progress(
            entry.id,
            { state: "completed", ...base },
            {
              state: "developing",
              assessmentId: `assessment.scale.${index}`,
              updatedAt: "2026-10-20T08:40:00Z",
              validity: "stale"
            },
            {
              lastCompletedAt: null,
              dueAt: null,
              activeSessionId: null,
              latestOutcome: null,
              policyVersion: REVIEW_POLICY
            },
            2
          );
        }
        return progress(
          entry.id,
          { state: "not_started", startedAt: null, lastCompletedAt: null },
          { state: "unassessed", assessmentId: null, updatedAt: null, validity: "current" },
          {
            lastCompletedAt: null,
            dueAt: null,
            activeSessionId: null,
            latestOutcome: null,
            policyVersion: REVIEW_POLICY
          },
          1
        );
      });
      return {
        courseEditionId: COURSE_EDITION_ID,
        courseEditionLabel: "7\u5E74\u7EA7\u4E0A\u518C \xB7 \u751F\u7269 \xB7 \u5408\u6210\u6F14\u793A\u6559\u6750\uFF08500 \u6982\u5FF5\u89C4\u6A21 fixture\uFF09",
        packId: "pack.biology-scale-demo",
        packVersion: "1.0.0",
        trustMode: "published",
        scope: "partial",
        coverageStatus: "partial",
        toc,
        concepts,
        relations,
        progress: states,
        selfReports: [],
        evidence: demoEvidence(),
        sources: Object.values(SOURCE_CATALOGUE),
        initialTocNodeId: null,
        initialConceptId: null,
        fixture: true,
        notice: "\u6F14\u793A\u6570\u636E\uFF08fixture\uFF09\xB7 500 \u6982\u5FF5 / 1000 \u5173\u7CFB\u89C4\u6A21\u793A\u4F8B\uFF1A\u7528\u4E8E\u6709\u754C\u6E32\u67D3\u4E0E\u8017\u65F6\u8BB0\u5F55\uFF0C\u4E0D\u662F\u771F\u5B9E\u6559\u6750\u3002"
      };
    }
    function buildTreeIndex(toc) {
      const byId = /* @__PURE__ */ new Map();
      for (const node of toc) byId.set(node.id, node);
      const childrenOf = /* @__PURE__ */ new Map();
      for (const node of toc) {
        if (node.parentId === null) continue;
        const list = childrenOf.get(node.parentId) ?? [];
        list.push(node);
        childrenOf.set(node.parentId, list);
      }
      for (const list of childrenOf.values()) {
        list.sort((left, right) => left.order !== right.order ? left.order - right.order : left.id < right.id ? -1 : 1);
      }
      const chapterOf = (nodeId) => {
        let cursor = byId.get(nodeId);
        let guard = 0;
        while (cursor !== void 0 && guard <= toc.length) {
          if (cursor.type === "chapter") return cursor;
          cursor = cursor.parentId === null ? void 0 : byId.get(cursor.parentId);
          guard += 1;
        }
        return null;
      };
      const subtreeIds = (nodeId) => {
        const start = byId.get(nodeId);
        if (start === void 0) return [];
        const output = [];
        const queue = [start];
        while (queue.length > 0) {
          const current = queue.shift();
          output.push(current.id);
          for (const child of childrenOf.get(current.id) ?? []) queue.push(child);
        }
        return output;
      };
      return { byId, childrenOf, chapterOf, subtreeIds };
    }
    function conceptOrder(tocIndex, concepts, scopeNodeId) {
      const ids = [];
      const placements = /* @__PURE__ */ new Map();
      for (const entry of concepts) placements.set(entry.id, [...entry.placements]);
      const scopeIds = scopeNodeId === null ? null : new Set(tocIndex.subtreeIds(scopeNodeId));
      const seen = /* @__PURE__ */ new Set();
      const visit = (nodeId) => {
        for (const entry of concepts) {
          if (seen.has(entry.id)) continue;
          if (!(placements.get(entry.id) ?? []).includes(nodeId)) continue;
          if (scopeIds !== null && !scopeIds.has(nodeId)) continue;
          seen.add(entry.id);
          ids.push(entry.id);
        }
      };
      const roots = [...tocIndex.byId.values()].filter((node) => node.parentId === null);
      const walk = (node) => {
        visit(node.id);
        for (const child of tocIndex.childrenOf.get(node.id) ?? []) walk(child);
      };
      for (const root of roots) walk(root);
      if (scopeNodeId === null) {
        for (const entry of concepts) {
          if (!seen.has(entry.id)) ids.push(entry.id);
        }
      }
      return ids;
    }
    function chapterConceptIds(tocIndex, concepts, chapterId) {
      const scope = new Set(tocIndex.subtreeIds(chapterId));
      const ordered = conceptOrder(tocIndex, concepts, chapterId);
      return ordered.filter((conceptId) => {
        const entry = concepts.find((candidate) => candidate.id === conceptId);
        return entry !== void 0 && entry.placements.some((placement) => scope.has(placement));
      });
    }
    function emptySlice(packVersion) {
      return {
        packVersion,
        centerConceptId: null,
        scopeTocNodeId: null,
        concepts: [],
        relations: [],
        externalConcepts: [],
        truncated: false,
        hiddenConceptCount: 0,
        stats: { maxNodes: 0, maxDepth: 0, visitedConcepts: 0, visitedRelations: 0, durationMs: 0 }
      };
    }
    function normOptions(options) {
      const maxNodes = Math.max(1, Math.min(MAP_NODE_CAP * 4, Math.trunc(options.maxNodes)));
      const maxDepth = Math.max(1, Math.min(MAP_DEPTH_CAP + 2, Math.trunc(options.maxDepth)));
      const visible = Math.max(
        1,
        Math.min(maxNodes, Math.trunc(options.visibleConceptCount ?? maxNodes))
      );
      return { maxNodes, maxDepth, visible };
    }
    var FixtureMapDataSource = class {
      kind = "fixture";
      notice = "\u6F14\u793A\u6570\u636E\uFF08fixture\uFF09\uFF1A\u4E0D\u662F\u771F\u5B9E\u6559\u6750\u6216\u771F\u5B9E API \u7ED3\u679C\u3002";
      payload;
      tocIndex;
      conceptById;
      relationsByConcept;
      constructor(payload) {
        this.payload = payload;
        this.tocIndex = buildTreeIndex(payload.toc);
        this.conceptById = new Map(payload.concepts.map((entry) => [entry.id, entry]));
        const byConcept = /* @__PURE__ */ new Map();
        for (const entry of payload.relations) {
          for (const conceptId of [entry.fromConceptId, entry.toConceptId]) {
            const list = byConcept.get(conceptId) ?? [];
            list.push(entry);
            byConcept.set(conceptId, list);
          }
        }
        this.relationsByConcept = byConcept;
      }
      async loadMap(_request) {
        const chapters = this.payload.toc.filter((node) => node.type === "chapter");
        const latest = [...this.payload.progress].filter((entry) => entry.understanding.updatedAt !== null).sort(
          (left, right) => (left.understanding.updatedAt ?? "") < (right.understanding.updatedAt ?? "") ? 1 : -1
        )[0];
        const latestConcept = latest === void 0 ? void 0 : this.conceptById.get(latest.conceptId);
        const latestChapter = latestConcept === void 0 ? null : this.tocIndex.chapterOf(latestConcept.placements[0]);
        const initialChapter = latestChapter ?? chapters[0] ?? null;
        const initialConceptId = latestConcept?.id ?? (initialChapter === null ? null : chapterConceptIds(this.tocIndex, this.payload.concepts, initialChapter.id)[0] ?? null);
        return okData(
          {
            ...this.payload,
            initialTocNodeId: initialChapter?.id ?? null,
            initialConceptId
          },
          1
        );
      }
      async loadChapterGraph(_request, tocNodeId, options) {
        const started = nowMs2();
        const { maxDepth, visible } = normOptions(options);
        const chapter = this.tocIndex.chapterOf(tocNodeId);
        if (chapter === null) return okData(emptySlice(this.payload.packVersion), 1);
        const allIds = chapterConceptIds(this.tocIndex, this.payload.concepts, chapter.id);
        const visibleIds = allIds.slice(0, visible);
        const visibleSet = new Set(visibleIds);
        const paintedRelations = this.payload.relations.filter(
          (entry) => visibleSet.has(entry.fromConceptId) && visibleSet.has(entry.toConceptId)
        );
        const externalIds = /* @__PURE__ */ new Set();
        const touching = this.payload.relations.filter(
          (entry) => visibleSet.has(entry.fromConceptId) || visibleSet.has(entry.toConceptId)
        );
        for (const entry of touching) {
          if (!visibleSet.has(entry.fromConceptId)) externalIds.add(entry.fromConceptId);
          if (!visibleSet.has(entry.toConceptId)) externalIds.add(entry.toConceptId);
        }
        const externalConcepts = [...externalIds].sort().map((id) => this.conceptById.get(id)).filter((entry) => entry !== void 0);
        const centerId = options.centerConceptId ?? visibleIds[0] ?? null;
        const concepts = visibleIds.map((id) => this.conceptById.get(id)).filter((entry) => entry !== void 0);
        const hiddenConceptCount = Math.max(0, allIds.length - concepts.length);
        const durationMs = roundMs(nowMs2() - started);
        return okData(
          {
            packVersion: this.payload.packVersion,
            centerConceptId: centerId,
            scopeTocNodeId: chapter.id,
            concepts,
            relations: paintedRelations,
            externalConcepts,
            truncated: externalConcepts.length > 0 || hiddenConceptCount > 0,
            hiddenConceptCount,
            stats: {
              maxNodes: Math.max(1, visible),
              maxDepth,
              visitedConcepts: concepts.length,
              visitedRelations: paintedRelations.length,
              durationMs
            }
          },
          1
        );
      }
      async expandConcept(_request, conceptId, options) {
        const started = nowMs2();
        const center = this.conceptById.get(conceptId);
        if (center === void 0) {
          return {
            ok: false,
            error: { code: "NOT_FOUND", message: "\u6982\u5FF5\u4E0D\u5728\u5F53\u524D\u5185\u5BB9\u5305\u4E2D", retryable: false }
          };
        }
        const maxNodes = Math.max(1, Math.min(MAP_NODE_CAP * 8, Math.trunc(options.maxNodes)));
        const maxDepth = Math.max(0, Math.min(MAP_DEPTH_CAP + 4, Math.trunc(options.maxDepth)));
        const included = /* @__PURE__ */ new Set([conceptId]);
        let frontier = [conceptId];
        let depth = 0;
        let truncated = false;
        while (frontier.length > 0 && depth < maxDepth) {
          const next = [];
          for (const current of frontier) {
            for (const entry of this.relationsByConcept.get(current) ?? []) {
              const neighbor = entry.fromConceptId === current ? entry.toConceptId : entry.fromConceptId;
              if (included.has(neighbor)) continue;
              if (included.size >= maxNodes) {
                truncated = true;
                continue;
              }
              included.add(neighbor);
              next.push(neighbor);
            }
          }
          depth += 1;
          frontier = next.sort();
        }
        const concepts = [...included].map((id) => this.conceptById.get(id)).filter((entry) => entry !== void 0);
        const includedSet = new Set(concepts.map((entry) => entry.id));
        const relations = this.payload.relations.filter(
          (entry) => includedSet.has(entry.fromConceptId) && includedSet.has(entry.toConceptId)
        );
        const durationMs = roundMs(nowMs2() - started);
        return okData(
          {
            packVersion: this.payload.packVersion,
            centerConceptId: conceptId,
            scopeTocNodeId: null,
            concepts,
            relations,
            externalConcepts: [],
            truncated,
            hiddenConceptCount: 0,
            stats: {
              maxNodes,
              maxDepth,
              visitedConcepts: concepts.length,
              visitedRelations: relations.length,
              durationMs
            }
          },
          1
        );
      }
      async searchConcepts(_request, query, limit) {
        const needle = query.trim().toLowerCase();
        if (needle.length === 0) return okData([], 1);
        const capped = Math.max(1, Math.min(limit, MAP_SEARCH_LIMIT));
        const hits = [];
        for (const entry of this.payload.concepts) {
          const title = entry.title.toLowerCase();
          let score = 0;
          let matchedOn = "title";
          let matchedText = entry.title;
          if (title === needle) score = 100;
          else if (title.startsWith(needle)) score = 80;
          else if (title.includes(needle)) score = 60;
          for (const alias of entry.aliases) {
            const lowered = alias.toLowerCase();
            if (lowered === needle && score < 95) {
              score = 95;
              matchedOn = "alias";
              matchedText = alias;
            } else if (lowered.startsWith(needle) && score < 75) {
              score = 75;
              matchedOn = "alias";
              matchedText = alias;
            } else if (lowered.includes(needle) && score < 55) {
              score = 55;
              matchedOn = "alias";
              matchedText = alias;
            }
          }
          if (score === 0) continue;
          const placement = entry.placements[0];
          const chapter = this.tocIndex.chapterOf(placement);
          hits.push({
            conceptId: entry.id,
            title: entry.title,
            matchedOn,
            matchedText,
            tocNodeId: chapter?.id ?? null,
            tocTitle: chapter?.title ?? null,
            score
          });
        }
        hits.sort((left, right) => {
          if (left.score !== right.score) return right.score - left.score;
          return left.title.localeCompare(right.title, "zh-Hans-CN");
        });
        return okData(hits.slice(0, capped), 1);
      }
      async loadConceptDetail(_request, conceptId) {
        const entry = this.conceptById.get(conceptId);
        if (entry === void 0) {
          return {
            ok: false,
            error: { code: "NOT_FOUND", message: "\u6982\u5FF5\u4E0D\u5728\u5F53\u524D\u5185\u5BB9\u5305\u4E2D", retryable: false }
          };
        }
        const relations = this.relationsByConcept.get(conceptId) ?? [];
        const prerequisites = relations.filter(
          (candidate) => candidate.type === "prerequisite" && candidate.toConceptId === conceptId
        );
        const sources = [...new Set(entry.sourceRefs)].map((ref) => sourceFor(ref));
        const placements = entry.placements.map((placement) => {
          const node = this.tocIndex.byId.get(placement);
          const path = [];
          let cursor = node;
          let guard = 0;
          while (cursor !== void 0 && guard <= this.payload.toc.length) {
            path.unshift(cursor.title);
            cursor = cursor.parentId === null ? void 0 : this.tocIndex.byId.get(cursor.parentId);
            guard += 1;
          }
          return {
            tocNodeId: placement,
            title: node?.title ?? placement,
            type: node?.type ?? "section",
            path
          };
        });
        return okData(
          {
            concept: entry,
            progress: this.payload.progress.find((p) => p.conceptId === conceptId) ?? null,
            selfReport: this.payload.selfReports.find((p) => p.conceptId === conceptId) ?? null,
            relations,
            prerequisites,
            evidence: this.payload.evidence.filter((e) => e.conceptId === conceptId),
            sources,
            placements
          },
          1
        );
      }
    };
    function createFixtureMapDataSource(options = {}) {
      const scenario = options.scenario ?? "demo";
      const payload = scenario === "scale" ? buildScalePayload() : demoPayload(scenario);
      return new FixtureMapDataSource(payload);
    }
    
    // education/client/map/src/index.ts
    function defaultRequestFactory2() {
      let counter = 0;
      return () => {
        counter += 1;
        return {
          requestId: `request.map.${counter}`,
          learnerId: "learner.local.default",
          now: (/* @__PURE__ */ new Date()).toISOString()
        };
      };
    }
    function createMapUi(options = {}) {
      const dataSource = options.dataSource ?? createFixtureMapDataSource({ scenario: options.fixtureScenario });
      const controllerOptions = {
        dataSource,
        createRequest: options.createRequest ?? defaultRequestFactory2(),
        pageSize: options.pageSize
      };
      const controller = new MapController(controllerOptions);
      const page = createMapPage(controller);
      const contentPanel = {
        id: "map-content",
        mount(context) {
          controller.mountContent(context.container);
        },
        unmount() {
          controller.unmountContent();
        }
      };
      const detailsPanel = {
        id: "map-details",
        mount(context) {
          controller.mountDetails(context.container);
        },
        unmount() {
          controller.unmountDetails();
        }
      };
      const panels = [
        { name: "map:content", panel: contentPanel },
        { name: "map:details", panel: detailsPanel }
      ];
      return {
        page,
        panels,
        controller,
        dataSource,
        getTimings: () => controller.getTimings(),
        register(shell) {
          shell.registerPage(page);
          const offs = panels.map((entry) => shell.registerPanel(entry.name, entry.panel));
          return () => {
            for (const off of offs) off();
          };
        }
      };
    }
    
    // education/client/visuals/src/answer-forms.ts
    function supportsAnswerForm(activity) {
      return activity.answerSchema.kind !== "diagram_label";
    }
    function mountAnswerForm(container, options) {
      const schema = options.activity.answerSchema;
      if (schema.kind === "diagram_label") return null;
      const root = document.createElement("section");
      root.className = "edu-visual-form";
      root.dataset["eduVisual"] = schema.kind;
      const heading = document.createElement("h3");
      heading.textContent = options.activity.stem;
      root.append(heading);
      const inputs = [];
      let textarea = null;
      let addPairButton = null;
      const pairRows = [];
      if (schema.kind === "choice") {
        const fieldset = document.createElement("fieldset");
        const legend = document.createElement("legend");
        legend.textContent = schema.selection === "single" ? "\u9009\u62E9\u4E00\u4E2A\u7B54\u6848" : "\u53EF\u9009\u62E9\u591A\u4E2A\u7B54\u6848";
        fieldset.append(legend);
        for (const option2 of schema.options) {
          const label = document.createElement("label");
          label.className = "edu-visual-option";
          const input = document.createElement("input");
          input.type = schema.selection === "single" ? "radio" : "checkbox";
          input.name = `choice-${options.activity.id}`;
          input.value = option2.id;
          const span = document.createElement("span");
          span.textContent = option2.label;
          label.append(input, span);
          fieldset.append(label);
          inputs.push(input);
          if (options.initial?.kind === "choice" && options.initial.optionIds.includes(option2.id)) {
            input.checked = true;
          }
        }
        root.append(fieldset);
      }
      if (schema.kind === "text") {
        textarea = document.createElement("textarea");
        textarea.rows = 5;
        if (schema.maxLength !== null) textarea.maxLength = schema.maxLength;
        textarea.setAttribute("aria-label", "\u4F60\u7684\u56DE\u7B54");
        if (options.initial?.kind === "text") textarea.value = options.initial.text;
        root.append(textarea);
        const counter = document.createElement("p");
        counter.className = "edu-visual-counter";
        const update = () => {
          const max = schema.maxLength === null ? "" : ` / ${schema.maxLength}`;
          counter.textContent = `${textarea?.value.length ?? 0}${max} \u5B57`;
        };
        textarea.addEventListener("input", update);
        update();
        root.append(counter);
      }
      if (schema.kind === "relation") {
        const nodes = relationOptions(options, schema);
        const list = document.createElement("div");
        list.className = "edu-visual-pairs";
        const addRow = (initial) => {
          const row = document.createElement("div");
          row.className = "edu-visual-pair";
          row.append(
            select(nodes, "\u8D77\u70B9", initial?.fromId ?? nodes[0]?.id ?? ""),
            select(nodes, "\u7EC8\u70B9", initial?.toId ?? nodes[1]?.id ?? ""),
            relationSelect(initial?.relation ?? null)
          );
          if (pairRows.length > 0) {
            const remove = document.createElement("button");
            remove.type = "button";
            remove.textContent = "\u79FB\u9664";
            remove.addEventListener("click", () => {
              row.remove();
              const index = pairRows.indexOf(row);
              if (index >= 0) pairRows.splice(index, 1);
            });
            row.append(remove);
          }
          list.append(row);
          pairRows.push(row);
        };
        addRow();
        if (options.initial?.kind === "relation") {
          for (const pair of options.initial.pairs.slice(1)) addRow(pair);
        }
        root.append(list);
        addPairButton = document.createElement("button");
        addPairButton.type = "button";
        addPairButton.textContent = "\u518D\u52A0\u4E00\u6761\u5173\u7CFB";
        addPairButton.addEventListener("click", () => addRow());
        root.append(addPairButton);
      }
      const actions = document.createElement("div");
      actions.className = "edu-visual-actions";
      const submit = document.createElement("button");
      submit.type = "button";
      submit.textContent = "\u63D0\u4EA4\u4F5C\u7B54";
      submit.addEventListener("click", () => options.onSubmit(collect()));
      actions.append(submit);
      if (options.onCancel !== void 0) {
        const cancel = document.createElement("button");
        cancel.type = "button";
        cancel.textContent = "\u53D6\u6D88";
        cancel.addEventListener("click", () => options.onCancel?.());
        actions.append(cancel);
      }
      root.append(actions);
      function collect() {
        if (schema.kind === "choice") {
          return { kind: "choice", optionIds: inputs.filter((input) => input.checked).map((input) => input.value) };
        }
        if (schema.kind === "text") {
          return { kind: "text", text: textarea?.value ?? "" };
        }
        const pairs = [];
        for (const row of pairRows) {
          const selects = [...row.querySelectorAll("select")];
          const from = selects[0]?.value ?? "";
          const to = selects[1]?.value ?? "";
          const relationValue = selects[2]?.value ?? "";
          if (from.length === 0 || to.length === 0) continue;
          pairs.push({
            fromId: from,
            toId: to,
            relation: relationValue === "prerequisite" || relationValue === "related" ? relationValue : null
          });
        }
        return { kind: "relation", pairs };
      }
      container.append(root);
      return {
        element: root,
        getValue: collect,
        unmount() {
          root.remove();
        }
      };
    }
    function relationOptions(options, schema) {
      if (options.relationNodes !== void 0 && options.relationNodes.length > 0) {
        return options.relationNodes;
      }
      const ids = /* @__PURE__ */ new Set();
      for (const pair of schema.pairs) {
        ids.add(pair.fromId);
        ids.add(pair.toId);
      }
      return [...ids].map((id) => ({ id, label: id }));
    }
    function select(nodes, label, value) {
      const element = document.createElement("select");
      element.setAttribute("aria-label", label);
      for (const node of nodes) {
        const option2 = document.createElement("option");
        option2.value = node.id;
        option2.textContent = node.label;
        option2.selected = node.id === value;
        element.append(option2);
      }
      return element;
    }
    function relationSelect(value) {
      const element = document.createElement("select");
      element.setAttribute("aria-label", "\u5173\u7CFB\u7C7B\u578B");
      for (const [key, label] of [
        ["prerequisite", "\u5148\u4FEE\uFF08\u8D77\u70B9 \u2192 \u7EC8\u70B9\uFF09"],
        ["related", "\u76F8\u5173"],
        ["", "\u4E0D\u786E\u5B9A"]
      ]) {
        const option2 = document.createElement("option");
        option2.value = key;
        option2.textContent = label;
        option2.selected = key === (value ?? "");
        element.append(option2);
      }
      return element;
    }
    
    // education/client/visuals/src/feedback-view.ts
    var CLARIFICATION_ACTIONS = [
      { id: "retake", label: "\u91CD\u65B0\u62CD\u4E00\u5F20" },
      { id: "rotate", label: "\u65CB\u8F6C\u540E\u91CD\u8BD5" },
      { id: "edit_text", label: "\u6539\u6B63\u8BC6\u522B\u6587\u5B57" },
      { id: "text_fallback", label: "\u6539\u7528\u6587\u5B57\u4F5C\u7B54" },
      { id: "retry_later", label: "\u7A0D\u540E\u518D\u8BD5" }
    ];
    var MET_LABEL = {
      yes: "\u5DF2\u8FBE\u6210",
      no: "\u672A\u8FBE\u6210",
      unclear: "\u5F85\u786E\u8BA4"
    };
    function mountFeedbackView(container, options) {
      const { grade } = options;
      const root = document.createElement("section");
      root.className = "edu-visual-feedback";
      root.dataset["eduVisual"] = "feedback";
      root.setAttribute("aria-live", "polite");
      const heading = document.createElement("h3");
      heading.textContent = grade.requiresClarification ? "\u8FD8\u9700\u8981\u786E\u8BA4" : "\u8FD9\u6B21\u4F5C\u7B54\u7684\u53CD\u9988";
      root.append(heading);
      if (options.injectionNotice !== null && options.injectionNotice !== void 0) {
        const notice3 = document.createElement("p");
        notice3.className = "edu-visual-injection";
        notice3.setAttribute("role", "note");
        notice3.textContent = options.injectionNotice;
        root.append(notice3);
      }
      const text = document.createElement("p");
      text.className = "edu-visual-feedback-text";
      text.textContent = grade.feedback;
      root.append(text);
      const criteriaList = document.createElement("ul");
      criteriaList.className = "edu-visual-criteria";
      criteriaList.setAttribute("aria-label", "\u8BC4\u5206\u8981\u70B9");
      for (const criterion of grade.criteria) {
        const item = document.createElement("li");
        item.dataset["met"] = criterion.met;
        const badge = document.createElement("strong");
        badge.textContent = `\u3010${MET_LABEL[criterion.met]}\u3011`;
        const rationale = document.createElement("span");
        rationale.textContent = criterion.rationale;
        item.append(badge, rationale);
        criteriaList.append(item);
      }
      root.append(criteriaList);
      if (grade.uncertainties.length > 0) {
        const uncertain = document.createElement("div");
        uncertain.className = "edu-visual-uncertainty";
        const title = document.createElement("p");
        title.textContent = "\u4ECD\u7136\u4E0D\u786E\u5B9A\u6216\u9700\u8981\u7559\u610F\uFF1A";
        uncertain.append(title);
        const list = document.createElement("ul");
        for (const reason of grade.uncertainties) {
          const item = document.createElement("li");
          item.textContent = reason;
          list.append(item);
        }
        uncertain.append(list);
        root.append(uncertain);
      }
      if (grade.requiresClarification) {
        const clarification = document.createElement("div");
        clarification.className = "edu-visual-clarify";
        const note = document.createElement("p");
        note.textContent = "\u7CFB\u7EDF\u4E0D\u4F1A\u56E0\u4E3A\u56FE\u7247\u4E0D\u6E05\u6216\u4FE1\u606F\u4E0D\u8DB3\u800C\u5224\u4F60\u7B54\u9519\u3002\u53EF\u4EE5\u8FD9\u6837\u7EE7\u7EED\uFF1A";
        clarification.append(note);
        const actions = document.createElement("div");
        actions.className = "edu-visual-actions";
        for (const action of CLARIFICATION_ACTIONS) {
          const button2 = document.createElement("button");
          button2.type = "button";
          button2.dataset["clarificationAction"] = action.id;
          button2.textContent = action.label;
          button2.addEventListener("click", () => options.onClarificationAction?.(action.id));
          actions.append(button2);
        }
        clarification.append(actions);
        root.append(clarification);
      }
      if (grade.sourceRefs.length > 0) {
        const sources = document.createElement("div");
        sources.className = "edu-visual-sources";
        const title = document.createElement("p");
        title.textContent = "\u4F9D\u636E\u51FA\u5904\uFF1A";
        sources.append(title);
        const list = document.createElement("ul");
        for (const ref of grade.sourceRefs) {
          const item = document.createElement("li");
          const button2 = document.createElement("button");
          button2.type = "button";
          button2.textContent = options.sourceLabel === void 0 ? ref : options.sourceLabel(ref);
          button2.dataset["sourceRef"] = ref;
          button2.addEventListener("click", () => options.onOpenSource?.(ref));
          item.append(button2);
          list.append(item);
        }
        sources.append(list);
        root.append(sources);
      }
      const meta = document.createElement("p");
      meta.className = "edu-visual-meta";
      const candidateNote = options.candidateOnly === true ? "\uFF1B\u8BC1\u636E\u5019\u9009\u5F85\u786E\u8BA4\u540E\u5199\u5165\u8BB0\u5F55" : "";
      meta.textContent = `\u8BC4\u5206\u7248\u672C\uFF1A${grade.graderVersion}\uFF1B${grade.evidenceCandidates.length} \u6761\u8BC1\u636E\u5019\u9009${candidateNote}\u3002`;
      root.append(meta);
      container.append(root);
      return {
        element: root,
        unmount() {
          root.remove();
        }
      };
    }
    
    // education/client/study/src/machine.ts
    var TRANSITIONS = {
      draft: ["submitted"],
      submitted: ["grading", "cancelled", "failed"],
      grading: ["feedback", "failed", "cancelled"],
      feedback: ["draft"],
      failed: ["grading", "draft", "cancelled"],
      cancelled: ["grading", "draft"]
    };
    var ActivityStateMachine = class {
      current = "draft";
      get phase() {
        return this.current;
      }
      can(next) {
        return TRANSITIONS[this.current].includes(next);
      }
      transition(next) {
        if (!this.can(next)) return false;
        this.current = next;
        return true;
      }
      reset() {
        this.current = "draft";
      }
    };
    
    // education/client/study/src/source-view.ts
    var VERIFICATION_LABELS = {
      unverified: "\u6765\u6E90\u5F85\u6838\u5B9E",
      machine_matched: "\u6765\u6E90\u673A\u5668\u5339\u914D",
      human_checked: "\u6765\u6E90\u4EBA\u5DE5\u6838\u5BF9",
      rejected: "\u6765\u6E90\u88AB\u62D2\u7EDD"
    };
    function openSourcePopover(parent, trigger, sources, sourceRefId) {
      const source = sources.find((entry) => entry.sourceRefId === sourceRefId) ?? null;
      const content = h("div", { "data-testid": "study-source-popover" });
      if (source === null) {
        content.append(
          h("h3", { class: "edu-card__title" }, "\u51FA\u5904\u6682\u65F6\u4E0D\u53EF\u7528"),
          h(
            "p",
            { class: "edu-state__body" },
            "\u6CA1\u6709\u627E\u5230\u8FD9\u4E2A\u6765\u6E90\u7684\u9875\u7801\u4FE1\u606F\uFF1B\u4E0D\u4F1A\u8DF3\u5230\u4EFB\u610F\u9875\u9762\uFF0C\u4E5F\u4E0D\u4F1A\u7F16\u9020\u6559\u6750\u5F15\u7528\u3002"
          )
        );
      } else {
        content.append(
          h(
            "div",
            { class: "edu-study-source-grid" },
            h(
              "div",
              { class: "edu-study-source-box", "data-testid": "study-source-pdf" },
              h("p", { class: "edu-muted" }, "PDF \u9875\u5E8F\uFF081 \u57FA\uFF09"),
              h("p", { class: "edu-study-source-value" }, `PDF \u7B2C ${source.pdfPage} \u9875`)
            ),
            h(
              "div",
              { class: "edu-study-source-box", "data-testid": "study-source-printed" },
              h("p", { class: "edu-muted" }, "\u5370\u5237\u9875\u7801\uFF08\u8BFE\u672C\u9875\u811A/\u9875\u7709\u6807\u7B7E\uFF09"),
              h(
                "p",
                { class: "edu-study-source-value" },
                source.printedPage === null ? "\u672A\u8BC6\u522B\uFF08\u4E0D\u63A8\u7B97\uFF09" : `\u8BFE\u672C\u7B2C ${source.printedPage} \u9875`
              )
            )
          ),
          h(
            "p",
            { class: "edu-muted" },
            "PDF \u9875\u5E8F\u4E0E\u5370\u5237\u9875\u7801\u662F\u4E0D\u540C\u5355\u4F4D\uFF0C\u4E0D\u80FD\u4E92\u76F8\u66FF\u4EE3\uFF1B\u672A\u8BC6\u522B\u5370\u5237\u9875\u65F6\u4E0D\u505A\u504F\u79FB\u731C\u6D4B\u3002"
          ),
          h(
            "p",
            { class: "edu-inline-actions" },
            statusChip(VERIFICATION_LABELS[source.verification], source.verification === "human_checked" ? "positive" : "attention"),
            h("span", { class: "edu-muted" }, `\u6765\u6E90\uFF1A${source.label}`)
          ),
          h(
            "p",
            { class: "edu-muted" },
            "\u67E5\u770B\u51FA\u5904\u4E0D\u4F1A\u63D0\u4EA4\u4F5C\u7B54\u3001\u4E0D\u4F1A\u5B8C\u6210\u6D3B\u52A8\uFF1B\u5173\u95ED\u540E\u7126\u70B9\u8FD4\u56DE\u521A\u624D\u7684\u51FA\u5904\u6309\u94AE\u3002"
          )
        );
      }
      const modal = new Modal("\u51FA\u5904", content, "\u5173\u95ED\u51FA\u5904");
      modal.open(trigger, parent);
    }
    
    // education/client/study/src/labels.ts
    var PHASE_LABELS = {
      draft: "\u8349\u7A3F",
      submitted: "\u5DF2\u63D0\u4EA4\uFF0C\u6B63\u5728\u4FDD\u5B58",
      grading: "\u6B63\u5728\u7B49\u5F85\u53CD\u9988",
      feedback: "\u6709\u53CD\u9988",
      failed: "\u63D0\u4EA4\u672A\u5B8C\u6210",
      cancelled: "\u5DF2\u53D6\u6D88"
    };
    var PHASE_TONES = {
      draft: "neutral",
      submitted: "progress",
      grading: "progress",
      feedback: "positive",
      failed: "danger",
      cancelled: "neutral"
    };
    var HELP_ACTIONS = [
      { kind: "hint", label: "\u7ED9\u6211\u63D0\u793A", note: "\u4F1A\u8BB0\u4E3A\u4F7F\u7528\u63D0\u793A\uFF1B\u63D0\u793A\u4E0D\u7B49\u4E8E\u5B8C\u6574\u7B54\u6848\u3002" },
      { kind: "explanation", label: "\u89E3\u91CA\u4E00\u4E0B", note: "\u4F1A\u8BB0\u4E3A\u4F7F\u7528\u89E3\u91CA\uFF1B\u89E3\u91CA\u4ECD\u53EF\u80FD\u4FDD\u7559\u72EC\u7ACB\u601D\u8003\u7A7A\u95F4\u3002" },
      { kind: "example", label: "\u770B\u4E2A\u793A\u8303", note: "\u4F1A\u8BB0\u4E3A\u4F7F\u7528\u793A\u4F8B\uFF1B\u793A\u8303\u4F1A\u5F71\u54CD\u672C\u6B21\u72EC\u7ACB\u8BC1\u636E\u5224\u65AD\u3002" },
      {
        kind: "worked_solution",
        label: "\u5206\u6B65\u793A\u8303",
        note: "\u4F1A\u663E\u793A\u5B8C\u6574\u6B65\u9AA4\uFF0C\u5C5E\u4E8E disclosure\uFF1B\u672C\u6B21\u4F5C\u7B54\u4E0D\u80FD\u4F5C\u4E3A\u72EC\u7ACB\u8BC1\u636E\u3002"
      },
      {
        kind: "answer",
        label: "\u76F4\u63A5\u770B\u7B54\u6848",
        note: "\u4F1A\u663E\u793A\u7B54\u6848\uFF0C\u5C5E\u4E8E disclosure\uFF1B\u672C\u6B21\u4F5C\u7B54\u4E0D\u80FD\u4F5C\u4E3A\u72EC\u7ACB\u8BC1\u636E\u3002"
      }
    ];
    var SKIP_NOTE = "\u8DF3\u8FC7\u672C\u9898\u4E0D\u4F1A\u8BB0\u4E3A\u7B54\u9519\uFF0C\u4E5F\u4E0D\u4F1A\u4F2A\u9020\u6D3B\u52A8\u5B8C\u6210\uFF1B\u53EF\u4EE5\u7A0D\u540E\u56DE\u6765\u3002";
    var DRAFT_SAVED = "\u8349\u7A3F\u5DF2\u4FDD\u5B58\u5728\u672C\u673A\u3002";
    var DRAFT_UNSAVED = "\u8349\u7A3F\u5C1A\u672A\u4FDD\u5B58\uFF1B\u79BB\u5F00\u524D\u8BF7\u91CD\u8BD5\u3002";
    var REVIEW_REASON_LABELS2 = {
      due: "\u5DF2\u5230\u590D\u4E60\u65F6\u95F4",
      needs_support: "\u6700\u8FD1\u8BC1\u636E\u663E\u793A\u9700\u5DE9\u56FA",
      chosen: "\u4F60\u81EA\u9009\u7684\u8303\u56F4"
    };
    var DISCLOSURE_NOTE = "\u672C\u8F6E\u5DF2\u7ECF\u663E\u793A\u5B8C\u6574\u7B54\u6848\u6216\u5206\u6B65\u793A\u8303\u3002\u6309\u8BC1\u636E\u89C4\u5219\uFF0C\u63A5\u4E0B\u6765\u8FD9\u6B21\u4F5C\u7B54\u4F1A\u6807\u4E3A\u4F7F\u7528\u4E86 disclosure/assisted\uFF0C\u4E0D\u80FD\u4F5C\u4E3A\u72EC\u7ACB\u638C\u63E1\u8BC1\u636E\uFF1B\u8FD9\u662F\u8BB0\u5F55\u65B9\u5F0F\uFF0C\u4E0D\u662F\u60E9\u7F5A\u3002";
    var ASSISTANCE_NOTE = "\u672C\u8F6E\u5DF2\u4F7F\u7528\u63D0\u793A\u3001\u89E3\u91CA\u6216\u793A\u4F8B\u3002\u7CFB\u7EDF\u4F1A\u628A\u5E2E\u52A9\u4F7F\u7528\u8BB0\u5F55\u5728\u672C\u6B21\u4F5C\u7B54\u4E2D\uFF1B\u662F\u5426\u7B97\u72EC\u7ACB\u8BC1\u636E\u7531\u670D\u52A1\u89C4\u5219\u5224\u65AD\uFF0C\u4E0D\u7531\u754C\u9762\u81EA\u884C\u51B3\u5B9A\u3002";
    var LOW_DIFFICULTY_NOTE = "\u8FDE\u7EED\u53D7\u632B\u65F6\u53EF\u4EE5\u9009\u62E9\u6362\u4E00\u79CD\u8BB2\u6CD5\uFF1B\u5177\u4F53\u964D\u4F4E\u96BE\u5EA6\u6216\u6362\u8868\u793A\u7531\u6559\u5B66\u670D\u52A1\u51B3\u5B9A\uFF0C\u754C\u9762\u4E0D\u81EA\u884C\u6539\u6559\u5B66\u7B56\u7565\u3002";
    function decisionNotice(decision) {
      if (decision.disclosure) return DISCLOSURE_NOTE;
      if (decision.action === "hint" || decision.action === "layered_explanation" || decision.action === "example" || decision.action === "worked_example") {
        return ASSISTANCE_NOTE;
      }
      return null;
    }
    function answerInputType(value) {
      if (value.kind === "text") return "text";
      if (value.kind === "choice") return "choice";
      return "relation";
    }
    function encodeAnswer(activity, value) {
      switch (value.kind) {
        case "text":
          return value.text;
        case "choice":
          return JSON.stringify({ kind: "choice", optionIds: value.optionIds });
        case "relation":
          return JSON.stringify({ kind: "relation", pairs: value.pairs });
        default:
          return JSON.stringify(value);
      }
    }
    function formatStudyTime(timestamp) {
      if (timestamp === null) return "\u2014";
      const date = new Date(timestamp);
      if (Number.isNaN(date.getTime())) return timestamp;
      try {
        return new Intl.DateTimeFormat("zh-CN", {
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
          hour: "2-digit",
          minute: "2-digit"
        }).format(date);
      } catch {
        return timestamp;
      }
    }
    
    // education/client/study/src/controller.ts
    var IMAGE_MIMES = ["image/png", "image/jpeg"];
    var IMAGE_MAX_BYTES = 5 * 1024 * 1024;
    function bytesToBase64(bytes) {
      let binary = "";
      const chunk = 32768;
      for (let offset = 0; offset < bytes.length; offset += chunk) {
        binary += String.fromCharCode(...bytes.subarray(offset, offset + chunk));
      }
      return btoa(binary);
    }
    function pngSize(bytes) {
      if (bytes.length < 24) return null;
      const signature = [137, 80, 78, 71, 13, 10, 26, 10];
      if (signature.some((value, index) => bytes[index] !== value)) return null;
      return {
        width: bytes[16] << 24 | bytes[17] << 16 | bytes[18] << 8 | bytes[19],
        height: bytes[20] << 24 | bytes[21] << 16 | bytes[22] << 8 | bytes[23]
      };
    }
    function jpegSize(bytes) {
      if (bytes.length < 4 || bytes[0] !== 255 || bytes[1] !== 216) return null;
      let offset = 2;
      while (offset + 9 < bytes.length) {
        if (bytes[offset] !== 255) {
          offset += 1;
          continue;
        }
        const marker = bytes[offset + 1] ?? 0;
        if (marker === 216 || marker === 217 || marker >= 208 && marker <= 215) {
          offset += 2;
          continue;
        }
        const length = (bytes[offset + 2] ?? 0) << 8 | (bytes[offset + 3] ?? 0);
        if (length < 2) return null;
        if (marker >= 192 && marker <= 207 && marker !== 196 && marker !== 200 && marker !== 204) {
          return {
            height: (bytes[offset + 5] ?? 0) << 8 | (bytes[offset + 6] ?? 0),
            width: (bytes[offset + 7] ?? 0) << 8 | (bytes[offset + 8] ?? 0)
          };
        }
        offset += 2 + length;
      }
      return null;
    }
    async function readImageFile(file) {
      const mime = file.type.toLowerCase();
      if (!IMAGE_MIMES.includes(mime)) {
        throw new Error("\u53EA\u652F\u6301 PNG \u6216 JPEG \u56FE\u7247\uFF1B\u8BF7\u91CD\u65B0\u62CD\u7167\u6216\u9009\u62E9\u56FE\u7247\u3002");
      }
      if (file.size > IMAGE_MAX_BYTES) {
        throw new Error("\u56FE\u7247\u8D85\u8FC7 5 MB\uFF1B\u8BF7\u538B\u7F29\u3001\u91CD\u62CD\uFF0C\u6216\u6539\u7528\u6587\u5B57\u4F5C\u7B54\u3002");
      }
      const buffer = await file.arrayBuffer();
      const bytes = new Uint8Array(buffer);
      if (bytes.length === 0) {
        throw new Error("\u56FE\u7247\u662F\u7A7A\u6587\u4EF6\uFF1B\u8BF7\u91CD\u65B0\u9009\u62E9\u3002");
      }
      const base64 = bytesToBase64(bytes);
      const size = mime === "image/png" ? pngSize(bytes) : jpegSize(bytes);
      return {
        base64,
        mime,
        width: size?.width ?? 0,
        height: size?.height ?? 0,
        fileName: file.name.length > 0 ? file.name : "\u4F5C\u7B54\u56FE\u7247",
        byteSize: file.size,
        dataUrl: `data:${mime};base64,${base64}`
      };
    }
    var StudyController = class {
      options;
      machine = new ActivityStateMachine();
      renderers = /* @__PURE__ */ new Set();
      pageContext = null;
      navigate = null;
      materialContainer = null;
      chatContainer = null;
      activityContainer = null;
      feedbackContainer = null;
      feedbackRoot = null;
      draftStatusNode = null;
      intent = { conceptId: null, mode: "learn", sessionId: null, activityId: null, fromResume: false };
      workspace = null;
      session = null;
      tutorState = null;
      progress = null;
      selfReport = null;
      activity = null;
      answer = null;
      draft = null;
      draftStatus = "none";
      draftError = null;
      draftToken = 0;
      loading = true;
      error = null;
      loadToken = 0;
      loadedKey = "";
      phase = "draft";
      form = null;
      formActivityId = null;
      feedback = null;
      feedbackController = null;
      attemptId = null;
      failedError = null;
      failureNotice = "";
      lateNotice = "";
      skipNotice = "";
      finishReceipt = null;
      finishLabel = "";
      reviewRange = null;
      reviewSelected = /* @__PURE__ */ new Set();
      reviewSkipped = false;
      reviewNotice = "";
      messages = [];
      chatText = "";
      chatNotice = "";
      chatError = null;
      helpNotice = "";
      submitGen = 0;
      currentToken = null;
      lastSubmitRequestId = null;
      imageMode = false;
      imageDraft = null;
      imagePreviewed = false;
      imageBusy = false;
      imageNotice = "";
      imageFileError = "";
      imageResult = null;
      imageError = null;
      imageInput = null;
      imageGen = 0;
      constructor(options) {
        this.options = options;
      }
      getState() {
        return {
          phase: this.phase,
          workspace: this.workspace,
          session: this.session,
          tutorState: this.tutorState,
          feedback: this.feedback,
          selfReport: this.selfReport,
          draftStatus: this.draftStatus,
          reviewRange: this.reviewRange,
          messages: [...this.messages],
          finishReceipt: this.finishReceipt,
          loading: this.loading,
          error: this.error
        };
      }
      /* ------------------------------------------------------------ mounting */
      async onPageMount(context) {
        this.pageContext = context;
        this.navigate = context.navigate;
        const nextIntent = this.resolveIntent(context);
        const key = `${nextIntent.conceptId ?? "none"}|${nextIntent.mode}|${nextIntent.sessionId ?? "new"}|${nextIntent.activityId ?? "none"}`;
        this.intent = nextIntent;
        if (key !== this.loadedKey) {
          this.loadedKey = key;
          this.resetView();
          await this.load(key);
        } else {
          this.notify();
        }
      }
      onPageUnmount() {
        this.submitGen += 1;
        if (this.currentToken !== null) this.currentToken.cancelled = true;
        this.pageContext = null;
        this.navigate = null;
        this.renderers.clear();
        this.form?.unmount();
        this.form = null;
        this.feedbackController?.unmount();
        this.feedbackController = null;
        this.imageInput = null;
        this.materialContainer = null;
        this.chatContainer = null;
        this.activityContainer = null;
        this.feedbackContainer = null;
        this.feedbackRoot = null;
        this.draftStatusNode = null;
      }
      mountMaterial(container) {
        this.materialContainer = container;
        this.renderers.add(() => this.renderMaterial());
        this.renderMaterial();
      }
      mountChat(container) {
        this.chatContainer = container;
        this.renderers.add(() => this.renderChat());
        this.renderChat();
      }
      mountActivity(container) {
        this.activityContainer = container;
        this.renderers.add(() => this.renderActivity());
        this.renderActivity();
      }
      mountFeedback(container) {
        this.feedbackContainer = container;
        container.tabIndex = -1;
        this.renderers.add(() => this.renderFeedback());
        this.renderFeedback();
      }
      notify() {
        for (const renderer of this.renderers) renderer();
      }
      /* --------------------------------------------------------------- intent */
      resolveIntent(context) {
        const state = context.services.getState();
        const path = state.currentPath;
        const query = new URLSearchParams(path.includes("?") ? path.slice(path.indexOf("?") + 1) : "");
        const queryConcept = query.get("concept");
        const queryMode = query.get("mode");
        const queryActivity = query.get("activity");
        const resume = state.resume;
        if (resume !== null && queryConcept === null && queryMode === null) {
          return {
            conceptId: resume.session.conceptId,
            mode: resume.session.mode === "review" ? "review" : "learn",
            sessionId: resume.session.id,
            activityId: resume.activityId,
            fromResume: true
          };
        }
        const mode = queryMode === "review" ? "review" : "learn";
        return {
          conceptId: queryConcept,
          mode,
          sessionId: null,
          activityId: queryActivity,
          fromResume: false
        };
      }
      resetView() {
        this.workspace = null;
        this.session = null;
        this.tutorState = null;
        this.progress = null;
        this.selfReport = null;
        this.activity = null;
        this.answer = null;
        this.draft = null;
        this.draftStatus = "none";
        this.draftError = null;
        this.phase = "draft";
        this.machine.reset();
        this.form?.unmount();
        this.form = null;
        this.feedback = null;
        this.feedbackController?.unmount();
        this.feedbackController = null;
        this.attemptId = null;
        this.failedError = null;
        this.failureNotice = "";
        this.lateNotice = "";
        this.skipNotice = "";
        this.finishReceipt = null;
        this.finishLabel = "";
        this.reviewRange = null;
        this.reviewSelected.clear();
        this.reviewSkipped = false;
        this.reviewNotice = "";
        this.messages = [];
        this.chatText = "";
        this.chatNotice = "";
        this.chatError = null;
        this.helpNotice = "";
        this.imageMode = false;
        this.imageDraft = null;
        this.imagePreviewed = false;
        this.imageBusy = false;
        this.imageNotice = "";
        this.imageFileError = "";
        this.imageResult = null;
        this.imageError = null;
        this.imageInput = null;
        this.loading = true;
        this.error = null;
      }
      async load(key) {
        const token = ++this.loadToken;
        this.loading = true;
        this.error = null;
        this.notify();
        if (this.intent.conceptId === null) {
          if (this.intent.mode === "review") {
            const range = await this.options.dataSource.loadReviewRange(this.request());
            if (token !== this.loadToken) return;
            this.loading = false;
            if (!range.ok) this.error = range.error;
            else {
              this.reviewRange = range.data;
              this.reviewSelected = new Set(range.data.candidates.slice(0, 1).map((entry) => entry.conceptId));
              this.reviewNotice = "\u8BF7\u9009\u62E9\u63A8\u8350\u8303\u56F4\uFF0C\u6216\u8DF3\u8FC7\u63A8\u8350\u81EA\u9009\u8303\u56F4\u3002";
              this.messages = [assistant("\u5148\u9009\u62E9\u590D\u4E60\u8303\u56F4\uFF1B\u5F00\u59CB\u540E\u4F1A\u5148\u56DE\u5FC6\uFF0C\u518D\u7ED9\u53CD\u9988\u3002")];
            }
            this.notify();
            return;
          }
          this.loading = false;
          this.error = null;
          this.notify();
          return;
        }
        const result = await this.options.dataSource.loadWorkspace(this.request(), {
          conceptId: this.intent.conceptId,
          mode: this.intent.mode,
          sessionId: this.intent.sessionId ?? void 0,
          activityId: this.intent.activityId
        });
        if (token !== this.loadToken) return;
        if (!result.ok) {
          this.loading = false;
          this.error = result.error;
          this.loadedKey = key;
          this.notify();
          return;
        }
        this.workspace = result.data;
        this.progress = result.data.progress;
        this.selfReport = result.data.selfReport;
        this.activity = result.data.activity;
        this.loading = false;
        this.reviewRange = this.intent.mode === "review" && !this.intent.fromResume ? result.data.reviewRange : null;
        if (this.reviewRange !== null) {
          this.reviewSelected = new Set(
            this.intent.conceptId === null ? this.reviewRange.candidates.slice(0, 1).map((entry) => entry.conceptId) : [this.intent.conceptId]
          );
          this.notify();
          return;
        }
        await this.startSession();
      }
      async startSession() {
        if (this.workspace === null) return;
        const result = await this.options.dataSource.startSession(this.request(), {
          conceptId: this.workspace.concept.id,
          mode: this.intent.mode,
          sessionId: this.intent.sessionId ?? void 0,
          activityId: this.workspace.activity.id
        });
        if (!result.ok) {
          this.error = result.error;
          this.notify();
          return;
        }
        this.session = result.data;
        this.tutorState = result.data.state;
        this.activity = this.workspace.activity;
        this.phase = "draft";
        this.machine.reset();
        this.feedback = null;
        this.finishReceipt = null;
        const draft = await this.options.dataSource.loadDraft(this.request(), this.draftKey());
        if (draft.ok && draft.data !== null) {
          this.draft = draft.data;
          this.answer = draft.data.answer;
          this.draftStatus = "saved";
        }
        this.messages = [
          assistant(
            this.intent.mode === "review" ? "\u590D\u4E60\u5148\u56DE\u5FC6\uFF0C\u518D\u7ED9\u53CD\u9988\u3002\u53EF\u4EE5\u968F\u65F6\u6253\u5F00\u6750\u6599\u3001\u8981\u63D0\u793A\u6216\u7ED3\u675F\u672C\u8F6E\u3002" : "\u5148\u8BFB\u6750\u6599\uFF0C\u518D\u8BD5\u7740\u7528\u81EA\u5DF1\u7684\u8BDD\u56DE\u7B54\uFF1B\u968F\u65F6\u53EF\u4EE5\u8981\u63D0\u793A\u3001\u89E3\u91CA\u6216\u793A\u8303\u3002"
          )
        ];
        this.notify();
      }
      request() {
        return this.options.createRequest();
      }
      draftKey() {
        return {
          conceptId: this.workspace?.concept.id ?? this.intent.conceptId ?? "",
          mode: this.intent.mode,
          activityId: this.activity?.id ?? ""
        };
      }
      /* --------------------------------------------------------------- drafts */
      async autosave(value) {
        this.answer = value;
        if (this.workspace === null || this.activity === null) return;
        const token = ++this.draftToken;
        this.draftStatus = "saving";
        this.draftError = null;
        this.updateDraftStatusNodes();
        const draft = {
          conceptId: this.workspace.concept.id,
          mode: this.intent.mode,
          activityId: this.activity.id,
          answer: value,
          savedAt: (/* @__PURE__ */ new Date()).toISOString()
        };
        const result = await this.options.dataSource.saveDraft(this.request(), draft);
        if (token !== this.draftToken) return;
        if (result.ok) {
          this.draft = draft;
          this.draftStatus = "saved";
        } else {
          this.draftStatus = "failed";
          this.draftError = result.error;
        }
        this.updateDraftStatusNodes();
        if (this.phase === "draft") this.notify();
      }
      updateDraftStatusNodes() {
        if (this.draftStatusNode !== null) {
          this.draftStatusNode.textContent = this.draftStatus === "saved" ? DRAFT_SAVED : this.draftStatus === "saving" ? "\u6B63\u5728\u4FDD\u5B58\u8349\u7A3F\u2026" : this.draftStatus === "failed" ? DRAFT_UNSAVED : "";
          this.draftStatusNode.dataset["state"] = this.draftStatus;
        }
      }
      /* ------------------------------------------------------------ activity */
      async submit(value) {
        const answer = value ?? this.answer;
        if (answer === null || this.session === null || this.activity === null || this.workspace === null) return;
        if (this.phase !== "draft" && this.phase !== "failed" && this.phase !== "cancelled") return;
        if (!hasAnswer(answer)) {
          this.failureNotice = "\u5148\u5199\u4E00\u70B9\u5185\u5BB9\uFF0C\u6216\u9009\u62E9\u4E00\u4E2A\u9009\u9879\uFF0C\u518D\u63D0\u4EA4\u3002";
          this.notify();
          return;
        }
        this.answer = answer;
        this.failedError = null;
        this.failureNotice = "";
        this.lateNotice = "";
        if (this.phase === "failed" || this.phase === "cancelled") this.machine.reset();
        this.machine.transition("submitted");
        this.phase = "submitted";
        this.notify();
        const generation = ++this.submitGen;
        const token = { cancelled: false };
        this.currentToken = token;
        await Promise.resolve();
        if (generation !== this.submitGen) return;
        this.machine.transition("grading");
        this.phase = "grading";
        this.notify();
        const request = this.request();
        const requestId2 = request.requestId;
        this.lastSubmitRequestId = requestId2;
        const result = await this.options.dataSource.submitTurn(
          { ...request, signal: token },
          {
            requestId: requestId2,
            sessionId: this.session.session.id,
            revision: this.tutorState?.revision ?? this.session.state.revision,
            attempt: {
              activityId: this.activity.id,
              inputType: answerInputType(answer),
              answerText: encodeAnswer(this.activity, answer)
            }
          }
        );
        if (generation !== this.submitGen) {
          this.lateNotice = "\u8FD9\u6B21\u53CD\u9988\u8FD4\u56DE\u5F97\u592A\u665A\uFF0C\u5DF2\u4E22\u5F03\u4E3A\u8FDF\u5230\u7ED3\u679C\uFF1B\u4E0D\u4F1A\u5199\u56DE\u5F53\u524D\u6D3B\u52A8\u6216\u5176\u4ED6\u6982\u5FF5\u3002";
          this.notify();
          return;
        }
        if (token.cancelled) return;
        if (!result.ok) {
          this.phase = "failed";
          this.failedError = result.error;
          this.failureNotice = result.error.code === "UNAVAILABLE" ? "\u4E91\u7AEF\u53CD\u9988\u6682\u4E0D\u53EF\u7528\uFF1B\u672C\u5730\u6750\u6599\u3001\u539F\u7B54\u548C\u8349\u7A3F\u4ECD\u4FDD\u7559\uFF0C\u4E0D\u4F1A\u4F2A\u9020\u6A21\u578B\u56DE\u590D\u3002" : "";
          this.machine.transition("failed");
          this.notify();
          return;
        }
        this.applyTurn(result.data);
      }
      applyTurn(outcome) {
        this.tutorState = outcome.state;
        this.messages = [...this.messages, assistant(outcome.message, outcome.decision.disclosure)];
        this.helpNotice = decisionNotice(outcome.decision) ?? "";
        const attempt = outcome.attemptOutcome;
        if (attempt === null) {
          this.phase = this.phase === "grading" || this.phase === "submitted" ? "draft" : this.phase;
          this.notify();
          return;
        }
        this.attemptId = attempt.attemptId;
        if (!attempt.persisted) {
          this.phase = "failed";
          this.machine.transition("failed");
          this.failedError = { code: "STORAGE_FAILED", message: "\u539F\u7B54\u6CA1\u6709\u4FDD\u5B58\u6210\u529F", retryable: true };
          this.notify();
          return;
        }
        if (this.imageMode) {
          this.imageResult = outcome.image ?? this.imageResult;
          if (attempt.grade !== null && attempt.grade.requiresClarification) {
            this.feedback = attempt.grade;
            this.phase = "feedback";
            this.machine.transition("feedback");
            this.imageNotice = "\u8FD9\u6B21\u56FE\u7247\u53EA\u8BB0\u4E3A\u5F85\u6F84\u6E05\uFF0C\u6CA1\u6709\u5199\u5165\u6210\u7EE9\uFF1B\u53EF\u4EE5\u91CD\u62CD\u6216\u6539\u7528\u6587\u5B57\u3002";
            this.notify();
            this.focusFeedback();
            return;
          }
        }
        if (attempt.feedbackPending || attempt.grade === null) {
          if (this.imageMode) {
            this.imageResult = outcome.image ?? this.imageResult;
            this.imageNotice = attempt.duplicate ? "\u8FD9\u5F20\u56FE\u7247\u6B64\u524D\u5DF2\u7ECF\u63D0\u4EA4\u8FC7\uFF1B\u672C\u6B21\u4E0D\u91CD\u590D\u8BB0\u7B54\uFF0C\u4E5F\u4E0D\u518D\u5224\u5206\u3002" : "\u56FE\u7247\u5DF2\u4FDD\u5B58\u4E3A\u5F85\u6279\u6539\uFF1B\u53CD\u9988\u6682\u65F6\u6CA1\u6709\u5B8C\u6210\uFF0C\u53EF\u4EE5\u91CD\u8BD5\u6279\u6539\u6216\u6539\u7528\u6587\u5B57\u4F5C\u7B54\u3002";
            this.phase = "feedback";
            this.machine.transition("feedback");
            this.notify();
            return;
          }
          this.phase = "failed";
          this.machine.transition("failed");
          this.failureNotice = "\u539F\u7B54\u5DF2\u7ECF\u4FDD\u5B58\uFF0C\u53CD\u9988\u6682\u65F6\u6CA1\u6709\u5B8C\u6210\uFF1B\u53EF\u4EE5\u91CD\u8BD5\u6279\u6539\uFF0C\u4E0D\u9700\u8981\u91CD\u65B0\u4F5C\u7B54\u3002";
          this.notify();
          return;
        }
        this.feedback = attempt.grade;
        this.phase = "feedback";
        this.machine.transition("feedback");
        this.form?.unmount();
        this.form = null;
        void this.clearDraft();
        this.notify();
        this.focusFeedback();
      }
      cancelTurn() {
        if (this.phase !== "submitted" && this.phase !== "grading") return;
        this.submitGen += 1;
        if (this.currentToken !== null) this.currentToken.cancelled = true;
        this.currentToken = null;
        this.machine.transition("cancelled");
        this.phase = "cancelled";
        this.lateNotice = "\u5DF2\u53D6\u6D88\u672C\u6B21\u53CD\u9988\uFF1B\u4E4B\u540E\u5230\u8FBE\u7684\u7ED3\u679C\u4F1A\u4E22\u5F03\uFF0C\u539F\u7B54\u548C\u8349\u7A3F\u4ECD\u4FDD\u7559\u3002";
        this.notify();
      }
      async retry() {
        if (this.session === null) return;
        if (this.attemptId !== null) {
          const request = this.request();
          this.phase = "grading";
          this.machine.transition("grading");
          this.notify();
          const result = await this.options.dataSource.retryPendingGrading(request, {
            sessionId: this.session.session.id,
            requestId: request.requestId
          });
          if (!result.ok) {
            this.phase = "failed";
            this.failedError = result.error;
            this.notify();
            return;
          }
          if (result.data.grade !== null) {
            this.feedback = result.data.grade;
            this.phase = "feedback";
            this.machine.transition("feedback");
            void this.clearDraft();
            this.notify();
            this.focusFeedback();
          } else {
            this.phase = "failed";
            this.notify();
          }
          return;
        }
        this.phase = "draft";
        this.machine.reset();
        await this.submit(this.answer ?? void 0);
      }
      editAnswer() {
        if (this.phase !== "feedback" && this.phase !== "failed" && this.phase !== "cancelled") return;
        this.phase = "draft";
        this.machine.reset();
        this.form?.unmount();
        this.form = null;
        this.notify();
      }
      async skip() {
        if (this.session === null) return;
        const request = this.request();
        const result = await this.options.dataSource.skip(request, {
          requestId: request.requestId,
          sessionId: this.session.session.id,
          revision: this.tutorState?.revision ?? this.session.state.revision
        });
        if (!result.ok) {
          this.chatError = result.error;
          this.notify();
          return;
        }
        this.tutorState = result.data.state;
        this.skipNotice = result.data.message || SKIP_NOTE;
        this.messages = [...this.messages, system(this.skipNotice)];
        this.notify();
      }
      async finishRound() {
        if (this.session === null) return;
        const request = this.request();
        const revision = this.tutorState?.revision ?? this.session.state.revision;
        const result = this.intent.mode === "review" ? await this.options.dataSource.finishReview(request, {
          requestId: request.requestId,
          sessionId: this.session.session.id,
          revision
        }) : await this.options.dataSource.finishLearning(request, {
          requestId: request.requestId,
          sessionId: this.session.session.id,
          revision
        });
        if (!result.ok) {
          this.failedError = result.error;
          this.notify();
          return;
        }
        this.finishReceipt = result.data;
        this.finishLabel = this.intent.mode === "review" ? "\u672C\u8F6E\u590D\u4E60\u7ED3\u679C" : "\u672C\u8F6E\u5B66\u4E60\u7ED3\u679C";
        this.phase = "feedback";
        this.machine.transition(this.phase);
        this.form?.unmount();
        this.form = null;
        const progress2 = await this.options.dataSource.loadProgress(request, this.workspace?.concept.id ?? "");
        if (progress2.ok) this.progress = progress2.data;
        this.notify();
        this.focusFeedback();
      }
      leaveUnfinished() {
        void this.persistNow();
        this.navigate?.("/map");
      }
      async lowerDifficulty() {
        await this.sendMessage("\u6211\u8FDE\u7EED\u6CA1\u7B54\u51FA\u6765\uFF0C\u8BF7\u6362\u4E00\u79CD\u66F4\u7B80\u5355\u7684\u8BB2\u6CD5\u3002");
      }
      async sendHelp(kind) {
        if (this.session === null) return;
        const action = HELP_ACTIONS.find((entry) => entry.kind === kind);
        this.messages = [...this.messages, { role: "student", text: action?.label ?? kind, disclosure: false }];
        this.helpNotice = action?.note ?? "";
        this.notify();
        const request = this.request();
        const result = await this.options.dataSource.submitTurn(request, {
          requestId: request.requestId,
          sessionId: this.session.session.id,
          revision: this.tutorState?.revision ?? this.session.state.revision,
          helpRequest: kind
        });
        if (!result.ok) {
          this.chatError = result.error;
          this.notify();
          return;
        }
        this.tutorState = result.data.state;
        this.messages = [...this.messages, assistant(result.data.message, result.data.decision.disclosure)];
        this.helpNotice = decisionNotice(result.data.decision) ?? action?.note ?? "";
        this.notify();
      }
      async sendMessage(text) {
        const value = text.trim();
        if (value.length === 0 || this.session === null) return;
        this.chatText = "";
        this.messages = [...this.messages, { role: "student", text: value, disclosure: false }];
        this.notify();
        const request = this.request();
        const result = await this.options.dataSource.submitTurn(request, {
          requestId: request.requestId,
          sessionId: this.session.session.id,
          revision: this.tutorState?.revision ?? this.session.state.revision,
          message: value
        });
        if (!result.ok) {
          this.chatError = result.error;
          this.notify();
          return;
        }
        this.tutorState = result.data.state;
        this.messages = [...this.messages, assistant(result.data.message, result.data.decision.disclosure)];
        this.helpNotice = decisionNotice(result.data.decision) ?? this.helpNotice;
        this.notify();
      }
      setChatText(text) {
        this.chatText = text;
      }
      async saveSelfReport(state) {
        if (this.workspace === null) return;
        const result = await this.options.dataSource.saveSelfReport(this.request(), {
          conceptId: this.workspace.concept.id,
          claimedState: state
        });
        if (result.ok) {
          this.selfReport = result.data;
          this.notify();
        } else {
          this.failedError = result.error;
          this.notify();
        }
      }
      async startReview(conceptId) {
        if (this.workspace !== null && this.workspace.concept.id === conceptId) {
          await this.startSession();
          this.reviewRange = null;
          this.notify();
          return;
        }
        const workspace = await this.options.dataSource.loadWorkspace(this.request(), {
          conceptId,
          mode: "review"
        });
        if (!workspace.ok) {
          this.error = workspace.error;
          this.notify();
          return;
        }
        this.workspace = workspace.data;
        this.progress = workspace.data.progress;
        this.selfReport = workspace.data.selfReport;
        this.activity = workspace.data.activity;
        this.intent = { ...this.intent, conceptId };
        this.reviewRange = null;
        await this.startSession();
      }
      toggleReview(conceptId, selected) {
        if (selected) this.reviewSelected.add(conceptId);
        else this.reviewSelected.delete(conceptId);
      }
      skipReviewRange() {
        this.reviewSkipped = true;
        this.reviewNotice = "\u5DF2\u8DF3\u8FC7\u63A8\u8350\uFF1B\u53EF\u4EE5\u81EA\u9009\u8303\u56F4\u5F00\u59CB\u590D\u4E60\uFF0C\u4E0D\u4F1A\u81EA\u52A8\u751F\u6210\u638C\u63E1\u5224\u65AD\u3002";
        this.notify();
      }
      async deferReview() {
        const conceptId = [...this.reviewSelected][0] ?? this.reviewRange?.candidates[0]?.conceptId;
        if (conceptId === void 0) return;
        const result = await this.options.dataSource.deferReview(this.request(), conceptId);
        if (!result.ok) {
          this.reviewNotice = "\u6682\u7F13\u6CA1\u6709\u5B8C\u6210\uFF1B\u8BF7\u7A0D\u540E\u91CD\u8BD5\u3002";
          this.notify();
          return;
        }
        this.reviewNotice = `\u5DF2\u6682\u7F13\u4E00\u6B21\uFF1B\u65B0\u7684\u5F85\u590D\u4E60\u65F6\u95F4\uFF1A${formatStudyTime(result.data.dueAt)}\u3002\u4E0D\u4F1A\u6539\u4E3A\u201C\u5DF2\u590D\u4E60\u201D\u3002`;
        this.notify();
      }
      startImageMode() {
        if (this.workspace === null || this.workspace.imageFlow === null) return;
        this.imageMode = true;
        this.form?.unmount();
        this.form = null;
        this.imageDraft = null;
        this.imagePreviewed = false;
        this.imageBusy = false;
        this.imageNotice = "";
        this.imageFileError = "";
        this.imageResult = null;
        this.imageError = null;
        this.notify();
      }
      stopImageMode() {
        this.imageGen += 1;
        this.imageMode = false;
        this.imageDraft = null;
        this.imagePreviewed = false;
        this.imageBusy = false;
        this.imageNotice = "";
        this.imageFileError = "";
        this.imageResult = null;
        this.imageError = null;
        this.imageInput = null;
        if (this.phase === "feedback" || this.phase === "failed") {
          this.phase = "draft";
          this.feedback = null;
          this.machine.reset();
        }
        this.notify();
      }
      /** Reads the selected file locally; nothing is uploaded at this point. */
      async chooseImage(file) {
        const generation = ++this.imageGen;
        if (this.phase === "feedback" || this.phase === "failed") {
          this.phase = "draft";
          this.feedback = null;
          this.machine.reset();
        }
        this.imageBusy = true;
        this.imageDraft = null;
        this.imagePreviewed = false;
        this.imageFileError = "";
        this.imageNotice = "";
        this.imageResult = null;
        this.imageError = null;
        this.notify();
        try {
          const draft = await readImageFile(file);
          if (generation !== this.imageGen) return;
          this.imageDraft = draft;
          this.imageNotice = "\u56FE\u7247\u53EA\u5728\u672C\u673A\u9884\u89C8\uFF1B\u786E\u8BA4\u53D1\u9001\u540E\u624D\u4F1A\u901A\u8FC7\u6A21\u578B\u670D\u52A1\u8BC6\u522B\u3002";
        } catch (error) {
          if (generation !== this.imageGen) return;
          this.imageDraft = null;
          this.imageFileError = error instanceof Error ? error.message : "\u56FE\u7247\u8BFB\u53D6\u5931\u8D25\uFF0C\u8BF7\u91CD\u65B0\u9009\u62E9\u3002";
        } finally {
          if (generation === this.imageGen) {
            this.imageBusy = false;
            this.notify();
          }
        }
      }
      previewImage() {
        if (this.imageDraft === null) return;
        this.imagePreviewed = true;
        this.notify();
      }
      retakeImage() {
        this.imageGen += 1;
        this.imageDraft = null;
        this.imagePreviewed = false;
        this.imageBusy = false;
        this.imageResult = null;
        this.imageError = null;
        this.imageFileError = "";
        this.imageNotice = "\u8BF7\u91CD\u65B0\u62CD\u7167\u6216\u9009\u62E9\u56FE\u7247\uFF1B\u4E0A\u4E00\u5F20\u6CA1\u6709\u4E0A\u4F20\u3002";
        if (this.phase === "feedback" || this.phase === "failed") {
          this.phase = "draft";
          this.feedback = null;
          this.machine.reset();
        }
        this.notify();
        this.imageInput?.focus();
      }
      cancelImageWait() {
        if (!this.imageBusy) return;
        this.imageGen += 1;
        this.imageBusy = false;
        this.imageNotice = "\u5DF2\u53D6\u6D88\u7B49\u5F85\u8FD9\u6B21\u8BC6\u522B\uFF1B\u56FE\u7247\u4ECD\u4FDD\u7559\u5728\u672C\u673A\uFF0C\u4E0D\u4F1A\u81EA\u52A8\u91CD\u53D1\u3002";
        this.notify();
      }
      approveImageSend() {
        const draft = this.imageDraft;
        if (draft === null || this.workspace === null || this.session === null || this.activity === null) return;
        if (this.imageBusy) return;
        if (this.phase === "feedback" || this.phase === "submitted" || this.phase === "grading") return;
        const submitImage = this.options.dataSource.submitImageAnswer;
        if (submitImage === void 0) {
          this.imageError = { code: "UNSUPPORTED", message: "\u5F53\u524D\u6784\u5EFA\u6CA1\u6709\u56FE\u7247\u5224\u5206\u901A\u9053\uFF1B\u53EF\u4EE5\u6539\u7528\u6587\u5B57\u4F5C\u7B54\u3002", retryable: false };
          this.notify();
          return;
        }
        const generation = ++this.imageGen;
        this.imageBusy = true;
        this.imageError = null;
        this.imageNotice = "";
        if (this.phase === "draft" || this.phase === "failed" || this.phase === "cancelled") {
          this.machine.reset();
          this.machine.transition("submitted");
          this.machine.transition("grading");
          this.phase = "grading";
        }
        this.notify();
        const request = this.request();
        void submitImage.call(this.options.dataSource, request, {
          sessionId: this.session.session.id,
          activityId: this.activity.id,
          assetId: `asset.image.local.${draft.base64.length}`,
          answerText: null,
          base64: draft.base64,
          mime: draft.mime,
          width: draft.width,
          height: draft.height
        }).then((result) => {
          if (generation !== this.imageGen) return;
          this.imageBusy = false;
          if (!result.ok) {
            this.phase = "failed";
            this.machine.transition("failed");
            this.imageError = result.error;
            this.notify();
            return;
          }
          this.imageResult = result.data.image ?? null;
          if (result.data.attemptOutcome === null) {
            this.phase = "failed";
            this.machine.transition("failed");
            this.imageError = {
              code: "STORAGE_FAILED",
              message: "\u5224\u5206\u5DF2\u8FD4\u56DE\uFF0C\u4F46\u6CA1\u6709\u6536\u5230\u4FDD\u5B58\u7ED3\u679C\uFF1B\u8FD9\u6B21\u4E0D\u4F1A\u5F53\u4F5C\u5DF2\u8BB0\u5F55\u3002",
              retryable: true
            };
            this.notify();
            return;
          }
          this.applyTurn(result.data);
        }).catch((error) => {
          if (generation !== this.imageGen) return;
          this.imageBusy = false;
          this.phase = "failed";
          this.machine.transition("failed");
          this.imageError = {
            code: "UNAVAILABLE",
            message: error instanceof Error ? error.message : "\u56FE\u7247\u5224\u5206\u8BF7\u6C42\u5931\u8D25\uFF0C\u8BF7\u7A0D\u540E\u91CD\u8BD5\u3002",
            retryable: true
          };
          this.notify();
        });
      }
      async clearDraft() {
        if (this.workspace === null) return;
        await this.options.dataSource.clearDraft(this.request(), this.draftKey());
        this.draft = null;
        this.answer = null;
        this.draftStatus = "saved";
        this.updateDraftStatusNodes();
      }
      async persistNow() {
        if (this.answer !== null) await this.autosave(this.answer);
      }
      focusFeedback() {
        const root = this.feedbackRoot;
        const target = root?.querySelector("button") ?? root;
        target?.focus();
      }
      /* -------------------------------------------------------------- renders */
      renderMaterial() {
        const container = this.materialContainer;
        if (container === null) return;
        clear(container);
        if (this.loading) {
          container.append(loadingState({ title: "\u6B63\u5728\u6253\u5F00\u5B66\u4E60\u6750\u6599\u2026" }));
          return;
        }
        if (this.error !== null) {
          container.append(
            renderErrorBanner(this.error, {
              onRetry: () => void this.load(this.loadedKey),
              onBack: () => this.navigate?.("/map"),
              backLabel: "\u8FD4\u56DE\u5730\u56FE"
            })
          );
          return;
        }
        if (this.workspace === null) {
          container.append(
            emptyState({
              title: "\u8FD8\u6CA1\u6709\u9009\u62E9\u5B66\u4E60\u6D3B\u52A8",
              body: "\u4ECE\u5730\u56FE\u9009\u62E9\u6982\u5FF5\uFF0C\u6216\u5728\u9996\u9875\u7EE7\u7EED\u4E0A\u6B21\u3002",
              actions: [
                { label: "\u53BB\u5730\u56FE", onClick: () => this.navigate?.("/map"), tone: "primary" },
                { label: "\u8FD4\u56DE\u9996\u9875", onClick: () => this.navigate?.("/home") }
              ]
            })
          );
          return;
        }
        const workspace = this.workspace;
        const summary = this.summary();
        container.append(
          h(
            "div",
            { class: "edu-study-material", "data-testid": "study-material" },
            h("p", { class: "edu-muted", "data-testid": "study-focus" }, `${workspace.courseEditionLabel} \xB7 \u5185\u5BB9\u5305 ${workspace.packVersion} \xB7 ${this.intent.mode === "review" ? "\u590D\u4E60" : "\u5B66\u4E60"}`),
            h("h2", { class: "edu-card__title" }, workspace.concept.title),
            h("p", { class: "edu-card__meta" }, `${workspace.scope === "partial" ? "\u90E8\u5206\u5185\u5BB9\uFF08\u672A\u8FBE\u5168\u518C\uFF09" : "\u5168\u518C\u8303\u56F4"} \xB7 ${workspace.trustMode === "candidate" ? "\u5019\u9009\u5185\u5BB9\uFF08\u672A\u6838\u5B9E\uFF09" : "\u6B63\u5F0F\u5185\u5BB9"}`),
            h("h3", { class: "edu-card__title" }, "\u5B66\u4E60\u76EE\u6807"),
            h("ul", { class: "edu-study-list" }, ...workspace.concept.learningObjectives.map((objective) => h("li", {}, objective))),
            h("h3", { class: "edu-card__title" }, "\u6750\u6599"),
            h("p", { class: "edu-study-text" }, workspace.concept.explanation),
            workspace.concept.misconceptions.length > 0 ? h(
              "div",
              { class: "edu-study-misconceptions" },
              h("h3", { class: "edu-card__title" }, "\u5BB9\u6613\u6DF7\u6DC6"),
              ...workspace.concept.misconceptions.map((entry) => h("p", { class: "edu-study-text" }, `${entry.statement} \u2192 ${entry.correction}`))
            ) : null,
            h("h3", { class: "edu-card__title" }, "\u51FA\u5904"),
            ...workspace.sources.map((source) => {
              const sourceButton = button("\u67E5\u770B\u51FA\u5904", () => this.openSource(source, sourceButton), {
                small: true,
                dataAction: "study-source"
              });
              return h(
                "div",
                { class: "edu-study-source-row" },
                sourceButton,
                h("span", { class: "edu-muted" }, source.label)
              );
            }),
            h("p", { class: "edu-study-status", "data-testid": "study-draft-status" }, this.draftStatus === "saved" ? DRAFT_SAVED : this.draftStatus === "saving" ? "\u6B63\u5728\u4FDD\u5B58\u8349\u7A3F\u2026" : this.draftStatus === "failed" ? DRAFT_UNSAVED : ""),
            h("div", { class: "edu-inline-actions" }, ...this.axisChips(summary)),
            workspace.compatibility !== null ? notice({
              tone: "warning",
              title: "\u5185\u5BB9\u7248\u672C\u4E0D\u517C\u5BB9",
              body: `\u4E0A\u6B21\u5185\u5BB9\u7248\u672C ${workspace.compatibility.previousPackVersion}\uFF0C\u5F53\u524D ${workspace.compatibility.currentPackVersion}\u3002${workspace.compatibility.reason} \u65E7\u8BB0\u5F55\u4ECD\u53EF\u67E5\u770B\uFF0C\u4E0D\u4F1A\u9759\u9ED8\u8FC1\u79FB\u3002`,
              actions: [
                { label: "\u67E5\u770B\u65E7\u8BB0\u5F55", onClick: () => this.navigate?.("/records") },
                { label: "\u53BB\u6559\u6750\u5E93", onClick: () => this.navigate?.("/library") }
              ]
            }) : null,
            workspace.notice !== null ? h("p", { class: "edu-muted", "data-testid": "study-fixture-notice" }, workspace.notice) : null
          )
        );
      }
      renderChat() {
        const container = this.chatContainer;
        if (container === null) return;
        clear(container);
        const root = h("div", { class: "edu-study-chat", "data-testid": "study-chat" }, h("h3", { class: "edu-card__title" }, "\u5B66\u4E60\u52A9\u624B"));
        for (const message of this.messages) {
          root.append(
            h(
              "div",
              { class: `edu-study-message edu-study-message--${message.role}`, "data-role": message.role },
              h("span", { class: "edu-muted" }, message.role === "student" ? "\u4F60" : message.role === "assistant" ? "\u52A9\u624B" : "\u72B6\u6001"),
              h("p", {}, message.text),
              message.disclosure ? statusChip("\u672C\u8F6E\u5305\u542B disclosure", "attention") : null
            )
          );
        }
        const actions = h("div", { class: "edu-study-help-actions", "data-testid": "study-help-actions" });
        for (const action of HELP_ACTIONS) {
          actions.append(
            button(action.label, () => void this.sendHelp(action.kind), {
              small: true,
              dataAction: `help-${action.kind}`,
              title: action.note
            })
          );
        }
        root.append(actions);
        if (this.helpNotice.length > 0) {
          root.append(h("p", { class: "edu-notice edu-notice--warning", role: "status", "data-testid": "study-help-notice" }, this.helpNotice));
        }
        if (this.chatError !== null) {
          root.append(
            renderErrorBanner(this.chatError, {
              onRetry: () => void this.sendMessage("\u8BF7\u91CD\u8BD5\u8FD9\u6B21\u8BF7\u6C42\u3002"),
              backLabel: "\u7EE7\u7EED\u8BFB\u6750\u6599",
              onBack: () => void 0
            })
          );
        }
        const input = h("textarea", {
          class: "edu-input",
          rows: 3,
          "aria-label": "\u7ED9\u5B66\u4E60\u52A9\u624B\u53D1\u6D88\u606F",
          "data-testid": "study-chat-input",
          oninput: (event) => {
            this.chatText = event.currentTarget.value;
          }
        });
        input.value = this.chatText;
        root.append(
          h(
            "div",
            { class: "edu-study-chat-input" },
            input,
            button("\u53D1\u9001", () => void this.sendMessage(input.value), {
              small: true,
              tone: "primary",
              dataAction: "send-chat",
              disabled: this.session === null
            })
          ),
          h("p", { class: "edu-muted" }, "\u591A\u884C\u6587\u5B57\u6362\u884C\u4E0D\u4F1A\u81EA\u52A8\u63D0\u4EA4\uFF1B\u4F7F\u7528\u201C\u53D1\u9001\u201D\u6309\u94AE\u3002\u63D0\u793A\u3001\u89E3\u91CA\u3001\u793A\u8303\u548C\u770B\u7B54\u6848\u90FD\u53EF\u968F\u65F6\u8BF7\u6C42\u3002")
        );
        if (this.tutorState !== null && this.tutorState.consecutiveFailures >= 2) {
          root.append(
            h("div", { class: "edu-study-low-difficulty" }, h("p", { class: "edu-muted" }, LOW_DIFFICULTY_NOTE), button("\u6362\u4E00\u79CD\u8BB2\u6CD5", () => void this.lowerDifficulty(), { small: true, dataAction: "lower-difficulty" }))
          );
        }
        container.append(root);
      }
      renderActivity() {
        const container = this.activityContainer;
        if (container === null) return;
        if (this.reviewRange !== null && this.session === null) {
          this.renderReviewRange(container);
          return;
        }
        if (this.loading) {
          clear(container);
          container.append(loadingState({ title: "\u6B63\u5728\u51C6\u5907\u6D3B\u52A8\u2026" }));
          return;
        }
        if (this.error !== null) {
          clear(container);
          container.append(renderErrorBanner(this.error, { onRetry: () => void this.load(this.loadedKey), backLabel: "\u8FD4\u56DE\u5730\u56FE", onBack: () => this.navigate?.("/map") }));
          return;
        }
        if (this.workspace === null || this.activity === null) {
          clear(container);
          container.append(emptyState({ title: "\u8FD8\u6CA1\u6709\u6253\u5F00\u6D3B\u52A8", body: "\u4ECE\u5730\u56FE\u9009\u62E9\u6982\u5FF5\u540E\u8FDB\u5165\u5B66\u4E60\u6216\u590D\u4E60\u3002", actions: [{ label: "\u53BB\u5730\u56FE", onClick: () => this.navigate?.("/map"), tone: "primary" }] }));
          return;
        }
        if (this.imageMode) {
          this.renderImageAnswer(container);
          return;
        }
        if (this.form !== null && this.phase === "draft" && this.formActivityId === this.activity.id) {
          return;
        }
        clear(container);
        const root = h("div", { class: "edu-study-activity", "data-testid": "study-activity" });
        const draftStatus = h("p", { class: "edu-study-status", "data-testid": "study-activity-draft-status" });
        this.draftStatusNode = draftStatus;
        this.updateDraftStatusNodes();
        root.append(
          h(
            "div",
            { class: "edu-study-activity-head" },
            h("h2", { class: "edu-card__title" }, "\u5F53\u524D\u6D3B\u52A8"),
            statusChip(PHASE_LABELS[this.phase], PHASE_TONES[this.phase])
          ),
          h("p", { class: "edu-card__meta" }, `${this.activity.type === "recall" ? "\u56DE\u5FC6" : this.activity.type === "explain" ? "\u89E3\u91CA" : this.activity.type === "choice" ? "\u9009\u62E9" : this.activity.type === "relation" ? "\u5173\u7CFB" : this.activity.type === "diagram_label" ? "\u56FE\u793A\u6807\u6CE8" : "\u8FC1\u79FB"} \xB7 \u7248\u672C ${this.activity.version}`),
          h("p", { class: "edu-study-stem" }, this.activity.stem),
          draftStatus
        );
        if (this.lateNotice.length > 0) root.append(h("p", { class: "edu-notice edu-notice--warning", role: "status" }, this.lateNotice));
        if (this.failureNotice.length > 0) root.append(h("p", { class: "edu-notice edu-notice--warning", role: "status" }, this.failureNotice));
        if (this.skipNotice.length > 0) root.append(h("p", { class: "edu-notice edu-notice--info", role: "status" }, this.skipNotice));
        if (this.failedError !== null) {
          root.append(
            renderErrorBanner(this.failedError, {
              onRetry: () => void this.retry(),
              backLabel: "\u6539\u6587\u5B57",
              onBack: () => this.editAnswer()
            })
          );
        }
        if (this.phase === "failed") {
          root.append(
            h(
              "div",
              { class: "edu-inline-actions" },
              button("\u91CD\u8BD5\u6279\u6539", () => void this.retry(), { small: true, tone: "primary", dataAction: "retry-grading" }),
              button("\u6539\u6587\u5B57", () => this.editAnswer(), { small: true, dataAction: "edit-answer" })
            )
          );
        }
        if (this.finishReceipt !== null) {
          root.append(this.finishSummary());
          container.append(root);
          return;
        }
        if (this.phase === "submitted" || this.phase === "grading") {
          root.append(
            h(
              "div",
              { class: "edu-study-pending", role: "status" },
              h("p", {}, this.phase === "submitted" ? "\u539F\u7B54\u5DF2\u63D0\u4EA4\uFF0C\u6B63\u5728\u4FDD\u5B58\u2026" : "\u539F\u7B54\u5DF2\u4FDD\u5B58\uFF0C\u6B63\u5728\u7B49\u5F85\u53CD\u9988\u2026"),
              h("p", { class: "edu-muted" }, "\u53CD\u9988\u5B8C\u6210\u524D\u4E0D\u4F1A\u663E\u793A\u4E3A\u5DF2\u638C\u63E1\uFF1B\u53EF\u4EE5\u53D6\u6D88\uFF0C\u539F\u7B54\u548C\u8349\u7A3F\u4F1A\u4FDD\u7559\u3002")
            ),
            button("\u53D6\u6D88\u672C\u6B21\u53CD\u9988", () => this.cancelTurn(), { small: true, tone: "danger-ghost", dataAction: "cancel-turn" })
          );
          container.append(root);
          return;
        }
        if (this.phase === "feedback") {
          root.append(
            h("p", { class: "edu-muted" }, "\u672C\u6B21\u4F5C\u7B54\u5DF2\u63D0\u4EA4\uFF1B\u53CD\u9988\u5728\u53F3\u4FA7\u3002\u4F60\u53EF\u4EE5\u6539\u6587\u5B57\u518D\u8BD5\u4E00\u6B21\uFF0C\u6216\u7ED3\u675F\u672C\u8F6E\u3002"),
            h(
              "div",
              { class: "edu-inline-actions" },
              button("\u6539\u6587\u5B57\u518D\u8BD5", () => this.editAnswer(), { small: true, dataAction: "edit-answer" }),
              button("\u7ED3\u675F\u672C\u8F6E", () => void this.finishRound(), { small: true, tone: "primary", dataAction: "finish-round" }),
              button("\u6682\u4E0D\u5B8C\u6210\uFF0C\u8FD4\u56DE\u5730\u56FE", () => this.leaveUnfinished(), { small: true })
            )
          );
          container.append(root);
          return;
        }
        this.renderForm(root);
        container.append(root);
      }
      renderForm(root) {
        if (this.activity === null) return;
        this.form?.unmount();
        this.form = null;
        if (!supportsAnswerForm(this.activity)) {
          root.append(
            h("p", { class: "edu-notice edu-notice--info" }, "\u8FD9\u662F\u56FE\u793A\u6807\u6CE8\u6D3B\u52A8\uFF1B\u8BF7\u5728\u4E0B\u65B9\u56FE\u793A\u533A\u5B8C\u6210\uFF0C\u6216\u4F7F\u7528\u7F16\u53F7\u5217\u8868/\u6587\u5B57\u66FF\u4EE3\u8DEF\u5F84\u3002")
          );
        } else {
          const form = mountAnswerForm(root, {
            activity: this.activity,
            initial: this.answer,
            onSubmit: (value) => void this.submit(value),
            onCancel: () => this.leaveUnfinished()
          });
          this.form = form;
          this.formActivityId = this.activity.id;
          if (form !== null) {
            const save = () => {
              const value = form.getValue();
              this.answer = value;
              void this.autosave(value);
            };
            form.element.addEventListener("input", save);
            form.element.addEventListener("change", save);
          }
        }
        const actions = h(
          "div",
          { class: "edu-inline-actions" },
          button("\u8DF3\u8FC7\u672C\u9898", () => void this.skip(), { small: true, dataAction: "skip-question" }),
          button("\u7ED3\u675F\u672C\u8F6E", () => void this.finishRound(), { small: true, tone: "primary", dataAction: "finish-round" }),
          button("\u6682\u4E0D\u5B8C\u6210\uFF0C\u8FD4\u56DE\u5730\u56FE", () => this.leaveUnfinished(), { small: true })
        );
        if (this.workspace?.imageFlow !== null && this.workspace !== null) {
          actions.append(button("\u6539\u7528\u56FE\u7247\u4F5C\u7B54", () => this.startImageMode(), { small: true, dataAction: "image-answer" }));
        }
        root.append(actions, h("p", { class: "edu-muted" }, SKIP_NOTE));
      }
      /**
       * Image answer entry. The file input, explicit local preview and the
       * confirm-send step are separate: selecting a file never uploads anything.
       */
      renderImageAnswer(container) {
        clear(container);
        const root = h(
          "div",
          { class: "edu-study-activity edu-study-image", "data-testid": "study-activity" },
          h(
            "div",
            { class: "edu-study-activity-head" },
            h("h2", { class: "edu-card__title" }, "\u4E0A\u4F20\u56FE\u7247\u4F5C\u7B54"),
            statusChip(PHASE_LABELS[this.phase], PHASE_TONES[this.phase])
          ),
          h("p", { class: "edu-muted" }, "\u62CD\u7167\u6216\u9009\u62E9\u56FE\u7247\uFF08PNG / JPEG\uFF0C\u4E0D\u8D85\u8FC7 5 MB\uFF09\u3002\u9009\u62E9\u4E0D\u7B49\u4E8E\u53D1\u9001\uFF1A\u5148\u5728\u672C\u673A\u9884\u89C8\uFF0C\u518D\u786E\u8BA4\u53D1\u9001\u7ED9\u6A21\u578B\u8BC6\u522B\u3002"),
          h("p", { class: "edu-card__meta" }, this.activity?.stem ?? "")
        );
        const inputId = "edu-study-image-file";
        const fileInput = h("input", {
          type: "file",
          id: inputId,
          class: "edu-study-image-file",
          accept: "image/png,image/jpeg",
          "aria-label": "\u62CD\u7167\u6216\u9009\u62E9\u4F5C\u7B54\u56FE\u7247\uFF08PNG \u6216 JPEG\uFF09",
          "data-testid": "image-file-input",
          onchange: (event) => {
            const file = event.currentTarget.files?.[0];
            if (file !== void 0) void this.chooseImage(file);
          }
        });
        this.imageInput = fileInput;
        root.append(
          h(
            "div",
            { class: "edu-study-image-picker" },
            h("label", { class: "edu-button edu-button--small", for: inputId }, "\u62CD\u7167 / \u9009\u62E9\u56FE\u7247"),
            fileInput
          )
        );
        if (this.imageBusy) {
          root.append(
            h(
              "p",
              { class: "edu-study-status", role: "status", "data-testid": "image-busy" },
              "\u6B63\u5728\u8BFB\u53D6\u6216\u8BC6\u522B\u56FE\u7247\uFF0C\u8BF7\u7A0D\u5019\u2026\u2026\u4E0D\u4F1A\u81EA\u52A8\u91CD\u53D1\u3002"
            ),
            button("\u53D6\u6D88\u7B49\u5F85", () => this.cancelImageWait(), { small: true, dataAction: "image-cancel-wait" })
          );
        }
        if (this.imageDraft !== null) {
          const draft = this.imageDraft;
          root.append(
            h(
              "p",
              { class: "edu-study-status", "data-testid": "image-file-meta" },
              `\u5DF2\u9009\u62E9\uFF1A${draft.fileName} \xB7 ${draft.width > 0 && draft.height > 0 ? `${draft.width}\xD7${draft.height} \xB7 ` : ""}${draft.mime} \xB7 ${Math.max(1, Math.round(draft.byteSize / 1024))} KB`
            )
          );
          if (this.imagePreviewed) {
            root.append(
              h("img", {
                class: "edu-study-image-preview",
                src: draft.dataUrl,
                alt: "\u5F85\u53D1\u9001\u7684\u4F5C\u7B54\u56FE\u7247\u9884\u89C8",
                "data-testid": "image-preview"
              })
            );
          } else {
            root.append(h("p", { class: "edu-visual-preview-placeholder" }, "\u56FE\u7247\u9884\u89C8\u4EC5\u5728\u672C\u673A\u663E\u793A\u3002"));
          }
        } else if (!this.imageBusy) {
          root.append(
            h("p", { class: "edu-muted" }, "\u8FD8\u6CA1\u6709\u9009\u62E9\u56FE\u7247\u3002\u9009\u597D\u5E76\u9884\u89C8\u540E\uFF0C\u518D\u786E\u8BA4\u53D1\u9001\u7ED9\u6A21\u578B\u8BC6\u522B\u3002")
          );
        }
        const actions = h("div", { class: "edu-inline-actions" });
        if (this.imageDraft !== null && !this.imageBusy) {
          const preview = button("\u9884\u89C8\u56FE\u7247", () => this.previewImage(), { small: true, dataAction: "image-preview" });
          preview.dataset["imageAction"] = "preview";
          actions.append(
            preview,
            button("\u91CD\u65B0\u9009\u62E9", () => this.retakeImage(), { small: true, dataAction: "image-retake" })
          );
        }
        const canSend = this.imageDraft !== null && this.imagePreviewed && !this.imageBusy;
        const send = button("\u786E\u8BA4\u53D1\u9001\u7ED9\u6A21\u578B\u8BC6\u522B", () => this.approveImageSend(), {
          small: true,
          tone: "primary",
          disabled: !canSend,
          title: this.imageDraft === null ? "\u8BF7\u5148\u9009\u62E9\u56FE\u7247" : this.imagePreviewed ? "\u5C06\u628A\u8FD9\u5F20\u56FE\u7247\u53D1\u9001\u7ED9\u6A21\u578B\u670D\u52A1\u8BC6\u522B" : "\u8BF7\u5148\u9884\u89C8\u518D\u786E\u8BA4\u53D1\u9001",
          dataAction: "image-answer-send"
        });
        send.dataset["imageAction"] = "confirm-send";
        actions.append(send, button("\u53D6\u6D88\u672C\u6B21\u4F5C\u7B54", () => this.stopImageMode(), { small: true, dataAction: "image-cancel" }));
        root.append(actions);
        root.append(
          h(
            "p",
            { class: "edu-cloud-note" },
            "\u53D1\u9001\u8BF4\u660E\uFF1A\u56FE\u7247\u4F1A\u901A\u8FC7\u6A21\u578B\u670D\u52A1\u8BC6\u522B\uFF0C\u7528\u4E8E\u7ED9\u51FA\u53CD\u9988\uFF1B\u4E0D\u4F1A\u4E0A\u4F20\u6574\u672C\u6559\u6750\u6216\u5176\u4ED6\u5B66\u4E60\u8BB0\u5F55\u3002\u53D1\u9001\u524D\u53EF\u4EE5\u968F\u65F6\u53D6\u6D88\u3002"
          )
        );
        if (this.imageNotice.length > 0) {
          root.append(h("p", { class: "edu-muted", role: "status", "data-testid": "image-notice" }, this.imageNotice));
        }
        if (this.imageFileError.length > 0) {
          root.append(
            h("p", { class: "edu-danger-text", role: "alert", "data-testid": "image-file-error" }, this.imageFileError)
          );
        }
        if (this.imageError !== null) {
          root.append(
            renderErrorBanner(this.imageError, {
              onRetry: () => this.approveImageSend(),
              backLabel: "\u6539\u7528\u6587\u5B57\u4F5C\u7B54",
              onBack: () => this.stopImageMode()
            })
          );
        }
        if (this.imageResult !== null) root.append(this.imageResultSection());
        container.append(root);
      }
      imageResultSection() {
        const info = this.imageResult;
        const grade = this.feedback;
        const section = h("div", { class: "edu-study-image-result", "data-testid": "image-result" });
        const clarification = info?.stage === "clarification_required" || grade?.requiresClarification === true;
        if (clarification) {
          section.append(
            h("h3", { class: "edu-card__title" }, "\u8FD9\u5F20\u56FE\u7247\u8FD8\u4E0D\u80FD\u5224\u8BFB"),
            h(
              "p",
              { class: "edu-notice edu-notice--warning", role: "status" },
              grade?.feedback ?? info?.clarification?.message ?? "\u56FE\u7247\u8D28\u91CF\u6216\u8BC6\u522B\u7ED3\u679C\u4E0D\u8DB3\u4EE5\u5F62\u6210\u5224\u65AD\uFF1B\u7CFB\u7EDF\u4E0D\u4F1A\u56E0\u6B64\u5224\u4F60\u7B54\u9519\u3002"
            )
          );
          const reasons = [
            ...info?.qualitySignal?.reasons ?? [],
            ...info?.clarification?.reasons ?? []
          ].filter((reason, index, all) => reason.length > 0 && all.indexOf(reason) === index);
          if (reasons.length > 0) {
            section.append(h("ul", { class: "edu-study-list" }, ...reasons.map((reason) => h("li", {}, reason))));
          }
          if (grade !== null) {
            const sources = grade.sourceRefs.map((ref) => {
              const source = this.workspace?.sources.find((entry) => entry.sourceRefId === ref);
              if (source === void 0) return ref;
              return source.printedPage === null ? `PDF \u7B2C ${source.pdfPage} \u9875` : `\u8BFE\u672C\u7B2C ${source.printedPage} \u9875`;
            });
            if (sources.length > 0) {
              section.append(h("p", { class: "edu-muted" }, `\u51FA\u5904\uFF1A${[...new Set(sources)].join("\u3001")}`));
            }
            section.append(
              h("p", { class: "edu-muted", "data-testid": "image-grader-version" }, `\u8BC4\u5206\u7248\u672C\uFF1A${grade.graderVersion}`)
            );
          }
          section.append(
            h(
              "p",
              { class: "edu-muted" },
              "\u8FD9\u6B21\u53EA\u8BB0\u4E3A\u5F85\u6F84\u6E05\uFF08draft/pending\uFF09\uFF0C\u4E0D\u4F1A\u5199\u5165\u6210\u7EE9\uFF1B\u53EF\u4EE5\u91CD\u62CD\u3001\u91CD\u65B0\u9009\u62E9\uFF0C\u6216\u6539\u7528\u6587\u5B57\u4F5C\u7B54\u3002"
            )
          );
        } else if (grade !== null) {
          section.append(h("h3", { class: "edu-card__title" }, "\u672C\u6B21\u56FE\u7247\u5224\u5206"));
          if (grade.feedback.length > 0) section.append(h("p", { class: "edu-study-text" }, grade.feedback));
          const label = { yes: "\u5DF2\u8FBE\u6210", no: "\u672A\u8FBE\u6210", unclear: "\u5F85\u786E\u8BA4" };
          section.append(
            h(
              "ul",
              { class: "edu-study-list", "data-testid": "image-criteria" },
              ...grade.criteria.map(
                (criterion) => h("li", {}, `\u8981\u70B9 ${criterion.criterionId}\uFF1A${label[criterion.met]}\u3002${criterion.rationale}`)
              )
            )
          );
          if (grade.uncertainties.length > 0) {
            section.append(
              h(
                "div",
                { "data-testid": "image-uncertainties" },
                h("p", { class: "edu-muted" }, "\u4E0D\u786E\u5B9A\u9879"),
                h("ul", { class: "edu-study-list" }, ...grade.uncertainties.map((item) => h("li", {}, item)))
              )
            );
          }
          const sources = grade.sourceRefs.map((ref) => {
            const source = this.workspace?.sources.find((entry) => entry.sourceRefId === ref);
            if (source === void 0) return ref;
            return source.printedPage === null ? `PDF \u7B2C ${source.pdfPage} \u9875` : `\u8BFE\u672C\u7B2C ${source.printedPage} \u9875`;
          });
          if (sources.length > 0) {
            section.append(h("p", { class: "edu-muted", "data-testid": "image-sources" }, `\u51FA\u5904\uFF1A${[...new Set(sources)].join("\u3001")}`));
          }
          section.append(
            h("p", { class: "edu-muted", "data-testid": "image-grader-version" }, `\u8BC4\u5206\u7248\u672C\uFF1A${grade.graderVersion}`)
          );
          const persistence = info?.persistence;
          if (persistence?.duplicate === true) {
            section.append(h("p", { class: "edu-muted" }, "\u540C\u4E00\u5F20\u56FE\u7247\u6B64\u524D\u5DF2\u7ECF\u63D0\u4EA4\uFF1B\u672C\u6B21\u6CA1\u6709\u91CD\u590D\u8BB0\u7B54\uFF0C\u4E5F\u6CA1\u6709\u518D\u6B21\u8C03\u7528\u6A21\u578B\u3002"));
          } else if (persistence?.assessmentCommitted === false) {
            section.append(h("p", { class: "edu-muted" }, "\u539F\u7B54\u4E0E\u8BC1\u636E\u5DF2\u4FDD\u5B58\uFF1B\u7406\u89E3\u5224\u65AD\u4ECD\u9700\u66F4\u591A\u8BC1\u636E\uFF0C\u672A\u5347\u7EA7\u4E3A\u201C\u5DF2\u638C\u63E1\u201D\u3002"));
          }
        } else {
          section.append(
            h("p", { class: "edu-muted", role: "status" }, this.imageNotice || "\u8FD9\u6B21\u56FE\u7247\u6CA1\u6709\u5F62\u6210\u53EF\u663E\u793A\u7684\u7ED3\u679C\u3002")
          );
        }
        if (info?.persistence?.error !== void 0 && info?.persistence?.error !== null) {
          section.append(
            h("p", { class: "edu-danger-text", role: "alert" }, `\u8BB0\u5F55\u6CA1\u6709\u5199\u5165\uFF1A${info.persistence.error.message}`)
          );
        }
        section.append(
          h(
            "div",
            { class: "edu-inline-actions" },
            button("\u91CD\u65B0\u4E0A\u4F20", () => this.retakeImage(), { small: true, dataAction: "image-retake-result" }),
            button("\u6539\u7528\u6587\u5B57\u4F5C\u7B54", () => this.stopImageMode(), { small: true, dataAction: "image-text-fallback" }),
            grade !== null && !clarification ? button("\u7ED3\u675F\u672C\u8F6E", () => void this.finishRound(), { small: true, tone: "primary", dataAction: "image-finish" }) : null
          )
        );
        return section;
      }
      renderReviewRange(container) {
        clear(container);
        const range = this.reviewRange;
        const root = h("div", { class: "edu-study-activity", "data-testid": "study-review-range" }, h("h2", { class: "edu-card__title" }, "\u590D\u4E60\u8303\u56F4"));
        root.append(h("p", { class: "edu-muted" }, "\u5148\u770B\u63A8\u8350\u8303\u56F4\u548C\u7406\u7531\uFF1B\u53EF\u4EE5\u8C03\u6574\u3001\u8DF3\u8FC7\u63A8\u8350\u6216\u6682\u7F13\u4E00\u6B21\u3002\u590D\u4E60\u5F00\u59CB\u540E\u5148\u56DE\u5FC6\uFF0C\u518D\u7ED9\u53CD\u9988\u3002"));
        if (range === null || range.candidates.length === 0) {
          root.append(emptyState({ title: "\u5F53\u524D\u6CA1\u6709\u5F85\u590D\u4E60\u9879\u76EE", body: "\u4ECD\u53EF\u81EA\u9009\u8303\u56F4\uFF0C\u6216\u56DE\u5230\u5730\u56FE\u9009\u62E9\u6982\u5FF5\u3002", actions: [{ label: "\u53BB\u5730\u56FE\u81EA\u9009", onClick: () => this.navigate?.("/map"), tone: "primary" }] }));
          container.append(root);
          return;
        }
        const list = h("ul", { class: "edu-study-review-list" });
        for (const candidate of range.candidates) {
          list.append(this.reviewCandidateRow(candidate));
        }
        root.append(list, h("p", { class: "edu-note" }, range.note));
        if (this.reviewNotice.length > 0) root.append(h("p", { class: "edu-muted", role: "status" }, this.reviewNotice));
        if (this.reviewSkipped) root.append(h("p", { class: "edu-muted" }, "\u5DF2\u8DF3\u8FC7\u63A8\u8350\uFF1B\u4ECD\u53EF\u4ECE\u4E0B\u9762\u7684\u8303\u56F4\u81EA\u9009\u3002"));
        root.append(
          h(
            "div",
            { class: "edu-inline-actions" },
            button("\u5F00\u59CB\u590D\u4E60", () => {
              const chosen = [...this.reviewSelected][0] ?? range.candidates[0]?.conceptId ?? null;
              if (chosen !== null) void this.startReview(chosen);
            }, { tone: "primary", dataAction: "start-review" }),
            button("\u8DF3\u8FC7\u63A8\u8350", () => this.skipReviewRange(), { small: true, dataAction: "skip-review-range" }),
            button("\u6682\u7F13\u4E00\u6B21", () => void this.deferReview(), { small: true, dataAction: "defer-review" }),
            button("\u8FD4\u56DE\u5730\u56FE", () => this.navigate?.("/map"), { small: true })
          )
        );
        container.append(root);
      }
      reviewCandidateRow(candidate) {
        const input = h("input", {
          type: "checkbox",
          id: `review-${candidate.conceptId}`,
          checked: this.reviewSelected.has(candidate.conceptId),
          onchange: (event) => this.toggleReview(candidate.conceptId, event.currentTarget.checked)
        });
        return h(
          "li",
          { class: "edu-study-review-item" },
          h(
            "label",
            { class: "edu-study-review-label", for: `review-${candidate.conceptId}` },
            input,
            h("span", { class: "edu-card__title" }, candidate.title),
            statusChip(REVIEW_REASON_LABELS2[candidate.reason], candidate.reason === "needs_support" ? "attention" : "progress"),
            h("span", { class: "edu-muted" }, candidate.dueAt === null ? "\u6682\u65E0\u5B89\u6392" : `\u5F85\u590D\u4E60\uFF1A${formatStudyTime(candidate.dueAt)}`),
            candidate.lastReviewedAt !== null ? h("span", { class: "edu-muted" }, `\u4E0A\u6B21\u590D\u4E60\uFF1A${formatStudyTime(candidate.lastReviewedAt)}`) : null
          )
        );
      }
      renderFeedback() {
        const container = this.feedbackContainer;
        if (container === null) return;
        clear(container);
        const root = h("div", { class: "edu-study-feedback", "data-testid": "study-feedback", tabindex: -1 });
        this.feedbackRoot = root;
        if (this.loading) {
          root.append(loadingState({ title: "\u53CD\u9988\u4F1A\u5728\u8FD9\u91CC\u663E\u793A" }));
        } else if (this.finishReceipt !== null) {
          root.append(this.finishSummary());
        } else if (this.feedback !== null) {
          this.feedbackController?.unmount();
          const feedbackHost = h("div", { "data-testid": "study-feedback-grade" });
          root.append(feedbackHost);
          this.feedbackController = mountFeedbackView(feedbackHost, {
            grade: this.feedback,
            sourceLabel: (sourceRefId) => {
              const source = this.workspace?.sources.find((entry) => entry.sourceRefId === sourceRefId);
              return source === void 0 ? `\u51FA\u5904 ${sourceRefId}` : source.printedPage === null ? `\u6765\u6E90 \xB7 PDF \u7B2C ${source.pdfPage} \u9875` : `\u6765\u6E90 \xB7 \u8BFE\u672C\u7B2C ${source.printedPage} \u9875`;
            },
            onOpenSource: (sourceRefId) => this.openSourceById(sourceRefId),
            onClarificationAction: (action) => {
              this.chatNotice = `\u5DF2\u8BB0\u5F55\u6F84\u6E05\u52A8\u4F5C\uFF1A${action}\uFF1B\u4E0D\u4F1A\u56E0\u6B64\u5224\u9519\u3002`;
              this.notify();
            },
            candidateOnly: true
          });
          root.append(this.axisSection());
          root.append(this.selfReportSection());
          root.append(
            h(
              "div",
              { class: "edu-inline-actions" },
              button("\u6539\u6587\u5B57\u518D\u8BD5", () => this.editAnswer(), { small: true, dataAction: "edit-answer" }),
              button("\u7ED3\u675F\u672C\u8F6E", () => void this.finishRound(), { small: true, tone: "primary", dataAction: "finish-round" })
            )
          );
        } else {
          root.append(
            h("p", { class: "edu-muted" }, "\u63D0\u4EA4\u4F5C\u7B54\u540E\uFF0C\u8FD9\u91CC\u4F1A\u663E\u793A\u9010\u6761\u8981\u70B9\u3001\u5F85\u786E\u8BA4\u9879\u3001\u51FA\u5904\u3001\u8BC4\u5206\u7248\u672C\u4E0E\u8BC1\u636E\u5019\u9009\uFF1B\u4E0D\u4F1A\u663E\u793A\u638C\u63E1\u767E\u5206\u6BD4\u3002"),
            this.axisSection(),
            this.selfReportSection()
          );
        }
        if (this.chatNotice.length > 0) root.append(h("p", { class: "edu-muted", role: "status" }, this.chatNotice));
        container.append(root);
      }
      finishSummary() {
        const summary = this.summary();
        const receipt = this.finishReceipt;
        const root = h(
          "div",
          { class: "edu-study-finish", "data-testid": "study-finish" },
          h("h3", { class: "edu-card__title" }, this.finishLabel || "\u672C\u8F6E\u7ED3\u679C"),
          h("p", { class: "edu-study-status" }, summary.review),
          h("div", { class: "edu-inline-actions" }, ...this.axisChips(summary))
        );
        if (receipt !== null) {
          root.append(
            h("p", { class: "edu-muted" }, `\u590D\u4E60\u5B89\u6392\uFF1A${formatStudyTime(receipt.dueAt)} \xB7 \u7B56\u7565 ${receipt.policyVersion}${receipt.early ? " \xB7 \u63D0\u524D\u590D\u4E60" : ""}`)
          );
        }
        root.append(
          h("p", { class: "edu-muted" }, "\u6D3B\u52A8\u7ED3\u675F\u4E0E\u7406\u89E3\u5224\u65AD\u5206\u5F00\u8BB0\u5F55\uFF1B\u7ED3\u675F\u672C\u8F6E\u4E0D\u4F1A\u81EA\u52A8\u628A\u7406\u89E3\u5347\u7EA7\u4E3A\u201C\u8868\u73B0\u7A33\u5B9A\u201D\u3002"),
          h(
            "div",
            { class: "edu-inline-actions" },
            button("\u8FD4\u56DE\u5730\u56FE", () => this.navigate?.("/map"), { small: true, tone: "primary" }),
            button("\u67E5\u770B\u8BB0\u5F55", () => this.navigate?.("/records"), { small: true })
          )
        );
        return root;
      }
      summary() {
        const workspace = this.workspace;
        if (workspace === null) {
          return { learning: "\u5C1A\u672A\u5F00\u59CB", understanding: "\u5C1A\u65E0\u8DB3\u591F\u8BC1\u636E", review: "\u5C1A\u672A\u590D\u4E60", due: "\u6682\u65E0\u590D\u4E60\u5B89\u6392", selfReport: "\u672A\u586B\u5199" };
        }
        const payload = this.mapPayload();
        const summary = summarizeConceptState(payload, workspace.concept.id);
        return {
          learning: summary.learning.label,
          understanding: summary.understanding.label,
          review: summary.review.historyLabel,
          due: summary.review.dueLabel,
          selfReport: summary.selfReportLabel ?? "\u672A\u586B\u5199\uFF08\u53EF\u9009\uFF09"
        };
      }
      mapPayload() {
        const workspace = this.workspace;
        if (workspace === null) {
          throw new Error("workspace is not loaded");
        }
        return {
          courseEditionId: workspace.courseEditionId,
          courseEditionLabel: workspace.courseEditionLabel,
          packId: workspace.packId,
          packVersion: workspace.packVersion,
          trustMode: workspace.trustMode,
          scope: workspace.scope,
          coverageStatus: workspace.coverageStatus,
          toc: [],
          concepts: [workspace.concept],
          relations: [],
          progress: this.progress === null ? [] : [this.progress],
          selfReports: this.selfReport === null ? [] : [this.selfReport],
          evidence: [],
          sources: [],
          initialTocNodeId: null,
          initialConceptId: workspace.concept.id,
          fixture: workspace.fixture,
          notice: workspace.notice
        };
      }
      axisChips(summary) {
        return [
          statusChip(`\u5B66\u4E60\u8FDB\u7A0B\uFF1A${summary.learning}`, "neutral"),
          statusChip(`\u7406\u89E3\u8BC1\u636E\uFF1A${summary.understanding}`, summary.understanding.includes("\u9700\u5DE9\u56FA") ? "attention" : summary.understanding.includes("\u8868\u73B0\u7A33\u5B9A") ? "positive" : "neutral"),
          statusChip(`\u590D\u4E60\uFF1A${summary.review}`, summary.review.includes("\u4ECD\u9700\u5DE9\u56FA") ? "attention" : "neutral"),
          statusChip(`\u5F85\u590D\u4E60\uFF1A${summary.due}`, summary.due === "\u5F85\u590D\u4E60" ? "attention" : "neutral")
        ];
      }
      axisSection() {
        const summary = this.summary();
        return h(
          "section",
          { class: "edu-study-axis", "data-testid": "study-axis-summary" },
          h("h3", { class: "edu-card__title" }, "\u4E09\u8F74\u72B6\u6001\uFF08\u4E0E\u8BB0\u5F55\u9875\u4E00\u81F4\uFF09"),
          h("div", { class: "edu-inline-actions" }, ...this.axisChips(summary)),
          h("p", { class: "edu-muted" }, `\u81EA\u8BC4\uFF08\u5B66\u751F\u81EA\u8FF0\uFF09\uFF1A${summary.selfReport}\u3002\u81EA\u8BC4\u72EC\u7ACB\u4FDD\u5B58\uFF0C\u4E0D\u66FF\u4EE3\u7CFB\u7EDF\u8BC1\u636E\u3002`)
        );
      }
      selfReportSection() {
        const section = h(
          "section",
          { class: "edu-study-self-report", "data-testid": "study-self-report" },
          h("h3", { class: "edu-card__title" }, "\u81EA\u8BC4\uFF08\u53EF\u9009\uFF09"),
          h("p", { class: "edu-muted" }, "\u8FD9\u662F\u4F60\u7684\u611F\u53D7\uFF0C\u5355\u72EC\u4FDD\u5B58\uFF1B\u4E0D\u4F1A\u6539\u53D8\u7CFB\u7EDF\u5224\u65AD\uFF0C\u4E5F\u4E0D\u4F1A\u8986\u76D6\u8BC1\u636E\u3002")
        );
        for (const [state, label] of [["uncertain", "\u4E0D\u786E\u5B9A"], ["basically_understood", "\u57FA\u672C\u4F1A"], ["can_explain", "\u80FD\u89E3\u91CA"]]) {
          section.append(button(label, () => void this.saveSelfReport(state), { small: true, dataAction: `self-report-${state}` }));
        }
        if (this.selfReport !== null) {
          section.append(h("p", { class: "edu-muted" }, `\u5DF2\u4FDD\u5B58\u81EA\u8BC4\uFF1A${this.selfReport.claimedState === "can_explain" ? "\u80FD\u89E3\u91CA" : this.selfReport.claimedState === "basically_understood" ? "\u57FA\u672C\u4F1A" : "\u4E0D\u786E\u5B9A"} \xB7 ${formatStudyTime(this.selfReport.createdAt)}`));
        }
        return section;
      }
      openSource(source, trigger) {
        const parent = this.materialContainer ?? this.activityContainer;
        if (parent === null) return;
        openSourcePopover(parent, trigger ?? parent, this.workspace?.sources ?? [], source.sourceRefId);
      }
      openSourceById(sourceRefId) {
        const source = this.workspace?.sources.find((entry) => entry.sourceRefId === sourceRefId);
        if (source === void 0) {
          this.chatNotice = "\u8FD9\u6761\u51FA\u5904\u6682\u65F6\u4E0D\u53EF\u7528\uFF1B\u6CA1\u6709\u8DF3\u8F6C\u5230\u4EFB\u4F55\u9875\u9762\u3002";
          this.notify();
          return;
        }
        this.openSource(source, null);
      }
    };
    function hasAnswer(value) {
      if (value.kind === "text") return value.text.trim().length > 0;
      if (value.kind === "choice") return value.optionIds.length > 0;
      return value.pairs.length > 0;
    }
    function assistant(text, disclosure = false) {
      return { role: "assistant", text, disclosure };
    }
    function system(text) {
      return { role: "system", text, disclosure: false };
    }
    
    // education/client/study/src/styles.ts
    var STUDY_STYLE_ATTRIBUTE = "data-edu-study-style";
    var studyStyles = `
    .edu-study { min-width: 0; }
    .edu-study *,
    .edu-study *::before,
    .edu-study *::after { box-sizing: border-box; }
    .edu-study-grid {
      display: grid;
      grid-template-columns: minmax(0, 1.05fr) minmax(0, 1.35fr) minmax(0, 0.95fr);
      gap: ${DESIGN_TOKENS.spacing.md};
      align-items: start;
      min-width: 0;
    }
    .edu-study-panel {
      min-width: 0;
      background: var(--edu-color-surface);
      border: 1px solid var(--edu-color-line);
      border-radius: var(--edu-radius-lg);
      padding: ${DESIGN_TOKENS.spacing.md};
    }
    .edu-study-material,
    .edu-study-chat,
    .edu-study-activity,
    .edu-study-feedback,
    .edu-study-finish { min-width: 0; overflow-wrap: anywhere; }
    .edu-study-list { margin: ${DESIGN_TOKENS.spacing.xs} 0; padding-left: ${DESIGN_TOKENS.spacing.lg}; }
    .edu-study-text { margin: ${DESIGN_TOKENS.spacing.xs} 0; overflow-wrap: anywhere; }
    .edu-study-misconceptions { border-left: 0.25rem solid ${DESIGN_TOKENS.colors.warning}; padding-left: ${DESIGN_TOKENS.spacing.sm}; margin: ${DESIGN_TOKENS.spacing.sm} 0; }
    .edu-study-source-row { display: flex; flex-wrap: wrap; gap: ${DESIGN_TOKENS.spacing.xs}; align-items: center; margin: ${DESIGN_TOKENS.spacing.xs} 0; min-width: 0; }
    .edu-study-source-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 13rem), 1fr)); gap: ${DESIGN_TOKENS.spacing.sm}; }
    .edu-study-source-box { border: 1px solid var(--edu-color-line); border-radius: var(--edu-radius-md); padding: ${DESIGN_TOKENS.spacing.sm}; min-width: 0; }
    .edu-study-source-value { margin: ${DESIGN_TOKENS.spacing.xxs} 0 0; font-size: var(--edu-font-lg); font-weight: 700; overflow-wrap: anywhere; }
    .edu-study-status { margin: ${DESIGN_TOKENS.spacing.sm} 0 0; color: var(--edu-color-ink-muted); font-size: var(--edu-font-sm); overflow-wrap: anywhere; }
    .edu-study-status[data-state="failed"] { color: var(--edu-color-danger); font-weight: 600; }
    .edu-study-status[data-state="saved"] { color: var(--edu-color-success); }
    .edu-study-activity-head { display: flex; flex-wrap: wrap; gap: ${DESIGN_TOKENS.spacing.xs}; align-items: center; justify-content: space-between; }
    .edu-study-stem { margin: ${DESIGN_TOKENS.spacing.sm} 0; font-size: var(--edu-font-lg); font-weight: 600; overflow-wrap: anywhere; }
    .edu-study-pending { border: 1px dashed var(--edu-color-line-strong); border-radius: var(--edu-radius-md); padding: ${DESIGN_TOKENS.spacing.md}; margin: ${DESIGN_TOKENS.spacing.sm} 0; }
    .edu-study-message { border-left: 0.25rem solid var(--edu-color-line); padding: ${DESIGN_TOKENS.spacing.xs} ${DESIGN_TOKENS.spacing.sm}; margin: ${DESIGN_TOKENS.spacing.xs} 0; min-width: 0; }
    .edu-study-message--student { border-left-color: ${DESIGN_TOKENS.colors.info}; background: ${DESIGN_TOKENS.colors.infoSoft}; }
    .edu-study-message--assistant { border-left-color: ${DESIGN_TOKENS.colors.accent}; background: ${DESIGN_TOKENS.colors.accentSoft}; }
    .edu-study-message--system { border-left-color: ${DESIGN_TOKENS.colors.warning}; background: ${DESIGN_TOKENS.colors.warningSoft}; }
    .edu-study-message p { margin: ${DESIGN_TOKENS.spacing.xxs} 0 0; overflow-wrap: anywhere; }
    .edu-study-help-actions { display: flex; flex-wrap: wrap; gap: ${DESIGN_TOKENS.spacing.xs}; margin: ${DESIGN_TOKENS.spacing.sm} 0; }
    .edu-study-chat-input { display: grid; gap: ${DESIGN_TOKENS.spacing.xs}; margin-top: ${DESIGN_TOKENS.spacing.sm}; }
    .edu-study-chat-input textarea { width: 100%; min-height: 4.5rem; }
    .edu-study-low-difficulty { margin-top: ${DESIGN_TOKENS.spacing.sm}; padding: ${DESIGN_TOKENS.spacing.sm}; border: 1px dashed var(--edu-color-line-strong); border-radius: var(--edu-radius-md); }
    .edu-study-review-list { list-style: none; padding: 0; margin: ${DESIGN_TOKENS.spacing.sm} 0; display: grid; gap: ${DESIGN_TOKENS.spacing.xs}; }
    .edu-study-review-item { border: 1px solid var(--edu-color-line); border-radius: var(--edu-radius-md); padding: ${DESIGN_TOKENS.spacing.sm}; min-width: 0; }
    .edu-study-review-label { display: flex; flex-wrap: wrap; gap: ${DESIGN_TOKENS.spacing.xs}; align-items: center; cursor: pointer; }
    .edu-study-axis { border-top: 1px solid var(--edu-color-line); margin-top: ${DESIGN_TOKENS.spacing.md}; padding-top: ${DESIGN_TOKENS.spacing.sm}; min-width: 0; }
    .edu-study-self-report { border-top: 1px dashed var(--edu-color-line); margin-top: ${DESIGN_TOKENS.spacing.md}; padding-top: ${DESIGN_TOKENS.spacing.sm}; min-width: 0; }
    .edu-study-finish { border: 1px solid var(--edu-color-accent); border-radius: var(--edu-radius-md); padding: ${DESIGN_TOKENS.spacing.md}; background: var(--edu-color-accent-soft); }
    .edu-study-image-flow { margin: ${DESIGN_TOKENS.spacing.sm} 0; min-width: 0; }
    .edu-study-image-picker { display: flex; flex-wrap: wrap; gap: ${DESIGN_TOKENS.spacing.xs}; align-items: center; margin: ${DESIGN_TOKENS.spacing.sm} 0; min-width: 0; }
    .edu-study-image-picker label.edu-button { cursor: pointer; }
    .edu-study-image-file { max-width: 100%; font-size: var(--edu-font-sm); }
    .edu-study-image-preview { display: block; max-width: 100%; max-height: 22rem; object-fit: contain; border: 1px solid var(--edu-color-line); border-radius: var(--edu-radius-md); margin: ${DESIGN_TOKENS.spacing.sm} 0; background: var(--edu-color-surface); }
    .edu-study-image-result { border-top: 1px dashed var(--edu-color-line); margin-top: ${DESIGN_TOKENS.spacing.md}; padding-top: ${DESIGN_TOKENS.spacing.sm}; min-width: 0; }
    .edu-cloud-note { margin: ${DESIGN_TOKENS.spacing.sm} 0 0; color: var(--edu-color-ink-muted); font-size: var(--edu-font-sm); }
    .edu-study-feedback:focus { outline: var(--edu-focus-ring); outline-offset: 3px; }
    .edu-study [data-edu-slot] { min-width: 0; }
    @media (max-width: 1180px) {
      .edu-study-grid { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); }
      .edu-study-grid > .edu-study-side { grid-column: 1 / -1; }
    }
    @media (max-width: 820px) {
      .edu-study-grid { grid-template-columns: minmax(0, 1fr); }
      .edu-study-grid > .edu-study-side { grid-column: auto; }
    }
    `;
    function ensureStudyStyles(doc) {
      const existing = doc.head.querySelector(`style[${STUDY_STYLE_ATTRIBUTE}]`);
      if (existing !== null) return existing;
      const style = doc.createElement("style");
      style.setAttribute(STUDY_STYLE_ATTRIBUTE, "true");
      style.textContent = studyStyles;
      doc.head.append(style);
      return style;
    }
    
    // education/client/study/src/page.ts
    function createStudyPage(controller) {
      return {
        id: "study",
        path: "/workspace",
        title: "\u5DE5\u4F5C\u533A",
        requiresLearner: true,
        fallback: false,
        mount(context) {
          ensureStudyStyles(context.container.ownerDocument);
          const grid = h("div", { class: "edu-study-grid" });
          const material = h("section", {
            class: "edu-study-panel edu-study-material-panel",
            "data-testid": "study-material-panel",
            "aria-label": "\u5B66\u4E60\u6750\u6599"
          });
          const activity = h(
            "section",
            { class: "edu-study-panel edu-study-main-panel", "data-testid": "study-main-panel", "aria-label": "\u5F53\u524D\u6D3B\u52A8" },
            h("div", { "data-edu-slot": "study:activity", "data-testid": "study-activity-slot" }),
            h("div", { "data-edu-slot": "study:visuals", "data-testid": "study-visuals-slot" })
          );
          const chat = h("section", {
            class: "edu-study-panel edu-study-chat-panel",
            "data-testid": "study-chat-panel",
            "aria-label": "\u5B66\u4E60\u52A9\u624B"
          });
          const feedback = h(
            "section",
            { class: "edu-study-panel edu-study-feedback-panel", "data-testid": "study-feedback-panel", "aria-label": "\u53CD\u9988" },
            h("div", { "data-edu-slot": "study:feedback", "data-testid": "study-feedback-slot" })
          );
          const side = h("aside", { class: "edu-study-side" }, chat, feedback);
          grid.append(material, activity, side);
          const root = h(
            "div",
            { class: "edu-study", "data-testid": "study-page" },
            h(
              "header",
              { class: "edu-page__header" },
              h("h1", { class: "edu-page__title", tabindex: -1 }, "\u5DE5\u4F5C\u533A"),
              h(
                "p",
                { class: "edu-page__lead" },
                "\u6750\u6599\u5728\u5DE6\uFF0C\u5F53\u524D\u6D3B\u52A8\u5728\u4E2D\uFF0C\u5B66\u4E60\u52A9\u624B\u4E0E\u53CD\u9988\u5728\u53F3\uFF1B\u9876\u90E8\u4FDD\u7559\u6559\u6750\u3001\u5185\u5BB9\u5305\u3001\u6982\u5FF5\u3001\u6A21\u5F0F\u3001\u4FDD\u5B58\u72B6\u6001\u4E0E\u8FD4\u56DE\u4F4D\u7F6E\u3002"
              )
            ),
            grid
          );
          context.container.append(root);
          controller.mountMaterial(material);
          controller.mountChat(chat);
          void controller.onPageMount(context);
        },
        unmount() {
          controller.onPageUnmount();
        }
      };
    }
    
    // education/client/study/src/fixture.ts
    var FIXTURE_STUDY_NOTICE = "\u6F14\u793A\u6570\u636E\uFF08fixture\uFF09\uFF1A\u672C\u9875\u7684\u6559\u6750\u3001\u6D3B\u52A8\u3001\u6559\u5B66\u56DE\u5408\u3001\u53CD\u9988\u4E0E\u8349\u7A3F\u5747\u4E3A\u5408\u6210\u6837\u4F8B\uFF0C\u4E0D\u662F\u771F\u5B9E\u6A21\u578B\u6216\u771F\u5B9E API \u7ED3\u679C\u3002";
    function unwrap(result, label) {
      if (!result.ok) {
        throw new Error(`fixture contract violation in ${label}: ${result.issues.map((issue) => issue.code).join(",")}`);
      }
      return result.value;
    }
    var PACK = unwrap(validateContentPackStructure(valid_partial_default), "packs/valid-partial.json");
    var CONCEPT = PACK.concepts.find((entry) => entry.id === "concept.cell");
    var CONCEPT_STRUCTURE = PACK.concepts.find((entry) => entry.id === "concept.cell-structure");
    var ACTIVITY = PACK.activities.find((entry) => entry.id === "activity.cell-recall");
    var ACTIVITY_STRUCTURE = PACK.activities.find((entry) => entry.id === "activity.cell-label");
    var ACTIVITIES = PACK.activities.filter((entry) => entry.conceptIds.includes(CONCEPT.id));
    var BASE_REVIEWED = unwrap(validateConceptProgress(reviewed_and_due_default), "progress/reviewed-and-due.json");
    var BASE_NEEDS_SUPPORT = unwrap(validateConceptProgress(learned_needs_support_default), "progress/learned-needs-support.json");
    var BASE_UNASSESSED = unwrap(validateConceptProgress(no_evidence_default), "progress/no-evidence.json");
    var SELF_REPORT = unwrap(validateSelfReport(cell_default), "self-reports/cell.json");
    var SOURCE_REF = unwrap(validateSourceRef(source_ref_default), "entities/source-ref.json");
    var SOURCE_BLOCK = unwrap(validateSourceBlock(source_block_default), "entities/source-block.json");
    var FIGURE = unwrap(validateFigure(figure_default), "entities/figure.json");
    var SOURCES = [
      {
        sourceRefId: SOURCE_REF.id,
        pdfPage: SOURCE_REF.pdfPage,
        printedPage: SOURCE_REF.printedPage,
        label: `${SOURCE_BLOCK.type === "paragraph" ? "\u6BB5\u843D" : "\u6765\u6E90"} \xB7 ${SOURCE_BLOCK.id}`,
        verification: SOURCE_REF.verification.state
      },
      {
        sourceRefId: FIGURE.sourceRefId,
        pdfPage: 26,
        printedPage: null,
        label: `\u56FE\u793A \xB7 ${FIGURE.id}`,
        verification: "human_checked"
      }
    ];
    var NOW = "2026-10-29T10:00:00Z";
    function cloneProgress(base) {
      return JSON.parse(JSON.stringify(base));
    }
    function tomorrow(timestamp) {
      return new Date(Date.parse(timestamp) + 864e5).toISOString();
    }
    function reviewRange(progress2, forceNeedsSupport = false) {
      const candidates = [
        {
          conceptId: progress2.conceptId,
          title: "\u7EC6\u80DE",
          reason: forceNeedsSupport || progress2.review.latestOutcome === "needs_support" ? "needs_support" : "due",
          dueAt: progress2.review.dueAt,
          lastReviewedAt: progress2.review.lastCompletedAt,
          activityId: ACTIVITY.id
        },
        {
          conceptId: "concept.cell-structure",
          title: "\u7EC6\u80DE\u7ED3\u6784",
          reason: "due",
          dueAt: "2026-10-30T09:00:00Z",
          lastReviewedAt: null,
          activityId: "activity.cell-label"
        }
      ];
      return {
        candidates,
        policyVersion: "review-policy-v1",
        note: "\u63A8\u8350\u7406\u7531\u6765\u81EA\u5B66\u4E60\u5B8C\u6210\u65F6\u95F4\u4E0E\u6700\u8FD1\u8BC1\u636E\uFF1B\u4E0D\u662F\u8BB0\u5FC6\u7B97\u6CD5\u5206\u6570\uFF0C\u4E5F\u4E0D\u663E\u793A\u638C\u63E1\u767E\u5206\u6BD4\u3002"
      };
    }
    function sessionFor(concept2, activity, mode, sessionId) {
      return unwrap(
        validateSession({
          schemaVersion: 1,
          id: sessionId,
          learnerId: "learner.local.default",
          courseEditionId: concept2.courseEditionId,
          packVersion: PACK.version,
          trustMode: "published",
          conceptId: concept2.id,
          mode,
          status: "active",
          startedAt: NOW,
          endedAt: null,
          resumeCursor: { activityId: activity.id, cursor: "activity-start" },
          dshSessionId: null
        }),
        "fixture study session"
      );
    }
    function stateFor(session, activity, mode, revision, overrides = {}) {
      return {
        sessionId: session.id,
        learnerId: session.learnerId,
        conceptId: session.conceptId,
        courseEditionId: session.courseEditionId,
        packVersion: session.packVersion,
        mode,
        revision,
        turnCount: revision,
        consecutiveFailures: 0,
        consecutiveProbes: 0,
        helpKinds: [],
        disclosure: false,
        difficulty: "standard",
        representation: "text",
        reviewStage: mode === "review" ? "recall" : null,
        currentActivityId: activity.id,
        status: "active",
        lastAction: null,
        pendingGradingAttemptId: null,
        ...overrides
      };
    }
    function gradeFor(attemptId, correct, disclosure, requiresClarification = false) {
      return unwrap(
        validateGradeResult({
          schemaVersion: 1,
          attemptId,
          criteria: [
            {
              criterionId: "criterion.cell.identify",
              met: requiresClarification ? "unclear" : correct ? "yes" : "no",
              rationale: requiresClarification ? "\u8FD9\u6B21\u4F5C\u7B54\u4FE1\u606F\u4E0D\u8DB3\uFF0C\u6682\u65F6\u4E0D\u80FD\u5224\u65AD\u662F\u5426\u8BF4\u6E05\u4E86\u201C\u57FA\u672C\u5355\u4F4D\u201D\u3002" : correct ? "\u56DE\u7B54\u8BF4\u660E\u4E86\u7EC6\u80DE\u662F\u751F\u7269\u4F53\u7ED3\u6784\u548C\u529F\u80FD\u7684\u57FA\u672C\u5355\u4F4D\u3002" : "\u56DE\u7B54\u8FD8\u6CA1\u6709\u8BF4\u660E\u201C\u57FA\u672C\u5355\u4F4D\u201D\u8FD9\u4E00\u5173\u952E\u5173\u7CFB\u3002"
            }
          ],
          feedback: requiresClarification ? "\u8FD9\u6B21\u4F5C\u7B54\u8FD8\u4E0D\u591F\u6E05\u695A\uFF0C\u6682\u65F6\u4E0D\u80FD\u5224\u65AD\uFF1B\u53EF\u4EE5\u8865\u5145\u6587\u5B57\u6216\u91CD\u65B0\u4E0A\u4F20\u66F4\u6E05\u695A\u7684\u56FE\u7247\u3002" : correct ? "\u4F60\u5DF2\u7ECF\u8BF4\u6E05\u4E86\u7EC6\u80DE\u662F\u751F\u7269\u4F53\u7ED3\u6784\u548C\u529F\u80FD\u7684\u57FA\u672C\u5355\u4F4D\u3002\u4E0B\u4E00\u6B21\u53EF\u4EE5\u5C1D\u8BD5\u7528\u4E0D\u540C\u7EC6\u80DE\u7684\u4F8B\u5B50\u8FC1\u79FB\u3002" : "\u76EE\u524D\u8FD8\u7F3A\u5C11\u201C\u57FA\u672C\u5355\u4F4D\u201D\u8FD9\u4E00\u5173\u952E\u8BF4\u660E\uFF1B\u53EF\u4EE5\u56DE\u770B\u6750\u6599\u4E2D\u7684\u5B9A\u4E49\u540E\u518D\u8BD5\u4E00\u6B21\u3002",
          uncertainties: requiresClarification ? ["\u8FD9\u6B21\u4F5C\u7B54\u4FE1\u606F\u4E0D\u8DB3\uFF0C\u4E0D\u80FD\u636E\u6B64\u5224\u65AD\uFF1B\u4E0D\u4F1A\u5224\u4F60\u7B54\u9519\u3002"] : [
            "\u8FD9\u6B21\u53EA\u6709\u4E00\u6B21\u6587\u672C\u4F5C\u7B54\uFF1B\u4E0D\u80FD\u636E\u6B64\u63A8\u65AD\u957F\u671F\u638C\u63E1\u3002",
            ...disclosure ? ["\u672C\u8F6E\u770B\u8FC7\u5B8C\u6574\u7B54\u6848/\u793A\u8303\uFF0C\u8FD9\u6B21\u4F5C\u7B54\u4E0D\u80FD\u4F5C\u4E3A\u72EC\u7ACB\u8BC1\u636E\u3002"] : []
          ],
          evidenceCandidates: correct && !requiresClarification ? [
            {
              conceptId: "concept.cell",
              kind: "explain",
              observation: "\u5B66\u751F\u8BF4\u660E\u7EC6\u80DE\u662F\u751F\u7269\u4F53\u7ED3\u6784\u548C\u529F\u80FD\u7684\u57FA\u672C\u5355\u4F4D\u3002",
              criterionResults: [{ criterionId: "criterion.cell.identify", result: "met", note: null }],
              assistance: disclosure ? "assisted" : "unassisted",
              sourceRefs: ["source.p18"],
              assessmentOrigin: "rule",
              modelRunId: null,
              uncertainty: null
            }
          ] : [],
          requiresClarification,
          sourceRefs: ["source.p18"],
          graderVersion: "fixture-rule-v1"
        }),
        "fixture grade"
      );
    }
    function attemptFor(input, activity, session) {
      const attempt = input.attempt;
      if (attempt === null || attempt === void 0) {
        throw new Error("fixture attempt missing");
      }
      const helpUsed = input.helpRequest === null || input.helpRequest === void 0 ? [] : [{ kind: input.helpRequest, usedAt: NOW }];
      return unwrap(
        validateActivityAttempt({
          schemaVersion: 1,
          id: `attempt.${input.requestId}`,
          requestId: input.requestId,
          learnerId: session.learnerId,
          sessionId: session.id,
          courseEditionId: session.courseEditionId,
          packVersion: session.packVersion,
          activityId: activity.id,
          activityVersion: activity.version,
          conceptIds: activity.conceptIds,
          inputType: attempt.inputType,
          answerAssetId: attempt.answerAssetId ?? null,
          answerText: attempt.answerText ?? null,
          submittedAt: NOW,
          helpUsed,
          evidenceIds: []
        }),
        "fixture activity attempt"
      );
    }
    var FixtureStudyDataSource = class {
      kind = "fixture";
      notice = FIXTURE_STUDY_NOTICE;
      scenario;
      progress;
      selfReport;
      session = null;
      state = null;
      currentConcept = CONCEPT;
      currentActivity = ACTIVITY;
      graded = false;
      drafts = /* @__PURE__ */ new Map();
      pendingResolve = null;
      deferred = false;
      constructor(options = {}) {
        this.scenario = options.scenario ?? "ready";
        this.progress = this.scenario === "fresh" ? cloneProgress(BASE_UNASSESSED) : this.scenario === "review-needs-support" ? cloneProgress(BASE_NEEDS_SUPPORT) : cloneProgress(BASE_REVIEWED);
        this.selfReport = this.scenario === "fresh" ? null : SELF_REPORT;
      }
      async loadWorkspace(_ctx, input) {
        if (input.conceptId !== CONCEPT.id && input.conceptId !== CONCEPT_STRUCTURE.id) {
          return errResult("NOT_FOUND", "\u627E\u4E0D\u5230\u8FD9\u4E2A\u6982\u5FF5", false);
        }
        const concept2 = input.conceptId === CONCEPT_STRUCTURE.id ? CONCEPT_STRUCTURE : CONCEPT;
        const activities = concept2.id === CONCEPT_STRUCTURE.id ? [ACTIVITY_STRUCTURE] : ACTIVITIES;
        const activity = activities.find((entry) => entry.id === input.activityId) ?? activities[0] ?? ACTIVITY;
        if (concept2.id === CONCEPT_STRUCTURE.id) {
          this.progress = unwrap(
            validateConceptProgress({
              ...cloneProgress(BASE_UNASSESSED),
              conceptId: CONCEPT_STRUCTURE.id
            }),
            "fixture structure progress"
          );
          this.selfReport = null;
        }
        this.currentConcept = concept2;
        this.currentActivity = activity;
        return okResult(
          {
            courseEditionId: concept2.courseEditionId,
            courseEditionLabel: "2024 \u4E03\u5E74\u7EA7\u4E0A\u518C \xB7 \u751F\u7269 \xB7 \u5408\u6210\u6837\u4F8B\uFF08fixture\uFF09",
            packId: PACK.id,
            packVersion: PACK.version,
            trustMode: "published",
            scope: PACK.scope,
            coverageStatus: PACK.coverageStatus,
            concept: concept2,
            activities,
            activity,
            progress: this.progress,
            selfReport: this.selfReport,
            sources: SOURCES,
            reviewRange: input.mode === "review" ? reviewRange(this.progress, this.scenario === "review-needs-support") : null,
            compatibility: this.scenario === "incompatible" ? {
              previousPackVersion: "0.9.0",
              currentPackVersion: PACK.version,
              reason: "\u5185\u5BB9\u5305\u4FEE\u8BA2\u4E86\u8BC4\u5206\u6807\u51C6\uFF0C\u65E7\u8BC1\u636E\u4E0D\u80FD\u76F4\u63A5\u6CBF\u7528\u3002"
            } : null,
            imageFlow: this.scenario === "image" || this.scenario === "image-clarification" ? {
              stage: "selected",
              asset: { assetId: "asset.image.fixture", width: 900, height: 600, mime: "image/png" },
              recognition: null,
              revision: null,
              clarification: null,
              degradedMessage: null,
              injectionNotice: null
            } : null,
            fixture: true,
            notice: FIXTURE_STUDY_NOTICE
          },
          1
        );
      }
      async loadProgress(_ctx, conceptId) {
        if (conceptId !== CONCEPT.id && conceptId !== CONCEPT_STRUCTURE.id) {
          return errResult("NOT_FOUND", "\u627E\u4E0D\u5230\u6982\u5FF5\u8FDB\u5EA6", false);
        }
        return okResult(this.progress, 1);
      }
      async loadReviewRange(_ctx) {
        if (this.scenario === "review-empty") {
          return okResult(
            {
              candidates: [],
              policyVersion: "review-policy-v1",
              note: "\u5F53\u524D\u6CA1\u6709\u5F85\u590D\u4E60\u9879\u76EE\uFF1B\u53EF\u4EE5\u81EA\u9009\u8303\u56F4\u6216\u56DE\u5230\u5730\u56FE\u3002"
            },
            1
          );
        }
        return okResult(reviewRange(this.progress, this.scenario === "review-needs-support"), 1);
      }
      async deferReview(_ctx, conceptId) {
        if (conceptId !== CONCEPT.id && conceptId !== CONCEPT_STRUCTURE.id) {
          return errResult("NOT_FOUND", "\u627E\u4E0D\u5230\u5F85\u590D\u4E60\u6982\u5FF5", false);
        }
        const dueAt = tomorrow(this.progress.review.dueAt ?? NOW);
        this.progress = {
          ...this.progress,
          review: { ...this.progress.review, dueAt }
        };
        return okResult({ dueAt, deferred: true }, 2);
      }
      async loadDraft(_ctx, key) {
        return okResult(this.drafts.get(this.draftKey(key)) ?? null, 1);
      }
      async saveDraft(_ctx, draft) {
        this.drafts.set(this.draftKey(draft), draft);
        return okResult({ savedAt: draft.savedAt }, 2);
      }
      async clearDraft(_ctx, key) {
        this.drafts.delete(this.draftKey(key));
        return okResult({ cleared: true }, 2);
      }
      async saveSelfReport(_ctx, input) {
        const report = unwrap(
          validateSelfReport({
            schemaVersion: 1,
            id: `self-report.${input.conceptId}.${input.claimedState}`,
            learnerId: "learner.local.default",
            courseEditionId: CONCEPT.courseEditionId,
            packVersion: PACK.version,
            conceptId: input.conceptId,
            claimedState: input.claimedState,
            createdAt: NOW
          }),
          "fixture self report"
        );
        this.selfReport = report;
        return okResult(report, 2);
      }
      async startSession(_ctx, request) {
        const mode = request.mode;
        const session = sessionFor(this.currentConcept, this.currentActivity, mode, request.sessionId ?? `session.study.${mode}.1`);
        this.session = session;
        this.state = stateFor(session, this.currentActivity, mode, 0);
        return okResult(
          {
            session,
            state: this.state,
            model: { provider: "fixture", model: "fixture", text: true, image: true, isMock: true },
            gateway: "mock",
            dshSessionId: null
          },
          1
        );
      }
      async submitTurn(_ctx, input) {
        if (this.scenario === "offline") {
          return errResult("UNAVAILABLE", "\u4E91\u63A8\u7406\u4E0D\u53EF\u7528\uFF1B\u672C\u5730\u6750\u6599\u4ECD\u53EF\u9605\u8BFB", true);
        }
        if (this.scenario === "late") {
          return new Promise((resolve) => {
            this.pendingResolve = resolve;
            this.deferred = true;
          });
        }
        if (this.session === null || this.state === null) {
          return errResult("NOT_FOUND", "\u8FD8\u6CA1\u6709\u5F00\u59CB\u5B66\u4E60\u4F1A\u8BDD", false);
        }
        if (this.scenario === "failed-grading" && input.attempt !== null && input.attempt !== void 0) {
          const attempt = attemptFor(input, this.currentActivity, this.session);
          return okResult(
            {
              revision: this.state.revision + 1,
              message: "\u539F\u7B54\u5DF2\u7ECF\u4FDD\u5B58\uFF0C\u4F46\u53CD\u9988\u6682\u65F6\u6CA1\u6709\u5B8C\u6210\u3002\u53EF\u4EE5\u91CD\u8BD5\u6279\u6539\uFF0C\u4E0D\u9700\u8981\u91CD\u65B0\u4F5C\u7B54\u3002",
              decision: {
                action: "end",
                rationale: "fixture grading failure",
                disclosure: false,
                guidance: "none",
                difficulty: "same",
                sourceRefs: []
              },
              state: { ...this.state, revision: this.state.revision + 1, pendingGradingAttemptId: attempt.id },
              attemptOutcome: {
                attempt,
                attemptId: attempt.id,
                persisted: true,
                duplicate: false,
                grade: null,
                feedbackPending: true,
                completedAt: NOW
              }
            },
            2
          );
        }
        return this.normalTurn(input);
      }
      normalTurn(input, options = {}) {
        if (this.session === null || this.state === null) {
          return errResult("NOT_FOUND", "\u8FD8\u6CA1\u6709\u5F00\u59CB\u5B66\u4E60\u4F1A\u8BDD", false);
        }
        const helpRequest = input.helpRequest ?? null;
        const disclosure = helpRequest === "answer" || helpRequest === "worked_solution";
        const hasAttempt = input.attempt !== null && input.attempt !== void 0;
        if (hasAttempt) this.graded = true;
        const answerText = input.attempt?.answerText ?? "";
        const correct = options.correct ?? (hasAttempt && (answerText.includes("\u7EC6\u80DE") || answerText.includes("\u5355\u4F4D")));
        const attempt = hasAttempt ? attemptFor(input, this.currentActivity, this.session) : null;
        const grade = attempt === null ? null : gradeFor(
          attempt.id,
          correct,
          disclosure,
          options.requiresClarification ?? this.scenario === "clarify"
        );
        const helpKinds = helpRequest === null ? [] : [helpRequest];
        const consecutiveFailures = hasAttempt && !correct ? this.state.consecutiveFailures + 1 : this.state.consecutiveFailures;
        const decision = {
          action: helpRequest === null ? hasAttempt ? correct ? "confirm_understanding" : "explicit_correction" : "probe_question" : helpAction(helpRequest),
          rationale: helpRequest === null ? "fixture teaching decision" : `student requested ${helpRequest}`,
          disclosure,
          guidance: helpRequest === "answer" ? "answer" : helpRequest === "worked_solution" ? "demonstration" : helpRequest === null ? "none" : "hint",
          difficulty: consecutiveFailures >= 2 ? "reduced" : "same",
          sourceRefs: ["source.p18"]
        };
        const message = helpRequest === null ? hasAttempt ? correct ? "\u4F60\u5DF2\u7ECF\u8BF4\u6E05\u4E86\u7EC6\u80DE\u662F\u57FA\u672C\u5355\u4F4D\uFF0C\u8BD5\u7740\u7528\u4E0D\u540C\u7EC6\u80DE\u7684\u4F8B\u5B50\u518D\u8FC1\u79FB\u4E00\u6B21\u3002" : "\u8FD9\u91CC\u8FD8\u7F3A\u5C11\u201C\u57FA\u672C\u5355\u4F4D\u201D\u7684\u5173\u952E\u8BF4\u660E\uFF1B\u5148\u770B\u770B\u6750\u6599\u91CC\u7684\u5B9A\u4E49\uFF0C\u518D\u8BD5\u4E00\u6B21\u3002" : "\u5148\u56DE\u5FC6\u4E00\u4E0B\uFF1A\u7EC6\u80DE\u4E3A\u4EC0\u4E48\u88AB\u79F0\u4E3A\u751F\u7269\u4F53\u7ED3\u6784\u548C\u529F\u80FD\u7684\u57FA\u672C\u5355\u4F4D\uFF1F" : helpRequest === "answer" ? "\u8FD9\u662F\u672C\u9898\u7684\u5B8C\u6574\u7B54\u6848\uFF1A\u7EC6\u80DE\u662F\u751F\u7269\u4F53\u7ED3\u6784\u548C\u529F\u80FD\u7684\u57FA\u672C\u5355\u4F4D\u3002\u770B\u7B54\u6848\u540E\u8FD9\u6B21\u4F5C\u7B54\u4F1A\u6807\u4E3A disclosure\uFF0C\u4E0D\u80FD\u4F5C\u4E3A\u72EC\u7ACB\u8BC1\u636E\u3002" : helpRequest === "worked_solution" ? "\u5206\u6B65\u793A\u8303\uFF1A1) \u627E\u5230\u201C\u57FA\u672C\u5355\u4F4D\u201D\uFF1B2) \u8BF4\u660E\u7ED3\u6784\uFF1B3) \u8BF4\u660E\u529F\u80FD\u3002\u770B\u8FC7\u5B8C\u6574\u6B65\u9AA4\u540E\uFF0C\u8FD9\u6B21\u4F5C\u7B54\u4F1A\u6807\u4E3A disclosure\u3002" : helpRequest === "explanation" ? "\u89E3\u91CA\uFF1A\u7EC6\u80DE\u4E4B\u6240\u4EE5\u662F\u57FA\u672C\u5355\u4F4D\uFF0C\u662F\u56E0\u4E3A\u751F\u7269\u4F53\u7684\u7ED3\u6784\u548C\u529F\u80FD\u90FD\u4EE5\u7EC6\u80DE\u4E3A\u57FA\u7840\u3002" : helpRequest === "example" ? "\u4F8B\u5B50\uFF1A\u795E\u7ECF\u7EC6\u80DE\u548C\u7EA2\u7EC6\u80DE\u5F62\u6001\u4E0D\u540C\uFF0C\u4F46\u90FD\u7531\u7EC6\u80DE\u6784\u6210\u3002" : "\u63D0\u793A\uFF1A\u5148\u770B\u6750\u6599\u4E2D\u201C\u57FA\u672C\u5355\u4F4D\u201D\u8FD9\u56DB\u4E2A\u5B57\uFF0C\u518D\u8BF4\u660E\u7ED3\u6784\u548C\u529F\u80FD\u7684\u5173\u7CFB\u3002";
        const revision = this.state.revision + 1;
        const nextState = {
          revision,
          consecutiveFailures,
          difficulty: consecutiveFailures >= 2 ? "reduced" : "standard",
          currentActivityId: this.currentActivity.id,
          reviewStage: this.state.reviewStage,
          status: "active",
          helpKinds,
          disclosure
        };
        this.state = { ...this.state, ...nextState };
        return okResult(
          {
            revision,
            message,
            decision,
            state: nextState,
            attemptOutcome: attempt === null ? null : {
              attempt,
              attemptId: attempt.id,
              persisted: true,
              duplicate: false,
              grade,
              feedbackPending: options.requiresClarification === true,
              completedAt: NOW
            },
            ...options.image === void 0 ? {} : { image: options.image }
          },
          2
        );
      }
      async skip(_ctx, request) {
        if (this.session === null || this.state === null) return errResult("NOT_FOUND", "\u8FD8\u6CA1\u6709\u5F00\u59CB\u5B66\u4E60\u4F1A\u8BDD", false);
        const revision = request.revision + 1;
        const nextState = {
          revision,
          consecutiveFailures: this.state.consecutiveFailures,
          difficulty: this.state.difficulty,
          currentActivityId: this.currentActivity.id,
          reviewStage: this.state.reviewStage,
          status: "active",
          helpKinds: [],
          disclosure: false
        };
        this.state = { ...this.state, ...nextState };
        return okResult(
          {
            revision,
            message: "\u5DF2\u8DF3\u8FC7\u672C\u9898\uFF1B\u4E0D\u4F1A\u8BB0\u4E3A\u7B54\u9519\uFF0C\u4E5F\u4E0D\u4F1A\u4F2A\u9020\u6D3B\u52A8\u5B8C\u6210\u3002",
            decision: { action: "skip", rationale: "student skipped", disclosure: false, guidance: "none", difficulty: "same", sourceRefs: [] },
            state: nextState,
            attemptOutcome: null
          },
          2
        );
      }
      async end(_ctx, request) {
        if (this.session === null || this.state === null) return errResult("NOT_FOUND", "\u8FD8\u6CA1\u6709\u5F00\u59CB\u5B66\u4E60\u4F1A\u8BDD", false);
        const revision = request.revision + 1;
        const nextState = {
          revision,
          consecutiveFailures: this.state.consecutiveFailures,
          difficulty: this.state.difficulty,
          currentActivityId: null,
          reviewStage: this.state.reviewStage,
          status: request.completed ? "completed" : "abandoned",
          helpKinds: [],
          disclosure: false
        };
        this.state = { ...this.state, ...nextState };
        return okResult(
          {
            revision,
            message: request.completed ? "\u672C\u8F6E\u5DF2\u7ED3\u675F\u3002" : "\u672C\u8F6E\u6682\u4E0D\u5B8C\u6210\uFF1B\u5DF2\u4FDD\u5B58\u7684\u5185\u5BB9\u4ECD\u4FDD\u7559\u3002",
            decision: { action: "end", rationale: "session end", disclosure: false, guidance: "none", difficulty: "same", sourceRefs: [] },
            state: nextState,
            attemptOutcome: null
          },
          2
        );
      }
      async finishLearning(_ctx, request) {
        const completed = this.graded;
        this.progress = {
          ...this.progress,
          learning: completed ? { state: "completed", startedAt: this.progress.learning.startedAt ?? NOW, lastCompletedAt: NOW } : { state: "in_progress", startedAt: this.progress.learning.startedAt ?? NOW, lastCompletedAt: null },
          lastPosition: { ...this.progress.lastPosition, updatedAt: NOW }
        };
        return okResult(
          {
            progress: this.progress,
            dueAt: tomorrow(NOW),
            policyVersion: "review-policy-v1",
            outcome: null,
            early: false
          },
          3
        );
      }
      async finishReview(_ctx, request) {
        if (!this.graded) {
          return okResult(
            {
              progress: this.progress,
              dueAt: this.progress.review.dueAt ?? tomorrow(NOW),
              policyVersion: "review-policy-v1",
              outcome: null,
              early: false
            },
            3
          );
        }
        const outcome = request.outcome ?? (this.scenario === "review-needs-support" ? "needs_support" : "needs_support");
        const dueAt = tomorrow(NOW);
        this.progress = {
          ...this.progress,
          understanding: {
            ...this.progress.understanding,
            state: outcome === "needs_support" ? "needs_support" : this.progress.understanding.state,
            updatedAt: NOW
          },
          review: {
            ...this.progress.review,
            lastCompletedAt: NOW,
            dueAt,
            latestOutcome: outcome
          }
        };
        this.progress = unwrap(validateConceptProgress(this.progress), "fixture review progress");
        return okResult(
          {
            progress: this.progress,
            dueAt,
            policyVersion: "review-policy-v1",
            outcome,
            early: false
          },
          3
        );
      }
      async retryPendingGrading(_ctx, request) {
        if (this.session === null) return errResult("NOT_FOUND", "\u8FD8\u6CA1\u6709\u5F00\u59CB\u5B66\u4E60\u4F1A\u8BDD", false);
        const attemptId = this.state?.pendingGradingAttemptId ?? `attempt.${request.requestId}`;
        const attempt = unwrap(
          validateActivityAttempt({
            schemaVersion: 1,
            id: attemptId,
            requestId: request.requestId,
            learnerId: this.session.learnerId,
            sessionId: this.session.id,
            courseEditionId: this.session.courseEditionId,
            packVersion: this.session.packVersion,
            activityId: this.currentActivity.id,
            activityVersion: this.currentActivity.version,
            conceptIds: this.currentActivity.conceptIds,
            inputType: "text",
            answerAssetId: null,
            answerText: "fixture retried answer",
            submittedAt: NOW,
            helpUsed: [],
            evidenceIds: []
          }),
          "fixture retry attempt"
        );
        return okResult(
          {
            attempt,
            attemptId,
            persisted: true,
            duplicate: false,
            grade: gradeFor(attemptId, true, false),
            feedbackPending: false,
            completedAt: NOW
          },
          3
        );
      }
      async submitImageAnswer(_ctx, input) {
        if (this.scenario !== "image" && this.scenario !== "image-clarification") {
          return errResult("UNSUPPORTED", "\u5F53\u524D fixture \u6CA1\u6709\u56FE\u7247\u8BC6\u522B\u7ED3\u679C", false);
        }
        const clarification = this.scenario === "image-clarification";
        const reasons = [
          "\u56FE\u7247\u8F83\u6A21\u7CCA\uFF08\u6E05\u6670\u5EA6 12 < 40\uFF09",
          "\u56FE\u7247\u53EF\u80FD\u6709 8\xB0 \u503E\u659C\uFF0C\u8BF7\u6446\u6B63\u540E\u91CD\u62CD",
          "\u56FE\u7247\u51E0\u4E4E\u662F\u7A7A\u767D/\u5747\u5300\u8272\u5757"
        ];
        const image = {
          stage: clarification ? "clarification_required" : "graded",
          modelCalled: false,
          evidenceCandidates: [],
          gate: null,
          qualitySignal: {
            status: clarification ? "blurry" : "ok",
            forcedClarification: clarification,
            reasons: clarification ? reasons : [],
            note: "fixture \u8D28\u91CF\u95E8\uFF08\u5408\u6210\u6837\u4F8B\uFF0C\u975E\u771F\u5B9E\u6A21\u578B\uFF09\u3002"
          },
          clarification: clarification ? {
            reasons,
            message: "fixture\uFF1A\u56FE\u7247\u8D28\u91CF\u4E0D\u8DB3\uFF0C\u672A\u5F62\u6210\u5224\u65AD\uFF1B\u8BF7\u91CD\u62CD\u6216\u6539\u7528\u6587\u5B57\u3002\u8FD9\u6B21\u53EA\u8BB0\u4E3A\u5F85\u6F84\u6E05\uFF0C\u4E0D\u4F1A\u5199\u5165\u6210\u7EE9\u3002",
            actions: ["retake", "text_fallback"]
          } : null,
          persistence: {
            attemptId: `attempt.image.${input.assetId}`,
            sessionId: input.sessionId,
            duplicate: false,
            assessmentCommitted: !clarification,
            evidenceAccepted: clarification ? 0 : 1,
            evidenceRejected: 0,
            feedbackPending: clarification,
            note: clarification ? "fixture: clarification attempt kept pending" : "fixture: graded and committed"
          }
        };
        return this.normalTurn(
          {
            requestId: `request.image.${input.assetId}`,
            sessionId: this.session?.id ?? "session.study.learn.1",
            revision: this.state?.revision ?? 0,
            attempt: {
              activityId: input.activityId,
              inputType: "image",
              answerAssetId: input.assetId,
              answerText: null
            },
            imageQuality: "clear"
          },
          { image, requiresClarification: clarification, correct: !clarification }
        );
      }
      resolveLate(result) {
        if (this.pendingResolve === null) return;
        const resolve = this.pendingResolve;
        this.pendingResolve = null;
        resolve(
          result ?? {
            ok: true,
            revision: 1,
            data: {
              revision: 1,
              message: "\u8FDF\u5230\u7684\u53CD\u9988",
              decision: { action: "confirm_understanding", rationale: "late fixture", disclosure: false, guidance: "none", difficulty: "same", sourceRefs: [] },
              state: { revision: 1, consecutiveFailures: 0, difficulty: "standard", currentActivityId: ACTIVITY.id, reviewStage: null, status: "active", helpKinds: [], disclosure: false },
              attemptOutcome: null
            }
          }
        );
      }
      draftKey(key) {
        return `${key.conceptId}|${key.mode}|${key.activityId}`;
      }
    };
    function helpAction(kind) {
      if (kind === "hint") return "hint";
      if (kind === "explanation") return "layered_explanation";
      if (kind === "example") return "example";
      if (kind === "worked_solution") return "worked_example";
      return "answer_disclosure";
    }
    function createFixtureStudyDataSource(options = {}) {
      return new FixtureStudyDataSource(options);
    }
    
    // education/client/study/src/index.ts
    function defaultRequestFactory3() {
      let counter = 0;
      return () => {
        counter += 1;
        return {
          requestId: `request.study.${counter}`,
          learnerId: "learner.local.default",
          now: (/* @__PURE__ */ new Date()).toISOString()
        };
      };
    }
    function createStudyUi(options = {}) {
      const dataSource = options.dataSource ?? createFixtureStudyDataSource({ scenario: options.fixtureScenario });
      const controllerOptions = {
        dataSource,
        createRequest: options.createRequest ?? defaultRequestFactory3(),
        returnPath: options.returnPath ?? null
      };
      const controller = new StudyController(controllerOptions);
      const page = createStudyPage(controller);
      const activityPanel = {
        id: "study-activity",
        mount(context) {
          controller.mountActivity(context.container);
        },
        unmount() {
        }
      };
      const feedbackPanel = {
        id: "study-feedback",
        mount(context) {
          controller.mountFeedback(context.container);
        },
        unmount() {
        }
      };
      const panels = [
        { name: "study:activity", panel: activityPanel },
        { name: "study:feedback", panel: feedbackPanel }
      ];
      return {
        page,
        panels,
        controller,
        dataSource,
        register(shell) {
          shell.registerPage(page);
          const offs = panels.map((entry) => shell.registerPanel(entry.name, entry.panel));
          return () => {
            for (const off of offs) off();
          };
        }
      };
    }
    
    // education/runtime/client-plugin/src/live-sources.ts
    async function api(path, init) {
      try {
        const response = await fetch(path, {
          credentials: "same-origin",
          headers: { accept: "application/json", ...init?.body === void 0 ? {} : { "content-type": "application/json" } },
          ...init
        });
        const body = await response.json();
        if (!response.ok && body.ok !== false) {
          return { ok: false, error: { code: `HTTP_${String(response.status)}`, message: "request failed", retryable: true } };
        }
        return body;
      } catch (error) {
        return { ok: false, error: { code: "NETWORK", message: error.message, retryable: true }, offline: true };
      }
    }
    function requestId(prefix) {
      return `${prefix}.${String(Date.now())}.${String(Math.random()).slice(2, 8)}`;
    }
    function createLiveShellDataSource() {
      return {
        kind: "live",
        notice: null,
        async loadSnapshot() {
          return api("/edu/api/g1/snapshot");
        },
        async loadHome() {
          return api("/edu/api/g1/home");
        },
        async loadRecords() {
          return api("/edu/api/g1/records");
        },
        async resumeSession(_request, sessionId) {
          return api(`/edu/api/g1/resume?sessionId=${encodeURIComponent(sessionId)}`);
        },
        async saveRange() {
          return { ok: false, error: { code: "UNSUPPORTED", message: "range claim is not wired in this build" } };
        },
        async exportData() {
          return { ok: false, error: { code: "UNSUPPORTED", message: "export is not wired in this build" } };
        },
        async deleteData() {
          return { ok: false, error: { code: "UNSUPPORTED", message: "delete is not wired in this build" } };
        }
      };
    }
    function createLiveLibraryDataSource() {
      return {
        kind: "live",
        notice: "\u771F\u5B9E\u5019\u9009\u6559\u6750\uFF1A\u6765\u81EA\u672C\u673A\u5185\u5BB9\u5305\uFF0C\u5C1A\u5F85\u4EBA\u5DE5\u5BA1\u6821\uFF1B\u5019\u9009\u6807\u8BC6\u548C\u6765\u6E90\u9875\u7801\u59CB\u7EC8\u53EF\u89C1\u3002",
        async listBooks() {
          const book = await api("/edu/api/g1/library");
          if (!book.ok || book.data === void 0) return book;
          return {
            ok: true,
            revision: book.revision ?? 1,
            data: [
              {
                ...book.data,
                grade: 7,
                term: 1,
                subject: "biology",
                reviewState: "candidate",
                editionVerification: "machine_matched",
                fileState: "present",
                isCurrent: true,
                unavailableReason: null
              }
            ]
          };
        },
        async listSources() {
          return api("/edu/api/g1/sources");
        },
        async openSource(_context, sourceRefId) {
          return api(`/edu/api/g1/source?sourceRefId=${encodeURIComponent(sourceRefId)}`);
        },
        async chooseFile() {
          return { ok: false, error: { code: "UNSUPPORTED", message: "file picker must be opened by the desktop host" } };
        },
        async startImport() {
          return { ok: false, error: { code: "UNSUPPORTED", message: "import is available through the T03 importer API, not this UI build" } };
        },
        async getJob() {
          return { ok: false, error: { code: "NOT_FOUND", message: "no import job" } };
        },
        async cancelImport() {
          return { ok: false, error: { code: "UNSUPPORTED", message: "no import job" } };
        },
        async resumeImport() {
          return { ok: false, error: { code: "UNSUPPORTED", message: "no import job" } };
        },
        async retryImport() {
          return { ok: false, error: { code: "UNSUPPORTED", message: "no import job" } };
        },
        subscribe() {
          return () => void 0;
        }
      };
    }
    function descendants(toc, rootId) {
      const set = /* @__PURE__ */ new Set([rootId]);
      let changed = true;
      while (changed) {
        changed = false;
        for (const node of toc) {
          if (node.parentId !== null && set.has(node.parentId) && !set.has(node.id)) {
            set.add(node.id);
            changed = true;
          }
        }
      }
      return set;
    }
    function createLiveMapDataSource() {
      let cache = null;
      async function payload() {
        if (cache !== null) return cache;
        const result = await api("/edu/api/g1/map");
        if (!result.ok || result.data === void 0) return result;
        cache = result.data;
        return cache;
      }
      function graph(center, scope, maxNodes) {
        if (cache === null) return null;
        const toc = cache.toc;
        const scopeIds = scope === null ? null : descendants(toc, scope);
        const chapterConcepts = cache.concepts.filter(
          (concept2) => scopeIds === null || concept2.placements.some((placement) => scopeIds.has(placement))
        );
        const chosen = chapterConcepts.slice(0, Math.max(1, maxNodes));
        const ids = new Set(chosen.map((concept2) => concept2.id));
        const relations = cache.relations.filter(
          (relation2) => ids.has(relation2.fromConceptId) && ids.has(relation2.toConceptId)
        );
        return {
          packVersion: cache.packVersion,
          centerConceptId: center,
          scopeTocNodeId: scope,
          concepts: chosen,
          relations,
          externalConcepts: [],
          truncated: chapterConcepts.length > chosen.length,
          hiddenConceptCount: Math.max(0, chapterConcepts.length - chosen.length),
          stats: { maxNodes, maxDepth: 2, visitedConcepts: chosen.length, visitedRelations: relations.length, durationMs: 0 }
        };
      }
      return {
        kind: "live",
        notice: null,
        async loadMap() {
          const data = await payload();
          return data.ok === false ? data : { ok: true, revision: 1, data };
        },
        async loadChapterGraph(_request, tocNodeId, options) {
          const data = await payload();
          if (data.ok === false) return data;
          return { ok: true, revision: 1, data: graph(options?.centerConceptId ?? null, tocNodeId, options?.maxNodes ?? 24) };
        },
        async expandConcept(_request, conceptId, options) {
          const data = await payload();
          if (data.ok === false) return data;
          return { ok: true, revision: 1, data: graph(conceptId, null, options?.maxNodes ?? 25) };
        },
        async searchConcepts(_request, query, limit) {
          const data = await payload();
          if (data.ok === false) return data;
          const q = query.trim().toLowerCase();
          const hits = data.concepts.filter((concept2) => concept2.title.toLowerCase().includes(q) || concept2.aliases.some((alias) => alias.toLowerCase().includes(q))).slice(0, limit).map((concept2) => ({
            conceptId: concept2.id,
            title: concept2.title,
            matchedOn: concept2.title.toLowerCase().includes(q) ? "title" : "alias",
            matchedText: concept2.title,
            tocNodeId: concept2.placements[0] ?? null,
            tocTitle: null,
            score: 1
          }));
          return { ok: true, revision: 1, data: hits };
        },
        async loadConceptDetail(_request, conceptId) {
          const data = await payload();
          if (data.ok === false) return data;
          const concept2 = data.concepts.find((entry) => entry.id === conceptId);
          if (concept2 === void 0) return { ok: false, error: { code: "NOT_FOUND", message: "concept not found" } };
          const relations = data.relations.filter(
            (relation2) => relation2.fromConceptId === conceptId || relation2.toConceptId === conceptId
          );
          return {
            ok: true,
            revision: 1,
            data: {
              concept: concept2,
              progress: data.progress.find((entry) => entry.conceptId === conceptId) ?? null,
              selfReport: data.selfReports.find((entry) => entry.conceptId === conceptId) ?? null,
              relations,
              prerequisites: relations.filter((relation2) => relation2.type === "prerequisite" && relation2.toConceptId === conceptId),
              evidence: data.evidence.filter((entry) => entry.conceptId === conceptId),
              sources: [],
              placements: concept2.placements.map((tocNodeId) => ({
                tocNodeId,
                title: tocNodeId,
                type: "section",
                path: [tocNodeId]
              }))
            }
          };
        }
      };
    }
    function createLiveStudyDataSource() {
      function body(value) {
        return { method: "POST", body: JSON.stringify(value), headers: { "x-edu-request-id": requestId("g1.study") } };
      }
      return {
        kind: "live",
        notice: null,
        async loadWorkspace(_ctx, input) {
          return api(`/edu/api/g1/study?conceptId=${encodeURIComponent(input.conceptId)}`);
        },
        async startSession(_ctx, input) {
          return api("/edu/api/g1/tutor/start", body(input));
        },
        async submitTurn(_ctx, input) {
          const attempt = input.attempt;
          const answerText = attempt !== null && attempt !== void 0 && typeof attempt.answerText === "string" ? attempt.answerText : null;
          const fallbackMessage = attempt !== null && attempt !== void 0 ? `\u6211\u63D0\u4EA4\u4E86\u6D3B\u52A8 ${String(attempt.activityId ?? "")} \u7684\u4F5C\u7B54\uFF08${String(
            attempt.inputType ?? "text"
          )}\uFF09\uFF1A${answerText ?? "(\u56FE\u7247\u4F5C\u7B54)"}\u3002sessionId=${String(
            input.sessionId ?? ""
          )}\u3002\u8BF7\u6839\u636E\u8FD9\u6B21\u771F\u5B9E\u63D0\u4EA4\u7684\u8BC4\u5206\u7ED3\u679C\u7ED9\u51FA\u6559\u5B66\u53CD\u9988\uFF0C\u4E0D\u8981\u8981\u6C42\u6211\u91CD\u590D\u63D0\u4F9B sessionId\u3002` : input.helpRequest !== null && input.helpRequest !== void 0 ? "\u8BF7\u6839\u636E\u5F53\u524D\u6982\u5FF5\u548C\u6D3B\u52A8\u7ED9\u6211\u5E2E\u52A9\u3002" : "\u7EE7\u7EED";
          const message = typeof input.message === "string" && input.message.trim().length > 0 ? input.message : fallbackMessage;
          return api("/edu/api/g1/tutor/turn", body({ ...input, message }));
        },
        async skip(_ctx, input) {
          return api("/edu/api/g1/tutor/skip", body(input));
        },
        async end(_ctx, input) {
          return api("/edu/api/g1/tutor/end", body(input));
        },
        async retryPendingGrading(_ctx, input) {
          return api("/edu/api/g1/tutor/retry", body(input));
        },
        async finishLearning(_ctx, input) {
          return api("/edu/api/g1/tutor/finish-learning", body(input));
        },
        async finishReview(_ctx, input) {
          return api("/edu/api/g1/tutor/finish-review", body(input));
        },
        async loadProgress(_ctx, conceptId) {
          return api(`/edu/api/g1/progress?conceptId=${encodeURIComponent(conceptId)}`);
        },
        async loadReviewRange() {
          return { ok: true, revision: 1, data: { candidates: [], policyVersion: "review-policy-v1", note: "no scheduled review items" } };
        },
        async deferReview() {
          return { ok: false, error: { code: "UNSUPPORTED", message: "review defer is not wired yet" } };
        },
        async loadDraft(_ctx, key) {
          return api(`/edu/api/g1/draft?${new URLSearchParams({ conceptId: key.conceptId, mode: key.mode, activityId: key.activityId }).toString()}`);
        },
        async saveDraft(_ctx, draft) {
          return api("/edu/api/g1/draft", body(draft));
        },
        async clearDraft(_ctx, key) {
          return api("/edu/api/g1/draft/clear", body(key));
        },
        async saveSelfReport(_ctx, input) {
          return api("/edu/api/g1/self-report", body(input));
        },
        /**
         * F7: image answers go through the real `/edu/api/g1/image` route, which
         * grades with `evaluateImageAnswer` after the quality gate and persists the
         * attempt through the learner pipeline. `attemptOutcome` is the journal
         * receipt (never null on a graded/clarification response); a duplicate
         * image submission returns the existing record marked `duplicate: true`.
         */
        async submitImageAnswer(_ctx, input) {
          const base64 = typeof input?.base64 === "string" ? input.base64 : "";
          if (base64.length === 0) {
            return {
              ok: false,
              error: { code: "UNSUPPORTED", message: "\u8FD8\u6CA1\u6709\u9009\u62E9\u56FE\u7247\uFF1B\u8BF7\u5148\u9009\u62E9\u5E76\u9884\u89C8\u540E\u518D\u53D1\u9001\u3002", retryable: true }
            };
          }
          const response = await api("/edu/api/g1/image", body({
            base64,
            mime: typeof input.mime === "string" ? input.mime : "image/png",
            width: Number(input.width ?? 0),
            height: Number(input.height ?? 0),
            activityId: typeof input.activityId === "string" ? input.activityId : null,
            sessionId: typeof input.sessionId === "string" ? input.sessionId : null
          }));
          if (response.ok !== true || response.data === void 0) return response;
          const data = response.data;
          const grade = data.grade ?? null;
          const stage = typeof data.stage === "string" ? data.stage : "unknown";
          const clarification = data.clarification ?? null;
          const message = typeof grade?.feedback === "string" && grade.feedback.length > 0 ? grade.feedback : typeof clarification?.message === "string" ? clarification.message : "\u8FD9\u6B21\u56FE\u7247\u6CA1\u6709\u5F62\u6210\u5224\u65AD\u3002";
          const sourceRefs = Array.isArray(grade?.sourceRefs) ? grade.sourceRefs : [];
          const revision = typeof response.revision === "number" ? response.revision : 1;
          return {
            ok: true,
            revision,
            data: {
              revision,
              message,
              decision: {
                action: stage === "graded" ? "image_grade" : stage,
                rationale: `product image route: stage=${stage}, modelCalled=${String(data.modelCalled === true)}`,
                disclosure: false,
                guidance: message,
                difficulty: "same",
                sourceRefs,
                reviewStage: null
              },
              state: {
                revision,
                consecutiveFailures: 0,
                difficulty: "standard",
                currentActivityId: typeof input.activityId === "string" ? input.activityId : null,
                reviewStage: null,
                status: "active",
                helpKinds: [],
                disclosure: false
              },
              attemptOutcome: data.attemptOutcome ?? null,
              gateway: "image",
              model: {
                provider: "deepseek-official",
                model: typeof data.model === "string" ? data.model : "deepseek-flash",
                text: true,
                image: true
              },
              sourceCitation: { required: false, refs: sourceRefs, missing: false },
              toolResults: [],
              audit: [],
              image: {
                stage,
                modelCalled: data.modelCalled === true,
                evidenceCandidates: Array.isArray(data.evidenceCandidates) ? data.evidenceCandidates : [],
                gate: data.gate ?? null,
                qualitySignal: data.qualitySignal ?? null,
                clarification,
                persistence: data.persistence ?? null
              }
            }
          };
        }
      };
    }
    
    // education/runtime/client-plugin/src/index.ts
    var inject = ["slots"];
    var EDUCATION_ROOT_TITLE = "\u6559\u80B2\u5B66\u4E60\u5DE5\u4F5C\u533A";
    var controllerRef = null;
    var pagesRegistered = false;
    function registerLivePages(controller) {
      if (pagesRegistered) return;
      pagesRegistered = true;
      const shell = controller.shell;
      createLibraryUi({ dataSource: createLiveLibraryDataSource() }).register(shell);
      createMapUi({ dataSource: createLiveMapDataSource() }).register(shell);
      createStudyUi({ dataSource: createLiveStudyDataSource() }).register(shell);
    }
    function createReactRootHost() {
      return {
        createRootOccupant(mount) {
          return function EducationRootOccupant() {
            const ref = React.useRef(null);
            React.useEffect(() => {
              const element = ref.current;
              if (element === null) return;
              let disposed = false;
              let controller = null;
              void mount(element).then(async (mounted) => {
                if (disposed) {
                  await mounted.unmount();
                  return;
                }
                controller = mounted;
                controllerRef = mounted;
                await mounted.ready;
                registerLivePages(mounted);
              });
              return () => {
                disposed = true;
                if (controller !== null) {
                  controllerRef = null;
                  void controller.unmount();
                }
              };
            }, []);
            return React.createElement("div", {
              id: "edu-education-root",
              "data-edu-root": "t13-live",
              style: { minHeight: "100vh" },
              ref
            });
          };
        }
      };
    }
    var registration = null;
    function apply(context) {
      document.title = EDUCATION_ROOT_TITLE;
      const style = document.createElement("style");
      style.dataset["eduLiveStyle"] = "true";
      style.textContent = '[data-testid="library-import-panel"],[data-testid="library-fixture-notice"]{display:none!important}';
      document.head.append(style);
      registration = registerEducationRoot(
        context.slots,
        createReactRootHost(),
        { data: createLiveShellDataSource(), initialPath: "/home" }
      );
    }
    async function dispose() {
      pagesRegistered = false;
      controllerRef = null;
      if (registration !== null) {
        await registration.dispose();
        registration = null;
      }
    }
    
    return module.exports;
  },
});
