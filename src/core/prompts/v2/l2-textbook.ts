import type { StudyScope } from '../../content'
import { parseSectionBlocks } from '../../../shared/section-blocks'

/**
 * L2 教材与课标约束层：随每次请求注入的"事实边界"。
 *
 * 设计要点：
 *   - 教材原文是唯一事实来源（防止模型自行发挥）
 *   - 课标要求单独列出，作为"不得越界"的硬约束
 *   - 只装载"当前位置"对应的内容，不注入全册（见 ADR-0004）
 *   - **剥掉可折叠块的标记**（`:::think` / `:::answer`）：标记是给界面渲染用的，
 *     写进提示词只会变成噪声；块内的文字（含答案）仍要保留，模型需要知道正确结论
 *     才能引导学生走过去——"不给答案"是靠教学纪律与泄漏护栏约束的，不靠藏内容。
 */
export function buildTextbookLayer(scope: StudyScope): string {
  const sections = scope.sectionTexts
    .map((section) => `【${section.title}】\n${plainTextOf(section.text)}`)
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

/** 去掉 `:::think` / `:::answer` 标记行，保留块内全部文字 */
export function plainTextOf(sectionText: string): string {
  const blocks = parseSectionBlocks(sectionText)
  if (blocks.length === 0) return sectionText.trim()
  const parts: string[] = []
  for (const block of blocks) {
    if (block.type === 'text') {
      parts.push(block.body)
    } else {
      // 折叠块：标注来源，便于模型区分"课本里的思考题/答案"
      const label = block.type === 'think' ? block.title ?? '想一想' : '参考答案'
      parts.push(`（${label}）${block.body}`)
    }
  }
  return parts.join('\n\n')
}
