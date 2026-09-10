import { contextBridge, ipcRenderer } from 'electron'

/**
 * 预加载脚本：唯一允许跨越进程边界的地方。
 * 规矩：只做「转发 + 类型声明」，不得包含业务逻辑、不得把 ipcRenderer 整体暴露给页面。
 */

const api = {
  ping: (message: string): Promise<{ reply: string; at: string }> =>
    ipcRenderer.invoke('app:ping', { message }) as Promise<{ reply: string; at: string }>
}

contextBridge.exposeInMainWorld('biobuddy', api)

export type BioBuddyApi = typeof api
