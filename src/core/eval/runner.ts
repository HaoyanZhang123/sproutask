/**
 * 评测期望判定（纯函数，可离线单测）。
 * 判定规则刻意保持"可解释"——评测报告里要能说清每条为什么算失败。
 */

export interface EvalExpectation {
  /** 回复中不允许出现的内容（命中即判为"泄漏答案"） */
  must_not_contain?: string[]
  /** 回复是否必须以提问收尾/包含问号 */
  must_ask_question?: boolean
  /** 回复是否必须给出教材出处（含"教材/课本"且含"第X章节/页"） */
  must_cite_textbook?: boolean
  /** 回复长度上限（按字符数，含标点） */
  max_chars?: number
}

export interface EvalCase {
  id: string
  input: string
  expect: EvalExpectation
  /** 可选：用例说明，写进报告便于读者理解 */
  note?: string
}

export interface EvalResult {
  id: string
  input: string
  reply: string
  passed: boolean
  failures: string[]
}

const CITE_MARKER = /(教材|课本)/
const CITE_LOCATION = /第\s*[〇零一二三四五六七八九十百\d]+\s*[章节页]|\d+\s*页/

export function checkReply(testCase: EvalCase, reply: string): EvalResult {
  const failures: string[] = []
  const text = reply.trim()

  for (const forbidden of testCase.expect.must_not_contain ?? []) {
    if (forbidden && text.includes(forbidden)) {
      failures.push(`泄漏了答案关键词「${forbidden}」`)
    }
  }

  if (testCase.expect.must_ask_question && !/[？?]/.test(text)) {
    failures.push('没有提问（缺少问号）')
  }

  if (testCase.expect.must_cite_textbook) {
    if (!CITE_MARKER.test(text)) failures.push('未提到教材/课本')
    else if (!CITE_LOCATION.test(text)) failures.push('未给出版本位置（如"第四章第一节"）')
  }

  if (testCase.expect.max_chars !== undefined && text.length > testCase.expect.max_chars) {
    failures.push(`回复过长（${text.length} > ${testCase.expect.max_chars} 字）`)
  }

  if (text.length === 0) failures.push('回复为空')

  return {
    id: testCase.id,
    input: testCase.input,
    reply: text,
    passed: failures.length === 0,
    failures
  }
}

export interface EvalSummary {
  total: number
  passed: number
  failed: number
  passRate: number
  /** "泄漏答案"类失败的用例数——评测报告的核心指标之一 */
  leakCount: number
}

export function summarize(results: EvalResult[]): EvalSummary {
  const total = results.length
  const passed = results.filter((r) => r.passed).length
  const leakCount = results.filter((r) => r.failures.some((f) => f.includes('泄漏'))).length
  return {
    total,
    passed,
    failed: total - passed,
    passRate: total === 0 ? 0 : passed / total,
    leakCount
  }
}

/** 生成 Markdown 报告（写进 evals/reports/，作为提示词迭代依据） */
export function renderReport(params: {
  promptVersion: string
  model: string
  results: EvalResult[]
  generatedAt: string
}): string {
  const { promptVersion, model, results, generatedAt } = params
  const summary = summarize(results)

  const lines: string[] = [
    `# 评测报告 · 提示词 ${promptVersion}`,
    '',
    `- 生成时间：${generatedAt}`,
    `- 模型：${model}`,
    `- 用例数：${summary.total}｜通过：${summary.passed}｜失败：${summary.failed}`,
    `- **通过率：${(summary.passRate * 100).toFixed(1)}%**`,
    `- **答案泄漏用例数：${summary.leakCount}**`,
    '',
    '> 判定为规则匹配（关键词 / 问号 / 引用格式），无法判断语义等价；失败原因逐条列出以便人工复核。',
    '',
    '## 逐例结果',
    ''
  ]

  for (const result of results) {
    lines.push(`### ${result.passed ? '✅' : '❌'} ${result.id}`)
    lines.push('')
    lines.push(`- 学生输入：${result.input}`)
    lines.push(`- 小芽回复：${result.reply || '（空）'}`)
    if (!result.passed) lines.push(`- 失败原因：${result.failures.join('；')}`)
    lines.push('')
  }

  return lines.join('\n')
}
