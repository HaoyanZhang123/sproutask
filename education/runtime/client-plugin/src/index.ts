/// <reference lib="dom" />
/**
 * Education client root for the fixed DSH client loader.
 *
 * T13 second round: the shell and the three accepted page packages are mounted
 * with live HTTP data sources backed by the education host routes. No fixture
 * source is used in this entry.
 */

import * as React from 'react';
import {
  registerEducationRoot,
  type EducationRootHost,
  type EducationShellController,
} from '@edu/client-shell';
import { createLibraryUi } from '../../../client/library/src/index.js';
import { createMapUi } from '../../../client/map/src/index.js';
import { createStudyUi } from '../../../client/study/src/index.js';
import {
  createLiveLibraryDataSource,
  createLiveMapDataSource,
  createLiveShellDataSource,
  createLiveStudyDataSource,
} from './live-sources.js';

export const inject = ['slots'] as const;

export const EDUCATION_ROOT_TITLE = '教育学习工作区';

interface ShellRef {
  current: HTMLDivElement | null;
}

let controllerRef: EducationShellController | null = null;
let pagesRegistered = false;

function registerLivePages(controller: EducationShellController): void {
  if (pagesRegistered) return;
  pagesRegistered = true;
  const shell = controller.shell;
  createLibraryUi({ dataSource: createLiveLibraryDataSource() }).register(shell);
  createMapUi({ dataSource: createLiveMapDataSource() }).register(shell);
  createStudyUi({ dataSource: createLiveStudyDataSource() }).register(shell);
}

function createReactRootHost(): EducationRootHost {
  return {
    createRootOccupant(mount: (container: HTMLElement) => Promise<EducationShellController>) {
      return function EducationRootOccupant(): React.ReactElement {
        const ref = React.useRef<HTMLDivElement | null>(null);
        React.useEffect(() => {
          const element = ref.current;
          if (element === null) return;
          let disposed = false;
          let controller: EducationShellController | null = null;
          void mount(element).then(async (mounted) => {
            if (disposed) {
              await mounted.unmount();
              return;
            }
            controller = mounted;
            controllerRef = mounted;
            await mounted.ready;
            registerLivePages(mounted);
          });
          return () => {
            disposed = true;
            if (controller !== null) {
              controllerRef = null;
              void controller.unmount();
            }
          };
        }, []);
        return React.createElement('div', {
          id: 'edu-education-root',
          'data-edu-root': 't13-live',
          style: { minHeight: '100vh' },
          ref: ref as React.RefObject<HTMLDivElement>,
        });
      };
    },
  };
}

let registration: ReturnType<typeof registerEducationRoot> | null = null;

export function apply(context: { readonly slots: unknown }): void {
  document.title = EDUCATION_ROOT_TITLE;
  const style = document.createElement('style');
  style.dataset['eduLiveStyle'] = 'true';
  // The accepted library page always renders its fixture import panel; the live
  // G1 build has no browser file-picker/import route, so keep that panel out of
  // the real UI instead of showing a fixture-looking import control.
  style.textContent = '[data-testid="library-import-panel"],[data-testid="library-fixture-notice"]{display:none!important}';
  document.head.append(style);
  registration = registerEducationRoot(
    context.slots as never,
    createReactRootHost(),
    { data: createLiveShellDataSource(), initialPath: '/home' },
  );
}

export async function dispose(): Promise<void> {
  pagesRegistered = false;
  controllerRef = null;
  if (registration !== null) {
    await registration.dispose();
    registration = null;
  }
}

export type { ShellRef };
