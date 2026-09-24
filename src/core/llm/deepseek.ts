import type { ChatMessage, ChatOptions, LLMClient, LLMReply } from './index'
import { LLMError } from './index'
import { applyDelta, createAccumulator, finalize, parseSSELine, splitLines } from './sse'

/**
 * DeepSeek 客户端（OpenAI 兼容接口，流式）。
 *
 * 约定：
 *   - 只用 `fetch`，不引入 SDK——少一个依赖、行为更可控
 *   - 所有失败都映射为 LLMError，上层用 `toStudentMessage()` 给出可读中文提示
 *   - 密钥只从这里读出后放在请求头，**绝不落日志、不进错误信息**
 */

export interface DeepSeekConfig {
  apiKey: string
  baseUrl?: string
  model?: string
  /** 默认温度：教学场景要稳不要飘 */
  temperature?: number
}

interface ApiMessage {
  role: string
  content: string
  tool_call_id?: string
  name?: string
  /** assistant 消息携带的工具调用（协议必需，否则后续 tool 消息无法对应） */
  tool_calls?: Array<{ id: string; type: 'function'; function: { name: string; arguments: string } }>
}

export class DeepSeekClient implements LLMClient {
  readonly name = 'deepseek'
  private readonly baseUrl: string
  private readonly model: string
  private readonly apiKey: string
  private readonly defaultTemperature: number

  constructor(config: DeepSeekConfig) {
    this.apiKey = config.apiKey
    this.baseUrl = (config.baseUrl ?? 'https://api.deepseek.com').replace(/\/+$/, '')
    this.model = config.model ?? 'deepseek-chat'
    this.defaultTemperature = config.temperature ?? 0.3
  }

  async chat(messages: ChatMessage[], options: ChatOptions = {}): Promise<LLMReply> {
    if (!this.apiKey) {
      throw new LLMError('missing-key', '未配置 DeepSeek API Key（请在 .env 中设置 DEEPSEEK_API_KEY）')
    }

    const body: Record<string, unknown> = {
      model: this.model,
      messages: messages.map(toApiMessage),
      temperature: options.temperature ?? this.defaultTemperature,
      stream: true,
      stream_options: { include_usage: true }
    }
    if (options.tools && options.tools.length > 0) body['tools'] = options.tools

    let response: Response
    try {
      response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`
        },
        body: JSON.stringify(body),
        ...(options.signal ? { signal: options.signal } : {})
      })
    } catch (error) {
      // 网络异常（DNS/超时/断网）——注意不要把请求体写进错误信息（含密钥的 header 更不能）
      const detail = error instanceof Error ? error.message : String(error)
      throw new LLMError('network', `请求 DeepSeek 失败：${detail}`)
    }

    if (!response.ok) {
      throw await mapHttpError(response)
    }
    if (!response.body) {
      throw new LLMError('bad-response', 'DeepSeek 返回了空响应体')
    }

    return this.readStream(response.body, options)
  }

  /** 逐块读取 SSE，边累积边回调增量 */
  private async readStream(
    stream: ReadableStream<Uint8Array>,
    options: ChatOptions
  ): Promise<LLMReply> {
    const reader = stream.getReader()
    const decoder = new TextDecoder('utf-8')
    const acc = createAccumulator()
    let buffer = ''

    try {
      for (;;) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const { lines, rest } = splitLines(buffer)
        buffer = rest

        for (const line of lines) {
          const parsed = parseSSELine(line)
          if (parsed === null) continue
          if (parsed === 'done') {
            return finalize(acc)
          }
          applyDelta(acc, parsed)
          if (parsed.content) options.onDelta?.(parsed.content)
        }
      }
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error)
      throw new LLMError('network', `读取流式响应中断：${detail}`)
    } finally {
      reader.releaseLock()
    }

    // 流自然结束（未见 [DONE]）也要给出结果，避免界面卡住
    return finalize(acc)
  }
}

/**
 * 把内部消息转换为接口格式。
 * **导出以便离线单测**：工具调用的序列化是"循环能否跑通"的关键协议细节，
 * 不能只靠联调验证（见 tests/agent-loop.test.ts 与 tests/sse.test.ts）。
 */
export function toApiMessage(message: ChatMessage): ApiMessage {
  const out: ApiMessage = { role: message.role, content: message.content }
  if (message.toolCallId) out.tool_call_id = message.toolCallId
  if (message.name) out.name = message.name
  if (message.toolCalls && message.toolCalls.length > 0) {
    out.tool_calls = message.toolCalls.map((call) => ({
      id: call.id,
      type: 'function' as const,
      function: { name: call.name, arguments: call.arguments }
    }))
  }
  return out
}

async function mapHttpError(response: Response): Promise<LLMError> {
  const status = response.status
  // 服务端返回的错误正文可能含提示信息，但不含我们的密钥；仍做长度截断
  let detail = ''
  try {
    detail = (await response.text()).slice(0, 300)
  } catch {
    detail = ''
  }

  if (status === 401 || status === 403) {
    return new LLMError('auth', `DeepSeek 鉴权失败（${status}）${detail}`, status)
  }
  if (status === 402) {
    return new LLMError('balance', `DeepSeek 账户余额不足（${status}）`, status)
  }
  if (status === 429) {
    return new LLMError('rate-limit', `DeepSeek 限流（${status}）`, status)
  }
  if (status >= 500) {
    return new LLMError('server', `DeepSeek 服务端错误（${status}）${detail}`, status)
  }
  return new LLMError('bad-response', `DeepSeek 请求失败（${status}）${detail}`, status)
}
