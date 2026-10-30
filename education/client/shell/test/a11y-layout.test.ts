import { afterEach, describe, expect, it } from 'vitest';
import {
  DESIGN_TOKENS,
  FONT_SCALE_STEPS,
  educationStyles,
  evaluateLayout,
  focusableElements,
  remToPx,
} from '../src/index.js';
import {
  buttonByAction,
  buttonsOf,
  cleanupShells,
  dispatchKey,
  fixtureOptions,
  mountShell,
  pageRoot,
  textOf,
  tick,
} from './helpers.js';

afterEach(cleanupShells);

describe('tokens, readable layout and keyboard accessibility', () => {
  it('defines a 20px base with rem type and a visible focus ring', () => {
    expect(remToPx(1.25, 16)).toBe(20);
    expect(FONT_SCALE_STEPS.standard).toBe(20);
    expect(FONT_SCALE_STEPS.large).toBe(25);
    expect(DESIGN_TOKENS.baseFontSize).toBe('1.25rem');
    expect(educationStyles).toContain('--edu-focus-ring: 3px solid');
    expect(educationStyles).toContain(':focus-visible');
    for (const match of educationStyles.matchAll(/font-size:\s*([^;]+);/g)) {
      const value = (match[1] ?? '').trim();
      expect(value, value).not.toMatch(/\d+px/);
      expect(
        value.endsWith('rem') || value.endsWith('em') || value.startsWith('var(') || value === 'inherit',
        value,
      ).toBe(true);
    }
  });

  it('has a logical layout budget for 1280x800 and 1440x900 without horizontal overflow', () => {
    for (const [width, height] of [
      [1280, 800],
      [1440, 900],
    ] as const) {
      const budget = evaluateLayout(width, height, 20);
      expect(budget.fits, `${width}x${height}`).toBe(true);
      expect(budget.horizontalOverflow, `${width}x${height}`).toBe(false);
      expect(budget.mode).toBe('sidebar');
      expect(budget.contentWidthPx).toBeGreaterThanOrEqual(budget.minContentWidthPx);
    }
    const narrow = evaluateLayout(1024, 768, 20);
    expect(narrow.mode).toBe('stacked');
    expect(narrow.fits).toBe(true);
    const largeText = evaluateLayout(1280, 800, 25);
    expect(largeText.fits).toBe(true);
    expect(largeText.horizontalOverflow).toBe(false);
    expect(educationStyles).toContain('grid-template-columns: minmax(0, 1fr)');
    expect(educationStyles).toContain('min-width: 0');
    expect(educationStyles).toContain('overflow-wrap: anywhere');
  });

  it('uses landmarks, a skip link, native controls and a live region', async () => {
    const { container } = await mountShell(fixtureOptions());
    expect(container.querySelector('header')).not.toBeNull();
    expect(container.querySelector('nav[aria-label="主导航"]')).not.toBeNull();
    expect(container.querySelector('main#edu-main')).not.toBeNull();
    expect(container.querySelector('[aria-live="polite"]')).not.toBeNull();
    const focusables = focusableElements(container);
    expect(focusables[0]?.classList.contains('edu-skip-link')).toBe(true);
    for (const control of buttonsOf(container)) {
      expect(control.type).toBe('button');
      expect(control.tabIndex).toBeGreaterThanOrEqual(0);
    }
    for (const select of container.querySelectorAll('select')) {
      const labelled =
        select.hasAttribute('aria-label') ||
        (select.id.length > 0 && container.querySelector(`label[for="${select.id}"]`) !== null);
      expect(labelled, select.id).toBe(true);
    }
  });

  it('keeps colour from being the only status carrier', async () => {
    const { container } = await mountShell(fixtureOptions('ready', '/records'));
    const chips = [...pageRoot(container).querySelectorAll<HTMLElement>('.edu-chip')];
    expect(chips.length).toBeGreaterThan(3);
    for (const chip of chips) {
      expect((chip.textContent ?? '').trim().length).toBeGreaterThan(0);
      expect(chip.dataset['statusLabel']?.length).toBeGreaterThan(0);
      expect(chip.getAttribute('data-tone')).not.toBeNull();
    }
  });

  it('traps Tab inside a confirmation dialog, closes on Escape and restores focus', async () => {
    const { container } = await mountShell(fixtureOptions('ready', '/records'));
    buttonByAction(container, 'export-records').click();
    const dialog = container.querySelector<HTMLElement>('[data-edu-dialog="default"]');
    expect(dialog).not.toBeNull();
    const focusables = [...(dialog as HTMLElement).querySelectorAll<HTMLButtonElement>('button')];
    expect(focusables.length).toBeGreaterThanOrEqual(2);
    const first = focusables[0]!;
    const last = focusables[focusables.length - 1]!;
    last.focus();
    dispatchKey(last, 'Tab');
    expect(document.activeElement).toBe(first);
    dispatchKey(first, 'Escape');
    expect((dialog as HTMLElement).hasAttribute('hidden')).toBe(true);
    expect(buttonByAction(container, 'export-records')).toBe(document.activeElement);
    await tick(0);
    expect(textOf(container)).toContain('记录');
  });
});
