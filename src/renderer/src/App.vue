<script setup lang="ts">
import { ref } from 'vue'

/**
 * M0 冒烟界面：验证「渲染进程 → preload → 主进程」链路。
 * M3 起会被真正的对话界面替换，此处不必美化。
 */
const result = ref('')
const loading = ref(false)

async function testIpc(): Promise<void> {
  loading.value = true
  try {
    const res = await window.biobuddy.ping('hello from renderer')
    result.value = JSON.stringify(res, null, 2)
  } catch (err) {
    result.value = `IPC 调用失败：${String(err)}`
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <main class="shell">
    <h1>BioBuddy 🌱</h1>
    <p class="subtitle">本地优先的初中生物学习 Agent —— M0 骨架</p>

    <button :disabled="loading" @click="testIpc">
      {{ loading ? '调用中…' : '测试 IPC 链路' }}
    </button>

    <pre v-if="result" class="result">{{ result }}</pre>

    <p class="hint">
      若上方能看到 <code>pong: hello from renderer</code>，说明主进程 / 预加载 / 渲染三层已打通。
    </p>
  </main>
</template>

<style scoped>
.shell {
  max-width: 720px;
  margin: 0 auto;
  padding: 48px 24px;
  font-family: system-ui, -apple-system, 'Segoe UI', 'Microsoft YaHei', sans-serif;
}
h1 {
  margin: 0 0 4px;
  font-size: 28px;
}
.subtitle {
  margin: 0 0 28px;
  color: #6b7280;
}
button {
  padding: 10px 20px;
  font-size: 15px;
  color: #fff;
  background: #16a34a;
  border: none;
  border-radius: 8px;
  cursor: pointer;
}
button:disabled {
  background: #9ca3af;
  cursor: default;
}
.result {
  margin-top: 20px;
  padding: 16px;
  background: #f3f4f6;
  border-radius: 8px;
  font-size: 13px;
  line-height: 1.6;
}
.hint {
  margin-top: 24px;
  color: #6b7280;
  font-size: 14px;
}
</style>
