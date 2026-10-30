/**
 * Client-side mounting contracts, deliberately aligned with the frozen
 * `education/runtime/src/pages.ts` PageDefinition shape:
 *   { id, path, title, requiresLearner, mount(context), unmount() }
 *
 * The container is a real HTMLElement here because the shell owns the DOM; the
 * runtime contract keeps it opaque. Field names and lifecycle order match, so a
 * T13 composition root can adapt the same objects without a second protocol.
 */

import type { Clock, HostPort, Id, IdGenerator } from '@edu/domain';
import type { ShellDataSource } from './data/types.js';
import type { EducationShellApi, EducationShellViewState } from './shell-state.js';

export interface EducationPageContext {
  readonly container: HTMLElement;
  readonly services: EducationShellServices;
  readonly navigate: (path: string) => void;
}

export interface EducationPage {
  readonly id: string;
  readonly path: string;
  readonly title: string;
  readonly requiresLearner: boolean;
  /** Built-in fallbacks are replaced by a real T09/T10/T12 page with the same path. */
  readonly fallback?: boolean;
  mount(context: EducationPageContext): void | Promise<void>;
  unmount(): void | Promise<void>;
}

export const SHELL_SLOT_NAMES = [
  'library:content',
  'library:import',
  'map:content',
  'map:details',
  'study:activity',
  'study:feedback',
  'study:visuals',
] as const;

export type ShellSlotName = (typeof SHELL_SLOT_NAMES)[number];

export interface ShellPanel {
  readonly id: string;
  mount(context: EducationPageContext): void | Promise<void>;
  unmount?(): void | Promise<void>;
}

export interface ShellSlotRegistry {
  register(name: ShellSlotName, panel: ShellPanel): () => void;
  list(name: ShellSlotName): readonly ShellPanel[];
}

export interface EducationShellServices {
  readonly data: ShellDataSource;
  readonly shell: EducationShellApi;
  readonly clock: Clock;
  readonly ids: IdGenerator;
  /** Bound after the local learner profile is loaded; never a model-account id. */
  readonly learnerId: Id | null;
  readonly host: HostPort | null;
  readonly slots: ShellSlotRegistry;
  getState(): Readonly<EducationShellViewState>;
}
