/** Workspace shell: restores the exact session cursor and exposes study/visuals mount points. */

import type { EducationPage, EducationPageContext } from '../contracts.js';
import { h } from '../dom.js';
import { button } from '../components/button.js';
import { renderContextBar } from '../components/context-bar.js';
import { emptyState, notice, offlineNotice } from '../components/states.js';
import { statusChip } from '../components/status-chip.js';
import {
  SESSION_MODE_LABELS,
  SESSION_STATUS_LABELS,
  TRUST_MODE_LABELS,
  courseEditionLabel,
  formatDateTime,
  positionLabel,
} from '../labels.js';
import { conceptTitle, definePage, pageHeading } from './common.js';

function queryOf(path: string): URLSearchParams {
  const index = path.indexOf('?');
  return new URLSearchParams(index >= 0 ? path.slice(index + 1) : '');
}

export function createWorkspacePage(): EducationPage {
  return definePage({
    id: 'shell.workspace',
    path: '/workspace',
    title: '工作区',
    requiresLearner: true,
    fallback: true,
    mount(container, context: EducationPageContext) {
      const api = context.services.shell;
      const state = context.services.getState();
      const snapshot = state.snapshot;

      container.append(
        pageHeading('工作区', '材料与当前活动在主要区域；解释与反馈作为辅助区，可收起。'),
      );
      if (snapshot === null) {
        container.append(
          emptyState({
            title: '还没有打开学习活动',
            body: '先选择教材和概念，再进入工作区。',
            actions: [{ label: '去地图', onClick: () => void api.navigate('/map'), tone: 'primary' }],
          }),
        );
        return;
      }

      const resume = state.resume;
      const query = queryOf(state.currentPath);
      const queryMode = query.get('mode');
      const queryConcept = query.get('concept');
      const explicitMode =
        queryMode === 'learn' || queryMode === 'review' || queryMode === 'diagnostic'
          ? queryMode
          : null;
      const currentMode = resume?.session.mode ?? state.home?.activeSession?.mode ?? null;
      const startsNewActivity =
        query.get('new') === '1' || (explicitMode !== null && explicitMode !== currentMode);
      const active = startsNewActivity
        ? null
        : (resume?.session ?? state.home?.activeSession ?? null);
      const mode = explicitMode ?? active?.mode ?? null;
      const conceptId = (startsNewActivity ? queryConcept : null) ?? active?.conceptId ?? queryConcept;
      const concept = conceptId === null ? null : conceptTitle(snapshot.concepts, conceptId);

      container.append(
        renderContextBar({
          courseEdition: courseEditionLabel(snapshot.courseEdition),
          packVersion: active?.packVersion ?? snapshot.pack.version,
          concept,
          mode: mode === null ? null : SESSION_MODE_LABELS[mode],
          saveState: state.saveState,
          fixture: snapshot.fixture,
          backTarget: state.backTarget?.label ?? null,
          onBack: state.backTarget === null ? undefined : () => void api.back(),
        }),
      );

      if (state.offline) container.append(offlineNotice(() => void api.refresh()));

      if (active !== null && resume !== null) {        container.append(
          h(
            'section',
            { class: 'edu-section', 'data-testid': 'workspace-resume' },
            h('h2', { class: 'edu-section__title' }, '已恢复上次活动'),
            h(
              'div',
              { class: 'edu-card' },
              h(
                'dl',
                { class: 'edu-kv' },
                h('dt', {}, '教材'),
                h('dd', {}, courseEditionLabel(snapshot.courseEdition)),
                h('dt', {}, '概念'),
                h('dd', {}, resume.conceptTitle),
                h('dt', {}, '模式'),
                h('dd', {}, SESSION_MODE_LABELS[active.mode]),
                h('dt', {}, '活动'),
                h('dd', {}, resume.activityId ?? '未记录'),
                h('dt', {}, '上次位置'),
                h('dd', {}, resume.cursor ?? '未记录'),
                h('dt', {}, '位置说明'),
                h('dd', {}, resume.positionLabel),
                h('dt', {}, '内容包'),
                h('dd', {}, `${resume.packVersion} · ${TRUST_MODE_LABELS[active.trustMode]}`),
                h('dt', {}, '草稿'),
                h('dd', {}, resume.draftRestored ? '已恢复本机草稿' : '没有待恢复草稿'),
                h('dt', {}, '会话状态'),
                h('dd', {}, SESSION_STATUS_LABELS[active.status]),
                h('dt', {}, '开始时间'),
                h('dd', {}, h('time', { datetime: active.startedAt }, formatDateTime(active.startedAt))),
              ),
              h(
                'p',
                { class: 'edu-card__meta' },
                '继续的是同一个活动，不会新建一份对话；已保存的草稿与作答保持原位。',
              ),
            ),
          ),
        );
      } else if (mode !== null) {
        container.append(
          notice({
            tone: 'info',
            title:
              concept === null
                ? `准备开始：${SESSION_MODE_LABELS[mode]}`
                : `准备开始：${concept} · ${SESSION_MODE_LABELS[mode]}`,
            body:
              concept === null
                ? '请选择要复习的范围；待复习概念可从地图或记录中打开。活动面板会在这里挂载。'
                : '活动面板会在这里打开。现在返回地图、记录或首页都不会丢失当前教材与概念选择。',
            actions:
              mode === 'diagnostic'
                ? [
                    {
                      label: '中止诊断并返回首页',
                      onClick: () => {
                        api.setDiagnosticSkipped(true);
                        void api.navigate('/home');
                      },
                    },
                  ]
                : concept === null
                  ? [{ label: '去地图选择范围', onClick: () => void api.navigate('/map') }]
                  : undefined,
          }),
        );
      } else {
        container.append(
          emptyState({
            title: '工作区还没有打开的学习活动',
            body: '从地图选择概念进入学习，或在首页继续上次；复习也可以从首页或地图开始。',
            testId: 'workspace-empty',
            actions: [
              { label: '去地图选择概念', onClick: () => void api.navigate('/map'), tone: 'primary' },
              { label: '返回首页', onClick: () => void api.navigate('/home') },
            ],
          }),
        );
      }

      container.append(
        h(
          'section',
          { class: 'edu-section', 'data-testid': 'workspace-slots' },
          h('h2', { class: 'edu-section__title' }, '学习与图示区域'),
          h(
            'p',
            { class: 'edu-section__lead' },
            '当前活动、反馈与图示分别在这里挂载；离开工作区时，已挂载的面板会卸载，状态仍保留在本机记录中。',
          ),
          h('div', { class: 'edu-slot', 'data-edu-slot': 'study:activity', 'data-testid': 'slot-study-activity' }),
          h('div', { class: 'edu-slot', 'data-edu-slot': 'study:feedback', 'data-testid': 'slot-study-feedback' }),
          h('div', { class: 'edu-slot', 'data-edu-slot': 'study:visuals', 'data-testid': 'slot-study-visuals' }),
        ),
      );

      container.append(
        h(
          'div',
          { class: 'edu-inline-actions' },
          button('查看记录', () => void api.navigate('/records')),
          button('返回地图', () => void api.navigate('/map')),
          button('返回首页', () => void api.navigate('/home')),
        ),
      );
    },
  });
}
