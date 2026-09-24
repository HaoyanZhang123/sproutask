/**
 * 分层依赖把关（供测试使用）。
 *
 * 规矩：core 层不得依赖宿主框架（electron / vue / pinia）。
 *
 * 为什么单独抽成函数：把关逻辑本身也要被测——早期版本只匹配静态
 * `from 'electron'`，导致以下写法能静默绕过（实测均未被发现）：
 *   动态 import('electron')、require('vue')、from 'electron/main'（子路径）
 * 这里把四类写法与子路径/作用域包一并覆盖，并在 tests/layering-guard.test.ts 里逐条验证。
 */

/** 宿主模块：包名本身、其子路径（electron/...、vue/...）、以及 @vue/* 作用域包 */
const HOST_MODULE = String.raw`(?:electron|vue|pinia)(?:/[^'"]*)?|@vue/[^'"]+`

const VIOLATION_PATTERNS: Array<{ label: string; pattern: RegExp }> = [
  // import ... from 'electron' / export ... from 'vue'
  { label: 'from 静态导入', pattern: new RegExp(String.raw`\bfrom\s+['"](${HOST_MODULE})['"]`, 'g') },
  // import 'electron'（副作用导入）
  { label: 'import 副作用导入', pattern: new RegExp(String.raw`\bimport\s+['"](${HOST_MODULE})['"]`, 'g') },
  // import('electron')（动态导入）
  { label: 'import() 动态导入', pattern: new RegExp(String.raw`\bimport\s*\(\s*['"](${HOST_MODULE})['"]`, 'g') },
  // require('vue')
  { label: 'require()', pattern: new RegExp(String.raw`\brequire\s*\(\s*['"](${HOST_MODULE})['"]`, 'g') }
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
