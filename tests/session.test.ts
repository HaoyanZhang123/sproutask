import { describe, expect, it } from 'vitest'
import { ChatSession, type ChatSessionDeps } from '@core/agent/session'
import { ToolRegistry } from '@core/agent/tools'
import { flagForTeacherTool } from '@core/agent/tools/flag-for-teacher'
import { getSectionTextTool } from '@core/agent/tools/get-section-text'
import { createDemoScope } from '@core/content/demo'
import type { StudyPosition } from '@core/domain'
import { RecordingClient } from './helpers/fixtures'

const registry = new ToolRegistry([getSectionTextTool as never, flagForTeacherTool as never])

function makeSession(client: RecordingClient, overrides: Partial<ChatSessionDeps> = {}) {
  return new ChatSession({ ...createSessionDeps(client), ...overrides })
}

function createSessionDeps(client: RecordingClient) {
  const demo = createDemoScope()
  return {
    client,
    registry,
    scopeFactory: (mode: Parameters<typeof createDemoScope>[0]) => createDemoScope(mode),
    getSectionText: async (sectionId: string) =>
      demo.sectionTexts.find((section) => section.sectionId === sectionId)?.text ?? null,
    studentId: 'S00',
    positions: demo.unit.sections.map((section) => ({
      position: { volumeId: '7s', unitId: demo.unit.id, sectionId: section.id },
      label: section.title
    }))
  }
}

describe('会话：开场与模式选择', () => {
  it('开场返回主动问句与四个选项（顺序固定）', () => {
    const session = makeSession(new RecordingClient([]))
    const info = session.start()
    expect(info.question).toContain('今天想做什么呢')
    expect(info.options.map((o) => o.label)).toEqual(['预习', '复习', '做题', '拓展'])
    expect(info.options.every((o) => o.hint.length > 0)).toBe(true)
  })

  it('接受数字选择，并带出模式名与位置', () => {
    const session = makeSession(new RecordingClient([]))
    const result = session.chooseMode('2')
    expect(result).toEqual({
      ok: true,
      mode: 'review',
      modeLabel: '复习',
      positionLabel: '第四章第一节 光合作用'
    })
    expect(session.getState().mode).toBe('review')
  })

  it('接受自然语言选择（复用与终端相同的解析规则）', () => {
    const session = makeSession(new RecordingClient([]))
    expect(session.chooseMode('我想预习一下新课')).toMatchObject({ ok: true, mode: 'preview' })
  })

  it('识别不了就明确说"没听懂"，不瞎猜', () => {
    const session = makeSession(new RecordingClient([]))
    const result = session.chooseMode('随便吧')
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.message).toContain('没听懂')
    expect(session.getState().mode).toBeNull()
  })

  it('有上次位置时优先沿用（自动恢复）', () => {
    const last: StudyPosition = { volumeId: '7s', unitId: 'demo-photosynthesis', sectionId: 's1' }
    const session = makeSession(new RecordingClient([]), {
      lastPosition: { position: last, label: '上次学到的地方' }
    })
    const result = session.chooseMode('复习')
    expect(result).toMatchObject({ ok: true, positionLabel: '上次学到的地方' })
    expect(session.start().question).toContain('上次你在：上次学到的地方')
  })
})

describe('会话：一轮对话', () => {
  it('未选模式时先要模式，不进循环', async () => {
    const client = new RecordingClient([])
    const session = makeSession(client)
    const outcome = await session.chat('光合作用是什么？')
    expect(outcome.needsMode).toBe(true)
    expect(client.callCount).toBe(0)
  })

  it('选好模式后走完整循环，并把这一轮写入历史', async () => {
    const client = new RecordingClient([
      { content: '你觉得植物靠什么长大呢？🌱', toolCalls: [] }
    ])
    const session = makeSession(client)
    session.chooseMode('2')

    const outcome = await session.chat('光合作用需要什么？')
    expect(outcome.needsMode).toBe(false)
    if (!outcome.needsMode) {
      expect(outcome.reply).toContain('你觉得')
      expect(outcome.guard.checked).toBe(true)
    }
    expect(session.getState().historyLength).toBe(2)
  })

  it('第二轮会把上一轮作为历史发给模型', async () => {
    const client = new RecordingClient([
      { content: '你先说说看，植物需要什么呢？', toolCalls: [] },
      { content: '不错，那还有别的吗？', toolCalls: [] }
    ])
    const session = makeSession(client)
    session.chooseMode('review')
    await session.chat('第一问')
    await session.chat('第二问')

    const secondCall = client.calls[1] ?? []
    const contents = secondCall.map((m) => m.content)
    expect(contents.some((c) => c.includes('第一问'))).toBe(true)
    expect(contents.some((c) => c.includes('你先说说看'))).toBe(true)
  })

  it('历史不会无限增长（保留最近部分）', async () => {
    const script = Array.from({ length: 20 }, () => ({
      content: '那你觉得呢？',
      toolCalls: []
    }))
    const client = new RecordingClient(script)
    const session = makeSession(client)
    session.chooseMode('review')
    for (let i = 0; i < 20; i += 1) {
      await session.chat(`第 ${i} 问`)
    }
    expect(session.getState().historyLength).toBeLessThanOrEqual(24)
  })

  it('模型不可用时给出降级结果（会话不崩）', async () => {
    const failing = {
      name: 'failing',
      async chat() {
        throw new Error('socket hang up')
      }
    }
    const session = makeSession(failing as never)
    session.chooseMode('review')
    const outcome = await session.chat('光合作用需要什么？')
    expect(outcome.needsMode).toBe(false)
    if (!outcome.needsMode) {
      expect(outcome.degraded?.kind).toBe('network')
      expect(outcome.reply).not.toContain('socket')
    }
  })

  it('reset 后回到未选模式状态', async () => {
    const session = makeSession(new RecordingClient([{ content: '你觉得呢？', toolCalls: [] }]))
    session.chooseMode('review')
    await session.chat('问题')
    session.reset()
    expect(session.getState()).toMatchObject({ mode: null, historyLength: 0, positionLabel: '' })
  })
})
