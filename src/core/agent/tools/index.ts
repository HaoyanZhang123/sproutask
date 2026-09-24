import { z } from 'zod'
import type { ToolCall } from '../../llm'
import type { AgentTool, ToolContext, ToolExecutionResult } from './types'
import { getSectionTextTool } from './get-section-text'
import { flagForTeacherTool } from './flag-for-teacher'

/**
 * 工具注册表：把 Zod 定义的工具暴露给模型，并把模型的调用安全地落到 handler 上。
 *
 * 关键约束：
 *   - 参数先经 Zod 解析；解析失败**不抛给上层**，而是把错误文本回填给模型让它自我修正；
 *   - handler 抛错同样转为文本回填，绝不让一次工具失败打断整轮对话；
 *   - 工具名唯一、参数必须是对象（模型协议要求）。
 */

export function createDefaultTools(): Array<AgentTool<never, unknown>> {
  return [getSectionTextTool, flagForTeacherTool] as unknown as Array<AgentTool<never, unknown>>
}

export class ToolRegistry {
  private readonly tools = new Map<string, AgentTool<never, unknown>>()

  constructor(tools: Array<AgentTool<never, unknown>>) {
    for (const tool of tools) {
      if (this.tools.has(tool.name)) {
        throw new Error(`工具名重复：${tool.name}`)
      }
      if (!(tool.schema instanceof z.ZodObject)) {
        throw new Error(`工具 ${tool.name} 的参数必须是 ZodObject（模型要求参数为对象）`)
      }
      this.tools.set(tool.name, tool)
    }
  }

  listNames(): string[] {
    return [...this.tools.keys()]
  }

  /** 转成模型可识别的工具定义（object 根部的 JSON Schema） */
  toModelTools(): unknown[] {
    return [...this.tools.values()].map((tool) => ({
      type: 'function',
      function: {
        name: tool.name,
        description: tool.description,
        parameters: zodObjectToJsonSchema(tool.schema as unknown as z.ZodObject<z.ZodRawShape>)
      }
    }))
  }

  /** 执行一次工具调用；任何失败都转成可读文本回填给模型 */
  async execute(call: ToolCall, ctx: ToolContext): Promise<ToolExecutionResult> {
    const tool = this.tools.get(call.name)
    if (!tool) {
      return {
        toolCallId: call.id,
        name: call.name,
        ok: false,
        content: `没有名为 ${call.name} 的工具。可用工具：${this.listNames().join(', ')}`
      }
    }

    let raw: unknown
    try {
      raw = call.arguments ? JSON.parse(call.arguments) : {}
    } catch {
      return {
        toolCallId: call.id,
        name: call.name,
        ok: false,
        content: '参数不是合法 JSON，请重新调用并确保 arguments 是 JSON 对象。'
      }
    }

    const parsed = tool.schema.safeParse(raw)
    if (!parsed.success) {
      const issues = parsed.error.issues
        .map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`)
        .join('; ')
      return {
        toolCallId: call.id,
        name: call.name,
        ok: false,
        content: `参数校验失败：${issues}。请修正后重试。`
      }
    }

    try {
      const result = await tool.handler(parsed.data as never, ctx)
      return {
        toolCallId: call.id,
        name: call.name,
        ok: true,
        content: typeof result === 'string' ? result : JSON.stringify(result)
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      return {
        toolCallId: call.id,
        name: call.name,
        ok: false,
        content: `工具执行出错：${message}。你可以换一种方式继续帮助学生。`
      }
    }
  }
}

/* ── Zod → JSON Schema（只支持工具用得到的子集，遇到不支持的立刻报错） ── */

export function zodObjectToJsonSchema(schema: z.ZodObject<z.ZodRawShape>): Record<string, unknown> {
  const properties: Record<string, unknown> = {}
  const required: string[] = []

  for (const [key, value] of Object.entries(schema.shape)) {
    const converted = convertZod(value as z.ZodTypeAny)
    properties[key] = converted.json
    if (!converted.optional) required.push(key)
  }

  return {
    type: 'object',
    properties,
    additionalProperties: false,
    ...(required.length > 0 ? { required } : {})
  }
}

function convertZod(schema: z.ZodTypeAny): { json: Record<string, unknown>; optional: boolean } {
  const description = schema.description

  if (schema instanceof z.ZodOptional) {
    const inner = convertZod(schema.unwrap() as z.ZodTypeAny)
    return { json: withDescription(inner.json, description), optional: true }
  }
  if (schema instanceof z.ZodDefault) {
    const inner = convertZod(schema.removeDefault() as z.ZodTypeAny)
    return { json: withDescription(inner.json, description), optional: true }
  }
  if (schema instanceof z.ZodString) {
    return { json: withDescription({ type: 'string' }, description), optional: false }
  }
  if (schema instanceof z.ZodNumber) {
    return { json: withDescription({ type: 'number' }, description), optional: false }
  }
  if (schema instanceof z.ZodBoolean) {
    return { json: withDescription({ type: 'boolean' }, description), optional: false }
  }
  if (schema instanceof z.ZodEnum) {
    const values = (schema as z.ZodEnum<[string, ...string[]]>).options
    return { json: withDescription({ type: 'string', enum: values }, description), optional: false }
  }
  if (schema instanceof z.ZodArray) {
    const inner = convertZod(schema.element as z.ZodTypeAny)
    return { json: withDescription({ type: 'array', items: inner.json }, description), optional: false }
  }

  // 不支持的类型必须**立刻报错**（fail loud），不要生成一个模型看不懂的 schema
  throw new Error(`暂不支持把 ${schema.constructor.name} 转成 JSON Schema，请扩展 src/core/agent/tools/index.ts`)
}

function withDescription(
  json: Record<string, unknown>,
  description: string | undefined
): Record<string, unknown> {
  return description ? { ...json, description } : json
}
