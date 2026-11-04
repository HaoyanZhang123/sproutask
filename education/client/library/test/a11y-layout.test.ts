import { afterEach, describe, expect, it } from 'vitest';
import {
  buttonByAction,
  chipsOf,
  cleanupLibraries,
  dispatchKey,
  el,
  mountLibrary,
  pageRoot,
  switchToBook,
  textOf,
} from './helpers.js';
import {
  DESIGN_TOKENS,
  button,
  evaluateLayout,
  h,
} from '../../shell/src/index.js';
import { libraryStyles } from '../src/index.js';

afterEach(cleanupLibraries);

describe('/library 键盘、布局与外壳集成', () => {
  it('通过 registerPage 接管 /library 并填满两个挂载点', async () => {
    const { container, shell } = await mountLibrary();
    expect(shell.getState().currentPath).toBe('/library');
    expect(pageRoot(container).dataset['pageId']).toBe('library');
    expect(container.querySelector('[data-edu-slot="library:content"] [data-testid="library-content-panel"]')).not.toBeNull();
    expect(container.querySelector('[data-edu-slot="library:import"] [data-testid="library-import-panel"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="library-fallback"]')).toBeNull();
    expect(container.querySelector('[data-testid="library-fixture-notice"]')).not.toBeNull();
    expect(textOf(container)).not.toMatch(/终端|源码|插件市场|开发者工具|DevTools|Skill/i);
    expect(container.querySelectorAll('.edu-lib')).not.toHaveLength(0);
  });

  it('只用原生控件：按钮是 button、表单有 label、错误/确认框可用 Escape 退出并还焦点', async () => {
    const { container } = await mountLibrary();
    // 页面里每个“看起来可点”的东西都是原生 button 或原生 input
    for (const control of container.querySelectorAll<HTMLElement>('[data-action]')) {
      expect(['BUTTON', 'INPUT']).toContain(control.tagName);
    }
    const start = el<HTMLButtonElement>(pageRoot(container), 'library-import');
    start.click();
    await new Promise((resolve) => setTimeout(resolve, 20));
    for (const input of container.querySelectorAll('input')) {
      expect(input.id.length).toBeGreaterThan(0);
      expect(container.querySelector(`label[for="${input.id}"]`)).not.toBeNull();
    }

    // 没核对过的课本：确认框可以只用键盘走完
    await switchToBook(container, 'book.candidate.fixture');
    const trigger = el<HTMLButtonElement>(pageRoot(container), 'library-start');
    trigger.focus();
    trigger.click();
    const dialog = container.querySelector<HTMLElement>('[data-edu-dialog="default"]');
    expect(dialog).not.toBeNull();
    dispatchKey(dialog as HTMLElement, 'Escape');
    expect((dialog as HTMLElement).hasAttribute('hidden')).toBe(true);
    expect(document.activeElement).toBe(trigger);
  });

  it('窄屏 < 1100px 单列，宽屏也不横向溢出', () => {
    for (const [width, height] of [
      [1440, 900],
      [1280, 800],
      [1024, 768],
    ] as const) {
      const budget = evaluateLayout(width, height, 16);
      expect(budget.fits).toBe(true);
      expect(budget.horizontalOverflow).toBe(false);
    }
    expect(evaluateLayout(1024, 768, 16).mode).toBe('compact');
    expect(evaluateLayout(1280, 800, 16).mode).toBe('wide');

    // 课本卡在窄屏折叠成一列；布局约束都写在 library 样式里
    expect(libraryStyles).toContain(`@media (max-width: ${DESIGN_TOKENS.breakpoints.compact - 1}px)`);
    expect(libraryStyles).toContain('grid-template-columns: minmax(0, 1fr)');
    expect(libraryStyles).toContain('min-width: 0');
    expect(libraryStyles).toContain('overflow-wrap: anywhere');
    // 不硬编码字号
    for (const match of libraryStyles.matchAll(/font-size:\s*([^;]+);/g)) {
      const value = (match[1] ?? '').trim();
      expect(value, value).not.toMatch(/\d+px/);
      expect(value, value).toMatch(/var\(--edu-font|clamp\(/);
    }
    expect(DESIGN_TOKENS.baseFontSize).toBe('1rem');
  });

  it('状态不只靠颜色：chip 有文字，折叠块有 aria-expanded', async () => {
    const { container } = await mountLibrary();
    const page = pageRoot(container);
    const chips = chipsOf(page);
    expect(chips.length).toBe(1);
    for (const chip of chips) {
      expect((chip.textContent ?? '').trim().length).toBeGreaterThan(0);
      expect(chip.dataset['tone']).toBeDefined();
    }
    expect(textOf(el(page, 'library-book-card'))).toContain('现在用的是');
    const toggle = buttonByAction(page, 'toggle-sources');
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(toggle.getAttribute('aria-controls')).toBe('library-sources-body');
    expect(textOf(toggle)).toContain('条来源');
    // 打不开的课本用文字说明，不只靠红色边
    await switchToBook(container, 'book.unavailable.fixture');
    expect(textOf(el(pageRoot(container), 'library-verified-chip'))).toBe('打不开');
    expect(textOf(pageRoot(container))).toContain('打不开');
  });

  it('沿用外壳的布局预算与样式入口，不注入自己的主题根', async () => {
    const { shell } = await mountLibrary();
    expect(shell.layoutBudget(1280, 800).mode).toBe('wide');
    expect(shell.layoutBudget(1024, 768).mode).toBe('compact');
    // 页面不得自建主题或第二个外壳根
    expect(document.querySelectorAll('[data-edu-shell="true"]').length).toBe(1);
    expect(document.querySelectorAll('[data-edu-library-style="true"]').length).toBe(1);
    expect(h).toBeTypeOf('function');
    expect(button).toBeTypeOf('function');
  });
});
