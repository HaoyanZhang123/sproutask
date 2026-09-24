/**
 * LLM 抽象层。
 *
 * 为什么要有接口：让上层（Agent 循环）不关心"是 DeepSeek 还是 Mock"，
 * 从而可以用脚本化响应做单元测试、断网演示。
 * 具体实现见 deepseek.ts（真实调用）与本文件的 MockLLMClient（测试/离线）。
 */

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content: string
  /** role = 'tool' 时必填，对应被执行的工具调用 id */
  toolCallId?: string
  /** role = 'tool' 时必填，工具名 */
  name?: string
  /**
   * role = 'assistant' 且该轮返回了工具调用时必填。
   * 协议要求：assistant 消息携带 tool_calls，随后的 tool 消息才能与之对应。
   */
  toolCalls?: ToolCall[]
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
  /** 流式回调：每收到一段增量文本调用一次（便于界面逐字显示） */
  onDelta?: (text: string) => void
}

export interface LLMClient {
  readonly name: string
  chat(messages: ChatMessage[], options?: ChatOptions): Promise<LLMReply>
}

/** LLM 调用失败的分类，供上层给出可读中文提示（不把技术细节抛给学生） */
export type LLMErrorKind =
  | 'missing-key'
  | 'auth'
  | 'balance'
  | 'rate-limit'
  | 'server'
  | 'network'
  | 'bad-response'

export class LLMError extends Error {
  readonly kind: LLMErrorKind
  readonly status?: number

  constructor(kind: LLMErrorKind, message: string, status?: number) {
    super(message)
    this.name = 'LLMError'
    this.kind = kind
    this.status = status
  }

  /** 面向学生的可读文案（不出现密钥、状态码等技术信息） */
  toStudentMessage(): string {
    switch (this.kind) {
      case 'missing-key':
      case 'auth':
        return '我还没拿到"思考的钥匙"（API Key 未配置或无效），请让老师检查一下配置～'
      case 'balance':
        return '我的账户余额用完了，需要老师充值后我才能继续陪你学习～'
      case 'rate-limit':
        return '现在问我的人有点多，稍等一下再问我好吗？'
      case 'network':
      case 'server':
        return '我现在连不上"外脑"啦，你可以先看看教材，等会儿再来问我～'
      default:
        return '我刚才没想清楚，能再问一次吗？'
    }
  }
}

/**
 * Mock 客户端：按脚本返回预设回复，用于测试与无网演示。
 * 脚本耗尽后返回兜底话术，绝不抛错——课堂上不能因为 mock 崩掉。
 * 若提供了 onDelta，会把回复按小段"流式"吐出，用于验证界面的逐字渲染。
 */
export class MockLLMClient implements LLMClient {
  readonly name = 'mock'
  private readonly script: LLMReply[]
  private cursor = 0

  constructor(script: LLMReply[] = []) {
    this.script = script
  }

  /** 已消耗的脚本条数（测试用） */
  get consumed(): number {
    return this.cursor
  }

  async chat(_messages: ChatMessage[], options?: ChatOptions): Promise<LLMReply> {
    const reply = this.script[this.cursor] ?? {
      content: '（Mock 模式：脚本已用尽，请在 evals/ 中补充用例）',
      toolCalls: []
    }
    this.cursor += 1

    if (options?.onDelta && reply.content) {
      for (const piece of chunk(reply.content, 6)) {
        options.onDelta(piece)
      }
    }
    return reply
  }
}

function chunk(text: string, size: number): string[] {
  const out: string[] = []
  for (let i = 0; i < text.length; i += size) out.push(text.slice(i, i + size))
  return out
}
