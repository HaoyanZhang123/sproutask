import { afterEach, describe, expect, it } from 'vitest';
import type { EducationPage } from '../src/index.js';
import { h } from '../src/dom.js';
import {
  buttonByAction,
  buttonsOf,
  cleanupShells,
  fixtureOptions,
  mountShell,
  pageRoot,
  pressEnter,
  textOf,
  tick,
} from './helpers.js';

afterEach(cleanupShells);

const FORBIDDEN_ENTRY = /终端|源码|源代码|插件市场|开发者工具|DevTools|命令行|Skill|MCP/i;

describe('education shell navigation', () => {
  it('shows the three student entries (today/study/progress) without development entries', async () => {
    const { container } = await mountShell(fixtureOptions());
    const nav = [...container.querySelectorAll<HTMLButtonElement>('[data-nav-path]')];
    expect(nav.map((item) => item.textContent?.trim())).toEqual(['今天', '学习', '进展']);
    const home = pageRoot(container);
    expect(home.querySelector('[data-testid="home-continue"]')).not.toBeNull();
    expect(home.querySelector('[data-testid="home-map"]')).not.toBeNull();
    expect(home.querySelector('[data-testid="home-review"]')).not.toBeNull();
    expect(textOf(home)).toContain('继续上次');
    const progress = home.querySelector<HTMLElement>('[data-testid="home-progress"]');
    expect(progress).not.toBeNull();
    expect(textOf(progress as HTMLElement)).toContain('全册 3 个概念');
    expect(textOf(progress as HTMLElement)).toContain('学过');
    for (const control of [...buttonsOf(container), ...nav]) {
      expect((control.textContent ?? '').trim()).not.toMatch(FORBIDDEN_ENTRY);
    }
    expect(container.querySelector('nav')?.getAttribute('aria-label')).toBe('主导航');
    expect(container.querySelector('main')?.id).toBe('edu-main');
  });

  it('navigates to all four pages and keeps the current entry locatable', async () => {
    const { shell, container } = await mountShell(fixtureOptions());
    for (const path of ['/library', '/map', '/workspace', '/records']) {
      await shell.navigate(path);
      expect(container.querySelector('[data-testid="edu-topbar"]'), path).not.toBeNull();
      const current = container.querySelector('[aria-current="page"]')?.textContent ?? '';
      if (path === '/workspace' || path === '/records') {
        expect(current).toContain(path === '/workspace' ? '学习' : '进展');
      }
      // 页头只保留品牌/主入口/设置：不再有"返回位置/本地保存/内容包版本"这类调试条。
      expect(textOf(container)).not.toContain('返回位置');
    }
    await shell.navigate('/home');
    expect(pageRoot(container).querySelector('[data-testid="home-continue"]')).not.toBeNull();
  });

  it('lets T09/T10/T12 register their real pages over the fallbacks', async () => {
    const { shell, container } = await mountShell(fixtureOptions());
    const unmounted: string[] = [];
    const pages: EducationPage[] = [
      {
        id: 'library',
        path: '/library',
        title: '教材库',
        requiresLearner: false,
        mount(context) {
          context.container.append(h('h1', { 'data-testid': 't09-page' }, 'T09 教材库页面'));
        },
        unmount() {
          unmounted.push('library');
        },
      },
      {
        id: 'map',
        path: '/map',
        title: '地图',
        requiresLearner: false,
        mount(context) {
          context.container.append(h('h1', { 'data-testid': 't10-page' }, 'T10 地图页面'));
        },
        unmount() {
          unmounted.push('map');
        },
      },
      {
        id: 'study',
        path: '/workspace',
        title: '工作区',
        requiresLearner: true,
        mount(context) {
          context.container.append(h('h1', { 'data-testid': 't12-page' }, 'T12 学习页面'));
        },
        unmount() {
          unmounted.push('study');
        },
      },
    ];
    for (const page of pages) shell.registerPage(page);
    for (const [path, testId] of [
      ['/library', 't09-page'],
      ['/map', 't10-page'],
      ['/workspace', 't12-page'],
    ] as const) {
      await shell.navigate(path);
      expect(pageRoot(container).querySelector(`[data-testid="${testId}"]`), path).not.toBeNull();
    }
    await shell.navigate('/home');
    expect(unmounted).toEqual(['library', 'map', 'study']);
  });

  it('mounts T11-style panels into named study slots and unmounts them on leave', async () => {
    const { shell, container } = await mountShell(fixtureOptions());
    let mountedInto = '';
    let unmounted = false;
    const off = shell.registerPanel('study:visuals', {
      id: 't11-visuals',
      mount(context) {
        mountedInto = context.container.dataset['eduSlot'] ?? '';
        context.container.append(h('p', { 'data-testid': 't11-panel' }, 'T11 图示面板'));
      },
      unmount() {
        unmounted = true;
      },
    });
    await shell.navigate('/workspace');
    expect(mountedInto).toBe('study:visuals');
    expect(container.querySelector('[data-testid="t11-panel"]')).not.toBeNull();
    await shell.navigate('/home');
    expect(unmounted).toBe(true);
    off();
  });

  it('supports a keyboard main journey with native buttons, skip link and Enter activation', async () => {
    const { shell, container } = await mountShell(fixtureOptions());
    const skip = container.querySelector<HTMLAnchorElement>('.edu-skip-link');
    expect(skip).not.toBeNull();
    skip?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    expect(document.activeElement?.id).toBe('edu-main');

    const resume = buttonByAction(pageRoot(container), 'resume-last');
    expect(resume.tagName).toBe('BUTTON');
    expect(resume.type).toBe('button');
    expect(resume.tabIndex).toBe(0);
    resume.focus();
    expect(document.activeElement).toBe(resume);
    pressEnter(resume);
    await tick(10);
    expect(shell.getState().currentPath).toBe('/workspace');
    expect(textOf(pageRoot(container))).toContain('step-1');
    expect(document.activeElement?.tagName).toBe('H1');
  });

  it('keeps a discoverable settings entry and never exposes credentials', async () => {
    const { container } = await mountShell(fixtureOptions());
    const account = container.querySelector('[data-action="account-status"]');
    expect(account).not.toBeNull();
    const text = textOf(account as HTMLElement);
    expect(text).toContain('设置');
    expect(text).not.toMatch(/token|Bearer|sk-/i);
  });
});
