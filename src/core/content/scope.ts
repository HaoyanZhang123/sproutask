import type { KnowledgePoint, StudyMode, StudyPosition, TextbookUnit } from '../domain'
import type { CurriculumRequirement, StudyScope } from './index'

/**
 * 按"学习位置 + 模式"装配要注入模型的上下文（`buildStudyScope` 的纯逻辑部分）。
 *
 * 为什么拆出来：接口 `TextbookLibrary.buildStudyScope()` 要读文件（属主进程能力），
 * 但"装配规则"本身是纯逻辑——放这里就能离线单测（对应 ARCHITECTURE 的"业务逻辑放 core"）。
 *
 * 关键约束（ARCHITECTURE §8）：**只装载"当前位置"对应的内容**，不把整册塞进上下文。
 */

/** 内容源：一个单元 + 它的知识点 + 原文（原文只在本机，见 docs/adr/ADR-0007） */
export interface ScopeSource {
  unit: TextbookUnit
  knowledgePoints: KnowledgePoint[]
  /** sectionId → 教材原文 */
  sectionTexts: Record<string, string>
  curriculumRequirements: CurriculumRequirement[]
}

export interface AssembleScopeInput {
  source: ScopeSource
  position: StudyPosition
  mode: StudyMode
}

export function assembleStudyScope(input: AssembleScopeInput): StudyScope {
  const { source, position, mode } = input

  const sections = position.sectionId
    ? source.unit.sections.filter((section) => section.id === position.sectionId)
    : [...source.unit.sections]

  if (sections.length === 0) {
    throw new Error(`学习位置指向不存在的小节：${position.unitId}/${position.sectionId ?? '(整章)'}`)
  }

  const sectionIds = new Set(sections.map((section) => section.id))

  return {
    position,
    mode,
    unit: source.unit,
    sectionTexts: sections.map((section) => ({
      sectionId: section.id,
      title: section.title,
      // 原文不在本机时给空串：由调用方决定"降级为演示内容"还是"提示未配置"（不在这里编造）
      text: source.sectionTexts[section.id] ?? ''
    })),
    // 只带与当前小节相关的知识点
    knowledgePoints: source.knowledgePoints.filter((kp) =>
      kp.refs.some((ref) => sectionIds.has(ref.sectionId))
    ),
    curriculumRequirements: source.curriculumRequirements.map((req) => req.text)
  }
}

/** 该位置是否有可用原文（决定"用真实内容"还是"回落到演示内容"） */
export function hasUsableText(source: ScopeSource, position: StudyPosition): boolean {
  const sections = position.sectionId
    ? source.unit.sections.filter((section) => section.id === position.sectionId)
    : source.unit.sections
  return sections.some((section) => (source.sectionTexts[section.id] ?? '').trim().length > 0)
}
