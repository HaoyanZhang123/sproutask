/** 今天：接着上次 / 今天可以做 / 进度一眼看完。 */

import type { Concept } from '@edu/domain';
import type { EducationPage, EducationPageContext } from '../contracts.js';
import type { HomePayload } from '../data/types.js';
import type { EducationShellApi, EducationShellViewState } from '../shell-state.js';
import { h } from '../dom.js';
import { button } from '../components/button.js';
import { emptyState, notice, offlineNotice } from '../components/states.js';
import { SESSION_MODE_LABELS, formatDateTime } from '../labels.js';
import { conceptTitle, definePage, pageHeading } from './common.js';

function greeting(now: string): string {
  const hour = new Date(now).getHours();
  if (Number.isNaN(hour)) return '今天';
  if (hour < 11) return '早上好';
  if (hour < 18) return '下午好';
  return '晚上好';
}

/** `step-2` → “第 2 步”；任何内部游标都不直接上屏。 */
function stepLabel(cursor: string | null): string | null {
  if (cursor === null) return null;
  const match = /^step-(\d+)$/.exec(cursor);
  return match === null ? null : `上次停在第 ${match[1]} 步`;
}

export function createHomePage(): EducationPage {
  return definePage({
    id: 'shell.home',
    path: '/home',
    title: '今天',
    requiresLearner: false,
    fallback: true,
    mount(container, context: EducationPageContext) {
      const api = context.services.shell;
      const state = context.services.getState();
      const snapshot = state.snapshot;
      const home = state.home;

      container.append(
        pageHeading(greeting(home?.now ?? context.services.clock.now()), '今天想接着上次，还是换一个概念？'),
      );
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

      if (state.offline) container.append(offlineNotice(() => void api.refresh()));

      if (home.compatibility !== null) {
        container.append(
          notice({
            tone: 'warning',
            title: '上次的内容和现在对不上',
            body: `上次保存的内容版本是 ${home.compatibility.previousPackVersion}，现在是 ${home.compatibility.currentPackVersion}。旧记录还能看，但不会自动变成新的理解记录。`,
            testId: 'home-incompatible',
            actions: [
              { label: '查看旧记录', onClick: () => void api.navigate('/records') },
              { label: '重新关联', onClick: () => void api.navigate('/library') },
              { label: '开始新活动', onClick: () => void api.navigate('/workspace?mode=learn&new=1'), tone: 'primary' },
            ],
          }),
        );
      }

      if (state.resumeError !== null) {
        container.append(
          notice({
            tone: 'warning',
            title: '上次的学习没能恢复',
            body: '可以先查看旧记录，或者从地图重新开始；已经保存的作答不会被清掉。',
            testId: 'home-resume-error',
            actions: [
              { label: '查看记录', onClick: () => void api.navigate('/records') },
              { label: '去地图', onClick: () => void api.navigate('/map') },
            ],
          }),
        );
      }

      if (state.keyStatus === 'missing' && !isKeyIntroDismissed()) {
        container.append(keyIntro(api));
      }

      const side = h('aside', { class: 'edu-today__side', 'aria-label': '今天可以做' });
      side.append(h('h2', { class: 'edu-today__side-title' }, '今天可以做'));

      const reviewTitles = home.dueReviews.slice(0, 2).map((item) => item.conceptTitle).join(' · ');
      side.append(
        taskRow({
          testId: 'home-review',
          icon: 'check',
          tone: 'amber',
          title:
            home.dueReviews.length === 0
              ? '还没有到期的复习'
              : `复习 ${home.dueReviews.length} 个概念`,
          subtitle:
            home.dueReviews.length === 0
              ? '也可以自己挑一段范围来复习'
              : reviewTitles,
          onClick: () => void api.navigate(home.dueReviews.length === 0 ? '/map?intent=review' : '/workspace?mode=review'),
        }),
        taskRow({
          testId: 'home-map',
          icon: 'compass',
          tone: 'blue',
          title: '去目录挑一个概念',
          subtitle: '按课本的章节找',
          onClick: () => void api.navigate('/map'),
        }),
        taskRow({
          testId: 'home-progress-link',
          icon: 'chart',
          tone: 'green',
          title: '看看这周的变化',
          subtitle: '学了什么、哪里还要再练',
          onClick: () => void api.navigate('/records'),
        }),
        taskRow({
          testId: 'home-library',
          icon: 'book',
          tone: 'neutral',
          title: '我的课本',
          subtitle: '看当前用的是哪一版、内容来自哪',
          onClick: () => void api.navigate('/library'),
        }),
      );

      const grid = h('div', { class: 'edu-today' }, primaryCard(api, snapshot.concepts, home, state), side);
      container.append(grid);

      const needsSupport = home.progress.filter((entry) => entry.understanding.state === 'needs_support').length;
      const learned = home.learnedConceptCount;
      const total = home.totalConcepts;
      const reviewCount = home.dueReviews.length;
      const learnedPct = total === 0 ? 0 : Math.round((learned / total) * 100);
      const reviewPct = total === 0 ? 0 : Math.round((reviewCount / total) * 100);

      container.append(
        h(
          'section',
          { class: 'edu-today__progress', 'data-testid': 'home-progress', 'aria-label': '学习进度' },
          h(
            'div',
            { class: 'edu-today__nums' },
            h('div', { class: 'edu-num' }, h('b', {}, String(learned)), h('span', {}, '学过')),
            h('div', { class: 'edu-num' }, h('b', {}, String(needsSupport)), h('span', {}, '要再练')),
            h('div', { class: 'edu-num' }, h('b', {}, String(reviewCount)), h('span', {}, '待复习')),
          ),
          h(
            'div',
            { class: 'edu-bar' },
            h(
              'div',
              { class: 'edu-bar__track' },
              h('span', { class: 'edu-bar__learn', style: `width:${learnedPct}%` }),
              h('span', { class: 'edu-bar__review', style: `width:${reviewPct}%` }),
            ),
          ),
          button('查看进展', () => void api.navigate('/records'), { tone: 'ghost' }),
        ),
      );

      if (snapshot.fixture && snapshot.notice !== null) {
        container.append(h('p', { class: 'edu-muted', 'data-testid': 'home-fixture-note' }, snapshot.notice));
      }
    },
  });
}

function primaryCard(
  api: EducationShellApi,
  concepts: readonly Concept[],
  home: HomePayload,
  state: EducationShellViewState,
): HTMLElement {
  const active = home.activeSession;
  const card = h('section', {
    class: 'edu-hero',
    'data-testid': active === null ? (home.lastCompletedSession === null ? 'home-first-use' : 'home-completed') : 'home-continue',
    'aria-label': '接着上次',
  });

  if (active !== null) {
    const title = conceptTitle(concepts, active.conceptId);
    const step = stepLabel(active.resumeCursor.cursor);
    card.append(
      h('p', { class: 'edu-hero__eyebrow' }, '接着上次'),
      h('h2', { class: 'edu-hero__title' }, title),
      h(
        'div',
        { class: 'edu-hero__meta' },
        h('span', { class: 'edu-chip', 'data-tone': 'progress' }, SESSION_MODE_LABELS[active.mode]),
        h('span', { class: 'edu-chip', 'data-tone': 'neutral' }, step ?? '草稿已保存'),
      ),
      h(
        'p',
        { class: 'edu-hero__body' },
        state.saveState === 'failed'
          ? '上次的改动还没写进本机，先别关；点继续后可以重试保存。'
          : '上次读到的地方和作答都还在，接着做就行。',
      ),
      h(
        'div',
        { class: 'edu-hero__actions' },
        button('继续上次', () => void api.resumeLast(), { tone: 'primary', dataAction: 'resume-last' }),
        button('从头开始', () =>
          void api.navigate(`/workspace?mode=${active.mode}&concept=${active.conceptId}&new=1`),
        ),
        button('查看进展', () => void api.navigate('/records'), { tone: 'ghost' }),
      ),
    );
    return card;
  }

  if (home.lastCompletedSession !== null) {
    const completed = home.lastCompletedSession;
    const title = conceptTitle(concepts, completed.conceptId);
    card.append(
      h('p', { class: 'edu-hero__eyebrow' }, '上次学习已完成'),
      h('h2', { class: 'edu-hero__title' }, title),
      h(
        'div',
        { class: 'edu-hero__meta' },
        h('span', { class: 'edu-chip', 'data-tone': 'neutral' }, `结束于 ${formatDateTime(completed.endedAt)}`),
      ),
      h('p', { class: 'edu-hero__body' }, '想再走一遍，或者换一个概念？已经记下的内容不会丢。'),
      h(
        'div',
        { class: 'edu-hero__actions' },
        button('再学一次', () =>
          void api.navigate(`/workspace?mode=learn&concept=${completed.conceptId}&new=1`),
          { tone: 'primary' },
        ),
        button('开始复习', () => void api.navigate(`/workspace?mode=review&concept=${completed.conceptId}`)),
        button('查看进展', () => void api.navigate('/records'), { tone: 'ghost' }),
      ),
    );
    return card;
  }

  card.append(
    h('p', { class: 'edu-hero__eyebrow' }, '开始使用'),
    h('h2', { class: 'edu-hero__title' }, '先挑一个概念开始'),
    h('p', { class: 'edu-hero__body' }, '从目录里选一个概念，读课本、做一题；第一次不用配模型也能读。'),
    h(
      'div',
      { class: 'edu-hero__actions' },
      button('去目录挑一个', () => void api.navigate('/map'), { tone: 'primary' }),
      button('看看我的课本', () => void api.navigate('/library'), { tone: 'ghost' }),
    ),
  );
  return card;
}

function taskRow(input: {
  readonly testId: string;
  readonly icon: 'check' | 'compass' | 'chart' | 'book';
  readonly tone: 'amber' | 'blue' | 'green' | 'neutral';
  readonly title: string;
  readonly subtitle: string;
  readonly onClick: () => void;
}): HTMLElement {
  const row = h(
    'button',
    {
      type: 'button',
      class: 'edu-task',
      'data-testid': input.testId,
      onclick: input.onClick,
    },
    h('span', { class: `edu-task__icon edu-task__icon--${input.tone}`, 'aria-hidden': 'true' }, taskIcon(input.icon)),
    h('span', { class: 'edu-task__text' }, h('b', {}, input.title), h('span', {}, input.subtitle)),
    h('span', { class: 'edu-task__arrow', 'aria-hidden': 'true' }, '›'),
  );
  return row;
}

function taskIcon(kind: 'check' | 'compass' | 'chart' | 'book'): string {
  switch (kind) {
    case 'check':
      return '✓';
    case 'compass':
      return '◎';
    case 'chart':
      return '▮';
    default:
      return '▤';
  }
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
      '还没有连接模型；现在可以先读教材、看地图和记录，之后再配。',
    ),
    h(
      'ol',
      { class: 'edu-key-intro__steps' },
      h('li', {}, h('strong', {}, '记录只在这台电脑'), h('span', {}, '教材原文与学习记录保存在本机，不上传整本教材。')),
      h('li', {}, h('strong', {}, '云端只收当前这一题'), h('span', {}, '需要智能反馈时，当前题目、作答和必要材料片段才会发出去。')),
      h('li', {}, h('strong', {}, '随时能改'), h('span', {}, '之后可以在设置里换掉或清除；没配也能继续本地学习。')),
    ),
    h(
      'div',
      { class: 'edu-inline-actions' },
      button('去设置模型 Key', () => void api.navigate('/account'), {
        tone: 'primary',
        dataAction: 'open-account-key',
      }),
      button(
        '跳过，先用本地',
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
