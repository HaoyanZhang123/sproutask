import type { KnowledgePoint } from '../../core/domain'

/**
 * 参与度启发式：这一轮学生的话里**提到了哪些知识点**。
 *
 * ⚠️ 这不是"掌握度判定"，只是**参与痕迹**：
 *   - 命中即记 `exploring`（探索中），evidence 指向这一轮，可回溯；
 *   - **绝不由它写 `mastered`**——"学会了"必须有明确的判定规则（属后续版本，需教师参与设计）。
 *
 * 做法：用知识点标题的 2/3 字连续片段去匹配学生的话，并**丢掉在多个标题里都出现的片段**
 * （例如"细胞"几乎出现在每个标题里，拿它匹配等于把所有知识点都标一遍）。
 */

const STOPPERS = new Set(['的', '和', '是', '中', '在', '了', '与', '及', '了', '之'])

function ngrams(text: string, n: number): string[] {
  const out: string[] = []
  for (let i = 0; i + n <= text.length; i += 1) {
    const gram = text.slice(i, i + n)
    if ([...gram].some((ch) => STOPPERS.has(ch))) continue
    out.push(gram)
  }
  return out
}

/** 标题 → 候选片段（2 字与 3 字），只保留"只属于这一个知识点"的片段 */
function distinctiveGrams(knowledgePoints: KnowledgePoint[]): Map<string, string[]> {
  const owners = new Map<string, Set<string>>()
  for (const kp of knowledgePoints) {
    for (const gram of [...ngrams(kp.title, 2), ...ngrams(kp.title, 3)]) {
      const set = owners.get(gram) ?? new Set<string>()
      set.add(kp.id)
      owners.set(gram, set)
    }
  }
  const byKp = new Map<string, string[]>()
  for (const [gram, kpIds] of owners) {
    if (kpIds.size !== 1) continue // 多个知识点共有 → 不具区分度，丢掉
    const id = [...kpIds][0]
    if (!id) continue
    byKp.set(id, [...(byKp.get(id) ?? []), gram])
  }
  return byKp
}

/** 返回这一轮学生的话命中的知识点 id（按知识点顺序，去重） */
export function touchedKnowledgePoints(
  knowledgePoints: KnowledgePoint[],
  studentMessage: string
): string[] {
  const message = studentMessage.replace(/\s+/g, '')
  if (!message) return []
  const grams = distinctiveGrams(knowledgePoints)
  return knowledgePoints
    .filter((kp) => (grams.get(kp.id) ?? []).some((gram) => message.includes(gram)))
    .map((kp) => kp.id)
}
