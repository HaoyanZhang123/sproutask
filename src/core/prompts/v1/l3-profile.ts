import type { KnowledgePoint, MasteryRecord } from '../../domain'

/**
 * L3 学情摘要层：让 Agent"记得这个学生"。
 *
 * 只使用**本地**掌握度数据，不涉及任何教师端或班级聚合（隐私优先，2026-09 决策）。
 * 注：当前由调用方传入；接入本地存储后改为从 StudentStore 读取。
 */
export function buildProfileLayer(mastery: MasteryRecord[], knowledgePoints: KnowledgePoint[]): string {
  if (knowledgePoints.length === 0) return ''

  const titleOf = new Map(knowledgePoints.map((kp) => [kp.id, kp.title]))
  const group = (state: MasteryRecord['state']): string[] =>
    mastery
      .filter((m) => m.state === state)
      .map((m) => titleOf.get(m.kpId) ?? m.kpId)

  const mastered = group('mastered')
  const exploring = group('exploring')
  const unlearned = group('unlearned')

  const lines: string[] = []
  if (mastered.length > 0) lines.push(`- 已掌握：${mastered.join('、')}`)
  if (exploring.length > 0) lines.push(`- 正在探索（可优先追问）：${exploring.join('、')}`)
  if (unlearned.length > 0) lines.push(`- 还没学过：${unlearned.join('、')}`)

  // 针对"正在探索"的知识点，提示常见误区，供 Agent 设计诊断性提问
  const probe = knowledgePoints
    .filter((kp) => exploring.includes(kp.title) && kp.misconceptions.length > 0)
    .map((kp) => `- ${kp.title}：注意他可能会认为「${kp.misconceptions.join('；')}」`)
  if (probe.length > 0) lines.push('', '值得重点探查的误区：', ...probe)

  if (lines.length === 0) return ''

  return `【这个学生的学习记录（仅本地保存，不要向学生复述）】
${lines.join('\n')}`
}
