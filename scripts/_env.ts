import { readFileSync, existsSync } from 'node:fs'

/**
 * 极简 .env 读取（开发期脚本用）。
 * 不引入 dotenv 依赖：只支持 `KEY=VALUE` 与 `#` 注释，够用。
 * 已存在的环境变量优先，不被文件覆盖。
 */
export function loadDotEnv(path = '.env'): void {
  if (!existsSync(path)) return

  for (const rawLine of readFileSync(path, 'utf-8').split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) continue

    const eq = line.indexOf('=')
    if (eq <= 0) continue

    const key = line.slice(0, eq).trim()
    const value = line.slice(eq + 1).trim().replace(/^["']|["']$/g, '')
    if (key && process.env[key] === undefined) process.env[key] = value
  }
}

/** 从环境变量读取 DeepSeek 配置 */
export function readDeepSeekEnv(): { apiKey: string; baseUrl: string; model: string } {
  return {
    apiKey: process.env['DEEPSEEK_API_KEY'] ?? '',
    baseUrl: process.env['DEEPSEEK_BASE_URL'] ?? 'https://api.deepseek.com',
    model: process.env['DEEPSEEK_MODEL'] ?? 'deepseek-chat'
  }
}
