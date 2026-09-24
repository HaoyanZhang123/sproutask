import type { StudyScope } from '../content'
import type { LLMClient } from '../llm'

/**
 * 答案泄漏护栏（本产品的差异化关键）。
 *
 * 问题：模型很难靠提示词 100% 守住"不给答案"，偶尔会直接把结论说出来。
 * 做法：回答产出后**再判定一次**，命中则加严指令重生成一次；仍命中就打标并如实记录。
 *
 * 两层判定：
 *   1. **规则层**（默认启用、零成本、可解释）：与知识点要点的重合、是否缺少提问、是否出现"答案就是…"式措辞
 *   2. **模型层**（可选、更准、额外一次调用）：让模型回答"这段回复是否已给出最终答案"
 *      —— 参考 Khanmigo 的护栏思路，但这里保持可插拔，默认关（成本翻倍）
 */

export interface LeakCheckResult {
  leaked: boolean
  reasons: string[]
}

export interface LeakGuardOptions {
  /** 走模型二次判定（默认关闭：每次多花一次调用） */
  useModelCheck?: boolean
  client?: LLMClient
}

/** 明确"给答案"的措辞（命中即视为泄漏） */
const ANSWER_PHRASES = [
  '答案是',
  '正确答案是',
  '结论是',
  '所以答案',
  '直接告诉你',
  '记住了：',
  '简单说就是'
]

/** 护栏需要把握的"要点最小长度"：太短会误伤（如"光"），太长会漏判 */
const MIN_KEY_TERM_LENGTH = 6

/** 规则层判定（纯函数，可离线单测） */
export function ruleBasedLeakCheck(input: { reply: string; scope: StudyScope }): LeakCheckResult {
  const reply = input.reply.trim()
  const reasons: string[] = []

  if (!reply) {
    return { leaked: true, reasons: ['回复为空（模型没有产出内容）'] }
  }

  // 1) 是否出现"给答案"的措辞
  const phrase = ANSWER_PHRASES.find((item) => reply.includes(item))
  if (phrase) reasons.push(`出现直给措辞「${phrase}」`)

  // 2) 是否复述了知识点要点的关键片段
  for (const kp of input.scope.knowledgePoints) {
    for (const term of keyTermsOf(kp.summary)) {
      if (reply.includes(term)) {
        reasons.push(`复述了「${kp.title}」的要点片段「${term}」`)
        break
      }
    }
  }

  // 3) 苏格拉底纪律：教学场景的回复应当以提问推进
  if (!/[？?]/.test(reply)) {
    reasons.push('整段回复没有提问（苏格拉底式引导要求以提问推进）')
  }

  return { leaked: reasons.length > 0, reasons }
}

/** 从要点里切出可判定的片段（按标点切分，过滤过短片段） */
export function keyTermsOf(summary: string): string[] {
  return summary
    .split(/[，,、；;。.（）()：:\s]+/)
    .map((piece) => piece.trim())
    .filter((piece) => piece.length >= MIN_KEY_TERM_LENGTH)
}

const MODEL_CHECK_PROMPT = `你在检查一段教学对话是否"剧透了答案"。

学生正在被引导自己思考，AI 助手的职责是提问与提示，**不应直接说出最终结论**。

请只回答一个词：
- 如果这段回复已经**明确说出了**该知识点的结论/答案 → 回答：是
- 如果它只是提问、给线索、鼓励学生继续说 → 回答：否`

/** 模型层判定：让模型只回"是/否"，解析失败一律视为"未泄漏"（宁可漏判也不打断教学） */
export async function modelBasedLeakCheck(
  input: { reply: string; scope: StudyScope },
  client: LLMClient
): Promise<LeakCheckResult> {
  const points = input.scope.knowledgePoints
    .map((kp) => `- ${kp.title}：${kp.summary}`)
    .join('\n')

  try {
    const response = await client.chat([
      { role: 'system', content: MODEL_CHECK_PROMPT },
      {
        role: 'user',
        content: `【知识点与其要点】\n${points}\n\n【助手刚说的话】\n${input.reply}\n\n这段回复是否已给出最终答案？只回答"是"或"否"。`
      }
    ])
    const verdict = response.content.trim()
    const leaked = verdict.startsWith('是')
    return { leaked, reasons: leaked ? [`模型判定已给出答案（原回复：${verdict.slice(0, 10)}）`] : [] }
  } catch {
    // 判定失败不应影响教学，安静放过（但上层仍会记录规则层结果）
    return { leaked: false, reasons: [] }
  }
}

/** 组合判定：规则层始终执行；模型层可选用 */
export async function checkAnswerLeak(
  input: { reply: string; scope: StudyScope },
  options: LeakGuardOptions = {}
): Promise<LeakCheckResult> {
  const rule = ruleBasedLeakCheck(input)
  if (!options.useModelCheck || !options.client) return rule

  const model = await modelBasedLeakCheck(input, options.client)
  const reasons = [...rule.reasons, ...model.reasons]
  return { leaked: rule.leaked || model.leaked, reasons }
}
