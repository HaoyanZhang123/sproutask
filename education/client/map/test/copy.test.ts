import { afterEach, describe, expect, it } from 'vitest';
import {
  buttonByView,
  cleanupMaps,
  hasPercent,
  mountMap,
  openChapter,
  openConcept,
  textOf,
  tick,
} from './helpers.js';

afterEach(cleanupMaps);

const BANNED = [
  '内容包',
  'activity.',
  'source.',
  'step-',
  '三轴',
  '证据候选',
  '基准',
  '回环',
  'rem',
  '受控',
  '返回位置',
  '本地保存',
  '当前概念',
  '掌握百分比',
  '覆盖率',
  '评分版本',
  '工具调用',
];

function expectClean(text: string, where: string): void {
  for (const word of BANNED) {
    expect(text, `${where} 出现禁词 ${word}`).not.toContain(word);
  }
  expect(hasPercent(text), `${where} 出现百分比`).toBe(false);
}

describe('student-facing copy guard across every map surface', () => {
  it('keeps overview, graph, list and detail copy free of internal terms', async () => {
    const { container } = await mountMap();
    expectClean(textOf(container), '总览');

    await openChapter(container, 'toc.ch1');
    expectClean(textOf(container), '关系图');
    expect(textOf(container)).toContain('先学');

    buttonByView(container, 'list').click();
    await tick(5);
    expectClean(textOf(container), '列表');
    expect(textOf(container)).toContain('用 Tab 可以走完');

    buttonByView(container, 'graph').click();
    await tick(5);
    const detail = await openConcept(container, 'toc.ch1', 'concept.cell-division');
    expectClean(textOf(detail), '详情');
    expect(textOf(detail)).toContain('课本第 19 页');
    expect(textOf(detail)).toContain('未核实');
  });

  it('keeps candidate content copy free of internal terms', async () => {
    const { container } = await mountMap({ scenario: 'candidate' });
    expectClean(textOf(container), '候选总览');
    const detail = await openConcept(container, 'toc.ch2', 'concept.photosynthesis');
    expectClean(textOf(detail), '候选详情');
    expect(textOf(detail)).toContain('未核实');
  });
});
