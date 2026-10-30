/** `/library` page: owns the two T09 mount slots and the page heading. */

import { h, type EducationPage, type EducationPageContext } from '../../shell/src/index.js';
import { ensureLibraryStyles } from './styles.js';
import type { LibraryController } from './controller.js';

export function createLibraryPage(controller: LibraryController): EducationPage {
  return {
    id: 'library',
    path: '/library',
    title: '教材库',
    requiresLearner: false,
    fallback: false,
    mount(context: EducationPageContext) {
      ensureLibraryStyles(context.container.ownerDocument);
      controller.onPageMount();
      const root = h('div', { class: 'edu-lib', 'data-testid': 'library-page' });
      root.append(
        h(
          'header',
          { class: 'edu-page__header' },
          h('h1', { class: 'edu-page__title', tabindex: -1 }, '教材库'),
          h(
            'p',
            { class: 'edu-page__lead' },
            '区分本期匹配基准、待核实候选与不可用材料；查看导入进度与来源，候选标识始终可见。',
          ),
        ),
        h('div', { 'data-edu-slot': 'library:content', 'data-testid': 'library-content-slot' }),
        h('div', { 'data-edu-slot': 'library:import', 'data-testid': 'library-import-slot' }),
      );
      context.container.append(root);
    },
    unmount() {
      controller.onPageUnmount();
    },
  };
}
