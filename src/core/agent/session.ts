import type { StudyScope } from '../content'
import { STUDY_MODE_LABELS, type StudyMode, type StudyPosition } from '../domain'
import type { ChatMessage, LLMClient } from '../llm'
import { buildOpeningQuestion, MODE_HINTS, MODE_ORDER, parseStudyMode } from './intent'
import { runAgentTurn, type AgentTurnResult } from './loop'
import type { LeakGuardOptions } from './guard'
import type { ToolRegistry } from './tools'

/**
 * 一次学习会话的状态机。
 *
 * 为什么放在 core：桌面界面（渲染进程）不该持有教学状态，主进程也不该写业务逻辑。
 * 会话只关心"现在什么模式、位置在哪、聊过什么"，并把这轮交给 Agent 循环。
 * 这样界面层只剩"显示与转发"，也让整套流程可以在没有 Electron 的情况下被单测。
 *
 * 注意：**不写数据库**（持久化由调用方负责）；历史只保存在内存里，关掉应用即消失。
 */

const MAX_HISTORY_MESSAGES = 24

export interface SessionOption {
  mode: StudyMode
  label: string
  hint: string
}

export interface SessionStartInfo {
  /** Agent 的开场问句（主动询问想做什么） */
  question: string
  /** 四种可选模式（界面渲染成按钮） */
  options: SessionOption[]
}

export type ChooseModeResult =
  | { ok: true; mode: StudyMode; modeLabel: string; positionLabel: string }
  | { ok: false; message: string }

export type ChatOutcome =
  | { needsMode: true; message: string }
  | ({ needsMode: false } & AgentTurnResult)

export interface ChatSessionDeps {
  client: LLMClient
  registry: ToolRegistry
  /** 按模式生成学习上下文（内容库落地前由演示内容提供） */
  scopeFactory: (mode: StudyMode) => StudyScope
  getSectionText: (sectionId: string) => Promise<string | null>
  studentId: string
  /** 可选位置列表；只有一个时自动选定（自动恢复上次位置 + 可手动改） */
  positions?: Array<{ position: StudyPosition; label: string }>
  lastPosition?: { position: StudyPosition; label: string } | null
  leakGuard?: LeakGuardOptions
}

export class ChatSession {
  private mode: StudyMode | null = null
  private position: StudyPosition | null = null
  private positionLabel = ''
  private history: ChatMessage[] = []
  private fallbackUsed = false

  constructor(private readonly deps: ChatSessionDeps) {}

  /** 开场：返回主动询问的问句与四个选项 */
  start(): SessionStartInfo {
    const options: SessionOption[] = MODE_ORDER.map((mode) => ({
      mode,
      label: STUDY_MODE_LABELS[mode],
      hint: MODE_HINTS[mode]
    }))
    const last = this.deps.lastPosition
    return {
      question: buildOpeningQuestion(last ? { lastPositionLabel: last.label } : {}),
      options
    }
  }

  /**
   * 学生选定模式。input 可以是"复习"、数字"2"，也可以是一句话——复用与终端相同的解析规则，
   * 识别不了就明确说"没听懂"，不瞎猜。
   */
  chooseMode(input: string): ChooseModeResult {
    const mode = parseStudyMode(input)
    if (!mode) {
      return {
        ok: false,
        message: '我没听懂你想做什么～可以直接回复数字 1-4，或者说"我想复习"。'
      }
    }

    this.mode = mode
    const fallbackScope = this.deps.scopeFactory(mode)
    const chosen = this.deps.lastPosition?.position ?? this.deps.positions?.[0]?.position
    this.position = chosen ?? fallbackScope.position
    this.positionLabel =
      this.deps.lastPosition?.label ??
      this.deps.positions?.[0]?.label ??
      fallbackScope.unit.sections[0]?.title ??
      '当前章节'

    return {
      ok: true,
      mode,
      modeLabel: STUDY_LABEL(mode),
      positionLabel: this.positionLabel
    }
  }

  /** 学生发一句话：交给 Agent 循环（含工具调用与答案泄漏护栏） */
  async chat(userMessage: string): Promise<ChatOutcome> {
    const scoped = this.currentScope()
    if (!scoped) {
      return { needsMode: true, message: '先告诉我今天想做什么吧：预习、复习、做题，还是拓展？' }
    }

    const result = await runAgentTurn({
      client: this.deps.client,
      registry: this.deps.registry,
      prompt: { scope: scoped, mastery: [] },
      history: this.history,
      userMessage,
      toolContext: {
        studentId: this.deps.studentId,
        getSectionText: this.deps.getSectionText
      },
      ...(this.deps.leakGuard ? { leakGuard: this.deps.leakGuard } : {})
    })

    this.history.push({ role: 'user', content: userMessage })
    this.history.push({ role: 'assistant', content: result.reply })
    if (this.history.length > MAX_HISTORY_MESSAGES) {
      this.history = this.history.slice(-MAX_HISTORY_MESSAGES)
    }

    return { needsMode: false, ...result }
  }

  /**
   * 当前学习上下文（教材阅读视图要用）。
   * 未选模式时返回 null——此时界面还在问"今天想做什么"。
   * 与 chat() 共用同一份装配逻辑，避免两处各建一份导致上下文不一致。
   */
  currentScope(): StudyScope | null {
    if (!this.mode || !this.position) return null
    const scope = this.deps.scopeFactory(this.mode)
    // 把会话选定的位置写回上下文，保证"按位置装载"这条链路一致
    return { ...scope, position: this.position }
  }

  getState(): {
    mode: StudyMode | null
    modeLabel: string | null
    positionLabel: string
    historyLength: number
    fallbackUsed: boolean
  } {
    return {
      mode: this.mode,
      modeLabel: this.mode ? STUDY_LABEL(this.mode) : null,
      positionLabel: this.positionLabel,
      historyLength: this.history.length,
      fallbackUsed: this.fallbackUsed
    }
  }

  reset(): void {
    this.mode = null
    this.position = null
    this.positionLabel = ''
    this.history = []
    this.fallbackUsed = false
  }
}

function STUDY_LABEL(mode: StudyMode): string {
  return STUDY_MODE_LABELS[mode]
}
