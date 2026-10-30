/**
 * Education shell design tokens.
 *
 * One source for colour, type, spacing and focus. Sizes are expressed in
 * `rem` so the whole surface scales with the browser/system font setting: the
 * default base is 1.25rem (20px at the usual 16px root).
 */

export const DESIGN_TOKENS = {
  /** 20px at a 16px root font. Deliberately larger than the browser default. */
  baseFontSize: '1.25rem',
  fontSizes: {
    xs: '0.75rem',
    sm: '0.875rem',
    md: '1rem',
    lg: '1.125rem',
    xl: '1.375rem',
    xxl: '1.75rem',
  },
  lineHeights: {
    tight: '1.25',
    normal: '1.55',
    relaxed: '1.7',
  },
  spacing: {
    xxs: '0.25rem',
    xs: '0.5rem',
    sm: '0.75rem',
    md: '1rem',
    lg: '1.5rem',
    xl: '2rem',
    xxl: '3rem',
  },
  radii: {
    sm: '0.35rem',
    md: '0.65rem',
    lg: '0.9rem',
    pill: '999rem',
  },
  colors: {
    canvas: '#f4f6f2',
    surface: '#ffffff',
    surfaceMuted: '#eef2ec',
    ink: '#17211b',
    inkMuted: '#465349',
    inkFaint: '#5f6d63',
    line: '#c7d1c8',
    lineStrong: '#8d9c90',
    accent: '#1f6b46',
    accentStrong: '#124a2f',
    accentSoft: '#e2f0e6',
    focus: '#9a4b00',
    info: '#1d4e89',
    infoSoft: '#e7eff9',
    warning: '#7a4600',
    warningSoft: '#fdf1dc',
    danger: '#9b1c1c',
    dangerSoft: '#fbe9e7',
    success: '#14603c',
    successSoft: '#dff1e5',
    neutralSoft: '#e9eeea',
    onAccent: '#ffffff',
  },
  focusRing: '3px solid #9a4b00',
  breakpoints: {
    /** Below this the sidebar collapses to a top navigation row. */
    compact: 1100,
    standard: 1280,
    wide: 1440,
  },
  layout: {
    sidebarRem: 14,
    gapRem: 1.5,
    pagePaddingRem: 2,
    minContentRem: 20,
    maxContentRem: 72,
  },
} as const;

export type DesignTokens = typeof DESIGN_TOKENS;
export type StatusTone = 'neutral' | 'progress' | 'attention' | 'positive' | 'info' | 'danger';

/** Maps a semantic tone to a token-backed CSS custom property. */
export const STATUS_TONE_COLORS: Record<StatusTone, { readonly fg: string; readonly bg: string }> = {
  neutral: { fg: DESIGN_TOKENS.colors.inkMuted, bg: DESIGN_TOKENS.colors.neutralSoft },
  progress: { fg: DESIGN_TOKENS.colors.info, bg: DESIGN_TOKENS.colors.infoSoft },
  attention: { fg: DESIGN_TOKENS.colors.warning, bg: DESIGN_TOKENS.colors.warningSoft },
  positive: { fg: DESIGN_TOKENS.colors.success, bg: DESIGN_TOKENS.colors.successSoft },
  info: { fg: DESIGN_TOKENS.colors.info, bg: DESIGN_TOKENS.colors.infoSoft },
  danger: { fg: DESIGN_TOKENS.colors.danger, bg: DESIGN_TOKENS.colors.dangerSoft },
};
