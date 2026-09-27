import { describe, expect, it } from 'vitest'
import { MAX_HISTORY_TURNS, PROMPT_VERSION, buildMessages, buildSystemPrompt } from '@core/prompts'
import type { StudyScope } from '@core/content'
import { makeScope } from './helpers/fixtures'

const scope: StudyScope = {
  position: { volumeId: 'rjb-7s', unitId: 'u-cell-basic-unit', sectionId: 's1' },
  mode: 'review',
  unit: {
    id: 'u-cell-basic-unit',
    title: '第一单元 生物和细胞',
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
  it('本机没有教材正文时：提示词明确禁止编造原文，并要求学生念课本（打包分发后的学生机情形）', () => {
    const prompt = buildSystemPrompt({ scope: { ...scope, sectionTexts: [{ sectionId: 's1', title: '第四节 细胞的生活', text: '' }] } })
    // 不许把"没有正文"当成"正文是空的"
    expect(prompt).toContain('本机没有存放教材正文')
    expect(prompt).toContain('不要引用、不要编造课本原句')
    // 仍要把知识点给模型（引导才有依据）
    expect(prompt).toContain('细胞膜控制物质进出')
    // 不能出现空的"教材原文"标题后什么都没有而不作说明
    expect(prompt).not.toMatch(/【教材原文（唯一事实来源）】[\s\S]*?【本部分应掌握的知识点】\s*$/)
  })

  it('有正文时不该出现"没有正文"的那段话（避免误伤）', () => {
    const prompt = buildSystemPrompt({ scope })
    expect(prompt).not.toContain('本机没有存放教材正文')
    expect(prompt).toContain('细胞的生活需要物质和能量')
  })

  it('版本号可追踪（当前 v2：去 AI 腔版本）', () => {
    expect(PROMPT_VERSION).toBe('v2')
  })

  it('v2 的 system 提示词含反 AI 腔约束（防回归）', () => {
    const prompt = buildSystemPrompt({ scope })
    expect(prompt).toContain('AI 腔')
    // 关键几条必须真的写进提示词里，否则"去 AI 味"只是文档里的话
    expect(prompt).toContain('不要空洞客套')
    expect(prompt).toContain('不要书面连接词')
    // 类比必须以教材为准（用户要求：别为了亲切而编造）
    expect(prompt).toContain('不能替代结论')
  })

  it('v2 的 system 提示词含"温度"约束（防止退回冷淡/怼人的写法）', () => {
    const prompt = buildSystemPrompt({ scope })
    // 背景：v2 初稿为了"像人"写得太短太硬，用户判定"冷淡、不耐烦、有攻击性，还不如 v1"。
    // 这几条断言就是为了防止以后再退回那种语气。
    expect(prompt).toContain('说话的温度')
    expect(prompt).toContain('绝对不要这些冷硬')
    expect(prompt).toContain('用邀请代替命令')
    expect(prompt).toContain('100–180 字')
    // 不许把答案的要点/结构先递给学生
    expect(prompt).toContain('不要把答案的要点、条数或结构先说出来')
  })

  it('v2 不再包含 v1 的写死台词（模型会背书同一句话）', () => {
    const prompt = buildSystemPrompt({ scope })
    expect(prompt).not.toContain('这道题我们一起来分析！')
    expect(prompt).not.toContain('教材第四章第一节') // 过期案例也一并清掉
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

  it('可折叠块的标记不进提示词，但块内文字（含答案）保留', () => {
    const withBlocks = makeScope({
      sectionTexts: [
        {
          sectionId: 's1',
          title: '细胞的生活',
          text: ['正文一句。', '', ':::think 想一想', '油属于哪类物质？', ':::', '', ':::answer', '属于有机物。', ':::'].join('\n')
        }
      ]
    })
    const prompt = buildSystemPrompt({ scope: withBlocks })
    expect(prompt).not.toContain(':::') // 标记必须被剥掉，避免污染上下文
    expect(prompt).toContain('正文一句。')
    expect(prompt).toContain('（想一想）油属于哪类物质？') // 折叠块标注来源，便于模型区分课文与思考题
    expect(prompt).toContain('（参考答案）属于有机物。') // 答案留在上下文里：引导需要知道正确结论
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
