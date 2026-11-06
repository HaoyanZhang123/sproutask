/**
 * Coverage briefing: the model must be able to answer "is this concept in the
 * pack?" from the system instruction instead of hedging (T15 B03/B05/B06).
 */

import { describe, expect, it } from 'vitest';
import type { Concept, ContentPack, TocNodeLike } from '@edu/domain';
import {
  buildCoverageBriefing,
  buildTutorSystemInstruction,
  COVERAGE_RULES,
} from '../src/coverage.js';
import { loadPack } from './helpers.js';

function toc(
  id: string,
  parentId: string | null,
  type: TocNodeLike['type'],
  title: string,
  order: number,
): TocNodeLike {
  return { schemaVersion: 1, id, courseEditionId: 'course.test', parentId, type, title, order, sourceRefs: [] };
}

function concept(id: string, title: string, placements: readonly string[]): Concept {
  return {
    schemaVersion: 1,
    id,
    courseEditionId: 'course.test',
    title,
    aliases: [],
    placements,
    learningObjectives: ['目标'],
    explanation: '解释',
    misconceptions: [],
    sourceRefs: [],
    rubricIds: [],
    activityIds: [],
    reviewState: null,
  } as unknown as Concept;
}

function miniPack(options: { readonly unplaced?: boolean } = {}): ContentPack {
  return {
    schemaVersion: 1,
    id: 'pack.test',
    version: '1.0.0',
    courseEditionId: 'course.test',
    scope: 'full_volume',
    coverageStatus: 'complete',
    status: 'candidate',
    contentHash: 'a'.repeat(64),
    toc: [
      toc('toc.volume', null, 'volume', '七年级上册', 0),
      toc('toc.unit1', 'toc.volume', 'unit', '第一单元', 0),
      toc('toc.ch1', 'toc.unit1', 'chapter', '第一章', 0),
      toc('toc.sec1', 'toc.ch1', 'section', '第一节', 0),
    ],
    concepts: [
      concept('concept.a', '甲概念', ['toc.sec1']),
      concept('concept.b', '乙概念', ['toc.sec1']),
      ...(options.unplaced === true ? [concept('concept.c', '丙概念', [])] : []),
    ],
    relations: [],
    activities: [],
    rubrics: [],
    coverageManifest: { schemaVersion: 1, sections: [], exclusions: [], notes: null } as unknown as ContentPack['coverageManifest'],
    reviewLedger: [],
  } as unknown as ContentPack;
}

describe('coverage briefing', () => {
  it('renders the pack directory and the concepts under their section', () => {
    const text = buildCoverageBriefing(miniPack());
    expect(text).toContain('七年级上册');
    expect(text).toContain('第一单元');
    expect(text).toContain('第一章');
    expect(text).toContain('第一节');
    expect(text).toContain('甲概念');
    expect(text).toContain('乙概念');
    // concepts appear under the section line, not at the top level
    expect(text.indexOf('第一节')).toBeLessThan(text.indexOf('甲概念'));
  });

  it('marks the concept the turn is about', () => {
    const text = buildCoverageBriefing(miniPack(), { currentConceptId: 'concept.b' });
    expect(text).toContain('乙概念（当前）');
    expect(text).not.toContain('甲概念（当前）');
  });

  it('states the answering rules that stop the hedging failure', () => {
    const text = buildCoverageBriefing(miniPack());
    for (const rule of COVERAGE_RULES) expect(text).toContain(rule);
    expect(text).toContain('不得说“可能不在内容包”');
    expect(text).toContain('不要输出原始的 source / activity 标识');
  });

  it('lists concepts that are not placed under a section', () => {
    expect(buildCoverageBriefing(miniPack())).not.toContain('其他概念');
    const withUnplaced = buildCoverageBriefing(miniPack({ unplaced: true }));
    expect(withUnplaced).toContain('其他概念');
    expect(withUnplaced).toContain('丙概念');
  });

  it('is deterministic and bounded', () => {
    const pack = miniPack();
    expect(buildCoverageBriefing(pack)).toBe(buildCoverageBriefing(pack));
    const bounded = buildCoverageBriefing(pack, { maxConcepts: 1 });
    expect(bounded).toContain('甲概念');
    expect(bounded).not.toContain('乙概念');
  });

  it('appends the briefing to the skill instruction', () => {
    const text = buildTutorSystemInstruction('技能说明', miniPack());
    expect(text.startsWith('技能说明')).toBe(true);
    expect(text).toContain('## 本内容包收录范围');
  });

  it('works on the shipped partial pack fixture', () => {
    const pack = loadPack();
    const text = buildCoverageBriefing(pack);
    const titles = pack.concepts.map((entry) => entry.title).filter((title) => title.length > 0);
    expect(titles.length).toBeGreaterThan(0);
    for (const title of titles) expect(text).toContain(title);
    expect(text.length).toBeGreaterThan(200);
    // a briefing should not be wider than a few thousand characters
    expect(text.length).toBeLessThan(12000);
  });

  it('prints concept ids and current activities so tools never guess an id', () => {
    const pack = loadPack();
    const current = pack.concepts[0];
    if (current === undefined) return;
    const text = buildCoverageBriefing(pack, { currentConceptId: current.id });

    // 每个概念行都带真实 id：模型编 id 会被工具拒（线上实测）。
    expect(text).toContain(`· ${current.id}`);
    expect(text).toContain(`当前概念：${current.title} · ${current.id}`);

    const activity = pack.activities.find((entry) => entry.conceptIds.includes(current.id));
    if (activity !== undefined) {
      expect(text).toContain(activity.id);
      expect(text).toContain(activity.stem);
    }
  });
});
