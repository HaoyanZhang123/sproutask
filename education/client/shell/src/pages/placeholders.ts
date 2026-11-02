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
    title: '教材库',
    requiresLearner: false,
    fallback: true,
    mount(container, context: EducationPageContext) {
      const api = context.services.shell;
      const snapshot = context.services.getState().snapshot;
      container.append(pageHeading('教材库', '确认你用的是哪本教材、哪一版，再看材料从哪里来。'));
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
              statusChip(snapshot.fixture ? '合成 fixture（非真实版本）' : snapshot.pack.status, 'attention'),
              h(
                'p',
                { class: 'edu-card__meta' },
                `内容包 ${snapshot.pack.version} · ${snapshot.pack.scope === 'partial' ? '部分内容（尚未达到全册）' : '全册范围'}`,
              ),
              h(
                'p',
                { class: 'edu-card__meta' },
                '这里只显示教材摘要；导入、材料可用性与审校详情会在教材库内容就绪后提供。',
              ),
            ),
          ),
        );
      }
      container.append(
        emptyState({
          title: '教材库内容还没有可显示的条目',
          body: '当前不会生成空壳全册地图或虚构教材。可以返回首页，或查看已有本地记录。',
          testId: 'library-fallback',
          actions: [
            { label: '重新检查本地材料', onClick: () => void api.refresh(), tone: 'primary' },
            { label: '返回首页', onClick: () => void api.navigate('/home') },
            { label: '查看记录', onClick: () => void api.navigate('/records') },
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
    title: '地图',
    requiresLearner: false,
    fallback: true,
    mount(container, context: EducationPageContext) {
      const api = context.services.shell;
      container.append(pageHeading('地图', '按课本目录找概念，点开看它和相关内容的关系。'));
      container.append(
        emptyState({
          title: '还没有可显示的概念地图',
          body: '地图只展示当前教材真实目录中的内容；没有匹配材料时不会合成节点。可以先去教材库选择材料。',
          testId: 'map-fallback',
          actions: [
            { label: '去教材库', onClick: () => void api.navigate('/library'), tone: 'primary' },
            { label: '返回首页', onClick: () => void api.navigate('/home') },
            { label: '查看记录', onClick: () => void api.navigate('/records') },
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
            { label: '返回首页', onClick: () => void context.services.shell.navigate('/home'), tone: 'primary' },
            { label: '去教材库', onClick: () => void context.services.shell.navigate('/library') },
          ],
        }),
      );
    },
  });
}
