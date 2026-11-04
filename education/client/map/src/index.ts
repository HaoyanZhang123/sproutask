/**
 * @edu/client-map public API.
 *
 * Usage (T13 composition root):
 *   const map = createMapUi({ dataSource: createFixtureMapDataSource() });
 *   map.register(shell);            // replaces the /map fallback page
 *
 * The data source is the only seam: the fixture source below is explicitly
 * labelled 演示数据（fixture）; the live facade must implement the same
 * `MapDataSource` shape on top of `@edu/knowledge` and the learner store.
 */

import type { RequestContext } from '@edu/domain';
import type { EducationShell, ShellPanel } from '../../shell/src/index.js';
import { MapController, type MapControllerOptions, type MapTimings } from './controller.js';
import { createMapPage } from './page.js';
import { createFixtureMapDataSource, type MapScenario } from './fixture.js';
import type { MapDataSource, MapRequest } from './types.js';

export * from './types.js';
export * from './model.js';
export * from './layout.js';
export * from './views.js';
export * from './fixture.js';
export * from './styles.js';
export * from './controller.js';
export * from './page.js';

export interface CreateMapUiOptions {
  readonly dataSource?: MapDataSource;
  readonly createRequest?: () => MapRequest;
  /** Fixed viewport width for tests; production reads the real window width. */
  readonly viewportWidth?: number;
  /** Only used when no `dataSource` is supplied. */
  readonly fixtureScenario?: MapScenario;
}

export interface MapUi {
  readonly page: ReturnType<typeof createMapPage>;
  readonly panels: readonly {
    readonly name: 'map:content' | 'map:details';
    readonly panel: ShellPanel;
  }[];
  readonly controller: MapController;
  readonly dataSource: MapDataSource;
  getTimings(): MapTimings;
  /** Registers the page and both panels; returns a panel cleanup function. */
  register(shell: EducationShell): () => void;
}

function defaultRequestFactory(): () => MapRequest {
  let counter = 0;
  return () => {
    counter += 1;
    return {
      requestId: `request.map.${counter}`,
      learnerId: 'learner.local.default',
      now: new Date().toISOString(),
    };
  };
}

/** Narrow helper for T13: adapt a domain RequestContext factory if needed. */
export function requestFactoryFrom(
  create: () => RequestContext,
): () => MapRequest {
  return () => create();
}

export function createMapUi(options: CreateMapUiOptions = {}): MapUi {
  const dataSource = options.dataSource ?? createFixtureMapDataSource({ scenario: options.fixtureScenario });
  const controllerOptions: MapControllerOptions = {
    dataSource,
    createRequest: options.createRequest ?? defaultRequestFactory(),
    viewportWidth: options.viewportWidth,
  };
  const controller = new MapController(controllerOptions);
  const page = createMapPage(controller);
  const contentPanel: ShellPanel = {
    id: 'map-content',
    mount(context) {
      controller.mountContent(context.container);
    },
    unmount() {
      controller.unmountContent();
    },
  };
  const detailsPanel: ShellPanel = {
    id: 'map-details',
    mount(context) {
      controller.mountDetails(context.container);
    },
    unmount() {
      controller.unmountDetails();
    },
  };
  const panels = [
    { name: 'map:content' as const, panel: contentPanel },
    { name: 'map:details' as const, panel: detailsPanel },
  ];
  return {
    page,
    panels,
    controller,
    dataSource,
    getTimings: () => controller.getTimings(),
    register(shell: EducationShell) {
      shell.registerPage(page);
      const offs = panels.map((entry) => shell.registerPanel(entry.name, entry.panel));
      return () => {
        for (const off of offs) off();
      };
    },
  };
}
