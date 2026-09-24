import { describe, expect, it } from 'vitest'
import { applyDelta, createAccumulator, finalize, parseSSELine, splitLines } from '@core/llm/sse'

describe('SSE 行解析', () => {
  it('解析正文增量', () => {
    const parsed = parseSSELine('data: {"choices":[{"delta":{"content":"你"}}]}')
    expect(parsed).toEqual({ content: '你' })
  })

  it('识别结束标记', () => {
    expect(parseSSELine('data: [DONE]')).toBe('done')
  })

  it('忽略非 data 行与坏 JSON（不中断整条流）', () => {
    expect(parseSSELine(': keep-alive')).toBeNull()
    expect(parseSSELine('event: message')).toBeNull()
    expect(parseSSELine('data: {不是合法 json')).toBeNull()
    expect(parseSSELine('')).toBeNull()
  })

  it('解析工具调用分片与结束原因、用量', () => {
    const toolCall = parseSSELine(
      'data: {"choices":[{"delta":{"tool_calls":[{"index":0,"id":"call_1","function":{"name":"get_section_text","arguments":"{\\"sec"}}]}}]}'
    )
    expect(toolCall).toEqual({
      toolCalls: [{ index: 0, id: 'call_1', name: 'get_section_text', argumentsChunk: '{"sec' }]
    })

    const finish = parseSSELine('data: {"choices":[{"delta":{},"finish_reason":"stop"}]}')
    expect(finish).toEqual({ finishReason: 'stop' })

    const usage = parseSSELine(
      'data: {"choices":[],"usage":{"prompt_tokens":120,"completion_tokens":30}}'
    )
    expect(usage).toEqual({ usage: { promptTokens: 120, completionTokens: 30 } })
  })
})

describe('增量累积', () => {
  it('正文跨多个分片正确拼接', () => {
    const acc = createAccumulator()
    applyDelta(acc, { content: '细胞的生活' })
    applyDelta(acc, { content: '需要物质' })
    expect(finalize(acc).content).toBe('细胞的生活需要物质')
  })

  it('工具调用参数分片按 index 拼接（流式最容易出错的地方）', () => {
    const acc = createAccumulator()
    applyDelta(acc, {
      toolCalls: [{ index: 0, id: 'call_1', name: 'get_section_text', argumentsChunk: '{"sec' }]
    })
    applyDelta(acc, { toolCalls: [{ index: 0, argumentsChunk: 'tionId":"s1"}' }] })
    applyDelta(acc, { toolCalls: [{ index: 1, id: 'call_2', name: 'record_mastery' }] })
    applyDelta(acc, { toolCalls: [{ index: 1, argumentsChunk: '{"kpId":"kp-1"}' }] })

    const { toolCalls } = finalize(acc)
    expect(toolCalls).toHaveLength(2)
    expect(toolCalls[0]).toEqual({
      id: 'call_1',
      name: 'get_section_text',
      arguments: '{"sectionId":"s1"}'
    })
    expect(toolCalls[1]?.arguments).toBe('{"kpId":"kp-1"}')
  })

  it('只有 index、没有 name 的残片不会产出空工具调用', () => {
    const acc = createAccumulator()
    applyDelta(acc, { toolCalls: [{ index: 3, argumentsChunk: '{}' }] })
    expect(finalize(acc).toolCalls).toEqual([])
  })

  it('保留用量信息', () => {
    const acc = createAccumulator()
    applyDelta(acc, { usage: { promptTokens: 10, completionTokens: 5 } })
    expect(finalize(acc).usage).toEqual({ promptTokens: 10, completionTokens: 5 })
  })
})

describe('缓冲区切行', () => {
  it('保留最后一段不完整的行', () => {
    expect(splitLines('data: a\ndata: b\ndata: par')).toEqual({
      lines: ['data: a', 'data: b'],
      rest: 'data: par'
    })
  })

  it('没有换行时全部留作余量', () => {
    expect(splitLines('data: only')).toEqual({ lines: [], rest: 'data: only' })
  })
})
