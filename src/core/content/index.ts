import type { KnowledgePoint, StudyMode, StudyPosition, TextbookUnit } from '../domain'

/**
 * 教材知识库读取接口（全册教材 + 课程标准）。
 *
 * 设计依据（2026-09 决策）：
 *   1. **全册教材都入库**（不只一个单元），运行时按"学生学到哪里"装载对应内容；
 *   2. **课程标准等教学文件一并入库**，作为约束层随上下文注入，防止模型自行发挥；
 *   3. 装载方式以"结构化按需装载"为主（册 → 章 → 节），**不是**把全书塞进上下文；
 *      向量检索（RAG）仅在需要跨章节检索时作为可选增强，见 docs/adr/ADR-0004-教材装载方式.md。
 *
 * ⚠️ 实现方式【待定】：YAML+Zod / JSON / Markdown+frontmatter。
 *    今天只定接口不写实现；决策落地后新增实现文件并在 src/main 注入。
 *
 * 无论选哪种格式，都必须满足：
 *   - 教师可读可改；
 *   - 有校验（refs.sectionId 必须存在、prerequisites 不得成环、课标引用可追溯）；
 *   - 教材原文不入 git（版权），运行时从本地文件读取。
 */

/** 课程标准条目（如《义务教育生物学课程标准（2022年版）》的学习要求） */
export interface CurriculumRequirement {
  id: string
  /** 来源文件标题，如「义务教育生物学课程标准（2022年版）」 */
  source: string
  /** 关联到单元/知识点，用于精确注入（留空表示全册通用要求） */
  unitId?: string
  kpId?: string
  /** 要求原文 */
  text: string
}

/** 一次学习要注入模型的完整上下文素材 */
export interface StudyScope {
  position: StudyPosition
  mode: StudyMode
  unit: TextbookUnit
  /** 需要注入的教材原文（按小节顺序） */
  sectionTexts: Array<{ sectionId: string; title: string; text: string }>
  knowledgePoints: KnowledgePoint[]
  /** 相关课标要求原文（约束层：模型不得越出这些要求自行发挥） */
  curriculumRequirements: string[]
}

export interface TextbookLibrary {
  /* ── 书架：全册教材 ─────────────────────────────── */
  listVolumes(): Promise<Array<{ id: string; title: string; grade: string }>>
  listUnits(volumeId: string): Promise<TextbookUnit[]>
  getUnit(unitId: string): Promise<TextbookUnit | null>

  /* ── 知识点 ────────────────────────────────────── */
  listKnowledgePoints(unitId: string): Promise<KnowledgePoint[]>
  getKnowledgePoint(kpId: string): Promise<KnowledgePoint | null>

  /* ── 教材原文（不入 git，从本地文件读） ───────────── */
  getSectionText(sectionId: string): Promise<string | null>

  /* ── 课程标准与教学文件 ─────────────────────────── */
  getCurriculumRequirements(unitId: string): Promise<CurriculumRequirement[]>

  /* ── 运行期核心入口 ─────────────────────────────── */
  /** 按"学习位置 + 模式"装配要注入模型的上下文（Agent 每轮开头调用） */
  buildStudyScope(position: StudyPosition, mode: StudyMode): Promise<StudyScope>
}
