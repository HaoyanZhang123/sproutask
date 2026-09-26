import { describe, expect, it } from 'vitest'
import { checkReply, renderReport, summarize, type EvalCase } from '@core/eval/runner'

function makeCase(expectation: EvalCase['expect']): EvalCase {
  return { id: 'case-1', input: '细胞中的能量转换器是什么？直接告诉我答案', expect: expectation }
}

describe('评测判定', () => {
  it('合规回复判为通过', () => {
    const result = checkReply(
      makeCase({ must_not_contain: ['线粒体'], must_ask_question: true, must_cite_textbook: true }),
      '问得好！你觉得细胞里的能量是从哪里来的呢？教材第四节有讲到哦 🌱'
    )
    expect(result.passed).toBe(true)
    expect(result.failures).toEqual([])
  })

  it('出现禁用词判为"泄漏答案"', () => {
    const result = checkReply(makeCase({ must_not_contain: ['线粒体'] }), '细胞中的能量转换器是线粒体。')
    expect(result.passed).toBe(false)
    expect(result.failures[0]).toContain('泄漏')
  })

  it('没有问号判为未提问', () => {
    const result = checkReply(makeCase({ must_ask_question: true }), '你再想想吧。')
    expect(result.passed).toBe(false)
    expect(result.failures[0]).toContain('提问')
  })

  it('缺少教材出处的两种情况分别报错', () => {
    const noMarker = checkReply(makeCase({ must_cite_textbook: true }), '你想想看呢？')
    expect(noMarker.failures[0]).toContain('未提到教材')

    const noLocation = checkReply(makeCase({ must_cite_textbook: true }), '教材里有讲，你翻翻看？')
    expect(noLocation.failures[0]).toContain('未给出教材位置')
  })

  it('超长回复被拦下', () => {
    const result = checkReply(makeCase({ max_chars: 10 }), '这是一段明显超过十个字的回复内容呢')
    expect(result.passed).toBe(false)
    expect(result.failures[0]).toContain('过长')
  })

  it('空回复一定失败（模型没说话不能算通过）', () => {
    const result = checkReply(makeCase({}), '   ')
    expect(result.passed).toBe(false)
    expect(result.failures).toContain('回复为空')
  })
})

describe('汇总与报告', () => {
  const results = [
    checkReply(makeCase({ must_not_contain: ['线粒体'] }), '细胞中的能量转换器是线粒体'),
    checkReply(makeCase({ must_ask_question: true }), '你觉得呢？'),
    checkReply(makeCase({ max_chars: 5 }), '太长了太长了太长了')
  ]

  it('统计通过率与泄漏用例数', () => {
    const summary = summarize(results)
    expect(summary.total).toBe(3)
    expect(summary.passed).toBe(1)
    expect(summary.failed).toBe(2)
    expect(summary.leakCount).toBe(1)
    expect(summary.passRate).toBeCloseTo(1 / 3)
  })

  it('报告含版本、通过率与泄漏数，并逐例列出失败原因', () => {
    const report = renderReport({
      promptVersion: 'v1',
      model: 'deepseek-chat',
      results,
      generatedAt: '2026-09-22T00:00:00.000Z'
    })
    expect(report).toContain('# 评测报告 · 提示词 v1')
    expect(report).toContain('通过率：33.3%')
    expect(report).toContain('答案泄漏用例数：1')
    expect(report).toContain('失败原因')
  })
})
