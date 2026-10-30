/** T12 study-specific layout; tokens and controls come from @edu/client-shell. */

import { DESIGN_TOKENS as T } from '../../shell/src/index.js';

export const STUDY_STYLE_ATTRIBUTE = 'data-edu-study-style';

export const studyStyles = `
.edu-study { min-width: 0; }
.edu-study *,
.edu-study *::before,
.edu-study *::after { box-sizing: border-box; }
.edu-study-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.05fr) minmax(0, 1.35fr) minmax(0, 0.95fr);
  gap: ${T.spacing.md};
  align-items: start;
  min-width: 0;
}
.edu-study-panel {
  min-width: 0;
  background: var(--edu-color-surface);
  border: 1px solid var(--edu-color-line);
  border-radius: var(--edu-radius-lg);
  padding: ${T.spacing.md};
}
.edu-study-material,
.edu-study-chat,
.edu-study-activity,
.edu-study-feedback,
.edu-study-finish { min-width: 0; overflow-wrap: anywhere; }
.edu-study-list { margin: ${T.spacing.xs} 0; padding-left: ${T.spacing.lg}; }
.edu-study-text { margin: ${T.spacing.xs} 0; overflow-wrap: anywhere; }
.edu-study-misconceptions { border-left: 0.25rem solid ${T.colors.warning}; padding-left: ${T.spacing.sm}; margin: ${T.spacing.sm} 0; }
.edu-study-source-row { display: flex; flex-wrap: wrap; gap: ${T.spacing.xs}; align-items: center; margin: ${T.spacing.xs} 0; min-width: 0; }
.edu-study-source-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 13rem), 1fr)); gap: ${T.spacing.sm}; }
.edu-study-source-box { border: 1px solid var(--edu-color-line); border-radius: var(--edu-radius-md); padding: ${T.spacing.sm}; min-width: 0; }
.edu-study-source-value { margin: ${T.spacing.xxs} 0 0; font-size: var(--edu-font-lg); font-weight: 700; overflow-wrap: anywhere; }
.edu-study-status { margin: ${T.spacing.sm} 0 0; color: var(--edu-color-ink-muted); font-size: var(--edu-font-sm); overflow-wrap: anywhere; }
.edu-study-status[data-state="failed"] { color: var(--edu-color-danger); font-weight: 600; }
.edu-study-status[data-state="saved"] { color: var(--edu-color-success); }
.edu-study-activity-head { display: flex; flex-wrap: wrap; gap: ${T.spacing.xs}; align-items: center; justify-content: space-between; }
.edu-study-stem { margin: ${T.spacing.sm} 0; font-size: var(--edu-font-lg); font-weight: 600; overflow-wrap: anywhere; }
.edu-study-pending { border: 1px dashed var(--edu-color-line-strong); border-radius: var(--edu-radius-md); padding: ${T.spacing.md}; margin: ${T.spacing.sm} 0; }
.edu-study-message { border-left: 0.25rem solid var(--edu-color-line); padding: ${T.spacing.xs} ${T.spacing.sm}; margin: ${T.spacing.xs} 0; min-width: 0; }
.edu-study-message--student { border-left-color: ${T.colors.info}; background: ${T.colors.infoSoft}; }
.edu-study-message--assistant { border-left-color: ${T.colors.accent}; background: ${T.colors.accentSoft}; }
.edu-study-message--system { border-left-color: ${T.colors.warning}; background: ${T.colors.warningSoft}; }
.edu-study-message p { margin: ${T.spacing.xxs} 0 0; overflow-wrap: anywhere; }
.edu-study-help-actions { display: flex; flex-wrap: wrap; gap: ${T.spacing.xs}; margin: ${T.spacing.sm} 0; }
.edu-study-chat-input { display: grid; gap: ${T.spacing.xs}; margin-top: ${T.spacing.sm}; }
.edu-study-chat-input textarea { width: 100%; min-height: 4.5rem; }
.edu-study-low-difficulty { margin-top: ${T.spacing.sm}; padding: ${T.spacing.sm}; border: 1px dashed var(--edu-color-line-strong); border-radius: var(--edu-radius-md); }
.edu-study-review-list { list-style: none; padding: 0; margin: ${T.spacing.sm} 0; display: grid; gap: ${T.spacing.xs}; }
.edu-study-review-item { border: 1px solid var(--edu-color-line); border-radius: var(--edu-radius-md); padding: ${T.spacing.sm}; min-width: 0; }
.edu-study-review-label { display: flex; flex-wrap: wrap; gap: ${T.spacing.xs}; align-items: center; cursor: pointer; }
.edu-study-axis { border-top: 1px solid var(--edu-color-line); margin-top: ${T.spacing.md}; padding-top: ${T.spacing.sm}; min-width: 0; }
.edu-study-self-report { border-top: 1px dashed var(--edu-color-line); margin-top: ${T.spacing.md}; padding-top: ${T.spacing.sm}; min-width: 0; }
.edu-study-finish { border: 1px solid var(--edu-color-accent); border-radius: var(--edu-radius-md); padding: ${T.spacing.md}; background: var(--edu-color-accent-soft); }
.edu-study-image-flow { margin: ${T.spacing.sm} 0; min-width: 0; }
.edu-study-image-picker { display: flex; flex-wrap: wrap; gap: ${T.spacing.xs}; align-items: center; margin: ${T.spacing.sm} 0; min-width: 0; }
.edu-study-image-picker label.edu-button { cursor: pointer; }
.edu-study-image-file { max-width: 100%; font-size: var(--edu-font-sm); }
.edu-study-image-preview { display: block; max-width: 100%; max-height: 22rem; object-fit: contain; border: 1px solid var(--edu-color-line); border-radius: var(--edu-radius-md); margin: ${T.spacing.sm} 0; background: var(--edu-color-surface); }
.edu-study-image-result { border-top: 1px dashed var(--edu-color-line); margin-top: ${T.spacing.md}; padding-top: ${T.spacing.sm}; min-width: 0; }
.edu-cloud-note { margin: ${T.spacing.sm} 0 0; color: var(--edu-color-ink-muted); font-size: var(--edu-font-sm); }
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

export function ensureStudyStyles(doc: Document): HTMLStyleElement {
  const existing = doc.head.querySelector<HTMLStyleElement>(`style[${STUDY_STYLE_ATTRIBUTE}]`);
  if (existing !== null) return existing;
  const style = doc.createElement('style');
  style.setAttribute(STUDY_STYLE_ATTRIBUTE, 'true');
  style.textContent = studyStyles;
  doc.head.append(style);
  return style;
}
