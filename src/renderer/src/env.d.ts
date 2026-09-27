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
        /** 本机有没有教材正文（没有时界面提示对照自己手里的课本，见 ADR-0007） */
        hasLocalText: boolean
        /** 印刷页起始页提示，如"第 28 页" */
        pageHint: string | null
        /** 内容来源：content＝内容工程产物；demo＝开发期演示占位 */
        source: 'content' | 'demo'
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
      configDescribe(): Promise<{
        mode: string
        keySource: 'userconfig' | 'env' | 'none'
        hasApiKey: boolean
        hasUserConfig: boolean
        userConfigPath: string
        userConfigError?: string
        baseUrl: string
        model: string
        devUi: boolean
      }>
      configSave(input: { apiKey: string; baseUrl?: string; model?: string }): Promise<{
        ok: boolean
        message: string
        path: string
      }>
      configTest(input: { apiKey?: string; baseUrl?: string; model?: string }): Promise<{
        ok: boolean
        kind: string
        message: string
      }>
    }
  }
}

export {}
