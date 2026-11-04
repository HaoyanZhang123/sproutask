import { afterEach, describe, expect, it } from 'vitest';
import {
  EducationPageRegistry,
  PageRegistryError,
  createEducationRootPlugin,
  createFixtureShellDataSource,
  type EducationPage,
  type EducationPageContext,
  type EducationShellController,
  type EducationShellServices,
} from '../src/index.js';
import { h } from '../src/dom.js';
import { cleanupShells, fixtureOptions, makeContainer, mountShell, pageRoot, textOf, tick } from './helpers.js';

afterEach(cleanupShells);

interface RuntimePageContextLike {
  readonly container: unknown;
  readonly services: unknown;
  readonly navigate: (path: string) => void;
}

interface RuntimePageLike {
  readonly id: string;
  readonly path: string;
  readonly title: string;
  readonly requiresLearner: boolean;
  mount(context: RuntimePageContextLike): void | Promise<void>;
  unmount(): void | Promise<void>;
}

describe('page and panel mounting contracts', () => {
  it('matches the frozen runtime PageDefinition shape and mounts with a real container', async () => {
    const { shell } = await mountShell(fixtureOptions());
    const calls: string[] = [];
    const page: EducationPage = {
      id: 't09-library',
      path: '/library',
      title: '教材库',
      requiresLearner: false,
      mount(context: EducationPageContext) {
        calls.push('mount');
        expect(context.container).toBeInstanceOf(HTMLElement);
        expect(typeof context.navigate).toBe('function');
        expect(context.services.getState().snapshot).not.toBeNull();
        context.container.append(h('h1', { 'data-testid': 'contract-page' }, '教材库页面'));
      },
      unmount() {
        calls.push('unmount');
      },
    };
    const runtimeCompatible: RuntimePageLike = page;
    expect(runtimeCompatible.path).toBe('/library');
    shell.registerPage(page);
    await shell.navigate('/library');
    expect(calls).toEqual(['mount']);
    expect(pageRoot(document.body).querySelector('[data-testid="contract-page"]')).not.toBeNull();
    await shell.navigate('/home');
    expect(calls).toEqual(['mount', 'unmount']);
    expect((pageRoot(document.body) as HTMLElement).textContent).toContain('今天');
  });

  it('rejects duplicate ids/paths and malformed paths', () => {
    const registry = new EducationPageRegistry();
    const page: EducationPage = {
      id: 'a',
      path: '/a',
      title: 'A',
      requiresLearner: false,
      mount() {},
      unmount() {},
    };
    registry.register(page);
    expect(() => registry.register({ ...page, path: '/b' })).toThrow(PageRegistryError);
    expect(() => registry.register({ ...page, id: 'b' })).toThrow(PageRegistryError);
    expect(() =>
      registry.register({ ...page, id: 'c', path: 'no-slash' }),
    ).toThrow(PageRegistryError);
  });

  it('replaces a built-in fallback page with the same path and re-renders it immediately', async () => {
    const { shell, container } = await mountShell(fixtureOptions('ready', '/library'));
    expect(pageRoot(container).querySelector('[data-testid="library-fallback"]')).not.toBeNull();
    shell.registerPage({
      id: 'real-library',
      path: '/library',
      title: '教材库',
      requiresLearner: false,
      mount(context) {
        context.container.append(h('h1', { 'data-testid': 'real-library' }, '真实教材库'));
      },
      unmount() {},
    });
    await tick(10);
    expect(pageRoot(container).querySelector('[data-testid="real-library"]')).not.toBeNull();
  });

  it('mounts T11 panels into the study slot with the page context', async () => {
    const { shell, container } = await mountShell(fixtureOptions());
    let services: EducationShellServices | null = null;
    const off = shell.registerPanel('study:visuals', {
      id: 'visuals',
      mount(context) {
        services = context.services;
        context.container.append(h('p', { 'data-testid': 'panel-content' }, 'visuals'));
      },
    });
    await shell.navigate('/workspace');
    expect(services).not.toBeNull();
    expect(container.querySelector('[data-testid="panel-content"]')).not.toBeNull();
    off();
    await shell.navigate('/home');
  });

  it('provides a root registration seam that hands a DOM container to T13 without React in this package', async () => {
    let mountRoot: ((container: HTMLElement) => Promise<EducationShellController>) | null = null;
    const registrations: { selector: unknown; occupant: unknown }[] = [];
    const plugin = createEducationRootPlugin(
      {
        createRootOccupant(mount) {
          mountRoot = mount;
          return { kind: 'fake-root-occupant' };
        },
      },
      { data: createFixtureShellDataSource(), initialPath: '/home' },
    );
    plugin.apply({
      slots: {
        register(selector, occupant) {
          registrations.push({ selector, occupant });
        },
      },
    });
    expect(registrations).toHaveLength(1);
    expect(registrations[0]?.selector).toEqual({ name: 'root', locale: 'common' });
    expect(mountRoot).not.toBeNull();
    const container = makeContainer();
    const controller = await (mountRoot as unknown as (c: HTMLElement) => Promise<EducationShellController>)(container);
    expect(controller.shell.getState().snapshot?.fixture).toBe(true);
    expect(container.querySelector('[data-edu-shell]')).not.toBeNull();
    await plugin.dispose();
    expect(container.children.length).toBe(0);
    expect(textOf(document.body)).not.toContain('终端');
  });
});
