import { appendFileSync, mkdtempSync, mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import type { Session, Turn } from '@core/domain'
import {
  countTurns,
  createJsonlStudentStore,
  latestSession,
  listSessionIds,
  readJsonl,
  sessionFileOf
} from '../src/main/storage/jsonl-store'

/**
 * JSONL 存储（`StudentStore` 的实现，选型见 docs/adr/ADR-0003 决策二）。
 * 重点验三件事：**数据能持久**、**坏行不会毁掉整个文件**、**掌握度是追加日志且最新状态胜出**。
 */

const STUDENT = 'S07'

function freshDir(): string {
  return mkdtempSync(join(tmpdir(), 'sproutask-store-'))
}

function makeSession(id: string, startedAt = '2026-09-27T10:00:00.000Z'): Session {
  return {
    id,
    studentId: STUDENT,
    studyMode: 'review',
    position: { volumeId: 'rjb-7s', unitId: 'u-cell-basic-unit', sectionId: 's1' },
    startedAt
  }
}

function makeTurn(id: string, sessionId: string, role: 'user' | 'assistant', content: string, createdAt: string): Turn {
  return { id, sessionId, role, content, flags: [], createdAt }
}

describe('JSONL 学生存储', () => {
  it('学生登记可写入可读回', async () => {
    const dir = freshDir()
    const { store } = createJsonlStudentStore(dir)
    await store.upsertStudent({ id: STUDENT, createdAt: '2026-09-27T09:00:00.000Z' })
    const got = await store.getStudent(STUDENT)
    expect(got?.id).toBe(STUDENT)
    expect(await store.getStudent('S99')).toBeNull()
  })

  it('会话与消息：写入后读回，且按时间排序', async () => {
    const dir = freshDir()
    const { store } = createJsonlStudentStore(dir)
    const session = makeSession('sess-1')
    await store.createSession(session)
    await store.appendTurn(makeTurn('t2', session.id, 'assistant', '你先说说看？', '2026-09-27T10:00:20.000Z'))
    await store.appendTurn(makeTurn('t1', session.id, 'user', '细胞膜有什么用', '2026-09-27T10:00:10.000Z'))

    const turns = await store.listTurns(session.id)
    expect(turns.map((t) => t.id)).toEqual(['t1', 't2'])
    expect(turns[0]?.content).toContain('细胞膜')

    expect(await store.getSession(session.id)).toMatchObject({ id: 'sess-1', studyMode: 'review' })
    await store.endSession(session.id, '2026-09-27T10:05:00.000Z')
    expect((await store.getSession(session.id))?.endedAt).toBe('2026-09-27T10:05:00.000Z')
  })

  it('会话文件缺失时 appendTurn 静默跳过（宁可丢一轮，也不让对话崩）', async () => {
    const dir = freshDir()
    const { store } = createJsonlStudentStore(dir)
    await expect(store.appendTurn(makeTurn('t1', 'no-such-session', 'user', 'hi', '2026-09-27T10:00:00.000Z'))).resolves.toBeUndefined()
    expect(await store.listTurns('no-such-session')).toEqual([])
  })

  it('崩溃容错：文件最后一行残缺时，前面的记录仍能读出并统计坏行', async () => {
    const dir = freshDir()
    mkdirSync(join(dir, 'x'), { recursive: true })
    const file = join(dir, 'x', 'broken.jsonl')
    writeFileSync(file, '{"a":1}\n{"b":2}\n{"c":', 'utf-8')
    const { records, brokenLines } = readJsonl<{ a?: number; b?: number }>(file)
    expect(records).toHaveLength(2)
    expect(brokenLines).toBe(1)
  })

  it('掌握度：最新状态胜出、证据取并集（历史不丢）', async () => {
    const dir = freshDir()
    const { store } = createJsonlStudentStore(dir)
    await store.setMasteryState(STUDENT, 'kp-cell-membrane', 'exploring', 't1', '2026-09-27T10:01:00.000Z')
    await store.setMasteryState(STUDENT, 'kp-cell-membrane', 'mastered', 't2', '2026-09-27T10:02:00.000Z')
    const records = await store.getMastery(STUDENT)
    expect(records).toHaveLength(1)
    expect(records[0]).toMatchObject({ kpId: 'kp-cell-membrane', state: 'mastered' })
    expect(records[0]?.evidence).toEqual(['t1', 't2'])
  })

  it('"接着上次继续"：能找到最近一次会话与轮数', async () => {
    const dir = freshDir()
    const { store } = createJsonlStudentStore(dir)
    await store.createSession(makeSession('2026-09-27T09-00-00-aaa', '2026-09-27T09:00:00.000Z'))
    await store.createSession(makeSession('2026-09-27T10-00-00-bbb', '2026-09-27T10:00:00.000Z'))
    await store.appendTurn(makeTurn('t1', '2026-09-27T10-00-00-bbb', 'user', 'hi', '2026-09-27T10:00:10.000Z'))

    expect(listSessionIds(dir, STUDENT)).toEqual(['2026-09-27T09-00-00-aaa', '2026-09-27T10-00-00-bbb'])
    const last = latestSession(dir, STUDENT)
    expect(last?.id).toBe('2026-09-27T10-00-00-bbb')
    expect(countTurns(dir, STUDENT, last!.id)).toBe(1)
    expect(sessionFileOf(dir, STUDENT, last!.id)).toContain('sessions')
  })

  it('数据只落在指定目录（不会写到仓库里）', async () => {
    const dir = freshDir()
    const { store, dataDir } = createJsonlStudentStore(dir)
    await store.createSession(makeSession('sess-1'))
    expect(dataDir).toBe(dir)
    expect(readJsonl(join(dir, 'students.jsonl')).records).toEqual([])
  })
})

describe('追加写不重排历史', () => {
  it('同一会话连写三轮：文件行数等于写入次数（追加式）', async () => {
    const dir = freshDir()
    const { store } = createJsonlStudentStore(dir)
    const session = makeSession('sess-2')
    await store.createSession(session)
    for (let i = 0; i < 3; i += 1) {
      await store.appendTurn(makeTurn(`t${i}`, session.id, 'user', `第${i}轮`, `2026-09-27T10:00:0${i}.000Z`))
    }
    const { records } = readJsonl(join(dir, STUDENT, 'sessions', 'sess-2.jsonl'))
    expect(records).toHaveLength(4) // 1 行会话头 + 3 行消息
  })
})
