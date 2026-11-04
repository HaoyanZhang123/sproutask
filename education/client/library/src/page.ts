/** `/library` page: one heading, then the two T09 mount slots. */

import { h, pageHeading, type EducationPage, type EducationPageContext } from '../../shell/src/index.js';
import { ensureLibraryStyles } from './styles.js';
import type { LibraryController } from './controller.js';

export function createLibraryPage(controller: LibraryController): EducationPage {
  return {
    id: 'library',
    path: '/library',
    title: '我的课本',
    requiresLearner: false,
    fallback: false,
    mount(context: EducationPageContext) {
      ensureLibraryStyles(context.container.ownerDocument);
      controller.onPageMount();
      const root = h('div', { class: 'edu-lib', 'data-testid': 'library-page' });
      root.append(
        pageHeading('我的课本', '现在用的是哪本，内容从哪来。'),
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
