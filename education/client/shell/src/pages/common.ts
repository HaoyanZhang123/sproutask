/** Small helpers shared by the built-in pages. */

import type { Concept, ConceptProgress, LearningState, UnderstandingState } from '@edu/domain';
import type { EducationPage, EducationPageContext } from '../contracts.js';
import { h } from '../dom.js';

export interface BuiltInPageInput {
  readonly id: string;
  readonly path: string;
  readonly title: string;
  readonly requiresLearner: boolean;
  readonly fallback?: boolean;
  mount(container: HTMLElement, context: EducationPageContext): void | Promise<void>;
  unmount?(): void | Promise<void>;
}

export function definePage(input: BuiltInPageInput): EducationPage {
  let active = false;
  return {
    id: input.id,
    path: input.path,
    title: input.title,
    requiresLearner: input.requiresLearner,
    fallback: input.fallback,
    async mount(context) {
      active = true;
      const container = context.container as HTMLElement;
      await input.mount(container, context);
      return undefined;
    },
    async unmount() {
      if (!active) return;
      active = false;
      await input.unmount?.();
    },
  };
}

export function pageHeading(title: string, lead?: string): HTMLElement {
  return h(
    'header',
    { class: 'edu-page__header' },
    h('h1', { class: 'edu-page__title', tabindex: -1 }, title),
    lead !== undefined ? h('p', { class: 'edu-page__lead' }, lead) : null,
  );
}

export function conceptTitle(concepts: readonly Concept[], conceptId: string): string {
  return concepts.find((concept) => concept.id === conceptId)?.title ?? conceptId;
}

export function conceptById(concepts: readonly Concept[], conceptId: string): Concept | null {
  return concepts.find((concept) => concept.id === conceptId) ?? null;
}

export function learningTone(state: LearningState): 'neutral' | 'progress' | 'positive' {
  if (state === 'completed') return 'positive';
  if (state === 'in_progress') return 'progress';
  return 'neutral';
}

export function understandingTone(state: UnderstandingState): 'neutral' | 'attention' | 'progress' | 'positive' {
  if (state === 'supported') return 'positive';
  if (state === 'needs_support') return 'attention';
  if (state === 'developing') return 'progress';
  return 'neutral';
}

export function latestProgress(
  progress: readonly ConceptProgress[],
  conceptId: string,
): ConceptProgress | null {
  return progress.find((entry) => entry.conceptId === conceptId) ?? null;
}

export function section(title: string, lead?: string): { readonly section: HTMLElement; readonly body: HTMLElement } {
  const body = h('div', { class: 'edu-section__body' });
  const element = h(
    'section',
    { class: 'edu-section' },
    h('h2', { class: 'edu-section__title' }, title),
    lead !== undefined ? h('p', { class: 'edu-section__lead' }, lead) : null,
    body,
  );
  return { section: element, body };
}
