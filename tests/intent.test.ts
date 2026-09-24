import { describe, expect, it } from 'vitest'
import {
  IntentFlow,
  buildOpeningQuestion,
  buildPositionQuestion,
  parsePositionChoice,
  parseStudyMode,
  type PositionOption
} from '@core/agent/intent'
import type { StudyPosition } from '@core/domain'

/** 从 parsePositionChoice 的返回值里取出 label（'last'/null 均视为无标签） */
function labelOf(choice: PositionOption | 'last' | null): string | undefined {
  return choice && choice !== 'last' ? choice.label : undefined
}

describe('模式识别', () => {
  it('识别四个模式名', () => {
    expect(parseStudyMode('预习')).toBe('preview')
    expect(parseStudyMode('复习')).toBe('review')
    expect(parseStudyMode('做题')).toBe('practice')
    expect(parseStudyMode('拓展')).toBe('extension')
  })

  it('识别自然语言里的模式', () => {
    expect(parseStudyMode('我想复习一下')).toBe('review')
    expect(parseStudyMode('先预习下新课吧')).toBe('preview')
    expect(parseStudyMode('我想刷几道题')).toBe('practice')
    expect(parseStudyMode('想了解更多')).toBe('extension')
  })

  it('识别编号选择（数字与中文）', () => {
    expect(parseStudyMode('1')).toBe('preview')
    expect(parseStudyMode('3')).toBe('practice')
    expect(parseStudyMode('第2个')).toBe('review')
    expect(parseStudyMode('四')).toBe('extension')
  })

  it('识别不了时返回 null，绝不瞎猜', () => {
    expect(parseStudyMode('')).toBeNull()
    expect(parseStudyMode('   ')).toBeNull()
    expect(parseStudyMode('我不知道啊')).toBeNull()
    expect(parseStudyMode('5')).toBeNull()
  })
})

describe('开场问句', () => {
  it('列出四个模式与编号，并提示上次位置', () => {
    const question = buildOpeningQuestion({ lastPositionLabel: '第二单元第一章第四节 细胞的生活' })
    expect(question).toContain('1 预习')
    expect(question).toContain('4 拓展')
    expect(question).toContain('上次你在：第二单元第一章第四节 细胞的生活')
  })
})

describe('位置选择', () => {
  const options: PositionOption[] = [
    { position: { volumeId: '7s', unitId: 'u4', sectionId: 's1' }, label: '第二单元第一章第四节 细胞的生活' },
    { position: { volumeId: '7s', unitId: 'u4', sectionId: 's2' }, label: '第四章第二节 呼吸作用' }
  ]

  it('按编号或名称匹配', () => {
    expect(labelOf(parsePositionChoice('2', options))).toBe('第四章第二节 呼吸作用')
    expect(labelOf(parsePositionChoice('细胞的生活', options))).toBe('第二单元第一章第四节 细胞的生活')
  })

  it('空输入表示"继续上次"', () => {
    expect(parsePositionChoice('', options)).toBe('last')
    expect(parsePositionChoice('   ', options)).toBe('last')
  })

  it('无法识别返回 null；编号越界也返回 null', () => {
    expect(parsePositionChoice('第九章', options)).toBeNull()
    expect(parsePositionChoice('9', options)).toBeNull()
  })

  it('位置问句包含可选项与"回车继续上次"提示', () => {
    const question = buildPositionQuestion({ options, lastPositionLabel: '第二单元第一章第四节 细胞的生活' })
    expect(question).toContain('1 第二单元第一章第四节 细胞的生活')
    expect(question).toContain('直接回车＝继续上次')
  })
})

/** 用脚本化回答构造 flow，便于离线测试 */
function makeFlow(answers: string[], deps: Partial<ConstructorParameters<typeof IntentFlow>[0]> = {}) {
  const asked: string[] = []
  let cursor = 0
  const flow = new IntentFlow({
    ask: async (question: string) => {
      asked.push(question)
      const answer = answers[cursor] ?? ''
      cursor += 1
      return answer
    },
    ...deps
  })
  return { flow, asked }
}

describe('IntentFlow 状态机', () => {
  const position: StudyPosition = { volumeId: '7s', unitId: 'u4', sectionId: 's1' }
  const single: PositionOption[] = [{ position, label: '第二单元第一章第四节 细胞的生活' }]

  it('只有一个位置时自动选定，只问模式', async () => {
    const { flow, asked } = makeFlow(['2'], { positions: single })
    const result = await flow.run()
    expect(result).toEqual({ mode: 'review', position, fallbackUsed: false })
    expect(asked).toHaveLength(1)
    expect(flow.getState()).toBe('ready')
  })

  it('回答不可识别时重问，直到识别成功', async () => {
    const { flow, asked } = makeFlow(['嗯……', '不知道', '做题'], { positions: single })
    const result = await flow.run()
    expect(result.mode).toBe('practice')
    expect(result.fallbackUsed).toBe(false)
    expect(asked).toHaveLength(3)
  })

  it('超过重问上限则回退到"复习"并如实标记', async () => {
    const { flow } = makeFlow(['a', 'b', 'c', 'd'], { positions: single, maxRetries: 3 })
    const result = await flow.run()
    expect(result.mode).toBe('review')
    expect(result.fallbackUsed).toBe(true)
  })

  it('多个位置时：空输入＝继续上次位置', async () => {
    const options: PositionOption[] = [
      { position, label: '第二单元第一章第四节 细胞的生活' },
      { position: { volumeId: '7s', unitId: 'u4', sectionId: 's2' }, label: '第四章第二节 呼吸作用' }
    ]
    const { flow, asked } = makeFlow(['复习', ''], {
      positions: options,
      lastPosition: { position, label: '第二单元第一章第四节 细胞的生活' }
    })
    const result = await flow.run()
    expect(result.mode).toBe('review')
    expect(result.position).toEqual(position)
    expect(asked).toHaveLength(2)
  })

  it('位置无法识别时回到上次位置，不卡死', async () => {
    const options: PositionOption[] = [
      { position, label: '第二单元第一章第四节 细胞的生活' },
      { position: { volumeId: '7s', unitId: 'u4', sectionId: 's2' }, label: '第四章第二节 呼吸作用' }
    ]
    const { flow } = makeFlow(['预习', '第九章', '第九章', '第九章'], {
      positions: options,
      lastPosition: { position, label: '第二单元第一章第四节 细胞的生活' },
      maxRetries: 3
    })
    const result = await flow.run()
    expect(result.position).toEqual(position)
  })
})
