import { app } from 'electron'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { z } from 'zod'

/**
 * 运行配置。
 * API Key 只允许出现在主进程（见 docs/ARCHITECTURE.md「安全与 IPC」）：
 *   dev       → 读进程环境变量（.env 由 electron-vite 注入）
 *   packaged  → 读用户目录配置文件 userData/config.json（首次运行向导写入，M5 实现）
 *   mock      → 不联网，使用脚本化响应（开发与断网演示）
 */

export const RunModeSchema = z.enum(['dev', 'packaged', 'mock'])
export type RunMode = z.infer<typeof RunModeSchema>

export interface AppConfig {
  mode: RunMode
  deepseek: {
    apiKey: string
    baseUrl: string
    model: string
  }
}

const UserConfigSchema = z.object({
  deepseekApiKey: z.string().min(1).optional(),
  deepseekBaseUrl: z.string().url().optional(),
  deepseekModel: z.string().optional()
})

function readUserConfig(): z.infer<typeof UserConfigSchema> {
  const file = join(app.getPath('userData'), 'config.json')
  if (!existsSync(file)) return {}
  try {
    return UserConfigSchema.parse(JSON.parse(readFileSync(file, 'utf-8')))
  } catch {
    // 配置损坏不应让应用崩溃：忽略并退回环境变量
    return {}
  }
}

export function loadConfig(): AppConfig {
  const envMode = process.env['BIOBUDDY_MODE']
  const machine = RunModeSchema.safeParse(envMode)
  const mode: RunMode = machine.success ? machine.data : 'dev'

  const user = app.isPackaged ? readUserConfig() : {}

  return {
    mode,
    deepseek: {
      apiKey: user.deepseekApiKey ?? process.env['DEEPSEEK_API_KEY'] ?? '',
      baseUrl:
        user.deepseekBaseUrl ?? process.env['DEEPSEEK_BASE_URL'] ?? 'https://api.deepseek.com',
      model: user.deepseekModel ?? process.env['DEEPSEEK_MODEL'] ?? 'deepseek-chat'
    }
  }
}
