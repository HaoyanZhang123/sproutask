/** 设置：模型 Key、字号、关于。凭据只在本机宿主，页面只显示是否已配置。 */

import type { EducationPage, EducationPageContext } from '../contracts.js';
import { h } from '../dom.js';
import { button } from '../components/button.js';
import { ConfirmDialog } from '../components/confirm-dialog.js';
import { notice } from '../components/states.js';
import { statusChip } from '../components/status-chip.js';
import {
  maskedKeySuffix,
  validateApiKey,
  type AuthKeyCategory,
  type AuthKeyFailure,
} from '../key-port.js';
import { definePage, pageHeading } from './common.js';

export function createAccountPage(): EducationPage {
  return definePage({
    id: 'shell.account',
    path: '/account',
    title: '设置',
    requiresLearner: true,
    fallback: true,
    mount(container, context: EducationPageContext) {
      const api = context.services.shell;
      const state = context.services.getState();
      const snapshot = state.snapshot;
      container.append(
        pageHeading('设置', '这里可以改模型 Key 和字号；学习记录只保存在这台电脑上。'),
      );
      if (snapshot === null) {
        container.append(
          notice({
            tone: 'warning',
            title: '状态还没有读到',
            body: '可以重试；本地内容与记录不受影响。',
            actions: [{ label: '重试', onClick: () => void api.refresh() }],
          }),
        );
        return;
      }

      const apiKey = snapshot.auth.apiKey;
      let keyConfigured = apiKey.status === 'available' || state.keyStatus === 'configured';
      let keySuffix = state.keySuffix;
      const keySection = h(
        'section',
        { class: 'edu-section', 'data-testid': 'account-api-key' },
        h('h2', { class: 'edu-section__title' }, '模型 Key'),
      );
      const keyCard = h('div', { class: 'edu-card' });
      const keyStatusLine = h('div', {
        class: 'edu-inline-actions',
        'data-testid': 'account-key-status',
        role: 'status',
        'aria-live': 'polite',
      });
      const keyStatusText = h('p', {
        class: 'edu-card__meta',
        'data-testid': 'account-key-masked',
      });
      const keyFeedback = h('div', { 'data-testid': 'account-key-feedback' });
      const keyInput = h('input', {
        type: 'password',
        id: 'account-key-input',
        class: 'edu-input',
        'aria-label': '模型 Key',
        placeholder: 'sk-…',
        autocomplete: 'off',
        autocapitalize: 'off',
        spellcheck: false,
        'data-testid': 'account-key-input',
      });
      keyInput.addEventListener('keydown', (event: KeyboardEvent) => {
        if (event.key === 'Enter') {
          event.preventDefault();
          saveButton.click();
        }
      });
      const saveButton = button('保存 Key', () => void saveKey(), {
        tone: 'primary',
        small: true,
        dataAction: 'save-key',
      });
      const clearButton = button('清除 Key', () => openClearDialog(), {
        small: true,
        dataAction: 'clear-key',
      });
      const clearDialog = new ConfirmDialog({
        title: '清除模型 Key？',
        impact: [
          '清除后回到本地模式：教材、地图、记录和草稿仍然能看。',
          '智能反馈会不可用，直到重新配置。',
          '不会删除任何学习记录、理解记录或自评。',
        ],
        confirmLabel: '清除并回到本地模式',
        tone: 'danger',
        onConfirm: () => void clearKey(),
      });

      const updateKeyState = (): void => {
        keyStatusLine.replaceChildren(
          statusChip(keyConfigured ? '已配置' : '还没有配置', keyConfigured ? 'positive' : 'attention'),
        );
        keyStatusText.textContent = keyConfigured
          ? `已配置（****${keySuffix ?? ''}）。只在本机加密保存，不会显示完整 Key。`
          : '还没有配置模型 Key。现在可以先读教材、看记录；配好之后才能用智能反馈。';
        clearButton.disabled = !keyConfigured;
        saveButton.textContent = keyConfigured ? '更换 Key' : '保存 Key';
      };

      const showKeyFailure = (error: AuthKeyFailure): void => {
        keyFeedback.replaceChildren(
          notice({
            tone: error.retryable ? 'warning' : 'info',
            title: keyErrorTitle(error.category),
            body: `${keyErrorBody(error.category)}${error.retryable ? ' 可以重试；Key 没有保存。' : ''}`,
            testId: 'account-key-error',
          }),
        );
      };

      const saveKey = async (): Promise<void> => {
        keyFeedback.replaceChildren();
        const raw = keyInput.value.trim();
        keyInput.value = '';
        const invalid = validateApiKey(raw);
        if (invalid !== null) {
          showKeyFailure(invalid);
          return;
        }
        saveButton.disabled = true;
        keyFeedback.replaceChildren(h('p', { class: 'edu-muted', role: 'status' }, '正在交给本机保存…'));
        try {
          const result = await api.saveKey(raw);
          if (!result.ok) {
            showKeyFailure(result.error);
            return;
          }
          keyConfigured = true;
          keySuffix = result.data.maskedSuffix ?? maskedKeySuffix(raw);
          updateKeyState();
          keyFeedback.replaceChildren(
            notice({
              tone: 'info',
              title: '已保存到本机',
              body: 'Key 不会出现在页面、日志或链接里。',
              testId: 'account-key-saved',
            }),
          );
        } finally {
          saveButton.disabled = false;
        }
      };

      const clearKey = async (): Promise<void> => {
        keyFeedback.replaceChildren();
        clearButton.disabled = true;
        const result = await api.clearKey();
        if (!result.ok) {
          showKeyFailure(result.error);
          clearButton.disabled = !keyConfigured;
          return;
        }
        keyConfigured = false;
        keySuffix = null;
        updateKeyState();
        keyFeedback.replaceChildren(
          notice({
            tone: 'info',
            title: '已回到本地模式',
            body: '教材、地图与记录仍可读；没有 Key 时不会发请求。',
            testId: 'account-key-cleared',
          }),
        );
      };

      const openClearDialog = (): void => {
        if (keyConfigured) clearDialog.open(clearButton, keySection);
      };

      updateKeyState();
      keyCard.append(
        keyStatusLine,
        keyStatusText,
        h(
          'div',
          { class: 'edu-key-form', 'data-testid': 'account-key-form' },
          h('label', { class: 'edu-field-label', for: 'account-key-input' }, '模型 Key'),
          keyInput,
          h('div', { class: 'edu-inline-actions' }, saveButton, clearButton),
          h('p', { class: 'edu-muted' }, '只接受以 sk- 开头的合理长度 Key；格式或网络有问题会提示，不会保存。'),
        ),
        keyFeedback,
      );
      keySection.append(keyCard);
      container.append(keySection);
      void api.loadKeyStatus().then((result) => {
        if (!result.ok) return;
        keyConfigured = result.data.configured;
        keySuffix = result.data.maskedSuffix;
        updateKeyState();
      });

      const standardButton = button(
        '标准字号',
        () => {
          api.setFontScale('standard');
          updatePressed();
        },
        { small: true, dataAction: 'font-standard' },
      );
      const largeButton = button(
        '大字',
        () => {
          api.setFontScale('large');
          updatePressed();
        },
        { small: true, dataAction: 'font-large' },
      );
      const updatePressed = (): void => {
        const current = api.getState().fontScale;
        standardButton.setAttribute('aria-pressed', String(current === 'standard'));
        largeButton.setAttribute('aria-pressed', String(current === 'large'));
      };
      updatePressed();
      container.append(
        h(
          'section',
          { class: 'edu-section', 'data-testid': 'account-display' },
          h('h2', { class: 'edu-section__title' }, '字号'),
          h('p', { class: 'edu-section__lead' }, '觉得字小可以换成大字，材料和题目会一起变大。'),
          h('div', { class: 'edu-inline-actions' }, standardButton, largeButton),
        ),
      );

      const capabilities = snapshot.capabilities;
      container.append(
        h(
          'section',
          { class: 'edu-section', 'data-testid': 'account-about' },
          h('h2', { class: 'edu-section__title' }, '关于'),
          h(
            'p',
            { class: 'edu-section__lead' },
            '芽问 · 学生版。学习记录保存在这台电脑上；教材原文不会上传，也不会随安装包分发。',
          ),
          h(
            'details',
            { class: 'edu-fold' },
            h('summary', {}, '技术信息'),
            h(
              'dl',
              { class: 'edu-kv' },
              h('dt', {}, 'DSH 内核'),
              h('dd', {}, capabilities.dsh.bound ? '已连接' : '未连接'),
              h('dt', {}, '文字模型'),
              h('dd', {}, capabilities.model.text ? '可用' : '不可用'),
              h('dt', {}, '图像模型'),
              h('dd', {}, capabilities.model.image ? '可用' : '不可用'),
            ),
          ),
          h(
            'div',
            { class: 'edu-inline-actions' },
            button('导出或删除学习记录', () => void api.navigate('/records'), { tone: 'ghost' }),
          ),
        ),
      );
    },
  });
}

function keyErrorTitle(category: AuthKeyCategory): string {
  switch (category) {
    case 'format':
      return '格式不对';
    case 'auth':
      return 'Key 没有被接受';
    case 'network':
      return '没能连上本机服务';
    case 'quota':
      return '配额不足';
    case 'not_implemented':
      return '接口还没准备好';
    default:
      return '保存没有完成';
  }
}

function keyErrorBody(category: AuthKeyCategory): string {
  switch (category) {
    case 'format':
      return '只接受以 sk- 开头、长度合理的 Key；Key 没有保存。';
    case 'auth':
      return '这个 Key 没被接受；请检查后重试，Key 没有保存。';
    case 'network':
      return '无法连接本机服务；Key 没有保存，当前仍是本地模式。';
    case 'quota':
      return '这个 Key 的配额不足或请求受限；可以换一个 Key 或稍后再试。';
    case 'not_implemented':
      return '本机服务还没有提供 Key 配置；Key 没有保存。';
    default:
      return '本机服务没有确认保存；Key 没有保存，当前仍是本地模式。';
  }
}
