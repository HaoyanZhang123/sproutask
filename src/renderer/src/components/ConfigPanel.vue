<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'

/**
 * 首次运行配置 / 设置。
 *
 * 面向的是**老师或家长**（不是学生）：所以说清技术原因是帮忙而不是添乱
 * （学生侧的降级话术另有一套，见 core 的 LLMError.toStudentMessage）。
 *
 * 两条红线：
 *   1. Key 只从界面**流向**主进程，永不回显——连掩码都不显示（掩码也是密钥信息）
 *   2. 不写 `.env`；保存到系统用户目录（打包版唯一可行位置）
 */

const emit = defineEmits<{ (e: 'configured'): void; (e: 'skip'): void }>()

const apiKey = ref('')
const baseUrl = ref('')
const model = ref('')
const showAdvanced = ref(false)
const message = ref('')
const messageKind = ref<'idle' | 'ok' | 'error' | 'busy'>('idle')
const testing = ref(false)
const saving = ref(false)

const info = ref<{
  mode: string
  keySource: 'userconfig' | 'env' | 'none'
  hasApiKey: boolean
  userConfigPath: string
  userConfigError?: string
  baseUrl: string
  model: string
} | null>(null)

const isDev = computed(() => info.value?.mode === 'dev')
const sourceLabel = computed(() => {
  switch (info.value?.keySource) {
    case 'userconfig':
      return '已配置（来自本机保存的配置）'
    case 'env':
      return '已配置（来自项目根目录的 .env）'
    default:
      return '还没有配置'
  }
})
const canSubmit = computed(() => apiKey.value.trim().length >= 10 && !testing.value && !saving.value)

async function refresh(): Promise<void> {
  info.value = await window.sproutask.configDescribe()
  baseUrl.value = info.value.baseUrl
  model.value = info.value.model
}

onMounted(refresh)

async function test(): Promise<void> {
  testing.value = true
  messageKind.value = 'busy'
  message.value = '正在试连…'
  try {
    const result = await window.sproutask.configTest({
      apiKey: apiKey.value.trim() || undefined,
      baseUrl: baseUrl.value.trim() || undefined,
      model: model.value.trim() || undefined
    })
    messageKind.value = result.ok ? 'ok' : 'error'
    message.value = result.message
  } catch (error) {
    messageKind.value = 'error'
    message.value = `试连时出错了：${String(error)}`
  } finally {
    testing.value = false
  }
}

async function save(): Promise<void> {
  saving.value = true
  try {
    const result = await window.sproutask.configSave({
      apiKey: apiKey.value.trim(),
      baseUrl: baseUrl.value.trim() || undefined,
      model: model.value.trim() || undefined
    })
    if (!result.ok) {
      messageKind.value = 'error'
      message.value = result.message
      return
    }
    messageKind.value = 'ok'
    message.value = `${result.message}。可以开始用了 🌱`
    await refresh()
    emit('configured')
  } catch (error) {
    messageKind.value = 'error'
    message.value = `保存时出错了：${String(error)}`
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <section class="config">
    <div class="card">
      <h2>先接上"外脑"</h2>
      <p class="lead">
        芽问自己不会思考，它把思考交给 DeepSeek。需要填一个 API Key
        （在 <code>platform.deepseek.com</code> 的「API Keys」里创建，先充 10 元就够用很久）。
      </p>

      <p v-if="info?.userConfigError" class="warn-line">⚠️ {{ info.userConfigError }}</p>
      <p v-else class="state-line">当前状态：{{ sourceLabel }}</p>

      <label class="field">
        <span class="label">API Key</span>
        <input
          v-model="apiKey"
          class="input key-input"
          type="password"
          placeholder="sk-……（粘贴后不会显示出来，这是故意的）"
          autocomplete="off"
          spellcheck="false"
          @keyup.enter="canSubmit && save()"
        />
      </label>

      <p class="tip">
        保存后只存在这台电脑上，不会上传，也不会写进项目文件夹。
        <button class="link" @click="showAdvanced = !showAdvanced">
          {{ showAdvanced ? '收起高级设置' : '高级设置（一般不用改）' }}
        </button>
      </p>

      <div v-if="showAdvanced" class="advanced">
        <label class="field">
          <span class="label">接口地址</span>
          <input v-model="baseUrl" class="input" spellcheck="false" />
        </label>
        <label class="field">
          <span class="label">模型名</span>
          <input v-model="model" class="input" spellcheck="false" />
        </label>
      </div>

      <p v-if="isDev" class="dev-note">
        提示：你现在是开发模式（<code>pnpm dev</code>），程序读的是项目根目录的 <code>.env</code>；
        这里保存的配置**只在打包后的版本里生效**。
      </p>

      <div class="actions">
        <button class="primary save-btn" :disabled="!canSubmit" @click="save">
          {{ saving ? '保存中…' : '保存并开始' }}
        </button>
        <button class="ghost test-btn" :disabled="testing" @click="test">
          {{ testing ? '试连中…' : '先试连一下' }}
        </button>
        <button class="ghost skip-btn" @click="emit('skip')">稍后再说</button>
      </div>

      <p v-if="message" :class="['message', messageKind]">{{ message }}</p>

      <p class="path">配置文件位置：<code>{{ info?.userConfigPath }}</code></p>
    </div>
  </section>
</template>

<style scoped>
.config {
  flex: 1;
  overflow-y: auto;
  display: flex;
  justify-content: center;
  padding: 28px 20px;
  background: #f7f8fa;
}
.card {
  width: 100%;
  max-width: 620px;
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 14px;
  padding: 22px 24px 18px;
  align-self: flex-start;
}
h2 {
  margin: 0 0 8px;
  font-size: 18px;
}
.lead {
  margin: 0 0 14px;
  font-size: 13.5px;
  line-height: 1.8;
  color: #374151;
}
code {
  background: #f3f4f6;
  padding: 1px 5px;
  border-radius: 5px;
  font-size: 12.5px;
}
.state-line,
.warn-line {
  margin: 0 0 12px;
  font-size: 13px;
}
.state-line {
  color: #166534;
}
.warn-line {
  color: #b45309;
}
.field {
  display: block;
  margin-bottom: 10px;
}
.label {
  display: block;
  font-size: 12.5px;
  color: #6b7280;
  margin-bottom: 4px;
}
.input {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid #d1d5db;
  border-radius: 9px;
  font-size: 14px;
  font-family: inherit;
  box-sizing: border-box;
}
.tip {
  margin: 6px 0 12px;
  font-size: 12.5px;
  color: #6b7280;
  line-height: 1.7;
}
.advanced {
  border-top: 1px dashed #e5e7eb;
  padding-top: 10px;
  margin-bottom: 6px;
}
.dev-note {
  margin: 0 0 12px;
  padding: 8px 10px;
  background: #fffbeb;
  border: 1px solid #fde68a;
  border-radius: 8px;
  font-size: 12.5px;
  color: #92400e;
  line-height: 1.7;
}
.actions {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}
button {
  cursor: pointer;
  border-radius: 9px;
  border: 1px solid #d1d5db;
  background: #fff;
  padding: 9px 14px;
  font-size: 13.5px;
}
button:disabled {
  opacity: 0.55;
  cursor: default;
}
.primary {
  background: #16a34a;
  border-color: #16a34a;
  color: #fff;
  font-weight: 600;
}
.link {
  border: none;
  background: none;
  padding: 0;
  color: #2563eb;
  font-size: 12.5px;
  text-decoration: underline;
}
.message {
  margin: 12px 0 0;
  font-size: 13px;
  line-height: 1.7;
}
.message.ok {
  color: #166534;
}
.message.error {
  color: #b91c1c;
}
.message.busy {
  color: #6b7280;
}
.path {
  margin: 14px 0 0;
  font-size: 12px;
  color: #9ca3af;
  word-break: break-all;
}
</style>
