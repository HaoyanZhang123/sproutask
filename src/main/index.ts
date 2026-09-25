import { app, BrowserWindow, shell } from 'electron'
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { registerIpcHandlers, createSelfTestSession } from './ipc'
import { loadConfig } from './config'

/**
 * 主进程入口。
 * 职责边界：窗口生命周期、IPC 注册、配置加载、开发期自检。
 * 业务逻辑（会话状态机、Agent 循环、提示词）一律放 src/core，不得写在这里。
 */

/** 开发期自检：无头验证"主进程侧装配 + 界面能否渲染"，不需要人工点击 */
const SELF_TEST = process.env['SPROUTASK_SELFTEST'] === '1'

function createWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1100,
    height: 760,
    show: false,
    title: '芽问 SproutAsk',
    autoHideMenuBar: true,
    backgroundColor: '#f7f8fa',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })

  win.on('ready-to-show', () => win.show())

  // 外链一律交给系统浏览器，不在应用内打开
  win.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url)
    return { action: 'deny' }
  })

  // 开发期由 electron-vite 注入 dev server 地址；打包后加载本地文件
  const devUrl = process.env['ELECTRON_RENDERER_URL']
  if (devUrl) {
    void win.loadURL(devUrl)
  } else {
    void win.loadFile(join(__dirname, '../renderer/index.html'))
  }

  return win
}

/** 在渲染进程里执行一段 JS 并取回结果（自检用） */
async function evalInRenderer<T>(win: BrowserWindow, code: string): Promise<T> {
  return (await win.webContents.executeJavaScript(code, true)) as T
}

/**
 * 启动前的环境自检：如果主进程是被"纯 Node"方式启动的（典型原因：环境里设了
 * `ELECTRON_RUN_AS_NODE=1`，多半是模拟 CI 时留下的），`require('electron')`
 * 会返回 npm 包而不是 Electron API，报错会是难以定位的
 * `Cannot read properties of undefined (reading 'whenReady')`。
 * 这里提前给出可读的诊断，省得下次再查半小时。
 */
if (!process.versions.electron) {
  console.error(
    '[main] 当前进程不是 Electron 运行时，而以纯 Node 启动了。\n' +
      '       常见原因：环境变量 ELECTRON_RUN_AS_NODE=1（模拟 CI 时常被设置后忘记清理）。\n' +
      '       处理：在新终端里执行 `Remove-Item Env:ELECTRON_RUN_AS_NODE`（或 set ELECTRON_RUN_AS_NODE=）后重跑 pnpm dev。'
  )
  process.exit(1)
}

const wait = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms))

/**
 * 自检：不靠人工点击，直接在运行中的应用里操作 DOM 并断言。
 *
 * 覆盖：主进程装配（会话/选项/回复路径）→ 界面渲染（开场问句、四个模式按钮）
 * → 交互（点击模式 → 进入对话 → 发送消息 → 出现回复气泡）→ 样式是否生效。
 * 任何一项失败则以退出码 1 结束，便于 CI 或无头环境自动判定。
 *
 * 注意：**有 Key / 无 Key 两种环境都必须通过**——断言的是"产品行为合理"，
 * 而不是"环境恰好没配 Key"（早期版本误把环境当断言，配好 Key 后自检反而失败）。
 * 另外：**信息性输出用 note() 打印，不要写成恒真的 check()**——
 * `check(x, true)` 这类断言看着绿，其实什么都没验证（独立审核员指出过）。
 */
async function runSelfTest(win: BrowserWindow): Promise<void> {
  const config = loadConfig()
  const session = createSelfTestSession()
  const failures: string[] = []
  const hasKey = config.deepseek.apiKey.length > 0

  const check = (label: string, ok: boolean, detail = ''): void => {
    console.log(`[selftest] ${ok ? '✅' : '❌'} ${label}${detail ? ` —— ${detail}` : ''}`)
    if (!ok) failures.push(label)
  }

  /** 信息性输出：只打印事实，不计入通过/失败（避免写成恒真断言） */
  const note = (label: string, detail: string): void => {
    console.log(`[selftest] ℹ️  ${label} —— ${detail}`)
  }

  // ── 主进程侧装配 ───────────────────────────────────────────
  const start = session.start()
  const chosen = session.chooseMode('2')
  check('运行模式可加载', config.mode === 'dev' || config.mode === 'packaged', config.mode)
  check('Key 配置状态可读取', typeof config.deepseek.apiKey === 'string' && config.deepseek.model.length > 0)
  note('Key 状态', hasKey ? '已配置 → 走真实调用' : '未配置 → 走降级')
  check('开场问句包含主动询问', start.question.includes('今天想做什么'))
  check('提供四个模式选项', start.options.length === 4, start.options.map((o) => o.label).join('/'))
  check('选择"2"解析为复习', chosen.ok && chosen.mode === 'review')

  const chat = await session.chat('细胞的生活需要什么？')
  const reply = 'reply' in chat ? chat.reply : ''
  const degraded = 'degraded' in chat ? chat.degraded : undefined

  check('一轮对话返回可读回复（不抛错、不空白）', reply.trim().length > 0, `${reply.length} 字`)
  check(
    '回复对学生可读（不含调用栈 / 状态码 / 技术细节）',
    !/(Error|error:|stack|at\s+\w+\s*\(|\b[45]\d{2}\b|Bearer|apiKey)/.test(reply)
  )
  if (hasKey) {
    // 有 Key 时不断言"一定成功"（可能余额不足/网络不通），但降级原因必须是已知分类，
    // 否则说明错误映射漏了一种情况——这是能真正失败的断言。
    const knownKinds = ['missing-key', 'auth', 'balance', 'rate-limit', 'server', 'network', 'bad-response']
    check(
      '已配置 Key：未降级，或降级原因属于已知分类',
      !degraded || knownKinds.includes(degraded.kind),
      degraded ? `降级=${degraded.kind}` : '未降级'
    )
  } else {
    check('未配置 Key：降级而非崩溃，且话术面向学生', Boolean(degraded) && reply.includes('钥匙'), degraded?.kind ?? '')
  }

  // ── 界面渲染 ───────────────────────────────────────────────
  await wait(1200)
  const firstScreen = await evalInRenderer<{
    text: string
    cards: number
    visibleCards: number
  }>(
    win,
    `(() => {
      const cards = [...document.querySelectorAll('.mode-card')]
      return {
        text: document.body.innerText,
        cards: cards.length,
        visibleCards: cards.filter((el) => el.offsetParent !== null).length
      }
    })()`
  )
  check('界面渲染出开场问句', firstScreen.text.includes('今天想做什么'), firstScreen.text.split('\n')[0])
  check('界面渲染出四个模式按钮且可见', firstScreen.cards === 4 && firstScreen.visibleCards === 4)

  // ── 交互：点击"复习" ───────────────────────────────────────
  await evalInRenderer(
    win,
    `[...document.querySelectorAll('.mode-card')][1].click(); true`
  )
  await wait(600)
  const afterChoose = await evalInRenderer<{ text: string; hasComposer: boolean }>(
    win,
    `({ text: document.body.innerText, hasComposer: Boolean(document.querySelector('.composer')) })`
  )
  check('点击模式后进入对话状态', afterChoose.hasComposer, afterChoose.text.split('\n').slice(-3).join(' / '))
  check('顶部显示当前模式', afterChoose.text.includes('复习'))

  // ── 交互：发送一句话 ───────────────────────────────────────
  await evalInRenderer(
    win,
    `(() => {
      const box = document.querySelector('.composer textarea')
      box.value = '细胞的生活需要什么？'
      box.dispatchEvent(new Event('input', { bubbles: true }))
      return true
    })()`
  )
  await wait(300)
  await evalInRenderer(win, `document.querySelector('.composer button').click(); true`)
  await wait(2500)

  const afterSend = await evalInRenderer<{
    userBubbles: number
    assistantBubbles: number
    assistantText: string
    text: string
    userBg: string
  }>(
    win,
    `(() => {
      const user = document.querySelector('.bubble.user')
      const assistants = [...document.querySelectorAll('.bubble.assistant')]
      const last = assistants[assistants.length - 1]
      return {
        userBubbles: document.querySelectorAll('.bubble.user').length,
        assistantBubbles: assistants.length,
        assistantText: last ? last.innerText : '',
        text: document.body.innerText,
        userBg: user ? getComputedStyle(user).backgroundColor : ''
      }
    })()`
  )
  check('学生的消息上屏（用户气泡）', afterSend.userBubbles >= 1)
  check('小芽的回复上屏（助手气泡）', afterSend.assistantBubbles >= 1)
  // 两种环境都要成立：无 Key 时是可读降级话术；有 Key 时是模型回复——都必须是"有内容的文字"
  check(
    '回复以文字呈现且不含错误技术细节',
    afterSend.assistantText.trim().length > 0 &&
      !/(Error|error:|stack|apiKey|Bearer)/.test(afterSend.assistantText),
    `${afterSend.assistantText.trim().slice(0, 20)}…（${hasKey ? '已配置 Key' : '未配置 Key'}）`
  )
  check('样式已生效（用户气泡为品牌绿）', afterSend.userBg === 'rgb(22, 163, 74)', afterSend.userBg)

  // ── 教材阅读视图（可折叠答案、搜索高亮、按模式折叠） ────────
  const reading = await evalInRenderer<{
    hasPane: boolean
    sectionTitle: string
    collapsed: boolean
    stacked: boolean
    answerToggles: number
    visibleAnswerBodies: number
  }>(
    win,
    `(() => {
      const pane = document.querySelector('.pane')
      return {
        hasPane: Boolean(pane),
        sectionTitle: pane ? (pane.querySelector('.section-title')?.textContent ?? '') : '',
        collapsed: pane ? pane.classList.contains('collapsed') : false,
        stacked: Boolean(document.querySelector('.workspace.stacked')),
        answerToggles: document.querySelectorAll('.answer-toggle').length,
        visibleAnswerBodies: document.querySelectorAll('.answer-body').length
      }
    })()`
  )
  check('教材阅读区已渲染出来', reading.hasPane)
  check('阅读区显示当前小节标题', reading.sectionTitle.includes('细胞的生活'), reading.sectionTitle)
  check(
    '复习模式默认收起阅读区（把屏幕让给对话）',
    reading.collapsed && reading.stacked,
    `collapsed=${reading.collapsed} stacked=${reading.stacked}`
  )
  check(
    '收起状态下不渲染正文（省空间，也避免答案被瞥见）',
    reading.answerToggles === 0,
    `收起时答案块数=${reading.answerToggles}`
  )

  // 展开阅读区
  await evalInRenderer(win, `(() => { document.querySelector('.pane .ghost').click(); return true })()`)
  await wait(400)
  const afterExpandPane = await evalInRenderer<{
    collapsed: boolean
    hasSearch: boolean
    answerToggles: number
    visibleAnswerBodies: number
  }>(
    win,
    `(() => {
      const pane = document.querySelector('.pane')
      return {
        collapsed: pane ? pane.classList.contains('collapsed') : true,
        hasSearch: Boolean(document.querySelector('.pane .search')),
        answerToggles: document.querySelectorAll('.answer-toggle').length,
        visibleAnswerBodies: document.querySelectorAll('.answer-body').length
      }
    })()`
  )
  check('点"展开教材"后阅读区展开并出现搜索框', !afterExpandPane.collapsed && afterExpandPane.hasSearch)
  check(
    '答案块存在且默认收起（先自己答、再展开对照）',
    afterExpandPane.answerToggles >= 3 && afterExpandPane.visibleAnswerBodies === 0,
    `${afterExpandPane.answerToggles} 个答案块，默认可见正文 ${afterExpandPane.visibleAnswerBodies} 个`
  )

  // 点开一个答案块
  await evalInRenderer(win, `(() => { document.querySelector('.answer-toggle').click(); return true })()`)
  await wait(300)
  const openedAnswer = await evalInRenderer<number>(
    win,
    `document.querySelectorAll('.answer-body').length`
  )
  check('点开答案块后能看到答案正文', openedAnswer >= 1)

  // 搜索只出现在折叠答案里的词（"DNA" 只在答案块内）→ 给提示而不自动展开
  await evalInRenderer(
    win,
    `(() => {
      const box = document.querySelector('.pane .search')
      box.value = 'DNA'
      box.dispatchEvent(new Event('input', { bubbles: true }))
      return true
    })()`
  )
  await wait(400)
  const searched = await evalInRenderer<{ hint: boolean; hits: number; info: string }>(
    win,
    `(() => ({
      hint: Boolean(document.querySelector('.collapsed-hint')),
      hits: document.querySelectorAll('.pane .hit').length,
      info: document.querySelector('.match-info') ? document.querySelector('.match-info').textContent : ''
    }))()`
  )
  check('搜索命中折叠答案时只提示、不自动展开', searched.hint, searched.info)

  // 学生主动点"展开看看"后才展开并高亮
  await evalInRenderer(
    win,
    `(() => { const b = document.querySelector('.collapsed-hint .link'); if (b) b.click(); return true })()`
  )
  await wait(400)
  const afterSearchExpand = await evalInRenderer<number>(
    win,
    `document.querySelectorAll('.pane .hit').length`
  )
  check('点"展开看看"后命中处出现高亮', afterSearchExpand >= 1, `${afterSearchExpand} 处高亮`)

  // ── 留档：截图供人工复核 ───────────────────────────────────
  const image = await win.webContents.capturePage()
  const outFile = join(process.cwd(), 'selftest-ui.png')
  writeFileSync(outFile, image.toPNG())
  console.log('[selftest] 界面截图：', outFile)

  if (failures.length > 0) {
    console.error(`[selftest] 结果：失败 ${failures.length} 项 —— ${failures.join('；')}`)
    app.exit(1)
    return
  }
  console.log('[selftest] 结果：通过')
  app.exit(0)
}

void app.whenReady().then(() => {
  const config = loadConfig()
  registerIpcHandlers()
  const win = createWindow()

  // 自检模式：等界面首帧后再截图（判定标准是"渲染出了内容"，不是"窗口存在"）
  if (SELF_TEST) {
    win.webContents.once('did-finish-load', () => {
      void runSelfTest(win)
    })
  } else if (!config.deepseek.apiKey) {
    console.warn('[main] 未检测到 DEEPSEEK_API_KEY：对话会走降级路径（界面仍可用）')
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
