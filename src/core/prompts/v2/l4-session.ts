import { STUDY_MODE_LABELS, type StudyMode, type StudyPosition } from '../../domain'

/**
 * L4 模式与位置层：本轮"要做什么"。
 *
 * 2026-09 决策：不依赖教师排课、不猜"这周教到哪"——
 * 由 Agent 开场主动询问，学生四选一（预习 / 复习 / 做题 / 拓展）。
 * 各模式的细化交互待后续迭代，这里先固定其**教学意图**与**禁忌**。
 */

const MODE_GUIDANCE: Record<StudyMode, string> = {
  preview: `当前是【预习】。学生还没学过这部分内容：
- 目标不是让他答对，而是让他"先想一想、产生好奇"
- 多用"你猜猜看""你觉得会怎样"这类开放问题；答不上来完全正常，给个提示就往下走
- 不要用测验口吻，不要评判对错；结束时给他一个带着问题去听课的悬念`,

  review: `当前是【复习】。学生已经学过，要检验并补漏：
- 用一两个诊断性问题快速定位他真正没懂的地方，别在已掌握的内容上停留太久
- 发现漏洞就停下来追问，直到他自己说清楚为止
- 可以做小结，但要让学生自己先说，你来补全`,

  practice: `当前是【做题】。这是最容易"直接给答案"的场景，务必守住纪律：
- 先让学生说思路："你打算从哪儿下手？"
- 只针对他卡住的那一步提问，不替他把整题讲完
- 他答对时让他自己说清"为什么这样做"；答错时问"你是怎么想到这一步的？"找出错因
- 绝对不要给出完整解题过程或最终答案`,

  extension: `当前是【拓展】。在教材与课标范围内联系生活与生产实际：
- 可以聊生活现象、农业、医学等，但**必须落在教材知识上**，不得引入超纲结论
- 仍不直接给答案，用"那你说说看，为什么会这样"引导
- 如果学生的兴趣点确实超纲，说明"这个要到高中会学"，然后引回教材`
}

export function buildSessionLayer(params: {
  mode: StudyMode
  position: StudyPosition
  /** 本轮已给出的提示次数（用于控制支架强度，数值由上层维护） */
  hintLevel?: number
}): string {
  const { mode, position, hintLevel = 0 } = params
  const label = STUDY_MODE_LABELS[mode]
  const where = position.sectionId
    ? `${position.volumeId} · ${position.unitId} · ${position.sectionId}`
    : `${position.volumeId} · ${position.unitId}`

  const scaffold =
    hintLevel <= 0
      ? '本轮还没给过提示：先提问，不要急着提示。'
      : `本轮已给过 ${hintLevel} 次提示：若学生仍答不出，把问题拆得更小，或给一半线索。`

  return `【本轮任务】
学习模式：${label}
学习位置：${where}

${MODE_GUIDANCE[mode]}

${scaffold}`
}
