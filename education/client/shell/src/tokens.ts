/**
 * 芽问设计 token：颜色、字号、间距、圆角、阴影、断点。
 *
 * 原则：暖纸底 + 白卡 + 深绿主色 + 琥珀提醒；正文 16px 基准（系统放大后仍可完成主旅程）；
 * 状态永远"颜色 + 文字 + 形状"三重编码，不靠颜色单独承载信息。
 */

export const DESIGN_TOKENS = {
  /** 16px 基准；阅读区正文用 1.0625–1.125rem。 */
  baseFontSize: '1rem',
  fontSizes: {
    xs: '0.8125rem',
    sm: '0.875rem',
    md: '1rem',
    lg: '1.125rem',
    xl: '1.375rem',
    xxl: '1.75rem',
    display: '2rem',
  },
  lineHeights: {
    tight: '1.25',
    normal: '1.6',
    relaxed: '1.85',
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
    sm: '0.5rem',
    md: '0.75rem',
    lg: '1.125rem',
    xl: '1.5rem',
    pill: '999rem',
  },
  shadows: {
    card: '0 1px 2px rgba(31, 36, 33, 0.05), 0 10px 28px rgba(31, 36, 33, 0.06)',
    pop: '0 16px 40px rgba(31, 36, 33, 0.14)',
  },
  colors: {
    canvas: '#faf7f0',
    surface: '#ffffff',
    surfaceMuted: '#f4efe4',
    surfacePaper: '#fdfaf2',
    ink: '#1f2421',
    inkMuted: '#5a6259',
    inkFaint: '#8b9187',
    line: '#e6e1d6',
    lineStrong: '#d6cfc0',
    accent: '#2f6b4f',
    accentStrong: '#1f4e38',
    accentSoft: '#e6f0e8',
    accentTint: '#f0f6f1',
    focus: '#2f6b4f',
    info: '#2f5d8a',
    infoSoft: '#e8f0f7',
    warning: '#a9661f',
    warningSoft: '#fbf0df',
    danger: '#a13a32',
    dangerSoft: '#fbeae7',
    success: '#2f6b4f',
    successSoft: '#e6f0e8',
    neutralSoft: '#f1ece1',
    onAccent: '#ffffff',
  },
  focusRing: '3px solid #2f6b4f',
  breakpoints: {
    /** 低于该宽度时学习台从"对开"变"单页"，侧栏变抽屉。 */
    compact: 1100,
    standard: 1280,
    wide: 1440,
  },
  layout: {
    sidebarRem: 14,
    gapRem: 1.5,
    pagePaddingRem: 2,
    minContentRem: 20,
    maxContentRem: 86,
    /** 学习台右页最小可读宽度（rem）。 */
    workPaneMinRem: 22,
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
