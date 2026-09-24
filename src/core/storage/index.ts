import type { MasteryRecord, MasteryState, Session, Student, Turn } from '../domain'

/**
 * 学情与日志的存储接口。
 *
 * ⚠️ 实现方式【待定】：SQLite（better-sqlite3）或 JSONL 文件。
 *    今天只定接口，不写实现——两个选择都不会影响上层代码。
 *    决策落地后：新增 `sqlite-store.ts` 或 `jsonl-store.ts` 实现本接口，
 *    并在 src/main 里按配置注入。禁止在上层直接依赖具体实现。
 *
 * 所有实现必须遵守的合规约束（docs/ARCHITECTURE.md「领域契约」）：
 *   - 只存学生编号，不存真实姓名；
 *   - 日志中不得出现教材与对话之外的个人信息；
 *   - 导出学习数据时必须经过匿名化处理。
 */
export interface StudentStore {
  /** 首次使用时登记学生（编号由教师分配） */
  upsertStudent(student: Student): Promise<void>
  getStudent(studentId: string): Promise<Student | null>

  createSession(session: Session): Promise<void>
  endSession(sessionId: string, endedAt: string): Promise<void>
  getSession(sessionId: string): Promise<Session | null>

  appendTurn(turn: Turn): Promise<void>
  listTurns(sessionId: string): Promise<Turn[]>

  upsertMastery(record: MasteryRecord): Promise<void>
  getMastery(studentId: string): Promise<MasteryRecord[]>
  setMasteryState(
    studentId: string,
    kpId: string,
    state: MasteryState,
    evidenceTurnId: string,
    updatedAt: string
  ): Promise<void>

  close(): Promise<void>
}
