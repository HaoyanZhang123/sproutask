import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  describeLoaded,
  loadContentLibrary,
  positionsOf,
  sourceForPosition
} from '../src/main/content/file-library'
import { createContentRuntime } from '../src/main/content/runtime'

/**
 * 从本机文件装载教学内容（`content/units/*` + 原文）。
 * 公开仓库不含 `content/`，所以"真实内容"那组用例在缺内容时会跳过（不误报 CI）。
 */

const UNIT_YAML = `provenance:
  volumeId: rjb-7s
  reviewed: 'false'
unit:
  id: u-test
  title: 第一单元 生物和细胞
  grade: 七年级上
  edition: 人教版（2024 新版）
  sections:
    - id: s1
      title: 第四节 细胞的生活
      page: 28
      textRef: content/textbook/rjb-7s/s1.md
`

const KP_YAML = `knowledgePoints:
  - id: kp-matter
    unitId: u-test
    title: 细胞中的物质
    summary: 细胞中的物质分无机物和有机物两类，水、无机盐属于无机物
    refs:
      - sectionId: s1
        page: 28
    prerequisites: []
    misconceptions: []
    difficulty: 2
`

const CURRICULUM_YAML = `requirements:
  - id: cr-1
    source: 义务教育生物学课程标准（2022年版）
    text: 说明细胞是生物体结构和功能的基本单位
`

function makeFixture(opts: { withText?: boolean; badYaml?: boolean } = {}): string {
  const root = mkdtempSync(join(tmpdir(), 'sproutask-content-'))
  const dir = join(root, 'content', 'units', 'u-test')
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, 'unit.yaml'), UNIT_YAML, 'utf-8')
  writeFileSync(join(dir, 'knowledge-points.yaml'), opts.badYaml ? 'knowledgePoints: 不是数组' : KP_YAML, 'utf-8')
  writeFileSync(join(dir, 'curriculum.yaml'), CURRICULUM_YAML, 'utf-8')
  if (opts.withText) {
    const textDir = join(root, 'content', 'textbook', 'rjb-7s')
    mkdirSync(textDir, { recursive: true })
    writeFileSync(
      join(textDir, 's1.md'),
      '---\nsection: 第四节 细胞的生活\n---\n\n<!-- PDF 第 28 页 ｜ 印刷页 19 -->\n（本机教材原文）细胞的生活需要物质和能量。\n',
      'utf-8'
    )
  }
  return root
}

describe('装载教学内容（本机文件）', () => {
  it('结构 + 原文齐备时装载成功，并给出位置与内容源', () => {
    const root = makeFixture({ withText: true })
    const loaded = loadContentLibrary(root)
    expect(loaded).not.toBeNull()
    expect(loaded?.units.map((u) => u.id)).toEqual(['u-test'])

    const positions = positionsOf(loaded!)
    expect(positions).toHaveLength(1)
    expect(positions[0]?.position).toEqual({ volumeId: 'rjb-7s', unitId: 'u-test', sectionId: 's1' })
    expect(positions[0]?.label).toContain('第四节 细胞的生活')

    const source = sourceForPosition(loaded!, positions[0]!.position)
    expect(source?.sectionTexts['s1']).toContain('细胞的生活需要物质和能量')
    // 溯源壳必须被剥掉：YAML 头与出处注释不能进提示词/阅读视图
    expect(source?.sectionTexts['s1']).not.toContain('<!--')
    expect(source?.sectionTexts['s1']).not.toContain('section:')
    expect(source?.curriculumRequirements[0]?.text).toContain('基本单位')
    expect(loaded?.notes).toEqual([])
  })

  it('原文不在本机：装载仍然成功，但会记下提示（打包给学生时的正常情况）', () => {
    const root = makeFixture({ withText: false })
    const loaded = loadContentLibrary(root)
    expect(loaded).not.toBeNull()
    expect(loaded?.byUnit['u-test']?.sectionTexts).toEqual({})
    expect(loaded?.notes.join()).toContain('教材原文不在本机')
  })

  it('结构不合法：跳过该单元并记下原因（不让整个应用起不来）', () => {
    const root = makeFixture({ withText: true, badYaml: true })
    const loaded = loadContentLibrary(root)
    expect(loaded).toBeNull()
  })

  it('没有 content/units 时返回 null（公开仓库的正常情况）', () => {
    const root = mkdtempSync(join(tmpdir(), 'sproutask-empty-'))
    expect(loadContentLibrary(root)).toBeNull()
    expect(describeLoaded(null)).toContain('演示占位')
  })
})

describe('运行时内容源（打包后学生机的关键情形）', () => {
  it('有结构但没有教材正文时：仍用真实内容，不回落演示占位', () => {
    const root = makeFixture({ withText: false })
    const runtime = createContentRuntime(root)
    expect(runtime.source).toBe('content')
    expect(runtime.positions).toHaveLength(1)
    // 正文为空是"事实"，不编造
    expect(runtime.scopeFor(runtime.positions[0]!.position, 'review').sectionTexts[0]?.text).toBe('')
  })

  it('完全没有内容目录时才回落演示占位（开发机/公开仓库）', () => {
    const root = mkdtempSync(join(tmpdir(), 'sproutask-none-'))
    const runtime = createContentRuntime(root)
    expect(runtime.source).toBe('demo')
    expect(runtime.positions.length).toBeGreaterThan(0)
  })

  it('多个候选目录：第一个能装载的胜出（打包后内容在 resources 下）', () => {
    const empty = mkdtempSync(join(tmpdir(), 'sproutask-empty2-'))
    const withContent = makeFixture({ withText: false })
    const runtime = createContentRuntime([empty, withContent])
    expect(runtime.source).toBe('content')
  })
})

describe('仓库真实内容（本机有才跑）', () => {
  it('content/units 能装载且描述了数量', () => {
    const loaded = loadContentLibrary(process.cwd())
    if (!loaded) {
      // 公开仓库不含 content/：这里显式跳过，而不是假装通过
      expect(loaded).toBeNull()
      return
    }
    expect(loaded.units.length).toBeGreaterThan(0)
    const describe = describeLoaded(loaded)
    expect(describe).toMatch(/个单元/)
    expect(positionsOf(loaded).length).toBeGreaterThan(0)
  })
})
