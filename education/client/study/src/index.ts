/**
 * @edu/client-study public API.
 *
 * Usage (T13 composition root):
 *   const study = createStudyUi({ dataSource, createRequest, returnPath });
 *   study.register(shell);
 */

import type { RequestContext } from '@edu/domain';
import type { EducationShell, ShellPanel } from '../../shell/src/index.js';
import { nextRequestId } from '../../shell/src/request-ids.js';
import { StudyController, type StudyControllerOptions } from './controller.js';
import { createStudyPage } from './page.js';
import { createFixtureStudyDataSource, type FixtureStudyOptions } from './fixture.js';
import type { StudyDataSource } from './types.js';

export * from './types.js';
export * from './labels.js';
export * from './machine.js';
export * from './styles.js';
export * from './source-view.js';
export * from './fixture.js';
export * from './controller.js';
export * from './page.js';

export interface CreateStudyUiOptions {
  readonly dataSource?: StudyDataSource;
  readonly createRequest?: () => RequestContext;
  readonly returnPath?: string | null;
  readonly fixtureScenario?: FixtureStudyOptions['scenario'];
}

export interface StudyUi {
  readonly page: ReturnType<typeof createStudyPage>;
  readonly panels: readonly {
    readonly name: 'study:activity' | 'study:feedback';
    readonly panel: ShellPanel;
  }[];
  readonly controller: StudyController;
  readonly dataSource: StudyDataSource;
  register(shell: EducationShell): () => void;
}

function defaultRequestFactory(): () => RequestContext {
  // 每次刷新页面计数器都从 1 重数，而学习记录按 requestId 去重；复用旧 id 会让
  // 新作答被当成重发而丢弃（线上事故）。requestId 必须跨刷新唯一。
  return () => ({
    requestId: nextRequestId('request.study'),
    learnerId: 'learner.local.default',
    now: new Date().toISOString(),
  });
}

export function createStudyUi(options: CreateStudyUiOptions = {}): StudyUi {
  const dataSource = options.dataSource ?? createFixtureStudyDataSource({ scenario: options.fixtureScenario });
  const controllerOptions: StudyControllerOptions = {
    dataSource,
    createRequest: options.createRequest ?? defaultRequestFactory(),
    returnPath: options.returnPath ?? null,
  };
  const controller = new StudyController(controllerOptions);
  const page = createStudyPage(controller);
  const activityPanel: ShellPanel = {
    id: 'study-activity',
    mount(context) {
      controller.mountActivity(context.container);
    },
    unmount() {
      /* page unmount releases the controller renderers */
    },
  };
  const feedbackPanel: ShellPanel = {
    id: 'study-feedback',
    mount(context) {
      controller.mountFeedback(context.container);
    },
    unmount() {
      /* page unmount releases the controller renderers */
    },
  };
  const panels = [
    { name: 'study:activity' as const, panel: activityPanel },
    { name: 'study:feedback' as const, panel: feedbackPanel },
  ];
  return {
    page,
    panels,
    controller,
    dataSource,
    register(shell: EducationShell) {
      shell.registerPage(page);
      const offs = panels.map((entry) => shell.registerPanel(entry.name, entry.panel));
      return () => {
        for (const off of offs) off();
      };
    },
  };
}
