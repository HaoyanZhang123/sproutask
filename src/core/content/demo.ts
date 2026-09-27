import type { StudyMode } from '../domain'
import type { StudyScope } from './index'

/**
 * 演示用 StudyScope —— ⚠️ 文本为**自己编写的占位示例**，不是真实教材原文。
 *
 * 为什么放在 core 而不是 scripts：桌面应用在接入真实教材内容之前也要能启动、能演示完整流程。
 * 内容库接口（TextbookLibrary）落地后，这里会被真实实现替换。
 *
 * 案例单元：人教版《生物学》七年级上册 第一单元 第二章 第四节「细胞的生活」（**2024 新版编排**）。
 * 章节归属照教材写实，但**正文是自编的通俗表述**（教材原文有版权，不进仓库）；
 * 页码暂不填写，待录入真实教材后由内容工程补齐。
 */

const UNIT_ID = 'u-cell-basic-unit'

const KNOWLEDGE_POINTS = [
  {
    id: 'kp-cell-matter',
    unitId: UNIT_ID,
    title: '细胞中的物质',
    summary: '细胞中的物质分为有机物和无机物，其中有机物包括糖类、脂质和蛋白质',
    refs: [{ sectionId: 's1' }],
    prerequisites: [],
    misconceptions: ['以为细胞里的物质都是有机物，忽略了水和无机盐'],
    difficulty: 2
  },
  {
    id: 'kp-cell-membrane',
    unitId: UNIT_ID,
    title: '细胞膜控制物质进出',
    summary: '细胞膜控制物质进出，有用的物质进入细胞、废物排出细胞、有害物质挡在外面',
    refs: [{ sectionId: 's1' }],
    prerequisites: [],
    misconceptions: ['以为细胞壁控制物质进出（细胞壁主要起支持和保护作用）'],
    difficulty: 2
  },
  {
    id: 'kp-cell-energy',
    unitId: UNIT_ID,
    title: '细胞中的能量转换器',
    summary: '细胞质中的能量转换器是线粒体和叶绿体，线粒体把化学能释放出来供细胞利用',
    refs: [{ sectionId: 's1' }],
    prerequisites: ['kp-cell-matter'],
    misconceptions: ['以为所有细胞都有叶绿体（动物细胞没有）'],
    difficulty: 3
  },
  {
    id: 'kp-cell-nucleus',
    unitId: UNIT_ID,
    title: '细胞核是控制中心',
    summary: '细胞核中含有遗传物质DNA，是细胞的控制中心',
    refs: [{ sectionId: 's1' }],
    prerequisites: [],
    misconceptions: ['以为遗传物质存在于细胞质中'],
    difficulty: 2
  }
] as const

export function createDemoScope(mode: StudyMode = 'review'): StudyScope {
  const sectionTitle = '第一单元第二章第四节 细胞的生活'
  return {
    position: { volumeId: 'rjb-7s', unitId: UNIT_ID, sectionId: 's1' },
    mode,
    unit: {
      id: UNIT_ID,
      title: '第一单元 生物和细胞',
      grade: '七年级上',
      edition: '人教版',
      sections: [{ id: 's1', title: sectionTitle }]
    },
    sectionTexts: [
      {
        sectionId: 's1',
        title: sectionTitle,
        text: [
          '（演示用占位文本，非真实教材原文）',
          '细胞的生活需要物质和能量。细胞中的物质可以分为有机物和无机物两大类：',
          '水、无机盐等属于无机物；糖类、脂质、蛋白质等属于有机物。',
          '',
          ':::think 想一想',
          '炒菜用的花生油，来自细胞里的哪一类物质？',
          ':::',
          '',
          ':::answer',
          '油属于有机物（脂质）。细胞中的有机物包括糖类、脂质和蛋白质等。',
          ':::',
          '',
          '细胞膜把细胞内部与外界环境分开，并且控制物质的进出：有用的物质能够进入细胞，',
          '细胞生活中产生的废物被排出细胞外，有害的物质则被挡在外面。',
          '',
          ':::think 讨论',
          '为什么说细胞膜不是"什么都放进来"？如果它坏了，细胞会怎样？',
          ':::',
          '',
          ':::answer',
          '细胞膜能控制物质进出：只有有用的物质才能进入细胞，废物排出、有害物质被挡住。',
          '如果细胞膜失去这个功能，细胞内的物质就会混乱，细胞无法正常生活。',
          ':::',
          '',
          '细胞质中分布着能量转换器。叶绿体能把光能转变成化学能，储存在它合成的有机物中；',
          '线粒体则把有机物中的化学能释放出来，供细胞进行各项生命活动。',
          '',
          ':::answer',
          '叶绿体：光能 → 化学能；线粒体：有机物中的化学能 → 供细胞利用。',
          ':::',
          '',
          '细胞核中含有遗传物质，它是细胞的控制中心，细胞的生长、分裂和分化都与它有关。',
          '',
          ':::answer',
          '细胞核中含有遗传物质（DNA），因此是细胞的控制中心。',
          ':::'
        ].join('\n')
      }
    ],
    knowledgePoints: KNOWLEDGE_POINTS.map((kp) => ({
      ...kp,
      refs: [...kp.refs],
      prerequisites: [...kp.prerequisites],
      misconceptions: [...kp.misconceptions]
    })),
    curriculumRequirements: [
      '（占位待核）说明细胞是生物体结构和功能的基本单位，细胞的生活需要物质和能量。'
    ]
  }
}
