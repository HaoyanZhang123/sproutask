import { z } from 'zod'
import type { AgentTool } from './types'

const ReasonSchema = z
  .enum(['likely-homework-cheating', 'off-topic', 'suggested-ask-teacher'])
  .describe(
    '标记类型：likely-homework-cheating=学生在索要作业/考试答案；off-topic=话题偏离生物学习；suggested-ask-teacher=内容超出教材与课标，已建议学生问老师'
  )

/**
 * 打标记（**不做教师端**：标记只落本地，供统计与自我改进，不构成教师查看学生的功能）。
 *
 * 为什么让模型显式调用它：这些情形需要**结构化**留下来（而不是埋在自然语言里），
 * 否则无法统计"学生多常索要答案""多少提问超出教材范围"。
 */
export const flagForTeacherTool: AgentTool<{ reason: z.infer<typeof ReasonSchema> }, string> = {
  name: 'flag_for_teacher',
  description:
    '当你识别到学生索要作业答案、话题偏离生物学习、或问题超出教材与课标范围时，调用它记录标记。调用后继续正常回复学生。',
  schema: z.object({ reason: ReasonSchema }),
  async handler(input, ctx) {
    if (!ctx.flags.includes(input.reason)) ctx.flags.push(input.reason)
    return `已记录标记：${input.reason}`
  }
}
