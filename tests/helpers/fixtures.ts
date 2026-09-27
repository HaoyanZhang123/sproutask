import type { StudyScope } from '@core/content'
import type { ChatMessage, ChatOptions, LLMClient, LLMReply } from '@core/llm'

/** 测试用学习上下文（自编占位内容，非真实教材原文；案例同演示单元：人教版七上「细胞的生活」） */
export function makeScope(overrides: Partial<StudyScope> = {}): StudyScope {
  return {
    position: { volumeId: 'rjb-7s', unitId: 'u-cell-basic-unit', sectionId: 's1' },
    mode: 'review',
    unit: {
      id: 'u-cell-basic-unit',
      title: '第一单元 生物和细胞',
      grade: '七年级上',
      edition: '人教版',
      sections: [{ id: 's1', title: '细胞的生活' }]
    },
    sectionTexts: [
      {
        sectionId: 's1',
        title: '细胞的生活',
        text: '细胞的生活需要物质和能量。细胞膜控制物质的进出，细胞质中有能量转换器。'
      }
    ],
    knowledgePoints: [
      {
        id: 'kp-cell-membrane',
        unitId: 'u-cell-basic-unit',
        title: '细胞膜控制物质进出',
        summary: '细胞膜控制物质进出，有用的物质进入细胞、废物排出细胞',
        refs: [{ sectionId: 's1' }],
        prerequisites: [],
        misconceptions: ['以为细胞壁控制物质进出'],
        difficulty: 2
      },
      {
        id: 'kp-cell-energy',
        unitId: 'u-cell-basic-unit',
        title: '细胞中的能量转换器',
        summary: '细胞质中的能量转换器是线粒体和叶绿体',
        refs: [{ sectionId: 's1' }],
        prerequisites: ['kp-cell-membrane'],
        misconceptions: ['以为所有细胞都有叶绿体'],
        difficulty: 3
      }
    ],
    curriculumRequirements: ['说明细胞是生物体结构和功能的基本单位'],
    ...overrides
  }
}

/**
 * 记录型模型客户端：按脚本返回回复，并保存每次收到的消息。
 * 用途：断言"工具结果是否真的回填给模型""护栏重生成是否带上了加严指令"。
 */
export class RecordingClient implements LLMClient {
  readonly name = 'recording'
  readonly calls: ChatMessage[][] = []
  private readonly script: LLMReply[]

  constructor(script: LLMReply[]) {
    this.script = [...script]
  }

  get callCount(): number {
    return this.calls.length
  }

  async chat(messages: ChatMessage[], options?: ChatOptions): Promise<LLMReply> {
    this.calls.push(messages.map((message) => ({ ...message })))
    const next = this.script.shift()
    if (!next) return { content: '（脚本用尽）你觉得呢？', toolCalls: [] }
    if (options?.onDelta && next.content) options.onDelta(next.content)
    return next
  }
}
