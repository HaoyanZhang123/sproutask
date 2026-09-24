import type { StudyScope } from '@core/content'
import type { ChatMessage, ChatOptions, LLMClient, LLMReply } from '@core/llm'

/** 测试用学习上下文（自编占位内容，非真实教材原文） */
export function makeScope(overrides: Partial<StudyScope> = {}): StudyScope {
  return {
    position: { volumeId: '7s', unitId: 'u-photosynthesis', sectionId: 's1' },
    mode: 'review',
    unit: {
      id: 'u-photosynthesis',
      title: '绿色植物的光合作用',
      grade: '七年级上',
      edition: '演示版',
      sections: [{ id: 's1', title: '光合作用' }]
    },
    sectionTexts: [
      {
        sectionId: 's1',
        title: '光合作用',
        text: '绿色植物在光下把二氧化碳和水转变成有机物，并释放氧气。'
      }
    ],
    knowledgePoints: [
      {
        id: 'kp-condition',
        unitId: 'u-photosynthesis',
        title: '光合作用的条件',
        summary: '光合作用需要光、二氧化碳和水',
        refs: [{ sectionId: 's1', page: 78 }],
        prerequisites: [],
        misconceptions: ['以为只要有光就够了'],
        difficulty: 2
      },
      {
        id: 'kp-product',
        unitId: 'u-photosynthesis',
        title: '光合作用的产物',
        summary: '光合作用产生有机物并释放氧气',
        refs: [{ sectionId: 's1', page: 80 }],
        prerequisites: ['kp-condition'],
        misconceptions: [],
        difficulty: 3
      }
    ],
    curriculumRequirements: ['说明绿色植物的光合作用及其意义'],
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
