/** `/map` page: owns the map:content and map:details mount slots. */

import { h, type EducationPage, type EducationPageContext } from '../../shell/src/index.js';
import type { MapController } from './controller.js';
import { ensureMapStyles } from './styles.js';

export function createMapPage(controller: MapController): EducationPage {
  return {
    id: 'map',
    path: '/map',
    title: '地图',
    requiresLearner: false,
    fallback: false,
    mount(context: EducationPageContext) {
      ensureMapStyles(context.container.ownerDocument);
      controller.onPageMount(context);
      const root = h('div', { class: 'edu-map', 'data-testid': 'map-page' });
      root.append(
        h(
          'header',
          { class: 'edu-page__header' },
          h('h1', { class: 'edu-page__title', tabindex: -1 }, '地图'),
          h(
            'p',
            { class: 'edu-page__lead' },
            '按课本目录找概念；线表示内容之间的关系，点一下就能看详情。',
          ),
        ),
        h('div', {
          'data-edu-slot': 'map:content',
          'data-testid': 'map-content-slot',
          class: 'edu-map-slot',
        }),
        h('div', {
          'data-edu-slot': 'map:details',
          'data-testid': 'map-details-slot',
          class: 'edu-map-slot',
        }),
      );
      context.container.append(root);
    },
    unmount() {
      controller.onPageUnmount();
    },
  };
}
