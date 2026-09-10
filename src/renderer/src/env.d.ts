/// <reference types="vite/client" />

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<Record<string, unknown>, Record<string, unknown>, unknown>
  export default component
}

/** preload 通过 contextBridge 暴露的能力（此处为手写类型，保持与 src/preload/index.ts 一致） */
declare global {
  interface Window {
    biobuddy: {
      ping(message: string): Promise<{ reply: string; at: string }>
    }
  }
}

export {}
