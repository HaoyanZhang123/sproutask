import { z } from 'zod'

/**
 * 领域契约 v0 —— 全局唯一的"数据字典"。
 *
 * 规则（docs/ARCHITECTURE.md §6）：
 *   1. 所有跨层传递的结构都必须先在这里定义 Schema，类型由 z.infer 推导；
 *   2. 修改本文件的字段 = 破坏性变更，必须写 ADR 并在 docs/specs 里说明影响；
 *   3. 尚未定案的形态（如"关卡/闯关"）不写入本文件，放在可选编排层。
 */

/* ── 教材与知识点 ─────────────────────────────────────────── */

export const SectionSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  page: z.number().int().positive().optional(),
  /** 指向本地教材原文文件的定位符（原文不入库，见 .gitignore） */
  textRef: z.string().optional()
})
export type Section = z.infer<typeof SectionSchema>

export const TextbookUnitSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/, '单元 id 只允许小写字母、数字与连字符'),
  title: z.string().min(1),
  grade: z.string().min(1),
  edition: z.string().min(1),
  sections: z.array(SectionSchema).min(1)
})
export type TextbookUnit = z.infer<typeof TextbookUnitSchema>

export const SectionRefSchema = z.object({
  sectionId: z.string().min(1),
  page: z.number().int().positive().optional()
})
export type SectionRef = z.infer<typeof SectionRefSchema>

export const KnowledgePointSchema = z.object({
  id: z.string().regex(/^kp-[a-z0-9-]+$/),
  unitId: z.string().min(1),
  title: z.string().min(1),
  /** 一句话概括该知识点，用于注入学情摘要 */
  summary: z.string().min(1),
  refs: z.array(SectionRefSchema).min(1),
  /** 前置知识点 id；须无环（由内容校验脚本保证） */
  prerequisites: z.array(z.string()).default([]),
  /** 常见误区，用于针对性提问 */
  misconceptions: z.array(z.string()).default([]),
  difficulty: z.number().int().min(1).max(5)
})
export type KnowledgePoint = z.infer<typeof KnowledgePointSchema>

/* ── 学情 ─────────────────────────────────────────────────── */

export const MasteryStateSchema = z.enum(['unlearned', 'exploring', 'mastered'])
export type MasteryState = z.infer<typeof MasteryStateSchema>

export const MasteryRecordSchema = z.object({
  /** 学生编号，如 S07 —— 绝不存真实姓名 */
  studentId: z.string().regex(/^S\d{2,3}$/),
  kpId: z.string().min(1),
  state: MasteryStateSchema,
  /** 判定依据：对话轮次 id 列表 */
  evidence: z.array(z.string()).default([]),
  updatedAt: z.string()
})
export type MasteryRecord = z.infer<typeof MasteryRecordSchema>

export const StudentSchema = z.object({
  id: z.string().regex(/^S\d{2,3}$/),
  displayName: z.string().optional(),
  createdAt: z.string()
})
export type Student = z.infer<typeof StudentSchema>

/* ── 会话与对话 ───────────────────────────────────────────── */

export const SessionModeSchema = z.enum(['free-ask', 'guided'])
export type SessionMode = z.infer<typeof SessionModeSchema>

export const SessionSchema = z.object({
  id: z.string().min(1),
  studentId: z.string().regex(/^S\d{2,3}$/),
  mode: SessionModeSchema,
  /** 引导式会话所关联的目标知识点（具体编排方式待定，见 ADR-0002） */
  targetKpIds: z.array(z.string()).default([]),
  startedAt: z.string(),
  endedAt: z.string().optional()
})
export type Session = z.infer<typeof SessionSchema>

export const TurnFlagSchema = z.enum([
  'answer-leak-guard-triggered',
  'likely-homework-cheating',
  'off-topic',
  'flagged-for-teacher'
])
export type TurnFlag = z.infer<typeof TurnFlagSchema>

export const TurnSchema = z.object({
  id: z.string().min(1),
  sessionId: z.string().min(1),
  role: z.enum(['user', 'assistant', 'tool']),
  content: z.string(),
  toolName: z.string().optional(),
  toolPayload: z.unknown().optional(),
  flags: z.array(TurnFlagSchema).default([]),
  createdAt: z.string()
})
export type Turn = z.infer<typeof TurnSchema>

/* ── 教学进度（让 Agent "知道这周教到哪"） ────────────────── */

export const TeachingPlanSchema = z.object({
  unitId: z.string().min(1),
  weekStart: z.string(),
  weekEnd: z.string(),
  /** 本周涉及的章节 id */
  sectionScope: z.array(z.string()).min(1),
  teacherNotes: z.string().default('')
})
export type TeachingPlan = z.infer<typeof TeachingPlanSchema>
