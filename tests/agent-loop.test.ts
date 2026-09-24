import { describe, expect, it } from 'vitest'
import { DEFAULT_MAX_ITERATIONS, runAgentTurn } from '@core/agent/loop'
import { ToolRegistry } from '@core/agent/tools'
import { getSectionTextTool } from '@core/agent/tools/get-section-text'
import { flagForTeacherTool } from '@core/agent/tools/flag-for-teacher'
import { LLMError } from '@core/llm'
import { makeScope, RecordingClient } from './helpers/fixtures'

const scope = makeScope()
const registry = new ToolRegistry([getSectionTextTool as never, flagForTeacherTool as never])

function makeInput(client: RecordingClient, userMessage = '光合作用需要什么？') {
  return {
    client,
    registry,
    prompt: { scope },
    userMessage,
    toolContext: {
      studentId: 'S07',
      getSectionText: async (sectionId: string) =>
        sectionId === 's1' ? '教材原文：绿色植物在光下把二氧化碳和水转变成有机物。' : null
    }
  }
}

describe('Agent 循环：基本路径', () => {
  it('模型直接给文本：一轮结束，无工具调用', async () => {
    const client = new RecordingClient([
      { content: '问得好！你觉得植物靠什么长大呢？🌱', toolCalls: [] }
    ])
    const result = await runAgentTurn(makeInput(client))
    expect(result.reply).toContain('你觉得')
    expect(result.iterations).toBe(1)
    expect(result.toolCalls).toEqual([])
    expect(result.flags).toEqual([])
    expect(result.guard.triggered).toBe(false)
  })

  it('先调工具再回答：工具结果会被回填给模型', async () => {
    const client = new RecordingClient([
      {
        content: '',
        toolCalls: [{ id: 'call_1', name: 'get_section_text', arguments: '{"sectionId":"s1"}' }]
      },
      { content: '那我们一起看看教材怎么说，你觉得关键是什么？', toolCalls: [] }
    ])
    const result = await runAgentTurn(makeInput(client))

    expect(result.iterations).toBe(2)
    expect(result.toolCalls).toEqual([{ name: 'get_section_text', ok: true }])
    expect(result.reply).toContain('你觉得')

    // 第二次调用应当已经带上 assistant(tool_calls) 与 tool 结果
    const secondCall = client.calls[1] ?? []
    const assistantWithCalls = secondCall.find((m) => m.role === 'assistant' && m.toolCalls?.length)
    const toolMessage = secondCall.find((m) => m.role === 'tool')
    expect(assistantWithCalls).toBeDefined()
    expect(toolMessage?.toolCallId).toBe('call_1')
    expect(toolMessage?.content).toContain('教材原文')
  })

  it('工具失败不打断整轮：错误文本回填后模型继续回答', async () => {
    const client = new RecordingClient([
      {
        content: '',
        toolCalls: [{ id: 'c1', name: 'get_section_text', arguments: '{坏掉的 json' }]
      },
      { content: '我们先看课本上这一段，你觉得它说明了什么？', toolCalls: [] }
    ])
    const result = await runAgentTurn(makeInput(client))
    expect(result.toolCalls).toEqual([{ name: 'get_section_text', ok: false }])
    expect(result.reply).toContain('你觉得')
    const toolMessage = (client.calls[1] ?? []).find((m) => m.role === 'tool')
    expect(toolMessage?.content).toContain('JSON')
  })

  it('flag_for_teacher 的标记会进入本轮结果（供落库）', async () => {
    const client = new RecordingClient([
      {
        content: '',
        toolCalls: [
          { id: 'c1', name: 'flag_for_teacher', arguments: '{"reason":"likely-homework-cheating"}' }
        ]
      },
      { content: '这道题我们一起来分析，你先说说考的是哪个知识点？', toolCalls: [] }
    ])
    const result = await runAgentTurn(makeInput(client, '帮我写这道题'))
    expect(result.flags).toContain('likely-homework-cheating')
  })
})

describe('Agent 循环：答案泄漏护栏', () => {
  it('命中泄漏 → 用更严格的指令重新生成一次，并打标记', async () => {
    const client = new RecordingClient([
      { content: '答案是二氧化碳和水。', toolCalls: [] }, // 泄漏
      { content: '那你觉得，植物在阳光下会"吃"进什么？🌱', toolCalls: [] } // 重写后合格
    ])
    const result = await runAgentTurn(makeInput(client))

    expect(result.guard.triggered).toBe(true)
    expect(result.guard.regenerated).toBe(true)
    expect(result.flags).toContain('answer-leak-guard-triggered')
    expect(result.reply).toContain('你觉得')

    // 重生成请求里必须带加严指令
    const retryMessages = client.calls[1] ?? []
    const strictHint = retryMessages.find(
      (m) => m.role === 'system' && m.content.includes('不要出现任何结论性表述')
    )
    expect(strictHint).toBeDefined()
  })

  it('重生成后仍泄漏：保留标记但不再无限重试', async () => {
    const client = new RecordingClient([
      { content: '答案是二氧化碳和水。', toolCalls: [] },
      { content: '答案就是二氧化碳和水，记住了吗？', toolCalls: [] }
    ])
    const result = await runAgentTurn(makeInput(client))
    expect(client.callCount).toBe(2)
    expect(result.flags).toContain('answer-leak-guard-triggered')
    expect(result.guard.regenerated).toBe(true)
  })

  it('合格回复不会触发重生成（避免浪费调用）', async () => {
    const client = new RecordingClient([{ content: '你觉得植物需要什么呢？', toolCalls: [] }])
    const result = await runAgentTurn(makeInput(client))
    expect(client.callCount).toBe(1)
    expect(result.guard.triggered).toBe(false)
    expect(result.flags).toEqual([])
  })
})

describe('Agent 循环：降级与边界', () => {
  it('模型调用失败 → 降级为面向学生的中文提示，不抛错', async () => {
    const failing = {
      name: 'failing',
      async chat() {
        throw new LLMError('network', '请求 DeepSeek 失败：socket hang up')
      }
    }
    const result = await runAgentTurn({ ...makeInput(failing as never) })
    expect(result.degraded?.kind).toBe('network')
    expect(result.reply).toContain('连不上')
    expect(result.reply).not.toContain('socket')
    expect(result.guard.checked).toBe(false)
  })

  it('循环上限被遵守（模型一直调工具时不会死循环）', async () => {
    const looping = {
      name: 'looping',
      async chat() {
        return {
          content: '',
          toolCalls: [{ id: `c${Date.now()}`, name: 'get_section_text', arguments: '{"sectionId":"s1"}' }]
        }
      }
    }
    const result = await runAgentTurn({
      ...makeInput(looping as never),
      maxIterations: 2
    })
    // 2 轮工具循环 + 1 次"强制要文本"= 3；模型始终不产出文本 → 给可读兜底话术且不触发护栏
    expect(result.iterations).toBe(3)
    expect(result.toolCalls.length).toBe(2)
    expect(result.reply).toContain('关键在哪里')
    expect(result.guard.checked).toBe(false)
    expect(result.guard.reasons).toContain('模型未产出内容')
  })

  it('默认上限为 5 轮', () => {
    expect(DEFAULT_MAX_ITERATIONS).toBe(5)
  })
})
