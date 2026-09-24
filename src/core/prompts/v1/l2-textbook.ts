import type { StudyScope } from '../../content'

/**
 * L2 教材与课标约束层：随每次请求注入的"事实边界"。
 *
 * 设计要点：
 *   - 教材原文是唯一事实来源（防止模型自行发挥）
 *   - 课标要求单独列出，作为"不得越界"的硬约束
 *   - 只装载"当前位置"对应的内容，不注入全册（见 ADR-0004）
 */
export function buildTextbookLayer(scope: StudyScope): string {
  const sections = scope.sectionTexts
    .map((section) => `【${section.title}】\n${section.text}`)
    .join('\n\n')

  const knowledgePoints = scope.knowledgePoints
    .map((kp) => {
      const refs = kp.refs
        .map((r) => (r.page ? `${r.sectionId}（第 ${r.page} 页）` : r.sectionId))
        .join('、')
      const misconceptions =
        kp.misconceptions.length > 0 ? `\n  - 学生常见误区：${kp.misconceptions.join('；')}` : ''
      return `- ${kp.title}：${kp.summary}（出处：${refs}）${misconceptions}`
    })
    .join('\n')

  const curriculum =
    scope.curriculumRequirements.length > 0
      ? scope.curriculumRequirements.map((r) => `- ${r}`).join('\n')
      : '- （本节课未配置课标条目）'

  return `【课程标准要求（不得越界）】
${curriculum}

【教材原文（唯一事实来源）】
当前单元：${scope.unit.title}（${scope.unit.edition}，${scope.unit.grade}）

${sections}

【本部分应掌握的知识点】
${knowledgePoints}`
}
