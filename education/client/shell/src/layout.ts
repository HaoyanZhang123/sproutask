/**
 * Layout budget used by tests and by the shell's compact-mode decision.
 *
 * happy-dom has no layout engine, so the shell asserts a *logical* layout
 * contract instead of pretending to measure pixels: the sidebar + gap + a
 * readable content column must fit inside the viewport, and below the compact
 * breakpoint the shell stacks to one column.
 */

import { DESIGN_TOKENS } from './tokens.js';

export type LayoutMode = 'sidebar' | 'stacked';
export type NavOrientation = 'vertical' | 'horizontal';

export interface LayoutBudget {
  readonly viewportWidth: number;
  readonly viewportHeight: number;
  readonly baseFontPx: number;
  readonly mode: LayoutMode;
  readonly navOrientation: NavOrientation;
  readonly sidebarWidthPx: number;
  readonly gapPx: number;
  readonly contentWidthPx: number;
  readonly minContentWidthPx: number;
  readonly pagePaddingPx: number;
  /** The content column stays at or above the readable minimum. */
  readonly fits: boolean;
  /** The logical columns exceed the viewport (would require horizontal scroll). */
  readonly horizontalOverflow: boolean;
}

export function remToPx(rem: number, baseFontPx: number): number {
  return rem * baseFontPx;
}

export function evaluateLayout(
  viewportWidth: number,
  viewportHeight: number,
  baseFontPx: number = 20,
): LayoutBudget {
  const sidebarWidthPx = remToPx(DESIGN_TOKENS.layout.sidebarRem, baseFontPx);
  const gapPx = remToPx(DESIGN_TOKENS.layout.gapRem, baseFontPx);
  const pagePaddingPx = remToPx(DESIGN_TOKENS.layout.pagePaddingRem, baseFontPx);
  const minContentWidthPx = remToPx(DESIGN_TOKENS.layout.minContentRem, baseFontPx);
  const compact = viewportWidth < DESIGN_TOKENS.breakpoints.compact;
  const sidebarFits = sidebarWidthPx + gapPx + minContentWidthPx <= viewportWidth;

  if (!compact && sidebarFits) {
    const contentWidthPx = viewportWidth - sidebarWidthPx - gapPx - pagePaddingPx * 2;
    return {
      viewportWidth,
      viewportHeight,
      baseFontPx,
      mode: 'sidebar',
      navOrientation: 'vertical',
      sidebarWidthPx,
      gapPx,
      contentWidthPx,
      minContentWidthPx,
      pagePaddingPx,
      fits: contentWidthPx >= minContentWidthPx,
      horizontalOverflow: contentWidthPx < minContentWidthPx,
    };
  }

  const contentWidthPx = viewportWidth - pagePaddingPx * 2;
  return {
    viewportWidth,
    viewportHeight,
    baseFontPx,
    mode: 'stacked',
    navOrientation: 'horizontal',
    sidebarWidthPx,
    gapPx,
    contentWidthPx,
    minContentWidthPx,
    pagePaddingPx,
    fits: contentWidthPx >= minContentWidthPx,
    horizontalOverflow: contentWidthPx < minContentWidthPx,
  };
}

/** Base font in px for the supported scale steps (standard is the 20px base). */
export const FONT_SCALE_STEPS = {
  standard: 20,
  large: 25,
} as const;

export type FontScale = keyof typeof FONT_SCALE_STEPS;
