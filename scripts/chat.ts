import { createInterface } from 'node:readline/promises'
import { DeepSeekClient } from '../src/core/llm/deepseek'
import type { ChatMessage } from '../src/core/llm'
import { PROMPT_VERSION } from '../src/core/prompts'
import { IntentFlow, type PositionOption } from '../src/core/agent/intent'
import { runAgentTurn } from '../src/core/agent/loop'
import { ToolRegistry, createDefaultTools } from '../src/core/agent/tools'
import { STUDY_MODE_LABELS } from '../src/core/domain'
import { createDemoScope } from './demo-scope'
import { loadDotEnv, readDeepSeekEnv } from './_env'

/**
 * 终端里的"小芽"——验证提示词、意图询问流程与流式输出的最快方式。
 *
 * 用法：pnpm chat
 * 流程：开场主动询问 → 学生四选一（预习/复习/做题/拓展）→ 进入对话
 * 退出：输入 exit / 退出 / Ctrl+C
 *
 * 说明：逻辑包在 main() 里而非使用顶层 await——本仓库 package.json 没有 "type": "module"
 * （Electron 主进程需要 CJS 输出），顶层 await 会被 tsx 当作 CJS 报错。
 */

async function main(): Promise<void> {
  loadDotEnv()

  const env = readDeepSeekEnv()
  const client = new DeepSeekClient({ apiKey: env.apiKey, baseUrl: env.baseUrl, model: env.model })
  const history: ChatMessage[] = []

  const rl = createInterface({ input: process.stdin, output: process.stdout })

  // ── 意图询问：Agent 主动发问，学生四选一 ──────────────────────
  const demoScope = createDemoScope()
  const positions: PositionOption[] = demoScope.unit.sections.map((section) => ({
    position: { volumeId: '7s', unitId: demoScope.unit.id, sectionId: section.id },
    label: section.title
  }))

  const flow = new IntentFlow({
    ask: async (question) => {
      console.log(`\n小芽 > ${question}\n`)
      return await rl.question('你 > ')
    },
    positions,
    lastPosition: null // 真实持久化由调用方接入（见 src/core/storage）
  })

  const intent = await flow.run()
  const scope = createDemoScope(intent.mode)

  if (!env.apiKey) {
    console.log('⚠️  未检测到 DEEPSEEK_API_KEY。')
    console.log('   请把 .env.example 复制为 .env 并填入你的 Key，然后重新运行 pnpm chat。\n')
  }

  console.log(`🌱 小芽（提示词 ${PROMPT_VERSION}｜模型 ${env.model}）`)
  console.log(
    `   模式：${STUDY_MODE_LABELS[intent.mode]}${intent.fallbackUsed ? '（未能识别你的选择，已默认复习）' : ''}` +
      `｜章节：${positions.map((p) => p.label).join('、')}`
  )
  console.log('   现在可以开始提问了；输入 exit 退出。\n')

  // 走完整 Agent 循环（工具调用 + 答案泄漏护栏 + 降级）
  const registry = new ToolRegistry(createDefaultTools())

  for (;;) {
    const raw = await rl.question('你 > ')
    const input = raw.trim()
    if (!input) continue
    if (['exit', 'quit', '退出'].includes(input.toLowerCase())) break

    // 说明：这里**不做逐字流式**。护栏可能要求重生成，若先流式显示了被判定泄漏的内容就无法撤回；
    // 「流式 与 护栏」的交互方案（缓冲后整段显示 / 先显示"想一想"状态）待界面迭代决定。
    process.stdout.write('小芽 > [思考中…]\r')
    const result = await runAgentTurn({
      client,
      registry,
      prompt: { scope, mastery: [] },
      history,
      userMessage: input,
      toolContext: {
        studentId: 'S00',
        getSectionText: async (sectionId) =>
          scope.sectionTexts.find((section) => section.sectionId === sectionId)?.text ?? null
      }
    })

    // 覆盖掉"[思考中…]"那一行
    process.stdout.write('小芽 > ' + result.reply + '\n')

    if (result.toolCalls.length > 0) {
      console.log(
        `\n  ⚙️ 工具：${result.toolCalls.map((c) => `${c.name}${c.ok ? '' : '(失败)'}`).join('、')}`
      )
    }
    if (result.flags.length > 0) {
      console.log(`  🚩 标记：${result.flags.join('、')}`)
    }
    if (result.guard.triggered) {
      console.log(
        `  🛡️ 护栏命中${result.guard.regenerated ? '（已重写）' : ''}：${result.guard.reasons.join('；')}`
      )
    }
    if (result.degraded) {
      console.log(`  ⚠️ 降级（${result.degraded.kind}）：已用可读话术替代`)
    }
    console.log(`  ⏱ 迭代 ${result.iterations} 轮\n`)

    history.push({ role: 'user', content: input })
    history.push({ role: 'assistant', content: result.reply })
  }

  rl.close()
  console.log('再见！🌱')
}

void main()
