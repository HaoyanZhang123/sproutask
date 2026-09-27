import { describe, expect, it } from 'vitest'
import type { KnowledgePoint } from '@core/domain'
import { touchedKnowledgePoints } from '../src/main/storage/mastery-touch'

/**
 * 参与度启发式（不是掌握度判定）：
 * 重点是**别把它做得太松**——"细胞"这种几乎每个标题都有的词不能拿来匹配，
 * 否则学生随便说一句就把整节知识点都标成"探索中"，学习数据就被污染了。
 */

const kp = (id: string, title: string): KnowledgePoint => ({
  id,
  unitId: 'u-cell-basic-unit',
  title,
  summary: '（测试用）暂无',
  refs: [{ sectionId: 's1', page: 28 }],
  prerequisites: [],
  misconceptions: [],
  difficulty: 2
})

const KPS = [
  kp('kp-cell-matter', '细胞中的物质'),
  kp('kp-cell-membrane', '细胞膜控制物质进出'),
  kp('kp-cell-energy', '细胞中的能量转换器'),
  kp('kp-cell-nucleus', '细胞核是细胞的控制中心'),
  kp('kp-cell-basic-unit', '细胞是生物体结构和功能的基本单位')
]

describe('参与度启发式：这轮提到了哪个知识点', () => {
  it('提到具体结构 → 只标对应的那一个', () => {
    expect(touchedKnowledgePoints(KPS, '细胞膜是不是把细胞全封起来了？')).toEqual(['kp-cell-membrane'])
  })

  it('泛泛提"细胞" → 不标任何一个（避免污染）', () => {
    expect(touchedKnowledgePoints(KPS, '细胞到底是什么？')).toEqual([])
  })

  it('词被两个知识点共用时宁可不标（"物质"同时出现在两个标题里）', () => {
    // 已知限制：本单元里"物质"既在「细胞中的物质」也在「细胞膜控制物质进出」里 → 不具区分度。
    // 宁可少标（漏），也不要多标（错）——多标会污染研读用的掌握度数据。
    expect(touchedKnowledgePoints(KPS, '细胞里的物质分几类？')).toEqual([])
  })

  it('区分度高的词照样命中（能量转换器 / 基本单位）', () => {
    expect(touchedKnowledgePoints(KPS, '能量转换器是哪个？')).toEqual(['kp-cell-energy'])
    expect(touchedKnowledgePoints(KPS, '为什么说它是基本单位？')).toEqual(['kp-cell-basic-unit'])
  })

  it('一句话里提到两处 → 两个都标', () => {
    const hit = touchedKnowledgePoints(KPS, '细胞核和细胞膜哪个更重要？')
    expect(hit).toContain('kp-cell-nucleus')
    expect(hit).toContain('kp-cell-membrane')
  })

  it('空白输入不报错也不乱标', () => {
    expect(touchedKnowledgePoints(KPS, '   ')).toEqual([])
  })
})
