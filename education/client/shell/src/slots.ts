/** Named mount points for visual/study panels (T11 / T12 and future pages). */

import {
  SHELL_SLOT_NAMES,
  type ShellPanel,
  type ShellSlotName,
  type ShellSlotRegistry,
} from './contracts.js';

export class SlotRegistryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SlotRegistryError';
  }
}

export class EducationSlotRegistry implements ShellSlotRegistry {
  private readonly panels = new Map<ShellSlotName, ShellPanel[]>();

  constructor() {
    for (const name of SHELL_SLOT_NAMES) this.panels.set(name, []);
  }

  register(name: ShellSlotName, panel: ShellPanel): () => void {
    if (!(SHELL_SLOT_NAMES as readonly string[]).includes(name)) {
      throw new SlotRegistryError(`unknown shell slot: ${String(name)}`);
    }
    if (panel.id.trim().length === 0) throw new SlotRegistryError('panel id must not be empty');
    const list = this.panels.get(name) as ShellPanel[];
    if (list.some((entry) => entry.id === panel.id)) {
      throw new SlotRegistryError(`duplicate panel id in ${name}: ${panel.id}`);
    }
    list.push(panel);
    return () => {
      const index = list.indexOf(panel);
      if (index >= 0) list.splice(index, 1);
    };
  }

  list(name: ShellSlotName): readonly ShellPanel[] {
    return [...(this.panels.get(name) ?? [])];
  }
}
