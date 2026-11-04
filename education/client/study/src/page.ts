/**
 * `/workspace` 学习台：一张摊开的学习台。
 *
 * 左页是这一节的课本（纸色、可折叠的「容易混淆 / 出处」、页脚页码），右页是
 * 题目；提交后反馈在原地展开，不另起一张卡。学习助手改成右下角的小芽浮起
 * 按钮，点开是右侧对话层。窄屏时对开收成单页，课本变成可展开的抽屉。
 *
 * 这里只搭骨架与交互（开合、焦点、Esc）；教学状态仍由 StudyController 负责。
 */

import type { EducationPage, EducationPageContext } from '../../shell/src/index.js';
import { DESIGN_TOKENS as T, focusableElements, h } from '../../shell/src/index.js';
import type { StudyController } from './controller.js';
import { bookIcon, closeIcon, sproutIcon } from './icons.js';
import { ensureStudyStyles } from './styles.js';

const SHEET_ID = 'edu-study-sprout-sheet';
const TEXT_PAGE_ID = 'edu-study-text-page';
/** 与 styles.ts 的断点保持一致：低于该宽度时课本是抽屉。 */
const COMPACT_MAX_WIDTH = T.breakpoints.compact - 1;

export function createStudyPage(controller: StudyController): EducationPage {
  return {
    id: 'study',
    path: '/workspace',
    title: '学习',
    requiresLearner: true,
    fallback: false,
    mount(context: EducationPageContext) {
      const doc = context.container.ownerDocument;
      ensureStudyStyles(doc);

      const root = h('div', { class: 'edu-study', 'data-testid': 'study-page' });

      /* ---------- 台面顶部与进度 ---------- */
      const top = h('div', { class: 'edu-study-top', 'data-testid': 'study-top' });
      const ribbon = h('div', { class: 'edu-study-ribbon', 'data-testid': 'study-ribbon' });

      /* ---------- 左页：课本 ---------- */
      const materialSummary = h(
        'span',
        { class: 'edu-study-material-mini__text', 'data-testid': 'study-material-summary' },
        '课本原文',
      );
      const materialToggle = h(
        'button',
        {
          type: 'button',
          class: 'edu-study-material-toggle',
          'data-testid': 'study-material-toggle',
          'data-action': 'toggle-material',
          'aria-expanded': 'false',
          'aria-controls': TEXT_PAGE_ID,
        },
        '看全文',
      );
      const materialMini = h(
        'div',
        { class: 'edu-study-material-mini', 'data-testid': 'study-material-mini' },
        bookIcon(doc),
        materialSummary,
        materialToggle,
      );
      const materialBody = h('div', {
        class: 'edu-study-text-page__body',
        'data-testid': 'study-material-body',
      });
      const materialClose = h(
        'button',
        {
          type: 'button',
          class: 'edu-study-material-close',
          'data-testid': 'study-material-close',
          'aria-label': '收起课本',
        },
        closeIcon(doc),
      );
      const textPage = h(
        'section',
        {
          class: 'edu-study-text-page',
          id: TEXT_PAGE_ID,
          'data-testid': 'study-text-page',
          'aria-label': '课本原文',
          tabindex: -1,
        },
        materialClose,
        materialBody,
      );

      /* ---------- 右页：题目 + 原地反馈 ---------- */
      const questionSlot = h('div', {
        'data-edu-slot': 'study:activity',
        'data-testid': 'study-question',
      });
      const visualsSlot = h('div', {
        'data-edu-slot': 'study:visuals',
        'data-testid': 'study-visuals-slot',
      });
      const feedbackSlot = h('div', {
        'data-edu-slot': 'study:feedback',
        'data-testid': 'study-feedback-slot',
        class: 'edu-study-feedback-slot',
      });
      const workPage = h(
        'section',
        { class: 'edu-study-work-page', 'data-testid': 'study-work-page', 'aria-label': '题目与反馈' },
        materialMini,
        questionSlot,
        visualsSlot,
        feedbackSlot,
      );

      const desk = h('div', { class: 'edu-study-desk', 'data-testid': 'study-desk' }, textPage, workPage);

      /* ---------- 小芽：浮起按钮 + 对话层 ---------- */
      const sheetTitleId = 'edu-study-sprout-title';
      const sheetClose = h(
        'button',
        {
          type: 'button',
          class: 'sprout-sheet__close',
          'data-testid': 'sprout-close',
          'aria-label': '收起小芽',
        },
        closeIcon(doc),
      );
      const sheetHead = h(
        'div',
        { class: 'sprout-sheet__head' },
        h(
          'h2',
          { class: 'sprout-sheet__title', id: sheetTitleId },
          '小芽',
          
        ),
        sheetClose,
      );
      const sheetBody = h('div', { class: 'sprout-sheet__body', 'data-testid': 'sprout-chat' });
      const sheet = h(
        'section',
        {
          class: 'sprout-sheet',
          id: SHEET_ID,
          'data-testid': 'sprout-sheet',
          role: 'dialog',
          'aria-labelledby': sheetTitleId,
          hidden: true,
        },
        sheetHead,
        sheetBody,
      );
      const pill = h(
        'button',
        {
          type: 'button',
          class: 'ask-sprout-pill',
          'data-testid': 'ask-sprout-pill',
          'data-action': 'open-sprout',
          'aria-label': '问小芽',
          'aria-expanded': 'false',
          'aria-controls': SHEET_ID,
        },
        h('span', { class: 'ask-sprout-pill__ava' }, sproutIcon(doc)),
        h('span', {}, '问小芽'),
      );

      const sheetOpen = (): boolean => !sheet.hasAttribute('hidden');
      const drawerOpen = (): boolean => desk.dataset['materialOpen'] === 'true';
      const isCompact = (): boolean =>
        (doc.defaultView?.innerWidth ?? COMPACT_MAX_WIDTH) <= COMPACT_MAX_WIDTH;

      const setSheet = (open: boolean): void => {
        if (open === sheetOpen()) return;
        if (open) {
          sheet.removeAttribute('hidden');
          pill.setAttribute('aria-expanded', 'true');
          const first = focusableElements(sheet)[0] ?? sheet;
          first.focus();
          return;
        }
        sheet.setAttribute('hidden', '');
        pill.setAttribute('aria-expanded', 'false');
        pill.focus();
      };

      const setDrawer = (open: boolean): void => {
        if (open === drawerOpen()) return;
        desk.dataset['materialOpen'] = open ? 'true' : 'false';
        materialToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
        if (open) {
          textPage.focus();
          return;
        }
        materialToggle.focus();
      };

      /** 「再看看材料」：窄屏打开抽屉，宽屏把课本滚到视野里并聚焦。 */
      const showMaterial = (): void => {
        if (isCompact()) {
          setDrawer(true);
          return;
        }
        textPage.scrollIntoView?.({ block: 'start' });
        textPage.focus();
      };

      pill.addEventListener('click', () => setSheet(!sheetOpen()));
      sheetClose.addEventListener('click', () => setSheet(false));
      materialToggle.addEventListener('click', () => setDrawer(!drawerOpen()));
      materialClose.addEventListener('click', () => setDrawer(false));

      // Esc 关闭最上面的一层；焦点回到触发按钮。小芽层内 Tab 循环。
      root.addEventListener('keydown', (event: KeyboardEvent) => {
        if (event.key === 'Escape') {
          if (sheetOpen()) {
            event.preventDefault();
            setSheet(false);
            return;
          }
          if (drawerOpen()) {
            event.preventDefault();
            setDrawer(false);
          }
          return;
        }
        if (event.key !== 'Tab' || !sheetOpen()) return;
        const focusables = focusableElements(sheet);
        if (focusables.length === 0) return;
        const first = focusables[0]!;
        const last = focusables[focusables.length - 1]!;
        const active = doc.activeElement;
        if (event.shiftKey && active === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && active === last) {
          event.preventDefault();
          first.focus();
        }
      });

      // 点空白处收起小芽 / 抽屉，但点在浮起按钮上时不抢它的开合。
      root.addEventListener('click', (event: Event) => {
        const target = event.target as Node | null;
        if (target === null) return;
        if (sheetOpen() && !sheet.contains(target) && !pill.contains(target)) setSheet(false);
        if (
          drawerOpen() &&
          isCompact() &&
          !textPage.contains(target) &&
          !materialMini.contains(target) &&
          !materialToggle.contains(target)
        ) {
          setDrawer(false);
        }
      });

      root.append(
        h(
          'header',
          { class: 'edu-page__header' },
          h('h1', { class: 'edu-page__title', tabindex: -1 }, '学习'),
        ),
        top,
        ribbon,
        desk,
        pill,
        sheet,
      );
      context.container.append(root);

      controller.setChatOpener(() => setSheet(true));
      controller.setMaterialOpener(showMaterial);
      controller.mountChrome({ top, ribbon, materialSummary });
      controller.mountMaterial(materialBody);
      controller.mountChat(sheetBody);
      void controller.onPageMount(context);
    },
    unmount() {
      controller.onPageUnmount();
    },
  };
}
