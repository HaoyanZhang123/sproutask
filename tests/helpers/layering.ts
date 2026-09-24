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
