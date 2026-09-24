import { z } from 'zod'
import type { StudyScope } from '../../content'
import type { TurnFlag } from '../../domain'

/**
 * Agent 工具契约。
 *
 * 约定（改工具前先读）：
 *   - 每个工具一个文件，导出 `xxxTool`，参数 Schema 用 Zod 定义；
 *   - `description` 是给**模型**看的，直接决定调用准确率——写清"什么时候该调它"；
 *   - handler 抛错不致命：错误会以文本形式回填给模型，让它自我修正（见 loop.ts）。
 */

export interface ToolContext {
  /** 本轮的学习上下文（教材原文、知识点、课标要求） */
  scope: StudyScope
  /** 读取教材某小节原文（由调用方注入，便于离线测试） */
  getSectionText: (sectionId: string) => Promise<string | null>
  /** 学生编号（只用于记录，不含姓名） */
  studentId: string
  /** 本轮累积的标记（如 flag_for_teacher 写入） */
  flags: TurnFlag[]
}

export interface AgentTool<In = unknown, Out = unknown> {
  name: string
  description: string
  /** 必须是 ZodObject（模型要求参数为对象） */
  schema: z.ZodType<In>
  handler: (input: In, ctx: ToolContext) => Promise<Out>
}

/** 工具执行结果：统一转成文本回填给模型 */
export interface ToolExecutionResult {
  toolCallId: string
  name: string
  ok: boolean
  content: string
}
