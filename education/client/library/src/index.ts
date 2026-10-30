/**
 * @edu/client-library public API.
 *
 * Usage (T13 composition root):
 *   const library = createLibraryUi({ dataSource, createRequest });
 *   library.register(shell);
 */

import type { RequestContext } from '@edu/domain';
import type { EducationShell, ShellPanel } from '../../shell/src/index.js';
import { LibraryController, type LibraryControllerOptions } from './controller.js';
import { createLibraryPage } from './page.js';
import type { LibraryDataSource } from './types.js';

export * from './types.js';
export * from './labels.js';
export * from './styles.js';
export * from './components.js';
export * from './job-model.js';
export * from './fixture-data.js';
export * from './source-reader.js';
export * from './controller.js';
export * from './page.js';

export interface CreateLibraryUiOptions {
  readonly dataSource: LibraryDataSource;
  readonly createRequest?: () => RequestContext;
  readonly returnPath?: string | null;
}

export interface LibraryUi {
  readonly page: ReturnType<typeof createLibraryPage>;
  readonly panels: readonly {
    readonly name: 'library:content' | 'library:import';
    readonly panel: ShellPanel;
  }[];
  readonly controller: LibraryController;
  /** Registers the page and both panels; returns a panel cleanup function. */
  register(shell: EducationShell): () => void;
}

function defaultRequestFactory(): () => RequestContext {
  let counter = 0;
  return () => {
    counter += 1;
    return {
      requestId: `request.library.${counter}`,
      learnerId: 'learner.local.default',
      now: new Date().toISOString(),
    };
  };
}

export function createLibraryUi(options: CreateLibraryUiOptions): LibraryUi {
  const controllerOptions: LibraryControllerOptions = {
    dataSource: options.dataSource,
    createRequest: options.createRequest ?? defaultRequestFactory(),
    returnPath: options.returnPath ?? null,
  };
  const controller = new LibraryController(controllerOptions);
  const page = createLibraryPage(controller);
  const contentPanel: ShellPanel = {
    id: 'library-content',
    mount(context) {
      controller.mountContent(context.container, context);
    },
    unmount() {
      /* controller renderer is released by the page unmount */
    },
  };
  const importPanel: ShellPanel = {
    id: 'library-import',
    mount(context) {
      controller.mountImport(context.container, context);
    },
    unmount() {
      /* import state remains in the controller for the page lifetime */
    },
  };
  const panels = [
    { name: 'library:content' as const, panel: contentPanel },
    { name: 'library:import' as const, panel: importPanel },
  ];
  return {
    page,
    panels,
    controller,
    register(shell: EducationShell) {
      shell.registerPage(page);
      const offs = panels.map((entry) => shell.registerPanel(entry.name, entry.panel));
      return () => {
        for (const off of offs) off();
      };
    },
  };
}
