import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import { ToolRegistry, zodObjectToJsonSchema } from '@core/agent/tools'
import { getSectionTextTool } from '@core/agent/tools/get-section-text'
import { flagForTeacherTool } from '@core/agent/tools/flag-for-teacher'
import type { AgentTool, ToolContext } from '@core/agent/tools/types'
import { toApiMessage } from '@core/llm/deepseek'
import { makeScope } from './helpers/fixtures'

function makeContext(overrides: Partial<ToolContext> = {}): ToolContext {
  return {
    scope: makeScope(),
    studentId: 'S07',
    flags: [],
    getSectionText: async (sectionId) => (sectionId === 's1' ? '教材原文片段' : null),
    ...overrides
  }
}

describe('Zod → JSON Schema', () => {
  it('生成模型可读的对象 schema，并保留字段描述与必填项', () => {
    const schema = zodObjectToJsonSchema(
      z.object({
        sectionId: z.string().describe('小节 id'),
        limit: z.number().optional()
      })
    )
    expect(schema['type']).toBe('object')
    expect(schema['required']).toEqual(['sectionId'])
    expect(schema['additionalProperties']).toBe(false)
    const properties = schema['properties'] as Record<string, Record<string, unknown>>
    expect(properties['sectionId']).toEqual({ type: 'string', description: '小节 id' })
    expect(properties['limit']).toEqual({ type: 'number' })
  })

  it('支持 enum 与数组', () => {
    const schema = zodObjectToJsonSchema(
      z.object({
        reason: z.enum(['a', 'b']),
        tags: z.array(z.string())
      })
    )
    const properties = schema['properties'] as Record<string, Record<string, unknown>>
    expect(properties['reason']?.['enum']).toEqual(['a', 'b'])
    expect(properties['tags']?.['type']).toBe('array')
  })

  it('遇到不支持的类型立刻报错（不生成模型看不懂的 schema）', () => {
    expect(() => zodObjectToJsonSchema(z.object({ when: z.date() }))).toThrow(/暂不支持/)
  })
})

describe('工具注册表', () => {
  it('拒绝重名工具与非对象参数', () => {
    expect(() => new ToolRegistry([getSectionTextTool as never, getSectionTextTool as never])).toThrow(
      /重复/
    )
    const badTool = {
      name: 'bad',
      description: 'x',
      schema: z.string(),
      handler: async () => 'x'
    } as unknown as AgentTool<never, unknown>
    expect(() => new ToolRegistry([badTool])).toThrow(/ZodObject/)
  })

  it('把工具转成模型定义（含描述与参数）', () => {
    const registry = new ToolRegistry([getSectionTextTool as never, flagForTeacherTool as never])
    const defs = registry.toModelTools() as Array<{
      type: string
      function: { name: string; description: string; parameters: Record<string, unknown> }
    }>
    expect(defs).toHaveLength(2)
    expect(defs[0]?.type).toBe('function')
    expect(defs[0]?.function.name).toBe('get_section_text')
    expect(defs[0]?.function.description.length).toBeGreaterThan(10)
    expect(defs[0]?.function.parameters['type']).toBe('object')
  })

  it('正常执行工具并把结果转为文本', async () => {
    const registry = new ToolRegistry([getSectionTextTool as never])
    const result = await registry.execute(
      { id: 'call_1', name: 'get_section_text', arguments: '{"sectionId":"s1"}' },
      makeContext()
    )
    expect(result.ok).toBe(true)
    expect(result.content).toBe('教材原文片段')
  })

  it('未知工具名：回填可用工具列表而不是抛错', async () => {
    const registry = new ToolRegistry([getSectionTextTool as never])
    const result = await registry.execute(
      { id: 'call_1', name: 'no_such_tool', arguments: '{}' },
      makeContext()
    )
    expect(result.ok).toBe(false)
    expect(result.content).toContain('get_section_text')
  })

  it('参数不是合法 JSON：提示模型重试', async () => {
    const registry = new ToolRegistry([getSectionTextTool as never])
    const result = await registry.execute(
      { id: 'call_1', name: 'get_section_text', arguments: '{不是 json' },
      makeContext()
    )
    expect(result.ok).toBe(false)
    expect(result.content).toContain('JSON')
  })

  it('参数校验失败：把字段级错误回填给模型', async () => {
    const registry = new ToolRegistry([getSectionTextTool as never])
    const result = await registry.execute(
      { id: 'call_1', name: 'get_section_text', arguments: '{}' },
      makeContext()
    )
    expect(result.ok).toBe(false)
    expect(result.content).toContain('sectionId')
  })

  it('handler 抛错被吞掉并转成可读文本（不打断整轮对话）', async () => {
    const registry = new ToolRegistry([getSectionTextTool as never])
    const result = await registry.execute(
      { id: 'call_1', name: 'get_section_text', arguments: '{"sectionId":"s1"}' },
      makeContext({
        getSectionText: async () => {
          throw new Error('磁盘读取失败')
        }
      })
    )
    expect(result.ok).toBe(false)
    expect(result.content).toContain('磁盘读取失败')
  })

  it('flag_for_teacher 会把标记写进本轮上下文，且不重复', async () => {
    const registry = new ToolRegistry([flagForTeacherTool as never])
    const ctx = makeContext()
    await registry.execute(
      { id: 'c1', name: 'flag_for_teacher', arguments: '{"reason":"likely-homework-cheating"}' },
      ctx
    )
    await registry.execute(
      { id: 'c2', name: 'flag_for_teacher', arguments: '{"reason":"likely-homework-cheating"}' },
      ctx
    )
    expect(ctx.flags).toEqual(['likely-homework-cheating'])
  })

  it('取不到原文时给出可读提示（而不是空字符串）', async () => {
    const registry = new ToolRegistry([getSectionTextTool as never])
    const result = await registry.execute(
      { id: 'c1', name: 'get_section_text', arguments: '{"sectionId":"s9"}' },
      makeContext()
    )
    expect(result.ok).toBe(true)
    expect(result.content).toContain('未找到小节')
  })
})

describe('接口消息序列化（工具调用协议）', () => {
  it('assistant 消息携带 tool_calls', () => {
    const api = toApiMessage({
      role: 'assistant',
      content: '',
      toolCalls: [{ id: 'call_1', name: 'get_section_text', arguments: '{"sectionId":"s1"}' }]
    })
    expect(api.tool_calls?.[0]).toEqual({
      id: 'call_1',
      type: 'function',
      function: { name: 'get_section_text', arguments: '{"sectionId":"s1"}' }
    })
  })

  it('tool 消息携带 tool_call_id 与 name', () => {
    const api = toApiMessage({
      role: 'tool',
      content: '教材原文片段',
      toolCallId: 'call_1',
      name: 'get_section_text'
    })
    expect(api).toMatchObject({
      role: 'tool',
      content: '教材原文片段',
      tool_call_id: 'call_1',
      name: 'get_section_text'
    })
    expect(api.tool_calls).toBeUndefined()
  })
})
