import { z } from 'zod'

/**
 * 领域契约 v0 —— 全局唯一的"数据字典"。
 *
 * 规则（docs/ARCHITECTURE.md「领域契约」）：
 *   1. 所有跨层传递的结构都必须先在这里定义 Schema，类型由 z.infer 推导；
 *   2. 修改本文件的字段 = 破坏性变更，必须写决策记录（docs/adr/）并说明影响范围；
 *   3. 尚未定案的形态（如"关卡/闯关"）不写入本文件，放在可选编排层。
 */

/* ── 教材与知识点 ─────────────────────────────────────────── */

export const SectionSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  page: z.number().int().positive().optional(),
  /** 指向本地教材原文文件的定位符（原文不入库，见 .gitignore 的 `/content/` 规则） */
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

/* ── 学习模式：由学生自选，Agent 不猜"这周教到哪" ──────────────
 * 依据 2026-09 决策：不依赖教师排课、不依赖教学进度表。
 * 学生打开后由 Agent 主动询问意图，学生四选一，再进入对应流程。
 * （各模式的具体交互设计待后续细化，此处只固定枚举值。）                */

export const StudyModeSchema = z.enum(['preview', 'review', 'practice', 'extension'])
export type StudyMode = z.infer<typeof StudyModeSchema>

export const STUDY_MODE_LABELS: Record<StudyMode, string> = {
  preview: '预习',
  review: '复习',
  practice: '做题',
  extension: '拓展'
}

/* ── 学习位置：决定装载哪一部分教材 ──────────────────────────
 * 全册教材都入库，运行时按学生的当前位置取对应内容（不做全文注入）。    */

export const StudyPositionSchema = z.object({
  /** 册次，如 '7s'（七年级上）、'8x'（八年级下） */
  volumeId: z.string().min(1),
  /** 章/单元 id */
  unitId: z.string().min(1),
  /** 小节 id，可选（整章学习时留空） */
  sectionId: z.string().min(1).optional()
})
export type StudyPosition = z.infer<typeof StudyPositionSchema>

/* ── 会话与对话 ───────────────────────────────────────────── */

export const SessionSchema = z.object({
  id: z.string().min(1),
  studentId: z.string().regex(/^S\d{2,3}$/),
  studyMode: StudyModeSchema,
  position: StudyPositionSchema,
  startedAt: z.string(),
  endedAt: z.string().optional()
})
export type Session = z.infer<typeof SessionSchema>

export const TurnFlagSchema = z.enum([
  'answer-leak-guard-triggered',
  'likely-homework-cheating',
  'off-topic',
  /** 建议学生去问真人老师（仅提示学生，不作为教师端功能——本项目不做教师端） */
  'suggested-ask-teacher'
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
