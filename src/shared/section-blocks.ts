/**
 * 小节正文 → 结构化区块（供教材阅读视图渲染）。
 *
 * 约定（见 docs/adr/ADR-0003 的"决策三"与 docs/ARCHITECTURE.md 的内容工程一节）：
 *   - 普通段落：直接写
 *   - 可折叠的"想一想/讨论"：`:::think 想一想` … `:::`
 *   - 可折叠的答案：`:::answer` … `:::`
 *
 * 为什么用这种标记而不是 HTML `<details>`：
 *   1. 渲染层用 Vue 组件输出，**完全不用 v-html**——教材内容可能是他人编写的文件，
 *      直接注入 HTML 会有 XSS 风险，且与渲染进程的 CSP 收紧策略冲突；
 *   2. 不引入第三方 Markdown 渲染器，少一份供应链与依赖；
 *   3. 纯文本标记对内容作者（教师）最友好，出错了也能一眼看出来。
 *
 * 宽容策略：**未闭合的块退化为普通文本**。宁可让内容多显示出来，
 * 也不能因为少写一个 `:::` 就把整节内容静默折叠隐藏。
 */

export type SectionBlockType = 'text' | 'think' | 'answer'

export interface SectionBlock {
  type: SectionBlockType
  /** think 块标题（如"想一想""讨论"）；answer 块固定为"参考答案" */
  title?: string
  /** 区块正文（保留段落内换行，块尾不留空行） */
  body: string
  /** 在原文中出现的序号（从 0 开始），供渲染 key 与定位使用 */
  index: number
}

/** answer 块的默认标题 */
export const ANSWER_TITLE = '参考答案'
/** think 块的默认标题 */
export const THINK_TITLE = '想一想'

const MARKER_PREFIX = ':::'
const ANSWER_MARKER = ':::answer'
const THINK_MARKER = ':::think'

export function parseSectionBlocks(text: string): SectionBlock[] {
  const blocks: SectionBlock[] = []
  let pendingText: string[] = []
  let open: { type: 'think' | 'answer'; title: string; lines: string[] } | null = null

  const flushText = (): void => {
    const body = trimBlankEdges(pendingText).join('\n')
    if (body) blocks.push({ type: 'text', body, index: blocks.length })
    pendingText = []
  }

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trimEnd()

    if (open) {
      if (line.trim() === MARKER_PREFIX) {
        const body = trimBlankEdges(open.lines).join('\n')
        blocks.push({ type: open.type, title: open.title, body, index: blocks.length })
        open = null
      } else {
        open.lines.push(line)
      }
      continue
    }

    const trimmed = line.trim()
    if (trimmed.startsWith(ANSWER_MARKER)) {
      flushText()
      open = { type: 'answer', title: ANSWER_TITLE, lines: [] }
      continue
    }
    if (trimmed.startsWith(THINK_MARKER)) {
      flushText()
      const custom = trimmed.slice(THINK_MARKER.length).trim()
      open = { type: 'think', title: custom || THINK_TITLE, lines: [] }
      continue
    }

    pendingText.push(line)
  }

  // 未闭合：把标记行丢掉、内容按普通文本输出（不静默折叠）
  if (open) {
    const body = trimBlankEdges(open.lines).join('\n')
    if (body) {
      blocks.push({ type: 'text', body, index: blocks.length })
    }
  } else {
    flushText()
  }

  return blocks
}

/** 去掉首尾的空行（段落内部空行保留） */
function trimBlankEdges(lines: string[]): string[] {
  let start = 0
  let end = lines.length
  while (start < end && lines[start]?.trim() === '') start += 1
  while (end > start && lines[end - 1]?.trim() === '') end -= 1
  return lines.slice(start, end)
}

/* ── 搜索高亮 ─────────────────────────────────────────────── */

export interface HighlightSegment {
  text: string
  hit: boolean
}

/**
 * 把文本按查询词切成"命中/未命中"片段（大小写不敏感，适配中文）。
 * 空查询返回整段未命中，便于渲染层统一处理。
 */
export function splitHighlights(text: string, query: string): HighlightSegment[] {
  const needle = query.trim()
  if (!needle) return text ? [{ text, hit: false }] : []

  const haystack = text.toLowerCase()
  const lowerNeedle = needle.toLowerCase()
  const segments: HighlightSegment[] = []
  let cursor = 0

  for (;;) {
    const at = haystack.indexOf(lowerNeedle, cursor)
    if (at === -1) break
    if (at > cursor) segments.push({ text: text.slice(cursor, at), hit: false })
    segments.push({ text: text.slice(at, at + needle.length), hit: true })
    cursor = at + needle.length
  }
  if (cursor < text.length) segments.push({ text: text.slice(cursor), hit: false })
  return segments
}

/** 统计某查询词在整节（含折叠块）中命中的次数——用于"共 N 处"提示 */
export function countMatches(blocks: SectionBlock[], query: string): number {
  const needle = query.trim().toLowerCase()
  if (!needle) return 0
  let total = 0
  for (const block of blocks) {
    const haystack = block.body.toLowerCase()
    let cursor = 0
    for (;;) {
      const at = haystack.indexOf(needle, cursor)
      if (at === -1) break
      total += 1
      cursor = at + needle.length
    }
  }
  return total
}

/** 该查询词是否只出现在折叠块里（界面可据此提示"在折叠的答案中"） */
export function matchesOnlyInCollapsed(blocks: SectionBlock[], query: string): boolean {
  const inVisible = countMatches(
    blocks.filter((b) => b.type === 'text'),
    query
  )
  const total = countMatches(blocks, query)
  return total > 0 && inVisible === 0
}

/* ── 出处定位 ─────────────────────────────────────────────── */

/**
 * 从 Agent 的回复里找出"指向教材出处的词"，供阅读视图自动定位并高亮。
 *
 * 为什么放在 core：这是"答案必须有出处"这条产品原则的落地环节——
 * 回复提到出处时，教材区要能自动滚过去，学生才验证得了"书上真是这么说的"。
 * 纯函数便于单测，渲染进程只负责滚动。
 *
 * 匹配顺序：先试给定候选词（章节标题，长的在前），再退回 `第X节 / 第X章` 形式。
 */
export function extractCitation(reply: string, candidates: string[] = []): string | null {
  const text = reply.trim()
  if (!text) return null

  const ordered = [...candidates]
    .map((c) => c.trim())
    .filter(Boolean)
    .sort((a, b) => b.length - a.length)
  for (const candidate of ordered) {
    if (text.includes(candidate)) return candidate
  }

  const pattern = /第[一二三四五六七八九十百]+[章节]/
  const match = text.match(pattern)
  return match ? match[0] : null
}
