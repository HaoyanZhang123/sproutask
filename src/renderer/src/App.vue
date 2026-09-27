<script setup lang="ts">
import { computed, onMounted, nextTick, ref } from 'vue'
import ReadingPane from './components/ReadingPane.vue'
import ConfigPanel from './components/ConfigPanel.vue'
// 纯函数模块的白名单例外（见 tests/smoke.test.ts）：渲染进程可直接引用 core 里无依赖的纯逻辑
import { extractCitation } from '@shared/section-blocks'

/**
 * 芽问 SproutAsk 主界面（方案 D：对话 + 可折叠教材阅读视图）。
 *
 * 职责边界：**只做显示与转发**——模式判断、Agent 循环、护栏全在主进程/core，
 * 这里不写教学逻辑，也不接触 API Key。
 *
 * 关于"流式"：本版**不做逐字流式**。护栏可能在回答产出后要求重写，
 * 若已逐字显示则无法撤回，因此这里显示"正在想…"，护栏通过后整段呈现。
 */

interface ModeOption {
  mode: string
  label: string
  hint: string
}

interface Bubble {
  role: 'user' | 'assistant' | 'system'
  text: string
  /** 开发/研究用诊断信息（工具、护栏、降级、迭代轮次） */
  diagnostics?: string[]
}

interface SectionContent {
  unitTitle: string
  edition: string
  grade: string
  sectionTitle: string
  mode: string
  /** 本机有没有教材正文（没有时提示学生对照手里的课本，而不是显示占位文本） */
  hasLocalText: boolean
  /** 印刷页起始页（如"第 28 页"）：正文不在本机时，这是"翻到哪一页"的依据 */
  pageHint: string | null
  /** 内容来源：content＝我们的内容工程产物；demo＝开发期演示占位（必须显式标注） */
  source: 'content' | 'demo'
  blocks: Array<{ type: 'text' | 'think' | 'answer'; title?: string; body: string; index: number }>
  knowledgePoints: Array<{
    id: string
    title: string
    summary: string
    refs: string[]
    misconceptions: string[]
  }>
  curriculumRequirements: string[]
}

/** 复习 / 做题时收起教材区，把屏幕让给对话；预习 / 拓展时展开（2026-09 决策） */
const MODES_WITH_COLLAPSED_READING = ['review', 'practice']

const stage = ref<'loading' | 'choosing' | 'chatting'>('loading')
const openingQuestion = ref('')
const options = ref<ModeOption[]>([])
const bubbles = ref<Bubble[]>([])
const input = ref('')
const thinking = ref(false)
const modeLabel = ref<string | null>(null)
const mode = ref<string | null>(null)
const positionLabel = ref('')
const hasApiKey = ref(true)
/** 是否显示开发用信息（工具调用/护栏/迭代/降级）；默认关闭，`SPROUTASK_DEVUI=1` 打开 */
const devUi = ref(false)
const chooseError = ref('')
const scrollAnchor = ref<HTMLElement | null>(null)

// 教材阅读区
const section = ref<SectionContent | null>(null)
const paneCollapsed = ref(false)
const query = ref('')
const focusToken = ref(0)
const locatedNote = ref('')

const canSend = computed(
  () => stage.value === 'chatting' && !thinking.value && input.value.trim().length > 0
)

/** 首次运行配置 / 设置界面：没配 Key 时自动打开 */
const showConfig = ref(false)

async function scrollToBottom(): Promise<void> {
  await nextTick()
  scrollAnchor.value?.scrollIntoView({ behavior: 'smooth', block: 'end' })
}

onMounted(async () => {
  const status = await window.sproutask.configStatus()
  hasApiKey.value = status.hasApiKey
  devUi.value = status.devUi
  // 没配 Key 就先把"接上外脑"这一步摆在前面（学生打开盒子第一眼要能自己搞定）
  showConfig.value = !status.hasApiKey

  const info = await window.sproutask.sessionStart()
  openingQuestion.value = info.question
  options.value = info.options
  stage.value = 'choosing'
})

/** 配置保存成功：关掉面板并刷新状态（顶部提示条随之消失） */
async function onConfigured(): Promise<void> {
  const status = await window.sproutask.configStatus()
  hasApiKey.value = status.hasApiKey
  showConfig.value = false
}

async function choose(answer: string): Promise<void> {
  chooseError.value = ''
  const result = await window.sproutask.sessionChooseMode(answer)
  if (!result.ok) {
    chooseError.value = result.message
    return
  }
  modeLabel.value = result.modeLabel
  mode.value = result.mode
  positionLabel.value = result.positionLabel
  stage.value = 'chatting'
  bubbles.value.push({
    role: 'system',
    text: `${result.modeLabel} · ${result.positionLabel} —— 现在开始吧，我会提问，不会直接告诉你答案 🌱`
  })
  await loadSection()
  await scrollToBottom()
}

async function loadSection(): Promise<void> {
  section.value = await window.sproutask.sectionContent()
  paneCollapsed.value = MODES_WITH_COLLAPSED_READING.includes(mode.value ?? '')
  query.value = ''
  focusToken.value = 0
  locatedNote.value = ''
}

/** 回复里出现出处时，教材区自动定位并高亮（"答案必须有出处"的落地环节） */
function locateCitation(reply: string): void {
  if (!section.value) return
  const candidates = [
    section.value.sectionTitle,
    section.value.unitTitle,
    ...section.value.sectionTitle.split(/\s+/).filter((part) => part.length > 1)
  ]
  const cited = extractCitation(reply, candidates)
  if (!cited) return
  query.value = cited
  paneCollapsed.value = false
  focusToken.value += 1
  locatedNote.value = `课本里也提到了，我把「${cited}」标出来了`
}

async function send(): Promise<void> {
  const text = input.value.trim()
  if (!text || thinking.value) return

  bubbles.value.push({ role: 'user', text })
  input.value = ''
  thinking.value = true
  await scrollToBottom()

  try {
    const result = await window.sproutask.chat(text)

    if (result.needsMode) {
      bubbles.value.push({ role: 'system', text: result.message ?? '请先选择学习模式' })
      stage.value = 'choosing'
      return
    }

    // 调试信息只在开发模式下构造（学生看到"工具：get_section_text"这种字样会很出戏）
    const diagnostics: string[] = []
    if (devUi.value) {
      if (result.toolCalls?.length) {
        diagnostics.push(
          `工具：${result.toolCalls.map((c) => `${c.name}${c.ok ? '' : '(失败)'}`).join('、')}`
        )
      }
      if (result.flags?.length) diagnostics.push(`标记：${result.flags.join('、')}`)
      if (result.guard?.triggered) {
        diagnostics.push(
          `护栏命中${result.guard.regenerated ? '（已重写）' : ''}：${result.guard.reasons.join('；')}`
        )
      }
      if (result.degraded) diagnostics.push(`降级：${result.degraded.kind}`)
      if (typeof result.iterations === 'number') diagnostics.push(`迭代 ${result.iterations} 轮`)
    }

    bubbles.value.push({ role: 'assistant', text: result.reply ?? '', diagnostics })
    if (result.reply) locateCitation(result.reply)
  } catch (error) {
    // 面向学生只说人话；技术细节留给开发模式
    bubbles.value.push({
      role: 'system',
      text: devUi.value ? `出错了：${String(error)}` : '刚才出了点小状况，再试一次好吗？'
    })
  } finally {
    thinking.value = false
    await scrollToBottom()
  }
}

async function restart(): Promise<void> {
  const info = await window.sproutask.sessionStart()
  openingQuestion.value = info.question
  options.value = info.options
  bubbles.value = []
  modeLabel.value = null
  mode.value = null
  positionLabel.value = ''
  chooseError.value = ''
  section.value = null
  query.value = ''
  locatedNote.value = ''
  stage.value = 'choosing'
}
</script>

<template>
  <main class="app">
    <header class="topbar">
      <div class="brand">
        <span class="logo">🌱</span>
        <div>
          <h1>芽问 <span class="en">SproutAsk</span></h1>
          <p class="sub">初中生物学习伙伴 · 只给线索，不给答案</p>
        </div>
      </div>
      <div class="status">
        <span v-if="modeLabel" class="badge">{{ modeLabel }}</span>
        <span v-if="positionLabel" class="position">{{ positionLabel }}</span>
        <button class="ghost-btn" @click="showConfig = true">设置</button>
        <button class="ghost-btn" @click="restart">换一个模式</button>
      </div>
    </header>

    <!-- 首次运行配置 / 设置：没配 Key 时自动打开，也可随时从顶栏进来 -->
    <ConfigPanel v-if="showConfig" @configured="onConfigured" @skip="showConfig = false" />

    <template v-else>
      <p v-if="!hasApiKey" class="warn">
        ⚠️ 未检测到模型 API Key（开发期请在项目根目录的 <code>.env</code> 中配置）。
        仍可体验流程，但每次提问都会走"连不上外脑"的降级提示。
      </p>

      <!-- 开场：Agent 主动询问，学生四选一 -->
      <section v-if="stage === 'choosing'" class="chat solo">
        <div class="opening">
          <pre class="question">{{ openingQuestion }}</pre>
        <div class="mode-grid">
          <button
            v-for="(option, index) in options"
            :key="option.mode"
            class="mode-card"
            @click="choose(option.label)"
          >
            <span class="mode-index">{{ index + 1 }}</span>
            <span class="mode-label">{{ option.label }}</span>
            <span class="mode-hint">{{ option.hint }}</span>
          </button>
        </div>
        <p class="choose-hint">也可以直接说"我想复习"：</p>
        <div class="choose-input">
          <input v-model="input" placeholder="例如：我想复习" @keyup.enter="choose(input)" />
          <button @click="choose(input)">就这样</button>
        </div>
        <p v-if="chooseError" class="error">{{ chooseError }}</p>
      </div>
    </section>

    <!-- 方案 D：左教材、右对话（复习 / 做题时教材区默认收起） -->
    <div v-else class="workspace" :class="{ stacked: paneCollapsed }">
      <ReadingPane
        v-if="section"
        :section-title="section.sectionTitle"
        :unit-title="section.unitTitle"
        :edition="section.edition"
        :grade="section.grade"
        :blocks="section.blocks"
        :has-local-text="section.hasLocalText"
        :page-hint="section.pageHint"
        :source="section.source"
        :knowledge-points="section.knowledgePoints"
        :curriculum-requirements="section.curriculumRequirements"
        :query="query"
        :collapsed="paneCollapsed"
        :focus-token="focusToken"
        @update:query="(value: string) => (query = value)"
        @toggle-collapse="paneCollapsed = !paneCollapsed"
      />

      <section class="chat">
        <p v-if="locatedNote" class="located">{{ locatedNote }}</p>
        <div class="bubbles">
          <div v-for="(bubble, index) in bubbles" :key="index" :class="['bubble', bubble.role]">
            <div class="text">{{ bubble.text }}</div>
            <ul v-if="bubble.diagnostics?.length" class="diagnostics">
              <li v-for="(line, i) in bubble.diagnostics" :key="i">{{ line }}</li>
            </ul>
          </div>
          <div v-if="thinking" class="bubble assistant thinking">小芽正在想…</div>
          <div ref="scrollAnchor"></div>
        </div>

        <footer class="composer">
          <textarea
            v-model="input"
            rows="2"
            placeholder="想问什么？打完按回车就行"
            @keydown.enter.exact.prevent="send"
          ></textarea>
          <button :disabled="!canSend" @click="send">{{ thinking ? '思考中…' : '发送' }}</button>
        </footer>
      </section>
    </div>
    </template>
  </main>
</template>

<style scoped>
.app {
  display: flex;
  flex-direction: column;
  height: 100vh;
  /* 兜底：页面本身永不出现滚动条；滚动只发生在各栏内部
     （否则内容会把 grid 行撑高，输入框被顶到屏幕外——用户实测报过这个 bug） */
  overflow: hidden;
  font-family: system-ui, -apple-system, 'Segoe UI', 'Microsoft YaHei', sans-serif;
}
.topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 20px;
  border-bottom: 1px solid #e5e7eb;
  background: #fff;
}
.brand {
  display: flex;
  align-items: center;
  gap: 12px;
}
.logo {
  font-size: 26px;
}
h1 {
  margin: 0;
  font-size: 18px;
}
.sub {
  margin: 2px 0 0;
  font-size: 12px;
  color: #6b7280;
}
.en {
  font-size: 13px;
  font-weight: 400;
  color: #6b7280;
  letter-spacing: 0.02em;
}
.status {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 13px;
}
.badge {
  padding: 3px 10px;
  border-radius: 999px;
  background: #dcfce7;
  color: #166534;
  font-weight: 600;
}
.position {
  color: #6b7280;
}
.ghost-btn,
.mode-card,
.composer button,
.choose-input button {
  cursor: pointer;
  border-radius: 8px;
  border: 1px solid #d1d5db;
  background: #fff;
  padding: 7px 12px;
  font-size: 13px;
}
.ghost-btn:hover {
  background: #f3f4f6;
}
.warn {
  margin: 0;
  padding: 10px 20px;
  background: #fef9c3;
  color: #854d0e;
  font-size: 13px;
}
/* 双区：左教材、右对话；收起教材时改为上下堆叠（教材只剩一条细栏） */
.workspace {
  flex: 1;
  display: grid;
  grid-template-columns: minmax(0, 46%) minmax(0, 54%);
  /* ⚠️ 必须约束行高：默认 auto 会被内容撑开，导致"整页滚动、输入框被顶出屏幕"
     （2026-09 用户实测发现的 bug；只有 stacked 那种情况原本写了行高约束） */
  grid-template-rows: minmax(0, 1fr);
  min-height: 0;
}
.workspace.stacked {
  grid-template-columns: minmax(0, 1fr);
  grid-template-rows: auto minmax(0, 1fr);
}
.chat {
  display: flex;
  flex-direction: column;
  min-height: 0;
  min-width: 0;
  overflow: hidden; /* 让 .bubbles 成为唯一滚动容器，输入框固定在底部 */
  background: #f7f8fa;
}
.chat.solo {
  flex: 1;
}
.chat.solo .opening {
  max-width: 860px;
  width: 100%;
  margin: 0 auto;
  padding: 20px;
}
.opening .question {
  white-space: pre-wrap;
  font-family: inherit;
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  padding: 16px;
  font-size: 14px;
  line-height: 1.7;
  margin: 0 0 16px;
}
.mode-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
}
.mode-card {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 14px;
  text-align: left;
  font-size: 14px;
  background: #fff;
}
.mode-card:hover {
  border-color: #16a34a;
  background: #f0fdf4;
}
.mode-index {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: #16a34a;
  color: #fff;
  font-size: 12px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: none;
}
.mode-label {
  font-weight: 600;
}
.mode-hint {
  color: #6b7280;
  font-size: 12px;
  margin-left: auto;
}
.choose-hint {
  margin: 18px 0 6px;
  font-size: 13px;
  color: #6b7280;
}
.choose-input {
  display: flex;
  gap: 8px;
}
.choose-input input {
  flex: 1;
  padding: 9px 12px;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  font-size: 14px;
}
.error {
  color: #b91c1c;
  font-size: 13px;
  margin-top: 8px;
}
.located {
  margin: 0;
  padding: 6px 16px;
  background: #eff6ff;
  color: #1e40af;
  font-size: 12px;
}
.bubbles {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.bubble {
  max-width: 88%;
  padding: 11px 14px;
  border-radius: 12px;
  font-size: 14px;
  line-height: 1.75;
  white-space: pre-wrap;
}
.bubble.user {
  align-self: flex-end;
  background: #16a34a;
  color: #fff;
}
.bubble.assistant {
  align-self: flex-start;
  background: #fff;
  border: 1px solid #e5e7eb;
}
.bubble.system {
  align-self: center;
  background: #eff6ff;
  color: #1e40af;
  font-size: 13px;
  max-width: 100%;
}
.bubble.thinking {
  color: #6b7280;
  font-style: italic;
}
.diagnostics {
  margin: 8px 0 0;
  padding-left: 16px;
  font-size: 12px;
  color: #6b7280;
}
.composer {
  display: flex;
  gap: 10px;
  padding: 12px 16px 16px;
  border-top: 1px solid #e5e7eb;
  background: #fff;
}
.composer textarea {
  flex: 1;
  resize: none;
  padding: 10px 12px;
  border: 1px solid #d1d5db;
  border-radius: 10px;
  font-size: 14px;
  font-family: inherit;
}
.composer button {
  padding: 0 20px;
  background: #16a34a;
  color: #fff;
  border-color: #16a34a;
  font-size: 14px;
  font-weight: 600;
}
.composer button:disabled {
  background: #9ca3af;
  border-color: #9ca3af;
  cursor: default;
}
</style>
