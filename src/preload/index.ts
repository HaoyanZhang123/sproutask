import { contextBridge, ipcRenderer } from 'electron'

/**
 * 预加载脚本：唯一允许跨越进程边界的地方。
 * 规矩：只做「转发 + 类型声明」，不得包含业务逻辑、不得把 ipcRenderer 整体暴露给页面。
 * 对应的类型声明在 `src/renderer/src/env.d.ts`（两侧需保持一致）。
 */

const api = {
  ping: (message: string): Promise<{ reply: string; at: string }> =>
    ipcRenderer.invoke('app:ping', { message }) as Promise<{ reply: string; at: string }>,

  /** 开场：Agent 主动询问想做什么，返回问句与四个选项 */
  sessionStart: (): Promise<{
    question: string
    options: Array<{ mode: string; label: string; hint: string }>
  }> => ipcRenderer.invoke('session:start') as never,

  /** 学生选定模式（可传"复习"或"2"） */
  sessionChooseMode: (input: string): Promise<
    | { ok: true; mode: string; modeLabel: string; positionLabel: string }
    | { ok: false; message: string }
  > => ipcRenderer.invoke('session:chooseMode', { input }) as never,

  /** 一轮对话：走完整 Agent 循环（工具调用 + 答案泄漏护栏 + 降级） */
  chat: (message: string): Promise<{
    needsMode: boolean
    message?: string
    reply?: string
    toolCalls?: Array<{ name: string; ok: boolean }>
    flags?: string[]
    iterations?: number
    guard?: { checked: boolean; triggered: boolean; regenerated: boolean; reasons: string[] }
    degraded?: { kind: string; studentMessage: string }
  }> => ipcRenderer.invoke('agent:chat', { message }) as never,

  sessionState: (): Promise<{
    mode: string | null
    modeLabel: string | null
    positionLabel: string
    historyLength: number
  }> => ipcRenderer.invoke('session:state') as never,

  /** 教材阅读视图的数据源（未选模式时为 null） */
  sectionContent: (): Promise<{
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
  } | null> => ipcRenderer.invoke('content:section') as never,

  /** 是否已配置 Key（只回布尔）+ 是否显示开发用信息（`SPROUTASK_DEVUI=1`） */
  configStatus: (): Promise<{ mode: string; hasApiKey: boolean; devUi: boolean }> =>
    ipcRenderer.invoke('config:status') as never,

  /**
   * 配置概览（首次运行配置界面用）。
   * ⚠️ 不含 Key 的任何片段——连"sk-…abcd"这种掩码都不给。
   */
  configDescribe: (): Promise<{
    mode: string
    keySource: 'userconfig' | 'env' | 'none'
    hasApiKey: boolean
    hasUserConfig: boolean
    userConfigPath: string
    userConfigError?: string
    baseUrl: string
    model: string
    devUi: boolean
  }> => ipcRenderer.invoke('config:describe') as never,

  /** 保存配置到本机用户目录（不依赖 .env，打包版靠它） */
  configSave: (input: { apiKey: string; baseUrl?: string; model?: string }): Promise<{
    ok: boolean
    message: string
    path: string
  }> => ipcRenderer.invoke('config:save', input) as never,

  /** 连通性测试：真实发一次最小请求，成功/失败都给面向大人的中文说明 */
  configTest: (input: { apiKey?: string; baseUrl?: string; model?: string }): Promise<{
    ok: boolean
    kind: string
    message: string
  }> => ipcRenderer.invoke('config:test', input) as never
}

contextBridge.exposeInMainWorld('sproutask', api)

export type SproutAskApi = typeof api
