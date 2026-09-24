/**
 * core 层出口。
 * core 是纯领域逻辑：不得 import electron / vue / 任何宿主能力（由 tests/smoke.test.ts 自动把关）。
 */

export * as domain from './domain'
export * from './llm'
export type { StudentStore } from './storage'
export type { TextbookLibrary, StudyScope, CurriculumRequirement } from './content'
