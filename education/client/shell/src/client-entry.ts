/**
 * DSH client-loader seam for the education root.
 *
 * T00 froze the client protocol: `package.json dsh.client { platform: 'web' }`,
 * an `exports['./client']` bundle and `ctx.slots.register({name:'root'}, occupant)`.
 * T08 deliberately keeps the React bridge and the loader bundle out of this
 * package: `host.createRootOccupant` is the single adapter T13 must implement
 * (a React component that renders the returned DOM container and calls the
 * supplied mount function inside an effect). Everything below the adapter is
 * framework-agnostic and covered by the shell tests.
 */

import {
  mountEducationShell,
  type EducationShellController,
  type EducationShellOptions,
} from './shell.js';

export const EDUCATION_ROOT_SLOT = { name: 'root', locale: 'common' } as const;

export interface SlotsLike {
  register(selector: typeof EDUCATION_ROOT_SLOT, occupant: unknown): void;
}

export interface EducationRootHost {
  /**
   * Returns the host's root occupant. The mount callback is called with the
   * real DOM container; the adapter owns teardown by calling the controller's
   * unmount (or the plugin `dispose`).
   */
  createRootOccupant(
    mount: (container: HTMLElement) => Promise<EducationShellController>,
  ): unknown;
}

export interface EducationRootRegistration {
  readonly controller: () => EducationShellController | null;
  dispose(): Promise<void>;
}

export function registerEducationRoot(
  slots: SlotsLike,
  host: EducationRootHost,
  options: EducationShellOptions,
): EducationRootRegistration {
  let controller: EducationShellController | null = null;
  const occupant = host.createRootOccupant(async (container) => {
    const mounted = mountEducationShell(container, options);
    controller = mounted;
    await mounted.ready;
    return mounted;
  });
  slots.register(EDUCATION_ROOT_SLOT, occupant);
  return {
    controller: () => controller,
    async dispose() {
      if (controller !== null) await controller.unmount();
      controller = null;
    },
  };
}

export interface EducationClientPlugin {
  readonly inject: readonly ['slots'];
  apply(context: { readonly slots: SlotsLike }): void;
  dispose(): Promise<void>;
}

export function createEducationRootPlugin(
  host: EducationRootHost,
  options: EducationShellOptions,
): EducationClientPlugin {
  let registration: EducationRootRegistration | null = null;
  return {
    inject: ['slots'],
    apply(context) {
      registration = registerEducationRoot(context.slots, host, options);
    },
    async dispose() {
      await registration?.dispose();
      registration = null;
    },
  };
}
