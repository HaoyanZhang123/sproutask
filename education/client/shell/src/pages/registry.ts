/** Page registry for the shell (aligned with runtime PageRegistry semantics). */

import type { EducationPage, EducationPageContext } from '../contracts.js';

export class PageRegistryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PageRegistryError';
  }
}

export class EducationPageRegistry {
  private readonly pages = new Map<string, EducationPage>();
  private readonly byPath = new Map<string, EducationPage>();

  register(page: EducationPage): void {
    if (page.id.trim().length === 0) throw new PageRegistryError('page id must not be empty');
    if (page.title.trim().length === 0) throw new PageRegistryError(`page ${page.id} title must not be empty`);
    if (!page.path.startsWith('/')) {
      throw new PageRegistryError(`page ${page.id} path must start with "/"`);
    }
    const existingId = this.pages.get(page.id) ?? null;
    const existingPath = this.byPath.get(page.path) ?? null;

    if (existingId !== null && existingId !== page) {
      if (existingId.fallback === true && page.fallback !== true) {
        this.pages.delete(existingId.id);
        this.byPath.delete(existingId.path);
      } else {
        throw new PageRegistryError(`duplicate page id: ${page.id}`);
      }
    }
    if (existingPath !== null && existingPath !== page) {
      if (existingPath.fallback === true && page.fallback !== true) {
        this.pages.delete(existingPath.id);
        this.byPath.delete(existingPath.path);
      } else {
        throw new PageRegistryError(`duplicate page path: ${page.path}`);
      }
    }

    this.pages.set(page.id, page);
    this.byPath.set(page.path, page);
  }

  list(): readonly EducationPage[] {
    return [...this.pages.values()];
  }

  resolve(path: string): EducationPage | undefined {
    return this.byPath.get(path);
  }

  get(id: string): EducationPage | undefined {
    return this.pages.get(id);
  }

  async mount(id: string, context: EducationPageContext): Promise<void> {
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
