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
/**
 * 本机没有教材正文时给模型的交代（**打包分发后学生机就是这种情况**：
 * 正文是版权物、只留在开发机；随包的是我们自己的知识点/课标/页码，见 ADR-0007）。
 *
 * 关键：**不许引用或编造课本原句**，把"读课本"这件事交回学生手里——
 * 这既符合"学生用自己手里那本课本"的设计，也避免模型凭空造教材。
 * 带着页码与知识点，引导依然可执行。
 */
const MISSING_TEXT_NOTICE = `（**本机没有存放教材正文**：不要引用、不要编造课本原句，也不要假装你看到了课本。）
按下面的做法进行：让学生翻到课本对应页码，念出或转述他看到的段落，你再根据他的转述提问、纠偏与追问；
涉及具体结论时，只使用"本部分应掌握的知识点"里给出的表述，并请学生用课本核对。`

export function buildTextbookLayer(scope: StudyScope): string {
  const hasLocalText = scope.sectionTexts.some((section) => section.text.trim().length > 0)

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

${hasLocalText ? sections : MISSING_TEXT_NOTICE}

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
