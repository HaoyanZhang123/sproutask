/** First use: local anonymous profile, textbook, self-reported range, optional short diagnostic. */

import type { EducationPage, EducationPageContext } from '../contracts.js';
import { h } from '../dom.js';
import { button } from '../components/button.js';
import { notice, offlineNotice } from '../components/states.js';
import { statusChip } from '../components/status-chip.js';
import { renderErrorBanner } from '../errors.js';
import { courseEditionLabel } from '../labels.js';
import { definePage, pageHeading } from './common.js';

type ScopeChoice = 'selected' | 'all_unlearned' | 'uncertain';

export function createFirstRunPage(): EducationPage {
  return definePage({
    id: 'shell.first-run',
    path: '/first-run',
    title: '首次使用',
    requiresLearner: true,
    fallback: true,
    mount(container, context: EducationPageContext) {
      const api = context.services.shell;
      const state = context.services.getState();
      const snapshot = state.snapshot;
      container.append(
        pageHeading(
          '首次使用',
          '先了解记录保存在哪里、智能反馈需要什么，再选择教材与你学过的范围。',
        ),
      );
      if (snapshot === null) {
        container.append(
          notice({
            tone: 'warning',
            title: '还没有可用教材',
            body: '请先在教材库选择或导入与你课本匹配的材料。',
            actions: [{ label: '去教材库', onClick: () => void api.navigate('/library'), tone: 'primary' }],
          }),
        );
        return;
      }

      const courseLabel = courseEditionLabel(snapshot.courseEdition);

      if (state.offline) container.append(offlineNotice(() => void api.refresh()));

      container.append(
        notice({
          tone: 'info',
          title: '记录在这台电脑，讲解来自云端',
          body: '学习记录保存在这台电脑。需要智能反馈时，当前题目、作答和必要的材料片段会发给模型服务；不会上传整本教材。',
        }),
      );

      const textbook = h(
        'section',
        { class: 'edu-section' },
        h('h2', { class: 'edu-section__title' }, '当前教材'),
        h(
          'div',
          { class: 'edu-card' },
          h('p', { class: 'edu-card__title' }, courseLabel),
          h('p', { class: 'edu-card__meta' }, '内容按课本整理；原文只保存在这台电脑上。'),
          h(
            'div',
            { class: 'edu-inline-actions' },
            button('换一本教材', () => void api.navigate('/library'), { small: true }),
          ),
        ),
      );
      container.append(textbook);

      let scope: ScopeChoice = 'selected';
      let savedMessage = '';
      const selected = new Set<string>();
      const status = h('div', {
        role: 'status',
        'aria-live': 'polite',
        'data-testid': 'first-run-save-status',
      });

      const conceptCheckboxes = h('div', { class: 'edu-choice-list' });
      for (const concept of snapshot.concepts) {
        const input = h('input', { type: 'checkbox', value: concept.id });
        input.addEventListener('change', () => {
          scope = 'selected';
          const radio = rangeForm.querySelector<HTMLInputElement>('input[value="selected"]');
          if (radio !== null) radio.checked = true;
          if (input.checked) selected.add(concept.id);
          else selected.delete(concept.id);
          updateHint();
        });
        conceptCheckboxes.append(
          h('label', { class: 'edu-choice' }, input, h('span', {}, concept.title)),
        );
      }

      const hint = h('p', { class: 'edu-section__lead', 'data-testid': 'first-run-range-hint' });
      const updateHint = (value: ScopeChoice = scope): void => {
        hint.textContent =
          value === 'selected'
            ? `已选了 ${selected.size} 个概念。之后随时能改。`
            : value === 'all_unlearned'
              ? '从还没学过的概念开始推荐；以后可以改。'
              : '先看地图，之后随时能改。';
      };
      updateHint();

      const currentScope = (): ScopeChoice => scope;
      const rangeForm = h(
        'form',
        {
          class: 'edu-section',
          'data-testid': 'first-run-range-form',
          onsubmit: (event: Event) => event.preventDefault(),
        },
        h('h2', { class: 'edu-section__title' }, '你之前学过哪些？（可选）'),
        h(
          'p',
          { class: 'edu-section__lead' },
          '选你学过的概念，或者“全未学 / 暂不确定”。选它只是用来推荐从哪开始，不会当作已经学会。',
        ),
        h(
          'div',
          { class: 'edu-choice-list' },
          radio('range', 'selected', '选择部分概念', currentScope() === 'selected', () => {
            scope = 'selected';
            updateHint();
          }),
          radio('range', 'all_unlearned', '全未学', currentScope() === 'all_unlearned', () => {
            scope = 'all_unlearned';
            updateHint();
          }),
          radio('range', 'uncertain', '暂不确定', currentScope() === 'uncertain', () => {
            scope = 'uncertain';
            updateHint();
          }),
        ),
        conceptCheckboxes,
        hint,
        h(
          'div',
          { class: 'edu-inline-actions' },
          button(
            '保存自述范围',
            () => {
              void (async () => {
                const conceptIds = scope === 'selected' ? [...selected] : [];
                if (scope === 'selected' && conceptIds.length === 0) {
                  status.replaceChildren(
                    notice({
                      tone: 'warning',
                      title: '还没选概念',
                      body: '请至少选一个；也可以选“全未学”或“暂不确定”。',
                    }),
                  );
                  return;
                }
                const result = await api.saveRange({
                  scope,
                  conceptIds,
                  diagnosticSkipped: state.diagnosticSkipped,
                });
                if (result.ok) {
                  savedMessage = `已记下 ${result.data.range.conceptIds.length} 个概念。之后可以改，不会当作已经学会。`;
                  status.replaceChildren(
                    notice({
                      tone: 'info',
                      title: '记下了',
                      body: `${savedMessage}${result.data.diagnosticSuggested ? ' 要不要顺手做一次短诊断？' : ''}`,
                    }),
                  );
                } else {
                  status.replaceChildren(
                    renderErrorBanner(result.error, {
                      onRetry: () => {
                        // Re-run the same submission; the checkbox state is still in this page.
                        const saveButton = rangeForm.querySelector<HTMLButtonElement>(
                          '[data-action="save-range"]',
                        );
                        saveButton?.click();
                      },
                      backLabel: '先看地图',
                      onBack: () => void api.navigate('/map'),
                    }),
                  );
                }
              })();
            },
            { tone: 'primary', dataAction: 'save-range' },
          ),
          button('先看地图', () => void api.navigate('/map')),
        ),
        status,
      );
      container.append(rangeForm);

      const activityCount = new Set(
        snapshot.concepts.flatMap((concept) => concept.activityIds),
      ).size;
      const diagnosticStatus = h('p', {
        class: 'edu-section__lead',
        role: 'status',
        'aria-live': 'polite',
        'data-testid': 'first-run-diagnostic-status',
        text: state.diagnosticSkipped ? '已跳过；不影响后面的学习。' : '',
      });
      const diagnostic = h(
        'section',
        { class: 'edu-section', 'data-testid': 'first-run-diagnostic' },
        h('h2', { class: 'edu-section__title' }, '要不要做一次短诊断？（可选）'),
        h(
          'p',
          { class: 'edu-section__lead' },
          `有 ${activityCount} 道题可用。短诊断只看你选的范围，随时可以停；没测到的不会当成学会。`,
        ),
        h('p', { class: 'edu-muted' }, '跳过也没关系，不影响后面学习。'),
        h(
          'div',
          { class: 'edu-inline-actions' },
          button(
            '开始短诊断',
            () => {
              const first = snapshot.concepts[0];
              if (first === undefined) return;
              void api.navigate(`/workspace?mode=diagnostic&concept=${first.id}&new=1`);
            },
            { tone: 'primary' },
          ),
          button(
            '跳过诊断',
            () => {
              api.setDiagnosticSkipped(true);
              diagnosticStatus.textContent = '已跳过；不影响后面的学习。';
            },
          ),
          button('先看地图', () => void api.navigate('/map')),
        ),
        diagnosticStatus,
      );
      container.append(diagnostic);

      const modelStatus = h(
        'section',
        { class: 'edu-section' },
        h('h2', { class: 'edu-section__title' }, '智能反馈'),
        snapshot.auth.apiKey.status === 'available' || state.keyStatus === 'configured'
          ? h(
              'div',
              { class: 'edu-card' },
              statusChip('已连接', 'positive'),
              h('p', { class: 'edu-card__meta' }, '可以用小芽讲解、批改和追问。'),
            )
          : h(
              'div',
              { class: 'edu-card' },
              statusChip('还没有连接', 'attention'),
              h('p', { class: 'edu-card__meta' }, '现在可以读教材、选范围；连上之后才有讲解和批改。'),
              h(
                'div',
                { class: 'edu-inline-actions' },
                button('去设置', () => void api.navigate('/account'), { small: true }),
              ),
            ),
      );
      container.append(modelStatus);
    },
  });
}

function radio(
  name: string,
  value: string,
  label: string,
  checked: boolean,
  onChange: () => void,
): HTMLElement {
  const id = `first-run-${name}-${value}`;
  const input = h('input', {
    type: 'radio',
    name,
    value,
    id,
    checked,
    onchange: onChange,
  });
  return h('label', { class: 'edu-choice', for: id }, input, h('span', {}, label));
}
