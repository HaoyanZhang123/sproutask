/**
 * core 层出口。
 * core 是纯领域逻辑：不得 import electron / vue / 任何宿主能力（由 tests/smoke.test.ts 自动把关）。
 */

export * as domain from './domain'
export * from './llm'
export { DeepSeekClient } from './llm/deepseek'
export * as prompts from './prompts'
export * as intent from './agent/intent'
export * as agentLoop from './agent/loop'
export * as guard from './agent/guard'
export * as tools from './agent/tools'
export { ToolRegistry, createDefaultTools, zodObjectToJsonSchema } from './agent/tools'
export type { AgentTool, ToolContext, ToolExecutionResult } from './agent/tools/types'
export { ChatSession } from './agent/session'
export type { ChatOutcome, ChooseModeResult, SessionStartInfo } from './agent/session'
export * as evalRunner from './eval/runner'
export { createDemoScope } from './content/demo'
export {
  ANSWER_TITLE,
  THINK_TITLE,
  countMatches,
  extractCitation,
  matchesOnlyInCollapsed,
  parseSectionBlocks,
  splitHighlights
} from '../shared/section-blocks'
export { plainTextOf } from './prompts/v2/l2-textbook'
export type { HighlightSegment, SectionBlock, SectionBlockType } from '../shared/section-blocks'
export type { StudentStore } from './storage'
export type { TextbookLibrary, StudyScope, CurriculumRequirement } from './content'
