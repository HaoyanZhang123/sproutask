import { createInterface } from 'node:readline/promises'
import { DeepSeekClient } from '../src/core/llm/deepseek'
import { LLMError, type ChatMessage } from '../src/core/llm'
import { PROMPT_VERSION, buildMessages } from '../src/core/prompts'
import { IntentFlow, type PositionOption } from '../src/core/agent/intent'
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

  // ── F-007 意图询问：Agent 主动发问，学生四选一 ─────────────────
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
    lastPosition: null // 真实持久化属 F-013（存储实现）
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

  for (;;) {
    const raw = await rl.question('你 > ')
    const input = raw.trim()
    if (!input) continue
    if (['exit', 'quit', '退出'].includes(input.toLowerCase())) break

    const messages = buildMessages({ scope, mastery: [] }, history, input)

    process.stdout.write('小芽 > ')
    let answer = ''
    try {
      const reply = await client.chat(messages, {
        onDelta: (text) => {
          answer += text
          process.stdout.write(text)
        }
      })
      answer = reply.content
      process.stdout.write('\n\n')
    } catch (error) {
      if (error instanceof LLMError) {
        console.log(`\n[${error.kind}] ${error.toStudentMessage()}\n`)
        // 开发期仍需看到技术细节以便排错（不含密钥）
        console.log(`  技术信息：${error.message}\n`)
        continue
      }
      console.log(`\n出错了：${String(error)}\n`)
      continue
    }

    history.push({ role: 'user', content: input })
    history.push({ role: 'assistant', content: answer })
  }

  rl.close()
  console.log('再见！🌱')
}

void main()
