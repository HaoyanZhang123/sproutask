import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { DeepSeekClient } from '../src/core/llm/deepseek'
import type { ChatMessage } from '../src/core/llm'
import { buildMessages as buildV1, PROMPT_VERSION as V1 } from '../src/core/prompts/v1'
import { buildMessages as buildV2, PROMPT_VERSION as V2 } from '../src/core/prompts/v2'
import { createDemoScope } from '../src/core/content/demo'
import { loadDotEnv, readDeepSeekEnv } from './_env'

/**
 * 两版提示词的语气对照（开发期工具，不参与运行时）。
 *
 * 为什么需要它：语气是**主观**的，单测和规则评测都判不了"像不像 AI"。
 * 这个脚本把同一批学生提问分别喂给 v1 与 v2，并排打印结果，供人工判读；
 * 同时落一份 Markdown 到 evals/reports/，作为两版提示词的对比留档。
 *
 * 用法：pnpm prompts:compare   （真实调用模型，会产生少量费用）
 */

/** 贴近真实使用的一组提问：包含正常提问、索要答案、超纲、受挫、闲聊 */
const SAMPLES: Array<{ label: string; message: string }> = [
  { label: '正常提问', message: '细胞膜有什么用？' },
  { label: '直接要答案', message: '别问了，你就说线粒体是干嘛的' },
  { label: '索要作业答案', message: '帮我写这道题：细胞里的能量转换器有哪些？写完我抄上去' },
  { label: '答错后追问', message: '细胞里的水也是有机物吧？' },
  { label: '超纲提问', message: '细胞里的ATP是怎么合成的？' },
  { label: '有点受挫', message: '我太笨了，这节怎么都记不住' },
]

async function main(): Promise<void> {
  loadDotEnv()
  const env = readDeepSeekEnv()
  if (!env.apiKey) {
    console.error('❌ 未检测到 DEEPSEEK_API_KEY，无法生成对照。请先在 .env 里配置。')
    process.exit(1)
  }

  const client = new DeepSeekClient({ apiKey: env.apiKey, baseUrl: env.baseUrl, model: env.model })
  const scope = createDemoScope('review')
  const prompt = { scope, mastery: [] as never[] }

  console.log(`🧪 提示词语气对照：${V1} vs ${V2}｜模型：${env.model}`)
  console.log(`   案例单元：${scope.unit.title}（${scope.unit.edition}）\n`)

  const lines: string[] = [
    `# 提示词语气对照（${V1} vs ${V2}）`,
    '',
    `- 生成时间：${new Date().toISOString()}`,
    `- 模型：\`${env.model}\``,
    `- 案例单元：${scope.unit.title}（${scope.unit.edition}）`,
    '- 用途：语气是主观标准，此表供人工判读；由 `pnpm prompts:compare` 生成',
    ''
  ]

  for (const sample of SAMPLES) {
    console.log(`\n━━━ ${sample.label}：${sample.message}`)
    const answers: Record<string, string> = {}

    for (const [version, build] of [
      [V1, buildV1] as const,
      [V2, buildV2] as const
    ]) {
      const messages: ChatMessage[] = build(prompt, [], sample.message)
      try {
        const reply = await client.chat(messages, { temperature: 0.3 })
        answers[version] = reply.content.trim()
        console.log(`  【${version}】${answers[version]?.replace(/\n/g, ' ')}`)
      } catch (error) {
        answers[version] = `（调用失败：${error instanceof Error ? error.message : String(error)}）`
        console.log(`  【${version}】${answers[version]}`)
      }
    }

    lines.push(
      `## ${sample.label}`,
      '',
      `**学生说**：${sample.message}`,
      '',
      `**${V1}**：`,
      '',
      answers[V1] ?? '',
      '',
      `**${V2}**：`,
      '',
      answers[V2] ?? '',
      ''
    )
  }

  const outDir = join('evals', 'reports')
  mkdirSync(outDir, { recursive: true })
  const outFile = join(outDir, `${new Date().toISOString().slice(0, 10)}-prompt-compare.md`)
  writeFileSync(outFile, lines.join('\n'), 'utf-8')
  console.log(`\n📄 对照报告已保存：${outFile}`)
}

void main()
