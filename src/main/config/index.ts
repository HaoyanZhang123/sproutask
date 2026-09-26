import { app } from 'electron'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { z } from 'zod'

/**
 * 运行配置。
 * API Key 只允许出现在主进程（见 docs/ARCHITECTURE.md「安全与 IPC」）：
 *   dev       → 读进程环境变量（.env 由 electron-vite 注入；
 *               打包版则由「首次运行配置」写入 userData/config.json）
 *   packaged  → 优先读 userData/config.json，其次环境变量
 *   mock      → 不联网，使用脚本化响应（开发与断网演示）
 *
 * ⚠️ 红线：Key 永不返回渲染进程。界面只能拿到"有没有配"和"来自哪里"，
 * 连"sk-…abc"这种掩码预览都不给（掩码也是密钥信息）。
 */

export const RunModeSchema = z.enum(['dev', 'packaged', 'mock'])
export type RunMode = z.infer<typeof RunModeSchema>

/** 用户配置文件（写在系统用户目录，不进仓库、不进安装包） */
export const UserConfigSchema = z.object({
  deepseekApiKey: z.string().trim().min(10).max(200).optional(),
  deepseekBaseUrl: z.string().url().max(200).optional(),
  deepseekModel: z.string().trim().max(100).optional()
})
export type UserConfigFile = z.infer<typeof UserConfigSchema>

/** Key 的来源，供界面显示"当前用的是哪一份"（不透露内容） */
export type KeySource = 'userconfig' | 'env' | 'none'

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

/** 用户配置文件路径（打包后由"首次运行配置"写入；开发期只读不写） */
export function userConfigPath(): string {
  return join(app.getPath('userData'), 'config.json')
}

/**
 * 读取用户配置文件。**任何异常都不得让应用崩溃**：
 * 文件不存在或内容损坏时返回空对象（并保留 `error` 供界面提示）。
 */
export function readUserConfigWithStatus(): {
  config: UserConfigFile
  exists: boolean
  error?: string
} {
  const file = userConfigPath()
  if (!existsSync(file)) return { config: {}, exists: false }

  try {
    const parsed = UserConfigSchema.parse(JSON.parse(readFileSync(file, 'utf-8')))
    return { config: parsed, exists: true }
  } catch (error) {
    return {
      config: {},
      exists: true,
      error: `配置文件读不出来（${error instanceof Error ? error.message : String(error)}），已忽略`
    }
  }
}

export function readUserConfig(): UserConfigFile {
  return readUserConfigWithStatus().config
}

/**
 * 保存（合并写入）用户配置。仅写入明确给出的字段，不动其它字段。
 * 返回可读中文结果，供界面直接显示。
 */
export function saveUserConfig(patch: UserConfigFile): { ok: boolean; message: string; path: string } {
  const file = userConfigPath()
  const parsed = UserConfigSchema.safeParse(patch)
  if (!parsed.success) {
    return { ok: false, message: `配置内容不合法：${parsed.error.issues[0]?.message ?? '未知原因'}`, path: file }
  }

  const merged: UserConfigFile = { ...readUserConfig(), ...parsed.data }
  // 只保留有值的字段，避免写出 null
  const clean: UserConfigFile = {}
  if (merged.deepseekApiKey) clean.deepseekApiKey = merged.deepseekApiKey
  if (merged.deepseekBaseUrl) clean.deepseekBaseUrl = merged.deepseekBaseUrl
  if (merged.deepseekModel) clean.deepseekModel = merged.deepseekModel

  try {
    mkdirSync(dirname(file), { recursive: true })
    writeFileSync(file, `${JSON.stringify(clean, null, 2)}\n`, 'utf-8')
    return { ok: true, message: '已保存到本机（只在这台电脑上）', path: file }
  } catch (error) {
    return {
      ok: false,
      message: `保存失败：${error instanceof Error ? error.message : String(error)}`,
      path: file
    }
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
  // 打包后不读 .env：那时 cwd 是"用户从哪儿启动的"（可能是任意目录），
  // 一个来路不明的 .env 就能顶替用户自己的配置——既意外也不安全。
  // 打包版的唯一配置来源是 userData/config.json（由"首次运行配置"写入）。
  if (app.isPackaged) return

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

/** 生效配置 + 来源信息（供界面显示"当前用的是哪一份"，不含密钥内容） */
export function describeConfig(): {
  mode: RunMode
  keySource: KeySource
  hasApiKey: boolean
  hasUserConfig: boolean
  userConfigPath: string
  userConfigError?: string
  baseUrl: string
  model: string
  devUi: boolean
} {
  loadDotEnvIfPresent()

  const envMode = process.env['SPROUTASK_MODE']
  const machine = RunModeSchema.safeParse(envMode)
  const mode: RunMode = machine.success ? machine.data : 'dev'

  const user = readUserConfigWithStatus()
  const envKey = process.env['DEEPSEEK_API_KEY'] ?? ''
  // 打包版：用户配置优先；开发版：以 .env 为准（见文件头说明）
  const useUserKey = app.isPackaged || mode === 'packaged'
  const apiKey = (useUserKey ? user.config.deepseekApiKey : undefined) ?? envKey
  const keySource: KeySource = apiKey
    ? (useUserKey && user.config.deepseekApiKey ? 'userconfig' : 'env')
    : 'none'

  return {
    mode,
    keySource,
    hasApiKey: apiKey.length > 0,
    hasUserConfig: user.exists,
    userConfigPath: userConfigPath(),
    userConfigError: user.error,
    baseUrl:
      user.config.deepseekBaseUrl ?? process.env['DEEPSEEK_BASE_URL'] ?? 'https://api.deepseek.com',
    model: user.config.deepseekModel ?? process.env['DEEPSEEK_MODEL'] ?? 'deepseek-chat',
    devUi: process.env['SPROUTASK_DEVUI'] === '1'
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
