import { STUDY_MODE_LABELS, type StudyMode, type StudyPosition } from '../domain'

/**
 * 意图询问与模式选择流程。
 *
 * 2026-09 决策：Agent **不猜**"这周教到哪"，而是主动询问，学生四选一
 * （预习 / 复习 / 做题 / 拓展），再确定学习位置。
 *
 * 设计要点：
 *   - 全部逻辑为纯函数 + 一个可注入 `ask` 的状态机，便于单测、也便于将来换成图形界面
 *   - 位置策略：有上次位置则"回车即继续"，也可手动改
 *   - 学生用非常规说法识别失败时重问，超过上限才回退（回退会如实标记，不静默）
 */

/** 选项展示顺序（编号 1–4 即按此顺序） */
export const MODE_ORDER: StudyMode[] = ['preview', 'review', 'practice', 'extension']

/** 各模式的一句话说明（界面按钮与开场问句共用） */
export const MODE_HINTS: Record<StudyMode, string> = {
  preview: '还没学过，先看看',
  review: '学过了，巩固一下',
  practice: '练一练，做点题',
  extension: '联系生活，了解更多'
}

/** 关键词表：按"越具体越靠前"的顺序匹配，避免"题"误命中"做题"以外的含义 */
const MODE_KEYWORDS: Array<{ mode: StudyMode; keywords: string[] }> = [
  { mode: 'preview', keywords: ['预习', '预学', '提前学', '先看看', '自学'] },
  {
    mode: 'practice',
    keywords: ['做题', '刷题', '刷几', '刷', '练习题', '练习', '练一练', '练', '作业', '测验', '测试', '考我']
  },
  { mode: 'review', keywords: ['复习', '回顾', '巩固', '温习', '梳理', '总结'] },
  { mode: 'extension', keywords: ['拓展', '扩展', '延伸', '了解更多', '深一点', '联系生活'] }
]

/**
 * 解析学生对"想做什么"的回答。
 * 支持：模式名（预习/复习/做题/拓展）、编号（1–4 / 第1个）、常见同义词。
 * 识别不了返回 null（由调用方重问），**绝不瞎猜**。
 */
export function parseStudyMode(input: string): StudyMode | null {
  const text = input.trim().toLowerCase().replace(/\s+/g, '')
  if (!text) return null

  // 编号：1 / 1. / 第1个 / 一
  const byIndex = matchIndex(text)
  if (byIndex !== null) return MODE_ORDER[byIndex] ?? null

  // 模式名（如"复习"、"我想复习一下"）
  for (const mode of MODE_ORDER) {
    if (text.includes(STUDY_MODE_LABELS[mode])) return mode
    // 也接受英文枚举名，便于开发期测试
    if (text === mode) return mode
  }

  // 同义词
  for (const { mode, keywords } of MODE_KEYWORDS) {
    if (keywords.some((keyword) => text.includes(keyword))) return mode
  }

  return null
}

function matchIndex(text: string): number | null {
  const arabic = text.match(/^(?:第)?([1-4])(?:个|项|种|\.|、)?$/)
  if (arabic?.[1]) return Number(arabic[1]) - 1

  const chinese: Record<string, number> = { 一: 0, 二: 1, 三: 2, 四: 3 }
  const cjk = text.match(/^第?([一二三四])(?:个|项|种)?$/)
  if (cjk?.[1] !== undefined) return chinese[cjk[1]] ?? null

  return null
}

/** 开场问句：Agent 主动发问，给出四个选项 */
export function buildOpeningQuestion(options: { lastPositionLabel?: string } = {}): string {
  const lines = ['今天想做什么呢？🌱', '']
  MODE_ORDER.forEach((mode, index) => {
    lines.push(`  ${index + 1} ${STUDY_MODE_LABELS[mode]}（${MODE_HINTS[mode]}）`)
  })
  lines.push('', '回复数字，或者直接说"我想复习"都可以～')
  if (options.lastPositionLabel) {
    lines.push(`（上次你在：${options.lastPositionLabel}）`)
  }
  return lines.join('\n')
}

/* ── 学习位置 ─────────────────────────────────────────────── */

export interface PositionOption {
  position: StudyPosition
  /** 给学生看的名称，如"第二单元第一章第四节 细胞的生活" */
  label: string
}

export function describePosition(position: StudyPosition): string {
  const parts = [position.volumeId, position.unitId, position.sectionId].filter(Boolean)
  return parts.join(' · ')
}

export function buildPositionQuestion(options: {
  options: PositionOption[]
  lastPositionLabel?: string
}): string {
  const lines = ['那我们从哪里开始呢？', '']
  options.options.forEach((option, index) => {
    lines.push(`  ${index + 1} ${option.label}`)
  })
  lines.push('')
  if (options.lastPositionLabel) {
    lines.push(`直接回车＝继续上次：${options.lastPositionLabel}`)
  } else {
    lines.push('回复数字或章节名称都可以～')
  }
  return lines.join('\n')
}

/**
 * 解析位置选择。
 * 空输入且已知上次位置 → 返回 'last'（由调用方取上次位置）。
 */
export function parsePositionChoice(
  input: string,
  options: PositionOption[]
): PositionOption | 'last' | null {
  const text = input.trim()
  if (!text) return 'last'

  const compact = text.toLowerCase().replace(/\s+/g, '')
  const byIndex = compact.match(/^(?:第)?([1-9]\d?)(?:个|项|\.|、)?$/)
  if (byIndex?.[1]) {
    const option = options[Number(byIndex[1]) - 1]
    if (option) return option
    return null
  }

  const byLabel = options.find(
    (option) =>
      option.label.replace(/\s+/g, '') === compact || option.label.replace(/\s+/g, '').includes(compact)
  )
  if (byLabel) return byLabel

  const byId = options.find(
    (option) =>
      option.position.sectionId === text ||
      option.position.unitId === text ||
      describePosition(option.position) === text
  )
  return byId ?? null
}

/* ── 状态机 ───────────────────────────────────────────────── */

export type IntentState = 'awaiting-mode' | 'awaiting-position' | 'ready'

export interface IntentResult {
  mode: StudyMode
  position: StudyPosition
  /** 是否因识别失败而回退（回退必须如实标记，供统计） */
  fallbackUsed: boolean
}

export interface IntentFlowDeps {
  /** 向学生发问并取得回答（终端注入 readline；测试注入脚本化回答） */
  ask: (question: string) => Promise<string>
  /** 可选的学习位置；为空则不询问位置（由调用方给出默认位置） */
  positions?: PositionOption[]
  /** 上次的学习位置（回车即继续） */
  lastPosition?: { position: StudyPosition; label: string } | null
  /** 最多重问次数，超过则回退到"复习" */
  maxRetries?: number
}

const DEFAULT_MAX_RETRIES = 3
const FALLBACK_MODE: StudyMode = 'review'

export class IntentFlow {
  private state: IntentState = 'awaiting-mode'
  private readonly maxRetries: number

  constructor(private readonly deps: IntentFlowDeps) {
    this.maxRetries = deps.maxRetries ?? DEFAULT_MAX_RETRIES
  }

  getState(): IntentState {
    return this.state
  }

  async run(): Promise<IntentResult> {
    const { mode, fallbackUsed } = await this.resolveMode()
    const position = await this.resolvePosition()
    this.state = 'ready'
    return { mode, position, fallbackUsed }
  }

  private async resolveMode(): Promise<{ mode: StudyMode; fallbackUsed: boolean }> {
    const question = buildOpeningQuestion({
      ...(this.deps.lastPosition ? { lastPositionLabel: this.deps.lastPosition.label } : {})
    })

    for (let attempt = 0; attempt < this.maxRetries; attempt += 1) {
      const answer = await this.deps.ask(question)
      const mode = parseStudyMode(answer)
      if (mode) return { mode, fallbackUsed: false }
    }

    // 超过重问上限：回退到最安全的"复习"，并如实标记
    return { mode: FALLBACK_MODE, fallbackUsed: true }
  }

  private async resolvePosition(): Promise<StudyPosition> {
    const options = this.deps.positions ?? []
    const last = this.deps.lastPosition ?? null

    // 只有一个可选位置：直接选定，不必打扰学生
    if (options.length <= 1) {
      return options[0]?.position ?? last?.position ?? FALLBACK_POSITION
    }

    this.state = 'awaiting-position'
    const question = buildPositionQuestion({
      options,
      ...(last ? { lastPositionLabel: last.label } : {})
    })

    for (let attempt = 0; attempt < this.maxRetries; attempt += 1) {
      const answer = await this.deps.ask(question)
      const choice = parsePositionChoice(answer, options)
      if (choice === 'last') return last?.position ?? options[0]?.position ?? FALLBACK_POSITION
      if (choice) return choice.position
    }

    // 位置识别失败：回到上次位置（若有），否则第一个
    return last?.position ?? options[0]?.position ?? FALLBACK_POSITION
  }
}

/** 兜底位置：正常情况下不会用到（调用方总会给出位置或上次位置） */
const FALLBACK_POSITION: StudyPosition = { volumeId: 'unknown', unitId: 'unknown' }
