/** `/workspace` study/review page: material, activity, chat and feedback regions. */

import type { EducationPage, EducationPageContext } from '../../shell/src/index.js';
import { h } from '../../shell/src/index.js';
import type { StudyController } from './controller.js';
import { ensureStudyStyles } from './styles.js';

export function createStudyPage(controller: StudyController): EducationPage {
  return {
    id: 'study',
    path: '/workspace',
    title: '工作区',
    requiresLearner: true,
    fallback: false,
    mount(context: EducationPageContext) {
      ensureStudyStyles(context.container.ownerDocument);
      const grid = h('div', { class: 'edu-study-grid' });
      const material = h('section', {
        class: 'edu-study-panel edu-study-material-panel',
        'data-testid': 'study-material-panel',
        'aria-label': '学习材料',
      });
      const activity = h(
        'section',
        { class: 'edu-study-panel edu-study-main-panel', 'data-testid': 'study-main-panel', 'aria-label': '当前活动' },
        h('div', { 'data-edu-slot': 'study:activity', 'data-testid': 'study-activity-slot' }),
        h('div', { 'data-edu-slot': 'study:visuals', 'data-testid': 'study-visuals-slot' }),
      );
      const chat = h('section', {
        class: 'edu-study-panel edu-study-chat-panel',
        'data-testid': 'study-chat-panel',
        'aria-label': '学习助手',
      });
      const feedback = h(
        'section',
        { class: 'edu-study-panel edu-study-feedback-panel', 'data-testid': 'study-feedback-panel', 'aria-label': '反馈' },
        h('div', { 'data-edu-slot': 'study:feedback', 'data-testid': 'study-feedback-slot' }),
      );
      const side = h('aside', { class: 'edu-study-side' }, chat, feedback);
      grid.append(material, activity, side);
      const root = h(
        'div',
        { class: 'edu-study', 'data-testid': 'study-page' },
        h(
          'header',
          { class: 'edu-page__header' },
          h('h1', { class: 'edu-page__title', tabindex: -1 }, '工作区'),
          h(
            'p',
            { class: 'edu-page__lead' },
            '先读左边的材料，再自己作答；卡住了可以看右边的提示。',
          ),
        ),
        grid,
      );
      context.container.append(root);
      controller.mountMaterial(material);
      controller.mountChat(chat);
      void controller.onPageMount(context);
    },
    unmount() {
      controller.onPageUnmount();
    },
  };
}
