import { describe, expect, it } from 'vitest'
import {
  checkAnswerLeak,
  keyTermsOf,
  modelBasedLeakCheck,
  ruleBasedLeakCheck
} from '@core/agent/guard'
import { MockLLMClient } from '@core/llm'
import { makeScope } from './helpers/fixtures'

const scope = makeScope()

describe('要点片段切分', () => {
  it('按标点切分并过滤过短片段（避免"光"这类误伤）', () => {
    expect(keyTermsOf('细胞膜控制物质进出，有用的物质进入细胞、废物排出细胞')).toEqual([
      '细胞膜控制物质进出',
      '有用的物质进入细胞',
      '废物排出细胞'
    ])
    expect(keyTermsOf('光、水')).toEqual([])
  })
})

describe('规则层护栏', () => {
  it('纯引导式回复判为合格', () => {
    const result = ruleBasedLeakCheck({
      reply: '问得好！你觉得细胞里的物质可以分成哪两类呢？教材第四节的这张图有提示哦 🌱',
      scope
    })
    expect(result.leaked).toBe(false)
    expect(result.reasons).toEqual([])
  })

  it('出现"答案是…"式措辞即判为泄漏', () => {
    const result = ruleBasedLeakCheck({
      reply: '答案是细胞膜控制物质进出，你记住了吗？',
      scope
    })
    expect(result.leaked).toBe(true)
    expect(result.reasons.join()).toContain('直给措辞')
  })

  it('复述知识点要点片段即判为泄漏', () => {
    const result = ruleBasedLeakCheck({
      reply: '细胞膜控制物质进出，有用的物质进入细胞，所以……你明白了吗？',
      scope
    })
    expect(result.leaked).toBe(true)
    expect(result.reasons.join()).toContain('要点片段')
  })

  it('整段没有提问也要重写（苏格拉底纪律）', () => {
    const result = ruleBasedLeakCheck({ reply: '嗯嗯，你说得挺好的。', scope })
    expect(result.leaked).toBe(true)
    expect(result.reasons.join()).toContain('没有提问')
  })

  it('空回复视为异常（模型没产出内容）', () => {
    const result = ruleBasedLeakCheck({ reply: '   ', scope })
    expect(result.leaked).toBe(true)
    expect(result.reasons[0]).toContain('回复为空')
  })
})

describe('模型层护栏（可选）', () => {
  it('模型回答"是"判定为泄漏', async () => {
    const client = new MockLLMClient([{ content: '是', toolCalls: [] }])
    const result = await modelBasedLeakCheck({ reply: '细胞中的能量转换器是线粒体。', scope }, client)
    expect(result.leaked).toBe(true)
  })

  it('模型回答"否"判定为未泄漏', async () => {
    const client = new MockLLMClient([{ content: '否', toolCalls: [] }])
    const result = await modelBasedLeakCheck({ reply: '你觉得呢？', scope }, client)
    expect(result.leaked).toBe(false)
  })

  it('判定调用失败时不打断教学（视为未泄漏）', async () => {
    const failing = {
      name: 'failing',
      async chat() {
        throw new Error('网络中断')
      }
    }
    const result = await modelBasedLeakCheck({ reply: '你觉得呢？', scope }, failing)
    expect(result.leaked).toBe(false)
  })
})

describe('组合判定', () => {
  it('默认只跑规则层（不额外调用模型）', async () => {
    const client = new MockLLMClient([{ content: '是', toolCalls: [] }])
    const result = await checkAnswerLeak({ reply: '你觉得植物靠什么长大呢？', scope }, { client })
    expect(result.leaked).toBe(false)
    expect(client.consumed).toBe(0)
  })

  it('开启模型层后规则与模型结果取并集', async () => {
    const client = new MockLLMClient([{ content: '是', toolCalls: [] }])
    const result = await checkAnswerLeak(
      { reply: '你猜猜看，植物需要什么？', scope },
      { useModelCheck: true, client }
    )
    expect(result.leaked).toBe(true)
    expect(client.consumed).toBe(1)
  })
})
