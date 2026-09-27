import { describe, expect, it } from 'vitest'
import { resolveConnectivityTarget } from '../src/main/config/connectivity'

/**
 * 试连的"该用哪个 Key"策略。
 *
 * 背景：试连允许调用方传接口地址。若"改了地址却没填 Key"还能回退到已保存的 Key，
 * 就等于把用户的密钥发给了它指定的任意网址——这里逐种组合把门关死。
 */

const SAVED = {
  savedApiKey: 'saved-key-abcd1234',
  savedBaseUrl: 'https://api.deepseek.com',
  savedModel: 'deepseek-chat'
}

describe('试连目标解析：Key 与会话地址', () => {
  it('没填 Key、地址也没改 → 复用已保存的 Key', () => {
    const target = resolveConnectivityTarget({ ...SAVED })
    expect(target.ok).toBe(true)
    if (!target.ok) return
    expect(target.keySource).toBe('saved')
    expect(target.apiKey).toBe(SAVED.savedApiKey)
    expect(target.baseUrl).toBe(SAVED.savedBaseUrl)
    expect(target.model).toBe(SAVED.savedModel)
  })

  it('改了接口地址、没填 Key → 拒绝（不把已保存的 Key 发到新地址）', () => {
    const target = resolveConnectivityTarget({
      ...SAVED,
      inputBaseUrl: 'https://elsewhere.invalid/v1'
    })
    expect(target.ok).toBe(false)
    if (target.ok) return
    expect(target.kind).toBe('endpoint-changed')
    // 提示必须说人话，且不得包含 Key 的任何片段
    expect(target.message).not.toContain(SAVED.savedApiKey)
    expect(target.message).toContain('重新填写')
  })

  it('末尾多一个斜杠也算改了地址 → 同样拒绝（宁可让调用方重填一次）', () => {
    const target = resolveConnectivityTarget({
      ...SAVED,
      inputBaseUrl: 'https://api.deepseek.com/'
    })
    expect(target.ok).toBe(false)
    if (target.ok) return
    expect(target.kind).toBe('endpoint-changed')
  })

  it('改了地址、但自己填了 Key → 允许（这正是"试连新 Key"的正常用法）', () => {
    const target = resolveConnectivityTarget({
      ...SAVED,
      inputBaseUrl: 'https://elsewhere.invalid/v1',
      inputApiKey: 'input-key-9999',
      inputModel: 'deepseek-reasoner'
    })
    expect(target.ok).toBe(true)
    if (!target.ok) return
    expect(target.keySource).toBe('input')
    expect(target.apiKey).toBe('input-key-9999')
    expect(target.baseUrl).toBe('https://elsewhere.invalid/v1')
    expect(target.model).toBe('deepseek-reasoner')
  })

  it('没填 Key、地址没改、但本地也没有已保存的 Key → missing-key 提示', () => {
    const target = resolveConnectivityTarget({
      savedApiKey: '',
      savedBaseUrl: SAVED.savedBaseUrl,
      savedModel: SAVED.savedModel
    })
    expect(target.ok).toBe(false)
    if (target.ok) return
    expect(target.kind).toBe('missing-key')
  })

  it('空白字符串一律按"没填"处理（不给拼接绕过留缝）', () => {
    const target = resolveConnectivityTarget({
      ...SAVED,
      inputApiKey: '   ',
      inputBaseUrl: '  '
    })
    expect(target.ok).toBe(true)
    if (!target.ok) return
    expect(target.keySource).toBe('saved')
  })
})
