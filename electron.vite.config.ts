import { resolve } from 'node:path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import vue from '@vitejs/plugin-vue'

/**
 * 三进程统一构建：
 *   main      → Electron 主进程（Agent 运行时的宿主，可用 node:*）
 *   preload   → 仅做 contextBridge 暴露，不含业务逻辑
 *   renderer  → Vue3 界面（无 Node 权限）
 *
 * 分层依赖铁律见 docs/ARCHITECTURE.md「分层依赖铁律」：
 *   renderer → main → core，且 core / main 不得依赖 electron 之外的宿主能力；
 *   `src/shared/` 放**无任何依赖的纯代码**，三层都可以引用（由 tests/smoke.test.ts 把关）。
 */
export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    resolve: {
      alias: {
        '@core': resolve('src/core'),
        '@main': resolve('src/main'),
        '@shared': resolve('src/shared')
      }
    },
    build: {
      rollupOptions: {
        input: { index: resolve('src/main/index.ts') }
      }
    }
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: {
      rollupOptions: {
        input: { index: resolve('src/preload/index.ts') }
      }
    }
  },
  renderer: {
    root: resolve('src/renderer'),
    resolve: {
      alias: {
        '@renderer': resolve('src/renderer/src'),
        '@shared': resolve('src/shared')
      }
    },
    plugins: [vue()],
    build: {
      rollupOptions: {
        input: { index: resolve('src/renderer/index.html') }
      }
    }
  }
})
