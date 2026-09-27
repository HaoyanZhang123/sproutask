import { appendFileSync, existsSync, mkdirSync, readdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import type { MasteryRecord, MasteryState, Session, Student, Turn } from '../../core/domain'
import type { StudentStore } from '../../core/storage'

/**
 * `StudentStore` 的 JSONL 实现（选型理由见 docs/adr/ADR-0003 决策二：零依赖、可核对、可逆）。
 *
 * 目录布局（**只在本机**，`<userData>/data`）：
 * ```
 * data/students.jsonl                     学生登记（追加）
 * data/<studentId>/sessions/<sessionId>.jsonl   第一行是会话头，之后每行一条消息
 * data/<studentId>/mastery.jsonl          掌握度变更日志（追加，最新一条胜出）
 * ```
 *
 * 设计要点（对应 ADR-0003 里"实现时要定的两条"）：
 *   1. **按会话分文件**：一条会话一个文件，便于单会话导出与匿名化引用；会话时间在文件名与头里
 *   2. **只追加、不重排**：一轮一行完整 JSON；崩溃最多丢最后一行（读取时跳过读不出来的行并计数）
 *   3. 掌握度是"变更日志"：同一知识点的最新一条决定当前状态，历史一条不删（看的是演进过程）
 *
 * 合规：只存学生编号（`S01`）、对话与标记；不写姓名等个人信息（接口注释里的约束）。
 */

export interface JsonlStore {
  store: StudentStore
  /** 数据根目录（写进 boot.log，便于老师/研究者找到数据） */
  dataDir: string
}

const STUDENTS_FILE = 'students.jsonl'

type StudentLine = ({ type: 'student' } & Student)
type SessionHeadLine = { type: 'session'; session: Session }
type SessionEndLine = { type: 'session-end'; endedAt: string }
type TurnLine = ({ type: 'turn' } & Turn)
type MasteryLine = ({ type: 'mastery' } & MasteryRecord)
type AnyLine = StudentLine | SessionHeadLine | SessionEndLine | TurnLine | MasteryLine

/** 读取一个 JSONL 文件；跳过空行与**读不出来的行**（崩溃可能留下半行），并返回坏行数 */
export function readJsonl<T>(file: string): { records: T[]; brokenLines: number } {
  if (!existsSync(file)) return { records: [], brokenLines: 0 }
  const records: T[] = []
  let brokenLines = 0
  for (const line of readFileSync(file, 'utf-8').split(/\r?\n/)) {
    const text = line.trim()
    if (!text) continue
    try {
      records.push(JSON.parse(text) as T)
    } catch {
      brokenLines += 1
    }
  }
  return { records, brokenLines }
}

function appendLine(file: string, record: unknown): void {
  mkdirSync(dirname(file), { recursive: true })
  appendFileSync(file, `${JSON.stringify(record)}\n`, 'utf-8')
}

export function sessionsDirOf(dataDir: string, studentId: string): string {
  return join(dataDir, studentId, 'sessions')
}

export function sessionFileOf(dataDir: string, studentId: string, sessionId: string): string {
  return join(sessionsDirOf(dataDir, studentId), `${sessionId}.jsonl`)
}

function masteryFileOf(dataDir: string, studentId: string): string {
  return join(dataDir, studentId, 'mastery.jsonl')
}

/** 列出某学生的会话 id（文件名的 ^([^/]+)\.jsonl$）；用于"接着上次继续" */
export function listSessionIds(dataDir: string, studentId: string): string[] {
  const dir = sessionsDirOf(dataDir, studentId)
  if (!existsSync(dir)) return []
  return readdirSync(dir)
    .filter((name) => name.endsWith('.jsonl'))
    .map((name) => name.slice(0, -'.jsonl'.length))
    .sort()
}

function buildSession(file: string): Session | null {
  const { records } = readJsonl<AnyLine>(file)
  const head = records.find((r): r is SessionHeadLine => r.type === 'session')
  if (!head) return null
  const ends = records.filter((r): r is SessionEndLine => r.type === 'session-end')
  const lastEnd = ends[ends.length - 1]
  return lastEnd ? { ...head.session, endedAt: lastEnd.endedAt } : head.session
}

/** 最近一次会话（用于启动时"接着上次的位置"与"上次聊过多少轮"） */
export function latestSession(dataDir: string, studentId: string): Session | null {
  const ids = listSessionIds(dataDir, studentId)
  for (let i = ids.length - 1; i >= 0; i -= 1) {
    const id = ids[i]
    if (!id) continue
    const session = buildSession(sessionFileOf(dataDir, studentId, id))
    if (session) return session
  }
  return null
}

/** 某次会话里的消息条数（含用户与助手；用于"上次聊过 N 轮"） */
export function countTurns(dataDir: string, studentId: string, sessionId: string): number {
  const { records } = readJsonl<AnyLine>(sessionFileOf(dataDir, studentId, sessionId))
  return records.filter((r) => r.type === 'turn').length
}

export function createJsonlStudentStore(dataDir: string): JsonlStore {
  const store: StudentStore = {
    async upsertStudent(student: Student): Promise<void> {
      appendLine(join(dataDir, STUDENTS_FILE), { type: 'student', ...student } satisfies StudentLine)
    },

    async getStudent(studentId: string): Promise<Student | null> {
      const { records } = readJsonl<StudentLine>(join(dataDir, STUDENTS_FILE))
      const mine = records.filter((r) => r.type === 'student' && r.id === studentId)
      const last = mine[mine.length - 1]
      return last ? { id: last.id, createdAt: last.createdAt, ...(last.displayName ? { displayName: last.displayName } : {}) } : null
    },

    async createSession(session: Session): Promise<void> {
      appendLine(sessionFileOf(dataDir, session.studentId, session.id), {
        type: 'session',
        session
      } satisfies SessionHeadLine)
    },

    async endSession(sessionId: string, endedAt: string): Promise<void> {
      const found = findSessionFile(dataDir, sessionId)
      if (!found) return
      appendLine(found.file, { type: 'session-end', endedAt } satisfies SessionEndLine)
    },

    async getSession(sessionId: string): Promise<Session | null> {
      const found = findSessionFile(dataDir, sessionId)
      return found ? buildSession(found.file) : null
    },

    async appendTurn(turn: Turn): Promise<void> {
      const found = findSessionFile(dataDir, turn.sessionId)
      // 会话文件找不到时（例如数据目录被清过）不抛错：宁可丢这一轮，也不让对话崩掉
      if (!found) return
      appendLine(found.file, { type: 'turn', ...turn } satisfies TurnLine)
    },

    async listTurns(sessionId: string): Promise<Turn[]> {
      const found = findSessionFile(dataDir, sessionId)
      if (!found) return []
      const { records } = readJsonl<AnyLine>(found.file)
      return records
        .filter((r): r is TurnLine => r.type === 'turn')
        .map(({ type: _type, ...turn }) => turn as Turn)
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    },

    async upsertMastery(record: MasteryRecord): Promise<void> {
      appendLine(masteryFileOf(dataDir, record.studentId), { type: 'mastery', ...record } satisfies MasteryLine)
    },

    async getMastery(studentId: string): Promise<MasteryRecord[]> {
      const { records } = readJsonl<MasteryLine>(masteryFileOf(dataDir, studentId))
      const byKp = new Map<string, MasteryRecord>()
      for (const { type: _type, ...record } of records) {
        if (record.studentId !== studentId) continue
        const prev = byKp.get(record.kpId)
        byKp.set(record.kpId, {
          ...record,
          // 状态取最新一条；证据取并集（历史不丢，能看到演进过程）
          evidence: [...new Set([...(prev?.evidence ?? []), ...record.evidence])]
        })
      }
      return [...byKp.values()]
    },

    async setMasteryState(
      studentId: string,
      kpId: string,
      state: MasteryState,
      evidenceTurnId: string,
      updatedAt: string
    ): Promise<void> {
      await store.upsertMastery({ studentId, kpId, state, evidence: [evidenceTurnId], updatedAt })
    },

    /**
     * 无需关闭句柄（每次写都是"打开→追加→关闭"）。
     * 保留这个方法是为了满足接口：将来换成 SQLite 就必须在这里关连接，上层不必改。
     */
    async close(): Promise<void> {}
  }

  return { store, dataDir }
}

/** 在所有学生的子目录里找会话文件（接口只给 sessionId，没给 studentId） */
function findSessionFile(dataDir: string, sessionId: string): { file: string; studentId: string } | null {
  if (!existsSync(dataDir)) return null
  for (const entry of readdirSync(dataDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue
    const file = sessionFileOf(dataDir, entry.name, sessionId)
    if (existsSync(file)) return { file, studentId: entry.name }
  }
  return null
}
