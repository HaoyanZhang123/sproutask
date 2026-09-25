import { ipcMain } from 'electron'
import { z } from 'zod'
import {
  ChatSession,
  DeepSeekClient,
  ToolRegistry,
  createDefaultTools,
  createDemoScope
} from '../../core'
import { parseSectionBlocks } from '../../shared/section-blocks'
import type { StudyScope } from '../../core'
import { loadConfig } from '../config'

/**
 * IPC 处理器注册表。
 *
 * 规矩（docs/CONVENTIONS.md「IPC 与安全」）：
 *   - 通道名 `<域>:<动作>`，如 `agent:chat`
 *   - 入参一律用 Zod 校验，禁止直接把 unknown 传进业务层
 *   - 这里只做"校验 + 转发"，业务逻辑在 src/core（会话状态机也在 core，可离线测试）
 *   - API Key 只在本层读取，**永不返回给渲染进程**
 */

const ChooseModeInput = z.object({ input: z.string().max(200) })
const ChatInput = z.object({ message: z.string().min(1).max(2000) })
const PingInput = z.object({ message: z.string().max(200) })

/** 会话单例（当前只有一次会话；多会话与持久化待后续迭代） */
let session: ChatSession | null = null

function createSession(): ChatSession {
  const config = loadConfig()
  const client = new DeepSeekClient({
    apiKey: config.deepseek.apiKey,
    baseUrl: config.deepseek.baseUrl,
    model: config.deepseek.model
  })

  // 内容库（TextbookLibrary）尚未实现，先用演示内容占位
  const demo = createDemoScope()
  const getSectionText = async (sectionId: string): Promise<string | null> =>
    demo.sectionTexts.find((section) => section.sectionId === sectionId)?.text ?? null

  return new ChatSession({
    client,
    registry: new ToolRegistry(createDefaultTools()),
    scopeFactory: (mode) => createDemoScope(mode) as StudyScope,
    getSectionText,
    studentId: 'S00', // 编号由教师分配；接入本地记录后改为读取已分配的编号
    positions: demo.unit.sections.map((section) => ({
      position: { volumeId: '7s', unitId: demo.unit.id, sectionId: section.id },
      label: section.title
    }))
  })
}

function getSession(): ChatSession {
  session ??= createSession()
  return session
}

export function registerIpcHandlers(): void {
  ipcMain.handle('app:ping', (_event, payload: unknown) => {
    const input = PingInput.parse(payload)
    return { reply: `pong: ${input.message}`, at: new Date().toISOString() }
  })

  /** 开场：Agent 主动询问想做什么，返回四个选项 */
  ipcMain.handle('session:start', () => {
    getSession().reset()
    return getSession().start()
  })

  ipcMain.handle('session:chooseMode', (_event, payload: unknown) => {
    const input = ChooseModeInput.parse(payload)
    return getSession().chooseMode(input.input)
  })

  /** 一轮对话：走完整 Agent 循环（工具调用 + 答案泄漏护栏 + 降级） */
  ipcMain.handle('agent:chat', async (_event, payload: unknown) => {
    const input = ChatInput.parse(payload)
    return await getSession().chat(input.message)
  })

  ipcMain.handle('session:state', () => getSession().getState())

  /**
   * 教材阅读视图的数据源：当前小节的原文（解析后的区块）、知识点与课标要求。
   *
   * 解析放在主进程（core 的纯函数）：渲染进程不接触原始标记文本，只渲染结构化区块，
   * 因此**不需要 v-html**，也就没有 XSS 面（教材内容可能是他人编写的文件）。
   */
  ipcMain.handle('content:section', () => {
    const scope = getSession().currentScope()
    if (!scope) return null

    const section = scope.sectionTexts[0]
    if (!section) return null

    return {
      unitTitle: scope.unit.title,
      edition: scope.unit.edition,
      grade: scope.unit.grade,
      sectionTitle: section.title,
      mode: scope.mode,
      blocks: parseSectionBlocks(section.text),
      knowledgePoints: scope.knowledgePoints.map((kp) => ({
        id: kp.id,
        title: kp.title,
        summary: kp.summary,
        refs: kp.refs.map((r) => (r.page ? `${section.title}（第 ${r.page} 页）` : section.title)),
        misconceptions: kp.misconceptions
      })),
      curriculumRequirements: scope.curriculumRequirements
    }
  })

  /** 是否已配置 Key（**只回布尔，不回 Key 本身**） */
  ipcMain.handle('config:status', () => {
    const config = loadConfig()
    return { mode: config.mode, hasApiKey: config.deepseek.apiKey.length > 0 }
  })
}

/** 开发期自检用：把会话能力暴露给主进程自检脚本（不经过 IPC） */
export function createSelfTestSession(): ChatSession {
  return createSession()
}
