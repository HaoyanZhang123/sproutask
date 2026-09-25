<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
// 允许渲染进程直接引用的**唯一例外**：src/shared 里的零依赖纯函数（见 tests/smoke.test.ts 的把关）
import {
  countMatches,
  matchesOnlyInCollapsed,
  splitHighlights
} from '@shared/section-blocks'

/**
 * 教材阅读视图。
 *
 * 设计要点：
 *   - **不用 v-html**：区块由主进程解析好传过来，这里只用模板渲染 → 无 XSS 面
 *   - 答案块**默认收起**："先自己答、再展开对照"是这套产品的教学核心动作
 *   - 搜索高亮：命中在折叠答案里时只提示、不自动展开（避免把答案主动推给学生）
 *   - 出处联动：父组件把回复里识别到的出处词当作 query 并递增 focusToken，这里滚动到首个命中
 */

interface Block {
  type: 'text' | 'think' | 'answer'
  title?: string
  body: string
  index: number
}

interface KnowledgePoint {
  id: string
  title: string
  summary: string
  refs: string[]
  misconceptions: string[]
}

const props = defineProps<{
  sectionTitle: string
  unitTitle: string
  edition: string
  grade: string
  blocks: Block[]
  knowledgePoints: KnowledgePoint[]
  curriculumRequirements: string[]
  query: string
  collapsed: boolean
  focusToken: number
}>()

const emit = defineEmits<{
  (e: 'update:query', value: string): void
  (e: 'toggle-collapse'): void
}>()

const container = ref<HTMLElement | null>(null)
const expandedAnswers = ref<number[]>([])
const showPoints = ref(false)

const answerBlocks = computed(() => props.blocks.filter((b) => b.type === 'answer'))
const totalMatches = computed(() => countMatches(props.blocks, props.query))
const collapsedOnly = computed(() => matchesOnlyInCollapsed(props.blocks, props.query))

function isExpanded(index: number): boolean {
  return expandedAnswers.value.includes(index)
}

function toggleAnswer(index: number): void {
  expandedAnswers.value = isExpanded(index)
    ? expandedAnswers.value.filter((i) => i !== index)
    : [...expandedAnswers.value, index]
}

/** 展开所有"含命中词"的折叠答案（学生主动搜索时才用） */
function expandMatchedAnswers(): void {
  const needle = props.query.trim().toLowerCase()
  if (!needle) return
  const hits = answerBlocks.value
    .filter((b) => b.body.toLowerCase().includes(needle))
    .map((b) => b.index)
  expandedAnswers.value = [...new Set([...expandedAnswers.value, ...hits])]
  void scrollToFirstHit()
}

function expandAllAnswers(): void {
  expandedAnswers.value = answerBlocks.value.map((b) => b.index)
}

function collapseAllAnswers(): void {
  expandedAnswers.value = []
}

/** 滚动到第一个高亮处（出处联动 / 搜索后调用） */
async function scrollToFirstHit(): Promise<void> {
  await nextTick()
  const hit = container.value?.querySelector('.hit')
  hit?.scrollIntoView({ behavior: 'smooth', block: 'center' })
}

function segments(text: string): Array<{ text: string; hit: boolean }> {
  return splitHighlights(text, props.query)
}

// 父组件识别到出处后递增 focusToken → 这里滚过去
watch(
  () => props.focusToken,
  (token) => {
    if (token > 0) void scrollToFirstHit()
  }
)
</script>

<template>
  <aside class="pane" :class="{ collapsed }">
    <header class="pane-head">
      <div class="titles">
        <span class="section-title">{{ sectionTitle }}</span>
        <span class="meta">{{ edition }} · {{ grade }}</span>
      </div>
      <button class="ghost" @click="emit('toggle-collapse')">
        {{ collapsed ? '展开教材' : '收起教材' }}
      </button>
    </header>

    <template v-if="!collapsed">
      <div class="search-row">
        <input
          :value="query"
          class="search"
          type="search"
          placeholder="在教材里找一找（关键词）"
          @input="emit('update:query', ($event.target as HTMLInputElement).value)"
        />
        <span v-if="query.trim()" class="match-info">
          命中 {{ totalMatches }} 处
        </span>
      </div>

      <p v-if="query.trim() && collapsedOnly" class="hint collapsed-hint">
        命中都在折叠的答案里：
        <button class="link" @click="expandMatchedAnswers">展开看看</button>
      </p>

      <div ref="container" class="pane-body">
        <template v-for="block in blocks" :key="block.index">
          <!-- 普通正文 -->
          <p v-if="block.type === 'text'" class="para">
            <span
              v-for="(seg, i) in segments(block.body)"
              :key="i"
              :class="{ hit: seg.hit }"
              >{{ seg.text }}</span
            >
          </p>

          <!-- 想一想 / 讨论 -->
          <div v-else-if="block.type === 'think'" class="think">
            <span class="think-title">💭 {{ block.title }}</span>
            <p class="para">
              <span
                v-for="(seg, i) in segments(block.body)"
                :key="i"
                :class="{ hit: seg.hit }"
                >{{ seg.text }}</span
              >
            </p>
          </div>

          <!-- 答案：默认收起，点开才能看 -->
          <div v-else class="answer" :data-answer-index="block.index">
            <button class="answer-toggle" @click="toggleAnswer(block.index)">
              {{ isExpanded(block.index) ? '▾' : '▸' }}
              {{ isExpanded(block.index) ? '收起答案' : '先自己想一想，再展开对照' }}
            </button>
            <p v-if="isExpanded(block.index)" class="para answer-body">
              <span
                v-for="(seg, i) in segments(block.body)"
                :key="i"
                :class="{ hit: seg.hit }"
                >{{ seg.text }}</span
              >
            </p>
          </div>
        </template>
      </div>

      <div class="pane-foot">
        <div class="answer-tools">
          <button class="link" @click="expandAllAnswers">展开全部答案</button>
          <span class="dot">·</span>
          <button class="link" @click="collapseAllAnswers">全部收起</button>
          <span class="dot">·</span>
          <button class="link" @click="showPoints = !showPoints">
            {{ showPoints ? '隐藏本节知识点' : '看本节知识点' }}
          </button>
        </div>

        <div v-if="showPoints" class="points">
          <ul>
            <li v-for="kp in knowledgePoints" :key="kp.id">
              <strong>{{ kp.title }}</strong>：{{ kp.summary }}
              <span class="ref">（出处：{{ kp.refs.join('、') }}）</span>
            </li>
          </ul>
          <p v-if="curriculumRequirements.length" class="curriculum">
            课程标准要求：{{ curriculumRequirements.join('；') }}
          </p>
        </div>
      </div>
    </template>
  </aside>
</template>

<style scoped>
.pane {
  display: flex;
  flex-direction: column;
  min-width: 0;
  background: #fff;
  border-right: 1px solid #e5e7eb;
}
.pane.collapsed {
  flex: none;
  width: 100%;
  border-right: none;
  border-bottom: 1px solid #e5e7eb;
}
.pane-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 10px 14px;
  border-bottom: 1px solid #f3f4f6;
}
.titles {
  display: flex;
  flex-direction: column;
  min-width: 0;
}
.section-title {
  font-size: 14px;
  font-weight: 700;
  color: #111827;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.meta {
  font-size: 11px;
  color: #9ca3af;
}
.ghost {
  flex: none;
  cursor: pointer;
  border: 1px solid #d1d5db;
  background: #fff;
  border-radius: 7px;
  padding: 4px 9px;
  font-size: 12px;
}
.ghost:hover {
  background: #f3f4f6;
}
.search-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 14px 4px;
}
.search {
  flex: 1;
  min-width: 0;
  padding: 6px 10px;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  font-size: 13px;
}
.match-info {
  flex: none;
  font-size: 12px;
  color: #6b7280;
}
.hint {
  margin: 4px 14px 0;
  font-size: 12px;
  color: #92400e;
  background: #fef9c3;
  border-radius: 6px;
  padding: 5px 8px;
}
.pane-body {
  flex: 1;
  overflow-y: auto;
  padding: 10px 14px 14px;
}
.para {
  margin: 0 0 10px;
  font-size: 13.5px;
  line-height: 1.85;
  color: #1f2937;
  white-space: pre-wrap;
}
.think {
  margin: 0 0 12px;
  padding: 9px 11px;
  border-left: 3px solid #f59e0b;
  background: #fffbeb;
  border-radius: 0 8px 8px 0;
}
.think-title {
  display: inline-block;
  font-size: 12px;
  font-weight: 700;
  color: #92400e;
  margin-bottom: 2px;
}
.think .para {
  margin: 0;
}
.answer {
  margin: 0 0 12px;
}
.answer-toggle {
  cursor: pointer;
  width: 100%;
  text-align: left;
  border: 1px dashed #a7f3d0;
  background: #f0fdf4;
  color: #166534;
  border-radius: 8px;
  padding: 6px 10px;
  font-size: 12.5px;
}
.answer-toggle:hover {
  background: #dcfce7;
}
.answer-body {
  margin: 6px 0 0;
  padding: 8px 11px;
  background: #f0fdf4;
  border-radius: 8px;
  color: #14532d;
}
.hit {
  background: #fde68a;
  border-radius: 3px;
  padding: 0 1px;
}
.pane-foot {
  border-top: 1px solid #f3f4f6;
  padding: 8px 14px 10px;
}
.answer-tools {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
}
.link {
  border: none;
  background: none;
  color: #2563eb;
  cursor: pointer;
  padding: 0;
  font-size: 12px;
  text-decoration: underline;
}
.dot {
  color: #d1d5db;
}
.points {
  margin-top: 8px;
  font-size: 12.5px;
  color: #374151;
}
.points ul {
  margin: 0;
  padding-left: 18px;
}
.points li {
  margin-bottom: 4px;
  line-height: 1.6;
}
.ref {
  color: #9ca3af;
}
.curriculum {
  margin: 6px 0 0;
  color: #6b7280;
}
</style>
