/**
 * 学习台样式：一张摊开的课本 + 练习本。
 *
 * 只做表现层：颜色/字号/间距/圆角/阴影全部来自 @edu/client-shell 的
 * DESIGN_TOKENS（本文件不新增依赖、不写死色值）；状态永远是「颜色 + 文字 +
 * 形状」三重编码，不靠颜色单独承载信息。
 */

import { DESIGN_TOKENS as T } from '../../shell/src/index.js';

export const STUDY_STYLE_ATTRIBUTE = 'data-edu-study-style';

/** 学习台从「对开」变「单页」的宽度（与 shell 的 breakpoints.compact 一致）。 */
export const STUDY_COMPACT_QUERY = `(max-width: ${T.breakpoints.compact - 1}px)`;

export const studyStyles = `
.edu-study {
  --edu-study-paper: ${T.colors.surfacePaper};
  --edu-study-paper-line: ${T.colors.line};
  width: 100%;
  max-width: 78rem;
  margin-inline: auto;
  min-width: 0;
}
.edu-study *,
.edu-study *::before,
.edu-study *::after { box-sizing: border-box; }
.edu-study .edu-study-icon { width: 1em; height: 1em; flex: none; }

/* ---------- 台面顶部：概念标题 + 保存状态 + 结束本轮 ---------- */
.edu-study-top {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  gap: var(--edu-space-sm);
  margin-bottom: var(--edu-space-xs);
  min-width: 0;
}
.edu-study-top__main { min-width: 0; }
.edu-study-top__title {
  margin: 0;
  font-size: var(--edu-font-xxl);
  line-height: ${T.lineHeights.tight};
  letter-spacing: -0.01em;
  overflow-wrap: anywhere;
}
.edu-study-top__mode {
  margin: var(--edu-space-xxs) 0 0;
  font-size: var(--edu-font-sm);
  color: var(--edu-color-ink-muted);
}
.edu-study-top__side {
  margin-left: auto;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--edu-space-xs);
}
.edu-study-save {
  font-size: var(--edu-font-sm);
  color: var(--edu-color-ink-muted);
  min-height: 1.5rem;
  display: inline-flex;
  align-items: center;
  gap: var(--edu-space-xxs);
}
.edu-study-save[data-state="saved"] { color: var(--edu-color-success); }
.edu-study-save[data-state="saving"] { color: var(--edu-color-ink-muted); }
.edu-study-save[data-state="failed"] { color: var(--edu-color-danger); font-weight: 700; }
.edu-study-save[data-state="none"] { display: none; }

/* ---------- 进度条 ---------- */
.edu-study-ribbon {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--edu-space-xs);
  margin: 0 0 var(--edu-space-lg);
  min-width: 0;
}
.edu-study-ribbon__bars { display: flex; align-items: center; gap: var(--edu-space-xs); min-width: 0; }
.edu-study-ribbon__bar {
  flex: 0 0 ${T.spacing.xl};
  height: 0.4rem;
  border-radius: var(--edu-radius-pill);
  background: var(--edu-color-surface-muted);
}
.edu-study-ribbon__bar[data-state="done"] { background: var(--edu-color-accent-soft); }
.edu-study-ribbon__bar[data-state="now"] { background: var(--edu-color-accent); }
.edu-study-ribbon__cap {
  margin-left: var(--edu-space-xxs);
  font-size: var(--edu-font-sm);
  color: var(--edu-color-ink-muted);
}

/* ---------- 学习台本体：左页课本 + 右页练习 ---------- */
.edu-study-desk {
  position: relative;
  display: grid;
  grid-template-columns: minmax(0, 0.9fr) minmax(0, 1.1fr);
  background: var(--edu-color-surface);
  border: 1px solid var(--edu-color-line);
  border-radius: ${T.radii.xl};
  box-shadow: ${T.shadows.card};
  overflow: hidden;
  min-width: 0;
}
.edu-study-text-page {
  position: relative;
  min-width: 0;
  padding: var(--edu-space-xl) var(--edu-space-xl) var(--edu-space-xxl);
  background: var(--edu-study-paper);
  border-right: 1px solid var(--edu-study-paper-line);
}
.edu-study-work-page {
  display: grid;
  gap: var(--edu-space-md);
  align-content: start;
  min-width: 0;
  padding: var(--edu-space-xl) var(--edu-space-xl) var(--edu-space-xxl);
  background: var(--edu-color-surface);
}
.edu-study-text-page__body,
.edu-study-work-page > [data-edu-slot] { min-width: 0; }
.edu-study-work-page > [data-edu-slot]:empty { display: none; }

/* 课本页：页眉、正文、可折叠块、页码 */
.edu-study-material { min-width: 0; overflow-wrap: anywhere; }
.edu-study-kicker { display: flex; align-items: center; gap: var(--edu-space-xs); margin-bottom: var(--edu-space-md); }
.edu-study-kicker h3 {
  margin: 0;
  font-size: var(--edu-font-xs);
  font-weight: 800;
  letter-spacing: 0.14em;
  color: var(--edu-color-ink-muted);
}
.edu-study-kicker .edu-chip { margin-left: auto; }
.edu-study-page-text {
  margin: 0 0 var(--edu-space-md);
  font-size: var(--edu-font-md);
  line-height: ${T.lineHeights.relaxed};
  color: var(--edu-color-ink);
  overflow-wrap: anywhere;
}
.edu-study-subtitle {
  margin: var(--edu-space-sm) 0 var(--edu-space-xs);
  font-size: var(--edu-font-sm);
  letter-spacing: 0.06em;
  color: var(--edu-color-ink-muted);
}
.edu-study-list { margin: var(--edu-space-xxs) 0; padding-left: var(--edu-space-lg); font-size: var(--edu-font-sm); }
.edu-study-list li { margin: var(--edu-space-xxs) 0; overflow-wrap: anywhere; }
.edu-study-fold {
  border-top: 1px dashed var(--edu-color-line);
  padding-top: var(--edu-space-sm);
  margin-top: var(--edu-space-md);
}
.edu-study-fold summary {
  display: flex;
  align-items: center;
  gap: var(--edu-space-xs);
  cursor: pointer;
  font-size: var(--edu-font-sm);
  font-weight: 700;
  color: var(--edu-color-ink);
  list-style: none;
}
.edu-study-fold summary::-webkit-details-marker { display: none; }
.edu-study-fold__chev { color: var(--edu-color-ink-muted); transition: transform 0.18s ease; }
.edu-study-fold[open] .edu-study-fold__chev { transform: rotate(90deg); }
.edu-study-fold__body {
  margin-top: var(--edu-space-xs);
  font-size: var(--edu-font-sm);
  line-height: ${T.lineHeights.normal};
  color: var(--edu-color-ink-muted);
}
.edu-study-fold__body p { margin: 0 0 var(--edu-space-xs); overflow-wrap: anywhere; }
.edu-study-source-row { display: flex; flex-wrap: wrap; gap: var(--edu-space-xs); align-items: center; min-width: 0; }
.edu-study-page-num {
  position: absolute;
  right: var(--edu-space-xl);
  bottom: var(--edu-space-md);
  font-size: var(--edu-font-xs);
  letter-spacing: 0.12em;
  color: var(--edu-color-ink-faint);
}
.edu-study-muted { margin: var(--edu-space-sm) 0 0; font-size: var(--edu-font-sm); color: var(--edu-color-ink-muted); overflow-wrap: anywhere; }
.edu-study-note { margin: var(--edu-space-xs) 0; font-size: var(--edu-font-sm); color: var(--edu-color-ink-muted); overflow-wrap: anywhere; }

/* 出处弹层（source-view）内容 */
.edu-study-source-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 13rem), 1fr));
  gap: var(--edu-space-sm);
}
.edu-study-source-box {
  border: 1px solid var(--edu-color-line);
  border-radius: var(--edu-radius-md);
  padding: var(--edu-space-sm);
  min-width: 0;
}
.edu-study-source-value { margin: var(--edu-space-xxs) 0 0; font-size: var(--edu-font-lg); font-weight: 700; overflow-wrap: anywhere; }

/* ---------- 题目页 ---------- */
.edu-study-activity { min-width: 0; overflow-wrap: anywhere; }
.edu-study-q-head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--edu-space-xs);
  margin: 0;
  font-size: var(--edu-font-xs);
  font-weight: 800;
  letter-spacing: 0.12em;
  color: var(--edu-color-ink-muted);
}
.edu-study-q-head__dot { color: var(--edu-color-line-strong); }
.edu-study-stem {
  margin: 0 0 var(--edu-space-sm);
  font-size: var(--edu-font-xl);
  line-height: ${T.lineHeights.tight};
  letter-spacing: -0.005em;
  overflow-wrap: anywhere;
}
.edu-study-answer {
  display: flex;
  flex-wrap: wrap;
  gap: var(--edu-space-xs);
  margin: var(--edu-space-sm) 0;
  padding: var(--edu-space-xs) var(--edu-space-sm);
  border-left: 0.1875rem solid var(--edu-color-line-strong);
  font-size: var(--edu-font-sm);
  color: var(--edu-color-ink-muted);
  overflow-wrap: anywhere;
}
.edu-study-answer__label { font-weight: 700; color: var(--edu-color-ink); }
.edu-study-pending {
  border: 1px dashed var(--edu-color-line-strong);
  border-radius: var(--edu-radius-md);
  padding: var(--edu-space-md);
  margin: var(--edu-space-sm) 0;
}
.edu-study-pending p { margin: 0 0 var(--edu-space-xs); }
.edu-study-work-foot {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--edu-space-sm);
  margin-top: var(--edu-space-lg);
  padding-top: var(--edu-space-md);
  border-top: 1px solid var(--edu-color-line);
}
.edu-study-hint-link {
  border: 0;
  background: none;
  padding: 0;
  font: inherit;
  font-size: var(--edu-font-sm);
  font-weight: 700;
  color: var(--edu-color-accent-strong);
  text-decoration: underline;
  text-underline-offset: 0.25rem;
  cursor: pointer;
}
.edu-study-work-foot__right {
  margin-left: auto;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--edu-space-xs);
}
.edu-study-slot-actions { display: flex; flex-wrap: wrap; gap: var(--edu-space-xs); margin-top: var(--edu-space-sm); }

/* 答案表单（visuals 提供的 choice / text / relation 控件） */
.edu-visual-form { display: grid; gap: var(--edu-space-sm); margin-top: var(--edu-space-sm); min-width: 0; }
.edu-visual-form fieldset { border: 0; margin: 0; padding: 0; display: grid; gap: var(--edu-space-xs); min-width: 0; }
.edu-visual-form legend { padding: 0; margin-bottom: var(--edu-space-xxs); font-size: var(--edu-font-sm); color: var(--edu-color-ink-muted); }
.edu-visual-option {
  display: flex;
  align-items: flex-start;
  gap: var(--edu-space-sm);
  width: 100%;
  padding: var(--edu-space-sm) var(--edu-space-md);
  border: 1px solid var(--edu-color-line);
  border-radius: var(--edu-radius-lg);
  background: var(--edu-color-surface);
  font-size: var(--edu-font-md);
  line-height: ${T.lineHeights.normal};
  cursor: pointer;
}
.edu-visual-option:hover { border-color: var(--edu-color-line-strong); }
.edu-visual-option:has(input:checked) { border-color: var(--edu-color-accent); background: var(--edu-color-accent-soft); }
.edu-visual-option input { flex: none; margin-top: 0.3rem; }
.edu-visual-option ol,
.edu-visual-option ul { margin: 0; padding-left: var(--edu-space-lg); }
.edu-visual-counter { margin: 0; font-size: var(--edu-font-sm); color: var(--edu-color-ink-muted); }
.edu-visual-pairs { display: grid; gap: var(--edu-space-xs); }
.edu-visual-pair { display: flex; flex-wrap: wrap; gap: var(--edu-space-xs); align-items: center; }
.edu-visual-actions { display: flex; flex-wrap: wrap; gap: var(--edu-space-xs); }
.edu-visual-actions:empty { display: none; }
.edu-visual-preview-placeholder { font-size: var(--edu-font-sm); color: var(--edu-color-ink-muted); }

/* 图片作答 */
.edu-study-image { min-width: 0; }
.edu-study-image-picker { display: flex; flex-wrap: wrap; gap: var(--edu-space-xs); align-items: center; margin: var(--edu-space-sm) 0; min-width: 0; }
.edu-study-image-picker label.edu-button { cursor: pointer; }
.edu-study-image-file { max-width: 100%; font-size: var(--edu-font-sm); }
.edu-study-image-preview {
  display: block;
  max-width: 100%;
  max-height: 22rem;
  object-fit: contain;
  border: 1px solid var(--edu-color-line);
  border-radius: var(--edu-radius-md);
  margin: var(--edu-space-sm) 0;
  background: var(--edu-color-surface);
}
.edu-study-image-result {
  border-top: 1px dashed var(--edu-color-line);
  margin-top: var(--edu-space-md);
  padding-top: var(--edu-space-sm);
  min-width: 0;
}
.edu-study-status { margin: var(--edu-space-xs) 0; font-size: var(--edu-font-sm); color: var(--edu-color-ink-muted); overflow-wrap: anywhere; }
.edu-study-cloud-note { margin: var(--edu-space-sm) 0 0; color: var(--edu-color-ink-muted); font-size: var(--edu-font-sm); }

/* 复习范围 */
.edu-study-review-list { list-style: none; padding: 0; margin: var(--edu-space-sm) 0; display: grid; gap: var(--edu-space-xs); }
.edu-study-review-item { border: 1px solid var(--edu-color-line); border-radius: var(--edu-radius-md); padding: var(--edu-space-sm); min-width: 0; }
.edu-study-review-label { display: flex; flex-wrap: wrap; gap: var(--edu-space-xs); align-items: center; cursor: pointer; }

/* ---------- 原地反馈（不另起一张卡） ---------- */
.edu-study-feedback { min-width: 0; }
.edu-study-feedback:focus { outline: var(--edu-focus-ring); outline-offset: 3px; }
.edu-study-result {
  border-top: 1px dashed var(--edu-color-line-strong);
  margin-top: var(--edu-space-md);
  padding-top: var(--edu-space-md);
  min-width: 0;
}
.edu-study-verdict { display: flex; flex-wrap: wrap; align-items: center; gap: var(--edu-space-xs); }
.edu-study-verdict__line {
  flex-basis: 100%;
  margin: var(--edu-space-xs) 0 0;
  font-size: var(--edu-font-lg);
  font-weight: 700;
  line-height: ${T.lineHeights.normal};
  overflow-wrap: anywhere;
}
.edu-study-why {
  margin: var(--edu-space-sm) 0 var(--edu-space-xs);
  font-size: var(--edu-font-md);
  line-height: ${T.lineHeights.relaxed};
  color: var(--edu-color-ink);
  max-width: 60ch;
  overflow-wrap: anywhere;
}
.edu-study-result__sources { display: flex; flex-wrap: wrap; gap: var(--edu-space-xs); margin: var(--edu-space-sm) 0 var(--edu-space-md); }
.edu-study-source-chip {
  border: 1px solid var(--edu-color-line);
  border-radius: var(--edu-radius-pill);
  background: var(--edu-color-surface);
  color: var(--edu-color-accent-strong);
  font: inherit;
  font-size: var(--edu-font-sm);
  padding: var(--edu-space-xxs) var(--edu-space-sm);
  cursor: pointer;
}
.edu-study-source-chip:hover { border-color: var(--edu-color-accent); }
.edu-study-result__actions { display: flex; flex-wrap: wrap; align-items: center; gap: var(--edu-space-xs); margin-top: var(--edu-space-sm); }
.edu-study-result__more { display: flex; flex-wrap: wrap; gap: var(--edu-space-xs); margin-top: var(--edu-space-sm); }
.edu-study-detail { border-top: 1px dashed var(--edu-color-line); margin-top: var(--edu-space-md); padding-top: var(--edu-space-sm); }
.edu-study-detail summary {
  cursor: pointer;
  font-size: var(--edu-font-sm);
  font-weight: 700;
  color: var(--edu-color-ink-muted);
}
.edu-study-criteria { margin: var(--edu-space-xs) 0 0; padding-left: var(--edu-space-lg); font-size: var(--edu-font-sm); color: var(--edu-color-ink-muted); display: grid; gap: var(--edu-space-xxs); }
.edu-study-criteria li { overflow-wrap: anywhere; }
.edu-study-clarify { margin: var(--edu-space-sm) 0; }
.edu-study-clarify__actions { display: flex; flex-wrap: wrap; gap: var(--edu-space-xs); margin-top: var(--edu-space-xs); }
.edu-study-axis__chips { display: flex; flex-wrap: wrap; gap: var(--edu-space-xs); margin-top: var(--edu-space-xs); }
.edu-study-self-report { border-top: 1px dashed var(--edu-color-line); margin-top: var(--edu-space-md); padding-top: var(--edu-space-sm); min-width: 0; }
.edu-study-finish {
  border: 1px solid var(--edu-color-accent);
  border-radius: var(--edu-radius-lg);
  padding: var(--edu-space-md);
  background: var(--edu-color-accent-soft);
  margin-top: var(--edu-space-md);
  min-width: 0;
}
.edu-study-finish__title { margin: 0 0 var(--edu-space-xs); font-size: var(--edu-font-lg); }
.edu-study-finish__line { margin: 0 0 var(--edu-space-xs); font-weight: 700; }
.edu-study-finish__chips { display: flex; flex-wrap: wrap; gap: var(--edu-space-xs); margin: var(--edu-space-xs) 0 var(--edu-space-sm); }

/* ---------- 窄屏：单页 + 课本抽屉 ---------- */
.edu-study-material-mini { display: none; }
.edu-study-material-close { display: none; }
.edu-study-material-toggle {
  margin-left: auto;
  border: 0;
  background: none;
  font: inherit;
  font-size: var(--edu-font-sm);
  font-weight: 700;
  color: var(--edu-color-accent-strong);
  text-decoration: underline;
  text-underline-offset: 0.25rem;
  cursor: pointer;
}
@media ${STUDY_COMPACT_QUERY} {
  .edu-study-desk {
    display: block;
    border-radius: var(--edu-radius-lg);
    overflow: visible;
  }
  .edu-study-work-page { padding: var(--edu-space-lg) var(--edu-space-md) var(--edu-space-xl); }
  .edu-study-material-mini {
    display: flex;
    align-items: center;
    gap: var(--edu-space-xs);
    padding: var(--edu-space-xs) var(--edu-space-sm);
    border: 1px solid var(--edu-color-line);
    border-radius: var(--edu-radius-md);
    background: var(--edu-color-surface-muted);
    font-size: var(--edu-font-sm);
    color: var(--edu-color-ink-muted);
    min-width: 0;
  }
  .edu-study-material-mini__text { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .edu-study-text-page {
    position: fixed;
    inset: 0 0 auto 0;
    z-index: 25;
    max-height: 82vh;
    overflow: auto;
    padding: var(--edu-space-lg) var(--edu-space-md) var(--edu-space-xl);
    border-right: 0;
    border-bottom: 1px solid var(--edu-color-line);
    border-radius: 0 0 var(--edu-radius-lg) var(--edu-radius-lg);
    box-shadow: ${T.shadows.pop};
    visibility: hidden;
    transform: translateY(-100%);
    transition: transform 0.2s ease;
  }
  .edu-study-desk[data-material-open="true"] .edu-study-text-page {
    visibility: visible;
    transform: translateY(0);
  }
  .edu-study-material-close {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    position: absolute;
    right: var(--edu-space-sm);
    top: var(--edu-space-sm);
    width: 2.25rem;
    height: 2.25rem;
    border: 1px solid var(--edu-color-line);
    border-radius: var(--edu-radius-pill);
    background: var(--edu-color-surface);
    color: var(--edu-color-ink-muted);
    cursor: pointer;
  }
  .edu-study-page-num { right: var(--edu-space-md); }
}

/* ---------- 小芽：右下浮起按钮 + 右侧对话层 ---------- */
.ask-sprout-pill {
  position: fixed;
  right: var(--edu-space-xl);
  bottom: var(--edu-space-lg);
  z-index: 30;
  display: inline-flex;
  align-items: center;
  gap: var(--edu-space-xs);
  height: 3.375rem;
  padding: 0 var(--edu-space-md) 0 var(--edu-space-xs);
  border: 0;
  border-radius: var(--edu-radius-pill);
  background: var(--edu-color-accent);
  color: var(--edu-color-on-accent);
  font: inherit;
  font-size: var(--edu-font-sm);
  font-weight: 700;
  box-shadow: ${T.shadows.pop};
  cursor: pointer;
}
.ask-sprout-pill:hover { background: var(--edu-color-accent-strong); }
.ask-sprout-pill__ava {
  display: grid;
  place-items: center;
  width: 2.25rem;
  height: 2.25rem;
  border-radius: var(--edu-radius-pill);
  background: color-mix(in srgb, var(--edu-color-on-accent) 22%, transparent);
  flex: none;
}
.ask-sprout-pill__ava .edu-study-icon { width: 1.25rem; height: 1.25rem; }
.sprout-sheet {
  position: fixed;
  right: var(--edu-space-xl);
  bottom: 5.75rem;
  z-index: 31;
  display: flex;
  flex-direction: column;
  width: min(24rem, calc(100vw - 2rem));
  max-height: min(34rem, calc(100vh - 8rem));
  background: var(--edu-color-surface);
  border: 1px solid var(--edu-color-line);
  border-radius: ${T.radii.xl};
  box-shadow: ${T.shadows.pop};
  overflow: hidden;
  min-height: 0;
}
.sprout-sheet[hidden] { display: none; }
.sprout-sheet__head {
  display: flex;
  align-items: center;
  gap: var(--edu-space-xs);
  padding: var(--edu-space-sm) var(--edu-space-md);
  border-bottom: 1px solid var(--edu-color-line);
  background: var(--edu-color-accent-soft);
}
.sprout-sheet__title { margin: 0; font-size: var(--edu-font-md); font-weight: 800; color: var(--edu-color-accent-strong); }
.sprout-sheet__sub { display: block; font-size: var(--edu-font-xs); font-weight: 600; color: var(--edu-color-accent-strong); opacity: 0.8; }
.sprout-sheet__close {
  margin-left: auto;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2rem;
  height: 2rem;
  border: 1px solid var(--edu-color-line);
  border-radius: var(--edu-radius-pill);
  background: var(--edu-color-surface);
  color: var(--edu-color-ink-muted);
  cursor: pointer;
}
.sprout-sheet__body {
  display: flex;
  flex-direction: column;
  gap: var(--edu-space-sm);
  padding: var(--edu-space-md);
  min-height: 0;
  overflow: hidden;
}
.sprout-thread {
  list-style: none;
  margin: 0;
  padding: 0 4px 0 0;
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
  display: grid;
  gap: var(--edu-space-xs);
  align-content: start;
}
.sprout-quick,
.sprout-sheet__notice,
.sprout-sheet__error,
.sprout-sheet__low { flex: 0 0 auto; }
.sprout-msg {
  max-width: 92%;
  padding: var(--edu-space-xs) var(--edu-space-sm);
  border-radius: var(--edu-radius-md);
  font-size: var(--edu-font-sm);
  line-height: ${T.lineHeights.normal};
  overflow-wrap: anywhere;
}
.sprout-msg[data-role="assistant"] { justify-self: start; background: var(--edu-color-accent-soft); color: var(--edu-color-ink); }
.sprout-msg[data-role="student"] { justify-self: end; background: var(--edu-color-info-soft); color: var(--edu-color-ink); }
.sprout-msg[data-role="system"] { justify-self: center; background: var(--edu-color-surface-muted); color: var(--edu-color-ink-muted); }
.sprout-msg__who { display: block; margin-bottom: var(--edu-space-xxs); font-size: var(--edu-font-xs); color: var(--edu-color-ink-faint); }
.sprout-msg p { margin: 0; }
.sprout-msg__text p { margin: 0 0 6px; }
.sprout-msg__text p:last-child { margin-bottom: 0; }
.sprout-msg__text ul { margin: 4px 0 6px; padding-left: 1.2em; }
.sprout-msg__text li { margin: 2px 0; }
.sprout-msg__text strong { font-weight: 650; }
.sprout-quick { display: flex; flex-wrap: wrap; gap: var(--edu-space-xs); }
.sprout-quick[hidden] { display: none; }
.sprout-sheet__notice:empty,
.sprout-sheet__error:empty,
.sprout-sheet__low:empty { display: none; }
.sprout-compose {
  flex: 0 0 auto;
  display: grid;
  gap: var(--edu-space-xs);
  border-top: 1px solid var(--edu-color-line);
  padding-top: var(--edu-space-sm);
}
.sprout-compose textarea { width: 100%; min-height: 4.5rem; }
.sprout-compose .edu-button { justify-self: end; }
@media ${STUDY_COMPACT_QUERY} {
  .ask-sprout-pill { right: var(--edu-space-md); bottom: var(--edu-space-md); }
  .sprout-sheet {
    right: 0;
    left: 0;
    bottom: 0;
    width: 100%;
    max-height: 82vh;
    border-radius: ${T.radii.xl} ${T.radii.xl} 0 0;
  }
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
