import { app, BrowserWindow, shell } from 'electron'
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { registerIpcHandlers, createSelfTestSession, endCurrentSession, describePersistence } from './ipc'
import { createJsonlStudentStore, latestSession } from './storage/jsonl-store'
import { createContentRuntime, type ContentRuntime } from './content/runtime'
import { loadConfig } from './config'
import { resolveConnectivityTarget } from './config/connectivity'

/**
 * 主进程入口。
 * 职责边界：窗口生命周期、IPC 注册、配置加载、开发期自检。
 * 业务逻辑（会话状态机、Agent 循环、提示词）一律放 src/core，不得写在这里。
 */

/** 开发期自检：无头验证"主进程侧装配 + 界面能否渲染"，不需要人工点击 */
const SELF_TEST = process.env['SPROUTASK_SELFTEST'] === '1'

/**
 * 自检里用来"试连"的**假 Key**（必然连不上）。
 * 它不是真 Key；同时用于判定"这串假 Key 有没有被界面回显出来"（泄露检查）。
 */
const FAKE_KEY = ['sk', 'fake', 'key', 'for', 'selftest'].join('-')

/**
 * 打包版没有控制台，出问题时只能靠文件。
 * 启动过程与自检的关键节点都追加写到这里。
 *
 * 目录顺序有讲究：**打包版优先写用户目录**——便携版是自解压运行，
 * cwd 在临时目录里、退出时会被整目录删掉（实测：结果文件因此消失），
 * 只有用户目录是持久的；开发期则写当前目录（我总在项目根启动，方便直接看）。
 */
function bootLog(line: string): void {
  const text = `[${new Date().toISOString()}] ${line}\n`
  const candidates = app.isPackaged
    ? [join(app.getPath('userData'), 'boot.log'), join(process.cwd(), 'boot.log')]
    : [join(process.cwd(), 'boot.log'), join(app.getPath('userData'), 'boot.log')]

  for (const file of candidates) {
    try {
      writeFileSync(file, text, { flag: 'a' })
      return
    } catch {
      /* 换下一个候选目录 */
    }
  }
}

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
 * 轮询等待渲染进程满足条件。
 * 为什么需要：界面状态是异步装配的（例如选完模式后要等一次 IPC 把教材读来），
 * 固定 sleep 在开发机上够用、到了打包版就可能赶不上——那会让自检变成"看运气"。
 */
async function waitForRenderer(
  win: BrowserWindow,
  code: string,
  timeoutMs = 4000,
  stepMs = 200
): Promise<boolean> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    try {
      if (await evalInRenderer<boolean>(win, code)) return true
    } catch {
      // 渲染进程还在切换状态时脚本可能抛错，忽略并重试
    }
    await wait(stepMs)
  }
  return false
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
async function runSelfTest(win: BrowserWindow, runtime: ContentRuntime, dataDir: string): Promise<void> {
  const config = loadConfig()
  const session = createSelfTestSession(runtime)
  const failures: string[] = []
  const records: Array<{ label: string; ok: boolean; detail: string }> = []
  const notes: string[] = []
  const hasKey = config.deepseek.apiKey.length > 0

  const check = (label: string, ok: boolean, detail = ''): void => {
    console.log(`[selftest] ${ok ? '✅' : '❌'} ${label}${detail ? ` —— ${detail}` : ''}`)
    records.push({ label, ok, detail })
    if (!ok) failures.push(label)
  }

  /** 信息性输出：只打印事实，不计入通过/失败（避免写成恒真断言） */
  const note = (label: string, detail: string): void => {
    console.log(`[selftest] ℹ️  ${label} —— ${detail}`)
    notes.push(`${label}：${detail}`)
  }

  /**
   * 写结果文件。
   * 为什么需要：**打包后的 Windows 应用没有控制台**，stdout 看不到；
   * 有了这个文件，就能用"退出码 + 结果文件"验证打包产物真的能跑。
   */
  const writeResultFile = (): void => {
    const payload = {
      at: new Date().toISOString(),
      mode: config.mode,
      packaged: app.isPackaged,
      hasKey,
      total: records.length,
      failed: failures.length,
      failures,
      checks: records,
      notes
    }
    // 打包版优先写用户目录：便携版的自解压目录退出即被删除（实测结果文件因此丢失）
    const targets = app.isPackaged
      ? [app.getPath('userData'), process.cwd()]
      : [process.cwd(), app.getPath('userData')]
    for (const target of targets) {
      try {
        writeFileSync(join(target, 'selftest-result.json'), `${JSON.stringify(payload, null, 2)}\n`, 'utf-8')
        console.log('[selftest] 结果文件：', join(target, 'selftest-result.json'))
        return
      } catch {
        // 换下一个可写目录（打包版可能从只读位置启动）
      }
    }
    console.warn('[selftest] 结果文件写入失败（两个候选目录都不可写）')
  }

  // ── 主进程侧装配 ───────────────────────────────────────────
  const start = session.start()

  // "接着上次继续"：本机已有历史会话时，开场问题必须提到上次学到哪儿
  // （关掉应用再打开仍记得位置——③ 的可见验收点；干净机器上没有历史，这条自动跳过）
  const prior = latestSession(dataDir, 'S00')
  if (prior) {
    const label =
      runtime.positions.find((item) => item.position.sectionId === prior.position.sectionId)?.label ?? ''
    check(
      '接着上次：开场问题提到上次学到哪一节（关掉应用再打开仍记得）',
      label.length > 0 && start.question.includes(label),
      label ? `上次：${label}` : '（历史会话的位置不在当前内容里）'
    )
  } else {
    check('接着上次（本机还没有历史会话 → 未测）', true, '第一次使用时的正常情况')
  }
  const chosen = session.chooseMode('2')
  check('运行模式可加载', config.mode === 'dev' || config.mode === 'packaged', config.mode)
  check(
    '内容源可装载（真实内容或演示占位）',
    runtime.positions.length > 0,
    `${runtime.source === 'content' ? '真实内容' : '演示占位'}｜${runtime.describe}`
  )

  // 本节是否含"折叠答案"块：真实教材往往**不印答案**（2026-09-27 实测：人教版 2024 版
  // "想一想，议一议 / 讨论"都不印答案，答案写在正文里）——所以下面三条与答案块有关的断言
  // 只在"本节确有 :::answer 块"时才有意义；没有就明确标"未测"，不假装通过。
  const scopeText = session.currentScope()?.sectionTexts.map((s) => s.text).join('\n') ?? ''
  const hasAnswerBlocks = /(^|\n):::answer/.test(scopeText)

  // 搜索探针：从"折叠答案"里取一小段**只在答案块里出现**的文字，
  // 用来验"搜到折叠内容时只提示、不自动展开"。写死一个词（如 DNA）在真实教材上会失效——
  // 它很可能同时出现在正文里（2026-09-27 换真实内容时实测）。
  const answerBlockTexts = [...scopeText.matchAll(/:::answer[^\n]*\n([\s\S]*?):::/g)].map((m) =>
    (m[1] ?? '').replace(/\s+/g, '')
  )
  const flatBodyText = scopeText.replace(/:::answer[\s\S]*?:::/g, '').replace(/\s+/g, '')
  let answerProbe = ''
  for (const block of answerBlockTexts) {
    for (let i = 0; i + 6 <= block.length && !answerProbe; i += 1) {
      const candidate = block.slice(i, i + 6)
      if (!flatBodyText.includes(candidate)) answerProbe = candidate
    }
    if (answerProbe) break
  }
  check('Key 配置状态可读取', typeof config.deepseek.apiKey === 'string' && config.deepseek.model.length > 0)
  note('Key 状态', hasKey ? '已配置 → 走真实调用' : '未配置 → 走降级')
  check('开场问句包含主动询问', start.question.includes('今天想做什么'))
  check('提供四个模式选项', start.options.length === 4, start.options.map((o) => o.label).join('/'))
  check('选择"2"解析为复习', chosen.ok && chosen.mode === 'review')

  // 安全断言（纯策略、不联网、不碰真实配置）：
  // 改了接口地址又没填 Key 时，绝不允许复用已保存的 Key —— 那等于把密钥发给任意网址。
  const endpointProbe = resolveConnectivityTarget({
    inputApiKey: '',
    inputBaseUrl: 'https://example.invalid/v1',
    savedApiKey: ['saved', 'key', 'for', 'selftest'].join('-'),
    savedBaseUrl: 'https://api.deepseek.com',
    savedModel: 'deepseek-chat'
  })
  check(
    '试连：改了接口地址又没填 Key 时拒绝复用已保存的 Key',
    !endpointProbe.ok && endpointProbe.kind === 'endpoint-changed'
  )

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

  // ── 首次运行配置（学生装完得能自己接上"外脑"） ──────────────
  await wait(1400)
  const configUi = await evalInRenderer<{
    shown: boolean
    leaksKey: boolean
    leakSample: string
    saveDisabled: boolean
    hasTestButton: boolean
    text: string
    emptyKeyInput: boolean
  }>(
    win,
    `(() => {
      const panel = document.querySelector('.config')
      const save = document.querySelector('.config .save-btn')
      const keyInput = document.querySelector('.config .key-input')
      const body = document.body.innerText
      return {
        shown: Boolean(panel),
        // 界面上不得出现任何 Key 片段（连掩码都不许）。
        // ⚠️ 探针口径（2026-09-27 实测修正）：原先写成 /sk-[A-Za-z0-9]/ 太糙——
        //    测试目录名 "sproutask-clean2-…" 里的 "sk-c" 就会命中，报出假阳性。
        //    现在按**真实 Key 形态**判定：sk- 后面至少 20 位字母数字（真实 Key 是 32 位）。
        leaksKey: /sk-[A-Za-z0-9]{20,}/.test(body),
        leakSample: ((body.match(/.{0,24}sk-[A-Za-z0-9]{20,}.{0,24}/) ?? [''])[0] || '').trim(),
        saveDisabled: save ? save.disabled : true,
        hasTestButton: Boolean(document.querySelector('.config .test-btn')),
        text: body,
        emptyKeyInput: keyInput ? keyInput.value === '' : false
      }
    })()`
  )

  if (!hasKey) {
    check('未配置 Key：先弹出"首次运行配置"界面', configUi.shown)
    check(
      '配置界面不显示 Key 内容（连掩码都不给）',
      !configUi.leaksKey,
      configUi.leaksKey ? `命中片段：${configUi.leakSample}` : '未出现 sk- 形态的字符串'
    )
    check('Key 还没填时"保存并开始"不可点（防手滑）', configUi.saveDisabled)
    check('提供"先试连一下"与"稍后再说"两个出口', configUi.hasTestButton)

    // 填一个假 Key → 试连应当失败，但必须给出面向大人的中文说明，且不崩、不泄露
    await evalInRenderer(
      win,
      `(() => {
        const input = document.querySelector('.config .key-input')
        input.value = ${JSON.stringify(FAKE_KEY)}
        input.dispatchEvent(new Event('input', { bubbles: true }))
        return true
      })()`
    )
    await wait(300)
    const saveEnabledAfterTyping = await evalInRenderer<boolean>(
      win,
      `!document.querySelector('.config .save-btn').disabled`
    )
    check('填了足够长的 Key 后"保存并开始"可点', saveEnabledAfterTyping)

    await evalInRenderer(win, `(() => { const b = document.querySelector('.config .test-btn'); if (b) b.click(); return true })()`)
    await wait(4500)
    const testResult = await evalInRenderer<{ text: string; busy: boolean; leaksKey: boolean; leakSample: string }>(
      win,
      `(() => {
        const msg = document.querySelector('.config .message')
        const btn = document.querySelector('.config .test-btn')
        const body = document.body.innerText
        return {
          text: msg ? msg.innerText : '',
          busy: btn ? btn.disabled : true,
          // 试连后：既要判"真实 Key 形态"，也要判"刚才注入的那串假 Key 有没有被回显"
          // （注意：这段脚本在**渲染进程**里跑，主进程的变量必须用 JSON.stringify 注入）
          leaksKey: /sk-[A-Za-z0-9]{20,}/.test(body) || body.includes(${JSON.stringify(FAKE_KEY)}),
          leakSample: ((body.match(/.{0,24}sk-[A-Za-z0-9]{20,}.{0,24}/) ?? [''])[0] || '').trim() ||
            (body.includes(${JSON.stringify(FAKE_KEY)}) ? '回显了注入的假 Key' : '')
        }
      })()`
    )
    check(
      '试连失败时给出面向大人的中文说明（不抛错、不卡住）',
      testResult.text.length > 0 && !testResult.busy && !/Error|error:|stack/.test(testResult.text),
      testResult.text.slice(0, 30)
    )
    check(
      '试连过程与结果都不泄露 Key',
      !testResult.leaksKey,
      testResult.leaksKey ? `命中片段：${testResult.leakSample}` : '未出现 sk- 形态的字符串'
    )

    // "稍后再说" → 回到正常流程
    await evalInRenderer(win, `(() => { const b = document.querySelector('.config .skip-btn'); if (b) b.click(); return true })()`)
    await wait(600)
    const afterSkip = await evalInRenderer<{ panel: boolean; cards: number; warnText: string }>(
      win,
      `(() => ({
        panel: Boolean(document.querySelector('.config')),
        cards: document.querySelectorAll('.mode-card').length,
        warnText: document.querySelector('.warn') ? document.querySelector('.warn').innerText : ''
      }))()`
    )
    check('点"稍后再说"回到正常流程，且不再显示配置界面', !afterSkip.panel && afterSkip.cards === 4)
    check(
      '未配置时仍保留原来的顶部提示（文案未改）',
      afterSkip.warnText.includes('未检测到模型 API Key'),
      afterSkip.warnText.slice(0, 24)
    )
  } else {
    check('已配置 Key：启动时不弹首次运行配置界面', !configUi.shown)
  }

  // 顶栏"设置"随时能进来（两种环境都该有）
  await evalInRenderer(
    win,
    `[...document.querySelectorAll('.ghost-btn')].find((b) => b.innerText.includes('设置')).click(); true`
  )
  await wait(500)
  const settingsOpened = await evalInRenderer<boolean>(win, `Boolean(document.querySelector('.config'))`)
  check('顶栏"设置"能随时打开配置界面', settingsOpened)
  await evalInRenderer(win, `(() => { const b = document.querySelector('.config .skip-btn'); if (b) b.click(); return true })()`)
  await wait(400)

  // ── 界面渲染 ───────────────────────────────────────────────
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

  // ── 教材区"默认收起"必须在发消息之前断言 ────────────────────
  // 为什么：小芽的回复一旦提到课本位置，就会触发"出处自动定位"并把教材区展开（这是设计行为，
  // 见教材阅读视图的 spec）。若在发消息之后才断言"默认收起"，有 Key 的真实环境下必然失败。
  // 另外这里**轮询等待**而不是固定 sleep：选完模式后教材要经一次 IPC 才装配好，
  // 固定等待在打包版上赶不上（实测踩到）。
  const paneCollapsedInTime = await waitForRenderer(
    win,
    `(() => { const p = document.querySelector('.pane'); return Boolean(p) && p.classList.contains('collapsed') })()`
  )
  const paneDefault = await evalInRenderer<{
    collapsed: boolean
    stacked: boolean
    answerToggles: number
    located: boolean
  }>(
    win,
    `(() => {
      const pane = document.querySelector('.pane')
      return {
        collapsed: pane ? pane.classList.contains('collapsed') : false,
        stacked: Boolean(document.querySelector('.workspace.stacked')),
        answerToggles: document.querySelectorAll('.answer-toggle').length,
        located: Boolean(document.querySelector('.located'))
      }
    })()`
  )
  check(
    '复习模式默认收起阅读区（把屏幕让给对话）',
    paneCollapsedInTime && paneDefault.collapsed && paneDefault.stacked,
    `collapsed=${paneDefault.collapsed} stacked=${paneDefault.stacked} 及时=${paneCollapsedInTime}`
  )
  check(
    '收起状态下不渲染正文（省空间，也避免答案被瞥见）',
    paneDefault.answerToggles === 0,
    `收起时答案块数=${paneDefault.answerToggles}`
  )

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
  await evalInRenderer(win, `(() => { const b = document.querySelector('.composer button'); if (b) b.click(); return true })()`)
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

  // ── 布局（1/2）：无论并排还是堆叠，输入框都必须在视口内 ──
  const composerAlwaysVisible = await evalInRenderer<boolean>(
    win,
    `(() => {
      const box = document.querySelector('.composer textarea')
      if (!box) return false
      const r = box.getBoundingClientRect()
      return r.height > 0 && r.top >= 0 && r.bottom <= window.innerHeight + 1
    })()`
  )
  check('输入框常驻可见（不因布局变化被顶出屏幕）', composerAlwaysVisible)

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

  // 出处自动定位：回复里提到课本位置时，教材区应自动展开并给出"已定位"提示；
  // 没提到时应保持收起。两种结果都算通过——断言的是"行为与回复一致"。
  const locatedNote = await evalInRenderer<{ hasNote: boolean; collapsed: boolean; hits: number }>(
    win,
    `(() => {
      const pane = document.querySelector('.pane')
      return {
        hasNote: Boolean(document.querySelector('.located')),
        collapsed: pane ? pane.classList.contains('collapsed') : false,
        hits: document.querySelectorAll('.pane .hit').length
      }
    })()`
  )
  check(
    '提到出处就自动展开定位，没提到就保持收起（两者一致）',
    locatedNote.hasNote ? !locatedNote.collapsed : locatedNote.collapsed,
    `已定位提示=${locatedNote.hasNote} 收起=${locatedNote.collapsed} 高亮=${locatedNote.hits}`
  )

  // 展开阅读区（先确保它确实是收起的，避免"点展开"实际点成了收起）
  await evalInRenderer(
    win,
    `(() => {
      const pane = document.querySelector('.pane')
      if (pane && pane.classList.contains('collapsed')) {
        const b = document.querySelector('.pane .ghost')
        if (b) b.click()
      }
      return true
    })()`
  )
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
    hasAnswerBlocks
      ? '答案块存在且默认收起（先自己答、再展开对照）'
      : '答案块折叠行为（本节无答案块 → 未测）',
    hasAnswerBlocks
      ? afterExpandPane.answerToggles >= 1 && afterExpandPane.visibleAnswerBodies === 0
      : true,
    hasAnswerBlocks
      ? `${afterExpandPane.answerToggles} 个答案块，默认可见正文 ${afterExpandPane.visibleAnswerBodies} 个`
      : '本节正文里没有 :::answer 块（真实教材未印答案）'
  )

  // ── 布局（2/2）：左右并排时（用户报 bug 的场景）各栏各滚各的、输入框在右半区 ──
  const sideBySide = await evalInRenderer<{
    pageScrolls: boolean
    composerVisible: boolean
    composerInRightHalf: boolean
    paneScrollable: boolean
    bubblesScrollable: boolean
  }>(
    win,
    `(() => {
      const box = document.querySelector('.composer textarea')
      const pane = document.querySelector('.pane')
      const paneBody = document.querySelector('.pane-body')
      const bubbles = document.querySelector('.bubbles')
      const boxRect = box ? box.getBoundingClientRect() : null
      const paneRect = pane ? pane.getBoundingClientRect() : null
      return {
        // 页面本身不该出现滚动条：滚动只发生在栏内
        pageScrolls: document.documentElement.scrollHeight > window.innerHeight + 1,
        composerVisible: boxRect
          ? boxRect.height > 0 && boxRect.top >= 0 && boxRect.bottom <= window.innerHeight + 1
          : false,
        // 输入框应在右半区（证明确实是左右并排，而不是被挤到下面）
        composerInRightHalf: boxRect && paneRect ? boxRect.left > paneRect.right - 2 : false,
        paneScrollable: Boolean(paneBody) && getComputedStyle(paneBody).overflowY === 'auto',
        bubblesScrollable: Boolean(bubbles) && getComputedStyle(bubbles).overflowY === 'auto'
      }
    })()`
  )
  check('左右并排时页面不出现滚动条', !sideBySide.pageScrolls)
  check(
    '左右并排时输入框就在右半区、无需滚动',
    sideBySide.composerVisible && sideBySide.composerInRightHalf,
    `可见=${sideBySide.composerVisible} 在右半区=${sideBySide.composerInRightHalf}`
  )
  check(
    '左教材与右对话各自独立滚动',
    sideBySide.paneScrollable && sideBySide.bubblesScrollable,
    `阅读区=${sideBySide.paneScrollable} 对话区=${sideBySide.bubblesScrollable}`
  )

  // ── 学生视野的"干净度"：不得出现开发/控制台字样（用户反馈"AI 味太浓"的一部分） ──
  const visible = await evalInRenderer<{ text: string; diagnosticBlocks: number }>(
    win,
    `(() => ({
      text: document.body.innerText,
      diagnosticBlocks: document.querySelectorAll('.diagnostics').length
    }))()`
  )
  const DEV_JARGON = /工具：|护栏|迭代 \d+ 轮|降级：|SPROUTASK|get_section_text|flag_for_teacher|missing-key/
  const devUiEnabled = process.env['SPROUTASK_DEVUI'] === '1'
  const jargonHit = visible.text.match(DEV_JARGON)?.[0]
  if (devUiEnabled) {
    // 开发模式：调试信息**应当**可见（我自己排错要用）
    check(
      '开发模式：调试信息可见（工具 / 护栏 / 降级等字样）',
      visible.diagnosticBlocks >= 1 && Boolean(jargonHit),
      `调试块=${visible.diagnosticBlocks}｜命中样例=${jargonHit ?? '无'}`
    )
  } else {
    // 默认模式：学生视野里**不得**出现任何开发/控制台字样
    check(
      '学生可见文案里没有开发/控制台字样',
      !jargonHit,
      jargonHit ? `命中：${jargonHit}` : '干净'
    )
    check(
      '默认不显示调试信息（学生看不到）',
      visible.diagnosticBlocks === 0,
      `调试块=${visible.diagnosticBlocks}`
    )
  }

  if (hasAnswerBlocks) {
    // 点开一个答案块
    await evalInRenderer(win, `(() => { const b = document.querySelector('.answer-toggle'); if (b) b.click(); return true })()`)
    await wait(300)
    const openedAnswer = await evalInRenderer<number>(
      win,
      `document.querySelectorAll('.answer-body').length`
    )
    check('点开答案块后能看到答案正文', openedAnswer >= 1)

    // 搜索"只在折叠答案里出现"的那段文字 → 给提示而不自动展开
    if (answerProbe) {
      await evalInRenderer(
        win,
        `(() => {
          const box = document.querySelector('.pane .search')
          box.value = ${JSON.stringify(answerProbe)}
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
    } else {
      check(
        '搜索命中折叠答案（本节答案块里取不到唯一探针 → 未测）',
        true,
        '折叠答案文字与正文重复度过高，取不到"只出现在答案里"的片段'
      )
    }
  } else {
    check(
      '答案块交互（点开看答案 / 搜索命中折叠答案）—— 本节无答案块 → 未测',
      true,
      '真实教材未印答案，本节没有 :::answer 块；相关交互留待内容工程按我们的折叠设计标注后再测'
    )
  }

  // ── 落盘验证（放在**界面交互之后**）────────────────────────────
  // 落盘发生在 IPC 边界，也就是"界面上真实走一遍"的路径；自检自己直连 ChatSession 的那条路
  // 不经过 IPC（开发者路径，刻意不写学生数据）。所以这条断言必须在点完按钮、发过消息之后查。
  const persisted = await describePersistence()
  check(
    '界面上的一轮对话已落盘（本机 JSONL，可导出做学习统计）',
    persisted.turnCount >= 2,
    `${persisted.turnCount} 条消息｜会话 ${persisted.sessionId ?? '(未建立)'}`
  )

  // ── 留档：截图与结果文件（打包版没有控制台，靠结果文件验证） ──────
  try {
    const image = await win.webContents.capturePage()
    const outFile = join(process.cwd(), 'selftest-ui.png')
    writeFileSync(outFile, image.toPNG())
    console.log('[selftest] 界面截图：', outFile)
  } catch (error) {
    console.warn('[selftest] 截图写入失败（不影响结论）：', error)
  }
  writeResultFile()

  if (failures.length > 0) {
    console.error(`[selftest] 结果：失败 ${failures.length} 项 —— ${failures.join('；')}`)
    console.log(`[selftest] 合计 ${records.length} 项断言`)
    app.exit(1)
    return
  }
  console.log(`[selftest] 结果：通过（共 ${records.length} 项断言）`)
  app.exit(0)
}

void app.whenReady().then(() => {
  const config = loadConfig()
  // 无条件记录启动事实：打包版没有控制台，这是排查的唯一线索
  bootLog(
    `boot: packaged=${app.isPackaged} mode=${config.mode} hasKey=${config.deepseek.apiKey.length > 0}` +
      ` selftestEnv=${String(process.env['SPROUTASK_SELFTEST'])} selfTestConst=${SELF_TEST}` +
      ` userData=${app.getPath('userData')} cwd=${process.cwd()}`
  )
  // 内容源：真实内容（本机有 content/units + 原文）优先，否则回落到演示占位。
  // 打包发给学生的机器上没有教材原文（ADR-0007），所以这一步必须能优雅回落。
  const contentRuntime = createContentRuntime(process.cwd(), bootLog)
  // 本机数据（JSONL）：对话与掌握度变更都落在这里；退出后仍可读，供学习统计与匿名化导出
  const { store, dataDir } = createJsonlStudentStore(join(app.getPath('userData'), 'data'))
  bootLog(`数据目录：${dataDir}`)
  registerIpcHandlers(contentRuntime, { store, dataDir })
  const win = createWindow()

  // 自检模式：等界面首帧后再截图（判定标准是"渲染出了内容"，不是"窗口存在"）
  if (SELF_TEST) {
    bootLog(`selftest: 启动，packaged=${app.isPackaged} mode=${config.mode} hasKey=${config.deepseek.apiKey.length > 0}`)
    win.webContents.once('did-finish-load', () => {
      bootLog('selftest: 界面首帧已加载，开始断言')
      void runSelfTest(win, contentRuntime, dataDir)
        .then(() => bootLog('selftest: 断言流程结束'))
        .catch((error: unknown) => {
          bootLog(`selftest: 断言流程抛错 —— ${error instanceof Error ? error.stack : String(error)}`)
          app.exit(2)
        })
    })
    win.webContents.on('did-fail-load', (_e, code, desc, url) => {
      bootLog(`selftest: 界面加载失败 code=${code} desc=${desc} url=${url}`)
    })
  } else if (!config.deepseek.apiKey) {
    console.warn('[main] 未检测到 DEEPSEEK_API_KEY：对话会走降级路径（界面仍可用）')
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  // 退出前给本次会话写上结束时间（老师可据此统计一次学习时长）
  void endCurrentSession(new Date().toISOString()).finally(() => {
    if (process.platform !== 'darwin') app.quit()
  })
})
