import type { KnowledgePoint, TextbookUnit } from '../domain'

/**
 * 教学内容读取接口。
 *
 * ⚠️ 实现方式【待定】（Q3 搁置）：YAML + Zod 校验 / JSON / Markdown+frontmatter。
 *    今天只定接口，不写实现。
 *    决策落地后：新增 `yaml-repository.ts` 等实现，并在 src/main 注入。
 *
 * 无论选哪种格式，都必须满足：
 *   - 教师可读可改（非程序员也能维护知识点与说明）；
 *   - 有校验（引用完整性：refs.sectionId 必须存在；prerequisites 不得成环）；
 *   - 教材原文不入库，运行时按 textRef 从本地文件读取。
 */
export interface ContentRepository {
  /** 当前使用的教材单元（研习期内聚焦 1 个单元） */
  getActiveUnit(): Promise<TextbookUnit>
  getUnit(unitId: string): Promise<TextbookUnit | null>

  listKnowledgePoints(unitId: string): Promise<KnowledgePoint[]>
  getKnowledgePoint(kpId: string): Promise<KnowledgePoint | null>

  /** 读取教材原文片段（对应 Section.textRef）；查不到返回 null，由上层提示"未配置教材原文" */
  getSectionText(sectionId: string): Promise<string | null>
}
