import { describe, expect, it } from 'vitest'
import { MAX_HISTORY_TURNS, PROMPT_VERSION, buildMessages, buildSystemPrompt } from '@core/prompts'
import type { StudyScope } from '@core/content'

const scope: StudyScope = {
  position: { volumeId: 'rjb-7s', unitId: 'u-cell-basic-unit', sectionId: 's1' },
  mode: 'review',
  unit: {
    id: 'u-cell-basic-unit',
    title: '细胞是生命活动的基本单位',
    grade: '七年级上',
    edition: '人教版',
    sections: [{ id: 's1', title: '第四节 细胞的生活' }]
  },
  sectionTexts: [
    { sectionId: 's1', title: '第四节 细胞的生活', text: '细胞的生活需要物质和能量。' }
  ],
  knowledgePoints: [
    {
      id: 'kp-cell-membrane',
      unitId: 'u-cell-basic-unit',
      title: '细胞膜控制物质进出',
      summary: '有用的物质进入细胞，废物排出细胞',
      refs: [{ sectionId: 's1' }],
      prerequisites: [],
      misconceptions: ['以为细胞壁控制物质进出'],
      difficulty: 2
    }
  ],
  curriculumRequirements: ['说明细胞是生物体结构和功能的基本单位']
}

describe('提示词分层装配', () => {
  it('版本号可追踪', () => {
    expect(PROMPT_VERSION).toBe('v1')
  })

  it('system 提示词包含全部层次的关键内容', () => {
    const prompt = buildSystemPrompt({ scope })
    expect(prompt).toContain('小芽') // L0 人格
    expect(prompt).toContain('教学纪律') // L1 纪律
    expect(prompt).toContain('课程标准要求') // L2 课标约束
    expect(prompt).toContain('教材原文') // L2 教材
    expect(prompt).toContain('细胞膜控制物质进出') // 知识点
    expect(prompt).toContain('以为细胞壁控制物质进出') // 常见误区（用于设计诊断性提问）
    expect(prompt).toContain('复习') // L4 模式
  })

  it('未提供学情时不注入该层', () => {
    const prompt = buildSystemPrompt({ scope, mastery: [] })
    expect(prompt).not.toContain('这个学生的学习记录')
  })

  it('提供学情时按掌握度分组，并提示误区', () => {
    const prompt = buildSystemPrompt({
      scope,
      mastery: [
        {
          studentId: 'S07',
          kpId: 'kp-cell-membrane',
          state: 'exploring',
          evidence: [],
          updatedAt: '2026-09-01T00:00:00.000Z'
        }
      ]
    })
    expect(prompt).toContain('这个学生的学习记录')
    expect(prompt).toContain('正在探索')
    expect(prompt).toContain('值得重点探查的误区')
  })

  it('提示学生在"做题"模式下尤其不能给答案', () => {
    const prompt = buildSystemPrompt({ scope: { ...scope, mode: 'practice' } })
    expect(prompt).toContain('做题')
    expect(prompt).toContain('绝对不要给出完整解题过程或最终答案')
  })

  it('buildMessages 结构为 system + 历史 + 本轮输入', () => {
    const messages = buildMessages({ scope }, [{ role: 'assistant', content: '上一轮' }], '本轮问题')
    expect(messages[0]?.role).toBe('system')
    expect(messages[1]).toEqual({ role: 'assistant', content: '上一轮' })
    expect(messages[messages.length - 1]).toEqual({ role: 'user', content: '本轮问题' })
  })

  it('历史过长时只保留最近的部分', () => {
    const long = Array.from({ length: MAX_HISTORY_TURNS * 4 }, (_, i) => ({
      role: 'user' as const,
      content: `第${i}轮`
    }))
    const messages = buildMessages({ scope }, long, '最新问题')
    // system + 截断后的历史 + 本轮
    expect(messages.length).toBe(1 + MAX_HISTORY_TURNS * 2 + 1)
    expect(messages[1]?.content).toBe(`第${MAX_HISTORY_TURNS * 4 - MAX_HISTORY_TURNS * 2}轮`)
  })
})
