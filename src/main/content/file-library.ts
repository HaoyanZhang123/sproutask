import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { parse as parseYaml } from 'yaml'
import type { KnowledgePoint, StudyPosition, TextbookUnit } from '../../core/domain'
import type { CurriculumRequirement } from '../../core/content'
import {
  CurriculumFileSchema,
  KnowledgePointsFileSchema,
  UnitFileSchema
} from '../../core/content/schema'
import type { ScopeSource } from '../../core/content/scope'

/**
 * 从**本机文件**装载教学内容（`content/units/*` 结构 + `content/textbook/**` 原文）。
 *
 * 分层：接口在 `src/core/content`，实现放 main（读文件属宿主能力）——
 * 与"存储/内容实现由主进程注入"的约定一致（docs/ARCHITECTURE.md）。
 *
 * 合规（docs/adr/ADR-0007）：
 *   - `content/units/` 进 git：我们自己的教学设计（知识点、误区、出处页码）
 *   - `content/textbook/` 只在本机：教材原文，**不随包、不进公开仓库**
 *   - 因此打包给学生的机器上没有原文 → 本模块会报告"原文不在本机"，
 *     由调用方（main）决定回落到演示内容或提示未配置，**不在这里编造内容**
 */

export interface LoadedContent {
  /** 数据来源标记：content＝真实内容；none＝本机没有内容工程产物 */
  source: 'content'
  units: TextbookUnit[]
  byUnit: Record<string, ScopeSource>
  /** unitId → 册次（取自 unit.yaml 的 provenance.volumeId，缺省用 rjb-7s） */
  volumeIdByUnit: Record<string, string>
  /** 装载过程中的提示（缺文件、原文不在本机、结构不合法等），写进日志便于排查 */
  notes: string[]
}

const DEFAULT_VOLUME_ID = 'rjb-7s'

/**
 * 剥掉提取时写入的"溯源壳"：YAML front-matter 与每页的 `<!-- PDF 第 X 页 ｜ 印刷页 Y -->` 注释。
 * 它们是给我们自己回查用的，不该出现在提示词与阅读视图里（否则学生会在课本正文里看到 `<!--`）。
 * 出处信息由 `unit.yaml` 的页码与 `provenance` 承担。
 */
export function stripExtractionWrapper(text: string): string {
  let body = text
  const frontMatter = /^---\r?\n[\s\S]*?\r?\n---\r?\n/.exec(body)
  if (frontMatter) body = body.slice(frontMatter[0].length)
  return body
    .split(/\r?\n/)
    .filter((line) => !/^\s*<!--.*-->\s*$/.test(line))
    .join('\n')
    .trim()
}

/** 读取一个单元目录；失败返回 null 并把原因写进 notes */
function loadUnit(
  dir: string,
  rootDir: string,
  notes: string[]
): { unit: TextbookUnit; source: ScopeSource; volumeId: string } | null {
  const unitPath = join(dir, 'unit.yaml')
  const kpPath = join(dir, 'knowledge-points.yaml')
  if (!existsSync(unitPath) || !existsSync(kpPath)) {
    notes.push(`${dir}：缺少 unit.yaml 或 knowledge-points.yaml，已跳过`)
    return null
  }
  try {
    const unitFile = UnitFileSchema.parse(parseYaml(readFileSync(unitPath, 'utf-8')))
    const kpFile = KnowledgePointsFileSchema.parse(parseYaml(readFileSync(kpPath, 'utf-8')))

    const sectionTexts: Record<string, string> = {}
    for (const section of unitFile.unit.sections) {
      if (!section.textRef) continue
      const textPath = resolve(rootDir, section.textRef)
      if (existsSync(textPath)) {
        sectionTexts[section.id] = stripExtractionWrapper(readFileSync(textPath, 'utf-8'))
      } else {
        notes.push(`小节「${section.title}」的教材原文不在本机（${section.textRef}）——该节会回落到演示内容`)
      }
    }

    const curriculumPath = join(dir, 'curriculum.yaml')
    const curriculumRequirements: CurriculumRequirement[] = existsSync(curriculumPath)
      ? CurriculumFileSchema.parse(parseYaml(readFileSync(curriculumPath, 'utf-8'))).requirements.map(
          (req) => ({
            id: req.id,
            source: req.source,
            text: req.text,
            unitId: unitFile.unit.id,
            ...(req.kpId ? { kpId: req.kpId } : {})
          })
        )
      : []

    return {
      unit: unitFile.unit,
      volumeId: String(unitFile.provenance?.['volumeId'] ?? DEFAULT_VOLUME_ID),
      source: {
        unit: unitFile.unit,
        knowledgePoints: kpFile.knowledgePoints,
        sectionTexts,
        curriculumRequirements
      }
    }
  } catch (error) {
    notes.push(`${dir}：结构不合法，已跳过（${error instanceof Error ? error.message : String(error)}）`)
    return null
  }
}

/** 装载全部单元；本机没有 `content/units` 时返回 null */
export function loadContentLibrary(rootDir: string): LoadedContent | null {
  const unitsRoot = join(rootDir, 'content', 'units')
  if (!existsSync(unitsRoot)) return null

  const notes: string[] = []
  const units: TextbookUnit[] = []
  const byUnit: Record<string, ScopeSource> = {}
  const volumeIdByUnit: Record<string, string> = {}

  for (const entry of readdirSync(unitsRoot, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue
    const loaded = loadUnit(join(unitsRoot, entry.name), rootDir, notes)
    if (!loaded) continue
    units.push(loaded.unit)
    byUnit[loaded.unit.id] = loaded.source
    volumeIdByUnit[loaded.unit.id] = loaded.volumeId
  }

  if (units.length === 0) return null
  return { source: 'content', units, byUnit, volumeIdByUnit, notes }
}

/** 单元 → 学生可选的学习位置（册·章·节）；volumeId 取自 unit.yaml 的 provenance */
export function positionsOf(loaded: LoadedContent): Array<{ position: StudyPosition; label: string }> {
  return loaded.units.flatMap((unit) =>
    unit.sections.map((section) => ({
      position: {
        volumeId: loaded.volumeIdByUnit[unit.id] ?? DEFAULT_VOLUME_ID,
        unitId: unit.id,
        sectionId: section.id
      },
      label: `${unit.title} · ${section.title}`
    }))
  )
}

/** 按位置取内容源（找不到返回 null，由调用方决定降级） */
export function sourceForPosition(loaded: LoadedContent, position: StudyPosition): ScopeSource | null {
  return loaded.byUnit[position.unitId] ?? null
}

/** 供日志/自检用的一句话摘要 */
export function describeLoaded(loaded: LoadedContent | null): string {
  if (!loaded) return '本机没有内容工程产物（content/units 不存在）→ 使用演示占位内容'
  const kpCount = loaded.units.reduce(
    (sum, unit) => sum + (loaded.byUnit[unit.id]?.knowledgePoints.length ?? 0),
    0
  )
  const withText = loaded.units.reduce((sum, unit) => {
    const texts = loaded.byUnit[unit.id]?.sectionTexts ?? {}
    return sum + Object.values(texts).filter((text) => text.trim().length > 0).length
  }, 0)
  return `已装载 ${loaded.units.length} 个单元 / ${kpCount} 个知识点 / ${withText} 节原文（本机）`
}

/** 知识点类型再导出，避免调用方到处 import */
export type { KnowledgePoint }
