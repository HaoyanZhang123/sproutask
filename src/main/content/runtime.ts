import type { StudyMode, StudyPosition } from '../../core/domain'
import type { StudyScope } from '../../core/content'
import { createDemoScope } from '../../core/content/demo'
import { assembleStudyScope, hasUsableText } from '../../core/content/scope'
import {
  describeLoaded,
  loadContentLibrary,
  positionsOf,
  sourceForPosition,
  type LoadedContent
} from './file-library'

/**
 * 运行时内容源：**真实内容优先，缺原文时回落到演示占位**。
 *
 * 为什么需要这一层：
 *   - `content/textbook/`（教材原文）只在本机（docs/adr/ADR-0007），
 *     所以**打包发给学生的机器上一定没有原文** → 必须能优雅回落，不能白屏或编造内容；
 *   - 演示占位内容（`core/content/demo.ts`）因此在"没有内容的机器"上仍然承担演示与自检职责。
 *
 * 有意保持同步（ChatSession 的 scopeFactory 是同步的）：装载在启动时一次性完成，
 * 之后只在内存快照上取用——避免把异步读盘塞进会话状态机。
 */

export interface ContentPosition {
  position: StudyPosition
  label: string
}

export interface ContentRuntime {
  source: 'content' | 'demo'
  /** 给人看的摘要（写进 boot.log 与自检输出） */
  describe: string
  positions: ContentPosition[]
  scopeFor: (position: StudyPosition, mode: StudyMode) => StudyScope
  getSectionText: (sectionId: string) => Promise<string | null>
  notes: string[]
}

export function createContentRuntime(rootDir: string, log?: (line: string) => void): ContentRuntime {
  const loaded = loadContentLibrary(rootDir)
  const notes = loaded?.notes ?? []

  if (loaded) {
    const positions = positionsOf(loaded)
    const usable = positions.find((item) => {
      const source = sourceForPosition(loaded, item.position)
      return source ? hasUsableText(source, item.position) : false
    })
    if (usable) {
      log?.(`内容源：真实内容（${describeLoaded(loaded)}）`)
      for (const note of notes) log?.(`内容装载提示：${note}`)
      return {
        source: 'content',
        describe: describeLoaded(loaded),
        positions,
        scopeFor: (position, mode) => {
          const source = sourceForPosition(loaded, position)
          if (!source) throw new Error(`没有该单元的内容：${position.unitId}`)
          return assembleStudyScope({ source, position, mode })
        },
        getSectionText: async (sectionId) => {
          for (const unit of loaded.units) {
            const text = loaded.byUnit[unit.id]?.sectionTexts[sectionId]
            if (text !== undefined) return text
          }
          return null
        },
        notes
      }
    }
    const reason = `装了 ${loaded.units.length} 个单元，但都取不到教材原文（原文只在本机）`
    log?.(`内容源：演示占位——${reason}`)
    return demoRuntime(demoReasons(notes, reason))
  }

  log?.('内容源：演示占位——本机没有 content/units（内容工程尚未产出或未提取）')
  return demoRuntime(notes)
}

function demoReasons(notes: string[], extra: string): string[] {
  return [...notes, extra]
}

function demoRuntime(notes: string[]): ContentRuntime {
  const demo = createDemoScope()
  const positions: ContentPosition[] = demo.unit.sections.map((section) => ({
    position: { volumeId: demo.position.volumeId, unitId: demo.unit.id, sectionId: section.id },
    label: section.title
  }))

  return {
    source: 'demo',
    describe: `演示占位内容（${positions.length} 节）`,
    positions,
    // 演示内容只有一个单元，位置由 ChatSession 自己覆盖（见 session.currentScope）
    scopeFor: (_position, mode) => createDemoScope(mode),
    getSectionText: async (sectionId) =>
      demo.sectionTexts.find((section) => section.sectionId === sectionId)?.text ?? null,
    notes
  }
}
