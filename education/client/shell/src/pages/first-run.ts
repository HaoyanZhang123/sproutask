/** First use: local anonymous profile, textbook, self-reported range, optional short diagnostic. */

import type { EducationPage, EducationPageContext } from '../contracts.js';
import { h } from '../dom.js';
import { button } from '../components/button.js';
import { notice, offlineNotice } from '../components/states.js';
import { statusChip } from '../components/status-chip.js';
import { renderErrorBanner } from '../errors.js';
import {
  courseEditionLabel,
  formatDateTime,
} from '../labels.js';
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
          title: '关于保存与云端服务',
          body: '学习记录保存在这台电脑。智能反馈需要已配置的模型服务；使用云端反馈时，相关作答和所选材料可能发送到该服务。不能把全部数据说成从不离机。',
        }),
      );

      container.append(
        h(
          'section',
          { class: 'edu-section' },
          h('h2', { class: 'edu-section__title' }, '你的本地学习身份'),
          h(
            'div',
            { class: 'edu-card' },
            h('p', { class: 'edu-card__title' }, `本地匿名档案：${snapshot.learner.id}`),
            h(
              'p',
              { class: 'edu-card__meta' },
              `创建于 ${formatDateTime(snapshot.learner.createdAt)}。这不是平台模型账号；模型服务连接状态单独显示，切换模型账号不会删除学情。`,
            ),
          ),
        ),
      );

      const textbook = h(
        'section',
        { class: 'edu-section' },
        h('h2', { class: 'edu-section__title' }, '当前教材'),
        h(
          'div',
          { class: 'edu-card' },
          h('p', { class: 'edu-card__title' }, courseLabel),
          h(
            'p',
            { class: 'edu-card__meta' },
            `内容包版本 ${snapshot.pack.version} · ${snapshot.pack.scope === 'partial' ? '部分内容' : '全册范围'} · 审校状态：${snapshot.fixture ? '合成 fixture（非真实版本）' : snapshot.pack.status}`,
          ),
          h(
            'div',
            { class: 'edu-inline-actions' },
            button('去教材库选择匹配教材', () => void api.navigate('/library'), { small: true }),
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
          h('label', { class: 'edu-choice' }, input, h('span', {}, `${concept.title}（${concept.id}）`)),
        );
      }

      const hint = h('p', { class: 'edu-section__lead', 'data-testid': 'first-run-range-hint' });
      const updateHint = (value: ScopeChoice = scope): void => {
        hint.textContent =
          value === 'selected'
            ? `已选择 ${selected.size} 个概念。这是学生自述，不会自动标记为已理解。`
            : value === 'all_unlearned'
              ? '全未学：学习建议会从尚无证据的概念开始；不会自动生成理解判断。'
              : '暂不确定：可以先看地图，之后随时修改范围。';
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
        h('h2', { class: 'edu-section__title' }, '我学过的范围（自述）'),
        h(
          'p',
          { class: 'edu-section__lead' },
          '可以选择部分概念、全未学或暂不确定。这个选择用于推荐起点，不是理解证据，也不会一键把内容标为已掌握。',
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
                      title: '还不能保存',
                      body: '请至少选择一个概念；也可以选择“全未学”或“暂不确定”。',
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
                  savedMessage = `已保存为自述范围（${result.data.range.conceptIds.length} 个概念）。它不会自动标记为已理解；之后可以修改。`;
                  status.replaceChildren(
                    notice({
                      tone: 'info',
                      title: '自述范围已保存',
                      body: `${savedMessage}${result.data.diagnosticSuggested ? ' 建议先看地图，或做一次短诊断获得初步证据。' : ''}`,
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
        text: state.diagnosticSkipped
          ? '已跳过诊断；不会生成理解判断，也不会把跳过记为完成。'
          : '',
      });
      const diagnostic = h(
        'section',
        { class: 'edu-section', 'data-testid': 'first-run-diagnostic' },
        h('h2', { class: 'edu-section__title' }, '短诊断（可选）'),
        h(
          'p',
          { class: 'edu-section__lead' },
          `当前内容包有 ${activityCount} 个可用活动。短诊断只覆盖你选择的范围，题数来自实际可用活动，开始前可见；可随时结束，未测部分保持“尚无足够证据”。`,
        ),
        h(
          'p',
          { class: 'edu-muted' },
          '诊断不是使用门槛：跳过、失败或中止都不会锁住学习，也不会伪造已掌握。',
        ),
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
              diagnosticStatus.textContent = '已跳过诊断；不会生成理解判断，也不会把跳过记为完成。';
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
        h('h2', { class: 'edu-section__title' }, '模型服务'),
        snapshot.auth.apiKey.status === 'available' || state.keyStatus === 'configured'
          ? h(
              'div',
              { class: 'edu-card' },
              statusChip('API Key 已配置', 'positive'),
              h('p', { class: 'edu-card__meta' }, '云推理可用。学生身份与模型账号分别管理。'),
            )
          : h(
              'div',
              { class: 'edu-card' },
              statusChip('API Key 未配置', 'attention'),
              h('p', { class: 'edu-card__meta' }, '可读本地内容、保存自述范围与草稿；云推理不可用。'),
              h(
                'div',
                { class: 'edu-inline-actions' },
                button('查看账户与模型服务', () => void api.navigate('/account'), { small: true }),
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
