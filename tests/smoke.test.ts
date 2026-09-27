import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { KnowledgePointSchema, MasteryRecordSchema } from '@core/domain'
import { MockLLMClient } from '@core/llm'
import { findLayeringViolations, findRendererViolations, findSharedViolations } from './helpers/layering'

/* ── 领域契约 ─────────────────────────────────────────────── */

describe('领域契约', () => {
  it('合法的知识点能通过校验', () => {
    const kp = KnowledgePointSchema.parse({
      id: 'kp-cell-membrane',
      unitId: 'u-cell-basic-unit',
      title: '细胞膜控制物质进出',
      summary: '细胞膜控制物质进出，有用的物质进入细胞',
      refs: [{ sectionId: 's1' }],
      difficulty: 2
    })
    expect(kp.prerequisites).toEqual([])
    expect(kp.misconceptions).toEqual([])
  })

  it('知识点 id 必须带 kp- 前缀', () => {
    const bad = () =>
      KnowledgePointSchema.parse({
        id: 'cell-membrane',
        unitId: 'u1',
        title: 't',
        summary: 's',
        refs: [{ sectionId: 's1' }],
        difficulty: 1
      })
    expect(bad).toThrow()
  })

  it('学情记录只接受编号形式的学生 id（合规：不存真实姓名）', () => {
    const ok = MasteryRecordSchema.parse({
      studentId: 'S07',
      kpId: 'kp-cell-membrane',
      state: 'exploring',
      updatedAt: new Date().toISOString()
    })
    expect(ok.state).toBe('exploring')

    expect(() =>
      MasteryRecordSchema.parse({
        studentId: '张三',
        kpId: 'kp-x',
        state: 'mastered',
        updatedAt: new Date().toISOString()
      })
    ).toThrow()
  })
})

/* ── LLM 抽象层 ───────────────────────────────────────────── */

describe('MockLLMClient', () => {
  it('按脚本返回，脚本耗尽后给兜底话术而不抛错', async () => {
    const client = new MockLLMClient([
      { content: '你觉得植物是靠什么长大的？', toolCalls: [] }
    ])
    const first = await client.chat([{ role: 'user', content: '细胞的生活是什么' }])
    expect(first.content).toContain('植物')
    expect(first.toolCalls).toEqual([])

    const second = await client.chat([{ role: 'user', content: '再说一次' }])
    expect(second.content).toContain('Mock')
  })
})

/* ── 分层依赖铁律（见 docs/CONVENTIONS.md「依赖与分层」） ─── */

function walk(dir: string): string[] {
  const out: string[] = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) out.push(...walk(full))
    else if (entry.name.endsWith('.ts')) out.push(full)
  }
  return out
}

describe('分层依赖铁律', () => {
  it('core 层不得依赖 electron / vue', () => {
    const offenders: string[] = []

    for (const file of walk('src/core')) {
      const findings = findLayeringViolations(readFileSync(file, 'utf-8'))
      if (findings.length > 0) offenders.push(`${file}（${findings.join('；')}）`)
    }

    expect(offenders, `以下文件违反了 core 层不得依赖宿主能力的约定：\n${offenders.join('\n')}`).toEqual([])
  })

  it('shared 层必须是零依赖纯代码（三层都可引用，所以绝不能引入任何 import）', () => {
    const offenders: string[] = []
    for (const file of walk('src/shared')) {
      const findings = findSharedViolations(readFileSync(file, 'utf-8'))
      if (findings.length > 0) offenders.push(`${file}（${findings.join('；')}）`)
    }
    expect(
      offenders,
      `src/shared 只放不带依赖的纯函数；以下文件引入了依赖：\n${offenders.join('\n')}`
    ).toEqual([])
  })

  it('渲染进程不得直接引 core / main（唯一允许的共享代码是 src/shared）', () => {
    // .vue 也要查：只遍历 .ts 会漏掉界面里的越层引用
    const rendererFiles = [
      ...walk('src/renderer/src'),
      ...listFilesRecursive('src/renderer/src', '.vue')
    ]
    const offenders: string[] = []
    for (const file of rendererFiles) {
      const findings = findRendererViolations(readFileSync(file, 'utf-8'))
      if (findings.length > 0) offenders.push(`${file}（${findings.join('；')}）`)
    }
    expect(
      offenders,
      `渲染进程只能通过 preload 暴露的 API 拿数据；共享纯逻辑请放 src/shared：\n${offenders.join('\n')}`
    ).toEqual([])
  })
})

/** 递归列出指定扩展名的文件（含 .vue 等非 .ts 文件） */
function listFilesRecursive(dir: string, extension: string): string[] {
  const out: string[] = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) out.push(...listFilesRecursive(full, extension))
    else if (entry.name.endsWith(extension)) out.push(full)
  }
  return out
}

describe('把关逻辑自身（防止"测试没测到点上"）', () => {
  const bypasses: Array<[string, string]> = [
    ['静态 from', `import { app } from 'electron'`],
    ['export from', `export * from 'vue'`],
    ['副作用 import', `import 'vue'`],
    ['动态 import()', `await import('electron')`],
    ['require()', `const vue = require('vue')`],
    ['子路径', `import { app } from 'electron/main'`],
    ['作用域包', `import { ref } from '@vue/reactivity'`],
    ['pinia', `import { createPinia } from 'pinia'`],
    // 以下由独立审核员实测为"旧版可绕过"，必须持续覆盖
    ['模板字符串 import()', 'await import(`electron`)'],
    ['模板字符串 require()', 'const v = require(`vue`)'],
    ['import() 带注释', `await import(/* @vite-ignore */ 'electron')`],
    ['require() 带注释', `const v = require(/* c */ 'vue')`],
    ['require.resolve()', `const p = require.resolve('electron')`],
    ['换行书写', `import {\n  app\n} from 'electron'`]
  ]

  it.each(bypasses)('能抓出绕过写法：%s', (_label, source) => {
    expect(findLayeringViolations(source).length).toBeGreaterThan(0)
  })

  it('不误伤合法写法（相对路径 / 别名 / 无关注释）', () => {
    const legal = [
      `import { z } from 'zod'`,
      `import type { StudyScope } from '../content'`,
      `import { buildMessages } from '@core/prompts'`,
      `// 规矩：core 不得 import electron / vue（注释里提到不算违规）`
    ]
    for (const source of legal) {
      expect(findLayeringViolations(source)).toEqual([])
    }
  })
})

describe('把关逻辑自身：渲染进程越层（含审计实测的漏网写法）', () => {
  const bypasses: Array<[string, string]> = [
    ['别名 @core', `import type { Turn } from '@core/domain'`],
    ['别名 @main', `import { x } from '@main/ipc'`],
    ['相对两级 ../../core', `import { x } from '../../core/domain'`],
    // 以下四条是 2026-09 独立审计实测"旧版可绕过"，必须持续覆盖
    ['相对三级 ../../../core（components/ 下正好够到 src/core）', `import { x } from '../../../core/domain'`],
    ['相对四级 ../../../../core', `import { x } from '../../../../core'`],
    ['动态 import()', `const m = await import('../../core/domain')`],
    ['副作用 import（没有 from）', `import '../../core/domain'`],
    ['export ... from', `export * from '../../core/domain'`],
    ['require()', `const m = require('../../../core/domain')`],
    ['绝对路径', `import { x } from 'E:/proj/src/core/domain'`]
  ]

  it.each(bypasses)('能抓出绕过写法：%s', (_label, source) => {
    expect(findRendererViolations(source).length).toBeGreaterThan(0)
  })

  it('不误伤合法写法（vue/pinia/@shared/@renderer/本地相对路径）', () => {
    const legal = [
      `import { ref } from 'vue'`,
      `import { createPinia } from 'pinia'`,
      `import { extractCitation } from '@shared/section-blocks'`,
      `import App from './App.vue'`,
      `import Pane from '../components/ReadingPane.vue'`,
      `import './styles/base.css'`,
      `import { x } from './core/local-helper'`, // renderer 自己的 core 子目录，不是越层
      `import { y } from '../../core-utils/helper'`, // 名字像但不是 core 目录
      `// 注释里举例：import { x } from '../../core/domain'（注释不算违规）`
    ]
    for (const source of legal) {
      expect(findRendererViolations(source), source).toEqual([])
    }
  })
})

describe('把关逻辑自身：shared 零依赖（含审计实测的漏网写法）', () => {
  const bypasses: Array<[string, string]> = [
    ['静态 import', `import { ref } from 'vue'`],
    ['副作用 import', `import 'vue'`],
    // 以下三条是 2026-09 独立审计实测"旧版可绕过"，必须持续覆盖
    ['export ... from', `export { ref } from 'vue'`],
    ['export * from', `export * from 'vue'`],
    ['动态 import()', `const v = await import('vue')`],
    ['require()', `const v = require('vue')`],
    ['带注释的动态 import', `const v = await import(/* @vite-ignore */ 'vue')`]
  ]

  it.each(bypasses)('能抓出绕过写法：%s', (_label, source) => {
    expect(findSharedViolations(source).length).toBeGreaterThan(0)
  })

  it('不误伤纯函数与注释', () => {
    const legal = [
      `export function parse(text: string): string[] { return text.split('\\n') }`,
      `const s = 'import { ref } from vue 只是字符串'`,
      `// 这里不许 import 任何东西（注释里提到不算违规）`
    ]
    for (const source of legal) {
      expect(findSharedViolations(source), source).toEqual([])
    }
  })
})
