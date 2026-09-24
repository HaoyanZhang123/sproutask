import { LLMError, type ChatMessage, type LLMClient, type LLMErrorKind } from '../llm'
import { buildMessages, buildStrictRetryHint, type PromptContext } from '../prompts'
import type { TurnFlag } from '../domain'
import { checkAnswerLeak, type LeakGuardOptions } from './guard'
import type { ToolRegistry } from './tools'
import type { ToolContext } from './tools/types'

/**
 * Agent 循环。
 *
 * 一轮的完整流程：
 *   组装上下文 → 调模型（带工具）→ 有工具调用则执行并回填 → 直到产出最终回答
 *   → 答案泄漏护栏 → 命中则用更严格的指令重新生成一次 → 返回结果（落库由调用方负责）
 *
 * 设计约束：
 *   - 循环上限（默认 5），防空转；超限也要给出可读回复，不能挂住
 *   - 模型调用失败 → 降级为面向学生的中文提示，**不抛给界面**
 *   - 工具失败 → 文本回填给模型自我修正，不打断整轮
 *   - 本函数**不写数据库**：持久化由调用方负责，此处只返回结果
 */

export const DEFAULT_MAX_ITERATIONS = 5

export interface AgentTurnInput {
  client: LLMClient
  registry: ToolRegistry
  /** 提示词上下文（教材/课标/学情/模式与位置） */
  prompt: PromptContext
  /** 之前已完成的对话历史（不含本轮） */
  history?: ChatMessage[]
  /** 学生本轮说的话 */
  userMessage: string
  /** 工具执行上下文 */
  toolContext: Omit<ToolContext, 'scope' | 'flags'>
  maxIterations?: number
  leakGuard?: LeakGuardOptions
  signal?: AbortSignal
  onDelta?: (text: string) => void
}

export interface AgentTurnResult {
  /** 给学生看的回复 */
  reply: string
  /** 本轮实际执行的工具调用（含失败项） */
  toolCalls: Array<{ name: string; ok: boolean }>
  /** 需要落库的标记（护栏命中、疑似抄作业等） */
  flags: TurnFlag[]
  iterations: number
  guard: { checked: boolean; triggered: boolean; regenerated: boolean; reasons: string[] }
  usage?: { promptTokens?: number; completionTokens?: number }
  /** 模型不可用时的降级信息（此时 reply 是可读的替代话术） */
  degraded?: { kind: LLMErrorKind; studentMessage: string }
}

export async function runAgentTurn(input: AgentTurnInput): Promise<AgentTurnResult> {
  const maxIterations = input.maxIterations ?? DEFAULT_MAX_ITERATIONS
  const flags: TurnFlag[] = []
  const toolContext: ToolContext = { ...input.toolContext, scope: input.prompt.scope, flags }

  const messages: ChatMessage[] = buildMessages(
    input.prompt,
    input.history ?? [],
    input.userMessage
  )

  const modelTools = input.registry.toModelTools()
  const executed: Array<{ name: string; ok: boolean }> = []
  let iterations = 0
  let lastContent = ''
  let usage: AgentTurnResult['usage']

  try {
    for (let i = 0; i < maxIterations; i += 1) {
      iterations += 1
      const reply = await input.client.chat(messages, {
        tools: modelTools,
        ...(input.signal ? { signal: input.signal } : {}),
        ...(input.onDelta ? { onDelta: input.onDelta } : {})
      })
      if (reply.usage) usage = reply.usage

      if (reply.toolCalls.length > 0) {
        // 协议要求：assistant 消息携带 tool_calls，随后才是对应的 tool 消息
        messages.push({ role: 'assistant', content: reply.content, toolCalls: reply.toolCalls })
        for (const call of reply.toolCalls) {
          const result = await input.registry.execute(call, toolContext)
          executed.push({ name: result.name, ok: result.ok })
          messages.push({
            role: 'tool',
            content: result.content,
            toolCallId: result.toolCallId,
            name: result.name
          })
        }
        lastContent = reply.content || lastContent
        continue
      }

      lastContent = reply.content
      break
    }
  } catch (error) {
    const kind: LLMErrorKind = error instanceof LLMError ? error.kind : 'network'
    const studentMessage =
      error instanceof LLMError ? error.toStudentMessage() : '我刚才没想清楚，能再问一次吗？'
    return {
      reply: studentMessage,
      toolCalls: executed,
      flags,
      iterations,
      guard: { checked: false, triggered: false, regenerated: false, reasons: [] },
      degraded: { kind, studentMessage }
    }
  }

  // 循环用尽仍在调工具：给一句可读话术，不挂住
  if (!lastContent) {
    // 若只调了工具没产出文本，再要一次纯文本回答
    try {
      const finalMessages: ChatMessage[] = [
        ...messages,
        { role: 'system', content: '请用一两句话直接回应学生，不要调用工具。' }
      ]
      const reply = await input.client.chat(finalMessages, {
        ...(input.signal ? { signal: input.signal } : {}),
        ...(input.onDelta ? { onDelta: input.onDelta } : {})
      })
      iterations += 1
      lastContent = reply.content
      if (reply.usage) usage = reply.usage
    } catch (error) {
      const kind: LLMErrorKind = error instanceof LLMError ? error.kind : 'network'
      const studentMessage =
        error instanceof LLMError ? error.toStudentMessage() : '我们先把这一步理一理，再继续好吗？'
      return {
        reply: studentMessage,
        toolCalls: executed,
        flags,
        iterations,
        guard: { checked: false, triggered: false, regenerated: false, reasons: [] },
        degraded: { kind, studentMessage }
      }
    }
  }

  // ── 空回复：给出可读话术，且**不做护栏重生成**（空文本不是"泄漏答案"，重试纯属浪费） ──
  if (!lastContent.trim()) {
    return {
      reply: '我们先把刚才这一步理一理：你觉得关键在哪里？',
      toolCalls: executed,
      flags: dedupeFlags(flags),
      iterations,
      guard: { checked: false, triggered: false, regenerated: false, reasons: ['模型未产出内容'] },
      ...(usage ? { usage } : {})
    }
  }

  // ── 答案泄漏护栏 ────────────────────────────────────────────
  let reply = lastContent
  let guardResult = await checkAnswerLeak({ reply, scope: input.prompt.scope }, input.leakGuard)
  let regenerated = false

  if (guardResult.leaked) {
    flags.push('answer-leak-guard-triggered')
    try {
      const retryMessages: ChatMessage[] = [
        ...messages,
        { role: 'assistant', content: reply },
        { role: 'system', content: buildStrictRetryHint(guardResult.reasons) }
      ]
      const retry = await input.client.chat(retryMessages, {
        ...(input.signal ? { signal: input.signal } : {}),
        ...(input.onDelta ? { onDelta: input.onDelta } : {})
      })
      iterations += 1
      if (retry.usage) usage = retry.usage
      regenerated = true

      const retryText = retry.content || reply
      const recheck = await checkAnswerLeak(
        { reply: retryText, scope: input.prompt.scope },
        input.leakGuard
      )
      reply = retryText
      guardResult = recheck
      if (recheck.leaked) {
        // 二次仍命中：保留标记（统计用），但不再无限重试
        flags.push('answer-leak-guard-triggered')
      }
    } catch {
      // 重生成失败：保留原回复与标记，降级不抛错
    }
  }

  return {
    reply,
    toolCalls: executed,
    flags: dedupeFlags(flags),
    iterations,
    guard: {
      checked: true,
      triggered: guardResult.leaked || regenerated,
      regenerated,
      reasons: guardResult.reasons
    },
    ...(usage ? { usage } : {})
  }
}

function dedupeFlags(flags: TurnFlag[]): TurnFlag[] {
  return [...new Set(flags)]
}
