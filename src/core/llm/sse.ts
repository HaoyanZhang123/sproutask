import type { ToolCall } from './index'

/**
 * OpenAI 兼容流式响应（DeepSeek 同格式）的解析与累积——**纯函数，可离线单测**。
 *
 * 报文形态（每行一个 SSE 事件）：
 *   data: {"choices":[{"delta":{"content":"你"},"finish_reason":null}]}
 *   data: {"choices":[{"delta":{"tool_calls":[{"index":0,"id":"call_1",
 *            "function":{"name":"get_section_text","arguments":"{\"sec"}}]}}]}
 *   data: {"choices":[{"delta":{},"finish_reason":"stop"}],"usage":{...}}
 *   data: [DONE]
 *
 * 注意：tool_calls 会**分片到达**（arguments 逐段拼接），必须按 index 累积。
 */

export interface StreamDelta {
  content?: string
  toolCalls?: Array<{
    index: number
    id?: string
    name?: string
    argumentsChunk?: string
  }>
  finishReason?: string
  usage?: { promptTokens?: number; completionTokens?: number }
}

export interface Accumulator {
  content: string
  /** 按 index 存放的稀疏数组，finalize 时过滤 */
  toolCalls: Array<ToolCall | undefined>
  finishReason?: string
  usage?: { promptTokens?: number; completionTokens?: number }
}

export function createAccumulator(): Accumulator {
  return { content: '', toolCalls: [] }
}

/** 解析单行 SSE；非 data 行返回 null，[DONE] 返回 'done' */
export function parseSSELine(line: string): StreamDelta | 'done' | null {
  const trimmed = line.trim()
  if (!trimmed.startsWith('data:')) return null

  const payload = trimmed.slice(5).trim()
  if (payload === '[DONE]') return 'done'
  if (!payload) return null

  let json: unknown
  try {
    json = JSON.parse(payload)
  } catch {
    // 坏行不应中断整条流：交给上层按"忽略"处理
    return null
  }

  const choice = pickFirstChoice(json)
  const delta: StreamDelta = {}
  const deltaObj = asRecord(choice?.['delta'])

  const content = pickString(deltaObj, 'content')
  if (content) delta.content = content

  const toolCalls = pickToolCalls(deltaObj)
  if (toolCalls.length > 0) delta.toolCalls = toolCalls

  const finishReason = pickString(choice, 'finish_reason')
  if (finishReason) delta.finishReason = finishReason

  const usage = pickUsage(json)
  if (usage) delta.usage = usage

  return delta
}

/** 把增量并入累积器（content 追加、tool_calls 按 index 拼接） */
export function applyDelta(acc: Accumulator, delta: StreamDelta): void {
  if (delta.content) acc.content += delta.content

  for (const piece of delta.toolCalls ?? []) {
    const existing = acc.toolCalls[piece.index]
    const slot: ToolCall = existing ?? { id: '', name: '', arguments: '' }
    if (piece.id) slot.id = piece.id
    if (piece.name) slot.name = piece.name
    if (piece.argumentsChunk) slot.arguments += piece.argumentsChunk
    acc.toolCalls[piece.index] = slot
  }

  if (delta.finishReason) acc.finishReason = delta.finishReason
  if (delta.usage) acc.usage = delta.usage
}

/** 收敛为最终回复（过滤掉空槽位） */
export function finalize(acc: Accumulator): {
  content: string
  toolCalls: ToolCall[]
  usage?: { promptTokens?: number; completionTokens?: number }
} {
  const toolCalls = acc.toolCalls.filter((tc): tc is ToolCall => Boolean(tc && tc.name))
  return { content: acc.content, toolCalls, ...(acc.usage ? { usage: acc.usage } : {}) }
}

/** 把缓冲区按换行切分成完整行 + 余下的不完整片段 */
export function splitLines(buffer: string): { lines: string[]; rest: string } {
  const parts = buffer.split('\n')
  const rest = parts.pop() ?? ''
  return { lines: parts, rest }
}

/* ── 内部取值辅助（对未知 JSON 做安全取值） ───────────────── */

function pickFirstChoice(json: unknown): Record<string, unknown> | undefined {
  const root = asRecord(json)
  const choices = root?.['choices']
  if (!Array.isArray(choices) || choices.length === 0) return undefined
  return asRecord(choices[0])
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : undefined
}

function pickString(source: Record<string, unknown> | undefined, key: string): string | undefined {
  if (!source) return undefined
  const value = source[key]
  return typeof value === 'string' && value.length > 0 ? value : undefined
}

function pickToolCalls(
  delta: Record<string, unknown> | undefined
): NonNullable<StreamDelta['toolCalls']> {
  const raw = delta?.['tool_calls']
  if (!Array.isArray(raw)) return []

  const out: NonNullable<StreamDelta['toolCalls']> = []
  for (const item of raw) {
    const record = asRecord(item)
    if (!record) continue
    const index = typeof record['index'] === 'number' ? record['index'] : 0
    const fn = asRecord(record['function'])

    out.push({
      index,
      ...(typeof record['id'] === 'string' ? { id: record['id'] } : {}),
      ...(typeof fn?.['name'] === 'string' ? { name: fn['name'] } : {}),
      ...(typeof fn?.['arguments'] === 'string' ? { argumentsChunk: fn['arguments'] } : {})
    })
  }
  return out
}

function pickUsage(json: unknown): StreamDelta['usage'] {
  const root = asRecord(json)
  const usage = asRecord(root?.['usage'])
  if (!usage) return undefined
  const promptTokens = typeof usage['prompt_tokens'] === 'number' ? usage['prompt_tokens'] : undefined
  const completionTokens =
    typeof usage['completion_tokens'] === 'number' ? usage['completion_tokens'] : undefined
  if (promptTokens === undefined && completionTokens === undefined) return undefined
  return { promptTokens, completionTokens }
}
