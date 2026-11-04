/** Honest fallback pages until T09/T10 register their real page. */

import type { EducationPage, EducationPageContext } from '../contracts.js';
import { h } from '../dom.js';
import { button } from '../components/button.js';
import { emptyState } from '../components/states.js';
import { statusChip } from '../components/status-chip.js';
import { courseEditionLabel } from '../labels.js';
import { definePage, pageHeading } from './common.js';

export function createLibraryFallbackPage(): EducationPage {
  return definePage({
    id: 'shell.library-fallback',
    path: '/library',
    title: '我的课本',
    requiresLearner: false,
    fallback: true,
    mount(container, context: EducationPageContext) {
      const api = context.services.shell;
      const snapshot = context.services.getState().snapshot;
      container.append(pageHeading('我的课本', '看看现在用的是哪本、内容从哪来。'));
      if (snapshot !== null) {
        container.append(
          h(
            'section',
            { class: 'edu-section' },
            h('h2', { class: 'edu-section__title' }, '当前教材'),
            h(
              'div',
              { class: 'edu-card' },
              h('p', { class: 'edu-card__title' }, courseEditionLabel(snapshot.courseEdition)),
              statusChip(snapshot.fixture ? '待核实' : '已核对', snapshot.fixture ? 'attention' : 'positive'),
              h('p', { class: 'edu-card__meta' }, '内容按课本整理；原文只保存在这台电脑上。'),
            ),
          ),
        );
      }
      container.append(
        emptyState({
          title: '还没有可显示的课本',
          body: '先在下面导入或换一本；不会生成空壳内容。',
          testId: 'library-fallback',
          actions: [
            { label: '重新检查', onClick: () => void api.refresh(), tone: 'primary' },
            { label: '返回今天', onClick: () => void api.navigate('/home') },
            { label: '查看进展', onClick: () => void api.navigate('/records') },
          ],
        }),
      );
      container.append(
        h('div', { class: 'edu-slot', 'data-edu-slot': 'library:content', 'data-testid': 'slot-library-content' }),
        h('div', { class: 'edu-slot', 'data-edu-slot': 'library:import', 'data-testid': 'slot-library-import' }),
      );
    },
  });
}

export function createMapFallbackPage(): EducationPage {
  return definePage({
    id: 'shell.map-fallback',
    path: '/map',
    title: '知识地图',
    requiresLearner: false,
    fallback: true,
    mount(container, context: EducationPageContext) {
      const api = context.services.shell;
      container.append(pageHeading('知识地图', '按课本目录找概念，点开看它和相关内容的关系。'));
      container.append(
        emptyState({
          title: '还没有可显示的概念',
          body: '这里只显示真实目录里的内容；没有匹配材料时不会编节点。可以先去我的课本选一本。',
          testId: 'map-fallback',
          actions: [
            { label: '去我的课本', onClick: () => void api.navigate('/library'), tone: 'primary' },
            { label: '返回今天', onClick: () => void api.navigate('/home') },
            { label: '查看进展', onClick: () => void api.navigate('/records') },
          ],
        }),
      );
      container.append(
        h('div', { class: 'edu-slot', 'data-edu-slot': 'map:content', 'data-testid': 'slot-map-content' }),
        h('div', { class: 'edu-slot', 'data-edu-slot': 'map:details', 'data-testid': 'slot-map-details' }),
      );
      void button;
    },
  });
}

export function createNotFoundPage(): EducationPage {
  return definePage({
    id: 'shell.not-found',
    path: '/not-found',
    title: '页面不存在',
    requiresLearner: false,
    fallback: true,
    mount(container, context: EducationPageContext) {
      container.append(
        pageHeading('找不到这个页面', '地址可能已经变化。用下面的入口回到学习空间。'),
        emptyState({
          title: '页面不存在',
          body: '没有改动任何本地记录。',
          actions: [
            { label: '返回今天', onClick: () => void context.services.shell.navigate('/home'), tone: 'primary' },
            { label: '去我的课本', onClick: () => void context.services.shell.navigate('/library') },
          ],
        }),
      );
    },
  });
}
