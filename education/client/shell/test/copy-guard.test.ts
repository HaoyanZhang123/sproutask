import { afterEach, describe, expect, it } from 'vitest';
import { cleanupShells, fixtureOptions, mountShell, pageRoot, textOf } from './helpers.js';

afterEach(cleanupShells);

/**
 * 学生界面文案守卫：这些词是给开发/验收看的，不该出现在学生面前。
 * 例外：`未核实` 是给学生的必要提示，允许保留。
 */
const BANNED = [
  /内容包/,
  /activity\./,
  /source\./,
  /step-\d/,
  /三轴/,
  /证据候选/,
  /基准/,
  /回环/,
  /\brem\b/,
  /受控/,
  /返回位置/,
  /本地保存/,
  /当前概念/,
  /掌握百分比/,
  /覆盖率/,
  /评分版本/,
  /工具调用/,
  /插件市场/,
  /开发者工具/,
];

const ROUTES = ['/home', '/records', '/account', '/first-run', '/library', '/map', '/workspace'] as const;

describe('student-facing copy guard', () => {
  for (const route of ROUTES) {
    it(`renders no internal jargon on ${route}`, async () => {
      const { container } = await mountShell(fixtureOptions('ready', route));
      const text = textOf(pageRoot(container));
      for (const pattern of BANNED) {
        expect(text, `${route} matched ${pattern}`).not.toMatch(pattern);
      }
    });
  }

  it('keeps the generic shell chrome free of developer state', async () => {
    const { container } = await mountShell(fixtureOptions('ready', '/home'));
    const header = textOf(container.querySelector('header') as HTMLElement);
    expect(header).not.toMatch(/内容包|本地保存|返回位置|当前概念/);
  });
});
