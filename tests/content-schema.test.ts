import { existsSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { parse as parseYaml } from 'yaml'
import {
  CurriculumFileSchema,
  KnowledgePointsFileSchema,
  UnitFileSchema,
  validateContent,
  type ContentIssue
} from '@core/content/schema'

/**
 * 内容文件的契约与校验。
 *
 * 为什么值得单测：这些 YAML 是**教师会手改**的文件，写错一个 sectionId 或让前置知识成环，
 * 运行时只会表现成"模型说不到点上"，很难查。校验器把这类错误提前到 `pnpm content:validate`。
 */

const unitFile = {
  unit: {
    id: 'u-test',
    title: '第一单元 生物和细胞',
    grade: '七年级上',
    edition: '人教版（2024 新版）',
    sections: [{ id: 's1', title: '第四节 细胞的生活', page: 28, textRef: 'content/textbook/x.md' }]
  }
}

const kp = (over: Record<string, unknown> = {}) => ({
  id: 'kp-a',
  unitId: 'u-test',
  title: '细胞中的物质',
  summary: '细胞中的物质分无机物和有机物两类，水、无机盐属于无机物',
  refs: [{ sectionId: 's1', page: 28 }],
  prerequisites: [],
  misconceptions: [],
  difficulty: 2,
  ...over
})

const errorsOf = (issues: ContentIssue[]) => issues.filter((i) => i.level === 'error').map((i) => i.message)
const warnsOf = (issues: ContentIssue[]) => issues.filter((i) => i.level === 'warn').map((i) => i.message)

describe('内容文件结构（Zod）', () => {
  it('合法文件通过', () => {
    expect(UnitFileSchema.safeParse(unitFile).success).toBe(true)
    expect(KnowledgePointsFileSchema.safeParse({ knowledgePoints: [kp()] }).success).toBe(true)
  })

  it('知识点 id 必须带 kp- 前缀', () => {
    const bad = KnowledgePointsFileSchema.safeParse({ knowledgePoints: [kp({ id: 'cell-matter' })] })
    expect(bad.success).toBe(false)
  })

  it('小节必须指向存在的 textRef 字段形态（文本引用是字符串）', () => {
    const bad = UnitFileSchema.safeParse({
      unit: { ...unitFile.unit, sections: [{ id: 's1', title: 't', textRef: 123 }] }
    })
    expect(bad.success).toBe(false)
  })
})

describe('内容语义校验（validateContent）', () => {
  it('干净内容没有 error', () => {
    const issues = validateContent({
      unitFile: UnitFileSchema.parse(unitFile),
      kpFile: KnowledgePointsFileSchema.parse({ knowledgePoints: [kp()] })
    })
    expect(errorsOf(issues)).toEqual([])
  })

  it('抓出：unitId 不一致 / 出处小节不存在 / 前置知识不存在 / id 重复', () => {
    const issues = validateContent({
      unitFile: UnitFileSchema.parse(unitFile),
      kpFile: KnowledgePointsFileSchema.parse({
        knowledgePoints: [
          kp({ unitId: 'u-other' }),
          kp({ id: 'kp-b', refs: [{ sectionId: 's9', page: 1 }] }),
          kp({ id: 'kp-c', prerequisites: ['kp-nope'] }),
          kp({ id: 'kp-a' })
        ]
      })
    })
    const errs = errorsOf(issues).join('\n')
    expect(errs).toContain('不一致')
    expect(errs).toContain('不存在的小节')
    expect(errs).toContain('前置知识不存在')
    expect(errs).toContain('重复')
  })

  it('抓出：前置知识成环', () => {
    const issues = validateContent({
      unitFile: UnitFileSchema.parse(unitFile),
      kpFile: KnowledgePointsFileSchema.parse({
        knowledgePoints: [
          kp({ id: 'kp-a', prerequisites: ['kp-b'] }),
          kp({ id: 'kp-b', prerequisites: ['kp-a'] })
        ]
      })
    })
    expect(errorsOf(issues).join()).toContain('成环')
  })

  it('提醒：summary 没有标点会让护栏失效（审计实测的坑）', () => {
    const issues = validateContent({
      unitFile: UnitFileSchema.parse(unitFile),
      kpFile: KnowledgePointsFileSchema.parse({
        knowledgePoints: [kp({ summary: '细胞质中的能量转换器是线粒体和叶绿体' })]
      })
    })
    expect(warnsOf(issues).join()).toContain('没有标点')
  })

  it('抓出：课标要求指向不存在的知识点（写错一个字母就悄悄失效）', () => {
    const curriculumFile = CurriculumFileSchema.parse({
      requirements: [
        { id: '1.1', source: '义务教育生物学课程标准（2022年版）', text: '细胞是生物体结构和功能的基本单位', kpId: 'kp-typo' },
        { id: '1.1.5', source: '义务教育生物学课程标准（2022年版）', text: '细胞核是遗传信息库', kpId: 'kp-a' }
      ]
    })
    const issues = validateContent({
      unitFile: UnitFileSchema.parse(unitFile),
      kpFile: KnowledgePointsFileSchema.parse({ knowledgePoints: [kp()] }),
      curriculumFile
    })
    const errs = errorsOf(issues)
    expect(errs.join()).toContain('kp-typo')
    expect(errs.join()).not.toContain('kp-a')
  })

  it('课标要求：条目编号是字符串（1.1 不能被 YAML 解析成小数）', () => {
    // 若写成 id: 1.1（不加引号），YAML 会解析成数字 1.1，Zod 会拒绝——这条用例守住这个坑
    expect(CurriculumFileSchema.safeParse({ requirements: [{ id: 1.1, source: 's', text: 't' }] }).success).toBe(false)
    expect(CurriculumFileSchema.safeParse({ requirements: [{ id: '1.1', source: 's', text: 't' }] }).success).toBe(true)
  })

  it('提醒：出处没有页码', () => {
    const issues = validateContent({
      unitFile: UnitFileSchema.parse(unitFile),
      kpFile: KnowledgePointsFileSchema.parse({
        knowledgePoints: [kp({ refs: [{ sectionId: 's1' }] })]
      })
    })
    expect(warnsOf(issues).join()).toContain('没有页码')
  })
})

/**
 * 集成检查：仓库里真实的 content/units（若存在）必须零 error。
 * 公开仓库**不含 content/**（见 docs/adr/ADR-0007），所以在那边这个用例会跳过而不是失败。
 */
describe('仓库真实内容', () => {
  const dir = 'content/units/u-cell-basic-unit'
  const hasContent = existsSync(`${dir}/unit.yaml`)

  it.skipIf(!hasContent)('content/units/u-cell-basic-unit 校验零错误', () => {
    const unit = UnitFileSchema.parse(parseYaml(readFileSync(`${dir}/unit.yaml`, 'utf-8')))
    const kps = KnowledgePointsFileSchema.parse(
      parseYaml(readFileSync(`${dir}/knowledge-points.yaml`, 'utf-8'))
    )
    expect(errorsOf(validateContent({ unitFile: unit, kpFile: kps }))).toEqual([])
  })
})
