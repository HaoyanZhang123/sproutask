import { describe, expect, it } from 'vitest'
import { assembleStudyScope, hasUsableText, type ScopeSource } from '@core/content/scope'

/**
 * 按位置装载上下文（`buildStudyScope` 的纯逻辑）。
 * 关键约束：**只装载当前位置的内容**，知识点也只带与当前小节相关的那些。
 */

const source: ScopeSource = {
  unit: {
    id: 'u-test',
    title: '第一单元 生物和细胞',
    grade: '七年级上',
    edition: '人教版（2024 新版）',
    sections: [
      { id: 's1', title: '第四节 细胞的生活', page: 28, textRef: 'a.md' },
      { id: 's2', title: '第一节 细胞通过分裂产生新细胞', page: 33, textRef: 'b.md' }
    ]
  },
  knowledgePoints: [
    {
      id: 'kp-matter',
      unitId: 'u-test',
      title: '细胞中的物质',
      summary: '细胞中的物质分无机物和有机物两类，水、无机盐属于无机物',
      refs: [{ sectionId: 's1', page: 28 }],
      prerequisites: [],
      misconceptions: [],
      difficulty: 2
    },
    {
      id: 'kp-division',
      unitId: 'u-test',
      title: '细胞分裂',
      summary: '细胞分裂时细胞核分成两个，染色体均分到两个新细胞',
      refs: [{ sectionId: 's2', page: 33 }],
      prerequisites: [],
      misconceptions: [],
      difficulty: 3
    }
  ],
  sectionTexts: { s1: '（本机教材原文）细胞的生活需要物质和能量。', s2: '细胞分裂产生新细胞。' },
  curriculumRequirements: [
    { id: 'cr-1', source: '义务教育生物学课程标准（2022年版）', text: '说明细胞是生物体结构和功能的基本单位', unitId: 'u-test' }
  ]
}

describe('按位置装配学习上下文', () => {
  it('只装载指定小节，且知识点只带与本小节相关的', () => {
    const scope = assembleStudyScope({
      source,
      position: { volumeId: 'rjb-7s', unitId: 'u-test', sectionId: 's1' },
      mode: 'review'
    })
    expect(scope.sectionTexts.map((s) => s.sectionId)).toEqual(['s1'])
    expect(scope.knowledgePoints.map((kp) => kp.id)).toEqual(['kp-matter'])
    expect(scope.mode).toBe('review')
    expect(scope.curriculumRequirements).toEqual(['说明细胞是生物体结构和功能的基本单位'])
  })

  it('不给 sectionId 时装载整个单元的小节', () => {
    const scope = assembleStudyScope({
      source,
      position: { volumeId: 'rjb-7s', unitId: 'u-test' },
      mode: 'preview'
    })
    expect(scope.sectionTexts.map((s) => s.sectionId)).toEqual(['s1', 's2'])
    expect(scope.knowledgePoints).toHaveLength(2)
  })

  it('原文不在本机时给空串（不编造内容）', () => {
    const scope = assembleStudyScope({
      source: { ...source, sectionTexts: {} },
      position: { volumeId: 'rjb-7s', unitId: 'u-test', sectionId: 's1' },
      mode: 'review'
    })
    expect(scope.sectionTexts[0]?.text).toBe('')
  })

  it('位置指向不存在的小节时直接报错（不静默给空上下文）', () => {
    expect(() =>
      assembleStudyScope({
        source,
        position: { volumeId: 'rjb-7s', unitId: 'u-test', sectionId: 's9' },
        mode: 'review'
      })
    ).toThrow(/不存在的小节/)
  })
})

describe('是否有可用原文（决定真实内容还是演示占位）', () => {
  it('有原文 → true；原文为空或缺失 → false', () => {
    const position = { volumeId: 'rjb-7s', unitId: 'u-test', sectionId: 's1' }
    expect(hasUsableText(source, position)).toBe(true)
    expect(hasUsableText({ ...source, sectionTexts: { s1: '   ' } }, position)).toBe(false)
    expect(hasUsableText({ ...source, sectionTexts: {} }, position)).toBe(false)
  })
})
