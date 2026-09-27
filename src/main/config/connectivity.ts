/**
 * 「连通性测试该用哪个 Key、发往哪个地址」的纯策略。
 *
 * 为什么单独抽出来（安全考虑）：
 *   试连允许界面传接口地址。如果调用方**改了地址**却**没填 Key**，旧实现会回退到
 *   已保存的 Key —— 等于把用户存好的密钥发给了这次指定的任意网址。
 *   正常使用不会这样（界面里地址来自已保存配置），但这是一扇可以随手关掉的门，
 *   所以在这里明确拒绝：**地址一旦变化，就必须由调用方自己重新提供 Key**。
 *
 * 纯函数、零依赖：便于离线单测（见 `tests/connectivity.test.ts`），也便于自检直接断言。
 */

export interface ConnectivityRequest {
  /** 界面里填的 Key（可为空或空白＝没填） */
  inputApiKey?: string | undefined
  /** 界面里填的接口地址（可为空＝沿用已保存的） */
  inputBaseUrl?: string | undefined
  /** 界面里填的模型名（可为空＝沿用已保存的） */
  inputModel?: string | undefined
  /** 当前可用的已保存 Key（用户配置或环境变量；可为空） */
  savedApiKey: string
  /** 当前生效的接口地址（用户配置 → 环境变量 → 默认值） */
  savedBaseUrl: string
  /** 当前生效的模型名 */
  savedModel: string
}

export type ConnectivityTarget =
  | {
      ok: true
      apiKey: string
      baseUrl: string
      model: string
      /** Key 来自调用方本次填写，还是复用了已保存的那一份（供界面提示） */
      keySource: 'input' | 'saved'
    }
  | {
      ok: false
      /** endpoint-changed = 改了地址又没填 Key，拒绝复用已保存的 Key */
      kind: 'missing-key' | 'endpoint-changed'
      message: string
    }

/** 去掉首尾空白；空串按"没填"处理 */
function clean(value: string | undefined): string {
  return (value ?? '').trim()
}

export function resolveConnectivityTarget(request: ConnectivityRequest): ConnectivityTarget {
  const inputKey = clean(request.inputApiKey)
  const baseUrl = clean(request.inputBaseUrl) || request.savedBaseUrl
  const model = clean(request.inputModel) || request.savedModel

  // 调用方自己填了 Key：允许配任意地址（这正是「先试连一下」用来验证新 Key 的场景）
  if (inputKey) {
    return { ok: true, apiKey: inputKey, baseUrl, model, keySource: 'input' }
  }

  // 没填 Key：只有在"接口地址没被改过"时才允许复用已保存的 Key。
  // 注意比较的是原字符串：多一个结尾斜杠也算改过——宁可让调用方重填一次，
  // 也不要把密钥发到一个我们没配置过的地址上。
  if (baseUrl !== request.savedBaseUrl) {
    return {
      ok: false,
      kind: 'endpoint-changed',
      message: '换了接口地址，就需要重新填写一次 API Key（已保存的 Key 只会发往原来配好的地址）'
    }
  }

  const savedKey = clean(request.savedApiKey)
  if (!savedKey) {
    return { ok: false, kind: 'missing-key', message: '还没有填写 API Key' }
  }

  return { ok: true, apiKey: savedKey, baseUrl, model, keySource: 'saved' }
}
