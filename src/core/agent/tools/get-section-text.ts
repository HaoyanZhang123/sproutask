import { z } from 'zod'
import type { AgentTool } from './types'

/**
 * 取教材原文。
 *
 * 为什么要它：单元全文已经在 L2 层注入，但学生追问到**别的小节**（或本章之外的内容）时，
 * 模型可以主动取更细的原文——既避免每次注入整册，也保证"只依据教材"这条纪律。
 */
export const getSectionTextTool: AgentTool<{ sectionId: string }, string> = {
  name: 'get_section_text',
  description:
    '读取教材中某个小节的原文。当你需要引用或核对教材里另一小节的具体内容时调用（当前小节的原文已在上下文中，不必重复获取）。',
  schema: z.object({
    sectionId: z.string().min(1).describe('小节 id，例如 s1')
  }),
  async handler(input, ctx) {
    const text = await ctx.getSectionText(input.sectionId)
    if (!text) {
      return `未找到小节 ${input.sectionId} 的原文。请只用已有教材内容回答，或告诉学生这一部分需要看课本。`
    }
    return text
  }
}
