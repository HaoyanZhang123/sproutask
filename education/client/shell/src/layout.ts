/**
 * Layout budget used by tests, the shell's compact-mode decision and the
 * study desk. happy-dom has no layout engine, so we assert a *logical* layout
 * contract instead of pretending to measure pixels:
 *
 * - the content column never exceeds the readable maximum;
 * - it never drops below the readable minimum (otherwise: horizontal overflow);
 * - below the compact breakpoint the study desk stacks to a single page.
 */

import { DESIGN_TOKENS } from './tokens.js';

export type LayoutMode = 'wide' | 'compact';
/** Navigation is always a horizontal top bar; compact keeps it above content. */
export type NavOrientation = 'horizontal';

export interface LayoutBudget {
  readonly viewportWidth: number;
  readonly viewportHeight: number;
  readonly baseFontPx: number;
  readonly mode: LayoutMode;
  readonly navOrientation: NavOrientation;
  /** Kept for callers that still ask about the retired sidebar: always 0. */
  readonly sidebarWidthPx: number;
  readonly gapPx: number;
  readonly contentWidthPx: number;
  readonly maxContentWidthPx: number;
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
  baseFontPx: number = 16,
): LayoutBudget {
  const pagePaddingPx = remToPx(DESIGN_TOKENS.layout.pagePaddingRem, baseFontPx);
  const minContentWidthPx = remToPx(DESIGN_TOKENS.layout.minContentRem, baseFontPx);
  const maxContentWidthPx = remToPx(DESIGN_TOKENS.layout.maxContentRem, baseFontPx);
  const available = Math.max(0, viewportWidth - pagePaddingPx * 2);
  const contentWidthPx = Math.min(available, maxContentWidthPx);
  const compact = viewportWidth < DESIGN_TOKENS.breakpoints.compact;

  return {
    viewportWidth,
    viewportHeight,
    baseFontPx,
    mode: compact ? 'compact' : 'wide',
    navOrientation: 'horizontal',
    sidebarWidthPx: 0,
    gapPx: 0,
    contentWidthPx,
    maxContentWidthPx,
    minContentWidthPx,
    pagePaddingPx,
    fits: contentWidthPx >= minContentWidthPx,
    horizontalOverflow: contentWidthPx < minContentWidthPx,
  };
}

/** Base font in px for the supported scale steps (standard is the 16px base). */
export const FONT_SCALE_STEPS = {
  standard: 16,
  large: 20,
} as const;

export type FontScale = keyof typeof FONT_SCALE_STEPS;
