import type { StudyScope } from '../src/core/content'
import type { KnowledgePoint } from '../src/core/domain'

/**
 * 演示用 StudyScope —— ⚠️ 文本为**自己编写的占位示例**，不是真实教材原文。
 * 用途：M1 阶段在命令行里试提示词、跑评测，无需先完成教材工程（M2）。
 * 教材版本确认后由 M2 的内容管线替换为真实内容。
 */

const KNOWLEDGE_POINTS: KnowledgePoint[] = [
  {
    id: 'kp-photosynthesis-condition',
    unitId: 'demo-photosynthesis',
    title: '光合作用的条件',
    summary: '光合作用需要光、二氧化碳和水',
    refs: [{ sectionId: 's1', page: 78 }],
    prerequisites: [],
    misconceptions: ['以为只要有光就行，忽略了二氧化碳和水'],
    difficulty: 2
  },
  {
    id: 'kp-photosynthesis-product',
    unitId: 'demo-photosynthesis',
    title: '光合作用的产物',
    summary: '光合作用产生有机物（淀粉等）并释放氧气',
    refs: [{ sectionId: 's1', page: 80 }],
    prerequisites: ['kp-photosynthesis-condition'],
    misconceptions: ['以为植物吸收氧气、放出二氧化碳（与呼吸作用混淆）'],
    difficulty: 3
  }
]

export function createDemoScope(): StudyScope {
  return {
    position: { volumeId: '7s', unitId: 'demo-photosynthesis', sectionId: 's1' },
    mode: 'review',
    unit: {
      id: 'demo-photosynthesis',
      title: '绿色植物的光合作用（演示单元）',
      grade: '七年级上',
      edition: '演示占位（待确认教材版本）',
      sections: [{ id: 's1', title: '第四章第一节 光合作用', page: 78 }]
    },
    sectionTexts: [
      {
        sectionId: 's1',
        title: '第四章第一节 光合作用',
        text: [
          '（演示用占位文本，非真实教材原文）',
          '绿色植物在光下能把二氧化碳和水转变成储存能量的有机物，并且释放出氧气。',
          '光合作用需要光作为条件；叶绿体是进行光合作用的场所。',
          '把绿叶放在暗处一昼夜，再部分遮光后照光，用碘液检验，可以看到见光部分变成蓝色，',
          '说明见光部分产生了淀粉。'
        ].join('\n')
      }
    ],
    knowledgePoints: KNOWLEDGE_POINTS,
    curriculumRequirements: [
      '（演示用占位）说明绿色植物的光合作用及其意义，理解物质与能量变化。'
    ]
  }
}
