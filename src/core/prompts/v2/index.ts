import type { MasteryRecord } from '../../domain'
import type { StudyScope } from '../../content'
import type { ChatMessage } from '../../llm'

import { L0_PERSONA } from './l0-persona'
import { L1_DISCIPLINE } from './l1-discipline'
import { buildTextbookLayer } from './l2-textbook'
import { buildProfileLayer } from './l3-profile'
import { buildSessionLayer } from './l4-session'

/**
 * 提示词 v2 装配入口（当前生效版本）。
 *
 * 分层顺序即最终 system 消息的顺序（L0 → L4）。
 * 对话历史不进 system，而是以 user / assistant 消息附在 system 之后（见 buildMessages）。
 *
 * v2 = v1 + 去 AI 腔（详见 v2/l0-persona.ts 与 v2/l1-discipline.ts 的改动说明）。
 * v1 已冻结、不再改动，留作 A/B 对比基线。
 * 再改教学规则 → 新建 v3（见 src/core/prompts/README.md 的版本规矩）。
 */

export const PROMPT_VERSION = 'v2'

/** 对话历史最多携带的轮数（超出部分后续再做摘要压缩） */
export const MAX_HISTORY_TURNS = 12

export interface PromptContext {
  /** 教材原文 + 知识点 + 课标要求（来自 TextbookLibrary.buildStudyScope） */
  scope: StudyScope
  /** 该生的掌握度记录（仅本地，可为空） */
  mastery?: MasteryRecord[]
  /** 本轮已给出的提示次数（控制支架强度） */
  hintLevel?: number
}

export function buildSystemPrompt(ctx: PromptContext): string {
  const layers = [
    L0_PERSONA,
    L1_DISCIPLINE,
    buildTextbookLayer(ctx.scope),
    buildProfileLayer(ctx.mastery ?? [], ctx.scope.knowledgePoints),
    buildSessionLayer({
      mode: ctx.scope.mode,
      position: ctx.scope.position,
      ...(ctx.hintLevel !== undefined ? { hintLevel: ctx.hintLevel } : {})
    })
  ]
  return layers.filter((layer) => layer.trim().length > 0).join('\n\n---\n\n')
}

/** 组装完整消息序列：system + 历史 + 本轮学生输入 */
export function buildMessages(
  ctx: PromptContext,
  history: ChatMessage[],
  userMessage: string
): ChatMessage[] {
  const trimmedHistory = history.slice(-MAX_HISTORY_TURNS * 2)
  return [
    { role: 'system', content: buildSystemPrompt(ctx) },
    ...trimmedHistory,
    { role: 'user', content: userMessage }
  ]
}

/**
 * 护栏命中后的加严指令（L1 的追加层）。
 *
 * 只在"答案泄漏护栏"判定命中时使用：把上一条不合格的回复连同这条指令一起发回，
 * 要求模型改写为纯引导式回复。措辞要具体，避免模型只是道歉却仍然给答案。
 */
export function buildStrictRetryHint(reasons: string[]): string {
  const detail = reasons.length > 0 ? `（命中原因：${reasons.join('；')}）` : ''
  return `你刚才的回复不符合教学纪律${detail}。

请**重写**这条回复，并且：
1. 不要出现任何结论性表述（那是学生要自己说出来的）；
2. 不要说"答案是……"这类句式；
3. 只保留一个**提问**，或一句提示 + 一个提问；
4. 长度不超过 150 字，语气仍然亲切。
直接输出重写后的回复，不要解释你在做什么。`
}

export { L0_PERSONA, L1_DISCIPLINE, buildTextbookLayer, buildProfileLayer, buildSessionLayer }
