import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { KnowledgePointSchema, MasteryRecordSchema } from '@core/domain'
import { MockLLMClient } from '@core/llm'

/* ── 领域契约 ─────────────────────────────────────────────── */

describe('领域契约', () => {
  it('合法的知识点能通过校验', () => {
    const kp = KnowledgePointSchema.parse({
      id: 'kp-photosynthesis-condition',
      unitId: '7s-photosynthesis',
      title: '光合作用的条件',
      summary: '光合作用需要光、二氧化碳和水',
      refs: [{ sectionId: 's1', page: 80 }],
      difficulty: 2
    })
    expect(kp.prerequisites).toEqual([])
    expect(kp.misconceptions).toEqual([])
  })

  it('知识点 id 必须带 kp- 前缀', () => {
    const bad = () =>
      KnowledgePointSchema.parse({
        id: 'photosynthesis',
        unitId: 'u1',
        title: 't',
        summary: 's',
        refs: [{ sectionId: 's1' }],
        difficulty: 1
      })
    expect(bad).toThrow()
  })

  it('学情记录只接受编号形式的学生 id（合规：不存真实姓名）', () => {
    const ok = MasteryRecordSchema.parse({
      studentId: 'S07',
      kpId: 'kp-photosynthesis-condition',
      state: 'exploring',
      updatedAt: new Date().toISOString()
    })
    expect(ok.state).toBe('exploring')

    expect(() =>
      MasteryRecordSchema.parse({
        studentId: '张三',
        kpId: 'kp-x',
        state: 'mastered',
        updatedAt: new Date().toISOString()
      })
    ).toThrow()
  })
})

/* ── LLM 抽象层 ───────────────────────────────────────────── */

describe('MockLLMClient', () => {
  it('按脚本返回，脚本耗尽后给兜底话术而不抛错', async () => {
    const client = new MockLLMClient([
      { content: '你觉得植物是靠什么长大的？', toolCalls: [] }
    ])
    const first = await client.chat([{ role: 'user', content: '光合作用是什么' }])
    expect(first.content).toContain('植物')
    expect(first.toolCalls).toEqual([])

    const second = await client.chat([{ role: 'user', content: '再说一次' }])
    expect(second.content).toContain('Mock')
  })
})

/* ── 分层依赖铁律（docs/CONVENTIONS.md §2） ───────────────── */

function walk(dir: string): string[] {
  const out: string[] = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) out.push(...walk(full))
    else if (entry.name.endsWith('.ts')) out.push(full)
  }
  return out
}

describe('分层依赖铁律', () => {
  it('core 层不得依赖 electron / vue', () => {
    const offenders: string[] = []
    const pattern = /from\s+['"](electron|vue|pinia|@vue\/[^'"]+)['"]/

    for (const file of walk('src/core')) {
      const source = readFileSync(file, 'utf-8')
      if (pattern.test(source)) offenders.push(file)
    }

    expect(offenders, `以下文件违反了 core 层不得依赖宿主能力的约定：\n${offenders.join('\n')}`).toEqual([])
  })
})
