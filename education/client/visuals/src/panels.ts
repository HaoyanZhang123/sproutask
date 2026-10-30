/**
 * Shell slot panels for `study:visuals` and `study:feedback` (T08 slot contract).
 *
 * T12 owns the study page and passes controllers; this module only adapts them
 * to the `ShellPanel` shape (`{ id, mount(context), unmount() }`) so no package
 * edits the shared host registration.
 */

export type VisualsSlotName = 'study:visuals' | 'study:feedback';

export interface ShellPanelContextLike {
  readonly container: HTMLElement;
}

export interface ShellPanelLike {
  readonly id: string;
  mount(context: ShellPanelContextLike): void | Promise<void>;
  unmount?(): void | Promise<void>;
}

export interface PanelRegistryLike {
  register(name: VisualsSlotName, panel: ShellPanelLike): () => void;
}

/** A controller is any object that knows how to render itself into a container. */
export interface SlotPanelController {
  render(container: HTMLElement): (() => void) | void;
}

export function createSlotPanel(
  id: string,
  controller: SlotPanelController,
): ShellPanelLike {
  let cleanup: (() => void) | null = null;
  return {
    id,
    mount(context) {
      const result = controller.render(context.container);
      cleanup = typeof result === 'function' ? result : null;
    },
    unmount() {
      cleanup?.();
      cleanup = null;
    },
  };
}

export interface VisualsPanels {
  readonly visuals: SlotPanelController;
  readonly feedback: SlotPanelController;
}

/** Registers both panels; returns the unregister functions. */
export function registerVisualsPanels(
  registry: PanelRegistryLike,
  panels: VisualsPanels,
): (() => void)[] {
  return [
    registry.register('study:visuals', createSlotPanel('@edu/client-visuals:diagram', panels.visuals)),
    registry.register('study:feedback', createSlotPanel('@edu/client-visuals:feedback', panels.feedback)),
  ];
}
