/**
 * Coverage briefing for the tutor system instruction.
 *
 * Why this exists: the model used to see only the *current* concept plus an
 * instruction saying "未知概念明确说『当前材料没有』". With no view of what the
 * pack actually covers, it hedged on concepts that ARE in the pack ("可能不在
 * 内容包", "我不确定你指哪个概念") and sometimes burned its whole tool budget
 * looking for them (T15 B03/B05/B06; reproduced 2026-11-02).
 *
 * This module renders the pack's real directory plus the answering rules. It is
 * pure: no pack access, no clock, no I/O.
 */

import type { ContentPack, Concept, Id, TocNodeLike } from '@edu/domain';

/** Answering rules appended after the directory. */
export const COVERAGE_RULES: readonly string[] = [
  '本内容包已经收录上面目录中的全部内容。学生问到其中任何一个概念时，直接按材料回答，不得说“可能不在内容包”“我不确定你指哪个概念”，也不得让学生在不相关的几个概念里做选择。',
  '只有完全不在上面目录里的内容，才可以说明“当前材料没有”，并给出超出当前范围时的简短说明。',
  '已经知道学生问的是哪个概念时，不要再调用工具确认它是否存在；工具只用于取正文、活动与来源。',
  '回答里不要输出原始的 source / activity 标识；指代材料时说“课本第 N 页”或“本节的出处”，需要细节时可以请学生点“查看出处”。',
  '不编造页码、印刷页偏移或教材原句；没有可解析来源时按技能规则降级为“暂无来源”，并只给概念层面的解释。',
  '工具调用要精简：本轮材料与来源已在上下文里，不要为了确认是否存在而重复查询同一概念；一次回答通常 0–3 次工具调用足够。',
];

export interface CoverageBriefingOptions {
  /** Marks the concept the turn is about, so the model anchors on it. */
  readonly currentConceptId?: Id | null;
  /** Safety bound for pathological packs; the shipped pack has 43 concepts. */
  readonly maxConcepts?: number;
}

interface ConceptLine {
  readonly title: string;
  readonly current: boolean;
}

function sortNodes(nodes: readonly TocNodeLike[]): readonly TocNodeLike[] {
  return [...nodes].sort((left, right) => left.order - right.order || left.id.localeCompare(right.id));
}

function collectConceptsBySection(
  concepts: readonly Concept[],
): { readonly bySection: ReadonlyMap<Id, readonly Concept[]>; readonly placed: ReadonlySet<Id> } {
  const bySection = new Map<Id, Concept[]>();
  const placed = new Set<Id>();
  for (const concept of concepts) {
    for (const sectionId of concept.placements) {
      placed.add(concept.id);
      const list = bySection.get(sectionId) ?? [];
      if (!list.some((entry) => entry.id === concept.id)) list.push(concept);
      bySection.set(sectionId, list);
    }
  }
  return { bySection, placed };
}

/**
 * Renders the pack directory (volume → unit → chapter → section → concepts)
 * followed by the answering rules. Deterministic for a given pack.
 */
export function buildCoverageBriefing(
  pack: ContentPack,
  options: CoverageBriefingOptions = {},
): string {
  const currentConceptId = options.currentConceptId ?? null;
  const maxConcepts = options.maxConcepts ?? 400;
  const byParent = new Map<Id | null, TocNodeLike[]>();
  for (const node of pack.toc) {
    const key = node.parentId;
    const list = byParent.get(key) ?? [];
    list.push(node);
    byParent.set(key, list);
  }
  for (const [key, list] of byParent) byParent.set(key, [...sortNodes(list)]);

  const { bySection, placed } = collectConceptsBySection(pack.concepts);
  const lines: string[] = [
    '## 本内容包收录范围（回答前先对照这张目录）',
    `内容包：${pack.id} · 版本 ${pack.version} · ${pack.scope === 'full_volume' ? '全册' : '部分内容'}`,
  ];
  let conceptCount = 0;
  const emitConcept = (concept: Concept, indent: string): void => {
    if (conceptCount >= maxConcepts) return;
    conceptCount += 1;
    lines.push(`${indent}· ${concept.title}${concept.id === currentConceptId ? '（当前）' : ''}`);
  };

  const walk = (parentId: Id | null, depth: number): void => {
    for (const node of byParent.get(parentId) ?? []) {
      const indent = '  '.repeat(depth);
      lines.push(`${indent}- ${node.title}`);
      if (node.type === 'section') {
        for (const concept of bySection.get(node.id) ?? []) emitConcept(concept, `${indent}  `);
      }
      walk(node.id, depth + 1);
    }
  };
  walk(null, 0);

  const unplaced = pack.concepts.filter((concept) => !placed.has(concept.id));
  if (unplaced.length > 0) {
    lines.push('- 其他概念（未挂在某一节下）');
    for (const concept of unplaced) emitConcept(concept, '  ');
  }

  lines.push('', '回答问题时的规则：');
  for (const [index, rule] of COVERAGE_RULES.entries()) lines.push(`${index + 1}. ${rule}`);
  return lines.join('\n');
}

/** Convenience wrapper: the full system instruction for one turn. */
export function buildTutorSystemInstruction(
  skillInstruction: string,
  pack: ContentPack,
  options: CoverageBriefingOptions = {},
): string {
  return `${skillInstruction.trimEnd()}\n\n${buildCoverageBriefing(pack, options)}`;
}
