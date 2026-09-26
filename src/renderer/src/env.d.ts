/// <reference types="vite/client" />

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<Record<string, unknown>, Record<string, unknown>, unknown>
  export default component
}

/**
 * preload 通过 contextBridge 暴露的能力。
 * ⚠️ 与 `src/preload/index.ts` 必须保持一致（后续可考虑自动生成类型以消除手工同步）。
 */
declare global {
  interface Window {
    sproutask: {
      ping(message: string): Promise<{ reply: string; at: string }>
      sessionStart(): Promise<{
        question: string
        options: Array<{ mode: string; label: string; hint: string }>
      }>
      sessionChooseMode(input: string): Promise<
        | { ok: true; mode: string; modeLabel: string; positionLabel: string }
        | { ok: false; message: string }
      >
      chat(message: string): Promise<{
        needsMode: boolean
        message?: string
        reply?: string
        toolCalls?: Array<{ name: string; ok: boolean }>
        flags?: string[]
        iterations?: number
        guard?: { checked: boolean; triggered: boolean; regenerated: boolean; reasons: string[] }
        degraded?: { kind: string; studentMessage: string }
      }>
      sessionState(): Promise<{
        mode: string | null
        modeLabel: string | null
        positionLabel: string
        historyLength: number
      }>
      sectionContent(): Promise<{
        unitTitle: string
        edition: string
        grade: string
        sectionTitle: string
        mode: string
        blocks: Array<{
          type: 'text' | 'think' | 'answer'
          title?: string
          body: string
          index: number
        }>
        knowledgePoints: Array<{
          id: string
          title: string
          summary: string
          refs: string[]
          misconceptions: string[]
        }>
        curriculumRequirements: string[]
      } | null>
      configStatus(): Promise<{ mode: string; hasApiKey: boolean; devUi: boolean }>
    }
  }
}

export {}
