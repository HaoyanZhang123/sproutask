/** Home: three entries (continue / map / review) plus persistent context. */

import type { EducationPage, EducationPageContext } from '../contracts.js';
import type { EducationShellApi } from '../shell-state.js';
import { h } from '../dom.js';
import { renderErrorBanner } from '../errors.js';
import { button } from '../components/button.js';
import { emptyState, fixtureBadge, notice, offlineNotice } from '../components/states.js';
import { progressSummary } from '../components/progress.js';
import { statusChip } from '../components/status-chip.js';
import {
  REVIEW_REASON_LABELS,
  SESSION_MODE_LABELS,
  UNDERSTANDING_LABELS,
  formatDateTime,
} from '../labels.js';
import { conceptTitle, definePage, pageHeading } from './common.js';

function entryCard(input: {
  readonly eyebrow: string;
  readonly title: string;
  readonly body: readonly string[];
  readonly primary: boolean;
  readonly actions: readonly HTMLElement[];
  readonly testId: string;
}): HTMLElement {
  return h(
    'article',
    {
      class: `edu-entry${input.primary ? ' edu-entry--primary' : ''}`,
      'data-testid': input.testId,
    },
    h('p', { class: 'edu-entry__eyebrow' }, input.eyebrow),
    h('h2', { class: 'edu-entry__title' }, input.title),
    ...input.body.map((line) => h('p', { class: 'edu-entry__body' }, line)),
    h('div', { class: 'edu-entry__actions' }, ...input.actions),
  );
}

export function createHomePage(): EducationPage {
  return definePage({
    id: 'shell.home',
    path: '/home',
    title: '首页',
    requiresLearner: false,
    fallback: true,
    mount(container, context: EducationPageContext) {
      const api = context.services.shell;
      const state = context.services.getState();
      const snapshot = state.snapshot;
      const home = state.home;

      container.append(pageHeading('首页', '继续上次的学习，或从地图和复习开始。'));
      if (snapshot === null || home === null) {
        container.append(
          emptyState({
            title: '正在准备学习空间',
            body: '还没有读到本机教材与记录。可以稍后重试。',
            actions: [{ label: '重试', onClick: () => void api.refresh() }],
          }),
        );
        return;
      }

      if (state.offline) {
        container.append(offlineNotice(() => void api.refresh()));
      }

      if (home.compatibility !== null) {
        container.append(
          notice({
            tone: 'warning',
            title: '上次内容与当前版本不兼容',
            body: `上次保存的内容版本是 ${home.compatibility.previousPackVersion}，当前是 ${home.compatibility.currentPackVersion}。${home.compatibility.reason} 旧记录仍可查看，但不会自动迁移成新的理解证据。`,
            testId: 'home-incompatible',
            actions: [
              { label: '查看旧记录', onClick: () => void api.navigate('/records') },
              { label: '重新关联', onClick: () => void api.navigate('/library') },
              {
                label: '开始新活动',
                onClick: () => void api.navigate('/workspace?mode=learn&new=1'),
                tone: 'primary',
              },
            ],
          }),
        );
      }

      if (state.resumeError !== null) {
        container.append(
          renderErrorBanner(state.resumeError, {
            onRetry: () => void api.resumeLast(),
            onBack: () => void api.navigate('/records'),
            backLabel: '查看旧记录',
          }),
        );
      }

      if (state.keyStatus === 'missing' && !isKeyIntroDismissed()) {
        container.append(keyIntro(api));
      }

      const entries = h('div', { class: 'edu-entry-grid' });
      const active = home.activeSession;

      if (active !== null) {
        const title = conceptTitle(snapshot.concepts, active.conceptId);
        entries.append(
          entryCard({
            eyebrow: '继续上次',
            title,
            body: [
              `模式：${SESSION_MODE_LABELS[active.mode]}`,
              active.resumeCursor.cursor === null ? '本轮还没有填写草稿' : '已保存草稿，可以原样接着做',
            ],
            primary: true,
            testId: 'home-continue',
            actions: [
              button('继续上次', () => void api.resumeLast(), { tone: 'primary', dataAction: 'resume-last' }),
              button('查看记录', () => void api.navigate('/records')),
            ],
          }),
        );
      } else if (home.lastCompletedSession !== null) {
        const completed = home.lastCompletedSession;
        const title = conceptTitle(snapshot.concepts, completed.conceptId);
        entries.append(
          entryCard({
            eyebrow: '上次学习已完成',
            title,
            body: [
              `模式：${SESSION_MODE_LABELS[completed.mode]} · 结束于 ${formatDateTime(completed.endedAt)}`,
              '已完成的活动可以打开收尾记录，也可以开始新一轮，不会覆盖旧证据。',
            ],
            primary: true,
            testId: 'home-completed',
            actions: [
              button('查看收尾记录', () => void api.navigate('/records'), { tone: 'primary' }),
              button('再学一次', () => void api.navigate(`/workspace?mode=learn&concept=${completed.conceptId}&new=1`)),
              button('开始复习', () => void api.navigate(`/workspace?mode=review&concept=${completed.conceptId}`)),
            ],
          }),
        );
      } else {
        entries.append(
          entryCard({
            eyebrow: '开始使用',
            title: '选择教材，开始学习',
            body: [
              '还没有学习记录。先选择与你课本匹配的教材，再从地图选择概念。',
              '记录保存在这台电脑；云端反馈需要已配置的模型服务。',
            ],
            primary: true,
            testId: 'home-first-use',
            actions: [
              button('选择教材，开始学习', () => void api.navigate('/library'), { tone: 'primary' }),
              button('首次使用说明', () => void api.navigate('/first-run')),
            ],
          }),
        );
      }

      const currentConcept =
        active?.conceptId ?? home.lastCompletedSession?.conceptId ?? null;
      entries.append(
        entryCard({
          eyebrow: '进入地图',
          title: '按目录找概念',
          body: [
            currentConcept === null
              ? '尚未选择概念；地图会从真实教材目录开始。'
              : `当前概念：${conceptTitle(snapshot.concepts, currentConcept)}`,
          ],
          primary: false,
          testId: 'home-map',
          actions: [
            button('进入地图', () => void api.navigate('/map'), { tone: 'primary' }),
            button('查看教材库', () => void api.navigate('/library')),
          ],
        }),
      );

      const reviewBody: HTMLElement[] = [];
      if (home.dueReviews.length === 0) {
        reviewBody.push(h('p', { class: 'edu-entry__body' }, '当前没有待复习项目；仍可自选范围复习。'));
      } else {
        reviewBody.push(
          h('p', { class: 'edu-entry__body' }, `有 ${home.dueReviews.length} 个概念待复习。`),
          h(
            'ul',
            { class: 'edu-list', 'data-testid': 'home-review-list' },
            ...home.dueReviews.slice(0, 3).map((item) =>
              h(
                'li',
                { class: 'edu-list__item' },
                h('strong', {}, item.conceptTitle),
                h('span', { class: 'edu-muted' }, ` · ${REVIEW_REASON_LABELS[item.reason]} · ${formatDateTime(item.dueAt)}`),
              ),
            ),
          ),
        );
      }
      const reviewActions: HTMLElement[] = [];
      if (home.dueReviews.length > 0) {
        reviewActions.push(
          button('开始复习', () => void api.navigate('/workspace?mode=review'), { tone: 'primary' }),
        );
      }
      reviewActions.push(button('自选复习范围', () => void api.navigate('/map?intent=review')));
      entries.append(
        entryCard({
          eyebrow: '复习',
          title: home.dueReviews.length === 0 ? '当前没有待复习项目' : '按建议或自选范围复习',
          body: [],
          primary: false,
          testId: 'home-review',
          actions: reviewActions,
        }),
      );
      // Insert the review list inside the review card (entryCard only renders paragraphs).
      const reviewCard = entries.querySelector<HTMLElement>('[data-testid="home-review"]');
      if (reviewCard !== null) {
        const actions = reviewCard.querySelector('.edu-entry__actions');
        for (const node of reviewBody) reviewCard.insertBefore(node, actions);
      }

      container.append(entries);
      container.append(
        h(
          'section',
          { class: 'edu-section', 'data-testid': 'home-progress' },
          progressSummary({
            label: '已学概念',
            current: home.learnedConceptCount,
            total: home.totalConcepts,
            note: '内容覆盖计数，不是掌握程度；自评与理解证据在记录页分开显示。',
          }),
        ),
      );

      const service = h(
        'section',
        { class: 'edu-section', 'aria-label': '服务状态' },
        h('h2', { class: 'edu-section__title' }, '当前服务状态'),
        h(
          'div',
          { class: 'edu-grid' },
          statusCard('本地记录', '可读', 'positive', '教材与已保存记录在这台电脑上。'),
          statusCard(
            '模型服务',
            state.keyStatus === 'configured' ? 'API Key 已配置' : 'API Key 未配置',
            state.keyStatus === 'configured' ? 'positive' : 'attention',
            state.keyStatus === 'configured'
              ? '云推理可用；请求范围以实际配置为准。'
              : '仍可读本地内容；云推理不可用。',
          ),
          statusCard(
            '平台账户',
            '不需要',
            'neutral',
            '当前版本只用模型 Key，不用平台账号。',
          ),
        ),
      );
      const fixtureFooter = h(
        'p',
        { class: 'edu-muted', 'data-testid': 'home-fixture-note' },
        snapshot.notice ?? '',
      );
      if (snapshot.fixture) fixtureFooter.prepend(fixtureBadge());
      service.append(fixtureFooter);
      container.append(service);
    },
  });
}

function statusCard(
  title: string,
  value: string,
  tone: 'positive' | 'attention' | 'neutral',
  detail: string,
): HTMLElement {
  return h(
    'div',
    { class: 'edu-card' },
    h('h3', { class: 'edu-card__title' }, title),
    statusChip(value, tone),
    h('p', { class: 'edu-card__meta' }, detail),
  );
}

const KEY_INTRO_DISMISSED = 'edu.client.key-intro.dismissed';

function isKeyIntroDismissed(): boolean {
  try {
    return globalThis.localStorage?.getItem(KEY_INTRO_DISMISSED) === '1';
  } catch {
    return false;
  }
}

function dismissKeyIntro(): void {
  try {
    globalThis.localStorage?.setItem(KEY_INTRO_DISMISSED, '1');
  } catch {
    /* A disabled storage must not block local mode. */
  }
}

function keyIntro(api: EducationShellApi): HTMLElement {
  const section = h(
    'section',
    {
      class: 'edu-section edu-key-intro',
      'aria-labelledby': 'edu-key-intro-title',
      'data-testid': 'first-start-guide',
    },
    h('h2', { class: 'edu-section__title', id: 'edu-key-intro-title' }, '先了解三件事'),
    h(
      'p',
      { class: 'edu-section__lead' },
      '还没有配置模型 Key；现在可以先在本地阅读教材、看地图和记录，之后再配置。',
    ),
    h(
      'ol',
      { class: 'edu-key-intro__steps' },
      h('li', {}, h('strong', {}, '这是本地学习工作区'), h('span', {}, '教材原文与学习记录保存在这台电脑，不上传整本教材。')),
      h('li', {}, h('strong', {}, '云模型只接收当前任务必要片段'), h('span', {}, '只有你在需要智能反馈时，当前题目、所作答与必要材料片段会发送到模型服务。')),
      h('li', {}, h('strong', {}, '可以随时修改'), h('span', {}, '之后可在“账户与模型服务”录入、更换或清除 Key；未配置时仍可本地学习。')),
    ),
    h(
      'div',
      { class: 'edu-inline-actions' },
      button('去配置模型 Key', () => void api.navigate('/account'), {
        tone: 'primary',
        dataAction: 'open-account-key',
      }),
      button(
        '跳过，先用本地模式',
        () => {
          dismissKeyIntro();
          section.remove();
        },
        { dataAction: 'skip-key-intro' },
      ),
    ),
  );
  return section;
}
