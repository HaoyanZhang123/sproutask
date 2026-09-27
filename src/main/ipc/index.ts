import { ipcMain } from 'electron'
import { z } from 'zod'
import {
  ChatSession,
  DeepSeekClient,
  LLMError,
  ToolRegistry,
  createDefaultTools
} from '../../core'
import type { Turn, TurnFlag } from '../../core/domain'
import type { StudentStore } from '../../core/storage'
import { parseSectionBlocks } from '../../shared/section-blocks'
import { describeConfig, loadConfig, readUserConfig, saveUserConfig } from '../config'
import { resolveConnectivityTarget } from '../config/connectivity'
import type { ContentRuntime } from '../content/runtime'
import { latestSession } from '../storage/jsonl-store'
import { touchedKnowledgePoints } from '../storage/mastery-touch'

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

/** 首次运行配置：入参一律校验（Key 长度、URL 形态），不合法就当场拒绝 */
const ConfigSaveInput = z.object({
  apiKey: z.string().trim().min(10, 'Key 太短，像是没复制完整').max(200),
  baseUrl: z.string().url('接口地址不是合法网址').max(200).optional(),
  model: z.string().trim().max(100).optional()
})

const ConfigTestInput = z.object({
  apiKey: z.string().trim().max(200).optional(),
  baseUrl: z.string().url().max(200).optional(),
  model: z.string().trim().max(100).optional()
})

/** 会话单例（当前只有一次会话；多会话与持久化待后续迭代） */
let session: ChatSession | null = null

/** 内容源由主进程在启动时装载并注入（真实内容/演示内容的回落逻辑在 `content/runtime.ts`） */
let contentRuntime: ContentRuntime | null = null

/** 本机数据存储（JSONL；选型见 docs/adr/ADR-0003 决策二） */
let persistence: { store: StudentStore; dataDir: string } | null = null

/** 学生编号：由教师分配，不存真实姓名。当前单人版固定 S00，将来从本机记录里读 */
const STUDENT_ID = 'S00'

/** 本次运行的会话 id 与轮次计数（用于给每条消息生成稳定 id） */
let currentSessionId: string | null = null
let turnSeq = 0

function createSession(runtime: ContentRuntime): ChatSession {
  const config = loadConfig()
  const client = new DeepSeekClient({
    apiKey: config.deepseek.apiKey,
    baseUrl: config.deepseek.baseUrl,
    model: config.deepseek.model
  })

  const firstPosition = runtime.positions[0]
  if (!firstPosition) throw new Error('内容源没有可用的学习位置（positions 为空）')

  // 接着上次继续：上次会话的位置与标签，让开场问题能提到"上次你在……"
  const last = persistence ? latestSession(persistence.dataDir, STUDENT_ID) : null
  const lastPosition = last
    ? {
        position: last.position,
        label:
          runtime.positions.find((item) => item.position.sectionId === last.position.sectionId)?.label ??
          last.position.sectionId ??
          ''
      }
    : null

  return new ChatSession({
    client,
    registry: new ToolRegistry(createDefaultTools()),
    // 注：ChatSession 的 scopeFactory 目前是同步且只收 mode；多单元位置选择需要把它改成接收 position
    //（属接口调整，另开一件事）。当前只有一个单元，用首个位置即可。
    scopeFactory: (mode) => runtime.scopeFor(firstPosition.position, mode),
    getSectionText: runtime.getSectionText,
    studentId: STUDENT_ID,
    positions: runtime.positions,
    lastPosition
  })
}

/**
 * 落盘一条消息。**学生的话在调用模型之前就落**——哪怕模型失败/崩溃，问题也不会丢。
 * 存储不可用时只记日志、不抛错：数据记录不该让对话挂掉。
 */
async function persistTurn(
  sessionId: string,
  role: 'user' | 'assistant',
  content: string,
  flags: TurnFlag[] = []
): Promise<string> {
  turnSeq += 1
  const id = `${sessionId}-${role === 'user' ? 'u' : 'a'}${turnSeq}`
  if (!persistence) return id
  const turn: Turn = {
    id,
    sessionId,
    role,
    content,
    flags,
    createdAt: new Date().toISOString()
  }
  try {
    await persistence.store.appendTurn(turn)
  } catch (error) {
    console.error(`落盘失败（不影响对话）：${error instanceof Error ? error.message : String(error)}`)
  }
  return id
}

/** 第一次选定学习模式时建立会话记录（这时才拿得到 mode 与 position） */
async function ensurePersistedSession(): Promise<void> {
  if (!persistence || currentSessionId) return
  const chat = getSession()
  const scope = chat.currentScope()
  const state = chat.getState()
  if (!scope || !state.mode) return
  const startedAt = new Date().toISOString()
  const id = `${startedAt.slice(0, 19).replace(/[:T]/g, '-')}-${STUDENT_ID}`
  currentSessionId = id
  try {
    await persistence.store.upsertStudent({ id: STUDENT_ID, createdAt: startedAt })
    await persistence.store.createSession({
      id,
      studentId: STUDENT_ID,
      studyMode: state.mode,
      position: scope.position,
      startedAt
    })
  } catch (error) {
    console.error(`建立会话记录失败：${error instanceof Error ? error.message : String(error)}`)
  }
}

/** 本轮学生的话提到了哪些知识点 → 记"探索中"（参与痕迹，不是掌握度判定，见 mastery-touch.ts） */
async function recordMasteryTouches(studentMessage: string, evidenceTurnId: string): Promise<void> {
  if (!persistence) return
  const scope = getSession().currentScope()
  if (!scope) return
  const touched = touchedKnowledgePoints(scope.knowledgePoints, studentMessage)
  const updatedAt = new Date().toISOString()
  for (const kpId of touched) {
    try {
      await persistence.store.setMasteryState(STUDENT_ID, kpId, 'exploring', evidenceTurnId, updatedAt)
    } catch (error) {
      console.error(`记录掌握度失败（不影响对话）：${error instanceof Error ? error.message : String(error)}`)
    }
  }
}

/** 退出前收尾：给会话写上结束时间（便于统计一次学习时长） */
export async function endCurrentSession(endedAt: string): Promise<void> {
  if (!persistence || !currentSessionId) return
  try {
    await persistence.store.endSession(currentSessionId, endedAt)
  } catch {
    /* 退出路径上不抛错 */
  }
}

/** 自检用：确认"这一轮真的落到本机文件里了"（不是只存在内存里） */
export async function describePersistence(): Promise<{ sessionId: string | null; turnCount: number }> {
  if (!persistence || !currentSessionId) return { sessionId: currentSessionId, turnCount: 0 }
  try {
    const turns = await persistence.store.listTurns(currentSessionId)
    return { sessionId: currentSessionId, turnCount: turns.length }
  } catch {
    return { sessionId: currentSessionId, turnCount: 0 }
  }
}

function getSession(): ChatSession {
  if (!contentRuntime) throw new Error('内容源尚未初始化：请在启动时调用 registerIpcHandlers(runtime)')
  session ??= createSession(contentRuntime)
  return session
}

export function registerIpcHandlers(
  runtime: ContentRuntime,
  store?: { store: StudentStore; dataDir: string }
): void {
  contentRuntime = runtime
  persistence = store ?? null

  ipcMain.handle('app:ping', (_event, payload: unknown) => {
    const input = PingInput.parse(payload)
    return { reply: `pong: ${input.message}`, at: new Date().toISOString() }
  })

  /** 开场：Agent 主动询问想做什么，返回四个选项 */
  ipcMain.handle('session:start', async () => {
    const chat = getSession()
    chat.reset()
    // 首次打开就登记学生，保证本机数据目录从一开始就有他的编号（不存姓名）
    if (persistence) {
      try {
        if (!(await persistence.store.getStudent(STUDENT_ID))) {
          await persistence.store.upsertStudent({ id: STUDENT_ID, createdAt: new Date().toISOString() })
        }
      } catch (error) {
        console.error(`登记学生失败：${error instanceof Error ? error.message : String(error)}`)
      }
    }
    return chat.start()
  })

  ipcMain.handle('session:chooseMode', async (_event, payload: unknown) => {
    const input = ChooseModeInput.parse(payload)
    const result = getSession().chooseMode(input.input)
    // 这时才拿得到"模式 + 位置" → 建立本次会话记录（一个应用运行 = 一次会话）
    await ensurePersistedSession()
    return result
  })

  /**
   * 一轮对话：走完整 Agent 循环（工具调用 + 答案泄漏护栏 + 降级）。
   *
   * 落盘顺序（重要）：**先写学生的话，再调用模型**——模型失败时问题仍在本机，
   * 学习统计不会因为一次网络故障丢掉学生真实说过的话。
   */
  ipcMain.handle('agent:chat', async (_event, payload: unknown) => {
    const input = ChatInput.parse(payload)
    const chat = getSession()
    const sessionId = currentSessionId
    if (sessionId) await persistTurn(sessionId, 'user', input.message)

    const result = await chat.chat(input.message)

    // 未选模式时返回的是 { needsMode: true, message }，没有回复可存
    if (sessionId && 'reply' in result) {
      const turnId = await persistTurn(sessionId, 'assistant', result.reply, [...result.flags])
      await recordMasteryTouches(input.message, turnId)
    }
    return result
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

  /** 是否已配置 Key（**只回布尔，不回 Key 本身**）+ 是否显示开发用信息 */
  ipcMain.handle('config:status', () => {
    const config = loadConfig()
    return { mode: config.mode, hasApiKey: config.deepseek.apiKey.length > 0, devUi: config.devUi }
  })

  /**
   * 配置概览（给"首次运行配置"界面用）。
   * ⚠️ 不返回 Key 的任何片段——包括掩码预览（掩码也是密钥信息）。
   */
  ipcMain.handle('config:describe', () => describeConfig())

  /** 保存配置到本机用户目录（首次运行配置 / 设置里改 Key 都走这里） */
  ipcMain.handle('config:save', (_event, raw) => {
    const input = ConfigSaveInput.parse(raw)
    return saveUserConfig({
      deepseekApiKey: input.apiKey,
      deepseekBaseUrl: input.baseUrl,
      deepseekModel: input.model
    })
  })

  /**
   * 连通性测试：用"输入框里的 Key"（没填则用已保存的/环境变量）真实发一次最小请求。
   * 目的：让学生在拿到软件之前，老师就能确认"这台电脑能不能连上模型"。
   * Key 只在这一方向经过 IPC（渲染 → 主进程），永远不会回传。
   *
   * ⚠️ 安全约束（见 `config/connectivity.ts`）：调用方**改了接口地址**却没填 Key 时，
   * 拒绝复用已保存的 Key —— 否则等于把密钥发给了它指定的任意网址。
   */
  ipcMain.handle('config:test', async (_event, raw) => {
    const input = ConfigTestInput.parse(raw ?? {})
    const saved = describeConfig()

    const target = resolveConnectivityTarget({
      inputApiKey: input.apiKey,
      inputBaseUrl: input.baseUrl,
      inputModel: input.model,
      savedApiKey: process.env['DEEPSEEK_API_KEY'] ?? readUserConfig().deepseekApiKey ?? '',
      savedBaseUrl: saved.baseUrl,
      savedModel: saved.model
    })

    if (!target.ok) {
      return { ok: false, kind: target.kind, message: target.message }
    }

    const client = new DeepSeekClient({
      apiKey: target.apiKey,
      baseUrl: target.baseUrl,
      model: target.model
    })

    const startedAt = Date.now()
    try {
      await client.chat([{ role: 'user', content: '你好' }], { temperature: 0 })
      return { ok: true, kind: 'ok', message: `连接成功（用了 ${Date.now() - startedAt} 毫秒）` }
    } catch (error) {
      if (error instanceof LLMError) {
        return { ok: false, kind: error.kind, message: describeConnectivityError(error) }
      }
      return { ok: false, kind: 'unknown', message: '连接失败：请检查网络后重试' }
    }
  })
}

/**
 * 连通性失败的"大人版"提示：这里的使用者是老师/家长，说清技术原因是帮忙，不是添乱
 * （面向学生的降级话术在 core 的 LLMError.toStudentMessage 里，两者受众不同）。
 */
function describeConnectivityError(error: LLMError): string {
  switch (error.kind) {
    case 'missing-key':
      return '还没填 API Key'
    case 'auth':
      return 'Key 无效（认证失败）：请确认复制完整、没有多余空格'
    case 'balance':
      return '账户余额不足：请先充值'
    case 'rate-limit':
      return '请求太频繁：稍等一会儿再试'
    case 'network':
      return '连不上服务器：请检查网络（或公司/学校网络限制）'
    case 'server':
      return '对方服务器暂时不可用：稍后重试'
    default:
      return '对方返回了预期外的内容：请重试，或换一个模型名'
  }
}

/** 开发期自检用：把会话能力暴露给主进程自检脚本（不经过 IPC） */
export function createSelfTestSession(runtime: ContentRuntime): ChatSession {
  return createSession(runtime)
}
