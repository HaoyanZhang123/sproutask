import { z } from 'zod'
import { KnowledgePointSchema, TextbookUnitSchema } from '../domain'

/**
 * 内容文件（`content/units/<unit-id>/`）的格式与校验。
 *
 * 分工（见 docs/ARCHITECTURE.md 与 docs/adr/ADR-0007）：
 *   - `content/units/` 进 git：**我们自己的**教学设计（知识点、误区、出处页码）
 *   - `content/textbook/` 不进 git：教材原文（版权物），只在本机
 *
 * 本文件只做"结构校验"（纯逻辑、可离线单测）；读文件与跑校验在
 * `scripts/content-validate.ts`（需要 node:fs，属主进程/脚本侧能力）。
 */

/** 溯源信息：只给人看（版本、页码范围、提取方式、是否已核对），不参与契约 */
export const ProvenanceSchema = z.record(z.string(), z.unknown()).optional()

export const UnitFileSchema = z.object({
  provenance: ProvenanceSchema,
  unit: TextbookUnitSchema
})
export type UnitFile = z.infer<typeof UnitFileSchema>

export const KnowledgePointsFileSchema = z.object({
  knowledgePoints: z.array(KnowledgePointSchema).min(1)
})
export type KnowledgePointsFile = z.infer<typeof KnowledgePointsFileSchema>

/**
 * 课标要求（`content/units/<unit>/curriculum.yaml`，可选）。
 * 只放"条目编号 + 短引用 + 来源"，不放课标全文（版权与体积，见 docs/adr/ADR-0007）。
 */
export const CurriculumFileSchema = z.object({
  requirements: z
    .array(
      z.object({
        id: z.string().min(1),
        /** 来源文件名，如「义务教育生物学课程标准（2022年版）」 */
        source: z.string().min(1),
        /** 要求原文（短引用） */
        text: z.string().min(1),
        kpId: z.string().optional()
      })
    )
    .default([])
})
export type CurriculumFile = z.infer<typeof CurriculumFileSchema>

export interface ContentIssue {
  level: 'error' | 'warn'
  message: string
}

/** summary 里至少要有一个标点：护栏按"≥6 字片段"判定，无标点的整句会让护栏失效 */
const HAS_PUNCTUATION = /[、，；。：,;:]/

export function validateContent(input: {
  unitFile: UnitFile
  kpFile: KnowledgePointsFile
  /** 课标要求文件（可选；有则校验 kpId 是否指向存在的知识点） */
  curriculumFile?: CurriculumFile
}): ContentIssue[] {
  const issues: ContentIssue[] = []
  const { unit } = input.unitFile
  const kps = input.kpFile.knowledgePoints
  const sectionIds = new Set(unit.sections.map((s) => s.id))
  const kpIds = new Set(kps.map((kp) => kp.id))

  // 0) 课标要求里的 kpId 必须指向存在的知识点（写错一个字母就悄悄失效，必须挡住）
  for (const requirement of input.curriculumFile?.requirements ?? []) {
    if (requirement.kpId && !kpIds.has(requirement.kpId)) {
      issues.push({
        level: 'error',
        message: `课标要求 ${requirement.id} 指向不存在的知识点：${requirement.kpId}`
      })
    }
  }

  // 1) 重复 id
  const seen = new Set<string>()
  for (const kp of kps) {
    if (seen.has(kp.id)) issues.push({ level: 'error', message: `知识点 id 重复：${kp.id}` })
    seen.add(kp.id)
  }

  for (const kp of kps) {
    // 2) unitId 必须指向本单元
    if (kp.unitId !== unit.id) {
      issues.push({
        level: 'error',
        message: `${kp.id} 的 unitId（${kp.unitId}）与本单元（${unit.id}）不一致`
      })
    }
    // 3) 出处必须指向存在的小节
    for (const ref of kp.refs) {
      if (!sectionIds.has(ref.sectionId)) {
        issues.push({ level: 'error', message: `${kp.id} 引用了不存在的小节：${ref.sectionId}` })
      }
    }
    // 4) 前置知识必须存在
    for (const pre of kp.prerequisites) {
      if (!kpIds.has(pre)) {
        issues.push({ level: 'error', message: `${kp.id} 的前置知识不存在：${pre}` })
      }
    }
    // 5) 护栏有效性：summary 必须有标点（否则答案泄漏护栏形同虚设）
    if (!HAS_PUNCTUATION.test(kp.summary)) {
      issues.push({
        level: 'warn',
        message: `${kp.id} 的 summary 没有标点：护栏按"≥6 字片段"判定，会整句匹配不上而失效`
      })
    }
    // 6) 每条知识点都要能指到某页（没有页码，"出处"就说不清）
    for (const ref of kp.refs) {
      if (ref.page === undefined) {
        issues.push({ level: 'warn', message: `${kp.id} 的出处没有页码（学生拿着课本对不上）` })
      }
    }
  }

  // 7) 前置知识不得成环
  const state = new Map<string, 'visiting' | 'done'>()
  const byId = new Map(kps.map((kp) => [kp.id, kp]))
  const walk = (id: string, path: string[]): void => {
    if (state.get(id) === 'done') return
    if (state.get(id) === 'visiting') {
      issues.push({ level: 'error', message: `前置知识成环：${[...path, id].join(' → ')}` })
      return
    }
    state.set(id, 'visiting')
    for (const pre of byId.get(id)?.prerequisites ?? []) {
      if (byId.has(pre)) walk(pre, [...path, id])
    }
    state.set(id, 'done')
  }
  for (const kp of kps) walk(kp.id, [])

  return issues
}
