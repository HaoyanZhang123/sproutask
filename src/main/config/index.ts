import { app } from 'electron'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { z } from 'zod'

/**
 * 运行配置。
 * API Key 只允许出现在主进程（见 docs/ARCHITECTURE.md「安全与 IPC」）：
 *   dev       → 读进程环境变量（.env 由 electron-vite 注入）
 *   packaged  → 读用户目录配置文件 userData/config.json（首次运行向导写入）
 *   mock      → 不联网，使用脚本化响应（开发与断网演示）
 */

export const RunModeSchema = z.enum(['dev', 'packaged', 'mock'])
export type RunMode = z.infer<typeof RunModeSchema>

export interface AppConfig {
  mode: RunMode
  /**
   * 是否显示"开发用信息"（工具调用、护栏命中、迭代轮次、降级原因）。
   * 默认关闭——学生不该看到 `工具：get_section_text` 这种控制台味儿的东西；
   * 调试时用 `SPROUTASK_DEVUI=1` 打开。
   */
  devUi: boolean
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

/**
 * 开发期读取项目根目录的 .env。
 *
 * 为什么必须自己做：electron-vite 只把带前缀的变量注入 `import.meta.env`，
 * 主进程里 `process.env.DEEPSEEK_API_KEY` 默认是空的——不读这一步，`pnpm dev` 会一直走降级路径。
 * 仅读 `KEY=VALUE` 与 `#` 注释；已存在的环境变量优先，不被文件覆盖。
 */
function loadDotEnvIfPresent(): void {
  const file = join(process.cwd(), '.env')
  if (!existsSync(file)) return

  for (const rawLine of readFileSync(file, 'utf-8').split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) continue
    const eq = line.indexOf('=')
    if (eq <= 0) continue
    const key = line.slice(0, eq).trim()
    const value = line.slice(eq + 1).trim().replace(/^["']|["']$/g, '')
    if (key && process.env[key] === undefined) process.env[key] = value
  }
}

export function loadConfig(): AppConfig {
  loadDotEnvIfPresent()

  const envMode = process.env['SPROUTASK_MODE']
  const machine = RunModeSchema.safeParse(envMode)
  const mode: RunMode = machine.success ? machine.data : 'dev'

  const user = app.isPackaged ? readUserConfig() : {}

  return {
    mode,
    devUi: process.env['SPROUTASK_DEVUI'] === '1',
    deepseek: {
      apiKey: user.deepseekApiKey ?? process.env['DEEPSEEK_API_KEY'] ?? '',
      baseUrl:
        user.deepseekBaseUrl ?? process.env['DEEPSEEK_BASE_URL'] ?? 'https://api.deepseek.com',
      model: user.deepseekModel ?? process.env['DEEPSEEK_MODEL'] ?? 'deepseek-chat'
    }
  }
}
