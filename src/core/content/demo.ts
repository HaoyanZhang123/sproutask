import type { StudyMode } from '../domain'
import type { StudyScope } from './index'

/**
 * 演示用 StudyScope —— ⚠️ 文本为**自己编写的占位示例**，不是真实教材原文。
 *
 * 为什么放在 core 而不是 scripts：桌面应用在接入真实教材内容之前也要能启动、能演示完整流程。
 * 内容库接口（TextbookLibrary）落地后，这里会被真实实现替换。
 */

const KNOWLEDGE_POINTS = [
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
] as const

export function createDemoScope(mode: StudyMode = 'review'): StudyScope {
  return {
    position: { volumeId: '7s', unitId: 'demo-photosynthesis', sectionId: 's1' },
    mode,
    unit: {
      id: 'demo-photosynthesis',
      title: '绿色植物的光合作用（演示单元）',
      grade: '七年级上',
      edition: '演示占位（待接入真实教材版本）',
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
    knowledgePoints: KNOWLEDGE_POINTS.map((kp) => ({
      ...kp,
      refs: [...kp.refs],
      prerequisites: [...kp.prerequisites],
      misconceptions: [...kp.misconceptions]
    })),
    curriculumRequirements: ['（演示用占位）说明绿色植物的光合作用及其意义，理解物质与能量变化。']
  }
}
