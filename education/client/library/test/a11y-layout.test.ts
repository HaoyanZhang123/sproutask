import { afterEach, describe, expect, it } from 'vitest';
import {
  buttonByAction,
  buttonsOf,
  cleanupLibraries,
  dispatchKey,
  mountLibrary,
  pageRoot,
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

describe('library keyboard, layout and shell integration', () => {
  it('takes over /library through registerPage and fills both registered panels', async () => {
    const { container, shell } = await mountLibrary();
    expect(shell.getState().currentPath).toBe('/library');
    expect(pageRoot(container).dataset['pageId']).toBe('library');
    expect(container.querySelector('[data-edu-slot="library:content"] [data-testid="library-content-panel"]')).not.toBeNull();
    expect(container.querySelector('[data-edu-slot="library:import"] [data-testid="library-import-panel"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="library-fallback"]')).toBeNull();
    expect(container.querySelector('[data-testid="library-fixture-notice"]')).not.toBeNull();
    expect(textOf(container)).not.toMatch(/终端|源码|插件市场|开发者工具|DevTools|Skill/i);
  });

  it('uses native controls, labelled metadata inputs and keyboard focus/escape in dialogs', async () => {
    const { container } = await mountLibrary();
    for (const control of buttonsOf(container)) {
      expect(control.type).toBe('button');
    }
    buttonByAction(container, 'choose-file').click();
    await new Promise((resolve) => setTimeout(resolve, 10));
    for (const input of container.querySelectorAll('input')) {
      expect(input.id.length).toBeGreaterThan(0);
      expect(container.querySelector(`label[for="${input.id}"]`)).not.toBeNull();
    }
    const trial = buttonByAction(container, 'trial-candidate');
    trial.focus();
    trial.click();
    const dialog = container.querySelector<HTMLElement>('[data-edu-dialog="danger"]');
    expect(dialog).not.toBeNull();
    dispatchKey(dialog as HTMLElement, 'Escape');
    expect((dialog as HTMLElement).hasAttribute('hidden')).toBe(true);
    expect(document.activeElement).toBe(trial);
  });

  it('keeps a logical 1280x800 / 1440x900 layout without horizontal overflow', () => {
    for (const [width, height] of [
      [1280, 800],
      [1440, 900],
    ] as const) {
      const budget = evaluateLayout(width, height, 20);
      expect(budget.fits).toBe(true);
      expect(budget.horizontalOverflow).toBe(false);
    }
    expect(libraryStyles).toContain('minmax(min(100%, 20rem), 1fr)');
    expect(libraryStyles).toContain('min-width: 0');
    expect(libraryStyles).toContain('overflow-wrap: anywhere');
    expect(libraryStyles).toContain('max-width: 100%');
    for (const match of libraryStyles.matchAll(/font-size:\s*([^;]+);/g)) {
      const value = (match[1] ?? '').trim();
      expect(value, value).not.toMatch(/\d+px/);
    }
    expect(DESIGN_TOKENS.baseFontSize).toBe('1.25rem');
  });

  it('does not use colour as the only status signal', async () => {
    const { container } = await mountLibrary();
    const chips = [...container.querySelectorAll<HTMLElement>('.edu-chip')];
    expect(chips.length).toBeGreaterThan(3);
    for (const chip of chips) {
      expect((chip.textContent ?? '').trim().length).toBeGreaterThan(0);
      expect(chip.dataset['tone']).toBeDefined();
    }
    expect(textOf(container)).toContain('本期匹配基准');
    expect(textOf(container)).toContain('候选 · 未核实');
    expect(textOf(container)).toContain('不可用原因');
  });

  it('keeps the T08 layout budget helper usable with library pages', async () => {
    const { shell } = await mountLibrary();
    expect(shell.layoutBudget(1280, 800).mode).toBe('sidebar');
    expect(shell.layoutBudget(1024, 768).mode).toBe('stacked');
    // The library page must not inject its own theme/global root.
    expect(document.querySelectorAll('[data-edu-shell="true"]').length).toBe(1);
    expect(document.querySelectorAll('[data-edu-library-style="true"]').length).toBe(1);
    // Exported shell primitives remain available to the library package.
    expect(h).toBeTypeOf('function');
    expect(button).toBeTypeOf('function');
  });
});
