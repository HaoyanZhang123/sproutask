import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { parse as parseYaml } from 'yaml'
import {
  CurriculumFileSchema,
  KnowledgePointsFileSchema,
  UnitFileSchema,
  validateContent,
  type ContentIssue,
  type CurriculumFile
} from '../src/core/content/schema'

/**
 * 内容校验：`pnpm content:validate`
 *
 * 校验 `content/units/*`：结构（Zod）+ 语义（出处是否存在、前置知识是否有环等）。
 *
 * ⚠️ 公开仓库**不含 `content/`**（教学设计在内部仓库；教材原文只在本机，见 docs/adr/ADR-0007）。
 *    所以没有内容目录时这里**不算失败**，只提示"本机没有内容工程产物"。
 *
 * 退出码：有 error → 1（warn 不阻断）。
 */

const ROOT = 'content/units'

function validateUnitDir(dir: string): ContentIssue[] {
  const issues: ContentIssue[] = []
  const unitPath = join(dir, 'unit.yaml')
  const kpPath = join(dir, 'knowledge-points.yaml')

  for (const p of [unitPath, kpPath]) {
    if (!existsSync(p)) {
      return [{ level: 'error', message: `缺少文件：${p}` }]
    }
  }

  const unitFile = UnitFileSchema.safeParse(parseYaml(readFileSync(unitPath, 'utf-8')))
  if (!unitFile.success) {
    return [{ level: 'error', message: `${unitPath} 结构不合法：${unitFile.error.issues[0]?.message}` }]
  }
  const kpFile = KnowledgePointsFileSchema.safeParse(parseYaml(readFileSync(kpPath, 'utf-8')))
  if (!kpFile.success) {
    return [{ level: 'error', message: `${kpPath} 结构不合法：${kpFile.error.issues[0]?.message}` }]
  }

  // 课标要求（可选）：只放条目编号与短引用，原文不进仓库（ADR-0007）
  const curriculumPath = join(dir, 'curriculum.yaml')
  let curriculumFile: CurriculumFile | undefined
  if (existsSync(curriculumPath)) {
    const parsed = CurriculumFileSchema.safeParse(parseYaml(readFileSync(curriculumPath, 'utf-8')))
    if (!parsed.success) {
      return [{ level: 'error', message: `${curriculumPath} 结构不合法：${parsed.error.issues[0]?.message}` }]
    }
    curriculumFile = parsed.data
    if (curriculumFile.requirements.length === 0) {
      issues.push({ level: 'warn', message: `${curriculumPath} 里没有任何课标要求` })
    }
  }

  issues.push(...validateContent({ unitFile: unitFile.data, kpFile: kpFile.data, curriculumFile }))

  // 教材原文只在本机：文件不存在时给出 warn（不是 error），并提示怎么补
  for (const section of unitFile.data.unit.sections) {
    if (section.textRef && !existsSync(section.textRef)) {
      issues.push({
        level: 'warn',
        message: `小节 ${section.id} 指向的教材原文不存在（${section.textRef}）——` +
          '原文只在提取过的机器上；换机器请用 tools/extract_textbook.py 重新提取'
      })
    }
  }
  const reviewed = unitFile.data.provenance?.['reviewed']
  if (String(reviewed) !== 'true') {
    issues.push({
      level: 'warn',
      message: `${dir} 的 provenance.reviewed 不是 true —— 文本尚未逐字对照课本核对，` +
        '作为"出处"引用前必须先核对'
    })
  }

  return issues
}

function main(): void {
  if (!existsSync(ROOT)) {
    console.log(`ℹ️ 本机没有 ${ROOT}（公开仓库不含内容工程产物）——跳过校验`)
    return
  }
  const dirs = readdirSync(ROOT, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => join(ROOT, e.name))
  if (dirs.length === 0) {
    console.log(`ℹ️ ${ROOT} 下还没有单元——跳过校验`)
    return
  }

  let errors = 0
  let warns = 0
  for (const dir of dirs) {
    const issues = validateUnitDir(dir)
    const es = issues.filter((i) => i.level === 'error')
    const ws = issues.filter((i) => i.level === 'warn')
    errors += es.length
    warns += ws.length
    console.log(`\n📘 ${dir}：${es.length} 个错误 / ${ws.length} 个提醒`)
    for (const i of issues) {
      console.log(`   ${i.level === 'error' ? '❌' : '⚠️ '} ${i.message}`)
    }
  }

  console.log(`\n汇总：${dirs.length} 个单元，${errors} 个错误，${warns} 个提醒`)
  if (errors > 0) {
    console.error('❌ 内容校验未通过：请修正上面的错误（提醒不阻断，但建议一并处理）')
    process.exit(1)
  }
  console.log('✅ 内容校验通过')
}

main()
