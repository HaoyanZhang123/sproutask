import type { RequestContext } from '@edu/domain';
import {
  EducationShell,
  createFixtureShellDataSource,
} from '../../shell/src/index.js';
import {
  createFixtureStudyDataSource,
  createStudyUi,
  type FixtureStudyDataSource,
  type StudyDataSource,
  type StudyScenario,
  type StudyUi,
} from '../src/index.js';

export interface MountedStudy {
  readonly shell: EducationShell;
  readonly container: HTMLElement;
  readonly study: StudyUi;
  readonly data: StudyDataSource;
  readonly ready: Promise<void>;
}

const tracked: MountedStudy[] = [];
let requestCounter = 0;

export function makeRequest(): RequestContext {
  requestCounter += 1;
  return {
    requestId: `request.test.study.${requestCounter}`,
    learnerId: 'learner.local.default',
    now: '2026-10-29T10:00:00Z',
  };
}

export function makeContainer(): HTMLElement {
  const container = document.createElement('div');
  document.body.append(container);
  return container;
}

export function startStudy(options: {
  readonly scenario?: StudyScenario;
  readonly dataSource?: StudyDataSource;
  readonly path?: string;
  readonly returnPath?: string | null;
} = {}): MountedStudy {
  const data = options.dataSource ?? createFixtureStudyDataSource({ scenario: options.scenario });
  const study = createStudyUi({
    dataSource: data,
    createRequest: makeRequest,
    returnPath: options.returnPath ?? '/workspace?mode=learn&concept=concept.cell',
  });
  const shell = new EducationShell({
    data: createFixtureShellDataSource(),
    initialPath: options.path ?? '/workspace?concept=concept.cell&mode=learn',
  });
  study.register(shell);
  const container = makeContainer();
  const ready = shell.mount(container);
  const mounted: MountedStudy = { shell, container, study, data, ready };
  tracked.push(mounted);
  return mounted;
}

export async function mountStudy(options: Parameters<typeof startStudy>[0] = {}): Promise<MountedStudy> {
  const mounted = startStudy(options);
  await mounted.ready;
  await tick(30);
  return mounted;
}

export async function cleanupStudies(): Promise<void> {
  for (const entry of tracked.splice(0)) {
    try {
      await entry.shell.unmount();
    } catch {
      /* already unmounted */
    }
  }
  document.body.replaceChildren();
}

export function tick(ms = 0): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function textOf(root: ParentNode): string {
  return (root.textContent ?? '').replace(/\s+/g, ' ').trim();
}

export function pageRoot(container: HTMLElement): HTMLElement {
  const page = container.querySelector<HTMLElement>('[data-page-id]');
  if (page === null) throw new Error('page root not found');
  return page;
}

export function buttonsOf(root: ParentNode): HTMLButtonElement[] {
  return [...root.querySelectorAll<HTMLButtonElement>('button')];
}

export function buttonByAction(root: ParentNode, action: string): HTMLButtonElement {
  const found = root.querySelector<HTMLButtonElement>(`button[data-action="${action}"]`);
  if (found === null) throw new Error(`button not found: ${action}`);
  return found;
}

export function buttonByText(root: ParentNode, label: string): HTMLButtonElement {
  const found = buttonsOf(root).find((candidate) => (candidate.textContent ?? '').trim() === label);
  if (found === undefined) throw new Error(`button not found by text: ${label}`);
  return found;
}

export function textarea(root: ParentNode): HTMLTextAreaElement {
  const found = root.querySelector<HTMLTextAreaElement>('textarea[aria-label="你的回答"]');
  if (found === null) throw new Error('answer textarea not found');
  return found;
}

export function setAnswer(root: ParentNode, value: string): void {
  const input = textarea(root);
  input.value = value;
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

export function submitAnswer(root: ParentNode): void {
  buttonByText(root, '提交作答').click();
}

export function dispatchKey(target: EventTarget, key: string, options: KeyboardEventInit = {}): void {
  target.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...options }));
}

/** happy-dom 没有布局引擎，视口宽度要先写进 window 再做窄屏判断。 */
export function setViewportWidth(width: number, height = 900): void {
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: width });
  Object.defineProperty(window, 'innerHeight', { configurable: true, value: height });
}

export function byTestId<T extends HTMLElement = HTMLElement>(root: ParentNode, testId: string): T {
  const found = root.querySelector<T>(`[data-testid="${testId}"]`);
  if (found === null) throw new Error(`test id not found: ${testId}`);
  return found;
}

/** 点开右下角「问小芽」，返回对话层。 */
export function openSprout(container: HTMLElement): HTMLElement {
  byTestId<HTMLButtonElement>(container, 'ask-sprout-pill').click();
  return byTestId(container, 'sprout-sheet');
}

export function dispatchKeyOn(target: EventTarget, key: string, options: KeyboardEventInit = {}): void {
  target.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...options }));
}

/**
 * 学生界面禁词（AGENTS.md 红线 + 学习台设计约定）。
 * 只扫学生能看到的文字，不在测试里扫描源码。
 */
export const FORBIDDEN_STUDENT_WORDS =
  /内容包|activity\.|source\.|step-|三轴|证据候选|基准|回环|受控|返回位置|本地保存|当前概念|掌握百分比|覆盖率|评分版本|答案键|系统证据|不替代|单独保存|criterion|PDF|页序|1 基|印刷页码/;

export function expectCleanStudentCopy(root: ParentNode): void {
  const value = textOf(root);
  const hit = value.match(FORBIDDEN_STUDENT_WORDS);
  if (hit !== null) throw new Error(`student copy contains forbidden word: ${hit[0]}`);
}
