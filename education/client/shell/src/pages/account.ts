/** Account and model-service status: two separate layers, no credentials in the DOM. */

import type { EducationPage, EducationPageContext } from '../contracts.js';
import { h } from '../dom.js';
import { button } from '../components/button.js';
import { ConfirmDialog } from '../components/confirm-dialog.js';
import { renderContextBar } from '../components/context-bar.js';
import { notice } from '../components/states.js';
import { statusChip } from '../components/status-chip.js';
import { courseEditionLabel, formatDateTime } from '../labels.js';
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
    title: '账户与模型服务',
    requiresLearner: true,
    fallback: true,
    mount(container, context: EducationPageContext) {
      const api = context.services.shell;
      const state = context.services.getState();
      const snapshot = state.snapshot;
      container.append(
        pageHeading(
          '账户与模型服务',
          '学习身份、模型账户与 API Key 是三层不同的状态。界面只显示后端返回的可用性，不接收或展示任何凭据内容。',
        ),
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

      container.append(
        renderContextBar({
          courseEdition: courseEditionLabel(snapshot.courseEdition),
          packVersion: snapshot.pack.version,
          concept: null,
          mode: null,
          saveState: state.saveState,
          fixture: snapshot.fixture,
          backTarget: state.backTarget?.label ?? null,
          onBack: state.backTarget === null ? undefined : () => void api.back(),
        }),
      );

      container.append(
        h(
          'section',
          { class: 'edu-section', 'data-testid': 'account-identity' },
          h('h2', { class: 'edu-section__title' }, '本地学习身份'),
          h(
            'div',
            { class: 'edu-card' },
            statusChip('本地匿名档案', 'positive'),
            h('p', { class: 'edu-card__title' }, snapshot.learner.id),
            h(
              'p',
              { class: 'edu-card__meta' },
              `创建于 ${formatDateTime(snapshot.learner.createdAt)}。学习记录只属于这个本机身份；模型账号不是学习身份。`,
            ),
          ),
        ),
      );

      const account = snapshot.auth.account;
      const accountUnavailable = account.status !== 'available';
      container.append(
        h(
          'section',
          { class: 'edu-section', 'data-testid': 'account-model-account' },
          h('h2', { class: 'edu-section__title' }, '模型账户（平台授权）'),
          h(
            'div',
            { class: 'edu-card' },
            statusChip(accountUnavailable ? '不可用' : '可用', accountUnavailable ? 'neutral' : 'positive'),
            h(
              'p',
              { class: 'edu-card__meta' },
              accountUnavailable
                ? '本产品线不使用平台账户授权（用户已明确该路线不允许）。因此这里不提供登录、退出或授权入口，也不把 API Key 显示成账户授权成功。'
                : `账户授权可用；最后检查：${formatDateTime(account.lastCheckedAt)}。`,
            ),
            h(
              'p',
              { class: 'edu-muted', 'data-testid': 'account-route-note' },
              '账户登录、取消、失败与退出状态由后端返回；客户端不自行裁剪权限，也不用隐藏按钮代替后端拒绝。',
            ),
          ),
        ),
      );

      const apiKey = snapshot.auth.apiKey;
      let keyConfigured = apiKey.status === 'available' || state.keyStatus === 'configured';
      let keySuffix = state.keySuffix;
      const keySection = h(
        'section',
        { class: 'edu-section', 'data-testid': 'account-api-key' },
        h('h2', { class: 'edu-section__title' }, 'API Key（模型服务配置）'),
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
        'aria-label': '模型 API Key',
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
        title: '清除模型 API Key？',
        impact: [
          '清除后回到本地模式：教材、地图、记录和草稿仍可读。',
          '云推理与模型反馈会不可用，直到重新配置。',
          '不会删除任何学习记录、证据或自评。',
        ],
        confirmLabel: '清除 Key 并回到本地模式',
        tone: 'danger',
        onConfirm: () => void clearKey(),
      });

      const updateKeyState = (): void => {
        keyStatusLine.replaceChildren(
          statusChip(keyConfigured ? '已配置' : '未配置', keyConfigured ? 'positive' : 'attention'),
        );
        keyStatusText.textContent = keyConfigured
          ? `已配置（****${keySuffix ?? ''}）。界面只显示脱敏状态，不回显、不复制、不写入学习记录。`
          : 'API Key 未配置：当前为本地模式；可读本地内容（教材、记录和草稿），云推理不可用。';
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
        keyFeedback.replaceChildren(
          h('p', { class: 'edu-muted', role: 'status' }, '正在交给本机宿主保存…'),
        );
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
              title: '已保存到本机宿主',
              body: '宿主已确认配置；Key 不会出现在页面、日志、快照或 URL 中。',
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
            body: '教材、地图与记录仍可读；未配置模型 Key 时不会发送云推理请求。',
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
          'p',
          { class: 'edu-muted' },
          '密钥只交给本机宿主加密保存；客户端不持久化、不写 localStorage/sessionStorage，也不会把 Key 放进 URL 或日志。',
        ),
        h(
          'div',
          { class: 'edu-key-form', 'data-testid': 'account-key-form' },
          h('label', { class: 'edu-field-label', for: 'account-key-input' }, '模型 API Key'),
          keyInput,
          h('div', { class: 'edu-inline-actions' }, saveButton, clearButton),
          h(
            'p',
            { class: 'edu-muted' },
            '只接受以 sk- 开头的合理长度 Key；格式错误、鉴权失败、网络失败、配额不足会分别提示。',
          ),
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

      const capabilities = snapshot.capabilities;
      container.append(
        h(
          'section',
          { class: 'edu-section', 'data-testid': 'account-runtime' },
          h('h2', { class: 'edu-section__title' }, '运行与模型能力'),
          h(
            'div',
            { class: 'edu-grid' },
            capabilityCard('DSH 运行内核', capabilities.dsh.bound ? '已绑定' : '未绑定', capabilities.dsh.bound ? 'positive' : 'attention'),
            capabilityCard('文本模型', capabilities.model.text ? '可用' : '不可用', capabilities.model.text ? 'positive' : 'attention'),
            capabilityCard('图像模型', capabilities.model.image ? '可用' : '不可用', capabilities.model.image ? 'positive' : 'attention'),
          ),
          h(
            'p',
            { class: 'edu-muted' },
            `当前受控学习工具：${capabilities.tools.length} 项；网络：${capabilities.network === 'loopback_only' ? '仅本机回环' : '不可用'}。系统级文件与命令能力不属于学生权限。`,
          ),
        ),
      );

      container.append(
        h(
          'section',
          { class: 'edu-section', 'data-testid': 'account-display' },
          h('h2', { class: 'edu-section__title' }, '显示字号'),
          h(
            'p',
            { class: 'edu-section__lead' },
            '默认使用 20px 基准字号；所有字号和间距用 rem，浏览器缩放或系统字体放大后主旅程仍可完成。',
          ),
        ),
      );
      const displaySection = container.lastElementChild as HTMLElement;
      const standardButton = button(
        '标准字号（20px 基准）',
        () => {
          api.setFontScale('standard');
          updatePressed();
        },
        { small: true, dataAction: 'font-standard' },
      );
      const largeButton = button(
        '较大字号',
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
      displaySection.append(h('div', { class: 'edu-inline-actions' }, standardButton, largeButton));

      container.append(
        notice({
          tone: 'info',
          title: '更换模型账号不会删除学情',
          body: '退出或更换模型账户、服务授权失效，都不会删除本机教材、活动、证据、自评或复习安排；也不会自动续发之前的请求。',
          actions: [
            { label: '查看本地记录与数据管理', onClick: () => void api.navigate('/records') },
            { label: '返回首页', onClick: () => void api.navigate('/home') },
          ],
        }),
      );
      container.append(
        h(
          'p',
          { class: 'edu-muted' },
          '学生权限不包含系统级文件、命令或任意文件读取；这些限制由后端执行，不依赖本页隐藏入口。',
        ),
      );
    },
  });
}

function capabilityCard(
  title: string,
  value: string,
  tone: 'positive' | 'attention',
): HTMLElement {
  return h(
    'div',
    { class: 'edu-card' },
    h('h3', { class: 'edu-card__title' }, title),
    statusChip(value, tone),
  );
}

function keyErrorTitle(category: AuthKeyCategory): string {
  switch (category) {
    case 'format':
      return '格式错误';
    case 'auth':
      return '鉴权失败';
    case 'network':
      return '网络失败';
    case 'quota':
      return '配额不足';
    case 'not_implemented':
      return '接口未实现';
    default:
      return '保存没有完成';
  }
}

function keyErrorBody(category: AuthKeyCategory): string {
  switch (category) {
    case 'format':
      return '只接受以 sk- 开头、长度合理的 Key；Key 没有保存。';
    case 'auth':
      return '本机宿主没有接受这个 Key；请检查后重试，Key 没有保存。';
    case 'network':
      return '无法连接本机宿主端点；Key 没有保存，当前仍为本地模式。';
    case 'quota':
      return '该 Key 的配额不足或请求受限；请更换 Key 或稍后重试。';
    case 'not_implemented':
      return '本机宿主尚未提供 /edu/api/auth/key；Key 没有保存，不能假装成功。';
    default:
      return '宿主没有确认保存；Key 没有保存，当前仍为本地模式。';
  }
}
