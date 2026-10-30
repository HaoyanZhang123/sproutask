import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createSlotPanel, registerVisualsPanels, type PanelRegistryLike, type ShellPanelLike } from '../src/panels.js';

describe('shell slot panels (T12 integration seam)', () => {
  let container: HTMLElement;
  beforeEach(() => {
    document.body.innerHTML = '';
    container = document.createElement('div');
    document.body.append(container);
  });

  it('registers the two study slots without duplicating ids', () => {
    const registered: { name: string; panel: ShellPanelLike }[] = [];
    const registry: PanelRegistryLike = {
      register(name, panel) {
        registered.push({ name, panel });
        return () => undefined;
      },
    };
    registerVisualsPanels(registry, {
      visuals: { render: (host) => { host.textContent = 'diagram panel'; } },
      feedback: { render: (host) => { host.textContent = 'feedback panel'; } },
    });
    expect(registered.map((entry) => entry.name)).toEqual(['study:visuals', 'study:feedback']);
    expect(registered.map((entry) => entry.panel.id)).toEqual([
      '@edu/client-visuals:diagram',
      '@edu/client-visuals:feedback',
    ]);
  });

  it('mounts a controller into the slot container and cleans up on unmount', async () => {
    const cleanup = vi.fn();
    const panel = createSlotPanel('@edu/client-visuals:diagram', {
      render(host) {
        const node = document.createElement('p');
        node.textContent = '渲染完成';
        host.append(node);
        return cleanup;
      },
    });
    await panel.mount({ container });
    expect(container.textContent).toBe('渲染完成');
    await panel.unmount?.();
    expect(cleanup).toHaveBeenCalledTimes(1);
  });

  it('does not throw when a controller returns no cleanup function', async () => {
    const panel = createSlotPanel('@edu/client-visuals:feedback', {
      render(host) {
        host.textContent = '无清理函数';
      },
    });
    await panel.mount({ container });
    expect(container.textContent).toBe('无清理函数');
    await expect(Promise.resolve(panel.unmount?.())).resolves.toBeUndefined();
  });
});
