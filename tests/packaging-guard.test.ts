import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

/**
 * 打包配置的合规把关（2026-09-27 新增）。
 *
 * 为什么需要：`content/textbook/` 放的是**教材原文**（版权物，许可写明"仅供个人学习、
 * 未经授权不得另做他用"）。决策见 `docs/adr/ADR-0007`：原文只在本机，
 * **不随包分发、不进公开仓库**。
 *
 * 这条规则原本只是"口头纪律"——而 `electron-builder.yml` 里一度真的有
 * `extraResources: from: content`（一旦真教材入库，打包就会把原文塞进发给学生的 exe）。
 * 所以把它变成一条会失败的测试：想改规则，必须先改这里并说明理由。
 */

const yml = readFileSync('electron-builder.yml', 'utf-8')

/**
 * 只看**生效的配置行**（去掉以 # 开头的注释行）：
 * 规则针对的是配置本身；注释里为了说明"为什么禁止"，本来就需要提到 content/textbook 这些词。
 */
const activeYml = yml
  .split(/\r?\n/)
  .filter((line) => !/^\s*#/.test(line))
  .join('\n')

describe('打包配置的合规把关（教材原文不随包）', () => {
  it('不得把 content/ 整体映射进安装包（教材原文是版权物，只在本机）', () => {
    const wholesale = /^\s*-\s*from:\s*content\s*$/m.test(activeYml)
    expect(
      wholesale,
      'electron-builder.yml 里出现了 `from: content`：这会把 content/textbook/（教材原文）' +
        '一起打进分发包。要随包只能单独映射 content/units/；决策见 docs/adr/ADR-0007。'
    ).toBe(false)
  })

  it('生效配置里不得引用 content/textbook', () => {
    expect(activeYml).not.toContain('content/textbook')
  })
})

describe('打包产物命名（便携版与安装版不得同名）', () => {
  it('nsis 的 artifactName 必须与 win 的不同（两者都是 .exe）', () => {
    const winName = /^win:[\s\S]*?artifactName:\s*(\S+)/m.exec(yml)?.[1]
    const nsisName = /^nsis:[\s\S]*?artifactName:\s*(\S+)/m.exec(yml)?.[1]
    expect(winName).toBeTruthy()
    expect(nsisName).toBeTruthy()
    expect(nsisName).not.toBe(winName)
  })
})
