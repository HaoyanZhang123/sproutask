/**
 * LLM 抽象层。
 *
 * 为什么要有接口：让上层（Agent 循环）不关心"是 DeepSeek 还是 Mock"，
 * 从而可以用脚本化响应做单元测试、断网演示（M1 落地 DeepSeek 实现）。
 */

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content: string
  /** role = 'tool' 时必填，对应被执行的工具调用 id */
  toolCallId?: string
  /** role = 'tool' 时必填，工具名 */
  name?: string
}

export interface ToolCall {
  id: string
  name: string
  /** 模型返回的 JSON 字符串参数，由工具自己的 Zod Schema 解析 */
  arguments: string
}

export interface LLMReply {
  content: string
  toolCalls: ToolCall[]
  usage?: { promptTokens?: number; completionTokens?: number }
}

export interface ChatOptions {
  /** 工具定义（JSON Schema 形式），无工具时省略 */
  tools?: unknown[]
  temperature?: number
  signal?: AbortSignal
}

export interface LLMClient {
  readonly name: string
  chat(messages: ChatMessage[], options?: ChatOptions): Promise<LLMReply>
}

/**
 * Mock 客户端：按脚本返回预设回复，用于测试与无网演示。
 * 脚本耗尽后返回兜底话术，绝不抛错——课堂上不能因为 mock 崩掉。
 */
export class MockLLMClient implements LLMClient {
  readonly name = 'mock'
  private readonly script: LLMReply[]
  private cursor = 0

  constructor(script: LLMReply[] = []) {
    this.script = script
  }

  async chat(_messages: ChatMessage[], _options?: ChatOptions): Promise<LLMReply> {
    const reply = this.script[this.cursor]
    this.cursor += 1
    return reply ?? { content: '（Mock 模式：脚本已用尽，请在 evals/ 中补充用例）', toolCalls: [] }
  }
}
