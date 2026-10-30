/**
 * Framework agnostic page registry (04 root plugin boundary, 06 §2).
 *
 * The client root framework is frozen by T00.runtimeReady; until then pages are
 * plain lifecycle objects. The container is intentionally opaque here so no
 * React/Vue type leaks into the runtime contract.
 */

import type { EducationServices } from './registry.js';

export interface PageMountContext {
  /** Host provided container (DOM element, shadow root, etc.). */
  readonly container: unknown;
  readonly services: EducationServices;
  readonly navigate: (path: string) => void;
}

export interface PageDefinition {
  readonly id: string;
  readonly path: string;
  readonly title: string;
  readonly requiresLearner: boolean;
  mount(context: PageMountContext): void | Promise<void>;
  unmount(): void | Promise<void>;
}

export class PageRegistryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PageRegistryError';
  }
}

export class PageRegistry {
  private readonly pages = new Map<string, PageDefinition>();
  private readonly byPath = new Map<string, PageDefinition>();

  register(page: PageDefinition): void {
    if (page.id.trim().length === 0) throw new PageRegistryError('page id must not be empty');
    if (!page.path.startsWith('/')) {
      throw new PageRegistryError(`page ${page.id} path must start with "/"`);
    }
    if (this.pages.has(page.id)) {
      throw new PageRegistryError(`duplicate page id: ${page.id}`);
    }
    if (this.byPath.has(page.path)) {
      throw new PageRegistryError(`duplicate page path: ${page.path}`);
    }
    this.pages.set(page.id, page);
    this.byPath.set(page.path, page);
  }

  list(): readonly PageDefinition[] {
    return [...this.pages.values()];
  }

  resolve(path: string): PageDefinition | undefined {
    return this.byPath.get(path);
  }

  async mount(id: string, context: PageMountContext): Promise<void> {
    const page = this.pages.get(id);
    if (page === undefined) throw new PageRegistryError(`unknown page: ${id}`);
    await page.mount(context);
  }

  async unmount(id: string): Promise<void> {
    const page = this.pages.get(id);
    if (page === undefined) throw new PageRegistryError(`unknown page: ${id}`);
    await page.unmount();
  }
}
