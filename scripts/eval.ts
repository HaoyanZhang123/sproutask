import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { parse as parseYaml } from 'yaml'
import { z } from 'zod'

import { DeepSeekClient } from '../src/core/llm/deepseek'
import type { ChatMessage } from '../src/core/llm'
import { PROMPT_VERSION, buildMessages } from '../src/core/prompts'
import {
  checkReply,
  renderReport,
  summarize,
  type EvalCase,
  type EvalResult
} from '../src/core/eval/runner'
import { createContentRuntime } from '../src/main/content/runtime'
import { loadDotEnv, readDeepSeekEnv } from './_env'

/**
 * 评测跑批：pnpm eval
 *
 * 读取 evals/cases/*.yaml，逐条跑一遍，产出 evals/reports/<日期>-<提示词版本>.md。
 * 需要 .env 中配置 DEEPSEEK_API_KEY；未配置时**明确报错**，不静默跳过。
 * （逻辑包在 main() 中：本仓库为 CJS 输出，不能用顶层 await。）
 */

const EvalCaseSchema = z.object({
  id: z.string().min(1),
  input: z.string().min(1),
  expect: z.object({
    must_not_contain: z.array(z.string()).optional(),
    must_ask_question: z.boolean().optional(),
    must_cite_textbook: z.boolean().optional(),
    max_chars: z.number().int().positive().optional()
  }),
  note: z.string().optional()
})
const EvalFileSchema = z.array(EvalCaseSchema)

async function main(): Promise<void> {
  loadDotEnv()
  const env = readDeepSeekEnv()

  if (!env.apiKey) {
    console.error('❌ 未检测到 DEEPSEEK_API_KEY，无法跑评测。')
    console.error('   请复制 .env.example 为 .env 并填入 Key（评测会真实调用模型，请注意费用）。')
    process.exit(1)
  }

  const casesDir = join('evals', 'cases')
  const files = readdirSync(casesDir).filter((name) => name.endsWith('.yaml') || name.endsWith('.yml'))

  const cases: EvalCase[] = []
  for (const file of files) {
    const raw = parseYaml(readFileSync(join(casesDir, file), 'utf-8'))
    cases.push(...EvalFileSchema.parse(raw))
  }

  console.log(`📋 加载 ${cases.length} 条用例（来自 ${files.length} 个文件）`)
  console.log(`   提示词版本：${PROMPT_VERSION}｜模型：${env.model}\n`)

  const client = new DeepSeekClient({ apiKey: env.apiKey, baseUrl: env.baseUrl, model: env.model })

  // 内容源：真实教材优先（本机有 content/units + 原文时），否则用演示占位内容。
  // 与桌面应用走同一套装配逻辑，保证"评测看到的上下文"和"学生看到的上下文"一致。
  const runtime = createContentRuntime(process.cwd(), (line) => console.log(`   ${line}`))
  const firstPosition = runtime.positions[0]
  if (!firstPosition) throw new Error('内容源没有可用的学习位置')
  const scope = runtime.scopeFor(firstPosition.position, 'review')
  console.log(`   内容源：${runtime.source === 'content' ? '真实教材' : '演示占位'}｜${runtime.describe}`)
  console.log(`   位置：${firstPosition.label}\n`)
  const results: EvalResult[] = []

  for (const testCase of cases) {
    const messages: ChatMessage[] = buildMessages({ scope, mastery: [] }, [], testCase.input)
    try {
      const reply = await client.chat(messages, { temperature: 0.3 })
      const result = checkReply(testCase, reply.content)
      results.push(result)
      console.log(`${result.passed ? '✅' : '❌'} ${result.id}`)
      if (!result.passed) console.log(`     ${result.failures.join('；')}`)
    } catch (error) {
      results.push({
        id: testCase.id,
        input: testCase.input,
        reply: '',
        passed: false,
        failures: [`调用失败：${error instanceof Error ? error.message : String(error)}`]
      })
      console.log(`⚠️  ${testCase.id} 调用失败`)
    }
  }

  const summary = summarize(results)
  const generatedAt = new Date().toISOString()
  const report = renderReport({
    promptVersion: PROMPT_VERSION,
    model: env.model,
    results,
    generatedAt
  })

  // 报告落点：
  //   - 演示内容（无教材原文）→ evals/reports/（可进 git，作为提示词迭代依据）
  //   - **真实教材** → content/textbook/_eval-reports/（本机目录，已被 .gitignore 覆盖）：
  //     模型回复会引用课本原句，按 ADR-0007"教材原文只在本机、不进仓库"处理
  const outDir = runtime.source === 'content'
    ? join('content', 'textbook', '_eval-reports')
    : join('evals', 'reports')
  mkdirSync(outDir, { recursive: true })
  // 文件名带"日期-时分秒"：同一天多次跑批不再互相覆盖（评测结果天然有波动，需要保留每一轮证据）
  const stamp = `${generatedAt.slice(0, 10)}-${generatedAt.slice(11, 19).replace(/:/g, '')}`
  const outFile = join(outDir, `${stamp}-${PROMPT_VERSION}.md`)
  writeFileSync(outFile, report, 'utf-8')

  console.log(
    `\n汇总：通过 ${summary.passed}/${summary.total}（${(summary.passRate * 100).toFixed(1)}%）｜答案泄漏用例 ${summary.leakCount} 条`
  )
  console.log(`报告已保存：${outFile}`)

  // 退出码即门禁：有用例失败就返回非零，否则"13/13 全失败仍 exit 0"会让它形同虚设
  // （独立审核员实测指出过这一点；规范里把它列为验收步骤，就必须真的能失败）
  if (summary.failed > 0) {
    console.error(`\n❌ 评测未通过：${summary.failed} 条用例失败。请对照上面的失败原因调整提示词后重跑。`)
    process.exit(1)
  }
}

void main()
