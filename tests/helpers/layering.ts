/**
 * 分层依赖把关（供测试使用）。
 *
 * 规矩：core 层不得依赖宿主框架（electron / vue / pinia）。
 *
 * 为什么单独抽成函数：把关逻辑本身也要被测——早期版本只匹配静态
 * `from 'electron'`，以下写法都能静默绕过（均由独立审核员实测复现）：
 *   动态 import('electron')、import(`electron`)（模板字符串）、
 *   require('vue')、require(`vue`)、require.resolve('electron')、
 *   import(/* @vite-ignore *​/ 'electron')（带注释）、from 'electron/main'（子路径）
 * 这里把四类语法 + 引号变体 + 中间注释 + 子路径/作用域包一并覆盖，
 * 逐条验证在 tests/smoke.test.ts 的「把关逻辑自身」一节。
 */

/** 宿主模块：包名本身、其子路径（electron/...、vue/...）、以及 @vue/* 作用域包 */
const HOST_MODULE = String.raw`(?:electron|vue|pinia)(?:/[^'"\`]*)?|@vue/[^'"\`]+`

/** 引号三种变体：单引号、双引号、模板字符串 */
const QUOTE = `['"\`]`

/** 允许括号与字符串之间插入空白或注释（`import(/* x *​/ 'electron')`） */
const GAP = String.raw`(?:\s|/\*[\s\S]*?\*/|//[^\n]*)*`

const VIOLATION_PATTERNS: Array<{ label: string; pattern: RegExp }> = [
  // import ... from 'electron' / export ... from 'vue'
  { label: 'from 静态导入', pattern: new RegExp(String.raw`\bfrom\s+${GAP}${QUOTE}(${HOST_MODULE})${QUOTE}`, 'g') },
  // import 'electron'（副作用导入）
  { label: 'import 副作用导入', pattern: new RegExp(String.raw`\bimport\s+${GAP}${QUOTE}(${HOST_MODULE})${QUOTE}`, 'g') },
  // import('electron') / import(`electron`) / import(/* c */ 'electron')（动态导入）
  { label: 'import() 动态导入', pattern: new RegExp(String.raw`\bimport\s*\(\s*${GAP}${QUOTE}(${HOST_MODULE})${QUOTE}`, 'g') },
  // require('vue') / require.resolve('electron')
  { label: 'require()', pattern: new RegExp(String.raw`\brequire(?:\.resolve)?\s*\(\s*${GAP}${QUOTE}(${HOST_MODULE})${QUOTE}`, 'g') }
]

/** 返回命中的违规描述（空数组表示干净） */
export function findLayeringViolations(source: string): string[] {
  const findings: string[] = []
  for (const { label, pattern } of VIOLATION_PATTERNS) {
    pattern.lastIndex = 0
    for (const match of source.matchAll(pattern)) {
      findings.push(`${label}：${match[1]}`)
    }
  }
  return findings
}

/* ── renderer / shared 两条规则 ─────────────────────────────────────────
 *
 * 为什么单独抽成函数（2026-09 独立审计实测复现的漏网路径）：
 *   旧版把关写成藏在 tests/smoke.test.ts 里的两条内联正则，漏掉了——
 *     renderer：`../../../core/domain`（任意深度的相对路径越层）、
 *               `import('../../core/domain')`（动态导入）、
 *               `import '../../core/domain'`（副作用导入，没有 from）
 *     shared  ：`export { x } from 'vue'` / `export * from 'vue'`（转出即依赖）、
 *               `await import('vue')`（动态导入）
 *   这里改成"先抽出所有模块说明符，再逐条判定"，四种写法（静态/副作用/动态/require）
 *   与 export ... from 一次覆盖，并且**先去掉注释**，避免注释里的示例造成误判。
 */

/** 去掉注释后的代码文本（字符串内部原样保留） */
function stripComments(source: string): string {
  let out = ''
  let i = 0
  let quote: string | null = null

  while (i < source.length) {
    const ch = source.charAt(i)
    const next = source.charAt(i + 1)

    if (quote) {
      out += ch
      if (ch === '\\') {
        out += next
        i += 2
        continue
      }
      if (ch === quote) quote = null
      i += 1
      continue
    }

    if (ch === "'" || ch === '"' || ch === '`') {
      quote = ch
      out += ch
      i += 1
      continue
    }

    // 行注释：整行丢弃（换行保留，行号不错位）
    if (ch === '/' && next === '/') {
      while (i < source.length && source.charAt(i) !== '\n') i += 1
      continue
    }

    // 块注释：整段丢弃
    if (ch === '/' && next === '*') {
      i += 2
      while (i < source.length && !(source.charAt(i) === '*' && source.charAt(i + 1) === '/')) i += 1
      i += 2
      continue
    }

    out += ch
    i += 1
  }

  return out
}

/**
 * 抽出所有"模块说明符"（引号/模板字符串里的那段路径）。
 * 覆盖：`import x from 'p'`、`export * from 'p'`、`import 'p'`、
 *       `import('p')`、`require('p')`、`require.resolve('p')`
 */
function extractSpecifiers(source: string): string[] {
  const code = stripComments(source)
  const patterns = [
    new RegExp(String.raw`\bfrom\s+${GAP}${QUOTE}(.+?)${QUOTE}`, 'g'),
    new RegExp(String.raw`\bimport\s+${GAP}${QUOTE}(.+?)${QUOTE}`, 'g'),
    new RegExp(String.raw`\bimport\s*\(\s*${GAP}${QUOTE}(.+?)${QUOTE}`, 'g'),
    new RegExp(String.raw`\brequire(?:\.resolve)?\s*\(\s*${GAP}${QUOTE}(.+?)${QUOTE}`, 'g')
  ]

  const specifiers: string[] = []
  for (const pattern of patterns) {
    pattern.lastIndex = 0
    for (const match of code.matchAll(pattern)) {
      const specifier = (match[1] ?? '').trim()
      if (specifier) specifiers.push(specifier)
    }
  }
  return specifiers
}

/** 该说明符是否指向 core / main（渲染进程唯一的越层红线） */
function isCoreOrMainSpecifier(specifier: string): boolean {
  // 别名：构建配置里 renderer 只有 @renderer / @shared，出现 @core / @main 必是越层
  if (/^@(?:core|main)(?:\/|$)/.test(specifier)) return true
  // 相对路径越层：任意深度的 ../ 之后落到 core / main（正反斜杠都算）
  if (/^(?:\.\.[\\/])+(?:core|main)(?:[\\/]|$)/.test(specifier)) return true
  // 绝对路径里出现 src/core 或 src/main
  if (/[\\/]src[\\/](?:core|main)(?:[\\/]|$)/.test(specifier)) return true
  return false
}

/** 渲染进程不得直接引 core / main（唯一允许的共享代码是 src/shared） */
export function findRendererViolations(source: string): string[] {
  return extractSpecifiers(source)
    .filter((specifier) => isCoreOrMainSpecifier(specifier))
    .map((specifier) => `越层引用 core/main：${specifier}`)
}

/** shared 层必须零依赖：任何形式的导入/转出都算违规 */
export function findSharedViolations(source: string): string[] {
  return extractSpecifiers(source).map((specifier) => `引入了依赖：${specifier}`)
}
